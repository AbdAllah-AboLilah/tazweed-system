// ورقة التزويد خام (ESC/POS) — تتخطّى تعريف الويندوز
// ============================================================
// العطل: ورقة التزويد بتتقص عند طول ثابت على جهاز، وبتخرج كاملة على
// جهاز تاني — نفس النظام ونفس نسخة QZ (2.2.6) ونفس موديل الطابعة.
//
// القياس اللي بيفسّرها (v0.55.3، ورق حقيقي):
//   طول الورقة = 324.1مم | بعتنا 359مم | اتطبع 294.4مم (آخر صف قبل 297)
//   ونفس الورقة اتطبعت مرتين بطولين مختلفين واتقصّت في **نفس الصف**.
// يعني الطول الصريح **بيقفل التصغير** بتاع التعريف، فبدل ما الورقة
// تصغّر وتخرج كاملة بتتقص عند فورم التعريف — والفورم مختلف من جهاز لجهاز.
//
// الحل: مانعدّيش على موديل الصفحة أصلًا. الصورة بتتبعت **خام** زي إيصال
// الكاشير — الطابعة بتطبع نقط لحد ما البيانات تخلص.
//
// ⚠️⚠️ أخطر حاجة في الملف ده: **الملصق مايعديش من المسار ده خالص.**
// آخر مرة لمست مسار مشترك بين الورقة والملصق، رجّعت عطل العمود المقصوص
// بتاع v0.73.2 — ومسكه label-image-test. الفحوصات الأخيرة تحت عن ده.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof printSheetRaw === 'function' && typeof tryPrintViaQZ === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const calls = [];
    // QZ مقلّد بيسجّل **الإعداد والحمولة** — دول الاتنين اللي بيفرقوا
    window.qz = {
      api: { getVersion: async () => '2.2.6' },
      websocket: { isActive: () => true, connect: async () => {} },
      printers: { find: async () => 'XP-80C', details: async () => [{ name: 'XP-80C', size: { width: 80, height: 210 } }] },
      configs: { create: (name, opts) => ({ __name: name, __opts: opts || null }) },
      print: async (config, data) => { calls.push({ config, data }); },
    };
    window.ensureQZConnected = async () => true;

    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

    // ---------- المسار الخام نفسه ----------
    calls.length = 0;
    out.rawSent = await printSheetRaw('XP-80C', PNG);
    const c0 = calls[0] || {};
    // ⚠️⚠️ (١) الإعداد **من غير مقاس خالص**. أي مقاس هنا بيرجّعنا لموديل
    // الصفحة بتاع الويندوز — وهو بالظبط اللي بنهرب منه.
    out.configHasNoSize = c0.config ? c0.config.__opts === null : false;
    out.configName = c0.config ? c0.config.__name : '';
    // (٢) النوع خام مش بكسل، والحمولة **صورة** عشان QZ يحوّلها هو
    const first = (c0.data || [])[0] || {};
    out.typeIsRaw = first.type === 'raw';
    out.formatIsImage = first.format === 'image';
    out.langIsEscpos = !!(first.options && first.options.language === 'ESCPOS');
    // ⚠️ الترويسة بتتشال — QZ بياخد base64 صافي
    out.headerStripped = typeof first.data === 'string' && first.data.indexOf('data:image') === -1;
    // (٣) تقديم ورق **وقص** في الآخر
    // ⚠️⚠️ الفحص ده كان بالعكس في أول نسخة: كان بيتأكد إن **مافيش** أمر
    // قص، والسبب المكتوب وقتها "لو الطابعة مالهاش قصّاصة ممكن تطبع رموز
    // غريبة". التجربة على ورق حقيقي قالت العكس بالحرف: "الورقة بتطبع
    // الاخر وتمام بدون تصغير بس **بتقف في الماكينه من غير م تتقض**".
    // لما بنتخطى التعريف بنتخطى معاه أمر القص اللي كان بيبعته.
    const last = (c0.data || [])[(c0.data || []).length - 1] || {};
    const tail = String(last.data || '');
    out.feedsPaper = last.type === 'raw' && last.format === 'command' && /\x1B\x64/.test(tail);
    out.cutsPaper = /\x1D\x56/.test(tail);
    // ⚠️ والترتيب مهم: التقديم **قبل** القص، عشان آخر سطر يخرج من تحت
    // رأس الطباعة قبل ما السكينة تنزل.
    out.feedBeforeCut = tail.indexOf('\x1B\x64') !== -1 && tail.indexOf('\x1B\x64') < tail.indexOf('\x1D\x56');

    // ---------- من غير صورة = مايبعتش ----------
    calls.length = 0;
    out.noImageNoSend = (await printSheetRaw('XP-80C', '')) === false && calls.length === 0;
    out.noPrinterNoSend = (await printSheetRaw('', PNG)) === false;

    // ---------- QZ بيرمي خطأ → بيرجّع false مش بيقع ----------
    const realPrint = window.qz.print;
    window.qz.print = async () => { throw new Error('الطابعة مش موجودة'); };
    out.errorReturnsFalse = (await printSheetRaw('XP-80C', PNG)) === false;
    window.qz.print = realPrint;

    // ============================================================
    // ⚠️⚠️ الملصق **مايعديش** من المسار ده
    // ============================================================
    setPrintTweak('sheetRaw', true);
    setPrintTweak('sheetImage', true);
    saveSelectedPrinter('label', 'XP-235B');
    saveSelectedPrinter('restock', 'XP-80C');

    calls.length = 0;
    await tryPrintViaQZ('label', [{ image: PNG, html: '<b>x</b>', copies: 1 }], { pageWidthMm: 38, pageHeightMm: 25 });
    const labelRaw = calls.filter((c) => (c.data || []).some((d) => d.type === 'raw'));
    out.labelNeverRaw = labelRaw.length === 0;
    // ⚠️ (تحقّق) لازم يكون الملصق **اتبعت فعلًا** — وإلا الفحص اللي فوق
    // بيعدّي لأن مافيش طباعة أصلًا، مش لأن الملصق مأمّن.
    out.labelDidPrint = calls.length > 0;
    out.labelStillPixel = calls.some((c) => (c.data || []).some((d) => d.type === 'pixel'));
    // والملصق لسه بياخد مقاسه
    out.labelKeepsSize = calls.some((c) => c.config && c.config.__opts && c.config.__opts.size);

    // ============================================================
    // ⭐⭐⭐ الورقة نفسها — الفرع بيشتغل من جوّه tryPrintViaQZ
    // ============================================================
    // ⚠️ بنقلّد الرسم: renderSheetImage الحقيقية محتاجة إطار وخطوط،
    // وإحنا بنفحص **المسار** مش الرسم (الرسم ليه فحوصه لوحده).
    window.renderSheetImage = async () => ({ image: PNG, widthMm: 72.1, heightMm: 231, bytes: 900 });

    calls.length = 0;
    await tryPrintViaQZ('restock', [{ html: '<p>ورقة</p>', copies: 1 }], { pageWidthMm: 80, autoHeight: true });
    out.restockRawCalls = calls.filter((c) => (c.data || []).some((d) => d.type === 'raw')).length;
    out.restockNoPixel = !calls.some((c) => (c.data || []).some((d) => d.type === 'pixel'));
    out.restockConfigNoSize = calls.length > 0 && calls.every((c) => !c.config || c.config.__opts === null);

    // ============================================================
    // ⚠️⚠️ "خام" لازم يشتغل **لوحده** من غير مفتاح الصورة
    // ============================================================
    // اتبلّغ بالنص: "في امر بيروح ل جهاز الكمبيوتر بيتعمل معاينة على
    // جهاز الكمبيوتر نفس المشكلة اللي قبل كده". السبب إن "خام" كان
    // بيحتاج مفتاح الصورة مفتوح معاه — فلو مقفول، الورقة بتروح **نص**،
    // ولو طلعت أتقل من حد الرسالة بتتفتح نافذة طباعة المتصفح.
    setPrintTweak('sheetImage', false);
    setPrintTweak('sheetRaw', true);
    calls.length = 0;
    await tryPrintViaQZ('restock', [{ html: '<p>ورقة</p>', copies: 1 }], { pageWidthMm: 80, autoHeight: true });
    out.rawAloneCalls = calls.filter((c) => (c.data || []).some((d) => d.type === 'raw')).length;
    out.rawAloneNoPixel = !calls.some((c) => (c.data || []).some((d) => d.type === 'pixel'));
    setPrintTweak('sheetImage', true);

    // ---------- والمفتاح مقفول → الورقة بترجع للمسار العادي ----------
    setPrintTweak('sheetRaw', false);
    calls.length = 0;
    await tryPrintViaQZ('restock', [{ html: '<p>ورقة</p>', copies: 1 }], { pageWidthMm: 80, autoHeight: true });
    out.offGoesPixel = calls.some((c) => (c.data || []).some((d) => d.type === 'pixel'));
    out.offNoRaw = !calls.some((c) => (c.data || []).some((d) => d.type === 'raw'));

    out.tweakDefaultOff = getPrintTweak('sheetRaw') === false;

    // ============================================================
    // ⚠️⚠️ الرجوع لنافذة المتصفح لازم **يتقال** مش يحصل في سكوت
    // ============================================================
    // الورقة اللي بتروح نص وتطلع أتقل من حد الرسالة بترجع لنافذة طباعة
    // المتصفح — وده كان بيحصل **من غير أي كلمة**، فالمستخدم يلاقي نافذة
    // فاتحة على الكمبيوتر ومش فاهم ليه.
    setPrintTweak('sheetRaw', false);
    setPrintTweak('sheetImage', false);
    const notices = [];
    const realNotice = window.showPrintNotice;
    window.showPrintNotice = (m) => { notices.push(String(m)); };
    // ورقة نص أتقل من الحد
    const HUGE = '<p>' + 'ورقة طويلة جدًا '.repeat(4000) + '</p>';
    out.hugeReturned = await tryPrintViaQZ('restock', [{ html: HUGE, copies: 1 }],
      { pageWidthMm: 80, autoHeight: true });
    out.hugeNotice = notices.join(' | ');
    window.showPrintNotice = realNotice;

    // ---------- مقاس ورق التعريف بيتقرا ----------
    out.paper = await readPrinterPaper('XP-80C');
    // ⚠️ طابعة مش موجودة في القايمة → نص فاضي مش وقوع
    out.paperMissing = await readPrinterPaper('مش موجودة');
    // ⚠️ ولو الشكل اتغيّر، بترجّع أسماء الحقول بدل ما تخمّن
    window.qz.printers.details = async () => [{ name: 'XP-80C', حاجة: 1, تانية: 2 }];
    out.paperUnknownShape = await readPrinterPaper('XP-80C');
    // ⚠️ ونسخة QZ مافيهاش details خالص → نص فاضي، مش خطأ
    delete window.qz.printers.details;
    out.paperNoApi = await readPrinterPaper('XP-80C');

    return out;
  });

  check('⭐⭐⭐ الإعداد **من غير مقاس** (ده كل الفكرة)', r.configHasNoSize);
  check('⭐ وبيروح للطابعة الصح', r.configName === 'XP-80C', r.configName);
  check('⭐⭐ النوع خام مش بكسل', r.typeIsRaw);
  check('⭐⭐⭐ والحمولة **صورة** — QZ هو اللي يحوّلها', r.formatIsImage);
  check('⭐⭐ واللغة ESCPOS', r.langIsEscpos);
  check('⚠️ وترويسة data: بتتشال', r.headerStripped);
  check('⭐⭐ وبيقدّم الورق في الآخر', r.feedsPaper);
  check('⭐⭐⭐ وبيقص الورق في الآخر', r.cutsPaper);
  check('⭐⭐ والتقديم قبل القص', r.feedBeforeCut);
  check('⭐ اتبعت فعلًا', r.rawSent);

  check('⚠️ من غير صورة مايبعتش', r.noImageNoSend);
  check('⚠️ ومن غير طابعة مايبعتش', r.noPrinterNoSend);
  check('⭐⭐ وخطأ من QZ بيرجّع false مش بيقع', r.errorReturnsFalse);

  check('⚠️ (تحقّق) الملصق اتطبع فعلًا في الفحص', r.labelDidPrint);
  check('⭐⭐⭐ الملصق **عمره ما يعدّي** على المسار الخام', r.labelNeverRaw);
  check('⭐⭐ والملصق لسه بكسل زي ما هو', r.labelStillPixel);
  check('⭐⭐ ولسه بياخد مقاسه', r.labelKeepsSize);
  check('⭐⭐⭐ الورقة بتاخد المسار الخام لما المفتاح مفتوح',
    r.restockRawCalls === 1, r.restockRawCalls);
  check('⭐⭐ ومابتعديش على مسار البكسل خالص', r.restockNoPixel);
  check('⭐⭐⭐ وإعدادها من غير مقاس', r.restockConfigNoSize);
  check('⭐⭐⭐ والمفتاح مقفول → بترجع لمسار البكسل زي ما كانت', r.offGoesPixel);
  check('⭐⭐ ومفيش أي إرسال خام وهو مقفول', r.offNoRaw);
  check('⭐⭐⭐ و"خام" بيشتغل لوحده من غير مفتاح الصورة',
    r.rawAloneCalls === 1, r.rawAloneCalls);
  check('⭐⭐ ومابيروحش لمسار البكسل (اللي بيفتح نافذة المتصفح)', r.rawAloneNoPixel);
  check('⭐ والمفتاح مقفول افتراضيًا', r.tweakDefaultOff);

  check('⭐⭐ الورقة التقيلة بترجع لنافذة المتصفح (false)', r.hugeReturned === false, r.hugeReturned);
  check('⭐⭐⭐ **وبتقول ليه** مش بتسكت', /ورقة التزويد/.test(r.hugeNotice), r.hugeNotice.slice(0, 120));
  check('⭐⭐ والرسالة فيها الحل (مفتاح الصورة)', /كصورة/.test(r.hugeNotice), r.hugeNotice.slice(0, 120));
  check('⭐ وفيها الحجم والحد بالأرقام', /\d+ كيلو/.test(r.hugeNotice), r.hugeNotice.slice(0, 120));
  check('⭐⭐ مقاس ورق التعريف بيتقرا', r.paper === '80×210مم', r.paper);
  check('⚠️ وطابعة مش موجودة → فاضي', r.paperMissing === '', r.paperMissing);
  check('⭐⭐ ولو الشكل اتغيّر بيرجّع الحقول بدل ما يخمّن',
    r.paperUnknownShape.indexOf('الحقول:') === 0, r.paperUnknownShape);
  check('⚠️ ونسخة QZ من غير details → فاضي مش خطأ', r.paperNoApi === '', r.paperNoApi);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
