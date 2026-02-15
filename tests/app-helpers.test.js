import { describe, it, expect } from 'vitest';

// Mock browser globals needed by app.js
globalThis.window = globalThis.window || {};
globalThis.window.matchMedia = globalThis.window.matchMedia || (() => ({ matches: false, addEventListener: () => {} }));

const mockElement = () => ({
  classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
  appendChild: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelectorAll: () => [],
  querySelector: () => null,
  insertAdjacentHTML: () => {},
  innerHTML: '',
  textContent: '',
  value: '',
  style: {},
  dataset: {},
  tagName: 'DIV',
  parentNode: { replaceChild: () => {} },
  closest: () => null,
});

if (!globalThis.document) {
  globalThis.document = {
    readyState: 'complete',
    getElementById: () => null,
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => mockElement(),
    body: mockElement(),
  };
}
if (!globalThis.localStorage) {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

// Mock HijriConverter which app.js depends on as a global
globalThis.HijriConverter = globalThis.HijriConverter || class {
  constructor() { this.hijriMonths = []; this.gregorianMonths = []; }
  toHijri() { return { year: 1447, month: 1, day: 1 }; }
  formatHijri() { return ''; }
  formatHijriNumeric() { return ''; }
  formatGregorian() { return ''; }
  formatGregorianNumeric() { return ''; }
};
globalThis.hijriConverter = globalThis.hijriConverter || new globalThis.HijriConverter();
globalThis.escapeHtml = globalThis.escapeHtml || ((s) => String(s || ''));
globalThis.formatNumberArabic = globalThis.formatNumberArabic || ((n) => String(n));
globalThis.formatAmountArabic = globalThis.formatAmountArabic || ((n) => String(n));
globalThis.parseAmount = globalThis.parseAmount || ((s) => Number(s) || null);
globalThis.clampInt = globalThis.clampInt || ((n) => n);
globalThis.toLocalISODate = globalThis.toLocalISODate || ((d) => '');
globalThis.parseISOToLocalDate = globalThis.parseISOToLocalDate || (() => null);
globalThis.DualCalendarPicker = globalThis.DualCalendarPicker || class {};
globalThis.buildPages = globalThis.buildPages || (() => []);
globalThis.shouldShowCostCenterLine = globalThis.shouldShowCostCenterLine || (() => false);
globalThis.buildSubjectByType = globalThis.buildSubjectByType || (() => '');
globalThis.renderLetterBlocks = globalThis.renderLetterBlocks || (() => []);
globalThis.showToast = globalThis.showToast || (() => {});

const { typeNeedsProjects, isGeneralFinancialType, isAgreementRequiredType, normalizeAttachmentType } = require('../js/app.js');

describe('typeNeedsProjects', () => {
  it('returns true for custody', () => {
    expect(typeNeedsProjects('custody')).toBe(true);
  });

  it('returns true for close_custody', () => {
    expect(typeNeedsProjects('close_custody')).toBe(true);
  });

  it('returns false for general', () => {
    expect(typeNeedsProjects('general')).toBe(false);
  });

  it('returns false for general_financial', () => {
    expect(typeNeedsProjects('general_financial')).toBe(false);
  });
});

describe('isGeneralFinancialType', () => {
  it('returns true for general_financial', () => {
    expect(isGeneralFinancialType('general_financial')).toBe(true);
  });

  it('returns false for custody', () => {
    expect(isGeneralFinancialType('custody')).toBe(false);
  });

  it('returns false for general', () => {
    expect(isGeneralFinancialType('general')).toBe(false);
  });
});

describe('isAgreementRequiredType', () => {
  it('returns true for custody', () => {
    expect(isAgreementRequiredType('custody')).toBe(true);
  });

  it('returns true for close_custody', () => {
    expect(isAgreementRequiredType('close_custody')).toBe(true);
  });

  it('returns true for general_financial', () => {
    expect(isAgreementRequiredType('general_financial')).toBe(true);
  });

  it('returns false for general', () => {
    expect(isAgreementRequiredType('general')).toBe(false);
  });
});

describe('normalizeAttachmentType', () => {
  it('normalizes PDF mime type', () => {
    expect(normalizeAttachmentType({ type: 'application/pdf', name: 'doc.pdf' })).toBe('application/pdf');
  });

  it('normalizes x-pdf mime type', () => {
    expect(normalizeAttachmentType({ type: 'application/x-pdf', name: 'doc.pdf' })).toBe('application/pdf');
  });

  it('detects PDF from extension when mime is empty', () => {
    expect(normalizeAttachmentType({ type: '', name: 'document.pdf' })).toBe('application/pdf');
  });

  it('normalizes PNG', () => {
    expect(normalizeAttachmentType({ type: 'image/png', name: 'img.png' })).toBe('image/png');
  });

  it('normalizes JPEG', () => {
    expect(normalizeAttachmentType({ type: 'image/jpeg', name: 'photo.jpg' })).toBe('image/jpeg');
  });

  it('normalizes image/jpg to image/jpeg', () => {
    expect(normalizeAttachmentType({ type: 'image/jpg', name: 'photo.jpg' })).toBe('image/jpeg');
  });

  it('normalizes WebP', () => {
    expect(normalizeAttachmentType({ type: 'image/webp', name: 'img.webp' })).toBe('image/webp');
  });

  it('returns empty for unsupported type', () => {
    expect(normalizeAttachmentType({ type: 'video/mp4', name: 'video.mp4' })).toBe('');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeAttachmentType(null)).toBe('');
    expect(normalizeAttachmentType(undefined)).toBe('');
  });
});
