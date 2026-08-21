import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Table } from '../components/ui/Table.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
const PAGE_SIZE = 20;
export function AuditPage() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ action: '', userId: '' });
  const load = (targetPage = page, values = filters) => {
    const query = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
    Object.entries(values).forEach(([key, value]) => value.trim() && query.set(key, value.trim()));
    return api(`/audit?${query}`).then((data) => {
      setItems(data.items);
      setTotal(data.pagination.total);
    });
  };
  useEffect(() => {
    load(1, { action: '', userId: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <PageHeader title="Auditoría" description="Registro inmutable de acciones críticas." />
      <Card className="mb-5">
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            load(1);
          }}
        >
          <Input
            label="Acción"
            value={filters.action}
            onChange={(event) => setFilters({ ...filters, action: event.target.value })}
          />
          <Input
            label="ID de usuario"
            value={filters.userId}
            onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
          />
          <div className="flex items-end gap-2">
            <Button>Filtrar</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const empty = { action: '', userId: '' };
                setFilters(empty);
                setPage(1);
                load(1, empty);
              }}
            >
              Limpiar
            </Button>
          </div>
        </form>
      </Card>
      <Table
        headers={['Fecha', 'Acción', 'Entidad', 'Usuario', 'Request ID', 'Operation ID']}
        empty={!items.length}
      >
        {items.map((item) => (
          <tr key={item._id}>
            <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString()}</td>
            <td className="px-4 py-3 font-semibold">{item.action}</td>
            <td className="px-4 py-3">{item.entity}</td>
            <td className="px-4 py-3 font-mono text-xs">{item.userId}</td>
            <td className="px-4 py-3 font-mono text-xs">{item.requestId}</td>
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
          load(nextPage);
        }}
      />
    </>
  );
}
