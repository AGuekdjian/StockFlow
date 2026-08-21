import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App.jsx';
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
});
