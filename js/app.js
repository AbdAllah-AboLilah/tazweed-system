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
  // الشاشة الحالية:
  //   home = لوحة التحكم | sheets = الشيتات | activity = السجل
  //   products = قاعدة الأصناف | print = شاشة طباعة الباركود
  screen: 'home',
  sideMenuOpen: false, // قايمة الفئات الجانبية (على الموبايل بتفتح فوق الشاشة)
  categorySearch: '', // بحث جوه قايمة الفئات
  categoryFilter: 'all', // all | pending | out | low — فلترة قايمة الفئات
  gradeFilter: 'all', // all | pending | out | low | base — فلترة الدرجات جوه الفئة
  gradeGroupFilter: '', // فلترة بمجموعة الألوان ('' = الكل)
  categoryOrderMode: false, // وضع ترتيب الفئات في القايمة الجانبية
  gradeSelectMode: false, // وضع تحديد درجات للحذف الجماعي
  gradeSelected: {}, // { gradeId: true } — الدرجات المحددة للحذف
  productSearch: '',
  productDept: '',
  productSubDept: '',
  productPage: 1,
  printSearch: '',
  printCart: [], // [{ key, product, qty }] — سلة شاشة الطباعة
  undoCount: 0, // عدد الحركات المتاحة للتراجع (من الحفظ المحلي)
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
// الاسترجاع بيحصل مرة واحدة لكل دخول — مش مع كل تحديث لمستند الحساب.
let workStateRestored = false;

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

// توحيد النص العربي للبحث: الهمزات والألف والتاء المربوطة بتتكتب بأشكال
// مختلفة، والبحث لازم يلاقي "أبيض" لما تكتب "ابيض".
function normalizeArabic(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .trim();
}

// ============================================================
// الدرجات الأساسية (الألوان اللي موجودة في كل الفئات)
// ============================================================
// أبيض وأسود وأوف وايت موجودين في كل فئة تقريبًا، ومش ليهم رقم درجة زي
// باقي الألوان. بنخزّنهم كدرجات عادية بس بحقلين زيادة:
//   isBase: true   → عشان نعرف إنها درجة أساسية
//   name: 'أبيض'   → الاسم اللي بيتعرض بدل رقم الدرجة
// والرقم بيبقى سالب (-3, -2, -1) عشان يترتبوا **فوق** كل الأرقام العادية
// من غير ما نغيّر ترتيب Firestore.
const BASE_GRADES = [
  { key: 'white', name: 'أبيض', number: -3 },
  { key: 'black', name: 'أسود', number: -2 },
  { key: 'offwhite', name: 'أوف وايت', number: -1 },
];

const DEFAULT_BASE_CRITICAL_QTY = 3;

function gradeDisplayName(g) {
  if (g && g.isBase && g.name) return g.name;
  return `درجة ${g ? g.number : ''}`;
}

// الحد الحرج للدرجة: الدرجات الأساسية ليها حد خاص بيها، وباقي الدرجات
// بتاخد الحد الأدنى بتاع الفئة.
function gradeCriticalQty(g, cat) {
  if (g && g.isBase) return Number(g.criticalQty) || DEFAULT_BASE_CRITICAL_QTY;
  return Number(cat && cat.minQty) || 0;
}

// ============================================================
// مجموعات الألوان جوه الفئة الواحدة
// ============================================================
// في ملف الإكسل الأصلي، شيت "كريب سادة لوكس" كان مقسوم جواه لأكتر من
// مجموعة: "بيجات" لوحدها، وباقي الألوان لوحدها — كل مجموعة بترقيم درجاتها.
//
// فبقى لكل فئة قايمة أسماء مجموعات (colorGroups)، وكل درجة ليها حقل group
// باسم مجموعتها. الدرجات اللي مالهاش مجموعة بتظهر في الآخر تحت "باقي
// الدرجات" — فالفئات القديمة بتفضل شغّالة زي ما هي من غير أي تغيير.
const UNGROUPED_LABEL = 'باقي الدرجات';

function categoryGroups(cat) {
  const list = (cat && Array.isArray(cat.colorGroups) ? cat.colorGroups : []).filter(Boolean);
  return list;
}

// بترجّع الدرجات مقسّمة: [{ name, grades }] بترتيب المجموعات المحفوظ،
// والمجموعة الفاضية بتتشال. لو الفئة مش مقسّمة خالص، بترجّع قسم واحد
// من غير اسم (يعني بلا عناوين على الشاشة).
function groupedGrades(grades, cat) {
  const groups = categoryGroups(cat);
  if (!groups.length) return [{ name: '', grades }];

  const sections = groups.map((name) => ({ name, grades: [] }));
  const rest = { name: UNGROUPED_LABEL, grades: [] };
  const byName = {};
  sections.forEach((s) => (byName[s.name] = s));

  grades.forEach((g) => {
    const target = g.group && byName[g.group] ? byName[g.group] : rest;
    target.grades.push(g);
  });

  const out = sections.filter((s) => s.grades.length);
  if (rest.grades.length) out.push(rest);
  return out.length ? out : [{ name: '', grades: [] }];
}

// خانة اختيار مجموعة — بتظهر بس لو الفئة مقسّمة، فالفورم مايكبرش من غير داعي.
function groupSelectHTML(id, cat) {
  const groups = categoryGroups(cat);
  if (!groups.length) return '';
  return `
        <div class="field" style="margin-bottom:0; min-width:120px;">
          <label>المجموعة</label>
          <select class="input" id="${id}">
            <option value="">— ${escapeHTML(UNGROUPED_LABEL)} —</option>
            ${groups.map((n) => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('')}
          </select>
        </div>`;
}

// شريط تاني للفلترة بالمجموعة — بيظهر بس لو الفئة مقسّمة فعلًا، فالفئات
// غير المقسّمة شكلها مايتغيرش خالص.
function groupFilterBarHTML(cat) {
  const groups = categoryGroups(cat);
  if (!groups.length) return '';

  const hasUngrouped = state.grades.some((g) => !g.group || !groups.includes(g.group));
  const active = state.gradeGroupFilter || '';
  const countOf = (name) =>
    state.grades.filter((g) => (g.group && groups.includes(g.group) ? g.group : UNGROUPED_LABEL) === name).length;

  const chip = (value, label, n) =>
    `<button class="cat-chip ${active === value ? 'cat-chip-active' : ''}" data-group-filter="${escapeHTML(value)}">${escapeHTML(
      label
    )}${n ? ` (${escapeHTML(n)})` : ''}</button>`;

  return `
    <div class="filter-row">
      <span style="font-size:12px; color:var(--text-secondary); align-self:center;">🎨</span>
      ${chip('', 'كل المجموعات', 0)}
      ${groups.map((name) => chip(name, name, countOf(name))).join('')}
      ${hasUngrouped ? chip(UNGROUPED_LABEL, UNGROUPED_LABEL, countOf(UNGROUPED_LABEL)) : ''}
    </div>`;
}

// ------------------------------------------------------------
// فلترة الدرجات جوه الفئة
// ------------------------------------------------------------
function visibleGrades() {
  const filter = state.gradeFilter || 'all';
  const groupFilter = state.gradeGroupFilter || '';
  const cat = state.categories.find((c) => c.id === state.activeCategoryId) || {};

  return state.grades.filter((g) => {
    if (groupFilter) {
      const own = g.group || UNGROUPED_LABEL;
      if (own !== groupFilter) return false;
    }
    if (filter === 'all') return true;
    if (filter === 'pending') return g.status === 'pending';
    if (filter === 'out') return g.status === 'out';
    if (filter === 'low') {
      const limit = gradeCriticalQty(g, cat);
      return g.status === 'normal' && limit > 0 && (Number(g.branchQty) || 0) <= limit;
    }
    if (filter === 'base') return !!g.isBase;
    return true;
  });
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
    // الرسالة بتفرّق بين حالتين مختلفتين تمامًا، عشان المستخدم مايفتكرش
    // إن حسابه اتلغى وهو أصلًا مجرد مش متصل بالنت.
    root.innerHTML = state.isOnline
      ? `
      <div class="card" style="max-width:420px; margin:60px auto; text-align:center;">
        <div style="font-size:15px; font-weight:500; margin-bottom:8px;">الحساب لسه مالوش صلاحية</div>
        <div style="font-size:13px; color:var(--text-secondary); line-height:1.8;">
          الحساب مسجّل دخول، لكن المدير لسه ما حدّدش صلاحيته.
          اطلب منه يفتح شاشة <strong>الحسابات</strong> ويحدّد رتبتك.
        </div>
      </div>`
      : `
      <div class="card" style="max-width:420px; margin:60px auto; text-align:center;">
        <div style="font-size:15px; font-weight:500; margin-bottom:8px;">📴 مش متصل بالإنترنت</div>
        <div style="font-size:13px; color:var(--text-secondary); line-height:1.8;">
          دي أول مرة تفتح الحساب ده على الجهاز ده، فبيانات الصلاحية لسه
          مانزلتش عليه.<br>
          اتصل بالنت مرة واحدة بس، وبعدها النظام هيفتح من غير نت عادي.
        </div>
      </div>`;
    return;
  }

  if (state.view === 'dashboard') {
    const scroll = captureScrollState();
    root.innerHTML = dashboardHTML();
    attachDashboardEvents();
    restoreScrollState(scroll);
    return;
  }
}

// ============================================================
// ⭐ الحفاظ على مكان التمرير بعد كل رسم
// ============================================================
// المشكلة اللي كانت بتحصل على الكمبيوتر بس: انت نازل لدرجة 40 في الجدول،
// بتغيّر كميتها، والشاشة بترجعك لأول درجة.
//
// السبب: على الكمبيوتر الدرجات بتظهر في **جدول جوه صندوق بيمرّر لوحده**
// (max-height + overflow:auto). أي تغيير بيعيد بناء الصندوق من الصفر،
// والصندوق الجديد بيبدأ من أوله إجباريًا. على التليفون الدرجات كروت
// بتمشي مع الصفحة كلها، والمتصفح بيحافظ على مكان الصفحة لوحده — عشان كده
// المشكلة كانت على الكمبيوتر بس.
//
// الحل: نسجّل مكان التمرير قبل الرسم ونرجّعه بعده. وبنرجّعه **بس** لو
// إحنا في نفس الشاشة ونفس الفئة — عشان لما تفتح فئة تانية تبدأ من فوق
// طبيعي، مش من نص الجدول.
function currentScrollKey() {
  return `${state.view}|${state.screen}|${state.activeCategoryId || ''}`;
}

// ⚠️ نقطة دقيقة: مقارنة المفتاح لازم تكون مع **المفتاح بتاع الرسمة اللي
// إحنا بنقيسها**، مش المفتاح الحالي. لما تفتح فئة تانية، الكود بيغيّر
// activeCategoryId **قبل** ما ينادي render() — فلو قرينا المفتاح وقت
// القياس كنا هنقرا الفئة الجديدة، والمفتاحين يطلعوا متساويين، ونرجّع
// التمرير في فئة انت لسه فاتحها (لازم تبدأ من فوق).
let lastRenderedScrollKey = '';

function captureScrollState() {
  const boxes = {};
  document.querySelectorAll('[data-keep-scroll]').forEach((el) => {
    boxes[el.getAttribute('data-keep-scroll')] = el.scrollTop;
  });
  return {
    key: lastRenderedScrollKey,
    boxes,
    windowY: window.scrollY || window.pageYOffset || 0,
  };
}

function restoreScrollState(saved) {
  const key = currentScrollKey();
  if (saved && saved.key === key) {
    document.querySelectorAll('[data-keep-scroll]').forEach((el) => {
      const value = saved.boxes[el.getAttribute('data-keep-scroll')];
      if (value) el.scrollTop = value;
    });
    if (saved.windowY) window.scrollTo(0, saved.windowY);
  }
  lastRenderedScrollKey = key;
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
          <label for="email">اسم الدخول</label>
          <input class="input" id="email" required autocomplete="username" />
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
            الاسم اللي اداك المدير — أو إيميلك لو بتستخدم إيميل
          </div>
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
    // الموظف بيكتب اسمه المجرد، والنظام بيكمّله للشكل اللي Firebase بيفهمه
    // — نفس التحويل اللي حصل بالظبط وقت إنشاء الحساب.
    const email = usernameToEmail(document.getElementById('email').value);
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
      state.loginError = 'اسم الدخول أو الباسورد غلط. راجعهم مع المدير.';
      state.loginBusy = false;
      render();
    }
  });
}

// ============================================================
// لوحة التحكم: التابات + جدول الدرجات
// ============================================================
// ------------------------------------------------------------
// قايمة الفئات الجانبية
// ------------------------------------------------------------
// قبل كده الفئات كانت شريط أفقي فوق. مع 25 فئة (وأكتر) الشريط بقى محتاج
// سحب طويل يمين وشمال عشان توصل لفئة، والفئة اللي فيها نواقص ماكانش ليها
// أي علامة تفرّقها. القايمة الجانبية بتحل الاتنين: كله تحت بعضه، وقدام كل
// فئة نقطة بلونها لو محتاجة انتباه، وفوق فلاتر تخليك تشوف المطلوب بس.
function categoryNeedsFlags(catId) {
  // ------------------------------------------------------------
  // ⭐ الفئة المفتوحة بتتحسب من درجاتها اللي قدامك، مش من استعلام السحابة
  // ------------------------------------------------------------
  // المشكلة اللي بيحلها ده: كنت بتشوف "معلّق (1)" في الجدول قدامك، وفي
  // نفس اللحظة القايمة الجانبية بتقول مفيش أي حاجة مطلوب تزويدها — ومنظر
  // زي ده بيخلي النظام كله مش موثوق.
  //
  // السبب: القايمة الجانبية بتعتمد على استعلام شامل على كل الدرجات في كل
  // الفئات (collectionGroup). الاستعلام ده مفيد لأنه بيغطّي الفئات اللي
  // مش فاتحها، لكنه بيعتمد على السحابة، ولو تعطّل أو اتأخر لأي سبب،
  // العدّاد بيفضل صفر وانت شايف العكس بعينك.
  //
  // الفئة المفتوحة إحنا أصلًا قارينها بالكامل (state.grades) — فمفيش أي
  // داعي نسأل السحابة عنها. الحساب المحلي ده **دايمًا متفق مع اللي على
  // الشاشة**، وباقي الفئات بتفضل جاية من الاستعلام الشامل زي ما هي.
  if (catId && catId === state.activeCategoryId && state.grades.length) {
    const cat = state.categories.find((c) => c.id === catId) || {};
    return {
      pending: state.grades.filter((g) => g.status === 'pending').length,
      out: state.grades.filter((g) => g.status === 'out').length,
      low: state.grades.filter((g) => {
        const limit = gradeCriticalQty(g, cat);
        return g.status === 'normal' && limit > 0 && (Number(g.branchQty) || 0) <= limit;
      }).length,
    };
  }

  return {
    pending: ((state.pendingByCategory || {})[catId] || []).length,
    out: ((state.outByCategory || {})[catId] || []).length,
    low: ((state.lowStockByCategory || {})[catId] || []).length,
  };
}

// العدّاد البنفسجي فوق: بيتحسب من نفس مصدر القايمة الجانبية بالظبط، عشان
// الرقمين مايتعارضوش أبدًا (كان الجدول يقول "معلّق 1" والعدّاد يقول صفر).
function totalPendingNow() {
  return state.categories.reduce((sum, c) => sum + categoryNeedsFlags(c.id).pending, 0);
}

function categoryDotsHTML(flags) {
  const dot = (color, title, n) =>
    `<span title="${escapeHTML(title)}" class="cat-dot" style="background:${color};">${escapeHTML(n)}</span>`;
  return [
    flags.pending ? dot('#e6a817', 'طلبات تزويد معلّقة', flags.pending) : '',
    flags.low ? dot('#d97706', 'قرّبت تخلص', flags.low) : '',
    flags.out ? dot('#b03030', 'خلصت نهائيًا', flags.out) : '',
  ].join('');
}

function sideMenuHTML() {
  const canManageCatalog = hasFullAccess(state.profile);
  const filter = state.categoryFilter || 'all';
  const search = normalizeArabic(state.categorySearch || '');
  // الترتيب بيتحرّك في القايمة الكاملة بس: لو فيه فلتر أو بحث، الفئة اللي
  // فوقها/تحتها على الشاشة مش هي اللي فوقها/تحتها في الحقيقة — فالسهم
  // كان هيحرّكها لمكان مش متوقع. عشان كده الأسهم بتتقفل.
  const orderMode = canManageCatalog && state.categoryOrderMode;
  const canReorder = orderMode && filter === 'all' && !search;

  const list = state.categories.filter((cat) => {
    const flags = categoryNeedsFlags(cat.id);
    if (filter === 'pending' && !flags.pending) return false;
    if (filter === 'out' && !flags.out) return false;
    if (filter === 'low' && !flags.low) return false;
    if (search && normalizeArabic(cat.name).indexOf(search) === -1) return false;
    return true;
  });

  const counts = {
    pending: state.categories.filter((c) => categoryNeedsFlags(c.id).pending).length,
    out: state.categories.filter((c) => categoryNeedsFlags(c.id).out).length,
    low: state.categories.filter((c) => categoryNeedsFlags(c.id).low).length,
  };

  const chip = (key, label, n) => `
    <button class="cat-chip ${filter === key ? 'cat-chip-active' : ''}" data-cat-filter="${key}">
      ${escapeHTML(label)}${n ? ` (${escapeHTML(n)})` : ''}
    </button>`;

  return `
    <aside class="side-menu ${state.sideMenuOpen ? 'open' : ''}" id="side-menu">
      <div class="side-head">
        <span>الفئات (${escapeHTML(state.categories.length)})</span>
        <span style="display:flex; gap:6px; align-items:center;">
          ${
            canManageCatalog
              ? `<button class="btn ${orderMode ? 'btn-primary' : ''}" id="cat-order-btn"
                         style="padding:3px 8px; font-size:12px;" title="ترتيب الفئات">${orderMode ? '✔️ تم' : '↕️ ترتيب'}</button>`
              : ''
          }
          <button class="btn side-close" id="side-close-btn" aria-label="إغلاق">✕</button>
        </span>
      </div>

      ${
        orderMode
          ? `<div style="font-size:11px; color:var(--text-secondary); padding:0 4px 8px; line-height:1.7;">
               اضغط ▲ أو ▼ عشان تحرّك الفئة. الترتيب بيتحفظ على طول ويظهر لكل الناس.
               ${filter !== 'all' || search ? '<br><strong style="color:var(--danger-text);">شيل الفلتر والبحث الأول</strong> — الترتيب بيتحرّك في القايمة الكاملة بس.' : ''}
             </div>`
          : ''
      }

      <div class="side-filters">
        ${chip('all', 'الكل', 0)}
        ${chip('pending', '🟡 مطلوب تزويد', counts.pending)}
        ${chip('low', '🟠 قرّبت تخلص', counts.low)}
        ${chip('out', '🔴 خلصت', counts.out)}
      </div>

      <input class="input side-search" id="side-search" placeholder="ابحث عن فئة..."
             value="${escapeHTML(state.categorySearch || '')}" />

      <div class="side-list">
        ${
          list.length
            ? list
                .map((cat, idx) => {
                  const flags = categoryNeedsFlags(cat.id);
                  if (orderMode) {
                    return `
            <div class="side-item side-item-order">
              <span class="side-item-name">${escapeHTML(cat.name)}</span>
              <span style="display:flex; gap:4px;">
                <button class="btn" style="padding:2px 8px;" data-cat-move-up="${escapeHTML(cat.id)}"
                        ${canReorder && idx > 0 ? '' : 'disabled'} title="لفوق">▲</button>
                <button class="btn" style="padding:2px 8px;" data-cat-move-down="${escapeHTML(cat.id)}"
                        ${canReorder && idx < list.length - 1 ? '' : 'disabled'} title="لتحت">▼</button>
              </span>
            </div>`;
                  }
                  return `
            <button class="side-item ${cat.id === state.activeCategoryId && state.screen === 'sheets' ? 'side-item-active' : ''}"
                    data-category-id="${escapeHTML(cat.id)}">
              <span class="side-item-name">${escapeHTML(cat.name)}</span>
              <span class="side-item-dots">${categoryDotsHTML(flags)}</span>
            </button>`;
                })
                .join('')
            : `<div class="home-empty" style="padding:10px;">مفيش فئة بالمواصفات دي.</div>`
        }
      </div>

      ${canManageCatalog ? `<button class="btn side-add" id="add-category-tab-btn">+ فئة جديدة</button>` : ''}
    </aside>`;
}

function dashboardHTML() {
  const roleLabel = ROLE_LABELS_AR[state.profile?.role] || '';
  const canManageCatalog = hasFullAccess(state.profile);

  // حساب "موظف طباعة" بيفتح على شاشة الطباعة وبس — مفيش شيتات ولا لوحة
  // تحكم ولا قايمة فئات، عشان مايقدرش يلمس المخزن أصلًا.
  if (isPrintOperator(state.profile)) {
    return `
      <div>
        <div class="topbar">
          <div>
            <div style="font-size:14px; font-weight:500;">${escapeHTML(state.profile?.name)}</div>
            <div style="font-size:12px; color:var(--text-secondary);">${escapeHTML(roleLabel)}</div>
          </div>
          <div class="topbar-meta">
            ${connectionDotHTML()}
            <span>${escapeHTML(APP_NAME)} <span style="color:var(--text-muted);">v${escapeHTML(APP_VERSION)}</span></span>
            <button class="btn" id="logout-btn">🚪 خروج</button>
          </div>
        </div>
        ${printScreenHTML()}
      </div>`;
  }

  const addCategoryFormHTML = state.showAddCategoryForm
    ? `
    <div class="card" style="margin:0 1rem 1rem; padding:1rem;">
      <form id="add-category-form" style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;">
        <div class="field" style="flex:1; min-width:140px; margin-bottom:0;">
          <label>اسم الفئة (التاب)</label>
          <input class="input" id="new-category-name" data-draft="cat_name" required />
        </div>
        <div class="field" style="flex:1; min-width:140px; margin-bottom:0;">
          <label>اسم الصنف (زي الكاشير)</label>
          <input class="input" id="new-category-item-name" data-draft="cat_item" />
        </div>
        <div class="field" style="flex:1; min-width:140px; margin-bottom:0;">
          <label>الباركود</label>
          <input class="input" id="new-category-barcode" data-draft="cat_barcode" />
        </div>
        <div class="field" style="width:100px; margin-bottom:0;">
          <label>السعر الأصلي</label>
          <input class="input" type="number" id="new-category-original-price" data-draft="cat_orig" />
        </div>
        <div class="field" style="width:100px; margin-bottom:0;">
          <label>سعر البيع</label>
          <input class="input" type="number" id="new-category-selling-price" data-draft="cat_sell" />
        </div>
        <div class="field" style="width:110px; margin-bottom:0;">
          <label>الحد الأدنى</label>
          <input class="input" type="number" id="new-category-min-qty" min="0" placeholder="0 = مقفول" data-draft="cat_min" />
        </div>
        <button class="btn" type="button" id="pick-product-new">🔎 اختار من الأصناف</button>
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
  } else if (state.screen === 'products') {
    bodyHTML = productsScreenHTML();
  } else if (state.screen === 'print') {
    bodyHTML = printScreenHTML();
  } else if (state.categories.length === 0) {
    bodyHTML = `
      <div style="padding:2rem; text-align:center; color:var(--text-secondary);">
        لا توجد فئات (شيتات) مضافة بعد في قاعدة البيانات.
        ${canManageCatalog ? ' افتح قايمة الفئات واضغط "+ فئة جديدة".' : ''}
      </div>`;
  } else {
    bodyHTML = `<div style="padding:1rem;">${gradeTableHTML()}</div>`;
  }

  // شريط تنقّل صغير بين الشاشات الرئيسية — بديل شريط التابات القديم اللي
  // كان بيتزحلق يمين وشمال مع 25 فئة.
  const navBtn = (screen, label) =>
    `<button class="tab ${state.screen === screen ? 'tab-active' : ''}" data-screen="${screen}">${label}</button>`;

  // التاب بيوري **اسم الفئة المفتوحة نفسها** مش كلمة "الشيت" — عشان تعرف
  // انت فاتح إيه من غير ما تدوّر. الأسماء الطويلة بتتقص في التاب بس
  // (الاسم الكامل موجود فوق الجدول وفي القايمة الجانبية).
  const openCat = state.categories.find((c) => c.id === state.activeCategoryId);
  const openCatName = openCat ? openCat.name : '';
  const sheetTabLabel =
    '📄 ' +
    escapeHTML(openCatName.length > 20 ? openCatName.slice(0, 19) + '…' : openCatName || 'الشيت');

  const navRowHTML = `
    <div class="tabs">
      <button class="tab" id="side-open-btn">📂 الفئات</button>
      ${navBtn('home', '🏠 الرئيسية')}
      ${navBtn('sheets', sheetTabLabel)}
      ${canUsePrintScreen(state.profile) ? navBtn('print', '🏷️ طباعة') : ''}
      ${navBtn('products', '📦 الأصناف')}
    </div>
    ${state.screen === 'sheets' ? addCategoryFormHTML : ''}`;

  return `
    <div>
      <div class="topbar">
        <div>
          <div style="font-size:14px; font-weight:500;">${escapeHTML(state.profile?.name)}</div>
          <div style="font-size:12px; color:var(--text-secondary);">${escapeHTML(roleLabel)}</div>
        </div>
        <div class="topbar-meta">
          ${connectionDotHTML()}
          ${undoButtonHTML()}
          ${totalPendingNow() > 0 ? `<span class="badge badge-purple">${escapeHTML(totalPendingNow())} طلب معلّق</span>` : ''}
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
      ${navRowHTML}
      <div class="app-body">
        ${sideMenuHTML()}
        <div class="main-area">${bodyHTML}</div>
      </div>
      <div class="side-backdrop ${state.sideMenuOpen ? 'open' : ''}" id="side-backdrop"></div>
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
          <button class="btn" type="button" id="pick-product-edit">🔎 اختار من الأصناف</button>
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

// ============================================================
// منطق التزويد الجديد
// ============================================================
// الواقع في المحل: العرض بياخد **قطعة واحدة** من كل درجة. أول ما القطعة
// دي تتباع، الدرجة محتاجة تزويد فورًا — مش محتاج حد يفتح شاشة ويكتب
// "طلب تزويد" كخطوة منفصلة.
//
// فالمنطق بقى كده:
//   • أي درجة جديدة بتبدأ بـ1 في الفرع (مش صفر)
//   • أول ما الفرع ينزل لصفر (بزرار − أو بكتابة صفر) → الطلب بيتسجّل
//     **لوحده** ويبقى "معلّق"
//   • أمين الرئيسي بيضغط ✅ مرة واحدة → القطعة بتتنقل من الرئيسي للفرع
//     والحالة بترجع عادي، من غير ما يكتب أي رقم
//
// الكمية الافتراضية دي قابلة للتغيير لكل فئة (حقل restockQty)، والافتراضي 1.
const DEFAULT_RESTOCK_QTY = 1;

function defaultRestockQty() {
  const cat = state.categories.find((c) => c.id === state.activeCategoryId);
  const n = Number(cat && cat.restockQty);
  return n > 0 ? n : DEFAULT_RESTOCK_QTY;
}

// ------------------------------------------------------------
// الحالة بتتحدد من الكميات — مش من زرار حد بيضغطه
// ------------------------------------------------------------
// القاعدة الوحيدة اللي بيمشي عليها النظام كله دلوقتي:
//
//   فيه كمية في الفرع            → عادي
//   الفرع صفر والرئيسي فيه كمية  → طلب معلّق
//   الفرع صفر والرئيسي صفر       → خلصت نهائيًا
//
// وده معناه إن الحالة **بتصحّح نفسها في الاتجاهين**:
//   • الرئيسي نزل صفر وفيه طلب معلّق  → تتحول "خلصت" لوحدها
//   • وصلت كمية للرئيسي وهي "خلصت"    → ترجع "طلب معلّق" لوحدها
//   • دخلت قطعة للفرع                  → ترجع "عادي" لوحدها
//
// الأتمتة اللي في اتجاه واحد وبتحتاج تصحيح يدوي هي اللي بتعمل مشاكل —
// دي بترجع لوحدها أول ما الرقم الصح يتسجّل.
//
// بترجع الحالة الجديدة، أو null لو مفيش تغيير مطلوب.
function nextStatusFromQuantities(data, field, newValue) {
  const branch = field === 'branchQty' ? newValue : Number(data.branchQty) || 0;
  const main = field === 'mainQty' ? newValue : Number(data.mainQty) || 0;
  const current = data.status || 'normal';

  let target;
  if (branch > 0) target = 'normal';
  else if (main > 0) target = 'pending';
  else target = 'out';

  return target === current ? null : target;
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
      // الزرار الأساسي بقى ضغطة واحدة: بينقل الكمية الافتراضية من الرئيسي
      // للفرع ويقفل الطلب — من غير ما تكتب رقم في كل درجة. الكمية بكام
      // لسه موجودة كخيار تاني للحالات الاستثنائية.
      const n = defaultRestockQty();
      extra += `<button class="btn btn-primary" style="${smallBtn}" data-quick-fulfill-id="${escapeHTML(g.id)}">✅ زوّد ${escapeHTML(n)}</button>`;
      extra += `<button class="btn" style="${smallBtn}" data-open-fulfill-id="${escapeHTML(g.id)}">بكمية تانية</button>`;

      // "مفيش خالص" بقت مش محتاجة ضغطة أصلًا: أول ما كمية الرئيسي تنزل
      // صفر، الحالة بتتحول "خلصت" لوحدها. فالزرار بيظهر بس لو الرقم صفر
      // خلاص والحالة لسه معلّقة (بيانات قديمة). ولو فيه كمية، بنقول
      // للمستخدم الطريقة الصح بدل ما نسيبه يعلن حاجة تخالف الرقم.
      if ((Number(g.mainQty) || 0) === 0) {
        extra += `<button class="btn" style="${smallBtn}" data-open-confirm-out-id="${escapeHTML(g.id)}">مفيش خالص</button>`;
      } else {
        extra += `<span style="font-size:11px; color:var(--text-muted); margin-inline-start:6px;">نزّل كمية الرئيسي لصفر → تتحول "خلصت" لوحدها</span>`;
      }
    }
    return `${badge}${extra}`;
  }

  // status === 'out' — الرجوع للتوفر بيحصل لوحده أول ما كمية تدخل الرئيسي.
  // الزرار اليدوي بيظهر بس لو فعلًا فيه كمية مسجّلة (تصحيح بيانات قديمة).
  let outExtra = '';
  if (canEditMain) {
    const main = Number(g.mainQty) || 0;
    const branch = Number(g.branchQty) || 0;
    outExtra =
      main > 0 || branch > 0
        ? `<button class="btn" style="${smallBtn}" data-reset-out-id="${escapeHTML(g.id)}">رجّعها متاحة</button>`
        : `<span style="font-size:11px; color:var(--text-muted); margin-inline-start:6px;">ضيف كمية في الرئيسي → ترجع "معلّقة" لوحدها</span>`;
  }
  return `${badge}${outExtra}`;
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
  const cat = state.categories.find((c) => c.id === state.activeCategoryId);
  const sections = groupedGrades(visibleGrades(), cat);
  return sections
    .map(
      (section) => `
    ${section.name ? `<div class="group-head">${escapeHTML(section.name)} <span>${escapeHTML(section.grades.length)}</span></div>` : ''}
    <div class="grade-cards">
      ${section.grades
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
            : state.gradeSelectMode
              ? `
            <div class="gc-line">
              <span class="gc-label">تحديد للحذف</span>
              <input type="checkbox" class="grade-select-checkbox" data-grade-select-id="${escapeHTML(g.id)}"
                     ${(state.gradeSelected || {})[g.id] ? 'checked' : ''} style="width:20px; height:20px;" />
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
          <div class="grade-card ${rowClassForStatus(g.status)} ${g.isBase ? 'grade-base' : ''}">
            <div class="gc-head">
              <span class="gc-num">${escapeHTML(gradeDisplayName(g))}</span>
              ${
                canManageCatalog
                  ? `<button class="btn gc-del" data-delete-grade-id="${escapeHTML(g.id)}" data-delete-grade-number="${escapeHTML(gradeDisplayName(g))}">حذف</button>`
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
    </div>`
    )
    .join('');
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

  const selectModeBtn = canManageCatalog
    ? `<button class="btn ${state.gradeSelectMode ? 'btn-primary' : ''}" id="toggle-grade-select-btn">${
        state.gradeSelectMode ? '✔️ تم' : '☑️ تحديد للحذف'
      }</button>`
    : '';

  const missingBase = canManageCatalog && !state.grades.some((g) => g.isBase);

  const toolbarHTML = `
    <div style="display:flex; gap:8px; margin-bottom:0.75rem; flex-wrap:wrap;">
      ${bulkToggleBtn}
      ${labelModeBtn}
      ${selectModeBtn}
      ${canManageCatalog ? `<button class="btn" id="add-grade-btn">+ إضافة درجة</button>` : ''}
      ${canManageCatalog ? `<button class="btn" id="add-grade-range-btn">+ إضافة درجات دفعة</button>` : ''}
      ${missingBase ? `<button class="btn" id="add-base-grades-btn">+ الدرجات الأساسية</button>` : ''}
      ${canManageCatalog ? `<button class="btn" id="color-groups-btn">🎨 مجموعات الألوان</button>` : ''}
      ${canEditBranch ? `<button class="btn" id="bulk-branch-qty-btn">⬆️ ظبط كميات الفرع</button>` : ''}
      ${canManageCatalog ? `<button class="btn" id="delete-category-btn">حذف الفئة دي</button>` : ''}
    </div>`;

  // فلتر سريع: بدل ما تدوّر بعينك في 200 درجة على اللي محتاج تزويد.
  const cat = state.categories.find((c) => c.id === state.activeCategoryId) || {};
  const counts = {
    pending: state.grades.filter((g) => g.status === 'pending').length,
    out: state.grades.filter((g) => g.status === 'out').length,
    low: state.grades.filter((g) => {
      const limit = gradeCriticalQty(g, cat);
      return g.status === 'normal' && limit > 0 && (Number(g.branchQty) || 0) <= limit;
    }).length,
    base: state.grades.filter((g) => g.isBase).length,
  };
  const gf = state.gradeFilter || 'all';
  const gchip = (key, label, n) =>
    `<button class="cat-chip ${gf === key ? 'cat-chip-active' : ''}" data-grade-filter="${key}">${escapeHTML(label)}${
      n ? ` (${escapeHTML(n)})` : ''
    }</button>`;

  const filterBarHTML = `
    <div class="filter-row">
      ${gchip('all', 'الكل', state.grades.length)}
      ${gchip('pending', '🟡 معلّق', counts.pending)}
      ${gchip('low', '🟠 قرّبت تخلص', counts.low)}
      ${gchip('out', '🔴 خلصت', counts.out)}
      ${counts.base ? gchip('base', '⚪ الأساسية', counts.base) : ''}
    </div>
    ${groupFilterBarHTML(cat)}`;

  // شريط ملخّص بيفضل ظاهر وانت بتعلّم على الدرجات، عشان تعرف انت اخترت
  // كام وبتطبع كام من غير ما تعد بنفسك.
  const selected = Object.entries(state.gradeLabelQty || {}).filter(([, n]) => n > 0);
  const totalLabels = selected.reduce((s, [, n]) => s + n, 0);
  // ------------------------------------------------------------
  // شريط الأوامر السفلي (ثابت في أسفل الشاشة)
  // ------------------------------------------------------------
  // المشكلة اللي بيحلها: الفئة فيها 165 درجة. كنت بتنزل تحدّد، وبعدين
  // لازم ترجع لفوق تاني عشان توصل لزرار الطباعة. الشريط ده بيفضل قدام
  // عينك في أي مكان في الصفحة.
  //
  // اختاره تحت مش فوق عن قصد: فوق فيه خلاص 5 صفوف (الشريط العلوي +
  // التابات + بيانات الصنف + الأزرار + الفلاتر)، وسادس كان هياكل نص
  // شاشة الموبايل. وتحت هو مكان الصباع أصلًا وانت ماشي بالقايمة.
  //
  // وبيظهر **بس** وانت في وضع تحديد — مش موجود في الشغل العادي.
  const pendingInCategory = state.grades.filter((g) => g.status === 'pending').length;

  let actionBarHTML = '';
  if (state.gradeLabelMode) {
    actionBarHTML = `
    <div class="action-bar" id="action-bar">
      <div class="action-bar-inner">
        <span class="action-bar-info">
          محدّد <strong>${selected.length}</strong> درجة —
          إجمالي <strong>${totalLabels}</strong> ملصق
        </span>
        <button class="btn btn-primary" id="print-grade-labels-btn" ${totalLabels ? '' : 'disabled'}>🏷️ اطبع المحدّد</button>
        <button class="btn" id="clear-grade-labels-btn" ${totalLabels ? '' : 'disabled'}>مسح التحديد</button>
        <button class="btn" id="exit-label-mode-btn">✔️ تم</button>
        <span class="action-bar-hint">
          الملصق نص بس: ${escapeHTML((state.categories.find((c) => c.id === state.activeCategoryId) || {}).name || '')} + رقم الدرجة
        </span>
      </div>
    </div>`;
  } else if (state.bulkRequestMode) {
    actionBarHTML = `
    <div class="action-bar" id="action-bar">
      <div class="action-bar-inner">
        <span class="action-bar-info">
          <strong>${pendingInCategory}</strong> درجة مطلوب تزويدها في الفئة دي
        </span>
        <button class="btn btn-primary" id="exit-bulk-mode-btn">✔️ تم</button>
        <span class="action-bar-hint">علّم على اللي خلصت من العرض — الطلب بيتسجّل فورًا</span>
      </div>
    </div>`;
  } else if (state.gradeSelectMode) {
    const selectedCount = Object.keys(state.gradeSelected || {}).filter((k) => state.gradeSelected[k]).length;
    actionBarHTML = `
    <div class="action-bar" id="action-bar">
      <div class="action-bar-inner">
        <span class="action-bar-info">محدّد <strong>${selectedCount}</strong> درجة</span>
        <button class="btn" id="select-all-grades-btn">علّم على الظاهر</button>
        <button class="btn" id="clear-grade-select-btn" ${selectedCount ? '' : 'disabled'}>مسح التحديد</button>
        <button class="btn" id="delete-selected-grades-btn" ${selectedCount ? '' : 'disabled'}
                style="background:var(--danger-bg); color:var(--danger-text);">🗑️ احذف المحدّد</button>
        <button class="btn" id="exit-grade-select-btn">✔️ تم</button>
        <span class="action-bar-hint">الحذف الجماعي مالوش تراجع — التأكيد بيوريك الأسماء قبله</span>
      </div>
    </div>`;
  }

  // مساحة فاضية تحت القايمة بقدر الشريط، عشان آخر درجة ما تختفيش تحته.
  // الارتفاع الدقيق بيتظبط بعد الرسم في syncActionBarSpacer().
  const spacerHTML = actionBarHTML ? '<div class="action-bar-spacer" id="action-bar-spacer"></div>' : '';

  const addGradeFormHTML = state.showAddGradeForm
    ? `
    <div class="card" style="margin-bottom:0.75rem; padding:1rem;">
      <form id="add-grade-form" style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
        <div class="field" style="margin-bottom:0;"><label>الدرجة (رقم)</label><input class="input" style="width:90px;" type="number" id="new-grade-number" data-draft="grade_num" required /></div>
        <div class="field" style="margin-bottom:0;"><label>الفرع</label><input class="input" style="width:70px;" type="number" id="new-grade-branch" value="1" /></div>
        <div class="field" style="margin-bottom:0;"><label>الرئيسي</label><input class="input" style="width:70px;" type="number" id="new-grade-main" value="0" /></div>
        ${groupSelectHTML('new-grade-group', cat)}
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
    if (state.gradeSelectMode) {
      return `
        <td style="text-align:center;">
          <input type="checkbox" class="grade-select-checkbox" data-grade-select-id="${escapeHTML(g.id)}"
                 ${(state.gradeSelected || {})[g.id] ? 'checked' : ''} style="width:18px; height:18px;" />
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

  const shownGrades = visibleGrades();

  const emptyFilterHTML = shownGrades.length
    ? ''
    : `<div class="home-empty" style="padding:1rem;">مفيش درجات بالفلتر ده.</div>`;

  const gradeRowHTML = (g) => `
      <tr class="${rowClassForStatus(g.status)} ${g.isBase ? 'grade-base' : ''}">
        <td>${escapeHTML(gradeDisplayName(g))}</td>
        ${qtyCellHTML(state.activeCategoryId, g.id, 'branchQty', g.branchQty, canEditBranch)}
        ${qtyCellHTML(state.activeCategoryId, g.id, 'mainQty', g.mainQty, canEditMain)}
        ${statusColumnHTML(g)}
        ${canManageCatalog ? `<td><button class="btn" style="padding:4px 10px; font-size:12px;" data-delete-grade-id="${escapeHTML(g.id)}" data-delete-grade-number="${escapeHTML(gradeDisplayName(g))}">حذف</button></td>` : ''}
      </tr>`;

  // لو الفئة مقسّمة لمجموعات ألوان، كل مجموعة بيتحطّ قبلها صف عنوان
  // بيمتد على عرض الجدول كله.
  const colCount = 4 + (canManageCatalog ? 1 : 0);
  const rows = groupedGrades(shownGrades, cat)
    .map((section) => {
      const header = section.name
        ? `<tr class="group-row"><td colspan="${colCount}">${escapeHTML(section.name)} <span>${escapeHTML(section.grades.length)}</span></td></tr>`
        : '';
      return header + section.grades.map(gradeRowHTML).join('');
    })
    .join('');

  // على الموبايل بنرسم كارتس بدل الجدول (مش الاتنين) — عشان منضاعفش
  // عدد العناصر في الصفحة لما الفئة يكون فيها مئات الدرجات.
  if (state.isNarrow) {
    return `${infoBarHTML}${toolbarHTML}${filterBarHTML}${addGradeFormHTML}${
      shownGrades.length ? gradeCardsHTML(canEditBranch, canEditMain, canManageCatalog) : emptyFilterHTML
    }${spacerHTML}${actionBarHTML}`;
  }

  return `
    ${infoBarHTML}${toolbarHTML}${filterBarHTML}${addGradeFormHTML}${emptyFilterHTML}
    <div class="card" data-keep-scroll="grades" style="padding:0; overflow:auto; max-height:70vh;">
      <table>
        <thead>
          <tr>
            <th class="sticky-th">الدرجة</th>
            <th class="sticky-th">الفرع</th>
            <th class="sticky-th">الرئيسي</th>
            <th class="sticky-th">${
              state.gradeLabelMode
                ? 'اطبع كام؟'
                : state.bulkRequestMode
                  ? 'طلب تزويد'
                  : state.gradeSelectMode
                    ? 'تحديد'
                    : 'الحالة'
            }</th>
            ${canManageCatalog ? '<th class="sticky-th"></th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${spacerHTML}${actionBarHTML}`;
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

function openCategory(categoryId) {
  const cameFromElsewhere = state.screen !== 'sheets';
  state.screen = 'sheets';
  state.sideMenuOpen = false;
  if (categoryId === state.activeCategoryId) {
    if (cameFromElsewhere) render();
    return;
  }
  state.activeCategoryId = categoryId;
  state.grades = [];
  state.showAddGradeForm = false;
  state.showEditCategoryInfoForm = false;
  state.resolvingGradeId = null;
  state.confirmingOutGradeId = null;
  state.bulkRequestMode = false;
  state.gradeFilter = 'all';
  state.gradeGroupFilter = '';
  // التحديد مرتبط بدرجات الفئة اللي كنا فيها، فلازم يتصفّر مع التبديل
  // عشان مايتطبعش بالغلط على فئة تانية.
  state.gradeLabelMode = false;
  state.gradeLabelQty = {};
  saveWorkState();
  render();
  subscribeGrades(categoryId);
}

function attachDashboardEvents() {
  // حساب موظف الطباعة: شاشة واحدة بس، فمفيش داعي لباقي الربط.
  if (isPrintOperator(state.profile)) {
    const out = document.getElementById('logout-btn');
    if (out) out.addEventListener('click', () => auth.signOut());
    attachPrintScreenEvents();
    return;
  }

  if (state.screen === 'home') attachHomeEvents();
  if (state.screen === 'products') attachProductsEvents();
  if (state.screen === 'print') attachPrintScreenEvents();

  // ---- التنقّل بين الشاشات ----
  document.querySelectorAll('[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const screen = btn.getAttribute('data-screen');
      state.screen = screen;
      state.sideMenuOpen = false;
      render();
      // الأصناف بتتحمّل أول ما تحتاجها بس — مش مع كل تسجيل دخول.
      if (screen === 'products' || screen === 'print') {
        if (!productsCache) loadProducts().then(render).catch((err) => console.warn('تعذّر تحميل الأصناف:', err));
      }
    });
  });

  // ---- قايمة الفئات الجانبية ----
  const sideOpen = document.getElementById('side-open-btn');
  if (sideOpen) {
    sideOpen.addEventListener('click', () => {
      state.sideMenuOpen = !state.sideMenuOpen;
      render();
    });
  }
  const sideClose = document.getElementById('side-close-btn');
  if (sideClose) {
    sideClose.addEventListener('click', () => {
      state.sideMenuOpen = false;
      render();
    });
  }
  const backdrop = document.getElementById('side-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      state.sideMenuOpen = false;
      render();
    });
  }

  document.querySelectorAll('[data-cat-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.categoryFilter = btn.getAttribute('data-cat-filter');
      render();
    });
  });

  const sideSearch = document.getElementById('side-search');
  if (sideSearch) {
    let timer = null;
    sideSearch.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.categorySearch = sideSearch.value;
        render();
        const again = document.getElementById('side-search');
        if (again) {
          again.focus();
          again.setSelectionRange(again.value.length, again.value.length);
        }
      }, 200);
    });
  }

  document.querySelectorAll('.side-item[data-category-id]').forEach((btn) => {
    btn.addEventListener('click', () => openCategory(btn.dataset.categoryId));
  });

  // ---- ترتيب الفئات ----
  const catOrderBtn = document.getElementById('cat-order-btn');
  if (catOrderBtn) {
    catOrderBtn.addEventListener('click', () => {
      state.categoryOrderMode = !state.categoryOrderMode;
      render();
    });
  }
  document.querySelectorAll('[data-cat-move-up]').forEach((btn) => {
    btn.addEventListener('click', () => safeAsync(() => moveCategory(btn.getAttribute('data-cat-move-up'), -1), 'ترتيب الفئات'));
  });
  document.querySelectorAll('[data-cat-move-down]').forEach((btn) => {
    btn.addEventListener('click', () => safeAsync(() => moveCategory(btn.getAttribute('data-cat-move-down'), 1), 'ترتيب الفئات'));
  });

  // ---- فلتر الدرجات جوه الفئة ----
  document.querySelectorAll('[data-grade-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.gradeFilter = btn.getAttribute('data-grade-filter');
      render();
    });
  });

  document.querySelectorAll('[data-group-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.gradeGroupFilter = btn.getAttribute('data-group-filter');
      render();
    });
  });

  const toggleBulkRequestBtn = document.getElementById('toggle-bulk-request-btn');
  if (toggleBulkRequestBtn) {
    toggleBulkRequestBtn.addEventListener('click', () => {
      state.bulkRequestMode = !state.bulkRequestMode;
      if (state.bulkRequestMode) {
        state.gradeLabelMode = false;
        state.gradeSelectMode = false;
      }
      render();
    });
  }

  // ---- وضع تحديد درجات للحذف الجماعي ----
  const toggleGradeSelectBtn = document.getElementById('toggle-grade-select-btn');
  if (toggleGradeSelectBtn) {
    toggleGradeSelectBtn.addEventListener('click', () => {
      state.gradeSelectMode = !state.gradeSelectMode;
      // الأوضاع التلاتة بتتشارك نفس العمود، فواحد بس بيشتغل في المرة.
      if (state.gradeSelectMode) {
        state.gradeLabelMode = false;
        state.bulkRequestMode = false;
      } else {
        state.gradeSelected = {};
      }
      render();
    });
  }

  document.querySelectorAll('.grade-select-checkbox').forEach((box) => {
    box.addEventListener('change', () => {
      const id = box.dataset.gradeSelectId;
      state.gradeSelected = state.gradeSelected || {};
      if (box.checked) state.gradeSelected[id] = true;
      else delete state.gradeSelected[id];
      render();
    });
  });

  const selectAllGradesBtn = document.getElementById('select-all-grades-btn');
  if (selectAllGradesBtn) {
    // "الظاهر" مش "الكل" عن قصد: لو انت فالتر على مجموعة أو على "خلصت"،
    // التعليم بيشتغل على اللي قدامك بس — مش على درجات مش شايفها.
    selectAllGradesBtn.addEventListener('click', () => {
      state.gradeSelected = state.gradeSelected || {};
      visibleGrades().forEach((g) => (state.gradeSelected[g.id] = true));
      render();
    });
  }

  const clearGradeSelectBtn = document.getElementById('clear-grade-select-btn');
  if (clearGradeSelectBtn) {
    clearGradeSelectBtn.addEventListener('click', () => {
      state.gradeSelected = {};
      render();
    });
  }

  const exitGradeSelectBtn = document.getElementById('exit-grade-select-btn');
  if (exitGradeSelectBtn) {
    exitGradeSelectBtn.addEventListener('click', () => {
      state.gradeSelectMode = false;
      state.gradeSelected = {};
      render();
    });
  }

  const deleteSelectedGradesBtn = document.getElementById('delete-selected-grades-btn');
  if (deleteSelectedGradesBtn) {
    deleteSelectedGradesBtn.addEventListener('click', () =>
      safeAsync(() => deleteSelectedGrades(), 'حذف الدرجات المحددة')
    );
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
      // الأوضاع مابتشتغلش مع بعض — عمود الحالة واحد.
      if (state.gradeLabelMode) {
        state.bulkRequestMode = false;
        state.gradeSelectMode = false;
        state.gradeSelected = {};
      }
      saveWorkState();
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
      saveWorkState();
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
      saveWorkState();
      render();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
  });

  // زرار "تم" اللي في الشريط السفلي — بيعمل نفس اللي الزرار اللي فوق بيعمله،
  // عشان تقدر تخرج من وضع التحديد وانت تحت من غير ما تطلع.
  const exitLabelModeBtn = document.getElementById('exit-label-mode-btn');
  if (exitLabelModeBtn) {
    exitLabelModeBtn.addEventListener('click', () => {
      state.gradeLabelMode = false;
      state.gradeLabelQty = {};
      saveWorkState();
      render();
    });
  }

  const exitBulkModeBtn = document.getElementById('exit-bulk-mode-btn');
  if (exitBulkModeBtn) {
    exitBulkModeBtn.addEventListener('click', () => {
      state.bulkRequestMode = false;
      render();
    });
  }

  const clearGradeLabelsBtn = document.getElementById('clear-grade-labels-btn');
  if (clearGradeLabelsBtn) {
    clearGradeLabelsBtn.addEventListener('click', () => {
      state.gradeLabelQty = {};
      saveWorkState();
      render();
    });
  }

  const printGradeLabelsBtn = document.getElementById('print-grade-labels-btn');
  if (printGradeLabelsBtn) {
    printGradeLabelsBtn.addEventListener('click', () => {
      const cat = state.categories.find((c) => c.id === state.activeCategoryId);
      if (!cat) return;
      promptLabelSize((sizeOptions) => safeAsync(() => printGradeLabels(cat, sizeOptions), 'طباعة ملصقات الدرجات'), true);
    });
  }

  const addGradeRangeBtn = document.getElementById('add-grade-range-btn');
  if (addGradeRangeBtn) {
    addGradeRangeBtn.addEventListener('click', () => openAddGradeRangeDialog(state.activeCategoryId));
  }

  const colorGroupsBtn = document.getElementById('color-groups-btn');
  if (colorGroupsBtn) {
    colorGroupsBtn.addEventListener('click', () => openColorGroupsDialog(state.activeCategoryId));
  }

  const bulkBranchQtyBtn = document.getElementById('bulk-branch-qty-btn');
  if (bulkBranchQtyBtn) {
    bulkBranchQtyBtn.addEventListener('click', () => openBulkBranchQtyDialog(state.activeCategoryId));
  }

  const addBaseGradesBtn = document.getElementById('add-base-grades-btn');
  if (addBaseGradesBtn) {
    addBaseGradesBtn.addEventListener('click', () =>
      safeAsync(() => openBaseGradesDialog(state.activeCategoryId), 'إضافة الدرجات الأساسية')
    );
  }

  // ---- ربط الفئة بصنف من قاعدة الأصناف ----
  // بدل ما تكتب الاسم والباركود والسعرين بإيدك، بتدوّر وتختار والخانات
  // بتتملى لوحدها.
  const fillFromProduct = (prefix) => (product) => {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    set(`${prefix}-item-name`, product.name || '');
    set(`${prefix}-barcode`, product.barcode || product.code || '');
    set(`${prefix}-original-price`, product.origPrice || '');
    set(`${prefix}-selling-price`, product.price || '');
    const nameEl = document.getElementById('new-category-name');
    if (prefix === 'new-category' && nameEl && !nameEl.value) nameEl.value = product.name || '';
  };

  const pickNew = document.getElementById('pick-product-new');
  if (pickNew) pickNew.addEventListener('click', () => openProductPicker(fillFromProduct('new-category')));
  const pickEdit = document.getElementById('pick-product-edit');
  if (pickEdit) pickEdit.addEventListener('click', () => openProductPicker(fillFromProduct('edit-category')));

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
  wire('scan-barcode-btn', () => safeAsync(() => openBarcodeScanner(), 'فتح الكاميرا'));
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
      // الفورم بيظهر فوق شاشة الشيتات، فلازم نكون فيها ونقفل الدرج.
      state.screen = 'sheets';
      state.sideMenuOpen = false;
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
      clearDrafts('cat_');
      state.showAddCategoryForm = false;
      render();
    });
  }

  const cancelAddCategory = document.getElementById('cancel-add-category');
  if (cancelAddCategory) {
    cancelAddCategory.addEventListener('click', () => {
      clearDrafts('cat_');
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
      const groupEl = document.getElementById('new-grade-group');
      const group = groupEl ? groupEl.value : '';

      // التكرار بيتحسب جوه المجموعة بس (ترقيم مستقل لكل مجموعة).
      const clash = state.grades.some(
        (g) => !g.isBase && (g.group || '') === group && Number(g.number) === number
      );
      if (clash) {
        alert(`درجة ${number} موجودة خلاص${group ? ` في "${group}"` : ''}.`);
        return;
      }

      await addGrade(state.activeCategoryId, { number, branchQty, mainQty, group });
      clearDrafts('grade_');
      state.showAddGradeForm = false;
      render();
    });
  }

  const cancelAddGrade = document.getElementById('cancel-add-grade');
  if (cancelAddGrade) {
    cancelAddGrade.addEventListener('click', () => {
      clearDrafts('grade_');
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
      promptLabelSize((sizeOptions) => safeAsync(() => printLabel(cat, sizeOptions), 'طباعة الملصق'));
    });
  }

  const printRestockBtn = document.getElementById('print-restock-btn');
  if (printRestockBtn) {
    printRestockBtn.addEventListener('click', () => {
      const cat = state.categories.find((c) => c.id === state.activeCategoryId);
      if (!cat) return;
      safeAsync(() => printRestockPaper(cat, state.grades), 'طباعة ورقة التزويد');
    });
  }

  const printerSettingsBtn = document.getElementById('printer-settings-btn');
  if (printerSettingsBtn) {
    printerSettingsBtn.addEventListener('click', () => {
      safeAsync(() => openPrinterSettings(), 'فتح إعدادات الطابعة');
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

  // التزويد بضغطة واحدة: بينقل الكمية الافتراضية من الرئيسي للفرع فورًا.
  document.querySelectorAll('[data-quick-fulfill-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await fulfillShortage(btn.dataset.quickFulfillId, defaultRestockQty()).catch((err) => {
        btn.disabled = false;
        console.error('فشل التزويد السريع:', err);
        alert('حصلت مشكلة أثناء التزويد. جرّب تاني.');
      });
    });
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

  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', () =>
      safeAsync(async () => {
        undoBtn.disabled = true;
        const msg = await undoLastAction();
        if (msg) alert(msg);
        render();
      }, 'التراجع')
    );
  }

  // الحفظ التلقائي لأي خانة عليها data-draft — بيرجّع اللي كتبته لو
  // التطبيق قفل قبل ما تحفظ.
  wireDraftFields();

  syncStickyOffsets();
  syncActionBarSpacer();
}

// الشريط السفلي ثابت، فبياخد مكانه من فوق المحتوى. بنقيس ارتفاعه الفعلي
// (بيتغيّر لو لفّ على سطرين على شاشة ضيّقة) ونسيب مساحة بقدره تحت القايمة،
// عشان آخر درجة تفضل توصلها وتكتب فيها عادي.
// الشريط العلوي ثابت وارتفاعه بيتغيّر (بيلف على سطرين على شاشة ضيّقة).
// بنقيسه ونحطّه في متغيّر CSS عشان القايمة الجانبية تلزق تحته بالظبط
// مش وراه.
function syncStickyOffsets() {
  const bar = document.querySelector('.topbar');
  if (!bar) return;
  document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight + 'px');
}

function syncActionBarSpacer() {
  const bar = document.getElementById('action-bar');
  const spacer = document.getElementById('action-bar-spacer');
  if (!bar || !spacer) return;
  spacer.style.height = bar.offsetHeight + 16 + 'px';
}

// لو الشاشة اتقلبت أو الحجم اتغيّر، الشريط ممكن يلف على سطرين — نعيد القياس.
window.addEventListener('resize', () => {
  syncStickyOffsets();
  syncActionBarSpacer();
});

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

// ------------------------------------------------------------
// ترتيب الفئات (تحريك فئة لفوق أو لتحت)
// ------------------------------------------------------------
// الفئات بتتقرا من Firestore بـorderBy('order')، فالترتيب بيبقى واحد على
// كل الأجهزة. التحريك = تبديل الفئة مع اللي جنبها، وبعدين إعادة ترقيم
// الترتيب 1..n.
//
// ليه بنعيد الترقيم كله مش بنبدّل رقمين وخلاص؟ لأن الفئات القديمة اللي
// اتضافت قبل ما نضيف حقل order مالهاش رقم أصلًا (بتتحسب صفر)، فتبديل رقمين
// فيهم كان ممكن يسيب فئتين بنفس الرقم والترتيب يبقى عشوائي. إعادة الترقيم
// بتصحّح ده لوحدها من أول تحريكة.
//
// وبنكتب **بس** الفئات اللي رقمها اتغيّر فعلًا — في الحالة العادية دي
// فئتين، مش 26.
async function moveCategory(categoryId, direction) {
  const list = state.categories.slice();
  const i = list.findIndex((c) => c.id === categoryId);
  if (i === -1) return;
  const j = i + direction;
  if (j < 0 || j >= list.length) return;

  const tmp = list[i];
  list[i] = list[j];
  list[j] = tmp;

  const batch = db.batch();
  let writes = 0;
  list.forEach((cat, idx) => {
    const order = idx + 1;
    if ((Number(cat.order) || 0) !== order) {
      batch.update(db.collection('categories').doc(cat.id), { order });
      cat.order = order;
      writes++;
    }
  });

  // الشاشة بتتحدّث فورًا من غير ما تنتظر السحابة — مهم جدًا وانت أوفلاين.
  state.categories = list;
  render();

  if (writes) fireWrite(batch.commit(), 'ترتيب الفئات');
}

// ------------------------------------------------------------
// حذف مجموعة درجات مرة واحدة
// ------------------------------------------------------------
// الفئة فيها 165 درجة. لو عايز تشيل 30 منهم، الحذف درجة درجة معناه 30
// تأكيد و30 ضغطة — فبقى فيه وضع تحديد بيخلّي الحذف ضغطة واحدة.
//
// ⚠️ الحذف الجماعي **مش داخل في التراجع** عن قصد: التراجع مبني على حركة
// واحدة على درجة واحدة، وإرجاع 30 درجة محتاج تأكيد مختلف تمامًا. عشان كده
// التأكيد هنا بيكتب العدد والأسماء قبل أي حذف.
async function deleteSelectedGrades() {
  const ids = Object.keys(state.gradeSelected || {}).filter((id) => state.gradeSelected[id]);
  if (!ids.length) return;

  const categoryId = state.activeCategoryId;
  const chosen = state.grades.filter((g) => ids.includes(g.id));
  if (!chosen.length) return;

  const names = chosen.slice(0, 8).map(gradeDisplayName).join('، ');
  const more = chosen.length > 8 ? ` و${chosen.length - 8} غيرهم` : '';
  const ok = confirm(
    `هتحذف ${chosen.length} درجة نهائيًا:\n${names}${more}\n\n` +
      `الحذف ده مالوش تراجع. تكمّل؟`
  );
  if (!ok) return;

  const gradesRef = db.collection('categories').doc(categoryId).collection('grades');
  // دفعات من 400 — الحد الأقصى للدفعة الواحدة في Firestore هو 500.
  for (let i = 0; i < chosen.length; i += 400) {
    const batch = db.batch();
    chosen.slice(i, i + 400).forEach((g) => batch.delete(gradesRef.doc(g.id)));
    fireWrite(batch.commit(), 'حذف درجات');
  }

  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'delete_grade_bulk',
    categoryId,
    categoryName,
    newValue: chosen.length,
    oldValue: chosen.map(gradeDisplayName).join('، ').slice(0, 400),
  });

  state.gradeSelected = {};
  state.gradeSelectMode = false;
  render();
}

async function addGrade(categoryId, data) {
  const ref = db.collection('categories').doc(categoryId).collection('grades').doc();
  const payload = {
    number: data.number,
    // الافتراضي 1 مش صفر: العرض بياخد قطعة واحدة من كل درجة، والصفر معناه
    // "خلصت من العرض" — فلو بدأنا بصفر كل الدرجات هتتحسب ناقصة من أول يوم.
    branchQty: data.branchQty === undefined ? DEFAULT_RESTOCK_QTY : data.branchQty,
    mainQty: data.mainQty || 0,
    status: 'normal',
  };
  if (data.group) payload.group = data.group;
  if (data.isBase) {
    payload.isBase = true;
    payload.name = data.name;
    payload.criticalQty = Number(data.criticalQty) || DEFAULT_BASE_CRITICAL_QTY;
  }
  fireWrite(ref.set(payload), 'إضافة درجة');
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'add_grade',
    categoryId,
    categoryName,
    gradeId: ref.id,
    gradeNumber: data.name || data.number,
  });
}

// ------------------------------------------------------------
// إضافة الدرجات الأساسية (أبيض/أسود/أوف وايت)
// ------------------------------------------------------------
// بتتضاف لفئة واحدة أو لكل الفئات مرة واحدة. الدالة بتتخطى أي فئة عندها
// الدرجات دي أصلًا، فتقدر تشغّلها كذا مرة من غير ما تتكرر.
async function addBaseGradesToCategory(categoryId, criticalQty) {
  const snap = await db.collection('categories').doc(categoryId).collection('grades').get();
  const existing = new Set(
    snap.docs.map((d) => (d.data().isBase ? String(d.data().name || '') : '')).filter(Boolean)
  );

  const batch = db.batch();
  let added = 0;
  BASE_GRADES.forEach((base) => {
    if (existing.has(base.name)) return;
    const ref = db.collection('categories').doc(categoryId).collection('grades').doc();
    batch.set(ref, {
      number: base.number,
      name: base.name,
      isBase: true,
      criticalQty: Number(criticalQty) || DEFAULT_BASE_CRITICAL_QTY,
      branchQty: DEFAULT_RESTOCK_QTY,
      mainQty: 0,
      status: 'normal',
    });
    added++;
  });

  if (added) await batch.commit();
  return added;
}

// ------------------------------------------------------------
// شاشة مجموعات الألوان
// ------------------------------------------------------------
// بتعمل حاجتين: تعرّف أسماء المجموعات (زي "بيجات" و"ألوان")، وتنقل مدى
// أرقام درجات لمجموعة مرة واحدة — لأن الفئة اللي فيها 165 درجة مستحيل
// تتقسم بالإيد درجة درجة.
function openColorGroupsDialog(categoryId) {
  const cat = state.categories.find((c) => c.id === categoryId);
  if (!cat) return;

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:400px; width:100%; max-height:90vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:6px;">مجموعات الألوان — ${escapeHTML(cat.name)}</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.7; margin-bottom:12px;">
        الفئة الواحدة ممكن تتقسم جواها لمجموعات (زي "بيجات" و"ألوان" في شيتك
        الأصلي). كل مجموعة بتظهر تحت عنوانها في الجدول وفي ورقة التزويد.
      </div>

      <div id="groups-list" style="margin-bottom:12px;"></div>

      <form id="add-group-form" style="display:flex; gap:8px; align-items:flex-end; margin-bottom:16px;">
        <div class="field" style="flex:1; margin-bottom:0;">
          <label>اسم مجموعة جديدة</label>
          <input class="input" id="new-group-name" placeholder="مثال: بيجات" required />
        </div>
        <button class="btn btn-primary" type="submit">إضافة</button>
      </form>

      <div id="assign-box" style="border-top:1px solid var(--border); padding-top:12px;">
        <div style="font-size:13px; font-weight:500; margin-bottom:8px;">نقل درجات لمجموعة</div>
        <div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;">
          <div class="field" style="width:80px; margin-bottom:0;">
            <label>من درجة</label>
            <input class="input" type="number" id="assign-from" min="1" inputmode="numeric" />
          </div>
          <div class="field" style="width:80px; margin-bottom:0;">
            <label>إلى درجة</label>
            <input class="input" type="number" id="assign-to" min="1" inputmode="numeric" />
          </div>
          <div class="field" style="flex:1; min-width:120px; margin-bottom:0;">
            <label>المجموعة</label>
            <select class="input" id="assign-group"></select>
          </div>
          <button class="btn btn-primary" id="assign-btn">نقل</button>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">
          سيب الخانتين فاضيتين لو عايز تنقل كل الدرجات المرقّمة
        </div>
      </div>

      <div id="groups-status" style="font-size:12px; color:var(--text-secondary); margin:10px 0; min-height:16px;"></div>
      <div style="display:flex; justify-content:flex-end;">
        <button class="btn" id="groups-close">إغلاق</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let closed = false;
  const close = () => {
    closed = true;
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  overlay.querySelector('#groups-close').addEventListener('click', close);

  const statusEl = overlay.querySelector('#groups-status');
  const say = (html) => {
    if (!closed) statusEl.innerHTML = html;
  };

  // الفئة بتتحدّث من الاشتراك، فبناخد أحدث نسخة منها في كل رسم
  const currentGroups = () => categoryGroups(state.categories.find((c) => c.id === categoryId));

  const saveGroups = (groups) =>
    fireWrite(
      db.collection('categories').doc(categoryId).update({ colorGroups: groups }),
      'مجموعات الألوان'
    );

  const draw = () => {
    if (closed) return;
    const groups = currentGroups();
    const listEl = overlay.querySelector('#groups-list');

    listEl.innerHTML = groups.length
      ? groups
          .map(
            (name, i) => `
        <div class="home-row" style="padding:7px 0;">
          <div style="flex:1; min-width:0;">
            <div class="home-row-title">${escapeHTML(name)}</div>
            <div class="home-row-sub">${escapeHTML(state.grades.filter((g) => g.group === name).length)} درجة</div>
          </div>
          <button class="btn" style="padding:3px 9px; font-size:11px;" data-group-up="${i}" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn" style="padding:3px 9px; font-size:11px;" data-group-rename="${escapeHTML(name)}">تعديل</button>
          <button class="btn" style="padding:3px 9px; font-size:11px; color:var(--danger-text);" data-group-del="${escapeHTML(name)}">حذف</button>
        </div>`
          )
          .join('')
      : '<div class="home-empty">مفيش مجموعات — الفئة كلها قايمة واحدة.</div>';

    const sel = overlay.querySelector('#assign-group');
    sel.innerHTML =
      `<option value="">— ${escapeHTML(UNGROUPED_LABEL)} —</option>` +
      groups.map((n) => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('');
    overlay.querySelector('#assign-box').style.display = groups.length ? 'block' : 'none';

    listEl.querySelectorAll('[data-group-up]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-group-up'));
        const next = currentGroups();
        [next[i - 1], next[i]] = [next[i], next[i - 1]];
        saveGroups(next);
        setTimeout(draw, 120);
      });
    });

    listEl.querySelectorAll('[data-group-rename]').forEach((btn) => {
      btn.addEventListener('click', () =>
        safeAsync(async () => {
          const oldName = btn.getAttribute('data-group-rename');
          const newName = (prompt('الاسم الجديد للمجموعة:', oldName) || '').trim();
          if (!newName || newName === oldName) return;
          const next = currentGroups().map((n) => (n === oldName ? newName : n));
          saveGroups(next);
          // الدرجات بتتحدّث كمان، وإلا هتفضل مشاورة على اسم مش موجود
          const moved = await assignGroupToGrades(categoryId, null, null, newName, oldName);
          say(`✅ الاسم اتغيّر، و${moved} درجة اتحدّثت.`);
          setTimeout(draw, 150);
        }, 'تعديل اسم المجموعة')
      );
    });

    listEl.querySelectorAll('[data-group-del]').forEach((btn) => {
      btn.addEventListener('click', () =>
        safeAsync(async () => {
          const name = btn.getAttribute('data-group-del');
          if (!confirm(`تحذف مجموعة "${name}"؟ الدرجات مش هتتمسح — هترجع تحت "${UNGROUPED_LABEL}".`)) return;
          saveGroups(currentGroups().filter((n) => n !== name));
          const moved = await assignGroupToGrades(categoryId, null, null, '', name);
          say(`✅ المجموعة اتشالت، و${moved} درجة رجعت من غير مجموعة.`);
          setTimeout(draw, 150);
        }, 'حذف المجموعة')
      );
    });
  };

  overlay.querySelector('#add-group-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = overlay.querySelector('#new-group-name');
    const name = input.value.trim();
    if (!name) return;
    const groups = currentGroups();
    if (groups.includes(name)) {
      say('⚠️ المجموعة دي موجودة خلاص.');
      return;
    }
    saveGroups(groups.concat([name]));
    input.value = '';
    say(`✅ اتضافت مجموعة "${escapeHTML(name)}".`);
    setTimeout(draw, 150);
  });

  overlay.querySelector('#assign-btn').addEventListener('click', () =>
    safeAsync(async () => {
      const from = parseInt(overlay.querySelector('#assign-from').value, 10);
      const to = parseInt(overlay.querySelector('#assign-to').value, 10);
      const group = overlay.querySelector('#assign-group').value;
      const hasRange = !Number.isNaN(from) && !Number.isNaN(to);
      if (hasRange && to < from) {
        say('⚠️ "إلى" لازم يكون أكبر من أو يساوي "من".');
        return;
      }
      say('جارٍ النقل...');
      const n = await assignGroupToGrades(categoryId, hasRange ? from : null, hasRange ? to : null, group, null);
      logActivity({
        action: 'assign_color_group',
        categoryId,
        categoryName: cat.name,
        oldValue: hasRange ? `${from}-${to}` : 'الكل',
        newValue: group || UNGROUPED_LABEL,
      });
      say(`✅ اتنقلت <strong>${n}</strong> درجة لـ"${escapeHTML(group || UNGROUPED_LABEL)}".`);
      setTimeout(draw, 150);
    }, 'نقل الدرجات')
  );

  draw();
}

// بتحدّد المجموعة لمدى أرقام درجات (أو للكل لو from/to فاضيين).
// onlyFromGroup: لو محدّد، بتتغيّر الدرجات اللي مجموعتها الحالية دي بس —
// بيستخدم في إعادة التسمية والحذف.
async function assignGroupToGrades(categoryId, from, to, group, onlyFromGroup) {
  const gradesRef = db.collection('categories').doc(categoryId).collection('grades');
  const snap = await gradesRef.get();

  const targets = snap.docs.filter((d) => {
    const g = d.data();
    if (onlyFromGroup !== null && onlyFromGroup !== undefined) {
      if ((g.group || '') !== onlyFromGroup) return false;
    }
    if (from !== null && to !== null) {
      // الدرجات الأساسية أرقامها سالبة، فمدى الأرقام مايمسّهاش
      const n = Number(g.number);
      if (g.isBase || !Number.isFinite(n) || n < from || n > to) return false;
    }
    return (g.group || '') !== (group || '');
  });

  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    targets.slice(i, i + 400).forEach((d) => batch.update(d.ref, { group: group || '' }));
    await batch.commit();
  }
  return targets.length;
}

// ------------------------------------------------------------
// ظبط كميات الفرع دفعة واحدة
// ------------------------------------------------------------
// المنطق الجديد بيقول "كل درجة عليها قطعة في العرض"، لكن الدرجات القديمة
// كلها متسجّلة بصفر من الاستيراد. تظبيطها بالإيد يعني ضغط + ألفين مرة.
//
// الدالة دي بتظبّطها كلها مرة واحدة، والحالة بترجع "عادي" تلقائيًا لأن
// الكمية بقت أكبر من صفر (نفس قاعدة nextStatusFromQuantities).
async function applyBranchQtyToCategory(categoryId, qty, onlyZeros, includeOut) {
  const gradesRef = db.collection('categories').doc(categoryId).collection('grades');
  const snap = await gradesRef.get();

  const targets = snap.docs.filter((d) => {
    const g = d.data();
    if (!includeOut && g.status === 'out') return false;
    if (onlyZeros && (Number(g.branchQty) || 0) > 0) return false;
    return (Number(g.branchQty) || 0) !== qty || g.status !== 'normal';
  });

  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    targets.slice(i, i + 400).forEach((d) => {
      batch.update(d.ref, { branchQty: qty, status: 'normal' });
    });
    await batch.commit();
  }
  return targets.length;
}

function openBulkBranchQtyDialog(categoryId) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:360px; width:100%; max-height:88vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:6px;">ظبط كميات مخزن الفرع</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.7; margin-bottom:12px;">
        بيحدّد كمية الفرع لكل الدرجات مرة واحدة، والحالة بترجع "عادي" لأن
        الكمية بقت أكبر من صفر.
      </div>

      <div class="field">
        <label>الكمية</label>
        <input class="input" type="number" id="bulk-qty" min="0" max="999" value="1" inputmode="numeric" />
      </div>

      <div class="field" style="margin-bottom:8px;">
        <label style="margin-bottom:8px;">تطبّق على</label>
        <label style="display:flex; gap:8px; align-items:center; font-size:13px; color:var(--text-primary); margin-bottom:6px;">
          <input type="radio" name="bulk-scope" value="zeros" checked /> الدرجات اللي كميتها صفر بس (موصى به)
        </label>
        <label style="display:flex; gap:8px; align-items:center; font-size:13px; color:var(--text-primary);">
          <input type="radio" name="bulk-scope" value="all" /> كل الدرجات (بيستبدل الأرقام الموجودة)
        </label>
      </div>

      <label style="display:flex; gap:8px; align-items:center; font-size:13px; margin-bottom:12px;">
        <input type="checkbox" id="bulk-include-out" />
        اشمل الدرجات المعلّمة "خلصت نهائيًا"
      </label>

      <div id="bulk-status" style="font-size:12px; color:var(--text-secondary); margin-bottom:10px; min-height:16px;"></div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn btn-primary" id="bulk-this">ظبّط الفئة دي</button>
        <button class="btn" id="bulk-all">ظبّط كل الفئات (${escapeHTML(state.categories.length)})</button>
        <button class="btn" id="bulk-cancel">إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let closed = false;
  const close = () => {
    closed = true;
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  const statusEl = overlay.querySelector('#bulk-status');
  const say = (html) => {
    if (!closed) statusEl.innerHTML = html;
  };
  const opts = () => ({
    qty: Math.max(0, Math.min(999, parseInt(overlay.querySelector('#bulk-qty').value, 10) || 0)),
    onlyZeros: overlay.querySelector('input[name="bulk-scope"]:checked').value === 'zeros',
    includeOut: overlay.querySelector('#bulk-include-out').checked,
  });
  const buttons = ['#bulk-this', '#bulk-all', '#bulk-cancel'].map((s) => overlay.querySelector(s));
  const lock = (on) => buttons.forEach((b) => (b.disabled = on));

  overlay.querySelector('#bulk-cancel').addEventListener('click', close);

  overlay.querySelector('#bulk-this').addEventListener('click', () =>
    safeAsync(async () => {
      const { qty, onlyZeros, includeOut } = opts();
      lock(true);
      say('جارٍ التظبيط...');
      const n = await applyBranchQtyToCategory(categoryId, qty, onlyZeros, includeOut);
      logActivity({
        action: 'bulk_branch_qty',
        categoryId,
        categoryName: state.categories.find((c) => c.id === categoryId)?.name || '',
        newValue: n,
      });
      say(`✅ اتظبّطت <strong>${n}</strong> درجة.`);
      lock(false);
    }, 'تظبيط الكميات')
  );

  overlay.querySelector('#bulk-all').addEventListener('click', () =>
    safeAsync(async () => {
      if (!state.isOnline) {
        say('⚠️ العملية دي بتلمس كل الفئات، فمحتاجة إنترنت.');
        return;
      }
      const { qty, onlyZeros, includeOut } = opts();
      if (!confirm(`هيتم تظبيط كمية الفرع على ${qty} في كل الـ${state.categories.length} فئة. أكمل؟`)) return;
      lock(true);
      let total = 0;
      let done = 0;
      for (const cat of state.categories) {
        say(`جارٍ التظبيط... <strong>${done}/${state.categories.length}</strong> فئة، ${total} درجة`);
        total += await applyBranchQtyToCategory(cat.id, qty, onlyZeros, includeOut);
        done++;
        if (closed) return;
      }
      logActivity({ action: 'bulk_branch_qty', newValue: total });
      say(`✅ اتظبّطت <strong>${total}</strong> درجة في ${done} فئة.`);
      lock(false);
    }, 'تظبيط الكميات')
  );
}

async function openBaseGradesDialog(categoryId) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:340px; width:100%;">
      <div style="font-size:15px; font-weight:500; margin-bottom:6px;">الدرجات الأساسية</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.7; margin-bottom:12px;">
        هيتضاف <strong>أبيض</strong> و<strong>أسود</strong> و<strong>أوف وايت</strong> كدرجات
        بأسماء بدل أرقام. أي فئة عندها الدرجات دي خلاص هتتخطّى.
        <br>الدرجات دي <strong>مش بتظهر في ورقة التزويد المطبوعة</strong> لأنها من غير أرقام.
      </div>
      <div class="field">
        <label>الحد الحرج (تنبيه لما تنزل عنه)</label>
        <input class="input" type="number" id="base-critical" min="0" value="${DEFAULT_BASE_CRITICAL_QTY}" />
      </div>
      <div id="base-status" style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;"></div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn btn-primary" id="base-this">ضيفهم للفئة دي بس</button>
        <button class="btn" id="base-all">ضيفهم لكل الفئات (${state.categories.length})</button>
        <button class="btn" id="base-cancel">إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('base-cancel').addEventListener('click', close);
  const statusEl = document.getElementById('base-status');
  const critical = () => Number(document.getElementById('base-critical').value) || DEFAULT_BASE_CRITICAL_QTY;

  document.getElementById('base-this').addEventListener('click', async () => {
    statusEl.textContent = 'جارٍ الإضافة...';
    try {
      const n = await addBaseGradesToCategory(categoryId, critical());
      logActivity({
        action: 'add_base_grades',
        categoryId,
        categoryName: state.categories.find((c) => c.id === categoryId)?.name || '',
        newValue: n,
      });
      close();
    } catch (err) {
      statusEl.textContent = 'فشلت الإضافة: ' + (err.message || err);
    }
  });

  document.getElementById('base-all').addEventListener('click', async () => {
    if (!state.isOnline) {
      statusEl.textContent = '⚠️ العملية دي بتلمس كل الفئات، فمحتاجة إنترنت.';
      return;
    }
    let done = 0;
    let total = 0;
    try {
      for (const cat of state.categories) {
        statusEl.innerHTML = `جارٍ الإضافة... <strong>${done}/${state.categories.length}</strong>`;
        total += await addBaseGradesToCategory(cat.id, critical());
        done++;
      }
      logActivity({ action: 'add_base_grades', newValue: total });
      statusEl.innerHTML = `✅ اتضافت <strong>${total}</strong> درجة أساسية في ${done} فئة.`;
      setTimeout(close, 1500);
    } catch (err) {
      statusEl.textContent = `وقفت عند الفئة رقم ${done + 1}: ` + (err.message || err);
    }
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
        // نسخة النظام الشغّالة على الجهاز ده — بتظهر للي هيبعتله طباعة،
        // عشان لو الجهاز لسه على نسخة قديمة ياخد باله ويحدّثها.
        appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '',
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
            .map((s) => {
              const stale = s.appVersion && s.appVersion !== APP_VERSION;
              return `
            <button class="btn btn-primary" data-target="${escapeHTML(s.id)}">
              ${stale ? '🟡' : '🟢'} ${escapeHTML(s.deviceName || 'جهاز بدون اسم')}
            </button>
            ${
              stale
                ? `<div style="font-size:10px; color:#8a6d1f; margin-top:-4px;">
                     الجهاز ده لسه على نسخة ${escapeHTML(s.appVersion)} — يفضّل تحدّث صفحته
                   </div>`
                : ''
            }`;
            })
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
// html: صفحة واحدة أو مصفوفة صفحات (لـQZ). browserHTML: مستند واحد بفواصل
// صفحات، بيستخدم مع نافذة طباعة المتصفح لأنها بتتعامل مع مستند واحد بس.
// بترجّع true لو الطباعة اتبعتت فعلًا (لطابعة هنا أو لجهاز تاني)، وfalse
// لو المستخدم ألغى أو حصلت مشكلة — الشاشات بتستخدم ده عشان تعرف تفضّي
// السلة ولا لأ.
async function deliverPrint(type, html, sizeOptions, winFeatures, browserHTML) {
  const target = await choosePrintTarget();
  if (target === null) return false;

  if (target !== 'local') {
    await sendPrintJob(type, target, html, sizeOptions, browserHTML);
    return true;
  }

  const printedViaQZ = await tryPrintViaQZ(type, html, sizeOptions);
  if (printedViaQZ) return true;

  const list = normalizePrintJobs(html);
  const single = browserHTML || (list.length ? list[0].html : '');
  if (!single) {
    alert('حصلت مشكلة في تجهيز محتوى الطباعة. حدّث الصفحة وحاول تاني.');
    return false;
  }
  const win = window.open('', '_blank', winFeatures);
  if (!win) {
    alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return false;
  }
  win.document.write(single);
  win.document.close();
  return true;
}

// بنبعت الـHTML جاهز بالكامل (بما فيه صورة الـQR) بدل ما الجهاز المستقبِل
// يعيد بناءه — كده اللي بيتطبع هناك هو **بالظبط** اللي شوفته في المعاينة.
async function sendPrintJob(type, targetDeviceId, html, sizeOptions, browserHTML) {
  const station = (state.printStations || []).find((s) => s.id === targetDeviceId);

  // ⚠️ درس مهم: الجهاز المستقبِل ممكن يكون لسه شغّال على **نسخة أقدم** من
  // النظام (تبويب مفتوح من كام يوم). فالطلب اللي بنسيبه في السحابة لازم
  // يبقى مفهوم للنسخة القديمة كمان:
  //   • html      → نص واحد جاهز (كل النسخ القديمة بتفهمه صح)
  //   • jobs      → القايمة الجديدة بالنسخ (النسخ القديمة بتتجاهلها)
  // كده حتى لو الجهاز التاني ما اتحدّثش، هيطبع ملصق صح مش نص خام.
  const jobs = normalizePrintJobs(html);
  const payload = {
    type,
    targetDeviceId,
    html: browserHTML || (jobs.length ? jobs[0].html : ''),
    jobs,
    senderVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '',
    browserHTML: browserHTML || null,
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
  // jobs هو الشكل الجديد؛ html هو الشكل المتوافق مع النسخ القديمة. لو
  // الطلب جاي من نسخة أقدم، normalizePrintJobs بتفهم أشكالها كلها.
  const list = normalizePrintJobs(job.jobs && job.jobs.length ? job.jobs : job.html);
  if (!list.length) {
    console.error('طلب طباعة محتواه غير صالح — اتلغى:', jobId);
    db.collection('printJobs')
      .doc(jobId)
      .update({ status: 'failed' })
      .catch(() => {});
    return;
  }

  // نجرب QZ Tray الأول (طباعة صامتة فعليًا 100%، من غير أي نافذة أو ضغطة
  // خالص)، ولو مش متاح على الجهاز ده، نرجع لطريقة الـiframe المخفي القديمة
  // (اللي لسه محتاجة ضغطة "طباعة" أخيرة جوه نافذة المتصفح).
  const printedViaQZ = await tryPrintViaQZ(job.type, list, job.sizeOptions);
  if (!printedViaQZ) {
    printHTMLSilently(job.browserHTML || list[0].html);
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
      <div style="margin-bottom:12px; font-size:11px; color:var(--text-secondary); line-height:1.7;">
        المقاس: <strong>38×25 ملم مقسومة نصين</strong> — ده مقاس اللفة اللي عندنا،
        والمحتوى بيتكرر في نصّي اللاصقة.
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:10px;">
        <button class="btn btn-primary" id="size-measured">🖨️ كمّل</button>
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
  //
  // المقاسات التانية (38×25 قطعة واحدة، 38×18، 2×4 إنش) اتشالت خلاص:
  // اللفة اللي في المحل مقاس واحد، والخيارات الزيادة كانت بس فرصة إن حد
  // يختار غلط ويطلع ورق مقصوص. لو جِبنا لفة تانية، يترجّع سطر واحد هنا.
  pick('size-measured', { pageWidthMm: 38, pageHeightMm: 25, halves: 2 });
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

// ============================================================
// ⚠️ درس: تجربة "إعادة رسم الـQR بمربعات متساوية" فشلت على الورق
// ============================================================
// في v0.23.0 عملنا حاجة كانت منطقية على الورق النظري: المكتبة بترسم الكود
// بعرض 200 بكسل على 21 وحدة (9.524 بكسل للوحدة)، فبتقرّب وحدة لـ9 وحدة
// لـ10. فأعدنا رسمه على 399 بكسل (مضاعف دقيق لـ21) عشان كل مربع يطلع
// بنفس الحجم بالظبط.
//
// **والنتيجة الحقيقية كانت أسوأ.** المستخدم قال الباركود بقى أصعب في
// القراءة من قبل.
//
// ليه القياس اللي عملناه كان غلط؟ لأننا حسبنا إن البكسلات اللي في الصورة
// هي اللي بتتطبع. وده مش صحيح: الصورة بتتحط في مربع 10.7 ملم، والطابعة
// الحرارية دقتها 203 نقطة/إنش، يعني المربع كله ~85 نقطة طباعة. فالصورة
// **بتتصغّر** قبل الطباعة:
//   • 200 بكسل → 85 نقطة = تصغير 2.3 مرة
//   • 399 بكسل → 85 نقطة = تصغير 4.7 مرة
//
// وكل ما التصغير يزيد، محرك العرض بيخلط بكسلات أكتر مع بعضها في النقطة
// الواحدة (وساعات بيرمي أعمدة كاملة لو بيستخدم أقرب-جار). فالمربعات
// المتساوية في الصورة الكبيرة ضاعت في التصغير، والنتيجة حروف أوسخ من
// الأصل.
//
// الخلاصة العملية: **حجم الصورة يفضل قريب من عدد نقط الطباعة الفعلية**،
// مش أكبر ما يمكن. وأي "تحسين" للملصق لازم يتجرّب على طابعة حقيقية قبل
// ما يترفع — المحاكاة مش كفاية هنا.

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

  const name = String(cat.itemName || cat.name || '');
  const priceHTML = cat.sellingPrice
    ? `<div class="price"><s>${escapeHTML(cat.originalPrice || 0)} L.E</s><b>${escapeHTML(cat.sellingPrice)} L.E</b></div>`
    : '';

  // هامش أمان رأسي: الطابعة الحرارية بتاكل جزء بسيط من أعلى وأسفل اللاصقة،
  // فبنسيب 0.6مم فاضيين عشان المحتوى ما يخرجش بره حدود الورق.
  const SAFETY_MM = 0.6;
  const pad = 0.4;
  const LINE = 1.2;
  const contentH = halfHeight - pad * 2 - SAFETY_MM;

  // ------------------------------------------------------------
  // ⭐ هامش حقيقي حوالين الـQR — سبب "الباركود متاكل منه حتة"
  // ------------------------------------------------------------
  // قِسنا الشكل القديم: الـQR كان **بالظبط** بمقاس المساحة المتاحة له
  // (فرق 0.002 ملم بس!). يعني صفر تحمّل لأي تقريب.
  //
  // والتقريب حاصل إجباري: محرك العرض بيحوّل الملليمترات لبكسلات، والطابعة
  // بتحوّلها لنقط (0.125 ملم للنقطة الواحدة). أي كسر بيتقرّب، والنتيجة إن
  // صف أو عمود من مربعات الـQR بيتقطع من الحرف.
  //
  // وقطع حرف الـQR مش زي قطع حرف من صورة عادية: الحروف دي هي **نمط
  // التوقيت** اللي القارئ بيبني عليه شبكة المربعات كلها. فقطع صف واحد
  // بيخلي القراءة صعبة جدًا — بالظبط اللي كان بيحصل.
  //
  // الحل: بنقلّل الحشو من 0.6 لـ0.4 ملم (فبتزيد المساحة المتاحة)، وبنسيب
  // 0.4 ملم فاضيين حوالين الـQR. كده حجم المربعات **مايتغيّرش خالص**
  // (نفس 10.7 ملم اللي كانت شغّالة)، بس بقى فيه فسحة تستحمل التقريب.
  const QR_SLACK_MM = 0.4;
  const qrBox = Math.min(contentH - QR_SLACK_MM, 11);
  const textW = pageWidthMm - qrBox - pad * 3;

  // اسم الصنف بيتقاس فعليًا: لو داخل في سطر واحد يبقى سطر، ولو أطول
  // بيتقسم على سطرين بدل ما يتقطع بنقط (...) زي ما كان بيحصل.
  const oneLineFit = fitFontSizeMm(name, textW, true);
  const nameLines = oneLineFit >= 1.9 ? 1 : 2;
  const totalLines = nameLines + 1 + (cat.sellingPrice ? 1 : 0);
  const byHeight = contentH / (totalLines * LINE);

  const nameSize = Math.min(byHeight, 2.7, nameLines === 1 ? oneLineFit : oneLineFit * 1.85);
  const codeSize = Math.min(byHeight, nameSize * 0.9);
  const priceSize = Math.min(byHeight, nameSize * 0.95);

  const qrHTML = qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="">` : '<div class="qr"></div>';

  const halfHTML = `
      <div class="half">
        ${qrHTML}
        <div class="txt">
          <div class="name">${escapeHTML(name)}</div>
          <div class="code">${escapeHTML(cat.barcodeNumber || '')}</div>
          ${priceHTML}
        </div>
      </div>`;

  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ملصق - ${escapeHTML(name)}</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, Helvetica, Tahoma, sans-serif;
          width: ${pageWidthMm}mm;
          color: #000; line-height: ${LINE};
        }
        .label {
          width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;
          overflow: hidden;
        }
        .label + .label { page-break-before: always; break-before: page; }
        .half {
          height: ${halfHeight}mm; width: 100%;
          display: flex; align-items: center; gap: ${pad}mm;
          padding: ${pad}mm ${pad}mm ${pad + SAFETY_MM}mm;
          overflow: hidden;
        }
        .qr { width: ${qrBox}mm; height: ${qrBox}mm; flex: 0 0 ${qrBox}mm; display: block; }
        .txt { flex: 1; min-width: 0; text-align: center; }
        /* الاسم الطويل بيكمّل في سطر تحته بدل ما يتقطع بنقط */
        .name {
          font-size: ${nameSize.toFixed(2)}mm; font-weight: bold;
          overflow-wrap: anywhere; word-break: break-word;
          display: -webkit-box; -webkit-line-clamp: ${nameLines}; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .code { font-size: ${codeSize.toFixed(2)}mm; letter-spacing: 0.15mm; }
        .price { font-size: ${priceSize.toFixed(2)}mm; display: flex; justify-content: center; gap: ${pad * 2}mm; white-space: nowrap; }
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

  // لكل نسخة صفحة مستقلة (مصفوفة) عشان QZ ما يحشرهمش في لاصقة واحدة،
  // ومستند واحد بفواصل صفحات للطريقة العادية (نافذة المتصفح).
  const jobs = [{ html: buildLabelHTML(cat, sizeOptions, qrDataUrl, 1), copies }];
  const fallbackHTML = buildLabelHTML(cat, sizeOptions, qrDataUrl, copies);
  await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', fallbackHTML);
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

// gradeLabel = النص اللي هيتكتب في السطر التاني: "درجة 56" للدرجات
// المرقّمة، أو الاسم نفسه ("أبيض") للدرجات الأساسية.
function buildGradeLabelHTML(categoryName, gradeLabel, sizeOptions, copies) {
  const { pageWidthMm, pageHeightMm, halves } = sizeOptions;
  const halfHeight = pageHeightMm / (halves || 1);
  const copyCount = Math.max(1, Math.min(200, parseInt(copies, 10) || 1));

  // هامش أمان رأسي زي ملصق الصنف — الطابعة بتاكل جزء بسيط من الحواف.
  const SAFETY_MM = 0.6;
  const pad = 0.8;
  const availableW = pageWidthMm - pad * 2;
  const availableH = halfHeight - pad * 2 - SAFETY_MM;

  const line1 = String(categoryName || '');
  const line2 = String(gradeLabel || '');

  // اسم الفئة الطويل بيتقسم على سطرين بدل ما يتقطع أو يخرج بره اللاصقة.
  const LINE = 1.2;
  const oneLineFit = fitFontSizeMm(line1, availableW, true);
  const nameLines = oneLineFit >= 2.4 ? 1 : 2;
  const byHeight = availableH / ((nameLines + 1) * LINE);

  const size1 = Math.min(byHeight, nameLines === 1 ? oneLineFit : oneLineFit * 1.85);
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
      <title>ملصق ${escapeHTML(gradeLabel)}</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Tahoma, Arial, sans-serif; width: ${pageWidthMm}mm; color: #000; }
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; }
        .label + .label { page-break-before: always; break-before: page; }
        .half {
          height: ${halfHeight}mm; width: 100%;
          padding: ${pad}mm ${pad}mm ${pad + SAFETY_MM}mm;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; overflow: hidden;
        }
        .l1, .l2 { font-weight: bold; line-height: ${LINE}; }
        .l1 {
          font-size: ${size1.toFixed(2)}mm;
          overflow-wrap: anywhere; word-break: break-word;
          display: -webkit-box; -webkit-line-clamp: ${nameLines}; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .l2 { white-space: nowrap; }
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
  const previewHTML = buildGradeLabelHTML(cat.name, gradeDisplayName(picks[0].grade), sizeOptions, 1);
  const total = picks.reduce((s, p) => s + p.qty, 0);
  const approved = await showPrintPreview(previewHTML, sizeOptions, total);
  if (!approved) return;

  // كل لاصقة صفحة مستقلة عند QZ (مصفوفة)، عشان ما يحشرش أكتر من واحدة
  // في نفس اللاصقة.
  const jobs = picks.map((p) => ({
    html: buildGradeLabelHTML(cat.name, gradeDisplayName(p.grade), sizeOptions, 1),
    copies: p.qty,
  }));

  // نسخة واحدة بفواصل صفحات لنافذة طباعة المتصفح (بتتعامل مع مستند واحد).
  const bodies = picks.map((p) =>
    extractLabelBody(buildGradeLabelHTML(cat.name, gradeDisplayName(p.grade), sizeOptions, p.qty))
  );
  const shell = buildGradeLabelHTML(cat.name, gradeDisplayName(picks[0].grade), sizeOptions, 1);
  const browserHTML = shell.replace(/<body>[\s\S]*<\/body>/, `<body>${bodies.join('')}</body>`);

  await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', browserHTML);
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
        الأرقام الموجودة <strong>في نفس المجموعة</strong> هيتخطّاها — يعني كل
        مجموعة ترقيمها مستقل وتقدر تبدأ من 1 من جديد.
      </div>
      <div style="display:flex; gap:8px;">
        <div class="field" style="flex:1;"><label>من</label>
          <input class="input" type="number" id="range-from" min="1" inputmode="numeric" /></div>
        <div class="field" style="flex:1;"><label>إلى</label>
          <input class="input" type="number" id="range-to" min="1" inputmode="numeric" /></div>
      </div>
      ${groupSelectHTML('range-group', state.categories.find((c) => c.id === categoryId))}
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

    // ------------------------------------------------------------
    // ⭐ ترقيم مستقل لكل مجموعة
    // ------------------------------------------------------------
    // "الوان" في كريب سادة لازم تقدر تبدأ من 1 حتى لو "بيجات" فيها 1
    // أصلًا — بالظبط زي الشيت الأصلي. فالتكرار بيتحسب **جوه المجموعة
    // المختارة بس**، مش في الفئة كلها.
    const groupEl = document.getElementById('range-group');
    const group = groupEl ? groupEl.value : '';
    const existing = new Set(
      state.grades.filter((g) => (g.group || '') === group).map((g) => Number(g.number))
    );
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
          // نفس منطق الدرجة الواحدة: الفرع بيبدأ بقطعة، مش بصفر.
          const payload = { number, branchQty: DEFAULT_RESTOCK_QTY, mainQty: 0, status: 'normal' };
          if (group) payload.group = group;
          batch.set(gradesRef.doc(), payload);
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
      const where = group ? ` في "${group}"` : '';
      statusEl.style.color = '#2e7d32';
      statusEl.textContent = `✅ اتضافت ${toAdd.length} درجة${where}${skipped ? ` (${skipped} كانوا موجودين)` : ''}.`;
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
    // المعاينة كانت صغيرة أوي على شاشة الكمبيوتر. دلوقتي بنحسب التكبير من
    // المساحة المتاحة فعلًا بدل رقم ثابت — كبيرة على الكمبيوتر ومناسبة
    // على الموبايل، وبحد أقصى عشان ما تبقاش مشوّهة.
    const isNarrow = window.innerWidth <= NARROW_BREAKPOINT;
    // المعاينة على الكمبيوتر كانت صغيرة أوي (نص الملصق مش باين)، فوسّعنا
    // المساحة المتاحة وسقف التكبير على الشاشات الكبيرة.
    const boxW = Math.min(window.innerWidth - 80, isNarrow ? 320 : 820);
    const PX_PER_MM = 3.7795;
    const zoom = Math.min(boxW / (sizeOptions.pageWidthMm * PX_PER_MM), isNarrow ? 4 : 12);
    const shownW = sizeOptions.pageWidthMm * PX_PER_MM * zoom;
    const shownH = sizeOptions.pageHeightMm * PX_PER_MM * zoom;
    const jobList = normalizePrintJobs(html);
    const pages = jobList.reduce((n, j) => n + j.copies, 0) || 1;
    const previewHTML = jobList.length ? jobList[0].html : '';

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="card" style="max-width:${Math.round(shownW) + 60}px; width:100%; text-align:center;">
        <div style="font-size:14px; font-weight:500; margin-bottom:12px;">معاينة الملصق قبل الطباعة</div>
        <!-- ⚠️ الـiframe لازم يبقى position:absolute في الزاوية العليا
             الشمال بالظبط. السبب: الصفحة كلها RTL، فالعنصر العادي بيتحاطط
             من **اليمين**، ولما التكبير بيشتغل من نقطة top left بيمدّ
             المحتوى لبره الحدود اليمين ويسيب فراغ على الشمال — وده اللي كان
             بيخلي المعاينة تبان مقصوصة والاسم مش كامل.
             direction:ltr على الحاوية بتشيل أي انعكاس تاني في المستقبل. -->
        <div style="margin:0 auto 12px; width:${Math.round(shownW)}px; height:${Math.round(shownH)}px;
                    border:1px solid var(--border); background:#fff; overflow:hidden;
                    position:relative; direction:ltr;">
          <iframe id="preview-frame" scrolling="no"
                  style="position:absolute; top:0; left:0;
                         width:${sizeOptions.pageWidthMm}mm; height:${sizeOptions.pageHeightMm}mm; border:0;
                         transform:scale(${zoom}); transform-origin:top left; display:block;"></iframe>
        </div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">
          ${sizeOptions.pageWidthMm}×${sizeOptions.pageHeightMm} ملم${sizeOptions.halves > 1 ? ' — المحتوى بيتكرر في نصّي اللاصقة' : ''}
          ${pages > 1 ? `<br>دي أول لاصقة — هيتطبع <strong>${pages}</strong> لاصقة كل واحدة لوحدها` : ''}
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
    doc.write(previewHTML);
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

// groupName: اسم مجموعة ألوان واحدة عشان تتطبع لوحدها، أو '' للورقة كلها.
function buildRestockHTML(cat, grades, groupName) {
  const now = new Date().toLocaleString('ar-EG');
  // الدرجات الأساسية (أبيض/أسود/أوف وايت) **مابتظهرش في الورقة المطبوعة**:
  // الورقة دي شبكة أرقام بتمشي بيها على الرف، والدرجات دي من غير أرقام
  // أصلًا — فوجودها بيلخبط الشبكة. متابعتها بتبقى من الشاشة.
  const rowHTML = (g) => `
      <div class="row">
        <span class="num">${escapeHTML(g.number)}</span>
        <span class="blank">${g.status === 'out' ? hatchSVG() : ''}</span>
      </div>`;

  const numbered = grades.filter((g) => !g.isBase);

  // مجموعة واحدة: الورقة كلها بقت للمجموعة دي، فاسمها بيروح **للعنوان
  // فوق** (كريب سادة لوكس — بيجات) ومفيش داعي لعنوان جوّه.
  // الورقة الكاملة: كل مجموعة تحت عنوانها، زي شكل الشيت الأصلي.
  const scoped = groupName
    ? numbered.filter((g) => (g.group || UNGROUPED_LABEL) === groupName)
    : numbered;

  const rowsHTML = groupName
    ? `<div class="grid">${scoped.map(rowHTML).join('')}</div>`
    : groupedGrades(scoped, cat)
        .map(
          (section) => `
      ${section.name ? `<div class="group-title">${escapeHTML(section.name)}</div>` : ''}
      <div class="grid">${section.grades.map(rowHTML).join('')}</div>`
        )
        .join('');

  const sheetTitle = groupName ? `${cat.name} — ${groupName}` : cat.name;

  return `
    <!doctype html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>ورقة تزويد - ${escapeHTML(sheetTitle)}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; }
        body { font-family: Tahoma, Arial, sans-serif; font-size: 10px; padding: 1mm; margin: 0; width: 70mm; }
        .header { text-align: center; margin-bottom: 8px; }
        .header .tab-name { font-weight: bold; font-size: 16px; }
        .header .item-name { font-size: 14px; font-weight: bold; color: #000; margin-top: 2px; }
        .header .time { font-size: 11px; font-weight: bold; margin-top: 4px; }
        .grid { column-count: 4; column-gap: 1.5mm; }
        .group-title {
          font-weight: bold; font-size: 12px; text-align: center;
          margin: 4px 0 2px; padding: 1px 0;
          border-top: 1.5px solid #000; border-bottom: 1.5px solid #000;
        }
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
        <div class="tab-name">${escapeHTML(sheetTitle)}</div>
        ${cat.itemName ? `<div class="item-name">${escapeHTML(cat.itemName)}</div>` : ''}
        <div class="time">${escapeHTML(now)}</div>
      </div>
      ${rowsHTML}
      <script>
        window.onload = function () { setTimeout(function () { window.print(); }, 300); };
      <\/script>
    </body>
    </html>
  `;
}

// بيسأل تطبع أنهي مجموعة قبل الطباعة (بس لو الفئة مقسّمة فعلًا).
// بيرجّع '' للورقة كلها، اسم المجموعة لواحدة بعينها، أو null لو ألغى.
function chooseRestockGroup(cat, grades) {
  return new Promise((resolve) => {
    const groups = categoryGroups(cat);
    const numbered = grades.filter((g) => !g.isBase);
    const countOf = (name) => numbered.filter((g) => (g.group || UNGROUPED_LABEL) === name).length;

    // فئة مش مقسّمة → مفيش سؤال، نطبع على طول زي الأول.
    if (!groups.length) {
      resolve('');
      return;
    }

    const options = groups.filter((n) => countOf(n) > 0);
    if (countOf(UNGROUPED_LABEL) > 0) options.push(UNGROUPED_LABEL);
    if (options.length < 2) {
      resolve('');
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="card" style="max-width:340px; width:100%; text-align:center;">
        <div style="font-size:15px; font-weight:500; margin-bottom:4px;">تطبع أنهي جزء؟</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.7;">
          اسم المجموعة هيتكتب في عنوان الورقة
          (مثال: ${escapeHTML(cat.name)} — ${escapeHTML(options[0])})
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          <button class="btn btn-primary" data-rg="">📄 الورقة كلها (${escapeHTML(numbered.length)} درجة)</button>
          ${options
            .map(
              (name) =>
                `<button class="btn" data-rg="${escapeHTML(name)}">${escapeHTML(name)} (${escapeHTML(countOf(name))} درجة)</button>`
            )
            .join('')}
        </div>
        <button class="btn" data-rg-cancel="1">إلغاء</button>
      </div>`;
    document.body.appendChild(overlay);

    const close = (value) => {
      if (overlay.parentNode) document.body.removeChild(overlay);
      resolve(value);
    };
    overlay.querySelectorAll('[data-rg]').forEach((btn) => {
      btn.addEventListener('click', () => close(btn.getAttribute('data-rg')));
    });
    overlay.querySelector('[data-rg-cancel]').addEventListener('click', () => close(null));
  });
}

async function printRestockPaper(cat, grades) {
  const groupName = await chooseRestockGroup(cat, grades);
  if (groupName === null) return;

  const html = buildRestockHTML(cat, grades, groupName);
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

// بتحوّل أي شكل من أشكال محتوى الطباعة لقايمة موحّدة [{ html: نص, copies: رقم }].
// بتقبل: نص واحد، مصفوفة نصوص (شكل نسخة قديمة)، مصفوفة كائنات { html, copies }.
// وبترمي أي عنصر مش نص — عشان مستحيل يوصل لـQZ حاجة تتطبع كنص خام.
function normalizePrintJobs(input) {
  const raw = Array.isArray(input) ? input : [input];
  const out = [];
  raw.forEach((item) => {
    if (typeof item === 'string') {
      out.push({ html: item, copies: 1 });
      return;
    }
    if (item && typeof item.html === 'string') {
      const copies = Math.max(1, Math.min(200, parseInt(item.copies, 10) || 1));
      out.push({ html: item.html, copies });
    }
  });
  return out;
}

// بيرجع true لو نجحت الطباعة عبر QZ Tray، false لو محتاج نرجع للطريقة
// العادية (نافذة المتصفح / iframe).
async function tryPrintViaQZ(type, jobs, sizeOptions) {
  const printerName = getSavedPrinter(type);
  if (!printerName) return false;

  const ok = await ensureQZConnected();
  if (!ok) return false;

  try {
    // ⚠️ قاعدة ذهبية اتعلمناها من طباعتين غلط على التوالي:
    // الحاجة اللي بتتبعت لـQZ في خانة data **لازم تكون نص HTML وبس**.
    // لو بعتنا مصفوفة أو كائن بالغلط، QZ ما بيرفضش — بيحوّله لنص ويطبع
    // النص الخام على اللاصقة (زي [{"html":"\n \n...).
    //
    // عشان كده normalizePrintJobs بترجّع قايمة نضيفة، وتحت السطر ده فيه
    // فحص صارم: لو المحتوى مش نص، بنوقف الطباعة فورًا ونرجع false بدل ما
    // نطبع زبالة على ورق حقيقي.
    const list = normalizePrintJobs(jobs);
    if (!list.length) {
      console.error('محتوى الطباعة غير صالح — مش هيتبعت لـQZ:', jobs);
      return false;
    }

    const size =
      sizeOptions && sizeOptions.pageWidthMm
        ? { width: sizeOptions.pageWidthMm, height: sizeOptions.pageHeightMm }
        : null;

    // نفس شكل الإعداد اللي كان شغال 100% في v0.17 — من غير أي خيارات
    // إضافية. العدد بنعمله بتكرار الطلب نفسه، مش بخيار في الإعداد، عشان
    // ما نعتمدش على سلوك مش متأكدين منه في نسخة QZ اللي على الجهاز.
    const config = qz.configs.create(printerName, size ? { size, units: 'mm' } : {});

    // ------------------------------------------------------------
    // ⭐ كل اللاصقات في **أمر طباعة واحد** مش أمر لكل لاصقة
    // ------------------------------------------------------------
    // المشكلة اللي بيحلها ده: لما كنا بنطبع 40 ملصق، الكود كان بيبعت 40 أمر
    // طباعة مستقل، كل واحد بيستنى الطابعة ترد عليه قبل اللي بعده. الطابعة
    // الحرارية بتاخد كل أمر كـ"وظيفة" لوحدها (تجهيز + معايرة + إنهاء)،
    // فالـ40 ملصق كانوا بياخدوا وقت طويل والطابعة بتفضل واقفة بينهم — وده
    // بالظبط اللي كنت شايفه: "بتفضل تاخد أمر أمر".
    //
    // الصح إن أمر الطباعة الواحد يبقى فيه **كل الصفحات**. QZ بيقبل مصفوفة
    // عناصر، وكل عنصر بيطلع صفحة (لاصقة) في نفس الوظيفة — فالطابعة بتشتغل
    // مرة واحدة متواصلة.
    //
    // ⚠️ شرط لازم يفضل محفوظ: data في كل عنصر **نص HTML وبس**، مش مصفوفة
    // ولا كائن — ده اللي طبع نص خام على اللاصقة قبل كده.
    const pages = [];
    for (const job of list) {
      for (let i = 0; i < job.copies; i++) {
        pages.push({ type: 'pixel', format: 'html', flavor: 'plain', data: job.html });
      }
    }

    // بنقسّم على دفعات عشان ما نبعتش رسالة ضخمة للطابعة مرة واحدة
    // (كل لاصقة فيها صورة QR بالـbase64، فـ200 لاصقة = ميجات).
    const BATCH = 40;
    try {
      for (let i = 0; i < pages.length; i += BATCH) {
        await qz.print(config, pages.slice(i, i + BATCH));
      }
    } catch (errBatch) {
      // لو نسخة QZ أو الطابعة مابتقبلش أكتر من صفحة في الأمر الواحد،
      // بنرجع للطريقة القديمة (واحدة واحدة) — بطيئة بس مضمونة، وأهم حاجة
      // إن المستخدم ما يخرجش من غير ملصقات خالص.
      console.warn('الطباعة المجمّعة مانفعتش — بنرجع لواحدة واحدة:', errBatch);
      for (const page of pages) {
        await qz.print(config, [page]);
      }
    }
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

  // ⚠️ درس اتعلمناه من خطأ حقيقي ظهر على التليفون:
  // البحث عن QZ Tray بياخد كام ثانية (بيحاول يفتح اتصال محلي وميلاقيش).
  // المستخدم بيقفل الشاشة في الوقت ده، وبعدين البحث بيخلص وبيدوّر على
  // عناصر الشاشة اللي **اتشالت خلاص** — فبيرجع null والكود بيقع برسالة
  // Cannot set properties of null.
  //
  // الإصلاح جزئين:
  //   1) نمسك العناصر **قبل** الانتظار، مش بعده
  //   2) لو الشاشة اتقفلت أثناء الانتظار، نخرج بهدوء من غير ما نعمل حاجة
  const statusLine = overlay.querySelector('#qz-status-line');
  const fields = overlay.querySelector('#qz-printer-fields');
  const saveBtn = overlay.querySelector('#qz-settings-save');
  const labelSelect = overlay.querySelector('#qz-label-printer-select');
  const restockSelect = overlay.querySelector('#qz-restock-printer-select');
  const deviceNameInput = overlay.querySelector('#qz-device-name');

  let closed = false;
  const closeSettings = () => {
    closed = true;
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  overlay.querySelector('#qz-settings-close').addEventListener('click', closeSettings);

  const printers = await getAvailableQZPrinters();
  if (closed) return;

  if (!isQZAvailable() || printers.length === 0) {
    statusLine.innerHTML = isQZAvailable()
      ? 'تعذّر الاتصال بـ QZ Tray. تأكد إنه مشغّل على الجهاز ده.'
      : 'برنامج QZ Tray مش مثبّت على الجهاز ده. بدونه، الطباعة هتشتغل بالطريقة العادية (نافذة المتصفح) وهتحتاج تختار الطابعة يدويًا كل مرة.';
    return;
  }

  statusLine.textContent = `متصل بـ QZ Tray — ${printers.length} طابعة موجودة`;
  fields.style.display = 'block';
  saveBtn.style.display = 'inline-block';

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
    closeSettings();
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
  pushUndo({
    label: `${gradeDisplayName(snap.data())} — طلب تزويد`,
    categoryId: state.activeCategoryId,
    gradeId,
    gradeLabel: gradeDisplayName(snap.data()),
    before: { status: snap.data().status || 'normal' },
    after: { status: 'pending' },
  });
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
  pushUndo({
    label: `${gradeDisplayName(snap.data())} — إلغاء طلب التزويد`,
    categoryId: state.activeCategoryId,
    gradeId,
    gradeLabel: gradeDisplayName(snap.data()),
    before: { status: snap.data().status || 'pending' },
    after: { status: 'normal' },
  });
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
  pushUndo({
    label: `${gradeDisplayName(data)} — تزويد بكمية ${transferQty}`,
    categoryId: state.activeCategoryId,
    gradeId,
    gradeLabel: gradeDisplayName(data),
    before: { status: data.status || 'pending', mainQty: data.mainQty || 0, branchQty: data.branchQty || 0 },
    after: { status: 'normal', mainQty: newMainQty, branchQty: newBranchQty },
  });
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
  pushUndo({
    label: `${gradeDisplayName(snap.data())} — خلصت نهائيًا`,
    categoryId: state.activeCategoryId,
    gradeId,
    gradeLabel: gradeDisplayName(snap.data()),
    before: { status: snap.data().status || 'pending' },
    after: { status: 'out' },
  });
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
  pushUndo({
    label: `${gradeDisplayName(snap.data())} — رجّعها متاحة`,
    categoryId: state.activeCategoryId,
    gradeId,
    gradeLabel: gradeDisplayName(snap.data()),
    before: { status: snap.data().status || 'out' },
    after: { status: 'normal' },
  });
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
  const gradeRef = db.collection('categories').doc(categoryId).collection('grades').doc(gradeId);

  // قبل الحذف بناخد نسخة كاملة من الدرجة، عشان التراجع يقدر يرجّعها
  // بكل بياناتها (الكميات والحالة والمجموعة).
  try {
    const snap = await gradeRef.get();
    if (snap.exists) {
      pushUndo({
        type: 'delete',
        label: `حذف ${gradeDisplayName(snap.data())}`,
        categoryId,
        gradeId,
        gradeLabel: gradeDisplayName(snap.data()),
        before: snap.data(),
        after: {},
      });
    }
  } catch (err) {
    console.warn('تعذّر تسجيل الحذف للتراجع:', err);
  }

  fireWrite(gradeRef.delete(), 'حذف درجة');
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
// ------------------------------------------------------------
// تشغيل آمن لأي عملية غير متزامنة جاية من ضغطة زرار
// ------------------------------------------------------------
// أي دالة async بتتنادى من onclick من غير ما حد يمسك فشلها، بيطلع خطأ
// أحمر خام تحت الشاشة مكتوب فيه "Promise: ..." — رسالة إنجليزي مالهاش
// معنى للمستخدم، وساعات بتبقى حاجة مالهاش تأثير أصلًا.
//
// الدالة دي بتمسك أي فشل، بتسجّله في الكونسول للتشخيص، وبتوري رسالة
// عربي مفهومة بس لما يكون فيه فعلًا حاجة وقفت.
function safeAsync(promiseOrFn, label) {
  let promise;
  try {
    promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  } catch (err) {
    console.error(`فشل ${label || 'التنفيذ'}:`, err);
    alert(`حصلت مشكلة أثناء ${label || 'التنفيذ'}. جرّب تاني.`);
    return;
  }
  if (promise && typeof promise.catch === 'function') {
    promise.catch((err) => {
      console.error(`فشل ${label || 'التنفيذ'}:`, err);
      alert(`حصلت مشكلة أثناء ${label || 'التنفيذ'}. جرّب تاني.`);
    });
  }
}

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
  const data = snap.data() || {};
  const update = { [field]: newValue };

  // ⭐ الحالة بتتحدد من الكميات لوحدها (شرح القاعدة عند nextStatusFromQuantities)
  const nextStatus = nextStatusFromQuantities(data, field, newValue);
  if (nextStatus) update.status = nextStatus;

  fireWrite(gradeRef.update(update), 'تعديل كمية');

  // بنسجّل الحركة للتراجع: القيم **قبل** التعديل، واللي كتبناه بعده.
  const fieldLabel = field === 'branchQty' ? 'الفرع' : 'الرئيسي';
  pushUndo({
    label: `${gradeDisplayName(data)} — ${fieldLabel}: ${oldValue} ← ${newValue}`,
    categoryId: state.activeCategoryId,
    gradeId: snap.id,
    gradeLabel: gradeDisplayName(data),
    before: nextStatus
      ? { [field]: oldValue, status: data.status || 'normal' }
      : { [field]: oldValue },
    after: update,
  });

  const categoryName = state.categories.find((c) => c.id === state.activeCategoryId)?.name || '';
  logActivity({
    action: 'edit',
    categoryId: state.activeCategoryId,
    categoryName,
    gradeId: snap.id,
    gradeNumber: data.number,
    field,
    oldValue,
    newValue,
  });

  // نسجّل تغيير الحالة التلقائي كسطر مستقل في السجل، عشان يبان مين
  // العملية اللي سبّبته ومتى — مش يحصل في الخفاء.
  if (nextStatus) {
    const autoAction =
      nextStatus === 'pending'
        ? 'request_shortage'
        : nextStatus === 'out'
          ? 'mark_out_of_stock'
          : 'reset_available';
    logActivity({
      action: autoAction,
      categoryId: state.activeCategoryId,
      categoryName,
      gradeId: snap.id,
      gradeNumber: data.name || data.number,
      auto: true,
    });
  }
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
    workStateRestored = false;

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
      state.lowStockNumbered = {};
      state.lowStockBase = {};
      state.lowStockCount = 0;
      state.sideMenuOpen = false;
      state.categorySearch = '';
      state.categoryFilter = 'all';
      state.gradeFilter = 'all';
      state.gradeGroupFilter = '';
      state.categoryOrderMode = false;
      state.gradeSelectMode = false;
      state.gradeSelected = {};
      state.printCart = [];
      state.printSearch = '';
      state.productSearch = '';
      state.productDept = '';
      state.productSubDept = '';
      state.productPage = 1;
      state.presence = [];
      state.stockTotals = null;
      state.resolvingGradeId = null;
      state.confirmingOutGradeId = null;
      state.bulkRequestMode = false;
      state.loginBusy = false;
      state.loginError = '';
      state.undoCount = 0;
      // الخروج معناه إن حد تاني ممكن يدخل على الجهاز — فمنسيبش تحديداته
      // ولا حركاته القابلة للتراجع لحد تاني.
      clearWorkState();
      clearUndoStack();
      clearDrafts();
      state.view = 'login';
      render();
      return;
    }

    state.view = 'loading';
    render();

    unsubProfile = db.collection('users').doc(user.uid).onSnapshot((snap) => {
      // ⚠️ نقطة اتصلحت من مشكلة حقيقية: النظام كان بيقول "الحساب مالوش
      // صلاحية" لما تقفل النت.
      //
      // السبب: `snap.exists === false` ليها معنيين مختلفين تمامًا:
      //   1) السيرفر ردّ وقال "المستند ده مش موجود"     → مفيش صلاحية فعلًا
      //   2) إحنا أوفلاين والمستند مش في الذاكرة المحلية → **إحنا مش عارفين**
      //
      // والفرق بينهم موجود في snap.metadata.fromCache. الكود القديم كان
      // بيخلط الاتنين، فالحالة التانية كانت بتطلّع رسالة مرعبة غلط.
      //
      // فبقينا نحفظ نسخة من بيانات الحساب محليًا، ونرجع لها في الحالة
      // التانية بدل ما نقول للمستخدم إن حسابه بلا صلاحية.
      if (snap.exists) {
        state.profile = snap.data();
        saveProfileLocally(user.uid, state.profile);
      } else if (snap.metadata && snap.metadata.fromCache) {
        state.profile = loadProfileLocally(user.uid);
      } else {
        // السيرفر أكّد إن المستند مش موجود — دي فعلًا مفيش صلاحية.
        state.profile = null;
        clearProfileLocally(user.uid);
      }

      if (!state.profile) {
        state.view = 'no-profile';
        render();
        return;
      }

      // نرجّع اللي كان الجهاز فاكره: عدد الحركات القابلة للتراجع، وأي
      // تحديدات أو سلة طباعة كانت شغّالة قبل ما التطبيق يقفل.
      state.undoCount = getUndoStack().length;
      if (!workStateRestored) {
        workStateRestored = true;
        const saved = restoreWorkState(user.uid);
        if (saved) {
          if (saved.activeCategoryId) state.activeCategoryId = saved.activeCategoryId;
          state.gradeLabelMode = !!saved.gradeLabelMode;
          state.gradeLabelQty = saved.gradeLabelQty || {};
          state.printCart = saved.printCart || [];
        }
      }

      // موظف الطباعة بيفتح على شاشته على طول ومايقدرش يخرج منها.
      if (isPrintOperator(state.profile)) {
        state.screen = 'print';
        if (!productsCache) loadProducts().then(render).catch((err) => console.warn('تعذّر تحميل الأصناف:', err));
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

      // موظف الطباعة مايحتاجش اشتراكات المخزن (فئات/نواقص/سجل) — شاشته
      // بتقرا الأصناف بس. لكنه محتاج أجهزة الطباعة عشان يقدر يبعت للكاشير.
      if (isPrintOperator(state.profile)) {
        subscribePrintStations();
        subscribePrintJobs();
        startStationHeartbeat();
        return;
      }

      subscribeCategories();
      // لوحة التحكم بتحتاج ملخّص النواقص واللي خلص لكل المستخدمين، وهي
      // نفس البيانات اللي العدّاد البنفسجي بيستخدمها — فاشتراك واحد يكفي.
      subscribeOverview();
      subscribeBaseGrades();
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

// زرار التراجع: بيظهر بس لما يكون فيه حركة تترجع فعلًا، ومكتوب في
// tooltip بتاعه اسم الحركة الأخيرة عشان تعرف انت بترجع عن إيه.
function undoButtonHTML() {
  const n = state.undoCount || 0;
  if (!n) return '';
  const label = lastUndoLabel();
  return `<button class="btn undo-btn" id="undo-btn" title="تراجع عن: ${escapeHTML(label)}">↩️ تراجع</button>`;
}

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
