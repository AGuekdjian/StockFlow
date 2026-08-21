import { AppError } from '../shared/errors/app-error.js';
export function notFoundMiddleware(req, _res, next) {
  next(
    new AppError({
      code: 'NOT_FOUND',
      message: 'Recurso no encontrado.',
      status: 404,
      details: { path: req.path },
    }),
  );
}
