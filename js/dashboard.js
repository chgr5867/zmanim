/**
 * dashboard.js — תצוגת "לוח זמנים" חי בסגנון שעון LED של בית כנסת:
 * שעה רצה, תאריך עברי ולועזי, זמני היום העיקריים, זמני השבת הקרובה,
 * והדגשת הזמן הקרוב הבא עם ספירה לאחור.
 * המיקום והשיטה נטענים מהמצב השמור של האפליקציה הראשית (localStorage).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'zmanim-app-state-v1';

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

  // ---------- תאריכים ----------

  function todayInTZ(tz) {
    var s = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz
    }).format(new Date());
    var parts = s.split('-');
    return { year: +parts[0], month: +parts[1], day: +parts[2] };
  }

  function shiftDate(d, days) {
    var nd = new Date(Date.UTC(d.year, d.month - 1, d.day + days, 12));
    return { year: nd.getUTCFullYear(), month: nd.getUTCMonth() + 1, day: nd.getUTCDate() };
  }

  function noonUTC(d) {
    return new Date(Date.UTC(d.year, d.month - 1, d.day, 12));
  }

  function dateKey(d) { return d.year + '-' + d.month + '-' + d.day; }

  // ---------- חישוב ----------

  function candlesTime(result, forLoc) {
    var base = (method.candlesRef && result[method.candlesRef] != null)
      ? result[method.candlesRef] : result.sunset;
    if (base == null) return null;
    return base - (forLoc.candleMinutes || 18) * 60000;
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
        time = candlesTime(result, loc);
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
      candles: candlesTime(friResult, loc),
      tzeis: satResult.tzeisShabbat != null ? satResult.tzeisShabbat : satResult.tzeis
    };
  }

  // ---------- רינדור ----------

  function el(id) { return document.getElementById(id); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function formatCountdown(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h > 0) return 'בעוד ' + h + ':' + pad(m) + ' שע׳';
    if (m > 0) return 'בעוד ' + m + ' דק׳';
    return 'בעוד פחות מדקה';
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
    el('dash-location').textContent = loc.name || '';
    el('dash-method').textContent = 'לפי שיטת ' + method.name.split(' — ')[0] +
      (loc.name ? ' · ' + loc.name : '');
  }

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
    } else if (minute !== lastMinute) {
      lastMinute = minute;
      renderZmanim(today, now);
    }
  }

  function init() {
    loadSettings();
    tick();
    setInterval(tick, 1000);

    // מסך מלא בלחיצה כפולה — נוח כשמציבים מסך על הקיר
    el('led-panel').addEventListener('dblclick', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () { /* לא נתמך */ });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
