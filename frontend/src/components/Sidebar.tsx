import React from 'react';
import { useUser, useClerk, UserButton } from '@clerk/react';
import { Logo } from './Logo';
import { User } from '../types/auth';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  currentUser: User | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  currentUser,
}) => {
  const { user: clerkUser } = useUser();
  const clerk = useClerk();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'assessments', label: 'Assessments', icon: '📝' },
    { id: 'performance', label: 'Performance', icon: '📊' },
    { id: 'history', label: 'History', icon: '📜' },
  ];

  const emailName = clerkUser?.primaryEmailAddress?.emailAddress
    ? clerkUser.primaryEmailAddress.emailAddress.split('@')[0]
    : '';
  const displayName =
    clerkUser?.firstName ||
    (clerkUser?.fullName && clerkUser.fullName !== 'null' ? clerkUser.fullName : null) ||
    (currentUser?.name && currentUser.name !== 'Learner' ? currentUser.name : null) ||
    emailName ||
    'Learner';

  const handleProfileClick = () => {
    if (clerk && typeof clerk.openUserProfile === 'function') {
      clerk.openUserProfile();
    }
  };

  return (
    <aside className="sidebar">
      {/* Brand Logo */}
      <a
        href="/"
        className="sidebar-logo"
        onClick={(e) => {
          e.preventDefault();
          onNavigate('landing');
        }}
        style={{ cursor: 'pointer', padding: '0.5rem 0', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        title="Go to ADAPTS landing page"
      >
        <Logo size="medium" />
      </a>

      {/* Navigation Links */}
      <nav className="sidebar-nav" style={{ marginTop: '1.75rem' }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', paddingLeft: '0.8rem', marginBottom: '0.6rem', fontWeight: 700 }}>
          Navigation
        </div>
        {navItems.map((item) => (
          <a
            key={item.id}
            href={`/${item.id}`}
            className={`sidebar-link ${currentPage === item.id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(item.id);
            }}
            style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* AI Sandbox Engine Status Pill */}
      <div
        style={{
          margin: '1rem 0',
          padding: '0.75rem 0.9rem',
          borderRadius: '10px',
          background: 'rgba(56, 189, 248, 0.06)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          fontSize: '0.78rem',
          color: '#cbd5e1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.2rem' }}>
          <span className="status-dot-active" />
          <span>Docker Sandbox Engine</span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.3 }}>
          Deterministic score verification • Isolate mode ON
        </div>
      </div>

      {/* User Footer with Clerk User Profile Edit support */}
      <div className="sidebar-user" style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '0.4rem 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
            <UserButton showName={false} appearance={{ elements: { userButtonAvatarBox: { width: 34, height: 34 } } }} />
            <div
              onClick={handleProfileClick}
              style={{ overflow: 'hidden', cursor: 'pointer' }}
              title="Click to view & edit your profile"
            >
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {displayName}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>
                View & Edit Profile
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
