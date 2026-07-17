package com.adapts.dto;

import java.util.List;

public record AssessmentResponse(
    List<QuestionDto> questions
) {
    public record QuestionDto(String question, String type) {}
}
