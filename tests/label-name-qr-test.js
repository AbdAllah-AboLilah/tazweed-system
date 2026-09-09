// اسم بمقاس ثابت + الـQR أخف — مفتاحين منفصلين
// ============================================================
// اتطلبوا مع بعض بس مفصولين عن قصد:
//
//   fixedNameSize — مقاس اسم الصنف يبقى ثابت بدل ما يتغيّر مع طوله.
//                   القياس: 2.70مم (10 حروف) → 1.29مم (75 حرف) = فرق 52%.
//                   و1.9 هو الرقم اللي النظام واقف عنده أصلًا من 26 لـ50 حرف.
//
//   lightQR       — صورة الـQR بلونين بدل 32 لون. القياس: الملصق 7,222
//                   بايت **منهم 3,556 صورة الـQR** (49%).
//
// ⚠️⚠️ أخطر فحص في الملف: **الـQR لازم يفضل مقروء.** هو الحاجة اللي
// الكاشير بيمسحها، والباركود المطبوع تحته هو خطة الطوارئ الوحيدة.
// فمابنكتفيش بإن الحجم قلّ — بنقارن **البكسلات واحد واحد** وبنقرا الكود
// من الصورة الناتجة فعلًا.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildLabelHTML === 'function' && typeof generateQRDataURL === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const CODE = '10632103';
    const NAMES = [
      'شيفون سادة',                                      // 10
      'شيفون مطرز بالترتر ذهبي',                          // 23
      'كريب دبل جورجيت سادة مقاس كبير',                   // 30
      'طرحة شيفون مطرزة بالترتر الذهبي مقاس كبير',        // 41
      'طرحة كريب دبل جورجيت سادة لون بيج فاتح مقاس كبير', // 48
    ];
    const nameMm = (name) => {
      const html = buildLabelHTML({ name, barcodeNumber: CODE, sellingPrice: 120 }, { ...LABEL_SIZE }, '', 1);
      const m = html.match(/\.name\s*\{[^}]*font-size:\s*([\d.]+)mm/);
      return m ? +m[1] : null;
    };

    // ---------- المفتاح مقفول: كل حاجة زي ما هي ----------
    setPrintTweak('fixedLabelSizes', true);
    setPrintTweak('fixedNameSize', false);
    out.before = NAMES.map(nameMm);

    // ---------- المفتاح مفتوح ----------
    setPrintTweak('fixedNameSize', true);
    out.after = NAMES.map(nameMm);

    // ⚠️ اسم طويل جدًا لازم **يصغّر** — مايتقصّش ومايركبش على الرقم
    const LONG = 'طرحة شيفون مطرزة بالترتر الذهبي لون أوف وايت مقاس كبير عرض خاص لفترة محدودة جدًا';
    out.longMm = nameMm(LONG);

    // ============================================================
    // ⚠️⚠️ الحالة اللي بتكشف فحص الارتفاع — 51 حرف بالظبط
    // ============================================================
    // الاسم ده **بيدخل بالعرض** في 3 سطور عند 1.9مم، بس المساحة الرأسية
    // عند 3 سطور مابتسمحش غير بـ1.29مم. لو الكود بص على العرض بس، هيقول
    // "1.9 في 3 سطور" ويرسم صندوق أطول من المتاح — **فالسطر التالت
    // بيتقص** من على الملصق. وإحنا متفقين إن الاسم مايتقصّش.
    //
    // القياس: عند 51 حرف، الصح = 1.76مم في سطرين. والغلط = 1.9مم في
    // 3 سطور (ارتفاع 6.84مم في مساحة 4.6).
    //
    // ⚠️ الفحص ده مالوش بديل: كل الأسماء التانية في الملف بتعدّي حتى لو
    // فحص الارتفاع اتشال — جرّبناها.
    const boxOf = (name) => {
      const html = buildLabelHTML({ name, barcodeNumber: CODE, sellingPrice: 120 }, { ...LABEL_SIZE }, '', 1);
      const mm = +(html.match(/\.name\s*\{[^}]*font-size:\s*([\d.]+)mm/) || [])[1];
      const mh = +(html.match(/\.name\s*\{[^}]*max-height:\s*([\d.]+)mm/) || [])[1];
      return { mm, mh, lines: Math.round(mh / (mm * 1.2)) };
    };
    const N51 = 'طرحة شيفون مطرزة بالترتر الذهبي لون أوف وايت مقاس ك';
    setPrintTweak('fixedNameSize', false);
    out.box51Off = boxOf(N51);
    setPrintTweak('fixedNameSize', true);
    out.box51On = boxOf(N51);

    // ⚠️⚠️ والمفتاح الأب مقفول → المفتاح ده مالوش أي أثر
    setPrintTweak('fixedLabelSizes', false);
    out.parentOffSame = JSON.stringify(NAMES.map(nameMm));
    setPrintTweak('fixedNameSize', false);
    out.parentOffBase = JSON.stringify(NAMES.map(nameMm));
    setPrintTweak('fixedLabelSizes', true);

    // ============================================================
    // الـQR — البكسلات والحجم
    // ============================================================
    const readPixels = (dataUrl) =>
      new Promise((res) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const cx = c.getContext('2d');
          cx.drawImage(img, 0, 0);
          const d = cx.getImageData(0, 0, c.width, c.height).data;
          // بنحوّل لأبيض/أسود عشان المقارنة تبقى على النقط نفسها
          const bits = new Uint8Array(c.width * c.height);
          for (let i = 0; i < bits.length; i++) bits[i] = d[i * 4] < 128 ? 1 : 0;
          res({ w: c.width, h: c.height, bits, dataUrl });
        };
        img.onerror = () => res(null);
        img.src = dataUrl;
      });

    setPrintTweak('lightQR', false);
    const qrFat = await generateQRDataURL(CODE, 200);
    setPrintTweak('lightQR', true);
    const qrThin = await generateQRDataURL(CODE, 200);

    out.fatBytes = qrFat.length;
    out.thinBytes = qrThin.length;
    out.shrunk = out.thinBytes < out.fatBytes;
    // ⚠️ (تحقّق) لازم يكونوا **مختلفين فعلًا** — لو المفتاح مااشتغلش
    // المقارنة تحت هتعدّي وهي مالهاش أي معنى.
    out.actuallyDifferent = qrFat !== qrThin;

    const A = await readPixels(qrFat);
    const B = await readPixels(qrThin);
    out.sameSize = !!A && !!B && A.w === B.w && A.h === B.h;
    let diff = 0;
    if (out.sameSize) for (let i = 0; i < A.bits.length; i++) if (A.bits[i] !== B.bits[i]) diff++;
    out.pixelDiff = out.sameSize ? diff : -1;
    out.dims = A ? `${A.w}x${A.h}` : '';

    // ---------- والقراءة الحقيقية بالماسح ----------
    const decode = (px) => {
      if (!px || typeof jsQR !== 'function') return null;
      const rgba = new Uint8ClampedArray(px.w * px.h * 4);
      for (let i = 0; i < px.bits.length; i++) {
        const v = px.bits[i] ? 0 : 255;
        rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
      }
      const res = jsQR(rgba, px.w, px.h);
      return res ? res.data : null;
    };
    out.readFat = decode(A);
    out.readThin = decode(B);

    // ---------- وأثره على الملصق كله ----------
    const labelBytes = async (light) => {
      setPrintTweak('lightQR', light);
      const qr = await generateQRDataURL(CODE, 200);
      return buildLabelHTML({ name: NAMES[3], barcodeNumber: CODE, sellingPrice: 120 },
        { ...LABEL_SIZE }, qr, 1).length;
    };
    out.labelFat = await labelBytes(false);
    out.labelThin = await labelBytes(true);
    out.perMsgFat = Math.floor(QZ_MAX_MESSAGE_BYTES / (out.labelFat + 64));
    out.perMsgThin = Math.floor(QZ_MAX_MESSAGE_BYTES / (out.labelThin + 64));
    setPrintTweak('lightQR', false);
    setPrintTweak('fixedNameSize', false);

    return out;
  });

  // ---------- الاسم ----------
  const spread = (a) => Math.round(100 * (1 - Math.min(...a) / Math.max(...a)));
  check('⚠️ (تحقّق) الفرق دلوقتي كبير فعلًا', spread(r.before) >= 25, spread(r.before) + '%');
  check('⚠️ (تحقّق) المقاس بيتغيّر فعلًا وهو مقفول', spread(r.before) > 20, r.before);
  // ⚠️⚠️ الفحص بيقيس **الفرق** مش التطابق التام، وده مقصود:
  // الاسم اللي مايوصلش لـ1.9 (لا بالعرض ولا بالارتفاع) بيرجع للطريقة
  // القديمة وبياخد 1.87 — فرق 1.6% مش بيتشاف بالعين. التطابق التام
  // كان هيحتاج إما نقصّر الاسم أو نقصّه، والاتنين ممنوعين.
  // المهم إن الـ52% بقت أقل من 5%.
  check('⭐⭐⭐ والمفتاح مفتوح → الفرق بين الأسماء أقل من 5%',
    spread(r.after) <= 5, { after: r.after, فرق: spread(r.after) + '%' });
  check('⭐⭐ ومعظم الأسماء على 1.9 بالظبط',
    r.after.filter((x) => x === 1.9).length >= r.after.length - 1, r.after);
  check('⭐⭐⭐ والاسم الطويل جدًا **بيصغّر** مايتقصّش', r.longMm !== null && r.longMm < 1.9, r.longMm);
  check('⭐⭐⭐ (51 حرف) صندوق الاسم مايكبرش عن المتاح — السطر مايتقصّش',
    r.box51On.mh <= r.box51Off.mh + 0.05, { مفتوح: r.box51On, مقفول: r.box51Off });
  check('⚠️⚠️ والمفتاح الأب مقفول → مالوش أي أثر',
    r.parentOffSame === r.parentOffBase, [r.parentOffSame, r.parentOffBase]);

  // ---------- الـQR ----------
  check('⚠️ (تحقّق) المفتاح غيّر الصورة فعلًا', r.actuallyDifferent);
  check('⭐⭐ صورة الـQR بقت أخف', r.shrunk, [r.fatBytes, r.thinBytes]);
  check('⭐ ونفس المقاس بالبكسل', r.sameSize, r.dims);
  check('⭐⭐⭐ **ولا نقطة اتغيّرت** — مقارنة بكسل ببكسل', r.pixelDiff === 0, r.pixelDiff);
  check('⭐⭐⭐ والماسح بيقرا الـQR الجديد', r.readThin === '10632103', r.readThin);
  check('⚠️ (تحقّق) وبيقرا القديم كمان', r.readFat === '10632103', r.readFat);

  // ---------- المكسب ----------
  check('⭐⭐ الملصق بقى أخف', r.labelThin < r.labelFat, [r.labelFat, r.labelThin]);
  check('⭐⭐ وملصقات أكتر في أمر الطباعة الواحد',
    r.perMsgThin > r.perMsgFat, [r.perMsgFat, r.perMsgThin]);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(`\n📊 الاسم: ${r.before.join('/')} → ${r.after.join('/')}`);
  console.log(`📊 الـQR: ${r.fatBytes} → ${r.thinBytes} بايت | فرق البكسل: ${r.pixelDiff}`);
  console.log(`📊 الملصق: ${r.labelFat} → ${r.labelThin} بايت | في الرسالة: ${r.perMsgFat} → ${r.perMsgThin}`);
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
