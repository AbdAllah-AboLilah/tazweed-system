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
  // ============================================================
  // 🔎 البحث في السجل — ن٨
  // ============================================================
  // ⚠️⚠️ أهم فحصين هنا مش "البحث بيلاقي": هما إن البحث **بيقول** إنه
  // بيدوّر في المحمّل بس، وإن الرسالة الفاضية بتفرّق بين "مفيش
  // نتيجة للبحث" و"مفيش عمليات في المدة دي". من غيرهم، اللي يدوّر
  // على عملية قديمة ومايلاقيهاش هيفتكر إنها ماحصلتش.
  const srch = await p.evaluate(async () => {
    const out = {};
    state.logSearch = '';
    setLogTab('all');
    setLogDays(0);
    renderFromData();
    const cards = () => document.querySelectorAll('.grade-card').length;
    out.before = cards();
    out.clearHiddenWhenEmpty = !document.getElementById('log-search-clear');

    const type = async (v) => {
      const el = document.getElementById('log-search');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 320));
    };

    await type('طباقيه');
    out.byCategory = cards();
    out.byCategoryText = document.body.textContent.indexOf('طباقيه') !== -1;
    out.focusKept = document.activeElement && document.activeElement.id === 'log-search';
    out.clearShown = !!document.getElementById('log-search-clear');

    // ⭐ بالاسم كمان
    await type('محمود');
    out.byPerson = cards();

    // ⭐⭐ من غير همزة — نفس تطبيع باقي البحث في النظام
    state.activityLog.push({ action: 'add_category', categoryName: 'أورجانزا', userName: 'A',
      timestamp: { toDate: () => new Date() } });
    await type('اورجانزا');
    out.normalized = cards();

    // ============================================================
    // ⭐⭐⭐ الاسم اللي فيه رموز HTML
    // ============================================================
    // ⚠️⚠️ ده الفخ الحقيقي: السطر بيتعرض **مهرّب** (escapeHTML)، يعني
    // "نصار & كيوي" بتبقى في الـHTML "نصار &amp; كيوي". لو البحث
    // دوّر في النص المهرّب، اللي يكتب اسم الفئة زي ما هو **مش
    // هيلاقيها** — وهو شايفها قدامه على الشاشة.
    state.activityLog.push({ action: 'add_category', categoryName: 'نصار & كيوي', userName: 'A',
      timestamp: { toDate: () => new Date() } });
    state.activityLog.push({ action: 'add_category', categoryName: 'مقاس <40>', userName: 'A',
      timestamp: { toDate: () => new Date() } });
    await type('نصار & كيوي');
    out.ampersand = cards();
    await type('<40>');
    out.angle = cards();

    // ⭐⭐⭐ مفيش نتيجة = الرسالة بتقول السبب الصح
    await type('حاجة_مش_موجودة_خالص');
    out.noneCards = cards();
    out.noneSaysSearch = document.body.textContent.indexOf('مفيش نتيجة لـ') !== -1;

    // ⭐⭐⭐ وبيقول إنه بيدوّر في المحمّل بس
    out.saysLoadedOnly = document.body.textContent.indexOf('البحث بيدوّر في') !== -1;
    state.logHasMore = true;
    renderFromData();
    out.warnsWhenMore = document.body.textContent.indexOf('مش في السجل كله') !== -1;
    state.logHasMore = false;

    // ⚠️ بنقارن بعدد السطور **دلوقتي** مش باللي كان في الأول:
    // الفحص نفسه ضاف سطر "أورجانزا" في النص.
    out.expectAfterClear = state.activityLog.length;
    document.getElementById('log-search-clear').click();
    await new Promise((r) => setTimeout(r, 60));
    out.afterClear = cards();
    out.valueCleared = document.getElementById('log-search').value;
    return out;
  });
  check('⭐⭐ البحث بيفلتر بالفئة', srch.byCategory === 1 && srch.byCategoryText, srch);
  check('⭐ وبيفلتر باسم الشخص كمان', srch.byPerson === 1, srch);
  check('⭐⭐ و"اورجانزا" من غير همزة بتلاقي "أورجانزا"', srch.normalized === 1, srch);
  check('⭐⭐⭐ واسم فيه & بيتلاقى بالاسم زي ما هو (مش &amp;)', srch.ampersand === 1, srch);
  check('⭐⭐⭐ واسم فيه <> كمان', srch.angle === 1, srch);
  check('⭐ المؤشر بيفضل في الخانة', srch.focusKept, srch);
  check('⭐ زرار ✕ بيبان بالكلام ومابيبانش من غيره',
    srch.clearShown && srch.clearHiddenWhenEmpty, srch);
  check('⭐⭐ ودوسة واحدة بترجّع كله',
    srch.afterClear === srch.expectAfterClear && srch.valueCleared === '', srch);
  check('⭐⭐⭐ مفيش نتيجة = الرسالة بتقول إنها نتيجة بحث مش مدة',
    srch.noneCards === 0 && srch.noneSaysSearch, srch);
  check('⭐⭐⭐ وبيقول صراحةً إنه بيدوّر في المحمّل بس', srch.saysLoadedOnly, srch);
  check('⭐⭐⭐ وبيحذّر لما يكون فيه سجل أقدم مش محمّل', srch.warnsWhenMore, srch);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
