// ============================================================
// فتح النظام: إيه اللي بيتحمّل، وإيه اللي مايستناش
// ============================================================
// ⚠️ القياس اللي أدّى للملف ده (فتح index.html على موبايل بمعالج أبطأ 4×):
//
//   الفتح الكامل ............ 2107 مث
//   منهم xlsx.full.min.js ... 1956 مث   ← أكتر من 90٪
//
// ومكتبة الإكسل دي بتتستخدم في حاجتين بس، الاتنين **ورا ضغطة زرار**
// ومقصورين على صلاحية `excelTools`. يعني أمين المخزن اللي بيفتح النظام
// عشرات المرات في اليوم كان بيدفع تمنها **وهو عمره ما هيستخدمها**.
//
// بعد ما بقت بتتحمّل وقت الحاجة: **662 مث** بدل 2107.
//
// 📌 الفحص ده بيحرس المكسب ده — سهل جدًا إن حد يرجّع الوسم لـindex.html
//    "عشان يبقى أبسط" ومحدش ياخد باله إن الفتح رجع تلاتة أضعاف.
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');
  const harness = fs.readFileSync(__dirname + '/harness.html', 'utf8');

  // ============================================================
  // 1) ⭐⭐ الإكسل مش بيتحمّل مع فتح النظام
  // ============================================================
  check('⭐⭐ مفيش وسم <script> للإكسل في index.html',
    !/<script[^>]+xlsx[^>]*>/.test(html), (html.match(/<script[^>]+xlsx[^>]*>/) || [])[0]);
  // ⚠️ بس لازم يفضل **محفوظ** — النظام بيشتغل من غير نت، ولو مش في
  // قايمة الحفظ الاستيراد هيفشل في المحل لما النت يقطع.
  check('⭐⭐ وبرضه محفوظ في sw.js عشان يشتغل من غير نت',
    /xlsx\.full\.min\.js/.test(sw), null);
  check('⭐ وصفحة الفحص زي صفحة المستخدم (مش بتحمّله هي كمان)',
    !/<script[^>]+xlsx[^>]*>/.test(harness), null);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');

  const state0 = await p.evaluate(() => ({
    xlsx: typeof XLSX,
    ensure: typeof ensureXLSX,
    loader: typeof loadScriptOnce,
  }));
  check('⭐⭐ الإكسل مش موجود بعد ما النظام فتح', state0.xlsx === 'undefined', state0);
  check('⭐ ودالة التحميل عند الحاجة موجودة',
    state0.ensure === 'function' && state0.loader === 'function', state0);

  // ============================================================
  // 2) ⭐ كل ملفات النظام لسه بتتحمّل (مافيش حاجة اتشالت بالغلط)
  // ============================================================
  const loadedFiles = (html.match(/\.\/js\/[\w-]+\.js/g) || []).sort();
  const cached = (sw.match(/\.\/js\/[\w-]+\.js/g) || []).sort();
  const missing = loadedFiles.filter((f) => !cached.includes(f));
  check('⭐⭐ كل ملف بيتحمّل في الصفحة موجود في قايمة الحفظ', missing.length === 0, missing);

  const globals = await p.evaluate(() => ({
    render: typeof render,
    state: typeof state,
    tryPrintViaQZ: typeof tryPrintViaQZ,
    buildQuarterLabelHTML: typeof buildQuarterLabelHTML,
    onGradesSnapshotForNotify: typeof onGradesSnapshotForNotify,
    openBaseGradesDialog: typeof openBaseGradesDialog,
    exportToExcel: typeof exportToExcel,
  }));
  check('⭐⭐ كل الدوال الأساسية موجودة (يعني مفيش ملف وقع)',
    Object.values(globals).every((t) => t === 'function' || t === 'object'), globals);

  // ============================================================
  // 3) ⭐⭐ زرار "ضيفهم لكل الفئات" اتشال
  // ============================================================
  // اتشال بعد ما التأسيس خلص: كان للتجهيز الأولي، وبعده بقى زرار خطر
  // جنب زرار عادي — ضغطة غلط بتضيف درجات في **كل** الفئات ومفيش تراجع
  // جماعي.
  const dialog = await p.evaluate(() => {
    state.user = { uid: 'u1' };
    state.profile = { name: 'A', role: 'admin', warehouseAccess: 'both' };
    state.view = 'dashboard'; state.isOnline = true; state.screen = 'sheets';
    state.categories = [{ id: 'c1', name: 'كريب', order: 1, colorGroups: ['بيجات'] }];
    state.activeCategoryId = 'c1';
    state.grades = [];
    render();
    openBaseGradesDialog('c1');
    const txt = document.body.textContent;
    const out = {
      hasAll: !!document.getElementById('base-all'),
      hasThis: !!document.getElementById('base-this'),
      hasCustom: !!document.getElementById('base-custom-add'),
      mentionsAll: /لكل الفئات/.test(txt),
    };
    const c = document.getElementById('base-cancel');
    if (c) c.click();
    return out;
  });
  check('⭐⭐ زرار "ضيفهم لكل الفئات" مابقاش موجود', dialog.hasAll === false, dialog);
  check('⭐⭐ ومفيش أي ذكر ليه في الشاشة', dialog.mentionsAll === false, dialog);
  check('⭐ والإضافة للمجموعة اللي انت فيها لسه شغّالة', dialog.hasThis === true, dialog);
  check('⭐ والدرجة الأساسية باسم من عندك لسه شغّالة', dialog.hasCustom === true, dialog);

  const appSrc = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
  check('⭐ ومفيش كود متسيّب وراه', !/base-all/.test(appSrc), null);

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
