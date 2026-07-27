export const LIMITS = {
  maxFileBytes: 25 * 1024 * 1024,
  maxFrames: 500,
  maxPixelsPerFrame: 4_000_000,
  maxTotalOutputPixels: 80_000_000
} as const;

export const SAMPLE_GIF_PATH = '/examples/giftoframes-sample.gif';

export const CANONICAL_HOST = 'https://www.giftoframes.net';
