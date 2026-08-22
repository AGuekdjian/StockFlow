export function normalizeScannedCode(value) {
  return String(value ?? '')
    .trim()
    .replace(/^SN\s*[:>]\s*/i, '')
    .trim();
}
