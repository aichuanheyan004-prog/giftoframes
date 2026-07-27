# GifToFrames

GifToFrames is a browser-local GIF frame extractor for giftoframes.net.

The tool decodes animated GIFs in a Web Worker, composes full frames with GIF disposal behavior, previews timing, and exports ordered PNG, WebP, or JPEG frames. GIF files and rendered frames stay in browser memory; this project does not include analytics, uploads, accounts, or a server-side conversion API.

## Development

```bash
npm.cmd install
npm.cmd run fixtures
npm.cmd run dev
```

## Verification

```bash
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run audit:static
```

## Deployment

The static build in `dist/` is intended for Vercel. The canonical production host is `https://www.giftoframes.net/`; apex `giftoframes.net` should redirect to the `www` host.
