package main

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
 .el{position:absolute;overflow:hidden;display:flex;align-items:center;line-height:1.2}
 .el.sel{outline:1.5px solid var(--sage);outline-offset:1px;background:rgba(47,107,70,.07)}
 .el span{display:block;width:100%}
 .scale{font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums;direction:ltr}

 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(94px,1fr));gap:10px}
 .msg{font-size:13.5px;line-height:1.7;margin-top:10px;min-height:20px}
 .ok{color:var(--sage)} .bad{color:var(--warn)}
 .hint{font-size:12px;color:var(--mut);line-height:1.7;margin-top:8px}
</style>
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
   <div style="flex:1;min-width:90px"><label>اسم التصميم</label><input id="dname"></div>
   <div style="width:92px"><label>العرض (مم)</label><input id="dw" type="number" step="0.5" min="10" max="200"></div>
   <div style="width:92px"><label>الطول (مم)</label><input id="dh" type="number" step="0.5" min="5" max="200"></div>
   <div style="width:110px"><label>ملصقات في الورقة</label><select id="dhalves"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
  </div>
 </div>

 <div class="card">
  <div class="stage">
   <div class="scale" id="scale">&mdash;</div>
   <div class="sheet" id="sheet"></div>
   <div class="scale">المعاينة بترسم بنفس خط الملصق الحقيقي وبتصغّر زيّه</div>
   <div class="scale bad" id="shrunk" style="min-height:16px"></div>
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
var d = null, sel = 'name', designs = [], shrunk = [];

function $(id){ return document.getElementById(id); }
function say(t, bad){ var m=$('msg'); m.textContent=t; m.className='msg '+(bad?'bad':'ok'); }

function el(kind){ for (var i=0;i<d.elements.length;i++) if (d.elements[i].kind===kind) return d.elements[i]; return null; }
function cellH(){ return d.heightMm / (d.halves||1); }

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

  var n = d.halves||1, ch = cellH();
  for (var h=0; h<n; h++){
    // خط القص بين الملصقات
    if (h>0){ var c=document.createElement('div'); c.className='cut'; c.style.top=(h*ch*K)+'px'; sh.appendChild(c); }
    for (var i=0;i<d.elements.length;i++){
      var e = d.elements[i];
      if (e.kind==='oldPrice' && e.show==='ifDiscount' && !SAMPLE.oldPrice) continue;
      var box = document.createElement('div');
      box.className = 'el' + (e.kind===sel && h===0 ? ' sel' : '');
      box.style.left   = (e.x*K)+'px';
      box.style.top    = ((h*ch + e.y)*K)+'px';
      box.style.width  = (e.w*K)+'px';
      box.style.height = (e.h*K)+'px';

      if (e.kind==='qr'){
        // ⚠️ مربع رمادي مش QR حقيقي: المعاينة بتظبط **المكان والمقاس**،
        // والرمز نفسه بيتولّد وقت الطباعة من رقم الصنف.
        box.style.background='repeating-linear-gradient(45deg,#333 0 2px,#fff 2px 4px)';
        box.style.border='1px solid #999';
      } else {
        var s = document.createElement('span');
        s.textContent = SAMPLE[e.kind] || '';
        s.style.fontSize = (e.fontMm*K)+'px';
        s.style.fontWeight = (e.weight==='bold'?'700':'400');
        s.style.textAlign = (e.align==='right'?'right':e.align==='left'?'left':'center');
        s.style.fontFamily = 'Arial, Helvetica, Tahoma, sans-serif';
        if (e.kind==='oldPrice') s.style.textDecoration='line-through';
        if (e.lines>1){ s.style.whiteSpace='normal'; } else { s.style.whiteSpace='nowrap'; }
        s.style.direction = (e.kind==='name' ? 'rtl' : 'ltr');
        if (e.overflow==='ellipsis'){ s.style.overflow='hidden'; s.style.textOverflow='ellipsis'; }
        box.appendChild(s);
        // ============================================================
        // ⚠⚠ المعاينة لازم تصغّر زي الملصق الحقيقي
        // ============================================================
        // من غير ده، المعاينة بتوريك الاسم الطويل بالمقاس اللي
        // طلبته وهو **مش هيطلع كده على الورق** — يعني المعاينة
        // بتكدب في الحالة الوحيدة اللي المصمّم اتعمل عشانها.
        //
        // فبنصغّر لحد ما يدخل، زي النظام بالظبط، وبنكتب المقاس
        // اللي طلع فعلًا تحت عشان تشوف الفرق بعينيك.
        if (e.overflow!=='ellipsis'){
          var f = e.fontMm*K, guard = 0;
          while ((s.scrollHeight > box.clientHeight+1 || s.scrollWidth > box.clientWidth+1) && f > 2 && guard++ < 60){
            f -= Math.max(0.5, f*0.04);
            s.style.fontSize = f+'px';
          }
          if (f < e.fontMm*K - 0.5 && h===0) shrunk.push(KIND_AR[e.kind]+' ← '+(f/K).toFixed(2)+'مم');
        }
      }
      box.onclick = (function(k){ return function(){ sel=k; render(); }; })(e.kind);
      sh.appendChild(box);
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

  if(sel!=='name'){
    var rm=document.createElement('button'); rm.className='danger'; rm.style.marginTop='12px';
    rm.textContent='شيل '+KIND_AR[sel]+' من الملصق';
    rm.onclick=function(){ d.elements=d.elements.filter(function(x){return x.kind!==sel;}); render(); };
    f.appendChild(rm);
  }

  // ⚠️ تحذير فوري قبل الحفظ: الخط أكبر من الصندوق هو أشهر غلطة،
  // والمستخدم بيفتكر إن الطابعة بايظة مش إن الرقم غلط.
  var h='';
  if(sel!=='qr' && (e.lines||1)*e.fontMm*1.2 > e.h+0.05)
    h='⚠️ الخط أكبر من الصندوق — كبّر الطول أو صغّر الخط، وإلا الكلام هيتقص.';
  else if(e.y+e.h > cellH()-0.7)
    h='⚠️ العنصر قريب أوي من تحت — التحريف ممكن ياكل منه.';
  else if(e.x+e.w > d.widthMm-0.7 || e.x < 0.7)
    h='⚠️ العنصر قريب أوي من الجنب.';
  $('hint').textContent=h;
}

function render(){ tabs(); fields(); draw(); }

function load(){
  fetch('/design/all').then(function(r){return r.json();}).then(function(j){
    designs = j.designs || [];
    var p=$('pick'); p.innerHTML='';
    designs.forEach(function(x){ var o=document.createElement('option'); o.value=x.name; o.textContent=x.name; if(x.name===j.active)o.selected=true; p.appendChild(o); });
    use(j.active);
  }).catch(function(e){ say('مش قادر أقرا التصاميم: '+e, true); });
}
function use(name){
  for(var i=0;i<designs.length;i++) if(designs[i].name===name) d=JSON.parse(JSON.stringify(designs[i]));
  if(!d && designs.length) d=JSON.parse(JSON.stringify(designs[0]));
  if(!d) return;
  $('dname').value=d.name; $('dw').value=d.widthMm; $('dh').value=d.heightMm; $('dhalves').value=String(d.halves||1);
  sel='name'; render();
}

$('pick').onchange=function(){ use($('pick').value); };
$('dname').oninput=function(){ d.name=$('dname').value; };
['dw','dh','dhalves'].forEach(function(id){
  $(id).onchange=function(){
    d.widthMm=parseFloat($('dw').value)||38;
    d.heightMm=parseFloat($('dh').value)||25;
    d.halves=parseInt($('dhalves').value,10)||1;
    draw();
  };
});
$('newd').onclick=function(){
  d=JSON.parse(JSON.stringify(d)); d.name='تصميم جديد';
  $('dname').value=d.name; say('اكتب اسم واحفظ.'); render();
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
  d.name=$('dname').value;
  d.widthMm=parseFloat($('dw').value)||38;
  d.heightMm=parseFloat($('dh').value)||25;
  d.halves=parseInt($('dhalves').value,10)||1;
  $('save').disabled=true;
  fetch('/design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)})
   .then(function(r){return r.json();})
   .then(function(j){
     $('save').disabled=false;
     if(j.ok){ say('✅ اتحفظ. النظام هياخده أول ما تفتح مفتاح «اعتمد تصميم البرنامج المساعد».'); load(); }
     else say('⚠️ '+j.error, true);
   })
   .catch(function(e){ $('save').disabled=false; say('مش قادر أحفظ: '+e, true); });
};
window.addEventListener('resize', function(){ if(d) draw(); });
load();
</script>
`
