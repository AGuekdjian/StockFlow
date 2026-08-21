import { Router } from 'express';
import { z } from 'zod';
import { stockMovementSchema, MOVEMENT_TYPES } from '@stock-control/shared';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(MOVEMENT_TYPES).optional(),
  productId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  userId: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  operationId: z.string().uuid().optional(),
  reason: z.string().trim().max(100).optional(),
  client: z.string().trim().max(100).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
});
export function inventoryRouter({ inventoryService, coordinator }) {
  const router = Router();
  router.use(requireAuth);
  router.post('/movements', validate(stockMovementSchema), async (req, res, next) => {
    try {
      const result = coordinator
        ? await coordinator.submit(req.body, {
            userId: req.user.id,
            role: req.user.role,
            requestId: req.requestId,
          })
        : {
            status: 'SYNCED',
            movement: await inventoryService.execute(req.body, {
              userId: req.user.id,
              role: req.user.role,
              requestId: req.requestId,
            }),
          };
      res.status(result.status === 'SYNCED' ? 201 : 202).json({ data: result });
    } catch (error) {
      next(error);
    }
  });
  router.get('/movements', validate(listSchema, 'query'), async (req, res, next) => {
    try {
      const [items, total] = await inventoryService.list(req.query, req.user);
      res.json({
        data: { items, pagination: { page: req.query.page, limit: req.query.limit, total } },
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
