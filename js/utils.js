
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
    .replace(/[^\d.,]/g, '');

  if (!normalized) return null;

  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  const sepIndex = Math.max(lastDot, lastComma);

  let compact;
  if (sepIndex >= 0){
    const intPart = normalized.slice(0, sepIndex).replace(/[.,]/g, '');
    const fracPart = normalized.slice(sepIndex + 1).replace(/[.,]/g, '');
    compact = fracPart ? `${intPart}.${fracPart}` : intPart;
  } else {
    compact = normalized.replace(/[.,]/g, '');
  }

  if (!compact) return null;

  const n = Number(compact);
  return Number.isFinite(n) ? n : null;
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
