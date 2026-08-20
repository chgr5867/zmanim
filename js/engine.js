/**
 * engine.js — מנוע חישוב זמני היום ההלכתיים
 *
 * העיקרון: "שיטה" היא אוסף חוקים (rules). כל חוק מגדיר איך מחשבים זמן אחד.
 * כך גם השיטות המובנות וגם שיטה בהתאמה אישית עוברות באותו מנוע בדיוק.
 *
 * סוגי חוקים:
 *  { type:'sunrise',  elevation:'visible'|'sea' }         — הנץ החמה
 *  { type:'sunset',   elevation:'visible'|'sea' }         — שקיעת החמה
 *  { type:'degrees',  angle:16.1, ref:'sunrise'|'sunset' }— מעלות מתחת לאופק
 *  { type:'fixed',    minutes:-72, ref:'sunrise'|'sunset'|'chatzos' } — דקות שוות
 *  { type:'seasonal', minutes:-72, ref:'sunrise'|'sunset', basis:'gra'|'mga' } — דקות זמניות (1/720 מהיום)
 *  { type:'shaos',    hours:3,   basis:'gra'|'mga' }      — שעות זמניות מתחילת היום
 *  { type:'chatzos' }                                     — חצות היום (אמצע gra או מעבר השמש)
 *  { type:'chatzosNight' }                                — חצות הלילה
 *  { type:'proportional', fraction:0.5, from:'sunset', to:'tzeis' } — (עתידי)
 *
 * "בסיס" שעות זמניות:
 *  gra — מהנץ עד השקיעה (לפי הגדרת elevation של השיטה)
 *  mga — מעלות השחר עד צאת הכוכבים, לפי mgaDayStart/mgaDayEnd של השיטה
 */
(function (global) {
  'use strict';

  var MS_PER_MIN = 60000;

  /**
   * @param {Object} d {year, month(1-12), day}
   * @param {Object} loc {lat, lon, elevation}
   * @param {Object} method אובייקט שיטה (ראו methods.js)
   * @returns {Object} מפה של key -> timestamp (או null)
   */
  function computeDay(d, loc, method) {
    var elev = loc.elevation || 0;
    var useElev = (method.elevation || 'visible') === 'visible';

    var ctx = {};
    ctx.date = d;
    ctx.loc = loc;

    // זריחה ושקיעה — גם "נראית" (עם גובה) וגם "מישורית" (גובה פני הים).
    // method.refraction — רפרקציה מותאמת (למשל 0.5166° בלוחות ההולכים אחר הרב מנת)
    var refr = method.refraction;
    ctx.sunriseVisible = Solar.sunEventUTC(d.year, d.month, d.day, loc.lat, loc.lon, Solar.GEOMETRIC_ZENITH, true, elev, refr);
    ctx.sunsetVisible = Solar.sunEventUTC(d.year, d.month, d.day, loc.lat, loc.lon, Solar.GEOMETRIC_ZENITH, false, elev, refr);
    ctx.sunriseSea = Solar.sunEventUTC(d.year, d.month, d.day, loc.lat, loc.lon, Solar.GEOMETRIC_ZENITH, true, 0, refr);
    ctx.sunsetSea = Solar.sunEventUTC(d.year, d.month, d.day, loc.lat, loc.lon, Solar.GEOMETRIC_ZENITH, false, 0, refr);

    ctx.sunrise = useElev ? ctx.sunriseVisible : ctx.sunriseSea;
    ctx.sunset = useElev ? ctx.sunsetVisible : ctx.sunsetSea;

    // חצות: אמצע היום של הגר"א (ולמעשה זהה כמעט למעבר השמש במרידיאן)
    ctx.solarNoon = Solar.solarNoonUTC(d.year, d.month, d.day, loc.lon);
    ctx.chatzos = (ctx.sunrise != null && ctx.sunset != null)
      ? (ctx.sunrise + ctx.sunset) / 2
      : ctx.solarNoon;

    // חצות הלילה: אמצע בין שתי חצויות שמש (אנטי-מרידיאן)
    var nextNoon = Solar.solarNoonUTC(d.year, d.month, d.day + 1, loc.lon);
    ctx.chatzosNight = (ctx.solarNoon + nextNoon) / 2;

    // בסיס גר"א
    ctx.bases = {
      gra: { start: ctx.sunrise, end: ctx.sunset }
    };

    // בסיס מג"א — לפי הגדרות השיטה
    var mgaStart = method.mgaDayStart ? resolveRule(method.mgaDayStart, ctx) : null;
    var mgaEnd = method.mgaDayEnd ? resolveRule(method.mgaDayEnd, ctx) : null;
    ctx.bases.mga = { start: mgaStart, end: mgaEnd };

    // חישוב כל הזמנים לפי חוקי השיטה
    var result = {};
    var rules = method.zmanim || {};
    for (var key in rules) {
      if (!Object.prototype.hasOwnProperty.call(rules, key)) continue;
      var rule = rules[key];
      result[key] = rule ? resolveRule(rule, ctx) : null;
    }

    // זמנים שימושיים שתמיד קיימים
    result._sunriseVisible = ctx.sunriseVisible;
    result._sunsetVisible = ctx.sunsetVisible;
    result._sunriseSea = ctx.sunriseSea;
    result._sunsetSea = ctx.sunsetSea;
    result._bases = ctx.bases;
    return result;
  }

  function refTime(ref, ctx) {
    switch (ref) {
      case 'sunrise': return ctx.sunrise;
      case 'sunset': return ctx.sunset;
      case 'sunriseSea': return ctx.sunriseSea;
      case 'sunsetSea': return ctx.sunsetSea;
      case 'sunriseVisible': return ctx.sunriseVisible;
      case 'sunsetVisible': return ctx.sunsetVisible;
      case 'chatzos': return ctx.chatzos;
      default: return null;
    }
  }

  function shaahZmanis(basis, ctx) {
    var b = ctx.bases[basis] || ctx.bases.gra;
    if (b.start == null || b.end == null) return null;
    return (b.end - b.start) / 12;
  }

  function resolveRule(rule, ctx) {
    if (!rule) return null;
    var d = ctx.date, loc = ctx.loc;
    switch (rule.type) {
      case 'sunrise':
        return rule.elevation === 'sea' ? ctx.sunriseSea :
          rule.elevation === 'visible' ? ctx.sunriseVisible : ctx.sunrise;

      case 'sunset':
        return rule.elevation === 'sea' ? ctx.sunsetSea :
          rule.elevation === 'visible' ? ctx.sunsetVisible : ctx.sunset;

      case 'degrees': {
        var isMorning = rule.ref !== 'sunset';
        var zenith = Solar.GEOMETRIC_ZENITH + rule.angle;
        return Solar.sunEventUTC(d.year, d.month, d.day, loc.lat, loc.lon, zenith, isMorning, 0);
      }

      case 'fixed': {
        var base = refTime(rule.ref, ctx);
        if (base == null) return null;
        return base + rule.minutes * MS_PER_MIN;
      }

      case 'seasonal': {
        var base2 = refTime(rule.ref, ctx);
        var sh = shaahZmanis(rule.basis || 'gra', ctx);
        if (base2 == null || sh == null) return null;
        // דקה זמנית = 1/60 משעה זמנית
        return base2 + rule.minutes * (sh / 60);
      }

      case 'shaos': {
        var basis = rule.basis || 'gra';
        var b = ctx.bases[basis];
        if (!b || b.start == null || b.end == null) return null;
        return b.start + rule.hours * ((b.end - b.start) / 12);
      }

      case 'chatzos':
        // mode:'transit' — חצות אסטרונומי (מעבר המרידיאן), הנהוג בלוחות ישראל
        return rule.mode === 'transit' ? ctx.solarNoon : ctx.chatzos;

      case 'chatzosNight':
        return ctx.chatzosNight;

      case 'later': {
        // המאוחר מבין כמה חוקים (למשל: מנחה גדולה — המאוחר מבין חצות+30 ו-6.5 שעות)
        var latest = null;
        for (var i = 0; i < rule.rules.length; i++) {
          var t = resolveRule(rule.rules[i], ctx);
          if (t != null && (latest == null || t > latest)) latest = t;
        }
        return latest;
      }

      case 'shaosSpan': {
        // שעות זמניות על יום מוגדר בחוקים (למשל מג"א לחומרא: עלות 90° עד צאת 6.45°)
        var spanStart = resolveRule(rule.start, ctx);
        var spanEnd = resolveRule(rule.end, ctx);
        if (spanStart == null || spanEnd == null) return null;
        return spanStart + rule.hours * ((spanEnd - spanStart) / 12);
      }

      case 'offset': {
        // היסט בדקות שוות מזמן המוגדר בחוק אחר (למשל: 30 דק' לפני צאת 3.65°)
        var offBase = resolveRule(rule.base, ctx);
        if (offBase == null) return null;
        return offBase + rule.minutes * MS_PER_MIN;
      }

      default:
        return null;
    }
  }

  /** עטיפת ערך מספרי ב-LTR isolate (LRI...PDI) — כדי ש"16.1°" יוצג נכון בטקסט עברי */
  function ltrNum(s) {
    return '⁦' + s + '⁩';
  }

  /** תיאור מילולי של חוק — להצגה למשתמש */
  function describeRule(rule, method) {
    if (!rule) return '';
    var basisName = { gra: 'גר״א', mga: 'מג״א' };
    switch (rule.type) {
      case 'sunrise': {
        var srMode = rule.elevation || (method && method.elevation) || 'visible';
        return srMode === 'sea' ? 'זריחה מישורית (גובה פני הים)' : 'זריחה לפי גובה המקום';
      }
      case 'sunset': {
        var ssMode = rule.elevation || (method && method.elevation) || 'visible';
        return ssMode === 'sea' ? 'שקיעה מישורית (גובה פני הים)' : 'שקיעה לפי גובה המקום';
      }
      case 'degrees':
        return ltrNum(rule.angle + '°') + ' מתחת לאופק ' + (rule.ref === 'sunset' ? 'אחרי השקיעה' : 'לפני הזריחה');
      case 'fixed': {
        var m = Math.abs(rule.minutes);
        var dir = rule.minutes < 0 ? 'לפני' : 'אחרי';
        var refName = rule.ref === 'sunset' || rule.ref === 'sunsetVisible' ? 'השקיעה'
          : rule.ref === 'chatzos' ? 'חצות'
          : rule.ref === 'sunriseVisible' ? 'הזריחה (לפי גובה)'
          : 'הזריחה';
        return m + ' דקות שוות ' + dir + ' ' + refName;
      }
      case 'seasonal': {
        var m2 = Math.abs(rule.minutes);
        var dir2 = rule.minutes < 0 ? 'לפני' : 'אחרי';
        var refName2 = rule.ref === 'sunset' ? 'השקיעה' : 'הזריחה';
        return m2 + ' דקות זמניות ' + dir2 + ' ' + refName2 + ' (' + (basisName[rule.basis] || 'גר״א') + ')';
      }
      case 'shaos':
        return rule.hours + ' שעות זמניות מתחילת היום — שיטת ' + (basisName[rule.basis] || 'גר״א');
      case 'chatzos':
        return rule.mode === 'transit' ? 'חצות אסטרונומי — השמש בראש המרידיאן' : 'אמצע היום — מחצית בין הזריחה לשקיעה';
      case 'chatzosNight':
        return 'אמצע הלילה האסטרונומי';
      case 'later': {
        var parts = [];
        for (var i = 0; i < rule.rules.length; i++) parts.push(describeRule(rule.rules[i], method));
        return 'המאוחר מבין: ' + parts.join(' / ');
      }
      case 'shaosSpan':
        return rule.hours + ' שעות זמניות — ' + (rule.label || 'יום מוגדר בנפרד');
      case 'offset': {
        var om = Math.abs(rule.minutes);
        var odir = rule.minutes < 0 ? 'לפני' : 'אחרי';
        return rule.label || (om + ' דקות ' + odir + ' ' + describeRule(rule.base, method));
      }
      default:
        return '';
    }
  }

  global.ZmanimEngine = {
    computeDay: computeDay,
    describeRule: describeRule
  };
})(typeof window !== 'undefined' ? window : globalThis);
