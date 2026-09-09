// فحوصات منطق الإشعار — جافاسكريبت عادي، من غير سحابة ولا شبكة
// ============================================================
// ⚠️ الملف اللي بيتفحص هنا (notify-core.js) هو **كل** المنطق اللي ممكن
// يغلط. اللي في index.js توصيل بس.
const assert = require('assert');
const { becamePending, shouldSend, tokenIsEligible, buildMessage, THROTTLE_MS } = require('./notify-core');

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
// الخنق
// ============================================================
// طلب واحد ممكن يخلي عشرين درجة معلّقة في نفس اللحظة = عشرين إشعار.
check('⭐⭐⭐ أول إشعار بيعدّي على طول', () =>
  assert.strictEqual(shouldSend(0, 1000), true));
check('⭐⭐⭐⭐ واللي وراه في نفس الدقيقة بيتخنق', () =>
  assert.strictEqual(shouldSend(1000, 1000 + THROTTLE_MS - 1), false));
check('⭐⭐ وبعد الدقيقة بيعدّي تاني', () =>
  assert.strictEqual(shouldSend(1000, 1000 + THROTTLE_MS), true));

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

pass.forEach((n) => console.log('   ✓ ' + n));
fail.forEach((n) => console.log('   ✗ ' + n));
console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
process.exit(fail.length ? 1 : 0);
