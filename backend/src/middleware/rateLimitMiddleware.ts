import rateLimit from 'express-rate-limit';

/**
 * Standard global limiter applied across all REST API routes.
 * 300 requests per 15 minutes per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP address. Please try again later.',
    },
  },
});

/**
 * Strict limiter for expensive LLM operations (Question generation, topic analysis, free-text evaluation).
 * 30 requests per 5 minutes per IP.
 */
export const aiOperationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'You have reached the maximum rate limit for AI operations. Please wait a few minutes before trying again.',
    },
  },
});

/**
 * Strict limiter for Sandboxed C++ Code Compilation and Execution.
 * 25 executions per 2 minutes per IP.
 */
export const codeSandboxLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'SANDBOX_RATE_LIMIT_EXCEEDED',
      message: 'Code execution limit reached. Please wait a moment before running code again.',
    },
  },
});

/**
 * Strict limiter for Auth routes to prevent brute-force attacks.
 * 20 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
});
