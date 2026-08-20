/**
 * cities.js — מאגר ערים מובנה (קואורדינטות, גובה, אזור זמן, מנהג הדלקת נרות)
 * elevation במטרים מעל פני הים. candleMinutes — מנהג המקום להדלקת נרות.
 */
(function (global) {
  'use strict';

  var CITIES = [
    // ישראל
    { id: 'jerusalem', name: 'ירושלים', lat: 31.7780, lon: 35.2354, elevation: 754, tz: 'Asia/Jerusalem', candleMinutes: 40 },
    { id: 'bnei-brak', name: 'בני ברק', lat: 32.0834, lon: 34.8333, elevation: 25, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'tel-aviv', name: 'תל אביב', lat: 32.0853, lon: 34.7818, elevation: 15, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'haifa', name: 'חיפה', lat: 32.7940, lon: 34.9896, elevation: 250, tz: 'Asia/Jerusalem', candleMinutes: 30 },
    { id: 'beer-sheva', name: 'באר שבע', lat: 31.2518, lon: 34.7913, elevation: 260, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'ashdod', name: 'אשדוד', lat: 31.8014, lon: 34.6435, elevation: 30, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'ashkelon', name: 'אשקלון', lat: 31.6688, lon: 34.5743, elevation: 40, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'netanya', name: 'נתניה', lat: 32.3215, lon: 34.8532, elevation: 30, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'petah-tikva', name: 'פתח תקווה', lat: 32.0868, lon: 34.8870, elevation: 45, tz: 'Asia/Jerusalem', candleMinutes: 40 },
    { id: 'rehovot', name: 'רחובות', lat: 31.8928, lon: 34.8113, elevation: 75, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'beit-shemesh', name: 'בית שמש', lat: 31.7304, lon: 34.9886, elevation: 300, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'modiin-illit', name: 'מודיעין עילית', lat: 31.9333, lon: 35.0436, elevation: 290, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'beitar-illit', name: 'ביתר עילית', lat: 31.6969, lon: 35.1211, elevation: 700, tz: 'Asia/Jerusalem', candleMinutes: 40 },
    { id: 'elad', name: 'אלעד', lat: 32.0523, lon: 34.9512, elevation: 100, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'tzfat', name: 'צפת', lat: 32.9646, lon: 35.4960, elevation: 850, tz: 'Asia/Jerusalem', candleMinutes: 30 },
    { id: 'tiberias', name: 'טבריה', lat: 32.7922, lon: 35.5312, elevation: -200, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    { id: 'eilat', name: 'אילת', lat: 29.5577, lon: 34.9519, elevation: 20, tz: 'Asia/Jerusalem', candleMinutes: 22 },
    // חו"ל
    { id: 'new-york', name: 'ניו יורק', lat: 40.7128, lon: -74.0060, elevation: 10, tz: 'America/New_York', candleMinutes: 18 },
    { id: 'lakewood', name: 'לייקווד', lat: 40.0959, lon: -74.2177, elevation: 20, tz: 'America/New_York', candleMinutes: 18 },
    { id: 'monsey', name: 'מונסי', lat: 41.1112, lon: -74.0687, elevation: 120, tz: 'America/New_York', candleMinutes: 18 },
    { id: 'los-angeles', name: 'לוס אנג׳לס', lat: 34.0522, lon: -118.2437, elevation: 90, tz: 'America/Los_Angeles', candleMinutes: 18 },
    { id: 'miami', name: 'מיאמי', lat: 25.7617, lon: -80.1918, elevation: 2, tz: 'America/New_York', candleMinutes: 18 },
    { id: 'toronto', name: 'טורונטו', lat: 43.6532, lon: -79.3832, elevation: 76, tz: 'America/Toronto', candleMinutes: 18 },
    { id: 'mexico-city', name: 'מקסיקו סיטי', lat: 19.4326, lon: -99.1332, elevation: 2240, tz: 'America/Mexico_City', candleMinutes: 18 },
    { id: 'buenos-aires', name: 'בואנוס איירס', lat: -34.6037, lon: -58.3816, elevation: 25, tz: 'America/Argentina/Buenos_Aires', candleMinutes: 18 },
    { id: 'london', name: 'לונדון', lat: 51.5074, lon: -0.1278, elevation: 11, tz: 'Europe/London', candleMinutes: 18 },
    { id: 'manchester', name: 'מנצ׳סטר', lat: 53.4808, lon: -2.2426, elevation: 38, tz: 'Europe/London', candleMinutes: 18 },
    { id: 'antwerp', name: 'אנטוורפן', lat: 51.2194, lon: 4.4025, elevation: 8, tz: 'Europe/Brussels', candleMinutes: 18 },
    { id: 'paris', name: 'פריז', lat: 48.8566, lon: 2.3522, elevation: 35, tz: 'Europe/Paris', candleMinutes: 18 },
    { id: 'zurich', name: 'ציריך', lat: 47.3769, lon: 8.5417, elevation: 408, tz: 'Europe/Zurich', candleMinutes: 18 },
    { id: 'moscow', name: 'מוסקבה', lat: 55.7558, lon: 37.6173, elevation: 156, tz: 'Europe/Moscow', candleMinutes: 18 },
    { id: 'johannesburg', name: 'יוהנסבורג', lat: -26.2041, lon: 28.0473, elevation: 1753, tz: 'Africa/Johannesburg', candleMinutes: 18 },
    { id: 'melbourne', name: 'מלבורן', lat: -37.8136, lon: 144.9631, elevation: 31, tz: 'Australia/Melbourne', candleMinutes: 18 },
    { id: 'sydney', name: 'סידני', lat: -33.8688, lon: 151.2093, elevation: 58, tz: 'Australia/Sydney', candleMinutes: 18 }
  ];

  global.ZmanimCities = {
    CITIES: CITIES,
    getById: function (id) {
      for (var i = 0; i < CITIES.length; i++) {
        if (CITIES[i].id === id) return CITIES[i];
      }
      return null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
