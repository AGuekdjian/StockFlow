import { useEffect, useRef, useState } from 'react';
import { Input } from '../ui/Input.jsx';
import { normalizeScannedCode } from '@stock-control/shared/code-normalization';

export function BarcodeScanner({ onScan, disabled }) {
  const [value, setValue] = useState('');
  const input = useRef(null);
  const last = useRef({ code: '', at: 0 });
  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled]);
  function submit(event) {
    event.preventDefault();
    const code = normalizeScannedCode(value);
    const now = Date.now();
    if (!code || (last.current.code === code && now - last.current.at < 1000)) return;
    last.current = { code, at: now };
    setValue('');
    onScan(code);
    requestAnimationFrame(() => input.current?.focus());
  }
  return (
    <form onSubmit={submit}>
      <Input
        ref={input}
        id="barcode-scanner"
        label="Escanear código"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        autoComplete="off"
        placeholder="Código interno o barcode"
      />
      <button type="submit" className="sr-only">
        Buscar
      </button>
    </form>
  );
}
