/**
 * app.js — לוגיקת הממשק: מיקום (GPS / עיר / כתובת), תאריך, בחירת שיטה,
 * תצוגות יומי/שבועי/השוואה, ועורך שיטה אישית.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'zmanim-app-state-v1';

  var state = {
    date: null,          // {year, month, day} — תאריך אזרחי מוצג
    loc: null,           // {name, lat, lon, elevation, tz, candleMinutes}
    methodId: 'itim-levina',
    lastPresetId: 'itim-levina',
    view: 'daily',       // daily | weekly | compare
    customMethod: null,
    customSelections: {}
  };

  // ---------- אחסון ----------

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        loc: state.loc,
        methodId: state.methodId,
        lastPresetId: state.lastPresetId,
        view: state.view,
        customMethod: state.customMethod,
        customSelections: state.customSelections
      }));
    } catch (e) { /* אחסון לא זמין */ }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved.loc) state.loc = saved.loc;
      if (saved.methodId) state.methodId = saved.methodId;
      if (saved.lastPresetId) state.lastPresetId = saved.lastPresetId;
      if (saved.view) state.view = saved.view;
      if (saved.customMethod) state.customMethod = saved.customMethod;
      if (saved.customSelections) state.customSelections = saved.customSelections;
    } catch (e) { /* התעלמות */ }
  }

  // ---------- תאריכים ----------

  function browserTZ() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';
    } catch (e) {
      return 'Asia/Jerusalem';
    }
  }

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

  function dateToInputValue(d) {
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.year + '-' + pad(d.month) + '-' + pad(d.day);
  }

  /** צהרי היום האזרחי — לתאריך עברי ויום בשבוע (מפוענחים ב-UTC) */
  function dateAtNoonUTC(d) {
    return new Date(Date.UTC(d.year, d.month - 1, d.day, 12));
  }

  function isSameDate(a, b) {
    return a.year === b.year && a.month === b.month && a.day === b.day;
  }

  // ---------- שיטות ----------

  function currentMethod() {
    if (state.methodId === 'custom' && state.customMethod) return state.customMethod;
    return ZmanimMethods.getById(state.methodId) || ZmanimMethods.METHODS[0];
  }

  function defaultCustomMethod() {
    var base = ZmanimMethods.getById(state.lastPresetId) || ZmanimMethods.METHODS[0];
    var copy = JSON.parse(JSON.stringify(base));
    copy.id = 'custom';
    copy.name = 'שיטה אישית';
    copy.description = 'שיטה בהתאמה אישית (מבוססת על: ' + base.name + ').';
    delete copy.draft;
    return copy;
  }

  // ---------- חישוב שורות ----------

  /** האם להציג זמן מסוים ביום נתון */
  function makeDayInfo(d) {
    var noon = dateAtNoonUTC(d);
    var dow = HebrewUtils.dayOfWeek(noon, 'UTC');
    return {
      date: d,
      noon: noon,
      dow: dow,
      isFriday: dow === 5,
      isShabbat: dow === 6,
      erevChag: HebrewUtils.erevChagName(noon, 'UTC')
    };
  }

  /**
   * שורות זמנים ליום אחד לפי שיטה.
   * mode: 'daily' (מסנן לפי היום) או 'matrix' (מחזיר גם ריקים לצורך טבלה)
   */
  function computeRows(d, loc, method, mode) {
    var info = makeDayInfo(d);
    var result = ZmanimEngine.computeDay(d, loc, method);
    var candleMinutes = loc.candleMinutes || 18;
    // חלק מהלוחות (עתים לבינה) מונים הדלקת נרות מהשקיעה מהגובה;
    // בחזון שמים — רק בערי הגובה (ירושלים, ב"ש, ביתר ומודיעין עילית)
    var candlesRef = method.candlesRef;
    if (loc.highCustom && method.highCityOverrides && method.highCityOverrides.candlesRef) {
      candlesRef = method.highCityOverrides.candlesRef;
    }
    var candlesBase = (candlesRef && result[candlesRef] != null)
      ? result[candlesRef] : result.sunset;
    var showCandles = info.isFriday || (info.erevChag && !info.isShabbat);
    var rows = [];
    var order = ZmanimMethods.ZMAN_ORDER;

    for (var i = 0; i < order.length; i++) {
      var key = order[i];
      var time = null, desc = '', name = ZmanimMethods.ZMAN_NAMES[key];

      if (key === 'candles') {
        if (!showCandles && mode === 'daily') continue;
        if (showCandles && candlesBase != null) {
          time = candlesBase - candleMinutes * 60000;
        }
        if (mode === 'matrix' && time == null) {
          rows.push({ key: key, name: name, time: null, desc: '' });
          continue;
        }
        if (mode === 'daily' && info.erevChag) name = 'הדלקת נרות (' + info.erevChag + ')';
        desc = candleMinutes + ' דקות לפני השקיעה' +
          (candlesRef === 'sunset2' ? ' מהגובה' : '');
      } else {
        if (!(key in (method.zmanim || {}))) continue;
        // צאת שבת — רלוונטי רק ביום שבת (בתצוגה יומית)
        if (key === 'tzeisShabbat' && mode === 'daily' && !info.isShabbat) continue;
        if (key === 'tzeisShabbat' && mode === 'matrix' && !info.isShabbat) {
          rows.push({ key: key, name: name, time: null, desc: '' });
          continue;
        }
        time = result[key];
        desc = ZmanimEngine.describeRule(method.zmanim[key], method);
      }
      rows.push({ key: key, name: name, time: time, desc: desc });
    }
    return { rows: rows, info: info };
  }

  // ---------- רינדור ----------

  function el(id) { return document.getElementById(id); }

  function renderHeader() {
    var noon = dateAtNoonUTC(state.date);
    var erevChag = HebrewUtils.erevChagName(noon, 'UTC');
    el('hebrew-date').textContent = HebrewUtils.weekdayName(noon, 'UTC') + ', ' +
      HebrewUtils.hebrewDate(noon, 'UTC') + (erevChag ? ' · ' + erevChag : '');
    el('greg-date').textContent = HebrewUtils.gregorianDate(noon, 'UTC');
    el('date-picker').value = dateToInputValue(state.date);
  }

  function renderMethodInfo() {
    el('method-description').textContent = fixBidi(currentMethod().description || '');
  }

  function renderLocationStatus() {
    var loc = state.loc;
    var parts = [];
    if (loc.name) parts.push(loc.name);
    parts.push(loc.lat.toFixed(3) + '°, ' + loc.lon.toFixed(3) + '°');
    parts.push('גובה: ' + Math.round(loc.elevation || 0) + ' מ׳');
    parts.push(loc.tz);
    parts.push('נרות: ' + (loc.candleMinutes || 18) + ' דק׳');
    el('location-status').textContent = parts.join(' · ');
    el('input-lat').value = loc.lat;
    el('input-lon').value = loc.lon;
    el('input-elev').value = Math.round(loc.elevation || 0);
    var tzSel = el('tz-select');
    if (tzSel && tzSel.options.length) tzSel.value = loc.tz;
  }

  function renderDaily() {
    var method = currentMethod();
    var loc = state.loc;
    var computed = computeRows(state.date, loc, method, 'daily');
    var rows = computed.rows;

    var now = Date.now();
    var isToday = isSameDate(state.date, todayInTZ(loc.tz));
    var nextKey = null;
    if (isToday) {
      for (var j = 0; j < rows.length; j++) {
        if (rows[j].time != null && rows[j].time > now) { nextKey = rows[j].key; break; }
      }
    }

    var tbody = el('zmanim-table').querySelector('tbody');
    tbody.innerHTML = '';
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k];
      var tr = document.createElement('tr');
      if (isToday && r.time != null) {
        if (r.key === nextKey) tr.className = 'zman-next';
        else if (r.time < now) tr.className = 'zman-passed';
      }
      var tdName = document.createElement('td');
      tdName.className = 'zman-name';
      tdName.textContent = r.name;
      var span = document.createElement('span');
      span.className = 'zman-desc';
      span.textContent = r.desc;
      tdName.appendChild(span);
      var tdTime = document.createElement('td');
      tdTime.className = 'zman-time';
      tdTime.textContent = HebrewUtils.formatTime(r.time, loc.tz);
      tr.appendChild(tdName);
      tr.appendChild(tdTime);
      tbody.appendChild(tr);
    }
  }

  var WEEKDAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש״ק'];

  function renderWeekly() {
    var method = currentMethod();
    var loc = state.loc;
    // השבוע המכיל את התאריך הנבחר, מיום ראשון עד שבת
    var info = makeDayInfo(state.date);
    var weekStart = shiftDate(state.date, -info.dow);
    var today = todayInTZ(loc.tz);

    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = shiftDate(weekStart, i);
      days.push(computeRows(d, loc, method, 'matrix'));
    }

    // כותרת: טווח התאריכים העבריים
    var startNoon = dateAtNoonUTC(weekStart);
    var endNoon = dateAtNoonUTC(shiftDate(weekStart, 6));
    el('weekly-title').textContent = 'שבוע ' + HebrewUtils.hebrewDateShort(startNoon, 'UTC') +
      ' — ' + HebrewUtils.hebrewDateShort(endNoon, 'UTC') + ' · ' + method.name;

    // איסוף שורות: כל מפתח שמופיע באחד הימים
    var keysInUse = [];
    var seen = {};
    days.forEach(function (day) {
      day.rows.forEach(function (r) {
        if (!seen[r.key]) { seen[r.key] = true; keysInUse.push(r.key); }
      });
    });
    // מיון לפי הסדר הקבוע
    keysInUse.sort(function (a, b) {
      return ZmanimMethods.ZMAN_ORDER.indexOf(a) - ZmanimMethods.ZMAN_ORDER.indexOf(b);
    });

    var table = el('weekly-table');
    table.innerHTML = '';

    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    var corner = document.createElement('th');
    corner.className = 'row-head';
    hr.appendChild(corner);
    days.forEach(function (day, idx) {
      var th = document.createElement('th');
      if (isSameDate(day.info.date, today)) th.className = 'col-today';
      var d = day.info.date;
      th.innerHTML = '';
      var l1 = document.createElement('span');
      l1.className = 'day-heb';
      l1.textContent = WEEKDAY_LETTERS[idx] + ' · ' + HebrewUtils.hebrewDateShort(day.info.noon, 'UTC');
      var l2 = document.createElement('span');
      l2.className = 'day-greg';
      l2.textContent = d.day + '.' + d.month;
      th.appendChild(l1);
      th.appendChild(l2);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    keysInUse.forEach(function (key) {
      var tr = document.createElement('tr');
      var th = document.createElement('td');
      th.className = 'row-head';
      th.textContent = ZmanimMethods.ZMAN_NAMES[key];
      tr.appendChild(th);
      days.forEach(function (day) {
        var td = document.createElement('td');
        td.className = 'time-cell';
        if (isSameDate(day.info.date, today)) td.className += ' col-today';
        var row = null;
        for (var i = 0; i < day.rows.length; i++) {
          if (day.rows[i].key === key) { row = day.rows[i]; break; }
        }
        td.textContent = row && row.time != null ? HebrewUtils.formatTime(row.time, loc.tz) : '—';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function renderCompare() {
    var loc = state.loc;
    var noon = dateAtNoonUTC(state.date);

    var methods = ZmanimMethods.METHODS.slice();
    if (state.customMethod) methods.push(state.customMethod);

    el('compare-title').textContent = 'השוואת כל השיטות · ' +
      HebrewUtils.weekdayName(noon, 'UTC') + ', ' + HebrewUtils.hebrewDate(noon, 'UTC');

    // חישוב לכל שיטה
    var perMethod = methods.map(function (m) {
      return computeRows(state.date, loc, m, 'matrix');
    });

    // שורות: כל מפתח שמופיע באחת השיטות (ללא נרות — זהה בכולן)
    var keysInUse = [];
    var seen = {};
    perMethod.forEach(function (res) {
      res.rows.forEach(function (r) {
        if (r.key === 'candles') return;
        if (!seen[r.key]) { seen[r.key] = true; keysInUse.push(r.key); }
      });
    });
    keysInUse.sort(function (a, b) {
      return ZmanimMethods.ZMAN_ORDER.indexOf(a) - ZmanimMethods.ZMAN_ORDER.indexOf(b);
    });
    // צאת שבת מוצג רק בשבת
    var info = makeDayInfo(state.date);
    if (!info.isShabbat) {
      keysInUse = keysInUse.filter(function (k) { return k !== 'tzeisShabbat'; });
    }

    var table = el('compare-table');
    table.innerHTML = '';

    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    var corner = document.createElement('th');
    corner.className = 'row-head';
    hr.appendChild(corner);
    methods.forEach(function (m) {
      var th = document.createElement('th');
      var l1 = document.createElement('span');
      l1.className = 'day-heb';
      l1.textContent = m.name.split(' — ')[0];
      th.appendChild(l1);
      if (m.id === state.methodId || (m.id === 'custom' && state.methodId === 'custom')) {
        th.classList.add('col-today');
      }
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    keysInUse.forEach(function (key) {
      var tr = document.createElement('tr');
      var th = document.createElement('td');
      th.className = 'row-head';
      th.textContent = ZmanimMethods.ZMAN_NAMES[key];
      tr.appendChild(th);
      perMethod.forEach(function (res, mi) {
        var td = document.createElement('td');
        td.className = 'time-cell';
        if (methods[mi].id === state.methodId) td.className += ' col-today';
        var row = null;
        for (var i = 0; i < res.rows.length; i++) {
          if (res.rows[i].key === key) { row = res.rows[i]; break; }
        }
        td.textContent = row && row.time != null ? HebrewUtils.formatTime(row.time, loc.tz) : '—';
        var descRow = row && row.desc;
        if (descRow) td.title = descRow;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function renderActiveView() {
    el('view-daily').hidden = state.view !== 'daily';
    el('view-weekly').hidden = state.view !== 'weekly';
    el('view-compare').hidden = state.view !== 'compare';
    // טבלאות רחבות — הכרטיס מתרחב לכל רוחב המסך
    el('zmanim-card').classList.toggle('wide', state.view !== 'daily');
    var tabs = document.querySelectorAll('.view-tabs .tab');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === state.view);
    });
    if (state.view === 'daily') renderDaily();
    else if (state.view === 'weekly') renderWeekly();
    else renderCompare();

    // הערת גובה
    var method = currentMethod();
    var loc = state.loc;
    var note = '';
    if ((method.elevation || 'visible') === 'visible' && (loc.elevation || 0) > 0) {
      note = 'הזריחה והשקיעה מחושבות עם התאמת גובה של ' + Math.round(loc.elevation) + ' מ׳. זמני המעלות אינם מושפעים מגובה.';
    } else if ((method.elevation || 'visible') === 'sea') {
      note = 'הזריחה והשקיעה מחושבות מישוריות (גובה פני הים), כמקובל בלוחות ארץ ישראל.';
    }
    el('elevation-note').textContent = note;
  }

  function renderAll() {
    renderHeader();
    renderMethodInfo();
    renderLocationStatus();
    renderActiveView();
    miniDashMinute = -1;
    updateMiniDash();
  }

  // ---------- הלוח המוקטן בכותרת ----------

  var miniDashMinute = -1;

  function updateMiniDash() {
    var clockEl = el('mini-clock');
    if (!clockEl || !state.loc) return;
    var now = Date.now();
    clockEl.textContent = HebrewUtils.formatTime(now, state.loc.tz, true);

    // "הזמן הבא" מתעדכן רק בתחילת דקה (או אחרי שינוי מיקום/שיטה)
    var minute = Math.floor(now / 60000);
    if (minute === miniDashMinute) return;
    miniDashMinute = minute;

    var today = todayInTZ(state.loc.tz);
    var rows = computeRows(today, state.loc, currentMethod(), 'daily').rows;
    var next = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].time != null && rows[i].time > now) { next = rows[i]; break; }
    }
    if (!next) {
      // אחרי הזמן האחרון של היום — הזמן הראשון של מחר
      var tomorrow = computeRows(shiftDate(today, 1), state.loc, currentMethod(), 'daily').rows;
      for (var j = 0; j < tomorrow.length; j++) {
        if (tomorrow[j].time != null) {
          next = { name: tomorrow[j].name + ' (מחר)', time: tomorrow[j].time };
          break;
        }
      }
    }
    el('mini-next-name').textContent = next ? next.name : '—';
    el('mini-next-time').textContent = next ? HebrewUtils.formatTime(next.time, state.loc.tz) : '';
  }

  // ---------- מיקום ----------

  function setLocation(loc) {
    state.loc = loc;
    state.date = todayInTZ(loc.tz);
    saveState();
    renderAll();
  }

  /** ערי הגובה שנהגו בהן להתחשב בגובה לשקיעה (חזון שמים) */
  function isHighCustomPlace(name) {
    return /ירושלים|Jerusalem|בית שמש|Beit Shemesh|ביתר עילית|Beitar|מודיעין עילית|Modi'?in Illit/.test(name || '');
  }

  /** השלמת גובה ואזור זמן ממקורות רשת (Open-Meteo) — עם נפילה חיננית */
  function enrichAndSetLocation(name, lat, lon, candleMinutes, statusEl, fullName) {
    if (statusEl) statusEl.textContent = 'מאתר גובה ואזור זמן…';
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon + '&timezone=auto';
    fetch(url).then(function (r) { return r.json(); }).then(function (meta) {
      setLocation({
        name: name, lat: lat, lon: lon,
        elevation: (typeof meta.elevation === 'number') ? Math.round(meta.elevation) : 0,
        tz: meta.timezone || browserTZ(),
        candleMinutes: candleMinutes,
        highCustom: isHighCustomPlace(fullName || name) || undefined
      });
    }).catch(function () {
      setLocation({
        name: name, lat: lat, lon: lon,
        elevation: 0, tz: browserTZ(), candleMinutes: candleMinutes
      });
      if (statusEl) statusEl.textContent += ' (הגובה לא אותר — ניתן להזין ידנית)';
    });
  }

  function geolocate() {
    var status = el('location-status');
    if (!navigator.geolocation) {
      status.textContent = 'הדפדפן אינו תומך באיתור מיקום. ניתן לבחור עיר, לחפש כתובת או להזין ידנית.';
      return;
    }
    status.textContent = 'מאתר מיקום…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      el('city-select').value = '';
      enrichAndSetLocation('המיקום הנוכחי', pos.coords.latitude, pos.coords.longitude,
        (state.loc && state.loc.candleMinutes) || 18, status);
    }, function (err) {
      status.textContent = 'איתור המיקום נכשל (' + err.message + '). ניתן לבחור עיר, לחפש כתובת או להזין ידנית.';
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  }

  // ---------- חיפוש כתובת ----------

  /** ניחוש מנהג הדלקת נרות לפי שם המקום */
  function guessCandleMinutes(displayName, countryCode) {
    var n = displayName || '';
    if (/ירושלים|Jerusalem|ביתר עילית|Beitar/.test(n)) return 40;
    if (/פתח תקווה|Petah/.test(n)) return 40;
    if (/בני ברק|Bnei Brak|תל אביב|Tel Aviv|אשדוד|Ashdod|רמת גן|גבעתיים|חולון|בת ים/.test(n)) return 22;
    if (countryCode === 'il') return 30;
    return 18;
  }

  function shortAddressName(item) {
    var parts = (item.display_name || '').split(',');
    return parts.slice(0, Math.min(3, parts.length)).join(',').trim();
  }

  function searchAddress() {
    var q = el('address-input').value.trim();
    var box = el('address-results');
    if (!q) return;
    box.innerHTML = '<div class="addr-note">מחפש כתובת…</div>';
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&accept-language=he&q=' +
      encodeURIComponent(q);
    fetch(url).then(function (r) { return r.json(); }).then(function (list) {
      box.innerHTML = '';
      if (!list || !list.length) {
        box.innerHTML = '<div class="addr-note">לא נמצאו תוצאות. נסו לנסח אחרת (רחוב, מספר, עיר).</div>';
        return;
      }
      list.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'addr-item';
        btn.textContent = item.display_name;
        btn.addEventListener('click', function () {
          box.innerHTML = '<div class="addr-note">טוען נתוני מיקום…</div>';
          var cc = item.address && item.address.country_code;
          enrichAndSetLocation(shortAddressName(item), +item.lat, +item.lon,
            guessCandleMinutes(item.display_name, cc), null, item.display_name);
          el('city-select').value = '';
          box.innerHTML = '';
        });
        box.appendChild(btn);
      });
      var note = document.createElement('div');
      note.className = 'addr-note';
      note.textContent = 'החיפוש באמצעות OpenStreetMap; הגובה ואזור הזמן מאותרים אוטומטית.';
      box.appendChild(note);
    }).catch(function () {
      box.innerHTML = '<div class="addr-note">חיפוש הכתובת נכשל — נדרש חיבור לאינטרנט.</div>';
    });
  }

  // ---------- עורך שיטה אישית ----------

  var EDITOR_ZMANIM = ['alos', 'misheyakir', 'sunrise', 'sunset', 'chatzos',
    'tzeis', 'tzeisShabbat', 'tzeisRT', 'minchaGedola', 'minchaKetana', 'plag'];

  var MGA_BASIS_OPTIONS = [
    { label: 'מעלות: 19.75° ↔ 19.75° (לוחות א״י, 90 דק׳)', start: { type: 'degrees', angle: 19.75, ref: 'sunrise' }, end: { type: 'degrees', angle: 19.75, ref: 'sunset' } },
    { label: 'מעלות: 16.1° ↔ 16.1° (72 דק׳)', start: { type: 'degrees', angle: 16.1, ref: 'sunrise' }, end: { type: 'degrees', angle: 16.1, ref: 'sunset' } },
    { label: 'דקות שוות: 72 ↔ 72', start: { type: 'fixed', minutes: -72, ref: 'sunrise' }, end: { type: 'fixed', minutes: 72, ref: 'sunset' } },
    { label: 'דקות שוות: 90 ↔ 90', start: { type: 'fixed', minutes: -90, ref: 'sunrise' }, end: { type: 'fixed', minutes: 90, ref: 'sunset' } },
    { label: 'דקות זמניות: 72 ↔ 72 (ספרדים)', start: { type: 'seasonal', minutes: -72, ref: 'sunrise', basis: 'gra' }, end: { type: 'seasonal', minutes: 72, ref: 'sunset', basis: 'gra' } }
  ];

  /** תיקון כיווניות: עטיפת ערכים כמו "16.1°" ב-LTR isolate כדי שיוצגו נכון בעברית */
  function fixBidi(label) {
    return label.replace(/(\d+(?:\.\d+)?°)/g, '⁦$1⁩');
  }

  /** מציאת האפשרות התואמת לחוק נתון (להצגה נכונה בעורך) */
  function findMatchingOption(options, rule) {
    var target = JSON.stringify(rule);
    for (var i = 0; i < options.length; i++) {
      if (JSON.stringify(options[i].rule || { start: options[i].start, end: options[i].end }) === target) return i;
    }
    return -1;
  }

  function buildCustomEditor() {
    var container = el('custom-editor');
    container.innerHTML = '';

    var baseMethod = state.customMethod || defaultCustomMethod();
    var opts = ZmanimMethods.CUSTOM_OPTIONS;
    var sel = state.customSelections || {};

    EDITOR_ZMANIM.forEach(function (key) {
      var options = opts[key] || [];
      if (!options.length) return;
      var row = document.createElement('div');
      row.className = 'custom-row';
      var label = document.createElement('label');
      label.textContent = ZmanimMethods.ZMAN_NAMES[key];
      label.setAttribute('for', 'custom-' + key);
      var select = document.createElement('select');
      select.id = 'custom-' + key;
      select.dataset.zman = key;
      options.forEach(function (opt, idx) {
        var o = document.createElement('option');
        o.value = idx;
        o.textContent = fixBidi(opt.label);
        select.appendChild(o);
      });
      var chosen = (sel[key] != null) ? sel[key] : findMatchingOption(options, baseMethod.zmanim[key]);
      if (chosen >= 0 && select.options[chosen]) select.value = chosen;
      row.appendChild(label);
      row.appendChild(select);
      container.appendChild(row);
    });

    // בסיס שעות מג"א
    var mgaRow = document.createElement('div');
    mgaRow.className = 'custom-row';
    var mgaLabel = document.createElement('label');
    mgaLabel.textContent = 'הגדרת היום למג״א (ק״ש ותפילה)';
    mgaLabel.setAttribute('for', 'custom-mga-basis');
    var mgaSelect = document.createElement('select');
    mgaSelect.id = 'custom-mga-basis';
    MGA_BASIS_OPTIONS.forEach(function (opt, idx) {
      var o = document.createElement('option');
      o.value = idx;
      o.textContent = fixBidi(opt.label);
      mgaSelect.appendChild(o);
    });
    var mgaChosen = (sel._mgaBasis != null) ? sel._mgaBasis
      : findMatchingOption(MGA_BASIS_OPTIONS.map(function (o) { return { rule: { start: o.start, end: o.end } }; }),
        { start: baseMethod.mgaDayStart, end: baseMethod.mgaDayEnd });
    if (mgaChosen >= 0 && mgaSelect.options[mgaChosen]) mgaSelect.value = mgaChosen;
    mgaRow.appendChild(mgaLabel);
    mgaRow.appendChild(mgaSelect);
    container.appendChild(mgaRow);
  }

  function saveCustomFromEditor() {
    var method = defaultCustomMethod();
    var opts = ZmanimMethods.CUSTOM_OPTIONS;
    var selections = {};

    EDITOR_ZMANIM.forEach(function (key) {
      var select = el('custom-' + key);
      if (!select) return;
      var idx = +select.value;
      selections[key] = idx;
      var opt = (opts[key] || [])[idx];
      if (opt) method.zmanim[key] = JSON.parse(JSON.stringify(opt.rule));
    });

    var mgaIdx = +el('custom-mga-basis').value;
    selections._mgaBasis = mgaIdx;
    var mga = MGA_BASIS_OPTIONS[mgaIdx] || MGA_BASIS_OPTIONS[0];
    method.mgaDayStart = JSON.parse(JSON.stringify(mga.start));
    method.mgaDayEnd = JSON.parse(JSON.stringify(mga.end));

    // בסיס הגר"א נגזר מבחירת הזריחה/שקיעה
    var sunriseRule = method.zmanim.sunrise;
    method.elevation = (sunriseRule && sunriseRule.elevation === 'sea') ? 'sea' : 'visible';

    state.customMethod = method;
    state.customSelections = selections;
    state.methodId = 'custom';
    el('method-select').value = 'custom';
    saveState();
    renderAll();
  }

  // ---------- אתחול ----------

  function populateCitySelect() {
    var select = el('city-select');
    ZmanimCities.CITIES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      select.appendChild(o);
    });
  }

  function populateTZSelect() {
    var select = el('tz-select');
    var zones;
    try {
      zones = Intl.supportedValuesOf('timeZone');
    } catch (e) {
      zones = ['Asia/Jerusalem', 'America/New_York', 'America/Los_Angeles', 'Europe/London',
        'Europe/Paris', 'Europe/Moscow', 'Australia/Sydney', 'UTC'];
    }
    zones.forEach(function (z) {
      var o = document.createElement('option');
      o.value = z;
      o.textContent = z;
      select.appendChild(o);
    });
  }

  function populateMethodSelect() {
    var select = el('method-select');
    select.innerHTML = '';
    ZmanimMethods.METHODS.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.name;
      select.appendChild(o);
    });
    var custom = document.createElement('option');
    custom.value = 'custom';
    custom.textContent = 'שיטה אישית ⚙️';
    select.appendChild(custom);
    select.value = state.methodId;
    if (select.value !== state.methodId) {
      state.methodId = ZmanimMethods.METHODS[0].id;
      select.value = state.methodId;
    }
  }

  function wireEvents() {
    el('btn-geolocate').addEventListener('click', geolocate);

    el('city-select').addEventListener('change', function () {
      var c = ZmanimCities.getById(this.value);
      if (c) {
        el('address-results').innerHTML = '';
        setLocation({
          name: c.name, lat: c.lat, lon: c.lon,
          elevation: c.elevation, tz: c.tz, candleMinutes: c.candleMinutes
        });
      }
    });

    el('btn-address-search').addEventListener('click', searchAddress);
    el('address-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); searchAddress(); }
    });

    el('btn-apply-manual').addEventListener('click', function () {
      var lat = parseFloat(el('input-lat').value);
      var lon = parseFloat(el('input-lon').value);
      var elev = parseFloat(el('input-elev').value) || 0;
      var tz = el('tz-select').value || browserTZ();
      if (isNaN(lat) || isNaN(lon)) return;
      el('city-select').value = '';
      setLocation({
        name: 'מיקום ידני', lat: lat, lon: lon,
        elevation: elev, tz: tz,
        candleMinutes: (state.loc && state.loc.candleMinutes) || 18
      });
    });

    el('method-select').addEventListener('change', function () {
      state.methodId = this.value;
      if (state.methodId !== 'custom') {
        state.lastPresetId = state.methodId;
      } else if (!state.customMethod) {
        state.customMethod = defaultCustomMethod();
      }
      saveState();
      renderAll();
    });

    document.querySelectorAll('.view-tabs .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.view = this.dataset.view;
        saveState();
        renderActiveView();
      });
    });

    el('btn-prev-day').addEventListener('click', function () {
      state.date = shiftDate(state.date, state.view === 'weekly' ? -7 : -1);
      renderAll();
    });
    el('btn-next-day').addEventListener('click', function () {
      state.date = shiftDate(state.date, state.view === 'weekly' ? 7 : 1);
      renderAll();
    });
    el('btn-today').addEventListener('click', function () {
      state.date = todayInTZ(state.loc.tz);
      renderAll();
    });
    el('date-picker').addEventListener('change', function () {
      var parts = this.value.split('-');
      if (parts.length === 3) {
        state.date = { year: +parts[0], month: +parts[1], day: +parts[2] };
        renderAll();
      }
    });

    el('btn-edit-custom').addEventListener('click', function () {
      buildCustomEditor();
      el('custom-modal').hidden = false;
    });
    el('btn-close-custom').addEventListener('click', function () {
      el('custom-modal').hidden = true;
    });
    el('custom-modal').addEventListener('click', function (e) {
      if (e.target === this) this.hidden = true;
    });
    el('btn-save-custom').addEventListener('click', function () {
      saveCustomFromEditor();
      el('custom-modal').hidden = true;
    });
    el('btn-reset-custom').addEventListener('click', function () {
      state.customSelections = {};
      state.customMethod = null;
      buildCustomEditor();
    });
  }

  function init() {
    loadState();
    if (!state.loc) {
      var jm = ZmanimCities.getById('jerusalem');
      state.loc = {
        name: jm.name, lat: jm.lat, lon: jm.lon,
        elevation: jm.elevation, tz: jm.tz, candleMinutes: jm.candleMinutes
      };
    }
    state.date = todayInTZ(state.loc.tz);

    populateCitySelect();
    populateTZSelect();
    populateMethodSelect();
    wireEvents();

    var match = ZmanimCities.CITIES.filter(function (c) { return c.name === state.loc.name; })[0];
    if (match) el('city-select').value = match.id;

    // כשהאפליקציה מוגשת מתוך אתר "היום יום" — מציגים קישור חזרה אליו
    if (/(^|\.)hayomyom\.net$/.test(location.hostname)) {
      el('back-link').hidden = false;
    }

    renderAll();

    // רענון ההדגשה של "הזמן הבא" כל חצי דקה
    setInterval(function () {
      if (state.view === 'daily' && isSameDate(state.date, todayInTZ(state.loc.tz))) renderDaily();
    }, 30000);

    // השעון הרץ בלוח המוקטן שבכותרת
    setInterval(updateMiniDash, 1000);

    // רישום Service Worker לעבודה במצב לא מקוון (PWA)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* לא קריטי */ });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
