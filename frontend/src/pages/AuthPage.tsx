import React, { useState, FormEvent } from 'react';
import { authService } from '../services/authService';
import { User } from '../types/auth';

interface AuthPageProps {
  initialTab?: 'login' | 'register';
  onNavigate: (page: string) => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialTab = 'register',
  onNavigate,
  onAuthSuccess,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (tab === 'login') {
        const res = await authService.login({ email, password });
        onAuthSuccess(res.user);
        onNavigate('dashboard');
      } else {
        const res = await authService.register({
          email,
          password,
          name: name || 'Learner',
          role,
        });
        onAuthSuccess(res.user);
        onNavigate('dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#090d16',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minWidth: '100vw',
    }}>
      {/* Left Artwork Column */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3rem',
        backgroundImage: 'url(/assets/auth_hero.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Overlay gradient for text readability */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(9, 13, 22, 0.4), rgba(9, 13, 22, 0.85))',
          zIndex: 1,
        }} />

        {/* Logo */}
        <div
          onClick={() => onNavigate('landing')}
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '1.4rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <span style={{
            background: 'linear-gradient(135deg, #00C6FF, #0072FF)',
            padding: '0.3rem 0.6rem',
            borderRadius: '8px',
            fontSize: '1rem',
          }}>⚡</span>
          <span>ADAPTS</span>
        </div>

        {/* Left Hero Text */}
        <div style={{ position: 'relative', zIndex: 2, marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '1rem', lineHeight: 1.2 }}>
            Your Learning,<br />Our Adaptation
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#cbd5e1', maxWidth: '420px', lineHeight: 1.5 }}>
            Personalized assessments. Smarter learning. Better you.
          </p>
        </div>
      </div>

      {/* Right Form Column */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2rem',
        backgroundColor: '#090d16',
      }}>
        <div style={{ maxWidth: '420px', width: '100%' }}>
          {/* Sign Up / Log In Tab Switcher */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginBottom: '2rem',
            background: '#111827',
            padding: '0.3rem',
            borderRadius: '10px',
            border: '1px solid #1f293d',
          }}>
            <button
              type="button"
              onClick={() => { setTab('register'); setErrorMessage(null); }}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: tab === 'register' ? '#2563eb' : 'transparent',
                color: tab === 'register' ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => { setTab('login'); setErrorMessage(null); }}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: tab === 'login' ? '#2563eb' : 'transparent',
                color: tab === 'login' ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Log In
            </button>
          </div>

          <h3 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem' }}>
            {tab === 'register' ? 'Create your account' : 'Welcome back'}
          </h3>
          <p style={{ fontSize: '0.92rem', color: '#94a3b8', marginBottom: '2rem' }}>
            {tab === 'register' ? 'Start your journey towards better learning.' : 'Sign in to access your dashboard and assessments.'}
          </p>

          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.88rem',
              marginBottom: '1.5rem',
            }}>
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {tab === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="form-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Bunny Lovelace"
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.4rem', fontWeight: 500 }}>
                Email Address
              </label>
              <input
                type="email"
                required
                className="form-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="bunny@example.com"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.4rem', fontWeight: 500 }}>
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                className="form-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {tab === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Role
                </label>
                <select
                  className="form-field"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                >
                  <option value="student">Student / Learner</option>
                  <option value="instructor">Instructor / Evaluator</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '1rem',
                justifyContent: 'center',
                marginTop: '0.5rem',
              }}
            >
              {loading ? 'Authenticating...' : (tab === 'register' ? 'Create Account →' : 'Log In →')}
            </button>
          </form>

          {/* Social Auth Options */}
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <div style={{ height: '1px', background: '#1e293d' }} />
              <span style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#090d16',
                padding: '0 0.75rem',
                fontSize: '0.8rem',
                color: '#64748b',
              }}>
                Or continue with
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ justifyContent: 'center', fontSize: '0.88rem' }}
                onClick={() => {
                  setName('Demo Student');
                  setEmail('student@example.com');
                  setPassword('password123');
                }}
              >
                🌐 Google
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ justifyContent: 'center', fontSize: '0.88rem' }}
                onClick={() => {
                  setName('Demo Student');
                  setEmail('student@example.com');
                  setPassword('password123');
                }}
              >
                🐙 GitHub
              </button>
            </div>
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.88rem', color: '#94a3b8' }}>
            {tab === 'register' ? (
              <>Already have an account? <span style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }} onClick={() => setTab('login')}>Log in</span></>
            ) : (
              <>Don't have an account? <span style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }} onClick={() => setTab('register')}>Sign up</span></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
