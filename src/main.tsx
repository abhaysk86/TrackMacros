import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import App from './App';
import { ToastProvider } from './components/Toast';
import './index.css';

// Cookieless, aggregate visit counts, on the hosted site only.
// It records nothing unless Web Analytics is enabled for the project in Vercel.
if (!['localhost', '127.0.0.1'].includes(location.hostname)) inject();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
