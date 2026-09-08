// ورقة التزويد كصورة — والجهاز مشغول
// ============================================================
// اتطلب بالنص: "عاوزك تتاكد ان الورقة هتطلع سليمه وكامله تحت اي ظرف،
// مش مقصوصه، سواء الجهاز في شغل تاني ولا لا".
//
// ⚠️⚠️ ليه الفحص ده موجود لوحده: العطل الحقيقي (الورقة بتتقص) حصل على
// **كمبيوتر الكاشير وهو شغّال**، ومحصلش ولا مرة على جهاز فاضي. وفحص
// sheet-cut-test بيشتغل على جهاز فاضي — فهو بيثبت إن الحارس بيمسك
// القياس الكذّاب، **مش** إن القياس بقى صح تحت الضغط.
//
// فالفحص ده بيخنق المعالج فعليًا (CPU throttling عن طريق CDP) ويشغّل
// حاجة تقيلة على نفس الخيط، وبعدين يطبع ويقارن.
//
// ⚠️⚠️ ونتيجة سلبية مهمة اتسجّلت هنا بدل ما نخبّيها:
// شغّلنا **الطريقة القديمة** (انتظار 60 مللي ثابتة) تحت نفس الضغط —
// وقاست **صح** في الحالتين (خنق ×6 و×20). يعني نظرية "القياس بيحصل
// بدري على الجهاز المشغول" **مش مثبتة**، والسبب الحقيقي لسه مش معروف.
// (document.write + close بيجبروا كروم يرتّب الصفحة فورًا.)
//
// عشان كده الإصلاح مابيعتمدش على معرفة السبب: بنرسم بمساحة زيادة
// ونقص عند آخر حبر فعلي، فمهما كان مصدر الاختلاف، اللي اترسم بيوصل
// كامل — أو الورقة ترجع للطريقة العادية. الفحص ده بيتأكد إن ده صحيح
// **تحت الضغط** كمان.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

const SHEET_GRADES = 245;   // ورقة حقيقية كبيرة (306مم)

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof renderSheetImage === 'function');

  // الطول المرجعي والجهاز فاضي
  const ref = await p.evaluate(async (n) => {
    const cat = { id: 'c', name: 'ورقة العروض', minQty: 3, colorGroups: [] };
    const grades = [];
    for (let i = 1; i <= n; i++) grades.push({ id: 'g' + i, number: String(i), branchQty: 5, mainQty: 2, status: 'normal' });
    window.__sheetHTML = buildRestockHTML(cat, grades, '', true, '');
    const shot = await renderSheetImage(window.__sheetHTML);
    return shot ? shot.heightMm : null;
  }, SHEET_GRADES);

  check('⭐ الورقة المرجعية اترسمت', ref !== null, ref);

  // ============================================================
  // نخنق المعالج — نفس حال كمبيوتر الكاشير وهو شغّال
  // ============================================================
  const cdp = await p.context().newCDPSession(p);
  const results = {};
  for (const rate of [6, 20]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    results[rate] = await p.evaluate(async () => {
      // وكمان شغل تقيل على نفس الخيط أثناء الرسم — عشان الترتيب
      // مايلحقش يخلص لو مستنيناش صح
      let stop = false;
      const hog = () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 40) { Math.sqrt(Math.random()); }
        if (!stop) setTimeout(hog, 0);
      };
      hog();
      try {
        const now = await renderSheetImage(window.__sheetHTML);

        // ⚠️⚠️ نفس الورقة بالطريقة **القديمة** (انتظار 60 مللي ثابتة)
        // تحت نفس الضغط — عشان نشوف الفرق بعينينا.
        const MM_PX = 96 / 25.4, cssW = Math.round(SHEET_PRINTABLE_MM * MM_PX);
        const fr = document.createElement('iframe');
        fr.style.cssText = `position:fixed;left:-99999px;top:0;width:${cssW}px;height:100px;border:0;`;
        document.body.appendChild(fr);
        const d = fr.contentDocument;
        d.open(); d.write(window.__sheetHTML); d.close();
        await new Promise((r) => setTimeout(r, 60));
        const oldCssH = Math.ceil(d.body.scrollHeight);
        // والطول الحقيقي بعد ما كل حاجة تخلص
        await new Promise((r) => setTimeout(r, 1200));
        const trueCssH = Math.ceil(d.body.scrollHeight);
        fr.remove();
        return { newMm: now ? now.heightMm : null, oldCssH, trueCssH };
      } finally {
        stop = true;
      }
    });
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  for (const rate of [6, 20]) {
    const r = results[rate];
    const tag = `خنق ×${rate}`;
    check(`⭐⭐⭐ (${tag}) الورقة طلعت **بنفس الطول** المرجعي`,
      r.newMm !== null && Math.abs(r.newMm - ref) < 1, { جديد: r.newMm, مرجعي: ref });
    // ⚠️ ولو حصل أي قص، لازم ترجع null (طريقة عادية) — مش طول ناقص
    check(`⚠️ (${tag}) وماطلعتش بطول ناقص`,
      r.newMm === null || r.newMm >= ref - 1, { جديد: r.newMm, مرجعي: ref });
    console.log(`      [${tag}] القديمة قاست ${r.oldCssH} والحقيقي ${r.trueCssH}` +
      (r.oldCssH < r.trueCssH ? `  ← القديمة كانت هتقص ${((1 - r.oldCssH / r.trueCssH) * 100).toFixed(0)}%` : '  (القديمة لحقت)'));
  }

  // ============================================================
  // ⚠️⚠️ نتيجة سلبية بتتسجّل، مابتتخبّاش
  // ============================================================
  // لو القياس القديم طلع صح تحت الضغط، يبقى الضغط **مش** سبب العطل —
  // وده اللي حصل. بنكتبه في الخرج عشان اللي ييجي بعدينا مايضيّعش وقت
  // في نفس النظرية، ومابنحوّلهوش لفحص فاشل لأنه مش عطل.
  const oldWouldCut = [6, 20].some((r) => results[r].oldCssH < results[r].trueCssH);
  console.log(oldWouldCut
    ? '      ⚠️ الطريقة القديمة اتقصت تحت الضغط — الضغط سبب معتبر'
    : '      ℹ️ الطريقة القديمة قاست صح تحت الضغط — يعني الضغط **مش** سبب العطل، والسبب لسه مش معروف');

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
