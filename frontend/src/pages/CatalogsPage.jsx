import { useEffect, useState } from 'react';
import { api, apiLatest, invalidateApi, json } from '../services/api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';

function EntityPanel({ title, endpoint, codeLabel = 'Código' }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', code: '' });
  const [error, setError] = useState();
  const [pending, setPending] = useState();
  const requestKey = `catalog-${endpoint}`;
  const load = () => apiLatest(requestKey, endpoint).then((data) => data && setItems(data.items));
  useEffect(() => {
    load();
    return () => invalidateApi(requestKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, requestKey]);
  async function create(event) {
    event.preventDefault();
    setError();
    try {
      await api(endpoint, { method: 'POST', body: json(form) });
      setForm({ name: '', code: '' });
      load();
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function changeStatus() {
    await api(`${endpoint}/${pending._id}/status`, {
      method: 'PATCH',
      body: json({ active: !pending.active }),
    });
    setPending(null);
    load();
  }
  return (
    <Card>
      <h2 className="text-lg font-bold">{title}</h2>
      <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
        {error && (
          <div className="sm:col-span-3">
            <Alert>{error}</Alert>
          </div>
        )}
        <Input
          label="Nombre"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          label={codeLabel}
          required
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
        />
        <div className="flex items-end">
          <Button>Agregar</Button>
        </div>
      </form>
      <div className="mt-5 divide-y divide-slate-100">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-3 py-3" key={item._id}>
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="font-mono text-xs text-slate-500">{item.code}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={item.active ? 'success' : 'neutral'}>
                {item.active ? 'Activo' : 'Archivado'}
              </Badge>
              <Button variant="quiet" onClick={() => setPending(item)}>
                {item.active ? 'Archivar' : 'Reactivar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.active ? `Archivar ${title.toLowerCase()}` : `Reactivar ${title.toLowerCase()}`
        }
        message="Las referencias históricas se conservarán y no se eliminará información."
        confirmLabel={pending?.active ? 'Archivar' : 'Reactivar'}
        danger={pending?.active}
        onConfirm={changeStatus}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}

export function CatalogsPage() {
  return (
    <>
      <PageHeader
        title="Categorías y ubicaciones"
        description="Maestros archivables utilizados por el catálogo de productos."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <EntityPanel title="Categorías" endpoint="/categories" codeLabel="Prefijo" />
        <EntityPanel title="Ubicaciones" endpoint="/locations" />
      </div>
    </>
  );
}
