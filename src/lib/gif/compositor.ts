import type { ComposedGifFrame } from '../types';

export interface RawPatchFrame {
  index?: number;
  left: number;
  top: number;
  width: number;
  height: number;
  delayMs: number;
  disposalType: number;
  patch: Uint8ClampedArray | Uint8Array;
}

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function composeGifFrames(
  rawFrames: RawPatchFrame[],
  canvasWidth: number,
  canvasHeight: number,
  background: RgbaColor = { r: 0, g: 0, b: 0, a: 0 }
): ComposedGifFrame[] {
  if (!Number.isInteger(canvasWidth) || !Number.isInteger(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error('GIF dimensions are invalid.');
  }

  const output: ComposedGifFrame[] = [];
  let canvas = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  fillRect(canvas, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight, background);

  rawFrames.forEach((frame, frameIndex) => {
    validateFrame(frame, canvasWidth, canvasHeight);
    const restorePrevious = frame.disposalType === 3 ? canvas.slice() : null;

    compositePatch(canvas, canvasWidth, canvasHeight, frame);

    output.push({
      index: frame.index ?? frameIndex,
      width: canvasWidth,
      height: canvasHeight,
      delayMs: Number.isFinite(frame.delayMs) ? Math.max(0, Math.round(frame.delayMs)) : 100,
      disposalType: frame.disposalType,
      left: frame.left,
      top: frame.top,
      patchWidth: frame.width,
      patchHeight: frame.height,
      pixels: canvas.slice()
    });

    if (frame.disposalType === 2) {
      fillRect(canvas, canvasWidth, canvasHeight, frame.left, frame.top, frame.width, frame.height, background);
    } else if (restorePrevious) {
      canvas = restorePrevious;
    }
  });

  return output;
}

export function compositePatch(
  canvas: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  frame: RawPatchFrame
): void {
  for (let y = 0; y < frame.height; y += 1) {
    const destY = frame.top + y;
    if (destY < 0 || destY >= canvasHeight) continue;

    for (let x = 0; x < frame.width; x += 1) {
      const destX = frame.left + x;
      if (destX < 0 || destX >= canvasWidth) continue;

      const sourceIndex = (y * frame.width + x) * 4;
      const destIndex = (destY * canvasWidth + destX) * 4;
      blendPixel(frame.patch, sourceIndex, canvas, destIndex);
    }
  }
}

export function fillRect(
  canvas: Uint8ClampedArray,
  canvasWidth: number,
  canvasHeight: number,
  left: number,
  top: number,
  width: number,
  height: number,
  color: RgbaColor
): void {
  const startX = Math.max(0, left);
  const startY = Math.max(0, top);
  const endX = Math.min(canvasWidth, left + width);
  const endY = Math.min(canvasHeight, top + height);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * canvasWidth + x) * 4;
      canvas[index] = color.r;
      canvas[index + 1] = color.g;
      canvas[index + 2] = color.b;
      canvas[index + 3] = color.a;
    }
  }
}

function blendPixel(source: Uint8ClampedArray | Uint8Array, sourceIndex: number, dest: Uint8ClampedArray, destIndex: number): void {
  const sourceAlpha = source[sourceIndex + 3] / 255;
  if (sourceAlpha <= 0) return;

  if (sourceAlpha >= 1) {
    dest[destIndex] = source[sourceIndex];
    dest[destIndex + 1] = source[sourceIndex + 1];
    dest[destIndex + 2] = source[sourceIndex + 2];
    dest[destIndex + 3] = source[sourceIndex + 3];
    return;
  }

  const destAlpha = dest[destIndex + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) {
    dest[destIndex] = 0;
    dest[destIndex + 1] = 0;
    dest[destIndex + 2] = 0;
    dest[destIndex + 3] = 0;
    return;
  }

  dest[destIndex] = Math.round((source[sourceIndex] * sourceAlpha + dest[destIndex] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  dest[destIndex + 1] = Math.round((source[sourceIndex + 1] * sourceAlpha + dest[destIndex + 1] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  dest[destIndex + 2] = Math.round((source[sourceIndex + 2] * sourceAlpha + dest[destIndex + 2] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  dest[destIndex + 3] = Math.round(outAlpha * 255);
}

function validateFrame(frame: RawPatchFrame, canvasWidth: number, canvasHeight: number): void {
  if (!Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width <= 0 || frame.height <= 0) {
    throw new Error(`Frame ${frame.index ?? ''} has invalid dimensions.`);
  }
  if (frame.left >= canvasWidth || frame.top >= canvasHeight) {
    throw new Error(`Frame ${frame.index ?? ''} starts outside the GIF canvas.`);
  }
  if (frame.patch.length !== frame.width * frame.height * 4) {
    throw new Error(`Frame ${frame.index ?? ''} patch length does not match its dimensions.`);
  }
}
