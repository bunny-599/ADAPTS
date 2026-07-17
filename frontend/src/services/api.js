const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * Sends a request to the backend to generate assessment questions using AI.
 * @param {string} field - Selected study field (e.g. Engineering)
 * @param {string} subject - Selected subject (e.g. Java)
 * @param {string} topic - User's description of what they learned
 * @returns {Promise<{questions: string[]}>}
 */
export async function generateQuestions(field, subject, topic) {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field, subject, topic }),
    });

    if (!response.ok) {
      let errorMessage = 'An error occurred while generating questions.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Fallback if response is not JSON
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error in generateQuestions:', error);
    throw error;
  }
}

/**
 * Sends a request to evaluate the student's answers.
 * @param {string} field
 * @param {string} subject
 * @param {Array<{question: string, userAnswer: string}>} answers
 * @returns {Promise<{overallScore: number, evaluations: Array<{question: string, userAnswer: string, feedback: string, status: string}>}>}
 */
export async function evaluateAnswers(field, subject, answers) {
  try {
    const response = await fetch(`${API_BASE_URL}/evaluate-answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field, subject, answers }),
    });

    if (!response.ok) {
      let errorMessage = 'An error occurred while evaluating your answers.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Fallback if response is not JSON
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error in evaluateAnswers:', error);
    throw error;
  }
}

/**
 * Sends a request to compile and execute a block of code.
 * @param {string} question
 * @param {string} code
 * @param {string} language
 * @returns {Promise<{status: string, consoleOutput: string, errorMessage: string, testCases: Array<{input: string, expected: string, actual: string, passed: boolean}>, feedback: string}>}
 */
export async function runCode(question, code, language) {
  try {
    const response = await fetch(`${API_BASE_URL}/run-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, code, language }),
    });

    if (!response.ok) {
      let errorMessage = 'An error occurred while executing the code.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Fallback if response is not JSON
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error in runCode:', error);
    throw error;
  }
}


