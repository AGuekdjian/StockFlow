import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/authorization.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { PERMISSIONS } from '../auth/permissions.js';
const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().max(80).optional(),
  userId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
});
export function auditRouter({ audit }) {
  const router = Router();
  router.use(requireAuth, requirePermission(PERMISSIONS.AUDIT_READ));
  router.get('/', validate(querySchema, 'query'), async (req, res, next) => {
    try {
      const [items, total] = await audit.list(req.query);
      res.json({
        data: { items, pagination: { page: req.query.page, limit: req.query.limit, total } },
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
