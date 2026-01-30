/**
 * Hijri-Gregorian Date Converter
 * Accurate conversion between Islamic (Hijri) and Gregorian calendars
 */

class HijriConverter {
  constructor() {
    // Hijri month names in Arabic
    this.hijriMonths = [
      'محرم',
      'صفر',
      'ربيع الأول',
      'ربيع الآخر',
      'جمادى الأولى',
      'جمادى الآخرة',
      'رجب',
      'شعبان',
      'رمضان',
      'شوال',
      'ذو القعدة',
      'ذو الحجة'
    ];

    // Gregorian month names in Arabic
    this.gregorianMonths = [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر'
    ];
  }

  /**
   * Convert Gregorian date to Hijri
   * @param {Date} date - Gregorian date
   * @returns {Object} {year, month, day}
   */
  toHijri(date) {
    if (!(date instanceof Date) || isNaN(date)) {
      return null;
    }

    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();

    // Julian day calculation
    let a = Math.floor((14 - month) / 12);
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;

    let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y +
             Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

    // Convert Julian to Hijri
    let l = jd - 1948440 + 10632;
    let n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    let j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) +
            (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) -
        (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;

    month = Math.floor((24 * l) / 709);
    day = l - Math.floor((709 * month) / 24);
    year = 30 * n + j - 30;

    return {
      year: year,
      month: month,
      day: day
    };
  }

  /**
   * Convert Hijri date to Gregorian
   * @param {number} year - Hijri year
   * @param {number} month - Hijri month (1-12)
   * @param {number} day - Hijri day
   * @returns {Date} Gregorian date
   */
  toGregorian(year, month, day) {
    // Calculate Julian day from Hijri
    let jd = Math.floor((11 * year + 3) / 30) +
             354 * year + 30 * month -
             Math.floor((month - 1) / 2) + day + 1948440 - 385;

    if (jd > 2299160) {
      let a = Math.floor((jd - 1867216.25) / 36524.25);
      jd = jd + 1 + a - Math.floor(a / 4);
    }

    let b = jd + 1524;
    let c = Math.floor((b - 122.1) / 365.25);
    let d = Math.floor(365.25 * c);
    let e = Math.floor((b - d) / 30.6001);

    day = b - d - Math.floor(30.6001 * e);
    month = e < 14 ? e - 1 : e - 13;
    year = month > 2 ? c - 4716 : c - 4715;

    return new Date(year, month - 1, day);
  }

  /**
   * Format Hijri date as string
   * @param {Object} hijriDate - {year, month, day}
   * @param {boolean} includeDay - Include day name
   * @returns {string} Formatted Hijri date
   */
  formatHijri(hijriDate, includeDay = false) {
    if (!hijriDate) return '';

    const monthName = this.hijriMonths[hijriDate.month - 1];
    let formatted = `${hijriDate.day} ${monthName} ${hijriDate.year} هـ`;

    return formatted;
  }

  /**
   * Format Hijri date as numeric string for official letters.
   * Example: ١٥ / ٠٨ / ١٤٤٧ هـ
   */
  formatHijriNumeric(hijriDate, { separator = ' / ', useArabicDigits = true } = {}) {
    if (!hijriDate) return '';
    const day = hijriDate.day;
    const month = hijriDate.month;
    const year = hijriDate.year;

    if (useArabicDigits) {
      const fmt2 = new Intl.NumberFormat('ar-SA', { minimumIntegerDigits: 2, useGrouping: false });
      const fmt4 = new Intl.NumberFormat('ar-SA', { minimumIntegerDigits: 4, useGrouping: false });
      return `${fmt2.format(day)}${separator}${fmt2.format(month)}${separator}${fmt4.format(year)} هـ`;
    }

    const d = String(day).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    const y = String(year).padStart(4, '0');
    return `${d}${separator}${m}${separator}${y} هـ`;
  }

  /**
   * Format Gregorian date as Arabic string
   * @param {Date} date - Gregorian date
   * @returns {string} Formatted Gregorian date
   */
  formatGregorian(date) {
    if (!(date instanceof Date) || isNaN(date)) return '';

    const day = date.getDate();
    const monthName = this.gregorianMonths[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${monthName} ${year} م`;
  }

  /**
   * Format Gregorian date as numeric string for official letters.
   * Example: ٣٠ / ٠١ / ٢٠٢٦ م
   */
  formatGregorianNumeric(date, { separator = ' / ', useArabicDigits = true } = {}) {
    if (!(date instanceof Date) || isNaN(date)) return '';
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    if (useArabicDigits) {
      const fmt2 = new Intl.NumberFormat('ar-SA', { minimumIntegerDigits: 2, useGrouping: false });
      const fmt4 = new Intl.NumberFormat('ar-SA', { minimumIntegerDigits: 4, useGrouping: false });
      return `${fmt2.format(day)}${separator}${fmt2.format(month)}${separator}${fmt4.format(year)} م`;
    }

    const d = String(day).padStart(2, '0');
    const m = String(month).padStart(2, '0');
    const y = String(year).padStart(4, '0');
    return `${d}${separator}${m}${separator}${y} م`;
  }

  /**
   * Get day name in Arabic
   * @param {Date} date - Date object
   * @returns {string} Day name in Arabic
   */
  getDayName(date) {
    const dayNames = [
      'الأحد',
      'الاثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
      'السبت'
    ];

    return dayNames[date.getDay()];
  }

  /**
   * Check if Hijri year is leap year
   * @param {number} year - Hijri year
   * @returns {boolean}
   */
  isHijriLeapYear(year) {
    return (14 + 11 * year) % 30 < 11;
  }

  /**
   * Get number of days in Hijri month
   * @param {number} year - Hijri year
   * @param {number} month - Hijri month (1-12)
   * @returns {number} Number of days
   */
  getHijriMonthDays(year, month) {
    if (month === 12 && this.isHijriLeapYear(year)) {
      return 30;
    }
    return month % 2 === 1 ? 30 : 29;
  }

  /**
   * Get current Hijri date
   * @returns {Object} {year, month, day}
   */
  getCurrentHijri() {
    return this.toHijri(new Date());
  }

  /**
   * Parse Hijri date string (format: YYYY-MM-DD or DD/MM/YYYY)
   * @param {string} dateStr - Date string
   * @returns {Object} {year, month, day}
   */
  parseHijriDate(dateStr) {
    if (!dateStr) return null;

    // Try YYYY-MM-DD format
    let parts = dateStr.split('-');
    if (parts.length === 3) {
      return {
        year: parseInt(parts[0]),
        month: parseInt(parts[1]),
        day: parseInt(parts[2])
      };
    }

    // Try DD/MM/YYYY format
    parts = dateStr.split('/');
    if (parts.length === 3) {
      return {
        day: parseInt(parts[0]),
        month: parseInt(parts[1]),
        year: parseInt(parts[2])
      };
    }

    return null;
  }
}

// Create global instance
const hijriConverter = new HijriConverter();
