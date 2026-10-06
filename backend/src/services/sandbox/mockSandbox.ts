import { ICodeExecutionSandbox } from './codeExecutionSandbox';
import { CodeExecutionRequest, CodeExecutionResult } from '../../types/coding';

export interface MockSandboxRule {
  matchCode?: string | RegExp;
  matchInput?: string | RegExp;
  result: Partial<CodeExecutionResult>;
}

/**
 * Controllable Mock Sandbox for zero-dependency deterministic testing.
 */
export class MockCodeExecutionSandbox implements ICodeExecutionSandbox {
  private resultQueue: CodeExecutionResult[] = [];
  private rules: MockSandboxRule[] = [];
  private shouldFailWithSandboxError: boolean = false;
  public executionCount = 0;
  public executedRequests: CodeExecutionRequest[] = [];

  public queueResult(result: Partial<CodeExecutionResult>): void {
    this.resultQueue.push({
      status: result.status || 'completed',
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode !== undefined ? result.exitCode : 0,
      executionTimeMs: result.executionTimeMs || 25,
      memoryUsedMb: result.memoryUsedMb || 16,
      compilerOutput: result.compilerOutput,
      error: result.error,
    });
  }

  public addRule(rule: MockSandboxRule): void {
    this.rules.push(rule);
  }

  public setSandboxError(shouldError: boolean): void {
    this.shouldFailWithSandboxError = shouldError;
  }

  public reset(): void {
    this.resultQueue = [];
    this.rules = [];
    this.shouldFailWithSandboxError = false;
    this.executionCount = 0;
    this.executedRequests = [];
  }

  public async execute(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    this.executionCount++;
    this.executedRequests.push(request);

    if (this.shouldFailWithSandboxError) {
      return {
        status: 'sandbox_error',
        stdout: '',
        stderr: 'Docker daemon connection refused or container runtime unavailable.',
        exitCode: null,
        executionTimeMs: 0,
        memoryUsedMb: 0,
        error: 'Container runtime unavailable.',
      };
    }

    // Check queued results
    if (this.resultQueue.length > 0) {
      return this.resultQueue.shift()!;
    }

    // Check matching rules
    for (const rule of this.rules) {
      const codeMatch = !rule.matchCode ||
        (rule.matchCode instanceof RegExp
          ? rule.matchCode.test(request.code)
          : request.code.includes(rule.matchCode));
      const inputMatch = !rule.matchInput ||
        (rule.matchInput instanceof RegExp
          ? rule.matchInput.test(request.input || '')
          : (request.input || '').includes(rule.matchInput));

      if (codeMatch && inputMatch) {
        return {
          status: rule.result.status || 'completed',
          stdout: rule.result.stdout || '',
          stderr: rule.result.stderr || '',
          exitCode: rule.result.exitCode !== undefined ? rule.result.exitCode : 0,
          executionTimeMs: rule.result.executionTimeMs || 25,
          memoryUsedMb: rule.result.memoryUsedMb || 16,
          compilerOutput: rule.result.compilerOutput,
          error: rule.result.error,
        };
      }
    }

    // Default intelligent simulation for common code patterns in tests
    const code = request.code || '';
    const input = (request.input || '').trim();

    // Check for simulated compilation error
    if (code.includes('syntax_error_marker') || code.includes('SYNTAX_ERROR')) {
      return {
        status: 'compilation_error',
        stdout: '',
        stderr: "solution.cpp: In function 'int main()':\nsolution.cpp:14:5: error: expected ';' before '}' token",
        compilerOutput: "solution.cpp:14:5: error: expected ';' before '}' token",
        exitCode: 1,
        executionTimeMs: 40,
        memoryUsedMb: 24,
      };
    }

    // Check for simulated runtime error (segfault, divide by zero)
    if (code.includes('runtime_error_marker') || code.includes('DIVIDE_BY_ZERO')) {
      return {
        status: 'runtime_error',
        stdout: '',
        stderr: 'Segmentation fault (core dumped)',
        exitCode: 139,
        executionTimeMs: 30,
        memoryUsedMb: 32,
      };
    }

    // Check for simulated timeout
    if (code.includes('while(true)') || code.includes('TIMEOUT_MARKER')) {
      return {
        status: 'timeout',
        stdout: '',
        stderr: 'Execution timed out after 3000ms',
        exitCode: null,
        executionTimeMs: request.timeoutMs || 3000,
        memoryUsedMb: 64,
        error: 'Process killed due to execution timeout.',
      };
    }

    // Check for simulated memory limit
    if (code.includes('MEMORY_LIMIT_MARKER')) {
      return {
        status: 'memory_limit',
        stdout: '',
        stderr: 'Process exceeded memory limit (256 MB)',
        exitCode: 137,
        executionTimeMs: 120,
        memoryUsedMb: 260,
        error: 'Out of memory: process killed by sandbox container.',
      };
    }

    // Check for simulated output limit
    if (code.includes('OUTPUT_LIMIT_MARKER')) {
      return {
        status: 'output_limit',
        stdout: 'A'.repeat(65536) + '...',
        stderr: 'Output limit exceeded: truncated at 65536 bytes.',
        exitCode: null,
        executionTimeMs: 80,
        memoryUsedMb: 32,
        error: 'Output limit exceeded.',
      };
    }

    // Default: simulate successful output for common algorithms
    let simOutput = input;

    // Array max element algorithm simulation
    if (code.includes('max_element') || code.includes('findMax') || code.includes('maxVal')) {
      const numbers = input.split(/\s+/).map(Number).filter((n) => !isNaN(n));
      if (numbers.length > 1) {
        // e.g. "5\n1 7 3 9 2" -> 9
        const arrayItems = numbers.slice(1);
        if (arrayItems.length > 0) {
          simOutput = String(Math.max(...arrayItems));
        } else {
          simOutput = String(Math.max(...numbers));
        }
      } else if (numbers.length === 1) {
        simOutput = String(numbers[0]);
      }
    } else if (code.includes('add') || code.includes('calculateSum')) {
      // Sum of two numbers simulation
      const numbers = input.split(/\s+/).map(Number).filter((n) => !isNaN(n));
      if (numbers.length >= 2) {
        simOutput = String(numbers[0] + numbers[1]);
      }
    }

    return {
      status: 'completed',
      stdout: simOutput,
      stderr: '',
      exitCode: 0,
      executionTimeMs: 35,
      memoryUsedMb: 24,
    };
  }

  public async checkHealth(): Promise<{ available: boolean; message?: string }> {
    if (this.shouldFailWithSandboxError) {
      return { available: false, message: 'Mock sandbox set to unavailable.' };
    }
    return { available: true, message: 'Mock sandbox operational.' };
  }
}
