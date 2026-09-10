// ============================================================
// 🖨️ قايمة الطابعات ونسخة البرنامج المساعد
// ============================================================
// اتطلب بالنص: "عاوز اشوف رقم اصدار المساعد في الاعدات وممكن اسيب qz
// احتياطي عشان لو حصل اي مشكلة في المستقبل يبقي حاجه في الخلفيه".
//
// ⚠️⚠️ الحاجة اللي كانت بتمنع شيل QZ مش الخانة الفاضية بس: شاشة
// الإعدادات **كلها** كانت بتقف لو QZ مالقاش طابعات —
//     if (!isQZAvailable() || printers.length === 0) { ...; return; }
// يعني الجهاز اللي شال QZ مكانش يقدر يوصل حتى للمفاتيح المتقدمة.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

// ⚠️ حارس على الشرط اللي كان بيقفل الشاشة. لو حد رجّعه، الفحص ده
// بيمسكها من غير ما نحتاج نفتح متصفح.
const core = fs.readFileSync(path.join(root, 'js/print-core.js'), 'utf8');
check('⭐⭐⭐⭐ شاشة الإعدادات مابقتش بتقف على QZ لوحده',
  core.indexOf('!isQZAvailable() || printers.length === 0') === -1);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof getAvailablePrinters === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };

    // بنقلّد البرنامج المساعد والـQZ كل واحد لوحده، عشان نتأكد إن كل
    // مصدر بيشتغل من غير التاني — دي جوهر "QZ احتياطي".
    const realFetch = window.fetch;
    let helperOn = true;
    window.fetch = async (u) => {
      if (String(u).indexOf('/status') !== -1) {
        if (!helperOn) throw new Error('مش شغّال');
        return {
          ok: true,
          json: async () => ({ app: 'tazweed-helper', version: '1.5.0', printers: ['XP-235B', 'XP-80C'] }),
        };
      }
      return realFetch(u);
    };

    let qzList = ['XP-80C', 'Microsoft Print to PDF'];
    let qzOn = true;
    window.getAvailableQZPrinters = async () => (qzOn ? qzList : []);
    const reset = () => { helperCache = null; };

    // ---------- الاتنين شغّالين → دمج من غير تكرار ----------
    // ⚠️ XP-80C موجودة عند الاتنين، فلازم تظهر **مرة واحدة**.
    reset(); helperOn = true; qzOn = true;
    const both = await getAvailablePrinters();
    out.both = both.printers;
    out.bothFromHelper = both.fromHelper;
    out.bothFromQZ = both.fromQZ;

    // ---------- المساعد بس (السيناريو بعد شيل QZ) ----------
    reset(); helperOn = true; qzOn = false;
    out.helperOnly = (await getAvailablePrinters()).printers;

    // ---------- QZ بس (السيناريو الاحتياطي) ----------
    reset(); helperOn = false; qzOn = true;
    out.qzOnly = (await getAvailablePrinters()).printers;

    // ---------- ولا واحد ----------
    reset(); helperOn = false; qzOn = false;
    out.none = (await getAvailablePrinters()).printers;

    // ---------- نسخة المساعد ----------
    reset(); helperOn = true;
    out.ver = await readHelperVersion();
    reset(); helperOn = false;
    // ⚠️ بترجّع فاضي بدل ما ترمي — الرقم معلومة على الشاشة، عمره ما
    // يوقف فتح النافذة.
    out.verOff = await readHelperVersion();

    window.fetch = realFetch;
    return out;
  });

  check('⭐⭐⭐⭐⭐ الاتنين شغّالين → القايمة مدموجة من غير تكرار',
    JSON.stringify(r.both) === JSON.stringify(['XP-235B', 'XP-80C', 'Microsoft Print to PDF']), r.both);
  check('⭐⭐⭐ وبيقول كام واحدة من كل مصدر', r.bothFromHelper === 2 && r.bothFromQZ === 1,
    { helper: r.bothFromHelper, qz: r.bothFromQZ });
  check('⭐⭐⭐ وترتيب المساعد الأول (هو اللي بيطبع فعلًا)',
    r.both[0] === 'XP-235B', r.both[0]);

  check('⭐⭐⭐⭐⭐ QZ مقفول → القايمة لسه شغّالة من المساعد لوحده',
    JSON.stringify(r.helperOnly) === JSON.stringify(['XP-235B', 'XP-80C']), r.helperOnly);
  check('⭐⭐⭐⭐ والمساعد مقفول → QZ بيشتغل احتياطي',
    JSON.stringify(r.qzOnly) === JSON.stringify(['XP-80C', 'Microsoft Print to PDF']), r.qzOnly);
  check('⭐⭐⭐ ولا واحد → قايمة فاضية من غير ما ترمي', Array.isArray(r.none) && r.none.length === 0, r.none);

  check('⭐⭐⭐⭐ نسخة المساعد بتتقرا', r.ver === '1.5.0', r.ver);
  check('⭐⭐⭐ ولو مش شغّال بترجّع فاضي مش خطأ', r.verOff === '', r.verOff);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
