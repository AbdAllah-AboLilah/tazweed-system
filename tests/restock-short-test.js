// ورقة التزويد: "اللي خلص بس" و"المتاح بس" + حالة الدرجة الجديدة
// ============================================================
// الورقة كانت بتطبع **كل** درجات الفئة. المفتاحين دول بيقسّموها نصين.
//
// ⚠️⚠️ أهم أربع فحوص هنا:
//   1) **المفتاحين مقفولين = الورقة بايت ببايت زي ما كانت.**
//   2) **التقسيمة قاطعة**: أي درجة يا فاضية يا فيها حاجة — مافيش تالت،
//      ومافيش درجة بتتعد مرتين. الفحص بيتأكد إن النصين بيجمعوا الكل.
//   3) **المفتاحين مابيتحفظوش** — اتطلب بالنص. مفتاح الأساسية بيتحفظ،
//      ودول لأ.
//   4) **درجة اتضافت بصفر = خلصت**، مش متاحة. ده كان عطل حقيقي: الإضافة
//      كانت بتحط status:'normal' محفورة، فالورقة كانت بتطلع من غير ولا
//      تظليل واحد.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildRestockHTML === 'function' && typeof gradeIsOut === 'function');

  const r = await p.evaluate(() => {
    const out = {};
    const cat = { id: 'c1', name: 'كريب سادة لوكس', minQty: 3, colorGroups: ['بيجات', 'غوامق'] };

    const grades = [
      { id: 'g1', number: '1', group: 'بيجات', branchQty: 20, mainQty: 5, status: 'normal' },
      { id: 'g2', number: '2', group: 'بيجات', branchQty: 0,  mainQty: 0, status: 'out' },
      { id: 'g3', number: '3', group: 'بيجات', branchQty: 0,  mainQty: 7, status: 'pending' },
      { id: 'g4', number: '4', group: 'بيجات', branchQty: 2,  mainQty: 9, status: 'normal' },
      { id: 'g5', number: '5', group: 'غوامق', branchQty: 0,  mainQty: 0, status: 'out' },
      { id: 'g6', number: '6', group: 'غوامق', branchQty: 50, mainQty: 5, status: 'normal' },
      // ⚠️⚠️ دي بيت القصيد: كمياتها صفر/صفر بس حالتها المحفوظة 'normal'
      // — درجة اتضافت قبل إصلاح الإضافة. لازم تتعامل معاملة "خلصت".
      { id: 'g7', number: '7', group: 'غوامق', branchQty: 0,  mainQty: 0, status: 'normal' },
    ];

    // ---------- 1) مين "خلص" ----------
    out.perGrade = grades.map((g) => ({ n: g.number, isOut: gradeIsOut(g) }));

    // ---------- 1ب) درجة من غير حقول كميات خالص ----------
    // ⚠️⚠️ حارس مهم: `Number(undefined) || 0` بيطلّع صفر، فدرجة مالهاش
    // الحقول دي كانت هتتحسب "خلصت" — وورقة كاملة تطلع **كلها مظللة**.
    // لازم الحالة المحفوظة تحكم لوحدها في الحالة دي.
    out.noQtyNormal = gradeIsOut({ number: '99', status: 'normal' });
    out.noQtyOut = gradeIsOut({ number: '98', status: 'out' });
    out.emptyStringQty = gradeIsOut({ number: '97', status: 'normal', branchQty: '', mainQty: '' });
    // وورقة كل درجاتها من غير كميات: التظليل من الحالة بس
    const noQty = [
      { id: 'n1', number: '1', status: 'normal' },
      { id: 'n2', number: '2', status: 'out' },
      { id: 'n3', number: '3', status: 'normal' },
    ];
    const noQtyHtml = buildRestockHTML({ id: 'c9', name: 'ك', minQty: 0, colorGroups: [] }, noQty, '', true, '');
    out.noQtyHatches = noQtyHtml.split('<div class="row">').slice(1)
      .filter((c) => c.indexOf('class="hatch"') !== -1).length;

    // ---------- 2) التقسيمة قاطعة ----------
    const onlyOut = applyRestockFilter(grades, 'out');
    const onlyAvail = applyRestockFilter(grades, 'available');
    out.noOverlap = onlyOut.every((g) => !onlyAvail.includes(g));
    out.coversAll = onlyOut.length + onlyAvail.length === grades.length;
    out.outNums = onlyOut.map((g) => g.number);
    out.availNums = onlyAvail.map((g) => g.number);

    // ---------- 3) مقفول = زي ما كان ----------
    const legacy = buildRestockHTML(cat, grades, '', true);
    const none = buildRestockHTML(cat, grades, '', true, '');
    out.offIdentical = legacy === none;
    // ⚠️⚠️ لازم `class="short-note"` كاملة، مش الاسم لوحده: الاسم موجود
    // في كتلة التنسيقات فوق **في كل ورقة**، فالبحث عنه لوحده بيرجّع
    // "موجود" دايمًا. الفخ ده وقعنا فيه تلات مرات (last-print، اللافتة
    // دي مرتين) — خلي بالك لو ضفت أي فحص جديد على عنصر في الورقة.
    const hasBanner = (html) => html.indexOf('class="short-note"') !== -1;
    out.offNoBanner = !hasBanner(none);
    out.offHasAll = ['1','2','3','4','5','6','7'].every((n) => none.indexOf(`>${n}<`) !== -1);

    // ---------- 4) التظليل بيتقاس من الكميات ----------
    // ⚠️ الدرجة ٧ (0/0 بس حالتها normal) لازم تطلع **مظلّلة**. ده العطل
    // اللي اتبلّغ بالحرف: "مش بلاقي ولا درجات متظلل عليها".
    const cells = none.split('<div class="row">').slice(1);
    const hatchedNums = cells
      .filter((c) => c.indexOf('class="hatch"') !== -1)
      .map((c) => (c.match(/class="num">([^<]*)</) || [])[1]);
    out.hatched = hatchedNums;

    // ---------- 5) اللي خلص بس ----------
    const so = buildRestockHTML(cat, grades, '', true, 'out');
    out.outKeeps = ['2','5','7'].every((n) => so.indexOf(`>${n}<`) !== -1);
    out.outDrops = ['1','3','4','6'].every((n) => so.indexOf(`>${n}<`) === -1);
    const m1 = so.match(/class="short-note">([\s\S]*?)<\/div>/);
    out.outBanner = m1 ? m1[1].replace(/<[^>]*>/g, '').trim() : '';

    // ⚠️⚠️ وورقة "اللي خلص بس" **من غير تظليل**: كل درجاتها خلصت،
    // فالتظليل بياكل مكان الكتابة ويقول حاجة العنوان قايلها.
    out.outHatches = so.split('<div class="row">').slice(1)
      .filter((c) => c.indexOf('class="hatch"') !== -1).length;

    // ---------- 6) المتاح بس ----------
    const av = buildRestockHTML(cat, grades, '', true, 'available');
    out.availKeeps = ['1','3','4','6'].every((n) => av.indexOf(`>${n}<`) !== -1);
    out.availDrops = ['2','5','7'].every((n) => av.indexOf(`>${n}<`) === -1);
    const m2 = av.match(/class="short-note">([\s\S]*?)<\/div>/);
    out.availBanner = m2 ? m2[1].replace(/<[^>]*>/g, '').trim() : '';
    out.noEmoji = !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(out.outBanner + out.availBanner);

    // ---------- 7) اللافتة بتتقرر من اللي اتشال، مش من المفتاح ----------
    // فئة كلها خلصت + مفتاح "اللي خلص بس" = مافيش حاجة اتشالت → مافيش لافتة
    const allOut = grades.filter((g) => gradeIsOut(g));
    out.noBannerWhenNothingDropped = !hasBanner(buildRestockHTML(cat, allOut, '', true, 'out'));

    // ---------- 8) المجموعات ----------
    out.namesNone = restockGroupNames(cat, grades, true, '');
    out.namesOut = restockGroupNames(cat, grades, true, 'out');
    const availOnlyGroup = grades.concat([{ id: 'x', number: '9', group: 'غوامق', branchQty: 9, mainQty: 1, status: 'normal' }]);
    out.emptyGroupGone = restockGroupNames(
      cat, availOnlyGroup.filter((g) => g.group !== 'غوامق' || g.number === '9'), true, 'out'
    ).indexOf('غوامق') === -1;

    // ---------- 9) السجل ----------
    out.logOut = restockLogSpec(cat, '', 1, 'out').text;
    out.logAvail = restockLogSpec(cat, '', 1, 'available').text;
    out.logNone = restockLogSpec(cat, '', 1, '').text;

    // ---------- 10) الحالة وقت الإضافة ----------
    out.statusZero = statusFromQuantities(0, 0);
    out.statusMainOnly = statusFromQuantities(0, 5);
    out.statusBranch = statusFromQuantities(4, 0);
    out.statusStrings = statusFromQuantities('0', '0');

    return out;
  });

  // ---------- مين خلص ----------
  const wantOut = { '1': false, '2': true, '3': false, '4': false, '5': true, '6': false, '7': true };
  r.perGrade.forEach((g) =>
    check(`⭐ درجة ${g.n}: ${wantOut[g.n] ? 'خلصت' : 'فيها كمية'}`, g.isOut === wantOut[g.n], g));

  check('⚠️⚠️ درجة من غير حقول كميات → الحالة المحفوظة هي اللي تحكم',
    r.noQtyNormal === false && r.noQtyOut === true, { normal: r.noQtyNormal, out: r.noQtyOut });
  check('⚠️ وكمية فاضية (نص فاضي) زي المفقودة', r.emptyStringQty === false, r.emptyStringQty);
  check('⚠️⚠️ وورقة من غير كميات ماتطلعش كلها مظللة', r.noQtyHatches === 1, r.noQtyHatches);

  check('⭐⭐ التقسيمة قاطعة — مافيش درجة في الاتنين', r.noOverlap, { out: r.outNums, avail: r.availNums });
  check('⭐⭐ والنصين بيجمعوا الكل', r.coversAll, { out: r.outNums, avail: r.availNums });

  // ---------- مقفول ----------
  check('⚠️⚠️ المفتاحين مقفولين → الورقة بايت ببايت زي ما كانت', r.offIdentical);
  check('⚠️ ومفيش لافتة', r.offNoBanner);
  check('⚠️ وكل الأرقام لسه فيها', r.offHasAll);

  // ---------- التظليل ----------
  check('⭐⭐ التظليل بيتقاس من الكميات مش من الحالة المحفوظة',
    ['2', '5', '7'].every((n) => r.hatched.includes(n)) && r.hatched.length === 3, r.hatched);

  // ---------- اللي خلص بس ----------
  check('⭐⭐ "اللي خلص بس" بيسيب الفاضي', r.outKeeps);
  check('⭐⭐ وبيشيل اللي فيه كمية', r.outDrops);
  check('⭐ ولافتته بتقول اسمه والعدد',
    r.outBanner.indexOf('اللي خلص بس') !== -1 && r.outBanner.indexOf('3') !== -1, r.outBanner);
  check('⚠️⚠️ وورقتها من غير تظليل (عشان تلاقي مكان تكتب فيه)',
    r.outHatches === 0, r.outHatches);

  // ---------- المتاح بس ----------
  check('⭐⭐ "المتاح بس" بيسيب اللي فيه كمية', r.availKeeps);
  check('⭐⭐ وبيشيل الفاضي', r.availDrops);
  check('⭐ ولافتته بتقول اسمه والعدد',
    r.availBanner.indexOf('المتاح بس') !== -1 && r.availBanner.indexOf('4') !== -1, r.availBanner);
  check('⚠️ ومافيش إيموچي في اللافتتين (محرك QZ)', r.noEmoji);

  // ---------- اللافتة صادقة ----------
  check('⚠️⚠️ مافيش حاجة اتشالت → مافيش لافتة (اللافتة ماتكدبش)', r.noBannerWhenNothingDropped);

  // ---------- المجموعات ----------
  check('⭐ المجموعتين بيطلعوا من غير مفتاح', r.namesNone.length === 2, r.namesNone);
  check('⭐ والاتنين فيهم خلصان', r.namesOut.length === 2, r.namesOut);
  check('⚠️⚠️ ومجموعة مافيهاش خلصان بتختفي (مش ورقة فاضية)', r.emptyGroupGone);

  // ---------- السجل ----------
  check('⭐⭐ السجل بيقول "اللي خلص بس"', r.logOut.indexOf('(اللي خلص بس)') !== -1, r.logOut);
  check('⭐⭐ و"المتاح بس"', r.logAvail.indexOf('(المتاح بس)') !== -1, r.logAvail);
  check('⚠️ والورقة الكاملة من غير أي إضافة', r.logNone === 'كريب سادة لوكس', r.logNone);

  // ---------- الإضافة ----------
  check('⭐⭐ درجة اتضافت بصفر/صفر → خلصت', r.statusZero === 'out', r.statusZero);
  check('⭐ رئيسي بس → معلّقة', r.statusMainOnly === 'pending', r.statusMainOnly);
  check('⭐ فرع فيه كمية → متاحة', r.statusBranch === 'normal', r.statusBranch);
  check('⚠️ والأرقام النصّية بتتقرا صح', r.statusStrings === 'out', r.statusStrings);

  // ---------- المفتاحين مابيتحفظوش ----------
  const saved = await p.evaluate(() => {
    // ⚠️⚠️ الحارس ده بيمسك أي محاولة لحفظ المفتاحين: بنعلّم عليهم،
    // نقفل الشاشة، ونشوف اتكتب إيه في الإعدادات المشتركة.
    const writes = [];
    const realSave = window.saveSharedPrintSettings;
    window.saveSharedPrintSettings = (patch) => { writes.push(patch); return Promise.resolve(); };

    state.profile = { name: 'x', role: 'owner' };
    const cat = { id: 'c1', name: 'ك', minQty: 3, colorGroups: [] };
    const grades = [
      { id: 'a', number: '1', branchQty: 0, mainQty: 0, status: 'out' },
      { id: 'b', number: '2', branchQty: 9, mainQty: 0, status: 'normal' },
      { id: 'c', name: 'أبيض', isBase: true, branchQty: 4, mainQty: 0, status: 'normal' },
    ];
    const pr = chooseRestockGroup(cat, grades);
    const o = document.querySelector('#rg-only-out');
    const a = document.querySelector('#rg-only-avail');
    const bx = document.querySelector('#rg-with-base');
    const startUnchecked = !!o && !!a && !o.checked && !a.checked;
    o.checked = true;
    if (bx) bx.checked = true;
    document.querySelector('[data-rg-mode="all"]').click();
    return pr.then((res) => {
      window.saveSharedPrintSettings = realSave;
      const keys = writes.reduce((all, w) => all.concat(Object.keys(w)), []);
      return { startUnchecked, mode: res.filterMode, keys, writes };
    });
  });

  check('⭐⭐ المفتاحين بيفتحوا الشاشة **من غير علامة**', saved.startUnchecked);
  check('⭐ والاختيار بيوصل للطباعة', saved.mode === 'out', saved.mode);
  check('⚠️⚠️ ومحصلش حفظ ليهم خالص',
    !saved.keys.some((k) => /out|avail|short|filter/i.test(k)), saved.keys);
  check('⭐ ومفتاح الأساسية لسه بيتحفظ', saved.keys.includes('restockWithBase'), saved.keys);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
