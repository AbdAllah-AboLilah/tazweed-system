// ============================================================
// الحفظ المحلي: بيانات الحساب، مسوّدات الكتابة، وتراجع عن آخر حركة
// ============================================================
// الملف ده بيحل تلات مشاكل مختلفة بنفس الفكرة — إن الجهاز نفسه يفتكر:
//
//   1) بيانات صلاحية الحساب  → عشان النظام يفتح من غير نت من غير رسالة غلط
//   2) اللي بتكتبه في الخانات → عشان لو التطبيق قفل فجأة ما يضيعش
//   3) آخر الحركات اللي عملتها → عشان زرار "تراجع"
//
// كل ده في localStorage: بيفضل موجود بعد قفل التطبيق وبعد إعادة تشغيل
// الجهاز، ومابيحتاجش نت خالص.

const LS_PREFIX = 'tazweed_';

// ============================================================
// اسم دخول عادي بدل الإيميل
// ============================================================
// Firebase بيطلب إيميل بشكله الكامل (فيه @) — مافيش طريقة تخليه يقبل
// اسم مجرد. لكن أصحاب الحسابات دول موظفين في محل، مش لازم يكون لكل
// واحد إيميل حقيقي.
//
// الحل: المدير يكتب اسم عادي (مثال: Test-Print)، والنظام بيكمّله داخليًا
// لـ test-print@tazweed.local. الموظف بيسجّل دخول بالاسم المجرد، والنظام
// بيكمّله بنفس الطريقة — فهو أصلًا مايشوفش الجزء التاني ولا يهمه.
//
// ليه .local بالتحديد؟ لأنه نطاق **محجوز رسميًا للاستخدام المحلي**
// (RFC 6762)، فمستحيل يكون بيتبع حد، ومفيش أي احتمال إن رسالة تروح لحد
// بالغلط. الحسابات دي مش بتستقبل بريد أصلًا.
const LOGIN_DOMAIN = '@tazweed.local';

// بتحوّل اسم الدخول لإيميل. لو المستخدم كتب إيميل حقيقي (فيه @)،
// بترجّعه زي ما هو — فالحسابات القديمة بإيميلات حقيقية بتفضل شغّالة.
function usernameToEmail(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.indexOf('@') !== -1) return raw.toLowerCase();

  // الجزء اللي قبل @ في الإيميل مايقبلش مسافات ولا حروف خاصة، فبنحوّل
  // المسافات لشرطة ونشيل أي حرف مش مقبول.
  const clean = raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[.-]+|[.-]+$/g, '');

  return clean ? clean + LOGIN_DOMAIN : '';
}

// العكس: بتشيل الجزء الداخلي عشان نعرض للمستخدم اسمه زي ما كتبه.
function emailToUsername(email) {
  const raw = String(email || '').trim();
  if (!raw) return '';
  return raw.toLowerCase().endsWith(LOGIN_DOMAIN) ? raw.slice(0, -LOGIN_DOMAIN.length) : raw;
}

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    // ممكن تكون المساحة خلصت — مش سبب نوقف النظام.
    console.warn('تعذّر الحفظ المحلي:', key, err);
    return false;
  }
}

function lsRemove(key) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch (err) {
    /* عادي */
  }
}

// ------------------------------------------------------------
// 1) بيانات الحساب (الصلاحية)
// ------------------------------------------------------------
// بتتحفظ لكل uid على حدة، عشان لو أكتر من شخص بيستخدم نفس الجهاز
// ما ياخدش صلاحية غيره بالغلط.
function saveProfileLocally(uid, profile) {
  if (!uid || !profile) return;
  // بنحفظ الحقول اللي الواجهة بتعتمد عليها بس — مش أي حاجة تانية.
  lsSet('profile_' + uid, {
    name: profile.name || '',
    role: profile.role || '',
    warehouseAccess: profile.warehouseAccess || '',
    canSendRemotePrint: profile.canSendRemotePrint === true,
    canUsePrintScreen: profile.canUsePrintScreen === true,
    savedAt: Date.now(),
  });
}

function loadProfileLocally(uid) {
  if (!uid) return null;
  const saved = lsGet('profile_' + uid, null);
  if (!saved || !saved.role) return null;
  return saved;
}

function clearProfileLocally(uid) {
  if (uid) lsRemove('profile_' + uid);
}

// ------------------------------------------------------------
// 2) مسوّدات الكتابة (auto-save)
// ------------------------------------------------------------
// أي خانة عليها data-draft="اسم" بتتحفظ مع كل حرف تكتبه، وبترجع لوحدها
// لو الشاشة اتقفلت وفتحت تاني. المسوّدة بتتمسح بعد الحفظ الفعلي أو الإلغاء.
//
// ليه دي مهمة: كنت ممكن تقعد تكتب بيانات صنف أو تحدّد 40 درجة، وأي حاجة
// تقفل التطبيق (بطارية، مكالمة، تحديث) تودّي الشغل كله.
const DRAFTS_KEY = 'drafts';

function getDrafts() {
  return lsGet(DRAFTS_KEY, {});
}

function saveDraftField(name, value) {
  const drafts = getDrafts();
  if (value === '' || value === null || value === undefined) delete drafts[name];
  else drafts[name] = value;
  lsSet(DRAFTS_KEY, drafts);
}

// بتمسح مجموعة مسوّدات بتبدأ بنفس البادئة (كل خانات فورم واحد).
function clearDrafts(prefix) {
  const drafts = getDrafts();
  let changed = false;
  Object.keys(drafts).forEach((k) => {
    if (!prefix || k.indexOf(prefix) === 0) {
      delete drafts[k];
      changed = true;
    }
  });
  if (changed) lsSet(DRAFTS_KEY, drafts);
}

// بتتنادى بعد كل رسم: بترجّع القيم المحفوظة في خاناتها، وبتربط الحفظ
// التلقائي على كل خانة عليها data-draft.
function wireDraftFields() {
  const drafts = getDrafts();
  document.querySelectorAll('[data-draft]').forEach((el) => {
    const name = el.getAttribute('data-draft');
    // بنرجّع المسوّدة بس لو الخانة فاضية — عشان ما نمسحش قيمة موجودة
    // أصلًا (زي بيانات صنف بتعدّلها).
    if (!el.value && drafts[name] !== undefined) el.value = drafts[name];

    const save = () => saveDraftField(name, el.value);
    el.addEventListener('input', save);
    el.addEventListener('change', save);
  });
}

// ------------------------------------------------------------
// 3) حالة الشغل الجارية (التحديدات والسلة)
// ------------------------------------------------------------
// دي مش مسوّدة نص — دي اختيارات ممكن تاخد منك دقايق: تحديد 40 درجة
// بأعدادها، أو سلة طباعة فيها 20 صنف. بتتحفظ مع كل تغيير وبترجع مع الفتح.
const WORK_KEY = 'work_state';

function saveWorkState() {
  if (!state || !state.user) return;
  lsSet(WORK_KEY, {
    uid: state.user.uid,
    activeCategoryId: state.activeCategoryId || null,
    gradeLabelMode: !!state.gradeLabelMode,
    gradeLabelQty: state.gradeLabelQty || {},
    printCart: (state.printCart || []).map((it) => ({ key: it.key, product: it.product, qty: it.qty })),
    savedAt: Date.now(),
  });
}

// بترجّع الحالة المحفوظة لو هي **لنفس المستخدم ونفس الفئة** — عشان
// تحديد درجات فئة ما يظهرش بالغلط في فئة تانية.
function restoreWorkState(uid) {
  const saved = lsGet(WORK_KEY, null);
  if (!saved || saved.uid !== uid) return null;
  return saved;
}

function clearWorkState() {
  lsRemove(WORK_KEY);
}

// ------------------------------------------------------------
// 4) تراجع عن آخر حركة
// ------------------------------------------------------------
// كل حركة على درجة بتتسجّل مع **قيمها قبل التعديل**، فالتراجع مجرد إننا
// نكتب القيم القديمة تاني.
//
// ⚠️ حدود مقصودة:
//   • التراجع للحركات اللي عملتها **انت على الجهاز ده** بس
//   • العمليات الجماعية (ظبط كل الكميات / إضافة درجات دفعة) مش داخلة —
//     دي بتلمس آلاف الدرجات، والتراجع عنها محتاج تأكيد مختلف تمامًا
//   • لو حد تاني عدّل نفس الدرجة بعدك، النظام بيحذّرك قبل ما يستبدل تعديله
const UNDO_KEY = 'undo_stack';
const UNDO_LIMIT = 20;

function getUndoStack() {
  const stack = lsGet(UNDO_KEY, []);
  return Array.isArray(stack) ? stack : [];
}

// entry = { label, categoryId, gradeId, before: {...}, after: {...} }
function pushUndo(entry) {
  if (!entry || !entry.categoryId || !entry.gradeId) return;
  const stack = getUndoStack();
  const wasEmpty = stack.length === 0;
  stack.push({ ...entry, at: Date.now() });
  while (stack.length > UNDO_LIMIT) stack.shift();
  lsSet(UNDO_KEY, stack);
  if (typeof state !== 'object') return;
  state.undoCount = stack.length;

  // أول حركة بتخلّي زرار التراجع يظهر في الشريط العلوي، فمحتاجين رسم.
  // بعد كده مفيش داعي — الزرار موجود خلاص والرسم بيحصل من تحديث البيانات.
  // (منعملش رسم مع كل حركة عشان ما نرسمش مرتين على نفس الضغطة.)
  if (wasEmpty && state.view === 'dashboard' && typeof render === 'function') render();
}

function lastUndoLabel() {
  const stack = getUndoStack();
  return stack.length ? stack[stack.length - 1].label : '';
}

function clearUndoStack() {
  lsRemove(UNDO_KEY);
  if (typeof state === 'object') state.undoCount = 0;
}

// بتنفّذ التراجع عن آخر حركة. بترجّع نص بيوصف اللي حصل، أو null لو اتلغى.
async function undoLastAction() {
  const stack = getUndoStack();
  if (!stack.length) return null;

  const entry = stack[stack.length - 1];
  const gradeRef = db
    .collection('categories')
    .doc(entry.categoryId)
    .collection('grades')
    .doc(entry.gradeId);

  // الحركة الممكنة الوحيدة اللي محتاجة إعادة إنشاء مستند: حذف درجة.
  if (entry.type === 'delete') {
    fireWrite(gradeRef.set(entry.before), 'تراجع عن حذف');
  } else {
    // بنقارن الحالة الحالية باللي إحنا كتبناه. لو مختلفة، يعني حد تاني
    // (أو انت من جهاز تاني) عدّلها بعدنا — فبنسأل قبل ما نستبدل شغله.
    let current = null;
    try {
      const snap = await gradeRef.get();
      current = snap.exists ? snap.data() : null;
    } catch (err) {
      // أوفلاين: مش هنقدر نتأكد، بنكمّل عادي — Firestore بيوفّق لوحده بعدين.
    }

    if (!current) {
      stack.pop();
      lsSet(UNDO_KEY, stack);
      state.undoCount = stack.length;
      return 'الدرجة دي مش موجودة خلاص — الحركة اتشالت من قايمة التراجع.';
    }

    const changedKeys = Object.keys(entry.after || {});
    const conflicted = changedKeys.some((k) => current[k] !== entry.after[k]);
    if (conflicted) {
      const ok = confirm(
        `⚠️ الدرجة دي اتغيّرت بعد حركتك (يمكن حد تاني عدّلها).\n\n` +
          `التراجع هيرجّعها لقيمتها القديمة ويلغي تعديله.\n\nتكمّل؟`
      );
      if (!ok) return null;
    }

    fireWrite(gradeRef.update(entry.before), 'تراجع');
  }

  stack.pop();
  lsSet(UNDO_KEY, stack);
  state.undoCount = stack.length;

  logActivity({
    action: 'undo',
    categoryId: entry.categoryId,
    categoryName: (state.categories.find((c) => c.id === entry.categoryId) || {}).name || '',
    gradeId: entry.gradeId,
    gradeNumber: entry.gradeLabel || '',
    oldValue: entry.label || '',
  });

  return `↩️ اترجعت: ${entry.label}`;
}
