import { AppError } from '../shared/errors/app-error.js';

function containsUnsafeKey(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, nested]) => key.startsWith('$') || key.includes('.') || containsUnsafeKey(nested),
  );
}

export function noSqlSanitizeMiddleware(req, _res, next) {
  if (containsUnsafeKey(req.body) || containsUnsafeKey(req.params)) {
    return next(
      new AppError({
        code: 'VALIDATION_ERROR',
        message: 'La solicitud contiene campos no permitidos.',
        status: 400,
      }),
    );
  }
  return next();
}
