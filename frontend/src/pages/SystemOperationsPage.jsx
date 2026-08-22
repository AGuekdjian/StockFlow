import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { AuditPage } from './AuditPage.jsx';
import { SyncPage } from './SyncPage.jsx';

export function SystemOperationsPage() {
  const [tab, setTab] = useState('sync');
  return (
    <>
      <PageHeader
        title="Auditoría y sincronización"
        description="Trazabilidad de acciones, operaciones pendientes y resolución de conflictos."
      />
      <div className="mb-5 flex gap-2" role="tablist" aria-label="Operaciones del sistema">
        <Button
          type="button"
          role="tab"
          aria-selected={tab === 'sync'}
          variant={tab === 'sync' ? 'primary' : 'secondary'}
          onClick={() => setTab('sync')}
        >
          Sincronización
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === 'audit'}
          variant={tab === 'audit' ? 'primary' : 'secondary'}
          onClick={() => setTab('audit')}
        >
          Auditoría
        </Button>
      </div>
      {tab === 'sync' ? <SyncPage embedded /> : <AuditPage embedded />}
    </>
  );
}
