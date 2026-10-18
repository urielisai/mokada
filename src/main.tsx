import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { router } from './app/router';
import { queryClient } from './app/config/queryClient';
import { AuthProvider } from './modules/auth/context/AuthProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          gutter={10}
          toastOptions={{
            className: 'material-popover',
            style: {
              borderRadius: '9999px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1D1D1F',
              background: 'rgb(255 255 255 / 0.86)',
              boxShadow: '0 0 0 0.5px rgb(0 0 0 / 0.08), 0 12px 32px -8px rgb(0 0 0 / 0.18)',
            },
            success: { iconTheme: { primary: '#34C759', secondary: '#fff' } },
            error: { iconTheme: { primary: '#FF3B30', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
