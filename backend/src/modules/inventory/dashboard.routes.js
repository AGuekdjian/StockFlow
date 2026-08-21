import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { outboxCounts } from '../../infrastructure/sqlite/sqlite.js';
export function dashboardRouter({ dashboard, sqlite, mongo }) {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res, next) => {
    try {
      const summary = mongo.available
        ? await dashboard.summary(req.user)
        : { outputsToday: null, inputsToday: null, lowStock: null, outOfStock: null, latest: [] };
      res.json({
        data: {
          ...summary,
          mongodb: mongo.available ? 'online' : 'offline',
          outbox: outboxCounts(sqlite),
        },
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
