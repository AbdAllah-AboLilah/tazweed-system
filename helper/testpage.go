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
   <h1>&#127374; مساعد التزويد</h1>
   <div class="sub">شغّال على الكمبيوتر ده — سيبه مفتوح والنظام هيلاقيه لوحده.</div>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap" id="pills">
   <span class="pill">&#9679; شغّال</span>
  </div>
 </div>

 <div class="card">
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

 <div class="card">
  <div class="sec-title">&#127991; الملصق</div>
  <div class="sec-sub">شكل الملصق ومقاسه. كل حاجة هنا بتخص اللاصقات بس.</div>

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

  <hr class="hr">
  <div style="font-size:12.5px;font-weight:600;margin-bottom:8px">معايرة الماكينة</div>
  <div class="row">
   <div style="flex:1;min-width:150px"><label>الفاصل بين اللاصقات (مم)</label>
    <input id="gap" type="number" step="0.5" min="0" max="20" value="2"></div>
   <div style="flex:1;min-width:150px"><label>اتجاه الملصق</label>
    <select id="dir"><option value="1">1</option><option value="0">0</option></select></div>
  </div>
  <label class="chk" style="margin-top:6px"><input type="checkbox" id="flip">
   <span>اقلب ألوان الملصق<small>افتحها بس لو اللاصقة طلعت سودا بالكامل.</small></span></label>
 </div>

 <div class="card">
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
  <label class="chk" style="margin-top:8px"><input type="checkbox" id="stopbad">
   <span>اوقف الطبعة لو الطابعة مبلّغة مشكلة
    <small>&#9888; متفتحهاش غير لما تتأكد من التشخيص فوق. لو التعريف بيبلّغ غلط، الطباعة هتقف وانت مش عارف ليه.</small></span></label>
 </div>

 <div class="card">
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
    o.innerHTML='<b>'+j.summary+'</b>'
      +'<br>الرقم الخام: <code>'+j.raw+'</code> — أوامر في الطابور: '+j.jobs
      +'<br><span style="font-size:11.5px;color:var(--mut)">الطابعة: '+j.name+'</span>';
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
      body:JSON.stringify({printer:sel.value,png:png,name:'ورقة تجربة'})});
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
        labels:[{png:png,copies:1}]})});
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
</script></html>`
