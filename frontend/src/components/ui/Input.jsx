import { forwardRef } from 'react';
export const Input = forwardRef(function Input(
  { label, error, id, className = '', ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <label className={`block text-sm font-medium text-slate-700 ${className}`} htmlFor={inputId}>
      {label && <span className="mb-1.5 block">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 placeholder:text-slate-400"
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} className="mt-1 block text-sm text-red-700">
          {error}
        </span>
      )}
    </label>
  );
});
