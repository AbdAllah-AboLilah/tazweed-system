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
    })
    .catch((err) => console.error('تعذّر تسجيل service worker:', err));

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
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
