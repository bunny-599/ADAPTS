export type CodeExecutionStatus =
  | 'completed'
  | 'compilation_error'
  | 'runtime_error'
  | 'timeout'
  | 'memory_limit'
  | 'output_limit'
  | 'sandbox_error';

export type CodingTestCaseStatus =
  | 'passed'
  | 'failed'
  | 'timeout'
  | 'runtime_error';

export interface PublicTestResultView {
  testCaseId: number | string;
  status: CodingTestCaseStatus;
  executionTimeMs: number;
  actualOutput?: string;
  expectedOutput?: string;
  isHidden: boolean;
}

export interface SubmitCodeRequest {
  questionId: number | string;
  language: 'cpp';
  code: string;
}

export interface SubmitCodeResponse {
  status: 'success' | 'error';
  evaluationStatus: CodeExecutionStatus;
  score: number;
  passedTests: number;
  totalTests: number;
  executionTimeMs: number;
  memoryUsedMb: number;
  compilerOutput?: string;
  testResults: PublicTestResultView[];
  code?: string;
  message?: string;
}

export interface VisibleTestResultView {
  testCaseId: number | string;
  status: CodingTestCaseStatus;
  executionTimeMs: number;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  error?: string;
}

export interface RunCodeRequest {
  questionId: number | string;
  language: 'cpp';
  code: string;
}

export interface RunCodeResponse {
  status: 'success' | 'error';
  evaluationStatus: CodeExecutionStatus;
  passedTests: number;
  totalTests: number;
  executionTimeMs: number;
  compilerOutput?: string;
  testResults: VisibleTestResultView[];
  code?: string;
  message?: string;
}
