export async function fetchHealth(signal) {
  const response = await fetch('/api/health', { credentials: 'include', signal });
  if (!response.ok) throw new Error('Health check failed');
  return (await response.json()).data;
}

export function watchConnectivity(callback, intervalMs = 10_000) {
  let timer;
  let controller;
  const check = async () => {
    controller = new AbortController();
    try {
      callback(await fetchHealth(controller.signal));
    } catch {
      callback(null);
    }
    timer = setTimeout(check, intervalMs);
  };
  check();
  return () => {
    clearTimeout(timer);
    controller?.abort();
  };
}
