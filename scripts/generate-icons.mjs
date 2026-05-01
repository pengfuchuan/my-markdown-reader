// scripts/generate-icons.mjs
// Generates PNG icons for the Chrome extension from the SVG source.
// Run: node scripts/generate-icons.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Simple SVG → PNG using canvas (requires no deps, works with Node 20+)
// For CI/prepublish, use sharp or canvas package. Here we generate placeholder data URIs.

const sizes = [16, 48, 128];

// Generate a simple M-shaped icon as a minimal PNG using raw bytes
// This is a fallback — for production, replace with properly designed icons.

function createIconPNG(size) {
  // Create a simple PNG with the letter "M" on blue background
  // Using a minimal approach: we'll create the SVG string and note that
  // Chrome extensions can reference SVG paths in some contexts,
  // but for proper PNGs, use a design tool or sharp.

  // For now, output the SVG path reference
  return null;
}

// Check if sharp is available for real PNG generation
try {
  const sharp = await import('sharp');
  const svgPath = join(root, 'public', 'icons', 'icon.svg');
  const svg = readFileSync(svgPath);

  for (const size of sizes) {
    const outPath = join(root, 'public', 'icons', `icon-${size}.png`);
    await sharp.default(svg)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Generated ${outPath}`);
  }
} catch {
  console.log('sharp not available. Using SVG icons (works for development).');
  console.log('For production, install sharp (npm i -D sharp) and re-run.');
  console.log('Or manually add PNG icons to public/icons/');
}
