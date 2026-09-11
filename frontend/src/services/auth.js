import axios from 'axios';
import { API_URL } from './api.js';
import { session } from './session.js';
import { deleteUserDb } from '../db/db.js';

export async function login(email, password) {
  const { data } = await axios.post(`${API_URL}/auth/login`, { email, password }, { timeout: 20_000 });
  const previous = session.get();
  // A different account on this device → the old account's local data stays in
  // its own database until that user logs out; nothing is shared.
  session.set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  return { user: data.user, sameUser: previous?.user?.id === data.user.id };
}

export async function register({ name, email, password, currency }) {
  const { data } = await axios.post(`${API_URL}/auth/register`, { name, email, password, currency }, { timeout: 20_000 });
  session.set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.user;
}

/** Sign out: revoke the refresh token (best effort) and wipe this account's local data. */
export async function logout() {
  const current = session.get();
  if (!current) return;
  if (current.refreshToken) {
    axios.post(`${API_URL}/auth/logout`, { refreshToken: current.refreshToken }, { timeout: 5_000 }).catch(() => {});
  }
  session.clear();
  if (current.user?.id) await deleteUserDb(current.user.id).catch(() => {});
}
