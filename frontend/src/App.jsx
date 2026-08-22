import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { MovementPage } from './pages/MovementPage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { MovementsPage } from './pages/MovementsPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { CatalogsPage } from './pages/CatalogsPage.jsx';
import { StockRegistrationPage } from './pages/StockRegistrationPage.jsx';
import { SystemOperationsPage } from './pages/SystemOperationsPage.jsx';

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
            path="registro-stock"
            element={
              <Admin>
                <StockRegistrationPage />
              </Admin>
            }
          />
          <Route path="entrada" element={<Navigate to="/registro-stock" replace />} />
          <Route path="conteo" element={<Navigate to="/registro-stock" replace />} />
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
    </AuthProvider>
  );
}
