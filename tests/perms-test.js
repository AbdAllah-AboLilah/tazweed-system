// المفاتيح في الواجهة + معاينة ورقة التزويد
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,200)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof can === 'function');

  await p.evaluate(() => {
    const noop = () => () => {};
    const mk = () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve(), collection: mk, onSnapshot: noop, get: () => Promise.resolve({ exists: false }) }), get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
    window.db = { collection: mk, collectionGroup: mk, batch: () => ({ set() {}, update() {}, delete() {}, commit: () => Promise.resolve() }) };
    state.user = { uid: 'me' };
    state.view = 'dashboard';
    state.screen = 'sheets';
    state.categories = [{ id: 'c1', name: 'كريب', order: 1, minQty: 2, itemName: 'كريب', barcodeNumber: '28144', sellingPrice: 85 }];
    state.activeCategoryId = 'c1';
    state.grades = [
      { id: 'g1', number: 1, branchQty: 0, mainQty: 2, status: 'pending' },
      { id: 'g2', number: 2, branchQty: 3, mainQty: 0, status: 'normal' },
    ];
    state.users = [
      { id: 'me', name: 'أنا', role: 'owner' },
      { id: 'u2', name: 'مشرف', role: 'supervisor' },
      { id: 'u3', name: 'أمين', role: 'warehouse_keeper', warehouseAccess: 'branch', perms: { addGrades: false } },
    ];
  });

  const ui = async (profile) =>
    p.evaluate((profile) => {
      state.profile = profile;
      state.screen = 'sheets';
      render();
      const has = (id) => !!document.getElementById(id);
      return {
        addGrade: has('add-grade-btn'),
        addRange: has('add-grade-range-btn'),
        selectDelete: has('toggle-grade-select-btn'),
        deleteCat: (() => { state.sideMenuOpen = true; render(); return !!document.querySelector('[data-cat-delete]'); })(),
        colorGroups: has('color-groups-btn'),
        bulkQty: has('bulk-branch-qty-btn'),
        editCat: has('edit-category-info-btn'),
        printLabel: has('print-label-btn'),
        printRestock: has('print-restock-btn'),
        rowDelete: !!document.querySelector('[data-delete-grade-id]'),
        qtyInputs: document.querySelectorAll('.qty-input').length,
        usersTab: !!document.querySelector('[data-screen="users"]'),
        printerSetup: has('printer-settings-btn'),
        printTab: !!document.querySelector('[data-screen="print"]'),
        productsTab: !!document.querySelector('[data-screen="products"]'),
        excel: has('import-btn') || has('export-btn'),
        activity: has('activity-log-btn'),
      };
    }, profile);

  const owner = await ui({ name: 'أنا', role: 'owner' });
  check('منشئ النظام: كل حاجة مفتوحة', owner.addGrade && owner.selectDelete && owner.deleteCat && owner.usersTab && owner.excel && owner.printLabel && owner.printRestock && owner.printerSetup, owner);

  const sup = await ui({ name: 'مشرف', role: 'supervisor' });
  check('مشرف: مايعدّلش الكميات', sup.qtyInputs === 0 && !sup.bulkQty, sup);
  check('مشرف: مايحذفش', !sup.selectDelete && !sup.deleteCat && !sup.rowDelete, sup);
  check('مشرف: بينظّم الفئات ويضيف درجات', sup.editCat && sup.colorGroups && sup.addGrade, sup);
  check('مشرف: بيطبع', sup.printLabel && sup.printRestock, sup);
  check('مشرف: مايشوفش تاب الحسابات', !sup.usersTab, sup);
  check('مشرف: مايشوفش إعدادات الطابعة', !sup.printerSetup, sup);

  const bk = await ui({ name: 'أمين فرع', role: 'warehouse_keeper', warehouseAccess: 'branch' });
  check('أمين الفرع: بيعدّل كميات', bk.qtyInputs > 0 && bk.bulkQty, bk);
  check('أمين الفرع: بيضيف درجات', bk.addGrade && bk.addRange, bk);
  check('أمين الفرع: مايحذفش ومايعدّلش الفئة', !bk.selectDelete && !bk.deleteCat && !bk.editCat, bk);
  check('أمين الفرع: بيطبع', bk.printLabel && bk.printRestock, bk);

  const mk2 = await ui({ name: 'أمين رئيسي', role: 'warehouse_keeper', warehouseAccess: 'main', perms: { printLabel: false, printRestock: false, printScreen: false } });
  check('أمين الرئيسي (بمفاتيح مقفولة): مفيش طباعة خالص', !mk2.printLabel && !mk2.printRestock && !mk2.printTab, mk2);
  check('أمين الرئيسي: لسه بيعدّل الكميات', mk2.qtyInputs > 0, mk2);

  const custom = await ui({ name: 'أمين مقفول', role: 'warehouse_keeper', warehouseAccess: 'branch', perms: { addGrades: false } });
  check('استثناء بقفل لشخص واحد بيشتغل', !custom.addGrade && !custom.addRange && custom.qtyInputs > 0, custom);

  const supPlus = await ui({ name: 'مشرف بحذف', role: 'supervisor', perms: { deleteGrades: true } });
  check('استثناء بفتح لشخص واحد بيشتغل', supPlus.selectDelete && supPlus.rowDelete && !supPlus.deleteCat, supPlus);

  const plain = await ui({ name: 'عادي', role: 'user' });
  check('مستخدم عادي: مفيش تعديل ولا إدارة', plain.qtyInputs === 0 && !plain.addGrade && !plain.deleteCat && !plain.usersTab && !plain.excel, plain);
  check('مستخدم عادي: بيشوف الأصناف والطباعة', plain.productsTab && plain.printTab, plain);

  // ---- شاشة الحسابات ----
  const users = await p.evaluate(() => {
    state.profile = { name: 'أنا', role: 'owner' };
    state.screen = 'users';
    render();
    const rows = document.querySelectorAll('[data-edit-user]').length;
    const uid = (document.getElementById('my-uid') || {}).textContent;
    document.querySelector('[data-edit-user="u3"]').click();
    const perms = document.querySelectorAll('[data-perm]').length;
    const sel = document.querySelector('[data-perm="addGrades"]');
    const val = sel ? sel.value : null;
    const roleLocked = !document.getElementById('eu-role');
    document.getElementById('eu-cancel').click();
    // حساب منشئ النظام: الرتبة مقفولة
    document.querySelector('[data-edit-user="me"]').click();
    const meLocked = !document.getElementById('eu-role');
    document.getElementById('eu-cancel').click();
    return { rows, uid, perms, val, roleLocked, meLocked };
  });
  check('شاشة الحسابات بترسم الحسابات', users.rows === 3, users);
  check('معرّف الحساب ظاهر للنسخ', users.uid === 'me', users);
  check('جدول المفاتيح كامل (16 مفتاح)', users.perms === 16, users);
  check('الاستثناء المحفوظ ظاهر في مكانه', users.val === 'false', users);
  check('رتبة حساب عادي بتتغيّر', users.roleLocked === false, users);
  check('⭐ رتبة منشئ النظام مقفولة', users.meLocked === true, users);

  // ---- معاينة ورقة التزويد ----
  const roll = await p.evaluate(async () => {
    const cat = state.categories[0];
    const grades = [];
    for (let n = 1; n <= 60; n++) grades.push({ id: 'g' + n, number: n, status: n % 7 === 0 ? 'out' : 'normal' });
    const html = buildRestockHTML(cat, grades, '');
    const promise = showPrintPreview(html, { pageWidthMm: 80, autoHeight: true });
    await new Promise((r) => setTimeout(r, 500));
    const box = document.getElementById('roll-box');
    const frame = document.getElementById('roll-frame');
    const out = {
      opened: !!box,
      frameH: frame ? parseFloat(frame.style.height) : 0,
      innerH: box ? parseFloat(document.getElementById('roll-inner').style.height) : 0,
      boxW: box ? box.getBoundingClientRect().width : 0,
      hasPrint: !!document.getElementById('roll-print'),
      body: frame ? frame.contentWindow.document.body.textContent.replace(/\s+/g, ' ').slice(0, 40) : '',
    };
    document.getElementById('roll-cancel').click();
    out.result = await promise;
    return out;
  });
  check('معاينة ورقة التزويد بتفتح', roll.opened && roll.hasPrint, roll);
  check('الارتفاع اتقاس من المحتوى مش ثابت', roll.frameH > 300, roll);
  check('الصندوق اتظبط على المحتوى', roll.innerH > 200, roll);
  check('محتوى الورقة ظاهر جوه المعاينة', /كريب/.test(roll.body), roll);
  check('الإلغاء بيرجّع false (مش بيطبع)', roll.result === false, roll);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach((x) => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
