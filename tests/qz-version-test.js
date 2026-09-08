// المقاس المخصّص (size.custom) — بيتبعت لنسخة QZ اللي بتفهمه بس
// ============================================================
// ⚠️⚠️ العطل: نفس الورقة، نفس الفئة، جهازين — واحدة كاملة وواحدة
// مقصوصة عند **211.7مم** بالظبط. والملاحظة اللي حسمت السبب: على الجهاز
// اللي بيقص، **قفل مفتاح "الورقة كصورة" بيصلّحها**.
//
// والفرق بين الوضعين مش الصورة — الفرق **المقاس**:
//   • مفتاح مقفول → مافيش مقاس → الرول بيمشي لآخره ✅
//   • مفتاح مفتوح → "اطبع بطول 231مم" + custom: true
//
// و`custom` اتضاف في QZ Tray 2.2.6. الأقدم بيتجاهله **وياخد الطول
// الصريح**، والتعريف بيقصّه عند فورم بتاعه (210مم).
//
// الفحص ده بيثبت إن النظام بيسأل عن النسخة ويتصرّف صح مع كل واحدة.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof qzVersionAtLeast === 'function' && typeof tryPrintViaQZ === 'function');

  // ---------- مقارنة النسخ ----------
  const cmp = await p.evaluate(() => {
    const MIN = [2, 2, 6];
    const cases = ['2.2.6', '2.2.7', '2.3.0', '3.0.0', '2.2.5', '2.2.4', '2.1.9', '1.9.9', '2.2', '2', '', 'كلام'];
    const out = {};
    cases.forEach((v) => { out[v || '(فاضي)'] = qzVersionAtLeast(v, MIN); });
    return out;
  });
  const want = { '2.2.6': true, '2.2.7': true, '2.3.0': true, '3.0.0': true,
    '2.2.5': false, '2.2.4': false, '2.1.9': false, '1.9.9': false,
    '2.2': false, '2': false, '(فاضي)': false, 'كلام': false };
  Object.keys(want).forEach((v) => {
    check(`⭐ نسخة ${v} → ${want[v] ? 'بتفهم custom' : 'ماتفهمش'}`, cmp[v] === want[v], { طلع: cmp[v] });
  });

  // ---------- السلوك الفعلي وقت الطباعة ----------
  const run = await p.evaluate(async () => {
    const sent = [];
    // QZ مزيّف بيسجّل الإعداد اللي اتبعت
    const fakeQZ = (version) => ({
      api: { getVersion: () => Promise.resolve(version) },
      websocket: { isActive: () => true },
      printers: { find: (n) => Promise.resolve(n) },
      configs: { create: (printer, opts) => { sent.push({ printer, opts }); return { printer, opts }; } },
      print: () => Promise.resolve(),
    });
    const out = {};
    const realQz = window.qz;
    const realNotice = window.showPrintNotice;
    const notices = [];
    window.showPrintNotice = (m) => notices.push(m);

    // ⚠️ tryPrintViaQZ بتخرج بدري لو الطابعة مش متظبطة أو الاتصال فشل —
    // فلازم نزوّد الحاجتين دول عشان نوصل لبناء الإعداد أصلًا.
    const realSaved = window.getSavedPrinter;
    const realEnsure = window.ensureQZConnected;
    const realAvail = window.isQZAvailable;
    window.getSavedPrinter = () => 'FAKE-PRINTER';
    window.ensureQZConnected = async () => true;
    window.isQZAvailable = () => true;

    const go = async (version, sizeOptions, jobs, kind) => {
      sent.length = 0; notices.length = 0;
      qzVersionCache = null;                 // ⚠️ الكاش لازم يتصفّى بين الحالات
      window.qz = fakeQZ(version);
      try { await tryPrintViaQZ(kind || 'restock', jobs, sizeOptions); } catch (e) { /* بيكفينا اللي اتبعت */ }
      return { size: sent.length ? sent[0].opts.size : undefined, notices: notices.join(' | '), calls: sent.length };
    };

    const img = 'data:image/png;base64,iVBORw0KGgo=';
    const sheetJobs = [{ html: '<html><body>x</body></html>', image: img, copies: 1 }];
    const sheetSize = { pageWidthMm: 72.1, pageHeightMm: 231.2, customSize: true };

    out.newQZ = await go('2.2.6', sheetSize, sheetJobs);
    out.oldQZ = await go('2.2.4', sheetSize, sheetJobs);
    out.noVer = await go('', sheetSize, sheetJobs);

    // ⚠️ الملصق: المقاس لازم يفضل مبعوت في كل الحالات — مقاسه ثابت
    const labelJobs = [{ html: '<html><body>y</body></html>', image: img, copies: 1 }];
    const labelSize = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    out.labelNew = await go('2.2.6', labelSize, labelJobs, 'label');
    out.labelOld = await go('2.2.4', labelSize, labelJobs, 'label');

    window.qz = realQz;
    window.showPrintNotice = realNotice;
    window.getSavedPrinter = realSaved;
    window.ensureQZConnected = realEnsure;
    window.isQZAvailable = realAvail;
    qzVersionCache = null;
    return out;
  });

  // الورقة على نسخة جديدة: مقاس + custom
  check('⭐⭐⭐ QZ 2.2.6 → الورقة بتتبعت بمقاسها و custom مفتوح',
    !!run.newQZ.size && run.newQZ.size.custom === true && Math.round(run.newQZ.size.height) === 231,
    run.newQZ.size);
  check('⚠️ ومفيش تنبيه', run.newQZ.notices === '', run.newQZ.notices);

  // الورقة على نسخة قديمة: **مافيش مقاس خالص** (رول مستمر)
  check('⭐⭐⭐ QZ 2.2.4 → الورقة من غير مقاس خالص (رول مستمر، ماتتقصش)',
    run.oldQZ.size === null || run.oldQZ.size === undefined, run.oldQZ.size);
  check('⭐⭐ وبيتقال ليه، ومعاه رقم النسخة',
    run.oldQZ.notices.indexOf('2.2.4') !== -1 && run.oldQZ.notices.indexOf('رول مستمر') !== -1,
    run.oldQZ.notices);

  // نسخة مش معروفة = نتصرّف زي القديمة (الأمان)
  check('⚠️⚠️ نسخة مش معروفة → نفس تصرّف القديمة (مانجربش ونقص ورقة)',
    run.noVer.size === null || run.noVer.size === undefined, run.noVer.size);

  // ============================================================
  // ⚠️⚠️ الملصق **ماتغيّرش ولا حرف** — على كل النسخ
  // ============================================================
  // `custom` نفسه مش اللي بيأذي: النسخة القديمة بتتجاهله وخلاص. اللي
  // بيأذي هو الطول الصريح لورقة **رول مستمر**. فالملصق (مقاس ثابت)
  // بياخد نفس الإعداد بالظبط على كل النسخ.
  // ⚠️ أول نسخة من الإصلاح ده كانت بتشيل custom من الملصق كمان —
  // وfحوص label-image و sheet-image مسكوها. لمسة زيادة كانت هترجّع
  // عطل العمود المقصوص بتاع v0.73.2.
  [['نسخة جديدة', run.labelNew], ['نسخة قديمة', run.labelOld]].forEach(([lbl, r]) => {
    check(`⭐⭐⭐ الملصق على ${lbl}: مقاسه و custom زي ما هما`,
      !!r.size && r.size.custom === true && r.size.width === 38 && r.size.height === 25, r.size);
  });
  check('⚠️ ومفيش تنبيه للملصق (مالوش دعوة بالقص)',
    run.labelOld.notices.indexOf('رول مستمر') === -1, run.labelOld.notices);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
