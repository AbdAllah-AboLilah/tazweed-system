// Service Worker — بيعمل حاجتين:
//   1) يخلي التحديث الجديد يوصل **فورًا** بعد الرفع، من غير تحديث قوي.
//   2) يخلي النظام يفتح حتى من غير إنترنت (الشاشة نفسها، والبيانات أصلًا
//      محفوظة محليًا عن طريق Firestore).
//
// ⚠️ مهم جدًا: المتصفح بيكتشف "فيه تحديث" بمقارنة محتوى هذا الملف بايت
// ببايت مع النسخة القديمة المسجّلة عنده. لازم نغيّر رقم SW_VERSION هنا في
// كل مرة نرفع فيها تحديث فعلي (حتى لو التحديث نفسه في app.js مش هنا) —
// وإلا المتصفح مش هيحس إن فيه حاجة اتغيّرت، والإشعار مش هيظهر خالص.
const SW_VERSION = '0.18.0';

const CACHE_NAME = 'tazweed-' + SW_VERSION;

// ملفات النظام الأساسية — بتتحفظ عشان الشاشة تفتح من غير نت.
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './firebase-config.js',
  './js/app-info.js',
  './js/permissions.js',
  './js/qz-signing.js',
  './js/barcode-scan.js',
  './js/import-export.js',
  './js/user-admin.js',
  './js/dashboard.js',
  './js/app.js',
  './js/update-prompt.js',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' بتجبر المتصفح يجيب النسخة الجديدة من السيرفر بدل
  // ما ياخد اللي محفوظة عنده — ده جزء أساسي من إن التحديث يوصل فورًا.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      )
    )
  );
  // ملحوظة: مفيش self.skipWaiting() هنا عمدًا — النسخة الجديدة تفضل "مستنية"
  // لحد ما الواجهة تبعتلها رسالة SKIP_WAITING (بيحصل تلقائيًا في
  // js/update-prompt.js).
});

self.addEventListener('activate', (event) => {
  // مسح أي نسخ قديمة محفوظة، عشان ما يفضلش حاجة من نسخة قديمة أبدًا.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================================
// الشبكة الأول، والمحفوظ احتياطي (Network-first)
// ============================================================
// ده بالظبط اللي كان ناقص وبيسبب مشكلة "رفعت التحديث ومش ظاهر":
//
// GitHub Pages بيقول للمتصفح "احتفظ بالملفات دي 10 دقايق" (max-age=600).
// ومعنى كده إن المتصفح، لمدة 10 دقايق بعد أي رفعة، بيستخدم النسخة القديمة
// من js/app.js **من غير ما يسأل السيرفر أصلًا** — حتى لو عملت Refresh عادي،
// وحتى لو الـService Worker اكتشف التحديث وعمل reload للصفحة.
//
// الحل: نعترض الطلبات ونجيبها بـ cache: 'no-cache'، اللي بتجبر المتصفح
// يتأكد من السيرفر كل مرة (بيرجع 304 لو مفيش تغيير، فمفيش استهلاك زيادة).
// ولو مفيش نت خالص، بنرجع للنسخة المحفوظة عشان النظام يفضل شغال.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Firebase والمكتبات الخارجية بتتساب على طبيعتها من غير أي تدخل.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // لو الطلب صفحة كاملة ومفيش نسخة محفوظة منها، نرجّع الصفحة الرئيسية.
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
