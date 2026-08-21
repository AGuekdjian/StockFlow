import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/authorization.middleware.js';
import { validate } from '../../middlewares/validation.middleware.js';
import { createUserSchema } from '../auth/auth.validation.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { AppError } from '../../shared/errors/app-error.js';

export function userRouter({ users, authService, sessionStore, audit }) {
  const router = Router();
  const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
  router.use(requireAuth, requirePermission(PERMISSIONS.USER_MANAGE));
  router.get('/', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          page: z.coerce.number().int().positive().default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
        })
        .safeParse(req.query);
      if (!parsed.success)
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Paginación inválida.',
          status: 400,
        });
      const [items, total] = await users.list(parsed.data);
      res.json({ data: { items, pagination: { ...parsed.data, total } } });
    } catch (error) {
      next(error);
    }
  });
  router.post('/', validate(createUserSchema), async (req, res, next) => {
    try {
      const passwordHash = await authService.hashPassword(req.body.password);
      const user = await users.create({ ...req.body, password: undefined, passwordHash });
      await audit?.record({
        userId: req.user.id,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: user._id,
        requestId: req.requestId,
      });
      res.status(201).json({ data: { user } });
    } catch (error) {
      if (error?.code === 11000)
        return next(
          new AppError({
            code: 'DUPLICATE_EMAIL',
            message: 'Ya existe un usuario con ese email.',
            status: 409,
          }),
        );
      next(error);
    }
  });
  router.patch(
    '/:id/status',
    validate(idParams, 'params'),
    validate(z.object({ active: z.boolean() }).strict()),
    async (req, res, next) => {
      try {
        if (req.user.id === req.params.id && !req.body.active)
          throw new AppError({
            code: 'SELF_DEACTIVATION',
            message: 'No podés desactivar tu propio usuario.',
            status: 409,
          });
        const user = await users.setActive(req.params.id, req.body.active);
        if (!user)
          throw new AppError({
            code: 'USER_NOT_FOUND',
            message: 'Usuario no encontrado.',
            status: 404,
          });
        if (!req.body.active) sessionStore?.destroyUserSessions(req.params.id);
        await audit?.record({
          userId: req.user.id,
          action: req.body.active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
          entity: 'User',
          entityId: user._id,
          requestId: req.requestId,
        });
        res.json({ data: { user } });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
