import { browserOutbox } from '../offline/indexedDb.js';

async function send(payload) {
  const response = await fetch('/api/inventory/movements', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error?.message ?? 'No se pudo registrar la operación');
    error.code = body.error?.code;
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export async function submitMovement(payload) {
  await browserOutbox.put({
    operationId: payload.operationId,
    payload,
    createdAt: new Date().toISOString(),
  });
  try {
    const result = await send(payload);
    await browserOutbox.remove(payload.operationId);
    return result;
  } catch (error) {
    if (
      error instanceof TypeError ||
      error.status >= 500 ||
      error.status === 429 ||
      error.status === 401
    )
      error.pendingInBrowser = true;
    else await browserOutbox.remove(payload.operationId);
    throw error;
  }
}

export async function replayBrowserOutbox() {
  const pending = await browserOutbox.all();
  for (const item of pending) {
    try {
      await send(item.payload);
      await browserOutbox.remove(item.operationId);
    } catch (error) {
      if (error instanceof TypeError || error.status >= 500 || [401, 429].includes(error.status))
        break;
      await browserOutbox.remove(item.operationId);
    }
  }
}
