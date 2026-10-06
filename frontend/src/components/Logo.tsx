import React from 'react';

interface LogoProps {
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const Logo: React.FC<LogoProps> = ({ onClick, size = 'medium' }) => {
  const iconSize = size === 'small' ? 22 : size === 'large' ? 34 : 26;
  const fontSize = size === 'small' ? '1rem' : size === 'large' ? '1.5rem' : '1.25rem';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 3L2 27H30L16 3Z"
            fill="url(#adaptsLogoGrad)"
          />
          <path
            d="M16 9.5L8.5 22.5H23.5L16 9.5Z"
            fill="#0b0f19"
          />
          <path
            d="M16 14L12.5 20H19.5L16 14Z"
            fill="url(#adaptsLogoGrad)"
          />
          <defs>
            <linearGradient id="adaptsLogoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00C6FF" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span
        style={{
          fontSize,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        ADAPTS
      </span>
    </div>
  );
};
