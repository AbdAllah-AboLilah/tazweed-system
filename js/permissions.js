// ============================================================
// الرتب والصلاحيات
// ============================================================
// الفكرة اللي النظام ده اتبنى عليها:
//
//   **الرتبة قالب جاهز، مش قفل.**
//
// كل حساب عنده قايمة مفاتيح (اقدر أعمل إيه). الرتبة بتملا المفاتيح دي
// بقيم افتراضية معقولة، وبعد كده تقدر تفتح أو تقفل **مفتاح واحد بعينه
// لشخص واحد بعينه** من غير ما تغيّر رتبته ومن غير ما تأثر على حد تاني.
//
// ليه ده أحسن من الرتب لوحدها؟ لأن الرتبة بتجمع حاجات كتير مع بعض. كنت
// عايز حد "يعدّل الكميات ويطبع بس مايحذفش فئة" — ومكانش فيه أي طريقة
// تعبّر عن ده. دلوقتي فيه.
//
// ⚠️ قاعدة لازم تفضل: **كل مفتاح هنا لازم يكون متنفّذ في firestore.rules
// كمان.** إخفاء الزرار من الشاشة مش حماية — أي حد فاهم يقدر يتخطاه. الشاشة
// بتمنع الغلط، والقواعد بتمنع الاختراق.

const ROLES = {
  // ⭐ منشئ النظام — الحساب بتاع صاحب المحل.
  // مربوط بمعرّف الحساب في قواعد الأمان، فمحدش يقدر ينزّل رتبته ولا يحذفه
  // — ولا حتى مدير تاني. ده بيسد ثغرة حقيقية: قبل كده أي "مدير" كان يقدر
  // ينزّل رتبة صاحب المحل ويقفل عليه نظامه.
  OWNER: 'owner',
  BRANCH_MANAGER: 'branch_manager',
  SUPERVISOR: 'supervisor',
  WAREHOUSE_KEEPER: 'warehouse_keeper',
  PRINT_OPERATOR: 'print_operator',
  USER: 'user',
  // ⚠️ متشيلهاش: الحسابات القديمة اتعملت برتبة 'admin'. لو شِلناها،
  // صاحب الحساب ده هيتقفل بره النظام فجأة. بتتعامل زي منشئ النظام.
  ADMIN: 'admin',
};

const ROLE_LABELS_AR = {
  [ROLES.OWNER]: 'منشئ النظام',
  [ROLES.ADMIN]: 'مدير',
  [ROLES.BRANCH_MANAGER]: 'مدير الفرع',
  [ROLES.SUPERVISOR]: 'مشرف',
  [ROLES.WAREHOUSE_KEEPER]: 'أمين مخزن',
  [ROLES.PRINT_OPERATOR]: 'موظف طباعة',
  [ROLES.USER]: 'مستخدم عادي',
};

// الرتب اللي تظهر في قايمة الاختيار. 'admin' مش موجودة لأنها رتبة قديمة
// بتتدعم بس ومش بنعمل بيها حسابات جديدة.
const ASSIGNABLE_ROLES = [
  ROLES.OWNER,
  ROLES.BRANCH_MANAGER,
  ROLES.SUPERVISOR,
  ROLES.WAREHOUSE_KEEPER,
  ROLES.PRINT_OPERATOR,
  ROLES.USER,
];

// ------------------------------------------------------------
// المفاتيح
// ------------------------------------------------------------
// danger: true → المفتاح ده بيعمل حاجة مالهاش رجعة، فبيتعرض بلون تحذير
//                في شاشة الحسابات عشان محدش يفتحه من غير ما ياخد باله.
const PERMISSION_GROUPS = [
  {
    name: 'المخزن',
    items: [
      { key: 'editBranchQty', label: 'تعديل كمية مخزن الفرع', hint: 'ومعاها طلب التزويد وإلغاؤه' },
      { key: 'editMainQty', label: 'تعديل كمية المخزن الرئيسي', hint: 'ومعاها الرد على طلبات التزويد' },
    ],
  },
  {
    name: 'الفئات والدرجات',
    items: [
      { key: 'manageCategories', label: 'إضافة وتعديل الفئات', hint: 'الاسم، الباركود، السعر، الحد الأدنى، مجموعات الألوان' },
      { key: 'addGrades', label: 'إضافة درجات', hint: 'درجة واحدة أو دفعة أو الدرجات الأساسية' },
      { key: 'deleteGrades', label: 'حذف درجات', hint: 'مالهوش تراجع', danger: true },
      { key: 'deleteCategories', label: 'حذف فئة بالكامل', hint: 'بتشيل كل درجاتها معاها — مالهوش تراجع', danger: true },
    ],
  },
  {
    name: 'الطباعة',
    items: [
      { key: 'printLabel', label: 'طباعة ملصق باركود' },
      { key: 'printRestock', label: 'طباعة ورقة التزويد' },
      { key: 'printScreen', label: 'شاشة طباعة الباركود', hint: 'البحث في الأصناف وطباعة ملصقاتها' },
      { key: 'remotePrint', label: 'إرسال طباعة لجهاز تاني' },
    ],
  },
  {
    name: 'الأصناف',
    items: [
      { key: 'viewProducts', label: 'شاشة الأصناف', hint: 'البحث في أصناف الكاشير' },
      { key: 'importProducts', label: 'استيراد ملف الأصناف', hint: 'بيستبدل قاعدة الأصناف كلها', danger: true },
    ],
  },
  {
    name: 'الإدارة',
    items: [
      { key: 'manageUsers', label: 'إدارة الحسابات', hint: 'إنشاء حسابات وتغيير صلاحيات', danger: true },
      { key: 'excelTools', label: 'تصدير واستيراد إكسل' },
      { key: 'viewActivity', label: 'سجل العمليات' },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.reduce((all, g) => all.concat(g.items.map((i) => i.key)), []);

// ------------------------------------------------------------
// القوالب الافتراضية لكل رتبة
// ------------------------------------------------------------
// اللي مش مكتوب في القالب = مقفول.
const ALL_ON = ALL_PERMISSIONS.reduce((o, k) => ((o[k] = true), o), {});

const ROLE_PRESETS = {
  [ROLES.OWNER]: { ...ALL_ON },
  // الرتبة القديمة — نفس صلاحيات منشئ النظام عشان الحسابات القديمة ما تتقفلش.
  [ROLES.ADMIN]: { ...ALL_ON },

  [ROLES.BRANCH_MANAGER]: {
    ...ALL_ON,
    // إدارة الحسابات مقفولة افتراضيًا، وتتفتح لشخص بعينه لو احتجت حد
    // يقدر يدير الحسابات وانت مش موجود.
    manageUsers: false,
  },

  // المشرف بينظّم الشيتات ويطبع، **بس مايلمسش الأرقام** ومايحذفش.
  [ROLES.SUPERVISOR]: {
    editBranchQty: false,
    editMainQty: false,
    manageCategories: true,
    addGrades: true,
    deleteGrades: false,
    deleteCategories: false,
    printLabel: true,
    printRestock: true,
    printScreen: true,
    remotePrint: true,
    viewProducts: true,
    importProducts: false,
    manageUsers: false,
    excelTools: true,
    viewActivity: true,
  },

  // أمين المخزن: المخزن اللي متحدّد له في خانة "المخزن" بس (تحت).
  // إضافة الدرجات مفتوحة له — هو اللي بيكتشف الدرجة الناقصة على الرف.
  [ROLES.WAREHOUSE_KEEPER]: {
    editBranchQty: true,
    editMainQty: true,
    manageCategories: false,
    addGrades: true,
    deleteGrades: false,
    deleteCategories: false,
    printLabel: true,
    printRestock: true,
    printScreen: true,
    remotePrint: false,
    viewProducts: true,
    importProducts: false,
    manageUsers: false,
    excelTools: false,
    viewActivity: true,
  },

  [ROLES.PRINT_OPERATOR]: {
    editBranchQty: false,
    editMainQty: false,
    manageCategories: false,
    addGrades: false,
    deleteGrades: false,
    deleteCategories: false,
    printLabel: true,
    printRestock: false,
    printScreen: true,
    remotePrint: true,
    viewProducts: false,
    importProducts: false,
    manageUsers: false,
    excelTools: false,
    viewActivity: false,
  },

  [ROLES.USER]: {
    editBranchQty: false,
    editMainQty: false,
    manageCategories: false,
    addGrades: false,
    deleteGrades: false,
    deleteCategories: false,
    printLabel: true,
    printRestock: false,
    printScreen: true,
    remotePrint: false,
    viewProducts: true,
    importProducts: false,
    manageUsers: false,
    excelTools: false,
    viewActivity: true,
  },
};

// ------------------------------------------------------------
// السؤال الوحيد اللي الواجهة بتسأله
// ------------------------------------------------------------
// الترتيب مهم:
//   1) لو فيه استثناء متسجّل للشخص ده على المفتاح ده → ياخد بيه
//   2) وإلا → قالب رتبته
//   3) وإلا → مقفول
//
// النقطة (2) هي اللي بتخلي **الحسابات الموجودة دلوقتي تشتغل زي ما هي**
// من غير أي تعديل عليها: مالهاش استثناءات، فبتاخد قالب رتبتها على طول.
function can(profile, key) {
  if (!profile || !profile.role) return false;

  const overrides = profile.perms;
  if (overrides && typeof overrides === 'object' && typeof overrides[key] === 'boolean') {
    return overrides[key];
  }

  const preset = ROLE_PRESETS[profile.role];
  return !!(preset && preset[key]);
}

function isOwner(profile) {
  return !!profile && (profile.role === ROLES.OWNER || profile.role === ROLES.ADMIN);
}

// ------------------------------------------------------------
// خانة "المخزن" لأمين المخزن
// ------------------------------------------------------------
// مفتاح "تعديل كمية الفرع" بيقول **هل** يقدر، وخانة warehouseAccess بتقول
// **أنهي مخزن**. الاتنين لازم يوافقوا.
//
// وده بيسري على أي حساب فيه warehouseAccess متحدّدة، مش أمين المخزن بس —
// فتقدر تعمل مدير فرع مقصور على مخزن الفرع لو حبيت.
function canEditWarehouse(profile, warehouseType) {
  if (!profile) return false;
  const key = warehouseType === 'main' ? 'editMainQty' : 'editBranchQty';
  if (!can(profile, key)) return false;

  const access = profile.warehouseAccess;
  if (!access || access === 'both') return true;
  return access === warehouseType;
}

// ------------------------------------------------------------
// أسماء قديمة — الكود القديم بينادي بيها، فبنسيبها كواجهة للمفاتيح
// ------------------------------------------------------------
function canManageUsers(profile) {
  return can(profile, 'manageUsers');
}

function canManageCatalog(profile) {
  return can(profile, 'manageCategories');
}

function canSendRemotePrint(profile) {
  return can(profile, 'remotePrint');
}

function isPrintOperator(profile) {
  return !!profile && profile.role === ROLES.PRINT_OPERATOR;
}

function canUsePrintScreen(profile) {
  return can(profile, 'printScreen');
}

function canManageProducts(profile) {
  return can(profile, 'importProducts');
}
