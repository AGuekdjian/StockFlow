export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message ?? 'No se pudo completar la solicitud.');
    error.code = body.error?.code;
    error.details = body.error?.details;
    throw error;
  }
  return body.data;
}
export const json = (value) => JSON.stringify(value);
