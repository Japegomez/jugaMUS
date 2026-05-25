/**
 * Pads non-square app icons to 1024×1024 (Expo requires square icon assets).
 * Run: node scripts/resize-square-icons.mjs
 */
import sharp from 'sharp';
import { rename } from 'node:fs/promises';
import path from 'node:path';

const BRAND = { r: 26, g: 95, b: 74, alpha: 1 };
const SIZE = 1024;
const FILES = ['icon.png', 'adaptive-icon.png'];

const assetsDir = path.join(process.cwd(), 'assets');

for (const file of FILES) {
  const input = path.join(assetsDir, file);
  const tmp = `${input}.tmp`;
  await sharp(input)
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: BRAND,
    })
    .png()
    .toFile(tmp);
  await rename(tmp, input);
  const meta = await sharp(input).metadata();
  console.log(`${file}: ${meta.width}x${meta.height}`);
}
