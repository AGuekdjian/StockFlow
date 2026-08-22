export const pageLoaders = {
  login: () => import('../pages/LoginPage.jsx'),
  dashboard: () => import('../pages/DashboardPage.jsx'),
  movement: () => import('../pages/MovementPage.jsx'),
  products: () => import('../pages/ProductsPage.jsx'),
  movements: () => import('../pages/MovementsPage.jsx'),
  users: () => import('../pages/UsersPage.jsx'),
  catalogs: () => import('../pages/CatalogsPage.jsx'),
  system: () => import('../pages/SystemOperationsPage.jsx'),
};

const routeModules = {
  '/': 'dashboard',
  '/login': 'login',
  '/salida': 'movement',
  '/devolucion': 'movement',
  '/entrada': 'movement',
  '/productos': 'products',
  '/movimientos': 'movements',
  '/usuarios': 'users',
  '/catalogos': 'catalogs',
  '/sistema': 'system',
};

export function preloadRoute(path) {
  const moduleName = routeModules[path];
  if (moduleName) void pageLoaders[moduleName]();
}
