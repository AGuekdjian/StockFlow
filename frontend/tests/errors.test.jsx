import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppErrorBoundary } from '../src/components/errors/AppErrorBoundary.jsx';
import { GlobalErrorNotice } from '../src/components/errors/GlobalErrorNotice.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('replaces an unexpected render crash with a recoverable page', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken() {
    throw new Error('sensitive internal detail');
  }
  render(
    <MemoryRouter>
      <AppErrorBoundary>
        <Broken />
      </AppErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'La aplicación encontró un problema' })).toBeVisible();
  expect(screen.queryByText('sensitive internal detail')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Intentar nuevamente' })).toBeVisible();
});

it('shows API errors with their support tracking code', () => {
  render(<GlobalErrorNotice />);
  fireEvent(
    window,
    new CustomEvent('stockflow:api-error', {
      detail: { message: 'No disponible', requestId: 'req_support' },
    }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent('No disponible');
  expect(screen.getByRole('alert')).toHaveTextContent('req_support');
});
