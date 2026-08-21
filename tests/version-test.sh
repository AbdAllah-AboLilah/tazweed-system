#!/usr/bin/env bash
# ============================================================
# أداة رقم الإصدار — بتكتب في الملفين مع بعض
# ============================================================
# ⚠️ المشكلة اللي بتحلها: الرقم كان بيتكتب بإيدنا في ملفين لازم يفضلوا
# متطابقين. ولو اختلفوا، الاتنين بيعدّوا في صمت:
#   • app-info أحدث → الشريط بيقول رقم جديد **والتحديث مايوصلش لحد**
#   • sw أحدث       → التحديث بيوصل والشريط بيقول رقم قديم
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0
ok()   { echo "   ⭐ $1"; pass=$((pass+1)); }
bad()  { echo "   ❌ $1"; fail=$((fail+1)); }
v_app() { grep -o "APP_VERSION = '[^']*'" js/app-info.js | cut -d"'" -f2; }
v_sw()  { grep -o "SW_VERSION = '[^']*'"  sw.js          | cut -d"'" -f2; }

ORIG="$(v_app)"
trap 'python3 tools/bump.py --set "$ORIG" >/dev/null 2>&1' EXIT

python3 tools/bump.py --set 1.2.3 >/dev/null
[ "$(v_app)" = "1.2.3" ] && [ "$(v_sw)" = "1.2.3" ] && ok "--set بتكتب في الملفين مع بعض" || bad "--set: app=$(v_app) sw=$(v_sw)"

python3 tools/bump.py >/dev/null
[ "$(v_app)" = "1.3.0" ] && [ "$(v_sw)" = "1.3.0" ] && ok "الافتراضي بيزوّد الأوسط (1.2.3 → 1.3.0)" || bad "bump: $(v_app)"

python3 tools/bump.py --patch >/dev/null
[ "$(v_app)" = "1.3.1" ] && ok "--patch بيزوّد الأخير" || bad "patch: $(v_app)"

python3 tools/bump.py --major >/dev/null
[ "$(v_app)" = "2.0.0" ] && [ "$(v_sw)" = "2.0.0" ] && ok "--major بيصفّر اللي بعده" || bad "major: $(v_app)"

# ⚠️⚠️ أهم فحصين: الاختلاف
python3 tools/bump.py --set 2.0.0 >/dev/null
sed -i "s/APP_VERSION = '2.0.0'/APP_VERSION = '1.9.9'/" js/app-info.js
python3 tests/audit.py >/dev/null 2>&1 && bad "الفحص عدّى والرقمين مختلفين!" || ok "⭐ audit.py **بيفشل** لما الرقمين يختلفوا"
python3 tools/bump.py >/dev/null 2>&1 && bad "bump اشتغلت والرقمين مختلفين" || ok "⭐ وbump بترفض تشتغل على اختلاف"
# ⚠️ بس --set لازم **تشتغل** — هي اللي بتصلّح الاختلاف. أول نسخة كانت
# بترفض، يعني الأداة كانت بترفض تصلّح المشكلة اللي هي مخصوصة لها.
python3 tools/bump.py --set 2.0.0 >/dev/null 2>&1 && ok "⭐⭐ و--set بتصلّح الاختلاف (مش بترفض)" || bad "--set رفضت تصلّح"
python3 tests/audit.py >/dev/null 2>&1 && ok "وبعدها الفحص بيعدّي" || bad "الفحص لسه فاشل بعد التصليح"

python3 tools/bump.py --set 9.9 >/dev/null 2>&1 && bad "قبلت رقم ناقص" || ok "بترفض رقم بشكل غلط"
python3 tools/bump.py --set >/dev/null 2>&1 && bad "قبلت --set من غير رقم" || ok "بترفض --set من غير رقم"

python3 tools/bump.py --set "$ORIG" >/dev/null
[ "$(v_app)" = "$ORIG" ] && ok "رجّعنا الرقم الأصلي ($ORIG)" || bad "مارجعش"

echo
if [ "$fail" -gt 0 ]; then echo "❌ فشل ($fail)"; exit 1; fi
echo "✅ نجح ($pass)"
