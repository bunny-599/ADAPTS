import React, { useState, useEffect } from 'react';
import { useUser, useClerk, UserButton } from '@clerk/react';
import { topicService } from '../services/topicService';
import { User } from '../types/auth';

interface TopUserHeaderProps {
  currentUser: User | null;
  onNavigate?: (page: string) => void;
  title?: string;
  subtitle?: string;
}

export const TopUserHeader: React.FC<TopUserHeaderProps> = ({
  currentUser,
  onNavigate,
  title,
  subtitle,
}) => {
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDrawer, setShowNotifDrawer] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const emailName = clerkUser?.primaryEmailAddress?.emailAddress
    ? clerkUser.primaryEmailAddress.emailAddress.split('@')[0]
    : '';
  const displayName =
    clerkUser?.firstName ||
    (clerkUser?.fullName && clerkUser.fullName !== 'null' ? clerkUser.fullName : null) ||
    (currentUser?.name && currentUser.name !== 'Learner' ? currentUser.name : null) ||
    emailName ||
    'Learner';

  const [liveElo, setLiveElo] = useState<number>(currentUser?.eloScore ?? 0);

  useEffect(() => {
    topicService.getUserPerformance()
      .then((perf) => {
        if (perf && typeof perf.eloScore === 'number') {
          setLiveElo(perf.eloScore);
        }
      })
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    async function fetchNotifs() {
      try {
        const res = await topicService.getNotifications().catch(() => null);
        if (res) {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unreadCount || 0);
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    }
    fetchNotifs();
  }, []);

  // Keyboard shortcut for Command Launcher (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowSearchModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleProfileClick = () => {
    if (clerk && typeof clerk.openUserProfile === 'function') {
      clerk.openUserProfile();
    }
  };

  const handleMarkAllRead = async () => {
    await topicService.markAllNotificationsRead().catch(() => null);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSearchNavigate = (page: string) => {
    setShowSearchModal(false);
    if (onNavigate) onNavigate(page);
  };

  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const emailAddress = clerkUser?.primaryEmailAddress?.emailAddress || currentUser?.email || '';

  const handleNotificationClick = async (notifId: number) => {
    await topicService.markNotificationRead(notifId).catch(() => null);
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleSignOut = async () => {
    if (clerk && clerk.signOut) {
      await clerk.signOut();
    }
    if (window.location) {
      window.location.href = '/';
    }
  };

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      width: '100%',
      paddingBottom: '1.25rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      {/* Page Title & Context Subtitle */}
      <div>
        {title && (
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#ffffff',
            margin: 0,
            fontFamily: 'Outfit, sans-serif',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}>
            {title}
          </h1>
        )}
        {subtitle && (
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.25rem', margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Clean User Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'relative' }}>
        {/* User Elo Rating Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.25))',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fbbf24',
            padding: '0.45rem 0.85rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 800,
            letterSpacing: '0.02em',
          }}
          title="Current ELO Rating"
        >
          <span>⚡</span>
          <span>{liveElo || currentUser?.eloScore || 0} ELO</span>
        </div>

        {/* Quick Action Command Launcher */}
        <button
          type="button"
          onClick={() => setShowSearchModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#111726',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#94a3b8',
            padding: '0.5rem 0.85rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Search or jump to pages (⌘K)"
        >
          <span>🔍 Quick Action</span>
          <span className="command-k-pill">⌘K</span>
        </button>

        {/* Notifications Bell (Section 30 & 86) */}
        <button
          type="button"
          onClick={() => {
            setShowNotifDrawer(!showNotifDrawer);
            setShowProfileMenu(false);
          }}
          style={{
            background: '#111726',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#cbd5e1',
            padding: '0.5rem 0.85rem',
            borderRadius: '10px',
            fontSize: '1.05rem',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.2s',
          }}
          title="Notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#f43f5e',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 800,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px rgba(244, 63, 94, 0.6)',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Popup Drawer */}
        {showNotifDrawer && (
          <div
            className="glass-card"
            style={{
              position: 'absolute',
              top: '55px',
              right: '150px',
              width: '320px',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '1.25rem',
              zIndex: 1000,
              backgroundColor: '#0c101d',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '12px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>Notifications</h4>
                {unreadCount > 0 && (
                  <span className="pill-badge pill-rose">{unreadCount} new</span>
                )}
              </div>
              {unreadCount > 0 && (
                <span
                  onClick={handleMarkAllRead}
                  style={{ fontSize: '0.78rem', color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }}
                >
                  Mark all read
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748b', fontSize: '0.85rem' }}>
                No notifications yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {notifications.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      backgroundColor: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(56, 189, 248, 0.08)',
                      borderLeft: n.read ? '3px solid transparent' : '3px solid #38bdf8',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>{n.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem', lineHeight: 1.4 }}>{n.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User Profile Pill & Dropdown (Section 31: Real Clerk session) */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifDrawer(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: '#111726',
              padding: '0.45rem 0.85rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Account Menu"
          >
            <UserButton showName={false} appearance={{ elements: { userButtonAvatarBox: { width: 28, height: 28 } } }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>{displayName}</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>▼</span>
          </div>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <div
              className="glass-card"
              style={{
                position: 'absolute',
                top: '50px',
                right: '0',
                width: '240px',
                backgroundColor: '#0c101d',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '10px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
                padding: '0.75rem',
                zIndex: 1000,
              }}
            >
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>{displayName}</div>
                {emailAddress && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emailAddress}
                  </div>
                )}
              </div>

              <div
                onClick={() => {
                  setShowProfileMenu(false);
                  handleProfileClick();
                }}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>👤</span>
                <span>Manage Profile</span>
              </div>

              <div
                onClick={() => {
                  setShowProfileMenu(false);
                  if (onNavigate) onNavigate('history');
                }}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>📜</span>
                <span>Assessment History</span>
              </div>

              <div
                onClick={handleSignOut}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: '#f87171',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  marginTop: '0.4rem',
                }}
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Command Launcher Modal (⌘K) */}
      {showSearchModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
          }}
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="glass-card"
            style={{
              width: '90%',
              maxWidth: '540px',
              backgroundColor: '#0c101d',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                🔍
              </span>
              <input
                type="text"
                className="form-field"
                placeholder="Search topics, assessments, or features..."
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.75rem', fontSize: '1rem', backgroundColor: '#070a12' }}
              />
            </div>

            <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.75rem' }}>
              Quick Navigation
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                onClick={() => handleSearchNavigate('dashboard')}
                style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#111726', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 600, color: '#ffffff' }}>🏠 Dashboard</span>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Jump to →</span>
              </div>
              <div
                onClick={() => handleSearchNavigate('assessments')}
                style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#111726', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 600, color: '#ffffff' }}>📝 Assessments Catalogue</span>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Jump to →</span>
              </div>
              <div
                onClick={() => handleSearchNavigate('performance')}
                style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#111726', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 600, color: '#ffffff' }}>📊 Performance Analytics</span>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Jump to →</span>
              </div>
              <div
                onClick={() => handleSearchNavigate('history')}
                style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: '#111726', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 600, color: '#ffffff' }}>📜 Assessment History</span>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Jump to →</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
