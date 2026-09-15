// ============================================================
// 🔤 خط الملصق — الافتراضي مايغيّرش ولا بايت، والمختار بيتطبّق فعلًا
// ============================================================
// اتطلب بالنص:
//   "ماشي موافق حط الخط في البرنامج مع اضافة كذا نوع من الخط اقدر
//    اغير بينهم"
//
// ⚠️⚠️ وفيه قاعدتين في المشروع ده الملف بيحرسهم:
//
//  ١) "متلمسيش اي حاجه في الملصق طلما موافقتيش عليها" — فالافتراضي
//     لازم يطلّع الملصق **بايت ببايت** زي ما كان قبل المفتاح.
//
//  ٢) الكانفاس **مابيطلبش** الخط. لو كتبت ctx.font بخط لسه مانزلش،
//     المتصفح بيرسم ببديل **من غير أي خطأ** — يعني ملصق مطبوع بخط
//     غير اللي اتختار. فالكود لازم مايستخدمش الخط إلا بعد ما يتأكد
//     إنه نزل، والفحص ده بيثبت ده بالطفرة.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

const CAT = {
  itemName: 'بونيه حجاب — بندانه سوري مفتوح درجة 4',
  barcodeNumber: '6221031490112',
  sellingPrice: 85,
  originalPrice: 110,
};
const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2, copies: 1 };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof labelFontStack === 'function' && typeof renderLabelPNG === 'function');

  // ============================================================
  // ⭐⭐⭐⭐⭐ الافتراضي = مافيش تغيير خالص
  // ============================================================
  const base = await p.evaluate((a) => {
    const BASE = 'Arial, Helvetica, Tahoma, sans-serif';
    return {
      id: getLabelFontId(),
      stack: labelFontStack(BASE),
      faceCSS: labelFontFaceCSS(),
      html: buildLabelHTML(a.cat, a.size, '', 1),
      png: renderLabelPNG(a.cat, a.size),
      // ⚠️ ومافيش خط بينزّل: القايمة دي بتقول المتصفح حمّل إيه فعلًا.
      loaded: [...document.fonts].filter((f) => /TZ /.test(f.family) && f.status === 'loaded').length,
    };
  }, { cat: CAT, size: SIZE });

  check('⭐⭐⭐ الافتراضي هو "خط الجهاز"', base.id === 'system', base.id);
  check('⭐⭐⭐⭐ ونص الخطوط راجع **زي ما هو بالحرف**',
    base.stack === 'Arial, Helvetica, Tahoma, sans-serif', base.stack);
  check('⭐⭐⭐⭐ ومافيش @font-face بيتحقن في الملصق المطبوع', base.faceCSS === '', base.faceCSS);
  check('⭐⭐⭐ ومافيش ولا ملف خط اتحمّل', base.loaded === 0, base.loaded);
  check('⭐ والملصق اتبنى فعلًا (مش فاضي)', !!base.png && base.png.length > 500 && base.html.length > 400, {
    png: (base.png || '').length, html: base.html.length,
  });

  // ============================================================
  // ⭐⭐⭐⭐⭐ الاختيار بيتطبّق فعلًا — على الصورة نفسها
  // ============================================================
  // ⚠️ مش بنفحص النص المكتوب في الـCSS بس. بنقارن **الصورة** قبل
  // وبعد: ده الدليل الوحيد إن اللي بيترسم على الورق اتغيّر فعلًا.
  const on = await p.evaluate(async (a) => {
    setLabelFontId('tajawal');
    const ready = await ensureLabelFontReady();
    const BASE = 'Arial, Helvetica, Tahoma, sans-serif';
    return {
      ready,
      id: getLabelFontId(),
      stack: labelFontStack(BASE),
      faceCSS: labelFontFaceCSS(),
      // ⚠️⚠️ القياس لازم يقرا من **نفس** الدالة اللي بترسم — ده
      // العطل اللي الخط اتحط عشانه أصلًا (الموبايل بيقيس بخط
      // والكمبيوتر بيرسم بخط تاني).
      measureFont: fitMeasureCtx(false).font,
      html: buildLabelHTML(a.cat, a.size, '', 1),
      png: renderLabelPNG(a.cat, a.size),
    };
  }, { cat: CAT, size: SIZE });

  check('⭐⭐⭐ الخط نزل فعلًا', on.ready === true, on);
  check('⭐⭐⭐⭐ ونص الخطوط بقى الخط المختار الأول', /^'TZ Tajawal', Arial/.test(on.stack), on.stack);
  check('⭐⭐⭐⭐ والقياس بيستعمل نفس الخط (مش خط تاني)',
    on.measureFont.indexOf('TZ Tajawal') !== -1, on.measureFont);
  check('⭐⭐⭐⭐⭐ والصورة المطبوعة **اتغيّرت** فعلًا', on.png !== base.png, {
    same: on.png === base.png,
  });
  check('⭐⭐⭐ والملصق النصّي كمان بقى بالخط', on.html.indexOf('TZ Tajawal') !== -1, null);

  // ⚠️⚠️ الروابط في المستند المطبوع **لازم** تبقى مطلقة: بيتحط في
  // إطار مالوش عنوان (srcdoc)، فالرابط النسبي مالوش أصل يتحسب منه
  // وبيفشل في سكوت — يعني ملصق بخط الجهاز والمستخدم فاكره اتغيّر.
  check('⭐⭐⭐⭐ ورابط الخط في الورقة المطبوعة **مطلق**',
    /url\('https?:\/\/[^']+\/fonts\/tajawal-arabic-400\.woff2'\)/.test(on.faceCSS), on.faceCSS.slice(0, 200));
  check('⭐⭐⭐ وفيه المقطع العربي (وإلا العربي هيطلع مربعات)',
    /unicode-range:U\+0600-06FF/.test(on.faceCSS), null);
  check('⭐⭐ والوزنين موجودين (العريض للسعر)',
    /font-weight:400/.test(on.faceCSS) && /font-weight:700/.test(on.faceCSS), null);

  // ============================================================
  // ⭐⭐⭐⭐⭐ الحارس: خط مانزلش = نرجع لخط الجهاز، مانرسمش بيه
  // ============================================================
  // ⚠️⚠️ ده أهم فحص في الملف. من غير الحارس، الملصق بيتطبع بخط
  // بديل **من غير أي خطأ** — ومحدش هياخد باله غير من الورق.
  const guard = await p.evaluate((a) => {
    labelFontReadyId = ''; // كأن الملف مانزلش
    const BASE = 'Arial, Helvetica, Tahoma, sans-serif';
    return {
      stack: labelFontStack(BASE),
      faceCSS: labelFontFaceCSS(),
      png: renderLabelPNG(a.cat, a.size),
    };
  }, { cat: CAT, size: SIZE });
  check('⭐⭐⭐⭐⭐ الخط اللي مانزلش مابيترسمش بيه',
    guard.stack === 'Arial, Helvetica, Tahoma, sans-serif', guard.stack);
  check('⭐⭐⭐⭐ ومافيش @font-face بيتبعت لخط مش جاهز', guard.faceCSS === '', null);
  check('⭐⭐⭐⭐ والملصق بيرجع **بايت ببايت** زي الافتراضي', guard.png === base.png, null);

  // ============================================================
  // ⭐⭐⭐ الاختيار بيتحفظ، والرجوع بيرجّع كل حاجة
  // ============================================================
  const back = await p.evaluate(async (a) => {
    const saved = localStorage.getItem('tazweed_label_font');
    setLabelFontId('system');
    await ensureLabelFontReady();
    return {
      saved,
      id: getLabelFontId(),
      png: renderLabelPNG(a.cat, a.size),
      html: buildLabelHTML(a.cat, a.size, '', 1),
    };
  }, { cat: CAT, size: SIZE });
  check('⭐⭐ الاختيار بيتحفظ على الجهاز', back.saved === 'tajawal', back.saved);
  check('⭐⭐⭐⭐ و"خط الجهاز" بيرجّع الصورة والنص زي الأول بالحرف',
    back.png === base.png && back.html === base.html, { png: back.png === base.png, html: back.html === base.html });

  // ⚠️ اسم غلط (من نسخة أقدم أو إعداد اتبعت غلط) مايوقّعش الملصق.
  const junk = await p.evaluate((a) => {
    setLabelFontId('خط مش موجود');
    return { id: getLabelFontId(), png: renderLabelPNG(a.cat, a.size) };
  }, { cat: CAT, size: SIZE });
  check('⭐⭐⭐ اسم خط مش معروف بيرجع للافتراضي مش بيقع',
    junk.id === 'system' && junk.png === base.png, junk.id);

  check('⭐ مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  console.log(pass.map((x) => '   ✓ ' + x).join('\n'));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    console.log(fail.map((x) => '   ✗ ' + x).join('\n'));
    process.exit(1);
  }
  console.log(`\nكل الفحوص نجحت (${pass.length}).`);
})();
