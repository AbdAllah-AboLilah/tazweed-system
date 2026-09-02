// سرعة الاستجابة لضغطة "زاد / ناقص"
// ============================================================
// ⚠️ العطل اللي اتبلّغ: "بدوس زاد أو ناقص وبياخد وقت لحد ما يسمع،
// وبعدين أقدر أزوّد تاني".
//
// وده **مش إحساس**. اتقاس على معالج مبطّأ 4 أضعاف ببيانات المحل
// (39 فئة · 3642 درجة):
//
//   recomputeOverview (لفّة على 3642 + ترتيب) ....  337ms
//   رسم الشاشة من الأول ..........................   97ms
//   ربط 202 مستمع ................................   47ms
//   ────────────────────────────────────────────────────
//   ≈ نص ثانية **لكل ضغطة** — وكل ضغطة بتعمل لقطة جديدة
//
// ⭐ والحل إن الشغل التقيل بيتلمّ: رشقة ضغطات = حساب واحد في الآخر.
// الرقم اللي تحت الصباع **مش** جاي من هنا — الفئة المفتوحة ليها اشتراك
// لوحدها بيرسم على طول، فالتأخير مابيتحسّش.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/dashboard.js'), 'utf8');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof subscribeOverview === 'function' && typeof recomputeOverview === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.profile = { name: 'A', role: 'owner' }; state.user = { uid: 'u1' }; state.isNarrow = true;
    state.view = 'dashboard'; state.screen = 'sheets';
    state.categories = Array.from({ length: 39 }, (_, i) => ({ id: 'c' + i, name: 'فئة ' + i, minQty: 3 }));
    state.activeCategoryId = 'c0';
    state.grades = Array.from({ length: 20 }, (_, i) => ({ id: 'g' + i, number: String(i + 1), branchQty: i % 9, mainQty: i % 5, status: 'normal' }));

    const N = 1200;
    const docs = Array.from({ length: N }, (_, i) => ({
      id: 'g' + i,
      ref: { parent: { parent: { id: 'c' + (i % 39) } } },
      data: () => ({ status: i % 17 === 0 ? 'pending' : 'normal', isBase: false, name: String(i), number: String(i), branchQty: i % 9, mainQty: i % 5 }),
    }));
    let changes = [{}];
    const snap = { docs, docChanges: () => changes, metadata: { fromCache: false, hasPendingWrites: true } };

    const root = document.getElementById('root') || (() => { const d = document.createElement('div'); d.id = 'root'; document.body.appendChild(d); return d; })();
    root.innerHTML = dashboardHTML();

    // نمسك اللقطة اللي بيشتغل عليها الاشتراك
    let handler = null;
    window.db = { collectionGroup: () => ({ onSnapshot: (opts, cb) => { handler = cb; return () => {}; } }) };
    window.categoryIdOfGrade = (d) => d.ref.parent.parent.id;
    window.renderFromData = () => { out.renders = (out.renders || 0) + 1; };
    window.render = window.renderFromData;
    window.startPresenceHeartbeat = () => {};
    window.onGradesSnapshotForNotify = () => { out.notifies = (out.notifies || 0) + 1; };

    subscribeOverview();
    out.subscribed = typeof handler === 'function';
    if (!handler) return out;

    // نعدّ الحسابات التقيلة
    let heavy = 0;
    const realRecompute = window.recomputeOverview;
    window.recomputeOverview = function () { heavy++; return realRecompute.apply(this, arguments); };

    // ⭐ (أ) رشقة جوّه نافذة اللمّ الواحدة → حساب **واحد** بالظبط
    out.renders = 0; out.notifies = 0;
    for (let i = 0; i < 10; i++) handler(snap);
    out.heavyDuringBurst = heavy;      // لازم صفر — لسه بيلمّ
    await new Promise((r) => setTimeout(r, 400));
    out.heavyAfterBurst = heavy;       // لازم 1
    out.notifiesAfterBurst = out.notifies;
    out.cacheBuilt = !!(allGradesCache && allGradesCache.length === N);

    // ⭐ (ب) ١٠ ضغطات على مدى ٢٠٠ مللي (أسرع من إصبع بني آدم).
    // ⚠️ مش لازم تبقى حساب واحد — دي أطول من نافذة اللمّ. المهم إنها
    // **أقل بكتير من ١٠**، وده الفرق اللي المستخدم بيحسّه.
    heavy = 0;
    for (let i = 0; i < 10; i++) { handler(snap); await new Promise((r) => setTimeout(r, 20)); }
    await new Promise((r) => setTimeout(r, 400));
    out.heavySpread = heavy;

    // ⚠️ ولقطة الميتاداتا لوحدها **مالهاش** حساب تقيل
    heavy = 0; changes = [];
    handler({ ...snap, docChanges: () => [], metadata: { fromCache: true, hasPendingWrites: false } });
    await new Promise((r) => setTimeout(r, 300));
    out.heavyOnMetadataOnly = heavy;
    changes = [{}];

    // ⚠️ والخروج بيلغي أي لقطة ملمومة مستنية
    heavy = 0;
    handler(snap);
    stopOverview();
    await new Promise((r) => setTimeout(r, 300));
    out.heavyAfterStop = heavy;
    return out;
  });

  check('الاشتراك اتركّب', r.subscribed);
  check('⭐⭐ رشقة ١٠ ضغطات: مفيش حساب تقيل أثناءها', r.heavyDuringBurst === 0, r.heavyDuringBurst);
  check('⭐⭐ وحساب واحد بس في الآخر (كان ١٠)', r.heavyAfterBurst === 1, r.heavyAfterBurst);
  check('والنسخة اتبنت كاملة', r.cacheBuilt);
  check('⭐ والتنبيهات بتوصل مرة واحدة بآخر لقطة', r.notifiesAfterBurst === 1, r.notifiesAfterBurst);
  check('⭐⭐ و١٠ ضغطات على ٢٠٠ مللي = حسابين بدل عشرة', r.heavySpread > 0 && r.heavySpread <= 3, r.heavySpread);
  check('⚠️ لقطة الميتاداتا لوحدها مالهاش حساب تقيل', r.heavyOnMetadataOnly === 0, r.heavyOnMetadataOnly);
  check('⭐ والخروج بيلغي اللقطة المستنية', r.heavyAfterStop === 0, r.heavyAfterStop);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  // ============================================================
  // ⚠️⚠️ سجل العمليات كان بيرسم الشاشة كلها وهو مش ظاهر
  // ============================================================
  // كل تعديل كمية بيكتب سطر في السجل. والاشتراك بيسمع الكتابة دي
  // **مرتين** (محلية + تأكيد السيرفر، عشان includeMetadataChanges) —
  // وكان بيرسم الشاشة كلها في المرتين.
  //
  // يعني وانت في الشيت بتدوس زاد/ناقص، السجل — اللي مش ظاهر على الشاشة
  // دي أصلًا — كان بيسبّب **رسمتين كاملتين زيادة لكل ضغطة**.
  {
    const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p2.goto('http://localhost:8899/tests/harness.html');
    await p2.waitForFunction(() => typeof subscribeActivityLog === 'function');
    const lg = await p2.evaluate(() => {
      const out = {};
      state.profile = { name: 'A', role: 'owner' }; state.user = { uid: 'u1' };
      state.categories = [{ id: 'c1', name: 'ك' }]; state.activeCategoryId = 'c1'; state.grades = [];
      let handler = null;
      window.db = { collection: () => ({ orderBy: () => ({ limit: () => ({ onSnapshot: (o, cb) => { handler = cb; return () => {}; } }) }) }) };
      let renders = 0; window.renderFromData = () => { renders++; };
      subscribeActivityLog();
      const snap = { docs: [{ id: 'a', metadata: { hasPendingWrites: true }, data: () => ({ action: 'edit', userName: 'A' }) }] };
      const run = (screen, times) => { state.screen = screen; renders = 0; for (let i = 0; i < times; i++) handler(snap); return renders; };
      out.sheets = run('sheets', 2);
      out.activity = run('activity', 2);
      out.home = run('home', 1);
      out.print = run('print', 2);
      // ⚠️ البيانات لازم تفضل بتتحدّث في كل الأحوال — عشان أول ما تفتح
      // السجل تلاقيه جاهز من غير انتظار
      state.screen = 'sheets';
      handler({ docs: [{ id: 'z', metadata: { hasPendingWrites: false }, data: () => ({ action: 'print', userName: 'B' }) }] });
      out.dataStillUpdates = state.activityLog.length === 1 && state.activityLog[0].id === 'z';
      return out;
    });
    await p2.close();
    check('⭐⭐ وانت في الشيت: السجل مابيرسمش خالص (كان رسمتين لكل ضغطة)', lg.sheets === 0, lg.sheets);
    check('⭐ وفي شاشة الطباعة كمان', lg.print === 0, lg.print);
    check('⭐ بس في شاشة السجل بيرسم عادي', lg.activity === 2, lg.activity);
    check('وفي الرئيسية (فيها آخر ٨ حركات)', lg.home === 1, lg.home);
    check('⭐⭐ والبيانات بتفضل بتتحدّث في كل الشاشات', lg.dataStillUpdates);
  }

  // ---- فحوصات على المصدر ----
  check('مدة اللمّ محسوسة بس مش ملحوظة (100-300 مللي)',
    /OVERVIEW_COALESCE_MS = (1[0-9][0-9]|2[0-9][0-9]|300)\b/.test(src),
    (src.match(/OVERVIEW_COALESCE_MS = \d+/) || [])[0]);
  check('⭐ والمؤقّت بيتلغي في stopOverview',
    /stopOverview[\s\S]{0,400}clearTimeout\(overviewCoalesceTimer\)/.test(src));

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
