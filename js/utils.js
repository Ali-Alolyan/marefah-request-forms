
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
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return new Intl.NumberFormat('ar-SA').format(num);
}

function parseAmount(str){
  if (str == null) return null;
  const s = String(str).trim().replace(/[^\d.]/g,'');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function randomLetterNumber(){
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const seq = padLeft(Math.floor(Math.random()*900)+100, 3);
  return `LTR-${yy}-${seq}`;
}

function escapeHtml(str){
  return String(str ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}
