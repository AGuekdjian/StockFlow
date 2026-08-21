import { Router } from 'express';
import { createNamedEntitySchema, entityStatusSchema } from '@stock-control/shared';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/authorization.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { AppError } from '../../shared/errors/app-error.js';
import { z } from 'zod';

export function referenceRouter(repository, entityCode, audit) {
  const router = Router();
  const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
  router.use(requireAuth);
  router.get('/', requirePermission(PERMISSIONS.PRODUCT_READ), async (_req, res, next) => {
    try {
      res.json({ data: { items: await repository.list() } });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/',
    requirePermission(PERMISSIONS.PRODUCT_CREATE),
    validate(createNamedEntitySchema),
    async (req, res, next) => {
      try {
        const item = await repository.create(req.body);
        await audit?.record({
          userId: req.user.id,
          action: `${entityCode}_CREATED`,
          entity: entityCode,
          entityId: item._id,
          requestId: req.requestId,
        });
        res.status(201).json({ data: { item } });
      } catch (error) {
        if (error?.code === 11000)
          return next(
            new AppError({
              code: `DUPLICATE_${entityCode}`,
              message: 'El código ya existe.',
              status: 409,
            }),
          );
        next(error);
      }
    },
  );
  router.patch(
    '/:id/status',
    requirePermission(PERMISSIONS.PRODUCT_UPDATE),
    validate(idParams, 'params'),
    validate(entityStatusSchema),
    async (req, res, next) => {
      try {
        const item = await repository.setActive(req.params.id, req.body.active);
        if (!item)
          throw new AppError({
            code: `${entityCode}_NOT_FOUND`,
            message: 'Entidad no encontrada.',
            status: 404,
          });
        await audit?.record({
          userId: req.user.id,
          action: req.body.active ? `${entityCode}_REACTIVATED` : `${entityCode}_DEACTIVATED`,
          entity: entityCode,
          entityId: item._id,
          requestId: req.requestId,
        });
        res.json({ data: { item } });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
