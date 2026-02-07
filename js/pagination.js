
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

let _measureRoot = null;
function getMeasureRoot(){
  if (!_measureRoot || !document.body.contains(_measureRoot)){
    _measureRoot = document.createElement('div');
    _measureRoot.style.position = 'fixed';
    _measureRoot.style.left = '-99999px';
    _measureRoot.style.top = '0';
    _measureRoot.style.width = '210mm';
    _measureRoot.style.height = '297mm';
    _measureRoot.style.pointerEvents = 'none';
    document.body.appendChild(_measureRoot);
  }
  return _measureRoot;
}

function buildPages(state, blocks){
  const pages = [];
  let truncated = false;

  const root = getMeasureRoot();
  root.innerHTML = '';

  let pageIndex = 0;
  let pageShell = createPageShell(state, 1, 1); // total updated later
  root.appendChild(pageShell);
  let contentBox = pageShell.querySelector('.letterContent');

  const commitPage = () => {
    root.removeChild(pageShell);
    pages[pageIndex] = pageShell;
  };

  const startNewPage = () => {
    if (pageIndex + 1 >= PAGE.maxPages){
      truncated = true;
      return false;
    }
    commitPage();
    pageIndex++;
    pageShell = createPageShell(state, pageIndex+1, 1);
    root.appendChild(pageShell);
    contentBox = pageShell.querySelector('.letterContent');
    return true;
  };

  const addTruncationNotice = () => {
    const note = document.createElement('div');
    note.className = 'letterPara sigMetaRow--placeholder';
    note.textContent = 'تم اختصار جزء من المحتوى بسبب تجاوز الحد الأقصى للصفحات.';
    const added = tryAppendBlockWithSplit(contentBox, note);
    if (!added.ok && startNewPage()){
      tryAppendBlockWithSplit(contentBox, note);
    }
  };

  const queue = blocks.slice();

  while (queue.length){
    if (truncated) break;
    const block = queue.shift();

    const res = tryAppendBlockWithSplit(contentBox, block);
    if (res.ok){
      if (res.remainder){
        queue.unshift(res.remainder);
      }
      continue;
    }

    // Doesn't fit: move to next page and try again
    if (!startNewPage()) break;
    const res2 = tryAppendBlockWithSplit(contentBox, block);
    if (res2.ok){
      if (res2.remainder){
        queue.unshift(res2.remainder);
      }
      continue;
    }

    // Still doesn't fit => force split to avoid silent data loss.
    const forced = forceSplitBlock(block);
    if (forced){
      const forcedRes = tryAppendBlockWithSplit(contentBox, forced.first);
      if (forcedRes.ok){
        if (forcedRes.remainder) queue.unshift(forcedRes.remainder);
        if (forced.remainder) queue.unshift(forced.remainder);
        continue;
      }
    }

    truncated = true;
    console.warn('Block too large to fit page and could not be split safely:', block);
  }

  if (truncated){
    addTruncationNotice();
  }

  // finalize
  commitPage();
  root.innerHTML = '';

  // Set total pages and page numbers
  const total = pageIndex + 1;
  for (let i=0;i<total;i++){
    const page = pages[i];
    page.querySelector('.pageNo').textContent = `صفحة ${formatNumberArabic(i+1)} من ${formatNumberArabic(total)}`;
  }

  return pages.slice(0, total);
}

function forceSplitBlock(block){
  const text = String(block?.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length < 80) return null;

  const mid = Math.floor(text.length / 2);
  const leftCut = text.lastIndexOf(' ', mid);
  const rightCut = text.indexOf(' ', mid);
  const cut = leftCut > 40 ? leftCut : rightCut > 40 ? rightCut : -1;
  if (cut < 0) return null;

  const firstText = text.slice(0, cut).trim();
  const remainderText = text.slice(cut).trim();
  if (!firstText || !remainderText) return null;

  const first = document.createElement('div');
  first.className = block.className || 'letterPara';
  first.setAttribute('data-splittable', 'true');
  first.textContent = firstText;

  const remainder = document.createElement('div');
  remainder.className = block.className || 'letterPara';
  remainder.setAttribute('data-splittable', 'true');
  remainder.textContent = `… ${remainderText}`;

  return { first, remainder };
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
  (remainder.querySelector('[data-splittable="true"]') || remainder).textContent = `… ${remainderText}`;

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
  bg.setAttribute('srcset', 'assets/letterhead.png 1x, assets/letterhead-300.jpg 2x');
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
