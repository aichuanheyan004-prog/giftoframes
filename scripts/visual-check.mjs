/* global document */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const fixture = path.join(root, 'tests', 'fixtures', 'transparent-local.gif');
const invalid = path.join(root, 'tests', 'fixtures', 'not-a-gif.txt');
const outDir = path.join(root, 'test-results', 'visual-check');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const target of [
  { name: 'desktop', viewport: { width: 1440, height: 1000 } },
  { name: 'mobile-390', viewport: { width: 390, height: 844 } }
]) {
  const page = await browser.newPage({ viewport: target.viewport, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.getByText('GIF decoded successfully.').waitFor({ timeout: 10_000 });
  await page.getByTitle('Play animation').click();
  await page.getByTitle('Pause animation').click();
  await page.getByTitle('Next frame').click();
  await page.getByTitle('Previous frame').click();
  await page.getByPlaceholder('1-8, 12').fill('1-2');
  await page.getByRole('button', { name: /Select range/ }).click();
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Selected ZIP/ }).click();
  await zipDownload;
  await page.screenshot({ path: path.join(outDir, `${target.name}-tool.png`), fullPage: false });

  await page.locator('input[type="file"]').setInputFiles(invalid);
  await page.getByText('That file is not a GIF.').waitFor({ timeout: 10_000 });
  await page.getByRole('button', { name: /Reset/ }).click();
  await page.getByText('Ready for another GIF.').waitFor({ timeout: 10_000 });

  const pageChecks = [];
  for (const url of ['/', '/guide/', '/privacy/', '/terms/', '/404.html']) {
    await page.goto(`http://127.0.0.1:5173${url}`, { waitUntil: 'networkidle' });
    pageChecks.push(
      await page.evaluate((checkedUrl) => ({
        url: checkedUrl,
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.trim() ?? '',
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '',
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }), url)
    );
  }

  const robotsText = await (await page.request.get('http://127.0.0.1:5173/robots.txt')).text();
  const sitemapText = await (await page.request.get('http://127.0.0.1:5173/sitemap.xml')).text();
  results.push({
    viewport: target,
    consoleErrors,
    pageChecks,
    robotsOk: robotsText.includes('Sitemap: https://www.giftoframes.net/sitemap.xml'),
    sitemapCount: (sitemapText.match(/<loc>/g) ?? []).length
  });
  await page.close();
}

await browser.close();

const failures = [];
for (const result of results) {
  if (result.consoleErrors.length) failures.push(`${result.viewport.name}: console errors: ${result.consoleErrors.join('; ')}`);
  if (!result.robotsOk) failures.push(`${result.viewport.name}: robots.txt missing sitemap`);
  if (result.sitemapCount !== 4) failures.push(`${result.viewport.name}: expected 4 sitemap URLs, got ${result.sitemapCount}`);
  for (const check of result.pageChecks) {
    if (check.overflow > 1) failures.push(`${result.viewport.name} ${check.url}: horizontal overflow ${check.overflow}`);
    if (!check.h1) failures.push(`${result.viewport.name} ${check.url}: missing H1`);
    if (check.url !== '/404.html' && !check.canonical.startsWith('https://www.giftoframes.net')) {
      failures.push(`${result.viewport.name} ${check.url}: canonical missing or wrong`);
    }
    if (check.url === '/404.html' && check.robots !== 'noindex,follow') {
      failures.push(`${result.viewport.name} 404: missing noindex`);
    }
  }
}

fs.writeFileSync(path.join(outDir, 'visual-check.json'), `${JSON.stringify(results, null, 2)}\n`);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Visual checks passed. Artifacts: ${outDir}`);
