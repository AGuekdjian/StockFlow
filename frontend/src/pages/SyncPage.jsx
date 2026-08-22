import { useEffect, useState } from 'react';
import { api, json } from '../services/api.js';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Table } from '../components/ui/Table.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { Select } from '../components/ui/Select.jsx';
const PAGE_SIZE = 20;
const tone = {
  SYNCED: 'success',
  PENDING: 'warning',
  SYNCING: 'info',
  FAILED: 'danger',
  CONFLICT: 'danger',
};
export function SyncPage({ embedded = false }) {
  const [items, setItems] = useState([]);
  const [pendingConflict, setPendingConflict] = useState();
  const [resolutionReason, setResolutionReason] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const load = (targetPage = page, targetStatus = status) => {
    const query = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
    if (targetStatus) query.set('status', targetStatus);
    return api(`/sync/operations?${query}`).then((data) => {
      setItems(data.items);
      setTotal(data.pagination.total);
    });
  };
  useEffect(() => {
    load(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function act(item) {
    if (item.status === 'FAILED')
      await api(`/sync/operations/${item.operationId}/retry`, { method: 'POST' });
    if (item.status === 'CONFLICT') {
      setPendingConflict(item);
      return;
    }
    load();
  }
  async function dismissConflict() {
    await api(`/sync/conflicts/${pendingConflict.operationId}/resolve`, {
      method: 'POST',
      body: json({ action: 'DISMISSED', reason: resolutionReason }),
    });
    setPendingConflict(null);
    setResolutionReason('');
    load();
  }
  return (
    <>
      {!embedded && (
        <PageHeader
          title="Sincronización"
          description="Operaciones locales, reintentos y conflictos que requieren decisión explícita."
        />
      )}
      <div className="mb-4 max-w-xs">
        <Select
          label="Estado"
          value={status}
          onChange={(event) => {
            const nextStatus = event.target.value;
            setStatus(nextStatus);
            setPage(1);
            load(1, nextStatus);
          }}
        >
          <option value="">Todos</option>
          {Object.keys(tone).map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </div>
      <Table
        headers={['Creada', 'Estado', 'Tipo', 'Operación', 'Intentos', 'Detalle', 'Acción']}
        empty={!items.length}
      >
        {items.map((item) => (
          <tr key={item.operationId}>
            <td className="px-4 py-3">{new Date(item.createdAt).toLocaleString()}</td>
            <td className="px-4 py-3">
              <Badge tone={tone[item.status]}>{item.status}</Badge>
            </td>
            <td className="px-4 py-3">{item.type}</td>
            <td className="px-4 py-3 font-mono text-xs">{item.operationId}</td>
            <td className="px-4 py-3">{item.attempts}</td>
            <td className="max-w-xs truncate px-4 py-3 text-xs">
              {item.lastError || item.resolution?.reason || '—'}
            </td>
            <td className="px-4 py-3">
              {!item.resolution && ['FAILED', 'CONFLICT'].includes(item.status) && (
                <Button variant="secondary" onClick={() => act(item)}>
                  {item.status === 'FAILED' ? 'Reintentar' : 'Descartar con motivo'}
                </Button>
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
      <Modal
        open={Boolean(pendingConflict)}
        title="Resolver conflicto"
        onClose={() => setPendingConflict(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingConflict(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={resolutionReason.trim().length < 3}
              onClick={dismissConflict}
            >
              Descartar intención
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-600">
          La intención original se conservará con esta decisión. Si corresponde ajustar stock,
          registrá después una nueva operación explícita.
        </p>
        <Input
          label="Motivo obligatorio"
          value={resolutionReason}
          onChange={(event) => setResolutionReason(event.target.value)}
        />
      </Modal>
    </>
  );
}
