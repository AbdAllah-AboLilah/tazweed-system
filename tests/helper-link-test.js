// توصيل النظام بالبرنامج المساعد
// ============================================================
// البرنامج (helper/) بيبعت للطابعة من غير ما يعدّي على تعريف الويندوز.
// التجربة على ورق حقيقي:
//     النظام (QZ + التعريف) → الورقة بتتقص عند ~211مم
//     البرنامج المساعد      → ورقة 500مم كاملة وآخر سطر باين
//
// ⚠️⚠️ أخطر حاجتين في الملف ده **مش** الطباعة:
//   ١) المفتاح مقفول = **مافيش أي نداء على الشبكة خالص**. لو اتنده
//      وهو مقفول، كل طبعة هتستنى مهلة على جهاز مافيهوش البرنامج.
//   ٢) البرنامج مش شغّال = الطباعة **بتكمّل** بالطريقة القديمة، ومرة
//      واحدة بس بتتفحص — مش مع كل طبعة.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof printSheetViaHelper === 'function' && typeof deliverPrint === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const calls = [];
    const realFetch = window.fetch;
    let mode = 'ok';
    window.fetch = async (url, opts) => {
      calls.push({ url: String(url), method: (opts && opts.method) || 'GET' });
      if (mode === 'down') throw new Error('مفيش اتصال');
      if (String(url).endsWith('/status')) {
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.1.0', printers: ['XP-80C'] }) };
      }
      if (mode === 'refuse') {
        return { ok: false, status: 500, json: async () => ({ error: 'الطابعة مش موجودة' }) };
      }
      return { ok: true, json: async () => ({ ok: true, bytes: 900 }) };
    };
    window.renderSheetImage = async () => ({ image: PNG, widthMm: 72.1, heightMm: 500, bytes: 900 });
    saveSelectedPrinter('restock', 'XP-80C');
    const reset = () => { calls.length = 0; helperCache = null; };

    // ============================================================
    // ⚠️⚠️ المفتاح مقفول = مافيش أي نداء خالص
    // ============================================================
    setPrintTweak('sheetHelper', false);
    reset();
    out.offResult = await printSheetViaHelper('<p>ورقة</p>');
    out.offCalls = calls.length;

    // ---------- المفتاح مفتوح والبرنامج شغّال ----------
    setPrintTweak('sheetHelper', true);
    reset();
    out.onResult = await printSheetViaHelper('<p>ورقة</p>');
    out.onCalls = calls.map((c) => c.method + ' ' + c.url.replace('http://127.0.0.1:7770', ''));
    // ⚠️ الطباعة لازم تكون POST — مش GET
    const printCall = calls.find((c) => c.url.endsWith('/print'));
    out.printIsPost = !!printCall && printCall.method === 'POST';

    // ============================================================
    // ⚠️⚠️ الفحص **مرة واحدة** مش مع كل طبعة
    // ============================================================
    // من غير الخزن، كل طبعة بتستنى مهلة على جهاز مافيهوش البرنامج.
    calls.length = 0;
    await printSheetViaHelper('<p>ورقة</p>');
    await printSheetViaHelper('<p>ورقة</p>');
    out.repeatStatusCalls = calls.filter((c) => c.url.endsWith('/status')).length;
    out.repeatPrintCalls = calls.filter((c) => c.url.endsWith('/print')).length;

    // ---------- البرنامج مش شغّال → الطباعة بتكمّل ----------
    mode = 'down';
    reset();
    out.downResult = await printSheetViaHelper('<p>ورقة</p>');

    // ============================================================
    // ⚠️⚠️ البرنامج طبع بس الرد مش مفهوم → **مانطبعش تاني**
    // ============================================================
    // اتبلّغ بالنص: "كل حاجه اشتغلت كويس والورقة طلعت كامله بس ظهر
    // امر معاينة بتاع المتصفح".
    //
    // يعني البرنامج طبع، والنظام مشافش النجاح، فرجع لنافذة المتصفح.
    // والرجوع ده **غلط مرتين**: الورقة اتطبعت خلاص (فطبعة تانية = ورق
    // ضايع)، ونافذة المتصفح بتطلّعها **مقصوصة** أصلًا.
    //
    // فالمطلوب: يرجّع **true** (يعني اتعاملنا معاها) ويقول السبب.
    mode = 'refuse';
    reset();
    const notices = [];
    const realNotice = window.showPrintNotice;
    window.showPrintNotice = (m) => notices.push(String(m));
    calls.length = 0;
    out.refuseResult = await printSheetViaHelper('<p>ورقة</p>');
    out.refuseSaid = notices.join(' | ');
    // ⚠️ الطبعة اللي مااتأكدتش مافيش ورقة ننتظرها في الطابور —
    // فالسؤال عن الطابور مالوش لازمة، وإنذار "واقف" بعده هيبقى
    // إنذار على حاجة مش موجودة أصلًا.
    out.refuseQueueCalls = calls.filter((c) => c.url.indexOf('/printer/queue') > -1).length;

    // ولو الاتصال اتقطع خالص — نفس المنطق
    mode = 'down';
    helperCache = { app: 'tazweed-helper' }; // البرنامج كان شغّال ووصلنا له
    notices.length = 0;
    out.cutResult = await printSheetViaHelper('<p>ورقة</p>');
    out.cutSaid = notices.join(' | ');
    window.showPrintNotice = realNotice;
    mode = 'ok';

    // ---------- من غير طابعة متظبطة ----------
    mode = 'ok';
    reset();
    saveSelectedPrinter('restock', '');
    out.noPrinter = await printSheetViaHelper('<p>ورقة</p>');
    saveSelectedPrinter('restock', 'XP-80C');

    // ============================================================
    // ⚠️⚠️ الطلب الجاي من **التليفون** لازم يعدّي على البرنامج كمان
    // ============================================================
    // اتبلّغ بالنص: "اشتغل بس فقط من جهاز الكمبيوتر لكن لما ببعت من
    // التليفون يبعت علي النظام القديم".
    //
    // السبب: الطلب الجاي من بعيد **مابيعديش على deliverPrint** خالص —
    // بيدخل من executePrintJob مباشرة، والبرنامج كان في المسار التاني بس.
    reset();
    mode = 'ok';
    // ⚠️ executePrintJob بتقرا state.user و state.profile — من غيرهم
    // بتقع قبل ما توصل للجزء اللي بنفحصه.
    state.user = { uid: 'u1' };
    state.profile = { name: 'الكمبيوتر', role: 'owner' };
    let qzCalls = 0;
    const realQZ = window.tryPrintViaQZ;
    window.tryPrintViaQZ = async () => { qzCalls++; return true; };
    window.db = {
      collection: () => ({
        doc: () => ({
          update: () => Promise.resolve(),
          onSnapshot: () => () => {},
          get: async () => ({ exists: false, data: () => null }),
        }),
      }),
    };
    await executePrintJob('j1', {
      type: 'restock',
      jobs: [{ html: '<p>ورقة من التليفون</p>', copies: 1 }],
      sizeOptions: { pageWidthMm: 80, autoHeight: true },
    });
    out.remoteHelperCalls = calls.filter((c) => c.url.endsWith('/print')).length;
    out.remoteSkippedQZ = qzCalls === 0;
    window.tryPrintViaQZ = realQZ;

    // ============================================================
    // ⚠️⚠️ مفتاح الورقة **مالوش دعوة** بالملصق
    // ============================================================
    // للملصق مفتاحه هو (labelHelper، مقفول هنا). لو الاتنين اتربطوا
    // ببعض، اللي بيفتح الورقة يلاقي الملصقات اتغيّرت من ورا ظهره —
    // وده بالظبط اللي اتقال: "متلمسيش اي حاجه في الملصق طلما
    // موافقتيش عليها".
    reset();
    mode = 'ok';
    setPrintTweak('labelHelper', false);
    await deliverPrint('label', [{ html: '<b>x</b>', copies: 1 }], { pageWidthMm: 38, pageHeightMm: 25 });
    out.labelTouchedHelper = calls.some((c) => c.url.indexOf('7770') !== -1);

    window.fetch = realFetch;
    setPrintTweak('sheetHelper', false);
    out.defaultOff = getPrintTweak('sheetHelper') === false;
    return out;
  });

  check('⭐⭐⭐⭐ المفتاح مقفول → مافيش ولا نداء على الشبكة',
    r.offResult === false && r.offCalls === 0, [r.offResult, r.offCalls]);
  check('⭐⭐⭐ والمفتاح مفتوح → الورقة راحت للبرنامج', r.onResult === true, r.onResult);
  check('⭐⭐ وبينده الحالة الأول وبعدين الطباعة',
    // ⚠️⚠️ النداء التالت (/printer/queue) اتضاف في م٢ وهو **ضروري**:
    // البرنامج بياخد عيّنة من الطابور مع كل سؤال (مافيش شغل في
    // الخلفية عنده)، فالعيّنة دي هي اللي السؤال اللي بعد دقيقة
    // هيقارن بيها. من غيرها، السؤال اللي بعد دقيقة بيبقى أول عيّنة
    // وعمره ما هيقول "واقف". (helper/queuewatch.go)
    JSON.stringify(r.onCalls) === JSON.stringify(['GET /status', 'POST /print', 'GET /printer/queue']),
    r.onCalls);
  check('⭐⭐⭐ والعيّنة الأولى من الطابور بتتاخد **بعد** الطبعة مش قبلها',
    r.onCalls.indexOf('GET /printer/queue') === r.onCalls.length - 1, r.onCalls);
  check('⭐⭐⭐ والطبعة الفاشلة مابتسألش عن الطابور (مافيش ورقة تنتظرها)',
    r.refuseQueueCalls === 0, r.refuseQueueCalls);
  check('⭐⭐ والطباعة POST مش GET', r.printIsPost);
  check('⭐⭐⭐⭐ والحالة بتتفحص **مرة واحدة** مش مع كل طبعة',
    r.repeatStatusCalls === 0 && r.repeatPrintCalls === 2, [r.repeatStatusCalls, r.repeatPrintCalls]);
  check('⭐⭐⭐ البرنامج مش شغّال → الطباعة بتكمّل بالقديم', r.downResult === false);
  check('⭐⭐⭐⭐ البرنامج رد بحاجة مش مفهومة → **مانفتحش نافذة المتصفح**',
    r.refuseResult === true, r.refuseResult);
  check('⭐⭐⭐ وبيحذّر إن الورقة يمكن اتطبعت', /متطبعش تاني/.test(r.refuseSaid), r.refuseSaid);
  check('⭐⭐⭐⭐ والاتصال اتقطع → **مانفتحش نافذة المتصفح** كمان',
    r.cutResult === true, r.cutResult);
  check('⭐⭐ وبيحذّر برضه', /متطبعش تاني/.test(r.cutSaid), r.cutSaid);
  check('⚠️ ومن غير طابعة متظبطة مايبعتش', r.noPrinter === false);
  check('⭐⭐⭐⭐ الطلب الجاي من التليفون بيعدّي على البرنامج كمان',
    r.remoteHelperCalls === 1, r.remoteHelperCalls);
  check('⭐⭐⭐ ومابيروحش لـQZ بعدها (مش طبعتين)', r.remoteSkippedQZ);
  check('⭐⭐⭐ مفتاح الورقة لوحده مايوديش الملصق للبرنامج', r.labelTouchedHelper === false);
  check('⭐ والمفتاح مقفول افتراضيًا', r.defaultOff);

  // ============================================================
  // ⏳ م٢ — التنبيه لما الورقة تقعد في الطابور
  // ============================================================
  // ⚠️⚠️ الحاجة اللي الفحص ده موجود عشانها: النظام بيقول "اتبعت ✅"
  // بمجرد ما البايتات تروح لويندوز. لو الطابعة مطفية أو الكابل
  // مقطوع، الورقة بتقعد في الطابور وصاحب المحل واقف مستنيها —
  // والنظام ساكت.
  const q = await p.evaluate(async () => {
    const out = {};
    const notices = [];
    const realNotice = window.showPrintNotice;
    window.showPrintNotice = (t) => notices.push(String(t));
    const realFetch = window.fetch;
    let reply = { stuck: false, jobs: 0, summary: 'الطابور فاضي' };
    const asked = [];
    window.fetch = async (url) => {
      asked.push(String(url));
      return { ok: true, json: async () => reply };
    };

    // ⚠️ بنستعجل المهلة بدل ما نستنى 70 ثانية حقيقية
    const realTimeout = window.setTimeout;
    window.setTimeout = (fn, ms) => realTimeout(fn, ms >= 60000 ? 5 : ms);

    // (١) الطابور ماشي → مفيش أي كلام
    watchPrintQueue();
    await new Promise((r) => realTimeout(r, 60));
    out.quietWhenMoving = notices.length === 0;
    out.sampledTwice = asked.filter((u) => u.indexOf('/printer/queue') > -1).length === 2;

    // (٢) الطابور واقف → تنبيه
    notices.length = 0;
    reply = { stuck: true, jobs: 2, stuckSeconds: 130, summary: '⚠️ فيه 2 أمر طباعة واقف في الويندوز من 2 دقيقة' };
    watchPrintQueue();
    await new Promise((r) => realTimeout(r, 60));
    out.warned = notices.join(' | ');

    // (٣) ⚠️ البرنامج مش شغّال → سكوت تام، مش رسالة خطأ
    notices.length = 0;
    window.fetch = async () => { throw new Error('مفيش اتصال'); };
    watchPrintQueue();
    await new Promise((r) => realTimeout(r, 60));
    out.quietWhenHelperDown = notices.length === 0;

    window.setTimeout = realTimeout;
    window.fetch = realFetch;
    window.showPrintNotice = realNotice;
    return out;
  });
  check('⭐⭐⭐ الطابور ماشي → النظام ساكت', q.quietWhenMoving, q);
  check('⭐⭐⭐ وبياخد **عيّنتين**: واحدة بعد الطبعة وواحدة بعد دقيقة',
    q.sampledTwice, q);
  check('⭐⭐⭐ الطابور واقف → بيقول، وبيقول العدد والمدة',
    /واقف/.test(q.warned) && /2 أمر/.test(q.warned) && /دقيقة/.test(q.warned), q);
  check('⭐⭐ وبيقول له يعمل إيه (الورقة محفوظة وتتطبع تاني)',
    /الورقة محفوظة/.test(q.warned) && /السجلات/.test(q.warned), q);
  check('⭐⭐⭐ والبرنامج مش شغّال → سكوت تام مش رسالة خطأ',
    q.quietWhenHelperDown, q);

  // ⚠️ واسم أمر الطباعة بيقول أنهي فئة — بيبان في طابور الويندوز
  // وفي سجل الطباعة المحلي.
  const jobName = await p.evaluate(() => ({
    withGroup: restockJobName({ name: 'كريب سادة لوكس' }, 'بيجات'),
    noGroup: restockJobName({ name: 'شيفون مطرز' }, ''),
    noCat: restockJobName(null, ''),
    long: restockJobName({ name: 'ط'.repeat(200) }, 'م'.repeat(50)).length,
  }));
  check('⭐⭐ اسم أمر الطباعة فيه الفئة والمجموعة',
    jobName.withGroup === 'ورقة تزويد — كريب سادة لوكس · بيجات', jobName);
  check('⭐ ومن غير مجموعة بيبقى الفئة بس',
    jobName.noGroup === 'ورقة تزويد — شيفون مطرز', jobName);
  check('⭐ ومن غير فئة بيفضل مقروء', jobName.noCat === 'ورقة تزويد', jobName);
  check('⭐⭐ والاسم الطويل بيتقص عند 60 (طابور الويندوز بيقصّه أوحش)',
    jobName.long === 60, jobName);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
