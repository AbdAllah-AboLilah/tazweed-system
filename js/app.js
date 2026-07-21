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
  showAddCategoryForm: false,
  showAddGradeForm: false,
  showEditCategoryInfoForm: false,
  pendingCount: 0,
  resolvingGradeId: null,
  confirmingOutGradeId: null,
  isOnline: navigator.onLine,
  hasPendingWrites: false,
};

let unsubProfile = null;
let unsubCategories = null;
let unsubGrades = null;
let unsubActivityLog = null;
let unsubPendingCount = null;

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
  const canManageCatalog = hasFullAccess(state.profile);

  const tabsHTML = state.categories
    .map(
      (cat) => `
      <button class="tab ${cat.id === state.activeCategoryId ? 'tab-active' : ''}" data-category-id="${escapeHTML(cat.id)}">
        ${escapeHTML(cat.name)}
      </button>`
    )
    .join('');

  const addCategoryTabHTML = canManageCatalog
    ? `<button class="tab" id="add-category-tab-btn">+ فئة جديدة</button>`
    : '';

  const addCategoryFormHTML = state.showAddCategoryForm
    ? `
    <div class="card" style="margin:0 1rem 1rem; padding:1rem;">
      <form id="add-category-form" style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;">
        <div class="field" style="flex:1; min-width:140px; margin-bottom:0;">
          <label>اسم الفئة (التاب)</label>
          <input class="input" id="new-category-name" required />
        </div>
        <div class="field" style="flex:1; min-width:140px; margin-bottom:0;">
          <label>اسم الصنف (زي الكاشير)</label>
          <input class="input" id="new-category-item-name" />
        </div>
        <div class="field" style="flex:1; min-width:140px; margin-bottom:0;">
          <label>الباركود</label>
          <input class="input" id="new-category-barcode" />
        </div>
        <div class="field" style="width:100px; margin-bottom:0;">
          <label>السعر الأصلي</label>
          <input class="input" type="number" id="new-category-original-price" />
        </div>
        <div class="field" style="width:100px; margin-bottom:0;">
          <label>سعر البيع</label>
          <input class="input" type="number" id="new-category-selling-price" />
        </div>
        <button class="btn btn-primary" type="submit">إضافة</button>
        <button class="btn" type="button" id="cancel-add-category">إلغاء</button>
      </form>
    </div>`
    : '';

  let bodyHTML;
  if (state.showActivityLog) {
    bodyHTML = `<div style="padding:1rem;">${activityLogHTML()}</div>`;
  } else if (state.categories.length === 0) {
    bodyHTML = `
      <div style="padding:2rem; text-align:center; color:var(--text-secondary);">
        لا توجد فئات (شيتات) مضافة بعد في قاعدة البيانات.
        ${canManageCatalog ? ' اضغط "+ فئة جديدة" فوق عشان تبدأ.' : ''}
      </div>`;
  } else {
    bodyHTML = `<div style="padding:1rem;">${gradeTableHTML()}</div>`;
  }

  const tabsRowHTML = !state.showActivityLog
    ? `<div class="tabs">${tabsHTML}${addCategoryTabHTML}</div>${addCategoryFormHTML}`
    : '';

  return `
    <div>
      <div class="topbar">
        <div>
          <div style="font-size:14px; font-weight:500;">${escapeHTML(state.profile?.name)}</div>
          <div style="font-size:12px; color:var(--text-secondary);">${escapeHTML(roleLabel)}</div>
        </div>
        <div style="display:flex; align-items:center; gap:16px;">
          ${connectionDotHTML()}
          ${state.pendingCount > 0 ? `<span class="badge badge-purple">${state.pendingCount} طلب تزويد معلّق</span>` : ''}
          <span style="font-size:13px;">
            ${escapeHTML(APP_NAME)}
            <span style="font-size:11px; color:var(--text-muted);">v${escapeHTML(APP_VERSION)}</span>
          </span>
          <button class="btn" id="activity-log-btn">${state.showActivityLog ? 'رجوع للشيتات' : 'سجل العمليات'}</button>
          <button class="btn" id="logout-btn">تسجيل خروج</button>
        </div>
      </div>
      ${tabsRowHTML}
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

function categoryInfoBarHTML() {
  const cat = state.categories.find((c) => c.id === state.activeCategoryId);
  if (!cat) return '';
  const canManageCatalog = hasFullAccess(state.profile);

  if (state.showEditCategoryInfoForm) {
    return `
      <div class="card" style="margin-bottom:0.75rem; padding:1rem;">
        <form id="edit-category-info-form" style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
          <div class="field" style="flex:1; min-width:140px; margin-bottom:0;">
            <label>اسم الصنف (زي الكاشير)</label>
            <input class="input" id="edit-category-item-name" value="${escapeHTML(cat.itemName || '')}" />
          </div>
          <div class="field" style="flex:1; min-width:140px; margin-bottom:0;">
            <label>الباركود</label>
            <input class="input" id="edit-category-barcode" value="${escapeHTML(cat.barcodeNumber || '')}" />
          </div>
          <div class="field" style="width:100px; margin-bottom:0;">
            <label>السعر الأصلي</label>
            <input class="input" type="number" id="edit-category-original-price" value="${escapeHTML(cat.originalPrice || 0)}" />
          </div>
          <div class="field" style="width:100px; margin-bottom:0;">
            <label>سعر البيع</label>
            <input class="input" type="number" id="edit-category-selling-price" value="${escapeHTML(cat.sellingPrice || 0)}" />
          </div>
          <button class="btn btn-primary" type="submit">حفظ</button>
          <button class="btn" type="button" id="cancel-edit-category-info">إلغاء</button>
        </form>
      </div>`;
  }

  return `
    <div style="display:flex; align-items:center; gap:16px; margin-bottom:0.75rem; font-size:13px; color:var(--text-secondary); flex-wrap:wrap;">
      <span>اسم الصنف: <strong style="color:var(--text-primary);">${escapeHTML(cat.itemName || '—')}</strong></span>
      <span>الباركود: <strong style="color:var(--text-primary);">${escapeHTML(cat.barcodeNumber || '—')}</strong></span>
      <span>السعر: <strong style="color:var(--text-primary);">${cat.sellingPrice ? `<s style="color:var(--text-muted);">${escapeHTML(cat.originalPrice || 0)}</s> ${escapeHTML(cat.sellingPrice)}` : '—'}</strong></span>
      ${canManageCatalog ? `<button class="btn" id="edit-category-info-btn" style="padding:3px 10px; font-size:12px;">تعديل</button>` : ''}
      <button class="btn" id="print-label-btn" style="padding:3px 10px; font-size:12px;">🏷️ طباعة ملصق</button>
      <button class="btn" id="print-restock-btn" style="padding:3px 10px; font-size:12px;">🖨️ طباعة ورقة تزويد</button>
    </div>`;
}

function statusCellHTML(g, canEditBranch, canEditMain) {
  const badge = `<span class="badge ${statusBadgeClass(g.status)}">${statusLabel(g.status)}</span>`;

  if (g.status === 'normal') {
    const btn = canEditBranch
      ? `<button class="btn" style="padding:4px 10px; font-size:12px; margin-inline-start:6px;" data-request-shortage-id="${escapeHTML(g.id)}">طلب تزويد</button>`
      : '';
    return `<td>${badge}${btn}</td>`;
  }

  if (g.status === 'pending') {
    if (canEditMain && state.resolvingGradeId === g.id) {
      return `
        <td>
          <form class="fulfill-form" data-fulfill-id="${escapeHTML(g.id)}" style="display:flex; gap:4px; align-items:center;">
            <input class="input" type="number" min="1" style="width:60px; padding:4px;" id="fulfill-qty-${escapeHTML(g.id)}" placeholder="كمية" required />
            <button class="btn btn-primary" type="submit" style="padding:4px 8px; font-size:12px;">تأكيد</button>
            <button class="btn" type="button" data-cancel-resolve-id="${escapeHTML(g.id)}" style="padding:4px 8px; font-size:12px;">رجوع</button>
          </form>
        </td>`;
    }
    if (canEditMain && state.confirmingOutGradeId === g.id) {
      return `
        <td>
          <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
            <span style="font-size:12px;">متأكد إنها خلصت من عندك خالص؟</span>
            <button class="btn" style="padding:4px 8px; font-size:12px; background:var(--danger-bg); color:var(--danger-text);" data-confirm-out-id="${escapeHTML(g.id)}">تأكيد</button>
            <button class="btn" style="padding:4px 8px; font-size:12px;" data-cancel-confirm-out-id="${escapeHTML(g.id)}">رجوع</button>
          </div>
        </td>`;
    }

    let extra = '';
    if (canEditBranch) {
      extra += `<button class="btn" style="padding:4px 10px; font-size:12px; margin-inline-start:6px;" data-cancel-shortage-id="${escapeHTML(g.id)}">إلغاء الطلب</button>`;
    }
    if (canEditMain) {
      extra += `<button class="btn" style="padding:4px 10px; font-size:12px; margin-inline-start:6px;" data-open-fulfill-id="${escapeHTML(g.id)}">تزويد</button>`;
      extra += `<button class="btn" style="padding:4px 10px; font-size:12px; margin-inline-start:6px;" data-open-confirm-out-id="${escapeHTML(g.id)}">مفيش خالص</button>`;
    }
    return `<td>${badge}${extra}</td>`;
  }

  // status === 'out'
  const resetBtn = canEditMain
    ? `<button class="btn" style="padding:4px 10px; font-size:12px; margin-inline-start:6px;" data-reset-out-id="${escapeHTML(g.id)}">رجّعها متاحة</button>`
    : '';
  return `<td>${badge}${resetBtn}</td>`;
}

function gradeTableHTML() {
  const canEditBranch = canEditWarehouse(state.profile, 'branch');
  const canEditMain = canEditWarehouse(state.profile, 'main');
  const canManageCatalog = hasFullAccess(state.profile);

  const infoBarHTML = categoryInfoBarHTML();

  const toolbarHTML = canManageCatalog
    ? `
    <div style="display:flex; gap:8px; margin-bottom:0.75rem;">
      <button class="btn" id="add-grade-btn">+ إضافة درجة</button>
      <button class="btn" id="delete-category-btn">حذف الفئة دي</button>
    </div>`
    : '';

  const addGradeFormHTML = state.showAddGradeForm
    ? `
    <div class="card" style="margin-bottom:0.75rem; padding:1rem;">
      <form id="add-grade-form" style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
        <div class="field" style="margin-bottom:0;"><label>الدرجة (رقم)</label><input class="input" style="width:90px;" type="number" id="new-grade-number" required /></div>
        <div class="field" style="margin-bottom:0;"><label>الفرع</label><input class="input" style="width:70px;" type="number" id="new-grade-branch" value="0" /></div>
        <div class="field" style="margin-bottom:0;"><label>الرئيسي</label><input class="input" style="width:70px;" type="number" id="new-grade-main" value="0" /></div>
        <button class="btn btn-primary" type="submit">إضافة</button>
        <button class="btn" type="button" id="cancel-add-grade">إلغاء</button>
      </form>
    </div>`
    : '';

  if (state.grades.length === 0) {
    return `${infoBarHTML}${toolbarHTML}${addGradeFormHTML}<div style="padding:1rem; color:var(--text-secondary);">لا توجد درجات مضافة في هذه الفئة بعد.</div>`;
  }

  const rows = state.grades
    .map(
      (g) => `
      <tr class="${rowClassForStatus(g.status)}">
        <td>${escapeHTML(g.number)}</td>
        ${qtyCellHTML(state.activeCategoryId, g.id, 'branchQty', g.branchQty, canEditBranch)}
        ${qtyCellHTML(state.activeCategoryId, g.id, 'mainQty', g.mainQty, canEditMain)}
        ${statusCellHTML(g, canEditBranch, canEditMain)}
        ${canManageCatalog ? `<td><button class="btn" style="padding:4px 10px; font-size:12px;" data-delete-grade-id="${escapeHTML(g.id)}" data-delete-grade-number="${escapeHTML(g.number)}">حذف</button></td>` : ''}
      </tr>`
    )
    .join('');

  return `
    ${infoBarHTML}${toolbarHTML}${addGradeFormHTML}
    <div class="card" style="padding:0; overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>الدرجة</th>
            <th>الفرع</th>
            <th>الرئيسي</th>
            <th>الحالة</th>
            ${canManageCatalog ? '<th></th>' : ''}
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
      let itemLabel = '';
      let detailLabel = '';

      if (entry.action === 'edit') {
        const fieldLabel = entry.field === 'branchQty' ? 'مخزن الفرع' : entry.field === 'mainQty' ? 'المخزن الرئيسي' : entry.field || '';
        itemLabel = `${escapeHTML(entry.categoryName || '')} — درجة ${escapeHTML(entry.gradeNumber)}`;
        detailLabel = `${escapeHTML(fieldLabel)}: ${escapeHTML(entry.oldValue)} ← ${escapeHTML(entry.newValue)}`;
      } else if (entry.action === 'add_category') {
        itemLabel = escapeHTML(entry.categoryName || '');
        detailLabel = 'إضافة فئة جديدة';
      } else if (entry.action === 'delete_category') {
        itemLabel = escapeHTML(entry.categoryName || '');
        detailLabel = 'حذف فئة بالكامل';
      } else if (entry.action === 'add_grade') {
        itemLabel = `${escapeHTML(entry.categoryName || '')} — درجة ${escapeHTML(entry.gradeNumber)}`;
        detailLabel = 'إضافة درجة جديدة';
      } else if (entry.action === 'delete_grade') {
        itemLabel = `${escapeHTML(entry.categoryName || '')} — درجة ${escapeHTML(entry.gradeNumber)}`;
        detailLabel = 'حذف درجة';
      } else if (entry.action === 'edit_category_info') {
        itemLabel = escapeHTML(entry.itemName || '');
        detailLabel = `تعديل بيانات الصنف (باركود: ${escapeHTML(entry.barcodeNumber || '—')})`;
      } else if (entry.action === 'request_shortage') {
        itemLabel = `${escapeHTML(entry.categoryName || '')} — درجة ${escapeHTML(entry.gradeNumber)}`;
        detailLabel = 'طلب تزويد (خلصت من الفرع)';
      } else if (entry.action === 'cancel_shortage') {
        itemLabel = `${escapeHTML(entry.categoryName || '')} — درجة ${escapeHTML(entry.gradeNumber)}`;
        detailLabel = 'إلغاء طلب التزويد';
      } else if (entry.action === 'fulfill_shortage') {
        itemLabel = `${escapeHTML(entry.categoryName || '')} — درجة ${escapeHTML(entry.gradeNumber)}`;
        detailLabel = `تزويد بكمية ${escapeHTML(entry.transferredQty)}`;
      } else if (entry.action === 'mark_out_of_stock') {
        itemLabel = `${escapeHTML(entry.categoryName || '')} — درجة ${escapeHTML(entry.gradeNumber)}`;
        detailLabel = 'خلصت نهائيًا من الفرع والرئيسي';
      } else if (entry.action === 'reset_available') {
        itemLabel = `${escapeHTML(entry.categoryName || '')} — درجة ${escapeHTML(entry.gradeNumber)}`;
        detailLabel = 'رجّعت متاحة (وصل تزويد جديد)';
      }

      return `
        <tr>
          <td>${escapeHTML(when)}</td>
          <td>${escapeHTML(entry.userName)}</td>
          <td>${itemLabel}</td>
          <td>${detailLabel}</td>
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
            <th>الصنف/الفئة</th>
            <th>العملية</th>
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
      state.showAddGradeForm = false;
      state.showEditCategoryInfoForm = false;
      state.resolvingGradeId = null;
      state.confirmingOutGradeId = null;
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

  const addCategoryTabBtn = document.getElementById('add-category-tab-btn');
  if (addCategoryTabBtn) {
    addCategoryTabBtn.addEventListener('click', () => {
      state.showAddCategoryForm = !state.showAddCategoryForm;
      render();
    });
  }

  const addCategoryForm = document.getElementById('add-category-form');
  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-category-name').value.trim();
      const itemName = document.getElementById('new-category-item-name').value.trim();
      const barcodeNumber = document.getElementById('new-category-barcode').value.trim();
      const originalPrice = Number(document.getElementById('new-category-original-price').value) || 0;
      const sellingPrice = Number(document.getElementById('new-category-selling-price').value) || 0;
      if (!name) return;
      await addCategory(name, itemName, barcodeNumber, originalPrice, sellingPrice);
      state.showAddCategoryForm = false;
      render();
    });
  }

  const cancelAddCategory = document.getElementById('cancel-add-category');
  if (cancelAddCategory) {
    cancelAddCategory.addEventListener('click', () => {
      state.showAddCategoryForm = false;
      render();
    });
  }

  const addGradeBtn = document.getElementById('add-grade-btn');
  if (addGradeBtn) {
    addGradeBtn.addEventListener('click', () => {
      state.showAddGradeForm = !state.showAddGradeForm;
      render();
    });
  }

  const addGradeForm = document.getElementById('add-grade-form');
  if (addGradeForm) {
    addGradeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const number = Number(document.getElementById('new-grade-number').value);
      if (!number) return;
      const branchQty = Number(document.getElementById('new-grade-branch').value) || 0;
      const mainQty = Number(document.getElementById('new-grade-main').value) || 0;
      await addGrade(state.activeCategoryId, { number, branchQty, mainQty });
      state.showAddGradeForm = false;
      render();
    });
  }

  const cancelAddGrade = document.getElementById('cancel-add-grade');
  if (cancelAddGrade) {
    cancelAddGrade.addEventListener('click', () => {
      state.showAddGradeForm = false;
      render();
    });
  }

  const editCategoryInfoBtn = document.getElementById('edit-category-info-btn');
  if (editCategoryInfoBtn) {
    editCategoryInfoBtn.addEventListener('click', () => {
      state.showEditCategoryInfoForm = true;
      render();
    });
  }

  const printLabelBtn = document.getElementById('print-label-btn');
  if (printLabelBtn) {
    printLabelBtn.addEventListener('click', () => {
      const cat = state.categories.find((c) => c.id === state.activeCategoryId);
      if (cat) printLabel(cat);
    });
  }

  const printRestockBtn = document.getElementById('print-restock-btn');
  if (printRestockBtn) {
    printRestockBtn.addEventListener('click', () => {
      const cat = state.categories.find((c) => c.id === state.activeCategoryId);
      if (cat) printRestockPaper(cat, state.grades);
    });
  }

  const editCategoryInfoForm = document.getElementById('edit-category-info-form');
  if (editCategoryInfoForm) {
    editCategoryInfoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const itemName = document.getElementById('edit-category-item-name').value.trim();
      const barcodeNumber = document.getElementById('edit-category-barcode').value.trim();
      const originalPrice = Number(document.getElementById('edit-category-original-price').value) || 0;
      const sellingPrice = Number(document.getElementById('edit-category-selling-price').value) || 0;
      await updateCategoryInfo(state.activeCategoryId, itemName, barcodeNumber, originalPrice, sellingPrice);
      state.showEditCategoryInfoForm = false;
      render();
    });
  }

  const cancelEditCategoryInfo = document.getElementById('cancel-edit-category-info');
  if (cancelEditCategoryInfo) {
    cancelEditCategoryInfo.addEventListener('click', () => {
      state.showEditCategoryInfoForm = false;
      render();
    });
  }

  const deleteCategoryBtn = document.getElementById('delete-category-btn');
  if (deleteCategoryBtn) {
    deleteCategoryBtn.addEventListener('click', async () => {
      const cat = state.categories.find((c) => c.id === state.activeCategoryId);
      if (!cat) return;
      if (!confirm(`متأكد إنك عايز تمسح فئة "${cat.name}" بكل درجاتها؟ الخطوة دي مش هترجع.`)) return;
      await deleteCategory(cat.id, cat.name);
    });
  }

  document.querySelectorAll('[data-delete-grade-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const gradeId = btn.dataset.deleteGradeId;
      const gradeNumber = btn.dataset.deleteGradeNumber;
      if (!confirm(`متأكد إنك عايز تمسح الدرجة رقم ${gradeNumber}؟`)) return;
      await deleteGrade(state.activeCategoryId, gradeId, gradeNumber);
    });
  });

  // -------- نظام النواقص --------
  document.querySelectorAll('[data-request-shortage-id]').forEach((btn) => {
    btn.addEventListener('click', () => requestShortage(btn.dataset.requestShortageId));
  });

  document.querySelectorAll('[data-cancel-shortage-id]').forEach((btn) => {
    btn.addEventListener('click', () => cancelShortage(btn.dataset.cancelShortageId));
  });

  document.querySelectorAll('[data-open-fulfill-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.resolvingGradeId = btn.dataset.openFulfillId;
      state.confirmingOutGradeId = null;
      render();
    });
  });

  document.querySelectorAll('[data-cancel-resolve-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.resolvingGradeId = null;
      render();
    });
  });

  document.querySelectorAll('.fulfill-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const gradeId = form.dataset.fulfillId;
      const qty = Number(document.getElementById(`fulfill-qty-${gradeId}`).value);
      if (!qty || qty <= 0) return;
      await fulfillShortage(gradeId, qty);
      state.resolvingGradeId = null;
      render();
    });
  });

  document.querySelectorAll('[data-open-confirm-out-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.confirmingOutGradeId = btn.dataset.openConfirmOutId;
      state.resolvingGradeId = null;
      render();
    });
  });

  document.querySelectorAll('[data-cancel-confirm-out-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.confirmingOutGradeId = null;
      render();
    });
  });

  document.querySelectorAll('[data-confirm-out-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const gradeId = btn.dataset.confirmOutId;
      await markOutOfStock(gradeId);
      state.confirmingOutGradeId = null;
      render();
    });
  });

  document.querySelectorAll('[data-reset-out-id]').forEach((btn) => {
    btn.addEventListener('click', () => resetOutOfStock(btn.dataset.resetOutId));
  });
}

// ============================================================
// إدارة الفئات والدرجات (إضافة/حذف)
// ============================================================
async function addCategory(name, itemName, barcodeNumber, originalPrice, sellingPrice) {
  const nextOrder = state.categories.reduce((max, c) => Math.max(max, c.order || 0), 0) + 1;
  const ref = await db.collection('categories').add({
    name,
    order: nextOrder,
    itemName: itemName || '',
    barcodeNumber: barcodeNumber || '',
    originalPrice: originalPrice || 0,
    sellingPrice: sellingPrice || 0,
  });
  await logActivity({ action: 'add_category', categoryId: ref.id, categoryName: name });
  state.activeCategoryId = ref.id;
}

async function deleteCategory(categoryId, categoryName) {
  const gradesSnap = await db.collection('categories').doc(categoryId).collection('grades').get();
  await Promise.all(gradesSnap.docs.map((d) => d.ref.delete()));
  await db.collection('categories').doc(categoryId).delete();
  await logActivity({ action: 'delete_category', categoryId, categoryName });
  if (state.activeCategoryId === categoryId) {
    state.activeCategoryId = null;
    state.grades = [];
  }
}

async function addGrade(categoryId, data) {
  const ref = await db.collection('categories').doc(categoryId).collection('grades').add({
    number: data.number,
    branchQty: data.branchQty || 0,
    mainQty: data.mainQty || 0,
    status: 'normal',
  });
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  await logActivity({
    action: 'add_grade',
    categoryId,
    categoryName,
    gradeId: ref.id,
    gradeNumber: data.number,
  });
}

async function updateCategoryInfo(categoryId, itemName, barcodeNumber, originalPrice, sellingPrice) {
  await db.collection('categories').doc(categoryId).update({
    itemName: itemName || '',
    barcodeNumber: barcodeNumber || '',
    originalPrice: originalPrice || 0,
    sellingPrice: sellingPrice || 0,
  });
  await logActivity({ action: 'edit_category_info', categoryId, itemName, barcodeNumber });
}

// ============================================================
// الطباعة: ملصق الباركود (QR) وورقة التزويد
// ============================================================
function printLabel(cat) {
  const win = window.open('', '_blank', 'width=420,height=520');
  if (!win) {
    alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return;
  }

  const priceHTML = cat.sellingPrice
    ? `<div class="prices"><s>${escapeHTML(cat.originalPrice || 0)} ج.م</s>&nbsp;&nbsp;<strong>${escapeHTML(cat.sellingPrice)} ج.م</strong></div>`
    : '';

  win.document.write(`
    <!doctype html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>ملصق - ${escapeHTML(cat.itemName || cat.name)}</title>
      <style>
        @page { size: 50mm 30mm; margin: 2mm; }
        body { font-family: Tahoma, Arial, sans-serif; text-align: center; padding: 20px; }
        .label { width: 220px; border: 1px solid #000; border-radius: 6px; padding: 12px; margin: 0 auto; }
        #qr { display: flex; justify-content: center; margin-bottom: 8px; }
        .item-name { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
        .barcode-number { font-size: 12px; letter-spacing: 1px; margin-bottom: 6px; }
        .prices { font-size: 13px; }
        .prices s { color: #777; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="label">
        <div id="qr"></div>
        <div class="item-name">${escapeHTML(cat.itemName || cat.name)}</div>
        <div class="barcode-number">${escapeHTML(cat.barcodeNumber || '')}</div>
        ${priceHTML}
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
      <script>
        new QRCode(document.getElementById('qr'), {
          text: ${JSON.stringify(cat.barcodeNumber || cat.name)},
          width: 120,
          height: 120,
        });
        window.onload = function () { setTimeout(function () { window.print(); }, 300); };
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
}

function printRestockPaper(cat, grades) {
  const win = window.open('', '_blank', 'width=700,height=800');
  if (!win) {
    alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return;
  }

  const now = new Date().toLocaleString('ar-EG');
  const rowsHTML = grades
    .map(
      (g) => `
      <div class="row ${g.status === 'out' ? 'out' : ''}">
        <span class="num">${escapeHTML(g.number)}</span>
        <span class="blank"></span>
      </div>`
    )
    .join('');

  win.document.write(`
    <!doctype html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>ورقة تزويد - ${escapeHTML(cat.itemName || cat.name)}</title>
      <style>
        @page { size: 80mm auto; margin: 3mm; }
        body { font-family: Tahoma, Arial, sans-serif; font-size: 10px; padding: 0; width: 74mm; }
        .header { text-align: center; margin-bottom: 6px; }
        .header .name { font-weight: bold; font-size: 13px; }
        .header .time { font-size: 9px; color: #555; }
        .grid { column-count: 4; column-gap: 2mm; }
        .row {
          display: flex; justify-content: space-between; align-items: center;
          border: 1px solid #000; padding: 1px 2px; margin-bottom: -1px;
          break-inside: avoid;
        }
        .row .num { font-weight: bold; }
        .row .blank { width: 9mm; border-inline-start: 1px solid #000; }
        .row.out {
          background-image: repeating-linear-gradient(45deg, #999, #999 2px, #fff 2px, #fff 6px);
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="name">${escapeHTML(cat.itemName || cat.name)}</div>
        <div class="time">${escapeHTML(now)}</div>
      </div>
      <div class="grid">${rowsHTML}</div>
      <script>
        window.onload = function () { setTimeout(function () { window.print(); }, 300); };
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
}

// ============================================================
// نظام النواقص: طلب تزويد → رد أمين المخزن الرئيسي
// ============================================================
async function requestShortage(gradeId) {
  const gradeRef = db.collection('categories').doc(state.activeCategoryId).collection('grades').doc(gradeId);
  const snap = await gradeRef.get();
  await gradeRef.update({ status: 'pending' });
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  await logActivity({
    action: 'request_shortage',
    categoryId: state.activeCategoryId,
    categoryName,
    gradeId,
    gradeNumber: snap.data().number,
  });
}

async function cancelShortage(gradeId) {
  const gradeRef = db.collection('categories').doc(state.activeCategoryId).collection('grades').doc(gradeId);
  const snap = await gradeRef.get();
  await gradeRef.update({ status: 'normal' });
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  await logActivity({
    action: 'cancel_shortage',
    categoryId: state.activeCategoryId,
    categoryName,
    gradeId,
    gradeNumber: snap.data().number,
  });
}

async function fulfillShortage(gradeId, qty) {
  const gradeRef = db.collection('categories').doc(state.activeCategoryId).collection('grades').doc(gradeId);
  const snap = await gradeRef.get();
  const data = snap.data();
  const transferQty = Math.min(qty, data.mainQty || 0);
  const newMainQty = Math.max(0, (data.mainQty || 0) - transferQty);
  const newBranchQty = (data.branchQty || 0) + transferQty;
  await gradeRef.update({ status: 'normal', mainQty: newMainQty, branchQty: newBranchQty });
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  await logActivity({
    action: 'fulfill_shortage',
    categoryId: state.activeCategoryId,
    categoryName,
    gradeId,
    gradeNumber: data.number,
    transferredQty: transferQty,
  });
}

async function markOutOfStock(gradeId) {
  const gradeRef = db.collection('categories').doc(state.activeCategoryId).collection('grades').doc(gradeId);
  const snap = await gradeRef.get();
  await gradeRef.update({ status: 'out' });
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  await logActivity({
    action: 'mark_out_of_stock',
    categoryId: state.activeCategoryId,
    categoryName,
    gradeId,
    gradeNumber: snap.data().number,
  });
}

async function resetOutOfStock(gradeId) {
  const gradeRef = db.collection('categories').doc(state.activeCategoryId).collection('grades').doc(gradeId);
  const snap = await gradeRef.get();
  await gradeRef.update({ status: 'normal' });
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  await logActivity({
    action: 'reset_available',
    categoryId: state.activeCategoryId,
    categoryName,
    gradeId,
    gradeNumber: snap.data().number,
  });
}

async function deleteGrade(categoryId, gradeId, gradeNumber) {
  await db.collection('categories').doc(categoryId).collection('grades').doc(gradeId).delete();
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  await logActivity({ action: 'delete_grade', categoryId, categoryName, gradeId, gradeNumber });
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

function logActivity(details) {
  return db.collection('activityLog').add({
    ...details,
    userId: state.user.uid,
    userName: state.profile.name,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function applyQuantityChange(gradeRef, snap, field, oldValue, newValue) {
  await gradeRef.update({ [field]: newValue });
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  await logActivity({
    action: 'edit',
    categoryId: state.activeCategoryId,
    categoryName,
    gradeId: snap.id,
    gradeNumber: snap.data().number,
    field,
    oldValue,
    newValue,
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
    if (unsubPendingCount) { unsubPendingCount(); unsubPendingCount = null; }

    if (!user) {
      state.profile = null;
      state.categories = [];
      state.grades = [];
      state.activeCategoryId = null;
      state.showActivityLog = false;
      state.activityLog = [];
      state.showAddCategoryForm = false;
      state.showAddGradeForm = false;
      state.showEditCategoryInfoForm = false;
      state.pendingCount = 0;
      state.resolvingGradeId = null;
      state.confirmingOutGradeId = null;
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
      if (canEditWarehouse(state.profile, 'main')) {
        subscribePendingCount();
      }
    });
  });
}

function subscribePendingCount() {
  if (unsubPendingCount) unsubPendingCount();
  unsubPendingCount = db
    .collectionGroup('grades')
    .where('status', '==', 'pending')
    .onSnapshot((snap) => {
      state.pendingCount = snap.size;
      render();
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
    .onSnapshot({ includeMetadataChanges: true }, (snap) => {
      state.grades = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      state.hasPendingWrites = snap.metadata.hasPendingWrites;
      render();
    });
}

// ============================================================
// مؤشر حالة الاتصال (أخضر/أحمر/أصفر)
// ============================================================
window.addEventListener('online', () => {
  state.isOnline = true;
  render();
});
window.addEventListener('offline', () => {
  state.isOnline = false;
  render();
});

function connectionDotHTML() {
  let colorVar, label;
  if (!state.isOnline) {
    colorVar = 'var(--danger-text)';
    label = 'غير متصل بالإنترنت';
  } else if (state.hasPendingWrites) {
    colorVar = '#b8860b';
    label = 'جارٍ رفع البيانات...';
  } else {
    colorVar = '#2e7d32';
    label = 'متصل';
  }
  return `
    <span title="${escapeHTML(label)}" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--text-secondary);">
      <span style="width:9px; height:9px; border-radius:50%; background:${colorVar}; display:inline-block;"></span>
      ${escapeHTML(label)}
    </span>`;
}

document.addEventListener('DOMContentLoaded', init);
