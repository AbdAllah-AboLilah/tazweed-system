// اتجاه النص في الملصق — الاسم عربي والسعر إنجليزي
// ============================================================
// العطل الأصلي: اسم زي `الCopy` كان بيتطبع `لاCopy`.
// السبب إن الـcanvas بنرسم فيه وهو **مش في الصفحة**، فـ`ctx.direction`
// بترجع لـ`ltr` بدل ما تورّث `dir="rtl"` بتاع التطبيق.
//
// الفحص بيقارن الرسم الحقيقي بـ**المرجع**: canvas موجود جوه صفحة rtl
// (اللي بيورّث الاتجاه صح لوحده). لازم يطلعوا متطابقين بكسل ببكسل.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

// أسماء بتغطي الحالة المكسورة (عربي+إنجليزي) واللي كانت شغّالة
const MIXED = ['الCopy', 'الCopy — درجة 56', 'شيفون Chiffon', 'قطن 100%', 'ساده A1', 'حجاب (Copy)'];
const SAFE  = ['كريب سادة لوكس', 'طباقيه كويتى كباسين', '6221055123456', 'درجة 56'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof drawLines === 'function');

  const out = await p.evaluate(([mixed, safe]) => {
    const FONT = 'Tahoma, Arial, sans-serif';
    const W = 420, H = 48;

    // المرجع: canvas **جوه** الصفحة، فبيورّث dir="rtl" لوحده
    function reference(text) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.style.direction = 'rtl';
      document.body.appendChild(c);
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#000'; x.font = `normal 26px ${FONT}`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, W / 2, H / 2);
      const url = c.toDataURL();
      c.remove();
      return url;
    }

    // اللي الكود بيعمله فعلًا: canvas مفصول + drawLines
    function actual(text) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#000';
      drawLines(x, [text], 26, 'normal', FONT, W / 2, H / 2 - 13, 26);
      return c.toDataURL();
    }

    const names = {};
    for (const t of [...mixed, ...safe]) names[t] = actual(t) === reference(t);

    // الاتجاه بيرجع زي ما كان بعد drawLines — ده اللي بيحمي السعر
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const before = ctx.direction;
    drawLines(ctx, ['الCopy'], 26, 'normal', FONT, W / 2, 10, 26);
    const restored = ctx.direction === before;

    // والسعر نفسه: `140 L.E` لازم تفضل بالترتيب ده بعد رسم الاسم
    function priceUrl(drawNameFirst) {
      const cc = document.createElement('canvas');
      cc.width = W; cc.height = H;
      const xx = cc.getContext('2d');
      xx.fillStyle = '#fff'; xx.fillRect(0, 0, W, H);
      xx.fillStyle = '#000';
      if (drawNameFirst) drawLines(xx, ['الCopy'], 10, 'normal', FONT, W / 2, 0, 10);
      xx.direction = 'ltr';
      xx.font = `normal 26px ${FONT}`;
      xx.textAlign = 'left'; xx.textBaseline = 'middle';
      xx.fillText('140 L.E', 200, H / 2);
      return cc.toDataURL();
    }
    // نرسم السعر لوحده على canvas تاني للمقارنة (من غير الاسم فوقه)
    const priceClean = (() => {
      const cc = document.createElement('canvas');
      cc.width = W; cc.height = H;
      const xx = cc.getContext('2d');
      xx.fillStyle = '#fff'; xx.fillRect(0, 0, W, H);
      xx.fillStyle = '#000'; xx.direction = 'ltr';
      xx.font = `normal 26px ${FONT}`;
      xx.textAlign = 'left'; xx.textBaseline = 'middle';
      xx.fillText('140 L.E', 200, H / 2);
      return cc.toDataURL();
    })();

    return { names, restored, priceSafe: priceUrl(false) === priceClean };
  }, [MIXED, SAFE]);

  for (const t of MIXED) check(`اسم مخلوط بيترسم زي التطبيق: ${t}`, out.names[t], out.names[t]);
  for (const t of SAFE) check(`اسم مااتأثرش: ${t}`, out.names[t], out.names[t]);
  check('drawLines بترجّع الاتجاه زي ما كان', out.restored);
  check('السعر 140 L.E مااتقلبش', out.priceSafe);

  await b.close();

  console.log(`\n✅ نجح: ${pass.length}`);
  pass.forEach((t) => console.log('   ✓ ' + t));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    fail.forEach((t) => console.log('   ✗ ' + t));
    process.exit(1);
  }
  console.log('\nكل الفحوص نجحت.');
})();
