/**
 * solar.js — חישובים אסטרונומיים של השמש לפי אלגוריתם NOAA
 * (Jean Meeus, "Astronomical Algorithms", כפי שמיושם ב-NOAA Solar Calculator)
 *
 * כל הפונקציות מחזירות זמנים כ-timestamp (מילישניות UTC) או null כשהאירוע לא מתרחש
 * (למשל שמש חצות בקווי רוחב קיצוניים).
 */
(function (global) {
  'use strict';

  var DEG = Math.PI / 180;

  /** זנית גיאומטרית (מרכז השמש באופק, בלי רפרקציה) */
  var GEOMETRIC_ZENITH = 90;
  /** רפרקציה אטמוספרית ממוצעת בדקות קשת */
  var REFRACTION = 34 / 60;
  /** רדיוס השמש הנראה בדקות קשת */
  var SOLAR_RADIUS = 16 / 60;
  /** רדיוס כדור הארץ בק"מ (לחישוב שיקוע האופק בגובה) */
  var EARTH_RADIUS_KM = 6356.9;

  function toJulianDay(year, month, day, dayFraction) {
    // dayFraction: חלק היום ב-UT (0..1)
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    var a = Math.floor(year / 100);
    var b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) +
      day + dayFraction + b - 1524.5;
  }

  function julianCentury(jd) {
    return (jd - 2451545.0) / 36525.0;
  }

  function geomMeanLongSun(t) {
    var l0 = 280.46646 + t * (36000.76983 + t * 0.0003032);
    l0 = l0 % 360;
    if (l0 < 0) l0 += 360;
    return l0;
  }

  function geomMeanAnomalySun(t) {
    return 357.52911 + t * (35999.05029 - 0.0001537 * t);
  }

  function eccentricityEarthOrbit(t) {
    return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  }

  function sunEqOfCenter(t) {
    var m = geomMeanAnomalySun(t);
    var mrad = m * DEG;
    return Math.sin(mrad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
      Math.sin(2 * mrad) * (0.019993 - 0.000101 * t) +
      Math.sin(3 * mrad) * 0.000289;
  }

  function sunApparentLong(t) {
    var trueLong = geomMeanLongSun(t) + sunEqOfCenter(t);
    var omega = 125.04 - 1934.136 * t;
    return trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  }

  function meanObliquityOfEcliptic(t) {
    var seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
    return 23 + (26 + seconds / 60) / 60;
  }

  function obliquityCorrection(t) {
    var omega = 125.04 - 1934.136 * t;
    return meanObliquityOfEcliptic(t) + 0.00256 * Math.cos(omega * DEG);
  }

  function sunDeclination(t) {
    var e = obliquityCorrection(t);
    var lambda = sunApparentLong(t);
    return Math.asin(Math.sin(e * DEG) * Math.sin(lambda * DEG)) / DEG;
  }

  /** משוואת הזמן בדקות */
  function equationOfTime(t) {
    var epsilon = obliquityCorrection(t);
    var l0 = geomMeanLongSun(t);
    var e = eccentricityEarthOrbit(t);
    var m = geomMeanAnomalySun(t);

    var y = Math.tan((epsilon / 2) * DEG);
    y *= y;

    var sin2l0 = Math.sin(2 * l0 * DEG);
    var sinm = Math.sin(m * DEG);
    var cos2l0 = Math.cos(2 * l0 * DEG);
    var sin4l0 = Math.sin(4 * l0 * DEG);
    var sin2m = Math.sin(2 * m * DEG);

    var eTime = y * sin2l0 - 2 * e * sinm + 4 * e * y * sinm * cos2l0 -
      0.5 * y * y * sin4l0 - 1.25 * e * e * sin2m;
    return (eTime / DEG) * 4;
  }

  /**
   * זווית השעה (במעלות) עבור זנית נתונה. מחזיר NaN אם השמש לא מגיעה לזנית זו.
   */
  function hourAngle(lat, declination, zenith) {
    var latRad = lat * DEG;
    var declRad = declination * DEG;
    var cosHA = (Math.cos(zenith * DEG) / (Math.cos(latRad) * Math.cos(declRad))) -
      (Math.tan(latRad) * Math.tan(declRad));
    if (cosHA > 1 || cosHA < -1) return NaN;
    return Math.acos(cosHA) / DEG;
  }

  /** שיקוע האופק (במעלות) עבור גובה h במטרים מעל פני הים */
  function elevationDip(elevationMeters) {
    if (!elevationMeters || elevationMeters <= 0) return 0;
    var r = EARTH_RADIUS_KM;
    return Math.acos(r / (r + elevationMeters / 1000)) / DEG;
  }

  /**
   * התאמת זנית: לזנית הגיאומטרית (90°) מוסיפים רפרקציה + רדיוס שמש
   * (וגם שיקוע אופק אם ניתן גובה). לזוויות אחרות (זמני מעלות) לא מוסיפים —
   * הזוויות ההלכתיות (16.1° וכו') כוילו כבר ביחס לזריחה/שקיעה הנראית.
   */
  function adjustZenith(zenith, elevationMeters) {
    if (zenith === GEOMETRIC_ZENITH) {
      return zenith + REFRACTION + SOLAR_RADIUS + elevationDip(elevationMeters);
    }
    return zenith;
  }

  /**
   * חישוב זמן אירוע שמש (זריחה/שקיעה/מעלות) ליום נתון.
   * @param {number} year,month,day — תאריך לועזי (חודש 1-12) "אזרחי" של המקום
   * @param {number} lat,lon — קואורדינטות (מזרח חיובי)
   * @param {number} zenith — זנית במעלות (90 = זריחה/שקיעה גיאומטרית)
   * @param {boolean} isSunrise — true לאירוע בוקר
   * @param {number} elevationMeters — גובה (משפיע רק כשהזנית 90)
   * @returns {number|null} timestamp במילישניות UTC
   */
  function sunEventUTC(year, month, day, lat, lon, zenith, isSunrise, elevationMeters) {
    var adjZenith = adjustZenith(zenith, elevationMeters || 0);
    // ניחוש ראשון: חצות שמש מקומית לפי קו האורך
    var utcMinutes = 720 - 4 * lon;
    // שתי איטרציות עידון מספיקות לדיוק של שבריר שנייה
    for (var i = 0; i < 3; i++) {
      var jd = toJulianDay(year, month, day, utcMinutes / 1440);
      var t = julianCentury(jd);
      var decl = sunDeclination(t);
      var eqTime = equationOfTime(t);
      var ha = hourAngle(lat, decl, adjZenith);
      if (isNaN(ha)) return null;
      var haSigned = isSunrise ? ha : -ha;
      utcMinutes = 720 - 4 * (lon + haSigned) - eqTime;
    }
    var dayStartUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    return dayStartUTC + utcMinutes * 60000;
  }

  /** חצות שמש (transit) — הרגע בו השמש בגובה המקסימלי */
  function solarNoonUTC(year, month, day, lon) {
    var utcMinutes = 720 - 4 * lon;
    for (var i = 0; i < 3; i++) {
      var jd = toJulianDay(year, month, day, utcMinutes / 1440);
      var t = julianCentury(jd);
      utcMinutes = 720 - 4 * lon - equationOfTime(t);
    }
    var dayStartUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    return dayStartUTC + utcMinutes * 60000;
  }

  global.Solar = {
    GEOMETRIC_ZENITH: GEOMETRIC_ZENITH,
    sunEventUTC: sunEventUTC,
    solarNoonUTC: solarNoonUTC,
    elevationDip: elevationDip
  };
})(typeof window !== 'undefined' ? window : globalThis);
