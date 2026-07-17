package com.adapts.dto;

import jakarta.validation.constraints.NotBlank;

public record CodeRunRequest(
    @NotBlank(message = "Question is required")
    String question,

    @NotBlank(message = "Code is required")
    String code,

    @NotBlank(message = "Language is required")
    String language
) {}
