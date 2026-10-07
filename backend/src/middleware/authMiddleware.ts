import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/authService';
import { JWTPayload } from '../types/auth';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload & { clerkUserId?: string };
}

/**
 * Middleware that strictly enforces authentication (JWT or Clerk session token).
 * Automatically resolves and synchronizes the application user record in PostgreSQL.
 * Returns 401 Unauthorized if token is missing or invalid.
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required to access this resource.',
      },
    });
    return;
  }

  try {
    // 1. Try standard ADAPTS JWT verification
    const payload = AuthService.verifyToken(token);
    req.user = payload;
    next();
    return;
  } catch {
    // 2. Try decoding as a Clerk JWT token
    try {
      const decoded: any = jwt.decode(token);
      if (decoded && (decoded.sub || decoded.clerk_id)) {
        const clerkUserId = decoded.sub || decoded.clerk_id;
        const email = decoded.email || decoded.primary_email || `${clerkUserId}@clerk.user`;
        const emailPrefix = email.includes('@') ? email.split('@')[0] : 'Learner';
        const name = decoded.name || decoded.first_name || emailPrefix;
        const imageUrl = decoded.picture || decoded.image_url;

        // Sync with PostgreSQL users table
        const appUser = await AuthService.syncClerkUser({
          clerkUserId,
          email,
          name,
          imageUrl,
        });

        req.user = {
          userId: appUser.id,
          email: appUser.email,
          role: appUser.role,
          clerkUserId,
        };
        next();
        return;
      }
    } catch {
      // Ignored
    }

    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token.',
      },
    });
  }
}

/**
 * Middleware that parses JWT if present, but does not block requests if absent.
 * Allows guest exploration while automatically scoping resources to user if logged in.
 */
export async function optionalToken(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (token) {
    try {
      const payload = AuthService.verifyToken(token);
      req.user = payload;
    } catch {
      try {
        const decoded: any = jwt.decode(token);
        if (decoded && (decoded.sub || decoded.clerk_id)) {
          const clerkUserId = decoded.sub || decoded.clerk_id;
          const email = decoded.email || decoded.primary_email || `${clerkUserId}@clerk.user`;
          const emailPrefix = email.includes('@') ? email.split('@')[0] : 'Learner';
          const name = decoded.name || decoded.first_name || emailPrefix;
          const imageUrl = decoded.picture || decoded.image_url;

          const appUser = await AuthService.syncClerkUser({
            clerkUserId,
            email,
            name,
            imageUrl,
          });

          req.user = {
            userId: appUser.id,
            email: appUser.email,
            role: appUser.role,
            clerkUserId,
          };
        }
      } catch {
        // Ignored for optional tokens
      }
    }
  }
  next();
}

/**
 * Middleware to restrict access to specific roles (e.g. 'instructor', 'admin').
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have sufficient permissions to perform this action.',
        },
      });
      return;
    }
    next();
  };
}
