import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopUserHeader } from '../components/TopUserHeader';
import { TracedUserSummary, UserActivityLog, User } from '../types/auth';
import { authService } from '../services/authService';

interface UserTracingPageProps {
  currentUser: User | null;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export const UserTracingPage: React.FC<UserTracingPageProps> = ({
  currentUser,
  onNavigate,
  onLogout,
}) => {
  const [users, setUsers] = useState<TracedUserSummary[]>([]);
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<TracedUserSummary | null>(null);
  const [selectedUserLogs, setSelectedUserLogs] = useState<UserActivityLog[]>([]);
  const [loadingUserLogs, setLoadingUserLogs] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [fetchedUsers, fetchedLogs] = await Promise.all([
        authService.getTracedUsers().catch(() => []),
        authService.getActivityLogs().catch(() => []),
      ]);
      setUsers(fetchedUsers || []);
      setActivityLogs(fetchedLogs || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load user tracing data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user: TracedUserSummary) => {
    setSelectedUser(user);
    setLoadingUserLogs(true);
    try {
      const logs = await authService.getActivityLogs(user.id);
      setSelectedUserLogs(logs || []);
    } catch {
      setSelectedUserLogs([]);
    } finally {
      setLoadingUserLogs(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const totalUsersCount = users.length;
  const studentCount = users.filter((u) => u.role === 'student').length;
  const instructorCount = users.filter((u) => u.role === 'instructor' || u.role === 'admin').length;
  const totalAttemptsCount = users.reduce((acc, u) => acc + (u.totalAttempts || 0), 0);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#070a12', color: '#ffffff' }}>
      <Sidebar
        currentPage="tracing"
        onNavigate={onNavigate}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <main style={{ flex: 1, padding: '2.5rem 3rem', maxWidth: '1320px', margin: '0 auto', position: 'relative' }}>
        <TopUserHeader
          currentUser={currentUser}
          onNavigate={onNavigate}
          title="👥 User Tracing & Execution Hub"
          subtitle="Monitor active sessions, assessment attempts, LLM validation pipelines, and audit records."
        />

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
            <div>Synchronizing user audit logs & active sessions...</div>
          </div>
        ) : errorMessage ? (
          <div style={{
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            color: '#fb7185',
            padding: '0.9rem 1.25rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.92rem',
          }}>
            ⚠️ {errorMessage}
          </div>
        ) : null}

        {/* Metric Cards Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}>
          <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Traced Users
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', marginTop: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>
              {totalUsersCount}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Active Students
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>
              {studentCount}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Instructors / Admins
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#c084fc', marginTop: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>
              {instructorCount}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Attempts Logged
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#34d399', marginTop: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>
              {totalAttemptsCount}
            </div>
          </div>
        </div>

        {/* Main Content Layout: Directory & Live Stream */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 0.7fr',
          gap: '2rem',
        }}>
          {/* User Directory Card */}
          <div className="glass-card" style={{ padding: '1.85rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              gap: '1rem',
            }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>
                Traced Users Directory ({filteredUsers.length})
              </h3>
              <input
                type="text"
                placeholder="Search user, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-field"
                style={{
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.85rem',
                  width: '210px',
                  backgroundColor: '#070a12',
                }}
              />
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>User</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Role</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>ELO</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Attempts</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Avg Score</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '0.85rem 0.5rem' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{u.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem' }}>
                        <span className={`pill-badge ${u.role === 'admin' ? 'pill-rose' : u.role === 'instructor' ? 'pill-purple' : 'pill-blue'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#fbbf24', fontWeight: 800 }}>
                        ⚡ {u.eloScore ?? 0}
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', color: '#cbd5e1', fontWeight: 600 }}>
                        {u.totalAttempts || 0}
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem' }}>
                        <span style={{
                          fontWeight: 700,
                          color: (u.averageScore || 0) >= 0.7 ? '#34d399' : '#fbbf24',
                        }}>
                          {Math.round((u.averageScore || 0) * 100)}%
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className="btn-ghost"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', color: '#38bdf8' }}
                        >
                          Audit →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Audit Stream */}
          <div className="glass-card" style={{ padding: '1.85rem', backgroundColor: '#0c101d', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>
              🛰️ Live System Audit Stream
            </h3>

            <div style={{ maxHeight: '520px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activityLogs.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '2rem 0' }}>
                  No system audit events logged yet.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '10px',
                      backgroundColor: '#070a12',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>
                        {log.userName || log.userEmail || `User #${log.userId}`}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span className="pill-badge pill-blue" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                        {log.action}
                      </span>
                      {log.ipAddress && (
                        <span style={{ color: '#64748b', fontSize: '0.76rem' }}>
                          from {log.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* User Specific Audit Modal */}
        {selectedUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}>
            <div className="glass-card" style={{
              backgroundColor: '#0c101d',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              maxWidth: '580px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem 0', color: '#ffffff', fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem' }}>{selectedUser.name}</h3>
                  <span style={{ fontSize: '0.85rem', color: '#38bdf8' }}>{selectedUser.email} (User #{selectedUser.id})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.35rem',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#070a12', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Account Role</span>
                  <div style={{ fontWeight: 700, color: '#ffffff', textTransform: 'capitalize', marginTop: '0.2rem' }}>{selectedUser.role}</div>
                </div>
                <div style={{ backgroundColor: '#070a12', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Assessments</span>
                  <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '0.2rem' }}>{selectedUser.totalAttempts || 0} completed</div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', color: '#ffffff', fontFamily: 'Outfit, sans-serif' }}>
                Audit Log Trail
              </h4>

              {loadingUserLogs ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>Loading user history...</div>
              ) : selectedUserLogs.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.88rem', padding: '0.5rem 0' }}>
                  No events recorded for this user yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {selectedUserLogs.map((lg) => (
                    <div key={lg.id} style={{
                      padding: '0.75rem 0.95rem',
                      borderRadius: '8px',
                      backgroundColor: '#070a12',
                      fontSize: '0.82rem',
                      borderLeft: '3px solid #38bdf8',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <strong style={{ color: '#ffffff' }}>{lg.action}</strong>
                        <span style={{ color: '#64748b', fontSize: '0.74rem' }}>
                          {new Date(lg.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
