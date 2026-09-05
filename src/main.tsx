import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster
        position="bottom-right"
        richColors
        theme="dark"
        toastOptions={{
          style: {
            background: '#0b100d',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#fff',
          },
        }}
      />
    </ErrorBoundary>
  </StrictMode>,
);
