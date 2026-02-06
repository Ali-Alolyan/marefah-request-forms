/*
 * Offline, cross-browser PDF export.
 * - No external libraries
 * - Works on iPhone Safari/Chrome and desktop Safari/Chrome
 * - Renders pages to canvas at a stable DPI, then builds a PDF with embedded JPEG pages.
 * - Supports image and PDF file attachments appended after letter pages.
 */

(function(){
  'use strict';

  const A4_PT = { w: 595.2756, h: 841.8898 }; // 210×297mm @ 72pt/in

  // A4 dimensions in pixels at different DPI levels
  const A4_PX = {
    300: { w: 2480, h: 3508 },  // Close to 2482x3510 used by canvas-renderer
    240: { w: 1984, h: 2806 }   // Close to 1986x2808
  };

  function isIOS(){
    const ua = navigator.userAgent || '';
    const iOS = /iPad|iPhone|iPod/.test(ua);
    // iPadOS 13+ can masquerade as Mac
    const iPadOS = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return iOS || iPadOS;
  }

  function isSmallScreen(){
    return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  }

  function showExportSpinner(show){
    const el = document.getElementById('exportSpinner');
    if (!el) return;
    el.style.display = show ? 'grid' : 'none';
  }

  function toast(msg, variant){
    if (window.showToast){ window.showToast(msg, variant || 'success'); return; }
    // Fallback: lightweight, non-blocking
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:12px;right:12px;bottom:88px;z-index:99999;background:rgba(17,24,39,.92);color:#fff;padding:12px 14px;border-radius:14px;font-size:14px;line-height:1.4;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center;';
    document.body.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .25s'; }, 1800);
    setTimeout(()=>{ t.remove(); }, 2200);
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    // iOS Safari: download may not work reliably; open in a new tab as a fallback.
    if (isIOS()){
      a.target = '_blank';
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 30_000);
  }

  /**
   * Load an image from a File object
   */
  function loadImageFromFile(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }

  /**
   * Process an image attachment: scale to fit A4 page
   */
  async function processImageAttachment(file, targetW, targetH){
    const img = await loadImageFromFile(file);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);

    // Calculate scaling to fit within margins (5% padding on each side)
    const padding = 0.05;
    const availW = targetW * (1 - padding * 2);
    const availH = targetH * (1 - padding * 2);
    const offsetX = targetW * padding;
    const offsetY = targetH * padding;

    const imgAspect = img.width / img.height;
    const availAspect = availW / availH;

    let drawW, drawH, drawX, drawY;

    if (imgAspect > availAspect){
      // Image is wider - fit to width
      drawW = availW;
      drawH = availW / imgAspect;
      drawX = offsetX;
      drawY = offsetY + (availH - drawH) / 2;
    } else {
      // Image is taller - fit to height
      drawH = availH;
      drawW = availH * imgAspect;
      drawX = offsetX + (availW - drawW) / 2;
      drawY = offsetY;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    return canvas;
  }

  /**
   * Process a PDF attachment: render each page to A4 canvas
   */
  async function processPdfAttachment(file, dpi, targetW, targetH){
    if (!window.loadPdfJs){
      throw new Error('PDF loader not available');
    }

    const pdfjsLib = await window.loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const canvases = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++){
      const page = await pdf.getPage(pageNum);

      // Calculate scale to fit A4 with padding
      const padding = 0.05;
      const availW = targetW * (1 - padding * 2);
      const availH = targetH * (1 - padding * 2);

      const viewport = page.getViewport({ scale: 1 });
      const scaleX = availW / viewport.width;
      const scaleY = availH / viewport.height;
      const scale = Math.min(scaleX, scaleY);

      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);

      // Center the PDF page
      const offsetX = (targetW - scaledViewport.width) / 2;
      const offsetY = (targetH - scaledViewport.height) / 2;

      ctx.translate(offsetX, offsetY);

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport
      }).promise;

      canvases.push(canvas);
    }

    pdf.destroy();
    return canvases;
  }

  /**
   * Process all attachment files and return array of canvases
   */
  async function processAttachments(attachmentFiles, dpi){
    if (!attachmentFiles || attachmentFiles.length === 0){
      return [];
    }

    const targetW = A4_PX[dpi]?.w || A4_PX[300].w;
    const targetH = A4_PX[dpi]?.h || A4_PX[300].h;

    const allCanvases = [];

    // Process files sequentially to manage memory on iOS
    for (const attachment of attachmentFiles){
      const { file, type } = attachment;

      try {
        if (type === 'application/pdf'){
          const pdfCanvases = await processPdfAttachment(file, dpi, targetW, targetH);
          allCanvases.push(...pdfCanvases);
        } else {
          // Image file
          const canvas = await processImageAttachment(file, targetW, targetH);
          allCanvases.push(canvas);
        }
      } catch (e) {
        console.warn(`Failed to process attachment "${attachment.name}":`, e);
        // Continue with other attachments
      }
    }

    return allCanvases;
  }

  async function exportPDF(){
    const exportBtn = document.getElementById('btn-export');
    const btnOriginalText = exportBtn ? exportBtn.textContent : '';
    try{
      if (exportBtn){
        exportBtn.disabled = true;
        exportBtn.classList.add('btn--exporting');
        exportBtn.textContent = 'جاري التصدير…';
      }
      showExportSpinner(true);

      // Collect latest state from app.js
      const state = (window.collectState && window.collectState()) || null;
      if (!state){
        showExportSpinner(false);
        toast('تعذر جمع بيانات الخطاب.', 'error');
        return;
      }

      // Ensure fonts are loaded before rasterizing (important on iOS)
      if (document.fonts && document.fonts.ready){
        try{ await document.fonts.ready; }catch(_){}
      }

      // Use the best DPI possible; on iOS we try 300 first then fall back to 240 if memory is tight.
      const attempts = isIOS()
        ? [
            { dpi: 300, bg: 'assets/letterhead-300.jpg' },
            { dpi: 240, bg: 'assets/letterhead-240.jpg' },
          ]
        : [
            { dpi: 300, bg: 'assets/letterhead-300.jpg' },
          ];

      let canvases = null;
      let usedDpi = 300;
      let lastErr = null;
      for (const a of attempts){
        try{
          console.log(`[PDF] trying ${a.dpi} DPI…`);
          canvases = await window.renderLetterToCanvases(state, { dpi: a.dpi, backgroundSrc: a.bg });
          if (canvases && canvases.length){
            console.log(`[PDF] success at ${a.dpi} DPI (${canvases.length} page(s))`);
            usedDpi = a.dpi;
            break;
          }
        }catch(e){
          console.warn(`[PDF] ${a.dpi} DPI failed:`, e);
          lastErr = e;
        }
      }
      if (!canvases || !canvases.length){
        throw lastErr || new Error('no pages');
      }

      // Process attachment files if any
      let attachmentCanvases = [];
      if (state.attachmentFiles && state.attachmentFiles.length > 0){
        console.log(`[PDF] processing ${state.attachmentFiles.length} attachment(s)…`);
        try {
          attachmentCanvases = await processAttachments(state.attachmentFiles, usedDpi);
          console.log(`[PDF] ${attachmentCanvases.length} attachment page(s) rendered`);
        } catch (e) {
          console.warn('[PDF] attachment processing failed:', e);
          toast('تعذر معالجة بعض المرفقات', 'error');
        }
      }

      // Combine letter canvases and attachment canvases
      const allCanvases = [...canvases, ...attachmentCanvases];

      // Convert canvases to JPEG bytes (progressive, good compression)
      const pages = [];
      for (const c of allCanvases){
        const dataUrl = c.toDataURL('image/jpeg', 0.92);
        const bytes = dataURLToBytes(dataUrl);
        pages.push({ jpegBytes: bytes, wPx: c.width, hPx: c.height });
      }

      const pdfBytes = buildPdfFromJpegs(pages);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const filename = `خطاب-${(state.subject || 'document').slice(0,24).replace(/\s+/g,'_')}.pdf`;
      downloadBlob(blob, filename);

      const attachmentNote = attachmentCanvases.length > 0 ? ` (مع ${attachmentCanvases.length} مرفق)` : '';
      toast('تم تجهيز ملف PDF' + attachmentNote);
    }catch(err){
      console.error('[PDF] export failed:', err);
      const detail = err?.message || '';
      const msg = detail.includes('memory') || detail.includes('alloc')
        ? 'تعذر تصدير PDF (ذاكرة غير كافية). جرّب إغلاق تطبيقات أخرى وإعادة المحاولة.'
        : 'تعذر تصدير PDF. جرّب مرة أخرى.';
      toast(msg, 'error');
    }finally{
      showExportSpinner(false);
      if (exportBtn){
        exportBtn.disabled = false;
        exportBtn.classList.remove('btn--exporting');
        exportBtn.textContent = btnOriginalText;
      }
    }
  }

  // --- Utils: data URL -> bytes ---
  function dataURLToBytes(dataUrl){
    const m = /^data:.*?;base64,(.*)$/.exec(dataUrl);
    const b64 = m ? m[1] : '';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // --- Minimal PDF writer (images only) ---
  function buildPdfFromJpegs(pages){
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [0]; // xref index 0 is free
    let pos = 0;

    const pushStr = (s)=>{ const b = enc.encode(s); parts.push(b); pos += b.length; };
    const pushBytes = (b)=>{ parts.push(b); pos += b.length; };
    const beginObj = (id)=>{ offsets[id] = pos; pushStr(`${id} 0 obj\n`); };
    const endObj = ()=> pushStr('endobj\n');

    // Header
    pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    const n = pages.length;
    const firstPageId = 3;
    const objPerPage = 3; // page, content, image
    const lastId = firstPageId + n*objPerPage - 1;

    // 1: Catalog
    beginObj(1);
    pushStr('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObj();

    // 2: Pages
    beginObj(2);
    const kids = [];
    for (let i=0;i<n;i++){
      const pageId = firstPageId + i*objPerPage;
      kids.push(`${pageId} 0 R`);
    }
    pushStr(`<< /Type /Pages /Count ${n} /Kids [ ${kids.join(' ')} ] >>\n`);
    endObj();

    // Per page objects
    for (let i=0;i<n;i++){
      const pageId = firstPageId + i*objPerPage;
      const contentId = pageId + 1;
      const imageId = pageId + 2;

      // Page
      beginObj(pageId);
      pushStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT.w} ${A4_PT.h}] `);
      pushStr(`/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`);
      endObj();

      // Content stream draws the image full page
      const content = `q\n${A4_PT.w} 0 0 ${A4_PT.h} 0 0 cm\n/Im0 Do\nQ\n`;
      const contentBytes = enc.encode(content);
      beginObj(contentId);
      pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
      pushBytes(contentBytes);
      pushStr('endstream\n');
      endObj();

      // Image XObject
      const img = pages[i];
      beginObj(imageId);
      pushStr(`<< /Type /XObject /Subtype /Image /Width ${img.wPx} /Height ${img.hPx} `);
      pushStr('/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ');
      pushStr(`/Length ${img.jpegBytes.length} >>\nstream\n`);
      pushBytes(img.jpegBytes);
      pushStr('\nendstream\n');
      endObj();
    }

    // xref
    const xrefPos = pos;
    pushStr(`xref\n0 ${lastId + 1}\n`);
    pushStr('0000000000 65535 f \n');
    for (let id=1; id<=lastId; id++){
      const off = offsets[id] || 0;
      const line = String(off).padStart(10,'0') + ' 00000 n \n';
      pushStr(line);
    }
    pushStr('trailer\n');
    pushStr(`<< /Size ${lastId + 1} /Root 1 0 R >>\n`);
    pushStr('startxref\n');
    pushStr(String(xrefPos) + '\n');
    pushStr('%%EOF');

    // concat
    const out = new Uint8Array(pos);
    let o = 0;
    for (const p of parts){ out.set(p, o); o += p.length; }
    return out;
  }

  // Expose
  window.exportPDF = exportPDF;

})();
