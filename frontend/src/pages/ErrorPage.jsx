import { Link } from 'react-router-dom';
import { PRODUCT } from '../config/product.js';
import { ProductFooter } from '../components/layout/ProductFooter.jsx';

export function ErrorPage({
  status = 'Error',
  title = 'No pudimos mostrar esta página',
  message = 'Ocurrió un error inesperado. Podés volver a intentar o regresar al inicio.',
  requestId,
  onRetry,
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <main className="grid flex-1 place-items-center p-5">
        <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-blue-700">
            {PRODUCT.name} · {status}
          </p>
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
          {requestId && (
            <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
              Código de seguimiento: {requestId}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Intentar nuevamente
              </button>
            )}
            <Link
              to="/"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
      <ProductFooter />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorPage
      status="404"
      title="Página no encontrada"
      message="La dirección ingresada no existe o fue movida. Revisá el enlace o regresá al inicio."
    />
  );
}
