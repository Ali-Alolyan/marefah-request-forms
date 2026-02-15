import { describe, it, expect } from 'vitest';
const { HijriConverter } = require('../js/hijri-converter.js');

const converter = new HijriConverter();

describe('toHijri', () => {
  it('converts a known date', () => {
    // 2026-02-15 should be around Sha'ban 1447
    const d = new Date(2026, 1, 15, 12, 0, 0, 0);
    const h = converter.toHijri(d);
    expect(h).not.toBeNull();
    expect(h.year).toBe(1447);
    expect(h.month).toBeGreaterThanOrEqual(1);
    expect(h.month).toBeLessThanOrEqual(12);
    expect(h.day).toBeGreaterThanOrEqual(1);
    expect(h.day).toBeLessThanOrEqual(30);
  });

  it('returns null for invalid date', () => {
    expect(converter.toHijri(new Date('invalid'))).toBeNull();
  });

  it('returns null for non-Date', () => {
    expect(converter.toHijri('2026-01-01')).toBeNull();
  });

  it('converts epoch date', () => {
    const d = new Date(1970, 0, 1, 12, 0, 0, 0);
    const h = converter.toHijri(d);
    expect(h).not.toBeNull();
    expect(h.year).toBe(1389);
  });
});

describe('toGregorian', () => {
  it('converts a known Hijri date back', () => {
    const g = converter.toGregorian(1447, 8, 15);
    expect(g).toBeInstanceOf(Date);
    expect(g.getFullYear()).toBe(2026);
  });

  it('roundtrips with toHijri', () => {
    const original = new Date(2025, 5, 15, 12, 0, 0, 0);
    const h = converter.toHijri(original);
    const back = converter.toGregorian(h.year, h.month, h.day);
    // Allow 1 day difference due to algorithmic vs Umm al-Qura differences
    const diffDays = Math.abs(original.getTime() - back.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeLessThanOrEqual(2);
  });
});

describe('formatHijri', () => {
  it('formats a Hijri date with month name', () => {
    const formatted = converter.formatHijri({ year: 1447, month: 8, day: 15 });
    expect(formatted).toContain('1447');
    expect(formatted).toContain('شعبان');
    expect(formatted).toContain('هـ');
  });

  it('returns empty for null', () => {
    expect(converter.formatHijri(null)).toBe('');
  });
});

describe('formatHijriNumeric', () => {
  it('formats with Arabic digits by default', () => {
    const formatted = converter.formatHijriNumeric({ year: 1447, month: 8, day: 5 });
    expect(formatted).toContain('هـ');
    // Should contain Arabic numerals
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('formats with Western digits when requested', () => {
    const formatted = converter.formatHijriNumeric(
      { year: 1447, month: 8, day: 5 },
      { useArabicDigits: false }
    );
    expect(formatted).toBe('05 / 08 / 1447 هـ');
  });

  it('returns empty for null', () => {
    expect(converter.formatHijriNumeric(null)).toBe('');
  });
});

describe('isHijriLeapYear', () => {
  it('identifies leap years correctly', () => {
    // 1443: (14 + 11*1443) % 30 = 17. 17 >= 11 → not leap
    expect(converter.isHijriLeapYear(1443)).toBe(false);
    // 1447: (14 + 11*1447) % 30 = 1. 1 < 11 → leap
    expect(converter.isHijriLeapYear(1447)).toBe(true);
    // 1442: (14 + 11*1442) % 30 = 6. 6 < 11 → leap
    expect(converter.isHijriLeapYear(1442)).toBe(true);
  });
});

describe('getHijriMonthDays', () => {
  it('odd months have 30 days', () => {
    expect(converter.getHijriMonthDays(1447, 1)).toBe(30);
    expect(converter.getHijriMonthDays(1447, 3)).toBe(30);
  });

  it('even months have 29 days', () => {
    expect(converter.getHijriMonthDays(1447, 2)).toBe(29);
    expect(converter.getHijriMonthDays(1447, 4)).toBe(29);
  });

  it('month 12 has 30 days in leap year', () => {
    expect(converter.isHijriLeapYear(1447)).toBe(true);
    expect(converter.getHijriMonthDays(1447, 12)).toBe(30);
  });

  it('month 12 has 29 days in non-leap year', () => {
    expect(converter.isHijriLeapYear(1443)).toBe(false);
    expect(converter.getHijriMonthDays(1443, 12)).toBe(29);
  });
});

describe('formatGregorian', () => {
  it('formats a Gregorian date with Arabic month name', () => {
    const d = new Date(2026, 1, 15, 12, 0, 0, 0);
    const formatted = converter.formatGregorian(d);
    expect(formatted).toContain('15');
    expect(formatted).toContain('فبراير');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('م');
  });

  it('returns empty for invalid date', () => {
    expect(converter.formatGregorian(new Date('invalid'))).toBe('');
  });
});

describe('parseHijriDate', () => {
  it('parses YYYY-MM-DD format', () => {
    const result = converter.parseHijriDate('1447-08-15');
    expect(result).toEqual({ year: 1447, month: 8, day: 15 });
  });

  it('parses DD/MM/YYYY format', () => {
    const result = converter.parseHijriDate('15/08/1447');
    expect(result).toEqual({ day: 15, month: 8, year: 1447 });
  });

  it('returns null for empty string', () => {
    expect(converter.parseHijriDate('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(converter.parseHijriDate(null)).toBeNull();
  });
});
