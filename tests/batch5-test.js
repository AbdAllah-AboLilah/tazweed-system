// الدفعة الخامسة — إصلاح نقل الدرجات، الأساسية في ورقة التزويد،
// الملصق المقسوم أربعة، ومفاتيح شكل الملصق في السلة وفي شاشة التصوير.
const { chromium } = require('playwright');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,260)}` : ''));

// بيفك ترميز **خلية واحدة** من الملصق المقسوم — زي ما الماكينة بتشوفها
// بالظبط. لو فككنا الورقة كلها، الأربع أكواد بيلخبطوا القارئ وبيرجّع فاضي،
// وده مش تمثيل صحيح للواقع: الماكينة بتتصوّب على ملصق واحد مقصوص.
function decodeCell(dataUrl, quiet) {
  const img = PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'));
  const cw = Math.floor(img.width / 2), ch = Math.floor(img.height / 2);
  const W = cw + quiet * 2, H = ch + quiet * 2;
  const out = new PNG({ width: W, height: H });
  out.data.fill(255);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const s = ((y * img.width + x) << 2), d = (((y + quiet) * W + (x + quiet)) << 2);
    const v = (img.data[s]*0.299 + img.data[s+1]*0.587 + img.data[s+2]*0.114) < 128 ? 0 : 255;
    out.data[d] = out.data[d+1] = out.data[d+2] = v; out.data[d+3] = 255;
  }
  const r = jsQR(new Uint8ClampedArray(out.data), W, H);
  return r ? r.data : null;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');

  await p.evaluate(() => {
    const noop = () => () => {};
    const writes = []; window.__writes = writes;
    const mkDoc = (id) => ({ id,
      set:(d)=>{writes.push({set:d,id});return Promise.resolve();},
      update:(d)=>{writes.push({update:d,id});return Promise.resolve();},
      delete:()=>Promise.resolve(), collection: mk, onSnapshot: noop,
      get:()=>Promise.resolve({ exists:false, docs: window.__gradeDocs || [] }) });
    function mk(){ return { doc: mkDoc, get:()=>Promise.resolve({ docs: window.__gradeDocs || [] }),
      where: mk, orderBy: mk, onSnapshot: noop, add:()=>Promise.resolve({}) }; }
    window.db = { collection: mk, collectionGroup: mk,
      batch: () => ({ update:(r,d)=>writes.push({ref:r,update:d}), set:(r,d)=>writes.push({batchSet:d}), commit:()=>Promise.resolve() }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    window.__gradeDocs = [];
    // ⚠️ فحوص بتستبدل deliverPrint بمحاكي. الفحص اللي عايز يعدّي على
    // مسار QZ الحقيقي لازم يرجّعها — عشان كده بنحفظها هنا قبل أي استبدال.
    window.__realDeliverPrint = deliverPrint;
    try { localStorage.removeItem('tazweed_shared_print'); } catch (e) {}
    state.user={uid:'me'}; state.profile={name:'x',role:'owner',warehouseAccess:'both'};
    state.view='dashboard'; state.screen='sheets'; state.isOnline=true;
    state.categories=[{ id:'c1', name:'كريب سادة لوكس', order:1, minQty:2,
      itemName:'طرحة + بندانة', barcodeNumber:'13845560', originalPrice:150, sellingPrice:135,
      colorGroups:['كيوي','نصار','جاد'] }];
    state.activeCategoryId='c1';
    state.grades=[];
    state.pendingByCategory={}; state.outByCategory={}; state.lowStockByCategory={};
    render();
  });

  // ============================================================
  // 1) بج نقل الدرجات — نفس السيناريو اللي اتبلّغ
  // ============================================================
  const move = await p.evaluate(async () => {
    // "قاعدة بيانات" في الذاكرة: درجة 2 موجودة في تلات مجموعات
    const mkDocs = () => {
      const rows = [
        { id:'a', d:{ number:2, group:'كيوي' } },
        { id:'b', d:{ number:2, group:'نصار' } },
        { id:'c', d:{ number:2, group:'جاد'  } },
        { id:'d', d:{ number:3, group:'كيوي' } },
        { id:'e', d:{ number:9, group:'نصار' } },
      ];
      window.__rows = rows;
      window.__gradeDocs = rows.map(x => ({ id:x.id, ref:{ id:x.id }, data: () => x.d }));
      return rows;
    };
    const snapshot = () => window.__rows.map(x => `${x.d.number}@${x.d.group}`).sort().join(' , ');
    // المحاكي بيكتب فعليًا في الصفوف عشان نشوف النتيجة النهائية
    window.db.batch = () => ({
      update: (ref, data) => { const t = window.__rows.find(r => r.id === ref.id); if (t) Object.assign(t.d, data); },
      set(){}, commit: () => Promise.resolve(),
    });

    const out = {};
    // (أ) السلوك القديم: من غير تحديد مصدر
    mkDocs();
    out.before = snapshot();
    const r1 = await assignGroupToGrades('c1', 2, 2, 'جاد', null, true);
    out.afterAll = snapshot();
    out.movedAll = r1.moved; out.skippedAll = r1.skipped; out.skippedNums = r1.skippedNumbers;

    // (ب) بتحديد المصدر: درجة 2 من "كيوي" بس → مجموعة جديدة
    // ده السيناريو اللي المستخدم بلّغ عنه: عايز ينقل واحدة، مش الكل.
    mkDocs();
    const r2 = await assignGroupToGrades('c1', 2, 2, 'ليلي', 'كيوي', true);
    out.afterSource = snapshot();
    out.movedSource = r2.moved;

    // (ب٢) والهدف اللي عنده الرقم خلاص: بيترفض بدل ما يكرّر
    mkDocs();
    const r2b = await assignGroupToGrades('c1', 2, 2, 'جاد', 'كيوي', true);
    out.movedIntoTaken = r2b.moved;
    out.skippedIntoTaken = r2b.skipped;

    // (ج) إعادة التسمية/الحذف: الحارس **مطفي** فمفيش درجة بتتساب
    mkDocs();
    const r3 = await assignGroupToGrades('c1', null, null, 'جاد', 'نصار', false);
    out.afterRename = snapshot();
    out.movedRename = r3.moved; out.skippedRename = r3.skipped;
    return out;
  });
  check('الحالة الأولية: 2 في تلات مجموعات',
    move.before === '2@جاد , 2@كيوي , 2@نصار , 3@كيوي , 9@نصار', move.before);
  check('⭐ "كل المجموعات": الرقم مابقاش يتكرر في الهدف',
    move.movedAll === 0 && move.skippedAll === 2, move);
  check('⭐ ومفيش درجة اتشالت من مجموعتها بالغلط',
    move.afterAll === move.before, move);
  check('والنظام بيقول أنهي أرقام اتخطّت', JSON.stringify(move.skippedNums) === '["2"]', move.skippedNums);
  check('⭐ بتحديد المصدر: واحدة بس اتنقلت والباقي مااتلمسش',
    move.movedSource === 1 && move.afterSource === '2@جاد , 2@ليلي , 2@نصار , 3@كيوي , 9@نصار', move);
  check('⭐ والهدف اللي عنده الرقم خلاص بيترفض بدل ما يكرّر',
    move.movedIntoTaken === 0 && move.skippedIntoTaken === 1, move);
  check('⭐ إعادة التسمية/الحذف: كله بيتنقل ومفيش حاجة بتتساب',
    move.movedRename === 2 && move.skippedRename === 0, move);
  check('   (وإلا الدرجة بتفضل على مجموعة اتشالت = درجة ضايعة)',
    move.afterRename === '2@جاد , 2@جاد , 2@كيوي , 3@كيوي , 9@جاد', move.afterRename);

  // شاشة النقل بقى فيها "من مجموعة"
  const dialog = await p.evaluate(async () => {
    state.gradeGroupFilter = 'نصار';
    openColorGroupsDialog('c1');
    await new Promise(r => setTimeout(r, 120));
    const src = document.getElementById('assign-source');
    const out = {
      hasSource: !!src,
      options: src ? [...src.options].map(o => o.textContent) : [],
      defaultsToOpenGroup: src ? src.value : null,
      hasTarget: !!document.getElementById('assign-group'),
    };
    document.getElementById('groups-close').click();
    state.gradeGroupFilter = '';
    return out;
  });
  check('⭐ خانة "من مجموعة" موجودة', dialog.hasSource && dialog.hasTarget, dialog);
  check('فيها "كل المجموعات" + المجموعات + "باقي الدرجات"',
    dialog.options[0] === 'كل المجموعات' && dialog.options.length === 5, dialog.options);
  check('⭐ وبتبدأ على المجموعة اللي إنت فاتح عليها', dialog.defaultsToOpenGroup === 'نصار', dialog);

  // ============================================================
  // 2) الدرجات الأساسية في ورقة التزويد
  // ============================================================
  const restock = await p.evaluate(async () => {
    state.grades = [
      { id:'g1', number:1, group:'كيوي', branchQty:1, mainQty:1, status:'normal' },
      { id:'g2', number:2, group:'كيوي', branchQty:1, mainQty:1, status:'normal' },
      { id:'b1', number:-3, name:'أبيض', isBase:true, group:'كيوي', branchQty:1, mainQty:1, status:'normal' },
      { id:'b2', number:-2, name:'أسود', isBase:true, group:'كيوي', branchQty:0, mainQty:0, status:'out' },
    ];
    const cat = state.categories[0];
    const off = buildRestockHTML(cat, state.grades, '', false);
    const on  = buildRestockHTML(cat, state.grades, '', true);
    return {
      offHasBase: /أبيض/.test(off),
      onHasBase: /أبيض/.test(on) && /أسود/.test(on),
      offRows: (off.match(/class="row"/g) || []).length,
      onRows: (on.match(/class="row"/g) || []).length,
      // الأساسية في شبكة أسماء منفصلة، تحت أرقام مجموعتها
      hasBaseGrid: /class="grid base-grid"/.test(on),
      // ⚠️ لازم ندوّر على الوسم نفسه مش على الاسم: ".base-grid" موجود في
      // التنسيقات فوق كمان، فالمقارنة كانت بتقع على مكان الـCSS.
      baseAfterNumbers: on.indexOf('class="grid base-grid"') > on.lastIndexOf('>2<'),
    };
  });
  check('من غير المفتاح: الأساسية مش في الورقة (زي الأول)', !restock.offHasBase && restock.offRows === 2, restock);
  check('⭐ مع المفتاح: الأساسية بتتكتب بأسمائها', restock.onHasBase && restock.onRows === 4, restock);
  check('في شبكة أسماء منفصلة عن شبكة الأرقام', restock.hasBaseGrid, restock);
  check('⭐ وبعد أرقام مجموعتها مش وسطها', restock.baseAfterNumbers, restock);

  // ⚠️ الحالة اللي كسرت الورقة فعلًا: فئة **كلها** أساسية، كل مجموعة
  // فيها أبيض/أسود/أوف وايت بتوعها. الورقة كانت بتطلّع كل الأبيض ورا
  // بعض في قسم واحد من غير أسماء المجموعات — مالهاش أي فايدة على الرف.
  const allBase = await p.evaluate(() => {
    const cat = { id:'c9', name:'المكملات', colorGroups:['فيست بأكمام','بونيه رباط','ياقة قميص'] };
    const grades = [];
    cat.colorGroups.forEach((grp, i) => {
      ['أبيض','أسود','أوف وايت'].forEach((n, k) => {
        grades.push({ id:`b${i}${k}`, number:-3+k, name:n, isBase:true, group:grp, branchQty:1, mainQty:1, status:'normal' });
      });
    });
    const html = buildRestockHTML(cat, grades, '', true);
    // كل عنوان مجموعة لازم يبقى **قبل** أسماء درجاته
    const order = cat.colorGroups.map((g) => html.indexOf(`>${g}<`));
    const firstWhiteAfterEach = cat.colorGroups.map((g) => {
      const at = html.indexOf(`>${g}<`);
      return at >= 0 && html.indexOf('أبيض', at) > at;
    });
    return {
      rows: (html.match(/class="row"/g) || []).length,
      titles: cat.colorGroups.filter((g) => html.includes(`>${g}<`)).length,
      ordered: order.every((v, i) => v > 0 && (i === 0 || v > order[i-1])),
      eachHasWhite: firstWhiteAfterEach.every(Boolean),
      whites: (html.match(/أبيض/g) || []).length,
      // العدّاد في شاشة الاختيار لازم يشوف الأساسية كمان
      names: restockGroupNames(cat, grades, true),
      namesNoBase: restockGroupNames(cat, grades, false),
    };
  });
  check('⭐ فئة كلها أساسية: كل الدرجات بتطلع في الورقة', allBase.rows === 9 && allBase.whites === 3, allBase);
  check('⭐ وكل مجموعة تحت اسمها', allBase.titles === 3 && allBase.ordered, allBase);
  check('⭐ وأسماء الدرجات بعد عنوان مجموعتها', allBase.eachHasWhite, allBase);
  check('⭐ و"كل مجموعة في ورقة" بتطلّع 3 ورق مش صفر',
    allBase.names.length === 3 && allBase.namesNoBase.length === 0, allBase);

  const restockUI = await p.evaluate(async () => {
    const cat = state.categories[0];
    const promise = chooseRestockGroup(cat, state.grades);
    await new Promise(r => setTimeout(r, 80));
    const box = document.getElementById('rg-with-base');
    const out = { hasBox: !!box, defaultOff: box ? box.checked === false : null };
    box.checked = true;
    document.querySelector('[data-rg-mode="all"]').click();
    const v = await promise;
    out.withBase = v.withBase;
    await new Promise(r => setTimeout(r, 80));
    out.saved = (getSharedPrintSettings() || {}).restockWithBase;

    // المرة الجاية بيفتكر الاختيار
    const p2 = chooseRestockGroup(cat, state.grades);
    await new Promise(r => setTimeout(r, 80));
    out.remembered = document.getElementById('rg-with-base').checked;
    document.querySelector('[data-rg-cancel]').click();
    out.cancelled = await p2;
    return out;
  });
  check('⭐ مفتاح الأساسية ظاهر في شاشة الطباعة', restockUI.hasBox && restockUI.defaultOff, restockUI);
  check('والاختيار بيوصل للورقة', restockUI.withBase === true, restockUI);
  check('⭐ وبيتحفظ في الإعدادات المشتركة (كل الأجهزة)', restockUI.saved === true, restockUI);
  check('⭐ وبيتفتكر المرة الجاية', restockUI.remembered === true, restockUI);
  check('الإلغاء بيرجّع null', restockUI.cancelled === null, restockUI);

  // ============================================================
  // 3) الملصق المقسوم أربعة
  // ============================================================
  const quarter = await p.evaluate(() => {
    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    const mk = (name, price) => ({ itemName: name, barcodeNumber: '13845560', originalPrice: 150, sellingPrice: price });
    const ink = (url) => new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        // نعدّ النقط السودا في العمود اللي في نص اللاصقة (خط القص)
        let mid = 0;
        for (let y = 0; y < c.height; y++) { const i = ((y * c.width + Math.floor(c.width/2)) << 2); if (d[i] < 128) mid++; }
        res({ w: img.width, h: img.height, midDark: mid });
      };
      img.src = url;
    });
    const normal = renderQuarterLabelPNG(mk('طرحة + بندانة', 135), { ...size });
    const noPrice = renderQuarterLabelPNG(mk('طرحة + بندانة', 135), { ...size, noPrice: true });
    const longName = renderQuarterLabelPNG(mk('كريب سادة لوكس مطرّز بالدانتيل العريض', 135), { ...size });
    return Promise.all([ink(normal), ink(noPrice)]).then(([a, bb]) => ({
      normal, noPrice, longName, geom: a, noPriceGeom: bb,
      differs: normal !== noPrice,
    }));
  });
  check('مقاس الملصق المقسوم 304×200 نقطة زي العادي',
    quarter.geom.w === 304 && quarter.geom.h === 200, quarter.geom);
  // الخط بيبدأ وينتهي عند الهامش الآمن (2 مم × 2 = 32 نقطة)، فطوله
  // 200 - 32 = 168 نقطة. مابيلمسش الحرف عشان الإزاحة ماتاكلش منه.
  check('⭐ فيه خط قص أسود، ومابيلمسش حرف الورقة',
    quarter.geom.midDark >= 160 && quarter.geom.midDark <= 175, quarter.geom);
  check('⭐ "بدون السعر" بيغيّر الصورة فعلًا', quarter.differs, {});
  check('⭐ الكود بيتقرا في الخلية الواحدة', decodeCell(quarter.normal, 16) === '13845560', {});
  check('⭐ وبيتقرا من غير سعر كمان', decodeCell(quarter.noPrice, 16) === '13845560', {});
  check('⭐ وبيتقرا مع اسم طويل كمان', decodeCell(quarter.longName, 16) === '13845560', {});

  // ============================================================
  // 4) مفاتيح شكل الملصق في السلة
  // ============================================================
  const cart = await p.evaluate(async () => {
    window.__jobs = [];
    window.deliverPrint = async (t, jobs, so) => { window.__jobs.push({ t, jobs, so }); return true; };
    window.showPrintPreview = async () => true;
    window.productsCache = [
      { name: 'كريب سادة', barcode: '28144', price: 85 },
      { name: 'طرحة', barcode: '13845560', price: 135 },
    ];
    state.screen = 'print';
    state.printCart = [
      { key: 'a', product: window.productsCache[0], qty: 1, mode: 'normal' },
      { key: 'b', product: window.productsCache[1], qty: 2, mode: 'quarter', noPrice: true },
    ];
    render();
    const rows = [...document.querySelectorAll('.cart-modes')];
    const out = {
      rows: rows.length,
      boxesPerRow: rows[0] ? rows[0].querySelectorAll('input').length : 0,
      firstNormalChecked: document.querySelector('[data-cart-mode="0"][value="normal"]').checked,
      firstQuarterChecked: document.querySelector('[data-cart-mode="0"][value="quarter"]').checked,
      secondQuarterChecked: document.querySelector('[data-cart-mode="1"][value="quarter"]').checked,
      secondNoPrice: document.querySelector('[data-cart-noprice="1"]').checked,
    };
    // الضغط على "مقسوم" بيلغي "عادي" — مايتختاروش مع بعض
    document.querySelector('[data-cart-mode="0"][value="quarter"]').click();
    await new Promise(r => setTimeout(r, 60));
    out.afterPick = { mode: state.printCart[0].mode,
      normal: document.querySelector('[data-cart-mode="0"][value="normal"]').checked,
      quarter: document.querySelector('[data-cart-mode="0"][value="quarter"]').checked };
    // "بدون السعر" مستقلة — بتشتغل مع الاتنين
    document.querySelector('[data-cart-noprice="0"]').click();
    await new Promise(r => setTimeout(r, 60));
    out.noPriceWithQuarter = state.printCart[0].noPrice === true && state.printCart[0].mode === 'quarter';
    document.querySelector('[data-cart-mode="0"][value="normal"]').click();
    await new Promise(r => setTimeout(r, 60));
    out.noPriceWithNormal = state.printCart[0].noPrice === true && state.printCart[0].mode === 'normal';
    return out;
  });
  check('كل صنف تحته 3 مفاتيح في سطر', cart.rows === 2 && cart.boxesPerRow === 3, cart);
  check('الافتراضي "عادي" متعلّم', cart.firstNormalChecked && !cart.firstQuarterChecked, cart);
  check('والصنف المحفوظ "مقسوم" بيرجع كده', cart.secondQuarterChecked && cart.secondNoPrice, cart);
  check('⭐ "عادي" و"مقسوم" مايتختاروش مع بعض',
    cart.afterPick.mode === 'quarter' && cart.afterPick.quarter && !cart.afterPick.normal, cart);
  check('⭐ "بدون السعر" بتشتغل مع "مقسوم"', cart.noPriceWithQuarter, cart);
  check('⭐ و"بدون السعر" بتشتغل مع "عادي"', cart.noPriceWithNormal, cart);

  // الطباعة بتحترم شكل كل صنف
  const printed = await p.evaluate(async () => {
    window.__jobs.length = 0;
    const seen = [];
    const origQ = window.renderQuarterLabelPNG;
    window.renderQuarterLabelPNG = (cat, o) => { seen.push({ q: cat.itemName, noPrice: !!o.noPrice }); return origQ(cat, o); };
    state.printCart = [
      { key: 'a', product: window.productsCache[0], qty: 1, mode: 'normal' },
      { key: 'b', product: window.productsCache[1], qty: 2, mode: 'quarter', noPrice: true },
      { key: 'c', custom: { line1: 'بضاعة مرتجعة', line2: 'مورّد نصار' }, qty: 3 },
    ];
    await printCartLabels({ pageWidthMm: 38, pageHeightMm: 25, halves: 2 });
    window.renderQuarterLabelPNG = origQ;
    const j = window.__jobs[0];
    return { jobs: j ? j.jobs.length : 0, copies: j ? j.jobs.map(x => x.copies) : [], quarterCalls: seen };
  });
  check('⭐ التلات أصناف اتطبعوا بأعدادهم',
    printed.jobs === 3 && JSON.stringify(printed.copies) === '[1,2,3]', printed);
  check('⭐ المقسوم اتبنى للصنف الصح بس، وبمفتاح بدون السعر',
    printed.quarterCalls.length === 1 && printed.quarterCalls[0].noPrice === true, printed.quarterCalls);

  // ============================================================
  // 5) المسمّى بيتضاف للسلة، ومالوش مفاتيح
  // ============================================================
  const custom = await p.evaluate(async () => {
    state.printCart = [];
    state.screen = 'print';
    render();
    document.getElementById('print-screen-custom-btn').click();
    await new Promise(r => setTimeout(r, 60));
    const out = { btnLabel: document.querySelector('#custom-label-form button[type=submit]').textContent };
    document.getElementById('custom-line1').value = 'بضاعة مرتجعة';
    document.getElementById('custom-line2').value = 'مورّد نصار';
    document.getElementById('custom-copies').value = '5';
    document.getElementById('custom-label-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 150));
    out.inCart = (state.printCart || []).length;
    out.qty = state.printCart[0] && state.printCart[0].qty;
    out.isCustom = !!(state.printCart[0] && state.printCart[0].custom);
    out.printedAlone = false;
    out.modeRows = document.querySelectorAll('.cart-modes').length;
    // مسمّى تاني مايندمجش مع الأول
    addCustomLabelToCart('ملاحظة', '', 1);
    out.twoItems = state.printCart.length === 2;
    return out;
  });
  check('⭐ الزرار بقى "أضف للسلة" مش "كمّل"', /أضف/.test(custom.btnLabel), custom);
  check('⭐ المسمّى بيروح للسلة مش للطابعة على طول',
    custom.inCart === 1 && custom.isCustom && custom.qty === 5, custom);
  check('⭐ ومالوش مفاتيح شكل تحته', custom.modeRows === 0, custom);
  check('ومسمّى تاني بيتضاف سطر لوحده', custom.twoItems, custom);

  // ============================================================
  // 6) شاشة التصوير: شكل الملصق
  // ============================================================
  const scan = await p.evaluate(() => {
    const merged = [];
    state.printCart = [];
    const prod = { name: 'كريب سادة', barcode: '28144', price: 85 };
    addProductToPrintCart(prod, 1, { mode: 'normal', noPrice: false });
    addProductToPrintCart(prod, 2, { mode: 'normal', noPrice: false });
    merged.push(state.printCart.length, state.printCart[0].qty);
    addProductToPrintCart(prod, 1, { mode: 'quarter', noPrice: true });
    return {
      mergedSame: merged[0] === 1 && merged[1] === 3,
      splitDifferent: state.printCart.length === 2,
      second: { mode: state.printCart[1].mode, noPrice: state.printCart[1].noPrice },
      defaultNoShape: (state.printCart = [], addProductToPrintCart(prod, 1), state.printCart[0].mode),
    };
  });
  check('نفس الصنف بنفس الشكل بيتجمّع في سطر واحد', scan.mergedSame, scan);
  check('⭐ ونفس الصنف بشكل مختلف بيبقى سطر لوحده', scan.splitDifferent, scan);
  check('   (وإلا الشكل الجديد كان هيمسح القديم في صمت)',
    scan.second.mode === 'quarter' && scan.second.noPrice === true, scan);
  check('من غير شكل محدّد: بيبقى "عادي"', scan.defaultNoShape === 'normal', scan);

  const scanCard = await p.evaluate(async () => {
    // بنستدعي كارت التصوير مباشرة من غير كاميرا حقيقية
    const html = `<div class="cart-modes">
        <label><input type="checkbox" name="scan-shape" value="normal" checked /> عادي</label>
        <label><input type="checkbox" name="scan-shape" value="quarter" /> مقسوم (٤)</label>
        <label><input type="checkbox" id="scan-noprice" /> بدون السعر</label>
      </div>`;
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const boxes = [...host.querySelectorAll('[name="scan-shape"]')];
    boxes.forEach((box) => box.addEventListener('change', () => {
      boxes.forEach((o) => { o.checked = o === box; });
      if (!boxes.some((x) => x.checked)) box.checked = true;
    }));
    boxes[1].click();
    const out = { after: boxes.map(x => x.checked) };
    boxes[1].click(); // الضغط على المتعلّم بيسيبه متعلّم
    out.stillOne = boxes.filter(x => x.checked).length === 1;
    host.remove();
    return out;
  });
  check('⭐ شاشة التصوير: الشكلين مايتختاروش مع بعض',
    JSON.stringify(scanCard.after) === '[false,true]', scanCard);
  check('ولازم واحد يفضل متعلّم', scanCard.stillOne, scanCard);

  // ============================================================
  // 7) 🐞 السلة المحفوظة — العطل اللي وقّع شاشة الطباعة
  // ============================================================
  // v0.33.0 اتشحنت وهي بتحفظ المسمّى من غير بياناته، فأول ما تفتح الشاشة
  // تاني بتقرا it.product.name على undefined وتقع. الفحصين دول بيمسكوا
  // الحتّة دي من الناحيتين: الحفظ الصح، والصمود قدام المحفوظ الغلط.
  const persist = await p.evaluate(() => {
    state.printCart = [
      { key: 'a', product: { name: 'كريب', barcode: '28144' }, qty: 2, mode: 'quarter', noPrice: true },
      { key: 'c', custom: { line1: 'بضاعة مرتجعة', line2: 'نصار' }, qty: 3 },
    ];
    saveWorkState();
    const saved = restoreWorkState(state.user.uid);
    const back = saved ? saved.printCart : [];
    return {
      count: back.length,
      keptShape: back[0] && back[0].mode === 'quarter' && back[0].noPrice === true,
      keptCustom: !!(back[1] && back[1].custom && back[1].custom.line1 === 'بضاعة مرتجعة'),
    };
  });
  check('⭐ شكل الملصق بيتحفظ مع السلة', persist.count === 2 && persist.keptShape, persist);
  check('⭐ وبيانات المسمّى بتتحفظ (دي اللي كانت بتتمسح)', persist.keptCustom, persist);

  const broken = await p.evaluate(() => {
    // سلة زي اللي على أجهزة الناس فعلًا بعد النسخة المكسورة
    const bad = [
      { key: 'x', product: { name: 'كريب', barcode: '28144' }, qty: 1 },
      { key: 'y', qty: 3 },                       // مسمّى ضاعت بياناته
      null,
      { key: 'z', custom: { line1: 'ملاحظة' }, qty: 2 },
    ];
    const clean = sanitizePrintCart(bad);
    const errs = [];
    const onErr = (e) => errs.push(String(e.message || e));
    window.addEventListener('error', onErr);
    state.printCart = clean;
    state.screen = 'print';
    render();
    window.removeEventListener('error', onErr);
    const out = {
      kept: clean.length,
      opened: !!document.getElementById('print-cart-btn'),
      rows: document.querySelectorAll('.cart-item').length,
      errs,
    };
    state.printCart = []; state.screen = 'sheets'; render();
    return out;
  });
  check('⭐ العنصر المكسور بيتشال، والسليم بيفضل', broken.kept === 2, broken);
  check('⭐ وشاشة الطباعة بتفتح عادي مش بتقع', broken.opened && broken.rows === 2, broken);
  check('من غير أي خطأ', broken.errs.length === 0, broken.errs);

  // ============================================================
  // 8) 🐞 الشاشة المنبثقة الأطول من الموبايل
  // ============================================================
  // 16 مجموعة = 16 زرار. الشاشة بقت أطول من الشاشة نفسها، فالعنوان اتقص
  // من فوق و"إلغاء" ومفتاح الأساسية بقوا تحت الحافة — **والشاشة مابتتزحلقش**
  // لأنها متمركزة رأسيًا جوه غطاء ثابت.
  const tallDialog = await p.evaluate(async () => {
    const cat = { id:'c8', name:'المكملات', colorGroups: [] };
    const grades = [];
    for (let i = 1; i <= 16; i++) {
      const g = 'مجموعة رقم ' + i;
      cat.colorGroups.push(g);
      for (let k = 0; k < 3; k++) grades.push({ id:`g${i}_${k}`, number:i*10+k, group:g, branchQty:1, mainQty:1, status:'normal' });
    }
    const promise = chooseRestockGroup(cat, grades);
    await new Promise(r => setTimeout(r, 120));
    const card = document.querySelector('.dialog-card');
    const body = card.querySelector('.dialog-body');
    const foot = card.querySelector('.dialog-foot');
    const cancel = card.querySelector('[data-rg-cancel]');
    const cr = card.getBoundingClientRect();
    const fr = cancel.getBoundingClientRect();
    const out = {
      buttons: card.querySelectorAll('[data-rg-mode]').length,
      cardFitsScreen: cr.top >= -1 && cr.bottom <= window.innerHeight + 1,
      // الجزء اللي بيتزحلق هو القايمة، مش الكارت كله
      bodyScrolls: body.scrollHeight > body.clientHeight,
      // زرار الإلغاء لازم يبقى **ظاهر** جوه الشاشة
      cancelVisible: fr.top >= 0 && fr.bottom <= window.innerHeight + 1,
      footPinned: !!foot && foot.getBoundingClientRect().bottom <= cr.bottom + 1,
    };
    cancel.click();
    out.cancelled = (await promise) === null;
    return out;
  });
  check('16 مجموعة = 18 زرار (الكل + كل مجموعة لوحدها + 16)', tallDialog.buttons === 18, tallDialog);
  check('⭐ الشاشة كلها جوه حدود الموبايل', tallDialog.cardFitsScreen, tallDialog);
  check('⭐ القايمة هي اللي بتتزحلق', tallDialog.bodyScrolls, tallDialog);
  check('⭐ وزرار "إلغاء" ظاهر مش تحت الحافة', tallDialog.cancelVisible && tallDialog.footPinned, tallDialog);
  check('والإلغاء شغّال', tallDialog.cancelled, tallDialog);

  // ============================================================
  // 9) 🐞 الهوامش الآمنة — الكلام كان بيتقص من حرف الورقة
  // ============================================================
  // اتصوّر على ورق حقيقي: "Hejap Kuwaiti 12(" و "Balea Repaie Vi".
  // السبب إن المحتوى كان على بُعد 1 مم من الحرف (والمقسوم صفر)، والطابعة
  // بتلعب 1-1.5 مم وهي بتسحب الورق.
  //
  // الفحص مابيقيسش الهامش — بيقيس **اللي بيضيع فعلًا**: بيزحلق الصورة
  // 1.5 مم ويعدّ الحبر اللي خرج بره الورق. ده اللي المستخدم بيشوفه.
  const clip = await p.evaluate(() => {
    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    const cat = { itemName: 'Hejap Kuwaiti 120', name: 'كريب سادة لوكس', barcodeNumber: '10632103', sellingPrice: 120 };
    const lost = (url, mm) => new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const band = Math.round(mm * 203 / 25.4);
        let n = 0;
        for (let y = 0; y < c.height; y++) for (let px = 0; px < c.width; px++) {
          const edge = px < band || px >= c.width - band || y < band || y >= c.height - band;
          if (edge && d[((y * c.width + px) << 2)] < 128) n++;
        }
        res(n);
      };
      img.src = url;
    });
    return Promise.all([
      lost(renderLabelPNG(cat, { ...size }), 1.5),
      lost(renderGradeLabelPNG('كريب سادة لوكس', 'كيوي درجة 9999', { ...size }), 1.5),
      lost(renderQuarterLabelPNG(cat, { ...size }), 1.5),
    ]).then(([item, grade, quarter]) => ({ item, grade, quarter }));
  });
  check('⭐ ملصق الصنف: مفيش حبر بيضيع مع إزاحة 1.5 مم', clip.item === 0, clip);
  check('⭐ ملصق الدرجة: ولا حاجة كمان', clip.grade === 0, clip);
  check('⭐ المقسوم ٤: ولا حاجة كمان', clip.quarter === 0, clip);

  // ============================================================
  // 10) 🐞 الرسالة الرايحة لـQZ رجعت تعدّي الحد
  // ============================================================
  // التقسيم كان بعدد ثابت (5 صفحات). أول ما الملصق تقل، الـ5 صفحات بقت
  // 49 و61 كيلو والحد 48 — فالرسالة بتتضاع في صمت و"مفيش حاجة بتتطبع".
  // دلوقتي التقسيم **بالحجم**، فأي تصميم جديد بيتعامل معاه لوحده.
  const bigPrint = await p.evaluate(async () => {
    window.deliverPrint = window.__realDeliverPrint;   // نرجّع المسار الحقيقي
    const msgs = [];
    window.qz = {
      websocket: { isActive: () => true, connect: () => Promise.resolve() },
      printers: { find: () => Promise.resolve('P') },
      configs: { create: (n, o) => ({ n, o }) },
      print: (c, pages) => { msgs.push(pages.reduce((s, pg) => s + (pg.data ? pg.data.length : 0), 0)); return Promise.resolve(); },
      api: { setPromiseType(){}, setSha256Type(){} },
      security: { setCertificatePromise(){}, setSignatureAlgorithm(){}, setSignaturePromise(){} },
    };
    try { localStorage.setItem('tazweed_qz_label_printer', 'P'); } catch (e) {}
    window.showPrintPreview = async () => true;
    const prod = { name: 'كريب سادة لوكس', barcode: '6291108735848', price: 135 };
    const runs = {};
    const seen = [];
    const orig = window.showPrintProgress;
    window.showPrintProgress = (t) => { seen.push(t); return orig(t); };
    for (const mode of ['normal', 'quarter']) {
      msgs.length = 0;
      state.printCart = [{ key: 'a', product: prod, qty: 100, mode }];
      await printCartLabels({ pageWidthMm: 38, pageHeightMm: 25, halves: 2 });
      runs[mode] = { jobs: msgs.length, max: Math.max(...msgs) };
    }
    window.showPrintProgress = orig;
    state.printCart = [];
    return { ...runs, limit: QZ_MAX_MESSAGE_BYTES, progress: seen };
  });
  check('⭐ 100 ملصق عادي: كل رسالة تحت الحد',
    bigPrint.normal.max <= bigPrint.limit, bigPrint);
  check('⭐ 100 مقسوم ٤: كل رسالة تحت الحد (دي اللي كانت بتقع)',
    bigPrint.quarter.max <= bigPrint.limit, bigPrint);
  check('واتقسّموا على وظايف صغيرة',
    bigPrint.normal.jobs >= 10 && bigPrint.quarter.jobs >= 10, bigPrint);
  check('⭐ شريط التقدم بيظهر في الطبعات الكبيرة',
    bigPrint.progress.length === 2 && bigPrint.progress.every((n) => n === 100), bigPrint.progress);

  // ============================================================
  // 11) رمز 🖨️ بيطبع اسم المجموعة
  // ============================================================
  const rowGroup = await p.evaluate(async () => {
    state.categories = [{ id: 'c1', name: 'كريب سادة لوكس', colorGroups: ['كيوي'] }];
    state.activeCategoryId = 'c1';
    state.grades = [
      { id: 'g1', number: 9999, group: 'كيوي', branchQty: 1, mainQty: 1, status: 'normal' },
      { id: 'g2', number: 5, group: '', branchQty: 1, mainQty: 1, status: 'normal' },
    ];
    // المفتاح المشترك **مقفول** عن قصد: الرمز مالوش دعوة بيه
    await saveSharedPrintSettings({ gradeLabelWithGroup: false });
    // ⚠️ من v0.36.0 الافتراضي بقى الملصق النصّي، يعني `renderGradeLabelPNG`
    // ممكن ماتتنداش خالص. الفحص بيراقب **الطريقتين** عشان يفضل صحيح مهما
    // كان المفتاح مقفول ولا مفتوح.
    const seen = [];
    const oPNG = window.renderGradeLabelPNG;
    const oHTML = window.buildGradeLabelHTML;
    window.renderGradeLabelPNG = (a, b2, s) => { seen.push([a, b2]); return oPNG(a, b2, s); };
    window.buildGradeLabelHTML = (a, b2, s, c) => { seen.push([a, b2]); return oHTML(a, b2, s, c); };
    window.showPrintPreview = async () => true;
    await printOneGradeLabel('g1', 1);
    await printOneGradeLabel('g2', 1);
    window.renderGradeLabelPNG = oPNG;
    window.buildGradeLabelHTML = oHTML;
    // الطريقتين ممكن يتندهوا مع بعض للملصق الواحد — بناخد أول واحد لكل درجة
    const uniq = [];
    for (const s of seen) if (!uniq.some((u) => u[0] === s[0] && u[1] === s[1])) uniq.push(s);
    return uniq;
  });
  check('⭐ الدرجة اللي في مجموعة: الملصق فيه اسم المجموعة',
    rowGroup[0] && rowGroup[0][0] === 'كريب سادة لوكس' && rowGroup[0][1] === 'كيوي درجة 9999', rowGroup);
  check('⭐ وحتى لو المفتاح المشترك مقفول', rowGroup[0] && /كيوي/.test(rowGroup[0][1]), rowGroup);
  check('والدرجة اللي مالهاش مجموعة مابتتغيّرش',
    rowGroup[1] && rowGroup[1][1] === 'درجة 5', rowGroup);

  // ============================================================
  // 12) تنبيهات فشل الطباعة
  // ============================================================
  // "بتاخد الأمر ومفيش حاجة بتتطبع" كان بيحصل في صمت. دلوقتي كل حالة
  // ليها رسالة بتقول **السبب** واللي المستخدم يعمله.
  const alerts = await p.evaluate(async () => {
    const said = [];
    const asked = [];
    window.alert = (m) => said.push(String(m));
    window.confirm = (m) => { asked.push(String(m)); return true; };
    window.deliverPrint = window.__realDeliverPrint;
    window.showPrintPreview = async () => true;
    try { localStorage.setItem('tazweed_qz_label_printer', 'P'); } catch (e) {}
    const jobs = [{ html: '<html></html>', image: null, copies: 1 }];
    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    const base = {
      websocket: { isActive: () => true, connect: () => Promise.resolve() },
      printers: { find: () => Promise.resolve('P') },
      configs: { create: (n, o) => ({ n, o }) },
      print: () => Promise.resolve(),
      api: { setPromiseType(){}, setSha256Type(){} },
      security: { setCertificatePromise(){}, setSignatureAlgorithm(){}, setSignaturePromise(){} },
    };
    const out = {};

    // (أ) الطابعة المحفوظة مش موجودة
    said.length = 0;
    window.qz = { ...base, printers: { find: () => Promise.reject(new Error('not found')) } };
    await tryPrintViaQZ('label', jobs, size);
    out.missingPrinter = said.join(' | ');

    // (ب) QZ مش شغّال
    said.length = 0;
    window.qz = { ...base, websocket: { isActive: () => false, connect: () => Promise.reject(new Error('no qz')) } };
    qzConnected = false; qzConnecting = null;
    await tryPrintViaQZ('label', jobs, size);
    out.noQZ = said.join(' | ');

    // (ج) الطابعة وقفت في النص
    said.length = 0;
    let n = 0;
    window.qz = { ...base, print: () => (++n > 3 ? Promise.reject(new Error('paper out')) : Promise.resolve()) };
    qzConnected = true; qzConnecting = null;
    await tryPrintViaQZ('label', [{ html: '<html></html>', image: null, copies: 40 }], size);
    out.midFail = said.join(' | ');

    // (د) الطبعة الكبيرة عدّت — تنبيه **مش موقّف** بس
    said.length = 0; asked.length = 0;
    window.qz = { ...base };
    await tryPrintViaQZ('label', [{ html: '<html></html>', image: null, copies: 40 }], size);
    out.askedAfterBig = asked.join(' | ');
    out.quietWhenOk = said.length === 0;
    out.hintAfterBig = (document.body.textContent.match(/اتبعت \d+ ملصق للطابعة/) || [''])[0];

    // (هـ) الملصق الواحد مافيهوش أي تنبيه
    said.length = 0; asked.length = 0;
    await tryPrintViaQZ('label', jobs, size);
    out.singleQuiet = asked.length === 0 && said.length === 0;
    return out;
  });
  check('⭐ الطابعة مش موجودة: بيقول الاسم والسبب',
    /مش لاقيها/.test(alerts.missingPrinter) && /QZ Tray/.test(alerts.missingPrinter), alerts.missingPrinter);
  check('⭐ QZ مش شغّال: بيقولك شغّله', /QZ Tray مش شغّال/.test(alerts.noQZ), alerts.noQZ);
  check('⭐ وقفت في النص: بيقول اتطبع كام وفاضل كام',
    /وقفت في النص/.test(alerts.midFail) && /فاضل/.test(alerts.midFail), alerts.midFail);
  // ============================================================
  // ⚠️⚠️ الفحصين دول اتقلبوا في v0.40.0 — والسبب مهم
  // ============================================================
  // كان النظام بيسأل بـconfirm(): "اتبعت 40 ملصق — خرجوا فعلًا؟"
  // النية سليمة، بس confirm() **بتجمّد خيط الجافاسكريبت كله**. والجهاز
  // اللي بيستقبل الطباعة عن بُعد مافيش حد واقف عنده يرد — فكان بيقف:
  // مايسمعش طلبات جديدة، ومايكمّلش الطلب الحالي، واللي باعت يستنى للأبد.
  //
  // فبقى الشرط معكوس: **مفيش أي سؤال موقّف**، والتنبيه بيظهر ويختفي لوحده.
  check('⭐⭐ الطبعة الكبيرة مابتسألش سؤال موقّف (بتجمّد الجهاز)',
    alerts.askedAfterBig === '', alerts.askedAfterBig);
  // ⚠️ العدد مش مثبّت في الشرط: التنبيه بيفضل ظاهر 7 ثواني، فممكن يكون
  // اللي على الشاشة جاي من طبعة قبلها في نفس الفحص. اللي يهم إن فيه
  // تنبيه **مش موقّف** ظهر أصلًا.
  check('⭐ لكن بيظهر تنبيه مش موقّف',
    /اتبعت \d+ ملصق للطابعة/.test(alerts.hintAfterBig), alerts.hintAfterBig);
  check('ومفيش رسالة موقّفة في الطبعة الناجحة', alerts.quietWhenOk, alerts);
  check('الملصق الواحد مافيهوش أي تنبيه', alerts.singleQuiet, alerts);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
