import { useEffect, useRef } from 'react';
export function Modal({ open, title, children, onClose, actions }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="modal-title"
      className="w-[min(32rem,calc(100%-2rem))] rounded-lg border-0 p-0 shadow-xl backdrop:bg-slate-950/50"
    >
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded p-2 text-slate-600 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        {children}
        {actions && <div className="mt-6 flex justify-end gap-3">{actions}</div>}
      </div>
    </dialog>
  );
}
