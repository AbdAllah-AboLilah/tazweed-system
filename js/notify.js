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

// طرقة واحدة: دفعة ضوضاء قصيرة بتخفت بسرعة، مفلترة عشان تبقى "خشبية"
// مش "شششش".
function knockAt(ctx, when) {
  const DUR = 0.055;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * DUR));
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  // الفلتر بيحدد "خامة" الطرقة. ثابت للطرقتين — فمافيش فرق درجة بينهم.
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1500;
  band.Q.value = 1.2;

  // خفوت سريع = طرقة. الخفوت البطيء هو اللي بيخلي الصوت "نغمة".
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.9, when + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + DUR);

  src.connect(band).connect(gain).connect(ctx.destination);
  src.start(when);
  src.stop(when + DUR);
}

function playNotifySound() {
  try {
    unlockNotifyAudio();
    if (!notifyAudioCtx || notifyAudioCtx.state !== 'running') return;
    const t = notifyAudioCtx.currentTime + 0.01;
    knockAt(notifyAudioCtx, t);
    knockAt(notifyAudioCtx, t + 0.13); // نفس الطرقة بالظبط — مش درجة تانية
  } catch (err) {
    /* الصوت مش لازم عشان الإشعار يوصل */
  }
}

// ============================================================
// عرض الإشعار
// ============================================================
// ⚠️ `new Notification()` **بترمي خطأ على أندرويد** — كروم على الموبايل
// بيفرض إن الإشعار يتعرض من الـService Worker. فالطريق الأساسي هو الـSW،
// و`new Notification` مجرد احتياطي للكمبيوتر لو الـSW مش جاهز.
async function showRestockNotification(count, names) {
  const title = count === 1 ? 'طلب تزويد جديد' : `${count} طلبات تزويد جديدة`;
  const body = names.length
    ? names.slice(0, 4).join('، ') + (names.length > 4 ? ` و${names.length - 4} غيرهم` : '')
    : 'افتح النظام عشان تشوفهم';
  const opts = {
    body,
    tag: NOTIFY_TAG, // الوسم ده هو اللي بيخلي إشعار واحد يتحدّث بدل كومة
    renotify: false, // ⚠️ true معناها النظام يرن تاني — والنغمة عندنا بإيدنا
    silent: true, // ⚠️ سكوت من النظام عن قصد: النغمة بتاعتنا هي اللي بترن
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
  notifyPendingCount += fresh.length;

  if (startingNewBurst || silentTooLong) {
    notifyLastSoundAt = Date.now();
    playNotifySound();
  }
  if (!visible) showRestockNotification(notifyPendingCount, notifyLastNames);
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
