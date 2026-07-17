package com.adapts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AssessmentRequest(
    @NotBlank(message = "Field of study is required")
    String field,

    @NotBlank(message = "Subject is required")
    String subject,

    @NotBlank(message = "Topic/learning notes are required")
    @Size(min = 10, message = "Describe what you learned today in at least 10 characters")
    String topic
) {}
