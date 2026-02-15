
/* Utilities */

function clampInt(n, min, max){
  const x = Number.parseInt(String(n).trim(), 10);
  if (Number.isNaN(x)) return null;
  return Math.max(min, Math.min(max, x));
}

function padLeft(num, size){
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

function formatNumberArabic(n){
  // Return Western (English) digits while keeping grouping
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 0 }).format(num);
}

function formatAmountArabic(n){
  // Money formatter: keep grouping and allow decimals up to 2 digits.
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return new Intl.NumberFormat('en-US', {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}


function parseAmount(str){
  if (str == null) return null;
  const normalized = String(str).trim()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\u066B/g, '.')   // Arabic decimal separator (٫)
    .replace(/\u066C/g, ',')   // Arabic thousands separator (٬)
    .replace(/،/g, ',')        // Arabic comma
    .replace(/\s+/g, '')
    .replace(/[^\d.,-]/g, '');

  if (!normalized) return null;
  if (normalized === '-' || /^[.,-]+$/.test(normalized)) return null;
  if ((normalized.match(/-/g) || []).length > 1) return null;
  if (normalized.includes('-') && !normalized.startsWith('-')) return null;

  const sign = normalized.startsWith('-') ? -1 : 1;
  const value = normalized.replace(/^-/, '');
  if (!value) return null;

  const dotCount = (value.match(/\./g) || []).length;
  const commaCount = (value.match(/,/g) || []).length;

  function parseWithDecimal(raw, decimalSep){
    const parts = raw.split(decimalSep);
    if (parts.length > 2) return null;
    const intPart = parts[0].replace(/[.,]/g, '');
    const fracPart = (parts[1] || '').replace(/[.,]/g, '');
    if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
    if (fracPart.length > 2) return null;
    const compact = fracPart ? `${intPart}.${fracPart}` : intPart;
    if (!compact) return null;
    const parsed = Number(compact);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isGroupingPattern(raw, sep){
    const groups = raw.split(sep);
    if (groups.length < 2) return false;
    if (!/^\d{1,3}$/.test(groups[0])) return false;
    for (let i = 1; i < groups.length; i++) {
      if (!/^\d{3}$/.test(groups[i])) return false;
    }
    return true;
  }

  let n = null;

  if (dotCount && commaCount){
    const decimalSep = value.lastIndexOf('.') > value.lastIndexOf(',') ? '.' : ',';
    n = parseWithDecimal(value, decimalSep);
  } else if (commaCount || dotCount){
    const sep = commaCount ? ',' : '.';
    const count = commaCount || dotCount;

    if (isGroupingPattern(value, sep)) {
      n = Number(value.split(sep).join(''));
    } else if (count === 1) {
      const sepIndex = value.indexOf(sep);
      const fractionLen = value.length - sepIndex - 1;
      if (fractionLen <= 0) return null;
      // Prefer 1-2 decimal digits; longer suffix is treated as grouping.
      if (fractionLen <= 2) {
        n = parseWithDecimal(value, sep);
      } else {
        n = Number(value.split(sep).join(''));
      }
    } else {
      return null;
    }
  } else {
    n = Number(value);
  }

  if (!Number.isFinite(n)) return null;
  return sign * n;
}


// Shared date helpers (avoid timezone/UTC off-by-one with ISO-only dates)
function toLocalISODate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
window.toLocalISODate = toLocalISODate;

function parseISOToLocalDate(iso){
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(iso || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
window.parseISOToLocalDate = parseISOToLocalDate;

function escapeHtml(str){
  return String(str ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clampInt, padLeft, formatNumberArabic, formatAmountArabic, parseAmount, toLocalISODate, parseISOToLocalDate, escapeHtml };
}
