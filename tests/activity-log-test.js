// سجل العمليات — الأقسام والمدة والحفظ، وحالة الاتصال
// ============================================================
// ⭐ أهم نقطتين هنا:
//   1) العملية اللي اتعملت والنت مقفول لازم **تفضل ظاهرة** مهما كانت
//      المدة المختارة — دي أكتر حاجة المستخدم محتاج يتطمّن عليها.
//   2) "متصل" لازم تعتمد على وصول Firestore للسيرفر، مش على
//      navigator.onLine لوحدها (دي بتقول "الجهاز على شبكة" مش "النت شغال").
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof activityLogHTML === 'function' && typeof connectionDotHTML === 'function');

  const r = await p.evaluate(() => {
    const out = {};
    state.isNarrow = true;
    state.profile = { name: 'A', role: 'owner' };
    const now = Date.now(), d = 86400000;
    const ts = (ms) => ({ toDate: () => new Date(ms) });
    state.activityLog = [
      { action: 'edit', pending: true, categoryName: 'كريب', gradeNumber: '56', field: 'branchQty', oldValue: 5, newValue: 3, userName: 'A', timestamp: ts(now) },
      { action: 'fulfill_shortage', categoryName: 'طباقيه', gradeNumber: '12', transferredQty: 5, userName: 'م', timestamp: ts(now - 3600000) },
      { action: 'add_grade', categoryName: 'شيفون', gradeNumber: '3', userName: 'A', timestamp: ts(now - 2 * d) },
      { action: 'delete_grade', categoryName: 'كريب', gradeNumber: '9', userName: 'م', timestamp: ts(now - 2.5 * d) },
      { action: 'set_critical_qty', categoryName: 'بونيه', newValue: 12, userName: 'A', timestamp: ts(now - 4 * d) },
      // ⭐ ده بره الشهر عن قصد — عشان فحص "شهر" يبقى ليه معنى
      { action: 'bulk_branch_qty', categoryName: 'الكل', newValue: 300, userName: 'A', timestamp: ts(now - 40 * d) },
    ];
    localStorage.removeItem('tazweed_log_kinds');
    localStorage.removeItem('tazweed_log_days');
    window.renderFromData = () => {
      document.body.innerHTML = '<div id=root>' + activityLogHTML() + '</div>';
      attachActivityLogEvents();
    };
    renderFromData();
    const cards = () => document.querySelectorAll('.grade-card').length;

    out.defaultDays = getLogDays();
    out.threeDays = cards();                     // 4 سطور جوه 3 أيام
    out.hasAllKinds = document.querySelectorAll('[data-log-kind]').length === LOG_KINDS.length;
    out.pendingShown = document.body.textContent.includes('لسه مترفعش');

    // شيل قسم "حذف"
    document.querySelector('[data-log-kind="del"]').click();
    out.afterUncheck = cards();
    out.savedKinds = JSON.parse(localStorage.getItem('tazweed_log_kinds') || '[]');
    out.delGone = out.savedKinds.indexOf('del') === -1;
    // ورجّعه
    document.querySelector('[data-log-kind="del"]').click();
    out.afterRecheck = cards();

    // المدة
    document.querySelector('[data-log-days="0"]').click();
    out.allDays = cards();
    out.savedDays = localStorage.getItem('tazweed_log_days');
    document.querySelector('[data-log-days="30"]').click();
    out.monthDays = cards();
    document.querySelector('[data-log-days="3"]').click();

    // ⭐ العملية المفصولة بتفضل ظاهرة حتى لو المدة قصيرة والسطر قديم
    state.activityLog = [
      { action: 'edit', pending: true, categoryName: 'ك', gradeNumber: '1', field: 'branchQty', oldValue: 2, newValue: 1, userName: 'A', timestamp: ts(now - 90 * d) },
    ];
    renderFromData();
    out.pendingSurvives = cards() === 1;

    // شيل كل الأقسام → المفروض يرجّع الكل بدل شاشة فاضية
    setLogKinds([]);
    out.emptyFallsBack = getLogKinds().length === LOG_KINDS.length;

    // ---- حالة الاتصال ----
    state.isOnline = true; state.fromCache = false; state.hasPendingWrites = false;
    out.connOnline = connectionDotHTML().includes('متصل') && !connectionDotHTML().includes('غير متصل');
    state.fromCache = true;
    out.connCacheIsOffline = connectionDotHTML().includes('غير متصل');
    out.reachableFalse = isServerReachable() === false;
    state.isOnline = false; state.fromCache = false;
    out.connNoDevice = connectionDotHTML().includes('غير متصل');
    state.isOnline = true; state.fromCache = false; state.hasPendingWrites = true;
    out.connUploading = connectionDotHTML().includes('رفع');
    state.hasPendingWrites = false;
    out.reachableTrue = isServerReachable() === true;

    localStorage.removeItem('tazweed_log_kinds');
    localStorage.removeItem('tazweed_log_days');
    return out;
  });

  check('الافتراضي ٣ أيام', r.defaultDays === 3, r);
  check('بيعرض عمليات آخر ٣ أيام بس', r.threeDays === 4, r);
  check('كل الأقسام ظاهرة كمربعات اختيار', r.hasAllKinds, r);
  check('⭐ العملية اللي لسه مترفعتش متعلّم عليها', r.pendingShown, r);
  check('شيل قسم بيقلّل القايمة', r.afterUncheck === 3, r);
  check('والاختيار بيتحفظ', r.delGone, r);
  check('ورجوعه بيرجّع السطور', r.afterRecheck === 4, r);
  check('"الكل" بيعرض كل المدة', r.allDays === 6, r);
  check('والمدة بتتحفظ', r.savedDays === '0', r);
  check('"شهر" بيعرض اللي جوه ٣٠ يوم', r.monthDays === 5, r);
  check('⭐⭐ العملية المفصولة بتفضل ظاهرة مهما كانت المدة', r.pendingSurvives, r);
  check('شيل كل الأقسام بيرجّع الكل مش شاشة فاضية', r.emptyFallsBack, r);

  check('متصل: أخضر', r.connOnline, r);
  check('⭐⭐ الشبكة موجودة بس السيرفر مش واصل = غير متصل', r.connCacheIsOffline, r);
  check('وisServerReachable بترجع false', r.reachableFalse, r);
  check('الجهاز مفصول = غير متصل', r.connNoDevice, r);
  check('فيه كتابة لسه بترفع = بيرفع', r.connUploading, r);
  check('وisServerReachable بترجع true لما يبقى واصل', r.reachableTrue, r);
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
