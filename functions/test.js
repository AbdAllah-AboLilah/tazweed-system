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
  buildPendingMessage,
  canSendPending,
  pendingCooldownLeft,
  PENDING_TAG,
  PENDING_COOLDOWN_MS,
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

// ⚠⚠ الملف اللي **بيقرّر** هو firebase.json مش package.json.
// ده كود Firebase CLI بالحرف:
//     getRuntimeChoice = (dir, runtimeFromConfig) =>
//         runtimeFromConfig || getRuntimeChoiceFromPackageJson(dir)
// يعني طالما firebase.json فيه runtime، engines اللي في package.json
// **مابتتقراش خالص**.
//
// ودي مش نظرية: غيّرت engines لوحدها ورفعت، وسجل الرفع قال:
//     updating Node.js 20 (2nd Gen) function notifyRestock(europe-west1)
// التغيير عدى والرفع نجح والمحرّك فضل 20.
const fs = require('fs');
const path = require('path');
const firebaseJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
const configRuntime = String((firebaseJson.functions || {}).runtime || '');
const enginesNode = String((require('./package.json').engines || {}).node || '');

// المرجع هو firebase.json، ولو مافيهوش runtime ساعتها بس بنرجع لـengines.
const effective = configRuntime ? configRuntime.replace('nodejs', '') : enginesNode;

check('⭐⭐⭐⭐⭐ الملفين متفقين على نفس النسخة', () =>
  assert.strictEqual(effective, enginesNode,
    `firebase.json بيقول ${configRuntime} و package.json بيقول ${enginesNode} — ` +
    'واللي بيترفع فعلًا هو اللي في firebase.json'));

check('⭐⭐⭐ محرّك Node المكتوب معروف (مش رقم متكتب غلط)', () =>
  assert.ok(RUNTIME_END[effective], `النسخة ${effective} مش في الجدول`));

// ⚠️ الفحص بيقع لما النسخة تبقى **اتقفلت فعلًا** — وساعتها الرفع
// كان هيفشل بردو عند جوجل، فأحسن يبان هنا وإحنا فاهمين السبب.
check('⭐⭐⭐⭐⭐ ولسه مااتقفلش', () => {
  const end = Date.parse(RUNTIME_END[effective] + 'T23:59:59Z');
  assert.ok(Date.now() < end,
    `Node ${effective} اتقفل يوم ${RUNTIME_END[effective]} — غيّر runtime في firebase.json`);
});

// ⚠️ ودي **تنبيه مش فشل** عن قصد: لو خلّيناه يفشل، رفع الدالة
// كان هيتقفل تلات شهور قبل ما يبقى فيه مشكلة أصلًا.
if (RUNTIME_END[effective]) {
  const daysLeft = Math.round((Date.parse(RUNTIME_END[effective] + 'T23:59:59Z') - Date.now()) / 86400000);
  if (daysLeft < 90) {
    console.log(`   ⚠️ فاضل ${daysLeft} يوم ويتقفل Node ${effective} — غيّر runtime في firebase.json`);
  }
}

pass.forEach((n) => console.log('   ✓ ' + n));
fail.forEach((n) => console.log('   ✗ ' + n));

// ============================================================
// ⏳ عمر الإشعار عند جوجل (TTL)
// ============================================================
// ⚠️⚠️ اتبلّغ بالنص: "ساعات بحس ان الاشعارات بتتاخر او مش بتوصل ...
// اكد علي المعلومة دي ممكن يطلع مجرد احساس".
//
// وماكانش إحساس: الـTTL كان **١٠ دقايق**. الـTTL هو المدة اللي جوجل
// بتحتفظ فيها بالإشعار لو التليفون مش موصول (نت مقطوع، شاشة مقفولة
// من ساعات، أندرويد مدخّل التطبيق في توفير الطاقة). بعدها الإشعار
// **بيتمسح ومابيوصلش أبدًا** — مافيش محاولة تانية ومافيش أي أثر.
//
// الفحص ده بيحرس الرقم: أي حد يرجّعه صغير تاني لازم يشوف السبب.
const fsTTL = require('fs');
const pathTTL = require('path');
const indexSrc = fsTTL.readFileSync(pathTTL.join(__dirname, 'index.js'), 'utf8');

check('⏳ عمر الإشعار متعرّف في مكان واحد', () =>
  assert.ok(/const PUSH_TTL_SECONDS\s*=/.test(indexSrc), 'مش لاقي PUSH_TTL_SECONDS'));

const ttlMatch = indexSrc.match(/const PUSH_TTL_SECONDS\s*=\s*([^;]+);/);
const ttlValue = ttlMatch ? Function('return (' + ttlMatch[1] + ')')() : 0;

// ⚠️ ساعة على الأقل: التليفون المقفول في الجيب بيعدّي الـ١٠ دقايق
// بسهولة، وطلب التزويد بيفضل مطلوب.
check('⏳ ومش أقل من ساعة', () =>
  assert.ok(ttlValue >= 3600, 'الـTTL ' + ttlValue + ' ثانية — قصير أوي'));

// ⚠️ ومش أكتر من يوم: إشعار عمره يوم ممكن يكون الطلب اتنفّذ خلاص،
// فيرن على الفاضي.
check('⏳ ومش أكتر من يوم', () =>
  assert.ok(ttlValue <= 86400, 'الـTTL ' + ttlValue + ' ثانية — طويل أوي'));

// ⚠️⚠️ ولا نداء إرسال يفضل على رقم مكتوب بالإيد — ده اللي خلّى الرقم
// القديم يعيش في مكانين من غير ما حد ياخد باله.
check('⏳ ومافيش رقم مكتوب بالإيد في أي نداء', () =>
  assert.strictEqual((indexSrc.match(/TTL:\s*'\d+'/g) || []).length, 0));

const sendCount = (indexSrc.match(/sendEachForMulticast/g) || []).length;
check('⏳ وكل نداء إرسال بيستخدمه', () =>
  assert.strictEqual((indexSrc.match(/PUSH_TTL_SECONDS/g) || []).length, sendCount + 1));

// ⚠️ والأولوية عالية لازم تفضل: من غيرها أندرويد بيأجّل الإشعار لحد
// ما يصحّى الجهاز لأي سبب تاني.
check('⏳ والأولوية عالية في كل نداء', () =>
  assert.strictEqual((indexSrc.match(/Urgency:\s*'high'/g) || []).length, sendCount));


// ============================================================
// 📤 ابعت الطلبات المعلّقة
// ============================================================
// اتطلب بالنص: "ارسال الاشعارات اللي موجوده اللي هي الطلبات المعلقه
// ل الاجهزة اللي معاه تعديل في المخزن الرئيسي".
//
// ⚠⚠ ده **مش** إشعار جديد — إعادة إرسال للي موجود فعلًا، عشان
// اللي إشعاره ضاع (تليفون كان مقفول، إذن كان مقفول، جهاز مااتسجّلش).

// ⚠⚠⚠ أهم واحد: مافيش طلبات = **مافيش إشعار**. إشعار بيقول
// "مافيش حاجة" هو نفسه إزعاج، واللي بيدوس الزرار غالبًا بيدوسه
// وهو مش عارف فيه إيه.
check('📤 مافيش طلبات معلّقة = مافيش إشعار خالص', () => {
  assert.strictEqual(buildPendingMessage([]), null);
  assert.strictEqual(buildPendingMessage(null), null);
  assert.strictEqual(buildPendingMessage([{ categoryName: 'كريب', numbers: [] }]), null);
});

// فئة واحدة → نفس شكل الإشعار العادي، عشان مايبقاش شكل غريب
check('📤 فئة واحدة بتطلع زي الإشعار العادي', () => {
  const m = buildPendingMessage([{ categoryName: 'كريب سادة', numbers: [5, 6] }]);
  assert.ok(m.body.includes('كريب سادة'), m.body);
  assert.ok(m.body.includes('5') && m.body.includes('6'), m.body);
});

// ⚠️ العدد في العنوان: ده الفرق بين "فيه طلب" و"فيه تمنية مستنيين"
check('📤 والعنوان بيقول العدد الكلي', () => {
  const m = buildPendingMessage([
    { categoryName: 'كريب', numbers: [1, 2] },
    { categoryName: 'شيفون', numbers: [7] },
  ]);
  assert.ok(m.title.includes('3'), m.title);
});

// ⚠️ وبسقف على عدد الفئات: الإشعار بيتقص على التليفون
check('📤 وكذا فئة بتتلمّ بسقف', () => {
  const rows = ['أ', 'ب', 'ج', 'د', 'هـ'].map((n) => ({ categoryName: n, numbers: [1] }));
  const m = buildPendingMessage(rows);
  assert.ok(m.body.includes('غيرهم'), m.body);
  assert.ok(m.body.length < 120, 'الجسم طويل أوي: ' + m.body);
});

// ⚠⚠ الوسم **لوحده**: لو اداناه وسم فئة كان هيمسح إشعارها، ولو
// اداناه الوسم العام كان هيمسح الإشعار المحلي.
check('📤 ووسمه لوحده مش وسم فئة ولا العام', () => {
  assert.notStrictEqual(PENDING_TAG, PUSH_TAG);
  assert.notStrictEqual(PENDING_TAG, categoryTag('c1'));
  // ⚠️ بس لسه بيبدأ بالوسم العام — عشان المسح عند فتح النظام
  // يلاقيه (بيدوّر على اللي بيبدأ بـtazweed-restock).
  assert.ok(PENDING_TAG.startsWith(PUSH_TAG), PENDING_TAG);
});

// ⚠⚠ الصلاحية بتتفحص في السحابة: القواعد بتسمح لأي حد يكتب
// المستند ده لنفسه، فالشاشة لوحدها مش حارس.
check('📤 اللي صلاحيته مقفولة بالاسم مايبعتش', () => {
  assert.strictEqual(canSendPending({ role: 'owner', perms: { editMainQty: false } }), false);
  assert.strictEqual(canSendPending(null), false);
});

// ============================================================
// ⚠️⚠️ الرتبة هي اللي بتحكم لما مافيش قرار صريح
// ============================================================
// العطل اللي اتمسك في فحص أمان على المشروع كله: الدالة كانت بتقرا
// القرار الصريح المتخزّن وبس، وترجّع "مسموح" لو الخانة فاضية. والخانة
// بتبقى فاضية في الحالة الطبيعية — خيار "زي الرتبة" مابيتخزّنش.
//
// ⚠️ والفحص القديم كان **بيثبّت العطل** (perms فاضية = مسموح)، فاتغيّر.
check('📤⭐ الرتبة اللي قالبها مقفول مابتبعتش (من غير قرار صريح)', () => {
  assert.strictEqual(canSendPending({ role: 'print_operator' }), false, 'موظف طباعة');
  assert.strictEqual(canSendPending({ role: 'user' }), false, 'مستخدم عادي');
  assert.strictEqual(canSendPending({ role: 'supervisor' }), false, 'مشرف');
});

check('📤⭐ والرتبة اللي قالبها مفتوح بتبعت', () => {
  assert.strictEqual(canSendPending({ role: 'owner' }), true);
  assert.strictEqual(canSendPending({ role: 'branch_manager' }), true);
  assert.strictEqual(canSendPending({ role: 'warehouse_keeper' }), true, 'أمين المخزن قالبه بيسمح');
});

// ⚠️ القرار الصريح بيكسب في **الاتجاهين** — مفتوح أو مقفول.
check('📤⭐ القرار الصريح بيكسب على الرتبة', () => {
  assert.strictEqual(canSendPending({ role: 'user', perms: { editMainQty: true } }), true);
  assert.strictEqual(canSendPending({ role: 'branch_manager', perms: { editMainQty: false } }), false);
});

// ⚠️ رتبة مش معروفة = ممنوع. الافتراضي عند الشك هو **المنع**.
check('📤 ورتبة مش معروفة ممنوعة', () => {
  assert.strictEqual(canSendPending({ role: 'ghost' }), false);
  assert.strictEqual(canSendPending({}), false);
});

// ⚠⚠ المهلة: دوسة متكررة معناها إن تليفون كل الموظفين يرن عشر مرات
check('📤 ومهلة بين الإرسالتين', () => {
  const now = 1000000;
  assert.strictEqual(pendingCooldownLeft(0, now), 0, 'أول مرة مفيش مهلة');
  assert.strictEqual(pendingCooldownLeft(now - PENDING_COOLDOWN_MS - 1, now), 0, 'بعد المهلة عادي');
  assert.ok(pendingCooldownLeft(now - 1000, now) > 0, 'من ثانية = لسه في المهلة');
});

// ⚠️ والسحابة بتفحص الصلاحية فعلًا — مش بتكتفي بالشاشة
check('📤 والدالة في السحابة بتنده canSendPending', () =>
  assert.ok(indexSrc.includes('canSendPending(profile)'), 'مش بتفحص الصلاحية'));

check('📤 وبتقرا الطلبات المعلّقة من كل الفئات', () =>
  assert.ok(indexSrc.includes("collectionGroup('grades')"), 'مش بتلم الفئات'));

console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
process.exit(fail.length ? 1 : 0);

