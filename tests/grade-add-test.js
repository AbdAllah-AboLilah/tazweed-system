// ============================================================
// إضافة الدرجات — المجموعة المفتوحة، وكمية الفرع
// ============================================================
// حاجتين اتطلبوا مع بعض:
//   1) لو إنت فاتح على "بيجات" وتدوس "إضافة درجة"، المجموعة تبقى بيجات
//      جاهزة — إنت أصلًا جوّاها
//   2) خيار "ابدأ بـ 1 في الفرع بدل صفر" يبقى موجود في كل مكان بيضيف
//      درجات، مش في الدرجة الواحدة بس
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 250)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof openAddGradeRangeDialog === 'function');

  // قاعدة بيانات وهمية بتسجّل اللي اتكتب فعلًا
  const boot = () => p.evaluate(() => {
    window.__writes = [];
    const noop = () => () => {};
    const mkBatch = () => ({
      set: (ref, data) => window.__writes.push(data),
      commit: () => Promise.resolve(),
    });
    const mk = () => ({
      doc: () => ({ set: () => Promise.resolve(), update: (d) => { window.__writes.push({ __update: d }); return Promise.resolve(); }, collection: mk, onSnapshot: noop, get: () => Promise.resolve({ exists: false }) }),
      get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}),
    });
    window.db = { collection: mk, collectionGroup: mk, batch: mkBatch };
    state.user = { uid: 'me' };
    state.profile = { name: 'AboLilah', role: 'admin', warehouseAccess: 'both' };
    state.view = 'dashboard'; state.screen = 'sheets'; state.isOnline = true;
    state.categories = [{ id: 'c1', name: 'كريب سادة', order: 1, minQty: 0, colorGroups: ['بيجات', 'الوان'] }];
    state.activeCategoryId = 'c1';
    state.grades = [
      { id: 'b1', number: 1, group: 'بيجات', branchQty: 0, mainQty: 3, status: 'normal' },
      { id: 'l1', number: 1, group: 'الوان', branchQty: 0, mainQty: 3, status: 'normal' },
    ];
    state.gradeGroupFilter = '';
    state.lastGradeGroup = '';
    state.pendingByCategory = {}; state.pendingCount = 0;
    state.outByCategory = {}; state.outCount = 0; state.lowStockByCategory = {};
    render();
  });
  await boot();

  // ============================================================
  // 1) ⭐ المجموعة المفتوحة بتبقى جاهزة
  // ============================================================
  const scope = await p.evaluate(() => {
    const out = {};
    state.gradeGroupFilter = '';        out.all = openGroupScope();
    state.gradeGroupFilter = 'بيجات';   out.beige = openGroupScope();
    state.gradeGroupFilter = UNGROUPED_LABEL; out.rest = openGroupScope();
    state.gradeGroupFilter = '';
    return out;
  });
  // ⚠️ الفرق بين null و'' مهم: الاتنين فاضيين بس معناهم مختلف تمامًا.
  check('"كل المجموعات" = مافيش مجموعة مفتوحة (null)', scope.all === null, scope);
  check('"بيجات" مفتوحة → بيجات', scope.beige === 'بيجات', scope);
  check('"باقي الدرجات" مفتوحة → بلا مجموعة (نص فاضي)', scope.rest === '', scope);

  // شاشة إضافة درجة واحدة
  const single = await p.evaluate(async () => {
    const read = () => {
      const sel = document.getElementById('new-grade-group');
      return sel ? sel.value : null;
    };
    const open = async (filter, last) => {
      state.gradeGroupFilter = filter;
      state.lastGradeGroup = last || '';
      state.showAddGradeForm = true;
      render();
      await new Promise((r) => setTimeout(r, 40));
      return read();
    };
    return {
      onBeige: await open('بيجات'),
      onColors: await open('الوان'),
      // مافيش مجموعة مفتوحة → بيرجع لآخر واحدة ضفت فيها (السلوك القديم)
      onAllWithLast: await open('', 'بيجات'),
      onAllNoLast: await open('', ''),
    };
  });
  check('⭐ فاتح على "بيجات" → شاشة إضافة درجة بتفتح على بيجات',
    single.onBeige === 'بيجات', single);
  check('⭐ فاتح على "الوان" → بتفتح على الوان', single.onColors === 'الوان', single);
  // ⚠️ السلوك القديم لازم يفضل: من غير مجموعة مفتوحة، بتفتكر آخر واحدة
  check('مافيش مجموعة مفتوحة → بتفتكر آخر واحدة ضفت فيها',
    single.onAllWithLast === 'بيجات', single);
  check('ولا مجموعة مفتوحة ولا آخر واحدة → بلا مجموعة',
    single.onAllNoLast === '', single);

  // شاشة الإضافة الجماعية
  const range = await p.evaluate(async () => {
    const open = async (filter) => {
      state.gradeGroupFilter = filter;
      document.querySelectorAll('.card').forEach(() => {});
      openAddGradeRangeDialog('c1');
      await new Promise((r) => setTimeout(r, 40));
      const v = document.getElementById('range-group').value;
      const startOne = document.getElementById('range-start-one');
      const has = !!startOne, checked = startOne && startOne.checked;
      document.getElementById('range-cancel').click();
      return { v, has, checked };
    };
    return { onBeige: await open('بيجات'), onAll: await open('') };
  });
  check('⭐ الإضافة الجماعية كمان بتفتح على المجموعة المفتوحة',
    range.onBeige.v === 'بيجات', range);
  check('⭐ وفيها خيار "ابدأ بـ 1 في الفرع"', range.onBeige.has, range);
  // ⚠️ الافتراضي هنا **متعلّم** مش زي الدرجة الواحدة — الإضافة الجماعية
  // كانت بتحط 1 دايمًا من غير اختيار، فتغييره كان هيغيّر سلوك شغّال.
  check('⭐ والافتراضي متعلّم (زي ما كانت قبل ما يبقى فيه اختيار)',
    range.onBeige.checked, range);

  // ============================================================
  // 2) ⭐ الخيار بيوصل للسحابة فعلًا
  // ============================================================
  // مش بنصدّق إن المفتاح موجود — بنشوف الكمية اللي **اتكتبت**.
  const written = await p.evaluate(async () => {
    const run = async (startOne) => {
      window.__writes = [];
      state.gradeGroupFilter = 'بيجات';
      openAddGradeRangeDialog('c1');
      await new Promise((r) => setTimeout(r, 40));
      document.getElementById('range-from').value = '10';
      document.getElementById('range-to').value = '12';
      document.getElementById('range-start-one').checked = startOne;
      document.getElementById('range-add').click();
      await new Promise((r) => setTimeout(r, 300));
      const w = window.__writes.filter((x) => x.number !== undefined);
      const btn = document.getElementById('range-cancel');
      if (btn) btn.click();
      return { count: w.length, branch: [...new Set(w.map((x) => x.branchQty))], groups: [...new Set(w.map((x) => x.group))] };
    };
    return { one: await run(true), zero: await run(false) };
  });
  check('⭐ "ابدأ بـ 1" مفتوح → الفرع بيتكتب 1',
    written.one.count === 3 && written.one.branch.join() === '1', written.one);
  check('⭐ مقفول → الفرع بيتكتب صفر',
    written.zero.count === 3 && written.zero.branch.join() === '0', written.zero);
  check('⭐ والدرجات اتكتبت في المجموعة المفتوحة',
    written.one.groups.join() === 'بيجات', written.one);

  // ============================================================
  // 3) ⭐ الترقيم مستقل لكل مجموعة
  // ============================================================
  // "الوان" لازم تقدر تبدأ من 1 حتى لو "بيجات" فيها 1 — زي الشيت الأصلي.
  const perGroup = await p.evaluate(async () => {
    window.__writes = [];
    // 1 موجودة في بيجات وفي الوان. الإضافة في "بيجات" من 1 لـ3:
    const res = await addGradeRange('c1', 1, 3, 'بيجات', 0);
    const nums = window.__writes.filter((x) => x.number !== undefined).map((x) => x.number);
    window.__writes = [];
    // ولا مجموعة: 1 مش موجودة فيها، فالتلاتة كلهم بيتضافوا
    const res2 = await addGradeRange('c1', 1, 3, '', 0);
    const nums2 = window.__writes.filter((x) => x.number !== undefined).map((x) => x.number);
    return { res, nums, res2, nums2 };
  });
  check('⭐ الرقم الموجود في المجموعة بيتخطّى',
    perGroup.res.added === 2 && perGroup.res.skipped === 1 && perGroup.nums.join() === '2,3', perGroup);
  check('⭐ ونفس الرقم في مجموعة تانية مايمنعش',
    perGroup.res2.added === 3 && perGroup.nums2.join() === '1,2,3', perGroup);

  // ============================================================
  // 4) ⭐ المجموعة الجديدة بتتملي على طول
  // ============================================================
  const newGroup = await p.evaluate(async () => {
    openColorGroupsDialog('c1');
    await new Promise((r) => setTimeout(r, 60));
    const has = {
      from: !!document.getElementById('new-group-from'),
      to: !!document.getElementById('new-group-to'),
      startOne: !!document.getElementById('new-group-start-one'),
    };
    window.__writes = [];
    document.getElementById('new-group-name').value = 'سادة';
    document.getElementById('new-group-from').value = '1';
    document.getElementById('new-group-to').value = '4';
    document.getElementById('new-group-start-one').checked = true;
    document.getElementById('add-group-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 400));
    const w = window.__writes;
    const grades = w.filter((x) => x.number !== undefined);
    const updates = w.filter((x) => x.__update);
    document.querySelectorAll('div').forEach((d) => {
      if (d.style && d.style.position === 'fixed' && d.parentNode === document.body) d.parentNode.removeChild(d);
    });
    return {
      has, grades: grades.length,
      branch: [...new Set(grades.map((x) => x.branchQty))],
      group: [...new Set(grades.map((x) => x.group))],
      groupSaved: updates.some((u) => (u.__update.colorGroups || []).includes('سادة')),
      // ⚠️ الترتيب: المجموعة لازم تتحفظ **قبل** الدرجات
      groupFirst: w.findIndex((x) => x.__update) < w.findIndex((x) => x.number !== undefined),
    };
  });
  check('⭐ شاشة المجموعات فيها خانات المدى وخيار الفرع',
    newGroup.has.from && newGroup.has.to && newGroup.has.startOne, newGroup.has);
  check('⭐ المجموعة الجديدة اتحفظت', newGroup.groupSaved, newGroup);
  check('⭐ و4 درجات اتضافوا جوّاها على طول',
    newGroup.grades === 4 && newGroup.group.join() === 'سادة', newGroup);
  check('⭐ بالكمية اللي اخترتها', newGroup.branch.join() === '1', newGroup);
  // ⚠️ لو الدرجات اتكتبت قبل المجموعة، هتظهر تحت "باقي الدرجات"
  check('⭐ المجموعة اتحفظت قبل الدرجات', newGroup.groupFirst, newGroup);

  // والمدى اختياري — من غيره بتتعمل المجموعة وبس (السلوك القديم)
  const nameOnly = await p.evaluate(async () => {
    openColorGroupsDialog('c1');
    await new Promise((r) => setTimeout(r, 60));
    window.__writes = [];
    document.getElementById('new-group-name').value = 'مقلّم';
    document.getElementById('add-group-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    const w = window.__writes;
    return { grades: w.filter((x) => x.number !== undefined).length, saved: w.some((x) => x.__update) };
  });
  check('⭐ المدى اختياري — الاسم لوحده بيعمل المجموعة وبس',
    nameOnly.saved && nameOnly.grades === 0, nameOnly);

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
