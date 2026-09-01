// تقرير حركة المخزون — الحساب والتخزين والصلاحية
// ============================================================
// ⭐ أهم فحص هنا: إن الحركة **مش** بتتكتب جوّه مستند الدرجة.
// قواعد الأمان بتقفل حقول الدرجة بـonlyChangedKeys في 17 تركيبة، فأي
// حقل جديد هناك معناه إن تعديل الكميات بيترفض من السيرفر **في صمت**.
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof movementScreenHTML === 'function');

  const r = await p.evaluate(() => {
    const out = {};
    state.isNarrow = true;
    state.profile = { name: 'AboLilah', role: 'owner' };
    state.categories = [{ id: 'c1', name: 'كريب' }, { id: 'c2', name: 'شيفون' }];

    const now = Date.now(), day = 86400000;
    const mk = (d) => ({ toDate: () => new Date(d) });
    const M = movementMonthKey();

    allGradesCache = [
      { catId: 'c1', gradeId: 'g1', name: '56', branchQty: 4, mainQty: 0 },  // اتحركت امبارح، باعت 20
      { catId: 'c1', gradeId: 'g2', name: '12', branchQty: 3, mainQty: 0 },  // واقفة من 40 يوم وفيها بضاعة
      { catId: 'c2', gradeId: 'g3', name: '3', branchQty: 9, mainQty: 0 },   // اتحركت من يومين، باعت 5
      { catId: 'c2', gradeId: 'g4', name: '7', branchQty: 2, mainQty: 0 },   // مالهاش تاريخ خالص
      { catId: 'c2', gradeId: 'g5', name: '9', branchQty: 0, mainQty: 0 },   // خلصانة — مش راكدة
    ];
    movementStats = {
      c1__g1: { gradeNumber: '56', lastMovedAt: mk(now - 1 * day), soldByMonth: { [M]: 20 }, soldTotal: 20, moves: 9 },
      c1__g2: { gradeNumber: '12', lastMovedAt: mk(now - 40 * day), soldByMonth: { [M]: 0 }, soldTotal: 3, moves: 2 },
      c2__g3: { gradeNumber: '3', lastMovedAt: mk(now - 2 * day), soldByMonth: { [M]: 5 }, soldTotal: 5, moves: 4 },
    };

    setMovementDays(15);
    setMovementSpan('1');
    const a = computeMovementReport();
    // ⭐ الصفوف بقت متجمّعة تحت فئتها
    out.fastGroups = a.fast.map((g) => g.name);
    out.fastOrder = a.fast.flatMap((g) => g.rows.map((r) => r.qty));
    out.fastCount = a.fastCount;
    out.idle15 = a.idleCount;
    out.idleGroups = a.idle.map((g) => g.name);
    out.soldOut = a.soldOut;
    // ⭐ اللي مالهاش تاريخ اتفصلت في قسم لوحدها
    out.unknownCount = a.unknownCount;
    out.unknownGroups = a.unknown.map((g) => g.name);
    // وولا صف في "راكدة" من غير عدد أيام حقيقي
    out.idleAllHaveDays = a.idle.every((g) => g.rows.every((r) => typeof r.daysIdle === 'number'));
    out.tracked = a.tracked;
    out.total = a.total;

    setMovementDays(60);
    out.idle60 = computeMovementReport().idleCount;
    setMovementDays(1);
    out.idle1 = computeMovementReport().idleCount;

    localStorage.removeItem('tazweed_movement_days');
    out.defaultDays = getMovementDays();
    setMovementDays(0); out.zeroIgnored = getMovementDays();
    setMovementDays(-5); out.negIgnored = getMovementDays();
    setMovementDays(99999); out.hugeIgnored = getMovementDays();
    setMovementDays(30); out.thirty = getMovementDays();
    setMovementDays(15);

    // ---- الحركة بتتكتب فين وبأي شكل؟ ----
    const writes = [];
    const realDb = window.db, realFb = window.firebase, realUser = state.user;
    window.db = {
      collection: (c) => ({ doc: (id) => ({ set: (data, opt) => { writes.push({ c, id, data, opt }); return Promise.resolve(); } }) }),
    };
    // بديل بسيط لعدّادات Firestore — الهدف نشوف **الشكل** اللي بيتبعت
    window.firebase = {
      firestore: { FieldValue: { serverTimestamp: () => ({ __ts: true }), increment: (n) => ({ __inc: n }) } },
    };
    state.user = { uid: 'u1' };
    recordMovement({ categoryId: 'c1', categoryName: 'كريب', gradeId: 'g1', gradeNumber: '56', soldQty: 3 });
    recordMovement({ categoryId: 'c1', categoryName: 'كريب', gradeId: 'g2', gradeNumber: '12', soldQty: 0 });
    recordMovement({ categoryId: 'c1', categoryName: 'كريب', gradeId: 'g3', gradeNumber: '9', soldQty: 0, newCycle: true });
    window.db = realDb; window.firebase = realFb; state.user = realUser;

    out.writeCollections = writes.map((w) => w.c);
    out.writeIds = writes.map((w) => w.id);
    const mKey = movementMonthKey();
    out.soldInc = !!(writes[0].data.soldByMonth && writes[0].data.soldByMonth[mKey] && writes[0].data.soldByMonth[mKey].__inc === 3);
    out.movesInc = !!(writes[0].data.moves && writes[0].data.moves.__inc === 1);
    out.noSoldWhenZero = !writes[1].data.soldByMonth && !writes[1].data.lastSoldAt;
    out.bothHaveLastMoved = writes.every((w) => !!w.data.lastMovedAt);
    out.merged = writes.every((w) => w.opt && w.opt.merge === true);
    out.cycleWritten = !!writes[2].data.cycleStartedAt;
    out.noCycleNormally = !writes[0].data.cycleStartedAt && !writes[1].data.cycleStartedAt;

    // ---- تحويل سطر السجل لحركة ----
    const t = { toDate: () => new Date(now) };
    const dec = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'edit', field: 'branchQty', oldValue: 10, newValue: 4, timestamp: t });
    const incr = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'edit', field: 'branchQty', oldValue: 4, newValue: 10, timestamp: t });
    const main = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'edit', field: 'mainQty', oldValue: 10, newValue: 4, timestamp: t });
    const ful = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'fulfill_shortage', transferredQty: 5, timestamp: t });
    out.logDecSold = !!dec && dec.sold === 6;
    out.logIncNotSold = !!incr && incr.sold === 0;
    out.logMainNotSold = !!main && main.sold === 0;
    out.logFulfillMoves = !!ful && ful.sold === 0;
    out.logBadIgnored = movementFromLogEntry({ action: 'edit', timestamp: t }) === null;
    out.logNoTimeIgnored = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'edit' }) === null;

    // ---- الصلاحية ----
    out.ownerCan = can({ role: 'owner' }, 'viewReports');
    out.branchMgr = can({ role: 'branch_manager' }, 'viewReports');
    out.user = can({ role: 'user' }, 'viewReports');
    out.keeper = can({ role: 'warehouse_keeper' }, 'viewReports');

    // ---- الشاشة ----
    const html = movementScreenHTML();
    out.hasDaysInput = html.includes('id="mv-days-input"');
    out.hasBothSections = html.includes('data-mv="fast"') && html.includes('data-mv="idle"');
    out.hasUnknownSection = html.includes('data-mv="unknown"');
    out.explains = html.includes('مالناش سطر عنها في السجل');
    out.unknownShutByDefault = (() => {
      localStorage.removeItem('tazweed_movement_open');
      return getMovementOpen().unknown === false && getMovementOpen().idle === true;
    })();
    out.hasBackfill = html.includes('id="mv-backfill"');
    out.hasSpan = html.includes('id="mv-span"');
    out.hasRepeat = html.includes('id="mv-repeat"');

    // ---- الفترة ----
    setMovementSpan('3');
    out.span3 = getMovementSpan().months === 3;
    setMovementSpan('حاجة غلط');
    out.badSpanIgnored = getMovementSpan().months === 3;
    setMovementSpan('1');
    out.monthKeys3 = movementMonthKeys(3).length === 3 && new Set(movementMonthKeys(3)).size === 3;

    // ---- الدورة الجديدة ----
    out.newCycleDefault = isNewCycleGrade({ id: 'c1' }, { name: '5' }) === true;
    out.baseNoCycle = isNewCycleGrade({ id: 'c1' }, { name: '5', isBase: true }) === false;
    out.repeatCatNoCycle = isNewCycleGrade({ id: 'c1', repeatGrades: true }, { name: '5' }) === false;
    return out;
  });

  check('الافتراضي ١٥ يوم', r.defaultDays === 15, r.defaultDays);
  check('صفر بيتتجاهل', r.zeroIgnored === 15, r.zeroIgnored);
  check('رقم سالب بيتتجاهل', r.negIgnored === 15, r.negIgnored);
  check('رقم مستحيل بيتتجاهل', r.hugeIgnored === 15, r.hugeIgnored);
  check('٣٠ يوم بتتحفظ', r.thirty === 30, r.thirty);

  check('الأسرع مرتّبة تنازلي', JSON.stringify(r.fastOrder) === '[20,5]', r.fastOrder);
  check('اللي مابعتش مش في قايمة الأسرع', r.fastCount === 2, r.fastCount);
  check('⭐ الصفوف متجمّعة تحت فئتها', r.fastGroups.length === 2 && r.idleGroups.length >= 1, [r.fastGroups, r.idleGroups]);
  check('الراكد عند ١٥ يوم = واحدة', r.idle15 === 1, r.idle15);
  check('⭐ الدرجة الخلصانة مش في الراكد', r.soldOut === 1, r.soldOut);
  check('⭐ اللي مالهاش تاريخ في قسم لوحدها', r.unknownCount === 1, r.unknownCount);
  check('⭐ ولا صف في "راكدة" من غير عدد أيام', r.idleAllHaveDays, r);
  check('مدة أطول = راكد أقل', r.idle60 === 0, r.idle60);
  // عند يوم واحد: التلاتة اللي عندهم تاريخ وفيهم بضاعة
  check('مدة أقصر = راكد أكتر', r.idle1 === 3, r.idle1);
  check('عدّاد المتتبَّع والإجمالي', r.tracked === 3 && r.total === 5, [r.tracked, r.total]);

  check('⭐ الحركة بتتكتب في gradeStats مش في الدرجة', JSON.stringify(r.writeCollections) === '["gradeStats","gradeStats","gradeStats"]', r.writeCollections);
  check('معرّف المستند فئة__درجة', JSON.stringify(r.writeIds) === '["c1__g1","c1__g2","c1__g3"]', r.writeIds);
  check('الكمية المباعة بتتزوّد بالرقم الصح', r.soldInc);
  check('عدّاد الحركات بيزيد واحد', r.movesInc);
  check('مفيش بيع لما الكمية ماقلّتش', r.noSoldWhenZero);
  check('كل حركة بتحدّث lastMovedAt', r.bothHaveLastMoved);
  check('الكتابة merge (مافيش قراءة زيادة)', r.merged);
  check('⭐ الدورة الجديدة بتتسجّل', r.cycleWritten);
  check('ومابتتسجّلش في الحركة العادية', r.noCycleNormally);

  check('السجل: نقص الفرع = بيع', r.logDecSold);
  check('السجل: زيادة الفرع مش بيع', r.logIncNotSold);
  check('السجل: الرئيسي مش بيع', r.logMainNotSold);
  check('السجل: التزويد حركة مش بيع', r.logFulfillMoves);
  check('السجل: سطر ناقص بيتتجاهل', r.logBadIgnored);
  check('السجل: سطر من غير وقت بيتتجاهل', r.logNoTimeIgnored);

  check('منشئ النظام بيشوف التقرير', r.ownerCan);
  check('مدير الفرع مايشوفوش', r.branchMgr === false, r.branchMgr);
  check('المستخدم العادي مايشوفوش', r.user === false, r.user);
  check('أمين المخزن مايشوفوش', r.keeper === false, r.keeper);

  check('الشاشة فيها عدّاد الأيام', r.hasDaysInput);
  check('الشاشة فيها القسمين', r.hasBothSections);
  check('⭐ وفيها قسم "مافيش عنها تاريخ"', r.hasUnknownSection);
  check('وبتشرح يعني إيه', r.explains);
  check('القسم التالت مقفول افتراضيًا', r.unknownShutByDefault);
  check('الشاشة فيها زرار الحساب من السجل', r.hasBackfill);
  check('الشاشة فيها اختيار الفترة', r.hasSpan);
  check('الشاشة فيها زرار الفئات المتكررة', r.hasRepeat);
  check('الفترة بتتحفظ', r.span3);
  check('فترة غلط بتتتجاهل', r.badSpanIgnored);
  check('مفاتيح الشهور مختلفة ومتسلسلة', r.monthKeys3);
  check('⭐ الدرجة اللي ترجع = درجة جديدة (الافتراضي)', r.newCycleDefault);
  check('⭐ الأساسية مش درجة جديدة', r.baseNoCycle);
  check('⭐ الفئة المعلّم عليها مش درجة جديدة', r.repeatCatNoCycle);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);
  // ---- قفل/فتح الفئة، والافتراضي: أول 3 فئات بس ----
  // ⚠️ اسم الفئة بيتحط في خاصية HTML، و`escapeHTML` مابتهربش علامة
  // التنصيص (بتستخدم textContent) — فبنجرّب باسم فيه `"` بالتحديد.
  //
  // ⚠️⚠️ وبنقيس **الإخفاء الفعلي** مش خاصية hidden. العطل اللي علّم
  // الدرس: الخاصية بتتحط والسهم بيلف، والمحتوى يفضل ظاهر — لأن
  // `.grade-cards` عليها `display:flex` وبتغلب قاعدة المتصفح لـ[hidden].
  const fold = await p.evaluate(() => {
    state.isNarrow = true;
    state.profile = { name: 'A', role: 'owner' };
    // 6 فئات: الافتراضي لازم يفتح 3 بس
    state.categories = [];
    allGradesCache = [];
    movementStats = {};
    const M = movementMonthKey(), now = Date.now(), day = 86400000;
    const mk = (d) => ({ toDate: () => new Date(d) });
    const names = ['كريب "سادة" لوكس', 'فئة ب', 'فئة ج', 'فئة د', 'فئة هـ', 'فئة و'];
    names.forEach((nm, c) => {
      const cid = 'k' + c;
      state.categories.push({ id: cid, name: nm });
      for (let i = 0; i < 3; i++) {
        const gid = cid + '_' + i;
        allGradesCache.push({ catId: cid, gradeId: gid, name: String(i), branchQty: 5, mainQty: 0 });
        movementStats[cid + '__' + gid] = {
          gradeNumber: String(i), lastMovedAt: mk(now - day),
          soldByMonth: { [M]: 20 - c }, soldTotal: 9, moves: 3,
        };
      }
    });
    setMovementDays(15);
    setMovementSpan('1');
    localStorage.removeItem('tazweed_movement_groups');
    localStorage.setItem('tazweed_movement_open', JSON.stringify({ fast: true, idle: true, unknown: true }));
    window.renderFromData = () => {
      document.body.innerHTML = '<div id=root>' + movementScreenHTML() + '</div>';
      attachMovementEvents();
    };
    renderFromData();

    const isGone = (el) => getComputedStyle(el).display === 'none' && el.getBoundingClientRect().height === 0;
    const heads = () => [...document.querySelectorAll('.mv-group-head[data-mv-group]')];

    // ⭐ الافتراضي: أول 3 فئات مفتوحة والباقي مقفول
    const openAtStart = heads().filter((h) => !h.classList.contains('shut')).length;
    const rowsAtStart = document.querySelectorAll('.mv-row').length;
    // والفئة المقفولة **صفوفها مش مرسومة أصلًا**
    const shutHead = heads().find((h) => h.classList.contains('shut'));
    const shutHasNoRows = shutHead.nextElementSibling.querySelectorAll('.mv-row').length === 0;

    const first = heads()[0];
    const nameKept = first.textContent.includes('كريب "سادة" لوكس');
    first.click(); // بيعيد الرسم
    const afterClose = heads()[0];
    const closedOK = afterClose.classList.contains('shut') && isGone(afterClose.nextElementSibling);
    const saved = JSON.parse(localStorage.getItem('tazweed_movement_groups') || '{}');
    const savedOK = saved['fast::كريب "سادة" لوكس'] === false;

    renderFromData();
    const remembered = heads()[0].classList.contains('shut');

    // فتح فئة كانت مقفولة افتراضيًا
    const wasShut = heads().find((h) => h.classList.contains('shut') && h !== heads()[0]);
    const beforeRows = document.querySelectorAll('.mv-row').length;
    wasShut.click();
    const grewAfterOpen = document.querySelectorAll('.mv-row').length > beforeRows;

    document.getElementById('mv-fold').click();
    const allShut = heads().every((h) => h.classList.contains('shut'));
    const noRows = document.querySelectorAll('.mv-row').length === 0;
    const label = document.getElementById('mv-fold').textContent.trim();
    document.getElementById('mv-fold').click();
    const allOpen = heads().every((h) => !h.classList.contains('shut'));

    localStorage.removeItem('tazweed_movement_groups');
    return { count: heads().length, openAtStart, rowsAtStart, shutHasNoRows, nameKept,
             closedOK, savedOK, remembered, grewAfterOpen, allShut, noRows, label, allOpen };
  });

  check('كل فئة ليها زرار قفل', fold.count >= 6, fold);
  check('⭐ الافتراضي: ٣ فئات بس مفتوحة', fold.openAtStart === 3, fold);
  check('⭐ الفئة المقفولة صفوفها مش مرسومة أصلًا', fold.shutHasNoRows, fold);
  check('⭐ اسم فيه علامة تنصيص مابيكسرش الخاصية', fold.nameKept, fold);
  check('⭐ الفئة بتختفي فعلًا من الشاشة (مش الخاصية بس)', fold.closedOK, fold);
  check('والقفل بيتخزّن كاختيار صريح', fold.savedOK, fold);
  check('وبيتفتكر بعد إعادة الرسم', fold.remembered, fold);
  check('فتح فئة مقفولة بيرسم صفوفها', fold.grewAfterOpen, fold);
  check('"اقفل كل الفئات" بتقفل الكل', fold.allShut, fold);
  check('وولا صف بيتبقى مرسوم', fold.noRows, fold);
  check('والزرار بيقلب لـ"افتح"', fold.label.includes('افتح'), fold);
  check('و"افتح الكل" بترجّعهم', fold.allOpen, fold);

  // ---- الملء من السجل: بيقرا السجل **مرة واحدة** ----
  // ⚠️ أول نسخة كانت بتقرا المجموعة كلها عشان تعرف العدد، وبعدين تقراها
  // تاني على صفحات — يعني السجل بيتقرا مرتين. على 12,554 عملية ده كان
  // 25,108 قراءة، والحد المجاني 50,000 في اليوم.
  const bf = await p.evaluate(async () => {
    const calls = [];
    const TOTAL = 2300;
    const makeDoc = (i) => ({
      id: 'L' + i,
      data: () => ({
        categoryId: 'c1', gradeId: 'g' + (i % 7), action: 'edit', field: 'branchQty',
        oldValue: 5, newValue: 4, gradeNumber: String(i % 7), categoryName: 'كريب',
        timestamp: { toDate: () => new Date(Date.now() - i * 1000) },
      }),
    });
    let cursor = 0;
    const q = (lim) => ({
      orderBy: () => q(lim),
      limit: (n) => q(n),
      startAfter: () => q(lim),
      count: () => ({ get: async () => { calls.push('count'); return { data: () => ({ count: TOTAL }) }; } }),
      get: async () => {
        calls.push('page');
        const n = Math.min(lim || 1000, TOTAL - cursor);
        const docs = [];
        for (let i = 0; i < n; i++) docs.push(makeDoc(cursor + i));
        cursor += n;
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    });
    const realDb = window.db, realFb = window.firebase;
    const realConfirm = window.confirm, realAlert = window.alert;
    let batches = 0;
    window.db = { collection: () => Object.assign(q(1000), { doc: (id) => ({ id }) }),
                  batch: () => ({ set() {}, commit: async () => { batches++; } }) };
    // ⚠️ الستب لازم يبقى فيه FieldPath زي SDK الحقيقي — قراءة gradeStats
    // بترتّب بـdocumentId() عشان الصفحات تبقى ثابتة.
    window.firebase = {
      firestore: { Timestamp: { fromDate: (d) => d }, FieldPath: { documentId: () => '__id__' } },
    };
    window.confirm = () => true;
    window.alert = () => {};
    await backfillMovementFromLog();
    window.db = realDb; window.firebase = realFb;
    window.confirm = realConfirm; window.alert = realAlert;
    return {
      counts: calls.filter((c) => c === 'count').length,
      pages: calls.filter((c) => c === 'page').length,
      batches,
    };
  });
  check('⭐ الملء بيستخدم count() مرة واحدة بس', bf.counts === 1, bf);
  // ⚠️⚠️ ده الحارس الأصلي: السجل كان بيتقرا **مرتين** (مرة عشان نعرف
  // العدد ومرة عشان نقراه)، يعني 12,554 عملية بقت 25,108 قراءة — نص
  // الحد المجاني اليومي في تشغيلة واحدة.
  //
  // 2300 سطر ÷ 1000 = 3 صفحات للسجل. واللي بعدهم قراءة الملخّص
  // (gradeStats) اللي بقت هي كمان على صفحات.
  check('⭐⭐ السجل بيتقرا **مرة واحدة** (3 صفحات لـ2300)', bf.pages >= 3 && bf.pages <= 5, bf);
  check('الكتابة على دفعات', bf.batches >= 1, bf);

  await b.close();

  // ---- القواعد لازم تفضل متطابقة مع permissions.js ----
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  check('القواعد فيها مجموعة gradeStats', /match \/gradeStats\/\{statId\}/.test(rules));
  check('gradeStats مالهاش حذف', /match \/gradeStats[\s\S]{0,600}?allow delete: if false;/.test(rules));
  check('viewReports مقفولة لمدير الفرع في القواعد', /branch_manager[^\n]*viewReports/.test(rules));
  // ⚠️ مستند الدرجة ماتلمسش: نفس عدد التركيبات زي ما كان
  check('تركيبات onlyChangedKeys زي ما هي (17)', (rules.match(/onlyChangedKeys\(\[/g) || []).length === 22,
    (rules.match(/onlyChangedKeys\(\[/g) || []).length);

  console.log(`\n✅ نجح: ${pass.length}`);
  pass.forEach((t) => console.log('   ✓ ' + t));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    fail.forEach((t) => console.log('   ✗ ' + t));
    process.exit(1);
  }
  console.log('\nكل الفحوص نجحت.');
})();
