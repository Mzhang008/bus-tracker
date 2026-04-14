#!/usr/bin/env node

/**
 * Post-export hook — copies Cloudflare Pages config files from public/ to dist/
 *
 * Expo's web export does not reliably copy underscore-prefixed files from the
 * public directory to the output, so we do it explicitly here.  Runs after
 * `expo export --platform web` via the export:web npm script.
 */

const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "..", "public");
const distDir = path.join(__dirname, "..", "dist");

if (!fs.existsSync(distDir)) {
  console.error(`[post-export] dist/ does not exist at ${distDir} — did expo export run?`);
  process.exit(1);
}

const filesToCopy = ["_redirects", "_headers"];

for (const filename of filesToCopy) {
  const src = path.join(publicDir, filename);
  const dst = path.join(distDir, filename);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`[post-export] copied ${filename} → dist/`);
  } else {
    console.warn(`[post-export] ${filename} not found in public/ — skipped`);
  }
}
