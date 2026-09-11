/**
 * HTTP client (Axios). Adds the access token to every request and, when the
 * server says the token expired, transparently refreshes it once and retries.
 */
import axios from 'axios';
import { session } from './session.js';

export const API_URL = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');

export const api = axios.create({ baseURL: API_URL, timeout: 20_000 });

api.interceptors.request.use((config) => {
  const token = session.get()?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

/** Exchange the refresh token for a new pair. Concurrent callers share one request. */
export function refreshTokens() {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = session.get()?.refreshToken;
      if (!refreshToken) {
        session.markExpired();
        throw new Error('Session expired');
      }
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 20_000 });
        session.update({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
        return data.accessToken;
      } catch (err) {
        if (err.response?.status === 401) session.markExpired();
        throw err;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const code = response?.data?.error?.code;
    if (response?.status === 401 && config && !config._retried && (code === 'TOKEN_EXPIRED' || code === 'UNAUTHORIZED')) {
      config._retried = true;
      await refreshTokens();
      return api(config);
    }
    if (response?.status === 401 && code === 'INVALID_TOKEN') session.markExpired();
    throw error;
  },
);

/** True when the request never got an HTTP response (offline, DNS, timeout…). */
export const isNetworkError = (err) => Boolean(err?.isAxiosError) && !err.response;

/** A human-friendly message for any API error. */
export function errorMessage(err, fallback = 'Something went wrong') {
  if (isNetworkError(err)) return "Can't reach the server. Check your connection and try again.";
  return err?.response?.data?.error?.message || err?.message || fallback;
}
