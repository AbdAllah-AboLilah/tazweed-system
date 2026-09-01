// اسم اللي ماسك الجهاز — الحساب المشترك
// ============================================================
// المشكلة اللي بيحلها: حساب الطباعة بيستخدمه كذا شخص، فالسجل كان بيقول
// "طبع: حساب الطباعة" ومحدش عارف مين فعلًا.
//
// ⭐ أهم 4 نقط هنا:
//   1) الحساب العادي **مايتسألش** — السؤال بس للحساب المعلّم "مشترك"
//   2) الاسم بيتحفظ **لكل حساب لوحده** على نفس الجهاز — من غير كده
//      الاسم بيتسرّب من حساب للتاني لما حد يسجّل دخول بحساب مختلف
//   3) أول دخول **مفيش زرار إلغاء** — الغرض كله إن الحركة ماتبقاش مجهولة
//   4) الاسم بيوصل للسجل فعلًا (entryWho)
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof askOperatorName === 'function' && typeof operatorChipHTML === 'function');

  const r = await p.evaluate(() => {
    const out = {};
    window.render = () => {};
    Object.keys(localStorage)
      .filter((k) => k.indexOf('tazweed_operator_') === 0)
      .forEach((k) => localStorage.removeItem(k));

    state.user = { uid: 'U1' };

    // (1) حساب عادي — لا شريحة ولا سؤال
    state.profile = { name: 'عبدالله', role: 'owner' };
    out.normalNoChip = operatorChipHTML() === '';
    out.normalNotShared = isSharedAccount() === false;
    ensureOperatorName();
    out.normalNoDialog = !document.querySelector('#op-name');

    // (2) حساب مشترك من غير اسم محفوظ → بيسأل
    state.profile = { name: 'حساب الطباعة', role: 'print_operator', sharedAccount: true };
    out.sharedIsShared = isSharedAccount() === true;
    out.chipAsks = operatorChipHTML().indexOf('مين انت؟') !== -1;
    ensureOperatorName();
    out.dialogOpened = !!document.querySelector('#op-name');
    // (3) أول دخول = مفيش إلغاء
    out.noCancelOnFirst = !document.querySelector('#op-cancel');

    // (4) اسم فاضي مايتقبلش
    document.querySelector('#op-name').value = '   ';
    document.querySelector('#op-save').click();
    out.emptyRejected = !!document.querySelector('#op-name');
    out.emptyShowsError = (document.querySelector('#op-err').textContent || '').trim().length > 0;

    // (5) اسم صح → بيتحفظ والمودال بيقفل
    document.querySelector('#op-name').value = '  محمود  ';
    document.querySelector('#op-save').click();
    out.dialogClosed = !document.querySelector('#op-name');
    out.saved = getOperatorName();
    out.trimmed = out.saved === 'محمود';
    out.chipShowsName = operatorChipHTML().indexOf('محمود') !== -1;

    // (6) مايتسألش تاني على نفس الجهاز
    ensureOperatorName();
    out.notAskedAgain = !document.querySelector('#op-name');

    // (7) ⭐ حساب تاني على نفس الجهاز = اسم تاني (مش بيتسرّب)
    state.user = { uid: 'U2' };
    out.otherAccountEmpty = getOperatorName() === '';
    ensureOperatorName();
    out.otherAccountAsked = !!document.querySelector('#op-name');
    document.querySelector('#op-name').value = 'سارة';
    document.querySelector('#op-save').click();
    state.user = { uid: 'U1' };
    out.firstAccountKept = getOperatorName() === 'محمود';

    // (8) تغيير الاسم بإيد المستخدم = فيه إلغاء، والإلغاء مابيغيّرش
    askOperatorName(true);
    out.hasCancelOnManual = !!document.querySelector('#op-cancel');
    out.prefilled = document.querySelector('#op-name').value === 'محمود';
    document.querySelector('#op-name').value = 'حاجة تانية';
    document.querySelector('#op-cancel').click();
    out.cancelKeptOld = getOperatorName() === 'محمود';

    // (9) الطول محدود — عشان مايكسرش الشريط العلوي
    saveOperatorName('اسم طويل جدا جدا جدا جدا جدا جدا');
    out.lengthCapped = getOperatorName().length <= OPERATOR_NAME_MAX;
    saveOperatorName('محمود');

    // (10) السجل: الاسم بيبان جنب اسم الحساب
    out.whoWithOperator = entryWho({ userName: 'حساب الطباعة', operatorName: 'محمود' });
    out.whoWithout = entryWho({ userName: 'عبدالله' });

    // (11) الشريط العلوي: الشريحة جوه topbar-user فعلًا
    document.body.innerHTML = '<div class="topbar-user"><span class="topbar-name">حساب الطباعة</span>' + operatorChipHTML() + '</div>';
    const chip = document.querySelector('#operator-chip');
    out.chipInTopbar = !!(chip && chip.closest('.topbar-user'));
    out.chipIsButton = !!(chip && chip.tagName === 'BUTTON');
    // ⚠️ الشريحة لازم تفضل ظاهرة على أضيق شاشة — الرتبة هي اللي بتختفي
    out.chipVisible = !!(chip && getComputedStyle(chip).display !== 'none');

    // (12) ⭐⭐ شاشة موظف الطباعة — شريطها العلوي **منفصل** عن باقي
    // الشاشات وبيرجع بدري من الربط. فلازم نتأكد إن الشريحة بتبان **و**
    // بتشتغل هناك بالذات، لأنه الحساب الوحيد اللي أصلًا مشترك.
    state.user = { uid: 'U1' };
    state.profile = { name: 'حساب الطباعة', role: 'print_operator', sharedAccount: true };
    document.body.innerHTML = '<div id=root></div>';
    try {
      document.getElementById('root').innerHTML = dashboardHTML();
      attachDashboardEvents();
    } catch (e) {
      out.opScreenErr = String(e);
    }
    const opChip = document.querySelector('#operator-chip');
    out.opScreenChip = !!opChip;
    out.opScreenChipName = !!(opChip && opChip.textContent.indexOf('محمود') !== -1);
    if (opChip) {
      opChip.click();
      out.opScreenChipWired = !!document.querySelector('#op-name');
      const c = document.querySelector('#op-cancel');
      if (c) c.click();
    }

    return out;
  });

  check('حساب عادي: مفيش شريحة', r.normalNoChip);
  check('حساب عادي: مش مشترك', r.normalNotShared);
  check('حساب عادي: مايتسألش', r.normalNoDialog);
  check('حساب مشترك: متعلّم مشترك', r.sharedIsShared);
  check('حساب مشترك: الشريحة بتقول "مين انت؟"', r.chipAsks);
  check('حساب مشترك: بيسأل أول دخول', r.dialogOpened);
  check('⭐ أول دخول: مفيش زرار إلغاء', r.noCancelOnFirst);
  check('اسم فاضي مايتقبلش', r.emptyRejected);
  check('واللي بيحصل بيتقال', r.emptyShowsError);
  check('اسم صح: المودال بيقفل', r.dialogClosed);
  check('الاسم بيتحفظ من غير مسافات', r.trimmed, r.saved);
  check('الشريحة بقت بالاسم', r.chipShowsName);
  check('مايتسألش تاني', r.notAskedAgain);
  check('⭐ حساب تاني على نفس الجهاز: اسمه فاضي', r.otherAccountEmpty);
  check('⭐ وبيتساله هو كمان', r.otherAccountAsked);
  check('⭐⭐ والحساب الأول محتفظ باسمه', r.firstAccountKept);
  check('التغيير اليدوي: فيه إلغاء', r.hasCancelOnManual);
  check('والاسم القديم مكتوب فيه', r.prefilled);
  check('والإلغاء مابيغيّرش حاجة', r.cancelKeptOld);
  check('الاسم الطويل بيتقص', r.lengthCapped);
  check('السجل: "الحساب — الشخص"', r.whoWithOperator === 'حساب الطباعة — محمود', r.whoWithOperator);
  check('وحساب عادي: الاسم لوحده', r.whoWithout === 'عبدالله', r.whoWithout);
  check('الشريحة جنب اسم الحساب فوق', r.chipInTopbar);
  check('والشريحة زرار (تتضغط)', r.chipIsButton);
  check('⭐ والشريحة ظاهرة على 390px', r.chipVisible);
  check('⭐ شاشة موظف الطباعة: الشريحة بتبان', r.opScreenChip, r.opScreenErr);
  check('وفيها الاسم', r.opScreenChipName);
  check('⭐⭐ والضغط عليها بيفتح السؤال (مربوطة فعلًا)', r.opScreenChipWired);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
