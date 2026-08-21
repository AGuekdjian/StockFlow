import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { ConnectivityStatus } from './ConnectivityStatus.jsx';
const allLinks = [
  { to: '/', label: 'Resumen' },
  { to: '/salida', label: 'Registrar salida' },
  { to: '/devolucion', label: 'Registrar devolución' },
  { to: '/entrada', label: 'Registrar entrada', admin: true },
  { to: '/productos', label: 'Productos' },
  { to: '/catalogos', label: 'Categorías y ubicaciones', admin: true },
  { to: '/movimientos', label: 'Movimientos' },
  { to: '/conteo', label: 'Conteo físico', admin: true },
  { to: '/usuarios', label: 'Usuarios', admin: true },
  { to: '/auditoria', label: 'Auditoría', admin: true },
  { to: '/sincronizacion', label: 'Sincronización', admin: true },
];
export function AppLayout() {
  const { user, logout } = useAuth();
  const links = allLinks.filter((link) => !link.admin || user.role === 'ADMIN');
  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950 text-slate-100 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center border-b border-slate-800 px-5 font-bold">
          Control de stock
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto p-3 lg:block">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
          <ConnectivityStatus />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user.name}</span>
            <button onClick={logout} className="font-semibold text-slate-700 hover:text-slate-950">
              Cerrar sesión
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
