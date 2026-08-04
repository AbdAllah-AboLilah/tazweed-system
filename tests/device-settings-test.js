// هل إعدادات الطباعة بتضيع لما نغيّر الحساب على نفس الجهاز؟
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // context واحد = نفس الجهاز/المتصفح بالظبط، زي كمبيوتر الكاشير
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof getPrintAlign === 'function');

  // ---- المستخدم الأول (المنشئ) بيظبّط كل حاجة ----
  const written = await p.evaluate(() => {
    localStorage.clear();
    state.user = { uid: 'owner-uid' };
    state.profile = { name: 'AboLilah', role: 'owner' };
    saveSelectedPrinter('label', 'Xprinter XP-233B');
    saveSelectedPrinter('restock', 'HP LaserJet');
    saveDeviceName('كمبيوتر الكاشير');
    savePrintAlign({ x: 0.6, y: -0.4, shrink: 3 });
    setPrintTweak('blackwhite', true);
    return { id: getDeviceId(), keys: Object.keys(localStorage).sort() };
  });

  // ---- خروج + دخول بحساب تاني، نفس الجهاز ----
  const afterSwitch = await p.evaluate(() => {
    // ده اللي بيحصل فعليًا عند تسجيل الخروج: auth.signOut() وبعدين
    // onAuthStateChanged بيصفّر state ويعيد الرسم. مافيش أي مسح للتخزين.
    state.user = null;
    state.profile = null;
    render();
    state.user = { uid: 'other-uid' };
    state.profile = { name: 'موظف', role: 'branch_manager', perms: { printerSetup: true } };
    render();
    return {
      label: getSavedPrinter('label'),
      restock: getSavedPrinter('restock'),
      device: getDeviceName(),
      id: getDeviceId(),
      align: getPrintAlign(),
      tweak: getPrintTweak('blackwhite'),
    };
  });

  check('طابعة الملصق فاضلة بعد تغيير الحساب', afterSwitch.label === 'Xprinter XP-233B', afterSwitch);
  check('طابعة ورقة التزويد فاضلة', afterSwitch.restock === 'HP LaserJet', afterSwitch);
  check('اسم الجهاز فاضل', afterSwitch.device === 'كمبيوتر الكاشير', afterSwitch);
  check('معرّف الجهاز مااتغيّرش', afterSwitch.id === written.id, { a: written.id, b: afterSwitch.id });
  check('ضبط مكان الطباعة فاضل', afterSwitch.align.x === 0.6 && afterSwitch.align.y === -0.4 && afterSwitch.align.shrink === 3, afterSwitch.align);
  check('المفتاح المتقدّم فاضل', afterSwitch.tweak === true, afterSwitch);

  // ---- تبويب جديد تمامًا بنفس الجهاز (زي ما يكون قفل وفتح) ----
  const p2 = await ctx.newPage();
  await p2.goto('http://localhost:8899/tests/harness.html');
  await p2.waitForFunction(() => typeof getPrintAlign === 'function');
  const fresh = await p2.evaluate(() => ({
    label: getSavedPrinter('label'), align: getPrintAlign(), device: getDeviceName(),
  }));
  check('تبويب جديد بيلاقيها جاهزة', fresh.label === 'Xprinter XP-233B' && fresh.align.x === 0.6 && fresh.device === 'كمبيوتر الكاشير', fresh);

  // ---- جهاز تاني فعلًا (context تاني = تخزين تاني) ----
  const ctx2 = await b.newContext();
  const p3 = await ctx2.newPage();
  await p3.goto('http://localhost:8899/tests/harness.html');
  await p3.waitForFunction(() => typeof getPrintAlign === 'function');
  const other = await p3.evaluate(() => ({ label: getSavedPrinter('label'), align: getPrintAlign() }));
  check('جهاز تاني بيبدأ فاضي (وده الصح)', other.label === '' && other.align.x === 0, other);

  console.log('\n✅ نجح (' + pass.length + '):');
  pass.forEach(x => console.log('   ' + x));
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  console.log('\nالمفاتيح المتخزّنة:', JSON.stringify(written.keys, null, 1));
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
