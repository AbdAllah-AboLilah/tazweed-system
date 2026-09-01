// مراجعة شاشة حركة المخزون — الحساب، والفشل، والقِدم
// ============================================================
// الفحوصات دي اتكتبت بعد مراجعة كاملة للشاشة. كل واحد فيها بيحرس عطل
// **اتقاس فعلًا**، مش احتمال نظري:
//
//   1) ⚠️⚠️ فخ حافة الشهر: يوم 1، الدرجة اللي باعت 500 قطعة الشهر اللي
//      فات بتختفي خالص واللي باعت 3 النهاردة بتبقى في الأول
//   2) ⚠️⚠️ فشل قراءة الأرقام كان بيطلّع تقرير **كامل الشكل وغلط
//      بالكامل**: 3537 "مالهاش تاريخ"، صفر راكد، صفر بيسحب
//   3) ⚠️ الملء من السجل كان بيمسح cycleStartedAt (الدرجة الجديدة)
//   4) الأرقام بتفضل في الذاكرة وبتبقى كذب من غير ما حد يعرف
//   5) حد القراءة كان صامت
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/movement.js'), 'utf8');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof computeMovementReport === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const now = Date.now(), D = 86400000;
    const ts = (ms) => ({ toDate: () => new Date(ms) });
    state.profile = { name: 'A', role: 'owner' };
    state.categories = [{ id: 'c1', name: 'كريب' }];
    localStorage.setItem('tazweed_movement_days', '15');
    localStorage.removeItem('tazweed_movement_groups');
    window.renderFromData = () => {};

    const setup = () => {
      allGradesCache = [
        { catId:'c1', gradeId:'g1', name:'1', number:'1', branchQty:5, mainQty:0 },
        { catId:'c1', gradeId:'g2', name:'2', number:'2', branchQty:0, mainQty:0 },
        { catId:'c1', gradeId:'g3', name:'3', number:'3', branchQty:3, mainQty:2 },
        { catId:'c1', gradeId:'g4', name:'4', number:'4', branchQty:9, mainQty:0 },
      ];
      movementStats = {
        c1__g1: { lastMovedAt: ts(now - 40*D), soldByMonth: {} },
        c1__g2: { lastMovedAt: ts(now - 2*D), soldByMonth: { [movementMonthKey()]: 50 } },
        c1__g3: { lastMovedAt: ts(now - 2*D), soldByMonth: { [movementMonthKey()]: 3 } },
      };
      movementStatsAt = Date.now();
      movementStatsError = '';
      movementStatsCapped = false;
    };
    setup();

    // ---- الحساب الأساسي ----
    localStorage.setItem('tazweed_movement_span', '1');
    let rep = computeMovementReport();
    out.idle = rep.idle.flatMap(g => g.rows.map(x => x.label + ':' + x.daysIdle));
    out.unknown = rep.unknown.flatMap(g => g.rows.map(x => x.label));
    out.fast = rep.fast.flatMap(g => g.rows.map(x => x.label + ':' + x.qty));
    out.soldOut = rep.soldOut;
    out.tracked = rep.tracked;
    // الخلصانة بتفضل في "بتسحب بسرعة" — وده صح: اللي خلص عشان باع
    out.soldOutStillFast = out.fast.some(x => x.indexOf('درجة 2') === 0);

    // ⭐ الدورة الجديدة بتطلّع الدرجة من "راكدة"
    movementStats.c1__g1 = { lastMovedAt: ts(now - 40*D), cycleStartedAt: ts(now - 3*D), soldByMonth: {} };
    out.cycleClearsIdle = computeMovementReport().idleCount;
    // ودورة قديمة مابتغلبش حركة أحدث
    movementStats.c1__g1 = { lastMovedAt: ts(now - 40*D), cycleStartedAt: ts(now - 90*D), soldByMonth: {} };
    out.oldCycleStillIdle = computeMovementReport().idleCount;
    setup();

    // ============================================================
    // ⚠️⚠️ (1) فخ حافة الشهر
    // ============================================================
    const prev = movementMonthKeys(2)[1];
    allGradesCache = [
      { catId:'c1', gradeId:'a', name:'A', number:'A', branchQty:5, mainQty:5 },
      { catId:'c1', gradeId:'b', name:'B', number:'B', branchQty:5, mainQty:5 },
    ];
    movementStats = {
      c1__a: { lastMovedAt: ts(now - D), soldByMonth: { [prev]: 500 } },   // باع 500 الشهر اللي فات
      c1__b: { lastMovedAt: ts(now - D), soldByMonth: { [movementMonthKey()]: 3 } },
    };
    localStorage.setItem('tazweed_movement_span', '1');
    const r1 = computeMovementReport();
    out.thisMonthOnly = r1.fast.flatMap(g => g.rows.map(x => x.label + ':' + x.qty));
    out.dayOfMonth = r1.dayOfMonth;
    out.monthWarnFlag = r1.monthWarn;

    // ⭐ الخيار الجديد: "الشهر اللي فات" = شهر **كامل** مهما كان النهاردة
    localStorage.setItem('tazweed_movement_span', 'p');
    const rp = computeMovementReport();
    out.prevMonth = rp.fast.flatMap(g => g.rows.map(x => x.label + ':' + x.qty));
    out.prevNoWarn = rp.monthWarn;   // شهر كامل → مفيش تحذير أبدًا
    out.prevKeys = movementMonthKeys(1, 1);
    out.thisKeys = movementMonthKeys(1, 0);

    localStorage.setItem('tazweed_movement_span', '2');
    out.twoMonths = computeMovementReport().fast.flatMap(g => g.rows.map(x => x.label + ':' + x.qty));

    // التحذير بيبان في الشاشة لما الشهر لسه بدري
    localStorage.setItem('tazweed_movement_span', '1');
    const html = movementScreenHTML();
    out.warnShown = html.indexOf('مش هيبان') !== -1;
    out.warnOnlyWhenYoung = r1.dayOfMonth <= MOVEMENT_YOUNG_MONTH_DAYS ? out.warnShown : !out.warnShown;

    // ============================================================
    // ⚠️⚠️ (2) فشل القراءة = مافيش تقرير
    // ============================================================
    const keep = movementStats;
    movementStats = null;
    movementStatsError = 'unavailable';
    const errHtml = movementScreenHTML();
    out.errScreen = errHtml.indexOf('مش قادر أقرا أرقام الحركة') !== -1;
    // ⚠️⚠️ وأهم حاجة: **مايطلعش أرقام** كأن كله مالهوش تاريخ
    out.errNoFakeReport = errHtml.indexOf('مالهاش تاريخ حركة') === -1;
    out.errHasRetry = errHtml.indexOf('mv-refresh') !== -1;
    movementStats = keep;
    movementStatsError = '';

    // ============================================================
    // (4) عمر الأرقام
    // ============================================================
    movementStatsAt = Date.now();
    out.freshText = movementStatsAgeText();
    out.notStaleNow = movementStatsStale() === false;
    movementStatsAt = Date.now() - 3 * 3600000;
    out.oldText = movementStatsAgeText();
    out.staleAfterHours = movementStatsStale() === true;
    out.ageInScreen = movementScreenHTML().indexOf('الأرقام دي اتقرت') !== -1;
    movementStatsAt = Date.now();

    // ============================================================
    // (5) حد القراءة بقى مسموع
    // ============================================================
    movementStatsCapped = true;
    out.capWarn = movementScreenHTML().indexOf('الحد الأقصى للقراءة') !== -1;
    movementStatsCapped = false;
    out.noCapWarn = movementScreenHTML().indexOf('الحد الأقصى للقراءة') === -1;

    // ============================================================
    // ⭐⭐ (7) القراءة على صفحات + الرجوع لذاكرة الجهاز
    // ============================================================
    // العطل اللي اتبلّغ: "مش قادر أقرا أرقام الحركة" والنت شغّال
    // والقواعد سليمة — استعلام واحد ضخم (12000) بيتكسر لأسباب مالهاش
    // علاقة بالصلاحيات.
    const calls = [];
    const mkSnap = (docs) => ({
      size: docs.length,
      docs: docs.map((id) => ({ id, data: () => ({ lastMovedAt: ts(now - 3 * D), soldByMonth: {} }) })),
    });
    const makeDb = (behavior) => ({
      collection: () => {
        const q = {
          orderBy: () => q,
          limit: (n) => { q._limit = n; return q; },
          startAfter: (d) => { q._after = d; return q; },
          get: (opts) => behavior(q, opts, calls),
        };
        return q;
      },
    });
    window.firebase = { firestore: { FieldPath: { documentId: () => '__id__' } } };

    // (أ) القراءة بتتقسّم صفحات — 3600 مستند
    calls.length = 0;
    let total = 3600, served = 0;
    window.db = makeDb((q, opts) => {
      calls.push({ limit: q._limit, source: opts && opts.source });
      const n = Math.min(q._limit, total - served);
      const ids = Array.from({ length: n }, (_, i) => 'd' + (served + i));
      served += n;
      return Promise.resolve(mkSnap(ids));
    });
    movementStats = null; movementStatsAt = 0;
    await loadMovementStats(true);
    out.pagedCount = Object.keys(movementStats).length;
    out.pageSizes = calls.map(c => c.limit);
    out.noHugeQuery = calls.every(c => c.limit <= 2000);
    out.notFromCache = movementStatsFromCache;

    // (ب) ⭐ السحابة فشلت → الجهاز
    calls.length = 0; served = 0; total = 900;
    window.db = makeDb((q, opts) => {
      calls.push({ source: opts && opts.source });
      if (!opts || opts.source !== 'cache') return Promise.reject({ code: 'unavailable' });
      const n = Math.min(q._limit, total - served);
      const ids = Array.from({ length: n }, (_, i) => 'c' + (served + i));
      served += n;
      return Promise.resolve(mkSnap(ids));
    });
    movementStats = null; movementStatsAt = 0; movementStatsError = ''; movementStatsFromCache = false;
    await loadMovementStats(true);
    out.cacheCount = Object.keys(movementStats || {}).length;
    out.cameFromCache = movementStatsFromCache;
    out.cacheNoError = movementStatsError === '';
    // ولازم يتقال إنها من الجهاز
    allGradesCache = [{ catId:'c1', gradeId:'x', name:'1', number:'1', branchQty:2, mainQty:0 }];
    state.categories = [{ id:'c1', name:'كريب' }];
    out.cacheLabelShown = movementScreenHTML().indexOf('الأرقام المحفوظة على الجهاز') !== -1;

    // (ج) ⭐⭐ الاتنين فشلوا → شاشة خطأ **بالكود**
    window.db = makeDb(() => Promise.reject({ code: 'permission-denied' }));
    movementStats = null; movementStatsAt = 0; movementStatsError = ''; movementStatsFromCache = false;
    await loadMovementStats(true);
    out.errCode = movementStatsError;
    const eh = movementScreenHTML();
    out.errShowsCode = eh.indexOf('permission-denied') !== -1;
    out.errShowsHint = eh.indexOf('مالوش صلاحية') !== -1;
    out.hintUnavailable = movementErrorHint('unavailable').indexOf('النت') !== -1;
    out.hintQuota = movementErrorHint('resource-exhausted').indexOf('حد القراءة اليومي') !== -1;
    out.hintUnknown = movementErrorHint('حاجة-غريبة').indexOf('بلّغ') !== -1;

    movementStatsError = ''; movementStatsFromCache = false;

    // النص بقى صح عن الخلصانة
    // ⚠️ لازم نرجّع بيانات فيها درجة خلصانة — السطر ده شرطه soldOut > 0،
    // والبيانات اللي فوق كلها فيها بضاعة.
    setup();
    out.soldOutTextRight = movementScreenHTML().indexOf('لسه بتبان في "بتسحب بسرعة"') !== -1;
    // ⚠️ والنص القديم الغلط لازم يكون اتشال
    out.oldWrongTextGone = movementScreenHTML().indexOf('فمش داخلة في الحساب') === -1;
    return out;
  });

  check('راكدة: العدد والأيام صح', r.idle.join() === 'درجة 1:40', r.idle);
  check('مالهاش تاريخ: الدرجة اللي مالهاش إحصائيات', r.unknown.join() === 'درجة 4', r.unknown);
  check('بتسحب بسرعة: مرتّبة بالأكتر', r.fast.join() === 'درجة 2:50,درجة 3:3', r.fast);
  check('الخلصانة اتعدّت', r.soldOut === 1, r.soldOut);
  check('⭐ والخلصانة لسه في "بتسحب بسرعة" (صح — باعت فخلصت)', r.soldOutStillFast);
  check('⭐ الدورة الجديدة بتطلّعها من راكدة', r.cycleClearsIdle === 0, r.cycleClearsIdle);
  check('⭐ ودورة قديمة مابتغلبش حركة أحدث', r.oldCycleStillIdle === 1, r.oldCycleStillIdle);
  check('عدد المتتبَّع بيتحسب', r.tracked === 3, r.tracked);

  check('⚠️⚠️ يوم 1: اللي باع الشهر اللي فات مابيبانش', r.thisMonthOnly.join() === 'درجة B:3', r.thisMonthOnly);
  check('⭐⭐ والتحذير بيقول كده', r.warnShown, [r.dayOfMonth, r.monthWarnFlag]);
  check('والعلامة متسقة مع تاريخ النهاردة', r.warnOnlyWhenYoung, [r.dayOfMonth, r.warnShown]);
  check('⭐⭐ "الشهر اللي فات" بيوري الشهر الكامل', r.prevMonth.join() === 'درجة A:500', r.prevMonth);
  check('⭐ ومالوش تحذير أبدًا (شهر كامل)', r.prevNoWarn === false, r.prevNoWarn);
  check('ومفاتيح الشهور مختلفة فعلًا', r.prevKeys[0] !== r.thisKeys[0], [r.prevKeys, r.thisKeys]);
  check('و"شهرين" بيلمّ الاتنين', r.twoMonths.length === 2, r.twoMonths);

  check('⚠️⚠️ فشل القراءة: شاشة خطأ صريحة', r.errScreen);
  check('⚠️⚠️ ومفيش تقرير مزيّف', r.errNoFakeReport);
  check('ومعاها زرار "حاول تاني"', r.errHasRetry);

  check('عمر الأرقام: "دلوقتي"', r.freshText === 'دلوقتي', r.freshText);
  check('ومش قديمة', r.notStaleNow);
  check('بعد 3 ساعات: "من 3 ساعة"', r.oldText === 'من 3 ساعة', r.oldText);
  check('⭐ وبتتعاد قراءتها لوحدها', r.staleAfterHours);
  check('والعمر مكتوب في الشاشة', r.ageInScreen);

  check('⭐ حد القراءة بيتقال', r.capWarn);
  check('ومابيتقالش من غير سبب', r.noCapWarn);
  // ⚠️ الفحصين اللي فوق بيجرّبوا **عرض** العلامة. لازم نتأكد كمان إنها
  // بتتحط أصلًا من القراءة — وإلا هتفضل false للأبد والعرض مالوش لازمة.
  check('⭐⭐ والعلامة بتتحط من حجم القراءة فعلًا',
    /movementStatsCapped\s*=\s*size\s*>=\s*MOVEMENT_MAX_STATS/.test(src));
  // والقراءة على صفحات بتوقف عند الحد كمان
  check('⭐ والقراءة نفسها بتوقف عند الحد', /if \(size >= MOVEMENT_MAX_STATS\) break/.test(src));
  // والحد نفسه لازم يفضل أكبر من عدد الدرجات الحالي بهامش معقول
  const cap = Number((src.match(/MOVEMENT_MAX_STATS = (\d+)/) || [])[1] || 0);
  check('والحد فيه هامش فوق حجم المحل (3642 درجة)', cap >= 8000, cap);
  check('⭐ ونص الخلصانة بقى صح', r.soldOutTextRight);
  check('والنص القديم الغلط اتشال', r.oldWrongTextGone);

  // ---- فحوصات على المصدر ----
  const bf = src.slice(src.indexOf("batch.set(db.collection('gradeStats')"), src.indexOf('await batch.commit()'));
  check('⚠️⚠️ الملء من السجل بيستخدم merge (مايمسحش cycleStartedAt)', bf.indexOf('{ merge: true }') !== -1);
  check('⭐ ومابيكتبش اسم درجة فاضي فوق الاسم المحفوظ', bf.indexOf("gradeName: ''") === -1);
  check('والملء لسه بيكتب قيمة نهائية مش increment (مايتضاعفش)', bf.indexOf('increment') === -1);
  check('⭐⭐ القراءة بتتقسّم صفحات (مفيش استعلام ضخم)', r.noHugeQuery, r.pageSizes);
  check('والعدد كامل مهما اتقسّم', r.pagedCount === 3600, r.pagedCount);
  check('⭐⭐ السحابة فشلت → بيقرا من ذاكرة الجهاز', r.cacheCount === 900 && r.cameFromCache, [r.cacheCount, r.cameFromCache]);
  check('ومابيعتبرهاش فشل', r.cacheNoError);
  check('⭐ بس بيقول إنها من الجهاز', r.cacheLabelShown);
  check('⭐⭐ الاتنين فشلوا: شاشة خطأ **بالكود**', r.errShowsCode, r.errCode);
  check('⭐⭐ ومعاها سبب مفهوم', r.errShowsHint);
  check('وتلميح لكل كود', r.hintUnavailable && r.hintQuota && r.hintUnknown);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
