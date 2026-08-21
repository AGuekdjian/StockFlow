export function Alert({ children, tone = 'error' }) {
  return (
    <div
      role="alert"
      className={`rounded-md border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}
    >
      {children}
    </div>
  );
}
