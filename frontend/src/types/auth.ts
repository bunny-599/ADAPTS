export interface User {
  id: number;
  email: string;
  name: string;
  username?: string;
  role: 'student' | 'instructor' | 'admin';
  eloScore?: number;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role?: 'student' | 'instructor' | 'admin';
}

export interface UserActivityLog {
  id: number;
  userId: number;
  userEmail?: string;
  userName?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface TracedUserSummary extends User {
  lastLoginAt?: string;
  loginCount: number;
  lastIp?: string;
  userAgent?: string;
  totalAttempts: number;
  averageScore: number;
}
