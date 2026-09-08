// نطاق الحساب: الفئات، تاريخ آخر طبعة، وأسماء الحساب المشترك
// ============================================================
// تلات حاجات اتطلبوا مع بعض:
//
//   ١) "اخر مرة اتطبعت" تبقى **مفتاح في الحساب** مقفول، وتتفتح لحساب
//      بعينه — بدل مفتاح إعدادات الطابعة اللي كان بيفتحها للكل.
//   ٢) أسماء اللي شغّالين على الحساب المشترك تروح السحابة وتتقرا منها.
//   ٣) تقييد **تعديل الكميات** على فئات معيّنة.
//
// ⚠️⚠️ أخطر حاجة في الملف ده كله: **قايمة الفئات الفاضية = كل الفئات.**
// لو الاتجاه اتقلب، كل حساب في النظام (ولا واحد فيهم عنده الحقل ده)
// هيتقفل عليه تعديل الكميات أول ما التحديث ينزل. أول فحصين تحت عن
// النقطة دي بالذات.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() =>
    typeof canEditCategory === 'function' && typeof publishOperatorName === 'function');

  const r = await p.evaluate(async () => {
    const out = {};

    // ============================================================
    // ٣) الفئات — القاعدة نفسها
    // ============================================================
    // ⚠️⚠️ الحسابات الموجودة دلوقتي مالهاش الحقل ده خالص. لو الفحصين
    // دول وقعوا، معناها إن التحديث هيقفل التعديل على كل الموظفين.
    out.absentMeansAll = canEditCategory({ role: 'user' }, 'c1');
    out.emptyMeansAll = canEditCategory({ role: 'user', categoryAccess: [] }, 'c1');

    out.pickedAllowed = canEditCategory({ role: 'user', categoryAccess: ['c1', 'c2'] }, 'c1');
    out.otherBlocked = canEditCategory({ role: 'user', categoryAccess: ['c1', 'c2'] }, 'c9');
    // ⚠️ فئة من غير رقم مع قايمة محدّدة = مرفوضة، مش "عدّي".
    out.noIdBlocked = !canEditCategory({ role: 'user', categoryAccess: ['c1'] }, '');
    out.noProfileBlocked = !canEditCategory(null, 'c1');
    // ⚠️ قيمة بايظة (مش مصفوفة) لازم ترجع "الكل" مش تقع
    out.junkMeansAll = canEditCategory({ role: 'user', categoryAccess: 'كلام' }, 'c1');

    // ============================================================
    // الأزرار على الشاشة
    // ============================================================
    state.categories = [
      { id: 'c1', name: 'شيفون' },
      { id: 'c2', name: 'قطن' },
      { id: 'c9', name: 'حرير' },
    ];
    state.grades = [{ id: 'g1', number: 1, branchQty: 5, mainQty: 5, status: 'normal' }];
    state.activeCategoryId = 'c1';

    // حساب بيعدّل الكميات في كل الفئات
    state.profile = { name: 'محمد', role: 'warehouse_keeper', warehouseAccess: 'both' };
    const openHTML = gradeTableHTML();
    // ⚠️⚠️ الزرار بيتعرف من class="qty-btn" (والقراءة-فقط من
    // class="qty-readonly"). أول نسخة من الفحص كانت بتدوّر على
    // `data-qty` — اسم **مش موجود أصلًا** — فكانت بتلاقيه ناقص في
    // الحالتين وتعدّي. الفحص ده بالذات (إنه موجود وهو مفتوح) هو اللي
    // مسك الغلطة، فمتشلوش.
    out.qtyBtnExists = openHTML.indexOf('class="qty-btn"') !== -1;

    // نفس الحساب بس مقصور على c2 → الفئة المفتوحة (c1) مقفولة عليه
    state.profile = { name: 'محمد', role: 'warehouse_keeper', warehouseAccess: 'both', categoryAccess: ['c2'] };
    const shutHTML = gradeTableHTML();
    out.qtyBtnGone = shutHTML.indexOf('class="qty-btn"') === -1;
    // ⚠️ الرقم لازم يفضل **ظاهر** — الفئة بتتقفل عن التعديل، مش عن
    // الشوف. الجدول بيرجّع <td> فيه الرقم من غير أي class.
    out.numberStillThere = /<td>5<\/td>/.test(shutHTML);

    // ⚠️⚠️ **ومسار الموبايل كمان** — الشاشة على التليفون بترسم كروت
    // (gradeCardsHTML) مش جدول، وده مسار كود **تاني خالص** بدالة
    // قراءة-فقط مختلفة (qty-readonly). لو اتفحص الجدول بس، ممكن
    // الأزرار تفضل شغّالة على التليفون وإحنا فاكرين إنها اتقفلت —
    // وهو الجهاز اللي الشغل بيتعمل منه أصلًا.
    const realNarrow = state.isNarrow;
    state.isNarrow = true;
    const shutCards = gradeTableHTML();
    out.cardsBtnGone = shutCards.indexOf('class="qty-btn"') === -1;
    out.cardsReadonly = shutCards.indexOf('class="qty-readonly"') !== -1;
    state.profile = { name: 'محمد', role: 'warehouse_keeper', warehouseAccess: 'both' };
    out.cardsBtnBackWhenOpen = gradeTableHTML().indexOf('class="qty-btn"') !== -1;
    state.profile = { name: 'محمد', role: 'warehouse_keeper', warehouseAccess: 'both', categoryAccess: ['c2'] };
    state.isNarrow = realNarrow;

    // ولو فتحنا الفئة المسموح بيها → الأزرار ترجع
    state.activeCategoryId = 'c2';
    out.qtyBtnBackOnAllowed = gradeTableHTML().indexOf('class="qty-btn"') !== -1;
    state.activeCategoryId = 'c1';

    // ============================================================
    // ⚠️⚠️ الباب التاني: الكتابة نفسها
    // ============================================================
    // إخفاء الزرار **مش** كفاية — الماسح والكتابة اليدوية بيوصلوا
    // لـapplyQuantityChange من غير ما يعدّوا على الزرار.
    // ⚠️ بنركّب `db` مقلّد **قبل** فحص الكتابة: applyQuantityChange
    // بتنده logActivity اللي بيكتب في السحابة، وبعدين نستخدم نفس المقلّد
    // في فحص الأسماء تحت عشان نعدّ الكتابات بمسارها.
    const writes = [];
    const realDb = window.db;
    window.db = {
      collection: (c) => ({
        doc: () => ({
          collection: (c2) => ({ doc: () => ({ set: () => { writes.push(c + '/' + c2); return Promise.resolve(); } }) }),
          set: () => { writes.push(c); return Promise.resolve(); },
          update: () => { writes.push(c); return Promise.resolve(); },
        }),
        add: () => { writes.push(c); return Promise.resolve(); },
      }),
    };

    state.user = { uid: 'u1' };

    let wrote = 0;
    const realRefOf = window.gradeRefOf;
    window.gradeRefOf = () => { wrote++; return { update: () => Promise.resolve() }; };
    const realAlert = window.alert;
    let alerted = '';
    window.alert = (m) => { alerted = String(m); };

    await applyQuantityChange('c1', 'g1', { branchQty: 5, mainQty: 5 }, 'branchQty', 5, 6);
    out.blockedWriteCount = wrote;
    out.blockedTold = alerted.indexOf('شيفون') !== -1;

    wrote = 0;
    await applyQuantityChange('c2', 'g1', { branchQty: 5, mainQty: 5 }, 'branchQty', 5, 6);
    out.allowedWriteCount = wrote;

    // والحساب اللي مالوش قايمة بيكتب في أي فئة
    state.profile = { name: 'محمد', role: 'warehouse_keeper', warehouseAccess: 'both' };
    wrote = 0;
    await applyQuantityChange('c9', 'g1', { branchQty: 5, mainQty: 5 }, 'branchQty', 5, 6);
    out.unscopedWriteCount = wrote;

    window.gradeRefOf = realRefOf;
    window.alert = realAlert;

    // ============================================================
    // ١) تاريخ آخر طبعة = مفتاح في الحساب
    // ============================================================
    // ⚠️ مقفول لكل الرتب غير منشئ النظام — ده المطلوب بالنص
    // ("هي هتبقي مقفوله وانا افتحها ل اي حساب انا عاوزه").
    out.rolesWithDate = ['owner', 'admin', 'branch_manager', 'supervisor',
      'warehouse_keeper', 'print_operator', 'user']
      .filter((role) => can({ role }, 'seeRestockLastPrint'));
    // ومفتوح لشخص بعينه من غير ما رتبته تتغيّر
    out.perUserOpens = can({ role: 'user', perms: { seeRestockLastPrint: true } }, 'seeRestockLastPrint');
    // والمفتاح موجود في قايمة الشاشة (وإلا مافيش طريقة تفتحه أصلًا)
    out.inPermissionList = ALL_PERMISSIONS.indexOf('seeRestockLastPrint') !== -1;

    // ============================================================
    // ٢) أسماء الحساب المشترك — ورفعها للسحابة
    // ============================================================
    // ⚠️⚠️ السؤال اللي اتسأل بالنص: "هل ده هيزود النداء في سجل
    // العمليات او اي شئ". الفحص ده بيقيسها: بنعدّ الكتابات **بمسارها**.
    writes.length = 0;
    state.user = { uid: 'u1' };
    const dayKeys = () => Object.keys(localStorage).filter((k) => k.indexOf('tazweed_operator_day_') === 0);
    dayKeys().forEach((k) => localStorage.removeItem(k));

    // حساب **مش** مشترك → مافيش أي رفع
    state.profile = { name: 'حساب', role: 'user' };
    publishOperatorName('محمود', true);
    out.notSharedNoWrite = writes.length;

    // حساب مشترك → كتابة واحدة، في مسار الحساب مش في السجل
    state.profile = { name: 'حساب', role: 'user', sharedAccount: true };
    publishOperatorName('محمود', true);
    out.firstWrite = writes.slice();

    // ⚠️⚠️ تاني نداء في نفس اليوم = **مافيش كتابة**. ده هو اللي بيخلي
    // الميزة مالهاش تكلفة: كتابة واحدة في اليوم لكل شخص، مش مع كل حركة.
    publishOperatorName('محمود', false);
    publishOperatorName('محمود', false);
    publishOperatorName('محمود', false);
    out.afterRepeats = writes.length;

    // بس لو هو نفسه غيّر اسمه (force) بتتكتب على طول
    publishOperatorName('محمود', true);
    out.afterForce = writes.length;

    // ⚠️ ولا كتابة واحدة راحت لسجل العمليات
    out.touchedActivityLog = writes.filter((w) => w.indexOf('activityLog') !== -1).length;

    // اسم فيه حروف فايرستور مابيقبلهاش في رقم الوثيقة
    out.docIdClean = operatorDocId('a/b.c#d$e[f]');
    out.docIdKeepsArabic = operatorDocId('  محمود  ');
    out.emptyNameNoWrite = (() => {
      const before = writes.length;
      publishOperatorName('   ', true);
      return writes.length === before;
    })();

    window.db = realDb;

    // ============================================================
    // ⚠️⚠️ النسخة المحفوظة على الجهاز (الشغل بدون نت)
    // ============================================================
    // saveProfileLocally بتحفظ **حقول مختارة** بس. لو الحقل ده مش
    // فيهم، الحساب المقصور بيرجع "كل الفئات" وهو أوفلاين (القايمة
    // الفاضية = الكل)، فيعدّل كميات في فئة مقفولة عليه — والتعديل
    // يترفض من السحابة **في صمت** لما النت يرجع.
    saveProfileLocally('u7', { name: 'س', role: 'user', categoryAccess: ['c1', 'c2'] });
    const cached = loadProfileLocally('u7');
    out.cacheKeepsScope = JSON.stringify((cached || {}).categoryAccess) === JSON.stringify(['c1', 'c2']);
    out.cachedBlocks = !canEditCategory(cached, 'c9') && canEditCategory(cached, 'c1');

    // ============================================================
    // شاشة الحسابات — الخانات موجودة ومربوطة
    // ============================================================
    state.users = [{ id: 'u9', name: 'سيد', role: 'user', categoryAccess: ['c1'] }];
    state.profile = { name: 'عبدالله', role: 'owner' };
    const card = userCardsHTML(state.users, 'me');
    out.cardShowsScope = card.indexOf('فئة بس') !== -1;
    // ⚠️ الحساب اللي مالوش تقييد مالوش شريحة — الشريحة معناها "مقصور"
    out.cardNoScopeNoBadge =
      userCardsHTML([{ id: 'u8', name: 'علي', role: 'user' }], 'me').indexOf('فئة بس') === -1;

    const box = categoryAccessHTML({ categoryAccess: ['c2'] });
    out.listHasAllCats = ['شيفون', 'قطن', 'حرير'].every((n) => box.indexOf(n) !== -1);
    // ⚠️ لازم **class="..."** كاملة: الصيغة الفضفاضة بتمسك التنسيقات
    // وترجّع نتيجة كاذبة — غلطة اتكررت في تلات فحوص قبل كده.
    out.checkedOnlyPicked =
      (box.match(/data-cat-access="c2" checked/) || []).length === 1 &&
      box.indexOf('data-cat-access="c1" checked') === -1;
    out.hasSearch = box.indexOf('id="eu-cat-search"') !== -1;
    out.hasSelectAll = box.indexOf('id="eu-cat-all"') !== -1;

    return out;
  });

  // ---------- ⚠️⚠️ القاعدة اللي لو اتقلبت النظام كله بيقف ----------
  check('⭐⭐⭐ حساب من غير الحقل خالص = كل الفئات مفتوحة', r.absentMeansAll);
  check('⭐⭐⭐ وقايمة فاضية = كل الفئات كمان', r.emptyMeansAll);
  check('⭐⭐ وقيمة بايظة = الكل، مش وقوع', r.junkMeansAll);

  check('⭐ الفئة المعلّم عليها مفتوحة', r.pickedAllowed);
  check('⭐⭐ واللي مش معلّم عليها مقفولة', !r.otherBlocked);
  check('⚠️ فئة من غير رقم مع قايمة محدّدة = مرفوضة', r.noIdBlocked);
  check('⚠️ من غير حساب = مرفوض', r.noProfileBlocked);

  check('⚠️ (تحقّق) زرار الكمية بيتعرف فعلًا في الحالة المفتوحة', r.qtyBtnExists);
  check('⭐⭐ الأزرار بتختفي في الفئة المقفولة', r.qtyBtnGone);
  check('⭐ وبترجع في الفئة المسموح بيها', r.qtyBtnBackOnAllowed);
  check('⭐ والرقم بيفضل ظاهر للقراءة في الجدول', r.numberStillThere);
  check('⭐⭐⭐ وعلى **الموبايل** كمان الأزرار بتختفي', r.cardsBtnGone);
  check('⭐⭐ والكارت بيوري الرقم للقراءة', r.cardsReadonly);
  check('⚠️ (تحقّق) وبترجع على الموبايل لما تكون مفتوحة', r.cardsBtnBackWhenOpen);

  check('⭐⭐⭐ الكتابة نفسها بترفض في الفئة المقفولة', r.blockedWriteCount === 0, r.blockedWriteCount);
  check('⭐⭐ والمستخدم بيتقاله اسم الفئة', r.blockedTold);
  check('⭐ والكتابة بتعدّي في الفئة المسموح بيها', r.allowedWriteCount === 1, r.allowedWriteCount);
  check('⭐⭐ والحساب اللي مالوش قايمة بيكتب في أي فئة', r.unscopedWriteCount === 1, r.unscopedWriteCount);

  check('⭐⭐⭐ تاريخ آخر طبعة مقفول لكل الرتب غير منشئ النظام',
    JSON.stringify(r.rolesWithDate) === JSON.stringify(['owner', 'admin']), r.rolesWithDate);
  check('⭐⭐ وبيتفتح لحساب بعينه من غير ما رتبته تتغيّر', r.perUserOpens);
  check('⭐ والمفتاح ظاهر في قايمة المفاتيح', r.inPermissionList);

  check('⭐⭐ الحساب المش مشترك مابيرفعش أي اسم', r.notSharedNoWrite === 0, r.notSharedNoWrite);
  check('⭐⭐ والمشترك بيرفعه تحت الحساب نفسه',
    JSON.stringify(r.firstWrite) === JSON.stringify(['users/operators']), r.firstWrite);
  check('⭐⭐⭐ وتاني نداء في نفس اليوم مابيكتبش (كتابة واحدة في اليوم)',
    r.afterRepeats === 1, r.afterRepeats);
  check('⭐ بس تغيير الاسم بيكتب على طول', r.afterForce === 2, r.afterForce);
  check('⭐⭐⭐ ولا كتابة واحدة راحت لسجل العمليات', r.touchedActivityLog === 0, r.touchedActivityLog);
  check('⚠️ الحروف الممنوعة في رقم الوثيقة بتتشال', r.docIdClean === 'a_b_c_d_e_f_', r.docIdClean);
  check('⚠️ والعربي بيفضل زي ما هو', r.docIdKeepsArabic === 'محمود', r.docIdKeepsArabic);
  check('⚠️ واسم فاضي مابيكتبش', r.emptyNameNoWrite);

  check('⭐⭐⭐ النسخة المحفوظة على الجهاز بتحتفظ بقايمة الفئات', r.cacheKeepsScope);
  check('⭐⭐ فالحساب المقصور بيفضل مقصور وهو أوفلاين', r.cachedBlocks);
  check('⭐ كارت الحساب المقصور بيوري إنه مقصور', r.cardShowsScope);
  check('⚠️ والحساب المفتوح مالوش شريحة', r.cardNoScopeNoBadge);
  check('⭐ قايمة الفئات فيها كل الفئات', r.listHasAllCats);
  check('⭐⭐ والمعلّم عليه هو اللي معلّم بس', r.checkedOnlyPicked);
  check('⭐ ومعاها بحث', r.hasSearch);
  check('⭐ وزرار علّم الكل', r.hasSelectAll);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
