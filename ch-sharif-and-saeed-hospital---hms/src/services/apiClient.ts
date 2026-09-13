import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL =
  ((import.meta as any).env && (import.meta as any).env.VITE_API_BASE_URL) ||
  'http://localhost:4000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Storage key used to persist user tokens
const STORAGE_KEY_SESSION = 'css_hospital_active_session';

export interface StoredSession {
  accessToken?: string;
  refreshToken?: string;
  user?: any;
  portal?: string;
}

export function getStoredAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (raw) {
      const session: StoredSession = JSON.parse(raw);
      return session.accessToken || null;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}

export function setStoredSession(session: StoredSession): void {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  } catch (e) {
    console.warn('Failed to save session in localStorage', e);
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem('css_hospital_active_user');
    localStorage.removeItem('css_hospital_active_portal');
  } catch {
    // Ignore
  }
}

// Attach Bearer token to all outgoing requests
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Global response error interceptor: extracts clear backend error messages
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: { message?: string; code?: string }; message?: string }>) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const backendMessage = data?.error?.message || data?.message;

      if (status === 401) {
        // Token expired or invalid
        console.warn('Unauthorized request, session may have expired.');
      }

      if (backendMessage) {
        // Enhance error with the clean backend message
        error.message = backendMessage;
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
