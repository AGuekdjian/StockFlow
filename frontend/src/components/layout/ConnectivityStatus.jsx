import { useEffect, useState } from 'react';
import { watchConnectivity } from '../../offline/connectivity.js';
import { replayBrowserOutbox } from '../../services/inventory.js';
import { Badge } from '../ui/Badge.jsx';
export function ConnectivityStatus() {
  const [health, setHealth] = useState();
  useEffect(
    () =>
      watchConnectivity((value) => {
        setHealth(value);
        if (value) replayBrowserOutbox();
      }),
    [],
  );
  if (!health) return <Badge tone="danger">Servidor no disponible</Badge>;
  const count = health.outbox.pending + health.outbox.syncing;
  if (health.mongodb === 'offline')
    return <Badge tone="warning">Atlas sin conexión · {count} pendientes</Badge>;
  if (health.outbox.conflicts)
    return <Badge tone="danger">{health.outbox.conflicts} conflictos</Badge>;
  return <Badge tone="success">Todo sincronizado</Badge>;
}
