// إلغاء طلب التزويد — الحالة الممنوعة + تصليح الدرجات النايمة
// ============================================================
// اتطلب بالنص: "انا مش عاوز حد يعرف يلغي طلب تزويد في حالة ان كمية
// الفرع صفر وفي كميه في المخزن الرئيسي ... في الحالة دي بس اللي ممكن
// منشئ النظام يلغي ... الحالات التانيه عادي".
//
// **ليه الحالة دي بالذات**: الإلغاء بيكتب الحالة "عادي" من غير ما يلمس
// الكمية. فالدرجة بتفضل صفر في الفرع ومكتوب عليها عادي، وتختفي من ورقة
// التزويد — والنظام مابيراجعش الحالة غير لما كمية تتغيّر. يعني بضاعة
// موجودة في الرئيسي والرف فاضي ومحدش واخد باله.
//
// ⚠️⚠️ أخطر فحص في الملف هو **اللفة اللا نهائية**: التصليح بيتنده من
// جوه onSnapshot، والكتابة بتولّد لقطة جديدة. من غير حارس "مرة واحدة
// لكل فئة" بيبقى لوب بيضرب السحابة من غير توقف.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() =>
    typeof cancelNeedsOwner === 'function' && typeof healStuckPending === 'function');

  const r = await p.evaluate(async () => {
    const out = {};

    // ============================================================
    // ١) القاعدة: امتى الإلغاء محتاج منشئ النظام
    // ============================================================
    out.zeroWithMain = cancelNeedsOwner({ branchQty: 0, mainQty: 5 });   // ممنوع
    out.hasBranch = cancelNeedsOwner({ branchQty: 1, mainQty: 5 });      // عادي
    out.bothZero = cancelNeedsOwner({ branchQty: 0, mainQty: 0 });       // عادي (مفيش تزويد ممكن)
    // ⚠️ الحقول الناقصة = صفر، فالدرجة من غير كميات مالهاش قفل
    out.noFields = cancelNeedsOwner({});

    // ============================================================
    // ٢) الإلغاء نفسه — بيترفض ويقول ليه
    // ============================================================
    state.activeCategoryId = 'c1';
    state.categories = [{ id: 'c1', name: 'شيفون' }];
    state.user = { uid: 'u1' };
    const writes = [];
    window.gradeRefOf = () => ({ update: (d) => { writes.push(d); return Promise.resolve(); } });
    window.readGrade = async () => ({ id: 'g1', number: 1, branchQty: 0, mainQty: 5, status: 'pending' });
    window.db = { collection: () => ({ add: () => Promise.resolve(), doc: () => ({ update: () => Promise.resolve() }) }) };
    let alerted = '';
    const realAlert = window.alert;
    window.alert = (m) => { alerted = String(m); };

    // موظف عادي → مرفوض
    state.profile = { name: 'محمد', role: 'warehouse_keeper' };
    writes.length = 0; alerted = '';
    await cancelShortage('g1');
    out.blockedWrites = writes.length;
    out.blockedSaysZero = alerted.indexOf('صفر') !== -1;
    out.blockedSaysMain = alerted.indexOf('5') !== -1;
    out.blockedSaysWho = /المدير|منشئ النظام/.test(alerted);

    // منشئ النظام → مسموح
    state.profile = { name: 'عبدالله', role: 'owner' };
    writes.length = 0; alerted = '';
    await cancelShortage('g1');
    out.ownerWrites = writes.length;
    out.ownerNoAlert = alerted === '';

    // ⚠️ (تحقّق) وفيه كمية في الفرع → الموظف العادي يلغي عادي
    window.readGrade = async () => ({ id: 'g1', number: 1, branchQty: 1, mainQty: 5, status: 'pending' });
    state.profile = { name: 'محمد', role: 'warehouse_keeper' };
    writes.length = 0; alerted = '';
    await cancelShortage('g1');
    out.normalCaseWrites = writes.length;
    out.normalCaseNoAlert = alerted === '';
    window.alert = realAlert;

    // ============================================================
    // ٣) تصليح الدرجات النايمة
    // ============================================================
    const notices = [];
    window.showPrintNotice = (m) => { notices.push(String(m)); };
    state.profile = { name: 'محمد', role: 'warehouse_keeper', warehouseAccess: 'both' };
    state.grades = [
      { id: 'g1', branchQty: 0, mainQty: 5, status: 'normal' },   // نايمة ← تتصلّح
      { id: 'g2', branchQty: 0, mainQty: 0, status: 'out' },      // خلصت ← تُترك
      { id: 'g3', branchQty: 3, mainQty: 5, status: 'normal' },   // فيها كمية ← تُترك
      { id: 'g4', branchQty: 0, mainQty: 2, status: 'pending' },  // طالبة خلاص ← تُترك
      { id: 'g5', status: 'normal' },                             // من غير كميات ← تُترك
    ];
    writes.length = 0; notices.length = 0;
    healStuckPending('cat-a', false);
    out.healedCount = writes.length;
    out.healedToPending = writes.every((w) => w.status === 'pending');
    out.healedNotManual = writes.every((w) => w.manualRequest === false);
    out.healSaid = notices.join(' | ');

    // ⚠️⚠️ اللفة: نداء تاني لنفس الفئة **مايكتبش تاني**
    writes.length = 0;
    healStuckPending('cat-a', false);
    healStuckPending('cat-a', false);
    healStuckPending('cat-a', false);
    out.loopWrites = writes.length;

    // ⚠️ ومابيشتغلش والكتابة لسه معلّقة
    writes.length = 0;
    healStuckPending('cat-b', true);
    out.pendingWriteSkips = writes.length;
    // (وبعد ما تخلص بيشتغل عادي — يعني الحارس مش بيقفلها للأبد)
    healStuckPending('cat-b', false);
    out.afterPendingWorks = writes.length;

    // ⚠️ ومابيشتغلش لحساب مالوش صلاحية
    state.profile = { name: 'موظف', role: 'print_operator' };
    writes.length = 0;
    healStuckPending('cat-c', false);
    out.noPermSkips = writes.length;

    // ⚠️ ولا لفئة مقفولة عليه
    state.profile = { name: 'محمد', role: 'warehouse_keeper', warehouseAccess: 'both', categoryAccess: ['cat-z'] };
    writes.length = 0;
    healStuckPending('cat-d', false);
    out.scopedSkips = writes.length;

    return out;
  });

  check('⭐⭐⭐ فرع صفر + رئيسي فيه كمية → الإلغاء محتاج منشئ النظام', r.zeroWithMain);
  check('⭐⭐ وفيه كمية في الفرع → عادي', !r.hasBranch);
  check('⭐⭐ والاتنين صفر → عادي (مفيش تزويد ممكن أصلًا)', !r.bothZero);
  check('⚠️ ودرجة من غير كميات → عادي', !r.noFields);

  check('⭐⭐⭐ الموظف العادي **مايقدرش** يلغي في الحالة دي', r.blockedWrites === 0, r.blockedWrites);
  check('⭐⭐ والرسالة بتقول الفرع صفر', r.blockedSaysZero);
  check('⭐⭐ وبتقول كام في الرئيسي', r.blockedSaysMain);
  check('⭐⭐ وبتقوله يرجع لمين', r.blockedSaysWho);
  check('⭐⭐⭐ ومنشئ النظام بيلغي عادي', r.ownerWrites === 1 && r.ownerNoAlert, [r.ownerWrites, r.ownerNoAlert]);
  check('⚠️ (تحقّق) والحالة العادية بتلغي من غير أي تحذير',
    r.normalCaseWrites === 1 && r.normalCaseNoAlert, [r.normalCaseWrites, r.normalCaseNoAlert]);

  check('⭐⭐⭐ الدرجة النايمة بترجع تطلب تزويد', r.healedCount === 1, r.healedCount);
  check('⭐⭐ والحالة بتبقى معلّقة', r.healedToPending);
  check('⭐⭐ ومتعلّمة إنها **مش** طلب بشري (فتتلغي لوحدها لما تتزوّد)', r.healedNotManual);
  check('⭐⭐⭐ والتصليح **بيتقال** مش في سكوت', /رجعت لطلب التزويد|رجعوا/.test(r.healSaid), r.healSaid);
  check('⭐⭐⭐⭐ ومفيش لفة: النداء التاني والتالت مايكتبوش', r.loopWrites === 0, r.loopWrites);
  check('⚠️ ومابيشتغلش والكتابة لسه معلّقة', r.pendingWriteSkips === 0, r.pendingWriteSkips);
  check('⚠️ (تحقّق) وبيشتغل بعدها عادي', r.afterPendingWorks === 1, r.afterPendingWorks);
  check('⭐⭐ ومابيشتغلش لحساب مالوش صلاحية', r.noPermSkips === 0, r.noPermSkips);
  check('⭐⭐ ولا لفئة مقفولة عليه', r.scopedSkips === 0, r.scopedSkips);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
