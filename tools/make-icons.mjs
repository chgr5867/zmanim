/**
 * make-icons.mjs — יצירת אייקוני PNG מתוך עיצוב האייקון (בלי תלויות חיצוניות).
 * מצייר את קומפוזיציית השמש/אופק של icon.svg לפיקסלים (בדגימת-יתר פי 4)
 * ומקודד PNG עם zlib המובנה של Node.
 *
 * הפעלה:  node tools/make-icons.mjs
 * פלט:    icons/icon-512.png, icons/icon-192.png, icons/apple-touch-icon.png (180)
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const NAVY = [26, 58, 92];
const GOLD = [227, 193, 87];
const WHITE = [232, 238, 245];

/** מרחק נקודה מקטע (לקווים עם קצה מעוגל) */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** ציור האייקון בקנבס RGBA ברזולוציית-יתר, בקואורדינטות בסיס 512 */
function render(size) {
  const SS = 4;                      // דגימת-יתר להחלקת קצוות
  const N = size * SS;
  const k = N / 512;                 // סקלת קואורדינטות הבסיס
  const px = new Uint8Array(N * N * 3);

  // הקומפוזיציה: אופק ב-y=310, שמש r=135 שקועה חציה, קרניים מעל
  const HY = 310 * k, CX = 256 * k, R = 135 * k;
  const horizon = [76 * k, HY, 436 * k, HY, 8 * k];   // x1,y1,x2,y2,חצי-עובי
  const rays = [
    [256, 100, 256, 48], [143, 138, 106, 101], [369, 138, 406, 101],
    [98, 245, 46, 234], [414, 245, 466, 234]
  ].map(r => [r[0] * k, r[1] * k, r[2] * k, r[3] * k, 9 * k]);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let c = NAVY;
      // השמש — עיגול שרק חלקו העליון (מעל האופק) נראה
      const d = Math.hypot(x - CX, y - HY);
      if (d <= R && y <= HY) c = GOLD;
      // קרניים
      for (const [x1, y1, x2, y2, hw] of rays) {
        if (distToSegment(x, y, x1, y1, x2, y2) <= hw) { c = GOLD; break; }
      }
      // קו האופק — מעל הכול
      if (distToSegment(x, y, horizon[0], horizon[1], horizon[2], horizon[3]) <= horizon[4]) c = WHITE;
      const i = (y * N + x) * 3;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
    }
  }

  // הקטנה בממוצע SSxSS
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * N + (x * SS + sx)) * 3;
          r += px[i]; g += px[i + 1]; b += px[i + 2];
        }
      }
      const n = SS * SS, o = (y * size + x) * 3;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
    }
  }
  return out;
}

// ---------- קידוד PNG ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgb, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // עומק ביט
  ihdr[9] = 2;   // צבע RGB
  // שורות עם בייט פילטר 0 בתחילת כל שורה
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    Buffer.from(rgb.buffer, y * size * 3, size * 3).copy(raw, row + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(join(root, 'icons'), { recursive: true });
for (const [size, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'apple-touch-icon.png']]) {
  const png = encodePNG(render(size), size);
  writeFileSync(join(root, 'icons', name), png);
  console.log(`icons/${name}  ${png.length} bytes`);
}
