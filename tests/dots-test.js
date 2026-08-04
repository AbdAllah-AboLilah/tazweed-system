const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,250)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof pendingDotHTML === 'function');

  await p.evaluate(() => {
    const noop = () => () => {};
    const mk = () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve(), collection: mk, onSnapshot: noop, get: () => Promise.resolve({ exists: false }) }), get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
    window.db = { collection: mk, collectionGroup: mk, batch: () => ({ set() {}, update() {}, delete() {}, commit: () => Promise.resolve() }) };
    state.user = { uid: 'me' };
    state.profile = { name: 'AboLilah', role: 'owner' };
    state.view = 'dashboard';
    state.screen = 'sheets';
    state.categories = [
      { id: 'c1', name: 'كريب سادة', order: 1, colorGroups: ['بيجات', 'ألوان'], itemName: 'كريب سادة لوكس' },
      { id: 'c2', name: 'شيفون', order: 2 },
    ];
    state.activeCategoryId = 'c1';
    state.grades = [];
    for (let n = 1; n <= 6; n++) state.grades.push({ id: 'b' + n, number: n, group: 'بيجات', branchQty: n === 1 ? 0 : 2, mainQty: 2, status: n === 1 ? 'pending' : 'normal' });
    for (let n = 1; n <= 4; n++) state.grades.push({ id: 'a' + n, number: n, group: 'ألوان', branchQty: 1, mainQty: 0, status: 'normal' });
    for (let n = 1; n <= 3; n++) state.grades.push({ id: 'r' + n, number: 90 + n, branchQty: 1, mainQty: 0, status: 'normal' });
    state.pendingByCategory = { c2: [5, 9] };
    state.pendingCount = 2;
  });

  // ---------- النقطة الثابتة ----------
  const dots = await p.evaluate(() => {
    render();
    const top = document.getElementById('pending-dot-btn');
    const tab = document.querySelector('#side-open-btn .pending-dot');
    return {
      topText: top ? top.textContent.trim() : null,
      tabText: tab ? tab.textContent.trim() : null,
      purple: document.querySelectorAll('.badge-purple').length,
      topIsButton: top ? top.tagName : null,
      tabIsSpan: tab ? tab.tagName : null,
    };
  });
  check('النقطة ظهرت جنب اسم المستخدم', dots.topText === '3', dots);
  check('النقطة ظهرت على زرار الفئات', dots.tabText === '3', dots);
  check('الشارة البنفسجية القديمة اتشالت', dots.purple === 0, dots);
  check('نقطة الاسم زرار (بتتضغط)', dots.topIsButton === 'BUTTON', dots);
  check('نقطة التاب مش زرار (الزرار نفسه بيفتح القايمة)', dots.tabIsSpan === 'SPAN', dots);

  const click = await p.evaluate(() => {
    document.getElementById('pending-dot-btn').click();
    return { open: state.sideMenuOpen, filter: state.categoryFilter,
             items: [...document.querySelectorAll('.side-item-name')].map((e) => e.textContent.trim()) };
  });
  check('ضغط النقطة بيفتح القايمة على "مطلوب تزويد"', click.open && click.filter === 'pending', click);
  check('القايمة بتوري الفئات المطلوب تزويدها بس', JSON.stringify(click.items) === JSON.stringify(['كريب سادة', 'شيفون']), click);

  const none = await p.evaluate(() => {
    state.grades.forEach((g) => { g.status = 'normal'; g.branchQty = 5; });
    state.pendingByCategory = {}; state.pendingCount = 0;
    state.sideMenuOpen = false; state.categoryFilter = 'all';
    render();
    return { top: !!document.getElementById('pending-dot-btn'), tab: !!document.querySelector('#side-open-btn .pending-dot') };
  });
  check('مفيش تزويد → مفيش نقطة خالص', !none.top && !none.tab, none);

  // ---------- كل مجموعة في ورقة ----------
  const groups = await p.evaluate(() => {
    state.grades[0].status = 'pending'; state.grades[0].branchQty = 0;
    render();
    const cat = state.categories[0];
    return {
      names: restockGroupNames(cat, state.grades),
      each: RESTOCK_EACH_GROUP,
    };
  });
  check('المجموعات بترتيبها و"باقي الدرجات" في الآخر',
    JSON.stringify(groups.names) === JSON.stringify(['بيجات', 'ألوان', 'باقي الدرجات']), groups);

  const bundle = await p.evaluate(() => {
    const cat = state.categories[0];
    const names = restockGroupNames(cat, state.grades);
    const bd = buildRestockBundle(cat, state.grades, names);
    const div = document.createElement('div');
    div.innerHTML = bd.previewHTML.replace(/<\/?(html|head|body)[^>]*>/gi, '');
    return {
      count: bd.count,
      jobs: bd.jobs.length,
      jobTitles: bd.jobs.map((j) => (j.html.match(/class="tab-name">([^<]*)/) || [])[1]),
      previewHasAllThree: ['بيجات', 'ألوان', 'باقي الدرجات'].every((n) => bd.previewHTML.includes(n)),
      previewSeparators: (bd.previewHTML.match(/ورقة جديدة/g) || []).length,
      previewHasScript: /<script/i.test(bd.previewHTML),
      printBreaks: (bd.browserHTML.match(/page-break-after: always/g) || []).length,
      printHasOnePrintCall: (bd.browserHTML.match(/window\.print/g) || []).length,
    };
  });
  check('3 ورق = 3 وظائف طباعة', bundle.count === 3 && bundle.jobs === 3, bundle);
  check('كل ورقة عنوانها اسم مجموعتها', JSON.stringify(bundle.jobTitles) ===
    JSON.stringify(['كريب سادة — بيجات', 'كريب سادة — ألوان', 'كريب سادة — باقي الدرجات']), bundle.jobTitles);
  check('المعاينة فيها الـ3 مجموعات', bundle.previewHasAllThree, bundle);
  check('المعاينة فيها فاصلين بين الـ3 ورق', bundle.previewSeparators === 2, bundle);
  check('⭐ المعاينة مافيهاش أي أمر طباعة', !bundle.previewHasScript, bundle);
  check('مستند المتصفح فيه فاصل صفحة بين الورق', bundle.printBreaks === 2, bundle);
  check('مستند المتصفح فيه أمر طباعة واحد بس', bundle.printHasOnePrintCall === 1, bundle);

  // ---------- المعاينة مابتفتحش شاشة طباعة المتصفح ----------
  const preview = await p.evaluate(async () => {
    let printCalled = 0;
    const cat = state.categories[0];
    const html = buildRestockHTML(cat, state.grades, '');
    const promise = showPrintPreview(html, { pageWidthMm: 80, autoHeight: true });
    await new Promise((r) => setTimeout(r, 600));
    const frame = document.getElementById('roll-frame');
    // نتأكد إن الإطار مافيهوش أي سكريبت
    const scripts = frame ? frame.contentWindow.document.querySelectorAll('script').length : -1;
    const text = frame ? frame.contentWindow.document.body.textContent.replace(/\s+/g, ' ').slice(0, 30) : '';
    document.getElementById('roll-cancel').click();
    await promise;
    return { scripts, text, printCalled };
  });
  check('⭐ إطار المعاينة مافيهوش أي سكريبت', preview.scripts === 0, preview);
  check('محتوى الورقة ظاهر في المعاينة', /كريب/.test(preview.text), preview);

  // معاينة الحزمة: العدد بيظهر
  const multi = await p.evaluate(async () => {
    const cat = state.categories[0];
    const bd = buildRestockBundle(cat, state.grades, restockGroupNames(cat, state.grades));
    const promise = showPrintPreview(bd.previewHTML, { pageWidthMm: 80, autoHeight: true, papers: bd.count });
    await new Promise((r) => setTimeout(r, 500));
    const txt = document.querySelector('#roll-box') ? document.querySelector('#roll-box').parentElement.textContent : '';
    const h = parseFloat((document.getElementById('roll-frame') || {}).style?.height || 0);
    document.getElementById('roll-cancel').click();
    await promise;
    return { txt: txt.replace(/\s+/g, ' ').slice(0, 90), h };
  });
  check('المعاينة بتقول هيتطبع كام ورقة', /3/.test(multi.txt) && /ورق/.test(multi.txt), multi);
  check('ارتفاع المعاينة اتقاس من الورق كله', multi.h > 300, multi);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach((x) => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
