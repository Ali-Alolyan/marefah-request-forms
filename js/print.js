/**
 * Export PDF
 *
 * Desktop: uses a dedicated print window (native print dialog).
 * iOS (Safari/Chrome): uses canvas->PDF generation to avoid:
 * - Safari injecting URL/time/page headers/footers
 * - forced print margins/auto-scaling that can create extra pages
 *
 * Result: consistent PDF output across Safari/Chrome on iPhone.
 */

const A4_PX = { w: 794, h: 1123 };

// --- On-demand library loader (improves Safari/Chrome parity on iPhone + fixes CDN typos) ---
function loadScriptOnce(src){
  return new Promise((resolve, reject) => {
    // Avoid duplicating the same script
    if (document.querySelector(`script[data-src="${src}"]`)){
      // Give it a tick in case it's still loading
      setTimeout(resolve, 0);
      return;
    }
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureExportLibs(){
  // Already available
  if (window.html2canvas && window.jspdf && window.jspdf.jsPDF) return true;

  const targets = [
    {
      name: 'html2canvas',
      ok: () => !!window.html2canvas,
      urls: [
        // Local (recommended)
        'js/vendor/html2canvas.min.js',
        // jsDelivr
        'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
        // unpkg
        'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
        // cdnjs
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      ],
    },
    {
      name: 'jsPDF',
      ok: () => !!(window.jspdf && window.jspdf.jsPDF),
      urls: [
        // Local (recommended)
        'js/vendor/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      ],
    },
  ];

  for (const t of targets){
    if (t.ok()) continue;
    let loaded = false;
    for (const url of t.urls){
      try {
        await loadScriptOnce(url);
        // Some browsers need a microtask tick for globals to appear
        await new Promise(r => setTimeout(r, 0));
        if (t.ok()) { loaded = true; break; }
      } catch (e){
        // try next url
      }
    }
    if (!loaded) return false;
  }

  return !!(window.html2canvas && window.jspdf && window.jspdf.jsPDF);
}

function isIOS(){
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/i.test(ua);
  // iPadOS can masquerade as Mac; keep it simple for our use-case.
  return iOSDevice;
}

function setExportButtonBusy(isBusy){
  const btn = document.getElementById('btn-export');
  if (!btn) return;
  if (isBusy){
    btn.dataset._label = btn.textContent;
    btn.textContent = 'جارٍ التصدير...';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset._label || 'تصدير PDF';
    btn.disabled = false;
  }
}

async function waitForFonts(){
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch (_) {}
}

async function waitForImages(root){
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    try {
      if (img.decode) return img.decode().catch(() => {});
      if (img.complete) return Promise.resolve();
      return new Promise(res => { img.onload = img.onerror = res; });
    } catch (_) {
      return Promise.resolve();
    }
  }));
}

function buildPrintHtml(pagesHtml, isMobile){
  const baseHref = location.href.replace(/[#?].*$/, '').replace(/\/[^\/]*$/, '/');

  // Fonts are bundled locally (assets/fonts) and registered via @font-face in css/app.css.
  // This keeps export working offline and ensures identical rendering across browsers.
  const fontLinks = ``;

  const cssLinks = ['css/app.css'].map(href => `<link rel="stylesheet" href="${href}">`).join('\n');

  return `<!doctype html>
<html lang="ar" dir="rtl" data-theme="light" class="${isMobile ? 'is-mobile' : ''}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=794, initial-scale=1"/>
  <base href="${baseHref}">
  <title>تصدير PDF</title>
  ${fontLinks}
  ${cssLinks}
  <style>
    #printRoot{ padding:0 !important; }
    html, body{ margin:0; padding:0; background:#fff !important; color:#0f172a; }
    body{ -webkit-text-size-adjust: 100%; }
    .a4-bg{ image-rendering: -webkit-optimize-contrast; }

    /* Mobile mitigation for forced margins */
    @media print{
      html.is-mobile .a4-page{
        transform: scale(0.965) !important;
        transform-origin: top center !important;
        margin: 0 auto !important;
      }
    }
  </style>
</head>
<body>
  <div id="printRoot">${pagesHtml}</div>
  <script>
    window.addEventListener('load', () => {
      const waitFonts = (document.fonts && document.fonts.ready)
        ? document.fonts.ready.catch(() => {})
        : Promise.resolve();

      const waitImgs = Promise.all(Array.from(document.images).map(img => {
        if (img.decode){
          return img.decode().catch(() => {});
        }
        if (img.complete) return Promise.resolve();
        return new Promise(res => { img.onload = img.onerror = res; });
      }));

      Promise.all([waitFonts, waitImgs]).then(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => window.print(), 60)));
      });
    });
  </script>
</body>
</html>`;
}

async function exportViaCanvasPDF(){
  // Ensure libs (try multiple CDNs)
  const libsOk = await ensureExportLibs();
  if (!libsOk){
    alert(
      'تعذّر تحميل مكتبات التصدير.\n' +
      '• تأكد من اتصال الإنترنت\n' +
      '• أو جرّب شبكة أخرى (قد يكون CDN محجوبًا)\n' +
      '• أو عطّل Content Blocker مؤقتًا\n\n' +
      'ملاحظة: فتح تبويب جديد لا يعني أن روابط مكتبات التصدير الخارجية تعمل.'
    );
    return false;
  }

  const printRoot = document.getElementById('printRoot');
  if (!printRoot) return false;

  const pages = Array.from(printRoot.querySelectorAll('.a4-page'));
  if (!pages.length){
    alert('لا توجد صفحات لتصديرها.');
    return false;
  }

  // Force light theme during export to avoid dark-mode side effects
  const htmlEl = document.documentElement;
  const prevTheme = htmlEl.getAttribute('data-theme') || 'light';
  htmlEl.setAttribute('data-theme', 'light');

  // Build an offscreen stage at fixed A4 pixel size (independent of screen width)
  const stage = document.createElement('div');
  stage.id = 'pdfStage';
  stage.style.cssText = `
    position: fixed;
    left: -100000px;
    top: 0;
    width: ${A4_PX.w}px;
    background: #fff;
    padding: 0;
    margin: 0;
    z-index: -1;
  `;

  pages.forEach(p => {
    const c = p.cloneNode(true);
    c.style.transform = 'none';
    c.style.margin = '0';
    c.style.width = `${A4_PX.w}px`;
    c.style.height = `${A4_PX.h}px`;
    c.style.boxShadow = 'none';
    c.style.borderRadius = '0';
    c.style.overflow = 'hidden';
    stage.appendChild(c);
  });

  document.body.appendChild(stage);

  try {
    await waitForFonts();
    await waitForImages(stage);

    // Scale strategy:
    // 1) Try a higher scale for sharper output.
    // 2) If the device/browser runs out of memory (common on iOS), retry once with a safer scale.
    const ua = navigator.userAgent || '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 2));
    const scaleHi = isMobile ? Math.min(2.8, Math.max(2.4, dpr * 1.2)) : 3.0;
    const scaleLo = isMobile ? 2.2 : 2.6;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

    const stagePages = Array.from(stage.querySelectorAll('.a4-page'));

    for (let i = 0; i < stagePages.length; i++){
      const pageEl = stagePages[i];

      // html2canvas renders the element as a bitmap; this avoids iOS print engine quirks.
      let canvas = null;
      try {
        canvas = await window.html2canvas(pageEl, {
          scale: scaleHi,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: false,
          logging: false,
          windowWidth: A4_PX.w,
          windowHeight: A4_PX.h,
        });
      } catch (e){
        // Retry with a safer scale
        canvas = await window.html2canvas(pageEl, {
          scale: scaleLo,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: false,
          logging: false,
          windowWidth: A4_PX.w,
          windowHeight: A4_PX.h,
        });
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      if (i > 0) pdf.addPage('a4', 'p');
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    // Filename
    const name = 'letter.pdf';
    pdf.save(name);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  } finally {
    stage.remove();
    htmlEl.setAttribute('data-theme', prevTheme);
  }
}

function exportViaPrintWindow(){
  const printRoot = document.getElementById('printRoot');
  const pagesHtml = printRoot ? printRoot.innerHTML : '';

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                   (window.matchMedia && window.matchMedia('(max-width: 820px)').matches);

  const html = buildPrintHtml(pagesHtml, isMobile);

  // 1) Preferred path: open a print window/tab.
  let w = null;
  try { w = window.open('about:blank', '_blank'); } catch (e) { w = null; }

  if (w && w.document){
    try { w.opener = null; } catch (e) {}
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }

  // 2) Fallback: hidden iframe
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.srcdoc = html;

    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        setTimeout(() => iframe.remove(), 1500);
      }
    };

    document.body.appendChild(iframe);
  } catch (e) {
    alert('تعذّر فتح نافذة الطباعة. الرجاء السماح بالنوافذ المنبثقة للموقع أو جرّب متصفحًا آخر.');
  }
}

async function exportPDF(){
  setExportButtonBusy(true);
  try {
    // Prefer pixel-perfect export via canvas->PDF to avoid browser print
    // headers/footers (especially on iOS Safari/Chrome).
    const ok = await exportViaCanvasPDF();
    if (!ok){
      // Fallback: native print engine
      exportViaPrintWindow();
    }
  } finally {
    setExportButtonBusy(false);
  }
}
