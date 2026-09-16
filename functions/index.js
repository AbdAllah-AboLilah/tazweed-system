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
  buildPendingMessage,
  canSendPending,
  pendingCooldownLeft,
  PENDING_TAG,
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

  // ============================================================
  // 📤 نوع تاني من نفس الباب: "ابعت الطلبات المعلّقة"
  // ============================================================
  // ⚠️⚠️ ليه في **نفس** المجموعة ومش مجموعة جديدة؟ لأن قواعد
  // pushTests بتقول خلاص "المستخدم يكتب لنفسه بس" — وده بالظبط
  // الحارس اللي محتاجينه. مجموعة جديدة معناها قواعد جديدة، ورفع
  // تاني للقواعد، وباب تاني يتراجع.
  if (data.kind === 'pending') {
    await sendPendingNow(event, uid);
    return;
  }

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

// ============================================================
// 📤 إعادة إرسال الطلبات المعلّقة
// ============================================================
// اتطلب بالنص: "ارسال الاشعارات اللي موجوده اللي هي الطلبات المعلقه
// ل الاجهزة اللي معاه تعديل في المخزن الرئيسي".
//
// ⚠⚠ ده **مش** إشعار جديد — ده إعادة إرسال للي موجود فعلًا.
// إشعار التزويد بيتبعت مرة واحدة لحظة الطلب، ولو ضاع ساعتها (تليفون
// مقفول أكتر من مدة التخزين، إذن مقفول، جهاز لسه مااتسجّلش) مافيش
// حاجة بترجّعه.
async function sendPendingNow(event, uid) {
  const say = (ok, result) => event.data.ref.update({ ok, result }).catch(() => {});

  // ⚠️ الصلاحية بتتفحص في السحابة مش في الشاشة: الشاشة ممكن
  // تتلف، والقواعد بتسمح لأي حد يكتب المستند ده لنفسه.
  let profile = null;
  try {
    const u = await db.collection('users').doc(uid).get();
    profile = u.exists ? u.data() : null;
  } catch (err) {
    profile = null;
  }
  if (!canSendPending(profile)) {
    await say(false, 'الحساب ده مالوش صلاحية يبعت للكل.');
    return;
  }

  // ⚠⚠ مهلة على مستوى المحل: دوسة متكررة معناها إن تليفون كل
  // الموظفين يرن عشر مرات. والمهلة بتتقرا من **آخر إرسال نجح**.
  try {
    const last = await db
      .collection('pushTests')
      .where('kind', '==', 'pending')
      .where('ok', '==', true)
      .orderBy('at', 'desc')
      .limit(1)
      .get();
    if (!last.empty) {
      const at = last.docs[0].get('at');
      const ms = at && at.toMillis ? at.toMillis() : 0;
      const left = pendingCooldownLeft(ms, Date.now());
      if (left > 0) {
        await say(false, `اتبعت من شوية — استنى ${Math.ceil(left / 60000)} دقيقة كمان.`);
        return;
      }
    }
  } catch (err) {
    // ⚠️ الاستعلام محتاج فهرس مركّب. لو مش موجود، بنكمّل من غير
    // مهلة بدل ما نقفل الميزة — والإرسال نفسه هو الأهم.
    console.warn('تعذّر فحص المهلة:', err && err.message);
  }

  // كل الدرجات المعلّقة في المحل، مجمّعة بالفئة.
  //
  // ⚠️ collectionGroup: الدرجات جوّه كل فئة لوحدها، والاستعلام ده
  // بيلمّهم كلهم في نداء واحد بدل نداء لكل فئة.
  let rows = [];
  try {
    const snap = await db.collectionGroup('grades').where('status', '==', 'pending').get();
    const byCat = new Map();
    snap.docs.forEach((d) => {
      const parent = d.ref.parent.parent;
      if (!parent) return;
      const arr = byCat.get(parent.id) || [];
      const n = d.get('number');
      if (n === 0 || n) arr.push(n);
      byCat.set(parent.id, arr);
    });
    const names = await Promise.all(
      [...byCat.keys()].map(async (id) => {
        try {
          const c = await db.collection('categories').doc(id).get();
          return [id, c.exists ? c.get('name') || '' : ''];
        } catch (err) {
          return [id, ''];
        }
      })
    );
    const nameOf = new Map(names);
    rows = [...byCat.entries()].map(([id, numbers]) => ({
      categoryName: nameOf.get(id) || '',
      numbers,
    }));
  } catch (err) {
    await say(false, 'مانفعش نقرا الطلبات المعلّقة: ' + (err && err.message ? err.message : err));
    return;
  }

  const msg = buildPendingMessage(rows);
  if (!msg) {
    // ⚠️ مافيش طلبات = **مابنبعتش**. إشعار بيقول "مافيش حاجة" هو
    // نفسه إزعاج.
    await say(false, 'مافيش أي طلب تزويد معلّق دلوقتي.');
    return;
  }

  const tokensSnap = await db.collection('pushTokens').where('wantsRestock', '==', true).get();
  if (tokensSnap.empty) {
    await say(false, 'مافيش أي جهاز مفعّل الإشعارات.');
    return;
  }

  // ⚠️ نفس فلترة إشعار التزويد بالحرف — اللي بيرن عنده التليفون
  // هو اللي قدامه زرار "زوّد"، مش أكتر ولا أقل.
  const uids = [...new Set(tokensSnap.docs.map((d) => d.get('uid')).filter(Boolean))];
  const profiles = {};
  await Promise.all(
    uids.map(async (u) => {
      try {
        const doc = await db.collection('users').doc(u).get();
        profiles[u] = doc.exists ? doc.data() : null;
      } catch (err) {
        profiles[u] = null;
      }
    })
  );
  const targets = tokensSnap.docs.filter((d) => tokenIsEligible(d.data(), profiles[d.get('uid')]));
  if (!targets.length) {
    await say(false, 'مافيش أي جهاز مؤهّل يستقبل.');
    return;
  }

  const res = await admin.messaging().sendEachForMulticast({
    tokens: targets.map((d) => d.id),
    data: { title: msg.title, body: msg.body, tag: PENDING_TAG },
    webpush: { headers: { Urgency: 'high', TTL: String(PUSH_TTL_SECONDS) } },
  });

  const failed = res.responses.filter((r) => !r.success).length;
  await say(
    res.successCount > 0,
    `اتبعت لـ${targets.length} جهاز — نجح ${res.successCount}` +
      (failed ? `، فشل ${failed}` : '') +
      `. (${msg.body})`
  );

  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      dead.push(targets[i].ref.delete());
    }
  });
  await Promise.all(dead);
}
