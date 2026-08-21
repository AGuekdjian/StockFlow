import { AppError } from '../shared/errors/app-error.js';
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success)
      return next(
        new AppError({
          code: 'VALIDATION_ERROR',
          message: 'La solicitud contiene datos inválidos.',
          status: 400,
          details: result.error.flatten(),
        }),
      );
    if (source === 'query')
      Object.defineProperty(req, 'query', { value: result.data, configurable: true });
    else req[source] = result.data;
    return next();
  };
}
