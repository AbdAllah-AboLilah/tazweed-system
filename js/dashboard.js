// ============================================================
// لوحة التحكم — شاشة الملخّص
// ============================================================
// المشكلة اللي بتحلها: عشان تعرف فيه نواقص فين، كنت لازم تفتح الـ25 تاب
// واحد واحد. الشاشة دي بتجمّع كل حاجة محتاجة انتباهك في مكان واحد.
//
// ملحوظة عن التكلفة: بنقرا **الدرجات اللي حالتها معلّقة أو خلصت بس** —
// مش كل الـ2000 درجة. دول مجموعتين صغيرتين بطبيعتهم، فالشاشة خفيفة.

let unsubPendingOverview = null;
let unsubOutOverview = null;
let unsubLowStock = null;
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
      if (state.screen === 'home') render();
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

function subscribeOverview() {
  if (unsubPendingOverview) unsubPendingOverview();
  if (unsubOutOverview) unsubOutOverview();

  unsubPendingOverview = db
    .collectionGroup('grades')
    .where('status', '==', 'pending')
    .onSnapshot(
      (snap) => {
        state.pendingByCategory = groupByCategory(snap);
        state.pendingCount = snap.size;
        if (state.screen === 'home') render();
      },
      (err) => console.warn('تعذّر قراءة الطلبات المعلّقة:', err)
    );

  unsubOutOverview = db
    .collectionGroup('grades')
    .where('status', '==', 'out')
    .onSnapshot(
      (snap) => {
        state.outByCategory = groupByCategory(snap);
        state.outCount = snap.size;
        if (state.screen === 'home') render();
      },
      (err) => console.warn('تعذّر قراءة الدرجات اللي خلصت:', err)
    );
}

// ------------------------------------------------------------
// تنبيه "قرب يخلص"
// ------------------------------------------------------------
// الحد الأدنى بيتحدد **لكل فئة على حدة** (حقل minQty في الفئة، صفر = مقفول).
// لكن Firestore مايقدرش يقارن كل درجة بحد مختلف حسب فئتها في استعلام واحد.
//
// الحل: بنستعلم بأكبر حد أدنى موجود في كل الفئات (رقم صغير عادة)، وبعدين
// بنفلتر على الجهاز حسب حد كل فئة. كده استعلام واحد بسيط من غير أي فهرس
// مركّب محتاج إعداد يدوي في Firebase — ولو مفيش أي فئة مفعّلة، مبنعملش
// الاستعلام أصلًا (تكلفة صفر).
let lowStockThreshold = null; // آخر حد اتبني عليه الاستعلام
let unsubBaseGrades = null;

// تنبيه "قرّبت تخلص" بقى ليه مصدرين، وبنجمّعهم في مكان واحد:
//   1) الدرجات المرقّمة اللي نزلت تحت الحد الأدنى بتاع فئتها
//   2) الدرجات الأساسية (أبيض/أسود/أوف وايت) اللي نزلت تحت حدها الحرج
function recomputeLowStock() {
  const merged = {};
  const add = (map) => {
    Object.entries(map || {}).forEach(([catId, arr]) => {
      if (!merged[catId]) merged[catId] = [];
      arr.forEach((v) => {
        if (merged[catId].indexOf(v) === -1) merged[catId].push(v);
      });
    });
  };
  add(state.lowStockNumbered);
  add(state.lowStockBase);
  state.lowStockByCategory = merged;
  state.lowStockCount = Object.values(merged).reduce((s, a) => s + a.length, 0);
  if (state.screen === 'home') render();
}

// الدرجات الأساسية قليلة جدًا (3 لكل فئة = ~75 مستند لـ25 فئة)، فاستعلام
// مستقل ليها رخيص، وبيدينا الحد الحرج بتاع كل واحدة بدقة.
function subscribeBaseGrades() {
  if (unsubBaseGrades) unsubBaseGrades();
  unsubBaseGrades = db
    .collectionGroup('grades')
    .where('isBase', '==', true)
    .onSnapshot(
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const g = d.data();
          if (g.status !== 'normal') return;
          const limit = Number(g.criticalQty) || DEFAULT_BASE_CRITICAL_QTY;
          if ((Number(g.branchQty) || 0) > limit) return;
          const catId = categoryIdOfGrade(d);
          if (!map[catId]) map[catId] = [];
          map[catId].push(g.name || 'أساسية');
        });
        state.lowStockBase = map;
        recomputeLowStock();
      },
      (err) => console.warn('تعذّر قراءة الدرجات الأساسية:', err)
    );
}

function subscribeLowStock() {
  const maxThreshold = state.categories.reduce((m, c) => Math.max(m, Number(c.minQty) || 0), 0);

  // الدالة دي بتتنادى مع كل تحديث للفئات. من غير الشرط ده كانت بتلغي
  // وتعيد بناء الاشتراك في كل مرة من غير أي داعي — وكتر إلغاء وإعادة
  // بناء الاشتراكات هو اللي بيطلّع خطأ Firestore الداخلي.
  if (maxThreshold === lowStockThreshold) return;
  lowStockThreshold = maxThreshold;

  if (unsubLowStock) { unsubLowStock(); unsubLowStock = null; }

  if (!maxThreshold) {
    state.lowStockNumbered = {};
    recomputeLowStock();
    return;
  }

  unsubLowStock = db
    .collectionGroup('grades')
    .where('branchQty', '<=', maxThreshold)
    .onSnapshot(
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const g = d.data();
          // اللي معلّق أو خلص ليهم أقسامهم — مش تنبيه "قرب يخلص"
          if (g.status !== 'normal') return;
          // الدرجات الأساسية ليها استعلامها وحدها بحدها الحرج الخاص
          if (g.isBase) return;
          const catId = categoryIdOfGrade(d);
          const cat = state.categories.find((c) => c.id === catId);
          const limit = Number(cat && cat.minQty) || 0;
          if (!limit || (g.branchQty || 0) > limit) return;
          if (!map[catId]) map[catId] = [];
          map[catId].push(g.number);
        });
        Object.values(map).forEach((arr) => arr.sort((a, b) => a - b));
        state.lowStockNumbered = map;
        recomputeLowStock();
      },
      (err) => console.warn('تعذّر قراءة الدرجات اللي قرّبت تخلص:', err)
    );
}

function stopOverview() {
  if (unsubPendingOverview) { unsubPendingOverview(); unsubPendingOverview = null; }
  if (unsubOutOverview) { unsubOutOverview(); unsubOutOverview = null; }
  if (unsubLowStock) { unsubLowStock(); unsubLowStock = null; }
  if (unsubBaseGrades) { unsubBaseGrades(); unsubBaseGrades = null; }
  lowStockThreshold = null;
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
  render();
}

function groupByCategory(snap) {
  const map = {};
  snap.docs.forEach((d) => {
    const catId = categoryIdOfGrade(d);
    if (!catId) return;
    if (!map[catId]) map[catId] = [];
    map[catId].push(d.data().number);
  });
  Object.values(map).forEach((arr) => arr.sort((a, b) => a - b));
  return map;
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
  const pendingTotal = state.pendingCount || 0;
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
  const anyBase = Object.keys(state.lowStockBase || {}).length > 0;
  const anyThreshold = state.categories.some((c) => Number(c.minQty) > 0) || anyBase;
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
