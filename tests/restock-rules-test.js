// ============================================================
// الطلب البشري مايتلغيش لوحده + حد التنبيه بيحترم الصفر
// ============================================================
// شكوتين اتبلّغوا مع بعض، وكل واحدة سببها مختلف تمامًا:
//
// 1) "أطلب تزويد لدرجة، وأرفع كمية الفرع — **والطلب يتلغي**."
//    وده كان مقصود في التصميم (الحالة بتتحسب من الكميات)، بس فيه تناقض:
//    النظام **بيسمحلك** تطلب والفرع فيه كمية، وبعدين بيهدّ الطلب بتعديل
//    مالوش علاقة بيه — **وفي سكوت**، فأمين الرئيسي مايشوفهوش خالص.
//
// 2) "الدايرة البرتقالية بتظهر جنب اسم الفئة **رغم إني مخلي الحد صفر**."
//    السبب: `Number(g.criticalQty) || DEFAULT` — والصفر بيتبلع في `||`.
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof nextStatusFromQuantities === 'function');

  // ============================================================
  // 1) ⭐⭐ الطلب البشري: رفع كمية الفرع مايلغيهوش
  // ============================================================
  const manual = await p.evaluate(() => {
    const human = { status: 'pending', mainQty: 10, branchQty: 0, manualRequest: true };
    const auto = { status: 'pending', mainQty: 10, branchQty: 0, manualRequest: false };
    const oldOne = { status: 'pending', mainQty: 10, branchQty: 0 }; // قبل التحديث
    return {
      humanRaise: nextStatusFromQuantities(human, 'branchQty', 3),
      autoRaise: nextStatusFromQuantities(auto, 'branchQty', 3),
      oldRaise: nextStatusFromQuantities(oldOne, 'branchQty', 3),
      // الرئيسي خلص؟ الطلب مابقاش ينفّذ أصلًا — لازم يبقى "خلصت"
      humanMainOut: nextStatusFromQuantities({ ...human, branchQty: 0 }, 'mainQty', 0),
      // وطلب بشري والفرع فيه كمية أصلًا (2 → 3): يفضل معلّق
      humanEdit: nextStatusFromQuantities({ ...human, branchQty: 2 }, 'branchQty', 3),
    };
  });
  check('⭐⭐ طلب **بشري** + رفعت كمية الفرع → الطلب فاضل زي ما هو',
    manual.humanRaise === null, manual);
  check('⭐⭐ طلب **تلقائي** + رفعت الكمية → يتلغي عادي',
    manual.autoRaise === 'normal', manual);
  check('⭐⭐ طلب **قديم** (قبل التحديث) بيتعامل كبشري — الأأمن',
    manual.oldRaise === null, manual);
  check('⭐ والرئيسي لما يخلص، الطلب البشري بيبقى "خلصت"',
    manual.humanMainOut === 'out', manual);
  check('⭐⭐ وتعديل الكمية من 2 لـ3 مايهدّش الطلب',
    manual.humanEdit === null, manual);

  // ============================================================
  // 2) ⭐⭐ الطلب بيتعلّم صح وقت ما بيتعمل
  // ============================================================
  const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8').replace(/^\s*\/\/.*$/gm, '');
  check('⭐⭐ "طلب تزويد" بإيد المستخدم بيتكتب manualRequest: true',
    /status: 'pending', requestedQty: want, manualRequest: true/.test(src) &&
    /status: 'pending', requestedQty: null, manualRequest: true/.test(src), null);
  check('⭐⭐ والطلب التلقائي بيتكتب false',
    /update\.manualRequest = nextStatus === 'pending' \? false : null/.test(src), null);
  check('⭐ والتزويد والإلغاء بيشيلوا العلامة',
    (src.match(/manualRequest: null/g) || []).length >= 2, null);

  // ⚠️⚠️ الحقل الجديد **لازم** يبقى في قوايم القواعد، وإلا الكتابة بترفض
  // في صمت — نفس اللي حصل مع requestedQty قبل كده.
  const rules = fs.readFileSync(__dirname + '/../firestore.rules', 'utf8');
  check('⭐⭐ القواعد بتقبل الطلب البشري (status + requestedQty + manualRequest)',
    /onlyChangedKeys\(\['status', 'requestedQty', 'manualRequest'\]\)/.test(rules), null);
  check('⭐⭐ وبتقبل التغيير التلقائي (branchQty + status + manualRequest)',
    /onlyChangedKeys\(\['branchQty', 'status', 'manualRequest'\]\)/.test(rules), null);
  check('⭐⭐ وبتقبل قفل الطلب من الرئيسي',
    /onlyChangedKeys\(\['status', 'mainQty', 'branchQty', 'requestedQty', 'manualRequest'\]\)/.test(rules), null);
  check('⭐ والقيمة متحقّق منها (bool أو null بس)',
    /manualRequestOK\(\)/.test(rules) && /manualRequest is bool/.test(rules), null);
  // ⚠️ الأجهزة اللي لسه على نسخة قديمة لازم تفضل شغّالة
  check('⭐⭐ والشكل القديم (من غير manualRequest) لسه مقبول',
    /onlyChangedKeys\(\['status', 'requestedQty'\]\)/.test(rules) &&
    /onlyChangedKeys\(\['branchQty', 'status'\]\)/.test(rules), null);

  // ============================================================
  // 3) ⭐⭐ حد التنبيه: الصفر معناه "من غير تنبيه"
  // ============================================================
  const crit = await p.evaluate(() => {
    const cat = { minQty: 5 };
    return {
      baseZero: gradeCriticalQty({ isBase: true, criticalQty: 0 }, cat),
      baseSet: gradeCriticalQty({ isBase: true, criticalQty: 4 }, cat),
      baseUnset: gradeCriticalQty({ isBase: true }, cat),
      normalUnset: gradeCriticalQty({ isBase: false }, cat),
      normalZero: gradeCriticalQty({ isBase: false, criticalQty: 0 }, cat),
      defaultVal: DEFAULT_BASE_CRITICAL_QTY,
      normZero: normalizeCriticalQty(0),
      normEmpty: normalizeCriticalQty(''),
      normFive: normalizeCriticalQty('5'),
    };
  });
  check('⭐⭐ الحد صفر بيفضل صفر (مش بيرجع 3)', crit.baseZero === 0, crit);
  check('⭐⭐ والافتراضي للأساسية بقى صفر', crit.defaultVal === 0 && crit.baseUnset === 0, crit);
  check('⭐ والرقم اللي تحطه بيتحترم', crit.baseSet === 4, crit);
  check('⭐ والدرجة العادية لسه بتاخد حد الفئة', crit.normalUnset === 5, crit);
  check('⭐ وصفر على درجة عادية = من غير تنبيه', crit.normalZero === 0, crit);
  check('⭐⭐ normalizeCriticalQty مابتبلعش الصفر',
    crit.normZero === 0 && crit.normEmpty === 0 && crit.normFive === 5, crit);

  // ⚠️ لوحة التحكم كان عندها **نسخة مكررة** من الحساب فيها نفس العطل
  const dash = fs.readFileSync(__dirname + '/../js/dashboard.js', 'utf8').replace(/^\s*\/\/.*$/gm, '');
  check('⭐⭐ لوحة التحكم بتستخدم الحساب الموحّد مش نسخة تانية',
    /const limit = gradeCriticalQty\(g, cat\)/.test(dash) &&
    !/Number\(g\.criticalQty\) \|\| DEFAULT_BASE_CRITICAL_QTY/.test(dash), null);

  // والدايرة البرتقالية فعليًا: درجة أساسية بحد صفر مالهاش تنبيه
  const dot = await p.evaluate(() => {
    state.categories = [{ id: 'c1', name: 'كريب', minQty: 0 }];
    allGradesCache = [
      { catId: 'c1', status: 'normal', isBase: true, name: 'أبيض', branchQty: 0, criticalQty: 0 },
      { catId: 'c1', status: 'normal', isBase: true, name: 'أسود', branchQty: 0, criticalQty: 0 },
      { catId: 'c1', status: 'normal', isBase: true, name: 'بيج', branchQty: 0, criticalQty: 2 },
    ];
    recomputeOverview();
    return { lowCount: state.lowStockCount, byCat: state.lowStockByCategory };
  });
  check('⭐⭐ الدرجات بحد صفر **مش** بتظهر في "قرّبت تخلص"',
    dot.lowCount === 1, dot);

  // ============================================================
  // 4) ⭐ الطلب بكمية بيبان بلون مختلف
  // ============================================================
  const badge = await p.evaluate(() => ({
    one: statusBadgeHTML({ status: 'pending', requestedQty: 1 }),
    many: statusBadgeHTML({ status: 'pending', requestedQty: 3 }),
    normal: statusBadgeHTML({ status: 'normal' }),
  }));
  check('⭐⭐ الطلب بكمية >1 بياخد لون مختلف عن المعلّق العادي',
    /badge-pending-qty/.test(badge.many) && !/badge-pending-qty/.test(badge.one), badge);
  check('⭐ والطلب العادي زي ما هو', /badge-pending\b/.test(badge.one), badge);
  check('⭐ والعدد لسه باين جنبه', /×3/.test(badge.many), badge);
  const css = fs.readFileSync(__dirname + '/../styles.css', 'utf8');
  // ⚠️ اللون **مايصحّش** يبقى برتقالي: البرتقالي هو لون "معلّق" العادي
  // أصلًا، فمش هيفرّق حاجة.
  check('⭐⭐ واللون مش نفس لون "معلّق" (البرتقالي)',
    /\.badge-pending-qty\s*\{[^}]*--purple-bg/.test(css) &&
    !/\.badge-pending-qty\s*\{[^}]*--warning-bg/.test(css), null);

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
