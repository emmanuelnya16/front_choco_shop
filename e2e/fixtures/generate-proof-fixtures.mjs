// Génère les deux fausses captures de paiement des parcours e2e (PNG valides, 360 × 640, empreintes
// SHA-256 différentes : la même capture envoyée deux fois serait refusée comme doublon).
// Usage : node e2e/fixtures/generate-proof-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const outDir = process.argv[2] ?? fileURLToPath(new URL('.', import.meta.url));
// Bandeau orange (en-tête de l'opérateur), fond clair, lignes grises (texte du reçu)
const capture = (accent) => (x, y) => {
  if (y < 96) return accent;
  if (y > 160 && y < 600 && y % 48 < 14 && x > 32 && x < 328 - (y % 96)) return [90, 90, 90];
  return [246, 246, 244];
};
writeFileSync(`${outDir}/preuve.png`, png(360, 640, capture([255, 121, 0])));
writeFileSync(`${outDir}/preuve-2.png`, png(360, 640, capture([255, 204, 0])));
