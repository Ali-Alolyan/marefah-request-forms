
/**
 * Pagination:
 * Splits blocks into A4 pages using measured height of the content box.
 *
 * Strategy:
 * - Treat the letter body as a sequence of blocks.
 * - Append blocks until overflow; then start a new page.
 * - If a block is splittable (details text), split it across pages.
 */

const PAGE = { maxPages: 20 };

function buildPages(state, blocks){
  const pages = [];

  // Measurement root (offscreen)
  const root = document.createElement('div');
  root.style.position = 'fixed';
  root.style.left = '-99999px';
  root.style.top = '0';
  root.style.width = '210mm';
  root.style.height = '297mm';
  root.style.pointerEvents = 'none';
  document.body.appendChild(root);

  let pageIndex = 0;
  let pageShell = createPageShell(state, 1, 1); // total updated later
  root.appendChild(pageShell);
  let contentBox = pageShell.querySelector('.letterContent');

  const commitPage = () => {
    root.removeChild(pageShell);
    pages[pageIndex] = pageShell;
  };

  const startNewPage = () => {
    commitPage();
    pageIndex++;
    pageShell = createPageShell(state, pageIndex+1, 1);
    root.appendChild(pageShell);
    contentBox = pageShell.querySelector('.letterContent');
  };

  const queue = blocks.slice();

  while (queue.length){
    const block = queue.shift();

    const res = tryAppendBlockWithSplit(contentBox, block);
    if (res.ok){
      if (res.remainder){
        queue.unshift(res.remainder);
      }
      continue;
    }

    // Doesn't fit: move to next page and try again
    startNewPage();
    const res2 = tryAppendBlockWithSplit(contentBox, block);
    if (res2.ok){
      if (res2.remainder){
        queue.unshift(res2.remainder);
      }
      continue;
    }

    // Still doesn't fit => drop to avoid infinite loop
    console.warn('Block too large to fit page:', block);
  }

  // finalize
  commitPage();
  document.body.removeChild(root);

  // Set total pages and page numbers
  const total = pageIndex + 1;
  for (let i=0;i<total;i++){
    const page = pages[i];
    page.querySelector('.pageNo').textContent = `صفحة ${formatNumberArabic(i+1)} من ${formatNumberArabic(total)}`;
  }

  return pages.slice(0, total);
}

function tryAppendBlockWithSplit(contentBox, block){
  const clone = block.cloneNode(true);
  contentBox.appendChild(clone);

  if (!isOverflowing(contentBox)){
    return { ok: true, remainder: null };
  }

  // If not splittable, undo and report failure.
  const splittableNode = clone.querySelector('[data-splittable="true"]') || (clone.getAttribute?.('data-splittable') === 'true' ? clone : null);
  if (!splittableNode){
    contentBox.removeChild(clone);
    return { ok: false, remainder: null };
  }

  const fullText = splittableNode.textContent || '';
  contentBox.removeChild(clone);

  if (!fullText.trim()){
    return { ok: false, remainder: null };
  }

  // Binary search for maximum prefix that fits
  let lo = 1;
  let hi = fullText.length;
  let best = 0;

  const temp = block.cloneNode(true);
  const tempSplit = temp.querySelector('[data-splittable="true"]') || temp;

  while (lo <= hi){
    const mid = Math.floor((lo + hi) / 2);
    tempSplit.textContent = fullText.slice(0, mid);
    contentBox.appendChild(temp);
    const overflow = isOverflowing(contentBox);
    contentBox.removeChild(temp);

    if (!overflow){
      best = mid;
      lo = mid + 1;
    }else{
      hi = mid - 1;
    }
  }

  if (best < 30){
    // Nothing meaningful fits — let caller move to next page
    return { ok: false, remainder: null };
  }

  // Snap to whitespace boundary
  const prefix = fullText.slice(0, best);
  const cut = Math.max(prefix.lastIndexOf(' '), prefix.lastIndexOf('\n'));
  const safeBest = cut > 0 ? cut : best;

  const firstPart = fullText.slice(0, safeBest).trimEnd();
  const remainderText = fullText.slice(safeBest).trimStart();

  const first = block.cloneNode(true);
  (first.querySelector('[data-splittable="true"]') || first).textContent = firstPart;
  contentBox.appendChild(first);

  if (!remainderText){
    return { ok: true, remainder: null };
  }

  const remainder = block.cloneNode(true);
  (remainder.querySelector('[data-splittable="true"]') || remainder).textContent = remainderText;

  return { ok: true, remainder };
}

function isOverflowing(el){
  return el.scrollHeight > el.clientHeight + 1;
}

function createPageShell(state, pageNum, total){
  const wrap = document.createElement('div');
  wrap.className = 'pageWrap';

  const page = document.createElement('div');
  page.className = 'a4-page';

  const bg = document.createElement('img');
  bg.className = 'a4-bg';
  // Background: keep a lightweight preview image, but provide a high-res source
  // for printing/PDF engines (especially on iOS).
  bg.src = "assets/letterhead.png";
  bg.setAttribute('srcset', 'assets/letterhead.png 1x, assets/letterhead-300.png 2x');
  bg.decoding = "async";
  bg.loading = "eager";
  bg.alt = '';
  page.appendChild(bg);

  const overlay = document.createElement('div');
  overlay.className = 'headerOverlay';
  overlay.innerHTML = `
    <div class="ov ov-hijri">${escapeHtml(state.dateHijri || '')}</div>
    <div class="ov ov-greg">${escapeHtml(state.dateGregorian || '')}</div>
    <div class="ov ov-att">${escapeHtml(state.attachmentsText || '')}</div>
  `;
  page.appendChild(overlay);

  const content = document.createElement('div');
  content.className = 'letterContent';
  page.appendChild(content);

  const pn = document.createElement('div');
  pn.className = 'pageNo';
  pn.textContent = `صفحة ${formatNumberArabic(pageNum)} من ${formatNumberArabic(total)}`;
  page.appendChild(pn);

  wrap.appendChild(page);
  return wrap;
}
