export function EmptyState({ title = 'Sin resultados', description }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
