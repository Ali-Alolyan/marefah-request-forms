/**
 * Letter templates (Arabic)
 * All letters addressed to: سعادة المدير التنفيذي/ أ.د. محمد عبدالعزيز العواجي حفظه الله
 */

const EXECUTIVE_DIRECTOR = 'سعادة المدير التنفيذي/ أ.د. محمد عبدالعزيز العواجي حفظه الله';

function buildSubjectByType(type, costCenter){
  // Keep subject clean (no lengthy codes). Cost center is shown inside the letter body.
  if (type === 'custody') return 'طلب عهدة مالية';
  if (type === 'close_custody') return 'طلب إغلاق عهدة مالية';
  return 'خطاب عام';
}

function renderLetterBlocks(state){
  const blocks = [];

  const title = document.createElement('div');
  title.className = 'letterTitle';
  title.innerHTML = escapeHtml(state.subject || '');
  blocks.push(title);

  const to = document.createElement('div');
  to.className = 'letterTo';
  to.textContent = EXECUTIVE_DIRECTOR;
  blocks.push(to);

  blocks.push(paragraph('السلام عليكم ورحمة الله وبركاته،،، وبعد:'));

  // Cost center is only needed for custody / close custody.
  if (state.type !== 'general') {
    const cc = document.createElement('div');
    cc.className = 'letterPara';
    cc.innerHTML = `
      <span class="letterLabel">مركز التكلفة:</span>
      <span class="inlineCode" dir="ltr">${escapeHtml(state.costCenter || '—')}</span>
      ${state.programNameAr ? `&nbsp;&nbsp;|&nbsp;&nbsp;<span class="letterLabel">البرنامج:</span> ${escapeHtml(state.programNameAr)}` : ''}
    `;
    blocks.push(cc);
  }

  if (state.type === 'custody'){
    const programPart = state.programNameAr ? `لبرنامج <b>${escapeHtml(state.programNameAr)}</b>` : 'للبرنامج المعني';
    blocks.push(paragraph(
      `آمل من سعادتكم التكرم بالموافقة على صرف عهدة مالية ${programPart}.`
    ));

    blocks.push(labelAndText('تفاصيل الطلب:', state.details));

    const amt = state.custodyAmount != null ? `${formatNumberArabic(state.custodyAmount)} ريال سعودي` : '—';
    blocks.push(paragraph(`<span class="letterLabel">مبلغ العهدة المطلوب:</span> ${amt}`));
    blocks.push(paragraph('<span class="muted">على ألا يتجاوز الحد الأعلى المعتمد 5,000 ريال سعودي</span>'));

    blocks.push(paragraph('شاكرين لسعادتكم حسن تعاونكم،،،'));
  }

  if (state.type === 'close_custody'){
    const programPart = state.programNameAr ? `الخاصة ببرنامج <b>${escapeHtml(state.programNameAr)}</b>` : 'الخاصة بالبرنامج المعني';
    blocks.push(paragraph(
      `أرفع لسعادتكم طلب إغلاق عهدة مالية ${programPart}، وذلك بعد إتمام الصرف وفق التفاصيل أدناه.`
    ));

    const used = state.usedAmount != null ? `${formatNumberArabic(state.usedAmount)} ريال سعودي` : '—';
    const remaining = state.remainingAmount != null ? `${formatNumberArabic(state.remainingAmount)} ريال سعودي` : '—';
    const att = state.attachments != null ? formatNumberArabic(state.attachments) : '—';

    blocks.push(paragraph(`<span class="letterLabel">المبلغ المستخدم:</span> ${used}`));
    blocks.push(paragraph(`<span class="letterLabel">المبلغ المتبقي:</span> ${remaining}`));
    blocks.push(paragraph(`<span class="letterLabel">عدد المشفوعات:</span> ${att}`));

    blocks.push(paragraph('وسيتم إرفاق المشفوعات الداعمة (الفواتير/المستندات) ضمن إجراءات الإغلاق لدى الإدارة المختصة.'));
    blocks.push(paragraph('شاكرين لسعادتكم حسن تعاونكم،،،'));
  }

  if (state.type === 'general'){
    blocks.push(labelAndText('تفاصيل الخطاب:', state.details));
    blocks.push(paragraph('شاكرين لسعادتكم حسن تعاونكم،،،'));
  }

  blocks.push(signatureBlock(state));
  return blocks;
}

function paragraph(htmlOrText){
  const p = document.createElement('div');
  p.className = 'letterPara';
  p.innerHTML = htmlOrText;
  return p;
}

function labelAndText(label, text){
  const wrap = document.createElement('div');
  wrap.className = 'letterPara';

  if (!text) return wrap;

  const body = document.createElement('div');
  body.style.whiteSpace = 'pre-wrap';
  body.textContent = text;

  wrap.appendChild(body);
  return wrap;
}

function signatureBlock(state){
  const block = document.createElement('div');
  block.className = 'sigBlock';

  const meta = document.createElement('div');
  meta.className = 'sigMeta';

  if (state.jobTitle) {
    const row1 = document.createElement('div');
    row1.className = 'sigMetaRow';
    row1.textContent = state.jobTitle;
    meta.appendChild(row1);
  }

  if (state.applicantName) {
    const row2 = document.createElement('div');
    row2.className = 'sigMetaRow';
    row2.textContent = state.applicantName;
    meta.appendChild(row2);
  }

  if (state.signatureDataUrl) {
    const sigWrap = document.createElement('div');
    const sigBox = document.createElement('div');
    sigBox.className = 'sigBox';
    const img = document.createElement('img');
    img.className = 'sigImg';
    img.src = state.signatureDataUrl;
    img.alt = 'Signature';
    sigBox.appendChild(img);
    sigWrap.appendChild(sigBox);
    block.appendChild(meta);
    block.appendChild(sigWrap);
  } else {
    block.appendChild(meta);
  }

  return block;
}
