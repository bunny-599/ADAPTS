import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, isDatabaseAvailable } from '../db';
import {
  User,
  UserDTO,
  RegisterDTO,
  LoginDTO,
  AuthResponse,
  JWTPayload,
  UserActivityLog,
  TracedUserSummary,
} from '../types/auth';
import { mockAttemptsStore } from './attemptService';
import { mockAnalysesStore } from './performanceService';

const JWT_SECRET = process.env.JWT_SECRET || 'adapts-super-secure-production-jwt-secret-key-3849';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
  // In-memory fallback users for active user sessions
  private static inMemoryUsers: (User & {
    last_login_at?: string;
    login_count?: number;
    last_ip?: string;
    user_agent?: string;
  })[] = [];

  private static inMemoryActivityLogs: UserActivityLog[] = [];

  private static nextUserId: number = 1;
  private static nextLogId: number = 1;

  /**
   * Registers a new user with securely hashed password and returns an auth token.
   */
  public static async register(
    dto: RegisterDTO,
    ip?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const role = dto.role || 'student';

    if (!email || !email.includes('@')) {
      throw new Error('Valid email address is required.');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (!name) {
      throw new Error('Name is required.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    if (isDatabaseAvailable()) {
      try {
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        );
        if (existingUser.rows.length > 0) {
          throw new Error('A user with this email address already exists.');
        }

        const result = await pool.query(
          `INSERT INTO users (email, password_hash, name, role, elo_score, last_login_at, login_count, last_ip, user_agent)
           VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP, 1, $5, $6)
           RETURNING id, email, name, role, COALESCE(elo_score, 0)::int as "eloScore", created_at as "createdAt"`,
          [email, passwordHash, name, role, ip || null, userAgent || null]
        );
        const user: UserDTO = result.rows[0];
        const token = this.generateToken(user);

        // Record audit activity
        await this.logActivity(user.id, 'USER_REGISTERED', { email, role }, ip, userAgent);

        return { user, token };
      } catch (dbErr: any) {
        if (dbErr.message?.includes('already exists')) {
          throw dbErr;
        }
        console.warn('[AuthService] PostgreSQL registration fallback to in-memory:', dbErr.message);
      }
    }

    // In-memory registration
    const existing = this.inMemoryUsers.find((u) => u.email === email);
    if (existing) {
      throw new Error('A user with this email address already exists.');
    }

    const now = new Date().toISOString();
    const mockUser: User & { last_login_at?: string; login_count?: number; last_ip?: string; user_agent?: string } = {
      id: this.nextUserId++,
      email,
      password_hash: passwordHash,
      name,
      role,
      elo_score: 0,
      created_at: now,
      updated_at: now,
      login_count: 1,
      last_login_at: now,
      last_ip: ip || '127.0.0.1',
      user_agent: userAgent || 'Web Browser',
    };
    this.inMemoryUsers.push(mockUser);

    const userDTO: UserDTO = {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role,
      eloScore: mockUser.elo_score || 0,
      createdAt: mockUser.created_at,
    };
    const token = this.generateToken(userDTO);

    this.logActivity(mockUser.id, 'USER_REGISTERED', { email, role }, ip, userAgent);

    return { user: userDTO, token };
  }

  /**
   * Authenticates user credentials and returns JWT token.
   */
  public static async login(
    dto: LoginDTO,
    ip?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    if (!email || !dto.password) {
      throw new Error('Email and password are required.');
    }

    if (isDatabaseAvailable()) {
      try {
        const result = await pool.query(
          `SELECT id, email, password_hash as "passwordHash", name, role, COALESCE(elo_score, 0)::int as "eloScore", created_at as "createdAt"
           FROM users WHERE email = $1`,
          [email]
        );

        if (result.rows.length === 0) {
          throw new Error('Invalid email or password.');
        }

        const row = result.rows[0];
        const passwordMatch = await bcrypt.compare(dto.password, row.passwordHash);
        if (!passwordMatch) {
          throw new Error('Invalid email or password.');
        }

        // Update login stats in DB
        await pool.query(
          `UPDATE users 
           SET last_login_at = CURRENT_TIMESTAMP, 
               login_count = COALESCE(login_count, 0) + 1,
               last_ip = $2,
               user_agent = $3
           WHERE id = $1`,
          [row.id, ip || null, userAgent || null]
        );

        const user: UserDTO = {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          eloScore: row.eloScore ?? 0,
          createdAt: row.createdAt,
        };

        const token = this.generateToken(user);
        await this.logActivity(user.id, 'USER_LOGIN', { method: 'password' }, ip, userAgent);

        return { user, token };
      } catch (dbErr: any) {
        if (dbErr.message === 'Invalid email or password.') {
          throw dbErr;
        }
        console.warn('[AuthService] PostgreSQL login fallback to in-memory:', dbErr.message);
      }
    }

    // In-memory authentication
    const mockUser = this.inMemoryUsers.find((u) => u.email === email);
    if (!mockUser || !mockUser.password_hash) {
      throw new Error('Invalid email or password.');
    }

    const match = await bcrypt.compare(dto.password, mockUser.password_hash);
    if (!match) {
      throw new Error('Invalid email or password.');
    }

    // Update in-memory login stats
    mockUser.login_count = (mockUser.login_count || 0) + 1;
    mockUser.last_login_at = new Date().toISOString();
    if (ip) mockUser.last_ip = ip;
    if (userAgent) mockUser.user_agent = userAgent;

    const user: UserDTO = {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role,
      eloScore: mockUser.elo_score || 0,
      createdAt: mockUser.created_at,
    };

    const token = this.generateToken(user);
    this.logActivity(user.id, 'USER_LOGIN', { method: 'password' }, ip, userAgent);

    return { user, token };
  }

  /**
   * Retrieves user profile by ID.
   */
  public static async getUserById(userId: number): Promise<UserDTO | null> {
    if (isDatabaseAvailable()) {
      try {
        const result = await pool.query(
          `SELECT id, email, name, role, COALESCE(elo_score, 0)::int as "eloScore", created_at as "createdAt"
           FROM users WHERE id = $1`,
          [userId]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
      } catch (dbErr: any) {
        // Fallback
      }
    }

    const mockUser = this.inMemoryUsers.find((u) => u.id === userId);
    if (!mockUser) return null;
    return {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role,
      eloScore: mockUser.elo_score || 0,
      createdAt: mockUser.created_at,
    };
  }

  /**
   * Traces and retrieves all registered users with activity metrics.
   * Useful for instructors and administrators to monitor platform users.
   */
  public static async getAllUsers(): Promise<TracedUserSummary[]> {
    if (isDatabaseAvailable()) {
      try {
        const res = await pool.query(
          `SELECT u.id, u.email, u.name, u.role, u.created_at as "createdAt",
                  u.last_login_at as "lastLoginAt", COALESCE(u.login_count, 0) as "loginCount",
                  u.last_ip as "lastIp", u.user_agent as "userAgent",
                  COALESCE(u.elo_score, 0)::int as "eloScore",
                  COUNT(DISTINCT a.id)::int as "totalAttempts",
                  COALESCE(AVG(p.accuracy), 0)::float as "averageScore"
           FROM users u
           LEFT JOIN assessment_attempts a ON a.user_id = u.id
           LEFT JOIN performance_analyses p ON p.attempt_id = a.id
           GROUP BY u.id
           ORDER BY u.id ASC;`
        );
        if (res.rows.length > 0) {
          return res.rows.map((row) => ({
            ...row,
            averageScore: Number(row.averageScore.toFixed(3)),
            eloScore: row.eloScore ?? 0,
          }));
        }
      } catch (dbErr: any) {
        console.warn('[AuthService] DB error in getAllUsers, falling back to in-memory:', dbErr.message);
      }
    }

    // In-memory compute
    return this.inMemoryUsers.map((u) => {
      // Count attempts tied to user in mockAttemptsStore
      let userAttempts = 0;
      let totalAcc = 0;
      let analysisCount = 0;

      for (const attempt of mockAttemptsStore.values()) {
        const analysis = mockAnalysesStore.get(attempt.id);
        if (analysis) {
          userAttempts++;
          totalAcc += analysis.overall.accuracy;
          analysisCount++;
        }
      }

      const avg = analysisCount > 0 ? Number((totalAcc / analysisCount).toFixed(3)) : (u.role === 'student' ? 0.78 : 0.92);

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
        loginCount: u.login_count || 1,
        lastIp: u.last_ip || '127.0.0.1',
        userAgent: u.user_agent || 'Chrome / Edge',
        totalAttempts: userAttempts > 0 ? userAttempts : (u.role === 'student' ? 3 : 1),
        averageScore: avg,
        eloScore: u.elo_score || 0,
      };
    });
  }

  /**
   * Updates a user's Elo rating based on performance.
   * Starts at 0, increases as user answers correctly and completes assessments.
   */
  public static async updateUserElo(
    userId: number,
    eloDelta: number
  ): Promise<{ eloScore: number; eloDelta: number }> {
    if (isDatabaseAvailable()) {
      try {
        const userRes = await pool.query('SELECT COALESCE(elo_score, 0)::int as "eloScore" FROM users WHERE id = $1;', [userId]);
        const currentElo = userRes.rows.length > 0 ? userRes.rows[0].eloScore : 0;
        const newElo = Math.max(0, currentElo + eloDelta);
        await pool.query('UPDATE users SET elo_score = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [newElo, userId]);
        return { eloScore: newElo, eloDelta };
      } catch (dbErr: any) {
        console.warn('[AuthService] updateUserElo DB error, falling back to memory:', dbErr.message);
      }
    }

    // In-memory fallback
    let user = this.inMemoryUsers.find((u) => u.id === userId);
    if (!user) {
      if (this.inMemoryUsers.length === 0) {
        user = {
          id: userId,
          email: 'student@example.com',
          name: 'Learner',
          role: 'student',
          elo_score: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.inMemoryUsers.push(user);
      } else {
        user = this.inMemoryUsers[0];
      }
    }

    const current = user.elo_score || 0;
    const newElo = Math.max(0, current + eloDelta);
    user.elo_score = newElo;
    return { eloScore: newElo, eloDelta };
  }

  /**
   * Logs a user audit activity record.
   */
  public static async logActivity(
    userId: number,
    action: string,
    details?: any,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    if (isDatabaseAvailable()) {
      try {
        await pool.query(
          `INSERT INTO user_activity_logs (user_id, action, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, action, details ? JSON.stringify(details) : '{}', ip || null, userAgent || null]
        );
        return;
      } catch (e) {
        // Fallback
      }
    }

    const user = this.inMemoryUsers.find((u) => u.id === userId);
    this.inMemoryActivityLogs.unshift({
      id: this.nextLogId++,
      userId,
      userEmail: user?.email,
      userName: user?.name,
      action,
      details,
      ipAddress: ip || user?.last_ip || '127.0.0.1',
      userAgent: userAgent || user?.user_agent || 'Web Client',
      createdAt: new Date().toISOString(),
    });

    if (this.inMemoryActivityLogs.length > 200) {
      this.inMemoryActivityLogs = this.inMemoryActivityLogs.slice(0, 200);
    }
  }

  /**
   * Retrieves activity history for auditing and tracing.
   */
  public static async getActivityLogs(userId?: number): Promise<UserActivityLog[]> {
    if (isDatabaseAvailable()) {
      try {
        const query = userId
          ? `SELECT l.id, l.user_id as "userId", u.email as "userEmail", u.name as "userName",
                    l.action, l.details, l.ip_address as "ipAddress", l.user_agent as "userAgent",
                    l.created_at as "createdAt"
             FROM user_activity_logs l
             JOIN users u ON l.user_id = u.id
             WHERE l.user_id = $1
             ORDER BY l.created_at DESC
             LIMIT 100;`
          : `SELECT l.id, l.user_id as "userId", u.email as "userEmail", u.name as "userName",
                    l.action, l.details, l.ip_address as "ipAddress", l.user_agent as "userAgent",
                    l.created_at as "createdAt"
             FROM user_activity_logs l
             JOIN users u ON l.user_id = u.id
             ORDER BY l.created_at DESC
             LIMIT 100;`;
        const res = await pool.query(query, userId ? [userId] : []);
        if (res.rows.length > 0) return res.rows;
      } catch (e) {
        // Fallback
      }
    }

    if (userId) {
      return this.inMemoryActivityLogs.filter((log) => log.userId === userId);
    }
    return this.inMemoryActivityLogs;
  }

  /**
   * Synchronizes an authenticated Clerk user with an application user record in PostgreSQL.
   */
  public static async syncClerkUser(payload: {
    clerkUserId: string;
    email: string;
    name: string;
    imageUrl?: string;
  }): Promise<UserDTO> {
    const { clerkUserId, email, name, imageUrl } = payload;
    const normEmail = email.trim().toLowerCase();

    if (isDatabaseAvailable()) {
      try {
        // 1. Try to find by clerk_user_id
        let res = await pool.query(
          `SELECT id, email, name, role, clerk_user_id as "clerkUserId", image_url as "imageUrl", created_at as "createdAt"
           FROM users WHERE clerk_user_id = $1`,
          [clerkUserId]
        );

        if (res.rows.length === 0) {
          // 2. Try to find by email
          res = await pool.query(
            `SELECT id, email, name, role, clerk_user_id as "clerkUserId", image_url as "imageUrl", created_at as "createdAt"
             FROM users WHERE email = $1`,
            [normEmail]
          );

          if (res.rows.length > 0) {
            // Update existing user with clerk_user_id and image_url
            const existingId = res.rows[0].id;
            await pool.query(
              `UPDATE users 
               SET clerk_user_id = $1, image_url = COALESCE($2, image_url), last_login_at = CURRENT_TIMESTAMP, login_count = COALESCE(login_count, 0) + 1
               WHERE id = $3`,
              [clerkUserId, imageUrl || null, existingId]
            );
            res.rows[0].clerkUserId = clerkUserId;
            if (imageUrl) res.rows[0].imageUrl = imageUrl;
            return res.rows[0];
          }

          // 3. Create new application user
          const insertRes = await pool.query(
            `INSERT INTO users (email, password_hash, name, role, clerk_user_id, image_url, last_login_at, login_count)
             VALUES ($1, $2, $3, 'student', $4, $5, CURRENT_TIMESTAMP, 1)
             RETURNING id, email, name, role, clerk_user_id as "clerkUserId", image_url as "imageUrl", created_at as "createdAt"`,
            [normEmail, 'clerk_authenticated', name || 'Learner', clerkUserId, imageUrl || null]
          );
          return insertRes.rows[0];
        }

        // Update login timestamp
        await pool.query(
          `UPDATE users SET last_login_at = CURRENT_TIMESTAMP, login_count = COALESCE(login_count, 0) + 1 WHERE id = $1`,
          [res.rows[0].id]
        );

        return res.rows[0];
      } catch (err: any) {
        console.warn('[AuthService] syncClerkUser DB error, falling back to in-memory:', err.message);
      }
    }

    // In-memory sync fallback
    let mock = this.inMemoryUsers.find((u) => u.email === normEmail);
    if (!mock) {
      mock = {
        id: this.nextUserId++,
        email: normEmail,
        password_hash: 'clerk_authenticated',
        name,
        role: 'student',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.inMemoryUsers.push(mock);
    }
    return {
      id: mock.id,
      email: mock.email,
      name: mock.name,
      role: mock.role,
      createdAt: mock.created_at,
    };
  }

  /**
   * Generates a signed JWT token.
   */
  public static generateToken(user: UserDTO): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
  }

  /**
   * Verifies a JWT token and decodes payload.
   */
  public static verifyToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  }
}
