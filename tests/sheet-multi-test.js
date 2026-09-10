// ============================================================
// 📄 ورقة التزويد المقسّمة لازم توصل للبرنامج المساعد
// ============================================================
// ⚠️⚠️ العطل اللي بيتحل، اتبلّغ بالنص: "في حساب موظف عادي بيبعت امر
// طباعة ورقة التزويد بيجي معاينه علي جهاز الكمبيوتر وبعدين ... بضغط
// كنسيل او الغاء الورقة بتطبع عادي ... ولكن من هاتف ثاني من حساب اخر
// حساب مشرف بيبعت امر الطباعة الورقة بتخرج من غير المعاينه".
//
// --- السبب ---
// الشرط على الجهاز المستقبِل كان `list.length === 1`، فأي طلب فيه أكتر
// من ورقة مايوصلش للمساعد خالص — يروح لـQZ، ولو فشل تتفتح نافذة
// المتصفح (اللي بتقص الورقة، وبتطبع حتى لو دوست إلغاء).
//
// --- وليه الفرق بين الحسابين ---
// الورقة بتتقسّم أوتوماتيك لما حجمها يعدّي RESTOCK_SAFE_BYTES، وحجمها
// بيختلف من حساب لحساب: سطر "آخر مرة اتطبعت" بيبان لبعض الحسابات بس
// (مفتاح seeRestockLastPrint)، والفئات المسموح بيها بتختلف
// (categoryAccess). فحساب ورقته بتتقسّم وحساب لأ — ونفس الجهاز
// بيتصرف تصرفين.
//
// ⚠️ الفحص ده بيقيس **هل الدالة اتندهت**، مش بيقرا الكود: العطل كان
// شرط في نص السطر، والفحص اللي بيدوّر على نص في الملف بيعدّي عليه.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof executePrintJob === 'function' && typeof printSheetsViaHelper === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };
    try { localStorage.setItem('tazweed_qz_tweak_sheetHelper', '1'); } catch (e) {}

    let sheetsSent = 0;
    let browserOpened = 0;
    let failMode = 0; // 0 = كله ينجح، n = الورقة رقم n تفشل

    window.getSavedPrinter = () => 'P';
    window.printHTMLSilently = () => { browserOpened++; };
    window.tryPrintViaQZ = async () => false; // QZ مش شغّال
    window.db = { collection: () => ({ add: async () => ({}), doc: () => ({ update: async () => {}, onSnapshot: () => () => {}, set: async () => {} }) }) };

    // ⚠️ بنقلّد **ورقة واحدة** بس: اللي بيتفحص هنا هو اللي فوقها —
    // مين بينده مين وكام مرة، ومتى بنرجع لنافذة المتصفح.
    window.printSheetViaHelper = async () => {
      sheetsSent++;
      return !(failMode && sheetsSent === failMode);
    };

    const notices = [];
    const realNotice = window.showPrintNotice;
    window.showPrintNotice = (m, ms, kind) => notices.push({ m: String(m), kind: kind || 'info' });

    const paper = (n) => ({ html: `<html><body>ورقة ${n}</body></html>`, copies: 1 });
    const run = async (papers, mode) => {
      sheetsSent = 0; browserOpened = 0; failMode = mode || 0; notices.length = 0;
      const prog = [];
      await executePrintJob('j', { type: 'restock', sizeOptions: null, jobs: papers, spec: null });
      return { sent: sheetsSent, browser: browserOpened, notices: notices.slice(), prog };
    };

    out.one = await run([paper(1)], 0);
    out.three = await run([paper(1), paper(2), paper(3)], 0);

    // ============================================================
    // ⭐⭐⭐⭐⭐ الفشل **قبل** أول ورقة = رجوع نضيف
    // ============================================================
    // مافيش ورق اتحرق، فالرجوع لـQZ/المتصفح صح ومطلوب.
    out.failFirst = await run([paper(1), paper(2), paper(3)], 1);

    // ============================================================
    // ⭐⭐⭐⭐⭐ الفشل **بعد** ما ورق خرج = ممنوع الرجوع
    // ============================================================
    // الرجوع هنا معناه إن الورق اللي طلع يتطبع **تاني**. نفس القاعدة
    // اللي في الملصقات بالظبط.
    out.failLater = await run([paper(1), paper(2), paper(3)], 2);

    // ---------- المسار المحلي (الطباعة من الكمبيوتر نفسه) ----------
    // ⚠️ الورقة المقسّمة بتوصل هنا **مصفوفة** مش نص، والنسخة القديمة
    // كانت بتبعتها لدالة بتاخد نص — فبترجّع false وتروح للمتصفح.
    sheetsSent = 0; browserOpened = 0; failMode = 0;
    window.showPrintPreview = async () => true;
    const localOK = await deliverPrint('restock', [paper(1), paper(2)], null, '', null, null);
    out.local = { sent: sheetsSent, browser: browserOpened, ok: localOK };

    window.showPrintNotice = realNotice;
    return out;
  });

  check('⭐⭐⭐ الورقة الواحدة بتروح للمساعد',
    r.one.sent === 1 && r.one.browser === 0, r.one);

  check('⭐⭐⭐⭐⭐ والتلات ورقات بيروحوا كلهم (ده اللي كان بايظ)',
    r.three.sent === 3 && r.three.browser === 0, r.three);

  check('⭐⭐⭐⭐ فشل قبل أول ورقة → رجوع نضيف لنافذة المتصفح',
    r.failFirst.sent === 1 && r.failFirst.browser === 1, r.failFirst);

  check('⭐⭐⭐⭐⭐ فشل بعد ما ورق خرج → **ممنوع** الرجوع (وإلا بيتطبع تاني)',
    r.failLater.browser === 0, r.failLater);
  check('⭐⭐⭐⭐ وبيقول اتطبع كام من كام',
    r.failLater.notices.some((n) => /اتطبعت 1 ورقة من 3/.test(n.m)), r.failLater.notices);
  check('⭐⭐⭐ وبلون خطر مش تنبيه عادي',
    r.failLater.notices.some((n) => n.kind === 'bad'), r.failLater.notices);

  check('⭐⭐⭐⭐⭐ والمسار المحلي كمان بيوصّل الورقتين للمساعد',
    r.local.sent === 2 && r.local.browser === 0, r.local);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
