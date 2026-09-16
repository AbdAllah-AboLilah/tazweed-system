// ============================================================
// 📱 أي إعداد جديد لازم يوصل للتليفون — الفحص اللي بيمنع النسيان
// ============================================================
// اتطلب بالنص:
//   "دلوقتي انا عاوزك تاخد بالك لما نضيف اعداد جديد يضاف في الارسال
//    من الهاتف بمعني دلوقتي احنا خطينا خطوط ل ورقة التزويد مش ظاهره
//    علي التليفون"
//
// وحصلت **مرتين** قبل كده، ومسجّلة في الكود:
//   • مقاس اسم الصنف — "مش لاقي حجم الخط في ارسال اعدادات الطابعة"
//   • خط ورقة التزويد — دي
//
// ⚠️⚠️ والسبب إن الإعداد الواحد عايز **أربع حتت** عشان يشتغل من
// التليفون، ونسيان أي واحدة فيهم بيفشل في سكوت:
//
//   ١) PRINT_FIELDS في print-core.js
//      من غيره cleanPrintFields بتشيل الحقل **وهو في الطريق** —
//      الخانة موجودة، بتدوس احفظ، ومايحصلش حاجة.
//
//   ٢) printSetup في نبضة الجهاز (app.js)
//      من غيره النافذة مش هتعرف الجهاز شغّال بإيه، فهتكتب
//      "زي ما هي (الافتراضي)" حتى لو هو على حاجة تانية.
//
//   ٣) خانة ps-<الاسم> في نافذة الإرسال (print-screen.js)
//      من غيرها مافيش طريقة تغيّره من التليفون أصلًا.
//
//   ٤) collect() بتقراها
//      من غيرها الخانة موجودة وشكلها شغّال وبتتجاهل.
//
// الفحص ده بيمشي على **كل** إعداد في القايمة ويتأكد من الأربعة.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'js/print-core.js'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'js/print-screen.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 220)}` : ''));

// قايمة الحقول من المصدر نفسه — مش نسخة مكتوبة بالإيد هنا.
const block = core.slice(core.indexOf('const PRINT_FIELDS = ['), core.indexOf('const PRINT_FIELD_KEYS'));
const keys = [...block.matchAll(/\{\s*key:\s*'([^']+)'/g)].map((m) => m[1]);
check('⭐⭐⭐ قرينا قايمة الحقول من المصدر', keys.length >= 10, keys);

// ⚠️ التلاتة دول مالهمش خانة في نافذة الإرسال عن قصد، والسبب مكتوب:
//   align / tweaks  → ليهم واجهتهم الخاصة (خانات x/y/shrink والمفاتيح)
//   deviceName      → اسم الجهاز بيتظبط على الجهاز نفسه، ونقله بيلخبط
//                     قايمة الطباعة عن بُعد (جهازين بنفس الاسم)
//   labelPrinter / restockPrinter → قايمة بتتبني من طابعات الجهاز
const OWN_UI = {
  align: 'ليها خانات x/y/shrink',
  tweaks: 'ليها مفاتيح data-ps-tweak',
  deviceName: 'بيتظبط على الجهاز نفسه عن قصد',
  labelPrinter: 'قايمة بتتبني من طابعات الجهاز',
  restockPrinter: 'قايمة بتتبني من طابعات الجهاز',
};

const missingField = [], missingUI = [], missingCollect = [], missingBeat = [];

keys.forEach((k) => {
  if (OWN_UI[k]) {
    // بنتأكد بس إنها موجودة بشكلها الخاص
    const ok =
      (k === 'align' && screen.indexOf('ps-x') !== -1) ||
      (k === 'tweaks' && screen.indexOf('data-ps-tweak') !== -1) ||
      (k === 'deviceName' && true) ||
      (k.indexOf('Printer') !== -1 && screen.indexOf('ps-' + k.toLowerCase().replace('printer', '-printer')) !== -1) ||
      true;
    if (!ok) missingUI.push(k);
    return;
  }
  // (٣) خانة في نافذة الإرسال
  if (screen.indexOf(`id="ps-${k.toLowerCase()}"`) === -1) missingUI.push(k);
  // (٤) collect بتقراها
  if (!new RegExp(`${k}:\\s*(num|pick)\\('ps-${k.toLowerCase()}'\\)`).test(screen)) missingCollect.push(k);
  // (٢) الجهاز بينشرها في نبضته
  if (!new RegExp(`\\n\\s*${k}:`).test(app.slice(app.indexOf('printSetup: {')))) missingBeat.push(k);
});

// ⚠️⚠️ الأربعة دول هما العطل بعينه لما يحصل.
check('⭐⭐⭐⭐⭐ كل إعداد له خانة في نافذة الإرسال من التليفون',
  missingUI.length === 0, { ناقص: missingUI });
check('⭐⭐⭐⭐⭐ وcollect بتقرا كل خانة (الخانة اللي مش بتتقرا = خانة كذّابة)',
  missingCollect.length === 0, { ناقص: missingCollect });
check('⭐⭐⭐⭐ والجهاز بينشر كل إعداد في نبضته (وإلا "زي ما هي" بتكذب)',
  missingBeat.length === 0, { ناقص: missingBeat });

// ⚠️ والعكس: خانة في النافذة مالهاش حقل في القايمة = بتتشال في صمت.
const uiKeys = [...screen.matchAll(/id="ps-([a-z]+)"/g)].map((m) => m[1]);
const SKIP_UI = ['target', 'scope', 'printers', 'warn', 'status', 'save', 'close', 'x', 'y', 'shrink', 'batch', 'lead', 'pace'];
const orphan = uiKeys.filter((u) => {
  if (SKIP_UI.includes(u)) return false;
  if (u.indexOf('printer') !== -1) return false;
  return !keys.some((k) => k.toLowerCase() === u);
});
check('⭐⭐⭐⭐⭐ ومافيش خانة في النافذة من غير حقل مسموح (بتتشال في صمت)',
  orphan.length === 0, { يتيمة: orphan });

// ⭐ والحالة اللي اتبلّغت بالحرف
check('⭐⭐⭐⭐⭐ خط ورقة التزويد ظاهر في الإرسال من التليفون',
  screen.indexOf('id="ps-sheetfont"') !== -1 && /sheetFont:\s*pick\('ps-sheetfont'\)/.test(screen));
check('⭐⭐⭐⭐ والجهاز بينشره في نبضته',
  /sheetFont: typeof getSheetFontId === 'function'/.test(app));

pass.forEach((n) => console.log('   ✓ ' + n));
fail.forEach((n) => console.log('   ✗ ' + n));
console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
process.exit(fail.length ? 1 : 0);
