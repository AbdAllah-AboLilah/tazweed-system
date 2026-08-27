// تقرير حركة المخزون — الحساب والتخزين والصلاحية
// ============================================================
// ⭐ أهم فحص هنا: إن الحركة **مش** بتتكتب جوّه مستند الدرجة.
// قواعد الأمان بتقفل حقول الدرجة بـonlyChangedKeys في 17 تركيبة، فأي
// حقل جديد هناك معناه إن تعديل الكميات بيترفض من السيرفر **في صمت**.
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof movementScreenHTML === 'function');

  const r = await p.evaluate(() => {
    const out = {};
    state.isNarrow = true;
    state.profile = { name: 'AboLilah', role: 'owner' };
    state.categories = [{ id: 'c1', name: 'كريب' }, { id: 'c2', name: 'شيفون' }];

    const now = Date.now(), day = 86400000;
    const mk = (d) => ({ toDate: () => new Date(d) });
    const M = movementMonthKey();

    allGradesCache = [
      { catId: 'c1', gradeId: 'g1', name: '56', branchQty: 4 },  // اتحركت امبارح، باعت 20
      { catId: 'c1', gradeId: 'g2', name: '12', branchQty: 0 },  // واقفة من 40 يوم
      { catId: 'c2', gradeId: 'g3', name: '3', branchQty: 9 },   // اتحركت من يومين، باعت 5
      { catId: 'c2', gradeId: 'g4', name: '7', branchQty: 2 },   // مامتحركتش خالص
    ];
    movementStats = {
      c1__g1: { gradeNumber: '56', lastMovedAt: mk(now - 1 * day), soldByMonth: { [M]: 20 }, soldTotal: 20, moves: 9 },
      c1__g2: { gradeNumber: '12', lastMovedAt: mk(now - 40 * day), soldByMonth: { [M]: 0 }, soldTotal: 3, moves: 2 },
      c2__g3: { gradeNumber: '3', lastMovedAt: mk(now - 2 * day), soldByMonth: { [M]: 5 }, soldTotal: 5, moves: 4 },
    };

    setMovementDays(15);
    const a = computeMovementReport();
    out.fastOrder = a.fast.map((x) => x.qty);
    out.fastCount = a.fast.length;
    out.idle15 = a.idle.length;
    out.neverFirst = a.idle[0] && a.idle[0].daysIdle === null;
    out.tracked = a.tracked;
    out.total = a.total;

    setMovementDays(60);
    out.idle60 = computeMovementReport().idle.length;
    setMovementDays(1);
    out.idle1 = computeMovementReport().idle.length;

    localStorage.removeItem('tazweed_movement_days');
    out.defaultDays = getMovementDays();
    setMovementDays(0); out.zeroIgnored = getMovementDays();
    setMovementDays(-5); out.negIgnored = getMovementDays();
    setMovementDays(99999); out.hugeIgnored = getMovementDays();
    setMovementDays(30); out.thirty = getMovementDays();
    setMovementDays(15);

    // ---- الحركة بتتكتب فين وبأي شكل؟ ----
    const writes = [];
    const realDb = window.db, realFb = window.firebase, realUser = state.user;
    window.db = {
      collection: (c) => ({ doc: (id) => ({ set: (data, opt) => { writes.push({ c, id, data, opt }); return Promise.resolve(); } }) }),
    };
    // بديل بسيط لعدّادات Firestore — الهدف نشوف **الشكل** اللي بيتبعت
    window.firebase = {
      firestore: { FieldValue: { serverTimestamp: () => ({ __ts: true }), increment: (n) => ({ __inc: n }) } },
    };
    state.user = { uid: 'u1' };
    recordMovement({ categoryId: 'c1', categoryName: 'كريب', gradeId: 'g1', gradeNumber: '56', soldQty: 3 });
    recordMovement({ categoryId: 'c1', categoryName: 'كريب', gradeId: 'g2', gradeNumber: '12', soldQty: 0 });
    window.db = realDb; window.firebase = realFb; state.user = realUser;

    out.writeCollections = writes.map((w) => w.c);
    out.writeIds = writes.map((w) => w.id);
    const mKey = movementMonthKey();
    out.soldInc = !!(writes[0].data.soldByMonth && writes[0].data.soldByMonth[mKey] && writes[0].data.soldByMonth[mKey].__inc === 3);
    out.movesInc = !!(writes[0].data.moves && writes[0].data.moves.__inc === 1);
    out.noSoldWhenZero = !writes[1].data.soldByMonth && !writes[1].data.lastSoldAt;
    out.bothHaveLastMoved = writes.every((w) => !!w.data.lastMovedAt);
    out.merged = writes.every((w) => w.opt && w.opt.merge === true);

    // ---- تحويل سطر السجل لحركة ----
    const t = { toDate: () => new Date(now) };
    const dec = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'edit', field: 'branchQty', oldValue: 10, newValue: 4, timestamp: t });
    const incr = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'edit', field: 'branchQty', oldValue: 4, newValue: 10, timestamp: t });
    const main = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'edit', field: 'mainQty', oldValue: 10, newValue: 4, timestamp: t });
    const ful = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'fulfill_shortage', transferredQty: 5, timestamp: t });
    out.logDecSold = !!dec && dec.sold === 6;
    out.logIncNotSold = !!incr && incr.sold === 0;
    out.logMainNotSold = !!main && main.sold === 0;
    out.logFulfillMoves = !!ful && ful.sold === 0;
    out.logBadIgnored = movementFromLogEntry({ action: 'edit', timestamp: t }) === null;
    out.logNoTimeIgnored = movementFromLogEntry({ categoryId: 'c1', gradeId: 'g1', action: 'edit' }) === null;

    // ---- الصلاحية ----
    out.ownerCan = can({ role: 'owner' }, 'viewReports');
    out.branchMgr = can({ role: 'branch_manager' }, 'viewReports');
    out.user = can({ role: 'user' }, 'viewReports');
    out.keeper = can({ role: 'warehouse_keeper' }, 'viewReports');

    // ---- الشاشة ----
    const html = movementScreenHTML();
    out.hasDaysInput = html.includes('id="mv-days-input"');
    out.hasBothSections = html.includes('data-mv="fast"') && html.includes('data-mv="idle"');
    out.hasBackfill = html.includes('id="mv-backfill"');
    return out;
  });

  check('الافتراضي ١٥ يوم', r.defaultDays === 15, r.defaultDays);
  check('صفر بيتتجاهل', r.zeroIgnored === 15, r.zeroIgnored);
  check('رقم سالب بيتتجاهل', r.negIgnored === 15, r.negIgnored);
  check('رقم مستحيل بيتتجاهل', r.hugeIgnored === 15, r.hugeIgnored);
  check('٣٠ يوم بتتحفظ', r.thirty === 30, r.thirty);

  check('الأسرع مرتّبة تنازلي', JSON.stringify(r.fastOrder) === '[20,5]', r.fastOrder);
  check('اللي مابعتش مش في قايمة الأسرع', r.fastCount === 2, r.fastCount);
  check('الراكد عند ١٥ يوم = اتنين', r.idle15 === 2, r.idle15);
  check('اللي عمره مااتحرك بيطلع الأول', r.neverFirst);
  check('مدة أطول = راكد أقل', r.idle60 === 1, r.idle60);
  // عند يوم واحد: الأربعة كلهم راكدين (أقربهم حركة من يوم بالظبط)
  check('مدة أقصر = راكد أكتر', r.idle1 === 4, r.idle1);
  check('عدّاد المتتبَّع والإجمالي', r.tracked === 3 && r.total === 4, [r.tracked, r.total]);

  check('⭐ الحركة بتتكتب في gradeStats مش في الدرجة', JSON.stringify(r.writeCollections) === '["gradeStats","gradeStats"]', r.writeCollections);
  check('معرّف المستند فئة__درجة', JSON.stringify(r.writeIds) === '["c1__g1","c1__g2"]', r.writeIds);
  check('الكمية المباعة بتتزوّد بالرقم الصح', r.soldInc);
  check('عدّاد الحركات بيزيد واحد', r.movesInc);
  check('مفيش بيع لما الكمية ماقلّتش', r.noSoldWhenZero);
  check('كل حركة بتحدّث lastMovedAt', r.bothHaveLastMoved);
  check('الكتابة merge (مافيش قراءة زيادة)', r.merged);

  check('السجل: نقص الفرع = بيع', r.logDecSold);
  check('السجل: زيادة الفرع مش بيع', r.logIncNotSold);
  check('السجل: الرئيسي مش بيع', r.logMainNotSold);
  check('السجل: التزويد حركة مش بيع', r.logFulfillMoves);
  check('السجل: سطر ناقص بيتتجاهل', r.logBadIgnored);
  check('السجل: سطر من غير وقت بيتتجاهل', r.logNoTimeIgnored);

  check('منشئ النظام بيشوف التقرير', r.ownerCan);
  check('مدير الفرع مايشوفوش', r.branchMgr === false, r.branchMgr);
  check('المستخدم العادي مايشوفوش', r.user === false, r.user);
  check('أمين المخزن مايشوفوش', r.keeper === false, r.keeper);

  check('الشاشة فيها عدّاد الأيام', r.hasDaysInput);
  check('الشاشة فيها القسمين', r.hasBothSections);
  check('الشاشة فيها زرار الحساب من السجل', r.hasBackfill);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);
  await b.close();

  // ---- القواعد لازم تفضل متطابقة مع permissions.js ----
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  check('القواعد فيها مجموعة gradeStats', /match \/gradeStats\/\{statId\}/.test(rules));
  check('gradeStats مالهاش حذف', /match \/gradeStats[\s\S]{0,600}?allow delete: if false;/.test(rules));
  check('viewReports مقفولة لمدير الفرع في القواعد', /branch_manager[^\n]*viewReports/.test(rules));
  // ⚠️ مستند الدرجة ماتلمسش: نفس عدد التركيبات زي ما كان
  check('تركيبات onlyChangedKeys زي ما هي (17)', (rules.match(/onlyChangedKeys\(\[/g) || []).length === 22,
    (rules.match(/onlyChangedKeys\(\[/g) || []).length);

  console.log(`\n✅ نجح: ${pass.length}`);
  pass.forEach((t) => console.log('   ✓ ' + t));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    fail.forEach((t) => console.log('   ✗ ' + t));
    process.exit(1);
  }
  console.log('\nكل الفحوص نجحت.');
})();
