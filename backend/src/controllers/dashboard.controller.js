import { getAnalytics, getSummary } from '../services/dashboard.service.js';

export async function summary(req, res) {
  res.json({ data: await getSummary(req.userId, req.valid.query.month) });
}

export async function analytics(req, res) {
  res.json({ data: await getAnalytics(req.userId, req.valid.query) });
}
