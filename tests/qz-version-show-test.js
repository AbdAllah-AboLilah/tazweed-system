// رقم نسخة QZ Tray — بيتنشر ويتشاف من التليفون
// ============================================================
// اتطلب بالنص: "ممكن نعمل النظام يطلب من qz رقم الاصدار بتاعه ويكتبه
// في النظام في اعدادات الطابعة واشوف من التليفون واقولك رقم الاصدار كام".
//
// ⚠️⚠️ والسبب اللي خلّاه مطلوب مهم يتكتب: إحنا بنشخّص عطل قص ورقة
// التزويد من كذا يوم، **وكل تشخيص اتبنى على تخمين نسخة كل جهاز طلع
// غلط**. صاحب النظام قال "النسخ على الأجهزة واحدة" — وإحنا مش شايفين
// أجهزته. الرقم ده بيشيل التخمين من النص.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof readQZVersion === 'function' && typeof stationCardHTML === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const realQz = window.qz;

    // ---------- القراءة من QZ ----------
    window.qz = { api: { getVersion: () => Promise.resolve('2.2.6') } };
    out.reads = await readQZVersion();
    window.qz = { api: { getVersion: () => Promise.reject(new Error('boom')) } };
    out.onError = await readQZVersion();          // ⚠️ الفشل مايكسرش
    window.qz = {};                                // QZ قديم مالوش api
    out.noApi = await readQZVersion();
    window.qz = { api: { getVersion: () => Promise.resolve(null) } };
    out.nullVer = await readQZVersion();
    window.qz = realQz;

    // ---------- العرض في تاب الأجهزة (اللي بيتشاف من التليفون) ----------
    state.user = { uid: 'me' };
    state.profile = { name: 'x', role: 'owner' };
    const mk = (qzVersion) => ({
      id: 'd1', deviceName: 'Cash2', labelPrinter: 'XP-235B', restockPrinter: 'XP-80C',
      printers: ['XP-80C'], appVersion: '0.77.5', qzVersion,
      printSetup: { batch: 50, lead: 5, pace: 420, tweaks: {}, align: {} },
      lastSeen: { toDate: () => new Date() },
    });
    out.newHtml = stationCardHTML(mk('2.2.6'));
    out.oldHtml = stationCardHTML(mk('2.2.4'));
    out.noneHtml = stationCardHTML(mk(''));
    return out;
  });

  check('⭐ بيقرا النسخة من QZ', r.reads === '2.2.6', r.reads);
  check('⚠️ والفشل بيرجّع فاضي مش بيكسر', r.onError === '', r.onError);
  check('⚠️ وQZ قديم مالوش api → فاضي', r.noApi === '', r.noApi);
  check('⚠️ وقيمة فاضية → نص فاضي مش "null"', r.nullVer === '', r.nullVer);

  check('⭐⭐⭐ الرقم بيبان في تاب الأجهزة (من التليفون)',
    r.newHtml.indexOf('نسخة QZ Tray') !== -1 && r.newHtml.indexOf('2.2.6') !== -1);
  check('⭐⭐ والنسخة القديمة عليها علامة تحذير',
    r.oldHtml.indexOf('2.2.4') !== -1 && r.oldHtml.indexOf('أقدم من 2.2.6') !== -1);
  check('⚠️ والحديثة من غير تحذير',
    r.newHtml.indexOf('أقدم من 2.2.6') === -1);
  check('⚠️ ومش معروفة → شرطة، من غير تحذير كاذب',
    r.noneHtml.indexOf('نسخة QZ Tray') !== -1 && r.noneHtml.indexOf('أقدم من 2.2.6') === -1);
  check('⚠️ ونسخة النظام لسه بتبان جنبها', r.newHtml.indexOf('0.77.5') !== -1);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
