import { describe, it, expect } from 'vitest';

// Mock window global needed by utils.js
globalThis.window = globalThis.window || {};

const { clampInt, padLeft, formatNumberArabic, formatAmountArabic, parseAmount, toLocalISODate, parseISOToLocalDate, escapeHtml } = require('../js/utils.js');

describe('clampInt', () => {
  it('clamps within range', () => {
    expect(clampInt(5, 1, 10)).toBe(5);
  });
  it('clamps below min', () => {
    expect(clampInt(-1, 0, 100)).toBe(0);
  });
  it('clamps above max', () => {
    expect(clampInt(999, 0, 100)).toBe(100);
  });
  it('parses string numbers', () => {
    expect(clampInt('42', 0, 100)).toBe(42);
  });
  it('returns null for non-numeric', () => {
    expect(clampInt('abc', 0, 100)).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(clampInt('', 0, 100)).toBeNull();
  });
  it('handles whitespace-padded input', () => {
    expect(clampInt('  7  ', 0, 10)).toBe(7);
  });
});

describe('formatNumberArabic', () => {
  it('formats a whole number with grouping', () => {
    expect(formatNumberArabic(1234567)).toBe('1,234,567');
  });
  it('returns empty for NaN', () => {
    expect(formatNumberArabic('xyz')).toBe('');
  });
  it('formats zero', () => {
    expect(formatNumberArabic(0)).toBe('0');
  });
  it('truncates decimals', () => {
    expect(formatNumberArabic(1234.99)).toBe('1,235');
  });
});

describe('formatAmountArabic', () => {
  it('formats amount with two decimal places', () => {
    expect(formatAmountArabic(1500.5)).toBe('1,500.5');
  });
  it('formats whole numbers without decimals', () => {
    expect(formatAmountArabic(1000)).toBe('1,000');
  });
  it('returns empty for Infinity', () => {
    expect(formatAmountArabic(Infinity)).toBe('');
  });
});

describe('parseAmount', () => {
  it('parses simple integer', () => {
    expect(parseAmount('1000')).toBe(1000);
  });
  it('parses comma-grouped number', () => {
    expect(parseAmount('1,234,567')).toBe(1234567);
  });
  it('parses decimal with dot', () => {
    expect(parseAmount('1500.50')).toBe(1500.5);
  });
  it('parses negative amount', () => {
    expect(parseAmount('-500')).toBe(-500);
  });
  it('returns null for null input', () => {
    expect(parseAmount(null)).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(parseAmount('')).toBeNull();
  });
  it('returns null for only punctuation', () => {
    expect(parseAmount('...')).toBeNull();
  });
  it('handles Arabic-Indic digits (Eastern)', () => {
    expect(parseAmount('١٢٣')).toBe(123);
  });
  it('handles Extended Arabic-Indic digits (Farsi)', () => {
    expect(parseAmount('۱۲۳')).toBe(123);
  });
  it('handles Arabic decimal separator', () => {
    expect(parseAmount('١٫٥')).toBe(1.5);
  });
  it('parses European-style comma decimal', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
  });
  it('returns null for misplaced minus', () => {
    expect(parseAmount('12-34')).toBeNull();
  });
  it('returns null for multiple minus signs', () => {
    expect(parseAmount('--100')).toBeNull();
  });
});

describe('toLocalISODate', () => {
  it('formats date as YYYY-MM-DD', () => {
    const d = new Date(2026, 0, 15, 12, 0, 0, 0);
    expect(toLocalISODate(d)).toBe('2026-01-15');
  });
  it('pads single-digit month and day', () => {
    const d = new Date(2026, 1, 5, 12, 0, 0, 0);
    expect(toLocalISODate(d)).toBe('2026-02-05');
  });
});

describe('parseISOToLocalDate', () => {
  it('parses valid ISO date', () => {
    const d = parseISOToLocalDate('2026-02-15');
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(15);
  });
  it('returns null for invalid format', () => {
    expect(parseISOToLocalDate('15/02/2026')).toBeNull();
  });
  it('returns null for null input', () => {
    expect(parseISOToLocalDate(null)).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(parseISOToLocalDate('')).toBeNull();
  });
  it('uses noon to avoid timezone issues', () => {
    const d = parseISOToLocalDate('2026-01-01');
    expect(d.getHours()).toBe(12);
  });
  it('roundtrips with toLocalISODate', () => {
    const iso = '2026-06-30';
    const d = parseISOToLocalDate(iso);
    expect(toLocalISODate(d)).toBe(iso);
  });
});

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });
  it('handles null', () => {
    expect(escapeHtml(null)).toBe('');
  });
  it('handles undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });
  it('preserves Arabic text', () => {
    expect(escapeHtml('مرحبا')).toBe('مرحبا');
  });
});
