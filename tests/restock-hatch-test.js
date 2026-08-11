// ============================================================
// تظليل "الدرجة خلصت" في ورقة التزويد
// ============================================================
// ⚠️ الفحص ده اتكتب بعد ما التظليل **اختفى من الورق المطبوع** مرتين.
// المرة اللي فاتت الورقة طلعت من غير أي تظليل خالص، والمعاينة على الشاشة
// كانت سليمة تمامًا — فمحدش لاحظ غير لما الورق خرج من الماكينة.
//
// السبب: التظليل اتحوّل لـ`repeating-linear-gradient`. كروم بيدعمه
// (فالمعاينة تمام)، لكن محرك الطباعة بتاع QZ **مش بيدعمه** — وورقة
// التزويد بتتبعت لـQZ كـHTML، يعني بترتسم بالمحرك ده هو.
//
// فالفحص ده بيمسك تلات حاجات مع بعض:
//   1) التظليل **رسم** (SVG) مش خلفية CSS — ده اللي بيخليه يطلع على أي محرك
//   2) بيتحط على الدرجات اللي "خلصت" **بس**
//   3) حجمه صغير — النسخة القديمة كانت 2 كيلو للخانة الواحدة، فورقة فيها
//      80 درجة خلصت كانت 160 كيلو لوحدها (حد رسالة QZ 48 كيلو)
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildRestockHTML === 'function');

  // فئة فيها درجات خلصت ودرجات لسه موجودة، في مجموعتين، ومعاها أساسية
  const build = await p.evaluate(() => {
    const cat = { id: 'c1', name: 'كريب سادة لوكس', colorGroups: ['بيجات', 'الوان'] };
    const grades = [];
    for (let i = 1; i <= 10; i++) {
      grades.push({ id: 'b' + i, number: i, group: 'بيجات', status: i <= 4 ? 'out' : 'normal' });
    }
    for (let i = 1; i <= 10; i++) {
      grades.push({ id: 'l' + i, number: i, group: 'الوان', status: i <= 3 ? 'out' : 'normal' });
    }
    grades.push({ id: 'w', name: 'أبيض', isBase: true, group: 'بيجات', status: 'out' });
    grades.push({ id: 'k', name: 'أسود', isBase: true, group: 'بيجات', status: 'normal' });
    return { html: buildRestockHTML(cat, grades, '', true), outCount: 8 };
  });

  // ============================================================
  // 1) ⭐ التظليل رسم مش خلفية
  // ============================================================
  // ⚠️ الفحص ده بالذات هو اللي كان هيمسك العطل. ماينفعش نكتفي بـ"في
  // كلمة hatch في الكود" — الاسم فضل موجود وهو مكسور.
  check('⭐ التظليل SVG (رسم) — مش تدرّج CSS',
    /<svg[^>]*class="hatch"/.test(build.html), build.html.slice(0, 200));
  check('⭐ مفيش repeating-linear-gradient خالص',
    !/repeating-linear-gradient/.test(build.html));
  check('⭐ ولا background-image للتظليل',
    !/\.hatch\s*\{[^}]*background/.test(build.html));
  check('نمط الـSVG معرّف في الورقة', /<pattern\s+id="hx"/.test(build.html));
  check('والخانة بتشاور عليه', /fill="url\(#hx\)"/.test(build.html));

  // ============================================================
  // 2) ⭐ على الدرجات اللي خلصت بس
  // ============================================================
  const hatches = (build.html.match(/class="hatch"/g) || []).length;
  check('⭐ عدد الخانات المظللة = عدد الدرجات اللي خلصت',
    hatches === build.outCount, { hatches, expected: build.outCount });
  // ومفيش تظليل جوه خانة درجة موجودة
  const rows = build.html.match(/<div class="row">[\s\S]*?<\/div>\s*<\/div>/g) || [];
  check('الورقة فيها صفوف فعلًا', rows.length > 0, rows.length);

  // ============================================================
  // 3) ⭐ الحجم — السبب اللي خلّى حد يشيله من الأساس
  // ============================================================
  // النسخة القديمة: 25 عنصر <line> جوه كل خانة ≈ 2000 بايت.
  // دلوقتي: مستطيل واحد بيشاور على النمط ≈ 100 بايت.
  const perCell = await p.evaluate(() => HATCH_CELL.length);
  check('⭐ التظليل أقل من 150 بايت للخانة (كان ~2000)', perCell < 150, perCell);

  // ولنتأكد على ورقة حقيقية كبيرة: فئة 245 درجة كلها خلصت
  const big = await p.evaluate(() => {
    const cat = { id: 'c2', name: 'مودال سفنجة', colorGroups: [] };
    const grades = [];
    for (let i = 1; i <= 245; i++) grades.push({ id: 'g' + i, number: i, group: '', status: 'out' });
    const html = buildRestockHTML(cat, grades, '', false);
    return {
      bytes: new TextEncoder().encode(html).length,
      limit: QZ_MAX_MESSAGE_BYTES,
      splitAt: RESTOCK_SAFE_BYTES,
    };
  });
  // ⭐ دي الفئة اللي كانت بتفشل فعلًا عند المستخدم (245 صنف).
  check('⭐ فئة 245 درجة كلها خلصت بتدخل في رسالة QZ واحدة',
    big.bytes < big.limit, big);
  // ⭐ والأهم: تحت حد التقسيم التلقائي كمان — يعني بتطبع **ورقة واحدة**
  // زي ما المستخدم عايز، من غير ما تتقسّم لمجموعات.
  // ⚠️ بنقارن بالثابت الحقيقي مش برقم مكتوب هنا، عشان لو الحد اتغيّر
  // الفحص يتغيّر معاه بدل ما يقارن بنسخة قديمة.
  check('⭐ وبتطبع ورقة واحدة من غير تقسيم تلقائي',
    big.bytes < big.splitAt, big);

  // ============================================================
  // 4) التظليل بيتحط فعلًا في المكان الصح لما المتصفح يرسمه
  // ============================================================
  // مش بنصدّق النص — بنرسمه ونقيس. الخانة المظللة لازم يبقى فيها حبر
  // أسود، واللي مش مظللة لازم تفضل بيضا (عشان تكتب فيها بالقلم).
  const p2 = await b.newPage({ deviceScaleFactor: 2 });
  await p2.setContent(build.html);
  const drawn = await p2.evaluate(() => {
    const blanks = [...document.querySelectorAll('.blank')];
    const withSvg = blanks.filter((el) => el.querySelector('svg.hatch'));
    const without = blanks.filter((el) => !el.querySelector('svg.hatch'));
    const box = (el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; };
    return {
      hatched: withSvg.length, plain: without.length,
      // الـSVG لازم يملا الخانة، مش يبقى نقطة في ركن
      fills: withSvg.slice(0, 5).map((el) => {
        const c = box(el), s = box(el.querySelector('svg.hatch'));
        return { okW: s.w >= c.w - 1, okH: s.h >= c.h - 1, c, s };
      }),
      defsHidden: (() => {
        const d = document.querySelector('svg[aria-hidden="true"]');
        return d ? d.getBoundingClientRect().height <= 1 : false;
      })(),
    };
  });
  check('⭐ الرسم بيملا خانة الكتابة كلها',
    drawn.fills.length > 0 && drawn.fills.every((f) => f.okW && f.okH), drawn.fills);
  check('الخانات اللي مش خلصت فاضلة بيضا للكتابة', drawn.plain > 0, drawn);
  check('تعريف النمط مش بياخد مكان في الورقة', drawn.defsHidden, drawn);

  // ============================================================
  // 5) حزمة الورق (كل مجموعة ورقة) — التظليل لازم يفضل شغال فيها كمان
  // ============================================================
  // ⚠️ الحزمة بتلمّ أجسام الورق في مستند واحد. لو تعريف النمط كان في
  // الـ<head> بس، كان هيضيع في اللمّة دي — عشان كده هو جوه الـ<body>.
  const bundle = await p.evaluate(() => {
    const cat = { id: 'c1', name: 'كريب سادة لوكس', colorGroups: ['بيجات', 'الوان'] };
    const grades = [];
    for (let i = 1; i <= 6; i++) grades.push({ id: 'b' + i, number: i, group: 'بيجات', status: i <= 2 ? 'out' : 'normal' });
    for (let i = 1; i <= 6; i++) grades.push({ id: 'l' + i, number: i, group: 'الوان', status: i <= 2 ? 'out' : 'normal' });
    const bd = buildRestockBundle(cat, grades, ['بيجات', 'الوان'], false);
    return {
      jobs: bd.jobs.length,
      jobsHaveDefs: bd.jobs.every((j) => /<pattern\s+id="hx"/.test(j.html)),
      previewHasDefs: /<pattern\s+id="hx"/.test(bd.previewHTML),
      browserHasDefs: /<pattern\s+id="hx"/.test(bd.browserHTML),
      previewHatches: (bd.previewHTML.match(/class="hatch"/g) || []).length,
    };
  });
  check('⭐ كل ورقة في الحزمة جواها تعريف النمط', bundle.jobsHaveDefs, bundle);
  check('⭐ والمعاينة كمان', bundle.previewHasDefs, bundle);
  check('ونافذة المتصفح كمان', bundle.browserHasDefs, bundle);
  check('التظليل موجود في المعاينة (٤ درجات خلصت)', bundle.previewHatches === 4, bundle);

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
