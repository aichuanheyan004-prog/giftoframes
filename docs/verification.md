# Verification Log

Date: 2026-07-27

## Commands

- `npm.cmd install --ignore-scripts --no-audit --fund=false`: dependencies installed.
- `npm.cmd run fixtures`: generated repository-owned GIF fixtures and sample GIF.
- `npm.cmd run lint`: passed.
- `npm.cmd run test`: passed, 3 test files and 10 unit tests.
- `npm.cmd run build`: passed.
- `PLAYWRIGHT_EXTERNAL_SERVER=1 npm.cmd run test:e2e -- --workers=1 --reporter=line`: passed, 8 browser tests across desktop Chromium and 390px mobile.
- `npm.cmd run visual-check`: passed, screenshots and JSON saved under ignored `test-results/visual-check`.
- `npm.cmd run audit:static`: passed with 0 errors, 0 warnings.
- `npm.cmd run og`: generated `public/og/giftoframes-og.png` from the real local tool UI after loading the sample GIF.

## Fixture Coverage

- Full-frame GIF with different delays.
- Transparent/local update GIF.
- Disposal method 2 clear behavior.
- Disposal method 3 restore behavior.

## Export Coverage

- PNG export decoded and checked for correct dimensions and transparency.
- JPEG export decoded and checked for correct dimensions and selected background behavior.
- ZIP export decoded and checked for ordered file names, file count, non-empty files, dimensions and pixel content.

## Browser Coverage

- Upload valid sample GIF.
- Play/pause and previous/next frame controls.
- Range selection.
- Selected ZIP download.
- Invalid file error state.
- Reset state.
- Desktop and 390px mobile viewport checks for console errors and horizontal overflow.
- `/`, `/guide/`, `/privacy/`, `/terms/`, `/404.html`, `/robots.txt`, and `/sitemap.xml`.

## Production Deployment Verification

- Vercel project `giftoframes` imported from `aichuanheyan004-prog/giftoframes`; production deployment for commit `c7f7b8d` reached `Ready`.
- Temporary deployment URL `https://giftoframes-lyart.vercel.app/` passed sample parsing, playback/step controls, range selection, single-frame download, selected ZIP download, invalid-file handling, reset, and console checks.
- Namecheap DNS now uses `ALIAS @ d5ddaa126c267d46.vercel-dns-017.com.` and `CNAME www d5ddaa126c267d46.vercel-dns-017.com.`. Vercel accepts both hosts as valid.
- Vercel's recommended apex A address `216.198.79.1` and legacy `76.76.21.21` both timed out on port 443 from the launch network, while the project CNAME path worked. The apex was therefore changed to Namecheap ALIAS flattening so it follows the same reachable project endpoint as `www`.
- Both Namecheap authoritative nameservers returned the flattened ALIAS addresses `64.29.17.65` and `216.198.79.65` with a 60-second TTL. The launch network's recursive resolver temporarily retained the previous 30-minute A-record answer, so an apex timeout can persist locally until that older cache expires.
- Vercel reports `Valid Configuration` for both `giftoframes.net` and `www.giftoframes.net`; certificates were issued successfully.
- `http://giftoframes.net/` resolves to `https://www.giftoframes.net/`; Vercel shows the apex redirect as `308`.
- The canonical production host passed sample parsing, `2-3` range selection, a two-file selected ZIP download, and a zero-console-error check.
- `/`, `/guide/`, `/privacy/`, and `/terms/` have unique title/H1 metadata, `index,follow`, and self-canonicals on `https://www.giftoframes.net/`.
- A nonexistent path renders the real `Page not found` page with `noindex,follow` and no canonical.
- Production `robots.txt` points to the canonical sitemap; `sitemap.xml` lists the four intended indexable URLs.
- The production OG image decoded at `1200x630`; the homepage JSON-LD contains `WebApplication` and `SoftwareApplication` without ratings or user-count claims.
- In-app browser checks covered the live narrow/mobile layout with no horizontal overflow; automated Playwright coverage separately passed desktop Chromium and exact 390px viewports.

## Search Console And Measurement

- Google Search Console domain property `sc-domain:giftoframes.net` was created and verified by a Namecheap TXT record.
- `https://www.giftoframes.net/sitemap.xml` was submitted successfully; Search Console reported `Success` and discovered four pages.
- Search Console is processing the new property; indexing and query data are not yet available and must be reviewed after collection begins.
- No analytics were enabled for version one; this is an intentional privacy decision rather than an incomplete installation.

## Deployment Progress

- GitHub repository created by the user at `https://github.com/aichuanheyan004-prog/giftoframes`.
- Local `main` pushed to `origin/main` over SSH on 2026-07-27.
- Vercel project created at `https://vercel.com/chun5/giftoframes` and connected to the GitHub `main` branch.
- Canonical production URL launched at `https://www.giftoframes.net/` on 2026-07-27.
