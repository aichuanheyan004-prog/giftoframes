import fs from 'node:fs';
import path from 'node:path';
import { decompressFrames, parseGIF, type GifFrame } from 'gifuct-js';
import { describe, expect, it } from 'vitest';
import { composeGifFrames } from '../../src/lib/gif/compositor';

const fixturesDir = path.resolve(process.cwd(), 'tests', 'fixtures');

describe('real GIF fixtures', () => {
  it('decodes full-frame animation dimensions, frame count and delays', () => {
    const frames = decodeFixture('full-frame-delays.gif');
    expect(frames).toHaveLength(3);
    expect(frames[0].width).toBe(12);
    expect(frames[0].height).toBe(10);
    expect(frames.map((frame) => frame.delayMs)).toEqual([80, 120, 60]);
    expect(pixel(frames[1].pixels, 12, 8, 2)).toEqual([20, 184, 166, 255]);
  });

  it('decodes transparent local updates as full composed frames', () => {
    const frames = decodeFixture('transparent-local.gif');
    expect(frames).toHaveLength(3);
    expect(pixel(frames[0].pixels, 12, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(frames[0].pixels, 12, 2, 1)).toEqual([236, 72, 153, 255]);
    expect(pixel(frames[1].pixels, 12, 6, 2)).toEqual([16, 185, 129, 255]);
    expect(pixel(frames[2].pixels, 12, 3, 5)).toEqual([59, 130, 246, 255]);
  });

  it('honors disposal method 2 from a real GIF', () => {
    const frames = decodeFixture('disposal-2-clear.gif');
    expect(frames.map((frame) => frame.disposalType)).toEqual([1, 2, 1]);
    expect(pixel(frames[1].pixels, 10, 4, 2)).toEqual([16, 185, 129, 255]);
    expect(pixel(frames[2].pixels, 10, 4, 2)).toEqual([0, 0, 0, 0]);
    expect(pixel(frames[2].pixels, 10, 1, 1)).toEqual([250, 204, 21, 255]);
  });

  it('honors disposal method 3 from a real GIF when the decoder exposes it', () => {
    const frames = decodeFixture('disposal-3-restore.gif');
    expect(frames.map((frame) => frame.disposalType)).toEqual([1, 3, 1]);
    expect(pixel(frames[1].pixels, 10, 3, 2)).toEqual([16, 185, 129, 255]);
    expect(pixel(frames[2].pixels, 10, 3, 2)).toEqual([236, 72, 153, 255]);
    expect(pixel(frames[2].pixels, 10, 7, 5)).toEqual([59, 130, 246, 255]);
  });
});

function decodeFixture(fileName: string) {
  const buffer = fs.readFileSync(path.join(fixturesDir, fileName));
  const parsed = parseGIF(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const raw = decompressFrames(parsed, true);
  return composeGifFrames(
    raw.map((frame: GifFrame, index: number) => ({
      index,
      left: frame.dims.left,
      top: frame.dims.top,
      width: frame.dims.width,
      height: frame.dims.height,
      delayMs: frame.delay ?? 100,
      disposalType: frame.disposalType ?? 0,
      patch: frame.patch
    })),
    parsed.lsd.width,
    parsed.lsd.height
  );
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const index = (y * width + x) * 4;
  return Array.from(data.slice(index, index + 4));
}
