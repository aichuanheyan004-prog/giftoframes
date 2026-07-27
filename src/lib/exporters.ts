import { zipSync } from 'fflate';
import type { ComposedGifFrame, ExportFormat, ExportOptions } from './types';
import { makeFrameFileName } from './selection';

export interface ZipExportCallbacks {
  onProgress?: (completed: number, total: number, currentName: string) => void;
  shouldCancel?: () => boolean;
}

export function drawFrameToCanvas(frame: ComposedGifFrame, options?: ExportOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext('2d', { willReadFrequently: false });
  if (!context) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  const imageData = new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height);

  if (options?.format === 'jpeg') {
    context.fillStyle = options.jpegBackground;
    context.fillRect(0, 0, frame.width, frame.height);
    const source = document.createElement('canvas');
    source.width = frame.width;
    source.height = frame.height;
    const sourceContext = source.getContext('2d');
    if (!sourceContext) {
      throw new Error('Canvas rendering is not available in this browser.');
    }
    sourceContext.putImageData(imageData, 0, 0);
    context.drawImage(source, 0, 0);
    return canvas;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

export async function frameToBlob(frame: ComposedGifFrame, options: ExportOptions): Promise<Blob> {
  const canvas = drawFrameToCanvas(frame, options);
  const mimeType = formatToMime(options.format);
  const quality = options.format === 'jpeg' || options.format === 'webp' ? options.jpegQuality : undefined;
  return canvasToBlob(canvas, mimeType, quality);
}

export async function framesToZipBlob(
  frames: ComposedGifFrame[],
  sourceName: string,
  options: ExportOptions,
  callbacks: ZipExportCallbacks = {}
): Promise<Blob> {
  const extension = formatToExtension(options.format);
  const entries: Record<string, Uint8Array> = {};

  for (let index = 0; index < frames.length; index += 1) {
    if (callbacks.shouldCancel?.()) {
      throw new DOMException('Export cancelled.', 'AbortError');
    }
    const frame = frames[index];
    const fileName = makeFrameFileName(sourceName, frame.index, frames[frames.length - 1]?.index + 1 || frames.length, extension);
    const blob = await frameToBlob(frame, options);
    entries[fileName] = new Uint8Array(await blob.arrayBuffer());
    callbacks.onProgress?.(index + 1, frames.length, fileName);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped], { type: 'application/zip' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function formatToMime(format: ExportFormat): string {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
}

export function formatToExtension(format: ExportFormat): string {
  if (format === 'jpeg') return 'jpg';
  if (format === 'webp') return 'webp';
  return 'png';
}

export async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`This browser could not encode ${mimeType}.`));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

export function canEncodeWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}
