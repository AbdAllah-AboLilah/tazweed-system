// نظام الأدوار والصلاحيات — طبقًا لملف المواصفات (قسم 4)
// سكريبت عادي (مش module)، القيم بتبقى متاحة كمتغيرات عامة للملفات اللي بعده.

const ROLES = {
  ADMIN: 'admin',
  BRANCH_MANAGER: 'branch_manager',
  SUPERVISOR: 'supervisor',
  WAREHOUSE_KEEPER: 'warehouse_keeper',
  // رتبة جديدة: الحساب ده بيفتح على **شاشة طباعة الباركود بس**. مايشوفش
  // الشيتات ولا لوحة التحكم ولا الكميات — عشان موظف الطباعة يشتغل على
  // حاجته من غير ما يقدر يلمس المخزن.
  PRINT_OPERATOR: 'print_operator',
  USER: 'user',
};

const ROLE_LABELS_AR = {
  [ROLES.ADMIN]: 'مدير',
  [ROLES.BRANCH_MANAGER]: 'مدير الفرع',
  [ROLES.SUPERVISOR]: 'مشرف',
  [ROLES.WAREHOUSE_KEEPER]: 'أمين مخزن',
  [ROLES.PRINT_OPERATOR]: 'موظف طباعة (شاشة الطباعة بس)',
  [ROLES.USER]: 'مستخدم عادي',
};

const FULL_ACCESS_ROLES = [ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.SUPERVISOR];

function canEditWarehouse(profile, warehouseType) {
  if (!profile) return false;
  if (FULL_ACCESS_ROLES.includes(profile.role)) return true;
  if (profile.role === ROLES.WAREHOUSE_KEEPER) {
    return profile.warehouseAccess === warehouseType || profile.warehouseAccess === 'both';
  }
  return false;
}

function canManageUsers(profile) {
  return !!profile && profile.role === ROLES.ADMIN;
}

function hasFullAccess(profile) {
  return !!profile && FULL_ACCESS_ROLES.includes(profile.role);
}

// صلاحية جديدة: مستخدمين معينين بس (يُفعَّلها المدير يدويًا في Firestore
// بحقل canSendRemotePrint: true على حساب المستخدم) يقدروا يبعتوا طلب
// طباعة لمكان تاني (فرع/رئيسي) غير مكانهم.
function canSendRemotePrint(profile) {
  // موظف الطباعة شغلته كلها إنه يبعت للطابعة، فالصلاحية دي معاه بالأساس.
  return (
    !!profile &&
    (profile.canSendRemotePrint === true || hasFullAccess(profile) || profile.role === ROLES.PRINT_OPERATOR)
  );
}

// ------------------------------------------------------------
// شاشة طباعة الباركود وقاعدة بيانات الأصناف
// ------------------------------------------------------------
// الحساب اللي رتبته "موظف طباعة" **مايشوفش غير شاشة الطباعة**. أي حساب
// تاني بيشوفها كمان (هي مجرد شاشة طباعة، مش خطر عليها).
function isPrintOperator(profile) {
  return !!profile && profile.role === ROLES.PRINT_OPERATOR;
}

function canUsePrintScreen(profile) {
  return !!profile && (isPrintOperator(profile) || profile.canUsePrintScreen === true || hasFullAccess(profile) || profile.role === ROLES.WAREHOUSE_KEEPER || profile.role === ROLES.USER);
}

// قراءة قاعدة الأصناف مسموحة لأي حد داخل النظام (الشاشة نفسها بتحتاجها)،
// لكن **الاستيراد والتعديل** للمدير وصاحب الصلاحية الكاملة بس.
function canManageProducts(profile) {
  return hasFullAccess(profile);
}
