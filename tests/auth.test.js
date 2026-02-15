import { describe, it, expect } from 'vitest';

// Mock browser globals needed by auth.js IIFE
globalThis.window = globalThis.window || {};
if (!globalThis.document) {
  const mockEl = () => ({
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { display: '' },
    textContent: '',
    value: '',
    disabled: false,
    readOnly: false,
    dataset: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    focus: () => {},
    querySelectorAll: () => [],
    parentNode: { replaceChild: () => {} },
  });
  globalThis.document = {
    readyState: 'complete',
    getElementById: () => mockEl(),
    addEventListener: () => {},
    body: { classList: { add: () => {}, remove: () => {} } },
  };
}
if (!globalThis.localStorage) {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

const { normalizeAccountCode, buildApplicantDisplayName, computeSessionHash } = require('../js/auth.js');

describe('normalizeAccountCode', () => {
  it('returns digits unchanged', () => {
    expect(normalizeAccountCode('123456789')).toBe('123456789');
  });

  it('strips whitespace', () => {
    expect(normalizeAccountCode(' 123 456 789 ')).toBe('123456789');
  });

  it('converts Arabic-Indic digits', () => {
    expect(normalizeAccountCode('١٢٣٤٥٦٧٨٩')).toBe('123456789');
  });

  it('converts Extended Arabic-Indic digits (Farsi)', () => {
    expect(normalizeAccountCode('۱۲۳۴۵۶۷۸۹')).toBe('123456789');
  });

  it('handles null/undefined', () => {
    expect(normalizeAccountCode(null)).toBe('');
    expect(normalizeAccountCode(undefined)).toBe('');
  });

  it('handles mixed digit systems', () => {
    expect(normalizeAccountCode('١23٤56۷89')).toBe('123456789');
  });
});

describe('buildApplicantDisplayName', () => {
  it('prepends academic title to name', () => {
    expect(buildApplicantDisplayName('محمد العلي', 'د.')).toBe('د. محمد العلي');
  });

  it('returns name alone when no title', () => {
    expect(buildApplicantDisplayName('محمد العلي', '')).toBe('محمد العلي');
  });

  it('returns name alone when title is null', () => {
    expect(buildApplicantDisplayName('محمد العلي', null)).toBe('محمد العلي');
  });

  it('returns empty for empty name', () => {
    expect(buildApplicantDisplayName('', 'د.')).toBe('');
  });

  it('avoids duplicate title if name already starts with it', () => {
    expect(buildApplicantDisplayName('د. محمد العلي', 'د.')).toBe('د. محمد العلي');
  });

  it('avoids duplicate when name equals title', () => {
    expect(buildApplicantDisplayName('أ.د. محمد', 'أ.د. محمد')).toBe('أ.د. محمد');
  });
});

describe('computeSessionHash', () => {
  it('returns a string hash', () => {
    const hash = computeSessionHash({
      account_code: '123456789',
      full_name: 'Test',
      job_title: 'Dev',
      _savedAt: 1000,
    });
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('returns consistent results', () => {
    const obj = { account_code: '111', full_name: 'A', job_title: 'B', _savedAt: 999 };
    const h1 = computeSessionHash(obj);
    const h2 = computeSessionHash(obj);
    expect(h1).toBe(h2);
  });

  it('differs for different inputs', () => {
    const h1 = computeSessionHash({ account_code: '111', full_name: 'A', job_title: 'B', _savedAt: 1 });
    const h2 = computeSessionHash({ account_code: '222', full_name: 'A', job_title: 'B', _savedAt: 1 });
    expect(h1).not.toBe(h2);
  });
});
