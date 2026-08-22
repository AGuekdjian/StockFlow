import { PRODUCT } from '../../config/product.js';

export function ProductFooter({ className = '' }) {
  return (
    <footer className={`px-5 py-4 text-center text-xs text-slate-500 ${className}`}>
      <span className="font-semibold">{PRODUCT.name}</span> v{PRODUCT.version}
      <span aria-hidden="true"> · </span>
      <span>
        © {PRODUCT.copyrightYear} {PRODUCT.author}
      </span>
    </footer>
  );
}
