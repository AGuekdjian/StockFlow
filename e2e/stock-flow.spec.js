import { expect, test } from '@playwright/test';

async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test('admin registers an entry and sees the append-only movement', async ({ page }) => {
  await login(page, 'admin@example.com', 'Admin-password-123!');
  await expect(page.getByRole('heading', { name: 'Resumen operacional' })).toBeVisible();
  await page.getByRole('link', { name: 'Registrar entrada' }).click();
  await page.getByLabel('Escanear código').fill('779000000001');
  await page.getByLabel('Escanear código').press('Enter');
  await expect(page.getByText('Cámara IP de prueba')).toBeVisible();
  await page.getByLabel('Cantidad').fill('2');
  await page.getByLabel('Motivo').fill('Compra proveedor');
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click();
  await expect(page.getByText('Movimiento confirmado.')).toBeVisible();
  const historyResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/inventory/movements') && response.request().method() === 'GET',
  );
  await page.getByRole('link', { name: 'Movimientos' }).click();
  const response = await historyResponse;
  const history = await response.json();
  expect(response.ok(), JSON.stringify(history)).toBeTruthy();
  expect(history.data.items).toHaveLength(1);
  await expect(page.getByText('Compra proveedor')).toBeVisible();

  await page.getByRole('link', { name: 'Productos' }).click();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Código interno').fill('ACC-900001');
  await page.getByLabel('Nombre').fill('Accesorio E2E');
  await page.getByLabel('Categoría').selectOption({ index: 1 });
  await page.getByLabel('Ubicación').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Crear producto' }).click();
  const productRow = page.getByRole('row').filter({ hasText: 'ACC-900001' });
  await expect(productRow).toContainText('Accesorio E2E');
  await productRow.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Nombre').fill('Accesorio E2E actualizado');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  const updatedRow = page.getByRole('row').filter({ hasText: 'ACC-900001' });
  await expect(updatedRow).toContainText('actualizado');
  await updatedRow.getByRole('button', { name: 'Desactivar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'ACC-900001' })).toContainText('Inactivo');

  await page.getByRole('link', { name: 'Usuarios' }).click();
  const adminRow = page.getByRole('row').filter({ hasText: 'admin@example.com' });
  await adminRow.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await page.getByLabel('Nueva contraseña').fill('Admin-password-123!');
  await page.getByLabel('Confirmar contraseña').fill('Admin-password-123!');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
});

test('technician completes the fast OUT flow and cannot access admin pages', async ({ page }) => {
  await login(page, 'tecnico@example.com', 'Tech-password-123!');
  await expect(page.getByRole('link', { name: 'Registrar entrada' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Registrar salida' }).click();
  await page.getByLabel('Escanear código').fill('CAM-000001');
  await page.getByLabel('Escanear código').press('Enter');
  await page.getByLabel('Cantidad').fill('1');
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click();
  await expect(page.getByText('Movimiento confirmado.')).toBeVisible();
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/salida$/);
});
