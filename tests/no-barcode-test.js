// الصنف اللي ملوش رقم باركود + "مفيش خالص" والفرع فيه كمية
// ============================================================
// ⭐ عطلين حقيقيين اتمسكوا من ملصق مطبوع ومن شاشة المستخدم:
//
// 1) الكود كان `barcodeNumber || name` — فالصنف اللي ملوش رقم بياخد
//    **اسمه العربي** جوّه الكود. فككنا كود من ملصق فعلي وطلع مكتوب فيه
//    "خمار اسدال بكم" — الماسح بيقرا حروف مش رقم.
//
// 2) "مفيش خالص" كان بيبص على الرئيسي بس. الدرجة تقدر تبقى معلّقة
//    والفرع فيه كمية (طلب بشري مايتلغيش لوحده)، فالزرار كان بيظهر
//    والدوسة عليه بتقول "خلصت نهائيًا" والفرع فيه 2.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildLabelHTML === 'function' && typeof confirmMissingBarcode === 'function');

  // ---------- 1) الكود ----------
  const qr = await p.evaluate(async () => {
    const opts = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    const withCode = { itemName: 'خمار اسدال بكم', barcodeNumber: '28144', sellingPrice: 90 };
    const noCode = { itemName: 'خمار اسدال بكم', barcodeNumber: '', sellingPrice: 90 };

    const a = await buildItemLabel(withCode, opts, 1);
    const c = await buildItemLabel(noCode, opts, 1);

    // الرسم كصورة كمان (المسار التاني)
    const pngWith = renderLabelPNG(withCode, opts);
    const pngNo = renderLabelPNG(noCode, opts);

    return {
      معاه_كود: a.jobHTML.includes('class="qr"'),
      من_غير_كود: !c.jobHTML.includes('class="qr"'),
      // الاسم لسه موجود في الحالتين
      الاسم_موجود: a.jobHTML.includes('خمار اسدال بكم') && c.jobHTML.includes('خمار اسدال بكم'),
      // ولا واحد فيهم Promise بالغلط
      نوع_سليم: typeof a.jobHTML === 'string' && typeof c.jobHTML === 'string',
      صورتين_مختلفتين: !!pngWith && !!pngNo && pngWith !== pngNo,
      // التحذير
      بيحذر: confirmMissingBarcodeNames([noCode]).length === 1,
      مابيحذرش: confirmMissingBarcodeNames([withCode]).length === 0,
      مسافات_بس_تتحسب_ناقصة: confirmMissingBarcodeNames([{ name: 'س', barcodeNumber: '   ' }]).length === 1,
    };

    function confirmMissingBarcodeNames(list) { return missingBarcodeNames(list); }
  });

  check('الصنف اللي ليه رقم لسه بياخد كود', qr.معاه_كود, qr);
  check('⭐ الصنف اللي ملوش رقم مابياخدش كود', qr.من_غير_كود, qr);
  check('الاسم بيتطبع في الحالتين', qr.الاسم_موجود, qr);
  check('الملصق نص مش Promise', qr.نوع_سليم, qr);
  check('صورة الملصق بتتغيّر مع/من غير كود', qr.صورتين_مختلفتين, qr);
  check('التحذير بيلقط الصنف الناقص', qr.بيحذر, qr);
  check('التحذير مابيزعّقش للصنف السليم', qr.مابيحذرش, qr);
  check('رقم من مسافات بس = ناقص', qr.مسافات_بس_تتحسب_ناقصة, qr);

  // ---------- 2) "مفيش خالص" ----------
  const out = await p.evaluate(async () => {
    var G = { id: 'g1', number: 5, branchQty: 0, mainQty: 3, status: 'normal' };
    const noop = () => () => {};
    const gdoc = () => ({
      update: (u) => { Object.assign(G, u); return Promise.resolve(); },
      set: () => Promise.resolve(),
      get: () => Promise.resolve({ exists: true, data: () => G }),
      collection: () => ({ doc: gdoc, get: () => Promise.resolve({ docs: [] }) }),
    });
    const mk = () => ({ doc: gdoc, get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, limit: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
    window.db = { collection: mk, collectionGroup: mk, batch: () => ({ set() {}, update() {}, commit: () => Promise.resolve() }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => ({}), increment: (n) => ({ n }) } } };
    state.user = { uid: 'me' };
    state.view = 'dashboard';
    state.profile = { name: 'أنا', role: 'owner' };
    state.categories = [{ id: 'c1', name: 'كريب' }];
    state.activeCategoryId = 'c1';
    state.screen = 'sheets';

    // نفس خطوات العطل الحقيقي
    state.grades = [G];
    await requestShortage('g1', 1);            // طلب بشري
    await applyQuantityChange('c1', 'g1', G, 'branchQty', 0, 2);  // وصلت بضاعة للفرع
    await applyQuantityChange('c1', 'g1', G, 'mainQty', 3, 0);    // الرئيسي خلص

    state.grades = [G];
    render();
    // الحالة دلوقتي: معلّقة، والفرع فيه 2، والرئيسي صفر — ده اللي كان
    // بيخلّي الزرار يظهر قبل التصليح.
    const pendingWithStock = G.status === 'pending' && (G.branchQty || 0) === 2;
    const shownWithStock = !!document.querySelector('[data-open-confirm-out-id]');
    const hint = document.body.textContent.includes('لسه في الفرع 2');

    // ونفرّغ الفرع: المفروض تتحول "خلصت" **لوحدها**، من غير ما حد يدوس
    // حاجة — فالزرار أصلًا مابقاش له لازمة.
    await applyQuantityChange('c1', 'g1', G, 'branchQty', 2, 0);
    state.grades = [G];
    render();
    return {
      pendingWithStock,
      shownWithStock,
      hint,
      autoOut: G.status === 'out' && (G.branchQty || 0) === 0,
      status: G.status,
      branch: G.branchQty,
    };
  });

  check('الحالة فضلت معلّقة والفرع فيه 2 (الطلب البشري مايتلغيش لوحده)', out.pendingWithStock, out);
  check('⭐ "مفيش خالص" مابتظهرش والفرع فيه كمية', out.shownWithStock === false, out);
  check('وبيقول للمستخدم السبب', out.hint, out);
  check('ولما الفرع يفضى بتتحول "خلصت" لوحدها', out.autoOut, out);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  console.log(`\n✅ نجح: ${pass.length}`);
  pass.forEach((t) => console.log('   ✓ ' + t));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    fail.forEach((t) => console.log('   ✗ ' + t));
    process.exit(1);
  }
  console.log('\nكل الفحوص نجحت.');
})();
