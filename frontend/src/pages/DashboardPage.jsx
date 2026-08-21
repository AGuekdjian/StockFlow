import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Card } from '../components/ui/Card.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState();
  useEffect(() => {
    api('/dashboard').then(setData);
  }, []);
  const metrics = [
    ['Salidas hoy', data?.outputsToday],
    ['Entradas hoy', data?.inputsToday],
    ['Stock bajo', data?.lowStock],
    ['Sin stock', data?.outOfStock],
  ];
  return (
    <>
      <PageHeader
        title="Resumen operacional"
        description="Estado actual del depósito y la sincronización."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value ?? '—'}</p>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Accesos rápidos</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Nueva salida rápida', '/salida'],
          ...(user.role === 'ADMIN' ? [['Nueva entrada rápida', '/entrada']] : []),
          ['Escanear producto', '/scanner'],
          ['Ver movimientos', '/movimientos'],
          ...(user.role === 'ADMIN'
            ? [
                ['Conteo físico', '/conteo'],
                ['Revisar sincronización', '/sincronizacion'],
              ]
            : []),
        ].map(([label, href]) => (
          <Link
            key={href}
            to={href}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {label}
          </Link>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Últimos movimientos</h2>
      <Card>
        {data?.latest?.length ? (
          data.latest.map((item) => (
            <div
              className="flex justify-between border-b border-slate-100 py-3 last:border-0"
              key={item._id}
            >
              <span>
                {item.productId?.name ?? 'Producto'} · {item.type}
              </span>
              <strong>{item.quantity}</strong>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Todavía no hay movimientos confirmados.</p>
        )}
      </Card>
    </>
  );
}
