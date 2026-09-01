// تابات سجل العمليات + نصوص العمليات الناقصة
// ============================================================
// ⭐ أهم النقط:
//   1) تاب واحد = قسم واحد بضغطة واحدة (كان محتاج 5 ضغطات على الشيك بوكس)
//   2) الشيك بوكس فاضلة **في تاب "الكل" بس** — هي أداة تجميعة
//   3) الاختيار بيتحفظ
//   4) ⭐⭐ مفيش كارت فاضي: أي عملية مالهاش نص بتطلع باسمها الخام
//   5) `edit_user` و`import_products` بقى ليهم قسم ونص
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof activityLogHTML === 'function' && typeof getLogTab === 'function');

  const r = await p.evaluate(() => {
    const out = {};
    state.isNarrow = true;
    state.profile = { name: 'A', role: 'owner' };
    const now = Date.now();
    const ts = (ms) => ({ toDate: () => new Date(ms) });
    state.activityLog = [
      { action: 'edit', categoryName: 'كريب', gradeNumber: '56', field: 'branchQty', oldValue: 5, newValue: 3, userName: 'A', timestamp: ts(now) },
      { action: 'edit', categoryName: 'كريب', gradeNumber: '57', field: 'mainQty', oldValue: 1, newValue: 9, userName: 'A', timestamp: ts(now) },
      { action: 'fulfill_shortage', categoryName: 'طباقيه', gradeNumber: '12', transferredQty: 5, userName: 'م', timestamp: ts(now) },
      { action: 'print', printLabel: 'سلة طباعة', itemName: 'كريب سادة، شيفون و٤ غيرهم', newValue: 12, userName: 'حساب الطباعة', operatorName: 'محمود', timestamp: ts(now) },
      { action: 'import_products', newValue: 46052, userName: 'A', timestamp: ts(now) },
      { action: 'edit_user', categoryName: 'حساب الطباعة', newValue: 'print_operator', userName: 'A', timestamp: ts(now) },
      // ⚠️ عملية **مش معروفة** عن قصد — دي اللي كانت بتطلع كارت فاضي
      { action: 'حاجة_جديدة_منساها', userName: 'A', timestamp: ts(now) },
    ];
    localStorage.removeItem('tazweed_log_kinds');
    localStorage.removeItem('tazweed_log_days');
    localStorage.removeItem('tazweed_log_tab');
    window.renderFromData = () => {
      document.body.innerHTML = '<div id=root>' + activityLogHTML() + '</div>';
      attachActivityLogEvents();
    };
    renderFromData();
    const cards = () => document.querySelectorAll('.grade-card').length;
    const txt = () => document.body.textContent;

    // (1) الافتراضي = الكل
    out.defaultTab = getLogTab();
    out.allCount = cards();
    out.tabsRendered = document.querySelectorAll('[data-log-tab]').length;
    out.expectTabs = LOG_KINDS.length + 1;
    // (2) الشيك بوكس بتبان في "الكل"
    out.boxesInAll = document.querySelectorAll('[data-log-kind]').length === LOG_KINDS.length;

    // ⭐⭐ (3) مفيش كارت فاضي
    out.emptyCards = [...document.querySelectorAll('.grade-card')]
      .filter((c) => !(c.querySelector('.act-what') || {}).textContent.trim()).length;
    out.unknownShown = txt().indexOf('حاجة_جديدة_منساها') !== -1;

    // (4) نصوص العمليتين الجداد
    out.importText = txt().indexOf('تحديث ملف الأصناف') !== -1;
    out.importCount = txt().indexOf('46052') !== -1;
    out.userText = txt().indexOf('تعديل حساب') !== -1;
    out.printItems = txt().indexOf('كريب سادة، شيفون و٤ غيرهم') !== -1;
    out.printCount = txt().indexOf('١٢ ملصق') !== -1 || txt().indexOf('12 ملصق') !== -1;

    // ⭐ (5) تاب واحد = ضغطة واحدة
    document.querySelector('[data-log-tab="print"]').click();
    out.printTab = getLogTab();
    out.printOnly = cards();
    out.printOnlyRight = txt().indexOf('سلة طباعة') !== -1 && txt().indexOf('كريب — درجة 56') === -1;
    // (6) الشيك بوكس **بتختفي** جوه تاب
    out.boxesHiddenInTab = document.querySelectorAll('[data-log-kind]').length === 0;

    // (7) تاب الإدارة فيه العمليتين
    document.querySelector('[data-log-tab="admin"]').click();
    out.adminCount = cards();

    // (8) الرجوع للكل
    document.querySelector('[data-log-tab="all"]').click();
    out.backToAll = cards();
    out.boxesBack = document.querySelectorAll('[data-log-kind]').length === LOG_KINDS.length;

    // ⭐ (9) الشيك بوكس لسه بتشتغل جوه "الكل" (تجميعة)
    document.querySelector('[data-log-kind="qty"]').click();
    out.afterUncheckQty = cards();
    out.savedKinds = JSON.parse(localStorage.getItem('tazweed_log_kinds') || '[]');
    document.querySelector('[data-log-kind="qty"]').click();

    // (10) التاب بيتحفظ
    document.querySelector('[data-log-tab="restock"]').click();
    out.savedTab = localStorage.getItem('tazweed_log_tab');
    renderFromData();
    out.stillRestock = getLogTab() === 'restock' && cards() === 1;

    // (11) العملية اللي مالهاش قسم بتظهر في "الكل" بس
    document.querySelector('[data-log-tab="all"]').click();
    out.unknownInAll = txt().indexOf('حاجة_جديدة_منساها') !== -1;
    document.querySelector('[data-log-tab="qty"]').click();
    out.unknownNotInTab = txt().indexOf('حاجة_جديدة_منساها') === -1;

    // (12) شريط التابات مابيزحلقش الصفحة
    document.querySelector('[data-log-tab="all"]').click();
    out.bodyOverflow = document.documentElement.scrollWidth <= window.innerWidth + 1;
    const bar = document.querySelector('.log-tabs');
    out.barScrolls = !!bar && getComputedStyle(bar).overflowX === 'auto';
    return out;
  });

  check('الافتراضي = الكل', r.defaultTab === 'all', r.defaultTab);
  check('عدد التابات = الأقسام + الكل', r.tabsRendered === r.expectTabs, [r.tabsRendered, r.expectTabs]);
  check('كل السطور ظاهرة في الكل', r.allCount === 7, r.allCount);
  check('الشيك بوكس موجودة في الكل', r.boxesInAll);
  check('⭐⭐ مفيش أي كارت فاضي', r.emptyCards === 0, r.emptyCards);
  check('⭐ العملية المنساها بتطلع باسمها مش فاضية', r.unknownShown);
  check('"تحديث ملف الأصناف" مكتوبة', r.importText);
  check('وعدد الأصناف معاها', r.importCount);
  check('"تعديل حساب" مكتوبة', r.userText);
  check('السلة بتقول الأصناف بأسمائها', r.printItems);
  check('وعدد الملصقات', r.printCount);
  check('⭐ ضغطة واحدة = قسم الطباعة لوحده', r.printTab === 'print' && r.printOnly === 1, [r.printTab, r.printOnly]);
  check('واللي بان هو الصح', r.printOnlyRight);
  check('⭐ الشيك بوكس بتختفي جوه التاب', r.boxesHiddenInTab);
  check('تاب الإدارة فيه العمليتين', r.adminCount === 2, r.adminCount);
  check('الرجوع للكل بيرجّع كله', r.backToAll === 7, r.backToAll);
  check('والشيك بوكس بترجع', r.boxesBack);
  check('⭐ الشيك بوكس لسه بتشتغل في الكل', r.afterUncheckQty === 5, r.afterUncheckQty);
  check('واختيارها بيتحفظ', r.savedKinds.indexOf('qty') === -1, r.savedKinds);
  check('التاب بيتحفظ', r.savedTab === 'restock', r.savedTab);
  check('وبيفضل بعد إعادة الرسم', r.stillRestock);
  check('⭐ العملية بلا قسم بتبان في الكل', r.unknownInAll);
  check('ومابتبانش جوه تاب تاني', r.unknownNotInTab);
  check('⭐ شريط التابات مابيزحلقش الصفحة', r.bodyOverflow);
  check('وبيتزحلق هو جوه نفسه', r.barScrolls);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
