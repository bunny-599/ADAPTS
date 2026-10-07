import { Router } from 'express';
import { TopicController } from '../controllers/topicController';
import { ResearchController } from '../controllers/researchController';
import { QuestionController } from '../controllers/questionController';
import { QuestionValidationController } from '../controllers/questionValidationController';
import { AssessmentController } from '../controllers/assessmentController';
import { AttemptController } from '../controllers/attemptController';
import { PerformanceController } from '../controllers/performanceController';
import { AdaptiveController } from '../controllers/adaptiveController';
import { ProgressController } from '../controllers/progressController';
import { EvaluationController } from '../controllers/evaluationController';
import { CodingController } from '../controllers/codingController';
import { AuthController } from '../controllers/authController';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken, optionalToken } from '../middleware/authMiddleware';
import {
  aiOperationLimiter,
  codeSandboxLimiter,
  authLimiter,
} from '../middleware/rateLimitMiddleware';

const router = Router();

// Authentication & User Tracing endpoints
router.post('/auth/register', authLimiter, AuthController.register);
router.post('/auth/login', authLimiter, AuthController.login);
router.get('/auth/me', optionalToken, AuthController.me);
router.get('/me', optionalToken, AuthController.me);
router.get('/auth/users', optionalToken, AuthController.getAllUsers);
router.get('/auth/activity', optionalToken, AuthController.getActivityLogs);

// Real User Notifications endpoints
router.get('/notifications', optionalToken, NotificationController.getNotifications);
router.patch('/notifications/:id/read', optionalToken, NotificationController.markRead);
router.put('/notifications/:id/read', optionalToken, NotificationController.markRead);
router.post('/notifications/read-all', optionalToken, NotificationController.markAllRead);
router.put('/notifications/read-all', optionalToken, NotificationController.markAllRead);

// Topic understanding endpoints
router.post('/topics/analyze', aiOperationLimiter, TopicController.analyze);
router.post('/topics', optionalToken, TopicController.createTopic);
router.get('/topics', TopicController.getTopics);
router.get('/topics/:topicId', TopicController.getTopicById);

// Web research & Quick Revision endpoints
router.post('/research', aiOperationLimiter, ResearchController.research);
router.get('/research/:researchRunId', ResearchController.getResearchRun);
router.post('/research/revision', aiOperationLimiter, ResearchController.getRevision);
router.get('/topics/:topicId/revision', ResearchController.getRevision);

// Question endpoints (internal / pipeline)
router.post('/questions/generate', aiOperationLimiter, QuestionController.generate);
router.post('/questions/validate', QuestionValidationController.validate);
router.get('/questions/:questionId', QuestionController.getQuestionById);

// Assessment endpoints
router.post('/assessments/optimize', aiOperationLimiter, AssessmentController.optimize);
router.post('/assessments/adaptive', aiOperationLimiter, AdaptiveController.generateAdaptive);
router.get('/assessments', optionalToken, AttemptController.getRecentAttempts);
router.get('/assessments/recent', optionalToken, AttemptController.getRecentAttempts);
router.get('/assessments/:assessmentId', AttemptController.getAssessment);
router.post('/assessments/:assessmentId/start', optionalToken, AttemptController.startAttempt);

// Attempt & response persistence endpoints
router.get('/attempts', optionalToken, AttemptController.getRecentAttempts);
router.get('/attempts/:attemptId', optionalToken, AttemptController.getAttempt);
router.get('/attempts/:attemptId/responses', optionalToken, AttemptController.getAttempt);
router.post('/attempts/:attemptId/responses', AttemptController.saveResponse);
router.patch('/attempts/:attemptId/responses', AttemptController.saveResponse);
router.put('/attempts/:attemptId/responses/:questionId', AttemptController.saveResponse);
router.post('/attempts/:attemptId/submit', optionalToken, AttemptController.submitAttempt);

// Answer evaluation endpoint
router.post('/attempts/:attemptId/evaluate', aiOperationLimiter, EvaluationController.evaluateAttempt);

// Coding evaluation endpoints
router.post('/attempts/:attemptId/code/submit', codeSandboxLimiter, CodingController.submitCode);
router.post('/attempts/:attemptId/code/run', codeSandboxLimiter, CodingController.runCode);

// Performance analysis & skill profiling endpoints
router.get('/performance', optionalToken, PerformanceController.getUserPerformance);
router.post('/attempts/:attemptId/analyze', optionalToken, PerformanceController.analyze);
router.get('/attempts/:attemptId/analysis', optionalToken, PerformanceController.getAnalysis);

// Learner progress & skill history endpoints
router.get('/skills', optionalToken, ProgressController.getUserSkills);
router.get('/topics/:topicId/progress', optionalToken, ProgressController.getProgress);
router.get('/topics/:topicId/history', optionalToken, ProgressController.getHistory);
router.get('/topics/:topicId/skills/:skill/history', optionalToken, ProgressController.getSkillHistory);

export default router;
