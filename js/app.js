/* Main app (v3) */

const STORAGE_KEY = 'marefah-letter-draft-v4';

// Initialize global converter for date-picker.js
window.hijriConverter = new HijriConverter();

/* Codebook (Appendix 1) extracted from "القرار رقم 1 نسخة ثانية" */
const PF_OPTIONS = [
  { code:'TAS', name:'تأسيس' },
  { code:'OFQ', name:'أفق' },
  { code:'ITH', name:'إثراء' },
];

// Programs are anchored to the portfolio structure in المادة (4)
const PRG_OPTIONS = [
  // (أ) محفظة تأسيس (Tasees)
  { pf:'TAS', code:'MFA', name:'أكاديمية معرفة' },
  { pf:'TAS', code:'GRS', name:'غرس' },
  { pf:'TAS', code:'HRF', name:'حرف' },
  { pf:'TAS', code:'AML', name:'محو الأمية' },
  { pf:'TAS', code:'SPT', name:'بدعمكم نتعلم' },

  // (ب) محفظة أفق (Ofuq)
  { pf:'OFQ', code:'LDR', name:'أكاديمية قادة' },
  { pf:'OFQ', code:'INC', name:'تطوير المشاريع التعليمية والتربوية (حاضنة)' },
  { pf:'OFQ', code:'LQN', name:'لبنات القيم' },
  { pf:'OFQ', code:'TRP', name:'الرحلات التعليمية' },

  // (ج) محفظة إثراء (Ithra)
  { pf:'ITH', code:'QRH', name:'أكاديمية القراءة' },
  { pf:'ITH', code:'CNE', name:'التعليم المستمر' },
  { pf:'ITH', code:'EXH', name:'المعارض التعليمية' },
  { pf:'ITH', code:'NKB', name:'النخبة للتنافس الثقافي' },
  { pf:'ITH', code:'FAM', name:'الأسرة المتعلمة' },
  { pf:'ITH', code:'INT', name:'اهتمامات معرفية' },
];

const el = (id) => document.getElementById(id);

let signatureDataUrl = null;
let COST_CENTER_LIST = [];

// Date helpers (avoid timezone/UTC off-by-one when using ISO-only dates)
function toLocalISODate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISOToLocalDate(iso){
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(iso || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function init(){
  buildCostCenters();
  bindCostCenter();
  bindDatePicker();
  bindUI();
  bindMobileTabs();
  setDefaults();
  refresh();
}

function buildCostCenters(){
  const pfMap = new Map(PF_OPTIONS.map(x => [x.code, x.name]));
  COST_CENTER_LIST = PRG_OPTIONS.map(p => {
    const value = `${p.pf}-${p.code}`;
    const pfName = pfMap.get(p.pf) || p.pf;
    const label = `${value} — ${pfName} / ${p.name}`;
    return { value, pf:p.pf, prg:p.code, pfName, programNameAr:p.name, label };
  });
}

function bindCostCenter(){
  const sel = el('costCenter');
  sel.innerHTML = COST_CENTER_LIST.map(o => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
  sel.addEventListener('change', () => { updateProgramName(); refresh(); });
  updateProgramName();
}

function updateProgramName(){
  const cc = String(el('costCenter').value || '').trim();
  const found = COST_CENTER_LIST.find(x => x.value === cc);
  el('programNameDisplay').value = found?.programNameAr || '';
}

function bindDatePicker(){
  // Dual date picker uses a hidden ISO input (#date) and a visible display input (#dateDisplay)
  // date-picker.js expects an element (not an id string).
  window.dualDatePicker = new DualCalendarPicker(el('date'));
  el('date').addEventListener('change', refresh);
}

function bindUI(){
  const watchIds = [
    'letterType','costCenter',
    'applicantName','jobTitle','subject','details',
    'custodyAmount','usedAmount','remainingAmount','attachments','attachmentsGeneral',
    // signatureMode is handled separately (to update UI first then refresh)
  ];

  watchIds.forEach(id => {
    const node = el(id);
    if (!node) return;
    node.addEventListener('input', refresh);
    node.addEventListener('change', refresh);
  });

  // Signature mode (update UI immediately, then refresh)
  el('signatureMode').addEventListener('change', () => {
    applySignatureModeUI();
    signatureDataUrl = null;
    const mode = el('signatureMode').value;
    if (mode === 'canvas'){
      el('signatureFile').value = '';
    }else{
      if (window.signatureManager) window.signatureManager.clear();
    }
    refresh();
  });

  // Upload signature
  el('signatureFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file){
      signatureDataUrl = null;
      refresh();
      return;
    }
    signatureDataUrl = await readFileAsDataUrl(file);
    refresh();
  });

  // Listen to canvas signature changes
  el('signatureCanvas').addEventListener('signatureChanged', () => {
    if (el('signatureMode').value === 'canvas'){
      signatureDataUrl = window.signatureManager?.hasDrawing() ? window.signatureManager.getDataURL() : null;
      refresh();
    }
  });

  // Save/Load draft
  el('btn-save').addEventListener('click', saveDraft);
  el('btn-load').addEventListener('click', loadDraft);

  // Export PDF
  el('btn-export').addEventListener('click', () => exportPDF());

  // Improve mobile keyboard UX: avoid accidental zoom on iOS
  document.addEventListener('gesturestart', (e) => e.preventDefault?.(), { passive:false });
}

function bindMobileTabs(){
  const tabs = Array.from(document.querySelectorAll('.mobileTabs .tab, .bottomTabs .tab'));
  if (!tabs.length) return;

  const setView = (view) => {
    document.body.setAttribute('data-mobile-view', view);
    tabs.forEach(t => t.classList.toggle('is-active', t.dataset.view === view));

    // When opening preview on mobile, recalc scale after layout settles.
    if (view === 'preview'){
      requestAnimationFrame(() => setTimeout(applyResponsiveScale, 20));
    }
  };

  tabs.forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));

  // Default
  setView(document.body.getAttribute('data-mobile-view') || 'form');

  window.addEventListener('resize', () => {
    applyResponsiveScale();
  });
}

function setDefaults(){
  const now = new Date();

  // Default letter type: general
  el('letterType').value = 'general';

  // Set today's date (local ISO)
  const iso = toLocalISODate(now);
  el('date').value = iso;
  if (window.dualDatePicker){
    window.dualDatePicker.selectedDate = parseISOToLocalDate(iso) || new Date();
    window.dualDatePicker.updateDisplay();
  }

  // Default cost center: first option
  if (!el('costCenter').value){
    el('costCenter').value = COST_CENTER_LIST[0]?.value || '';
    updateProgramName();
  }

  // Ensure correct initial UI (cost center + signature mode)
  applyLetterTypeUI();
  applySignatureModeUI();
}

function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function toggleExtraSections(type){
  el('extra-custody').style.display = type === 'custody' ? 'block' : 'none';
  el('extra-close').style.display = type === 'close_custody' ? 'block' : 'none';
  el('extra-general').style.display = type === 'general' ? 'block' : 'none';
}

function computeCostCenter(){
  // For general letters we hide cost center entirely.
  if (el('letterType').value === 'general'){
    return { costCenter: '', programNameAr: '', pfName: '' };
  }
  const costCenter = String(el('costCenter').value || '').trim();
  const found = COST_CENTER_LIST.find(x => x.value === costCenter);
  const programNameAr = found?.programNameAr || '';
  const pfName = found?.pfName || '';
  return { costCenter, programNameAr, pfName };
}

function computeDates(){
  const iso = el('date').value;
  const d = parseISOToLocalDate(iso) || new Date();
  const hijri = window.hijriConverter.toHijri(d);
  // Display dates as compact numbers (DD/MM/YYYY) to avoid overlap in the header.
  // (Keeping suffixes هـ / م as required.)
  const dateHijri = window.hijriConverter.formatHijriNumeric(hijri, { separator: '/', useArabicDigits: false });
  const dateGregorian = window.hijriConverter.formatGregorianNumeric(d, { separator: '/', useArabicDigits: false });
  return { dateISO: iso, dateHijri, dateGregorian };
}

function collectState(){
  const type = el('letterType').value;
  toggleExtraSections(type);
  applyLetterTypeUI();

  const cc = computeCostCenter();
  const dates = computeDates();

  // Attachments in header (المشفوعات)
  let attachments = 0;
  if (type === 'close_custody'){
    attachments = clampInt(el('attachments').value, 0, 9999) ?? 0;
  }else if (type === 'general'){
    attachments = clampInt(el('attachmentsGeneral').value, 0, 9999) ?? 0;
  }
  const attachmentsText = attachments ? formatNumberArabic(attachments) : '';

  // Subject: auto-fill if empty or matches old auto pattern
  const currentSubject = String(el('subject').value || '').trim();
  const autoSubject = buildSubjectByType(type, cc.costCenter);
  if (!currentSubject || currentSubject.startsWith('طلب عهدة') || currentSubject.startsWith('طلب إغلاق') || currentSubject.startsWith('خطاب عام')){
    el('subject').value = autoSubject;
  }
  const subject = String(el('subject').value || '').trim();

  // Details
  const details = String(el('details').value || '').trim();

  // Amounts
  const custodyAmount = parseAmount(el('custodyAmount')?.value);
  const usedAmount = parseAmount(el('usedAmount')?.value);
  const remainingAmount = parseAmount(el('remainingAmount')?.value);

  // Signature
  let sig = signatureDataUrl;
  if (!sig && el('signatureMode').value === 'canvas' && window.signatureManager?.hasDrawing()){
    sig = window.signatureManager.getDataURL();
  }

  return {
    type,
    subject,
    details,
    applicantName: String(el('applicantName').value || '').trim(),
    jobTitle: String(el('jobTitle').value || '').trim(),

    custodyAmount,
    usedAmount,
    remainingAmount,
    attachments,

    signatureDataUrl: sig,

    attachmentsText,
    ...cc,
    ...dates
  };
}

function refresh(){
  // Make sure UI state stays consistent even if an earlier error prevented handlers.
  applyLetterTypeUI();
  applySignatureModeUI();

  const state = collectState();

  // Render blocks
  const blocks = renderLetterBlocks(state);

  // Mark the details body as splittable so long text can continue on next page
  blocks.forEach(b => {
    const spl = b.querySelector?.('[data-splittable="true"]');
    if (spl) return;
    const hasPre = b.querySelector?.('div[style*="white-space"]');
    if (hasPre) hasPre.setAttribute('data-splittable','true');
  });

  // Paginate and render pages
  const pages = buildPages(state, blocks);

  const printRoot = el('printRoot');
  printRoot.innerHTML = '';
  pages.forEach(p => printRoot.appendChild(p));

  applyResponsiveScale();
}

function applyResponsiveScale(){
  const root = el('printRoot');
  if (!root) return;
  const page = root.querySelector('.a4-page');
  if (!page) return;

  // offsetWidth is the untransformed layout width (important when transform scale is set).
  const baseWidth = page.offsetWidth || 1;
  const available = Math.max(240, root.clientWidth - 8);
  const scale = Math.min(1, available / baseWidth);

  document.documentElement.style.setProperty('--page-scale', String(Number(scale.toFixed(4))));
}

function saveDraft(){
  const state = collectState();

  // Store without signature data for privacy/performance
  const safe = { ...state, signatureDataUrl: null };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  alert('تم حفظ المسودة.');
}

function loadDraft(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw){
    alert('لا توجد مسودة محفوظة.');
    return;
  }
  const state = JSON.parse(raw);

  el('letterType').value = state.type || 'general';

  // Cost center
  el('costCenter').value = state.costCenter || el('costCenter').value;
  updateProgramName();

  el('applicantName').value = state.applicantName || '';
  el('jobTitle').value = state.jobTitle || '';
  el('subject').value = state.subject || '';
  el('details').value = state.details || '';

  el('custodyAmount').value = state.custodyAmount ?? '';
  el('usedAmount').value = state.usedAmount ?? '';
  el('remainingAmount').value = state.remainingAmount ?? '';
  el('attachments').value = state.attachments ?? '';
  el('attachmentsGeneral').value = state.attachments ?? '';

  // Date
  if (state.dateISO){
    el('date').value = state.dateISO;
  }
  if (window.dualDatePicker){
    const iso = el('date').value || toLocalISODate(new Date());
    window.dualDatePicker.selectedDate = parseISOToLocalDate(iso) || new Date();
    window.dualDatePicker.updateDisplay();
  }

  // Signature: not restoring data URL (user re-adds)
  signatureDataUrl = null;

  alert('تم استرجاع المسودة (يرجى إعادة التوقيع).');
  refresh();
}

function applyLetterTypeUI(){
  const type = el('letterType')?.value || 'general';
  const costSection = el('section-costcenter');
  if (costSection){
    costSection.style.display = type === 'general' ? 'none' : 'block';
  }
}

function applySignatureModeUI(){
  const mode = el('signatureMode')?.value || 'canvas';
  const uploadField = el('signatureUploadField');
  const canvasWrap = el('signatureCanvasWrap');
  if (uploadField) uploadField.style.display = mode === 'upload' ? 'block' : 'none';
  if (canvasWrap) canvasWrap.style.display = mode === 'canvas' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', init);
