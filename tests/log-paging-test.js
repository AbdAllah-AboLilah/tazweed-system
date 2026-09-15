// ============================================================
// 📜 سجل العمليات — الأزرار بتاعت المدة ماكانتش بتوصل لحاجة وراها
// ============================================================
// ⚠️⚠️ اتبلّغ بالنص:
//   "السجل انا عاملينه ب الايام دلوقتي مش بلاقي غير عدد معين في سجل
//    العمليات حتي لما بضغط علي اخر 3 ايام او اسبوع او شهر وهكذا"
//
// --- السبب ---
// الاستعلام كان `.limit(400)` رقم ثابت، وأزرار المدة بتفلتر الـ400
// دول **في الذاكرة**. يعني عندك 1200 عملية؟ "شهر" عمره ما يوصلها —
// الرقم بيقف عند 400 مهما دوست.
//
// --- الحل اللي اتطلب بالنص ---
//   "احنا ممكن نعملهم صفحات ... او ممكن تحطلي مربع اكتب فيها اظهر كل
//    قد ايه بحد اقصي 100"
//
// ⚠️ والفلترة بالمدة فضلت في الذاكرة **عن قصد**: العملية اللي اتعملت
// وانت مفصول وقتها لسه مش متحدد (السيرفر بيحطه)، فشرط timestamp في
// الاستعلام كان هيخفيها — وهي أكتر حاجة محتاج تتطمّن عليها.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof subscribeActivityLog === 'function' && typeof activityLogHTML === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };
    state.isNarrow = true;

    // ---- سحابة مقلّدة فيها 1200 عملية ----
    // ⚠️ الرقم أكبر من 400 عن قصد: ده الرقم اللي كان مقفول عليه.
    const TOTAL = 1200;
    const allDocs = [];
    for (let i = 0; i < TOTAL; i++) {
      allDocs.push({
        id: 'e' + i,
        metadata: { hasPendingWrites: false },
        // العمليات موزّعة على 60 يوم
        data: () => ({
          action: 'qty',
          userName: 'موظف',
          timestamp: { toDate: () => new Date(Date.now() - i * 3600000) },
        }),
      });
    }

    let askedLimit = 0;
    let queries = 0;
    const q = {};
    q.orderBy = () => q;
    q.limit = (n) => { askedLimit = n; return q; };
    q.onSnapshot = (opts, cb) => {
      queries++;
      const fn = typeof opts === 'function' ? opts : cb;
      // ⚠️ بنرجّع بالظبط العدد اللي اتطلب — زي فايرستور بالحرف.
      const docs = allDocs.slice(0, askedLimit);
      setTimeout(() => fn({ docs, size: docs.length, metadata: { fromCache: false } }), 0);
      return () => {};
    };
    window.db = { collection: () => q };

    const settle = () => new Promise((r) => setTimeout(r, 30));

    // ============================================================
    // ⭐⭐⭐⭐⭐ الافتراضي بقى صغيّر — مش 400
    // ============================================================
    // ⚠️ ده كمان مكسب سرعة: أول فتحة بتجيب 50 بدل 400.
    localStorage.removeItem('tazweed_log_page');
    logPages = 1;
    subscribeActivityLog();
    await settle();
    out.firstLimit = askedLimit;
    out.firstLoaded = state.activityLog.length;
    out.hasMoreAtFirst = state.logHasMore;

    // ============================================================
    // ⭐⭐⭐⭐⭐ "اعرض أكتر" بيوصل لأبعد من 400 — ده جوهر العطل
    // ============================================================
    for (let i = 0; i < 9; i++) { logPages += 1; subscribeActivityLog(); await settle(); }
    out.after9Limit = askedLimit;
    out.after9Loaded = state.activityLog.length;
    out.passed400 = state.activityLog.length > 400;

    // ============================================================
    // ⭐⭐⭐⭐ الخانة: بتتقص على 100 وماتقبلش أكبر
    // ============================================================
    out.setTo100 = setLogPageSize(100);
    out.setTo500 = setLogPageSize(500);   // أكبر من السقف
    out.setTo1 = setLogPageSize(1);       // أصغر من الأرضية
    // ⚠️ كلام مش رقم (أو خانة فاضية) مالازمش يغيّر المحفوظ —
    // مش يرجّع رقم تاني. فبنحط 40 الأول ونتأكد إنها فضلت 40.
    setLogPageSize(40);
    out.setToجنك = setLogPageSize('كلام');
    out.setToFarدي = setLogPageSize('');
    setLogPageSize(100);
    logPages = 1;
    subscribeActivityLog();
    await settle();
    out.limitAt100 = askedLimit;

    // ============================================================
    // ⭐⭐⭐⭐ وسقف مطلق: مايوصلش لعدد يوقّف التليفون
    // ============================================================
    logPages = 999;
    out.cappedCount = logFetchCount();

    // ============================================================
    // ⭐⭐⭐⭐⭐ الشاشة بتقول إن في سجل أقدم
    // ============================================================
    logPages = 1;
    setLogPageSize(50);
    subscribeActivityLog();
    await settle();
    const html = activityLogHTML();
    out.saysLoadedCount = /محمّل/.test(html);
    out.hasMoreButton = /id="log-more"/.test(html);
    out.hasPageBox = /id="log-page-size"/.test(html);

    // ولما مايبقاش فيه كمان، الزرار بيختفي
    logPages = 1;
    setLogPageSize(100);
    const small = [];
    for (let i = 0; i < 12; i++) small.push(allDocs[i]);
    q.onSnapshot = (opts, cb) => {
      const fn = typeof opts === 'function' ? opts : cb;
      setTimeout(() => fn({ docs: small, size: small.length, metadata: { fromCache: false } }), 0);
      return () => {};
    };
    subscribeActivityLog();
    await settle();
    const html2 = activityLogHTML();
    out.noButtonWhenAllLoaded = !/id="log-more"/.test(html2);
    out.saysThatsAll = /كل اللي موجود/.test(html2);

    // ============================================================
    // ⭐⭐⭐⭐⭐ العملية اللي لسه مترفعتش مابتختفيش مع أي مدة
    // ============================================================
    // ⚠️⚠️ ده الحارس اللي بيمنعنا ننقل الفلترة للاستعلام: لو نقلناها،
    // السطر ده كان هيختفي لأن وقته لسه مش متحدد.
    const pendingDoc = {
      id: 'p1',
      metadata: { hasPendingWrites: true },
      data: () => ({ action: 'qty', userName: 'أنا', timestamp: null }),
    };
    q.onSnapshot = (opts, cb) => {
      const fn = typeof opts === 'function' ? opts : cb;
      const docs = [pendingDoc, allDocs[900]];   // واحد لسه مترفعش وواحد عمره 37 يوم
      setTimeout(() => fn({ docs, size: docs.length, metadata: { fromCache: false } }), 0);
      return () => {};
    };
    subscribeActivityLog();
    await settle();
    setLogDays(3);
    const html3 = activityLogHTML();
    // ⚠⚠ لازم ندوّر على **السطر** نفسه (class="act-pending")، مش على
    // كلمة "لسه مترفع" — دي موجودة في شريط الأدوات فوق بيقول
    // "⏳ N عملية لسه مترفعتش"، وهو بيعدّ من المحمّل مش من الباين.
    //
    // ودي مش ملاحظة نظرية: أول نسخة من الفحص كانت بتدوّر على الكلمة،
    // والتخريب (شيل حماية اللي لسه مترفعش) **عدّى بالراحة**.
    out.pendingShownIn3Days = /act-pending/.test(html3);

    out.totalQueries = queries;
    return out;
  });

  // ============================================================
  // ⭐⭐⭐⭐⭐ العطل نفسه: نقدر نعدّي الـ400
  // ============================================================
  check('⭐⭐⭐⭐⭐ "اعرض أكتر" بيعدّي حاجز الـ400 (ده العطل اللي اتبلّغ)',
    r.passed400 === true, { loaded: r.after9Loaded, limit: r.after9Limit });
  check('⭐⭐⭐⭐ والعدد بيكبر فعلًا مع كل ضغطة',
    r.after9Loaded > r.firstLoaded, { أول: r.firstLoaded, بعد9: r.after9Loaded });

  // ⚠️ والافتراضي بقى أخف من القديم — مكسب سرعة مش خسارة.
  check('⭐⭐⭐⭐ وأول فتحة بتجيب 50 بس (كانت 400 — الفتح بقى أخف)',
    r.firstLimit === 50, r.firstLimit);
  check('⭐⭐⭐ وبيقول إن فيه أقدم منهم', r.hasMoreAtFirst === true, r.hasMoreAtFirst);

  // ============================================================
  // ⭐⭐⭐⭐ الخانة وحدودها
  // ============================================================
  check('⭐⭐⭐⭐ الخانة بتقبل 100', r.setTo100 === 100, r.setTo100);
  check('⭐⭐⭐⭐⭐ و500 بتترد لـ100 (السقف اللي اتطلب بالنص)',
    r.setTo500 === 100, r.setTo500);
  check('⭐⭐⭐ و1 بترتفع لأقل رقم معقول', r.setTo1 === 10, r.setTo1);
  check('⭐⭐⭐ وكلام مش رقم مابيغيّرش المحفوظ', r.setToجنك === 40, r.setToجنك);
  check('⭐⭐⭐ وخانة فاضية كمان (لو مسح الرقم)', r.setToFarدي === 40, r.setToFarدي);
  check('⭐⭐⭐⭐ والرقم بيوصل للاستعلام فعلًا', r.limitAt100 === 100, r.limitAt100);

  // ⚠️ الاشتراك حيّ، فكل سطر زيادة شغل زيادة على الجهاز — لازم سقف.
  check('⭐⭐⭐⭐ وسقف مطلق مهما دوس (مايوقّفش التليفون)',
    r.cappedCount === 2000, r.cappedCount);

  // ============================================================
  // ⭐⭐⭐⭐ الشاشة بتقول اللي بيحصل
  // ============================================================
  check('⭐⭐⭐⭐ الشاشة بتقول محمّل كام', r.saysLoadedCount === true, r.saysLoadedCount);
  check('⭐⭐⭐⭐ وفيها زرار "اعرض أكتر"', r.hasMoreButton === true, r.hasMoreButton);
  check('⭐⭐⭐⭐ وفيها خانة العدد', r.hasPageBox === true, r.hasPageBox);
  check('⭐⭐⭐⭐ وخلاص مافيش كمان → الزرار بيختفي',
    r.noButtonWhenAllLoaded === true, r.noButtonWhenAllLoaded);
  check('⭐⭐⭐ وبيقول "كل اللي موجود"', r.saysThatsAll === true, r.saysThatsAll);

  // ============================================================
  // ⭐⭐⭐⭐⭐ اللي لسه مترفعش مابيضيعش
  // ============================================================
  check('⭐⭐⭐⭐⭐ العملية اللي لسه مترفعتش باينة حتى في "٣ أيام"',
    r.pendingShownIn3Days === true, r.pendingShownIn3Days);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
