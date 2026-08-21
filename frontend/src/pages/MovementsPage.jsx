import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Table } from '../components/ui/Table.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
const PAGE_SIZE = 20;
export function MovementsPage() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    type: '',
    reason: '',
    client: '',
    productId: '',
    userId: '',
    operationId: '',
  });
  const load = (values = filters, targetPage = page) => {
    const query = new URLSearchParams({
      page: String(targetPage),
      limit: String(PAGE_SIZE),
      ...Object.fromEntries(Object.entries(values).filter(([, value]) => value)),
    });
    return api(`/inventory/movements?${query}`).then((data) => {
      setItems(data.items);
      setTotal(data.pagination.total);
    });
  };
  useEffect(() => {
    load(filters, 1);
    // Initial filters are intentionally stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <PageHeader
        title="Movimientos"
        description="Historial append-only de operaciones confirmadas."
      />
      <Card className="mb-5">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            load(filters, 1);
          }}
        >
          <Input
            label="Desde"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
          />
          <Input
            label="Hasta"
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
          />
          <Select
            label="Tipo"
            value={filters.type}
            onChange={(event) => setFilters({ ...filters, type: event.target.value })}
          >
            <option value="">Todos</option>
            {['IN', 'OUT', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </Select>
          <Input
            label="Motivo"
            value={filters.reason}
            onChange={(event) => setFilters({ ...filters, reason: event.target.value })}
          />
          <Input
            label="Cliente"
            value={filters.client}
            onChange={(event) => setFilters({ ...filters, client: event.target.value })}
          />
          <Input
            label="ID de producto"
            value={filters.productId}
            onChange={(event) => setFilters({ ...filters, productId: event.target.value })}
          />
          <Input
            label="ID de usuario"
            value={filters.userId}
            onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
          />
          <Input
            label="Operation ID"
            value={filters.operationId}
            onChange={(event) => setFilters({ ...filters, operationId: event.target.value })}
          />
          <div className="flex items-end gap-2">
            <Button>Filtrar</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const empty = {
                  dateFrom: '',
                  dateTo: '',
                  type: '',
                  reason: '',
                  client: '',
                  productId: '',
                  userId: '',
                  operationId: '',
                };
                setFilters(empty);
                setPage(1);
                load(empty, 1);
              }}
            >
              Limpiar
            </Button>
          </div>
        </form>
      </Card>
      <Table
        headers={[
          'Fecha',
          'Tipo',
          'Producto',
          'Cantidad',
          'Anterior',
          'Resultante',
          'Motivo',
          'Técnico / destino',
          'Estado',
          'Operation ID',
        ]}
        empty={!items.length}
      >
        {items.map((item) => (
          <tr key={item._id}>
            <td className="whitespace-nowrap px-4 py-3">
              {new Date(item.createdAt).toLocaleString()}
            </td>
            <td className="px-4 py-3">
              <Badge tone={item.type.includes('OUT') ? 'warning' : 'info'}>{item.type}</Badge>
            </td>
            <td className="px-4 py-3">
              <span className="font-medium">{item.productId?.name ?? 'Producto'}</span>
              <span className="block font-mono text-xs text-slate-500">
                {item.productId?.internalCode ?? String(item.productId)}
              </span>
            </td>
            <td className="px-4 py-3 font-bold">{item.quantity}</td>
            <td className="px-4 py-3">{item.stockBefore}</td>
            <td className="px-4 py-3">{item.stockAfter}</td>
            <td className="px-4 py-3">{item.reason}</td>
            <td className="px-4 py-3 text-sm">
              <span className="font-medium">{item.userId?.name ?? String(item.userId)}</span>
              {(item.client || item.job) && (
                <span className="block text-xs text-slate-500">
                  {[item.client, item.job].filter(Boolean).join(' · ')}
                </span>
              )}
            </td>
            <td className="px-4 py-3">
              <Badge tone="success">{item.syncStatus}</Badge>
            </td>
            <td className="px-4 py-3 font-mono text-xs">{item.operationId}</td>
          </tr>
        ))}
      </Table>
      <Pagination
        page={page}
        limit={PAGE_SIZE}
        total={total}
        onChange={(nextPage) => {
          setPage(nextPage);
          load(filters, nextPage);
        }}
      />
    </>
  );
}
