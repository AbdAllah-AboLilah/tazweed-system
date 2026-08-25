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
  // ⚠️ العدد **مش ثابت** عن قصد — التقسيم بقى بالحجم مش بعدد صفحات ثابت.
  // كان مكتوب هنا 60 بالظبط، وأول ما اتغيّر مقاس الخط في الملصق (فاتغيّر
  // حجم الصفحة بالبايت) الفحص وقع من غير ما يكون فيه عطل. اللي يهم:
  // كل رسالة تحت الحد، ومفيش وظيفة أكبر من 5 صفحات.
  check('⭐ اتقسّموا على وظايف صغيرة',
    sizes.messages >= Math.ceil(sizes.pages / 5) && sizes.maxBytes <= sizes.limit, sizes);
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
  pass.filter(x => x.includes('⭐')).forEach(x => console.log('   ' + x));

  // ============================================================
  // ⭐⭐⭐ الورقة اللي أطول من ورقة التعريف: **مانبعتش مقاس**
  // ============================================================
  // ده اتقاس على ورق حقيقي، مش تخمين. ورقة 324.1مم اتبعت للطابعة
  // بطول 359مم — و**اتطبع منها 294.4مم بس** (آخر صف كامل قبل 297،
  // وهو المقاس الافتراضي في تعريف الطابعة). ونفس الورقة اتطبعت مرتين
  // بطولين مختلفين واتقصّت في **نفس الصف بالظبط** — يعني الطول اللي
  // بنبعته مالوش أي أثر.
  //
  // اللي بيحصل فعلًا: لما نبعت مقاس، إحنا بنوقّف **التصغير التلقائي**
  // بتاع الدرايفر. فالورقة الطويلة بدل ما تصغّر وتخلص كاملة، بتتطبع
  // بحجمها وتتقص عند 297.
  //
  // فالقاعدة: بتدخل في الفورم → نبعت مقاسها. أطول منه → null (يعني
  // مانبعتش مقاس) والدرايفر يصغّرها. صغيرة وكاملة > كبيرة ومقصوصة.
  //
  // ⚠️ والقياس **لازم يتم على جهاز الطباعة** مش اللي بيبعت (درس v0.43.0).
  const sizing = await p.evaluate(async () => {
    const mk = (mm) => `<html><body style="margin:0"><div style="height:${mm}mm">و</div></body></html>`;
    return {
      short: await restockPageSize(mk(40)),
      fits: await restockPageSize(mk(280)),      // جوّه الفورم بالعافية
      over: await restockPageSize(mk(295)),      // +الهامش بيعدّي 297
      long: await restockPageSize(mk(400)),      // أطول بكتير
      formMm: RESTOCK_FORM_HEIGHT_MM,
      widthMm: RESTOCK_PAGE_WIDTH_MM,
    };
  });
  check('⭐ القصيرة بتاخد طولها هي (مفيش ورق ضايع)',
    sizing.short && sizing.short.height >= 42 && sizing.short.height <= 48, sizing.short);
  check('⭐ واللي بتدخل في الفورم بتاخد مقاسها',
    sizing.fits && sizing.fits.height <= 297 && sizing.fits.height >= 282, sizing.fits);
  check('⭐⭐ واللي بتعدّي الفورم → مافيش مقاس (الدرايفر يصغّرها)',
    sizing.over === null, sizing);
  check('⭐⭐ والورقة الطويلة (400مم) → مافيش مقاس، مش تتقص',
    sizing.long === null, sizing);
  check('⭐ والعرض 80مم زي الرول', sizing.short && sizing.short.width === 80, sizing);
  check('⭐ والحد مطابق للمقاس الافتراضي في تعريف الطابعة',
    sizing.formMm === 297, sizing);
  // ⚠️ الهامش لازم يفضل صغير: القياس طلع مطابق للورق في حدود صف واحد،
  // فأي هامش كبير = ورق أبيض ضايع في آخر كل ورقة.
  check('⭐ وهامش الطول صغير (≤ 6مم)',
    sizing.short && sizing.short.height - 40 <= 6, sizing.short);

  // ⚠️ ولازم القياس يبقى جوه tryPrintViaQZ (يعني على جهاز الطباعة)
  const coreSrc = require('fs').readFileSync(__dirname + '/../js/print-core.js', 'utf8');
  const inQZ = coreSrc.indexOf('async function tryPrintViaQZ');
  const useIdx = coreSrc.indexOf("size = await restockPageSize(");
  check('⭐⭐ القياس بيتم جوه tryPrintViaQZ (على جهاز الطباعة)',
    useIdx > inQZ && useIdx !== -1, { inQZ, useIdx });

  // ⚠️ والتقسيم بسبب الحجم لازم **يتقال** مش يحصل في سكوت
  const restockSrc = require('fs').readFileSync(__dirname + '/../js/print-restock.js', 'utf8');
  check('⭐⭐ التقسيم بسبب الحجم بيتقال للمستخدم',
    /showPrintNotice\(/.test(restockSrc) && /هتتقسّم على/.test(restockSrc), null);
  // ⚠️⚠️ ولازم يبقى تنبيه **مش موقّف**. الدرس اتاخد بالغالي في v0.34.1:
  // `alert`/`confirm` بتجمّد خيط الجافاسكريبت كله، والجهاز اللي بيستقبل
  // طباعة عن بُعد مافيش حد واقف عنده — فبيقف تمامًا وتقفل الطباعة عن
  // بُعد كلها.
  check('⭐⭐ ومفيش alert موقّف في مسار طباعة التزويد',
    !/\balert\(/.test(restockSrc), (restockSrc.match(/.*\balert\(.*/) || [])[0]);

  // ============================================================
  // ⭐⭐ الورقة لازم تقع جوه **المساحة اللي الطابعة بتطبعها فعلًا**
  // ============================================================
  // الطابعة 80مم بتطبع 72.1مم في النص بس (اسم التعريف "80(72.1)")،
  // يعني ~3.95مم من كل ناحية ورق مستحيل يتطبع عليه.
  //
  // اللي حصل على الورق فعلًا: الورقة عربي، فجسمها (66مم) كان بيتلزق في
  // حرف اليمين ويوصل لـ79.9مم. أول ما بقينا نبعت مقاس عرضه 80، آخر
  // 3.85مم وقعوا برّه رأس الطباعة و**أرقام أول عمود اتاكلت** — الخانات
  // بانت والأرقام لأ، وفراغ أبيض واسع على الشمال.
  //
  // الفحص ده بيرسم ورقة حقيقية بعرض 80مم بالظبط ويقيس أبعد نقطة فيها.
  const PRINTABLE_MM = 72.1;
  const edge = (80 - PRINTABLE_MM) / 2; // 3.95مم من كل ناحية
  const fit = await p.evaluate(async ([edgeMm]) => {
    const PX_MM = 96 / 25.4;
    const cat = { id: 'cf', name: 'مودال سفنجة', itemName: 'Hejap Kuwaiti 120', order: 1, colorGroups: ['سحاب', 'الوان'] };
    const grades = [];
    let id = 0;
    const add = (n, group, out) => grades.push({ id: 'g' + (++id), number: String(n), group, status: out ? 'out' : 'pending', branchQty: 0, mainQty: 1 });
    for (let n = 400; n <= 429; n++) add(n, 'سحاب', n % 3 === 0);
    for (let n = 34; n <= 99; n++) add(n, 'سحاب', n % 5 === 0);
    for (let n = 130; n <= 210; n++) add(n, 'الوان', n % 6 === 0);
    const html = buildRestockHTML(cat, grades, '', false);

    const f = document.createElement('iframe');
    f.style.cssText = 'position:absolute;left:-9999px;top:0;border:0;width:' + (80 * PX_MM) + 'px;height:10px;';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const d = f.contentDocument;
    f.style.height = d.body.scrollHeight + 'px';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const nums = [...d.querySelectorAll('.row .num')];
    const rows = [...d.querySelectorAll('.row')];
    const box = d.body.getBoundingClientRect();
    const res = {
      rows: rows.length,
      bodyLeftMm: +(box.left / PX_MM).toFixed(2),
      bodyRightMm: +(box.right / PX_MM).toFixed(2),
      numsRightMm: +(Math.max(...nums.map((n) => n.getBoundingClientRect().right)) / PX_MM).toFixed(2),
      rowsRightMm: +(Math.max(...rows.map((n) => n.getBoundingClientRect().right)) / PX_MM).toFixed(2),
      rowsLeftMm: +(Math.min(...rows.map((n) => n.getBoundingClientRect().left)) / PX_MM).toFixed(2),
      hasAutoMargin: /margin:\s*0\s+auto/.test(html),
    };
    f.remove();
    return res;
  }, [edge]);

  check('⭐⭐ جسم الورقة متظبّط في النص (margin: 0 auto)', fit.hasAutoMargin, fit);

  // ⚠️⚠️ الشرح بتاع الكود لازم يفضل **برّه** الورقة.
  // اللي حصل فعلًا وإحنا بنصلّح: حطينا شرح طويل جوه <style> — فراح
  // مع الورقة لـQZ (بيتحسب في حجم الرسالة، وحد التقسيم 44 كيلو)،
  // و**وقّع فحصين في batch5** كانوا بيدوّروا على كلمة "أبيض" جوه
  // الـHTML ولقوها في التعليق. الشرح مكانه فوق الدالة في جافاسكريبت.
  const sheetComments = await p.evaluate(() => {
    const cat = { id: 'cc', name: 'فئة', order: 1, colorGroups: ['مج'] };
    const grades = [{ id: 'x1', number: '1', group: 'مج', status: 'pending', branchQty: 0, mainQty: 1 }];
    const html = buildRestockHTML(cat, grades, '', false);
    const comments = html.match(/\/\*[\s\S]*?\*\//g) || [];
    return {
      bytes: new TextEncoder().encode(html).length,
      longest: comments.reduce((m, c) => Math.max(m, c.length), 0),
      count: comments.length,
    };
  });
  check('⭐⭐ مفيش شرح طويل متبعت جوه الورقة (الشرح مكانه في الكود)',
    sheetComments.longest <= 400, sheetComments);
  check('⭐⭐ ولا رقم بيعدّي حد الطباعة اليمين (76.05مم)',
    fit.numsRightMm <= 80 - edge, fit);
  check('⭐⭐ ولا خانة بتعدّي حد الطباعة اليمين',
    fit.rowsRightMm <= 80 - edge, fit);
  check('⭐⭐ ولا خانة بتعدّي حد الطباعة الشمال (3.95مم)',
    fit.rowsLeftMm >= edge, fit);
  check('⭐ والورقة متوازنة: الفراغ يمين ≈ الفراغ شمال',
    Math.abs((80 - fit.bodyRightMm) - fit.bodyLeftMm) < 0.5, fit);
  check('⭐ والصفوف كلها اترسمت', fit.rows === 30 + 66 + 81, fit);

  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
