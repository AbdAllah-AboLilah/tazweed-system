// ============================================================
// ⏹️ "وقّف الباقي" — والوعد اللي مايتقالش
// ============================================================
// ⚠️⚠️ أهم حاجة في الملف ده **مش برمجية، لغوية**: الزرار ماينفعش يكتب
// عليه "إلغاء".
//
// أول ما `qz.print()` تتنادى، الدفعة بتبقى في طابور ويندوز — ومن المتصفح
// مفيش طريقة نسحبها، وQZ Tray مالوش أمر إلغاء. يعني اللي في الماكينة
// **هيخرج** مهما عملنا. ولو الزرار قال "إلغاء" وطلعوا 20 ملصق بعد
// الضغط، المستخدم هيفتكر إنه باظ — وده أوحش من إن الزرار مايبقاش موجود.
//
// فالفحص بيحرس حاجتين: إن الإيقاف **بيشتغل فعلًا**، وإن الكلام المكتوب
// **مايوعدش بحاجة مش بإيدنا**.
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof tryPrintViaQZ === 'function');

  await p.evaluate(() => {
    window.__setupQZ = (onPrint) => {
      localStorage.clear();
      const msgs = [];
      window.__msgs = msgs;
      window.qz = {
        configs: { create: (n, o) => ({ printer: n, opts: o }) },
        print: (cfg, data) => { msgs.push(data); return onPrint ? onPrint(msgs.length) : Promise.resolve(); },
        websocket: { connect: () => Promise.resolve() },
        security: { setCertificatePromise() {}, setSignatureAlgorithm() {}, setSignaturePromise() {} },
      };
      window.isQZAvailable = () => true;
      window.ensureQZConnected = () => Promise.resolve(true);
      localStorage.setItem('tazweed_qz_label_printer', 'Xprinter XP-233B');
      state.user = { uid: 'me' };
      window.db = { collection: () => ({ doc: () => ({ set: () => Promise.resolve(), onSnapshot: () => () => {} }) }) };
      window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
      window.alert = () => {};
      window.confirm = () => true;
    };
  });

  // ============================================================
  // 1) ⭐⭐ الإيقاف بيقف الباقي فعلًا
  // ============================================================
  // 60 ملصق، دفعة 10 → 6 دفعات. بنوقف بعد التانية.
  const stopped = await p.evaluate(async (SIZE) => {
    window.__setupQZ(() => {
      // بنوقف بعد الدفعة التانية بالظبط
      if (window.__msgs.length === 2) requestPrintCancel();
      return Promise.resolve();
    });
    localStorage.setItem('tazweed_print_batch', '10');
    localStorage.setItem('tazweed_print_pace_ms', '0');
    localStorage.setItem('tazweed_qz_tweak_fastCopies', '0');
    const html = buildGradeLabelHTML('كريب سادة لوكس — كيوي درجة 56', SIZE, 1);
    const ret = await tryPrintViaQZ('label', [{ html, image: null, copies: 60 }], SIZE);
    return {
      ret,
      jobs: window.__msgs.length,
      pagesSent: window.__msgs.reduce((s, x) => s + x.length, 0),
      outcome: lastPrintOutcome,
    };
  }, SIZE);
  check('⭐⭐ وقفت بعد الدفعة التانية؟ مابعتش الباقي',
    stopped.jobs === 2 && stopped.pagesSent === 20, stopped);
  check('⭐ ومن غير الإيقاف كان هيبعت الستة', stopped.pagesSent < 60, stopped);

  // ============================================================
  // 2) ⭐⭐ النتيجة حالة **تالتة**، لا نجاح ولا فشل
  // ============================================================
  // لو "اتوقفت" اتحسبت "فشلت"، المستخدم هيدوّر على عطل مش موجود — هو
  // اللي وقفها. ولو اتحسبت "اتطبعت"، هيفتكر إن الـ60 خرجوا وهما 20.
  check('⭐⭐ الحالة "اتوقفت" مش "فشلت"', stopped.outcome.cancelled === true, stopped.outcome);
  check('⭐⭐ ومش "اتطبعت"', stopped.outcome.ok === false, stopped.outcome);
  check('⭐ والسبب بيقول اتبعت كام من كام',
    /20/.test(stopped.outcome.reason) && /60/.test(stopped.outcome.reason), stopped.outcome);
  check('⭐ والأرقام مسجّلة',
    stopped.outcome.done === 20 && stopped.outcome.total === 60, stopped.outcome);

  // ============================================================
  // 3) ⭐ الطبعة العادية مش متأثرة
  // ============================================================
  const normal = await p.evaluate(async (SIZE) => {
    window.__setupQZ();
    localStorage.setItem('tazweed_print_batch', '10');
    localStorage.setItem('tazweed_print_pace_ms', '0');
    localStorage.setItem('tazweed_qz_tweak_fastCopies', '0');
    const html = buildGradeLabelHTML('كريب سادة', SIZE, 1);
    await tryPrintViaQZ('label', [{ html, image: null, copies: 60 }], SIZE);
    return { pages: window.__msgs.reduce((s, x) => s + x.length, 0), outcome: lastPrintOutcome };
  }, SIZE);
  check('⭐ من غير إيقاف: الستين بيتبعتوا وبتتحسب نجاح',
    normal.pages === 60 && normal.outcome.ok === true && normal.outcome.cancelled === false, normal);

  // ⚠️ الحالة دي بتمسك عطل حقيقي: لو العلامة فضلت مرفوعة من الطبعة
  // اللي فاتت، الطبعة الجاية هتقف من أول دفعة **من غير ما حد يضغط حاجة**.
  check('⭐⭐ والعلامة اتصفّرت من الطبعة اللي قبلها (مش بتفضل مرفوعة)',
    normal.pages === 60, normal);

  // ============================================================
  // 4) ⭐⭐ مسار "النسخ" بيقف هو كمان
  // ============================================================
  const fast = await p.evaluate(async (SIZE) => {
    window.__setupQZ(() => {
      if (window.__msgs.length === 1) requestPrintCancel();
      return Promise.resolve();
    });
    localStorage.setItem('tazweed_print_batch', '20');
    localStorage.setItem('tazweed_print_pace_ms', '0');
    localStorage.setItem('tazweed_qz_tweak_fastCopies', '1');
    const html = buildGradeLabelHTML('كريب سادة', SIZE, 1);
    await tryPrintViaQZ('label', [{ html, image: null, copies: 100 }], SIZE);
    return { jobs: window.__msgs.length, outcome: lastPrintOutcome };
  }, SIZE);
  check('⭐⭐ مسار "النسخ" بيقف بعد أول دفعة', fast.jobs === 1, fast);
  check('⭐ وبيسجّل "اتوقفت" هو كمان', fast.outcome.cancelled === true, fast.outcome);

  // ============================================================
  // 5) ⭐⭐ الانتظار بين الدفعات **بيتقطع** فورًا
  // ============================================================
  // ⚠️ من غير ده تدوس "وقّف" وتقعد مستني لحد 20 ثانية والشريط قدامك مش
  // بيعمل حاجة — فتفتكر إن الزرار مش شغّال وتدوس تاني.
  const timing = await p.evaluate(async (SIZE) => {
    window.__setupQZ(() => {
      if (window.__msgs.length === 1) setTimeout(() => requestPrintCancel(), 50);
      return Promise.resolve();
    });
    localStorage.setItem('tazweed_print_batch', '10');
    localStorage.setItem('tazweed_print_pace_ms', '300'); // 10 × 300 = 3 ثواني انتظار
    localStorage.setItem('tazweed_qz_tweak_fastCopies', '0');
    const html = buildGradeLabelHTML('كريب سادة', SIZE, 1);
    const t0 = performance.now();
    await tryPrintViaQZ('label', [{ html, image: null, copies: 60 }], SIZE);
    return { ms: Math.round(performance.now() - t0), jobs: window.__msgs.length };
  }, SIZE);
  check('⭐⭐ الضغطة بتقطع الانتظار (مش بتستنى الـ3 ثواني)',
    timing.ms < 1200, timing);
  check('⭐ وبرضه وقف بعد أول دفعة', timing.jobs === 1, timing);

  // ============================================================
  // 6) ⭐⭐ الكلام المكتوب مايوعدش بحاجة مش بإيدنا
  // ============================================================
  const stripComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');
  const src = stripComments(fs.readFileSync(__dirname + '/../js/print-core.js', 'utf8'));
  check('⭐⭐ الزرار مكتوب عليه "وقّف الباقي" مش "إلغاء الطباعة"',
    /وقّف الباقي/.test(src) && !/إلغاء الطباعة/.test(src), null);
  check('⭐⭐ ومكتوب تحته إن اللي في الماكينة هيكمّل',
    /اللي اتبعت للماكينة خلاص هيكمّل/.test(src), null);
  check('⭐ ورسالة النتيجة بتقول "لحد" مش رقم قاطع',
    /اتبعت لحد \$\{done\}/.test(src), null);
  check('⭐ والزرار بيقول إنه شغّال بعد الضغط (مش بيفضل ساكت)',
    /بيقف بعد الدفعة دي/.test(src), null);

  // ============================================================
  // 7) ⭐⭐ الإيقاف من الموبايل — الشغل بيتم من الموبايل
  // ============================================================
  // شريط التقدم بيظهر على الجهازين. لو الزرار على الكمبيوتر بس، يبقى
  // ناقص في الاستخدام الأساسي.
  check('⭐⭐ اللي بعت من تليفونه بيعلّم على الطلب بـcancelRequested',
    /cancelRequested: true/.test(src), null);
  check('⭐⭐ والجهاز اللي بيطبع بيسمع العلامة وينده الإيقاف',
    /d\.cancelRequested\) requestPrintCancel\(\)/.test(src), null);
  check('⭐ والمستمع بيتقفل بعد الطبعة (مش استعلام دايم)',
    /finally \{\s*stopWatch\(\);/.test(src), null);
  check('⭐⭐ والحالة بتتكتب "stopped" مش "failed"',
    /status: 'stopped'/.test(src), null);
  check('⭐ واللي على الموبايل بيشوف رسالة إيقاف مش رسالة عطل',
    /data\.status === 'stopped'/.test(src), null);

  // ⚠️ الطبعة اللي اتوقفت **ماتكملش** على نافذة المتصفح — ده معناه إن
  // اللي وقفه يرجع يتطبع تاني وكامل.
  check('⭐⭐ الطبعة الموقوفة مابترجعش لنافذة المتصفح',
    /!printedViaQZ && !outcome\.cancelled/.test(src), null);

  // ============================================================
  // 8) ⭐ القواعد: محدش يوقّف طبعة حد تاني
  // ============================================================
  const rules = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
  check('⭐⭐ صاحب الطلب بس هو اللي يقدر يوقّفه',
    /onlyChangedKeys\(\['cancelRequested'\]\)/.test(rules) &&
    /resource\.data\.requestedByUid == request\.auth\.uid/.test(rules), null);
  check('⭐ والإيقاف مايغيّرش الحالة بنفسه (اللي بيطبع هو اللي بيقرّر)',
    /onlyChangedKeys\(\['cancelRequested'\]\)[\s\S]{0,120}newStatus\(\) == 'pending'/.test(rules), null);
  check('⭐ والقواعد بتقبل حالة stopped', /'printed', 'failed', 'stopped'/.test(rules), null);

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
