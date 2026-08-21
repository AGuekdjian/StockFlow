import { AppError } from '../shared/errors/app-error.js';
import { roleHasPermission } from '../modules/auth/permissions.js';
export function requirePermission(permission) {
  return (req, _res, next) =>
    roleHasPermission(req.user?.role, permission)
      ? next()
      : next(
          new AppError({
            code: 'FORBIDDEN',
            message: 'No tenés permiso para realizar esta acción.',
            status: 403,
          }),
        );
}
