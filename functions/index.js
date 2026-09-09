// ============================================================
// 🔔 إشعار التزويد والنظام مقفول
// ============================================================
// المشكلة اللي بيحلها: الإشعار القديم بيشتغل **والنظام مفتوح على
// الجهاز** بس — لأن مافيش سيرفر، والجهاز نفسه هو اللي بيلاحظ. أول ما
// التليفون يتقفل أو أندرويد يجمّد الصفحة، الطلب بيفضل مستني لحد ما
// حد يفتح النظام بالصدفة.
//
// الملف ده هو "الحد" اللي فاضل: بيشتغل في السحابة، بيلاحظ الدرجة أول
// ما تبقى معلّقة، وبيبعت إشعار للتليفونات المسجّلة.
//
// ⚠️⚠️ كل القرارات (امتى نبعت، ومين ياخد، ونكتب إيه) في notify-core.js
// وبتتفحص لوحدها من غير سحابة. اللي هنا هو **التوصيل** بس.
//
// ⚠️ الملف ده محتاج خطة Blaze عشان يترفع. مافيش استهلاك حقيقي متوقّع
// (كام مية تشغيلة في اليوم مقابل مليونين مجانيين في الشهر).

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { becamePending, shouldSend, tokenIsEligible, buildMessage, PUSH_TAG } = require('./notify-core');

admin.initializeApp();

// ⚠️ نسخة واحدة كافية جدًا لمحل، والحد ده بيمنع أي فاتورة مفاجئة لو
// حصل شيء غير متوقع.
setGlobalOptions({ region: 'europe-west1', maxInstances: 3 });

const db = admin.firestore();
const THROTTLE_DOC = db.collection('pushState').doc('restock');

exports.notifyRestock = onDocumentWritten('categories/{categoryId}/grades/{gradeId}', async (event) => {
  const before = event.data && event.data.before && event.data.before.data();
  const after = event.data && event.data.after && event.data.after.data();
  if (!becamePending(before, after)) return;

  // ============================================================
  // ⏱️ الخنق بمعاملة (transaction) مش بقراءة وكتابة عاديين
  // ============================================================
  // ⚠️ عشرين درجة بتبقى معلّقة في نفس اللحظة = عشرين نسخة من الدالة دي
  // **بيشتغلوا مع بعض**. لو قرينا الوقت وكتبناه على مرحلتين، كلهم
  // هيقروا نفس القيمة القديمة وكلهم هيبعتوا — والخنق يبقى مالوش لازمة.
  const now = Date.now();
  const go = await db.runTransaction(async (tx) => {
    const snap = await tx.get(THROTTLE_DOC);
    const last = snap.exists ? snap.get('lastSentAt') : 0;
    if (!shouldSend(last, now)) return false;
    tx.set(THROTTLE_DOC, { lastSentAt: now }, { merge: true });
    return true;
  });
  if (!go) return;

  const tokensSnap = await db.collection('pushTokens').where('wantsRestock', '==', true).get();
  if (tokensSnap.empty) return;

  // ⚠️ بنقرا كل حساب **مرة واحدة** مهما كان عنده كام جهاز.
  const uids = [...new Set(tokensSnap.docs.map((d) => d.get('uid')).filter(Boolean))];
  const profiles = {};
  await Promise.all(
    uids.map(async (uid) => {
      try {
        const u = await db.collection('users').doc(uid).get();
        profiles[uid] = u.exists ? u.data() : null;
      } catch (err) {
        profiles[uid] = null;
      }
    })
  );

  const targets = tokensSnap.docs.filter((d) => tokenIsEligible(d.data(), profiles[d.get('uid')]));
  if (!targets.length) return;

  let categoryName = '';
  try {
    const cat = await db.collection('categories').doc(event.params.categoryId).get();
    categoryName = cat.exists ? cat.get('name') || '' : '';
  } catch (err) {
    /* الاسم زيادة — الإشعار بيتبعت من غيره */
  }
  const msg = buildMessage(categoryName, after && after.number);

  const res = await admin.messaging().sendEachForMulticast({
    tokens: targets.map((d) => d.id),
    // ⚠️ `data` مش `notification`: عايزين الـService Worker بتاعنا هو
    // اللي يرسم الإشعار عشان يبقى بنفس الشكل والوسم بتاع الإشعار
    // المحلي. لو بعتنا `notification`، المتصفح بيرسمه بنفسه وبنفقد ده.
    data: { title: msg.title, body: msg.body, tag: PUSH_TAG },
    webpush: { headers: { Urgency: 'high', TTL: '600' } },
  });

  // ============================================================
  // 🧹 التوكن الميت بيتشال
  // ============================================================
  // المستخدم اللي مسح بيانات المتصفح أو شال النظام، توكنه بيفضل في
  // القايمة للأبد — ومع الوقت بنبعت لمئات توكنات ميتة كل مرة. جوجل
  // بترجّع السبب بالظبط، فبنمسح اللي مات وبس.
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      dead.push(targets[i].ref.delete());
    }
  });
  await Promise.all(dead);
});
