import { CodeExecutionRequest, CodeExecutionResult } from '../../types/coding';

export interface ICodeExecutionSandbox {
  execute(request: CodeExecutionRequest): Promise<CodeExecutionResult>;
  checkHealth?(): Promise<{ available: boolean; message?: string }>;
}
