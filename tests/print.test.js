import { describe, it, expect } from 'vitest';

// Mock browser globals needed by print.js IIFE
globalThis.window = globalThis.window || {};
if (!globalThis.document) globalThis.document = {
  getElementById: () => null,
  createElement: () => ({
    getContext: () => ({}),
    toDataURL: () => 'data:image/jpeg;base64,',
    style: {},
    click: () => {},
    remove: () => {},
    appendChild: () => {},
  }),
  body: { appendChild: () => {} },
  fonts: { ready: Promise.resolve() },
};
globalThis.URL = globalThis.URL || { createObjectURL: () => '', revokeObjectURL: () => {} };
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));

const { buildPdfFromJpegs, dataURLToBytes } = require('../js/print.js');

describe('dataURLToBytes', () => {
  it('converts a base64 data URL to Uint8Array', () => {
    const dataUrl = 'data:image/jpeg;base64,AQID'; // [1, 2, 3]
    const bytes = dataURLToBytes(dataUrl);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes[0]).toBe(1);
    expect(bytes[1]).toBe(2);
    expect(bytes[2]).toBe(3);
  });

  it('returns empty array for invalid data URL', () => {
    const bytes = dataURLToBytes('not-a-data-url');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(0);
  });
});

describe('buildPdfFromJpegs', () => {
  it('produces a valid PDF header', () => {
    const fakeJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    const pages = [{ jpegBytes: fakeJpeg, wPx: 2480, hPx: 3508 }];
    const pdf = buildPdfFromJpegs(pages);
    expect(pdf).toBeInstanceOf(Uint8Array);
    // Check PDF header
    const header = new TextDecoder().decode(pdf.slice(0, 8));
    expect(header).toContain('%PDF-1.4');
  });

  it('produces a PDF ending with %%EOF', () => {
    const fakeJpeg = new Uint8Array([0xFF, 0xD8]);
    const pages = [{ jpegBytes: fakeJpeg, wPx: 100, hPx: 100 }];
    const pdf = buildPdfFromJpegs(pages);
    const tail = new TextDecoder().decode(pdf.slice(-5));
    expect(tail).toBe('%%EOF');
  });

  it('handles multiple pages', () => {
    const fakeJpeg = new Uint8Array([0xFF, 0xD8]);
    const pages = [
      { jpegBytes: fakeJpeg, wPx: 100, hPx: 100 },
      { jpegBytes: fakeJpeg, wPx: 100, hPx: 100 },
      { jpegBytes: fakeJpeg, wPx: 100, hPx: 100 },
    ];
    const pdf = buildPdfFromJpegs(pages);
    const pdfStr = new TextDecoder().decode(pdf);
    expect(pdfStr).toContain('/Count 3');
  });

  it('embeds JPEG bytes in the output', () => {
    const marker = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
    const pages = [{ jpegBytes: marker, wPx: 10, hPx: 10 }];
    const pdf = buildPdfFromJpegs(pages);
    // The marker bytes should appear somewhere in the output
    let found = false;
    for (let i = 0; i <= pdf.length - 4; i++) {
      if (pdf[i] === 0xDE && pdf[i+1] === 0xAD && pdf[i+2] === 0xBE && pdf[i+3] === 0xEF) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
