import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { loginSchema } from './auth.validation.js';
import { rateLimit } from 'express-rate-limit';

function regenerate(session) {
  return new Promise((resolve, reject) =>
    session.regenerate((error) => (error ? reject(error) : resolve())),
  );
}
function destroy(session) {
  return new Promise((resolve, reject) =>
    session.destroy((error) => (error ? reject(error) : resolve())),
  );
}

export function authRouter({ authService }) {
  const router = Router();
  router.post(
    '/login',
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
    validate(loginSchema),
    async (req, res, next) => {
      try {
        const user = await authService.login({ ...req.body, requestId: req.requestId });
        await regenerate(req.session);
        req.session.user = {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        };
        res.json({ data: { user: req.session.user } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post('/logout', requireAuth, async (req, res, next) => {
    try {
      await destroy(req.session);
      res.clearCookie('stock.sid');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  router.get('/me', requireAuth, (req, res) => res.json({ data: { user: req.user } }));
  return router;
}
