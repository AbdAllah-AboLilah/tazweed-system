package main

import _ "embed"

// ============================================================
// 📱 مولّد رمز QR — **نفس** الملف اللي النظام بيستخدمه بالحرف
// ============================================================
// اتطلب بالنص: "ويعمل الكيو ار كود من ارقام الباركود واجرب شكله".
//
// ⚠️⚠️ ومهم إنه **نفس** الملف مش مكتبة تانية: لو المعاينة رسمت QR
// بمولّد مختلف، ممكن يطلع بعدد مربعات مختلف — فتظبط المقاس على حاجة
// والطابعة تطلّع حاجة تانية. وده أسوأ من إننا مانرسمش QR أصلًا.
//
// ⚠️ والنسخة دي مكرّرة من js/vendor/qrcode-generator.js عشان go:embed
// مابيقدرش يطلع بره مجلد الموديول. فيه فحص (TestQRLibMatchesSystem)
// بيقارن الملفين بايت ببايت ويقع لو واحد فيهم اتغيّر من غير التاني.
//
//go:embed qrcode-generator.js
var qrcodeLibJS string

// ============================================================
// 🎨 صفحة مصمّم الملصق
// ============================================================
// ⚠️⚠️ المعاينة هنا **بتترسم بنفس اللي بيرسم الملصق الحقيقي**: المتصفح.
// يعني اللي بتشوفه على الشاشة هو اللي هيطلع على الورق — مش تقريب ولا
// رسمة توضيحية. ده السبب الأساسي إن الصفحة دي في المتصفح أصلًا.
//
// ⚠️ الصفحة مكتوبة هنا كنص جوّه البرنامج (زي صفحة التجربة بالظبط) عشان
// البرنامج يفضل **ملف واحد** يتنقل بالنسخ — مافيش مجلد ملفات جنبه.

const designerPage = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>مصمّم الملصق — مساعد التزويد</title>
<!-- ⚠️ الخطوط بتتقدّم من البرنامج نفسه (شوف helper/fonts.go) مش من
     النت: المصمّم لازم يشتغل والمحل من غير نت. وحط كل القواعد هنا
     مابيكلّفش حاجة — المتصفح مابينزّلش ملف خط إلا لما يلاقي كلام
     معروض بيه فعلًا. -->
<link rel="stylesheet" href="/fonts.css">
<style>
 :root{--ink:#1c2024;--line:#d9dce1;--bg:#f4f5f7;--card:#fff;--sage:#2f6b46;--warn:#b02020;--mut:#6b7280}
 *{box-sizing:border-box}
 body{font-family:system-ui,Segoe UI,Tahoma,sans-serif;background:var(--bg);margin:0;padding:16px;color:var(--ink)}
 .wrap{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
 .card{background:var(--card);border-radius:12px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.07)}
 h1{font-size:19px;margin:0 0 3px}
 .sub{color:var(--mut);font-size:13px}
 .row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
 label{display:block;font-size:12px;margin-bottom:5px;color:var(--mut)}
 input,select{width:100%;padding:8px;border:1px solid var(--line);border-radius:7px;font-size:14px;font-family:inherit;background:var(--card);color:var(--ink)}
 input[type=number]{font-variant-numeric:tabular-nums}
 button{padding:10px 14px;border:0;border-radius:8px;background:var(--sage);color:#fff;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit}
 button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
 button.danger{background:transparent;color:var(--warn);border:1px solid var(--line)}
 button:disabled{opacity:.5;cursor:default}

 /* ---- شريط العناصر ---- */
 .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
 .tab{padding:6px 12px;border:1px solid var(--line);border-radius:100px;font-size:13px;cursor:pointer;background:var(--card)}
 .tab.on{background:var(--sage);border-color:var(--sage);color:#fff;font-weight:600}
 .tab.off{opacity:.45}

 /* ---- المعاينة ---- */
 .stage{background:#e9ebee;border-radius:10px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:8px}
 .sheet{background:#fff;position:relative;box-shadow:0 1px 6px rgba(0,0,0,.18);overflow:hidden}
 .cut{position:absolute;left:0;right:0;border-top:1px dashed #bbb}
 .cutV{position:absolute;top:0;bottom:0;left:auto;right:auto;border-top:0;border-right:1px dashed #bbb}
 .preset{padding:5px 11px;font-size:12.5px}
 .preset.on{background:var(--sage);color:#fff;border-color:var(--sage)}
 .el{position:absolute;overflow:hidden;display:flex;align-items:center;line-height:1.2}
 .el.sel{outline:1.5px solid var(--sage);outline-offset:1px;background:rgba(47,107,70,.07)}
 .el span{display:block;width:100%}
 .scale{font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums;direction:ltr}

 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(94px,1fr));gap:10px}
 .msg{font-size:13.5px;line-height:1.7;margin-top:10px;min-height:20px}
 .ok{color:var(--sage)} .bad{color:var(--warn)}
 .hint{font-size:12px;color:var(--mut);line-height:1.7;margin-top:8px}
</style>
<script src="/qrcode.js"></script>
<div class="wrap">

 <div class="card">
  <h1>&#127912; مصمّم الملصق</h1>
  <div class="sub">حرّك أي حاجة بالمليمتر، والمعاينة تحت بمقاس الملصق الحقيقي.</div>
  <div class="row" style="margin-top:14px">
   <div style="flex:2;min-width:150px"><label>التصميم</label><select id="pick"></select></div>
   <button class="ghost" id="newd">+ تصميم جديد</button>
   <button class="danger" id="deld">احذف</button>
  </div>
 </div>

 <div class="card">
  <div class="row">
   <!-- ⚠️ سطر النوع تحت الاسم. اتطلب بالنص: "عاوز في اسم التصميم
        يبقي جنبه نوعه بمعني ملصق عادي مقسوم 4 بدون سعر". والفايدة
        إنك تعرف التصميم اللي قدامك ده **بيتطبع في إيه** قبل ما
        تعدّل فيه. -->
   <div style="flex:1;min-width:170px">
    <label>اسم التصميم</label><input id="dname">
    <div id="dname-roles" style="font-size:10.5px;color:var(--mut);margin-top:3px;min-height:14px"></div>
   </div>
   <div style="width:92px"><label>العرض (مم)</label><input id="dw" type="number" step="0.5" min="10" max="200"></div>
   <div style="width:92px"><label>الطول (مم)</label><input id="dh" type="number" step="0.5" min="5" max="200"></div>
   <div style="width:78px"><label>صفوف</label><select id="dhalves"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
   <!-- ============================================================
        ⚠️⚠️ الأعمدة — دي اللي خلّت "مقسوم ٤" مش صفحة تانية
        ============================================================
        الفرق الوحيد بين مقسوم ٤ والملصق العادي إنه **عمودين بدل
        عمود واحد**. فبدل ما نعمل مصمّم تاني وكود تاني وفحوص تانية،
        خانة واحدة بتعمل الاتنين. -->
   <div style="width:78px"><label>أعمدة</label><select id="dcols"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
  </div>
  <div class="row" style="margin-top:10px;align-items:center">
   <span class="scale">أشكال جاهزة:</span>
   <button class="ghost preset" data-preset="1x1">ملصق واحد (1×1)</button>
   <button class="ghost preset" data-preset="2x1">عادي (2×1)</button>
   <button class="ghost preset" data-preset="2x2">مقسوم ٤ (2×2)</button>
  </div>
  <div class="scale" id="cellinfo" style="margin-top:6px"></div>
  <!-- ============================================================
       🔤 خط الملصق
       ============================================================
       اتطلب بالنص: "انا كنت عاوزك تضيف تغير الخط في نظام تصميم
       الملصق في البرنامج المساعد مش النظام بحيث بردوا اقدر اشوف
       تغير الخط هياثر ازاي".

       ⚠️⚠️ وهو **إعداد في التصميم** مش إعداد في الصفحة: بيتحفظ مع
       التصميم ويروح للنظام معاه. غير كده كنت هتظبط الشكل على خط
       وتطبع بخط تاني.

       ⚠️ والمعاينة تحت بتستنى الخط ينزل فعلًا قبل ما تقيس — الخط
       بيغيّر عرض الكلام، يعني بيغيّر التصغير، يعني بيغيّر المقاس
       اللي هيطلع على الورق. ده **بيت القصيد** من الخانة دي. -->
  <div class="row" style="margin-top:12px">
   <div style="flex:1;min-width:180px"><label>🔤 خط الملصق</label><select id="dfont"></select></div>
  </div>
  <div class="scale" id="dfont-hint" style="margin-top:6px"></div>
  <div class="scale" style="margin-top:4px">⚠️ المقاس اللي هيطلع بيختلف من اسم لاسم — <b>جرّب بأسماءك انت</b> من خانات التجربة تحت المعاينة.</div>
 </div>

 <div class="card">
  <div class="stage">
   <div class="scale" id="scale">&mdash;</div>
   <div class="sheet" id="sheet"></div>
   <div class="scale">المعاينة بترسم بنفس خط الملصق الحقيقي وبتصغّر زيّه</div>
   <div class="scale bad" id="shrunk" style="min-height:16px"></div>
  </div>

  <!-- ============================================================
       🧪 بيانات التجربة
       ============================================================
       اتطلبت بالنص: "انا عاوزك تحت اسم الصنف ورقم الباركود والسعر
       والسعر قبل الخصم حقول اكتب فيها عشان اختبر فيها اللي عاوزه
       يعني اكتب اسم صنف كبير واشوف شكله هيطلع ازاي بعد م غيرت
       الاعدادات ... ممكن تعمل تاب ل التجربة ... او شوف انت اقتراحك".

       ⚠️⚠️ واختَرنا **مش تاب** عن قصد: التاب معناه إنك تغيّر إعداد،
       تروح للتاب التاني، تبص، وترجع. والحاجة اللي بتتظبط هنا هي
       بالظبط **العلاقة** بين الإعداد والنتيجة — فلازم الاتنين يبقوا
       قدام عينك في نفس اللحظة. فالخانات تحت المعاينة على طول،
       وكل حرف بتكتبه بيتعاد رسمه فورًا.

       ⚠️ والأزرار الجاهزة مش رفاهية: "اسم طويل" و"اسم قصير" هما
       الحالتين اللي بيفرّقوا في كل شكوى اتبلّغت عن الملصق. -->
  <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
   <!-- ⚠️ الخانات بتتطوي. اتطلب بالنص: "عاوزك تخلي في شاشة
        التصميم خانة بيانات التجربة تبقي بتفتح وتقفل يعني ممكن اضغط
        علي سهم يخفي الخانه كلهم".

        ⚠️⚠️ والأزرار **بره** الطيّة عن قصد: "اطبع تجربة" و"اسم
        طويل" هما اللي بتستعملهم كل شوية وانت بتظبط، فطيّهم معاهم
        كان هيخلّي كل تجربة محتاجة فتحة زيادة. اللي بيتطوي هو
        الخانات اللي بتكتب فيها مرة وتسيبها. -->
   <button type="button" id="s-toggle" aria-expanded="true" aria-controls="s-body"
     style="display:flex;align-items:center;justify-content:space-between;width:100%;
            background:none;border:0;padding:0;margin:0 0 3px;cursor:pointer;color:inherit;font:inherit;text-align:right">
    <span style="font-size:13px;font-weight:600">&#129514; بيانات التجربة</span>
    <span id="s-chev" style="font-size:14px;color:var(--mut)">&#9662;</span>
   </button>
   <div id="s-body">
    <div class="scale" style="margin-bottom:10px">اكتب اللي انت عايز تشوفه على الورق — المعاينة فوق بتتغيّر وانت بتكتب. البيانات دي <b>مابتتحفظش</b>، هي للتجربة بس.</div>
    <div class="grid">
     <div style="grid-column:1/-1"><label>اسم الصنف</label><input id="s-name"></div>
     <div><label>رقم الباركود</label><input id="s-code" inputmode="numeric"></div>
     <div><label>السعر</label><input id="s-price"></div>
     <div><label>السعر قبل الخصم</label><input id="s-old" placeholder="سيبها فاضية = مافيش خصم"></div>
    </div>
   </div>
   <div class="row" style="margin-top:10px">
    <button class="ghost" id="s-long">اسم طويل</button>
    <button class="ghost" id="s-short">اسم قصير</button>
    <button class="ghost" id="s-nodisc">من غير خصم</button>
    <!-- ⚠️⚠️ ده اللي بيجاوب السؤال "هل الطبعة من غير سعر هتنفّذ
         التصميم؟" **قبل** ما يطبع: بيوري نفس التصميم والسعر مخفي،
         زي ما النظام هيعمل بالظبط. -->
    <button class="ghost" id="s-noprice">من غير سعر</button>
    <button id="s-print">&#128424; اطبع تجربة</button>
   </div>
   <div class="scale" style="margin-top:8px">&#128424; «اطبع تجربة» بتطبع <b>ملصق واحد على طول</b> على طابعة الملصق المتظبطة في الصفحة الرئيسية — من غير نافذة طباعة ومن غير اختيار ماكينة.</div>
   <div id="sent-wrap" hidden style="margin-top:10px">
    <div class="scale" style="margin-bottom:4px">ده اللي اتبعت للطابعة بالظبط:</div>
    <img id="sent-img" style="display:block;background:#fff;border:1px solid var(--line);border-radius:6px;image-rendering:pixelated;max-width:100%">
   </div>
  </div>
 </div>

 <div class="card">
  <div class="tabs" id="tabs"></div>
  <div id="fields"></div>
  <div class="hint" id="hint"></div>
 </div>

 <div class="card">
  <div class="row">
   <button id="save" style="flex:1">&#128190; احفظ التصميم</button>
   <button class="ghost" id="reset">رجّع الافتراضي</button>
  </div>
  <div class="msg" id="msg"></div>
 </div>

</div>
<script>
// ⚠️ نص تجربة حقيقي من كتالوج المحل — مش "صنف ١". الأسماء الطويلة
// هي اللي بتكشف مشاكل التصميم، فالمعاينة لازم تبدأ بواحد منها.
var SAMPLE = {
  name: 'لافوال بوتيه بدون خياطه قطن 100%',
  code: '7781430',
  price: '45 L.E',
  oldPrice: '65 L.E'
};
var KIND_AR = {qr:'رمز QR', name:'اسم الصنف', code:'رقم الباركود', price:'السعر', oldPrice:'السعر القديم'};

// ⚠️ الأدوار: أنهي تصميم بيتطبع في أنهي حالة. بتيجي محسوبة من
// البرنامج (الفاضي معناه "اتصرّف")، فاللي بيتعرض هو **اللي هينفّذ
// فعلًا** مش اللي اتكتب في الخانة.
var ROLE_AR = {normal:'ملصق عادي', quarter:'مقسوم ٤', noPrice:'من غير سعر'};
var ROLES = {};
function rolesOf(name){
  var out = [];
  ['normal','quarter','noPrice'].forEach(function(k){ if (ROLES[k] === name) out.push(ROLE_AR[k]); });
  return out;
}
function roleLabel(name){
  var r = rolesOf(name);
  return r.length ? r.join(' · ') : '';
}
var d = null, sel = 'name', designs = [], shrunk = [];
// اسم التصميم زي ما اتحمّل — بيتقارن باللي في الخانة عند الحفظ.
var origName = '';

// ============================================================
// 🔤 الخط — بيتقرا من البرنامج، والمعاينة بتستناه ينزل
// ============================================================
// ⚠️⚠️ المتصفح **مابيطلبش** الخط عشان انت كتبت اسمه في CSS — بيطلبه
// أول ما يلاقي كلام معروض بيه. ولو قِسنا قبل ما ينزل، بنقيس بخط
// الجهاز ونكتب النتيجة كأنها بتاعة الخط الجديد.
//
// يعني التصغير اللي المعاينة بتعرضه هيبقى غلط — وهو بالظبط الحاجة
// اللي الخانة دي اتعملت عشان تشوفها. فـensureFont بتستنى الأول.
var FONTS = [], FALLBACK = 'Arial, Helvetica, Tahoma, sans-serif';

function fontById(id){
  for (var i=0;i<FONTS.length;i++) if (FONTS[i].id === (id||'system')) return FONTS[i];
  return null;
}
function fontStack(){
  var f = fontById(d && d.font);
  return (f && f.family) ? "'"+f.family+"', "+FALLBACK : FALLBACK;
}
function ensureFont(cb){
  var f = fontById(d && d.font);
  if (!f || !f.family || !document.fonts || !document.fonts.load){ cb(); return; }
  var bold = (f.weights && f.weights[1]) || 700;
  var probe = 'اختبار 0123';
  Promise.all([
    document.fonts.load("400 40px '"+f.family+"'", probe),
    document.fonts.load(bold+" 40px '"+f.family+"'", probe)
  ]).then(cb, cb);
}

function $(id){ return document.getElementById(id); }

// ============================================================
// رمز QR — **نفس منطق النظام بالحرف**
// ============================================================
// ⚠️ منقول من buildBestQR في js/print-label.js: بنجرّب كذا إعداد
// ونختار اللي بيطلع بأقل عدد مربعات. لو غيّرنا المنطق هنا بس، الرمز
// في المعاينة هيبقى غير اللي بيتطبع — وده أسوأ من إننا مانرسمهوش.
var qrCache = {};
function qrURL(text){
  text = String(text || '');
  if (!text || typeof qrcode !== 'function') return '';
  if (qrCache[text] !== undefined) return qrCache[text];
  var digits = /^[0-9]+$/.test(text);
  var combos = [['Byte','M']];
  if (digits) combos.push(['Numeric','M']);
  combos.push(['Byte','L']);
  if (digits) combos.push(['Numeric','L']);
  var best = null;
  for (var i=0;i<combos.length;i++){
    try {
      var q = qrcode(0, combos[i][1]);
      q.addData(text, combos[i][0]);
      q.make();
      var n = q.getModuleCount();
      if (!best || n < best.n) best = {q:q, n:n};
    } catch (err) { /* المحتوى مش داخل في الإعداد ده — نجرّب اللي بعده */ }
  }
  qrCache[text] = best ? best.q.createDataURL(4, 0) : '';
  return qrCache[text];
}
function say(t, bad){ var m=$('msg'); m.textContent=t; m.className='msg '+(bad?'bad':'ok'); }

function el(kind){ for (var i=0;i<d.elements.length;i++) if (d.elements[i].kind===kind) return d.elements[i]; return null; }
function cellH(){ return d.heightMm / (d.halves||1); }
function cellW(){ return d.widthMm / (d.cols||1); }

// ⚠️ حالة عرض بس — **مش** بتتحفظ في التصميم. دي بتحاكي طبعة "من غير
// سعر" اللي بتتعمل من النظام، عشان تشوفها قبل ما تطبع.
var NOPRICE = false;

// العنصر ده بيتعرض دلوقتي ولا لأ؟ نفس القاعدة بالحرف في المعاينة
// وفي الصورة اللي بتتبعت للطابعة — عشان مايبقاش فيه فرق بينهم.
function elVisible(e){
  if (NOPRICE && (e.kind==='price' || e.kind==='oldPrice')) return false;
  // ⚠️⚠️ السعر القديم بقى **في صندوقه هو**، بيتحرّك لوحده.
  // اتطلب بالنص: "السعر القديم ... كان في الاول بيتحرك لوحده دلوقتي
  // مش بيتحرك من مكانه بقي مربوط بالسعر ... والاتنين يتحركوا لوحدهم".
  //
  // ⚠️ ومابيظهرش من غير خصم — والخانة في بيانات التجربة هي اللي
  // بتقرّر: سيبها فاضية (أو دوس "من غير خصم") = مافيش خصم، وساعتها
  // الصندوق بيختفي من المعاينة زي ما هيختفي من الورق بالظبط.
  if (e.kind==='oldPrice' && !SAMPLE.oldPrice) return false;
  return true;
}

// ============================================================
// المعاينة — مم × معامل ثابت، فالنسب مضبوطة
// ============================================================
// ⚠️ بنحسب المعامل من عرض الشاشة عشان الملصق يبان كامل على التليفون
// كمان، وبنكتب المعامل تحت عشان تعرف إنك بتبص على تكبير مش على الحقيقة.
function px(){
  var avail = Math.min(680, (document.querySelector('.stage').clientWidth || 320) - 36);
  return Math.max(4, avail / d.widthMm);
}

function draw(){
  var K = px(), sh = $('sheet');
  sh.style.width = (d.widthMm*K)+'px';
  sh.style.height = (d.heightMm*K)+'px';
  sh.innerHTML = '';
  $('scale').textContent = d.widthMm+' × '+d.heightMm+' mm  ·  ×'+K.toFixed(1);
  shrunk = [];

  var n = d.halves||1, nc = d.cols||1, ch = cellH(), cw = cellW();
  $('cellinfo').textContent = (n*nc) + ' لاصقة في الورقة — كل واحدة '
    + cw.toFixed(1) + ' × ' + ch.toFixed(1) + ' مم';

  // خطوط القص: أفقية بين الصفوف، ورأسية بين الأعمدة
  for (var r=1; r<n; r++){
    var c=document.createElement('div'); c.className='cut'; c.style.top=(r*ch*K)+'px'; sh.appendChild(c);
  }
  for (var q=1; q<nc; q++){
    var v=document.createElement('div'); v.className='cutV'; v.style.right=(q*cw*K)+'px'; sh.appendChild(v);
  }

  for (var h=0; h<n; h++){
   for (var col=0; col<nc; col++){
    for (var i=0;i<d.elements.length;i++){
      var e = d.elements[i];
      if (!elVisible(e)) continue;
      var box = document.createElement('div');
      // ⚠️ التحديد على أول لاصقة بس (أول صف وأول عمود) — لو حدّدنا
      // كلهم، الأربع صناديق بتتلوّن والمستخدم مش عارف بيعدّل في أنهي
      // واحدة. وهي أصلًا واحدة: العناصر بتتكرّر مش بتتعدّد.
      box.className = 'el' + (e.kind===sel && h===0 && col===0 ? ' sel' : '');
      box.style.left   = ((col*cw + e.x)*K)+'px';
      box.style.top    = ((h*ch + e.y)*K)+'px';
      box.style.width  = (e.w*K)+'px';
      box.style.height = (e.h*K)+'px';

      if (e.kind==='qr'){
        // ⚠️⚠️ ده QR **حقيقي** من رقم الباركود اللي في خانة التجربة،
        // مش مربع توضيحي. اتطلب بالنص: "ويعمل الكيو ار كود من ارقام
        // الباركود واجرب شكله".
        //
        // والفايدة مش الشكل: عدد مربعات الـQR بيزيد كل ما الرقم يطول،
        // فالرمز اللي مقاسه مظبوط لرقم من ٧ أرقام ممكن يبقى مزنوق
        // لرقم من ١٣. اللي بيصمّم لازم يشوف ده بعينه.
        var u = qrURL(SAMPLE.code);
        if (u){
          var im = document.createElement('img');
          im.src = u;
          im.style.cssText = 'width:100%;height:100%;display:block;image-rendering:pixelated';
          box.appendChild(im);
        } else {
          // مفيش رقم (أو المولّد مش محمّل) → المربع القديم عشان
          // المكان والمقاس يفضلوا باينين.
          box.style.background='repeating-linear-gradient(45deg,#333 0 2px,#fff 2px 4px)';
          box.style.border='1px solid #999';
        }
      } else {
        var s = document.createElement('span');
        s.textContent = SAMPLE[e.kind] || '';
        s.style.fontSize = (e.fontMm*K)+'px';
        s.style.fontWeight = (e.weight==='bold'?'700':'400');
        s.style.textAlign = (e.align==='right'?'right':e.align==='left'?'left':'center');
        s.style.fontFamily = fontStack();
        if (e.kind==='oldPrice') s.style.textDecoration='line-through';
        if (e.lines>1){ s.style.whiteSpace='normal'; } else { s.style.whiteSpace='nowrap'; }
        s.style.direction = (e.kind==='name' ? 'rtl' : 'ltr');
        if (e.overflow==='ellipsis'){ s.style.overflow='hidden'; s.style.textOverflow='ellipsis'; }
        box.appendChild(s);
        // ⚠️⚠️⚠️ **لازم** يتحط في الصفحة الأول
        // ------------------------------------------------------------
        // عطل حقيقي اتمسك بالقياس: الكود كان بيقيس box.clientHeight
        // والصندوق **لسه مش في الصفحة** (الإضافة كانت بعد اللوب) —
        // والمتصفح بيرجّع صفر لأي حاجة مش مرسومة. يعني الشرط كان
        // "صفر أكبر من واحد" = غلط دايمًا، واللوب **عمره ما اشتغل**.
        //
        // والنتيجة: المعاينة كانت بتوري الاسم الطويل بالمقاس اللي
        // طلبته وهو طالع بره صندوقه — وده بالظبط عكس السبب اللي
        // المصمّم اتعمل عشانه.
        sh.appendChild(box);
        // ============================================================
        // ⚠⚠ المعاينة لازم تصغّر زي الملصق الحقيقي
        // ============================================================
        if (e.overflow!=='ellipsis'){
          var f = e.fontMm*K, guard = 0;
          // ⚠️⚠️ المعاينة كانت بتكذب في الاتجاه التاني: عنصر
          // مكتوب عليه "أقصى سطرين" كانت بتوريه في **تلاتة** لأنها
          // كانت بتقيس الارتفاع بس. فاللي على الشاشة كان كلام
          // عمره ما هيتطبع.
          //
          // (والورق كان بيكذب في الاتجاه المعاكس: بيقص الزيادة —
          //  شوف wrapCanvas.) دلوقتي الاتنين بنفس القاعدة بالحرف:
          //  صغّر لحد ما الكلام يدخل في العدد المسموح.
          var maxL = Math.max(1, e.lines||1);
          var over = function(){
            if (s.scrollHeight > box.clientHeight+1) return true;
            if (s.scrollWidth > box.clientWidth+1) return true;
            // line-height 1.2 متحطوط على .el في التنسيق، ونفس الرقم
            // في الكانفاس — فالقسمة دي بتدّي عدد السطور فعلًا.
            return Math.round(s.scrollHeight / (f*1.2)) > maxL;
          };
          while (over() && f > 2 && guard++ < 60){
            f -= Math.max(0.5, f*0.04);
            s.style.fontSize = f+'px';
          }
          if (f < e.fontMm*K - 0.5 && h===0 && col===0) shrunk.push(KIND_AR[e.kind]+' ← '+(f/K).toFixed(2)+'مم');
        }
        box.onclick = (function(k){ return function(){ sel=k; render(); }; })(e.kind);
        continue;
      }
      box.onclick = (function(k){ return function(){ sel=k; render(); }; })(e.kind);
      sh.appendChild(box);
    }
   }
  }
  // ⚠️ وبنقول صراحةً مين اللي مادخلش بالمقاس اللي طلبته — ده
  // **بيت القصيد**: النظام قبل كده كان بيصغّر في سكوت.
  $('shrunk').textContent = shrunk.length ? ('⚠️ مادخلش بالمقاس المطلوب واتصغّر: ' + shrunk.join(' · ')) : '';
}

function tabs(){
  var t=$('tabs'); t.innerHTML='';
  ['qr','name','code','price','oldPrice'].forEach(function(k){
    var b=document.createElement('div');
    var has = !!el(k);
    b.className='tab'+(k===sel?' on':'')+(has?'':' off');
    b.textContent=KIND_AR[k]+(has?'':' (مش موجود)');
    b.onclick=function(){ sel=k; render(); };
    t.appendChild(b);
  });
}

function num(lbl,val,step,min,max,on){
  var w=document.createElement('div');
  w.innerHTML='<label>'+lbl+'</label>';
  var i=document.createElement('input');
  i.type='number'; i.step=step; i.min=min; i.max=max; i.value=val;
  i.oninput=function(){ var v=parseFloat(i.value); if(!isNaN(v)){ on(v); draw(); } };
  w.appendChild(i); return w;
}
function pickf(lbl,val,opts,on){
  var w=document.createElement('div');
  w.innerHTML='<label>'+lbl+'</label>';
  var s=document.createElement('select');
  opts.forEach(function(o){ var op=document.createElement('option'); op.value=o[0]; op.textContent=o[1]; if(o[0]===val) op.selected=true; s.appendChild(op); });
  s.onchange=function(){ on(s.value); draw(); };
  w.appendChild(s); return w;
}

function fields(){
  var f=$('fields'); f.innerHTML='';
  var e=el(sel);
  if(!e){
    var b=document.createElement('button'); b.className='ghost';
    b.textContent='ضيف '+KIND_AR[sel]+' للتصميم';
    b.onclick=function(){
      d.elements.push(sel==='qr'
        ? {kind:'qr',x:2,y:1.4,w:9.5,h:9.5}
        : {kind:sel,x:12.5,y:1.2,w:20,h:3,fontMm:2.4,lines:1,align:'center',weight:'normal',overflow:'shrink',show:'always'});
      render();
    };
    f.appendChild(b);
    $('hint').textContent='';
    return;
  }
  var g=document.createElement('div'); g.className='grid';
  g.appendChild(num('من الشمال (مم)', e.x, 0.1, 0, 200, function(v){e.x=v;}));
  g.appendChild(num('من فوق (مم)',   e.y, 0.1, 0, 200, function(v){e.y=v;}));
  g.appendChild(num('العرض (مم)',     e.w, 0.1, 0.5, 200, function(v){e.w=v;}));
  g.appendChild(num('الطول (مم)',     e.h, 0.1, 0.5, 200, function(v){e.h=v;}));
  if(sel!=='qr'){
    g.appendChild(num('حجم الخط (مم)', e.fontMm, 0.1, 1, 8, function(v){e.fontMm=v;}));
    g.appendChild(num('أقصى سطور',     e.lines||1, 1, 1, 4, function(v){e.lines=v;}));
    g.appendChild(pickf('التوسيط', e.align, [['right','يمين'],['center','وسط'],['left','شمال']], function(v){e.align=v;}));
    g.appendChild(pickf('سُمك الخط', e.weight, [['normal','عادي'],['bold','عريض']], function(v){e.weight=v;}));
    g.appendChild(pickf('لو مايدخلش', e.overflow, [['shrink','صغّره'],['wrap','نزّله سطر'],['ellipsis','اقصه بنقط']], function(v){e.overflow=v;}));
    g.appendChild(pickf('يظهر لو', e.show, [['always','دايمًا'],['ifDiscount','فيه خصم بس']], function(v){e.show=v;}));
  }
  f.appendChild(g);

  if(sel==='oldPrice'){
    var nt=document.createElement('div'); nt.className='hint';
    nt.textContent='⚠️ السعر القديم بيترسم **جنب السعر** في صندوق السعر، مش في مكانه هو. '
      +'المهم هنا: حجم خطه، وهل يظهر ولا لأ. (لو كل واحد في صندوقه، السعرين بيتراكبوا.)';
    f.appendChild(nt);
  }

  if(sel!=='name'){
    var rm=document.createElement('button'); rm.className='danger'; rm.style.marginTop='12px';
    rm.textContent='شيل '+KIND_AR[sel]+' من الملصق';
    rm.onclick=function(){ d.elements=d.elements.filter(function(x){return x.kind!==sel;}); render(); };
    f.appendChild(rm);
  }

  // ⚠️ تحذير فوري قبل الحفظ: الخط أكبر من الصندوق هو أشهر غلطة،
  // والمستخدم بيفتكر إن الطابعة بايظة مش إن الرقم غلط.
  var h='';
  // ============================================================
  // ⚠️⚠️ الرسالة دي بقت **معلومة** مش خطأ — اقرا قبل ما ترجّعها
  // ============================================================
  // اتبلّغ بالنص: "نزل عادي بس لما جيت احفظ التصميم قالي ان الحجم
  // لازم يكبر بالرغم من في المعاينة قدامي طلعت عادي وانا كنت راضي".
  //
  // والسبب إن المعاينة **بتصغّر** زي الملصق الحقيقي، فاللي على الشاشة
  // كان مظبوط فعلًا — والتحذير كان بيقول عكس اللي عينه شايفاه.
  //
  // دلوقتي: التصغير = معلومة (الخط هيطلع كام)، والتحذير الأحمر
  // للحالتين اللي بيضيع فيهم كلام بجد.
  var MIN_READABLE = 1.2; // نفس minReadableMm في design.go
  var need = (e.lines||1)*e.fontMm*1.2;
  var fit  = e.h/((e.lines||1)*1.2);
  if(sel!=='qr' && fit < MIN_READABLE){
    h='⚠️ المساحة صغيرة أوي: '+(e.lines||1)+' سطور في '+e.h.toFixed(1)+'مم معناها خط '
      +fit.toFixed(2)+'مم، وده أصغر من إنه يتقرا ('+MIN_READABLE+'مم).'
      +' قلّل السطور أو كبّر «الطول» لـ'+(Math.ceil((e.lines||1)*1.2*MIN_READABLE*10)/10).toFixed(1)+'مم على الأقل.';
  } else if(sel!=='qr' && need > e.h+0.05 && e.overflow==='ellipsis'){
    h='⚠️ الكلام هيتقص: الخط أكبر من الصندوق و«لو مايدخلش» على «اقصه بنقط».'
      +' خليها «صغّره» وهيدخل بمقاس '+fit.toFixed(2)+'مم.';
  } else if(sel!=='qr' && need > e.h+0.05){
    h='ℹ️ الخط المطلوب ('+e.fontMm.toFixed(1)+'مم × '+(e.lines||1)+' سطور) أكبر من الصندوق،'
      +' فهيتصغّر لحد '+fit.toFixed(2)+'مم — وده اللي هيطبع فعلًا. لو ده مناسبك، احفظ عادي.';
  }
  else if(e.y+e.h > cellH()-0.7)
    h='⚠️ العنصر قريب أوي من تحت — التحريف ممكن ياكل منه.';
  else if(e.x+e.w > cellW()-0.7 || e.x < 0.7)
    // ⚠️ عرض **الخلية** مش الورقة: في مقسوم ٤ فيه خط قص رأسي في النص.
    h='⚠️ العنصر قريب أوي من الجنب (عرض اللاصقة '+cellW().toFixed(1)+'مم).';
  $('hint').textContent=h;
}

function render(){ tabs(); fields(); draw(); }

function load(){
  // ⚠️ الخطوط الأول: use() بتحتاج القايمة عشان تعرف الخط المحفوظ
  // اسمه إيه وتنزّله. ولو القايمة فشلت، الصفحة بتفضل شغّالة بخط
  // الجهاز بدل ما تقف.
  fetch('/fonts.json').then(function(r){return r.json();}).then(function(j){
    FONTS = j.fonts || [];
    var sf=$('dfont'); sf.innerHTML='';
    FONTS.forEach(function(f){
      var o=document.createElement('option'); o.value=f.id; o.textContent=f.label; sf.appendChild(o);
    });
  }).catch(function(){ FONTS=[]; }).then(loadDesigns);
}
function loadDesigns(){
  fetch('/design/all').then(function(r){return r.json();}).then(function(j){
    designs = j.designs || [];
    ROLES = j.roles || {};
    var p=$('pick'); p.innerHTML='';
    designs.forEach(function(x){
      var o=document.createElement('option');
      o.value=x.name;
      var r = roleLabel(x.name);
      o.textContent = x.name + (r ? ' \u2014 ' + r : '');
      if(x.name===j.active)o.selected=true;
      p.appendChild(o);
    });
    use(j.active);
  }).catch(function(e){ say('مش قادر أقرا التصاميم: '+e, true); });
}
function use(name){
  for(var i=0;i<designs.length;i++) if(designs[i].name===name) d=JSON.parse(JSON.stringify(designs[i]));
  if(!d && designs.length) d=JSON.parse(JSON.stringify(designs[0]));
  if(!d) return;
  if (!d.cols) d.cols=1;
  // ⚠️⚠️ الاسم الأصلي بيتسجّل هنا: من غيره مافيش طريقة نعرف
  // إنه اتغيّر، والحفظ كان هيعمل نسخة تانية بدل ما يغيّر الاسم.
  origName = d.name;
  $('dname').value=d.name; showNameRoles(); $('dw').value=d.widthMm; $('dh').value=d.heightMm;
  $('dhalves').value=String(d.halves||1); $('dcols').value=String(d.cols);
  markPreset();
  if (!d.font) d.font='system';
  $('dfont').value=d.font;
  fontHint();
  sel='name';
  // ⚠️ مش render() على طول: لازم الخط ينزل الأول وإلا القياس هيطلع
  // بخط الجهاز والتصغير اللي هيتعرض هيبقى غلط.
  ensureFont(render);
}

function fontHint(){
  var f = fontById(d && d.font);
  $('dfont-hint').textContent = f ? f.hint : '';
}

$('pick').onchange=function(){ use($('pick').value); };
$('dfont').onchange=function(){
  d.font=$('dfont').value;
  fontHint();
  ensureFont(draw);
};
// ⚠️ الاسم مابقاش بيتطبّق وانت بتكتب: الحفظ محتاج يقارن القديم
// بالجديد عشان يعرف ده تغيير اسم ولا تصميم جديد.
$('dname').oninput=showNameRoles;

function showNameRoles(){
  var nm = ($('dname').value||'').trim();
  var r = roleLabel(nm);
  $('dname-roles').textContent = r
    ? ('\ud83c\udff7\ufe0f بيتطبع في: ' + r)
    : (nm && nm !== origName ? '\u270f\ufe0f هيتغيّر الاسم من «' + origName + '»' : '');
}
['dw','dh','dhalves','dcols'].forEach(function(id){
  $(id).onchange=function(){ readShape(); draw(); };
});

function readShape(){
  d.widthMm=parseFloat($('dw').value)||38;
  d.heightMm=parseFloat($('dh').value)||25;
  d.halves=parseInt($('dhalves').value,10)||1;
  d.cols=parseInt($('dcols').value,10)||1;
  markPreset();
}

// ⚠️ الأزرار الجاهزة بتغيّر **الشكل بس** — مش بتلمس أماكن العناصر.
// لو غيّرناها معاها، اللي ضبط تصميمه بالمليمتر كان هيلاقيه اتمسح
// بدوسة واحدة من غير سؤال.
function markPreset(){
  var key = (d.halves||1)+'x'+(d.cols||1);
  var bs = document.querySelectorAll('.preset');
  for (var i=0;i<bs.length;i++){
    var on = bs[i].getAttribute('data-preset')===key;
    bs[i].className = 'ghost preset' + (on?' on':'');
  }
}
document.querySelectorAll('.preset').forEach(function(b){
  b.onclick=function(){
    var parts=b.getAttribute('data-preset').split('x');
    $('dhalves').value=parts[0]; $('dcols').value=parts[1];
    readShape(); draw();
  };
});
$('newd').onclick=function(){
  d=JSON.parse(JSON.stringify(d)); d.name='تصميم جديد';
  // ⚠️ الاسم الأصلي بيتفضّى: ده تصميم **جديد**، مش تغيير اسم
  // للي كان مفتوح — وإلا الحفظ كان هيغيّر اسم القديم ويمسحه.
  origName = '';
  $('dname').value=d.name; showNameRoles(); say('اكتب اسم واحفظ.'); render();
};
$('deld').onclick=function(){
  if(!confirm('تحذف التصميم «'+d.name+'»؟')) return;
  fetch('/design/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:d.name})})
   .then(function(r){return r.json();}).then(function(){ say('اتحذف.'); load(); });
};
$('reset').onclick=function(){
  if(!confirm('ترجّع الشكل الافتراضي؟ اللي غيّرته في التصميم ده هيضيع.')) return;
  fetch('/design/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:d.name})})
   .then(function(){ load(); say('رجع الافتراضي.'); });
};
$('save').onclick=function(){
  var nm = ($('dname').value||'').trim();
  if(!nm){ say('اكتب اسم للتصميم الأول.', true); return; }
  d.name = nm;
  readShape();
  $('save').disabled=true;

  // ⚠️⚠️ الاسم اتغيّر؟ **نغيّره الأول** بمسار مخصوص، مش نحفظ
  // بالاسم الجديد. الحفظ بيلاقي الاسم مش موجود فبيضيف تصميم تاني
  // والقديم بيفضل مكانه — دوسة واحدة وتلاقي نسختين.
  // الشرح الكامل عند renameDesign في design.go.
  var first = (origName && origName !== nm)
    ? fetch('/design/rename',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({from:origName, to:nm})})
       .then(function(r){return r.json();})
       .then(function(j){ if(!j.ok) throw new Error(j.error||'مش قادر أغيّر الاسم'); })
    : Promise.resolve();

  first
   .then(function(){
     return fetch('/design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
   })
   .then(function(r){return r.json();})
   .then(function(j){
     $('save').disabled=false;
     if(j.ok){ say('✅ اتحفظ. النظام هياخده أول ما تفتح مفتاح «اعتمد تصميم البرنامج المساعد».'); load(); }
     else say('⚠️ '+j.error, true);
   })
   .catch(function(e){ $('save').disabled=false; say('مش قادر أحفظ: '+(e.message||e), true); });
};

// ============================================================
// 🧪 بيانات التجربة — بتتربط بالمعاينة وانت بتكتب
// ============================================================
// ⚠️ مافيش زرار "طبّق". كل حرف بيتعاد رسمه فورًا — ده اللي بيخلّي
// الخانات دي مفيدة أصلًا: انت بتجرّب، مش بتملا استمارة.
var LONG_NAME  = 'لافوال بوتيه بدون خياطه قطن 100%';
var SHORT_NAME = 'بندانه سوري';

function readSample(){
  SAMPLE.name     = $('s-name').value;
  SAMPLE.code     = $('s-code').value;
  SAMPLE.price    = $('s-price').value;
  SAMPLE.oldPrice = $('s-old').value;
  draw();
}
function writeSample(){
  $('s-name').value  = SAMPLE.name;
  $('s-code').value  = SAMPLE.code;
  $('s-price').value = SAMPLE.price;
  $('s-old').value   = SAMPLE.oldPrice;
}
['s-name','s-code','s-price','s-old'].forEach(function(id){ $(id).oninput = readSample; });

// ============================================================
// ▾ الخانات بتتطوي — والحالة بتتفكر
// ============================================================
// ⚠️ بتتفكر في المتصفح: لو طويتها، تفضل مطوية لما تفتح الصفحة
// تاني. من غير كده كنت هتطويها كل مرة من أول وجديد.
var SAMPLE_OPEN_KEY = 'tz_sample_open';
// ⚠️⚠️ صورة "اللي اتبعت للطابعة" بتتطوي معاهم. اتطلب بالنص:
// "لما اضغط اطبع تجربة لما يظهر معاينه المعاينه تدخل بردوا جوه حقل
//  بيانات التجربة بمعني لما اطوي الحقل او اخفيه تختفي جواه معاهم".
//
// ⚠️ وهي **مش** جوّه s-body في الصفحة عن قصد: مكانها الطبيعي تحت
// زرار الطباعة اللي طلّعها، مش فوقه. فالطيّ بيتحكم فيها بالكود.
//
// ⚠️ وفيه شرطين مش واحد: الصورة تظهر لو **فيه صورة أصلًا**
// (يعني طبع تجربة) **و**الخانات مفتوحة. من غير الشرط الأول، الطيّ
// كان هيطلّع إطار فاضي قبل ما يطبع حاجة.
var sampleOpen = true, hasSent = false;
function syncSent(){ $('sent-wrap').hidden = !(hasSent && sampleOpen); }

function setSampleOpen(open){
  sampleOpen = open;
  $('s-body').hidden = !open;
  $('s-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  $('s-chev').innerHTML = open ? '&#9662;' : '&#9656;';
  syncSent();
}
$('s-toggle').onclick = function(){
  var open = !!$('s-body').hidden;
  setSampleOpen(open);
  try { localStorage.setItem(SAMPLE_OPEN_KEY, open ? '1' : '0'); } catch(e){}
};
try { if (localStorage.getItem(SAMPLE_OPEN_KEY) === '0') setSampleOpen(false); } catch(e){}
$('s-long').onclick   = function(){ SAMPLE.name = LONG_NAME;  writeSample(); draw(); };
$('s-short').onclick  = function(){ SAMPLE.name = SHORT_NAME; writeSample(); draw(); };
$('s-nodisc').onclick = function(){ SAMPLE.oldPrice = '';     writeSample(); draw(); };
// ⚠️ ده مفتاح **عرض**، مش تعديل في التصميم — بيتقفل ويتفتح.
$('s-noprice').onclick = function(){
  NOPRICE = !NOPRICE;
  $('s-noprice').className = NOPRICE ? 'preset on' : 'ghost';
  $('s-noprice').textContent = NOPRICE ? '✓ من غير سعر' : 'من غير سعر';
  draw();
};
writeSample();

// ============================================================
// 🖨️ اطبع تجربة
// ============================================================
// اتطلب بالنص: "لما اغير يعني او اظبط اعداد واحتاج اجرب اللي عملته".
//
// ⚠️⚠️ **البرنامج مش هو اللي بيرسم** — المتصفح هو اللي بيرسم، وبيبعت
// للطابعة عن طريق ويندوز. ده مقصود ومكتوب سببه في design.go: رسم
// العربي (شكل الحرف حسب مكانه + اتجاه الأرقام جوّه الكلام) حاجة
// المتصفح بيعملها ببلاش، ولغة البرنامج مافيهاش حاجة جاهزة ليها.
//
// ⚠️ ويعني كمان إن اللي بيتطبع من هنا هو **بالحرف** اللي في المعاينة
// فوق — نفس المحرّك ونفس الخط ونفس قاعدة التصغير. لو اختلف حاجة،
// يبقى المعاينة هي الغلط.
function sampleFor(kind){
  if (kind==='name')  return SAMPLE.name;
  if (kind==='code')  return SAMPLE.code;
  if (kind==='price') return SAMPLE.price;
  if (kind==='oldPrice') return SAMPLE.oldPrice;
  return '';
}

// ============================================================
// 🖨️ اطبع تجربة — بيروح للطابعة **على طول**
// ============================================================
// ⚠️⚠️⚠️ النسخة الأولى كانت بتفتح نافذة طباعة المتصفح
// (window.print). واتبلّغ بالنص إنها بايظة:
//
//   "بيفتح معاينة المتصفح واختر ماكينه الطباعة وده بيخلي لما اطبع
//    بيطلع ورق فاضي من الماكينه والملصق بيظهر حتي من الجنب ويطلع ٣
//    ورقات كده ورا بعض مش زي لما في الشاشة الرئيسية بتاع المساعد لما
//    اطبع تجربة ملصق بيطبع علي طول ومظبوط"
//
// والسبب واضح: نافذة طباعة المتصفح بتحط هوامشها هي وبتعمل تحجيم
// لصفحة A4، والطابعة الحرارية مالهاش دعوة بده خالص — فالملصق بيتزحلق
// على الجنب والورق بيخرج فاضي.
//
// الطريقة الصح هي اللي الصفحة الرئيسية بتاعة البرنامج بتعملها من
// الأول: **ارسم الملصق على كانفاس بمقاس نقط الطابعة، وابعته صورة
// على /label**. البرنامج بيحوّلها لأوامر TSPL ويبعتها للطابعة —
// مافيش نافذة ولا هوامش ولا A4.
//
// ⚠️ والرسم بيحصل في المتصفح مش في البرنامج: ده نفس السبب المكتوب
// في design.go — تشكيل الحروف العربية واتجاه الأرقام جوّه الكلام
// حاجة المتصفح بيعملها ببلاش.
var DPMM = 203/25.4; // نفس دقة الطابعة في النظام

// بتقسّم النص على سطور بعرض معيّن — محاكاة لطريقة المتصفح:
// بيقسّم عند المسافات.
//
// ============================================================
// ⚠️⚠️⚠️ بترجّع **كل** السطور — حتى اللي زيادة عن المسموح
// ============================================================
// العطل اللي اتصلّح، اتبلّغ بالنص وبصورة:
//
//	"المعاينه فوق جايبه ان الاسم ده يدخل في سطرين عادي لما بضغط علي
//	 طباعة تجربة بقيت الاسم بيتاكل مش بيطلع زي المعاينه فوق"
//
// والقياس أكّده بالحرف على نفس الاسم: المعاينة بتوري 12 كلمة،
// والصورة اللي راحت للطابعة فيها **8**. آخر 4 كلمات اختفوا في سكوت.
//
// السبب: الدالة كانت بتاخد maxLines وبتقف عنده وترمي باقي الكلام.
// والكارثة مش الرمي نفسه — الكارثة إن اللي بينده بيقيس اللي **فضل**:
//
//	lines = wrapCanvas(...)            ← رمت الزيادة
//	fits  = lines كلها داخلة في الصندوق ← أكيد داخلة، إحنا رمينا الباقي!
//
// يعني حلقة التصغير كانت بتشوف إن كله تمام و**ماتشتغلش أبدًا**. فبدل
// ما الخط يصغر عشان الكلام يدخل، الكلام كان بيتقص.
//
// دلوقتي بترجّع كل السطور، واللي بينده هو اللي يقرّر: لو عددها أكتر
// من المسموح يصغّر الخط ويعيد. الشرح عند drawFit.
function wrapCanvas(x, txt, maxW){
  var words = String(txt).split(/\s+/).filter(Boolean), lines = [], cur = '';
  for (var i=0;i<words.length;i++){
    var t = cur ? cur+' '+words[i] : words[i];
    if (x.measureText(t).width <= maxW || !cur){ cur = t; continue; }
    lines.push(cur); cur = words[i];
  }
  if (cur) lines.push(cur);
  return lines;
}

// بترسم عنصر نص في صندوقه، وبتصغّر لحد ما يدخل — نفس قاعدة المعاينة.
function drawFit(x, txt, X, Y, W, H, e){
  txt = String(txt || '');
  if (!txt) return;
  var maxLines = e.lines||1;
  var size = e.fontMm*DPMM;
  var weight = (e.weight==='bold' ? 'bold ' : '');
  var lines = [];
  for (var g=0; g<90; g++){
    x.font = weight + size.toFixed(2) + 'px ' + fontStack();
    lines = wrapCanvas(x, txt, W);
    var tooWide = false;
    for (var i=0;i<lines.length;i++) if (x.measureText(lines[i]).width > W) tooWide = true;
    // ⚠️⚠️ عدد السطور **جزء من الاختبار** — ودي
    // اللي كانت ناقصة. من غيرها الكلام الزيادة كان بيتقص بدل ما
    // الخط يصغر. الشرح الكامل عند wrapCanvas.
    var fits = !tooWide && lines.length <= maxLines && lines.length*size*1.2 <= H;
    if (fits || e.overflow==='ellipsis') break;
    size -= Math.max(0.5, size*0.04);
    if (size <= 4) break;
  }
  // ⚠️ القص هنا بس — يعني لما الخط وصل لأصغر حاجة والكلام لسه
  // مش داخل (أو العنصر متظبّط على "يتقص"). قبل كده كان بيحصل
  // **دايمًا** من غير ما حد يعرف.
  if (lines.length > maxLines) lines = lines.slice(0, maxLines);
  var lh = size*1.2;
  var top = Y + (H - lines.length*lh)/2 + lh/2;
  x.textBaseline = 'middle';
  x.textAlign = (e.align==='right' ? 'right' : e.align==='left' ? 'left' : 'center');
  var ax = e.align==='right' ? X+W : e.align==='left' ? X : X+W/2;
  for (var j=0;j<lines.length;j++){
    var yy = top + j*lh;
    x.fillText(lines[j], ax, yy);
    // ⚠️ السعر القديم مشطوب — والخط بيترسم بالإيد، الكانفاس مافيهوش
    // text-decoration.
    if (e.kind==='oldPrice'){
      var w = x.measureText(lines[j]).width;
      var sx = e.align==='right' ? ax-w : e.align==='left' ? ax : ax-w/2;
      x.fillRect(sx, yy - size*0.03, w, Math.max(1, size*0.07));
    }
  }
}

// بترسم الملصق كله وبترجّع وعد بـ PNG (base64 من غير الترويسة).
function renderLabelPNG(){
  var W = Math.round(d.widthMm*DPMM), H = Math.round(d.heightMm*DPMM);
  var c = document.createElement('canvas'); c.width=W; c.height=H;
  var x = c.getContext('2d');
  x.fillStyle='#fff'; x.fillRect(0,0,W,H);
  x.fillStyle='#000';

  var ch = cellH(), cw = cellW(), n = d.halves||1, nc = d.cols||1, waits = [];
  for (var h=0; h<n; h++){
   for (var col=0; col<nc; col++){
    for (var i=0;i<d.elements.length;i++){
      var e = d.elements[i];
      // ⚠️ **نفس** elVisible بتاعة المعاينة: لو الاتنين اتفرقوا،
      // الشاشة هتوري حاجة والورق هيطلع حاجة تانية.
      if (!elVisible(e)) continue;
      var X = (col*cw + e.x)*DPMM, Y = (h*ch + e.y)*DPMM, Wb = e.w*DPMM, Hb = e.h*DPMM;
      if (e.kind==='qr'){
        var u = qrURL(SAMPLE.code);
        if (u) waits.push((function(u,X,Y,Wb,Hb){
          return new Promise(function(res){
            var im = new Image();
            im.onload = function(){
              // ⚠️ مربّع: الـQR لو اتمطّ بيبوظ ومافيش قارئ هيقراه.
              var side = Math.min(Wb, Hb);
              x.imageSmoothingEnabled = false;
              x.drawImage(im, X + (Wb-side)/2, Y + (Hb-side)/2, side, side);
              res();
            };
            im.onerror = function(){ res(); };
            im.src = u;
          });
        })(u,X,Y,Wb,Hb));
        continue;
      }
      drawFit(x, sampleFor(e.kind), X, Y, Wb, Hb, e);
    }
   }
  }
  return Promise.all(waits).then(function(){
    return { png: c.toDataURL('image/png').split(',')[1], w: W, h: H, url: c.toDataURL('image/png') };
  });
}

$('s-print').onclick = function(){
  var btn = $('s-print');
  btn.disabled = true;
  say('بيرسم الملصق ويبعته للطابعة...');
  // ⚠️ الخط لازم ينزل قبل الرسم: الكانفاس مابيطلبش الخط، ولو رسمنا
  // قبل ما ينزل الملصق هيتطبع بخط الجهاز والمعاينة بخط تاني.
  ensureFont(function(){
    renderLabelPNG().then(function(out){
      // ⚠️ بنوري الصورة اللي اتبعتت فعلًا. المعاينة فوق HTML،
      // ودي الصورة اللي راحت للطابعة بالحرف — فلو اختلفوا، تشوف
      // بعينك من غير ما تستنى الورق.
      hasSent = true;
      syncSent();
      $('sent-img').src = out.url;
      $('sent-img').style.width = (out.w/DPMM*px()/1) + 'px';
      return fetch('/label', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          widthMm: d.widthMm, heightMm: d.heightMm,
          name: 'تجربة تصميم — ' + d.name,
          labels: [{ png: out.png, copies: 1 }]
        })
      });
    }).then(function(r){ return r.json(); }).then(function(j){
      btn.disabled = false;
      if (j.ok) say('✅ اتبعت ملصق واحد للطابعة (' + j.width + '×' + j.height + ' نقطة). شوف الورق.');
      else say('⚠️ ' + (j.error || 'مش عارف') + ' — اتأكد إن طابعة الملصق متظبطة في الصفحة الرئيسية.', true);
    }).catch(function(e){
      btn.disabled = false;
      say('مش قادر أطبع: ' + e, true);
    });
  });
};

window.addEventListener('resize', function(){ if(d) draw(); });
load();
</script>
`
