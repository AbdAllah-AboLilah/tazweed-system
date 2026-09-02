// اسم اليوم جنب التاريخ — في ورقة التزويد وفي "آخر تحديث لملف الأصناف"
// ============================================================
// ليه: الورقة بتتعلّق على الرف وبتتقارن بغيرها، و"السبت" أسرع في القراية
// من "٢٠٢٦/٩/٥" وانت ماسكها. ونفس الحكاية في سطر آخر تحديث — "الأربعاء"
// بيقولك من غير ما تحسب إن الملف اتحدّث امبارح ولا من أسبوع.
//
// ⚠️⚠️ الفحص ده بيتأكد إن اسم اليوم **صح**، مش إنه موجود وبس. اسم يوم
// غلط أوحش من مفيش اسم خالص — لأنك هتصدّقه. عشان كده التواريخ تحت
// **ثابتة ومحسوبة بالإيد**، مش new Date().
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

// أيام متأكد منها: سبتمبر 2026
const KNOWN = [
  ['2026-09-05T10:00:00', 'السبت'],
  ['2026-09-06T10:00:00', 'الأحد'],
  ['2026-09-08T10:00:00', 'الثلاثاء'],
  ['2026-09-09T10:00:00', 'الأربعاء'],
  ['2026-09-11T10:00:00', 'الجمعة'],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildRestockHTML === 'function' && typeof productsUpdatedText === 'function');

  const r = await p.evaluate((known) => {
    const out = {};
    const AR_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

    // ---------- ورقة التزويد ----------
    const cat = { id: 'c1', name: 'كريب سادة لوكس', minQty: 3, groups: [] };
    const grades = [
      { id: 'g1', number: '1', branchQty: 5, mainQty: 5, status: 'normal' },
      { id: 'g2', number: '2', branchQty: 0, mainQty: 0, status: 'out' },
    ];
    const html = buildRestockHTML(cat, grades, null, true);
    out.sheetHasDay = AR_DAYS.some((d) => html.indexOf(d) !== -1);
    // اسم اليوم لازم يكون في **نفس سطر** التاريخ مش في أي حتة
    const line = html.match(/>([^<>]*(?:السبت|الأحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة)[^<>]*)</);
    out.sheetLine = line ? line[1].trim() : '';
    // ⚠️ التاريخ بالأرقام العربية (٢٠٢٦) مش الإنجليزي — \d مابتمسكهاش.
    out.sheetDayWithDate = /[0-9٠-٩۰-۹]/.test(out.sheetLine);
    // ⚠️ واسم اليوم لازم يبقى **الأول**، عشان عينك تلقاه من غير ما تدوّر
    out.sheetDayFirst = AR_DAYS.some((d) => out.sheetLine.indexOf(d) === 0);
    // ⚠️ والورقة نفسها ماتخربتش
    out.sheetStillHasName = html.indexOf('كريب سادة لوكس') !== -1;
    out.sheetStillHasGrades = html.indexOf('>1<') !== -1 || html.indexOf('>١<') !== -1 || html.length > 500;

    // ---------- آخر تحديث لملف الأصناف ----------
    out.days = known.map(([iso, expect]) => {
      productsMeta = { localUpdatedAt: new Date(iso), updatedByName: 'أحمد' };
      const t = productsUpdatedText();
      return { expect, got: t, first: t.indexOf(expect) === 0, hasWho: t.indexOf('بواسطة أحمد') !== -1 };
    });

    // ⚠️ ومن غير اسم صاحب التعديل لازم يفضل شغّال
    productsMeta = { localUpdatedAt: new Date('2026-09-05T10:00:00') };
    out.noNameStillWorks = productsUpdatedText().indexOf('السبت') === 0;

    // ⚠️⚠️ والحارس المهم: مافيش تاريخ = **نص فاضي**، مش "الاثنين" ولا
    // "غير معروف". السطر بيختفي خالص. (ده كان مكتوب في الكود قبل التعديل
    // وسهل جدًا نكسره بالغلط.)
    productsMeta = null;
    out.emptyStaysEmpty = productsUpdatedText() === '';
    productsMeta = { updatedByName: 'أحمد' };   // اسم من غير تاريخ
    out.nameOnlyStaysEmpty = productsUpdatedText() === '';

    productsMeta = null;
    return out;
  }, KNOWN);

  check('⭐ ورقة التزويد فيها اسم يوم', r.sheetHasDay, r.sheetLine);
  check('⭐⭐ واسم اليوم في نفس سطر التاريخ', r.sheetDayWithDate, r.sheetLine);
  check('⭐ واليوم الأول في السطر', r.sheetDayFirst, r.sheetLine);
  check('⚠️ والورقة نفسها ماتخربتش (الاسم لسه موجود)', r.sheetStillHasName);
  check('⚠️ والدرجات لسه فيها', r.sheetStillHasGrades);

  r.days.forEach((d) => {
    check(`⭐⭐ "${d.expect}" اسمه صح وأول السطر`, d.first, d.got);
    check(`⭐ ومعاه اسم اللي حدّث`, d.hasWho, d.got);
  });
  check('⭐ وبيشتغل من غير اسم صاحب التعديل', r.noNameStillWorks);

  check('⚠️⚠️ مافيش تاريخ → نص فاضي (السطر يختفي)', r.emptyStaysEmpty);
  check('⚠️⚠️ اسم من غير تاريخ → برضه فاضي', r.nameOnlyStaysEmpty);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
