// ============================================================
// إشعارات طلبات التزويد
// ============================================================
// المشكلة اللي بتحلها: أمين المخزن الرئيسي مكانش يعرف إن فيه طلب تزويد
// جديد **إلا لما يبص على الشاشة**. والنظام أصلًا عارف باللحظة (فيه اشتراك
// حي على كل الدرجات في `subscribeOverview`) — كنا بس مش بنعمل حاجة بالخبر.
//
// ------------------------------------------------------------
// حدود الحاجة دي — مكتوبة هنا عشان محدش يتوقّع منها اللي مش بتعمله
// ------------------------------------------------------------
// الإشعار ده بيشتغل **والنظام شغّال على الجهاز**. مافيش سيرفر بيبعت
// إشعارات (النظام كله ملفات ساكنة على GitHub Pages)، فالجهاز نفسه هو اللي
// بيلاحظ الطلب وبيعرض الإشعار.
//
//   النظام قدامك مفتوح             ✅
//   بدّلت لتطبيق تاني من شوية       ✅
//   بدّلت من ربع ساعة / الشاشة قافلة ❌ أندرويد بيجمّد الصفحة
//   قافل النظام خالص                ❌
//
// الإشعار وهو والتطبيق مقفول محتاج Web Push بسيرفر — حاجة تانية مستقلة،
// والشغل اللي هنا (الشكل، النغمة، مين يستقبل، منع التكرار) **بيتشارك
// معاها** فمش هيترمي.
//
// ------------------------------------------------------------
// مين بيستقبل — من غير أي قايمة تتظبط
// ------------------------------------------------------------
// كل جهاز بيقرر **لنفسه**: بيبص على صلاحية `editMainQty` بتاعت صاحبه
// الحالية ويقرر يعرض الإشعار ولا لأ. الصلاحية جاية من السحابة حيّة
// (`unsubProfile`)، فلو فتحت الصلاحية لحد النهارده، جهازه يبدأ يرن
// **من غير تحديث ولا تسجيل ولا حتى إعادة فتح**. ولو قفلتها، يسكت فورًا.
//
// ده الفرق العملي بين الطريقة دي وبين سيرفر بيبعت: السيرفر محتاج يعرف
// مين، ويحتفظ بقايمة، والقايمة بتبوظ. هنا مافيش قايمة أصلًا.

const NOTIFY_TAG = 'tazweed-restock'; // نفس الوسم = الإشعار **بيستبدل** اللي قبله
const NOTIFY_ENABLED_KEY = 'notify_restock'; // مفتاح المستخدم (تشغيل/إيقاف)

// لو المستخدم ساب الإشعار من غير ما يفتحه، ماينفعش نفضل ساكتين للأبد —
// بعد المدة دي بنرن تاني على أول طلب جديد.
const RESOUND_AFTER_MS = 5 * 60 * 1000;

let notifyBaseline = null; // مفتاح كل درجة معلّقة وقت ما النظام فتح
let notifyPendingCount = 0; // كام طلب جديد لسه المستخدم مشافهوش
let notifyLastSoundAt = 0;
let notifyLastNames = [];

// ------------------------------------------------------------
// مفتاح التشغيل
// ------------------------------------------------------------
// افتراضيًا **مقفول**. مايصحّش نطلب إذن إشعارات من حد ماطلبهاش — المتصفح
// بيفتكر الرفض وبيبقى صعب جدًا ترجع تطلب تاني.
function notifyEnabled() {
  return lsGet(NOTIFY_ENABLED_KEY, false) === true;
}

function setNotifyEnabled(on) {
  lsSet(NOTIFY_ENABLED_KEY, !!on);
}

// الإشعارات بتخص **اللي بيرد على الطلبات** فعلًا.
//
// ⚠️ `can(profile, 'editMainQty')` **مش كفاية لوحدها**. فيه خانة تانية
// اسمها `warehouseAccess` بتقول المستخدم ده مسموح له بأنهي مخزن — فحساب
// معاه المفتاح بس محصور على الفرع **مايقدرش يزوّد**، وكان هيوصله إشعار
// بحاجة مالوش عليها زرار. `canEditWarehouse` بتجمع الاتنين، وهي بالظبط
// نفس الدالة اللي بتحدد ظهور زرار "✅ زوّد" في الجدول — فاللي بيرن عنده
// التليفون هو اللي قدامه الزرار، مش أكتر ولا أقل.
function notifyAudience() {
  return typeof canEditWarehouse === 'function' && canEditWarehouse(state.profile, 'main');
}

function notifySupported() {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
}

// ============================================================
// النغمة — طرقتين على الباب، من غير أي موسيقى
// ============================================================
// ⚠️ الشرط ده مقصود ومتطلب: **مافيش أي نغمة موسيقية**. عشان كده الصوت
// مبني بطريقة تخلي ده **مستحيل تقنيًا** مش مجرد اختيار ذوق:
//
//   1) مافيش `OscillatorNode` خالص في الملف ده. المُذبذب هو اللي بيطلّع
//      النغمات (دو ري مي). مصدر الصوت الوحيد هنا **ضوضاء عشوائية**
//      (نفس فكرة صوت الطرق على الخشب) — الضوضاء مالهاش درجة موسيقية.
//   2) الطرقتين **نسخة واحدة بالظبط** مكرّرة. اللحن معناه فرق بين درجتين
//      متتاليتين؛ لما الاتنين متطابقين، مافيش فرق يتسمّى لحن.
//
// النتيجة: صوت زي الطرق على باب — واضح ومميز ومش بيتلخبط مع إشعارات
// التطبيقات التانية، ومالوش أي علاقة بالموسيقى.
let notifyAudioCtx = null;

// المتصفح مابيسمحش بصوت قبل ما المستخدم يلمس الصفحة. بنجهّز المحرّك على
// أول لمسة وخلاص — من غير ما نشغّل حاجة.
function unlockNotifyAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!notifyAudioCtx) notifyAudioCtx = new Ctx();
    if (notifyAudioCtx.state === 'suspended') notifyAudioCtx.resume();
  } catch (err) {
    /* مافيش صوت — الإشعار نفسه لسه شغّال */
  }
}

// ------------------------------------------------------------
// ليه الطرقة **متبنية بالحساب ومتخزّنة**، مش متعملة كل مرة
// ------------------------------------------------------------
// ⚠️ النسخة الأولى كانت بتعمل الطرقة بـ`BiquadFilter` و`GainNode` وقت
// التشغيل، وكانت **هادية جدًا** (الصوت الفعلي ذروته 0.37 من 1). ولما
// جرّبت أزوّد الكسب، لقيت المشكلة الحقيقية بالقياس:
//
//   **ذروة الضوضاء عشوائية.** نفس الإعداد بالظبط، 8 تشغيلات:
//
//     كسب 2.2 → أقصى ذروة 1.07  (قص بسيط)
//     كسب 2.6 → أقصى ذروة 1.43  (27 عيّنة مقصوصة)
//     كسب 3.0 → أقصى ذروة 1.90  (89 عيّنة مقصوصة)
//
//   يعني مافيش رقم كسب "آمن" — الصوت إما هادي وإما بيفرقع أحيانًا.
//   وحتى `DynamicsCompressor` ماحلّهاش (بطيء على هجوم 4 مللي ثانية).
//
// الحل: نبني الطرقة **مرة واحدة** بالحساب اليدوي، ونطبّعها لذروة معروفة
// بالظبط. النتيجة:
//   • الصوت **ثابت** كل مرة، ومفيش فرقعة أبدًا
//   • أعلى بـ3 أضعاف من غير أي قص
//   • وكل الطرقات **نفس العيّنات حرفيًا** (نفس الـbuffer) — فضمان
//     "مافيش لحن" بقى في التصميم نفسه مش في الالتزام
const KNOCK_DUR = 0.09; // طول الطرقة الواحدة بالثانية
const KNOCK_GAP = 0.15; // المسافة بين طرقة والتانية
const KNOCK_COUNT = 4; // ⭐ اتزوّدت من 2 لـ4: النغمة كانت بتعدّي من غير ما حد ياخد باله
const KNOCK_PEAK = 0.92; // الذروة بعد التطبيع — قريبة من الأقصى من غير قص
let knockBuffer = null;

function buildKnockBuffer(ctx) {
  const SR = ctx.sampleRate;
  const n = Math.max(1, Math.floor(SR * KNOCK_DUR));
  const buf = ctx.createBuffer(1, n, SR);
  const d = buf.getChannelData(0);

  // مرشّح تمرير نطاق بسيط بالحساب (تقريبًا 900–2600 هرتز). النطاق ده
  // مقصود: سماعة الموبايل ضعيفة تحت 500 هرتز، فالصوت الواطي بيضيع خالص.
  const aLP = 1 - Math.exp((-2 * Math.PI * 2600) / SR);
  const rc = 1 / (2 * Math.PI * 900);
  const aHP = rc / (rc + 1 / SR);

  let lp = 0, hp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    lp += aLP * (white - lp);
    hp = aHP * (hp + lp - prev);
    prev = lp;
    // خفوت أسّي سريع = طرقة. الخفوت البطيء هو اللي بيخلي الصوت "نغمة".
    const decay = Math.exp(-i / (SR * 0.018));
    // هجوم قصير جدًا (1 مللي) — من غيره بيطلع "تك" رقمي وحش
    const attack = Math.min(1, i / (SR * 0.001));
    d[i] = hp * decay * attack;
  }

  // ⭐ التطبيع: ده اللي بيخلي الصوت **عالي وثابت** في نفس الوقت
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) {
    const k = KNOCK_PEAK / peak;
    for (let i = 0; i < n; i++) d[i] *= k;
  }
  return buf;
}

// طرقة واحدة في وقت محدد. ⚠️ مافيش أي معامل للدرجة أو التردد هنا **عن
// قصد**: الدالة مابتعرفش تعمل غير صوت واحد، فمستحيل طرقتين يطلعوا مختلفين.
function knockAt(ctx, when) {
  if (!knockBuffer || knockBuffer.sampleRate !== ctx.sampleRate) knockBuffer = buildKnockBuffer(ctx);
  const src = ctx.createBufferSource();
  src.buffer = knockBuffer;
  src.connect(ctx.destination);
  src.start(when);
}

// ⭐ بترجّع **true لو رنّت فعلًا**. القيمة دي مهمة: لو مارنّتش، لازم
// نسيب أندرويد يرن بنغمته بدل ما الإشعار يطلع ساكت تمامًا.
function playNotifySound() {
  try {
    unlockNotifyAudio();
    if (!notifyAudioCtx || notifyAudioCtx.state !== 'running') return false;
    const t = notifyAudioCtx.currentTime + 0.01;
    // طرقات متساوية تمامًا وعلى مسافات متساوية — لا فرق درجة (لحن) ولا
    // نمط إيقاعي.
    for (let k = 0; k < KNOCK_COUNT; k++) knockAt(notifyAudioCtx, t + k * KNOCK_GAP);
    return true;
  } catch (err) {
    /* الصوت مش لازم عشان الإشعار يوصل */
    return false;
  }
}

// ============================================================
// عرض الإشعار
// ============================================================
// ⚠️ `new Notification()` **بترمي خطأ على أندرويد** — كروم على الموبايل
// بيفرض إن الإشعار يتعرض من الـService Worker. فالطريق الأساسي هو الـSW،
// و`new Notification` مجرد احتياطي للكمبيوتر لو الـSW مش جاهز.
// ============================================================
// ⚠️⚠️ الإشعار الساكت — العطل اللي كان هيفضّي الميزة من معناها
// ============================================================
// كان الإشعار متبعت `silent: true` **دايمًا**، عشان نغمتنا (الطرقات) هي
// اللي ترن مش نغمة أندرويد كمان. منطقي — بس فيه حالة بتكسره:
//
// لما تبدّل لتطبيق تاني، أندرويد بعد شوية **بيجمّد الصفحة** عشان يوفّر
// بطارية. وساعتها محرّك الصوت بتاعنا بيتوقف:
//
//   نغمتنا ......... ❌ مجمّدة
//   نغمة أندرويد ... ❌ إحنا قافلينها
//   النتيجة ........ **إشعار من غير أي صوت**
//
// يعني بالظبط في الحالة اللي المستخدم عايز يتنبّه فيها — وهو مش باصص
// على النظام. الميزة كلها اتعملت عشان الحالة دي.
//
// الحل: `ring` بتتحدد **بعد** ما نحاول نشغّل نغمتنا:
//   نغمتنا رنّت      → الإشعار ساكت (مانرنّش مرتين)
//   نغمتنا ماقدرتش   → أندرويد يرن بنغمته (صوت أحسن من سكوت)
//   وسط الدفعة       → ساكت (النغمة مرة واحدة في الدفعة، زي ما اتفقنا)
async function showRestockNotification(count, names, ring) {
  const title = count === 1 ? 'طلب تزويد جديد' : `${count} طلبات تزويد جديدة`;
  const body = names.length
    ? names.slice(0, 4).join('، ') + (names.length > 4 ? ` و${names.length - 4} غيرهم` : '')
    : 'افتح النظام عشان تشوفهم';
  const opts = {
    body,
    tag: NOTIFY_TAG, // الوسم ده هو اللي بيخلي إشعار واحد يتحدّث بدل كومة
    // ⚠️ `renotify` لازم تبقى true لو عايزين أندرويد يرن على إشعار بنفس
    // الوسم — من غيرها الاستبدال بيحصل **في سكوت** حتى لو silent=false.
    renotify: !!ring,
    silent: !ring, // الشرح فوق
    icon: './icon-192.png',
    badge: './icon-192.png',
    lang: 'ar',
    dir: 'rtl',
    data: { url: './index.html' },
  };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, opts);
      return true;
    }
    new Notification(title, opts);
    return true;
  } catch (err) {
    console.warn('تعذّر عرض الإشعار:', err);
    return false;
  }
}

async function clearRestockNotification() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.getNotifications) return;
    const list = await reg.getNotifications({ tag: NOTIFY_TAG });
    list.forEach((n) => n.close());
  } catch (err) {
    /* عادي */
  }
}

// ============================================================
// الطلب الجديد: إزاي بنعرف إنه **جديد** فعلًا
// ============================================================
// ⚠️ تلات فخاخ اتحطّت لهم حواجز هنا، وكل واحد فيهم كان هيخلي التليفون يرن
// غلط:
//
//   1) **أول لقطة بعد الفتح** فيها كل الطلبات المعلّقة من امبارح. من غير
//      خط أساس، فتح النظام = 30 إشعار.
//   2) **طلبك انت**. لو نفس الشخص عنده صلاحية الفرع والرئيسي، طلبه هيرجّع
//      له إشعار. `hasPendingWrites` بتفرّق بين كتابتي أنا وكتابة غيري.
//   3) **قطع النت والرجوع**. لما الاتصال يرجع، Firestore بيبعت اللقطة
//      تاني. بنقارن بالمفاتيح مش بالعدد — اللي كان معلّق ومفضل معلّق مش
//      "جديد".
function restockKeyOf(catId, gradeId) {
  return catId + '/' + gradeId;
}

// بتتنادى من `subscribeOverview` مع كل لقطة.
function onGradesSnapshotForNotify(snap) {
  if (!snap || !snap.docs) return;

  const pendingNow = new Set();
  const fresh = [];

  snap.docs.forEach((d) => {
    const g = d.data();
    if (g.status !== 'pending') return;
    const parent = d.ref.parent.parent;
    const catId = parent ? parent.id : '';
    if (!catId) return;
    const key = restockKeyOf(catId, d.id);
    pendingNow.add(key);
    // فخ (2): الكتابة دي لسه محليّة عندي = أنا اللي عملتها
    if (d.metadata && d.metadata.hasPendingWrites) return;
    if (notifyBaseline && !notifyBaseline.has(key)) fresh.push({ catId, id: d.id, g });
  });

  // فخ (1): أول لقطة بتتسجّل خط أساس وبس
  if (!notifyBaseline) {
    notifyBaseline = pendingNow;
    return;
  }
  notifyBaseline = pendingNow;

  if (!fresh.length) return;
  if (!notifyEnabled() || !notifyAudience()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  // النظام قدامك ومفتوح؟ يبقى انت شايف الطلب في الشاشة أصلًا — الإشعار
  // هنا مجرد إزعاج. الصوت بس هو المفيد.
  const visible = document.visibilityState === 'visible';

  notifyLastNames = fresh
    .map((f) => {
      const cat = (state.categories || []).find((c) => c.id === f.catId);
      const grade = f.g.isBase ? f.g.name || 'أساسية' : f.g.number;
      return (cat ? cat.name + ' ' : '') + grade;
    })
    .concat(notifyLastNames)
    .slice(0, 8);

  // ------------------------------------------------------------
  // ⭐ إشعار واحد بيتحدّث، والنغمة **مرة واحدة**
  // ------------------------------------------------------------
  // لو أمين الفرع طلب 20 درجة ورا بعض، 20 نغمة معناها إن التليفون هيفضل
  // يرن دقيقة — والنتيجة إن الإشعارات بتتقفل من أول يوم. فالنغمة بترن
  // **أول مرة في الدفعة بس**، والباقي بيحدّث نص نفس الإشعار في سكوت.
  const startingNewBurst = notifyPendingCount === 0;
  const silentTooLong = Date.now() - notifyLastSoundAt > RESOUND_AFTER_MS;
  const shouldRing = startingNewBurst || silentTooLong;
  notifyPendingCount += fresh.length;

  let ourSoundRang = false;
  if (shouldRing) {
    notifyLastSoundAt = Date.now();
    ourSoundRang = playNotifySound();
  }
  // ⭐ أندرويد يرن **بس** لو كان المفروض يرن ونغمتنا ماقدرتش (الصفحة
  // متجمّدة). غير كده الإشعار ساكت زي ما كان.
  if (!visible) showRestockNotification(notifyPendingCount, notifyLastNames, shouldRing && !ourSoundRang);
}

// المستخدم رجع للنظام = شافهم. العدّاد بيتصفّر فالدفعة الجاية ترن من جديد.
function resetRestockBurst() {
  notifyPendingCount = 0;
  notifyLastNames = [];
  clearRestockNotification();
}

// تصفير كامل — بيتنادى مع تغيير الحساب (دخول/خروج). الفرق عن اللي فوق إن
// **خط الأساس** بيتشال كمان، فأول لقطة للحساب الجديد تتسجّل من الأول ولا
// ترن على طلبات كانت موجودة قبل ما يدخل.
function resetRestockNotifyState() {
  notifyBaseline = null;
  notifyLastSoundAt = 0;
  resetRestockBurst();
}

// ============================================================
// طلب الإذن
// ============================================================
// ⚠️ لازم يتنادى من **ضغطة المستخدم**. لو اتنادى لوحده، سفاري بترفض،
// وكروم بيعتبره "إزعاج" وممكن يحجب الطلب خالص. وده قرار مالوش رجعة تقريبًا
// من ناحيتنا: لو المستخدم رفض، مافيش أي طريقة نسأله تاني من النظام.
async function enableRestockNotifications() {
  if (!notifySupported()) {
    alert('⚠️ المتصفح ده مابيدعمش الإشعارات.\n\nلو على آيفون: لازم تضيف النظام للشاشة الرئيسية الأول.');
    return false;
  }
  unlockNotifyAudio(); // إحنا جوه ضغطة — دي فرصتنا نجهّز الصوت

  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();

  if (perm !== 'granted') {
    alert('⚠️ الإشعارات مرفوضة من إعدادات المتصفح.\n\nلازم تفتحها من إعدادات الموقع في المتصفح — النظام مش قادر يسأل تاني.');
    return false;
  }
  setNotifyEnabled(true);
  playNotifySound(); // يسمع النغمة عشان يعرف شكلها
  return true;
}

function disableRestockNotifications() {
  setNotifyEnabled(false);
  resetRestockBurst();
}

// حالة المفتاح للشاشة: شغّال / مقفول / المتصفح رافض
function restockNotifyState() {
  if (!notifySupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (!notifyEnabled()) return 'off';
  if (Notification.permission !== 'granted') return 'off';
  return 'on';
}

// ============================================================
// الزرار في القايمة
// ============================================================
// بيظهر **بس** للي عنده صلاحية الرد على الطلبات — غيره مالوش لازمة يشوفه.
// ولأن الصلاحية بتتقرا حيّة، الزرار بيظهر ويختفي لوحده لما تفتحها أو
// تقفلها من شاشة الحسابات.
function restockNotifyButtonHTML() {
  if (!notifyAudience()) return '';
  const st = restockNotifyState();
  if (st === 'unsupported') return '';
  const label = {
    on: '🔔 إشعارات التزويد: شغّالة',
    off: '🔕 شغّل إشعارات التزويد',
    blocked: '🔕 الإشعارات محجوبة من المتصفح',
  }[st];
  return `<button class="btn" id="restock-notify-btn">${label}</button>`;
}

async function toggleRestockNotifications() {
  const st = restockNotifyState();
  if (st === 'blocked') {
    alert(
      '⚠️ الإشعارات محجوبة من إعدادات المتصفح نفسه، مش من النظام.\n\n' +
        'افتح إعدادات الموقع في المتصفح واسمح بالإشعارات، وبعدين ارجع اضغط الزرار ده تاني.'
    );
    return;
  }
  if (st === 'on') {
    disableRestockNotifications();
  } else {
    await enableRestockNotifications();
  }
  if (typeof render === 'function') render();
}

// ------------------------------------------------------------
// الربط بالصفحة
// ------------------------------------------------------------
// أول لمسة بتجهّز محرّك الصوت. `once` عشان مايفضلش شغّال على كل لمسة.
['pointerdown', 'keydown'].forEach((ev) =>
  document.addEventListener(ev, unlockNotifyAudio, { once: true, passive: true })
);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resetRestockBurst();
});
