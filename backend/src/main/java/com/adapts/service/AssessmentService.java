package com.adapts.service;

import com.adapts.client.GeminiClient;
import com.adapts.dto.AssessmentRequest;
import com.adapts.dto.AssessmentResponse;
import com.adapts.dto.EvaluationRequest;
import com.adapts.dto.EvaluationResponse;
import com.adapts.dto.CodeRunRequest;
import com.adapts.dto.CodeRunResponse;
import com.adapts.model.Assessment;
import com.adapts.dto.AssessmentResponse.QuestionDto;
import com.adapts.model.QuestionItem;
import com.adapts.repository.AssessmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AssessmentService {

    private static final Logger logger = LoggerFactory.getLogger(AssessmentService.class);
    private final GeminiClient geminiClient;
    private final AssessmentRepository assessmentRepository;

    public AssessmentService(GeminiClient geminiClient, AssessmentRepository assessmentRepository) {
        this.geminiClient = geminiClient;
        this.assessmentRepository = assessmentRepository;
    }

    /**
     * Generates a new assessment using AI and saves it to the history.
     */
    @Transactional
    public AssessmentResponse generateAssessment(com.adapts.dto.AssessmentRequest request) {
        logger.info("Starting assessment generation for Field: {}, Subject: {}", request.field(), request.subject());
        
        // 1. Generate questions via Gemini client
        List<QuestionDto> questions = geminiClient.generateQuestions(
                request.field(),
                request.subject(),
                request.topic()
        );

        // 2. Persist to database history (runs H2 or PostgreSQL based on configuration)
        try {
            List<QuestionItem> items = questions.stream()
                    .map(q -> new QuestionItem(q.question(), q.type()))
                    .toList();

            Assessment assessment = new Assessment(
                    request.field(),
                    request.subject(),
                    request.topic(),
                    items
            );
            Assessment saved = assessmentRepository.save(assessment);
            logger.info("Successfully persisted generated assessment (ID: {}) to database", saved.getId());
        } catch (Exception e) {
            // We log the database save error, but don't fail the API request since generating questions is primary
            logger.error("Failed to save assessment to history database: {}", e.getMessage(), e);
        }

        // 3. Return response payload
        return new AssessmentResponse(questions);
    }

    /**
     * Evaluates student's answers using AI.
     */
    public EvaluationResponse evaluateAnswers(EvaluationRequest request) {
        logger.info("Evaluating answers for Field: {}, Subject: {}", request.field(), request.subject());
        return geminiClient.evaluateAnswers(request);
    }

    /**
     * Simulates compiling and executing a block of code.
     */
    public CodeRunResponse runCode(CodeRunRequest request) {
        logger.info("Simulating execution of code for language: {}", request.language());
        return geminiClient.runCode(request);
    }
}


