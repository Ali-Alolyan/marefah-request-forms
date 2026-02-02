
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


function parseAmount(str){
  if (str == null) return null;
  const s = String(str).trim().replace(/[^\d.]/g,'');
  if (!s) return null;
  const n = Number(s);
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
