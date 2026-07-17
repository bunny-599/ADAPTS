package com.adapts.dto;

import java.util.List;

public record CodeRunResponse(
    String status,          // "success", "compile_error", "runtime_error"
    String consoleOutput,   // Simulated standard output logs
    String errorMessage,    // Compiler error message if status is not success
    List<TestCaseResult> testCases,
    String feedback         // Overall code quality & complexity suggestions
) {
    public record TestCaseResult(
        String input,
        String expected,
        String actual,
        boolean passed
    ) {}
}
