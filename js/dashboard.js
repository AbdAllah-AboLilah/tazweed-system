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

function stopOverview() {
  if (unsubPendingOverview) { unsubPendingOverview(); unsubPendingOverview = null; }
  if (unsubOutOverview) { unsubOutOverview(); unsubOutOverview = null; }
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
        <div class="home-title">⏱️ آخر الحركات</div>
        ${recentActivityHTML()}
      </div>
    </div>`;
}

function attachHomeEvents() {
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
