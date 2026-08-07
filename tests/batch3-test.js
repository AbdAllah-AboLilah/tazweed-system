// الدفعة التالتة — الطباعة: قايمة واحدة، من غير سعر، اسم المجموعة،
// طباعة مسمّى، ورمز الطباعة جوه صف الدرجة.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');

  const boot = () => p.evaluate(() => {
    const noop = () => () => {};
    const writes = []; window.__writes = writes;
    const mk = () => ({ doc: (id) => ({ id, set:(d)=>{writes.push({set:d,id});return Promise.resolve();},
        update:(d)=>{writes.push({update:d,id});return Promise.resolve();}, delete:()=>{writes.push({del:1});return Promise.resolve();},
        collection: mk, onSnapshot: noop, get:()=>Promise.resolve({exists:false}) }),
      get:()=>Promise.resolve({docs:[]}), where: mk, orderBy: mk, onSnapshot: noop, add:(d)=>{writes.push({add:d});return Promise.resolve({});} });
    window.db = { collection: mk, collectionGroup: mk, batch: () => ({ update:(r,d)=>writes.push({batch:d}), set(){}, commit:()=>Promise.resolve() }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    try { localStorage.removeItem('tazweed_shared_print'); } catch (e) {}

    // الطباعة بتتمسك هنا بدل ما تروح لطابعة
    window.__jobs = [];
    window.deliverPrint = async (type, jobs, sizeOptions) => { window.__jobs.push({ type, jobs, sizeOptions }); };
    window.showPrintPreview = async () => true;

    state.user={uid:'me'}; state.profile={name:'x',role:'owner',warehouseAccess:'both'};
    state.view='dashboard'; state.screen='sheets'; state.isOnline=true;
    state.categories=[{ id:'c1', name:'كريب سادة لوكس', order:1, minQty:0,
      itemName:'كريب سادة', barcodeNumber:'6291108735848', originalPrice:150, sellingPrice:135,
      colorGroups:['كيوي','نصار'] }];
    state.activeCategoryId='c1';
    state.grades=[
      { id:'g1', number:1, group:'كيوي', branchQty:2, mainQty:5, status:'normal' },
      { id:'g2', number:2, group:'نصار', branchQty:0, mainQty:4, status:'pending' },
      { id:'g3', number:3, group:'', branchQty:0, mainQty:0, status:'out' },
    ];
    state.pendingByCategory={}; state.pendingCount=0; state.outByCategory={}; state.outCount=0; state.lowStockByCategory={};
    state.gradeLabelMode=false; state.bulkRequestMode=false; state.gradeSelectMode=false; state.printingGradeId=null;
    state.sideMenuOpen=false;
    render();
  });
  await boot();

  // ---------- 1) قايمة الطباعة الواحدة ----------
  const menu = await p.evaluate(() => {
    const out = {
      // الأزرار القديمة اتشالت من سطر البيانات
      looseLabel: !!document.querySelector('.cat-info-line #print-label-btn'),
      looseEdit: !!document.querySelector('.cat-info-line #edit-category-info-btn'),
      infoLine: !!document.querySelector('.cat-info-line'),
      printBtn: !!document.getElementById('tool-print-btn'),
    };
    document.getElementById('tool-print-btn').click();
    const panel = document.getElementById('tool-print-panel');
    out.open = panel.classList.contains('open');
    out.items = [...panel.querySelectorAll('.menu-item')].map(x => x.id);
    // فتح قايمة تانية بتقفل دي
    document.getElementById('tool-cat-btn').click();
    out.closedByOther = !panel.classList.contains('open');
    out.catItems = [...document.getElementById('tool-cat-panel').querySelectorAll('.menu-item')].map(x => x.id);
    document.body.click();
    return out;
  });
  check('⭐ سطر البيانات مافيهوش أزرار طباعة', !menu.looseLabel && !menu.looseEdit && menu.infoLine, menu);
  check('قايمة 🖨️ طباعة موجودة وبتفتح', menu.printBtn && menu.open, menu);
  check('⭐ الطباعة كلها جوه قايمة واحدة (5 عناصر)',
    menu.items.join(',') === 'print-label-btn,print-restock-btn,toggle-grade-label-btn,print-custom-btn,printer-settings-btn', menu.items);
  check('⭐ بيانات الفئة اتنقلت لقايمة الفئة', menu.catItems[0] === 'edit-category-info-btn', menu.catItems);
  check('فتح قايمة بتقفل التانية', menu.closedByOther, menu);

  // ---------- 2) مفتاح "من غير سعر" ----------
  const noPrice = await p.evaluate(async () => {
    document.getElementById('tool-print-btn').click();
    document.getElementById('print-label-btn').click();
    await new Promise(r => setTimeout(r, 60));
    const out = {
      hasNoPrice: !!document.getElementById('opt-no-price'),
      hasGroup: !!document.getElementById('opt-group-name'),
      defaultOff: document.getElementById('opt-no-price').checked === false,
    };
    document.getElementById('opt-no-price').checked = true;
    document.getElementById('size-measured').click();
    await new Promise(r => setTimeout(r, 400));
    out.jobs = window.__jobs.length;
    out.noPriceFlag = window.__jobs[0] && window.__jobs[0].sizeOptions.noPrice;
    // الاختيار اتحفظ في الإعدادات المشتركة (مش على الجهاز بس)
    out.saved = (getSharedPrintSettings() || {}).labelNoPrice;
    out.written = window.__writes.some(w => w.set && w.set.labelNoPrice === true);
    return out;
  });
  check('مفتاح "من غير سعر" ظاهر في ملصق الصنف', noPrice.hasNoPrice, noPrice);
  check('ومفتاح المجموعة **مش** ظاهر هنا', !noPrice.hasGroup, noPrice);
  check('الافتراضي: بالسعر', noPrice.defaultOff, noPrice);
  check('⭐ الاختيار وصل للطباعة', noPrice.jobs === 1 && noPrice.noPriceFlag === true, noPrice);
  check('⭐ الاختيار اتحفظ في الإعدادات المشتركة', noPrice.saved === true && noPrice.written, noPrice);

  // الصورة نفسها بتتغيّر فعلًا (مش بس العَلَم بيتبعت)
  const px = await p.evaluate(() => {
    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    const cat = state.categories[0];
    const ink = (dataUrl) => new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++;
        res({ dark: n, w: img.width, h: img.height });
      };
      img.src = dataUrl;
    });
    return Promise.all([
      ink(renderLabelPNG(cat, { ...size })),
      ink(renderLabelPNG(cat, { ...size, noPrice: true })),
    ]);
  });
  check('مقاس الصورة 304×200 نقطة في الحالتين',
    px[0].w === 304 && px[0].h === 200 && px[1].w === 304 && px[1].h === 200, px);
  check('⭐ "من غير سعر" بيغيّر الصورة فعلًا', px[0].dark !== px[1].dark, px);

  // ---------- 3) اسم المجموعة مع الدرجة ----------
  const names = await p.evaluate(() => ({
    plain: gradeLabelText(state.grades[0], false),
    withGroup: gradeLabelText(state.grades[0], true),
    noGroup: gradeLabelText(state.grades[2], true),
    base: gradeLabelText({ isBase: true, name: 'أبيض', group: 'كيوي' }, true),
  }));
  check('من غير مجموعة: "درجة 1"', names.plain === 'درجة 1', names);
  check('⭐ مع المجموعة: "كيوي درجة 1"', names.withGroup === 'كيوي درجة 1', names);
  check('⭐ درجة من غير مجموعة مابتتغيّرش', names.noGroup === 'درجة 3', names);
  check('⭐ الدرجة الأساسية بتفضل باسمها', names.base === 'أبيض', names);

  const groupOpt = await p.evaluate(async () => {
    window.__jobs = [];
    state.gradeLabelMode = true;
    state.gradeLabelQty = { g1: 2 };
    render();
    document.getElementById('print-grade-labels-btn').click();
    await new Promise(r => setTimeout(r, 60));
    const out = {
      hasGroup: !!document.getElementById('opt-group-name'),
      hasNoPrice: !!document.getElementById('opt-no-price'),
      copiesHidden: document.getElementById('label-copies').closest('.field').style.display === 'none',
    };
    document.getElementById('opt-group-name').checked = true;
    document.getElementById('size-measured').click();
    await new Promise(r => setTimeout(r, 500));
    out.jobs = window.__jobs.length;
    out.withGroup = window.__jobs[0] && window.__jobs[0].sizeOptions.withGroup;
    out.saved = (getSharedPrintSettings() || {}).gradeLabelWithGroup;
    state.gradeLabelMode = false; state.gradeLabelQty = {}; render();
    return out;
  });
  check('مفتاح المجموعة ظاهر في ملصقات الدرجات', groupOpt.hasGroup, groupOpt);
  check('ومفتاح السعر **مش** ظاهر هنا (الملصق مافيهوش سعر أصلًا)', !groupOpt.hasNoPrice, groupOpt);
  check('عدد اللاصقات مخفي (لكل درجة عددها)', groupOpt.copiesHidden, groupOpt);
  check('⭐ اختيار المجموعة وصل واتحفظ', groupOpt.jobs === 1 && groupOpt.withGroup === true && groupOpt.saved === true, groupOpt);

  // ---------- 4) طباعة مسمّى ----------
  const custom = await p.evaluate(async () => {
    window.__jobs = [];
    document.getElementById('tool-print-btn').click();
    document.getElementById('print-custom-btn').click();
    await new Promise(r => setTimeout(r, 60));
    const out = { opened: !!document.getElementById('custom-label-form') };
    out.focused = document.activeElement && document.activeElement.id === 'custom-line1';

    // نص فاضي مابيطبعش
    document.getElementById('custom-label-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 120));
    out.emptyBlocked = window.__jobs.length === 0 && !!document.getElementById('custom-label-form');

    document.getElementById('custom-line1').value = 'بضاعة مرتجعة';
    document.getElementById('custom-line2').value = 'مورّد: نصار';
    document.getElementById('custom-copies').value = '4';
    document.getElementById('custom-label-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 600));
    out.closed = !document.getElementById('custom-label-form');
    out.jobs = window.__jobs.length;
    const j = window.__jobs[0];
    out.copies = j && j.jobs[0].copies;
    out.isImage = !!(j && j.jobs[0].image && /^data:image\/png/.test(j.jobs[0].image));
    // نفس المسار اللي بيمشي فيه ملصق الصنف بالظبط — أيًا كان المفتاح
    const ref = await buildItemLabel({ itemName:'س', barcodeNumber:'1', sellingPrice:1 },
                                     { pageWidthMm:38, pageHeightMm:25, halves:2 }, 1);
    out.sameRoute = out.isImage === !!ref.image;
    out.hasText = !!(j && /بضاعة مرتجعة/.test(j.jobs[0].html || ''));
    out.size = j && [j.sizeOptions.pageWidthMm, j.sizeOptions.pageHeightMm, j.sizeOptions.halves].join('x');
    return out;
  });
  check('شاشة "طباعة مسمّى" بتفتح والمؤشر في أول خانة', custom.opened && custom.focused, custom);
  check('⭐ نص فاضي مابيطبعش', custom.emptyBlocked, custom);
  check('⭐ المسمّى اتطبع بالعدد الصح', custom.jobs === 1 && custom.copies === 4, custom);
  // ⚠️ مش "بيتبعت كصورة" — الافتراضي اتغيّر في v0.36.0. اللي يهم إنه بيمشي
  // في **نفس** مسار باقي الملصقات، مش مسار لوحده.
  check('⭐ بيمشي في نفس مسار باقي الملصقات', custom.sameRoute, custom);
  check('⭐ نص المسمّى وصل الطباعة', custom.hasText, custom);
  check('بنفس مقاس اللفة 38×25 نصين', custom.size === '38x25x2', custom);

  // ---------- 5) رمز الطباعة جوه صف الدرجة ----------
  const rowPrint = await p.evaluate(async () => {
    window.__jobs = [];
    render();
    const out = { icons: document.querySelectorAll('[data-print-grade-id]').length };
    // موجود على كل الحالات مش على "عادي" بس
    out.onPending = !!document.querySelector('[data-print-grade-id="g2"]');
    out.onOut = !!document.querySelector('[data-print-grade-id="g3"]');

    document.querySelector('[data-print-grade-id="g1"]').click();
    out.boxOpen = !!document.getElementById('grade-print-qty');
    out.defaultQty = document.getElementById('grade-print-qty').value;
    out.onlyOneBox = document.querySelectorAll('#grade-print-qty').length === 1;

    // الإلغاء بيقفل الخانة من غير طباعة
    document.querySelector('[data-print-grade-cancel]').click();
    out.cancelled = !document.getElementById('grade-print-qty') && window.__jobs.length === 0;

    document.querySelector('[data-print-grade-id="g1"]').click();
    document.getElementById('grade-print-qty').value = '3';
    document.querySelector('[data-print-grade-go]').click();
    await new Promise(r => setTimeout(r, 600));
    out.jobs = window.__jobs.length;
    out.copies = window.__jobs[0] && window.__jobs[0].jobs[0].copies;
    out.boxClosed = !document.getElementById('grade-print-qty');
    return out;
  });
  check('🖨️ رمز الطباعة تحت كل درجة', rowPrint.icons === 3 && rowPrint.onPending && rowPrint.onOut, rowPrint);
  check('⭐ الدوسة الأولى بتفتح خانة عدد جوه الصف', rowPrint.boxOpen && rowPrint.defaultQty === '1', rowPrint);
  check('خانة واحدة بس مفتوحة في المرة', rowPrint.onlyOneBox, rowPrint);
  check('الإلغاء بيقفل من غير طباعة', rowPrint.cancelled, rowPrint);
  check('⭐ الدوسة التانية بتطبع بالعدد المكتوب', rowPrint.jobs === 1 && rowPrint.copies === 3, rowPrint);
  check('الخانة بتتقفل بعد الطباعة', rowPrint.boxClosed, rowPrint);

  // الرمز بيستخدم اسم الفئة + مسمّى الدرجة (وبيحترم مفتاح المجموعة المحفوظ)
  const rowText = await p.evaluate(async () => {
    // بنراقب الطريقتين (صورة/نص) — الافتراضي اتغيّر في v0.36.0
    const seen = [];
    const oPNG = window.renderGradeLabelPNG;
    const oHTML = window.buildGradeLabelHTML;
    window.renderGradeLabelPNG = (a, b, s) => { seen.push([a, b]); return oPNG(a, b, s); };
    window.buildGradeLabelHTML = (a, b, s, c) => { seen.push([a, b]); return oHTML(a, b, s, c); };
    await printOneGradeLabel('g1', 1);
    window.renderGradeLabelPNG = oPNG;
    window.buildGradeLabelHTML = oHTML;
    return seen[0];
  });
  check('⭐ الملصق = اسم الفئة + مسمّى الدرجة',
    rowText && rowText[0] === 'كريب سادة لوكس' && rowText[1] === 'كيوي درجة 1', rowText);

  // ---------- 6) الرمز بيختفي في الأوضاع ----------
  const modes = await p.evaluate(() => {
    const out = {};
    state.printingGradeId = 'g1';
    document.getElementById('toggle-grade-select-btn').click();
    out.selectIcons = document.querySelectorAll('[data-print-grade-id]').length;
    out.boxReset = state.printingGradeId === null;
    document.getElementById('toggle-grade-select-btn').click();
    document.getElementById('toggle-bulk-request-btn').click();
    out.bulkIcons = document.querySelectorAll('[data-print-grade-id]').length;
    document.getElementById('toggle-bulk-request-btn').click();
    out.backIcons = document.querySelectorAll('[data-print-grade-id]').length;
    return out;
  });
  check('الرمز مابيظهرش في وضع الحذف ولا التزويد', modes.selectIcons === 0 && modes.bulkIcons === 0, modes);
  check('خانة العدد بتتصفّر لما تدخل وضع', modes.boxReset, modes);
  check('وبيرجع بعد الخروج من الوضع', modes.backIcons === 3, modes);

  // ---------- 7) الصلاحيات ----------
  const perms = await p.evaluate(() => {
    state.profile = { name: 'ع', role: 'warehouse_keeper', warehouseAccess: 'branch', perms: { printLabel: false } };
    render();
    const out = {
      icons: document.querySelectorAll('[data-print-grade-id]').length,
      items: [...document.querySelectorAll('#tool-print-panel .menu-item')].map(x => x.id),
    };
    state.profile = { name: 'x', role: 'owner', warehouseAccess: 'both' };
    render();
    return out;
  });
  check('⭐ مقفول عليه الملصقات: مفيش رمز طباعة', perms.icons === 0, perms);
  check('ومفيش ملصق ولا مسمّى في القايمة',
    !perms.items.includes('print-label-btn') && !perms.items.includes('print-custom-btn'), perms);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
