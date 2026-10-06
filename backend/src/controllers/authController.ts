import { Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class AuthController {
  /**
   * POST /api/auth/register
   */
  public static async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { email, password, name, role } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip;
      const userAgent = req.headers['user-agent'];

      console.log(`📝 New user trying to register — email: ${email}, name: ${name}, role: ${role}, from IP: ${ip}`);

      const result = await AuthService.register({ email, password, name, role }, ip, userAgent);

      console.log(`✅ Registration successful! Welcome ${name} (${email}) — assigned userId: ${result?.user?.id ?? 'unknown'})`);
      res.status(201).json(result);
    } catch (err: any) {
      console.error(`❌ Registration failed for ${req.body?.email} — reason: ${err.message}`);
      res.status(400).json({
        error: {
          code: 'REGISTRATION_FAILED',
          message: err.message || 'Registration failed.',
        },
      });
    }
  }

  /**
   * POST /api/auth/login
   */
  public static async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip;
      const userAgent = req.headers['user-agent'];

      console.log(`🔑 User trying to log in — email: ${email}, from IP: ${ip}`);

      const result = await AuthService.login({ email, password }, ip, userAgent);

      console.log(`✅ Login successful! User: ${email} (userId: ${result?.user?.id ?? 'unknown'})`);
      res.status(200).json(result);
    } catch (err: any) {
      console.error(`❌ Login failed for ${req.body?.email} — reason: ${err.message}`);
      res.status(401).json({
        error: {
          code: 'LOGIN_FAILED',
          message: err.message || 'Login failed.',
        },
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  public static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      console.warn(`⚠️ Someone tried to view their profile without being logged in`);
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated.',
        },
      });
      return;
    }

    console.log(`[AuthController.me] Fetching profile | userId=${req.user.userId} | email=${req.user.email}`);

    try {
      const user = await AuthService.getUserById(req.user.userId);
      if (!user) {
        console.warn(`⚠️ User profile not found in database for userId: ${req.user.userId}`);
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'User profile not found.',
          },
        });
        return;
      }

      console.log(`✅ Profile loaded successfully for: ${user.email}`);
      res.status(200).json({ user });
    } catch (err: any) {
      console.error(`❌ Could not load profile for userId: ${req.user.userId} — ${err.message}`);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Failed to fetch user profile.',
        },
      });
    }
  }

  /**
   * GET /api/auth/users
   * Returns list of all registered users with trace information.
   */
  public static async getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    console.log(`📋 Fetching list of all registered users (requested by userId: ${req.user?.userId ?? 'anonymous'})`);
    try {
      const users = await AuthService.getAllUsers();
      console.log(`✅ Found ${users.length} registered users`);
      res.status(200).json({ users });
    } catch (err: any) {
      console.error(`❌ Could not fetch user list — ${err.message}`);
      res.status(500).json({
        error: {
          code: 'FETCH_USERS_FAILED',
          message: err.message || 'Failed to fetch registered users.',
        },
      });
    }
  }

  /**
   * GET /api/auth/activity
   * Returns audit logs of user activities.
   */
  public static async getActivityLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
    console.log(`📜 Fetching activity logs ${userId ? `for userId: ${userId}` : 'for all users'}`);
    try {
      const logs = await AuthService.getActivityLogs(userId);
      console.log(`✅ Found ${logs.length} activity log entries`);
      res.status(200).json({ logs });
    } catch (err: any) {
      console.error(`❌ Could not fetch activity logs — ${err.message}`);
      res.status(500).json({
        error: {
          code: 'FETCH_ACTIVITY_FAILED',
          message: err.message || 'Failed to fetch activity logs.',
        },
      });
    }
  }
}
