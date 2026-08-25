// ============================================================
// حساب موظف الطباعة: تحديث ملف الأصناف من شاشته
// ============================================================
// الشكوى: **"المفتاح موجود في الإعدادات بس مش شغّال."**
//
// وده كان صح حرفيًا. المفتاح `importProducts` بتفتحه للحساب ده وبيتحفظ
// عادي — **ومايحصلش أي حاجة**. السبب:
//
//   زرار الاستيراد كان في شاشة "الأصناف" بس، وحساب موظف الطباعة **مقفول
//   على شاشة واحدة**: `dashboardHTML` بترجع بدري ومعاها شاشة الطباعة بس،
//   **من غير شريط تنقّل أصلًا**. فمكانش فيه أي طريقة يوصل للشاشة دي.
//
// الحل إن الزرار ييجي **له**، مش إنه يروح للشاشة — عشان الحساب ده مقصود
// إنه مايشوفش المخزن.
//
// ⚠️ والفحص بيحرس الحاجتين مع بعض: إن الزرار بيظهر بالمفتاح، وإن الحساب
// **لسه مايقدرش يوصل للمخزن**. لو حد "حلّها" بإنه يفتحله شاشة الأصناف،
// الفحص هيقع — لأن ده بيكسر سبب وجود الرتبة أصلًا.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');

  const asOperator = (perms) =>
    p.evaluate((perms) => {
      state.user = { uid: 'op1' };
      state.profile = { name: 'موظف الطباعة', role: 'print_operator', perms: perms || {} };
      state.view = 'dashboard';
      state.isOnline = true;
      state.screen = 'print';
      state.printCart = [];
      productsCache = [{ name: 'كريب', barcode: '123', price: '85' }];
      productsIndex = buildProductsIndex(productsCache);
      render();
      const txt = document.body.textContent;
      return {
        importBtn: !!document.getElementById('print-products-import-btn'),
        printScreen: /سلة الطباعة/.test(txt),
        // الحاجات اللي **مالوش** يشوفها
        navProducts: !!document.querySelector('[data-screen="products"]'),
        navSheets: !!document.querySelector('[data-screen="sheets"]'),
        sideMenu: !!document.getElementById('side-menu'),
        warehouse: /مخزن الفرع|المخزن الرئيسي/.test(txt),
      };
    }, perms);

  // ============================================================
  // 1) ⭐⭐ المفتاح مقفول = مفيش زرار (زي ما كان)
  // ============================================================
  const off = await asOperator({});
  check('⭐ المفتاح مقفول: مفيش زرار استيراد', off.importBtn === false, off);
  check('⭐ وشاشة الطباعة شغّالة عادي', off.printScreen === true, off);

  // ============================================================
  // 2) ⭐⭐ المفتاح مفتوح = الزرار بيظهر **له**
  // ============================================================
  // ده جوهر الشكوى: قبل كده المفتاح كان بيتفتح ومايحصلش حاجة.
  const on = await asOperator({ importProducts: true });
  check('⭐⭐ المفتاح مفتوح: الزرار بيظهر في شاشته', on.importBtn === true, on);

  // ============================================================
  // 3) ⭐⭐ وبرضه مايقدرش يوصل للمخزن
  // ============================================================
  // ⚠️ سبب وجود الرتبة دي إنه **مايلمسش المخزن**. لو حد فتحله شاشة
  // الأصناف عشان يوصل لزرار الاستيراد، يبقى كسر الرتبة نفسها.
  for (const [label, r] of [['والمفتاح مقفول', off], ['والمفتاح مفتوح', on]]) {
    check(`⭐⭐ ${label}: مفيش شريط تنقّل للأصناف`, r.navProducts === false, r);
    check(`⭐⭐ ${label}: ولا للشيتات`, r.navSheets === false, r);
    check(`⭐ ${label}: ولا قايمة فئات جانبية`, r.sideMenu === false, r);
    check(`⭐ ${label}: ومفيش كميات مخزن على الشاشة`, r.warehouse === false, r);
  }

  // ============================================================
  // 4) ⭐⭐ الزرار مربوط فعلًا (مش شكل)
  // ============================================================
  const wired = await p.evaluate(() => {
    state.profile = { name: 'م', role: 'print_operator', perms: { importProducts: true } };
    state.screen = 'print';
    render();
    let opened = 0;
    const real = window.openProductsImportDialog;
    window.openProductsImportDialog = () => { opened++; };
    document.getElementById('print-products-import-btn').click();
    window.openProductsImportDialog = real;
    return opened;
  });
  check('⭐⭐ الضغط بيفتح شاشة الاستيراد فعلًا', wired === 1, { opened: wired });

  // ============================================================
  // 5) ⭐ الرتب التانية زي ما هي
  // ============================================================
  const others = await p.evaluate(() => {
    const out = {};
    for (const role of ['owner', 'warehouse_keeper', 'user']) {
      state.profile = { name: 'ت', role, warehouseAccess: 'both' };
      state.screen = 'print';
      state.printCart = [];
      render();
      out[role] = {
        importBtn: !!document.getElementById('print-products-import-btn'),
        nav: !!document.querySelector('[data-screen="products"]'),
      };
    }
    return out;
  });
  check('⭐ صاحب النظام: الزرار ظاهر له كمان', others.owner.importBtn === true, others.owner);
  check('⭐ وشريط التنقّل بتاعه ما اتلمسش', others.owner.nav === true, others.owner);
  check('⭐ ومستخدم عادي مالوش زرار', others.user.importBtn === false, others.user);

  // ============================================================
  // 6) ⭐⭐ قواعد السحابة بتسمح بالاستثناء
  // ============================================================
  // ⚠️ من غير ده الزرار يظهر ويشتغل **ويفشل عند السيرفر** — أوحش من إنه
  // مايظهرش أصلًا.
  const fs = require('fs');
  const rules = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
  check('⭐⭐ القواعد بتقرا الاستثناء الشخصي قبل قالب الرتبة',
    /userProfile\(\)\.get\(\['perms', key\], presetHas\(key\)\)/.test(rules), null);
  check('⭐ وكتابة الأصناف مربوطة بنفس المفتاح',
    /match \/products\/\{docId\}[\s\S]{0,160}allow write: if can\('importProducts'\)/.test(rules), null);

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
