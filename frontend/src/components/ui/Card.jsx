export function Card({ children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-5 ${className}`}>
      {children}
    </section>
  );
}
