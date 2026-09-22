// ============================================================
// 🧾 السجل لازم يقول **فين** و**من أنهي مجموعة**
// ============================================================
// اتبلّغ التنين بالنص:
//
//  ١) "لما بيجي اشعار بيجي ب اسم الفئة فقط يعني انا لو طالب من
//     مجموعة معينه في فئة معينه مش بيجيلي اسمها وبردوا مش بيظهر
//     في سجل العمليات"
//
//  ٢) "في سجل العمليات انا عاوز لما حد يطبع يكتب هو طبع علي انهي
//     طابعة يعني انهي جهاز تم ارسال اليه امر الطباعة"
//
// ⚠️⚠️ والاتنين نفس النوع من العطل: العملية بتتسجّل، بس **ناقصها
// الحتة اللي بتخلّيها مفيدة**. "كريب — 56" في محل فيه نفس الرقم في
// تلات مجموعات مابتوصّلش لحاجة، و"طبع ملصق صنف" في محل فيه تلات
// كمبيوترات مابتقولش الورقة خرجت منين.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 220)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 420, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof logPrintJob === 'function' && typeof activityEntryParts === 'function');

  // ============================================================
  // ⭐⭐⭐⭐⭐ الطبعة: راحت لأنهي جهاز وأنهي طابعة
  // ============================================================
  const r = await p.evaluate(async () => {
    const out = {};
    const logged = [];
    window.logActivity = (d) => { logged.push(d); };

    state.user = { uid: 'me' };
    state.profile = { id: 'me', name: 'عبدالله', role: 'owner' };
    saveDeviceName('كمبيوتر الكاشير');
    saveSelectedPrinter('label', 'XP-235B');
    saveSelectedPrinter('restock', 'XP-80C');

    // جهاز تاني منشور في السحابة بطابعاته
    state.printStations = [
      { id: 'dev2', deviceName: 'كمبيوتر المخزن', labelPrinter: 'Zebra-A', restockPrinter: 'Epson-B' },
    ];

    const spec = { kind: 'item', cat: { id: 'c1', name: 'كريب', itemName: 'بندانه سوري' }, copies: 3 };
    const size = { pageWidthMm: 38, pageHeightMm: 25 };

    logged.length = 0;
    logPrintJob('label', spec, size, 'local');
    out.local = logged[0] || null;

    logged.length = 0;
    logPrintJob('label', spec, size, 'dev2');
    out.remote = logged[0] || null;

    // ورقة التزويد على جهاز تاني — لازم تاخد **طابعة الورقة** مش الملصق
    logged.length = 0;
    logPrintJob('restock', { kind: 'restock', text: 'كريب — بيجات', cat: { id: 'c1', name: 'كريب' }, copies: 1 }, size, 'dev2');
    out.sheet = logged[0] || null;

    // ⚠️ والنداء القديم (من غير جهاز) مايوقعش
    logged.length = 0;
    logPrintJob('label', spec, size);
    out.noTarget = logged[0] || null;
    return out;
  });

  check('⭐⭐⭐⭐ الطبعة المحلية بتسجّل اسم الجهاز وطابعته',
    r.local && r.local.printDevice === 'كمبيوتر الكاشير' && r.local.printPrinter === 'XP-235B', r.local);
  check('⭐⭐⭐ ومعلّمة إنها **مش** لجهاز تاني', r.local && r.local.printRemote === false, r.local);

  check('⭐⭐⭐⭐⭐ والطبعة لجهاز تاني بتسجّل **اسمه هو وطابعته هو**',
    r.remote && r.remote.printDevice === 'كمبيوتر المخزن' && r.remote.printPrinter === 'Zebra-A', r.remote);
  check('⭐⭐⭐ ومعلّمة إنها اتبعتت', r.remote && r.remote.printRemote === true, r.remote);

  // ⚠️⚠️ ورقة التزويد بتروح لطابعة تانية غير الملصق. لو خدت طابعة
  // الملصق، السجل هيقول اسم ماكينة الواحد بيدوّر فيها على ورقة مش
  // موجودة عندها أصلًا.
  check('⭐⭐⭐⭐⭐ وورقة التزويد بتاخد **طابعة الورقة** مش الملصق',
    r.sheet && r.sheet.printPrinter === 'Epson-B', r.sheet);

  check('⭐⭐⭐ والنداء من غير جهاز مايوقعش', r.noTarget !== null, r.noTarget);

  // ⚠️ والسطر في الشاشة لازم يعرض الكلام ده فعلًا — التسجيل لوحده
  // مايفيدش لو مش باين.
  const rows = await p.evaluate(() => ({
    local: activityEntryParts({ action: 'print', printLabel: 'ملصق صنف', itemName: 'بندانه', newValue: 3,
      printDevice: 'كمبيوتر الكاشير', printPrinter: 'XP-235B', printRemote: false }).detailLabel,
    remote: activityEntryParts({ action: 'print', printLabel: 'ملصق صنف', itemName: 'بندانه', newValue: 3,
      printDevice: 'كمبيوتر المخزن', printPrinter: 'Zebra-A', printRemote: true }).detailLabel,
    // ⚠️⚠️ العمليات **القديمة** (اتسجّلت قبل التحديث) مافيهاش الحقول
    // دي. لازم تفضل زي ما هي بالظبط — مش "غير معروف" ولا سهم فاضي.
    old: activityEntryParts({ action: 'print', printLabel: 'ملصق صنف', itemName: 'بندانه', newValue: 3 }).detailLabel,
  }));
  check('⭐⭐⭐⭐ السطر بيعرض الجهاز والطابعة',
    /كمبيوتر الكاشير/.test(rows.local) && /XP-235B/.test(rows.local), rows.local);
  check('⭐⭐⭐ واللي اتبعت لجهاز تاني عليه سهم', /←/.test(rows.remote), rows.remote);
  check('⭐⭐⭐⭐ والعمليات القديمة زي ما هي بالحرف',
    rows.old === 'ملصق صنف — 3 ملصق', rows.old);

  // ============================================================
  // ⭐⭐⭐⭐⭐ المجموعة: في السجل وفي الإشعار
  // ============================================================
  // ⚠️⚠️ اتبلّغ **مرتين**. أول مرة ضفتها في "طلب تزويد" بس، ورجع قال
  // "وبردوا السجل مش جايب اسم المجموعة" — وكان صح: أغلب اللي في السجل
  // **تعديل كميات** مش طلبات تزويد. فالمجموعة بقت في **عنوان** السطر،
  // يعني كل عملية على درجة بتورّيها.
  const g = await p.evaluate(() => {
    const mk = (extra) => activityEntryParts({
      categoryName: 'بونيه حجاب', gradeNumber: '9', ...extra,
    });
    return {
      edit: mk({ action: 'edit', field: 'branchQty', oldValue: 0, newValue: 1, gradeGroup: 'بيجات' }).itemLabel,
      editNoGroup: mk({ action: 'edit', field: 'branchQty', oldValue: 0, newValue: 1 }).itemLabel,
      request: mk({ action: 'request_shortage', gradeGroup: 'بيجات' }).itemLabel,
      fulfill: mk({ action: 'fulfill_shortage', transferredQty: 3, gradeGroup: 'بندانة' }).itemLabel,
    };
  });
  // ⚠️ ده اللي في صورته بالظبط: "بونيه حجاب — درجة 9" من غير مجموعة.
  check('⭐⭐⭐⭐⭐ تعديل الكمية بيقول المجموعة كمان',
    g.edit === 'بونيه حجاب · بيجات — درجة 9', g.edit);
  check('⭐⭐⭐⭐ وطلب التزويد', g.request === 'بونيه حجاب · بيجات — درجة 9', g.request);
  check('⭐⭐⭐⭐ والتزويد', g.fulfill === 'بونيه حجاب · بندانة — درجة 9', g.fulfill);
  // ⚠️ والعمليات القديمة (مافيهاش الحقل) زي ما هي بالحرف.
  check('⭐⭐⭐⭐ واللي مالهاش مجموعة زي ما هي بالحرف',
    g.editNoGroup === 'بونيه حجاب — درجة 9', g.editNoGroup);

  // ============================================================
  // ⭐⭐⭐⭐⭐ الحارس الحقيقي: **كل** نداء فيه درجة فيه مجموعة
  // ============================================================
  // ⚠️⚠️ ده اللي منع التكرار: أول إصلاح غطّى نداء واحد بس من تمانية،
  // والباقي فضل ناقص. الفحص ده بيقرا js/app.js ويتأكد إن كل نداء
  // logActivity فيه gradeNumber فيه gradeGroup كمان — فأي عملية
  // جديدة تتنسي هتقع هنا مش على المستخدم.
  const src = await p.evaluate(async () => (await (await fetch('/js/app.js')).text()));
  const calls = src.match(/logActivity\(\{[\s\S]*?\n\s*\}\)/g) || [];
  const withGrade = calls.filter((c) => /gradeNumber:/.test(c));
  const missing = withGrade.filter((c) => !/gradeGroup:/.test(c));
  check('⭐⭐⭐⭐⭐ كل عملية على درجة بتسجّل المجموعة',
    withGrade.length >= 8 && missing.length === 0,
    { total: withGrade.length, missing: missing.map((c) => (c.match(/action: '([^']+)'/) || [])[1]) });

  // ⚠️⚠️ والإشعار: "كريب 56" مابتقولش المكان. "كريب بيجات 56" بتقول.
  const notif = await p.evaluate(() => {
    state.categories = [{ id: 'c1', name: 'كريب' }];
    const mk = (g) => {
      const cat = (state.categories || []).find((c) => c.id === 'c1');
      const grade = g.isBase ? g.name || 'أساسية' : g.number;
      const group = String(g.group || '').trim();
      return (cat ? cat.name + ' ' : '') + (group ? group + ' ' : '') + grade;
    };
    return {
      grouped: mk({ number: '56', group: 'بيجات' }),
      plain: mk({ number: '56' }),
    };
  });
  check('⭐⭐⭐⭐ اسم الإشعار فيه المجموعة', notif.grouped === 'كريب بيجات 56', notif);
  check('⭐⭐⭐ واللي من غير مجموعة زي ما كان', notif.plain === 'كريب 56', notif);

  // ⚠️ والحارس الحقيقي: الكود اللي في notify.js نفسه بيحط المجموعة.
  const notifySrc = await p.evaluate(async () => (await (await fetch('/js/notify.js')).text()));
  check('⭐⭐⭐⭐⭐ وnotify.js فعلًا بيقرا g.group',
    /group \? group \+ ' ' : ''/.test(notifySrc), null);

  // ============================================================
  // ⭐⭐ الحذف الجماعي كان بيطلع في السجل **باسمه الخام**
  // ============================================================
  // نفس اللي حصل مع التراجع بالظبط: العملية بتتسجّل ومفيش حد بيرسم
  // سطرها، فبتقع على شبكة الأمان اللي بتكتب اسم العملية زي ما هو.
  // اتلقت وإحنا بنشتغل على "حذف المجموعة بدرجاتها".
  const bulk = await p.evaluate(() => ({
    group: activityEntryParts({
      action: 'delete_grade_bulk', categoryName: 'كريب', gradeGroup: 'كيوي',
      newValue: 3, oldValue: 'درجة 2، درجة 3، أبيض',
    }),
    plain: activityEntryParts({
      action: 'delete_grade_bulk', categoryName: 'كريب',
      newValue: 5, oldValue: 'درجة 1، درجة 2',
    }),
  }));
  check('⭐⭐⭐ حذف المجموعة مابقاش اسم خام في السجل',
    bulk.group.detailLabel.indexOf('delete_grade_bulk') === -1, bulk.group);
  check('⭐⭐ وبيقول إنها مجموعة بدرجاتها والعدد',
    /المجموعة بدرجاتها/.test(bulk.group.detailLabel) && /3 درجة/.test(bulk.group.detailLabel), bulk.group);
  check('⭐ واسم المجموعة في عنوان السطر', bulk.group.itemLabel.indexOf('كيوي') !== -1, bulk.group);
  check('⭐⭐ والحذف الجماعي العادي (من غير مجموعة) مقروء كمان',
    /حذف 5 درجة/.test(bulk.plain.detailLabel) &&
    bulk.plain.detailLabel.indexOf('delete_grade_bulk') === -1, bulk.plain);

  check('⭐ مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  console.log(pass.map((x) => '   ✓ ' + x).join('\n'));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    console.log(fail.map((x) => '   ✗ ' + x).join('\n'));
    process.exit(1);
  }
  console.log(`\nكل الفحوص نجحت (${pass.length}).`);
})();
