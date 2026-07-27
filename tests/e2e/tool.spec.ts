import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const fixturePath = path.resolve(process.cwd(), 'tests', 'fixtures', 'transparent-local.gif');
const invalidPath = path.resolve(process.cwd(), 'tests', 'fixtures', 'not-a-gif.txt');

test.describe('GIF to frames tool', () => {
  test('loads a GIF, previews frames, selects a range, and exports PNG ZIP', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Extract complete frames from a GIF' })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    await expect(page.getByText('GIF decoded successfully.')).toBeVisible();
    await expect(page.getByText('3 frames composed at 12x10.')).toBeVisible();
    await expect(page.getByLabel('GIF details')).toContainText('12 x 10');
    await expect(page.getByLabel('GIF details')).toContainText('3');

    await page.getByTitle('Next frame').click();
    await expect(page.getByText('2 / 3 - 150 ms')).toBeVisible();
    await page.getByTitle('Previous frame').click();

    await page.getByPlaceholder('1-8, 12').fill('1-2');
    await page.getByRole('button', { name: /Select range/ }).click();
    await expect(page.getByText('2 of 3 frames selected.')).toBeVisible();

    const download = await downloadByClick(page, page.getByRole('button', { name: /Selected ZIP/ }));
    const zipBytes = fs.readFileSync(await download.path());
    const entries = unzipSync(new Uint8Array(zipBytes));
    const names = Object.keys(entries).sort();
    expect(names).toEqual(['transparent-local_frame_0001.png', 'transparent-local_frame_0002.png']);
    expect(entries[names[0]].byteLength).toBeGreaterThan(20);

    const firstPng = PNG.sync.read(Buffer.from(entries[names[0]]));
    expect(firstPng.width).toBe(12);
    expect(firstPng.height).toBe(10);
    expect(readRgba(firstPng.data, firstPng.width, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(readRgba(firstPng.data, firstPng.width, 2, 1)).toEqual([236, 72, 153, 255]);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(consoleErrors).toEqual([]);
  });

  test('exports current frame as PNG and JPEG with selected background', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    await expect(page.getByText('GIF decoded successfully.')).toBeVisible();

    const pngDownload = await downloadByClick(page, page.getByRole('button', { name: /Current frame/ }).first());
    const png = PNG.sync.read(fs.readFileSync(await pngDownload.path()));
    expect(png.width).toBe(12);
    expect(png.height).toBe(10);
    expect(readRgba(png.data, png.width, 0, 0)).toEqual([0, 0, 0, 0]);

    await page.getByLabel('Output format').selectOption('jpeg');
    await page.getByLabel('JPEG background color').evaluate((input) => {
      (input as HTMLInputElement).value = '#ffffff';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const jpegDownload = await downloadByClick(page, page.getByRole('button', { name: /Current frame/ }).first());
    const jpg = jpeg.decode(fs.readFileSync(await jpegDownload.path()), { useTArray: true });
    const background = readRgba(jpg.data, jpg.width, 0, 0);
    expect(background[0]).toBeGreaterThan(235);
    expect(background[1]).toBeGreaterThan(235);
    expect(background[2]).toBeGreaterThan(235);
    expect(jpg.width).toBe(12);
    expect(jpg.height).toBe(10);
  });

  test('shows invalid-file and reset states', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles(invalidPath);
    await expect(page.getByText('That file is not a GIF.')).toBeVisible();

    await page.getByRole('button', { name: /Reset/ }).click();
    await expect(page.getByText('Ready for another GIF.')).toBeVisible();
  });

  test('serves indexable support pages and static discovery files', async ({ page }) => {
    for (const url of ['/guide/', '/privacy/', '/terms/']) {
      await page.goto(url);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(`https://www.giftoframes.net${url}`);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }

    await page.goto('/404.html');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');

    const robots = await page.request.get('/robots.txt');
    expect(await robots.text()).toContain('Sitemap: https://www.giftoframes.net/sitemap.xml');

    const sitemap = await page.request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('<loc>https://www.giftoframes.net/</loc>');
  });
});

async function downloadByClick(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  const downloadPromise = page.waitForEvent('download');
  await locator.click();
  return downloadPromise;
}

function readRgba(data: Uint8Array | Buffer, width: number, x: number, y: number): number[] {
  const index = (y * width + x) * 4;
  return Array.from(data.slice(index, index + 4));
}
