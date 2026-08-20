/**
 * methods.js — הגדרות השיטות לחישוב זמני היום
 *
 * כל שיטה היא דאטה בלבד: אוסף חוקים שמנוע engine.js יודע לחשב.
 * ההגדרות מבוססות על מחקר מקורות מפורט — ראו docs/RESEARCH.md.
 *
 * עקרונות מרכזיים מהמחקר:
 * - בלוחות ארץ ישראל הזמנים תלויי-האור (עלות, משיכיר, צאת) מחושבים במעלות,
 *   והזריחה/שקיעה מישוריות (גובה פני הים). 90 דק' = 19.75°-19.8°, 72 דק' = 16.02°-16.1°.
 * - זמני מעלות לעולם אינם מותאמי-גובה; רק זריחה/שקיעה עצמן.
 * - חצות בלוחות ישראל = חצות אסטרונומי (מעבר המרידיאן).
 */
(function (global) {
  'use strict';

  /** סדר הצגת הזמנים ושמותיהם */
  var ZMAN_ORDER = [
    'alos', 'alos2', 'misheyakir', 'sunrise',
    'sofShmaMGA2', 'sofShmaMGA', 'sofShmaGRA', 'sofTfilaMGA2', 'sofTfilaMGA', 'sofTfilaGRA',
    'chatzos', 'minchaGedola', 'minchaKetana', 'plag', 'seudah',
    'candles', 'sunset', 'sunset2', 'tzeis', 'tzeisShabbat', 'tzeisRT', 'tzeisRT2', 'chatzosNight'
  ];

  var ZMAN_NAMES = {
    alos: 'עלות השחר',
    alos2: 'עלות השחר ב׳ (לקולא)',
    misheyakir: 'משיכיר (טלית ותפילין)',
    sunrise: 'הנץ החמה',
    sofShmaMGA2: 'סוף זמן ק״ש — מג״א לחומרא',
    sofShmaMGA: 'סוף זמן ק״ש — מג״א',
    sofShmaGRA: 'סוף זמן ק״ש — גר״א',
    sofTfilaMGA2: 'סוף זמן תפילה — מג״א לחומרא',
    sofTfilaMGA: 'סוף זמן תפילה — מג״א',
    sofTfilaGRA: 'סוף זמן תפילה — גר״א',
    chatzos: 'חצות היום',
    minchaGedola: 'מנחה גדולה',
    minchaKetana: 'מנחה קטנה',
    plag: 'פלג המנחה',
    seudah: 'סו״ז סעודה לפני ערבית',
    candles: 'הדלקת נרות',
    sunset: 'שקיעת החמה',
    sunset2: 'שקיעה מהגובה (זהירות מלהקל)',
    tzeis: 'צאת הכוכבים',
    tzeisShabbat: 'צאת שבת ויו״ט',
    tzeisRT: 'צאת הכוכבים — רבינו תם',
    tzeisRT2: 'ר״ת — 72 שוות מהגובה',
    chatzosNight: 'חצות הלילה'
  };

  /** תבנית זמנים משותפת */
  function baseZmanim() {
    return {
      sunrise: { type: 'sunrise' },
      sofShmaGRA: { type: 'shaos', hours: 3, basis: 'gra' },
      sofTfilaGRA: { type: 'shaos', hours: 4, basis: 'gra' },
      sofShmaMGA: { type: 'shaos', hours: 3, basis: 'mga' },
      sofTfilaMGA: { type: 'shaos', hours: 4, basis: 'mga' },
      chatzos: { type: 'chatzos', mode: 'transit' },
      minchaGedola: {
        type: 'later',
        rules: [
          { type: 'fixed', minutes: 30, ref: 'chatzos' },
          { type: 'shaos', hours: 6.5, basis: 'gra' }
        ]
      },
      minchaKetana: { type: 'shaos', hours: 9.5, basis: 'gra' },
      plag: { type: 'shaos', hours: 10.75, basis: 'gra' },
      sunset: { type: 'sunset' },
      chatzosNight: { type: 'chatzosNight' }
    };
  }

  var METHODS = [
    {
      id: 'chazon-shamayim',
      name: 'חזון שמים — מנהג א״י (אשכנז)',
      description: 'מסלול "מנהג האשכנזים בא״י" של תוכנת חזון שמים (הרב איתן צקוני) — המנוע של רוב לוחות ישראל. ' +
        'זמני האור במעלות: עלות 19.75° (90 דק׳), עלות ב׳ 16.02° (72 דק׳), משיכיר 11.5°. ' +
        'זריחה ושקיעה מישוריות, חצות אסטרונומי, מוצ״ש 8.5°, ר״ת 72 דק׳.',
      elevation: 'sea',
      mgaDayStart: { type: 'degrees', angle: 19.75, ref: 'sunrise' },
      mgaDayEnd: { type: 'degrees', angle: 19.75, ref: 'sunset' },
      zmanim: Object.assign(baseZmanim(), {
        alos: { type: 'degrees', angle: 19.75, ref: 'sunrise' },
        alos2: { type: 'degrees', angle: 16.02, ref: 'sunrise' },
        misheyakir: { type: 'degrees', angle: 11.5, ref: 'sunrise' },
        tzeis: { type: 'seasonal', minutes: 13.5, ref: 'sunset', basis: 'gra' },
        tzeisShabbat: { type: 'degrees', angle: 8.5, ref: 'sunset' },
        tzeisRT: { type: 'fixed', minutes: 72, ref: 'sunset' }
      })
    },
    {
      id: 'itim-levina',
      name: 'עתים לבינה',
      description: 'לוח עתים לבינה (הרב דוד אהרן סופר, ירושלים) — כל זמני האור במעלות: ' +
        'עלות א׳ 19.8° (90 דק׳), עלות ב׳ 16.1° (72 דק׳), משיכיר 11.5°, צאת גאונים 18 דק׳ במעלות (4.61°). ' +
        'כבלוח: שקיעה במישור ולצדה שקיעה מהגובה (זהירות מלהקל), הדלקת נרות מהשקיעה מהגובה, ' +
        'חצות אמיתי, מנחה גדולה — המאוחר, מוצ״ש 8.5°, ר״ת 72 במעלות (16.1°) ולצדו 72 שוות מהגובה.',
      elevation: 'sea',
      candlesRef: 'sunset2',
      refraction: 0.5166,
      mgaDayStart: { type: 'degrees', angle: 19.8, ref: 'sunrise' },
      mgaDayEnd: { type: 'degrees', angle: 19.8, ref: 'sunset' },
      zmanim: Object.assign(baseZmanim(), {
        alos: { type: 'degrees', angle: 19.8, ref: 'sunrise' },
        alos2: { type: 'degrees', angle: 16.1, ref: 'sunrise' },
        misheyakir: { type: 'degrees', angle: 11.5, ref: 'sunrise' },
        sofShmaMGA2: {
          type: 'shaosSpan', hours: 3,
          start: { type: 'degrees', angle: 19.8, ref: 'sunrise' },
          end: { type: 'degrees', angle: 6.45, ref: 'sunset' },
          label: 'היום מעלות 90 במעלות עד צאת 6.45°'
        },
        sofTfilaMGA2: {
          type: 'shaosSpan', hours: 4,
          start: { type: 'degrees', angle: 19.8, ref: 'sunrise' },
          end: { type: 'degrees', angle: 6.45, ref: 'sunset' },
          label: 'היום מעלות 90 במעלות עד צאת 6.45°'
        },
        seudah: {
          type: 'offset', minutes: -30,
          base: { type: 'degrees', angle: 3.65, ref: 'sunset' },
          label: '30 דק׳ לפני צאה״כ 13.5 דק׳ במעלות (3.65°)'
        },
        sunset2: { type: 'sunset', elevation: 'visible' },
        tzeis: { type: 'degrees', angle: 4.61, ref: 'sunset' },
        tzeisShabbat: { type: 'degrees', angle: 8.5, ref: 'sunset' },
        tzeisRT: { type: 'degrees', angle: 16.1, ref: 'sunset' },
        tzeisRT2: { type: 'fixed', minutes: 72, ref: 'sunsetVisible' }
      })
    },
    {
      id: 'tikochinsky',
      name: 'לוח ארץ ישראל — הרב טוקצינסקי',
      description: 'לוח ירושלים מיסודו של הגרימ״ט: עלות 90 דק׳ במעלות (19.75°), ' +
        'הנץ מגובה המקום בתוספת 3 דק׳ (עיכוב הרי מואב), שקיעה מגובה המקום ללא ניכוי הרים, ' +
        'צאת הכוכבים 6.45° (בירור הלכה), מוצ״ש 8.5°, ר״ת 72 דק׳. מנהג ירושלים: הדלקת נרות 40 דק׳.',
      elevation: 'visible',
      mgaDayStart: { type: 'degrees', angle: 19.75, ref: 'sunrise' },
      mgaDayEnd: { type: 'degrees', angle: 19.75, ref: 'sunset' },
      zmanim: Object.assign(baseZmanim(), {
        alos: { type: 'degrees', angle: 19.75, ref: 'sunrise' },
        misheyakir: { type: 'degrees', angle: 11.5, ref: 'sunrise' },
        sunrise: { type: 'fixed', minutes: 3, ref: 'sunrise' },
        tzeis: { type: 'degrees', angle: 6.45, ref: 'sunset' },
        tzeisShabbat: { type: 'degrees', angle: 8.5, ref: 'sunset' },
        tzeisRT: { type: 'fixed', minutes: 72, ref: 'sunset' }
      })
    },
    {
      id: 'sephardi',
      name: 'מנהג הספרדים — הגר״ע יוסף',
      description: 'ע״פ לוח אור החיים וילקוט יוסף: הכול בדקות זמניות — עלות 72 דק׳ זמניות, ' +
        'משיכיר 66 דק׳ זמניות, צאת הכוכבים 13.5 דק׳ זמניות, ר״ת 72 דק׳ זמניות. ' +
        'זריחה ושקיעה בהתחשבות בגובה המקום. מוצ״ש 30 דק׳ שוות.',
      elevation: 'visible',
      mgaDayStart: { type: 'seasonal', minutes: -72, ref: 'sunrise', basis: 'gra' },
      mgaDayEnd: { type: 'seasonal', minutes: 72, ref: 'sunset', basis: 'gra' },
      zmanim: Object.assign(baseZmanim(), {
        alos: { type: 'seasonal', minutes: -72, ref: 'sunrise', basis: 'gra' },
        misheyakir: { type: 'seasonal', minutes: -66, ref: 'sunrise', basis: 'gra' },
        chatzos: { type: 'chatzos' },
        tzeis: { type: 'seasonal', minutes: 13.5, ref: 'sunset', basis: 'gra' },
        tzeisShabbat: { type: 'fixed', minutes: 30, ref: 'sunset' },
        tzeisRT: { type: 'seasonal', minutes: 72, ref: 'sunset', basis: 'gra' }
      })
    },
    {
      id: 'gra',
      name: 'גר״א — דקות שוות (נוסח חו״ל)',
      description: 'שעות זמניות מהנץ עד השקיעה כשיטת הגר״א, עלות ורבינו תם 72 דקות שוות, ' +
        'צאת הכוכבים 8.5°. המקובל באפליקציות ובלוחות בחו״ל.',
      elevation: 'visible',
      mgaDayStart: { type: 'fixed', minutes: -72, ref: 'sunrise' },
      mgaDayEnd: { type: 'fixed', minutes: 72, ref: 'sunset' },
      zmanim: Object.assign(baseZmanim(), {
        alos: { type: 'fixed', minutes: -72, ref: 'sunrise' },
        misheyakir: { type: 'degrees', angle: 11.5, ref: 'sunrise' },
        chatzos: { type: 'chatzos' },
        tzeis: { type: 'degrees', angle: 8.5, ref: 'sunset' },
        tzeisShabbat: { type: 'degrees', angle: 8.5, ref: 'sunset' },
        tzeisRT: { type: 'fixed', minutes: 72, ref: 'sunset' }
      })
    },
    {
      id: 'mga',
      name: 'מגן אברהם 72/72',
      description: 'היום מעלות השחר (72 דק׳ שוות) עד צאת דר״ת (72 דק׳) — גם למנחה ופלג. ' +
        'שעות זמניות ארוכות יותר משיטת הגר״א.',
      elevation: 'visible',
      mgaDayStart: { type: 'fixed', minutes: -72, ref: 'sunrise' },
      mgaDayEnd: { type: 'fixed', minutes: 72, ref: 'sunset' },
      zmanim: Object.assign(baseZmanim(), {
        alos: { type: 'fixed', minutes: -72, ref: 'sunrise' },
        misheyakir: { type: 'degrees', angle: 11.5, ref: 'sunrise' },
        chatzos: { type: 'chatzos' },
        minchaGedola: {
          type: 'later',
          rules: [
            { type: 'fixed', minutes: 30, ref: 'chatzos' },
            { type: 'shaos', hours: 6.5, basis: 'mga' }
          ]
        },
        minchaKetana: { type: 'shaos', hours: 9.5, basis: 'mga' },
        plag: { type: 'shaos', hours: 10.75, basis: 'mga' },
        tzeis: { type: 'degrees', angle: 8.5, ref: 'sunset' },
        tzeisShabbat: { type: 'degrees', angle: 8.5, ref: 'sunset' },
        tzeisRT: { type: 'fixed', minutes: 72, ref: 'sunset' }
      })
    }
  ];

  /**
   * אפשרויות לבחירה בעורך השיטה האישית — לכל זמן, רשימת חוקים אפשריים.
   */
  var CUSTOM_OPTIONS = {
    alos: [
      { label: '19.75° — 90 דק׳ במעלות (לוחות א״י)', rule: { type: 'degrees', angle: 19.75, ref: 'sunrise' } },
      { label: '19.8° — 90 דק׳ במעלות', rule: { type: 'degrees', angle: 19.8, ref: 'sunrise' } },
      { label: '16.1° — 72 דק׳ במעלות', rule: { type: 'degrees', angle: 16.1, ref: 'sunrise' } },
      { label: '18° — עלות אסטרונומי', rule: { type: 'degrees', angle: 18, ref: 'sunrise' } },
      { label: '19° — שיטת הרמב״ם (מעגלי צדק)', rule: { type: 'degrees', angle: 19, ref: 'sunrise' } },
      { label: '26° — 120 דק׳ במעלות (אדה״ז, לחומרא)', rule: { type: 'degrees', angle: 26, ref: 'sunrise' } },
      { label: '72 דקות שוות לפני הנץ', rule: { type: 'fixed', minutes: -72, ref: 'sunrise' } },
      { label: '90 דקות שוות לפני הנץ', rule: { type: 'fixed', minutes: -90, ref: 'sunrise' } },
      { label: '96 דקות שוות לפני הנץ', rule: { type: 'fixed', minutes: -96, ref: 'sunrise' } },
      { label: '120 דקות שוות לפני הנץ', rule: { type: 'fixed', minutes: -120, ref: 'sunrise' } },
      { label: '72 דקות זמניות לפני הנץ (ספרדים)', rule: { type: 'seasonal', minutes: -72, ref: 'sunrise', basis: 'gra' } },
      { label: '90 דקות זמניות לפני הנץ', rule: { type: 'seasonal', minutes: -90, ref: 'sunrise', basis: 'gra' } },
      { label: '120 דקות זמניות לפני הנץ', rule: { type: 'seasonal', minutes: -120, ref: 'sunrise', basis: 'gra' } }
    ],
    misheyakir: [
      { label: '12.85° — בשעת הדחק (בירור הלכה)', rule: { type: 'degrees', angle: 12.85, ref: 'sunrise' } },
      { label: '11.5° — הנפוץ בלוחות א״י (52 דק׳)', rule: { type: 'degrees', angle: 11.5, ref: 'sunrise' } },
      { label: '11° — 48 דק׳', rule: { type: 'degrees', angle: 11, ref: 'sunrise' } },
      { label: '10.5° — מודיעין עילית וזכרון יעקב', rule: { type: 'degrees', angle: 10.5, ref: 'sunrise' } },
      { label: '10.2° — 45 דק׳', rule: { type: 'degrees', angle: 10.2, ref: 'sunrise' } },
      { label: '9.5° — לוחות ארה״ב (בולטימור)', rule: { type: 'degrees', angle: 9.5, ref: 'sunrise' } },
      { label: '7.65° — הגר״מ פיינשטיין (35–40 דק׳)', rule: { type: 'degrees', angle: 7.65, ref: 'sunrise' } },
      { label: '66 דקות זמניות לפני הנץ (הגר״ע יוסף)', rule: { type: 'seasonal', minutes: -66, ref: 'sunrise', basis: 'gra' } },
      { label: '45 דקות לפני הנץ', rule: { type: 'fixed', minutes: -45, ref: 'sunrise' } },
      { label: '52 דקות לפני הנץ', rule: { type: 'fixed', minutes: -52, ref: 'sunrise' } },
      { label: '60 דקות לפני הנץ (כף החיים)', rule: { type: 'fixed', minutes: -60, ref: 'sunrise' } }
    ],
    sunrise: [
      { label: 'זריחה מישורית (פני הים) — לוחות א״י', rule: { type: 'sunrise', elevation: 'sea' } },
      { label: 'זריחה לפי גובה המקום', rule: { type: 'sunrise', elevation: 'visible' } },
      { label: 'זריחה מגובה המקום + 3 דק׳ (הגרימ״ט)', rule: { type: 'fixed', minutes: 3, ref: 'sunriseVisible' } }
    ],
    sunset: [
      { label: 'שקיעה מישורית (פני הים) — לוחות א״י', rule: { type: 'sunset', elevation: 'sea' } },
      { label: 'שקיעה לפי גובה המקום', rule: { type: 'sunset', elevation: 'visible' } }
    ],
    chatzos: [
      { label: 'חצות אסטרונומי (מעבר מרידיאן) — לוחות א״י', rule: { type: 'chatzos', mode: 'transit' } },
      { label: 'אמצע בין הזריחה לשקיעה', rule: { type: 'chatzos' } }
    ],
    tzeis: [
      { label: '4.66° — כ־18 דק׳ במעלות (עתים לבינה)', rule: { type: 'degrees', angle: 4.66, ref: 'sunset' } },
      { label: '3.7° — 13.5 דק׳ במעלות (לחומרא)', rule: { type: 'degrees', angle: 3.7, ref: 'sunset' } },
      { label: '4.8° — 18.6 דק׳ (הרב שלזינגר)', rule: { type: 'degrees', angle: 4.8, ref: 'sunset' } },
      { label: '5.95° — בעל התניא (24 דק׳ בא״י)', rule: { type: 'degrees', angle: 5.95, ref: 'sunset' } },
      { label: '6° — לוחות חב״ד', rule: { type: 'degrees', angle: 6, ref: 'sunset' } },
      { label: '6.45° — הגרימ״ט / בירור הלכה (מוצאי צום)', rule: { type: 'degrees', angle: 6.45, ref: 'sunset' } },
      { label: '7.083° — ג׳ כוכבים בינוניים', rule: { type: 'degrees', angle: 7.083, ref: 'sunset' } },
      { label: '8.5° — ג׳ כוכבים קטנים (מוצ״ש א״י)', rule: { type: 'degrees', angle: 8.5, ref: 'sunset' } },
      { label: '9.3° — צאת לחומרא (עתים לבינה)', rule: { type: 'degrees', angle: 9.3, ref: 'sunset' } },
      { label: '13.5 דקות זמניות (ספרדים)', rule: { type: 'seasonal', minutes: 13.5, ref: 'sunset', basis: 'gra' } },
      { label: '13.5 דקות שוות', rule: { type: 'fixed', minutes: 13.5, ref: 'sunset' } },
      { label: '18 דקות שוות', rule: { type: 'fixed', minutes: 18, ref: 'sunset' } },
      { label: '20 דקות שוות', rule: { type: 'fixed', minutes: 20, ref: 'sunset' } },
      { label: '24 דקות שוות', rule: { type: 'fixed', minutes: 24, ref: 'sunset' } },
      { label: '30 דקות שוות', rule: { type: 'fixed', minutes: 30, ref: 'sunset' } },
      { label: '40 דקות שוות (חזון איש)', rule: { type: 'fixed', minutes: 40, ref: 'sunset' } },
      { label: '50 דקות שוות (הגר״מ פיינשטיין)', rule: { type: 'fixed', minutes: 50, ref: 'sunset' } }
    ],
    tzeisShabbat: [
      { label: '8.5° — הנפוץ בא״י (הגרימ״ט)', rule: { type: 'degrees', angle: 8.5, ref: 'sunset' } },
      { label: '7.67° — אגרות משה (45 דק׳ בנ״י)', rule: { type: 'degrees', angle: 7.67, ref: 'sunset' } },
      { label: '9.3° — לחומרא (עתים לבינה)', rule: { type: 'degrees', angle: 9.3, ref: 'sunset' } },
      { label: '9.75° — הגר״י הענקין (60 דק׳ בנ״י)', rule: { type: 'degrees', angle: 9.75, ref: 'sunset' } },
      { label: '30 דקות שוות (הגר״ע יוסף)', rule: { type: 'fixed', minutes: 30, ref: 'sunset' } },
      { label: '40 דקות שוות (חזון איש — ב״ב)', rule: { type: 'fixed', minutes: 40, ref: 'sunset' } },
      { label: '45 דקות שוות', rule: { type: 'fixed', minutes: 45, ref: 'sunset' } },
      { label: '50 דקות שוות (המנהג האמריקאי)', rule: { type: 'fixed', minutes: 50, ref: 'sunset' } },
      { label: '60 דקות שוות', rule: { type: 'fixed', minutes: 60, ref: 'sunset' } },
      { label: '72 דקות שוות (ר״ת)', rule: { type: 'fixed', minutes: 72, ref: 'sunset' } }
    ],
    tzeisRT: [
      { label: '72 דקות שוות אחר השקיעה', rule: { type: 'fixed', minutes: 72, ref: 'sunset' } },
      { label: '72 דקות זמניות אחר השקיעה (ספרדים)', rule: { type: 'seasonal', minutes: 72, ref: 'sunset', basis: 'gra' } },
      { label: '16.1° — 72 דק׳ במעלות', rule: { type: 'degrees', angle: 16.1, ref: 'sunset' } },
      { label: '90 דקות שוות אחר השקיעה', rule: { type: 'fixed', minutes: 90, ref: 'sunset' } },
      { label: '120 דקות שוות אחר השקיעה', rule: { type: 'fixed', minutes: 120, ref: 'sunset' } }
    ],
    minchaGedola: [
      { label: 'המאוחר מבין: חצות+30 / 6.5 שעות (לוחות א״י)', rule: { type: 'later', rules: [{ type: 'fixed', minutes: 30, ref: 'chatzos' }, { type: 'shaos', hours: 6.5, basis: 'gra' }] } },
      { label: '6.5 שעות זמניות (גר״א)', rule: { type: 'shaos', hours: 6.5, basis: 'gra' } },
      { label: '6.5 שעות זמניות (מג״א)', rule: { type: 'shaos', hours: 6.5, basis: 'mga' } },
      { label: '30 דקות שוות אחר חצות', rule: { type: 'fixed', minutes: 30, ref: 'chatzos' } }
    ],
    minchaKetana: [
      { label: '9.5 שעות זמניות (גר״א)', rule: { type: 'shaos', hours: 9.5, basis: 'gra' } },
      { label: '9.5 שעות זמניות (מג״א)', rule: { type: 'shaos', hours: 9.5, basis: 'mga' } }
    ],
    plag: [
      { label: '10.75 שעות זמניות (גר״א)', rule: { type: 'shaos', hours: 10.75, basis: 'gra' } },
      { label: '10.75 שעות זמניות (מג״א)', rule: { type: 'shaos', hours: 10.75, basis: 'mga' } }
    ]
  };

  global.ZmanimMethods = {
    METHODS: METHODS,
    ZMAN_ORDER: ZMAN_ORDER,
    ZMAN_NAMES: ZMAN_NAMES,
    CUSTOM_OPTIONS: CUSTOM_OPTIONS,
    getById: function (id) {
      for (var i = 0; i < METHODS.length; i++) {
        if (METHODS[i].id === id) return METHODS[i];
      }
      return null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
