import * as auth from '../services/auth.service.js';

const ua = (req) => req.get('user-agent');

export async function register(req, res) {
  res.status(201).json(await auth.register(req.valid.body, ua(req)));
}

export async function login(req, res) {
  res.json(await auth.login(req.valid.body, ua(req)));
}

export async function refresh(req, res) {
  res.json(await auth.refresh(req.valid.body.refreshToken, ua(req)));
}

export async function logout(req, res) {
  await auth.logout(req.body?.refreshToken);
  res.status(204).end();
}

export async function me(req, res) {
  res.json({ user: await auth.getProfile(req.userId) });
}

export async function updateMe(req, res) {
  res.json({ user: await auth.updateProfile(req.userId, req.valid.body) });
}
