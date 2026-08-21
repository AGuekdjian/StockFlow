import { Button } from './Button.jsx';
export function Pagination({ page, limit, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-slate-600">
        Página {page} de {pages} · {total} resultados
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
