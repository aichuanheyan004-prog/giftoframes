import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createStream from '../node_modules/gifenc/src/stream.js';
import lzwEncode from '../node_modules/gifenc/src/lzwEncode.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = path.join(root, 'tests', 'fixtures');
const examplesDir = path.join(root, 'public', 'examples');

fs.mkdirSync(fixturesDir, { recursive: true });
fs.mkdirSync(examplesDir, { recursive: true });

const palette = [
  [0, 0, 0],
  [236, 72, 153],
  [16, 185, 129],
  [59, 130, 246],
  [250, 204, 21],
  [255, 255, 255],
  [20, 184, 166],
  [124, 58, 237]
];

writeGif('full-frame-delays.gif', 12, 10, [
  { left: 0, top: 0, width: 12, height: 10, delay: 80, dispose: 1, transparent: false, pixels: fill(12, 10, 1, (x, y) => (x + y) % 5 === 0 ? 4 : 1) },
  { left: 0, top: 0, width: 12, height: 10, delay: 120, dispose: 1, transparent: false, pixels: fill(12, 10, 2, (x) => x < 6 ? 2 : 6) },
  { left: 0, top: 0, width: 12, height: 10, delay: 60, dispose: 1, transparent: false, pixels: fill(12, 10, 3, (_x, y) => y < 5 ? 3 : 7) }
]);

writeGif('transparent-local.gif', 12, 10, [
  { left: 1, top: 1, width: 4, height: 4, delay: 90, dispose: 1, transparent: true, pixels: fill(4, 4, 1, (x, y) => x === y ? 0 : 1) },
  { left: 5, top: 2, width: 5, height: 4, delay: 150, dispose: 1, transparent: true, pixels: fill(5, 4, 2, (x, y) => (x + y) % 3 === 0 ? 0 : 2) },
  { left: 3, top: 5, width: 7, height: 3, delay: 210, dispose: 1, transparent: true, pixels: fill(7, 3, 3, (x) => x % 2 === 0 ? 3 : 0) }
]);

writeGif('disposal-2-clear.gif', 10, 8, [
  { left: 0, top: 0, width: 10, height: 8, delay: 100, dispose: 1, transparent: true, pixels: fill(10, 8, 0, (x, y) => (x < 2 || y < 2 ? 4 : 0)) },
  { left: 4, top: 2, width: 3, height: 3, delay: 130, dispose: 2, transparent: true, pixels: fill(3, 3, 2) },
  { left: 0, top: 5, width: 3, height: 3, delay: 170, dispose: 1, transparent: true, pixels: fill(3, 3, 3) }
]);

writeGif('disposal-3-restore.gif', 10, 8, [
  { left: 0, top: 0, width: 10, height: 8, delay: 100, dispose: 1, transparent: false, pixels: fill(10, 8, 1) },
  { left: 3, top: 2, width: 4, height: 3, delay: 140, dispose: 3, transparent: true, pixels: fill(4, 3, 2) },
  { left: 7, top: 5, width: 2, height: 2, delay: 180, dispose: 1, transparent: true, pixels: fill(2, 2, 3) }
]);

fs.copyFileSync(path.join(fixturesDir, 'transparent-local.gif'), path.join(examplesDir, 'giftoframes-sample.gif'));

console.log(`Generated GIF fixtures in ${fixturesDir}`);
console.log(`Generated sample GIF in ${examplesDir}`);

function writeGif(fileName, width, height, frames) {
  const stream = createStream(4096);
  writeAscii(stream, 'GIF89a');
  writeUInt16(stream, width);
  writeUInt16(stream, height);
  stream.writeByte(0b1111_0010);
  stream.writeByte(0);
  stream.writeByte(0);
  for (const color of palette) {
    stream.writeByte(color[0]);
    stream.writeByte(color[1]);
    stream.writeByte(color[2]);
  }
  writeLoopExtension(stream);

  for (const frame of frames) {
    writeGraphicControl(stream, frame.dispose, frame.delay, frame.transparent);
    writeImageDescriptor(stream, frame.left, frame.top, frame.width, frame.height);
    lzwEncode(frame.width, frame.height, frame.pixels, 3, stream);
  }

  stream.writeByte(0x3b);
  fs.writeFileSync(path.join(fixturesDir, fileName), stream.bytes());
}

function writeLoopExtension(stream) {
  stream.writeByte(0x21);
  stream.writeByte(0xff);
  stream.writeByte(0x0b);
  writeAscii(stream, 'NETSCAPE2.0');
  stream.writeByte(0x03);
  stream.writeByte(0x01);
  writeUInt16(stream, 0);
  stream.writeByte(0x00);
}

function writeGraphicControl(stream, dispose, delayMs, transparent) {
  stream.writeByte(0x21);
  stream.writeByte(0xf9);
  stream.writeByte(0x04);
  stream.writeByte(((dispose & 7) << 2) | (transparent ? 1 : 0));
  writeUInt16(stream, Math.round(delayMs / 10));
  stream.writeByte(0);
  stream.writeByte(0);
}

function writeImageDescriptor(stream, left, top, width, height) {
  stream.writeByte(0x2c);
  writeUInt16(stream, left);
  writeUInt16(stream, top);
  writeUInt16(stream, width);
  writeUInt16(stream, height);
  stream.writeByte(0);
}

function writeAscii(stream, value) {
  for (let index = 0; index < value.length; index += 1) {
    stream.writeByte(value.charCodeAt(index));
  }
}

function writeUInt16(stream, value) {
  stream.writeByte(value & 0xff);
  stream.writeByte((value >> 8) & 0xff);
}

function fill(width, height, defaultIndex, choose = () => defaultIndex) {
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = choose(x, y);
    }
  }
  return pixels;
}
