// ============================================================
// 🖨️ إطار القياس مايطبعش — الورقة جوّاها أمر طباعة تلقائي
// ============================================================
// ⚠️⚠️ العطل اللي بيتحل، اتبلّغ بالنص وبأوضح صيغة لحد دلوقتي:
//   "لو انا مش مخلي النظام في الخلفيه الورقة بتطبع عادي انما لما يبقي
//    في الخلفيه وافتح برنامج تاني لازم بيجي امر معاينة ل جهاز الكمبيوتر"
//
// وكارت الجهاز في نفس اللحظة بيقول "✅ اتطبعت من البرنامج المساعد" —
// يعني الطبعة نجحت والمعاينة ظهرت **مع بعض**.
//
// --- السبب ---
// buildRestockHTML بتحط في الورقة سطر:
//     window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }
// وده **مقصود**: الورقة لما تتفتح في نافذة متصفح لازم تطبع لوحدها.
//
// بس renderSheetImage بتكتب **نفس الورقة دي** في إطار مخفي عشان تقيس
// طولها. فالسطر بيشتغل جوّه الإطار ويفتح نافذة طباعة الويندوز.
//
// --- وليه الخلفية بالذات ---
//   • النافذة قدامك → القياس بيخلص في ~80 مللي، والإطار بيتشال **قبل**
//     الـ300 مللي. الأمر عمره ما بيشتغل.
//   • النافذة ورا برنامج تاني → المتصفح بيبطّئ كل المؤقتات لثانية
//     تقريبًا، فالقياس بياخد ثواني والإطار بيعيش لبعد الـ300.
//
// ⚠️⚠️ وإصلاح v0.89.0 (النافذة المخفية) هو اللي خلّى العطل ده **يبان
// كل مرة**: قبله القياس كان بيتعلّق خالص فمافيش دور للأمر ده أصلًا.
// يعني إصلاح صح كشف عطل كان مستخبي وراه.
//
// ⚠️ وشيل الـ<script> بعد القياس **مش كفاية**: السطر بيكون اشتغل وسجّل
// نفسه على onload من ساعة doc.write. شيل العنصر مابيلغيش التسجيل.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

// ⚠️ حارس على وجود السطر نفسه: لو اتشال من الورقة، الطباعة من نافذة
// المتصفح بتقف — فالفحص ده بيتأكد إنه **موجود**، وتحت بيتأكد إنه
// **مايشتغلش في إطار القياس**. الاتنين مطلوبين مع بعض.
const restock = fs.readFileSync(path.join(root, 'js/print-restock.js'), 'utf8');
check('⭐⭐ أمر الطباعة التلقائي لسه في الورقة (الطباعة من المتصفح محتاجاه)',
  /window\.print\(\)/.test(restock));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof renderSheetImage === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    // ورقة فيها **نفس** السطر اللي في ورقة التزويد الحقيقية، ومعاه
    // علامة بترفع إيدها لو السكربت اشتغل.
    const sheet = (rows) => {
      let body = '';
      for (let i = 1; i <= rows; i++) {
        body += `<div style="font-size:13px;padding:2px 0;border-bottom:1px solid #000">صنف ${i}</div>`;
      }
      return `<html><head><meta charset="utf-8"><style>body{width:72.1mm;margin:0;font-family:sans-serif}</style></head><body>${body}
        <script>window.parent.__ranInFrame = true; window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
      </body></html>`;
    };

    const realRAF = window.requestAnimationFrame;
    const run = async (raf) => {
      window.__ranInFrame = false;
      window.requestAnimationFrame = raf;
      const res = await renderSheetImage(sheet(120));
      window.requestAnimationFrame = realRAF;
      // ⚠️ بنستنى بعد الرسم: مؤقّت السكربت 300 مللي، فلو خرجنا على طول
      // الفحص هيعدّي حتى لو السكربت اشتغل.
      await new Promise((r2) => setTimeout(r2, 800));
      return { drew: !!(res && res.image), ran: window.__ranInFrame === true };
    };

    out.front = await run(realRAF);
    // نافذة ورا برنامج تاني: مؤقّت كل ثانية
    out.background = await run((cb) => setTimeout(() => cb(performance.now()), 1000));
    // نافذة مخفية تمامًا: الإطارات واقفة
    out.hidden = await run(() => 0);

    window.requestAnimationFrame = realRAF;
    return out;
  });

  // ============================================================
  // ⭐⭐⭐⭐⭐ السكربت مايشتغلش — في **كل** الحالات
  // ============================================================
  check('⭐⭐⭐⭐⭐ النافذة قدامك: أمر الطباعة مااشتغلش في إطار القياس',
    r.front.ran === false, r.front);
  check('⭐⭐⭐⭐⭐ والنافذة في الخلفية كمان (دي الحالة اللي اتبلّغت)',
    r.background.ran === false, r.background);
  check('⭐⭐⭐⭐⭐ والنافذة المخفية تمامًا',
    r.hidden.ran === false, r.hidden);

  // ⚠️ ومنع السكربت مايمنعش القياس: الورقة لازم تفضل بترسم.
  check('⭐⭐⭐⭐ والورقة لسه بترسم في التلات حالات',
    r.front.drew && r.background.drew && r.hidden.drew,
    { front: r.front.drew, bg: r.background.drew, hidden: r.hidden.drew });

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
