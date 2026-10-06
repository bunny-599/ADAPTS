import React from 'react';

interface ClarificationModalProps {
  message: string;
  options: string[];
  onSelectOption: (option: string) => void;
  onCancel: () => void;
}

export const ClarificationModal: React.FC<ClarificationModalProps> = ({
  message,
  options,
  onSelectOption,
  onCancel,
}) => {
  const [selected, setSelected] = React.useState<string>(options[0] || '');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(9, 13, 22, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div className="glass-card" style={{
        maxWidth: '520px',
        width: '100%',
        padding: '2.25rem',
        backgroundColor: '#0c101d',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '14px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
      }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            We need a little more detail
          </span>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: '0.35rem 0 0 0', fontFamily: 'Outfit, sans-serif' }}>
            Which topic did you learn?
          </h3>
        </div>

        <p style={{ fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          {message}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '2rem' }}>
          {options.map((opt, idx) => {
            const isSelected = selected === opt;
            return (
              <div
                key={idx}
                onClick={() => setSelected(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '0.9rem 1.15rem',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : '#111827',
                  border: isSelected ? '2px solid #38bdf8' : '1px solid #1f293d',
                  borderRadius: '10px',
                  color: isSelected ? '#ffffff' : '#cbd5e1',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: isSelected ? '5px solid #38bdf8' : '2px solid #64748b',
                  backgroundColor: isSelected ? '#ffffff' : 'transparent',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }} />
                <span>{opt}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!selected}
            onClick={() => onSelectOption(selected)}
            style={{ padding: '0.8rem 1.75rem', fontSize: '0.95rem', fontWeight: 700, background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
};
