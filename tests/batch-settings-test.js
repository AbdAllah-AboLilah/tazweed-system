// ============================================================
// حجم الدفعة والتقديم — أرقام المستخدم بيظبطها عند الماكينة
// ============================================================
// الفكرة اللي وراهم: **مافيش طريقة نعرف من هنا** الماكينة هتستحمل كام.
// خمّنا تلات مرات وشحنّا تلات مرات (8 صفحات → 20 نسخة → 25 + تداخل 70٪ →
// رجعنا 20). اللي واقف قدام الماكينة هو الوحيد اللي يقدر يجاوب.
//
// ⚠️⚠️ وأخطر حاجة في الفحص ده: **الخانة ماتكسرش حد الحجم**. لو المستخدم
// كتب 40 وهو بيطبع ملصق بباركود، الرسالة تبقى 390 كيلو و**تتضاع في
// سكوت** — نفس العطل اللي تعبنا فيه شهور. الرقم بتاعه سقف، مش أمر.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
const LIMIT = 48 * 1024;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof tryPrintViaQZ === 'function');

  // بيئة: QZ مزيّف بيسجّل كل رسالة رايحة له
  await p.evaluate(() => {
    window.__setupQZ = () => {
      localStorage.clear();
      const msgs = [], cfgs = [];
      window.__msgs = msgs; window.__cfgs = cfgs;
      window.qz = {
        configs: { create: (n, o) => ({ printer: n, opts: o }) },
        print: (cfg, data) => { msgs.push(data); cfgs.push(cfg.opts || {}); return Promise.resolve(); },
        websocket: { connect: () => Promise.resolve() },
        security: { setCertificatePromise() {}, setSignatureAlgorithm() {}, setSignaturePromise() {} },
      };
      window.isQZAvailable = () => true;
      window.ensureQZConnected = () => Promise.resolve(true);
      localStorage.setItem('tazweed_qz_label_printer', 'Xprinter XP-233B');
      state.user = { uid: 'me' };
      window.db = { collection: () => ({ doc: () => ({ set: () => Promise.resolve(), onSnapshot: () => () => {} }) }) };
      window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
      // ⚠️ الرسايل الموقّفة بتعلّق الفحص للأبد — بنعدّها بدل ما نستناها
      window.alert = () => {};
      window.confirm = () => true;
    };
  });

  // بيطبع `copies` ملصق من نوع معيّن ويرجّع إزاي اتقسّموا
  const run = (kind, copies, batch, lead, fastCopies) =>
    p.evaluate(async ([kind, copies, batch, lead, fastCopies, SIZE]) => {
      window.__setupQZ();
      localStorage.setItem('tazweed_print_batch', String(batch));
      localStorage.setItem('tazweed_print_lead', String(lead));
      localStorage.setItem('tazweed_print_pace_ms', '0'); // من غير انتظار عشان الفحص يخلص
      localStorage.setItem('tazweed_qz_tweak_fastCopies', fastCopies ? '1' : '0');

      const url = await generateQRDataURL('10632103', 200);
      const cat = { itemName: 'كريب سادة لوكس', barcodeNumber: '10632103', sellingPrice: 120 };
      const html =
        kind === 'grade' ? buildGradeLabelHTML('كريب سادة لوكس — كيوي درجة 56', SIZE, 1)
        : kind === 'quarter' ? buildQuarterLabelHTML(cat, SIZE, url, 1)
        : buildLabelHTML(cat, SIZE, url, 1);

      await tryPrintViaQZ('label', [{ html, image: null, copies }], SIZE);
      const m = window.__msgs;
      return {
        jobs: m.length,
        pages: m.reduce((s, x) => s + x.length, 0),
        maxPerJob: Math.max(...m.map((x) => x.length)),
        maxBytes: Math.max(...m.map((x) => x.reduce((s, pg) => s + pg.data.length + 64, 0))),
        copiesOpt: window.__cfgs.map((c) => c.copies || 0),
        stats: lastBatchStats,
      };
    }, [kind, copies, batch, lead, fastCopies, SIZE]);

  // ============================================================
  // 1) ⭐⭐ الحد بالبايت **مايتكسرش** مهما كتب المستخدم
  // ============================================================
  // ده الفحص اللي بيمنع رجوع العطل الأصلي. المستخدم بيطلب 40، والملصق
  // بباركود 9.7 كيلو — يعني 40 = 390 كيلو، والحد 48.
  const big = await run('item', 40, 40, 0, false);
  check('⭐⭐ طلبت 40 والملصق تقيل؟ الرسالة لسه تحت الحد',
    big.maxBytes <= LIMIT, { أكبر_رسالة_كيلو: Math.round(big.maxBytes / 1024), الحد: 48 });
  check('⭐⭐ والنظام قلّل الدفعة لوحده', big.maxPerJob < 40, big);
  check('⭐ ومع ذلك كل الـ40 اتبعتوا', big.pages === 40, big);

  const huge = await run('quarter', 100, 200, 0, false);
  check('⭐⭐ حتى بأقصى رقم (200) على المقسوم ٤ — الحد صامد',
    huge.maxBytes <= LIMIT, { أكبر_رسالة_كيلو: Math.round(huge.maxBytes / 1024) });
  check('⭐ وكل الـ100 اتبعتوا', huge.pages === 100, huge);

  // ============================================================
  // 2) ⭐⭐ الخانة **بتفرق فعلًا** لما الحجم يسمح
  // ============================================================
  // ⚠️ من غير الفحص ده، الخانة ممكن تبقى مجرد شكل: الحد يقفل قبلها دايمًا
  // فمهما لفّها مافيش حاجة بتتغيّر. الملصق النصّي 1.5 كيلو — 30 منهم
  // 45 كيلو، يعني الحد **مش** هيقف قدامها.
  const small4 = await run('grade', 60, 4, 0, false);
  const small30 = await run('grade', 60, 30, 0, false);
  check('⭐⭐ الملصق الخفيف: الرقم بيتنفّذ زي ما هو',
    small4.maxPerJob === 4 && small30.maxPerJob === 30, { بـ4: small4.maxPerJob, بـ30: small30.maxPerJob });
  check('⭐ ودفعات أكبر = وظايف أقل',
    small30.jobs < small4.jobs, { بـ4: small4.jobs, بـ30: small30.jobs });
  check('⭐ والاتنين بعتوا الـ60 كاملين',
    small4.pages === 60 && small30.pages === 60, { بـ4: small4.pages, بـ30: small30.pages });

  // ============================================================
  // 3) ⭐⭐ في مسار "النسخ" الرقم بيتنفّذ **من غير أي تقليل**
  // ============================================================
  // هنا بنبعت صفحة واحدة ونقول "اطبعها n مرة" — فالحجم مش عامل خالص،
  // وده اللي بيدي المستخدم الـ40 اللي بيسأل عنها.
  const fast = await run('item', 100, 40, 0, true);
  check('⭐⭐ مفتاح "النسخ": 100 ملصق = 3 وظايف بس',
    fast.jobs === 3, { وظايف: fast.jobs, نسخ: fast.copiesOpt });
  check('⭐⭐ والرقم 40 راح للطابعة زي ما هو',
    fast.copiesOpt[0] === 40 && fast.copiesOpt[1] === 40 && fast.copiesOpt[2] === 20, fast.copiesOpt);
  check('⭐ وكل وظيفة صفحة واحدة (مش 40 صفحة)',
    fast.maxPerJob === 1, fast);

  // ============================================================
  // 4) ⭐⭐ التقديم: "ابعت اللي بعدها وفاضل كام"
  // ============================================================
  // ⚠️ الفحص ده بيقيس **وقت حقيقي**. درس اتعلمناه بالغلط قبل كده: لازم
  // نرجّع كل المحاكيات لأصلها الأول، وإلا القياس بيطلع مضلّل تمامًا.
  const timing = await p.evaluate(async (SIZE) => {
    const measure = async (lead) => {
      window.__setupQZ();
      localStorage.setItem('tazweed_print_batch', '10');
      localStorage.setItem('tazweed_print_lead', String(lead));
      localStorage.setItem('tazweed_print_pace_ms', '30'); // 30مث للملصق
      localStorage.setItem('tazweed_qz_tweak_fastCopies', '0');
      const html = buildGradeLabelHTML('كريب سادة', SIZE, 1);
      const t0 = performance.now();
      await tryPrintViaQZ('label', [{ html, image: null, copies: 40 }], SIZE);
      return Math.round(performance.now() - t0);
    };
    return { بدون: await measure(0), بتقديم3: await measure(3), بتقديم10: await measure(10) };
  }, SIZE);
  // 4 دفعات × 10 ملصقات × 30مث = ~900مث انتظار (آخر دفعة مالهاش انتظار)
  // بتقديم 3 → (10-3) × 30 × 3 = ~630مث. بتقديم 10 → صفر.
  check('⭐⭐ التقديم بيقلّل الانتظار فعلًا',
    timing.بتقديم3 < timing.بدون - 100, timing);
  check('⭐⭐ وتقديم بحجم الدفعة كلها = من غير انتظار خالص',
    timing.بتقديم10 < 150, timing);
  check('⭐ ومن غير تقديم بنستنى فعلًا (مش وهم)',
    timing.بدون > 600, timing);

  // ============================================================
  // 5) ⭐ الأرقام المحفوظة: الحدود والافتراضي
  // ============================================================
  const limits = await p.evaluate(() => {
    const out = {};
    localStorage.removeItem('tazweed_print_batch');
    localStorage.removeItem('tazweed_print_lead');
    out.batchDefault = getPrintBatchSize();
    out.leadDefault = getPrintLeadLabels();
    setPrintBatchSize(9999); out.batchMax = getPrintBatchSize();
    setPrintBatchSize(0); out.batchZero = getPrintBatchSize();
    setPrintBatchSize('كلام'); out.batchJunk = getPrintBatchSize();
    setPrintLeadLabels(-5); out.leadNeg = getPrintLeadLabels();
    setPrintLeadLabels(999); out.leadMax = getPrintLeadLabels();
    localStorage.removeItem('tazweed_print_batch');
    localStorage.removeItem('tazweed_print_lead');
    return out;
  });
  check('⭐ الافتراضي 20 (اللي المستخدم جرّبه ورضي عنه)', limits.batchDefault === 20, limits);
  check('⭐⭐ والتقديم افتراضيًا **صفر** — السلوك مايتغيّرش لوحده',
    limits.leadDefault === 0, limits);
  check('⭐ ومفيش رقم بايظ بيعدّي (صفر/سالب/كلام/رقم خرافي)',
    limits.batchMax === 200 && limits.batchZero === 20 && limits.batchJunk === 20 &&
    limits.leadNeg === 0 && limits.leadMax === 50, limits);

  // ============================================================
  // 6) ⭐⭐ التجربة لازم تبقى **باينة**
  // ============================================================
  // ⚠️ من غير ده، المستخدم يكتب 40 ويشوف 4 ويفتكر إن الخانة باظت — وهي
  // الحجم اللي وقف. ده بالظبط اللي لخبطنا في المحادثة.
  check('⭐⭐ النظام بيسجّل الدفعة طلعت كام فعلًا',
    big.stats && big.stats.maxPerJob === big.maxPerJob && big.stats.jobs === big.jobs, big.stats);
  check('⭐ وبيسجّل حجم أكبر رسالة كمان (عشان نعرف مين اللي وقف)',
    big.stats && big.stats.maxKB > 0 && big.stats.maxKB <= 48, big.stats);
  check('⭐ ومسار النسخ بيسجّل هو كمان',
    fast.stats && fast.stats.maxPerJob === 40, fast.stats);

  // ============================================================
  // 7) ⭐ الخانتين موجودين في الشاشة ومربوطين
  // ============================================================
  const ui = await p.evaluate(() => {
    const src = String(openPrinterSettings);
    return {
      batch: /id="pq-batch"/.test(src),
      lead: /id="pq-lead"/.test(src),
      save: /pq-batch-save/.test(src),
      warns: /سقف مش أمر/.test(src),
    };
  });
  check('⭐ الخانتين في شاشة الإعدادات', ui.batch && ui.lead && ui.save, ui);
  check('⭐ ومكتوب فيها إن العدد **سقف مش أمر**', ui.warns, ui);

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
