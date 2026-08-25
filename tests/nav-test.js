// v0.57.1 — التنقّل الجديد: الشريط التحت، "المزيد"، والحاجات اللي كسرها
//
// ⚠️⚠️ الملف ده اتكتب **بعد** ما أربع أعطال وصلوا للمحل في v0.57.0.
// كل فحص هنا بيمسك واحد منهم بالظبط. اقرا السبب جنب كل واحد قبل ما
// تلمس التنقّل تاني.
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 260)}` : ''));

const SETUP = () => {
  const noop = () => () => {};
  const mk = () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), collection: mk, onSnapshot: noop, get: () => Promise.resolve({ exists: false }) }), get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
  window.db = { collection: mk, collectionGroup: mk };
  state.user = { uid: 'u1' };
  state.profile = { name: 'AboLilah', role: 'owner', warehouseAccess: 'both' };
  state.view = 'dashboard';
  state.screen = 'sheets';
  state.isOnline = true;
  state.categories = [
    { id: 'c1', name: 'كريب سادة لوكس بيجات وألوان', order: 1, colorGroups: ['بيجات', 'ألوان'], itemName: 'كريب سادة لوكس' },
    { id: 'c2', name: 'شيفون', order: 2 },
  ];
  state.activeCategoryId = 'c1';
  state.grades = [
    { id: 'g1', number: 1, group: 'بيجات', branchQty: 0, mainQty: 6, status: 'pending' },
    { id: 'g2', number: 2, group: 'بيجات', branchQty: 4, mainQty: 5, status: 'normal' },
    { id: 'g3', number: 3, group: 'ألوان', branchQty: 0, mainQty: 0, status: 'out' },
  ];
  state.pendingByCategory = {}; state.pendingCount = 0; state.outByCategory = {}; state.outCount = 0; state.lowStockByCategory = {};
  render();
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const m = document.createElement('meta'); m.name = 'viewport';
      m.content = 'width=device-width, initial-scale=1'; document.head.appendChild(m);
    });
  });
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');
  await p.evaluate(SETUP);

  // ============================================================
  // ١) الشريط التحت
  // ============================================================
  const bar = await p.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const items = [...nav.querySelectorAll('.bnav-item')];
    return {
      visible: getComputedStyle(nav).display !== 'none',
      count: items.length,
      ids: items.map((x) => x.id),
      minH: Math.min(...items.map((x) => Math.round(x.getBoundingClientRect().height))),
      tabsHidden: getComputedStyle(document.querySelector('.tabs')).display === 'none',
      hasBadge: !!nav.querySelector('.pending-dot'),
    };
  });
  check('⭐⭐ الشريط التحت ظاهر على الموبايل', bar.visible, bar);
  // ⚠️ خمسة مش ستة: الأصناف والحسابات مربوطين بالصلاحيات، فلو كانوا
  // في الشريط كان هيبقى ٤ بنود عند حد و٦ عند حد تاني.
  check('⭐⭐ خمس بنود بالظبط', bar.count === 5, bar);
  check('⭐ والتابات الفوقانية اتخبّت', bar.tabsHidden, bar);
  // ⚠️ 44 بكسل = أصغر مقاس الصباع مابيغلطش عليه
  check('⭐⭐ وكل بند ارتفاعه ٤٤ بكسل على الأقل', bar.minH >= 44, bar);

  // ============================================================
  // ٢) ⚠️⚠️ الشاشة اللي بتتفتح لازم **تحمّل بياناتها**
  // ============================================================
  // العطل اللي حصل فعلًا: الشريط التحت كان بيعمل state.screen = ...
  // و render() وبس — من غير ما ينادي اللي بيحمّل. فشاشة الحسابات
  // وشاشة الأصناف فضلوا "جارٍ التحميل..." للأبد على تليفون المحل.
  const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
  // ⚠️ بندوّر على جدول الأحداث نفسه (const bnav = {) مش على أول ذكر
  // للاسم — أول ذكر بيبقى في بناء الـHTML مش في الربط.
  const bnavAt = src.indexOf('const bnav = {');
  const attach = bnavAt >= 0 ? src.slice(bnavAt, bnavAt + 900) : '';
  check('⭐⭐⭐ الشريط التحت بينادي openScreen (اللي بيحمّل)',
    /openScreen\('home'\)/.test(attach) && /openScreen\('print'\)/.test(attach), attach.slice(0, 160));
  check('⭐⭐⭐ و"المزيد" كمان (الأصناف والحسابات)',
    /moreProducts[\s\S]{0,120}openScreen\('products'\)/.test(src) &&
    /moreUsers[\s\S]{0,120}openScreen\('users'\)/.test(src), null);
  check('⭐⭐ ومافيش أي طريق تاني بيبدّل الشاشة من غير تحميل',
    !/state\.screen = screen;\s*\n\s*state\.sideMenuOpen = false;\s*\n\s*render\(\);/.test(src), null);
  // والدالة نفسها لازم تفضل بتنادي التحميل
  const openFn = src.slice(src.indexOf('function openScreen'), src.indexOf('function openScreen') + 700);
  check('⭐⭐⭐ وopenScreen بتنادي loadProducts وsubscribeUsers',
    /loadProducts\(/.test(openFn) && /subscribeUsers\(/.test(openFn), openFn.slice(0, 120));

  // ============================================================
  // ٣) ⚠️⚠️ القوايم المنسدلة لازم تفتح
  // ============================================================
  // العطل: حطينا overflow-x على شريط الأزرار عشان يفضل سطر واحد،
  // ولوحة القايمة position:absolute جوّاه — فاتقصّت. الزرار بيتضغط
  // ومايظهرش حاجة.
  const menus = await p.evaluate(async () => {
    const out = { rows: null, opened: [], clipped: [] };
    const row = document.querySelector('.toolbar-row');
    const kids = [...row.children].filter((x) => x.offsetWidth);
    out.rows = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top))).size;
    out.overflow = getComputedStyle(row).overflowX;

    for (const menu of document.querySelectorAll('.tool-menu')) {
      const btn = menu.querySelector('.btn');
      const panel = menu.querySelector('.tool-menu-panel');
      if (!btn || !panel) continue;
      btn.click();
      await new Promise((r) => setTimeout(r, 60));
      const r = panel.getBoundingClientRect();
      out.opened.push(getComputedStyle(panel).display !== 'none');
      // اللوحة المقصوصة بيبقى عرضها/طولها صفر أو برّه الشاشة
      out.clipped.push(r.width < 40 || r.height < 20);
      btn.click();
      await new Promise((r2) => setTimeout(r2, 30));
    }
    return out;
  });
  check('⭐⭐ أزرار الشيت في سطر واحد', menus.rows === 1, menus);
  // ⚠️ overflow على الشريط = القايمة بتتقص. ماترجعوش.
  check('⭐⭐⭐ ومافيش overflow على شريط الأزرار', menus.overflow === 'visible', menus);
  check('⭐⭐⭐ وكل قايمة منسدلة بتفتح فعلًا',
    menus.opened.length >= 3 && menus.opened.every(Boolean), menus);
  check('⭐⭐⭐ ومفيش قايمة مقصوصة', menus.clipped.every((x) => !x), menus);

  // ============================================================
  // ٤) ⚠️ الشريط المرتفع (اسم المجموعة والحالة) لازم يفضل ثابت
  // ============================================================
  // العطل: topOffsetPx كانت بتقيس .topbar + .tabs، والتابات اتخبّت
  // على الموبايل واتحطّ مكانها .screen-title. فالشريط بقى بيلزق تحت
  // العنوان ويختفي وراه — باين إنه مش ثابت خالص.
  const sticky = await p.evaluate(() => {
    const title = document.getElementById('screen-title');
    const topbar = document.querySelector('.topbar');
    const val = getComputedStyle(document.documentElement).getPropertyValue('--sticky-top').trim();
    return {
      stickyTop: val,
      topbarH: Math.round(topbar.getBoundingClientRect().height),
      titleH: title ? Math.round(title.getBoundingClientRect().height) : 0,
      titleVisible: title ? getComputedStyle(title).display !== 'none' : false,
      titleText: title ? title.textContent.trim() : '',
    };
  });
  const expected = sticky.topbarH + sticky.titleH;
  check('⭐⭐⭐ الارتفاع الملزوق بيحسب عنوان الشاشة كمان',
    Math.abs(parseInt(sticky.stickyTop, 10) - expected) <= 2, { got: sticky.stickyTop, expected, sticky });
  check('⭐ وعنوان الشاشة بيكتب اسم الفئة كامل من غير قص',
    sticky.titleVisible && sticky.titleText.includes('كريب سادة لوكس بيجات وألوان'), sticky);

  // ============================================================
  // ٥) "المزيد" — ولا زرار بيضيع
  // ============================================================
  const more = await p.evaluate(async () => {
    document.getElementById('bnav-more').click();
    await new Promise((r) => setTimeout(r, 120));
    const sheet = document.getElementById('more-sheet');
    const items = [...sheet.querySelectorAll('.more-item')];
    return {
      open: sheet.classList.contains('open'),
      labels: items.map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
      minH: items.length ? Math.min(...items.map((x) => Math.round(x.getBoundingClientRect().height))) : 0,
    };
  });
  check('⭐⭐ "المزيد" بتفتح', more.open, more);
  // ⚠️ التمنية اللي كانوا في ☰ + الأصناف والحسابات
  const wanted = ['الأصناف', 'الحسابات', 'سجل العمليات', 'باركود', 'إكسل', 'احتياطية', 'المظهر', 'خروج'];
  const missing = wanted.filter((w) => !more.labels.some((l) => l.includes(w)));
  check('⭐⭐⭐ ولا زرار بيضيع من قايمة ☰', missing.length === 0, { missing, labels: more.labels });
  check('⭐ وكل بند ٤٤ بكسل على الأقل', more.minH >= 44, more);

  // ⚠️ زراير "المزيد" لازم تضغط على زراير ☰ نفسها مش تكرّر منطقها —
  // المنطق المكرّر بيفضل متطابق أسبوع وبعدين يفترقوا في سكوت.
  check('⭐⭐ وزراير "المزيد" بتضغط على زراير ☰ نفسها',
    /moreTwins/.test(src) && /clickTwin/.test(src), null);

  // ============================================================
  // ٦) ⚠️⚠️ أي شريط ثابت تحت لازم يفضل **فوق** الشريط التحت
  // ============================================================
  // العطل: شريط الأوامر (اطبع المحدّد / اطلب تزويد) كان bottom:0
  // وz-index:1000، والشريط التحت bottom:0 وz-index:1300 — فكان
  // **مخفي تمامًا** وانت محدّد 40 درجة ومش لاقي زرار الطباعة.
  const bars = await p.evaluate(async () => {
    document.getElementById('more-close-btn')?.click();
    await new Promise((r) => setTimeout(r, 80));
    state.screen = 'sheets';
    state.gradeLabelMode = true;
    state.gradeLabelQty = { g1: 2 };
    render();
    await new Promise((r) => setTimeout(r, 150));
    const act = document.querySelector('.action-bar');
    const nav = document.querySelector('.bottom-nav');
    if (!act || !nav) return { found: false };
    const a = act.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    return {
      found: true,
      actionBottom: Math.round(a.bottom),
      navTop: Math.round(n.top),
      // اللي تحت الشريط = مخفي
      overlapping: a.bottom > n.top + 1,
      actionVisible: getComputedStyle(act).display !== 'none' && a.height > 10,
    };
  });
  check('⭐⭐⭐ شريط الأوامر مش مخفي ورا الشريط التحت',
    bars.found && bars.actionVisible && !bars.overlapping, bars);

  // ============================================================
  // ٧) ⚠️⚠️ الأحداث بتتربط **مرة واحدة** مش مع كل رسمة
  // ============================================================
  // ده أهم فحص في الملف. لو المستمع اتربط مع كل رسمة، كل ضغطة هتتنفّذ
  // مرتين وتلاتة وعشرة — يعني +1 تبقى +10 على كمية حقيقية في المخزن.
  // والفحص ده بيمسك كمان لو حد رجّع الربط لكل عنصر (البطء).
  const deleg = await p.evaluate(async () => {
    const calls = [];
    const orig = window.changeQuantity;
    window.changeQuantity = function (c, g, f, d) { calls.push(d); return Promise.resolve(); };

    render();
    await new Promise((r) => setTimeout(r, 60));
    const plus = [...document.querySelectorAll('.qty-btn')].find((b) => b.dataset.action === 'inc');
    plus.click();
    await new Promise((r) => setTimeout(r, 60));
    const once = calls.length;

    // ٢٠ رسمة كمان — لو الربط بيتكرّر، العدد هيتضاعف
    calls.length = 0;
    for (let i = 0; i < 20; i++) render();
    await new Promise((r) => setTimeout(r, 60));
    const plus2 = [...document.querySelectorAll('.qty-btn')].find((b) => b.dataset.action === 'inc');
    plus2.click();
    await new Promise((r) => setTimeout(r, 60));
    const after20 = calls.length;

    // وكام مستمع بيتضاف على #root فعلًا؟
    const root = document.getElementById('root');
    const origAdd = EventTarget.prototype.addEventListener;
    let added = 0;
    EventTarget.prototype.addEventListener = function (...a) { if (this === root) added++; return origAdd.apply(this, a); };
    for (let i = 0; i < 10; i++) render();
    EventTarget.prototype.addEventListener = origAdd;

    window.changeQuantity = orig;
    return { once, after20, addedOnRoot: added, qtyBtns: document.querySelectorAll('.qty-btn').length };
  });
  check('⭐⭐⭐ ضغطة واحدة = نداء واحد', deleg.once === 1, deleg);
  check('⭐⭐⭐ وبعد ٢٠ رسمة لسه نداء واحد (مفيش مستمع مكرّر)', deleg.after20 === 1, deleg);
  check('⭐⭐ ومفيش مستمعين بيتضافوا على #root مع كل رسمة',
    deleg.addedOnRoot === 0, deleg);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  pass.filter((x) => x.includes('⭐')).forEach((x) => console.log('   ' + x));
  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach((x) => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
