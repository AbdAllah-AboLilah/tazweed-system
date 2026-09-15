// إشعار "فيه تحديث جديد" — JavaScript عادي، بيضيف بانر مستقل تحت الشاشة
// (منفصل عن #root عشان الرندر بتاع الداشبورد ميمسحوش).

// تحديث تلقائي بالكامل: أول ما نسخة جديدة تتحمّل في الخلفية، بتتفعّل
// لوحدها من غير ما تحتاج ضغطة من المستخدم — فقط رسالة صغيرة أثناء
// التحديث نفسه (لثوانٍ) عشان الشاشة متتغيّرش فجأة من غير أي تنبيه.

let isApplyingUpdate = false;

function initUpdatePrompt() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      if (registration.waiting) {
        applyUpdate(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            applyUpdate(newWorker);
          }
        });
      });

      // ⚠️ ده اللي كان ناقص وسبّب مشكلة حقيقية:
      // كمبيوتر الكاشير بيفضل التبويب مفتوح عليه أيام من غير ما حد يعمل
      // Refresh، والمتصفح لوحده بيسأل عن تحديث للـservice worker مرة كل
      // 24 ساعة تقريبًا. النتيجة إن التليفون بقى على نسخة جديدة والكمبيوتر
      // لسه على القديمة — والطباعة اللي بتتبعت بينهم بتطلع غلط.
      //
      // فبنسأل عن تحديث كل نص ساعة، وكمان أول ما التبويب يرجع قدام أو
      // النت يرجع. لو مفيش تحديث، السؤال ده رخيص جدًا (رد 304 وخلاص).
      const checkForUpdate = () => registration.update().catch(() => {});
      setInterval(checkForUpdate, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkForUpdate();
      });
      window.addEventListener('online', checkForUpdate);
    })
    .catch((err) => console.error('تعذّر تسجيل service worker:', err));

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    reloadWhenSafe(0);
  });
}

// ============================================================
// ⚠⚠ التحديث مايقطعش طبعة شغّالة ولا حد بيكتب
// ============================================================
// قبل كده كان السطر location.reload() مباشرة، من غير أي سؤال.
// يعني لو نزل تحديث وانت بتطبع 200 ملصق، الصفحة بتقفل **في النص**.
//
// ⚠️ والحارس ده موجود ومتفحوص في النظام من زمان (waitThenReload في
// print-core للريفريش عن بُعد) — المكان ده بس هو اللي كان بيعدّي
// من جنبه.
const UPDATE_WAIT_MAX_S = 600;   // 10 دقايق سقف — زي الريفريش عن بُعد بالظبط
const RESUME_KEY = 'tazweed_resume_screen';
const RESUME_MAX_AGE_MS = 120000;

function reloadWhenSafe(secs) {
  const printing = typeof activePrintCancel !== 'undefined' && activePrintCancel !== null;
  const typing = typeof isUserTyping === 'function' && isUserTyping();
  if ((printing || typing) && secs < UPDATE_WAIT_MAX_S) {
    setTimeout(() => reloadWhenSafe(secs + 2), 2000);
    return;
  }
  rememberScreenForResume();
  try { window.location.reload(); } catch (err) { console.warn('تعذّر تحديث الصفحة:', err); }
}

// ============================================================
// ⭐⭐ وبعد ما يفتح تاني، بيرجّعك لنفس الشاشة
// ============================================================
// العطل اللي بيتحل، اتبلّغ بالنص:
//   "لما بدخل النظام لاول مرة لو فتحت حاجه بسرعة ... الحاجه اللي
//    فاتحها بتقفل وبرجع تاني ل الشاشة الرئيسية"
//
// ده مش عطل في النظام — ده التحديث بيتركّب. بس مافيش سبب
// يخليه يضيّع مكانك.
//
// ⚠️ بمهلة دقيقتين: لو العلامة قديمة (المتصفح قفل واتفتح تاني
// بكرة مثلًا) بنتجاهلها ونفتح على الرئيسية زي ما هو متعوّد.
function rememberScreenForResume() {
  try {
    if (typeof state === 'undefined' || !state || !state.screen || state.screen === 'home') return;
    localStorage.setItem(RESUME_KEY, JSON.stringify({ screen: state.screen, at: Date.now() }));
  } catch (err) { /* التخزين مقفول — نفتح على الرئيسية عادي */ }
}

// ⚠️ قايمة سماح مقفولة: أي اسم تاني بيترمي. من غير كده، اسم
// شاشة اتشالت من النظام كان هيفتح شاشة فاضية.
const RESUME_ALLOWED = ['activity', 'movement', 'print', 'products', 'sheets', 'users'];

function takeResumeScreen() {
  let raw = '';
  try { raw = localStorage.getItem(RESUME_KEY) || ''; } catch (err) { return ''; }
  try { localStorage.removeItem(RESUME_KEY); } catch (err) { /* تجاهل */ }
  if (!raw) return '';
  try {
    const d = JSON.parse(raw);
    if (!d || !d.screen || RESUME_ALLOWED.indexOf(d.screen) === -1) return '';
    if (!d.at || Date.now() - d.at > RESUME_MAX_AGE_MS) return '';
    return d.screen;
  } catch (err) { return ''; }
}

function applyUpdate(worker) {
  if (isApplyingUpdate) return;
  isApplyingUpdate = true;
  showUpdatingNotice();
  worker.postMessage({ type: 'SKIP_WAITING' });
}

function showUpdatingNotice() {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML = `<span>جارٍ تحديث النظام...</span>`;
  document.body.appendChild(banner);
}

document.addEventListener('DOMContentLoaded', initUpdatePrompt);
