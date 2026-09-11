/**
 * Regenerates the PWA icons in public/icons from the SVG logo.
 *   npm i -D sharp && npm run icons
 * (The generated PNGs are committed, so this is only needed if the logo changes.)
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const bars = `
  <rect x="14" y="34" width="8" height="16" rx="3" fill="#99f6e4"/>
  <rect x="28" y="24" width="8" height="26" rx="3" fill="#5eead4"/>
  <rect x="42" y="14" width="8" height="36" rx="3" fill="#ffffff"/>`;

// Standard icon: rounded square.
const standard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0f766e"/>${bars}</svg>`;
// Maskable icon: full-bleed background, artwork scaled into the 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0f766e"/><g transform="translate(9.6 9.6) scale(0.7)">${bars}</g></svg>`;
// Apple touch icon: iOS rounds corners itself, so fill the square.
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0f766e"/><g transform="translate(4 4) scale(0.875)">${bars}</g></svg>`;

mkdirSync('public/icons', { recursive: true });
const out = [
  [standard, 192, 'icon-192.png'],
  [standard, 512, 'icon-512.png'],
  [maskable, 512, 'icon-maskable-512.png'],
  [apple, 180, 'apple-touch-icon.png'],
];
for (const [svg, size, name] of out) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log('wrote', name);
}
