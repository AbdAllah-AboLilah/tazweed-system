// إعداد الطباعة: على جهازي ولا على المحل كله؟
// ============================================================
// اتطلب بعد مراجعة، بالنص: "هل لما اغير اعداد من اعدات الطباعة لو انا
// فاتح ل حساب الطباعة ان يعدل في اعدادته ممكن لما اغير في مفتاح
// يتغير عند الباقي؟".
//
// وكانت **أيوة** — أي حساب معاه "إعدادات الطابعة" كان بيكتب في
// المستند المشترك، فمفتاح واحد يتقلب عند كل أجهزة المحل.
//
// القاعدة دلوقتي بتطابق معنى الصلاحيتين اللي موجودين أصلًا:
//     "إعدادات الطابعة" = يظبط الماكينة اللي قدامه  → استثناء جهازه
//     "التحكم عن بُعد"   = يغيّر ماكينة مش شايفها     → المشترك
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 200)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof saveMachineSetting === 'function' && typeof setPrintTweak === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const writes = [];
    state.user = { uid: 'me' };
    // ⚠️ بنسجّل المسار اللي الكتابة راحت له — ده هو الفحص كله
    window.db = {
      collection: (c) => ({
        doc: (d) => ({
          set: (data) => { writes.push({ path: c + '/' + d, data }); return Promise.resolve(); },
          update: () => Promise.resolve(),
          onSnapshot: () => () => {},
          get: async () => ({ exists: false, data: () => null }),
        }),
      }),
    };
    const reset = () => { writes.length = 0; };
    const paths = () => writes.map((w) => w.path);

    // ---------- منشئ النظام: بيكتب للكل ----------
    state.profile = { id: 'me', role: 'owner' };
    reset();
    setPrintTweak('lightQR', true);
    await new Promise((r2) => setTimeout(r2, 20));
    out.ownerPaths = paths();

    // ============================================================
    // ⭐⭐⭐⭐ حساب الطباعة: بيكتب على **جهازه هو** بس
    // ============================================================
    state.profile = { id: 'tp', role: 'print_operator', perms: { printerSetup: true } };
    reset();
    setPrintTweak('lightQR', false);
    await new Promise((r2) => setTimeout(r2, 20));
    out.opPaths = paths();
    out.opTouchedShared = paths().some((x) => x.indexOf('settings/') === 0);

    // ⚠️ والقيمة لازم تسري على جهازه **فورًا**: هو بيقلب المفتاح
    // ويطبع على طول، والاشتراك اللايف بياخد لحظة.
    out.opValueApplied = getPrintTweak('lightQR') === false;
    state.profile = { id: 'me', role: 'owner' };
    out.stillOffForThisDevice = getPrintTweak('lightQR') === false;

    // ============================================================
    // ⚠️⚠️ استثناء الجهاز مايمسحش باقي مفاتيحه
    // ============================================================
    // الحزمة بتتبني من **اللي شغّال على الجهاز** (المشترك + استثناءه)،
    // مش من المشترك لوحده — وإلا أول مفتاح يتقلب يمسح الباقي.
    state.profile = { id: 'tp', role: 'print_operator', perms: { printerSetup: true } };
    reset();
    setPrintTweak('blackwhite', true);
    await new Promise((r2) => setTimeout(r2, 20));
    const last = writes[writes.length - 1];
    // ⚠️ اللي بيتبعت **المفتاح اللي اتغيّر بس** — والدمج بيحصل في
    // السحابة. الحزمة الكاملة كانت هتخلي التعميم يمسح كل استثناءات
    // الجهاز بدل المفتاح الواحد.
    out.sentOnlyChanged = !!(
      last && last.data && last.data.tweaks &&
      Object.keys(last.data.tweaks).length === 1 && last.data.tweaks.blackwhite === true
    );
    // والنتيجة الفعلية على الجهاز: المفتاحين محفوظين
    out.keptOther = getPrintTweak('lightQR') === false && getPrintTweak('blackwhite') === true;

    // ---------- ضبط المكان: نفس القاعدة ----------
    reset();
    savePrintAlign({ x: 1, y: 0, shrink: 0 });
    await new Promise((r2) => setTimeout(r2, 20));
    out.alignPaths = paths();

    state.profile = { id: 'me', role: 'owner' };
    reset();
    savePrintAlign({ x: 2, y: 0, shrink: 0 });
    await new Promise((r2) => setTimeout(r2, 20));
    out.alignOwnerPaths = paths();

    // ============================================================
    // ⭐⭐⭐⭐ التعميم لازم يمسح استثناء الجهاز اللي قاعد عليه
    // ============================================================
    // استثناء الجهاز بيكسب على العام في القراءة. من غير المسح، صاحب
    // المحل يقلب مفتاح "لكل الأجهزة" ويلاقيه **مش شغّال على جهازه هو**
    // — وده أسوأ نوع عطل: الإعداد اتحفظ فعلًا وشكله مش شغّال.
    state.profile = { id: 'tp', role: 'print_operator', perms: { printerSetup: true } };
    setPrintTweak('rasterize', true); // استثناء على الجهاز ده
    await new Promise((r2) => setTimeout(r2, 20));
    out.beforeGeneralize = getPrintTweak('rasterize');

    state.profile = { id: 'me', role: 'owner' };
    setPrintTweak('rasterize', false); // تعميم على الكل
    await new Promise((r2) => setTimeout(r2, 20));
    out.afterGeneralize = getPrintTweak('rasterize');

    // ⚠️ وبيمسح **المفتاح ده بس**: باقي استثناءات الجهاز لازم تفضل
    out.otherOverrideKept = (getDeviceOverrides().tweaks || {}).lightQR === false;
    return out;
  });

  check('⭐⭐⭐ منشئ النظام بيكتب في المشترك (كل الأجهزة)',
    r.ownerPaths.some((x) => x.indexOf('settings/') === 0), r.ownerPaths);
  check('⭐⭐⭐⭐ حساب الطباعة بيكتب في **استثناء جهازه** مش في المشترك',
    r.opPaths.some((x) => x.indexOf('deviceSettings/') === 0) && r.opTouchedShared === false, r.opPaths);
  check('⭐⭐⭐⭐ والقيمة بتسري على جهازه فورًا (مش مستنية الاشتراك اللايف)',
    r.opValueApplied === true, r.opValueApplied);
  check('⭐⭐⭐ واستثناء الجهاز بيكسب حتى لما منشئ النظام يبص',
    r.stillOffForThisDevice === true, r.stillOffForThisDevice);
  check('⭐⭐⭐⭐ وقلب مفتاح مابيمسحش باقي مفاتيح الجهاز',
    r.keptOther === true, r.keptOther);
  check('⭐⭐⭐ واللي بيتبعت هو المفتاح اللي اتغيّر بس، مش الحزمة كلها',
    r.sentOnlyChanged === true, r.sentOnlyChanged);
  check('⭐⭐⭐ وضبط مكان الطباعة نفس القاعدة (استثناء الجهاز)',
    r.alignPaths.some((x) => x.indexOf('deviceSettings/') === 0) &&
      !r.alignPaths.some((x) => x.indexOf('settings/') === 0), r.alignPaths);
  check('⭐⭐ ومنشئ النظام بيعمّمه', r.alignOwnerPaths.some((x) => x.indexOf('settings/') === 0), r.alignOwnerPaths);
  check('⭐⭐⭐⭐ تعميم مفتاح بيمسح استثناء الجهاز فيشتغل على جهاز صاحب المحل كمان',
    r.beforeGeneralize === true && r.afterGeneralize === false, [r.beforeGeneralize, r.afterGeneralize]);
  check('⭐⭐⭐ وبيمسح المفتاح ده بس — باقي استثناءات الجهاز بتفضل',
    r.otherOverrideKept === true, r.otherOverrideKept);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
