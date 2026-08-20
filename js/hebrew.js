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

  global.HebrewUtils = {
    hebrewDate: hebrewDate,
    hebrewDateShort: hebrewDateShort,
    gematria: gematria,
    weekdayName: weekdayName,
    gregorianDate: gregorianDate,
    formatTime: formatTime,
    dayOfWeek: dayOfWeek,
    hebrewParts: hebrewParts,
    erevChagName: erevChagName
  };
})(typeof window !== 'undefined' ? window : globalThis);
