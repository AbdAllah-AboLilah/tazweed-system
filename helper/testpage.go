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
 body{font-family:system-ui,Segoe UI,sans-serif;background:#f4f5f7;margin:0;padding:20px;color:#1c2024}
 .card{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
 h1{font-size:19px;margin:0 0 4px} .sub{color:#666;font-size:13px;margin-bottom:18px}
 label{display:block;font-size:13px;margin:14px 0 6px;font-weight:500}
 select,input{width:100%;padding:9px;border:1px solid #ccd;border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box}
 button{width:100%;margin-top:16px;padding:12px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:15px;font-weight:500;cursor:pointer;font-family:inherit}
 button:disabled{background:#9ab}
 #out{margin-top:14px;font-size:13.5px;line-height:1.8;white-space:pre-wrap}
 .ok{color:#0a6b2e} .bad{color:#b02020}
</style>
<div class="card">
 <h1>&#127374; مساعد التزويد</h1>
 <div class="sub">صفحة تجربة — بتطبع ورقة على الطابعة مباشرة من غير ما تعدّي على تعريف الويندوز.</div>
 <label>طابعة ورقة التزويد</label><select id="p"></select>
 <label>طابعة الملصق</label><select id="l"></select>
 <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:14px;font-weight:400">
   <input type="checkbox" id="auto" style="width:auto;margin:0"> يشتغل لوحده مع الويندوز (في الخلفية، من غير ما يفتح الصفحة)
 </label>
 <button id="save" style="background:#0a6b2e;margin-top:12px">احفظ اختيار الطابعتين</button>
 <div id="sout" style="margin-top:8px;font-size:13px"></div>
 <hr style="margin:18px 0;border:0;border-top:1px solid #e5e7eb">
 <label>طول الورقة التجريبية (مم)</label><input id="mm" type="number" value="250" min="20" max="1000">
 <button id="go">اطبع ورقة تجربة</button>
 <button id="up" style="background:#475569;margin-top:10px">شوف لو فيه تحديث</button>
 <div id="out"></div>
 <div id="uout" style="margin-top:10px;font-size:13.5px;line-height:1.8"></div>
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
  document.getElementById('auto').checked=!!s.autostart;
  say('نسخة '+s.version+' — '+(s.printers||[]).length+' طابعة');
}).catch(e=>say('مش قادر أقرا الحالة: '+e,'bad'));

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

document.getElementById('save').onclick=async()=>{
  sout.textContent='بيحفظ...'; sout.className='';
  try{
    const r=await (await fetch('/settings',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({restockPrinter:sel.value,labelPrinter:lsel.value})})).json();
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
            ? '\u2705 اتحدّث. البرنامج بيقفل ويفتح تاني — استنى ثانيتين واعمل ريفريش للصفحة.'
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
