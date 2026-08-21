import { useState } from 'react';
import { api } from '../services/api.js';
import { submitMovement } from '../services/inventory.js';
import { BarcodeScanner } from '../components/scanner/BarcodeScanner.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
export function CountPage() {
  const [product, setProduct] = useState();
  const [physical, setPhysical] = useState('');
  const [reason, setReason] = useState('Conteo físico');
  const [message, setMessage] = useState();
  async function scan(code) {
    try {
      setProduct((await api(`/products/lookup/${encodeURIComponent(code)}`)).product);
      setMessage();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function submit(event) {
    event.preventDefault();
    const difference = Number(physical) - product.stock;
    if (!difference) {
      setMessage('El conteo coincide; no se generó ningún movimiento.');
      return;
    }
    try {
      await submitMovement({
        operationId: crypto.randomUUID(),
        productId: product._id,
        type: difference > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        quantity: Math.abs(difference),
        reason,
        expectedStock: product.stock,
      });
      setMessage('Ajuste de conteo registrado.');
      setProduct();
      setPhysical('');
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <>
      <PageHeader
        title="Conteo físico"
        description="Toda diferencia genera un movimiento de ajuste auditable."
      />
      {message && <Alert tone="info">{message}</Alert>}
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <Card>
          <BarcodeScanner onScan={scan} />
        </Card>
        <Card>
          {product ? (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <strong>{product.name}</strong>
                <p className="text-sm text-slate-600">Stock del sistema: {product.stock}</p>
              </div>
              <Input
                label="Cantidad física"
                type="number"
                min="0"
                required
                value={physical}
                onChange={(e) => setPhysical(e.target.value)}
              />
              <Input
                label="Motivo"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button>Confirmar conteo</Button>
            </form>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">Escaneá un producto.</p>
          )}
        </Card>
      </div>
    </>
  );
}
