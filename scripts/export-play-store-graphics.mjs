/**
 * Export Google Play graphics from generated sources.
 * Play icon: 512×512 PNG (store listing).
 * Expo: 1024×1024 icon + adaptive-icon.
 * Feature graphic: 1024×500 PNG.
 *
 * Usage: node scripts/export-play-store-graphics.mjs [iconSource] [featureSource]
 */
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const cursorAssets = path.join(
  process.env.USERPROFILE ?? '',
  '.cursor',
  'projects',
  'c-Users-japegomez-Desktop-musApp',
  'assets',
);
const defaultIcon = path.join(cursorAssets, 'play-icon-512.png');
const defaultFeature = path.join(cursorAssets, 'play-feature-graphic.png');

const iconSource = process.argv[2] ?? defaultIcon;
const featureSource = process.argv[3] ?? defaultFeature;
const brand = { r: 26, g: 95, b: 74, alpha: 1 };

const playDir = path.join(root, 'assets', 'play-store');

async function squarePng(input, size, output) {
  await sharp(input)
    .resize(size, size, { fit: 'contain', background: brand })
    .png({ compressionLevel: 9 })
    .toFile(output);
  const meta = await sharp(output).metadata();
  console.log(`${output}: ${meta.width}×${meta.height}`);
}

async function featurePng(input, output) {
  await sharp(input)
    .resize(1024, 500, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(output);
  const meta = await sharp(output).metadata();
  console.log(`${output}: ${meta.width}×${meta.height}`);
}

await mkdir(playDir, { recursive: true });

await squarePng(iconSource, 512, path.join(playDir, 'icon-512.png'));
await squarePng(iconSource, 1024, path.join(root, 'assets', 'icon.png'));
await squarePng(iconSource, 1024, path.join(root, 'assets', 'adaptive-icon.png'));
await featurePng(featureSource, path.join(playDir, 'feature-graphic-1024x500.png'));

// Keep a copy at assets root for convenience
await copyFile(
  path.join(playDir, 'feature-graphic-1024x500.png'),
  path.join(root, 'assets', 'feature-graphic.png'),
);

console.log('Done.');
