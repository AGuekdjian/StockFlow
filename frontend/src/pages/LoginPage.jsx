import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { ProductFooter } from '../components/layout/ProductFooter.jsx';
export function LoginPage() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <main className="grid flex-1 place-items-center p-5">
        <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-7">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            Sistema interno
          </p>
          <h1 className="mt-2 text-2xl font-bold">Iniciar sesión</h1>
          <p className="mb-6 mt-1 text-sm text-slate-600">Ingresá con tu usuario asignado.</p>
          <div className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Input
              name="email"
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <Input
              name="password"
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <Button disabled={busy} className="w-full">
              {busy ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </div>
        </form>
      </main>
      <ProductFooter className="text-slate-400" />
    </div>
  );
}
