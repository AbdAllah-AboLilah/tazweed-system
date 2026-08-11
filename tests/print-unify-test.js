// ============================================================
// الملصق الواحد لازم يطلع **واحد** من أي شاشة
// ============================================================
// ⚠️ الفحص ده اتكتب بعد عطل حقيقي: نفس "المسمّى" بالظبط كان يطلع
// **نضيف** لو طبعته من شاشة الفئات، و**منغمش** لو طبعته من شاشة الطباعة.
//
// السبب مكانش في التصميم — كان إن تلات دوال بينفّذوا نفس المنطق، واتنين
// منهم بيبصّوا على مفتاح "ابعت الملصق كنص" والتالت نسي. يعني اختلاف صامت
// مافيش أي رسالة خطأ بتقول عليه، ومش باين غير على الورق.
//
// فالفحص ده مابيفحصش دالة — بيفحص **الاتفاق**: يبني نفس الملصق من كل
// المسارات ويتأكد إنهم متطابقين حرفيًا.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildTextLabel === 'function');

  // ============================================================
  // 1) ⭐ المسمّى من التلات شاشات = نفس الملصق بالظبط
  // ============================================================
  const agree = await p.evaluate(async (SIZE) => {
    state.categories = [{ id: 'c1', name: 'كريب سادة لوكس', colorGroups: [] }];
    state.activeCategoryId = 'c1';
    state.grades = [{ id: 'g1', number: 56, group: '', branchQty: 1, mainQty: 1, status: 'normal' }];

    const L1 = 'بضاعة مرتجعة', L2 = 'مورّد: نصار';
    const out = {};

    // (أ) شاشة الفئات: "طباعة مسمّى" → printTextLabel → buildTextLabel
    out.direct = buildTextLabel(L1, L2, SIZE, 1);

    // (ب) شاشة الطباعة: السلة → buildCartItemLabel
    out.cart = await buildCartItemLabel({ custom: { line1: L1, line2: L2 }, qty: 1 }, SIZE);

    return {
      directHTML: out.direct.jobHTML, cartHTML: out.cart.html,
      directImage: out.direct.image, cartImage: out.cart.image,
    };
  }, SIZE);

  check('⭐ المسمّى من شاشة الفئات = المسمّى من شاشة الطباعة (نفس الـHTML)',
    agree.directHTML === agree.cartHTML,
    { same: agree.directHTML === agree.cartHTML, a: String(agree.directHTML).slice(0, 90), b: String(agree.cartHTML).slice(0, 90) });
  check('⭐ ونفس الطريقة (صورة/نص) في الاتنين',
    agree.directImage === agree.cartImage,
    { direct: agree.directImage ? 'صورة' : 'نص', cart: agree.cartImage ? 'صورة' : 'نص' });
  // والافتراضي لازم يبقى النص — ده اللي بيطبع نضيف على الورق (v0.36.0)
  check('⭐ والافتراضي نص مش صورة (ده اللي بيطبع نضيف)',
    agree.directImage === null && /class="l1"/.test(agree.directHTML), agree.directHTML.slice(0, 120));

  // ============================================================
  // 2) ⭐ المفتاح بيقلب **كل** المسارات مع بعض
  // ============================================================
  // العطل الأصلي كان بالظبط إن المفتاح بيقلب البعض والبعض لأ.
  const both = await p.evaluate(async (SIZE) => {
    const L1 = 'بضاعة مرتجعة', L2 = 'مورّد: نصار';
    const snap = async () => ({
      direct: buildTextLabel(L1, L2, SIZE, 1).image !== null,
      cart: (await buildCartItemLabel({ custom: { line1: L1, line2: L2 }, qty: 1 }, SIZE)).image !== null,
      grade: buildTextLabel('كريب سادة لوكس', 'درجة 56', SIZE, 1).image !== null,
    });
    localStorage.setItem('tazweed_qz_tweak_htmlLabels', '0'); // صورة
    const asImage = await snap();
    localStorage.removeItem('tazweed_qz_tweak_htmlLabels');   // الافتراضي = نص
    const asText = await snap();
    return { asImage, asText };
  }, SIZE);

  check('⭐ المفتاح مقفول → كلهم صورة',
    both.asImage.direct && both.asImage.cart && both.asImage.grade, both.asImage);
  check('⭐ المفتاح مفتوح (الافتراضي) → كلهم نص',
    !both.asText.direct && !both.asText.cart && !both.asText.grade, both.asText);

  // ============================================================
  // 3) ⭐ ملصق الصنف كمان: شاشة الطباعة = باقي الشاشات
  // ============================================================
  const item = await p.evaluate(async (SIZE) => {
    const prod = { id: 'p1', name: 'Chanvie Leen 58047', barcodeNumber: '62808737', sellingPrice: 495, originalPrice: 620 };
    const src = productAsLabelSource(prod);
    const direct = await buildItemLabel(src, SIZE, 1);
    const cart = await buildCartItemLabel({ product: prod, qty: 1, mode: 'normal' }, SIZE);
    return { same: direct.jobHTML === cart.html, sameMode: (direct.image || null) === (cart.image || null) };
  }, SIZE);
  check('⭐ ملصق الصنف من السلة = من شاشة الفئات', item.same, item);
  check('⭐ ونفس الطريقة', item.sameMode, item);

  // ============================================================
  // 4) الوضع "مقسوم ٤" فاضل صورة — وده صح
  // ============================================================
  // ⚠️ مالوش نسخة نصّية أصلًا (أربع خلايا مرسومة بخط قص)، فبيفضل صورة
  // مهما كان المفتاح. الفحص ده بيوثّق الاستثناء عشان محدش يفتكره عطل.
  const quarter = await p.evaluate(async (SIZE) => {
    const prod = { id: 'p1', name: 'كريب', barcodeNumber: '12133', sellingPrice: 85 };
    const q = await buildCartItemLabel({ product: prod, qty: 1, mode: 'quarter' }, SIZE);
    return { isImage: !!q.image };
  }, SIZE);
  check('"مقسوم ٤" فاضل صورة (مالوش نسخة نصّية) — استثناء موثّق', quarter.isImage, quarter);

  // ============================================================
  // 5) ⭐ مفيش مسار بيبني ملصق نصّي بنفسه
  // ============================================================
  // القاعدة اللي بتمنع رجوع العطل: renderGradeLabelPNG و
  // buildGradeLabelHTML مايتندهش عليهم غير من جوه buildTextLabel.
  const sources = await p.evaluate(async () => {
    const files = ['js/app.js', 'js/print-screen.js', 'js/products.js', 'js/dashboard.js', 'js/barcode-scan.js'];
    const out = {};
    for (const f of files) out[f] = await (await fetch('/' + f)).text();
    return out;
  });
  // ⚠️ الفحص بيقيس **المكان** مش العدد. أول نسخة كانت مكتوب فيها "لازم
  // يكونوا نداءين بالظبط" — رقم زي ده بيقع أول ما تتغيّر الدالة من جوّه
  // من غير ما يكون فيه أي عطل. الشرط الحقيقي: كل نداء جوه buildTextLabel.
  const offenders = [];
  for (const [file, src] of Object.entries(sources)) {
    const lines = src.split('\n');
    // حدود buildTextLabel: من سطر تعريفها لحد أول تعريف دالة بعدها
    let from = -1, to = lines.length;
    lines.forEach((line, i) => {
      if (/^(async\s+)?function buildTextLabel\s*\(/.test(line)) from = i;
      else if (from >= 0 && to === lines.length && /^(async\s+)?function\s/.test(line) && i > from) to = i;
    });
    lines.forEach((line, i) => {
      if (!/renderGradeLabelPNG\(|buildGradeLabelHTML\(/.test(line)) return;
      if (/^(async\s+)?function\s/.test(line)) return;           // التعريف نفسه
      if (/window\.(renderGradeLabelPNG|buildGradeLabelHTML)/.test(line)) return; // تبديل في الفحوصات
      if (from >= 0 && i > from && i < to) return;               // جوه buildTextLabel — مسموح
      offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 60)}`);
    });
  }
  check('⭐ مفيش شاشة بتبني الملصق النصّي بنفسها — كلهم من buildTextLabel',
    offenders.length === 0, offenders);

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
