import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { MovementPage } from './MovementPage.jsx';
import { CountPage } from './CountPage.jsx';

export function StockRegistrationPage() {
  const [tab, setTab] = useState('entry');
  return (
    <>
      <PageHeader
        title="Registrar stock"
        description="Entradas y ajustes derivados de un conteo físico, siempre como movimientos auditables."
      />
      <div className="mb-5 flex gap-2" role="tablist" aria-label="Tipo de registro">
        <Button
          type="button"
          role="tab"
          aria-selected={tab === 'entry'}
          variant={tab === 'entry' ? 'primary' : 'secondary'}
          onClick={() => setTab('entry')}
        >
          Entrada
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === 'count'}
          variant={tab === 'count' ? 'primary' : 'secondary'}
          onClick={() => setTab('count')}
        >
          Conteo y ajuste
        </Button>
      </div>
      {tab === 'entry' ? <MovementPage type="IN" embedded /> : <CountPage embedded />}
    </>
  );
}
