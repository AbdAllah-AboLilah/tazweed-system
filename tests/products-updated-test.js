// سطر "آخر تحديث لملف الأصناف" + أسماء أصناف السلة في السجل
// ============================================================
// ⭐⭐ أهم فحص هنا: بعد الاستيراد، السطر لازم يقول التاريخ **الجديد
// فورًا** من غير ريفريش. العطل الأصلي: saveProducts كانت بتحدّث
// productsCache وتسيب productsMeta زي ما هي — فالسطر يفضل يقول التاريخ
// القديم، واللي استورد يفتكر إن الاستيراد ماتمّش ويرجع يستورد تاني.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof productsUpdatedText === 'function' && typeof summarizeNames === 'function');

  const r = await p.evaluate(async () => {
    const out = {};

    // ---- سطر آخر تحديث ----
    const oldDate = new Date(2026, 0, 5, 10, 30);
    productsMeta = { count: 10, updatedAt: { toDate: () => oldDate }, updatedByName: 'سارة' };
    out.showsServerDate = productsUpdatedText();
    out.hasOldYear = out.showsServerDate.indexOf('٢٠٢٦') !== -1 || out.showsServerDate.indexOf('2026') !== -1;
    out.hasWho = out.showsServerDate.indexOf('بواسطة سارة') !== -1;

    // مفيش تاريخ خالص = سطر فاضي (يختفي بدل "غير معروف")
    productsMeta = { count: 10 };
    out.emptyWhenUnknown = productsUpdatedText() === '';

    // ⭐⭐ الشكل اللي saveProducts بتسيبه بعد الاستيراد على طول:
    // updatedAt = null (السيرفر لسه مأكّدش) + تقدير محلي
    const now = new Date();
    productsMeta = {
      count: 46052, chunks: 24, updatedAt: null,
      updatedByName: 'عبدالله', localUpdatedAt: now,
    };
    const t = productsUpdatedText();
    out.afterImport = t;
    out.afterImportNotEmpty = t !== '';
    out.afterImportWho = t.indexOf('بواسطة عبدالله') !== -1;
    // لازم يبقى تاريخ النهاردة مش تاريخ قديم
    out.afterImportIsToday =
      t.indexOf(String(now.getFullYear())) !== -1 ||
      t.indexOf(String(now.getFullYear()).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])) !== -1;

    // ⚠️⚠️ والبصمة لازم تفضل **فاضية** — لو حسبناها من التاريخ المحلي
    // كل الأجهزة هتفضل على نسخة قديمة.
    out.stampStaysEmpty = productsStampOf(productsMeta) === '';

    // ---- أسماء أصناف السلة ----
    out.threeOnly = summarizeNames(['كريب', 'شيفون', 'طباقيه']);
    out.withRest = summarizeNames(['كريب', 'شيفون', 'طباقيه', 'بونيه', 'اسدال']);
    out.one = summarizeNames(['كريب']);
    out.none = summarizeNames([]);
    // السقف: 30 اسم طويل مايعملش سطر طوله متر
    const many = Array.from({ length: 30 }, (_, i) => 'اسم صنف طويل جدا رقم ' + i);
    out.cappedLen = summarizeNames(many).length;

    // ⭐⭐ الفحص اللي بيمسك العطل نفسه: saveProducts **لازم** تحدّث
    // productsMeta. الفحوصات اللي فوق بتجرّب شكل البيانات، لكن العطل
    // الأصلي كان إن الشكل ده مابيتحطش أصلًا بعد الاستيراد.
    try {
      const src = await (await fetch('/js/products.js')).text();
      const i = src.indexOf('async function saveProducts');
      const body = i > -1 ? src.slice(i, src.indexOf('\nasync function', i + 10)) : '';
      out.saveSetsMeta = /productsMeta\s*=/.test(body);
      out.saveSetsLocalDate = /localUpdatedAt/.test(body);
      out.saveKeepsServerNull = /updatedAt:\s*null/.test(body);
    } catch (e) {
      out.srcErr = String(e);
    }

    // اسم عنصر السلة من الأشكال المختلفة
    out.nameFromCat = cartItemName({ cat: { itemName: 'خمار اسدال' } });
    out.nameFromCatFallback = cartItemName({ cat: { name: 'كريب' } });
    out.nameFromProduct = cartItemName({ name: 'صنف من الملف' });
    out.nameFromText = cartItemName({ text: 'ملصق مكتوب' });
    out.nameEmpty = cartItemName(null);
    return out;
  });

  check('بيقول تاريخ السيرفر', r.hasOldYear, r.showsServerDate);
  check('ومعاه "بواسطة مين"', r.hasWho, r.showsServerDate);
  check('مفيش تاريخ = سطر فاضي (يختفي)', r.emptyWhenUnknown);
  check('⭐⭐ بعد الاستيراد على طول: السطر مش فاضي', r.afterImportNotEmpty, r.afterImport);
  check('⭐⭐ وبتاريخ النهاردة مش القديم', r.afterImportIsToday, r.afterImport);
  check('ومكتوب مين اللي حدّثه', r.afterImportWho, r.afterImport);
  check('⭐⭐ والبصمة فاضلة فاضية (مافيش نسخة قديمة عالقة)', r.stampStaysEmpty);
  check('٣ أصناف = الأسماء كلها', r.threeOnly === 'كريب، شيفون، طباقيه', r.threeOnly);
  check('٥ أصناف = ٣ و"و٢ غيرهم"', r.withRest === 'كريب، شيفون، طباقيه و2 غيرهم', r.withRest);
  check('صنف واحد', r.one === 'كريب', r.one);
  check('مفيش أصناف = فاضي', r.none === '', r.none);
  check('٣٠ صنف: السطر متقصوص', r.cappedLen <= 120, r.cappedLen);
  check('⭐⭐ saveProducts بتحدّث productsMeta فعلًا', r.saveSetsMeta, r.srcErr);
  check('وبتحط تاريخ محلي للعرض', r.saveSetsLocalDate);
  check('وبتسيب تاريخ السيرفر null (عشان البصمة)', r.saveKeepsServerNull);
  check('اسم من الفئة', r.nameFromCat === 'خمار اسدال', r.nameFromCat);
  check('وبديله اسم الفئة', r.nameFromCatFallback === 'كريب', r.nameFromCatFallback);
  check('واسم من ملف الأصناف', r.nameFromProduct === 'صنف من الملف', r.nameFromProduct);
  check('والملصق المكتوب بالإيد', r.nameFromText === 'ملصق مكتوب', r.nameFromText);
  check('وعنصر فاضي مايكسرش', r.nameEmpty === '', r.nameEmpty);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
