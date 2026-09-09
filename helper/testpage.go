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
 <label>الطابعة</label><select id="p"></select>
 <label>طول الورقة التجريبية (مم)</label><input id="mm" type="number" value="250" min="20" max="1000">
 <button id="go">اطبع ورقة تجربة</button>
 <div id="out"></div>
</div>
<script>
const out=document.getElementById('out'),sel=document.getElementById('p'),go=document.getElementById('go');
const say=(t,c)=>{out.textContent=t;out.className=c||''};
fetch('/status').then(r=>r.json()).then(s=>{
  sel.innerHTML=(s.printers||[]).map(n=>'<option>'+n+'</option>').join('')||'<option value="">مالقيتش طابعات</option>';
  say('نسخة '+s.version+' — '+(s.printers||[]).length+' طابعة');
}).catch(e=>say('مش قادر أقرا الحالة: '+e,'bad'));
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
</script></html>`
