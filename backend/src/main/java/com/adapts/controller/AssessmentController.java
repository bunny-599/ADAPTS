package com.adapts.controller;

import com.adapts.dto.AssessmentRequest;
import com.adapts.dto.AssessmentResponse;
import com.adapts.dto.EvaluationRequest;
import com.adapts.dto.EvaluationResponse;
import com.adapts.dto.CodeRunRequest;
import com.adapts.dto.CodeRunResponse;
import com.adapts.service.AssessmentService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AssessmentController {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentController.class);
    private final AssessmentService assessmentService;

    public AssessmentController(AssessmentService assessmentService) {
        this.assessmentService = assessmentService;
    }

    /**
     * Endpoint to generate assessment questions from AI based on input criteria.
     * POST /api/generate-questions
     */
    @PostMapping("/generate-questions")
    public ResponseEntity<AssessmentResponse> generateQuestions(@Valid @RequestBody AssessmentRequest request) {
        logger.info("Received request to generate questions. Field: {}, Subject: {}", request.field(), request.subject());
        AssessmentResponse response = assessmentService.generateAssessment(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint to evaluate student answers to the generated questions.
     * POST /api/evaluate-answers
     */
    @PostMapping("/evaluate-answers")
    public ResponseEntity<EvaluationResponse> evaluateAnswers(@Valid @RequestBody EvaluationRequest request) {
        logger.info("Received request to evaluate answers. Field: {}, Subject: {}", request.field(), request.subject());
        EvaluationResponse response = assessmentService.evaluateAnswers(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint to simulate compiling and running code.
     * POST /api/run-code
     */
    @PostMapping("/run-code")
    public ResponseEntity<CodeRunResponse> runCode(@Valid @RequestBody CodeRunRequest request) {
        logger.info("Received request to execute code for language: {}", request.language());
        CodeRunResponse response = assessmentService.runCode(request);
        return ResponseEntity.ok(response);
    }
}


