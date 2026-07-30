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
};

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'tazweed-test',
    // بنحط معرّف حقيقي مكان المكان الفاضي عشان نتأكد إن آلية الحماية
    // نفسها شغالة — مش بس إنها "مش بتفشل".
    firestore: {
      rules: fs.readFileSync('/home/user/tazweed-system/firestore.rules', 'utf8')
        .replace('REPLACE_WITH_OWNER_UID', 'owner'),
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

  await env.cleanup();
  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach((x) => console.log('   ' + x)); }
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
