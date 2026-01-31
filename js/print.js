
/**
 * Robust PDF export:
 * - Opens a dedicated print window containing ONLY the A4 pages.
 * - Adds <base> so assets (css/images) resolve correctly even in about:blank.
 * - Ctrl/⌘+P is also supported thanks to @media print rules in app.css
 */

function exportPDF(){
  const printRoot = document.getElementById('printRoot');
  const pagesHtml = printRoot.innerHTML;

  // Mobile print engines (especially iOS/Safari) can add non-removable margins
  // and auto-scale the document based on viewport width. That can:
  // - split a single A4 page into 2 pages (footer spills over)
  // - reduce apparent quality (downsampling/compression)
  // We detect mobile and adapt the print document accordingly.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                   (window.matchMedia && window.matchMedia('(max-width: 820px)').matches);

  // Base path to current folder
  const baseHref = location.href.replace(/[#?].*$/, '').replace(/\/[^\/]*$/, '/') ;

  // Print window is a new document; include fonts explicitly (otherwise spacing/RTL may differ).
  const fontLinks = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  `;

  const cssLinks = [
    'css/app.css'
  ].map(href => `<link rel="stylesheet" href="${href}">`).join('\n');

  const html = `<!doctype html>
<html lang="ar" dir="rtl" data-theme="light" class="${isMobile ? 'is-mobile' : ''}">
<head>
  <meta charset="utf-8"/>
  <!-- Use a fixed layout viewport roughly equal to A4 width at 96dpi (210mm ≈ 794px).
       This avoids mobile browsers re-scaling the page based on device width. -->
  <meta name="viewport" content="width=794, initial-scale=1"/>
  <base href="${baseHref}">
  <title>تصدير PDF</title>
  ${fontLinks}
  ${cssLinks}
  <style>
    /* In print window, show pages directly without padding */
    #printRoot{ padding:0 !important; }
    html, body{ margin:0; padding:0; background:#fff !important; color:#0f172a; }
    body{ -webkit-text-size-adjust: 100%; }
    /* Improve image rendering quality where supported */
    .a4-bg{ image-rendering: -webkit-optimize-contrast; }

    /* Mobile-specific mitigation: iOS/Safari may print with default margins.
       Shrink a little so the footer doesn't spill to a new page. */
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
        // Two RAFs to ensure layout/paint is committed before printing.
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => window.print(), 60)));
      });
    });
  </script>
</body>
</html>`;

  // 1) Preferred path: open a real print window/tab. (Safari can return null when using noopener flags.)
  let w = null;
  try {
    w = window.open('about:blank', '_blank');
  } catch (e) {
    w = null;
  }

  if (w && w.document){
    try { w.opener = null; } catch(e) {}
    w.document.open();
    w.document.write(html);
    w.document.close();
    return;
  }

  // 2) Fallback: print via hidden iframe (works even if popup windows are blocked).
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
        // Give the print dialog time to open before removing.
        setTimeout(() => iframe.remove(), 1500);
      }
    };

    document.body.appendChild(iframe);
  } catch (e) {
    alert('تعذّر فتح نافذة الطباعة. الرجاء السماح بالنوافذ المنبثقة للموقع أو جرّب متصفحًا آخر.');
  }
}
