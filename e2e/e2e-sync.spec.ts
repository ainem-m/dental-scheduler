import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

// Hardcoded config values from the app to calculate click coordinates
const config = {
  columns: 6,
  startHour: 9,
  endHour: 18,
  timeSlotInterval: 30,
  headerHeight: 50,
  timeColumnWidth: 80,
};

// Helper to calculate canvas coordinates from a time and column
async function getCellCoordinates(page, timeString, columnIndex) {
  const canvasBoundingBox = await page.locator('canvas').boundingBox();
  if (!canvasBoundingBox) {
    throw new Error('Canvas not found');
  }

  const canvasWidth = canvasBoundingBox.width;
  const canvasHeight = canvasBoundingBox.height;

  const totalSlots = ((config.endHour - config.startHour) * 60) / config.timeSlotInterval;
  const cellWidth = (canvasWidth - config.timeColumnWidth) / config.columns;
  const cellHeight = (canvasHeight - config.headerHeight) / totalSlots;

  const [hours, minutes] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const timeSlotIndex = (totalMinutes - config.startHour * 60) / config.timeSlotInterval;

  const x = config.timeColumnWidth + columnIndex * cellWidth + cellWidth / 2;
  const y = config.headerHeight + timeSlotIndex * cellHeight + cellHeight / 2;

  return { x, y };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test('複数端末リアルタイム同期', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await a.goto(APP_URL, { waitUntil: 'networkidle' });
  await b.goto(APP_URL, { waitUntil: 'networkidle' });

  const { x, y } = await getCellCoordinates(a, '09:30', 1);
  await a.locator('canvas').click({ position: { x, y } });

  const modal = a.locator('.modal-content');
  await expect(modal).toBeVisible({ timeout: 10000 });
  await modal.getByLabel('患者名').fill('田中');
  await modal.getByRole('button', { name: '保存' }).click();
  await expect(modal).not.toBeVisible();

  await expect(b.locator('canvas')).toHaveScreenshot('sync-create.png', { timeout: 10000 });
});

test('予約の編集が複数端末で同期される', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await a.goto(APP_URL, { waitUntil: 'networkidle' });
  await b.goto(APP_URL, { waitUntil: 'networkidle' });

  const coords = await getCellCoordinates(a, '10:00', 2);
  await a.locator('canvas').click({ position: { x: coords.x, y: coords.y } });
  const modal = a.locator('.modal-content');
  await expect(modal).toBeVisible();
  await modal.getByLabel('患者名').fill('編集前患者');
  await modal.getByRole('button', { name: '保存' }).click();
  await expect(modal).not.toBeVisible();

  await expect(b.locator('canvas')).toHaveScreenshot('sync-edit-before.png', { timeout: 10000 });

  await a.locator('canvas').click({ position: { x: coords.x, y: coords.y } });
  await expect(modal).toBeVisible();
  await modal.getByLabel('患者名').fill('編集後患者');
  await modal.getByRole('button', { name: '保存' }).click();
  await expect(modal).not.toBeVisible();

  await expect(b.locator('canvas')).toHaveScreenshot('sync-edit-after.png', { timeout: 10000 });
});

test('予約の削除が複数端末で同期される', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  // Handle the confirm dialog automatically
  a.on('dialog', dialog => dialog.accept());

  await a.goto(APP_URL, { waitUntil: 'networkidle' });
  await b.goto(APP_URL, { waitUntil: 'networkidle' });

  const coords = await getCellCoordinates(a, '11:00', 3);
  await a.locator('canvas').click({ position: { x: coords.x, y: coords.y } });
  const modal = a.locator('.modal-content');
  await expect(modal).toBeVisible();
  await modal.getByLabel('患者名').fill('削除対象患者');
  await modal.getByRole('button', { name: '保存' }).click();
  await expect(modal).not.toBeVisible();

  await expect(b.locator('canvas')).toHaveScreenshot('sync-delete-before.png', { timeout: 10000 });

  await a.locator('canvas').click({ position: { x: coords.x, y: coords.y } });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: '削除' }).click();
  await expect(modal).not.toBeVisible();

  await expect(b.locator('canvas')).toHaveScreenshot('sync-delete-after.png', { timeout: 10000 });
});
