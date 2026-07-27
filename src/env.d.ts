/// <reference types="vite/client" />

declare module 'gifuct-js' {
  export interface GifFrame {
    dims: {
      top: number;
      left: number;
      width: number;
      height: number;
    };
    patch: Uint8ClampedArray | Uint8Array;
    delay?: number;
    disposalType?: number;
  }

  export interface ParsedGif {
    lsd: {
      width: number;
      height: number;
      backgroundColorIndex?: number;
    };
    gct?: Array<[number, number, number]>;
  }

  export function parseGIF(buffer: ArrayBuffer): ParsedGif;
  export function decompressFrames(parsedGif: ParsedGif, buildPatch: boolean): GifFrame[];
}
