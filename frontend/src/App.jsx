import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { pageLoaders } from './routes/pageLoaders.js';

const LoginPage = lazy(() => pageLoaders.login().then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() =>
  pageLoaders.dashboard().then((module) => ({ default: module.DashboardPage })),
);
const MovementPage = lazy(() =>
  pageLoaders.movement().then((module) => ({ default: module.MovementPage })),
);
const ProductsPage = lazy(() =>
  pageLoaders.products().then((module) => ({ default: module.ProductsPage })),
);
const MovementsPage = lazy(() =>
  pageLoaders.movements().then((module) => ({ default: module.MovementsPage })),
);
const UsersPage = lazy(() => pageLoaders.users().then((module) => ({ default: module.UsersPage })));
const CatalogsPage = lazy(() =>
  pageLoaders.catalogs().then((module) => ({ default: module.CatalogsPage })),
);
const SystemOperationsPage = lazy(() =>
  pageLoaders.system().then((module) => ({ default: module.SystemOperationsPage })),
);

function RouteFallback() {
  return (
    <div className="grid min-h-[12rem] place-items-center text-sm text-slate-600" role="status">
      Cargando…
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-600">Cargando…</div>
    );
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}
function Admin({ children }) {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? children : <Navigate to="/salida" replace />;
}
export function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Protected />}>
            <Route index element={<DashboardPage />} />
            <Route path="salida" element={<MovementPage type="OUT" />} />
            <Route path="devolucion" element={<MovementPage type="RETURN" />} />
            <Route
              path="entrada"
              element={
                <Admin>
                  <MovementPage type="IN" />
                </Admin>
              }
            />
            <Route path="registro-stock" element={<Navigate to="/entrada" replace />} />
            <Route path="conteo" element={<Navigate to="/productos" replace />} />
            <Route path="productos" element={<ProductsPage />} />
            <Route
              path="catalogos"
              element={
                <Admin>
                  <CatalogsPage />
                </Admin>
              }
            />
            <Route path="movimientos" element={<MovementsPage />} />
            <Route
              path="usuarios"
              element={
                <Admin>
                  <UsersPage />
                </Admin>
              }
            />
            <Route
              path="sistema"
              element={
                <Admin>
                  <SystemOperationsPage />
                </Admin>
              }
            />
            <Route path="auditoria" element={<Navigate to="/sistema" replace />} />
            <Route path="sincronizacion" element={<Navigate to="/sistema" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
