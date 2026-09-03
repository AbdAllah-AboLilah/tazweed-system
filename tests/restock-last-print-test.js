// تاريخ آخر طبعة لورقة التزويد + اسم الورقة في سجل العمليات
// ============================================================
// حاجتين اتطلبوا مع بعض، وبيلمسوا نفس مسار الطباعة:
//
//   1) سجل العمليات كان بيكتب "ورقة تزويد" **من غير اسم الورقة** — لأن
//      الورقة كانت بتتنده من غير وصفة (spec) خالص.
//   2) "عاوز وقت اخر مرة اطبع فيه ورقة التزويد ... عشان اعرف الصنف ده
//      بيتزود ولا لا" — لمنشئ النظام بس، ومفتاح يفتحه لباقي الحسابات.
//
// ⚠️⚠️ الفحوصات اللي تحت مكتوبة عشان **تفشل** لو أي حارس اتشال:
//   • لو فرع restock في logPrintJob اتشال → الاسم هيرجع اسم الفاتورة
//     (cat.itemName) مش عنوان الورقة، والفحص بيقارن الاتنين عن قصد.
//   • لو الحجب اتشال → الورقة بتطلع لغير منشئ النظام، والفحص بيقارنها
//     بورقة منشئ النظام من غير تاريخ ولازم يلاقيهم **متطابقين**.
//   • لو stampRestockPrint بقى بـawait → طبعة على نت واقف بتعلّق،
//     والفحص بيرمي وعد مرفوض عن قصد.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

const STAMP = '2026-08-29T09:15:00';   // السبت — تاريخ ثابت محسوب بالإيد

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(
    () => typeof buildRestockHTML === 'function' && typeof logPrintJob === 'function' &&
          typeof restockLogSpec === 'function' && typeof stampRestockPrint === 'function'
  );

  const r = await p.evaluate(async (STAMP) => {
    const out = {};
    const cat = {
      id: 'c1',
      name: 'كريب سادة لوكس',
      // ⚠️ مختلف عن اسم الفئة عن قصد: ده اسم الفاتورة، واللي كان بيتكتب
      // في السجل لو الوصفة عدّت من الفرع العام بدل فرع restock.
      itemName: 'CREPE PLAIN LUX 90x180',
      minQty: 3,
      groups: ['بيجات', 'غوامق'],
    };
    const grades = [
      { id: 'g1', number: '1', group: 'بيجات', branchQty: 5, mainQty: 5, status: 'normal' },
      { id: 'g2', number: '2', group: 'بيجات', branchQty: 0, mainQty: 0, status: 'out' },
      { id: 'g3', number: '3', group: 'غوامق', branchQty: 4, mainQty: 4, status: 'normal' },
    ];

    // ============================================================
    // ١) اسم الورقة في سجل العمليات
    // ============================================================
    out.titleAll = restockSheetTitle(cat, '');
    out.titleGroup = restockSheetTitle(cat, 'بيجات');

    const logged = [];
    const realLog = window.logActivity;
    window.logActivity = (d) => { logged.push(d); };

    logPrintJob('restock', restockLogSpec(cat, 'بيجات', 1), null);
    out.oneEntry = logged.length === 1;
    const e = logged[0] || {};
    out.logName = e.itemName;
    out.logLabel = e.printLabel;
    out.logKind = e.printKind;
    out.logCount = e.newValue;
    out.logCatId = e.categoryId;
    out.logCatName = e.categoryName;
    // ⚠️ الحارس: الاسم لازم يبقى عنوان الورقة، **مش** اسم الفاتورة
    out.logNotInvoiceName = e.itemName !== cat.itemName && String(e.itemName || '').indexOf('CREPE') === -1;

    // كل مجموعة في ورقة → العدد بيقول كام ورقة
    logged.length = 0;
    logPrintJob('restock', restockLogSpec(cat, '', 3), null);
    out.papersCount = (logged[0] || {}).newValue;
    out.papersName = (logged[0] || {}).itemName;

    // ⚠️ السلوك القديم لازم يفضل: ورقة من غير وصفة **لسه بتتسجّل**
    logged.length = 0;
    logPrintJob('restock', null, null);
    out.noSpecStillLogs = logged.length === 1 && (logged[0] || {}).printLabel === 'ورقة تزويد';

    // ⚠️ وأي نوع تاني من غير وصفة لسه **مابيتسجّلش** (زي الأول بالظبط)
    logged.length = 0;
    logPrintJob('label', null, null);
    out.labelNoSpecSilent = logged.length === 0;

    // ⚠️ والملصق العادي ماتخربش: لسه بياخد اسمه من الفئة
    logged.length = 0;
    logPrintJob('label', { kind: 'item', cat, copies: 4 }, null);
    out.itemLabelName = (logged[0] || {}).itemName;
    out.itemLabelCount = (logged[0] || {}).newValue;

    window.logActivity = realLog;

    // ⚠️ ووصفة الورقة **مابتتبنيش تاني** على الجهاز المستقبِل.
    // ⚠️⚠️ **الفحص ده مالوش أسنان النهارده** وده مقصود: من غير الحارس
    // اللي في rebuildFromSpec، الدالة كانت هترجّع null برضه (مافيش فرع
    // بيمسك 'restock'). الفحص هنا عشان لو حد ضاف فرع جديد بالغلط
    // يمسكها، مش عشان يثبت إن الحارس شغّال.
    out.rebuildRefuses = (await rebuildFromSpec(restockLogSpec(cat, '', 1), { widthMm: 38, heightMm: 25 })) === null;

    // ============================================================
    // ٢) تاريخ آخر طبعة — مين يشوفه
    // ============================================================
    const LINE = 'آخر طبعة قبل دي';
    restockPrintStamps = { c1: STAMP };

    // منشئ النظام
    state.profile = { name: 'عبدالله', role: 'owner' };
    setPrintTweak('showRestockDate', false);
    const ownerHTML = buildRestockHTML(cat, grades, '', true);
    out.ownerSees = ownerHTML.indexOf(LINE) !== -1;
    // ⚠️ لازم class="..." كاملة: كلمة last-print موجودة في التنسيقات
    // فوق كمان، والصيغة الفضفاضة كانت بتمسك قاعدة CSS وترجّع فاضي.
    const m = ownerHTML.match(/class="last-print">([^<]*)</);
    out.ownerText = m ? m[1].trim() : '';
    out.ownerHasDay = out.ownerText.indexOf('السبت') !== -1;
    out.ownerHasYear = /٢٠٢٦|2026/.test(out.ownerText);
    // ⚠️⚠️ تاريخ **مطلق** مش نسبي: النسبي بيتغيّر لوحده كل دقيقة
    // وبيكسر patchQuantitiesOnly. فمفيش "من ساعة" ولا "منذ".
    out.notRelative = !/من\s+\d|منذ|قبل\s+\d|قبل\s+[٠-٩]/.test(out.ownerText);

    // حساب عادي والمفتاح مقفول → **مايشوفش**
    state.profile = { name: 'محمد', role: 'user' };
    const userOff = buildRestockHTML(cat, grades, '', true);
    out.userHidden = userOff.indexOf(LINE) === -1;

    // ⚠️⚠️ والورقة بتاعته لازم تبقى **مطابقة حرف بحرف** لورقة منشئ
    // النظام لو مفيش تاريخ محفوظ — يعني الميزة مازوّدتش ولا بايت عليه.
    restockPrintStamps = {};
    state.profile = { name: 'عبدالله', role: 'owner' };
    const ownerNoStamp = buildRestockHTML(cat, grades, '', true);
    out.identicalWhenHidden = ownerNoStamp === userOff;
    out.ownerNoStampHidesLine = ownerNoStamp.indexOf(LINE) === -1;

    // المفتاح مفتوح → الحساب العادي بيشوف
    restockPrintStamps = { c1: STAMP };
    state.profile = { name: 'محمد', role: 'user' };
    setPrintTweak('showRestockDate', true);
    out.userSeesWithTweak = buildRestockHTML(cat, grades, '', true).indexOf(LINE) !== -1;
    setPrintTweak('showRestockDate', false);

    // ⚠️ فئة تانية مالهاش تاريخ → السطر يختفي حتى لمنشئ النظام
    state.profile = { name: 'عبدالله', role: 'owner' };
    out.otherCatHidden = buildRestockHTML({ ...cat, id: 'c9' }, grades, '', true).indexOf(LINE) === -1;

    // ⚠️ قيمة بايظة محفوظة → نص فاضي، مش "Invalid Date"
    restockPrintStamps = { c1: 'كلام مش تاريخ' };
    out.badValueEmpty = restockLastPrintText('c1') === '';
    out.badValueNoLine = buildRestockHTML(cat, grades, '', true).indexOf(LINE) === -1;
    restockPrintStamps = { c1: STAMP };
    out.noIdEmpty = restockLastPrintText('') === '' && restockLastPrintText(null) === '';

    // ============================================================
    // ٣) التسجيل نفسه
    // ============================================================
    const writes = [];
    const fakeDB = {
      collection: (c) => ({
        doc: (id) => ({ set: (data) => { writes.push({ c, id, data }); return Promise.resolve(); } }),
        get: () => Promise.resolve({ forEach: () => {} }),
      }),
    };
    const realDB = window.db;
    window.db = fakeDB;

    restockPrintStamps = {};
    const at = stampRestockPrint(cat);
    out.stampReturns = typeof at === 'string' && at.length > 10;
    // ⚠️ النسخة المحلية بتتحدّث **فورًا** (من غير انتظار السحابة)
    out.localImmediate = restockPrintStamps.c1 === at;
    out.wroteOnce = writes.length === 1;
    out.wroteRightDoc = writes[0] && writes[0].c === 'restockPrints' && writes[0].id === 'c1';
    out.wroteFields = writes[0] && writes[0].data.at === at && writes[0].data.catName === 'كريب سادة لوكس'
      && writes[0].data.byName === 'عبدالله';

    // ⚠️⚠️ النت واقف: الكتابة بترفض والوعد بيتعامل معاه، والنسخة
    // المحلية بتتحدّث برضه. لو حد حطّ await هنا، الطباعة كانت هتعلّق.
    window.db = { collection: () => ({ doc: () => ({ set: () => Promise.reject(new Error('offline')) }) }) };
    restockPrintStamps = {};
    const at2 = stampRestockPrint({ id: 'c2', name: 'شيفون' });
    out.offlineStillLocal = restockPrintStamps.c2 === at2;
    // db بيرمي من الأساس
    window.db = { collection: () => { throw new Error('boom'); } };
    restockPrintStamps = {};
    let threw = false;
    try { stampRestockPrint({ id: 'c3', name: 'x' }); } catch (err) { threw = true; }
    out.throwingDbSafe = !threw && restockPrintStamps.c3;
    out.noCatNoStamp = stampRestockPrint(null) === '' && stampRestockPrint({}) === '';

    // ============================================================
    // ٤) القراءة من السحابة — والفشل مابيدوّرش للأبد
    // ============================================================
    let reads = 0;
    window.db = { collection: () => { reads++; throw new Error('no net'); } };
    restockPrintStamps = null;
    restockStampsPromise = null;
    await loadRestockPrintStamps();
    out.readsAfterFirst = reads;
    out.emptyNotNull = restockPrintStamps && typeof restockPrintStamps === 'object';
    await loadRestockPrintStamps();
    // ⚠️ الحارس: {} مش null — تاني نداء **مايقراش** من الأول
    out.noRetryLoop = reads === 1;

    // قراءة ناجحة بتلم المستندات صح
    reads = 0;
    window.db = {
      collection: () => ({
        get: () => Promise.resolve({
          forEach: (fn) => {
            fn({ id: 'c1', data: () => ({ at: STAMP }) });
            fn({ id: 'c7', data: () => ({}) });          // من غير at → يتجاهل
            fn({ id: 'c8', data: () => null });           // مستند فاضي → مايكسرش
          },
        }),
      }),
    };
    restockPrintStamps = null; restockStampsPromise = null;
    const map = await loadRestockPrintStamps();
    out.loadedC1 = map.c1 === STAMP;
    out.skippedEmpty = !('c7' in map) && !('c8' in map);
    // النداء التاني بياخد من الكاش
    const map2 = await loadRestockPrintStamps();
    out.cached = map2 === map;

    window.db = realDB;
    restockPrintStamps = { c1: STAMP };
    state.profile = { name: 'عبدالله', role: 'owner' };
    return out;
  }, STAMP);

  // ---------- ١) اسم الورقة في السجل ----------
  check('⭐ عنوان الورقة الكاملة = اسم الفئة', r.titleAll === 'كريب سادة لوكس', r.titleAll);
  check('⭐ وعنوان المجموعة فيه اسمها', r.titleGroup === 'كريب سادة لوكس — بيجات', r.titleGroup);
  check('⭐ الطبعة بتتسجّل سطر واحد', r.oneEntry);
  check('⭐⭐ والسجل فيه **اسم الورقة**', r.logName === 'كريب سادة لوكس — بيجات', r.logName);
  check('⚠️⚠️ ومش اسم الفاتورة (الحارس)', r.logNotInvoiceName, r.logName);
  check('⭐ ونوعها "ورقة تزويد"', r.logLabel === 'ورقة تزويد' && r.logKind === 'restock', [r.logLabel, r.logKind]);
  check('⭐ ومعاها الفئة عشان الفلترة', r.logCatId === 'c1' && r.logCatName === 'كريب سادة لوكس', [r.logCatId, r.logCatName]);
  check('⭐ ٣ ورق → العدد ٣', r.papersCount === 3 && r.papersName === 'كريب سادة لوكس', [r.papersCount, r.papersName]);
  check('⚠️ ورقة من غير وصفة لسه بتتسجّل (السلوك القديم)', r.noSpecStillLogs);
  check('⚠️ وملصق من غير وصفة لسه مابيتسجّلش', r.labelNoSpecSilent);
  check('⚠️ وملصق الصنف ماتخربش', r.itemLabelName === 'CREPE PLAIN LUX 90x180' && r.itemLabelCount === 4,
    [r.itemLabelName, r.itemLabelCount]);
  check('⚠️⚠️ ووصفة الورقة مابتتبنيش تاني على الجهاز المستقبِل', r.rebuildRefuses);

  // ---------- ٢) مين يشوف التاريخ ----------
  check('⭐⭐ منشئ النظام بيشوف تاريخ آخر طبعة', r.ownerSees, r.ownerText);
  check('⭐ والتاريخ فيه اسم اليوم', r.ownerHasDay, r.ownerText);
  check('⭐ وفيه السنة', r.ownerHasYear, r.ownerText);
  check('⚠️⚠️ وتاريخ مطلق مش نسبي (بيكسر تحديث الكميات)', r.notRelative, r.ownerText);
  check('⭐⭐ الحساب العادي مايشوفهوش', r.userHidden);
  check('⚠️⚠️ ولو مفيش تاريخ، الورقة مطابقة حرف بحرف', r.identicalWhenHidden);
  check('⚠️ ومنشئ النظام كمان مايشوف سطر فاضي', r.ownerNoStampHidesLine);
  check('⭐⭐ المفتاح مفتوح → الحساب العادي بيشوف', r.userSeesWithTweak);
  check('⚠️ فئة مالهاش تاريخ → السطر يختفي', r.otherCatHidden);
  check('⚠️ قيمة بايظة → نص فاضي مش Invalid Date', r.badValueEmpty && r.badValueNoLine);
  check('⚠️ من غير معرّف فئة → فاضي', r.noIdEmpty);

  // ---------- ٣) التسجيل ----------
  check('⭐ التسجيل بيرجّع الوقت', r.stampReturns);
  check('⭐⭐ والنسخة المحلية بتتحدّث فورًا', r.localImmediate);
  check('⭐ ومستند واحد بس بيتكتب', r.wroteOnce);
  check('⭐⭐ في مجموعة منفصلة بمعرّف الفئة (مش جوّه الفئة)', r.wroteRightDoc);
  check('⭐ ومعاه اسم الفئة واللي طبع', r.wroteFields);
  check('⚠️⚠️ النت واقف → الطباعة ماتعلّقش والمحلي بيتحدّث', r.offlineStillLocal);
  check('⚠️⚠️ db بيرمي → الطباعة مش بتقع', r.throwingDbSafe);
  check('⚠️ فئة من غير معرّف → مافيش تسجيل', r.noCatNoStamp);

  // ---------- ٤) القراءة ----------
  check('⭐ القراءة بتلم التواريخ', r.loadedC1);
  check('⚠️ ومستند من غير تاريخ بيتجاهل من غير ما يكسر', r.skippedEmpty);
  check('⭐ والنداء التاني من الكاش', r.cached);
  check('⚠️ فشل القراءة بيرجّع قايمة فاضية مش null', r.emptyNotNull);
  check('⚠️⚠️ والفشل مابيدوّرش للأبد (نداء واحد بس)', r.noRetryLoop, r.readsAfterFirst);

  // ---------- ٥) أقسام نافذة إعدادات الطابعة بتتفتح وتتقفل ----------
  const sec = await p.evaluate(() => {
    openPrinterSettings();   // ⚠️ من غير await: الغلاف بيتحط قبل البحث عن QZ
    const keys = [...document.querySelectorAll('.pset-toggle[data-pset]')].map((b) => b.getAttribute('data-pset'));
    const bodies = keys.map((k) => {
      const box = document.querySelector('#pset-body-' + k);
      return { k, exists: !!box, hidden: !!(box && box.hidden) };
    });
    // فتح قسم بيشيل hidden عنه **وبس**
    const t = document.querySelector('.pset-toggle[data-pset="align"]');
    t.click();
    const alignOpen = !document.querySelector('#pset-body-align').hidden;
    const othersStillShut = document.querySelector('#pset-body-tweaks').hidden;
    const xKept = !!document.querySelector('#align-x');
    t.click();
    const alignShutAgain = document.querySelector('#pset-body-align').hidden;
    // الجزء اللي فوق (اسم الجهاز + الطابعتين) **مش** جوه أي قسم مطوي
    const nameInTop = !document.querySelector('#qz-device-name').closest('.pset-body');
    const labelInTop = !document.querySelector('#qz-label-printer-select').closest('.pset-body');
    const restockInTop = !document.querySelector('#qz-restock-printer-select').closest('.pset-body');
    // وكل الخانات المهمة لسه موجودة
    const ids = ['cal-w', 'cal-h', 'cal-gap', 'cal-run', 'pq-speed', 'pq-density', 'pq-apply',
      'pq-pace', 'pq-pace-save', 'pq-batch', 'pq-lead', 'pq-batch-save', 'tspl-sample',
      'copy-from', 'copy-run', 'align-x', 'align-y', 'align-shrink', 'align-frame', 'align-save',
      'qz-details-btn', 'qz-details'];
    const missing = ids.filter((id) => !document.getElementById(id));
    const dateSwitch = !!document.querySelector('[data-tweak="showRestockDate"]');
    const dateSwitchOnce = document.querySelectorAll('[data-tweak="showRestockDate"]').length;
    document.querySelector('#qz-settings-close').click();
    return { keys, bodies, alignOpen, othersStillShut, xKept, alignShutAgain,
      nameInTop, labelInTop, restockInTop, missing, dateSwitch, dateSwitchOnce };
  });

  ['cal', 'quality', 'pace', 'batch', 'fonts', 'copy', 'align', 'lastdate', 'tweaks', 'details'].forEach((k) => {
    const row = sec.bodies.find((x) => x.k === k);
    check(`⭐ قسم "${k}" بيتفتح ويتقفل`, !!(row && row.exists), sec.keys);
    check(`⭐ وبيفتح النافذة مقفول`, !!(row && row.hidden));
  });
  check('⭐⭐ فتح قسم بيفتحه هو بس', sec.alignOpen && sec.othersStillShut);
  check('⚠️⚠️ والفتح مابيلمسش الخانات جوّاه', sec.xKept);
  check('⭐ والدوس تاني بيقفله', sec.alignShutAgain);
  check('⭐⭐ اسم الجهاز والطابعتين **مش** مطويين', sec.nameInTop && sec.labelInTop && sec.restockInTop);
  check('⚠️⚠️ ولا خانة ضاعت من النافذة', sec.missing.length === 0, sec.missing);
  check('⭐ ومفتاح تاريخ آخر طبعة موجود مرة واحدة', sec.dateSwitch && sec.dateSwitchOnce === 1, sec.dateSwitchOnce);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
