// تعديل الكمية من غير ما الشاشة تتهدّ
// ============================================================
// ⚠️ القياس اللي أدّى للحاجة دي: لما تدوس زاد أو ناقص والحالة ماتتغيّرش،
// **منطقة واحدة بس** في الشاشة بتختلف — من 62,665 حرف:
//
//   value="5"  →  value="6"
//
// وكنا بنهدّ 2000 عنصر ونخلّي المتصفح يرتّبهم من الأول (~300 مللي) عشان
// **حرف واحد**.
//
// ⚠️⚠️ والأمان هنا **مش** مبني على "أنا عارف إن الكمية بتأثّر على الرقم
// وبس" — ده افتراض بشري بيقع أول ما حاجة تتغيّر (الشارة، الفلتر،
// التحذير البرتقالي...).
//
// الأمان مبني على **مقارنة الناتج النهائي**: بنبني نص الشاشة كامل
// ونقارنه بالقديم بعد ما نشيل أرقام الكميات من الاتنين. أي اختلاف في أي
// حتة تانية → رسم كامل. الفحوصات تحت بتجرّب الحالات الصعبة دي بالذات.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof patchQuantitiesOnly === 'function');

  const r = await p.evaluate(() => {
    const out = {};
    let fullRenders = 0;
    const realAttach = window.attachDashboardEvents;
    window.attachDashboardEvents = function () { fullRenders++; return realAttach.apply(this, arguments); };

    const setup = (opts) => {
      state.profile = { name: 'A', role: 'owner' }; state.user = { uid: 'u1' }; state.isNarrow = true;
      state.view = 'dashboard'; state.screen = 'sheets';
      state.categories = [{ id: 'c0', name: 'كريب', minQty: (opts && opts.minQty) || 0 }];
      state.activeCategoryId = 'c0';
      state.gradeFilter = (opts && opts.filter) || 'all';
      state.grades = Array.from({ length: 12 }, (_, i) => ({ id: 'g' + i, number: String(i + 1), branchQty: 5, mainQty: 5, status: 'normal' }));
      allGradesCache = state.grades.map((g) => ({ catId: 'c0', gradeId: g.id, name: g.name, number: g.number, branchQty: g.branchQty, mainQty: g.mainQty, status: g.status }));
      recomputeOverview();
      lastDashboardHTML = '';
      render();
      fullRenders = 0;
    };
    const val = (id, f) => {
      const el = document.querySelector(`.qty-input[data-grade-id="${id}"][data-field="${f}"]`);
      return el ? el.value : null;
    };

    // ---- (١) الحالة الشائعة: كمية بتزيد والحالة ثابتة ----
    setup();
    state.grades[0].branchQty = 6; allGradesCache[0].branchQty = 6;
    render();
    out.simpleNoRender = fullRenders;
    out.simpleValue = val('g0', 'branchQty');

    // ---- (٢) كذا كمية مع بعض ----
    setup();
    state.grades[0].branchQty = 7; allGradesCache[0].branchQty = 7;
    state.grades[3].mainQty = 9; allGradesCache[3].mainQty = 9;
    render();
    out.multiNoRender = fullRenders;
    out.multiA = val('g0', 'branchQty');
    out.multiB = val('g3', 'mainQty');

    // ---- ⚠️ (٣) الحالة اتغيّرت (خلصت من الفرع) → رسم كامل ----
    setup();
    state.grades[1].branchQty = 0; state.grades[1].status = 'pending';
    allGradesCache[1].branchQty = 0; allGradesCache[1].status = 'pending';
    recomputeOverview(); render();
    out.statusChangeRenders = fullRenders;

    // ---- ⚠️⚠️ (٤) عدّى حد التنبيه (البرتقالي) → رسم كامل ----
    // ده أخطر فخ: الرقم بيتغيّر **والصف بياخد شكل تاني** في نفس الوقت.
    setup({ minQty: 3 });
    state.grades[2].branchQty = 2; allGradesCache[2].branchQty = 2;
    recomputeOverview(); render();
    out.criticalRenders = fullRenders;

    // ---- ⚠️ (٥) فيه فلتر شغّال والصف خرج منه → رسم كامل ----
    // ⚠️ لازم الصف يكون **جوه الفلتر فعلًا** الأول، وإلا الفحص مش
    // بيجرّب حاجة. حد التنبيه 3، فالدرجة بكمية 2 بتبقى "قرّبت تخلص".
    setup({ minQty: 3, filter: 'low' });
    state.grades[4].branchQty = 2; allGradesCache[4].branchQty = 2;
    recomputeOverview(); lastDashboardHTML = ''; render();
    out.filterHasRow = !!document.querySelector('.qty-input[data-grade-id="g4"]');
    fullRenders = 0;
    // دلوقتي نطلّعها من الفلتر
    state.grades[4].branchQty = 99; allGradesCache[4].branchQty = 99;
    recomputeOverview(); render();
    out.filterRenders = fullRenders;
    out.filterRowGone = !document.querySelector('.qty-input[data-grade-id="g4"]');

    // ---- ⚠️ (٦) صف اتشال / اتضاف → رسم كامل ----
    setup();
    state.grades.pop(); render();
    out.removeRenders = fullRenders;
    setup();
    state.grades.push({ id: 'gX', number: '99', branchQty: 1, mainQty: 1, status: 'normal' });
    render();
    out.addRenders = fullRenders;

    // ---- ⚠️ (٧) الصفوف اتقلبت (ترتيب) → رسم كامل ----
    setup();
    const tmp = state.grades[0]; state.grades[0] = state.grades[1]; state.grades[1] = tmp;
    render();
    out.reorderRenders = fullRenders;

    // ---- ⚠️⚠️ (٨) المستخدم واقف في الخانة → مانلمسهاش ----
    setup();
    const inp = document.querySelector('.qty-input[data-grade-id="g0"][data-field="branchQty"]');
    inp.focus();
    state.grades[0].branchQty = 42; allGradesCache[0].branchQty = 42;
    render();
    out.focusRenders = fullRenders;
    inp.blur();

    // ---- (٩) شاشة تانية غير الشيت → رسم كامل عادي ----
    setup();
    state.screen = 'home';
    state.grades[0].branchQty = 8; allGradesCache[0].branchQty = 8;
    render();
    out.otherScreenRenders = fullRenders;

    // ---- (١٠) مفيش أي فرق → مفيش رسم ولا تحديث ----
    setup();
    render();
    out.noChangeRenders = fullRenders;

    // ============================================================
    // ⚠️⚠️ (١٢) الاستخدام الحقيقي — بمكدس تراجع
    // ============================================================
    // ده الفحص اللي فات على النسخة الأولى وكشف إن التحسين **ميت**:
    // عنوان زرار التراجع فيه اسم آخر حركة، فبيتغيّر مع كل تعديل —
    // والمقارنة كانت بتلاقي فرق وتعمل رسم كامل دايمًا.
    setup();
    state.undoCount = 1;
    window.lastUndoLabel = () => 'درجة 1 — الفرع: 5 ← 6';
    lastDashboardHTML = ''; render(); fullRenders = 0;
    for (let i = 0; i < 5; i++) {
      state.grades[0].branchQty = 6 + i; allGradesCache[0].branchQty = 6 + i;
      state.undoCount = 2 + i;
      window.lastUndoLabel = () => `درجة 1 — الفرع: ${5 + i} ← ${6 + i}`;
      render();
    }
    out.realUseRenders = fullRenders;
    out.realUseValue = val('g0', 'branchQty');
    out.realUseUndoTitle = (document.getElementById('undo-btn') || {}).title;

    // ⚠️ ولو زرار التراجع ظهر من العدم (أول تعديل) → رسم كامل
    setup();
    state.undoCount = 0; lastDashboardHTML = ''; render(); fullRenders = 0;
    state.undoCount = 1; window.lastUndoLabel = () => 'حركة';
    state.grades[0].branchQty = 6; allGradesCache[0].branchQty = 6;
    render();
    out.undoAppearsRenders = fullRenders;

    // ---- (١١) أول رسمة بعد فتح التطبيق لازم تبقى كاملة ----
    setup();
    lastDashboardHTML = '';
    fullRenders = 0;
    render();
    out.firstRenderIsFull = fullRenders;
    return out;
  });

  check('⭐⭐ كمية بتتغيّر: مفيش رسم كامل خالص', r.simpleNoRender === 0, r.simpleNoRender);
  check('⭐ والرقم على الشاشة صح', r.simpleValue === '6', r.simpleValue);
  check('كذا كمية مع بعض: برضه من غير رسم', r.multiNoRender === 0, r.multiNoRender);
  check('والأرقام كلها صح', r.multiA === '7' && r.multiB === '9', [r.multiA, r.multiB]);
  check('⚠️ الحالة اتغيّرت → رسم كامل', r.statusChangeRenders === 1, r.statusChangeRenders);
  check('⚠️⚠️ عدّى حد التنبيه → رسم كامل', r.criticalRenders === 1, r.criticalRenders);
  check('الصف كان جوه الفلتر فعلًا', r.filterHasRow);
  check('⚠️⚠️ وخرج منه → رسم كامل', r.filterRenders === 1, r.filterRenders);
  check('⭐ والصف اختفى من الشاشة فعلًا', r.filterRowGone);
  check('⚠️ صف اتشال → رسم كامل', r.removeRenders === 1, r.removeRenders);
  check('⚠️ صف اتضاف → رسم كامل', r.addRenders === 1, r.addRenders);
  check('⚠️ الترتيب اتغيّر → رسم كامل', r.reorderRenders === 1, r.reorderRenders);
  check('⚠️⚠️ المستخدم بيكتب في الخانة → مانلمسهاش', r.focusRenders === 1, r.focusRenders);
  check('شاشة تانية → رسم كامل عادي', r.otherScreenRenders === 1, r.otherScreenRenders);
  check('مفيش فرق → مفيش رسم', r.noChangeRenders === 0, r.noChangeRenders);
  check('⭐ وأول رسمة بعد الفتح كاملة', r.firstRenderIsFull === 1, r.firstRenderIsFull);
  check('⭐⭐ الاستخدام الحقيقي (بمكدس تراجع): مفيش رسم كامل', r.realUseRenders === 0, r.realUseRenders);
  check('⭐ والرقم صح بعد ٥ تعديلات', r.realUseValue === '10', r.realUseValue);
  check('⭐ وعنوان التراجع اتحدّث معاه', /9 ← 10/.test(r.realUseUndoTitle || ''), r.realUseUndoTitle);
  check('⚠️ وزرار التراجع لما يظهر من العدم → رسم كامل', r.undoAppearsRenders === 1, r.undoAppearsRenders);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
