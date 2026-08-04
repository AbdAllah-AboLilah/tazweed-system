const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,250)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof applyPrintTweaks === 'function');

  await p.evaluate(() => {
    const noop = () => () => {};
    const mk = () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), collection: mk, onSnapshot: noop, get: () => Promise.resolve({ exists: false }) }), get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
    window.db = { collection: mk, collectionGroup: mk };
    state.user = { uid: 'me' };
    state.view = 'dashboard';
    state.screen = 'sheets';
    state.categories = [{ id: 'c1', name: 'كريب', order: 1, itemName: 'كريب', barcodeNumber: '28144', sellingPrice: 85 }];
    state.activeCategoryId = 'c1';
    state.grades = [{ id: 'g1', number: 1, branchQty: 1, mainQty: 0, status: 'normal' }];
    localStorage.clear();
  });

  // ---------- الصلاحية ----------
  const perms = await p.evaluate(() => {
    const has = (role) => {
      state.profile = { name: 'x', role };
      state.screen = 'sheets'; render();
      const bar = !!document.getElementById('printer-settings-btn');
      state.screen = 'print'; render();
      const pr = !!document.getElementById('print-settings-btn');
      return { bar, pr };
    };
    return {
      owner: has('owner'),
      branchMgr: has('branch_manager'),
      keeper: has('warehouse_keeper'),
      printer: has('print_operator'),
      custom: (() => { state.profile = { name: 'x', role: 'branch_manager', perms: { printerSetup: true } }; state.screen = 'sheets'; render(); return !!document.getElementById('printer-settings-btn'); })(),
    };
  });
  check('منشئ النظام بيشوف إعدادات الطابعة', perms.owner.bar && perms.owner.pr, perms);
  check('مدير الفرع مايشوفهاش افتراضيًا', !perms.branchMgr.bar && !perms.branchMgr.pr, perms);
  check('أمين المخزن مايشوفهاش', !perms.keeper.bar && !perms.keeper.pr, perms);
  check('موظف الطباعة مايشوفهاش', !perms.printer.pr, perms);
  check('تقدر تفتحها لشخص بعينه', perms.custom, perms);

  // ---------- المفاتيح ----------
  const tweaks = await p.evaluate(() => {
    const base = () => applyPrintTweaks({ size: { width: 38, height: 25 }, units: 'mm' });
    const off = base();
    PRINT_TWEAKS.forEach((t) => setPrintTweak(t.key, true));
    const allOn = base();
    PRINT_TWEAKS.forEach((t) => setPrintTweak(t.key, false));
    setPrintTweak('blackwhite', true);
    const oneOn = base();
    setPrintTweak('blackwhite', false);
    return { off, allOn, oneOn, count: PRINT_TWEAKS.length, keys: PRINT_TWEAKS.map((t) => t.key) };
  });
  check('كله مقفول = الإعداد زي ما هو بالظبط',
    JSON.stringify(tweaks.off) === JSON.stringify({ size: { width: 38, height: 25 }, units: 'mm' }), tweaks.off);
  check('6 مفاتيح', tweaks.count === 6, tweaks.keys);
  check('كله مفتوح = الأربعة اتطبقوا',
    tweaks.allOn.scaleContent === false && tweaks.allOn.colorType === 'blackwhite'
    && tweaks.allOn.interpolation === 'nearest-neighbor' && tweaks.allOn.rasterize === true, tweaks.allOn);
  check('مفتاح واحد = هو بس اللي اتطبق',
    tweaks.oneOn.colorType === 'blackwhite' && tweaks.oneOn.scaleContent === undefined
    && tweaks.oneOn.rasterize === undefined, tweaks.oneOn);
  check('المقاس الأساسي مابيتلمسش أبدًا',
    tweaks.allOn.size.width === 38 && tweaks.allOn.size.height === 25 && tweaks.allOn.units === 'mm', tweaks.allOn);

  // ---------- أوامر المعايرة ----------
  const cal = await p.evaluate(async () => {
    const sent = [];
    window.qz = {
      configs: { create: (n, o) => ({ printer: n, opts: o }) },
      print: (cfg, data) => { sent.push({ printer: cfg.printer, data }); return Promise.resolve(); },
      printers: { details: () => Promise.resolve([{ name: 'Xprinter XP-233B', driver: 'x', density: [203] }]) },
      websocket: { connect: () => Promise.resolve() },
      security: { setCertificatePromise() {}, setSignatureAlgorithm() {}, setSignaturePromise() {} },
    };
    window.isQZAvailable = () => true;
    window.ensureQZConnected = () => Promise.resolve(true);
    await calibratePrinter('Xprinter XP-233B', 38, 25, 2);
    return sent;
  });
  check('أمر واحد اتبعت للطابعة الصح', cal.length === 1 && cal[0].printer === 'Xprinter XP-233B', cal);
  const d = cal[0] && cal[0].data && cal[0].data[0];
  check('نوع الأمر خام (بيروح للطابعة مباشرة)', d && d.type === 'raw' && d.format === 'command', d);
  check('فيه أمر المقاس', /SIZE 38 mm,25 mm/.test(d.data), d.data);
  check('فيه أمر الفراغ', /GAP 2 mm,0 mm/.test(d.data), d.data);
  check('فيه أمر المعايرة', /GAPDETECT/.test(d.data), d.data);
  check('الأوامر مفصولة صح', d.data.split('\r\n').length >= 6, JSON.stringify(d.data));

  // ---------- الشاشة نفسها ----------
  const ui = await p.evaluate(async () => {
    state.profile = { name: 'x', role: 'owner' };
    window.getAvailableQZPrinters = () => Promise.resolve(['Xprinter XP-233B', 'HP LaserJet']);
    openPrinterSettings();
    await new Promise((r) => setTimeout(r, 300));
    const boxes = [...document.querySelectorAll('[data-tweak]')].map((e) => e.getAttribute('data-tweak'));
    const out = {
      tweakBoxes: boxes,
      allUnchecked: [...document.querySelectorAll('[data-tweak]')].every((e) => !e.checked),
      hasCalBtn: !!document.getElementById('cal-run'),
      hasDetails: !!document.getElementById('qz-details-btn'),
      defaults: {
        w: document.getElementById('cal-w').value,
        h: document.getElementById('cal-h').value,
        gap: document.getElementById('cal-gap').value,
      },
    };
    // المعايرة من غير طابعة مختارة
    document.getElementById('qz-label-printer-select').value = '';
    document.getElementById('cal-run').click();
    await new Promise((r) => setTimeout(r, 100));
    out.noPrinterMsg = document.getElementById('cal-status').textContent;
    document.getElementById('qz-settings-close').click();
    return out;
  });
  check('الست مفاتيح ظاهرين في الشاشة', ui.tweakBoxes.length === 6, ui);
  check('كلهم مقفولين افتراضيًا', ui.allUnchecked, ui);
  check('زرار المعايرة وبيانات الطابعات موجودين', ui.hasCalBtn && ui.hasDetails, ui);
  check('المقاسات الافتراضية 38×25 وفراغ 2', ui.defaults.w === '38' && ui.defaults.h === '25' && ui.defaults.gap === '2', ui.defaults);
  check('المعايرة بترفض من غير اختيار طابعة', /اختار طابعة/.test(ui.noPrinterMsg), ui.noPrinterMsg);

  // ---------- ضبط مكان الطباعة (الإطار) ----------
  const align = await p.evaluate(() => {
    localStorage.removeItem('tazweed_print_align');
    const zero = { css: printAlignCSS(), val: getPrintAlign() };

    savePrintAlign({ x: 0.6, y: -0.4, shrink: 5 });
    const set = { css: printAlignCSS(), val: getPrintAlign() };

    // الحدود
    savePrintAlign({ x: 999, y: -999, shrink: 99 });
    const clamped = getPrintAlign();

    // قيم بايظة مايوقّعوش الشاشة
    savePrintAlign({ x: 'abc', y: null, shrink: undefined });
    const junk = getPrintAlign();

    localStorage.setItem('tazweed_print_align', '{{{ مش JSON');
    const broken = getPrintAlign();

    localStorage.removeItem('tazweed_print_align');
    return { zero, set, clamped, junk, broken };
  });
  check('الأصفار = مفيش أي CSS بيتضاف', align.zero.css === '', align.zero);
  check('الأصفار محفوظة كأصفار', align.zero.val.x === 0 && align.zero.val.y === 0 && align.zero.val.shrink === 0, align.zero);
  check('الزحلقة بتطلع transform صح', /translate\(0\.6mm, -0\.4mm\)/.test(align.set.css), align.set.css);
  check('التصغير بيطلع scale صح', /scale\(0\.950\)/.test(align.set.css), align.set.css);
  check('فيه transform-origin عشان التصغير من النص', /transform-origin: center center/.test(align.set.css), align.set.css);
  check('حد أقصى 6 مم و20%', align.clamped.x === 6 && align.clamped.y === -6 && align.clamped.shrink === 20, align.clamped);
  check('القيم البايظة بترجع أصفار', align.junk.x === 0 && align.junk.y === 0 && align.junk.shrink === 0, align.junk);
  check('التخزين المكسور مابيوقّعش حاجة', align.broken.x === 0, align.broken);

  // الضبط بيوصل فعلًا للملصق المطبوع
  const applied = await p.evaluate(async () => {
    const url = await generateQRDataURL('28144', 200);
    const opts = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    const cat = { itemName: 'كريب', barcodeNumber: '28144', sellingPrice: 85 };

    localStorage.removeItem('tazweed_print_align');
    const before = buildLabelHTML(cat, opts, url, 1);
    const gradeBefore = buildGradeLabelHTML('كريب', 'درجة 1', opts, 1);

    savePrintAlign({ x: 1, y: 0.5, shrink: 0 });
    const after = buildLabelHTML(cat, opts, url, 1);
    const gradeAfter = buildGradeLabelHTML('كريب', 'درجة 1', opts, 1);
    const frame = buildFrameHTML(38, 25);

    localStorage.removeItem('tazweed_print_align');
    const back = buildLabelHTML(cat, opts, url, 1);

    return {
      unchangedByDefault: before === back,
      noTransformByDefault: !/transform:/.test(before) && !/transform:/.test(gradeBefore),
      labelMoved: /transform: translate\(1mm, 0\.5mm\)/.test(after),
      gradeMoved: /transform: translate\(1mm, 0\.5mm\)/.test(gradeAfter),
      frameMoved: /transform: translate\(1mm, 0\.5mm\)/.test(frame),
      frameSize: /@page \{ size: 38mm 25mm/.test(frame),
      frameShowsNumbers: /X 1 \/ Y 0\.5 \/ -0%/.test(frame),
      frameNoScript: !/<script/i.test(frame),
    };
  });
  check('من غير ضبط، الملصق بايت ببايت زي ما كان', applied.unchangedByDefault, applied);
  check('من غير ضبط، مفيش transform في أي ملصق', applied.noTransformByDefault, applied);
  check('الضبط بيتطبّق على ملصق الصنف', applied.labelMoved, applied);
  check('الضبط بيتطبّق على ملصق الدرجة كمان', applied.gradeMoved, applied);
  check('الإطار بياخد نفس الضبط', applied.frameMoved, applied);
  check('الإطار بمقاس الملصق بالظبط', applied.frameSize, applied);
  check('الإطار مكتوب عليه الأرقام الحالية', applied.frameShowsNumbers, applied);
  check('الإطار مالوش سكريبت (مايفتحش معاينة المتصفح)', applied.frameNoScript, applied);

  // الإطار بيتبعت للطابعة الصح كصفحة واحدة
  const frameJob = await p.evaluate(async () => {
    const sent = [];
    window.qz.print = (cfg, data) => { sent.push({ printer: cfg.printer, opts: cfg.opts, data }); return Promise.resolve(); };
    localStorage.setItem('tazweed_qz_label_printer', 'Xprinter XP-233B');
    const ok = await printTestFrame(38, 25);
    return { ok, sent };
  });
  check('الإطار راح لطابعة الملصق', frameJob.ok && frameJob.sent.length === 1
    && frameJob.sent[0].printer === 'Xprinter XP-233B', frameJob);
  check('ورقة واحدة بس', frameJob.sent[0] && frameJob.sent[0].data.length === 1, frameJob.sent[0] && frameJob.sent[0].data.length);
  check('الإطار HTML مش نص خام', frameJob.sent[0] && frameJob.sent[0].data[0].type === 'pixel'
    && frameJob.sent[0].data[0].format === 'html', frameJob.sent[0] && frameJob.sent[0].data[0]);

  // لوحة الاتجاهات في الشاشة
  const pad = await p.evaluate(async () => {
    localStorage.removeItem('tazweed_print_align');
    state.profile = { name: 'x', role: 'owner' };
    window.getAvailableQZPrinters = () => Promise.resolve(['Xprinter XP-233B']);
    openPrinterSettings();
    await new Promise((r) => setTimeout(r, 300));
    const $ = (s) => document.querySelector(s);
    const nudge = (d) => $(`#align-pad [data-nudge="${d}"]`).click();
    const read = () => ({ x: +$('#align-x').value, y: +$('#align-y').value, s: +$('#align-shrink').value });

    const start = read();
    nudge('right'); nudge('right');
    const right2 = read();
    nudge('down');
    const down1 = read();
    nudge('up'); nudge('up');
    const up = read();
    const stored = getPrintAlign();
    nudge('zero');
    const zeroed = read();

    // الكتابة اليدوية بتتقيّد بالحد الأقصى
    $('#align-x').value = '50';
    $('#align-save').click();
    const clampedUI = read();

    const ltr = getComputedStyle($('#align-pad')).direction;
    const hasFrameBtn = !!$('#align-frame');
    $('#qz-settings-close').click();
    localStorage.removeItem('tazweed_print_align');
    return { start, right2, down1, up, stored, zeroed, clampedUI, ltr, hasFrameBtn };
  });
  check('الشاشة بتفتح على أصفار', pad.start.x === 0 && pad.start.y === 0 && pad.start.s === 0, pad.start);
  check('▶ بتزحلق يمين خطوتين = 0.4', Math.abs(pad.right2.x - 0.4) < 0.001, pad.right2);
  check('▼ بتزحلق تحت', Math.abs(pad.down1.y - 0.2) < 0.001, pad.down1);
  check('▲ بترجّع فوق', Math.abs(pad.up.y + 0.2) < 0.001, pad.up);
  check('كل ضغطة بتتحفظ على طول', Math.abs(pad.stored.x - 0.4) < 0.001, pad.stored);
  check('"صفّر" بترجّع كله صفر', pad.zeroed.x === 0 && pad.zeroed.y === 0 && pad.zeroed.s === 0, pad.zeroed);
  check('الكتابة اليدوية بتتقيّد بـ6 مم', pad.clampedUI.x === 6, pad.clampedUI);
  check('لوحة الاتجاهات LTR (السهم في مكانه الصح)', pad.ltr === 'ltr', pad.ltr);
  check('زرار طباعة الإطار موجود', pad.hasFrameBtn, pad);

  // ---------- النسخ من جهاز تاني ----------
  const copy = await p.evaluate(async () => {
    localStorage.clear();
    state.profile = { name: 'x', role: 'owner' };
    state.user = { uid: 'me' };
    window.isQZAvailable = () => true;
    window.getAvailableQZPrinters = () => Promise.resolve(['Xprinter XP-233B', 'HP LaserJet']);

    const myId = getDeviceId();
    state.printStations = [
      { id: myId, deviceName: 'أنا' },
      {
        id: 'pc-cashier', deviceName: 'كمبيوتر الكاشير',
        labelPrinter: 'Xprinter XP-233B', restockPrinter: 'HP LaserJet',
        printSetup: { align: { x: 0.8, y: -0.6, shrink: 4 }, tweaks: { blackwhite: true, sharp: true, noScale: false, rasterize: false } },
      },
      { id: 'pc-old', deviceName: 'جهاز قديم' },  // من غير printSetup
      {
        id: 'pc-other', deviceName: 'مخزن رئيسي',
        labelPrinter: 'Zebra ZD220',   // مش موجودة على الجهاز ده
        printSetup: { align: { x: 0, y: 0, shrink: 0 }, tweaks: {} },
      },
    ];

    // على الجهاز ده مفتاح مفتوح غلط — النسخ لازم يقفله
    setPrintTweak('rasterize', true);

    openPrinterSettings();
    await new Promise((r) => setTimeout(r, 300));
    const $ = (s) => document.querySelector(s);

    const opts = [...$('#copy-from').options].map((o) => ({ v: o.value, t: o.textContent }));
    const visible = $('#copy-box').style.display;

    $('#copy-from').value = 'pc-cashier';
    $('#copy-run').click();
    const afterGood = {
      align: getPrintAlign(),
      tweaks: getPrintTweaksMap(),
      labelSel: $('#qz-label-printer-select').value,
      restockSel: $('#qz-restock-printer-select').value,
      xBox: $('#align-x').value,
      shrinkBox: $('#align-shrink').value,
      boxesChecked: [...document.querySelectorAll('[data-tweak]')].filter((e) => e.checked).map((e) => e.getAttribute('data-tweak')).sort(),
      status: $('#copy-status').textContent,
      deviceName: getDeviceName(),
      deviceId: getDeviceId(),
    };

    // طابعة مش موجودة على الجهاز ده
    $('#copy-from').value = 'pc-other';
    $('#copy-run').click();
    const afterMissing = { status: $('#copy-status').textContent, labelSel: $('#qz-label-printer-select').value };

    $('#qz-settings-close').click();

    // مفيش أجهزة تانية عندها ضبط → القسم مايظهرش
    state.printStations = [{ id: myId, deviceName: 'أنا' }, { id: 'pc-old', deviceName: 'قديم' }];
    openPrinterSettings();
    await new Promise((r) => setTimeout(r, 300));
    const hiddenWhenAlone = document.querySelector('#copy-box').style.display;
    document.querySelector('#qz-settings-close').click();

    localStorage.clear();
    state.printStations = [];
    return { opts, visible, afterGood, afterMissing, hiddenWhenAlone, myId };
  });
  check('القسم بيظهر لما فيه جهاز مظبوط', copy.visible === 'block', copy.visible);
  check('الجهاز بتاعي مش في القايمة', !copy.opts.some((o) => o.v === copy.myId), copy.opts);
  check('الجهاز اللي مالوش ضبط مش في القايمة', !copy.opts.some((o) => o.v === 'pc-old'), copy.opts);
  check('الأجهزة المظبوطة بس هي اللي في القايمة', copy.opts.length === 2, copy.opts);
  check('القايمة بتوري اسم الجهاز مش معرّفه', copy.opts.some((o) => o.t === 'كمبيوتر الكاشير'), copy.opts);
  check('الضبط اتنسخ بالأرقام', copy.afterGood.align.x === 0.8 && copy.afterGood.align.y === -0.6
    && copy.afterGood.align.shrink === 4, copy.afterGood.align);
  check('الخانات في الشاشة اتحدّثت', copy.afterGood.xBox === '0.8' && copy.afterGood.shrinkBox === '4', copy.afterGood);
  check('المفاتيح اتنسخت', copy.afterGood.tweaks.blackwhite === true && copy.afterGood.tweaks.sharp === true, copy.afterGood.tweaks);
  check('⭐ المفتاح المفتوح غلط اتقفل (النسخ = تطابق مش إضافة)',
    copy.afterGood.tweaks.rasterize === false, copy.afterGood.tweaks);
  check('مربّعات الشاشة اتحدّثت هي كمان',
    JSON.stringify(copy.afterGood.boxesChecked) === JSON.stringify(['blackwhite', 'sharp']), copy.afterGood.boxesChecked);
  check('الطابعة اتنسخت لأن اسمها موجود', copy.afterGood.labelSel === 'Xprinter XP-233B'
    && copy.afterGood.restockSel === 'HP LaserJet', copy.afterGood);
  check('⭐ اسم الجهاز مااتنسخش', copy.afterGood.deviceName === '', copy.afterGood.deviceName);
  check('⭐ معرّف الجهاز مااتغيّرش', copy.afterGood.deviceId === copy.myId, copy.afterGood.deviceId);
  check('طابعة مش موجودة → تحذير واضح', /Zebra ZD220/.test(copy.afterMissing.status)
    && /مش موجودة/.test(copy.afterMissing.status), copy.afterMissing.status);
  check('وماتحفظش طابعة وهمية', copy.afterMissing.labelSel === 'Xprinter XP-233B', copy.afterMissing);
  check('الرسالة بتقول اضغط حفظ واطبع الإطار', /حفظ/.test(copy.afterGood.status)
    && /الإطار/.test(copy.afterGood.status), copy.afterGood.status);
  check('القسم مايظهرش لو مفيش جهاز مظبوط', copy.hiddenWhenAlone === 'none', copy.hiddenWhenAlone);

  // الضبط بيتنشر مع نبضة الجهاز عشان الأجهزة التانية تلاقيه
  const published = await p.evaluate(async () => {
    savePrintAlign({ x: 1.2, y: 0, shrink: 2 });
    setPrintTweak('sharp', true);
    localStorage.setItem('tazweed_qz_label_printer', 'Xprinter XP-233B');
    let written = null;
    window.db = {
      collection: () => ({ doc: () => ({ set: (d) => { written = d; return Promise.resolve(); } }) }),
    };
    window.fireWrite = (pr) => pr;
    window.ensureQZConnected = () => Promise.resolve(true);
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    state.user = { uid: 'me' }; state.profile = { name: 'أنا', role: 'owner' };
    saveDeviceName('كمبيوتر الكاشير');
    await registerPrintStation();
    localStorage.clear();
    return written;
  });
  check('الضبط بيتنشر مع نبضة الجهاز', published && published.printSetup
    && published.printSetup.align.x === 1.2, published && published.printSetup);
  check('المفاتيح كلها بتتنشر (مش المفتوحة بس)', published && published.printSetup
    && published.printSetup.tweaks.sharp === true && published.printSetup.tweaks.rasterize === false,
    published && published.printSetup && published.printSetup.tweaks);
  check('اسم الجهاز بيتنشر بره الضبط (عشان ميتنسخش)',
    published && published.deviceName === 'كمبيوتر الكاشير' && !('deviceName' in published.printSetup), published);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach((x) => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
