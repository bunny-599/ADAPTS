import { Topic, CreateTopicPayload, TopicAnalysisResult } from '../types/topic';
import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function createHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...authService.getAuthHeaders(),
    ...extra,
  };
}

export const topicService = {
  /**
   * Analyzes the user's raw topic input to extract structured domain, field, topic, and subtopics.
   */
  async analyzeTopic(input: string): Promise<TopicAnalysisResult> {
    const response = await fetch(`${API_BASE_URL}/api/topics/analyze`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to analyze topic (status ${response.status})`);
    }

    return response.json();
  },

  /**
   * Fetches all previously saved topics from the backend.
   */
  async getTopics(): Promise<Topic[]> {
    const response = await fetch(`${API_BASE_URL}/api/topics`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch topics (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Saves a newly entered topic (including structured metadata if confirmed) to the backend.
   */
  async createTopic(payload: CreateTopicPayload): Promise<Topic> {
    const response = await fetch(`${API_BASE_URL}/api/topics`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to save topic (status ${response.status})`);
    }

    return response.json();
  },

  /**
   * Researches a structured topic on the web and retrieves verified knowledge and sources.
   */
  async researchTopic(topicPayload: import('../types/research').ResearchTopicPayload): Promise<import('../types/research').ResearchResult> {
    const response = await fetch(`${API_BASE_URL}/api/research`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify({ topic: topicPayload }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to research topic (status ${response.status})`);
    }

    return response.json();
  },

  /**
   * Generates or retrieves 4–6 concise Quick Revision bullet points grounded in research knowledge.
   */
  async getQuickRevision(payload: {
    topicId?: number;
    topicTitle?: string;
    knowledgeItems?: import('../types/research').ResearchKnowledgeItem[];
  }): Promise<{ status: 'success'; revision: import('../types/revision').QuickRevisionResult }> {
    const response = await fetch(`${API_BASE_URL}/api/research/revision`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch Quick Revision (status ${response.status})`);
    }

    return response.json();
  },

  /**
   * Generates a candidate pool of assessment questions grounded in validated research knowledge.
   */
  async generateQuestions(payload: import('../types/question').GenerateQuestionsPayload): Promise<import('../types/question').GenerateQuestionsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/questions/generate`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to generate questions (status ${response.status})`);
    }

    return response.json();
  },

  /**
   * Validates a candidate question pool, filtering into Valid, Flagged, and Invalid pools with quality scores.
   */
  async validateQuestions(payload: import('../types/validation').ValidateQuestionPoolPayload): Promise<import('../types/validation').ValidateQuestionPoolResponse> {
    const response = await fetch(`${API_BASE_URL}/api/questions/validate`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to validate questions (status ${response.status})`);
    }

    return response.json();
  },

  /**
   * Optimizes an assessment from the valid question pool using a Genetic Algorithm (Trial 7).
   */
  async optimizeAssessment(payload: import('../types/assessment').OptimizeAssessmentRequest): Promise<import('../types/assessment').OptimizeAssessmentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/assessments/optimize`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to optimize assessment (status ${response.status})`);
    }

    return response.json();
  },

  /**
   * Fetches an assessment with public-safe questions (Trial 8).
   */
  async getAssessment(assessmentId: number): Promise<import('../types/attempt').GetAssessmentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/assessments/${assessmentId}`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch assessment (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Starts an assessment attempt (Trial 8).
   */
  async startAttempt(assessmentId: number): Promise<import('../types/attempt').StartAssessmentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/assessments/${assessmentId}/start`, {
      method: 'POST',
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to start assessment (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Submits student responses for an attempt (Trial 8).
   */
  async submitAttempt(
    attemptId: number,
    responses: import('../types/attempt').StudentQuestionResponse[]
  ): Promise<import('../types/attempt').SubmitAssessmentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify({ responses }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to submit assessment (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Analyzes student responses and evaluates skill profile for an attempt (Trial 9).
   */
  async analyzeAttempt(attemptId: number): Promise<import('../types/analysis').PerformanceAnalysisResult> {
    const response = await fetch(`${API_BASE_URL}/api/attempts/${attemptId}/analyze`, {
      method: 'POST',
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to analyze attempt (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Fetches performance analysis for an attempt (Trial 9).
   */
  async getAttemptAnalysis(attemptId: number): Promise<import('../types/analysis').PerformanceAnalysisResult> {
    const response = await fetch(`${API_BASE_URL}/api/attempts/${attemptId}/analysis`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch analysis (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Generates next adaptive assessment based on skill profile and previous performance (Trial 10).
   */
  async generateAdaptiveAssessment(
    topicId: number,
    questionCount = 10,
    previousAttemptId?: number
  ): Promise<import('../types/adaptive').AdaptiveAssessmentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/assessments/adaptive`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify({
        topicId,
        questionCount,
        previousAttemptId,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to generate adaptive assessment (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Fetches longitudinal learning progress summary for a topic (Trial 11).
   */
  async getTopicProgress(topicId: number): Promise<import('../types/progress').TopicProgressSummary> {
    const response = await fetch(`${API_BASE_URL}/api/topics/${topicId}/progress`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch topic progress (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Fetches chronological assessment performance history for a topic (Trial 11).
   */
  async getTopicHistory(topicId: number): Promise<import('../types/progress').AssessmentHistoryResponse> {
    const response = await fetch(`${API_BASE_URL}/api/topics/${topicId}/history`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch topic history (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Fetches longitudinal history for a specific skill (Trial 11).
   */
  async getSkillHistory(
    topicId: number,
    skill: string
  ): Promise<{ status: 'success'; topicId: number; skill: string; progress: import('../types/progress').SkillProgressSummary }> {
    const response = await fetch(`${API_BASE_URL}/api/topics/${topicId}/skills/${encodeURIComponent(skill)}/history`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch skill history (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Evaluates all submitted answers for an attempt (Trial 12).
   */
  async evaluateAttempt(
    attemptId: number,
    forceReevaluate?: boolean
  ): Promise<import('../types/evaluation').EvaluateAttemptResponse> {
    const response = await fetch(`${API_BASE_URL}/api/attempts/${attemptId}/evaluate`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify({ forceReevaluate: Boolean(forceReevaluate) }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to evaluate attempt (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Submits student code for a CODING question (Trial 13).
   */
  async submitCode(
    attemptId: number,
    payload: import('../types/coding').SubmitCodeRequest
  ): Promise<import('../types/coding').SubmitCodeResponse> {
    const response = await fetch(`${API_BASE_URL}/api/attempts/${attemptId}/code/submit`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to submit code (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Fetches recent assessment attempts for the authenticated user.
   */
  async getRecentAssessments(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/api/assessments/recent`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch recent assessments (status ${response.status})`);
    }
    const data = await response.json();
    return data.recent || data.assessments || [];
  },

  /**
   * Autosaves a student response for an individual question.
   */
  async saveResponse(attemptId: number, questionId: number | string, answer: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/attempts/${attemptId}/responses`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify({ questionId: Number(questionId), answer }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || 'Failed to save response');
    }
    return response.json();
  },

  /**
   * Fetches full performance analytics for the authenticated user.
   */
  async getUserPerformance(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/performance`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch performance analytics (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Fetches current skill profile and evidence for the authenticated user.
   */
  async getUserSkills(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/skills`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch user skills (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Fetches notifications for the authenticated user.
   */
  async getNotifications(): Promise<{ notifications: any[]; unreadCount: number }> {
    const response = await fetch(`${API_BASE_URL}/api/notifications`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch notifications (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Marks a single notification as read.
   */
  async markNotificationRead(id: number): Promise<void> {
    await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: createHeaders(),
    });
  },

  /**
   * Marks all notifications for the user as read.
   */
  async markAllNotificationsRead(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: 'POST',
      headers: createHeaders(),
    });
  },

  /**
   * Fetches active attempt state including server-synchronized remaining seconds.
   */
  async getAttempt(attemptId: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/attempts/${attemptId}`, {
      headers: createHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to fetch attempt (status ${response.status})`);
    }
    return response.json();
  },

  /**
   * Runs student code against visible (sample) test cases only (Trial 13).
   */
  async runCode(
    attemptId: number,
    payload: import('../types/coding').RunCodeRequest
  ): Promise<import('../types/coding').RunCodeResponse> {
    const response = await fetch(`${API_BASE_URL}/api/attempts/${attemptId}/code/run`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.message || `Failed to run code (status ${response.status})`);
    }
    return response.json();
  },
};



