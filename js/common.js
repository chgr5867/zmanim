/**
 * common.js — פונקציות משותפות לאפליקציה הראשית (app.js) וללוח הקיר (dashboard.js):
 * עבודה עם תאריכים אזרחיים {year, month, day} באזורי זמן, ומפתח האחסון המשותף.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'zmanim-app-state-v1';

  /** אזור הזמן של הדפדפן, עם נפילה לירושלים */
  function browserTZ() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';
    } catch (e) {
      return 'Asia/Jerusalem';
    }
  }

  /** התאריך האזרחי "היום" באזור זמן נתון */
  function todayInTZ(tz) {
    var s = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz
    }).format(new Date());
    var parts = s.split('-');
    return { year: +parts[0], month: +parts[1], day: +parts[2] };
  }

  /** הזזת תאריך אזרחי במספר ימים (חיובי/שלילי) */
  function shiftDate(d, days) {
    var nd = new Date(Date.UTC(d.year, d.month - 1, d.day + days, 12));
    return { year: nd.getUTCFullYear(), month: nd.getUTCMonth() + 1, day: nd.getUTCDate() };
  }

  /** צהרי היום האזרחי — לתאריך עברי ויום בשבוע (מפוענחים ב-UTC) */
  function noonUTC(d) {
    return new Date(Date.UTC(d.year, d.month - 1, d.day, 12));
  }

  function isSameDate(a, b) {
    return a.year === b.year && a.month === b.month && a.day === b.day;
  }

  function dateKey(d) { return d.year + '-' + d.month + '-' + d.day; }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  global.ZmanimCommon = {
    STORAGE_KEY: STORAGE_KEY,
    browserTZ: browserTZ,
    todayInTZ: todayInTZ,
    shiftDate: shiftDate,
    noonUTC: noonUTC,
    isSameDate: isSameDate,
    dateKey: dateKey,
    pad2: pad2
  };
})(typeof window !== 'undefined' ? window : globalThis);
