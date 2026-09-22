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

  // ---------- 3ب) ❌ نفس زرار المسح في بحث الفئة ----------
  // اتطلب بالنص: "ممكن كمان نضيف زير X اللي هو في خانة البحث بتاع
  // الفئة ... اضغط علي اكس يمسح اللي مكتوب زي البحث عن درجة في فئة
  // معينه كده".
  //
  // ⚠️⚠️ الفحص بيتأكد من **تلات حاجات** مش واحدة: الزرار بيبان لما
  // يكون فيه كلام، بيختفي لما الخانة تبقى فاضية، وبيمسح فعلًا.
  // من غير التانية، الزرار بيفضل واقف على خانة فاضية ومالوش معنى.
  const catSearch = await p.evaluate(async () => {
    state.categories = [
      { id: 'c1', name: 'كريب سادة لوكس', order: 1 },
      { id: 'c2', name: 'شيفون مطرز', order: 2 },
      { id: 'c3', name: 'قطن مصري', order: 3 },
    ];
    state.categorySearch = '';
    state.sideMenuOpen = true;
    render();
    const names = () => [...document.querySelectorAll('.side-item-name')].map((e) => e.textContent.trim());
    const out = { before: names(), clearWhenEmpty: !!document.getElementById('side-search-clear') };

    const el = document.getElementById('side-search');
    el.value = 'شيفون';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 320));
    out.filtered = names();
    out.clearShown = !!document.getElementById('side-search-clear');

    // ⚠️⚠️ مابندوسش على حاجة مش موجودة: لو الزرار اتشال، الفحص لازم
    // يفشل **بالاسم** مش يقع بـTypeError. الوقوع بيعدّي كفشل في
    // المُشغّل بس مابيقولش إيه اللي اتكسر بالظبط.
    const btn = document.getElementById('side-search-clear');
    if (btn) {
      btn.click();
      await new Promise((r) => setTimeout(r, 60));
    }
    out.after = names();
    out.valueCleared = document.getElementById('side-search').value;
    out.clearGoneAgain = !!document.getElementById('side-search-clear');
    out.focusKept = document.activeElement && document.activeElement.id === 'side-search';
    return out;
  });
  check('⭐ بحث الفئة بيفلتر', catSearch.filtered.length === 1 && catSearch.filtered[0] === 'شيفون مطرز', catSearch);
  check('⭐⭐⭐ زرار ✕ بيبان لما يكون فيه كلام', catSearch.clearShown, catSearch);
  check('⭐⭐ ومابيبانش والخانة فاضية', !catSearch.clearWhenEmpty && !catSearch.clearGoneAgain, catSearch);
  check('⭐⭐⭐ ودوسة واحدة بترجّع كل الفئات', catSearch.after.length === catSearch.before.length, catSearch);
  check('⭐⭐ والخانة بتفضى فعلًا', catSearch.valueCleared === '', catSearch);
  check('⭐ والمؤشر بيفضل في الخانة (الكيبورد مايقفلش في التليفون)', catSearch.focusKept, catSearch);
  await boot();

  // ============================================================
  // 3ج) ⏳ ن٤ — الفئات الواقفة من مدة
  // ============================================================
  // ⚠️⚠️ الفحص ده بيحرس تلات حاجات، والتانية والتالتة أهم من الأولى:
  //   ١) الفلترة بتشتغل صح
  //   ٢) الشريحة **مقفولة** على اللي مش مسموح له يشوف تاريخ آخر طبعة
  //      — القايمة دي مشتقّة بالكامل من نفس التواريخ، فلو بانت لحد
  //      مش مسموح له، تبقى نفس المعلومة اتسرّبت من باب تاني
  //   ٣) وهي بتحمّل، بتعرض **الكل** مش قايمة فاضية — القايمة
  //      الفاضية بتبان كأن مافيش ولا فئة واقفة، وده كدب
  const stale = await p.evaluate(async () => {
    const out = {};
    state.sideMenuOpen = true;
    state.categorySearch = '';
    state.categories = [
      { id: 'c1', name: 'عمرها ما اتطبعت', order: 1 },
      { id: 'c2', name: 'اتطبعت امبارح', order: 2 },
      { id: 'c3', name: 'اتطبعت من شهرين', order: 3 },
    ];
    state.pendingByCategory = {}; state.outByCategory = {}; state.lowStockByCategory = {};
    state.categoryFilter = 'stale';

    // (١) وهي بتحمّل
    restockPrintStamps = null;
    const loading = sideMenuHTML();
    out.loadingHint = loading.indexOf('بيحمّل تواريخ') !== -1;
    out.loadingShowsAll = (loading.match(/side-item-name/g) || []).length;

    // (٢) بعد التحميل
    restockPrintStamps = {
      c2: new Date(Date.now() - 1 * 86400000).toISOString(),
      c3: new Date(Date.now() - 60 * 86400000).toISOString(),
    };
    const html = sideMenuHTML();
    out.staleHasNeverPrinted = html.indexOf('عمرها ما اتطبعت') !== -1;
    out.staleHasOld = html.indexOf('اتطبعت من شهرين') !== -1;
    out.staleHidesFresh = html.indexOf('اتطبعت امبارح') === -1;
    out.count = (html.match(/side-item-name/g) || []).length;
    out.says30 = html.indexOf('30') !== -1;

    // (٣) الدالة نفسها
    out.judge = {
      never: categoryIsStale('مش_موجودة'),
      fresh: categoryIsStale('c2'),
      old: categoryIsStale('c3'),
    };

    // ============================================================
    // (٤) ⚠️⚠️ القراءة وقعت = الشاشة بتقول إن القايمة مش مضمونة
    // ============================================================
    // من غير ده: القراءة تفشل (مفيش نت أو الصلاحية مقفولة)، الخريطة
    // تبقى {}، وكل فئة في المحل بتطلع "واقفة" — والشاشة بتقولها
    // بثقة وهي مش عارفة حاجة.
    // ⚠️⚠️ بنخلّي القراءة **تقع فعلًا** مش بنحط العلم بإيدينا: الفحص
    // اللي بيحط العلم بنفسه بيعدّي حتى لو الـcatch مابيسجّلهوش خالص
    // (جرّبناه معكوس وعدّى — وعشان كده اتغيّر).
    const realCollection = db.collection.bind(db);
    db.collection = (name) =>
      name === 'restockPrints'
        ? { get: () => Promise.reject(new Error('permission-denied')) }
        : realCollection(name);
    restockPrintStamps = null;
    restockStampsPromise = null;
    restockStampsError = false;
    await loadRestockPrintStamps(true);
    db.collection = realCollection;
    out.failFlagSet = restockStampsFailed() === true;
    const failed = sideMenuHTML();
    out.failSays = failed.indexOf('مش مضمونة') !== -1;
    out.failMarked = failed.indexOf('side-hint-bad') !== -1;
    out.failStillLists = (failed.match(/side-item-name/g) || []).length;
    // ⚠️ والقراءة الناجحة بعدها بتفضّي العلم — مش بيفضل عالق للأبد
    const rows = {
      c2: new Date(Date.now() - 1 * 86400000).toISOString(),
      c3: new Date(Date.now() - 60 * 86400000).toISOString(),
    };
    db.collection = (name) =>
      name === 'restockPrints'
        ? {
            get: () =>
              Promise.resolve({
                forEach: (fn) => Object.keys(rows).forEach((k) => fn({ id: k, data: () => ({ at: rows[k] }) })),
              }),
          }
        : realCollection(name);
    restockPrintStamps = null;
    restockStampsPromise = null;
    await loadRestockPrintStamps(true);
    db.collection = realCollection;
    out.flagClears = restockStampsFailed() === false;
    out.readBack = restockPrintStamps && restockPrintStamps.c3 === rows.c3;
    out.okNoWarning = sideMenuHTML().indexOf('مش مضمونة') === -1;

    // (٥) ⚠️⚠️ الشريحة مقفولة على اللي مايشوفش التاريخ
    const before = state.profile;
    state.profile = { name: 'ع', role: 'supervisor', perms: { seeRestockLastPrint: false } };
    out.chipHiddenForOthers = sideMenuHTML().indexOf('data-cat-filter="stale"') === -1;
    state.profile = before;
    out.chipShownForOwner = sideMenuHTML().indexOf('data-cat-filter="stale"') !== -1;
    state.categoryFilter = 'all';
    return out;
  });
  check('⭐⭐ الفئة اللي عمرها ما اتطبعت بتتحسب واقفة',
    stale.staleHasNeverPrinted && stale.judge.never === true, stale);
  check('⭐⭐ واللي اتطبعت من شهرين كمان', stale.staleHasOld && stale.judge.old === true, stale);
  check('⭐⭐ واللي اتطبعت امبارح مابتبانش', stale.staleHidesFresh && stale.judge.fresh === false, stale);
  check('⭐ والعدد صح', stale.count === 2, stale);
  check('⭐ والسطر بيقول المدة', stale.says30, stale);
  // ⚠️⚠️ الفحصين دول منفصلين عن قصد: الأول على السطر اللي بيقول
  // "بيحمّل"، والتاني على إن القايمة **مش فاضية** وهي بتحمّل. لو
  // اتجمعوا في فحص واحد، كسر واحد فيهم بيبان كأنه كسر التاني.
  check('⭐⭐⭐ وهي بتحمّل بتقول "بيحمّل" مش بتسكت', stale.loadingHint, stale);
  check('⭐⭐⭐ وبتعرض الكل مش قايمة فاضية (القايمة الفاضية كدب)',
    stale.loadingShowsAll === 3, stale);
  check('⭐⭐⭐ والشريحة مقفولة على اللي مايشوفش تاريخ آخر طبعة',
    stale.chipHiddenForOthers && stale.chipShownForOwner, stale);
  check('⭐⭐⭐ القراءة لما توقع فعلًا: العلم بيتسجّل', stale.failFlagSet, stale);
  check('⭐⭐⭐ والشاشة بتقول إن القايمة مش مضمونة',
    stale.failSays && stale.failMarked, stale);
  check('⭐⭐ والقراءة الناجحة بعدها بتفضّي العلم', stale.flagClears, stale);
  check('⭐ والتواريخ بتوصل فعلًا', stale.readBack, stale);
  check('⭐⭐ وبرضه بيعرض اللي عنده (مش شاشة فاضية)', stale.failStillLists > 0, stale);
  check('⭐⭐ والتحذير مابيبانش لما القراءة تنجح', stale.okNoWarning, stale);
  await boot();

  // ============================================================
  // 3د) 📝 ن٦ — ملاحظة على الفئة
  // ============================================================
  const note = await p.evaluate(async () => {
    const out = {};
    state.categories = [
      { id: 'c1', name: 'كريب', itemName: 'كريب', barcodeNumber: '28144',
        sellingPrice: 85, minQty: 2, note: 'المورد وقف اللون ده — متطلبوش' },
      { id: 'c2', name: 'شيفون', itemName: 'شيفون', barcodeNumber: '99', sellingPrice: 60, minQty: 1 },
    ];
    state.activeCategoryId = 'c1';
    state.showEditCategoryInfoForm = false;
    const shown = categoryInfoBarHTML();
    out.shows = shown.indexOf('المورد وقف اللون ده') !== -1 && shown.indexOf('cat-note') !== -1;

    // ⚠️ فئة من غير ملاحظة: مافيش سطر فاضي بياخد مساحة
    state.activeCategoryId = 'c2';
    out.emptyNoLine = categoryInfoBarHTML().indexOf('cat-note') === -1;

    // ⚠️⚠️ الملاحظة بتعدّي على التهريب: اسم فيه <script> مايتنفّذش
    state.categories[1].note = '<img src=x onerror="window.__pwned=1">';
    const dirty = categoryInfoBarHTML();
    out.escaped = dirty.indexOf('<img') === -1 && dirty.indexOf('&lt;img') !== -1;

    // الخانة في نموذج التعديل
    state.activeCategoryId = 'c1';
    state.showEditCategoryInfoForm = true;
    const form = categoryInfoBarHTML();
    out.fieldExists = form.indexOf('id="edit-category-note"') !== -1;
    out.fieldHasValue = form.indexOf('المورد وقف اللون ده') !== -1;
    out.fieldCapped = form.indexOf('maxlength="200"') !== -1;
    state.showEditCategoryInfoForm = false;

    // ⚠️⚠️ الحفظ من غير ملاحظة **مايمسحش** الملاحظة الموجودة
    // ⚠️ بنلبس على **مجموعة الفئات بس**: logActivity بتكتب في
    // activityLog كمان، ولو لبسنا على db كلها بتقع.
    const realCollection = db.collection.bind(db);
    let patchNoNote = null, patchWithNote = null;
    db.collection = (name) => {
      if (name !== 'categories') return realCollection(name);
      return { doc: () => ({ update: (d) => {
        if (!patchNoNote) patchNoNote = d;
        patchWithNote = d;
        return Promise.resolve();
      } }) };
    };
    await updateCategoryInfo('c1', 'كريب', '28144', 0, 85, 2);           // من غير ملاحظة
    out.keepsNote = patchNoNote && !('note' in patchNoNote);
    await updateCategoryInfo('c1', 'كريب', '28144', 0, 85, 2, 'جديدة');  // بملاحظة
    out.savesNote = patchWithNote && patchWithNote.note === 'جديدة';
    // ⚠️ والقص عند 200 حرف
    await updateCategoryInfo('c1', 'كريب', '28144', 0, 85, 2, 'ط'.repeat(500));
    out.capped = patchWithNote && patchWithNote.note.length === 200;
    db.collection = realCollection;
    return out;
  });
  check('⭐⭐ الملاحظة بتبان في شاشة الفئة', note.shows, note);
  check('⭐ وفئة من غير ملاحظة مافيهاش سطر فاضي', note.emptyNoLine, note);
  check('⭐⭐⭐ والملاحظة بتعدّي على التهريب (مافيش HTML بيتنفّذ)', note.escaped, note);
  check('⭐⭐ والخانة موجودة في نموذج التعديل وفيها القيمة', note.fieldExists && note.fieldHasValue, note);
  check('⭐ ومحدودة بـ200 حرف في الخانة', note.fieldCapped, note);
  check('⭐⭐⭐ والحفظ من غير ملاحظة مايمسحش الملاحظة الموجودة', note.keepsNote, note);
  check('⭐⭐ والحفظ بملاحظة بيحفظها', note.savesNote, note);
  check('⭐⭐ والنص الطويل بيتقص عند 200', note.capped, note);
  await p.reload();
  await p.waitForFunction(() => typeof render === 'function');
  await boot();

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
