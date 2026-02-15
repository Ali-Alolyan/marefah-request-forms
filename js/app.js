/* Main app (v3) */

/* -------------------------------------------------------
   Multi-Draft Storage (v6) — up to 5 named drafts per user
-------------------------------------------------------- */
const DRAFTS_KEY_PREFIX = 'marefah-letter-drafts-v6';
const LEGACY_DRAFT_KEY_V5 = 'marefah-letter-draft-v5';
const LEGACY_DRAFT_KEYS = ['marefah-letter-draft-v4'];
const MAX_DRAFTS = 5;

const DRAFT_TYPE_LABELS = {
  general: 'خطاب عام',
  general_financial: 'خطاب مالي',
  custody: 'طلب عهدة',
  close_custody: 'إقفال عهدة',
};

function normalizeDraftAccountCode(accountCode){
  const normalized = String(accountCode ?? window.authSession?.account_code ?? '')
    .trim()
    .replace(/\s+/g, '');
  return normalized || 'anonymous';
}

function getDraftsStorageKey(accountCode){
  return `${DRAFTS_KEY_PREFIX}:${normalizeDraftAccountCode(accountCode)}`;
}

function getLegacyDraftStorageKeys(accountCode){
  const normalized = normalizeDraftAccountCode(accountCode);
  const legacy = [];
  [LEGACY_DRAFT_KEY_V5, ...LEGACY_DRAFT_KEYS].forEach((base) => {
    legacy.push(base);
    legacy.push(`${base}:${normalized}`);
  });
  return Array.from(new Set(legacy));
}

function getDraftsArray(accountCode){
  const key = getDraftsStorageKey(accountCode);
  const raw = localStorage.getItem(key);
  if (raw) {
    try { return JSON.parse(raw); } catch(_) { return []; }
  }

  // Migration: try v5 then v4 legacy keys
  const legacyKeys = getLegacyDraftStorageKeys(accountCode);
  for (const lk of legacyKeys) {
    const legacy = localStorage.getItem(lk);
    if (!legacy) continue;
    try {
      const state = JSON.parse(legacy);
      const now = Date.now();
      const migrated = [{
        id: 'd_' + now,
        name: 'مسودة سابقة',
        createdAt: now,
        updatedAt: now,
        state: state
      }];
      setDraftsArray(accountCode, migrated);
      // Remove old keys
      legacyKeys.forEach(k => localStorage.removeItem(k));
      return migrated;
    } catch(_) {
      localStorage.removeItem(lk);
    }
  }
  return [];
}

function setDraftsArray(accountCode, arr){
  const key = getDraftsStorageKey(accountCode);
  try {
    localStorage.setItem(key, JSON.stringify(arr));
    return true;
  } catch(e) {
    console.warn('Failed to save drafts:', e);
    return false;
  }
}

function generateDraftName(type){
  const label = DRAFT_TYPE_LABELS[type] || 'خطاب عام';
  const now = new Date();
  const day = now.getDate();
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const month = months[now.getMonth()];
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${label} - ${day} ${month} ${h}:${m}${ampm}`;
}

function formatRelativeTime(ts){
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

function createDraft(){
  const code = normalizeDraftAccountCode();
  const drafts = getDraftsArray(code);
  if (drafts.length >= MAX_DRAFTS) {
    openDraftsModal();
    return;
  }
  const state = collectState();
  const safe = { ...state, signatureDataUrl: null, attachmentFiles: [] };
  const now = Date.now();
  drafts.push({
    id: 'd_' + now,
    name: generateDraftName(state.type),
    createdAt: now,
    updatedAt: now,
    state: safe
  });
  if (setDraftsArray(code, drafts)) {
    showToast('تم حفظ المسودة.', 'success');
  } else {
    showToast('تعذر حفظ المسودة بسبب امتلاء سعة التخزين في المتصفح.', 'error');
  }
}

function loadDraftById(id){
  const code = normalizeDraftAccountCode();
  const drafts = getDraftsArray(code);
  const draft = drafts.find(d => d.id === id);
  if (!draft) {
    showToast('لم يتم العثور على المسودة.', 'error');
    return;
  }
  const hasData = String(el('subject')?.value || '').trim() || String(el('details')?.value || '').trim();
  if (hasData && !confirm('سيتم استبدال البيانات الحالية بالمسودة المحفوظة. هل تريد المتابعة؟')) {
    return;
  }
  restoreDraftState(draft.state);
  closeDraftsModal();
  showToast('تم استرجاع المسودة (يرجى إعادة التوقيع ورفع المرفقات).', 'success');
}

function overwriteDraft(id){
  if (!confirm('سيتم استبدال محتوى المسودة ببيانات النموذج الحالي. هل تريد المتابعة؟')) return;
  const code = normalizeDraftAccountCode();
  const drafts = getDraftsArray(code);
  const idx = drafts.findIndex(d => d.id === id);
  if (idx === -1) return;
  const state = collectState();
  const safe = { ...state, signatureDataUrl: null, attachmentFiles: [] };
  drafts[idx].state = safe;
  drafts[idx].updatedAt = Date.now();
  if (setDraftsArray(code, drafts)) {
    showToast('تم تحديث المسودة.', 'success');
    renderDraftsModal();
  }
}

function renameDraft(id, newName){
  const trimmed = String(newName || '').trim();
  if (!trimmed) return;
  const code = normalizeDraftAccountCode();
  const drafts = getDraftsArray(code);
  const draft = drafts.find(d => d.id === id);
  if (!draft) return;
  draft.name = trimmed;
  setDraftsArray(code, drafts);
  renderDraftsModal();
}

function deleteDraft(id){
  if (!confirm('هل تريد حذف هذه المسودة؟')) return;
  const code = normalizeDraftAccountCode();
  const drafts = getDraftsArray(code).filter(d => d.id !== id);
  setDraftsArray(code, drafts);
  showToast('تم حذف المسودة.', 'success');
  renderDraftsModal();
}

function clearAllDraftsForAccount(accountCode){
  const keys = new Set([
    getDraftsStorageKey(accountCode),
    ...getLegacyDraftStorageKeys(accountCode),
  ]);
  keys.forEach((key) => localStorage.removeItem(key));
}

function restoreDraftState(state){
  if (!state) return;
  el('letterType').value = state.type || 'general';
  clearAttachments();

  if (state.projectName) {
    var projSel = el('projectName');
    if (projSel) {
      var found = false;
      Array.from(projSel.options).forEach(function(opt) {
        if (opt.dataset.projectName === state.projectName) {
          projSel.value = opt.value;
          found = true;
        }
      });
      if (found) updateFromProject();
    }
  }

  if (!window.authSession) {
    el('applicantName').value = state.applicantName || '';
    el('jobTitle').value = state.jobTitle || '';
  }
  el('subject').value = state.subject || '';
  el('details').value = state.details || '';

  el('custodyAmount').value = state.custodyAmount ?? '';
  el('financialAmount').value = state.financialAmount ?? '';
  el('usedAmount').value = state.usedAmount ?? '';
  el('remainingAmount').value = state.remainingAmount ?? '';
  el('attachments').value = '';
  el('attachmentsGeneral').value = '';
  if (el('financialIncludeCostCenter')) {
    el('financialIncludeCostCenter').checked = !!state.financialIncludeCostCenter;
  }

  if (state.dateISO) el('date').value = state.dateISO;
  if (window.dualDatePicker){
    const iso = el('date').value || toLocalISODate(new Date());
    window.dualDatePicker.selectedDate = parseISOToLocalDate(iso) || new Date();
    window.dualDatePicker.updateDisplay();
  }

  signatureDataUrl = null;
  refresh();
}

/* -------------------------------------------------------
   Drafts Modal UI
-------------------------------------------------------- */
function openDraftsModal(){
  const modal = el('draftsModal');
  if (!modal) return;
  renderDraftsModal();
  modal.classList.add('is-active');
  document.addEventListener('keydown', draftsModalEscHandler);
}

function closeDraftsModal(){
  const modal = el('draftsModal');
  if (!modal) return;
  modal.classList.remove('is-active');
  document.removeEventListener('keydown', draftsModalEscHandler);
}

function draftsModalEscHandler(e){
  if (e.key === 'Escape') closeDraftsModal();
}

function renderDraftsModal(){
  const code = normalizeDraftAccountCode();
  const drafts = getDraftsArray(code);
  const list = el('draftsList');
  const countEl = el('draftsCount');
  const subtitle = el('draftsSubtitle');
  const newBtn = el('draftsNewBtn');
  if (!list) return;

  countEl.textContent = `(${drafts.length}/${MAX_DRAFTS})`;

  if (drafts.length === 0) {
    subtitle.textContent = 'لا توجد مسودات محفوظة';
    subtitle.style.display = 'block';
    list.innerHTML = '';
    newBtn.style.display = '';
    newBtn.disabled = false;
    return;
  }

  if (drafts.length >= MAX_DRAFTS) {
    subtitle.textContent = 'بلغ الحد الأقصى (' + MAX_DRAFTS + '/' + MAX_DRAFTS + ')';
    subtitle.style.display = 'block';
    newBtn.style.display = 'none';
  } else {
    subtitle.textContent = '';
    subtitle.style.display = 'none';
    newBtn.style.display = '';
    newBtn.disabled = false;
  }

  list.innerHTML = '';
  // Show newest first
  const sorted = drafts.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  sorted.forEach(draft => {
    const item = document.createElement('div');
    item.className = 'draft-item';
    item.dataset.id = draft.id;

    const info = document.createElement('div');
    info.className = 'draft-item__info';

    const nameEl = document.createElement('div');
    nameEl.className = 'draft-item__name';
    nameEl.textContent = draft.name;
    nameEl.title = 'انقر لإعادة التسمية';
    nameEl.addEventListener('click', () => {
      // Inline rename
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'draft-item__rename-input';
      input.value = draft.name;
      input.maxLength = 60;
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const finish = () => {
        renameDraft(draft.id, input.value || draft.name);
      };
      input.addEventListener('blur', finish, { once: true });
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
        if (ke.key === 'Escape') { input.value = draft.name; input.blur(); }
      });
    });

    const meta = document.createElement('div');
    meta.className = 'draft-item__meta';
    const typeLabel = DRAFT_TYPE_LABELS[draft.state?.type] || '';
    meta.textContent = typeLabel + (typeLabel ? ' · ' : '') + formatRelativeTime(draft.updatedAt);

    info.appendChild(nameEl);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'draft-item__actions';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'btn btn--ghost draft-item__btn';
    loadBtn.textContent = 'استرجاع';
    loadBtn.addEventListener('click', () => loadDraftById(draft.id));

    const updateBtn = document.createElement('button');
    updateBtn.type = 'button';
    updateBtn.className = 'btn btn--ghost draft-item__btn';
    updateBtn.textContent = 'تحديث';
    updateBtn.addEventListener('click', () => overwriteDraft(draft.id));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--ghost draft-item__btn draft-item__btn--delete';
    delBtn.textContent = 'حذف';
    delBtn.addEventListener('click', () => deleteDraft(draft.id));

    actions.appendChild(loadBtn);
    actions.appendChild(updateBtn);
    actions.appendChild(delBtn);

    item.appendChild(info);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

/* -------------------------------------------------------
   Toast Notification System
-------------------------------------------------------- */
function showToast(message, variant = 'success'){
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${variant}`;
  toast.textContent = message;
  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('toast--dismiss');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  setTimeout(dismiss, 3000);
}


let manualZoom = 1;
// Initialize global converter for date-picker.js
window.hijriConverter = new HijriConverter();

/* Session-based project data (populated from auth session) */
let SESSION_PROJECTS = []; // Array of { project_id, project_name, program_name, cost_center, portfolio_name }

const el = (id) => document.getElementById(id);

let signatureDataUrl = null;
let projectNameHintDefaultText = null;

const PROJECT_NAME_HINT_FALLBACK_TEXT = 'يُحدد تلقائيًا من المشاريع المسندة إليك';
const PROJECT_NAME_HINT_DISABLED_TEXT = 'القائمة غير مفعلة لعدم وجود مشاريع مسندة إلى حسابك.';
const SELECT_FIELD_IDS = ['letterType', 'projectName', 'signatureMode', 'jobTitle'];

function getProjectNameHintDefaultText(){
  if (projectNameHintDefaultText != null) return projectNameHintDefaultText;
  const hint = el('projectNameHint');
  const initial = String(hint?.dataset.defaultHint || hint?.textContent || '').trim();
  projectNameHintDefaultText = initial || PROJECT_NAME_HINT_FALLBACK_TEXT;
  if (hint) hint.dataset.defaultHint = projectNameHintDefaultText;
  return projectNameHintDefaultText;
}

function syncSelectFieldStateById(controlId){
  const node = el(controlId);
  if (!node) return;

  const field = node.closest('.field');
  const isSelect = node.tagName === 'SELECT';
  const isDisabledSelect = isSelect && !!node.disabled;
  if (field) {
    field.classList.toggle('field--select', isSelect);
    field.classList.toggle('field--input', !isSelect);
    field.classList.toggle('is-disabled', isDisabledSelect);
  }

  if (controlId === 'projectName') {
    const hint = el('projectNameHint');
    if (!hint) return;
    getProjectNameHintDefaultText();
    hint.textContent = isDisabledSelect
      ? PROJECT_NAME_HINT_DISABLED_TEXT
      : getProjectNameHintDefaultText();
  }
}

function syncSelectFieldStates(){
  SELECT_FIELD_IDS.forEach(syncSelectFieldStateById);
}

// Attachment files storage (File objects, not persisted to localStorage)
let attachmentFiles = [];

// Allowed attachment file types
const ALLOWED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ATTACHMENT_FILES = 20;
const MAX_ATTACHMENT_TOTAL_PAGES = 80;
const MAX_ATTACHMENT_TOTAL_SIZE = 100 * 1024 * 1024; // 100 MB

function normalizeAttachmentType(file){
  const mime = String(file?.type || '').trim().toLowerCase();
  const name = String(file?.name || '').trim().toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';

  if (mime === 'application/pdf' || mime === 'application/x-pdf' || ext === 'pdf') {
    return 'application/pdf';
  }
  if (mime === 'image/png' || ext === 'png') {
    return 'image/png';
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg' || ext === 'jpg' || ext === 'jpeg') {
    return 'image/jpeg';
  }
  if (mime === 'image/webp' || ext === 'webp') {
    return 'image/webp';
  }

  return '';
}

const WATCH_IDS = [
  'letterType','projectName',
  'applicantName','jobTitle','subject','details',
  'custodyAmount','financialAmount','usedAmount','remainingAmount','attachments','attachmentsGeneral',
  'financialIncludeCostCenter',
  'agreeTerms',
];

function bindRefreshNode(node){
  if (!node || node.dataset.refreshBound === '1') return;
  node.addEventListener('input', refresh);
  node.addEventListener('change', refresh);
  node.dataset.refreshBound = '1';
}

function bindRefreshByIds(ids){
  ids.forEach((id) => bindRefreshNode(el(id)));
}


function init(){
  bindDatePicker();
  bindUI();
  bindMobileTabs();
  initAttachmentsUI();

  // Apply authenticated session (name + job title as read-only, load projects)
  var session = window.authSession;
  if (session && window.authApplySession) {
    window.authApplySession(session);
    loadSessionProjects(session);
  }

  buildProjectDropdown();
  setDefaults();
  syncSelectFieldStates();

  refresh();
}

function normalizeProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  var projectId = String(
    entry.project_id ??
    entry.projectId ??
    entry.id ??
    entry.project?.project_id ??
    entry.project?.id ??
    ''
  ).trim();
  var projectName = String(
    entry.project_name ??
    entry.projectName ??
    entry.project?.project_name ??
    entry.project?.name ??
    ''
  ).trim();
  var programName = String(
    entry.program_name ??
    entry.programName ??
    entry.program?.program_name ??
    entry.program?.name ??
    ''
  ).trim();
  var costCenter = String(
    entry.cost_center ??
    entry.costCenter ??
    entry.project?.cost_center ??
    entry.project?.costCenter ??
    ''
  ).trim();
  var portfolioName = String(
    entry.portfolio_name ??
    entry.portfolioName ??
    entry.portfolio?.portfolio_name ??
    entry.portfolio?.name ??
    ''
  ).trim();

  if (!projectId && !projectName && !programName && !costCenter && !portfolioName) {
    return null;
  }

  return {
    project_id: projectId || `${projectName || 'project'}|${costCenter || 'cc'}`,
    project_name: projectName,
    program_name: programName,
    cost_center: costCenter,
    portfolio_name: portfolioName
  };
}

function normalizeSessionProjects(raw) {
  if (!raw) return [];

  if (typeof raw === 'string') {
    try {
      return normalizeSessionProjects(JSON.parse(raw));
    } catch (_) {
      return [];
    }
  }

  if (Array.isArray(raw)) {
    var seen = new Set();
    var out = [];
    raw.forEach(function(item) {
      var normalized = normalizeProjectEntry(item);
      if (!normalized) return;
      var key = [normalized.project_id, normalized.cost_center, normalized.project_name].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      out.push(normalized);
    });
    return out;
  }

  if (typeof raw === 'object') {
    var nested = raw.projects ?? raw.employee_projects ?? raw.assigned_projects ?? raw.user_projects;
    if (nested != null && nested !== raw) {
      return normalizeSessionProjects(nested);
    }
    var single = normalizeProjectEntry(raw);
    if (single) return [single];
  }

  return [];
}

function loadSessionProjects(session) {
  SESSION_PROJECTS = normalizeSessionProjects(session && session.projects);
}

function typeNeedsProjects(type){
  return type === 'custody' || type === 'close_custody';
}

function isGeneralFinancialType(type){
  return type === 'general_financial';
}

function isAgreementRequiredType(type){
  return type === 'custody' || type === 'close_custody' || isGeneralFinancialType(type);
}

function isAutoFinancialSubject(subject){
  var s = String(subject || '').trim();
  return s.startsWith('طلب عهدة') || s.startsWith('طلب إغلاق') || s.startsWith('طلب مالي عام');
}

function getAllowedLetterType(){
  var selected = el('letterType')?.value || 'general';
  if (!SESSION_PROJECTS.length && typeNeedsProjects(selected)) {
    return 'general';
  }
  return selected;
}

var _projectDropdownBound = false;

function buildProjectDropdown(){
  var sel = el('projectName');
  if (!sel) return;

  sel.innerHTML = '';

  if (!SESSION_PROJECTS.length) {
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'لا توجد مشاريع';
    sel.appendChild(opt);
    sel.disabled = true;
    el('costCenter').value = '';
    el('programNameDisplay').value = '';
    syncSelectFieldStateById('projectName');
    return;
  }

  sel.disabled = false;
  SESSION_PROJECTS.forEach(function(p) {
    var opt = document.createElement('option');
    opt.value = String(p.project_id);
    opt.textContent = p.project_name + ' — ' + p.program_name;
    opt.dataset.costCenter = p.cost_center;
    opt.dataset.programName = p.program_name;
    opt.dataset.projectName = p.project_name;
    opt.dataset.portfolioName = p.portfolio_name;
    opt.dataset.ppp = p.ppp != null ? String(p.ppp) : '';
    sel.appendChild(opt);
  });

  if (!_projectDropdownBound) {
    sel.addEventListener('change', function() { updateFromProject(); refresh(); });
    _projectDropdownBound = true;
  }
  updateFromProject();
  syncSelectFieldStateById('projectName');
}

function updateFromProject(){
  var sel = el('projectName');
  if (!sel || !sel.value) {
    el('costCenter').value = '';
    el('programNameDisplay').value = '';
    return;
  }
  var opt = sel.selectedOptions[0];
  if (opt) {
    el('costCenter').value = opt.dataset.costCenter || '';
    el('programNameDisplay').value = opt.dataset.programName || '';
  }
}

function bindDatePicker(){
  // Dual date picker uses a hidden ISO input (#date) and a visible display input (#dateDisplay)
  // date-picker.js expects an element (not an id string).
  window.dualDatePicker = new DualCalendarPicker(el('date'));
  el('date').addEventListener('change', refresh);
}

function bindUI(){
  bindRefreshByIds(WATCH_IDS);

  // Auto-convert Arabic/Eastern numerals to Western on amount fields
  function normalizeArabicDigits(e) {
    if (e && e.isComposing) return;
    const node = e.target;
    const converted = node.value
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
      .replace(/\u066C/g, '') // Arabic thousands separator
      .replace(/\u066B/g, '.') // Arabic decimal separator
      .replace(/،/g, ',');     // Arabic comma
    if (converted !== node.value) {
      const pos = node.selectionStart;
      node.value = converted;
      try { node.setSelectionRange(pos, pos); } catch (_) {}
      refresh();
    }
  }
  ['custodyAmount','financialAmount','usedAmount','remainingAmount'].forEach(id => {
    const node = el(id);
    if (!node) return;
    node.addEventListener('input', normalizeArabicDigits);
    node.addEventListener('compositionend', normalizeArabicDigits);
  });

  // Signature mode (update UI immediately, then refresh)
  el('signatureMode').addEventListener('change', () => {
    const mode = el('signatureMode').value;
    // Warn before clearing an existing canvas drawing
    if (mode === 'upload' && window.signatureManager && window.signatureManager.hasDrawing()){
      if (!confirm('سيتم مسح التوقيع الحالي. هل تريد المتابعة؟')){
        el('signatureMode').value = 'canvas';
        return;
      }
    }
    applySignatureModeUI();
    signatureDataUrl = null;
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
    const MAX_SIG_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIG_SIZE){
      showToast('حجم الملف كبير جدًا (الحد الأقصى 5 ميغابايت).', 'error');
      e.target.value = '';
      signatureDataUrl = null;
      refresh();
      return;
    }
    try {
      signatureDataUrl = await readFileAsDataUrl(file);
    } catch (_) {
      showToast('تعذر قراءة ملف التوقيع.', 'error');
      signatureDataUrl = null;
    }
    refresh();
  });

  // Listen to canvas signature changes
  el('signatureCanvas').addEventListener('signatureChanged', (event) => {
    if (el('signatureMode').value === 'canvas'){
      const hasDrawing = !!event?.detail?.hasDrawing;
      if (typeof event?.detail?.dataUrl === 'string') {
        signatureDataUrl = hasDrawing ? event.detail.dataUrl : null;
      } else {
        signatureDataUrl = hasDrawing && window.signatureManager?.hasDrawing()
          ? window.signatureManager.getDataURL()
          : null;
      }
      refresh();
    }
  });

  // Save/Load draft
  el('btn-save').addEventListener('click', handleSaveDraft);
  el('btn-load').addEventListener('click', handleLoadDraft);

  // Mobile/tablet save/load buttons
  const saveMobile = el('btn-save-mobile');
  const loadMobile = el('btn-load-mobile');
  if (saveMobile) saveMobile.addEventListener('click', handleSaveDraft);
  if (loadMobile) loadMobile.addEventListener('click', handleLoadDraft);

  // Drafts modal controls
  const draftsClose = el('draftsModalClose');
  if (draftsClose) draftsClose.addEventListener('click', closeDraftsModal);
  const draftsOverlay = el('draftsModal');
  if (draftsOverlay) draftsOverlay.addEventListener('click', (e) => {
    if (e.target === draftsOverlay) closeDraftsModal();
  });
  const draftsNewBtn = el('draftsNewBtn');
  if (draftsNewBtn) draftsNewBtn.addEventListener('click', () => {
    createDraft();
    renderDraftsModal();
  });

  // Export PDF (both buttons)
  const doExport = () => {
    if (!validateBeforeExport()) return;
    if (window.exportPDF) return window.exportPDF();
    window.print();
  };
  const b1 = el('btn-export');
  if (b1) b1.addEventListener('click', doExport);

  // Preview zoom controls
  const zin = el('btn-zoomin');
  const zout = el('btn-zoomout');
  const zfit = el('btn-zoomfit');
  if (zin) zin.addEventListener('click', () => {
    if (window.mobilePreview && window.mobilePreview.isEnabled()) {
      window.mobilePreview.zoomIn();
    } else {
      manualZoom = Math.min(2, manualZoom * 1.12);
      applyResponsiveScale();
    }
  });
  if (zout) zout.addEventListener('click', () => {
    if (window.mobilePreview && window.mobilePreview.isEnabled()) {
      window.mobilePreview.zoomOut();
    } else {
      manualZoom = Math.max(0.35, manualZoom / 1.12);
      applyResponsiveScale();
    }
  });
  if (zfit) zfit.addEventListener('click', () => {
    if (window.mobilePreview && window.mobilePreview.isEnabled()) {
      window.mobilePreview.fit();
    } else {
      manualZoom = 1;
      applyResponsiveScale();
    }
  });

  // Prevent accidental viewport zoom only inside active interactive surfaces.
  const signatureCanvas = el('signatureCanvas');
  if (signatureCanvas){
    signatureCanvas.addEventListener('gesturestart', (e) => e.preventDefault?.(), { passive:false });
  }
  const viewerViewport = el('viewerViewport');
  if (viewerViewport){
    viewerViewport.addEventListener('gesturestart', (e) => e.preventDefault?.(), { passive:false });
  }
}

function bindMobileTabs(){
  const tabs = Array.from(document.querySelectorAll('.mobileTabs .tab, .bottomTabs .tab'));
  if (!tabs.length) return;

  const setView = (view) => {
    document.body.setAttribute('data-mobile-view', view);
    tabs.forEach(t => {
      const active = t.dataset.view === view;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });

    // When opening preview on mobile, recalc scale after layout settles.
    if (view === 'preview'){
      // Render mobile canvas preview immediately when the user opens the preview tab.
      if (window.mobilePreview && window.mobilePreview.isEnabled()){
        requestAnimationFrame(() => window.mobilePreview.renderNow());
      }
      requestAnimationFrame(() => setTimeout(applyResponsiveScale, 20));
    }
  };

  tabs.forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));

  // Default
  setView(document.body.getAttribute('data-mobile-view') || 'form');

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyResponsiveScale, 100);
  });
}

function setDefaults(){
  const now = new Date();

  // Default letter type: general
  el('letterType').value = 'general';
  if (el('financialIncludeCostCenter')) el('financialIncludeCostCenter').checked = false;

  // Set today's date (local ISO)
  const iso = toLocalISODate(now);
  el('date').value = iso;
  if (window.dualDatePicker){
    window.dualDatePicker.selectedDate = parseISOToLocalDate(iso) || new Date();
    window.dualDatePicker.updateDisplay();
  }

  // Project dropdown defaults to first project (auto-fills cost center)
  updateFromProject();

  // Ensure correct initial UI (cost center + signature mode)
  applyLetterTypeUI();
  applySignatureModeUI();
}

function resetEditorState(){
  var letterType = el('letterType');
  if (letterType) letterType.value = 'general';

  ['subject','details','custodyAmount','financialAmount','usedAmount','remainingAmount','attachments','attachmentsGeneral'].forEach(function(id){
    var node = el(id);
    if (node) node.value = '';
  });
  if (el('financialIncludeCostCenter')) el('financialIncludeCostCenter').checked = false;

  var agreeTerms = el('agreeTerms');
  if (agreeTerms) agreeTerms.checked = false;

  clearAttachments();

  signatureDataUrl = null;
  var signatureFile = el('signatureFile');
  if (signatureFile) signatureFile.value = '';
  var signatureMode = el('signatureMode');
  if (signatureMode) signatureMode.value = 'canvas';
  if (window.signatureManager && typeof window.signatureManager.clear === 'function'){
    window.signatureManager.clear();
  }

  var iso = toLocalISODate(new Date());
  if (el('date')) el('date').value = iso;
  if (window.dualDatePicker){
    window.dualDatePicker.selectedDate = parseISOToLocalDate(iso) || new Date();
    window.dualDatePicker.updateDisplay();
  }

  applySignatureModeUI();
  applyLetterTypeUI();
  refresh();
}

function readFileAsDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/* -------------------------------------------------------
   Attachment Files Handling
-------------------------------------------------------- */

function initAttachmentsUI(){
  // Setup for both close_custody and general sections
  const zones = [
    { dropZone: 'file-drop-zone-close', input: 'file-input-close', previews: 'attachment-previews-close' },
    { dropZone: 'file-drop-zone-general', input: 'file-input-general', previews: 'attachment-previews-general' }
  ];

  zones.forEach(({ dropZone, input }) => {
    const zone = el(dropZone);
    const fileInput = el(input);
    if (!zone || !fileInput) return;

    // Click on zone opens file picker
    zone.addEventListener('click', (e) => {
      if (e.target.closest('.file-drop-zone__btn') || e.target === fileInput) return;
      fileInput.click();
    });

    // Keyboard activation
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        fileInput.click();
      }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      handleAttachmentFiles(e.target.files);
      e.target.value = ''; // Allow re-selecting same file
    });

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('is-dragover');
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('is-dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('is-dragover');
      handleAttachmentFiles(e.dataTransfer.files);
    });
  });
}

let _attachmentProcessing = false;
async function handleAttachmentFiles(fileList){
  if (!fileList || !fileList.length) return;
  if (_attachmentProcessing){
    showToast('يتم معالجة مرفقات أخرى، يرجى الانتظار.', 'error');
    return;
  }
  _attachmentProcessing = true;
  try { await _handleAttachmentFilesInner(fileList); } finally { _attachmentProcessing = false; }
}
async function _handleAttachmentFilesInner(fileList){

  const files = Array.from(fileList);
  let addedCount = 0;
  let skippedCount = 0;
  let skippedByLimits = 0;
  let firstLimitError = '';

  let totalPages = attachmentFiles.reduce((sum, att) => sum + (att.pageCount || 1), 0);
  let totalSizeBytes = attachmentFiles.reduce((sum, att) => sum + (att.size || 0), 0);

  for (const file of files){
    const projectedFileCount = attachmentFiles.length + 1;
    if (projectedFileCount > MAX_ATTACHMENT_FILES){
      skippedByLimits++;
      if (!firstLimitError) {
        firstLimitError = `الحد الأقصى للمرفقات هو ${MAX_ATTACHMENT_FILES} ملف`;
      }
      break;
    }

    // Validate type
    const normalizedType = normalizeAttachmentType(file);
    if (!normalizedType || !ALLOWED_ATTACHMENT_TYPES.includes(normalizedType)){
      skippedCount++;
      continue;
    }

    // Validate size
    if (file.size > MAX_ATTACHMENT_SIZE){
      showToast(`الملف "${file.name}" كبير جدًا (الحد الأقصى 10 ميجا)`, 'error');
      skippedCount++;
      continue;
    }

    const projectedSize = totalSizeBytes + file.size;
    if (projectedSize > MAX_ATTACHMENT_TOTAL_SIZE){
      skippedByLimits++;
      if (!firstLimitError) {
        firstLimitError = `إجمالي حجم المرفقات يتجاوز ${(MAX_ATTACHMENT_TOTAL_SIZE / (1024 * 1024)).toFixed(0)} ميجا`;
      }
      skippedCount++;
      continue;
    }

    // Check for duplicates (by name and size)
    const isDuplicate = attachmentFiles.some(f => f.name === file.name && f.size === file.size);
    if (isDuplicate){
      skippedCount++;
      continue;
    }

    // Get page count for PDFs
    let pageCount = 1;
    if (normalizedType === 'application/pdf'){
      try {
        pageCount = await getPdfPageCount(file);
      } catch (e) {
        console.warn('Failed to get PDF page count:', e);
        // Keep accepting the file even if page parsing fails; export may still work later.
        pageCount = 1;
        const source = window.getPdfJsStatus ? (window.getPdfJsStatus()?.source || '') : '';
        const sourceNote = source ? ` (المصدر: ${source})` : '';
        showToast(`تعذر قراءة صفحات PDF "${file.name}" وسيُعامل كصفحة واحدة${sourceNote}`, 'error');
      }
    }

    // Add file with metadata
    const projectedPages = totalPages + pageCount;
    if (projectedPages > MAX_ATTACHMENT_TOTAL_PAGES){
      skippedByLimits++;
      if (!firstLimitError) {
        firstLimitError = `إجمالي صفحات المرفقات يتجاوز ${MAX_ATTACHMENT_TOTAL_PAGES} صفحة`;
      }
      skippedCount++;
      continue;
    }

    attachmentFiles.push({
      file,
      name: file.name,
      type: normalizedType,
      size: file.size,
      pageCount,
      thumbnail: null // Will be generated
    });

    addedCount++;
    totalPages = projectedPages;
    totalSizeBytes = projectedSize;
  }

  if (skippedCount > 0 && addedCount === 0 && !skippedByLimits){
    showToast('نوع الملف غير مدعوم (PNG, JPG, WebP, PDF فقط)', 'error');
  } else if (addedCount > 0){
    showToast(`تم إضافة ${addedCount} ملف${addedCount > 1 ? 'ات' : ''}`, 'success');
  }
  if (skippedByLimits > 0 && firstLimitError) {
    showToast(firstLimitError, 'error');
  }

  // Generate thumbnails and update UI
  await generateAllThumbnails();
  renderAttachmentPreviews();
  updateAttachmentCount();
  refresh();
}

async function getPdfPageCount(file){
  // Lazy load pdf.js
  if (!window.loadPdfJs){
    throw new Error('PDF loader not available');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = window.openPdfDocument
    ? await window.openPdfDocument(data)
    : await (async () => {
      const pdfjsLib = await window.loadPdfJs();
      const init = window.getPdfDocumentInit
        ? window.getPdfDocumentInit(data)
        : { data, disableWorker: true };
      return pdfjsLib.getDocument(init).promise;
    })();
  const pageCount = pdf.numPages;
  pdf.destroy();
  return pageCount;
}

async function generateAllThumbnails(){
  for (const attachment of attachmentFiles){
    if (attachment.thumbnail) continue; // Already generated

    try {
      attachment.thumbnail = await generateThumbnail(attachment);
    } catch (e) {
      console.warn('Failed to generate thumbnail:', e);
      attachment.thumbnail = null;
    }
  }
}

async function generateThumbnail(attachment){
  const { file, type } = attachment;

  if (type === 'application/pdf'){
    // Generate thumbnail from first page of PDF
    return await generatePdfThumbnail(file);
  } else {
    // Image thumbnail
    return await generateImageThumbnail(file);
  }
}

async function generateImageThumbnail(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // Create thumbnail canvas
      const canvas = document.createElement('canvas');
      const maxSize = 160;
      let w = img.width;
      let h = img.height;

      if (w > h){
        if (w > maxSize){ h = h * maxSize / w; w = maxSize; }
      } else {
        if (h > maxSize){ w = w * maxSize / h; h = maxSize; }
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

async function generatePdfThumbnail(file){
  if (!window.loadPdfJs){
    return null;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = window.openPdfDocument
    ? await window.openPdfDocument(data)
    : await (async () => {
      const pdfjsLib = await window.loadPdfJs();
      const init = window.getPdfDocumentInit
        ? window.getPdfDocumentInit(data)
        : { data, disableWorker: true };
      return pdfjsLib.getDocument(init).promise;
    })();

  if (pdf.numPages < 1){
    pdf.destroy();
    return null;
  }

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 0.5 });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Scale to thumbnail size
  const maxSize = 160;
  let scale = 0.5;
  if (viewport.width > maxSize || viewport.height > maxSize){
    scale = maxSize / Math.max(viewport.width, viewport.height) * 0.5;
  }

  const scaledViewport = page.getViewport({ scale });
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  pdf.destroy();
  return canvas.toDataURL('image/jpeg', 0.7);
}

function renderAttachmentPreviews(){
  // Get current letter type to determine which preview container to use
  const type = el('letterType')?.value || 'general';
  const previewContainerId = type === 'close_custody' ? 'attachment-previews-close' : 'attachment-previews-general';
  const container = el(previewContainerId);

  // Also update the other container (clear it)
  const otherContainerId = type === 'close_custody' ? 'attachment-previews-general' : 'attachment-previews-close';
  const otherContainer = el(otherContainerId);
  if (otherContainer) otherContainer.innerHTML = '';

  if (!container) return;

  container.innerHTML = '';

  attachmentFiles.forEach((attachment, index) => {
    const preview = document.createElement('div');
    preview.className = 'attachment-preview';

    // Thumbnail or PDF icon
    if (attachment.thumbnail){
      const img = document.createElement('img');
      img.className = 'attachment-preview__thumb';
      img.src = attachment.thumbnail;
      img.alt = attachment.name;
      preview.appendChild(img);
    } else if (attachment.type === 'application/pdf'){
      const pdfIcon = document.createElement('div');
      pdfIcon.className = 'attachment-preview__pdf-icon';
      pdfIcon.textContent = 'PDF';
      preview.appendChild(pdfIcon);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'attachment-preview__thumb';
      placeholder.style.background = 'var(--md-sys-color-surface-container)';
      preview.appendChild(placeholder);
    }

    // Page count badge for multi-page PDFs
    if (attachment.type === 'application/pdf' && attachment.pageCount > 1){
      const badge = document.createElement('div');
      badge.className = 'attachment-preview__badge';
      badge.textContent = `${attachment.pageCount} ص`;
      preview.appendChild(badge);
    }

    // File name
    const info = document.createElement('div');
    info.className = 'attachment-preview__info';
    info.textContent = attachment.name;
    info.title = attachment.name;
    preview.appendChild(info);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'attachment-preview__remove';
    removeBtn.type = 'button';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'حذف';
    removeBtn.setAttribute('aria-label', `حذف ${attachment.name}`);
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAttachment(index);
    });
    preview.appendChild(removeBtn);

    container.appendChild(preview);
  });
}

function removeAttachment(index){
  if (index < 0 || index >= attachmentFiles.length) return;

  const removed = attachmentFiles.splice(index, 1)[0];
  showToast(`تم حذف "${removed.name}"`, 'success');

  renderAttachmentPreviews();
  updateAttachmentCount();
  refresh();
}

function updateAttachmentCount(){
  // Calculate total page count (images = 1 page each, PDFs = their page count)
  const totalPages = attachmentFiles.reduce((sum, att) => sum + (att.pageCount || 1), 0);

  // Update the appropriate field based on letter type
  const type = getAllowedLetterType();
  if (type === 'close_custody'){
    el('attachments').value = totalPages;
  } else if (type === 'general' || isGeneralFinancialType(type)){
    el('attachmentsGeneral').value = totalPages;
  }
}

function clearAttachments(){
  attachmentFiles = [];
  renderAttachmentPreviews();
  updateAttachmentCount();
}

function toggleExtraSections(type){
  toggleAnimated(el('extra-custody'), type === 'custody');
  toggleAnimated(el('extra-financial'), isGeneralFinancialType(type));
  toggleAnimated(el('extra-close'), type === 'close_custody');
  toggleAnimated(el('extra-general'), type === 'general' || isGeneralFinancialType(type));
  toggleAnimated(el('section-agreement'), isAgreementRequiredType(type));
}

function toggleAnimated(node, show){
  if (!node) return;
  if (!node.classList.contains('section-animated')){
    node.classList.add('section-animated');
  }
  if (show){
    node.classList.remove('is-hidden');
    node.setAttribute('aria-hidden', 'false');
  } else {
    node.classList.add('is-hidden');
    node.setAttribute('aria-hidden', 'true');
  }
}

function computeCostCenter(){
  var type = getAllowedLetterType();
  var includeCostCenter = !!el('financialIncludeCostCenter')?.checked;

  // For custom/general financial letters, showing project + cost center is optional.
  if ((type === 'general' || isGeneralFinancialType(type)) && !includeCostCenter){
    return { costCenter: '', programNameAr: '', pfName: '', projectName: '', ppp: '' };
  }

  var sel = el('projectName');
  var opt = sel && sel.selectedOptions ? sel.selectedOptions[0] : null;
  var costCenter = (opt && opt.dataset.costCenter) || '';
  var programNameAr = (opt && opt.dataset.programName) || '';
  var pfName = (opt && opt.dataset.portfolioName) || '';
  var projectName = (opt && opt.dataset.projectName) || '';
  var ppp = (opt && opt.dataset.ppp) || '';
  var projectId = sel ? parseInt(sel.value, 10) : NaN;
  projectId = Number.isFinite(projectId) ? projectId : null;
  return { costCenter, programNameAr, pfName, projectName, ppp, projectId };
}

function computeDates(){
  const iso = el('date').value;
  const d = parseISOToLocalDate(iso) || new Date();
  const hijri = window.hijriConverter.toHijri(d);
  // Use spaced separators to match the date textbox display format.
  const dateHijri = window.hijriConverter.formatHijriNumeric(hijri, { useArabicDigits: false });
  const dateGregorian = window.hijriConverter.formatGregorianNumeric(d, { useArabicDigits: false });
  return { dateISO: iso, dateHijri, dateGregorian };
}

function collectState(){
  applyLetterTypeUI();
  const type = getAllowedLetterType();
  toggleExtraSections(type);

  const cc = computeCostCenter();
  const dates = computeDates();

  // Attachments in header (المشفوعات)
  let attachments = 0;
  if (type === 'close_custody'){
    attachments = clampInt(el('attachments').value, 0, 9999) ?? 0;
  }else if (type === 'general' || isGeneralFinancialType(type)){
    attachments = clampInt(el('attachmentsGeneral').value, 0, 9999) ?? 0;
  }
  const attachmentsText = attachments ? formatNumberArabic(attachments) : '';

  // Subject: auto-fill for financial letter types; leave empty for custom general.
  const currentSubject = String(el('subject').value || '').trim();
  const autoSubject = buildSubjectByType(type, cc.costCenter);
  if (type === 'general'){
    // Clear auto-filled financial subjects when switching to custom general.
    if (isAutoFinancialSubject(currentSubject)){
      el('subject').value = '';
    }
  } else {
    // Auto-fill only when empty or when replacing another known auto-subject.
    if (!currentSubject || isAutoFinancialSubject(currentSubject)){
      el('subject').value = autoSubject;
    }
  }
  const subject = String(el('subject').value || '').trim();

  // Details
  const details = String(el('details').value || '').trim();

  // Amounts
  const custodyAmount = parseAmount(el('custodyAmount')?.value);
  const financialAmount = parseAmount(el('financialAmount')?.value);
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
    financialAmount,
    usedAmount,
    remainingAmount,
    attachments,
    financialIncludeCostCenter: !!el('financialIncludeCostCenter')?.checked,

    agreedToTerms: el('agreeTerms')?.checked || false,

    signatureDataUrl: sig,

    attachmentsText,
    attachmentFiles: attachmentFiles.slice(),
    projectName: cc.projectName || '',
    projectId: cc.projectId || null,
    costCenter: cc.costCenter || '',
    programNameAr: cc.programNameAr || '',
    pfName: cc.pfName || '',
    trackingCode: (cc.costCenter && cc.ppp) ? cc.costCenter + '-' + String(dates.dateISO || '').slice(2, 4) + '-' + String(cc.ppp).padStart(3, '0') : '',
    ...dates
  };
}

function refresh(){
  // Make sure UI state stays consistent even if an earlier error prevented handlers.
  applyLetterTypeUI();
  applySignatureModeUI();
  syncSelectFieldStates();

  const state = collectState();

  // Always keep the mobile canvas preview (pinch-zoom) in sync.
  if (window.mobilePreview) window.mobilePreview.schedule(state);

  // On phones, the DOM preview is hidden and we use the canvas viewer instead.
  const isPhone = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  if (isPhone && window.mobilePreview && window.mobilePreview.isEnabled()){
    return;
  }

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
  const fitScale = Math.min(1, available / baseWidth);
  const scale = Math.max(0.35, Math.min(2, fitScale * (manualZoom || 1)));

  document.documentElement.style.setProperty('--page-scale', String(Number(scale.toFixed(4))));
}

function handleSaveDraft(){
  createDraft();
}

function handleLoadDraft(){
  const code = normalizeDraftAccountCode();
  const drafts = getDraftsArray(code);
  if (!drafts.length) {
    showToast('لا توجد مسودات محفوظة.', 'error');
    return;
  }
  openDraftsModal();
}

function applyLetterTypeUI(){
  var type = el('letterType')?.value || 'general';
  const costSection = el('section-costcenter');
  const costToggleWrap = el('financialCostCenterToggleWrap');
  const projectFieldsWrap = el('projectCostFieldsWrap');
  const costToggleCheckbox = el('financialIncludeCostCenter');
  const hasProjects = SESSION_PROJECTS.length > 0;
  const noProjectsHint = el('no-projects-hint');

  // Disable custody/close_custody options if user has no projects
  var letterTypeSel = el('letterType');
  if (letterTypeSel) {
    Array.from(letterTypeSel.options).forEach(function(opt) {
      if (opt.value === 'custody' || opt.value === 'close_custody') {
        opt.disabled = !hasProjects;
      }
    });
  }

  // Defensive guard: if selected type requires projects but none exist, force general.
  if (!hasProjects && typeNeedsProjects(type)) {
    if (letterTypeSel) letterTypeSel.value = 'general';
    type = 'general';
  }

  const showOptionalCostCenterToggle = (type === 'general' || isGeneralFinancialType(type)) && hasProjects;
  if (!showOptionalCostCenterToggle && costToggleCheckbox) {
    costToggleCheckbox.checked = false;
  }

  const showProjectFields = type === 'custody' || type === 'close_custody' || (showOptionalCostCenterToggle && !!costToggleCheckbox?.checked);
  const showCostSection = type === 'custody' || type === 'close_custody' || showOptionalCostCenterToggle;

  if (costSection){
    toggleAnimated(costSection, showCostSection);
  }

  if (costToggleWrap){
    toggleAnimated(costToggleWrap, showOptionalCostCenterToggle);
  }

  if (projectFieldsWrap){
    toggleAnimated(projectFieldsWrap, showProjectFields);
  }

  if (noProjectsHint) {
    noProjectsHint.style.display = (!hasProjects && showCostSection) ? 'block' : 'none';
  }

  // Re-render attachment previews to the correct container when type changes
  renderAttachmentPreviews();
  updateAttachmentCount();
}

function applySignatureModeUI(){
  const mode = el('signatureMode')?.value || 'canvas';
  const uploadField = el('signatureUploadField');
  const canvasWrap = el('signatureCanvasWrap');
  toggleAnimated(uploadField, mode === 'upload');
  toggleAnimated(canvasWrap, mode === 'canvas');
}

function validateBeforeExport(){
  const selectedType = el('letterType')?.value || 'general';
  if (!SESSION_PROJECTS.length && typeNeedsProjects(selectedType)) {
    showToast('خطابات العهدة تتطلب مشروعًا مسندًا إلى حسابك.', 'error');
    if (el('letterType')) el('letterType').value = 'general';
    applyLetterTypeUI();
    return false;
  }

  const type = getAllowedLetterType();
  const missing = [];
  const invalidAmountFields = [];
  const nonPositiveAmountFields = [];
  const negativeAmountFields = [];

  if (!el('date').value) missing.push('التاريخ');
  if (!String(el('jobTitle')?.value || '').trim()) missing.push('المسمى الوظيفي');
  if (!String(el('applicantName')?.value || '').trim()) missing.push('اسم مقدم الطلب');
  if (!String(el('subject')?.value || '').trim()) missing.push('الموضوع');

  if (type === 'custody') {
    const raw = String(el('custodyAmount')?.value || '').trim();
    const parsed = parseAmount(raw);
    if (!raw) missing.push('مبلغ العهدة');
    else if (parsed == null) invalidAmountFields.push('مبلغ العهدة');
    else if (parsed <= 0) nonPositiveAmountFields.push('مبلغ العهدة');
  }
  if (isGeneralFinancialType(type)) {
    const raw = String(el('financialAmount')?.value || '').trim();
    const parsed = parseAmount(raw);
    if (!raw) missing.push('المبلغ المطلوب');
    else if (parsed == null) invalidAmountFields.push('المبلغ المطلوب');
    else if (parsed <= 0) nonPositiveAmountFields.push('المبلغ المطلوب');
  }
  if (type === 'close_custody') {
    const usedRaw = String(el('usedAmount')?.value || '').trim();
    const remainingRaw = String(el('remainingAmount')?.value || '').trim();
    const usedAmount = parseAmount(usedRaw);
    const remainingAmount = parseAmount(remainingRaw);

    if (usedRaw && usedAmount == null) invalidAmountFields.push('المبلغ المستخدم');
    if (remainingRaw && remainingAmount == null) invalidAmountFields.push('المبلغ المتبقي');
    if (usedAmount != null && usedAmount < 0) negativeAmountFields.push('المبلغ المستخدم');
    if (remainingAmount != null && remainingAmount < 0) negativeAmountFields.push('المبلغ المتبقي');

    if (!usedRaw && !remainingRaw) {
      missing.push('المبلغ المستخدم أو المتبقي');
    } else if (usedAmount == null && remainingAmount == null) {
      missing.push('المبلغ المستخدم أو المتبقي');
    }
  }

  // Require agreement checkbox for financial letter types.
  if (isAgreementRequiredType(type) && !el('agreeTerms')?.checked) {
    showToast('يجب الموافقة على الإقرار والتعهد قبل التصدير', 'error');
    return false;
  }

  if (invalidAmountFields.length) {
    showToast('تنسيق مبلغ غير صحيح: ' + invalidAmountFields.join('، '), 'error');
    return false;
  }
  if (negativeAmountFields.length) {
    showToast('يجب أن تكون القيم المالية غير سالبة: ' + negativeAmountFields.join('، '), 'error');
    return false;
  }
  if (nonPositiveAmountFields.length) {
    showToast('يجب أن يكون المبلغ أكبر من صفر: ' + nonPositiveAmountFields.join('، '), 'error');
    return false;
  }

  if (missing.length) {
    showToast('حقول مطلوبة: ' + missing.join('، '), 'error');
    return false;
  }
  return true;
}

// Expose for print.js and auth.js
window.collectState = collectState;
window.showToast = showToast;
window.refresh = refresh;
window.loadSessionProjects = loadSessionProjects;
window.buildProjectDropdown = buildProjectDropdown;
window.resetEditorState = resetEditorState;
window.clearCurrentUserDraft = clearAllDraftsForAccount;
window.syncSelectFieldStates = syncSelectFieldStates;
window.rebindFormListeners = function(ids){
  if (Array.isArray(ids) && ids.length) {
    bindRefreshByIds(ids);
    return;
  }
  bindRefreshByIds(WATCH_IDS);
};

document.addEventListener('DOMContentLoaded', init);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { typeNeedsProjects, isGeneralFinancialType, isAgreementRequiredType, normalizeAttachmentType };
}
