/**
 * Validate the app icon before a build wastes twenty minutes on it.
 *
 * Reads the PNG header directly — no dependency, and everything worth checking is
 * in the first 26 bytes: the dimensions, and whether there is an alpha channel.
 *
 * Alpha is required of one icon and forbidden of another, which is the part that
 * catches people out. The default icon must be a flat opaque square — a submission
 * with alpha is rejected, and iOS applies the rounded corner itself. The dark and
 * tinted variants are the opposite: iOS composites those over its own backdrop, so
 * they need transparency to sit on it.
 *
 * Run with `npm run check:icons`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Colour types that carry an alpha channel, per the PNG spec. */
const ALPHA_COLOUR_TYPES = new Set([4, 6]);

const ICONS = [
  { path: 'assets/icon.png', required: true, label: 'app icon', alpha: 'forbidden' },
  { path: 'assets/icon-dark.png', required: false, label: 'dark app icon', alpha: 'any' },
  { path: 'assets/icon-tinted.png', required: false, label: 'tinted app icon', alpha: 'any' },
];

function inspect(file) {
  const buf = readFileSync(file);
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { error: 'not a PNG' };
  }
  // IHDR is always the first chunk: 8-byte signature, 4-byte length, 4-byte type.
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') {
    return { error: 'malformed PNG: no IHDR chunk' };
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colourType: buf.readUInt8(25),
  };
}

let failed = false;
const say = (ok, message) => {
  if (!ok) failed = true;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${message}`);
};

for (const icon of ICONS) {
  const file = resolve(process.cwd(), icon.path);
  if (!existsSync(file)) {
    if (icon.required) {
      say(false, `${icon.path} is missing — the ${icon.label} has to be there`);
    } else {
      console.log(`  --   ${icon.path} not supplied (optional)`);
    }
    continue;
  }

  const info = inspect(file);
  if (info.error) {
    say(false, `${icon.path}: ${info.error}`);
    continue;
  }

  say(
    info.width === 1024 && info.height === 1024,
    `${icon.path} is ${info.width}×${info.height} (needs 1024×1024)`
  );
  const hasAlpha = ALPHA_COLOUR_TYPES.has(info.colourType);
  if (icon.alpha === 'forbidden') {
    say(
      !hasAlpha,
      hasAlpha
        ? `${icon.path} has an alpha channel — App Store submission is rejected for ` +
          `this. Flatten it onto its background colour and re-export.`
        : `${icon.path} is opaque, as the default icon must be`
    );
  } else {
    console.log(`  ok   ${icon.path} ${hasAlpha ? 'has' : 'has no'} alpha (either is fine here)`);
  }
}

if (failed) {
  console.log('\nIcons are not ready to build.');
  process.exit(1);
}
console.log('\nIcons look right.');
