import { describe, it, expect } from 'vitest';

// Mock browser globals needed by canvas-renderer.js IIFE
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || {
  createElement: () => ({
    getContext: () => ({}),
    width: 0,
    height: 0,
  }),
};

const { mmToPx, cssPxToMm, sanitizeText } = require('../js/canvas-renderer.js');

describe('mmToPx', () => {
  it('converts mm to pixels at 300 DPI', () => {
    // 210mm (A4 width) at 300 DPI = 210 * 300 / 25.4 ≈ 2480.3
    const px = mmToPx(210, 300);
    expect(px).toBeCloseTo(2480.3, 0);
  });

  it('converts mm to pixels at 240 DPI', () => {
    const px = mmToPx(210, 240);
    expect(px).toBeCloseTo(1984.3, 0);
  });

  it('converts mm to pixels at 150 DPI', () => {
    const px = mmToPx(210, 150);
    expect(px).toBeCloseTo(1240.2, 0);
  });

  it('returns 0 for 0mm', () => {
    expect(mmToPx(0, 300)).toBe(0);
  });

  it('handles A4 height at 300 DPI', () => {
    // 297mm at 300 DPI = 297 * 300 / 25.4 ≈ 3507.9
    const px = mmToPx(297, 300);
    expect(px).toBeCloseTo(3507.9, 0);
  });
});

describe('cssPxToMm', () => {
  it('converts CSS pixels to mm', () => {
    // 96 CSS px = 25.4mm (1 inch)
    const mm = cssPxToMm(96);
    expect(mm).toBeCloseTo(25.4, 1);
  });

  it('converts 14px body font to mm', () => {
    const mm = cssPxToMm(14);
    expect(mm).toBeCloseTo(3.704, 1);
  });

  it('returns 0 for 0px', () => {
    expect(cssPxToMm(0)).toBe(0);
  });
});

describe('sanitizeText', () => {
  it('normalizes CRLF to LF', () => {
    expect(sanitizeText('line1\r\nline2')).toBe('line1\nline2');
  });

  it('preserves LF', () => {
    expect(sanitizeText('line1\nline2')).toBe('line1\nline2');
  });

  it('handles null/undefined', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('preserves Arabic text', () => {
    expect(sanitizeText('مرحبا بالعالم')).toBe('مرحبا بالعالم');
  });

  it('handles multiple CRLF sequences', () => {
    expect(sanitizeText('a\r\nb\r\nc')).toBe('a\nb\nc');
  });
});
