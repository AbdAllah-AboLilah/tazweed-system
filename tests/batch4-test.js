// الدفعة الرابعة — شريط أدوات في سطر واحد، إظهار الحالة في الأوضاع،
// الشريط المختصر، البحث برقم الدرجة، والدرجات الأساسية لكل مجموعة.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,260)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');

  const boot = () => p.evaluate(() => {
    const noop = () => () => {};
    const writes = []; window.__writes = writes;
    const mkDoc = (id) => ({ id,
      set:(d)=>{writes.push({set:d,id});return Promise.resolve();},
      update:(d)=>{writes.push({update:d,id});return Promise.resolve();},
      delete:()=>{writes.push({del:1,id});return Promise.resolve();},
      collection: mk, onSnapshot: noop,
      get:()=>Promise.resolve({ exists:false, docs: window.__gradeDocs || [] }) });
    function mk(){ return { doc: mkDoc, get:()=>Promise.resolve({ docs: window.__gradeDocs || [] }),
      where: mk, orderBy: mk, onSnapshot: noop, add:(d)=>{writes.push({add:d});return Promise.resolve({});} }; }
    window.db = { collection: mk, collectionGroup: mk,
      batch: () => ({ update:(r,d)=>writes.push({batch:d}), set:(r,d)=>writes.push({batchSet:d}), commit:()=>Promise.resolve() }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    window.__gradeDocs = [];

    state.user={uid:'me'}; state.profile={name:'x',role:'owner',warehouseAccess:'both'};
    state.view='dashboard'; state.screen='sheets'; state.isOnline=true;
    state.categories=[{ id:'c1', name:'كريب سادة لوكس', order:1, minQty:2,
      itemName:'كريب', barcodeNumber:'28144', sellingPrice:85, colorGroups:['كيوي','نصار'] }];
    state.activeCategoryId='c1';
    state.grades=[];
    for (let n=1; n<=40; n++) state.grades.push({ id:'g'+n, number:n, group: n%2?'كيوي':'نصار',
      branchQty: n===3?0:5, mainQty: 4, status: n===3?'pending':(n===7?'out':'normal') });
    state.grades.push({ id:'b1', number:-3, name:'أبيض', isBase:true, group:'كيوي', criticalQty:3, branchQty:2, mainQty:1, status:'normal' });
    state.pendingByCategory={}; state.pendingCount=0; state.outByCategory={}; state.outCount=0; state.lowStockByCategory={};
    state.gradeLabelMode=false; state.bulkRequestMode=false; state.gradeSelectMode=false;
    state.printingGradeId=null; state.gradeSearch=''; state.gradeFilter='all'; state.gradeGroupFilter='';
    state.sideMenuOpen=false;
    render();
  });
  await boot();

  // ---------- 1) شريط الأدوات: ٤ زراير في سطر واحد ----------
  const bar = await p.evaluate(() => {
    const row = document.querySelector('.toolbar-row');
    const kids = [...row.children].filter(x => x.offsetWidth);
    const tops = new Set(kids.map(k => Math.round(k.getBoundingClientRect().top)));
    return {
      count: kids.length,
      rows: tops.size,
      labels: kids.map(k => k.textContent.trim().replace(/\s+/g,' ')),
      catItems: [...document.querySelectorAll('#tool-cat-panel .menu-item')].map(x => x.id),
      selectLoose: !!document.querySelector('.toolbar-row > #toggle-grade-select-btn'),
    };
  });
  check('⭐ ٤ زراير بس في الشريط', bar.count === 4, bar);
  check('⭐ كلهم في سطر واحد', bar.rows === 1, bar);
  check('"تزويد" مش "طلب تزويد"', bar.labels.some(l => l === '📋 تزويد'), bar.labels);
  check('⭐ تحديد للحذف اتنقل لقايمة الفئة',
    !bar.selectLoose && bar.catItems.includes('toggle-grade-select-btn'), bar);
  check('🔔 حدود التنبيه في قايمة الفئة', bar.catItems.includes('critical-qty-btn'), bar.catItems);

  // وانت جوه وضع الحذف، زرار الخروج بيطلع برّه
  const inSelect = await p.evaluate(() => {
    document.getElementById('tool-cat-btn').click();
    document.getElementById('toggle-grade-select-btn').click();
    const row = document.querySelector('.toolbar-row');
    const out = {
      exitOutside: !!document.querySelector('.toolbar-row > #toggle-grade-select-btn'),
      exitLabel: (document.querySelector('.toolbar-row > #toggle-grade-select-btn') || {}).textContent,
      rows: new Set([...row.children].filter(x=>x.offsetWidth).map(k => Math.round(k.getBoundingClientRect().top))).size,
      inMenu: [...document.querySelectorAll('#tool-cat-panel .menu-item')].map(x=>x.id).includes('toggle-grade-select-btn'),
      count: [...row.children].filter(x=>x.offsetWidth).length,
    };
    return out;
  });
  check('⭐ جوه الوضع: زرار الخروج برّه', inSelect.exitOutside && /تم/.test(inSelect.exitLabel), inSelect);
  check('ومش متكرر في القايمة', !inSelect.inMenu, inSelect);
  check('⭐ جوه الوضع: الشريط زرار واحد بس', inSelect.rows === 1 && inSelect.count === 1, inSelect);

  // ---------- 2) إظهار الحالة في وضع الحذف والتزويد ----------
  const statusInModes = await p.evaluate(() => {
    const read = () => {
      const card = [...document.querySelectorAll('.grade-card')].find(c => /درجة 7\b/.test(c.textContent));
      const normal = [...document.querySelectorAll('.grade-card')].find(c => /درجة 1\b/.test(c.textContent));
      return {
        outHasBadge: !!(card && card.querySelector('.badge')),
        outBadgeText: card && card.querySelector('.badge') ? card.querySelector('.badge').textContent.trim() : '',
        outHasCheckbox: !!(card && card.querySelector('input[type=checkbox]')),
        normalHasBadge: !!(normal && normal.querySelector('.badge')),
        normalHasCheckbox: !!(normal && normal.querySelector('input[type=checkbox]')),
      };
    };
    const out = { select: read() };
    document.querySelector('.toolbar-row > #toggle-grade-select-btn').click();
    document.getElementById('toggle-bulk-request-btn').click();
    out.bulk = read();
    document.getElementById('toggle-bulk-request-btn').click();
    out.normalMode = read();
    return out;
  });
  check('⭐ وضع الحذف: الحالة ظاهرة مع مربّع التعليم',
    statusInModes.select.normalHasBadge && statusInModes.select.normalHasCheckbox, statusInModes.select);
  check('⭐ وضع الحذف: "خلصت" ظاهرة كمان',
    statusInModes.select.outHasBadge && /خلص/.test(statusInModes.select.outBadgeText), statusInModes.select);
  check('⭐ وضع التزويد: الحالة ظاهرة على الدرجة العادية',
    statusInModes.bulk.normalHasBadge && statusInModes.bulk.normalHasCheckbox, statusInModes.bulk);
  check('⭐ وضع التزويد: "خلصت" ليها بادج ومفيش مربّع (السبب باين)',
    statusInModes.bulk.outHasBadge && !statusInModes.bulk.outHasCheckbox, statusInModes.bulk);
  check('الوضع العادي مااتغيّرش', statusInModes.normalMode.normalHasBadge, statusInModes.normalMode);

  // ---------- 3) البحث برقم الدرجة ----------
  const search = await p.evaluate(async () => {
    const type = async (v) => {
      const el = document.getElementById('grade-search');
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 320));
    };
    const shown = () => [...document.querySelectorAll('.gc-num')].map(x => x.textContent.trim());
    const out = { before: shown().length };
    await type('7');
    out.exact = shown();
    out.focusKept = document.activeElement && document.activeElement.id === 'grade-search';
    await type('أبيض');
    out.byName = shown();
    await type('ابيض');           // من غير همزة
    out.normalized = shown();
    document.getElementById('grade-search-clear').click();
    out.cleared = shown().length;
    out.valueCleared = document.getElementById('grade-search').value;
    return out;
  });
  check('⭐ البحث برقم بيرجّع الدرجة دي بس', search.exact.length === 1 && search.exact[0] === 'درجة 7', search);
  check('⭐ 7 مابيجيبش 17 و27 و37', !search.exact.some(x => /17|27|37/.test(x)), search);
  check('المؤشر بيفضل في خانة البحث بعد الرسم', search.focusKept, search);
  check('البحث بالاسم شغّال', search.byName.length === 1 && search.byName[0] === 'أبيض', search);
  check('⭐ "ابيض" من غير همزة بتلاقي "أبيض"', search.normalized.length === 1, search);
  check('زرار المسح بيرجّع الكل', search.cleared === search.before && search.valueCleared === '', search);

  // ---------- 4) الشريط المختصر ----------
  const ctx = await p.evaluate(async () => {
    const box = document.querySelector('[data-keep-scroll]') || document.scrollingElement;
    const scrollTo = async (y) => {
      if (box === document.scrollingElement) window.scrollTo(0, y); else box.scrollTop = y;
      (box === document.scrollingElement ? window : box).dispatchEvent(new Event('scroll'));
      await new Promise(r => setTimeout(r, 60));
    };
    const bar = document.getElementById('ctx-bar');
    const out = { exists: !!bar, hiddenAtTop: bar.hidden };
    await scrollTo(900);
    out.shownAfterScroll = !bar.hidden;
    const tabs = document.querySelector('.tabs');
    out.underTabs = Math.round(bar.getBoundingClientRect().top) >=
                    Math.round(tabs.getBoundingClientRect().bottom) - 2;
    out.text = bar.textContent.replace(/\s+/g,' ').trim();

    // الشيبة بتفتح قايمة وبتغيّر الفلتر فعلًا
    document.getElementById('ctx-group').click();
    const picker = document.querySelector('.ctx-picker');
    out.pickerOpen = !!picker;
    out.pickerItems = picker ? [...picker.children].map(x => x.textContent) : [];
    [...picker.children].find(x => x.textContent === 'نصار').click();
    await new Promise(r => setTimeout(r, 60));
    out.groupApplied = state.gradeGroupFilter;
    out.pickerClosed = !document.querySelector('.ctx-picker');
    out.chipText = document.getElementById('ctx-group').textContent;

    document.getElementById('ctx-status').click();
    const p2 = document.querySelector('.ctx-picker');
    [...p2.children].find(x => /معلّق/.test(x.textContent)).click();
    await new Promise(r => setTimeout(r, 60));
    out.statusApplied = state.gradeFilter;

    state.gradeGroupFilter=''; state.gradeFilter='all'; render();
    await scrollTo(0);
    out.hiddenAgain = document.getElementById('ctx-bar').hidden;
    return out;
  });
  check('الشريط المختصر مخفي وانت فوق', ctx.exists && ctx.hiddenAtTop, ctx);
  check('⭐ بيظهر لما الفلاتر تطلع بره الشاشة', ctx.shownAfterScroll, ctx);
  check('⭐ ملزوق تحت التابات مش فوقها', ctx.underTabs, ctx);
  check('فيه اسم الفئة والمجموعة والحالة', /كريب/.test(ctx.text) && /كل المجموعات/.test(ctx.text), ctx);
  check('⭐ الشيبة بتفتح قايمة بكل المجموعات',
    ctx.pickerOpen && ctx.pickerItems.includes('كيوي') && ctx.pickerItems.includes('نصار'), ctx);
  check('⭐ الاختيار بيغيّر الفلتر فعلًا', ctx.groupApplied === 'نصار' && ctx.pickerClosed, ctx);
  check('والشيبة بتكتب المجموعة الجديدة', /نصار/.test(ctx.chipText), ctx);
  check('شيبة الحالة بتغيّر الفلتر كمان', ctx.statusApplied === 'pending', ctx);
  check('وبيختفي لما ترجع لفوق', ctx.hiddenAgain, ctx);

  // ---------- 5) الدرجات الأساسية لكل مجموعة ----------
  const base = await p.evaluate(() => {
    const openAdd = () => { document.getElementById('tool-add-btn').click();
      return !!document.getElementById('add-base-grades-btn'); };
    state.gradeGroupFilter = 'كيوي'; render();
    const inKiwi = openAdd();               // كيوي عندها أبيض خلاص
    state.gradeGroupFilter = 'نصار'; render();
    const inNassar = openAdd();             // نصار مالهاش
    state.gradeGroupFilter = ''; render();
    return { inKiwi, inNassar };
  });
  // ⚠️⚠️ الشرط ده **اتقلب** في v0.44.0، والسبب مهم:
  // الزرار كان بيختفي أول ما المجموعة تاخد أساسياتها — وده كان صح لما
  // الشاشة كانت بتعمل حاجة واحدة بس (تضيف التلاتة الجاهزين). خلاص ضفتهم؟
  // يبقى مالهاش لازمة.
  //
  // بس الشاشة بقت بتضيف كمان **درجة أساسية باسم من عندك**، والحاجة دي
  // مالهاش آخر. فالإخفاء بقى بيقفل الباب على الخاصية الجديدة بالظبط في
  // الفئات اللي أكتر حاجة محتاجاها — واللي المستخدم اتعطّل عليها فعلًا.
  check('⭐ الزرار فاضل ظاهر حتى لو المجموعة عندها أساسية خلاص',
    base.inKiwi === true, base);
  check('⭐ المجموعة اللي مالهاش: الزرار ظاهر', base.inNassar === true, base);

  const baseAdd = await p.evaluate(async () => {
    // درجات موجودة في السحابة: أبيض في كيوي بس
    window.__gradeDocs = [{ data: () => ({ isBase: true, name: 'أبيض', group: 'كيوي' }) }];
    window.__writes.length = 0;
    await addBaseGradesToCategory('c1', 3, 'نصار');
    const nassar = window.__writes.filter(w => w.batchSet).map(w => w.batchSet);
    window.__writes.length = 0;
    await addBaseGradesToCategory('c1', 3, 'كيوي');
    const kiwi = window.__writes.filter(w => w.batchSet).map(w => w.batchSet);
    window.__writes.length = 0;
    await addBaseGradesToCategory('c1', 3, '');
    const none = window.__writes.filter(w => w.batchSet).map(w => w.batchSet);
    return {
      nassarCount: nassar.length, nassarGroups: [...new Set(nassar.map(x => x.group))],
      kiwiCount: kiwi.length, kiwiNames: kiwi.map(x => x.name),
      noneCount: none.length, noneHasGroup: none.some(x => 'group' in x),
    };
  });
  check('⭐ "أبيض" في كيوي مامنعش "أبيض" في نصار',
    baseAdd.nassarCount === 3 && baseAdd.nassarGroups.join() === 'نصار', baseAdd);
  check('⭐ ونفس المجموعة مابتتكررش (أبيض اتخطّى)',
    baseAdd.kiwiCount === 2 && !baseAdd.kiwiNames.includes('أبيض'), baseAdd);
  check('⭐ "من غير مجموعة" مابيتكتبش فيها حقل group',
    baseAdd.noneCount === 3 && !baseAdd.noneHasGroup, baseAdd);

  // ---------- 6) حدود التنبيه لكل درجة ----------
  const crit = await p.evaluate(() => {
    const cat = state.categories[0];
    return {
      ownWins: gradeCriticalQty({ criticalQty: 9 }, cat),
      zeroMeansOff: gradeCriticalQty({ criticalQty: 0 }, cat),
      emptyFallsBack: gradeCriticalQty({ id: 'x' }, cat),
      nullFallsBack: gradeCriticalQty({ criticalQty: null }, cat),
      baseDefault: gradeCriticalQty({ isBase: true }, cat),
    };
  });
  check('⭐ حد الدرجة بيغلب حد الفئة', crit.ownWins === 9, crit);
  check('⭐ صفر معناها "من غير تنبيه" مش "ارجع لحد الفئة"', crit.zeroMeansOff === 0, crit);
  check('من غير حد: بتاخد حد الفئة (2)', crit.emptyFallsBack === 2 && crit.nullFallsBack === 2, crit);
  // ⚠️ الفحص ده كان بيتأكد إن الافتراضي **3**. اتغيّر عن قصد في v0.55.0:
  // الدرجة الأساسية كانت بتتضاف **منبّهة** من غير ما حد يطلب، فالدايرة
  // البرتقالية بتظهر جنب اسم الفئة بعدد الأساسية وانت لسه مضفتهم دلوقتي.
  // صاحب المحل هو اللي يقرر أنهي درجة تستاهل تنبيه، مش النظام.
  check('⭐ الأساسية من غير حد: مفيش تنبيه (الافتراضي صفر)', crit.baseDefault === 0, crit);

  const critUI = await p.evaluate(async () => {
    state.gradeGroupFilter = 'كيوي'; state.gradeFilter = 'all'; render();
    document.getElementById('tool-cat-btn').click();
    document.getElementById('critical-qty-btn').click();
    await new Promise(r => setTimeout(r, 60));
    const inputs = [...document.querySelectorAll('.crit-input')];
    const out = { rows: inputs.length, onlyVisible: inputs.length === visibleGrades().length };
    document.getElementById('crit-all-val').value = '4';
    document.getElementById('crit-all-apply').click();
    out.applied = inputs.every(i => i.value === '4');
    // ⚠️ تفضية درجة **مالهاش** حد أصلًا = مفيش تغيير = مفيش كتابة (وده صح).
    // عشان نفحص مسار null لازم درجة عندها حد فعلًا — "أبيض" عندها 3.
    const white = inputs.find(i => i.dataset.critId === 'b1');
    white.value = '';
    window.__writes.length = 0;
    document.getElementById('crit-save').click();
    await new Promise(r => setTimeout(r, 250));
    const w = window.__writes.filter(x => x.batch).map(x => x.batch);
    out.writes = w.length;
    out.hasNull = w.some(x => x.criticalQty === null);
    out.hasFour = w.filter(x => x.criticalQty === 4).length;
    out.closed = !document.getElementById('crit-save');
    state.gradeGroupFilter = ''; render();
    return out;
  });
  check('شاشة الحدود بتعرض درجات الفلتر بس', critUI.rows > 0 && critUI.onlyVisible, critUI);
  check('"طبّق على الكل" بيملا كل الخانات', critUI.applied, critUI);
  check('⭐ الفاضي بيتحفظ null (يرجع لحد الفئة)', critUI.hasNull, critUI);
  check('⭐ الباقي بيتحفظ 4', critUI.hasFour === critUI.writes - 1, critUI);
  check('الشاشة بتتقفل بعد الحفظ', critUI.closed, critUI);

  // ---------- 7) سطر بيانات الصنف ----------
  const info = await p.evaluate(() => {
    const el = document.querySelector('.cat-info-line');
    const cs = getComputedStyle(el);
    return { h: Math.round(el.getBoundingClientRect().height), nowrap: cs.whiteSpace, scroll: cs.overflowX };
  });
  check('⭐ سطر البيانات سطر واحد رفيع', info.h <= 30 && info.nowrap === 'nowrap', info);
  check('وبيتزحلق بدل ما يلفّ', info.scroll === 'auto', info);

  // ---------- 8) شاشة الطباعة: زرار المسمّى ----------
  // ⚠️ مفتاح "من غير سعر" العام اتشال من شاشة طباعة السلة في v0.33.0 —
  // بقى مفتاح **لكل صنف** جوه السلة. اللي بيفحصه دلوقتي batch5-test.
  const printScreen = await p.evaluate(async () => {
    window.productsCache = [{ name: 'كريب سادة', barcode: '28144', price: 85 }];
    state.screen = 'print';
    state.printSearch = '';
    state.printCart = [{ key: '28144', product: window.productsCache[0], qty: 2, mode: 'normal' }];
    render();
    const out = {
      customBtn: !!document.getElementById('print-screen-custom-btn'),
      printBtn: !!document.getElementById('print-cart-btn'),
    };
    document.getElementById('print-screen-custom-btn').click();
    await new Promise(r => setTimeout(r, 60));
    out.customOpened = !!document.getElementById('custom-label-form');
    document.getElementById('custom-cancel').click();
    state.screen = 'sheets'; state.printCart = []; render();
    return out;
  });
  check('زرار "أضف مسمّى" في شاشة الطباعة', printScreen.customBtn && printScreen.printBtn, printScreen);
  check('وبيفتح شاشة المسمّى', printScreen.customOpened, printScreen);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
