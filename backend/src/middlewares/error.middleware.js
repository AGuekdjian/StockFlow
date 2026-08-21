import { AppError } from '../shared/errors/app-error.js';

export function errorMiddleware(logger, environment) {
  return (error, req, res, _next) => {
    const known = error instanceof AppError;
    logger[known && error.status < 500 ? 'warn' : 'error']({
      event: 'request.error',
      requestId: req.requestId,
      code: error.code,
      error: error.message,
      stack: environment === 'production' ? undefined : error.stack,
    });
    res.status(known ? error.status : 500).json({
      error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Ocurrió un error interno.',
        ...(known && error.details ? { details: error.details } : {}),
        requestId: req.requestId,
      },
    });
  };
}
