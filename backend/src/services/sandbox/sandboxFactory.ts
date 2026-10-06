import { ICodeExecutionSandbox } from './codeExecutionSandbox';
import { DockerCodeExecutionSandbox } from './dockerSandbox';
import { MockCodeExecutionSandbox } from './mockSandbox';

export class SandboxFactory {
  private static customSandbox: ICodeExecutionSandbox | null = null;
  private static defaultSandbox: ICodeExecutionSandbox | null = null;

  /**
   * Overrides the sandbox implementation (e.g. for unit tests).
   */
  public static setSandbox(sandbox: ICodeExecutionSandbox | null): void {
    this.customSandbox = sandbox;
  }

  /**
   * Retrieves the active code execution sandbox.
   */
  public static getSandbox(): ICodeExecutionSandbox {
    if (this.customSandbox) {
      return this.customSandbox;
    }

    if (process.env.CODE_EXECUTION_SANDBOX === 'mock' || process.env.NODE_ENV === 'test') {
      if (!this.defaultSandbox || !(this.defaultSandbox instanceof MockCodeExecutionSandbox)) {
        this.defaultSandbox = new MockCodeExecutionSandbox();
      }
      return this.defaultSandbox;
    }

    if (!this.defaultSandbox) {
      this.defaultSandbox = new DockerCodeExecutionSandbox();
    }

    return this.defaultSandbox;
  }
}
