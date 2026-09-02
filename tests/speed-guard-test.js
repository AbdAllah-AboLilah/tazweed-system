// ============================================================
// حارس السرعة — بيعدّ، مابيوقّتش
// ============================================================
// ⚠️⚠️ المشكلة اللي بيحلها: مكاسب السرعة اللي كسبناها **بتموت في صمت**.
//
// مافيش حاجة بتتكسر، ومفيش فحص بيفشل، ومفيش رسالة خطأ. بس النظام بيرجع
// بطيء تاني، وانت بتكتشف ده بعد شهرين لما تحس بإيدك — وساعتها محدش فاكر
// أي تعديل هو السبب.
//
// ده حصل فعلًا وإحنا بنعمل التحسين نفسه: أول نسخة من patchQuantitiesOnly
// **ماكانتش هتشتغل خالص** على الجهاز، لأن عنوان زرار التراجع بيتغيّر مع
// كل تعديل. والفحص وقتها كان **بيعدّي** — لأنه ماكانش بيملا مكدس التراجع.
//
// ------------------------------------------------------------
// ⚠️ ليه بنعدّ ومابنوقّتش
// ------------------------------------------------------------
// الحارس اللي بيقيس المللي بيفشل عشوائي حسب شغل الجهاز — ووقتها كلنا
// بنبطّل ناخد باله. **وحارس بينده كذب أوحش من مفيش حارس**، لأنه
// بيعلّمك تتجاهله.
//
// فالحارس ده بيعدّ **كام رسمة كاملة حصلت**. ده رقم ثابت مالوش دعوة
// بسرعة الجهاز: صفر أو مش صفر. الوقت بيتطبع للعلم بس، **مافيش عليه حكم**.
//
// ------------------------------------------------------------
// بيحمي تلات مكاسب
// ------------------------------------------------------------
//   v0.71.1  سجل العمليات ماعادش يرسم الشاشة وهو مش ظاهر
//   v0.71.2  الدرج المقفول ماعادش يتبني
//   v0.71.3  تعديل الكمية ماعادش يهدّ الشاشة
//
// ------------------------------------------------------------
// ⚠️ الفرق بين الحارس ده وبين qty-patch-test
// ------------------------------------------------------------
// qty-patch-test بيجرّب الحالات الصعبة **بشكل صناعي**: بيغيّر الرقم
// بإيده وينده render(). ده مهم، بس مش اللي بيحصل على الجهاز.
//
// الحارس ده بيدوس على **الزرار نفسه** (.qty-btn) بمقاس المحل الحقيقي
// (39 فئة · 80 درجة في الفئة المفتوحة) — فبيعدّي على المسار الكامل:
// قراءة الدرجة، الكتابة، مكدس التراجع، السجل، إعادة الحساب، الرسم.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof patchQuantitiesOnly === 'function');

  const r = await p.evaluate(async () => {
    const out = {};

    // ---- عدّاد الرسمات الكاملة ----
    // attachDashboardEvents بتتنده **مرة واحدة بالظبط** مع كل رسمة كاملة
    // ومابتتندهش خالص مع التعديل في المكان — فهي العدّاد الطبيعي.
    // ⚠️ عدّادين مش واحد — وده طلع **ضروري**:
    //
    // أول نسخة كانت بتعدّ الرسمات الكاملة بس. وده خلّى فحص سجل العمليات
    // **بلا أسنان**: شيلنا الحارس بتاعه والفحص عدّى. السبب إن تحسين
    // الكميات بيمتص الرسمة الكاملة — بس الشغل التقيل (بناء نص الشاشة،
    // 28 مللي) بيتعمل برضه. فالرقم اللي بيكشف ده هو **عدد مرات البناء**.
    let fullRenders = 0;    // رسمة كاملة (هدّ الشاشة وبناها)
    let htmlBuilds = 0;     // بناء نص الشاشة — بيحصل حتى مع التعديل في المكان
    const realAttach = window.attachDashboardEvents;
    window.attachDashboardEvents = function () { fullRenders++; return realAttach.apply(this, arguments); };
    const realDashboardHTML = window.dashboardHTML;
    window.dashboardHTML = function () { htmlBuilds++; return realDashboardHTML.apply(this, arguments); };

    // ============================================================
    // ⚠️⚠️ قاعدة بيانات وهمية — لازم تقلّد حاجة واحدة بالذات
    // ============================================================
    // تعديل الكمية **مابيغيّرش state.grades بإيده خالص**. بيكتب في
    // Firestore وبس. والشاشة بتتحرك لأن Firestore بينفّذ الكتابة محليًا
    // فورًا وبيرجّع اللقطة (onSnapshot) من غير ما يستنى السيرفر.
    //
    // ⚠️ أول نسخة من الحارس ده كانت **فاضية**: القاعدة الوهمية كانت
    // بتبلع الكتابة وخلاص، فالضغطات ماكانتش بتغيّر حاجة — والحارس كان
    // بيقول "صفر رسمة كاملة" وهو مبسوط، وهو أصلًا مش بيقيس أي حاجة.
    // اللي كشفها إن الفحص بيتأكد من **الرقم على الشاشة** كمان، مش من
    // العدّاد لوحده. عشان كده الرقم متفحوص تحت في كل حالة.
    //
    // فالقاعدة دي بتعمل بالظبط اللي subscribeGrades الحقيقية بتعمله:
    // تعدّل state.grades وتنده renderFromData().
    let activityCb = null;
    const fakeLog = [];
    const fakeLogSnap = () => ({ docs: fakeLog.slice(0, 60) });
    const okPromise = () => Promise.resolve();

    const applyFakeWrite = (path, patch) => {
      // path = ['categories', catId, 'grades', gradeId]
      if (path.length < 4 || path[0] !== 'categories' || path[2] !== 'grades') return;
      const catId = path[1], gradeId = path[3];
      const g = (state.grades || []).find((x) => x.id === gradeId);
      if (g) Object.keys(patch).forEach((k) => { if (patch[k] !== null) g[k] = patch[k]; });
      const a = (allGradesCache || []).find((x) => x.catId === catId && x.gradeId === gradeId);
      if (a) Object.keys(patch).forEach((k) => { if (patch[k] !== null) a[k] = patch[k]; });
      renderFromData();          // ⭐ ده اللي subscribeGrades بتعمله بالظبط
    };

    const ref = (path) => ({
      collection: (n) => ref(path.concat(n)),
      doc: (n) => ref(path.concat(n)),
      orderBy: () => ref(path), limit: () => ref(path), where: () => ref(path),
      update: (u) => { applyFakeWrite(path, u); return Promise.resolve(); },
      // ⚠️ كل تعديل كمية بيكتب سطر في السجل، وFirestore بيرجّع اللقطة
      // **مرتين** (محلية + تأكيد السيرفر) بسبب includeMetadataChanges.
      // من غير التقليد ده، الضغطة في الفحص أرخص من الحقيقة والحارس
      // مابيشوفش رجوع v0.71.1 خالص.
      add: (d) => {
        if (path[0] === 'activityLog') {
          fakeLog.unshift({ id: 'L' + fakeLog.length, metadata: { hasPendingWrites: true }, data: () => d || {} });
          if (activityCb) { activityCb(fakeLogSnap()); activityCb(fakeLogSnap()); }
        }
        return Promise.resolve();
      },
      set: okPromise, delete: okPromise,
      get: () => Promise.resolve({ exists: false, docs: [], data: () => ({}) }),
      onSnapshot: (a, c) => {
        const cb = typeof a === 'function' ? a : c;
        if (path[0] === 'activityLog') activityCb = cb;
        return () => {};
      },
    });
    db = ref([]);

    // عشان تسجيل الحركة يمشي في مساره الحقيقي بدل ما يخرج من أوله
    firebase.firestore.FieldValue.increment = (n) => ({ __inc: n });

    // ============================================================
    // مقاس المحل الحقيقي — 39 فئة، والفئة المفتوحة فيها 80 درجة
    // ============================================================
    const CATS = 39, GRADES = 80;
    const setup = () => {
      state.profile = { name: 'أحمد', role: 'owner' };
      state.user = { uid: 'u1' };
      state.isNarrow = true;
      state.sideMenuOpen = false;
      state.view = 'dashboard';
      state.screen = 'sheets';
      state.categories = Array.from({ length: CATS }, (_, i) => ({ id: 'c' + i, name: 'فئة ' + (i + 1), minQty: 3 }));
      state.activeCategoryId = 'c0';
      state.gradeFilter = 'all';
      state.gradeSearch = '';
      // كميات عالية عشان الضغطات ماتقربش من حد التنبيه (3) ولا من الصفر —
      // إحنا بنقيس **الحالة الشائعة**: رقم بيتغيّر والشكل ثابت.
      state.grades = Array.from({ length: GRADES }, (_, i) => ({
        id: 'g' + i, number: String(i + 1), branchQty: 50, mainQty: 50, status: 'normal',
      }));
      allGradesCache = [];
      for (let c = 0; c < CATS; c++) {
        for (let i = 0; i < GRADES; i++) {
          allGradesCache.push({
            catId: 'c' + c, gradeId: 'g' + i, number: String(i + 1), name: '',
            branchQty: 50, mainQty: 50, status: 'normal',
          });
        }
      }
      state.hasPendingWrites = true;   // ثابتة أثناء القياس: إحنا بنقيس الحالة المستقرة
      // ⚠️ الاشتراك على السجل شغّال أثناء الضغطات — زي الجهاز بالظبط.
      // من غيره الضغطة في الفحص أرخص من الحقيقة: كل تعديل بيكتب سطر
      // في السجل، والسجل بيرجّع لقطتين، وكل لقطة كانت بترسم الشاشة.
      unsubActivityLog = null;
      activityCb = null;
      fakeLog.length = 0;
      subscribeActivityLog();
      recomputeOverview();
      lastDashboardHTML = '';
      render();
      fullRenders = 0;
      htmlBuilds = 0;
    };

    const tap = async (gradeId, action) => {
      const btn = document.querySelector(
        `.qty-btn[data-grade-id="${gradeId}"][data-field="branchQty"][data-action="${action}"]`
      );
      if (!btn) return false;
      btn.click();
      // الضغطة بتعدّي على await، فلازم نسيب الوعود تخلص قبل ما نقيس
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      return true;
    };
    const val = (id, f) => {
      const el = document.querySelector(`.qty-input[data-grade-id="${id}"][data-field="${f}"]`);
      return el ? el.value : null;
    };

    // ============================================================
    // ⭐⭐⭐ الحارس الأساسي: ١٠ ضغطات حقيقية
    // ============================================================
    setup();
    out.domSize = document.getElementById('root').getElementsByTagName('*').length;
    out.tapWorked = await tap('g0', 'inc');
    fullRenders = 0; htmlBuilds = 0;                       // أول ضغطة بتفتح مكدس التراجع (رسمة كاملة مشروعة)
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) await tap('g0', 'inc');
    out.burstMs = Math.round(performance.now() - t0);
    out.burstRenders = fullRenders;
    out.burstBuilds = htmlBuilds;
    out.burstValue = val('g0', 'branchQty');

    // ودرجات مختلفة ورا بعض (مش نفس الصف)
    setup();
    await tap('g5', 'inc'); fullRenders = 0; htmlBuilds = 0;
    for (let i = 0; i < 8; i++) await tap('g' + (10 + i), 'inc');
    out.spreadRenders = fullRenders;
    out.spreadValue = val('g17', 'branchQty');

    // وناقص برضه
    setup();
    await tap('g2', 'dec'); fullRenders = 0; htmlBuilds = 0;
    for (let i = 0; i < 6; i++) await tap('g2', 'dec');
    out.decRenders = fullRenders;
    out.decValue = val('g2', 'branchQty');

    // ============================================================
    // ⚠️⚠️ كاشف الموت الصامت — إثبات إن الحارس ليه أسنان
    // ============================================================
    // بنضيف حاجة "بتتغيّر لوحدها" في الشاشة (زي ساعة، أو عدّاد، أو رقم
    // "هتخلص كام يوم") — وده بالظبط اللي هيحصل أول ما نضيف خاصية جديدة.
    //
    // لو الحارس **مافشلش** هنا، يبقى الحارس نفسه بايظ ومابيحميش حاجة.
    setup();
    let ticker = 0;
    window.dashboardHTML = function () {
      htmlBuilds++;
      return realDashboardHTML.apply(this, arguments) + `<!-- ${++ticker} -->`;
    };
    lastDashboardHTML = ''; render(); fullRenders = 0; htmlBuilds = 0;
    for (let i = 0; i < 5; i++) await tap('g0', 'inc');
    out.sabotageRenders = fullRenders;
    window.dashboardHTML = function () { htmlBuilds++; return realDashboardHTML.apply(this, arguments); };

    // ============================================================
    // v0.71.2 — الدرج المقفول مايتبنيش
    // ============================================================
    setup();
    state.isNarrow = true; state.sideMenuOpen = false;
    const closed = document.createElement('div');
    closed.innerHTML = sideMenuHTML();
    out.drawerClosedEls = closed.getElementsByTagName('*').length;
    state.sideMenuOpen = true;
    const open = document.createElement('div');
    open.innerHTML = sideMenuHTML();
    out.drawerOpenEls = open.getElementsByTagName('*').length;
    state.sideMenuOpen = false;

    // ============================================================
    // v0.71.1 — سجل العمليات مايرسمش وهو مش ظاهر
    // ============================================================
    // بننده الاشتراك الحقيقي على قاعدة وهمية، وبنمسك الدالة اللي بتتنده
    // مع كل تحديث، وبنشغّلها بإيدنا في الشاشتين.
    const fakeSnap = {
      docs: Array.from({ length: 20 }, (_, i) => ({
        id: 'L' + i,
        metadata: { hasPendingWrites: false },
        data: () => ({ action: 'edit_qty', userName: 'أحمد', timestamp: new Date() }),
      })),
    };
    setup();
    unsubActivityLog = null;
    activityCb = null;
    subscribeActivityLog();
    out.logHooked = typeof activityCb === 'function';
    if (activityCb) {
      state.screen = 'sheets'; fullRenders = 0; htmlBuilds = 0;
      activityCb(fakeSnap); activityCb(fakeSnap);   // محلية + تأكيد السيرفر
      out.logOnSheets = fullRenders;
      out.logBuildsOnSheets = htmlBuilds;
      out.logStillStored = (state.activityLog || []).length;

      state.screen = 'home'; lastDashboardHTML = ''; fullRenders = 0; htmlBuilds = 0;
      activityCb(fakeSnap);
      out.logOnHome = fullRenders;
      out.logBuildsOnHome = htmlBuilds;
    }

    return out;
  });

  console.log(`   ℹ️  حجم الشاشة: ${r.domSize} عنصر · ١٠ ضغطات في ${r.burstMs} مللي (للعلم بس — مافيش حكم على الوقت)`);

  check('الضغطة على الزرار بتشتغل فعلًا', r.tapWorked);
  check('⭐ والشاشة بمقاس المحل الحقيقي (فوق 1500 عنصر)', r.domSize > 1500, r.domSize);
  check('⭐⭐⭐ ١٠ ضغطات حقيقية → صفر رسمة كاملة', r.burstRenders === 0, r.burstRenders);
  check('⭐⭐ والرقم صح بعد الضغطات', r.burstValue === '61', r.burstValue);
  check('⭐⭐⭐ ومرة بناء واحدة لكل ضغطة (مش تلاتة)', r.burstBuilds === 10, r.burstBuilds);
  check('⭐⭐ ضغطات على درجات مختلفة → صفر رسمة', r.spreadRenders === 0, r.spreadRenders);
  check('⭐ والأرقام صح', r.spreadValue === '51', r.spreadValue);
  check('⭐⭐ ضغطات "ناقص" → صفر رسمة', r.decRenders === 0, r.decRenders);
  check('⭐ والرقم صح', r.decValue === '43', r.decValue);

  check('⚠️⚠️ كاشف الموت الصامت: حاجة بتتغيّر لوحدها → الحارس بيفشل', r.sabotageRenders >= 5, r.sabotageRenders);

  check('⭐⭐ الدرج المقفول مابيتبنيش (v0.71.2)', r.drawerClosedEls <= 1, r.drawerClosedEls);
  check('⭐ ولما يتفتح بيتبني كامل', r.drawerOpenEls > 50, r.drawerOpenEls);

  check('الاشتراك على السجل اتمسك', r.logHooked);
  check('⭐⭐⭐ السجل مايرسمش وانت في الشيت (v0.71.1)', r.logOnSheets === 0, r.logOnSheets);
  check('⭐⭐⭐ ولا حتى بيبني نص الشاشة', r.logBuildsOnSheets === 0, r.logBuildsOnSheets);
  check('⭐ ومع كده البيانات بتتحدّث (السجل جاهز أول ما تفتحه)', r.logStillStored === 20, r.logStillStored);
  check('⭐ وبيرسم عادي وانت في الرئيسية', r.logOnHome >= 1, r.logOnHome);
  check('⭐ وبيبني نص الشاشة هناك فعلًا', r.logBuildsOnHome >= 1, r.logBuildsOnHome);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
