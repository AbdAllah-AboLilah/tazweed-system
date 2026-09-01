// التحكم في إعدادات الطابعة عن بُعد — عام + خاص بالجهاز
// ============================================================
// ⭐ أهم النقط:
//   1) التاب **مابيظهرش** لغير صاحب مفتاح "التحكم عن بُعد" — وده مفتاح
//      **منفصل** عن "إعدادات الطابعة"
//   2) ⭐⭐ الجهاز اللي مالوش استثناء بيقرا العام **بالحرف** — يعني
//      مفيش أي فرق عن قبل التعديل
//   3) ⭐⭐ الاستثناء الجزئي **بيتدمج** مش بيستبدل (أخطر نقطة: تظبط x
//      لوحدها فتتبهدل y وshrink في صمت)
//   4) "على الكل" بيمسح الاستثناءات ويحذّر بأسمائها الأول
//   5) الخانة الفاضية مابتتلمسش، والصفر قيمة صحيحة
const { chromium } = require('playwright');
const pass = [], fail = [];
let PRINT_ALIGN_LIMIT = 0;
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof printDevicesHTML === 'function' && typeof readPrintObject === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const now = Date.now();
    const seen = (ms) => ({ toMillis: () => ms });
    state.user = { uid: 'U1' };
    state.printStations = [
      { id: 'd1', deviceName: 'كمبيوتر الكاشير', labelPrinter: 'XP-365B', restockPrinter: 'HP',
        printers: ['XP-365B', 'HP', 'Microsoft PDF'], appVersion: '0.68.0',
        printSetup: { batch: 30, lead: 5, pace: 420 }, lastSeen: seen(now - 10000) },
      { id: 'd2', deviceName: 'كمبيوتر المخزن', labelPrinter: 'TSC', printers: [],
        appVersion: '0.60.0', printSetup: { batch: 20 }, lastSeen: seen(now - 5 * 3600000) },
    ];
    state.deviceSettings = {};

    // ============================================================
    // (١) المفتاح المنفصل
    // ============================================================
    // حساب معاه إعدادات الطابعة بس — **مايشوفش** التاب
    state.profile = { name: 'مدير الفرع', role: 'branch_manager', perms: { printerSetup: true } };
    out.setupAloneNoTab = printScreenHTML().indexOf('data-print-tab') === -1;

    state.profile = { name: 'م', role: 'print_operator' };
    const plain = printScreenHTML();
    out.operatorNoTab = plain.indexOf('data-print-tab') === -1;
    out.operatorSameScreen = plain === printWorkHTML();

    state.profile = { name: 'عبدالله', role: 'owner' };
    out.ownerHasTab = printScreenHTML().indexOf('data-print-tab') !== -1;

    // ============================================================
    // (٢) ترتيب القراءة: استثناء الجهاز → العام
    // ============================================================
    sharedPrintSettings = { align: { x: 1, y: 2, shrink: 3 }, tweaks: { noScale: true, blackwhite: false }, batch: 20, lead: 0, pace: 400 };
    deviceOverrides = null;
    try { localStorage.removeItem('tazweed_device_overrides'); } catch (e) {}

    // ⭐⭐ مالوش استثناء = العام بالحرف
    out.noOwnAlign = JSON.stringify(getPrintAlign());
    out.noOwnBatch = getPrintBatchSize();
    out.noOwnPace = getPrintPaceMs();
    out.noOwnTweakOn = getPrintTweak('noScale');
    out.noOwnTweakOff = getPrintTweak('blackwhite');

    // استثناء كامل بيكسب
    deviceOverrides = { batch: 7, pace: 900 };
    out.ownBatch = getPrintBatchSize();
    out.ownPace = getPrintPaceMs();
    out.ownLeadStillShared = getPrintLeadLabels();  // مالهوش استثناء → العام

    // ⭐⭐ (٣) الاستثناء **الجزئي** لازم يتدمج
    deviceOverrides = { align: { x: 4.5 } };
    const merged = getPrintAlign();
    out.mergedX = merged.x;
    out.mergedY = merged.y;         // لازم 2 من العام مش 0
    out.mergedShrink = merged.shrink; // لازم 3 من العام مش 0

    // ⚠️ والاستثناء بيتقص على حد المعايرة زي العام بالظبط — استثناء
    // مش معناه إنه بيعدّي على الحدود.
    deviceOverrides = { align: { x: 99 } };
    out.clampedX = getPrintAlign().x;

    deviceOverrides = { tweaks: { blackwhite: true } };
    out.mergedTweakOwn = getPrintTweak('blackwhite');  // true من الاستثناء
    out.mergedTweakShared = getPrintTweak('noScale');  // true من العام

    // الصفر في الاستثناء قيمة صحيحة مش "فاضي"
    deviceOverrides = { lead: 0, pace: 0 };
    out.zeroLead = getPrintLeadLabels();
    out.zeroPace = getPrintPaceMs();

    deviceOverrides = null;

    // ============================================================
    // (٤) التنضيف
    // ============================================================
    out.cleanKeeps = Object.keys(cleanPrintFields({ batch: 5, pace: 300, align: { x: 1 } })).sort().join(',');
    out.cleanDropsUnknown = cleanPrintFields({ batch: 5, hack: 'x' }).hack === undefined;
    out.cleanDropsEmpty = Object.keys(cleanPrintFields({ batch: '', lead: null, pace: undefined })).length === 0;
    out.cleanKeepsZero = cleanPrintFields({ lead: 0 }).lead === 0;

    // ============================================================
    // (٥) شاشة الأجهزة + تحذير الاستثناءات
    // ============================================================
    state.deviceSettings = {
      d2: { batch: 9, align: { x: 0.4 }, updatedByName: 'عبدالله', updatedAt: {} },
    };
    // ⚠️ updatedByName/updatedAt **مش** إعدادات — مايتعدّوش
    out.overrideKeys = deviceOverrideKeys('d2').sort().join(',');
    out.noOverrideKeys = deviceOverrideKeys('d1').length;

    state.printTab = 'devices';
    document.body.innerHTML = '<div id=root>' + printScreenHTML() + '</div>';
    const txt = () => document.body.textContent;
    out.twoCards = document.querySelectorAll('.dev-card').length === 2;
    out.warnsOnCard = txt().indexOf('إعداد خاص بالجهاز ده') !== -1;
    out.namesFields = txt().indexOf('حجم الدفعة') !== -1 && txt().indexOf('المعايرة') !== -1;
    out.hasResetBtn = !!document.querySelector('[data-dev-reset="d2"]');
    out.noResetOnClean = !document.querySelector('[data-dev-reset="d1"]');
    out.testOnlineOn = !document.querySelector('[data-dev-frame="d1"]').disabled;
    out.testOfflineOff = document.querySelector('[data-dev-frame="d2"]').disabled;

    // ============================================================
    // (٦) النافذة: "على مين؟" والتحذير قبل المسح
    // ============================================================
    attachPrintDeviceEvents();
    document.getElementById('dev-open-settings').click();
    out.dialogOpened = !!document.querySelector('#ps-target');
    out.targetHasAll = !!document.querySelector('#ps-target option[value="all"]');
    out.targetHasDevices = document.querySelectorAll('#ps-target option').length === 3;

    // "كل الأجهزة" + حقل بيتعارض مع استثناء d2 → تحذير باسمه
    document.querySelector('#ps-target').value = 'all';
    document.querySelector('#ps-batch').value = '15';
    document.querySelector('#ps-batch').dispatchEvent(new Event('input', { bubbles: true }));
    const warn = document.querySelector('#ps-warn');
    out.warnShown = warn.style.display === 'block';
    out.warnNamesDevice = warn.textContent.indexOf('كمبيوتر المخزن') !== -1;
    out.warnNamesField = warn.textContent.indexOf('حجم الدفعة') !== -1;
    // ⚠️ ومايحذّرش من حقل مالوش استثناء
    out.warnSkipsOther = warn.textContent.indexOf('الإيقاع') === -1;
    // ⚠️ واختيار الطابعة مايظهرش على "الكل"
    out.noPrinterPickOnAll = !document.querySelector('#ps-label-printer');

    // حقل مالوش أي استثناء = مفيش تحذير
    document.querySelector('#ps-batch').value = '';
    document.querySelector('#ps-pace').value = '600';
    document.querySelector('#ps-pace').dispatchEvent(new Event('input', { bubbles: true }));
    out.noWarnForClean = document.querySelector('#ps-warn').style.display === 'none';

    // جهاز معيّن → قايمة طابعاته بتبان
    document.querySelector('#ps-target').value = 'd1';
    document.querySelector('#ps-target').dispatchEvent(new Event('change', { bubbles: true }));
    out.printerPickForDevice = !!document.querySelector('#ps-label-printer');
    out.printerOptions = document.querySelectorAll('#ps-label-printer option').length === 4;
    out.onlineNote = document.querySelector('#ps-scope-note').textContent.indexOf('شغّال') !== -1;

    // جهاز مقفول ومن غير قايمة طابعات
    document.querySelector('#ps-target').value = 'd2';
    document.querySelector('#ps-target').dispatchEvent(new Event('change', { bubbles: true }));
    out.offlineNote = document.querySelector('#ps-scope-note').textContent.indexOf('مقفول') !== -1;
    out.noPrinterListMsg = document.querySelector('#ps-printers').textContent.indexOf('لسه مابعتش قايمة طابعاته') !== -1;

    // ============================================================
    // ⭐⭐ (٧) القيمة الشغّالة دلوقتي لازم تبان جوه الخانة
    // ============================================================
    // ⚠️ بنفضّي اللي الفحص نفسه كتبه فوق — وإلا فحص "كل الخانات فاضية"
    // تحت هيفشل على قيمة إحنا اللي حطّيناها.
    document.querySelector('#ps-pace').value = '';
    // العطل: الخانات كانت فاضية وبس، فمتعرفش الجهاز واقف على كام.
    // d1 بينشر batch:30 lead:5 pace:420 مع نبضته.
    document.querySelector('#ps-target').value = 'd1';
    document.querySelector('#ps-target').dispatchEvent(new Event('change', { bubbles: true }));
    out.phBatch = document.querySelector('#ps-batch').placeholder;
    out.phLead = document.querySelector('#ps-lead').placeholder;
    out.phPace = document.querySelector('#ps-pace').placeholder;
    // ⚠️ والأهم: الخانة نفسها لازم تفضل **فاضية** — الـplaceholder مش قيمة
    out.valueStillEmpty = document.querySelector('#ps-batch').value === '';
    // والمفاتيح بتقول هي دلوقتي إيه
    out.tweakLabel = document.querySelector('[data-ps-tweak="noScale"]').options[0].textContent;

    // جهاز تاني بأرقام تانية → الـplaceholder بيتغيّر معاه
    document.querySelector('#ps-target').value = 'd2';
    document.querySelector('#ps-target').dispatchEvent(new Event('change', { bubbles: true }));
    out.phBatch2 = document.querySelector('#ps-batch').placeholder;

    // "كل الأجهزة" بياخد من العام
    sharedPrintSettings = { batch: 44, lead: 3, pace: 700, align: { x: 1.5 }, tweaks: { noScale: false } };
    document.querySelector('#ps-target').value = 'all';
    document.querySelector('#ps-target').dispatchEvent(new Event('change', { bubbles: true }));
    out.phBatchAll = document.querySelector('#ps-batch').placeholder;
    out.phXAll = document.querySelector('#ps-x').placeholder;
    out.tweakLabelAll = document.querySelector('[data-ps-tweak="noScale"]').options[0].textContent;

    // ⚠️⚠️ وأهم من ده كله: الحفظ **مايبعتش** القيم الباهتة.
    // مافيش دالة نندهها من بره، فبنفحص المصدر: أي خانة فيها قيمة هي
    // اللي بتتبعت — فلو كلهم فاضيين يبقى مفيش حاجة هتتبعت.
    out.filledInputs = [...document.querySelectorAll('.card input, .card select')]
      .filter((el) => el.id !== 'ps-target' && el.value !== '').length;

    document.querySelector('#ps-close').click();
    out.dialogClosed = !document.querySelector('#ps-target');
    out.limit = PRINT_ALIGN_LIMIT_MM;
    return out;
  });

  PRINT_ALIGN_LIMIT = r.limit;
  check('⭐⭐ "إعدادات الطابعة" لوحدها مش كفاية للتاب', r.setupAloneNoTab);
  check('حساب الطباعة: مفيش تاب', r.operatorNoTab);
  check('⭐ وشاشته مطابقة للقديمة بالحرف', r.operatorSameScreen);
  check('منشئ النظام: التاب موجود', r.ownerHasTab);

  check('⭐⭐ مالوش استثناء: المعايرة = العام بالحرف', r.noOwnAlign === '{"x":1,"y":2,"shrink":3}', r.noOwnAlign);
  check('⭐⭐ والدفعة', r.noOwnBatch === 20, r.noOwnBatch);
  check('⭐⭐ والإيقاع', r.noOwnPace === 400, r.noOwnPace);
  check('⭐⭐ والمفاتيح (مفتوح ومقفول)', r.noOwnTweakOn === true && r.noOwnTweakOff === false, [r.noOwnTweakOn, r.noOwnTweakOff]);
  check('الاستثناء بيكسب على العام', r.ownBatch === 7 && r.ownPace === 900, [r.ownBatch, r.ownPace]);
  check('واللي مالوش استثناء يفضل على العام', r.ownLeadStillShared === 0, r.ownLeadStillShared);
  check('⭐⭐ استثناء x لوحده: y وshrink من العام مش صفر', r.mergedX === 4.5 && r.mergedY === 2 && r.mergedShrink === 3, [r.mergedX, r.mergedY, r.mergedShrink]);
  check('⭐ والاستثناء بيتقص على حد المعايرة برضه', r.clampedX === PRINT_ALIGN_LIMIT, [r.clampedX]);
  check('⭐⭐ ومفتاح واحد مايلغيش باقي المفاتيح العامة', r.mergedTweakOwn === true && r.mergedTweakShared === true, [r.mergedTweakOwn, r.mergedTweakShared]);
  check('⭐ الصفر في الاستثناء قيمة صحيحة', r.zeroLead === 0 && r.zeroPace === 0, [r.zeroLead, r.zeroPace]);

  check('التنضيف بيقبل الحقول الصح', r.cleanKeeps === 'align,batch,pace', r.cleanKeeps);
  check('⭐ وبيرمي أي حقل بره القايمة', r.cleanDropsUnknown);
  check('وبيرمي الفاضي', r.cleanDropsEmpty);
  check('وبيسيب الصفر', r.cleanKeepsZero);

  check('⭐ عدّ الاستثناءات: الحقول بس مش updatedAt', r.overrideKeys === 'align,batch', r.overrideKeys);
  check('والجهاز النضيف مالوش استثناءات', r.noOverrideKeys === 0, r.noOverrideKeys);
  check('الجهازين ظاهرين', r.twoCards);
  check('والكارت بيقول إن فيه إعداد خاص', r.warnsOnCard);
  check('وبأسماء الإعدادات', r.namesFields);
  check('وزرار "رجّعه للعام"', r.hasResetBtn);
  check('والجهاز النضيف مالوش الزرار ده', r.noResetOnClean);
  check('⭐ زرار التجربة مفتوح على الشغّال ومقفول على المقفول', r.testOnlineOn && r.testOfflineOff, [r.testOnlineOn, r.testOfflineOff]);

  check('النافذة بتفتح', r.dialogOpened);
  check('وفيها "كل الأجهزة"', r.targetHasAll);
  check('وكل الأجهزة في القايمة', r.targetHasDevices);
  check('⭐⭐ "على الكل" بيحذّر قبل ما يمسح', r.warnShown);
  check('⭐⭐ وبيقول اسم الجهاز', r.warnNamesDevice);
  check('⭐⭐ واسم الإعداد', r.warnNamesField);
  check('⭐ ومابيحذّرش من حقل مالوش استثناء', r.warnSkipsOther);
  check('⭐ اختيار الطابعة مايظهرش على "الكل"', r.noPrinterPickOnAll);
  check('وحقل نضيف = مفيش تحذير', r.noWarnForClean);
  check('جهاز معيّن: قايمة طابعاته بتبان', r.printerPickForDevice && r.printerOptions, [r.printerPickForDevice, r.printerOptions]);
  check('ومكتوب إنه شغّال', r.onlineNote);
  check('والمقفول مكتوب إنه مقفول', r.offlineNote);
  check('واللي مابعتش طابعاته بيتقاله السبب', r.noPrinterListMsg);
  check('⭐⭐ الدفعة الشغّالة بتبان جوه الخانة', r.phBatch === '30', r.phBatch);
  check('⭐⭐ والتقديم', r.phLead === '5', r.phLead);
  check('⭐⭐ والإيقاع', r.phPace === '420', r.phPace);
  check('⭐⭐ والخانة نفسها فاضلة فاضية (مش قيمة)', r.valueStillEmpty);
  check('⭐ والمفتاح بيقول هو دلوقتي إيه', r.tweakLabel === 'زي ما هي (مفتوح)', r.tweakLabel);
  check('جهاز تاني = أرقامه هو', r.phBatch2 === '20', r.phBatch2);
  check('و"كل الأجهزة" بياخد من العام', r.phBatchAll === '44' && r.phXAll === '1.5', [r.phBatchAll, r.phXAll]);
  check('والمفتاح العام كمان', r.tweakLabelAll === 'زي ما هي (مقفول)', r.tweakLabelAll);
  check('⭐⭐ والحفظ مابيبعتش القيم الباهتة (كل الخانات فاضية)', r.filledInputs === 0, r.filledInputs);
  check('والنافذة بتقفل', r.dialogClosed);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
