// ورقة التزويد كصورة: القص الصامت من تحت
// ============================================================
// العطل اللي اتبلّغ: "ورقة التزويد بقيت بتتقص قبل م تكمل كلها — في
// حاجات في الورقة مش بتخرج". والمعاينة كانت **كاملة**، يعني الخلل بعد
// بناء الورقة، جوه تحويلها لصورة.
//
// سببين، والاتنين في الكود عندنا:
//
//   1) الطول كان بيتقاس بعد `setTimeout(60)` **ثابتة**. كفاية على جهاز
//      فاضي، مش كفاية على جهاز مشغول — والقياس الناقص بيرسم صورة ناقصة.
//      الإصلاح: نستنى الرقم **يثبت** على مدار كذا إطار رسم بدل وقت
//      محدد، ونستنى الخطوط تحمّل.
//
//   2) شبكة الأمان كانت بتبص على **أول 400 صف بس**. فورقة أولها سليم
//      وآخرها ضايع كانت **بتعدّي وتتطبع مقطوعة**. الإصلاح: نشوف آخر صف
//      فيه حبر، ولو الآخر فاضي نرجع للطريقة العادية بدل ما نحرق ورق.
//
// ⚠️⚠️ الفحص ده **بيصطنع القص** عن قصد (بيخلي القياس يكدب) ويتأكد إن
// الورقة بتطلع كاملة برضه — مش بيتأكد إنها بتطلع كاملة وبس.
//
// ⚠️⚠️ **حتة الفحص ده مش بيغطيها، وقولناها بدل ما نوهم نفسنا:**
// إصلاح الانتظار (settledSheetHeight) **مش متغطّي بفحص** — لأن جهاز
// الفحص فاضي، فأول قراية بتطلع صح وشيل الانتظار كله بيعدّي. جرّبنا
// التخريب ده والفحص عدّى.
// اللي متغطّى فعلًا هو **النتيجة**: مهما كان القياس غلط (نص الطول،
// 85%، آخر الصورة فاضي)، الورقة يا تطلع كاملة يا ترجع للطريقة العادية —
// عمرها ما تتطبع مقصوصة. وده الحارس اللي بيحمي الورق.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() =>
    typeof renderSheetImage === 'function' && typeof sheetLastInkRow === 'function' &&
    typeof settledSheetHeight === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const sheet = (n) => {
      const cat = { id: 'c', name: 'ورقة العروض', minQty: 3, colorGroups: [] };
      const grades = [];
      for (let i = 1; i <= n; i++) grades.push({ id: 'g' + i, number: String(i), branchQty: 5, mainQty: 2, status: 'normal' });
      return buildRestockHTML(cat, grades, '', true, '');
    };

    // ---------- 1) الورقة السليمة بتعدّي ----------
    const good = await renderSheetImage(sheet(180));
    out.goodOk = !!good;
    out.goodMm = good ? good.heightMm : 0;

    // ---------- 2) كاشف آخر الحبر ----------
    const mk = (h, inkTo) => {
      const cv = document.createElement('canvas');
      cv.width = 576; cv.height = h;
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.fillStyle = '#000';
      for (let y = 0; y < inkTo; y += 10) cx.fillRect(20, y, 200, 3);
      return cx;
    };
    out.inkFull = sheetLastInkRow(mk(1000, 998), 576, 1000);
    out.inkCut = sheetLastInkRow(mk(1000, 500), 576, 1000);   // الآخر فاضي
    out.inkBlank = sheetLastInkRow(mk(1000, 0), 576, 1000);   // كلها بيضا
    // ⚠️ وبيشتغل صح لما الحبر في شريحة بعيدة (بنقرا على شرائح 256)
    out.inkDeep = sheetLastInkRow(mk(2000, 300), 576, 2000);

    // ---------- 3) ⚠️⚠️ نصطنع القص ونتأكد إن النظام بيرفضه ----------
    // بنخلي القياس يرجّع **نص** الطول الحقيقي — بالظبط اللي بيحصل لما
    // الصفحة ماتكونش اتظبطت لسه. المفروض النظام يرفض الصورة ويرجّع null.
    // ⚠️⚠️ ملاحظة مهمة اكتشفها الفحص ده نفسه: القياس الأقصر **مابيسيبش
    // فراغ أبيض** — بيقص المحتوى، فالصورة بتطلع مليانة حبر. يعني حارس
    // "آخر الصورة فاضي" مابيمسكش الحالة دي خالص. اللي بيمسكها هو
    // **القياس التاني المستقل** (sheetContentBottom).
    const realSettle = window.settledSheetHeight;
    const heightOf = async (factor) => {
      window.settledSheetHeight = async (doc) => Math.floor((await realSettle(doc)) * factor);
      const shot = await renderSheetImage(sheet(180));
      window.settledSheetHeight = realSettle;
      return shot ? shot.heightMm : null;
    };
    out.trueMm = out.goodMm;
    out.halfMm = await heightOf(0.5);
    out.mostMm = await heightOf(0.85);

    // ---------- 3ب) لو الرسم طلّع آخر الصورة فاضي → ترفض ----------
    // بنخلي الكاشف يقول "مفيش حبر في الآخر" ونتأكد إن الورقة بترجع
    // للطريقة العادية بدل ما تتطبع ناقصة.
    const realInk = window.sheetLastInkRow;
    window.sheetLastInkRow = () => -1;
    out.blankBottomRejected = (await renderSheetImage(sheet(180))) === null;
    window.sheetLastInkRow = (cx, w, h) => Math.floor(h * 0.4);   // آخر 60% فاضي
    out.halfBlankRejected = (await renderSheetImage(sheet(180))) === null;
    window.sheetLastInkRow = realInk;

    // ---------- 4) القياس بيثبت على القيمة الصح ----------
    const MM_PX = 96 / 25.4, cssW = Math.round(SHEET_PRINTABLE_MM * MM_PX);
    const fr = document.createElement('iframe');
    fr.style.cssText = `position:fixed;left:-99999px;top:0;width:${cssW}px;height:100px;border:0;`;
    document.body.appendChild(fr);
    const d = fr.contentDocument;
    d.open(); d.write(sheet(245)); d.close();
    const settled = await settledSheetHeight(d);
    const rows = [...d.querySelectorAll('.row')];
    const trueBottom = rows.length ? Math.ceil(rows[rows.length - 1].getBoundingClientRect().bottom) : 0;
    fr.remove();
    out.settled = settled;
    out.trueBottom = trueBottom;

    return out;
  });

  check('⭐ الورقة السليمة بتتحوّل صورة عادي', r.goodOk, r.goodMm);
  check('⭐ وطولها معقول (226مم لـ180 درجة)', r.goodMm > 200 && r.goodMm < 250, r.goodMm);

  check('⭐ كاشف الحبر بيلاقي آخر صف', r.inkFull >= 990, r.inkFull);
  check('⭐⭐ وبيكشف الصورة المقطوعة من تحت', r.inkCut > 480 && r.inkCut < 520, r.inkCut);
  check('⭐ والصورة الفاضية بترجّع -1', r.inkBlank === -1, r.inkBlank);
  check('⚠️ وبيعدّي الشرائح لحد ما يلاقي الحبر البعيد', r.inkDeep > 280 && r.inkDeep < 310, r.inkDeep);

  // ⭐⭐⭐ الحارس الحقيقي: القياس يكدب بالنص → الورقة تطلع **كاملة برضه**
  check('⭐⭐⭐ القياس يقول نص الطول → الورقة تطلع كاملة (القياس التاني بينقذها)',
    r.halfMm !== null && Math.abs(r.halfMm - r.trueMm) < 1, { غلط: r.halfMm, صح: r.trueMm });
  check('⭐⭐ والقياس يقول 85% → برضه كاملة',
    r.mostMm !== null && Math.abs(r.mostMm - r.trueMm) < 1, { غلط: r.mostMm, صح: r.trueMm });

  check('⭐⭐ آخر الصورة فاضي → ترفض وترجع للطريقة العادية', r.blankBottomRejected);
  check('⭐⭐ وآخر 60% فاضي → ترفض كمان', r.halfBlankRejected);

  check('⭐⭐ القياس بيثبت على الطول الصح', r.settled >= r.trueBottom,
    { settled: r.settled, trueBottom: r.trueBottom });
  check('⚠️ ومش بيزوّد أكتر من اللازم', r.settled - r.trueBottom < 100,
    { settled: r.settled, trueBottom: r.trueBottom });

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
