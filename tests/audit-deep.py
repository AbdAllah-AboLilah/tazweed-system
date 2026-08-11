import re, os
# ⚠️ نفس درس audit.py: القايمة المكتوبة بالإيد بتبوظ أول ما ملف يتقسم.
# لما اتقسم app.js، الفحص قال إن مكتبة الباركود "مش مستخدمة" — وهي
# مستخدمة، بس في ملف مش في القايمة. بتتقرا من index.html دلوقتي.
def _loaded_files():
    html = open('index.html', encoding='utf-8').read()
    found = re.findall(r'<script src="\./((?:js/)?[^"]+\.js)"', html)
    # مكتبات الطرف التالت (js/vendor) بتتفحص كاستخدام مش كمصدر
    return [f for f in found if os.path.exists(f) and '/vendor/' not in f]

FILES = _loaded_files()
assert len(FILES) >= 10, f'قرايت {len(FILES)} ملف بس من index.html — فيه حاجة غلط'
raw={f:open(f,encoding='utf-8').read() for f in FILES}
allraw=' '.join(raw.values())

print('=== 11) مجموعات Firestore المستخدمة ضد ملف القواعد ===')
cols=sorted(set(re.findall(r"collection\('([^']+)'\)", allraw)) | set(re.findall(r"collectionGroup\('([^']+)'\)", allraw)))
rules=open('firestore.rules',encoding='utf-8').read()
for c in cols:
    ok = ('/'+c+'/{') in rules or ('/'+c+'/') in rules
    print(f'  {c:15} {"✅" if ok else "❌ مش في القواعد"}')

print('\n=== 12) كلاسات الواجهة (بدون كلاسات الملصق/الورقة) ===')
css=set(re.findall(r'\.([a-zA-Z][\w-]*)', open('styles.css',encoding='utf-8').read()))
# كلاسات معرّفة جوه <style> بتاعة مستندات الطباعة
printcss=set()
for m in re.finditer(r'<style>(.*?)</style>', allraw, re.S):
    printcss |= set(re.findall(r'\.([a-zA-Z][\w-]*)', m.group(1)))
used=set()
for m in re.finditer(r'class="([^"]*)"', allraw):
    for c in m.group(1).split():
        if re.fullmatch(r'[a-z][a-z0-9-]*', c): used.add(c)
# كلاسات بتتستخدم كمقبض في JS بس (querySelector) — مش محتاجة تنسيق
handles=set(re.findall(r"querySelectorAll\('\.([\w-]+)'\)", allraw))
undef=sorted(c for c in used if c not in css and c not in printcss and c not in handles)
print('\n'.join('  '+c for c in undef) if undef else 'مفيش ✅')

print('\n=== 13) خصائص data-* بتتولّد ومفيش حد بيمسكها ===')
emitted=set(re.findall(r'\bdata-([a-z0-9-]+)="', allraw))
listened=set(re.findall(r"\[data-([a-z0-9-]+)[\]=]", allraw))
listened |= set(re.findall(r"getAttribute\('data-([a-z0-9-]+)'\)", allraw))
def camel(s):
    p=s.split('-'); return p[0]+''.join(x.capitalize() for x in p[1:])
listened |= {d for d in emitted if re.search(r'dataset\.'+camel(d)+r'\b', allraw)}
orphan=sorted(e for e in emitted if e not in listened and e not in ('draft','keep-scroll'))
print('\n'.join('  data-'+o for o in orphan) if orphan else 'مفيش ✅')

print('\n=== 14) معرّفات id بتتولّد ومفيش حد بيجيبها ===')
ids=set(re.findall(r'\bid="([a-z][\w-]*)"', allraw))
fetched=set(re.findall(r"getElementById\('([\w-]+)'\)", allraw)) | set(re.findall(r"querySelector\('#([\w-]+)'\)", allraw))
html=open('index.html',encoding='utf-8').read()
fetched |= set(re.findall(r"getElementById\('([\w-]+)'\)", html))
orphan_ids=sorted(i for i in ids if i not in fetched)
print('\n'.join('  #'+i for i in orphan_ids) if orphan_ids else 'مفيش ✅')

print('\n=== 15) رتب الحسابات: معرّفة ضد مستخدمة ===')
perm=raw['js/permissions.js']
roles=set(re.findall(r"'([a-z_]+)'", re.search(r'ROLE_LABELS_AR\s*=\s*\{(.*?)\}', perm, re.S).group(1)))
used_roles=set(re.findall(r"role\(\)\s*==\s*'([a-z_]+)'", rules)) | set(re.findall(r"role === '([a-z_]+)'", allraw))
print('  في النظام :', sorted(roles))
print('  في القواعد:', sorted(used_roles))
missing=[r for r in roles if r not in used_roles and r != 'none']
print('  رتب مالهاش أي ذكر في القواعد:', missing or 'مفيش ✅')

print('\n=== 16) مكتبات بتتحمّل ومش مستخدمة ===')
libs={'XLSX':'xlsx','QRCode':'qrcodejs','qrcode':'qrcode-generator','KJUR':'jsrsasign','qz':'qz-tray'}
for sym,name in libs.items():
    n=len(re.findall(r'(?<![\w$.])'+sym+r'(?![\w$])', allraw))
    print(f'  {name:18} {sym:8} استخدامات: {n} {"❌ مش مستخدمة" if n==0 else "✅"}')
