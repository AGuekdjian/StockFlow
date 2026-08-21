import { AppError } from '../shared/errors/app-error.js';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
export function originMiddleware({ allowedOrigin, requireOrigin }) {
  return (req, _res, next) => {
    if (safeMethods.has(req.method)) return next();
    const origin = req.get('origin');
    if ((origin && origin !== allowedOrigin) || (requireOrigin && !origin))
      return next(
        new AppError({
          code: 'INVALID_ORIGIN',
          message: 'Origen de solicitud no permitido.',
          status: 403,
        }),
      );
    return next();
  };
}
