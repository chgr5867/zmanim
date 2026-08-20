/**
 * run-tests.mjs — בדיקות עוגן למנוע חישוב הזמנים (ללא תלויות).
 *
 * שני רבדים:
 * 1. בדיקות היגיון — סדר הזמנים הכרחי (עלות < הנץ < חצות < שקיעה < צאת וכו')
 *    בכל שיטה, בכמה מקומות ובכמה עונות.
 * 2. בדיקות רגרסיה — השוואה מלאה מול ערכים קפואים ב-expected.json,
 *    כדי שכל שינוי עתידי בקוד שמזיז זמן כלשהו יתגלה מיד.
 *
 * הפעלה:   node tests/run-tests.mjs
 * עדכון:   node tests/run-tests.mjs --update   (אחרי שינוי מכוון בחישוב —
 *           לבדוק את ההפרשים מול לוח מודפס לפני שמקבעים!)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['js/solar.js', 'js/engine.js', 'js/methods.js', 'js/cities.js']) {
  (0, eval)(readFileSync(join(root, f), 'utf8'));
}

const { ZmanimEngine, ZmanimMethods, ZmanimCities } = globalThis;

// תאריכי עוגן: סביב שני היפוכי השמש, שני השוויונות, ואמצע קיץ/חורף
const DATES = [
  { year: 2026, month: 3, day: 20 },   // שוויון האביב
  { year: 2026, month: 6, day: 21 },   // היפוך הקיץ
  { year: 2026, month: 8, day: 21 },
  { year: 2026, month: 9, day: 23 },   // שוויון הסתיו
  { year: 2026, month: 12, day: 21 },  // היפוך החורף
  { year: 2027, month: 1, day: 15 }
];

const CITY_IDS = ['jerusalem', 'bnei-brak', 'tzfat', 'new-york', 'london', 'melbourne'];

function fmtUTC(ts) {
  if (ts == null) return null;
  return new Date(ts).toISOString().slice(0, 16); // דיוק דקה — הזמנים מעוגלים לדקה
}

let failures = 0;
function fail(msg) {
  failures++;
  console.error('  ✗ ' + msg);
}

// ---------- רובד 1: סדר הזמנים ----------

const ORDER_CHAINS = [
  ['alos', 'misheyakir', 'sunrise', 'sofShmaGRA', 'sofTfilaGRA', 'chatzos',
    'minchaGedola', 'minchaKetana', 'plag', 'sunset', 'tzeis', 'tzeisRT'],
  ['alos', 'sofShmaMGA', 'sofShmaGRA'],
  ['sunset', 'tzeis', 'tzeisShabbat']
];

// בקווי רוחב גבוהים (לונדון) חלק מהיחסים מתהפכים באופן לגיטימי —
// עלות 72 דקות שוות אחרי משיכיר במעלות בקיץ, פלג מג"א אחרי השקיעה בחורף.
// לכן בדיקות הסדר רצות רק עד 45°; הערים הצפוניות מכוסות ברובד הרגרסיה.
let logicChecks = 0;
for (const cityId of CITY_IDS) {
  const loc = ZmanimCities.getById(cityId);
  if (Math.abs(loc.lat) > 45) continue;
  for (const d of DATES) {
    for (const method of ZmanimMethods.METHODS) {
      const r = ZmanimEngine.computeDay(d, loc, method);
      for (const chain of ORDER_CHAINS) {
        let prevKey = null, prevTs = null;
        for (const key of chain) {
          const ts = r[key];
          if (ts == null) continue;
          if (prevTs != null && ts < prevTs) {
            fail(`${cityId} ${d.year}-${d.month}-${d.day} ${method.id}: ${key} (${fmtUTC(ts)}) לפני ${prevKey} (${fmtUTC(prevTs)})`);
          }
          prevKey = key; prevTs = ts;
          logicChecks++;
        }
      }
      // הדלקת נרות לפני השקיעה
      if (r.candles != null && r.sunset != null && r.candles >= r.sunset) {
        fail(`${cityId} ${d.year}-${d.month}-${d.day} ${method.id}: נרות אחרי השקיעה`);
      }
    }
  }
}
console.log(`בדיקות סדר: ${logicChecks} השוואות` + (failures ? '' : ' — תקין'));

// ---------- רובד 2: רגרסיה מול ערכים קפואים ----------

const snapshot = {};
for (const cityId of CITY_IDS) {
  const loc = ZmanimCities.getById(cityId);
  for (const d of DATES) {
    for (const method of ZmanimMethods.METHODS) {
      const r = ZmanimEngine.computeDay(d, loc, method);
      const key = `${cityId}|${d.year}-${d.month}-${d.day}|${method.id}`;
      const times = {};
      for (const k of ZmanimMethods.ZMAN_ORDER) {
        if (k in r) times[k] = fmtUTC(r[k]);
      }
      if (r.candles != null) times.candles = fmtUTC(r.candles);
      snapshot[key] = times;
    }
  }
}

const expectedPath = join(root, 'tests', 'expected.json');
if (process.argv.includes('--update')) {
  writeFileSync(expectedPath, JSON.stringify(snapshot, null, 1) + '\n');
  console.log(`expected.json עודכן — ${Object.keys(snapshot).length} צירופים`);
} else {
  let expected;
  try {
    expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
  } catch (e) {
    console.error('expected.json חסר — יש להריץ פעם אחת עם --update');
    process.exit(1);
  }
  let compared = 0;
  for (const key of Object.keys(expected)) {
    const exp = expected[key], got = snapshot[key];
    if (!got) { fail(`חסר בחישוב: ${key}`); continue; }
    for (const zman of Object.keys(exp)) {
      compared++;
      if (got[zman] !== exp[zman]) {
        fail(`${key} ${zman}: צפוי ${exp[zman]}, התקבל ${got[zman]}`);
      }
    }
  }
  for (const key of Object.keys(snapshot)) {
    if (!expected[key]) fail(`צירוף חדש שאינו ב-expected.json: ${key} (להריץ --update)`);
  }
  console.log(`בדיקות רגרסיה: ${compared} זמנים` + (failures ? '' : ' — תקין'));
}

if (failures) {
  console.error(`\n${failures} כשלונות`);
  process.exit(1);
}
console.log('\nכל הבדיקות עברו ✓');
