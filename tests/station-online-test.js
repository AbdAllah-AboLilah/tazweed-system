// ============================================================
// 🟢 الجهاز بيبان "شغّال" لو فيه أي طريق للطباعة
// ============================================================
// ⚠️⚠️ اتبلّغ بالنص:
//   "النظام بيبقى مفتوح عادي وبلاقي في الاعدادات من الهاتف مقفول ايه السبب"
//   "الجهاز المقفول له كارت واحد وبردوا مكتوب مقفول مش عارف ايه السبب
//    اني قافل برنامج QZ ولا حاجه تانيه"
//
// **وتخمينه كان صح.** السطر كان:
//     if (!(await ensureQZConnected())) return;
// يعني نبضة "أنا موجود" بتقف لو QZ مش شغّال، فـlastSeen مابيتكتبش،
// وبعد دقيقتين الجهاز بيبان مقفول — والنظام مفتوح قدامه.
//
// ⚠️ وده بقى تناقض من ساعة ما عملنا البرنامج المساعد: هو اتعمل عشان
// **يستبدل** QZ، ومع ذلك الجهاز اللي شغّال بالمساعد لوحده مكانش
// بيسجّل نفسه خالص.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof registerPrintStation === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };
    saveSelectedPrinter('label', 'XP-235B');
    saveDeviceName('كمبيوتر الكاشير');

    // ---- سحابة مقلّدة بتعدّ الكتابات ----
    let writes = 0, last = null;
    const q = {};
    q.doc = () => ({
      set: async (data) => { writes++; last = data; },
      get: async () => ({ exists: false, data: () => ({}) }),
      update: async () => {}, delete: async () => {}, onSnapshot: () => () => {},
    });
    q.where = () => q; q.orderBy = () => q; q.limit = () => q;
    q.onSnapshot = () => () => {}; q.add = async () => ({ id: 'x' });
    q.get = async () => ({ empty: true, docs: [], forEach: () => {} });
    window.db = { collection: () => q };

    const realFetch = window.fetch;
    let helperOn = false;
    window.fetch = async (u) => {
      if (String(u).indexOf('/status') !== -1) {
        if (!helperOn) throw new Error('مش شغّال');
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.8.0', printers: ['XP-235B', 'XP-80C'] }) };
      }
      throw new Error('لأ');
    };

    const qzUp = () => {
      window.qz = {
        websocket: { connect: () => Promise.resolve(), isActive: () => true, setClosedCallbacks: () => {} },
        printers: { find: async () => ['XP-235B'] },
        api: { getVersion: async () => '2.2.6' },
      };
      qzConnected = false; qzConnecting = null;
    };
    const qzDown = () => { window.qz = undefined; qzConnected = false; qzConnecting = null; };
    const reset = () => { writes = 0; last = null; helperCache = null; helperCacheAt = 0; };

    // ============================================================
    // ⭐⭐⭐⭐⭐ الحالة اللي اتبلّغت: QZ مقفول والمساعد شغّال
    // ============================================================
    reset(); qzDown(); helperOn = true;
    await registerPrintStation();
    out.helperOnlyWrites = writes;
    out.helperOnlyPrinters = last ? (last.printers || []).length : 0;
    // ⚠️ اللي الجهاز بينشره عن نفسه — نافذة "إرسال إعدادات الطابعة"
    // في التليفون بتقرا منه.
    out.setup = last && last.printSetup ? Object.keys(last.printSetup).sort() : [];
    out.setupSizes = last && last.printSetup
      ? [last.printSetup.nameMm, last.printSetup.codeMm, last.printSetup.priceMm]
      : [];

    // ============================================================
    // ⭐⭐⭐⭐ والعكس: QZ شغّال والمساعد مقفول — زي زمان
    // ============================================================
    reset(); qzUp(); helperOn = false;
    await registerPrintStation();
    out.qzOnlyWrites = writes;

    // ---- الاتنين شغّالين ----
    reset(); qzUp(); helperOn = true;
    await registerPrintStation();
    out.bothWrites = writes;

    // ============================================================
    // ⭐⭐⭐⭐⭐ ولا واحد فيهم → مايسجّلش
    // ============================================================
    // ⚠️ ده مقصود: جهاز مايقدرش يطبع مالوش لازمة في قايمة أجهزة
    // الطباعة، والزميل اللي هيبعتله هيستنى على الفاضي.
    reset(); qzDown(); helperOn = false;
    await registerPrintStation();
    out.neitherWrites = writes;

    // ⚠️ ومن غير طابعة محفوظة مايسجّلش برضو (الحارس ده كان موجود قبلنا)
    reset(); qzUp(); helperOn = true;
    saveSelectedPrinter('label', '');
    saveSelectedPrinter('restock', '');
    await registerPrintStation();
    out.noPrinterWrites = writes;

    window.fetch = realFetch;
    window.qz = undefined;
    return out;
  });

  check('⭐⭐⭐⭐⭐ QZ مقفول والمساعد شغّال → الجهاز **بيسجّل نفسه**',
    r.helperOnlyWrites === 1, r.helperOnlyWrites);

  // ============================================================
  // ⭐⭐⭐⭐ الجهاز بينشر مقاسات الخط اللي شغّال بيها فعلًا
  // ============================================================
  // ⚠️⚠️ من غير كده، نافذة "إرسال إعدادات الطابعة" من التليفون بتوري
  // **الأرقام الافتراضية** لكل جهاز مهما كان اللي عليه (شوف currentFor
  // في js/print-screen.js: `ps.nameMm ?? PRINT_NAME_MM_DEFAULT`).
  // يعني تفتح النافذة وتلاقي 1.9 والجهاز شغّال على 2.6 — وتفتكر إن
  // الرقم اللي ظبطته ضاع.
  check('⭐⭐⭐⭐ الجهاز بينشر مقاسات الخط التلاتة',
    ['nameMm', 'codeMm', 'priceMm'].every((k) => r.setup.indexOf(k) !== -1), r.setup);
  check('⭐⭐⭐ والأرقام حقيقية مش فاضية',
    r.setupSizes.every((v) => typeof v === 'number' && v > 0), r.setupSizes);
  // ⚠️ والخط كمان — نفس السبب بالظبط.
  check('⭐⭐⭐ وبينشر خط الملصق', r.setup.indexOf('labelFont') !== -1, r.setup);
  check('⭐⭐⭐⭐ وبيبعت طابعات المساعد معاه',
    r.helperOnlyPrinters === 2, r.helperOnlyPrinters);
  check('⭐⭐⭐⭐ وQZ شغّال والمساعد مقفول → بيسجّل زي زمان',
    r.qzOnlyWrites === 1, r.qzOnlyWrites);
  check('⭐⭐⭐ والاتنين شغّالين → بيسجّل مرة واحدة',
    r.bothWrites === 1, r.bothWrites);

  // ⚠️ الحارس ده لازم يفضل: جهاز مايقدرش يطبع مالوش لازمة في القايمة.
  check('⭐⭐⭐⭐⭐ ولا واحد فيهم شغّال → مايسجّلش',
    r.neitherWrites === 0, r.neitherWrites);
  check('⭐⭐⭐⭐ ومن غير طابعة محفوظة مايسجّلش',
    r.noPrinterWrites === 0, r.noPrinterWrites);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
