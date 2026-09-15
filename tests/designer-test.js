// ============================================================
// 🎨 مصمّم الملصق — المعاينة لازم تقول الحقيقة
// ============================================================
// ⚠️⚠️ الصفحة دي مكتوبة جوّه البرنامج المساعد (helper/designpage.go)
// كنص، فمفيش فحص Go يقدر يشغّلها. وفحوص Go بتشوف **النص** بس: هل
// الكلمة دي موجودة ولا لأ. والعطل اللي الملف ده اتكتب عشانه عدّى من
// الفحوص دي كلها وهي خضرا:
//
//   الكود كان بيقيس box.clientHeight **قبل** ما يحط الصندوق في
//   الصفحة. المتصفح بيرجّع صفر لأي حاجة لسه مارُسمتش، فالشرط كان
//   "صفر أكبر من واحد" = غلط دايمًا، ولوب التصغير **عمره ما اشتغل**.
//
// يعني المعاينة كانت بتوري الاسم الطويل بالمقاس اللي طلبته وهو
// **مش هيطلع كده على الورق** — وده عكس السبب اللي المصمّم اتعمل
// عشانه بالظبط. حاجة زي دي مستحيل تتمسك غير بتشغيل الصفحة فعلًا.
//
// فالملف ده بيسحب الصفحة من الملف بتاع Go ويشغّلها في متصفح حقيقي.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

const root = path.join(__dirname, '..');

// ⚠️ بنسحب النص اللي بين أول علامتين اقتباس مايلين في designpage.go.
// لو الشكل ده اتغيّر، الفحص بيقع بصوت — مش بيعدّي على صفحة فاضية.
function designerPage() {
  const src = fs.readFileSync(path.join(root, 'helper', 'designpage.go'), 'utf8');
  const a = src.indexOf('const designerPage = `');
  if (a < 0) throw new Error('مش لاقي designerPage في helper/designpage.go');
  const start = src.indexOf('`', a) + 1;
  const end = src.indexOf('`', start);
  if (end < 0) throw new Error('نص الصفحة مش مقفول');
  return src.slice(start, end);
}

// نفس التصميم الافتراضي اللي في helper/design.go (38×25 بملصقين).
// ⚠️ قايمة الخطوط اللي البرنامج بيقدّمها على /fonts.json. الفحص اللي
// بيتأكد إنها مطابقة للنظام في Go (TestFontListMatchesSystem) — هنا
// بنحاكيها عشان الصفحة تشتغل زي ما بتشتغل على الماكينة.
const FONTS = [
  { id: 'system', label: 'خط الجهاز (الافتراضي)', hint: 'زي ما هو دلوقتي بالظبط.', family: '', weights: null },
  { id: 'plex', label: 'Plex Arabic — نفس خط الشاشة', hint: 'أضيق خط في القايمة.', family: 'Plex Arabic', weights: [400, 600] },
  { id: 'cairo', label: 'Cairo — كايرو', hint: 'حديث وواضح.', family: 'TZ Cairo', weights: [400, 700] },
  { id: 'tajawal', label: 'Tajawal — تجوال', hint: 'أضيق شوية.', family: 'TZ Tajawal', weights: [400, 700] },
  { id: 'almarai', label: 'Almarai — المراعي', hint: 'تخين.', family: 'TZ Almarai', weights: [400, 700] },
];

const ARABIC_RANGE =
  'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, ' +
  'U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, ' +
  'U+FE70-FE74, U+FE76-FEFC';

// ⚠️ بنبني نفس الـCSS اللي fontFaceCSS() في Go بتطلّعه — بس الروابط
// بتروح لمجلد fonts/ الحقيقي في المستودع، فالخط بينزل فعلًا
// والقياس بيبقى حقيقي مش محاكاة.
const SLUG = { plex: 'plex-ar', cairo: 'cairo', tajawal: 'tajawal', almarai: 'almarai' };
function fontsCSS() {
  let out = '';
  for (const f of FONTS) {
    if (!f.family) continue;
    for (const w of f.weights) {
      out += `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};font-display:block;` +
        `src:url('/fonts/${SLUG[f.id]}-arabic-${w}.woff2') format('woff2');unicode-range:${ARABIC_RANGE}}\n`;
      out += `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};font-display:block;` +
        `src:url('/fonts/${SLUG[f.id]}-latin-${w}.woff2') format('woff2')}\n`;
    }
  }
  return out;
}

const DESIGN = {
  name: 'الافتراضي', widthMm: 38, heightMm: 25, halves: 2, font: 'system',
  elements: [
    { kind: 'qr', x: 2.0, y: 1.5, w: 9.5, h: 9.5 },
    { kind: 'name', x: 12.5, y: 1.2, w: 23.5, h: 4.6, fontMm: 1.9, lines: 2, align: 'center', weight: 'normal', overflow: 'shrink', show: 'always' },
    { kind: 'code', x: 12.5, y: 5.9, w: 23.5, h: 2.9, fontMm: 2.4, lines: 1, align: 'center', weight: 'normal', overflow: 'shrink', show: 'always' },
    { kind: 'price', x: 12.5, y: 8.8, w: 23.5, h: 2.9, fontMm: 2.4, lines: 1, align: 'center', weight: 'bold', overflow: 'shrink', show: 'always' },
    { kind: 'oldPrice', x: 12.5, y: 8.8, w: 9.0, h: 2.9, fontMm: 2.0, lines: 1, align: 'center', weight: 'normal', overflow: 'shrink', show: 'ifDiscount' },
  ],
};

(async () => {
  const html = designerPage();
  const qrLib = fs.readFileSync(path.join(root, 'js', 'vendor', 'qrcode-generator.js'), 'utf8');

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));

  // البرنامج بيقدّم الاتنين دول من 127.0.0.1 — بنقلّدهم هنا.
  await p.route('**/qrcode.js', (r) => r.fulfill({ contentType: 'application/javascript; charset=utf-8', body: qrLib }));
  await p.route('**/design/all', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ designs: [DESIGN], active: DESIGN.name }) }));
  await p.route('**/fonts.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ fonts: FONTS }) }));
  await p.route('**/fonts.css', (r) => r.fulfill({ contentType: 'text/css; charset=utf-8', body: fontsCSS() }));
  // ⚠️ ملفات الخط نفسها **مابتتقلّدش**: بتروح لمجلد fonts/ الحقيقي
  // على السيرفر، فالخط بينزل فعلًا والتصغير اللي بنقيسه حقيقي.

  // ⚠️⚠️ الصفحة بتتقدّم على **عنوان لوحدها** مش بـsetContent فوق
  // صفحة الفحوص. السبب اتمسك بالتجربة: setContent بتبدّل المحتوى بس
  // والمتغيّرات العامة بتاعة الصفحة القديمة بتفضل موجودة — و
  // js/appearance.js عنده متغيّر اسمه FONTS كمان، فالصفحة كانت
  // بتقع على "Identifier 'FONTS' has already been declared" وتموت
  // من غير ما يبان سبب واضح.
  //
  // وكده الفحص بيشبه الحقيقة أكتر: البرنامج بيقدّمها على /designer.
  await p.route('**/designer', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await p.goto('http://localhost:8899/designer');
  await p.waitForFunction(() => typeof window.draw === 'function' && window.d && window.FONTS && window.FONTS.length);

  // مقاس الاسم المرسوم فعلًا، بالملليمتر
  const nameMm = () => p.evaluate(() => {
    const box = [...document.querySelectorAll('#sheet .el')]
      .find((x) => x.querySelector('span') && x.querySelector('span').textContent === SAMPLE.name);
    const sp = box && box.querySelector('span');
    return {
      mm: sp ? +(parseFloat(sp.style.fontSize) / px()).toFixed(2) : null,
      shrunk: document.getElementById('shrunk').textContent,
    };
  });

  // ============================================================
  // ⭐⭐⭐⭐⭐ لوب التصغير لازم **يشتغل** فعلًا
  // ============================================================
  // ده الفحص اللي كان ناقص. مش "هل الكود موجود" — هل الرقم اتغيّر.
  await p.fill('#s-name', 'بونيه حجاب بندانه سوري مفتوح درجة اولى قطن مصري 100% مقاس كبير جدا');
  await p.waitForTimeout(350);
  const long = await nameMm();
  check('⭐⭐⭐ الاسم الطويل بيتصغّر فعلًا (مش بيفضل على المقاس المطلوب)',
    long.mm !== null && long.mm < 1.9 - 0.05, long);
  // ⚠️ ومايتصغّرش لدرجة إنه مايتقراش — لو وصل أقل من نص المطلوب،
  // يبقى اللوب بيدوّر في الفاضي.
  check('⭐⭐ والتصغير في حدود المعقول', long.mm > 0.9, long);
  check('⭐⭐⭐ وبيقول صراحةً إنه اتصغّر (مش في سكوت)',
    /اتصغّر/.test(long.shrunk) && /اسم الصنف/.test(long.shrunk), long.shrunk);

  // ⚠️ والحالة العكسية مهمة زيها: الاسم اللي بيدخل **مايتلمسش**.
  // من غير الفحص ده، لوب بيصغّر كل حاجة كان هيعدّي.
  await p.click('#s-short');
  await p.waitForTimeout(300);
  const short = await nameMm();
  check('⭐⭐⭐ الاسم القصير بياخد المقاس المطلوب بالظبط',
    short.mm === 1.9 && short.shrunk === '', short);

  // ============================================================
  // ⭐⭐⭐⭐ بيانات التجربة بتتربط بالمعاينة وانت بتكتب
  // ============================================================
  const typed = await p.evaluate(async () => {
    const set = (id, v) => {
      const e = document.getElementById(id);
      e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('s-name', 'طرحة قطن');
    set('s-code', '6221031490112');
    set('s-price', '120 L.E');
    const txt = [...document.querySelectorAll('#sheet .el span')].map((s) => s.textContent);
    return { txt, sample: JSON.parse(JSON.stringify(SAMPLE)) };
  });
  check('⭐⭐ اللي بتكتبه بيوصل للمعاينة على طول',
    typed.txt.includes('طرحة قطن') && typed.txt.includes('6221031490112') && typed.txt.includes('120 L.E'), typed.txt);

  // ============================================================
  // ⭐⭐⭐⭐ السعر القديم بيترسم **جنب** السعر مش في صندوقه
  // ============================================================
  // ⚠️⚠️ الشكل ده اتغيّر في v0.98.0 بعد ما الصورة أثبتت إن الصندوقين
  // بيتراكبوا: سعرين من رقمين (110 L.E و85 L.E) طلعوا فوق بعض.
  // ولو فصلنا الصندوقين، الصنف اللي مافيهوش خصم سعره بيقع في نص
  // الجزء اليمين بدل نص الملصق. الزوج المتوسّط بيحل الاتنين.
  //
  // فالفحص بقى على **النص اللي جوّه صندوق السعر**، مش على عدد
  // الصناديق — لأن الصندوق واحد في الحالتين.
  const priceBox = () => p.evaluate(() => {
    const boxes = [...document.querySelectorAll('#sheet .el')];
    const b = boxes.find((x) => (x.textContent || '').indexOf(SAMPLE.price) !== -1);
    if (!b) return null;
    const spans = [...b.querySelectorAll('span')];
    return {
      txt: spans.map((s) => s.textContent),
      struck: spans.filter((s) => /line-through/.test(s.style.textDecoration)).map((s) => s.textContent),
    };
  });
  const setOld = (v) => p.evaluate((val) => {
    const e = document.getElementById('s-old');
    e.value = val;
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);

  await setOld('99 L.E');
  const withOld = await priceBox();
  check('⭐⭐⭐⭐ السعر والقديم في **نفس** الصندوق',
    withOld && withOld.txt.length === 2 && withOld.txt.indexOf('99 L.E') !== -1, withOld);
  check('⭐⭐⭐ والقديم مشطوب', withOld && withOld.struck.join() === '99 L.E', withOld);

  await setOld('');
  const noOld = await priceBox();
  // ⚠️ بنقارن بـSAMPLE.price مش برقم مكتوب: فحوص فوق بتغيّر السعر،
  // والرقم المحفور كان بيوقّع الفحص على حاجة مالهاش علاقة.
  const curPrice = await p.evaluate(() => SAMPLE.price);
  check('⭐⭐⭐⭐ و"من غير خصم" بيسيب السعر لوحده متوسّط',
    noOld && noOld.txt.length === 1 && noOld.txt[0] === curPrice, { noOld, curPrice });

  // ============================================================
  // ⭐⭐⭐⭐⭐ رمز QR حقيقي من الرقم اللي في الخانة
  // ============================================================
  // ⚠️ مش مربع توضيحي: عدد مربعات الرمز بيزيد كل ما الرقم يطول،
  // فاللي بيظبط المقاس لازم يشوف الرمز الحقيقي.
  const qr = await p.evaluate(() => {
    const src = (n) => {
      const e = document.getElementById('s-code');
      e.value = n;
      e.dispatchEvent(new Event('input', { bubbles: true }));
      const im = document.querySelector('#sheet img');
      return im ? im.src : '';
    };
    const a = src('7781430');
    const bq = src('6221031490112');
    return { short: a.slice(0, 22), same: a === bq, both: !!a && !!bq };
  });
  check('⭐⭐⭐ الرمز بيتولّد فعلًا (صورة مش مربع رمادي)',
    qr.both && /^data:image\//.test(qr.short), qr);
  check('⭐⭐⭐ ورقم أطول = رمز مختلف (يعني بيتولّد من الرقم فعلًا)', !qr.same, qr);

  // ============================================================
  // ⭐⭐⭐⭐⭐ الحالة اللي اتبلّغت: ٣ سطور لازم تعدّي
  // ============================================================
  // ⚠️⚠️ اتبلّغ بالنص: "جربت اخلي الاسم ينزل في ٣ سطور نزل عادي بس
  // لما جيت احفظ التصميم قالي ان الحجم لازم يكبر بالرغم من في
  // المعاينة قدامي طلعت عادي وانا كنت راضي".
  //
  // وكان معاه حق: المعاينة بتصغّر زي الملصق الحقيقي، فاللي كان
  // على الشاشة مظبوط فعلًا. الرسالة بقت **معلومة** بتقول الخط
  // هيطلع كام، مش تحذير بيمنع الحفظ.
  const info = await p.evaluate(() => {
    const e = el('name');
    e.lines = 3; e.fontMm = 1.9; e.h = 6; e.overflow = 'shrink';
    render();
    return document.getElementById('hint').textContent;
  });
  check('⭐⭐⭐⭐⭐ ٣ سطور بقت معلومة مش تحذير', info.indexOf('ℹ️') === 0, info);
  check('⭐⭐⭐⭐ وبتقول الخط هيطلع كام فعلًا', /1\.67مم/.test(info), info);
  check('⭐⭐⭐ ومش بتقول الحفظ ممنوع', !/⚠️/.test(info), info);

  // ⚠️ والتحذير الأحمر فضل للحالة اللي الكلام فيها مش هيتقرا أصلًا.
  const warn = await p.evaluate(() => {
    const e = el('name');
    e.lines = 3; e.h = 3.5; // 3.5 ÷ 3.6 = 0.97مم
    render();
    return document.getElementById('hint').textContent;
  });
  check('⭐⭐⭐⭐ والمساحة اللي مايتقراش فيها لسه بتحذّر', /⚠️/.test(warn) && /0\.97/.test(warn), warn);

  // ============================================================
  // ⭐⭐⭐⭐⭐ "اطبع تجربة" بتروح للطابعة على طول
  // ============================================================
  // ⚠️⚠️ النسخة الأولى كانت بتفتح نافذة طباعة المتصفح، واتبلّغ بالنص
  // إنها بايظة: "بيطلع ورق فاضي من الماكينه والملصق بيظهر حتي من
  // الجنب ويطلع ٣ ورقات". السبب: نافذة المتصفح بتحط هوامشها وبتحجّم
  // لـA4، والطابعة الحرارية مالهاش دعوة بده.
  //
  // فالفحص ده بيتأكد إن الطريق بقى زي الصفحة الرئيسية بالظبط:
  // كانفاس بمقاس نقط الطابعة → صورة → POST على /label.
  await p.evaluate(() => {
    const e = el('name');
    e.lines = 2; e.fontMm = 1.9; e.h = 4.6; e.overflow = 'shrink';
    d.font = 'system';
    render();
  });

  let sent = null;
  await p.route('**/label', (r) => {
    sent = JSON.parse(r.request().postData() || '{}');
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, width: 304, height: 200, bytes: 1234, count: 1 }) });
  });
  await p.click('#s-print');
  await p.waitForFunction(() => /اتبعت ملصق واحد/.test(document.getElementById('msg').textContent), null, { timeout: 8000 }).catch(() => {});

  check('⭐⭐⭐⭐⭐ بيبعت على /label مش بيفتح نافذة طباعة', sent !== null, sent);
  check('⭐⭐⭐⭐ وبمقاس الملصق الحقيقي',
    sent && sent.widthMm === 38 && sent.heightMm === 25, sent && { w: sent.widthMm, h: sent.heightMm });
  check('⭐⭐⭐⭐ ولاصقة **واحدة** بس (التجربة ماتكلّفش رول)',
    sent && sent.labels && sent.labels.length === 1 && sent.labels[0].copies === 1, sent && sent.labels);

  // ⚠️⚠️ والصورة لازم تبقى بمقاس **نقط الطابعة** بالظبط: 38مم على
  // 203 نقطة/بوصة = 304 نقطة. أي مقاس تاني معناه إن الطابعة هتمطّها
  // أو تقصّها.
  const img = await p.evaluate((b64) => new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      // ⚠️ وبنتأكد إنها **مش فاضية**: صورة بيضا بالكامل معناها إن
      // الرسم فشل والطابعة هتطلّع ورقة فاضية — وده بالظبط اللي اتبلّغ.
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const px = x.getImageData(0, 0, im.width, im.height).data;
      let dark = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] < 128) dark++;
      res({ w: im.width, h: im.height, dark });
    };
    im.onerror = () => res(null);
    im.src = 'data:image/png;base64,' + b64;
  }), sent ? sent.labels[0].png : '');
  check('⭐⭐⭐⭐⭐ الصورة بمقاس نقط الطابعة (304×200)', img && img.w === 304 && img.h === 200, img);
  check('⭐⭐⭐⭐⭐ والصورة **مش فاضية** (فيها حبر فعلًا)', img && img.dark > 500, img);

  // ⚠️ وبيوري اللي اتبعت على الشاشة — عشان لو المعاينة اختلفت عن
  // الورق، تشوف بعينك من غير ما تستنى اللاصقة تخرج.
  check('⭐⭐⭐ وبيعرض الصورة اللي اتبعتت',
    await p.evaluate(() => !document.getElementById('sent-wrap').hidden
      && /^data:image\/png/.test(document.getElementById('sent-img').src)), null);

  await p.unroute('**/label');

  // ============================================================
  // ⭐⭐⭐⭐⭐ تغيير الخط لازم يغيّر **القياس** مش الشكل بس
  // ============================================================
  // اتطلب بالنص: "عاوزك تضيف تغير الخط في نظام تصميم الملصق في
  // البرنامج المساعد ... بحيث بردوا اقدر اشوف تغير الخط هياثر ازاي".
  //
  // ⚠️⚠️ و"يأثر" هنا معناها حاجة محدّدة: الخط الأضيق بيخلّي نفس
  // الاسم يدخل بمقاس أكبر. لو غيّرنا الخط والمقاس المعروض ما اتغيّرش،
  // يبقى المعاينة بتقيس بخط الجهاز وبتكتب اسم خط تاني — وده أسوأ من
  // إن الخانة ماتبقاش موجودة أصلًا.
  // ⚠️⚠️ لازم **اسم طويل** هنا: الاسم القصير بيدخل بالمقاس المطلوب
  // في أي خط، فالمقارنة كانت هتطلّع نفس الرقم للخطوط كلها والفحص
  // يعدّي وهو مايقيسش حاجة. (وده اللي حصل فعلًا أول مرة كتبته.)
  // فرق الخطوط بيبان **بس** لما التصغير يشتغل.
  await p.fill('#s-name', 'بونيه حجاب بندانه سوري مفتوح درجة اولى قطن مصري 100% مقاس كبير جدا');
  await p.waitForTimeout(300);

  const byFont = {};
  for (const id of ['system', 'plex', 'almarai']) {
    await p.selectOption('#dfont', id);
    await p.waitForTimeout(600);
    byFont[id] = await p.evaluate(() => {
      const box = [...document.querySelectorAll('#sheet .el')]
        .find((x) => x.querySelector('span') && x.querySelector('span').textContent === SAMPLE.name);
      const sp = box && box.querySelector('span');
      return {
        mm: sp ? +(parseFloat(sp.style.fontSize) / px()).toFixed(2) : null,
        fam: sp ? sp.style.fontFamily : '',
        saved: d.font,
        loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
      };
    });
  }
  check('⭐⭐⭐ الخط المختار بيتحفظ في التصميم نفسه', byFont.plex.saved === 'plex', byFont.plex.saved);
  check('⭐⭐⭐ والمعاينة بترسم بيه فعلًا', /Plex Arabic/.test(byFont.plex.fam), byFont.plex.fam);
  check('⭐⭐⭐⭐ والملف بينزل من البرنامج (مش خط بديل)',
    byFont.plex.loaded.some((f) => /Plex Arabic/.test(f)), byFont.plex.loaded);
  check('⭐⭐⭐⭐⭐ وتغيير الخط بيغيّر المقاس اللي هيطلع على الورق',
    byFont.plex.mm !== byFont.system.mm && byFont.almarai.mm !== byFont.plex.mm, byFont);
  // ⚠️ والاتجاه لازم يبقى صح: بلكس أضيق، يعني نفس الاسم بيدخل بمقاس
  // **أكبر**. لو طلع أصغر، يبقى إحنا بنقيس بخط غير اللي بنرسم بيه.
  check('⭐⭐⭐⭐ وبلكس (الأضيق) بيدّي مقاس أكبر من خط الجهاز',
    byFont.plex.mm > byFont.system.mm, byFont);

  // ⚠️ و"خط الجهاز" لازم يرجّع كل حاجة زي ما كانت بالحرف.
  await p.selectOption('#dfont', 'system');
  await p.waitForTimeout(400);
  const backToSystem = await p.evaluate(() => {
    const box = [...document.querySelectorAll('#sheet .el')]
      .find((x) => x.querySelector('span') && x.querySelector('span').textContent === SAMPLE.name);
    const sp = box && box.querySelector('span');
    return { fam: sp.style.fontFamily, mm: +(parseFloat(sp.style.fontSize) / px()).toFixed(2) };
  });
  check('⭐⭐⭐⭐ و"خط الجهاز" بيرجّع الخط والمقاس زي الأول',
    !/TZ |Plex/.test(backToSystem.fam) && backToSystem.mm === byFont.system.mm, backToSystem);

  // ⚠️⚠️ ولازم الخط يبقى **في الصورة المبعوتة** مش في المعاينة بس:
  // الكانفاس مابيطلبش الخط لوحده، فلو رسمنا قبل ما ينزل، الورق
  // بيطلع بخط الجهاز والشاشة بخط تاني.
  let sent2 = null;
  await p.route('**/label', (r) => {
    sent2 = JSON.parse(r.request().postData() || '{}');
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, width: 304, height: 200, bytes: 1, count: 1 }) });
  });
  await p.selectOption('#dfont', 'cairo');
  await p.waitForTimeout(500);
  await p.click('#s-print');
  await p.waitForFunction(() => /اتبعت ملصق واحد/.test(document.getElementById('msg').textContent), null, { timeout: 8000 }).catch(() => {});
  const fontPng = await p.evaluate(() => document.getElementById('sent-img').src);
  await p.unroute('**/label');
  check('⭐⭐⭐⭐ الصورة المبعوتة بتتغيّر لما الخط يتغيّر',
    sent2 !== null && fontPng !== '' && sent2.labels[0].png !== (sent ? sent.labels[0].png : ''), null);

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
