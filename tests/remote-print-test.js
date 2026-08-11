// ============================================================
// الطباعة عن بُعد — الفشل لازم يوصل، والجهاز مايتجمّدش
// ============================================================
// تلات أعطال حقيقية اتبلّغوا مع بعض:
//
// 1) **الجهاز المضيف بيتجمّد**. كان فيه confirm() بيسأل "خرجوا من الماكينة
//    فعلًا؟" بعد أي طبعة كبيرة. confirm() بتوقف خيط الجافاسكريبت **كله** —
//    فالجهاز اللي مافيهوش حد واقف عنده كان بيقف: مايسمعش طلبات جديدة،
//    ومايكمّلش الطلب الحالي، واللي باعت يفضل مستني للأبد.
//
// 2) **الفشل بيتبلّغ كنجاح**. executePrintJob كان بيكتب status:'printed'
//    من غير أي شرط. فلو QZ مش شغّال أو الطابعة وقفت في النص، اللي على
//    الموبايل كان بيوصله "✅ اتطبع".
//
// 3) **مافيش شريط تقدم عند اللي بعت** — كان بيستنى في الفراغ.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof executePrintJob === 'function');

  // ⚠️ لو أي كود فتح confirm/alert، بلوك رايت بيعلّق الصفحة للأبد.
  // بنمسكهم ونعدّهم بدل ما نستنى.
  await p.evaluate(() => {
    window.__blocking = [];
    window.confirm = (m) => { window.__blocking.push(['confirm', String(m).slice(0, 40)]); return true; };
    window.alert = (m) => { window.__blocking.push(['alert', String(m).slice(0, 40)]); };
  });

  const boot = () => p.evaluate(() => {
    window.__updates = [];
    const noop = () => () => {};
    const docRef = () => ({
      set: () => Promise.resolve(),
      update: (d) => { window.__updates.push(d); return Promise.resolve(); },
      onSnapshot: noop, get: () => Promise.resolve({ exists: false }), collection: () => mk(),
    });
    const mk = () => ({ doc: docRef, get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
    window.db = { collection: mk, collectionGroup: mk };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    state.user = { uid: 'host' };
    state.profile = { name: 'الجهاز المضيف', role: 'admin', warehouseAccess: 'both' };
    localStorage.setItem('tazweed_qz_label_printer', 'X');
    localStorage.setItem('tazweed_qz_tweak_fastCopies', '0');
  });
  await boot();

  // بيجهّز طلب طباعة فيه n ملصق
  const makeJob = (n) => p.evaluate(async ([n, SIZE]) => {
    const t = await buildItemLabel(
      { itemName: 'Chanvie Leen 58047', barcodeNumber: '62808737', sellingPrice: 495 }, SIZE, n);
    return { type: 'label', sizeOptions: SIZE, jobs: [{ html: t.jobHTML, image: t.image, copies: n }] };
  }, [n, SIZE]);

  // ============================================================
  // 1) ⭐ الطباعة نجحت → printed
  // ============================================================
  const okRun = await p.evaluate(async (job) => {
    window.__updates = []; window.__blocking = [];
    window.qz = {
      configs: { create: (n, o) => ({ printer: n, opts: o }) },
      print: () => Promise.resolve(),
      websocket: { connect: () => Promise.resolve() },
      security: { setCertificatePromise() {}, setSignatureAlgorithm() {}, setSignaturePromise() {} },
    };
    window.isQZAvailable = () => true; window.ensureQZConnected = () => Promise.resolve(true);
    await executePrintJob('j1', job);
    const last = window.__updates[window.__updates.length - 1];
    return { last, updates: window.__updates.length, blocking: window.__blocking };
  }, await makeJob(40));
  check('⭐ الطباعة نجحت → الحالة printed', okRun.last && okRun.last.status === 'printed', okRun);

  // ============================================================
  // 2) ⭐⭐ الجهاز مايتجمّدش — مفيش confirm خالص
  // ============================================================
  // ده الفحص اللي بيمنع رجوع العطل الأساسي. أي confirm() في مسار الطباعة
  // بتقفل الجهاز المستقبِل بالكامل.
  check('⭐⭐ مفيش أي confirm() في مسار الطباعة',
    !okRun.blocking.some((x) => x[0] === 'confirm'), okRun.blocking);
  check('⭐ ومفيش رسالة موقّفة خالص في الطبعة الناجحة',
    okRun.blocking.length === 0, okRun.blocking);

  // ============================================================
  // 3) ⭐ التقدم بيتبعت للي بعت
  // ============================================================
  const prog = okRun.updates > 1;
  check('⭐ التقدم اتبعت للسحابة وهي بتطبع', prog, { updates: okRun.updates });
  const progShape = await p.evaluate(() =>
    (window.__updates || []).filter((u) => u.progressTotal !== undefined).map((u) => `${u.progressDone}/${u.progressTotal}`));
  check('⭐ وبصيغة "وصلنا كام من كام"',
    progShape.length > 0 && progShape.every((x) => /^\d+\/40$/.test(x)), progShape);

  // ============================================================
  // 4) ⭐⭐ الفشل بيتبلّغ فشل — مش نجاح
  // ============================================================
  const cases = await p.evaluate(async (job) => {
    const out = {};
    const run = async (name, setup) => {
      window.__updates = []; window.__blocking = [];
      setup();
      await executePrintJob('j-' + name, job);
      const last = window.__updates[window.__updates.length - 1];
      out[name] = { status: last && last.status, reason: last && last.failReason, blocking: window.__blocking.length };
    };

    // (أ) QZ مش شغّال على الجهاز المضيف
    await run('qzDown', () => {
      window.ensureQZConnected = () => Promise.resolve(false);
    });

    // (ب) الطابعة وقفت في النص (الورق خلص)
    await run('stalled', () => {
      window.ensureQZConnected = () => Promise.resolve(true);
      let n = 0;
      window.qz.print = () => { n++; return n <= 2 ? Promise.resolve() : Promise.reject(new Error('الورق خلص')); };
    });

    // (ج) مافيش طابعة مظبوطة على الجهاز أصلًا
    await run('noPrinter', () => {
      window.qz.print = () => Promise.resolve();
      localStorage.removeItem('tazweed_qz_label_printer');
    });
    localStorage.setItem('tazweed_qz_label_printer', 'X');
    return out;
  }, await makeJob(40));

  for (const [k, label] of [['qzDown', 'QZ مش شغّال'], ['stalled', 'الطابعة وقفت في النص'], ['noPrinter', 'مافيش طابعة مظبوطة']]) {
    check(`⭐⭐ ${label} → الحالة failed مش printed`, cases[k].status === 'failed', cases[k]);
    check(`⭐ و${label}: السبب بيتبعت مع الفشل`,
      !!cases[k].reason && cases[k].reason.length > 5, cases[k]);
  }
  // ⚠️ الأهم: "وقفت في النص" هي الحالة اللي كانت بترجّع true وتتبلّغ نجاح
  check('⭐⭐ "وقفت في النص" السبب فيه العدد اللي اتطبع',
    /\d+\s*من\s*\d+/.test(cases.stalled.reason || ''), cases.stalled);
  // ولا واحدة فيهم علّقت الجهاز
  check('⭐⭐ ولا حالة فشل واحدة علّقت الجهاز بـconfirm',
    Object.values(cases).every((c) => c.blocking <= 1), cases);

  // ============================================================
  // 5) نتيجة الطباعة بتتسجّل صح جوه tryPrintViaQZ نفسها
  // ============================================================
  const outcome = await p.evaluate(async (job) => {
    window.ensureQZConnected = () => Promise.resolve(true);
    window.qz.print = () => Promise.resolve();
    await tryPrintViaQZ('label', job.jobs, job.sizeOptions);
    const good = { ...lastPrintOutcome };
    window.qz.print = () => Promise.reject(new Error('مفصولة'));
    await tryPrintViaQZ('label', job.jobs, job.sizeOptions);
    const bad = { ...lastPrintOutcome };
    return { good, bad };
  }, await makeJob(40));
  check('⭐ النجاح بيتسجّل ok=true بالعدد الكامل',
    outcome.good.ok === true && outcome.good.done === 40, outcome.good);
  check('⭐ والفشل بيتسجّل ok=false ومعاه سبب',
    outcome.bad.ok === false && !!outcome.bad.reason, outcome.bad);

  // ============================================================
  // 6) ⚡ المسار السريع (مفتاح fastCopies)
  // ============================================================
  const fast = await p.evaluate(async (job) => {
    const runWith = async (on) => {
      const msgs = [], cfgs = [];
      window.qz.print = (cfg, data) => { msgs.push(data); cfgs.push(cfg.opts || {}); return Promise.resolve(); };
      localStorage.setItem('tazweed_qz_tweak_fastCopies', on ? '1' : '0');
      await tryPrintViaQZ('label', job.jobs, job.sizeOptions);
      const bytes = msgs.reduce((s, m) => s + m.reduce((a, pg) => a + pg.data.length, 0), 0);
      return { رسائل: msgs.length, 'كيلو': +(bytes / 1024).toFixed(0), نسخ: cfgs.map((c) => c.copies).filter(Boolean) };
    };
    const off = await runWith(false);
    const on = await runWith(true);
    localStorage.setItem('tazweed_qz_tweak_fastCopies', '0');
    return { off, on };
  }, await makeJob(40));
  check('⭐ المفتاح مقفول = السلوك القديم بالظبط (مفيش نسخ)',
    fast.off['نسخ'].length === 0, fast.off);
  check('⭐ المفتاح مفتوح → رسايل أقل بكتير', fast.on['رسائل'] < fast.off['رسائل'] / 3, fast);
  check('⭐ وبيانات أخف بكتير', fast.on['كيلو'] < fast.off['كيلو'] / 5, fast);
  check('⭐ والعدد بيتبعت كـcopies', fast.on['نسخ'].length > 0, fast.on);
  check('⭐ المفتاح موجود في شاشة الإعدادات',
    await p.evaluate(() => PRINT_TWEAKS.some((t) => t.key === 'fastCopies')));
  check('⭐ ومطفي افتراضيًا (محتاج تجربة على ورق)',
    await p.evaluate(() => { localStorage.removeItem('tazweed_qz_tweak_fastCopies'); return !getPrintTweak('fastCopies'); }));

  console.log('\nالسرعة (40 ملصق):', JSON.stringify(fast));
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
