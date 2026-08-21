export function Select({ label, children, id, ...props }) {
  const inputId = id ?? props.name;
  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
      {label && <span className="mb-1.5 block">{label}</span>}
      <select
        id={inputId}
        className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
