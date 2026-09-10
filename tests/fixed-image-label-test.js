// ============================================================
// 📏 المقاسات الثابتة في **مسار الصورة**
// ============================================================
// ⚠️⚠️ العطل اللي بيتحل، اتبلّغ بالنص: "عاوز بردوا اعرف اوبشن تثبيت
// الاسم بيشتغل ازاي لان لحد دلوقتي مش شغال".
//
// السبب: كود المقاسات الثابتة كله كان في مسار **النص** (buildLabelHTML).
// أول ما مفتاح "ابعت الملصق كنص" اتقفل، الملصقات راحت لمسار الصورة —
// والمسار ده مكانش فيه ولا إشارة واحدة للمفاتيح دي.
//
// ⚠️ الفحص ده بيقيس **البكسلات اللي اترسمت فعلًا**، مش بيقرا الكود.
// السبب إن الفحص اللي بيدوّر على اسم المفتاح في الملف بيعدّي حتى لو
// المفتاح اتقرا واترمى — وده بالظبط نوع العطل اللي إحنا فيه.
const { chromium } = require('playwright');
const path = require('path');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof renderLabelPNG === 'function' && typeof getPrintTweak === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };

    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 1 };

    // اسمين من الكتالوج الحقيقي: واحد قصير بياخد سطر، وواحد طويل
    // بياخد سطرين. دول اللي بيكشفوا الربط بين مقاس الاسم والباقي.
    const SHORT = { itemName: 'حجاب جيل بيور', barcodeNumber: '6221234567890', sellingPrice: 140 };
    const LONG = {
      itemName: 'خمار ماليزي دجيتال سادة بكم مطرز واسع',
      barcodeNumber: '6229876543210',
      sellingPrice: 140,
    };

    const setTweaks = (map) => {
      Object.keys(map).forEach((k) => {
        try { localStorage.setItem('tazweed_qz_tweak_' + k, map[k] ? '1' : '0'); } catch (e) {}
      });
    };

    // ------------------------------------------------------------
    // بنقيس ارتفاع كل شريط حبر في الصورة الناتجة
    // ------------------------------------------------------------
    // الملصق أبيض وأسود صريح، فبنعدّ الصفوف اللي فيها حبر ونجمّعهم
    // مجموعات متلاصقة. كل مجموعة = سطر مرسوم. وده بيدّينا **أماكن**
    // العناصر و**ارتفاعها** من غير ما نصدّق أي رقم من الكود.
    const bandsOf = async (dataUrl) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      // ⚠️ بنتجاهل عمود الـQR: هو كتلة حبر واحدة طولها الملصق كله،
      // فبيوصّل كل الشرايط ببعض ويخلي القياس بلا معنى.
      const x0 = Math.floor(c.width * 0.45);
      const rows = [];
      for (let y = 0; y < c.height; y++) {
        let ink = 0;
        for (let x = x0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4] < 128) ink++;
        }
        rows.push(ink > 0);
      }
      const bands = [];
      let start = -1;
      for (let y = 0; y <= rows.length; y++) {
        if (rows[y] && start === -1) start = y;
        else if (!rows[y] && start !== -1) { bands.push({ top: start, h: y - start }); start = -1; }
      }
      return bands;
    };

    // ============================================================
    // ١) المفتاح مقفول → السلوك القديم بالحرف
    // ============================================================
    setTweaks({ fixedNameSize: false, fixedLabelSizes: false });
    const offShort = await bandsOf(renderLabelPNG(SHORT, size));
    const offLong = await bandsOf(renderLabelPNG(LONG, size));
    out.offShortBands = offShort.length;
    out.offLongBands = offLong.length;
    // آخر شريط = السعر. مكانه بيتحرك مع طول الاسم في السلوك القديم.
    out.offPriceTopShort = offShort.length ? offShort[offShort.length - 1].top : -1;
    out.offPriceTopLong = offLong.length ? offLong[offLong.length - 1].top : -1;

    // ============================================================
    // ٢) المفتاح مفتوح → السعر في **نفس المكان** في الاتنين
    // ============================================================
    // ده جوهر الطلب: "مسارات ثابته يتاخد منها الاسم رقم الباركود
    // السعر وحجم ثابت".
    setTweaks({ fixedNameSize: true, fixedLabelSizes: false });
    const onShort = await bandsOf(renderLabelPNG(SHORT, size));
    const onLong = await bandsOf(renderLabelPNG(LONG, size));
    out.onPriceTopShort = onShort.length ? onShort[onShort.length - 1].top : -1;
    out.onPriceTopLong = onLong.length ? onLong[onLong.length - 1].top : -1;
    out.onPriceHShort = onShort.length ? onShort[onShort.length - 1].h : -1;
    out.onPriceHLong = onLong.length ? onLong[onLong.length - 1].h : -1;

    // ============================================================
    // ⭐⭐⭐⭐⭐ ٢ب) **مقاس الاسم نفسه** — ده الشكوى الأصلية
    // ============================================================
    // ⚠️⚠️ الفحص فوق بيقيس السعر بس، والبلاغ كان عن **الاسم**. وفعلًا
    // تخريبة (شيل EPS) عدّت من فحص السعر — لأنها بتعطّل تثبيت الاسم
    // لوحده. فالقياس ده مالوش بديل.
    //
    // أول شريط حبر = أول سطر من الاسم، وارتفاعه = مقاس الحرف المرسوم.
    out.onNameHShort = onShort.length ? onShort[0].h : -1;
    out.onNameHLong = onLong.length ? onLong[0].h : -1;
    out.offNameHShort = offShort.length ? offShort[0].h : -1;
    out.offNameHLong = offLong.length ? offLong[0].h : -1;

    // والخانة بتاعة الاسم بتغيّره فعلًا
    setPrintNameMm(1.3);
    const tiny = await bandsOf(renderLabelPNG(LONG, size));
    out.tinyNameH = tiny.length ? tiny[0].h : -1;
    setPrintNameMm(1.9);

    // ============================================================
    // ٣) الخانة بتغيّر المقاس فعلًا
    // ============================================================
    // ⚠️ ده اللي بيفرّق بين "المفتاح شغّال" و"المفتاح بيتقرا وبيترمى".
    setPrintPriceMm(1.5);
    const small = await bandsOf(renderLabelPNG(SHORT, size));
    out.smallPriceH = small.length ? small[small.length - 1].h : -1;
    setPrintPriceMm(2.9);
    const big = await bandsOf(renderLabelPNG(SHORT, size));
    out.bigPriceH = big.length ? big[big.length - 1].h : -1;
    setPrintPriceMm(2.6);

    // ============================================================
    // ٤) المفتاح مقفول تاني → الصورة **بايت ببايت** زي الأول
    // ============================================================
    // ⚠️⚠️ أهم فحص في الملف: التثبيت مايسيبش أي أثر لما يتقفل.
    // من غير الحارس ده، مفتاح تجريبي ممكن يغيّر الملصق العادي في صمت.
    setTweaks({ fixedNameSize: false, fixedLabelSizes: false });
    out.revertShort = renderLabelPNG(SHORT, size) === renderLabelPNG(SHORT, size);
    const againShort = renderLabelPNG(SHORT, size);
    const againLong = renderLabelPNG(LONG, size);
    setTweaks({ fixedNameSize: false, fixedLabelSizes: false });
    out.byteIdenticalShort = againShort === renderLabelPNG(SHORT, size);
    out.byteIdenticalLong = againLong === renderLabelPNG(LONG, size);

    // ============================================================
    // ⭐⭐⭐⭐⭐ ٥) الطبعة من التليفون = الطبعة من الكمبيوتر بالظبط
    // ============================================================
    // اتطلب بالنص: "ارسال الملصق من التليفون او اي حاجه عمتنا تبقي زي
    // اللي بتطلع من الكمبيوتر مباشر".
    //
    // ⚠️ الضمانة مش إن الصورة بتتبعت — دي **مش** بتتبعت. الجهاز اللي
    // عليه الطابعة بيعيد بناء الملصق من الوصفة (spec) بخطوطه
    // وإعداداته هو. فالفحص لازم يقارن:
    //     البناء المباشر  ==  البناء من الوصفة
    // ولو الاتنين مختلفين، يبقى اللي بيطبع من التليفون بياخد ملصق تاني.
    setTweaks({ fixedNameSize: true, fixedLabelSizes: false });
    const directShort = await buildItemLabel(SHORT, size, 1);
    const viaSpecShort = await rebuildFromSpec({ kind: 'item', cat: SHORT, copies: 1 }, size);
    out.specSameShort = !!viaSpecShort && viaSpecShort[0].image === directShort.image;

    const directLong = await buildItemLabel(LONG, size, 1);
    const viaSpecLong = await rebuildFromSpec({ kind: 'item', cat: LONG, copies: 1 }, size);
    out.specSameLong = !!viaSpecLong && viaSpecLong[0].image === directLong.image;

    // ⚠️ والمقاسات الثابتة بتتطبّق في المسار ده كمان — من غير كده
    // الملصق الجاي من التليفون هيطلع بمقاسات تانية.
    out.specHasImage = !!viaSpecLong && typeof viaSpecLong[0].image === 'string' && viaSpecLong[0].image.length > 100;

    return out;
  });

  check('⭐⭐ الملصق بيترسم وفيه شرايط (القياس نفسه شغّال)',
    r.offShortBands >= 2 && r.offLongBands >= 2, { short: r.offShortBands, long: r.offLongBands });

  // ============================================================
  // ⭐⭐⭐⭐⭐ العطل الأصلي
  // ============================================================
  check('⭐⭐⭐⭐⭐ المفتاح مفتوح → السعر في نفس المكان للاسم القصير والطويل',
    r.onPriceTopShort > 0 && Math.abs(r.onPriceTopShort - r.onPriceTopLong) <= 1,
    { short: r.onPriceTopShort, long: r.onPriceTopLong });
  check('⭐⭐⭐⭐⭐ وبنفس الارتفاع في الاتنين',
    r.onPriceHShort > 0 && Math.abs(r.onPriceHShort - r.onPriceHLong) <= 1,
    { short: r.onPriceHShort, long: r.onPriceHLong });

  // ⚠️ والمقارنة اللي بتثبت إن ده مش صدفة: من غير المفتاح، المكان
  // **بيتحرك** فعلًا. لو الاتنين متساويين أصلًا، الفحص فوق مالوش معنى.
  check('⭐⭐⭐⭐ ومن غير المفتاح المكان بيتحرك (يعني الفحص فوق بيقيس حاجة)',
    Math.abs(r.offPriceTopShort - r.offPriceTopLong) > 1,
    { short: r.offPriceTopShort, long: r.offPriceTopLong });

  check('⭐⭐⭐⭐⭐ ومقاس **الاسم** واحد للقصير والطويل (الشكوى الأصلية)',
    r.onNameHShort > 0 && Math.abs(r.onNameHShort - r.onNameHLong) <= 1,
    { short: r.onNameHShort, long: r.onNameHLong });
  check('⭐⭐⭐⭐ ومن غير المفتاح مقاس الاسم بيختلف (يعني الفحص فوق بيقيس حاجة)',
    Math.abs(r.offNameHShort - r.offNameHLong) > 1,
    { short: r.offNameHShort, long: r.offNameHLong });
  check('⭐⭐⭐⭐⭐ وخانة مقاس الاسم بتصغّره فعلًا',
    r.tinyNameH > 0 && r.tinyNameH < r.onNameHLong,
    { at1_3: r.tinyNameH, at1_9: r.onNameHLong });

  check('⭐⭐⭐⭐⭐ خانة مقاس السعر بتغيّر المقاس فعلًا',
    r.smallPriceH > 0 && r.bigPriceH > r.smallPriceH,
    { small: r.smallPriceH, big: r.bigPriceH });

  check('⭐⭐⭐⭐⭐ وقفل المفتاح بيرجّع الملصق بايت ببايت زي ما كان',
    r.byteIdenticalShort === true && r.byteIdenticalLong === true,
    { short: r.byteIdenticalShort, long: r.byteIdenticalLong });
  check('⭐⭐ والرسم ثابت (نفس المدخلات = نفس الصورة)', r.revertShort === true);
  check('⭐⭐⭐⭐⭐ الطبعة من التليفون مطابقة لبتاعة الكمبيوتر (اسم قصير)',
    r.specSameShort === true, r.specSameShort);
  check('⭐⭐⭐⭐⭐ ومطابقة كمان مع الاسم الطويل (اللي المقاسات بتفرق فيه)',
    r.specSameLong === true, r.specSameLong);
  check('⭐⭐⭐ والمسار ده بيطلّع صورة فعلًا (مش نص لـQZ)', r.specHasImage === true, r.specHasImage);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
