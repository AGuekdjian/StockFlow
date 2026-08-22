import { memo, useEffect, useState } from 'react';
import { api, apiLatest, invalidateApi, json } from '../services/api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Table } from '../components/ui/Table.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { Modal } from '../components/ui/Modal.jsx';
const PAGE_SIZE = 20;
const UserRow = memo(function UserRow({ item, currentUserId, onPassword, onStatus }) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium">{item.name}</td>
      <td className="px-4 py-3">{item.email}</td>
      <td className="px-4 py-3">{item.role}</td>
      <td className="px-4 py-3">
        <Badge tone={item.active ? 'success' : 'neutral'}>
          {item.active ? 'Activo' : 'Inactivo'}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <Button variant="quiet" onClick={() => onPassword(item)}>
            Cambiar contraseña
          </Button>
          {currentUserId !== String(item._id) && (
            <Button variant="quiet" onClick={() => onStatus(item)}>
              {item.active ? 'Desactivar' : 'Reactivar'}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
});
export function UsersPage() {
  const { user: current } = useAuth();
  const [items, setItems] = useState([]);
  const [show, setShow] = useState(false);
  const [error, setError] = useState();
  const [pendingStatus, setPendingStatus] = useState();
  const [pendingPassword, setPendingPassword] = useState();
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmation: '' });
  const [passwordError, setPasswordError] = useState();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TECHNICIAN' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const load = (targetPage = page) =>
    apiLatest('users-list', `/users?page=${targetPage}&limit=${PAGE_SIZE}`).then((data) => {
      if (!data) return;
      setItems(data.items);
      setTotal(data.pagination.total);
    });
  useEffect(() => {
    load(1);
    return () => invalidateApi('users-list');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function create(event) {
    event.preventDefault();
    try {
      await api('/users', { method: 'POST', body: json(form) });
      setShow(false);
      load();
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function confirmStatus() {
    const item = pendingStatus;
    await api(`/users/${item._id}/status`, {
      method: 'PATCH',
      body: json({ active: !item.active }),
    });
    setPendingStatus(null);
    load();
  }
  async function resetPassword() {
    setPasswordError();
    if (passwordForm.password !== passwordForm.confirmation) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    try {
      const result = await api(`/users/${pendingPassword._id}/password`, {
        method: 'PATCH',
        body: json({ password: passwordForm.password }),
      });
      setPendingPassword(null);
      setPasswordForm({ password: '', confirmation: '' });
      if (result.requiresLogin) window.location.assign('/login');
    } catch (reason) {
      setPasswordError(reason.message);
    }
  }
  function closePasswordModal() {
    setPendingPassword(null);
    setPasswordError();
    setPasswordForm({ password: '', confirmation: '' });
  }
  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Accesos y roles; los usuarios históricos no se eliminan."
        actions={
          <Button onClick={() => setShow(!show)}>{show ? 'Cancelar' : 'Nuevo usuario'}</Button>
        }
      />
      {show && (
        <Card className="mb-5">
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            {error && (
              <div className="sm:col-span-2">
                <Alert>{error}</Alert>
              </div>
            )}
            <Input
              label="Nombre"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Contraseña temporal"
              type="password"
              minLength="10"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Select
              label="Rol"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="TECHNICIAN">Técnico</option>
              <option value="ADMIN">Administrador</option>
            </Select>
            <div className="sm:col-span-2">
              <Button>Crear usuario</Button>
            </div>
          </form>
        </Card>
      )}
      <Table headers={['Nombre', 'Email', 'Rol', 'Estado', 'Acción']} empty={!items.length}>
        {items.map((item) => (
          <UserRow
            key={item._id}
            item={item}
            currentUserId={current.id}
            onPassword={setPendingPassword}
            onStatus={setPendingStatus}
          />
        ))}
      </Table>
      <Pagination
        page={page}
        limit={PAGE_SIZE}
        total={total}
        onChange={(nextPage) => {
          setPage(nextPage);
          load(nextPage);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={pendingStatus?.active ? 'Desactivar usuario' : 'Reactivar usuario'}
        message={
          pendingStatus
            ? `${pendingStatus.active ? 'Se cerrarán sus sesiones locales y no podrá iniciar sesión.' : 'El usuario podrá volver a iniciar sesión.'} Su historial se conserva.`
            : ''
        }
        confirmLabel={pendingStatus?.active ? 'Desactivar' : 'Reactivar'}
        danger={pendingStatus?.active}
        onConfirm={confirmStatus}
        onCancel={() => setPendingStatus(null)}
      />
      <Modal
        open={Boolean(pendingPassword)}
        title={`Cambiar contraseña${pendingPassword ? ` de ${pendingPassword.name}` : ''}`}
        onClose={closePasswordModal}
        actions={
          <>
            <Button variant="secondary" onClick={closePasswordModal}>
              Cancelar
            </Button>
            <Button
              disabled={passwordForm.password.length < 10 || !passwordForm.confirmation}
              onClick={resetPassword}
            >
              Guardar contraseña
            </Button>
          </>
        }
      >
        {passwordError && (
          <div className="mb-4">
            <Alert>{passwordError}</Alert>
          </div>
        )}
        <div className="grid gap-4">
          <Input
            label="Nueva contraseña"
            type="password"
            minLength="10"
            autoComplete="new-password"
            value={passwordForm.password}
            onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            minLength="10"
            autoComplete="new-password"
            value={passwordForm.confirmation}
            onChange={(event) =>
              setPasswordForm({ ...passwordForm, confirmation: event.target.value })
            }
          />
          <p className="text-xs text-slate-500">
            El cambio cerrará las sesiones activas de este usuario y quedará auditado.
          </p>
        </div>
      </Modal>
    </>
  );
}
