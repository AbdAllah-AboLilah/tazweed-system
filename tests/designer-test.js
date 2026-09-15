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
const DESIGN = {
  name: 'الافتراضي', widthMm: 38, heightMm: 25, halves: 2,
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

  await p.goto('http://localhost:8899/tests/harness.html');
  await p.setContent(html);
  await p.waitForFunction(() => typeof window.draw === 'function' && window.d);

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

  // ⚠️ والسعر القديم فاضي = العنصر يختفي، مش يطلع خانة فاضية عليها خط.
  const disc = await p.evaluate(async () => {
    const set = (v) => {
      const e = document.getElementById('s-old');
      e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('99 L.E');
    const withOld = document.querySelectorAll('#sheet .el').length;
    set('');
    return { withOld, without: document.querySelectorAll('#sheet .el').length };
  });
  check('⭐⭐ "من غير خصم" بيشيل السعر القديم من المعاينة',
    disc.withOld === disc.without + 2, disc); // ملصقين × عنصر واحد

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
  // ⭐⭐⭐⭐ رسالة "الخط أكبر من الصندوق" بتقول الأرقام والتلات حلول
  // ============================================================
  // ⚠️⚠️ اتبلّغ بالنص: "مش عاوز يتحفظ ليه ايه المفروض يتحفظ" — وهو
  // كان حاطط ٣ سطور × ١.٩مم في صندوق ٦مم. الرسالة القديمة كانت
  // ساكتة عن **عدد السطور**، وهو السبب الحقيقي.
  const msg = await p.evaluate(() => {
    const e = el('name');
    e.lines = 3; e.fontMm = 1.9; e.h = 6;
    render();
    return document.getElementById('hint').textContent;
  });
  check('⭐⭐⭐ الرسالة بتقول الحساب بالأرقام', /6\.8/.test(msg) && /6\.0/.test(msg), msg);
  check('⭐⭐⭐ وبتقول التلات حلول (السطور كمان مش الطول والخط بس)',
    /سطور/.test(msg) && /كبّر «الطول»/.test(msg) && /صغّر «حجم الخط»/.test(msg), msg);

  // ============================================================
  // ⭐⭐⭐⭐ "اطبع تجربة" بيطلّع ورقة بمقاس الملصق بالظبط
  // ============================================================
  const ph = await p.evaluate(() => {
    const e = el('name');
    e.lines = 2; e.fontMm = 1.9; e.h = 4.6; // رجّعه صالح
    return printHTML();
  });
  check('⭐⭐⭐ ورق الطباعة بمقاس الملصق بالحرف', /@page\{size:38mm 25mm;margin:0\}/.test(ph), ph.slice(0, 160));
  check('⭐⭐ وفيه الرمز صورة جوّه الورقة', ph.includes('data:image/'), null);
  check('⭐⭐ وبيقيس ويصغّر جوّه نافذة الطباعة كمان', ph.includes('scrollHeight') && ph.includes('window.print()'), null);
  // ⚠️ الاسم لازم يبقى rtl في الورقة — من غيرها الأرقام اللي جوّه
  // الكلام العربي بتطلع في المكان الغلط.
  check('⭐⭐ واسم الصنف بيتكتب من اليمين', /direction:rtl/.test(ph), null);

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
