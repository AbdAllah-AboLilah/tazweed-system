// ============================================================
// 🩺 سجل آخر طبعة على كارت الجهاز
// ============================================================
// ⚠️⚠️ ليه ده موجود، والسبب أهم من الكود:
//
// عطل "الورقة بتطلع بمعاينة" اتشخّص غلط **أربع مرات** ورا بعض. وكل
// مرة السبب واحد: الطباعة عن بُعد معناها إن محدش واقف قدام الكمبيوتر،
// وكل رسايل النظام عن الطباعة بتتكتب على شاشة الكمبيوتر دي بالظبط —
// وبتختفي بعد ثواني. فاللي بيبلّغ شايف النتيجة (ورقة بمعاينة) ومش شايف
// اللي حصل جوّه الجهاز، واللي بيصلّح بيخمّن.
//
// الفحص ده بيحرس الحاجة اللي بتوقف التخمين: إن كل طبعة بتسجّل **الطريق
// والسبب** في كارت الجهاز، والكارت بيتشاف من التليفون.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof executePrintJob === 'function' && typeof recordLastPrint === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };
    try { localStorage.setItem('tazweed_qz_tweak_sheetHelper', '1'); } catch (e) {}

    // بنمسك كل كتابة رايحة لكارت الجهاز
    const writes = [];
    window.db = {
      collection: (name) => ({
        add: async () => ({}),
        doc: () => ({
          set: async (data) => { if (name === 'printStations') writes.push(data); },
          update: async () => {},
          onSnapshot: () => () => {},
        }),
      }),
    };
    window.getSavedPrinter = () => 'P';
    window.printHTMLSilently = () => {};
    window.showPrintNotice = () => {};
    const paper = (n) => ({ html: `<html><body>ورقة ${n}</body></html>`, copies: 1 });

    // ---------- طبعة نجحت من المساعد ----------
    writes.length = 0;
    window.printSheetViaHelper = async () => { notePrintRoute('helper'); setPrintOutcome(true, ''); return true; };
    window.tryPrintViaQZ = async () => false;
    await executePrintJob('j1', { type: 'restock', sizeOptions: null, spec: null, jobs: [paper(1), paper(2)] });
    out.okWrite = writes.map((w) => w.lastPrint).filter(Boolean).pop() || null;

    // ============================================================
    // ⭐⭐⭐⭐⭐ طبعة رجعت لنافذة المتصفح — لازم تتسجّل **بسببها**
    // ============================================================
    // دي الحالة اللي المستخدم بيشوفها ومش عارف سببها. من غير السطر ده
    // بيفضل التشخيص تخمين.
    writes.length = 0;
    window.printSheetViaHelper = async () => {
      helperFail('البرنامج المساعد مش شغّال على الجهاز ده.');
      return false;
    };
    await executePrintJob('j2', { type: 'restock', sizeOptions: null, spec: null, jobs: [paper(1)] });
    out.failWrite = writes.map((w) => w.lastPrint).filter(Boolean).pop() || null;

    // ---------- والكارت بيعرضه ----------
    state.printStations = [
      {
        id: 'dev-x',
        deviceName: 'كمبيوتر الكاشير',
        labelPrinter: 'P',
        restockPrinter: 'P',
        printers: ['P'],
        appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '',
        updatedAt: Date.now(),
        lastSeen: Date.now(),
        lastPrint: {
          at: Date.now(),
          type: 'restock',
          route: 'browser',
          ok: false,
          reason: 'البرنامج المساعد مش شغّال على الجهاز ده.',
          from: 'عن بُعد',
          papers: 3,
        },
      },
    ];
    // ⚠️ بنرسم كارت الجهاز مباشرة: stationCardHTML هي اللي بتبنيه،
    // وده أضيق وأثبت من إننا نرسم الشاشة كلها.
    let html = '';
    try { html = stationCardHTML(state.printStations[0]); } catch (e) { out.htmlErr = String(e); }
    out.cardShowsRoute = /من نافذة المتصفح/.test(html);
    out.cardShowsReason = /البرنامج المساعد مش شغّال/.test(html);
    out.cardShowsCount = /3 ورقة/.test(html);
    out.cardShowsLabel = /آخر طبعة/.test(html);

    return out;
  });

  check('⭐⭐⭐⭐ الطبعة الناجحة بتتسجّل في كارت الجهاز',
    !!r.okWrite && r.okWrite.ok === true, r.okWrite);
  check('⭐⭐⭐ ومعاها الطريق اللي خرجت منه',
    !!r.okWrite && r.okWrite.route === 'helper', r.okWrite);
  check('⭐⭐⭐ وعدد الورق', !!r.okWrite && r.okWrite.papers === 2, r.okWrite);
  check('⭐⭐ وإنها جت من بعيد', !!r.okWrite && r.okWrite.from === 'عن بُعد', r.okWrite);

  check('⭐⭐⭐⭐⭐ والطبعة اللي رجعت للمتصفح بتتسجّل **بسببها**',
    !!r.failWrite && r.failWrite.ok === false && /مش شغّال/.test(r.failWrite.reason || ''),
    r.failWrite);
  check('⭐⭐⭐⭐ ومكتوب فيها إنها خرجت من نافذة المتصفح',
    !!r.failWrite && r.failWrite.route === 'browser', r.failWrite);

  check('⭐⭐⭐⭐⭐ وكارت الجهاز بيعرض السبب (اللي بيتشاف من التليفون)',
    r.cardShowsReason === true, { reason: r.cardShowsReason, err: r.htmlErr });
  check('⭐⭐⭐⭐ وبيعرض الطريق', r.cardShowsRoute === true, r.cardShowsRoute);
  check('⭐⭐⭐ وعدد الورق', r.cardShowsCount === true, r.cardShowsCount);
  check('⭐⭐ وعليه عنوان واضح', r.cardShowsLabel === true, r.cardShowsLabel);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
