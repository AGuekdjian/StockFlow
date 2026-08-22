function notify(error) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent('stockflow:api-error', {
        detail: { message: error.message, code: error.code, requestId: error.requestId },
      }),
    );
  return error;
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      ...options,
      signal: options.signal ?? AbortSignal.timeout(15_000),
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (reason) {
    const error = new Error(
      reason.name === 'TimeoutError'
        ? 'El servidor demoró demasiado en responder. Intentá nuevamente.'
        : 'No se pudo conectar con el servidor. Verificá la conexión e intentá nuevamente.',
    );
    error.code = reason.name === 'TimeoutError' ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
    throw notify(error);
  }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message ?? 'No se pudo completar la solicitud.');
    error.code = body.error?.code;
    error.details = body.error?.details;
    error.requestId = body.error?.requestId ?? response.headers.get('x-request-id');
    error.status = response.status;
    throw notify(error);
  }
  return body.data;
}
export const json = (value) => JSON.stringify(value);

const latestRequests = new Map();
export async function apiLatest(key, path, options) {
  const generation = (latestRequests.get(key) ?? 0) + 1;
  latestRequests.set(key, generation);
  const result = await api(path, options);
  return latestRequests.get(key) === generation ? result : null;
}
export function invalidateApi(key) {
  latestRequests.set(key, (latestRequests.get(key) ?? 0) + 1);
}
