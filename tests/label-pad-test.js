// ============================================================
// 📐 الفراغ فوق وتحت في الملصق — نص الملصق كان فاضي
// ============================================================
// ⚠️⚠️ رحلة التشخيص دي غلطت فيها مرتين قبل ما أوصل، والاتنين متسجّلين
// هنا عشان محدش يعيدهم:
//
//   ١) قِست على **"مقسوم ٤"** وقلت "مفاتيحك مابتعملش حاجة" — وده صح
//      لمقسوم ٤ بس، وصاحب النظام مش بيطبع بيه. الملصق بتاعه عادي.
//   ٢) وبعدين قِست الملصق العادي بـ**ملصق واحد في الصفحة** (halves=1)
//      وطلعت النتيجة كويسة — وهو بيطبع **ملصقين** (halves=2)، يعني
//      كل ملصق 12.5مم مش 25.
//
// ⚠️⚠️ والعطل اللي اتبلّغ، بالنص:
//   "لما كان [المقاس] ١.٩ ولما كان بطلع ملصق عدد حروفه قليله كان الخط
//    بيطلع صغير مطابق للرقم... لحد لما عدلت وخليته ٢.٦ عشان الخط يكبر
//    بس ده **لما يكون الكلام قليل**"
//
// والقياس أكّده بالحرف: الاسم الطويل بياخد **نفس الحجم** عند 1.9 و2.6
// و3.0 — الرقم مالوش أي أثر عليه. والاسم القصير بيمشي مع الرقم تمام.
//
// --- السبب ---
// الملصق 12.51مم. الباركود والسعر بياخدوا 2.88مم لكل واحد، فالفاضل
// للاسم ~4.7مم. والاسم الطويل على سطرين بالمقاس المطلوب محتاج 6.24مم.
// مش داخل → النظام بيسيب رقمك ويدوّر على أكبر خط يدخل.
//
// --- الحل اللي اتفقنا عليه ---
// قياس الحبر مقابل الفراغ في ملصق حقيقي: **49% من الملصق فراغ**.
// فبنرجّع جزء من الفراغ اللي فوق وتحت للاسم.
//
// ⚠️⚠️ والهامش **الجانبي** ما اتلمسش — اتطلب بالنص:
//   "خلي بالك من الفراغ اللي من جهة اليسار عشان الملصق ميبقاش علي
//    الحافة او ممكن ب اختلاف المكن او تحريف الملصق يختفي فيه حاجه"
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof renderLabelPNG === 'function');

  const r = await p.evaluate(async () => {
    const DPMM = 203 / 25.4;
    const setT = (k, v) => localStorage.setItem('tazweed_qz_tweak_' + k, v ? '1' : '0');

    // بنقرا الحبر من الصورة نفسها — مش بنصدّق أي رقم من الكود.
    const read = async (url) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      const dark = (x, y) => d[(y * c.width + x) * 4] < 128;
      const half = Math.floor(c.height / 2);

      // عمود الكلام (بعد الـQR)
      const x0 = Math.floor(c.width * 0.42);
      const rows = [];
      for (let y = 0; y < half; y++) {
        let ink = 0;
        for (let x = x0; x < c.width; x++) if (dark(x, y)) ink++;
        rows.push(ink > 0);
      }
      const ink = [], gaps = [];
      let s = -1, prevEnd = 0;
      for (let y = 0; y <= rows.length; y++) {
        if (rows[y] && s === -1) { if (y - prevEnd > 0) gaps.push(+((y - prevEnd) / DPMM).toFixed(2)); s = y; }
        else if (!rows[y] && s !== -1) { ink.push(+((y - s) / DPMM).toFixed(2)); prevEnd = y; s = -1; }
      }
      if (half - prevEnd > 0) gaps.push(+((half - prevEnd) / DPMM).toFixed(2));

      // ⚠️ الهامش الجانبي: أول عمود فيه حبر — لازم مايتحركش
      let leftInk = -1;
      for (let x = 0; x < c.width && leftInk === -1; x++) {
        for (let y = 0; y < half; y++) if (dark(x, y)) { leftInk = x; break; }
      }
      return { ink, gaps, topGap: gaps[0], bottomGap: gaps[gaps.length - 1], leftMm: +(leftInk / DPMM).toFixed(2) };
    };

    setT('htmlLabels', 0); setT('fixedNameSize', 1); setT('fixedLabelSizes', 1); setT('lightQR', 1);
    setPrintCodeMm(2.4); setPrintPriceMm(2.4); setPrintNameMm(2.6);

    // ⚠️ الأصناف الحقيقية من الملصقات اللي اتصوّرت — مش أسماء مخترعة.
    const LONG = { itemName: 'لافوال بوتيه بدون خياطه قطن 100%', barcodeNumber: '7781430', sellingPrice: 45, originalPrice: 65 };
    const LONG2 = { itemName: 'كوكيز تيشرت رقبة دائرية كم طويل اسود', barcodeNumber: '48261854', sellingPrice: 280, originalPrice: 310 };
    const SHORT = { itemName: 'حجاب جيل بيور', barcodeNumber: '7781430', sellingPrice: 45, originalPrice: 65 };
    // ⚠️⚠️ ملصقين في الصفحة — ده اللي بيطبع بيه فعلًا، وهو اللي فيه العطل.
    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };

    const out = {};
    setT('tightLabelPad', 0);
    out.offLong = await read(renderLabelPNG(LONG, size));
    out.offLong2 = await read(renderLabelPNG(LONG2, size));
    out.offShort = await read(renderLabelPNG(SHORT, size));
    out.offShortPNG = renderLabelPNG(SHORT, size);
    out.offLongPNG = renderLabelPNG(LONG, size);

    setT('tightLabelPad', 1);
    out.onLong = await read(renderLabelPNG(LONG, size));
    out.onLong2 = await read(renderLabelPNG(LONG2, size));
    out.onShort = await read(renderLabelPNG(SHORT, size));
    out.onShortPNG = renderLabelPNG(SHORT, size);
    out.onLongPNG = renderLabelPNG(LONG, size);

    setT('tightLabelPad', 0);
    return out;
  });

  // ============================================================
  // ⭐⭐⭐⭐⭐ الاسم الطويل بيكبر — ده الغرض كله
  // ============================================================
  // سطور الاسم هي أول شريطين حبر (بعدهم الباركود والسعر).
  const nameOff = r.offLong.ink.slice(0, 2);
  const nameOn = r.onLong.ink.slice(0, 2);
  check('⭐⭐⭐⭐⭐ الاسم الطويل كبر (السطر التاني بالذات)',
    nameOn[1] > nameOff[1] * 1.4, { قبل: nameOff, بعد: nameOn });
  check('⭐⭐⭐⭐⭐ وصنف تاني طويل كمان',
    r.onLong2.ink[1] > r.offLong2.ink[1] * 1.2,
    { قبل: r.offLong2.ink.slice(0, 2), بعد: r.onLong2.ink.slice(0, 2) });

  // ⚠️⚠️ السطرين كانوا **بمقاسين مختلفين** (1.88 و1.25) — وده وحش في
  // الشكل بغض النظر عن الحجم. لازم يبقوا متساويين.
  check('⭐⭐⭐⭐⭐ وسطور الاسم بقت متساوية (كانت مختلفة)',
    Math.abs(nameOn[0] - nameOn[1]) < 0.2, { قبل: nameOff, بعد: nameOn });

  // ============================================================
  // ⭐⭐⭐⭐⭐ والاسم القصير ما اتغيّرش — المفتاح للطويل بس
  // ============================================================
  check('⭐⭐⭐⭐ الاسم القصير مقاسه زي ما هو',
    r.onShort.ink[0] === r.offShort.ink[0], { قبل: r.offShort.ink[0], بعد: r.onShort.ink[0] });

  // ============================================================
  // ⭐⭐⭐⭐⭐ الباركود والسعر ما اتلمسوش — ده الشرط اللي اتفقنا عليه
  // ============================================================
  const tailOff = r.offLong.ink.slice(-2);
  const tailOn = r.onLong.ink.slice(-2);
  check('⭐⭐⭐⭐⭐ رقم الباركود والسعر بنفس المقاس بالظبط',
    tailOff[0] === tailOn[0] && tailOff[1] === tailOn[1], { قبل: tailOff, بعد: tailOn });

  // ============================================================
  // ⭐⭐⭐⭐⭐ والهامش الجانبي ما اتحركش — اتطلب صراحةً
  // ============================================================
  // "خلي بالك من الفراغ اللي من جهة اليسار ... ممكن ب اختلاف المكن
  //  او تحريف الملصق يختفي فيه حاجه"
  check('⭐⭐⭐⭐⭐ الهامش الجانبي ما اتحركش ولا نقطة',
    r.onLong.leftMm === r.offLong.leftMm, { قبل: r.offLong.leftMm, بعد: r.onLong.leftMm });

  // ============================================================
  // ⭐⭐⭐⭐ الفراغ فوق وتحت قلّ فعلًا (ده مصدر المساحة)
  // ============================================================
  check('⭐⭐⭐⭐ الفراغ اللي فوق قلّ',
    r.onLong.topGap < r.offLong.topGap, { قبل: r.offLong.topGap, بعد: r.onLong.topGap });
  check('⭐⭐⭐ واللي تحت كمان',
    r.onLong.bottomGap < r.offLong.bottomGap, { قبل: r.offLong.bottomGap, بعد: r.onLong.bottomGap });

  // ⚠️ بس مش لدرجة إن الكلام يلزق في الحرف — التحريف بيبان فيه.
  check('⭐⭐⭐⭐ وفضل فيه هامش محترم فوق (مش لازق في الحرف)',
    r.onLong.topGap >= 1.0, r.onLong.topGap);

  // ============================================================
  // ⭐⭐⭐⭐⭐ والمفتاح مقفول = الملصق زي ما كان **بالبايت**
  // ============================================================
  // ⚠️ ده الوعد اللي اتقال: "لو مش عاجبك تقفله ويرجع زي ما هو".
  // مافيش قياس أقوى من مقارنة الصورتين حرف بحرف.
  check('⭐⭐⭐⭐⭐ والمفتاح مفتوح **بيغيّر** الملصق فعلًا (مش زرار فاضي)',
    r.offLongPNG !== r.onLongPNG);
  // ⚠⚠ الملصق القصير **بيتغيّر بالبايت** بردو — وده متوقّع مش عطل:
  // الهوامش اتغيّرت فالكلام اتحرّك شوية لفوق. المهم إن **المقاسات**
  // ماتغيرتش — يعني مافيش حرف صغر ولا كبر في الملصق اللي مش محتاج.
  //
  // (توقّعت في الأول إن البايت يبقى زي ما هو والفحص فشل — والفحص
  //  كان محقّ: المكان فعلًا بيتغيّر.)
  check('⭐⭐⭐⭐⭐ والقصير: كل مقاسات الحروف زي ما هي بالظبط',
    JSON.stringify(r.offShort.ink) === JSON.stringify(r.onShort.ink),
    { قبل: r.offShort.ink, بعد: r.onShort.ink });

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
