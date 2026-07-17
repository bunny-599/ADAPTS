package com.adapts.client;

import com.adapts.dto.EvaluationRequest;
import com.adapts.dto.EvaluationResponse;
import com.adapts.dto.CodeRunRequest;
import com.adapts.dto.CodeRunResponse;
import com.adapts.dto.AssessmentResponse.QuestionDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class GeminiClient {

    private static final Logger logger = LoggerFactory.getLogger(GeminiClient.class);
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.url}")
    private String apiUrl;

    @Value("${gemini.api.key}")
    private String apiKey;

    public GeminiClient(ObjectMapper objectMapper) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
        this.objectMapper = objectMapper;
    }

    /**
     * Calls Gemini API to generate questions based on field, subject, and topic.
     *
     * @param field   The selected field of study
     * @param subject The selected subject
     * @param topic   The description of what the user learned
     * @return List of 5 generated questions with type classifications
     */
    public List<QuestionDto> generateQuestions(String field, String subject, String topic) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            logger.error("Gemini API key is missing. Please set the GEMINI_API_KEY environment variable.");
            throw new IllegalStateException("Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable.");
        }

        // Construct the prompt
        String prompt = String.format(
                "You are an expert educator.\n\n" +
                "Field: %s\n" +
                "Subject: %s\n\n" +
                "The student learned:\n" +
                "%s\n\n" +
                "Generate exactly 5 assessment questions.\n\n" +
                "Requirements:\n" +
                "* Mix conceptual questions (type = 'theory') and practical/programming questions (type = 'coding').\n" +
                "* Explicitly set 'type' as 'theory' or 'coding' for each question.\n" +
                "* Questions should test understanding.\n" +
                "* Keep questions clear and concise.\n" +
                "* Return valid JSON only matching the schema.",
                field, subject, topic
        );

        try {
            // Build Gemini Request Payload using structured JSON outputs configuration
            // See: https://ai.google.dev/gemini-api/docs/structured-output
            Map<String, Object> requestPayload = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(
                                    Map.of("text", prompt)
                              ))
                    ),
                    "generationConfig", Map.of(
                            "responseMimeType", "application/json",
                            "responseSchema", Map.of(
                                    "type", "OBJECT",
                                    "properties", Map.of(
                                            "questions", Map.of(
                                                    "type", "ARRAY",
                                                    "items", Map.of(
                                                            "type", "OBJECT",
                                                            "properties", Map.of(
                                                                    "question", Map.of("type", "STRING"),
                                                                    "type", Map.of("type", "STRING", "enum", List.of("theory", "coding"))
                                                            ),
                                                            "required", List.of("question", "type")
                                                    )
                                            )
                                    ),
                                    "required", List.of("questions")
                            )
                    )
            );

            String requestBody = objectMapper.writeValueAsString(requestPayload);

            // Construct HTTP request with x-goog-api-key header
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(30))
                    .build();

            logger.info("Sending request to Gemini API for field: {}, subject: {}", field, subject);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                logger.error("Gemini API returned error code {}: {}", response.statusCode(), response.body());
                throw new RuntimeException("Gemini API request failed with status code " + response.statusCode());
            }

            // Parse response
            JsonNode rootNode = objectMapper.readTree(response.body());
            JsonNode candidates = rootNode.path("candidates");
            if (candidates.isMissingNode() || candidates.size() == 0) {
                throw new RuntimeException("Gemini API returned an empty response candidates list");
            }

            String jsonText = candidates.get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();

            logger.debug("Received raw text from Gemini: {}", jsonText);

            // Parse the inner JSON text which contains the questions
            JsonNode innerJson = objectMapper.readTree(jsonText);
            JsonNode questionsNode = innerJson.path("questions");
            
            List<QuestionDto> questions = new ArrayList<>();
            if (questionsNode.isArray()) {
                for (JsonNode qNode : questionsNode) {
                    questions.add(new QuestionDto(
                            qNode.path("question").asText(),
                            qNode.path("type").asText()
                    ));
                }
            }

            if (questions.isEmpty()) {
                throw new RuntimeException("No questions were generated by Gemini.");
            }

            // If Gemini returned more/fewer, restrict or validate
            logger.info("Successfully generated {} questions from Gemini", questions.size());
            return questions;

        } catch (Exception e) {
            logger.error("Error communicating with Gemini API: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate questions: " + e.getMessage(), e);
        }
    }

    /**
     * Calls Gemini API to evaluate user answers.
     */
    public EvaluationResponse evaluateAnswers(EvaluationRequest request) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            logger.error("Gemini API key is missing. Please set the GEMINI_API_KEY environment variable.");
            throw new IllegalStateException("Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable.");
        }

        // Build the evaluation prompt string
        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("You are an expert educator evaluating a student's assessment answers.\n\n");
        promptBuilder.append(String.format("Field: %s\nSubject: %s\n\n", request.field(), request.subject()));
        promptBuilder.append("Please evaluate the student's answers to the following questions. ");
        promptBuilder.append("For each question, classify the answer as 'strong' (correct, showing deep understanding) ");
        promptBuilder.append("or 'weak' (incorrect, vague, incomplete, or left blank). ");
        promptBuilder.append("Provide concise feedback explaining why, correcting any errors, and showing the right concept.\n\n");
        promptBuilder.append("Calculate an overall score out of 100 based on their performance.\n\n");
        promptBuilder.append("Here are the questions and student answers:\n");

        for (int i = 0; i < request.answers().size(); i++) {
            var qa = request.answers().get(i);
            promptBuilder.append(String.format("--- Question %d ---\n%s\n", i + 1, qa.question()));
            promptBuilder.append(String.format("Student's Answer: %s\n\n", qa.userAnswer() == null || qa.userAnswer().trim().isEmpty() ? "(No answer provided)" : qa.userAnswer()));
        }

        promptBuilder.append("Return valid JSON only matching the schema.");

        String prompt = promptBuilder.toString();

        try {
            // Build Gemini Request Payload using structured JSON outputs configuration
            Map<String, Object> requestPayload = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(
                                    Map.of("text", prompt)
                              ))
                    ),
                    "generationConfig", Map.of(
                            "responseMimeType", "application/json",
                            "responseSchema", Map.of(
                                    "type", "OBJECT",
                                    "properties", Map.of(
                                            "overallScore", Map.of("type", "INTEGER"),
                                            "evaluations", Map.of(
                                                    "type", "ARRAY",
                                                    "items", Map.of(
                                                            "type", "OBJECT",
                                                            "properties", Map.of(
                                                                    "question", Map.of("type", "STRING"),
                                                                    "userAnswer", Map.of("type", "STRING"),
                                                                    "feedback", Map.of("type", "STRING"),
                                                                    "status", Map.of("type", "STRING", "enum", List.of("strong", "weak"))
                                                            ),
                                                            "required", List.of("question", "userAnswer", "feedback", "status")
                                                    )
                                            )
                                    ),
                                    "required", List.of("overallScore", "evaluations")
                            )
                    )
            );

            String requestBody = objectMapper.writeValueAsString(requestPayload);

            // Construct HTTP request with x-goog-api-key header
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(30))
                    .build();

            logger.info("Sending answer evaluation request to Gemini API for field: {}, subject: {}", request.field(), request.subject());
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                logger.error("Gemini API returned error code {}: {}", response.statusCode(), response.body());
                throw new RuntimeException("Gemini API request failed with status code " + response.statusCode());
            }

            // Parse response
            JsonNode rootNode = objectMapper.readTree(response.body());
            JsonNode candidates = rootNode.path("candidates");
            if (candidates.isMissingNode() || candidates.size() == 0) {
                throw new RuntimeException("Gemini API returned an empty response candidates list during evaluation");
            }

            String jsonText = candidates.get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();

            logger.debug("Received raw text from Gemini for evaluation: {}", jsonText);

            // Map inner JSON text to DTO
            return objectMapper.readValue(jsonText, EvaluationResponse.class);

        } catch (Exception e) {
            logger.error("Error communicating with Gemini API during evaluation: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to evaluate answers: " + e.getMessage(), e);
        }
    }

    /**
     * Calls Gemini API to simulate executing a block of code.
     */
    public CodeRunResponse runCode(CodeRunRequest request) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            logger.error("Gemini API key is missing. Please set the GEMINI_API_KEY environment variable.");
            throw new IllegalStateException("Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable.");
        }

        // Build prompt
        String prompt = String.format(
                "You are an expert compiler and runtime sandbox environment.\n\n" +
                "The user is working on the following coding problem:\n" +
                "\"%s\"\n\n" +
                "They submitted the following \"%s\" code to execute:\n" +
                "```\n%s\n```\n\n" +
                "Please act as the virtual execution environment for this code. Perform these actions:\n" +
                "1. Analyze the code for syntax, compile, or parsing errors. If any exist, set 'status' to 'compile_error' or 'runtime_error', describe it in 'errorMessage', and leave 'testCases' empty.\n" +
                "2. If the code parses and is logically sound, simulate running the code. Execute at least 3 distinct test cases representing normal values, edge values, or empty bounds. Capture standard console stdout outputs in 'consoleOutput'.\n" +
                "3. Determine if each test case passed (based on the expected result of the question) and populate the 'testCases' details.\n" +
                "4. Provide constructive feedback outlining code quality, time/space complexity, and code optimization suggestions in 'feedback'.\n\n" +
                "Return valid JSON only matching the schema.",
                request.question(), request.language(), request.code()
        );

        try {
            // Build Gemini Request Payload using structured JSON outputs configuration
            Map<String, Object> requestPayload = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(
                                    Map.of("text", prompt)
                              ))
                    ),
                    "generationConfig", Map.of(
                            "responseMimeType", "application/json",
                            "responseSchema", Map.of(
                                    "type", "OBJECT",
                                    "properties", Map.of(
                                            "status", Map.of("type", "STRING", "enum", List.of("success", "compile_error", "runtime_error")),
                                            "consoleOutput", Map.of("type", "STRING"),
                                            "errorMessage", Map.of("type", "STRING"),
                                            "feedback", Map.of("type", "STRING"),
                                            "testCases", Map.of(
                                                    "type", "ARRAY",
                                                    "items", Map.of(
                                                            "type", "OBJECT",
                                                            "properties", Map.of(
                                                                    "input", Map.of("type", "STRING"),
                                                                    "expected", Map.of("type", "STRING"),
                                                                    "actual", Map.of("type", "STRING"),
                                                                    "passed", Map.of("type", "BOOLEAN")
                                                            ),
                                                            "required", List.of("input", "expected", "actual", "passed")
                                                    )
                                            )
                                    ),
                                    "required", List.of("status", "consoleOutput", "errorMessage", "testCases", "feedback")
                            )
                    )
            );

            String requestBody = objectMapper.writeValueAsString(requestPayload);

            // Construct HTTP request with x-goog-api-key header
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(30))
                    .build();

            logger.info("Sending code execution request to Gemini API for language: {}", request.language());
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                logger.error("Gemini API returned error code {}: {}", response.statusCode(), response.body());
                throw new RuntimeException("Gemini API request failed with status code " + response.statusCode());
            }

            // Parse response
            JsonNode rootNode = objectMapper.readTree(response.body());
            JsonNode candidates = rootNode.path("candidates");
            if (candidates.isMissingNode() || candidates.size() == 0) {
                throw new RuntimeException("Gemini API returned an empty response candidates list during code run");
            }

            String jsonText = candidates.get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();

            logger.debug("Received raw text from Gemini for code run: {}", jsonText);

            // Map inner JSON text to DTO
            return objectMapper.readValue(jsonText, CodeRunResponse.class);

        } catch (Exception e) {
            logger.error("Error communicating with Gemini API during code execution: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to execute code: " + e.getMessage(), e);
        }
    }
}

