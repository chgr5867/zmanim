/**
 * hebrew.js — תאריך עברי והצגת זמנים, באמצעות Intl API המובנה בדפדפן
 */
(function (global) {
  'use strict';

  /** המרת מספר (1..999) לאותיות גימטריה עם גרש/גרשיים: 7→ז׳, 15→ט״ו, 786→תשפ״ו */
  function gematria(n) {
    var ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    var tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    var hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
    if (n <= 0 || n > 999) return String(n);
    var s = hundreds[Math.floor(n / 100)];
    var rem = n % 100;
    if (rem === 15) s += 'טו';
    else if (rem === 16) s += 'טז';
    else s += tens[Math.floor(rem / 10)] + ones[rem % 10];
    if (s.length === 1) return s + '׳';
    return s.slice(0, -1) + '״' + s.slice(-1);
  }

  /** שנה עברית באותיות (בהשמטת האלפים): 5786→תשפ״ו */
  function gematriaYear(y) {
    return gematria(y % 1000);
  }

  /** תאריך עברי באותיות (למשל: "ז׳ באלול תשפ״ו") עבור תאריך לועזי נתון */
  function hebrewDate(dateObj, tz) {
    try {
      // מספרי יום ושנה — מהלוקאל האנגלי (ספרות בטוחות); שם החודש — בעברית
      var numFmt = new Intl.DateTimeFormat('en-u-ca-hebrew', {
        day: 'numeric', year: 'numeric', timeZone: tz || undefined
      });
      var monthFmt = new Intl.DateTimeFormat('he-u-ca-hebrew', {
        month: 'long', timeZone: tz || undefined
      });
      var day = 0, year = 0;
      var parts = numFmt.formatToParts(dateObj);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'day') day = +parts[i].value;
        if (parts[i].type === 'year') year = +parts[i].value;
      }
      var month = monthFmt.format(dateObj);
      return gematria(day) + ' ב' + month + ' ' + gematriaYear(year);
    } catch (e) {
      return '';
    }
  }

  /** תאריך עברי קצר באותיות ללא שנה (למשל: "ז׳ אלול") */
  function hebrewDateShort(dateObj, tz) {
    try {
      var numFmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', timeZone: tz || undefined });
      var monthFmt = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long', timeZone: tz || undefined });
      var day = 0;
      var parts = numFmt.formatToParts(dateObj);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'day') day = +parts[i].value;
      }
      return gematria(day) + ' ' + monthFmt.format(dateObj);
    } catch (e) {
      return '';
    }
  }

  /** שם היום בשבוע בעברית */
  function weekdayName(dateObj, tz) {
    try {
      var fmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: tz || undefined });
      return fmt.format(dateObj);
    } catch (e) {
      return '';
    }
  }

  /** תאריך לועזי להצגה */
  function gregorianDate(dateObj, tz) {
    try {
      var fmt = new Intl.DateTimeFormat('he-IL', {
        day: 'numeric', month: 'long', year: 'numeric',
        timeZone: tz || undefined
      });
      return fmt.format(dateObj);
    } catch (e) {
      return '';
    }
  }

  /** עיצוב שעה HH:MM (או HH:MM:SS) באזור זמן נתון */
  function formatTime(timestamp, tz, withSeconds) {
    if (timestamp == null || isNaN(timestamp)) return '—';
    try {
      var opts = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || undefined };
      if (withSeconds) opts.second = '2-digit';
      return new Intl.DateTimeFormat('he-IL', opts).format(new Date(timestamp));
    } catch (e) {
      return '—';
    }
  }

  /** מספר היום בשבוע (0=ראשון .. 6=שבת) של תאריך אזרחי באזור זמן נתון */
  function dayOfWeek(dateObj, tz) {
    try {
      var fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz || undefined });
      var name = fmt.format(dateObj);
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
    } catch (e) {
      return dateObj.getDay();
    }
  }

  /** יום וחודש עבריים כערכים מספריים/מחרוזת — לזיהוי מועדים */
  function hebrewParts(dateObj, tz) {
    try {
      var fmt = new Intl.DateTimeFormat('en-u-ca-hebrew', {
        day: 'numeric', month: 'long', timeZone: tz || undefined
      });
      var parts = fmt.formatToParts(dateObj);
      var out = { day: 0, month: '' };
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'day') out.day = +parts[i].value;
        if (parts[i].type === 'month') out.month = parts[i].value;
      }
      return out;
    } catch (e) {
      return { day: 0, month: '' };
    }
  }

  /**
   * ערבי יום טוב (לפי מנהג ארץ ישראל — יום טוב אחד).
   * בחו"ל יש ימים נוספים (יו"ט שני) שאינם מסומנים כאן.
   */
  var EREV_CHAGIM = {
    'Nisan-14': 'ערב פסח',
    'Nisan-20': 'ערב שביעי של פסח',
    'Sivan-5': 'ערב שבועות',
    'Elul-29': 'ערב ראש השנה',
    'Tishri-9': 'ערב יום כיפור',
    'Tishri-14': 'ערב סוכות',
    'Tishri-21': 'ערב שמיני עצרת'
  };

  /** אם התאריך הוא ערב חג — מחזיר את שמו, אחרת null */
  function erevChagName(dateObj, tz) {
    var p = hebrewParts(dateObj, tz);
    return EREV_CHAGIM[p.month + '-' + p.day] || null;
  }

  /** מספר השנה העברית (למשל 5786) של תאריך לועזי */
  function hebrewYearNum(dateObj) {
    var parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric', timeZone: 'UTC' })
      .formatToParts(dateObj);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'year') return +parts[i].value;
    }
    return 0;
  }

  var _yearMonthsCache = {};

  /**
   * חודשי שנה עברית נתונה, לפי הסדר, על ידי סריקת הימים מסביב לראש השנה.
   * מחזיר [{en, he, start:{year,month,day}, days}] — en לזיהוי, he להצגה.
   */
  function monthsOfHebrewYear(hebYear) {
    if (_yearMonthsCache[hebYear]) return _yearMonthsCache[hebYear];
    var enFmt = new Intl.DateTimeFormat('en-u-ca-hebrew', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
    var heFmt = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long', timeZone: 'UTC' });
    // ראש השנה של hebYear חל בספטמבר–אוקטובר של השנה הלועזית hebYear-3761;
    // סורקים מ-15 באוגוסט 390 ימים — מכסה גם שנה מעוברת (385 ימים).
    var startMs = Date.UTC(hebYear - 3761, 7, 15, 12);
    var months = [], current = null;
    for (var i = 0; i < 400; i++) {
      var dt = new Date(startMs + i * 86400000);
      var year = 0, month = '', day = 0;
      var parts = enFmt.formatToParts(dt);
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].type === 'year') year = +parts[j].value;
        if (parts[j].type === 'month') month = parts[j].value;
        if (parts[j].type === 'day') day = +parts[j].value;
      }
      if (year < hebYear) continue;
      if (year > hebYear) break;
      if (!current || current.en !== month) {
        current = {
          en: month, he: heFmt.format(dt), days: 0,
          start: { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() }
        };
        // הסריקה מתחילה באמצע אלול של השנה הקודמת, כך שכל חודש נתפס מיומו הראשון
        if (day !== 1) current._partial = true;
        months.push(current);
      }
      current.days = day > current.days ? day : current.days;
    }
    _yearMonthsCache[hebYear] = months;
    return months;
  }

  /** תאריך לועזי {year,month,day} של יום עברי נתון (או null אם אינו קיים) */
  function findGregorian(hebYear, monthEn, hebDay) {
    var months = monthsOfHebrewYear(hebYear);
    for (var i = 0; i < months.length; i++) {
      if (months[i].en !== monthEn) continue;
      if (hebDay < 1 || hebDay > months[i].days) return null;
      var s = months[i].start;
      var dt = new Date(Date.UTC(s.year, s.month - 1, s.day + hebDay - 1, 12));
      return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
    }
    return null;
  }

  global.HebrewUtils = {
    hebrewDate: hebrewDate,
    hebrewDateShort: hebrewDateShort,
    gematria: gematria,
    weekdayName: weekdayName,
    gregorianDate: gregorianDate,
    formatTime: formatTime,
    dayOfWeek: dayOfWeek,
    hebrewParts: hebrewParts,
    erevChagName: erevChagName,
    hebrewYearNum: hebrewYearNum,
    monthsOfHebrewYear: monthsOfHebrewYear,
    findGregorian: findGregorian
  };
})(typeof window !== 'undefined' ? window : globalThis);
