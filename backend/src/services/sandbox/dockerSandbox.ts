import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ICodeExecutionSandbox } from './codeExecutionSandbox';
import { CodeExecutionRequest, CodeExecutionResult, CodeExecutionStatus } from '../../types/coding';

export class DockerCodeExecutionSandbox implements ICodeExecutionSandbox {
  private timeoutMs: number;
  private memoryMb: number;
  private outputLimitBytes: number;
  private pidsLimit: number;
  private dockerImage: string;

  constructor(options: {
    timeoutMs?: number;
    memoryMb?: number;
    outputLimitBytes?: number;
    pidsLimit?: number;
    dockerImage?: string;
  } = {}) {
    this.timeoutMs = options.timeoutMs ?? parseInt(process.env.CODE_EXECUTION_TIMEOUT_MS || '3000', 10);
    this.memoryMb = options.memoryMb ?? parseInt(process.env.CODE_EXECUTION_MEMORY_MB || '256', 10);
    this.outputLimitBytes = options.outputLimitBytes ?? parseInt(process.env.CODE_EXECUTION_OUTPUT_LIMIT_BYTES || '65536', 10);
    this.pidsLimit = options.pidsLimit ?? parseInt(process.env.CODE_EXECUTION_PIDS_LIMIT || '64', 10);
    this.dockerImage = options.dockerImage || process.env.DOCKER_CPP_IMAGE || 'gcc:alpine';
  }

  /**
   * Checks if Docker daemon is responsive.
   */
  public async checkHealth(): Promise<{ available: boolean; message?: string }> {
    return new Promise((resolve) => {
      try {
        const proc = spawn('docker', ['version', '--format', '{{.Server.Version}}'], {
          timeout: 2000,
        });

        proc.on('error', (err) => {
          resolve({ available: false, message: `Docker not available: ${err.message}` });
        });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ available: true, message: 'Docker is available and running.' });
          } else {
            resolve({ available: false, message: `Docker exited with code ${code}` });
          }
        });
      } catch (err: any) {
        resolve({ available: false, message: `Docker check failed: ${err.message}` });
      }
    });
  }

  /**
   * Executes C++ student code in an isolated container.
   */
  public async execute(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = request.timeoutMs ?? this.timeoutMs;
    const memoryMb = request.memoryMb ?? this.memoryMb;
    const outputLimit = request.outputLimitBytes ?? this.outputLimitBytes;

    // 1. Create unique isolated temporary workspace
    const runId = crypto.randomBytes(8).toString('hex');
    const containerName = `adapts_run_${runId}`;
    const tempDir = path.join(os.tmpdir(), `adapts_sandbox_${runId}`);

    try {
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(path.join(tempDir, 'solution.cpp'), request.code, 'utf8');
      await fs.writeFile(path.join(tempDir, 'input.txt'), request.input || '', 'utf8');

      // 2. Compilation Phase inside container
      const compileResult = await this.runCommandInDocker({
        containerName: `${containerName}_compile`,
        tempDir,
        command: 'g++ -O2 -std=c++17 -Wall solution.cpp -o solution',
        timeoutMs: Math.min(timeoutMs + 3000, 8000),
        memoryMb,
      });

      if (compileResult.status === 'sandbox_error') {
        return compileResult;
      }

      if (compileResult.exitCode !== 0) {
        return {
          status: 'compilation_error',
          stdout: '',
          stderr: this.sanitizeOutput(compileResult.stderr),
          exitCode: compileResult.exitCode,
          executionTimeMs: Date.now() - startTime,
          memoryUsedMb: compileResult.memoryUsedMb,
          compilerOutput: this.sanitizeOutput(compileResult.stderr),
        };
      }

      // 3. Execution Phase inside container
      const runResult = await this.runCommandInDocker({
        containerName: `${containerName}_exec`,
        tempDir,
        command: './solution < input.txt',
        timeoutMs,
        memoryMb,
      });

      const elapsed = Date.now() - startTime;

      if (runResult.status === 'sandbox_error' || runResult.status === 'timeout') {
        return {
          ...runResult,
          executionTimeMs: elapsed,
        };
      }

      // Check for Out Of Memory (Exit code 137 typically represents SIGKILL / OOM)
      if (runResult.exitCode === 137 || runResult.stderr.toLowerCase().includes('killed')) {
        return {
          status: 'memory_limit',
          stdout: '',
          stderr: 'Memory limit exceeded (Process terminated by container manager).',
          exitCode: 137,
          executionTimeMs: elapsed,
          memoryUsedMb: memoryMb,
          error: 'Out of memory: execution exceeded configured limit.',
        };
      }

      // Check for Output limit
      let stdout = runResult.stdout;
      if (stdout.length > outputLimit) {
        return {
          status: 'output_limit',
          stdout: stdout.slice(0, outputLimit) + '...',
          stderr: `Output limit of ${outputLimit} bytes exceeded.`,
          exitCode: null,
          executionTimeMs: elapsed,
          memoryUsedMb: runResult.memoryUsedMb,
          error: 'Output limit exceeded.',
        };
      }

      // Check for Runtime error (Crash / Segfault)
      if (runResult.exitCode !== 0) {
        return {
          status: 'runtime_error',
          stdout: this.sanitizeOutput(stdout),
          stderr: this.sanitizeOutput(runResult.stderr) || `Process exited with error code ${runResult.exitCode}`,
          exitCode: runResult.exitCode,
          executionTimeMs: elapsed,
          memoryUsedMb: runResult.memoryUsedMb,
          error: 'Runtime execution error.',
        };
      }

      return {
        status: 'completed',
        stdout: this.sanitizeOutput(stdout),
        stderr: this.sanitizeOutput(runResult.stderr),
        exitCode: 0,
        executionTimeMs: elapsed,
        memoryUsedMb: runResult.memoryUsedMb,
      };
    } catch (sandboxErr: any) {
      console.warn('[DockerCodeExecutionSandbox] Execution failure:', sandboxErr.message);
      return {
        status: 'sandbox_error',
        stdout: '',
        stderr: 'Code execution environment encountered an internal error.',
        exitCode: null,
        executionTimeMs: Date.now() - startTime,
        memoryUsedMb: 0,
        error: sandboxErr.message || 'Sandbox error',
      };
    } finally {
      // 4. Guaranteed isolated workspace cleanup
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (rmErr) {
        // Safe to ignore cleanup warning
      }
    }
  }

  /**
   * Spawns a hardened Docker container with security constraints:
   * - --network none (strictly prevents external network requests)
   * - --memory (memory ceiling)
   * - --cpus 0.5 (CPU throttling)
   * - --pids-limit 64 (prevents fork bombs)
   * - mounts ONLY the isolated temp workspace to /sandbox
   */
  private async runCommandInDocker(options: {
    containerName: string;
    tempDir: string;
    command: string;
    timeoutMs: number;
    memoryMb: number;
  }): Promise<CodeExecutionResult> {
    const { containerName, tempDir, command, timeoutMs, memoryMb } = options;

    return new Promise((resolve) => {
      let isTimedOut = false;
      let stdoutData = '';
      let stderrData = '';
      const startTime = Date.now();

      // Convert Windows paths to Docker volume compatible paths if needed
      const normalizedPath = tempDir.replace(/\\/g, '/');

      const dockerArgs = [
        'run',
        '--rm',
        '--name',
        containerName,
        '--network',
        'none',
        '--memory',
        `${memoryMb}m`,
        '--cpus',
        '0.5',
        '--pids-limit',
        String(this.pidsLimit),
        '-v',
        `${normalizedPath}:/sandbox:rw`,
        '-w',
        '/sandbox',
        this.dockerImage,
        'sh',
        '-c',
        command,
      ];

      let proc: any;
      try {
        proc = spawn('docker', dockerArgs);
      } catch (spawnErr: any) {
        return resolve({
          status: 'sandbox_error',
          stdout: '',
          stderr: `Failed to spawn docker process: ${spawnErr.message}`,
          exitCode: null,
          executionTimeMs: 0,
          memoryUsedMb: 0,
          error: spawnErr.message,
        });
      }

      // Timeout watchdog: actively kills container if limit exceeded
      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          spawn('docker', ['kill', containerName]);
          proc.kill('SIGKILL');
        } catch {
          // ignore kill failure
        }
      }, timeoutMs);

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdoutData += chunk.toString('utf8');
        if (stdoutData.length > this.outputLimitBytes * 2) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore
          }
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString('utf8');
      });

      proc.on('error', (err: any) => {
        clearTimeout(timer);
        resolve({
          status: 'sandbox_error',
          stdout: '',
          stderr: `Docker execution error: ${err.message}`,
          exitCode: null,
          executionTimeMs: Date.now() - startTime,
          memoryUsedMb: 0,
          error: err.message,
        });
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);

        if (isTimedOut) {
          return resolve({
            status: 'timeout',
            stdout: stdoutData,
            stderr: `Execution exceeded timeout of ${timeoutMs}ms.`,
            exitCode: null,
            executionTimeMs: timeoutMs,
            memoryUsedMb: Math.round(memoryMb * 0.5),
            error: 'Process killed due to execution timeout.',
          });
        }

        resolve({
          status: 'completed',
          stdout: stdoutData,
          stderr: stderrData,
          exitCode: code,
          executionTimeMs: Date.now() - startTime,
          memoryUsedMb: 24, // Typical base RSS for minimal g++ / alpine process
        });
      });
    });
  }

  /**
   * Sanitizes compiler and runtime diagnostics, stripping host paths.
   */
  private sanitizeOutput(output: string): string {
    if (!output) return '';
    return output
      .replace(/\/sandbox\//g, '')
      .replace(/[A-Z]:\\[^:\n]+/gi, 'solution.cpp');
  }
}
