/// <reference lib="webworker" />

import { decompressFrames, parseGIF, type GifFrame, type ParsedGif } from 'gifuct-js';
import { LIMITS } from '../lib/constants';
import { composeGifFrames, type RawPatchFrame, type RgbaColor } from '../lib/gif/compositor';
import type { DecodeErrorCode, DecodeProgress, DecodeResult } from '../lib/types';

type WorkerRequest =
  | {
      type: 'decode';
      jobId: string;
      buffer: ArrayBuffer;
      fileName: string;
      fileSize: number;
    }
  | {
      type: 'cancel';
      jobId: string;
    };

type WorkerResponse =
  | { type: 'progress'; jobId: string; progress: DecodeProgress }
  | { type: 'complete'; jobId: string; result: DecodeResult }
  | { type: 'error'; jobId: string; code: DecodeErrorCode; message: string };

let cancelledJobId: string | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    cancelledJobId = message.jobId;
    return;
  }

  void decode(message).catch((error: unknown) => {
    postError(message.jobId, classifyError(error), error instanceof Error ? error.message : 'The GIF could not be decoded.');
  });
};

async function decode(request: Extract<WorkerRequest, { type: 'decode' }>): Promise<void> {
  cancelledJobId = null;
  checkCancelled(request.jobId);
  postProgress(request.jobId, 'decoding', 0.08, 'Reading the GIF header and image blocks...');

  if (request.fileSize > LIMITS.maxFileBytes) {
    throw resourceError(`This file is ${formatMb(request.fileSize)}. The current browser guardrail is ${formatMb(LIMITS.maxFileBytes)}.`);
  }

  let parsed: ParsedGif;
  let decodedFrames: GifFrame[];
  try {
    parsed = parseGIF(request.buffer);
    decodedFrames = decompressFrames(parsed, true);
  } catch (error) {
    throw corruptError(error instanceof Error ? error.message : 'The GIF structure is damaged or unsupported.');
  }

  const width = parsed.lsd.width;
  const height = parsed.lsd.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw corruptError('The GIF has invalid canvas dimensions.');
  }

  if (width * height > LIMITS.maxPixelsPerFrame) {
    throw resourceError(`The GIF canvas is ${width}x${height}. The current guardrail is ${LIMITS.maxPixelsPerFrame.toLocaleString()} pixels per frame.`);
  }

  if (decodedFrames.length === 0) {
    throw corruptError('No animation frames were found in this GIF.');
  }

  if (decodedFrames.length > LIMITS.maxFrames) {
    throw resourceError(`This GIF has ${decodedFrames.length} frames. The current guardrail is ${LIMITS.maxFrames} frames.`);
  }

  if (decodedFrames.length * width * height > LIMITS.maxTotalOutputPixels) {
    throw resourceError('Composing every frame would exceed the browser memory guardrail for this version.');
  }

  checkCancelled(request.jobId);
  postProgress(request.jobId, 'composing', 0.22, `Composing ${decodedFrames.length} full display frames...`);

  const rawFrames: RawPatchFrame[] = decodedFrames.map((frame, index) => {
    if (index % 12 === 0) {
      checkCancelled(request.jobId);
      postProgress(request.jobId, 'composing', 0.22 + (index / decodedFrames.length) * 0.68, `Composing frame ${index + 1} of ${decodedFrames.length}...`);
    }

    return {
      index,
      left: frame.dims.left,
      top: frame.dims.top,
      width: frame.dims.width,
      height: frame.dims.height,
      delayMs: normalizeDelay(frame.delay),
      disposalType: frame.disposalType ?? 0,
      patch: frame.patch
    };
  });

  const composed = composeGifFrames(rawFrames, width, height, readBackground(parsed));
  const totalDurationMs = composed.reduce((sum, frame) => sum + frame.delayMs, 0);

  postProgress(request.jobId, 'composing', 0.96, 'Finalizing frame data...');
  checkCancelled(request.jobId);

  const result: DecodeResult = {
    summary: {
      name: request.fileName,
      size: request.fileSize,
      width,
      height,
      frameCount: composed.length,
      totalDurationMs
    },
    frames: composed
  };

  const transferables = composed.map((frame) => frame.pixels.buffer).filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
  postMessage({ type: 'complete', jobId: request.jobId, result } satisfies WorkerResponse, transferables);
}

function normalizeDelay(delay: number | undefined): number {
  if (!Number.isFinite(delay) || delay === undefined || delay < 0) return 100;
  return Math.round(delay);
}

function readBackground(parsed: ParsedGif): RgbaColor {
  const index = parsed.lsd.backgroundColorIndex;
  const color = typeof index === 'number' ? parsed.gct?.[index] : undefined;
  if (!color) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: color[0], g: color[1], b: color[2], a: 0 };
}

function checkCancelled(jobId: string): void {
  if (cancelledJobId === jobId) {
    throw new DOMException('Decode cancelled.', 'AbortError');
  }
}

function postProgress(jobId: string, phase: DecodeProgress['phase'], progress: number, message: string): void {
  postMessage({ type: 'progress', jobId, progress: { phase, progress, message } } satisfies WorkerResponse);
}

function postError(jobId: string, code: DecodeErrorCode, message: string): void {
  postMessage({ type: 'error', jobId, code, message } satisfies WorkerResponse);
}

function classifyError(error: unknown): DecodeErrorCode {
  if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  if (error instanceof Error && error.name === 'ResourceLimitError') return 'resource-limit';
  if (error instanceof Error && error.name === 'CorruptGifError') return 'corrupt-gif';
  if (error instanceof Error && /memory|allocation|array buffer|out of/i.test(error.message)) return 'browser-memory';
  return 'unknown';
}

function resourceError(message: string): Error {
  const error = new Error(message);
  error.name = 'ResourceLimitError';
  return error;
}

function corruptError(message: string): Error {
  const error = new Error(message);
  error.name = 'CorruptGifError';
  return error;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
