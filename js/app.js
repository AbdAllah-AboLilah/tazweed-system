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
  catMoving: null,             // الفئة اللي "ماسكها" في وضع الترتيب
  // شاشة إضافة الدرجة بتفضل مفتوحة بعد الإضافة، فمحتاجة تفتكر:
  lastGradeGroup: '',          // آخر مجموعة اخترتها (عشان ماتختارهاش كل مرة)
  lastAddedGrade: null,        // آخر درجة اتضافت — بتظهر كرسالة تأكيد
  newGradeStartsWithOne: false, // الافتراضي صفر في الفرع، والمفتاح ده بيخلّيه 1
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
  const bar = document.querySelector('.topbar');
  const tabs = document.querySelector('.tabs');
  return (bar ? bar.offsetHeight : 0) + (tabs ? tabs.offsetHeight : 0);
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
function pendingDotHTML(clickable) {
  const n = totalPendingNow();
  if (!n) return '';
  const tag = clickable ? 'button' : 'span';
  const extra = clickable
    ? ' id="pending-dot-btn" title="اعرض الفئات اللي مطلوب تزويدها" style="cursor:pointer;"'
    : '';
  return `<${tag} class="pending-dot"${extra}>${escapeHTML(n)}</${tag}>`;
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
                   ? `<strong style="color:var(--primary,#1565c0);">ماسك: ${escapeHTML((state.categories.find((c) => c.id === state.catMoving) || {}).name || '')}</strong>
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
            <div class="side-item side-item-order ${held ? 'side-item-held' : ''}">
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
  } else if (state.screen === 'users') {
    bodyHTML = can(state.profile, 'manageUsers')
      ? usersScreenHTML()
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

  return `
    <div>
      <div class="topbar">
        <div class="topbar-user">
          <span class="topbar-name">${escapeHTML(state.profile?.name)}</span>
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
            ${state.canInstallApp ? `<button class="btn" id="install-app-btn">⬇️ تثبيت التطبيق</button>` : ''}
            ${can(state.profile, 'viewActivity') ? `<button class="btn" id="activity-log-btn">${state.screen === 'activity' ? '📋 رجوع' : '📋 سجل العمليات'}</button>` : ''}
            <button class="btn" id="logout-btn">🚪 تسجيل خروج</button>
          </div>
        </div>
      </div>
      ${navRowHTML}
      <button class="to-top" id="to-top-btn" title="ارجع لفوق" aria-label="ارجع لفوق">▲</button>
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

// بادج الحالة لوحده. اتفصل عشان أوضاع التزويد والحذف تعرض الحالة كمان:
// الوضعين دول كانوا بيبلعوها خالص، فكنت بتعلّم على درجات من غير ما تعرف
// إنت بتحذف/بتطلب إيه. والدرجة اللي "خلصت نهائيًا" مالهاش مربّع تعليم
// أصلًا — من غير البادج مكانش فيه أي حاجة تقول ليه.
function statusBadgeHTML(g) {
  return `<span class="badge ${statusBadgeClass(g.status)}">${statusLabel(g.status)}</span>`;
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
  return `<td>${statusContentHTML(g, canEditBranch, canEditMain)}${gradePrintBtnHTML(g)}</td>`;
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

  // الزرار بيظهر لو **المجموعة اللي إنت فاتح عليها** مالهاش درجات أساسية.
  // قبل كده كان بيختفي أول ما أي مجموعة تاخدهم، فمكانش فيه طريقة تضيفهم
  // لمجموعة تانية.
  const baseScope = state.gradeGroupFilter === UNGROUPED_LABEL ? '' : state.gradeGroupFilter || '';
  const missingBase =
    canAddGrades && !state.grades.some((g) => g.isBase && (g.group || '') === baseScope);

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
    missingBase ? `<button class="btn menu-item" id="add-base-grades-btn">⚪ الدرجات الأساسية</button>` : '',
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
          ? `<div style="font-size:12px; color:#2e7d32; margin-bottom:8px;">
               ✅ اتضافت درجة ${escapeHTML(lastAdded.number)}${lastAdded.group ? ` في "${escapeHTML(lastAdded.group)}"` : ''} — كمّل
             </div>`
          : ''
      }
      <form id="add-grade-form" style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end;">
        <div class="field" style="margin-bottom:0;"><label>الدرجة (رقم)</label><input class="input" style="width:90px;" type="number" id="new-grade-number" data-draft="grade_num" required /></div>
        <div class="field" style="margin-bottom:0;"><label>الفرع</label><input class="input" style="width:70px;" type="number" id="new-grade-branch" value="${startWithOne ? 1 : 0}" /></div>
        <div class="field" style="margin-bottom:0;"><label>الرئيسي</label><input class="input" style="width:70px;" type="number" id="new-grade-main" value="0" /></div>
        ${groupSelectHTML('new-grade-group', cat, state.lastGradeGroup)}
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
      } else if (entry.action === 'add_base_grades') {
        itemLabel = escapeHTML(entry.categoryName || 'كل الفئات');
        detailLabel = `إضافة ${escapeHTML(entry.newValue)} درجة أساسية`;
      } else if (entry.action === 'bulk_branch_qty') {
        itemLabel = escapeHTML(entry.categoryName || 'كل الفئات');
        detailLabel = `ظبط كميات الفرع (${escapeHTML(entry.newValue)} درجة)`;
      } else if (entry.action === 'set_critical_qty') {
        itemLabel = escapeHTML(entry.categoryName || '');
        detailLabel = `تعديل حدود التنبيه (${escapeHTML(entry.newValue)} درجة)`;
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
  if (state.screen === 'users') attachUsersScreenEvents();

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
      if (screen === 'users') subscribeUsers();
    });
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
  wire('scan-barcode-btn', () => safeAsync(() => openBarcodeScanner(), 'فتح الكاميرا'));
  wire('import-btn', () => openImportDialog());
  wire('users-btn', () => {
    state.screen = 'users';
    state.sideMenuOpen = false;
    render();
    subscribeUsers();
  });
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

  // ---- 🖨️ طباعة مسمّى درجة واحدة من جوه الصف ----
  document.querySelectorAll('[data-print-grade-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.printingGradeId = btn.dataset.printGradeId;
      render();
      const input = document.getElementById('grade-print-qty');
      if (input) {
        input.focus();
        input.select();
      }
    });
  });
  document.querySelectorAll('[data-print-grade-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.printingGradeId = null;
      render();
    });
  });
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
// ⭐ الدرجات الأساسية بقت **لكل مجموعة ألوان**، مش مرة واحدة للفئة.
//
// قبل كده مفتاح منع التكرار كان **الاسم لوحده**، يعني لو عندك "أبيض" في
// مجموعة "كيوي" مكانش ينفع يبقى عندك "أبيض" في "نصار" — والفئة الواحدة
// عندك فيها مجموعات مختلفة كل واحدة ليها أبيضها وأسودها.
//
// المفتاح بقى **الاسم + المجموعة**. والدرجات القديمة (اللي مالهاش
// مجموعة) بتفضل زي ما هي وبتتحسب في خانة "من غير مجموعة" — يعني لو ضفت
// الأساسية لمجموعة جديدة، القديمة مابتتلمسش ومابتتكررش.
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
      criticalQty: Number(criticalQty) || DEFAULT_BASE_CRITICAL_QTY,
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
      </div>
      <div id="base-status" style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;"></div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn btn-primary" id="base-this">ضيفهم للمجموعة دي</button>
        <button class="btn" id="base-all">ضيفهم لكل الفئات من غير مجموعة (${state.categories.length})</button>
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
  const chosenGroup = () => document.getElementById('base-group').value || '';

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
        // على كل الفئات: المجموعة المختارة مش موجودة بالضرورة في كل فئة،
        // فبنضيف "من غير مجموعة" — وده اللي كان بيحصل قبل الخاصية دي.
        total += await addBaseGradesToCategory(cat.id, critical(), '');
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
        // ضبط الطباعة بيتنشر مع النبضة عشان جهاز جديد يقدر ينسخه بدل ما
        // يعيد المعايرة من الأول.
        //
        // ⚠️ اللي **مش** موجود هنا مقصود: اسم الجهاز ومعرّفه. دول لازم
        // يفضلوا فريدين لكل جهاز، وإلا الجهازين هيتلخبطوا في قايمة الطباعة
        // عن بُعد ويبقى فيه جهازين بنفس الاسم مش عارف تبعت لمين.
        printSetup: {
          align: getPrintAlign(),
          tweaks: getPrintTweaksMap(),
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
// مقاس اللفة اللي في المحل. مكتوب في مكان واحد عشان لو اتغيّرت اللفة
// يتغيّر سطر واحد بس.
const LABEL_SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };

// ------------------------------------------------------------
// شاشة "قبل الطباعة"
// ------------------------------------------------------------
// opts:
//   hideCopies      — العدد بيتحدّد لكل درجة على حدة (وضع ملصقات الدرجات)
//   showNoPrice     — مفتاح "من غير سعر" (ملصق الصنف بس — هو اللي فيه سعر)
//   showGroupName   — مفتاح "باسم المجموعة" (ملصقات الدرجات بس)
//
// المفتاحين بيتحفظوا في **الإعدادات المشتركة** مش على الجهاز: الاختيار ده
// قرار شغل ("ملصقاتنا من غير سعر")، مش خاصية جهاز — فلازم يبقى واحد على
// الأربع أجهزة من غير ما حد يعيد ظبطه.
function promptLabelSize(callback, opts) {
  const o = typeof opts === 'boolean' ? { hideCopies: opts } : opts || {};
  const saved = getSharedPrintSettings() || {};
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;';
  const toggle = (id, label, on, hint) => `
      <label class="print-opt">
        <input type="checkbox" id="${id}" ${on ? 'checked' : ''} />
        <span><strong>${label}</strong><br><span class="print-opt-hint">${hint}</span></span>
      </label>`;
  overlay.innerHTML = `
    <div class="card" style="max-width:300px; text-align:center;">
      <div style="margin-bottom:12px; font-size:14px; font-weight:500;">طباعة ملصق</div>
      <div class="field" style="text-align:start; ${o.hideCopies ? 'display:none;' : ''}">
        <label>عدد اللاصقات</label>
        <input class="input" type="number" id="label-copies" value="1" min="1" max="1000" inputmode="numeric" />
      </div>
      ${o.showNoPrice ? toggle('opt-no-price', 'من غير سعر', saved.labelNoPrice, 'الاسم والباركود بس — والخط بيكبر مكان السعر') : ''}
      ${o.showGroupName ? toggle('opt-group-name', 'اكتب اسم المجموعة', saved.gradeLabelWithGroup, 'يعني "كيوي درجة 56" بدل "درجة 56"') : ''}
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
  const pick = (id, sizeOpts) =>
    document.getElementById(id).addEventListener('click', () => {
      const raw = parseInt(document.getElementById('label-copies').value, 10);
      const copies = Math.max(1, Math.min(MAX_LABEL_COPIES, Number.isNaN(raw) ? 1 : raw));
      const noPriceEl = document.getElementById('opt-no-price');
      const groupEl = document.getElementById('opt-group-name');
      const noPrice = !!(noPriceEl && noPriceEl.checked);
      const withGroup = !!(groupEl && groupEl.checked);
      document.body.removeChild(overlay);

      // الحفظ مابيوقّفش الطباعة: لو النت واقع، تطبع دلوقتي والاختيار
      // بيتحفظ محليًا ويتزامن بعدين.
      const patch = {};
      if (noPriceEl) patch.labelNoPrice = noPrice;
      if (groupEl) patch.gradeLabelWithGroup = withGroup;
      if (Object.keys(patch).length) Promise.resolve(saveSharedPrintSettings(patch)).catch(() => {});

      callback({ ...sizeOpts, copies, noPrice, withGroup });
    });

  // halves = عدد الأقسام اللي اللاصقة الواحدة مقسومة لها والماكينة بتحسبهم
  // لاصقة واحدة. المحتوى بيتكرر في كل قسم.
  //
  // المقاسات التانية (38×25 قطعة واحدة، 38×18، 2×4 إنش) اتشالت خلاص:
  // اللفة اللي في المحل مقاس واحد، والخيارات الزيادة كانت بس فرصة إن حد
  // يختار غلط ويطلع ورق مقصوص. لو جِبنا لفة تانية، يترجّع سطر واحد هنا.
  pick('size-measured', { ...LABEL_SIZE });
  document.getElementById('size-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
}

// توليد الـQR كصورة جاهزة (data URI) **في الصفحة الرئيسية**، مش جوه صفحة
// الطباعة. السبب: لما QZ Tray بياخد الـHTML، هو بيرسمه بمحرك داخلي بتاع
// Java، ومش مضمون إنه يستنى سكريبت خارجي يتحمّل ويولّد الكود قبل ما يطبع.
// الصورة الجاهزة بتشيل الاحتمال ده خالص (وكمان بتخلي المعاينة فورية).
// ============================================================
// ⭐ توليد الـQR — أكبر مربعات ممكنة وأعلى تصحيح أخطاء
// ============================================================
// السبب اللي خلانا نعيد كتابة الجزء ده: ملصق صنف حقيقي طلع صعب القراءة،
// وملصق الفئة على نفس الطابعة كان شغّال عادي. الفرق الوحيد بينهم طول
// الرقم:
//
//   باركود الفئة  = 28144            (5 أرقام)
//   باركود الصنف  = 6291108735848   (13 رقم — EAN-13)
//
// والقياس الفعلي على نفس المساحة (10.7 ملم) بالمكتبة القديمة:
//
//   5 أرقام   → 21 مربع → كل مربع 4.08 نقطة طباعة  ✅
//   13 رقم    → 25 مربع → كل مربع 3.42 نقطة طباعة  ❌
//
// الطابعة الحرارية دقتها 203 نقطة/إنش، يعني النقطة 0.125 ملم. تحت 4 نقط
// للمربع تقريبًا، القارئ مابيعرفش يفصل المربعات عن بعضها.
//
// ------------------------------------------------------------
// حاجتين اتصلحوا
// ------------------------------------------------------------
// 1) **الوضع الرقمي (Numeric).** معيار الـQR فيه وضع خاص للأرقام بيخزّن
//    كل 3 أرقام في 10 بت بدل 24 بت. المكتبة القديمة (qrcodejs) مابتعرفش
//    الوضع ده خالص — بتخزّن كل رقم كحرف كامل. ومعظم الباركودات عندنا
//    أرقام صافية، فكنا بندفع ضعف المساحة على الفاضي.
//
// 2) **المكتبة القديمة بتختار نسخة أكبر من اللازم.** قِسنا نفس المحتوى
//    (13 رقم، وضع أحرف، مستوى M) على المكتبتين: القديمة طلّعت 25 مربع،
//    والجديدة 21. يعني كان فيه هدر حتى من غير الوضع الرقمي.
//
// النتيجة بعد التعديل:
//
//   5 أرقام   → 21 مربع بمستوى تصحيح H (الأعلى) — نفس الحجم، تصحيح أقوى
//   13 رقم    → 21 مربع بمستوى تصحيح H          — أكبر **و** تصحيح أقوى
//   18 رقم    → 21 مربع بمستوى تصحيح Q
//
// يعني مفيش أي مقايضة هنا: المربعات أكبر أو زيها، وتصحيح الأخطاء أعلى أو
// زيه. الاتنين في صالحنا.
//
// ⚠️ المكتبة الجديدة **جوه المستودع** (js/vendor) مش من سيرفر خارجي —
// عشان تشتغل من غير نت من أول لحظة.

// بترجّع كائن الكود بأقل عدد مربعات ممكن، أو null لو المكتبة مش موجودة.
//
// ------------------------------------------------------------
// ⚠️ ترتيب الاختيار هنا مش عشوائي — اتبنى على قياس
// ------------------------------------------------------------
// جرّبنا 8 باركودات حقيقية على فاكّ QR مع محاكاة الطباعة الحرارية، وطلع:
//
//   • الوضع الرقمي (Numeric) بيغيّر شكل مصفوفة الكود كلها. للأرقام
//     الطويلة ده مكسب كبير، لكن للأرقام القصيرة الكود بيتملي "حشو" ثابت
//     ومتكرر، والنتيجة قراءة **أسوأ** — قِسناها: 0 من 6 نجحت بالوضع
//     الرقمي مقابل 3 من 6 بالوضع العادي.
//
//   • والمفاجأة: المكتبة الجديدة بتطلّع باركود الـ13 رقم في 21 مربع
//     **حتى بالوضع العادي** (القديمة كانت بتطلّعه 25). يعني المكسب كله
//     كان جاي من إن المكتبة القديمة بتختار نسخة أكبر من اللازم، مش من
//     الوضع الرقمي.
//
// فالقاعدة: نبدأ بـ**نفس الإعداد اللي شغّال دلوقتي** (وضع عادي + مستوى M)،
// ومانغيّرش غير لو التغيير **بيقلّل عدد المربعات فعلًا**. كده الباركودات
// اللي بتتقرا كويس دلوقتي مابتتغيّرش بأي حرف، والباركودات الطويلة بس هي
// اللي بتستفيد.
function buildBestQR(content) {
  if (typeof qrcode !== 'function') return null;

  const isDigits = /^[0-9]+$/.test(content);
  // بالترتيب: الأول هو إعداد النظام الحالي، وبعده البدائل اللي ممكن تصغّر
  // الكود. أول واحد يوصل لأقل عدد مربعات هو اللي بياخدها (التعادل للأول).
  const combos = [
    { mode: 'Byte', level: 'M' },
    ...(isDigits ? [{ mode: 'Numeric', level: 'M' }] : []),
    { mode: 'Byte', level: 'L' },
    ...(isDigits ? [{ mode: 'Numeric', level: 'L' }] : []),
  ];

  let best = null;
  for (const combo of combos) {
    try {
      const qr = qrcode(0, combo.level);
      qr.addData(content, combo.mode);
      qr.make();
      const count = qr.getModuleCount();
      if (!best || count < best.count) best = { qr, count, ...combo };
    } catch (err) {
      // المحتوى مش داخل في الإعداد ده — عادي، نجرّب اللي بعده
    }
  }
  return best;
}

function generateQRDataURL(text, sizePx) {
  const content = String(text || '');

  const best = buildBestQR(content);
  if (best) {
    // بنرسم المربعات بنفسنا على مقاس **من مضاعفات عددها بالظبط**، فكل
    // مربع بيطلع بنفس عدد البكسلات من غير تقريب.
    //
    // ⚠️ والمقاس بيفضل قريب من 200 بكسل زي ما كان. جرّبنا قبل كده نكبّره
    // لـ400 عشان "الدقة" والنتيجة كانت **أسوأ** على الطابعة: الصورة بتتصغّر
    // لـ86 نقطة طباعة، وكل ما التصغير يزيد بيضيع تفاصيل أكتر. (التفاصيل
    // في README — v0.23.1)
    const target = Number(sizePx) || 200;
    const scale = Math.max(1, Math.round(target / best.count));
    const side = best.count * scale;

    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, side, side);
      ctx.fillStyle = '#000000';
      for (let row = 0; row < best.count; row++) {
        for (let col = 0; col < best.count; col++) {
          if (best.qr.isDark(row, col)) ctx.fillRect(col * scale, row * scale, scale, scale);
        }
      }
      try {
        return Promise.resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        /* هنكمّل للطريقة القديمة تحت */
      }
    }
  }

  // احتياطي: المكتبة القديمة، لو الجديدة مش متحمّلة لأي سبب.
  return legacyQRDataURL(content, sizePx);
}

function legacyQRDataURL(text, sizePx) {
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
// ============================================================
// 🖼️ رسم الملصق كصورة — بنقط الطابعة بالظبط
// ============================================================
// ⚠️ ليه اتعمل ده، بالتفصيل، عشان محدش يرجّعه بالغلط:
//
// الطريقة القديمة كانت بتبعت **HTML** للطابعة، واللي بيرسمه هو محرك تاني
// خالص (جافا جوه QZ على كمبيوتر الكاشير). المحرك ده:
//   • عنده خطوط مختلفة عن المتصفح اللي عندك
//   • بيقسّم السطور بمقاسات مختلفة
//   • فبيطلع شكل **مختلف عن المعاينة اللي شوفتها**
//
// والنتيجة الحقيقية اللي حصلت: المعاينة على التليفون بتقول
// "Chanvie Leen 58047" كامل، والمطبوع بيقول "Chanvie Leen" بس — الجزء
// اللي مادخلش بيتقص في صمت. جرّبنا نصلّحها بالقياس وبهامش أمان، وفضلت.
//
// السبب إن المشكلة **مش في الحساب** — المشكلة إن اللي بيرسم مش إحنا.
//
// فبقينا **نرسم الملصق بنفسنا** على canvas بمقاس نقط الطابعة بالظبط،
// ونبعت صورة جاهزة. المحرك التاني مابقاش ليه أي دور: بياخد صورة ويحطها
// على الورق زي ما هي.
//
//   38 مم × 203 نقطة/بوصة ÷ 25.4  =  304 نقطة
//   25 مم × 203 ÷ 25.4             =  200 نقطة
//
// ومكسب تاني مهم: مربعات الـQR بقت **عدد صحيح من النقط** (4 نقط للمربع)
// بدل ما المحرك يصغّرها بكسر ويضيّع حروفها.
//
// ومكسب تالت: الصورة أخف بكتير من HTML فيه صورة base64 جوّه — فالطبعات
// الكبيرة (100 ملصق) بقت تعدّي، وقبل كده كانت بتقف.
const PRINTER_DPI = 203; // Xprinter XP-233B وأغلب الطابعات الحرارية
const mmToDots = (mm) => (mm * PRINTER_DPI) / 25.4;

// مقاس الملصق بنقط الطابعة — 38×25 مم = 304×200 نقطة
function labelDots(sizeOptions) {
  return {
    w: Math.round(mmToDots(sizeOptions.pageWidthMm)),
    h: Math.round(mmToDots(sizeOptions.pageHeightMm)),
  };
}

// بتدوّر على أكبر حجم خط بيخلّي النص يدخل في عدد السطور المسموح —
// **بنفس الـcontext اللي هيرسم**، فالقياس مطابق للرسم 100%.
function fitCanvasFont(ctx, text, maxW, maxLines, weight, family, capPx) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { size: capPx || 10, lines: [] };

  const layout = (size) => {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (ctx.measureText(next).width <= maxW || !cur) {
        // كلمة واحدة أطول من السطر كله → بتتكسر بالحروف
        if (!cur && ctx.measureText(w).width > maxW) {
          let piece = '';
          for (const ch of w) {
            if (ctx.measureText(piece + ch).width > maxW && piece) {
              lines.push(piece);
              piece = ch;
            } else piece += ch;
          }
          cur = piece;
          continue;
        }
        cur = next;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  let lo = 3;
  let hi = capPx || 60;
  let best = layout(lo);
  let bestSize = lo;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    const lines = layout(mid);
    if (lines.length <= maxLines) {
      lo = mid;
      best = lines;
      bestSize = mid;
    } else {
      hi = mid;
    }
  }
  return { size: bestSize, lines: best };
}

// بترسم نص متعدد السطور في النص أفقيًا، وبترجّع الارتفاع اللي أخده.
function drawLines(ctx, lines, size, weight, family, centerX, topY, lineH) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, centerX, topY + lineH * (i + 0.5)));
  return lineH * lines.length;
}

// ============================================================
// 🔍 الرسم بدقة أعلى وبعدين التصغير
// ============================================================
// ⚠️ المشكلة اللي بيحلها ده: الطابعة الحرارية **أبيض وأسود بس**، مفيش
// عندها رمادي. فلما نرسم خط صغير (21 نقطة ارتفاع) ونحوّله لأبيض/أسود
// على طول، حروفه بتطلع **مسنّنة ومنغمشة** — كل نقطة يا بيضا يا سودا،
// ومفيش حاجة في النص تنعّم الحرف.
//
// الحل: نرسم على مساحة **3 أضعاف** (912×600 بدل 304×200)، وبعدين نصغّر
// بحساب **متوسط كل 9 نقط**. كده كل نقطة نهائية بتاخد قرارها من 9 عيّنات
// مش من واحدة — فحرف الخط بيقع في مكانه الصح وحوافه بتبقى أنضف بكتير.
//
// والباركود مابيتأثرش: مربعاته بتترسم بمقاس من مضاعفات 3 بالظبط، فالتصغير
// بيرجّعها زي ما هي حرف بحرف.
const RENDER_SCALE = 3;

function makeHiResCanvas(W, H) {
  const c = document.createElement('canvas');
  c.width = W * RENDER_SCALE;
  c.height = H * RENDER_SCALE;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';
  return { canvas: c, ctx };
}

// بتصغّر بالمتوسط وبتحوّل لأبيض/أسود، وبترجّع data URL.
function shrinkToPrinterDots(bigCanvas, W, H) {
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  if (!octx) return '';

  try {
    const big = bigCanvas.getContext('2d').getImageData(0, 0, W * RENDER_SCALE, H * RENDER_SCALE).data;
    const img = octx.createImageData(W, H);
    const d = img.data;
    const S = RENDER_SCALE;
    const area = S * S;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let sy = 0; sy < S; sy++) {
          const row = (y * S + sy) * W * S;
          for (let sx = 0; sx < S; sx++) {
            const i = (row + x * S + sx) * 4;
            sum += big[i] * 0.299 + big[i + 1] * 0.587 + big[i + 2] * 0.114;
          }
        }
        // العتبة 50%: النقطة بتبقى سودا لو أغلب الـ9 عيّنات سودا. ده
        // بيحافظ على سُمك الحرف الحقيقي — العتبة العالية كانت بتتخّنه.
        const v = sum / area < 128 ? 0 : 255;
        const di = (y * W + x) * 4;
        d[di] = d[di + 1] = d[di + 2] = v;
        d[di + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return out.toDataURL('image/png');
  } catch (err) {
    console.warn('تعذّر تصغير الملصق:', err);
    return '';
  }
}

// بترسم الملصق كله وبترجّع data URL لصورة PNG.
function renderLabelPNG(cat, sizeOptions) {
  const { pageWidthMm, pageHeightMm } = sizeOptions;
  const halves = sizeOptions.halves || 1;
  const W = Math.round(mmToDots(pageWidthMm));
  const H = Math.round(mmToDots(pageHeightMm));
  const halfH = Math.round(H / halves);

  const hi = makeHiResCanvas(W, H);
  if (!hi) return '';
  const ctx = hi.ctx;

  const FAMILY = 'Arial, Helvetica, Tahoma, sans-serif';
  const name = String(cat.itemName || cat.name || '');
  const code = String(cat.barcodeNumber || '');
  const sellNum = Number(cat.sellingPrice) || 0;
  const origNum = Number(cat.originalPrice) || 0;
  const hasDiscount = origNum > 0 && origNum !== sellNum;
  // ⭐ "من غير سعر": بتشيل سطر السعر خالص — والاسم والرقم بياخدوا مكانه،
  // يعني الخط بيكبر مش بس السعر بيختفي. مفيدة لما تكون الأسعار بتتغيّر
  // كتير أو الملصق للتعريف مش للبيع.
  const showPrice = !!cat.sellingPrice && !sizeOptions.noPrice;

  // نفس هندسة الملصق القديم بالظبط، بس بالنقط بدل الملليمترات
  const pad = mmToDots(0.4);
  // 1.6 مم مش 1.2: الطابعة بتزحلق شوية، والحرف الأخير كان بيتاكل من
  // الحرف. الـ0.4 مم الزيادة على كل جنب بتاكل شوية من عرض النص بس بتشيل
  // احتمال ضياع حرف. (وللزحلقة الكبيرة فيه أداة الإطار في الإعدادات.)
  const padX = mmToDots(1.6);
  const gapX = mmToDots(0.8);
  const SAFETY = mmToDots(0.6);
  const contentH = halfH - pad * 2 - SAFETY;
  // ⭐ هامش الأمان بيتوزّع **نص فوق ونص تحت** بدل ما يبقى كله تحت.
  // قبل كده المحتوى كان بيقع أعلى من نص اللاصقة بحوالي 0.3 مم، وده كان
  // باين في النصف السفلي بالذات (الباركود التحتاني مركزه أعلى من مركز
  // اللاصقة). التوزيع المتساوي بينزّله لمكانه الصح.
  const topOffset = pad + SAFETY / 2;

  // ⭐ الـQR بمربعات من عدد صحيح من النقط — ده اللي بيخلّيه يتقرا بسرعة.
  const best = buildBestQR(code || name);
  const qrAvail = Math.min(contentH - mmToDots(0.4), mmToDots(11));
  let qrSize = Math.floor(qrAvail);
  let modulePx = 0;
  if (best) {
    modulePx = Math.max(1, Math.floor(qrAvail / best.count));
    qrSize = modulePx * best.count;
  }

  const textW = W - qrSize - padX * 2 - gapX;
  const textCx = padX + qrSize + gapX + textW / 2;

  const LINE = 1.2;
  const otherLines = 1 + (showPrice ? 1 : 0);
  const capPx = mmToDots(2.7);

  for (let h = 0; h < halves; h++) {
    const top = h * halfH;

    // --- الـQR ---
    if (best && qrSize > 0) {
      const qrY = top + topOffset + (contentH - qrSize) / 2;
      const qrX = padX;
      for (let row = 0; row < best.count; row++) {
        for (let col = 0; col < best.count; col++) {
          if (best.qr.isDark(row, col)) {
            ctx.fillRect(qrX + col * modulePx, qrY + row * modulePx, modulePx, modulePx);
          }
        }
      }
    }

    // --- النص: بنختار سطر ولا سطرين للاسم زي ما في الشاشة ---
    let chosen = null;
    for (let maxLines = 1; maxLines <= 2; maxLines++) {
      const byHeight = contentH / ((maxLines + otherLines) * LINE);
      const fit = fitCanvasFont(ctx, name, textW, maxLines, 'bold', FAMILY, Math.min(byHeight, capPx));
      if (!chosen || fit.size > chosen.size) chosen = { ...fit, maxLines, byHeight };
    }

    const nameLines = chosen.lines.length;
    const byHeight = contentH / ((nameLines + otherLines) * LINE);
    // ⭐ المقاسات بأعداد صحيحة من نقط الطابعة.
    // السبب: المقاس الكسري بيخلّي عمود الحرف يقع بين نقطتين، فمرة بيطلع
    // نقطة ومرة نقطتين — وده اللي بيدّي إحساس إن الخط "مش مظبوط".
    const nameSize = Math.max(6, Math.round(Math.min(chosen.size, byHeight, capPx)));
    const codeSize = Math.max(6, Math.round(Math.min(byHeight, nameSize * 0.9)));
    const priceSize = Math.max(6, Math.round(Math.min(byHeight, nameSize * 1.15)));
    const oldPriceSize = Math.max(5, Math.round(priceSize * 0.8));

    const lineH = contentH / (nameLines + otherLines);
    let y = top + topOffset;

    ctx.fillStyle = '#000000';
    // اسم الصنف غامق زي الرقم والسعر — اتطلب كده صراحة بعد ما جرّبنا
    // الخط العادي وطلع باهت جنبهم.
    //
    // ⚠️ سجل المحاولات هنا، عشان محدش يلف في نفس الدايرة تاني:
    //   • bold + تكبير الصورة من QZ  → منغمش (السبب كان التكبير، v0.28.3)
    //   • عادي                        → أنضف بس باهت جنب الرقم والسعر
    //   • bold + من غير تكبير         → اللي إحنا فيه دلوقتي
    //
    // الحل الجذري مش في سُمك الخط أصلًا: خطوط المتصفح مصمّمة للشاشة، وإحنا
    // بنطبع على 203 نقطة/بوصة. الطريقة الاحترافية إن **الطابعة ترسم النص
    // بخطها الداخلي** (أوامر TSPL) بدل ما نبعتلها صورة — شوف
    // buildTSPLFontSample تحت.
    y += drawLines(ctx, chosen.lines, nameSize, 'bold', FAMILY, textCx, y, lineH);

    drawLines(ctx, [code], codeSize, 'bold', FAMILY, textCx, y, lineH);
    y += lineH;

    if (showPrice) {
      const sell = `${cat.sellingPrice} L.E`;
      const orig = hasDiscount ? `${cat.originalPrice} L.E` : '';
      const gap = mmToDots(0.8);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      ctx.font = `normal ${oldPriceSize}px ${FAMILY}`;
      const origW = orig ? ctx.measureText(orig).width : 0;
      ctx.font = `bold ${priceSize}px ${FAMILY}`;
      const sellW = ctx.measureText(sell).width;
      const totalW = origW + (orig ? gap : 0) + sellW;
      let x = textCx - totalW / 2;
      const cy = y + lineH / 2;

      if (orig) {
        ctx.font = `normal ${oldPriceSize}px ${FAMILY}`;
        ctx.fillText(orig, x, cy);
        // الشطبة
        const lineY = cy;
        ctx.fillRect(x, lineY - Math.max(1, oldPriceSize * 0.04), origW, Math.max(1, oldPriceSize * 0.08));
        x += origW + gap;
      }
      ctx.font = `bold ${priceSize}px ${FAMILY}`;
      ctx.fillText(sell, x, cy);
      ctx.textAlign = 'center';
    }
  }

  return shrinkToPrinterDots(hi.canvas, W, H);
}

// ============================================================
// ✂️ الملصق المقسوم أربعة
// ============================================================
// اللاصقة 38×25 مم بتتقسم أربع خلايا 19×12.5، وبينهم خط أسود رأسي تقصّ
// عليه بالمقص. يعني من نفس اللفة بتطلع 4 ملصقات بدل 2.
//
// ------------------------------------------------------------
// ⚠️ مقاس الـQR بيقفز، مابيتدرّجش — الرقم ده متقاس
// ------------------------------------------------------------
// مربع الكود لازم يكون **عدد صحيح من نقط الطابعة**، والكود 21 مربع.
// فالمقاسات الممكنة تلاتة بس:
//
//   4 نقط/مربع → 10.5 مم   (ده اللي في الملصق العادي، ومجرّب على ورق)
//   3 نقط/مربع →  7.9 مم   (اللي مستخدم هنا)
//   2 نقط/مربع →  5.3 مم
//
// مافيش حاجة بينهم. لو طلبت 9 مم، الحساب بينزل لـ7.9 لوحده.
//
// اخترنا 3 لأن 4 بياكل 10.5 من الـ19 مم فمايفضلش للنص إلا 6 مم — والرقم
// كان بيخرج بره عموده ويركب على الكود.
//
// ⚠️ 3 نقط/مربع **مااتجربتش على ورق حقيقي**. فحص القراءة عندنا بيقول
// إنها بتتقرا، لكن نفس الفحص بيفشل على الملصق اللي شغّال في المحل فعلًا
// لما نحاكي فرد الحبر — يعني المحاكاة متشائمة وماينفعش نبني عليها. أول
// طبعة لازم تتجرّب على الماكينة قبل أي كمية.
const QUARTER_QR_DOTS_PER_MODULE = 3;

// بترسم خلية واحدة من الملصق المقسوم على السياق اللي جايلها.
//
// ⭐ كل سطر بيتقصّ على **عرض عموده** مش على الارتفاع بس. ده كان سبب إن
// رقم الباركود يخرج من عموده ويركب على الكود: مقاسه كان متحسوب من
// الارتفاع لوحده، والعرض مالوش أي دور في الحساب.
function drawQuarterCell(ctx, cat, x0, y0, W, H, noPrice) {
  const F = 'Arial, Helvetica, Tahoma, sans-serif';
  const name = String(cat.itemName || cat.name || '');
  const code = String(cat.barcodeNumber || '');
  const showPrice = !!cat.sellingPrice && !noPrice;

  const pad = mmToDots(0.4);
  const padX = mmToDots(1.0);
  const gapX = mmToDots(0.6);
  const SAFETY = mmToDots(0.6);
  const contentH = H - pad * 2 - SAFETY;
  const top = y0 + pad + SAFETY / 2;

  // --- الكود ---
  const best = buildBestQR(code || name);
  let qrSize = 0;
  if (best) {
    const modulePx = Math.max(1, Math.min(QUARTER_QR_DOTS_PER_MODULE, Math.floor(contentH / best.count)));
    qrSize = modulePx * best.count;
    const qrY = top + (contentH - qrSize) / 2;
    for (let r = 0; r < best.count; r++) {
      for (let c = 0; c < best.count; c++) {
        if (best.qr.isDark(r, c)) ctx.fillRect(x0 + padX + c * modulePx, qrY + r * modulePx, modulePx, modulePx);
      }
    }
  }

  // --- عمود النص جنبه ---
  const textW = W - qrSize - padX * 2 - gapX;
  const cx = x0 + padX + qrSize + gapX + textW / 2;
  const LINE = 1.15;
  // أربع سطور كحد أقصى: اسم (١ أو ٢) + رقم + سعر
  const rows = 2 + 1 + (showPrice ? 1 : 0);
  const lineH = contentH / rows;
  const capPx = lineH / LINE;

  // الاسم: سطر، وسطرين لو طويل، و"…" لو حتى السطرين مكفوش.
  //
  // ⚠️ الترتيب هنا مهم: بندوّر على **أكبر خط بيخلّي الاسم يدخل في سطرين**،
  // مش بنثبّت الخط على ارتفاع السطر ونقص اللي زاد. الغلطة دي حصلت فعلًا:
  // في نسخة "من غير سعر" السطور بتقل فارتفاع السطر بيكبر، فالخط كبر،
  // فالاسم بقى مش داخل واتقص — يعني **مساحة أكبر أدّت لاسم أقصر**.
  //
  // القص بـ"…" بقى الملاذ الأخير: بس لما الخط ينزل تحت الحد اللي يتقرا.
  const MIN_NAME_DOTS = 8;
  const fitName = fitCanvasFont(ctx, name, textW, 2, 'bold', F, capPx);
  let nameSize = Math.round(fitName.size);
  let nameLines = fitName.lines;
  if (nameSize < MIN_NAME_DOTS) {
    nameSize = MIN_NAME_DOTS;
    ctx.font = `bold ${nameSize}px ${F}`;
    const words = name.trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (ctx.measureText(next).width <= textW || !cur) cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    nameLines = lines.slice(0, 2);
    if (lines.length > 2 && nameLines[1]) {
      let last = nameLines[1];
      while (last.length && ctx.measureText(last + '…').width > textW) last = last.slice(0, -1);
      nameLines[1] = last + '…';
    }
  }

  ctx.fillStyle = '#000000';
  let y = top;
  y += drawLines(ctx, nameLines, nameSize, 'bold', F, cx, y, lineH);

  // اللي فضل من الارتفاع بيتوزّع على الرقم والسعر — فالاسم القصير بيدّي
  // للرقم والسعر مساحة أكبر بدل ما تروح فاضي.
  const restRows = rows - nameLines.length;
  const restH = restRows > 0 ? (contentH - lineH * nameLines.length) / restRows : lineH;
  const fitOne = (text, cap) => {
    const f = fitCanvasFont(ctx, text, textW, 1, 'bold', F, cap);
    return Math.max(5, Math.round(Math.min(f.size, cap)));
  };

  if (code) {
    drawLines(ctx, [code], fitOne(code, Math.min(restH / LINE, nameSize)), 'bold', F, cx, y, restH);
    y += restH;
  }
  if (showPrice) {
    const price = `${cat.sellingPrice} L.E`;
    drawLines(ctx, [price], fitOne(price, Math.min(restH / LINE, nameSize * 1.2)), 'bold', F, cx, y, restH);
  }
}

function renderQuarterLabelPNG(cat, sizeOptions) {
  const W = Math.round(mmToDots(sizeOptions.pageWidthMm));
  const H = Math.round(mmToDots(sizeOptions.pageHeightMm));
  const hi = makeHiResCanvas(W, H);
  if (!hi) return '';
  const ctx = hi.ctx;

  const cellW = Math.floor(W / 2);
  const cellH = Math.floor(H / 2);
  ctx.fillStyle = '#000000';
  [
    [0, 0],
    [W - cellW, 0],
    [0, H - cellH],
    [W - cellW, H - cellH],
  ].forEach(([x, y]) => drawQuarterCell(ctx, cat, x, y, cellW, cellH, sizeOptions.noPrice));

  // خط القص: نقطتين في النص، على طول اللاصقة.
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.floor(W / 2) - 1, 0, 2, H);

  return shrinkToPrinterDots(hi.canvas, W, H);
}

// ملصق الدرجة كصورة كمان — نفس السبب بالظبط: نص بس، بس المحرك التاني
// بيقسّمه بمقاسات مختلفة فبيتقص.
function renderGradeLabelPNG(categoryName, gradeLabel, sizeOptions) {
  const { pageWidthMm, pageHeightMm } = sizeOptions;
  const halves = sizeOptions.halves || 1;
  const W = Math.round(mmToDots(pageWidthMm));
  const H = Math.round(mmToDots(pageHeightMm));
  const halfH = Math.round(H / halves);

  const hi = makeHiResCanvas(W, H);
  if (!hi) return '';
  const ctx = hi.ctx;

  const FAMILY = 'Tahoma, Arial, sans-serif';
  const line1 = String(categoryName || '');
  const line2 = String(gradeLabel || '');
  const pad = mmToDots(0.8);
  const SAFETY = mmToDots(0.6);
  const availW = W - pad * 2;
  const availH = halfH - pad * 2 - SAFETY;
  const topOffset = pad + SAFETY / 2; // هامش الأمان نص فوق ونص تحت
  const LINE = 1.2;

  for (let h = 0; h < halves; h++) {
    const top = h * halfH;

    let chosen = null;
    for (let maxLines = 1; maxLines <= 2; maxLines++) {
      const byHeight = availH / ((maxLines + 1) * LINE);
      const fit = fitCanvasFont(ctx, line1, availW, maxLines, 'bold', FAMILY, byHeight);
      if (!chosen || fit.size > chosen.size) chosen = fit;
    }
    const n1 = chosen.lines.length;
    const byHeight = availH / ((n1 + 1) * LINE);
    // مقاسات بأعداد صحيحة من نقط الطابعة — الشرح في renderLabelPNG
    const size1 = Math.max(6, Math.round(Math.min(chosen.size, byHeight)));
    const fit2 = fitCanvasFont(ctx, line2, availW, 1, 'bold', FAMILY, byHeight);
    const size2 = Math.max(6, Math.round(Math.min(fit2.size, byHeight)));

    const lineH = availH / (n1 + 1);
    // المحتوى في نص النصف رأسيًا
    const blockH = lineH * (n1 + 1);
    let y = top + topOffset + (availH - blockH) / 2;
    y += drawLines(ctx, chosen.lines, size1, 'bold', FAMILY, W / 2, y, lineH);
    drawLines(ctx, fit2.lines.length ? fit2.lines : [line2], size2, 'bold', FAMILY, W / 2, y, lineH);
  }

  return shrinkToPrinterDots(hi.canvas, W, H);
}

// بتلفّ الصورة في صفحة HTML بمقاس الملصق — للمعاينة ولنافذة طباعة
// المتصفح (لما QZ مش موجود). الصورة هي هي في الحالتين.
function wrapImageLabelHTML(dataUrl, sizeOptions, copies) {
  const { pageWidthMm, pageHeightMm } = sizeOptions;
  const copyCount = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(copies, 10) || 1));
  const one = `<div class="label"><img src="${dataUrl}" alt=""></div>`;
  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ملصق</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body { width: ${pageWidthMm}mm; }
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; ${printAlignCSS()} }
        .label + .label { page-break-before: always; break-before: page; }
        .label img { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; display: block; image-rendering: pixelated; }
      </style>
    </head>
    <body>${one.repeat(copyCount)}</body>
    </html>
  `;
}

// ============================================================
// 🔍 نسخة المعاينة — بمقاس بكسلات الصورة الحقيقي
// ============================================================
// ⚠️ ليه دي موجودة أصلًا؟
//
// المعاينة كانت بتوري الصورة **منغمشة** حتى لما الملصق المطبوع يطلع نضيف.
// السبب مش في الصورة، السبب في طريقة عرضها:
//
//   الصورة الحقيقية    = 304 بكسل عرض
//   المتصفح بيعرضها بـ 38 مم = 143.6 بكسل   ← بيرمي نص البكسلات!
//   وبعدين المعاينة بتكبّر اللي فضل 12 ضعف   ← بتكبّر التلف
//
// يعني كنا بنضيّع نص الصورة وبعدين نضخّم الباقي. الحل إن المعاينة تعرض
// الصورة **بمقاسها الحقيقي بالبكسل** وتكبّرها من غير ما ترميها الأول.
function wrapImageLabelPreviewHTML(dataUrl, widthPx, heightPx) {
  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>معاينة</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { width: ${widthPx}px; height: ${heightPx}px; background: #fff; }
        img { width: ${widthPx}px; height: ${heightPx}px; display: block; image-rendering: pixelated; }
      </style>
    </head>
    <body><img src="${dataUrl}" alt=""></body>
    </html>
  `;
}

function buildLabelHTML(cat, sizeOptions, qrDataUrl, copies) {
  const { pageWidthMm, pageHeightMm, halves } = sizeOptions;
  const halfHeight = pageHeightMm / (halves || 1);
  const copyCount = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(copies, 10) || 1));

  const name = String(cat.itemName || cat.name || '');

  // ------------------------------------------------------------
  // السعر: السعر المشطوب بيظهر **بس لو فيه خصم فعلي**
  // ------------------------------------------------------------
  // كان بيتكتب "85 L.E مشطوب  85 L.E" على أصناف مالهاش خصم أصلًا — رقم
  // مكرر مشطوب جنب نفسه، بياخد نص عرض اللاصقة ومالوش أي معنى، وبيصغّر
  // السعر الحقيقي عشان يفضلّه مكان.
  const sellNum = Number(cat.sellingPrice) || 0;
  const origNum = Number(cat.originalPrice) || 0;
  const hasDiscount = origNum > 0 && origNum !== sellNum;
  const showPrice = !!cat.sellingPrice && !sizeOptions.noPrice;
  const priceHTML = showPrice
    ? `<div class="price">${
        hasDiscount ? `<s>${escapeHTML(cat.originalPrice)} L.E</s>` : ''
      }<b>${escapeHTML(cat.sellingPrice)} L.E</b></div>`
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

  // ------------------------------------------------------------
  // ⭐ الـQR بعيد عن حرف اللاصقة الشمال
  // ------------------------------------------------------------
  // الحشو الجانبي كان 0.4 ملم بس، والـQR أول حاجة على الشمال — فأي زحلقة
  // بسيطة في تغذية الورق (أو حرف اللاصقة نفسه المدوّر) كانت بتاكل عمود من
  // مربعاته. والعمود ده من نمط التصويب، فالقارئ بيتوه.
  //
  // 1.2 ملم على الجانبين = تلات أضعاف اللي كان. والعرض 38 ملم، فالمساحة
  // الباقية للنص لسه أكتر من كفاية (24 ملم).
  const padX = 1.2;
  const gapX = 0.8;
  const textW = pageWidthMm - qrBox - padX * 2 - gapX;

  // اسم الصنف: بنقيس التقسيم الحقيقي على سطر وعلى سطرين وناخد الأوضح.
  // (قبل كده كنا بنخمّن ×1.85 والاسم كان بيتقطع بنقط "…")
  const otherLines = 1 + (showPrice ? 1 : 0); // الباركود + السعر
  const layout = pickNameLayout(name, textW, contentH, LINE, otherLines, 2.7);
  const nameLines = layout.lines;
  const nameSize = layout.size;
  const byHeight = contentH / ((nameLines + otherLines) * LINE);
  const codeSize = Math.min(byHeight, nameSize * 0.9);

  // سعر البيع هو أهم رقم على اللاصقة للزبون، فبياخد أكبر خط متاح في سطره.
  // byHeight هو نصيب السطر الواحد من الارتفاع، فمينفعش نعدّيه وإلا السعر
  // بيتقطع من تحت. والسعر المشطوب بياخد حجم أصغر عشان الفرق يبان.
  const priceSize = Math.min(byHeight, nameSize * 1.15);
  const oldPriceSize = priceSize * 0.8;

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
          ${printAlignCSS()}
        }
        .label + .label { page-break-before: always; break-before: page; }
        .half {
          height: ${halfHeight}mm; width: 100%;
          display: flex; align-items: center; gap: ${gapX}mm;
          padding: ${pad}mm ${padX}mm ${pad + SAFETY_MM}mm;
          overflow: hidden;
        }
        .qr { width: ${qrBox}mm; height: ${qrBox}mm; flex: 0 0 ${qrBox}mm; display: block; }
        .txt { flex: 1; min-width: 0; text-align: center; }
        /* ⚠️ مفيش -webkit-line-clamp هنا عن قصد.
           هي اللي كانت بتحط "…" مكان باقي الاسم. دلوقتي حجم الخط متقاس
           على التقسيم الحقيقي، فالاسم بيدخل كامل — ولو حصلت مفاجأة على
           جهاز غريب، اسم متزنوق شوية أحسن من اسم ناقص. */
        .name {
          font-size: ${nameSize.toFixed(2)}mm; font-weight: bold;
          overflow-wrap: anywhere; word-break: break-word;
          max-height: ${(nameLines * LINE * nameSize).toFixed(2)}mm;
          overflow: hidden;
        }
        /* الرقم bold: على الطابعة الحرارية الخط الرفيع بيطلع باهت ومتقطّع،
           والرقم ده هو خطة الطوارئ لو الباركود مارضيش يتقرا — فلازم يبان. */
        .code { font-size: ${codeSize.toFixed(2)}mm; letter-spacing: 0.15mm; font-weight: bold; }
        .price { display: flex; justify-content: center; align-items: baseline; gap: ${pad * 2}mm; white-space: nowrap; }
        .price s { font-weight: normal; font-size: ${oldPriceSize.toFixed(2)}mm; }
        .price b { font-weight: bold; font-size: ${priceSize.toFixed(2)}mm; }
      </style>
    </head>
    <body>${`<div class="label">${halfHTML.repeat(halves || 1)}</div>`.repeat(copyCount)}</body>
    </html>
  `;
}

// بتبني ملصق الصنف بالطريقة المعتمدة (صورة)، أو بالطريقة القديمة (HTML)
// لو المستخدم فتح مفتاح الرجوع لها.
//
// بترجّع { previewHTML, jobHTML, image } — والـimage بتتبعت لـQZ مباشرة
// لما تكون موجودة.
async function buildItemLabel(cat, sizeOptions, copies) {
  if (!getPrintTweak('htmlLabels')) {
    const png = renderLabelPNG(cat, sizeOptions);
    if (png) {
      return {
        previewHTML: wrapImageLabelPreviewHTML(png, labelDots(sizeOptions).w, labelDots(sizeOptions).h),
        jobHTML: wrapImageLabelHTML(png, sizeOptions, 1),
        fallbackHTML: wrapImageLabelHTML(png, sizeOptions, copies),
        image: png,
        previewPx: labelDots(sizeOptions),
      };
    }
  }
  const qrPx = Math.round((sizeOptions.pageHeightMm / (sizeOptions.halves || 1)) * 16);
  const qrDataUrl = await generateQRDataURL(cat.barcodeNumber || cat.name, qrPx);
  return {
    previewHTML: buildLabelHTML(cat, sizeOptions, qrDataUrl, 1),
    jobHTML: buildLabelHTML(cat, sizeOptions, qrDataUrl, 1),
    fallbackHTML: buildLabelHTML(cat, sizeOptions, qrDataUrl, copies),
    image: null,
  };
}

async function printLabel(cat, sizeOptions) {
  const copies = sizeOptions.copies || 1;
  const built = await buildItemLabel(cat, sizeOptions, copies);

  // المعاينة بتوري لاصقة واحدة بس (مفيش فايدة من عرض 20 نسخة متطابقة)،
  // واللي بيتطبع فعلًا هو العدد اللي طلبته.
  // previewPx بتقول للمعاينة تعرض الصورة بمقاسها الحقيقي بالبكسل
  const approved = await showPrintPreview(
    built.previewHTML,
    { ...sizeOptions, previewPx: built.previewPx },
    copies
  );
  if (!approved) return;

  // لكل نسخة صفحة مستقلة (مصفوفة) عشان QZ ما يحشرهمش في لاصقة واحدة،
  // ومستند واحد بفواصل صفحات للطريقة العادية (نافذة المتصفح).
  const jobs = [{ html: built.jobHTML, image: built.image, copies }];
  await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', built.fallbackHTML);
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

// ============================================================
// قياس الخط — أكبر حجم يخلي النص **كامل** يدخل
// ============================================================
// ⚠️ درس اتعلمناه من ملصقات اتطبعت غلط فعلًا:
//
// الطريقة القديمة كانت بتقيس النص على **سطر واحد**، وبعدين لو مش داخل
// بتقول "خلاص هينقسم سطرين" وتكبّر الخط ×1.85 — رقم متخمّن مبني على إن
// الاسم هينقسم نصين متساويين.
//
// والعربي (والإنجليزي) مابينقسمش متساوي. "طباقيه كويتى كباسين" بتتقسم
// "طباقيه كويتى" / "كباسين" — السطر الأول أطول من النص بكتير، فبيطلع بره
// المساحة، والمتصفح بيقصّه ويحط "…" مكان باقي الاسم.
//
// الطريقة دي بتقيس **التقسيم الحقيقي**: بتجرّب حجم، تشوف النص بيتقسم كام
// سطر فعليًا بالعرض المتاح، وتدوّر على أكبر حجم بيدخل في عدد السطور
// المسموح. مفيش تخمين خالص.
const FIT_REF_PX = 100; // بنقيس عند 100px ونحسب النسبة

// هامش أمان 4%: القياس بيحصل في كروم بخط Tahoma، لكن اللي بيرسم الملصق
// وقت الطباعة ممكن يكون محرك تاني بخط بديل مقاساته مختلفة شوية. الـ4% دي
// بتستحمل الفرق ده — وده سبب "الاسم بيتاكل على جهاز تاني".
const FIT_SAFETY = 0.96;

function fitMeasureCtx(bold) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${bold ? 'bold ' : ''}${FIT_REF_PX}px Tahoma, Arial, sans-serif`;
  return ctx;
}

// بتحسب النص بياخد كام سطر لو عرض السطر = budget (بوحدات القياس المرجعية).
// بتحاكي سلوك المتصفح: بيقسّم عند المسافات، ولو كلمة واحدة أطول من السطر
// كله بيكسرها جوّه (عشان عندنا overflow-wrap: anywhere).
function wrappedLineCount(wordWidths, spaceW, budget) {
  if (!(budget > 0)) return Infinity;
  let lines = 1;
  let cur = 0;

  for (let i = 0; i < wordWidths.length; i++) {
    const w = wordWidths[i];
    const add = cur === 0 ? w : spaceW + w;

    if (cur + add <= budget) {
      cur += add;
      continue;
    }

    // الكلمة بتدخل سطر لوحدها → سطر جديد
    if (w <= budget) {
      lines++;
      cur = w;
      continue;
    }

    // كلمة أطول من السطر كله → بتتكسر جوّه على أكتر من سطر
    if (cur > 0) lines++;
    const full = Math.floor(w / budget);
    lines += full - 1;
    cur = w - full * budget;
    if (cur === 0) cur = budget;
    else lines++;
  }

  return lines;
}

// أكبر حجم خط (مم) يخلي النص يدخل **كامل** في maxLines سطر بالعرض ده.
function fitWrappedFontSizeMm(text, maxWidthMm, maxLines, bold) {
  const str = String(text || '').trim();
  const lines = Math.max(1, maxLines || 1);
  if (!str) return maxWidthMm;

  try {
    const ctx = fitMeasureCtx(bold);
    const words = str.split(/\s+/).filter(Boolean);
    const wordWidths = words.map((w) => ctx.measureText(w).width);
    const spaceW = ctx.measureText(' ').width;
    const total = ctx.measureText(str).width;
    if (!total) return maxWidthMm;

    const usableMm = maxWidthMm * FIT_SAFETY;

    // سطر واحد → معادلة مباشرة، مفيش داعي لأي بحث
    const oneLine = (usableMm * FIT_REF_PX) / total;
    if (lines === 1) return oneLine;

    // أكتر من سطر: أكبر حجم ممكن نظريًا هو اللي بيملا كل السطور، وأقل
    // حاجة هي حجم السطر الواحد. بنبحث بينهم عن أكبر واحد فعلًا بيدخل.
    let lo = oneLine;
    let hi = oneLine * lines;
    // budget بوحدات القياس المرجعية عند حجم s (مم): usableMm * REF / s
    const fits = (s) => wrappedLineCount(wordWidths, spaceW, (usableMm * FIT_REF_PX) / s) <= lines;
    if (!fits(hi)) {
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      return lo;
    }
    return hi;
  } catch (err) {
    // آخر خط دفاع: تقدير خشن. أصغر من اللازم أحسن من أكبر — الأصغر
    // بيطلع اسم كامل بخط صغير، والأكبر بيطلع اسم ناقص.
    return (maxWidthMm * lines) / Math.max(1, str.length) * 1.6;
  }
}

// بتختار بين "سطر واحد" و"سطرين" للاسم: بتحسب حجم الخط الناتج في
// الحالتين وتاخد الأكبر.
//
// ليه مش دايمًا سطرين؟ لأن السطرين بياخدوا ارتفاع أكتر، فنصيب السطر
// الواحد من الارتفاع بيقل. الاسم القصير بيطلع أكبر وأوضح في سطر واحد.
function pickNameLayout(name, widthMm, contentH, lineHeight, otherLines, capMm) {
  let best = { lines: 1, size: 0 };
  for (let lines = 1; lines <= 2; lines++) {
    const byHeight = contentH / ((lines + otherLines) * lineHeight);
    const byWidth = fitWrappedFontSizeMm(name, widthMm, lines, true);
    const size = Math.min(byHeight, byWidth, capMm || Infinity);
    if (size > best.size) best = { lines, size };
  }
  return best;
}

// gradeLabel = النص اللي هيتكتب في السطر التاني: "درجة 56" للدرجات
// المرقّمة، أو الاسم نفسه ("أبيض") للدرجات الأساسية.
function buildGradeLabelHTML(categoryName, gradeLabel, sizeOptions, copies) {
  const { pageWidthMm, pageHeightMm, halves } = sizeOptions;
  const halfHeight = pageHeightMm / (halves || 1);
  const copyCount = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(copies, 10) || 1));

  // هامش أمان رأسي زي ملصق الصنف — الطابعة بتاكل جزء بسيط من الحواف.
  const SAFETY_MM = 0.6;
  const pad = 0.8;
  const availableW = pageWidthMm - pad * 2;
  const availableH = halfHeight - pad * 2 - SAFETY_MM;

  const line1 = String(categoryName || '');
  const line2 = String(gradeLabel || '');

  // اسم الفئة الطويل بيتقسم على سطرين بدل ما يتقطع أو يخرج بره اللاصقة.
  const LINE = 1.2;
  const layout = pickNameLayout(line1, availableW, availableH, LINE, 1, null);
  const nameLines = layout.lines;
  const size1 = layout.size;
  const byHeight = availableH / ((nameLines + 1) * LINE);
  const size2 = Math.min(byHeight, fitWrappedFontSizeMm(line2, availableW, 1, true));

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
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; ${printAlignCSS()} }
        .label + .label { page-break-before: always; break-before: page; }
        .half {
          height: ${halfHeight}mm; width: 100%;
          padding: ${pad}mm ${pad}mm ${pad + SAFETY_MM}mm;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; overflow: hidden;
        }
        .l1, .l2 { font-weight: bold; line-height: ${LINE}; }
        /* ⚠️ مفيش -webkit-line-clamp — شوف الشرح في ملصق الصنف فوق. */
        .l1 {
          font-size: ${size1.toFixed(2)}mm;
          overflow-wrap: anywhere; word-break: break-word;
          max-height: ${(nameLines * LINE * size1).toFixed(2)}mm;
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

  // ملصق الدرجة بيترسم كصورة زي ملصق الصنف — نفس السبب: المحرك التاني
  // بيقسّم النص بمقاسات مختلفة فبيتقص.
  const useImage = !getPrintTweak('htmlLabels');
  const buildOne = (label, copies) => {
    if (useImage) {
      const png = renderGradeLabelPNG(cat.name, label, sizeOptions);
      if (png) {
        const d = labelDots(sizeOptions);
        return {
          html: wrapImageLabelHTML(png, sizeOptions, copies),
          preview: wrapImageLabelPreviewHTML(png, d.w, d.h),
          image: png,
        };
      }
    }
    return { html: buildGradeLabelHTML(cat.name, label, sizeOptions, copies), preview: null, image: null };
  };

  const nameOf = (g) => gradeLabelText(g, sizeOptions.withGroup);

  // المعاينة بتوري أول درجة محدّدة كنموذج
  const first = buildOne(nameOf(picks[0].grade), 1);
  const total = picks.reduce((s, p) => s + p.qty, 0);
  const approved = await showPrintPreview(
    first.preview || first.html,
    { ...sizeOptions, previewPx: first.image ? labelDots(sizeOptions) : null },
    total
  );
  if (!approved) return;

  // كل لاصقة صفحة مستقلة عند QZ (مصفوفة)، عشان ما يحشرش أكتر من واحدة
  // في نفس اللاصقة.
  const built = picks.map((p) => ({ ...buildOne(nameOf(p.grade), 1), copies: p.qty }));
  const jobs = built.map((x) => ({ html: x.html, image: x.image, copies: x.copies }));

  // نسخة واحدة بفواصل صفحات لنافذة طباعة المتصفح (بتتعامل مع مستند واحد).
  const bodies = [];
  built.forEach((x) => {
    const body = extractLabelBody(x.html);
    for (let i = 0; i < x.copies; i++) bodies.push(body);
  });
  const browserHTML = built[0].html.replace(/<body>[\s\S]*<\/body>/, `<body>${bodies.join('')}</body>`);

  await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', browserHTML);
}

// ------------------------------------------------------------
// ✍️ طباعة مسمّى — ملصق نص حر
// ------------------------------------------------------------
// نفس تصميم ملصق الدرجة بالظبط (سطرين نص في نص اللاصقة، من غير QR ولا
// سعر)، بس النص بتكتبه إنت بإيدك بدل ما ييجي من الفئة والدرجة.
//
// الحاجة دي كانت بتتعمل بره النظام على برنامج الطابعة: أي ملصق تعريف
// (اسم مورّد، ملاحظة على كرتونة، "بضاعة مرتجعة") كان بيحتاج تفتح برنامج
// تاني وتظبّط المقاس من الأول. دلوقتي بياخد نفس مقاس وضبط ملصقاتنا.
function openCustomLabelDialog(opts) {
  const toCart = !!(opts && opts.toCart);
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:340px; width:100%;">
      <div style="margin-bottom:12px; font-size:14px; font-weight:500; text-align:center;">✍️ طباعة مسمّى</div>
      <form id="custom-label-form">
        <div class="field">
          <label>السطر الأول</label>
          <input class="input" id="custom-line1" maxlength="60" placeholder="مثلًا: كريب سادة لوكس" required />
        </div>
        <div class="field">
          <label>السطر التاني (اختياري)</label>
          <input class="input" id="custom-line2" maxlength="60" placeholder="مثلًا: درجة 56" />
        </div>
        <div class="field">
          <label>عدد اللاصقات</label>
          <input class="input" type="number" id="custom-copies" value="1" min="1" max="1000" inputmode="numeric" />
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn btn-primary" type="submit">${toCart ? '➕ أضف للسلة' : '🖨️ كمّل'}</button>
          <button class="btn" type="button" id="custom-cancel">إلغاء</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => document.body.removeChild(overlay);
  document.getElementById('custom-cancel').addEventListener('click', close);
  const first = document.getElementById('custom-line1');
  if (first) first.focus();

  document.getElementById('custom-label-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const line1 = document.getElementById('custom-line1').value.trim();
    const line2 = document.getElementById('custom-line2').value.trim();
    const raw = parseInt(document.getElementById('custom-copies').value, 10);
    const copies = Math.max(1, Math.min(MAX_LABEL_COPIES, Number.isNaN(raw) ? 1 : raw));
    if (!line1 && !line2) return;
    close();
    if (toCart) {
      addCustomLabelToCart(line1, line2, copies);
      return;
    }
    safeAsync(() => printTextLabel(line1, line2, { ...LABEL_SIZE, copies }), 'طباعة المسمّى');
  });
}

// بتطبع ملصق نص حر (سطرين). نفس مسار ملصق الدرجة: صورة بمقاس نقط
// الطابعة، معاينة، وبعدين وظايف طباعة صغيرة.
async function printTextLabel(line1, line2, sizeOptions) {
  const copies = sizeOptions.copies || 1;
  const useImage = !getPrintTweak('htmlLabels');

  let previewHTML;
  let jobHTML;
  let image = null;
  let previewPx = null;

  if (useImage) {
    const png = renderGradeLabelPNG(line1, line2, sizeOptions);
    if (png) {
      const d = labelDots(sizeOptions);
      image = png;
      previewPx = d;
      previewHTML = wrapImageLabelPreviewHTML(png, d.w, d.h);
      jobHTML = wrapImageLabelHTML(png, sizeOptions, 1);
    }
  }
  if (!jobHTML) {
    jobHTML = buildGradeLabelHTML(line1, line2, sizeOptions, 1);
    previewHTML = jobHTML;
  }

  const approved = await showPrintPreview(previewHTML, { ...sizeOptions, previewPx }, copies);
  if (!approved) return;

  const jobs = [{ html: jobHTML, image, copies }];
  const fallbackHTML = image
    ? wrapImageLabelHTML(image, sizeOptions, copies)
    : buildGradeLabelHTML(line1, line2, sizeOptions, copies);
  await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', fallbackHTML);
}

// ------------------------------------------------------------
// 🖨️ ملصق درجة واحدة من جوه الصف
// ------------------------------------------------------------
// وضع "ملصقات الدرجات" هدفه الطبعات الكبيرة: تدخل الوضع، تعلّم على 20
// درجة، تكتب عدد لكل واحدة، تخرج. لكن أكتر حاجة بتحصل فعلًا هي **درجة
// واحدة دلوقتي** — وكانت بتاخد نفس الخمس خطوات.
//
// الرمز ده بيختصرها: دوسة تفتح خانة عدد جوه نفس الصف، ودوسة تطبع.
async function printOneGradeLabel(gradeId, copies) {
  const cat = state.categories.find((c) => c.id === state.activeCategoryId);
  const g = state.grades.find((x) => x.id === gradeId);
  if (!cat || !g) return;
  const saved = getSharedPrintSettings() || {};
  await printTextLabel(cat.name || '', gradeLabelText(g, saved.gradeLabelWithGroup), {
    ...LABEL_SIZE,
    copies: Math.max(1, Math.min(MAX_LABEL_COPIES, copies || 1)),
  });
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
  // ورقة التزويد رول 80مم بارتفاع مفتوح، فحساب التكبير بتاعها مختلف تمامًا
  // عن الملصق (اللي مقاسه ثابت من الاتجاهين). بنفصلها في دالة لوحدها
  // **عشان مسار الملصق ما يتلمسش بأي حرف** — هو شغّال ومظبوط ومش عايزين
  // نلعب فيه عشان ميزة في حاجة تانية.
  if (sizeOptions && sizeOptions.autoHeight) {
    return showRollPreview(html, sizeOptions);
  }
  return new Promise((resolve) => {
    // المعاينة كانت صغيرة أوي على شاشة الكمبيوتر. دلوقتي بنحسب التكبير من
    // المساحة المتاحة فعلًا بدل رقم ثابت — كبيرة على الكمبيوتر ومناسبة
    // على الموبايل، وبحد أقصى عشان ما تبقاش مشوّهة.
    const isNarrow = window.innerWidth <= NARROW_BREAKPOINT;
    // المعاينة على الكمبيوتر كانت صغيرة أوي (نص الملصق مش باين)، فوسّعنا
    // المساحة المتاحة وسقف التكبير على الشاشات الكبيرة.
    const boxW = Math.min(window.innerWidth - 80, isNarrow ? 320 : 820);
    const PX_PER_MM = 3.7795;

    // ⚠️ الملصق المرسوم كصورة بيتعرض **بمقاسه الحقيقي بالبكسل**، مش
    // بالملليمتر. السبب: 38 مم في المتصفح = 143.6 بكسل، والصورة أصلها 304
    // بكسل — فالعرض بالملليمتر كان بيرمي نص الصورة وبعدين المعاينة تكبّر
    // اللي فضل، فالكلام كان بيبان منغمش وهو أصلًا نضيف.
    const px = sizeOptions.previewPx;
    const frameW = px ? px.w : sizeOptions.pageWidthMm * PX_PER_MM;
    const frameH = px ? px.h : sizeOptions.pageHeightMm * PX_PER_MM;
    const frameCSS = px
      ? `width:${px.w}px; height:${px.h}px;`
      : `width:${sizeOptions.pageWidthMm}mm; height:${sizeOptions.pageHeightMm}mm;`;
    const zoom = Math.min(boxW / frameW, isNarrow ? 4 : 12);
    const shownW = frameW * zoom;
    const shownH = frameH * zoom;
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
                  style="position:absolute; top:0; left:0; ${frameCSS} border:0;
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

// ⚠️ لازم تتشال أي سكريبت من المحتوى قبل ما يتعرض في المعاينة.
//
// السبب: ورقة التزويد جواها سطر بيشغّل أمر الطباعة تلقائيًا أول ما تتحمّل
// (window.print) — عشان لما تتفتح في نافذة طباعة المتصفح، الطباعة تبدأ
// لوحدها من غير ما المستخدم يدوّر على الزرار.
//
// لكن المعاينة بتكتب نفس المحتوى جوه إطار في الصفحة، فالسطر ده كان
// بيشتغل **جوه المعاينة** ويفتح شاشة طباعة المتصفح فوق معاينتنا. يعني
// كنت تشوف معاينتين ورا بعض — واحدة بتاعتنا وواحدة بتاعة المتصفح.
//
// المعاينة عرض بس، فمش محتاجة أي سكريبت أصلًا.
function stripScripts(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
}

// ------------------------------------------------------------
// معاينة ورقة التزويد (رول بارتفاع مفتوح)
// ------------------------------------------------------------
// الفرق عن الملصق: العرض ثابت (80مم) والارتفاع بيطلع من المحتوى نفسه —
// ورقة فيها 20 درجة مش زي ورقة فيها 165. فبنكتب المحتوى الأول، نقيس
// ارتفاعه الحقيقي من جوه الإطار، وبعدين نظبّط الصندوق عليه.
function showRollPreview(html, sizeOptions) {
  return new Promise((resolve) => {
    const widthMm = sizeOptions.pageWidthMm || 80;
    const PX_PER_MM = 3.7795;
    const isNarrow = window.innerWidth <= NARROW_BREAKPOINT;
    const boxW = Math.min(window.innerWidth - 60, isNarrow ? 300 : 420);
    const zoom = Math.min(boxW / (widthMm * PX_PER_MM), isNarrow ? 1.4 : 1.8);
    const shownW = widthMm * PX_PER_MM * zoom;

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
    overlay.innerHTML = `
      <div class="card" style="max-width:${Math.round(shownW) + 60}px; width:100%; text-align:center;">
        <div style="font-size:14px; font-weight:500; margin-bottom:4px;">معاينة ورقة التزويد</div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:12px;">
          ${
            sizeOptions.papers > 1
              ? `هيتطبع <strong>${escapeHTML(sizeOptions.papers)}</strong> ورق — كل مجموعة لوحدها`
              : `عرض الورقة ${escapeHTML(widthMm)} ملم — الطول على حسب عدد الدرجات`
          }
        </div>
        <!-- نفس درس معاينة الملصق: الصفحة RTL، فالحاوية لازم تبقى LTR
             والإطار في الركن الشمال بالظبط، وإلا التكبير بيطلّع المحتوى بره. -->
        <div id="roll-box" style="margin:0 auto 12px; width:${Math.round(shownW)}px; max-height:55vh;
                    border:1px solid var(--border); background:#fff; overflow:auto;
                    position:relative; direction:ltr;">
          <div id="roll-inner" style="position:relative; width:100%;">
            <iframe id="roll-frame" scrolling="no"
                    style="position:absolute; top:0; left:0; width:${widthMm}mm; border:0;
                           transform:scale(${zoom}); transform-origin:top left; display:block;"></iframe>
          </div>
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn" id="roll-cancel">إلغاء</button>
          <button class="btn btn-primary" id="roll-print">🖨️ طباعة</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const frame = overlay.querySelector('#roll-frame');
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(stripScripts(html));
    doc.close();

    // القياس بعد ما المتصفح يرسم المحتوى فعلًا.
    const fit = () => {
      let h = 400;
      try {
        h = Math.max(
          doc.body ? doc.body.scrollHeight : 0,
          doc.documentElement ? doc.documentElement.scrollHeight : 0,
          200
        );
      } catch (err) {
        /* لو القياس فشل لأي سبب، بنسيب الارتفاع الافتراضي بدل ما نقع */
      }
      frame.style.height = h + 'px';
      overlay.querySelector('#roll-inner').style.height = Math.round(h * zoom) + 'px';
    };
    setTimeout(fit, 60);
    setTimeout(fit, 350);

    const close = (result) => {
      if (overlay.parentNode) document.body.removeChild(overlay);
      resolve(result);
    };
    overlay.querySelector('#roll-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('#roll-print').addEventListener('click', () => close(true));
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
function buildRestockHTML(cat, grades, groupName, withBase) {
  const now = new Date().toLocaleString('ar-EG');
  // الدرجات الأساسية (أبيض/أسود/أوف وايت) مالهاش أرقام، والورقة شبكة
  // أرقام بتمشي بيها على الرف — فوجودها وسط الأرقام بيلخبط الشبكة.
  //
  // ⭐ بقت **اختيارية**: مفتاح في شاشة الطباعة بيحطّها في **قسم لوحدها في
  // آخر الورقة** بأسمائها، فالشبكة فاضلة نضيفة والأساسية مش ضايعة.
  const baseGrades = withBase ? grades.filter((g) => g.isBase) : [];
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

  // قسم الأساسية في الآخر. بيتفلتر بنفس المجموعة لو الورقة لمجموعة واحدة.
  const baseScoped = groupName
    ? baseGrades.filter((g) => (g.group || UNGROUPED_LABEL) === groupName)
    : baseGrades;
  const baseHTML = baseScoped.length
    ? `<div class="group-title">الدرجات الأساسية</div>
       <div class="grid base-grid">${baseScoped
         .map(
           (g) => `
      <div class="row">
        <span class="num base-num">${escapeHTML(g.name || '')}</span>
        <span class="blank">${g.status === 'out' ? hatchSVG() : ''}</span>
      </div>`
         )
         .join('')}</div>`
    : '';

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
        /* أسماء بدل أرقام → أعمدة أقل وخط أصغر عشان الاسم يدخل */
        .base-grid { column-count: 2; }
        .base-num { font-size: 11px; }
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
      ${baseHTML}
      <script>
        window.onload = function () { setTimeout(function () { window.print(); }, 300); };
      <\/script>
    </body>
    </html>
  `;
}

// بيسأل تطبع أنهي مجموعة قبل الطباعة (بس لو الفئة مقسّمة فعلًا).
// بيرجّع '' للورقة كلها، اسم المجموعة لواحدة بعينها، أو null لو ألغى.
//
// ⚠️⚠️ قيمة خاصة معناها "اطبع كل مجموعة في ورقة لوحدها" — مش اسم مجموعة.
//
// **ممنوع منعًا باتًا تتحط في خاصية HTML.** الإصدار الأول كان بيحطها في
// data-rg، والقيمة كانت '\u0000each'. ومحرك HTML **بيستبدل المحرف
// \u0000 بـ\uFFFD إجباريًا** (ده في المواصفة نفسها) — فاللي بيرجع من
// getAttribute كان '\uFFFDeach' مش '\u0000each'.
//
// النتيجة إن المقارنة كانت بتفشل، والنظام كان بيفتكرها **اسم مجموعة
// حقيقي**: يدوّر على درجات مجموعتها اسمها '\uFFFDeach'، مايلاقيش ولا
// درجة، ويطبع **ورقة فاضية** عنوانها "كريب سادة — �each".
//
// عشان كده الاختيار دلوقتي بيتنقل في data-rg-mode (نص عادي: all/each/one)
// والاسم في خاصية منفصلة. والثابت ده بقى **جوه الجافاسكريبت بس**.
const RESTOCK_EACH_GROUP = '\u0000each';

// المجموعات اللي فيها درجات مرقّمة فعلًا، بترتيبها المحفوظ،
// و"باقي الدرجات" في الآخر لو فيه درجات من غير مجموعة.
function restockGroupNames(cat, grades) {
  const groups = categoryGroups(cat);
  const numbered = grades.filter((g) => !g.isBase);
  const countOf = (name) => numbered.filter((g) => (g.group || UNGROUPED_LABEL) === name).length;
  const names = groups.filter((n) => countOf(n) > 0);
  if (countOf(UNGROUPED_LABEL) > 0) names.push(UNGROUPED_LABEL);
  return names;
}

// ------------------------------------------------------------
// حزمة ورق: كل مجموعة ورقة مستقلة
// ------------------------------------------------------------
// بترجّع:
//   jobs        → ورقة لكل مجموعة (لـQZ: كل واحدة صفحة لوحدها فتتقطع)
//   browserHTML → مستند واحد بفواصل صفحات (نافذة طباعة المتصفح بتتعامل
//                 مع مستند واحد بس)
//   previewHTML → نفس الورق ورا بعض بخط فاصل بدل فاصل الصفحة، عشان
//                 تشوفهم كلهم في معاينة واحدة قبل ما تأكّد
function buildRestockBundle(cat, grades, names, withBase) {
  const papers = names.map((name) => buildRestockHTML(cat, grades, name, withBase));

  const bodyOf = (html) => {
    const m = html.match(/<body>([\s\S]*?)<\/body>/i);
    return m ? m[1] : html;
  };
  // بناخد الهيكل والتنسيقات من أول ورقة ونحط جواها كل الأجسام.
  const shell = papers[0];
  const wrap = (inner) => shell.replace(/<body>[\s\S]*<\/body>/i, `<body>${inner}</body>`);

  const printBodies = papers
    .map((html, i) => {
      const brk = i < papers.length - 1 ? ' style="page-break-after: always; break-after: page;"' : '';
      return `<div${brk}>${stripScripts(bodyOf(html))}</div>`;
    })
    .join('');

  const previewBodies = papers
    .map((html, i) => {
      const sep =
        i > 0
          ? '<div style="border-top:2px dashed #999; margin:6mm 0 4mm; padding-top:2mm; font-size:2.6mm; color:#666; text-align:center;">— ورقة جديدة —</div>'
          : '';
      return sep + stripScripts(bodyOf(html));
    })
    .join('');

  return {
    // الأمر التلقائي بيتشال من الأجسام وبيتحط مرة واحدة على المستند كله
    browserHTML: wrap(printBodies + '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>'),
    previewHTML: wrap(previewBodies),
    jobs: papers.map((html) => ({ html, copies: 1 })),
    count: papers.length,
  };
}

// بترجّع { group, withBase } أو null لو اتلغى.
//
// الشاشة بتظهر لو فيه **اختيار** مطلوب فعلًا: يا إما الفئة مقسّمة مجموعات،
// يا إما فيها درجات أساسية (فمفتاح "اشملها" له معنى). غير كده بتطبع على
// طول من غير ما تسأل — نفس السلوك القديم.
function chooseRestockGroup(cat, grades) {
  return new Promise((resolve) => {
    const groups = categoryGroups(cat);
    const numbered = grades.filter((g) => !g.isBase);
    const hasBase = grades.some((g) => g.isBase);
    const countOf = (name) => numbered.filter((g) => (g.group || UNGROUPED_LABEL) === name).length;
    const savedBase = !!(getSharedPrintSettings() || {}).restockWithBase;

    const options = groups.filter((n) => countOf(n) > 0);
    if (countOf(UNGROUPED_LABEL) > 0) options.push(UNGROUPED_LABEL);
    const needsGroupChoice = groups.length > 0 && options.length >= 2;

    if (!needsGroupChoice && !hasBase) {
      resolve({ group: '', withBase: false });
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
          <button class="btn btn-primary" data-rg-mode="all">📄 الورقة كلها (${escapeHTML(numbered.length)} درجة)</button>
          ${
            needsGroupChoice
              ? `<button class="btn btn-primary" data-rg-mode="each">
                   🗂️ كل مجموعة في ورقة لوحدها (${escapeHTML(options.length)} ورق)
                 </button>
                 <div style="border-top:1px solid var(--border); margin:2px 0;"></div>
                 ${options
                   .map(
                     (name) =>
                       `<button class="btn" data-rg-mode="one" data-rg-name="${escapeHTML(name)}">${escapeHTML(name)} (${escapeHTML(countOf(name))} درجة)</button>`
                   )
                   .join('')}`
              : ''
          }
        </div>
        ${
          hasBase
            ? `<label class="print-opt" style="justify-content:center;">
                 <input type="checkbox" id="rg-with-base" ${savedBase ? 'checked' : ''} />
                 <span><strong>اشمل الدرجات الأساسية</strong><br>
                   <span class="print-opt-hint">بتتكتب بأسمائها في قسم لوحده آخر الورقة</span></span>
               </label>`
            : ''
        }
        <button class="btn" data-rg-cancel="1">إلغاء</button>
      </div>`;
    document.body.appendChild(overlay);

    const close = (group) => {
      const el = overlay.querySelector('#rg-with-base');
      const withBase = !!(el && el.checked);
      if (overlay.parentNode) document.body.removeChild(overlay);
      if (group === null) {
        resolve(null);
        return;
      }
      // الاختيار بيتحفظ في الإعدادات المشتركة زي باقي خيارات الطباعة —
      // لو شغلك دايمًا بالأساسية، مش هتعلّم عليها كل مرة.
      if (el) Promise.resolve(saveSharedPrintSettings({ restockWithBase: withBase })).catch(() => {});
      resolve({ group, withBase });
    };
    overlay.querySelectorAll('[data-rg-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-rg-mode');
        if (mode === 'all') return close('');
        if (mode === 'each') return close(RESTOCK_EACH_GROUP);
        return close(btn.getAttribute('data-rg-name') || '');
      });
    });
    overlay.querySelector('[data-rg-cancel]').addEventListener('click', () => close(null));
  });
}

async function printRestockPaper(cat, grades) {
  const choice = await chooseRestockGroup(cat, grades);
  if (!choice) return;
  const { group: groupName, withBase } = choice;

  // ⭐ كل مجموعة في ورقة لوحدها — بضغطة واحدة
  if (groupName === RESTOCK_EACH_GROUP) {
    const names = restockGroupNames(cat, grades);
    if (!names.length) return;
    const bundle = buildRestockBundle(cat, grades, names, withBase);

    // معاينة واحدة مجمّعة: كل الورق ورا بعض بخط فاصل بينهم.
    const okAll = await showPrintPreview(bundle.previewHTML, {
      pageWidthMm: 80,
      autoHeight: true,
      papers: bundle.count,
    });
    if (!okAll) return;

    // أمر طباعة واحد فيه كل الورق (كل ورقة صفحة لوحدها). كده بيسألك عن
    // الجهاز مرة واحدة بس، والطابعة بتشتغل متواصلة.
    await deliverPrint('restock', bundle.jobs, null, 'width=700,height=800', bundle.browserHTML);
    return;
  }

  const html = buildRestockHTML(cat, grades, groupName, withBase);

  // معاينة قبل الطباعة — نفس فكرة الملصق: تشوف اللي هيطلع قبل ما تحرق ورق.
  // ورقة التزويد ممكن تبقى متر كامل لو الفئة فيها 165 درجة.
  const approved = await showPrintPreview(html, { pageWidthMm: 80, autoHeight: true });
  if (!approved) return;

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
// أقصى حجم لرسالة واحدة رايحة لـQZ: الرسالة الأكبر من كده بتتضاع في صمت
// والطابعة "بتاخد الأمر ومفيش حاجة بتتطبع".
//
// ⚠️ مش مستخدم في الكود ده — التقسيم بقى بعدد الصفحات (QZ_PAGES_PER_JOB)
// مش بالحجم. الرقم فاضل هنا عشان الفحوصات (restock-print و raster-label)
// بتتأكد إن مفيش رسالة عدّته. متمسحوش وانت شايف audit.py بيقول "كود ميت" —
// مسحه معناه إن الحد مابقاش متفحوص وممكن نرجع لنفس العطل من غير ما ناخد بالنا.
const QZ_MAX_MESSAGE_BYTES = 48 * 1024;

// عدد الصفحات في وظيفة الطباعة الواحدة. الشرح الكامل عند مكان الاستخدام —
// باختصار: الوظيفة الكبيرة بتقف في صمت، والصغيرة بتعدّي.
const QZ_PAGES_PER_JOB = 5;

// شريط تقدّم بسيط للطبعات الكبيرة.
function showPrintProgress(total) {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;' +
    'justify-content:center;z-index:3000;padding:12px;';
  box.innerHTML = `
    <div class="card" style="max-width:300px; width:100%; text-align:center;">
      <div style="font-size:14px; font-weight:500; margin-bottom:10px;">🖨️ جارٍ الطباعة</div>
      <div style="font-size:26px; font-weight:600; margin-bottom:6px;" id="pp-num">0 / ${escapeHTML(total)}</div>
      <div style="height:8px; background:var(--surface-muted); border-radius:99px; overflow:hidden;">
        <div id="pp-bar" style="height:100%; width:0%; background:var(--primary, #1565c0); transition:width .2s;"></div>
      </div>
      <div style="font-size:11px; color:var(--text-secondary); margin-top:10px; line-height:1.7;">
        متقفلش الصفحة لحد ما تخلص
      </div>
    </div>`;
  document.body.appendChild(box);
  const num = box.querySelector('#pp-num');
  const bar = box.querySelector('#pp-bar');
  return {
    update(n) {
      num.textContent = `${n} / ${total}`;
      bar.style.width = Math.round((n / total) * 100) + '%';
    },
    close() {
      if (box.parentNode) document.body.removeChild(box);
    },
  };
}

// أقصى عدد ملصقات في أمر واحد.
//
// كان 200، واتّرفع لـ1000 بعد ما اتصلح سبب "الطابعة بتاخد الأمر ومفيش حاجة
// بتتطبع": المشكلة مكانتش في العدد، كانت في **حجم الرسالة** الواحدة الرايحة
// لـQZ (شوف QZ_MAX_MESSAGE_BYTES). دلوقتي الرسايل مقسّمة بالحجم، فالعدد
// مابقاش عامل مقيّد.
const MAX_LABEL_COPIES = 1000;

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

  // ⚠️ qz.websocket.connect() ساعات بترمي خطأ **فوري** بدل ما ترجّع وعد
  // مرفوض (بيحصل على الأجهزة اللي مفيهاش QZ Tray). من غير الـtry دي،
  // الخطأ كان بيطلع بره الدالة ويظهر للمستخدم كشريط أحمر.
  let attempt;
  try {
    attempt = qz.websocket.connect();
  } catch (err) {
    console.warn('تعذّر الاتصال بـ QZ Tray:', err);
    return false;
  }
  if (!attempt || typeof attempt.then !== 'function') return false;

  qzConnecting = attempt
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

// ============================================================
// ⚙️ إعدادات الطباعة المتقدمة — لكل جهاز على حدة
// ============================================================
// ليه لكل جهاز مش لكل مستخدم؟ لأن الطابعة متوصلة **بكمبيوتر**، مش بشخص.
// لو خزّناها على الحساب، نفس الشخص لما يفتح من كمبيوتر تاني هيلاقي إعدادات
// طابعة مش موجودة عنده. (نفس سبب تخزين اختيار الطابعة نفسه محليًا.)
//
// ⚠️ كلهم **مقفولين افتراضيًا**، يعني السلوك زي ما هو بالظبط. ده مقصود:
// اتلسعنا مرتين لما غيّرنا في الطباعة بناءً على حساب نظري والنتيجة على
// الورق طلعت أسوأ. المفاتيح دي طريقة نجرّب بيها **واحد واحد على طابعة
// حقيقية** ونعرف أنهي واحد ظبّط — بدل ما نغيّر كله ونخمّن.
const PRINT_TWEAKS = [
  {
    key: 'noScale',
    label: 'ماتكبّرش المحتوى ليملا الصفحة',
    hint: 'QZ بيكبّر المحتوى افتراضيًا. لو مقاس الورق في التعريف غلط، ده بيزحلق الملصق',
    apply: (cfg) => (cfg.scaleContent = false),
  },
  {
    key: 'blackwhite',
    label: 'أبيض وأسود صريح',
    hint: 'الطابعة الحرارية أبيض/أسود بس — التدرّج الرمادي بيطلع باهت ومنقّط',
    apply: (cfg) => (cfg.colorType = 'blackwhite'),
  },
  {
    key: 'sharp',
    label: 'حواف حادة للباركود',
    hint: 'بيمنع تنعيم الحواف وقت تغيير الحجم — الباركود بيفضل مربعاته حادة',
    apply: (cfg) => (cfg.interpolation = 'nearest-neighbor'),
  },
  {
    key: 'rasterize',
    label: 'حوّل لصورة قبل الإرسال',
    hint: 'بيرسم الملصق كصورة جاهزة بدل ما التعريف يتصرّف فيه',
    apply: (cfg) => (cfg.rasterize = true),
  },
  {
    key: 'htmlLabels',
    label: '↩️ ارجع لملصق HTML القديم',
    hint: 'الملصق دلوقتي بيتبعت كصورة مرسومة عندنا. افتح ده بس لو حصلت مشكلة',
    apply: () => {},
  },
];

const PRINT_TWEAK_PREFIX = 'tazweed_qz_tweak_';

function getPrintTweak(key) {
  // المشترك الأول — نفس سبب الضبط: شكل الملصق واحد للمحل كله.
  const shared = getSharedPrintSettings();
  if (shared && shared.tweaks && typeof shared.tweaks === 'object' && typeof shared.tweaks[key] === 'boolean') {
    return shared.tweaks[key];
  }
  try {
    return localStorage.getItem(PRINT_TWEAK_PREFIX + key) === '1';
  } catch (err) {
    return false;
  }
}

function setPrintTweak(key, on) {
  try {
    if (on) localStorage.setItem(PRINT_TWEAK_PREFIX + key, '1');
    else localStorage.removeItem(PRINT_TWEAK_PREFIX + key);
  } catch (err) {
    console.warn('تعذّر حفظ إعداد الطباعة:', err);
  }
  try {
    const shared = getSharedPrintSettings() || {};
    fireWrite(saveSharedPrintSettings({ tweaks: { ...(shared.tweaks || {}), [key]: !!on } }), 'إعدادات الطباعة');
  } catch (err) {
    console.warn('تعذّر حفظ الإعداد المشترك:', err);
  }
}

// كل المفاتيح كقايمة { المفتاح: مفتوح؟ } — بتستخدم في النسخ بين الأجهزة.
function getPrintTweaksMap() {
  const map = {};
  PRINT_TWEAKS.forEach((t) => (map[t.key] = getPrintTweak(t.key)));
  return map;
}

// ⚠️ بتكتب **كل** المفاتيح، مش المفتوحة بس. لو كتبنا المفتوحة بس، الجهاز
// اللي عليه مفتاح مفتوح غلط هيفضل مفتوح بعد النسخ — والمفروض النسخ يخلّي
// الجهازين متطابقين، مش يزوّد على القديم.
function setPrintTweaksMap(map) {
  if (!map || typeof map !== 'object') return;
  PRINT_TWEAKS.forEach((t) => setPrintTweak(t.key, map[t.key] === true));
}

// بتضيف على إعداد QZ المفاتيح المفتوحة على الجهاز ده بس.
function applyPrintTweaks(config) {
  PRINT_TWEAKS.forEach((t) => {
    if (getPrintTweak(t.key)) t.apply(config);
  });
  return config;
}

// ============================================================
// 📐 ضبط مكان الطباعة — الإطار
// ============================================================
// المشكلة اللي بيحلها ده: الطابعة الحرارية مابتبدأش الطباعة من حرف الملصق
// بالظبط. فيه فرق بسيط بين **أول نقطة الطابعة بتطبعها** و**أول نقطة في
// الملصق الحقيقي**، والفرق ده بيختلف من طابعة لطابعة ومن رول لرول (حسب
// شد الورق وحسّاس الفراغ). النتيجة: الملصق مزحلق شوية يمين أو تحت، وحتة
// منه بتتقص.
//
// مفيش طريقة نحسب بيها الفرق ده — لازم **نشوفه**. فبنطبع إطار مقاسه مقاس
// الملصق بالظبط، وبنبص: الإطار طالع جوه حدود الملصق ولا بره؟ من أنهي ناحية؟
// وبعدين نزحلق بالمقدار ده بالعكس.
//
// ⚠️ افتراضيًا كله أصفار → **مفيش أي CSS بيتضاف خالص**، فالطباعة بتطلع
// نفس البايتات اللي كانت بتطلع قبل الميزة دي. ده مقصود: أي حاجة بنضيفها
// على الطباعة لازم يكون ليها وضع "مطفي تمامًا".
// ============================================================
// ☁️ إعدادات الطباعة المشتركة — مرة واحدة لكل الأجهزة
// ============================================================
// ⚠️ ده تغيير في الفلسفة، اتطلب صراحة:
//
//   "مش عاوز اقعد اعدل في اعدادات الطباعة لكل جهاز. لو في اعدادات بخصوص
//    طباعة الملصق تبقي علي كل الاجهزة مرة واحده بمجرد تحديث النظام."
//
// قبل كده ضبط الملصق كان محفوظ **على كل جهاز لوحده**، فكان لازم تظبطه
// على كل كمبيوتر بإيدك. دلوقتي بيتحفظ في السحابة، وكل جهاز بياخده لوحده
// أول ما يفتح.
//
// **اسم الطابعة بيفضل على الجهاز** — وده الصح: كل كمبيوتر ليه طابعته.
// اللي بقى مشترك هو **شكل الملصق** بس.
//
// ولو النت مقطوع، الجهاز بيشتغل بآخر نسخة محفوظة عنده.
const SHARED_PRINT_DOC = 'print';
let sharedPrintSettings = null;
let unsubPrintSettings = null;

function subscribePrintSettings() {
  if (unsubPrintSettings) unsubPrintSettings();
  try {
    unsubPrintSettings = db
      .collection('settings')
      .doc(SHARED_PRINT_DOC)
      .onSnapshot(
        (snap) => {
          sharedPrintSettings = snap.exists ? snap.data() || {} : {};
          try {
            localStorage.setItem('tazweed_shared_print', JSON.stringify(sharedPrintSettings));
          } catch (err) {
            /* التخزين المحلي ممكن يكون مقفول — مش مشكلة */
          }
        },
        (err) => console.warn('تعذّر قراءة إعدادات الطباعة المشتركة:', err)
      );
  } catch (err) {
    console.warn('تعذّر الاشتراك في إعدادات الطباعة المشتركة:', err);
  }
}

function getSharedPrintSettings() {
  if (sharedPrintSettings) return sharedPrintSettings;
  try {
    const raw = localStorage.getItem('tazweed_shared_print');
    if (raw) return JSON.parse(raw);
  } catch (err) {
    /* تجاهل */
  }
  return null;
}

async function saveSharedPrintSettings(patch) {
  const next = { ...(getSharedPrintSettings() || {}), ...patch };
  sharedPrintSettings = next;
  try {
    localStorage.setItem('tazweed_shared_print', JSON.stringify(next));
  } catch (err) {
    /* تجاهل */
  }
  return db
    .collection('settings')
    .doc(SHARED_PRINT_DOC)
    .set({ ...next, updatedByUid: state.user ? state.user.uid : '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

const PRINT_ALIGN_KEY = 'tazweed_print_align';
const PRINT_ALIGN_LIMIT_MM = 6; // أكتر من كده يبقى مقاس الملصق نفسه غلط، مش زحلقة
const PRINT_SHRINK_LIMIT = 20; // %

function getPrintAlign() {
  const empty = { x: 0, y: 0, shrink: 0 };
  // المشترك الأول: الضبط بقى واحد للمحل كله.
  const shared = getSharedPrintSettings();
  if (shared && shared.align && typeof shared.align === 'object') {
    return {
      x: clampNum(shared.align.x, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      y: clampNum(shared.align.y, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      shrink: clampNum(shared.align.shrink, 0, PRINT_SHRINK_LIMIT),
    };
  }
  // مفيش مشترك لسه → نستخدم اللي متحفّظ على الجهاز (الحسابات القديمة).
  try {
    const raw = localStorage.getItem(PRINT_ALIGN_KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw);
    return {
      x: clampNum(v.x, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      y: clampNum(v.y, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      shrink: clampNum(v.shrink, 0, PRINT_SHRINK_LIMIT),
    };
  } catch (err) {
    return empty;
  }
}

function savePrintAlign(align) {
  try {
    const clean = {
      x: clampNum(align.x, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      y: clampNum(align.y, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM),
      shrink: clampNum(align.shrink, 0, PRINT_SHRINK_LIMIT),
    };
    if (!clean.x && !clean.y && !clean.shrink) localStorage.removeItem(PRINT_ALIGN_KEY);
    else localStorage.setItem(PRINT_ALIGN_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('تعذّر حفظ ضبط مكان الطباعة:', err);
  }

  // ⭐ والأهم: بيتحفظ في السحابة كمان، فكل الأجهزة بتاخده لوحدها.
  try {
    fireWrite(saveSharedPrintSettings({ align: { x: clampNum(align.x, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM), y: clampNum(align.y, -PRINT_ALIGN_LIMIT_MM, PRINT_ALIGN_LIMIT_MM), shrink: clampNum(align.shrink, 0, PRINT_SHRINK_LIMIT) } }), 'ضبط مكان الطباعة');
  } catch (err) {
    console.warn('تعذّر حفظ الضبط المشترك:', err);
  }
}

function clampNum(v, min, max) {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

// بترجّع سطر CSS يتحطّ جوه قاعدة .label — أو **نص فاضي** لو مفيش ضبط.
// النص الفاضي هو الحالة الافتراضية، وبيضمن إن الملف المطبوع مايتغيّرش.
//
// ليه transform مش margin؟ لأن الـmargin بيزق المحتوى وبيصغّر المساحة
// المتاحة، فالخطوط والباركود بيتحسبوا من أول وجديد. الـtransform بيحرّك
// الصورة النهائية زي ما هي — نفس المقاسات بالظبط، مكان مختلف بس.
function printAlignCSS() {
  const a = getPrintAlign();
  if (!a.x && !a.y && !a.shrink) return '';
  const parts = [];
  if (a.x || a.y) parts.push(`translate(${a.x}mm, ${a.y}mm)`);
  if (a.shrink) parts.push(`scale(${((100 - a.shrink) / 100).toFixed(3)})`);
  return `transform: ${parts.join(' ')}; transform-origin: center center;`;
}

// ------------------------------------------------------------
// إطار التجربة
// ------------------------------------------------------------
// ملصق فيه إطار بمقاس الملصق بالظبط + علامات في الأركان + صليب في النص
// + الأرقام الحالية مكتوبة. الهدف إنك تمسك الملصق المطبوع في إيدك وتقارن.
function buildFrameHTML(pageWidthMm, pageHeightMm) {
  const a = getPrintAlign();
  const align = printAlignCSS();
  const tick = Math.min(4, pageWidthMm / 6); // طول علامة الركن
  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>إطار تجربة</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; width: ${pageWidthMm}mm; color: #000; }
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; ${align} }
        .frame {
          position: relative;
          width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;
          border: 0.3mm solid #000;
        }
        /* علامات الأركان: أسمك من الإطار عشان تبان حتى لو الحرف اتقص */
        .c { position: absolute; background: #000; }
        .ch { width: ${tick}mm; height: 0.7mm; }
        .cv { width: 0.7mm; height: ${tick}mm; }
        /* صليب صغير في المركز — ذراعه قصيرة عشان مايتلخبطش مع الكلام */
        .mh { position: absolute; top: 50%; left: 50%; width: 6mm; margin-left: -3mm; height: 0.25mm; background: #000; }
        .mv { position: absolute; left: 50%; top: 50%; height: 6mm; margin-top: -3mm; width: 0.25mm; background: #000; }
        /* الكلام فوق الصليب وتحته، مش عليه */
        .sz, .txt {
          position: absolute; left: 0; right: 0; text-align: center;
          font-size: 2.4mm; font-weight: bold; white-space: nowrap;
        }
        .sz { top: 2.2mm; }
        .txt { bottom: 2.2mm; }
      </style>
    </head>
    <body>
      <div class="label"><div class="frame">
        <div class="c ch" style="top:0; left:0;"></div>
        <div class="c cv" style="top:0; left:0;"></div>
        <div class="c ch" style="top:0; right:0;"></div>
        <div class="c cv" style="top:0; right:0;"></div>
        <div class="c ch" style="bottom:0; left:0;"></div>
        <div class="c cv" style="bottom:0; left:0;"></div>
        <div class="c ch" style="bottom:0; right:0;"></div>
        <div class="c cv" style="bottom:0; right:0;"></div>
        <div class="mh"></div>
        <div class="mv"></div>
        <div class="sz">${pageWidthMm} x ${pageHeightMm} mm</div>
        <div class="txt">X ${a.x} / Y ${a.y} / -${a.shrink}%</div>
      </div></div>
    </body>
    </html>
  `;
}

// بتطبع إطار التجربة على طابعة الملصق — من غير معاينة، لأن المعاينة على
// الشاشة مالهاش أي قيمة هنا: الحاجة الوحيدة اللي تفرق هي الورق نفسه.
async function printTestFrame(pageWidthMm, pageHeightMm) {
  const html = buildFrameHTML(pageWidthMm, pageHeightMm);
  const sizeOptions = { pageWidthMm, pageHeightMm, halves: 1 };
  const viaQZ = await tryPrintViaQZ('label', [{ html, copies: 1 }], sizeOptions);
  if (viaQZ) return true;

  // مفيش QZ → نافذة المتصفح. مش مثالي (الويندوز بيتصرّف في المقاس)، بس
  // الإطار لسه بيوري الاتجاه: طالع يمين ولا شمال، فوق ولا تحت.
  const win = window.open('', '_blank', 'width=420,height=320');
  if (!win) {
    alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني.');
    return false;
  }
  win.document.write(html);
  win.document.close();
  return false;
}

// ============================================================
// 🎯 معايرة الطابعة — أوامر خام مباشرة للطابعة
// ============================================================
// دي **مش** بتغيّر أي حاجة في الويندوز. بتتكلم مع الطابعة نفسها بلغتها
// (TSPL — اللي طابعات Xprinter وTSC بتفهمها) وبتقولها:
//
//   SIZE / GAP  → مقاس الملصق والمسافة بينه وبين اللي بعده
//   GAPDETECT   → قيس الفراغ بنفسك واحفظه
//
// GAPDETECT هي بالظبط اللي بتحصل لما تقفل الطابعة وتضغط FEED وتشغّلها —
// بس من غير ما تلمس الجهاز. والنتيجة **بتتخزّن في ذاكرة الطابعة**، فبتفضل
// حتى لو فصلت الكهربا. يعني مرة واحدة لكل طابعة.
//
// ⚠️ حاجتين لازم يبقوا واضحين للمستخدم قبل ما يضغط:
//   • بتستهلك 2-3 ملصقات وهي بتقيس
//   • لو الطابعة مش من النوع ده، ممكن تطلع ورقة فيها كلام — مش مشكلة،
//     بس المعايرة مش هتشتغل
async function calibratePrinter(printerName, widthMm, heightMm, gapMm) {
  if (!printerName) return false;
  if (!(await ensureQZConnected())) return false;

  const cmds = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    `GAP ${gapMm} mm,0 mm`,
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CLS',
    'GAPDETECT',
    '',
  ].join('\r\n');

  const config = qz.configs.create(printerName);
  await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: cmds }]);
  return true;
}

// ============================================================
// 🧪 عيّنة خطوط الطابعة — الطريقة الاحترافية
// ============================================================
// إحنا دلوقتي بنرسم الملصق كصورة ونبعتها. ده حلّ مشكلة "الشكل بيختلف من
// جهاز لجهاز"، بس فضلت مشكلة إن **خطوط المتصفح مصمّمة للشاشة** — وإحنا
// بنطبع على 203 نقطة/بوصة أبيض وأسود من غير أي تدرّج.
//
// الطريقة اللي البرامج الاحترافية بتشتغل بيها (BarTender / NiceLabel /
// برامج Zebra و TSC) مختلفة تمامًا: **مابتبعتش صورة أصلًا**. بتبعت أوامر
// للطابعة، والطابعة بترسم بخطوطها المحفوظة في ذاكرتها:
//
//   TEXT x,y,"3",0,1,1,"Hejap Kuwaiti"   ← الطابعة بترسم النص بخطها
//   QRCODE x,y,M,4,A,0,"10632103"        ← الطابعة بتولّد الباركود بنفسها
//
// ليه ده أحسن؟ لأن خطوط الطابعة **مرسومة أصلًا نقطة نقطة** لدقة 203،
// فمفيش تنعيم ولا تقريب ولا عتبة أبيض/أسود. الحرف بيطلع زي ما هو متصمّم.
//
// ⚠️ وليه مش عملناها من الأول؟ لحاجتين:
//   1) خطوط الطابعة الداخلية **إنجليزي بس** — العربي مش موجود فيها.
//      (أسماء الأصناف عندنا إنجليزي، فدي مش مشكلة للملصق. لكن ملصق الدرجة
//       عربي، وهيفضل صورة.)
//   2) مش كل طابعة عندها نفس الخطوط. الأرقام تحت هي المعيار، بس اللي
//      بيحسم فعلًا هو **ورقة مطبوعة من الطابعة اللي في المحل**.
//
// عشان كده الدالة دي بتطبع **ورقة عيّنة**: نفس الاسم بكل خط متاح ومكتوب
// جنبه اسمه. تطبعها مرة، تبص، وتقولنا أنهي واحد أوضح — وساعتها نبني عليه
// بدل ما نخمّن.
function buildTSPLFontSample(widthMm, heightMm, sampleText, sampleCode) {
  const txt = String(sampleText || 'Hejap Kuwaiti 120').replace(/["\\]/g, '');
  const code = String(sampleCode || '10632103').replace(/["\\]/g, '');
  return [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CLS',
    // كل سطر: اسم الخط + نفس النص بيه
    `TEXT 8,4,"1",0,1,1,"F1 ${txt}"`,
    `TEXT 8,22,"2",0,1,1,"F2 ${txt}"`,
    `TEXT 8,46,"3",0,1,1,"F3 ${txt}"`,
    `TEXT 8,74,"2",0,2,2,"F2x2 ${txt.slice(0, 10)}"`,
    // الباركود من توليد الطابعة نفسها، 4 نقط للمربع زي اللي بنعمله
    `QRCODE 8,120,M,4,A,0,"${code}"`,
    `TEXT 108,124,"2",0,1,1,"QR min printer"`,
    `TEXT 108,148,"3",0,1,1,"${code}"`,
    'PRINT 1,1',
    '',
  ].join('\r\n');
}

// بتبعت العيّنة للطابعة. بترجّع true لو اتبعتت.
async function printTSPLFontSample(printerName, widthMm, heightMm, sampleText, sampleCode) {
  if (!printerName) return false;
  if (!(await ensureQZConnected())) return false;
  const config = qz.configs.create(printerName);
  await qz.print(config, [
    {
      type: 'raw',
      format: 'command',
      flavor: 'plain',
      data: buildTSPLFontSample(widthMm, heightMm, sampleText, sampleCode),
    },
  ]);
  return true;
}

// ============================================================
// 🔥 جودة الطباعة — السرعة والحرارة
// ============================================================
// ⚠️ دول أهم حاجتين في حدة الطباعة الحرارية، ومالمسناهمش خالص طول الوقت
// اللي فات وإحنا بنلف حوالين شكل الخط.
//
// **إزاي الطابعة الحرارية بتشتغل؟** فيها صف من نقط بتسخن، والورق بيتفاعل
// مع الحرارة فيسوَدّ. يعني اللي بيحدّد شكل الحرف هو **قد إيه النقطة سخنت
// وقد إيه الورق قعد قدامها**.
//
//   السرعة (SPEED): الورق ماشي بسرعة قد إيه.
//     • سريع  → النقطة مابتاخدش وقتها، الحرف بيطلع باهت ومتقطّع
//     • بطيء  → الحرارة توصل كاملة، الحرف بيطلع كامل وحاد
//     ⭐ تقليل السرعة أشهر طريقة لتحسين حدة الطباعة الحرارية.
//
//   الحرارة (DENSITY): النقطة بتسخن قد إيه.
//     • واطية  → باهت
//     • عالية  → الحرارة بتتفرد على الورق حوالين النقطة، والحروف
//                **بتلتحم في بعض** — وده بالظبط اللي المستخدم بيسمّيه
//                "الكتابة منغمشة"
//
// يعني "المنغمشة" ممكن تكون **الحرارة عالية** مش الخط غلط. وإحنا كنا
// بنلعب في الخط طول الوقت.
//
// ⚠️ الأوامر دي بتروح **للطابعة نفسها** وبتتخزّن في ذاكرتها — زي المعايرة
// بالظبط. مش إعداد ويندوز ولا حاجة في النظام.
const PRINT_SPEED_DEFAULT = 3;    // بوصة/ثانية
const PRINT_DENSITY_DEFAULT = 8;  // من 0 لـ15

function getPrintQuality() {
  const shared = getSharedPrintSettings();
  const q = (shared && shared.quality) || {};
  const speed = Number(q.speed);
  const density = Number(q.density);
  return {
    speed: isFinite(speed) && speed > 0 ? Math.min(8, Math.max(1, speed)) : PRINT_SPEED_DEFAULT,
    density: isFinite(density) ? Math.min(15, Math.max(0, Math.round(density))) : PRINT_DENSITY_DEFAULT,
    set: !!(q && (q.speed || q.density === 0 || q.density)),
  };
}

// بتبعت السرعة والحرارة للطابعة وبتحفظهم في الإعدادات المشتركة كمان،
// عشان لو ركّبت الطابعة على كمبيوتر تاني تعرف تبعتلها نفس القيم.
async function applyPrintQuality(printerName, speed, density) {
  if (!printerName) return false;
  if (!(await ensureQZConnected())) return false;

  const sp = Math.min(8, Math.max(1, Number(speed) || PRINT_SPEED_DEFAULT));
  const dn = Math.min(15, Math.max(0, Math.round(Number(density))));
  const cmds = [`SPEED ${sp}`, `DENSITY ${dn}`, ''].join('\r\n');

  const config = qz.configs.create(printerName);
  await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: cmds }]);

  try {
    fireWrite(saveSharedPrintSettings({ quality: { speed: sp, density: dn } }), 'جودة الطباعة');
  } catch (err) {
    console.warn('تعذّر حفظ جودة الطباعة:', err);
  }
  return true;
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
      const copies = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(item.copies, 10) || 1));
      // image = ملصق مرسوم عندنا كصورة جاهزة. بيتبعت لـQZ زي ما هو،
      // فالمحرك التاني مابقاش ليه أي دور في شكل الملصق.
      const entry = { html: item.html, copies };
      if (typeof item.image === 'string' && item.image) entry.image = item.image;
      out.push(entry);
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
    // الإعدادات الأساسية زي ما هي بالظبط، وفوقها المفاتيح المفتوحة على
    // الجهاز ده (كلهم مقفولين افتراضيًا فالسلوك مايتغيّرش).
    // ============================================================
    // ⛔⛔ إعداد الطباعة — **متزوّدش عليه حاجة**
    // ============================================================
    // الإعداد ده (المقاس والوحدة وبس) هو اللي شغّال ومُجرّب على طابعة
    // حقيقية في المحل. أي خيار زيادة اتحط هنا من غير تجربة على ورق =
    // مخاطرة بإن الطباعة تقف تمامًا.
    //
    // 📌 ده حصل فعلًا في v0.28.2 وطلّع **ملصقات فاضية**:
    //
    //   ضفنا density: 203 وإحنا فاكرين إنها "203 نقطة في البوصة".
    //   لكن QZ بيفهم density **بوحدة الإعداد نفسه**، وإحنا حاطين
    //   units: 'mm' — يعني اللي وصله كان "203 نقطة في **الملليمتر**"
    //   = 5156 نقطة في البوصة. الطابعة حاولت ترسم صورة مستحيلة
    //   وطلّعت ورق أبيض.
    //
    // القاعدة اللي اتعلمناها بالغالي: **الإعدادات مالهاش لازمة**. إحنا
    // بنرسم الملصق كصورة جاهزة بمقاس نقط الطابعة بالظبط، فالمطلوب من QZ
    // إنه يحطها على الورق وبس. أي خيار زيادة بيديله فرصة يتصرّف فيها.
    //
    // لو حد حابب يجرّب خيار جديد: المفاتيح المتقدمة في شاشة إعدادات
    // الطابعة موجودة عشان كده بالظبط — تتفتح واحد واحد **على ورق حقيقي**،
    // مش تتحط هنا افتراضيًا.
    const config = qz.configs.create(printerName, applyPrintTweaks(size ? { size, units: 'mm' } : {}));

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
    const pageOf = (job) =>
      // الصورة أولًا: أخف بكتير من HTML، والأهم إن شكلها **مضمون** —
      // مفيش محرك تاني بيعيد رسمها.
      job.image
        ? { type: 'pixel', format: 'image', flavor: 'base64', data: job.image.replace(/^data:image\/\w+;base64,/, '') }
        : { type: 'pixel', format: 'html', flavor: 'plain', data: job.html };

    const totalLabels = list.reduce((n, j) => n + j.copies, 0);

    // ============================================================
    // ⭐⭐ العدد بيتبعت للطابعة كـ"عدد نسخ" مش كصفحات مكرّرة
    // ============================================================
    // ⚠️ ده أهم سطر في الطباعة. الشرح:
    //
    // المشكلة اللي كانت بتحصل: "لو طلبت 100 ملصق، الأمر مايوصلش للطابعة
    // أصلًا." الكود كان بيبني **100 صفحة منفصلة** ويبعتهم في وظيفة واحدة.
    // يعني QZ بيرسم 100 صورة، ويبني ملف طباعة فيه 100 صفحة، ويسلّمه
    // للويندوز. الملف ده بيكبر لدرجة إن الوظيفة بتقف من غير أي رسالة خطأ.
    //
    // والحاجة الغريبة إن الـ100 ملصق **متطابقين حرف بحرف**. فبدل ما نبعت
    // نفس الصورة 100 مرة، بنبعتها **مرة واحدة** ونقول للطابعة "اطبعها 100
    // مرة" (خيار copies). ده اللي كل برامج الملصقات بتعمله:
    //
    //   قبل:  100 صورة × 10 كيلو = 1000 كيلو، ووظيفة من 100 صفحة
    //   بعد:  صورة واحدة 10 كيلو، ووظيفة من صفحة واحدة
    //
    // ولو الملصقات مختلفة (سلة فيها أصناف)، كل صنف بياخد وظيفته بعدد نسخه.
    const progress = totalLabels > 10 ? showPrintProgress(totalLabels) : null;

    const pages = [];
    for (const job of list) {
      const page = pageOf(job);
      for (let i = 0; i < job.copies; i++) pages.push(page);
    }

    // ------------------------------------------------------------
    // ⚠️⚠️ الدفعة بتتحسب بالحجم، مش بعدد الملصقات
    // ------------------------------------------------------------
    // المشكلة اللي بيحلها ده (اتبلّغت من الاستخدام الحقيقي):
    //
    //   "لو كتبت 100 ملصق، الطابعة بتاخد الأمر بس **مفيش حاجة بتتطبع**."
    //
    // الكود كان بيبعت 40 ملصق في رسالة واحدة. وقِسنا الرسالة دي فعليًا:
    //
    //   ملصق واحد        ≈  9 كيلو   (منهم 3 كيلو صورة الـQR بالـbase64)
    //   رسالة 40 ملصق    ≈ 364 كيلو
    //   رسالة 100 ملصق   ≈ 909 كيلو
    //
    // وQZ Tray بيستقبل على WebSocket، وللسوكيت **حد أقصى لحجم الرسالة**.
    // الرسالة اللي بتعدّي الحد مابترجّعش خطأ واضح — بتتضاع بهدوء. وده
    // بالظبط "بياخد الأمر ومفيش حاجة بتتطبع".
    //
    // فبقينا نقيس الحجم الحقيقي ونقسّم عليه. والحد اللي اخترناه (48 كيلو)
    // أقل بكتير من أي حد معروف، فالرسالة بتعدّي مهما كانت نسخة QZ.
    // ⚠️⚠️ وظايف **صغيرة**، مش وظيفة واحدة كبيرة.
    //
    // ده سبب "الأمر مايوصلش للطابعة" لما تطلب 100 ملصق. الوظيفة اللي فيها
    // 100 صفحة بيتبني منها ملف طباعة ضخم، وبيقف عند الويندوز أو عند
    // الطابعة **من غير أي رسالة خطأ**.
    //
    // جرّبنا نصغّر الرسالة، وجرّبنا نبعت العدد كـ"عدد نسخ" — والاتنين
    // مانفعوش. فبقينا نبعت **وظايف صغيرة ورا بعض**: كل وظيفة فيها
    // QZ_PAGES_PER_JOB صفحة بس. الطابعة بتخلّص وظيفة وتاخد اللي بعدها،
    // وكل واحدة صغيرة لدرجة إنها مستحيل تتخنق.
    //
    // أبطأ شوية من وظيفة واحدة — بس بتطبع فعلًا، وده اللي يهم.
    const perMessage = [];
    for (let i = 0; i < pages.length; i += QZ_PAGES_PER_JOB) {
      perMessage.push(pages.slice(i, i + QZ_PAGES_PER_JOB));
    }

    let done = 0;
    try {
      for (const chunk of perMessage) {
        await qz.print(config, chunk);
        done += chunk.length;
        if (progress) progress.update(done);
      }
    } catch (errBatch) {
      // لو نسخة QZ أو الطابعة مابتقبلش أكتر من صفحة في الأمر الواحد،
      // بنرجع للطريقة القديمة (واحدة واحدة) — بطيئة بس مضمونة، وأهم حاجة
      // إن المستخدم ما يخرجش من غير ملصقات خالص.
      console.warn('الطباعة المجمّعة مانفعتش — بنرجع لواحدة واحدة:', errBatch);
      try {
        for (let i = done; i < pages.length; i++) {
          await qz.print(config, [pages[i]]);
          if (progress) progress.update(i + 1);
        }
      } catch (errOne) {
        if (progress) progress.close();
        console.error('فشلت الطباعة حتى واحدة واحدة:', errOne);
        alert('الطباعة وقفت في النص.\nاتطبع ' + done + ' من ' + pages.length + '.\n\n' +
              (errOne && errOne.message ? errOne.message : ''));
        return true;
      }
    }
    if (progress) progress.close();
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
    <div class="card" style="max-width:380px; width:100%; max-height:90vh; overflow:auto;">
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

        <!-- ---------- معايرة الطابعة ---------- -->
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:4px;">
          <div style="font-size:13px; font-weight:500; margin-bottom:4px;">🎯 معايرة طابعة الملصق</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
            بتقول للطابعة مقاس الملصق وتخليها تقيس الفراغ بين الملصقات بنفسها.
            بتحل مشكلة <strong>الملصق المنحرف</strong> و<strong>الورقة الفاضية</strong>.
            <br>• بتتعمل <strong>مرة واحدة لكل طابعة</strong> — بتتخزّن جوه الطابعة نفسها
            <br>• بتستهلك 2-3 ملصقات وهي بتقيس
            <br>• <strong>مابتلمسش إعدادات الويندوز خالص</strong>
          </div>
          <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px;">
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">العرض (مم)</label>
              <input class="input" type="number" id="cal-w" value="38" step="0.5" style="padding:6px;" />
            </div>
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">الطول (مم)</label>
              <input class="input" type="number" id="cal-h" value="25" step="0.5" style="padding:6px;" />
            </div>
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">الفراغ (مم)</label>
              <input class="input" type="number" id="cal-gap" value="2" step="0.5" style="padding:6px;" />
            </div>
            <button class="btn" id="cal-run">🎯 عايِر</button>
          </div>
          <div id="cal-status" style="font-size:12px; min-height:16px;"></div>

          <!-- ---------- جودة الطباعة ---------- -->
          <div style="border-top:1px dashed var(--border); margin-top:12px; padding-top:10px;">
            <div style="font-size:12px; font-weight:500; margin-bottom:4px;">🔥 وضوح الطباعة (السرعة والحرارة)</div>
            <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:8px;">
              دول أهم حاجتين في حدة الطباعة الحرارية:
              <br>• <strong>السرعة أبطأ</strong> ← الحرارة توصل كاملة، الحرف بيطلع أوضح
              <br>• <strong>الحرارة أعلى</strong> ← أغمق، بس لو زيادة <strong>الحروف بتلتحم</strong> (النغمشة)
              <br>الأوامر بتتخزّن <strong>جوه الطابعة نفسها</strong> زي المعايرة.
            </div>
            <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px;">
              <div class="field" style="width:110px; margin-bottom:0;">
                <label style="font-size:11px;">السرعة (1 = أبطأ)</label>
                <input class="input" type="number" id="pq-speed" min="1" max="8" step="1" style="padding:6px;" />
              </div>
              <div class="field" style="width:110px; margin-bottom:0;">
                <label style="font-size:11px;">الحرارة (0–15)</label>
                <input class="input" type="number" id="pq-density" min="0" max="15" step="1" style="padding:6px;" />
              </div>
              <button class="btn" id="pq-apply">🔥 ابعتها للطابعة</button>
            </div>
            <div style="font-size:11px; color:var(--text-muted); line-height:1.7; margin-bottom:6px;">
              جرّب كده لو الكلام <strong>منغمش</strong>: السرعة <strong>2</strong> والحرارة <strong>6</strong>.
              ولو <strong>باهت</strong>: السرعة <strong>2</strong> والحرارة <strong>10</strong>.
            </div>
            <div id="pq-status" style="font-size:12px; min-height:16px;"></div>
          </div>

          <div style="border-top:1px dashed var(--border); margin-top:12px; padding-top:10px;">
            <div style="font-size:12px; font-weight:500; margin-bottom:4px;">🧪 عيّنة خطوط الطابعة</div>
            <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:8px;">
              الملصق دلوقتي بيترسم عندنا كصورة. الطريقة الاحترافية إن
              <strong>الطابعة ترسم النص بخطها الداخلي</strong> — خط مرسوم أصلًا
              لدقة الطابعة، فمفيش تنعيم ولا نغمشة.
              <br>الزرار ده بيطبع <strong>ملصق واحد</strong> فيه نفس الاسم بكل خط
              في الطابعة ومكتوب جنبه اسمه. بُص أنهي واحد أوضح وقولنا.
              <br>⚠️ خطوط الطابعة <strong>إنجليزي بس</strong> — العربي هيفضل صورة.
            </div>
            <button class="btn" id="tspl-sample">🧪 اطبع عيّنة الخطوط</button>
            <div id="tspl-status" style="font-size:12px; min-height:16px; margin-top:6px;"></div>
          </div>
        </div>

        <!-- ---------- النسخ من جهاز تاني ---------- -->
        <div id="copy-box" style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px; display:none;">
          <div style="font-size:13px; font-weight:500; margin-bottom:4px;">📥 انسخ الإعدادات من جهاز تاني</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
            ☁️ ضبط الملصق بقى <strong>مشترك تلقائيًا</strong> بين كل الأجهزة،
            فمش محتاج تنسخه. القسم ده باقي لحاجة واحدة بس:
            <br>• <strong>اختيار الطابعة</strong> — لو نفس اسم الطابعة موجود على الجهاز ده
            <br>• <strong>مابينسخش اسم الجهاز</strong> — كل جهاز لازم يفضل باسمه
          </div>
          <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap;">
            <div class="field" style="flex:1; min-width:150px; margin-bottom:0;">
              <label style="font-size:11px;">انسخ من</label>
              <select class="input" id="copy-from" style="padding:6px;"></select>
            </div>
            <button class="btn" id="copy-run">📥 انسخ</button>
          </div>
          <div id="copy-status" style="font-size:12px; min-height:16px; margin-top:6px; line-height:1.7;"></div>
        </div>

        <!-- ---------- الإطار وضبط مكان الطباعة ---------- -->
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
          <div style="font-size:13px; font-weight:500; margin-bottom:4px;">📐 ضبط مكان الطباعة</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
            اطبع <strong>إطار تجربة</strong> بمقاس الملصق، وبُص هو طالع فين
            على الورق. لو مزحلق، حرّكه بالعكس بالأزرار وجرّب تاني.
            <br>• ☁️ الأرقام دي بتتحفظ <strong>لكل الأجهزة مرة واحدة</strong> — مش محتاج تظبطها على كل كمبيوتر
            <br>• الأصفار = الطباعة زي ما هي بالظبط
          </div>

          <!-- ⚠️ direction:ltr مقصودة: دي لوحة اتجاهات، والسهم لازم يبقى في
               نفس مكان الاتجاه اللي بيحرّك ناحيته. لو سابناها RTL، الشبكة
               بتتقلب والسهم اللي على الشمال بيحرّك يمين. -->
          <div id="align-pad" style="display:grid; grid-template-columns:repeat(3, 40px); gap:6px;
               justify-content:center; margin-bottom:10px; direction:ltr;">
            <span></span>
            <button class="btn" data-nudge="up" style="padding:6px;">▲</button>
            <span></span>
            <button class="btn" data-nudge="left" style="padding:6px;">◀</button>
            <button class="btn" data-nudge="zero" style="padding:6px; font-size:11px;">صفّر</button>
            <button class="btn" data-nudge="right" style="padding:6px;">▶</button>
            <span></span>
            <button class="btn" data-nudge="down" style="padding:6px;">▼</button>
            <span></span>
          </div>

          <div style="display:flex; gap:6px; align-items:flex-end; flex-wrap:wrap; margin-bottom:8px;">
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">يمين/شمال</label>
              <input class="input" type="number" id="align-x" step="0.2"
                     min="-${PRINT_ALIGN_LIMIT_MM}" max="${PRINT_ALIGN_LIMIT_MM}" style="padding:6px;" />
            </div>
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">فوق/تحت</label>
              <input class="input" type="number" id="align-y" step="0.2"
                     min="-${PRINT_ALIGN_LIMIT_MM}" max="${PRINT_ALIGN_LIMIT_MM}" style="padding:6px;" />
            </div>
            <div class="field" style="width:78px; margin-bottom:0;">
              <label style="font-size:11px;">تصغير %</label>
              <input class="input" type="number" id="align-shrink" step="1"
                     min="0" max="${PRINT_SHRINK_LIMIT}" style="padding:6px;" />
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn" id="align-frame">🖨️ اطبع الإطار</button>
            <button class="btn btn-primary" id="align-save" style="padding:6px 14px;">احفظ الضبط</button>
          </div>
          <div id="align-status" style="font-size:12px; min-height:16px; margin-top:6px;"></div>
        </div>

        <!-- ---------- إعدادات متقدمة ---------- -->
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
          <div style="font-size:13px; font-weight:500; margin-bottom:4px;">🧪 إعدادات متقدمة — للتجربة</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
            <strong>مش محتاجها في الوضع العادي.</strong> إعدادات الملصق
            الصح مظبوطة جوه النظام وبتشتغل لوحدها على كل جهاز.
            <br>المفاتيح دي للتجربة بس لو حصلت مشكلة — افتح
            <strong>واحد بس</strong> وجرّب. وهي كمان
            <strong>☁️ بتتحفظ لكل الأجهزة</strong>.
          </div>
          ${PRINT_TWEAKS.map(
            (t) => `
            <label style="display:flex; gap:8px; align-items:flex-start; padding:6px 0; border-bottom:1px solid var(--border); font-size:12px; cursor:pointer;">
              <input type="checkbox" data-tweak="${escapeHTML(t.key)}" ${getPrintTweak(t.key) ? 'checked' : ''}
                     style="margin-top:2px; flex:0 0 auto;" />
              <span>
                <span style="display:block;">${escapeHTML(t.label)}</span>
                <span style="display:block; font-size:10px; color:var(--text-muted); line-height:1.6;">${escapeHTML(t.hint)}</span>
              </span>
            </label>`
          ).join('')}
        </div>

        <!-- ---------- بيانات الطابعات ---------- -->
        <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span style="font-size:13px; font-weight:500;">🖨️ بيانات الطابعات</span>
            <button class="btn" id="qz-details-btn" style="padding:3px 10px; font-size:12px;">اعرض</button>
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
            بتفيد لما نقارن كمبيوتر شغّال بكمبيوتر مش شغّال
          </div>
          <pre id="qz-details" style="display:none; font-size:10px; direction:ltr; text-align:start;
               background:var(--surface-muted); padding:8px; border-radius:8px; margin-top:8px;
               max-height:180px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere;"></pre>
        </div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
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

  // ---- المفاتيح المتقدمة: بتتحفظ فورًا على الجهاز ----
  overlay.querySelectorAll('[data-tweak]').forEach((box) => {
    box.addEventListener('change', () => setPrintTweak(box.getAttribute('data-tweak'), box.checked));
  });

  // ---- بيانات الطابعات ----
  const detailsBtn = overlay.querySelector('#qz-details-btn');
  const detailsBox = overlay.querySelector('#qz-details');
  detailsBtn.addEventListener('click', () =>
    safeAsync(async () => {
      detailsBox.style.display = 'block';
      detailsBox.textContent = 'جارٍ القراءة...';
      try {
        const info = await qz.printers.details();
        detailsBox.textContent = JSON.stringify(info, null, 1);
      } catch (err) {
        detailsBox.textContent = 'تعذّرت القراءة: ' + (err && err.message ? err.message : err);
      }
    }, 'قراءة بيانات الطابعات')
  );

  // ---- جودة الطباعة ----
  const pqSpeed = overlay.querySelector('#pq-speed');
  const pqDensity = overlay.querySelector('#pq-density');
  const pqStatus = overlay.querySelector('#pq-status');
  const q0 = getPrintQuality();
  pqSpeed.value = q0.speed;
  pqDensity.value = q0.density;
  overlay.querySelector('#pq-apply').addEventListener('click', () =>
    safeAsync(async () => {
      const printerName = labelSelect.value;
      if (!printerName) {
        pqStatus.style.color = 'var(--danger-text)';
        pqStatus.textContent = 'اختار طابعة الملصق الأول.';
        return;
      }
      saveSelectedPrinter('label', printerName);
      pqStatus.style.color = 'var(--text-secondary)';
      pqStatus.textContent = 'جارٍ الإرسال...';
      try {
        await applyPrintQuality(printerName, pqSpeed.value, pqDensity.value);
        pqStatus.style.color = '#2e7d32';
        pqStatus.textContent = '✅ اتخزّنت جوه الطابعة. اطبع ملصق وشوف الفرق.';
      } catch (err) {
        console.error(err);
        pqStatus.style.color = 'var(--danger-text)';
        pqStatus.textContent = '⚠️ ' + (err && err.message ? err.message : 'تعذّر الإرسال');
      }
    }, 'جودة الطباعة')
  );

  // ---- عيّنة خطوط الطابعة ----
  const tsplStatus = overlay.querySelector('#tspl-status');
  overlay.querySelector('#tspl-sample').addEventListener('click', () =>
    safeAsync(async () => {
      const printerName = labelSelect.value;
      if (!printerName) {
        tsplStatus.style.color = 'var(--danger-text)';
        tsplStatus.textContent = 'اختار طابعة الملصق الأول.';
        return;
      }
      saveSelectedPrinter('label', printerName);
      const w = Number(overlay.querySelector('#cal-w').value) || 38;
      const h = Number(overlay.querySelector('#cal-h').value) || 25;
      tsplStatus.style.color = 'var(--text-secondary)';
      tsplStatus.textContent = 'جارٍ الإرسال...';
      try {
        await printTSPLFontSample(printerName, w, h, 'Hejap Kuwaiti 120', '10632103');
        tsplStatus.style.color = '#2e7d32';
        tsplStatus.textContent = '✅ اتبعت. شوف الملصق وقولنا أنهي خط أوضح.';
      } catch (err) {
        console.error(err);
        tsplStatus.style.color = 'var(--danger-text)';
        tsplStatus.textContent = '⚠️ ' + (err && err.message ? err.message : 'تعذّر الإرسال');
      }
    }, 'عيّنة خطوط الطابعة')
  );

  // ---- ضبط مكان الطباعة ----
  const alignX = overlay.querySelector('#align-x');
  const alignY = overlay.querySelector('#align-y');
  const alignShrink = overlay.querySelector('#align-shrink');
  const alignStatus = overlay.querySelector('#align-status');

  const fillAlign = () => {
    const a = getPrintAlign();
    alignX.value = a.x;
    alignY.value = a.y;
    alignShrink.value = a.shrink;
  };
  const readAlign = () => ({
    x: Number(alignX.value) || 0,
    y: Number(alignY.value) || 0,
    shrink: Number(alignShrink.value) || 0,
  });
  // بنحفظ الأول وبعدين نقرا تاني — عشان الخانات تبان بالقيمة **بعد** الحد
  // الأقصى والتقريب، فاللي شايفه هو اللي هيتطبع فعلًا.
  const commitAlign = () => {
    savePrintAlign(readAlign());
    fillAlign();
  };
  fillAlign();

  const STEP = 0.2;
  overlay.querySelectorAll('#align-pad [data-nudge]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.getAttribute('data-nudge');
      const a = readAlign();
      if (dir === 'zero') savePrintAlign({ x: 0, y: 0, shrink: 0 });
      else {
        if (dir === 'left') a.x -= STEP;
        if (dir === 'right') a.x += STEP;
        if (dir === 'up') a.y -= STEP;
        if (dir === 'down') a.y += STEP;
        savePrintAlign(a);
      }
      fillAlign();
      alignStatus.style.color = 'var(--text-secondary)';
      alignStatus.textContent = 'اتحفظ. اطبع الإطار تاني وشوف.';
    });
  });

  overlay.querySelector('#align-save').addEventListener('click', () => {
    commitAlign();
    alignStatus.style.color = '#2e7d32';
    alignStatus.textContent = '✅ اتحفظ على الجهاز ده.';
  });

  overlay.querySelector('#align-frame').addEventListener('click', () =>
    safeAsync(async () => {
      // بنحفظ قبل الطباعة عشان الإطار يطلع بالأرقام اللي مكتوبة قدامه
      // دلوقتي، مش بأرقام قديمة — ده أكتر مصدر لبس متوقّع هنا.
      commitAlign();
      if (!labelSelect.value) {
        alignStatus.style.color = 'var(--danger-text)';
        alignStatus.textContent = 'اختار طابعة الملصق الأول.';
        return;
      }
      // الطباعة بتقرا الطابعة المحفوظة، مش اللي مختارة في القايمة. لو
      // المستخدم غيّر الاختيار وما ضغطش حفظ، الإطار كان هيروح للطابعة
      // القديمة — فبنحفظ الاختيار هنا قبل ما نبعت.
      saveSelectedPrinter('label', labelSelect.value);
      alignStatus.style.color = 'var(--text-secondary)';
      alignStatus.textContent = 'جارٍ إرسال الإطار...';
      const viaQZ = await printTestFrame(38, 25);
      alignStatus.style.color = viaQZ ? '#2e7d32' : 'var(--text-secondary)';
      alignStatus.textContent = viaQZ
        ? '✅ اتبعت. قارن الإطار بحدود الملصق نفسه.'
        : 'اتفتحت نافذة طباعة المتصفح (QZ مش شغّال).';
    }, 'طباعة إطار التجربة')
  );

  // ---- النسخ من جهاز تاني ----
  // بنعرضه بس لو فيه فعلًا جهاز تاني عنده ضبط محفوظ — قسم فاضي بيخوّف
  // ومابيفيدش.
  const copyBox = overlay.querySelector('#copy-box');
  const copyFrom = overlay.querySelector('#copy-from');
  const copyStatus = overlay.querySelector('#copy-status');
  const myDeviceId = getDeviceId();
  const sources = (state.printStations || []).filter(
    (s) => s.id !== myDeviceId && s.printSetup && typeof s.printSetup === 'object'
  );

  if (sources.length) {
    copyBox.style.display = 'block';
    copyFrom.innerHTML = sources
      .map((s) => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.deviceName || 'جهاز بدون اسم')}</option>`)
      .join('');

    overlay.querySelector('#copy-run').addEventListener('click', () => {
      const src = sources.find((s) => s.id === copyFrom.value);
      if (!src) return;

      const done = [];
      const setup = src.printSetup || {};

      if (setup.align) {
        savePrintAlign(setup.align);
        fillAlign();
        const a = getPrintAlign();
        done.push(`ضبط مكان الطباعة (X ${a.x} / Y ${a.y} / -${a.shrink}%)`);
      }
      if (setup.tweaks) {
        setPrintTweaksMap(setup.tweaks);
        overlay.querySelectorAll('[data-tweak]').forEach((box) => {
          box.checked = getPrintTweak(box.getAttribute('data-tweak'));
        });
        const on = PRINT_TWEAKS.filter((t) => getPrintTweak(t.key)).length;
        done.push(on ? `الإعدادات المتقدمة (${on} مفتوح)` : 'الإعدادات المتقدمة (كلهم مقفولين)');
      }

      // الطابعة بتتنسخ **بالاسم**، وبس لو الاسم ده موجود فعلًا على الجهاز
      // ده. من غير الشرط ده كنا هنحفظ اسم طابعة مش موجودة، والطباعة تفضل
      // تفشل من غير سبب واضح.
      const missing = [];
      [
        ['label', src.labelPrinter, labelSelect, 'طابعة الملصق'],
        ['restock', src.restockPrinter, restockSelect, 'طابعة ورقة التزويد'],
      ].forEach(([, name, select, label]) => {
        if (!name) return;
        if (printers.indexOf(name) !== -1) {
          select.value = name;
          done.push(`${label}: ${name}`);
        } else {
          missing.push(`${label} "${name}" مش موجودة على الجهاز ده — اختارها بنفسك`);
        }
      });

      copyStatus.style.color = '#2e7d32';
      copyStatus.innerHTML =
        `✅ اتنسخ: ${escapeHTML(done.join('، '))}` +
        (missing.length ? `<br><span style="color:var(--danger-text);">⚠️ ${escapeHTML(missing.join(' — '))}</span>` : '') +
        `<br><span style="color:var(--text-secondary);">اضغط <strong>حفظ</strong> تحت، وبعدين اطبع الإطار وتأكد — الزحلقة بتفرق شوية من طابعة لطابعة.</span>`;
    });
  }

  // ---- المعايرة ----
  const calStatus = overlay.querySelector('#cal-status');
  overlay.querySelector('#cal-run').addEventListener('click', () =>
    safeAsync(async () => {
      const printerName = labelSelect.value;
      if (!printerName) {
        calStatus.style.color = 'var(--danger-text)';
        calStatus.textContent = 'اختار طابعة الملصق الأول.';
        return;
      }
      const w = Number(overlay.querySelector('#cal-w').value) || 38;
      const h = Number(overlay.querySelector('#cal-h').value) || 25;
      const gap = Number(overlay.querySelector('#cal-gap').value) || 2;

      // تأكيد فيه اسم الطابعة بالظبط — دي العملية الوحيدة اللي بتغيّر حاجة
      // في العتاد، فمينفعش تحصل بضغطة غلط.
      const ok = confirm(
        `هتتم معايرة الطابعة:\n${printerName}\n\n` +
          `مقاس الملصق: ${w} × ${h} مم، الفراغ ${gap} مم\n\n` +
          `الطابعة هتطلّع 2-3 ملصقات وهي بتقيس.\nتكمّل؟`
      );
      if (!ok) return;

      calStatus.style.color = 'var(--text-secondary)';
      calStatus.textContent = 'جارٍ المعايرة...';
      try {
        await calibratePrinter(printerName, w, h, gap);
        calStatus.style.color = '#2e7d32';
        calStatus.textContent = '✅ اتبعتت. شوف الطابعة — المفروض طلّعت ملصقين تلاتة. جرّب تطبع دلوقتي.';
      } catch (err) {
        console.error(err);
        calStatus.style.color = 'var(--danger-text)';
        calStatus.textContent = '⚠️ ' + (err && err.message ? err.message : 'تعذّرت المعايرة');
      }
    }, 'معايرة الطابعة')
  );

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
async function requestShortage(gradeId) {
  const categoryId = state.activeCategoryId;
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;
  const gradeRef = gradeRefOf(categoryId, gradeId);
  fireWrite(gradeRef.update({ status: 'pending' }), 'طلب تزويد');
  pushUndo({
    label: `${gradeDisplayName(data)} — طلب تزويد`,
    categoryId,
    gradeId,
    gradeLabel: gradeDisplayName(data),
    before: { status: data.status || 'normal' },
    after: { status: 'pending' },
  });
  const categoryName = state.categories.find((c) => c.id === categoryId)?.name || '';
  logActivity({
    action: 'request_shortage',
    categoryId,
    categoryName,
    gradeId,
    gradeNumber: data.number,
  });
}

async function cancelShortage(gradeId) {
  const categoryId = state.activeCategoryId;
  const data = await readGrade(categoryId, gradeId);
  if (!data) return;
  const gradeRef = gradeRefOf(categoryId, gradeId);
  fireWrite(gradeRef.update({ status: 'normal' }), 'إلغاء طلب تزويد');
  pushUndo({
    label: `${gradeDisplayName(data)} — إلغاء طلب التزويد`,
    categoryId,
    gradeId,
    gradeLabel: gradeDisplayName(data),
    before: { status: data.status || 'pending' },
    after: { status: 'normal' },
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
  fireWrite(gradeRef.update({ status: 'normal', mainQty: newMainQty, branchQty: newBranchQty }), 'تزويد');
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

async function applyQuantityChange(categoryId, gradeId, gradeData, field, oldValue, newValue) {
  const gradeRef = gradeRefOf(categoryId, gradeId);
  const data = gradeData || {};
  const update = { [field]: newValue };

  // ⭐ الحالة بتتحدد من الكميات لوحدها (شرح القاعدة عند nextStatusFromQuantities)
  const nextStatus = nextStatusFromQuantities(data, field, newValue);
  if (nextStatus) update.status = nextStatus;

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

function subscribeActivityLog() {
  if (unsubActivityLog) unsubActivityLog();
  unsubActivityLog = db
    .collection('activityLog')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot(
      (snap) => {
        state.activityLog = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      subscribePrintSettings();
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
function connectionDotHTML() {
  let colorVar, label, short;
  if (!state.isOnline) {
    colorVar = 'var(--danger-text)';
    label = 'غير متصل بالإنترنت';
    short = 'مفصول';
  } else if (state.hasPendingWrites) {
    colorVar = '#b8860b';
    label = 'جارٍ رفع البيانات...';
    short = 'بيرفع';
  } else {
    colorVar = '#2e7d32';
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
