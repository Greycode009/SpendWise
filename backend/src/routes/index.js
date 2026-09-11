import { Router } from 'express';
import * as authCtl from '../controllers/auth.controller.js';
import * as syncCtl from '../controllers/sync.controller.js';
import * as dashCtl from '../controllers/dashboard.controller.js';
import { categories, loans, people, repayments, transactions } from '../controllers/records.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';
import { isUuid } from '../utils/ids.js';
import {
  loginSchema,
  monthQuerySchema,
  refreshSchema,
  registerSchema,
  syncPullSchema,
  syncPushSchema,
  transactionQuerySchema,
  updateProfileSchema,
} from '../validators/schemas.js';

export const router = Router();

// Unknown / malformed ids are simply "not found" (and never reach the database).
router.param('id', (_req, _res, next, id) => (isUuid(id) ? next() : next(notFound())));

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ---------------------------------------------------------------- auth
router.post('/auth/register', authLimiter, validate(registerSchema), authCtl.register);
router.post('/auth/login', authLimiter, validate(loginSchema), authCtl.login);
router.post('/auth/refresh', validate(refreshSchema), authCtl.refresh);
router.post('/auth/logout', authCtl.logout);
router.get('/auth/me', requireAuth, authCtl.me);
router.patch('/auth/me', requireAuth, validate(updateProfileSchema), authCtl.updateMe);

// Everything below requires a valid access token.
router.use(requireAuth);

/** Register list/get/create/update/delete routes for one entity. */
function resource(path, ctl, { listValidator } = {}) {
  router.get(path, ...(listValidator ? [listValidator] : []), ctl.list);
  router.post(path, ctl.create);
  router.get(`${path}/:id`, ctl.get);
  router.patch(`${path}/:id`, ctl.update);
  router.delete(`${path}/:id`, ctl.remove);
}

resource('/categories', categories);
resource('/transactions', transactions, { listValidator: validate(transactionQuerySchema, 'query') });
resource('/people', people);
resource('/loans', loans);

router.get('/loans/:id/repayments', repayments.listForLoan);
router.post('/loans/:id/repayments', repayments.createForLoan);
router.get('/repayments/:id', repayments.get);
router.patch('/repayments/:id', repayments.update);
router.delete('/repayments/:id', repayments.remove);

// ---------------------------------------------------------------- dashboard
router.get('/dashboard/summary', validate(monthQuerySchema, 'query'), dashCtl.summary);
router.get('/dashboard/analytics', validate(monthQuerySchema, 'query'), dashCtl.analytics);

// ---------------------------------------------------------------- sync
router.post('/sync/push', validate(syncPushSchema), syncCtl.push);
router.get('/sync/pull', validate(syncPullSchema, 'query'), syncCtl.pull);
