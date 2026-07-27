import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const outDir = path.join(root, 'public', 'og');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1
});

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Try sample GIF/ }).click();
await page.getByText('GIF decoded successfully.').waitFor({ timeout: 10_000 });
await page.screenshot({
  path: path.join(outDir, 'giftoframes-og.png'),
  fullPage: false
});

await browser.close();
console.log(`Created ${path.join(outDir, 'giftoframes-og.png')}`);
