// فحوصات منطق الإشعار — جافاسكريبت عادي، من غير سحابة ولا شبكة
// ============================================================
// ⚠️ الملف اللي بيتفحص هنا (notify-core.js) هو **كل** المنطق اللي ممكن
// يغلط. اللي في index.js توصيل بس.
const assert = require('assert');
const {
  becamePending,
  tokenIsEligible,
  buildMessage,
  buildGroupedMessage,
  formatGradeList,
  categoryTag,
  MAX_LISTED_GRADES,
  PUSH_TAG,
} = require('./notify-core');

const pass = [], fail = [];
const check = (n, fn) => {
  try { fn(); pass.push(n); } catch (e) { fail.push(n + ' → ' + (e.message || e)); }
};

// ============================================================
// امتى نبعت
// ============================================================
check('⭐⭐⭐ الدرجة بقت معلّقة → إشعار', () =>
  assert.strictEqual(becamePending({ status: 'normal' }, { status: 'pending' }), true));

// ⚠️⚠️ ده أهم فحص في الملف: من غير الشرط ده، **أي** تعديل على درجة
// معلّقة (تغيير الكمية المطلوبة مثلًا) كان هيطلّع إشعار جديد.
check('⭐⭐⭐⭐ تعديل على درجة معلّقة أصلًا → مافيش إشعار', () =>
  assert.strictEqual(becamePending({ status: 'pending', requestedQty: 2 }, { status: 'pending', requestedQty: 5 }), false));

check('⭐⭐ الدرجة اتزوّدت (رجعت عادي) → مافيش إشعار', () =>
  assert.strictEqual(becamePending({ status: 'pending' }, { status: 'normal' }), false));

check('⭐⭐ درجة جديدة اتضافت معلّقة → إشعار', () =>
  assert.strictEqual(becamePending(undefined, { status: 'pending' }), true));

check('⭐⭐ الدرجة اتمسحت → مافيش إشعار', () =>
  assert.strictEqual(becamePending({ status: 'pending' }, undefined), false));

// ============================================================
// ⚠️⚠️ الخنق اتشال — والتجميع هو اللي حلّ محله
// ============================================================
// كان: إشعار واحد كل دقيقة والباقي بيتسكت عنه. اتشال بطلب صريح:
// "عاوز اي طلب تزويد يطلب يوصل رسالة ... مش يستني دقيقة".
//
// والمشكلة اللي كان بيحلها (عشرين درجة معلّقة في لحظة = عشرين إشعار)
// اتحلّت بالتجميع: إشعار واحد للفئة بيتحدّث ويكبر.
check('⭐⭐⭐⭐⭐ الخنق مابقاش موجود خالص', () => {
  const core = require('./notify-core');
  assert.strictEqual(core.shouldSend, undefined, 'shouldSend لسه موجودة');
  assert.strictEqual(core.THROTTLE_MS, undefined, 'THROTTLE_MS لسه موجود');
});

// ============================================================
// 🧾 تجميع الدرجات — ده اللي اتطلب بالنص
// ============================================================
// "لو في طلب تزويد من الكريب السادة درجة 5 وبعدين طلبت درجة 6 لما
//  يوصل اشعار 6 ... يكتب درجة 5 و 6"
check('⭐⭐⭐⭐⭐ درجتين → الاتنين في الإشعار', () =>
  assert.strictEqual(buildGroupedMessage('كريب سادة', [5, 6]).body, 'كريب سادة — درجات 5، 6'));

check('⭐⭐⭐ ودرجة واحدة تفضل بصيغة المفرد', () =>
  assert.strictEqual(buildGroupedMessage('كريب سادة', [5]).body, 'كريب سادة — درجة 5'));

// ⚠️ الترتيب مهم: الاستعلام مش مضمون ترتيبه، و"5 و 6" أوضح من "6 و 5".
check('⭐⭐⭐⭐ والترتيب بيتظبط مهما جت مقلوبة', () =>
  assert.strictEqual(formatGradeList([9, 2, 5]), 'درجات 2، 5، 9'));

// ⚠️ التكرار بيحصل فعلًا: الدرجة الجديدة بتتضاف بإيدنا **وكمان** ممكن
// تكون في الاستعلام. من غير التنضيف ده الإشعار هيقول "درجة 5، 5".
check('⭐⭐⭐⭐⭐ والتكرار بيتشال (الدرجة الجديدة بتتضاف مرتين)', () =>
  assert.strictEqual(formatGradeList([5, 6, 5]), 'درجات 5، 6'));

check('⭐⭐⭐ والعنوان بيقول العدد لما يبقى أكتر من واحدة', () =>
  assert.strictEqual(buildGroupedMessage('كريب', [5, 6, 7]).title, '🔔 3 طلبات تزويد'));

// ⚠️ بسقف: فئة فيها 40 درجة معلّقة كانت هتطلّع سطر مالوش آخر.
check('⭐⭐⭐⭐ والقايمة الطويلة بتتقص وبتقول الباقي كام', () => {
  const many = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const txt = formatGradeList(many);
  assert.ok(/و3 غيرهم/.test(txt), txt);
  assert.ok(txt.split('،').length <= MAX_LISTED_GRADES + 1, txt);
});

check('⭐⭐ والدرجة صفر قيمة صحيحة مش فاضية', () =>
  assert.strictEqual(formatGradeList([0, 1]), 'درجات 0، 1'));

check('⭐⭐ ومافيش درجات → نص مفهوم مش فاضي', () =>
  assert.ok(buildGroupedMessage('كريب', []).body.length > 0));

// ============================================================
// 🏷️ وسم لكل فئة — ده اللي بيخلي التجميع يبان
// ============================================================
// ⚠️⚠️ من غيره، طلب في فئة تانية كان هيمسح إشعار الفئة الأولى وكإنه
// اتزوّد — والمستخدم يفتكر إن الطلب راح.
check('⭐⭐⭐⭐⭐ كل فئة ليها وسم لوحدها', () =>
  assert.notStrictEqual(categoryTag('cat-1'), categoryTag('cat-2')));

check('⭐⭐⭐⭐ ونفس الفئة ليها نفس الوسم (عشان يستبدل مكانه)', () =>
  assert.strictEqual(categoryTag('cat-1'), categoryTag('cat-1')));

check('⭐⭐ والفئة من غير رقم بتاخد الوسم العام', () =>
  assert.strictEqual(categoryTag(''), PUSH_TAG));

// ============================================================
// مين ياخد
// ============================================================
check('⭐⭐⭐ الجهاز اللي طالب الإشعار بياخده', () =>
  assert.strictEqual(tokenIsEligible({ uid: 'u1', wantsRestock: true }, { role: 'warehouse_keeper' }), true));

check('⭐⭐⭐ واللي مش طالبه مابياخدوش', () =>
  assert.strictEqual(tokenIsEligible({ uid: 'u1', wantsRestock: false }, { role: 'owner' }), false));

// ⚠️⚠️ الحارس اللي بيغطي الفجوة: الجهاز كاتب إنه عايز، بس الصلاحية
// اتقفلت عليه بالاسم بعدين. السحابة بتحترم القفل **فورًا** من غير ما
// تستنى الجهاز يفتح النظام ويحدّث علامته.
check('⭐⭐⭐⭐ الصلاحية اتقفلت بالاسم → مايوصلوش حتى لو جهازه طالب', () =>
  assert.strictEqual(tokenIsEligible({ uid: 'u1', wantsRestock: true }, { role: 'owner', perms: { editMainQty: false } }), false));

check('⭐⭐ والصلاحية مفتوحة بالاسم → بياخده', () =>
  assert.strictEqual(tokenIsEligible({ uid: 'u1', wantsRestock: true }, { role: 'user', perms: { editMainQty: true } }), true));

// ⚠️ الحساب اللي اتمسح: مافيش ملف شخصي خالص. مانوقفش الإشعار بسببه —
// العلامة اللي الجهاز كاتبها هي المرجع، والقفل الصريح هو الاستثناء.
check('⭐⭐ حساب من غير ملف شخصي → بنمشي على علامة الجهاز', () =>
  assert.strictEqual(tokenIsEligible({ uid: 'u1', wantsRestock: true }, null), true));

check('⭐ توكن فاضي مايتبعتلوش', () =>
  assert.strictEqual(tokenIsEligible(null, {}), false));

// ============================================================
// النص
// ============================================================
check('⭐⭐ النص بيسمّي الفئة والدرجة', () => {
  const m = buildMessage('كريب', 3);
  assert.match(m.body, /كريب/);
  assert.match(m.body, /3/);
});
check('⭐ ومن غير اسم فئة بيفضل مفهوم', () =>
  assert.match(buildMessage('', null).body, /تزويد/));
// ⚠️ الدرجة صفر رقم صحيح — `||` كانت هتبلعه
check('⭐⭐ ودرجة رقمها صفر بتبان', () =>
  assert.match(buildMessage('كريب', 0).body, /0/));

// ============================================================
// ⏰ محرّك الدالة لسه مدعوم
// ============================================================
// جوجل بتقفل كل نسخة من Node بعد مدة. ولما تتقفل، الدالة
// **بتفضل شغالة** بس مابقاش نقدر نرفع عليها أي تعديل خالص —
// يعني الباب بيتقفل في وشنا وإحنا مش واخدين بالنا.
//
// التواريخ دي منقولة من جدول Firebase CLI نفسه
// (lib/deploy/functions/runtimes/supported/types.js).
const RUNTIME_END = { '18': '2025-10-31', '20': '2026-10-31', '22': '2027-10-31' };
const enginesNode = String((require('./package.json').engines || {}).node || '');

check('⭐⭐⭐ محرّك Node المكتوب معروف (مش رقم متكتب غلط)', () =>
  assert.ok(RUNTIME_END[enginesNode], `النسخة ${enginesNode} مش في الجدول`));

// ⚠️ الفحص بيقع لما النسخة تبقى **اتقفلت فعلًا** — وساعتها الرفع
// كان هيفشل بردو عند جوجل، فأحسن يبان هنا وإحنا فاهمين السبب.
check('⭐⭐⭐⭐⭐ ولسه مااتقفلش', () => {
  const end = Date.parse(RUNTIME_END[enginesNode] + 'T23:59:59Z');
  assert.ok(Date.now() < end,
    `Node ${enginesNode} اتقفل يوم ${RUNTIME_END[enginesNode]} — غيّر engines.node في functions/package.json`);
});

// ⚠️ ودي **تنبيه مش فشل** عن قصد: لو خلّيناه يفشل، رفع الدالة
// كان هيتقفل تلات شهور قبل ما يبقى فيه مشكلة أصلًا.
const daysLeft = Math.round((Date.parse(RUNTIME_END[enginesNode] + 'T23:59:59Z') - Date.now()) / 86400000);
if (daysLeft < 90) {
  console.log(`   ⚠️ فاضل ${daysLeft} يوم ويتقفل Node ${enginesNode} — ارفعه للنسخة اللي بعده`);
}

pass.forEach((n) => console.log('   ✓ ' + n));
fail.forEach((n) => console.log('   ✗ ' + n));
console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
process.exit(fail.length ? 1 : 0);
