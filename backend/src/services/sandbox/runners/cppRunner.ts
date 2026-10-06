import { ILanguageRunner } from './languageRunner';

export class CppRunner implements ILanguageRunner {
  public readonly language = 'cpp';

  public getSourceFileName(): string {
    return 'solution.cpp';
  }

  public getCompileCommand(sourceFile: string, outputFile: string): string[] {
    return ['g++', '-O2', '-std=c++17', '-Wall', sourceFile, '-o', outputFile];
  }

  public getRunCommand(executableFile: string): string[] {
    return [`./${executableFile}`];
  }
}
