// v0.27.2 — ورق المجموعات، حجم رسالة الطباعة، الكيبورد من كل المصادر
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,260)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildRestockBundle === 'function');

  const boot = () => p.evaluate(() => {
    const noop = () => () => {};
    const mk = () => ({ doc: () => ({ set:()=>Promise.resolve(), update:()=>Promise.resolve(), collection: mk, onSnapshot: noop, get:()=>Promise.resolve({exists:false}) }), get:()=>Promise.resolve({docs:[]}), where: mk, orderBy: mk, onSnapshot: noop, add:()=>Promise.resolve({}) });
    window.db = { collection: mk, collectionGroup: mk };
    state.user={uid:'me'}; state.profile={name:'AboLilah',role:'admin',warehouseAccess:'both'};
    state.view='dashboard'; state.screen='sheets'; state.isOnline=true; state.hasPendingWrites=false;
    state.categories=[{ id:'c1', name:'كريب سادة', order:1, minQty:0, colorGroups:['بيجات','الوان'] }];
    state.activeCategoryId='c1';
    state.grades=[];
    for (let i=1;i<=5;i++)  state.grades.push({ id:'b'+i, number:i, group:'بيجات', branchQty:0, mainQty:3, status:'pending' });
    for (let i=1;i<=7;i++)  state.grades.push({ id:'l'+i, number:i, group:'الوان',  branchQty:0, mainQty:3, status:'pending' });
    state.pendingByCategory={}; state.pendingCount=0; state.outByCategory={}; state.outCount=0; state.lowStockByCategory={};
    render();
  });
  await boot();

  // ---------- 1) ورق المجموعات ----------
  const groups = await p.evaluate(async () => {
    const cat = state.categories[0];
    const out = {};
    // القيمة اللي بتخرج من الشاشة فعلًا (مش اللي إحنا فاكرينها)
    const promise = chooseRestockGroup(cat, state.grades);
    await new Promise(r => setTimeout(r, 60));
    const btns = [...document.querySelectorAll('[data-rg-mode]')].map(b => ({
      mode: b.getAttribute('data-rg-mode'), name: b.getAttribute('data-rg-name'),
      txt: b.textContent.replace(/\s+/g,' ').trim(),
    }));
    out.buttons = btns;
    document.querySelector('[data-rg-mode="each"]').click();
    const value = await promise;
    out.value = value;
    out.isSentinel = value.group === RESTOCK_EACH_GROUP;
    out.hasReplacementChar = /�/.test(String(value.group));

    const names = restockGroupNames(cat, state.grades);
    out.names = names;
    const bundle = buildRestockBundle(cat, state.grades, names);
    out.count = bundle.count;
    out.jobs = bundle.jobs.length;
    // كل ورقة لازم تبقى فيها درجاتها فعلًا
    // الصفوف divs مش جدول — بنعدّها من الـclass الحقيقي
    out.rows = bundle.jobs.map(j => (j.html.match(/class="row"/g) || []).length);
    out.titles = bundle.jobs.map(j => {
      const m = j.html.match(/class="tab-name"[^>]*>([\s\S]*?)<\//i);
      return m ? m[1].replace(/\s+/g,' ').trim() : '';
    });
    out.previewHasBoth = /بيجات/.test(bundle.previewHTML) && /الوان/.test(bundle.previewHTML);
    out.previewBad = /�/.test(bundle.previewHTML);
    return out;
  });
  check('زراير الاختيار بقت بـmode مش بقيمة خام', groups.buttons.every(b => ['all','each','one'].includes(b.mode)), groups.buttons);
  check('⭐ اختيار "كل مجموعة لوحدها" بيرجّع القيمة الصح', groups.isSentinel, groups);
  check('⭐ مفيش محرف مكسور (�) في القيمة', !groups.hasReplacementChar, groups);
  check('المجموعتين اتعرفوا', groups.names.length === 2, groups.names);
  check('⭐ ورقتين اتولّدوا', groups.count === 2 && groups.jobs === 2, groups);
  check('⭐ الورق مش فاضي — كل ورقة فيها درجاتها', groups.rows.length === 2 && groups.rows.every(r => r > 0), groups.rows);
  check('عدد الصفوف مطابق لعدد الدرجات', JSON.stringify(groups.rows) === JSON.stringify([5,7]), groups.rows);
  check('⭐ المعاينة فيها المجموعتين', groups.previewHasBoth, groups);
  check('⭐ مفيش محرف مكسور في المعاينة', !groups.previewBad, groups);
  check('عنوان كل ورقة فيه اسم مجموعتها',
    groups.titles.length === 2 && /بيجات/.test(groups.titles[0]) && /الوان/.test(groups.titles[1]), groups.titles);

  // اختيار مجموعة واحدة لسه شغّال
  const one = await p.evaluate(async () => {
    const promise = chooseRestockGroup(state.categories[0], state.grades);
    await new Promise(r => setTimeout(r, 60));
    document.querySelector('[data-rg-mode="one"][data-rg-name="الوان"]').click();
    return await promise;
  });
  check('اختيار مجموعة واحدة بيرجّع اسمها', one.group === 'الوان', one);

  const all = await p.evaluate(async () => {
    const promise = chooseRestockGroup(state.categories[0], state.grades);
    await new Promise(r => setTimeout(r, 60));
    document.querySelector('[data-rg-mode="all"]').click();
    return await promise;
  });
  check('"الورقة كلها" بترجّع نص فاضي', all.group === '', all);

  // ---------- 2) حجم رسالة الطباعة ----------
  const sizes = await p.evaluate(async () => {
    const sent = [];
    window.qz = {
      configs: { create: (n, o) => ({ printer: n, opts: o }) },
      print: (cfg, data) => { sent.push(data); return Promise.resolve(); },
      websocket: { connect: () => Promise.resolve() },
      security: { setCertificatePromise(){}, setSignatureAlgorithm(){}, setSignaturePromise(){} },
    };
    window.isQZAvailable = () => true;
    window.ensureQZConnected = () => Promise.resolve(true);
    localStorage.setItem('tazweed_qz_label_printer', 'Xprinter XP-233B');

    const url = await generateQRDataURL('62808737', 200);
    const html = buildLabelHTML({ itemName:'Chanvie Leen 58047', barcodeNumber:'62808737', originalPrice:620, sellingPrice:495 },
                                { pageWidthMm:38, pageHeightMm:25, halves:2 }, url, 1);
    const ok = await tryPrintViaQZ('label', [{ html, copies: 300 }], { pageWidthMm:38, pageHeightMm:25 });
    const bytesOf = (arr) => arr.reduce((s, pg) => s + pg.data.length, 0);
    return {
      ok,
      messages: sent.length,
      pages: sent.reduce((s, m) => s + m.length, 0),
      maxBytes: Math.max(...sent.map(bytesOf)),
      limit: QZ_MAX_MESSAGE_BYTES,
      maxCopies: MAX_LABEL_COPIES,
      allHTML: sent.every(m => m.every(pg => pg.type === 'pixel' && pg.format === 'html' && typeof pg.data === 'string')),
    };
  });
  // من v0.28.2 الـ300 ملصق بيتقسّموا على وظايف صغيرة ورا بعض — ده أهم
  // إصلاح في "الأمر مايوصلش للطابعة".
  check('⭐ 300 ملصق اتبعتوا كلهم', sizes.pages === 300, sizes);
  check('⭐ اتقسّموا على وظايف صغيرة', sizes.messages === 60, sizes);
  check('⭐ مفيش رسالة عدّت الحد', sizes.maxBytes <= sizes.limit, sizes);
  check('الحد 48 كيلو', sizes.limit === 48 * 1024, sizes.limit);
  check('الأقصى بقى 1000', sizes.maxCopies === 1000, sizes.maxCopies);
  check('كل صفحة لسه HTML مش نص خام', sizes.allHTML, sizes);

  // شريط التقدّم بيقفل لوحده
  const prog = await p.evaluate(() => ({ open: document.querySelectorAll('#pp-bar').length }));
  check('شريط التقدّم اتقفل بعد ما خلص', prog.open === 0, prog);

  // ---------- 3) الكيبورد: كل مصادر التبليغ ----------
  await boot();
  const kb = await p.evaluate(async () => {
    const input = document.querySelector('input[type="number"]');
    if (!input) return { noInput: true };
    input.focus();
    const before = input;
    const results = {};
    // كل المصادر اللي بتوصل من السحابة
    renderIfOpen();                                  // ملخّص النواقص (أكتر واحد بيضرب)
    results.afterOverview = document.querySelector('input[type="number"]') === before;
    state.users = []; renderFromData();
    results.afterUsers = document.querySelector('input[type="number"]') === before;
    state.activityLog = []; renderFromData();
    results.afterLog = document.querySelector('input[type="number"]') === before;
    results.stillFocused = document.activeElement === before;
    input.blur();
    await new Promise(r => setTimeout(r, 250));
    results.flushed = !dataRenderPending;
    return results;
  });
  check('⭐ ملخّص النواقص مابيهدّش الخانة', kb.afterOverview, kb);
  check('⭐ تحديث الحسابات مابيهدّش الخانة', kb.afterUsers, kb);
  check('⭐ سجل العمليات مابيهدّش الخانة', kb.afterLog, kb);
  check('⭐ المؤشر فضل في الخانة', kb.stillFocused, kb);
  check('الرسم المتأجّل بيتنفّذ بعد ما تسيبها', kb.flushed, kb);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);
  console.log('\n✅ نجح (' + pass.length + ')');
  pass.filter(x => x.includes('⭐')).forEach(x => console.log('   ' + x));
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
