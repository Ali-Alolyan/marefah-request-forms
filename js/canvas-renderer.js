/*
 * Canvas renderer for the letter preview/export.
 * Renders A4 pages with the company letterhead background + header overlays + letter content.
 *
 * Design goals:
 * - Deterministic output independent of screen size (critical for mobile PDF quality)
 * - Arabic RTL-friendly wrapping
 * - Low memory usage on iOS (use smaller DPI there)
 */

(function(){
  'use strict';

  const MM_PER_IN = 25.4;
  const CSS_DPI = 96;

  const PAGE_MM = { w: 210, h: 297 };
  const MARGINS_MM = { top: 44, right: 5, bottom: 21, left: 11 };

  // Header overlay positions (mm) – from your template.
  // NOTE: Dates are nudged left by ~5 CSS px to avoid touching the decorative dots.
  const OVERLAY_MM = {
    hijri: { top: 21.2, left: 4.5 },
    greg:  { top: 21.4, left: 29.6 },
    att:   { top: 27.5, left: 22.8 },
    pageNo:{ top: 285.9, left: 32.6 },
    shiftX_cssPx: -5,
  };

  const EXECUTIVE_DIRECTOR = 'سعادة المدير التنفيذي/ أ.د. محمد عبدالعزيز العواجي حفظه الله';

  function mmToPx(mm, dpi){
    return mm * dpi / MM_PER_IN;
  }

  function cssPxToMm(px){
    return px * MM_PER_IN / CSS_DPI;
  }

  function ensureNumber(n){
    const x = Number(n);
    return Number.isFinite(x) ? x : null;
  }

  function sanitizeText(s){
    return String(s || '').replace(/\r\n/g,'\n');
  }

  // Unicode isolation for LTR snippets in RTL text (e.g., codes).
  function ltrWrap(s){
    return `\u202A${s}\u202C`; // LRE ... PDF
  }

  function loadImage(src){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.decoding = 'async';
      img.onload = ()=>resolve(img);
      img.onerror = (e)=>reject(e);
      img.src = src;
    });
  }

  function getFontFamily(){
    // Keep in sync with CSS.
    return '"IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  }

  function setFont(ctx, px, weight){
    ctx.font = `${weight || 400} ${px.toFixed(2)}px ${getFontFamily()}`;
  }

  // Word wrapping for RTL Arabic text. Splits by spaces; preserves newlines.
  function wrapText(ctx, text, maxWidth){
    const out = [];
    const paragraphs = sanitizeText(text).split('\n');
    for (let p of paragraphs){
      p = p.trimEnd();
      if (!p){
        out.push('');
        continue;
      }
      const words = p.split(/\s+/g);
      let line = '';
      for (const w of words){
        const test = line ? (line + ' ' + w) : w;
        if (ctx.measureText(test).width <= maxWidth){
          line = test;
        }else{
          if (line) out.push(line);
          // If a single word is too long, hard-break it.
          if (ctx.measureText(w).width > maxWidth){
            let chunk = '';
            for (const ch of w){
              const t2 = chunk + ch;
              if (ctx.measureText(t2).width <= maxWidth){
                chunk = t2;
              }else{
                if (chunk) out.push(chunk);
                chunk = ch;
              }
            }
            line = chunk;
          }else{
            line = w;
          }
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  function buildBlocks(state){
    const type = state.type || 'general';
    const blocks = [];

    blocks.push({ kind: 'title', text: state.subject || '' });
    blocks.push({ kind: 'to', text: EXECUTIVE_DIRECTOR });
    blocks.push({ kind: 'para', text: 'السلام عليكم ورحمة الله وبركاته، وبعد:' });

    if (type === 'custody'){
      let custodyDesc;
      if (state.projectName && state.programNameAr) {
        custodyDesc = `لمشروع ${state.projectName} ضمن برنامج ${state.programNameAr}`;
      } else if (state.programNameAr) {
        custodyDesc = `لبرنامج ${state.programNameAr}`;
      } else {
        custodyDesc = 'للبرنامج المعني';
      }
      blocks.push({ kind: 'para', text: `آمل من سعادتكم التكرم بالموافقة على صرف عهدة مالية ${custodyDesc}.` });
      if (state.details) blocks.push({ kind: 'labeltext', label: 'تفاصيل الطلب:', text: state.details });

      const amt = ensureNumber(state.custodyAmount);
      const amtTxt = amt != null ? `${formatAmountArabic(amt)} ريال سعودي` : '—';
      blocks.push({ kind: 'para', label: 'مبلغ العهدة المطلوب:', text: amtTxt });
      blocks.push({ kind: 'para', text: 'شاكرين لسعادتكم حسن تعاونكم،' });
    }

    if (type === 'close_custody'){
      let closeDesc;
      if (state.projectName && state.programNameAr) {
        closeDesc = `الخاصة بمشروع ${state.projectName} ضمن برنامج ${state.programNameAr}`;
      } else if (state.programNameAr) {
        closeDesc = `الخاصة ببرنامج ${state.programNameAr}`;
      } else {
        closeDesc = 'الخاصة بالبرنامج المعني';
      }
      blocks.push({ kind: 'para', text: `أرفع لسعادتكم طلب إغلاق عهدة مالية ${closeDesc}، وذلك بعد إتمام الصرف وفق التفاصيل أدناه.` });

      const used = ensureNumber(state.usedAmount);
      const remaining = ensureNumber(state.remainingAmount);
      const att = ensureNumber(state.attachments);
      blocks.push({ kind: 'para', label: 'المبلغ المستخدم:', text: used != null ? `${formatAmountArabic(used)} ريال سعودي` : '—' });
      blocks.push({ kind: 'para', label: 'المبلغ المتبقي:', text: remaining != null ? `${formatAmountArabic(remaining)} ريال سعودي` : '—' });
      blocks.push({ kind: 'para', label: 'عدد المشفوعات:', text: att != null ? formatNumberArabic(att) : '—' });
      blocks.push({ kind: 'para', text: 'وسيتم إرفاق المشفوعات الداعمة (الفواتير/المستندات) ضمن إجراءات الإغلاق لدى الإدارة المختصة.' });
      blocks.push({ kind: 'para', text: 'شاكرين لسعادتكم حسن تعاونكم،' });
    }

    if (type === 'general_financial'){
      if (state.details) {
        blocks.push({ kind: 'labeltext', label: 'تفاصيل الخطاب:', text: state.details });
      } else {
        blocks.push({ kind: 'placeholder', text: 'تفاصيل الخطاب' });
      }

      const amount = ensureNumber(state.financialAmount);
      const amountText = amount != null ? `${formatAmountArabic(amount)} ريال سعودي` : '—';
      blocks.push({ kind: 'para', label: 'المبلغ المطلوب:', text: amountText });
      blocks.push({ kind: 'para', text: 'شاكرين لسعادتكم حسن تعاونكم،' });
    }

    if (type === 'general'){
      if (state.details) {
        blocks.push({ kind: 'labeltext', label: 'تفاصيل الخطاب:', text: state.details });
      } else {
        blocks.push({ kind: 'placeholder', text: 'تفاصيل الخطاب' });
      }
      blocks.push({ kind: 'para', text: 'شاكرين لسعادتكم حسن تعاونكم،' });
    }

    const shouldShowCostCenterLine =
      type === 'custody' ||
      type === 'close_custody' ||
      (type === 'general_financial' && !!state.financialIncludeCostCenter && !!(state.costCenter || state.programNameAr || state.projectName));
    if (shouldShowCostCenterLine){
      const cc = state.costCenter ? ltrWrap(state.costCenter) : '—';
      const program = state.programNameAr ? ` | البرنامج: ${state.programNameAr}` : '';
      const project = state.projectName ? ` | المشروع: ${state.projectName}` : '';
      blocks.push({ kind: 'para', label: 'مركز التكلفة:', text: `${cc}${program}${project}`, ltrLabelValue: true });
    }

    blocks.push({ kind: 'signature', applicantName: state.applicantName || '', jobTitle: state.jobTitle || '', signatureDataUrl: state.signatureDataUrl || null });
    return blocks;
  }

  function paginate(blocks, layout){
    const pages = [];
    let pageOps = [];
    let y = layout.contentTop;

    const newPage = ()=>{
      if (pageOps.length) pages.push(pageOps);
      pageOps = [];
      y = layout.contentTop;
    };

    const addTextLine = (text, x, yPos, style)=>{
      pageOps.push({ op:'text', text, x, y: yPos, style });
    };

    const addGapMm = (mm)=>{ y += mmToPx(mm, layout.dpi); };

    const canFit = (h)=> (y + h) <= layout.contentBottom;

    // style presets
    const bodyPx = layout.fontBodyPx;
    const lh = layout.lineHeightPx;
    const labelPx = layout.fontBodyPx;
    const titlePx = layout.fontTitlePx;
    const toPx = layout.fontToPx;
    const mutedPx = layout.fontMutedPx;

    for (const b of blocks){
      if (b.kind === 'title'){
        const h = lh * 1.15;
        if (!canFit(h)) newPage();
        const titleText = sanitizeText(b.text) || 'الموضوع';
        const titleColor = b.text ? '#000' : 'rgba(15,23,42,0.35)';
        pageOps.push({ op:'text', text: titleText, x: layout.pageW/2, y, style: { size: titlePx, weight: 700, align:'center', color: titleColor } });
        y += h;
        addGapMm(8);
        continue;
      }
      if (b.kind === 'to'){
        const h = lh;
        if (!canFit(h)) newPage();
        addTextLine(b.text, layout.contentRight, y, { size: toPx, weight: 700, align:'right' });
        y += h;
        addGapMm(3);
        continue;
      }

      if (b.kind === 'muted'){
        const lines = wrapText(layout.measureCtxMuted, b.text, layout.contentW);
        const needed = lines.length * (lh*0.95);
        if (!canFit(needed)) newPage();
        for (const line of lines){
          addTextLine(line, layout.contentRight, y, { size: mutedPx, weight: 400, align:'right', color: 'rgba(0,0,0,0.55)' });
          y += lh*0.95;
        }
        addGapMm(3);
        continue;
      }

      if (b.kind === 'placeholder'){
        const h = lh;
        if (!canFit(h)) newPage();
        addTextLine(b.text, layout.contentRight, y, { size: bodyPx, weight: 400, align:'right', color: 'rgba(15,23,42,0.35)' });
        y += lh;
        addGapMm(3);
        continue;
      }

      if (b.kind === 'plaintext'){
        // text lines only, no label
        const lines = wrapText(layout.measureCtxBody, b.text, layout.contentW);
        let idx = 0;
        while (idx < lines.length){
          if (!canFit(lh)) newPage();
          addTextLine(lines[idx], layout.contentRight, y, { size: bodyPx, weight: 400, align:'right' });
          y += lh;
          idx++;
        }
        addGapMm(3);
        continue;
      }

      if (b.kind === 'labeltext'){
        // label line
        const labelH = lh;
        if (!canFit(labelH)) newPage();
        addTextLine(b.label, layout.contentRight, y, { size: labelPx, weight: 700, align:'right' });
        y += lh;

        // text lines, may span pages
        const lines = wrapText(layout.measureCtxBody, b.text, layout.contentW);
        let idx = 0;
        while (idx < lines.length){
          if (!canFit(lh)) newPage();
          addTextLine(lines[idx], layout.contentRight, y, { size: bodyPx, weight: 400, align:'right' });
          y += lh;
          idx++;
        }
        addGapMm(3);
        continue;
      }

      if (b.kind === 'para'){
        // either simple paragraph or label:value inline
        const text = (b.label ? `${b.label} ${b.text}` : b.text);
        const ctx = layout.measureCtxBody;
        const lines = wrapText(ctx, text, layout.contentW);
        let idx = 0;
        while (idx < lines.length){
          if (!canFit(lh)) newPage();
          if (b.label && idx === 0){
            // Extract only the value portion visible on this wrapped line
            const firstLine = lines[0];
            const valueOnLine = firstLine.startsWith(b.label)
              ? firstLine.substring(b.label.length).trimStart()
              : firstLine;
            pageOps.push({ op:'labelvalue', label: b.label, value: valueOnLine, x: layout.contentRight, y, style: { size: bodyPx } });
          }else{
            addTextLine(lines[idx], layout.contentRight, y, { size: bodyPx, weight: 400, align:'right' });
          }
          y += lh;
          idx++;
        }
        addGapMm(3);
        continue;
      }

      if (b.kind === 'signature'){
        // Ensure the whole signature block sits together if possible.
        const blockH = mmToPx(44, layout.dpi); // approx: 2 text rows + padding + sig box
        if (!canFit(blockH)) newPage();

        addGapMm(6);
        // Left side, centered text within 60mm-wide block
        const sigBoxW = mmToPx(60, layout.dpi);
        const sigBoxH = mmToPx(28, layout.dpi);
        const sigX = layout.contentLeft;
        const sigCenterX = sigX + sigBoxW / 2;

        // Job title (centered, placeholder if empty)
        const jobText = b.jobTitle || 'المسمى الوظيفي';
        const jobColor = b.jobTitle ? '#000' : 'rgba(15,23,42,0.35)';
        addTextLine(jobText, sigCenterX, y, { size: bodyPx, weight: 400, align:'center', color: jobColor });
        y += lh;

        // Applicant name (centered, placeholder if empty)
        const nameText = b.applicantName || 'اسم مقدم الطلب';
        const nameColor = b.applicantName ? '#000' : 'rgba(15,23,42,0.35)';
        addTextLine(nameText, sigCenterX, y, { size: bodyPx, weight: 400, align:'center', color: nameColor });
        y += lh;

        // Small gap before signature box
        addGapMm(1);

        // Signature box below text rows
        pageOps.push({ op:'sigBox', x: sigX, y: y, w: sigBoxW, h: sigBoxH, dataUrl: b.signatureDataUrl });

        y += sigBoxH;
        addGapMm(2);
        continue;
      }
    }

    if (pageOps.length) pages.push(pageOps);
    return pages;
  }

  async function renderLetterToCanvases(state, opts){
    const dpi = opts && opts.dpi ? opts.dpi : 300;
    const backgroundSrc = (opts && opts.backgroundSrc) || 'assets/letterhead-300.jpg';

    const pageW = Math.round(mmToPx(PAGE_MM.w, dpi));
    const pageH = Math.round(mmToPx(PAGE_MM.h, dpi));

    // Prepare measurement contexts
    const measure = document.createElement('canvas');
    measure.width = 10; measure.height = 10;
    const mctx = measure.getContext('2d');
    const mctxMuted = measure.getContext('2d');
    const mctx2 = measure.getContext('2d'); // separate to avoid accidental state sharing

    // font sizes based on CSS px -> mm -> export dpi
    const bodyMm = cssPxToMm(14);
    const titleMm = cssPxToMm(16);
    const toMm = cssPxToMm(14);
    const mutedMm = cssPxToMm(12);
    const dateMm = cssPxToMm(10.5);

    const fontBodyPx = mmToPx(bodyMm, dpi);
    const fontTitlePx = mmToPx(titleMm, dpi);
    const fontToPx = mmToPx(toMm, dpi);
    const fontMutedPx = mmToPx(mutedMm, dpi);
    const fontDatePx = mmToPx(dateMm, dpi);

    const lineHeightPx = fontBodyPx * 1.9;

    // configure measurement ctx
    mctx.direction = 'rtl';
    mctx.textAlign = 'right';
    mctx.textBaseline = 'top';
    setFont(mctx, fontBodyPx, 400);

    mctx2.direction = 'rtl';
    mctx2.textAlign = 'right';
    mctx2.textBaseline = 'top';
    setFont(mctx2, fontBodyPx, 400);

    mctxMuted.direction = 'rtl';
    mctxMuted.textAlign = 'right';
    mctxMuted.textBaseline = 'top';
    setFont(mctxMuted, fontMutedPx, 400);

    const contentLeft = mmToPx(MARGINS_MM.left, dpi);
    const contentTop = mmToPx(MARGINS_MM.top, dpi);
    const contentRight = pageW - mmToPx(MARGINS_MM.right, dpi);
    const contentBottom = pageH - mmToPx(MARGINS_MM.bottom, dpi);
    const contentW = contentRight - contentLeft;

    const blocks = buildBlocks(state);

    const layout = {
      dpi,
      pageW, pageH,
      contentLeft, contentTop, contentRight, contentBottom,
      contentW,
      fontBodyPx,
      fontTitlePx,
      fontToPx,
      fontMutedPx,
      fontDatePx,
      lineHeightPx,
      measureCtxBody: mctx,
      measureCtxMuted: mctxMuted,
      measureCtx2: mctx2,
    };

    const pagesOps = paginate(blocks, layout);
    const totalPages = pagesOps.length;
    // Load assets once
    let bg = null;
    try{
      bg = await loadImage(backgroundSrc);
    }catch(e){
      // Fallback: some mobile browsers may fail decoding certain JPEG variants.
      bg = await loadImage('assets/letterhead.png');
    }
    const sigImgCache = new Map();
    async function getSigImg(dataUrl){
      if (!dataUrl) return null;
      if (sigImgCache.has(dataUrl)) return sigImgCache.get(dataUrl);
      try{
        const img = await loadImage(dataUrl);
        sigImgCache.set(dataUrl, img);
        return img;
      }catch{
        return null;
      }
    }

    const canvases = [];

    for (let i=0; i<totalPages; i++){
      const c = document.createElement('canvas');
      c.width = pageW;
      c.height = pageH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.direction = 'rtl';
      ctx.textBaseline = 'top';

      // Ensure a non-transparent base; JPEG export turns transparency into black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageW, pageH);

      // Draw background (paint white first so JPEG export never turns transparent into black)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageW, pageH);
      ctx.drawImage(bg, 0, 0, pageW, pageH);

      // Header overlays
      const shiftPx = mmToPx(cssPxToMm(OVERLAY_MM.shiftX_cssPx), dpi);
      const dateX_h = mmToPx(OVERLAY_MM.hijri.left, dpi) + shiftPx;
      const dateY_h = mmToPx(OVERLAY_MM.hijri.top, dpi);
      const dateX_g = mmToPx(OVERLAY_MM.greg.left, dpi) + shiftPx;
      const dateY_g = mmToPx(OVERLAY_MM.greg.top, dpi);
      const attX = mmToPx(OVERLAY_MM.att.left, dpi);
      const attY = mmToPx(OVERLAY_MM.att.top, dpi);

      ctx.fillStyle = '#0b1c2c';
      // Dates are LTR numeric text; x coords are left-edge positions (matching CSS left:).
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      setFont(ctx, layout.fontDatePx, 700);
      ctx.fillText(state.dateHijri || '', dateX_h, dateY_h);
      ctx.fillText(state.dateGregorian || '', dateX_g, dateY_g);
      ctx.direction = 'rtl';

      if (state.attachmentsText){
        ctx.textAlign = 'left';
        setFont(ctx, mmToPx(cssPxToMm(13), dpi), 700);
        ctx.fillText(state.attachmentsText, attX, attY);
      }

      // Page number
      ctx.fillStyle = '#000';
      setFont(ctx, mmToPx(cssPxToMm(12), dpi), 400);
      ctx.textAlign = 'left';
      const pnX = mmToPx(OVERLAY_MM.pageNo.left, dpi);
      const pnY = mmToPx(OVERLAY_MM.pageNo.top, dpi);
      ctx.fillText(`صفحة ${i+1} من ${totalPages}`, pnX, pnY);

      // Content ops
      for (const op of pagesOps[i]){
        if (op.op === 'text'){
          const st = op.style || {};
          ctx.fillStyle = st.color || '#000';
          ctx.textAlign = st.align || 'right';
          setFont(ctx, st.size || layout.fontBodyPx, st.weight || 400);
          ctx.fillText(op.text || '', op.x, op.y);
        }else if (op.op === 'labelvalue'){
          // Draw label (bold) + value (regular) on the same line.
          const size = op.style && op.style.size ? op.style.size : layout.fontBodyPx;
          ctx.fillStyle = '#000';
          ctx.textBaseline = 'top';
          ctx.direction = 'rtl';
          // Label
          ctx.textAlign = 'right';
          setFont(ctx, size, 700);
          ctx.fillText(op.label, op.x, op.y);
          const labelW = ctx.measureText(op.label + ' ').width;
          // Value
          ctx.textAlign = 'right';
          setFont(ctx, size, 400);
          ctx.fillText(op.value, op.x - labelW, op.y);
        }else if (op.op === 'sigBox'){
          ctx.save();
          if (op.dataUrl){
            // Signature present: draw image without border
            const sImg = await getSigImg(op.dataUrl);
            if (sImg){
              const pad = mmToPx(2, dpi);
              const bx = op.x + pad;
              const by = op.y + pad;
              const bw = op.w - pad*2;
              const bh = op.h - pad*2;
              const fit = containRect(sImg.width, sImg.height, bw, bh);
              ctx.drawImage(sImg, bx + (bw-fit.w)/2, by + (bh-fit.h)/2, fit.w, fit.h);
            }
          }else{
            // No signature: draw border + placeholder text
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = Math.max(1, dpi/300);
            const r = mmToPx(2, dpi);
            roundRect(ctx, op.x, op.y, op.w, op.h, r);
            ctx.stroke();
            ctx.fillStyle = 'rgba(15,23,42,0.35)';
            setFont(ctx, mmToPx(cssPxToMm(14), dpi), 400);
            ctx.textAlign = 'center';
            ctx.fillText('التوقيع', op.x + op.w/2, op.y + op.h/2 - mmToPx(3, dpi));
          }
          ctx.restore();
        }
      }

      canvases.push(c);
    }

    return canvases;
  }

  function containRect(sw, sh, mw, mh){
    const s = Math.min(mw / sw, mh / sh);
    return { w: sw*s, h: sh*s };
  }

  function roundRect(ctx, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  // Expose for print.js
  window.renderLetterToCanvases = renderLetterToCanvases;

})();
