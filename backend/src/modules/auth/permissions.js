export const ROLES = Object.freeze({ ADMIN: 'ADMIN', TECHNICIAN: 'TECHNICIAN' });

export const PERMISSIONS = Object.freeze({
  PRODUCT_READ: 'product:read',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  STOCK_OUT: 'stock:out',
  STOCK_IN: 'stock:in',
  STOCK_RETURN: 'stock:return',
  STOCK_ADJUST: 'stock:adjust',
  MOVEMENT_READ_OWN: 'movement:read-own',
  MOVEMENT_READ_ALL: 'movement:read-all',
  USER_MANAGE: 'user:manage',
  AUDIT_READ: 'audit:read',
  SYSTEM_READ: 'system:read',
});

const technician = [
  PERMISSIONS.PRODUCT_READ,
  PERMISSIONS.STOCK_OUT,
  PERMISSIONS.STOCK_RETURN,
  PERMISSIONS.MOVEMENT_READ_OWN,
];
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.TECHNICIAN]: new Set(technician),
  [ROLES.ADMIN]: new Set(Object.values(PERMISSIONS)),
});

export function roleHasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
