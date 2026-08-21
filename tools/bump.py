#!/usr/bin/env python3
"""
رفع رقم الإصدار — مكان واحد بدل ما نفتكر ملفين.

المشكلة اللي بيحلها: الرقم كان مكتوب بإيدنا في **ملفين** لازم يفضلوا
متطابقين:

    js/app-info.js  →  APP_VERSION   (اللي بيظهر للمستخدم في الشريط)
    sw.js           →  SW_VERSION    (اللي بيخلي المتصفح يحس بالتحديث)

⚠️⚠️ وليه الاتنين لازم يتغيّروا مع بعض: المتصفح بيكتشف "فيه تحديث"
بمقارنة **محتوى sw.js بايت ببايت** مع النسخة المسجّلة عنده. لو غيّرنا
app-info.js بس، الرقم الجديد بيبان في الشريط **والتحديث مايوصلش لحد** —
لأن الـService Worker مايتغيّرش فالمتصفح مايحسّش بحاجة.

ولو نسينا نغيّر app-info.js، المستخدم بيبقى على نسخة جديدة والشريط بيقول
رقم قديم.

الاستخدام:

    python3 tools/bump.py            # 0.49.0 → 0.50.0   (تحديث فيه جديد)
    python3 tools/bump.py --patch    # 0.49.0 → 0.49.1   (تصليح بس)
    python3 tools/bump.py --major    # 0.49.0 → 1.0.0
    python3 tools/bump.py --set 1.2.3

📌 وفيه فحص في audit.py **بيفشل** لو الرقمين اختلفوا — عشان لو حد عدّل
بإيده ونسي التاني، نعرف قبل ما نرفع مش بعده.
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGETS = [
    (ROOT / 'js' / 'app-info.js', r"(APP_VERSION = ')([^']+)(')"),
    (ROOT / 'sw.js', r"(SW_VERSION = ')([^']+)(')"),
]


def read_all():
    found = {}
    for path, pattern in TARGETS:
        m = re.search(pattern, path.read_text(encoding='utf-8'))
        if not m:
            sys.exit(f'❌ مالقيتش رقم الإصدار في {path.name}')
        found[path.name] = m.group(2)
    return found


def read_current():
    """
    بترجّع الرقم الحالي، وبتقع لو الملفين مختلفين — ده عطل مش تفصيلة.

    ⚠️ بس `--set` **مابتنادهاش**، وده مقصود: الاختلاف هو بالظبط الحالة
    اللي `--set` موجودة عشانها. أول نسخة كانت بتنادي الدالة دي في كل
    الحالات، فالأداة كانت **بترفض تصلّح المشكلة اللي هي مخصوصة لها**.
    """
    found = read_all()
    versions = set(found.values())
    if len(versions) != 1:
        sys.exit(
            f'❌ الرقمين مختلفين خلاص: {found}\n'
            f'   ظبّطهم بـ: python3 tools/bump.py --set {max(found.values())}'
        )
    return versions.pop()


def bump(version, part):
    nums = version.split('.')
    if len(nums) != 3 or not all(n.isdigit() for n in nums):
        sys.exit(f'❌ شكل الرقم مش مفهوم: {version} (المتوقع 1.2.3)')
    major, minor, patch = (int(n) for n in nums)
    if part == 'major':
        return f'{major + 1}.0.0'
    if part == 'patch':
        return f'{major}.{minor}.{patch + 1}'
    return f'{major}.{minor + 1}.0'


def write(version):
    for path, pattern in TARGETS:
        text = path.read_text(encoding='utf-8')
        text, n = re.subn(pattern, lambda m: m.group(1) + version + m.group(3), text, count=1)
        if n != 1:
            sys.exit(f'❌ الكتابة فشلت في {path.name}')
        path.write_text(text, encoding='utf-8')


def main():
    args = sys.argv[1:]

    if '--set' in args:
        try:
            new = args[args.index('--set') + 1].lstrip('v')
        except IndexError:
            sys.exit('❌ --set عايزة رقم بعدها، مثال: --set 1.0.0')
        if not re.fullmatch(r'\d+\.\d+\.\d+', new):
            sys.exit(f'❌ شكل الرقم مش مفهوم: {new} (المتوقع 1.2.3)')
        before = '/'.join(sorted(set(read_all().values())))
        write(new)
        print(f'v{before} → v{new}   (js/app-info.js + sw.js)')
        return

    current = read_current()
    if '--major' in args:
        new = bump(current, 'major')
    elif '--patch' in args:
        new = bump(current, 'patch')
    else:
        new = bump(current, 'minor')

    write(new)
    print(f'v{current} → v{new}   (js/app-info.js + sw.js)')


if __name__ == '__main__':
    main()
