// نظام التزويد — منطق الواجهة (JavaScript عادي بالكامل، بدون أي إطار عمل)

// ============================================================
// الحالة العامة للتطبيق
// ============================================================
// لازم يساوي نفس الرقم في styles.css (@media max-width) عشان الجدول
// والكارتس ما يظهروش مع بعض أو يختفوا الاتنين.
const NARROW_BREAKPOINT = 640;

const state = {
  view: 'loading', // loading | not-configured | login | no-profile | dashboard
  user: null,
  profile: null,
  categories: [],
  activeCategoryId: null,
  grades: [],
  loginError: '',
  loginBusy: false,
  // الشاشة الحالية: home = لوحة التحكم، sheets = الشيتات، activity = السجل
  screen: 'home',
  activityLog: [],
  pendingByCategory: {}, // { categoryId: [أرقام الدرجات المعلّقة] }
  outByCategory: {}, // { categoryId: [أرقام الدرجات اللي خلصت] }
  outCount: 0,
  lowStockByCategory: {}, // { categoryId: [درجات وصلت الحد الأدنى] }
  lowStockCount: 0,
  presence: [], // المستخدمين وآخر ظهور لكل واحد
  stockTotals: null, // { branch, main, grades, at } — بيتحسب بالطلب بس
  showAddCategoryForm: false,
  showAddGradeForm: false,
  showEditCategoryInfoForm: false,
  pendingCount: 0,
  resolvingGradeId: null,
  confirmingOutGradeId: null,
  isOnline: navigator.onLine,
  hasPendingWrites: false,
  bulkRequestMode: false,
  printStations: [], // الأجهزة المسجّلة كنقاط طباعة (اللي عليها QZ Tray وطابعة)
  users: [], // حسابات المستخدمين (بتتحمّل بس وقت فتح شاشة الحسابات)
  canInstallApp: false, // المتصفح عرض إنه يثبّت النظام كأيقونة
  gradeLabelMode: false, // وضع اختيار درجات لطباعة ملصقاتها
  gradeLabelQty: {}, // { gradeId: عدد الملصقات المطلوبة }
  isNarrow: window.innerWidth <= NARROW_BREAKPOINT, // موبايل؟ (كارتس بدل جدول)
};

// بنعيد الرسم بس لما الشاشة تعدّي الحد فعليًا (مش مع كل بكسل أثناء تغيير
// حجم النافذة) — عشان الكتابة في خانة ماتضيعش من تحت إيد المستخدم.
window.addEventListener('resize', () => {
  const narrow = window.innerWidth <= NARROW_BREAKPOINT;
  if (narrow !== state.isNarrow) {
    state.isNarrow = narrow;
    render();
  }
});

// ============================================================
// تثبيت النظام كأيقونة على الشاشة الرئيسية (PWA)
// ============================================================
// المتصفح بيقرر لوحده إمتى التطبيق "يستاهل" التثبيت، وبيبعت الحدث ده.
// بنمسك الحدث ونأجّله، ونوري زرار "تثبيت التطبيق" في شريط الأعلى بدل ما
// نستنى المستخدم يلاقي الخيار مدفون في قايمة المتصفح.
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  state.canInstallApp = true;
  if (state.view === 'dashboard') render();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  state.canInstallApp = false;
  if (state.view === 'dashboard') render();
});

async function promptAppInstall() {
  if (!deferredInstallPrompt) {
    alert(
      'التثبيت مش متاح دلوقتي.\n\n' +
        'على أندرويد: افتح قايمة Chrome (⋮) واختار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".\n' +
        'على آيفون: من Safari، زرار المشاركة ← "إضافة إلى الشاشة الرئيسية".'
    );
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  state.canInstallApp = false;
  render();
}

// بيمنع إعادة بناء الاشتراكات مع كل تغيير في مستند الحساب — شوف الشرح
// المفصّل جوه init() عند sessionStarted.
let sessionStarted = false;

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
        <div class="field" style="width:110px; margin-bottom:0;">
          <label>الحد الأدنى</label>
          <input class="input" type="number" id="new-category-min-qty" min="0" placeholder="0 = مقفول" />
        </div>
        <button class="btn btn-primary" type="submit">إضافة</button>
        <button class="btn" type="button" id="cancel-add-category">إلغاء</button>
      </form>
    </div>`
    : '';

  let bodyHTML;
  if (state.screen === 'home') {
    bodyHTML = dashboardHomeHTML();
  } else if (state.screen === 'activity') {
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

  const homeTabHTML = `<button class="tab ${state.screen === 'home' ? 'tab-active' : ''}" id="home-tab-btn" title="لوحة التحكم">🏠</button>`;

  const tabsRowHTML =
    state.screen !== 'activity'
      ? `<div class="tabs">${homeTabHTML}${tabsHTML}${addCategoryTabHTML}</div>${state.screen === 'sheets' ? addCategoryFormHTML : ''}`
      : '';

  return `
    <div>
      <div class="topbar">
        <div>
          <div style="font-size:14px; font-weight:500;">${escapeHTML(state.profile?.name)}</div>
          <div style="font-size:12px; color:var(--text-secondary);">${escapeHTML(roleLabel)}</div>
        </div>
        <div class="topbar-meta">
          ${connectionDotHTML()}
          ${state.pendingCount > 0 ? `<span class="badge badge-purple">${state.pendingCount} طلب معلّق</span>` : ''}
          <span>
            ${escapeHTML(APP_NAME)}
            <span style="color:var(--text-muted);">v${escapeHTML(APP_VERSION)}</span>
          </span>
          <button class="btn menu-toggle" id="menu-toggle-btn" title="القائمة" aria-label="القائمة">☰</button>
          <div class="menu-panel" id="menu-panel">
            ${isBarcodeScanSupported() ? `<button class="btn" id="scan-barcode-btn">📷 مسح باركود</button>` : ''}
            ${canManageCatalog ? `<button class="btn" id="import-btn">📥 استيراد من إكسل</button>` : ''}
            <button class="btn" id="export-btn">📤 تصدير نسخة احتياطية</button>
            ${canManageUsers(state.profile) ? `<button class="btn" id="users-btn">👥 الحسابات</button>` : ''}
            ${state.canInstallApp ? `<button class="btn" id="install-app-btn">⬇️ تثبيت التطبيق</button>` : ''}
            <button class="btn" id="activity-log-btn">${state.screen === 'activity' ? '📋 رجوع' : '📋 سجل العمليات'}</button>
            <button class="btn" id="logout-btn">🚪 تسجيل خروج</button>
          </div>
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
          <div class="field" style="width:120px; margin-bottom:0;">
            <label>الحد الأدنى للتنبيه</label>
            <input class="input" type="number" id="edit-category-min-qty" min="0" value="${escapeHTML(cat.minQty || 0)}" />
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">0 = من غير تنبيه</div>
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
      <button class="btn" id="printer-settings-btn" style="padding:3px 10px; font-size:12px;" title="إعدادات طابعات هذا الجهاز">⚙️ إعدادات الطابعة</button>
    </div>`;
}

// محتوى عمود الحالة من غير <td> — عشان نقدر نستخدمه في الجدول (كمبيوتر)
// وفي الكارت (موبايل) من غير ما نكرر المنطق.
function statusContentHTML(g, canEditBranch, canEditMain) {
  const badge = `<span class="badge ${statusBadgeClass(g.status)}">${statusLabel(g.status)}</span>`;
  const smallBtn = 'padding:4px 10px; font-size:12px; margin-inline-start:6px;';

  if (g.status === 'normal') {
    const btn = canEditBranch
      ? `<button class="btn" style="${smallBtn}" data-request-shortage-id="${escapeHTML(g.id)}">طلب تزويد</button>`
      : '';
    return `${badge}${btn}`;
  }

  if (g.status === 'pending') {
    if (canEditMain && state.resolvingGradeId === g.id) {
      return `
        <form class="fulfill-form" data-fulfill-id="${escapeHTML(g.id)}" style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
          <input class="input" type="number" min="1" style="width:60px; padding:4px;" id="fulfill-qty-${escapeHTML(g.id)}" placeholder="كمية" required />
          <button class="btn btn-primary" type="submit" style="padding:4px 8px; font-size:12px;">تأكيد</button>
          <button class="btn" type="button" data-cancel-resolve-id="${escapeHTML(g.id)}" style="padding:4px 8px; font-size:12px;">رجوع</button>
        </form>`;
    }
    if (canEditMain && state.confirmingOutGradeId === g.id) {
      return `
        <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
          <span style="font-size:12px;">متأكد إنها خلصت من عندك خالص؟</span>
          <button class="btn" style="padding:4px 8px; font-size:12px; background:var(--danger-bg); color:var(--danger-text);" data-confirm-out-id="${escapeHTML(g.id)}">تأكيد</button>
          <button class="btn" style="padding:4px 8px; font-size:12px;" data-cancel-confirm-out-id="${escapeHTML(g.id)}">رجوع</button>
        </div>`;
    }

    let extra = '';
    if (canEditBranch) {
      extra += `<button class="btn" style="${smallBtn}" data-cancel-shortage-id="${escapeHTML(g.id)}">إلغاء الطلب</button>`;
    }
    if (canEditMain) {
      extra += `<button class="btn" style="${smallBtn}" data-open-fulfill-id="${escapeHTML(g.id)}">تزويد</button>`;
      extra += `<button class="btn" style="${smallBtn}" data-open-confirm-out-id="${escapeHTML(g.id)}">مفيش خالص</button>`;
    }
    return `${badge}${extra}`;
  }

  // status === 'out'
  const resetBtn = canEditMain
    ? `<button class="btn" style="${smallBtn}" data-reset-out-id="${escapeHTML(g.id)}">رجّعها متاحة</button>`
    : '';
  return `${badge}${resetBtn}`;
}

function statusCellHTML(g, canEditBranch, canEditMain) {
  return `<td>${statusContentHTML(g, canEditBranch, canEditMain)}</td>`;
}

// أزرار الكمية من غير <td> — نفس السبب اللي فوق.
function qtyControlsHTML(categoryId, gradeId, field, value, canEdit) {
  if (!canEdit) return `<span class="qty-readonly">${escapeHTML(value ?? 0)}</span>`;
  const attrs = `data-category-id="${escapeHTML(categoryId)}" data-grade-id="${escapeHTML(gradeId)}" data-field="${field}"`;
  return `
    <div class="qty-cell">
      <button class="qty-btn" data-action="dec" ${attrs}>−</button>
      <input class="qty-input" type="number" value="${escapeHTML(value ?? 0)}" ${attrs} />
      <button class="qty-btn" data-action="inc" ${attrs}>+</button>
    </div>`;
}

// ------------------------------------------------------------
// عرض الدرجات على الموبايل: كارت لكل درجة بدل صف جدول
// ------------------------------------------------------------
// السبب: خمس أعمدة بمساحات لمس محترمة مش بيدخلوا في عرض 360px — الجدول
// بيطلع 425px ويحتاج سحب أفقي، وعمود الحالة (أهم عمود في الشغل) بيختفي
// بره الشاشة. الكارت بيحل ده: كل حاجة تحت بعضها، مفيش أي سحب.
function gradeCardsHTML(canEditBranch, canEditMain, canManageCatalog) {
  return `
    <div class="grade-cards">
      ${state.grades
        .map((g) => {
          const middle = state.gradeLabelMode
            ? `
            <div class="gc-line">
              <span class="gc-label">اطبع كام؟</span>
              <span style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" class="grade-label-check" data-grade-label-id="${escapeHTML(g.id)}"
                       ${(state.gradeLabelQty || {})[g.id] > 0 ? 'checked' : ''} />
                <input type="number" class="input grade-label-qty" data-grade-qty-id="${escapeHTML(g.id)}"
                       value="${(state.gradeLabelQty || {})[g.id] || ''}" min="0" max="200" placeholder="عدد"
                       inputmode="numeric" style="width:72px; padding:6px;" />
              </span>
            </div>`
            : state.bulkRequestMode
              ? `
            <div class="gc-line">
              <span class="gc-label">طلب تزويد</span>
              ${
                g.status === 'out'
                  ? `<span class="badge badge-out">خلصت نهائيًا</span>`
                  : `<input type="checkbox" class="bulk-request-checkbox" data-bulk-toggle-id="${escapeHTML(g.id)}"
                       ${g.status === 'pending' ? 'checked' : ''} ${canEditBranch ? '' : 'disabled'} />`
              }
            </div>`
              : `<div class="gc-status">${statusContentHTML(g, canEditBranch, canEditMain)}</div>`;

          return `
          <div class="grade-card ${rowClassForStatus(g.status)}">
            <div class="gc-head">
              <span class="gc-num">درجة ${escapeHTML(g.number)}</span>
              ${
                canManageCatalog
                  ? `<button class="btn gc-del" data-delete-grade-id="${escapeHTML(g.id)}" data-delete-grade-number="${escapeHTML(g.number)}">حذف</button>`
                  : ''
              }
            </div>
            <div class="gc-line">
              <span class="gc-label">الفرع</span>
              ${qtyControlsHTML(state.activeCategoryId, g.id, 'branchQty', g.branchQty, canEditBranch)}
            </div>
            <div class="gc-line">
              <span class="gc-label">الرئيسي</span>
              ${qtyControlsHTML(state.activeCategoryId, g.id, 'mainQty', g.mainQty, canEditMain)}
            </div>
            ${middle}
          </div>`;
        })
        .join('')}
    </div>`;
}

function gradeTableHTML() {
  const canEditBranch = canEditWarehouse(state.profile, 'branch');
  const canEditMain = canEditWarehouse(state.profile, 'main');
  const canManageCatalog = hasFullAccess(state.profile);

  const infoBarHTML = categoryInfoBarHTML();

  const bulkToggleBtn = canEditBranch
    ? `<button class="btn ${state.bulkRequestMode ? 'btn-primary' : ''}" id="toggle-bulk-request-btn">${state.bulkRequestMode ? '✔️ تم' : '📋 طلب تزويد'}</button>`
    : '';

  const labelModeBtn = `<button class="btn ${state.gradeLabelMode ? 'btn-primary' : ''}" id="toggle-grade-label-btn">${
    state.gradeLabelMode ? '✔️ تم' : '🏷️ طباعة ملصقات درجات'
  }</button>`;

  const toolbarHTML = `
    <div style="display:flex; gap:8px; margin-bottom:0.75rem; flex-wrap:wrap;">
      ${bulkToggleBtn}
      ${labelModeBtn}
      ${canManageCatalog ? `<button class="btn" id="add-grade-btn">+ إضافة درجة</button>` : ''}
      ${canManageCatalog ? `<button class="btn" id="add-grade-range-btn">+ إضافة درجات دفعة</button>` : ''}
      ${canManageCatalog ? `<button class="btn" id="delete-category-btn">حذف الفئة دي</button>` : ''}
    </div>`;

  // شريط ملخّص بيفضل ظاهر وانت بتعلّم على الدرجات، عشان تعرف انت اخترت
  // كام وبتطبع كام من غير ما تعد بنفسك.
  const selected = Object.entries(state.gradeLabelQty || {}).filter(([, n]) => n > 0);
  const totalLabels = selected.reduce((s, [, n]) => s + n, 0);
  const labelBarHTML = state.gradeLabelMode
    ? `
    <div class="card" style="margin-bottom:0.75rem; padding:0.75rem; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <span style="font-size:13px;">
        محدّد <strong>${selected.length}</strong> درجة —
        إجمالي <strong>${totalLabels}</strong> ملصق
      </span>
      <button class="btn btn-primary" id="print-grade-labels-btn" ${totalLabels ? '' : 'disabled'}>🏷️ اطبع المحدّد</button>
      <button class="btn" id="clear-grade-labels-btn">مسح التحديد</button>
      <span style="font-size:11px; color:var(--text-secondary);">
        الملصق نص بس: ${escapeHTML((state.categories.find((c) => c.id === state.activeCategoryId) || {}).name || '')} + رقم الدرجة
      </span>
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

  const statusColumnHTML = (g) => {
    if (state.gradeLabelMode) {
      const qty = (state.gradeLabelQty || {})[g.id] || 0;
      return `
        <td style="text-align:center; white-space:nowrap;">
          <input type="checkbox" class="grade-label-check" data-grade-label-id="${escapeHTML(g.id)}"
                 ${qty > 0 ? 'checked' : ''} style="width:18px; height:18px; vertical-align:middle;" />
          <input type="number" class="input grade-label-qty" data-grade-qty-id="${escapeHTML(g.id)}"
                 value="${qty || ''}" min="0" max="200" placeholder="عدد" inputmode="numeric"
                 style="width:62px; display:inline-block; margin-inline-start:6px; padding:3px 6px; font-size:12px;" />
        </td>`;
    }
    if (!state.bulkRequestMode) return statusCellHTML(g, canEditBranch, canEditMain);
    if (g.status === 'out') {
      return `<td><span class="badge badge-out">خلصت نهائيًا</span></td>`;
    }
    const checked = g.status === 'pending' ? 'checked' : '';
    const disabled = canEditBranch ? '' : 'disabled';
    return `
      <td style="text-align:center;">
        <input type="checkbox" class="bulk-request-checkbox" data-bulk-toggle-id="${escapeHTML(g.id)}" ${checked} ${disabled} style="width:18px; height:18px;" />
      </td>`;
  };

  const rows = state.grades
    .map(
      (g) => `
      <tr class="${rowClassForStatus(g.status)}">
        <td>${escapeHTML(g.number)}</td>
        ${qtyCellHTML(state.activeCategoryId, g.id, 'branchQty', g.branchQty, canEditBranch)}
        ${qtyCellHTML(state.activeCategoryId, g.id, 'mainQty', g.mainQty, canEditMain)}
        ${statusColumnHTML(g)}
        ${canManageCatalog ? `<td><button class="btn" style="padding:4px 10px; font-size:12px;" data-delete-grade-id="${escapeHTML(g.id)}" data-delete-grade-number="${escapeHTML(g.number)}">حذف</button></td>` : ''}
      </tr>`
    )
    .join('');

  // على الموبايل بنرسم كارتس بدل الجدول (مش الاتنين) — عشان منضاعفش
  // عدد العناصر في الصفحة لما الفئة يكون فيها مئات الدرجات.
  if (state.isNarrow) {
    return `${infoBarHTML}${toolbarHTML}${labelBarHTML}${addGradeFormHTML}${gradeCardsHTML(canEditBranch, canEditMain, canManageCatalog)}`;
  }

  return `
    ${infoBarHTML}${toolbarHTML}${labelBarHTML}${addGradeFormHTML}
    <div class="card" style="padding:0; overflow:auto; max-height:70vh;">
      <table>
        <thead>
          <tr>
            <th class="sticky-th">الدرجة</th>
            <th class="sticky-th">الفرع</th>
            <th class="sticky-th">الرئيسي</th>
            <th class="sticky-th">${state.gradeLabelMode ? 'اطبع كام؟' : state.bulkRequestMode ? 'طلب تزويد' : 'الحالة'}</th>
            ${canManageCatalog ? '<th class="sticky-th"></th>' : ''}
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
  const homeTabBtn = document.getElementById('home-tab-btn');
  if (homeTabBtn) {
    homeTabBtn.addEventListener('click', () => {
      state.screen = 'home';
      render();
    });
  }

  if (state.screen === 'home') attachHomeEvents();

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const categoryId = btn.dataset.categoryId;
      if (!categoryId) return; // تاب الرئيسية له معالج لوحده
      // لو جاي من لوحة التحكم، لازم نرجّع الشاشة للشيتات
      const cameFromHome = state.screen !== 'sheets';
      state.screen = 'sheets';
      if (categoryId === state.activeCategoryId) {
        if (cameFromHome) render();
        return;
      }
      state.activeCategoryId = categoryId;
      state.grades = [];
      state.showAddGradeForm = false;
      state.showEditCategoryInfoForm = false;
      state.resolvingGradeId = null;
      state.confirmingOutGradeId = null;
      state.bulkRequestMode = false;
      // التحديد مرتبط بدرجات الفئة اللي كنا فيها، فلازم يتصفّر مع التبديل
      // عشان مايتطبعش بالغلط على فئة تانية.
      state.gradeLabelMode = false;
      state.gradeLabelQty = {};
      render();
      subscribeGrades(categoryId);
    });
  });

  const toggleBulkRequestBtn = document.getElementById('toggle-bulk-request-btn');
  if (toggleBulkRequestBtn) {
    toggleBulkRequestBtn.addEventListener('click', () => {
      state.bulkRequestMode = !state.bulkRequestMode;
      render();
    });
  }

  document.querySelectorAll('.bulk-request-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const gradeId = checkbox.dataset.bulkToggleId;
      if (checkbox.checked) {
        requestShortage(gradeId);
      } else {
        cancelShortage(gradeId);
      }
    });
  });

  // ---- وضع طباعة ملصقات الدرجات ----
  const toggleGradeLabelBtn = document.getElementById('toggle-grade-label-btn');
  if (toggleGradeLabelBtn) {
    toggleGradeLabelBtn.addEventListener('click', () => {
      state.gradeLabelMode = !state.gradeLabelMode;
      if (!state.gradeLabelMode) state.gradeLabelQty = {};
      // الوضعين مايشتغلوش مع بعض — عمود الحالة واحد.
      if (state.gradeLabelMode) state.bulkRequestMode = false;
      render();
    });
  }

  // علامة الصح بتحط 1 كعدد افتراضي، وشيلها بتصفّر — عشان أسرع حالة
  // استخدام (ملصق واحد لكل درجة) تبقى ضغطة واحدة بس.
  document.querySelectorAll('.grade-label-check').forEach((box) => {
    box.addEventListener('change', () => {
      const id = box.dataset.gradeLabelId;
      state.gradeLabelQty = state.gradeLabelQty || {};
      if (box.checked) {
        if (!state.gradeLabelQty[id]) state.gradeLabelQty[id] = 1;
      } else {
        delete state.gradeLabelQty[id];
      }
      render();
    });
  });

  document.querySelectorAll('.grade-label-qty').forEach((input) => {
    // بنستنى لحد ما يخلص كتابة (blur/Enter) بدل ما نعيد الرسم على كل حرف
    // ويضيع تركيز الخانة من تحت إيده.
    const commit = () => {
      const id = input.dataset.gradeQtyId;
      const n = Math.max(0, Math.min(200, parseInt(input.value, 10) || 0));
      state.gradeLabelQty = state.gradeLabelQty || {};
      if (n > 0) state.gradeLabelQty[id] = n;
      else delete state.gradeLabelQty[id];
      render();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
  });

  const clearGradeLabelsBtn = document.getElementById('clear-grade-labels-btn');
  if (clearGradeLabelsBtn) {
    clearGradeLabelsBtn.addEventListener('click', () => {
      state.gradeLabelQty = {};
      render();
    });
  }

  const printGradeLabelsBtn = document.getElementById('print-grade-labels-btn');
  if (printGradeLabelsBtn) {
    printGradeLabelsBtn.addEventListener('click', () => {
      const cat = state.categories.find((c) => c.id === state.activeCategoryId);
      if (!cat) return;
      promptLabelSize((sizeOptions) => printGradeLabels(cat, sizeOptions), true);
    });
  }

  const addGradeRangeBtn = document.getElementById('add-grade-range-btn');
  if (addGradeRangeBtn) {
    addGradeRangeBtn.addEventListener('click', () => openAddGradeRangeDialog(state.activeCategoryId));
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.signOut());
  }

  // أزرار شريط الأعلى الجديدة (كل واحد بيتربط بس لو موجود فعلًا في الشاشة،
  // لأن ظهورهم بيعتمد على الصلاحية أو على دعم المتصفح).
  const wire = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  };

  // قايمة الشريط العلوي على الموبايل: بتفتح بالضغط على ☰، وبتقفل لما
  // تضغط أي حاجة جواها أو في أي مكان بره.
  const menuToggle = document.getElementById('menu-toggle-btn');
  const menuPanel = document.getElementById('menu-panel');
  if (menuToggle && menuPanel) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menuPanel.classList.toggle('open');
    });
    menuPanel.addEventListener('click', () => menuPanel.classList.remove('open'));
    document.addEventListener('click', () => menuPanel.classList.remove('open'), { once: true });
  }
  wire('scan-barcode-btn', () => openBarcodeScanner());
  wire('import-btn', () => openImportDialog());
  wire('users-btn', () => openUserAdmin());
  wire('install-app-btn', () => promptAppInstall());
  wire('export-btn', async (e) => {
    const btn = document.getElementById('export-btn');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'جارٍ التجهيز...';
    try {
      await exportToExcel();
    } catch (err) {
      console.error(err);
      alert('تعذّر التصدير: ' + (err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  const activityLogBtn = document.getElementById('activity-log-btn');
  if (activityLogBtn) {
    activityLogBtn.addEventListener('click', () => {
      state.screen = state.screen === 'activity' ? 'home' : 'activity';
      if (state.screen === 'activity') subscribeActivityLog();
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
      const minQty = Number(document.getElementById('new-category-min-qty').value) || 0;
      if (!name) return;
      await addCategory(name, itemName, barcodeNumber, originalPrice, sellingPrice, minQty);
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
      if (!cat) return;
      // المقاس ← المعاينة ← اختيار الجهاز ← الطباعة (كلها جوه printLabel).
      promptLabelSize((sizeOptions) => printLabel(cat, sizeOptions));
    });
  }

  const printRestockBtn = document.getElementById('print-restock-btn');
  if (printRestockBtn) {
    printRestockBtn.addEventListener('click', () => {
      const cat = state.categories.find((c) => c.id === state.activeCategoryId);
      if (!cat) return;
      printRestockPaper(cat, state.grades);
    });
  }

  const printerSettingsBtn = document.getElementById('printer-settings-btn');
  if (printerSettingsBtn) {
    printerSettingsBtn.addEventListener('click', () => {
      openPrinterSettings();
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
      const minQty = Number(document.getElementById('edit-category-min-qty').value) || 0;
      await updateCategoryInfo(state.activeCategoryId, itemName, barcodeNumber, originalPrice, sellingPrice, minQty);
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
async function addCategory(name, itemName, barcodeNumber, originalPrice, sellingPrice, minQty) {
  const nextOrder = state.categories.reduce((max, c) => Math.max(max, c.order || 0), 0) + 1;
  // doc() بيولّد المعرّف على الجهاز فورًا، فمش محتاجين نستنى رد السيرفر
  // عشان نعرفه — وده اللي بيخلي الإضافة تشتغل وانت أوفلاين.
  const ref = db.collection('categories').doc();
  fireWrite(
    ref.set({
      name,
      order: nextOrder,
      itemName: itemName || '',
      barcodeNumber: barcodeNumber || '',
      originalPrice: originalPrice || 0,
      sellingPrice: sellingPrice || 0,
      minQty: Number(minQty) || 0,
    }),
    'إضافة فئة'
  );
  logActivity({ action: 'add_category', categoryId: ref.id, categoryName: name });
  state.activeCategoryId = ref.id;
}

async function deleteCategory(categoryId, categoryName) {
  const gradesSnap = await db.collection('categories').doc(categoryId).collection('grades').get();
  gradesSnap.docs.forEach((d) => fireWrite(d.ref.delete(), 'حذف درجة'));
  fireWrite(db.collection('categories').doc(categoryId).delete(), 'حذف فئة');
  logActivity({ action: 'delete_category', categoryId, categoryName });
  if (state.activeCategoryId === categoryId) {
    state.activeCategoryId = null;
    state.grades = [];
  }
}

async function addGrade(categoryId, data) {
  const ref = db.collection('categories').doc(categoryId).collection('grades').doc();
  fireWrite(
    ref.set({
      number: data.number,
      branchQty: data.branchQty || 0,
      mainQty: data.mainQty || 0,
      status: 'normal',
    }),
    'إضافة درجة'
  );
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'add_grade',
    categoryId,
    categoryName,
    gradeId: ref.id,
    gradeNumber: data.number,
  });
}

async function updateCategoryInfo(categoryId, itemName, barcodeNumber, originalPrice, sellingPrice, minQty) {
  fireWrite(
    db.collection('categories').doc(categoryId).update({
      itemName: itemName || '',
      barcodeNumber: barcodeNumber || '',
      originalPrice: originalPrice || 0,
      sellingPrice: sellingPrice || 0,
      minQty: Number(minQty) || 0,
    }),
    'تعديل بيانات الفئة'
  );
  logActivity({ action: 'edit_category_info', categoryId, itemName, barcodeNumber });
}

// ============================================================
// الطباعة: ملصق الباركود (QR) وورقة التزويد
// ============================================================
// ------------------------------------------------------------
// نقاط الطباعة (Print Stations)
// ------------------------------------------------------------
// المنطق القديم كان بيسأل "تبعت للفرع ولا للرئيسي؟" — وده كان مبني على
// افتراض إن فيه طابعة في كل مكان. الواقع إن الطابعات كلها في مكتب الكاشير
// في الفرع بس، فالسؤال ده مالوش معنى.
//
// المنطق الجديد: أي جهاز عليه QZ Tray وطابعة محفوظة بيسجّل نفسه كـ"نقطة
// طباعة" وبيبعت نبضة كل شوية. اللي بيطبع بيشوف الأجهزة **المتصلة دلوقتي
// فعلًا** بالاسم، ويختار الجهاز نفسه — مش المكان.
const DEVICE_ID_KEY = 'tazweed_device_id';
const DEVICE_NAME_KEY = 'tazweed_device_name';
const STATION_HEARTBEAT_MS = 45000;
const STATION_ONLINE_WINDOW_MS = 120000;

let stationHeartbeatTimer = null;
let unsubPrintStations = null;

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (err) {
    return '';
  }
}

function getDeviceName() {
  try {
    return localStorage.getItem(DEVICE_NAME_KEY) || '';
  } catch (err) {
    return '';
  }
}

function saveDeviceName(name) {
  try {
    localStorage.setItem(DEVICE_NAME_KEY, name);
  } catch (err) {
    console.error('تعذّر حفظ اسم الجهاز محليًا:', err);
  }
}

function isStationOnline(station) {
  if (!station || !station.lastSeen || !station.lastSeen.toMillis) return false;
  return Date.now() - station.lastSeen.toMillis() < STATION_ONLINE_WINDOW_MS;
}

// بيسجّل الجهاز ده كنقطة طباعة (وبيحدّث النبضة) — بس لو فعلًا يقدر يطبع:
// يعني QZ Tray شغال وفيه طابعة واحدة على الأقل محفوظة. من غير كده الجهاز
// مايظهرش في القايمة أصلًا عشان محدش يبعتله طباعة مش هتتنفذ.
async function registerPrintStation() {
  if (!state.user || !state.profile) return;
  const deviceId = getDeviceId();
  if (!deviceId) return;

  const labelPrinter = getSavedPrinter('label');
  const restockPrinter = getSavedPrinter('restock');
  if (!labelPrinter && !restockPrinter) return;
  if (!(await ensureQZConnected())) return;

  try {
    fireWrite(db.collection('printStations').doc(deviceId).set(
      {
        deviceName: getDeviceName() || 'جهاز بدون اسم',
        labelPrinter,
        restockPrinter,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        updatedByUid: state.user.uid,
        updatedByName: state.profile.name || '',
      },
      { merge: true }
    ), 'تسجيل نقطة طباعة');
  } catch (err) {
    console.warn('تعذّر تسجيل الجهاز كنقطة طباعة:', err);
  }
}

function startStationHeartbeat() {
  stopStationHeartbeat();
  registerPrintStation();
  stationHeartbeatTimer = setInterval(registerPrintStation, STATION_HEARTBEAT_MS);
}

function stopStationHeartbeat() {
  if (stationHeartbeatTimer) {
    clearInterval(stationHeartbeatTimer);
    stationHeartbeatTimer = null;
  }
}

function subscribePrintStations() {
  if (unsubPrintStations) unsubPrintStations();
  unsubPrintStations = db.collection('printStations').onSnapshot(
    (snap) => {
      state.printStations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    (err) => console.warn('تعذّر قراءة قائمة أجهزة الطباعة:', err)
  );
}

// ------------------------------------------------------------
// اختيار وجهة الطباعة
// ------------------------------------------------------------
// بيرجّع 'local' للطباعة على الجهاز ده، أو deviceId لجهاز تاني، أو null
// لو المستخدم ألغى.
function choosePrintTarget() {
  return new Promise((resolve) => {
    const myId = getDeviceId();
    const others = (state.printStations || []).filter((s) => s.id !== myId && isStationOnline(s));

    // لو مفيش أجهزة تانية متصلة، أو المستخدم أصلًا مش مخوّل يبعت لغيره،
    // مفيش داعي لأي سؤال — نطبع هنا على طول.
    if (!others.length || !canSendRemotePrint(state.profile)) {
      resolve('local');
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="card" style="max-width:320px; width:100%; text-align:center;">
        <div style="margin-bottom:4px; font-size:14px; font-weight:500;">تطبع على أنهي جهاز؟</div>
        <div style="margin-bottom:12px; font-size:11px; color:var(--text-secondary);">
          الأجهزة المتصلة دلوقتي بس هي اللي بتظهر هنا
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          <button class="btn btn-primary" data-target="local">🖨️ هنا (الجهاز ده)</button>
          ${others
            .map(
              (s) => `
            <button class="btn btn-primary" data-target="${escapeHTML(s.id)}">
              🟢 ${escapeHTML(s.deviceName || 'جهاز بدون اسم')}
            </button>`
            )
            .join('')}
        </div>
        <button class="btn" data-target="cancel">إلغاء</button>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        document.body.removeChild(overlay);
        resolve(target === 'cancel' ? null : target);
      });
    });
  });
}

// بيوصّل الطباعة لوجهتها: يا إما الجهاز ده مباشرة، يا إما بيبعتها لجهاز تاني.
async function deliverPrint(type, html, sizeOptions, winFeatures) {
  const target = await choosePrintTarget();
  if (target === null) return;

  if (target !== 'local') {
    await sendPrintJob(type, target, html, sizeOptions);
    return;
  }

  const printedViaQZ = await tryPrintViaQZ(type, html, sizeOptions);
  if (printedViaQZ) return;

  const win = window.open('', '_blank', winFeatures);
  if (!win) {
    alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

// بنبعت الـHTML جاهز بالكامل (بما فيه صورة الـQR) بدل ما الجهاز المستقبِل
// يعيد بناءه — كده اللي بيتطبع هناك هو **بالظبط** اللي شوفته في المعاينة.
async function sendPrintJob(type, targetDeviceId, html, sizeOptions) {
  const station = (state.printStations || []).find((s) => s.id === targetDeviceId);
  const payload = {
    type,
    targetDeviceId,
    html,
    sizeOptions: sizeOptions || null,
    status: 'pending',
    requestedByUid: state.user.uid,
    requestedByName: state.profile.name || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const ref = db.collection('printJobs').doc();
  fireWrite(ref.set(payload), 'طلب طباعة');
  const deviceLabel = station ? station.deviceName : 'الجهاز التاني';
  alert(
    state.isOnline
      ? `اتبعت طلب الطباعة لـ"${deviceLabel}". هيوصلك تأكيد أول ما يطبع.`
      : `⚠️ انت مش متصل بالإنترنت دلوقتي.\nالطلب اتسجّل، وهيتبعت لـ"${deviceLabel}" أول ما النت يرجع.`
  );

  // بنتابع الطلب شوية عشان نأكّد للي بعته إنه اتطبع فعلًا (أو فشل)، بدل
  // ما يفضل مستني من غير ما يعرف حصل إيه.
  const stop = ref.onSnapshot((snap) => {
    const data = snap.data();
    if (!data) return;
    if (data.status === 'printed') {
      stop();
      alert(`✅ اتطبع على "${deviceLabel}"${data.printedByName ? ` (${data.printedByName})` : ''}.`);
    } else if (data.status === 'failed') {
      stop();
      alert(`⚠️ "${deviceLabel}" استلم الطلب لكن الطباعة فشلت عنده. اتأكد إن QZ Tray شغال والطابعة متوصلة.`);
    }
  });
  setTimeout(stop, 180000);
}

// ============================================================
// استقبال طلبات الطباعة القادمة من جهاز تاني وتنفيذها تلقائيًا
// ============================================================
const handledPrintJobIds = new Set();
let unsubPrintJobs = null;

function subscribePrintJobs() {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  if (unsubPrintJobs) unsubPrintJobs();
  unsubPrintJobs = db
    .collection('printJobs')
    .where('targetDeviceId', '==', deviceId)
    .where('status', '==', 'pending')
    .onSnapshot(
      (snap) => {
        snap.docs.forEach((doc) => {
          if (handledPrintJobIds.has(doc.id)) return;
          handledPrintJobIds.add(doc.id);
          executePrintJob(doc.id, doc.data());
        });
      },
      (err) => console.warn('تعذّر استقبال طلبات الطباعة:', err)
    );
}

async function executePrintJob(jobId, job) {
  // الـHTML بيوصل جاهز من الجهاز الباعت (بما فيه صورة الـQR)، فاللي بيتطبع
  // هنا هو بالظبط اللي هو شافه في المعاينة عنده.
  const html = job.html;
  if (!html) return;

  // نجرب QZ Tray الأول (طباعة صامتة فعليًا 100%، من غير أي نافذة أو ضغطة
  // خالص)، ولو مش متاح على الجهاز ده، نرجع لطريقة الـiframe المخفي القديمة
  // (اللي لسه محتاجة ضغطة "طباعة" أخيرة جوه نافذة المتصفح).
  const printedViaQZ = await tryPrintViaQZ(job.type, html, job.sizeOptions);
  if (!printedViaQZ) {
    printHTMLSilently(html);
  }

  db.collection('printJobs')
    .doc(jobId)
    .update({
      status: 'printed',
      printedByUid: state.user.uid,
      printedByName: state.profile.name || '',
      printedAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .catch((err) => console.warn('تعذّر تعليم طلب الطباعة كمنفّذ:', err));
}

// hideCopies: بنخفي خانة "عدد اللاصقات" في وضع ملصقات الدرجات، لأن العدد
// هناك متحدّد لكل درجة على حدة في الجدول — فخانة واحدة عامة هتلخبط.
function promptLabelSize(callback, hideCopies) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;';
  overlay.innerHTML = `
    <div class="card" style="max-width:300px; text-align:center;">
      <div style="margin-bottom:12px; font-size:14px; font-weight:500;">طباعة ملصق</div>
      <div class="field" style="text-align:start; ${hideCopies ? 'display:none;' : ''}">
        <label>عدد اللاصقات</label>
        <input class="input" type="number" id="label-copies" value="1" min="1" max="200" inputmode="numeric" />
      </div>
      <div style="margin-bottom:4px; font-size:13px;">اختار المقاس</div>
      <div style="margin-bottom:12px; font-size:11px; color:var(--text-secondary);">
        اللاصقة المقسومة نصين = مقاس واحد، والمحتوى بيتكرر في النصين
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:10px;">
        <button class="btn btn-primary" id="size-measured">38×25 ملم — مقسومة نصين ✅</button>
        <button class="btn" id="size-38x25">38×25 ملم — قطعة واحدة</button>
        <button class="btn" id="size-38x18">38×18 ملم</button>
        <button class="btn" id="size-2x4">2×4 إنش</button>
      </div>
      <button class="btn" id="size-cancel">إلغاء</button>
    </div>`;
  document.body.appendChild(overlay);
  const pick = (id, opts) =>
    document.getElementById(id).addEventListener('click', () => {
      const raw = parseInt(document.getElementById('label-copies').value, 10);
      const copies = Math.max(1, Math.min(200, Number.isNaN(raw) ? 1 : raw));
      document.body.removeChild(overlay);
      callback({ ...opts, copies });
    });

  // halves = عدد الأقسام اللي اللاصقة الواحدة مقسومة لها والماكينة بتحسبهم
  // لاصقة واحدة. المحتوى بيتكرر في كل قسم.
  pick('size-measured', { pageWidthMm: 38, pageHeightMm: 25, halves: 2 });
  pick('size-38x25', { pageWidthMm: 38, pageHeightMm: 25, halves: 1 });
  pick('size-38x18', { pageWidthMm: 38, pageHeightMm: 18, halves: 1 });
  pick('size-2x4', { pageWidthMm: 50.8, pageHeightMm: 101.6, halves: 1 });
  document.getElementById('size-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
}

// توليد الـQR كصورة جاهزة (data URI) **في الصفحة الرئيسية**، مش جوه صفحة
// الطباعة. السبب: لما QZ Tray بياخد الـHTML، هو بيرسمه بمحرك داخلي بتاع
// Java، ومش مضمون إنه يستنى سكريبت خارجي يتحمّل ويولّد الكود قبل ما يطبع.
// الصورة الجاهزة بتشيل الاحتمال ده خالص (وكمان بتخلي المعاينة فورية).
function generateQRDataURL(text, sizePx) {
  return new Promise((resolve) => {
    if (typeof QRCode === 'undefined') {
      resolve('');
      return;
    }
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed; left:-9999px; top:-9999px;';
    document.body.appendChild(holder);
    try {
      new QRCode(holder, { text: String(text || ''), width: sizePx, height: sizePx, correctLevel: QRCode.CorrectLevel.M });
    } catch (err) {
      document.body.removeChild(holder);
      resolve('');
      return;
    }
    // المكتبة بترسم على canvas فورًا في المتصفحات الحديثة، وبتقع على img
    // في القديمة — بنتعامل مع الحالتين.
    setTimeout(() => {
      let dataUrl = '';
      const canvas = holder.querySelector('canvas');
      const img = holder.querySelector('img');
      try {
        if (canvas) dataUrl = canvas.toDataURL('image/png');
        else if (img && img.src) dataUrl = img.src;
      } catch (err) {
        dataUrl = '';
      }
      document.body.removeChild(holder);
      resolve(dataUrl);
    }, 60);
  });
}

// شكل الملصق مأخوذ من صورة الملصق الحقيقي (Crepe Sadda Luxe) اللي بعتها:
//   [ QR ]   اسم الصنف
//            رقم الباركود
//            السعر الأصلي مشطوب   السعر الفعلي
//
// نقطة جوهرية اتصلحت هنا: الشكل القديم كان بيحط الـQR **فوق** التلات سطور،
// وده مستحيل فيزيائيًا يدخل — نص اللاصقة ارتفاعه 12.5مم والـQR لوحده عايز
// ~11مم، فالسعر كان بيتقطع بره حدود الورق. لما الـQR بقى **جنب** النص،
// الـ11مم بتاعته بتاخد الارتفاع كله والسطور بتاخد العرض الباقي.
//
// نقطة تانية: اللاصقة مقسومة نصين والماكينة بتحسبهم لاصقة واحدة، فبنطبع
// **نفس المحتوى مرتين، مرة في كل نص** — بالظبط زي لفة الملصقات الأصلية.
function buildLabelHTML(cat, sizeOptions, qrDataUrl, copies) {
  const { pageWidthMm, pageHeightMm, halves } = sizeOptions;
  const halfHeight = pageHeightMm / (halves || 1);
  const copyCount = Math.max(1, Math.min(200, parseInt(copies, 10) || 1));

  // كل المقاسات بالملم عشان تطلع مظبوطة على الطابعة الحرارية بغض النظر
  // عن دقة الشاشة أو محرك العرض اللي بيرسمها.
  const pad = 0.7;
  const qrBox = Math.min(halfHeight - pad * 2, 12);
  const nameSize = Math.min(halfHeight * 0.21, 2.7);
  const codeSize = Math.min(halfHeight * 0.19, 2.4);
  const priceSize = Math.min(halfHeight * 0.2, 2.6);

  const priceHTML = cat.sellingPrice
    ? `<div class="price"><s>${escapeHTML(cat.originalPrice || 0)} L.E</s><b>${escapeHTML(cat.sellingPrice)} L.E</b></div>`
    : '';

  const qrHTML = qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="">` : '<div class="qr"></div>';

  const halfHTML = `
      <div class="half">
        ${qrHTML}
        <div class="txt">
          <div class="name">${escapeHTML(cat.itemName || cat.name)}</div>
          <div class="code">${escapeHTML(cat.barcodeNumber || '')}</div>
          ${priceHTML}
        </div>
      </div>`;

  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ملصق - ${escapeHTML(cat.itemName || cat.name)}</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, Helvetica, Tahoma, sans-serif;
          width: ${pageWidthMm}mm;
          color: #000; line-height: 1.15;
        }
        /* كل لاصقة = صفحة لوحدها. لما تطلب أكتر من نسخة، كل نسخة بتنزل
           على لاصقة جديدة بدل ما تتلزق في نفس الواحدة. */
        .label {
          width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;
          overflow: hidden;
        }
        .label + .label { page-break-before: always; break-before: page; }
        .half {
          height: ${halfHeight}mm; width: 100%;
          display: flex; align-items: center; gap: ${pad}mm;
          padding: ${pad}mm;
          overflow: hidden;
        }
        .qr { width: ${qrBox}mm; height: ${qrBox}mm; flex: 0 0 ${qrBox}mm; display: block; }
        .txt { flex: 1; min-width: 0; text-align: center; }
        .name {
          font-size: ${nameSize}mm; font-weight: bold;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .code { font-size: ${codeSize}mm; letter-spacing: 0.2mm; }
        .price { font-size: ${priceSize}mm; display: flex; justify-content: center; gap: ${pad * 2}mm; }
        .price s { font-weight: normal; }
        .price b { font-weight: bold; }
      </style>
    </head>
    <body>${`<div class="label">${halfHTML.repeat(halves || 1)}</div>`.repeat(copyCount)}</body>
    </html>
  `;
}

async function printLabel(cat, sizeOptions) {
  const copies = sizeOptions.copies || 1;
  const qrPx = Math.round((sizeOptions.pageHeightMm / (sizeOptions.halves || 1)) * 16);
  const qrDataUrl = await generateQRDataURL(cat.barcodeNumber || cat.name, qrPx);

  // المعاينة بتوري لاصقة واحدة بس (مفيش فايدة من عرض 20 نسخة متطابقة)،
  // واللي بيتطبع فعلًا هو العدد اللي طلبته.
  const previewHTML = buildLabelHTML(cat, sizeOptions, qrDataUrl, 1);
  const approved = await showPrintPreview(previewHTML, sizeOptions, copies);
  if (!approved) return;

  const html = buildLabelHTML(cat, sizeOptions, qrDataUrl, copies);
  await deliverPrint('label', html, sizeOptions, 'width=420,height=320');
}

// ------------------------------------------------------------
// ملصق الدرجة — تصميم مختلف تمامًا عن ملصق الصنف
// ------------------------------------------------------------
// ده مأخوذ من صورة الملصق الحقيقي اللي بتطبعه على ماكينة الباركود:
// **نص بس**، سطرين في نص اللاصقة:
//
//        كريب سادة لوكس
//           درجة 56
//
// من غير QR ولا رقم باركود ولا أسعار خالص — ده ملصق تعريف للطبعة، مش
// ملصق سعر. والاسم بيتاخد من **اسم الفئة بالعربي** (مش الاسم الإنجليزي
// بتاع الكاشير).

// بيقيس أكبر حجم خط يخلي النص يدخل في العرض المتاح، باستخدام قياس فعلي
// من الـcanvas بدل ما نخمّن ونلاقي الاسم الطويل اتقطع على الطابعة.
function fitFontSizeMm(text, maxWidthMm, bold) {
  const PX_PER_MM = 3.7795;
  const REF = 100; // بنقيس عند 100px ونحسب النسبة
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${bold ? 'bold ' : ''}${REF}px Tahoma, Arial, sans-serif`;
    const widthAtRef = ctx.measureText(String(text || '')).width;
    if (!widthAtRef) return maxWidthMm;
    return ((maxWidthMm * PX_PER_MM) / widthAtRef) * REF / PX_PER_MM;
  } catch (err) {
    return maxWidthMm / Math.max(1, String(text || '').length) * 1.8;
  }
}

function buildGradeLabelHTML(categoryName, gradeNumber, sizeOptions, copies) {
  const { pageWidthMm, pageHeightMm, halves } = sizeOptions;
  const halfHeight = pageHeightMm / (halves || 1);
  const copyCount = Math.max(1, Math.min(200, parseInt(copies, 10) || 1));

  const pad = 1;
  const availableW = pageWidthMm - pad * 2;
  const availableH = halfHeight - pad * 2;

  const line1 = String(categoryName || '');
  const line2 = `درجة ${gradeNumber}`;

  // السطرين ياخدوا نص الارتفاع لكل واحد، وكل واحد بيتصغّر لو عرضه زايد.
  const LINE = 1.25;
  const byHeight = availableH / (2 * LINE);
  const size1 = Math.min(byHeight, fitFontSizeMm(line1, availableW, true));
  const size2 = Math.min(byHeight, fitFontSizeMm(line2, availableW, true));

  const halfHTML = `
      <div class="half">
        <div class="l1">${escapeHTML(line1)}</div>
        <div class="l2">${escapeHTML(line2)}</div>
      </div>`;

  return `
    <!doctype html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>ملصق درجة ${escapeHTML(gradeNumber)}</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Tahoma, Arial, sans-serif; width: ${pageWidthMm}mm; color: #000; }
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; }
        .label + .label { page-break-before: always; break-before: page; }
        .half {
          height: ${halfHeight}mm; width: 100%;
          padding: ${pad}mm;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; overflow: hidden;
        }
        .l1, .l2 { font-weight: bold; white-space: nowrap; line-height: ${LINE}; }
        .l1 { font-size: ${size1.toFixed(2)}mm; }
        .l2 { font-size: ${size2.toFixed(2)}mm; }
      </style>
    </head>
    <body>${`<div class="label">${halfHTML.repeat(halves || 1)}</div>`.repeat(copyCount)}</body>
    </html>
  `;
}

async function printGradeLabels(cat, sizeOptions) {
  const picks = state.grades
    .map((g) => ({ grade: g, qty: (state.gradeLabelQty || {})[g.id] || 0 }))
    .filter((p) => p.qty > 0);

  if (!picks.length) return;

  // المعاينة بتوري أول درجة محدّدة كنموذج
  const previewHTML = buildGradeLabelHTML(cat.name, picks[0].grade.number, sizeOptions, 1);
  const total = picks.reduce((s, p) => s + p.qty, 0);
  const approved = await showPrintPreview(previewHTML, sizeOptions, total);
  if (!approved) return;

  // بنلزق ملصقات كل الدرجات في مستند واحد — طبعة واحدة بدل ما نفتح
  // نافذة طباعة لكل درجة لوحدها.
  const bodies = picks.map((p) =>
    extractLabelBody(buildGradeLabelHTML(cat.name, p.grade.number, sizeOptions, p.qty))
  );
  const shell = buildGradeLabelHTML(cat.name, picks[0].grade.number, sizeOptions, 1);
  const html = shell.replace(/<body>[\s\S]*<\/body>/, `<body>${bodies.join('')}</body>`);

  await deliverPrint('label', html, sizeOptions, 'width=420,height=320');
}

function extractLabelBody(fullHTML) {
  const match = fullHTML.match(/<body>([\s\S]*)<\/body>/);
  return match ? match[1] : '';
}

// ------------------------------------------------------------
// إضافة درجات دفعة واحدة (من رقم إلى رقم)
// ------------------------------------------------------------
function openAddGradeRangeDialog(categoryId) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:320px; width:100%;">
      <div style="font-size:15px; font-weight:500; margin-bottom:4px;">إضافة درجات دفعة واحدة</div>
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.7;">
        اكتب من رقم كام لرقم كام، والنظام هيضيفهم كلهم مرة واحدة.
        الأرقام الموجودة عندك خلاص هيتخطّاها.
      </div>
      <div style="display:flex; gap:8px;">
        <div class="field" style="flex:1;"><label>من</label>
          <input class="input" type="number" id="range-from" min="1" inputmode="numeric" /></div>
        <div class="field" style="flex:1;"><label>إلى</label>
          <input class="input" type="number" id="range-to" min="1" inputmode="numeric" /></div>
      </div>
      <div id="range-status" style="font-size:12px; margin-bottom:10px; min-height:16px;"></div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn" id="range-cancel">إلغاء</button>
        <button class="btn btn-primary" id="range-add">إضافة</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => { if (overlay.parentNode) document.body.removeChild(overlay); };
  document.getElementById('range-cancel').addEventListener('click', close);

  const statusEl = document.getElementById('range-status');
  const addBtn = document.getElementById('range-add');

  addBtn.addEventListener('click', async () => {
    const from = parseInt(document.getElementById('range-from').value, 10);
    const to = parseInt(document.getElementById('range-to').value, 10);

    statusEl.style.color = 'var(--danger-text)';
    if (Number.isNaN(from) || Number.isNaN(to)) {
      statusEl.textContent = 'اكتب الرقمين الأول.';
      return;
    }
    if (from < 1 || to < 1) {
      statusEl.textContent = 'الأرقام لازم تبدأ من 1.';
      return;
    }
    if (to < from) {
      statusEl.textContent = '"إلى" لازم يكون أكبر من أو يساوي "من".';
      return;
    }
    if (to - from + 1 > 2000) {
      statusEl.textContent = 'المدى كبير جدًا (أكتر من 2000 درجة). قسّمه على مرّات.';
      return;
    }

    const existing = new Set(state.grades.map((g) => Number(g.number)));
    const toAdd = [];
    for (let n = from; n <= to; n++) if (!existing.has(n)) toAdd.push(n);

    if (!toAdd.length) {
      statusEl.style.color = 'var(--text-secondary)';
      statusEl.textContent = 'كل الأرقام دي موجودة عندك خلاص.';
      return;
    }

    addBtn.disabled = true;
    statusEl.style.color = 'var(--text-secondary)';
    statusEl.textContent = `جارٍ إضافة ${toAdd.length} درجة...`;

    try {
      const gradesRef = db.collection('categories').doc(categoryId).collection('grades');
      // دفعات من 400 — الحد الأقصى للدفعة الواحدة في Firestore هو 500.
      for (let i = 0; i < toAdd.length; i += 400) {
        const batch = db.batch();
        toAdd.slice(i, i + 400).forEach((number) => {
          batch.set(gradesRef.doc(), { number, branchQty: 0, mainQty: 0, status: 'normal' });
        });
        await batch.commit();
      }

      const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
      logActivity({
        action: 'add_grade_range',
        categoryId,
        categoryName,
        oldValue: `${from}-${to}`,
        newValue: toAdd.length,
      });

      const skipped = to - from + 1 - toAdd.length;
      statusEl.style.color = '#2e7d32';
      statusEl.textContent = `✅ اتضافت ${toAdd.length} درجة${skipped ? ` (${skipped} كانوا موجودين)` : ''}.`;
      setTimeout(close, 1200);
    } catch (err) {
      console.error(err);
      statusEl.style.color = 'var(--danger-text)';
      statusEl.textContent = 'تعذّرت الإضافة: ' + (err.message || err);
      addBtn.disabled = false;
    }
  });
}

// معاينة قبل الطباعة (للملصق بس) — بتوري شكل الملصق الحقيقي جوه النظام
// نفسه قبل ما يروح للطابعة، مع تكبير مرئي عشان يبان على الموبايل.
// بترجّع true لو المستخدم ضغط "طباعة"، false لو ألغى.
function showPrintPreview(html, sizeOptions, copies) {
  return new Promise((resolve) => {
    const scale = 4;
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="card" style="max-width:360px; width:100%; text-align:center;">
        <div style="font-size:14px; font-weight:500; margin-bottom:10px;">معاينة الملصق قبل الطباعة</div>
        <div style="overflow:auto; margin-bottom:12px;">
          <div style="width:${sizeOptions.pageWidthMm * scale}px; height:${sizeOptions.pageHeightMm * scale}px; margin:0 auto; border:1px solid var(--border); background:#fff;">
            <iframe id="preview-frame" style="width:${sizeOptions.pageWidthMm}mm; height:${sizeOptions.pageHeightMm}mm; border:0; transform:scale(${(sizeOptions.pageWidthMm * scale) / (sizeOptions.pageWidthMm * 3.7795)}); transform-origin:top left;"></iframe>
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">
          ${sizeOptions.pageWidthMm}×${sizeOptions.pageHeightMm} ملم${sizeOptions.halves > 1 ? ' — المحتوى بيتكرر في نصّي اللاصقة' : ''}
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn" id="preview-cancel">إلغاء</button>
          <button class="btn btn-primary" id="preview-print">🖨️ طباعة ${copies > 1 ? `${copies} لاصقات` : ''}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const frame = document.getElementById('preview-frame');
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const close = (result) => {
      if (overlay.parentNode) document.body.removeChild(overlay);
      resolve(result);
    };
    document.getElementById('preview-cancel').addEventListener('click', () => close(false));
    document.getElementById('preview-print').addEventListener('click', () => close(true));
  });
}

// خطوط التظليل بترسم كـ SVG **محتوى** مش خلفية CSS.
// السبب الجذري: QZ Tray مش بيستخدم Chrome في الطباعة — بيستخدم محرك عرض
// داخلي بتاع Java (JavaFX WebView) قديم، ومش بيدعم repeating-linear-gradient
// ولا -webkit-text-stroke. فإصلاح print-color-adjust القديم (v0.8.3) كان
// صح لكن مالوش لازمة في مسار QZ. الخطوط دي "رسم" مش "خلفية"، فأي محرك
// بيرسمها إجباري ومفيش إعداد طباعة يقدر يشيلها.
function hatchSVG() {
  const lines = [];
  for (let x = -20; x <= 100; x += 5) {
    lines.push(`<line x1="${x}" y1="20" x2="${x + 20}" y2="0" stroke="#000" stroke-width="2.2" />`);
  }
  return `<svg class="hatch" viewBox="0 0 100 20" preserveAspectRatio="none">${lines.join('')}</svg>`;
}

function buildRestockHTML(cat, grades) {
  const now = new Date().toLocaleString('ar-EG');
  const rowsHTML = grades
    .map(
      (g) => `
      <div class="row">
        <span class="num">${escapeHTML(g.number)}</span>
        <span class="blank">${g.status === 'out' ? hatchSVG() : ''}</span>
      </div>`
    )
    .join('');

  return `
    <!doctype html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>ورقة تزويد - ${escapeHTML(cat.itemName || cat.name)}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; }
        body { font-family: Tahoma, Arial, sans-serif; font-size: 10px; padding: 1mm; margin: 0; width: 70mm; }
        .header { text-align: center; margin-bottom: 8px; }
        .header .tab-name { font-weight: bold; font-size: 16px; }
        .header .item-name { font-size: 14px; font-weight: bold; color: #000; margin-top: 2px; }
        .header .time { font-size: 11px; font-weight: bold; margin-top: 4px; }
        .grid { column-count: 4; column-gap: 1.5mm; }
        .row {
          display: flex; align-items: stretch;
          border: 1px solid #000; margin-bottom: -1px;
          break-inside: avoid; min-height: 5mm;
        }
        .row .num {
          font-weight: bold; padding: 1px 2px;
          display: flex; align-items: center; justify-content: center;
          position: relative; z-index: 1;
        }
        .row .blank {
          flex: 1;
          border-inline-start: 1.5px solid #000;
          position: relative;
          overflow: hidden;
        }
        /* الخطوط بتغطي خانة الكتابة بس — رقم الدرجة بيفضل نضيف وواضح
           تمامًا، عشان تقدر تقراه بسرعة وانت ماشي على الرف. */
        .hatch {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          display: block;
        }
        @media print {
          body { padding: 1mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="tab-name">${escapeHTML(cat.name)}</div>
        ${cat.itemName ? `<div class="item-name">${escapeHTML(cat.itemName)}</div>` : ''}
        <div class="time">${escapeHTML(now)}</div>
      </div>
      <div class="grid">${rowsHTML}</div>
      <script>
        window.onload = function () { setTimeout(function () { window.print(); }, 300); };
      <\/script>
    </body>
    </html>
  `;
}

async function printRestockPaper(cat, grades) {
  const html = buildRestockHTML(cat, grades);
  // ورقة التزويد رول مستمر (الارتفاع مفتوح)، فمش بنفرض مقاس على QZ.
  await deliverPrint('restock', html, null, 'width=700,height=800');
}

// ============================================================
// الطباعة الصامتة (بدون نافذة منبثقة) — تُستخدم لطباعة طلبات وصلت من
// مكان تاني، لأن فتح نافذة (window.open) من غير ضغطة مستخدم مباشرة ممكن
// المتصفح يمنعه كـ Popup. الـ iframe المخفي ده حل معروف بيلف الحاجز ده.
// ملحوظة: نافذة الطباعة القياسية للمتصفح هتفتح لوحدها تلقائيًا، لكن
// المستخدم لسه محتاج ضغطة "طباعة" الأخيرة جوه النافذة دي نفسها — المتصفح
// مش بيسمح بطباعة فعلية 100% صامتة من صفحة ويب عادية.
function printHTMLSilently(htmlContent) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();
  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }, 15000);
}

// ============================================================
// تكامل QZ Tray: طباعة مباشرة لطابعة مختارة ومحفوظة على الجهاز نفسه.
// ============================================================
// ملحوظة معمارية مهمة: اختيار الطابعة بيتحفظ محليًا على **هذا الجهاز بس**
// (localStorage)، مش في حساب المستخدم على السحابة — لأن الطابعة فعليًا
// موصولة بجهاز معيّن، مش بشخص معيّن. لو نفس الحساب اتفتح من جهاز تاني،
// هيحتاج يختار طابعاته هو تاني.
const QZ_LABEL_PRINTER_KEY = 'tazweed_qz_label_printer';
const QZ_RESTOCK_PRINTER_KEY = 'tazweed_qz_restock_printer';

let qzConnected = false;
let qzConnecting = null;

function isQZAvailable() {
  return typeof qz !== 'undefined';
}

async function ensureQZConnected() {
  if (!isQZAvailable()) return false;
  if (qzConnected) return true;
  if (qzConnecting) return qzConnecting;
  qzConnecting = qz.websocket
    .connect()
    .then(() => {
      qzConnected = true;
      return true;
    })
    .catch((err) => {
      console.warn('تعذّر الاتصال بـ QZ Tray (على الأغلب مش مثبّت على الجهاز ده):', err);
      return false;
    })
    .finally(() => {
      qzConnecting = null;
    });
  return qzConnecting;
}

async function getAvailableQZPrinters() {
  const ok = await ensureQZConnected();
  if (!ok) return [];
  try {
    return await qz.printers.find();
  } catch (err) {
    console.error('تعذّر جلب قائمة الطابعات من QZ Tray:', err);
    return [];
  }
}

function getSavedPrinter(type) {
  const key = type === 'label' ? QZ_LABEL_PRINTER_KEY : QZ_RESTOCK_PRINTER_KEY;
  try {
    return localStorage.getItem(key) || '';
  } catch (err) {
    return '';
  }
}

function saveSelectedPrinter(type, printerName) {
  const key = type === 'label' ? QZ_LABEL_PRINTER_KEY : QZ_RESTOCK_PRINTER_KEY;
  try {
    localStorage.setItem(key, printerName);
  } catch (err) {
    console.error('تعذّر حفظ اختيار الطابعة محليًا:', err);
  }
}

// بيرجع true لو نجحت الطباعة عبر QZ Tray، false لو محتاج نرجع للطريقة
// العادية (نافذة المتصفح / iframe).
async function tryPrintViaQZ(type, htmlContent, sizeOptions) {
  const printerName = getSavedPrinter(type);
  if (!printerName) return false;

  const ok = await ensureQZConnected();
  if (!ok) return false;

  try {
    // اللاصقة مقاسها ثابت فبنفرضه على محرك الطباعة بتاع QZ مباشرة (وده
    // اللي بيلف مشكلة قايمة المقاسات المحفوظة في تعريف الطابعة). ورقة
    // التزويد رول مستمر بارتفاع مفتوح، فبنسيب الطابعة تتحكم في الارتفاع.
    const size =
      sizeOptions && sizeOptions.pageWidthMm
        ? { width: sizeOptions.pageWidthMm, height: sizeOptions.pageHeightMm }
        : null;
    const config = qz.configs.create(printerName, size ? { size, units: 'mm' } : {});
    await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: htmlContent }]);
    return true;
  } catch (err) {
    console.error('فشلت الطباعة عبر QZ Tray:', err);
    return false;
  }
}

// ============================================================
// شاشة إعدادات طابعات الجهاز (تظهر لأي حد يقدر يطبع)
// ============================================================
async function openPrinterSettings() {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;';
  overlay.innerHTML = `
    <div class="card" style="max-width:340px; width:100%;">
      <div style="font-size:14px; font-weight:500; margin-bottom:4px;">إعدادات طابعات هذا الجهاز</div>
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;" id="qz-status-line">جارٍ البحث عن QZ Tray...</div>
      <div id="qz-printer-fields" style="display:none;">
        <div class="field">
          <label>اسم الجهاز ده</label>
          <input class="input" id="qz-device-name" placeholder="مثال: كمبيوتر الكاشير — الفرع" />
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
            الاسم ده اللي هيظهر لزمايلك لما يبعتوا طباعة للجهاز ده
          </div>
        </div>
        <div class="field">
          <label>طابعة الملصق (باركود)</label>
          <select class="input" id="qz-label-printer-select"></select>
        </div>
        <div class="field">
          <label>طابعة ورقة التزويد</label>
          <select class="input" id="qz-restock-printer-select"></select>
        </div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn" id="qz-settings-close">إغلاق</button>
        <button class="btn btn-primary" id="qz-settings-save" style="display:none;">حفظ</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('qz-settings-close').addEventListener('click', () => document.body.removeChild(overlay));

  const printers = await getAvailableQZPrinters();
  const statusLine = document.getElementById('qz-status-line');
  const fields = document.getElementById('qz-printer-fields');
  const saveBtn = document.getElementById('qz-settings-save');

  if (!isQZAvailable() || printers.length === 0) {
    statusLine.innerHTML = isQZAvailable()
      ? 'تعذّر الاتصال بـ QZ Tray. تأكد إنه مشغّل على الجهاز ده.'
      : 'برنامج QZ Tray مش مثبّت على الجهاز ده. بدونه، الطباعة هتشتغل بالطريقة العادية (نافذة المتصفح) وهتحتاج تختار الطابعة يدويًا كل مرة.';
    return;
  }

  statusLine.textContent = `متصل بـ QZ Tray — ${printers.length} طابعة موجودة`;
  fields.style.display = 'block';
  saveBtn.style.display = 'inline-block';

  const labelSelect = document.getElementById('qz-label-printer-select');
  const restockSelect = document.getElementById('qz-restock-printer-select');
  const deviceNameInput = document.getElementById('qz-device-name');

  [labelSelect, restockSelect].forEach((select) => {
    select.innerHTML = `<option value="">— اختار طابعة —</option>` + printers.map((p) => `<option value="${escapeHTML(p)}">${escapeHTML(p)}</option>`).join('');
  });
  labelSelect.value = getSavedPrinter('label');
  restockSelect.value = getSavedPrinter('restock');
  deviceNameInput.value = getDeviceName();

  saveBtn.addEventListener('click', () => {
    saveSelectedPrinter('label', labelSelect.value);
    saveSelectedPrinter('restock', restockSelect.value);
    saveDeviceName(deviceNameInput.value.trim());
    document.body.removeChild(overlay);
    // نسجّل الجهاز فورًا بالاسم والطابعات الجديدة، عشان يظهر لزمايله
    // على طول من غير ما يستنى النبضة الجاية.
    startStationHeartbeat();
    subscribePrintJobs();
  });
}

// ============================================================
// نظام النواقص: طلب تزويد → رد أمين المخزن الرئيسي
// ============================================================
async function requestShortage(gradeId) {
  const gradeRef = db.collection('categories').doc(state.activeCategoryId).collection('grades').doc(gradeId);
  const snap = await gradeRef.get();
  fireWrite(gradeRef.update({ status: 'pending' }), 'طلب تزويد');
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  logActivity({
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
  fireWrite(gradeRef.update({ status: 'normal' }), 'إلغاء طلب تزويد');
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  logActivity({
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
  fireWrite(gradeRef.update({ status: 'normal', mainQty: newMainQty, branchQty: newBranchQty }), 'تزويد');
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  logActivity({
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
  fireWrite(gradeRef.update({ status: 'out' }), 'خلصت نهائيًا');
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  logActivity({
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
  fireWrite(gradeRef.update({ status: 'normal' }), 'إرجاع للتوفر');
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  logActivity({
    action: 'reset_available',
    categoryId: state.activeCategoryId,
    categoryName,
    gradeId,
    gradeNumber: snap.data().number,
  });
}

async function deleteGrade(categoryId, gradeId, gradeNumber) {
  fireWrite(db.collection('categories').doc(categoryId).collection('grades').doc(gradeId).delete(), 'حذف درجة');
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({ action: 'delete_grade', categoryId, categoryName, gradeId, gradeNumber });
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

// ⚠️ نقطة جوهرية للعمل بدون إنترنت:
// وعد (Promise) الكتابة في Firestore **مابيتحلّش خالص وانت أوفلاين** — هو
// بيستنى تأكيد من السيرفر. لكن التعديل نفسه بيتطبّق محليًا فورًا وبيترفع
// لوحده أول ما النت يرجع.
//
// معنى كده إن أي `await` على كتابة كان بيوقف كل السطور اللي بعده وانت
// أوفلاين — فالحالة كانت بتتغيّر على الشاشة، لكن **سجل العمليات مكانش
// بيتكتب**، ورسائل التأكيد مكانتش بتظهر، والشاشة كانت تبان واقفة.
//
// الحل: منستناش الكتابة. بنطلقها وبنكمّل، وبنتعامل مع الفشل في catch.
function fireWrite(promise, label) {
  if (promise && typeof promise.catch === 'function') {
    promise.catch((err) => console.warn(`تعذّرت الكتابة (${label}):`, err));
  }
  return promise;
}

function logActivity(details) {
  return fireWrite(
    db.collection('activityLog').add({
      ...details,
      userId: state.user.uid,
      userName: state.profile.name,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }),
    'سجل العمليات'
  );
}

async function applyQuantityChange(gradeRef, snap, field, oldValue, newValue) {
  fireWrite(gradeRef.update({ [field]: newValue }), 'تعديل كمية');
  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  logActivity({
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
    .onSnapshot(
      (snap) => {
        state.activityLog = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        render();
      },
      (err) => console.warn('تعذّر قراءة سجل العمليات:', err)
    );
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
    // أي تغيير في حالة الدخول (دخول أو خروج) بيبدأ جلسة اشتراكات جديدة
    sessionStarted = false;

    if (unsubProfile) { unsubProfile(); unsubProfile = null; }
    if (unsubCategories) { unsubCategories(); unsubCategories = null; }
    if (unsubGrades) { unsubGrades(); unsubGrades = null; }
    if (unsubActivityLog) { unsubActivityLog(); unsubActivityLog = null; }
    if (unsubPrintJobs) { unsubPrintJobs(); unsubPrintJobs = null; }
    if (unsubPrintStations) { unsubPrintStations(); unsubPrintStations = null; }
    stopOverview();
    stopStationHeartbeat();

    if (!user) {
      state.printStations = [];
      state.profile = null;
      state.categories = [];
      state.grades = [];
      state.activeCategoryId = null;
      state.screen = 'home';
      state.activityLog = [];
      state.showAddCategoryForm = false;
      state.showAddGradeForm = false;
      state.showEditCategoryInfoForm = false;
      state.pendingCount = 0;
      state.outCount = 0;
      state.pendingByCategory = {};
      state.outByCategory = {};
      state.lowStockByCategory = {};
      state.lowStockCount = 0;
      state.presence = [];
      state.stockTotals = null;
      state.resolvingGradeId = null;
      state.confirmingOutGradeId = null;
      state.bulkRequestMode = false;
      state.loginBusy = false;
      state.loginError = '';
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

      // ⚠️⚠️ نقطة حرجة — متشيلش الشرط ده:
      //
      // الـsnapshot ده بيتنفّذ في كل مرة مستند users/{uid} يتغيّر. ونبضة
      // "آخر ظهور" بتكتب في **نفس المستند ده** كل شوية. يعني من غير الشرط،
      // بيحصل كده:
      //
      //   نبضة تكتب lastSeen → المستند اتغيّر → الـsnapshot بيتنبّه →
      //   بيشغّل النبضة تاني → تكتب تاني → ... حلقة لا نهائية
      //
      // وكل لفة كانت بتلغي وتعيد بناء 6 اشتراكات، وده اللي كان بيطلّع
      // خطأ Firestore: INTERNAL ASSERTION FAILED: Unexpected state.
      //
      // الاشتراكات دي بتتعمل **مرة واحدة لكل دخول**. أي تغيير بعد كده في
      // بيانات الحساب (زي تغيير الرتبة) بيعيد الرسم بس — من غير إعادة
      // اشتراك، وده الصح أصلًا.
      if (sessionStarted) return;
      sessionStarted = true;

      subscribeCategories();
      // لوحة التحكم بتحتاج ملخّص النواقص واللي خلص لكل المستخدمين، وهي
      // نفس البيانات اللي العدّاد البنفسجي بيستخدمها — فاشتراك واحد يكفي.
      subscribeOverview();
      subscribeActivityLog();
      startPresenceHeartbeat();

      // أي جهاز (مش أمين مخزن بس) ممكن يبقى نقطة طباعة، طالما عليه
      // QZ Tray وطابعة محفوظة — لأن الطابعات كلها في مكتب الكاشير.
      subscribePrintStations();
      subscribePrintJobs();
      startStationHeartbeat();
    });
  });
}

function subscribeCategories() {
  if (unsubCategories) unsubCategories();
  unsubCategories = db
    .collection('categories')
    .orderBy('order')
    .onSnapshot(
      (snap) => {
        state.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!state.activeCategoryId && state.categories.length) {
          state.activeCategoryId = state.categories[0].id;
        }
        render();
        // حدود التنبيه محفوظة على الفئات نفسها، فأي تغيير فيها لازم يعيد
        // بناء استعلام "قرّبت تخلص".
        subscribeLowStock();
        if (state.activeCategoryId) subscribeGrades(state.activeCategoryId);
      },
      (err) => console.warn('تعذّر قراءة الفئات:', err)
    );
}

function subscribeGrades(categoryId) {
  if (unsubGrades) unsubGrades();
  unsubGrades = db
    .collection('categories')
    .doc(categoryId)
    .collection('grades')
    .orderBy('number')
    .onSnapshot(
      { includeMetadataChanges: true },
      (snap) => {
        state.grades = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        state.hasPendingWrites = snap.metadata.hasPendingWrites;
        render();
      },
      (err) => console.warn('تعذّر قراءة الدرجات:', err)
    );
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
