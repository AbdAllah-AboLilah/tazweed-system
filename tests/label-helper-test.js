// الملصقات من البرنامج المساعد
// ============================================================
// العطل اللي بيحله المسار ده، اتبلّغ بالنص:
//     "لما بضيف اكثر من ملصق في شاشة الطباعة ملصقات مختلفة
//      بيطبع كل 4 ب 4"
//
// السبب: حد رسالة QZ (48 كيلو). الملصق بصورته ~9 كيلو، فأربعة بس
// بيدخلوا في الأمر الواحد. البرنامج المساعد مافيهوش الحد ده أصلًا.
//
// ⚠️⚠️ أخطر تلات حاجات في الملف ده:
//   ١) المفتاح مقفول = **مافيش أي نداء على الشبكة**.
//   ٢) العدد **مايتكررش** — بيروح للطابعة كأمر عدد، مش صورة مكررة.
//   ٣) بعد ما لاصقة تطلع، **ممنوع** الرجوع لـQZ (هيطبعها تاني).
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof printLabelsViaHelper === 'function' && typeof deliverPrint === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    // PNG حقيقي ١×١ — عشان مسار تصغير الصور يشتغل زي الواقع
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const SIZE = { pageWidthMm: 38, pageHeightMm: 25 };
    const calls = [];
    const realFetch = window.fetch;
    let mode = 'ok';
    window.fetch = async (url, opts) => {
      const body = opts && opts.body ? JSON.parse(opts.body) : null;
      calls.push({ url: String(url), method: (opts && opts.method) || 'GET', body });
      if (mode === 'down') throw new Error('مفيش اتصال');
      if (String(url).endsWith('/status')) {
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.5.0', printers: ['XP-235B'] }) };
      }
      if (mode === 'old') return { ok: false, status: 404, json: async () => ({}) };
      if (mode === 'reject') return { ok: false, status: 400, json: async () => ({ error: 'الصورة بايظة' }) };
      if (mode === 'dieAfterFirst') {
        const done = calls.filter((c) => c.url.endsWith('/label')).length;
        if (done > 1) return { ok: false, status: 500, json: async () => ({ error: 'الطابعة وقفت' }) };
        return { ok: true, json: async () => ({ ok: true, count: 40 }) };
      }
      return { ok: true, json: async () => ({ ok: true, count: 1 }) };
    };
    saveSelectedPrinter('label', 'XP-235B');
    saveSelectedPrinter('restock', 'XP-80C');
    const notices = [];
    const realNotice = window.showPrintNotice;
    window.showPrintNotice = (m) => notices.push(String(m));
    const reset = () => { calls.length = 0; notices.length = 0; helperCache = null; mode = 'ok'; };
    const labelCalls = () => calls.filter((c) => c.url.endsWith('/label'));
    const one = (copies) => [{ html: '<b>x</b>', image: PNG, copies }];

    // ============================================================
    // ⚠️⚠️ المفتاح مقفول = مافيش أي نداء خالص
    // ============================================================
    // ده أهم فحص في الملف: لو اتنده وهو مقفول، كل طبعة ملصق على أي
    // جهاز مافيهوش البرنامج هتستنى مهلة قبل ما تطبع.
    setPrintTweak('labelHelper', false);
    reset();
    out.offResult = await printLabelsViaHelper('label', one(1), SIZE);
    out.offCalls = calls.length;

    // ---------- المفتاح مفتوح ----------
    setPrintTweak('labelHelper', true);
    reset();
    out.onResult = await printLabelsViaHelper('label', one(1), SIZE);
    out.onPaths = calls.map((c) => c.method + ' ' + c.url.replace('http://127.0.0.1:7770', ''));
    const first = labelCalls()[0];
    out.usedLabelPrinter = !!first && first.body.printer === 'XP-235B';
    out.sentSize = !!first && first.body.widthMm === 38 && first.body.heightMm === 25;
    out.pngHasNoPrefix = !!first && first.body.labels[0].png.indexOf('data:') !== 0;

    // ============================================================
    // ⭐⭐⭐ العدد **مايتكررش** — بيروح كرقم للطابعة
    // ============================================================
    // ده الفرق بين ٤٠ ملصق = ٤٠ صورة على الشبكة، و٤٠ ملصق = صورة
    // واحدة + رقم. الطابعة هي اللي بتكررها.
    reset();
    await printLabelsViaHelper('label', one(40), SIZE);
    const c40 = labelCalls();
    out.copies40Requests = c40.length;
    out.copies40Entries = c40[0] ? c40[0].body.labels.length : -1;
    out.copies40Value = c40[0] ? c40[0].body.labels[0].copies : -1;

    // ============================================================
    // ⭐⭐⭐⭐ عشر ملصقات **مختلفة** في طلب واحد — مش ٤ ب ٤
    // ============================================================
    reset();
    const ten = [];
    for (let i = 0; i < 10; i++) ten.push({ html: '<b>' + i + '</b>', image: PNG, copies: 1 });
    await printLabelsViaHelper('label', ten, SIZE);
    const cTen = labelCalls();
    out.tenRequests = cTen.length;
    out.tenEntries = cTen[0] ? cTen[0].body.labels.length : -1;

    // ============================================================
    // ⚠️ الطبعة الكبيرة بتتقسّم عشان زرار الإيقاف يفضل شغّال
    // ============================================================
    // الحد اتشال، بس لو بعتنا ١٠٠ في طلب واحد مش هيبقى فيه مكان
    // نوقف عنده. ١٠٠ = ٤٠ + ٤٠ + ٢٠.
    reset();
    await printLabelsViaHelper('label', one(100), SIZE);
    const c100 = labelCalls();
    out.chunk100 = c100.map((c) => c.body.labels.reduce((n, l) => n + l.copies, 0));

    // ============================================================
    // ⚠️⚠️ ملصق HTML (من غير صورة) → البرنامج **مايتلمسش**
    // ============================================================
    // البرنامج بيبعت نقط، والـHTML محتاج محرك يرسمه. لازم يروح لـQZ.
    reset();
    out.htmlResult = await printLabelsViaHelper('label', [{ html: '<b>x</b>', copies: 1 }], SIZE);
    out.htmlCalls = calls.length;
    // ولو واحد بس من العشرة HTML، الطبعة **كلها** تروح لـQZ
    reset();
    const mixed = [{ html: '<b>a</b>', image: PNG, copies: 1 }, { html: '<b>b</b>', copies: 1 }];
    out.mixedResult = await printLabelsViaHelper('label', mixed, SIZE);
    out.mixedCalls = calls.length;

    // ---------- ورقة التزويد عمرها ما تعدّي من هنا ----------
    reset();
    out.restockResult = await printLabelsViaHelper('restock', one(1), SIZE);
    out.restockCalls = calls.length;

    // ---------- البرنامج مش شغّال → الطباعة بتكمّل بالقديم ----------
    reset();
    mode = 'down';
    out.downResult = await printLabelsViaHelper('label', one(1), SIZE);

    // ============================================================
    // ⭐⭐⭐⭐ نسخة قديمة من البرنامج (مافيهاش /label) → ترجع لـQZ
    // ============================================================
    // النسخة ١.٤ مافيهاش الباب ده وبترد 404. ودي حالة **مافيش ورق
    // اتحرك** — فالرجوع للطريقة القديمة هو الصح، مش رسالة خطأ.
    reset();
    mode = 'old';
    out.oldResult = await printLabelsViaHelper('label', one(1), SIZE);
    out.oldSaid = notices.join(' | ');

    // والرفض الصريح (400) قبل أي طباعة — نفس الحكم
    reset();
    mode = 'reject';
    out.rejectResult = await printLabelsViaHelper('label', one(1), SIZE);

    // ============================================================
    // ⭐⭐⭐⭐ وقف بعد ما لاصقات طلعت → **ممنوع** الرجوع لـQZ
    // ============================================================
    // الرجوع هنا معناه إعادة طباعة اللي خرج خلاص. لازم يرجّع true
    // (اتعاملنا معاها) ويقول اللي حصل.
    reset();
    mode = 'dieAfterFirst';
    out.partialResult = await printLabelsViaHelper('label', one(100), SIZE);
    out.partialSaid = notices.join(' | ');

    // ============================================================
    // ⭐⭐⭐ الطلب الجاي من **التليفون** بيعدّي على البرنامج كمان
    // ============================================================
    // ده العطل اللي حصل في ورقة التزويد ("اشتغل من الكمبيوتر بس")
    // — متصلّح هنا من أول يوم.
    reset();
    state.user = { uid: 'u1' };
    state.profile = { name: 'الكمبيوتر', role: 'owner' };
    let qzCalls = 0;
    const realQZ = window.tryPrintViaQZ;
    window.tryPrintViaQZ = async () => { qzCalls++; return true; };
    window.db = {
      collection: () => ({
        doc: () => ({ update: () => Promise.resolve(), onSnapshot: () => () => {}, get: async () => ({ exists: false, data: () => null }) }),
      }),
    };
    await executePrintJob('j1', { type: 'label', jobs: one(3), sizeOptions: SIZE });
    out.remoteLabelCalls = labelCalls().length;
    out.remoteSkippedQZ = qzCalls === 0;

    // ---------- من غير طابعة ملصق متظبطة ----------
    reset();
    saveSelectedPrinter('label', '');
    out.noPrinter = await printLabelsViaHelper('label', one(1), SIZE);
    saveSelectedPrinter('label', 'XP-235B');
    window.tryPrintViaQZ = realQZ;

    window.showPrintNotice = realNotice;
    window.fetch = realFetch;
    setPrintTweak('labelHelper', false);
    out.defaultOff = getPrintTweak('labelHelper') === false;
    return out;
  });

  check('⭐⭐⭐⭐ المفتاح مقفول → مافيش ولا نداء على الشبكة',
    r.offResult === false && r.offCalls === 0, [r.offResult, r.offCalls]);
  check('⭐⭐⭐ والمفتاح مفتوح → الملصقات راحت للبرنامج', r.onResult === true, r.onResult);
  check('⭐⭐ وبينده الحالة الأول وبعدين /label',
    JSON.stringify(r.onPaths) === JSON.stringify(['GET /status', 'POST /label']), r.onPaths);
  check('⭐⭐⭐ وبيستخدم **طابعة الملصق** مش طابعة الورقة', r.usedLabelPrinter);
  check('⭐⭐ وبيبعت مقاس اللاصقة معاه', r.sentSize);
  check('⭐ والصورة من غير ترويسة data:', r.pngHasNoPrefix);

  check('⭐⭐⭐⭐ ٤٠ نسخة = **طلب واحد** فيه صورة واحدة ورقم',
    r.copies40Requests === 1 && r.copies40Entries === 1 && r.copies40Value === 40,
    [r.copies40Requests, r.copies40Entries, r.copies40Value]);
  check('⭐⭐⭐⭐ ١٠ ملصقات مختلفة في **طلب واحد** — مش ٤ ب ٤',
    r.tenRequests === 1 && r.tenEntries === 10, [r.tenRequests, r.tenEntries]);
  check('⭐⭐ و١٠٠ لاصقة بتتقسّم ٤٠+٤٠+٢٠ عشان الإيقاف يفضل شغّال',
    JSON.stringify(r.chunk100) === JSON.stringify([40, 40, 20]), r.chunk100);

  check('⭐⭐⭐⭐ ملصق HTML من غير صورة → البرنامج مايتلمسش',
    r.htmlResult === false && r.htmlCalls === 0, [r.htmlResult, r.htmlCalls]);
  check('⭐⭐⭐ وواحد HTML وسط الصور → الطبعة كلها تروح لـQZ',
    r.mixedResult === false && r.mixedCalls === 0, [r.mixedResult, r.mixedCalls]);
  check('⭐⭐⭐ ورقة التزويد عمرها ما تعدّي من مسار الملصق',
    r.restockResult === false && r.restockCalls === 0, [r.restockResult, r.restockCalls]);
  check('⭐⭐⭐ البرنامج مش شغّال → الطباعة بتكمّل بالقديم', r.downResult === false);

  check('⭐⭐⭐⭐ نسخة قديمة (404) → بترجع لـQZ من غير ورق ضايع', r.oldResult === false, r.oldResult);
  check('⭐⭐ وبتقول إن البرنامج محتاج تحديث', /حدّث البرنامج/.test(r.oldSaid), r.oldSaid);
  check('⭐⭐⭐ والرفض الصريح (400) قبل الطباعة → بترجع لـQZ', r.rejectResult === false);
  check('⭐⭐⭐⭐ وقف بعد ما لاصقات طلعت → **مايرجعش** لـQZ', r.partialResult === true, r.partialResult);
  check('⭐⭐⭐ وبيقول اللي طلع خلاص متعيدهوش', /متعيدهوش/.test(r.partialSaid), r.partialSaid);

  check('⭐⭐⭐⭐ الطلب الجاي من التليفون بيعدّي على البرنامج كمان',
    r.remoteLabelCalls === 1, r.remoteLabelCalls);
  check('⭐⭐⭐ ومابيروحش لـQZ بعدها (مش طبعتين)', r.remoteSkippedQZ);
  check('⚠️ ومن غير طابعة ملصق متظبطة مايبعتش', r.noPrinter === false);
  check('⭐ والمفتاح مقفول افتراضيًا', r.defaultOff);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
