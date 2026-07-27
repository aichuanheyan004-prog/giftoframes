export type ExportFormat = 'png' | 'webp' | 'jpeg';

export interface FileSummary {
  name: string;
  size: number;
  width: number;
  height: number;
  frameCount: number;
  totalDurationMs: number;
}

export interface ComposedGifFrame {
  index: number;
  width: number;
  height: number;
  delayMs: number;
  disposalType: number;
  left: number;
  top: number;
  patchWidth: number;
  patchHeight: number;
  pixels: Uint8ClampedArray;
}

export interface DecodeResult {
  summary: FileSummary;
  frames: ComposedGifFrame[];
}

export type DecodeErrorCode =
  | 'invalid-file'
  | 'resource-limit'
  | 'corrupt-gif'
  | 'browser-memory'
  | 'cancelled'
  | 'unknown';

export interface DecodeProgress {
  phase: 'reading' | 'decoding' | 'composing';
  progress: number;
  message: string;
}

export interface ExportOptions {
  format: ExportFormat;
  jpegBackground: string;
  jpegQuality: number;
}
