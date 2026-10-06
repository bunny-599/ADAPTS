export interface ILanguageRunner {
  readonly language: string;
  getSourceFileName(): string;
  getCompileCommand(sourceFile: string, outputFile: string): string[];
  getRunCommand(executableFile: string): string[];
}
