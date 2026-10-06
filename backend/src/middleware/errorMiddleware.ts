import { Request, Response, NextFunction } from 'express';

/**
 * Standard structured HTTP request logging middleware.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logLine = `[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} - ${duration}ms (${ip})`;
    if (statusCode >= 500) {
      console.error(logLine);
    } else if (statusCode >= 400) {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }
  });

  next();
}

/**
 * Global Express error handling middleware.
 * Guarantees a consistent JSON error format and masks internal stack traces in production.
 */
export function globalErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected internal server error occurred.';

  console.error('[Unhandled Error]', {
    message: err.message,
    stack: err.stack,
    code: err.code,
  });

  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 && isProduction ? 'An unexpected server error occurred.' : message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
