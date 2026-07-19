// نظام التزويد — منطق الواجهة (JavaScript عادي بالكامل، بدون أي إطار عمل)

// ============================================================
// الحالة العامة للتطبيق
// ============================================================
const state = {
  view: 'loading', // loading | not-configured | login | no-profile | dashboard
  user: null,
  profile: null,
  categories: [],
  activeCategoryId: null,
  grades: [],
  loginError: '',
  loginBusy: false,
  showActivityLog: false,
  activityLog: [],
};

let unsubProfile = null;
let unsubCategories = null;
let unsubGrades = null;
let unsubActivityLog = null;

// ============================================================
// أدوات مساعدة
// ============================================================
function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function statusLabel(status) {
  if (status === 'pending') return 'طلب معلّق';
  if (status === 'out') return 'خلصت نهائيًا';
  return 'عادي';
}

function statusBadgeClass(status) {
  if (status === 'pending') return 'badge-pending';
  if (status === 'out') return 'badge-out';
  return 'badge-normal';
}

function rowClassForStatus(status) {
  if (status === 'pending') return 'row-pending';
  if (status === 'out') return 'row-out';
  return '';
}

// ============================================================
// الرسم الرئيسي: بيقرر يعرض إيه بناءً على state.view
// ============================================================
function render() {
  const root = document.getElementById('root');

  if (!FIREBASE_IS_CONFIGURED) {
    root.innerHTML = notConfiguredHTML();
    return;
  }

  if (state.view === 'loading') {
    root.innerHTML = `<div style="padding:2rem; text-align:center;">جارٍ التحميل...</div>`;
    return;
  }

  if (state.view === 'login') {
    root.innerHTML = loginHTML();
    attachLoginEvents();
    return;
  }

  if (state.view === 'no-profile') {
    root.innerHTML = `
      <div style="padding:2rem; text-align:center;">
        الحساب مسجّل دخول لكن لا يوجد له صلاحية مُعرَّفة بعد. اطلب من المدير
        إنشاء بروفايل الصلاحية في users/{uid}.
      </div>`;
    return;
  }

  if (state.view === 'dashboard') {
    root.innerHTML = dashboardHTML();
    attachDashboardEvents();
    return;
  }
}

function notConfiguredHTML() {
  return `
    <div class="card" style="max-width:480px; margin:60px auto; text-align:center;">
      <h2 style="font-size:16px; margin-bottom:10px;">النظام لسه مش متوصل بـ Firebase</h2>
      <p style="font-size:14px; color:var(--text-secondary); line-height:1.7;">
        افتح ملف <code>firebase-config.js</code> واستبدل القيم بالبيانات الحقيقية بتاعة
        مشروعك على Firebase. الخطوات موجودة في <code>README.md</code> — قسم 2.
      </p>
    </div>`;
}

// ============================================================
// شاشة تسجيل الدخول
// ============================================================
function loginHTML() {
  return `
    <div class="login-wrap">
      <form class="card login-card" id="login-form">
        <h1 style="font-size:18px; font-weight:500; margin-bottom:4px;">
          ${escapeHTML(APP_NAME)}
          <span style="font-size:12px; color:var(--text-muted); font-weight:400;">v${escapeHTML(APP_VERSION)}</span>
        </h1>
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">تسجيل الدخول</div>

        ${state.loginError ? `<div class="error-text">${escapeHTML(state.loginError)}</div>` : ''}

        <div class="field">
          <label for="email">البريد الإلكتروني</label>
          <input class="input" type="email" id="email" required />
        </div>

        <div class="field">
          <label for="password">كلمة المرور</label>
          <input class="input" type="password" id="password" required />
        </div>

        <div class="checkbox-row">
          <input type="checkbox" id="keep" checked />
          <label for="keep">إبقاء تسجيل الدخول</label>
        </div>

        <button class="btn btn-primary" type="submit" style="width:100%;" ${state.loginBusy ? 'disabled' : ''}>
          ${state.loginBusy ? 'جارٍ الدخول...' : 'دخول'}
        </button>
      </form>
    </div>`;
}

function attachLoginEvents() {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const keepLoggedIn = document.getElementById('keep').checked;

    state.loginError = '';
    state.loginBusy = true;
    render();

    try {
      await auth.setPersistence(
        keepLoggedIn ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION
      );
      await auth.signInWithEmailAndPassword(email, password);
      // onAuthStateChanged هيتكفل بتغيير الشاشة بعد كده
    } catch (err) {
      state.loginError = 'بيانات الدخول غير صحيحة، أو الحساب غير موجود.';
      state.loginBusy = false;
      render();
    }
  });
}

// ============================================================
// لوحة التحكم: التابات + جدول الدرجات
// ============================================================
function dashboardHTML() {
  const roleLabel = ROLE_LABELS_AR[state.profile?.role] || '';

  const tabsHTML = state.categories
    .map(
      (cat) => `
      <button class="tab ${cat.id === state.activeCategoryId ? 'tab-active' : ''}" data-category-id="${escapeHTML(cat.id)}">
        ${escapeHTML(cat.name)}
      </button>`
    )
    .join('');

  let bodyHTML;
  if (state.showActivityLog) {
    bodyHTML = `<div style="padding:1rem;">${activityLogHTML()}</div>`;
  } else if (state.categories.length === 0) {
    bodyHTML = `<div style="padding:2rem; text-align:center; color:var(--text-secondary);">لا توجد فئات (شيتات) مضافة بعد في قاعدة البيانات.</div>`;
  } else {
    bodyHTML = `
      <div class="tabs">${tabsHTML}</div>
      <div style="padding:1rem;">${gradeTableHTML()}</div>`;
  }

  return `
    <div>
      <div class="topbar">
        <div>
          <div style="font-size:14px; font-weight:500;">${escapeHTML(state.profile?.name)}</div>
          <div style="font-size:12px; color:var(--text-secondary);">${escapeHTML(roleLabel)}</div>
        </div>
        <div style="display:flex; align-items:center; gap:16px;">
          <span style="font-size:13px;">
            ${escapeHTML(APP_NAME)}
            <span style="font-size:11px; color:var(--text-muted);">v${escapeHTML(APP_VERSION)}</span>
          </span>
          <button class="btn" id="activity-log-btn">${state.showActivityLog ? 'رجوع للشيتات' : 'سجل العمليات'}</button>
          <button class="btn" id="logout-btn">تسجيل خروج</button>
        </div>
      </div>
      ${bodyHTML}
    </div>`;
}

function qtyCellHTML(categoryId, gradeId, field, value, canEdit) {
  if (!canEdit) {
    return `<td>${escapeHTML(value ?? 0)}</td>`;
  }
  return `
    <td>
      <div class="qty-cell">
        <button class="qty-btn" data-action="dec" data-category-id="${escapeHTML(categoryId)}" data-grade-id="${escapeHTML(gradeId)}" data-field="${field}">−</button>
        <input
          class="qty-input"
          type="number"
          value="${escapeHTML(value ?? 0)}"
          data-category-id="${escapeHTML(categoryId)}"
          data-grade-id="${escapeHTML(gradeId)}"
          data-field="${field}"
        />
        <button class="qty-btn" data-action="inc" data-category-id="${escapeHTML(categoryId)}" data-grade-id="${escapeHTML(gradeId)}" data-field="${field}">+</button>
      </div>
    </td>`;
}

function gradeTableHTML() {
  if (state.grades.length === 0) {
    return `<div style="padding:1rem; color:var(--text-secondary);">لا توجد درجات مضافة في هذه الفئة بعد.</div>`;
  }

  const canEditBranch = canEditWarehouse(state.profile, 'branch');
  const canEditMain = canEditWarehouse(state.profile, 'main');

  const rows = state.grades
    .map(
      (g) => `
      <tr class="${rowClassForStatus(g.status)}">
        <td>${escapeHTML(g.number)}</td>
        <td>${escapeHTML(g.itemName || '—')}</td>
        <td>${escapeHTML(g.barcodeNumber || '—')}</td>
        ${qtyCellHTML(state.activeCategoryId, g.id, 'branchQty', g.branchQty, canEditBranch)}
        ${qtyCellHTML(state.activeCategoryId, g.id, 'mainQty', g.mainQty, canEditMain)}
        <td><span class="badge ${statusBadgeClass(g.status)}">${statusLabel(g.status)}</span></td>
      </tr>`
    )
    .join('');

  return `
    <div class="card" style="padding:0; overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>الدرجة</th>
            <th>اسم الصنف</th>
            <th>الباركود</th>
            <th>الفرع</th>
            <th>الرئيسي</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function activityLogHTML() {
  if (state.activityLog.length === 0) {
    return `<div style="padding:1rem; color:var(--text-secondary);">لا يوجد أي عمليات مسجّلة بعد.</div>`;
  }

  const rows = state.activityLog
    .map((entry) => {
      const when = entry.timestamp && entry.timestamp.toDate ? entry.timestamp.toDate().toLocaleString('ar-EG') : '—';
      const fieldLabel = entry.field === 'branchQty' ? 'مخزن الفرع' : entry.field === 'mainQty' ? 'المخزن الرئيسي' : entry.field || '';
      return `
        <tr>
          <td>${escapeHTML(when)}</td>
          <td>${escapeHTML(entry.userName)}</td>
          <td>${escapeHTML(entry.gradeNumber)} — ${escapeHTML(entry.itemName || '')}</td>
          <td>${escapeHTML(fieldLabel)}</td>
          <td>${escapeHTML(entry.oldValue)} ← ${escapeHTML(entry.newValue)}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="card" style="padding:0; overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>الوقت</th>
            <th>الشخص</th>
            <th>الصنف</th>
            <th>المخزن</th>
            <th>التغيير</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function attachDashboardEvents() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const categoryId = btn.dataset.categoryId;
      if (categoryId === state.activeCategoryId) return;
      state.activeCategoryId = categoryId;
      state.grades = [];
      render();
      subscribeGrades(categoryId);
    });
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.signOut());
  }

  const activityLogBtn = document.getElementById('activity-log-btn');
  if (activityLogBtn) {
    activityLogBtn.addEventListener('click', () => {
      state.showActivityLog = !state.showActivityLog;
      if (state.showActivityLog) {
        subscribeActivityLog();
      } else if (unsubActivityLog) {
        unsubActivityLog();
        unsubActivityLog = null;
      }
      render();
    });
  }

  document.querySelectorAll('.qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { categoryId, gradeId, field } = btn.dataset;
      const delta = btn.dataset.action === 'inc' ? 1 : -1;
      changeQuantity(categoryId, gradeId, field, delta);
    });
  });

  document.querySelectorAll('.qty-input').forEach((input) => {
    input.addEventListener('change', () => {
      const { categoryId, gradeId, field } = input.dataset;
      const newValue = Math.max(0, Number(input.value) || 0);
      setQuantity(categoryId, gradeId, field, newValue);
    });
  });
}

// ============================================================
// تعديل الكميات + سجل العمليات
// ============================================================
async function changeQuantity(categoryId, gradeId, field, delta) {
  const gradeRef = db.collection('categories').doc(categoryId).collection('grades').doc(gradeId);
  const snap = await gradeRef.get();
  const oldValue = snap.data()[field] || 0;
  const newValue = Math.max(0, oldValue + delta);
  await applyQuantityChange(gradeRef, snap, field, oldValue, newValue);
}

async function setQuantity(categoryId, gradeId, field, newValue) {
  const gradeRef = db.collection('categories').doc(categoryId).collection('grades').doc(gradeId);
  const snap = await gradeRef.get();
  const oldValue = snap.data()[field] || 0;
  if (oldValue === newValue) return;
  await applyQuantityChange(gradeRef, snap, field, oldValue, newValue);
}

async function applyQuantityChange(gradeRef, snap, field, oldValue, newValue) {
  await gradeRef.update({ [field]: newValue });
  await db.collection('activityLog').add({
    action: 'edit',
    categoryId: state.activeCategoryId,
    gradeId: snap.id,
    gradeNumber: snap.data().number,
    itemName: snap.data().itemName || '',
    field,
    oldValue,
    newValue,
    userId: state.user.uid,
    userName: state.profile.name,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

function subscribeActivityLog() {
  if (unsubActivityLog) unsubActivityLog();
  unsubActivityLog = db
    .collection('activityLog')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot((snap) => {
      state.activityLog = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    });
}

// ============================================================
// الاشتراك في بيانات Firebase (تسجيل الدخول + الفئات + الدرجات)
// ============================================================
function init() {
  if (!FIREBASE_IS_CONFIGURED) {
    render();
    return;
  }

  // شبكة أمان: لو الشاشة فضلت عالقة على "جارٍ التحميل" أكتر من 8 ثواني،
  // على الأغلب بيانات Firebase غلط أو المشروع مش شغال، مش بالضرورة خطأ برمجي.
  setTimeout(() => {
    if (state.view === 'loading') {
      document.getElementById('root').innerHTML = `
        <div class="card" style="max-width:480px; margin:60px auto; text-align:center;">
          <h2 style="font-size:16px; margin-bottom:10px;">النظام مستني رد من Firebase من غير نتيجة</h2>
          <p style="font-size:14px; color:var(--text-secondary); line-height:1.7;">
            على الأغلب بيانات <code>firebase-config.js</code> غير صحيحة، أو مشروع
            Firebase نفسه فيه مشكلة (Authentication مش مفعّل مثلًا)، أو مفيش اتصال
            بالإنترنت حاليًا. راجع قسم 2 في README.md.
          </p>
        </div>`;
    }
  }, 8000);

  auth.onAuthStateChanged((user) => {
    state.user = user;

    if (unsubProfile) { unsubProfile(); unsubProfile = null; }
    if (unsubCategories) { unsubCategories(); unsubCategories = null; }
    if (unsubGrades) { unsubGrades(); unsubGrades = null; }
    if (unsubActivityLog) { unsubActivityLog(); unsubActivityLog = null; }

    if (!user) {
      state.profile = null;
      state.categories = [];
      state.grades = [];
      state.activeCategoryId = null;
      state.showActivityLog = false;
      state.activityLog = [];
      state.view = 'login';
      render();
      return;
    }

    state.view = 'loading';
    render();

    unsubProfile = db.collection('users').doc(user.uid).onSnapshot((snap) => {
      state.profile = snap.exists ? snap.data() : null;

      if (!state.profile) {
        state.view = 'no-profile';
        render();
        return;
      }

      state.view = 'dashboard';
      render();
      subscribeCategories();
    });
  });
}

function subscribeCategories() {
  unsubCategories = db
    .collection('categories')
    .orderBy('order')
    .onSnapshot((snap) => {
      state.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!state.activeCategoryId && state.categories.length) {
        state.activeCategoryId = state.categories[0].id;
      }
      render();
      if (state.activeCategoryId) subscribeGrades(state.activeCategoryId);
    });
}

function subscribeGrades(categoryId) {
  if (unsubGrades) unsubGrades();
  unsubGrades = db
    .collection('categories')
    .doc(categoryId)
    .collection('grades')
    .orderBy('number')
    .onSnapshot((snap) => {
      state.grades = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    });
}

document.addEventListener('DOMContentLoaded', init);
