import { ClerkProvider } from '@clerk/react';
import { dark } from '@clerk/themes';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY in environment.');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY || ''}
      appearance={{
        ...(dark as any),
        variables: {
          colorPrimary: '#38bdf8',
          colorBackground: '#0c101d',
        },
        elements: {
          rootBox: {
            colorScheme: 'dark',
          },
          card: {
            backgroundColor: '#0c101d',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85)',
          },
          userProfileRoot: {
            backgroundColor: '#0c101d',
          },
          navbar: {
            backgroundColor: '#070a12',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          },
          navbarButton: {
            color: '#94a3b8',
          },
          headerTitle: {
            color: '#ffffff',
          },
          headerSubtitle: {
            color: '#94a3b8',
          },
          profileSectionTitleText: {
            color: '#38bdf8',
          },
          userPreviewMainIdentifier: {
            color: '#ffffff',
          },
          userPreviewSecondaryIdentifier: {
            color: '#94a3b8',
          },
          userButtonPopoverCard: {
            backgroundColor: '#0c101d',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8)',
          },
          userButtonPopoverActionButton: {
            color: '#ffffff',
          },
          userButtonPopoverActionButtonText: {
            color: '#ffffff',
          },
        },
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);