import { Router } from 'express';
import { z } from 'zod';
import {
  createProductSchema,
  updateProductSchema,
  productStatusSchema,
} from '@stock-control/shared';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/authorization.middleware.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { AppError } from '../../shared/errors/app-error.js';

const objectIdParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  search: z.string().trim().max(100).optional(),
});

export function productRouter({ productService }) {
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/',
    requirePermission(PERMISSIONS.PRODUCT_READ),
    validate(listQuery, 'query'),
    async (req, res, next) => {
      try {
        const [items, total] = await productService.list(req.query);
        res.json({
          data: { items, pagination: { page: req.query.page, limit: req.query.limit, total } },
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/lookup/:code',
    requirePermission(PERMISSIONS.PRODUCT_READ),
    async (req, res, next) => {
      try {
        const product = await productService.products.findByCode(req.params.code);
        if (!product)
          throw new AppError({
            code: 'PRODUCT_NOT_FOUND',
            message: 'Producto no encontrado.',
            status: 404,
          });
        res.json({ data: { product } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/:id',
    requirePermission(PERMISSIONS.PRODUCT_READ),
    validate(objectIdParams, 'params'),
    async (req, res, next) => {
      try {
        res.json({ data: { product: await productService.get(req.params.id) } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/',
    requirePermission(PERMISSIONS.PRODUCT_CREATE),
    validate(createProductSchema),
    async (req, res, next) => {
      try {
        const product = await productService.create(req.body, {
          requestId: req.requestId,
          userId: req.user.id,
        });
        res.status(201).json({ data: { product } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    '/:id',
    requirePermission(PERMISSIONS.PRODUCT_UPDATE),
    validate(objectIdParams, 'params'),
    validate(updateProductSchema),
    async (req, res, next) => {
      try {
        const product = await productService.update(req.params.id, req.body, {
          requestId: req.requestId,
          userId: req.user.id,
        });
        res.json({ data: { product } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    '/:id/status',
    requirePermission(PERMISSIONS.PRODUCT_UPDATE),
    validate(objectIdParams, 'params'),
    validate(productStatusSchema),
    async (req, res, next) => {
      try {
        const product = await productService.setActive(req.params.id, req.body.active, {
          requestId: req.requestId,
          userId: req.user.id,
        });
        res.json({ data: { product } });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
