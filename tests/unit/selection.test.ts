import { describe, expect, it } from 'vitest';
import { makeFrameFileName, parseFrameRange, sanitizeBaseName, sortedSelection } from '../../src/lib/selection';

describe('frame selection helpers', () => {
  it('parses comma-separated single frames and ranges as one-based input', () => {
    expect(sortedSelection(parseFrameRange('1-3, 5, 8-', 9), 9)).toEqual([0, 1, 2, 4, 7, 8]);
  });

  it('rejects invalid ranges', () => {
    expect(() => parseFrameRange('9-3', 10)).toThrow(/starts after/);
    expect(() => parseFrameRange('hello', 10)).toThrow(/Use ranges/);
    expect(() => parseFrameRange('99', 10)).toThrow(/outside/);
  });

  it('creates safe ordered file names', () => {
    expect(sanitizeBaseName('my dancing GIF!.gif')).toBe('my-dancing-GIF');
    expect(makeFrameFileName('my dancing GIF!.gif', 2, 12, 'png')).toBe('my-dancing-GIF_frame_0003.png');
  });
});
