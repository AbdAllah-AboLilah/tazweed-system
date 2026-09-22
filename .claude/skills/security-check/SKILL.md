---
name: security-check
description: Security review for this web app (any stack, with extra checks for Firebase and vanilla JavaScript). Use this skill after implementing ANY new feature, page, API call, database query, or server function, and whenever the user says "راجع الأمان", "security check", "افحص الكود", or asks if something is safe — even if they don't explicitly ask. Do not consider a feature finished until this review has run.
---

# Security Check

## Step 0 — Learn the project
Read `.claude/project-map.md`. If it's missing or outdated, explore the code (config files, Firebase/API usage) and update it. Keep it short, facts only.

## Step 1 — Scope
Review only the files changed for the current feature (`git diff` if available) plus files they depend on. Don't rewrite unrelated code.
Skip any section that doesn't apply to this project; mention it in one line as "مش مستخدم". Never invent issues.

## Step 2 — Checklist

### A. General (any web app)
- Auth: protected pages and actions are checked on the server/database side, not only by hiding buttons.
- Authorization: users only see and change their own data (or their own store/workspace). Roles are never trusted from localStorage or the URL.
- Input: user/customer text shown with `innerHTML` is escaped, or uses `textContent`. No `eval` / `new Function`.
- Secrets: no private API keys or tokens in frontend files or the repo. Webhooks verify signatures.
- Sensitive data: no passwords, tokens, or full phone numbers in `console.log`. Customer data isn't exposed to other users.
- Abuse: list queries have limits; expensive operations have rate limiting.

### B. Firebase (only if used)
- Every collection/path in the code has a rule in `firestore.rules` / `storage.rules`.
- No `allow read, write: if true;`. Rules check ownership (`ownerId` / `workspaceId`), not only `request.auth != null`.
- Users can't write sensitive fields like `role`, `plan`, `ownerId`, `balance`.
- Storage uploads limit file type and size.
- Cloud Functions check auth and validate inputs again.
- The public Firebase web config (`apiKey`) is normal; it's only a problem if rules are weak.
- App Check is considered for public-facing apps to limit abuse and billing spikes.

### C. Project rules
Apply every rule in `.claude/project-map.md` under "Project rules".

## Step 3 — Report (Egyptian Arabic, short)
1. النتيجة: ✅ آمن / ⚠️ فيه ملاحظات / ❌ فيه ثغرة لازم تتصلح
2. لكل مشكلة: الملف والسطر، المشكلة في جملة، والخطورة (عالية / متوسطة / منخفضة).
3. صلّح المشاكل عالية الخطورة مباشرة، واعرض الباقي قبل التعديل.
4. لو حدّثت project-map.md قول ده في سطر.

---

## ⚠️ زيادات خاصة بالمشروع ده

الحاجات دي اتصلّحت هنا قبل كده فعلًا، فبتتفحص كل مرة:

- **قالب الرتبة في مكانين**: `ROLE_PRESETS` في `js/permissions.js` لازم
  يطابق `presetHas()` في `firestore.rules` مفتاح بمفتاح. شغّل
  `tests/perms-drift-test.js` — بيفشل بالاسم لو اختلفوا.
  (حصل فعلًا: الشاشة كانت بتقول "مقفول" والسحابة سايبة الباب مفتوح.)
- **مفتاح صلاحية جديد**: لازم يكون مذكور في `firestore.rules`، وإلا
  يبقى ديكور — الزرار بيتخفّي والسحابة بتقبل الطلب عادي.
  الاستثناء الوحيد المعتمد: `downloadHelper` (بيخفّي رابط ملف عام،
  مالوش أي تعامل مع السحابة). `tests/perms-test.js` بيحرس ده.
- **`escapeHTML`**: أي نص جاي من مستخدم أو من ملف الأصناف بيتعرض في
  `innerHTML` لازم يعدّي عليها.
- **البرنامج المساعد**: لازم يفضل من غير أي مفتاح سحابة، ويسمع على
  `127.0.0.1` بس، وقايمة المصادر المسموحة تفضل مقفولة.
- **`helper/fonts/`**: أسماء الملفات المطلوبة بتتفلتر على قايمة معروفة —
  متسيبهاش تقرا أي مسار.
- **هوية الماكينة** (`machineId` / `deviceName`) مايتصدّروش ومايتستوردوش.
