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
  // ⚠️ synchronizeTabs: true مهمة جدًا ومش رفاهية.
  //
  // من غيرها، Firestore بيحاول ياخد "ملكية حصرية" لقاعدة البيانات المحلية،
  // وأول تبويب بس هو اللي بينجح. لو النظام مفتوح في تبويبين (أو التطبيق
  // المثبّت + تبويب في المتصفح — وده بيحصل من غير ما تحس)، التبويب التاني
  // بيرجّع الخطأين اللي ظهروا فعلًا على شاشة الأصناف:
  //   Failed to obtain exclusive access to the persistence layer
  //   FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state
  //
  // والتاني ده أخطر من شكله: بعده الاتصال بقاعدة البيانات بيبوظ في التبويب
  // ده كله، فشاشة الأصناف تفضل "جارٍ التحميل..." ومتخلصش.
  //
  // بالخيار ده، التبويبات بتتشارك نفس التخزين المحلي وتتزامن مع بعضها بدل
  // ما تتخانق عليه. لو المتصفح مش بيدعم المشاركة، بنرجع للطريقة العادية.
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err && err.code === 'unimplemented') {
      console.warn('هذا المتصفح لا يدعم مشاركة التخزين المحلي بين التبويبات — بنجرب الطريقة العادية.');
      db.enablePersistence().catch((err2) => {
        console.warn('التخزين المحلي مش شغال:', err2 && err2.code);
      });
      return;
    }
    console.warn('التخزين المحلي مش شغال:', err && err.code);
  });
}
