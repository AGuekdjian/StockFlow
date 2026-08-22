import { describe, expect, it } from 'vitest';
import { pageLoaders, preloadRoute } from '../src/routes/pageLoaders.js';

const expectedExports = {
  login: 'LoginPage',
  dashboard: 'DashboardPage',
  movement: 'MovementPage',
  products: 'ProductsPage',
  movements: 'MovementsPage',
  users: 'UsersPage',
  catalogs: 'CatalogsPage',
  system: 'SystemOperationsPage',
};

describe('lazy route modules', () => {
  it('loads every route chunk with its expected component export', async () => {
    const entries = await Promise.all(
      Object.entries(pageLoaders).map(async ([name, load]) => [name, await load()]),
    );
    for (const [name, module] of entries) {
      expect(module[expectedExports[name]]).toBeTypeOf('function');
    }
  });

  it('allows intent preloading for known routes and ignores unknown routes', () => {
    expect(() => preloadRoute('/productos')).not.toThrow();
    expect(() => preloadRoute('/ruta-inexistente')).not.toThrow();
  });
});
