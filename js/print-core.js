// ============================================================
// أساس الطباعة — التوصيل، QZ، الإعدادات، المعاينة
// ============================================================
// ⚠️ الملف ده **مش** وحدة معزولة (module). كل ملفات js بتتحمّل في مساحة
// أسماء واحدة مشتركة، فأي اسم هنا شايفه باقي الملفات والعكس. التقسيم
// للتنظيم بس: كل ملف عن حاجة واحدة عشان اللي بيعدّل يلاقي اللي بيدوّر
// عليه من غير ما يقلّب في 8000 سطر.
//
// أي حاجة بتتطبع في النظام بتعدّي من deliverPrint هنا. الملف ده مالوش
// دعوة بشكل الملصق — بس بإزاي يوصل للطابعة.


// بيوصّل الطباعة لوجهتها: يا إما الجهاز ده مباشرة، يا إما بيبعتها لجهاز تاني.
// html: صفحة واحدة أو مصفوفة صفحات (لـQZ). browserHTML: مستند واحد بفواصل
// صفحات، بيستخدم مع نافذة طباعة المتصفح لأنها بتتعامل مع مستند واحد بس.
// بترجّع true لو الطباعة اتبعتت فعلًا (لطابعة هنا أو لجهاز تاني)، وfalse
// لو المستخدم ألغى أو حصلت مشكلة — الشاشات بتستخدم ده عشان تعرف تفضّي
// السلة ولا لأ.
// ============================================================
// تسجيل الطباعة في سجل العمليات
// ============================================================
// ⭐ **الطبعة كلها سطر واحد** — مش سطر لكل ملصق. طبعة 100 ملصق كانت
// هتبقى 100 سطر وتغرق السجل وتخلّيه بلا فايدة، والمعلومة اللي محتاجها
// واحدة: مين طبع إيه وكام وإمتى.
//
// ⚠️ ومابنسجّلش غير لما الطباعة **تتأكد** — الإلغاء من المعاينة أو من
// شاشة اختيار الجهاز مش عملية.
// اسم عنصر السلة — السلة فيها أنواع مختلفة (صنف من الفئات، صنف من ملف
// الأصناف، ملصق مكتوب بالإيد)، وكل واحد اسمه في حتة.
function cartItemName(it) {
  if (!it) return '';
  if (it.cat) return it.cat.itemName || it.cat.name || '';
  return it.itemName || it.name || it.text || '';
}

// أول 3 أسماء و"و N غيرهم" — مع سقف طول عشان السطر مايتفركشش.
function summarizeNames(names, keep, maxLen) {
  const k = keep || 3;
  const cap = maxLen || 120;
  if (!names.length) return '';
  const head = names.slice(0, k).join('، ');
  const rest = names.length - k;
  const out = rest > 0 ? `${head} و${rest} غيرهم` : head;
  return out.length > cap ? out.slice(0, cap - 1) + '…' : out;
}

function logPrintJob(type, spec, sizeOptions) {
  if (typeof logActivity !== 'function') return;
  // ⚠️ ورقة التزويد بتتنده من غير spec — لازم تتسجّل برضه.
  if (!spec) {
    if (type !== 'restock') return;
    logActivity({ action: 'print', printKind: 'restock', printLabel: 'ورقة تزويد', newValue: 1 });
    return;
  }
  const kindName = {
    item: 'ملصق صنف',
    quarter: 'ملصق مقسوم ٤',
    text: 'ملصق مسمّى',
    many: 'سلة طباعة',
  }[spec.kind] || (type === 'restock' ? 'ورقة تزويد' : 'طباعة');

  let count = 0;
  let what = '';
  if (spec.kind === 'many' && Array.isArray(spec.items)) {
    count = spec.items.reduce((n, it) => n + (parseInt(it.copies, 10) || 1), 0);
    // ⚠️ العدد لوحده مابيقولش **إيه** اللي اتطبع. "١ صنف" في السجل
    // مالهاش أي قيمة لما تكون بتدوّر على مين طبع الحاجة الفلانية.
    // فبنكتب الأسماء نفسها — أول 3 وبعدين "و N غيرهم"، عشان سلة 20 صنف
    // ماتعملش سطر طوله متر ولا مستند كبير في السحابة.
    const names = spec.items
      .map((it) => String(cartItemName(it) || '').trim())
      .filter(Boolean);
    what = summarizeNames(names);
  } else {
    count = parseInt(spec.copies, 10) || 1;
    what = (spec.cat && (spec.cat.itemName || spec.cat.name)) || spec.text || '';
  }

  logActivity({
    action: 'print',
    printKind: spec.kind || type,
    printLabel: kindName,
    itemName: String(what || '').slice(0, 120),
    newValue: count,
    categoryId: (spec.cat && spec.cat.id) || null,
    categoryName: (spec.cat && spec.cat.name) || '',
  });
}

async function deliverPrint(type, html, sizeOptions, winFeatures, browserHTML, spec) {
  const target = await choosePrintTarget();
  if (target === null) return false;

  // ⭐ بعد اختيار الجهاز = الطباعة اتأكدت فعلًا
  logPrintJob(type, spec, sizeOptions);

  if (target !== 'local') {
    await sendPrintJob(type, target, html, sizeOptions, browserHTML, spec);
    return true;
  }

  const printedViaQZ = await tryPrintViaQZ(type, html, sizeOptions);
  if (printedViaQZ) return true;

  const list = normalizePrintJobs(html);
  const single = browserHTML || (list.length ? list[0].html : '');
  if (!single) {
    alert('حصلت مشكلة في تجهيز محتوى الطباعة. حدّث الصفحة وحاول تاني.');
    return false;
  }
  // ============================================================
  // ⭐⭐ الرجوع لنافذة المتصفح لازم **يتقال**، مش يحصل في سكوت
  // ============================================================
  // ده حصل فعلًا: نافذة طباعة ويندوز فتحت على الكمبيوتر فجأة ولازم حد
  // يدوس "طباعة" — والمستخدم فاكر إن النظام باظ. الحقيقة إن QZ رجّع
  // false لسبب واضح (أغلبها: **الجهاز مش مظبوط على طابعة للنوع ده**)،
  // بس السبب كان بيتكتب في lastPrintOutcome وبس ومحدش بيشوفه.
  //
  // ⚠️ تنبيه **مش موقّف** (مش alert): الجهاز ده ممكن يكون بيستقبل طباعة
  // عن بُعد ومافيش حد واقف عنده، والرسالة الموقّفة بتجمّده. نفس درس
  // v0.34.1 — الشرح الكامل عند showPrintNotice.
  const why = (lastPrintOutcome && lastPrintOutcome.reason) || '';
  showPrintNotice(
    why.includes('مش مظبوط على طابعة')
      ? '⚠️ الجهاز ده مش متظبّط على طابعة للطبعة دي — اختارها من ⚙️ إعدادات الطابعة. دلوقتي هتتفتح نافذة طباعة عادية.'
      : `⚠️ الطباعة المباشرة ماتمّتش${why ? ` (${why})` : ''} — هتتفتح نافذة طباعة عادية بدلها.`,
    9000
  );

  const win = window.open('', '_blank', winFeatures);
  if (!win) {
    alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return false;
  }
  win.document.write(single);
  win.document.close();
  return true;
}

// ============================================================
// ⭐⭐ الملصق بيتبنى على **الجهاز اللي هيطبع**، مش اللي بعت
// ============================================================
// ⚠️⚠️ كان مكتوب هنا: "بنبعت الـHTML جاهز بالكامل بدل ما الجهاز المستقبِل
// يعيد بناءه — كده اللي بيتطبع هناك هو بالظبط اللي شوفته في المعاينة."
//
// الكلام ده **طلع غلط على ورق حقيقي**، والصورة أثبتته: نفس الدرجة
// بالظبط، من الكمبيوتر بتطلع "بونيه حجاب — بندانه سوري مفتوح درجة 4"،
// ومن الموبايل بتطلع "بونيه حجاب — بندانه سوري" بخط أكبر — **ناقصة
// "مفتوح درجة 4"**.
//
// **السبب**: مقاس الخط بيتحسب بالقياس على الجهاز اللي بيبعت. الموبايل
// مافيهوش Tahoma ولا Arial — أندرويد بيبدّلهم بخط تاني (Noto) مقاساته
// **أضيق للعربي**. فالموبايل بيقيس ويقول "الكلام ده يدخل سطرين بمقاس
// 4 مم"، وبيحط الرقم ده في الـCSS ويبعته.
//
// والكمبيوتر بيرسم نفس الـCSS بخطوطه **هو** — اللي أعرض — فالكلام
// مابيدخلش، و`-webkit-line-clamp` بتقص السطر الزيادة **في صمت**. مفيش
// خطأ، ومفيش نقط حتى — الكلام بيختفي وخلاص.
//
// والمعاينة على الموبايل بتبان سليمة لأنها بترسم بخطوط الموبايل نفسه.
//
// **الحل**: بنبعت **وصفة** الملصق (النص والعدد والمقاس) جنب الـHTML.
// الجهاز اللي هيطبع بيعيد بناءه بخطوطه هو، فالقياس بيبقى صح.
//
// ⚠️ الـHTML الجاهز فاضل مبعوت كمان — عشان الأجهزة اللي لسه على نسخة
// قديمة مش عارفة الوصفة تفضل تطبع حاجة صح بدل ما تقف.
async function sendPrintJob(type, targetDeviceId, html, sizeOptions, browserHTML, spec, rawCommand) {
  const station = (state.printStations || []).find((s) => s.id === targetDeviceId);

  // ⚠️ درس مهم: الجهاز المستقبِل ممكن يكون لسه شغّال على **نسخة أقدم** من
  // النظام (تبويب مفتوح من كام يوم). فالطلب اللي بنسيبه في السحابة لازم
  // يبقى مفهوم للنسخة القديمة كمان:
  //   • html      → نص واحد جاهز (كل النسخ القديمة بتفهمه صح)
  //   • jobs      → القايمة الجديدة بالنسخ (النسخ القديمة بتتجاهلها)
  // كده حتى لو الجهاز التاني ما اتحدّثش، هيطبع ملصق صح مش نص خام.
  const jobs = normalizePrintJobs(html);

  // ============================================================
  // ⭐⭐ الطلب لازم يفضل **صغير** — وإلا السحابة بترفضه في صمت
  // ============================================================
  // ⚠️⚠️ العطل اللي اتبلّغ: "من الكمبيوتر بيطبع 100 ملصق عادي، ومن
  // الموبايل الأمر مايروحش ولا بييجي رد أصلًا".
  //
  // السبب: طلب الطباعة بيتخزّن كمستند في السحابة، وحد المستند الواحد في
  // Firestore هو **1 ميجا**. وإحنا كنا بنبعت `fallbackHTML` — وده الملصق
  // **مكرر بعدد النسخ** — **ومرتين** (في `html` وفي `browserHTML`):
  //
  //   40 ملصق  →  561 كيلو  ✅ بيعدّي
  //   100 ملصق → 1377 كيلو  ❌ بيترفض
  //
  // وده بالظبط سبب إن الـ40 كانوا بيشتغلوا والـ100 لأ.
  //
  // وأسوأ حاجة إن مفيش رسالة: Firestore بيقبل الكتابة **محليًا** ويرفضها
  // على السيرفر بعدين. فالتطبيق بيقول "اتبعت الطلب" وهو عمره ما وصل.
  //
  // الحل: بنبعت **ملصق واحد + العدد** بدل الملصق مكرر. الجهاز المستقبِل
  // بيكرّره هو (وأصلًا بقى بيعيد بناءه من الوصفة).
  //
  // ⚠️ متحطّش هنا أي نص بيكبر مع عدد النسخ. لو محتاج حاجة كده، ابعت
  // الوصفة وسيب الجهاز التاني يبنيها.
  const oneLabelHTML = jobs.length ? jobs[0].html : '';
  const payload = {
    type,
    targetDeviceId,
    // ⚠️ أمر خام (عيّنة الخطوط): الجهاز المستقبِل بيشوفه الأول ويرجع.
    // جهاز على نسخة قديمة مش فاهمه هيتجاهله ويطبع ملصق فاضي — ملصق
    // ضايع، مش عطل. وده أحسن من سكوت تام مالوش تفسير.
    raw: rawCommand || null,
    html: oneLabelHTML,
    jobs,
    // وصفة إعادة البناء — الجهاز المستقبِل بيفضّلها على الـHTML الجاهز
    spec: spec || null,
    senderVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '',
    // ⚠️ **مش** browserHTML: هو الملصق مكرر بعدد النسخ، وهو اللي كان
    // بيفجّر حجم المستند. الجهاز المستقبِل بيكرّره بنفسه.
    browserHTML: null,
    sizeOptions: sizeOptions || null,
    status: 'pending',
    requestedByUid: state.user.uid,
    requestedByName: state.profile.name || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  // ============================================================
  // ⚠️ حارس الحجم — أحسن من رفض صامت
  // ============================================================
  // لو الطلب لسه كبير لأي سبب (سلة فيها 50 صنف مختلف مثلًا)، بنقولها
  // للمستخدم دلوقتي بدل ما السحابة ترفضه وهو فاكر إنه اتبعت.
  const FIRESTORE_DOC_LIMIT = 1048576; // 1 ميجا — حد Firestore الثابت
  const SAFE_DOC_BYTES = Math.floor(FIRESTORE_DOC_LIMIT * 0.85);
  const docBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (docBytes > SAFE_DOC_BYTES) {
    alert(
      `⚠️ الطلب تقيل أوي على الإرسال (${Math.round(docBytes / 1024)} كيلو).\n\n` +
        'قسّمه على مرتين، أو اطبع من الجهاز اللي عليه الطابعة مباشرة.'
    );
    return;
  }

  const ref = db.collection('printJobs').doc();
  fireWrite(ref.set(payload), 'طلب طباعة');
  const deviceLabel = station ? station.deviceName : 'الجهاز التاني';
  alert(
    isServerReachable()
      ? `اتبعت طلب الطباعة لـ"${deviceLabel}". هيوصلك تأكيد أول ما يطبع.`
      : `⚠️ انت مش متصل بالإنترنت دلوقتي.\nالطلب اتسجّل، وهيتبعت لـ"${deviceLabel}" أول ما النت يرجع.`
  );

  // ============================================================
  // ⭐ بنتابع الطلب: شريط تقدم حقيقي، وسبب الفشل بالنص
  // ============================================================
  // قبل كده كان اللي بعت بيستنى في الفراغ لحد ما تيجي رسالة واحدة في
  // الآخر — والرسالة دي كانت **بتقول "اتطبع" حتى لو فشلت** (شوف
  // executePrintJob). دلوقتي:
  //   • الجهاز اللي بيطبع بيكتب تقدمه، وإحنا بنرسم نفس الشريط هنا
  //   • ولو فشل، بيكتب **السبب** وإحنا بنعرضه زي ما هو
  let bar = null;
  const closeBar = () => { if (bar) { bar.close(); bar = null; } };

  const stop = ref.onSnapshot((snap) => {
    const data = snap.data();
    if (!data) return;

    // التقدم بيوصل من الجهاز التاني وهو بيطبع
    if (data.status === 'pending' && data.progressTotal > 0) {
      // ⏹️ الإيقاف من هنا كمان — والسبب إن **الشغل بيتم من الموبايل**.
      // لو الزرار على الكمبيوتر بس، يبقى ناقص في الاستخدام الأساسي.
      // بنكتب علامة على الطلب، والجهاز اللي بيطبع بيشوفها بين الدفعات.
      if (!bar) bar = showPrintProgress(data.progressTotal, () => {
        ref.update({ cancelRequested: true }).catch((err) => {
          console.warn('تعذّر إرسال طلب الإيقاف:', err);
        });
      });
      bar.update(data.progressDone || 0);
      return;
    }

    if (data.status === 'stopped') {
      stop();
      closeBar();
      alert(`⏹️ اتوقفت.\n\n${data.failReason || ''}\n\nاللي كان في الماكينة خلاص هيكمّل.`);
      return;
    }

    if (data.status === 'printed') {
      stop();
      closeBar();
      alert(`✅ اتطبع على "${deviceLabel}"${data.printedByName ? ` (${data.printedByName})` : ''}.`);
    } else if (data.status === 'failed') {
      stop();
      closeBar();
      alert(
        `⚠️ الطباعة فشلت على "${deviceLabel}".\n\n` +
          (data.failReason ? `السبب: ${data.failReason}\n\n` : '') +
          'اتأكد إن QZ Tray شغّال والطابعة متوصلة وفيها ورق.'
      );
    }
  });
  // ⚠️ بنقفل الشريط كمان لو المتابعة وقفت من غير رد — بدل ما يفضل معلّق
  setTimeout(() => { stop(); closeBar(); }, 180000);
}

// ============================================================
// استقبال طلبات الطباعة القادمة من جهاز تاني وتنفيذها تلقائيًا
// ============================================================
const handledPrintJobIds = new Set();

let unsubPrintJobs = null;

function subscribePrintJobs() {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  if (unsubPrintJobs) unsubPrintJobs();
  unsubPrintJobs = db
    .collection('printJobs')
    .where('targetDeviceId', '==', deviceId)
    .where('status', '==', 'pending')
    .onSnapshot(
      (snap) => {
        snap.docs.forEach((doc) => {
          if (handledPrintJobIds.has(doc.id)) return;
          handledPrintJobIds.add(doc.id);
          executePrintJob(doc.id, doc.data());
        });
      },
      (err) => console.warn('تعذّر استقبال طلبات الطباعة:', err)
    );
}

// ============================================================
// إعادة بناء الملصق من وصفته على الجهاز اللي هيطبع
// ============================================================
// بترجّع قايمة وظايف، أو null لو مفيش وصفة (أو وصفة مش مفهومة) —
// وساعتها بيتستخدم الـHTML الجاهز اللي جه مع الطلب.
//
// ⚠️ أي شكل ملصق جديد لازم يتضاف هنا **وفي اللي بيبعت**، وإلا الطباعة عن
// بُعد هتفضل على القياس الغلط بتاع الجهاز الباعت من غير ما حد ياخد باله.
// بتكرّر كل ملصق بعدد نسخه في مستند واحد — لنافذة طباعة المتصفح، اللي
// مافيهاش مفهوم "عدد نسخ" زي أمر QZ.
function expandCopies(list) {
  if (!list || !list.length) return '';
  const bodies = [];
  for (const j of list) {
    const body = typeof extractLabelBody === 'function' ? extractLabelBody(j.html) : j.html;
    for (let i = 0; i < Math.max(1, j.copies || 1); i++) bodies.push(body);
  }
  return list[0].html.replace(/<body>[\s\S]*<\/body>/, `<body>${bodies.join('')}</body>`);
}

async function rebuildFromSpec(spec, sizeOptions) {
  if (!spec || !spec.kind || !sizeOptions) return null;
  const n = Math.max(1, parseInt(spec.copies, 10) || 1);
  try {
    if (spec.kind === 'text' && typeof buildTextLabel === 'function') {
      const b = buildTextLabel(spec.text, sizeOptions, n);
      return [{ html: b.jobHTML, image: b.image, copies: n }];
    }
    // ⚠️ "من غير سعر" بيتنقل مع الصنف مش مع المقاس، عشان كل صنف في السلة
    // ليه مفتاحه هو — فبنرجّعه لمكانه هنا.
    const opts = spec.cat && spec.cat.__noPrice ? { ...sizeOptions, noPrice: true } : sizeOptions;
    if (spec.kind === 'item' && typeof buildItemLabel === 'function') {
      const b = await buildItemLabel(spec.cat, opts, n);
      return [{ html: b.jobHTML, image: b.image, copies: n }];
    }
    if (spec.kind === 'quarter' && typeof buildQuarterLabel === 'function') {
      const b = await buildQuarterLabel(spec.cat, opts, n);
      return [{ html: b.jobHTML, image: b.image, copies: n }];
    }
    if (spec.kind === 'many' && Array.isArray(spec.items)) {
      const out = [];
      for (const it of spec.items) {
        const one = await rebuildFromSpec({ ...it, copies: it.copies || 1 }, sizeOptions);
        if (!one) return null; // واحد مش مفهوم = نرجع للـHTML الجاهز كله
        out.push({ ...one[0], copies: Math.max(1, parseInt(it.copies, 10) || 1) });
      }
      return out.length ? out : null;
    }
  } catch (err) {
    console.warn('تعذّرت إعادة بناء الملصق من وصفته — هنستخدم الجاهز:', err);
  }
  return null;
}

async function executePrintJob(jobId, job) {
  // ============================================================
  // ⭐ أمر خام (عيّنة الخطوط) — مسار منفصل تمامًا
  // ============================================================
  // عيّنة الخطوط **مش HTML**: دي أوامر TSPL بتتبعت للطابعة نفسها بلغتها.
  // فمالهاش أي علاقة بكل اللي تحت (الوصفة، النسخ، الدفعات، التقدم).
  //
  // ⚠️ الفرع ده **بيرجع بدري**، والطلب اللي مافيهوش `raw` مابيدخلوش
  // خالص — يعني الطباعة العادية زي ما هي بالحرف.
  if (job && job.raw && job.raw.kind === 'fontSample') {
    const ref0 = db.collection('printJobs').doc(jobId);
    try {
      const printer = getSavedPrinter('label');
      if (!printer) throw new Error('مفيش طابعة ملصق محفوظة على الجهاز ده');
      await printTSPLFontSample(
        printer,
        Number(job.raw.w) || 38,
        Number(job.raw.h) || 25,
        job.raw.text || 'Hejap Kuwaiti 120',
        job.raw.code || '10632103'
      );
      await ref0.update({ status: 'printed' });
      showPrintNotice('🧪 اتطبعت عيّنة الخطوط بطلب من جهاز تاني.');
    } catch (err) {
      console.error('فشلت عيّنة الخطوط عن بُعد:', err);
      await ref0.update({ status: 'failed', failReason: String((err && err.message) || err).slice(0, 200) }).catch(() => {});
    }
    return;
  }

  // الـHTML بيوصل جاهز من الجهاز الباعت (بما فيه صورة الـQR)، فاللي بيتطبع
  // هنا هو بالظبط اللي هو شافه في المعاينة عنده.
  // jobs هو الشكل الجديد؛ html هو الشكل المتوافق مع النسخ القديمة. لو
  // الطلب جاي من نسخة أقدم، normalizePrintJobs بتفهم أشكالها كلها.
  // ⭐ الوصفة الأول: بنعيد بناء الملصق **هنا** بخطوط الجهاز ده، عشان
  // القياس يبقى صح. (شوف الشرح المطوّل في sendPrintJob)
  const rebuilt = await rebuildFromSpec(job.spec, job.sizeOptions);
  const list = rebuilt || normalizePrintJobs(job.jobs && job.jobs.length ? job.jobs : job.html);
  if (!list.length) {
    console.error('طلب طباعة محتواه غير صالح — اتلغى:', jobId);
    db.collection('printJobs')
      .doc(jobId)
      .update({ status: 'failed' })
      .catch(() => {});
    return;
  }

  const ref = db.collection('printJobs').doc(jobId);

  // ============================================================
  // ⭐ التقدم بيتبعت للي بعت الطلب وهو بيحصل
  // ============================================================
  // ⚠️ **مش** كل ملصق. طبعة 200 ملصق كانت هتبقى 200 كتابة في السحابة.
  // بنكتب كل 5% أو كل ثانيتين — أيهما أبعد — عشان الشريط عند اللي باعت
  // يمشي بسلاسة من غير ما نغرق السحابة.
  let lastWrite = 0;
  let lastDone = -1;
  const onProgress = (done, total) => {
    const now = Date.now();
    const step = Math.max(1, Math.floor(total / 20));
    const worth = done >= total || done - lastDone >= step;
    if (!worth || now - lastWrite < 2000) return;
    lastWrite = now;
    lastDone = done;
    ref.update({ progressDone: done, progressTotal: total }).catch(() => {});
  };

  // نجرب QZ Tray الأول (طباعة صامتة فعليًا 100%، من غير أي نافذة أو ضغطة
  // خالص)، ولو مش متاح على الجهاز ده، نرجع لطريقة الـiframe المخفي القديمة
  // (اللي لسه محتاجة ضغطة "طباعة" أخيرة جوه نافذة المتصفح).
  // ⏹️ اللي بعت الطلب من تليفونه يقدر يوقّفه. بنسمع على الطلب ده **وهو
  // بيتطبع بس**، وأول ما تيجي العلامة بنندهها للحلقة اللي بتبعت الدفعات.
  //
  // ⚠️ مستمع على **مستند واحد** ولمدة الطبعة بس — مش استعلام دايم.
  const stopWatch = ref.onSnapshot(
    (snap) => {
      const d = snap.data();
      if (d && d.cancelRequested) requestPrintCancel();
    },
    () => {}
  );

  let printedViaQZ = false;
  try {
    printedViaQZ = await tryPrintViaQZ(job.type, list, job.sizeOptions, onProgress);
  } finally {
    stopWatch();
  }
  const outcome = lastPrintOutcome;
  // ⚠️ الطبعة اللي **اتوقفت بطلب المستخدم** مايصحّش نرجع لها بنافذة
  // المتصفح — ده معناه إن اللي وقفه يرجع يتطبع تاني وكامل.
  if (!printedViaQZ && !outcome.cancelled) {
    // ⚠️ الطلب مابقاش بيحمل النسخة المكررة (كانت بتفجّر حجم المستند)،
    // فبنكرّرها هنا — نافذة المتصفح بتتعامل مع مستند واحد بس.
    printHTMLSilently(job.browserHTML || expandCopies(list));
  }

  // ============================================================
  // ⭐ "اتطبع" معناها اتطبع فعلًا
  // ============================================================
  // ⚠️ الكود القديم كان بيكتب status:'printed' **دايمًا**، مهما حصل.
  // فلو QZ مش شغّال، أو الورق خلص والطابعة وقفت في النص، الجهاز ده كان
  // بيطلّع تحذير على شاشته (ومافيش حد واقف يشوفه) — واللي بعت من الموبايل
  // بيوصله "✅ اتطبع".
  //
  // ⚠️ ومانقدرش نعتمد على القيمة المرجّعة لوحدها: tryPrintViaQZ بترجّع
  // true بمعنى "اتعاملت مع الموضوع" — والطابعة اللي وقفت في النص بترجّع
  // true كمان. فبنقرا lastPrintOutcome اللي فيه التفصيل الحقيقي.
  //
  // الرجوع لنافذة المتصفح (printHTMLSilently) بيتحسب **مش** نجاح: النافذة
  // دي محتاجة حد يدوس "طباعة"، ولو مافيش حد عند الجهاز مش هيحصل حاجة.
  // ⭐ وفيه حالة تالتة: **اتوقفت**. لو كتبناها "فشلت"، اللي على الموبايل
  // هيدوّر على عطل مش موجود — هو اللي وقفها بإيده.
  const ok = printedViaQZ && outcome.ok;
  ref
    .update(
      outcome.cancelled
        ? {
            status: 'stopped',
            failReason: outcome.reason || 'اتوقفت بطلب المستخدم.',
            printedByUid: state.user.uid,
            printedByName: state.profile.name || '',
            printedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }
        : ok
        ? {
            status: 'printed',
            printedByUid: state.user.uid,
            printedByName: state.profile.name || '',
            printedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }
        : {
            status: 'failed',
            failReason: outcome.reason || 'الطباعة ماتمّتش على الجهاز المستقبِل.',
            printedByUid: state.user.uid,
            printedByName: state.profile.name || '',
            printedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }
    )
    .catch((err) => console.warn('تعذّر تعليم طلب الطباعة:', err));
}

// hideCopies: بنخفي خانة "عدد اللاصقات" في وضع ملصقات الدرجات، لأن العدد
// هناك متحدّد لكل درجة على حدة في الجدول — فخانة واحدة عامة هتلخبط.
// مقاس اللفة اللي في المحل. مكتوب في مكان واحد عشان لو اتغيّرت اللفة
// يتغيّر سطر واحد بس.
const LABEL_SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };

// ------------------------------------------------------------
// شاشة "قبل الطباعة"
// ------------------------------------------------------------
// opts:
//   hideCopies      — العدد بيتحدّد لكل درجة على حدة (وضع ملصقات الدرجات)
//   showNoPrice     — مفتاح "من غير سعر" (ملصق الصنف بس — هو اللي فيه سعر)
//   showGroupName   — مفتاح "باسم المجموعة" (ملصقات الدرجات بس)
//
// المفتاحين بيتحفظوا في **الإعدادات المشتركة** مش على الجهاز: الاختيار ده
// قرار شغل ("ملصقاتنا من غير سعر")، مش خاصية جهاز — فلازم يبقى واحد على
// الأربع أجهزة من غير ما حد يعيد ظبطه.
function promptLabelSize(callback, opts) {
  const o = typeof opts === 'boolean' ? { hideCopies: opts } : opts || {};
  const saved = getSharedPrintSettings() || {};
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;';
  const toggle = (id, label, on, hint) => `
      <label class="print-opt">
        <input type="checkbox" id="${id}" ${on ? 'checked' : ''} />
        <span><strong>${label}</strong><br><span class="print-opt-hint">${hint}</span></span>
      </label>`;
  overlay.innerHTML = `
    <div class="card" style="max-width:300px; text-align:center;">
      <div style="margin-bottom:12px; font-size:14px; font-weight:500;">طباعة ملصق</div>
      <div class="field" style="text-align:start; ${o.hideCopies ? 'display:none;' : ''}">
        <label>عدد اللاصقات</label>
        <input class="input" type="number" id="label-copies" value="1" min="1" max="1000" inputmode="numeric" />
      </div>
      ${o.showNoPrice ? toggle('opt-no-price', 'من غير سعر', saved.labelNoPrice, 'الاسم والباركود بس — والخط بيكبر مكان السعر') : ''}
      ${o.showGroupName ? toggle('opt-group-name', 'اكتب اسم المجموعة', saved.gradeLabelWithGroup, 'يعني "كيوي درجة 56" بدل "درجة 56"') : ''}
      <div style="margin-bottom:12px; font-size:11px; color:var(--text-secondary); line-height:1.7;">
        المقاس: <strong>38×25 ملم مقسومة نصين</strong> — ده مقاس اللفة اللي عندنا،
        والمحتوى بيتكرر في نصّي اللاصقة.
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:10px;">
        <button class="btn btn-primary" id="size-measured">🖨️ كمّل</button>
      </div>
      <button class="btn" id="size-cancel">إلغاء</button>
    </div>`;
  document.body.appendChild(overlay);
  const pick = (id, sizeOpts) =>
    document.getElementById(id).addEventListener('click', () => {
      const raw = parseInt(document.getElementById('label-copies').value, 10);
      const copies = Math.max(1, Math.min(MAX_LABEL_COPIES, Number.isNaN(raw) ? 1 : raw));
      const noPriceEl = document.getElementById('opt-no-price');
      const groupEl = document.getElementById('opt-group-name');
      const noPrice = !!(noPriceEl && noPriceEl.checked);
      const withGroup = !!(groupEl && groupEl.checked);
      document.body.removeChild(overlay);

      // الحفظ مابيوقّفش الطباعة: لو النت واقع، تطبع دلوقتي والاختيار
      // بيتحفظ محليًا ويتزامن بعدين.
      const patch = {};
      if (noPriceEl) patch.labelNoPrice = noPrice;
      if (groupEl) patch.gradeLabelWithGroup = withGroup;
      if (Object.keys(patch).length) Promise.resolve(saveSharedPrintSettings(patch)).catch(() => {});

      callback({ ...sizeOpts, copies, noPrice, withGroup });
    });

  // halves = عدد الأقسام اللي اللاصقة الواحدة مقسومة لها والماكينة بتحسبهم
  // لاصقة واحدة. المحتوى بيتكرر في كل قسم.
  //
  // المقاسات التانية (38×25 قطعة واحدة، 38×18، 2×4 إنش) اتشالت خلاص:
  // اللفة اللي في المحل مقاس واحد، والخيارات الزيادة كانت بس فرصة إن حد
  // يختار غلط ويطلع ورق مقصوص. لو جِبنا لفة تانية، يترجّع سطر واحد هنا.
  pick('size-measured', { ...LABEL_SIZE });
  document.getElementById('size-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
}

// توليد الـQR كصورة جاهزة (data URI) **في الصفحة الرئيسية**، مش جوه صفحة
// الطباعة. السبب: لما QZ Tray بياخد الـHTML، هو بيرسمه بمحرك داخلي بتاع
// Java، ومش مضمون إنه يستنى سكريبت خارجي يتحمّل ويولّد الكود قبل ما يطبع.
// الصورة الجاهزة بتشيل الاحتمال ده خالص (وكمان بتخلي المعاينة فورية).
// ============================================================
// ⭐ توليد الـQR — أكبر مربعات ممكنة وأعلى تصحيح أخطاء
// ============================================================
// السبب اللي خلانا نعيد كتابة الجزء ده: ملصق صنف حقيقي طلع صعب القراءة،
// وملصق الفئة على نفس الطابعة كان شغّال عادي. الفرق الوحيد بينهم طول
// الرقم:
//
//   باركود الفئة  = 28144            (5 أرقام)
//   باركود الصنف  = 6291108735848   (13 رقم — EAN-13)
//
// والقياس الفعلي على نفس المساحة (10.7 ملم) بالمكتبة القديمة:
//
//   5 أرقام   → 21 مربع → كل مربع 4.08 نقطة طباعة  ✅
//   13 رقم    → 25 مربع → كل مربع 3.42 نقطة طباعة  ❌
//
// الطابعة الحرارية دقتها 203 نقطة/إنش، يعني النقطة 0.125 ملم. تحت 4 نقط
// للمربع تقريبًا، القارئ مابيعرفش يفصل المربعات عن بعضها.
//
// ------------------------------------------------------------
// حاجتين اتصلحوا
// ------------------------------------------------------------
// 1) **الوضع الرقمي (Numeric).** معيار الـQR فيه وضع خاص للأرقام بيخزّن
//    كل 3 أرقام في 10 بت بدل 24 بت. المكتبة القديمة (qrcodejs) مابتعرفش
//    الوضع ده خالص — بتخزّن كل رقم كحرف كامل. ومعظم الباركودات عندنا
//    أرقام صافية، فكنا بندفع ضعف المساحة على الفاضي.
//
// 2) **المكتبة القديمة بتختار نسخة أكبر من اللازم.** قِسنا نفس المحتوى
//    (13 رقم، وضع أحرف، مستوى M) على المكتبتين: القديمة طلّعت 25 مربع،
//    والجديدة 21. يعني كان فيه هدر حتى من غير الوضع الرقمي.
//
// النتيجة بعد التعديل:
//
//   5 أرقام   → 21 مربع بمستوى تصحيح H (الأعلى) — نفس الحجم، تصحيح أقوى
//   13 رقم    → 21 مربع بمستوى تصحيح H          — أكبر **و** تصحيح أقوى
//   18 رقم    → 21 مربع بمستوى تصحيح Q
//
// يعني مفيش أي مقايضة هنا: المربعات أكبر أو زيها، وتصحيح الأخطاء أعلى أو
// زيه. الاتنين في صالحنا.
//
// ⚠️ المكتبة الجديدة **جوه المستودع** (js/vendor) مش من سيرفر خارجي —
// عشان تشتغل من غير نت من أول لحظة.

// معاينة قبل الطباعة (للملصق بس) — بتوري شكل الملصق الحقيقي جوه النظام
// نفسه قبل ما يروح للطابعة، مع تكبير مرئي عشان يبان على الموبايل.
// بترجّع true لو المستخدم ضغط "طباعة"، false لو ألغى.
function showPrintPreview(html, sizeOptions, copies) {
  // ورقة التزويد رول 80مم بارتفاع مفتوح، فحساب التكبير بتاعها مختلف تمامًا
  // عن الملصق (اللي مقاسه ثابت من الاتجاهين). بنفصلها في دالة لوحدها
  // **عشان مسار الملصق ما يتلمسش بأي حرف** — هو شغّال ومظبوط ومش عايزين
  // نلعب فيه عشان ميزة في حاجة تانية.
  if (sizeOptions && sizeOptions.autoHeight) {
    return showRollPreview(html, sizeOptions);
  }
  return new Promise((resolve) => {
    // المعاينة كانت صغيرة أوي على شاشة الكمبيوتر. دلوقتي بنحسب التكبير من
    // المساحة المتاحة فعلًا بدل رقم ثابت — كبيرة على الكمبيوتر ومناسبة
    // على الموبايل، وبحد أقصى عشان ما تبقاش مشوّهة.
    const isNarrow = window.innerWidth <= NARROW_BREAKPOINT;
    // المعاينة على الكمبيوتر كانت صغيرة أوي (نص الملصق مش باين)، فوسّعنا
    // المساحة المتاحة وسقف التكبير على الشاشات الكبيرة.
    const boxW = Math.min(window.innerWidth - 80, isNarrow ? 320 : 820);
    const PX_PER_MM = 3.7795;

    // ⚠️ الملصق المرسوم كصورة بيتعرض **بمقاسه الحقيقي بالبكسل**، مش
    // بالملليمتر. السبب: 38 مم في المتصفح = 143.6 بكسل، والصورة أصلها 304
    // بكسل — فالعرض بالملليمتر كان بيرمي نص الصورة وبعدين المعاينة تكبّر
    // اللي فضل، فالكلام كان بيبان منغمش وهو أصلًا نضيف.
    const px = sizeOptions.previewPx;
    const frameW = px ? px.w : sizeOptions.pageWidthMm * PX_PER_MM;
    const frameH = px ? px.h : sizeOptions.pageHeightMm * PX_PER_MM;
    const frameCSS = px
      ? `width:${px.w}px; height:${px.h}px;`
      : `width:${sizeOptions.pageWidthMm}mm; height:${sizeOptions.pageHeightMm}mm;`;
    const zoom = Math.min(boxW / frameW, isNarrow ? 4 : 12);
    const shownW = frameW * zoom;
    const shownH = frameH * zoom;
    const jobList = normalizePrintJobs(html);
    const pages = jobList.reduce((n, j) => n + j.copies, 0) || 1;
    const previewHTML = jobList.length ? jobList[0].html : '';

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="card" style="max-width:${Math.round(shownW) + 60}px; width:100%; text-align:center;">
        <div style="font-size:14px; font-weight:500; margin-bottom:12px;">معاينة الملصق قبل الطباعة</div>
        <!-- ⚠️ الـiframe لازم يبقى position:absolute في الزاوية العليا
             الشمال بالظبط. السبب: الصفحة كلها RTL، فالعنصر العادي بيتحاطط
             من **اليمين**، ولما التكبير بيشتغل من نقطة top left بيمدّ
             المحتوى لبره الحدود اليمين ويسيب فراغ على الشمال — وده اللي كان
             بيخلي المعاينة تبان مقصوصة والاسم مش كامل.
             direction:ltr على الحاوية بتشيل أي انعكاس تاني في المستقبل. -->
        <div style="margin:0 auto 12px; width:${Math.round(shownW)}px; height:${Math.round(shownH)}px;
                    border:1px solid var(--border); background:#fff; overflow:hidden;
                    position:relative; direction:ltr;">
          <iframe id="preview-frame" scrolling="no"
                  style="position:absolute; top:0; left:0; ${frameCSS} border:0;
                         transform:scale(${zoom}); transform-origin:top left; display:block;"></iframe>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">
          ${sizeOptions.pageWidthMm}×${sizeOptions.pageHeightMm} ملم${sizeOptions.halves > 1 ? ' — المحتوى بيتكرر في نصّي اللاصقة' : ''}
          ${pages > 1 ? `<br>دي أول لاصقة — هيتطبع <strong>${pages}</strong> لاصقة كل واحدة لوحدها` : ''}
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn" id="preview-cancel">إلغاء</button>
          <button class="btn btn-primary" id="preview-print">🖨️ طباعة ${copies > 1 ? `${copies} لاصقات` : ''}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const frame = document.getElementById('preview-frame');
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(previewHTML);
    doc.close();

    const close = (result) => {
      if (overlay.parentNode) document.body.removeChild(overlay);
      resolve(result);
    };
    document.getElementById('preview-cancel').addEventListener('click', () => close(false));
    document.getElementById('preview-print').addEventListener('click', () => close(true));
  });
}

// ⚠️ لازم تتشال أي سكريبت من المحتوى قبل ما يتعرض في المعاينة.
//
// السبب: ورقة التزويد جواها سطر بيشغّل أمر الطباعة تلقائيًا أول ما تتحمّل
// (window.print) — عشان لما تتفتح في نافذة طباعة المتصفح، الطباعة تبدأ
// لوحدها من غير ما المستخدم يدوّر على الزرار.
//
// لكن المعاينة بتكتب نفس المحتوى جوه إطار في الصفحة، فالسطر ده كان
// بيشتغل **جوه المعاينة** ويفتح شاشة طباعة المتصفح فوق معاينتنا. يعني
// كنت تشوف معاينتين ورا بعض — واحدة بتاعتنا وواحدة بتاعة المتصفح.
//
// المعاينة عرض بس، فمش محتاجة أي سكريبت أصلًا.
function stripScripts(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
}

// ------------------------------------------------------------
// معاينة ورقة التزويد (رول بارتفاع مفتوح)
// ------------------------------------------------------------
// الفرق عن الملصق: العرض ثابت (80مم) والارتفاع بيطلع من المحتوى نفسه —
// ورقة فيها 20 درجة مش زي ورقة فيها 165. فبنكتب المحتوى الأول، نقيس
// ارتفاعه الحقيقي من جوه الإطار، وبعدين نظبّط الصندوق عليه.
function showRollPreview(html, sizeOptions) {
  return new Promise((resolve) => {
    const widthMm = sizeOptions.pageWidthMm || 80;
    const PX_PER_MM = 3.7795;
    const isNarrow = window.innerWidth <= NARROW_BREAKPOINT;
    const boxW = Math.min(window.innerWidth - 60, isNarrow ? 300 : 420);
    const zoom = Math.min(boxW / (widthMm * PX_PER_MM), isNarrow ? 1.4 : 1.8);
    const shownW = widthMm * PX_PER_MM * zoom;

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="card" style="max-width:${Math.round(shownW) + 60}px; width:100%; text-align:center;">
        <div style="font-size:14px; font-weight:500; margin-bottom:4px;">معاينة ورقة التزويد</div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">
          ${
            sizeOptions.papers > 1
              ? `هيتطبع <strong>${escapeHTML(sizeOptions.papers)}</strong> ورق — كل مجموعة لوحدها`
              : `عرض الورقة ${escapeHTML(widthMm)} ملم — الطول على حسب عدد الدرجات`
          }
        </div>
        <!-- نفس درس معاينة الملصق: الصفحة RTL، فالحاوية لازم تبقى LTR
             والإطار في الركن الشمال بالظبط، وإلا التكبير بيطلّع المحتوى بره. -->
        <div id="roll-box" style="margin:0 auto 12px; width:${Math.round(shownW)}px; max-height:55vh;
                    border:1px solid var(--border); background:#fff; overflow:auto;
                    position:relative; direction:ltr;">
          <div id="roll-inner" style="position:relative; width:100%;">
            <iframe id="roll-frame" scrolling="no"
                    style="position:absolute; top:0; left:0; width:${widthMm}mm; border:0;
                           transform:scale(${zoom}); transform-origin:top left; display:block;"></iframe>
          </div>
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn" id="roll-cancel">إلغاء</button>
          <button class="btn btn-primary" id="roll-print">🖨️ طباعة</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const frame = overlay.querySelector('#roll-frame');
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(stripScripts(html));
    doc.close();

    // القياس بعد ما المتصفح يرسم المحتوى فعلًا.
    const fit = () => {
      let h = 400;
      try {
        h = Math.max(
          doc.body ? doc.body.scrollHeight : 0,
          doc.documentElement ? doc.documentElement.scrollHeight : 0,
          200
        );
      } catch (err) {
        /* لو القياس فشل لأي سبب، بنسيب الارتفاع الافتراضي بدل ما نقع */
      }
      frame.style.height = h + 'px';
      overlay.querySelector('#roll-inner').style.height = Math.round(h * zoom) + 'px';
    };
    setTimeout(fit, 60);
    setTimeout(fit, 350);

    const close = (result) => {
      if (overlay.parentNode) document.body.removeChild(overlay);
      resolve(result);
    };
    overlay.querySelector('#roll-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('#roll-print').addEventListener('click', () => close(true));
  });
}

// ============================================================
// الطباعة الصامتة (بدون نافذة منبثقة) — تُستخدم لطباعة طلبات وصلت من
// مكان تاني، لأن فتح نافذة (window.open) من غير ضغطة مستخدم مباشرة ممكن
// المتصفح يمنعه كـ Popup. الـ iframe المخفي ده حل معروف بيلف الحاجز ده.
// ملحوظة: نافذة الطباعة القياسية للمتصفح هتفتح لوحدها تلقائيًا، لكن
// المستخدم لسه محتاج ضغطة "طباعة" الأخيرة جوه النافذة دي نفسها — المتصفح
// مش بيسمح بطباعة فعلية 100% صامتة من صفحة ويب عادية.
function printHTMLSilently(htmlContent) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();
  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }, 15000);
}

// ============================================================
// تكامل QZ Tray: طباعة مباشرة لطابعة مختارة ومحفوظة على الجهاز نفسه.
// ============================================================
// ملحوظة معمارية مهمة: اختيار الطابعة بيتحفظ محليًا على **هذا الجهاز بس**
// (localStorage)، مش في حساب المستخدم على السحابة — لأن الطابعة فعليًا
// موصولة بجهاز معيّن، مش بشخص معيّن. لو نفس الحساب اتفتح من جهاز تاني،
// هيحتاج يختار طابعاته هو تاني.
// أقصى حجم لرسالة واحدة رايحة لـQZ: الرسالة الأكبر من كده بتتضاع في صمت
// والطابعة "بتاخد الأمر ومفيش حاجة بتتطبع".
//
// ⚠️⚠️ الرقم ده **مايتغيّرش من الإعدادات ولا من أي مكان**. هو الحاجز
// الوحيد بينّا وبين "بياخد الأمر ومفيش حاجة بتتطبع"، وطلع من العطل ده
// بالظبط. خانة "عدد الدفعة" اللي المستخدم بيظبطها **سقف تاني جنبه**، مش
// بديل عنه — والحجم دايمًا بيكسب.
//
// (كان مكتوب هنا قبل كده إنه "مش مستخدم" — وده كان غلط: هو الشرط الأول
// في تقسيم الرسايل تحت.)
const QZ_MAX_MESSAGE_BYTES = 48 * 1024;

// ⚠️ كان هنا رقم ثابت `QZ_PAGES_PER_JOB = 8`. بقى **خانة في الإعدادات**
// (getPrintBatchSize) — الشرح الكامل عند تعريفها.
//
// وده القياس الحقيقي اللي بيوضّح ليه الرقم ده **نادرًا** بيبقى هو الحاكم:
//
//   درجة (نص بس)     →  1.5 كيلو للصفحة  →  32 صفحة = 48 كيلو
//   صنف بباركود      →  9.7 كيلو للصفحة  →   4 صفحات = 39 كيلو ← الحجم وقف
//   المقسوم ٤        → 15.8 كيلو للصفحة  →   3 صفحات = 47 كيلو ← الحجم كمان
//
// يعني في ملصقات الباركود، رفع الرقم **مش هيعمل حاجة** — الحد بالبايت
// بيقفل الرسالة قبل ما نوصله. وده اللي المستخدم لازم يشوفه بعينه بدل ما
// يفتكر إن الخانة باظت، فبنعرض الرقم المستخدَم فعلًا بعد كل طبعة.

// تنبيه **مش موقّف** بيظهر تحت ويختفي لوحده بعد شوية.
//
// ⚠️ ده البديل الآمن لـalert()/confirm() في مسار الطباعة. أي رسالة موقّفة
// هناك بتجمّد الجهاز اللي بيطبع — وده بيقفل الطباعة عن بُعد بالكامل
// (شوف الشرح المطوّل في tryPrintViaQZ).
function showPrintHint(count) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:3200;' +
    'background:#263238; color:#fff; padding:10px 16px; border-radius:8px; max-width:88vw;' +
    'font-size:12.5px; line-height:1.8; box-shadow:0 4px 18px rgba(0,0,0,.3); text-align:center;';
  el.textContent = `🖨️ اتبعت ${count} ملصق للطابعة. لو مفيش حاجة خرجت: شوف الورق والغطا واللمبة.`;
  // ⭐ سطر التجربة: بيقول الدفعة طلعت **كام فعلًا**، مش كام طلبت.
  // من غيره المستخدم يكتب 40 ويشوف 4 ويفتكر إن الخانة باظت — وهي الحجم
  // اللي وقف. التجربة لازم تبقى **باينة** عشان تنفع.
  const stat = lastBatchStats;
  if (stat && stat.jobs > 1) {
    const line = document.createElement('div');
    line.style.cssText = 'margin-top:5px; font-size:11.5px; opacity:.82;';
    const asked = getPrintBatchSize();
    line.textContent =
      `📦 ${stat.jobs} دفعة، أكبر واحدة ${stat.maxPerJob} ملصق` +
      (stat.maxPerJob < asked ? ` (طلبت ${asked} — الحجم وقف عند ${stat.maxKB} كيلو)` : '');
    el.appendChild(line);
  }
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 9000);
}

// آخر طبعة اتقسّمت إزاي — بيتكتب من tryPrintViaQZ ويتقرا في التنبيه فوق.
let lastBatchStats = null;

// ============================================================
// نتيجة آخر طباعة — عشان اللي بعت الطلب يعرف حصل إيه
// ============================================================
// ⚠️ tryPrintViaQZ بترجّع true بمعنى **"اتعاملت مع الموضوع"** مش
// **"اتطبعت"**. الفرق ده كان بيخلّي الجهاز الباعت يوصله "✅ اتطبع" حتى
// لما الطابعة تقف في النص — لأن الحالة دي بترجّع true كمان (اتعاملنا
// معاها بتنبيه محلي).
//
// تغيير القيمة المرجّعة كان هيكسر كل اللي بينده عليها، فبدل كده الدالة
// بتسجّل **إيه اللي حصل بالظبط** هنا، واللي محتاج التفصيل بيقراه.
// ⭐ فيه **تلات** حالات مش اتنين. لو "اتوقفت" اتحسبت "فشلت"، المستخدم
// هيدوّر على عطل مش موجود — هو اللي وقفها. ولو اتحسبت "اتطبعت"، هيفتكر
// إن الـ100 خرجوا وهما 40.
let lastPrintOutcome = { ok: false, reason: '', done: 0, total: 0, cancelled: false };

function setPrintOutcome(ok, reason, done, total, cancelled) {
  lastPrintOutcome = {
    ok,
    reason: reason || '',
    done: done || 0,
    total: total || 0,
    cancelled: !!cancelled,
  };
  return lastPrintOutcome;
}

// شريط تقدّم بسيط للطبعات الكبيرة.
// ============================================================
// ⏹️ وقف الباقي
// ============================================================
// ⚠️⚠️ **الاسم هنا مقصود وماينفعش يتغيّر لـ"إلغاء".**
//
// أول ما `qz.print()` تتنادى، الدفعة دي بتبقى في **طابور ويندوز** —
// ومن المتصفح مفيش أي طريقة نسحبها، وQZ Tray نفسه مالوش أمر إلغاء.
// يعني الدفعة اللي في الماكينة **هتكمّل وتخرج** مهما عملنا.
//
// اللي بنوقفه هو **اللي لسه ماتبعتش**. ولو الزرار كتب عليه "إلغاء"
// وطلعوا 20 ملصق بعد الضغط، المستخدم هيفتكر إنه باظ — وده أوحش من إن
// الزرار مايبقاش موجود أصلًا.
//
// 📌 وفيه ربط مباشر مع حجم الدفعة: الدفعة الكبيرة أسرع، **بس أصعب
// توقفها** — أكتر حاجة تخسرها = حجم الدفعة.
let activePrintCancel = null;

function beginPrintCancelScope() {
  activePrintCancel = { requested: false, wake: null };
  return activePrintCancel;
}

function endPrintCancelScope() {
  activePrintCancel = null;
}

function requestPrintCancel() {
  if (!activePrintCancel) return false;
  activePrintCancel.requested = true;
  // ⚠️ لازم نقطع الانتظار **فورًا**. من غير ده تدوس "وقّف" وتقعد مستني
  // لحد 20 ثانية (مدة إيقاع الدفعة) والشريط قدامك مش بيعمل حاجة —
  // فتفتكر إن الزرار مش شغّال وتدوس تاني.
  if (typeof activePrintCancel.wake === 'function') activePrintCancel.wake();
  return true;
}

function isPrintCancelRequested() {
  return !!(activePrintCancel && activePrintCancel.requested);
}

// انتظار بيتقطع لو المستخدم دق "وقّف الباقي"
function cancellableSleep(ms) {
  return new Promise((resolve) => {
    const scope = activePrintCancel;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (scope && scope.wake === finish) scope.wake = null;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    if (scope) scope.wake = finish;
  });
}

// تنبيه معلومة **مش موقّف** — بيظهر ويختفي لوحده.
//
// ⚠️⚠️ **ممنوع `alert` أو `confirm` في أي مسار طباعة.** الدرس اتاخد
// بالغالي في v0.34.1: `confirm()` بتجمّد خيط الجافاسكريبت **كله**، والجهاز
// اللي بيستقبل طباعة عن بُعد مافيش حد واقف عنده يرد — فكان بيقف تمامًا،
// ويقفل الطباعة عن بُعد كلها، والطلب عمره ما بيتعلّم "خلص".
function showPrintNotice(text, ms) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:3200;' +
    'background:#1f3a5f; color:#fff; padding:10px 16px; border-radius:8px; max-width:88vw;' +
    'font-size:12.5px; line-height:1.8; box-shadow:0 4px 18px rgba(0,0,0,.3); text-align:center;';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, ms || 8000);
}

function showPrintProgress(total, onCancel) {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;' +
    'justify-content:center;z-index:3000;padding:12px;';
  box.innerHTML = `
    <div class="card" style="max-width:300px; width:100%; text-align:center;">
      <div style="font-size:14px; font-weight:500; margin-bottom:10px;">🖨️ جارٍ الطباعة</div>
      <div style="font-size:26px; font-weight:600; margin-bottom:6px;" id="pp-num">0 / ${escapeHTML(total)}</div>
      <div style="height:8px; background:var(--surface-muted); border-radius:99px; overflow:hidden;">
        <div id="pp-bar" style="height:100%; width:0%; background:var(--primary, #1565c0); transition:width .2s;"></div>
      </div>
      <div style="font-size:11px; color:var(--text-secondary); margin-top:10px; line-height:1.7;">
        متقفلش الصفحة لحد ما تخلص
      </div>
      ${onCancel ? `
        <button class="btn" id="pp-stop" style="margin-top:10px; width:100%;">⏹️ وقّف الباقي</button>
        <div style="font-size:10.5px; color:var(--text-muted); margin-top:6px; line-height:1.7;">
          اللي اتبعت للماكينة خلاص هيكمّل — بنوقف اللي لسه ماتبعتش
        </div>` : ''}
    </div>`;
  document.body.appendChild(box);
  const num = box.querySelector('#pp-num');
  const bar = box.querySelector('#pp-bar');
  const stopBtn = box.querySelector('#pp-stop');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopBtn.disabled = true;
      stopBtn.textContent = '⏳ بيقف بعد الدفعة دي...';
      try { onCancel(); } catch (err) { console.warn('تعذّر إيقاف الطباعة:', err); }
    });
  }
  return {
    update(n) {
      num.textContent = `${n} / ${total}`;
      bar.style.width = Math.round((n / total) * 100) + '%';
    },
    close() {
      if (box.parentNode) document.body.removeChild(box);
    },
  };
}

// أقصى عدد ملصقات في أمر واحد.
//
// كان 200، واتّرفع لـ1000 بعد ما اتصلح سبب "الطابعة بتاخد الأمر ومفيش حاجة
// بتتطبع": المشكلة مكانتش في العدد، كانت في **حجم الرسالة** الواحدة الرايحة
// لـQZ (شوف QZ_MAX_MESSAGE_BYTES). دلوقتي الرسايل مقسّمة بالحجم، فالعدد
// مابقاش عامل مقيّد.
const MAX_LABEL_COPIES = 1000;

const QZ_LABEL_PRINTER_KEY = 'tazweed_qz_label_printer';

const QZ_RESTOCK_PRINTER_KEY = 'tazweed_qz_restock_printer';

let qzConnected = false;

let qzConnecting = null;

function isQZAvailable() {
  return typeof qz !== 'undefined';
}

// ============================================================
// ⭐⭐ الأمر مايوصلش للطابعة ومفيش رسالة فشل — السبب هنا
// ============================================================
// الشكوى: "لما اجي اطبع 100 ملصق الأمر مايروحش للطباعة ولا بتيجي رسالة
// إن الأمر فشل". و40 ملصق بيشتغلوا عادي.
//
// سببين بيكمّلوا بعض:
//
// **1) الاتصال بيتفتح مرة واحدة وعمره ما بيتراجع.**
// `qzConnected` كانت بتتحط true وخلاص. لو السوكيت مات بعد كده — القفل
// اتقفل والجهاز نام، أو النت قطع لحظة، أو QZ Tray اتقفل واتفتح — العَلَم
// بيفضل true. فـensureQZConnected بترجّع true من غير ما تسأل، وكل أمر
// طباعة بعدها بيتبعت على **سوكيت ميت**.
//
// **2) `qz.print()` مالهاش مهلة.**
// هي وعد بيستنى رد من QZ على السوكيت. لو السوكيت ميت، الرد عمره ما هييجي
// — والوعد **عمره ما بيتحل ولا بيترفض**. يعني:
//   • مفيش خطأ (محدش رمى حاجة)
//   • ومفيش نجاح (الانتظار مخلصش)
//   • والشريط بيقف مكانه، والصفحة مستنية للأبد
//
// **وليه 100 وليه مش 40؟** الـ100 ملصق بيتقسّموا **25 رسالة** ورا بعض،
// والـ40 بيبقوا 10. كل رسالة دي رحلة رايح جاي على السوكيت — يعني 25 فرصة
// للتعليق بدل 10، ووقت أطول بمرتين ونص يزيد احتمال إن السوكيت يقع في
// النص.
//
// الحل: مهلة على كل أمر (لو عدّت = محاولة تانية، وبعدها فشل **بصوت**)،
// والعَلَم بيترجّع لـfalse أول ما السوكيت يقفل.
//
// ⚠️ متشيلش الاتنين. المهلة لوحدها بتكشف التعليق بس بتفضل تتكرر، ورجوع
// العَلَم لوحده مابيحلّش تعليق حصل فعلًا.

// مهلة أمر الطباعة الواحد. الرسالة ~39 كيلو والطابعة الحرارية بتخلّص
// 4 ملصقات في تانيتين تلاتة — فـ30 ثانية مساحة أكتر من كفاية، وأقل من
// إن المستخدم يفتكر إن النظام واقف.
const QZ_PRINT_TIMEOUT_MS = 30000;

// ============================================================
// ⭐⭐ ليه الـ100 ملصق بتضيع من غير ولا رسالة خطأ
// ============================================================
// التقسيم كان موجود خلاص (100 ملصق = 25 رسالة)، والمهلة اتحطت، وبرضه
// الطبعة الكبيرة بتختفي **ومفيش رسالة فشل**. السبب مش في التقسيم — هو في
// **السرعة**.
//
// الطابعة الحرارية بتطبع ملصق 25مم في حوالي **نص ثانية**. يعني 100 ملصق
// = 50 ثانية شغل حقيقي. وإحنا كنا بنرمي الـ25 وظيفة كلها في **ثانية أو
// اتنين** — أسرع 30 مرة من قدرة الماكينة.
//
// وذاكرة الطابعة صغيرة (كام مئة كيلو). فاللي بيحصل: أول شوية وظايف
// بيدخلوا، والباقي **بيتزنق في طابور الويندوز أو بيتنطّ من الطابعة**.
//
// وأسوأ حاجة: `qz.print()` بترجّع بنجاح أول ما الأمر يوصل لطابور الويندوز
// — **مش لما الملصق يخرج**. فمن ناحية الكود كل حاجة نجحت:
//   • مفيش خطأ يترمى
//   • والمهلة عمرها ما بتوصل (الوعد اتحل بسرعة)
//   • فمفيش رسالة فشل تتبعت
// وإنت واقف قدام الماكينة مش شايف حاجة بتخرج.
//
// **الحل**: نمشي على سرعة الماكينة. بعد كل دفعة بنستنى الوقت اللي
// الطابعة محتاجاه فعلًا تطبعها، قبل ما نبعت اللي بعدها. الطبعة بتاخد
// وقتها الطبيعي (وده وقت الطباعة نفسه، مش تأخير زيادة) — بس **بتخرج
// كاملة**.
//
// ⚠️ الرقم ده مقاس بالتقريب على الماكينة اللي في المحل. لو الطابعة أسرع
// أو أبطأ، المفتاح في إعدادات الطابعة بيظبّطه.
const PRINT_PACE_MS_PER_LABEL = 420;

// بتستنى الطابعة تلحق الدفعة اللي لسه اتبعتت.
// ⚠️ مش تأخير مصطنع — ده الوقت اللي الماكينة بتاخده أصلًا. من غيره
// إحنا بنبعت أسرع منها 30 مرة والباقي بيضيع.
// ------------------------------------------------------------
// ⭐ بنملا مخزن الطابعة **قبل** ما يفضى، مش بعديه
// ------------------------------------------------------------
// أول نسخة كانت بتستنى الوقت الكامل اللي الطابعة محتاجاه — يعني بتفضى
// خالص، وبعدين بنبعت اللي بعدها. فبتقعد **فاضية** الوقت اللي بنجهّز فيه
// ونبعت.
//
// الصح إننا نبعت الدفعة الجاية وهي **لسه بتطبع** — بس مش بدري أوي عشان
// المخزن مايطفحش (وده كان أصل العطل). بنستنى 70% من الوقت المقدّر:
// الطابعة تفضل شغّالة على طول، والمخزن مايوصلش لحده.
//
// ⚠️ الأرباح هنا محدودة عن قصد. الـ100 ملصق محتاجين ~50 ثانية شغل
// **حقيقي** على الماكينة — ده حد مادي مش برمجي. اللي بنوفّره هو الفراغ
// بين الدفعات بس.
// ⚠️⚠️ الرقم ده كان 0.7 في v0.45.1 — يعني بنبعت الدفعة الجاية والطابعة
// لسه بتطبع. نظريًا أسرع، وعمليًا **المستخدم شاف العكس**: الملصقات بقت
// بتنقّط 4 بـ4 بدل ما الطابعة تلمّ كومة وتطبعها مرة واحدة.
//
// رجع 1.0 (نستنى الوقت الكامل) لأن ده اللي كان شغّال وهو مبسوط بيه في
// v0.45.0. الفرق في الوقت الكلي ضئيل أصلًا — الـ100 ملصق محتاجين ~50
// ثانية شغل حقيقي على الماكينة في الحالتين.
//
// 📌 الدرس: التحسين اللي محدش طلبه، لو غيّر إحساس الاستخدام، **مش
// تحسين**. الوقت الكلي مش المقياس الوحيد.
//
// ------------------------------------------------------------
// ⭐ ورجعت الفكرة — بس **كخانة** بدل ما تكون مفروضة
// ------------------------------------------------------------
// الاعتراض على v0.45.1 مكانش على الفكرة، كان على إني فرضتها. ولما بقت
// رقم المستخدم بيلفّه عند الماكينة، الاعتراض راح: بيجرّب ويشوف بعينه،
// ويرجّعه في ثانية من غير أي تحديث.
//
// ⚠️ وبقت **عدد ملصقات ثابت** مش نسبة مئوية، والفرق مهم: 70٪ من دفعة 4
// = ملصق واحد، و70٪ من دفعة 40 = 12 ملصق — يعني نفس الإعداد بيتصرّف
// مختلف تمامًا على حسب حجم الدفعة. "فاضل 3 ملصقات" معناه واحد دايمًا.
const PACE_OVERLAP = 1.0;

async function paceForPrinter(labelCount) {
  // ⚠️ `getPrintPaceMs() || DEFAULT` **غلط** هنا: صفر قيمة صحيحة معناها
  // "من غير انتظار"، و`||` بتبلعها وترجّع الافتراضي. الفحص مسك ده لما
  // قاس الوقت الحقيقي ولقى إن "صفر" بتاخد 15 ثانية زي الافتراضي بالظبط.
  const per = getPrintPaceMs();
  if (!(per > 0)) return;
  // بنستنى وقت (الدفعة **ناقص** اللي المستخدم عايز يسبقها بيهم). صفر =
  // استنى الدفعة كلها. ومابنستناش أقل من صفر لو التقديم أكبر من الدفعة.
  const waitFor = Math.max(0, labelCount - getPrintLeadLabels());
  if (waitFor <= 0) return;
  // ⚠️ انتظار **بيتقطع**: المدة دي ممكن توصل 20 ثانية، ولو مابتتقطعش
  // المستخدم بيدوس "وقّف" ومايحصلش حاجة قدامه فيفتكر إنه باظ.
  await cancellableSleep(Math.min(20000, Math.round(waitFor * per * PACE_OVERLAP)));
}

// بتلفّ أي وعد بمهلة. لو عدّت المهلة بترمي خطأ واضح بدل ما تفضل مستنية.
function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} — عدّى ${Math.round(ms / 1000)} ثانية من غير رد`)), ms);
    }),
  ]);
}

// أمر طباعة واحد بمهلة ومحاولة تانية.
//
// ⚠️ المحاولة التانية بتعيد الاتصال الأول. السبب إن أشهر سبب للتعليق هو
// سوكيت ميت — وإعادة الإرسال على نفس السوكيت الميت هتعلّق تاني.
async function qzPrintWithTimeout(config, pages, label) {
  try {
    return await withTimeout(qz.print(config, pages), QZ_PRINT_TIMEOUT_MS, label);
  } catch (err) {
    console.warn('أمر الطباعة معلّق أو فشل — بنعيد الاتصال ونجرّب تاني:', err);
    qzConnected = false;
    qzConnecting = null;
    const ok = await ensureQZConnected();
    if (!ok) throw new Error('الاتصال بـ QZ Tray اتقطع ومارجعش.');
    return withTimeout(qz.print(config, pages), QZ_PRINT_TIMEOUT_MS, label + ' (المحاولة التانية)');
  }
}

// بتسجّل نفسها مرة واحدة: أول ما السوكيت يقفل، العَلَم يرجع false.
let qzClosedHooked = false;
function hookQZClosed() {
  if (qzClosedHooked) return;
  if (!isQZAvailable() || !qz.websocket || typeof qz.websocket.setClosedCallbacks !== 'function') return;
  qzClosedHooked = true;
  try {
    qz.websocket.setClosedCallbacks(() => {
      console.warn('اتصال QZ Tray اتقفل — هنعيد الاتصال في أول طباعة جاية.');
      qzConnected = false;
      qzConnecting = null;
    });
    if (typeof qz.websocket.setErrorCallbacks === 'function') {
      qz.websocket.setErrorCallbacks(() => {
        qzConnected = false;
        qzConnecting = null;
      });
    }
  } catch (err) {
    console.warn('تعذّر تسجيل مراقبة اتصال QZ:', err);
  }
}

async function ensureQZConnected() {
  if (!isQZAvailable()) return false;
  hookQZClosed();
  // ⚠️ مانكتفيش بالعَلَم: بنسأل المكتبة نفسها. لو السوكيت مات من غير ما
  // ينده على callback (بيحصل لما الجهاز ينام)، العَلَم بيبقى بيكدب.
  if (qzConnected) {
    if (typeof qz.websocket.isActive !== 'function' || qz.websocket.isActive()) return true;
    console.warn('العَلَم بيقول متصل والسوكيت مقفول — بنعيد الاتصال.');
    qzConnected = false;
    qzConnecting = null;
  }
  if (qzConnecting) return qzConnecting;

  // ⚠️ qz.websocket.connect() ساعات بترمي خطأ **فوري** بدل ما ترجّع وعد
  // مرفوض (بيحصل على الأجهزة اللي مفيهاش QZ Tray). من غير الـtry دي،
  // الخطأ كان بيطلع بره الدالة ويظهر للمستخدم كشريط أحمر.
  let attempt;
  try {
    attempt = qz.websocket.connect();
  } catch (err) {
    console.warn('تعذّر الاتصال بـ QZ Tray:', err);
    return false;
  }
  if (!attempt || typeof attempt.then !== 'function') return false;

  qzConnecting = attempt
    .then(() => {
      qzConnected = true;
      return true;
    })
    .catch((err) => {
      console.warn('تعذّر الاتصال بـ QZ Tray (على الأغلب مش مثبّت على الجهاز ده):', err);
      return false;
    })
    .finally(() => {
      qzConnecting = null;
    });
  return qzConnecting;
}

// ============================================================
// ⚙️⚙️ إعدادات الطابعة: عام + خاص بالجهاز
// ============================================================
// المشكلة اللي بيحلها: الطابعة على كمبيوتر الكاشير، وصاحب المحل شغّال من
// التليفون. عايز يغيّر أي إعداد — كبير أو صغير — ويقرر **هو** يروح لكل
// الأجهزة ولا لجهاز واحد.
//
// ------------------------------------------------------------
// طبقتين وبس
// ------------------------------------------------------------
//   settings/print          → القيمة **العامة** (كل الأجهزة)
//   deviceSettings/{id}     → **استثناء** لجهاز واحد
//
// وكل دالة بتقرا إعداد بتمشي بالترتيب ده:
//
//   استثناء الجهاز  →  العام  →  المحفوظ محليًا (نسخ قديمة)  →  الافتراضي
//
// ⚠️⚠️ **ليه ده أبسط من "أمر بيتبعت وينفّذ"؟**
//
// النسخة الأولى كانت بتسيب "أمر" في السحابة والجهاز ينفّذه مع النبضة —
// وده جرّ وراه تلات مشاكل كان لازم نحلها بإيدنا: الأمر بينفّذ مرتين،
// وأمر قديم بينفّذ فجأة بعد أسبوعين، وعلامة "اتنفّذ" لازم تتكتب.
//
// الطريقة دي **مافيهاش ولا واحدة منهم**: الإعداد مش أمر بيتنفّذ، ده
// **قيمة** الجهاز بيقراها. الجهاز المقفول بيقراها أول ما يفتح، ومفيش
// حاجة اسمها "اتنفّذ مرتين" لأن مفيش تنفيذ أصلًا.
//
// ------------------------------------------------------------
// ⭐ قاعدة "الكل يكسب"
// ------------------------------------------------------------
// لما تحفظ إعداد **لكل الأجهزة**، الاستثناءات بتاعة نفس الإعداد
// **بتتمسح** من كل الأجهزة. يعني "على الكل" معناها الكل فعلًا.
//
// ⚠️ من غير القاعدة دي، الجهاز اللي أخد استثناء مرة كان هيفضل واقف عليه
// للأبد وانت بتغيّر العام ومش فاهم ليه مش واصل — وده عطل **صامت**، أسوأ
// نوع. وعشان كده كمان النافذة بتنبّهك بأسماء الأجهزة قبل ما تمسح.
const DEVICE_SETTINGS = 'deviceSettings';

// الحقول اللي ينفع تتظبط — **قايمة حصرية**. أي حقل بره القايمة بيتجاهل،
// عشان قيمة من نسخة تانية ماتكتبش حاجة النسخة دي مش فاهماها.
const PRINT_FIELDS = [
  { key: 'align', label: 'المعايرة' },
  { key: 'tweaks', label: 'المفاتيح المتقدمة' },
  { key: 'pace', label: 'الإيقاع' },
  { key: 'batch', label: 'حجم الدفعة' },
  { key: 'lead', label: 'التقديم' },
  { key: 'labelPrinter', label: 'طابعة الملصق' },
  { key: 'restockPrinter', label: 'طابعة ورقة التزويد' },
  { key: 'deviceName', label: 'اسم الجهاز' },
];

const PRINT_FIELD_KEYS = PRINT_FIELDS.map((f) => f.key);

function printFieldLabel(key) {
  const f = PRINT_FIELDS.find((x) => x.key === key);
  return f ? f.label : key;
}

// بتشيل أي حقل بره القايمة، وأي قيمة فاضية.
// ⚠️ الصفر **قيمة صحيحة** (تقديم صفر = استنى الدفعة كلها) — فبنفرّق بين
// الصفر والفاضي بدل ما نستخدم `!value`.
function cleanPrintFields(patch) {
  const out = {};
  if (!patch || typeof patch !== 'object') return out;
  PRINT_FIELD_KEYS.forEach((k) => {
    const v = patch[k];
    if (v === undefined || v === null || v === '') return;
    out[k] = v;
  });
  return out;
}

// استثناءات الجهاز ده — بتتحدّث لايف من subscribeDeviceSettings.
let deviceOverrides = null;

function getDeviceOverrides() {
  if (deviceOverrides) return deviceOverrides;
  try {
    const raw = localStorage.getItem('tazweed_device_overrides');
    if (raw) return JSON.parse(raw);
  } catch (err) {
    /* تجاهل */
  }
  return null;
}

// ⭐ القراءة الموحّدة: استثناء الجهاز الأول، وبعدين العام.
// كل دالة بتقرا إعداد بتعدّي من هنا — فالترتيب مكتوب **مرة واحدة**
// ومستحيل اتنين منهم يختلفوا.
function readPrintField(key) {
  const own = getDeviceOverrides();
  if (own && own[key] !== undefined && own[key] !== null) return own[key];
  const shared = getSharedPrintSettings();
  if (shared && shared[key] !== undefined && shared[key] !== null) return shared[key];
  return undefined;
}

// ⚠️⚠️ الحقول اللي جواها حاجات (المعايرة والمفاتيح) لازم **تتدمج** مش
// تتستبدل. لو الجهاز عنده استثناء في `x` بس، readPrintField هترجّع كائن
// الجهاز كله — و`y` و`shrink` هيبقوا **مش موجودين**، فياخدوا صفر بدل
// القيمة العامة. يعني تظبط استثناء في حاجة واحدة، فتتبهدل حاجتين تانيين
// في صمت.
function readPrintObject(key) {
  const shared = getSharedPrintSettings();
  const own = getDeviceOverrides();
  const a = shared && typeof shared[key] === 'object' && shared[key] ? shared[key] : {};
  const b = own && typeof own[key] === 'object' && own[key] ? own[key] : {};
  return { ...a, ...b };
}

let unsubDeviceSettings = null;

function subscribeDeviceSettings() {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  if (unsubDeviceSettings) unsubDeviceSettings();
  try {
    unsubDeviceSettings = db
      .collection(DEVICE_SETTINGS)
      .doc(deviceId)
      .onSnapshot(
        (snap) => {
          deviceOverrides = snap.exists ? cleanPrintFields(snap.data()) : {};
          try {
            localStorage.setItem('tazweed_device_overrides', JSON.stringify(deviceOverrides));
          } catch (err) {
            /* التخزين ممكن يكون مقفول */
          }
          // ⚠️ الطابعة واسم الجهاز محفوظين محليًا كمان (مسارات قديمة
          // كتير بتقراهم من هناك مباشرة)، فبنزامنهم — وإلا الاستثناء
          // يتغيّر والطباعة تفضل رايحة للطابعة القديمة.
          if (deviceOverrides.labelPrinter) saveSelectedPrinter('label', deviceOverrides.labelPrinter);
          if (deviceOverrides.restockPrinter) saveSelectedPrinter('restock', deviceOverrides.restockPrinter);
          if (deviceOverrides.deviceName) saveDeviceName(String(deviceOverrides.deviceName).slice(0, 40));
        },
        (err) => console.warn('تعذّر قراءة إعدادات الجهاز:', err)
      );
  } catch (err) {
    console.warn('تعذّر الاشتراك في إعدادات الجهاز:', err);
  }
}

// بيحفظ إعدادات **لجهاز واحد** (استثناء).
async function savePrintFieldsForDevice(deviceId, patch) {
  const clean = cleanPrintFields(patch);
  if (!deviceId || !Object.keys(clean).length) return false;
  await db.collection(DEVICE_SETTINGS).doc(deviceId).set(
    {
      ...clean,
      updatedByUid: state.user ? state.user.uid : '',
      updatedByName: (state.profile && state.profile.name) || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return true;
}

// ⭐ بيحفظ **لكل الأجهزة** — وبيمسح استثناءات نفس الحقول من كل جهاز.
// بيرجّع عدد الاستثناءات اللي اتمسحت.
async function savePrintFieldsForAll(patch, deviceIds) {
  const clean = cleanPrintFields(patch);
  if (!Object.keys(clean).length) return 0;

  await saveSharedPrintSettings(clean);

  // ⚠️ المسح **بعد** ما العام يتحفظ مش قبله: لو المسح نجح والحفظ فشل،
  // الأجهزة كانت هتفقد استثناءاتها وتاخد قيمة قديمة — أسوأ من الاتنين.
  //
  // ============================================================
  // ⚠️⚠️ بنمسح **المفتاح الواحد**، مش الحزمة اللي هو جواها
  // ============================================================
  // `tweaks` و`align` مش قيم مفردة — دول **حزم** جواها كذا مفتاح:
  //     tweaks = { noScale, blackwhite, sheetImage, ... }
  //     align  = { x, y, shrink }
  //
  // والنسخة الأولى كانت بتمسح الحزمة **كلها**. يعني لو غيّرت مفتاح واحد
  // على كل الأجهزة، الجهاز اللي كان له إعداد خاص بيفقد **كل** مفاتيحه
  // الخاصة — مش اللي غيّرته بس:
  //
  //   قبل:  الكمبيوتر → tweaks = { noScale: مقفول, sheetImage: مفتوح }
  //   غيّرت blackwhite على الكل
  //   بعد:  الكمبيوتر → tweaks اتمسحت كلها ← فقد الاتنين
  //
  // ⚠️ ومحدش كان هيلاحظ: الإعداد بيرجع للعام في صمت، والورق هو اللي
  // بيقول. اتمسك بسؤال من صاحب النظام واتأكد بالتشغيل قبل التصليح.
  //
  // ⚠️ والمسح المتداخل **لازم** يبقى بـupdate ومسار بالنقطة
  // ('tweaks.blackwhite'). تعشيش delete جوه كائن مع set/merge مش مضمون،
  // والنقطة في set بتتحسب **اسم حقل حرفي** مش مسار — يعني كنا هنعمل حقل
  // اسمه "tweaks.blackwhite" بدل ما نمسح حاجة.
  let cleared = 0;
  const FV = firebase.firestore.FieldValue;
  const keys = Object.keys(clean);
  const delPatch = {};
  keys.forEach((k) => {
    const v = clean[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.keys(v).forEach((sub) => (delPatch[`${k}.${sub}`] = FV.delete()));
    } else {
      delPatch[k] = FV.delete();
    }
  });
  if (!Object.keys(delPatch).length) return 0;

  for (const id of deviceIds || []) {
    try {
      // ⚠️ update مش set: مسار النقطة مالوش معنى غير في update.
      await db.collection(DEVICE_SETTINGS).doc(id).update(delPatch);
      cleared++;
    } catch (err) {
      // الجهاز اللي مالوش استثناء أصلًا مالوش مستند — مافيش حاجة تتمسح،
      // ومش عطل. أي فشل تاني بيتقال، وجهاز فشل مايوقفش الباقي.
      if (err && err.code === 'not-found') continue;
      console.warn('تعذّر مسح استثناء الجهاز', id, err);
    }
  }
  return cleared;
}

// بيشيل استثناءات جهاز كلها ويرجّعه يمشي مع العام.
async function clearDeviceOverrides(deviceId) {
  if (!deviceId) return;
  await db.collection(DEVICE_SETTINGS).doc(deviceId).delete();
}

async function getAvailableQZPrinters() {
  const ok = await ensureQZConnected();
  if (!ok) return [];
  try {
    return await qz.printers.find();
  } catch (err) {
    console.error('تعذّر جلب قائمة الطابعات من QZ Tray:', err);
    return [];
  }
}

// ============================================================
// ⚙️ إعدادات الطباعة المتقدمة — لكل جهاز على حدة
// ============================================================
// ليه لكل جهاز مش لكل مستخدم؟ لأن الطابعة متوصلة **بكمبيوتر**، مش بشخص.
// لو خزّناها على الحساب، نفس الشخص لما يفتح من كمبيوتر تاني هيلاقي إعدادات
// طابعة مش موجودة عنده. (نفس سبب تخزين اختيار الطابعة نفسه محليًا.)
//
// ⚠️ كلهم **مقفولين افتراضيًا**، يعني السلوك زي ما هو بالظبط. ده مقصود:
// اتلسعنا مرتين لما غيّرنا في الطباعة بناءً على حساب نظري والنتيجة على
// الورق طلعت أسوأ. المفاتيح دي طريقة نجرّب بيها **واحد واحد على طابعة
// حقيقية** ونعرف أنهي واحد ظبّط — بدل ما نغيّر كله ونخمّن.
// ============================================================
// ⭐⭐ سبب "الكتابة منغمشة" — اتلقى بالقياس في v0.35
// ============================================================
// QZ Tray افتراضيًا بيعمل scaleContent: true — يعني **بيعيد تحجيم صورتنا**
// عشان "تملا الصفحة". وإحنا أصلاً بنرسم الملصق بمقاس نقط الطابعة بالظبط
// (304×200 نقطة لـ38×25 مم)، فمش محتاجين أي تحجيم.
//
// وإعادة التحجيم بتنعّم الحواف، والتنعيم بيطلّع **رمادي**. القياس على
// ملصق حقيقي:
//
//   صورتنا زي ما هي        →  0 نقطة رمادية
//   بعد تحجيم QZ           →  5752 نقطة رمادية (والحبر الأسود 6462)
//
// يعني تقريبًا **نص نقط الحبر بقت رمادية**. والطابعة الحرارية أبيض/أسود
// بس — مفيش عندها رمادي. فكل نقطة رمادية بتتحوّل يا سودا يا بيضا حسب
// مكانها، والنتيجة حروف مكسّرة ومهرّية. ده بالظبط اللي المستخدم بيسميه
// "منغمشة".
//
// 📌 وده كمان بيفسّر ليه تنزيل الحرارة على الماكينة **مانفعش**: التلف
// بيحصل في الصورة **قبل** ما توصل للطابعة أصلًا.
//
// ⚠️ عشان كده المفتاحين دول **مفتوحين افتراضيًا** (defaultOn). لو حصلت
// مشكلة على طابعة معيّنة، تتقفل من شاشة إعدادات الطابعة — بس متتقفلش
// من غير سبب.
const PRINT_TWEAKS = [
  {
    key: 'noScale',
    label: 'ماتكبّرش المحتوى ليملا الصفحة',
    hint: 'مفتوح افتراضيًا — إقفاله بيرجّع الحروف مهرّية',
    defaultOn: true,
    apply: (cfg) => (cfg.scaleContent = false),
  },
  {
    key: 'blackwhite',
    label: 'أبيض وأسود صريح',
    hint: 'الطابعة الحرارية أبيض/أسود بس — التدرّج الرمادي بيطلع باهت ومنقّط',
    apply: (cfg) => (cfg.colorType = 'blackwhite'),
  },
  {
    key: 'sharp',
    label: 'حواف حادة',
    hint: 'مفتوح افتراضيًا — شبكة أمان لو حصل تحجيم لأي سبب',
    defaultOn: true,
    apply: (cfg) => (cfg.interpolation = 'nearest-neighbor'),
  },
  {
    key: 'rasterize',
    label: 'حوّل لصورة قبل الإرسال',
    hint: 'بيرسم الملصق كصورة جاهزة بدل ما التعريف يتصرّف فيه',
    apply: (cfg) => (cfg.rasterize = true),
  },
  {
    // ⭐ مفتوح افتراضيًا عشان تجرّبه — وقفله بيرجّع شكل الملصق زي
    // v0.45.2 بالظبط، فورًا ومن غير أي تحديث.
    key: 'tightQuarter',
    label: '🔤 "مقسوم ٤": كبّر اسم الصنف',
    hint:
      'بيقرّب رقم الباركود من السعر شوية ويسمح لاسم الصنف ينزل ٣ سطور — ' +
      'فالاسم بيكبر حوالي 11% في الأسماء اللي بتتقسم وحش. ' +
      'اقفله لو لقيت الرقم والسعر قربوا من بعض أوي على الورق، والملصق ' +
      'هيرجع زي ما كان بالظبط.',
    defaultOn: true,
    apply: () => {},
  },
  {
    // ⚡ المسار السريع — الشرح الكامل عند useCopies في tryPrintViaQZ.
    // مطفي افتراضيًا عن قصد: محتاج تجربة على ورق حقيقي قبل ما يبقى أساسي.
    key: 'fastCopies',
    label: '⚡ اطبع العدد كـ"نسخ" (أسرع بكتير — جرّبها على ورق)',
    hint:
      'دلوقتي الملصق بيتبعت للطابعة **مكرّر** بعدد اللي طلبته: 40 ملصق = ' +
      'نفس الملصق 40 مرة على الشبكة. المفتاح ده بيبعته **مرة واحدة** ويقول ' +
      'للطابعة اطبعه 20 مرة — أخف بحوالي 20 ضعف وأسرع بكتير. ' +
      'مطفي افتراضيًا لأن الطريقة دي فشلت على طابعتنا قبل كده (بشكل تاني)، ' +
      'فجرّبها على 20 ملصق الأول: لو خرجوا كلهم صح، سيبها مفتوحة.',
    apply: () => {},
  },
  {
    // ============================================================
    // 🧪 ورقة التزويد كصورة — مقفول افتراضيًا، محتاج تجربة على ورق
    // ============================================================
    // المشكلة اللي بيحاول يحلها: الورقة الأطول من فورم التعريف (297مم)
    // **بتتصغّر** عشان تدخل فيه. القياس: ورقة 324.1مم اتطبع منها 294.4
    // بس — آخر صف كامل قبل 297. وبعت المقاس لـQZ **مجرّب وفشل**: نفس
    // الورقة اتبعتت بطولين مختلفين واتقصّت في نفس الصف بالظبط.
    //
    // اللي اتغيّر: QZ Tray 2.2.6 (أبريل 2026) ضاف `size.custom` — بيشيل
    // حد المساحة المطبوعة ويلغي التحقق من الصفحة، فالمقاس بيعدّي حتى لو
    // مش موجود في التعريف. اتعمل ردًا على شكوى #1413 (نفس مشكلتنا).
    //
    // ⚠️⚠️ بس التعديل ده اتعمل في PrintImage.java **بس** — يعني بيشتغل
    // مع **الصور** مش HTML. عشان كده الورقة لازم تترسم صورة الأول.
    //
    // ⚠️ والصورة لازم تتحفظ بعمق **1 بت**. القياس (ورقة 245 درجة):
    //     canvas.toDataURL العادي (32 بت) → 154 كيلو ← فوق حد الرسالة
    //     PNG بعمق 1 بت                    →  22 كيلو ← أصغر من الـHTML
    // الفرق مش تحسين — هو الفرق بين إنها تشتغل وإنها **تتضاع في صمت**.
    //
    // مقفول افتراضيًا: `custom` لسه ماتجرّبتش على طابعة المحل.
    key: 'sheetImage',
    label: '🧪 ورقة التزويد كصورة بطولها الكامل (تجريبي)',
    hint:
      'الورقة الطويلة دلوقتي بتتصغّر عشان تدخل في مقاس التعريف. المفتاح ده ' +
      'بيبعتها **صورة بطولها الحقيقي** فبتطلع بحجمها الكامل من غير تصغير. ' +
      'محتاج QZ Tray 2.2.6 أو أحدث على جهاز الطباعة. لو حصلت أي مشكلة ' +
      '(الرسم فشل أو الحجم كبير) بيرجع للطريقة القديمة **لوحده** ويطبع عادي. ' +
      'جرّبه على ورقة واحدة الأول.',
    apply: () => {},
  },
  {
    // ============================================================
    // 🧪 مقسوم ٤ كصورة — مفتاح مستقل عن الملصق العادي
    // ============================================================
    // ⚠️ ليه مفتاح لوحده: مقسوم ٤ كان مربوط بمفتاح "ابعت الملصق كنص"
    // بتاع **كل** الملصقات. يعني عشان تجرّبه كصورة، لازم تغيّر الملصق
    // العادي معاه — فمستحيل تجرّب واحد لوحده.
    //
    // ⚠️⚠️ والحكم القديم ("الصورة أهرى من النص") اتاخد في **v0.36**،
    // ومسار الصورة النضيف (تنعيم فائق + متوسط 9 عيّنات + عتبة 50٪)
    // اتبنى في **v0.38** — الإصدار اللي اسمه بالحرف "المسمّى المنغمش".
    // يعني الحكم اتاخد على نسخة **مابقتش موجودة**، ويستاهل يتعاد.
    key: 'quarterImage',
    label: '🧪 "مقسوم ٤" كصورة (تجريبي)',
    hint:
      'بيرسم مقسوم ٤ عندنا كصورة بدقة الطابعة بالظبط بدل ما محرّك الطباعة ' +
      'يرسم الحروف بنفسه (والتنعيم بتاعه هو اللي بيطلّع النغمشة). ' +
      'التصميم والخطوط والمقاسات زي ما هي بالحرف — اللي بيتغيّر مين بيرسم. ' +
      'الملصق العادي والمسمّى **مايتأثروش**. جرّبه على ملصق واحد وقارن.',
    apply: () => {},
  },
  {
    // 🧪 المسمّى كصورة — نفس الكلام بالظبط، بس لملصق الدرجة/المسمّى.
    // ⚠️ ده أهم واحد في التجربة: "المسمّى المنغمش" هو الشكوى الأصلية.
    key: 'gradeImage',
    label: '🧪 "المسمّى" كصورة (تجريبي)',
    hint:
      'نفس فكرة اللي فوق بس لملصق المسمّى/الدرجة. التصميم زي ما هو — ' +
      'اللي بيتغيّر إن الحروف بترتسم عندنا بدقة الطابعة بدل ما محرّك ' +
      'الطباعة يرسمها. مقسوم ٤ والملصق العادي مايتأثروش.',
    apply: () => {},
  },
  {
    // ⭐ مفتوح افتراضيًا من v0.36 بعد تجربة على ورق حقيقي.
    //
    // الملصق بيتبعت لـQZ كـ**نص HTML** فبيرسمه بمحرّكه على دقة الطابعة
    // مباشرة. الطريقة التانية (صورة مرسومة عندنا) اتجرّبت على نفس الورق
    // وطلعت أهرى — والمستخدم قارن الاتنين بنفسه.
    //
    // ⚠️ الملصق المقسوم أربعة **لسه بالصورة** — مافيش نسخة HTML منه.
    key: 'htmlLabels',
    label: '📝 ابعت الملصق كنص (الافتراضي)',
    hint: 'مجرّب على ورق وطالع حاد. اقفله لو عايز تجرّب طريقة الصورة',
    defaultOn: true,
    apply: () => {},
  },
];

const PRINT_TWEAK_PREFIX = 'tazweed_qz_tweak_';

function getPrintTweak(key) {
  // ⭐ استثناء الجهاز فوق العام، **مفتاح بمفتاح** (شوف readPrintObject).
  const tw = readPrintObject('tweaks');
  if (typeof tw[key] === 'boolean') return tw[key];
  // مفيش اختيار محفوظ → القيمة الافتراضية بتاعة المفتاح نفسه.
  const def = (PRINT_TWEAKS.find((t) => t.key === key) || {}).defaultOn === true;
  try {
    const local = localStorage.getItem(PRINT_TWEAK_PREFIX + key);
    if (local === '1') return true;
    if (local === '0') return false;
  } catch (err) {
    /* تجاهل */
  }
  return def;
}

function setPrintTweak(key, on) {
  try {
    // ⚠️ بنكتب '0' للمقفول مش بنمسح المفتاح. المسح معناه "مفيش اختيار"،
    // واللي بيرجّع القيمة الافتراضية — يعني المفتاح اللي افتراضيه مفتوح
    // كان هيرجع يشتغل بعد ما المستخدم يقفله.
    localStorage.setItem(PRINT_TWEAK_PREFIX + key, on ? '1' : '0');
  } catch (err) {
    console.warn('تعذّر حفظ إعداد الطباعة:', err);
  }
  try {
    const shared = getSharedPrintSettings() || {};
    fireWrite(saveSharedPrintSettings({ tweaks: { ...(shared.tweaks || {}), [key]: !!on } }), 'إعدادات الطباعة');
  } catch (err) {
    console.warn('تعذّر حفظ الإعداد المشترك:', err);
  }
}

// كل المفاتيح كقايمة { المفتاح: مفتوح؟ } — بتستخدم في النسخ بين الأجهزة.
function getPrintTweaksMap() {
  const map = {};
  PRINT_TWEAKS.forEach((t) => (map[t.key] = getPrintTweak(t.key)));
  return map;
}

// ⚠️ بتكتب **كل** المفاتيح، مش المفتوحة بس. لو كتبنا المفتوحة بس، الجهاز
// اللي عليه مفتاح مفتوح غلط هيفضل مفتوح بعد النسخ — والمفروض النسخ يخلّي
// الجهازين متطابقين، مش يزوّد على القديم.
function setPrintTweaksMap(map) {
  if (!map || typeof map !== 'object') return;
  PRINT_TWEAKS.forEach((t) => setPrintTweak(t.key, map[t.key] === true));
}

// بتضيف على إعداد QZ المفاتيح المفتوحة على الجهاز ده بس.
function applyPrintTweaks(config) {
  PRINT_TWEAKS.forEach((t) => {
    if (getPrintTweak(t.key)) t.apply(config);
  });
  return config;
}

// ============================================================
// 📐 ضبط مكان الطباعة — الإطار
// ============================================================
// المشكلة اللي بيحلها ده: الطابعة الحرارية مابتبدأش الطباعة من حرف الملصق
// بالظبط. فيه فرق بسيط بين **أول نقطة الطابعة بتطبعها** و**أول نقطة في
// الملصق الحقيقي**، والفرق ده بيختلف من طابعة لطابعة ومن رول لرول (حسب
// شد الورق وحسّاس الفراغ). النتيجة: الملصق مزحلق شوية يمين أو تحت، وحتة
// منه بتتقص.
//
// مفيش طريقة نحسب بيها الفرق ده — لازم **نشوفه**. فبنطبع إطار مقاسه مقاس
// الملصق بالظبط، وبنبص: الإطار طالع جوه حدود الملصق ولا بره؟ من أنهي ناحية؟
// وبعدين نزحلق بالمقدار ده بالعكس.
//
// ⚠️ افتراضيًا كله أصفار → **مفيش أي CSS بيتضاف خالص**، فالطباعة بتطلع
// نفس البايتات اللي كانت بتطلع قبل الميزة دي. ده مقصود: أي حاجة بنضيفها
// على الطباعة لازم يكون ليها وضع "مطفي تمامًا".
// ============================================================
// ☁️ إعدادات الطباعة المشتركة — مرة واحدة لكل الأجهزة
// ============================================================
// ⚠️ ده تغيير في الفلسفة، اتطلب صراحة:
//
//   "مش عاوز اقعد اعدل في اعدادات الطباعة لكل جهاز. لو في اعدادات بخصوص
//    طباعة الملصق تبقي علي كل الاجهزة مرة واحده بمجرد تحديث النظام."
//
// قبل كده ضبط الملصق كان محفوظ **على كل جهاز لوحده**، فكان لازم تظبطه
// على كل كمبيوتر بإيدك. دلوقتي بيتحفظ في السحابة، وكل جهاز بياخده لوحده
// أول ما يفتح.
//
// **اسم الطابعة بيفضل على الجهاز** — وده الصح: كل كمبيوتر ليه طابعته.
// اللي بقى مشترك هو **شكل الملصق** بس.
//
// ولو النت مقطوع، الجهاز بيشتغل بآخر نسخة محفوظة عنده.
const SHARED_PRINT_DOC = 'print';

let sharedPrintSettings = null;

let unsubPrintSettings = null;

function subscribePrintSettings() {
  if (unsubPrintSettings) unsubPrintSettings();
  try {
    unsubPrintSettings = db
      .collection('settings')
      .doc(SHARED_PRINT_DOC)
      .onSnapshot(
        (snap) => {
          sharedPrintSettings = snap.exists ? snap.data() || {} : {};
          try {
            localStorage.setItem('tazweed_shared_print', JSON.stringify(sharedPrintSettings));
          } catch (err) {
            /* التخزين المحلي ممكن يكون مقفول — مش مشكلة */
          }
        },
        (err) => console.warn('تعذّر قراءة إعدادات الطباعة المشتركة:', err)
      );
  } catch (err) {
    console.warn('تعذّر الاشتراك في إعدادات الطباعة المشتركة:', err);
  }
}

function getSharedPrintSettings() {
  if (sharedPrintSettings) return sharedPrintSettings;
  try {
    const raw = localStorage.getItem('tazweed_shared_print');
    if (raw) return JSON.parse(raw);
  } catch (err) {
    /* تجاهل */
  }
  return null;
}

async function saveSharedPrintSettings(patch) {
  const next = { ...(getSharedPrintSettings() || {}), ...patch };
  sharedPrintSettings = next;
  try {
    localStorage.setItem('tazweed_shared_print', JSON.stringify(next));
  } catch (err) {
    /* تجاهل */
  }
  return db
    .collection('settings')
    .doc(SHARED_PRINT_DOC)
    .set({ ...next, updatedByUid: state.user ? state.user.uid : '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

const PRINT_ALIGN_KEY = 'tazweed_print_align';

const PRINT_ALIGN_LIMIT_MM = 6; // أكتر من كده يبقى مقاس الملصق نفسه غلط، مش زحلقة

const PRINT_SHRINK_LIMIT = 20; // %

function getPrintAlign() {
  const empty = { x: 0, y: 0, shrink: 0 };
  // ⭐ استثناء الجهاز فوق العام، **حقل بحقل** (شوف readPrintObject).
  const a = readPrintObject('align');
  if (a && Object.keys(a).length) {
    return {
      x: clampNum(a.x, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      y: clampNum(a.y, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      shrink: clampNum(a.shrink, 0, PRINT_SHRINK_LIMIT),
    };
  }
  // مفيش مشترك لسه → نستخدم اللي متحفّظ على الجهاز (الحسابات القديمة).
  try {
    const raw = localStorage.getItem(PRINT_ALIGN_KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw);
    return {
      x: clampNum(v.x, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      y: clampNum(v.y, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      shrink: clampNum(v.shrink, 0, PRINT_SHRINK_LIMIT),
    };
  } catch (err) {
    return empty;
  }
}

function savePrintAlign(align) {
  try {
    const clean = {
      x: clampNum(align.x, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      y: clampNum(align.y, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      shrink: clampNum(align.shrink, 0, PRINT_SHRINK_LIMIT),
    };
    if (!clean.x && !clean.y && !clean.shrink) localStorage.removeItem(PRINT_ALIGN_KEY);
    else localStorage.setItem(PRINT_ALIGN_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('تعذّر حفظ ضبط مكان الطباعة:', err);
  }

  // ⭐ والأهم: بيتحفظ في السحابة كمان، فكل الأجهزة بتاخده لوحدها.
  try {
    fireWrite(saveSharedPrintSettings({ align: { x: clampNum(align.x, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM), y: clampNum(align.y, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM), shrink: clampNum(align.shrink, 0, PRINT_SHRINK_LIMIT) } }), 'ضبط مكان الطباعة');
  } catch (err) {
    console.warn('تعذّر حفظ الضبط المشترك:', err);
  }
}

function clampNum(v, min, max) {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

// بترجّع سطر CSS يتحطّ جوه قاعدة .label — أو **نص فاضي** لو مفيش ضبط.
// النص الفاضي هو الحالة الافتراضية، وبيضمن إن الملف المطبوع مايتغيّرش.
//
// ليه transform مش margin؟ لأن الـmargin بيزق المحتوى وبيصغّر المساحة
// المتاحة، فالخطوط والباركود بيتحسبوا من أول وجديد. الـtransform بيحرّك
// الصورة النهائية زي ما هي — نفس المقاسات بالظبط، مكان مختلف بس.
function printAlignCSS() {
  const a = getPrintAlign();
  if (!a.x && !a.y && !a.shrink) return '';
  const parts = [];
  if (a.x || a.y) parts.push(`translate(${a.x}mm, ${a.y}mm)`);
  if (a.shrink) parts.push(`scale(${((100 - a.shrink) / 100).toFixed(3)})`);
  return `transform: ${parts.join(' ')}; transform-origin: center center;`;
}

// ------------------------------------------------------------
// إطار التجربة
// ------------------------------------------------------------
// ملصق فيه إطار بمقاس الملصق بالظبط + علامات في الأركان + صليب في النص
// + الأرقام الحالية مكتوبة. الهدف إنك تمسك الملصق المطبوع في إيدك وتقارن.
function buildFrameHTML(pageWidthMm, pageHeightMm) {
  const a = getPrintAlign();
  const align = printAlignCSS();
  const tick = Math.min(4, pageWidthMm / 6); // طول علامة الركن
  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>إطار تجربة</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; width: ${pageWidthMm}mm; color: #000; }
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; ${align} }
        .frame {
          position: relative;
          width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;
          border: 0.3mm solid #000;
        }
        /* علامات الأركان: أسمك من الإطار عشان تبان حتى لو الحرف اتقص */
        .c { position: absolute; background: #000; }
        .ch { width: ${tick}mm; height: 0.7mm; }
        .cv { width: 0.7mm; height: ${tick}mm; }
        /* صليب صغير في المركز — ذراعه قصيرة عشان مايتلخبطش مع الكلام */
        .mh { position: absolute; top: 50%; left: 50%; width: 6mm; margin-left: -3mm; height: 0.25mm; background: #000; }
        .mv { position: absolute; left: 50%; top: 50%; height: 6mm; margin-top: -3mm; width: 0.25mm; background: #000; }
        /* الكلام فوق الصليب وتحته، مش عليه */
        .sz, .txt {
          position: absolute; left: 0; right: 0; text-align: center;
          font-size: 2.4mm; font-weight: bold; white-space: nowrap;
        }
        .sz { top: 2.2mm; }
        .txt { bottom: 2.2mm; }
      </style>
    </head>
    <body>
      <div class="label"><div class="frame">
        <div class="c ch" style="top:0; left:0;"></div>
        <div class="c cv" style="top:0; left:0;"></div>
        <div class="c ch" style="top:0; right:0;"></div>
        <div class="c cv" style="top:0; right:0;"></div>
        <div class="c ch" style="bottom:0; left:0;"></div>
        <div class="c cv" style="bottom:0; left:0;"></div>
        <div class="c ch" style="bottom:0; right:0;"></div>
        <div class="c cv" style="bottom:0; right:0;"></div>
        <div class="mh"></div>
        <div class="mv"></div>
        <div class="sz">${pageWidthMm} x ${pageHeightMm} mm</div>
        <div class="txt">X ${a.x} / Y ${a.y} / -${a.shrink}%</div>
      </div></div>
    </body>
    </html>
  `;
}

// بتطبع إطار التجربة على طابعة الملصق — من غير معاينة، لأن المعاينة على
// الشاشة مالهاش أي قيمة هنا: الحاجة الوحيدة اللي تفرق هي الورق نفسه.
async function printTestFrame(pageWidthMm, pageHeightMm) {
  const html = buildFrameHTML(pageWidthMm, pageHeightMm);
  const sizeOptions = { pageWidthMm, pageHeightMm, halves: 1 };
  const viaQZ = await tryPrintViaQZ('label', [{ html, copies: 1 }], sizeOptions);
  if (viaQZ) return true;

  // مفيش QZ → نافذة المتصفح. مش مثالي (الويندوز بيتصرّف في المقاس)، بس
  // الإطار لسه بيوري الاتجاه: طالع يمين ولا شمال، فوق ولا تحت.
  const win = window.open('', '_blank', 'width=420,height=320');
  if (!win) {
    alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return false;
  }
  win.document.write(html);
  win.document.close();
  return false;
}

// ============================================================
// 🎯 معايرة الطابعة — أوامر خام مباشرة للطابعة
// ============================================================
// دي **مش** بتغيّر أي حاجة في الويندوز. بتتكلم مع الطابعة نفسها بلغتها
// (TSPL — اللي طابعات Xprinter وTSC بتفهمها) وبتقولها:
//
//   SIZE / GAP  → مقاس الملصق والمسافة بينه وبين اللي بعده
//   GAPDETECT   → قيس الفراغ بنفسك واحفظه
//
// GAPDETECT هي بالظبط اللي بتحصل لما تقفل الطابعة وتضغط FEED وتشغّلها —
// بس من غير ما تلمس الجهاز. والنتيجة **بتتخزّن في ذاكرة الطابعة**، فبتفضل
// حتى لو فصلت الكهربا. يعني مرة واحدة لكل طابعة.
//
// ⚠️ حاجتين لازم يبقوا واضحين للمستخدم قبل ما يضغط:
//   • بتستهلك 2-3 ملصقات وهي بتقيس
//   • لو الطابعة مش من النوع ده، ممكن تطلع ورقة فيها كلام — مش مشكلة،
//     بس المعايرة مش هتشتغل
async function calibratePrinter(printerName, widthMm, heightMm, gapMm) {
  if (!printerName) return false;
  if (!(await ensureQZConnected())) return false;

  const cmds = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    `GAP ${gapMm} mm,0 mm`,
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CLS',
    'GAPDETECT',
    '',
  ].join('\r\n');

  const config = qz.configs.create(printerName);
  await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: cmds }]);
  return true;
}

// ============================================================
// 🧪 عيّنة خطوط الطابعة — الطريقة الاحترافية
// ============================================================
// إحنا دلوقتي بنرسم الملصق كصورة ونبعتها. ده حلّ مشكلة "الشكل بيختلف من
// جهاز لجهاز"، بس فضلت مشكلة إن **خطوط المتصفح مصمّمة للشاشة** — وإحنا
// بنطبع على 203 نقطة/بوصة أبيض وأسود من غير أي تدرّج.
//
// الطريقة اللي البرامج الاحترافية بتشتغل بيها (BarTender / NiceLabel /
// برامج Zebra و TSC) مختلفة تمامًا: **مابتبعتش صورة أصلًا**. بتبعت أوامر
// للطابعة، والطابعة بترسم بخطوطها المحفوظة في ذاكرتها:
//
//   TEXT x,y,"3",0,1,1,"Hejap Kuwaiti"   ← الطابعة بترسم النص بخطها
//   QRCODE x,y,M,4,A,0,"10632103"        ← الطابعة بتولّد الباركود بنفسها
//
// ليه ده أحسن؟ لأن خطوط الطابعة **مرسومة أصلًا نقطة نقطة** لدقة 203،
// فمفيش تنعيم ولا تقريب ولا عتبة أبيض/أسود. الحرف بيطلع زي ما هو متصمّم.
//
// ⚠️ وليه مش عملناها من الأول؟ لحاجتين:
//   1) خطوط الطابعة الداخلية **إنجليزي بس** — العربي مش موجود فيها.
//      (أسماء الأصناف عندنا إنجليزي، فدي مش مشكلة للملصق. لكن ملصق الدرجة
//       عربي، وهيفضل صورة.)
//   2) مش كل طابعة عندها نفس الخطوط. الأرقام تحت هي المعيار، بس اللي
//      بيحسم فعلًا هو **ورقة مطبوعة من الطابعة اللي في المحل**.
//
// عشان كده الدالة دي بتطبع **ورقة عيّنة**: نفس الاسم بكل خط متاح ومكتوب
// جنبه اسمه. تطبعها مرة، تبص، وتقولنا أنهي واحد أوضح — وساعتها نبني عليه
// بدل ما نخمّن.
function buildTSPLFontSample(widthMm, heightMm, sampleText, sampleCode) {
  const txt = String(sampleText || 'Hejap Kuwaiti 120').replace(/["\\]/g, '');
  const code = String(sampleCode || '10632103').replace(/["\\]/g, '');
  return [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CLS',
    // كل سطر: اسم الخط + نفس النص بيه
    `TEXT 8,4,"1",0,1,1,"F1 ${txt}"`,
    `TEXT 8,22,"2",0,1,1,"F2 ${txt}"`,
    `TEXT 8,46,"3",0,1,1,"F3 ${txt}"`,
    `TEXT 8,74,"2",0,2,2,"F2x2 ${txt.slice(0, 10)}"`,
    // الباركود من توليد الطابعة نفسها، 4 نقط للمربع زي اللي بنعمله
    `QRCODE 8,120,M,4,A,0,"${code}"`,
    `TEXT 108,124,"2",0,1,1,"QR min printer"`,
    `TEXT 108,148,"3",0,1,1,"${code}"`,
    'PRINT 1,1',
    '',
  ].join('\r\n');
}

// بتبعت العيّنة للطابعة. بترجّع true لو اتبعتت.
async function printTSPLFontSample(printerName, widthMm, heightMm, sampleText, sampleCode) {
  if (!printerName) return false;
  if (!(await ensureQZConnected())) return false;
  const config = qz.configs.create(printerName);
  await qz.print(config, [
    {
      type: 'raw',
      format: 'command',
      flavor: 'plain',
      data: buildTSPLFontSample(widthMm, heightMm, sampleText, sampleCode),
    },
  ]);
  return true;
}

// ============================================================
// 🔥 جودة الطباعة — السرعة والحرارة
// ============================================================
// ⚠️ دول أهم حاجتين في حدة الطباعة الحرارية، ومالمسناهمش خالص طول الوقت
// اللي فات وإحنا بنلف حوالين شكل الخط.
//
// **إزاي الطابعة الحرارية بتشتغل؟** فيها صف من نقط بتسخن، والورق بيتفاعل
// مع الحرارة فيسوَدّ. يعني اللي بيحدّد شكل الحرف هو **قد إيه النقطة سخنت
// وقد إيه الورق قعد قدامها**.
//
//   السرعة (SPEED): الورق ماشي بسرعة قد إيه.
//     • سريع  → النقطة مابتاخدش وقتها، الحرف بيطلع باهت ومتقطّع
//     • بطيء  → الحرارة توصل كاملة، الحرف بيطلع كامل وحاد
//     ⭐ تقليل السرعة أشهر طريقة لتحسين حدة الطباعة الحرارية.
//
//   الحرارة (DENSITY): النقطة بتسخن قد إيه.
//     • واطية  → باهت
//     • عالية  → الحرارة بتتفرد على الورق حوالين النقطة، والحروف
//                **بتلتحم في بعض** — وده بالظبط اللي المستخدم بيسمّيه
//                "الكتابة منغمشة"
//
// يعني "المنغمشة" ممكن تكون **الحرارة عالية** مش الخط غلط. وإحنا كنا
// بنلعب في الخط طول الوقت.
//
// ⚠️ الأوامر دي بتروح **للطابعة نفسها** وبتتخزّن في ذاكرتها — زي المعايرة
// بالظبط. مش إعداد ويندوز ولا حاجة في النظام.
// سرعة الطابعة بالملّي ثانية للملصق — قابلة للضبط لأن كل ماكينة ليها
// سرعتها. صفر = من غير انتظار (السلوك القديم اللي كان بيضيّع الطبعات).
const PRINT_PACE_KEY = 'tazweed_print_pace_ms';

function getPrintPaceMs() {
  const remote = readPrintField('pace');
  if (remote !== undefined) {
    const n = Number(remote);
    if (isFinite(n) && n >= 0) return Math.min(3000, n);
  }
  try {
    const v = localStorage.getItem(PRINT_PACE_KEY);
    if (v === null || v === '') return PRINT_PACE_MS_PER_LABEL;
    const n = Number(v);
    return isFinite(n) && n >= 0 ? Math.min(3000, n) : PRINT_PACE_MS_PER_LABEL;
  } catch (err) {
    return PRINT_PACE_MS_PER_LABEL;
  }
}

// ============================================================
// ⭐ عدد الدفعة والتداخل — أرقام المستخدم بيظبطها عند الماكينة
// ============================================================
// ليه دول إعدادات مش أرقام ثابتة في الكود؟ لأن **مافيش طريقة نعرف بيها من
// هنا** الماكينة هتستحمل كام. جرّبنا نخمّن أكتر من مرة:
//
//   v0.44: 8 صفحات في الوظيفة  →  اتغيّر للحجم
//   v0.45.0: 20 نسخة            →  اشتغلت
//   v0.45.1: 25 نسخة + تداخل 70٪ →  المستخدم رفضها
//   v0.45.2: رجعنا 20            →  زي ما كانت
//
// اللي واقف قدام الماكينة هو الوحيد اللي يقدر يجاوب. فبدل ما نفضل نغيّر
// أرقام ونشحن، بقت خانة بيلفّها ويشوف بعينه.
//
// ⚠️⚠️ **بس حد الحجم مايتكسرش.** لو المستخدم كتب 40 وهو بيطبع ملصق
// بباركود (9.7 كيلو)، الرسالة تبقى 390 كيلو وتتضاع **في سكوت** — نفس
// العطل اللي "بياخد الأمر ومفيش حاجة بتتطبع". الرقم بتاعه **سقف**،
// والحجم بيقفل قبله لو لزم.
const PRINT_BATCH_KEY = 'tazweed_print_batch';
const PRINT_LEAD_KEY = 'tazweed_print_lead';
const PRINT_BATCH_DEFAULT = 20;
const PRINT_BATCH_MAX = 200;
// صفر = استنى الدفعة تخلص بالكامل (السلوك اللي المستخدم جرّبه ورضي عنه)
const PRINT_LEAD_DEFAULT = 0;

function getPrintBatchSize() {
  const remote = readPrintField('batch');
  if (remote !== undefined) {
    const n = parseInt(remote, 10);
    if (isFinite(n) && n >= 1) return Math.min(PRINT_BATCH_MAX, n);
  }
  try {
    const v = localStorage.getItem(PRINT_BATCH_KEY);
    if (v === null || v === '') return PRINT_BATCH_DEFAULT;
    const n = parseInt(v, 10);
    return isFinite(n) && n >= 1 ? Math.min(PRINT_BATCH_MAX, n) : PRINT_BATCH_DEFAULT;
  } catch (err) {
    return PRINT_BATCH_DEFAULT;
  }
}

function setPrintBatchSize(n) {
  try {
    localStorage.setItem(PRINT_BATCH_KEY, String(Math.max(1, Math.min(PRINT_BATCH_MAX, parseInt(n, 10) || PRINT_BATCH_DEFAULT))));
  } catch (err) {
    /* لا شيء */
  }
}

// "ابعت اللي بعدها وفاضل كام ملصق". الرقم ده **ثابت** مش نسبة مئوية عن
// قصد: النسبة معناها يختلف مع حجم الدفعة (70٪ من 4 = ملصق، ومن 40 = 12)،
// والرقم الثابت معناه واحد في كل الحالات.
function getPrintLeadLabels() {
  const remote = readPrintField('lead');
  if (remote !== undefined) {
    const n = parseInt(remote, 10);
    if (isFinite(n) && n >= 0) return Math.min(50, n);
  }
  try {
    const v = localStorage.getItem(PRINT_LEAD_KEY);
    if (v === null || v === '') return PRINT_LEAD_DEFAULT;
    const n = parseInt(v, 10);
    return isFinite(n) && n >= 0 ? Math.min(50, n) : PRINT_LEAD_DEFAULT;
  } catch (err) {
    return PRINT_LEAD_DEFAULT;
  }
}

function setPrintLeadLabels(n) {
  try {
    localStorage.setItem(PRINT_LEAD_KEY, String(Math.max(0, Math.min(50, parseInt(n, 10) || 0))));
  } catch (err) {
    /* لا شيء */
  }
}

function setPrintPaceMs(ms) {
  try {
    localStorage.setItem(PRINT_PACE_KEY, String(Math.max(0, Math.min(3000, Number(ms) || 0))));
  } catch (err) {
    /* لا شيء */
  }
}

const PRINT_SPEED_DEFAULT = 3;    // بوصة/ثانية

const PRINT_DENSITY_DEFAULT = 8;  // من 0 لـ15

function getPrintQuality() {
  const shared = getSharedPrintSettings();
  const q = (shared && shared.quality) || {};
  const speed = Number(q.speed);
  const density = Number(q.density);
  return {
    speed: isFinite(speed) && speed > 0 ? Math.min(8, Math.max(1, speed)) : PRINT_SPEED_DEFAULT,
    density: isFinite(density) ? Math.min(15, Math.max(0, Math.round(density))) : PRINT_DENSITY_DEFAULT,
    set: !!(q && (q.speed || q.density === 0 || q.density)),
  };
}

// بتبعت السرعة والحرارة للطابعة وبتحفظهم في الإعدادات المشتركة كمان،
// عشان لو ركّبت الطابعة على كمبيوتر تاني تعرف تبعتلها نفس القيم.
async function applyPrintQuality(printerName, speed, density) {
  if (!printerName) return false;
  if (!(await ensureQZConnected())) return false;

  const sp = Math.min(8, Math.max(1, Number(speed) || PRINT_SPEED_DEFAULT));
  const dn = Math.min(15, Math.max(0, Math.round(Number(density))));
  const cmds = [`SPEED ${sp}`, `DENSITY ${dn}`, ''].join('\r\n');

  const config = qz.configs.create(printerName);
  await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: cmds }]);

  try {
    fireWrite(saveSharedPrintSettings({ quality: { speed: sp, density: dn } }), 'جودة الطباعة');
  } catch (err) {
    console.warn('تعذّر حفظ جودة الطباعة:', err);
  }
  return true;
}

function getSavedPrinter(type) {
  const key = type === 'label' ? QZ_LABEL_PRINTER_KEY : QZ_RESTOCK_PRINTER_KEY;
  try {
    return localStorage.getItem(key) || '';
  } catch (err) {
    return '';
  }
}

function saveSelectedPrinter(type, printerName) {
  const key = type === 'label' ? QZ_LABEL_PRINTER_KEY : QZ_RESTOCK_PRINTER_KEY;
  try {
    localStorage.setItem(key, printerName);
  } catch (err) {
    console.error('تعذّر حفظ اختيار الطابعة محليًا:', err);
  }
}

// بتحوّل أي شكل من أشكال محتوى الطباعة لقايمة موحّدة [{ html: نص, copies: رقم }].
// بتقبل: نص واحد، مصفوفة نصوص (شكل نسخة قديمة)، مصفوفة كائنات { html, copies }.
// وبترمي أي عنصر مش نص — عشان مستحيل يوصل لـQZ حاجة تتطبع كنص خام.
function normalizePrintJobs(input) {
  const raw = Array.isArray(input) ? input : [input];
  const out = [];
  raw.forEach((item) => {
    if (typeof item === 'string') {
      out.push({ html: item, copies: 1 });
      return;
    }
    if (item && typeof item.html === 'string') {
      const copies = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(item.copies, 10) || 1));
      // image = ملصق مرسوم عندنا كصورة جاهزة. بيتبعت لـQZ زي ما هو،
      // فالمحرك التاني مابقاش ليه أي دور في شكل الملصق.
      const entry = { html: item.html, copies };
      if (typeof item.image === 'string' && item.image) entry.image = item.image;
      out.push(entry);
    }
  });
  return out;
}

// ============================================================
// PNG بعمق 1 بت — مكتوب بإيدنا عن قصد
// ============================================================
// ⚠️⚠️ `canvas.toDataURL()` بيطلّع PNG بـ32 بت **دايمًا** ومافيش خيار.
// وكل اللي إحنا بنطبعه (ورقة التزويد والملصقات) **لونين بس** — الطابعة
// الحرارية مفيهاش رمادي أصلًا. يعني بنحجز 32 خانة لحاجة محتاجة واحدة.
// القياسات الحقيقية:
//     ورقة تزويد 245 درجة   32بت: 154 كيلو  →  1بت:  22 كيلو
//     ملصق مقسوم أربعة       32بت:  10 كيلو  →  1بت: 0.9 كيلو  (٩١٪)
//     ملصق مسمّى             32بت: 6.1 كيلو  →  1بت: 1.3 كيلو  (٧٨٪)
//
// ⚠️ وده **مش تجميل**: حد رسالة QZ 48 كيلو، واللي بيعدّيه **بيتضاع في
// صمت**. للورقة ده الفرق بين إنها تشتغل وإنها تسكت. وللملصقات ده الفرق
// بين 4 ملصقات في الأمر الواحد وعشرات.
//
// ⚠️⚠️ والنقط **مابتتغيّرش ولا نقطة** — نفس الصورة بالظبط، متخزّنة صح بس.
// فيه فحص بيقارن الناتج بكسل ببكسل.
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

// ============================================================
// الملصق كصورة → إعادة ترميز بـ1 بت قبل ما يتبعت
// ============================================================
// ⚠️ ليه إعادة ترميز مش رسم من جديد: الملصق **مرسوم صح خلاص**. مسار
// shrinkToPrinterDots بيرسم بحجم أكبر ٣ مرات، وياخد متوسط ٩ عيّنات لكل
// نقطة طابعة، ويحط عتبة ٥٠٪ — والقياس بيقول **صفر نقطة رمادية**.
//
// يعني الصورة مثالية، والغلط الوحيد إنها بتتخزّن بـ32 بت. فإحنا بنعيد
// **التخزين** بس — التصميم والرسم والنقط زي ما هم بالحرف.
//
// ⚠️ وأي فشل هنا بيرجّع الصورة الأصلية زي ما هي. الملصق التقيل أحسن من
// ملصق مافيش.
async function imageJobTo1Bit(dataUrl) {
  try {
    if (typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/png;base64,') !== 0) return null;
    if (typeof canvasToPng1Bit !== 'function' || typeof CompressionStream !== 'function') return null;

    const img = new Image();
    const ok = await new Promise((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
      img.src = dataUrl;
    });
    if (!ok || !img.width || !img.height) return null;

    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const cx = cv.getContext('2d');
    if (!cx) return null;
    // ⚠️ خلفية بيضا الأول: الشفاف في PNG بيتقرا أسود من غيرها.
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(img, 0, 0);

    const b64 = await canvasToPng1Bit(cv);
    if (!b64) return null;
    const out = 'data:image/png;base64,' + b64;
    // مانرجعش نسخة أكبر من الأصل — لو حصل، الأصل أولى
    return out.length < dataUrl.length ? out : null;
  } catch (err) {
    console.warn('تعذّرت إعادة ترميز الملصق — هيتبعت زي ما هو:', err);
    return null;
  }
}

// بتعيد ترميز كل الصور في قايمة الوظايف. بترجّع قايمة جديدة أو null.
async function shrinkImageJobs(list) {
  if (!Array.isArray(list) || !list.length) return null;
  if (!list.some((j) => j && typeof j.image === 'string' && j.image)) return null;
  let changed = false;
  const out = [];
  for (const job of list) {
    if (job && typeof job.image === 'string' && job.image) {
      const small = await imageJobTo1Bit(job.image);
      if (small) { out.push({ ...job, image: small }); changed = true; continue; }
    }
    out.push(job);
  }
  return changed ? out : null;
}

// ============================================================
// 🧪 ورقة التزويد كصورة — القرار عند **الجهاز اللي بيطبع**
// ============================================================
// ⚠️⚠️ ده اتصلّح بعد تجربة حقيقية. أول نسخة كانت بتقرا المفتاح على
// الجهاز **الباعت** (جوه printRestockPaper) — والنتيجة إن:
//
//   الطباعة من الكمبيوتر اللي عليه الطابعة  → اشتغلت ✅
//   الطباعة من التليفون لنفس الكمبيوتر       → الورقة رجعت مصغّرة ❌
//
// السبب: الإعداد اتحط **استثناء للكمبيوتر**، والتليفون بيقرا استثناءه هو
// (مش موجود) فبيبعت HTML عادي — والكمبيوتر بيطبع اللي وصله.
//
// والقاعدة الصح: المفتاح ده بيخص **الطابعة**، مش اللي ضغط الزرار. الجهاز
// اللي عليه الطابعة هو اللي عارف نسخة QZ عنده وهو اللي إعداده يهم.
//
// tryPrintViaQZ هي **النقطة الوحيدة** اللي بيعدّي منها المسارين:
//   • محلي  → deliverPrint → tryPrintViaQZ
//   • بعيد  → executePrintJob → tryPrintViaQZ   (على الجهاز المستقبِل)
// فالقرار هنا بيغطي الاتنين بقاعدة واحدة.
//
// بترجّع { list, sizeOptions } — أو null لو مافيش تغيير.
async function maybeRasterizeSheet(type, list, sizeOptions) {
  if (type !== 'restock') return null;
  if (typeof getPrintTweak !== 'function' || !getPrintTweak('sheetImage')) return null;
  if (typeof renderSheetImage !== 'function') return null;
  // ورقة واحدة بس، ولسه نص (لو جاتلنا صورة يبقى حد رسمها قبلنا)
  if (!Array.isArray(list) || list.length !== 1) return null;
  if (!list[0] || list[0].image || typeof list[0].html !== 'string') return null;

  const shot = await renderSheetImage(list[0].html);
  // ⚠️ الحجم بيتفحص **قبل** الإرسال: الرسالة الأكبر من الحد بتتضاع في
  // صمت والطابعة "بتاخد الأمر ومفيش حاجة بتتطبع".
  const cap = typeof SHEET_IMG_MAX_BYTES === 'number' ? SHEET_IMG_MAX_BYTES : 44 * 1024;
  if (!shot || shot.bytes > cap) {
    // ⚠️ الرجوع للقديم **بيتقال** مش بيحصل في سكوت.
    showPrintNotice(
      shot
        ? `📄 الورقة كصورة طلعت كبيرة (${Math.round(shot.bytes / 1024)} كيلو) — اتطبعت بالطريقة العادية.`
        : '📄 مانفعش نرسم الورقة كصورة — اتطبعت بالطريقة العادية.'
    );
    return null;
  }

  // ⚠️ الـHTML لازم يفضل جنب الصورة: normalizePrintJobs بترمي أي وظيفة
  // مالهاش `html`. وpageOf بيفضّل الصورة، فاللي بيتبعت لـQZ هو الصورة بس.
  return {
    list: [{ ...list[0], image: shot.image }],
    sizeOptions: { ...(sizeOptions || {}), pageWidthMm: shot.widthMm, pageHeightMm: shot.heightMm, customSize: true },
  };
}

// بيرجع true لو نجحت الطباعة عبر QZ Tray، false لو محتاج نرجع للطريقة
// العادية (نافذة المتصفح / iframe).
// ============================================================
// ⭐⭐⭐ ورقة التزويد: **مابنبعتش مقاس**. ماترجّعش الفكرة دي تاني.
// ============================================================
// جرّبناها ورجعنا عنها بعد تلات طبعات على ورق حقيقي. الشرح هنا عشان
// حد ييجي بعدينا يقول "أمّال ما نقوله الطول الحقيقي؟" — الإجابة: جرّبنا.
//
// **الفكرة كانت**: الورقة الطويلة بتتزنق في فورم الطابعة (297مم)
// وتصغّر. طب نقوله الطول الحقيقي وخلاص؟
//
// **اللي حصل فعلًا (مقيس، مش تخمين):**
//
//   ١) بعتنا العرض 80 (عرض الورق) — بس رأس الطباعة بيغطي 72.1مم في
//      النص بس. فالورقة العربي اللي متلزقة ناحية اليمين وقع منها 3.85مم
//      برّه رأس الطباعة و**أرقام أول عمود اتاكلت**.       (v0.55.2)
//
//   ٢) ظبطنا العرض، فالورقة **اتقصّت من تحت**. الأرقام:
//        طول الورقة الكامل       = 324.1 مم
//        اللي بعتناه للطابعة     = 359   مم
//        اللي اتطبع فعلًا        = 294.4 مم ← آخر صف كامل قبل 297
//      ونفس الورقة اتطبعت مرتين بطولين مختلفين واتقصّت في **نفس الصف**.
//      يعني الطابعة أصلًا **مابتاخدش** الطول اللي بنبعتهولها. (v0.55.3)
//
// **الخلاصة**: بعت المقاس مابيدّيش ورقة أطول — هو بس **بيوقّف التصغير
// التلقائي** بتاع الدرايفر. فبدل ما الورقة تصغّر وتخلص كاملة، بتتقص.
//
// وصاحب النظام قرّر بنفسه: "نرجّع الطباعة زي الأول وانا استحمل التصغير
// عادي بمقاس واحد". فالورقة الطويلة بتصغّر — **وبتخرج كاملة**، وده
// اللي كان شغّال كويس من قبل v0.55.0.
//
// اللي عايز الحجم الكامل من غير تصغير: خيار "كل مجموعة في ورقة لوحدها"
// موجود في شاشة الطباعة، وكل مجموعة بتدخل في الفورم لوحدها.

async function tryPrintViaQZ(type, jobs, sizeOptions, onProgress) {
  setPrintOutcome(false, 'الطباعة ماوصلتش لآخرها.');
  const printerName = getSavedPrinter(type);
  if (!printerName) {
    setPrintOutcome(false, 'الجهاز ده مش مظبوط على طابعة.');
    return false;
  }

  const ok = await ensureQZConnected();
  if (!ok) {
    // ⚠️ الجهاز ده **مظبوط على طابعة**، يعني المستخدم مستني الملصق يخرج
    // منها. لو رجعنا false في صمت، هتتفتح نافذة طباعة المتصفح وهو مش
    // فاهم ليه — أو يقفلها ويفتكر إن الملصق راح للطابعة وهو مراحش.
    alert(
      '⚠️ الطباعة ماتمّتش — برنامج QZ Tray مش شغّال على الجهاز ده.\n\n' +
        'شغّله من قايمة "ابدأ" وحاول تاني.\n\n' +
        '(لو قفلت الرسالة، هتتفتح نافذة طباعة عادية بدل الطابعة المباشرة.)'
    );
    setPrintOutcome(false, 'برنامج QZ Tray مش شغّال على الجهاز اللي بيطبع.');
    return false;
  }

  try {
    // ⚠️ قاعدة ذهبية اتعلمناها من طباعتين غلط على التوالي:
    // الحاجة اللي بتتبعت لـQZ في خانة data **لازم تكون نص HTML وبس**.
    // لو بعتنا مصفوفة أو كائن بالغلط، QZ ما بيرفضش — بيحوّله لنص ويطبع
    // النص الخام على اللاصقة (زي [{"html":"\n \n...).
    //
    // عشان كده normalizePrintJobs بترجّع قايمة نضيفة، وتحت السطر ده فيه
    // فحص صارم: لو المحتوى مش نص، بنوقف الطباعة فورًا ونرجع false بدل ما
    // نطبع زبالة على ورق حقيقي.
    let list = normalizePrintJobs(jobs);
    // 🧪 المفتاح مقفول = السطرين دول بيعدّوا والباقي زي ما هو بالحرف.
    const rast = await maybeRasterizeSheet(type, list, sizeOptions);
    if (rast) { list = rast.list; sizeOptions = rast.sizeOptions; }

    // ⭐ أي صورة رايحة للطابعة بتتخزّن بـ1 بت بدل 32 — **نفس النقط
    // بالظبط**، حجم أقل بكتير. ده بيخلّي ملصقات أكتر تدخل في الأمر
    // الواحد بدل ما الحجم يوقفها عند 4.
    const smaller = await shrinkImageJobs(list);
    if (smaller) list = smaller;
    if (!list.length) {
      console.error('محتوى الطباعة غير صالح — مش هيتبعت لـQZ:', jobs);
      alert('⚠️ حصلت مشكلة في تجهيز الملصق، فالطباعة ماتمّتش.\n\nحدّث الصفحة وحاول تاني.');
      setPrintOutcome(false, 'محتوى الملصق وصل بايظ.');
      return true; // اتعامل معاها هنا — مش هنفتح نافذة متصفح بمحتوى بايظ
    }

    // ------------------------------------------------------------
    // ⚠️ نتأكد إن الطابعة المحفوظة **لسه موجودة** قبل ما نبعت
    // ------------------------------------------------------------
    // اسم الطابعة متحفّظ على الجهاز من أول مرة. لو اتفصلت أو اتطفت أو
    // اتغيّر اسمها في الويندوز، qz.print بيفشل — وقبل كده كنا بنرجع false
    // في صمت ونفتح نافذة طباعة المتصفح، فالمستخدم يفتكر إن الملصق راح
    // للطابعة وهو مراحش.
    //
    // الفحص ده بيدّي **سبب واضح** بدل الصمت.
    //
    // ⚠️ الفحص بيتخطّى لو النسخة دي من QZ مافيهاش printers.find. الفحص
    // ده **مساعد** — عمره ما يوقف طبعة كانت هتنجح.
    try {
      if (qz.printers && typeof qz.printers.find === 'function') {
        const found = await qz.printers.find(printerName);
        if (!found) throw new Error('مش موجودة');
      }
    } catch (errFind) {
      console.error('الطابعة المحفوظة مش موجودة:', printerName, errFind);
      alert(
        `⚠️ الطباعة ماتمّتش — الطابعة "${printerName}" مش لاقيها.\n\n` +
          'اتأكد إنها:\n' +
          '• مولّعة وموصولة بالجهاز\n' +
          '• وبرنامج QZ Tray شغّال\n\n' +
          'ولو غيّرت الطابعة، اختارها من ⚙️ إعدادات الطابعة.'
      );
      return true;
    }

    let size =
      sizeOptions && sizeOptions.pageWidthMm
        ? { width: sizeOptions.pageWidthMm, height: sizeOptions.pageHeightMm }
        : null;

    // ⭐ مقاس **برّه فورم التعريف** — QZ Tray 2.2.6+ (شوف مفتاح sheetImage).
    // بيشيل حد المساحة المطبوعة ويلغي التحقق من الصفحة، فالورقة الطويلة
    // بتعدّي بطولها بدل ما تتصغّر أو تتقص.
    //
    // ⚠️ بيشتغل مع **الصور بس** (اتعمل في PrintImage.java لوحده)، وQZ
    // الأقدم بيتجاهله في صمت — عشان كده اللي بيفتحه بيتأكد من النسخة.
    if (size && sizeOptions.customSize) size.custom = true;

    // نفس شكل الإعداد اللي كان شغال 100% في v0.17 — من غير أي خيارات
    // إضافية. العدد بنعمله بتكرار الطلب نفسه، مش بخيار في الإعداد، عشان
    // ما نعتمدش على سلوك مش متأكدين منه في نسخة QZ اللي على الجهاز.
    // الإعدادات الأساسية زي ما هي بالظبط، وفوقها المفاتيح المفتوحة على
    // الجهاز ده (كلهم مقفولين افتراضيًا فالسلوك مايتغيّرش).
    // ============================================================
    // ⛔⛔ إعداد الطباعة — **متزوّدش عليه حاجة**
    // ============================================================
    // الإعداد ده (المقاس والوحدة وبس) هو اللي شغّال ومُجرّب على طابعة
    // حقيقية في المحل. أي خيار زيادة اتحط هنا من غير تجربة على ورق =
    // مخاطرة بإن الطباعة تقف تمامًا.
    //
    // 📌 ده حصل فعلًا في v0.28.2 وطلّع **ملصقات فاضية**:
    //
    //   ضفنا density: 203 وإحنا فاكرين إنها "203 نقطة في البوصة".
    //   لكن QZ بيفهم density **بوحدة الإعداد نفسه**، وإحنا حاطين
    //   units: 'mm' — يعني اللي وصله كان "203 نقطة في **الملليمتر**"
    //   = 5156 نقطة في البوصة. الطابعة حاولت ترسم صورة مستحيلة
    //   وطلّعت ورق أبيض.
    //
    // القاعدة اللي اتعلمناها بالغالي: **الإعدادات مالهاش لازمة**. إحنا
    // بنرسم الملصق كصورة جاهزة بمقاس نقط الطابعة بالظبط، فالمطلوب من QZ
    // إنه يحطها على الورق وبس. أي خيار زيادة بيديله فرصة يتصرّف فيها.
    //
    // لو حد حابب يجرّب خيار جديد: المفاتيح المتقدمة في شاشة إعدادات
    // الطابعة موجودة عشان كده بالظبط — تتفتح واحد واحد **على ورق حقيقي**،
    // مش تتحط هنا افتراضيًا.
    // بنمسك الخيارات في متغيّر عشان المسار السريع يقدر يبني نفس الضبط
    // بالظبط + عدد النسخ، من غير ما يعيد بناء الخيارات (ويسهى عن مفتاح).
    const configOpts = applyPrintTweaks(size ? { size, units: 'mm' } : {});
    const config = qz.configs.create(printerName, configOpts);

    // ------------------------------------------------------------
    // ⭐ كل اللاصقات في **أمر طباعة واحد** مش أمر لكل لاصقة
    // ------------------------------------------------------------
    // المشكلة اللي بيحلها ده: لما كنا بنطبع 40 ملصق، الكود كان بيبعت 40 أمر
    // طباعة مستقل، كل واحد بيستنى الطابعة ترد عليه قبل اللي بعده. الطابعة
    // الحرارية بتاخد كل أمر كـ"وظيفة" لوحدها (تجهيز + معايرة + إنهاء)،
    // فالـ40 ملصق كانوا بياخدوا وقت طويل والطابعة بتفضل واقفة بينهم — وده
    // بالظبط اللي كنت شايفه: "بتفضل تاخد أمر أمر".
    //
    // الصح إن أمر الطباعة الواحد يبقى فيه **كل الصفحات**. QZ بيقبل مصفوفة
    // عناصر، وكل عنصر بيطلع صفحة (لاصقة) في نفس الوظيفة — فالطابعة بتشتغل
    // مرة واحدة متواصلة.
    //
    // ⚠️ شرط لازم يفضل محفوظ: data في كل عنصر **نص HTML وبس**، مش مصفوفة
    // ولا كائن — ده اللي طبع نص خام على اللاصقة قبل كده.
    const pageOf = (job) =>
      // الصورة أولًا: أخف بكتير من HTML، والأهم إن شكلها **مضمون** —
      // مفيش محرك تاني بيعيد رسمها.
      job.image
        ? { type: 'pixel', format: 'image', flavor: 'base64', data: job.image.replace(/^data:image\/\w+;base64,/, '') }
        : { type: 'pixel', format: 'html', flavor: 'plain', data: job.html };

    const totalLabels = list.reduce((n, j) => n + j.copies, 0);

    // ============================================================
    // ⭐⭐ العدد بيتبعت للطابعة كـ"عدد نسخ" مش كصفحات مكرّرة
    // ============================================================
    // ⚠️ ده أهم سطر في الطباعة. الشرح:
    //
    // المشكلة اللي كانت بتحصل: "لو طلبت 100 ملصق، الأمر مايوصلش للطابعة
    // أصلًا." الكود كان بيبني **100 صفحة منفصلة** ويبعتهم في وظيفة واحدة.
    // يعني QZ بيرسم 100 صورة، ويبني ملف طباعة فيه 100 صفحة، ويسلّمه
    // للويندوز. الملف ده بيكبر لدرجة إن الوظيفة بتقف من غير أي رسالة خطأ.
    //
    // والحاجة الغريبة إن الـ100 ملصق **متطابقين حرف بحرف**. فبدل ما نبعت
    // نفس الصورة 100 مرة، بنبعتها **مرة واحدة** ونقول للطابعة "اطبعها 100
    // مرة" (خيار copies). ده اللي كل برامج الملصقات بتعمله:
    //
    //   قبل:  100 صورة × 10 كيلو = 1000 كيلو، ووظيفة من 100 صفحة
    //   بعد:  صورة واحدة 10 كيلو، ووظيفة من صفحة واحدة
    //
    // ولو الملصقات مختلفة (سلة فيها أصناف)، كل صنف بياخد وظيفته بعدد نسخه.
    // ⚠️ نطاق الإيقاف بيتفتح **قبل** الشريط: الزرار جوّه الشريط بينده
    // requestPrintCancel، ولو النطاق لسه مافتحش الضغطة بتضيع في الهوا.
    beginPrintCancelScope();
    const progress = totalLabels > 10 ? showPrintProgress(totalLabels, requestPrintCancel) : null;
    // ⭐ نفس التقدم بيتبعت للجهاز اللي بعت الطلب (لو الطباعة عن بُعد)،
    // عشان اللي على الموبايل يشوف نفس الشريط بدل ما يستنى في الفراغ.
    const report = (done, total) => {
      if (progress) progress.update(done);
      if (typeof onProgress === 'function') onProgress(done, total);
    };

    const pages = [];
    for (const job of list) {
      const page = pageOf(job);
      for (let i = 0; i < job.copies; i++) pages.push(page);
    }
    lastBatchStats = null;

    // ------------------------------------------------------------
    // ⚠️⚠️ الدفعة بتتحسب بالحجم، مش بعدد الملصقات
    // ------------------------------------------------------------
    // المشكلة اللي بيحلها ده (اتبلّغت من الاستخدام الحقيقي):
    //
    //   "لو كتبت 100 ملصق، الطابعة بتاخد الأمر بس **مفيش حاجة بتتطبع**."
    //
    // الكود كان بيبعت 40 ملصق في رسالة واحدة. وقِسنا الرسالة دي فعليًا:
    //
    //   ملصق واحد        ≈  9 كيلو   (منهم 3 كيلو صورة الـQR بالـbase64)
    //   رسالة 40 ملصق    ≈ 364 كيلو
    //   رسالة 100 ملصق   ≈ 909 كيلو
    //
    // وQZ Tray بيستقبل على WebSocket، وللسوكيت **حد أقصى لحجم الرسالة**.
    // الرسالة اللي بتعدّي الحد مابترجّعش خطأ واضح — بتتضاع بهدوء. وده
    // بالظبط "بياخد الأمر ومفيش حاجة بتتطبع".
    //
    // فبقينا نقيس الحجم الحقيقي ونقسّم عليه. والحد اللي اخترناه (48 كيلو)
    // أقل بكتير من أي حد معروف، فالرسالة بتعدّي مهما كانت نسخة QZ.
    // ⚠️⚠️ وظايف **صغيرة**، مش وظيفة واحدة كبيرة.
    //
    // ده سبب "الأمر مايوصلش للطابعة" لما تطلب 100 ملصق. الوظيفة اللي فيها
    // 100 صفحة بيتبني منها ملف طباعة ضخم، وبيقف عند الويندوز أو عند
    // الطابعة **من غير أي رسالة خطأ**.
    //
    // جرّبنا نصغّر الرسالة، وجرّبنا نبعت العدد كـ"عدد نسخ" — والاتنين
    // مانفعوش. فبقينا نبعت **وظايف صغيرة ورا بعض**: كل وظيفة فيها
    // العدد اللي في الإعدادات بس. الطابعة بتخلّص وظيفة وتاخد اللي بعدها،
    // وكل واحدة صغيرة لدرجة إنها مستحيل تتخنق.
    //
    // أبطأ شوية من وظيفة واحدة — بس بتطبع فعلًا، وده اللي يهم.
    // ------------------------------------------------------------
    // ⚠️ التقسيم بالحجم **و**بالعدد — والحجم هو الحاكم
    // ------------------------------------------------------------
    // العطل ده **رجع تاني** في v0.33، والسبب إننا كنا بنقسّم بعدد ثابت
    // (5 صفحات) وناسيين إن حجم الصفحة بيكبر مع التصميم. القياس الحقيقي:
    //
    //   الملصق العادي   → الصفحة 10 كيلو → 5 صفحات = 49 كيلو  ❌
    //   المقسوم أربعة   → الصفحة 12 كيلو → 5 صفحات = 61 كيلو  ❌
    //   والحد الآمن 48 كيلو.
    //
    // يعني العدد الثابت **مايضمنش حاجة**: أول ما الملصق يتقل، الرسالة
    // بتعدّي الحد وتتضاع في صمت — "بياخد الأمر ومفيش حاجة بتتطبع".
    //
    // 📌 القاعدة دلوقتي: نقيس البايتات ونقفل الرسالة قبل ما تعدّي الحد.
    // وأي تصميم ملصق جديد بيتعامل معاه لوحده من غير ما حد يفتكر يعدّل رقم.
    // ============================================================
    // ⭐ المسار السريع: الملصق يتبعت **مرة واحدة** بعدد نسخ
    // ============================================================
    // 40 ملصق من نفس الصنف = **نفس الـ9.8 كيلو مكرّرة 40 مرة** = 393 كيلو
    // على الشبكة، مقسّمة على 10 رسايل. وده سبب البطء اللي بتشوفه.
    //
    // البديل: نبعت الصفحة مرة واحدة ونقول للطابعة "اطبعها 20 مرة"
    // (خيار copies في QZ). 40 ملصق يبقوا رسالتين × 9.8 كيلو بدل
    // 10 رسايل × 39 كيلو — **أخف 20 مرة**.
    //
    // ⚠️⚠️ ليه مطفي افتراضيًا؟ لأن "النسخ" اتجرّبت قبل كده **وفشلت** على
    // الطابعة اللي في المحل (متسجّل في تاريخ الملف ده). بس اللي اتجرّب
    // وقتها كان نسخة واحدة بـ100 — مش مقسّمة. المقسّمة دي حاجة تانية
    // ولازم تتجرّب على ورق حقيقي قبل ما تبقى الافتراضي.
    //
    // 📌 لو اشتغلت عندك، نخليها الافتراضي. لو لأ، تقفلها ومافيش خسارة.
    const useCopies = getPrintTweak('fastCopies');
    // ⚠️ الرقم ده بقى **خانة في الإعدادات** مش رقم ثابت. السبب إننا
    // جرّبنا نخمّنه 3 مرات وكل مرة نشحن تحديث — واللي واقف قدام الماكينة
    // هو الوحيد اللي يقدر يجاوب. الافتراضي 20 (اللي اتجرّب ورضي عنه).
    const COPIES_PER_JOB = getPrintBatchSize();
    const sizeOf = (pg) => (pg && pg.data ? pg.data.length : 0) + 64; // 64 = حِمل الغلاف

    // نهاية واحدة للإيقاف — عشان المسارين يقولوا نفس الكلام بالظبط
    const finishStopped = (done, total) => {
      if (progress) progress.close();
      endPrintCancelScope();
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:3200;' +
        'background:#4a3b00; color:#fff; padding:10px 16px; border-radius:8px; max-width:88vw;' +
        'font-size:12.5px; line-height:1.8; box-shadow:0 4px 18px rgba(0,0,0,.3); text-align:center;';
      // ⚠️ الرقم ده **مش دقيق للملصق**: الدفعة الأخيرة اللي اتبعتت لسه
      // بتخرج من الماكينة. بنقول "لحد" عشان مانوعدش برقم مش بإيدنا.
      el.textContent = `⏹️ اتوقفت — اتبعت لحد ${done} من ${total}. اللي في الماكينة هيكمّل.`;
      document.body.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 8000);
      setPrintOutcome(false, `اتوقفت بطلب المستخدم — اتبعت ${done} من ${total}.`, done, total, true);
      return true;
    };

    if (useCopies && list.length === 1 && list[0].copies > 1) {
      const page = pageOf(list[0]);
      const total = list[0].copies;
      if (sizeOf(page) <= QZ_MAX_MESSAGE_BYTES) {
        let sent = 0;
        try {
          // ⭐ هنا الحجم **مش عامل**: بنبعت صفحة واحدة ونقول "اطبعها n
          // مرة". فرقم المستخدم بيتنفّذ زي ما هو — 40، 60، 100.
          lastBatchStats = {
            jobs: Math.ceil(total / COPIES_PER_JOB),
            maxPerJob: Math.min(COPIES_PER_JOB, total),
            maxKB: Math.round(sizeOf(page) / 1024),
          };
          while (sent < total) {
            // ⏹️ الفحص **قبل** الإرسال: بعد الإرسال يبقى فات الأوان
            if (isPrintCancelRequested()) return finishStopped(sent, total);
            const n = Math.min(COPIES_PER_JOB, total - sent);
            const cfg = qz.configs.create(printerName, { ...configOpts, copies: n });
            await qzPrintWithTimeout(cfg, [page], `نسخ ${sent + 1}-${sent + n}`);
            sent += n;
            report(sent, total);
            if (sent < total) await paceForPrinter(n);
          }
          if (progress) progress.close();
          if (progress) showPrintHint(total);
          endPrintCancelScope();
          setPrintOutcome(true, '', total, total);
          return true;
        } catch (errCopies) {
          // ⚠️ مانرجعش false — الطابعة يمكن تكون طبعت جزء. بنكمّل بالطريقة
          // المضمونة من اللي فاضل بدل ما نعيد اللي اتطبع.
          console.warn('مسار النسخ السريع فشل — بنكمّل بالطريقة العادية:', errCopies);
          pages.splice(0, sent);
        }
      }
    }

    // السقف بالعدد: الأقل بين رقم المستخدم وسقف الأمان القديم.
    const maxPerMessage = getPrintBatchSize();
    const perMessage = [];
    let chunk = [];
    let bytes = 0;
    for (const pg of pages) {
      const s = sizeOf(pg);
      // نقفل الرسالة لو زوّدنا هنعدّي الحد، أو لو وصلنا العدد الأقصى.
      // الصفحة الواحدة لو أكبر من الحد أصلًا بتروح لوحدها — أحسن من
      // إننا نبعت رسالة فاضية.
      //
      // ⚠️⚠️ **الحجم دايمًا بيكسب.** رقم المستخدم سقف، مش أمر. لو كتب 40
      // وهو بيطبع ملصق بباركود (9.7 كيلو)، الرسالة تبقى 390 كيلو وتتضاع
      // في **سكوت** — "بياخد الأمر ومفيش حاجة بتتطبع". عشان كده الشرط
      // بالحجم أول حاجة، ورقمه بيتحط جنبه مش مكانه.
      if (chunk.length && (bytes + s > QZ_MAX_MESSAGE_BYTES || chunk.length >= maxPerMessage)) {
        perMessage.push(chunk);
        chunk = [];
        bytes = 0;
      }
      chunk.push(pg);
      bytes += s;
    }
    if (chunk.length) perMessage.push(chunk);

    lastBatchStats = {
      jobs: perMessage.length,
      maxPerJob: perMessage.reduce((m, c) => Math.max(m, c.length), 0),
      maxKB: Math.round(perMessage.reduce((m, c) => Math.max(m, c.reduce((s, pg) => s + sizeOf(pg), 0)), 0) / 1024),
    };

    // الصفحة الواحدة لو أكبر من الحد، الرسالة هتتضاع في صمت مهما قسّمنا.
    // ده مش وارد بتصميماتنا (الصفحة ~8 كيلو والحد 48)، بس لو حصل يومًا
    // بسبب تصميم جديد، المستخدم يعرف **ليه** بدل ما يقف يتفرج.
    const tooBig = pages.find((pg) => sizeOf(pg) > QZ_MAX_MESSAGE_BYTES);
    if (tooBig) {
      if (progress) progress.close();
      console.warn('صفحة أكبر من حد رسالة QZ:', sizeOf(tooBig), 'نوع:', type);
      // ------------------------------------------------------------
      // ⚠️ النوعين بيتعاملوا مختلف عن قصد
      // ------------------------------------------------------------
      // **ورقة التزويد**: طولها مفتوح وبتكبر مع عدد الدرجات، فالوصول
      // للحد ده احتمال حقيقي. الأنفع إنها تكمّل على نافذة طباعة المتصفح
      // (اللي مالهاش حد أصلًا) بدل ما تقف. بنرجّع false عشان deliverPrint
      // يرجع للبديل لوحده.
      //
      // **الملصق**: مقاسه ثابت (~8 كيلو والحد 48). لو وصل للحد ده يبقى
      // فيه عطل في التصميم — والسكوت عليه معناه إن المستخدم يقف مستني
      // ملصقات مش هتيجي. لازم يعرف.
      //
      // ⚠️ التنبيه ده اتشال بالغلط مرة (v0.36.x) لما اتصلحت ورقة التزويد،
      // فبقت الملصقات بتفشل في صمت. النوع لازم يفرق.
      setPrintOutcome(false, 'الملصق أتقل من حد رسالة الطابعة.');
      if (type === 'restock') return false;
      alert(
        '⚠️ الطباعة ماتمّتش — الملصق تقيل أوي على الطابعة.\n\n' +
          'ده عيب في التصميم مش في الطابعة. بلّغ عنه.'
      );
      return true;
    }

    let done = 0;
    try {
      for (const chunk of perMessage) {
        // ⏹️ الفحص **قبل** الإرسال: بعد الإرسال يبقى فات الأوان
        if (isPrintCancelRequested()) return finishStopped(done, pages.length);
        await qzPrintWithTimeout(config, chunk, `الملصقات ${done + 1}-${done + chunk.length}`);
        done += chunk.length;
        report(done, pages.length);
        // ⭐ نستنى الماكينة تلحق قبل الدفعة اللي بعدها (شوف paceForPrinter)
        if (done < pages.length) await paceForPrinter(chunk.length);
      }
    } catch (errBatch) {
      // لو نسخة QZ أو الطابعة مابتقبلش أكتر من صفحة في الأمر الواحد،
      // بنرجع للطريقة القديمة (واحدة واحدة) — بطيئة بس مضمونة، وأهم حاجة
      // إن المستخدم ما يخرجش من غير ملصقات خالص.
      console.warn('الطباعة المجمّعة مانفعتش — بنرجع لواحدة واحدة:', errBatch);
      try {
        for (let i = done; i < pages.length; i++) {
          if (isPrintCancelRequested()) return finishStopped(i, pages.length);
          await qzPrintWithTimeout(config, [pages[i]], `الملصق ${i + 1}`);
          report(i + 1, pages.length);
          if (i + 1 < pages.length) await paceForPrinter(1);
        }
      } catch (errOne) {
        if (progress) progress.close();
        console.error('فشلت الطباعة حتى واحدة واحدة:', errOne);
        alert(
          `⚠️ الطابعة وقفت في النص.\n\n` +
            `اتطبع ${done} ملصق من ${pages.length} — فاضل ${pages.length - done}.\n\n` +
            'الأسباب المعتادة:\n' +
            '• الورق خلص أو اتحشر\n' +
            '• الغطا مفتوح\n' +
            '• الطابعة اتفصلت\n\n' +
            'ظبّطها واطبع الباقي.' +
            (errOne && errOne.message ? `\n\n(${errOne.message})` : '')
        );
        // ⚠️ بترجّع true (اتعاملنا معاها) بس دي **مش** نجاح — واللي بعت
        // الطلب من جهاز تاني لازم يعرف إنها وقفت، مش يوصله "اتطبع".
        setPrintOutcome(false, `الطابعة وقفت في النص — اتطبع ${done} من ${pages.length}.`, done, pages.length);
        return true;
      }
    }
    if (progress) progress.close();

    // ------------------------------------------------------------
    // ⚠️ الحالة اللي **مافيش طريقة نكشفها من الكود**
    // ------------------------------------------------------------
    // qz.print بيرجع بنجاح معناه "الأمر اتسلّم"، **مش** "الملصق خرج".
    // لو الورق خلص أو الغطا مفتوح أو الطابعة معلّقة، الأمر بيتسلّم عادي
    // والورق مابيخرجش — وده اللي المستخدم بيسميه "بتاخد الأمر ومفيش حاجة
    // بتتطبع".
    //
    // مافيش طريقة نعرفها من المتصفح. الحل الأمين إن النظام **يسأل** بدل
    // ما يفترض النجاح — والمستخدم واقف عند الماكينة وشايف بعينه.
    //
    // ------------------------------------------------------------
    // ⚠️⚠️ ماتحطش هنا confirm() ولا alert() — دي بتجمّد الجهاز
    // ------------------------------------------------------------
    // كان هنا سؤال: "اتبعت 40 ملصق — خرجوا من الماكينة فعلًا؟" بـconfirm().
    // النية كانت سليمة (مافيش طريقة نعرف بيها إن الورق خرج فعلًا)، لكن
    // النتيجة كانت **عطل أسوأ من اللي بنحاول نكشفه**:
    //
    // confirm() بتوقف خيط الجافاسكريبت **كله**، مش الطباعة بس. وطول ما هي
    // مفتوحة على جهاز مافيهوش حد واقف:
    //   • الاتصال بـQZ واقف
    //   • النظام مش بيسمع طلبات الطباعة الجاية من السحابة
    //   • الطلب الحالي عمره ما بيتعلّم "خلص" → اللي باعت بيفضل مستني
    //   • وأي طلب تاني يتبعت **مش هيتنفّذ خالص**
    //
    // والجهاز اللي بيستقبل الطباعة عن بُعد **بطبيعته مافيش حد واقف عنده**.
    // فالسؤال ده كان بيقفل الطباعة عن بُعد كل ما تطبع طبعة كبيرة.
    //
    // البديل: تنبيه **مش موقّف** بيظهر ويختفي لوحده. المستخدم اللي واقف
    // عند الماكينة بيشوفه، واللي مش واقف مايتأثرش.
    if (progress) showPrintHint(pages.length);
    endPrintCancelScope();
    setPrintOutcome(true, '', pages.length, pages.length);
    return true;
  } catch (err) {
    endPrintCancelScope();
    console.error('فشلت الطباعة عبر QZ Tray:', err);
    setPrintOutcome(false, 'خطأ في الاتصال بالطابعة' + (err && err.message ? `: ${err.message}` : '.'));
    return false;
  }
}

// ============================================================
// شاشة إعدادات طابعات الجهاز (تظهر لأي حد يقدر يطبع)
// ============================================================
async function openPrinterSettings() {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;';
  overlay.innerHTML = `
    <div class="card" style="max-width:380px; width:100%; max-height:90vh; overflow:auto;">
      <div style="font-size:14px; font-weight:500; margin-bottom:4px;">إعدادات طابعات هذا الجهاز</div>
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;" id="qz-status-line">جارٍ البحث عن QZ Tray...</div>
      <div id="qz-printer-fields" style="display:none;">
        <div class="field">
          <label>اسم الجهاز ده</label>
          <input class="input" id="qz-device-name" placeholder="مثال: كمبيوتر الكاشير — الفرع" />
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
            الاسم ده اللي هيظهر لزمايلك لما يبعتوا طباعة للجهاز ده
          </div>
        </div>
        <div class="field">
          <label>طابعة الملصق (باركود)</label>
          <select class="input" id="qz-label-printer-select"></select>
        </div>
        <div class="field">
          <label>طابعة ورقة التزويد</label>
          <select class="input" id="qz-restock-printer-select"></select>
        </div>

        <!-- ============================================================
             ⭐ الإعدادات المتقدمة بقت مطوية
             ============================================================
             النافذة دي فيها 13 خانة و16 زرار و9 أقسام كلهم مفتوحين مع
             بعض. وانت بتفتحها 99% من المرات عشان **حاجة واحدة**: تختار
             طابعة — وهي فوق خالص.
             ⚠️⚠️ **ولا سطر جوّه القسم ده اتغيّر**: نفس الخانات ونفس
             الـid ونفس الأزرار ونفس الترتيب. اللي اتضاف هو الغلاف
             والزرار بس، عشان أي تعديل في المنطق مايتكسرش. -->
        <!-- ============================================================
             ⭐⭐ كل قسم بيتفتح لوحده
             ============================================================
             النافذة دي فيها 13 خانة و16 زرار. وانت بتفتحها 99% من المرات
             عشان **حاجة واحدة**: تختار طابعة — وهي فوق خالص.

             قبل كده كان فيه زرار واحد "إعدادات متقدمة" بيخبّي **الخمس
             أقسام مع بعض**، فأول ما تدوسه ترجع لنفس الكومة. دلوقتي كل
             قسم عنوان لوحده بيتفتح لما تحتاجه.

             ⚠️⚠️ **ولا سطر جوّه أي قسم اتغيّر**: نفس الخانات ونفس الـid
             ونفس الأزرار ونفس الترتيب — الغلاف بس هو اللي اتقسم، عشان أي
             تعديل في المنطق مايتكسرش. -->
        <div class="pset-sec">
          <button type="button" class="pset-toggle" data-pset="cal" aria-expanded="false" aria-controls="pset-body-cal">
            <span class="pset-sec-title">🎯 معايرة طابعة الملصق<small>مقاس الملصق والفراغ بينهم — مرة واحدة لكل طابعة</small></span>
            <span class="pset-chev">▾</span>
          </button>
          <div class="pset-body" id="pset-body-cal" hidden>
<div style="font-size:13px; font-weight:500; margin-bottom:4px;">🎯 معايرة طابعة الملصق</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
            بتقول للطابعة مقاس الملصق وتخليها تقيس الفراغ بين الملصقات بنفسها.
            بتحل مشكلة <strong>الملصق المنحرف</strong> و<strong>الورقة الفاضية</strong>.
            <br>• بتتعمل <strong>مرة واحدة لكل طابعة</strong> — بتتخزّن جوه الطابعة نفسها
            <br>• بتستهلك 2-3 ملصقات وهي بتقيس
            <br>• <strong>مابتلمسش إعدادات الويندوز خالص</strong>
          </div>
          <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px;">
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">العرض (مم)</label>
              <input class="input" type="number" id="cal-w" value="38" step="0.5" style="padding:6px;" />
            </div>
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">الطول (مم)</label>
              <input class="input" type="number" id="cal-h" value="25" step="0.5" style="padding:6px;" />
            </div>
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">الفراغ (مم)</label>
              <input class="input" type="number" id="cal-gap" value="2" step="0.5" style="padding:6px;" />
            </div>
            <button class="btn" id="cal-run">🎯 عايِر</button>
          </div>
          <div id="cal-status" style="font-size:12px; min-height:16px;"></div>
          </div>
        </div>
        <div class="pset-sec">
          <button type="button" class="pset-toggle" data-pset="quality" aria-expanded="false" aria-controls="pset-body-quality">
            <span class="pset-sec-title">🔥 وضوح الطباعة<small>السرعة والحرارة — لو الكلام منغمش أو باهت</small></span>
            <span class="pset-chev">▾</span>
          </button>
          <div class="pset-body" id="pset-body-quality" hidden>
<div style="font-size:12px; font-weight:500; margin-bottom:4px;">🔥 وضوح الطباعة (السرعة والحرارة)</div>
            <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:8px;">
              دول أهم حاجتين في حدة الطباعة الحرارية:
              <br>• <strong>السرعة أبطأ</strong> ← الحرارة توصل كاملة، الحرف بيطلع أوضح
              <br>• <strong>الحرارة أعلى</strong> ← أغمق، بس لو زيادة <strong>الحروف بتلتحم</strong> (النغمشة)
              <br>الأوامر بتتخزّن <strong>جوه الطابعة نفسها</strong> زي المعايرة.
            </div>
            <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px;">
              <div class="field" style="width:110px; margin-bottom:0;">
                <label style="font-size:11px;">السرعة (1 = أبطأ)</label>
                <input class="input" type="number" id="pq-speed" min="1" max="8" step="1" style="padding:6px;" />
              </div>
              <div class="field" style="width:110px; margin-bottom:0;">
                <label style="font-size:11px;">الحرارة (0–15)</label>
                <input class="input" type="number" id="pq-density" min="0" max="15" step="1" style="padding:6px;" />
              </div>
              <button class="btn" id="pq-apply">🔥 ابعتها للطابعة</button>
            </div>
            <div style="font-size:11px; color:var(--text-muted); line-height:1.7; margin-bottom:6px;">
              جرّب كده لو الكلام <strong>منغمش</strong>: السرعة <strong>2</strong> والحرارة <strong>6</strong>.
              ولو <strong>باهت</strong>: السرعة <strong>2</strong> والحرارة <strong>10</strong>.
            </div>
            <div id="pq-status" style="font-size:12px; min-height:16px;"></div>
          </div>
        </div>
        <div class="pset-sec">
          <button type="button" class="pset-toggle" data-pset="pace" aria-expanded="false" aria-controls="pset-body-pace">
            <span class="pset-sec-title">⏱️ إيقاع الطبعات الكبيرة<small>الوقفة بين الملصقات عشان الطبعة الكبيرة تخرج كاملة</small></span>
            <span class="pset-chev">▾</span>
          </button>
          <div class="pset-body" id="pset-body-pace" hidden>
<div style="font-size:12px; font-weight:500; margin-bottom:4px;">⏱️ إيقاع الطبعات الكبيرة</div>
              <div style="font-size:11px; color:var(--text-muted); line-height:1.8; margin-bottom:8px;">
                الطابعة بتطبع الملصق في حوالي <strong>نص ثانية</strong>. لو بعتنا 100 ملصق
                في ثانية واحدة، ذاكرتها بتتملى و<strong>الباقي بيضيع من غير أي رسالة</strong> —
                لأن الويندوز بيقول "استلمت" حتى لو الورق مخرجش.
                <br>الرقم ده بيخلّي النظام يمشي على سرعة ماكينتك.
                <br><strong>صفر = من غير انتظار</strong> (السلوك القديم اللي كان بيضيّع الطبعات).
              </div>
              <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap;">
                <div class="field" style="width:150px; margin-bottom:0;">
                  <label style="font-size:11px;">مللي ثانية لكل ملصق</label>
                  <input class="input" type="number" id="pq-pace" min="0" max="3000" step="20" style="padding:6px;" />
                </div>
                <button class="btn" id="pq-pace-save">حفظ</button>
                <span id="pq-pace-status" style="font-size:11px; color:var(--text-muted);"></span>
              </div>
          </div>
        </div>
        <div class="pset-sec">
          <button type="button" class="pset-toggle" data-pset="batch" aria-expanded="false" aria-controls="pset-body-batch">
            <span class="pset-sec-title">📦 حجم الدفعة والتقديم<small>أرقام للتجربة عند الماكينة</small></span>
            <span class="pset-chev">▾</span>
          </button>
          <div class="pset-body" id="pset-body-batch" hidden>
<div style="font-size:12px; font-weight:500; margin-bottom:4px;">📦 حجم الدفعة والتقديم</div>
              <div style="font-size:11px; color:var(--text-muted); line-height:1.8; margin-bottom:8px;">
                الرقمين دول <strong>للتجربة</strong> — جرّب وشوف بعينك على الماكينة.
                بعد كل طبعة كبيرة هيظهر لك تحت <strong>الدفعة طلعت كام فعلًا</strong>.
                <br>⚠️ <strong>عدد الدفعة سقف مش أمر</strong>: لو الملصق تقيل (بباركود مثلًا)
                النظام هيقلّل لوحده عشان الرسالة ماتضيعش في سكوت. هيقولك لما ده يحصل.
              </div>
              ${/* ⚠️ المفتاح ده كان تحت في "إعدادات متقدمة" آخر النافذة —
                    والقسم ده كان بيقول عنه "فوق" وهو تحت. اللي بيدوّر على
                    "ليه الـ30 بتطبع 4" بيدوّر **هنا**، فمكانه هنا. */ ''}
              ${(() => {
                const t = PRINT_TWEAKS.find((x) => x.key === 'fastCopies');
                return t ? `
              <label style="display:flex; gap:8px; align-items:flex-start; padding:8px; margin-bottom:8px; font-size:12px; cursor:pointer; background:var(--surface-muted); border-radius:8px;">
                <input type="checkbox" data-tweak="fastCopies" ${getPrintTweak('fastCopies') ? 'checked' : ''}
                       style="margin-top:2px; flex:0 0 auto;" />
                <span>
                  <span style="display:block; font-weight:500;">${escapeHTML(t.label)}</span>
                  <span style="display:block; font-size:10px; color:var(--text-muted); line-height:1.6;">${escapeHTML(t.hint)}</span>
                </span>
              </label>` : '';
              })()}
              <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap;">
                <div class="field" style="width:135px; margin-bottom:0;">
                  <label style="font-size:11px;">أقصى عدد في الدفعة</label>
                  <input class="input" type="number" id="pq-batch" min="1" max="200" step="1" style="padding:6px;" />
                </div>
                <div class="field" style="width:165px; margin-bottom:0;">
                  <label style="font-size:11px;">ابعت اللي بعدها وفاضل كام</label>
                  <input class="input" type="number" id="pq-lead" min="0" max="50" step="1" style="padding:6px;" />
                </div>
                <button class="btn" id="pq-batch-save">حفظ</button>
                <span id="pq-batch-status" style="font-size:11px; color:var(--text-muted);"></span>
              </div>
          </div>
        </div>
        <div class="pset-sec">
          <button type="button" class="pset-toggle" data-pset="fonts" aria-expanded="false" aria-controls="pset-body-fonts">
            <span class="pset-sec-title">🧪 عيّنة خطوط الطابعة<small>بيطبع ملصق فيه كل خط في الطابعة عشان تقارن</small></span>
            <span class="pset-chev">▾</span>
          </button>
          <div class="pset-body" id="pset-body-fonts" hidden>
<div style="font-size:12px; font-weight:500; margin-bottom:4px;">🧪 عيّنة خطوط الطابعة</div>
            <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:8px;">
              الملصق دلوقتي بيترسم عندنا كصورة. الطريقة الاحترافية إن
              <strong>الطابعة ترسم النص بخطها الداخلي</strong> — خط مرسوم أصلًا
              لدقة الطابعة، فمفيش تنعيم ولا نغمشة.
              <br>الزرار ده بيطبع <strong>ملصق واحد</strong> فيه نفس الاسم بكل خط
              في الطابعة ومكتوب جنبه اسمه. بُص أنهي واحد أوضح وقولنا.
              <br>⚠️ خطوط الطابعة <strong>إنجليزي بس</strong> — العربي هيفضل صورة.
            </div>
            <button class="btn" id="tspl-sample">🧪 اطبع عيّنة الخطوط</button>
            <div id="tspl-status" style="font-size:12px; min-height:16px; margin-top:6px;"></div>
          </div>
        </div>

        <div id="copy-box" style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px; display:none;">
          <div style="font-size:13px; font-weight:500; margin-bottom:4px;">📥 انسخ الإعدادات من جهاز تاني</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
            ☁️ ضبط الملصق بقى <strong>مشترك تلقائيًا</strong> بين كل الأجهزة،
            فمش محتاج تنسخه. القسم ده باقي لحاجة واحدة بس:
            <br>• <strong>اختيار الطابعة</strong> — لو نفس اسم الطابعة موجود على الجهاز ده
            <br>• <strong>مابينسخش اسم الجهاز</strong> — كل جهاز لازم يفضل باسمه
          </div>
          <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap;">
            <div class="field" style="flex:1; min-width:150px; margin-bottom:0;">
              <label style="font-size:11px;">انسخ من</label>
              <select class="input" id="copy-from" style="padding:6px;"></select>
            </div>
            <button class="btn" id="copy-run">📥 انسخ</button>
          </div>
          <div id="copy-status" style="font-size:12px; min-height:16px; margin-top:6px; line-height:1.7;"></div>
        </div>

        <!-- ---------- الإطار وضبط مكان الطباعة ---------- -->
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
          <div style="font-size:13px; font-weight:500; margin-bottom:4px;">📐 ضبط مكان الطباعة</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
            اطبع <strong>إطار تجربة</strong> بمقاس الملصق، وبُص هو طالع فين
            على الورق. لو مزحلق، حرّكه بالعكس بالأزرار وجرّب تاني.
            <br>• ☁️ الأرقام دي بتتحفظ <strong>لكل الأجهزة مرة واحدة</strong> — مش محتاج تظبطها على كل كمبيوتر
            <br>• الأصفار = الطباعة زي ما هي بالظبط
          </div>

          <!-- ⚠️ direction:ltr مقصودة: دي لوحة اتجاهات، والسهم لازم يبقى في
               نفس مكان الاتجاه اللي بيحرّك ناحيته. لو سابناها RTL، الشبكة
               بتتقلب والسهم اللي على الشمال بيحرّك يمين. -->
          <div id="align-pad" style="display:grid; grid-template-columns:repeat(3, 40px); gap:6px;
               justify-content:center; margin-bottom:10px; direction:ltr;">
            <span></span>
            <button class="btn" data-nudge="up" style="padding:6px;">▲</button>
            <span></span>
            <button class="btn" data-nudge="left" style="padding:6px;">◀</button>
            <button class="btn" data-nudge="zero" style="padding:6px; font-size:11px;">صفّر</button>
            <button class="btn" data-nudge="right" style="padding:6px;">▶</button>
            <span></span>
            <button class="btn" data-nudge="down" style="padding:6px;">▼</button>
            <span></span>
          </div>

          <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px;">
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">يمين/شمال</label>
              <input class="input" type="number" id="align-x" step="0.2"
                     min="-${PRINT_ALIGN_LIMIT_MM}" max="${PRINT_ALIGN_LIMIT_MM}" style="padding:6px;" />
            </div>
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">فوق/تحت</label>
              <input class="input" type="number" id="align-y" step="0.2"
                     min="-${PRINT_ALIGN_LIMIT_MM}" max="${PRINT_ALIGN_LIMIT_MM}" style="padding:6px;" />
            </div>
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">تصغير %</label>
              <input class="input" type="number" id="align-shrink" step="1"
                     min="0" max="${PRINT_SHRINK_LIMIT}" style="padding:6px;" />
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn" id="align-frame">🖨️ اطبع الإطار</button>
            <button class="btn btn-primary" id="align-save" style="padding:6px 14px;">احفظ الضبط</button>
          </div>
          <div id="align-status" style="font-size:12px; min-height:16px; margin-top:6px;"></div>
        </div>

        <!-- ---------- إعدادات متقدمة ---------- -->
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
          <div style="font-size:13px; font-weight:500; margin-bottom:4px;">🧪 إعدادات متقدمة — للتجربة</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
            <strong>مش محتاجها في الوضع العادي.</strong> إعدادات الملصق
            الصح مظبوطة جوه النظام وبتشتغل لوحدها على كل جهاز.
            <br>المفاتيح دي للتجربة بس لو حصلت مشكلة — افتح
            <strong>واحد بس</strong> وجرّب. وهي كمان
            <strong>☁️ بتتحفظ لكل الأجهزة</strong>.
          </div>
          ${PRINT_TWEAKS.filter((t) => t.key !== 'fastCopies').map(
            (t) => `
            <label style="display:flex; gap:8px; align-items:flex-start; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px; cursor:pointer;">
              <input type="checkbox" data-tweak="${escapeHTML(t.key)}" ${getPrintTweak(t.key) ? 'checked' : ''}
                     style="margin-top:2px; flex:0 0 auto;" />
              <span>
                <span style="display:block;">${escapeHTML(t.label)}</span>
                <span style="display:block; font-size:10px; color:var(--text-muted); line-height:1.6;">${escapeHTML(t.hint)}</span>
              </span>
            </label>`
          ).join('')}
        </div>

        <!-- ---------- بيانات الطابعات ---------- -->
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span style="font-size:13px; font-weight:500;">🖨️ بيانات الطابعات</span>
            <button class="btn" id="qz-details-btn" style="padding:3px 10px; font-size:12px;">اعرض</button>
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
            بتفيد لما نقارن كمبيوتر شغّال بكمبيوتر مش شغّال
          </div>
          <pre id="qz-details" style="display:none; font-size:10px; direction:ltr; text-align:start;
               background:var(--surface-muted); padding:8px; border-radius:8px; margin-top:8px;
               max-height:180px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere;"></pre>
        </div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
        <button class="btn" id="qz-settings-close">إغلاق</button>
        <button class="btn btn-primary" id="qz-settings-save" style="display:none;">حفظ</button>
      </div>
    </div>`;
  // فتح/قفل الأقسام — معالج واحد لكلهم بدل واحد لكل قسم.
  // ⚠️ الفتح **مابيلمسش** أي خانة جوّه القسم؛ بيشيل hidden عن الغلاف وبس،
  // فالقيم المحفوظة وأي مستمع اتربط بالخانات بيفضلوا زي ما هما.
  overlay.querySelectorAll('.pset-toggle[data-pset]').forEach((btn) => {
    const box = overlay.querySelector('#pset-body-' + btn.getAttribute('data-pset'));
    if (!box) return;
    btn.addEventListener('click', () => {
      const open = box.hidden;
      box.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.classList.toggle('on', open);
    });
  });

  document.body.appendChild(overlay);

  // ⚠️ درس اتعلمناه من خطأ حقيقي ظهر على التليفون:
  // البحث عن QZ Tray بياخد كام ثانية (بيحاول يفتح اتصال محلي وميلاقيش).
  // المستخدم بيقفل الشاشة في الوقت ده، وبعدين البحث بيخلص وبيدوّر على
  // عناصر الشاشة اللي **اتشالت خلاص** — فبيرجع null والكود بيقع برسالة
  // Cannot set properties of null.
  //
  // الإصلاح جزئين:
  //   1) نمسك العناصر **قبل** الانتظار، مش بعده
  //   2) لو الشاشة اتقفلت أثناء الانتظار، نخرج بهدوء من غير ما نعمل حاجة
  const statusLine = overlay.querySelector('#qz-status-line');
  const fields = overlay.querySelector('#qz-printer-fields');
  const saveBtn = overlay.querySelector('#qz-settings-save');
  const labelSelect = overlay.querySelector('#qz-label-printer-select');
  const restockSelect = overlay.querySelector('#qz-restock-printer-select');
  const deviceNameInput = overlay.querySelector('#qz-device-name');

  let closed = false;
  const closeSettings = () => {
    closed = true;
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  overlay.querySelector('#qz-settings-close').addEventListener('click', closeSettings);

  const printers = await getAvailableQZPrinters();
  if (closed) return;

  if (!isQZAvailable() || printers.length === 0) {
    statusLine.innerHTML = isQZAvailable()
      ? 'تعذّر الاتصال بـ QZ Tray. تأكد إنه مشغّل على الجهاز ده.'
      : 'برنامج QZ Tray مش مثبّت على الجهاز ده. بدونه، الطباعة هتشتغل بالطريقة العادية (نافذة المتصفح) وهتحتاج تختار الطابعة يدويًا كل مرة.';
    return;
  }

  statusLine.textContent = `متصل بـ QZ Tray — ${printers.length} طابعة موجودة`;
  fields.style.display = 'block';
  saveBtn.style.display = 'inline-block';

  [labelSelect, restockSelect].forEach((select) => {
    select.innerHTML = `<option value="">— اختار طابعة —</option>` + printers.map((p) => `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`).join('');
  });
  labelSelect.value = getSavedPrinter('label');
  restockSelect.value = getSavedPrinter('restock');
  deviceNameInput.value = getDeviceName();

  // ---- المفاتيح المتقدمة: بتتحفظ فورًا على الجهاز ----
  overlay.querySelectorAll('[data-tweak]').forEach((box) => {
    box.addEventListener('change', () => setPrintTweak(box.getAttribute('data-tweak'), box.checked));
  });

  // ---- بيانات الطابعات ----
  const detailsBtn = overlay.querySelector('#qz-details-btn');
  const detailsBox = overlay.querySelector('#qz-details');
  detailsBtn.addEventListener('click', () =>
    safeAsync(async () => {
      detailsBox.style.display = 'block';
      detailsBox.textContent = 'جارٍ القراءة...';
      try {
        const info = await qz.printers.details();
        detailsBox.textContent = JSON.stringify(info, null, 1);
      } catch (err) {
        detailsBox.textContent = 'تعذّرت القراءة: ' + (err && err.message ? err.message : err);
      }
    }, 'قراءة بيانات الطابعات')
  );

  // ---- جودة الطباعة ----
  const pqPace = overlay.querySelector('#pq-pace');
  if (pqPace) {
    pqPace.value = getPrintPaceMs();
    overlay.querySelector('#pq-pace-save').addEventListener('click', () => {
      setPrintPaceMs(pqPace.value);
      pqPace.value = getPrintPaceMs();
      const st = overlay.querySelector('#pq-pace-status');
      st.textContent = getPrintPaceMs() > 0
        ? `✅ اتحفظ — الطبعة الكبيرة هتمشي على ${getPrintPaceMs()}مث للملصق.`
        : '✅ اتحفظ — من غير انتظار.';
    });
  }

  const pqBatch = overlay.querySelector('#pq-batch');
  const pqLead = overlay.querySelector('#pq-lead');
  if (pqBatch && pqLead) {
    pqBatch.value = getPrintBatchSize();
    pqLead.value = getPrintLeadLabels();
    overlay.querySelector('#pq-batch-save').addEventListener('click', () => {
      setPrintBatchSize(pqBatch.value);
      setPrintLeadLabels(pqLead.value);
      pqBatch.value = getPrintBatchSize();
      pqLead.value = getPrintLeadLabels();
      const lead = getPrintLeadLabels();
      overlay.querySelector('#pq-batch-status').textContent =
        `✅ اتحفظ — لحد ${getPrintBatchSize()} في الدفعة، ` +
        (lead > 0 ? `والجاية بتتبعت وفاضل ${lead}.` : 'وبنستنى الدفعة تخلص.');
    });
  }

  const pqSpeed = overlay.querySelector('#pq-speed');
  const pqDensity = overlay.querySelector('#pq-density');
  const pqStatus = overlay.querySelector('#pq-status');
  const q0 = getPrintQuality();
  pqSpeed.value = q0.speed;
  pqDensity.value = q0.density;
  overlay.querySelector('#pq-apply').addEventListener('click', () =>
    safeAsync(async () => {
      const printerName = labelSelect.value;
      if (!printerName) {
        pqStatus.style.color = 'var(--danger-text)';
        pqStatus.textContent = 'اختار طابعة الملصق الأول.';
        return;
      }
      saveSelectedPrinter('label', printerName);
      pqStatus.style.color = 'var(--text-secondary)';
      pqStatus.textContent = 'جارٍ الإرسال...';
      try {
        await applyPrintQuality(printerName, pqSpeed.value, pqDensity.value);
        pqStatus.style.color = '#2e7d32';
        pqStatus.textContent = '✅ اتخزّنت جوه الطابعة. اطبع ملصق وشوف الفرق.';
      } catch (err) {
        console.error(err);
        pqStatus.style.color = 'var(--danger-text)';
        pqStatus.textContent = '⚠️ ' + (err && err.message ? err.message : 'تعذّر الإرسال');
      }
    }, 'جودة الطباعة')
  );

  // ---- عيّنة خطوط الطابعة ----
  const tsplStatus = overlay.querySelector('#tspl-status');
  overlay.querySelector('#tspl-sample').addEventListener('click', () =>
    safeAsync(async () => {
      const printerName = labelSelect.value;
      if (!printerName) {
        tsplStatus.style.color = 'var(--danger-text)';
        tsplStatus.textContent = 'اختار طابعة الملصق الأول.';
        return;
      }
      saveSelectedPrinter('label', printerName);
      const w = Number(overlay.querySelector('#cal-w').value) || 38;
      const h = Number(overlay.querySelector('#cal-h').value) || 25;
      tsplStatus.style.color = 'var(--text-secondary)';
      tsplStatus.textContent = 'جارٍ الإرسال...';
      try {
        await printTSPLFontSample(printerName, w, h, 'Hejap Kuwaiti 120', '10632103');
        tsplStatus.style.color = '#2e7d32';
        tsplStatus.textContent = '✅ اتبعت. شوف الملصق وقولنا أنهي خط أوضح.';
      } catch (err) {
        console.error(err);
        tsplStatus.style.color = 'var(--danger-text)';
        tsplStatus.textContent = '⚠️ ' + (err && err.message ? err.message : 'تعذّر الإرسال');
      }
    }, 'عيّنة خطوط الطابعة')
  );

  // ---- ضبط مكان الطباعة ----
  const alignX = overlay.querySelector('#align-x');
  const alignY = overlay.querySelector('#align-y');
  const alignShrink = overlay.querySelector('#align-shrink');
  const alignStatus = overlay.querySelector('#align-status');

  const fillAlign = () => {
    const a = getPrintAlign();
    alignX.value = a.x;
    alignY.value = a.y;
    alignShrink.value = a.shrink;
  };
  const readAlign = () => ({
    x: Number(alignX.value) || 0,
    y: Number(alignY.value) || 0,
    shrink: Number(alignShrink.value) || 0,
  });
  // بنحفظ الأول وبعدين نقرا تاني — عشان الخانات تبان بالقيمة **بعد** الحد
  // الأقصى والتقريب، فاللي شايفه هو اللي هيتطبع فعلًا.
  const commitAlign = () => {
    savePrintAlign(readAlign());
    fillAlign();
  };
  fillAlign();

  const STEP = 0.2;
  overlay.querySelectorAll('#align-pad [data-nudge]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.getAttribute('data-nudge');
      const a = readAlign();
      if (dir === 'zero') savePrintAlign({ x: 0, y: 0, shrink: 0 });
      else {
        if (dir === 'left') a.x -= STEP;
        if (dir === 'right') a.x += STEP;
        if (dir === 'up') a.y -= STEP;
        if (dir === 'down') a.y += STEP;
        savePrintAlign(a);
      }
      fillAlign();
      alignStatus.style.color = 'var(--text-secondary)';
      alignStatus.textContent = 'اتحفظ. اطبع الإطار تاني وشوف.';
    });
  });

  overlay.querySelector('#align-save').addEventListener('click', () => {
    commitAlign();
    alignStatus.style.color = '#2e7d32';
    alignStatus.textContent = '✅ اتحفظ على الجهاز ده.';
  });

  overlay.querySelector('#align-frame').addEventListener('click', () =>
    safeAsync(async () => {
      // بنحفظ قبل الطباعة عشان الإطار يطلع بالأرقام اللي مكتوبة قدامه
      // دلوقتي، مش بأرقام قديمة — ده أكتر مصدر لبس متوقّع هنا.
      commitAlign();
      if (!labelSelect.value) {
        alignStatus.style.color = 'var(--danger-text)';
        alignStatus.textContent = 'اختار طابعة الملصق الأول.';
        return;
      }
      // الطباعة بتقرا الطابعة المحفوظة، مش اللي مختارة في القايمة. لو
      // المستخدم غيّر الاختيار وما ضغطش حفظ، الإطار كان هيروح للطابعة
      // القديمة — فبنحفظ الاختيار هنا قبل ما نبعت.
      saveSelectedPrinter('label', labelSelect.value);
      alignStatus.style.color = 'var(--text-secondary)';
      alignStatus.textContent = 'جارٍ إرسال الإطار...';
      const viaQZ = await printTestFrame(38, 25);
      alignStatus.style.color = viaQZ ? '#2e7d32' : 'var(--text-secondary)';
      alignStatus.textContent = viaQZ
        ? '✅ اتبعت. قارن الإطار بحدود الملصق نفسه.'
        : 'اتفتحت نافذة طباعة المتصفح (QZ مش شغّال).';
    }, 'طباعة إطار التجربة')
  );

  // ---- النسخ من جهاز تاني ----
  // بنعرضه بس لو فيه فعلًا جهاز تاني عنده ضبط محفوظ — قسم فاضي بيخوّف
  // ومابيفيدش.
  const copyBox = overlay.querySelector('#copy-box');
  const copyFrom = overlay.querySelector('#copy-from');
  const copyStatus = overlay.querySelector('#copy-status');
  const myDeviceId = getDeviceId();
  const sources = (state.printStations || []).filter(
    (s) => s.id !== myDeviceId && s.printSetup && typeof s.printSetup === 'object'
  );

  if (sources.length) {
    copyBox.style.display = 'block';
    copyFrom.innerHTML = sources
      .map((s) => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.deviceName || 'جهاز بدون اسم')}</option>`)
      .join('');

    overlay.querySelector('#copy-run').addEventListener('click', () => {
      const src = sources.find((s) => s.id === copyFrom.value);
      if (!src) return;

      const done = [];
      const setup = src.printSetup || {};

      if (setup.align) {
        savePrintAlign(setup.align);
        fillAlign();
        const a = getPrintAlign();
        done.push(`ضبط مكان الطباعة (X ${a.x} / Y ${a.y} / -${a.shrink}%)`);
      }
      if (setup.tweaks) {
        setPrintTweaksMap(setup.tweaks);
        overlay.querySelectorAll('[data-tweak]').forEach((box) => {
          box.checked = getPrintTweak(box.getAttribute('data-tweak'));
        });
        const on = PRINT_TWEAKS.filter((t) => getPrintTweak(t.key)).length;
        done.push(on ? `الإعدادات المتقدمة (${on} مفتوح)` : 'الإعدادات المتقدمة (كلهم مقفولين)');
      }

      // الطابعة بتتنسخ **بالاسم**، وبس لو الاسم ده موجود فعلًا على الجهاز
      // ده. من غير الشرط ده كنا هنحفظ اسم طابعة مش موجودة، والطباعة تفضل
      // تفشل من غير سبب واضح.
      const missing = [];
      [
        ['label', src.labelPrinter, labelSelect, 'طابعة الملصق'],
        ['restock', src.restockPrinter, restockSelect, 'طابعة ورقة التزويد'],
      ].forEach(([, name, select, label]) => {
        if (!name) return;
        if (printers.indexOf(name) !== -1) {
          select.value = name;
          done.push(`${label}: ${name}`);
        } else {
          missing.push(`${label} "${name}" مش موجودة على الجهاز ده — اختارها بنفسك`);
        }
      });

      copyStatus.style.color = '#2e7d32';
      copyStatus.innerHTML =
        `✅ اتنسخ: ${escapeHTML(done.join('، '))}` +
        (missing.length ? `<br><span style="color:var(--danger-text);">⚠️ ${escapeHTML(missing.join(' — '))}</span>` : '') +
        `<br><span style="color:var(--text-secondary);">اضغط <strong>حفظ</strong> تحت، وبعدين اطبع الإطار وتأكد — الزحلقة بتفرق شوية من طابعة لطابعة.</span>`;
    });
  }

  // ---- المعايرة ----
  const calStatus = overlay.querySelector('#cal-status');
  overlay.querySelector('#cal-run').addEventListener('click', () =>
    safeAsync(async () => {
      const printerName = labelSelect.value;
      if (!printerName) {
        calStatus.style.color = 'var(--danger-text)';
        calStatus.textContent = 'اختار طابعة الملصق الأول.';
        return;
      }
      const w = Number(overlay.querySelector('#cal-w').value) || 38;
      const h = Number(overlay.querySelector('#cal-h').value) || 25;
      const gap = Number(overlay.querySelector('#cal-gap').value) || 2;

      // تأكيد فيه اسم الطابعة بالظبط — دي العملية الوحيدة اللي بتغيّر حاجة
      // في العتاد، فمينفعش تحصل بضغطة غلط.
      const ok = confirm(
        `هتتم معايرة الطابعة:\n${printerName}\n\n` +
          `مقاس الملصق: ${w} × ${h} مم، الفراغ ${gap} مم\n\n` +
          `الطابعة هتطلّع 2-3 ملصقات وهي بتقيس.\nتكمّل؟`
      );
      if (!ok) return;

      calStatus.style.color = 'var(--text-secondary)';
      calStatus.textContent = 'جارٍ المعايرة...';
      try {
        await calibratePrinter(printerName, w, h, gap);
        calStatus.style.color = '#2e7d32';
        calStatus.textContent = '✅ اتبعتت. شوف الطابعة — المفروض طلّعت ملصقين تلاتة. جرّب تطبع دلوقتي.';
      } catch (err) {
        console.error(err);
        calStatus.style.color = 'var(--danger-text)';
        calStatus.textContent = '⚠️ ' + (err && err.message ? err.message : 'تعذّرت المعايرة');
      }
    }, 'معايرة الطابعة')
  );

  saveBtn.addEventListener('click', () => {
    saveSelectedPrinter('label', labelSelect.value);
    saveSelectedPrinter('restock', restockSelect.value);
    saveDeviceName(deviceNameInput.value.trim());
    closeSettings();
    // نسجّل الجهاز فورًا بالاسم والطابعات الجديدة، عشان يظهر لزمايله
    // على طول من غير ما يستنى النبضة الجاية.
    startStationHeartbeat();
    subscribePrintJobs();
  });
}
