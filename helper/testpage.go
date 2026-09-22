package main

// ============================================================
// 🧪 صفحة تجربة جوّه البرنامج
// ============================================================
// ⚠️⚠️ ليه دي موجودة: مافيش طريقة تتجرّب بيها الطباعة الحقيقية من غير
// ماكينة. الصفحة دي بتخلي صاحب المحل يتأكد إن السلسلة كلها شغّالة
// (المتصفح ← البرنامج ← الويندوز RAW ← الطابعة) **من غير ما نلمس
// النظام ولا سطر**.
//
// لو الورقة طلعت من هنا، الباقي مجرد توصيل. ولو ماطلعتش، نبقى عرفنا
// المشكلة قبل ما نغيّر أي حاجة في النظام.
//
// ⚠️ الورقة التجريبية **طويلة عن قصد** وعليها علامات كل سنتيمتر:
// العطل الأصلي كان بيبان في الورقة الطويلة بس (بتتقص أو بتصغّر)،
// وورقة قصيرة مش هتثبت حاجة. تقيسها بالمسطرة وتقارن بالرقم المكتوب.

const testPage = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<title>تجربة مساعد التزويد</title>
<style>
 :root{--ink:#1c2024;--line:#d9dce1;--bg:#f4f5f7;--card:#fff;--sage:#2f6b46;--warn:#b02020;--mut:#6b7280}
 *{box-sizing:border-box}
 body{font-family:system-ui,Segoe UI,Tahoma,sans-serif;background:var(--bg);margin:0;padding:16px;color:var(--ink)}
 .wrap{max-width:620px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
 .card{background:var(--card);border-radius:12px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.07)}
 h1{font-size:20px;margin:0}
 .sub{color:var(--mut);font-size:13px}
 .sec-title{font-size:14px;font-weight:600;margin:0 0 3px}
 .sec-sub{color:var(--mut);font-size:12px;line-height:1.7;margin-bottom:12px}
 .row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
 label{display:block;font-size:12px;margin-bottom:5px;color:var(--mut);font-weight:400}
 input,select{width:100%;padding:8px;border:1px solid var(--line);border-radius:7px;font-size:14px;font-family:inherit;background:var(--card);color:var(--ink)}
 button{padding:10px 14px;border:0;border-radius:8px;background:var(--sage);color:#fff;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit}
 button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
 button:disabled{opacity:.5;cursor:default}
 .chk{display:flex;gap:9px;align-items:flex-start;font-size:13px;cursor:pointer;padding:7px 0;margin:0;color:var(--ink)}
 .chk input{width:auto;margin:2px 0 0}
 .chk small{display:block;color:var(--mut);font-size:11.5px;line-height:1.6;margin-top:2px}
 .pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;padding:3px 10px;border-radius:999px;background:#eaf3ee;color:var(--sage);font-weight:600}
 .pill.grey{background:#eef0f2;color:var(--mut)}
 .hr{border:0;border-top:1px solid var(--line);margin:13px 0}
 .note{font-size:11.5px;color:var(--mut);line-height:1.7;background:#f7f8f9;padding:9px 11px;border-radius:8px}
 .big{display:block;width:100%;text-align:center;padding:12px;border:1px solid var(--line);border-radius:9px;
      text-decoration:none;color:var(--ink);font-size:14px;font-weight:600;background:#fbfcfc;margin-top:12px}
 .box{background:#fff8e6;border:1px solid #f0d8a0;border-radius:9px;padding:11px}
 #out,#uout{margin-top:10px;font-size:13px;line-height:1.8;white-space:pre-wrap}
 .ok{color:var(--sage)} .bad{color:var(--warn)}
 /* 📶 شريط تقدّم الرفع — الشرح عند uploadProgress في productsfile.go */
 .bar{height:9px;border-radius:999px;background:#e9ecef;overflow:hidden;margin-top:8px}
 .bar i{display:block;height:100%;background:var(--sage);border-radius:999px;transition:width .25s}
 /* 🗂 التابات — الشرح عند شريط التابات تحت */
 .tabs{display:flex;gap:5px;overflow-x:auto;padding:5px;background:var(--card);border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.07)}
 .tabs button{flex:1 0 auto;background:transparent;color:var(--mut);font-weight:600;padding:10px 12px;white-space:nowrap;border-radius:9px;font-size:13.5px}
 .tabs button[aria-selected="true"]{background:var(--sage);color:#fff}
 /* ⚠️ العرض block مش flex: كل الكروت بتتعرض block أصلًا، والكارت
    الوحيد اللي بيستخدم flex (الترويسة وزرار الحفظ) مالوش تاب. */
 [data-tab]{display:none}
 [data-tab].on{display:block}
 /* 🧾 صفوف السجلات */
 .lrow{display:flex;gap:9px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px;flex-wrap:wrap}
 .lrow:last-child{border-bottom:0}
 .lrow .t{flex:1;min-width:150px;line-height:1.7}
 .lrow .w{color:var(--mut);font-size:11.5px}
 .lrow button{padding:6px 11px;font-size:12.5px}
 .empty{color:var(--mut);font-size:12.5px;padding:10px 0}
 code.fp{font-family:ui-monospace,Consolas,monospace;background:#eef0f2;padding:1px 6px;border-radius:5px;font-size:12px;letter-spacing:.5px}
</style>

<!-- ============================================================
     ⚠️⚠️ الترتيب ده مقصود — اتبلّغ بالنص
     ============================================================
     "عاوزك بردوا تظبط اماكن كل حاجه في الشاشة الرئيسية ل البرنامج
      المساعد لان حاسس في لغبطه او عدم ترتيب"

     وكان معاه حق: الصفحة كانت **كتلة واحدة** فيها الطابعات ومقاسات
     الملصق واسم الجهاز والتشغيل مع الويندوز والتجربة والتحديث ورا
     بعض من غير أي فاصل، وزرار الحفظ **في النص** — فاللي تحته مالوش
     علاقة بيه وهو مش باين كده.

     دلوقتي كل قسم حاجة واحدة، والحفظ في الآخر ثابت وانت بتنزّل.

     ⚠️ ولا id واحد اتغيّر: نفس الخانات ونفس الأزرار، فكل المنطق
     تحت شغّال زي ما هو بالحرف. اللي اتغيّر الترتيب والشكل بس. -->
<div class="wrap">

 <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
  <div>
   <!-- ⚠️ كان مكتوب هنا 127374 وده رمز **فصيلة الدم AB** (🆎) —
        غلطة رقم. رمز الطابعة هو 128424. اتصلّحت لما اتسأل عنها
        بالنص: "ممكن تقولي الملصق اللي جنب جملة المساعد اللي هو AB
        بيدل علي ايه". -->
   <h1>&#128424;&#65039; مساعد التزويد</h1>
   <div class="sub">شغّال على الكمبيوتر ده — سيبه مفتوح والنظام هيلاقيه لوحده.</div>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap" id="pills">
   <span class="pill">&#9679; شغّال</span>
  </div>
 </div>

 <!-- ============================================================
      🗂 التابات
      ============================================================
      اتطلب بالنص: "يلا ابدا نفذ القايمه مع عمل التابات زي م اقترحت".

      ⚠️ السبب: الصفحة كانت شريط واحد طويل. ومع «الأوراق المحفوظة»
      و«سجل الطباعة» — واللي الاتنين بيكبروا مع كل طبعة — اللي
      تحتهم كان هيتدفن تحت قايمة بتطول كل يوم.

      ⚠️⚠️ واتفقنا على شرطين وهما مطبّقين بالحرف:
        ١) زرار «احفظ الإعدادات» **بره التابات** — بيفضل تحت في كل
           تاب، مهما بدّلت.
        ٢) الحاجات اللي بتتحفظ لوحدها (التشغيل مع الويندوز، يفتح
           النظام، مسار ملف الأصناف، الرفع التلقائي، تصاميم الأنواع)
           **فضلت بتتحفظ لوحدها** — ولا سطر اتغيّر فيها.

      ⚠️ ولا id واحد اتغيّر في أي خانة: كل المنطق تحت شغّال زي ما هو. -->
 <div class="tabs" role="tablist" id="tabs">
  <button role="tab" data-go="printer" aria-selected="true">&#128424; الطابعة</button>
  <button role="tab" data-go="label" aria-selected="false">&#127991; الملصق</button>
  <button role="tab" data-go="products" aria-selected="false">&#128230; الأصناف</button>
  <button role="tab" data-go="logs" aria-selected="false">&#129534; السجلات</button>
  <button role="tab" data-go="app" aria-selected="false">&#9881;&#65039; البرنامج</button>
 </div>

 <div class="card on" data-tab="printer">
  <div class="sec-title">&#128424; الطابعات والجهاز</div>
  <div class="sec-sub">أهم قسم — ده اللي بيخلي النظام يعرف يطبع على الكمبيوتر ده.</div>
  <div class="row">
   <div style="flex:1;min-width:200px"><label>طابعة الملصق</label><select id="l"></select></div>
   <div style="flex:1;min-width:200px"><label>طابعة ورقة التزويد</label><select id="p"></select></div>
  </div>
  <div class="row" style="margin-top:11px">
   <div style="flex:1"><label>اسم الجهاز (زي ما هيظهر في النظام)</label>
    <input id="devname" type="text" maxlength="40" placeholder="مثلاً: كمبيوتر الكاشير"></div>
  </div>
  <div class="note" style="margin-top:9px">الاسم بيمشي على كل المتصفحات اللي على الكمبيوتر ده — فالجهاز بيتحسب مرة واحدة في النظام بدل ما كل متصفح يبقى جهاز لوحده.</div>
 </div>

 <!-- ============================================================
      &#8987; الطابور الواقف — م٢
      ============================================================
      ⚠️⚠️ دي **مش** حالة الطابعة اللي تحت. حالة الطابعة بتسأل
      التعريف، والتعريف بتاع ماكينتك بيرد صفر دايمًا (مقاس على
      XP-235B: شغّالة / الرول برّه / الغطا مفتوح — كلهم صفر).

      الطابور حاجة تانية: ده عدّاد **الويندوز** للأوامر اللي لسه
      مامشيتش، وبيشتغل حتى لو التعريف أخرس. الطابعة مطفية أو
      الكابل مقطوع؟ الأمر بيقعد، والنظام قال "اتبعت ✅" — والرقم
      ده هو اللي بيقولك إنها واقفة.

      الشرح الكامل في queuewatch.go. -->
 <div class="card on" data-tab="printer">
  <div class="sec-title">&#8987; طابور الطباعة</div>
  <div class="sec-sub">الأوامر اللي راحت للويندوز ولسه مامشيتش. لو العدد واقف مكانه أكتر من دقيقة، فيه حاجة واقفة.</div>
  <div class="row">
   <button class="ghost" id="qgo">&#8987; شوف الطابور</button>
   <label class="chk" style="padding:0;align-items:center"><input type="checkbox" id="qauto" checked>
    <span style="font-size:12.5px">وشوفه لوحده كل نص دقيقة</span></label>
  </div>
  <div id="qout" style="font-size:13px;line-height:1.8;margin-top:9px;min-height:18px"></div>
  <!-- ⚠️ الفحص التلقائي بيشتغل **وانت فاتح التاب ده بس** ويقف أول
       ما تسيبه: البرنامج مافيهوش شغل في الخلفية، ومانفتحش واحد
       من الباب الخلفي. -->
  <div class="note" style="margin-top:8px">
   ⚠️ العدد بيتقرا من الويندوز مش من الماكينة. يعني لو الطابعة مطفية
   أو الكابل مقطوع، الأمر هيفضل واقف هنا — وده بالظبط اللي عايزين نشوفه.</div>
 </div>

 <div class="card" data-tab="label">
  <div class="sec-title">&#127991; الملصق</div>
  <div class="sec-sub">شكل الملصق: أنهي تصميم لأنهي نوع، والمصمّم نفسه.</div>

  <div class="box">
   <div style="font-size:13px;font-weight:600;margin-bottom:3px">&#127912; التصاميم</div>
   <div style="font-size:11.5px;color:var(--mut);line-height:1.7;margin-bottom:10px">
    اختار كل نوع ملصق يطبع بأنهي تصميم. تعمل التصاميم وتعدّلها من المصمّم تحت.</div>
   <div class="row">
    <div style="flex:1;min-width:175px"><label>الملصق العادي</label><select id="rd-normal"></select></div>
    <div style="flex:1;min-width:175px"><label>مقسوم ٤</label><select id="rd-quarter"></select></div>
   </div>
   <div class="row" style="margin-top:9px">
    <div style="flex:1;min-width:175px"><label>لما يكون من غير سعر</label><select id="rd-noPrice"></select></div>
    <div style="flex:1;min-width:175px"></div>
   </div>
   <div id="rd-status" style="font-size:12px;margin-top:8px;min-height:16px"></div>
   <!-- ⚠️⚠️ الشرح ده مش زوّاقة: السؤال اتسأل بالنص ("هل لما اطبع من
        غير سعر هيتم تنفيذ التصميم من غير السعر ولا ده هيحتاج نعمله
        تصميم معين")، فالإجابة لازم تبقى مكتوبة **جنب الخانة** مش في
        رسالة اتبعتت مرة. -->
   <div class="note" style="margin-top:10px;background:#fffdf7">
    &#9888; <b>«من غير سعر»</b>: لو سايبها على <b>تلقائي</b>، النظام بيستخدم الملصق العادي
    والسعر بيختفي — والباقي مكانه زي ما هو. لو عايز الاسم يكبر وياخد مساحة السعر،
    اعمل تصميم تاني من المصمّم واختاره هنا.</div>
  </div>

  <a class="big" href="/designer">&#127912; افتح مصمّم الملصق &mdash; حرّك أي حاجة بالمليمتر</a>
 </div>


 <div class="card on" data-tab="printer">
  <div class="sec-title">&#129514; جرّب قبل ما تعتمد</div>
  <div class="sec-sub">بيطبعوا على الطابعة على طول — من غير نافذة طباعة.</div>
  <div class="row">
   <button class="ghost" id="lgo">&#127991; اطبع ملصق تجربة (لاصقة واحدة)</button>
   <button class="ghost" id="go">&#128220; اطبع ورقة تجربة</button>
   <div style="width:130px"><label>طول الورقة (مم)</label>
    <input id="mm" type="number" value="250" min="20" max="1000"></div>
  </div>
  <div id="out"></div>

  <!-- ============================================================
       🩺 اسأل الطابعة
       ============================================================
       ⚠️⚠️ ده **تشخيص** مش ميزة جاهزة. اللي بيرجع جاي من تعريف
       الطابعة، وتعريفات الطابعات الحرارية الرخيصة كتير منها بيرجّع
       صفر دايمًا — يعني "مافيش مشكلة" حتى والرول خلص.

       فقبل ما نبني عليه أي تصرّف، المستخدم بيجرّبه على ماكينته
       **والرول خارج والغطا مفتوح** ويقولنا بيرجّع إيه. الرقم الخام
       ظاهر عن قصد: هو اللي بيفرّق بين "بلّغ إن كله تمام" و"مابلّغش
       حاجة أصلًا". -->
  <hr class="hr">
  <div style="font-size:12.5px;font-weight:600;margin-bottom:4px">&#129658; حالة الطابعة (تشخيص)</div>
  <div class="note" style="margin-bottom:8px">
   دوس الزرار وهو <b>شغّال عادي</b>، وبعدين <b>اطلع الرول</b> ودوس تاني،
   وبعدين <b>افتح الغطا</b> ودوس تاني — وقولنا الرقم اتغيّر ولا لأ.
   لو الرقم فضل زي ما هو في التلاتة، يبقى ماكينتك مابتبلّغش والمفتاح تحت
   مش هينفع معاها.</div>
  <div class="row">
   <button class="ghost" id="pstat">&#129658; اسأل الطابعة</button>
  </div>
  <div id="pstat-out" style="font-size:13px;line-height:1.8;margin-top:8px;min-height:18px"></div>
  <!-- ⚠️⚠️ النتيجة اللي اتقاست على ماكينة حقيقية: XP-235B مشتركة
       على الشبكة رجّعت **صفر** في التلات حالات (شغّالة / الرول برّه /
       الغطا مفتوح). يعني المفتاح ده عليها بيفضل مفتوح ومايوقفش حاجة.
       فالنص بيقول الشرط صراحةً بدل ما يبان كأنه حماية جاهزة. -->
  <div class="note" style="margin-top:8px">
   ⚠️ المفتاح ده بيشتغل <b>بس</b> لو التشخيص فوق رجّع رقم
   <b>بيتغيّر</b> لما تشيل الرول. لو فضل صفر في التلات حالات، افتحه أو
   اقفله — <b>مش هيفرق</b>، الطبعة مش هتتوقف أبدًا.
  </div>
  <label class="chk" style="margin-top:8px"><input type="checkbox" id="stopbad">
   <span>اوقف الطبعة لو الطابعة مبلّغة مشكلة
    <small>&#9888; متفتحهاش غير لما تتأكد من التشخيص فوق. لو التعريف بيبلّغ غلط، الطباعة هتقف وانت مش عارف ليه.</small></span></label>
 </div>

 <!-- ⚠️ المعايرة بقت في تاب «الطابعة» مش «الملصق»: دي بتظبّط
      **الماكينة** (الفاصل بين اللاصقات، اتجاه السحب، قطبية النقط)
      مش شكل الملصق. اللي بيدوّر عليها بيدوّر وهو بيعاير ماكينة
      جديدة، مش وهو بيغيّر تصميم. -->
 <div class="card on" data-tab="printer">
  <div class="sec-title">&#128207; معايرة الماكينة</div>
  <div class="sec-sub">تلات حاجات بتختلف من ماكينة لماكينة. متلمسهاش غير لو اللاصقة طلعت غلط.</div>
  <div class="row">
   <div style="flex:1;min-width:150px"><label>الفاصل بين اللاصقات (مم)</label>
    <input id="gap" type="number" step="0.5" min="0" max="20" value="2"></div>
   <div style="flex:1;min-width:150px"><label>اتجاه الملصق</label>
    <select id="dir"><option value="1">1</option><option value="0">0</option></select></div>
  </div>
  <label class="chk" style="margin-top:6px"><input type="checkbox" id="flip">
   <span>اقلب ألوان الملصق<small>افتحها بس لو اللاصقة طلعت سودا بالكامل.</small></span></label>
 </div>

 <!-- ============================================================
      &#128230; ملف الأصناف
      ============================================================
      اتطلب بالنص: "حط خانة في المساعد ... وانا اختار مكان الملف ولو
      عوزت اغيره اغيره عادي وكمان حط تحت شيك بوكس الرفع التلقائي".

      ⚠️ مكانه هنا مش فوق: الشاشة مرتّبة من فوق لتحت بالأهمية —
      الطابعات (اللي من غيرها مافيش حاجة تشتغل)، الملصق، التجربة،
      وبعدين اللي بيتظبّط مرة وينسى. وده بيتظبّط مرة واحدة. -->
 <div class="card" data-tab="products">
  <div class="sec-title">&#128230; ملف الأصناف</div>
  <div class="sec-sub">الملف اللي بيطلع من الـERP. البرنامج بيراقبه، والنظام بيقراه ويرفع الأصناف.</div>

  <div class="row">
   <button class="ghost" id="pf-pick" style="flex:1;min-width:190px">&#128449;&#65039; اختار الملف من الكمبيوتر</button>
  </div>
  <!-- ⚠️⚠️ الخانة دي مش بديل مكرّر للزرار: هي **اللي بتوريك المسار
       المحفوظ فعلًا**، وهي الطريقة الوحيدة لو البرنامج شغّال على
       جهاز مش ويندوز أو شاشة الاختيار ماردّتش. -->
  <div style="margin-top:10px"><label>أو الزق المسار هنا</label>
   <input id="pf-path" type="text" dir="ltr" placeholder="C:\Users\...\List.xlsx" style="font-size:13px"></div>
  <div class="row" style="margin-top:9px">
   <button class="ghost" id="pf-check">&#9989; تأكد من الملف</button>
  </div>
  <div id="pf-out" style="font-size:13px;line-height:1.9;margin-top:9px;min-height:18px"></div>

  <!-- ⚠️ الشريط مخفي لحد ما يبقى فيه رفع فعلًا: شريط فاضي واقف على
       الصفر بيخلي اللي بيبص يفتكر إن فيه حاجة واقفة. -->
  <div id="pf-prog" style="display:none;margin-top:10px">
   <div id="pf-prog-txt" style="font-size:12.5px;color:var(--mut)"></div>
   <div class="bar"><i id="pf-bar" style="width:0%"></i></div>
  </div>

  <!-- 🕒 آخر رفع — زي سطر "آخر تحديث" اللي في النظام بالظبط -->
  <div id="pf-last" style="font-size:12.5px;line-height:1.8;margin-top:9px;color:var(--mut)"></div>

  <label class="chk" style="margin-top:10px"><input type="checkbox" id="pf-auto">
   <span>ارفع لوحدك أول ما الملف يتغيّر
    <small>&#9888; الرفع بيستبدل قايمة الأصناف كلها باللي في الملف — اللي متشال من الملف بيتشال من النظام.</small></span></label>
  <div class="note" style="margin-top:9px">
   لو المفتاح ده <b>مقفول</b>، الملف لما يتغيّر مش هيترفع لوحده — هييجي لصاحب النظام
   إشعار على التليفون وتنبيه في شاشة الأصناف يسأله يرفع ولا لأ.</div>
 </div>

 <!-- ============================================================
      &#128196; الأوراق المحفوظة — م٤
      ============================================================
      اتطلب بالنص في خريطة التطوير: "حفظ ورقة التزويد على القرص —
      آخر كام ورقة تتحفظ على الجهاز وتتطبع تاني من غير النظام ومن
      غير نت".

      ⚠️⚠️ دي أهم حاجة في التاب ده: الورقة ضاعت أو اتقطعت أو
      الطابعة كانت مطفية — تدوس زرار وتخرج تاني، وانت **مش محتاج
      النظام ولا نت ولا حتى تفتح المتصفح على الموقع**. -->
 <div class="card" data-tab="logs">
  <div class="sec-title">&#128196; الأوراق المحفوظة</div>
  <div class="sec-sub">آخر أوراق تزويد اتطبعت من الكمبيوتر ده. اطبعها تاني من غير النظام ومن غير نت.</div>
  <div id="sheets"></div>
 </div>

 <!-- ============================================================
      &#129534; سجل الطباعة المحلي — م٥
      ============================================================
      ⚠️ النظام عنده سجل، بس هو في السحابة: عايز نت وحساب، وبيتكتب
      لما الطبعة **تتبعت** مش لما تخرج. ده بيتكتب على الجهاز، وبيسجّل
      اللي فشل كمان — وده اللي بيجاوب على "أنا دوست ومافيش ورقة طلعت". -->
 <div class="card" data-tab="logs">
  <div class="sec-title">&#129534; سجل الطباعة</div>
  <div class="sec-sub">كل اللي اتطبع من الكمبيوتر ده — والنت مقطوع كمان.</div>
  <div id="plog"></div>
  <div class="row" style="margin-top:12px">
   <button class="ghost" id="plog-clear">&#128465;&#65039; فضّي السجل والأوراق</button>
  </div>
 </div>

 <div class="card" data-tab="app">
  <div class="sec-title">&#9881;&#65039; البرنامج</div>
  <label class="chk"><input type="checkbox" id="auto">
   <span>يشتغل لوحده مع الويندوز<small>في الخلفية، من غير ما يفتح الصفحة دي.</small></span></label>
  <label class="chk"><input type="checkbox" id="opensys">
   <span>ويفتح نظام التزويد كمان
    <small>تفتح الكمبيوتر تلاقي النظام مفتوح ومستني. (محتاج المفتاح اللي فوق مفتوح.)</small></span></label>

  <!-- ============================================================
       📦 نقل الإعدادات
       ============================================================
       ⚠️ الهوية (معرّف الماكينة واسم الجهاز) **مابتتنقلش** — لو
       اتنقلت، الجهازين هيبقوا جهاز واحد في النظام. -->
  <div class="row" style="margin-top:12px">
   <a class="ghost" href="/settings/export" download
      style="padding:10px 14px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--ink);font-size:14px;font-weight:500">&#128229; احفظ الإعدادات في ملف</a>
   <button class="ghost" id="impbtn">&#128228; حمّل إعدادات من ملف</button>
   <input type="file" id="impfile" accept=".json,application/json" style="display:none">
  </div>
  <div class="note" style="margin-top:8px">ظبّط كمبيوتر واحد وانقل الملف للباقيين — التصاميم والمقاسات والمعايرة بتتنقل، واسم الجهاز وهويته بيفضلوا بتوع كل جهاز.</div>
  <div id="impout" style="font-size:13px;margin-top:8px;min-height:16px"></div>

  <div class="row" style="margin-top:12px">
   <button class="ghost" id="up">&#128260; شوف لو فيه تحديث</button>
  </div>
  <div id="uout"></div>
 </div>

 <!-- ⚠️⚠️ **مش** sticky. جرّبناها ثابتة تحت، والنتيجة إنها بتغطّي
      اللي تحتها وانت بتنزّل — وفي الصورة كانت مغطّية مفتاح "اوقف
      الطبعة لو الطابعة مبلّغة مشكلة" تمامًا. وشكوى الترتيب الأصلية
      كانت من حاجة زي دي بالظبط، فمايصحّش نحلها بحاجة تعملها تاني. -->
 <div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
  <button id="save" style="flex:1;min-width:180px">&#128190; احفظ الإعدادات</button>
  <div id="sout" style="font-size:12.5px"></div>
 </div>

</div>
<script>
// ============================================================
// 🗂 تبديل التابات
// ============================================================
// ⚠️ التاب المفتوح بيتحفظ في المتصفح: لو كنت بتعاير ماكينة وبتعمل
// ريفريش كل شوية، مايصحّش ترجع لأول تاب في كل مرة.
//
// ⚠️⚠️ والتاب اللي بيفتح افتراضيًا هو **الطابعة** زي ما اتفقنا —
// لو المحفوظ مش موجود (تاب اتشال في نسخة أحدث) بنرجعله.
const TABS=['printer','label','products','logs','app'];
function showTab(name){
  if(TABS.indexOf(name)<0) name='printer';
  document.querySelectorAll('[data-tab]').forEach(el=>{
    el.classList.toggle('on', el.getAttribute('data-tab')===name);
  });
  document.querySelectorAll('#tabs button').forEach(b=>{
    b.setAttribute('aria-selected', b.getAttribute('data-go')===name ? 'true':'false');
  });
  try{ localStorage.setItem('tz-helper-tab',name); }catch(e){}
  // ⚠️⚠️ كل تاب بيوقّف شغل التاب التاني: السؤال الدوري عن الطابور
  // وعن الرفع مايفضلش شغّال وانت مش شايفه. ده نفس مبدأ البرنامج
  // كله — مافيش شغل في الخلفية على الفاضي.
  if(name==='printer'){ qMaybeStart(); } else { qStop(); }
  if(name==='logs') loadPrintLog();
}
document.getElementById('tabs').addEventListener('click',(e)=>{
  const b=e.target.closest('button[data-go]'); if(!b) return;
  showTab(b.getAttribute('data-go'));
});
// ⚠️⚠️ فتح التاب المحفوظ **مش هنا** — هو في آخر السكربت خالص.
// السبب اتقاس في متصفح حقيقي: showTab بتنده على qMaybeStart
// وloadPrintLog، ودول بيلمسوا متغيّرات متعرّفة بـconst تحت. الدالة
// نفسها بترتفع لفوق (hoisting) لكن المتغيّر لأ — فالنداء من هنا
// كان بيطلّع 14 خطأ في الكونسول:
//   ReferenceError: Cannot access 'qOut' before initialization
// ونتيجته إن تاب «الطابعة» بيفتح **من غير ما يسأل عن الطابور**،
// وتاب «السجلات» بيفضل فاضي لحد ما تدوس عليه تاني.

const out=document.getElementById('out'),sel=document.getElementById('p'),go=document.getElementById('go');
const lsel=document.getElementById('l'),sout=document.getElementById('sout');
const say=(t,c)=>{out.textContent=t;out.className=c||''};
// ⚠️ الاختيار المحفوظ بيترجع من /status ويتحدّد في القايمة — من غير
// كده تفتح الصفحة وتلاقي أول طابعة مختارة وتفتكر إنها المحفوظة.
fetch('/status').then(r=>r.json()).then(s=>{
  const opts=(s.printers||[]).map(n=>'<option>'+n+'</option>').join('')||'<option value="">مالقيتش طابعات</option>';
  sel.innerHTML=opts; lsel.innerHTML=opts;
  if(s.restockPrinter) sel.value=s.restockPrinter;
  if(s.labelPrinter) lsel.value=s.labelPrinter;
  if(s.deviceName) document.getElementById('devname').value=s.deviceName;
  document.getElementById('auto').checked=!!s.autostart;
  document.getElementById('gap').value=(s.labelGapMm!==undefined?s.labelGapMm:2);
  document.getElementById('dir').value=String(s.labelDirection!==undefined?s.labelDirection:1);
  document.getElementById('flip').checked=!!s.labelFlip;
  document.getElementById('stopbad').checked=!!s.stopOnPrinterProblem;
  document.getElementById('opensys').checked=!!s.openSystemOnStart;
  // ⚠️ النسخة وعدد الطابعات فوق في الشريط مش في صندوق نتيجة الطباعة:
  // كانوا بيتكتبوا في #out، وأول ما تطبع تجربة بيتمسحوا — فالمعلومة
  // اللي المفروض تفضل قدامك كانت بتختفي.
  const pills=document.getElementById('pills');
  pills.innerHTML='<span class="pill">\u25cf شغّال</span>'
   +'<span class="pill grey">نسخة '+s.version+'</span>'
   +'<span class="pill grey">'+(s.printers||[]).length+' طابعة</span>';
}).catch(e=>say('مش قادر أقرا الحالة: '+e,'bad'));

// ============================================================
// 🎭 أنهي تصميم لأنهي نوع ملصق
// ============================================================
// اتطلب بالنص: "ممكن نعمل في البرنامج المساعد حقل ل المقسوم العادي
// اختار من التصاميم المتاحه ... وحقل تاني اختار التصميم ل مقسوم ٤".
//
// ⚠️ "تلقائي" خيار حقيقي مش فراغ: معناه إن البرنامج يتصرّف (شوف
// designForRole في design.go). واللي بيتنفّذ فعلًا مكتوب جنبه بين
// قوسين، عشان "تلقائي" ماتبقاش لغز.
const ROLES=['normal','quarter','noPrice'];
function loadRoles(){
  fetch('/design/all').then(r=>r.json()).then(j=>{
    const names=(j.designs||[]).map(x=>x.name);
    ROLES.forEach(role=>{
      const sel=document.getElementById('rd-'+role);
      if(!sel) return;
      const picked=(j.picked||{})[role]||'';
      const eff=(j.roles||{})[role]||'';
      sel.innerHTML='<option value="">تلقائي'+(eff?' ('+eff+')':'')+'</option>'
        +names.map(n=>'<option'+(n===picked?' selected':'')+'>'+n+'</option>').join('');
    });
  }).catch(()=>{});
}
ROLES.forEach(role=>{
  const sel=document.getElementById('rd-'+role);
  if(!sel) return;
  sel.onchange=async()=>{
    const st=document.getElementById('rd-status');
    st.textContent='بيحفظ...'; st.className='';
    try{
      const r=await (await fetch('/design/role',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({role:role,name:sel.value})})).json();
      st.textContent=r.ok?'\u2705 اتحفظ':'\u274c '+(r.error||'مش عارف');
      st.className=r.ok?'ok':'bad';
      // ⚠️ بنعيد التحميل بعد الحفظ: "تلقائي" بتتغيّر نتيجتها لما
      // نوع تاني يتغيّر (من غير سعر بيتبع العادي)، فالمكتوب بين
      // القوسين لازم يفضل صح.
      if(r.ok) loadRoles();
    }catch(e){ st.textContent='\u274c '+e; st.className='bad'; }
  };
});
loadRoles();

// ⚠️ التشغيل مع الويندوز بيتحفظ **لوحده** أول ما تعلّم عليه — مش
// مربوط بزرار الحفظ، عشان ماحدش يعلّم ويمشي ويفتكره اتحفظ.
document.getElementById('auto').onchange=async(e)=>{
  const on=e.target.checked;
  sout.textContent='...'; sout.className='';
  try{
    const r=await (await fetch('/autostart',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({on})})).json();
    if(r.ok){ sout.textContent = r.on ? '\u2705 هيشتغل لوحده مع الويندوز' : '\u2705 مش هيشتغل لوحده'; sout.className='ok'; }
    else { sout.textContent='\u274c '+(r.error||'مش عارف'); sout.className='bad'; e.target.checked=!on; }
  }catch(err){ sout.textContent='\u274c '+err; sout.className='bad'; e.target.checked=!on; }
};

// ⚠️ "يفتح النظام كمان" بيتحفظ **لوحده** زي "يشتغل مع الويندوز"
// بالظبط: الاتنين في نفس القسم، ولو واحد بيتحفظ لوحده والتاني
// مستني زرار الحفظ اللي في قسم تاني، المستخدم هيعلّم ويمشي ويفتكره
// اتحفظ. (ودي نفس الحجة اللي خلّت autostart يتحفظ لوحده من الأصل.)
document.getElementById('opensys').onchange=async(e)=>{
  const o=document.getElementById('sout');
  o.textContent='...'; o.className='';
  try{
    const r=await (await fetch('/settings',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({openSystemOnStart:e.target.checked})})).json();
    o.textContent=r.ok?(e.target.checked?'\u2705 النظام هيفتح مع الويندوز':'\u2705 النظام مش هيفتح لوحده'):'\u274c '+(r.error||'');
    o.className=r.ok?'ok':'bad';
  }catch(err){ o.textContent='\u274c '+err; o.className='bad'; e.target.checked=!e.target.checked; }
};

// 📦 تحميل ملف إعدادات
document.getElementById('impbtn').onclick=()=>document.getElementById('impfile').click();
document.getElementById('impfile').onchange=async(e)=>{
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  const o=document.getElementById('impout');
  o.textContent='بيحمّل...'; o.className='';
  try{
    const txt=await f.text();
    const r=await (await fetch('/settings/import',{method:'POST',headers:{'Content-Type':'application/json'},body:txt})).json();
    if(r.ok){
      o.textContent='\u2705 اتحمّل — '+r.designs+' تصميم. اعمل ريفريش للصفحة.';
      o.className='ok';
    } else { o.textContent='\u274c '+(r.error||'مش عارف'); o.className='bad'; }
  }catch(err){ o.textContent='\u274c '+err; o.className='bad'; }
  e.target.value='';
};

// 🩺 التشخيص: بنوري الرقم الخام والكلام مع بعض.
document.getElementById('pstat').onclick=async()=>{
  const o=document.getElementById('pstat-out');
  o.textContent='بيسأل...'; o.className='';
  try{
    const j=await (await fetch('/printer/status')).json();
    if(j.error){ o.textContent='\u274c '+j.error; o.className='bad'; return; }
    // ============================================================
    // ⚠️⚠️ الرقم صفر = **مافيش تبليغ**، مش "كله تمام"
    // ============================================================
    // اتجرّب على ماكينة حقيقية (XP-235B) تلات مرات: شغّالة عادي،
    // والرول برّه، والغطا مفتوح — والرقم فضل **صفر** في التلاتة.
    //
    // يعني التعريف مابيبلّغش خالص. والمفتاح تحت بيوقف الطبعة لما
    // التعريف **يبلّغ** — فهو على الماكينة دي مش هيشتغل أبدًا.
    //
    // ⚠⚠⚠ وده لازم **يتقال هنا**: من غيره المستخدم بيفتح
    // المفتاح ويفتكر إن فيه حماية، ويسيب طبعة 200 ملصق ماشية
    // والرول خلص من أولها.
    var extra='';
    if (Number(j.raw)===0){
      extra += '<div class="note" style="margin-top:8px">\u26a0\ufe0f <b>الرقم صفر معناه إن التعريف مابلّغش بحاجة</b>'
        + ' — مش معناه إن الطابعة تمام.'
        + '<br>لو الرقم فضل صفر وانت شايل الرول وفاتح الغطا، يبقى ماكينتك <b>مابتبلّغش</b>'
        + ' والمفتاح تحت <b>مش هينفع معاها</b> (هيفضل مفتوح ومايوقفش حاجة أبدًا).</div>';
    }
    // ⚠️ الطابعة المشتركة على الشبكة (\\جهاز\طابعة): ويندوز في
    // الحالة دي بيقرا حالة **الطابور عندك**، مش حالة الماكينة نفسها.
    // فحتى التعريف اللي بيبلّغ بيبقى صامت من هنا.
    if (String(j.name||'').slice(0,2)==='\\\\'){
      extra += '<div class="note" style="margin-top:6px">\U0001f50c الطابعة دي متوصّلة'
        + ' <b>كمشاركة على الشبكة</b>. في الحالة دي ويندوز بيقرا الطابور اللي عندك'
        + ' مش حالة الماكينة — فالتبليغ بيبقى أضعف.'
        // \u26a0\ufe0f\u26a0\ufe0f الجملة دي اتضافت بعد ما اتجرّب فعلًا على
        // الجهازين: اللي الطابعة متوصّلة عليه، واللي شايفها بالمشاركة —
        // والرقم طلع صفر في الاتنين. يعني المشاركة **مش** السبب هنا،
        // والتعريف نفسه هو اللي ساكت.
        //
        // من غير الجملة دي، اللي بيقرا بيفتكر إن توصيل الطابعة مباشرة
        // هيحل المشكلة — ويقعد يفك ويركّب من غير فايدة.
        + '<br>\u26a0\ufe0f بس جرّبه على الجهاز اللي الطابعة متوصّلة عليه <b>مباشرة</b>:'
        + ' لو طلع نفس الرقم، يبقى <b>التعريف نفسه</b> مابيبلّغش — والمشاركة مالهاش دعوة.</div>';
    }
    o.innerHTML='<b>'+j.summary+'</b>'
      +'<br>الرقم الخام: <code>'+j.raw+'</code> — أوامر في الطابور: '+j.jobs
      +'<br><span style="font-size:11.5px;color:var(--mut)">الطابعة: '+j.name+'</span>'
      +extra;
    o.className=j.blocking?'bad':'ok';
  }catch(e){ o.textContent='\u274c '+e; o.className='bad'; }
};

document.getElementById('save').onclick=async()=>{
  sout.textContent='بيحفظ...'; sout.className='';
  try{
    const r=await (await fetch('/settings',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({restockPrinter:sel.value,labelPrinter:lsel.value,
        deviceName:document.getElementById('devname').value.trim(),
        labelGapMm:+document.getElementById('gap').value,
        labelDirection:+document.getElementById('dir').value,
        labelFlip:document.getElementById('flip').checked,
        stopOnPrinterProblem:document.getElementById('stopbad').checked,
        openSystemOnStart:document.getElementById('opensys').checked})})).json();
    sout.textContent=r.ok?'\u2705 اتحفظ':'\u274c '+(r.error||'مش عارف');
    sout.className=r.ok?'ok':'bad';
  }catch(e){ sout.textContent='\u274c '+e; sout.className='bad'; }
};

// ⚠️ الفتح من أيقونة شريط المهام على "?update=1" بينزّل على قسم
// التحديث على طول — عشان القايمة تودّيك للمكان الصح مش لأول الصفحة.
if(location.search.indexOf('update=1')>=0) setTimeout(()=>document.getElementById('up').click(),400);
go.onclick=async()=>{
  const mm=Math.max(20,Math.min(1000,+document.getElementById('mm').value||250));
  const W=576,H=Math.round(mm/25.4*203);
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,W,H);
  x.fillStyle='#000';x.font='bold 30px system-ui';x.textAlign='center';
  x.fillText('ورقة تجربة — '+mm+' مم',W/2,46);
  for(let v=10;v<mm-4;v+=10){
    const y=Math.round(v/25.4*203);
    x.fillRect(40,y,W-80,3);
    x.font='22px system-ui';x.textAlign='right';x.fillText(v+'مم',W-46,y-7);
  }
  x.textAlign='center';x.font='bold 26px system-ui';
  x.fillText('آخر سطر — لو شايفه يبقى الورقة كاملة',W/2,H-24);
  const png=c.toDataURL('image/png').split(',')[1];
  go.disabled=true;say('بيتبعت...');
  try{
    const r=await fetch('/print',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({printer:sel.value,png:png,name:'ورقة تجربة',test:true})});
    const j=await r.json();
    say(j.ok?'\u2705 اتبعتت: '+j.width+'x'+j.height+' نقطة، '+j.bytes+' بايت.\n\nقيس الورقة بالمسطرة: آخر رقم شايفه المفروض يكون قريب من '+mm+'مم.':'\u274c '+(j.error||'مش عارف'),j.ok?'ok':'bad');
  }catch(e){say('\u274c '+e,'bad');}
  go.disabled=false;
};

// ============================================================
// 🏷️ ملصق تجربة — **لاصقة واحدة بس**
// ============================================================
// ⚠️ العدد واحد عن قصد ومش قابل للتغيير من هنا: أخطر حاجة في مسار
// الملصق هي **قطبية النقط** — لو مقلوبة اللاصقة بتطلع سودا بالكامل.
// فالتجربة لازم تكلّف لاصقة واحدة، مش عشرة.
//
// والرسم أبيض في أغلبه عن قصد كمان: لو طلع أسود، القطبية مقلوبة
// والحكم بالعين من غير قياس.
const lgo=document.getElementById('lgo');
lgo.onclick=async()=>{
  const W=304,H=200; // 38x25 مم على 203 نقطة/بوصة
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,W,H);
  x.strokeStyle='#000';x.lineWidth=3;x.strokeRect(6,6,W-12,H-12);
  x.fillStyle='#000';x.textAlign='center';
  x.font='bold 26px system-ui';x.fillText('ملصق تجربة',W/2,52);
  x.font='20px system-ui';x.fillText('38 x 25 مم',W/2,84);
  x.font='bold 30px system-ui';x.fillText('10632103',W/2,126);
  x.fillRect(W/2-40,146,80,26);
  x.fillStyle='#fff';x.font='bold 18px system-ui';x.fillText('اسود',W/2,165);
  const png=c.toDataURL('image/png').split(',')[1];
  lgo.disabled=true;say('بيتبعت ملصق...');
  try{
    const r=await fetch('/label',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({printer:lsel.value,widthMm:38,heightMm:25,name:'ملصق تجربة',
        test:true,labels:[{png:png,copies:1}]})});
    const j=await r.json();
    say(j.ok?'\u2705 اتبعت ملصق واحد: '+j.width+'x'+j.height+' نقطة، '+j.bytes+' بايت.\n\nلو اللاصقة طلعت سودا بالكامل، علّم على "اقلب ألوان الملصق" فوق واحفظ وجرّب تاني.':'\u274c '+(j.error||'مش عارف'),j.ok?'ok':'bad');
  }catch(e){say('\u274c '+e,'bad');}
  lgo.disabled=false;
};

// ⚠️ التحديث خطوتين عن قصد: بيقولك النسخة الأول، وانت اللي تقرر.
// حاجة بتستبدل البرنامج نفسه مايصحّش تحصل بدوسة واحدة من غير ما تعرف.
const uo=document.getElementById('uout'), up=document.getElementById('up');
up.onclick=async()=>{
  up.disabled=true; uo.textContent='بيشوف...'; uo.className='';
  try{
    const j=await (await fetch('/update/check')).json();
    if(j.error){ uo.textContent='\u274c '+j.error; uo.className='bad'; }
    else if(!j.newer){ uo.textContent='\u2705 انت على آخر نسخة ('+j.current+')'; uo.className='ok'; }
    else if(!j.supported){ uo.textContent='فيه نسخة '+j.version+' بس التحديث الذاتي على الويندوز بس'; }
    else {
      uo.innerHTML='فيه نسخة جديدة: <b>'+j.version+'</b> (عندك '+j.current+')';
      const b=document.createElement('button');
      b.textContent='حدّث دلوقتي'; b.style.marginTop='10px';
      b.onclick=async()=>{
        b.disabled=true; uo.textContent='بينزّل...';
        try{
          const r=await (await fetch('/update/apply',{method:'POST'})).json();
          uo.innerHTML = r.ok
            ? (r.updated
                ? '\u2705 اتحدّث. البرنامج بيقفل ويفتح تاني — استنى ثانيتين واعمل ريفريش للصفحة.'
                : '\u2705 انت على آخر نسخة خلاص — مانزّلش حاجة.')
            : '\u274c '+(r.error||'مش عارف');
          uo.className = r.ok?'ok':'bad';
        }catch(e){ uo.textContent='\u274c '+e; uo.className='bad'; }
      };
      uo.appendChild(document.createElement('br')); uo.appendChild(b);
    }
  }catch(e){ uo.textContent='\u274c '+e; uo.className='bad'; }
  up.disabled=false;
};
// ============================================================
// 📦 ملف الأصناف
// ============================================================
// ⚠️⚠️ ليه الزرار بيفتح شاشة من **البرنامج** مش من الصفحة:
// خانة الملف في المتصفح (input type=file) مابتديش المسار — بترجّع
// C:\fakepath وده حاجز أمان في كل المتصفحات ومالوش لف. وإحنا
// محتاجين المسار الحقيقي عشان نفضل نراقب الملف بعد ما الصفحة تتقفل.
const pfPath=document.getElementById('pf-path'), pfOut=document.getElementById('pf-out'),
      pfAuto=document.getElementById('pf-auto'), pfPick=document.getElementById('pf-pick'),
      pfCheck=document.getElementById('pf-check');

function pfWhen(ms){
  if(!ms) return '';
  try{ return new Date(ms).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}); }
  catch(e){ return new Date(ms).toLocaleString(); }
}
function pfSize(b){
  if(!b) return '';
  // ⚠️ الملف الصغير كان بيطلع "0 كيلو" — رقم بيخوّف من غير داعي.
  if(b<1024) return b+' بايت';
  return b>=1048576 ? (b/1048576).toFixed(1)+' ميجا' : Math.round(b/1024)+' كيلو';
}
// ============================================================
// 📶 شريط التقدّم + سطر آخر رفع
// ============================================================
// ⚠️⚠️ البرنامج **مابيرفعش** — اللي بيرفع هو النظام في المتصفح. فاللي
// بنرسمه هنا جاي من النظام وهو بيبعت خطواته للبرنامج، والصفحة بتسأل
// كل ثانية وهو ماشي. الشرح الكامل في productsfile.go.
const pfProg=document.getElementById('pf-prog'), pfProgTxt=document.getElementById('pf-prog-txt'),
      pfBar=document.getElementById('pf-bar'), pfLast=document.getElementById('pf-last');
let pfPoll=null;

// ⚠️ نفس شكل التاريخ اللي في النظام: اسم اليوم الأول — بيقولك "امبارح
// ولا من أسبوع" من غير ما تحسب.
function pfStamp(ms){
  if(!ms) return '';
  try{
    return new Date(ms).toLocaleString('ar-EG',{weekday:'long',year:'numeric',month:'numeric',
      day:'numeric',hour:'numeric',minute:'2-digit'});
  }catch(e){ return new Date(ms).toLocaleString(); }
}
function pfNum(n){ try{ return Number(n).toLocaleString('ar-EG'); }catch(e){ return String(n); } }

function pfDrawProgress(st){
  const pr=st&&st.progress;
  if(!pr){ pfProg.style.display='none'; pfStopPoll(); return; }
  pfProg.style.display='block';
  if(pr.error){
    pfProgTxt.innerHTML='\u274c الرفع وقع: '+pr.error;
    pfBar.style.width='0%';
    pfStopPoll();
    return;
  }
  const total=Number(pr.total)||0, done=Number(pr.done)||0;
  // ⚠️ من غير total معروف بنكتب "بيجهّز" بدل ما نحسب نسبة من صفر
  // ونطلّع NaN% في وش المستخدم.
  const pct=total>0?Math.min(100,Math.round(done*100/total)):0;
  pfProgTxt.textContent=total>0?('بيرفع... '+pct+'% ('+pfNum(done)+' من '+pfNum(total)+' صنف)'):'بيجهّز الملف...';
  pfBar.style.width=(total>0?pct:6)+'%';
  pfStartPoll();
}

function pfDrawLast(st){
  if(!st||!st.lastUploadMs){ pfLast.textContent=''; return; }
  pfLast.innerHTML='\u2705 آخر رفع: <b>'+pfStamp(st.lastUploadMs)+'</b>'
    +(st.lastUploadCount?(' &mdash; '+pfNum(st.lastUploadCount)+' صنف'):'')
    // 🔢 ن٣ — الرقم القصير بتاع اللي اترفع. نفس الرقم بيتكتب في
    // النظام في سطر "آخر تحديث"، فبتقارن بالعين من غير ما تفتح ملف.
    +(st.lastUploadShort?('<br>رقم المرفوع: <code class="fp">'+st.lastUploadShort+'</code>'):'')
    // ⚠️⚠️ السطر ده هو اللي بيمنع أخطر لبس: تاريخ لوحده بيخلي اللي
    // بيقرا يفتكر إن اللي في النظام هو اللي في الملف — وممكن يكون
    // حفظ الملف بعدين والرفع لسه مااتعملش.
    // ⚠️ مابنقولش "لسه مااترفعش" وهو **بيرفع دلوقتي**: الجملتين مع
    // بعض بتلخبط — الشريط ماشي والكلام بيقول إنه واقف.
    +(st.changedSinceUpload&&!st.progress
      ?'<br><span class="bad">\u26a0 والملف اتغيّر بعد كده — لسه مااترفعش</span>':'');
}

// ⚠️ السؤال كل ثانية **وهو بيرفع بس**، وبيقف أول ما يخلص: مافيش نداء
// دايم شغّال على الفاضي.
function pfStartPoll(){
  if(pfPoll) return;
  pfPoll=setInterval(()=>{ fetch('/products/file').then(r=>r.json())
    .then(j=>{ pfDrawProgress(j); pfDrawLast(j); }).catch(()=>{}); },1000);
}
function pfStopPoll(){ if(pfPoll){ clearInterval(pfPoll); pfPoll=null; } }

function pfShow(st,quiet){
  if(!st) return;
  if(typeof st.path==='string' && document.activeElement!==pfPath) pfPath.value=st.path;
  pfAuto.checked=!!st.autoUpload;
  pfDrawProgress(st);
  pfDrawLast(st);
  if(!st.path){ if(!quiet){ pfOut.textContent='مافيش ملف متظبّط لسه.'; pfOut.className=''; } return; }
  if(st.error){ pfOut.textContent='\u274c '+st.error; pfOut.className='bad'; return; }
  if(st.exists){
    // ⚠️⚠️ الرقم القصير هنا هو بتاع **الملف اللي على القرص دلوقتي**.
    // واللي في سطر آخر رفع تحت هو بتاع **اللي اترفع**. الاتنين جنب
    // بعض عن قصد: متطابقين = اللي في النظام هو اللي في الملف.
    pfOut.innerHTML='\u2705 الملف موجود &mdash; <b>'+pfSize(st.size)+'</b>'
      +'<br>آخر تعديل: '+pfWhen(st.modifiedMs)
      +(st.shortCode?('<br>رقم الملف: <code class="fp">'+st.shortCode+'</code>'):'');
    pfOut.className='ok';
  }
}
function pfLoad(quiet){
  fetch('/products/file').then(r=>r.json()).then(j=>pfShow(j,quiet)).catch(()=>{});
}
pfLoad(true);

// ⚠️ الشاشة بتفتح على **الكمبيوتر** — ولو صاحب المحل داخل من
// التليفون، هو مش شايفها. فالنص بيقول له يبص على الشاشة، مش بيسيبه
// مستني دوسة مالهاش رد.
pfPick.onclick=async()=>{
  pfPick.disabled=true;
  pfOut.textContent='افتح شاشة الكمبيوتر — شاشة اختيار الملف مفتوحة عليها.'; pfOut.className='';
  try{
    const j=await (await fetch('/products/file/pick',{method:'POST'})).json();
    if(j.error){ pfOut.textContent='\u274c '+j.error; pfOut.className='bad'; }
    else if(j.canceled){ pfOut.textContent='مااختارتش حاجة — المسار القديم زي ما هو.'; pfOut.className=''; pfShow(j.state,true); }
    else pfShow(j.state);
  }catch(e){ pfOut.textContent='\u274c '+e; pfOut.className='bad'; }
  pfPick.disabled=false;
};

// ⚠️ المسار بيتحفظ لوحده زي "يشتغل مع الويندوز" — مش مربوط بزرار
// الحفظ اللي في قسم تاني، عشان محدش يكتب ويمشي ويفتكره اتحفظ.
async function pfSave(body){
  const j=await (await fetch('/products/file',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
  return j;
}
pfPath.onchange=async()=>{
  pfOut.textContent='بيحفظ...'; pfOut.className='';
  try{ pfShow(await pfSave({path:pfPath.value})); }
  catch(e){ pfOut.textContent='\u274c '+e; pfOut.className='bad'; }
};
pfCheck.onclick=async()=>{
  pfCheck.disabled=true;
  pfOut.textContent='بيشوف...'; pfOut.className='';
  try{ pfShow(await pfSave({path:pfPath.value})); }
  catch(e){ pfOut.textContent='\u274c '+e; pfOut.className='bad'; }
  pfCheck.disabled=false;
};
pfAuto.onchange=async(e)=>{
  const on=e.target.checked;
  try{
    const st=await pfSave({autoUpload:on});
    pfShow(st,true);
    pfOut.textContent=on?'\u2705 هيترفع لوحده أول ما الملف يتغيّر':'\u2705 مش هيترفع لوحده — هييجيلك سؤال';
    pfOut.className='ok';
  }catch(err){ pfOut.textContent='\u274c '+err; pfOut.className='bad'; e.target.checked=!on; }
};

// ============================================================
// ⏳ الطابور الواقف — م٢
// ============================================================
// ⚠️⚠️ السؤال كل نص دقيقة **وانت فاتح التاب ده بس**، وبيقف أول ما
// تسيبه أو تقفل الصفحة. البرنامج مافيهوش شغل في الخلفية، ومانفتحش
// واحد من الباب الخلفي عشان شاشة.
const qOut=document.getElementById('qout'), qGo=document.getElementById('qgo'),
      qAuto=document.getElementById('qauto');
let qTimer=null;
const Q_EVERY_MS=30000;

function qDraw(j){
  if(!j){ return; }
  if(j.error){ qOut.textContent='\u274c '+j.error; qOut.className='bad'; return; }
  if(!j.supported){ qOut.textContent=j.summary; qOut.className=''; return; }
  if(j.stuck){
    qOut.innerHTML='<b>'+j.summary+'</b>'
      +'<div class="note" style="margin-top:8px">لو الورقة مش بتخرج: شوف الطابعة مولّعة والكابل واصل،'
      +' وبعدين افتح <b>الأجهزة والطابعات</b> في الويندوز وافضي الطابور واطبع الورقة تاني'
      +' من <b>السجلات &gt; الأوراق المحفوظة</b>.</div>';
    qOut.className='bad';
    return;
  }
  qOut.textContent=j.summary; qOut.className=j.jobs>0?'':'ok';
}
async function qCheck(){
  try{ qDraw(await (await fetch('/printer/queue')).json()); }
  catch(e){ qOut.textContent='\u274c '+e; qOut.className='bad'; }
}
function qStop(){ if(qTimer){ clearInterval(qTimer); qTimer=null; } }
function qMaybeStart(){
  qCheck();
  qStop();
  if(qAuto && qAuto.checked) qTimer=setInterval(qCheck,Q_EVERY_MS);
}
if(qGo) qGo.onclick=qCheck;
if(qAuto) qAuto.onchange=()=>{ if(qAuto.checked) qMaybeStart(); else qStop(); };

// ============================================================
// 🧾 الأوراق المحفوظة (م٤) + سجل الطباعة (م٥)
// ============================================================
const sheetsBox=document.getElementById('sheets'), plogBox=document.getElementById('plog');

function plWhen(ms){
  try{ return new Date(ms).toLocaleString('ar-EG',{weekday:'long',month:'numeric',day:'numeric',
    hour:'numeric',minute:'2-digit'}); }
  catch(e){ return new Date(ms).toLocaleString(); }
}
// ⚠️ النص اللي جاي من النظام (اسم الفئة) بيتعرض في innerHTML —
// فلازم يعدّي على تهريب. نفس قاعدة escapeHTML في النظام.
function esc(t){
  return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// ⚠️⚠️ الاسم اللي النظام بيبعته بيبدأ بنفس الكلمة ("ورقة تزويد")،
// فلو كتبناهم ورا بعض السطر بيطلع "ورقة تزويد ورقة تزويد — كريب".
// بنشيل البداية المكررة والشرطة اللي وراها.
const KIND={restock:{i:'\ud83d\udcc4',t:'ورقة تزويد'},
            label:{i:'\ud83c\udff7\ufe0f',t:'ملصقات'},
            test:{i:'\ud83e\uddea',t:'تجربة'}};
function kindOf(k){ return KIND[k]||{i:'\ud83d\udda8\ufe0f',t:k||'طبعة'}; }
function trimName(name,kindText){
  let t=String(name||'').trim();
  if(t.indexOf(kindText)===0) t=t.slice(kindText.length);
  return t.replace(/^[\s\u2014\u2013-]+/,'').trim();
}

function drawSheets(entries){
  const rows=entries.filter(e=>e.sheet);
  if(!rows.length){
    sheetsBox.innerHTML='<div class="empty">مافيش أوراق محفوظة لسه — أول ورقة تزويد تطبعها هتتحفظ هنا.</div>';
    return;
  }
  // ⚠️ الورقة الواحدة ممكن يكون ليها أكتر من سطر (اتطبعت تاني)،
  // فبنوريها **مرة واحدة** بأحدث تاريخ. من غير كده القايمة بتمتلي
  // بنفس الورقة مكررة.
  const seen={}, uniq=[];
  rows.forEach(e=>{ if(!seen[e.sheet]){ seen[e.sheet]=1; uniq.push(e); } });
  sheetsBox.innerHTML=uniq.map(e=>
    '<div class="lrow">'
    +'<div class="t"><b>'+esc(e.name||'ورقة تزويد')+'</b>'
    +'<div class="w">'+plWhen(e.ms)+'</div></div>'
    +'<a class="btn ghost" target="_blank" href="/print/sheet?name='+encodeURIComponent(e.sheet)+'"'
    +' style="padding:6px 11px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--ink);font-size:12.5px">\ud83d\udc41\ufe0f بصّ عليها</a>'
    +'<button class="ghost" data-sheet="'+esc(e.sheet)+'">\ud83d\udda8\ufe0f اطبعها تاني</button>'
    +'</div>').join('');
}

function drawLog(entries){
  if(!entries.length){
    plogBox.innerHTML='<div class="empty">السجل فاضي.</div>';
    return;
  }
  plogBox.innerHTML=entries.map(e=>{
    const k=kindOf(e.kind), rest=trimName(e.name,k.t);
    const bits=[];
    if(e.count) bits.push(e.count+' لاصقة');
    if(e.printer) bits.push(esc(e.printer));
    return '<div class="lrow"><div class="t">'
      +(e.ok?'':'<span class="bad">\u274c فشلت \u2014 </span>')
      +'<b>'+k.i+' '+esc(k.t)+'</b>'+(rest?(' '+esc(rest)):'')
      +'<div class="w">'+plWhen(e.ms)+(bits.length?(' \u00b7 '+bits.join(' \u00b7 ')):'')
      +(e.error?(' \u00b7 '+esc(e.error)):'')+'</div></div></div>';
  }).join('');
}

async function loadPrintLog(){
  try{
    const j=await (await fetch('/print/log')).json();
    const ents=j.entries||[];
    drawSheets(ents); drawLog(ents);
  }catch(e){
    sheetsBox.innerHTML='<div class="bad" style="font-size:12.5px">\u274c '+e+'</div>';
    plogBox.innerHTML='';
  }
}

// ⚠️ الطبع من هنا بيتبع نفس مسار /print بالظبط — نفس الطابعة
// المحفوظة ونفس القص. الشرح في handleSheetReprint.
sheetsBox.addEventListener('click',async(e)=>{
  const b=e.target.closest('button[data-sheet]'); if(!b) return;
  const old=b.textContent;
  b.disabled=true; b.textContent='بيطبع...';
  try{
    const r=await (await fetch('/print/sheet/reprint',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:b.getAttribute('data-sheet')})})).json();
    b.textContent=r.ok?'\u2705 اتبعتت':'\u274c '+(r.error||'مش عارف');
    if(r.ok) loadPrintLog();
  }catch(err){ b.textContent='\u274c '+err; }
  setTimeout(()=>{ b.disabled=false; b.textContent=old; },2500);
});

// ⚠️⚠️ التأكيد مش زوّاقة: ده بيمسح الأوراق المحفوظة كمان، ودي
// الحاجة الوحيدة اللي بتخلّي ورقة تترجع من غير نت. دوسة غلط هنا
// مالهاش تراجع.
document.getElementById('plog-clear').onclick=async()=>{
  if(!confirm('هيتمسح السجل كله والأوراق المحفوظة معاه — ومش هينفع ترجّعهم. أكيد؟')) return;
  try{ await fetch('/print/log/clear',{method:'POST'}); loadPrintLog(); }catch(e){}
};

// ============================================================
// 🗂 وأخيرًا: افتح التاب المحفوظ
// ============================================================
// ⚠️⚠️ آخر سطر في السكربت عن قصد — الشرح فوق عند showTab. كل حاجة
// showTab بتلمسها لازم تكون اتعرّفت قبلها.
(function(){
  let saved='printer';
  try{ saved=localStorage.getItem('tz-helper-tab')||'printer'; }catch(e){}
  showTab(saved);
})();
</script></html>`
