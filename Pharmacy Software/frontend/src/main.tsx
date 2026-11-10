import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { HmsNotificationProvider } from './context/HmsNotificationContext';
import './index.css';
import 'react-toastify/dist/ReactToastify.css';

document.documentElement.classList.add('portal-montserrat');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <HmsNotificationProvider>
          <App />
        </HmsNotificationProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
);
