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

// ============================================================
// 🗓️ تاريخ آخر طبعة لكل فئة — "الفئة دي بتتزوّد ولا لأ"
// ============================================================
// اتطلبت بالنص: "عاوز وقت اخر مرة اطبع فيه ورقة التزويد ... عشان اعرف
// الصنف ده بيتزود ولا لا".
//
// ⚠️⚠️ **مجموعة منفصلة، مش حقل جوّه مستند الفئة** — ونفس سبب gradeStats
// بالظبط: تعديل الفئة متحكوم بـonlyChangedKeys بقوايم حقول مقفولة، وأي
// حقل جديد هناك لازم يتضاف لكل تركيبة فيهم — وأي واحدة تفوتنا معناها إن
// **تعديل الكميات بيترفض في صمت**. فمستند الفئة مالوش أي علاقة بالتاريخ
// ده، بايت ببايت زي ما كان.
//
// ⚠️⚠️ والتاريخ **مطلق** (السبت ٢٠٢٦/٩/٥ ١١:٤٠) مش نسبي ("من ساعتين").
// النسبي بيتغيّر لوحده كل دقيقة، وده بيكسر patchQuantitiesOnly: الشاشة
// هتلاقي HTML مختلف في كل تحديث وترسم من الأول — يعني نضيّع 7 أضعاف
// سرعة الشاشة الرئيسية مقابل جملة أظرف.
//
// ⚠️⚠️ وماينفعش نطلعه من سجل العمليات: السجل بيقرا آخر 400 سطر بس
// (LOG_FETCH_LIMIT)، والفئة اللي مطبوعة من شهر بتكون خرجت من الـ400
// خلاص — فالنتيجة كانت هتبقى "عمرها ما اتطبعت" وهي اتطبعت.
const RESTOCK_PRINTS = 'restockPrints';

// ============================================================
// 🔴📦 تصفية الورقة — "اللي خلص بس" و"المتاح بس"
// ============================================================
// الورقة بتطبع **كل** درجات الفئة. فئة فيها 245 درجة = ورقة طويلة كل
// مرة، واللي ماشي على الرف بيدوّر على المظلّل وسط مية رقم سليم.
// المفتاحين دول بيقسّموا الورقة نصين، وكل واحد بيطبع نص:
//
//   • اللي خلص بس → الدرجات الفاضية (فرع 0 **و** رئيسي 0)
//   • المتاح بس   → اللي لسه فيه كمية في الفرع **أو** الرئيسي
//
// ⚠️ التقسيمة دي **قاطعة**: أي درجة يا فاضية يا فيها حاجة، مافيش تالت.
// عشان كده المفتاحين مكمّلين لبعض — والاتنين مقفولين (أو الاتنين
// مفتوحين) = الورقة الكاملة زي ما كانت بالظبط.

// ============================================================
// ⚠️⚠️ "خلصت" بتتقاس من **الكميات**، مش من الحالة المحفوظة لوحدها
// ============================================================
// العطل اللي اتبلّغ: "لما باجي اضيف درجات جديده دفعة واحده وبعمل انها
// تبدا صفر، لما اطبع الورقة مش بلاقي ولا درجات متظلل عليها".
//
// السبب إن الإضافة كانت بتحط status:'normal' محفورة مهما كانت الكمية
// (اتصلح في statusFromQuantities في app.js). بس الدرجات اللي **اتضافت
// قبل الإصلاح** لسه محفوظة غلط في السحابة — فلو الورقة اعتمدت على
// الحالة لوحدها، هتفضل غلط عندهم لحد ما حد يلمس كل درجة بإيده.
//
// فبنسأل الكميات كمان: فرع 0 ورئيسي 0 = خلصت، مهما كانت الحالة مكتوبة
// إيه. مافيش أي حالة سليمة تكون فيها الاتنين صفر والدرجة "متاحة".
//
// ⚠️ ولاحظ إننا **مابنعكسش** القاعدة: درجة فيها كمية وحالتها 'pending'
// بتفضل زي ما هي — ده استثناء الطلب اليدوي المقصود (isManualRequest)،
// ومالوش دعوة بالسؤال ده.
function gradeIsOut(g) {
  if (!g) return false;
  if (g.status === 'out') return true;
  // ⚠️⚠️ الكميات لازم تكون **موجودة** الأول، مش مجرد بتساوي صفر.
  //
  // `Number(undefined) || 0` بيطلّع صفر — فدرجة مالهاش الحقول دي خالص
  // كانت هتتحسب "خلصت". الفحص مسك ده فعلًا: ملف بيعمل درجات من غير
  // كميات طلّع **22 خانة مظللة بدل 8**، يعني الورقة كلها مظللة.
  //
  // كل مسارات الإضافة في النظام بتكتب الحقلين، بس درجة قديمة أو جاية من
  // مكان مانعرفوش ممكن ماتكونش — والغلط ساعتها بيبقى **صامت وواسع**
  // (ورقة كلها تظليل). فلو الحقول مش موجودة، بنسيب الحالة المحفوظة
  // تحكم زي الأول بالظبط.
  const b = g.branchQty;
  const m = g.mainQty;
  if (b === undefined || b === null || b === '') return false;
  if (m === undefined || m === null || m === '') return false;
  return (Number(b) || 0) === 0 && (Number(m) || 0) === 0;
}

// الأوضاع: 'out' | 'available' | أي حاجة تانية = الورقة الكاملة
const RESTOCK_FILTER_LABEL = {
  out: 'اللي خلص بس',
  available: 'المتاح بس',
};

function applyRestockFilter(grades, mode) {
  if (mode === 'out') return (grades || []).filter((g) => gradeIsOut(g));
  if (mode === 'available') return (grades || []).filter((g) => !gradeIsOut(g));
  return grades;
}

function countRestockFilter(grades, withBase, mode) {
  const list = withBase ? grades : (grades || []).filter((g) => !g.isBase);
  return applyRestockFilter(list, mode).length;
}

// null = مالمناش الحاجة دي من السحابة لسه. {} = حاولنا ومفيش/فشلت.
let restockPrintStamps = null;
let restockStampsPromise = null;

// بتقرا المجموعة مرة واحدة في الجلسة (مستند صغير لكل فئة، 39 فئة).
// ⚠️ مافيش onSnapshot عن قصد: ده مستمع دايم زيادة على شاشة السرعة
// مهمة فيها، والتاريخ ده مابيتغيّرش غير لما حد يطبع.
async function loadRestockPrintStamps(force) {
  if (!force && restockPrintStamps) return restockPrintStamps;
  if (!force && restockStampsPromise) return restockStampsPromise;
  restockStampsPromise = (async () => {
    try {
      const snap = await db.collection(RESTOCK_PRINTS).get();
      const map = {};
      snap.forEach((d) => {
        const at = (d.data() || {}).at;
        if (at) map[d.id] = at;
      });
      restockPrintStamps = map;
    } catch (err) {
      console.warn('تعذّر قراءة تواريخ طباعة ورق التزويد:', err);
      // ⚠️ {} مش null: null معناها "حاول تاني"، فأي قطع نت كان هيخلّي
      // كل طبعة تحاول تقرا من الأول وتأخّر الشاشة.
      restockPrintStamps = restockPrintStamps || {};
    }
    restockStampsPromise = null;
    return restockPrintStamps;
  })();
  return restockStampsPromise;
}

// مين بيشوف التاريخ: منشئ النظام دايمًا، وباقي الحسابات لو المفتاح
// مفتوح — اتطلب كده بالنص ("يظهر عند منشئ النظام فقط وممكن نعمله شيك
// بوكس ... اني اظهره ل باقي الحسابات").
function canSeeRestockLastPrint() {
  if (typeof isOwner === 'function' && isOwner(typeof state !== 'undefined' && state ? state.profile : null)) {
    return true;
  }
  return typeof getPrintTweak === 'function' && getPrintTweak('showRestockDate') === true;
}

function restockLastPrintText(catId) {
  if (!catId) return '';
  const at = restockPrintStamps && restockPrintStamps[catId];
  if (!at) return '';
  const d = new Date(at);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('ar-EG', { weekday: 'long' })} ${d.toLocaleString('ar-EG')}`;
}

// بيتنده **بعد** ما الطبعة تتأكد. نفس معيار سجل العمليات بالظبط:
// اختيار الجهاز = الطباعة اتأكدت.
//
// ⚠️ **مش async ومافيش await على الكتابة**: وعد Firestore مابيخلصش غير
// لما السيرفر يرد، فلو النت واقف كان هيعلّق مسار الطباعة. النسخة
// المحلية بتتحدّث فورًا، والسحابة بتلحق لوحدها.
function stampRestockPrint(cat) {
  if (!cat || !cat.id) return '';
  const at = new Date().toISOString();
  if (!restockPrintStamps) restockPrintStamps = {};
  restockPrintStamps[cat.id] = at;
  try {
    const p = db.collection(RESTOCK_PRINTS).doc(cat.id).set({
      at,
      catName: cat.name || '',
      byName: (typeof state !== 'undefined' && state && state.profile && state.profile.name) || '',
    });
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('تعذّر تسجيل تاريخ طباعة ورقة التزويد:', err));
    }
  } catch (err) {
    console.warn('تعذّر تسجيل تاريخ طباعة ورقة التزويد:', err);
  }
  return at;
}

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
function buildRestockHTML(cat, grades, groupName, withBase, filterMode) {
  // ⭐ اسم اليوم جنب التاريخ — الورقة بتتعلّق على الرف وبتتقارن بغيرها،
  // و"السبت" أسرع في القراية من "٢٠٢٦/٩/٥" وانت ماسك الورقة في إيدك.
  // ⚠️ التاريخ والوقت نفسهم **مالمسناهمش** — بس بنزوّد اليوم قبلهم.
  const sheetDate = new Date();
  const now = `${sheetDate.toLocaleDateString('ar-EG', { weekday: 'long' })} ${sheetDate.toLocaleString('ar-EG')}`;

  // ⭐ آخر مرة الفئة دي اتطبعت فيها ورقة تزويد — الشرح والقيود عند
  // RESTOCK_PRINTS فوق. الجملة دي بتتكتب **بس** لو الحساب بيشوفها
  // (منشئ النظام، أو مفتاح "ورّي التاريخ لكل الحسابات")، وبس لو فيه
  // تاريخ محفوظ فعلًا — أول طبعة للفئة الورقة بتطلع زي ما هي بالظبط.
  const lastPrintAt = canSeeRestockLastPrint() ? restockLastPrintText(cat.id) : '';
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
    `<span class="blank">${showHatch && gradeIsOut(g) ? HATCH_CELL : ''}</span></div>`;

  const baseRowHTML = (g) =>
    `<div class="row"><span class="num base-num">${escapeHTML(g.name || '')}</span>` +
    `<span class="blank">${showHatch && gradeIsOut(g) ? HATCH_CELL : ''}</span></div>`;

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
  //
  // ⚠️ والتصفية بتحصل **هنا**، بعد الأساسية وقبل التجميع — عشان
  // المجموعات تتحسب على اللي هيتطبع فعلًا، فمجموعة كل درجاتها اتشالت
  // ماتطلعش عنوان فاضي.
  const all = withBase ? grades : grades.filter((g) => !g.isBase);
  const relevant = applyRestockFilter(all, filterMode);
  // ⚠️ اللافتة بتتقرر من **اللي اتشال فعلًا**، مش من المفتاح. لو المفتاح
  // مفتوح ومافيش ولا درجة اتشالت (كل الفئة خلصت مثلًا)، الورقة كاملة
  // فعلًا — واللافتة ساعتها بتكدب.
  const droppedAny = relevant.length < all.length;
  const filterLabel = RESTOCK_FILTER_LABEL[filterMode] || '';

  // ============================================================
  // ⚠️⚠️ ورقة "اللي خلص بس" **من غير تظليل**
  // ============================================================
  // التظليل معناه "الدرجة دي خلصت". في ورقة كل درجاتها خلصت، التظليل
  // بيتحط على **كل** خانة — فبيقول معلومة الورقة قايلاها في عنوانها
  // أصلًا، و**بياكل المكان اللي بتكتب فيه الكمية**. يعني ورقة مالكش
  // مكان تكتب فيها.
  //
  // شفنا ده في الصورة قبل ما يوصل للورق: ٦ خانات كلها مظللة.
  //
  // ⚠️ والورقة الكاملة وورقة "المتاح بس" **زي ما هما**: هناك التظليل
  // بيفرّق بين درجة ودرجة، وده شغله الأصلي.
  const showHatch = filterMode !== 'out';

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
        /* أخف من تاريخ الطبعة الحالية عن قصد: ده تاريخ **قديم**، ولو
           بنفس الوزن الواحد بيقراه بالغلط كتاريخ الورقة اللي في إيده. */
        .header .last-print { font-size: 10px; margin-top: 2px; }
        .short-note {
          border: 2px solid #000; text-align: center; font-weight: bold;
          font-size: 11px; padding: 2px 1mm; margin: 3px 0 5px; line-height: 1.5;
        }
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
        ${lastPrintAt ? `<div class="last-print">آخر طبعة قبل دي: ${escapeHTML(lastPrintAt)}</div>` : ''}
      </div>
      ${
        // ============================================================
        // ⚠️⚠️ اللافتة دي **لازم تفضل صارخة**
        // ============================================================
        // الورقة دي ناقصة درجات **عن قصد**، واللي ماسكها على الرف لو
        // مافهمش كده هيفتكر إن الباقي اتشال من الفئة خالص. الإطار
        // المتين حواليها (‎.short-note‎ في التنسيقات فوق) غرضه الوحيد إن
        // عينك ماتعديش عليه.
        //
        // ⚠️ ومافيش إيموچي فيها عن قصد: الورقة بتترسم بمحرك جافا بتاع
        // QZ، ومش مضمون إن عليه خط إيموچي — الرمز كان ممكن يطلع مربع
        // فاضي. نص عربي عادي بيتطبع على أي محرك.
        //
        // ⚠️⚠️ وممنوع أي شرح يتكتب **جوّه** كتلة التنسيقات فوق: الورقة
        // بتتبعت لـQZ كنص، وتعليقات CSS بتتحسب في حجم الرسالة زي أي
        // حرف. أول نسخة من اللافتة دي كان شرحها مكتوب في الـCSS —
        // فكانت بتتبعت مع **كل** ورقة تزويد في النظام، حتى اللي
        // المفتاح مقفول عندها.
        droppedAny && filterLabel
          ? `<div class="short-note">الورقة دي فيها <u>${escapeHTML(filterLabel)}</u> (${escapeHTML(relevant.length)} من ${escapeHTML(all.length)}) — مش كل درجات الفئة</div>`
          : ''
      }
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
function restockGroupNames(cat, grades, withBase, filterMode) {
  const groups = categoryGroups(cat);
  // ⚠️ نفس الفلترة اللي في buildRestockHTML بالحرف — لو اختلفوا، خيار
  // "كل مجموعة في ورقة" هيطلّع **ورقة فاضية** لمجموعة كل درجاتها اتشالت.
  const relevant = applyRestockFilter(
    withBase ? grades : grades.filter((g) => !g.isBase),
    filterMode
  );
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

// ⚠️ مرمِّز الـ1 بت (canvasToPng1Bit) اتنقل لـprint-core.js — بقى مشترك
// مع الملصقات كمان. الشرح الكامل هناك.

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

function buildRestockBundle(cat, grades, names, withBase, filterMode) {
  const papers = names.map((name) => buildRestockHTML(cat, grades, name, withBase, filterMode));

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

    // ============================================================
    // 🔴 "الناقص بس" — إمتى الشاشة تظهر عشانه
    // ============================================================
    // العدّ بيتحسب **بنفس إعداد الأساسية المحفوظ**، عشان الرقم اللي
    // مكتوب على الزرار يبقى هو الرقم اللي هيتطبع فعلًا.
    //
    // ⚠️ والشاشة بتظهر عشانه **بس لما يكون فيه اختيار حقيقي**:
    //   • كل الدرجات ناقصة  → الورقتين واحدة، مافيش اختيار
    //   • ولا درجة ناقصة    → الخيار هيطلّع ورقة فاضية، فمالوش لازمة
    // غير كده الشاشة كانت هتفتح على فاضي وتاخد دوسة من غير فايدة —
    // ونفس القاعدة اللي الشاشة دي ماشية عليها من الأصل.
    const totalRelevant = (savedBase ? grades : grades.filter((g) => !g.isBase)).length;
    const outCount = countRestockFilter(grades, savedBase, 'out');
    const availCount = totalRelevant - outCount;
    // فيه اختيار حقيقي بس لو الفئة فيها **الاتنين**. لو كلها خلصت أو
    // كلها متاحة، المفتاحين مالهمش أي معنى — واحد بيطلّع نفس الورقة
    // والتاني بيطلّع ورقة فاضية.
    const needsFilterChoice = outCount > 0 && availCount > 0;

    if (!needsGroupChoice && !hasBase && !needsFilterChoice) {
      resolve({ group: '', withBase: false, filterMode: '' });
      return;
    }

    // ⭐ آخر طبعة للفئة دي — نفس المعلومة اللي بتتكتب على الورقة، بس
    // قبل ما تحرق ورق: بتشوفها وانت لسه بتختار.
    const lastLine = canSeeRestockLastPrint() ? restockLastPrintText(cat.id) : '';

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="dialog-card" style="max-width:340px; text-align:center;">
        <div style="font-size:15px; font-weight:500; margin-bottom:4px;">تطبع أنهي جزء؟</div>
        ${
          lastLine
            ? `<div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">🗓️ آخر طبعة: <strong>${escapeHTML(lastLine)}</strong></div>`
            : ''
        }
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:10px; line-height:1.7;">
          اسم المجموعة هيتكتب في عنوان الورقة
          (مثال: ${escapeHTML(cat.name)} — ${escapeHTML(options[0])})
        </div>
        <div class="dialog-body" style="display:flex; flex-direction:column; gap:8px;">
          <button class="btn btn-primary" data-rg-mode="all">📄 الورقة كلها (<span data-rg-count="all">${escapeHTML(totalRelevant)}</span> درجة)</button>
          ${
            needsGroupChoice
              ? `<button class="btn btn-primary" data-rg-mode="each">
                   🗂️ كل مجموعة في ورقة لوحدها (${escapeHTML(options.length)} ورق)
                 </button>
                 <div style="border-top:1px solid var(--border); margin:2px 0;"></div>
                 ${options
                   .map(
                     (name) =>
                       `<button class="btn" data-rg-mode="one" data-rg-name="${escapeHTML(name)}">${escapeHTML(name)} (<span data-rg-count="${escapeHTML(name)}">${escapeHTML(countOf(name))}</span> درجة)</button>`
                   )
                   .join('')}`
              : ''
          }
        </div>
        <div class="dialog-foot">
          ${
            // ============================================================
            // ⚠️⚠️ المفتاحين دول **مابيتحفظوش** — بعكس مفتاح الأساسية
            // ============================================================
            // اتطلب كده بالنص: "انا عاوز الاتنين شيك بوكس دول ميتحفظش
            // الاختيار بتاعهم ... الاقي الزرارين متشال عليهم التعليم".
            //
            // والسبب منطقي: مفتاح الأساسية بيوصف **شكل شغلك** (بتشتغل
            // بالأساسية ولا لأ) فبيتحفظ. والمفتاحين دول بيوصفوا **الطبعة
            // دي بالذات** — النهارده عايز اللي خلص، بكرة عايز الورقة
            // كلها. لو اتحفظوا، هتفتح الشاشة وتدوس "الورقة كلها" وتطلعلك
            // ناقصة من غير ما تعرف ليه.
            //
            // فمفيش هنا `checked` ولا قراية من الإعدادات المحفوظة.
            // ⚠️ ومتحطش. لو حد ضاف حفظ للمفتاحين دول، الفحص بيمسكها.
            needsFilterChoice
              ? `<label class="print-opt" style="justify-content:center; margin-bottom:6px;">
                   <input type="checkbox" id="rg-only-out" />
                   <span><strong>اللي خلص بس (${escapeHTML(outCount)})</strong><br>
                     <span class="print-opt-hint">الدرجات الفاضية في الفرع والرئيسي</span></span>
                 </label>
                 <label class="print-opt" style="justify-content:center; margin-bottom:8px;">
                   <input type="checkbox" id="rg-only-avail" />
                   <span><strong>المتاح بس (${escapeHTML(availCount)})</strong><br>
                     <span class="print-opt-hint">اللي لسه فيه كمية في الفرع أو الرئيسي</span></span>
                 </label>`
              : ''
          }
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

    // المفتاحين مع بعض (أو ولا واحد) = الورقة الكاملة — التقسيمة قاطعة،
    // فاتحاد النصين هو الكل.
    const modeOf = () => {
      const o = overlay.querySelector('#rg-only-out');
      const a = overlay.querySelector('#rg-only-avail');
      const onlyOut = !!(o && o.checked);
      const onlyAvail = !!(a && a.checked);
      if (onlyOut === onlyAvail) return '';
      return onlyOut ? 'out' : 'available';
    };

    const close = (group) => {
      const el = overlay.querySelector('#rg-with-base');
      const withBase = !!(el && el.checked);
      const filterMode = modeOf();
      if (overlay.parentNode) document.body.removeChild(overlay);
      if (group === null) {
        resolve(null);
        return;
      }
      // ⚠️ **مفتاح الأساسية بس** هو اللي بيتحفظ. الشرح فوق عند المفتاحين.
      if (el) {
        Promise.resolve(saveSharedPrintSettings({ restockWithBase: withBase })).catch(() => {});
      }
      resolve({ group, withBase, filterMode });
    };
    // ============================================================
    // ⚠️⚠️ الأرقام على الأزرار **لازم تتحدّث مع المفاتيح**
    // ============================================================
    // من غير ده الزرار بيقول "الورقة كلها (245 درجة)" وانت مفعّل "الناقص
    // بس" — فتدوس وتطلعلك 18. الرقم اللي بيكدب أوحش من مافيش رقم، لأنك
    // بتاخد قرارك عليه.
    const refreshCounts = () => {
      const baseEl = overlay.querySelector('#rg-with-base');
      const wb = baseEl ? baseEl.checked : savedBase;
      const shown = applyRestockFilter(wb ? grades : grades.filter((g) => !g.isBase), modeOf());
      const inGroup = (name) => shown.filter((g) => (g.group || UNGROUPED_LABEL) === name).length;
      overlay.querySelectorAll('[data-rg-count]').forEach((el) => {
        const key = el.getAttribute('data-rg-count');
        el.textContent = key === 'all' ? shown.length : inGroup(key);
      });
    };
    ['#rg-with-base', '#rg-only-out', '#rg-only-avail'].forEach((sel) => {
      const el = overlay.querySelector(sel);
      if (el) el.addEventListener('change', refreshCounts);
    });
    refreshCounts();

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

// اسم الورقة زي ما بيتكتب في عنوانها بالظبط — بيروح لسجل العمليات
// عشان السطر يقول **أنهي ورقة** اتطبعت، مش "ورقة تزويد" وبس.
function restockSheetTitle(cat, groupName) {
  const base = (cat && cat.name) || '';
  return groupName ? `${base} — ${groupName}` : base;
}

// وصفة السجل لورقة التزويد.
// ⚠️ kind: 'restock' **مش** بتتبني تاني في rebuildFromSpec — الورقة
// بتتبعت جاهزة. الوصفة دي لسجل العمليات بس.
function restockLogSpec(cat, groupName, papers, filterMode) {
  // ⚠️ نوع الورقة **لازم يتكتب في السجل**: ورقة ناقصة درجات عن قصد
  // وورقة كاملة مش نفس العملية، واللي بيراجع السجل بعد أسبوع مش هيفرّق
  // بينهم لو السطرين مكتوبين بنفس الاسم.
  const label = RESTOCK_FILTER_LABEL[filterMode] || '';
  return {
    kind: 'restock',
    cat: cat || null,
    text: restockSheetTitle(cat, groupName) + (label ? ` (${label})` : ''),
    copies: Math.max(1, parseInt(papers, 10) || 1),
  };
}

async function printRestockPaper(cat, grades) {
  // ⚠️ بنحمّل التواريخ **قبل** بناء الورقة، وبس لو الحساب بيشوفها —
  // الحساب اللي مش بيشوفها مابيدفعش ولا قراءة واحدة زيادة.
  if (canSeeRestockLastPrint()) await loadRestockPrintStamps();

  const choice = await chooseRestockGroup(cat, grades);
  if (!choice) return;
  const { group: groupName, withBase, filterMode } = choice;

  // ⚠️⚠️ ورقة فاضية = ورق محروق وحيرة. لو مفيش ولا درجة ناقصة، بنقولها
  // **قبل** المعاينة بدل ما يطبع ورقة عنوان من غير أرقام.
  // (تنبيه مش موقّف — نفس درس showPrintNotice: الطبعة ممكن تكون عن بُعد
  //  ومافيش حد واقف عند الجهاز.)
  if (filterMode && countRestockFilter(grades, withBase, filterMode) === 0) {
    showPrintNotice(
      filterMode === 'out'
        ? '✅ مفيش ولا درجة خلصت في الفئة دي — مافيش حاجة تتطبع.'
        : '⚠️ كل درجات الفئة دي خلصت — مافيش متاح يتطبع.'
    );
    return;
  }

  // ⭐ كل مجموعة في ورقة لوحدها — بضغطة واحدة
  if (groupName === RESTOCK_EACH_GROUP) {
    const names = restockGroupNames(cat, grades, withBase, filterMode);
    if (!names.length) return;
    const bundle = buildRestockBundle(cat, grades, names, withBase, filterMode);

    // معاينة واحدة مجمّعة: كل الورق ورا بعض بخط فاصل بينهم.
    const okAll = await showPrintPreview(bundle.previewHTML, {
      pageWidthMm: 80,
      autoHeight: true,
      papers: bundle.count,
    });
    if (!okAll) return;

    // أمر طباعة واحد فيه كل الورق (كل ورقة صفحة لوحدها). كده بيسألك عن
    // الجهاز مرة واحدة بس، والطابعة بتشتغل متواصلة.
    const sentAll = await deliverPrint(
      'restock', bundle.jobs, null, 'width=700,height=800', bundle.browserHTML,
      restockLogSpec(cat, '', bundle.count, filterMode)
    );
    if (sentAll) stampRestockPrint(cat);
    return;
  }

  const html = buildRestockHTML(cat, grades, groupName, withBase, filterMode);

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
    const names = restockGroupNames(cat, grades, withBase, filterMode);
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
      const bundle = buildRestockBundle(cat, grades, names, withBase, filterMode);
      const sentSplit = await deliverPrint(
        'restock', bundle.jobs, null, 'width=700,height=800', bundle.browserHTML,
        restockLogSpec(cat, '', bundle.count, filterMode)
      );
      if (sentSplit) stampRestockPrint(cat);
      return;
    }
  }

  // ⚠️⚠️ مفتاح "ورقة التزويد كصورة" **مابيتقراش هنا** — بيتقرا على
  // الجهاز اللي هيطبع فعلًا (جوه tryPrintViaQZ). الشرح عند
  // maybeRasterizeSheet في print-core.js.
  //
  // ورقة التزويد رول مستمر (الارتفاع مفتوح)، فمش بنفرض مقاس على QZ.
  const sent = await deliverPrint(
    'restock', html, null, 'width=700,height=800', undefined,
    restockLogSpec(cat, groupName, 1, filterMode)
  );
  if (sent) stampRestockPrint(cat);
}
