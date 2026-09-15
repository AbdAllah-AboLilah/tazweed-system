// ============================================================
// 🆔 الكمبيوتر الواحد = جهاز واحد في النظام
// ============================================================
// ⚠️⚠️ اتطلب بالنص: "انا شغال علي جهاز كمبيوتر ب حساب معين في متصفح
// ضيف مثلا هيحسب النظام ان ده جهاز ويحطه في الاجهزة ولو فتحت من متصفح
// خاص النظام بيطلب بردوا ان اعمل اعدادات الطابعة كده جهاز واحد واخد
// انه اتنين جهاز".
//
// السبب: معرّف الجهاز رقم عشوائي في ذاكرة المتصفح، وذاكرة كل بروفايل
// منفصلة. فنفس الكمبيوتر بيتحسب كذا جهاز وكل واحد عايز إعداداته.
//
// والبرنامج المساعد شغّال على الماكينة نفسها، فهو الوحيد اللي يقدر
// يدّي رقم ثابت للكمبيوتر مهما اتغيّر المتصفح.
//
// ⚠️⚠️ وأخطر جزء هنا **الترحيل**: تغيير المعرّف معناه إن إعدادات
// الجهاز المحفوظة في السحابة بقت على مفتاح تاني — يعني ضايعة. الفحص
// ده بيحرس النقطة دي بالذات.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof adoptMachineId === 'function' && typeof getDeviceId === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };

    // ---- سحابة مقلّدة ----
    const docs = {};
    const deleted = [];
    const mkDoc = (coll, id) => ({
      get: async () => ({ exists: docs[coll + '/' + id] !== undefined, data: () => docs[coll + '/' + id] }),
      set: async (data) => { docs[coll + '/' + id] = { ...(docs[coll + '/' + id] || {}), ...data }; },
      delete: async () => { deleted.push(coll + '/' + id); delete docs[coll + '/' + id]; },
      update: async () => {},
      onSnapshot: () => () => {},
    });
    window.db = { collection: (coll) => ({ doc: (id) => mkDoc(coll, id), add: async () => ({}) }) };

    let helperOn = true;
    let machineId = 'pc-aaaa1111';
    let helperName = '';
    const realFetch = window.fetch;
    window.fetch = async (u, o) => {
      if (String(u).indexOf('/status') !== -1) {
        if (!helperOn) throw new Error('مش شغّال');
        return {
          ok: true,
          json: async () => ({
            app: 'tazweed-helper', version: '1.6.0', printers: ['P'],
            machineId, deviceName: helperName,
          }),
        };
      }
      return realFetch(u, o);
    };

    const reset = (localId) => {
      helperCache = null;
      localStorage.setItem('tazweed_device_id', localId);
      localStorage.removeItem('tazweed_device_name');
    };

    // ============================================================
    // ⭐⭐⭐⭐⭐ البرنامج شغّال → الجهاز بياخد رقم الماكينة
    // ============================================================
    reset('dev-عشوائي-1');
    docs['deviceSettings/dev-عشوائي-1'] = { tweaks: { sheetHelper: true }, align: { x: 2 } };
    docs['printStations/dev-عشوائي-1'] = { deviceName: 'قديم' };
    await adoptMachineId();
    out.idAfter = getDeviceId();
    out.movedSettings = docs['deviceSettings/pc-aaaa1111'] || null;
    out.oldSettingsGone = docs['deviceSettings/dev-عشوائي-1'] === undefined;
    out.oldCardGone = docs['printStations/dev-عشوائي-1'] === undefined;

    // ============================================================
    // ⭐⭐⭐⭐⭐ متصفح تاني على نفس الكمبيوتر → **نفس** الرقم
    // ============================================================
    // ده جوهر الطلب: الكمبيوتر يتحسب مرة واحدة.
    reset('dev-عشوائي-2');
    // ⚠️⚠️ المتصفح التاني **معاه إعدادات خاصة بيه** — ودي النقطة اللي
    // بتفرّق. من غيرها مافيش حاجة تكتب فوق، والفحص بيعدّي حتى لو
    // الحارس اتشال (اتمسكت بالتخريب).
    docs['deviceSettings/dev-عشوائي-2'] = { tweaks: { sheetHelper: false }, من: 'المتصفح التاني' };
    await adoptMachineId();
    out.secondBrowserId = getDeviceId();

    // ⚠️ ومابيكتبش فوق إعداد المتصفح الأول: هو اللي سبق، وبتاعه الصح.
    const merged = docs['deviceSettings/pc-aaaa1111'] || {};
    out.keptFirstSettings = !!merged.tweaks && merged.tweaks.sheetHelper === true && !!merged.align;
    out.secondDidNotOverwrite = merged['من'] === undefined;

    // ============================================================
    // ⭐⭐⭐⭐ البرنامج مش شغّال → مافيش أي تغيير
    // ============================================================
    reset('dev-عشوائي-3');
    helperOn = false;
    await adoptMachineId();
    out.noHelperId = getDeviceId();
    helperOn = true;

    // ---------- اسم الجهاز من البرنامج ----------
    reset('dev-عشوائي-4');
    helperName = 'كمبيوتر الكاشير';
    await adoptMachineId();
    out.nameFromHelper = getDeviceName();

    // ⚠️ والبرنامج من غير اسم مايمسحش الاسم المحفوظ
    reset('dev-عشوائي-5');
    saveDeviceName('اسم محلي');
    helperName = '';
    await adoptMachineId();
    out.nameKept = getDeviceName();

    // ---------- زرار شيل الجهاز ----------
    // ⚠️ مقفول على الجهاز المقفول بس: الشغّال بيرجّع يسجّل نفسه مع أول
    // نبضة، وكمان الطبعات اللي في السكة ليه كانت هتضيع.
    const card = (onlineNow) => {
      const st = {
        id: 'dev-x', deviceName: 'جهاز', labelPrinter: 'P', restockPrinter: 'P',
        printers: ['P'], appVersion: '0.91.1',
        // ⚠️ lastSeen بشكل تاريخ فايرستور (فيه toMillis) — isStationOnline
        // بترجّع false لأي شكل تاني، فالتقليد لازم يبقى مطابق.
        lastSeen: { toMillis: () => (onlineNow ? Date.now() : Date.now() - 10 * 60 * 1000) },
      };
      state.printStations = [st];
      return stationCardHTML(st);
    };
    out.removeOnOffline = /data-dev-remove/.test(card(false));
    out.removeOnOnline = /data-dev-remove/.test(card(true));

    window.fetch = realFetch;
    out.deleted = deleted.slice();
    return out;
  });

  check('⭐⭐⭐⭐⭐ الجهاز بياخد رقم الماكينة من البرنامج',
    r.idAfter === 'pc-aaaa1111', r.idAfter);
  check('⭐⭐⭐⭐⭐ ومتصفح تاني على نفس الكمبيوتر بياخد **نفس** الرقم',
    r.secondBrowserId === 'pc-aaaa1111', r.secondBrowserId);

  check('⭐⭐⭐⭐⭐ وإعدادات الجهاز القديمة **اتنقلت** مش ضاعت',
    !!r.movedSettings && !!r.movedSettings.tweaks && !!r.movedSettings.align, r.movedSettings);
  check('⭐⭐⭐⭐ والقديمة اتشالت (مش متكررة)', r.oldSettingsGone === true, r.oldSettingsGone);
  check('⭐⭐⭐⭐ وكارت الجهاز القديم اتشال (مافيش شبح في القايمة)',
    r.oldCardGone === true, r.oldCardGone);
  check('⭐⭐⭐⭐⭐ ومابيكتبش فوق إعداد المتصفح اللي سبقه',
    r.keptFirstSettings === true, r.keptFirstSettings);
  check('⭐⭐⭐⭐⭐ وإعداد المتصفح التاني مادخلش فوقه خالص',
    r.secondDidNotOverwrite === true, r.secondDidNotOverwrite);

  check('⭐⭐⭐⭐⭐ والبرنامج مش شغّال → الرقم العشوائي زي ما هو',
    r.noHelperId === 'dev-عشوائي-3', r.noHelperId);

  check('⭐⭐⭐⭐ واسم الجهاز بيتاخد من البرنامج',
    r.nameFromHelper === 'كمبيوتر الكاشير', r.nameFromHelper);
  check('⭐⭐⭐ والبرنامج من غير اسم مايمسحش المحفوظ',
    r.nameKept === 'اسم محلي', r.nameKept);

  // ============================================================
  // 🗑️ زرار شيل الجهاز — للكروت المكررة القديمة
  // ============================================================
  // اتطلب بالنص: "دلوقتي شاشة الاجهزة فيها بعض الاجهزة مكرره قبل م
  // نحدث المساعد ... ايه الحل بتاع النقطة دي".
  check('⭐⭐⭐⭐ الجهاز المقفول عليه زرار "شيله من القايمة"',
    r.removeOnOffline === true, r.removeOnOffline);
  check('⭐⭐⭐⭐⭐ والجهاز الشغّال **مالوش** الزرار ده',
    r.removeOnOnline === false, r.removeOnOnline);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
