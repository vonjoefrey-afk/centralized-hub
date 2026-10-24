import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';
import { logger } from './utils/logger';

// Log application startup
if (import.meta.env.DEV) {
  logger.info('Application starting...');
  if (import.meta.env.REACT_APP_CLOUD_LOGGING_FUNCTION_URL) {
    logger.info('✅ Cloud Logging: Enabled');
    logger.info('View logs at: https://console.cloud.google.com/logs?project=centralized-gcp');
    logger.info('View errors at: https://console.cloud.google.com/errors?project=centralized-gcp');
  } else {
    logger.warn('⚠️  Cloud Logging: Not configured. Set REACT_APP_CLOUD_LOGGING_FUNCTION_URL in .env');
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      containerStyle={{
        top: 20,
        right: 20,
      }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#374151',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          borderRadius: '0.5rem',
          padding: '16px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
  </React.StrictMode>
);



