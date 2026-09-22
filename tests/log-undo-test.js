// ============================================================
// ↩️ التراجع في سجل العمليات — كان بيطلع "undo" وبس
// ============================================================
// اتبلّغ بالنص:
//   "انا عاوز لما حد يضغط علي زرار التراجع يكتب في سجل العمليات ايه
//    اللي حصل بظبط لما ضغطت علي زر التراجع يعني اي الدرجة وكانت كام
//    وهكذا لانه بيظهر خام في السجل"
//
// ⚠️⚠️ السبب: مكانش فيه أي فرع للعملية دي في activityEntryParts،
// فكانت بتقع على شبكة الأمان اللي بتكتب **اسم العملية الخام** — يعني
// السطر كان حرفيًا كلمة `undo`.
//
// ⚠️ والفحص ده بيشتغل على الدالة الحقيقية اللي بترسم السطر، مش على
// نسخة منها — عشان لو حد غيّر الرسم، الفحص يفشل بالاسم.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(
    () => typeof activityEntryParts === 'function' && typeof undoRestoredText === 'function'
  );

  // ============================================================
  // 1) ⭐⭐⭐ السطر مابقاش خام
  // ============================================================
  const raw = await p.evaluate(() =>
    activityEntryParts({
      action: 'undo',
      categoryName: 'كريب',
      gradeGroup: 'بيجات',
      gradeNumber: 'درجة 56',
      oldValue: 'درجة 56 — الفرع: 12 ← 8',
      newValue: 'رصيد الفرع رجع 12',
    })
  );
  check('⭐⭐⭐ السطر مابقاش كلمة "undo" الخام',
    raw.detailLabel.indexOf('undo') === -1, raw);
  check('⭐⭐ وبيقول إنه تراجع', raw.detailLabel.indexOf('تراجع') !== -1, raw);
  check('⭐⭐ وبيقول اتعمل إيه أصلًا (الفرع: 12 ← 8)',
    raw.detailLabel.indexOf('12 ← 8') !== -1, raw);
  // ⚠️ اسم الدرجة في عنوان السطر خلاص — مالوش لازمة يتكرر في الوصف.
  check('⭐⭐ واسم الدرجة مش متكرر في الوصف',
    raw.detailLabel.indexOf('درجة 56') === -1, raw);
  check('⭐⭐⭐ وبيقول الكمية رجعت لكام',
    raw.detailLabel.indexOf('رصيد الفرع رجع 12') !== -1, raw);

  // ⚠️ gradeNumber في التراجع **مش رقم** — جواها الاسم كامل. لو
  // اتعاملنا معاها زي باقي العمليات كانت هتطلع "درجة درجة 56".
  check('⭐⭐ الفئة والمجموعة والدرجة في عنوان السطر',
    raw.itemLabel.indexOf('كريب') !== -1 &&
    raw.itemLabel.indexOf('بيجات') !== -1 &&
    raw.itemLabel.indexOf('درجة 56') !== -1, raw);
  check('⭐⭐⭐ ومفيش "درجة درجة"', raw.itemLabel.indexOf('درجة درجة') === -1, raw);

  // ============================================================
  // 2) ⭐ العمليات القديمة (قبل التحديث) مافيهاش newValue
  // ============================================================
  // لازم تفضل مقروءة — مش تطلع ناقصة ولا فاضية.
  const old = await p.evaluate(() =>
    activityEntryParts({
      action: 'undo',
      categoryName: 'كريب',
      gradeNumber: 'أبيض',
      oldValue: 'أبيض — تزويد بكمية 5',
    })
  );
  check('⭐⭐ السطر القديم (من غير newValue) لسه مقروء',
    old.detailLabel.indexOf('تزويد بكمية 5') !== -1 && old.detailLabel.indexOf('undo') === -1, old);
  check('⭐ والدرجة الأساسية بتطلع باسمها', old.itemLabel.indexOf('أبيض') !== -1, old);

  // ============================================================
  // 3) ⭐⭐ "رجعت لكام" بتتحسب من القيم اللي اتكتبت فعلًا
  // ============================================================
  const texts = await p.evaluate(() => ({
    qty:    undoRestoredText({ before: { branchQty: 12 } }),
    both:   undoRestoredText({ before: { branchQty: 3, mainQty: 40 } }),
    req:    undoRestoredText({ before: { status: 'pending', requestedQty: 6 } }),
    status: undoRestoredText({ before: { status: 'out' } }),
    del:    undoRestoredText({ type: 'delete', before: { branchQty: 9 } }),
    zero:   undoRestoredText({ before: { branchQty: 0 } }),
    none:   undoRestoredText({ before: {} }),
  }));
  check('⭐⭐ رصيد الفرع', texts.qty === 'رصيد الفرع رجع 12', texts);
  check('⭐ والاتنين مع بعض', /الفرع رجع 3/.test(texts.both) && /الرئيسي رجع 40/.test(texts.both), texts);
  check('⭐ والكمية المطلوبة', /الكمية المطلوبة رجعت 6/.test(texts.req), texts);
  check('⭐ والحالة بالعربي مش بالكود', /رجعت «/.test(texts.status) && !/out/.test(texts.status), texts);
  check('⭐⭐ وحذف درجة بيقول إنها رجعت بكل بياناتها',
    texts.del === 'الدرجة رجعت بكل بياناتها', texts);

  // ⚠️⚠️ الصفر قيمة حقيقية: "رجع 0" معناها الرصيد رجع فاضي. لو
  // اتعامل معاه كـ"مافيش"، أهم حالة (رجّعت الرصيد لصفر) هتختفي.
  check('⭐⭐⭐ والصفر بيتكتب — مش بيتعامل كـ"مافيش"',
    texts.zero === 'رصيد الفرع رجع 0', texts);
  check('⭐ ومافيش قيم = نص فاضي (مش كلام على الفاضي)', texts.none === '', texts);

  // ============================================================
  // 4) ⭐ التراجع بيوصل للسجل أصلًا
  // ============================================================
  const src = await p.evaluate(() =>
    typeof undoLastAction === 'function' ? String(undoLastAction) : ''
  );
  check('⭐⭐ undoLastAction بتسجّل في السجل وبتبعت الوصف',
    /logActivity\(/.test(src) && /undoRestoredText\(/.test(src), src.slice(0, 200));

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);
  await b.close();

  if (fail.length) {
    console.log(`❌ فشل (${fail.length}):`);
    fail.forEach((f) => console.log('   ' + f));
    console.log(`\n✅ نجح (${pass.length})`);
    process.exit(1);
  }
  console.log(`✅ نجح (${pass.length})`);
  pass.filter((x) => x.startsWith('⭐')).forEach((x) => console.log('   ' + x));
})();
