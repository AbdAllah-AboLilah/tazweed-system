// فحص شامل: كل شاشة، كل نافذة، وكل رتبة — نشوف أي خطأ بيطلع
const { chromium } = require('playwright');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const errors = [];

  const run = async (viewport, label) => {
    const p = await b.newPage({ viewport });
    p.on('pageerror', (e) => errors.push(`${label}: ${e}`));
    p.on('console', (m) => {
      const t = m.text();
      if (m.type() === 'error' && !/favicon|Failed to load resource/.test(t)) errors.push(`${label}/console: ${t}`);
    });
    await p.goto('http://localhost:8899/tests/harness.html');
    await p.waitForFunction(() => typeof render === 'function');

    await p.evaluate(() => {
      const noop = () => () => {};
      const mkDoc = (path) => ({
        id: path.split('/').pop(),
        set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve(),
        get: () => Promise.resolve({ exists: true, id: 'x', data: () => ({ number: 1, branchQty: 1, mainQty: 0, status: 'normal' }), metadata: { fromCache: false } }),
        collection: (n) => mkCol(path + '/' + n), onSnapshot: noop,
      });
      const mkCol = (path) => ({
        doc: (id) => mkDoc(path + '/' + (id || 'auto')), add: () => Promise.resolve(mkDoc(path + '/n')),
        get: () => Promise.resolve({ docs: [] }), where: () => mkCol(path), orderBy: () => mkCol(path), onSnapshot: noop,
      });
      window.db = { collection: mkCol, collectionGroup: mkCol, batch: () => ({ set() {}, update() {}, delete() {}, commit: () => Promise.resolve() }) };
      window.auth = { onAuthStateChanged: noop, signOut: () => Promise.resolve(), currentUser: null };

      productsCache = [
        { name: 'إيشارب كريب أسود', barcode: '900111', price: '85', origPrice: '100', dept: 'إيشاربات', subDept: 'كريب' },
        { name: 'بندانة قطن', barcode: '900333', price: '40', origPrice: '40', dept: 'بندانات', subDept: 'قطن' },
      ];
      productsIndex = buildProductsIndex(productsCache);

      state.user = { uid: 'u1' };
      state.profile = { name: 'AboLilah', role: 'admin', warehouseAccess: 'both' };
      state.view = 'dashboard';
      state.isOnline = true;
      state.categories = [
        { id: 'c1', name: 'كريب سادة', order: 1, minQty: 2, colorGroups: ['بيجات', 'ألوان'], itemName: 'كريب سادة لوكس', barcodeNumber: '28144', originalPrice: 100, sellingPrice: 85 },
        { id: 'c2', name: 'كريب لافوال', order: 2, minQty: 0 },
      ];
      state.activeCategoryId = 'c1';
      state.grades = [
        { id: 'g1', number: 1, group: 'بيجات', branchQty: 0, mainQty: 2, status: 'pending' },
        { id: 'g2', number: 2, group: 'بيجات', branchQty: 1, mainQty: 0, status: 'normal' },
        { id: 'g3', number: 1, group: 'ألوان', branchQty: 0, mainQty: 0, status: 'out' },
        { id: 'g4', isBase: true, name: 'أبيض', number: -3, branchQty: 2, mainQty: 0, status: 'normal', criticalQty: 3 },
      ];
      state.activityLog = [{ action: 'edit', field: 'branchQty', categoryName: 'كريب سادة', gradeNumber: 3, oldValue: 1, newValue: 0, userName: 'مدير' }];
      state.presence = [{ id: 'u1', name: 'AboLilah', role: 'admin', lastSeen: { toDate: () => new Date() } }];
      state.printStations = [];
      state.printCart = [{ key: '900111', product: productsCache[0], qty: 2 }];
      subscribeOverview();
    });
    return p;
  };

  // ---------- كل الشاشات على الكمبيوتر والموبايل ----------
  for (const [vp, label] of [[{ width: 1366, height: 900 }, 'كمبيوتر'], [{ width: 360, height: 780 }, 'موبايل']]) {
    const p = await run(vp, label);
    const screens = ['home', 'sheets', 'products', 'print', 'activity'];
    for (const screen of screens) {
      const r = await p.evaluate((s) => {
        state.screen = s;
        state.isNarrow = window.innerWidth <= 700;
        try { render(); } catch (e) { return { err: String(e) }; }
        return { html: document.getElementById('root').innerHTML.length, ids: [...document.querySelectorAll('[id]')].map((e) => e.id) };
      }, screen);
      check(`${label}: شاشة ${screen} بترسم`, !r.err && r.html > 200, r);
      const dup = r.ids ? r.ids.filter((v, i, a) => a.indexOf(v) !== i) : [];
      check(`${label}: شاشة ${screen} مفيش معرّف مكرر`, dup.length === 0, dup);
      // مفيش تمرير أفقي
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`${label}: شاشة ${screen} مفيش تمرير أفقي`, over <= 1, over);
    }

    // ---------- كل الأوضاع جوه الفئة ----------
    for (const mode of ['gradeLabelMode', 'bulkRequestMode', 'gradeSelectMode']) {
      const r = await p.evaluate((m) => {
        state.screen = 'sheets';
        state.gradeLabelMode = state.bulkRequestMode = state.gradeSelectMode = false;
        state[m] = true;
        try { render(); } catch (e) { return { err: String(e) }; }
        return { bar: !!document.getElementById('action-bar') };
      }, mode);
      check(`${label}: وضع ${mode} بيرسم شريط الأوامر`, !r.err && r.bar, r);
    }
    await p.evaluate(() => { state.gradeLabelMode = state.bulkRequestMode = state.gradeSelectMode = false; render(); });

    // ---------- القايمة الجانبية بكل فلتر ----------
    for (const f of ['all', 'pending', 'out', 'low']) {
      const r = await p.evaluate((f) => {
        state.sideMenuOpen = true; state.categoryFilter = f;
        try { render(); } catch (e) { return { err: String(e) }; }
        return { items: document.querySelectorAll('.side-item').length };
      }, f);
      check(`${label}: فلتر القايمة "${f}" بيشتغل`, !r.err, r);
    }
    await p.evaluate(() => { state.categoryFilter = 'all'; state.sideMenuOpen = false; render(); });
    await p.close();
  }

  // ---------- كل رتبة بتشوف اللي المفروض تشوفه ----------
  const p = await run({ width: 1366, height: 900 }, 'صلاحيات');
  const roles = ['admin', 'branch_manager', 'supervisor', 'warehouse_keeper', 'print_operator', 'user'];
  for (const role of roles) {
    const r = await p.evaluate((role) => {
      state.profile = { name: 'ت', role, warehouseAccess: 'both' };
      state.screen = 'sheets';
      try { render(); } catch (e) { return { err: String(e) }; }
      const has = (id) => !!document.getElementById(id);
      return {
        err: null,
        // ⚠️ من v0.30.0 حذف الفئة اتنقل من جوه الفئة لقايمة الفئات —
        // عشان تحذف من بره الفئة مش وانت جواها. الفحص بيدوّر على المكان
        // الجديد، وبيفتح القايمة الجانبية عشان تترسم.
        deleteCategory: (() => { state.sideMenuOpen = true; render(); return !!document.querySelector('[data-cat-delete]'); })(),
        addGrade: has('add-grade-btn'),
        colorGroups: has('color-groups-btn'),
        selectDelete: has('toggle-grade-select-btn'),
        users: has('users-btn'),
        printTab: !!document.querySelector('[data-screen="print"]'),
      };
    }, role);
    check(`رتبة ${role}: بترسم من غير خطأ`, !r.err, r);
    if (role === 'user') {
      check('رتبة user: مايقدرش يحذف فئة ولا يضيف درجة', !r.deleteCategory && !r.addGrade && !r.selectDelete, r);
      check('رتبة user: مايشوفش شاشة الحسابات', !r.users, r);
    }
    if (role === 'admin') {
      check('رتبة admin: بتشوف كل أدوات الإدارة', r.deleteCategory && r.addGrade && r.colorGroups && r.selectDelete && r.users, r);
    }
    if (role === 'print_operator') {
      check('موظف الطباعة: شاشة الطباعة بس', !r.deleteCategory && !r.users, r);
    }
  }

  // ---------- النوافذ المنبثقة ----------
  await p.evaluate(() => { state.profile = { name: 'ت', role: 'admin', warehouseAccess: 'both' }; state.screen = 'sheets'; render(); });
  const dialogs = [
    ['اختيار المقاس', 'promptLabelSize(() => {})', 'size-measured'],
    ['إضافة درجات دفعة', "openAddGradeRangeDialog('c1')", 'range-add'],
    ['مجموعات الألوان', "openColorGroupsDialog('c1')", null],
    ['ظبط كميات الفرع', 'openBulkBranchQtyDialog()', null],
    ['اختيار صنف', 'openProductPicker(() => {})', 'picker-search'],
    ['استيراد الأصناف', 'openProductsImportDialog(() => {})', null],
  ];
  for (const [name, call, id] of dialogs) {
    const r = await p.evaluate(([call, id]) => {
      const before = document.body.children.length;
      try { eval(call); } catch (e) { return { err: String(e) }; }
      const after = document.body.children.length;
      const okId = id ? !!document.getElementById(id) : true;
      // نقفل النافذة
      while (document.body.children.length > before) document.body.lastElementChild.remove();
      return { opened: after > before, okId };
    }, [call, id]);
    check(`نافذة "${name}" بتفتح`, !r.err && r.opened && r.okId, r);
  }

  // ---------- بناء مستندات الطباعة ----------
  const printDocs = await p.evaluate(async () => {
    const out = {};
    const qr = await generateQRDataURL('6291108735848', 200);
    const cat = state.categories[0];
    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    try { out.label = buildLabelHTML(cat, size, qr, 1).length; } catch (e) { out.labelErr = String(e); }
    try { out.restockAll = buildRestockHTML(cat, state.grades, '').length; } catch (e) { out.restockErr = String(e); }
    try { out.restockGroup = buildRestockHTML(cat, state.grades, 'بيجات').length; } catch (e) { out.restockGErr = String(e); }
    try { out.jobs = normalizePrintJobs([{ html: '<b>x</b>', copies: 2 }]).length; } catch (e) { out.jobsErr = String(e); }
    return out;
  });
  check('بناء الملصق شغّال', printDocs.label > 500, printDocs);
  check('بناء ورقة التزويد (كاملة) شغّال', printDocs.restockAll > 500, printDocs);
  check('بناء ورقة التزويد (مجموعة واحدة) شغّال', printDocs.restockGroup > 300, printDocs);
  check('تجهيز وظائف الطباعة شغّال', printDocs.jobs === 1, printDocs);

  // ---------- الحفظ المحلي والتراجع ----------
  const store = await p.evaluate(() => {
    clearUndoStack();
    pushUndo({ label: 'تجربة', categoryId: 'c1', gradeId: 'g1', before: { branchQty: 1 }, after: { branchQty: 0 } });
    const a = { count: state.undoCount, label: lastUndoLabel() };
    saveWorkState();
    const w = restoreWorkState('u1');
    clearUndoStack();
    return { ...a, savedCart: w && w.printCart ? w.printCart.length : -1, uid: w && w.uid };
  });
  check('التراجع بيتسجّل', store.count === 1 && store.label === 'تجربة', store);
  check('حالة الشغل بتتحفظ وترجع', store.savedCart === 1 && store.uid === 'u1', store);

  // ---------- اسم الدخول ----------
  const login = await p.evaluate(() => ({
    plain: usernameToEmail('Test-Print'),
    spaced: usernameToEmail('احمد محمد'),
    real: usernameToEmail('a@b.com'),
    back: emailToUsername('test-print@tazweed.local'),
  }));
  check('اسم دخول عادي بيتحوّل صح', login.plain === 'test-print@tazweed.local', login);
  check('إيميل حقيقي بيفضل زي ما هو', login.real === 'a@b.com', login);
  check('الرجوع للاسم المجرد شغّال', login.back === 'test-print', login);

  check('مفيش أي خطأ في كل الفحص', errors.length === 0, errors.slice(0, 5));

  await b.close();
  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) {
    console.log('\n❌ فشل (' + fail.length + '):');
    fail.forEach((x) => console.log('   ' + x));
  } else console.log('   كله تمام');
  process.exit(fail.length ? 1 : 0);
})();
