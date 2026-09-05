// ورقة التزويد: "الناقص بس"
// ============================================================
// الورقة كانت بتطبع **كل** الدرجات وبتظلّل اللي خلصت. فئة فيها 245 درجة
// = ورقة طويلة كل مرة، وانت بتمشي على الرف بتدوّر على المظلّل وسط مية
// رقم سليم. الخيار ده بيطبع اللي محتاج تزويد بس.
//
// ⚠️⚠️ أهم فحصين هنا:
//   1) **المفتاح مقفول = الورقة بايت ببايت زي ما كانت.** كل حاجة بنضيفها
//      على الطباعة لازم يبقى ليها وضع "مطفي تمامًا" — اتلسعنا من ده قبل
//      كده مرتين.
//   2) **التعريف مطابق للشاشة الرئيسية.** لو الورقة بتعرّف "ناقص" بشكل
//      والشاشة بشكل تاني، اللي ماسك الورقة على الرف هو اللي يدفع التمن.
//      الفحص بيقارن الاتنين على نفس الدرجات بالظبط.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildRestockHTML === 'function' && typeof gradeNeedsRestock === 'function');

  const r = await p.evaluate(() => {
    const out = {};
    const cat = { id: 'c1', name: 'كريب سادة لوكس', minQty: 3, colorGroups: ['بيجات', 'غوامق'] };

    // درجات مختارة عشان تغطّي كل حالة على حدة
    const grades = [
      { id: 'g1', number: '1', group: 'بيجات', branchQty: 20, mainQty: 5, status: 'normal' },   // سليمة
      { id: 'g2', number: '2', group: 'بيجات', branchQty: 0,  mainQty: 0, status: 'out' },      // خلصت
      { id: 'g3', number: '3', group: 'بيجات', branchQty: 0,  mainQty: 7, status: 'pending' },  // معلّقة
      { id: 'g4', number: '4', group: 'بيجات', branchQty: 3,  mainQty: 9, status: 'normal' },   // ≤ الحد
      { id: 'g5', number: '5', group: 'غوامق', branchQty: 50, mainQty: 5, status: 'normal' },   // سليمة
      { id: 'g6', number: '6', group: 'غوامق', branchQty: 2,  mainQty: 4, status: 'normal' },   // تحت الحد
      { id: 'g7', number: '7', group: 'غوامق', branchQty: 99, mainQty: 5, status: 'normal',
        criticalQty: 100 },                                                                    // حدها الخاص
    ];

    // ---------- 1) التعريف نفسه ----------
    out.perGrade = grades.map((g) => ({ n: g.number, need: gradeNeedsRestock(g, cat) }));

    // ⚠️⚠️ ومطابق للشاشة الرئيسية: بنبني نفس فلاتر app.js على نفس
    // الدرجات ونقارن. لو حد غيّر واحد فيهم، الفحص بيبان.
    out.matchesDashboard = grades.every((g) => {
      const limit = gradeCriticalQty(g, cat);
      const dash = g.status === 'pending' || g.status === 'out'
        || (g.status === 'normal' && limit > 0 && (Number(g.branchQty) || 0) <= limit);
      return dash === gradeNeedsRestock(g, cat);
    });

    out.count = countNeedsRestock(grades, cat, false);

    // ---------- 2) المفتاح مقفول = ولا بايت اتغيّر ----------
    // ⚠️ بنقارن الورقة القديمة (٤ معاملات، من غير المعامل الجديد خالص)
    // بالورقة الجديدة والمفتاح مقفول. لازم يطلعوا **متطابقين حرفيًا**.
    const legacy = buildRestockHTML(cat, grades, '', true);
    const offNew = buildRestockHTML(cat, grades, '', true, false);
    out.offIdentical = legacy === offNew;
    out.offNoBanner = offNew.indexOf('الناقص بس') === -1;
    // وكل الأرقام لسه موجودة
    out.offHasAll = ['1', '2', '3', '4', '5', '6', '7'].every((n) => offNew.indexOf(`>${n}<`) !== -1);

    // ---------- 3) المفتاح مفتوح ----------
    const on = buildRestockHTML(cat, grades, '', true, true);
    out.onHasBanner = on.indexOf('الناقص بس') !== -1;
    out.onKeeps = ['2', '3', '4', '6', '7'].every((n) => on.indexOf(`>${n}<`) !== -1);
    out.onDrops = ['1', '5'].every((n) => on.indexOf(`>${n}<`) === -1);
    out.onShorter = on.length < offNew.length;
    // ⚠️ واللافتة بتقول العدد الصح — رقم بيكدب أوحش من مافيش رقم
    // ⚠️ class="..." كاملة: الاسم موجود في التنسيقات فوق كمان، والصيغة
    // الفضفاضة بتمسك قاعدة CSS وترجّع كلام غلط (نفس فخ last-print).
    const m = on.match(/class="short-note">([\s\S]*?)<\/div>/);
    out.bannerText = m ? m[1].replace(/<[^>]*>/g, '').trim() : '';
    out.bannerCount = out.bannerText.indexOf('5') !== -1;
    // ⚠️ ومافيش إيموچي في **اللافتة المطبوعة**: محرك جافا بتاع QZ ممكن
    // مايكونش عليه خط إيموچي فتطلع مربع فاضي.
    // ⚠️ بنفحص اللافتة نفسها مش الورقة كلها عن قصد: كتلة التنسيقات فيها
    // تعليقات قديمة فيها ⚠️ — وتعليقات CSS **مابتترسمش** أصلًا، فالفحص
    // عليها كان هيبقى إنذار كاذب.
    out.noEmoji = !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(out.bannerText);

    // ---------- 4) المجموعات ----------
    out.namesOff = restockGroupNames(cat, grades, true, false);
    out.namesOn = restockGroupNames(cat, grades, true, true);
    // مجموعة كل درجاتها سليمة لازم تختفي خالص، مش تطلع ورقة فاضية
    const onlyOk = [{ id: 'x1', number: '9', group: 'غوامق', branchQty: 80, mainQty: 5, status: 'normal' }];
    out.emptyGroupGone = restockGroupNames(cat, grades.slice(0, 4).concat(onlyOk), true, true)
      .indexOf('غوامق') === -1;

    // ---------- 5) الحزمة ----------
    const bundle = buildRestockBundle(cat, grades, out.namesOn, true, true);
    out.bundleCount = bundle.count;
    out.bundleAllBanner = bundle.jobs.every((j) => j.html.indexOf('الناقص بس') !== -1);

    // ---------- 6) السجل ----------
    out.logShort = restockLogSpec(cat, '', 1, true).text;
    out.logFull = restockLogSpec(cat, '', 1, false).text;

    // ---------- 7) الأساسية مع الناقص ----------
    const withBaseGrades = grades.concat([
      { id: 'b1', name: 'أبيض', isBase: true, branchQty: 0, mainQty: 0, status: 'out' },
      { id: 'b2', name: 'أسود', isBase: true, branchQty: 40, mainQty: 5, status: 'normal' },
    ]);
    const onBase = buildRestockHTML(cat, withBaseGrades, '', true, true);
    out.baseShortKeeps = onBase.indexOf('أبيض') !== -1;
    out.baseShortDrops = onBase.indexOf('أسود') === -1;
    // ومن غير الأساسية، الاتنين مايبانوش
    const onNoBase = buildRestockHTML(cat, withBaseGrades, '', false, true);
    out.baseOffHidesBoth = onNoBase.indexOf('أبيض') === -1 && onNoBase.indexOf('أسود') === -1;

    // ---------- 8) كل الدرجات ناقصة ----------
    const allShort = grades.filter((g) => gradeNeedsRestock(g, cat));
    out.allShortSame = buildRestockHTML(cat, allShort, '', true, true).replace(/<div class="short-note">[\s\S]*?<\/div>/, '')
      === buildRestockHTML(cat, allShort, '', true, false);

    return out;
  });

  // ---------- التعريف ----------
  const want = { '1': false, '2': true, '3': true, '4': true, '5': false, '6': true, '7': true };
  r.perGrade.forEach((g) => check(`⭐ درجة ${g.n}: ${want[g.n] ? 'ناقصة' : 'سليمة'}`, g.need === want[g.n], g));
  check('⭐⭐ والتعريف مطابق للشاشة الرئيسية بالحرف', r.matchesDashboard);
  check('⭐ العدّاد بيقول ٥', r.count === 5, r.count);

  // ---------- مقفول = زي ما كان ----------
  check('⚠️⚠️ المفتاح مقفول → الورقة بايت ببايت زي ما كانت', r.offIdentical);
  check('⚠️ ومفيش لافتة', r.offNoBanner);
  check('⚠️ وكل الأرقام لسه فيها', r.offHasAll);

  // ---------- مفتوح ----------
  check('⭐⭐ المفتاح مفتوح → لافتة واضحة على الورقة', r.onHasBanner);
  check('⭐⭐ والناقص موجود', r.onKeeps);
  check('⭐⭐ والسليم اتشال', r.onDrops);
  check('⭐ والورقة بقت أقصر', r.onShorter);
  check('⚠️⚠️ واللافتة بتقول العدد الصح', r.bannerCount, r.bannerText);
  check('⚠️ ومافيش إيموچي في الورقة (محرك QZ)', r.noEmoji);

  // ---------- المجموعات ----------
  check('⭐ المجموعتين بيطلعوا والمفتاح مقفول', r.namesOff.length === 2, r.namesOff);
  check('⭐ والاتنين لسه فيهم ناقص', r.namesOn.length === 2, r.namesOn);
  check('⚠️⚠️ ومجموعة كلها سليمة بتختفي (مش ورقة فاضية)', r.emptyGroupGone);

  // ---------- الحزمة ----------
  check('⭐ الحزمة بتطلّع ورقتين', r.bundleCount === 2, r.bundleCount);
  check('⚠️ وكل ورقة فيها اللافتة', r.bundleAllBanner);

  // ---------- السجل ----------
  check('⭐⭐ السجل بيقول "الناقص بس"', r.logShort.indexOf('(الناقص بس)') !== -1, r.logShort);
  check('⚠️ والورقة الكاملة من غيرها', r.logFull.indexOf('الناقص بس') === -1, r.logFull);

  // ---------- الأساسية ----------
  check('⭐ أساسية خلصت بتفضل', r.baseShortKeeps);
  check('⭐ وأساسية مليانة بتتشال', r.baseShortDrops);
  check('⚠️ ومن غير مفتاح الأساسية الاتنين مايبانوش', r.baseOffHidesBoth);

  // ---------- الكل ناقص ----------
  check('⚠️ كل الدرجات ناقصة → نفس الورقة (اللافتة بس)', r.allShortSame);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
