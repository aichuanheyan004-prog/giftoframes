export function createFullSelection(total: number): Set<number> {
  return new Set(Array.from({ length: Math.max(0, total) }, (_, index) => index));
}

export function parseFrameRange(input: string, total: number): Set<number> {
  const result = new Set<number>();
  const normalized = input.trim();
  if (!normalized) return result;

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = /^(\d+)?\s*-\s*(\d+)?$/.exec(part);
    const singleMatch = /^(\d+)$/.exec(part);

    if (singleMatch) {
      addOneBasedFrame(result, Number(singleMatch[1]), total);
      continue;
    }

    if (rangeMatch) {
      const start = rangeMatch[1] ? Number(rangeMatch[1]) : 1;
      const end = rangeMatch[2] ? Number(rangeMatch[2]) : total;
      if (start > end) {
        throw new Error(`Range ${part} starts after it ends.`);
      }
      for (let frame = start; frame <= end; frame += 1) {
        addOneBasedFrame(result, frame, total);
      }
      continue;
    }

    throw new Error(`Use ranges like 1-5, 8, or 12-.`);
  }

  return result;
}

export function sortedSelection(selection: Set<number>, total: number): number[] {
  return Array.from(selection)
    .filter((index) => Number.isInteger(index) && index >= 0 && index < total)
    .sort((a, b) => a - b);
}

export function makeFrameFileName(baseName: string, index: number, total: number, extension: string): string {
  const safeBase = sanitizeBaseName(baseName);
  const pad = String(total).length < 4 ? 4 : String(total).length;
  return `${safeBase}_frame_${String(index + 1).padStart(pad, '0')}.${extension}`;
}

export function makeZipFileName(baseName: string, suffix: 'all' | 'selected'): string {
  return `${sanitizeBaseName(baseName)}_${suffix}_frames.zip`;
}

export function sanitizeBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const safe = withoutExtension
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return safe || 'gif';
}

function addOneBasedFrame(target: Set<number>, frameNumber: number, total: number): void {
  if (!Number.isInteger(frameNumber) || frameNumber < 1 || frameNumber > total) {
    throw new Error(`Frame ${frameNumber} is outside 1-${total}.`);
  }
  target.add(frameNumber - 1);
}
