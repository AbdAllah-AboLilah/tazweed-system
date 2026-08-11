// ============================================================
// الطباعة من الموبايل لازم تطلع زي الطباعة من الكمبيوتر
// ============================================================
// ⚠️ العطل اللي اتصوّر على ورق: **نفس الدرجة بالظبط**
//   • من الكمبيوتر → "بونيه حجاب — بندانه سوري مفتوح درجة 4"  ✅
//   • من الموبايل  → "بونيه حجاب — بندانه سوري" بخط أكبر      ❌ ناقصة
//
// السبب: مقاس الخط كان بيتحسب **بالقياس على الجهاز الباعت**. الموبايل
// مافيهوش Tahoma ولا Arial، وأندرويد بيبدّلهم بخط مقاساته أضيق للعربي —
// فبيقول "الكلام ده يدخل بمقاس 4مم"، وبيحط الرقم ده في الـCSS ويبعته.
// والكمبيوتر بيرسم نفس الـCSS بخطوطه **هو** (الأعرض)، فالكلام مايدخلش
// و`-webkit-line-clamp` بتقص السطر الزيادة **في صمت** — من غير خطأ ولا
// حتى نقط.
//
// الحل: الطلب بيحمل **وصفة** (نص + عدد)، والجهاز اللي هيطبع بيعيد البناء
// بخطوطه هو.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
// النص اللي وقع فعلًا على ورق
const REAL = 'بونيه حجاب — بندانه سوري مفتوح درجة 4';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof rebuildFromSpec === 'function');

  await p.evaluate(() => {
    window.__sent = [];
    window.__updates = [];
    const noop = () => () => {};
    const mk = () => ({
      doc: () => ({
        set: (d) => { window.__sent.push(d); return Promise.resolve(); },
        update: (d) => { window.__updates.push(d); return Promise.resolve(); },
        onSnapshot: noop, get: () => Promise.resolve({ exists: false }), collection: mk,
      }),
      get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}),
    });
    window.db = { collection: mk, collectionGroup: mk };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    window.alert = () => {};
    state.user = { uid: 'me' };
    state.profile = { name: 'AboLilah', role: 'owner', warehouseAccess: 'both' };
    state.isOnline = true;
    state.printStations = [{ id: 'pc1', deviceName: 'الكمبيوتر' }];
  });

  // ============================================================
  // 1) ⭐ الطلب المبعوت فيه **وصفة** مش HTML جاهز وبس
  // ============================================================
  const sent = await p.evaluate(async ([REAL, SIZE]) => {
    window.__sent = [];
    await sendPrintJob('label', 'pc1', [{ html: '<html></html>', image: null, copies: 2 }], SIZE, null,
      { kind: 'text', text: REAL, copies: 2 });
    const j = window.__sent[0];
    return { hasSpec: !!(j && j.spec), spec: j && j.spec, hasHTML: !!(j && j.html !== undefined) };
  }, [REAL, SIZE]);
  check('⭐ الطلب بيحمل وصفة الملصق', sent.hasSpec && sent.spec.kind === 'text', sent);
  check('⭐ والنص كامل جوّاها', sent.spec && sent.spec.text === REAL, sent.spec);
  // ⚠️ الـHTML الجاهز فاضل مبعوت — الأجهزة اللي لسه على نسخة قديمة
  // مش عارفة الوصفة، ولازم تفضل تطبع حاجة صح بدل ما تقف
  check('⭐ والـHTML الجاهز لسه مبعوت (توافق مع النسخ القديمة)', sent.hasHTML, sent);

  // ============================================================
  // 2) ⭐⭐ الجهاز اللي بيطبع **بيعيد البناء** — مش بياخد اللي جاله
  // ============================================================
  const rebuilt = await p.evaluate(async ([REAL, SIZE]) => {
    // "HTML من موبايل" — بمقاس خط غلط (كبير) زي ما كان بيحصل بالظبط
    const wrong = '<!doctype html><html><body><div class="t" style="font-size:9mm">' + REAL + '</div></body></html>';
    const out = await rebuildFromSpec({ kind: 'text', text: REAL, copies: 3 }, SIZE);
    const mine = buildTextLabel(REAL, SIZE, 1).jobHTML;
    return {
      got: !!out,
      copies: out && out[0].copies,
      // اللي اتبنى هنا = اللي الجهاز ده بيبنيه لنفسه بالظبط
      sameAsLocal: out && out[0].html === mine,
      ignoredWrong: out && out[0].html !== wrong,
    };
  }, [REAL, SIZE]);
  check('⭐⭐ الوصفة بتتحوّل لملصق متبني هنا', rebuilt.got, rebuilt);
  check('⭐⭐ والناتج = اللي الجهاز ده بيبنيه لنفسه بالظبط', rebuilt.sameAsLocal, rebuilt);
  check('⭐ يعني مقاس الخط الغلط اللي جه من الموبايل اتجاهل', rebuilt.ignoredWrong, rebuilt);
  check('⭐ والعدد بيتنقل صح', rebuilt.copies === 3, rebuilt);

  // ============================================================
  // 3) ⭐ النص كامل — مافيش سطر بيضيع
  // ============================================================
  // ده اللي وقع على ورق: "مفتوح درجة 4" اختفت. الفحص بيرسم الملصق ويتأكد
  // إن **كل كلمة** في النص ظاهرة فعلًا مش مقصوصة.
  const p2 = await b.newPage({ deviceScaleFactor: 2 });
  const html = await p.evaluate(([REAL, SIZE]) => buildTextLabel(REAL, SIZE, 1).jobHTML, [REAL, SIZE]);
  await p2.setContent(html);
  const drawn = await p2.evaluate(() => {
    const el = document.querySelector('.t');
    return {
      text: el.textContent.trim(),
      clipped: el.scrollHeight > el.clientHeight + 1,
      lines: Math.max(1, Math.round(el.clientHeight / (parseFloat(getComputedStyle(el).lineHeight) || 1))),
    };
  });
  check('⭐⭐ النص كامل مش متقصوص', !drawn.clipped, drawn);
  check('⭐ وكل الكلمات موجودة', drawn.text === REAL, drawn);

  // ============================================================
  // 4) ⭐ الوصفة بتغطّي كل أشكال الملصقات
  // ============================================================
  const kinds = await p.evaluate(async (SIZE) => {
    const cat = { itemName: 'Chanvie Leen', barcodeNumber: '62808737', sellingPrice: 495 };
    const item = await rebuildFromSpec({ kind: 'item', cat, copies: 2 }, SIZE);
    const quarter = await rebuildFromSpec({ kind: 'quarter', cat, copies: 2 }, SIZE);
    const many = await rebuildFromSpec({ kind: 'many', items: [
      { kind: 'text', text: 'مسمّى', copies: 1 },
      { kind: 'item', cat, copies: 5 },
    ] }, SIZE);
    // "من غير سعر" بيتنقل مع الصنف مش مع المقاس
    const noPrice = await rebuildFromSpec({ kind: 'item', cat: { ...cat, __noPrice: true }, copies: 1 }, SIZE);
    const withPrice = await rebuildFromSpec({ kind: 'item', cat, copies: 1 }, SIZE);
    return {
      item: !!item, quarter: !!(quarter && /class="cut"/.test(quarter[0].html)),
      many: many && many.length === 2 && many[1].copies === 5,
      noPriceWorks: noPrice && withPrice && noPrice[0].html !== withPrice[0].html,
      unknown: await rebuildFromSpec({ kind: 'حاجة-مش-معروفة' }, SIZE),
    };
  }, SIZE);
  check('⭐ ملصق الصنف', kinds.item, kinds);
  check('⭐ ومقسوم ٤', kinds.quarter, kinds);
  check('⭐ والسلة (أكتر من صنف بأعدادهم)', kinds.many, kinds);
  check('⭐ و"من غير سعر" بيتنقل مع الصنف', kinds.noPriceWorks, kinds);
  // ⚠️ وصفة مش مفهومة = بنرجع للـHTML الجاهز، مش بنطبع ورق فاضي
  check('⭐ وصفة مش مفهومة → بنرجع للـHTML الجاهز', kinds.unknown === null, kinds);

  // ============================================================
  // 5) ⭐ الطلب القديم (من غير وصفة) لسه بيشتغل
  // ============================================================
  const legacy = await p.evaluate(async (SIZE) => {
    window.__updates = [];
    window.qz = {
      configs: { create: (n, o) => ({ printer: n, opts: o }) },
      print: () => Promise.resolve(),
      websocket: { connect: () => Promise.resolve(), isActive: () => true },
      security: { setCertificatePromise() {}, setSignatureAlgorithm() {}, setSignaturePromise() {} },
    };
    window.isQZAvailable = () => true;
    window.ensureQZConnected = () => Promise.resolve(true);
    localStorage.setItem('tazweed_qz_label_printer', 'X');
    await executePrintJob('old', {
      type: 'label', sizeOptions: SIZE,
      jobs: [{ html: '<!doctype html><html><body>قديم</body></html>', image: null, copies: 1 }],
    });
    return window.__updates[window.__updates.length - 1];
  }, SIZE);
  check('⭐ طلب من نسخة قديمة (من غير وصفة) لسه بيتطبع',
    legacy && legacy.status === 'printed', legacy);

  check('مفيش أخطاء في الصفحة', errors.length === 0, errors);
  await b.close();

  if (fail.length) {
    console.log(`❌ فشل (${fail.length}):`);
    fail.forEach((f) => console.log('   ' + f));
    console.log(`\n✅ نجح (${pass.length})`);
    process.exit(1);
  }
  console.log(`✅ نجح (${pass.length})`);
  pass.filter((x) => x.startsWith('⭐')).forEach((x) => console.log('   ' + x));
})();
