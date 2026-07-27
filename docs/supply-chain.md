# Dependency And Supply Chain Notes

Date: 2026-07-27

Runtime dependencies:

- `gifuct-js` 2.1.2, MIT: browser-capable GIF parser/decompressor used for LZW decoding, interlacing and GIF frame patches. The app composes full display frames from decoded patches instead of treating patches as finished frames.
- `fflate` 0.8.3, MIT: ZIP creation in the browser without sending frame images to a server.
- `react` 19.2.8 and `react-dom` 19.2.8, MIT: UI runtime.
- `lucide-react` 1.27.0, ISC: icon components used in tool buttons.

Development/test dependencies:

- `vite` 8.1.5, `typescript` 6.0.3, `eslint` 10.8.0, `vitest` 4.1.10, and `@playwright/test` 1.62.0 for build and verification.
- `gifenc` 1.0.3, MIT: repository-owned GIF fixtures.
- `pngjs` 7.0.0, MIT and `jpeg-js` 0.4.4, BSD-3-Clause: decoding exported files in tests.

External implementation reference:

- `https://github.com/puzdjX/Gif-To-Frames-Converter` was reviewed as a product/technical reference only. It is MIT licensed, uses `libgif.js/SuperGif`, and contains ideas such as drag/drop upload, progress, frame thumbnails, modal preview, local processing, and sprite sheet export.
- No source code from that repository was copied into this project.
- The current implementation uses maintained package dependencies, a Web Worker, explicit resource limits, and project-owned tests for transparent/local frames and disposal methods.

Controls:

- No dependency is used to upload, fetch third-party media, run analytics, or store user files.
- Dependencies are bundled into static assets; no external CDN scripts are loaded at runtime.
- Licenses and installed versions must be checked from the generated lockfile before launch.
