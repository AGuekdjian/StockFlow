import { useEffect, useState } from 'react';

export function GlobalErrorNotice() {
  const [error, setError] = useState(null);
  useEffect(() => {
    const receive = (event) => setError(event.detail);
    window.addEventListener('stockflow:api-error', receive);
    return () => window.removeEventListener('stockflow:api-error', receive);
  }, []);
  if (!error) return null;
  return (
    <div
      className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-lg"
      role="alert"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold">No se pudo completar la operación</p>
          <p className="mt-1">{error.message}</p>
          {error.requestId && (
            <p className="mt-2 font-mono text-xs">Seguimiento: {error.requestId}</p>
          )}
        </div>
        <button
          type="button"
          className="font-semibold"
          onClick={() => setError(null)}
          aria-label="Cerrar error"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
