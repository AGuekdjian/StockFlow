import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { requestIdMiddleware } from './middlewares/request-id.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { noSqlSanitizeMiddleware } from './middlewares/no-sql-sanitize.middleware.js';
import { outboxMetrics } from './infrastructure/sqlite/sqlite.js';
import session from 'express-session';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { productRouter } from './modules/products/product.routes.js';
import { referenceRouter } from './modules/products/reference.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { dashboardRouter } from './modules/inventory/dashboard.routes.js';
import { originMiddleware } from './middlewares/origin.middleware.js';
import { requestLoggingMiddleware } from './middlewares/request-logging.middleware.js';
import { swaggerRouter } from './docs/swagger.routes.js';
import { requireAuth } from './middlewares/auth.middleware.js';
import { requirePermission } from './middlewares/authorization.middleware.js';
import { PERMISSIONS } from './modules/auth/permissions.js';
import { PRODUCT } from './config/product.js';

export function createApp({
  env,
  logger,
  mongo,
  sqlite,
  authService,
  users,
  sessionStore,
  productService,
  categories,
  locations,
  inventoryService,
  coordinator,
  outbox,
  audit,
  dashboard,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(requestLoggingMiddleware(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH'],
    }),
  );
  app.use(
    originMiddleware({
      allowedOrigin: env.FRONTEND_ORIGIN,
      requireOrigin: env.NODE_ENV === 'production',
    }),
  );
  app.use(
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(noSqlSanitizeMiddleware);
  if (authService && users) {
    app.use(
      session({
        name: 'stock.sid',
        secret: env.SESSION_SECRET,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
          httpOnly: true,
          sameSite: 'strict',
          secure: env.COOKIE_SECURE ?? false,
          maxAge: (env.SESSION_HOURS ?? 8) * 60 * 60 * 1000,
        },
      }),
    );
    app.use('/api/auth', authRouter({ authService }));
    if (env.SWAGGER_ENABLED !== false) {
      const documentation = swaggerRouter();
      if (env.NODE_ENV === 'production')
        app.use(
          ['/api/docs', '/api/docs/', '/api/docs/init.js', '/api/docs/assets', '/api/openapi.json'],
          requireAuth,
          requirePermission(PERMISSIONS.SYSTEM_READ),
        );
      app.use('/api', documentation);
    }
    app.use('/api/users', userRouter({ users, authService, sessionStore, audit }));
    if (productService) app.use('/api/products', productRouter({ productService }));
    if (categories) app.use('/api/categories', referenceRouter(categories, 'CATEGORY', audit));
    if (locations) app.use('/api/locations', referenceRouter(locations, 'LOCATION', audit));
    if (inventoryService)
      app.use('/api/inventory', inventoryRouter({ inventoryService, coordinator }));
    if (outbox && coordinator) app.use('/api/sync', syncRouter({ outbox, coordinator }));
    if (audit) app.use('/api/audit', auditRouter({ audit }));
    if (dashboard) app.use('/api/dashboard', dashboardRouter({ dashboard, sqlite, mongo }));
  }
  if ((!authService || !users) && env.SWAGGER_ENABLED !== false) app.use('/api', swaggerRouter());
  app.get('/api/health/live', (_req, res, next) => {
    try {
      sqlite.prepare('SELECT 1').get();
      res.json({ data: { status: 'alive', version: PRODUCT.version } });
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/health/ready', (_req, res) => {
    const ready = mongo.available;
    res.status(ready ? 200 : 503).json({
      data: { status: ready ? 'ready' : 'not_ready', mongodb: ready ? 'online' : 'offline' },
    });
  });
  app.get('/api/health', (_req, res) => {
    const outbox = outboxMetrics(sqlite);
    const mongodb = mongo.available ? 'online' : 'offline';
    const status = mongo.available ? 'healthy' : 'degraded';
    res
      .status(200)
      .json({ data: { status, api: 'ok', mongodb, outbox, version: PRODUCT.version } });
  });
  app.use(notFoundMiddleware);
  app.use(errorMiddleware(logger, env.NODE_ENV));
  return app;
}
