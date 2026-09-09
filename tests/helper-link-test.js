// توصيل النظام بالبرنامج المساعد
// ============================================================
// البرنامج (helper/) بيبعت للطابعة من غير ما يعدّي على تعريف الويندوز.
// التجربة على ورق حقيقي:
//     النظام (QZ + التعريف) → الورقة بتتقص عند ~211مم
//     البرنامج المساعد      → ورقة 500مم كاملة وآخر سطر باين
//
// ⚠️⚠️ أخطر حاجتين في الملف ده **مش** الطباعة:
//   ١) المفتاح مقفول = **مافيش أي نداء على الشبكة خالص**. لو اتنده
//      وهو مقفول، كل طبعة هتستنى مهلة على جهاز مافيهوش البرنامج.
//   ٢) البرنامج مش شغّال = الطباعة **بتكمّل** بالطريقة القديمة، ومرة
//      واحدة بس بتتفحص — مش مع كل طبعة.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof printSheetViaHelper === 'function' && typeof deliverPrint === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const calls = [];
    const realFetch = window.fetch;
    let mode = 'ok';
    window.fetch = async (url, opts) => {
      calls.push({ url: String(url), method: (opts && opts.method) || 'GET' });
      if (mode === 'down') throw new Error('مفيش اتصال');
      if (String(url).endsWith('/status')) {
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.1.0', printers: ['XP-80C'] }) };
      }
      if (mode === 'refuse') {
        return { ok: false, status: 500, json: async () => ({ error: 'الطابعة مش موجودة' }) };
      }
      return { ok: true, json: async () => ({ ok: true, bytes: 900 }) };
    };
    window.renderSheetImage = async () => ({ image: PNG, widthMm: 72.1, heightMm: 500, bytes: 900 });
    saveSelectedPrinter('restock', 'XP-80C');
    const reset = () => { calls.length = 0; helperCache = null; };

    // ============================================================
    // ⚠️⚠️ المفتاح مقفول = مافيش أي نداء خالص
    // ============================================================
    setPrintTweak('sheetHelper', false);
    reset();
    out.offResult = await printSheetViaHelper('<p>ورقة</p>');
    out.offCalls = calls.length;

    // ---------- المفتاح مفتوح والبرنامج شغّال ----------
    setPrintTweak('sheetHelper', true);
    reset();
    out.onResult = await printSheetViaHelper('<p>ورقة</p>');
    out.onCalls = calls.map((c) => c.method + ' ' + c.url.replace('http://127.0.0.1:7770', ''));
    // ⚠️ الطباعة لازم تكون POST — مش GET
    const printCall = calls.find((c) => c.url.endsWith('/print'));
    out.printIsPost = !!printCall && printCall.method === 'POST';

    // ============================================================
    // ⚠️⚠️ الفحص **مرة واحدة** مش مع كل طبعة
    // ============================================================
    // من غير الخزن، كل طبعة بتستنى مهلة على جهاز مافيهوش البرنامج.
    calls.length = 0;
    await printSheetViaHelper('<p>ورقة</p>');
    await printSheetViaHelper('<p>ورقة</p>');
    out.repeatStatusCalls = calls.filter((c) => c.url.endsWith('/status')).length;
    out.repeatPrintCalls = calls.filter((c) => c.url.endsWith('/print')).length;

    // ---------- البرنامج مش شغّال → الطباعة بتكمّل ----------
    mode = 'down';
    reset();
    out.downResult = await printSheetViaHelper('<p>ورقة</p>');

    // ---------- البرنامج رفض → بيقول ليه ----------
    mode = 'refuse';
    reset();
    const notices = [];
    const realNotice = window.showPrintNotice;
    window.showPrintNotice = (m) => notices.push(String(m));
    out.refuseResult = await printSheetViaHelper('<p>ورقة</p>');
    out.refuseSaid = notices.join(' | ');
    window.showPrintNotice = realNotice;

    // ---------- من غير طابعة متظبطة ----------
    mode = 'ok';
    reset();
    saveSelectedPrinter('restock', '');
    out.noPrinter = await printSheetViaHelper('<p>ورقة</p>');
    saveSelectedPrinter('restock', 'XP-80C');

    // ============================================================
    // ⚠️⚠️ الطلب الجاي من **التليفون** لازم يعدّي على البرنامج كمان
    // ============================================================
    // اتبلّغ بالنص: "اشتغل بس فقط من جهاز الكمبيوتر لكن لما ببعت من
    // التليفون يبعت علي النظام القديم".
    //
    // السبب: الطلب الجاي من بعيد **مابيعديش على deliverPrint** خالص —
    // بيدخل من executePrintJob مباشرة، والبرنامج كان في المسار التاني بس.
    reset();
    mode = 'ok';
    // ⚠️ executePrintJob بتقرا state.user و state.profile — من غيرهم
    // بتقع قبل ما توصل للجزء اللي بنفحصه.
    state.user = { uid: 'u1' };
    state.profile = { name: 'الكمبيوتر', role: 'owner' };
    let qzCalls = 0;
    const realQZ = window.tryPrintViaQZ;
    window.tryPrintViaQZ = async () => { qzCalls++; return true; };
    window.db = {
      collection: () => ({
        doc: () => ({
          update: () => Promise.resolve(),
          onSnapshot: () => () => {},
          get: async () => ({ exists: false, data: () => null }),
        }),
      }),
    };
    await executePrintJob('j1', {
      type: 'restock',
      jobs: [{ html: '<p>ورقة من التليفون</p>', copies: 1 }],
      sizeOptions: { pageWidthMm: 80, autoHeight: true },
    });
    out.remoteHelperCalls = calls.filter((c) => c.url.endsWith('/print')).length;
    out.remoteSkippedQZ = qzCalls === 0;
    window.tryPrintViaQZ = realQZ;

    // ============================================================
    // ⚠️ الملصق **عمره ما يعدّي** على البرنامج
    // ============================================================
    reset();
    mode = 'ok';
    await deliverPrint('label', [{ html: '<b>x</b>', copies: 1 }], { pageWidthMm: 38, pageHeightMm: 25 });
    out.labelTouchedHelper = calls.some((c) => c.url.indexOf('7770') !== -1);

    window.fetch = realFetch;
    setPrintTweak('sheetHelper', false);
    out.defaultOff = getPrintTweak('sheetHelper') === false;
    return out;
  });

  check('⭐⭐⭐⭐ المفتاح مقفول → مافيش ولا نداء على الشبكة',
    r.offResult === false && r.offCalls === 0, [r.offResult, r.offCalls]);
  check('⭐⭐⭐ والمفتاح مفتوح → الورقة راحت للبرنامج', r.onResult === true, r.onResult);
  check('⭐⭐ وبينده الحالة الأول وبعدين الطباعة',
    JSON.stringify(r.onCalls) === JSON.stringify(['GET /status', 'POST /print']), r.onCalls);
  check('⭐⭐ والطباعة POST مش GET', r.printIsPost);
  check('⭐⭐⭐⭐ والحالة بتتفحص **مرة واحدة** مش مع كل طبعة',
    r.repeatStatusCalls === 0 && r.repeatPrintCalls === 2, [r.repeatStatusCalls, r.repeatPrintCalls]);
  check('⭐⭐⭐ البرنامج مش شغّال → الطباعة بتكمّل بالقديم', r.downResult === false);
  check('⭐⭐ والبرنامج رفض → بيقول ليه', /رفض|الطابعة مش موجودة/.test(r.refuseSaid), r.refuseSaid);
  check('⚠️ ومن غير طابعة متظبطة مايبعتش', r.noPrinter === false);
  check('⭐⭐⭐⭐ الطلب الجاي من التليفون بيعدّي على البرنامج كمان',
    r.remoteHelperCalls === 1, r.remoteHelperCalls);
  check('⭐⭐⭐ ومابيروحش لـQZ بعدها (مش طبعتين)', r.remoteSkippedQZ);
  check('⭐⭐⭐ الملصق عمره ما يعدّي على البرنامج', r.labelTouchedHelper === false);
  check('⭐ والمفتاح مقفول افتراضيًا', r.defaultOff);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
