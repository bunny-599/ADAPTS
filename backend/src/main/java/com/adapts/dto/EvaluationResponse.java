package com.adapts.dto;

import java.util.List;

public record EvaluationResponse(
    int overallScore,
    List<QuestionEvaluation> evaluations
) {
    public record QuestionEvaluation(
        String question,
        String userAnswer,
        String feedback,
        String status // "strong" or "weak"
    ) {}
}
