// إعدادات مشروع Firebase الخاص بك.
// انسخ القيم دي من: Firebase Console → Project settings → General → Your apps
//
// ملاحظة: القيم دي مش سرّية (Firebase مصمم كده من الأساس) — الحماية الحقيقية
// جاية من ملف firestore.rules، مش من إخفاء المفاتيح دي. عادي إنها موجودة
// في المستودع حتى لو Private.

const firebaseConfig = {
  apiKey: "ضع_apiKey_هنا",
  authDomain: "ضع_authDomain_هنا",
  projectId: "ضع_projectId_هنا",
  storageBucket: "ضع_storageBucket_هنا",
  messagingSenderId: "ضع_messagingSenderId_هنا",
  appId: "ضع_appId_هنا",
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
