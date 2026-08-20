/**
 * bump-version.mjs — העלאת גרסת המטמון במקום אחד.
 * מעדכן יחד את CACHE_NAME ב-sw.js ואת כל פרמטרי ?v= ב-sw.js,
 * index.html ו-dashboard.html — כך שאי אפשר לשכוח אחד מהם.
 *
 * הפעלה:  node tools/bump-version.mjs        (מעלה ב-1)
 *          node tools/bump-version.mjs 30     (קובע גרסה מפורשת)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swPath = join(root, 'sw.js');

const sw = readFileSync(swPath, 'utf8');
const m = sw.match(/CACHE_NAME = 'zmanim-cache-v(\d+)'/);
if (!m) {
  console.error('CACHE_NAME לא נמצא ב-sw.js');
  process.exit(1);
}
const current = +m[1];
const next = process.argv[2] ? +process.argv[2] : current + 1;
if (!Number.isInteger(next) || next <= 0) {
  console.error('גרסה לא תקינה: ' + process.argv[2]);
  process.exit(1);
}

for (const file of ['sw.js', 'index.html', 'dashboard.html']) {
  const p = join(root, file);
  const before = readFileSync(p, 'utf8');
  const after = before
    .replace(/zmanim-cache-v\d+/g, 'zmanim-cache-v' + next)
    .replace(/\?v=\d+/g, '?v=' + next);
  if (after !== before) {
    writeFileSync(p, after);
    console.log(`${file}: v${current} → v${next}`);
  }
}
