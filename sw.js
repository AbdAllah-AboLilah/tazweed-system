// Service Worker بحد أدنى — الغرض الوحيد منه حاليًا هو تفعيل آلية
// "فيه تحديث جديد" (اكتشاف نسخة جديدة + انتظار موافقة المستخدم قبل التفعيل).
// التخزين المؤقت الكامل للعمل بدون إنترنت هيُضاف في مرحلة لاحقة (الأوفلاين).

self.addEventListener('install', () => {
  // ملحوظة: مفيش self.skipWaiting() هنا عمدًا — النسخة الجديدة تفضل "مستنية"
  // لحد ما المستخدم يضغط "تحديث الآن" من الواجهة.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', () => {
  // بدون أي تدخل في الطلبات حاليًا — كل حاجة بتيجي من الشبكة عادي.
});
