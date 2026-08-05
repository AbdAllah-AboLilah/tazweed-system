import re, os, json, collections

FILES = ['js/app-info.js','js/local-store.js','js/permissions.js','js/qz-signing.js',
         'js/barcode-scan.js','js/import-export.js','js/products.js','js/print-screen.js',
         'js/user-admin.js','js/dashboard.js','js/app.js','js/update-prompt.js','firebase-config.js']

def strip_comments_strings(src):
    out=[]; i=0; n=len(src)
    while i<n:
        c=src[i]
        if c=='/' and i+1<n and src[i+1]=='/':
            j=src.find('\n',i); i = n if j<0 else j
        elif c=='/' and i+1<n and src[i+1]=='*':
            j=src.find('*/',i+2); i = n if j<0 else j+2
        elif c in '"\'`':
            q=c; i+=1
            while i<n:
                if src[i]=='\\': i+=2; continue
                if src[i]==q: i+=1; break
                if q=='`' and src[i]=='$' and i+1<n and src[i+1]=='{':
                    depth=1; i+=2
                    inner=[]
                    while i<n and depth:
                        if src[i]=='{': depth+=1
                        elif src[i]=='}': depth-=1
                        if depth: inner.append(src[i])
                        i+=1
                    out.append(' '+''.join(inner)+' ')
                    continue
                i+=1
            out.append(' "" ')
        else:
            out.append(c); i+=1
    return ''.join(out)

decls={}      # name -> [files]
bodies={}
for f in FILES:
    src=open(f,encoding='utf-8').read()
    code=strip_comments_strings(src)
    bodies[f]=code
    for m in re.finditer(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', code, re.M):
        decls.setdefault(m.group(1),[]).append(f)
    for m in re.finditer(r'^(?:const|let|var)\s+([A-Za-z_$][\w$]*)', code, re.M):
        decls.setdefault(m.group(1),[]).append(f)

print('=== 1) أسماء متكررة في أكتر من ملف (خطر تصادم) ===')
dupes={k:v for k,v in decls.items() if len(set(v))>1}
print(json.dumps(dupes, ensure_ascii=False, indent=1) if dupes else 'مفيش ✅')

allcode=' '.join(bodies.values())
# النقطة قبل الاسم معناها إنه خاصية (obj.name) مش استخدام للمتغيّر — بس
# عامل الفرد (...name) بيبدأ بنقط كمان، فكان بيتحسب "مش مستخدم" وهو
# مستخدم. بنشيل النقط بتاعة الفرد قبل العدّ.
usecode=allcode.replace('...',' ')
print('\n=== 2) معرّفة ومش مستخدمة خالص (كود ميت) ===')
dead=[]
for name, fs in decls.items():
    uses=len(re.findall(r'(?<![\w$.])'+re.escape(name)+r'(?![\w$])', usecode))
    if uses<=len(fs):
        dead.append((name, fs[0]))
html=open('index.html',encoding='utf-8').read()
dead=[(n,f) for n,f in dead if n not in html]
print('\n'.join(f'  {n}  ({f})' for n,f in sorted(dead)) if dead else 'مفيش ✅')

print('\n=== 3) ملفات في sw.js مش موجودة على القرص ===')
sw=open('sw.js',encoding='utf-8').read()
shell=re.findall(r"'\./([^']+)'", sw)
missing=[p for p in shell if p and not os.path.exists(p)]
print(missing or 'مفيش ✅')

print('\n=== 4) ملفات js موجودة ومش متحمّلة في index.html ===')
onpage=set(re.findall(r'src="\./(js/[^"]+)"', html))
ondisk=set()
for root,_,fs in os.walk('js'):
    for f in fs:
        if f.endswith('.js'): ondisk.add(os.path.join(root,f).replace('\\','/'))
print(sorted(ondisk-onpage) or 'مفيش ✅')

print('\n=== 5) ملفات js متحمّلة ومش في قايمة الحفظ بتاعة sw.js ===')
print(sorted(onpage - set(shell)) or 'مفيش ✅')

print('\n=== 6) حقول state معرّفة ومش مستخدمة ===')
app=bodies['js/app.js']
m=re.search(r'const state = \{(.*?)\n\};', app, re.S)
fields=re.findall(r'^\s{2}([A-Za-z_$][\w$]*):', m.group(1), re.M) if m else []
unused=[f for f in fields if len(re.findall(r'state\.'+re.escape(f)+r'(?![\w$])', allcode))<=1]
print(unused or 'مفيش ✅')

print('\n=== 7) نسخة النظام في كل مكان ===')
print(' app-info:', re.search(r"APP_VERSION = '([^']+)'", open('js/app-info.js',encoding='utf-8').read()).group(1))
print(' sw      :', re.search(r"SW_VERSION = '([^']+)'", sw).group(1))
