/* Main app (v3) */

const STORAGE_KEY = 'marefah-letter-draft-v4';

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

// Attachment files storage (File objects, not persisted to localStorage)
let attachmentFiles = [];

// Allowed attachment file types
const ALLOWED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB


function init(){
  buildCostCenters();
  bindCostCenter();
  bindDatePicker();
  bindUI();
  bindMobileTabs();
  initAttachmentsUI();
  setDefaults();

  // Apply authenticated session (name + job title as read-only)
  var session = window.authSession;
  if (session && window.authApplySession) {
    window.authApplySession(session);
  }

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
    'agreeTerms',
    // signatureMode is handled separately (to update UI first then refresh)
  ];

  watchIds.forEach(id => {
    const node = el(id);
    if (!node) return;
    node.addEventListener('input', refresh);
    node.addEventListener('change', refresh);
  });

  // Auto-convert Arabic/Eastern numerals to Western on amount fields
  function normalizeArabicDigits(e) {
    if (e && e.isComposing) return;
    const node = e.target;
    const converted = node.value
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
    if (converted !== node.value) {
      const pos = node.selectionStart;
      node.value = converted;
      try { node.setSelectionRange(pos, pos); } catch (_) {}
      refresh();
    }
  }
  ['custodyAmount','usedAmount','remainingAmount'].forEach(id => {
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
  el('signatureCanvas').addEventListener('signatureChanged', () => {
    if (el('signatureMode').value === 'canvas'){
      signatureDataUrl = window.signatureManager?.hasDrawing() ? window.signatureManager.getDataURL() : null;
      refresh();
    }
  });

  // Save/Load draft
  el('btn-save').addEventListener('click', saveDraft);
  el('btn-load').addEventListener('click', loadDraft);

  // Mobile/tablet save/load buttons
  const saveMobile = el('btn-save-mobile');
  const loadMobile = el('btn-load-mobile');
  if (saveMobile) saveMobile.addEventListener('click', saveDraft);
  if (loadMobile) loadMobile.addEventListener('click', loadDraft);

  // Export PDF (both buttons)
  const doExport = () => {
    if (!validateBeforeExport()) return;
    if (window.exportPDF) return window.exportPDF();
    window.print();
  };
  const b1 = el('btn-export');
  if (b1) b1.addEventListener('click', doExport);
  const b2 = el('btn-export2');
  if (b2) b2.addEventListener('click', doExport);

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

  // Improve mobile keyboard UX: avoid accidental zoom on iOS
  document.addEventListener('gesturestart', (e) => e.preventDefault?.(), { passive:false });
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

async function handleAttachmentFiles(fileList){
  if (!fileList || !fileList.length) return;

  const files = Array.from(fileList);
  let addedCount = 0;
  let skippedCount = 0;

  for (const file of files){
    // Validate type
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)){
      skippedCount++;
      continue;
    }

    // Validate size
    if (file.size > MAX_ATTACHMENT_SIZE){
      showToast(`الملف "${file.name}" كبير جدًا (الحد الأقصى 10 ميجا)`, 'error');
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
    if (file.type === 'application/pdf'){
      try {
        pageCount = await getPdfPageCount(file);
      } catch (e) {
        console.warn('Failed to get PDF page count:', e);
        showToast(`تعذر قراءة ملف PDF "${file.name}"`, 'error');
        skippedCount++;
        continue;
      }
    }

    // Add file with metadata
    attachmentFiles.push({
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      pageCount,
      thumbnail: null // Will be generated
    });

    addedCount++;
  }

  if (skippedCount > 0 && addedCount === 0){
    showToast('نوع الملف غير مدعوم (PNG, JPG, WebP, PDF فقط)', 'error');
  } else if (addedCount > 0){
    showToast(`تم إضافة ${addedCount} ملف${addedCount > 1 ? 'ات' : ''}`, 'success');
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

  const pdfjsLib = await window.loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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

  const pdfjsLib = await window.loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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
  const type = el('letterType')?.value || 'general';
  if (type === 'close_custody'){
    el('attachments').value = totalPages;
  } else if (type === 'general'){
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
  toggleAnimated(el('extra-close'), type === 'close_custody');
  toggleAnimated(el('extra-general'), type === 'general');
  toggleAnimated(el('section-agreement'), type === 'custody' || type === 'close_custody');
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
  // Use spaced separators to match the date textbox display format.
  const dateHijri = window.hijriConverter.formatHijriNumeric(hijri, { useArabicDigits: false });
  const dateGregorian = window.hijriConverter.formatGregorianNumeric(d, { useArabicDigits: false });
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

  // Subject: auto-fill for custody types; leave empty for general (custom)
  const currentSubject = String(el('subject').value || '').trim();
  const autoSubject = buildSubjectByType(type, cc.costCenter);
  if (type === 'general'){
    // Clear auto-filled custody subjects when switching to general
    if (currentSubject.startsWith('طلب عهدة') || currentSubject.startsWith('طلب إغلاق')){
      el('subject').value = '';
    }
  } else {
    // Auto-fill only for custody types, and only if empty or matches another auto pattern
    if (!currentSubject || currentSubject.startsWith('طلب عهدة') || currentSubject.startsWith('طلب إغلاق')){
      el('subject').value = autoSubject;
    }
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

    agreedToTerms: el('agreeTerms')?.checked || false,

    signatureDataUrl: sig,

    attachmentsText,
    attachmentFiles: attachmentFiles.slice(), // Copy of attachment files array
    ...cc,
    ...dates
  };
}

function refresh(){
  // Make sure UI state stays consistent even if an earlier error prevented handlers.
  applyLetterTypeUI();
  applySignatureModeUI();

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

function saveDraft(){
  const state = collectState();

  // Store without signature data for privacy/performance
  const safe = { ...state, signatureDataUrl: null };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  showToast('تم حفظ المسودة.', 'success');
}

function loadDraft(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw){
    showToast('لا توجد مسودة محفوظة.', 'error');
    return;
  }
  let state;
  try { state = JSON.parse(raw); } catch(e){
    // Issue 25: Corrupt draft — offer to clear
    if (confirm('المسودة المحفوظة تالفة. هل تريد حذفها؟')) {
      localStorage.removeItem(STORAGE_KEY);
      showToast('تم حذف المسودة التالفة.', 'success');
    }
    return;
  }

  // Check if form has data — confirm before overwriting
  const hasData = String(el('subject')?.value || '').trim() || String(el('details')?.value || '').trim();
  if (hasData && !confirm('سيتم استبدال البيانات الحالية بالمسودة المحفوظة. هل تريد المتابعة؟')) {
    return;
  }

  el('letterType').value = state.type || 'general';

  // Cost center
  el('costCenter').value = state.costCenter || el('costCenter').value;
  updateProgramName();

  // Skip restoring name/title if user is logged in (auth data takes priority)
  if (!window.authSession) {
    el('applicantName').value = state.applicantName || '';
    el('jobTitle').value = state.jobTitle || '';
  }
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

  showToast('تم استرجاع المسودة (يرجى إعادة التوقيع).', 'success');
  refresh();
}

function applyLetterTypeUI(){
  const type = el('letterType')?.value || 'general';
  const costSection = el('section-costcenter');
  if (costSection){
    toggleAnimated(costSection, type !== 'general');
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
  const type = el('letterType')?.value || 'general';
  const missing = [];

  if (!el('date').value) missing.push('التاريخ');
  if (!String(el('jobTitle')?.value || '').trim()) missing.push('المسمى الوظيفي');
  if (!String(el('applicantName')?.value || '').trim()) missing.push('اسم مقدم الطلب');
  if (!String(el('subject')?.value || '').trim()) missing.push('الموضوع');

  if (type === 'custody') {
    if (!parseAmount(el('custodyAmount')?.value)) missing.push('مبلغ العهدة');
  }
  if (type === 'close_custody') {
    if (!parseAmount(el('usedAmount')?.value) && !parseAmount(el('remainingAmount')?.value)) {
      missing.push('المبلغ المستخدم أو المتبقي');
    }
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

document.addEventListener('DOMContentLoaded', init);
