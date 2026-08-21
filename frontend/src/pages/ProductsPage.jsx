import { useEffect, useState } from 'react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { api, json } from '../services/api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Table } from '../components/ui/Table.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { cacheProducts } from '../services/products.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
const PAGE_SIZE = 20;
const emptyForm = {
  internalCode: '',
  barcodes: '',
  name: '',
  brand: '',
  model: '',
  categoryId: '',
  locationId: '',
  minimumStock: 0,
  serializable: false,
};

export function ProductsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [refs, setRefs] = useState({ categories: [], locations: [] });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState();
  const [pendingStatus, setPendingStatus] = useState();
  const [editingId, setEditingId] = useState();
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const load = (targetPage = page, targetSearch = search) => {
    const query = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
    if (targetSearch.trim()) query.set('search', targetSearch.trim());
    return api(`/products?${query}`).then((data) => {
      setItems(data.items);
      setTotal(data.pagination.total);
      cacheProducts(data.items);
    });
  };
  useEffect(() => {
    load(1, '');
    Promise.all([api('/categories'), api('/locations')]).then(([categories, locations]) =>
      setRefs({ categories: categories.items, locations: locations.items }),
    );
    // Initial query and references are intentionally loaded once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function save(event) {
    event.preventDefault();
    setError();
    try {
      const payload = {
        ...form,
        barcodes: form.barcodes
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        minimumStock: Number(form.minimumStock),
      };
      if (editingId) delete payload.internalCode;
      await api(editingId ? `/products/${editingId}` : '/products', {
        method: editingId ? 'PATCH' : 'POST',
        body: json(payload),
      });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (reason) {
      setError(reason.message);
    }
  }
  function edit(item) {
    setEditingId(item._id);
    setForm({
      internalCode: item.internalCode,
      barcodes: item.barcodes.join(', '),
      name: item.name,
      brand: item.brand ?? '',
      model: item.model ?? '',
      categoryId: String(item.categoryId),
      locationId: String(item.locationId),
      minimumStock: item.minimumStock,
      serializable: item.serializable,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }
  async function confirmStatus() {
    const item = pendingStatus;
    await api(`/products/${item._id}/status`, {
      method: 'PATCH',
      body: json({ active: !item.active }),
    });
    setPendingStatus(null);
    load();
  }
  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo, códigos y stock disponible."
        actions={
          user.role === 'ADMIN' && (
            <Button onClick={() => (showForm ? closeForm() : setShowForm(true))}>
              {showForm ? 'Cancelar' : 'Nuevo producto'}
            </Button>
          )
        }
      />
      <Card className="mb-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            load(1);
          }}
        >
          <div className="flex-1">
            <Input
              label="Buscar producto"
              placeholder="Código, barcode, nombre, marca o modelo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button>Buscar</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearch('');
              setPage(1);
              load(1, '');
            }}
          >
            Limpiar
          </Button>
        </form>
      </Card>
      {showForm && (
        <Card className="mb-5">
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {error && (
              <div className="sm:col-span-2 lg:col-span-3">
                <Alert>{error}</Alert>
              </div>
            )}
            <Input
              label="Código interno"
              required
              disabled={Boolean(editingId)}
              value={form.internalCode}
              onChange={(e) => setForm({ ...form, internalCode: e.target.value })}
            />
            <Input
              label="Nombre"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Barcodes (separados por coma)"
              value={form.barcodes}
              onChange={(e) => setForm({ ...form, barcodes: e.target.value })}
            />
            <Input
              label="Marca"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
            <Input
              label="Modelo"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
            <Input
              label="Stock mínimo"
              type="number"
              min="0"
              value={form.minimumStock}
              onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
            />
            <Select
              label="Categoría"
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">Seleccionar</option>
              {refs.categories
                .filter((item) => item.active)
                .map((item) => (
                  <option value={item._id} key={item._id}>
                    {item.name}
                  </option>
                ))}
            </Select>
            <Select
              label="Ubicación"
              required
              value={form.locationId}
              onChange={(e) => setForm({ ...form, locationId: e.target.value })}
            >
              <option value="">Seleccionar</option>
              {refs.locations
                .filter((item) => item.active)
                .map((item) => (
                  <option value={item._id} key={item._id}>
                    {item.code} · {item.name}
                  </option>
                ))}
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.serializable}
                onChange={(e) => setForm({ ...form, serializable: e.target.checked })}
              />{' '}
              Requiere número de serie
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button>{editingId ? 'Guardar cambios' : 'Crear producto'}</Button>
            </div>
          </form>
        </Card>
      )}
      <Table
        headers={['Código', 'Producto', 'Stock', 'Mínimo', 'Estado', 'Acción']}
        empty={!items.length}
      >
        {items.map((item) => (
          <tr key={item._id}>
            <td className="px-4 py-3 font-mono text-xs">{item.internalCode}</td>
            <td className="px-4 py-3 font-medium">{item.name}</td>
            <td className="px-4 py-3 font-bold">{item.stock}</td>
            <td className="px-4 py-3">{item.minimumStock}</td>
            <td className="px-4 py-3">
              <Badge tone={item.active ? 'success' : 'neutral'}>
                {item.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </td>
            <td className="px-4 py-3">
              {user.role === 'ADMIN' && (
                <div className="flex gap-1">
                  <Button variant="quiet" onClick={() => edit(item)}>
                    Editar
                  </Button>
                  <Button variant="quiet" onClick={() => setPendingStatus(item)}>
                    {item.active ? 'Desactivar' : 'Reactivar'}
                  </Button>
                </div>
              )}
            </td>
          </tr>
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
        title={pendingStatus?.active ? 'Desactivar producto' : 'Reactivar producto'}
        message={
          pendingStatus
            ? `${pendingStatus.active ? 'Se impedirá registrar nuevos movimientos para' : 'Se volverá a habilitar'} ${pendingStatus.name}. Su historial se conserva.`
            : ''
        }
        confirmLabel={pendingStatus?.active ? 'Desactivar' : 'Reactivar'}
        danger={pendingStatus?.active}
        onConfirm={confirmStatus}
        onCancel={() => setPendingStatus(null)}
      />
    </>
  );
}
