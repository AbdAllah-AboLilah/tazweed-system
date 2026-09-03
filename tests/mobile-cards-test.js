// كارتس الموبايل — الحسابات · سجل العمليات · معاينة الاستيراد · أقسام الطابعة
// ============================================================
// أربع شاشات كانت لسه جداول مضغوطة على تليفون ٣٩٠ بكسل بعد إعادة
// التشكيل. الفحص بيتأكد إن:
//   • الموبايل بيشوف كارتس، والكمبيوتر لسه بيشوف الجدول
//   • ولا بيان اتشال في التحويل
//   • نافذة الطابعة كلها أقسام بتتفتح وتتقفل (١٠ أقسام)، كل واحد لوحده،
//     وخاناته موجودة — والجزء اللي فوق (الجهاز والطابعتين) باين على طول
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

const USERS = [
  { id: 'u1', name: 'AboLilah', role: 'owner', loginName: 'abo@shop', perms: { a: 1, b: 1, c: 1 } },
  { id: 'u2', name: 'محمد الكاشير', role: 'user', loginName: 'm@shop', warehouseAccess: 'branch' },
  { id: 'u3', name: 'اسم طويل جدا جدا جدا للتجربة', role: 'user' },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 840 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof usersScreenHTML === 'function' && typeof activityLogHTML === 'function');

  const r = await p.evaluate((users) => {
    state.user = { uid: 'u1' };
    state.profile = { name: 'AboLilah', role: 'owner' };
    state.users = users;
    state.activityLog = [
      { action: 'edit', categoryName: 'كريب سادة لوكس', gradeNumber: '56', field: 'branchQty', oldValue: 3, newValue: 0, userName: 'AboLilah', timestamp: { toDate: () => new Date() } },
      { action: 'fulfill_shortage', categoryName: 'طباقيه كويتى', gradeNumber: '12', transferredQty: 5, userName: 'محمد الكاشير', timestamp: { toDate: () => new Date() } },
      { action: 'add_grade', categoryName: 'شيفون', gradeNumber: '3', userName: 'AboLilah', timestamp: { toDate: () => new Date() } },
    ];

    const out = {};
    state.isNarrow = true;
    const uNarrow = usersScreenHTML();
    const aNarrow = activityLogHTML();
    state.isNarrow = false;
    const uWide = usersScreenHTML();
    const aWide = activityLogHTML();

    out.usersCards = (uNarrow.match(/grade-card(?![s-])/g) || []).length;
    out.usersNoTable = !uNarrow.includes('<table');
    out.usersWideTable = uWide.includes('<table');
    out.actCards = (aNarrow.match(/grade-card(?![s-])/g) || []).length;
    out.actNoTable = !aNarrow.includes('<table');
    out.actWideTable = aWide.includes('<table');

    // ولا بيان اتشال: كل اسم وكل اسم دخول وكل زرار تعديل موجودين
    out.everyName = users.every((u) => uNarrow.includes(u.name));
    out.everyLogin = users.filter((u) => u.loginName).every((u) => uNarrow.includes(u.loginName));
    out.everyEditBtn = users.every((u) => uNarrow.includes(`data-edit-user="${u.id}"`));
    // وعدّاد المفاتيح
    out.permCount = uNarrow.includes('3 مُعدّل') && uNarrow.includes('القالب');

    // سجل العمليات: نفس الوصف في الشكلين
    const parts = activityEntryParts(state.activityLog[0]);
    out.sameDetail = aNarrow.includes(parts.detailLabel) && aWide.includes(parts.detailLabel);
    out.sameItem = aNarrow.includes(parts.itemLabel) && aWide.includes(parts.itemLabel);
    out.everyUser = state.activityLog.every((e) => aNarrow.includes(e.userName));

    return out;
  }, USERS);

  check('الحسابات: ٣ كارتس على الموبايل', r.usersCards === 3, r.usersCards);
  check('الحسابات: مفيش جدول على الموبايل', r.usersNoTable);
  check('الحسابات: الجدول لسه موجود على الكمبيوتر', r.usersWideTable);
  check('الحسابات: كل الأسامي موجودة', r.everyName);
  check('الحسابات: كل أسماء الدخول موجودة', r.everyLogin);
  check('الحسابات: زرار تعديل لكل حساب', r.everyEditBtn);
  check('الحسابات: عدّاد المفاتيح زي ما هو', r.permCount);
  check('السجل: ٣ كارتس على الموبايل', r.actCards === 3, r.actCards);
  check('السجل: مفيش جدول على الموبايل', r.actNoTable);
  check('السجل: الجدول لسه موجود على الكمبيوتر', r.actWideTable);
  check('السجل: نفس وصف العملية في الشكلين', r.sameDetail);
  check('السجل: نفس اسم الصنف في الشكلين', r.sameItem);
  check('السجل: كل الأشخاص موجودين', r.everyUser);

  // ---- نافذة الطابعة ----
  await p.evaluate(() => { state.isNarrow = true; try { openPrinterSettings(); } catch (e) {} });
  await p.waitForTimeout(600);
  const ps = await p.evaluate(() => {
    // ⚠️ الأقسام اللي **كلها** المفروض تبقى مطوية. زمان كانت خمسة بس
    // والباقي كتل مفتوحة ورا بعض — والملاحظة وصلت بالنص: "في اقسام مش
    // بتتقفل". دلوقتي كل النافذة أقسام غير الجزء اللي فوق (اسم الجهاز
    // والطابعتين) اللي لازم يفضل باين من أول نظرة.
    //
    // ⚠️⚠️ بنقارن **الأسامي** مش العدد: الرقم المحفور في الفحص خدعنا
    // كذا مرة قبل كده (آخرها في raster-label). قسم جديد يتضاف = يتكتب
    // هنا، وقسم يختفي = الفحص يقول **أنهي واحد**.
    const keys = ['cal', 'quality', 'pace', 'batch', 'fonts',
      'copy', 'align', 'lastdate', 'tweaks', 'details'];
    const before = keys.every((k) => document.getElementById('pset-body-' + k).hidden);
    document.querySelector('.pset-toggle[data-pset="quality"]').click();
    const opened = !document.getElementById('pset-body-quality').hidden;
    const restShut = keys.filter((k) => k !== 'quality').every((k) => document.getElementById('pset-body-' + k).hidden);
    const ids = ['cal-w', 'cal-h', 'cal-gap', 'cal-run', 'cal-status', 'pq-speed', 'pq-density', 'pq-apply',
      'pq-status', 'pq-pace', 'pq-pace-save', 'pq-pace-status', 'pq-batch', 'pq-batch-save',
      'pq-batch-status', 'tspl-sample', 'tspl-status'];
    return {
      found: [...document.querySelectorAll('.pset-toggle[data-pset]')].map((b) => b.getAttribute('data-pset')),
      // الجزء اللي فوق **مش** مطوي — لو اتلف في قسم، 99% من فتح النافذة
      // بقى محتاج دوسة زيادة.
      topOpen: ['qz-device-name', 'qz-label-printer-select', 'qz-restock-printer-select']
        .every((id) => document.getElementById(id) && !document.getElementById(id).closest('.pset-body')),
      before, opened, restShut,
      missing: ids.filter((i) => !document.getElementById(i)),
    };
  });
  const WANT = ['cal', 'quality', 'pace', 'batch', 'fonts', 'copy', 'align', 'lastdate', 'tweaks', 'details'];
  check('الطابعة: كل النافذة أقسام بتتقفل',
    WANT.every((k) => ps.found.includes(k)) && ps.found.length === WANT.length,
    { ناقص: WANT.filter((k) => !ps.found.includes(k)), زيادة: ps.found.filter((k) => !WANT.includes(k)) });
  check('الطابعة: اسم الجهاز والطابعتين مش مطويين', ps.topOpen);
  check('الطابعة: كلهم مقفولين في الأول', ps.before);
  check('الطابعة: القسم بيتفتح', ps.opened);
  check('الطابعة: الباقي بيفضل مقفول', ps.restShut);
  check('الطابعة: ولا خانة اتشالت (١٧ خانة)', ps.missing.length === 0, ps.missing);

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
