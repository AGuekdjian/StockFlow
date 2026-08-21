import { AppError } from '../shared/errors/app-error.js';
export function requireAuth(req, _res, next) {
  if (!req.session?.user)
    return next(
      new AppError({ code: 'UNAUTHORIZED', message: 'Debés iniciar sesión.', status: 401 }),
    );
  req.user = req.session.user;
  return next();
}
