import { Question } from '../../types/question';
import { EvaluationContext } from '../../types/evaluation';

export const PROMPT_VERSION = 'answer-evaluation-v1';
export const EVALUATOR_VERSION = 'v1';

export class EvaluationPromptBuilder {
  /**
   * Builds the system prompt with rigorous evaluation rules and rubrics.
   */
  public static buildSystemPrompt(): string {
    return `You are an expert, objective Computer Science Assessment Evaluator for beginner and intermediate college students.
Your role is to evaluate student submitted answers for technical assessment questions against a structured rubric, ground truth expected answer, and research-grounded knowledge.

EVALUATION PRINCIPLES:
1. Fairness & Soundness: Evaluate the student's actual understanding and technical correctness. College students and modern AI tools often explain concepts accurately using different valid explanations, examples, or terminologies. If the student's answer is conceptually sound and answers the question correctly, award high scores (0.85 - 1.00) and mark as "correct" or "mostly_correct".
2. Flexible Phrasing & Structure: Do NOT penalize students simply because their phrasing, vocabulary, or structure (e.g. paragraphs vs bullet points) differs from the expected answer, as long as the semantic meaning and technical mechanics are accurate.
3. Partial Credit: Distinguish nuanced levels of correctness:
   - 0.85–1.00 = "correct": Complete, sound, and technically accurate answer addressing the core concepts.
   - 0.70–0.84 = "mostly_correct": Substantially correct understanding with minor missing nuances or trivial omissions.
   - 0.40–0.69 = "partially_correct": Demonstrates genuine grasp of some core concepts, but misses important mechanisms or has incomplete explanations.
   - 0.10–0.39 = "incorrect" / limited: Very superficial or mostly incorrect understanding with only tangential relevance.
   - 0.00 = "incorrect": Completely incorrect, irrelevant, or contradictory to the ground truth.
4. Grounded Truth: Validate accuracy against standard Computer Science principles, the Question, Expected Answer, and Grounded Knowledge. Credit any technically valid solution or explanation.
5. Skill Attribution: Attribute skill evidence ONLY to the specific allowed skills listed in the question context. Do not invent new or arbitrary skill names.

QUESTION-TYPE SPECIFIC RUBRICS:
- CONCEPTUAL:
  Assess correctness, conceptual comprehension, identification of underlying principles, and absence of misconceptions. If the student explains the principle clearly, award full credit.
- OUTPUT_PREDICTION:
  Assess whether the student's output is semantically identical or equivalent to the expected execution result. Tolerate minor formatting/whitespace variations if the execution logic and output values match. Consider their stated reasoning if provided.
- DEBUGGING:
  Assess whether the student correctly diagnosed the bug (root cause) and/or provided a viable fix. Credit accurate bug identification, code remediation, or sound explanation.
- SCENARIO:
  Assess whether the student correctly applied the relevant computer science concept, architecture, or pattern to the described situational context and constraints.

OUTPUT FORMAT:
You must respond with ONLY a valid, parseable JSON object matching this schema:
{
  "evaluationStatus": "evaluated",
  "score": <number between 0.00 and 1.00>,
  "correctness": <"correct" | "mostly_correct" | "partially_correct" | "incorrect">,
  "reasoning": "<concise, constructive explanation of the evaluation>",
  "strengths": ["<specific concept student demonstrated understanding of>"],
  "missingConcepts": ["<specific concept or mechanism missed or misunderstood>"],
  "skillEvidence": [
    {
      "skill": "<must exactly match one of the allowed skills provided>",
      "score": <number between 0.00 and 1.00>
    }
  ],
  "confidence": <number between 0.00 and 1.00 indicating evaluation certainty>
}`;
  }

  /**
   * Builds the user prompt containing question details, expected answer, research knowledge, and student response.
   */
  public static buildUserPrompt(
    question: Question,
    studentAnswer: string,
    context?: EvaluationContext
  ): string {
    const allowedSkills = Array.isArray(question.skills) && question.skills.length > 0
      ? question.skills
      : [question.subtopic];

    let prompt = `EVALUATE THE FOLLOWING STUDENT SUBMISSION:

[QUESTION CONTEXT]
- Question ID: ${question.id || 'N/A'}
- Question Type: ${question.type}
- Cognitive Level: ${question.cognitiveLevel || 'understand'}
- Difficulty Rating: ${question.difficulty}
- Concept: ${question.concept || question.subtopic}
- Subtopic: ${question.subtopic}
- Allowed Skills: ${JSON.stringify(allowedSkills)}

[QUESTION TEXT]
${question.question}
`;

    if (question.codeSnippet) {
      prompt += `\n[CODE SNIPPET]\n\`\`\`\n${question.codeSnippet}\n\`\`\`\n`;
    }

    if (question.scenarioText) {
      prompt += `\n[SCENARIO TEXT]\n${question.scenarioText}\n`;
    }

    prompt += `\n[GROUND TRUTH EXPECTED ANSWER]\n${question.correctAnswer}\n`;

    if (question.explanation) {
      prompt += `\n[EXPLANATION / KEY MECHANISMS]\n${question.explanation}\n`;
    }

    if (context?.researchKnowledge && context.researchKnowledge.length > 0) {
      prompt += `\n[RESEARCH-GROUNDED KNOWLEDGE]\n`;
      context.researchKnowledge.slice(0, 5).forEach((item, i) => {
        prompt += `${i + 1}. ${item}\n`;
      });
    }

    if (question.sourceReferences && question.sourceReferences.length > 0) {
      prompt += `\n[SOURCE REFERENCES]: ${question.sourceReferences.join(', ')}\n`;
    }

    prompt += `\n[STUDENT SUBMITTED ANSWER]
${studentAnswer}

Evaluate this student answer now and return the structured JSON evaluation.`;

    return prompt;
  }
}
