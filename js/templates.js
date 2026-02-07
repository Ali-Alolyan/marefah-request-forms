/**
 * Letter templates (Arabic)
 * All letters addressed to: سعادة المدير التنفيذي/ أ.د. محمد عبدالعزيز العواجي حفظه الله
 */

const EXECUTIVE_DIRECTOR = 'سعادة المدير التنفيذي/ أ.د. محمد عبدالعزيز العواجي حفظه الله';

function shouldShowCostCenterLine(state){
  if (state.type === 'custody' || state.type === 'close_custody') return true;
  if (state.type === 'general_financial') {
    return !!state.financialIncludeCostCenter && !!(state.costCenter || state.programNameAr || state.projectName);
  }
  return false;
}

function buildCostCenterBlock(state){
  if (!shouldShowCostCenterLine(state)) return null;

  const cc = document.createElement('div');
  cc.className = 'letterPara';
  let ccHtml = `<span class="letterLabel">مركز التكلفة:</span>
    <span class="inlineCode" dir="ltr">${escapeHtml(state.costCenter || '—')}</span>`;
  if (state.programNameAr) {
    ccHtml += `&nbsp;&nbsp;|&nbsp;&nbsp;<span class="letterLabel">البرنامج:</span> ${escapeHtml(state.programNameAr)}`;
  }
  if (state.projectName) {
    ccHtml += `&nbsp;&nbsp;|&nbsp;&nbsp;<span class="letterLabel">المشروع:</span> ${escapeHtml(state.projectName)}`;
  }
  cc.innerHTML = ccHtml;
  return cc;
}

function buildSubjectByType(type, costCenter){
  // Keep subject clean (no lengthy codes). Cost center is shown inside the letter body.
  if (type === 'custody') return 'طلب عهدة مالية';
  if (type === 'close_custody') return 'طلب إغلاق عهدة مالية';
  if (type === 'general_financial') return 'طلب مالي عام';
  return '';
}

function renderLetterBlocks(state){
  const blocks = [];

  const title = document.createElement('div');
  title.className = 'letterTitle';
  if (state.subject) {
    title.textContent = state.subject;
  } else {
    title.textContent = 'الموضوع';
    title.classList.add('sigMetaRow--placeholder');
  }
  blocks.push(title);

  const to = document.createElement('div');
  to.className = 'letterTo';
  to.textContent = EXECUTIVE_DIRECTOR;
  blocks.push(to);

  blocks.push(paragraphHtml('السلام عليكم ورحمة الله وبركاته، وبعد:'));
  const costCenterBlock = buildCostCenterBlock(state);

  if (state.type === 'custody'){
    let custodyDesc;
    if (state.projectName && state.programNameAr) {
      custodyDesc = `لمشروع <b>${escapeHtml(state.projectName)}</b> ضمن برنامج <b>${escapeHtml(state.programNameAr)}</b>`;
    } else if (state.programNameAr) {
      custodyDesc = `لبرنامج <b>${escapeHtml(state.programNameAr)}</b>`;
    } else {
      custodyDesc = 'للبرنامج المعني';
    }
    blocks.push(paragraphHtml(
      `آمل من سعادتكم التكرم بالموافقة على صرف عهدة مالية ${custodyDesc}.`
    ));

    blocks.push(labelAndText('تفاصيل الطلب:', state.details));

    const amt = state.custodyAmount != null ? `${formatAmountArabic(state.custodyAmount)} ريال سعودي` : '—';
    blocks.push(paragraphHtml(`<span class="letterLabel">مبلغ العهدة المطلوب:</span> ${amt}`));

    blocks.push(paragraphHtml('شاكرين لسعادتكم حسن تعاونكم،'));
  }

  if (state.type === 'close_custody'){
    let closeDesc;
    if (state.projectName && state.programNameAr) {
      closeDesc = `الخاصة بمشروع <b>${escapeHtml(state.projectName)}</b> ضمن برنامج <b>${escapeHtml(state.programNameAr)}</b>`;
    } else if (state.programNameAr) {
      closeDesc = `الخاصة ببرنامج <b>${escapeHtml(state.programNameAr)}</b>`;
    } else {
      closeDesc = 'الخاصة بالبرنامج المعني';
    }
    blocks.push(paragraphHtml(
      `أرفع لسعادتكم طلب إغلاق عهدة مالية ${closeDesc}، وذلك بعد إتمام الصرف وفق التفاصيل أدناه.`
    ));

    const used = state.usedAmount != null ? `${formatAmountArabic(state.usedAmount)} ريال سعودي` : '—';
    const remaining = state.remainingAmount != null ? `${formatAmountArabic(state.remainingAmount)} ريال سعودي` : '—';
    const att = state.attachments != null ? formatNumberArabic(state.attachments) : '—';

    blocks.push(paragraphHtml(`<span class="letterLabel">المبلغ المستخدم:</span> ${used}`));
    blocks.push(paragraphHtml(`<span class="letterLabel">المبلغ المتبقي:</span> ${remaining}`));
    blocks.push(paragraphHtml(`<span class="letterLabel">عدد المشفوعات:</span> ${att}`));

    blocks.push(paragraphHtml('وسيتم إرفاق المشفوعات الداعمة (الفواتير/المستندات) ضمن إجراءات الإغلاق لدى الإدارة المختصة.'));
    blocks.push(paragraphHtml('شاكرين لسعادتكم حسن تعاونكم،'));
  }

  if (state.type === 'general_financial'){
    if (state.details) {
      blocks.push(labelAndText('تفاصيل الخطاب:', state.details));
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'letterPara sigMetaRow--placeholder';
      placeholder.textContent = 'تفاصيل الخطاب';
      blocks.push(placeholder);
    }

    const amount = state.financialAmount != null ? `${formatAmountArabic(state.financialAmount)} ريال سعودي` : '—';
    blocks.push(paragraphHtml(`<span class="letterLabel">المبلغ المطلوب:</span> ${amount}`));

    blocks.push(paragraphHtml('شاكرين لسعادتكم حسن تعاونكم،'));
  }

  if (state.type === 'general'){
    if (state.details) {
      blocks.push(labelAndText('تفاصيل الخطاب:', state.details));
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'letterPara sigMetaRow--placeholder';
      placeholder.textContent = 'تفاصيل الخطاب';
      blocks.push(placeholder);
    }
    blocks.push(paragraphHtml('شاكرين لسعادتكم حسن تعاونكم،'));
  }

  if (costCenterBlock) {
    blocks.push(costCenterBlock);
  }

  blocks.push(signatureBlock(state));
  return blocks;
}

function paragraphHtml(htmlOrText){
  const p = document.createElement('div');
  p.className = 'letterPara';
  p.innerHTML = htmlOrText;
  return p;
}

function labelAndText(label, text){
  const wrap = document.createElement('div');
  wrap.className = 'letterPara';

  if (!text) return wrap;

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = 'letterLabel';
    labelEl.textContent = label;
    wrap.appendChild(labelEl);
  }

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

  // Job title row (always shown; placeholder when empty)
  const row1 = document.createElement('div');
  row1.className = 'sigMetaRow' + (state.jobTitle ? '' : ' sigMetaRow--placeholder');
  row1.textContent = state.jobTitle || 'المسمى الوظيفي';
  meta.appendChild(row1);

  // Applicant name row (always shown; placeholder when empty)
  const row2 = document.createElement('div');
  row2.className = 'sigMetaRow' + (state.applicantName ? '' : ' sigMetaRow--placeholder');
  row2.textContent = state.applicantName || 'اسم مقدم الطلب';
  meta.appendChild(row2);

  block.appendChild(meta);

  // Signature box (always shown below meta)
  const sigBox = document.createElement('div');
  sigBox.className = 'sigBox';
  if (state.signatureDataUrl) {
    sigBox.classList.add('sigBox--filled');
    const img = document.createElement('img');
    img.className = 'sigImg';
    img.src = state.signatureDataUrl;
    img.alt = 'Signature';
    sigBox.appendChild(img);
  } else {
    const ph = document.createElement('span');
    ph.className = 'sigMetaRow--placeholder';
    ph.textContent = 'التوقيع';
    sigBox.appendChild(ph);
  }
  block.appendChild(sigBox);

  return block;
}
