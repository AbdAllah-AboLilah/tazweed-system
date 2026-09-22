// ============================================================
// 🛡️ قواعد السحابة لازم تقول نفس كلام الشاشة — مفتاح بمفتاح
// ============================================================
// اتبلّغ بالنص: "تعارض صلاحية — firestore.rules بيدي seeRestockLastPrint
// لمدير الفرع، وpermissions.js بيقفلها — واحد منهم غلط".
//
// ⚠️⚠️ وليه ده خطر مش تفصيلة:
//
// القاعدة في السحابة بتشتغل كده: لو الحساب متخزّن عنده **قرار صريح**
// للمفتاح، بتاخده؛ ولو مش متخزّن، بترجع لقالب الرتبة اللي مكتوب في
// presetHas. وفي شاشة الحسابات، خيار "زي الرتبة" **مابيتخزّنش** —
// يعني كل حساب متساب على الافتراضي بياخد إجابته من presetHas.
//
// فلو presetHas اختلفت عن ROLE_PRESETS، الشاشة بتخبّي الزرار والسحابة
// سايبة الباب مفتوح — والحساب ياخد إجابتين مختلفتين من المكانين، ومحدش
// ياخد باله، لأن اللي بيبص على الشاشة شايفها متقفلة.
//
// ⚠️ الفحص ده **بيقرا الملفين** مش نسخة مكتوبة هنا: لو حد غيّر واحد
// ونسي التاني، بيفشل **بالاسم** ويقول المفتاح والرتبة.
//
// ⚠️⚠️ ومابيحتاجش محاكي Firestore: مقارنة نصّية، فبيشتغل في أي مكان.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rulesSrc = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const permsSrc = fs.readFileSync(path.join(root, 'js/permissions.js'), 'utf8');

const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 400)}` : ''));

// ------------------------------------------------------------
// قوالب الشاشة
// ------------------------------------------------------------
const box = {};
new Function(permsSrc + '\n;this.ROLE_PRESETS=ROLE_PRESETS;this.PERMISSION_GROUPS=PERMISSION_GROUPS;').call(box);
const PRESETS = box.ROLE_PRESETS;
const UI_KEYS = [];
box.PERMISSION_GROUPS.forEach((g) => g.items.forEach((i) => UI_KEYS.push(i.key)));

// ------------------------------------------------------------
// قوالب السحابة — بتتقرا من presetHas نفسها
// ------------------------------------------------------------
function parsePresetHas(src) {
  const at = src.indexOf('function presetHas');
  if (at < 0) return null;
  // من أول الدالة لحد أول `;` بعد الـreturn
  const body = src.slice(at, src.indexOf(';', src.indexOf('return', at)));
  const out = {};
  // كل سطر رتبة: role() == 'X' && [!](key in ['a','b'])
  const re = /role\(\)\s*==\s*'([a-z_]+)'\s*&&\s*(!?)\(?key in \[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(body))) {
    out[m[1]] = {
      mode: m[2] === '!' ? 'except' : 'only',
      keys: m[3].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean),
    };
  }
  return out;
}
const RULES = parsePresetHas(rulesSrc);

check('⭐ الفحص لاقى presetHas في قواعد السحابة وقراها',
  RULES && Object.keys(RULES).length >= 5, RULES && Object.keys(RULES));

// ⚠️ حارس على الفحص نفسه: لو شكل presetHas اتغيّر والقراءة رجّعت فاضي،
// الفحص كان هيعدّي **وهو مش بيقارن حاجة**. ده أسوأ من إنه يفشل.
if (RULES) {
  Object.keys(RULES).forEach((r) => {
    check(`قايمة الرتبة "${r}" مش فاضية`, RULES[r].keys.length > 0, RULES[r]);
  });
}

// ------------------------------------------------------------
// ⭐⭐ المقارنة — مفتاح بمفتاح لكل رتبة
// ------------------------------------------------------------
// منشئ النظام والمدير القديم مستثنيين: القواعد بتديهم كل حاجة صراحةً.
const SKIP = ['owner', 'admin'];

// ============================================================
// ⚠️⚠️ مفتاح الشاشة اللي **مالوش** أي تعامل مع السحابة
// ============================================================
// downloadHelper بيخفّي/يظهّر رابط تحميل ملف ثابت على نفس الموقع —
// مافيش أي قراءة ولا كتابة في Firestore وراه. فوجوده في presetHas
// مايزوّدش حماية، بالعكس: بيخلي اللي بيقرا يفتكر إن السحابة بتحرسه
// وهي مش بتعمل حاجة. (نفس القايمة والسبب في perms-test.js — ولو
// المفتاح بقى ليه تعامل مع السحابة، مكانه يخرج من هنا ومن هناك.)
const UI_ONLY_KEYS = ['downloadHelper'];
const drift = [];
Object.keys(PRESETS).forEach((role) => {
  if (SKIP.includes(role)) return;
  const rule = RULES && RULES[role];
  if (!rule) {
    drift.push(`الرتبة "${role}" مالهاش سطر في presetHas خالص`);
    return;
  }
  Object.keys(PRESETS[role]).forEach((key) => {
    if (UI_ONLY_KEYS.includes(key)) return;
    const inCloud = rule.mode === 'except' ? !rule.keys.includes(key) : rule.keys.includes(key);
    const inUI = !!PRESETS[role][key];
    if (inCloud !== inUI) {
      drift.push(`${role}.${key}: السحابة=${inCloud} الشاشة=${inUI}`);
    }
  });
});
check('⭐⭐⭐ كل مفتاح في كل رتبة بيقول نفس الكلام في السحابة وفي الشاشة',
  drift.length === 0, drift);

// ------------------------------------------------------------
// ⭐ مفتاح في الشاشة ومش في القوالب = ديكور
// ------------------------------------------------------------
// ⚠️ مكتوب في القواعد نفسها: "أي مفتاح جديد يتضاف في permissions.js
// لازم يتضاف هنا كمان، وإلا هيبقى مجرد ديكور".
const missingFromPresets = UI_KEYS.filter(
  (k) => !Object.keys(PRESETS).some((r) => !SKIP.includes(r) && k in PRESETS[r])
);
check('⭐ كل مفتاح ظاهر في شاشة الحسابات موجود في قوالب الرتب',
  missingFromPresets.length === 0, missingFromPresets);

// ------------------------------------------------------------
// ⭐⭐⭐ ومكان تالت بيقرا نفس القالب: دالة الإشعارات في السحابة
// ------------------------------------------------------------
// ⚠️⚠️ العطل اللي اتمسك في فحص أمان: canSendPending في السحابة كانت
// بتقرا **القرار الصريح المتخزّن** على الحساب وبس، وترجّع "مسموح" لو
// الخانة فاضية. والخانة بتبقى فاضية في الحالة الطبيعية، لأن خيار
// "زي الرتبة" في شاشة الحسابات **مابيتخزّنش**.
//
// النتيجة المقيسة: موظف الطباعة والمستخدم العادي والمشرف كانوا بيقدروا
// يرنّوا تليفون كل الموظفين، وقالبهم بيقول "مقفول".
//
// ⚠️ الدالة دي بتتنشر لوحدها في السحابة ومابتقراش js/permissions.js،
// فعندها قايمة رتب مختصرة. الفحص ده هو اللي بيمنعها تفرق عن القالب.
const notifyCore = fs.readFileSync(path.join(root, 'functions/notify-core.js'), 'utf8');
const sendAllMatch = notifyCore.match(/SEND_ALL_ROLES\s*=\s*\[([^\]]*)\]/);
const sendAll = sendAllMatch
  ? sendAllMatch[1].split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean)
  : null;

check('⭐ الفحص لاقى قايمة الرتب في دالة الإشعارات', Array.isArray(sendAll) && sendAll.length > 0, sendAll);

if (sendAll) {
  const shouldSend = Object.keys(PRESETS).filter((r) => PRESETS[r].editMainQty === true);
  const extra = sendAll.filter((r) => !shouldSend.includes(r));
  const missing = shouldSend.filter((r) => !sendAll.includes(r));
  check('⭐⭐⭐ اللي بيبعت للكل في السحابة = اللي قالبه بيسمح بتعديل المخزن الرئيسي',
    extra.length === 0 && missing.length === 0, { extra, missing, sendAll, shouldSend });
}

// ------------------------------------------------------------
// ⭐ اسم مفتاح غلط في القواعد = شرط عمره ما هيتحقق
// ------------------------------------------------------------
// ⚠️ ده بيمسك غلطة الكتابة: 'printLable' في القواعد مش هتطابق أي مفتاح
// حقيقي، والرتبة تفضل مقفولة من غير ما حد يفهم ليه.
const known = new Set(UI_KEYS);
const unknown = [];
if (RULES) {
  Object.keys(RULES).forEach((r) => {
    RULES[r].keys.forEach((k) => {
      if (!known.has(k)) unknown.push(`${r}: "${k}"`);
    });
  });
}
check('⭐ مفيش اسم مفتاح في القواعد مش موجود في permissions.js', unknown.length === 0, unknown);

if (fail.length) {
  console.log(`❌ فشل (${fail.length}):`);
  fail.forEach((f) => console.log('   ' + f));
  console.log(`\n✅ نجح (${pass.length})`);
  process.exit(1);
}
console.log(`✅ نجح (${pass.length})`);
pass.filter((x) => x.startsWith('⭐')).forEach((x) => console.log('   ' + x));
