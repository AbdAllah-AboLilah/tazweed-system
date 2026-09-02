// الإعداد اتغيّر من بعيد → الجهاز يعيد نشر نفسه فورًا
// ============================================================
// ⚠️⚠️ العطل اللي بيحرسه (اتبلّغ من صاحب النظام على ورق):
//   "فتحت مفتاح على كل الأجهزة وحفظت، ودخلت على جهاز من اللي عندي
//    لقيته لسه مقفول زي ما هو"
//
// والإعداد كان **اتحفظ فعلًا**. المشكلة في العرض: شاشة الجهاز المعيّن
// بتوري آخر حاجة **الجهاز ده أذاعها عن نفسه** (printSetup في نبضته)،
// مش الإعداد العام. والنبضة كل **45 ثانية**، والجهاز ماكانش بيعيد النشر
// لما إعداده يتغيّر من بعيد.
//
// يعني الإعداد وصل بس الشاشة بتوري صورة قديمة لحد 45 ثانية — والمستخدم
// بيفتكر إن الحفظ ماتمّش ويعيده. وده أسوأ من التأخير نفسه.
//
// ⚠️ والفحص ده بيتأكد كمان إن مافيش **دايرة**: النشر بيكتب في مجموعة
// تانية خالص، فمايرجعش يولّع الاشتراك اللي ندهه.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof subscribePrintSettings === 'function' && typeof republishStationSoon === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    let published = 0;
    const writes = [];
    window.safeRegisterPrintStation = () => { published++; };

    // قاعدة وهمية بنمسك منها دالة اللقطة لكل مجموعة
    const cbs = {};
    window.db = {
      collection: (name) => ({
        doc: () => ({
          onSnapshot: (cb, err) => { cbs[name] = cb; return () => {}; },
          set: (d) => { writes.push({ name, d }); return Promise.resolve(); },
          update: () => Promise.resolve(),
        }),
      }),
    };
    const snap = (data) => ({ exists: true, data: () => data });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // ---------- الاشتراكين ----------
    unsubPrintSettings = null;
    subscribePrintSettings();
    out.sharedHooked = typeof cbs['settings'] === 'function';

    if (typeof getDeviceId === 'function' && getDeviceId()) {
      unsubDeviceSettings = null;
      subscribeDeviceSettings();
    }
    out.deviceHooked = typeof cbs[DEVICE_SETTINGS] === 'function';

    // ============================================================
    // ⭐⭐⭐ (١) الإعداد العام اتغيّر → نشر فوري
    // ============================================================
    published = 0;
    cbs['settings'](snap({ tweaks: { sheetImage: true } }));
    out.beforeWait = published;          // ⚠️ لسه بدري — بيتلمّ
    await wait(700);
    out.sharedRepublished = published;   // ⭐ لازم 1

    // ============================================================
    // ⭐⭐ (٢) استثناء الجهاز اتغيّر → نشر فوري كمان
    // ============================================================
    if (out.deviceHooked) {
      published = 0;
      cbs[DEVICE_SETTINGS](snap({ tweaks: { sheetImage: false } }));
      await wait(700);
      out.deviceRepublished = published;
    }

    // ============================================================
    // ⚠️ (٣) اللمّ: كذا تغيير ورا بعض = نشرة واحدة مش نشرة لكل واحد
    // ============================================================
    published = 0;
    for (let i = 0; i < 6; i++) cbs['settings'](snap({ tweaks: { batch: i } }));
    await wait(700);
    out.burstPublished = published;      // ⭐ لازم 1 مش 6

    // ============================================================
    // ⚠️⚠️ (٤) مفيش دايرة: النشر بيكتب في مجموعة تانية
    // ============================================================
    // لو النشر كان بيكتب في settings أو deviceSettings، كان هيرجع يولّع
    // نفس الاشتراك ويلف على نفسه للأبد.
    writes.length = 0;
    published = 0;
    cbs['settings'](snap({ tweaks: { lead: 5 } }));
    await wait(700);
    out.noSelfWrite = !writes.some((w) => w.name === 'settings' || w.name === DEVICE_SETTINGS);
    out.loopSafe = published === 1;

    // ⚠️ (٥) الجهاز اللي مالوش دالة نشر (تليفون) → مايقعش
    published = 0;
    const real = window.safeRegisterPrintStation;
    window.safeRegisterPrintStation = undefined;
    cbs['settings'](snap({ tweaks: {} }));
    await wait(700);
    out.noPublisherSafe = true;   // لو رمى خطأ الصفحة كانت هتسجّله
    window.safeRegisterPrintStation = real;

    return out;
  });

  check('الاشتراك على الإعداد العام اتمسك', r.sharedHooked);
  check('⭐⭐⭐ الإعداد العام اتغيّر → الجهاز نشر نفسه', r.sharedRepublished === 1, r.sharedRepublished);
  check('⭐ والنشر بيتلمّ (مش فوري بالحرف)', r.beforeWait === 0, r.beforeWait);
  if (r.deviceHooked) check('⭐⭐ استثناء الجهاز اتغيّر → نشر كمان', r.deviceRepublished === 1, r.deviceRepublished);
  check('⚠️ ٦ تغييرات ورا بعض → نشرة **واحدة**', r.burstPublished === 1, r.burstPublished);
  check('⚠️⚠️ مافيش دايرة: النشر مابيكتبش في نفس المجموعة', r.noSelfWrite);
  check('⚠️ ونشرة واحدة بس بعد التغيير', r.loopSafe, r.loopSafe);
  check('⚠️ جهاز من غير طابعة (تليفون) → مايقعش', r.noPublisherSafe);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
