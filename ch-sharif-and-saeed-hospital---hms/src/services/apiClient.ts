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

/**
 * `AuthContext.tsx` persists its own `UserSession` shape (field `token`) to
 * this SAME localStorage key on every render after login, overwriting the
 * `{accessToken, refreshToken, ...}` shape `setStoredSession` below just
 * wrote — both target `STORAGE_KEY_SESSION`. Reading either field name
 * here (rather than only `accessToken`) means whichever of the two last
 * wrote to the key still yields the real JWT, instead of every request
 * silently going out unauthenticated.
 */
export function getStoredAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (raw) {
      const session: StoredSession & { token?: string } = JSON.parse(raw);
      return session.accessToken || session.token || null;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}

/** Patches the access token into whichever shape is currently stored, without disturbing the rest of the session. */
function patchStoredAccessToken(newToken: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!raw) return;
    const session = JSON.parse(raw);
    if ('accessToken' in session) session.accessToken = newToken;
    if ('token' in session) session.token = newToken;
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  } catch {
    // Ignore
  }
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

/** `AuthContext.tsx` listens for this to keep its in-memory session in sync with a silently-refreshed token. */
export const AUTH_TOKEN_REFRESHED_EVENT = 'auth:token-refreshed';
/** `AuthContext.tsx` listens for this to reset to the logged-out state once refresh has genuinely failed. */
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired';

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

// Silent access-token refresh on 401 (access tokens are short-lived —
// JWT_ACCESS_TTL is 15 minutes — so this fires routinely during normal use,
// not just on a truly stale session). The refresh token itself is an
// httpOnly cookie the browser attaches automatically (`withCredentials`
// above); concurrent 401s while a refresh is already in flight are queued
// and replayed once, rather than each firing their own refresh call.
let isRefreshing = false;
let pendingRequests: Array<(token: string | null) => void> = [];

function resolvePendingRequests(token: string | null) {
  pendingRequests.forEach((cb) => cb(token));
  pendingRequests = [];
}

// Global response error interceptor: extracts clear backend error messages
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: { message?: string; code?: string }; message?: string }>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Another request already triggered a refresh — wait for it instead of firing a duplicate.
        return new Promise((resolve, reject) => {
          pendingRequests.push((token) => {
            if (token) {
              (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshRes = await apiClient.post<{ data: { accessToken: string } }>('/auth/refresh');
        const newToken = refreshRes.data?.data?.accessToken;
        if (!newToken) throw new Error('Refresh response carried no access token');

        patchStoredAccessToken(newToken);
        window.dispatchEvent(new CustomEvent(AUTH_TOKEN_REFRESHED_EVENT, { detail: { accessToken: newToken } }));
        resolvePendingRequests(newToken);

        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        resolvePendingRequests(null);
        clearStoredSession();
        window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response) {
      const errorPayload = error.response.data as any;
      const errorObj = errorPayload?.error;
      let backendMessage = errorObj?.message || errorPayload?.message;
      if (Array.isArray(errorObj?.details) && errorObj.details.length > 0) {
        const detailStr = errorObj.details
          .map((d: any) => `${d.field ? d.field + ': ' : ''}${d.issue || d.message}`)
          .join('; ');
        backendMessage = backendMessage ? `${backendMessage} (${detailStr})` : detailStr;
      }
      if (backendMessage) {
        error.message = backendMessage;
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
