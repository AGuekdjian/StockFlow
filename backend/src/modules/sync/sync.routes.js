import { Router } from 'express';
import { z } from 'zod';
import { stockMovementSchema } from '@stock-control/shared';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/authorization.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { AppError } from '../../shared/errors/app-error.js';

const listSchema = z.object({
  status: z.enum(['PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const resolutionSchema = z
  .object({
    action: z.enum(['REPLACED', 'DISMISSED']),
    reason: z.string().trim().min(3).max(500),
    replacement: stockMovementSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === 'REPLACED' && !value.replacement)
      context.addIssue({
        code: 'custom',
        path: ['replacement'],
        message: 'La operación de reemplazo es obligatoria',
      });
  });

export function syncRouter({ outbox, coordinator }) {
  const router = Router();
  router.use(requireAuth, requirePermission(PERMISSIONS.SYSTEM_READ));
  router.get('/operations', validate(listSchema, 'query'), (req, res) => {
    const [items, total] = outbox.list(req.query);
    res.json({
      data: { items, pagination: { page: req.query.page, limit: req.query.limit, total } },
    });
  });
  router.post('/operations/:id/retry', (req, res, next) => {
    try {
      const operation = outbox.get(req.params.id);
      if (!operation)
        throw new AppError({
          code: 'OPERATION_NOT_FOUND',
          message: 'Operación no encontrada.',
          status: 404,
        });
      if (operation.status !== 'FAILED')
        throw new AppError({
          code: 'INVALID_SYNC_STATE',
          message: 'Sólo pueden reintentarse operaciones fallidas.',
          status: 409,
        });
      res.json({ data: { operation: outbox.retryFailed(req.params.id) } });
    } catch (error) {
      next(error);
    }
  });
  router.post('/conflicts/:id/resolve', validate(resolutionSchema), async (req, res, next) => {
    try {
      const conflict = outbox.get(req.params.id);
      if (!conflict)
        throw new AppError({
          code: 'OPERATION_NOT_FOUND',
          message: 'Conflicto no encontrado.',
          status: 404,
        });
      if (conflict.status !== 'CONFLICT')
        throw new AppError({
          code: 'INVALID_SYNC_STATE',
          message: 'La operación no está en conflicto.',
          status: 409,
        });
      let result;
      if (req.body.action === 'REPLACED') {
        if (req.body.replacement.productId !== conflict.payload.input.productId)
          throw new AppError({
            code: 'INVALID_RESOLUTION',
            message: 'El reemplazo debe corresponder al mismo producto.',
            status: 422,
          });
        result = await coordinator.submit(req.body.replacement, {
          userId: req.user.id,
          role: req.user.role,
          requestId: req.requestId,
        });
      }
      outbox.resolveConflict(req.params.id, {
        action: req.body.action,
        resolutionOperationId: req.body.replacement?.operationId,
        reason: req.body.reason,
        resolvedBy: req.user.id,
      });
      res.json({ data: { resolution: req.body.action, result } });
    } catch (error) {
      if (error.message?.includes('UNIQUE'))
        return next(
          new AppError({
            code: 'CONFLICT_ALREADY_RESOLVED',
            message: 'El conflicto ya fue resuelto explícitamente.',
            status: 409,
          }),
        );
      next(error);
    }
  });
  return router;
}
