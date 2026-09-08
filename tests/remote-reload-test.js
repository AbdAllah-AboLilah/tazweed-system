// تحديث الجهاز من بعيد — 🔄 من التليفون
// ============================================================
// اتطلب بالنص: "لو حد مش واخد باله ان في تحديث اعمله انا ري فريش من
// عندي" — لجهاز واحد أو لكل الأجهزة.
//
// مافيش قناة أوامر جديدة: بنكتب طابع وقت في مستند إعدادات الجهاز
// (deviceSettings) اللي كل جهاز مشترك فيه لايف أصلًا، والكتابة فيه
// مقصورة على منشئ النظام في قواعد الأمان من الأصل.
//
// ⚠️⚠️ وده **بيقفل شاشة حد تاني ويفتحها**. تلات حراس، والفحص ده كله
// عنهم:
//   1) مايعملش لوب (الطابع بيتسجّل **قبل** الريفريش)
//   2) أول لقطة بعد فتح الصفحة بتتسجّل وبس (الجهاز اللي لسه فاتح
//      خلاص عنده آخر نسخة — الريفريش مالوش معنى)
//   3) مايقاطعش طبعة شغّالة ولا حد بيكتب
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() =>
    typeof handleRemoteReload === 'function' && typeof requestRemoteReload === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    // بنمسك الريفريش بدل ما نعمله فعلًا
    let reloads = 0;
    const realWait = window.waitThenReload;
    window.waitThenReload = () => { reloads++; };
    const seenKey = 'tazweed_reload_seen';
    const reset = () => {
      reloads = 0; reloadSeeded = false;
      try { localStorage.removeItem(seenKey); } catch (e) {}
    };

    // ---------- (2) أول لقطة = تسجيل بس ----------
    reset();
    handleRemoteReload({ reloadAt: '1000' });
    out.firstSnapshotNoReload = reloads;
    out.firstSnapshotRemembered = localStorage.getItem(seenKey);

    // ---------- طلب جديد بعد كده = ريفريش ----------
    handleRemoteReload({ reloadAt: '2000' });
    out.newRequestReloads = reloads;
    out.rememberedNew = localStorage.getItem(seenKey);

    // ---------- (1) نفس الطابع تاني = مفيش ريفريش (اللوب) ----------
    handleRemoteReload({ reloadAt: '2000' });
    handleRemoteReload({ reloadAt: '2000' });
    out.sameStampNoLoop = reloads;

    // ---------- والتسجيل بيحصل قبل الريفريش ----------
    // بنخلي الريفريش نفسه يقرا التخزين ويقولنا اتسجّل ولا لأ
    reset();
    handleRemoteReload({ reloadAt: '5000' });   // تسجيل
    let stampAtReload = null;
    window.waitThenReload = () => { stampAtReload = localStorage.getItem(seenKey); reloads++; };
    handleRemoteReload({ reloadAt: '6000' });
    out.stampWrittenBeforeReload = stampAtReload;

    // ---------- مفيش طابع = مفيش حاجة ----------
    window.waitThenReload = () => { reloads++; };
    reset();
    handleRemoteReload(null);
    handleRemoteReload({});
    handleRemoteReload({ reloadAt: '' });
    out.noStampNoReload = reloads;

    // ---------- (3) مايقاطعش طبعة ولا كتابة ----------
    window.waitThenReload = realWait;
    const realNotice = window.showPrintNotice;
    window.showPrintNotice = () => {};
    let reloaded = 0;
    const realLoc = window.location.reload;
    // ⚠️ مانقدرش نستبدل location.reload، فبنقيس **الانتظار** بدل التنفيذ:
    // waitThenReload بتعيد جدولة نفسها وهي مشغولة.
    // ⚠️⚠️ بنسجّل **مدة** المؤقت مش عدده: أول نسخة من الفحص كانت بتعدّ
    // المؤقتات وبس، والحالتين بيعملوا مؤقت — فالفحص كان بيعدّي حتى لما
    // نشيل الانتظار خالص. المدة هي اللي بتفرّق:
    //   انتظار الطبعة = 2000    |    الريفريش نفسه = 1200
    let delays = [];
    const realTimeout = window.setTimeout;
    window.setTimeout = (fn, ms) => { delays.push(ms); return realTimeout(() => {}, 0); };

    activePrintCancel = { requested: false };     // طبعة شغّالة
    waitThenReload(0);
    out.printingDelays = delays.slice();
    activePrintCancel = null;

    delays = [];
    typingNow = false;
    waitThenReload(0);
    out.idleDelays = delays.slice();
    window.setTimeout = realTimeout;
    window.showPrintNotice = realNotice;

    // ---------- الإرسال ----------
    const writes = [];
    const realDb = window.db;
    window.db = { collection: (c) => ({ doc: (id) => ({
      set: (data, opts) => { writes.push({ c, id, data, opts }); return Promise.resolve(); } }) }) };
    out.sentCount = await requestRemoteReload(['d1', 'd2', 'd3']);
    out.writes = writes.map((w) => ({ c: w.c, id: w.id, has: !!w.data.reloadAt, merge: !!(w.opts && w.opts.merge) }));
    out.sameStampForAll = new Set(writes.map((w) => w.data.reloadAt)).size === 1;
    writes.length = 0;
    out.emptyList = await requestRemoteReload([]);
    out.emptyWrote = writes.length;
    window.db = realDb;

    return out;
  });

  // (2)
  check('⭐⭐ أول لقطة بعد فتح الصفحة: مفيش ريفريش', r.firstSnapshotNoReload === 0, r.firstSnapshotNoReload);
  check('⭐ بس الطابع بيتسجّل', r.firstSnapshotRemembered === '1000', r.firstSnapshotRemembered);

  // الطلب الحقيقي
  check('⭐⭐⭐ طلب جديد → ريفريش', r.newRequestReloads === 1, r.newRequestReloads);
  check('⭐ والطابع الجديد اتسجّل', r.rememberedNew === '2000', r.rememberedNew);

  // (1)
  check('⚠️⚠️ نفس الطابع تاني وتالت → مفيش ريفريش (اللوب)', r.sameStampNoLoop === 1, r.sameStampNoLoop);
  check('⚠️⚠️ والطابع بيتسجّل **قبل** الريفريش مش بعده',
    r.stampWrittenBeforeReload === '6000', r.stampWrittenBeforeReload);

  check('⚠️ مفيش طابع → مفيش أي حاجة', r.noStampNoReload === 0, r.noStampNoReload);

  // (3)
  check('⭐⭐⭐ طبعة شغّالة → بيعيد الجدولة (2000) مايعملش ريفريش',
    r.printingDelays.includes(2000) && !r.printingDelays.includes(1200), r.printingDelays);
  check('⭐ والجهاز فاضي → بيجدول الريفريش (1200) مش انتظار',
    r.idleDelays.includes(1200) && !r.idleDelays.includes(2000), r.idleDelays);

  // الإرسال
  check('⭐⭐ الطلب بيتبعت لكل الأجهزة', r.sentCount === 3, r.sentCount);
  check('⭐ في مجموعة إعدادات الجهاز، وبالدمج (مايمسحش إعداداته)',
    r.writes.every((w) => w.c === 'deviceSettings' && w.has && w.merge), r.writes);
  check('⭐⭐ ونفس الطابع للكل (عملية واحدة)', r.sameStampForAll);
  check('⚠️ وقايمة فاضية → مفيش كتابة', r.emptyList === 0 && r.emptyWrote === 0, [r.emptyList, r.emptyWrote]);

  // ---------- الشاشة ----------
  const ui = await p.evaluate(() => {
    state.user = { uid: 'me' };
    state.profile = { name: 'x', role: 'owner' };
    const mk = (id, name, seen) => ({
      id, deviceName: name, labelPrinter: 'a', restockPrinter: 'b', printers: [],
      appVersion: '0.77.6', qzVersion: '2.2.6',
      printSetup: { batch: 50, lead: 5, pace: 420, tweaks: {}, align: {} },
      // ⚠️ isStationOnline بتستخدم toMillis مش toDate — الطابعة الوهمية
      // من غيرها بتطلع "مقفولة" دايمًا والفحص بيفشل بسبب المحاكاة.
      lastSeen: { toDate: () => new Date(Date.now() - seen), toMillis: () => Date.now() - seen },
    });
    state.printStations = [mk('d1', 'Cash1', 1000), mk('d2', 'Cash2', 9e8)];
    const html = printDevicesHTML();
    return {
      perDevice: (html.match(/data-dev-reload="/g) || []).length,
      all: html.indexOf('id="dev-reload-all"') !== -1,
      allCount: /حدّث كل الأجهزة الشغّالة \((\d+)\)/.exec(html),
      offlineDisabled: /data-dev-reload="d2"[^>]*disabled/.test(html),
      onlineEnabled: !/data-dev-reload="d1"[^>]*disabled/.test(html),
    };
  });
  check('⭐⭐ زرار لكل جهاز', ui.perDevice === 2, ui.perDevice);
  check('⭐⭐ وزرار "حدّث الكل"', ui.all);
  check('⭐ وبيعدّ الشغّالين بس', ui.allCount && ui.allCount[1] === '1', ui.allCount && ui.allCount[1]);
  check('⚠️ والجهاز المقفول زراره مقفول (بياخد آخر نسخة أول ما يفتح)', ui.offlineDisabled);
  check('⚠️ والشغّال زراره مفتوح', ui.onlineEnabled);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
