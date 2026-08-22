import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App.jsx';
import { PRODUCT } from '../src/config/product.js';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('shows the accessible login form when there is no active session', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    }),
  );
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  expect(screen.getByRole('contentinfo')).toHaveTextContent(`${PRODUCT.name} v${PRODUCT.version}`);
});

it('shows a real not-found page instead of silently redirecting', async () => {
  vi.stubGlobal('fetch', vi.fn());
  render(
    <MemoryRouter initialEntries={['/does-not-exist']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeInTheDocument();
});
