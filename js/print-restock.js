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

// ============================================================
// ⭐⭐ الورقة **في نص** الصفحة — مش على حرفها (margin: 0 auto)
// ============================================================
// الطابعة الحرارية 80مم **مابتطبعش الـ80 كلهم**. رأس الطباعة بيغطي
// 72.1مم في نص الورقة بس — عشان كده تعريف الطابعة نفسه اسمه
// "80(72.1) x 297mm". يعني فيه ~4مم من كل ناحية ورق **مستحيل يتطبع
// عليه**.
//
// الورقة عربي (dir=rtl)، فجسم الصفحة بعرض 66مم كان بيتلزق في **حرف
// اليمين** (من 13.9 لـ79.9مم). ده كان ماشي طول ما إحنا مابنبعتش مقاس،
// لأن QZ ساعتها بيرسم جوه المساحة المطبوعة (72.1مم) وخلاص.
//
// لكن من ساعة ما بقينا نبعت "size: {width: 80}" (عشان الورقة الطويلة
// ماتصغّرش)، بقى بيرسم على الـ80 كلهم — فآخر 3.85مم من اليمين وقعوا
// برّه رأس الطباعة، و**أرقام أول عمود اتاكلت** (الخانات بانت والأرقام
// لأ)، وفضل فراغ فاضي واسع على الشمال.
//
// "margin: 0 auto" بتحط الـ66مم في النص بالظبط (من 7 لـ73مم)، يعني
// جوه المساحة المطبوعة وفاضل 3مم أمان من كل ناحية — وبتشتغل صح في
// الحالتين (سواء اترسمت على 80 أو على 72.1).
//
// ⚠️ فحص restock-print-test.js بيقيس ده فعليًا: بيرسم الورقة بعرض 80مم
// ويتأكد إن مفيش أي رقم بيعدّي حدود الـ72.1.
//
// ⚠️⚠️ والشرح ده **برّه** الورقة عن قصد. أي كلام بيتحط جوه <style>
// بيتبعت لـQZ مع الورقة ويتحسب في حجم الرسالة (حد التقسيم 44 كيلو) —
// وكمان بيلخبط الفحوصات اللي بتدوّر على كلمات جوه الـHTML.
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
        body { font-family: Tahoma, Arial, sans-serif; font-size: 10px; padding: 1mm; margin: 0 auto; width: 66mm; }
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
// ============================================================
// 🧪 ورقة التزويد كصورة — تحت مفتاح `sheetImage` بس
// ============================================================
// ⚠️⚠️ الكود اللي تحت **مابيشتغلش خالص** والمفتاح مقفول (وهو مقفول
// افتراضيًا). فيه فحص بيتأكد إن الورقة والمفتاح مقفول **مطابقة حرف
// بحرف** للي النظام بيطلّعه من غير الكود ده أصلًا.
//
// ليه أصلًا: الورقة الأطول من فورم التعريف بتتصغّر. الشرح الكامل والقياسات
// عند مفتاح `sheetImage` في print-core.js.
//
// ⚠️ وأي فشل هنا **بيرجع للطريقة القديمة**، مايوقّفش الطباعة. الورقة
// الوحشة أحسن من ورقة مافيش.

const SHEET_DPI = 203;              // Xprinter XP-80C
const SHEET_PRINTABLE_MM = 72.1;    // اللي رأس الطباعة بيغطيه فعلًا (مش 80)
const SHEET_IMG_MAX_BYTES = 44 * 1024;  // نفس هامش RESTOCK_SAFE_BYTES

// ------------------------------------------------------------
// PNG بعمق 1 بت — مكتوب بإيدنا عن قصد
// ------------------------------------------------------------
// ⚠️⚠️ `canvas.toDataURL()` بيطلّع PNG بـ32 بت **دايمًا** ومافيش خيار.
// والورقة أصلًا لونين. القياس على ورقة 245 درجة:
//     32 بت → 154 كيلو  ← فوق حد رسالة QZ (48) → **بتتضاع في صمت**
//      1 بت →  22 كيلو  ← أصغر من الـHTML نفسه
// عشان كده المحوّل ده مش تحسين — من غيره الخاصية كلها مابتشتغلش.
function sheetCrc32(buf) {
  let table = sheetCrc32.t;
  if (!table) {
    table = sheetCrc32.t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function sheetPngChunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, sheetCrc32(out.subarray(4, 8 + data.length)));
  return out;
}

// بترجّع base64 لصورة PNG رمادية بعمق 1 بت (0 = أسود، 1 = أبيض)
async function canvasToPng1Bit(cv) {
  if (typeof CompressionStream !== 'function') return null;   // متصفح قديم
  const w = cv.width, h = cv.height;
  const px = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const rowBytes = (w + 7) >> 3;
  const raw = new Uint8Array((rowBytes + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;                                   // نوع المرشّح: بدون
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3] / 255;
      // الشفاف بيتحسب أبيض — الورق أبيض أصلًا
      const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) * a + 255 * (1 - a);
      if (lum >= 128) raw[p + (x >> 3)] |= 0x80 >> (x & 7);
    }
    p += rowBytes;
  }
  const cs = new CompressionStream('deflate');      // zlib — اللي PNG عايزه
  const writer = cs.writable.getWriter();
  writer.write(raw);
  writer.close();
  const z = new Uint8Array(await new Response(cs.readable).arrayBuffer());

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 1;   // عمق البت
  ihdr[9] = 0;   // نوع اللون: رمادي
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    sheetPngChunk('IHDR', ihdr),
    sheetPngChunk('IDAT', z),
    sheetPngChunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of parts) { out.set(x, o); o += x.length; }
  let bin = '';
  const CH = 0x8000;   // على دفعات: String.fromCharCode بيقع على مصفوفة كبيرة
  for (let i = 0; i < out.length; i += CH) bin += String.fromCharCode.apply(null, out.subarray(i, i + CH));
  return btoa(bin);
}

// ------------------------------------------------------------
// الورقة (HTML) → صورة بدقة الطابعة
// ------------------------------------------------------------
// ⚠️ foreignObject بيتقرا **XML صارم**. أول محاولة بعتنا الـHTML زي ما هو
// والصورة ماحمّلتش خالص (من غير أي رسالة خطأ). الحل: XMLSerializer على
// شجرة الصفحة نفسها — بيطلّع XML سليم مقفول الوسوم.
// ⚠️ ولازم نشيل أي <script> — بيوقّع القراءة، وملهوش لازمة في صورة.
async function renderSheetImage(html) {
  try {
    const MM_PX = 96 / 25.4;
    const cssW = Math.round(SHEET_PRINTABLE_MM * MM_PX);
    const devW = Math.round((SHEET_PRINTABLE_MM / 25.4) * SHEET_DPI);

    // بنقيس الطول الحقيقي في إطار مخفي — مش بنخمّنه من عدد الصفوف
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = `position:fixed; left:-99999px; top:0; width:${cssW}px; height:100px; border:0;`;
    document.body.appendChild(frame);
    let cssH = 0;
    let xml = '';
    try {
      const doc = frame.contentDocument;
      doc.open();
      doc.write(html);
      doc.close();
      await new Promise((r) => setTimeout(r, 60));
      cssH = Math.ceil(doc.body.scrollHeight);
      doc.querySelectorAll('script').forEach((el) => el.remove());
      doc.documentElement.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      xml = new XMLSerializer().serializeToString(doc.documentElement);
    } finally {
      frame.remove();
    }
    if (!cssH || !xml) return null;

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cssW}" height="${cssH}">` +
      `<foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;

    const img = new Image();
    const ok = await new Promise((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
    if (!ok) return null;

    const cv = document.createElement('canvas');
    cv.width = devW;
    cv.height = Math.round((cssH * devW) / cssW);
    const cx = cv.getContext('2d');
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(img, 0, 0, cv.width, cv.height);

    // ⚠️ شبكة أمان: صورة كلها بيضا معناها إن الرسم فشل في صمت. الطباعة
    // على ورق فاضي أوحش من إننا نرجع للطريقة القديمة.
    const data = cx.getImageData(0, 0, cv.width, Math.min(cv.height, 400)).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 128) dark++;
    if (dark < 50) return null;

    const b64 = await canvasToPng1Bit(cv);
    if (!b64) return null;

    return {
      image: 'data:image/png;base64,' + b64,
      bytes: b64.length,
      widthMm: SHEET_PRINTABLE_MM,
      heightMm: +((cv.height / SHEET_DPI) * 25.4).toFixed(1),
    };
  } catch (err) {
    console.warn('تعذّر رسم ورقة التزويد كصورة — هنطبعها بالطريقة العادية:', err);
    return null;
  }
}

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

  // 🧪 المفتاح التجريبي: صورة بطولها الكامل بدل ما التعريف يصغّرها.
  // ⚠️ مقفول = السطر ده بيعدّي على طول والباقي زي ما هو بالحرف.
  if (typeof getPrintTweak === 'function' && getPrintTweak('sheetImage')) {
    const shot = await renderSheetImage(html);
    // ⚠️ الحجم بيتفحص **هنا** مش بعد ما نبعت: الرسالة الأكبر من الحد
    // بتتضاع في صمت والطابعة "بتاخد الأمر ومفيش حاجة بتتطبع".
    if (shot && shot.bytes <= SHEET_IMG_MAX_BYTES) {
      // ⚠️⚠️ لازم الـHTML يتبعت **مع** الصورة، مش الصورة لوحدها.
      // normalizePrintJobs بترمي أي وظيفة مالهاش `html` — وكانت الطباعة
      // بتوقف عند "محتوى الملصق وصل بايظ". (الفحص مسكها.)
      // ومفيش حجم زيادة على الطابعة: pageOf بيفضّل الصورة ويسيب الـHTML،
      // فاللي بيتبعت لـQZ هو الصورة بس — نفس نمط الملصقات بالظبط.
      await deliverPrint(
        'restock',
        [{ html, image: shot.image, copies: 1 }],
        { pageWidthMm: shot.widthMm, pageHeightMm: shot.heightMm, customSize: true },
        'width=700,height=800',
        html
      );
      return;
    }
    // ⚠️ الرجوع للقديم **بيتقال** مش بيحصل في سكوت — من غير كده المستخدم
    // هيفتكر إن المفتاح شغّال وهو مش شغّال، ويفضل مستني نتيجة مش جاية.
    showPrintNotice(
      shot
        ? `📄 الورقة كصورة طلعت كبيرة (${Math.round(shot.bytes / 1024)} كيلو) — اتطبعت بالطريقة العادية.`
        : '📄 مانفعش نرسم الورقة كصورة — اتطبعت بالطريقة العادية.'
    );
  }

  // ورقة التزويد رول مستمر (الارتفاع مفتوح)، فمش بنفرض مقاس على QZ.
  await deliverPrint('restock', html, null, 'width=700,height=800');
}
