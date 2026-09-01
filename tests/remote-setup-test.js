// التحكم في إعدادات الطابعة من جهاز تاني
// ============================================================
// ⭐ أهم النقط:
//   1) التابات **مابتظهرش** لغير صاحب صلاحية إعدادات الطابعة — حساب
//      الطباعة لازم يشوف الشاشة زي ما هي بالحرف
//   2) الأمر بيتحفظ للجهاز المقفول وينفّذ لما يفتح
//   3) ⭐⭐ الأمر مابيتنفّذش **مرتين** (النبضة بتتكرر كل 45 ثانية)
//   4) ⭐⭐ والأمر البايت (أقدم من أسبوع) مابينفّذش خالص
//   5) الطابعة مابتتغيّرش لاسم **مش موجود** على الجهاز
//   6) زراير التجربة مقفولة لو الجهاز مقفول
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof printDevicesHTML === 'function' && typeof applyPendingSetupOrder === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const now = Date.now();
    const seen = (ms) => ({ toMillis: () => ms });
    state.user = { uid: 'U1' };
    state.printStations = [
      { id: 'd1', deviceName: 'كمبيوتر الكاشير', labelPrinter: 'XP-365B', restockPrinter: 'HP',
        printers: ['XP-365B', 'HP', 'Microsoft PDF'], appVersion: '0.66.0',
        printSetup: { batch: 30, lead: 5, pace: 420 }, lastSeen: seen(now - 10000) },
      { id: 'd2', deviceName: 'كمبيوتر المخزن', labelPrinter: 'TSC', printers: [],
        appVersion: '0.60.0', printSetup: { batch: 20 }, lastSeen: seen(now - 5 * 3600000) },
    ];
    state.printOrders = {};

    // ⭐ (1) من غير صلاحية = مفيش تابات خالص
    state.profile = { name: 'م', role: 'print_operator' };
    const plain = printScreenHTML();
    out.noTabsForOperator = plain.indexOf('data-print-tab') === -1;
    out.operatorSeesCart = plain.indexOf('سلة الطباعة') !== -1;
    out.sameAsWork = plain === printWorkHTML();

    // (2) صاحب الصلاحية بيشوف التابات
    state.profile = { name: 'عبدالله', role: 'owner' };
    state.printTab = 'work';
    const owner = printScreenHTML();
    out.tabsForOwner = owner.indexOf('data-print-tab') !== -1;
    out.startsOnWork = owner.indexOf('سلة الطباعة') !== -1;

    // (3) تاب الأجهزة
    state.printTab = 'devices';
    document.body.innerHTML = '<div id=root>' + printScreenHTML() + '</div>';
    const txt = () => document.body.textContent;
    out.showsBoth = document.querySelectorAll('.dev-card').length === 2;
    out.showsOnlineCount = txt().indexOf('1 شغّال') !== -1;
    out.showsPrinterName = txt().indexOf('XP-365B') !== -1;
    out.showsNumbers = txt().indexOf('30') !== -1 && txt().indexOf('420') !== -1;
    out.offlineLabelled = txt().indexOf('مقفول') !== -1 && txt().indexOf('من 5 ساعة') !== -1;

    // ⭐ (4) زراير التجربة مقفولة على الجهاز المقفول، مفتوحة على الشغّال
    const frameOn = document.querySelector('[data-dev-frame="d1"]');
    const frameOff = document.querySelector('[data-dev-frame="d2"]');
    out.testEnabledOnline = !!frameOn && !frameOn.disabled;
    out.testDisabledOffline = !!frameOff && frameOff.disabled;
    // بس "عدّل" مفتوح على الاتنين — الأمر بيستنى
    out.editEnabledOffline = !document.querySelector('[data-dev-edit="d2"]').disabled;

    // (5) أمر مستني بيبان
    state.printOrders = { d2: { setup: { batch: 12, pace: 500 }, byName: 'عبدالله', expiresAtMs: now + 100000 } };
    document.body.innerHTML = '<div id=root>' + printScreenHTML() + '</div>';
    out.waitingShown = document.body.textContent.indexOf('مستني الجهاز يفتح') !== -1;
    out.cancelBtn = !!document.querySelector('[data-dev-cancel="d2"]');

    // (6) أمر اتنفّذ بيبان
    state.printOrders = { d2: { setup: { batch: 12 }, appliedAt: { toMillis: () => now - 1000 }, appliedFields: ['حجم الدفعة'] } };
    document.body.innerHTML = '<div id=root>' + printScreenHTML() + '</div>';
    out.appliedShown = document.body.textContent.indexOf('اتطبّق') !== -1;

    // ---- تنضيف الأمر: القايمة الحصرية ----
    out.cleanKeeps = Object.keys(cleanSetupOrder({ batch: 5, lead: 0, pace: 300 })).sort().join(',');
    out.cleanDropsUnknown = cleanSetupOrder({ batch: 5, hackField: 'x', align: { x: 99 } }).hackField === undefined
      && cleanSetupOrder({ batch: 5, align: { x: 99 } }).align === undefined;
    out.cleanDropsEmpty = Object.keys(cleanSetupOrder({ batch: '', lead: null, pace: undefined })).length === 0;
    // ⚠️ صفر قيمة **صحيحة** (تقديم صفر = استنى الدفعة كلها) — مش فاضي
    out.cleanKeepsZero = cleanSetupOrder({ lead: 0 }).lead === 0;

    // ============================================================
    // ⭐⭐ تنفيذ الأمر على الجهاز اللي عليه الطابعة
    // ============================================================
    // بنركّب db مزيّف عشان نجرّب المنطق نفسه: يتنفّذ مرة واحدة، ومايلمسش
    // أمر بايت، ومايحطش اسم طابعة مش موجودة.
    const calls = { pace: null, batch: null, lead: null, label: null, restock: null, name: null, wrote: null };
    setPrintPaceMs = (v) => (calls.pace = v);
    setPrintBatchSize = (v) => (calls.batch = v);
    setPrintLeadLabels = (v) => (calls.lead = v);
    saveSelectedPrinter = (t, n) => (t === 'label' ? (calls.label = n) : (calls.restock = n));
    saveDeviceName = (n) => (calls.name = n);
    getDeviceId = () => 'd1';
    // الطابعات الموجودة **فعلًا** على الجهاز ده
    getAvailableQZPrinters = async () => ['XP-365B', 'HP'];

    let stored = null;
    window.db = {
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: !!stored, data: () => stored }),
          set: async (patch) => { calls.wrote = patch; stored = { ...stored, ...patch }; },
        }),
      }),
    };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => ({ __ts: true }) } } };

    const reset = () => {
      Object.keys(calls).forEach((k) => (calls[k] = null));
    };

    // (أ) أمر عادي بينفّذ
    stored = { setup: { pace: 300, batch: 12, lead: 2, deviceName: 'الكاشير الجديد' }, expiresAtMs: now + 100000 };
    reset();
    out.applyA = await applyPendingSetupOrder();
    out.aPace = calls.pace; out.aBatch = calls.batch; out.aLead = calls.lead; out.aName = calls.name;
    out.aMarked = !!(calls.wrote && calls.wrote.appliedAt);

    // ⭐⭐ (ب) نفس الأمر تاني — النبضة الجاية. **مايتنفّذش**
    reset();
    out.applyB = await applyPendingSetupOrder();
    out.bTouchedNothing = calls.pace === null && calls.batch === null && calls.wrote === null;

    // ⭐⭐ (ج) أمر بايت (أقدم من أسبوع)
    stored = { setup: { batch: 99 }, expiresAtMs: now - 1000 };
    reset();
    out.applyC = await applyPendingSetupOrder();
    out.cTouchedNothing = calls.batch === null;

    // ⭐ (د) اسم طابعة **مش موجود** على الجهاز
    stored = { setup: { labelPrinter: 'طابعة وهمية', restockPrinter: 'HP' }, expiresAtMs: now + 100000 };
    reset();
    out.applyD = await applyPendingSetupOrder();
    out.dLabelRefused = calls.label === null;
    out.dRestockOk = calls.restock === 'HP';

    // (هـ) مفيش أمر خالص
    stored = null;
    reset();
    out.applyE = await applyPendingSetupOrder();

    return out;
  });

  check('⭐ حساب الطباعة: مفيش تابات', r.noTabsForOperator);
  check('وبيشوف السلة عادي', r.operatorSeesCart);
  check('⭐⭐ والشاشة مطابقة للقديمة بالحرف', r.sameAsWork);
  check('صاحب الصلاحية بيشوف التابات', r.tabsForOwner);
  check('وبيفتح على تاب الطباعة', r.startsOnWork);
  check('تاب الأجهزة: الجهازين ظاهرين', r.showsBoth);
  check('وبيقول كام شغّال', r.showsOnlineCount);
  check('واسم الطابعة', r.showsPrinterName);
  check('وأرقام الدفعة والإيقاع', r.showsNumbers);
  check('والمقفول مكتوب إنه مقفول ومن امتى', r.offlineLabelled);
  check('⭐ زرار التجربة مفتوح على الشغّال', r.testEnabledOnline);
  check('⭐⭐ ومقفول على المقفول (الورقة مش بتتأجّل)', r.testDisabledOffline);
  check('بس "عدّل" مفتوح على المقفول (الأمر بيستنى)', r.editEnabledOffline);
  check('الأمر المستني بيبان', r.waitingShown);
  check('ومعاه زرار إلغاء', r.cancelBtn);
  check('والأمر اللي اتنفّذ بيبان', r.appliedShown);
  check('الأمر بيقبل الأرقام الصح', r.cleanKeeps === 'batch,lead,pace', r.cleanKeeps);
  check('⭐⭐ وبيرمي أي حقل بره القايمة الحصرية', r.cleanDropsUnknown);
  check('وبيرمي الفاضي', r.cleanDropsEmpty);
  check('⭐ بس صفر قيمة صحيحة مش فاضي', r.cleanKeepsZero);
  check('الأمر بينفّذ ويقول اتغيّر إيه', (r.applyA || []).length === 4, r.applyA);
  check('والأرقام وصلت صح', r.aPace === 300 && r.aBatch === 12 && r.aLead === 2, [r.aPace, r.aBatch, r.aLead]);
  check('واسم الجهاز', r.aName === 'الكاشير الجديد', r.aName);
  check('واتعلّم إنه اتنفّذ', r.aMarked);
  check('⭐⭐ النبضة الجاية: مابيتنفّذش تاني', (r.applyB || []).length === 0 && r.bTouchedNothing, r.applyB);
  check('⭐⭐ والأمر البايت مابيتنفّذش خالص', (r.applyC || []).length === 0 && r.cTouchedNothing, r.applyC);
  check('⭐ وطابعة مش موجودة على الجهاز بترفض', r.dLabelRefused);
  check('والموجودة بتتقبل', r.dRestockOk, r.applyD);
  check('ومفيش أمر = مفيش حاجة', (r.applyE || []).length === 0);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
