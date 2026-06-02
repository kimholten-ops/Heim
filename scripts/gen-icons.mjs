/**
 * Heim PWA icon generator
 * Converts an SVG template to all required PNG sizes.
 * Run: node scripts/gen-icons.mjs
 */

import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

/** House icon SVG — white on green, designed for square app icons */
function buildSVG(size, padding = 0) {
  const bg = "#12936b";
  const fg = "#ffffff";
  // Safe zone: keep house within (padding)..(size-padding)
  const p = padding;
  const s = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;

  // House proportions (relative to safe zone)
  const roofPeak  = { x: cx, y: p + s * 0.12 };
  const roofLeft  = { x: p + s * 0.08, y: p + s * 0.50 };
  const roofRight = { x: p + s * 0.92, y: p + s * 0.50 };
  const wallLeft  = p + s * 0.18;
  const wallRight = p + s * 0.82;
  const wallTop   = p + s * 0.46;
  const wallBot   = p + s * 0.88;

  const doorW = s * 0.22;
  const doorH = s * 0.30;
  const doorX = cx - doorW / 2;
  const doorY = wallBot - doorH;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}" rx="${Math.round(size * 0.22)}"/>

  <!-- Roof -->
  <polygon points="${roofPeak.x},${roofPeak.y} ${roofLeft.x},${roofLeft.y} ${roofRight.x},${roofRight.y}"
    fill="${fg}"/>

  <!-- Chimney -->
  <rect x="${cx + s * 0.15}" y="${p + s * 0.06}" width="${s * 0.09}" height="${s * 0.16}" rx="${s * 0.02}" fill="${fg}"/>

  <!-- Walls -->
  <rect x="${wallLeft}" y="${wallTop}" width="${wallRight - wallLeft}" height="${wallBot - wallTop}"
    rx="${s * 0.03}" fill="${fg}"/>

  <!-- Door -->
  <rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}"
    rx="${s * 0.03}" fill="${bg}"/>

  <!-- Left window -->
  <rect x="${wallLeft + s * 0.04}" y="${wallTop + s * 0.08}" width="${s * 0.15}" height="${s * 0.13}"
    rx="${s * 0.02}" fill="${bg}" opacity="0.4"/>

  <!-- Right window -->
  <rect x="${wallRight - s * 0.19}" y="${wallTop + s * 0.08}" width="${s * 0.15}" height="${s * 0.13}"
    rx="${s * 0.02}" fill="${bg}" opacity="0.4"/>
</svg>`;
}

/** Favicon SVG — smaller, simpler */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#12936b" rx="6"/>
  <polygon points="16,4 3,16 29,16" fill="white"/>
  <rect x="6" y="15" width="20" height="13" rx="1" fill="white"/>
  <rect x="12" y="21" width="8" height="7" rx="1" fill="#12936b"/>
</svg>`;

const configs = [
  { name: "heim-192.png",          size: 192, padding: 0  },
  { name: "heim-512.png",          size: 512, padding: 0  },
  { name: "heim-192-maskable.png", size: 192, padding: 19 }, // 10% padding = ~19px
  { name: "heim-512-maskable.png", size: 512, padding: 51 }, // 10% padding = ~51px
  { name: "heim-180.png",          size: 180, padding: 0  }, // iOS Touch Icon
];

console.log("Generating Heim PWA icons…");

for (const { name, size, padding } of configs) {
  const svg = buildSVG(size, padding);
  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(PUBLIC, name));
  console.log(`  ✓ ${name} (${size}×${size}${padding ? `, ${padding}px padding` : ""})`);
}

// Favicon (32x32 ICO-as-PNG)
await sharp(Buffer.from(FAVICON_SVG))
  .resize(32, 32)
  .png()
  .toFile(join(PUBLIC, "favicon.png"));
console.log("  ✓ favicon.png (32×32)");

console.log("\nAll icons generated in public/");
