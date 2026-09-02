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
  moreOpen: false,     // شاشة "⋯ المزيد" (الموبايل بس — على الكمبيوتر القايمة ☰ زي ما هي)
  categorySearch: '', // بحث جوه قايمة الفئات
  categoryFilter: 'all', // all | pending | out | low — فلترة قايمة الفئات
  gradeFilter: 'all', // all | pending | out | low | base — فلترة الدرجات جوه الفئة
  gradeGroupFilter: '', // فلترة بمجموعة الألوان ('' = الكل)
  requestQtyGradeId: null, // الدرجة اللي خانة "اطلب بكمية" مفتوحة عليها
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
  catMoving: null,             // الفئة اللي "ماسكها" في وضع الترتيب
  // شاشة إضافة الدرجة بتفضل مفتوحة بعد الإضافة، فمحتاجة تفتكر:
  lastGradeGroup: '',          // آخر مجموعة اخترتها (عشان ماتختارهاش كل مرة)
  lastAddedGrade: null,        // آخر درجة اتضافت — بتظهر كرسالة تأكيد
  newGradeStartsWithOne: false, // الافتراضي صفر في الفرع، والمفتاح ده بيخلّيه 1
  rangeStartsWithOne: true,     // الإضافة الجماعية: افتراضيها 1 (زي ما كانت قبل ما يبقى فيه اختيار)
  showEditCategoryInfoForm: false,
  pendingCount: 0,
  resolvingGradeId: null,
  confirmingOutGradeId: null,
  isOnline: navigator.onLine,
  hasPendingWrites: false,
  // ⭐ "البيانات جاية من الذاكرة المحلية" = مش واصلين للسيرفر.
  // ده اللي بيقول الحقيقة عن الاتصال، مش navigator.onLine.
  // (الشرح المطوّل عند subscribeOverview في js/dashboard.js)
  fromCache: false,
  bulkRequestMode: false,
  printStations: [], // الأجهزة المسجّلة كنقاط طباعة (اللي عليها QZ Tray وطابعة)
  deviceSettings: {}, // استثناءات إعدادات لكل جهاز — { deviceId: {...} }
  printTab: 'work',  // تاب شاشة الطباعة: 'work' | 'devices'
  users: [], // حسابات المستخدمين (بتتحمّل بس وقت فتح شاشة الحسابات)
  canInstallApp: false, // المتصفح عرض إنه يثبّت النظام كأيقونة
  gradeLabelMode: false, // وضع اختيار درجات لطباعة ملصقاتها
  printingGradeId: null, // الدرجة اللي فاتح عندها خانة عدد الطباعة السريعة
  gradeSearch: '', // بحث برقم الدرجة أو اسمها جوه الفئة
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
// ============================================================
// ⚠️⚠️ علامة التنصيص لازم تتهرّب — وده مش تنظير
// ============================================================
// الطريقة القديمة (textContent → innerHTML) بتهرّب `&` و`<` و`>` **بس**.
// علامة التنصيص `"` بتعدّي زي ما هي.
//
// والنتيجة اتقاست على صنف اسمه `خمار 30" اسدال`:
//
//   data-print-product="خمار 30" اسدال"
//                                ↑ السمة بتقفل هنا
//
// السمة بتتقص عند العلامة، والباقي بيتحوّل لسمات خردة. يعني اسم الصنف
// اللي بيتقرا وقت الطباعة بقى `خمار 30` — **صنف تاني خالص**.
//
// ⚠️ ودي مش حالة نادرة في محل قماش: المقاسات بتتكتب بالبوصة (30" و40")،
// وفي خانة البحث كمان لو كتبت علامة تنصيص.
//
// الإصلاح في **مكان واحد** عن قصد: فيه 327 استخدام للدالة دي في 12 ملف،
// و23 منهم جوّه سمات بتحمل كلام المستخدم. تصليحهم واحد واحد معناه إن أي
// سطر جديد بكرة يرجّع العطل.
//
// ⚠️ والعرض مايتأثرش: `&quot;` جوّه HTML بتتعرض علامة تنصيص عادية.
function escapeHTML(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

// ⚠️ صفر = **من غير تنبيه**، وده الافتراضي عن قصد.
//
// كان 3، والنتيجة إن كل درجة أساسية بتتضاف بتبدأ **منبّهة** من غير ما حد
// يطلب — فالدايرة البرتقالية بتظهر جنب اسم الفئة بعدد الدرجات الأساسية
// وانت لسه مضفتهم دلوقتي. صاحب المحل هو اللي يقرر أنهي درجة تستاهل
// تنبيه، مش النظام.
const DEFAULT_BASE_CRITICAL_QTY = 0;

function gradeDisplayName(g) {
  if (g && g.isBase && g.name) return g.name;
  return `درجة ${g ? g.number : ''}`;
}

// الاسم اللي بيتطبع على ملصق الدرجة. مع خيار "باسم المجموعة" بيبقى
// "كيوي درجة 56" بدل "درجة 56" — عشان لما يبقى فيه أكتر من مجموعة في
// نفس الفئة، الملصق لوحده يقول اللون.
//
// المجموعة بتتحط **قبل** الدرجة عشان دي قراية العربي الطبيعية، ولأن رقم
// الدرجة هو اللي العين بتدوّر عليه فبيفضل في الآخر ثابت المكان.
function gradeLabelText(g, withGroup) {
  const base = gradeDisplayName(g);
  if (!withGroup) return base;
  const group = g && g.group ? String(g.group).trim() : '';
  if (!group || (g && g.isBase)) return base;
  return `${group} ${base}`;
}

// الحد الحرج للدرجة — التنبيه "قرّبت تخلص" بيتحسب منه.
//
// ⭐ الترتيب: حد الدرجة نفسها الأول، وبعدين الافتراضي.
// قبل كده الحد الخاص كان **للدرجات الأساسية بس**، وأي درجة تانية بتاخد
// حد الفئة إجباريًا. لكن اللون بيفرق: لون بيمشي كتير محتاج تنبيه بدري،
// ولون بطيء لأ — والاتنين في نفس الفئة. دلوقتي أي درجة تقدر يبقى ليها
// حدها (⚙️ الفئة ← 🔔 حدود التنبيه)، ولو مالهاش بتاخد حد الفئة.
//
// 0 معناها "من غير تنبيه" وهي قيمة مقصودة — عشان كده بنفرّق بين الصفر
// المكتوب وبين "مافيش قيمة أصلًا" بدل ما نستخدم || على طول.
// ⚠️⚠️ **متستخدمش `Number(x) || DEFAULT` مع الحد الحرج.**
//
// الصفر هنا **قيمة صحيحة** معناها "من غير تنبيه"، و`||` بتبلعه وترجّع
// الافتراضي. ده كان عطل حقيقي: المستخدم يحط صفر، والنظام يفهمها 3،
// والدايرة البرتقالية تفضل ظاهرة وهو مش عارف ليه.
function normalizeCriticalQty(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_BASE_CRITICAL_QTY;
  const n = Number(value);
  return isFinite(n) && n >= 0 ? n : DEFAULT_BASE_CRITICAL_QTY;
}

function gradeCriticalQty(g, cat) {
  const own = g ? g.criticalQty : undefined;
  if (own !== undefined && own !== null && own !== '') return Number(own) || 0;
  if (g && g.isBase) return DEFAULT_BASE_CRITICAL_QTY;
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

// قيمة خاصة في قايمة "من مجموعة" — عشان نفرّق بين "كل المجموعات" (قيمة
// فاضية) و"اللي مالهاش مجموعة" (كمان قيمة فاضية في البيانات نفسها).
const ASSIGN_UNGROUPED = '__ungrouped__';

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

// ============================================================
// ⭐ "إنت واقف في أنهي مجموعة دلوقتي؟"
// ============================================================
// لما تكون فاتح على "بيجات" في كريب سادة وتدوس "إضافة درجة"، المنطقي إن
// المجموعة تبقى **بيجات** جاهزة — إنت أصلًا جوّاها. قبل كده كانت بتفتح
// على آخر مجموعة ضفت فيها (أو على بلا مجموعة في الإضافة الجماعية)،
// فكنت بتختار كل مرة أو — الأسوأ — تضيف في المجموعة الغلط من غير ما تاخد
// بالك.
//
// بترجّع:
//   null → "كل المجموعات" مفتوحة، يعني مافيش مجموعة بعينها إنت جوّاها
//   ''   → واقف على "باقي الدرجات" (اللي مالهاش مجموعة)
//   اسم  → المجموعة دي
//
// ⚠️ الفرق بين null و'' مهم: الاتنين "قيمة فاضية" بس معناهم مختلف تمامًا.
function openGroupScope() {
  const f = state.gradeGroupFilter || '';
  if (!f) return null;
  return f === UNGROUPED_LABEL ? '' : f;
}

// المجموعة اللي المفروض تبقى مختارة في شاشة إضافة درجة: اللي إنت فاتح
// عليها، وإلا آخر واحدة ضفت فيها.
function defaultGroupForAdd() {
  const scope = openGroupScope();
  return scope === null ? state.lastGradeGroup || '' : scope;
}

// خانة اختيار مجموعة — بتظهر بس لو الفئة مقسّمة، فالفورم مايكبرش من غير داعي.
// selected = المجموعة المختارة مسبقًا. بتستخدم عشان الشاشة **تفتكر** آخر
// مجموعة ضفت فيها، فلما تضيف عشر درجات في نفس المجموعة ماتختارهاش عشر مرات.
function groupSelectHTML(id, cat, selected) {
  const groups = categoryGroups(cat);
  if (!groups.length) return '';
  const sel = String(selected == null ? '' : selected);
  const opt = (value, label) =>
    `<option value="${escapeHTML(value)}"${value === sel ? ' selected' : ''}>${escapeHTML(label)}</option>`;
  return `
        <div class="field" style="margin-bottom:0; min-width:120px;">
          <label>المجموعة</label>
          <select class="input" id="${id}">
            ${opt('', `— ${UNGROUPED_LABEL} —`)}
            ${groups.map((n) => opt(n, n)).join('')}
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

// ============================================================
// 📌 الشريط المختصر — بيظهر لما الفلاتر تطلع بره الشاشة
// ============================================================
// المشكلة: الفئة فيها 100+ درجة. أول ما تنزل شوية، سطر المجموعات وسطر
// الحالة بيطلعوا فوق وبتنسى إنت فاتح على "كيوي" ولا على "الكل" — وعشان
// تغيّر لازم ترجع لفوق.
//
// ⚠️ ليه مش جوه شريط التابات نفسه؟ التابات أصلًا بتتزحلق يمين وشمال على
// الموبايل (اسم الفئة ممكن يكون طويل). لو زوّدنا عليها شيبتين، الحاجة
// اللي المفروض تريّحك بتزنق الشريط أكتر. فبقى **سطر رفيع لوحده** بيظهر
// بس وقت الحاجة، وبيختفي أول ما ترجع لفوق.
function stickyContextHTML(cat, counts) {
  const groups = categoryGroups(cat);
  const g = state.gradeGroupFilter || '';
  const f = state.gradeFilter || 'all';
  const statusLabels = {
    all: `الكل (${state.grades.length})`,
    pending: `🟡 معلّق (${counts.pending})`,
    low: `🟠 قرّبت تخلص (${counts.low})`,
    out: `🔴 خلصت (${counts.out})`,
    base: `⚪ الأساسية (${counts.base})`,
  };
  const groupChip = groups.length
    ? `<button class="ctx-chip" id="ctx-group">🎨 ${escapeHTML(g || 'كل المجموعات')} ▾</button>`
    : '';
  return `
    <div class="ctx-bar" id="ctx-bar" hidden>
      <span class="ctx-name">${escapeHTML(cat.name || '')}</span>
      ${groupChip}
      <button class="ctx-chip" id="ctx-status">${escapeHTML(statusLabels[f] || statusLabels.all)} ▾</button>
    </div>`;
}

// ارتفاع اللي ملزوق فوق (الشريط العلوي + التابات) — بيتقاس من العناصر
// نفسها مش برقم مكتوب، لأن الشريط بيكبر ويصغر حسب طول الاسم والشاشة.
function topOffsetPx() {
  // ⚠️⚠️ **كل عنصر ملزوق فوق لازم يتحسب هنا.** ده اتكسر في v0.57.0:
  // التابات اتخبّت على الموبايل واتحطّ مكانها عنوان الشاشة، والدالة
  // كانت لسه بتقيس التابات بس. النتيجة إن العنوان المرتفع (اسم
  // المجموعة والحالة) بقى بيلزق **تحت** عنوان الشاشة ويختفي وراه،
  // فباين إنه مش ثابت خالص.
  // ⚠️ بنقيس offsetHeight — العنصر المخفي بـdisplay:none بيرجّع صفر
  // لوحده، فنفس الكود شغّال على الموبايل والكمبيوتر.
  const visible = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.offsetHeight : 0;
  };
  return visible('.topbar') + visible('.tabs') + visible('.screen-title');
}

// ⚠️ ليه المقاس بيتكتب في متغيّر CSS بدل رقم ثابت في الملف؟
// الشريط المختصر لازم يلزق **تحت التابات بالظبط**. وارتفاع اللي فوقه
// بيتغيّر: اسم الحساب بيطوّل الشريط العلوي، والتابات بتكبر على شاشات
// مختلفة. الرقم الثابت كان بيسيب فتحة أو يغطّي التابات — وده بالظبط
// نفس الغلطة اللي وقعنا فيها قبل كده في الشريط العلوي.
function syncStickyTop() {
  document.documentElement.style.setProperty('--sticky-top', topOffsetPx() + 'px');
}

// قايمة الاختيار اللي بتنزل من شيبة الشريط المختصر.
function openCtxPicker(anchor, items) {
  document.querySelectorAll('.ctx-picker').forEach((x) => x.remove());
  const menu = document.createElement('div');
  menu.className = 'ctx-picker';
  items.forEach((it) => {
    const b = document.createElement('button');
    b.className = 'btn menu-item';
    b.textContent = it.label;
    b.addEventListener('click', () => {
      it.on();
      menu.remove();
      render();
    });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = r.bottom + 4 + 'px';
  // بنثبّتها جوه الشاشة: لو الشيبة على الطرف، القايمة كانت هتخرج بره.
  const w = menu.offsetWidth;
  menu.style.insetInlineStart = Math.max(6, Math.min(r.left, window.innerWidth - w - 6)) + 'px';
  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 0);
}

// ------------------------------------------------------------
// فلترة الدرجات جوه الفئة
// ------------------------------------------------------------
function visibleGrades() {
  const filter = state.gradeFilter || 'all';
  const groupFilter = state.gradeGroupFilter || '';
  const cat = state.categories.find((c) => c.id === state.activeCategoryId) || {};
  const q = normalizeArabic(String(state.gradeSearch || '').trim());

  return state.grades.filter((g) => {
    // ⭐ البحث برقم الدرجة: الفئة فيها 100+ درجة، والوصول لـ"درجة 47" كان
    // نزول بالإصبع. الرقم بيتطابق **بالظبط** مش بالاحتواء — لو كتبت 4
    // مش منطقي يطلعلك 4 و14 و24 و40..49. والاسم (الدرجات الأساسية)
    // بيتطابق بالاحتواء عشان تكتب أول حرفين وخلاص.
    if (q) {
      const num = String(g.number == null ? '' : g.number);
      const name = normalizeArabic(String(g.name || ''));
      const hit = num === q || (name && name.includes(q));
      if (!hit) return false;
    }
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
// ============================================================
// ⌨️ رسم مؤجّل — مانهدّش الشاشة والمستخدم بيكتب
// ============================================================
// ⚠️ المشكلة اللي بيحلها ده (اتبلّغت من الاستخدام الحقيقي):
//
//   "لو فتحت خانة تعديل الكمية وكتبت رقم، وبعدين رحت لدرجة تانية عشان
//    أكتب، الكيبورد بيتخفي لحد ما اللي قبله يترفع."
//
// السبب: اشتراك الدرجات شغّال بـ includeMetadataChanges، يعني بيبلّغنا
// **مرتين** لكل كتابة: مرة أول ما تتكتب محليًا، ومرة تانية لما السيرفر
// يأكّد (بعد ثانية أو اتنين). والتبليغ التاني بيعمل render()، و render()
// بيعمل root.innerHTML = ... يعني **بيهدّ الشاشة كلها** — بما فيها الخانة
// اللي صباعك واقف فيها. والمتصفح بيقفل الكيبورد لما الخانة تتشال.
//
// الحل: التبليغات الجاية من السحابة **بتتأجّل** طول ما المستخدم كاتب في
// خانة، وبتتنفّذ أول ما يسيبها. أما الرسم اللي انت طلبته بنفسك (ضغطت
// زرار) فبيتنفّذ فورًا زي ما هو.
//
// ⚠️ الفرق ده مقصود ومهم: البيانات مابتضيعش — بتتحدّث في state على طول،
// اللي بيتأجّل هو **الرسم** بس.
let dataRenderPending = false;

function isUserTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
  // خانات القراءة فقط مش كتابة
  return !el.disabled && !el.readOnly;
}

// كل تبليغ جاي من السحابة لازم يعدّي من هنا، مش من render() مباشرة.
function renderFromData() {
  if (isUserTyping()) {
    dataRenderPending = true;
    return;
  }
  dataRenderPending = false;
  render();
}

// أول ما يسيب الخانة، بننفّذ اللي اتأجّل.
document.addEventListener(
  'focusout',
  () => {
    if (!dataRenderPending) return;
    // تأخير بسيط عشان لو بينط من خانة لخانة (blur ورا focus على طول)
    // مانرسمش في النص ونقفل الكيبورد بإيدينا.
    setTimeout(() => {
      if (dataRenderPending && !isUserTyping()) {
        dataRenderPending = false;
        render();
      }
    }, 120);
  },
  true
);

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
        <!-- ============================================================
             ⭐ الهوية — الشعار واسم النظام وسطر المطوّر
             ============================================================
             ⚠️ **مافيش اسم محل هنا** عن قصد وبطلب صاحب النظام. الشعار
             واسم النظام وسطر "تطوير وإنشاء" وبس. -->
        <div class="login-brand">
          <div class="login-mark" aria-hidden="true">🧣</div>
          <h1 class="login-name">${escapeHTML(APP_NAME)}</h1>
          <div class="login-by">تطوير وإنشاء · ${escapeHTML(APP_AUTHOR)}</div>
          <div class="login-ver">v${escapeHTML(APP_VERSION)}</div>
        </div>

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
          <div style="position:relative;">
            <input class="input" type="password" id="password" required
                   style="padding-inline-start:42px;" autocomplete="current-password" />
            <button type="button" id="toggle-password" title="إظهار كلمة المرور"
                    aria-label="إظهار كلمة المرور"
                    style="position:absolute; inset-inline-start:4px; top:50%; transform:translateY(-50%);
                           background:none; border:0; cursor:pointer; font-size:16px; line-height:1;
                           padding:6px 8px; color:var(--text-secondary);">👁️</button>
          </div>
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
  // إظهار/إخفاء كلمة المرور. مفيدة بالذات على التليفون: الكيبورد بيخفي
  // الحرف بعد جزء من الثانية، وباسورد غلط بيقفل الحساب مؤقتًا بعد كام
  // محاولة — فالأحسن تشوف اللي كتبته.
  const toggle = document.getElementById('toggle-password');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const pw = document.getElementById('password');
      if (!pw) return;
      const showing = pw.type === 'text';
      pw.type = showing ? 'password' : 'text';
      toggle.textContent = showing ? '👁️' : '🙈';
      toggle.title = showing ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور';
      toggle.setAttribute('aria-label', toggle.title);
      pw.focus();
    });
  }

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

// ------------------------------------------------------------
// ⭐ نقطة التزويد الثابتة — بتفضل باينة في كل الشاشات
// ------------------------------------------------------------
// المشكلة اللي بتحلها: النقط الملوّنة كانت **جوه القايمة الجانبية بس**،
// قدام كل فئة. يعني لازم تفتح القايمة عشان تعرف إن فيه طلب تزويد. ولو
// انت في شاشة تانية خالص، مفيش أي إشارة.
//
// دلوقتي نفس النقطة بتظهر في مكانين ثابتين: جنب اسمك فوق، وعلى زرار
// "الفئات". فطلب التزويد بيفضل قدام عينك مهما كنت فين.
//
// ليه الصفرا بس (مش التلاتة)؟ لأن التلاتة في مكان صغير زي ده بتبقى زحمة
// وبتبطّل تلاحظها. و"خلصت" و"قرّبت تخلص" ليهم مكانهم في لوحة التحكم.
// ============================================================
// ⭐ عنوان الشاشة — اسم الفئة المفتوحة، كامل من غير قص
// ============================================================
// التاب القديم كان بيكتب اسم الفئة و**بيقصّه عند 20 حرف**، وفي الشريط
// التحت العرض أضيق فمكانش هيدخل أصلًا. فالاسم اتنقل هنا: مكان أوسع،
// والاسم كامل.
// ⚠️ بيظهر على الموبايل بس (شوف .screen-title) — على الكمبيوتر التاب
// نفسه بيكتب الاسم وفيه مساحة.
// ============================================================
// ⭐⭐⭐ الطريق الوحيد لتبديل الشاشة. **ماتبدّلش state.screen بإيدك.**
// ============================================================
// ⚠️⚠️ ده اتكسر فعلًا في v0.57.0 وطلع للمحل: الشريط التحت الجديد كان
// بيعمل `state.screen = 'users'; render();` وبس — من غير ما ينادي
// اللي بيحمّل البيانات. النتيجة إن شاشة الحسابات وشاشة الأصناف فضلوا
// **"جارٍ التحميل..." للأبد**.
//
// السبب إن التحميل مربوط بالتنقّل مش بالرسم: الأصناف 46 ألف صنف
// مابيتحمّلوش مع كل تسجيل دخول، والحسابات ليها اشتراك بيتفتح لما
// تحتاجه. فأي طريق جديد للشاشة لازم يعدّي من هنا.
function openScreen(screen) {
  state.screen = screen;
  state.sideMenuOpen = false;
  state.moreOpen = false;
  saveWorkState();
  render();

  // الأصناف بتتحمّل أول ما تحتاجها بس — مش مع كل تسجيل دخول.
  if (screen === 'products' || screen === 'print') {
    if (!productsCache) loadProducts().then(render).catch((err) => console.warn('تعذّر تحميل الأصناف:', err));
  }
  if (screen === 'users') subscribeUsers();
  // أرقام الحركة بتتقرا **مرة** أول ما الشاشة تتفتح — مافيش اشتراك دايم
  // على آلاف المستندات شغّال في الخلفية على الفاضي.
  if (screen === 'movement' && typeof loadMovementStats === 'function') {
    loadMovementStats().then(renderFromData).catch((err) => console.warn('تعذّر تحميل حركة المخزون:', err));
  }
}

function screenTitleHTML(openCatName) {
  const titles = {
    home: '🏠 الرئيسية',
    print: '🏷️ الطباعة',
    products: '📦 الأصناف',
    users: '👥 الحسابات',
    activity: '📋 سجل العمليات',
    movement: '📈 حركة المخزون',
  };
  const t = state.screen === 'sheets' ? (openCatName ? '📄 ' + openCatName : '📄 الشيت') : titles[state.screen];
  if (!t) return '';
  return `<div class="screen-title" id="screen-title">${escapeHTML(t)}</div>`;
}

// ============================================================
// ⭐⭐ شاشة "⋯ المزيد" — الموبايل بس
// ============================================================
// نفس اللي في قايمة ☰ بالظبط + الأصناف والحسابات. **ولا زرار بيتشال**
// ولا اسم بيتغيّر — بس ليهم مكان محترم بدل قايمة صغيرة بتتفتح من ركن
// الشاشة وبتتقفل لو دوست جنبها بالغلط.
//
// ⚠️ الزراير هنا **بتنادي نفس الـid بتاع قايمة ☰** لو موجود، عشان
// مانكرّرش منطق. اللي مالوش نظير (الأصناف/الحسابات) بيبدّل الشاشة.
//
// ⚠️ على الكمبيوتر مابيظهرش خالص — القايمة ☰ زي ما هي.
function moreSheetHTML() {
  const item = (id, label, danger) => `
    <button class="more-item ${danger ? 'more-danger' : ''}" id="${id}">
      <span>${escapeHTML(label)}</span><span class="more-chev">›</span>
    </button>`;
  const group = (title, rows) =>
    rows.filter(Boolean).length ? `<div class="more-group">${escapeHTML(title)}</div>${rows.filter(Boolean).join('')}` : '';

  return `
    <div class="more-sheet ${state.moreOpen ? 'open' : ''}" id="more-sheet">
      <div class="side-head">
        <span>⋯ المزيد</span>
        <button class="btn side-close" id="more-close-btn" aria-label="إغلاق">✕</button>
      </div>
      <div class="more-body">
        ${group('شاشات', [
          can(state.profile, 'viewProducts') ? item('more-products', '📦 الأصناف') : '',
          canManageUsers(state.profile) ? item('more-users', '👥 الحسابات') : '',
          can(state.profile, 'viewActivity') ? item('more-activity', '📋 سجل العمليات') : '',
          can(state.profile, 'viewReports') ? item('more-movement', '📈 حركة المخزون') : '',
        ])}
        ${group('أدوات', [
          isBarcodeScanSupported() ? item('more-scan', '📷 مسح باركود') : '',
          can(state.profile, 'excelTools') ? item('more-import', '📥 استيراد من إكسل') : '',
          can(state.profile, 'excelTools') ? item('more-export', '📤 تصدير نسخة احتياطية') : '',
        ])}
        ${group('إعدادات', [
          item('more-appearance', '🎨 المظهر'),
          restockNotifyMoreItemHTML(),
          state.canInstallApp ? item('more-install', '⬇️ تثبيت التطبيق') : '',
        ])}
        <div class="more-group">&nbsp;</div>
        ${item('more-logout', '🚪 تسجيل خروج', true)}
      </div>
    </div>`;
}

// زرار الإشعارات في "المزيد" — بيقرا نفس حالة الزرار اللي في ☰ عشان
// النص يفضل واحد في المكانين (مفتوح/مقفول/مش مدعوم).
function restockNotifyMoreItemHTML() {
  const raw = typeof restockNotifyButtonHTML === 'function' ? restockNotifyButtonHTML() : '';
  if (!raw) return '';
  const m = raw.match(/>([^<]+)</);
  const label = m ? m[1].trim() : '🔔 إشعارات التزويد';
  return `
    <button class="more-item" id="more-notify">
      <span>${escapeHTML(label)}</span><span class="more-chev">›</span>
    </button>`;
}

function pendingDotHTML(clickable) {
  const n = totalPendingNow();
  if (!n) return '';
  const tag = clickable ? 'button' : 'span';
  const extra = clickable
    ? ' id="pending-dot-btn" title="اعرض الفئات اللي مطلوب تزويدها" style="cursor:pointer;"'
    : '';
  return `<${tag} class="pending-dot"${extra}>${escapeHTML(n)}</${tag}>`;
}

// نفس شرط الأسهم بالظبط: الترتيب بيتحرّك في القايمة الكاملة بس. لو فيه
// فلتر أو بحث، اللي فوق/تحت على الشاشة مش هو اللي فوق/تحت في الحقيقة.
function canReorderNow() {
  return (
    can(state.profile, 'manageCategories') &&
    !!state.categoryOrderMode &&
    (state.categoryFilter || 'all') === 'all' &&
    !normalizeArabic(state.categorySearch || '')
  );
}

function categoryDotsHTML(flags) {
  // ⚠️ لون النص مع كل شارة مش لون واحد للكل: الأبيض على الأصفر تباينه
  // 2.1 (مش مقروء)، والغامق على الأحمر 2.7 (مش مقروء). الشرح والأرقام
  // عند --dot-text في styles.css.
  const dot = (color, title, n, textVar) =>
    `<span title="${escapeHTML(title)}" class="cat-dot" style="background:${color};${
      textVar ? `color:${textVar};` : ''
    }">${escapeHTML(n)}</span>`;
  return [
    flags.pending ? dot('var(--dot-pending)', 'طلبات تزويد معلّقة', flags.pending) : '',
    flags.low ? dot('var(--dot-low)', 'قرّبت تخلص', flags.low) : '',
    flags.out ? dot('var(--dot-out)', 'خلصت نهائيًا', flags.out, 'var(--dot-out-text)') : '',
  ].join('');
}

function sideMenuHTML() {
  const canManageCatalog = can(state.profile, 'manageCategories');
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
               ${
                 state.catMoving
                   ? `<strong style="color:var(--accent);">ماسك: ${escapeHTML((state.categories.find((c) => c.id === state.catMoving) || {}).name || '')}</strong>
                      <br>دوس على المكان اللي عايزها فيه.`
                   : 'دوس على الفئة عشان "تمسكها"، وبعدين دوس على المكان اللي عايزها فيه.'
               }
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
                  // ------------------------------------------------------------
                  // ⭐ الترتيب بضغطتين
                  // ------------------------------------------------------------
                  // الأسهم كانت بتحرّك خانة واحدة، فنقل فئة من آخر 20 فئة
                  // لأولها = 19 ضغطة، والصفحة بترجع لأولها بعد كل ضغطة.
                  //
                  // دلوقتي: دوس على الفئة → بتتمسك، دوس على مكانها → بتروحه.
                  // ضغطتين مهما كانت المسافة. والأسهم سايبينها للتحريك البسيط.
                  if (orderMode) {
                    const held = state.catMoving === cat.id;
                    const moving = !!state.catMoving;
                    return `
            <div class="side-item side-item-order ${held ? 'side-item-held' : ''}"
                 data-cat-row="${escapeHTML(cat.id)}">
              <span class="cat-drag-handle" data-cat-drag="${escapeHTML(cat.id)}"
                    title="امسك واسحب" aria-hidden="true">⠿</span>
              <button class="side-item-grab" data-cat-pick="${escapeHTML(cat.id)}"
                      title="${held ? 'دوس تاني عشان تسيبها' : moving ? 'حطها هنا' : 'امسك الفئة دي'}">
                <span class="side-item-name">${escapeHTML(cat.name)}</span>
                <span style="font-size:11px; color:var(--text-secondary); flex:0 0 auto;">
                  ${held ? '✋ ماسكها' : moving ? '⬇️ حطها هنا' : '↕️'}
                </span>
              </button>
              <span style="display:flex; gap:4px; flex:0 0 auto;">
                <button class="btn" style="padding:2px 8px;" data-cat-move-up="${escapeHTML(cat.id)}"
                        ${canReorder && idx > 0 ? '' : 'disabled'} title="لفوق">▲</button>
                <button class="btn" style="padding:2px 8px;" data-cat-move-down="${escapeHTML(cat.id)}"
                        ${canReorder && idx < list.length - 1 ? '' : 'disabled'} title="لتحت">▼</button>
              </span>
            </div>`;
                  }
                  return `
            <div class="side-item-row">
              <button class="side-item ${cat.id === state.activeCategoryId && state.screen === 'sheets' ? 'side-item-active' : ''}"
                      data-category-id="${escapeHTML(cat.id)}">
                <span class="side-item-name">${escapeHTML(cat.name)}</span>
                <span class="side-item-dots">${categoryDotsHTML(flags)}</span>
              </button>
              ${
                canManageCatalog
                  ? `<button class="side-item-act" data-cat-rename="${escapeHTML(cat.id)}"
                             title="غيّر اسم الفئة" aria-label="غيّر اسم الفئة">✏️</button>`
                  : ''
              }
              ${
                can(state.profile, 'deleteCategories')
                  ? `<button class="side-item-act side-item-del" data-cat-delete="${escapeHTML(cat.id)}"
                             title="احذف الفئة" aria-label="احذف الفئة">🗑️</button>`
                  : ''
              }
            </div>`;
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
  const canManageCatalog = can(state.profile, 'manageCategories');

  // حساب "موظف طباعة" بيفتح على شاشة الطباعة وبس — مفيش شيتات ولا لوحة
  // تحكم ولا قايمة فئات، عشان مايقدرش يلمس المخزن أصلًا.
  if (isPrintOperator(state.profile)) {
    return `
      <div>
        <div class="topbar">
          <div class="topbar-user" style="flex-wrap:wrap;">
            ${/* ⚠️ حساب الطباعة هو **بالظبط** الحساب اللي بيتشارك بين كذا
                  شخص — فالشريحة دي أهم ما تكون هنا. الشريط ده منفصل عن
                  شريط باقي الشاشات، فأي حاجة بتتضاف فوق لازم تتضاف هنا
                  كمان وإلا الحساب الوحيد المحتاجها مايشوفهاش. */ ''}
            <div style="font-size:14px; font-weight:500;">${escapeHTML(state.profile?.name)}</div>
            ${operatorChipHTML()}
            <div style="font-size:12px; color:var(--text-secondary); width:100%;">${escapeHTML(roleLabel)}</div>
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
  } else if (state.screen === 'users') {
    bodyHTML = can(state.profile, 'manageUsers')
      ? usersScreenHTML()
      : `<div class="home-empty" style="padding:2rem; text-align:center;">مالكش صلاحية على الشاشة دي.</div>`;
  } else if (state.screen === 'movement') {
    bodyHTML = can(state.profile, 'viewReports')
      ? movementScreenHTML()
      : `<div class="home-empty" style="padding:2rem; text-align:center;">مالكش صلاحية على الشاشة دي.</div>`;
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
      <button class="tab" id="side-open-btn">📂 الفئات${pendingDotHTML(false)}</button>
      ${navBtn('home', '🏠 الرئيسية')}
      ${navBtn('sheets', sheetTabLabel)}
      ${canUsePrintScreen(state.profile) ? navBtn('print', '🏷️ طباعة') : ''}
      ${can(state.profile, 'viewProducts') ? navBtn('products', '📦 الأصناف') : ''}
      ${can(state.profile, 'manageUsers') ? navBtn('users', '👥 الحسابات') : ''}
    </div>
    ${state.screen === 'sheets' ? addCategoryFormHTML : ''}`;

  // ============================================================
  // ⭐⭐ الشريط التحت — للموبايل بس
  // ============================================================
  // شريط التابات القديم كان عرضه 629 بكسل في شاشة 390، فدايمًا فيه
  // تابين مقصوصين برّه الشاشة وانت مش شايفهم عشان تعرف إنهم موجودين.
  //
  // ⚠️ **خمس بنود مش ستة** عن قصد. "الأصناف" و"الحسابات" بيتفتحوا مرة
  // كل كام يوم، وكمان **مربوطين بالصلاحيات** — يعني الشريط كان هيبقى
  // ٤ بنود عند حد و٦ عند حد تاني. دلوقتي خمسة عند الكل، وشكل النظام
  // واحد لأي مستخدم، والاتنين دول جوّه "المزيد".
  //
  // ⚠️ الشريط ده **مخفي على الكمبيوتر** (شوف .bottom-nav في styles.css).
  // الكمبيوتر عنده مساحة، وشريط التابات الفوقاني بيدخل فيه من غير قص —
  // وده جهاز الطباعة اللي شغله متظبّط عليه، فمش هنغيّر عليه.
  const bottomBtn = (id, icon, label, active, dot) => `
    <button class="bnav-item ${active ? 'on' : ''}" id="${id}">
      <span class="bnav-icon">${icon}</span>${escapeHTML(label)}${dot || ''}
    </button>`;

  const bottomNavHTML = `
    <nav class="bottom-nav" id="bottom-nav">
      ${bottomBtn('bnav-cats', '📂', 'الفئات', state.sideMenuOpen, pendingDotHTML(false))}
      ${bottomBtn('bnav-home', '🏠', 'الرئيسية', state.screen === 'home' && !state.sideMenuOpen && !state.moreOpen)}
      ${bottomBtn('bnav-sheets', '📄', 'الشيت', state.screen === 'sheets' && !state.sideMenuOpen && !state.moreOpen)}
      ${canUsePrintScreen(state.profile)
        ? bottomBtn('bnav-print', '🏷️', 'طباعة', state.screen === 'print' && !state.sideMenuOpen && !state.moreOpen)
        : ''}
      ${bottomBtn('bnav-more', '⋯', 'المزيد', state.moreOpen)}
    </nav>`;

  return `
    <div>
      <div class="topbar">
        <div class="topbar-user">
          <span class="topbar-name">${escapeHTML(state.profile?.name)}</span>
          ${operatorChipHTML()}
          ${pendingDotHTML(true)}
          <span class="topbar-role">${escapeHTML(roleLabel)}</span>
        </div>
        <div class="topbar-meta">
          ${connectionDotHTML()}
          ${undoButtonHTML()}
          ${/* الشارة البنفسجية القديمة اتشالت: كانت بتقول نفس رقم النقطة
                اللي جنب الاسم بالظبط — إشارتين بنفس المعنى جنب بعض
                بتضعّف الاتنين. */ ''}
          <span class="topbar-app">
            <span class="app-name">${escapeHTML(APP_NAME)}</span>
            <span style="color:var(--text-muted);">v${escapeHTML(APP_VERSION)}</span>
          </span>
          <button class="btn menu-toggle" id="menu-toggle-btn" title="القائمة" aria-label="القائمة">☰</button>
          <div class="menu-panel" id="menu-panel">
            ${isBarcodeScanSupported() ? `<button class="btn" id="scan-barcode-btn">📷 مسح باركود</button>` : ''}
            ${can(state.profile, 'excelTools') ? `<button class="btn" id="import-btn">📥 استيراد من إكسل</button>` : ''}
            ${can(state.profile, 'excelTools') ? `<button class="btn" id="export-btn">📤 تصدير نسخة احتياطية</button>` : ''}
            ${canManageUsers(state.profile) ? `<button class="btn" id="users-btn">👥 الحسابات</button>` : ''}
            <button class="btn" id="appearance-btn">🎨 المظهر</button>
            ${state.canInstallApp ? `<button class="btn" id="install-app-btn">⬇️ تثبيت التطبيق</button>` : ''}
            ${restockNotifyButtonHTML()}
            ${can(state.profile, 'viewActivity') ? `<button class="btn" id="activity-log-btn">${state.screen === 'activity' ? '📋 رجوع' : '📋 سجل العمليات'}</button>` : ''}
            ${can(state.profile, 'viewReports') ? `<button class="btn" id="movement-btn">📈 حركة المخزون</button>` : ''}
            <button class="btn" id="logout-btn">🚪 تسجيل خروج</button>
          </div>
        </div>
      </div>
      ${screenTitleHTML(openCatName)}
      ${navRowHTML}
      <button class="to-top" id="to-top-btn" title="ارجع لفوق" aria-label="ارجع لفوق">▲</button>
      <div class="app-body">
        ${sideMenuHTML()}
        <div class="main-area">${bodyHTML}</div>
      </div>
      <div class="side-backdrop ${state.sideMenuOpen ? 'open' : ''}" id="side-backdrop"></div>
      ${moreSheetHTML()}
      ${bottomNavHTML}
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
          type="text"
          inputmode="numeric"
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

  // الأزرار كلها اتنقلت لقايمتين في شريط الأدوات تحت (🖨️ طباعة / ⚙️ الفئة).
  // السطر ده بقى معلومة بس — بتتقرا نادرًا، فمابياخدش مساحة أزرار.
  return `
    <div class="cat-info-line">
      <span>اسم الصنف: <strong>${escapeHTML(cat.itemName || '—')}</strong></span>
      <span>الباركود: <strong>${escapeHTML(cat.barcodeNumber || '—')}</strong></span>
      <span>السعر: <strong>${cat.sellingPrice ? `<s>${escapeHTML(cat.originalPrice || 0)}</s> ${escapeHTML(cat.sellingPrice)}` : '—'}</strong></span>
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
// ============================================================
// ⭐⭐ الطلب اللي إنسان عمله — إنسان بس يلغيه
// ============================================================
// الشكوى اللي أدّت للقاعدة دي: تطلب تزويد لدرجة، وبعدين ترفع كمية الفرع
// (حتى من 2 لـ3) — **والطلب يموت في سكوت**. وأمين الرئيسي مايشوفهوش خالص.
//
// وكان فيه تناقض: النظام **بيسمحلك** تطلب تزويد والفرع فيه كمية (عندك 2
// وعايز 10 كمان)، وبعدين بيهدّ الطلب ده بتعديل مالوش علاقة بيه.
//
// القاعدة دلوقتي بتفرّق بين نوعين من "معلّق":
//
//   بشري  → دوست "طلب تزويد" أو حطّيت كمية بإيدك
//            ← **مايتلغيش** إلا بالتزويد أو الإلغاء أو إن الرئيسي يخلص
//   تلقائي → النظام طلبه لوحده لما كمية الفرع بقت صفر
//            ← يتلغي عادي لو رفعت الكمية (يعني اكتشفت إن الدرجة موجودة)
//
// ⚠️ والطلبات القديمة (اللي اتعملت قبل التحديث ده) مالهاش علامة —
// بنعاملها **بشرية**. الأأمن: أسوأ حالة إنك تلغي طلب بإيدك، بدل إن طلب
// مهم يضيع من غير ما تعرف.
// أقصى كمية للدرجة الواحدة. مش حد مخزون — ده حارس ضد غلطة الصباع:
// 55555555 كانت بتعدّي وتترفع للسحابة.
const MAX_GRADE_QTY = 9999;

// ⭐ الأرقام العربية (٠١٢…) والفارسية (۰۱۲…) → إنجليزي.
// من غيرها، اللي كيبورده عربي بيكتب رقم والنظام بيقراه "مش رقم".
const AR_DIGITS = /[٠-٩۰-۹]/g;
function arabicDigitsToEnglish(text) {
  return String(text == null ? '' : text).replace(AR_DIGITS, (d) => {
    const c = d.charCodeAt(0);
    // ٠ = 0x0660 (عربي-هندي)، ۰ = 0x06F0 (فارسي)
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });
}

function isManualRequest(data) {
  return (data || {}).manualRequest !== false;
}

function nextStatusFromQuantities(data, field, newValue) {
  const branch = field === 'branchQty' ? newValue : Number(data.branchQty) || 0;
  const main = field === 'mainQty' ? newValue : Number(data.mainQty) || 0;
  const current = data.status || 'normal';

  let target;
  if (branch > 0) target = 'normal';
  else if (main > 0) target = 'pending';
  else target = 'out';

  // ⭐ الاستثناء الوحيد: طلب بشري معلّق + دخلت كمية للفرع → سيبه معلّق.
  // (لو الرئيسي خلص، `out` بتعدّي عادي — الطلب مابقاش ينفّذ أصلًا.)
  if (current === 'pending' && target === 'normal' && isManualRequest(data)) return null;

  return target === current ? null : target;
}

// بادج الحالة لوحده. اتفصل عشان أوضاع التزويد والحذف تعرض الحالة كمان:
// الوضعين دول كانوا بيبلعوها خالص، فكنت بتعلّم على درجات من غير ما تعرف
// إنت بتحذف/بتطلب إيه. والدرجة اللي "خلصت نهائيًا" مالهاش مربّع تعليم
// أصلًا — من غير البادج مكانش فيه أي حاجة تقول ليه.
// ⭐ الطلب بكمية أكتر من واحد **لازم يبان مختلف**. من غير ده، أمين
// الرئيسي بيشوف "معلّق" ويزوّد واحدة زي أي طلب — والطلب يتقفل ناقص.
// فالشارة بتقول العدد، وبتاخد شكل مميز (× والعدد) عشان تلفت النظر.
function statusBadgeHTML(g) {
  const n = Number(g && g.requestedQty) || 0;
  const multi = g.status === 'pending' && n > 1;
  const extra = multi
    ? `<span class="badge-qty" title="مطلوب ${escapeHTML(n)} قطعة">×${escapeHTML(n)}</span>`
    : '';
  // ⭐ الطلب بكمية بياخد **لون مختلف**، مش شارة صغيرة وبس. أمين الرئيسي
  // بيمرّ على 80 صف بسرعة، والشارة لوحدها بتعدّي — فبيزوّد واحدة والطلب
  // كان بـ3. (ليه بنفسجي مش برتقالي: البرتقالي هو لون "معلّق" العادي
  // أصلًا، فمش هيفرّق حاجة. الشرح في styles.css)
  const cls = multi ? 'badge-pending-qty' : statusBadgeClass(g.status);
  return `<span class="badge ${cls}">${statusLabel(g.status)}${extra}</span>`;
}

// 🖨️ رمز طباعة مسمّى الدرجة — جنب "طلب تزويد" بالظبط.
// الدوسة الأولى بتفتح خانة العدد جوه الصف (مش شاشة بتفتح)، والتانية
// بتطبع. الافتراضي 1 لأن ده اللي بيحصل في 90% من المرات.
function gradePrintBtnHTML(g) {
  if (!can(state.profile, 'printLabel')) return '';
  if (state.printingGradeId === g.id) {
    return `
      <span class="grade-print-box">
        <input class="input grade-print-qty" type="number" id="grade-print-qty" value="1" min="1" max="1000"
               inputmode="numeric" aria-label="عدد اللاصقات" />
        <button class="btn btn-primary grade-print-go" data-print-grade-go="${escapeHTML(g.id)}" title="اطبع">🖨️</button>
        <button class="btn grade-print-go" data-print-grade-cancel="1" title="إلغاء">✕</button>
      </span>`;
  }
  return `<button class="btn grade-print-btn" data-print-grade-id="${escapeHTML(g.id)}" title="اطبع مسمّى الدرجة دي">🖨️</button>`;
}

// محتوى عمود الحالة من غير <td> — عشان نقدر نستخدمه في الجدول (كمبيوتر)
// وفي الكارت (موبايل) من غير ما نكرر المنطق.
function statusContentHTML(g, canEditBranch, canEditMain) {
  const badge = statusBadgeHTML(g);
  const smallBtn = 'padding:4px 10px; font-size:12px; margin-inline-start:6px;';

  if (g.status === 'normal') {
    if (!canEditBranch) return badge;
    // ⭐ خانة الكمية بتفتح جوه الصف بضغطة "بكمية" — زي رمز الطباعة بالظبط.
    // الطلب العادي (واحد) فاضل ضغطة واحدة زي ما هو، عشان الحالة الغالبة
    // ماتاخدش خطوة زيادة.
    if (state.requestQtyGradeId === g.id) {
      const limit = restockRequestLimit(g);
      return `${badge}
        <form class="req-form" data-req-form-id="${escapeHTML(g.id)}" style="display:inline-flex; gap:4px; align-items:center; flex-wrap:wrap; margin-inline-start:6px;">
          <input class="input" type="number" min="1" max="${escapeHTML(limit)}" value="2"
                 style="width:58px; padding:4px;" id="req-qty-${escapeHTML(g.id)}" inputmode="numeric" required />
          <span style="font-size:11px; color:var(--text-muted);">الرئيسي: ${escapeHTML(limit)}</span>
          <button class="btn btn-primary" type="submit" style="padding:4px 8px; font-size:12px;">اطلب</button>
          <button class="btn" type="button" data-cancel-req-id="${escapeHTML(g.id)}" style="padding:4px 8px; font-size:12px;">رجوع</button>
        </form>`;
    }
    const canAsk = restockRequestLimit(g) > 0;
    let btns = `<button class="btn" style="${smallBtn}" data-request-shortage-id="${escapeHTML(g.id)}">طلب تزويد</button>`;
    // "بكمية" بتظهر بس لو الرئيسي فيه أكتر من واحد — وإلا مالهاش أي معنى
    if (canAsk && restockRequestLimit(g) > 1) {
      btns += `<button class="btn" style="${smallBtn}" data-request-qty-id="${escapeHTML(g.id)}">بكمية</button>`;
    }
    return `${badge}${btns}`;
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
      // ⭐ الزرار بياخد **الكمية اللي اتطلبت فعلًا**، مش الافتراضي.
      // ومحدود بالموجود في الرئيسي: مينفعش يزوّد 3 وهو عنده 2.
      const asked = Number(g.requestedQty) || 0;
      const n = Math.max(1, Math.min(asked > 1 ? asked : defaultRestockQty(), restockRequestLimit(g) || 1));
      extra += `<button class="btn btn-primary" style="${smallBtn}" data-quick-fulfill-id="${escapeHTML(g.id)}" data-quick-fulfill-qty="${escapeHTML(n)}">✅ زوّد ${escapeHTML(n)}</button>`;
      extra += `<button class="btn" style="${smallBtn}" data-open-fulfill-id="${escapeHTML(g.id)}">بكمية تانية</button>`;

      // "مفيش خالص" بقت مش محتاجة ضغطة أصلًا: أول ما كمية الرئيسي تنزل
      // صفر، الحالة بتتحول "خلصت" لوحدها. فالزرار بيظهر بس لو الرقم صفر
      // خلاص والحالة لسه معلّقة (بيانات قديمة). ولو فيه كمية، بنقول
      // للمستخدم الطريقة الصح بدل ما نسيبه يعلن حاجة تخالف الرقم.
      //
      // ⚠️⚠️ **والفرع لازم يكون فاضي كمان** — مش الرئيسي بس.
      // ------------------------------------------------------------
      // العطل اللي خلّى الشرط ده يتضاف (اتعمل واتأكد بالخطوات دي):
      //   1. الفرع صفر والرئيسي 3 → أمين الفرع داس "طلب تزويد"
      //      (الطلب البشري مايتلغيش لوحده — شوف nextStatusFromQuantities)
      //   2. وصلت بضاعة للفرع من بره → الفرع بقى 2، والحالة **فضلت معلّقة**
      //   3. الرئيسي نزل صفر → الحالة **فضلت معلّقة** (نفس القاعدة)
      //   4. دلوقتي الشرط القديم (الرئيسي صفر) بقى متحقق، فزرار "مفيش
      //      خالص" ظهر — والدوسة عليه خلّت الدرجة **"خلصت نهائيًا"
      //      والفرع فيه 2**.
      //
      // ده بيكسر قاعدة النظام الأساسية: **الكمية هي اللي تحدد الحالة**.
      // والدرجة المكسورة بتختفي من ورقة التزويد وبتتعدّ في "خلصت نهائيًا"
      // وهي أصلًا فيها بضاعة.
      const branchLeft = Number(g.branchQty) || 0;
      if ((Number(g.mainQty) || 0) === 0 && branchLeft === 0) {
        extra += `<button class="btn" style="${smallBtn}" data-open-confirm-out-id="${escapeHTML(g.id)}">مفيش خالص</button>`;
      } else if (branchLeft > 0) {
        extra += `<span style="font-size:11px; color:var(--text-muted); margin-inline-start:6px;">لسه في الفرع ${escapeHTML(branchLeft)} — نزّلها صفر الأول</span>`;
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
  return `<td>${statusContentHTML(g, canEditBranch, canEditMain)}${gradePrintBtnHTML(g)}</td>`;
}

// أزرار الكمية من غير <td> — نفس السبب اللي فوق.
function qtyControlsHTML(categoryId, gradeId, field, value, canEdit) {
  if (!canEdit) return `<span class="qty-readonly">${escapeHTML(value ?? 0)}</span>`;
  const attrs = `data-category-id="${escapeHTML(categoryId)}" data-grade-id="${escapeHTML(gradeId)}" data-field="${field}"`;
  return `
    <div class="qty-cell">
      <button class="qty-btn" data-action="dec" ${attrs}>−</button>
      <input class="qty-input" type="text" inputmode="numeric"
             value="${escapeHTML(value ?? 0)}" ${attrs} />
      <button class="qty-btn" data-action="inc" ${attrs}>+</button>
    </div>`;
}

// ------------------------------------------------------------
// عرض الدرجات على الموبايل: كارت لكل درجة بدل صف جدول
// ------------------------------------------------------------
// السبب: خمس أعمدة بمساحات لمس محترمة مش بيدخلوا في عرض 360px — الجدول
// بيطلع 425px ويحتاج سحب أفقي، وعمود الحالة (أهم عمود في الشغل) بيختفي
// بره الشاشة. الكارت بيحل ده: كل حاجة تحت بعضها، مفيش أي سحب.
function gradeCardsHTML(canEditBranch, canEditMain, canDeleteGrades) {
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
                       value="${(state.gradeLabelQty || {})[g.id] || ''}" min="0" max="1000" placeholder="عدد"
                       inputmode="numeric" style="width:72px; padding:6px;" />
              </span>
            </div>`
            : state.gradeSelectMode
              ? `
            <div class="gc-line">
              <span class="gc-label">تحديد للحذف</span>
              <span class="gc-mode-cell">
                ${statusBadgeHTML(g)}
                <input type="checkbox" class="grade-select-checkbox" data-grade-select-id="${escapeHTML(g.id)}"
                       ${(state.gradeSelected || {})[g.id] ? 'checked' : ''} style="width:20px; height:20px;" />
              </span>
            </div>`
            : state.bulkRequestMode
              ? `
            <div class="gc-line">
              <span class="gc-label">طلب تزويد</span>
              <span class="gc-mode-cell">
                ${statusBadgeHTML(g)}
                ${
                  g.status === 'out'
                    ? ''
                    : `<input type="checkbox" class="bulk-request-checkbox" data-bulk-toggle-id="${escapeHTML(g.id)}"
                         ${g.status === 'pending' ? 'checked' : ''} ${canEditBranch ? '' : 'disabled'} />`
                }
              </span>
            </div>`
              : `<div class="gc-status">${statusContentHTML(g, canEditBranch, canEditMain)}${gradePrintBtnHTML(g)}</div>`;

          return `
          <div class="grade-card ${rowClassForStatus(g.status)} ${g.isBase ? 'grade-base' : ''}">
            <div class="gc-head">
              <span class="gc-num">${escapeHTML(gradeDisplayName(g))}</span>
              ${
                canDeleteGrades
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
  // ⭐ كل زرار بقى بمفتاحه هو، مش بـ"صلاحية كاملة" واحدة بتفتح كل حاجة.
  const canAddGrades = can(state.profile, 'addGrades');
  const canDeleteGrades = can(state.profile, 'deleteGrades');
  const canManageCatalog = can(state.profile, 'manageCategories');

  const infoBarHTML = categoryInfoBarHTML();

  // "تزويد" مش "طلب تزويد": الاسم القصير هو اللي خلّى الأربع زراير يدخلوا
  // في سطر واحد على الموبايل (القياس في styles.css عند .toolbar-row).
  const bulkToggleBtn = canEditBranch
    ? `<button class="btn ${state.bulkRequestMode ? 'btn-primary' : ''}" id="toggle-bulk-request-btn">${state.bulkRequestMode ? '✔️ تم' : '📋 تزويد'}</button>`
    : '';

  // وضع ملصقات الدرجات مكانه جوه قايمة الطباعة، **إلا** وانت جواه — ساعتها
  // بيطلع برّه كزرار خروج، عشان ما تضطرش تفتح قايمة عشان تخرج من وضع.
  const labelModeBtn = state.gradeLabelMode
    ? `<button class="btn btn-primary" id="toggle-grade-label-btn">✔️ تم</button>`
    : '';

  // زي وضع الملصقات بالظبط: مكانه جوه قايمة الفئة، وبيطلع برّه **بس** وانت
  // جواه كزرار خروج. حذف الدرجات حاجة نادرة ومالهاش رجعة — إنها تاخد خطوة
  // زيادة ده مكسب مش خسارة. و"تزويد" (اللي بتضغطه كل يوم) فضل دوسة واحدة.
  const selectModeBtn =
    canDeleteGrades && state.gradeSelectMode
      ? `<button class="btn btn-primary" id="toggle-grade-select-btn">✔️ تم</button>`
      : '';

  // ⚠️⚠️ الزرار ده كان بيختفي أول ما المجموعة تاخد درجاتها الأساسية —
  // والمنطق ده كان صح لما الشاشة كانت بتعمل حاجة واحدة بس: تضيف التلاتة
  // الجاهزين (أبيض/أسود/أوف وايت). خلاص ضفتهم؟ يبقى مالهاش لازمة.
  //
  // بس من v0.43.0 الشاشة بقت بتعمل حاجة تانية كمان: **إضافة درجة أساسية
  // باسم من عندك**. والحاجة دي مالهاش آخر — ممكن تضيف "أوف وايت غامق"
  // النهاردة و"بيج فاتح" بكرة.
  //
  // فالإخفاء بقى بيقفل الباب على الخاصية الجديدة بالظبط في الفئات اللي
  // **أكتر حاجة محتاجاها** (اللي عندها أساسية خلاص). الزرار بقى ظاهر
  // دايمًا، والشاشة نفسها بتقول لو التلاتة الجاهزين موجودين.
  const baseScope = openGroupScope() ?? '';
  const hasBaseHere = state.grades.some((g) => g.isBase && (g.group || '') === baseScope);

  // ------------------------------------------------------------
  // ⭐ الزراير اتجمّعت في قايمتين بدل 8 زراير متناثرة
  // ------------------------------------------------------------
  // الشريط كان فيه لحد 8 زراير في صف واحد، وعلى الموبايل كانوا بيلفّوا على
  // تلات صفوف ويبلعوا نص الشاشة. والزراير اللي بتتضغط كل يوم (التزويد
  // والطباعة والتحديد) كانت مختلطة باللي بتتضغط مرة في الشهر (مجموعات
  // الألوان، حذف الفئة).
  //
  // دلوقتي: **اللي بتستخدمه كل يوم ظاهر**، والباقي جوه قايمتين.
  // وحذف الفئة اتشال من هنا خالص — مكانه بقى قايمة الفئات، عشان تحذف من
  // بره الفئة مش وانت جواها.
  const addMenuItems = [
    canAddGrades ? `<button class="btn menu-item" id="add-grade-btn">➕ درجة واحدة</button>` : '',
    canAddGrades ? `<button class="btn menu-item" id="add-grade-range-btn">➕ درجات دفعة</button>` : '',
    canAddGrades ? `<button class="btn menu-item" id="add-base-grades-btn">⚪ الدرجات الأساسية</button>` : '',
  ].filter(Boolean);

  const catMenuItems = [
    canManageCatalog ? `<button class="btn menu-item" id="edit-category-info-btn">✏️ بيانات الفئة</button>` : '',
    canManageCatalog ? `<button class="btn menu-item" id="color-groups-btn">🎨 مجموعات الألوان</button>` : '',
    canEditBranch ? `<button class="btn menu-item" id="bulk-branch-qty-btn">⬆️ ظبط كميات الفرع</button>` : '',
    canEditBranch ? `<button class="btn menu-item" id="critical-qty-btn">🔔 حدود التنبيه</button>` : '',
    canDeleteGrades && !state.gradeSelectMode
      ? `<button class="btn menu-item" id="toggle-grade-select-btn">☑️ تحديد للحذف</button>`
      : '',
  ].filter(Boolean);

  // ------------------------------------------------------------
  // ⭐ الطباعة كلها في قايمة واحدة
  // ------------------------------------------------------------
  // كان فيه 3 زراير طباعة + إعدادات الطابعة، متفرّقين على سطر البيانات
  // وشريط الأدوات — أربع حاجات بتعمل نفس نوع الشغل في مكانين مختلفين.
  const printMenuItems = [
    can(state.profile, 'printLabel') ? `<button class="btn menu-item" id="print-label-btn">🏷️ ملصق الصنف</button>` : '',
    can(state.profile, 'printRestock') ? `<button class="btn menu-item" id="print-restock-btn">📄 ورقة التزويد</button>` : '',
    can(state.profile, 'printLabel') && !state.gradeLabelMode
      ? `<button class="btn menu-item" id="toggle-grade-label-btn">🏷️ ملصقات الدرجات</button>`
      : '',
    can(state.profile, 'printLabel') ? `<button class="btn menu-item" id="print-custom-btn">✍️ طباعة مسمّى</button>` : '',
    can(state.profile, 'printerSetup') ? `<button class="btn menu-item" id="printer-settings-btn">⚙️ إعدادات الطابعة</button>` : '',
  ].filter(Boolean);

  const dropdown = (id, label, items) =>
    items.length
      ? `<span class="tool-menu">
           <button class="btn" id="${id}-btn" aria-haspopup="true">${label} ▾</button>
           <span class="tool-menu-panel" id="${id}-panel">${items.join('')}</span>
         </span>`
      : '';

  // ⭐ وانت جوه وضع (تحديد / ملصقات / تزويد)، الشريط بيبقى **زرار الخروج
  // بس**. السبب: الوضع بيعمل حاجة واحدة، وأوامره كلها في الشريط السفلي
  // خلاص — والزراير التانية مالهاش معنى دلوقتي (مش هتضيف درجة وإنت في
  // نص تحديد درجات للحذف). وده كمان اللي بيضمن إن الشريط يفضل سطر واحد،
  // لأن زرار الخروج كان بيبقى خامس زرار فيلفّ السطر.
  // زرار الخروج بتاع **الوضع الشغّال هو بس** — مش التلاتة.
  const exitBtn = state.gradeSelectMode ? selectModeBtn : state.gradeLabelMode ? labelModeBtn : bulkToggleBtn;
  const inMode = state.gradeSelectMode || state.gradeLabelMode || state.bulkRequestMode;
  const toolbarHTML = inMode
    ? `<div class="toolbar-row">${exitBtn}</div>`
    : `
    <div class="toolbar-row">
      ${dropdown('tool-print', '🖨️ طباعة', printMenuItems)}
      ${bulkToggleBtn}
      ${dropdown('tool-add', '➕ إضافة', addMenuItems)}
      ${dropdown('tool-cat', '⚙️ الفئة', catMenuItems)}
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

  const searchVal = String(state.gradeSearch || '');
  const filterBarHTML = `
    <div class="grade-search-row">
      <input class="input grade-search" id="grade-search" inputmode="search"
             value="${escapeHTML(searchVal)}" placeholder="🔎 رقم الدرجة أو اسمها..." />
      ${searchVal ? `<button class="btn grade-search-clear" id="grade-search-clear" title="مسح البحث">✕</button>` : ''}
    </div>
    <div class="filter-row" id="grade-filter-row">
      ${gchip('all', 'الكل', state.grades.length)}
      ${gchip('pending', '🟡 معلّق', counts.pending)}
      ${gchip('low', '🟠 قرّبت تخلص', counts.low)}
      ${gchip('out', '🔴 خلصت', counts.out)}
      ${counts.base ? gchip('base', '⚪ الأساسية', counts.base) : ''}
    </div>
    ${groupFilterBarHTML(cat)}
    ${stickyContextHTML(cat, counts)}`;

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

  // ⭐ الكمية الافتراضية للدرجة الجديدة.
  // كانت 1 في الفرع دايمًا. بس الاستخدام الحقيقي إنك بتضيف الدرجة **قبل**
  // ما تعدّها، فالصفر أصح كبداية. واللي بيضيف وهو ماسك البضاعة يقدر يقلب
  // المفتاح ويخلّيها 1.
  const startWithOne = !!state.newGradeStartsWithOne;
  const lastAdded = state.lastAddedGrade;

  const addGradeFormHTML = state.showAddGradeForm
    ? `
    <div class="card" style="margin-bottom:0.75rem; padding:1rem;">
      ${
        lastAdded
          ? `<div style="font-size:12px; color:var(--ok); margin-bottom:8px;">
               ✅ اتضافت درجة ${escapeHTML(lastAdded.number)}${lastAdded.group ? ` في "${escapeHTML(lastAdded.group)}"` : ''} — كمّل
             </div>`
          : ''
      }
      <form id="add-grade-form" style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
        <div class="field" style="margin-bottom:0;"><label>الدرجة (رقم)</label><input class="input" style="width:90px;" type="number" id="new-grade-number" data-draft="grade_num" required /></div>
        <div class="field" style="margin-bottom:0;"><label>الفرع</label><input class="input" style="width:70px;" type="number" id="new-grade-branch" value="${startWithOne ? 1 : 0}" /></div>
        <div class="field" style="margin-bottom:0;"><label>الرئيسي</label><input class="input" style="width:70px;" type="number" id="new-grade-main" value="0" /></div>
        ${groupSelectHTML('new-grade-group', cat, defaultGroupForAdd())}
        <button class="btn btn-primary" type="submit">إضافة</button>
        <button class="btn" type="button" id="cancel-add-grade">إغلاق</button>
      </form>
      <label style="display:flex; gap:6px; align-items:center; margin-top:10px; font-size:12px; cursor:pointer; color:var(--text-secondary);">
        <input type="checkbox" id="grade-start-one" ${startWithOne ? 'checked' : ''} />
        ابدأ الدرجة الجديدة بـ 1 في الفرع (بدل صفر)
      </label>
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
                 value="${qty || ''}" min="0" max="1000" placeholder="عدد" inputmode="numeric"
                 style="width:62px; display:inline-block; margin-inline-start:6px; padding:3px 6px; font-size:12px;" />
        </td>`;
    }
    if (state.gradeSelectMode) {
      return `
        <td>
          <span class="gc-mode-cell">
            ${statusBadgeHTML(g)}
            <input type="checkbox" class="grade-select-checkbox" data-grade-select-id="${escapeHTML(g.id)}"
                   ${(state.gradeSelected || {})[g.id] ? 'checked' : ''} style="width:18px; height:18px;" />
          </span>
        </td>`;
    }
    if (!state.bulkRequestMode) return statusCellHTML(g, canEditBranch, canEditMain);
    const checked = g.status === 'pending' ? 'checked' : '';
    const disabled = canEditBranch ? '' : 'disabled';
    return `
      <td>
        <span class="gc-mode-cell">
          ${statusBadgeHTML(g)}
          ${
            g.status === 'out'
              ? ''
              : `<input type="checkbox" class="bulk-request-checkbox" data-bulk-toggle-id="${escapeHTML(g.id)}" ${checked} ${disabled} style="width:18px; height:18px;" />`
          }
        </span>
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
        ${canDeleteGrades ? `<td><button class="btn" style="padding:4px 10px; font-size:12px;" data-delete-grade-id="${escapeHTML(g.id)}" data-delete-grade-number="${escapeHTML(gradeDisplayName(g))}">حذف</button></td>` : ''}
      </tr>`;

  // لو الفئة مقسّمة لمجموعات ألوان، كل مجموعة بيتحطّ قبلها صف عنوان
  // بيمتد على عرض الجدول كله.
  const colCount = 4 + (canDeleteGrades ? 1 : 0);
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
      shownGrades.length ? gradeCardsHTML(canEditBranch, canEditMain, canDeleteGrades) : emptyFilterHTML
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
            ${canDeleteGrades ? '<th class="sticky-th"></th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${spacerHTML}${actionBarHTML}`;
}

// ============================================================
// ⭐ أقسام السجل
// ============================================================
// التقسيمة مبنية على **إيه اللي بيتعمل فعلًا في المحل**، مش على أسماء
// العمليات في الكود. صاحب المحل بيفكر بالشكل ده:
//   • غيّرت كميات؟   • زوّدت حاجة؟   • ضفت؟   • حذفت؟   • عدّلت بيانات؟
//
// ⚠️ الطباعة بتتسجّل **سطر واحد للطبعة كلها**، مش سطر لكل ملصق —
// طبعة 100 ملصق كانت هتبقى 100 سطر وتغرق السجل. (شوف logPrintJob)
const LOG_KINDS = [
  { key: 'qty',     icon: '📦', label: 'الكميات',  actions: ['edit', 'bulk_branch_qty'] },
  { key: 'restock', icon: '🔄', label: 'التزويد',  actions: ['request_shortage', 'cancel_shortage', 'fulfill_shortage', 'mark_out_of_stock', 'reset_available'] },
  { key: 'add',     icon: '➕', label: 'إضافة',    actions: ['add_category', 'add_grade', 'add_base_grades'] },
  { key: 'del',     icon: '🗑️', label: 'حذف',      actions: ['delete_category', 'delete_grade'] },
  { key: 'info',    icon: '⚙️', label: 'بيانات',   actions: ['edit_category_info', 'set_critical_qty'] },
  { key: 'print',   icon: '🖨️', label: 'طباعة',    actions: ['print'] },
  // ⚠️ العمليتين دول كانوا **مالهمش قسم ولا نص** — فكانوا بيطلعوا في
  // السجل ككارت فاضي فيه الاسم والوقت وبس، ومحدش يقدر يخفيهم.
  { key: 'admin',   icon: '👥', label: 'الإدارة',   actions: ['edit_user', 'import_products'] },
];

const LOG_KIND_OF = {};
LOG_KINDS.forEach((k) => k.actions.forEach((a) => (LOG_KIND_OF[a] = k.key)));

const LOG_KINDS_STORE = 'tazweed_log_kinds';
const LOG_DAYS_STORE = 'tazweed_log_days';
const LOG_TAB_STORE = 'tazweed_log_tab';
const LOG_DAY_CHOICES = [3, 7, 30, 0]; // 0 = من غير حد

// ============================================================
// ⭐ التابات — والشيك بوكس فاضلة جوه "الكل"
// ============================================================
// ليه الاتنين مع بعض؟ لأنهم بيخدموا سؤالين مختلفين:
//
//   • "وريني الطباعة بس"        → تاب. ضغطة واحدة.
//   • "وريني الكميات والتزويد"  → شيك بوكس. تجميعة.
//
// الشكل القديم كان الشيك بوكس بس، فالسؤال الأول — وهو الأكتر — كان
// بيتكلّف **٥ ضغطات** (تشيل العلامة عن ٥ أقسام) وبعدين ٥ تانيين ترجّعهم.
//
// فبقى: تاب لكل قسم للعزل السريع، وتاب "الكل" فيه الشيك بوكس للتجميعة.
const LOG_TAB_ALL = 'all';

function getLogTab() {
  try {
    const v = localStorage.getItem(LOG_TAB_STORE);
    if (v && (v === LOG_TAB_ALL || LOG_KINDS.some((k) => k.key === v))) return v;
  } catch (err) {
    /* التخزين مقفول */
  }
  return LOG_TAB_ALL;
}

function setLogTab(key) {
  try {
    localStorage.setItem(LOG_TAB_STORE, key);
  } catch (err) {
    /* التخزين مقفول */
  }
}

// الأقسام المعروضة — الافتراضي كلها
function getLogKinds() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KINDS_STORE));
    if (Array.isArray(raw)) {
      const valid = raw.filter((k) => LOG_KINDS.some((x) => x.key === k));
      // ⚠️ لو المستخدم شال الكل، بنرجّع الكل بدل شاشة فاضية مالهاش معنى
      return valid.length ? valid : LOG_KINDS.map((k) => k.key);
    }
  } catch (err) {
    /* قيمة تالفة — الافتراضي */
  }
  return LOG_KINDS.map((k) => k.key);
}

function setLogKinds(list) {
  try {
    localStorage.setItem(LOG_KINDS_STORE, JSON.stringify(list));
  } catch (err) {
    /* التخزين مقفول */
  }
}

// عدد الأيام المعروضة — الافتراضي 3
function getLogDays() {
  const raw = parseInt(localStorage.getItem(LOG_DAYS_STORE), 10);
  return LOG_DAY_CHOICES.includes(raw) ? raw : 3;
}

function setLogDays(n) {
  const v = parseInt(n, 10);
  if (LOG_DAY_CHOICES.includes(v)) localStorage.setItem(LOG_DAYS_STORE, String(v));
}

// ============================================================
// سطر السجل — الوصف بيتحسب مرة واحدة للجدول وللكارت
// ============================================================
// ⚠️ الوصف ده كان مكتوب **جوّه** بنّاء الجدول. لما بقى فيه شكلين (جدول
// على الكمبيوتر وكارتس على الموبايل) كان لازم يتنقل بره، وإلا التلاتين
// حالة دول يتكتبوا مرتين ويفترقوا مع أول تعديل.
function activityEntryParts(entry) {
  const when = entry.timestamp && entry.timestamp.toDate ? entry.timestamp.toDate().toLocaleString('ar-EG') : '—';
  const cat = escapeHTML(entry.categoryName || '');
  const grade = `${cat} — درجة ${escapeHTML(entry.gradeNumber)}`;
  let itemLabel = '';
  let detailLabel = '';

  if (entry.action === 'edit') {
    const fieldLabel = entry.field === 'branchQty' ? 'مخزن الفرع' : entry.field === 'mainQty' ? 'المخزن الرئيسي' : entry.field || '';
    itemLabel = grade;
    detailLabel = `${escapeHTML(fieldLabel)}: ${escapeHTML(entry.oldValue)} ← ${escapeHTML(entry.newValue)}`;
  } else if (entry.action === 'add_category') {
    itemLabel = cat;
    detailLabel = 'إضافة فئة جديدة';
  } else if (entry.action === 'delete_category') {
    itemLabel = cat;
    detailLabel = 'حذف فئة بالكامل';
  } else if (entry.action === 'add_grade') {
    itemLabel = grade;
    detailLabel = 'إضافة درجة جديدة';
  } else if (entry.action === 'delete_grade') {
    itemLabel = grade;
    detailLabel = 'حذف درجة';
  } else if (entry.action === 'edit_category_info') {
    itemLabel = escapeHTML(entry.itemName || '');
    detailLabel = `تعديل بيانات الصنف (باركود: ${escapeHTML(entry.barcodeNumber || '—')})`;
  } else if (entry.action === 'request_shortage') {
    itemLabel = grade;
    detailLabel = 'طلب تزويد (خلصت من الفرع)';
  } else if (entry.action === 'cancel_shortage') {
    itemLabel = grade;
    detailLabel = 'إلغاء طلب التزويد';
  } else if (entry.action === 'fulfill_shortage') {
    itemLabel = grade;
    detailLabel = `تزويد بكمية ${escapeHTML(entry.transferredQty)}`;
  } else if (entry.action === 'mark_out_of_stock') {
    itemLabel = grade;
    detailLabel = 'خلصت نهائيًا من الفرع والرئيسي';
  } else if (entry.action === 'reset_available') {
    itemLabel = grade;
    detailLabel = 'رجّعت متاحة (وصل تزويد جديد)';
  } else if (entry.action === 'add_base_grades') {
    itemLabel = escapeHTML(entry.categoryName || 'كل الفئات');
    detailLabel = `إضافة ${escapeHTML(entry.newValue)} درجة أساسية`;
  } else if (entry.action === 'bulk_branch_qty') {
    itemLabel = escapeHTML(entry.categoryName || 'كل الفئات');
    detailLabel = `ظبط كميات الفرع (${escapeHTML(entry.newValue)} درجة)`;
  } else if (entry.action === 'set_critical_qty') {
    itemLabel = cat;
    detailLabel = `تعديل حدود التنبيه (${escapeHTML(entry.newValue)} درجة)`;
  } else if (entry.action === 'print') {
    itemLabel = escapeHTML(entry.itemName || cat || '');
    const n = Number(entry.newValue) || 0;
    detailLabel = `${escapeHTML(entry.printLabel || 'طباعة')}${n > 1 ? ` — ${escapeHTML(n)} ملصق` : ''}`;
  } else if (entry.action === 'import_products') {
    itemLabel = '';
    detailLabel = `📁 تحديث ملف الأصناف — ${escapeHTML(Number(entry.newValue) || 0)} صنف`;
  } else if (entry.action === 'edit_user') {
    itemLabel = escapeHTML(entry.categoryName || '');
    const r = ROLE_LABELS_AR[entry.newValue] || entry.newValue || '';
    detailLabel = `تعديل حساب${r ? ` — الرتبة: ${escapeHTML(r)}` : ''}`;
  }

  // ============================================================
  // ⭐ شبكة أمان: عملية مالهاش نص = كارت فاضي
  // ============================================================
  // ⚠️ ده حصل فعلًا مع `edit_user` و`import_products`: العملية بتتسجّل،
  // والسطر بيطلع فيه الاسم والوقت **وبس** — مفيش أي كلام. المستخدم شاف
  // سطرين فاضيين في السجل ومعرفش إيه ده.
  //
  // فبدل ما نعتمد على إن كل عملية جديدة حد هيفتكر يكتب لها نص، أي عملية
  // مانعرفهاش بتطلع باسمها الخام. وحش شوية، بس **بيتقرا** — والفاضي لأ.
  if (!detailLabel) detailLabel = escapeHTML(entry.action || 'عملية غير معروفة');

  return { when, itemLabel, detailLabel };
}

function activityLogHTML() {
  const kinds = getLogKinds();
  const tab = getLogTab();
  const days = getLogDays();
  const cutoff = days ? Date.now() - days * 86400000 : 0;

  const all = state.activityLog || [];
  const rows = all.filter((e) => {
    const kind = LOG_KIND_OF[e.action];
    // تاب قسم معيّن = القسم ده بس، والشيك بوكس مالهاش دعوة.
    // ⚠️ العملية اللي مالهاش قسم (حاجة جديدة اتضافت ونسينا نصنّفها)
    // بتظهر في "الكل" بس — أحسن من إنها تختفي خالص.
    if (tab !== LOG_TAB_ALL) {
      if (kind !== tab) return false;
    } else if (kind && kinds.indexOf(kind) === -1) {
      return false;
    }
    if (!cutoff) return true;
    // ⭐ السطر اللي لسه مترفعش بيفضل ظاهر مهما كانت المدة — ده اللي
    // انت لسه عامله وانت مفصول، وأكتر حاجة محتاج تتطمّن إنها اتسجّلت.
    if (e.pending) return true;
    const t = e.timestamp && e.timestamp.toDate ? e.timestamp.toDate().getTime() : 0;
    return t >= cutoff;
  });

  const counts = {};
  LOG_KINDS.forEach((k) => (counts[k.key] = 0));
  all.forEach((e) => {
    const k = LOG_KIND_OF[e.action];
    if (k) counts[k]++;
  });
  const pendingCount = all.filter((e) => e.pending).length;

  const dayLabel = (n) => (n === 0 ? 'الكل' : n === 3 ? '٣ أيام' : n === 7 ? 'أسبوع' : 'شهر');

  const toolbar = `
    <div class="card log-tools">
      <div class="log-row">
        <span class="log-lbl">يعرض</span>
        <div class="log-days">
          ${LOG_DAY_CHOICES.map(
            (n) => `<button type="button" class="log-day ${n === days ? 'on' : ''}" data-log-days="${n}">${dayLabel(n)}</button>`
          ).join('')}
        </div>
        <button class="btn log-refresh" id="log-refresh">🔄 حدّث</button>
      </div>

      <div class="log-tabs" role="tablist">
        <button type="button" class="log-tab ${tab === LOG_TAB_ALL ? 'on' : ''}" role="tab"
                aria-selected="${tab === LOG_TAB_ALL}" data-log-tab="${LOG_TAB_ALL}">
          الكل <span class="log-count">${escapeHTML(all.length)}</span>
        </button>
        ${LOG_KINDS.map(
          (k) => `
          <button type="button" class="log-tab ${tab === k.key ? 'on' : ''}" role="tab"
                  aria-selected="${tab === k.key}" data-log-tab="${k.key}">
            ${k.icon} ${escapeHTML(k.label)} <span class="log-count">${escapeHTML(counts[k.key])}</span>
          </button>`
        ).join('')}
      </div>

      ${
        // الشيك بوكس بتبان في "الكل" بس — هي أداة تجميعة، ومالهاش أي
        // معنى وانت واقف على قسم واحد.
        tab === LOG_TAB_ALL
          ? `<div class="log-kinds">
        ${LOG_KINDS.map(
          (k) => `
          <label class="log-kind ${kinds.indexOf(k.key) > -1 ? 'on' : ''}">
            <input type="checkbox" data-log-kind="${k.key}" ${kinds.indexOf(k.key) > -1 ? 'checked' : ''} />
            <span>${k.icon} ${escapeHTML(k.label)}</span>
            <span class="log-count">${escapeHTML(counts[k.key])}</span>
          </label>`
        ).join('')}
      </div>`
          : ''
      }

      <div class="log-note">
        ${tab === LOG_TAB_ALL
          ? 'دوس على تاب عشان تشوف قسم لوحده، أو شيل العلامة من تحت عشان تشوف كذا قسم مع بعض. اختيارك بيتحفظ.'
          : 'دوس <strong>الكل</strong> عشان ترجّع باقي الأقسام.'}
        ${pendingCount ? `<br>⏳ <strong>${escapeHTML(pendingCount)}</strong> عملية لسه مترفعتش — محفوظة على الجهاز وهترفع أول ما النت يرجع.` : ''}
      </div>
    </div>`;

  if (!rows.length) {
    return `${toolbar}<div class="home-empty" style="padding:2rem; text-align:center;">${
      all.length ? 'مفيش عمليات في المدة/الأقسام دي.' : 'لا يوجد أي عمليات مسجّلة بعد.'
    }</div>`;
  }

  // ============================================================
  // كارتس على الموبايل — الجدول كان ٤ أعمدة بتتزحلق يمين وشمال
  // ============================================================
  // "الوقت" أطول عمود فيهم (تاريخ + ساعة بالعربي)، وكان بياكل نص عرض
  // الشاشة ويسيب "العملية" — اللي هي أهم عمود — مقصوصة.
  if (state.isNarrow) {
    const cards = rows
      .map((entry) => {
        const { when, itemLabel, detailLabel } = activityEntryParts(entry);
        return `
        <div class="${entry.pending ? 'grade-card act-pending' : 'grade-card'}">
          <div class="act-what">${detailLabel}${entry.pending ? '<span class="act-wait">⏳ لسه مترفعش</span>' : ''}</div>
          ${itemLabel ? `<div class="act-item">${itemLabel}</div>` : ''}
          <div class="act-meta">
            <span>👤 ${escapeHTML(entryWho(entry))}</span>
            <span>${escapeHTML(when)}</span>
          </div>
        </div>`;
      })
      .join('');
    return `${toolbar}<div class="grade-cards">${cards}</div>`;
  }

  const trs = rows
    .map((entry) => {
      const { when, itemLabel, detailLabel } = activityEntryParts(entry);
      return `
        <tr class="${entry.pending ? 'act-pending' : ''}">
          <td>${escapeHTML(when)}${entry.pending ? ' <span class="act-wait">⏳</span>' : ''}</td>
          <td>${escapeHTML(entryWho(entry))}</td>
          <td>${itemLabel}</td>
          <td>${detailLabel}</td>
        </tr>`;
    })
    .join('');

  return `
    ${toolbar}
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
        <tbody>${trs}</tbody>
      </table>
    </div>`;
}

function attachActivityLogEvents() {
  document.querySelectorAll('[data-log-days]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLogDays(btn.getAttribute('data-log-days'));
      renderFromData();
    });
  });

  document.querySelectorAll('[data-log-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLogTab(btn.getAttribute('data-log-tab'));
      renderFromData();
    });
  });

  document.querySelectorAll('[data-log-kind]').forEach((box) => {
    box.addEventListener('change', () => {
      const on = [...document.querySelectorAll('[data-log-kind]')]
        .filter((b) => b.checked)
        .map((b) => b.getAttribute('data-log-kind'));
      setLogKinds(on);
      renderFromData();
    });
  });

  const refresh = document.getElementById('log-refresh');
  if (refresh) {
    refresh.addEventListener('click', () => {
      refresh.disabled = true;
      refresh.textContent = '🔄 بيحدّث…';
      // الاشتراك لايف أصلًا، فده بيعيد فتحه عشان يجيب أحدث لقطة
      subscribeActivityLog();
      setTimeout(renderFromData, 400);
    });
  }
}

// ------------------------------------------------------------
// ⭐ الفلتر بيمشي معاك من القايمة الجانبية لجوه الفئة
// ------------------------------------------------------------
// المشكلة اللي بيحلها: بتشوف نقطة صفراء مكتوب فيها 1 قدام الفئة، تدخل
// عليها وتلاقي 24 درجة كلها عادية — والدرجة المطلوبة ضايعة بينهم، أو
// أسوأ: تلاقي "مفيش درجات بالفلتر ده" لأن فيه فلتر قديم لسه شغّال من
// فئة قبلها.
//
// النقطة الصفراء معناها "هنا فيه طلب تزويد"، فلما تضغط عليها المفروض
// توديك على الطلب ده مباشرة — مش تسيبك تدوّر.
function gradeFilterForEntry() {
  const f = state.categoryFilter || 'all';
  return f === 'pending' || f === 'out' || f === 'low' ? f : 'all';
}

function openCategory(categoryId) {
  const cameFromElsewhere = state.screen !== 'sheets';
  state.screen = 'sheets';
  state.sideMenuOpen = false;
  if (categoryId === state.activeCategoryId) {
    // نفس الفئة: برضه بنظبّط الفلتر ونرسم — من غير كده الضغطة كانت
    // مابتعملش أي حاجة، والفلتر القديم يفضل مخبّي كل حاجة.
    state.gradeFilter = gradeFilterForEntry();
    state.gradeGroupFilter = '';
    render();
    return;
  }
  state.activeCategoryId = categoryId;
  state.grades = [];
  state.showAddGradeForm = false;
  state.showEditCategoryInfoForm = false;
  state.resolvingGradeId = null;
  state.confirmingOutGradeId = null;
  state.bulkRequestMode = false;
  state.gradeSelectMode = false;
  state.gradeSelected = {};
  state.gradeFilter = gradeFilterForEntry();
  state.gradeGroupFilter = '';
  // التحديد مرتبط بدرجات الفئة اللي كنا فيها، فلازم يتصفّر مع التبديل
  // عشان مايتطبعش بالغلط على فئة تانية.
  state.gradeLabelMode = false;
  state.gradeLabelQty = {};
  state.printingGradeId = null;
  state.gradeSearch = '';
  saveWorkState();
  render();
  subscribeGrades(categoryId);
}

// ============================================================
// ⭐⭐⭐ مستمع واحد بدل ٢٤٠٠ — دي أكبر مشكلة سرعة في النظام
// ============================================================
// القياس اللي أدّى للتغيير (فئة 245 درجة على شاشة 390):
//
//   بناء نص الصفحة      =  16 مللي   ✅ سريع
//   حط النص في الصفحة   = 252 مللي
//   **ربط الأحداث**     = 277 مللي   ← أكبر بند لوحده
//   ─────────────────────────────
//   الرسمة الواحدة      = 577 مللي
//
// السبب: 2029 زرار و492 خانة في الشاشة، وكل واحد كان بياخد
// addEventListener **لوحده** بعد كل رسمة. والعدد بيكبر مع عدد
// الدرجات، فالفئة الكبيرة بتبقى أبطأ من الصغيرة أضعاف.
//
// الحل: مستمع **واحد** على #root بيسأل الضغطة "انت جاية من مين؟".
// الحدث بيطلع من العنصر لفوق لحد ما يوصل لـ#root (event bubbling)،
// فمستمع واحد هناك بيشوف كل الضغطات. العدد بقى ثابت مهما كانت
// الدرجات 5 ولا 500.
//
// ⚠️⚠️ بتتربط **مرة واحدة في العمر** مش مع كل رسمة. #root نفسه
// مابيتشالش — اللي بيتبدّل هو اللي جوّاه (innerHTML) — فالمستمع
// بيفضل شغّال. لو اتربطت مع كل رسمة، كل ضغطة كانت هتتنفّذ مرتين
// وتلاتة وعشرة (وده أوحش من البطء).
//
// ⚠️ الشرط الوحيد إن الهاندلر يقرا كل اللي محتاجه من **سمات العنصر**
// (data-*) مش من متغيّر متقفل عليه وقت الربط. كل اللي تحت كده أصلًا.
let gradeDelegatesReady = false;

function setupGradeDelegates() {
  if (gradeDelegatesReady) return;
  const root = document.getElementById('root');
  if (!root) return;
  gradeDelegatesReady = true;

  // بيدوّر على أقرب عنصر مطابق فوق نقطة الضغط
  const on = (type, selector, fn) => {
    root.addEventListener(type, (e) => {
      const el = e.target.closest ? e.target.closest(selector) : null;
      if (el && root.contains(el)) fn(el, e);
    });
  };

  on('click', '.qty-btn', (btn) => {
    const { categoryId, gradeId, field } = btn.dataset;
    const delta = btn.dataset.action === 'inc' ? 1 : -1;
    changeQuantity(categoryId, gradeId, field, delta);
  });

  // ============================================================
  // ⚠️⚠️ أخطر خانة في النظام
  // ============================================================
  // الكود القديم: `Math.max(0, Number(input.value) || 0)` — وكان فيه
  // تلات ثقوب. اتنين منهم مالهمش خلاف، والتالت اتحل بطريقة تانية:
  //
  // 1) الكسور كانت بتعدّي: 5.7 قطعة قماش. بقت بتتقرّب لأقرب رقم صحيح.
  // 2) مافيش حد أقصى: غلطة صباع في 55555555 كانت بتترفع للسحابة.
  //
  // 3) ⚠️⚠️ **الخانة الفاضية.** دي كانت أصعبهم، وليها قصة:
  //
  //    المشكلة الأصلية إن `type=number` **بيمسح** أي رقم مش إنجليزي
  //    فورًا. فالكيبورد العربي يكتب ٥٧، الخانة تبان فاضية، والمستخدم
  //    يشيل صباعه — والقديم كان بيحسبها **صفر**، وصفر في المخزنين معناه
  //    "خلصت نهائيًا". يعني الدرجة تتعلّم خلصانة وهو ماعملش حاجة.
  //
  //    الحل الأول كان: فاضي = ما اتكتبش حاجة، ونرجّع الرقم القديم.
  //    ⚠️ وده **اترفض من صاحب النظام لسبب وجيه**: هو بيمسح الرقم وهو
  //    قاصد يصغّره، فالرجوع للقديم بيقف في وشه.
  //
  //    ⭐ الحل اللي بيرضي الاتنين: الخانة بقت `type=text` بكيبورد رقمي
  //    (inputmode)، والأرقام العربية بتتحوّل لإنجليزي قبل القراءة.
  //    كده:
  //      • فاضي فعلًا  →  صفر (زي ما هو مطلوب)
  //      • ٥٧          →  57 **بيشتغل صح** بدل ما يتمسح
  //      • كلام        →  يترفض ويرجّع القديم (مش صفر)
  //
  //    ⚠️ ليه ماسبناهاش type=number؟ لأن المتصفح بيمسح الأرقام العربية
  //    قبل ما الكود يشوفها أصلًا — فمافيش طريقة نفرّق بين "فضّاها بإيده"
  //    و"الكيبورد كتب عربي". بـtext إحنا اللي بنقرا، فبنفرّق.
  on('change', '.qty-input', (input) => {
    const { categoryId, gradeId, field } = input.dataset;
    const raw = arabicDigitsToEnglish(String(input.value == null ? '' : input.value)).trim();

    // فاضية = صفر. ده اختيار صاحب النظام: المسح غالبًا بداية تصغير رقم.
    if (raw === '') {
      setQuantity(categoryId, gradeId, field, 0);
      input.value = 0;
      return;
    }

    const n = Number(raw);
    // ⚠️ كلام مش رقم **مايتحسبش صفر**: ده غلط في الكتابة، مش نية.
    if (!Number.isFinite(n)) {
      const g = (state.grades || []).find((x) => x.id === gradeId);
      input.value = g ? Number(g[field]) || 0 : 0;
      return;
    }

    const newValue = Math.max(0, Math.min(MAX_GRADE_QTY, Math.round(n)));
    // ⚠️ الخانة بتتكتب دايمًا بالرقم اللي **اتحفظ فعلًا**. لو كتبت ٥٧
    // هتشوف 57، ولو كتبت 5.7 هتشوف 6 — عشان تعرف اللي اتسجّل، مش اللي
    // كتبته وانت فاكر إنه اتسجّل زي ما هو.
    input.value = newValue;
    setQuantity(categoryId, gradeId, field, newValue);
  });

  on('click', '[data-delete-grade-id]', (btn) => {
    safeAsync(async () => {
      const gradeId = btn.dataset.deleteGradeId;
      const gradeNumber = btn.dataset.deleteGradeNumber;
      if (!confirm(`متأكد إنك عايز تمسح الدرجة رقم ${gradeNumber}؟`)) return;
      await deleteGrade(state.activeCategoryId, gradeId, gradeNumber);
    }, 'حذف درجة');
  });

  on('click', '[data-request-shortage-id]', (btn) => requestShortage(btn.dataset.requestShortageId, 1));
  on('click', '[data-cancel-shortage-id]', (btn) => cancelShortage(btn.dataset.cancelShortageId));

  on('click', '[data-request-qty-id]', (btn) => {
    state.requestQtyGradeId = btn.dataset.requestQtyId;
    render();
    const el = document.getElementById('req-qty-' + btn.dataset.requestQtyId);
    if (el) { el.focus(); el.select(); }
  });

  on('click', '[data-cancel-req-id]', () => {
    state.requestQtyGradeId = null;
    render();
  });

  on('submit', '[data-req-form-id]', (form, e) => {
    e.preventDefault();
    const id = form.dataset.reqFormId;
    const raw = parseInt((document.getElementById('req-qty-' + id) || {}).value, 10);
    state.requestQtyGradeId = null;
    safeAsync(() => requestShortage(id, raw), 'طلب تزويد بكمية');
  });

  on('click', '[data-print-grade-id]', (btn) => {
    state.printingGradeId = btn.dataset.printGradeId;
    render();
    const input = document.getElementById('grade-print-qty');
    if (input) { input.focus(); input.select(); }
  });

  on('click', '[data-print-grade-cancel]', () => {
    state.printingGradeId = null;
    render();
  });
}

function attachDashboardEvents() {
  setupGradeDelegates();
  // حساب موظف الطباعة: شاشة واحدة بس، فمفيش داعي لباقي الربط.
  if (isPrintOperator(state.profile)) {
    const out = document.getElementById('logout-btn');
    if (out) out.addEventListener('click', () => auth.signOut());
    // ⚠️ الشريط ده بيرجع من هنا قبل الربط العام تحت، فأي زرار فيه لازم
    // يتربط هنا بإيدنا — وإلا هيبان ومايشتغلش.
    const chip = document.getElementById('operator-chip');
    if (chip) chip.addEventListener('click', () => askOperatorName(true));
    attachPrintScreenEvents();
    return;
  }

  if (state.screen === 'home') attachHomeEvents();
  if (state.screen === 'products') attachProductsEvents();
  if (state.screen === 'print') attachPrintScreenEvents();
  if (state.screen === 'users') attachUsersScreenEvents();
  if (state.screen === 'movement') attachMovementEvents();
  if (state.screen === 'activity') attachActivityLogEvents();

  // ---- التنقّل بين الشاشات ----
  document.querySelectorAll('[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => openScreen(btn.getAttribute('data-screen')));
  });

  // ---- قايمة الفئات الجانبية ----
  const pendingDotBtn = document.getElementById('pending-dot-btn');
  if (pendingDotBtn) {
    pendingDotBtn.addEventListener('click', () => {
      state.sideMenuOpen = true;
      state.categoryFilter = 'pending';
      render();
    });
  }

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
      // نفس القاعدة: نسجّل الحرف فورًا، ونأجّل الرسم بس. (الشرح الكامل في
      // js/print-screen.js عند printResultsHTML)
      state.categorySearch = sideSearch.value;
      clearTimeout(timer);
      timer = setTimeout(() => {
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
  // ⭐ مربعات الرئيسية بتوديك على القايمة مفلترة — نفس منطق الشارة
  // اللي جنب اسمك، ونفس السلسلة (فلتر ← فئة ← الدرجات المطلوبة بس).
  document.querySelectorAll('[data-stat-filter]').forEach((tile) => {
    tile.addEventListener('click', () => {
      state.categoryFilter = tile.getAttribute('data-stat-filter');
      state.sideMenuOpen = true;
      state.moreOpen = false;
      render();
    });
  });

  // ============================================================
  // ⭐⭐ الشريط التحت و"المزيد"
  // ============================================================
  // ⚠️⚠️ زراير "المزيد" **بتضغط على زراير قايمة ☰ نفسها** بدل ما
  // تكرّر منطقها. السبب: أي منطق متكرّر بيفضل متطابق أسبوع وبعدين
  // واحد فيهم يتعدّل والتاني لأ — ويبقى عندك زرارين بنفس الاسم
  // بيعملوا حاجتين مختلفتين. الضغطة المرحّلة مافيهاش الخطر ده.
  const clickTwin = (twinId) => {
    const el = document.getElementById(twinId);
    if (el) el.click();
  };

  const closeMore = (rerender) => {
    state.moreOpen = false;
    if (rerender) render();
    else {
      const sheet = document.getElementById('more-sheet');
      if (sheet) sheet.classList.remove('open');
      const nav = document.getElementById('bnav-more');
      if (nav) nav.classList.remove('on');
    }
  };

  const bnav = {
    'bnav-home': () => openScreen('home'),
    'bnav-sheets': () => openScreen('sheets'),
    'bnav-print': () => openScreen('print'),
    'bnav-cats': () => {
      state.moreOpen = false;
      state.sideMenuOpen = !state.sideMenuOpen;
      render();
    },
    'bnav-more': () => {
      state.sideMenuOpen = false;
      state.moreOpen = !state.moreOpen;
      render();
    },
  };
  Object.keys(bnav).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', bnav[id]);
  });

  const moreClose = document.getElementById('more-close-btn');
  if (moreClose) moreClose.addEventListener('click', () => closeMore(true));

  // ⚠️ الترتيب مهم: بنقفل "المزيد" **قبل** ما ندوس على التوأم، عشان
  // اللي بيفتح نافذة (زي المظهر أو الباركود) ماتفتحش وراها لوح مفتوح.
  const moreTwins = {
    'more-scan': 'scan-barcode-btn',
    'more-import': 'import-btn',
    'more-export': 'export-btn',
    'more-appearance': 'appearance-btn',
    'more-install': 'install-app-btn',
    'more-notify': 'restock-notify-btn',
    'more-activity': 'activity-log-btn',
    'more-logout': 'logout-btn',
  };
  Object.keys(moreTwins).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      closeMore(false);
      clickTwin(moreTwins[id]);
    });
  });

  const moreProducts = document.getElementById('more-products');
  if (moreProducts) moreProducts.addEventListener('click', () => openScreen('products'));
  const moreUsers = document.getElementById('more-users');
  if (moreUsers) moreUsers.addEventListener('click', () => openScreen('users'));
  const moreMovement = document.getElementById('more-movement');
  if (moreMovement) moreMovement.addEventListener('click', () => openScreen('movement'));
  // نفس البند في قايمة ☰ (الكمبيوتر) — نفس الدالة، فمستحيل يفترقوا
  const movementBtn = document.getElementById('movement-btn');
  if (movementBtn) {
    movementBtn.addEventListener('click', () => {
      const panel = document.getElementById('menu-panel');
      if (panel) panel.classList.remove('open');
      openScreen('movement');
    });
  }

  // 🎨 المظهر — نافذة اللون والخط. مافيش نداء شبكة هنا خالص:
  // الاختيار بيتحفظ على الجهاز نفسه (شوف appearance.js).
  const appearanceBtn = document.getElementById('appearance-btn');
  if (appearanceBtn) {
    appearanceBtn.addEventListener('click', () => {
      const panel = document.getElementById('menu-panel');
      if (panel) panel.classList.remove('open');
      openAppearanceDialog();
    });
  }

  const catOrderBtn = document.getElementById('cat-order-btn');
  if (catOrderBtn) {
    // الخروج من وضع الترتيب بيسيب أي فئة ماسكها
    catOrderBtn.addEventListener('click', () => {
      state.catMoving = null;
    });
  }
  if (catOrderBtn) {
    catOrderBtn.addEventListener('click', () => {
      state.categoryOrderMode = !state.categoryOrderMode;
      render();
    });
  }
  // ---- الترتيب بضغطتين: امسك الفئة، وبعدين دوس على مكانها ----
  document.querySelectorAll('[data-cat-pick]').forEach((btn) => {
    btn.addEventListener('click', () =>
      safeAsync(async () => {
        const id = btn.getAttribute('data-cat-pick');
        if (!state.catMoving) {
          state.catMoving = id;
          render();
          return;
        }
        if (state.catMoving === id) {
          state.catMoving = null;
          render();
          return;
        }
        const from = state.catMoving;
        state.catMoving = null;
        await moveCategoryTo(from, id);
      }, 'ترتيب الفئات')
    );
  });

  // ---- تعديل اسم الفئة من القايمة ----
  document.querySelectorAll('[data-cat-rename]').forEach((btn) => {
    btn.addEventListener('click', () =>
      safeAsync(async () => {
        const id = btn.getAttribute('data-cat-rename');
        const cat = state.categories.find((c) => c.id === id);
        if (!cat) return;
        const next = prompt('اسم الفئة:', cat.name || '');
        if (next === null) return;
        const name = String(next).trim();
        if (!name || name === cat.name) return;
        await renameCategory(id, name);
      }, 'تعديل اسم الفئة')
    );
  });

  // ---- حذف الفئة من القايمة ----
  // ⚠️ التأكيد بيطلب منك **تكتب اسم الفئة**. السبب: الزرار ده جنب كل فئة
  // في قايمة فيها 34 فئة، وضغطة غلط معناها ضياع فئة بكل درجاتها. سؤال
  // "متأكد؟" العادي بيتضغط عليه بالعادة من غير قراية.
  document.querySelectorAll('[data-cat-delete]').forEach((btn) => {
    btn.addEventListener('click', () =>
      safeAsync(async () => {
        const id = btn.getAttribute('data-cat-delete');
        const cat = state.categories.find((c) => c.id === id);
        if (!cat) return;
        const typed = prompt(
          `حذف فئة "${cat.name}" بكل درجاتها — الخطوة دي مالهاش رجعة.\n\n` +
            `لو متأكد، اكتب اسم الفئة بالظبط:`
        );
        if (typed === null) return;
        if (String(typed).trim() !== String(cat.name).trim()) {
          alert('الاسم مش مطابق — مااتحذفش حاجة.');
          return;
        }
        await deleteCategory(cat.id, cat.name);
      }, 'حذف الفئة')
    );
  });

  // ============================================================
  // ⭐⭐ سحب الفئة بالصباع
  // ============================================================
  // الأسهم ▲▼ بتحرّك خانة واحدة. عندك 25 فئة وعايز تنزّل واحدة من فوق
  // لتحت = 24 ضغطة. والمسك-والحط (دوس على الفئة، دوس على مكانها) أسرع
  // بس محتاج تفتكر إنك ماسك حاجة.
  //
  // ⚠️ **pointer events مش drag-and-drop بتاع HTML**: الأخيرة مابتشتغلش
  // بالصباع على الموبايل خالص — والشغل من الموبايل.
  //
  // ⚠️ **الأسهم والمسك-والحط سايبينهم زي ما هم**. السحب إضافة مش بديل:
  // اللي اتعوّد على طريقة يفضل يستخدمها، ولو السحب اتلغبط في متصفح
  // معيّن مافيش حاجة اتكسرت.
  //
  // ⚠️ والحفظ بيمشي على **نفس moveCategoryTo** اللي المسك-والحط بيستخدمها
  // — نفس حقل order ونفس الكتابة. مافيش تكويد بيانات جديد خالص.
  (() => {
    const listEl = document.querySelector('.side-list');
    if (!listEl) return;
    const rows = () => [...listEl.querySelectorAll('[data-cat-row]')];
    let fromId = null;
    let overId = null;

    const clearMarks = () => {
      rows().forEach((r) => r.classList.remove('cat-drag-over', 'cat-dragging'));
    };

    listEl.querySelectorAll('[data-cat-drag]').forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => {
        // ⚠️ الترتيب بيتحرّك في القايمة الكاملة بس — نفس شرط الأسهم.
        if (!canReorderNow()) return;
        fromId = handle.getAttribute('data-cat-drag');
        overId = null;
        const row = handle.closest('[data-cat-row]');
        if (row) row.classList.add('cat-dragging');
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
      });

      handle.addEventListener('pointermove', (e) => {
        if (!fromId) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const row = el && el.closest ? el.closest('[data-cat-row]') : null;
        const id = row ? row.getAttribute('data-cat-row') : null;
        if (id === overId) return;
        overId = id;
        rows().forEach((r) => r.classList.toggle('cat-drag-over', r.getAttribute('data-cat-row') === id && id !== fromId));
      });

      const finish = () => {
        const from = fromId;
        const to = overId;
        fromId = null;
        overId = null;
        clearMarks();
        if (from && to && from !== to) safeAsync(() => moveCategoryTo(from, to), 'ترتيب الفئات');
      };
      handle.addEventListener('pointerup', finish);
      handle.addEventListener('pointercancel', finish);
    });
  })();

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

  // ---- 🔎 البحث برقم الدرجة ----
  // نفس علاج شاشة الطباعة بالظبط: القيمة بتتسجّل مع كل حرف، والرسم
  // بيتأجّل شوية — وبعد الرسم بنرجّع المؤشر لآخر مكانه في الخانة، عشان
  // الرسم بيهدّ الخانة ويبنيها من الأول.
  const gradeSearchEl = document.getElementById('grade-search');
  if (gradeSearchEl) {
    let timer = null;
    gradeSearchEl.addEventListener('input', () => {
      state.gradeSearch = gradeSearchEl.value;
      const pos = gradeSearchEl.selectionStart;
      clearTimeout(timer);
      timer = setTimeout(() => {
        render();
        const again = document.getElementById('grade-search');
        if (again) {
          again.focus();
          try {
            again.setSelectionRange(pos, pos);
          } catch (err) {
            /* بعض المتصفحات مابتسمحش على أنواع معيّنة */
          }
        }
      }, 180);
    });
  }
  const gradeSearchClear = document.getElementById('grade-search-clear');
  if (gradeSearchClear) {
    gradeSearchClear.addEventListener('click', () => {
      state.gradeSearch = '';
      render();
    });
  }

  // ---- 📌 الشريط المختصر ----
  // بيظهر أول ما سطر الفلاتر يطلع بره الشاشة من فوق، وبيختفي أول ما يرجع.
  // بنقيس مكان سطر الفلاتر الحقيقي بدل رقم ثابت، عشان ارتفاع اللي فوقه
  // بيتغيّر (اسم الصنف ممكن يلف، والأزرار ممكن تبقى سطر أو سطرين).
  const ctxBar = document.getElementById('ctx-bar');
  const filterRow = document.getElementById('grade-filter-row');
  if (ctxBar && filterRow) {
    syncStickyTop();
    window.addEventListener('resize', syncStickyTop, { passive: true });
    const box = document.querySelector('[data-keep-scroll]') || document.scrollingElement;
    const target = box === document.scrollingElement ? window : box;
    const sync = () => {
      ctxBar.hidden = filterRow.getBoundingClientRect().bottom > topOffsetPx();
    };
    target.addEventListener('scroll', sync, { passive: true });
    sync();
    const pick = (id, items) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', (e) => {
        e.stopPropagation();
        openCtxPicker(el, items);
      });
    };
    const cat = state.categories.find((c) => c.id === state.activeCategoryId) || {};
    const groups = categoryGroups(cat);
    const hasUngrouped = state.grades.some((g) => !g.group || !groups.includes(g.group));
    pick('ctx-group', [
      { label: 'كل المجموعات', on: () => (state.gradeGroupFilter = '') },
      ...groups.map((n) => ({ label: n, on: () => (state.gradeGroupFilter = n) })),
      ...(hasUngrouped ? [{ label: UNGROUPED_LABEL, on: () => (state.gradeGroupFilter = UNGROUPED_LABEL) }] : []),
    ]);
    pick('ctx-status', [
      { label: 'الكل', on: () => (state.gradeFilter = 'all') },
      { label: '🟡 معلّق', on: () => (state.gradeFilter = 'pending') },
      { label: '🟠 قرّبت تخلص', on: () => (state.gradeFilter = 'low') },
      { label: '🔴 خلصت', on: () => (state.gradeFilter = 'out') },
      { label: '⚪ الأساسية', on: () => (state.gradeFilter = 'base') },
    ]);
  }

  const toggleBulkRequestBtn = document.getElementById('toggle-bulk-request-btn');
  if (toggleBulkRequestBtn) {
    toggleBulkRequestBtn.addEventListener('click', () => {
      state.bulkRequestMode = !state.bulkRequestMode;
      state.printingGradeId = null;
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
      state.printingGradeId = null;
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
      state.printingGradeId = null;
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
      const n = Math.max(0, Math.min(MAX_LABEL_COPIES, parseInt(input.value, 10) || 0));
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
      promptLabelSize((sizeOptions) => safeAsync(() => printGradeLabels(cat, sizeOptions), 'طباعة ملصقات الدرجات'), {
        hideCopies: true,
        showGroupName: true,
      });
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

  const criticalQtyBtn = document.getElementById('critical-qty-btn');
  if (criticalQtyBtn) {
    criticalQtyBtn.addEventListener('click', () => openCriticalQtyDialog(state.activeCategoryId));
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
  wire('operator-chip', () => askOperatorName(true));
  wire('scan-barcode-btn', () => safeAsync(() => openBarcodeScanner(), 'فتح الكاميرا'));
  wire('import-btn', () => openImportDialog());
  wire('users-btn', () => {
    state.screen = 'users';
    state.sideMenuOpen = false;
    render();
    subscribeUsers();
  });
  wire('install-app-btn', () => promptAppInstall());
  // ⚠️ لازم من ضغطة المستخدم — المتصفح بيرفض طلب إذن الإشعارات لو اتنادى لوحده
  wire('restock-notify-btn', () => safeAsync(() => toggleRestockNotifications(), 'إشعارات التزويد'));
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

  // ⚠️ اتنقلت لـsetupGradeDelegates — مستمع واحد بدل واحد لكل عنصر.

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

  // ---- سهم الرجوع لفوق ----
  // بيظهر بس لما تنزل أكتر من شاشة — الفئة فيها 200 درجة، والرجوع لفوق
  // بالسحب بياخد وقت.
  const toTop = document.getElementById('to-top-btn');
  if (toTop) {
    const box = document.querySelector('[data-keep-scroll]') || document.scrollingElement;
    const target = box === document.scrollingElement ? window : box;
    const sync = () => {
      const y = box === document.scrollingElement ? window.scrollY : box.scrollTop;
      toTop.classList.toggle('show', y > 400);
    };
    target.addEventListener('scroll', sync, { passive: true });
    sync();
    toTop.addEventListener('click', () => {
      if (box === document.scrollingElement) window.scrollTo({ top: 0, behavior: 'smooth' });
      else box.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---- القوايم المنسدلة في شريط الفئة ----
  // بتتقفل لما تضغط بره أو تختار حاجة منها.
  ['tool-print', 'tool-add', 'tool-cat'].forEach((id) => {
    const btn = document.getElementById(id + '-btn');
    const panel = document.getElementById(id + '-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = panel.classList.contains('open');
      document.querySelectorAll('.tool-menu-panel.open').forEach((p) => p.classList.remove('open'));
      if (!wasOpen) panel.classList.add('open');
    });
    panel.addEventListener('click', () => panel.classList.remove('open'));
  });
  document.addEventListener(
    'click',
    () => document.querySelectorAll('.tool-menu-panel.open').forEach((p) => p.classList.remove('open')),
    { once: true }
  );

  const addGradeBtn = document.getElementById('add-grade-btn');
  if (addGradeBtn) {
    addGradeBtn.addEventListener('click', () => {
      state.showAddGradeForm = !state.showAddGradeForm;
      state.lastAddedGrade = null;
      render();
      const numEl = document.getElementById('new-grade-number');
      if (numEl) numEl.focus();
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

      // ⭐ الشاشة **بتفضل مفتوحة**. السبب: الناس بتضيف درجات ورا بعض، وكل
      // مرة كانت الشاشة بتتقفل فتضطر تفتحها من تاني وتختار المجموعة من
      // تاني. دلوقتي بتفضّي رقم الدرجة بس وتسيب كل حاجة تانية زي ما هي.
      state.lastGradeGroup = group;
      state.lastAddedGrade = { number, group };
      clearDrafts('grade_');
      render();

      // المؤشر بيرجع لخانة الرقم جاهز للدرجة اللي بعدها
      const numEl = document.getElementById('new-grade-number');
      if (numEl) {
        numEl.value = '';
        numEl.focus();
      }
    });
  }

  const startOneBox = document.getElementById('grade-start-one');
  if (startOneBox) {
    startOneBox.addEventListener('change', () => {
      state.newGradeStartsWithOne = startOneBox.checked;
      const branch = document.getElementById('new-grade-branch');
      if (branch) branch.value = startOneBox.checked ? 1 : 0;
    });
  }

  const cancelAddGrade = document.getElementById('cancel-add-grade');
  if (cancelAddGrade) {
    cancelAddGrade.addEventListener('click', () => {
      clearDrafts('grade_');
      state.showAddGradeForm = false;
      state.lastAddedGrade = null;
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
      promptLabelSize((sizeOptions) => safeAsync(() => printLabel(cat, sizeOptions), 'طباعة الملصق'), {
        showNoPrice: true,
      });
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

  const printCustomBtn = document.getElementById('print-custom-btn');
  if (printCustomBtn) {
    printCustomBtn.addEventListener('click', () => openCustomLabelDialog());
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

  document.querySelectorAll('[data-print-grade-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.printGradeGo;
      const input = document.getElementById('grade-print-qty');
      const raw = parseInt(input ? input.value : '1', 10);
      state.printingGradeId = null;
      render();
      safeAsync(() => printOneGradeLabel(id, Number.isNaN(raw) ? 1 : raw), 'طباعة مسمّى الدرجة');
    });
  });

  // التزويد بضغطة واحدة: بينقل الكمية الافتراضية من الرئيسي للفرع فورًا.
  document.querySelectorAll('[data-quick-fulfill-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      // ⚠️ الكمية جاية من الزرار نفسه (اللي اتطلبت)، مش من الافتراضي —
      // وإلا الطلب بكمية 3 كان هيتقفل بواحدة.
      const wantQty = parseInt(btn.dataset.quickFulfillQty, 10) || defaultRestockQty();
      await fulfillShortage(btn.dataset.quickFulfillId, wantQty).catch((err) => {
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
// بتنقل الفئة لمكان فئة تانية (الترتيب بضغطتين).
// بتشيلها من مكانها وتحطها **مكان الهدف بالظبط**، والباقي بيزحلق.
async function moveCategoryTo(fromId, toId) {
  const list = state.categories.slice();
  const from = list.findIndex((c) => c.id === fromId);
  const to = list.findIndex((c) => c.id === toId);
  if (from === -1 || to === -1 || from === to) return;

  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  await commitCategoryOrder(list);
}

async function renameCategory(categoryId, name) {
  const before = state.categories.find((c) => c.id === categoryId);
  fireWrite(db.collection('categories').doc(categoryId).update({ name }), 'تعديل اسم الفئة');
  // الشاشة بتتحدّث فورًا من غير ما تستنى السحابة — مهم وانت أوفلاين.
  if (before) before.name = name;
  render();
  logActivity({ action: 'rename_category', categoryId, categoryName: name, oldName: before ? before.name : '' });
}

async function moveCategory(categoryId, direction) {
  const list = state.categories.slice();
  const i = list.findIndex((c) => c.id === categoryId);
  if (i === -1) return;
  const j = i + direction;
  if (j < 0 || j >= list.length) return;

  const tmp = list[i];
  list[i] = list[j];
  list[j] = tmp;
  await commitCategoryOrder(list);
}

// بتكتب الترتيب الجديد للقايمة كلها. مشتركة بين الأسهم والترتيب بضغطتين.
async function commitCategoryOrder(list) {
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
    payload.criticalQty = normalizeCriticalQty(data.criticalQty);
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
// ⭐ الدرجات الأساسية بقت **لكل مجموعة ألوان**، مش مرة واحدة للفئة.
//
// قبل كده مفتاح منع التكرار كان **الاسم لوحده**، يعني لو عندك "أبيض" في
// مجموعة "كيوي" مكانش ينفع يبقى عندك "أبيض" في "نصار" — والفئة الواحدة
// عندك فيها مجموعات مختلفة كل واحدة ليها أبيضها وأسودها.
//
// المفتاح بقى **الاسم + المجموعة**. والدرجات القديمة (اللي مالهاش
// مجموعة) بتفضل زي ما هي وبتتحسب في خانة "من غير مجموعة" — يعني لو ضفت
// الأساسية لمجموعة جديدة، القديمة مابتتلمسش ومابتتكررش.
// ============================================================
// ⭐ درجة أساسية **باسم من عندك**
// ============================================================
// التلاتة الجاهزين (أبيض/أسود/أوف وايت) مش كفاية دايمًا — فيه "أوف وايت
// غامق" و"بيج فاتح" وغيرهم. الدرجة اللي بتتضاف هنا **درجة أساسية كاملة**:
// بتتعامل نفس المعاملة بالظبط (بتظهر مع الأساسية، وبتاخد حد حرج، وبتطلع
// في ورقة التزويد تحت اسم مجموعتها) — الفرق بس إن اسمها من عندك.
//
// ⚠️ الرقم: الأساسية بتاخد أرقام سالبة عشان تترتب **فوق** الأرقام العادية
// (أبيض -3، أسود -2، أوف وايت -1). الدرجة المخصّصة بتتحط **بعدهم وقبل
// الرقم 1** برقم كسري (-0.999, -0.998 ...). ليه كسري؟ لأن مافيش عدد صحيح
// بين -1 و1، وأي رقم موجب هيتخبط مع درجات حقيقية.
//
// الرقم ده **عمره ما بيتعرض** — gradeDisplayName بتستخدم الاسم للأساسية.
function nextCustomBaseNumber(grades) {
  const used = (grades || [])
    .filter((g) => g && g.isBase && Number(g.number) > -1 && Number(g.number) < 1)
    .map((g) => Number(g.number));
  // ⚠️ بنزوّد **لفوق** مش لتحت: الدرجة الجديدة لازم تيجي **بعد** اللي
  // قبلها في الترتيب. أول نسخة كانت بتنقّص وبتقف عند الحد الأدنى، فكل
  // الدرجات المخصّصة كانت بتاخد **نفس الرقم** — والفحص مسك ده.
  const max = used.length ? Math.max(...used) : -1;
  return Math.min(0.999, max + 0.001);
}

async function addCustomBaseGrade(categoryId, name, criticalQty, group) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean) return { added: 0, reason: 'اكتب اسم الدرجة الأول.' };

  const target = String(group || '');
  const snap = await db.collection('categories').doc(categoryId).collection('grades').get();
  const rows = snap.docs.map((d) => d.data());

  // ⚠️ التكرار بيتحسب **جوه المجموعة** بس — زي الأساسية الجاهزة بالظبط:
  // "أوف وايت غامق" في كيوي مايمنعش نفس الاسم في نصار.
  const clash = rows.some(
    (d) => d.isBase && String(d.name || '').trim() === clean && String(d.group || '') === target
  );
  if (clash) return { added: 0, reason: `"${clean}" موجودة خلاص${target ? ` في "${target}"` : ''}.` };

  const ref = db.collection('categories').doc(categoryId).collection('grades').doc();
  const payload = {
    number: nextCustomBaseNumber(rows),
    name: clean,
    isBase: true,
    criticalQty: normalizeCriticalQty(criticalQty),
    branchQty: DEFAULT_RESTOCK_QTY,
    mainQty: 0,
    status: 'normal',
  };
  if (target) payload.group = target;
  await ref.set(payload);
  return { added: 1, reason: '' };
}

async function addBaseGradesToCategory(categoryId, criticalQty, group) {
  const snap = await db.collection('categories').doc(categoryId).collection('grades').get();
  const target = String(group || '');
  const existing = new Set(
    snap.docs
      .map((d) => d.data())
      .filter((d) => d.isBase && d.name)
      .map((d) => `${d.name}\u0000${d.group || ''}`)
  );

  const batch = db.batch();
  let added = 0;
  BASE_GRADES.forEach((base) => {
    if (existing.has(`${base.name}\u0000${target}`)) return;
    const ref = db.collection('categories').doc(categoryId).collection('grades').doc();
    const payload = {
      number: base.number,
      name: base.name,
      isBase: true,
      criticalQty: normalizeCriticalQty(criticalQty),
      branchQty: DEFAULT_RESTOCK_QTY,
      mainQty: 0,
      status: 'normal',
    };
    if (target) payload.group = target;
    batch.set(ref, payload);
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

      <form id="add-group-form" style="margin-bottom:16px;">
        <div style="display:flex; gap:8px; align-items:flex-end;">
          <div class="field" style="flex:1; margin-bottom:0;">
            <label>اسم مجموعة جديدة</label>
            <input class="input" id="new-group-name" placeholder="مثال: بيجات" required />
          </div>
          <button class="btn btn-primary" type="submit">إضافة</button>
        </div>
        <!-- ⭐ المجموعة الجديدة بتتملي على طول لو حبيت. من غير ده كنت
             تعمل المجموعة، تقفل الشاشة، تفتح "إضافة درجات دفعة واحدة"،
             وتختار المجموعة من تاني — تلات خطوات لحاجة واحدة. -->
        <div style="font-size:12px; color:var(--text-secondary); margin:10px 0 6px;">
          وتضيف فيها درجات على طول؟ <span style="opacity:.75;">(اختياري)</span>
        </div>
        <div style="display:flex; gap:8px;">
          <div class="field" style="flex:1; margin-bottom:0;"><label>من</label>
            <input class="input" type="number" id="new-group-from" min="1" inputmode="numeric" /></div>
          <div class="field" style="flex:1; margin-bottom:0;"><label>إلى</label>
            <input class="input" type="number" id="new-group-to" min="1" inputmode="numeric" /></div>
        </div>
        <label style="display:flex; gap:6px; align-items:center; margin-top:8px; font-size:12px; cursor:pointer; color:var(--text-secondary);">
          <input type="checkbox" id="new-group-start-one" ${state.rangeStartsWithOne ? 'checked' : ''} />
          ابدأ الدرجات بـ 1 في الفرع (بدل صفر)
        </label>
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
            <label>من مجموعة</label>
            <select class="input" id="assign-source"></select>
          </div>
          <div class="field" style="flex:1; min-width:120px; margin-bottom:0;">
            <label>إلى مجموعة</label>
            <select class="input" id="assign-group"></select>
          </div>
          <button class="btn btn-primary" id="assign-btn">نقل</button>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:6px; line-height:1.7;">
          سيب خانتين الأرقام فاضيتين لو عايز تنقل كل الدرجات المرقّمة.
          <br><strong>"من مجموعة" مهمة:</strong> لو سيبتها "كل المجموعات" والرقم موجود في
          أكتر من مجموعة، هيتنقلوا كلهم — وهتلاقي نفس الرقم متكرر في المجموعة الجديدة.
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
          <button class="btn" style="padding:3px 9px; font-size:11px;" data-group-down="${i}" ${i === groups.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn" style="padding:3px 9px; font-size:11px;" data-group-rename="${escapeHTML(name)}">تعديل</button>
          <button class="btn" style="padding:3px 9px; font-size:11px; color:var(--danger-text);" data-group-del="${escapeHTML(name)}">حذف</button>
        </div>`
          )
          .join('')
      : '<div class="home-empty">مفيش مجموعات — الفئة كلها قايمة واحدة.</div>';

    const opts = groups.map((n) => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('');
    overlay.querySelector('#assign-group').innerHTML =
      `<option value="">— ${escapeHTML(UNGROUPED_LABEL)} —</option>` + opts;
    // المصدر بيبدأ على المجموعة اللي إنت فاتح عليها — أغلب الوقت دي اللي
    // بتنقل منها، وكده الاختيار الافتراضي بيبقى الآمن مش الواسع.
    const cur = state.gradeGroupFilter || '';
    const srcSel = overlay.querySelector('#assign-source');
    srcSel.innerHTML =
      `<option value="">كل المجموعات</option>` +
      opts +
      `<option value="${ASSIGN_UNGROUPED}">— ${escapeHTML(UNGROUPED_LABEL)} —</option>`;
    if (cur === UNGROUPED_LABEL) srcSel.value = ASSIGN_UNGROUPED;
    else if (cur && groups.includes(cur)) srcSel.value = cur;
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

    // ⚠️ كان فيه ▲ بس. يعني عشان تنزّل مجموعة، لازم تطلّع اللي تحتها —
    // ده شغّال بس بيخلّي أبسط حركة تحتاج تفكير. ▼ بتخلّي الاتنين متناظرين.
    listEl.querySelectorAll('[data-group-down]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-group-down'));
        const next = currentGroups();
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
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
          const moved = (await assignGroupToGrades(categoryId, null, null, newName, oldName)).moved;
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
          const moved = (await assignGroupToGrades(categoryId, null, null, '', name)).moved;
          say(`✅ المجموعة اتشالت، و${moved} درجة رجعت من غير مجموعة.`);
          setTimeout(draw, 150);
        }, 'حذف المجموعة')
      );
    });
  };

  overlay.querySelector('#add-group-form').addEventListener('submit', (e) => {
    e.preventDefault();
    safeAsync(async () => {
      const input = overlay.querySelector('#new-group-name');
      const name = input.value.trim();
      if (!name) return;
      const groups = currentGroups();
      if (groups.includes(name)) {
        say('⚠️ المجموعة دي موجودة خلاص.');
        return;
      }

      // المدى اختياري — لو سابه فاضي بتتعمل المجموعة وبس (السلوك القديم)
      const from = parseInt(overlay.querySelector('#new-group-from').value, 10);
      const to = parseInt(overlay.querySelector('#new-group-to').value, 10);
      const hasRange = !Number.isNaN(from) && !Number.isNaN(to);
      if (hasRange) {
        if (from < 1 || to < 1) { say('⚠️ الأرقام لازم تبدأ من 1.'); return; }
        if (to < from) { say('⚠️ "إلى" لازم يكون أكبر من أو يساوي "من".'); return; }
        if (to - from + 1 > 2000) { say('⚠️ المدى كبير جدًا (أكتر من 2000 درجة).'); return; }
      }

      // ⚠️ الترتيب مهم: المجموعة الأول، بعدين الدرجات. لو عكسنا، الدرجات
      // هتتكتب على مجموعة الفئة لسه ماتعرفهاش فتظهر تحت "باقي الدرجات".
      await saveGroups(groups.concat([name]));
      input.value = '';

      if (!hasRange) {
        say(`✅ اتضافت مجموعة "${escapeHTML(name)}".`);
        setTimeout(draw, 150);
        return;
      }

      const startOne = !!overlay.querySelector('#new-group-start-one').checked;
      state.rangeStartsWithOne = startOne;
      say(`اتضافت "${escapeHTML(name)}" — جارٍ إضافة الدرجات...`);
      const res = await addGradeRange(categoryId, from, to, name, startOne ? 1 : 0);
      overlay.querySelector('#new-group-from').value = '';
      overlay.querySelector('#new-group-to').value = '';
      say(`✅ اتضافت مجموعة "${escapeHTML(name)}" و${res.added} درجة جوّاها.`);
      setTimeout(draw, 150);
    }, 'إضافة مجموعة');
  });

  overlay.querySelector('#assign-btn').addEventListener('click', () =>
    safeAsync(async () => {
      const from = parseInt(overlay.querySelector('#assign-from').value, 10);
      const to = parseInt(overlay.querySelector('#assign-to').value, 10);
      const group = overlay.querySelector('#assign-group').value;
      const sourceRaw = overlay.querySelector('#assign-source').value;
      // '' = كل المجموعات (السلوك القديم)، ASSIGN_UNGROUPED = اللي مالهاش مجموعة
      const source = sourceRaw === '' ? null : sourceRaw === ASSIGN_UNGROUPED ? '' : sourceRaw;
      const hasRange = !Number.isNaN(from) && !Number.isNaN(to);
      if (hasRange && to < from) {
        say('⚠️ "إلى" لازم يكون أكبر من أو يساوي "من".');
        return;
      }
      say('جارٍ النقل...');
      const res = await assignGroupToGrades(categoryId, hasRange ? from : null, hasRange ? to : null, group, source, true);
      const n = res.moved;
      if (res.skipped) {
        say(
          `✅ اتنقلت <strong>${n}</strong> درجة لـ"${escapeHTML(group || UNGROUPED_LABEL)}".` +
            `<br>⚠️ <strong>${res.skipped}</strong> درجة اتخطّت: رقمها موجود خلاص في المجموعة دي` +
            ` (${escapeHTML(res.skippedNumbers.join('، '))}).`
        );
        logActivity({
          action: 'assign_color_group',
          categoryId,
          categoryName: cat.name,
          oldValue: hasRange ? `${from}-${to}` : 'الكل',
          newValue: group || UNGROUPED_LABEL,
        });
        setTimeout(draw, 150);
        return;
      }
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
// onlyFromGroup: لو محدّد، بتتغيّر الدرجات اللي مجموعتها الحالية دي بس.
//   null = كل المجموعات، '' = اللي مالهاش مجموعة.
//
// ------------------------------------------------------------
// ⚠️ العطل اللي الدالة دي اتصلحت عشانه — اتبلّغ من الاستخدام الحقيقي
// ------------------------------------------------------------
// شاشة النقل كانت بتبعت onlyFromGroup = null دايمًا، يعني "أي درجة رقمها
// في المدى، في أي مجموعة". والفئة الواحدة فيها نفس الرقم في كذا مجموعة.
//
// السيناريو اللي حصل فعلًا (متعاد بالفحص):
//   قبل :  2 في كيوي | 2 في نصار | 2 في جاد
//   الأمر:  انقل درجة 2 → "جاد"
//   بعد :  2 في جاد  | 2 في جاد  | 2 في جاد     ← تلات نسخ!
//
// يعني غلطتين مع بعض: **كرّر** الرقم في المجموعة الهدف، و**شال** الدرجة
// من مجموعات المستخدم مطلبش يلمسها.
//
// الإصلاح جزئين:
//   1) الشاشة بقى فيها "من مجموعة"، والقيمة بتوصل هنا.
//   2) حتى لو اخترت "كل المجموعات"، الدالة **مابتسمحش** برقم يتكرر في
//      المجموعة الهدف: أول واحد بيعدّي والباقي بيتخطّى ويترجع في
//      skippedNumbers عشان المستخدم يشوف إيه اللي مااتنقلش وليه.
// guardDuplicates: بيمنع تكرار الرقم في المجموعة الهدف. بيتفعّل في النقل
// اليدوي بس.
//
// ⚠️ **متفعّلوش في إعادة التسمية والحذف.** هناك الدرجات موجودة خلاص
// وإحنا بنغيّر اسم المجموعة عليها بس — لو منعنا واحدة، هتفضل مأشّرة على
// مجموعة اتشالت، يعني درجة ضايعة مش ظاهرة في أي فلتر.
async function assignGroupToGrades(categoryId, from, to, group, onlyFromGroup, guardDuplicates) {
  const gradesRef = db.collection('categories').doc(categoryId).collection('grades');
  const snap = await gradesRef.get();
  const target = group || '';

  // الأرقام الموجودة خلاص في المجموعة الهدف — دي اللي مش هنكررها
  const taken = new Set(
    snap.docs
      .map((d) => d.data())
      .filter((g) => (g.group || '') === target && !g.isBase)
      .map((g) => String(g.number))
  );

  const targets = [];
  const skippedNumbers = [];
  snap.docs.forEach((d) => {
    const g = d.data();
    if (onlyFromGroup !== null && onlyFromGroup !== undefined) {
      if ((g.group || '') !== onlyFromGroup) return;
    }
    if (from !== null && to !== null) {
      // الدرجات الأساسية أرقامها سالبة، فمدى الأرقام مايمسّهاش
      const n = Number(g.number);
      if (g.isBase || !Number.isFinite(n) || n < from || n > to) return;
    }
    if ((g.group || '') === target) return;

    const num = String(g.number);
    if (guardDuplicates && !g.isBase) {
      if (taken.has(num)) {
        skippedNumbers.push(num);
        return;
      }
      taken.add(num);
    }
    targets.push(d);
  });

  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    targets.slice(i, i + 400).forEach((d) => batch.update(d.ref, { group: target }));
    await batch.commit();
  }
  return {
    moved: targets.length,
    skipped: skippedNumbers.length,
    skippedNumbers: [...new Set(skippedNumbers)].sort((a, b) => Number(a) - Number(b)),
  };
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

// ============================================================
// 🔔 حدود التنبيه — حد لكل درجة على حدة
// ============================================================
// "قرّبت تخلص" كان بيتحسب من رقم واحد للفئة كلها (minQty). لكن اللون
// بيفرق: لون بيمشي كتير محتاج تنبيه وهو لسه عنده 5، ولون بطيء يستنى
// لحد 1 — والاتنين في نفس الفئة.
//
// الشاشة دي بتعرض درجات **المجموعة/الفلتر اللي إنت فاتح عليه** بس، مش
// كل الفئة — عشان 100+ خانة في شاشة واحدة مش قابلة للاستخدام.
// الخانة الفاضية معناها "خد حد الفئة"، والصفر معناه "من غير تنبيه".
function openCriticalQtyDialog(categoryId) {
  const cat = state.categories.find((c) => c.id === categoryId) || {};
  const list = visibleGrades();
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:380px; width:100%; max-height:88vh; display:flex; flex-direction:column;">
      <div style="font-size:15px; font-weight:500; margin-bottom:6px;">🔔 حدود التنبيه</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.7; margin-bottom:10px;">
        الدرجة بتتعلّم <strong>"قرّبت تخلص"</strong> لما كمية الفرع تنزل للحد ده أو أقل.
        <br><strong>فاضية</strong> = تاخد حد الفئة (${escapeHTML(Number(cat.minQty) || 0)}).
        <strong>صفر</strong> = من غير تنبيه.
      </div>
      <div class="field" style="margin-bottom:8px;">
        <label>طبّق رقم على كل اللي تحت</label>
        <div style="display:flex; gap:6px;">
          <input class="input" type="number" id="crit-all-val" min="0" max="999" inputmode="numeric" style="flex:1;" />
          <button class="btn" type="button" id="crit-all-apply">طبّق</button>
        </div>
      </div>
      <div style="flex:1; overflow:auto; border-top:1px solid var(--border); padding-top:8px;">
        ${
          list.length
            ? list
                .map(
                  (g) => `
          <div style="display:flex; align-items:center; gap:8px; padding:5px 0;">
            <span style="flex:1; min-width:0; font-size:13px;">${escapeHTML(gradeDisplayName(g))}</span>
            <span style="font-size:11px; color:var(--text-muted);">الفرع ${escapeHTML(Number(g.branchQty) || 0)}</span>
            <input class="input crit-input" type="number" min="0" max="999" inputmode="numeric"
                   data-crit-id="${escapeHTML(g.id)}"
                   value="${g.criticalQty === undefined || g.criticalQty === null ? '' : escapeHTML(g.criticalQty)}"
                   placeholder="${escapeHTML(gradeCriticalQty(g, cat))}" style="width:70px; padding:5px;" />
          </div>`
                )
                .join('')
            : '<div class="home-empty">مفيش درجات في الفلتر ده.</div>'
        }
      </div>
      <div id="crit-status" style="font-size:12px; color:var(--text-secondary); margin:10px 0; min-height:16px;"></div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" id="crit-save" ${list.length ? '' : 'disabled'}>حفظ</button>
        <button class="btn" id="crit-cancel">إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('crit-cancel').addEventListener('click', close);
  document.getElementById('crit-all-apply').addEventListener('click', () => {
    const v = document.getElementById('crit-all-val').value;
    overlay.querySelectorAll('.crit-input').forEach((el) => {
      el.value = v;
    });
  });

  const statusEl = document.getElementById('crit-status');
  const saveBtn = document.getElementById('crit-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      statusEl.textContent = 'جارٍ الحفظ...';
      try {
        const batch = db.batch();
        let n = 0;
        overlay.querySelectorAll('.crit-input').forEach((el) => {
          const g = state.grades.find((x) => x.id === el.dataset.critId);
          if (!g) return;
          const raw = String(el.value).trim();
          // الفاضي بيتحفظ كـnull عشان gradeCriticalQty ترجع لحد الفئة.
          const next = raw === '' ? null : Math.max(0, Math.min(999, parseInt(raw, 10) || 0));
          const before = g.criticalQty === undefined ? null : g.criticalQty;
          if (next === before) return;
          batch.update(gradeRefOf(categoryId, g.id), { criticalQty: next });
          n++;
        });
        if (n) await batch.commit();
        logActivity({
          action: 'set_critical_qty',
          categoryId,
          categoryName: cat.name || '',
          newValue: n,
        });
        close();
      } catch (err) {
        saveBtn.disabled = false;
        statusEl.textContent = 'فشل الحفظ: ' + (err.message || err);
      }
    });
  }
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
      if (!isServerReachable()) {
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
  // ⚠️ محسوبة هنا مش جاية من الشاشة — الشاشة ممكن تتفتح من أي مكان
  const baseScopeNow = openGroupScope() ?? '';
  const hasBaseHere = state.grades.some((g) => g.isBase && (g.group || '') === baseScopeNow);
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:340px; width:100%; max-height:88vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:6px;">الدرجات الأساسية</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.7; margin-bottom:12px;">
        هيتضاف <strong>أبيض</strong> و<strong>أسود</strong> و<strong>أوف وايت</strong> كدرجات
        بأسماء بدل أرقام. المجموعة اللي عندها الدرجات دي خلاص هتتخطّى.
        <br>الدرجات دي <strong>مش بتظهر في ورقة التزويد المطبوعة</strong> لأنها من غير أرقام.
      </div>
      <div class="field">
        <label>المجموعة</label>
        <select class="input" id="base-group">
          <option value="">من غير مجموعة</option>
          ${categoryGroups(state.categories.find((c) => c.id === categoryId) || {})
            .map(
              (n) =>
                `<option value="${escapeHTML(n)}" ${
                  (state.gradeGroupFilter || '') === n ? 'selected' : ''
                }>${escapeHTML(n)}</option>`
            )
            .join('')}
        </select>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
          كل مجموعة ليها أبيضها وأسودها — فالإضافة بتتم للمجموعة دي بس.
        </div>
      </div>
      <div class="field">
        <label>الحد الحرج (تنبيه لما تنزل عنه)</label>
        <input class="input" type="number" id="base-critical" min="0" value="${DEFAULT_BASE_CRITICAL_QTY}" />
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
          <strong>صفر = من غير تنبيه</strong> (الافتراضي). حطّ رقم لو عايز الدرجة تتعلّم "قرّبت تخلص".
        </div>
      </div>

      <!-- ⭐ درجة أساسية باسم من عندك. التلاتة الجاهزين مش كفاية دايمًا —
           فيه "أوف وايت غامق" و"بيج فاتح". اللي بتضيفه هنا **درجة أساسية
           كاملة**: بتتعامل نفس المعاملة بالظبط، الفرق بس إن اسمها من عندك. -->
      <div class="field" style="border-top:1px solid var(--border); padding-top:12px; margin-top:4px;">
        <label>أو ضيف درجة أساسية باسم من عندك</label>
        <div style="display:flex; gap:8px;">
          <input class="input" id="base-custom-name" maxlength="40" style="flex:1;"
                 placeholder="مثلًا: أوف وايت غامق" />
          <button class="btn btn-primary" id="base-custom-add" type="button">إضافة</button>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px; line-height:1.7;">
          بتتحط مع الأساسية وبتاخد نفس الحد الحرج والمجموعة اللي فوق.
        </div>
      </div>

      <div id="base-status" style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;">${
        hasBaseHere ? 'المجموعة دي عندها درجات أساسية خلاص — تقدر تضيف واحدة باسم من عندك من فوق.' : ''
      }</div>
      <!-- ⚠️ كان هنا زرار "ضيفهم لكل الفئات من غير مجموعة". اتشال في
           v0.50.0 **بعد ما التأسيس خلص**: هو كان للتجهيز الأولي (تملا
           الـ25 فئة مرة واحدة)، وبعد كده بقى زرار خطر جنب زرار عادي —
           ضغطة غلط بتضيف درجات في كل الفئات ومفيش تراجع جماعي.
           الإضافة للمجموعة اللي انت فيها كفاية للشغل اليومي. -->
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn btn-primary" id="base-this">ضيف التلاتة الجاهزين للمجموعة دي</button>
        <button class="btn" id="base-cancel">إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('base-cancel').addEventListener('click', close);
  const statusEl = document.getElementById('base-status');
  const critical = () => normalizeCriticalQty(document.getElementById('base-critical').value);
  const chosenGroup = () => document.getElementById('base-group').value || '';

  document.getElementById('base-custom-add').addEventListener('click', () =>
    safeAsync(async () => {
      const nameEl = document.getElementById('base-custom-name');
      const res = await addCustomBaseGrade(categoryId, nameEl.value, critical(), chosenGroup());
      if (!res.added) {
        statusEl.style.color = 'var(--danger-text)';
        statusEl.textContent = '⚠️ ' + res.reason;
        return;
      }
      logActivity({
        action: 'add_base_grades',
        categoryId,
        categoryName: state.categories.find((c) => c.id === categoryId)?.name || '',
        newValue: nameEl.value.trim(),
      });
      statusEl.style.color = 'var(--ok)';
      statusEl.textContent = `✅ اتضافت "${nameEl.value.trim()}" مع الدرجات الأساسية.`;
      // ⚠️ الشاشة بتفضل مفتوحة والخانة بتتفضّى — الناس بتضيف كذا واحدة ورا بعض
      nameEl.value = '';
      nameEl.focus();
    }, 'إضافة درجة أساسية')
  );

  document.getElementById('base-this').addEventListener('click', async () => {
    statusEl.textContent = 'جارٍ الإضافة...';
    try {
      const n = await addBaseGradesToCategory(categoryId, critical(), chosenGroup());
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

  if (!getSavedPrinter('label') && !getSavedPrinter('restock')) return;
  if (!(await ensureQZConnected())) return;

  // ⚠️ مفيش "تنفيذ أمر" هنا خالص. الإعداد مش أمر بيتنفّذ — ده **قيمة**
  // الجهاز بيقراها من السحابة (شوف readPrintField). الدوال تحت بترجّع
  // القيمة النافذة فعلًا، فالنبضة بتنشر الحقيقة لوحدها.
  const labelPrinter = getSavedPrinter('label');
  const restockPrinter = getSavedPrinter('restock');

  // ⭐ قايمة **كل** الطابعات المتعرّفة على الجهاز ده — مش المختارة بس.
  // ده اللي بيخلّي التليفون يقدر يغيّر الطابعة من بعيد: من غير القايمة
  // دي، الجهاز التاني عمره ما هيعرف إن فيه طابعة تانية موجودة أصلًا.
  //
  // ⚠️ بسقف عدد: مستند الطابعة مش المفروض يكبر عشان قايمة طابعات، وفيه
  // أجهزة عليها عشرات الطابعات الوهمية (PDF، Fax، OneNote...).
  let printers = [];
  try {
    printers = (await getAvailableQZPrinters()).slice(0, 40);
  } catch (err) {
    console.warn('تعذّر قراءة قايمة الطابعات:', err);
  }

  try {
    fireWrite(db.collection('printStations').doc(deviceId).set(
      {
        deviceName: getDeviceName() || 'جهاز بدون اسم',
        labelPrinter,
        restockPrinter,
        printers,
        // نسخة النظام الشغّالة على الجهاز ده — بتظهر للي هيبعتله طباعة،
        // عشان لو الجهاز لسه على نسخة قديمة ياخد باله ويحدّثها.
        appVersion: typeof APP_VERSION === 'string' ? APP_VERSION : '',
        // ضبط الطباعة بيتنشر مع النبضة عشان جهاز جديد يقدر ينسخه بدل ما
        // يعيد المعايرة من الأول.
        //
        // ⚠️ اللي **مش** موجود هنا مقصود: اسم الجهاز ومعرّفه. دول لازم
        // يفضلوا فريدين لكل جهاز، وإلا الجهازين هيتلخبطوا في قايمة الطباعة
        // عن بُعد ويبقى فيه جهازين بنفس الاسم مش عارف تبعت لمين.
        printSetup: {
          align: getPrintAlign(),
          tweaks: getPrintTweaksMap(),
          // الأرقام دي **لكل جهاز**، مش مشتركة — فهي بالظبط اللي التليفون
          // محتاج يشوفها ويغيّرها من بعيد.
          pace: getPrintPaceMs(),
          batch: getPrintBatchSize(),
          lead: getPrintLeadLabels(),
        },
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

// ⚠️ لازم يفضل فيه catch على النبضة دي.
//
// المشكلة اللي كانت بتحصل: registerPrintStation دالة async بتنادي
// ensureQZConnected، ودي بتتعامل مع مكتبة QZ Tray. على التليفون مفيش QZ
// أصلًا، والمكتبة ساعات بترمي خطأ **فوري** (مش وعد مرفوض) من جواها.
// وقتها الوعد بتاع الدالة بيترفض ومفيش حد ماسكه — فيظهر للمستخدم شريط
// أحمر مكتوب فيه "Promise: Cannot read properties of undefined"، وبيتكرر
// مع كل نبضة (عشان كده كان بيظهر ×5).
//
// الخطأ ده مالوش أي تأثير على الشغل (الجهاز ده أصلًا مش نقطة طباعة)،
// فمكانه الكونسول مش وش المستخدم.
function safeRegisterPrintStation() {
  try {
    const p = registerPrintStation();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('تعذّر تسجيل الجهاز كنقطة طباعة:', err));
    }
  } catch (err) {
    console.warn('تعذّر تسجيل الجهاز كنقطة طباعة:', err);
  }
}

function startStationHeartbeat() {
  stopStationHeartbeat();
  safeRegisterPrintStation();
  stationHeartbeatTimer = setInterval(safeRegisterPrintStation, STATION_HEARTBEAT_MS);
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
      // ⚠️ الشاشة **لازم** تتعاد رسمتها هنا. تاب الأجهزة بيعرض حالة كل
      // جهاز (شغّال/مقفول وآخر ظهور)، ومن غير الرسمة دي بتفضل واقفة على
      // اللقطة اللي فتحت بيها — تبعت أمر وما تشوفش إنه اتنفّذ.
      if (state.view === 'dashboard' && state.screen === 'print') render();
    },
    (err) => console.warn('تعذّر قراءة قائمة أجهزة الطباعة:', err)
  );
}

// ⭐ استثناءات كل الأجهزة — عشان شاشة التحكم توري مين عنده إعداد خاص،
// وتحذّرك قبل ما "على الكل" تمسحه.
let unsubAllDeviceSettings = null;

function subscribeAllDeviceSettings() {
  if (unsubAllDeviceSettings) unsubAllDeviceSettings();
  unsubAllDeviceSettings = db.collection('deviceSettings').onSnapshot(
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => (map[d.id] = { id: d.id, ...d.data() }));
      state.deviceSettings = map;
      if (state.view === 'dashboard' && state.screen === 'print') render();
    },
    (err) => console.warn('تعذّر قراءة استثناءات الأجهزة:', err)
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
      <div class="card" style="max-width:320px; width:100%; max-height:88vh; overflow:auto; text-align:center;">
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
                ? `<div style="font-size:10px; color:var(--warning-text); margin-top:-4px;">
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

// ------------------------------------------------------------
// إضافة درجات دفعة واحدة (من رقم إلى رقم)
// ------------------------------------------------------------
// ============================================================
// ⭐ إضافة مدى درجات — **نقطة واحدة** لكل اللي بيضيفوا دفعة
// ============================================================
// بتستخدمها شاشتين: "إضافة درجات دفعة واحدة"، و"مجموعات الألوان" لما
// تضيف مجموعة جديدة وتملاها على طول.
//
// ⚠️ اتكتبت كدالة واحدة من الأول عن قصد. الطباعة اتلسعنا فيها لما نفس
// المنطق كان مكتوب في تلات أماكن وواحد منهم فات عليه مفتاح — فبقى نفس
// الحاجة بتطلع بشكلين. متكتبش نسخة تانية من الكلام ده.
//
// الترقيم **مستقل لكل مجموعة**: "الوان" تقدر تبدأ من 1 حتى لو "بيجات"
// فيها 1 أصلًا — زي الشيت الأصلي بالظبط. فالتكرار بيتحسب جوه المجموعة
// المختارة بس.
//
// بترجّع { added, skipped } — أو بترمي لو حصل خطأ في السحابة.
async function addGradeRange(categoryId, from, to, group, branchQty) {
  const existing = new Set(
    state.grades.filter((g) => (g.group || '') === group).map((g) => Number(g.number))
  );
  const toAdd = [];
  for (let n = from; n <= to; n++) if (!existing.has(n)) toAdd.push(n);
  if (!toAdd.length) return { added: 0, skipped: to - from + 1 };

  const gradesRef = db.collection('categories').doc(categoryId).collection('grades');
  // دفعات من 400 — الحد الأقصى للدفعة الواحدة في Firestore هو 500.
  for (let i = 0; i < toAdd.length; i += 400) {
    const batch = db.batch();
    toAdd.slice(i, i + 400).forEach((number) => {
      const payload = { number, branchQty, mainQty: 0, status: 'normal' };
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

  return { added: toAdd.length, skipped: to - from + 1 - toAdd.length };
}

function openAddGradeRangeDialog(categoryId) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:320px; width:100%; max-height:88vh; overflow:auto;">
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
      ${groupSelectHTML('range-group', state.categories.find((c) => c.id === categoryId), defaultGroupForAdd())}
      <label style="display:flex; gap:6px; align-items:center; margin:10px 0; font-size:12px; cursor:pointer; color:var(--text-secondary);">
        <input type="checkbox" id="range-start-one" ${state.rangeStartsWithOne ? 'checked' : ''} />
        ابدأ الدرجات بـ 1 في الفرع (بدل صفر)
      </label>
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
    // ⚠️ الافتراضي هنا **متعلّم** (1) مش زي الدرجة الواحدة (صفر). ده مش
    // سهو: الإضافة الجماعية كانت بتحط DEFAULT_RESTOCK_QTY دايمًا من غير
    // أي اختيار، فلو خلّينا الافتراضي صفر كنا هنغيّر سلوك شغّال من غير
    // ما حد يطلب. المفتاح بيدّي الاختيار، والافتراضي زي ما هو.
    const startOne = !!(document.getElementById('range-start-one') || {}).checked;
    state.rangeStartsWithOne = startOne;
    const branchQty = startOne ? 1 : 0;
    addBtn.disabled = true;
    statusEl.style.color = 'var(--text-secondary)';
    statusEl.textContent = 'جارٍ الإضافة...';

    try {
      const res = await addGradeRange(categoryId, from, to, group, branchQty);
      if (!res.added) {
        statusEl.style.color = 'var(--text-secondary)';
        statusEl.textContent = 'كل الأرقام دي موجودة عندك خلاص.';
        addBtn.disabled = false;
        return;
      }
      const where = group ? ` في "${group}"` : '';
      statusEl.style.color = 'var(--ok)';
      statusEl.textContent = `✅ اتضافت ${res.added} درجة${where}${res.skipped ? ` (${res.skipped} كانوا موجودين)` : ''}.`;
      setTimeout(close, 1200);
    } catch (err) {
      console.error(err);
      statusEl.style.color = 'var(--danger-text)';
      statusEl.textContent = 'تعذّرت الإضافة: ' + (err.message || err);
      addBtn.disabled = false;
    }
  });
}

// ============================================================
// ⚡ قراءة الدرجة من الذاكرة — مش من السحابة
// ============================================================
// ⚠️ ده كان أهم سبب لبطء الأزرار.
//
// كل زرار (تزويد، +، −، خلصت) كان بيبدأ بـ `await gradeRef.get()` — يعني
// **يروح للسحابة ويستنى الرد** قبل ما يعمل أي حاجة. على نت بطيء ده ثانية
// أو اتنين، وانت بتضغط 5 مرات ورا بعض فبتحس إن الزرار "بيسمع مرة وبعدين
// يقف".
//
// والغريب إننا مش محتاجين السحابة أصلًا: النظام مشترك في استماع مباشر على
// درجات الفئة المفتوحة، فالبيانات **قدامنا في state.grades** ومتحدّثة أول
// بأول. القراءة من الذاكرة فورية، وبتشتغل وانت **قافل النت**.
//
// السحابة بتفضل احتياطي للحالة الوحيدة اللي الدرجة مش فيها الذاكرة (فئة
// مش مفتوحة دلوقتي).
function gradeFromState(categoryId, gradeId) {
  if (categoryId !== state.activeCategoryId) return null;
  const g = (state.grades || []).find((x) => x.id === gradeId);
  return g ? { ...g } : null;
}

async function readGrade(categoryId, gradeId) {
  const local = gradeFromState(categoryId, gradeId);
  if (local) return local;
  const snap = await db.collection('categories').doc(categoryId).collection('grades').doc(gradeId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

function gradeRefOf(categoryId, gradeId) {
  return db.collection('categories').doc(categoryId).collection('grades').doc(gradeId);
}

// ============================================================
// نظام النواقص: طلب تزويد → رد أمين المخزن الرئيسي
// ============================================================
// ============================================================
// ⭐ الكمية المطلوبة — الافتراضي 1، وممكن أكتر
// ============================================================
// الطلب كان **مالوش كمية** خالص: الحالة بتبقى "معلّق" وخلاص، وأمين
// الرئيسي بيزوّد الكمية الافتراضية. ده كافي في 95% من الحالات، بس مكانش
// فيه طريقة تقول "أنا محتاج 3 مش 1".
//
// دلوقتي الكمية بتتخزّن مع الطلب (`requestedQty`) — بس **بس لو أكتر من
// واحد**. الطلب العادي بيفضل بنفس شكله في السحابة بالظبط، فالبيانات
// القديمة والأجهزة اللي لسه على نسخة قديمة مايتأثروش.
//
// ⚠️ حدّين لازم يتحققوا **قبل** ما الطلب يتسجّل:
//   • الدرجة "خلصت" (out) مافيش منها حاجة في الرئيسي أصلًا
//   • ومستحيل تطلب 3 والرئيسي فيه 1 — الرقم ده مش هيتنفّذ
// من غيرهم بتبقى طلبات معلّقة عمرها ما هتتقفل، وأمين الرئيسي بيدوّر على
// بضاعة مش موجودة.
function restockRequestLimit(g) {
  return Math.max(0, Number(g && g.mainQty) || 0);
}

// بترجّع رسالة الخطأ، أو '' لو الطلب سليم.
function restockRequestError(g, qty) {
  if (!g) return 'الدرجة مش موجودة.';
  if (g.status === 'out') return 'الدرجة دي خلصت من المخزن الرئيسي — مفيش منها حاجة تتطلب.';
  const limit = restockRequestLimit(g);
  if (limit <= 0) return 'مفيش كمية في المخزن الرئيسي.';
  if (qty > limit) return `الرئيسي فيه ${limit} بس، مينفعش تطلب ${qty}.`;
  return '';
}

async function requestShortage(gradeId, qty) {
  const categoryId = state.activeCategoryId;
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;

  const want = Math.max(1, parseInt(qty, 10) || 1);
  const err = restockRequestError(data, want);
  if (err) {
    alert('⚠️ ' + err);
    return;
  }

  const gradeRef = gradeRefOf(categoryId, gradeId);
  // ⚠️ الطلب العادي (واحد) **مابيكتبش الحقل خالص** — عشان شكل البيانات
  // يفضل زي ما هو بالظبط في الحالة الغالبة.
  // ⭐ `manualRequest: true` = ده قرار إنسان، مايتلغيش لوحده لما كمية
  // الفرع ترتفع. (الشرح الكامل عند nextStatusFromQuantities)
  const patch =
    want > 1
      ? { status: 'pending', requestedQty: want, manualRequest: true }
      : { status: 'pending', requestedQty: null, manualRequest: true };
  fireWrite(gradeRef.update(patch), 'طلب تزويد');
  pushUndo({
    label: `${gradeDisplayName(data)} — طلب تزويد${want > 1 ? ` (${want})` : ''}`,
    categoryId,
    gradeId,
    gradeLabel: gradeDisplayName(data),
    before: { status: data.status || 'normal', requestedQty: data.requestedQty || null },
    after: patch,
  });
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'request_shortage',
    categoryId,
    categoryName,
    gradeId,
    gradeNumber: data.number,
    requestedQty: want,
  });
}

async function cancelShortage(gradeId) {
  const categoryId = state.activeCategoryId;
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;
  const gradeRef = gradeRefOf(categoryId, gradeId);
  // الكمية المطلوبة بتتشال مع الإلغاء — الطلب اتلغى يعني مفيش كمية مطلوبة
  fireWrite(gradeRef.update({ status: 'normal', requestedQty: null, manualRequest: null }), 'إلغاء طلب تزويد');
  pushUndo({
    label: `${gradeDisplayName(data)} — إلغاء طلب التزويد`,
    categoryId,
    gradeId,
    gradeLabel: gradeDisplayName(data),
    before: { status: data.status || 'pending', requestedQty: data.requestedQty || null },
    after: { status: 'normal', requestedQty: null },
  });
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'cancel_shortage',
    categoryId,
    categoryName,
    gradeId,
    gradeNumber: data.number,
  });
}

async function fulfillShortage(gradeId, qty) {
  const categoryId = state.activeCategoryId;
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;
  const gradeRef = gradeRefOf(categoryId, gradeId);
  const transferQty = Math.min(qty, data.mainQty || 0);
  const newMainQty = Math.max(0, (data.mainQty || 0) - transferQty);
  const newBranchQty = (data.branchQty || 0) + transferQty;
  // ⚠️ الكمية المطلوبة بتتصفّر مع قفل الطلب — وإلا الطلب الجاي هيرث رقم
  // قديم ويظهر "×3" وهو أصلًا طلب عادي.
  fireWrite(
    gradeRef.update({ status: 'normal', mainQty: newMainQty, branchQty: newBranchQty, requestedQty: null, manualRequest: null }),
    'تزويد'
  );
  pushUndo({
    label: `${gradeDisplayName(data)} — تزويد بكمية ${transferQty}`,
    categoryId,
    gradeId,
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

  // التزويد **حركة مش بيع**: الفرع بيزيد مش يقل، فـsoldQty صفر.
  if (typeof recordMovement === 'function') {
    recordMovement({
      categoryId,
      categoryName,
      gradeId,
      gradeNumber: data.number,
      gradeName: data.name,
      soldQty: 0,
    });
  }
}

async function markOutOfStock(gradeId) {
  const categoryId = state.activeCategoryId;
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;
  fireWrite(gradeRefOf(categoryId, gradeId).update({ status: 'out' }), 'خلصت نهائيًا');
  pushUndo({
    label: `${gradeDisplayName(data)} — خلصت نهائيًا`,
    categoryId,
    gradeId,
    gradeLabel: gradeDisplayName(data),
    before: { status: data.status || 'pending' },
    after: { status: 'out' },
  });
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'mark_out_of_stock',
    categoryId,
    categoryName,
    gradeId,
    gradeNumber: data.number,
  });
}

async function resetOutOfStock(gradeId) {
  const categoryId = state.activeCategoryId;
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;
  fireWrite(gradeRefOf(categoryId, gradeId).update({ status: 'normal' }), 'إرجاع للتوفر');
  pushUndo({
    label: `${gradeDisplayName(data)} — رجّعها متاحة`,
    categoryId,
    gradeId,
    gradeLabel: gradeDisplayName(data),
    before: { status: data.status || 'out' },
    after: { status: 'normal' },
  });
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'reset_available',
    categoryId,
    categoryName,
    gradeId,
    gradeNumber: data.number,
  });

  // "رجّعها متاحة" برضه رجوع بعد خلاص → دورة جديدة (نفس قاعدة الكميات)
  if (typeof recordMovement === 'function') {
    recordMovement({
      categoryId,
      categoryName,
      gradeId,
      gradeNumber: data.number,
      gradeName: data.name,
      soldQty: 0,
      newCycle:
        typeof isNewCycleGrade === 'function' &&
        isNewCycleGrade(state.categories.find((c) => c.id === categoryId), data),
    });
  }
}

async function deleteGrade(categoryId, gradeId, gradeNumber) {
  const gradeRef = db.collection('categories').doc(categoryId).collection('grades').doc(gradeId);

  // قبل الحذف بناخد نسخة كاملة من الدرجة، عشان التراجع يقدر يرجّعها
  // بكل بياناتها (الكميات والحالة والمجموعة).
  try {
    const data = await readGrade(categoryId, gradeId);
    if (data) {
      const { id, ...fields } = data;
      pushUndo({
        type: 'delete',
        label: `حذف ${gradeDisplayName(data)}`,
        categoryId,
        gradeId,
        gradeLabel: gradeDisplayName(data),
        before: fields,
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
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;
  const oldValue = data[field] || 0;
  const newValue = Math.max(0, oldValue + delta);
  await applyQuantityChange(categoryId, gradeId, data, field, oldValue, newValue);
}

async function setQuantity(categoryId, gradeId, field, newValue) {
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;
  const oldValue = data[field] || 0;
  if (oldValue === newValue) return;
  await applyQuantityChange(categoryId, gradeId, data, field, oldValue, newValue);
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

// ------------------------------------------------------------
// اسم اللي ماسك الجهاز (Operator)
// ------------------------------------------------------------
// فيه حسابات بيستخدمها أكتر من شخص — حساب الطباعة مثلًا. السجل ساعتها
// بيقول "طبع: حساب الطباعة"، وده مابيقولش **مين** طبع فعلًا.
//
// الحل: الحساب اللي المالك يعلّمه "حساب مشترك" بيسأل كل جهاز **مرة
// واحدة** عن اسم اللي بيستخدمه، ويحفظ الاسم على الجهاز ده لوحده (مش في
// السحابة، عشان الجهاز التاني ما يتأثرش)، ويكتبه جنب اسم الحساب فوق
// ومع كل حركة في السجل.
//
// ⚠️ ده **مش** اسم نقطة الطباعة (DEVICE_NAME_KEY). ده اسم آلة
// ("كمبيوتر الكاشير")، وده اسم بني آدم — والاتنين ممكن يبقوا على نفس
// الجهاز في نفس الوقت.
//
// ⚠️ والمفتاح متعلّق بـuid الحساب مش بالجهاز لوحده: لو الجهاز اتسجّل
// عليه حسابين مختلفين، كل حساب له اسمه — من غير كده الاسم كان هيتسرّب
// من حساب للتاني.
const OPERATOR_NAME_PREFIX = 'tazweed_operator_';
const OPERATOR_NAME_MAX = 20;

function operatorNameKey(uid) {
  return OPERATOR_NAME_PREFIX + (uid || 'anon');
}

function getOperatorName() {
  if (!state.user) return '';
  try {
    return (localStorage.getItem(operatorNameKey(state.user.uid)) || '').trim();
  } catch (err) {
    return '';
  }
}

function saveOperatorName(name) {
  if (!state.user) return;
  const clean = String(name || '').trim().slice(0, OPERATOR_NAME_MAX);
  try {
    if (clean) localStorage.setItem(operatorNameKey(state.user.uid), clean);
    else localStorage.removeItem(operatorNameKey(state.user.uid));
  } catch (err) {
    console.error('تعذّر حفظ اسم المستخدم على الجهاز:', err);
  }
}

// الحساب متعلّم "مشترك" من المالك في شاشة الحسابات.
function isSharedAccount(profile) {
  return !!(profile || state.profile || {}).sharedAccount;
}

let operatorAskOpen = false;

// بيسأل عن الاسم. `force` = المستخدم هو اللي طلب يغيّره بنفسه، فيبقى
// عنده زرار "إلغاء". من غيرها (أول دخول) مفيش إلغاء — عشان الغرض كله
// إن الحركات ما تفضلش مجهولة.
function askOperatorName(force) {
  if (operatorAskOpen) return;
  operatorAskOpen = true;
  const current = getOperatorName();

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:2300;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:340px; width:100%;">
      <div style="font-size:15px; font-weight:500; margin-bottom:6px;">👤 مين اللي ماسك الجهاز ده؟</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.7; margin-bottom:12px;">
        الحساب ده بيستخدمه أكتر من شخص. اكتب اسمك عشان يتكتب جنب اسم الحساب
        فوق، ويتسجّل مع كل حركة تعملها.
        <br>الاسم بيتحفظ على الجهاز ده بس — مرة واحدة ومش هيتسألك تاني.
      </div>
      <div class="field">
        <label>اسمك</label>
        <input class="input" id="op-name" maxlength="${OPERATOR_NAME_MAX}" placeholder="مثلًا: محمود"
               value="${escapeHTML(current)}" />
      </div>
      <div id="op-err" style="font-size:12px; color:var(--danger); min-height:16px; margin-bottom:8px;"></div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" id="op-save" style="flex:1;">حفظ</button>
        ${force ? '<button class="btn" id="op-cancel">إلغاء</button>' : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    operatorAskOpen = false;
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  const input = overlay.querySelector('#op-name');
  const err = overlay.querySelector('#op-err');
  const cancelBtn = overlay.querySelector('#op-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', close);

  const save = () => {
    const val = (input.value || '').trim();
    if (!val) {
      err.textContent = 'اكتب اسمك الأول.';
      input.focus();
      return;
    }
    saveOperatorName(val);
    close();
    render();
  };
  overlay.querySelector('#op-save').addEventListener('click', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });
  setTimeout(() => input.focus(), 50);
}

// بينده أول ما بيانات الحساب توصل: لو الحساب مشترك والجهاز لسه مسجّلش
// اسم، اسأل. بيتنده من مكان واحد (بعد ما البروفايل يتحمّل) عشان ما
// يتكررش.
// الشريحة اللي بتظهر جنب اسم الحساب فوق. زرار عشان اللي غيّر شيفت
// يقدر يبدّل الاسم من غير ما يدوّر عليه في القوايم.
function operatorChipHTML() {
  if (!isSharedAccount()) return '';
  const name = getOperatorName();
  return `<button class="topbar-op" id="operator-chip" type="button" title="غيّر الاسم">${
    name ? escapeHTML(name) : 'مين انت؟'
  }</button>`;
}

// "مين عمل الحركة" في السجل: اسم الحساب، وجنبه اسم الشخص لو الحركة
// اتسجّلت من حساب مشترك.
function entryWho(entry) {
  const who = entry.userName || '';
  return entry.operatorName ? `${who} — ${entry.operatorName}` : who;
}

function ensureOperatorName() {
  if (!isSharedAccount()) return;
  if (getOperatorName()) return;
  askOperatorName(false);
}

function logActivity(details) {
  // ⭐ لو الحساب مشترك، بنكتب كمان اسم اللي ماسك الجهاز — من غيره كل
  // حركات الطباعة بتبقى باسم حساب واحد ومفيش طريقة نعرف مين عملها.
  const operator = isSharedAccount() ? getOperatorName() : '';
  return fireWrite(
    db.collection('activityLog').add({
      ...details,
      userId: state.user.uid,
      userName: state.profile.name,
      ...(operator ? { operatorName: operator } : {}),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }),
    'سجل العمليات'
  );
}

async function applyQuantityChange(categoryId, gradeId, gradeData, field, oldValue, newValue) {
  const gradeRef = gradeRefOf(categoryId, gradeId);
  const data = gradeData || {};
  const update = { [field]: newValue };

  // ⭐ الحالة بتتحدد من الكميات لوحدها (شرح القاعدة عند nextStatusFromQuantities)
  const nextStatus = nextStatusFromQuantities(data, field, newValue);
  if (nextStatus) {
    update.status = nextStatus;
    // ⭐ الطلب اللي النظام بيعمله لوحده بيتعلّم **تلقائي** — عشان يقدر
    // يتلغي لوحده بعدين. وأي حالة تانية بتشيل العلامة خالص.
    update.manualRequest = nextStatus === 'pending' ? false : null;
  }

  fireWrite(gradeRef.update(update), 'تعديل كمية');

  // بنسجّل الحركة للتراجع: القيم **قبل** التعديل، واللي كتبناه بعده.
  const fieldLabel = field === 'branchQty' ? 'الفرع' : 'الرئيسي';
  pushUndo({
    label: `${gradeDisplayName(data)} — ${fieldLabel}: ${oldValue} ← ${newValue}`,
    categoryId,
    gradeId,
    gradeLabel: gradeDisplayName(data),
    before: nextStatus
      ? { [field]: oldValue, status: data.status || 'normal' }
      : { [field]: oldValue },
    after: update,
  });

  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'edit',
    categoryId,
    categoryName,
    gradeId,
    gradeNumber: data.number,
    field,
    oldValue,
    newValue,
  });

  // ⭐ حركة الدرجة — مستند منفصل في gradeStats، **مش** جوّه الدرجة.
  // (الشرح المطوّل في js/movement.js: قواعد الأمان بتقفل حقول الدرجة
  // بـ17 تركيبة، فأي حقل جديد هناك كان هيمنع تعديل الكميات خالص.)
  // "بيع" = كمية الفرع قلّت. النقل من الرئيسي مش بيع.
  if (typeof recordMovement === 'function') {
    // ⭐ رجعت بعد ما خلصت؟ ساعة "راكدة" تبدأ من أول — الدرجة دي شحنة
    // تانية. (الأساسيات والفئات المعلّم عليها مستثناة — isNewCycleGrade)
    const cameBack =
      (data.status || '') === 'out' &&
      nextStatus &&
      nextStatus !== 'out' &&
      typeof isNewCycleGrade === 'function' &&
      isNewCycleGrade(state.categories.find((c) => c.id === categoryId), data);
    recordMovement({
      categoryId,
      categoryName,
      gradeId,
      gradeNumber: data.number,
      gradeName: data.name,
      soldQty: field === 'branchQty' ? Math.max(0, (Number(oldValue) || 0) - (Number(newValue) || 0)) : 0,
      newCycle: cameBack,
    });
  }

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
      categoryId,
      categoryName,
      gradeId,
      gradeNumber: data.name || data.number,
      auto: true,
    });
  }
}

// عدد السطور اللي بنجيبها. الشاشة بتفلتر منها بالأيام والأقسام.
const LOG_FETCH_LIMIT = 400;

function subscribeActivityLog() {
  if (unsubActivityLog) unsubActivityLog();
  unsubActivityLog = db
    .collection('activityLog')
    .orderBy('timestamp', 'desc')
    .limit(LOG_FETCH_LIMIT)
    .onSnapshot(
      { includeMetadataChanges: true },
      (snap) => {
        // ============================================================
        // ⭐⭐ serverTimestamps: 'estimate' — مش رفاهية
        // ============================================================
        // العملية اللي بتتعمل والنت مقفول بيتحطّ لها وقت من السيرفر،
        // والوقت ده **مابيتحسبش غير لما ترفع**. من غير 'estimate'،
        // القيمة بترجع null والسطر بيظهر وقته "—".
        //
        // القياس (على محاكي Firestore الحقيقي، 60 سطر قديم + سطر مفصول):
        //   • بالتقدير  → السطر بيطلع **أول القايمة** بوقت صحيح
        //   • من غيره   → الوقت null
        // يعني اللي بتعمله وانت مفصول بيبان لك فورًا وفي مكانه الصح.
        state.activityLog = snap.docs.map((d) => ({
          id: d.id,
          pending: d.metadata.hasPendingWrites,
          ...d.data({ serverTimestamps: 'estimate' }),
        }));
        renderFromData();
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
    if (unsubAllDeviceSettings) { unsubAllDeviceSettings(); unsubAllDeviceSettings = null; }
    if (unsubDeviceSettings) { unsubDeviceSettings(); unsubDeviceSettings = null; }
    stopOverview();
    stopStationHeartbeat();
    // ⚠️ لازم تتصفّر مع تغيير الحساب: العدّاد وأسماء الدرجات بتاعت
    // الإشعار بتخص الشخص اللي كان داخل. من غير ده، اللي يدخل بعده يلاقي
    // إشعار باسم درجات مالوش دعوة بيها.
    resetRestockNotifyState();

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
          state.printCart = sanitizePrintCart(saved.printCart);
        }
      }

      // موظف الطباعة بيفتح على شاشته على طول ومايقدرش يخرج منها.
      if (isPrintOperator(state.profile)) {
        state.screen = 'print';
        if (!productsCache) loadProducts().then(render).catch((err) => console.warn('تعذّر تحميل الأصناف:', err));
      }

      state.view = 'dashboard';
      render();

      // لو الحساب مشترك والجهاز لسه مسجّلش اسم — نسأل مرة واحدة بعد ما
      // الشاشة تبان (مش قبلها، عشان المودال ما يطلعش على شاشة فاضية).
      ensureOperatorName();

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
        subscribePrintSettings();
        subscribeDeviceSettings();
        subscribePrintStations();
        subscribeAllDeviceSettings();
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
      subscribePrintSettings();
      // ⭐ استثناء الجهاز ده هو — لازم **كل** جهاز يشترك فيه، مش شاشة
      // التحكم بس، وإلا الإعداد يتبعتله وهو مايقراهوش.
      subscribeDeviceSettings();
      subscribePrintStations();
      subscribeAllDeviceSettings();
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
        renderFromData();
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
        renderFromData();
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

// ⚠️ الشريط ده **ممنوع يغيّر ارتفاعه**.
//
// المشكلة اللي كانت بتحصل: النص كان بيتغيّر من "متصل" (4 حروف) لـ"جارٍ رفع
// البيانات..." (18 حرف). الشريط بيلف على سطرين → بيعلى → كل اللي تحته بينزل
// → وانت في نص ضغطات متتالية على زرار، الزرار بيتحرك من تحت صباعك وضغطتك
// بتقع على زرار تاني.
//
// الحل: النص بياخد **عرض ثابت** على مقاس أطول حالة، و nowrap. الكلمة
// بتتغيّر جوه نفس المساحة والشريط مابيتحركش ولا نص مليمتر.
// كل حالة ليها نصّين: طويل للكمبيوتر وقصير للموبايل. والاتنين بياخدوا
// **عرض ثابت** من styles.css، فالكلمة بتتغيّر جوه نفس المساحة.
//
// ⚠️ ليه نص قصير للموبايل أصلًا؟ أول محاولة كانت عرض ثابت واحد لكل
// الشاشات — النتيجة إن الشريط بقى **دايمًا** أطول على الموبايل (105px بدل
// 65px). يعني حلّينا القفزة بإننا خلّينا المشكلة دايمة. النص القصير
// بيخلّي العرض الثابت صغير، فالشريط مابيعلاش لا في الحالة دي ولا دي.
// ============================================================
// ⭐ "واصلين للسيرفر فعلًا؟" — استخدمها بدل state.isOnline لوحدها
// ============================================================
// navigator.onLine بتقول إن الجهاز متوصّل بشبكة، مش إن الإنترنت شغّال.
// fromCache بيقول إن Firestore بيقرا من الذاكرة المحلية، يعني **مش
// واصل**. الاتنين مع بعض هما الحقيقة.
function isServerReachable() {
  return state.isOnline && !state.fromCache;
}

function connectionDotHTML() {
  let colorVar, label, short;
  // ⚠️ الشرطين مع بعض مقصودين:
  //   • navigator.onLine  → الجهاز متوصّل بشبكة أصلًا؟
  //   • state.fromCache   → واصلين لسيرفر Firestore فعلًا؟
  // الأولى لوحدها كانت بتقول "متصل" والنت مفصول — الواي فاي شغّال
  // والراوتر مقطوع، أو داتا من غير رصيد.
  if (!state.isOnline || state.fromCache) {
    colorVar = 'var(--danger-text)';
    label = 'غير متصل بالإنترنت';
    short = 'مفصول';
  } else if (state.hasPendingWrites) {
    colorVar = 'var(--gold)';
    label = 'جارٍ رفع البيانات...';
    short = 'بيرفع';
  } else {
    colorVar = 'var(--ok)';
    label = 'متصل';
    short = 'متصل';
  }
  return `
    <span class="conn" title="${escapeHTML(label)}">
      <span class="conn-dot" style="background:${colorVar};"></span>
      <span class="conn-long">${escapeHTML(label)}</span>
      <span class="conn-short">${escapeHTML(short)}</span>
    </span>`;
}

document.addEventListener('DOMContentLoaded', init);
