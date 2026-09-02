// v0.27.1 — الشريط في صف واحد + الكيبورد مايتقفلش وقت الحفظ
// ⚠️⚠️ المحدِّد هنا كان `input[type="number"]`، وخانات الكميات اتغيّرت
// لـtype="text" (عشان type=number كان **بيمسح** الأرقام العربية قبل ما
// الكود يقراها). فالفحص بقى مش لاقي الخانة و**بيقع بخطأ** بدل ما يفحص.
//
// ⭐ الدرس: المحدِّد لازم يبقى على **الحاجة نفسها** (.qty-input) مش على
// تفصيلة في شكلها ممكن تتغيّر لسبب تاني خالص.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,220)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 375, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof renderFromData === 'function');

  const boot = () => p.evaluate(() => {
    const noop = () => () => {};
    const mk = () => ({ doc: () => ({ set:()=>Promise.resolve(), update:()=>Promise.resolve(), collection: mk, onSnapshot: noop, get:()=>Promise.resolve({exists:false}) }), get:()=>Promise.resolve({docs:[]}), where: mk, orderBy: mk, onSnapshot: noop, add:()=>Promise.resolve({}) });
    window.db = { collection: mk, collectionGroup: mk };
    state.user={uid:'me'}; state.profile={name:'AboLilah',role:'admin',warehouseAccess:'both'};
    state.view='dashboard'; state.screen='sheets'; state.isOnline=true; state.hasPendingWrites=false;
    state.categories=[{id:'c1',name:'حجاب سوري وطباقيه',order:1,minQty:0}];
    state.activeCategoryId='c1';
    state.grades=[{id:'g1',number:1,branchQty:2,mainQty:5,status:'normal'},
                  {id:'g2',number:2,branchQty:3,mainQty:5,status:'normal'}];
    state.pendingByCategory={}; state.pendingCount=0; state.outByCategory={}; state.outCount=0; state.lowStockByCategory={};
    state.undoCount=2; state.undoStack=[{label:'x'}];
    render();
  });
  await boot();

  // ---------- الشريط في صف واحد ----------
  const rows = await p.evaluate(() => {
    const out = {};
    // "صف واحد" = كل أجزاء الشريط بتتقاطع رأسيًا مع بعض.
    // (مقارنة الـtop لوحدها مابتنفعش: العناصر مركّزة رأسيًا وارتفاعاتها
    //  مختلفة، فالـtop بيختلف وهما في نفس الصف.)
    window.__rowsOf = (sel) => {
      const kids = [...document.querySelector(sel).children].filter(k => k.getBoundingClientRect().height > 0);
      const bands = [];
      kids.forEach(k => {
        const r = k.getBoundingClientRect();
        const hit = bands.find(bd => r.top < bd.bottom - 2 && r.bottom > bd.top + 2);
        if (hit) { hit.top = Math.min(hit.top, r.top); hit.bottom = Math.max(hit.bottom, r.bottom); }
        else bands.push({ top: r.top, bottom: r.bottom });
      });
      return bands.length;
    };
    const measure = () => {
      const bar = document.querySelector('.topbar');
      return {
        h: +bar.getBoundingClientRect().height.toFixed(0),
        rows: window.__rowsOf('.topbar'),
        name: !!bar.querySelector('.topbar-name'),
        role: !!bar.querySelector('.topbar-role'),
      };
    };
    out.calm = measure();
    state.hasPendingWrites = true;
    state.grades = state.grades.map(g => ({ ...g, status: 'pending', branchQty: 0 }));
    render();
    out.busy = measure();
    return out;
  });
  check('⭐ الشريط صف واحد في الحالة العادية', rows.calm.rows === 1, rows.calm);
  check('⭐ الشريط صف واحد وهو مزحوم (بيرفع + نقطة + تراجع)', rows.busy.rows === 1, rows.busy);
  check('الارتفاع مابيتغيّرش', rows.calm.h === rows.busy.h, rows);
  check('الاسم لسه ظاهر', rows.calm.name, rows.calm);
  await boot();

  const across = await p.evaluate(async () => {
    const out = {};
    for (const w of [360, 375, 390, 430, 768, 1366]) {
      await new Promise(r => { document.documentElement.style.width = ''; r(); });
      out[w] = null;
    }
    return out;
  });

  const widths = {};
  for (const w of [320, 360, 375, 390, 430, 768, 1366]) {
    await p.setViewportSize({ width: w, height: 800 });
    widths[w] = await p.evaluate(() => {
      state.hasPendingWrites = true; render();
      const bar = document.querySelector('.topbar');
      return { rows: window.__rowsOf('.topbar'), h: +bar.getBoundingClientRect().height.toFixed(0) };
    });
  }
  check('⭐ صف واحد على كل العروض', Object.values(widths).every(v => v.rows === 1), widths);
  await p.setViewportSize({ width: 375, height: 800 });
  await boot();

  // ---------- الكيبورد: الرسم بيتأجّل والمستخدم بيكتب ----------
  const typing = await p.evaluate(async () => {
    // نلاقي أي خانة رقم في الجدول
    const input = document.querySelector('.qty-input');
    if (!input) return { noInput: true };
    input.focus();
    const before = input;

    // ⚠️⚠️ لازم البيانات **تتغيّر فعلًا** مع التبليغ.
    // من v0.71.3 الشاشة ماتتهدّش لما مافيش حاجة اتغيّرت، فلو ندهنا الرسم
    // والبيانات زي ما هي، الخانة بتفضل موجودة **من غير أي فضل للحارس** —
    // والفحص بيعدّي وهو مش بيفحص حاجة (اتأكدنا بالتخريب: شيلنا الحارس
    // والفحص عدّى 11/11).
    // تبليغ جاي من السحابة (زي تأكيد السيرفر بعد ثانيتين)
    state.hasPendingWrites = false;
    state.categories[0].name = 'فئة من السحابة ٩٩';
    renderFromData();

    const after = document.querySelector('.qty-input');
    const stillFocused = document.activeElement === after;
    const sameEl = before === after;

    // ولما يسيب الخانة، الرسم المتأجّل بيتنفّذ
    input.blur();
    await new Promise(r => setTimeout(r, 250));
    const flushed = !dataRenderPending;
    return { sameEl, stillFocused, flushed, isTyping: false };
  });
  check('⭐ الخانة مااتهدّتش والتبليغ جاي من السحابة', typing.sameEl, typing);
  check('⭐ المؤشر فضل في الخانة (الكيبورد مايتقفلش)', typing.stillFocused, typing);
  check('الرسم المتأجّل بيتنفّذ أول ما تسيب الخانة', typing.flushed, typing);

  // ============================================================
  // ⚠️⚠️ الفحصين دول كانوا بيقيسوا **هوية العنصر** (اتبنى من جديد ولا لأ)
  // ============================================================
  // ومن v0.71.3 الشاشة بقت **ماتتهدّش** لما مافيش حاجة اتغيّرت — ده
  // المقصود مش عطل. فالقياس القديم بقى بيفشل على سلوك سليم.
  //
  // ⭐ الصح إننا نقيس **اللي عايزينه فعلًا**: إن الرسم حصل (الشاشة بقت
  // بتوري البيانات الجديدة) وإنه **مااتأجّلش**. ده بيفضل صح مهما اتغيّرت
  // طريقة الرسم من جوّه.
  // الرسم اللي انت طلبته بنفسك بيتنفّذ فورًا حتى والخانة مفتوحة
  const direct = await p.evaluate(() => {
    const input = document.querySelector('.qty-input');
    input.focus();
    state.categories[0].name = 'فئة مباشرة ٧٧';
    render();                       // زي ما بيحصل لما تضغط زرار
    const showed = document.getElementById('root').textContent.indexOf('فئة مباشرة ٧٧') !== -1;
    input.blur();
    return { showed, pending: dataRenderPending };
  });
  check('الرسم اللي انت طلبته بيتنفّذ فورًا (مش متأجّل)', direct.showed && !direct.pending, direct);

  // مفيش تأجيل لو مفيش حد بيكتب
  const idle = await p.evaluate(() => {
    document.activeElement && document.activeElement.blur();
    state.categories[0].name = 'فئة ساكنة ٨٨';
    renderFromData();
    const showed = document.getElementById('root').textContent.indexOf('فئة ساكنة ٨٨') !== -1;
    return { showed, pending: dataRenderPending };
  });
  check('من غير كتابة: التبليغ بيترسم على طول', idle.showed && !idle.pending, idle);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);
  console.log('\n✅ نجح (' + pass.length + ')');
  pass.filter(x => x.includes('⭐')).forEach(x => console.log('   ' + x));
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
