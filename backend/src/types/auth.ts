export interface User {
  id: number;
  email: string;
  password_hash?: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  elo_score?: number;
  created_at: string;
  updated_at: string;
}

export interface UserDTO {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  eloScore?: number;
  createdAt: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  role?: 'student' | 'instructor' | 'admin';
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserDTO;
  token: string;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: 'student' | 'instructor' | 'admin';
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

export interface TracedUserSummary extends UserDTO {
  lastLoginAt?: string;
  loginCount: number;
  lastIp?: string;
  userAgent?: string;
  totalAttempts: number;
  averageScore: number;
}

