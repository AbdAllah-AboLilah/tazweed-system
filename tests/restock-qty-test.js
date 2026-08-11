// ============================================================
// طلب التزويد بكمية، والملصق النصّي بخانة واحدة
// ============================================================
// تلات طلبات اتنفّذوا مع بعض:
//   1) طلب تزويد بكمية أكتر من واحد (الافتراضي فاضل واحد)، ولازم **يبان
//      مختلف** — وإلا أمين الرئيسي يزوّد واحدة والطلب يتقفل ناقص
//   2) ومنطق يمنع الطلبات المستحيلة: درجة خلصت، أو كمية أكبر من الموجود
//      في الرئيسي. من غيره بتبقى طلبات معلّقة عمرها ما هتتقفل.
//   3) ملصق المسمّى بقى **خانة واحدة** بدل اتنين — النص بيلف لوحده
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 280)}` : ''));

const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof requestShortage === 'function');

  await p.evaluate(() => {
    window.__writes = [];
    window.__alerts = [];
    window.alert = (m) => window.__alerts.push(String(m));
    const noop = () => () => {};
    const mk = () => ({
      doc: (id) => ({ id,
        set: () => Promise.resolve(),
        update: (d) => { window.__writes.push({ id, ...d }); return Promise.resolve(); },
        delete: () => Promise.resolve(), collection: mk, onSnapshot: noop,
        get: () => Promise.resolve({ exists: false }) }),
      get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}),
    });
    window.db = { collection: mk, collectionGroup: mk, batch: () => ({ update() {}, set() {}, commit: () => Promise.resolve() }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    state.user = { uid: 'me' };
    state.profile = { name: 'x', role: 'owner', warehouseAccess: 'both' };
    state.view = 'dashboard'; state.screen = 'sheets'; state.isOnline = true;
    state.categories = [{ id: 'c1', name: 'كريب سادة لوكس', order: 1, minQty: 0, colorGroups: [] }];
    state.activeCategoryId = 'c1';
    state.grades = [
      { id: 'g1', number: 1, group: '', branchQty: 2, mainQty: 5, status: 'normal' },  // فيه 5
      { id: 'g2', number: 2, group: '', branchQty: 2, mainQty: 1, status: 'normal' },  // فيه 1 بس
      { id: 'g3', number: 3, group: '', branchQty: 0, mainQty: 0, status: 'out' },     // خلصت
      { id: 'g4', number: 4, group: '', branchQty: 0, mainQty: 4, status: 'pending', requestedQty: 3 },
      { id: 'g5', number: 5, group: '', branchQty: 0, mainQty: 4, status: 'pending' },
    ];
    state.pendingByCategory = {}; state.pendingCount = 0;
    state.outByCategory = {}; state.outCount = 0; state.lowStockByCategory = {};
    state.requestQtyGradeId = null;
    render();
  });

  // ============================================================
  // 1) ⭐ الطلب العادي مايتغيّرش
  // ============================================================
  const plain = await p.evaluate(async () => {
    window.__writes = [];
    await requestShortage('g1', 1);
    return window.__writes;
  });
  check('⭐ الطلب العادي لسه بيبعت pending', plain.length === 1 && plain[0].status === 'pending', plain);
  // ⚠️ الحقل بيتكتب null مش رقم — عشان الطلب الجاي مايرثش كمية قديمة
  check('⭐ والكمية المطلوبة بتتصفّر (مش بترث رقم قديم)', plain[0].requestedQty === null, plain);

  // ============================================================
  // 2) ⭐ الطلب بكمية
  // ============================================================
  const withQty = await p.evaluate(async () => {
    window.__writes = [];
    await requestShortage('g1', 3);
    return window.__writes;
  });
  check('⭐ الطلب بكمية 3 بيتسجّل',
    withQty.length === 1 && withQty[0].status === 'pending' && withQty[0].requestedQty === 3, withQty);

  // ============================================================
  // 3) ⭐⭐ المنطق: الطلبات المستحيلة بتترفض
  // ============================================================
  const blocked = await p.evaluate(async () => {
    const out = {};
    const run = async (id, qty) => {
      window.__writes = []; window.__alerts = [];
      await requestShortage(id, qty);
      return { writes: window.__writes.length, msg: window.__alerts.join(' | ') };
    };
    out.outOfStock = await run('g3', 1);      // درجة خلصت
    out.overMain = await run('g2', 2);        // الرئيسي فيه 1 والطلب 2
    out.exactMain = await run('g2', 1);       // بالظبط اللي موجود — لازم يعدّي
    return out;
  });
  check('⭐⭐ درجة خلصت: الطلب بيترفض ومفيش أي كتابة',
    blocked.outOfStock.writes === 0 && /خلصت/.test(blocked.outOfStock.msg), blocked.outOfStock);
  check('⭐⭐ كمية أكبر من الرئيسي: بيترفض والرسالة بتقول الموجود كام',
    blocked.overMain.writes === 0 && /1/.test(blocked.overMain.msg), blocked.overMain);
  check('⭐ وبالظبط اللي موجود بيعدّي (مش بيترفض بالغلط)',
    blocked.exactMain.writes === 1, blocked.exactMain);

  // ============================================================
  // 4) ⭐⭐ الطلب بكمية **بيبان مختلف**
  // ============================================================
  const ui = await p.evaluate(async () => {
    state.requestQtyGradeId = null;
    render();
    await new Promise((r) => setTimeout(r, 40));
    const rowOf = (id) => {
      const el = document.querySelector(`[data-request-shortage-id="${id}"], [data-quick-fulfill-id="${id}"]`);
      return el ? el.closest('tr,.grade-card,div') : null;
    };
    const html = document.body.innerHTML;
    return {
      // g4 مطلوب منها 3 → لازم تبان "×3"
      qtyBadge: (html.match(/badge-qty[^>]*>×(\d+)/g) || []),
      // g5 طلب عادي → مفيش شارة كمية عندها
      badgeCount: (html.match(/badge-qty/g) || []).length,
      // زرار "بكمية" بيظهر على اللي الرئيسي فيها أكتر من واحد
      hasQtyBtn: !!document.querySelector('[data-request-qty-id="g1"]'),
      // ومابيظهرش على اللي فيها واحد بس (مالوش معنى)
      noQtyBtnWhenOne: !document.querySelector('[data-request-qty-id="g2"]'),
      // زرار التزويد بياخد الكمية المطلوبة
      fulfillQty: (document.querySelector('[data-quick-fulfill-id="g4"]') || {}).dataset?.quickFulfillQty,
      fulfillQtyPlain: (document.querySelector('[data-quick-fulfill-id="g5"]') || {}).dataset?.quickFulfillQty,
      hasRow: !!rowOf('g1'),
    };
  });
  check('⭐⭐ الطلب بكمية بيبان بشارة "×3"',
    ui.qtyBadge.length === 1 && /×3/.test(ui.qtyBadge[0]), ui);
  check('⭐ والطلب العادي مافيهوش شارة كمية', ui.badgeCount === 1, ui);
  check('⭐ زرار "بكمية" بيظهر لما الرئيسي فيه أكتر من واحد', ui.hasQtyBtn, ui);
  // ⚠️ لو الرئيسي فيه واحد بس، الزرار مالوش أي معنى — أقصى طلب هو 1 أصلًا
  check('⭐ ومابيظهرش لما الرئيسي فيه واحد بس', ui.noQtyBtnWhenOne, ui);
  check('⭐⭐ زرار التزويد بياخد الكمية اللي اتطلبت (3) مش الافتراضي',
    ui.fulfillQty === '3', ui);
  check('⭐ والطلب العادي بياخد الافتراضي', ui.fulfillQtyPlain === '1', ui);

  // ============================================================
  // 5) ⭐ التزويد والإلغاء بيصفّروا الكمية المطلوبة
  // ============================================================
  const cleared = await p.evaluate(async () => {
    window.__writes = [];
    await fulfillShortage('g4', 3);
    const f = window.__writes[0];
    window.__writes = [];
    await cancelShortage('g4');
    const c = window.__writes[0];
    return { fulfil: f, cancel: c };
  });
  // ⚠️ من غير التصفير، الطلب الجاي على نفس الدرجة هيرث "×3" وهو طلب عادي
  check('⭐ التزويد بيصفّر الكمية المطلوبة', cleared.fulfil.requestedQty === null, cleared.fulfil);
  check('⭐ والإلغاء كمان', cleared.cancel.requestedQty === null, cleared.cancel);

  // ============================================================
  // 6) ⭐ المسمّى: خانة واحدة بتلف
  // ============================================================
  const custom = await p.evaluate(async () => {
    openCustomLabelDialog();
    await new Promise((r) => setTimeout(r, 60));
    const out = {
      oneField: !!document.getElementById('custom-text'),
      oldFields: !!document.getElementById('custom-line1') || !!document.getElementById('custom-line2'),
      focused: document.activeElement && document.activeElement.id === 'custom-text',
    };
    const el = document.getElementById('custom-text');
    // ⚠️ لو المستخدم دوس Enter، لازم يتحوّل مسافة — اللف حسب المساحة
    el.value = 'بضاعة مرتجعة\nمورّد: نصار';
    window.__printed = null;
    window.printTextLabel = async (t) => { window.__printed = t; };
    document.getElementById('custom-label-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 200));
    out.printed = window.__printed;
    return out;
  });
  check('⭐ المسمّى بقى خانة واحدة', custom.oneField && !custom.oldFields, custom);
  check('والمؤشر فيها', custom.focused, custom);
  check('⭐ والسطر الجديد بيتحوّل مسافة (اللف حسب المساحة مش حسب Enter)',
    custom.printed === 'بضاعة مرتجعة مورّد: نصار', custom);

  // ⭐ الملصق النصّي: نص واحد بيلف، مش سطرين مفروضين
  const wrap = await p.evaluate(async (SIZE) => {
    const short = buildGradeLabelHTML('كريب — درجة 5', SIZE, 1);
    const long = buildGradeLabelHTML('كريب سادة لوكس بيجات — كيوي درجة 5601 موديل 2024', SIZE, 1);
    const has = (h, re) => re.test(h);
    return {
      oneBlock: has(short, /class="t"/) && !has(short, /class="l1"/) && !has(short, /class="l2"/),
      shortSize: +(short.match(/font-size: ([\d.]+)mm/) || [])[1],
      longSize: +(long.match(/font-size: ([\d.]+)mm/) || [])[1],
      longClamp: +(long.match(/-webkit-line-clamp: (\d+)/) || [])[1],
    };
  }, SIZE);
  check('⭐ الملصق النصّي بقى كتلة واحدة (مش l1 و l2)', wrap.oneBlock, wrap);
  check('⭐ والنص الطويل بيصغّر عشان يدخل', wrap.longSize < wrap.shortSize, wrap);
  check('⭐ والنقط موجودة كخطة أخيرة', wrap.longClamp >= 1, wrap);

  // ⭐ القديم في السلة لسه بيتقرا (line1/line2)
  const legacy = await p.evaluate(async (SIZE) => {
    const old = await buildCartItemLabel({ custom: { line1: 'بضاعة', line2: 'نصار' }, qty: 1 }, SIZE);
    const nu = await buildCartItemLabel({ custom: { text: 'بضاعة — نصار' }, qty: 1 }, SIZE);
    return { same: old.html === nu.html, kept: sanitizePrintCart([{ custom: { line1: 'ملاحظة' } }]).length };
  }, SIZE);
  // ⚠️ فيه سلات محفوظة على أجهزة الناس بالشكل القديم — لو قرأناها غلط
  // الملصق هيطلع فاضي من غير أي رسالة خطأ
  check('⭐ المسمّى المحفوظ بالشكل القديم لسه بيطلع صح', legacy.same, legacy);
  check('⭐ ومابيتشالش من السلة', legacy.kept === 1, legacy);

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
