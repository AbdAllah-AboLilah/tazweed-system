// إعدادات مشروع Firebase الخاص بك.
// انسخ القيم دي من: Firebase Console → Project settings → General → Your apps
//
// ملاحظة: القيم دي مش سرّية (Firebase مصمم كده من الأساس) — الحماية الحقيقية
// جاية من ملف firestore.rules، مش من إخفاء المفاتيح دي. عادي إنها موجودة
// في المستودع حتى لو Private.

const firebaseConfig = {
  apiKey: "AIzaSyA5Oz3t9ba5--wkoxR_aPyfAsLeCbha8X8",
  authDomain: "tazweed-system.firebaseapp.com",
  projectId: "tazweed-system",
  storageBucket: "tazweed-system.firebasestorage.app",
  messagingSenderId: "558083736456",
  appId: "1:558083736456:web:51aa9c9309bfb33527703d",
};

// لو لسه محطتش القيم الحقيقية، النظام هيوريك رسالة واضحة بدل شاشة بيضة.
const FIREBASE_IS_CONFIGURED = firebaseConfig.apiKey !== "ضع_apiKey_هنا" && firebaseConfig.apiKey !== "";

let auth, db;
if (FIREBASE_IS_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();

  // تخزين محلي (IndexedDB) تلقائي: البيانات اللي اتفتحت قبل كده تفضل متاحة
  // حتى من غير نت، وأي تعديل (لما نبنيه في المرحلة الجاية) هيتخزن محليًا
  // ويترفع لوحده أول ما النت يرجع.
  db.enablePersistence().catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('التخزين المحلي مش شغال: النظام مفتوح في أكتر من تبويب في نفس الوقت.');
    } else if (err.code === 'unimplemented') {
      console.warn('هذا المتصفح لا يدعم التخزين المحلي.');
    }
  });
}
