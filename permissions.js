// نظام الأدوار والصلاحيات — طبقًا لملف المواصفات (قسم 4)
// سكريبت عادي (مش module)، القيم بتبقى متاحة كمتغيرات عامة للملفات اللي بعده.

const ROLES = {
  ADMIN: 'admin',
  BRANCH_MANAGER: 'branch_manager',
  SUPERVISOR: 'supervisor',
  WAREHOUSE_KEEPER: 'warehouse_keeper',
  USER: 'user',
};

const ROLE_LABELS_AR = {
  [ROLES.ADMIN]: 'مدير',
  [ROLES.BRANCH_MANAGER]: 'مدير الفرع',
  [ROLES.SUPERVISOR]: 'مشرف',
  [ROLES.WAREHOUSE_KEEPER]: 'أمين مخزن',
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
