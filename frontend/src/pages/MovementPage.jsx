import { useState } from 'react';
import { submitMovement } from '../services/inventory.js';
import { lookupProduct } from '../services/products.js';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
const reasons = ['Instalación', 'Mantenimiento', 'Service', 'Préstamo', 'Uso interno', 'Otro'];
const titles = { OUT: 'Registrar salida', IN: 'Registrar entrada', RETURN: 'Registrar devolución' };
export function MovementPage({ type, embedded = false }) {
  const [product, setProduct] = useState();
  const [form, setForm] = useState({
    quantity: 1,
    reason: type === 'OUT' ? 'Instalación' : '',
    client: '',
    jobNumber: '',
    observation: '',
    serialNumbers: '',
  });
  const [message, setMessage] = useState();
  const [busy, setBusy] = useState(false);
  async function scan(code) {
    setMessage();
    try {
      const result = await lookupProduct(code);
      setProduct(result.product);
      if (result.cached)
        setMessage({
          success:
            'Producto recuperado del caché local; el stock mostrado puede estar desactualizado.',
        });
    } catch (error) {
      setProduct(null);
      setMessage({ error: error.message });
    }
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage();
    try {
      const result = await submitMovement({
        operationId: crypto.randomUUID(),
        productId: product._id,
        type,
        quantity: Number(form.quantity),
        reason: form.reason,
        ...(form.client && { client: form.client }),
        ...(form.jobNumber && { jobNumber: form.jobNumber }),
        ...(form.observation && { observation: form.observation }),
        ...(product.serializable && {
          serialNumbers: form.serialNumbers
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      setMessage({
        success:
          result.status === 'SYNCED'
            ? 'Movimiento confirmado.'
            : 'Movimiento guardado localmente; se sincronizará automáticamente.',
      });
      setProduct(null);
      setForm({
        quantity: 1,
        reason: type === 'OUT' ? 'Instalación' : '',
        client: '',
        jobNumber: '',
        observation: '',
        serialNumbers: '',
      });
    } catch (error) {
      setMessage({
        error: error.pendingInBrowser
          ? 'Servidor inaccesible. La operación quedó guardada en este navegador.'
          : error.message,
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!embedded && (
        <PageHeader
          title={titles[type]}
          description="Escaneá el producto y confirmá los datos del movimiento."
        />
      )}
      {message?.error && <Alert>{message.error}</Alert>}
      {message?.success && <Alert tone="info">{message.success}</Alert>}
      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <BarcodeScanner onScan={scan} disabled={busy} />
          <p className="mt-3 text-xs text-slate-500">
            El lector USB funciona como teclado. También podés escribir el código y presionar Enter.
          </p>
        </Card>
        <Card>
          {product ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-md bg-slate-50 p-4">
                <p className="font-bold">{product.name}</p>
                <p className="text-sm text-slate-600">
                  {product.internalCode} · Disponible: {product.stock}
                </p>
              </div>
              <Input
                name="quantity"
                label="Cantidad"
                type="number"
                min="1"
                step="1"
                required
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
              />
              {type === 'OUT' ? (
                <Select
                  name="reason"
                  label="Motivo"
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                >
                  {reasons.map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  name="reason"
                  label="Motivo"
                  required
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="client"
                  label="Cliente (opcional)"
                  value={form.client}
                  onChange={(event) => setForm({ ...form, client: event.target.value })}
                />
                <Input
                  name="jobNumber"
                  label="Trabajo (opcional)"
                  value={form.jobNumber}
                  onChange={(event) => setForm({ ...form, jobNumber: event.target.value })}
                />
              </div>
              <Input
                name="observation"
                label="Observación (opcional)"
                value={form.observation}
                onChange={(event) => setForm({ ...form, observation: event.target.value })}
              />
              {product.serializable && (
                <Input
                  name="serialNumbers"
                  label="Números de serie (uno por unidad, separados por coma)"
                  required
                  value={form.serialNumbers}
                  onChange={(event) => setForm({ ...form, serialNumbers: event.target.value })}
                />
              )}
              <Button disabled={busy}>{busy ? 'Guardando…' : 'Confirmar movimiento'}</Button>
            </form>
          ) : (
            <div className="py-14 text-center text-sm text-slate-500">
              Escaneá un producto para comenzar.
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
