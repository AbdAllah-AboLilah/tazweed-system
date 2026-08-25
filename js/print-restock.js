// ============================================================
// ورقة التزويد — الشبكة اللي بتمشي بيها على الرف
// ============================================================
// ⚠️ الملف ده **مش** وحدة معزولة (module). كل ملفات js بتتحمّل في مساحة
// أسماء واحدة مشتركة، فأي اسم هنا شايفه باقي الملفات والعكس. التقسيم
// للتنظيم بس: كل ملف عن حاجة واحدة عشان اللي بيعدّل يلاقي اللي بيدوّر
// عليه من غير ما يقلّب في 8000 سطر.
//
// ⚠️ التظليل لازم يفضل SVG (رسم) مش خلفية CSS — محرك الطباعة بتاع QZ
// مش بيدعم التدرّجات. شوف الشرح عند HATCH_DEFS.


// ============================================================
// ⭐⭐ تظليل "الدرجة خلصت" — لازم يفضل SVG، ولازم يفضل صغير
// ============================================================
// ⚠️⚠️ الجزء ده اتكسر مرتين. اقرا الاتنين قبل ما تلمسه.
//
// --- الشرط الأول: لازم يبقى **رسم** (SVG)، مش خلفية CSS ---
// QZ Tray مش بيستخدم كروم في الطباعة — بيستخدم محرك عرض داخلي بتاع Java
// (WebView)، وده **مش بيدعم repeating-linear-gradient**. وورقة التزويد
// بتتبعت لـQZ كـ`format: 'html'`، يعني بترتسم بالمحرك ده بالظبط.
//
// فأي تظليل مبني على تدرّج CSS بيبان تمام في المعاينة (دي كروم) و**يختفي
// خالص من الورق** — وده بالظبط اللي حصل: الورقة طلعت من غير أي تظليل.
// الخطوط لازم تبقى "رسم" عشان أي محرك يرسمها إجباري.
//
// --- الشرط التاني: لازم يبقى معرَّف **مرة واحدة** ---
// النسخة الأصلية كانت بتولّد 25 عنصر <line> من الصفر **جوه كل خانة على
// حدة** ≈ 2 كيلوبايت للخانة. فئة فيها 80 درجة "خلصت" = 160 كيلو من
// التظليل لوحده — أضعاف حد رسالة QZ (48 كيلو)، والورقة كانت بتتضاع في
// صمت أو تتقسّم من غير داعي.
//
// --- الحل اللي بيحقق الشرطين مع بعض ---
// نمط SVG (<pattern>) متعرّف **مرة واحدة** فوق الورقة، وكل خانة بتشاور
// عليه بمستطيل واحد ≈ 70 بايت بدل 2000. رسم حقيقي، وحجم صغير.
// حد التقسيم التلقائي لورقة التزويد. أقل شوية من حد رسالة QZ الحقيقي
// (QZ_MAX_MESSAGE_BYTES = 48 كيلو) عشان يبقى فيه هامش.
//
// ⚠️ برّه الدالة عن قصد: الفحص بيقيس ورقة فئة حقيقية (245 درجة) ويتأكد
// إنها **تحت الحد ده**، يعني بتطبع ورقة واحدة من غير تقسيم. لو كان رقم
// محبوس جوه الدالة، الفحص كان هيقارن بنسخة تانية من الرقم — ولو اتغيّر
// واحد فيهم من غير التاني مش هنعرف.
const RESTOCK_SAFE_BYTES = 44 * 1024;

const HATCH_ID = 'hx';

// بيتحط مرة واحدة في أول <body>. عرضه وطوله صفر فمش بياخد أي مكان.
const HATCH_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>` +
  `<pattern id="${HATCH_ID}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">` +
  `<rect width="2.2" height="7" fill="#000"></rect>` +
  `</pattern></defs></svg>`;

// وده اللي بيتحط جوه الخانة اللي "خلصت".
// ⚠️ مافيش viewBox عن قصد — من غيره الـ<rect> بـ100% بياخد مقاس الخانة
// نفسها، فمش محتاجين preserveAspectRatio ولا أرقام. أقصر وأضمن.
const HATCH_CELL = `<svg class="hatch"><rect width="100%" height="100%" fill="url(#${HATCH_ID})"/></svg>`;

// groupName: اسم مجموعة ألوان واحدة عشان تتطبع لوحدها، أو '' للورقة كلها.
function buildRestockHTML(cat, grades, groupName, withBase) {
  const now = new Date().toLocaleString('ar-EG');
  // الدرجات الأساسية (أبيض/أسود/أوف وايت) مالهاش أرقام، والورقة شبكة
  // أرقام بتمشي بيها على الرف — فوجودها وسط الأرقام بيلخبط الشبكة.
  // عشان كده بتتعرض في **شبكة أسماء منفصلة تحت أرقام مجموعتها**.
  //
  // ------------------------------------------------------------
  // ⚠️ ليه تحت **كل مجموعة** مش في قسم واحد آخر الورقة؟
  // ------------------------------------------------------------
  // أول نسخة كانت بتلمّهم كلهم في قسم واحد اسمه "الدرجات الأساسية".
  // ده باين معقول لما الأساسية تلات درجات في فئة أرقام — لكن فيه فئات
  // (زي "المكملات") **كلها أساسية**: كل مجموعة فيها أبيض وأسود وأوف وايت
  // بتوعها. الورقة ساعتها كانت بتطلع:
  //
  //   الدرجات الأساسية
  //   أبيض | أبيض | أبيض | أبيض | أسود | أسود | أسود ...
  //
  // ١٥ "أبيض" ورا بعض من غير أي طريقة تعرف كل واحد بتاع مجموعة مين —
  // ورقة مالهاش أي فايدة على الرف.
  // ⚠️ الصفوف مكتوبة **من غير مسافات ولا أسطر جديدة** عن قصد.
  // الورقة بتتبعت لـQZ كنص، والمسافات دي بتتحسب في حجم الرسالة زي أي
  // حرف تاني. الشكل المنسّق كان بيزوّد ~40 بايت على الصف — يعني 10 كيلو
  // في فئة 245 درجة، من فراغات مالهاش أي أثر على الطباعة.
  const rowHTML = (g) =>
    `<div class="row"><span class="num">${escapeHTML(g.number)}</span>` +
    `<span class="blank">${g.status === 'out' ? HATCH_CELL : ''}</span></div>`;

  const baseRowHTML = (g) =>
    `<div class="row"><span class="num base-num">${escapeHTML(g.name || '')}</span>` +
    `<span class="blank">${g.status === 'out' ? HATCH_CELL : ''}</span></div>`;

  // جسم المجموعة الواحدة: شبكة الأرقام، وتحتها شبكة أسماء الأساسية.
  const bodyOfSection = (list) => {
    const nums = list.filter((g) => !g.isBase);
    const base = withBase ? list.filter((g) => g.isBase) : [];
    return (
      (nums.length ? `<div class="grid">${nums.map(rowHTML).join('')}</div>` : '') +
      (base.length ? `<div class="grid base-grid">${base.map(baseRowHTML).join('')}</div>` : '')
    );
  };

  // الأساسية بتدخل التجميع بس لو المفتاح مفتوح — وإلا الورقة زي الأول
  // بالظبط: أرقام وبس.
  const relevant = withBase ? grades : grades.filter((g) => !g.isBase);

  // مجموعة واحدة: الورقة كلها بقت للمجموعة دي، فاسمها بيروح **للعنوان
  // فوق** (كريب سادة لوكس — بيجات) ومفيش داعي لعنوان جوّه.
  // الورقة الكاملة: كل مجموعة تحت عنوانها، زي شكل الشيت الأصلي.
  const rowsHTML = groupName
    ? bodyOfSection(relevant.filter((g) => (g.group || UNGROUPED_LABEL) === groupName))
    : groupedGrades(relevant, cat)
        .map(
          (section) => `
      ${section.name ? `<div class="group-title">${escapeHTML(section.name)}</div>` : ''}
      ${bodyOfSection(section.grades)}`
        )
        .join('');

  const sheetTitle = groupName ? `${cat.name} — ${groupName}` : cat.name;

  return `
    <!doctype html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>ورقة تزويد - ${escapeHTML(sheetTitle)}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; }
        body { font-family: Tahoma, Arial, sans-serif; font-size: 10px; padding: 1mm; margin: 0; width: 66mm; }
        .header { text-align: center; margin-bottom: 8px; }
        .header .tab-name { font-weight: bold; font-size: 16px; }
        .header .item-name { font-size: 14px; font-weight: bold; color: #000; margin-top: 2px; }
        .header .time { font-size: 11px; font-weight: bold; margin-top: 4px; }
        .grid { column-count: 4; column-gap: 1.5mm; }
        /* أسماء بدل أرقام → أعمدة أقل وخط أصغر عشان الاسم يدخل */
        .base-grid { column-count: 2; }
        .base-num { font-size: 11px; }
        .group-title {
          font-weight: bold; font-size: 12px; text-align: center;
          margin: 4px 0 2px; padding: 1px 0;
          border-top: 1.5px solid #000; border-bottom: 1.5px solid #000;
        }
        .row {
          display: flex; align-items: stretch;
          border: 1px solid #000; margin-bottom: -1px;
          break-inside: avoid; min-height: 5mm;
        }
        .row .num {
          font-weight: bold; padding: 1px 2px;
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 1;
        }
        .row .blank {
          flex: 1;
          border-inline-start: 1.5px solid #000;
          position: relative;
          overflow: hidden;
        }
        /* الخطوط بتغطي خانة الكتابة بس — رقم الدرجة بيفضل نضيف وواضح
           تمامًا، عشان تقدر تقراه بسرعة وانت ماشي على الرف.
           ⚠️⚠️ ماتحوّلش دي لـbackground-image ولا تدرّج CSS. محرك الطباعة
           بتاع QZ مش بيدعمهم والتظليل بيختفي من الورق (بيبان في المعاينة
           بس، لأن المعاينة كروم). شوف الشرح الكامل فوق عند HATCH_DEFS. */
        .hatch {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          display: block;
        }
        @media print {
          body { padding: 1mm; }
        }
      </style>
    </head>
    <body>
      ${HATCH_DEFS}
      <div class="header">
        <div class="tab-name">${escapeHTML(sheetTitle)}</div>
        ${cat.itemName ? `<div class="item-name">${escapeHTML(cat.itemName)}</div>` : ''}
        <div class="time">${escapeHTML(now)}</div>
      </div>
      ${rowsHTML}
      <script>
        window.onload = function () { setTimeout(function () { window.print(); }, 300); };
      <\/script>
    </body>
    </html>
  `;
}

// بيسأل تطبع أنهي مجموعة قبل الطباعة (بس لو الفئة مقسّمة فعلًا).
// بيرجّع '' للورقة كلها، اسم المجموعة لواحدة بعينها، أو null لو ألغى.
//
// ⚠️⚠️ قيمة خاصة معناها "اطبع كل مجموعة في ورقة لوحدها" — مش اسم مجموعة.
//
// **ممنوع منعًا باتًا تتحط في خاصية HTML.** الإصدار الأول كان بيحطها في
// data-rg، والقيمة كانت '\u0000each'. ومحرك HTML **بيستبدل المحرف
// \u0000 بـ\uFFFD إجباريًا** (ده في المواصفة نفسها) — فاللي بيرجع من
// getAttribute كان '\uFFFDeach' مش '\u0000each'.
//
// النتيجة إن المقارنة كانت بتفشل، والنظام كان بيفتكرها **اسم مجموعة
// حقيقي**: يدوّر على درجات مجموعتها اسمها '\uFFFDeach'، مايلاقيش ولا
// درجة، ويطبع **ورقة فاضية** عنوانها "كريب سادة — �each".
//
// عشان كده الاختيار دلوقتي بيتنقل في data-rg-mode (نص عادي: all/each/one)
// والاسم في خاصية منفصلة. والثابت ده بقى **جوه الجافاسكريبت بس**.
const RESTOCK_EACH_GROUP = '\u0000each';

// المجموعات اللي فيها درجات **هتتطبع فعلًا**، بترتيبها المحفوظ،
// و"باقي الدرجات" في الآخر لو فيه درجات من غير مجموعة.
//
// ⚠️ withBase لازم يوصل لهنا: من غيره الفئة اللي كلها أساسية بتطلّع
// **صفر ورق**، والفئة اللي فيها مجموعة أساسية بس بتطلّع ورقة فاضية.
function restockGroupNames(cat, grades, withBase) {
  const groups = categoryGroups(cat);
  const relevant = withBase ? grades : grades.filter((g) => !g.isBase);
  const countOf = (name) => relevant.filter((g) => (g.group || UNGROUPED_LABEL) === name).length;
  const names = groups.filter((n) => countOf(n) > 0);
  if (countOf(UNGROUPED_LABEL) > 0) names.push(UNGROUPED_LABEL);
  return names;
}

// ------------------------------------------------------------
// حزمة ورق: كل مجموعة ورقة مستقلة
// ------------------------------------------------------------
// بترجّع:
//   jobs        → ورقة لكل مجموعة (لـQZ: كل واحدة صفحة لوحدها فتتقطع)
//   browserHTML → مستند واحد بفواصل صفحات (نافذة طباعة المتصفح بتتعامل
//                 مع مستند واحد بس)
//   previewHTML → نفس الورق ورا بعض بخط فاصل بدل فاصل الصفحة، عشان
//                 تشوفهم كلهم في معاينة واحدة قبل ما تأكّد
function buildRestockBundle(cat, grades, names, withBase) {
  const papers = names.map((name) => buildRestockHTML(cat, grades, name, withBase));

  const bodyOf = (html) => {
    const m = html.match(/<body>([\s\S]*?)<\/body>/i);
    return m ? m[1] : html;
  };
  // بناخد الهيكل والتنسيقات من أول ورقة ونحط جواها كل الأجسام.
  const shell = papers[0];
  const wrap = (inner) => shell.replace(/<body>[\s\S]*<\/body>/i, `<body>${inner}</body>`);

  const printBodies = papers
    .map((html, i) => {
      const brk = i < papers.length - 1 ? ' style="page-break-after: always; break-after: page;"' : '';
      return `<div${brk}>${stripScripts(bodyOf(html))}</div>`;
    })
    .join('');

  const previewBodies = papers
    .map((html, i) => {
      const sep =
        i > 0
          ? '<div style="border-top:2px dashed #999; margin:6mm 0 4mm; padding-top:2mm; font-size:2.6mm; color:#666; text-align:center;">— ورقة جديدة —</div>'
          : '';
      return sep + stripScripts(bodyOf(html));
    })
    .join('');

  return {
    // الأمر التلقائي بيتشال من الأجسام وبيتحط مرة واحدة على المستند كله
    browserHTML: wrap(printBodies + '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>'),
    previewHTML: wrap(previewBodies),
    jobs: papers.map((html) => ({ html, copies: 1 })),
    count: papers.length,
  };
}

// بترجّع { group, withBase } أو null لو اتلغى.
//
// الشاشة بتظهر لو فيه **اختيار** مطلوب فعلًا: يا إما الفئة مقسّمة مجموعات،
// يا إما فيها درجات أساسية (فمفتاح "اشملها" له معنى). غير كده بتطبع على
// طول من غير ما تسأل — نفس السلوك القديم.
function chooseRestockGroup(cat, grades) {
  return new Promise((resolve) => {
    const groups = categoryGroups(cat);
    const hasBase = grades.some((g) => g.isBase);
    // ⚠️ العدّ بيشمل الأساسية كمان. فيه فئات (زي "المكملات") **كلها**
    // أساسية — لو عدّينا الأرقام بس، كل المجموعات هتطلع صفر، فشاشة
    // الاختيار مش هتعرض ولا مجموعة والعدّاد هيقول "0 درجة".
    const countOf = (name) => grades.filter((g) => (g.group || UNGROUPED_LABEL) === name).length;
    const savedBase = !!(getSharedPrintSettings() || {}).restockWithBase;

    const options = groups.filter((n) => countOf(n) > 0);
    if (countOf(UNGROUPED_LABEL) > 0) options.push(UNGROUPED_LABEL);
    const needsGroupChoice = groups.length > 0 && options.length >= 2;

    if (!needsGroupChoice && !hasBase) {
      resolve({ group: '', withBase: false });
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="dialog-card" style="max-width:340px; text-align:center;">
        <div style="font-size:15px; font-weight:500; margin-bottom:4px;">تطبع أنهي جزء؟</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:10px; line-height:1.7;">
          اسم المجموعة هيتكتب في عنوان الورقة
          (مثال: ${escapeHTML(cat.name)} — ${escapeHTML(options[0])})
        </div>
        <div class="dialog-body" style="display:flex; flex-direction:column; gap:8px;">
          <button class="btn btn-primary" data-rg-mode="all">📄 الورقة كلها (${escapeHTML(grades.length)} درجة)</button>
          ${
            needsGroupChoice
              ? `<button class="btn btn-primary" data-rg-mode="each">
                   🗂️ كل مجموعة في ورقة لوحدها (${escapeHTML(options.length)} ورق)
                 </button>
                 <div style="border-top:1px solid var(--border); margin:2px 0;"></div>
                 ${options
                   .map(
                     (name) =>
                       `<button class="btn" data-rg-mode="one" data-rg-name="${escapeHTML(name)}">${escapeHTML(name)} (${escapeHTML(countOf(name))} درجة)</button>`
                   )
                   .join('')}`
              : ''
          }
        </div>
        <div class="dialog-foot">
          ${
            hasBase
              ? `<label class="print-opt" style="justify-content:center; margin-bottom:8px;">
                   <input type="checkbox" id="rg-with-base" ${savedBase ? 'checked' : ''} />
                   <span><strong>اشمل الدرجات الأساسية</strong><br>
                     <span class="print-opt-hint">بتتكتب بأسمائها تحت أرقام كل مجموعة</span></span>
                 </label>`
              : ''
          }
          <button class="btn" data-rg-cancel="1" style="width:100%;">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = (group) => {
      const el = overlay.querySelector('#rg-with-base');
      const withBase = !!(el && el.checked);
      if (overlay.parentNode) document.body.removeChild(overlay);
      if (group === null) {
        resolve(null);
        return;
      }
      // الاختيار بيتحفظ في الإعدادات المشتركة زي باقي خيارات الطباعة —
      // لو شغلك دايمًا بالأساسية، مش هتعلّم عليها كل مرة.
      if (el) Promise.resolve(saveSharedPrintSettings({ restockWithBase: withBase })).catch(() => {});
      resolve({ group, withBase });
    };
    overlay.querySelectorAll('[data-rg-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-rg-mode');
        if (mode === 'all') return close('');
        if (mode === 'each') return close(RESTOCK_EACH_GROUP);
        return close(btn.getAttribute('data-rg-name') || '');
      });
    });
    overlay.querySelector('[data-rg-cancel]').addEventListener('click', () => close(null));
  });
}

async function printRestockPaper(cat, grades) {
  const choice = await chooseRestockGroup(cat, grades);
  if (!choice) return;
  const { group: groupName, withBase } = choice;

  // ⭐ كل مجموعة في ورقة لوحدها — بضغطة واحدة
  if (groupName === RESTOCK_EACH_GROUP) {
    const names = restockGroupNames(cat, grades, withBase);
    if (!names.length) return;
    const bundle = buildRestockBundle(cat, grades, names, withBase);

    // معاينة واحدة مجمّعة: كل الورق ورا بعض بخط فاصل بينهم.
    const okAll = await showPrintPreview(bundle.previewHTML, {
      pageWidthMm: 80,
      autoHeight: true,
      papers: bundle.count,
    });
    if (!okAll) return;

    // أمر طباعة واحد فيه كل الورق (كل ورقة صفحة لوحدها). كده بيسألك عن
    // الجهاز مرة واحدة بس، والطابعة بتشتغل متواصلة.
    await deliverPrint('restock', bundle.jobs, null, 'width=700,height=800', bundle.browserHTML);
    return;
  }

  const html = buildRestockHTML(cat, grades, groupName, withBase);

  // معاينة قبل الطباعة — نفس فكرة الملصق: تشوف اللي هيطلع قبل ما تحرق ورق.
  // ورقة التزويد ممكن تبقى متر كامل لو الفئة فيها 165 درجة.
  const approved = await showPrintPreview(html, { pageWidthMm: 80, autoHeight: true });
  if (!approved) return;

  // ⚠️ الفئة الكبيرة (كل المجموعات مع بعض) ممكن تعدّي حد رسالة QZ
  // (QZ_MAX_MESSAGE_BYTES) وهي صفحة واحدة. من غير الفحص ده كانت هتوصل
  // لـtryPrintViaQZ وتفشل هناك، وترجع لنافذة طباعة المتصفح — اللي بتحتاج
  // مقاس ورق ثابت من درايفر الطابعة بدل الرول المستمر التلقائي.
  //
  // الحل: لو الورقة كبيرة، نقسّمها **قبل** ما توصل لـQZ لنفس شكل خيار
  // "كل مجموعة في ورقة لوحدها" (بضغطة واحدة، رول متواصل، من غير ما
  // نلمس نافذة المتصفح أو إعدادات الطابعة خالص).
  const estByteSize = new TextEncoder().encode(html).length;

  if (estByteSize > RESTOCK_SAFE_BYTES && !groupName) {
    const names = restockGroupNames(cat, grades, withBase);
    if (names.length > 1) {
      // ⭐⭐ التقسيم ده **لازم يتقال**، مش يحصل في سكوت.
      //
      // المستخدم طلب **ورقة واحدة** وهيطلعله كذا ورقة. لو محصلش تنبيه،
      // هيفتكر إن النظام باظ أو إن الورق اتقطع — وهو أصلًا اتقسم عشان
      // الطبعة **توصل**.
      //
      // ⚠️ والتقسيم هنا سببه **حجم البيانات** مش طول الورقة: رسالة QZ
      // ليها حد أقصى، واللي بيعدّيه بيتضاع في سكوت (نفس عطل "بياخد
      // الأمر ومفيش حاجة بتتطبع"). فمينفعش نشيله — بس ينفع نقوله.
      // ⚠️ تنبيه **مش موقّف** — مش `alert`. لو الطبعة دي جاية عن بُعد،
      // الجهاز المستقبِل مافيش حد واقف عنده، والرسالة الموقّفة هتجمّده
      // وتقفل الطباعة عن بُعد كلها. (الدرس الكامل عند showPrintNotice)
      showPrintNotice(
        `📄 الفئة كبيرة على أمر طباعة واحد — هتتقسّم على ${names.length} ورقة (كل مجموعة لوحدها).`
      );
      const bundle = buildRestockBundle(cat, grades, names, withBase);
      await deliverPrint('restock', bundle.jobs, null, 'width=700,height=800', bundle.browserHTML);
      return;
    }
  }

  // ورقة التزويد رول مستمر (الارتفاع مفتوح)، فمش بنفرض مقاس على QZ.
  await deliverPrint('restock', html, null, 'width=700,height=800');
}
