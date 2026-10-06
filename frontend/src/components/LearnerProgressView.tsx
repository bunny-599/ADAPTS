import React, { useState, useEffect } from 'react';
import {
  TopicProgressSummary,
  ChronologicalAssessmentHistoryItem,
  SkillProgressSummary,
} from '../types/progress';
import { topicService } from '../services/topicService';

interface LearnerProgressViewProps {
  topicId: number;
  onExit?: () => void;
  onStartAdaptive?: () => void;
}

export const LearnerProgressView: React.FC<LearnerProgressViewProps> = ({
  topicId,
  onExit,
  onStartAdaptive,
}) => {
  const [progress, setProgress] = useState<TopicProgressSummary | null>(null);
  const [history, setHistory] = useState<ChronologicalAssessmentHistoryItem[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const [progressRes, historyRes] = await Promise.all([
          topicService.getTopicProgress(topicId),
          topicService.getTopicHistory(topicId),
        ]);

        if (isMounted) {
          setProgress(progressRes);
          setHistory(historyRes.history || []);
          if (progressRes.skills && progressRes.skills.length > 0) {
            setSelectedSkill(progressRes.skills[0].skill);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load progress data:', err);
          setErrorMessage(err.message || 'Failed to load progress data.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [topicId]);

  if (loading) {
    return (
      <div className="results-container">
        <div className="taking-loading">
          <div className="spinner" />
          <p>Analyzing longitudinal learning progress and trends...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !progress) {
    return (
      <div className="results-container">
        <div className="taking-error-card">
          <h3>⚠️ Unable to Load Learning Progress</h3>
          <p>{errorMessage || 'No progress records available for this topic.'}</p>
          {onExit && (
            <button type="button" className="submit-btn" onClick={onExit} style={{ marginTop: '1rem' }}>
              Return to Topic
            </button>
          )}
        </div>
      </div>
    );
  }

  const { assessments, skills } = progress;
  const hasHistory = assessments.total > 0;
  const hasMultiHistory = assessments.total >= 2;

  // Render pure SVG Line Chart for history
  const renderHistoryChart = () => {
    if (!hasHistory) {
      return (
        <div className="chart-empty-state">
          <p>No assessment history available.</p>
        </div>
      );
    }

    if (!hasMultiHistory) {
      return (
        <div className="chart-empty-state">
          <p>Not enough history to determine a trend. Complete at least 2 assessments to visualize your performance curve.</p>
        </div>
      );
    }

    const width = 640;
    const height = 220;
    const padding = { top: 25, right: 30, bottom: 40, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const n = history.length;
    const xStep = chartW / Math.max(1, n - 1);

    // Accuracy points (green)
    const accuracyPoints = history.map((item, idx) => {
      const x = padding.left + idx * xStep;
      const y = padding.top + chartH - item.accuracy * chartH;
      return { x, y, accuracy: item.accuracy, attemptId: item.attemptId };
    });

    // Difficulty points (blue dashed)
    const difficultyPoints = history.map((item, idx) => {
      const x = padding.left + idx * xStep;
      const y = padding.top + chartH - item.difficulty * chartH;
      return { x, y, difficulty: item.difficulty, attemptId: item.attemptId };
    });

    const accPathD = accuracyPoints.reduce(
      (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
      ''
    );

    const diffPathD = difficultyPoints.reduce(
      (acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
      ''
    );

    return (
      <div className="chart-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} className="progress-svg-chart">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick) => {
            const y = padding.top + chartH - tick * chartH;
            return (
              <g key={tick} className="chart-grid-line">
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                  {Math.round(tick * 100)}%
                </text>
              </g>
            );
          })}

          {/* Difficulty Line (Blue dashed) */}
          <path d={diffPathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" opacity="0.75" />

          {/* Accuracy Line (Green solid) */}
          <path d={accPathD} fill="none" stroke="#10b981" strokeWidth="3" />

          {/* Points and Labels */}
          {difficultyPoints.map((pt, idx) => (
            <circle key={`diff-${idx}`} cx={pt.x} cy={pt.y} r="3.5" fill="#3b82f6" />
          ))}

          {accuracyPoints.map((pt, idx) => (
            <g key={`acc-${idx}`}>
              <circle cx={pt.x} cy={pt.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
              <text x={pt.x} y={height - 12} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="600">
                #{idx + 1}
              </text>
              <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize="10" fill="#047857" fontWeight="700">
                {Math.round(pt.accuracy * 100)}%
              </text>
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-line" style={{ backgroundColor: '#10b981' }} />
            <span>Accuracy (%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-line dashed" style={{ borderColor: '#3b82f6' }} />
            <span>Target Difficulty (Adaptive Scaling)</span>
          </div>
        </div>
      </div>
    );
  };

  const selectedSkillSummary: SkillProgressSummary | undefined = skills.find(
    (s) => s.skill === selectedSkill
  );

  return (
    <div className="results-container">
      {/* Header Banner */}
      <div className="results-header">
        <div className="results-badge">Trial 11 • Longitudinal Mastery & Trends</div>
        <h2 className="results-title">📈 Learning Progress: {progress.topic}</h2>
        <p className="results-subtitle">
          Long-term performance tracking, skill progression, and adaptive difficulty history.
        </p>
      </div>

      {/* Overall Progress Metrics Grid */}
      <div className="results-overall-grid">
        <div className="overall-stat-card">
          <span className="overall-stat-num">
            {hasHistory ? `${Math.round(assessments.latestAccuracy * 100)}%` : '—'}
          </span>
          <span className="overall-stat-label">Latest Accuracy</span>
          <span className="overall-stat-sub">
            {hasHistory ? `Difficulty: ${Math.round(assessments.latestDifficulty * 100)}%` : 'No data'}
          </span>
        </div>

        <div className="overall-stat-card">
          <span
            className="overall-stat-num"
            style={{
              color: assessments.improvement > 0 ? '#10b981' : assessments.improvement < 0 ? '#ef4444' : '#0f172a',
            }}
          >
            {hasMultiHistory ? `${assessments.improvement >= 0 ? '+' : ''}${Math.round(assessments.improvement * 100)}%` : '—'}
          </span>
          <span className="overall-stat-label">Net Improvement</span>
          <span className="overall-stat-sub">
            {hasMultiHistory ? `Avg Accuracy: ${Math.round(assessments.averageAccuracy * 100)}%` : 'Requires 2+ attempts'}
          </span>
        </div>

        <div className="overall-stat-card">
          <span className="overall-stat-num">{assessments.total}</span>
          <span className="overall-stat-label">Assessments Completed</span>
          <span className="overall-stat-sub">Tracked longitudinally</span>
        </div>

        <div className="overall-stat-card">
          <span className="overall-stat-num" style={{ color: '#7c3aed' }}>
            {progress.mastered.length} / {skills.length}
          </span>
          <span className="overall-stat-label">Mastered Skills</span>
          <span className="overall-stat-sub">
            {progress.recovering.length > 0 ? `${progress.recovering.length} recovering` : 'Stable verification'}
          </span>
        </div>
      </div>

      {/* Assessment History Visualization Chart */}
      <div className="results-section-card">
        <div className="section-card-header">
          <h3>📊 Longitudinal Performance & Difficulty Progression</h3>
        </div>
        <p className="section-note">
          Tracks how accuracy responds as assessment difficulty scales adaptively.
        </p>
        {renderHistoryChart()}
      </div>

      {/* Skill Progress Table / Grid */}
      <div className="results-section-card">
        <div className="section-card-header">
          <h3>🧠 Skill Mastery & Trend Analysis</h3>
        </div>
        <p className="section-note">
          Categorizes skills by verified evidence, longitudinal stability, recovery, and potential regression.
        </p>

        {skills.length === 0 ? (
          <p className="focus-empty">No skill evidence recorded yet.</p>
        ) : (
          <div className="progress-skills-table-wrapper">
            <table className="progress-skills-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Current Score</th>
                  <th>Status</th>
                  <th>Trend</th>
                  <th>Delta</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((item) => (
                  <tr key={item.skill} onClick={() => setSelectedSkill(item.skill)} className={selectedSkill === item.skill ? 'selected-row' : ''}>
                    <td className="skill-cell-name">
                      <strong>{item.skill}</strong>
                    </td>
                    <td>
                      <div className="table-score-bar-wrapper">
                        <div className="table-score-track">
                          <div
                            className="table-score-fill"
                            style={{
                              width: `${item.score * 100}%`,
                              backgroundColor:
                                item.status === 'MASTERED' || item.status === 'STRONG'
                                  ? '#10b981'
                                  : item.status === 'RECOVERING' || item.status === 'DEVELOPING'
                                  ? '#f59e0b'
                                  : '#ef4444',
                            }}
                          />
                        </div>
                        <span>{Math.round(item.score * 100)}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`skill-status-tag ${item.status.toLowerCase()}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`trend-pill ${item.trend.toLowerCase()}`}>
                        {item.trend === 'IMPROVING' ? '↗ IMPROVING' : item.trend === 'DECLINING' ? '↘ DECLINING' : item.trend === 'STABLE' ? '→ STABLE' : '⋯ INSUFFICIENT'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: item.change > 0 ? '#059669' : item.change < 0 ? '#dc2626' : '#64748b' }}>
                      {item.change !== 0 ? `${item.change > 0 ? '+' : ''}${Math.round(item.change * 100)}%` : '—'}
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      {item.evidence} questions
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Skill Drilldown */}
      {selectedSkillSummary && (
        <div className="results-section-card skill-drilldown-card">
          <div className="section-card-header">
            <h3>🔬 Detailed Timeline: {selectedSkillSummary.skill}</h3>
            <span className={`skill-status-tag ${selectedSkillSummary.status.toLowerCase()}`}>
              {selectedSkillSummary.status.replace('_', ' ')}
            </span>
          </div>

          <div className="drilldown-meta-grid">
            <div className="drilldown-stat">
              <span className="drilldown-label">Current Mastery Score</span>
              <span className="drilldown-num">{Math.round(selectedSkillSummary.score * 100)}%</span>
            </div>
            <div className="drilldown-stat">
              <span className="drilldown-label">Statistical Confidence</span>
              <span className="drilldown-num">{Math.round(selectedSkillSummary.confidence * 100)}%</span>
            </div>
            <div className="drilldown-stat">
              <span className="drilldown-label">Verified Questions</span>
              <span className="drilldown-num">{selectedSkillSummary.evidence} items</span>
            </div>
            <div className="drilldown-stat">
              <span className="drilldown-label">Observed Trend</span>
              <span className="drilldown-num" style={{ fontSize: '1.1rem' }}>
                {selectedSkillSummary.trend.replace('_', ' ')}
              </span>
            </div>
          </div>

          {selectedSkillSummary.history.length > 0 ? (
            <div className="drilldown-timeline">
              <h4>Chronological Performance Steps:</h4>
              <div className="timeline-steps-row">
                {selectedSkillSummary.history.map((obs, idx) => (
                  <div key={idx} className="timeline-step-item">
                    <span className="step-badge">Attempt #{obs.attemptId}</span>
                    <span className="step-score">{Math.round(obs.score * 100)}%</span>
                    <span className="step-evidence">{obs.evidenceCount} evaluated</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="focus-empty">Single baseline observation recorded.</p>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="results-actions-footer">
        {onExit && (
          <button type="button" className="nav-btn" onClick={onExit}>
            ← Back to Assessment
          </button>
        )}

        {onStartAdaptive && (
          <button
            type="button"
            className="submit-btn"
            style={{ backgroundColor: '#7c3aed', padding: '0.75rem 1.5rem', fontWeight: 700 }}
            onClick={onStartAdaptive}
          >
            🚀 Continue Adaptive Assessment
          </button>
        )}
      </div>
    </div>
  );
};
