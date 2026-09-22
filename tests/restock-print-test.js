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
    // ⚠️⚠️ المحدِّد ده كان `input[type="number"]` — وخانات الكميات
    // اتغيّرت لـtype="text" (عشان type=number كان **بيمسح** الأرقام
    // العربية قبل ما الكود يقراها). فالفحص فضل يدوّر على حاجة مابقتش
    // موجودة، ورجع noInput وفشل — من غير ما يكون فيه أي عطل حقيقي.
    //
    // ⭐ الدرس: المحدِّد لازم يبقى على **الحاجة نفسها** (.qty-input) مش
    // على تفصيلة في شكلها ممكن تتغيّر لسبب تاني خالص.
    const input = document.querySelector('.qty-input');
    if (!input) return { noInput: true };
    input.focus();
    const before = input;
    const results = {};
    // ⚠️⚠️ لازم البيانات **تتغيّر فعلًا** مع كل نداء.
    //
    // من v0.71.3 تعديل الكمية بيتحدّث في مكانه من غير ما الشاشة تتهدّ.
    // فلو ندهنا الرسم والبيانات زي ما هي، الخانة بتفضل موجودة **من غير
    // أي فضل للحارس** — والفحص بيعدّي وهو مش بيفحص حاجة.
    //
    // اتأكدنا من ده بالتخريب: شيلنا حارس "المستخدم بيكتب" والفحص عدّى
    // 41/41. فالتغيير تحت مقصود — بيجبر الشاشة على رسمة كاملة، واللي
    // بيمنعها ساعتها هو الحارس وبس.
    let tick = 0;
    const touchData = () => {
      tick++;
      state.categories[0].name = 'كريب سادة ' + tick;   // بيغيّر شكل الشاشة
    };
    // كل المصادر اللي بتوصل من السحابة
    touchData();
    renderIfOpen();                                  // ملخّص النواقص (أكتر واحد بيضرب)
    results.afterOverview = document.querySelector('.qty-input') === before;
    touchData();
    state.users = []; renderFromData();
    results.afterUsers = document.querySelector('.qty-input') === before;
    touchData();
    state.activityLog = []; renderFromData();
    results.afterLog = document.querySelector('.qty-input') === before;
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
  // ⭐⭐⭐ ورقة التزويد **مابيتبعتش معاها مقاس**. ماترجّعهاش.
  // ============================================================
  // جرّبناها ورجعنا عنها بعد تلات طبعات على ورق:
  //   • العرض 80 → أرقام أول عمود اتاكلت (رأس الطباعة 72.1 بس)
  //   • ظبطنا العرض → الورقة اتقصّت من تحت عند 297 بالظبط
  //   • نفس الورقة بطولين مختلفين اتقصّت في نفس الصف → الطابعة أصلًا
  //     مابتاخدش الطول اللي بنبعتهولها
  // بعت المقاس مابيدّيش ورقة أطول، هو بس بيوقّف التصغير التلقائي.
  // وصاحب النظام قرّر: "نرجّع الطباعة زي الأول وانا استحمل التصغير".
  const coreSrc = require('fs').readFileSync(__dirname + '/../js/print-core.js', 'utf8');
  const qzStart = coreSrc.indexOf('async function tryPrintViaQZ');
  const qzBody = coreSrc.slice(qzStart);
  check('⭐⭐⭐ مافيش أي مقاس بيتحسب لورقة التزويد',
    !/restockPageSize/.test(coreSrc), (coreSrc.match(/.*restockPageSize.*/) || [])[0]);
  check('⭐⭐ ومافيش قياس لطول الورقة أصلًا',
    !/measureHTMLHeightMm/.test(coreSrc), (coreSrc.match(/.*measureHTMLHeightMm.*/) || [])[0]);
  // المقاس الوحيد اللي بيتبعت هو اللي جاي من الملصق (sizeOptions)
  check('⭐ المقاس بيجي من الملصق بس (sizeOptions)',
    /sizeOptions && sizeOptions\.pageWidthMm/.test(qzBody), null);
  // ⚠️ والسبب لازم يفضل مكتوب في الكود عشان ماترجعش الفكرة
  check('⭐ والسبب متسجّل في الكود (294.4 / 297)',
    /294\.4/.test(coreSrc) && /مابنبعتش مقاس/.test(coreSrc), null);

  // ============================================================
  // ⭐⭐ الرجوع لنافذة المتصفح لازم يتقال، مش يحصل في سكوت
  // ============================================================
  // نافذة طباعة ويندوز فتحت على الكمبيوتر فجأة ولازم حد يدوس "طباعة"،
  // والمستخدم افتكر إن النظام باظ. السبب كان متسجّل في lastPrintOutcome
  // بس محدش بيشوفه.
  const deliverSrc = coreSrc.slice(coreSrc.indexOf('async function deliverPrint'),
                                   coreSrc.indexOf('async function sendPrintJob'));
  check('⭐⭐ الرجوع لنافذة المتصفح بيتقال للمستخدم',
    /showPrintNotice\(/.test(deliverSrc), null);
  check('⭐⭐ والسبب بيتقال معاه (lastPrintOutcome)',
    /lastPrintOutcome/.test(deliverSrc), null);
  check('⭐⭐ والتنبيه مش موقّف (مافيش alert قبل فتح النافذة)',
    deliverSrc.indexOf('showPrintNotice(') < deliverSrc.indexOf("window.open("), null);

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

  // ============================================================
  // 🔢 الكمية على ورقة التزويد — مفتاح لكل حساب
  // ============================================================
  // اتطلب بالنص: "مفتاح افتحه ل اللي انا عاوزه ... اطبع الكمية اللي
  // موجوده عندي في الفرع او المخزن الرئيسي او الاتنين مع بعض".
  //
  // ⚠️⚠️ أهم تلات فحوص هنا:
  //   ١) المفتاح مقفول = الورقة **زي ما كانت بالظبط** — ولا حرف زيادة
  //   ٢) مساحة الكتابة **مابتصغرش** عن النهارده (ده الشرط اللي اتوافق عليه)
  //   ٣) الورقة لسه جوه حدود الطباعة (3.95مم من كل ناحية)
  const qty = await p.evaluate(async ([edgeMm]) => {
    const PX_MM = 96 / 25.4;
    const out = {};
    const cat = { id: 'cq', name: 'كريب', itemName: 'كريب سادة', colorGroups: ['كيوي', 'نصار'] };
    const grades = [];
    // ⚠️ كميات لحد 3 خانات: الرقم الطويل هو اللي بيزق خانة الكتابة
    for (let n = 1; n <= 40; n++) grades.push({ id: 'q' + n, number: n, group: n % 2 ? 'كيوي' : 'نصار',
      branchQty: (n * 3) % 13, mainQty: (n * 37) % 140, status: 'normal' });
    grades.push({ id: 'w', number: -3, name: 'أبيض', isBase: true, group: 'كيوي', branchQty: 2, mainQty: 1, status: 'normal' });
    // ⚠️ درجة من غير كميات خالص — لازم تتكتب "–" مش "0"
    grades.push({ id: 'nq', number: 99, group: 'كيوي', status: 'normal' });
    // ⚠️ ودرجة خلصت فعلًا — لازم تتكتب "0"
    grades.push({ id: 'z', number: 98, group: 'كيوي', branchQty: 0, mainQty: 0, status: 'out' });

    // ⚠️ withQty = true دايمًا هنا: الفحص ده بيختبر **مفتاح الحساب**. لو
    // الحساب مقفول، حتى الطبعة اللي طالبة كميات لازم تطلع عادية.
    const build = (mode, withBase) => {
      state.profile = { name: 'a', role: 'owner' };
      if (mode !== undefined) state.profile.restockQty = mode;
      return buildRestockHTML(cat, grades, '', !!withBase, '', true);
    };

    // (١) مقفول بكل أشكاله = نفس الورقة بالحرف، ومافيهاش أي أثر للميزة
    const off = build(undefined, true);
    // ⚠️⚠️ البوابة التانية: الحساب مفتوح بس الطبعة ماطلبتش صراحةً
    state.profile = { name: 'a', role: 'owner', restockQty: 'both' };
    out.openButNotAsked = off === buildRestockHTML(cat, grades, '', true, '');
    out.openButFalse = off === buildRestockHTML(cat, grades, '', true, '', false);
    out.offSameEmpty = off === build('', true);
    out.offSameJunk = off === build('كلام', true);
    out.offNoTrace = !/class="qty|column-count:3|الرقم جنب الدرجة|الرقمين جنب/.test(off);

    // (٢) الأشكال التلاتة
    const br = build('branch', true), mn = build('main', true), bo = build('both', true);
    const cellsOf = (html) => {
      const d = new DOMParser().parseFromString(html, 'text/html');
      return [...d.querySelectorAll('.row')].map((r) => ({
        num: (r.querySelector('.num') || {}).textContent,
        qty: [...r.querySelectorAll('.qty i')].map((i) => i.textContent),
      }));
    };
    const find = (cells, num) => cells.find((c) => c.num === String(num));
    const cb = cellsOf(br), cm = cellsOf(mn), cc = cellsOf(bo);
    out.branch7 = find(cb, 7).qty;      // (7*3)%13 = 8
    out.main7 = find(cm, 7).qty;        // (7*37)%140 = 119
    out.both7 = find(cc, 7).qty;        // [8, 119] — الفرع الأول
    out.baseQty = find(cc, 'أبيض').qty; // [2, 1]
    out.noQty = find(cc, 99).qty;       // [–, –]
    out.zero = find(cc, 98).qty;        // [0, 0]
    out.legendBranch = /كمية الفرع/.test(br);
    out.legendBoth = /فوق = الفرع، تحت = الرئيسي/.test(bo);
    out.bothStacked = /qty-both/.test(bo) && /flex-direction:column/.test(bo);
    // ⚠️ مافيش تعليقات في التنسيقات **اللي الميزة دي ضافتها** — دي
    // بتروح لـQZ كنص. (التنسيقات القديمة فيها تعليقات من قبل كده،
    // والفحص مش بتاعها.)
    out.noCssComments = !/\/\*/.test(RESTOCK_QTY_CSS);

    // (٣) القياس على ورقة مرسومة بعرض 80مم
    const measure = async (html) => {
      const f = document.createElement('iframe');
      f.style.cssText = 'position:absolute;left:-9999px;top:0;border:0;width:' + (80 * PX_MM) + 'px;height:10px;';
      document.body.appendChild(f);
      f.contentDocument.open(); f.contentDocument.write(html.replace(/<script[\s\S]*?<\/script>/g, '')); f.contentDocument.close();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const d = f.contentDocument;
      f.style.height = d.body.scrollHeight + 'px';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const rows = [...d.querySelectorAll('.grid:not(.base-grid) .row')];
      const blanks = rows.map((r) => r.querySelector('.blank').getBoundingClientRect().width);
      const all = [...d.querySelectorAll('.row')];
      const res = {
        cols: getComputedStyle(d.querySelector('.grid:not(.base-grid)')).columnCount,
        baseCols: d.querySelector('.base-grid') ? getComputedStyle(d.querySelector('.base-grid')).columnCount : null,
        blankMinMm: +(Math.min(...blanks) / PX_MM).toFixed(2),
        rightMm: +(Math.max(...all.map((n) => n.getBoundingClientRect().right)) / PX_MM).toFixed(2),
        leftMm: +(Math.min(...all.map((n) => n.getBoundingClientRect().left)) / PX_MM).toFixed(2),
      };
      f.remove();
      return res;
    };
    out.mOff = await measure(off);
    out.mBranch = await measure(br);
    out.mMain = await measure(mn);
    out.mBoth = await measure(bo);
    return out;
  }, [edge]);

  check('⭐⭐⭐ المفتاح مقفول = الورقة زي ما كانت بالحرف (مش موجود / فاضي / كلام غلط)',
    qty.offSameEmpty && qty.offSameJunk, qty);
  check('⭐⭐⭐ والورقة المقفولة مافيهاش أي أثر للميزة (ولا كلاس ولا تنسيق ولا سطر)',
    qty.offNoTrace, qty);
  check('⭐⭐⭐ الحساب مفتوح بس الطبعة ماطلبتش الكميات → الورقة العادية بالحرف',
    qty.openButNotAsked && qty.openButFalse, qty);
  check('⭐⭐⭐ الفرع: الكمية جنب الدرجة هي كمية الفرع', JSON.stringify(qty.branch7) === '["8"]', qty.branch7);
  check('⭐⭐⭐ الرئيسي: كمية الرئيسي', JSON.stringify(qty.main7) === '["119"]', qty.main7);
  check('⭐⭐⭐ الاتنين: الفرع الأول (فوق) والرئيسي تاني (تحت)',
    JSON.stringify(qty.both7) === '["8","119"]', qty.both7);
  check('⭐⭐ والدرجة الأساسية كمان', JSON.stringify(qty.baseQty) === '["2","1"]', qty.baseQty);
  check('⭐⭐⭐ الدرجة اللي مالهاش كميات بتتكتب "–" مش "0"', JSON.stringify(qty.noQty) === '["–","–"]', qty.noQty);
  check('⭐⭐ والصفر الحقيقي بيتكتب "0"', JSON.stringify(qty.zero) === '["0","0"]', qty.zero);
  check('⭐⭐ وسطر في راس الورقة بيقول الرقم ده إيه', qty.legendBranch && qty.legendBoth, qty);
  check('⭐⭐ والاتنين فوق بعض مش جنب بعض', qty.bothStacked, qty);
  check('⭐⭐ ومافيش تعليقات في التنسيقات اللي بتروح لـQZ', qty.noCssComments, qty);

  check('⭐ مقفول: 4 أعمدة زي الأول', String(qty.mOff.cols) === '4', qty.mOff);
  check('⭐⭐ مفتوح: 3 أعمدة', String(qty.mBranch.cols) === '3' && String(qty.mBoth.cols) === '3', [qty.mBranch, qty.mBoth]);
  // ⚠️⚠️ شبكة الأساسية فيها الكلاسين، و.grid{column-count:3} لو اتكتبت
  // من غير :not(.base-grid) كانت هتكسب .base-grid{column-count:2}
  check('⭐⭐⭐ وشبكة الأسماء الأساسية فاضلة عمودين', String(qty.mBoth.baseCols) === '2', qty.mBoth);

  // ⚠️⚠️⚠️ الشرط اللي الميزة كلها اتوافق عليه
  const today = qty.mOff.blankMinMm;
  check('⭐⭐⭐ الفرع: مساحة الكتابة مابتصغرش عن النهارده', qty.mBranch.blankMinMm >= today, [today, qty.mBranch]);
  check('⭐⭐⭐ الرئيسي: مساحة الكتابة مابتصغرش عن النهارده', qty.mMain.blankMinMm >= today, [today, qty.mMain]);
  check('⭐⭐⭐ الاتنين: مساحة الكتابة مابتصغرش عن النهارده', qty.mBoth.blankMinMm >= today, [today, qty.mBoth]);

  // ⚠️⚠️ وحدود الطباعة — نفس القياس اللي فوق للورقة العادية
  [['الفرع', qty.mBranch], ['الرئيسي', qty.mMain], ['الاتنين', qty.mBoth]].forEach(([n, m]) => {
    check(`⭐⭐⭐ ${n}: الورقة جوه حدود الطباعة من الناحيتين`,
      m.rightMm <= 80 - edge && m.leftMm >= edge, m);
  });

  // ============================================================
  // 🔢 اختيار "من غير كميات" للطبعة دي بس
  // ============================================================
  // اتطلب بالنص: "لما افتحه يبقي في اوبشن بردوا اني اطبع ورقة التزويد
  // عاديه من غير كميات والمفتاح مفتوح".
  const dlg = await p.evaluate(async () => {
    const out = {};
    const realShared = window.getSharedPrintSettings, realSave = window.saveSharedPrintSettings;
    window.getSharedPrintSettings = () => ({});
    window.saveSharedPrintSettings = () => Promise.resolve();
    const cat = { id: 'cd', name: 'شيفون' };   // ⚠️ من غير مجموعات ولا أساسية
    const grades = [{ id: 'a', number: 1, branchQty: 3, mainQty: 9, status: 'normal' },
                    { id: 'b', number: 2, branchQty: 5, mainQty: 1, status: 'normal' }];
    const tick = () => new Promise((x) => setTimeout(x, 40));

    // (١) مقفول ومافيش اختيارات → مافيش شاشة خالص (زي الأول بالظبط)
    state.profile = { name: 'a', role: 'owner' };
    const c0 = await chooseRestockGroup(cat, grades);
    out.offNoDialog = !document.getElementById('rg-with-qty') && c0 && c0.withQty === false;

    // (٢) مفتوح → الشاشة بتظهر عشانه، والعلامة **مشالة**
    state.profile = { name: 'a', role: 'owner', restockQty: 'branch' };
    let pr = chooseRestockGroup(cat, grades);
    await tick();
    const box = document.getElementById('rg-with-qty');
    out.shown = !!box;
    out.uncheckedByDefault = !!box && box.checked === false;
    out.noFakeGroupHint = document.body.textContent.indexOf('اسم المجموعة هيتكتب') === -1;
    document.querySelector('[data-rg-mode="all"]').click();
    const c1 = await pr;
    out.defaultPlain = c1.withQty === false;
    const plain = buildRestockHTML(cat, grades, c1.group, c1.withBase, c1.filterMode, c1.withQty);
    const bundlePlain = buildRestockBundle(cat, grades, [''], c1.withBase, c1.filterMode, c1.withQty).jobs[0].html;

    // (٣) علّم عليها → الطبعة دي بكميات
    pr = chooseRestockGroup(cat, grades);
    await tick();
    document.getElementById('rg-with-qty').click();
    document.querySelector('[data-rg-mode="all"]').click();
    const c2 = await pr;
    out.ticked = c2.withQty === true;
    out.tickedSheetHasQty = /class="qty/.test(buildRestockHTML(cat, grades, c2.group, c2.withBase, c2.filterMode, c2.withQty));

    state.profile = { name: 'a', role: 'owner' };
    const trulyOff = buildRestockHTML(cat, grades, '', false, '');
    out.plainIdentical = plain === trulyOff;
    out.bundlePlainIdentical = bundlePlain === trulyOff;

    // (٤) ⚠️⚠️ مابيتحفظش — حتى بعد ما علّمت عليها، المرة الجاية مشالة
    state.profile = { name: 'a', role: 'owner', restockQty: 'branch' };
    pr = chooseRestockGroup(cat, grades);
    await tick();
    out.uncheckedAgain = document.getElementById('rg-with-qty').checked === false;
    document.querySelector('[data-rg-cancel]').click();
    await pr;

    window.getSharedPrintSettings = realShared;
    window.saveSharedPrintSettings = realSave;

    // ============================================================
    // (٥) ⚠️⚠️ النت مقطوع: المفتاح لازم يفضل مفتوح
    // ============================================================
    // النسخة المحلية من الحساب بتشيل أي حقل مش مكتوب في
    // saveProfileLocally. من غير السطر ده، الورقة بتطلع من غير كميات
    // أول ما النت يقطع — في سكوت.
    saveProfileLocally('u-off', { name: 'x', role: 'owner', restockQty: 'both' });
    out.offlineKeeps = (loadProfileLocally('u-off') || {}).restockQty === 'both';
    saveProfileLocally('u-off', { name: 'x', role: 'owner', restockQty: '<script>' });
    out.offlineJunkDropped = (loadProfileLocally('u-off') || {}).restockQty === '';
    clearProfileLocally('u-off');
    return out;
  });
  check('⭐⭐⭐ المفتاح مقفول: مافيش شاشة زيادة (نفس الدوسة زي الأول)', dlg.offNoDialog, dlg);
  check('⭐⭐⭐ المفتاح مفتوح: الشاشة بتسأل، والعلامة **مشالة** افتراضيًا', dlg.shown && dlg.uncheckedByDefault, dlg);
  check('⭐ ومافيش سطر "اسم المجموعة" لفئة مالهاش مجموعات', dlg.noFakeGroupHint, dlg);
  check('⭐⭐⭐ ماعلّمتش → الورقة العادية **بالحرف**', dlg.defaultPlain && dlg.plainIdentical, dlg);
  check('⭐⭐⭐ ونفس الحاجة لما الورقة تتقسم مجموعات', dlg.bundlePlainIdentical, dlg);
  check('⭐⭐ علّمت → الطبعة دي بكميات', dlg.ticked && dlg.tickedSheetHasQty, dlg);
  check('⭐⭐⭐ ومابيتحفظش: حتى بعد ما علّمت، المرة الجاية مشالة', dlg.uncheckedAgain, dlg);
  check('⭐⭐⭐ النت مقطوع: المفتاح فاضل مفتوح', dlg.offlineKeeps, dlg);
  check('⭐⭐ وقيمة غلط في النسخة المحلية بتتحفظ فاضية', dlg.offlineJunkDropped, dlg);

  // ⚠️ شاشة الحسابات: الخانة موجودة وبتحفظ من القايمة بس
  const ua = require('fs').readFileSync('js/user-admin.js', 'utf8');
  check('⭐⭐ الخانة في شاشة تعديل الحساب', /id="eu-restock-qty"/.test(ua), '');
  check('⭐⭐⭐ وبتحفظ من القايمة بس (branch / main / both)',
    /restockQty:\s*\['branch', 'main', 'both'\]\.indexOf/.test(ua), '');
  // ⚠️⚠️ ومحدش يقدر يفتحه لنفسه: وثيقة الحساب مايعدّلهاش غير الأدمن
  const rules = require('fs').readFileSync('firestore.rules', 'utf8');
  check('⭐⭐⭐ والحساب مايقدرش يعدّل وثيقته غير lastSeen (القاعدة لسه موجودة)',
    /request\.auth\.uid == userId\s*&& onlyChangedKeys\(\['lastSeen'\]\)/.test(rules), '');

  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
