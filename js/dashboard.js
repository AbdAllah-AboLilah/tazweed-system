// ============================================================
// لوحة التحكم — شاشة الملخّص
// ============================================================
// المشكلة اللي بتحلها: عشان تعرف فيه نواقص فين، كنت لازم تفتح الـ25 تاب
// واحد واحد. الشاشة دي بتجمّع كل حاجة محتاجة انتباهك في مكان واحد.
//
// ملحوظة عن التكلفة: بنقرا **الدرجات اللي حالتها معلّقة أو خلصت بس** —
// مش كل الـ2000 درجة. دول مجموعتين صغيرتين بطبيعتهم، فالشاشة خفيفة.

// ⚠️ نقطة اتصلحت من مشكلة حقيقية:
// بيانات "المعلّق / خلصت / قرّبت تخلص" كانت بترسم الشاشة **بس لو انت في
// لوحة التحكم** (`if (state.screen === 'home')`). ده كان منطقي لما البيانات
// دي كانت تخص لوحة التحكم لوحدها.
//
// لكن من v0.19 بقت **قايمة الفئات الجانبية** بتستخدم نفس البيانات في كل
// الشاشات (النقط الملوّنة قدام كل فئة + شرايط الفلترة فوقها). فالنتيجة:
// تطلب تزويد لدرجة وانت في شاشة الشيت → الحالة بتتغيّر في الجدول (ده
// اشتراك تاني)، لكن النقطة والعدّاد في القايمة الجانبية **مايتحدّثوش**،
// وفلتر "مطلوب تزويد" مايجيبش الفئة دي.
//
// فالرسم بقى مربوط بإن النظام مفتوح، مش بشاشة معيّنة.
function renderIfOpen() {
  // ⚠️ renderFromData مش render: التبليغ ده جاي من السحابة، وممكن يوصل
  // والمستخدم واقف بيكتب في خانة كمية. الرسم بيهدّ الخانة والكيبورد بيتقفل.
  // (الشرح الكامل عند renderFromData في js/app.js)
  if (state.view === 'dashboard') renderFromData();
}

// ------------------------------------------------------------
// أخطاء الاستعلامات الشاملة لازم **تبان**، مش تختفي في الكونسول
// ------------------------------------------------------------
// الأربع استعلامات دي (معلّق / خلص / قرّب يخلص / الأساسية) هي مصدر كل
// العدّادات والنقط الملوّنة في القايمة الجانبية. لو واحد فيهم فشل، كان
// العدّاد بيفضل صفر **من غير أي علامة** — والمستخدم يفتكر إن مفيش نواقص،
// وهو أصلًا شايف العكس في الجدول. الصمت هنا أخطر من رسالة الخطأ.
//
// دلوقتي بيظهر شريط أحمر مكتوب فيه العنصر اللي فشل، فنعرف نصلّحه بدل ما
// نفضل نخمّن.
function reportOverviewError(what, err) {
  const code = (err && err.code) || '';
  const raw = (err && err.message) || '';
  console.error(`فشل استعلام "${what}":`, err);
  if (typeof showFatalError !== 'function') return;

  // failed-precondition من Firestore معناها حاجة واحدة تقريبًا دايمًا:
  // **الفهرس ناقص**. بنقول ده بالعربي بدل ما نسيب المستخدم قدام كود
  // إنجليزي مالوش معنى. وساعات الرسالة الأصلية جواها رابط بيعمل الفهرس
  // بضغطة — فبنعرضها كاملة تحت العربي.
  if (code === 'failed-precondition') {
    scheduleOverviewRetry();
    showFatalError(
      `"${what}": الفهرس المطلوب في Firestore مش موجود أو لسه بيتبني. ` +
        `العدّادات في القايمة الجانبية هتبان ناقصة لحد ما يخلص — والنظام ` +
        `هيحاول لوحده كل دقيقتين، فمش محتاج تعمل حاجة. ` +
        (raw ? `[التفاصيل: ${raw}]` : '')
    );
    return;
  }

  showFatalError(
    `تعذّر قراءة "${what}" من السحابة${code ? ` (${code})` : ''} — العدّادات في القايمة الجانبية ممكن تبان ناقصة.` +
      (raw ? ` [${raw}]` : '')
  );
}

// ------------------------------------------------------------
// إعادة المحاولة بعد فشل بسبب فهرس ناقص
// ------------------------------------------------------------
// لما الاستعلام يفشل، Firestore **بيقفل المتابعة خلاص** ومابيحاولش تاني.
// معنى كده إنك لو صلّحت الفهرس، النظام مايحسّش — لازم تعمل ري فريش.
//
// عشان ما نطلبش ده من المستخدم، بنعيد المحاولة لوحدنا 3 مرات كل دقيقتين.
// دقيقتين × 3 بيغطّي وقت بناء الفهرس في Firestore عادةً.
//
// ليه 3 مرات وبس؟ لأن لو الفهرس مش موجود أصلًا (مش بس بيتبني)، إعادة
// المحاولة للأبد بتستهلك من حد الاستعلامات المجاني على الفاضي.
const OVERVIEW_RETRY_MS = 2 * 60 * 1000;
const OVERVIEW_RETRY_LIMIT = 3;
let overviewRetries = 0;
let overviewRetryTimer = null;

function scheduleOverviewRetry() {
  if (overviewRetryTimer || overviewRetries >= OVERVIEW_RETRY_LIMIT) return;
  overviewRetries++;
  overviewRetryTimer = setTimeout(() => {
    overviewRetryTimer = null;
    console.warn(`إعادة محاولة قراءة الملخّص (${overviewRetries}/${OVERVIEW_RETRY_LIMIT})...`);
    subscribeOverview();
  }, OVERVIEW_RETRY_MS);
}

let unsubPresence = null;
let presenceTimer = null;

// ------------------------------------------------------------
// مين شغّال دلوقتي
// ------------------------------------------------------------
// كل مستخدم بيحدّث حقل lastSeen بتاعه كل 5 دقايق. قواعد الأمان بتسمح له
// يعدّل **الحقل ده بس وعلى حسابه هو بس** — مايقدرش يغيّر رتبته ولا يلمس
// حساب حد تاني.
const PRESENCE_INTERVAL_MS = 5 * 60 * 1000;
const ONLINE_WINDOW_MS = 8 * 60 * 1000; // أطول شوية من النبضة عشان ما يومضش

function touchPresence() {
  if (!state.user) return;
  fireWrite(
    db.collection('users').doc(state.user.uid).update({
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    }),
    'آخر ظهور'
  );
}

function startPresenceHeartbeat() {
  stopPresenceHeartbeat();
  touchPresence();
  presenceTimer = setInterval(touchPresence, PRESENCE_INTERVAL_MS);

  unsubPresence = db.collection('users').onSnapshot(
    (snap) => {
      state.presence = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // الحضور بيظهر في لوحة التحكم بس، وبيتحدّث كل 5 دقايق لكل مستخدم —
      // فمش منطقي يعيد رسم شاشة انت بتكتب فيها.
      if (state.screen === 'home') renderFromData();
    },
    (err) => console.warn('تعذّر قراءة حالة المستخدمين:', err)
  );
}

function stopPresenceHeartbeat() {
  if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
  if (unsubPresence) { unsubPresence(); unsubPresence = null; }
}

// بيرجّع معرّف الفئة من مسار الدرجة: categories/{catId}/grades/{gradeId}
function categoryIdOfGrade(doc) {
  const parent = doc.ref.parent.parent;
  return parent ? parent.id : '';
}

// ============================================================
// ⭐ استعلام واحد بدل أربعة — ومن غير أي فهارس مطلوبة
// ============================================================
// القصة: كان فيه 4 استعلامات منفصلة على كل الدرجات في كل الفئات:
//   • اللي حالتها "معلّق"      (where status == pending)
//   • اللي حالتها "خلصت"       (where status == out)
//   • الدرجات الأساسية         (where isBase == true)
//   • اللي كميتها تحت الحد     (where branchQty <= n)
//
// وكل استعلام فيه شرط where على حقل معيّن — و**ده اللي كان بيحتاج فهرس
// خاص** في Firestore. الفهرس ده مابيتعملش لوحده، ورفعه محتاج صلاحية
// إدارية على المشروع. النتيجة: الأربعة كانوا بيترفضوا
// (failed-precondition)، وكل العدّادات والنقط الملوّنة بتفضل صفر.
//
// الحل: استعلام **واحد من غير أي شرط** — بنجيب الدرجات كلها ونحسب
// الأربع حاجات على الجهاز في لفة واحدة.
//
// ليه ده مايحتاجش فهرس؟ لأن الشرط هو اللي بيحتاج فهرس. استعلام من غير
// شرط بيمشي على الفهرس الأساسي اللي Firestore عامله لوحده من أول يوم.
// (نفس النوع بالظبط اللي زرار "احسب الإجمالي" شغّال بيه من زمان.)
//
// ------------------------------------------------------------
// التكلفة — الحساب مكتوب صريح عشان يتراجع لو الأرقام كبرت
// ------------------------------------------------------------
// بنقرا كل الدرجات مرة واحدة عند فتح النظام (~2000 قراءة)، وبعدها
// المتابعة الحيّة **مابتحاسبش غير على اللي بيتغيّر فعلًا** — يعني درجة
// تتعدّل = قراءة واحدة، مش 2000.
//
// الحد المجاني 50 ألف قراءة في اليوم، والتخزين المحلي بيقلّل حتى القراءة
// الأولى دي في الفتحات اللي بعدها. لو عدد الدرجات وصل عشرات الآلاف يومًا
// ما، ساعتها نرجع للاستعلامات المفلترة ونعمل الفهارس.
//
// ومكسب جانبي: تنبيه "قرّبت تخلص" بقى **مظبوط تمامًا**. قبل كده كان
// بيستعلم بأكبر حد أدنى في كل الفئات وبعدين يفلتر على الجهاز — حيلة
// كانت لازمة عشان Firestore مايقدرش يقارن كل درجة بحد فئتها. دلوقتي
// الحساب كله على الجهاز أصلًا، فكل فئة بتتحاسب بحدها هي.
let unsubAllGrades = null;
let allGradesCache = null; // آخر نسخة من درجات كل الفئات

function subscribeOverview() {
  if (unsubAllGrades) unsubAllGrades();
  unsubAllGrades = db.collectionGroup('grades').onSnapshot(
    (snap) => {
      allGradesCache = snap.docs.map((d) => {
        const g = d.data();
        return {
          catId: categoryIdOfGrade(d),
          status: g.status,
          isBase: !!g.isBase,
          name: g.name,
          number: g.number,
          branchQty: Number(g.branchQty) || 0,
          criticalQty: g.criticalQty,
        };
      });
      recomputeOverview();
      // ⭐ نفس اللقطة دي هي اللي بتعرف إن فيه طلب تزويد جديد. مافيش
      // اشتراك تاني ولا قراءة زيادة — الخبر كان واصل أصلًا وكنا بس
      // مابنعملش بيه حاجة. (الشرح في js/notify.js)
      if (typeof onGradesSnapshotForNotify === 'function') onGradesSnapshotForNotify(snap);
    },
    (err) => reportOverviewError('درجات كل الفئات', err)
  );
}

function recomputeOverview() {
  if (!allGradesCache) return;

  const pending = {};
  const out = {};
  const low = {};
  let pendingCount = 0;
  let outCount = 0;
  let lowCount = 0;

  const catById = {};
  state.categories.forEach((c) => (catById[c.id] = c));

  const add = (map, catId, label) => {
    if (!map[catId]) map[catId] = [];
    map[catId].push(label);
  };

  allGradesCache.forEach((g) => {
    if (!g.catId) return;
    const label = g.isBase ? g.name || 'أساسية' : g.number;

    if (g.status === 'pending') {
      add(pending, g.catId, label);
      pendingCount++;
      return;
    }
    if (g.status === 'out') {
      add(out, g.catId, label);
      outCount++;
      return;
    }

    // الباقي حالته عادية — نشوف قرّبت تخلص ولا لأ.
    // الدرجات الأساسية ليها حدها الحرج الخاص، والباقي بياخد حد فئته.
    const cat = catById[g.catId] || {};
    const limit = g.isBase
      ? Number(g.criticalQty) || DEFAULT_BASE_CRITICAL_QTY
      : Number(cat.minQty) || 0;
    if (limit > 0 && g.branchQty <= limit) {
      add(low, g.catId, label);
      lowCount++;
    }
  });

  // الأرقام بترتّب تصاعدي، والأسماء (الدرجات الأساسية) بتيجي في الآخر.
  const sortLabels = (map) =>
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => {
        const na = typeof a === 'number';
        const nb = typeof b === 'number';
        if (na && nb) return a - b;
        if (na) return -1;
        if (nb) return 1;
        return String(a).localeCompare(String(b), 'ar');
      })
    );
  sortLabels(pending);
  sortLabels(out);
  sortLabels(low);

  state.pendingByCategory = pending;
  state.pendingCount = pendingCount;
  state.outByCategory = out;
  state.outCount = outCount;
  state.lowStockByCategory = low;
  state.lowStockCount = lowCount;

  renderIfOpen();
}

// الدالتين دول بقوا مجرد أسماء محفوظة: الحساب كله بقى في recomputeOverview.
// subscribeLowStock لسه بتتنادى من app.js مع كل تغيير في الفئات، وده مهم
// فعلًا — لأن الحد الأدنى محفوظ على الفئة، فتغييره لازم يعيد الحساب.
function subscribeBaseGrades() {
  /* اتدمجت في subscribeOverview */
}

function subscribeLowStock() {
  recomputeOverview();
}

function stopOverview() {
  if (overviewRetryTimer) { clearTimeout(overviewRetryTimer); overviewRetryTimer = null; }
  overviewRetries = 0;
  if (unsubAllGrades) { unsubAllGrades(); unsubAllGrades = null; }
  allGradesCache = null;
  stopPresenceHeartbeat();
}

// ------------------------------------------------------------
// إجمالي الكميات في كل مخزن
// ------------------------------------------------------------
// ده محتاج قراءة **كل** الدرجات (~2000)، فمش منطقي يتحسب تلقائيًا مع كل
// فتحة للشاشة. بيتحسب بالضغط على زرار بس، والنتيجة بتفضل معروضة بوقتها.
async function computeStockTotals() {
  const snap = await db.collectionGroup('grades').get();
  let branch = 0;
  let main = 0;
  snap.docs.forEach((d) => {
    const g = d.data();
    branch += Number(g.branchQty) || 0;
    main += Number(g.mainQty) || 0;
  });
  state.stockTotals = { branch, main, grades: snap.size, at: new Date() };
  renderFromData();
}


function statTileHTML(value, label, color) {
  return `
    <div class="stat-tile" style="border-inline-start:4px solid ${color};">
      <div class="stat-value">${escapeHTML(value)}</div>
      <div class="stat-label">${escapeHTML(label)}</div>
    </div>`;
}

// قايمة فئات مع أرقام الدرجات جواها — بتستخدم للنواقص وللي خلص.
function categoryBreakdownHTML(byCategory, emptyText, actionLabel) {
  const entries = Object.entries(byCategory || {});
  if (!entries.length) {
    return `<div class="home-empty">${escapeHTML(emptyText)}</div>`;
  }

  return entries
    .sort((a, b) => b[1].length - a[1].length)
    .map(([catId, numbers]) => {
      const cat = state.categories.find((c) => c.id === catId);
      const name = cat ? cat.name : 'فئة محذوفة';
      const shown = numbers.slice(0, 12).join('، ');
      const more = numbers.length > 12 ? ` و${numbers.length - 12} كمان` : '';
      return `
        <div class="home-row">
          <div style="flex:1; min-width:0;">
            <div class="home-row-title">${escapeHTML(name)} — ${numbers.length}</div>
            <div class="home-row-sub">درجات: ${escapeHTML(shown)}${escapeHTML(more)}</div>
          </div>
          ${cat ? `<button class="btn" data-open-category="${escapeHTML(catId)}">${escapeHTML(actionLabel)}</button>` : ''}
        </div>`;
    })
    .join('');
}

function recentActivityHTML() {
  const items = (state.activityLog || []).slice(0, 8);
  if (!items.length) {
    return `<div class="home-empty">مفيش حركات مسجّلة لسه.</div>`;
  }

  const verbs = {
    edit: 'عدّل كمية',
    add_category: 'ضاف فئة',
    delete_category: 'مسح فئة',
    add_grade: 'ضاف درجة',
    add_grade_range: 'ضاف درجات دفعة',
    delete_grade: 'مسح درجة',
    edit_category_info: 'عدّل بيانات فئة',
    request_shortage: 'طلب تزويد',
    cancel_shortage: 'ألغى طلب تزويد',
    fulfill_shortage: 'زوّد',
    mark_out_of_stock: 'علّم خلصت نهائيًا',
    reset_available: 'رجّعها متاحة',
    import_category: 'استورد فئة',
    add_user: 'ضاف حساب',
    edit_user: 'عدّل حساب',
  };

  return items
    .map((a) => {
      const when = a.timestamp && a.timestamp.toDate
        ? a.timestamp.toDate().toLocaleString('ar-EG', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      const what = verbs[a.action] || a.action || '';
      const where = [a.categoryName, a.gradeNumber ? `درجة ${a.gradeNumber}` : '']
        .filter(Boolean)
        .join(' — ');
      return `
        <div class="home-row">
          <div style="flex:1; min-width:0;">
            <div class="home-row-title">${escapeHTML(a.userName || '؟')} — ${escapeHTML(what)}</div>
            <div class="home-row-sub">${escapeHTML(where)}</div>
          </div>
          <span class="home-time">${escapeHTML(when)}</span>
        </div>`;
    })
    .join('');
}

function dashboardHomeHTML() {
  const canEditMain = canEditWarehouse(state.profile, 'main');
  // نفس مصدر القايمة الجانبية والعدّاد اللي فوق — رقم واحد في كل مكان.
  const pendingTotal = totalPendingNow();
  const outTotal = state.outCount || 0;

  return `
    <div class="home-wrap">
      <div class="stat-row">
        ${statTileHTML(pendingTotal, 'طلب تزويد معلّق', 'var(--purple-text)')}
        ${statTileHTML(state.lowStockCount || 0, 'درجة قرّبت تخلص', 'var(--warning-text)')}
        ${statTileHTML(outTotal, 'درجة خلصت نهائيًا', 'var(--danger-text)')}
        ${statTileHTML(state.categories.length, 'فئة (شيت)', 'var(--accent)')}
      </div>

      <div class="home-card">
        <div class="home-title">
          🟣 طلبات التزويد المعلّقة
          ${
            pendingTotal && canEditMain
              ? '<span class="home-hint">انت مسؤول عن الرد عليها</span>'
              : ''
          }
        </div>
        ${categoryBreakdownHTML(state.pendingByCategory, 'مفيش أي طلب تزويد معلّق. كله تمام ✅', 'افتح')}
      </div>

      <div class="home-card">
        <div class="home-title">🔴 خلصت نهائيًا <span class="home-hint">شيل العينة من العرض</span></div>
        ${categoryBreakdownHTML(state.outByCategory, 'مفيش أي درجة خلصت نهائيًا.', 'افتح')}
      </div>

      <div class="home-card">
        <div class="home-title">🟠 قرّبت تخلص <span class="home-hint">قبل ما تخلص خالص</span></div>
        ${lowStockHTML()}
      </div>

      <div class="home-card">
        <div class="home-title">📦 إجمالي الكميات</div>
        ${stockTotalsHTML()}
      </div>

      <div class="home-card">
        <div class="home-title">👥 مين شغّال دلوقتي</div>
        ${presenceHTML()}
      </div>

      <div class="home-card">
        <div class="home-title">⏱️ آخر الحركات</div>
        ${recentActivityHTML()}
      </div>
    </div>`;
}

function lowStockHTML() {
  // الدرجات الأساسية ليها حد حرج جواها، فلو فيه أي واحدة قرّبت تخلص
  // يبقى فيه تنبيه شغّال حتى لو مفيش فئة محدّد ليها حد أدنى.
  const anyThreshold =
    state.categories.some((c) => Number(c.minQty) > 0) ||
    Object.keys(state.lowStockByCategory || {}).length > 0;
  if (!anyThreshold) {
    return `
      <div class="home-empty">
        لسه ما حددتش حد أدنى لأي فئة.<br>
        افتح أي فئة ← <strong>تعديل</strong> ← اكتب رقم في خانة
        <strong>"الحد الأدنى للتنبيه"</strong>، وأي درجة توصله هتظهر هنا.
      </div>`;
  }
  return categoryBreakdownHTML(
    state.lowStockByCategory,
    'مفيش أي درجة قرّبت تخلص. كله فوق الحد الأدنى ✅',
    'افتح'
  );
}

function stockTotalsHTML() {
  const t = state.stockTotals;
  if (!t) {
    return `
      <div class="home-empty" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span>الحساب بيقرا كل الدرجات، فبيتعمل لما تطلبه بس.</span>
        <button class="btn" id="calc-totals-btn">احسب الإجمالي</button>
      </div>`;
  }
  const when = t.at.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return `
    <div class="stat-row" style="margin-bottom:8px;">
      ${statTileHTML(t.branch, 'قطعة في مخزن الفرع', '#2e7d32')}
      ${statTileHTML(t.main, 'قطعة في المخزن الرئيسي', '#1565c0')}
      ${statTileHTML(t.branch + t.main, 'الإجمالي', 'var(--text-secondary)')}
    </div>
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <span class="home-hint">محسوب من ${escapeHTML(t.grades)} درجة — الساعة ${escapeHTML(when)}</span>
      <button class="btn" id="calc-totals-btn" style="padding:4px 12px; font-size:12px;">حدّث</button>
    </div>`;
}

function presenceHTML() {
  const users = (state.presence || []).slice();
  if (!users.length) return `<div class="home-empty">جارٍ التحميل...</div>`;

  const now = Date.now();
  const withTime = users.map((u) => {
    const ms = u.lastSeen && u.lastSeen.toMillis ? u.lastSeen.toMillis() : 0;
    return { ...u, ms, online: ms && now - ms < ONLINE_WINDOW_MS };
  });
  // المتصلين الأول، وبعدين الأحدث ظهورًا
  withTime.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || b.ms - a.ms);

  const ago = (ms) => {
    if (!ms) return 'ما دخلش من النسخة دي';
    const mins = Math.floor((now - ms) / 60000);
    if (mins < 60) return `من ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `من ${hrs} ساعة`;
    return `من ${Math.floor(hrs / 24)} يوم`;
  };

  return withTime
    .map(
      (u) => `
      <div class="home-row">
        <span style="width:9px; height:9px; border-radius:50%; flex:0 0 9px;
                     background:${u.online ? '#2e7d32' : 'var(--text-muted)'};"></span>
        <div style="flex:1; min-width:0;">
          <div class="home-row-title">${escapeHTML(u.name || '؟')}</div>
          <div class="home-row-sub">${escapeHTML(ROLE_LABELS_AR[u.role] || u.role || '')}</div>
        </div>
        <span class="home-time">${escapeHTML(u.online ? 'متصل الآن' : ago(u.ms))}</span>
      </div>`
    )
    .join('');
}

function attachHomeEvents() {
  const calcBtn = document.getElementById('calc-totals-btn');
  if (calcBtn) {
    calcBtn.addEventListener('click', async () => {
      calcBtn.disabled = true;
      calcBtn.textContent = 'جارٍ الحساب...';
      try {
        await computeStockTotals();
      } catch (err) {
        console.error(err);
        calcBtn.disabled = false;
        calcBtn.textContent = 'حاول تاني';
      }
    });
  }

  document.querySelectorAll('[data-open-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const catId = btn.getAttribute('data-open-category');
      state.activeCategoryId = catId;
      state.screen = 'sheets';
      state.grades = [];
      render();
      subscribeGrades(catId);
    });
  });
}
