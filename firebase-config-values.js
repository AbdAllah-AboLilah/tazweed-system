// ============================================================
// 🔑 قيم مشروع Firebase — **الملف ده وبس**
// ============================================================
// ⚠️⚠️ ليه اتفصل عن firebase-config.js: الـService Worker بتاع
// الإشعارات محتاج القيم دي، ومايقدرش ياخد باقي الملف — هناك مافيش
// `auth` ولا `firestore` أصلًا، وتحميلهم كان هيوقّع الـWorker.
//
// فبقى الملف ده **قيم بس**، من غير أي نداء على Firebase. بيتحمّل في
// الصفحة قبل firebase-config.js، وفي الـWorker لوحده.
//
// ملاحظة: القيم دي مش سرّية (Firebase مصمم كده من الأساس) — الحماية
// الحقيقية جاية من firestore.rules، مش من إخفاء المفاتيح دي.

const firebaseConfig = {
  apiKey: "AIzaSyA5Oz3t9ba5--wkoxR_aPyfAsLeCbha8X8",
  authDomain: "tazweed-system.firebaseapp.com",
  projectId: "tazweed-system",
  storageBucket: "tazweed-system.firebasestorage.app",
  messagingSenderId: "558083736456",
  appId: "1:558083736456:web:51aa9c9309bfb33527703d",
};

// ============================================================
// 🔔 مفتاح الإشعارات (Web Push certificate)
// ============================================================
// ⚠️ ده **مش** موجود مع باقي القيم فوق، ولازم تجيبه بإيدك مرة واحدة:
//
//   Firebase Console ← ⚙️ Project settings ← Cloud Messaging
//   ← Web configuration ← Web Push certificates ← Generate key pair
//   ← انسخ الـ"Key pair" وحطه هنا
//
// من غيره الإشعار **وقت ما النظام مقفول** مش هيشتغل — والنظام هيقولك
// كده بوضوح بدل ما يفضل ساكت. أما الإشعار والنظام مفتوح فشغّال زي ما
// هو من غير أي مفتاح.
//
// ⚠️ ده المفتاح **العام** (public) زي باقي القيم فوق — بيتبعت للمتصفح
// في كل تسجيل، فوجوده في المستودع عادي. المفتاح الخاص بيفضل عند جوجل
// ومابيخرجش من Firebase خالص.
const FIREBASE_VAPID_KEY = "BNE16awQUEWiHWfsZnGP2OHetzyykzsey2ALZTR-fpC1rFC33LLnCVxEu1COIeHr0tX-q2HGhG0gMszBuWOLF0w";
