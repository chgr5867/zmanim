/**
 * dashboard.js — תצוגת "לוח זמנים" חי בסגנון שעון LED של בית כנסת:
 * שעה רצה, תאריך עברי ולועזי, זמני היום העיקריים, זמני השבת הקרובה,
 * והדגשת הזמן הקרוב הבא עם ספירה לאחור.
 * המיקום והשיטה נטענים מהמצב השמור של האפליקציה הראשית (localStorage).
 */
(function () {
  'use strict';

  // מצב "מיני" לחלון צף קטן על שולחן העבודה (dashboard.html?mini=1)
  if (new URLSearchParams(location.search).has('mini')) {
    document.body.classList.add('led-mini');
  }

  var STORAGE_KEY = ZmanimCommon.STORAGE_KEY;

  var loc = null;
  var method = null;

  // ---------- טעינת מצב ----------

  function loadSettings() {
    var methodId = 'itim-levina';
    var customMethod = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved.loc) loc = saved.loc;
        if (saved.methodId) methodId = saved.methodId;
        if (saved.customMethod) customMethod = saved.customMethod;
      }
    } catch (e) { /* התעלמות */ }

    if (!loc) {
      var jm = ZmanimCities.getById('jerusalem');
      loc = { name: jm.name, lat: jm.lat, lon: jm.lon, elevation: jm.elevation, tz: jm.tz, candleMinutes: jm.candleMinutes };
    }
    if (methodId === 'custom' && customMethod) method = customMethod;
    else method = ZmanimMethods.getById(methodId) || ZmanimMethods.getById('itim-levina') || ZmanimMethods.METHODS[0];
  }

  // ---------- תאריכים (הפונקציות המשותפות ב-common.js) ----------

  var todayInTZ = ZmanimCommon.todayInTZ;
  var shiftDate = ZmanimCommon.shiftDate;
  var noonUTC = ZmanimCommon.noonUTC;
  var dateKey = ZmanimCommon.dateKey;

  // ---------- חישוב ----------

  /** המנוע (engine.js) מחשב את הנרות מהערכים הלא-מעוגלים ומעגל לחומרא */
  function candlesTime(result) {
    return result.candles != null ? result.candles : null;
  }

  /** כל זמני היום (לחישוב "הזמן הבא"), ממוינים לפי הסדר הקבוע */
  function dayRows(d) {
    var result = ZmanimEngine.computeDay(d, loc, method);
    var noon = noonUTC(d);
    var dow = HebrewUtils.dayOfWeek(noon, 'UTC');
    var erevChag = HebrewUtils.erevChagName(noon, 'UTC');
    var showCandles = dow === 5 || (erevChag && dow !== 6);
    var rows = [];
    ZmanimMethods.ZMAN_ORDER.forEach(function (key) {
      var time = null, name = ZmanimMethods.ZMAN_NAMES[key];
      if (key === 'candles') {
        if (!showCandles) return;
        time = candlesTime(result);
        if (erevChag) name = 'הדלקת נרות (' + erevChag + ')';
      } else {
        if (!(key in (method.zmanim || {}))) return;
        if (key === 'tzeisShabbat' && dow !== 6) return;
        time = result[key];
      }
      if (time != null) rows.push({ key: key, name: name, time: time });
    });
    rows.sort(function (a, b) { return a.time - b.time; });
    return rows;
  }

  /** זמני השבת הקרובה: הדלקת נרות (יום שישי) וצאת שבת */
  function shabbatTimes(today) {
    var dow = HebrewUtils.dayOfWeek(noonUTC(today), 'UTC');
    // בשבת עצמה — השבת הנוכחית (שישי אתמול); בשאר הימים — יום שישי הקרוב
    var daysToFriday = dow === 6 ? -1 : (5 - dow + 7) % 7;
    var friday = shiftDate(today, daysToFriday);
    var shabbat = shiftDate(friday, 1);
    var friResult = ZmanimEngine.computeDay(friday, loc, method);
    var satResult = ZmanimEngine.computeDay(shabbat, loc, method);
    return {
      candles: candlesTime(friResult),
      tzeis: satResult.tzeisShabbat != null ? satResult.tzeisShabbat : satResult.tzeis
    };
  }

  // ---------- רינדור ----------

  function el(id) { return document.getElementById(id); }

  var pad = ZmanimCommon.pad2;

  /** ספירה לאחור חיה: "בעוד 2:07:31" (או "בעוד 07:31" מתחת לשעה) */
  function formatCountdown(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var digits = h > 0 ? h + ':' + pad(m) + ':' + pad(sec) : pad(m) + ':' + pad(sec);
    return 'בעוד ⁦' + digits + '⁩';
  }

  // העמודות הקבועות בשורה התחתונה (מימין לשמאל)
  var CELLS = [
    { key: 'alos', label: 'עלות השחר' },
    { key: 'sunrise', label: 'זריחה' },
    { key: 'chatzos', label: 'חצות' },
    { key: 'sunset', label: 'שקיעה' },
    { key: 'tzeis', label: 'צאה״כ' },
    { key: 'tzeisRT', label: 'ר״ת' },
    { key: 'shabbat-candles', label: 'כנ. שבת' },
    { key: 'shabbat-tzeis', label: 'צ. שבת' }
  ];

  var cache = { key: null, rows: null, result: null, shabbat: null };

  function computeForToday(today) {
    var k = dateKey(today);
    if (cache.key !== k) {
      cache.key = k;
      cache.rows = dayRows(today);
      cache.result = ZmanimEngine.computeDay(today, loc, method);
      cache.shabbat = shabbatTimes(today);
    }
    return cache;
  }

  function renderStatic(today) {
    var noon = noonUTC(today);
    el('dash-hebrew-date').textContent = HebrewUtils.hebrewDate(noon, 'UTC');
    el('dash-greg-date').textContent = pad(today.day) + '/' + pad(today.month) + '/' + today.year;
    el('dash-weekday').textContent = HebrewUtils.weekdayName(noon, 'UTC').replace('יום ', '');
    var par = ParashaUtils.weekly(today);
    el('dash-parasha').textContent = par ? par.name : '—';
    el('dash-location').textContent = loc.name || '';
    el('dash-method').textContent = 'לפי שיטת ' + method.name.split(' — ')[0] +
      (loc.name ? ' · ' + loc.name : '');
  }

  var currentNext = null; // הזמן הקרוב הבא — לספירה לאחור החיה

  function renderZmanim(today, now) {
    var data = computeForToday(today);

    // הזמן הבא
    var next = null;
    for (var i = 0; i < data.rows.length; i++) {
      if (data.rows[i].time > now) { next = data.rows[i]; break; }
    }
    if (!next) {
      // אחרי הזמן האחרון של היום — הזמן הראשון של מחר
      var tomorrowRows = dayRows(shiftDate(today, 1));
      if (tomorrowRows.length) {
        next = { key: tomorrowRows[0].key, name: tomorrowRows[0].name + ' (מחר)', time: tomorrowRows[0].time };
      }
    }
    currentNext = next;
    if (next) {
      el('dash-next-name').textContent = next.name;
      el('dash-next-time').textContent = HebrewUtils.formatTime(next.time, loc.tz);
      el('dash-next-count').textContent = formatCountdown(next.time - now);
    } else {
      el('dash-next-name').textContent = 'הזמן הבא';
      el('dash-next-time').textContent = '—';
      el('dash-next-count').textContent = '';
    }

    // שורת העמודות
    var box = el('dash-zmanim');
    box.innerHTML = '';
    CELLS.forEach(function (c) {
      var time = null;
      if (c.key === 'shabbat-candles') time = data.shabbat.candles;
      else if (c.key === 'shabbat-tzeis') time = data.shabbat.tzeis;
      else time = data.result[c.key];
      if (time == null) return;

      var cell = document.createElement('div');
      cell.className = 'led-cell';
      if (next && c.key === next.key && time === next.time) cell.className += ' cell-next';
      else if (c.key !== 'shabbat-candles' && c.key !== 'shabbat-tzeis' && time < now) cell.className += ' cell-passed';

      var name = document.createElement('span');
      name.className = 'cell-name';
      name.textContent = c.label;
      var t = document.createElement('span');
      t.className = 'cell-time';
      t.textContent = HebrewUtils.formatTime(time, loc.tz);
      cell.appendChild(name);
      cell.appendChild(t);
      box.appendChild(cell);
    });
  }

  // ---------- לולאת עדכון ----------

  var lastDateKey = null;
  var lastMinute = -1;

  function tick() {
    var now = Date.now();
    el('dash-clock').textContent = HebrewUtils.formatTime(now, loc.tz, true);

    var today = todayInTZ(loc.tz);
    var minute = Math.floor(now / 60000);
    if (dateKey(today) !== lastDateKey) {
      lastDateKey = dateKey(today);
      renderStatic(today);
      renderZmanim(today, now);
      lastMinute = minute;
    } else if (minute !== lastMinute || (currentNext && currentNext.time <= now)) {
      // רענון בתחילת כל דקה, ומיד כשהזמן הבא מגיע
      lastMinute = minute;
      renderZmanim(today, now);
    } else if (currentNext) {
      el('dash-next-count').textContent = formatCountdown(currentNext.time - now);
    }
  }

  // מניעת כיבוי המסך — חיוני כשהלוח מוצב כתצוגת קיר
  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').catch(function () { /* לא נתמך / נדחה */ });
  }

  function init() {
    loadSettings();
    tick();
    setInterval(tick, 1000);

    requestWakeLock();
    document.addEventListener('visibilitychange', function () {
      // הנעילה משתחררת כשהטאב מוסתר — מבקשים שוב בחזרה אליו
      if (document.visibilityState === 'visible') requestWakeLock();
    });

    // מסך מלא בלחיצה כפולה — נוח כשמציבים מסך על הקיר
    el('led-panel').addEventListener('dblclick', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () { /* לא נתמך */ });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
