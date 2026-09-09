// ============================================================
// 🔔 استقبال الإشعار والنظام مقفول
// ============================================================
// ⚠️⚠️ الملف ده **منفصل عن sw.js** عن قصد. sw.js هو اللي بيخلي النظام
// يشتغل من غير نت وبيوصّل التحديثات، وهو مكتوب بحساب. أي حاجة تتحط
// فيه بتتحمّل مع كل فتحة للصفحة، وأي غلطة فيه بتقفل النظام كله.
//
// ده بيتسجّل بنطاق (scope) خاص بيه، فالاتنين مابيتخانقوش على مين
// بيتحكم في الصفحة.
//
// ⚠️ الإصدارات هنا لازم تفضل **نفس** اللي في index.html — نسخة مختلفة
// من مكتبة Firebase في الاتنين بتطلّع أعطال غامضة.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
importScripts('./firebase-config-values.js');

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ============================================================
// إحنا اللي بنرسم الإشعار، مش المتصفح
// ============================================================
// الدالة الرسالة بتيجي كـ`data` مش `notification` — والسبب إن ده
// بيخلينا نتحكم في الشكل والوسم. والوسم بالذات مهم: نفس الوسم بتاع
// الإشعار المحلي، فالتليفون **بيستبدل** القديم بدل ما يكوّم عشرة
// إشعارات فوق بعض.
messaging.onBackgroundMessage((payload) => {
  const d = (payload && payload.data) || {};
  self.registration.showNotification(d.title || '🔔 طلب تزويد جديد', {
    body: d.body || 'فيه طلب تزويد مستني',
    tag: d.tag || 'tazweed-restock',
    renotify: true,
    icon: './icon-192.png',
    badge: './icon-192.png',
    dir: 'rtl',
    lang: 'ar',
  });
});

// ⚠️ من غير المستمع ده، الضغط على الإشعار على أندرويد **مابيعملش حاجة
// خالص** — لا بيفتح النظام ولا بيقفل الإشعار، والمستخدم بيفتكره باظ.
//
// وبنركّز النافذة المفتوحة أصلًا بدل ما نفتح واحدة جديدة: تبويبين
// معناهم اشتراكين على Firestore وقراءات مضاعفة.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })()
  );
});
