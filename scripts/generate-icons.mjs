// scripts/generate-icons.mjs
// Generates PNG icons for the Chrome extension from the SVG source.
// Run: node scripts/generate-icons.mjs

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const sizes = [16, 48, 128];

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#2563eb"/>
  <path d="M28 36h12l16 24 16-24h12v56H72V56L56 80 40 56v36H28z" fill="white"/>
  <path d="M92 36h8v56h-8z" fill="white" opacity="0.6"/>
</svg>`;

try {
  const sharp = (await import('sharp')).default;

  for (const size of sizes) {
    const outPath = join(root, 'public', 'icons', `icon-${size}.png`);

    // Composite SVG onto solid blue background to ensure full opacity
    const bg = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 37, g: 99, b: 235, alpha: 1 },
      },
    }).png().toBuffer();

    const svgPng = await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toBuffer();

    await sharp(bg)
      .composite([{ input: svgPng, blend: 'over' }])
      .toFile(outPath);

    console.log(`Generated ${outPath}`);
  }
} catch {
  console.log('sharp not available. Install it with: npm i -D sharp');
}
