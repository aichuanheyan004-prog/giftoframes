import { describe, expect, it } from 'vitest';
import { composeGifFrames, type RawPatchFrame } from '../../src/lib/gif/compositor';

describe('GIF frame compositor', () => {
  it('composes local patches over previous frames and preserves transparent pixels', () => {
    const frames = composeGifFrames(
      [
        patchFrame(0, 0, 2, 2, [red(), red(), red(), red()], 80, 1),
        patchFrame(1, 1, 2, 2, [transparent(), green(), blue(), transparent()], 120, 1)
      ],
      4,
      4
    );

    expect(pixel(frames[0].pixels, 4, 0, 0)).toEqual(red());
    expect(pixel(frames[1].pixels, 4, 1, 1)).toEqual(red());
    expect(pixel(frames[1].pixels, 4, 2, 1)).toEqual(green());
    expect(pixel(frames[1].pixels, 4, 1, 2)).toEqual(blue());
    expect(frames[1].delayMs).toBe(120);
  });

  it('clears the patch rectangle for disposal method 2 before the next frame', () => {
    const frames = composeGifFrames(
      [
        patchFrame(0, 0, 4, 4, Array.from({ length: 16 }, red), 100, 1),
        patchFrame(1, 1, 2, 2, Array.from({ length: 4 }, green), 100, 2),
        patchFrame(3, 3, 1, 1, [blue()], 100, 1)
      ],
      4,
      4
    );

    expect(pixel(frames[1].pixels, 4, 1, 1)).toEqual(green());
    expect(pixel(frames[2].pixels, 4, 1, 1)).toEqual(transparent());
    expect(pixel(frames[2].pixels, 4, 3, 3)).toEqual(blue());
  });

  it('restores the previous canvas for disposal method 3 before the next frame', () => {
    const frames = composeGifFrames(
      [
        patchFrame(0, 0, 4, 4, Array.from({ length: 16 }, red), 100, 1),
        patchFrame(1, 1, 2, 2, Array.from({ length: 4 }, green), 100, 3),
        patchFrame(3, 3, 1, 1, [blue()], 100, 1)
      ],
      4,
      4
    );

    expect(pixel(frames[1].pixels, 4, 1, 1)).toEqual(green());
    expect(pixel(frames[2].pixels, 4, 1, 1)).toEqual(red());
    expect(pixel(frames[2].pixels, 4, 3, 3)).toEqual(blue());
  });
});

function patchFrame(
  left: number,
  top: number,
  width: number,
  height: number,
  colors: number[][],
  delayMs: number,
  disposalType: number
): RawPatchFrame {
  return {
    left,
    top,
    width,
    height,
    delayMs,
    disposalType,
    patch: Uint8ClampedArray.from(colors.flat())
  };
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const index = (y * width + x) * 4;
  return Array.from(data.slice(index, index + 4));
}

function red() {
  return [236, 72, 153, 255];
}

function green() {
  return [16, 185, 129, 255];
}

function blue() {
  return [59, 130, 246, 255];
}

function transparent() {
  return [0, 0, 0, 0];
}
