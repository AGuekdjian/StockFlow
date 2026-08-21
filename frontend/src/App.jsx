import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { MovementPage } from './pages/MovementPage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { MovementsPage } from './pages/MovementsPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { AuditPage } from './pages/AuditPage.jsx';
import { SyncPage } from './pages/SyncPage.jsx';
import { CountPage } from './pages/CountPage.jsx';
import { CatalogsPage } from './pages/CatalogsPage.jsx';

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
            path="conteo"
            element={
              <Admin>
                <CountPage />
              </Admin>
            }
          />
          <Route
            path="usuarios"
            element={
              <Admin>
                <UsersPage />
              </Admin>
            }
          />
          <Route
            path="auditoria"
            element={
              <Admin>
                <AuditPage />
              </Admin>
            }
          />
          <Route
            path="sincronizacion"
            element={
              <Admin>
                <SyncPage />
              </Admin>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
