// 一度だけ使うアイコン生成スクリプト: node tools/makeIcons.js
// icons/ に icon-192.png / icon-512.png / icon-maskable-512.png を生成する(依存なし)。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const iconsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BG = [217, 119, 6]; // #D97706
const FG = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// タイムラインモチーフ: 角丸正方形の背景 + 長さの違う白い横棒3本
function drawIcon(size, { maskable }) {
  const c = size / 2;
  const corner = size * 0.18;
  const scale = maskable ? 0.72 : 0.92; // maskableはセーフゾーン(中央80%)に収める
  const barH = size * 0.11 * scale;
  const gap = size * 0.20 * scale;
  const left = c - size * 0.31 * scale;
  const bars = [
    { y: c - gap, w: size * 0.62 * scale },
    { y: c, w: size * 0.44 * scale },
    { y: c + gap, w: size * 0.54 * scale },
  ];
  return (x, y) => {
    if (!maskable) {
      // 角丸判定(maskableは全面塗り)
      const rx = Math.max(Math.abs(x - c) - (c - corner), 0);
      const ry = Math.max(Math.abs(y - c) - (c - corner), 0);
      if (rx * rx + ry * ry > corner * corner) return [0, 0, 0, 0];
    }
    for (const bar of bars) {
      if (Math.abs(y - bar.y) <= barH / 2 && x >= left && x <= left + bar.w) return [...FG, 255];
    }
    return [...BG, 255];
  };
}

fs.mkdirSync(iconsDir, { recursive: true });
for (const { name, size, maskable } of [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]) {
  fs.writeFileSync(path.join(iconsDir, name), encodePng(size, drawIcon(size, { maskable })));
  console.log('wrote', name);
}
