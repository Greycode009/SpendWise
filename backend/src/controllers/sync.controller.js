import { pullChanges, pushOps } from '../services/sync.service.js';

export async function push(req, res) {
  res.json(await pushOps(req.userId, req.valid.body.ops));
}

export async function pull(req, res) {
  res.json(await pullChanges(req.userId, req.valid.query.since));
}
