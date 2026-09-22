# نظام التزويد — قواعد الشغل

> الملف ده بيتقرا **لوحده** أول ما أي جلسة جديدة تفتح. كل اللي فيه بيفضل
> شغّال حتى لو الشات اتقفل أو طوّل.

---

## ⭐ قواعد صاحب المشروع (دي الأعلى — لو اتعارضت مع أي حاجة تحت، دي اللي تكسب)

القواعد دي اتقالت بالنص على مدار الشغل، ومكتوبة هنا عشان ماتضيعش.

### قبل أي تعديل

- **متعملش أي ملف جديد في المستودع من غير إذن صريح.** حصلت غلطة زي دي
  قبل كده (`check.html`) واتوقفت. لو محتاج ملف جديد، اقترحه واستنى الموافقة.
- **⚠️⚠️ متلمسش أي حاجة في الملصق من غير موافقة.** الملصق بيطبع أسعار
  حقيقية بتروح للزباين. أي تعديل فيه — ولو سطر — بيتعرض الأول.
- **لما يسأل سؤال، جاوب.** السؤال مش طلب تعديل كود. ولما يقول «قولي رأيك
  الأول» يبقى رأي مكتوب، مش تنفيذ.
- **اعرض رأيك بوضوح** لما تكون شايف إن فيه طريقة أحسن — بس نفّذ قراره هو.

### وقت التعديل

- **⚠️ خلي بالك وانت بتصلّح حاجة ماتعملش مشكلة أو تبوّظ حاجة تانية.**
  قبل أي تعديل، دوّر على كل اللي بينده على الكود اللي بتغيّره.
- **⚠️ سرعة النظام خط أحمر.** أي إضافة لازم تتقاس تكلفتها على السرعة.
  النداءات على `127.0.0.1` رخيصة، والقراءات من السحابة لأ.
- **⚠️ الفراغ من ناحية الجنب في الملصق مايقلّش أبدًا** — الملصق ممكن
  ينحرف في الماكينة والكلام يختفي في الحافة.
- **مايتشالش**: اسم الصنف (جاي من الفاتورة) ولا رقم الباركود المطبوع
  (بديل الماسح لو ماقراش).
- **أي تجربة جديدة ورا مفتاح، مقفول افتراضيًا.**
- **خد بالك من ترتيب الشاشة الرئيسية للبرنامج المساعد** لما تضيف أي حاجة.

### إزاي تتكلم معاه

- **بالعامية المصرية**، وبسّط الشرح.
- **⚠️ افصل الإنجليزي عن العربي.** أي رابط أو أمر أو اسم ملف يتحط في
  سطر لوحده أو في كتلة كود — الخلط بيقلب القراءة.
- **هو بيشتغل من التليفون في أغلب الوقت.** أي حاجة بتشتغل على الكمبيوتر
  لازم تتأكد إنها بتشتغل من التليفون كمان.

### بعد ما تخلّص

- **⚠️ انت اللي بتدمج الـPR** — هو مش بيعمل خطوة الدمج.
- **قوله «اعمل ريفريش وجرب»** ومعاها **بالظبط** يجرّب إيه.
- **⚠️⚠️ أثبت إن المشكلة اتحلّت بالقياس، مش بالكلام.** قال بالنص:
  «انا عاوزك تتاكد ان المشكلة اتحلت مش مجرد كلام وقعدين تقولي بعتذر
  تشخيصي كان خطأ». يعني: شغّل الكود، قيس قبل وبعد، واعرض الأرقام.
  ولو ضفت فحص، جرّبه **معكوس** واتأكد إنه بيفشل بالاسم.

---

## Project overview

**إيه ده**: نظام تزويد وجرد لمحل طرح وإيشاربات في الغربية. بيتابع الكميات
في الفرع والمخزن الرئيسي، بيطلب التزويد، وبيطبع ملصقات وأوراق تزويد على
طابعة حرارية.

**الرابط**: `https://abdallah-abolilah.github.io/tazweed-system/`

**الستاك**:
- HTML و CSS و JavaScript عادي **بالكامل** — مافيش إطار عمل، مافيش أداة
  بناء، ومافيش `import`/`export`. سكربتات عادية في مساحة واحدة مشتركة.
- Firebase (نسخة compat 10.12.0): Auth و Firestore و Messaging.
- Cloud Functions — Node 22، منطقة `europe-west1`.
- برنامج مساعد بلغة Go بيشتغل على ويندوز (مجلد `helper/`).

**المجلدات الرئيسية**:
- `js/` — كل منطق الواجهة (20 ملف، الشرح في `.claude/project-map.md`)
- `helper/` — البرنامج المساعد (Go)، وفيه صفحاته وتصاميمه محفورة جواه
- `functions/` — دوال السحابة (الإشعارات)
- `tests/` — أكتر من 100 ملف فحص بيشتغلوا على متصفح حقيقي
- `firestore.rules` — قواعد الأمان

**التشغيل محليًا**:

```
python3 -m http.server 8899
```

وبعدين افتح:

```
http://localhost:8899/index.html
```

**الفحوص**:

```
for f in tests/*-test.js; do node "$f"; done
```

**النشر**: الدفع على `main` بيرفع لوحده — GitHub Pages للواجهة، وGitHub
Actions بيرفع `firestore.rules` والفهارس والدوال.
⚠️ خطوة الدوال عليها `continue-on-error`، فالرن الأخضر **مش** دليل إن
الدالة اترفعت — لازم تبص على الخطوة نفسها.

---

# Part 1 — Working Rules (for any AI chat or coding agent)

## Communication
- Reply in Egyptian Arabic. Keep explanations short; prefer implementing directly.
- When the user says "كمل" or "كمل تكويد", continue from where you stopped without repeating.
- When the user sends a screenshot of a problem, explain the root cause in one or two lines before fixing.

## Before coding
- For any feature bigger than a small fix, present a short plan first: data structure (collections/fields), files to change, and risks. Wait for approval.
- Read the existing code and follow its patterns, naming, and file structure before adding anything.
- Before writing a new function, search for an existing one that does the same job and reuse it.

## While coding
- Fix the root cause, never patch symptoms. If a fix needs a structural change, say so instead of hacking around it.
- Only change what the task needs. Don't rewrite or reformat unrelated code.
- Keep files small and focused (split files that grow past ~400 lines).
- Separate layers: data access (database/API calls) in one place, business logic in another, UI rendering in another.
- Every database query has a limit; don't read documents one by one inside loops.
- Handle errors on every network call with a clear message to the user.
- Never put private API keys or tokens in frontend code.

## Context management
- One feature per session. If the conversation gets long, summarize the current state and suggest starting a new session.
- Keep the project structure and decisions written in `CLAUDE.md` / `.claude/project-map.md`, not only in chat.

## Definition of done
A feature is finished only after:
1. It works as requested.
2. `security-check` has run and high-severity issues are fixed.
3. `architecture-check` has run and high-severity issues are fixed.
4. `.claude/project-map.md` is updated if the feature added collections, roles, pages, or external APIs.

---

## ⚠️ استثناءات معتمدة على Part 1 (اتراجعت واتقبلت عن قصد)

القواعد دي فوق عامة لأي مشروع، ومشروعنا اتبنى على قرارات مختلفة **عن
قصد**. الاستثناءات دي مكتوبة هنا عشان ماتترفعش كملاحظة كل مرة — التفاصيل
والأسباب في `.claude/project-map.md` تحت "Accepted risks".

- **«قسّم أي ملف فوق 400 سطر»** — `js/app.js` (~6900) و`js/print-core.js`
  (~6600). التقسيم دلوقتي معناه إعادة هيكلة نظام شغّال بيطبع أسعار
  حقيقية. **مش هيتعمل من غير طلب صريح.**
- **«افصل الطبقات»** — النظام مبني من غير مديولز ومن غير أداة بناء عن
  قصد، عشان يشتغل من GitHub Pages مباشرة من غير أي تنصيب.
- **«كل استعلام عليه حد»** — المجموعات اللي بتكبر (السجل، حركة المخزون،
  الأصناف) عليها حدود فعلًا. الباقي مجموعات صغيرة بطبيعتها (حسابات،
  فئات، درجات فئة واحدة).
