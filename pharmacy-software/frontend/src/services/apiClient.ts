import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const DEFAULT_API_URL = isLocalhost ? 'http://localhost:4100/api/v1' : '';

const BASE_URL = ((import.meta as any).env && (import.meta as any).env.VITE_API_BASE_URL) || DEFAULT_API_URL;

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const STORAGE_KEY = 'pharmacy_access_token';

export function getAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}
export function setAccessToken(token: string | null) {
  if (token) sessionStorage.setItem(STORAGE_KEY, token);
  else sessionStorage.removeItem(STORAGE_KEY);
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post<{ data: { accessToken: string } }>(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
    const token = res.data.data.accessToken;
    setAccessToken(token);
    return token;
  } catch {
    setAccessToken(null);
    return null;
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/login')) {
      original._retry = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      const newToken = await refreshPromise;
      if (newToken) {
        (original.headers as any) = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
