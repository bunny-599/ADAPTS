package com.adapts.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record EvaluationRequest(
    @NotBlank(message = "Field is required")
    String field,

    @NotBlank(message = "Subject is required")
    String subject,

    @NotEmpty(message = "Answers list cannot be empty")
    @Valid
    List<AnswerSubmission> answers
) {
    public record AnswerSubmission(
        @NotBlank(message = "Question is required")
        String question,

        String userAnswer
    ) {}
}
