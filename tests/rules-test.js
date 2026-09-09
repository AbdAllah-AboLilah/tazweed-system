// اختبار قواعد الأمان على المحاكي — بنجرّب كل رتبة تعمل كل عملية
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');

const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${x}` : ''));

const PROFILES = {
  owner:      { name: 'صاحب المحل', role: 'owner' },
  branchMgr:  { name: 'مدير فرع', role: 'branch_manager' },
  supervisor: { name: 'مشرف', role: 'supervisor' },
  branchKeep: { name: 'أمين فرع', role: 'warehouse_keeper', warehouseAccess: 'branch' },
  mainKeep:   { name: 'أمين رئيسي', role: 'warehouse_keeper', warehouseAccess: 'main' },
  printer:    { name: 'موظف طباعة', role: 'print_operator' },
  plain:      { name: 'مستخدم', role: 'user' },
  // استثناء لشخص واحد: مشرف اتفتحله الحذف
  supDelete:  { name: 'مشرف بحذف', role: 'supervisor', perms: { deleteGrades: true } },
  // استثناء بقفل: أمين فرع اتقفل عليه إضافة الدرجات
  keepNoAdd:  { name: 'أمين مقفول', role: 'warehouse_keeper', warehouseAccess: 'branch', perms: { addGrades: false } },
  // مدير فرع اتفتحله مفتاح إدارة الحسابات — ده أخطر حالة: عنده صلاحية
  // على الحسابات، والمفروض برضه مايقدرش يلمس حساب منشئ النظام.
  mgrUsers:   { name: 'مدير بحسابات', role: 'branch_manager', perms: { manageUsers: true } },
  // ⭐ أمين فرع **مقصور على فئات معيّنة** — c9 بس، يعني c1 مقفولة عليه.
  scoped:     { name: 'أمين بفئات', role: 'warehouse_keeper', warehouseAccess: 'both', categoryAccess: ['c9'] },
  // ونفس الحساب بس القايمة فاضية = كل الفئات (زي كل الحسابات القديمة)
  scopedAll:  { name: 'أمين بقايمة فاضية', role: 'warehouse_keeper', warehouseAccess: 'both', categoryAccess: [] },
  // ⭐ حساب اتفتحله تاريخ آخر طبعة بالاسم
  seesDate:   { name: 'بيشوف التاريخ', role: 'user', perms: { seeRestockLastPrint: true } },
};

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'tazweed-test',
    // بنحط معرّف حقيقي مكان المكان الفاضي عشان نتأكد إن آلية الحماية
    // نفسها شغالة — مش بس إنها "مش بتفشل".
    firestore: {
      // بنستبدل المعرّف الحقيقي بحساب الاختبار — بالتعبير النمطي مش بنص
      // ثابت، عشان الاختبار مايتكسرش لو المعرّف اتغيّر يوم ما.
      rules: fs.readFileSync('/home/user/tazweed-system/firestore.rules', 'utf8')
        .replace(/(function ownerUid\(\)\s*\{\s*return\s*')[^']*(')/, '$1owner$2'),
      host: '127.0.0.1', port: 8080,
    },
  });

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, p] of Object.entries(PROFILES)) await db.collection('users').doc(uid).set(p);
    await db.collection('categories').doc('c1').set({ name: 'كريب', order: 1 });
    await db.collection('categories').doc('c1').collection('grades').doc('g1')
      .set({ number: 1, branchQty: 5, mainQty: 5, status: 'normal' });
    await db.collection('products').doc('meta').set({ count: 0 });
  });

  const as = (uid) => env.authenticatedContext(uid).firestore();
  const grade = (uid) => as(uid).collection('categories').doc('c1').collection('grades').doc('g1');
  const cat = (uid) => as(uid).collection('categories').doc('c1');

  // ⚠️ لازم نرجّع البيانات لأصلها قبل **كل** فحص:
  //   • فحص الحذف بيمسح الدرجة، فاللي بعده كان بيعدّل على مستند مش موجود
  //   • وكتابة نفس القيمة الموجودة = "كتابة فاضية" بتعدّي من أي قاعدة
  //     لأن قايمة الحقول المتغيّرة بتطلع فاضية
  // الاتنين دول خلّوا 5 فحوصات تكذب علينا في أول تشغيلة.
  let seq = 0;
  const reset = async () => {
    seq++;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('categories').doc('c1').set({ name: 'كريب', order: 1, minQty: 1 });
      await db.collection('categories').doc('c1').collection('grades').doc('g1')
        .set({ number: 1, branchQty: 5, mainQty: 5, status: 'normal' });
    });
  };

  // ⚠️ القالب بيبدأ الدرجة **"عادي"** دايمًا. فالعمليات اللي شرطها إن
  // الحالة تكون **"معلّق"** (الإلغاء، والتزويد من الرئيسي) مستحيل تعدّي
  // عليه — ومش لأن فيه عطل، لأن السيناريو نفسه مش مكتمل.
  //
  // أول نسخة من الفحوصات دي وقعت للسبب ده بالظبط، وكانت هتخلّيني أدوّر
  // على عطل مش موجود. القالب ده بيحط درجة **معلّقة** فعلًا.
  const resetPending = async (manual) => {
    seq++;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection('categories').doc('c1').set({ name: 'كريب', order: 1, minQty: 1 });
      await db.collection('categories').doc('c1').collection('grades').doc('g1')
        .set({ number: 1, branchQty: 0, mainQty: 5, status: 'pending', requestedQty: 3, manualRequest: manual });
    });
  };

  // زي T بالظبط، بس الدرجة بتبدأ **معلّقة**
  const Tp = async (label, uid, op, shouldPass, manual) => {
    await resetPending(manual !== false);
    let ok;
    try { await (shouldPass ? assertSucceeds(op(uid)) : assertFails(op(uid))); ok = true; }
    catch (e) { ok = false; if (process.env.VERBOSE) console.log('   ↳', label, uid, String(e.message||e).slice(0,180)); }
    check(`${label} — ${PROFILES[uid].name}: ${shouldPass ? 'مسموح' : 'ممنوع'}`, ok);
  };

  const T = async (label, uid, op, shouldPass) => {
    await reset();
    let ok;
    try { await (shouldPass ? assertSucceeds(op(uid)) : assertFails(op(uid))); ok = true; }
    catch (e) { ok = false; if (process.env.VERBOSE) console.log('   ↳', label, uid, String(e.message||e).slice(0,180)); }
    check(`${label} — ${PROFILES[uid].name}: ${shouldPass ? 'مسموح' : 'ممنوع'}`, ok);
  };

  const editBranch = (uid) => grade(uid).update({ branchQty: 7 + seq % 3 });
  const editMain = (uid) => grade(uid).update({ mainQty: 7 + seq % 3 });
  const addGrade = (uid) => as(uid).collection('categories').doc('c1').collection('grades').doc('new_' + uid)
    .set({ number: 99, branchQty: 1, mainQty: 0, status: 'normal' });
  const delGrade = (uid) => as(uid).collection('categories').doc('c1').collection('grades').doc('g1').delete();
  const editCat = (uid) => cat(uid).update({ minQty: 3 + seq % 3 });
  const delCat = (uid) => cat(uid).delete();
  const setGroup = (uid) => grade(uid).update({ group: 'مجموعة' + seq });
  const importProd = (uid) => as(uid).collection('products').doc('chunk_0').set({ index: 0, items: [] });
  const makeUser = (uid) => as(uid).collection('users').doc('brand_new').set({ name: 'x', role: 'user' });
  const demoteOwner = (uid) => as(uid).collection('users').doc('owner').update({ role: 'user' });
  const sendPrint = (uid) => as(uid).collection('printJobs').doc('j_' + uid)
    .set({ type: 'label', targetDeviceId: 'd1', status: 'pending', requestedByUid: uid, html: '<b>x</b>' });

  // ---- كمية الفرع ----
  for (const [u, ok] of [['owner',1],['branchMgr',1],['supervisor',0],['branchKeep',1],['mainKeep',0],['printer',0],['plain',0]])
    await T('كمية الفرع', u, editBranch, !!ok);

  // ---- كمية الرئيسي ----
  for (const [u, ok] of [['owner',1],['branchMgr',1],['supervisor',0],['branchKeep',0],['mainKeep',1],['plain',0]])
    await T('كمية الرئيسي', u, editMain, !!ok);

  // ---- إضافة درجة ----
  for (const [u, ok] of [['owner',1],['branchMgr',1],['supervisor',1],['branchKeep',1],['mainKeep',1],['printer',0],['plain',0],['keepNoAdd',0]])
    await T('إضافة درجة', u, addGrade, !!ok);

  // ---- حذف درجة ----
  for (const [u, ok] of [['branchMgr',1],['supervisor',0],['branchKeep',0],['plain',0],['supDelete',1]])
    await T('حذف درجة', u, delGrade, !!ok);

  // ---- تعديل الفئة / حذفها ----
  for (const [u, ok] of [['owner',1],['branchMgr',1],['supervisor',1],['branchKeep',0],['plain',0]])
    await T('تعديل الفئة', u, editCat, !!ok);
  for (const [u, ok] of [['branchMgr',1],['supervisor',0],['branchKeep',0]])
    await T('حذف الفئة', u, delCat, !!ok);

  // ---- مجموعة اللون على درجة (كتالوج مش كمية) ----
  for (const [u, ok] of [['supervisor',1],['branchKeep',0],['plain',0]])
    await T('مجموعة اللون', u, setGroup, !!ok);

  // ---- استيراد الأصناف ----
  for (const [u, ok] of [['owner',1],['branchMgr',1],['supervisor',0],['branchKeep',0]])
    await T('استيراد الأصناف', u, importProd, !!ok);

  // ---- الحسابات ----
  for (const [u, ok] of [['owner',1],['branchMgr',0],['supervisor',0],['plain',0]])
    await T('إنشاء حساب', u, makeUser, !!ok);

  // ---- ⭐ حماية منشئ النظام ----
  await T('تنزيل رتبة منشئ النظام', 'branchMgr', demoteOwner, false);
  await T('تنزيل رتبة منشئ النظام', 'supervisor', demoteOwner, false);
  // الحالة الحقيقية: حد **معاه** مفتاح إدارة الحسابات
  await T('تنزيل رتبة منشئ النظام', 'mgrUsers', demoteOwner, false);
  await T('حذف حساب منشئ النظام', 'mgrUsers', (u) => as(u).collection('users').doc('owner').delete(), false);
  // لكنه يقدر يدير باقي الحسابات عادي
  await T('تعديل حساب عادي', 'mgrUsers', (u) => as(u).collection('users').doc('plain').update({ name: 'اسم جديد' }), true);
  // ومنشئ النظام نفسه يقدر يعدّل حسابه
  await T('منشئ النظام يعدّل حسابه', 'owner', (u) => as(u).collection('users').doc('owner').update({ name: 'صاحب المحل' }), true);

  // ---- إرسال طباعة لجهاز تاني ----
  for (const [u, ok] of [['owner',1],['supervisor',1],['printer',1],['branchKeep',0],['plain',0]])
    await T('إرسال طباعة', u, sendPrint, !!ok);

  // ---- كتابة بتلمس أكتر من حقل: لازم تتمنع لو مش كل الحقول مسموحة ----
  await T('كمية + حقل كتالوج مع بعض', 'branchKeep',
    (u) => grade(u).update({ branchQty: 9, group: 'حاجة' }), false);
  await T('كمية الفرع + الرئيسي مع بعض', 'branchKeep',
    (u) => grade(u).update({ branchQty: 9, mainQty: 9 }), false);

  // ---- القراءة مفتوحة للكل ----
  await T('قراءة الدرجات', 'plain', (u) => grade(u).get(), true);

  // ---------- إعدادات الطباعة المشتركة ----------
  // دي اللي بتخلّي ضبط الملصق واحد لكل الأجهزة بدل ما يتظبط على كل جهاز.
  const printSettings = (uid) => as(uid).collection('settings').doc('print');
  const writeSettings = (uid) => printSettings(uid).set({ align: { x: 1 + (seq % 3), y: 0, shrink: 0 } }, { merge: true });
  const readSettings = (uid) => printSettings(uid).get();

  await T('كتابة إعدادات الطباعة المشتركة', 'owner', writeSettings, true);
  await T('كتابة إعدادات الطباعة المشتركة', 'branchMgr', writeSettings, false);
  await T('كتابة إعدادات الطباعة المشتركة', 'branchKeep', writeSettings, false);
  await T('كتابة إعدادات الطباعة المشتركة', 'plain', writeSettings, false);
  await T('قراءة إعدادات الطباعة المشتركة', 'plain', readSettings, true);
  await T('قراءة إعدادات الطباعة المشتركة', 'printer', readSettings, true);

  // ============================================================
  // ⭐⭐ الكتابات الحقيقية بعد ما اتضاف `manualRequest`
  // ============================================================
  // ⚠️ الفخ اللي بيتصاد هنا: قواعد الدرجات بتستخدم `onlyChangedKeys`
  // بقايمة **حصرية**. أي حقل جديد بيتكتب مع الحالة **لازم** يتضاف في
  // القايمة، وإلا الكتابة بترفض — **في صمت**: الحالة تفضل زي ما هي
  // والمستخدم مش فاهم ليه طلب التزويد مش بيتسجّل.
  //
  // ده حصل فعلًا قبل كده مع `requestedQty`، والفحوصات دي بتمنع تكراره.
  //
  // 📌 الكتابات دي **منقولة حرف بحرف** من js/app.js — لو اتغيّرت هناك
  //    لازم تتغيّر هنا، وإلا الفحص بيبقى بيجرّب حاجة النظام مابيعملهاش.

  // 1) طلب تزويد بإيد المستخدم (requestShortage) — عدد واحد
  const reqManual = (uid) =>
    grade(uid).update({ status: 'pending', requestedQty: null, manualRequest: true });
  // 2) طلب تزويد بكمية
  const reqManualQty = (uid) =>
    grade(uid).update({ status: 'pending', requestedQty: 3, manualRequest: true });
  // 3) إلغاء الطلب (cancelShortage)
  const cancelReq = (uid) =>
    grade(uid).update({ status: 'normal', requestedQty: null, manualRequest: null });
  // 4) التغيير التلقائي من ناحية الفرع: الكمية نزلت صفر → طلب تلقائي
  const autoPending = (uid) =>
    grade(uid).update({ branchQty: 0, status: 'pending', manualRequest: false });
  // 5) التزويد من الرئيسي (fulfillShortage)
  const fulfill = (uid) =>
    grade(uid).update({ status: 'normal', mainQty: 4, branchQty: 6, requestedQty: null, manualRequest: null });
  // 6) التغيير التلقائي من ناحية الرئيسي
  const autoOut = (uid) =>
    grade(uid).update({ mainQty: 0, status: 'normal', manualRequest: null });
  // 7) قيمة بايظة في الحقل — لازم تترفض
  const badManual = (uid) =>
    grade(uid).update({ status: 'pending', requestedQty: null, manualRequest: 'أيوه' });
  // 8) الشكل القديم (جهاز لسه على نسخة قديمة) لازم يفضل شغّال
  const legacyReq = (uid) => grade(uid).update({ status: 'pending', requestedQty: null });

  await T('⭐⭐ طلب تزويد بإيد المستخدم', 'branchKeep', reqManual, true);
  await T('⭐⭐ طلب تزويد بكمية', 'branchKeep', reqManualQty, true);
  // ⚠️⚠️ الفحص ده **اتقلب** في v0.78.5: الإلغاء بقى ممنوع في الحالة
  // اللي resetPending بيعملها بالظبط (فرع صفر + رئيسي فيه 5) — اتطلب
  // بالنص. الحالة المسموح فيها اتفحصت تحت بكمية في الفرع.
  await Tp('⛔ إلغاء طلب التزويد والفرع صفر (بقى ممنوع)', 'branchKeep', cancelReq, false);
  await T('⭐⭐ الطلب التلقائي (الكمية نزلت صفر)', 'branchKeep', autoPending, true);
  await Tp('⭐⭐ التزويد من الرئيسي (والدرجة معلّقة فعلًا)', 'mainKeep', fulfill, true);
  await T('⭐ التغيير التلقائي من ناحية الرئيسي', 'mainKeep', autoOut, true);
  await T('⭐⭐ الشكل القديم (نسخة قديمة على جهاز)', 'branchKeep', legacyReq, true);

  // ⚠️ والحقل لازم يبقى محمي: قيمة مش bool تترفض
  await T('⭐⭐ قيمة بايظة في manualRequest', 'branchKeep', badManual, false);
  // ومحدش من بره يقدر يلمسها
  await T('⭐ طلب تزويد من مستخدم عادي', 'plain', reqManual, false);
  await T('⭐ وطلب تزويد من موظف الطباعة', 'printer', reqManual, false);
  // وأمين الفرع مايقدرش يعمل عملية الرئيسي
  await Tp('⭐ أمين الفرع مايقدرش يزوّد', 'branchKeep', fulfill, false);

  // ============================================================
  // ⭐ خانة الفئات — تعديل الكميات في فئات معيّنة بس
  // ============================================================
  // ⚠️⚠️ الفحص الأهم هنا هو الأخير: **القايمة الفاضية = كل الفئات**.
  // لو الاتجاه اتقلب، كل حساب في النظام (ولا واحد فيهم عنده الحقل ده)
  // هيتقفل عليه تعديل الكميات أول ما القواعد دي تترفع.
  const setQty = (uid) => grade(uid).update({ branchQty: 7 });
  await T('⭐⭐⭐ الفئة مقفولة عليه → تعديل الكمية ممنوع', 'scoped', setQty, false);
  await T('⭐⭐⭐ والقايمة الفاضية = كل الفئات', 'scopedAll', setQty, true);
  await T('⭐ والحساب اللي مالوش الحقل خالص شغّال زي ما هو', 'branchKeep', setQty, true);

  // والفئة اللي هو متسجّل عليها فعلًا (c9) لازم تعدّي
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('categories').doc('c9').collection('grades').doc('g9')
      .set({ number: 9, branchQty: 5, mainQty: 5, status: 'normal' });
  });
  const scopedOwnCat = async () => {
    let ok;
    try {
      await assertSucceeds(
        as('scoped').collection('categories').doc('c9').collection('grades').doc('g9').update({ branchQty: 8 })
      );
      ok = true;
    } catch (e) { ok = false; }
    check('⭐⭐ والفئة اللي معلّم عليها فعلًا **بتعدّي**', ok);
  };
  await scopedOwnCat();

  // ⚠️ وطلب التزويد كمان مقفول في الفئة المقفولة — التعديل والطلب
  // بيتحركوا مع بعض، مايصحّش يقفل واحد ويسيب التاني.
  await T('⭐⭐ وطلب التزويد كمان ممنوع في الفئة المقفولة', 'scoped',
    (uid) => grade(uid).update({ status: 'pending', requestedQty: null, manualRequest: true }), false);

  // ============================================================
  // ⭐ تاريخ آخر طبعة — القراءة على المفتاح
  // ============================================================
  // ⚠️ إخفاء السطر من الشاشة مش حماية: الحساب المقفول عنده المفتاح كان
  // لسه يقدر يقرا التواريخ من السحابة مباشرة.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('restockPrints').doc('c1').set({ at: '2026-01-01', catName: 'كريب' });
  });
  const readStamp = (uid) => as(uid).collection('restockPrints').doc('c1').get();
  const R = async (label, uid, op, shouldPass) => {
    let ok;
    try { await (shouldPass ? assertSucceeds(op(uid)) : assertFails(op(uid))); ok = true; }
    catch (e) { ok = false; }
    check(`${label} — ${PROFILES[uid].name}: ${shouldPass ? 'مسموح' : 'ممنوع'}`, ok);
  };
  await R('⭐⭐⭐ تاريخ آخر طبعة: القراءة ممنوعة من غير المفتاح', 'plain', readStamp, false);
  await R('⭐⭐ ومسموحة للي المفتاح مفتوح عنده', 'seesDate', readStamp, true);
  await R('⭐ ومنشئ النظام بيقراه', 'owner', readStamp, true);
  // ⚠️ والكتابة سايبة على printRestock: اللي بيطبع بيسجّل الوقت حتى لو
  // مش شايفه — وإلا التاريخ مايتسجّلش أصلًا.
  await R('⭐⭐ واللي بيطبع بيسجّل الوقت حتى لو مش شايفه', 'branchKeep',
    (uid) => as(uid).collection('restockPrints').doc('c1').set({ at: '2026-02-02', catName: 'كريب' }), true);

  // ============================================================
  // ⭐ أسماء الحساب المشترك
  // ============================================================
  // ⚠️⚠️ النقطة الأمنية: الكتابة على **حسابه هو بس**، وفي مسار منفصل
  // تمامًا عن وثيقة الحساب — فمايقدرش يلمس رتبته ولا مفاتيحه من هنا.
  const opDoc = (uid, target) => as(uid).collection('users').doc(target).collection('operators').doc('محمود');
  await R('⭐⭐ بيكتب اسمه على حسابه هو', 'plain',
    (uid) => opDoc(uid, 'plain').set({ name: 'محمود' }), true);
  await R('⭐⭐⭐ ومايقدرش يكتب على حساب حد تاني', 'plain',
    (uid) => opDoc(uid, 'branchKeep').set({ name: 'محمود' }), false);
  await R('⭐⭐⭐ ولا يقدر يرفّع رتبته من المسار ده', 'plain',
    (uid) => opDoc(uid, 'plain').set({ name: 'محمود', role: 'owner' }), true);
  // ⚠️ الفحص اللي فوق **بيعدّي** عن قصد: كتابة كلمة "role" جوه مستند
  // الأسماء مالهاش أي أثر — الرتبة بتتقرا من وثيقة الحساب نفسها. الفحص
  // اللي بعده هو اللي بيثبت ده فعلًا.
  await R('⭐⭐⭐ والرتبة الحقيقية ماتغيّرتش (لسه ممنوع من التعديل)', 'plain',
    (uid) => as(uid).collection('categories').doc('c1').update({ name: 'اتغيّر' }), false);
  await R('⭐ ومنشئ النظام بيقرا الأسامي', 'owner',
    (uid) => as(uid).collection('users').doc('plain').collection('operators').get(), true);

  // ============================================================
  // ⛔ إلغاء طلب التزويد — الحالة الممنوعة
  // ============================================================
  // ⚠️ إخفاء الزرار من الشاشة مش حماية: من غير القاعدة دي، أي حد معاه
  // مفتاح تعديل الفرع يقدر يبعت الإلغاء للسحابة مباشرة.
  const cancelReq2 = (uid) => grade(uid).update({ status: 'normal' });
  const cancelWithQty = (uid) => grade(uid).update({ status: 'normal', requestedQty: null, manualRequest: null });
  // والشكل القديم — لازم ياخد نفس الحارس وإلا بيبقى باب خلفي
  const cancelLegacy = (uid) => grade(uid).update({ status: 'normal', requestedQty: null });

  // الدرجة معلّقة والفرع صفر والرئيسي فيه 5 (ده اللي resetPending بيعمله)
  await Tp('⛔⛔ إلغاء والفرع صفر والرئيسي فيه كمية — أمين الفرع', 'branchKeep', cancelReq2, false);
  await Tp('⛔⛔ ونفس الحاجة بالشكل الكامل', 'branchKeep', cancelWithQty, false);
  await Tp('⛔⛔⛔ والشكل القديم كمان (مش باب خلفي)', 'branchKeep', cancelLegacy, false);
  await Tp('⛔ ومدير الفرع كمان ممنوع', 'branchMgr', cancelReq2, false);
  await Tp('⭐⭐ ومنشئ النظام **بس** اللي بيعدّي', 'owner', cancelReq2, true);

  // ⚠️ (تحقّق) والحالة العادية لازم تفضل شغّالة: فيه كمية في الفرع
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('categories').doc('c1').collection('grades').doc('g1')
      .set({ number: 1, branchQty: 2, mainQty: 5, status: 'pending', requestedQty: null, manualRequest: true });
  });
  const T2 = async (label, uid, op, shouldPass) => {
    let ok;
    try { await (shouldPass ? assertSucceeds(op(uid)) : assertFails(op(uid))); ok = true; }
    catch (e) { ok = false; }
    check(`${label} — ${PROFILES[uid].name}: ${shouldPass ? 'مسموح' : 'ممنوع'}`, ok);
  };
  await T2('⭐⭐⭐ وفيه كمية في الفرع → الإلغاء عادي من غير رجوع لحد', 'branchKeep', cancelReq2, true);

  // والاتنين صفر → مفيش تزويد ممكن، فالإلغاء عادي
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('categories').doc('c1').collection('grades').doc('g1')
      .set({ number: 1, branchQty: 0, mainQty: 0, status: 'pending', requestedQty: null, manualRequest: true });
  });
  await T2('⭐⭐ والاتنين صفر → الإلغاء عادي', 'branchKeep', cancelReq2, true);

  await env.cleanup();
  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach((x) => console.log('   ' + x)); }
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
