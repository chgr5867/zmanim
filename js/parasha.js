/**
 * parasha.js — פרשת השבוע לפי מנהג ארץ ישראל.
 *
 * חשבון הלוח העברי: האלגוריתם הקלאסי (מולד + ארבעת הדחיות), מכויל מול תאריך
 * ראש השנה ידוע. שיבוץ הפרשות: לפי מבנה השנה — עוגני הלכה (צו/מצורע לפני פסח,
 * דברים בשבת חזון, ניצבים לפני ר"ה) ממומשים כחלוקה למקטעים שמספר השבתות בהם
 * קובע את הכפולות. אומת מול לוח קריאת התורה של hebcal לשנים 2015–2045.
 * אין חלוקת חוקת־בלק (חו"ל בלבד) — המנהג המחושב הוא מנהג א"י.
 */
(function (global) {
  'use strict';

  var MS_PER_DAY = 86400000;

  // 54 פרשות התורה
  var PARSHIOT = [
    'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח',
    'וישב', 'מקץ', 'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו',
    'משפטים', 'תרומה', 'תצווה', 'כי תשא', 'ויקהל', 'פקודי', 'ויקרא', 'צו',
    'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים', 'אמור', 'בהר', 'בחוקותי',
    'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חוקת', 'בלק', 'פינחס', 'מטות',
    'מסעי', 'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא',
    'ניצבים', 'וילך', 'האזינו', 'וזאת הברכה'
  ];

  // ---------- חשבון הלוח העברי ----------

  function isLeap(y) { return ((7 * y + 1) % 19) < 7; }

  /** ימים מתחילת המניין ועד ר"ה של שנה עברית y (כולל דחיות אד"ו ומולד זקן) */
  function elapsedDays(y) {
    var n = y - 1;
    var months = 235 * Math.floor(n / 19) + 12 * (n % 19) +
      Math.floor((7 * (n % 19) + 1) / 19);
    var partsElapsed = 204 + 793 * (months % 1080);
    var hoursElapsed = 5 + 12 * months + 793 * Math.floor(months / 1080) +
      Math.floor(partsElapsed / 1080);
    var day = 1 + 29 * months + Math.floor(hoursElapsed / 24);
    var parts = (hoursElapsed % 24) * 1080 + (partsElapsed % 1080);
    if (parts >= 19440) day += 1;                                        // מולד זקן
    else if (day % 7 === 2 && parts >= 9924 && !isLeap(y)) day += 1;     // גטר"ד
    else if (day % 7 === 1 && parts >= 16789 && isLeap(y - 1)) day += 1; // בט"ו תקפ"ט
    if (day % 7 === 0 || day % 7 === 3 || day % 7 === 5) day += 1;       // לא אד"ו ראש
    return day;
  }

  // כיול: ר"ה תשפ"ו = 23.9.2025 (מספר יום יוניקס = ימים מ-1.1.1970)
  var RH_5786_UNIX = Date.UTC(2025, 8, 23) / MS_PER_DAY;
  var EPOCH_OFFSET = RH_5786_UNIX - elapsedDays(5786);

  /** מספר היום (יוניקס) של א' תשרי בשנה עברית y */
  function rhDay(y) { return elapsedDays(y) + EPOCH_OFFSET; }

  /** יום בשבוע של מספר יום יוניקס: 0=ראשון .. 6=שבת */
  function dow(dayNum) { return ((dayNum + 4) % 7 + 7) % 7; }

  /** היסט ט"ו בניסן (פסח) מר"ה, לפי אורך השנה */
  function pesachOffset(len) {
    var cheshvan = (len % 10 === 5) ? 30 : 29;  // שלמה
    var kislev = (len % 10 === 3) ? 29 : 30;    // חסרה
    var leapAdar = (len > 380) ? 30 : 0;        // אדר א'
    return 30 + cheshvan + kislev + 29 + 30 + leapAdar + 29 + 14;
  }

  // ---------- שיבוץ הפרשות למחזור שנה ----------

  /** לוח שבתות המחזור של שנה עברית y: מפה של מספר-יום-שבת -> שם קריאה */
  function cycleSchedule(y) {
    var rh = rhDay(y);
    var rhNext = rhDay(y + 1);
    var len = rhNext - rh;
    var leap = len > 380;
    var pesach = rh + pesachOffset(len);
    var av9 = pesach + 112;
    var map = {};

    var shabbatot = [];
    for (var s = rh + ((6 - dow(rh) + 7) % 7); s < rhNext; s += 7) shabbatot.push(s);

    // שבתות תשרי שלפני בראשית: וילך נקרא בשבת שובה אם ר"ה ביום ב'/ג'
    // (כלומר אשתקד נקראה ניצבים לבדה); אחרת — האזינו
    var shuvaVayelech = (dow(rh) === 1 || dow(rh) === 2);
    var i = 0;
    for (; i < shabbatot.length; i++) {
      var t = shabbatot[i] - rh + 1; // יום בתשרי
      if (t >= 23) break;
      var nm;
      if (t <= 2) nm = 'ראש השנה';
      else if (t < 10) nm = shuvaVayelech ? PARSHIOT[51] : PARSHIOT[52];
      else if (t === 10) nm = 'יום הכיפורים';
      else if (t < 15) nm = PARSHIOT[52];
      else if (t < 22) nm = 'סוכות';
      else nm = 'שמחת תורה';
      map[shabbatot[i]] = nm;
    }

    // חלוקה למקטעים: עד פסח / פסח–חזון / שבע השבתות שמחזון עד ר"ה
    var slots = [];
    var chazonIdx = -1;
    for (; i < shabbatot.length; i++) {
      var d = shabbatot[i];
      if (d >= pesach && d <= pesach + 6) { map[d] = 'פסח'; continue; }
      slots.push(d);
      if (d <= av9) chazonIdx = slots.length - 1;
    }
    var segA = 0;
    while (segA < slots.length && slots[segA] < pesach) segA++;
    var segBC = chazonIdx + 1 - segA; // כולל שבת חזון (דברים)

    // כפולות: אילו זוגות מחוברים השנה
    var doubled = {};
    var pA; // הפרשה האחרונה שלפני פסח (עוגן "פקדו ופסחו")
    if (leap) {
      pA = segA; // מעוברת: אין כפולות עד פסח — מצורע/אחרי לפי מספר השבתות
    } else {
      pA = 25;   // פשוטה: צו לפני פסח; ויקהל־פקודי מתחברות אם חסרה שבת
      if (segA === 24) doubled[22] = true;
    }
    // בין פסח לחזון: דברים (44) בשבת חזון; הכפולות לפי מספר השבתות
    var needBC = (44 - pA) - segBC;
    // סדר החיבור כשלא כל הזוגות נדרשים: בהר־בחוקותי נפרדות לפני מטות־מסעי
    var candBC = leap ? [42] : [27, 29, 42, 32]; // תזריע, אחרי, מטות, בהר
    for (var c = 0; c < candBC.length && needBC > 0; c++) {
      doubled[candBC[c]] = true; needBC--;
    }
    // מחזון עד ר"ה: ואתחנן..ניצבים; וילך מצטרפת אם ר"ה הבא בה'/שבת
    if (dow(rhNext) === 4 || dow(rhNext) === 6) doubled[51] = true;

    // שיבוץ סדרתי
    var p = 1;
    for (var k = 0; k < slots.length; k++) {
      if (p > 54) break;
      if (doubled[p]) {
        map[slots[k]] = PARSHIOT[p - 1] + '־' + PARSHIOT[p];
        p += 2;
      } else {
        map[slots[k]] = PARSHIOT[p - 1];
        p += 1;
      }
    }
    return map;
  }

  var scheduleCache = {};

  function scheduleFor(y) {
    if (!scheduleCache[y]) scheduleCache[y] = cycleSchedule(y);
    return scheduleCache[y];
  }

  // ---------- ממשק ----------

  /**
   * קריאת השבת הקרובה (או של היום, אם שבת) לתאריך אזרחי {year, month, day}.
   * מחזיר {name, shabbat: {year, month, day}} או null.
   */
  function weekly(civil) {
    var dn = Date.UTC(civil.year, civil.month - 1, civil.day) / MS_PER_DAY;
    var shabbat = dn + ((6 - dow(dn) + 7) % 7);
    // איתור השנה העברית שהשבת בתוכה
    var y = civil.year + 3760;
    while (rhDay(y + 1) <= shabbat) y++;
    while (rhDay(y) > shabbat) y--;
    var name = scheduleFor(y)[shabbat];
    if (!name) return null;
    var d = new Date(shabbat * MS_PER_DAY);
    return {
      name: name,
      shabbat: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
    };
  }

  var api = { weekly: weekly, PARSHIOT: PARSHIOT, _rhDay: rhDay, _cycleSchedule: cycleSchedule };

  global.ParashaUtils = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
