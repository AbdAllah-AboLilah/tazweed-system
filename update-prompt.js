// إشعار "فيه تحديث جديد" — JavaScript عادي، بيضيف بانر مستقل تحت الشاشة
// (منفصل عن #root عشان الرندر بتاع الداشبورد ميمسحوش).

let waitingWorker = null;

function initUpdatePrompt() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      if (registration.waiting) {
        waitingWorker = registration.waiting;
        showUpdateBanner();
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker = newWorker;
            showUpdateBanner();
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

function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>فيه تحديث جديد للنظام</span>
    <button class="btn btn-primary" id="update-now-btn">تحديث الآن</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('update-now-btn').addEventListener('click', () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  });
}

document.addEventListener('DOMContentLoaded', initUpdatePrompt);
