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

const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const {
  becamePending,
  tokenIsEligible,
  buildGroupedMessage,
  categoryTag,
} = require('./notify-core');

admin.initializeApp();

// ⚠️ نسخة واحدة كافية جدًا لمحل، والحد ده بيمنع أي فاتورة مفاجئة لو
// حصل شيء غير متوقع.
setGlobalOptions({ region: 'europe-west1', maxInstances: 3 });

// ============================================================
// ⏳ عمر الإشعار عند جوجل — كان **١٠ دقايق** وده قصير أوي
// ============================================================
// اتبلّغ بالنص: "ساعات بحس ان الاشعارات بتتاخر او مش بتوصل ... اكد
// علي المعلومة دي ممكن يطلع مجرد احساس".
//
// ⚠️⚠️ **مش إحساس.** الـTTL هو المدة اللي جوجل بتحتفظ فيها بالإشعار
// لو التليفون مش موصول (النت مقطوع، الشاشة مقفولة من ساعات، أندرويد
// مدخّل التطبيق في وضع توفير الطاقة). بعد المدة دي الإشعار **بيتمسح
// ومابيوصلش أبدًا** — مافيش محاولة تانية ومافيش أي أثر.
//
// وكانت 600 ثانية = ١٠ دقايق بس. يعني طلب تزويد اتعمل والتليفون في
// جيبه مقفول ربع ساعة = الإشعار راح.
//
// والرقم الجديد ٤ ساعات، والمنطق بسيط: **طلب التزويد بيفضل مطلوب**.
// إشعار بيوصل بعد ساعة لسه مفيد — البضاعة لسه ناقصة في الفرع. مش
// زي إشعار "فيه حد بيكلمك دلوقتي" اللي بيبوظ لو اتأخر.
//
// ⚠️ ومش أكتر من كده عن قصد: إشعار عمره يوم ممكن يكون الطلب اتنفّذ
// خلاص، فيرن على الفاضي.
const PUSH_TTL_SECONDS = 4 * 60 * 60;

const db = admin.firestore();

exports.notifyRestock = onDocumentWritten('categories/{categoryId}/grades/{gradeId}', async (event) => {
  const before = event.data && event.data.before && event.data.before.data();
  const after = event.data && event.data.after && event.data.after.data();
  if (!becamePending(before, after)) return;

  // ============================================================
  // ⚠️⚠️ الخنق اتشال — كل طلب بيبعت
  // ============================================================
  // اتطلب بالنص: "عاوز اي طلب تزويد يطلب يوصل رسالة يعني كل طلب يوصل
  // رسالة مش يستني دقيقة".
  //
  // والمشكلة اللي كان الخنق بيحلها (عشرين إشعار في ثانية) اتحلّت
  // بالتجميع تحت: إشعار واحد للفئة بيتحدّث ويكبر، مش عشرين إشعار.
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

  const categoryId = event.params.categoryId;
  let categoryName = '';
  try {
    const cat = await db.collection('categories').doc(categoryId).get();
    categoryName = cat.exists ? cat.get('name') || '' : '';
  } catch (err) {
    /* الاسم زيادة — الإشعار بيتبعت من غيره */
  }

  // ============================================================
  // 🧾 كل الدرجات المعلّقة في الفئة — مش الدرجة دي بس
  // ============================================================
  // اتطلب بالنص: "لو في طلب تزويد من الكريب السادة درجة 5 وبعدين طلبت
  // درجة 6 لما يوصل اشعار 6 ... يكتب درجة 5 و 6".
  //
  // ⚠️ الدرجة اللي دخلت دلوقتي بتتضاف بإيدنا كمان: الاستعلام ممكن
  // يسبقها (الكتابة لسه بتتنشر)، والإشعار اللي مافيهوش سبب إرساله
  // بيبقى محيّر.
  let numbers = [];
  try {
    const pend = await db
      .collection('categories')
      .doc(categoryId)
      .collection('grades')
      .where('status', '==', 'pending')
      .get();
    numbers = pend.docs.map((d) => d.get('number')).filter((n) => n === 0 || n);
  } catch (err) {
    /* الاستعلام فشل — بنكمّل بالدرجة اللي جات دلوقتي بس */
  }
  if (after && (after.number === 0 || after.number)) numbers.push(after.number);

  const msg = buildGroupedMessage(categoryName, numbers);

  const res = await admin.messaging().sendEachForMulticast({
    tokens: targets.map((d) => d.id),
    // ⚠️ `data` مش `notification`: عايزين الـService Worker بتاعنا هو
    // اللي يرسم الإشعار عشان يبقى بنفس الشكل والوسم بتاع الإشعار
    // المحلي. لو بعتنا `notification`، المتصفح بيرسمه بنفسه وبنفقد ده.
    // ⚠️ الوسم **لكل فئة على حدة**: ده اللي بيخلي إشعار الفئة يتحدّث
    // مكانه بدل ما يتكوّم، ومايمسحش إشعار فئة تانية.
    data: { title: msg.title, body: msg.body, tag: categoryTag(categoryId) },
    webpush: { headers: { Urgency: 'high', TTL: String(PUSH_TTL_SECONDS) } },
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

// ============================================================
// 🧪 إشعار تجربة — للجهاز اللي طلبه بس
// ============================================================
// اتطلب بالنص: "عاوزك تتاكد ان الاشعارات بتوصل كويس ل الاجهزة".
//
// ⚠️ والتأكد ده **مش** حاجة أقدر أعملها من هنا: أنا مش شايف تليفوناته
// ولا إعدادات الإشعارات على أندرويد. الحاجة الوحيدة اللي بتحسم الموضوع
// إنه يجرّب بنفسه والنظام مقفول.
//
// وقبل ده مكانش فيه طريقة يجرّب بيها غير إن حد يعمل طلب تزويد حقيقي —
// يعني يلخبط بيانات المحل عشان يختبر إشعار.
//
// بيشتغل على إنشاء مستند في pushTests. القواعد بتسمح للمستخدم يكتب
// **لنفسه بس**، والدالة بتبعت لتوكناته هو بس.
exports.notifyTest = onDocumentCreated('pushTests/{testId}', async (event) => {
  const data = event.data && event.data.data();
  const uid = data && data.uid;
  if (!uid) return;

  const tokensSnap = await db.collection('pushTokens').where('uid', '==', uid).get();
  if (tokensSnap.empty) {
    // ⚠️ بنكتب السبب في نفس المستند: صاحبه يقدر يقراه، فبيعرف إن
    // المشكلة في التسجيل مش في التوصيل.
    await event.data.ref.update({ result: 'مفيش أي جهاز مسجّل لحسابك.', ok: false }).catch(() => {});
    return;
  }

  const res = await admin.messaging().sendEachForMulticast({
    tokens: tokensSnap.docs.map((d) => d.id),
    data: {
      title: '🧪 إشعار تجربة',
      body: 'لو وصلك ده والنظام مقفول، الإشعارات شغّالة تمام.',
      // ⚠️ وسم لوحده: عشان مايمسحش إشعار تزويد حقيقي مستني.
      tag: 'tazweed-test',
    },
    webpush: { headers: { Urgency: 'high', TTL: String(PUSH_TTL_SECONDS) } },
  });

  const failed = res.responses.filter((r) => !r.success).length;
  await event.data.ref
    .update({
      ok: res.successCount > 0,
      result:
        `اتبعت لـ${tokensSnap.size} جهاز — نجح ${res.successCount}` +
        (failed ? `، فشل ${failed}` : '') +
        '. لو مافيش إشعار وصل، الإذن مقفول على التليفون أو النظام محتاج يتفتح مرة.',
    })
    .catch(() => {});

  // ⚠️ التوكن الميت بيتشال هنا كمان — نفس منطق إشعار التزويد.
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      dead.push(tokensSnap.docs[i].ref.delete());
    }
  });
  await Promise.all(dead);
});
