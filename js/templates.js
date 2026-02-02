/**
 * Letter templates (Arabic)
 * All letters addressed to: سعادة المدير التنفيذي/ أ.د. محمد عبدالعزيز العواجي حفظه الله
 */

const EXECUTIVE_DIRECTOR = 'سعادة المدير التنفيذي/ أ.د. محمد عبدالعزيز العواجي حفظه الله';

function buildSubjectByType(type, costCenter){
  // Keep subject clean (no lengthy codes). Cost center is shown inside the letter body.
  if (type === 'custody') return 'طلب عهدة مالية';
  if (type === 'close_custody') return 'طلب إغلاق عهدة مالية';
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

  blocks.push(paragraph('السلام عليكم ورحمة الله وبركاته، وبعد:'));

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

    const amt = state.custodyAmount != null ? `${formatNumberArabic(state.custodyAmount)} <span class="icon-saudi_riyal"></span>` : '—';
    blocks.push(paragraph(`<span class="letterLabel">مبلغ العهدة المطلوب:</span> ${amt}`));

    blocks.push(paragraph('شاكرين لسعادتكم حسن تعاونكم،'));

    if (state.agreedToTerms) {
      blocks.push(agreementBlock());
    }
  }

  if (state.type === 'close_custody'){
    const programPart = state.programNameAr ? `الخاصة ببرنامج <b>${escapeHtml(state.programNameAr)}</b>` : 'الخاصة بالبرنامج المعني';
    blocks.push(paragraph(
      `أرفع لسعادتكم طلب إغلاق عهدة مالية ${programPart}، وذلك بعد إتمام الصرف وفق التفاصيل أدناه.`
    ));

    const used = state.usedAmount != null ? `${formatNumberArabic(state.usedAmount)} <span class="icon-saudi_riyal"></span>` : '—';
    const remaining = state.remainingAmount != null ? `${formatNumberArabic(state.remainingAmount)} <span class="icon-saudi_riyal"></span>` : '—';
    const att = state.attachments != null ? formatNumberArabic(state.attachments) : '—';

    blocks.push(paragraph(`<span class="letterLabel">المبلغ المستخدم:</span> ${used}`));
    blocks.push(paragraph(`<span class="letterLabel">المبلغ المتبقي:</span> ${remaining}`));
    blocks.push(paragraph(`<span class="letterLabel">عدد المشفوعات:</span> ${att}`));

    blocks.push(paragraph('وسيتم إرفاق المشفوعات الداعمة (الفواتير/المستندات) ضمن إجراءات الإغلاق لدى الإدارة المختصة.'));
    blocks.push(paragraph('شاكرين لسعادتكم حسن تعاونكم،'));

    if (state.agreedToTerms) {
      blocks.push(agreementBlock());
    }
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
    blocks.push(paragraph('شاكرين لسعادتكم حسن تعاونكم،'));
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

function agreementBlock(){
  const wrap = document.createElement('div');
  wrap.className = 'agreementSection';

  const heading = document.createElement('div');
  heading.className = 'letterLabel';
  heading.style.marginBottom = '2mm';
  heading.textContent = 'الضوابط والإجراءات المالية:';
  wrap.appendChild(heading);

  const items = [
    '<b>نظامية الفواتير:</b> يجب أن تكون جميع الفواتير رسمية (إلكترونية).',
    '<b>بيانات الجهة:</b> ضرورة إدراج اسم الجمعية والرقم الضريبي بشكل واضح على الفواتير.',
    '<b>المدة الزمنية:</b> الالتزام بإقفال العهدة خلال مدة لا تتجاوز 60 يوماً من تاريخ استلامها.',
    '<b>نموذج الإقفال:</b> تُفرغ بيانات الفواتير في "نموذج إقفال العهدة" المعتمد، والذي سيتم تزويدكم به من قبل الإدارة المالية.',
    '<b>مطابقة المبلغ:</b> يجب أن يكون إجمالي مبلغ الإقفال مساوياً للمبلغ الذي تم تحويله للعهدة تماماً.',
    '<b>التوثيق الضوئي:</b> يرجى تصوير الفواتير "الحرارية" (الورق الحساس) ضوئياً؛ لضمان عدم تلاشي البيانات مع مرور الوقت.',
  ];

  const ol = document.createElement('ol');
  ol.className = 'agreementList';
  ol.setAttribute('dir', 'rtl');
  items.forEach(html => {
    const li = document.createElement('li');
    li.innerHTML = html;
    ol.appendChild(li);
  });
  wrap.appendChild(ol);

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
