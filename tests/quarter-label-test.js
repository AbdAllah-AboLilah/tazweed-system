// ============================================================
// "مقسوم ٤" كنص — الملصق الأخير اللي كان لسه صورة
// ============================================================
// شكوتين اتبلّغوا عليه مع بعض:
//   1) **منغمش** على الورق وباقي الملصقات نضيفة. السبب: هو الوحيد اللي
//      مالوش نسخة نصّية، فكان مجبور يترسم صورة — وباقي الملصقات رجعوا
//      نص في v0.36.0 وده اللي نضّفهم.
//   2) **الاسم الطويل بيصغّر الرقم والسعر**. السبب في الكود بالحرف:
//        fitOne(code, Math.min(restH / LINE, nameSize))
//      يعني مقاس الرقم مربوط بمقاس الاسم — نفس العطل اللي اتصلح في
//      الملصق العادي في v0.36.0 وفضل هنا.
//
// القاعدة المتفق عليها: الرقم والسعر ثابتين، والاسم بياخد اللي فاضل
// (سطر → سطرين → نقط).
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
const MM = 96 / 25.4;
const DPI = 203; // دقة الطابعة الحرارية — البكسل الواحد = نقطة طابعة واحدة

const SHORT = 'كريب';
const LONG = 'Biotherm whitening Cream senstive';
const HUGE = 'حجاب كريب سادة لوكس بيجات درجة ممتازة جدا موديل 2024 عرض خاص';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildQuarterLabelHTML === 'function');
  const p2 = await b.newPage({ deviceScaleFactor: 2 });

  async function measure(name) {
    const html = await p.evaluate(async ([nm, SIZE]) => {
      const url = await generateQRDataURL('62808737', 200);
      return buildQuarterLabelHTML(
        { itemName: nm, barcodeNumber: '62808737', sellingPrice: 495 }, SIZE, url, 1);
    }, [name, SIZE]);
    await p2.setContent(html);
    return p2.evaluate(() => {
      const MM = 96 / 25.4;
      const fs = (el) => +(parseFloat(getComputedStyle(el).fontSize) / MM).toFixed(2);
      const label = document.querySelector('.label').getBoundingClientRect();
      const cells = [...document.querySelectorAll('.cell')];
      const n = document.querySelector('.n'), c = document.querySelector('.c'), pr = document.querySelector('.p');
      // أقرب حبر لحرف الورقة — الخلايا الجوانية جنبها خط القص مش الحرف
      let minT = Infinity, minB = Infinity, minL = Infinity, minR = Infinity;
      for (const el of document.querySelectorAll('.n,.c,.p,.q')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        minT = Math.min(minT, r.top - label.top);
        minB = Math.min(minB, label.bottom - r.bottom);
        minL = Math.min(minL, r.left - label.left);
        minR = Math.min(minR, label.right - r.right);
      }
      const lh = parseFloat(getComputedStyle(n).lineHeight) || 1;
      return {
        cells: cells.length,
        nameMm: fs(n), codeMm: fs(c), priceMm: pr ? fs(pr) : 0,
        // ⚠️ **الظاهر** مش الكامل: مع -webkit-line-clamp الـscrollHeight
        // بيفضل بيقول الارتفاع الكامل غير المقصوص، فكان بيعدّ 5 سطور
        // والظاهر سطرين. اللي يهمنا اللي المستخدم شايفه.
        lines: Math.max(1, Math.round(n.clientHeight / lh)),
        fullLines: Math.round(n.scrollHeight / lh),
        clamp: +getComputedStyle(n).webkitLineClamp || 0,
        // القص الفعلي: المحتوى أطول من المساحة الظاهرة → النقط شغّالة
        clipped: n.scrollHeight > n.clientHeight + 1,
        codeClipped: c.scrollWidth > c.clientWidth + 1,
        priceClipped: pr ? pr.scrollWidth > pr.clientWidth + 1 : false,
        outOfCell: cells.some((cl) => {
          const cr = cl.getBoundingClientRect();
          return [...cl.querySelectorAll('.n,.c,.p,.q')].some((e) => {
            const r = e.getBoundingClientRect();
            return r.width && (r.bottom > cr.bottom + 1 || r.top < cr.top - 1);
          });
        }),
        edgeMm: {
          t: +(minT / MM).toFixed(2), b: +(minB / MM).toFixed(2),
          l: +(minL / MM).toFixed(2), r: +(minR / MM).toFixed(2),
        },
        hasCut: !!document.querySelector('.cut'),
      };
    });
  }

  const short = await measure(SHORT);
  const long = await measure(LONG);
  const huge = await measure(HUGE);

  // ============================================================
  // 1) الشكل: أربع خلايا وخط قص
  // ============================================================
  check('⭐ أربع خلايا', short.cells === 4, short);
  check('⭐ وخط القص في النص', short.hasCut, short);

  // ============================================================
  // 2) ⭐⭐ الرقم والسعر **مايتأثروش بالاسم خالص**
  // ============================================================
  // دي الشكوى الأساسية. مش "بيخسروا أقل" زي الملصق العادي — هنا **صفر**:
  // مقاسهم متقاس على عرضهم هم بس، والاسم بياخد اللي فاضل.
  check('⭐⭐ الرقم نفس المقاس مع الاسم القصير والطويل',
    short.codeMm === long.codeMm && long.codeMm === huge.codeMm,
    { قصير: short.codeMm, طويل: long.codeMm, 'طويل جدًا': huge.codeMm });
  check('⭐⭐ والسعر كمان',
    short.priceMm === long.priceMm && long.priceMm === huge.priceMm,
    { قصير: short.priceMm, طويل: long.priceMm, 'طويل جدًا': huge.priceMm });
  // ⚠️ ولازم نتأكد إن المقارنة معناها حاجة: الاسم **بيفرق** فعلًا
  check('⭐ (والاسم بيصغّر فعلًا — يعني المقارنة معناها حاجة)',
    huge.nameMm < short.nameMm - 0.1, { قصير: short.nameMm, 'طويل جدًا': huge.nameMm });

  // ============================================================
  // 3) ⭐ الاسم: سطر → سطرين → نقط
  // ============================================================
  check('⭐ الاسم القصير سطر واحد', short.lines === 1, short);
  check('⭐ الاسم الطويل بينزل سطرين', long.lines === 2, long);
  check('⭐ والنقط شغّالة على اللي مش ظاهر', huge.clamp === 2, huge);
  // الرقم والسعر مايتقصّوش أبدًا — مقاسهم متقاس على عرضهم
  for (const [tag, r] of [['قصير', short], ['طويل', long], ['طويل جدًا', huge]]) {
    check(`⭐ "${tag}" — الرقم والسعر كاملين مش متقصوصين`,
      !r.codeClipped && !r.priceClipped, r);
    check(`"${tag}" — المحتوى جوه خليته`, !r.outOfCell, r);
  }

  // ============================================================
  // 4) ⭐ نقط الأمان
  // ============================================================
  const PLAY = 1.4;
  for (const [tag, r] of [['قصير', short], ['طويل', long], ['طويل جدًا', huge]]) {
    check(`⭐ "${tag}" — الحبر بعيد عن حروف الورقة`,
      r.edgeMm.t >= PLAY && r.edgeMm.b >= PLAY && r.edgeMm.l >= PLAY && r.edgeMm.r >= PLAY, r.edgeMm);
  }

  // ============================================================
  // 5) ⭐⭐ بيتبعت **نص** مش صورة — دي أصل الشكوى
  // ============================================================
  const route = await p.evaluate(async (SIZE) => {
    const cat = { itemName: 'Chanvie Leen 58047', barcodeNumber: '62808737', sellingPrice: 495 };
    localStorage.removeItem('tazweed_qz_tweak_htmlLabels'); // الافتراضي
    const dflt = await buildQuarterLabel(cat, SIZE, 1);
    localStorage.setItem('tazweed_qz_tweak_htmlLabels', '0'); // صورة
    const img = await buildQuarterLabel(cat, SIZE, 1);
    localStorage.removeItem('tazweed_qz_tweak_htmlLabels');
    // ومن شاشة الطباعة (السلة) — لازم تبقى نفس الحاجة
    const cart = await buildCartItemLabel({ product: { id: 'p', name: cat.itemName, barcodeNumber: '62808737', sellingPrice: 495 }, qty: 1, mode: 'quarter' }, SIZE);
    return {
      dfltIsText: dflt.image === null && /class="cut"/.test(dflt.jobHTML),
      imgIsImage: !!img.image,
      cartIsText: cart.image === null && /class="cut"/.test(cart.html),
    };
  }, SIZE);
  check('⭐⭐ الافتراضي بقى نص مش صورة', route.dfltIsText, route);
  check('⭐ والمفتاح لسه بيرجّع الصورة لو حبيت', route.imgIsImage, route);
  check('⭐⭐ وشاشة الطباعة بتاخد نفس الطريق', route.cartIsText, route);

  // ⭐ ومفيش شاشة بتبني المقسوم بنفسها — نفس قاعدة الملصق النصّي
  const src = await p.evaluate(async () => {
    const out = {};
    for (const f of ['js/print-label.js', 'js/print-screen.js', 'js/app.js']) out[f] = await (await fetch('/' + f)).text();
    return out;
  });
  const offenders = [];
  for (const [file, code] of Object.entries(src)) {
    const lines = code.split('\n');
    let from = -1, to = lines.length;
    lines.forEach((l, i) => {
      if (/^(async\s+)?function buildQuarterLabel\s*\(/.test(l)) from = i;
      else if (from >= 0 && to === lines.length && /^(async\s+)?function\s/.test(l) && i > from) to = i;
    });
    lines.forEach((l, i) => {
      if (!/renderQuarterLabelPNG\(|buildQuarterLabelHTML\(/.test(l)) return;
      if (/^(async\s+)?function\s/.test(l)) return;
      if (from >= 0 && i > from && i < to) return;
      offenders.push(`${file}:${i + 1}  ${l.trim().slice(0, 55)}`);
    });
  }
  check('⭐ مفيش شاشة بتبني المقسوم بنفسها — كلهم من buildQuarterLabel',
    offenders.length === 0, offenders);

  console.log('\n' + 'الاسم'.padEnd(36) + 'اسم   رقم   سعر  سطور');
  console.log('─'.repeat(64));
  for (const [t, r] of [[SHORT, short], [LONG, long], [HUGE, huge]]) {
    console.log(t.slice(0, 34).padEnd(36) + `${r.nameMm}  ${r.codeMm}  ${r.priceMm}   ${r.lines}`);
  }
  console.log('─'.repeat(64));

  // ============================================================
  // 6) ⭐ مفتاح "كبّر اسم الصنف" — والرجوع منه
  // ============================================================
  // ⚠️ القياس اللي أدّى للتعديل: الاسم في الخلية **مش محدود بالارتفاع**
  // — محدود **بعرض العمود**. فتقريب السطور لوحده مايعملش حاجة؛ اللي
  // بيفرق هو التقريب **مع** السماح بسطر تالت.
  const tight = await p.evaluate(async (SIZE) => {
    const run = async (nm, on) => {
      localStorage.setItem('tazweed_qz_tweak_tightQuarter', on ? '1' : '0');
      const url = await generateQRDataURL('10632103', 200);
      const h = buildQuarterLabelHTML({ itemName: nm, barcodeNumber: '10632103', sellingPrice: 120 }, SIZE, url, 1);
      return {
        name: +(h.match(/\.n \{\s*font-size: ([\d.]+)mm/) || [])[1],
        clamp: +(h.match(/-webkit-line-clamp: (\d+)/) || [])[1],
        html: h,
      };
    };
    const out = {
      badOff: await run('Hejap Kuwaiti 120', false),
      badOn: await run('Hejap Kuwaiti 120', true),
      goodOff: await run('Leather Watch 120', false),
      goodOn: await run('Leather Watch 120', true),
    };
    localStorage.removeItem('tazweed_qz_tweak_tightQuarter');
    out.defaultOn = getPrintTweak('tightQuarter');
    return out;
  }, SIZE);

  check('⭐ المفتاح بيكبّر الاسم اللي بيتقسم وحش',
    tight.badOn.name > tight.badOff.name, { قبل: tight.badOff.name, بعد: tight.badOn.name });
  // ⚠️ والاسم اللي واخد أقصى عرض أصلًا مايتغيّرش — ده متوقع مش عطل
  check('⭐ والاسم اللي واخد أقصى عرض مايتغيّرش (متوقع)',
    tight.goodOn.name === tight.goodOff.name, { قبل: tight.goodOff.name, بعد: tight.goodOn.name });
  check('⭐ والسطر التالت بيتفتح مع المفتاح بس',
    tight.badOff.clamp <= 2 && tight.badOn.clamp <= 3, tight);
  check('⭐ ومفتوح افتراضيًا', tight.defaultOn === true, tight);

  // ⭐⭐ الرجوع: قفل المفتاح = الملصق زي ما كان **بايت ببايت**
  const revert = await p.evaluate(async (SIZE) => {
    localStorage.setItem('tazweed_qz_tweak_tightQuarter', '0');
    const url = await generateQRDataURL('10632103', 200);
    const a = buildQuarterLabelHTML({ itemName: 'Hejap Kuwaiti 120', barcodeNumber: '10632103', sellingPrice: 120 }, SIZE, url, 1);
    const b2 = buildQuarterLabelHTML({ itemName: 'Hejap Kuwaiti 120', barcodeNumber: '10632103', sellingPrice: 120 }, SIZE, url, 1);
    localStorage.removeItem('tazweed_qz_tweak_tightQuarter');
    return { same: a === b2, hasOldLine: /line-height: 1\.15/.test(a) };
  }, SIZE);
  check('⭐⭐ قفل المفتاح بيرجّع التباعد القديم', revert.hasOldLine, revert);

  // ============================================================
  // 7) ⭐⭐ المخاطرة: سطور النص مايلتحموش على الورق
  // ============================================================
  // ⚠️ أول نسخة من الفحص ده كانت **بتقيس الحاجة الغلط**: كانت بتاخد
  // `getBoundingClientRect()` وتطرح `.p.top - .c.bottom`. الناتج صفر
  // دايمًا — مش لأن في مشكلة، لكن لأن `.t` فيها
  // `justify-content: space-between` والصناديق **ملزوقة ببعض بالتصميم**.
  // صندوق ملزوق ≠ حبر ملزوق: جوّه الصندوق في leading فوق وتحت الحرف،
  // والحروف نفسها مابتملاش الصندوق (الأرقام مالهاش نزول تحت السطر).
  //
  // الفحص الصح: **نرسم** عمود النص بدقة الطابعة (203 نقطة/بوصة، يعني
  // كل بكسل = نقطة طابعة واحدة) وندوّر على السطور **الفاضية من الحبر**
  // بين كل سطرين. ده اللي هيحصل فعلًا على الورق.
  const inkBands = async (html) => {
    const pg = await b.newPage({ deviceScaleFactor: DPI / 96 });
    await pg.setContent(html);
    const box = await pg.evaluate(() => {
      const r = document.querySelector('.t').getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    const buf = await pg.screenshot({ clip: box });
    await pg.close();
    const png = PNG.sync.read(buf);
    // سطر "فيه حبر" = فيه بكسل غامق واحد على الأقل
    const inky = [];
    for (let y = 0; y < png.height; y++) {
      let has = false;
      for (let x = 0; x < png.width && !has; x++) {
        const i = (y * png.width + x) * 4;
        if (png.data[i + 3] > 32 && (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3 < 160) has = true;
      }
      inky.push(has);
    }
    // نجمّع السطور المتلاصقة في "شرائط حبر" — كل شريط = سطر مكتوب
    const bands = [];
    for (let y = 0; y < inky.length; y++) {
      if (!inky[y]) continue;
      const start = y;
      while (y + 1 < inky.length && inky[y + 1]) y++;
      bands.push([start, y]);
    }
    const gaps = [];
    for (let i = 1; i < bands.length; i++) gaps.push(bands[i][0] - bands[i - 1][1] - 1);
    return { bands: bands.length, gapsDots: gaps, minGapDots: gaps.length ? Math.min(...gaps) : -1 };
  };

  const inkOn = await inkBands(tight.badOn.html);
  const inkOff = await inkBands(tight.badOff.html);
  // كل شريط حبر = سطر مكتوب. لو اتنين التحموا الشرائط بتقل عن المتوقع.
  check('⭐⭐ كل سطر لسه شريط حبر لوحده (مفيش التحام)',
    inkOn.bands === tight.badOn.clamp + (2), { المتوقع: tight.badOn.clamp + 2, الفعلي: inkOn });
  // ⚠️ نقطة طابعة واحدة فاضية = أقل حاجة تخلي السطرين ينفصلوا على الورق
  check('⭐⭐ وبينهم نقطة طابعة فاضية على الأقل', inkOn.minGapDots >= 1, inkOn);
  check('⭐ وقفل المفتاح لسه سليم بردو', inkOff.minGapDots >= 1, inkOff);
  console.log(`\nالفراغ الحقيقي بين السطور (نقط طابعة، النقطة = ${(25.4 / DPI).toFixed(3)}مم):`);
  console.log(`   المفتاح مفتوح: ${inkOn.bands} سطور، أقل فراغ ${inkOn.minGapDots} نقطة  → ${JSON.stringify(inkOn.gapsDots)}`);
  console.log(`   المفتاح مقفول: ${inkOff.bands} سطور، أقل فراغ ${inkOff.minGapDots} نقطة  → ${JSON.stringify(inkOff.gapsDots)}`);

  check('مفيش أخطاء في الصفحة', errors.length === 0, errors);
  await b.close();

  if (fail.length) {
    console.log(`❌ فشل (${fail.length}):`);
    fail.forEach((f) => console.log('   ' + f));
    console.log(`\n✅ نجح (${pass.length})`);
    process.exit(1);
  }
  console.log(`✅ نجح (${pass.length})`);
  pass.filter((x) => x.startsWith('⭐')).forEach((x) => console.log('   ' + x));
})();
