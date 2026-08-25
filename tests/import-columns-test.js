// ============================================================
// تخمين أعمدة ملف الأصناف — بأسماء الـERP الحقيقية
// ============================================================
// ⚠️⚠️ أسماء الأعمدة في نظام المحل **عكس اللي أي حد هيتوقعه**، والأسماء
// دي اتأكدت من صاحب المحل نفسه:
//
//   "السعر بعد الخصم"  →  السعر اللي المستهلك بيدفعه فعلًا (الغامق)
//   "سعر البيع"        →  السعر **قبل** الخصم (المشطوب)
//   "القسم"            →  القسم **الفرعي** (مش الرئيسي!)
//
// وده خطر مش تفصيلة: "سعر البيع" كانت تلميح للسعر الفعلي، فالاستيراد
// كان بياخد **السعر المشطوب** ويحطه سعر بيع — يعني **ملصقات بأسعار غلط
// تروح للزباين**. والغلط ده مابيبانش في الاستيراد؛ بيبان على الورق.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof guessAllColumns === 'function');

  // بترجّع {اسم الحقل: عنوان العمود اللي اتخمّن له}
  const guess = (headers) =>
    p.evaluate((headers) => {
      const g = guessAllColumns(headers);
      const out = {};
      Object.keys(g).forEach((k) => (out[k] = g[k] === -1 ? null : headers[g[k]]));
      return out;
    }, headers);

  // ============================================================
  // 1) ⭐⭐ ملف الـERP بتاع المحل بالظبط
  // ============================================================
  const erp = await guess([
    'اسم الصنف', 'الباركود', 'سعر البيع', 'السعر بعد الخصم', 'القسم الرئيسي', 'القسم',
  ]);
  check('⭐⭐ "السعر بعد الخصم" → السعر الفعلي (اللي المستهلك بيدفعه)',
    erp.price === 'السعر بعد الخصم', erp);
  check('⭐⭐ و"سعر البيع" → السعر قبل الخصم (المشطوب)',
    erp.origPrice === 'سعر البيع', erp);
  check('⭐⭐ و"القسم" → القسم **الفرعي**', erp.subDept === 'القسم', erp);
  check('⭐⭐ و"القسم الرئيسي" → الرئيسي', erp.dept === 'القسم الرئيسي', erp);
  check('⭐ والاسم والباركود زي ما هما',
    erp.name === 'اسم الصنف' && erp.barcode === 'الباركود', erp);

  // ⚠️ الفحص اللي بيمسك العطل الأصلي: العمودين مايتبدّلوش
  check('⭐⭐ السعرين **مش** متبدّلين',
    erp.price !== erp.origPrice && erp.price === 'السعر بعد الخصم', erp);

  // ============================================================
  // 2) ⭐ الترتيب في الملف مايفرقش
  // ============================================================
  const shuffled = await guess([
    'القسم', 'السعر بعد الخصم', 'الباركود', 'القسم الرئيسي', 'اسم الصنف', 'سعر البيع',
  ]);
  check('⭐ نفس الأعمدة بترتيب مختلف: نفس النتيجة',
    shuffled.price === 'السعر بعد الخصم' && shuffled.origPrice === 'سعر البيع' &&
    shuffled.subDept === 'القسم' && shuffled.dept === 'القسم الرئيسي', shuffled);

  // ============================================================
  // 3) ⭐⭐ "القسم" لوحده من غير رئيسي
  // ============================================================
  // ⚠️ الحالة دي هي اللي كانت بتكسر التخمين: `dept` بياخد "القسم"
  // بالجزئي قبل ما `subDept` تشوفه.
  const onlySub = await guess(['اسم الصنف', 'الباركود', 'القسم']);
  check('⭐⭐ "القسم" لوحده بيروح للفرعي مش الرئيسي',
    onlySub.subDept === 'القسم' && onlySub.dept === null, onlySub);

  // ============================================================
  // 4) ⭐ ملفات من أنظمة تانية لسه شغّالة
  // ============================================================
  const english = await guess(['Product Name', 'Barcode', 'Price', 'Category']);
  check('⭐ ملف إنجليزي: الاسم والباركود والسعر',
    english.name === 'Product Name' && english.barcode === 'Barcode' && english.price === 'Price', english);
  check('⭐ و"Category" للقسم الرئيسي', english.dept === 'Category', english);

  const classic = await guess(['الصنف', 'كود', 'السعر', 'مجموعة']);
  check('⭐ أسماء عامة: كلها اتخمّنت',
    classic.name === 'الصنف' && classic.barcode === 'كود' &&
    classic.price === 'السعر' && classic.dept === 'مجموعة', classic);

  // ============================================================
  // 5) ⭐⭐ مفيش عمود بيتحجز لحقلين
  // ============================================================
  // ⚠️ ده كان عطل حقيقي قبل كده: "الباركود" و"كود الصنف" اتخمّنوا **نفس
  // العمود**، وعمود واحد مايقدرش يكون معناه حاجتين.
  const dup = await p.evaluate(() => {
    const headers = ['اسم الصنف', 'الباركود', 'سعر البيع', 'السعر بعد الخصم', 'القسم الرئيسي', 'القسم'];
    const g = guessAllColumns(headers);
    const cols = Object.values(g).filter((v) => v !== -1);
    return { cols, unique: new Set(cols).size === cols.length };
  });
  check('⭐⭐ كل حقل خد عمود مختلف', dup.unique === true, dup);

  // ============================================================
  // 6) ⭐ الحقول اللي مالهاش عمود بترجع فاضية (مش بتخمّن غلط)
  // ============================================================
  const minimal = await guess(['اسم الصنف']);
  check('⭐ ملف فيه عمود واحد: الباقي فاضي مش متخمّن غلط',
    minimal.name === 'اسم الصنف' && minimal.barcode === null &&
    minimal.price === null && minimal.dept === null, minimal);

  check('مفيش أخطاء في الصفحة', errors.length === 0, errors);
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
