// النظام بيقول الطبعة خرجت منين
// ============================================================
// اتطلب بالنص: "تخلي النظام يقولي بعد كل طبعة إنها خرجت من البرنامج
// ولا من QZ، عشان متبقاش محتاج تفتكر المفاتيح".
//
// ⚠️⚠️ السبب الحقيقي: الملصق بيروح للبرنامج المساعد **بس لو كان
// صورة**. والملصق كنص (وده الافتراضي) بيروح لـQZ حتى لو مفتاح
// البرنامج مفتوح. يعني مفتاحين لازم يتظبطوا مع بعض، ومن غير ما
// النظام يقول مفيش طريقة تعرف بيها غير إنك تفتكر.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const rulesSrc = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 200)}` : ''));

// الحقل الجديد لازم يكون مسموح في القواعد، وإلا كتابة النتيجة كلها
// بتترفض والطلب بيفضل معلّق للأبد عند اللي بعته.
check('⭐⭐⭐ حقل printRoute مسموح في firestore.rules', rulesSrc.includes("'printRoute'"));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof notePrintRoute === 'function' && typeof printLabelsViaHelper === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const SIZE = { pageWidthMm: 38, pageHeightMm: 25 };
    const notices = [];
    const kinds = [];
    const realNotice = window.showPrintNotice;
    window.showPrintNotice = (m, ms, kind) => { notices.push(String(m)); kinds.push(kind || 'info'); };

    const realFetch = window.fetch;
    window.fetch = async (u) => {
      if (String(u).endsWith('/status')) return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.5.0' }) };
      return { ok: true, json: async () => ({ ok: true, count: 1 }) };
    };
    saveSelectedPrinter('label', 'XP-235B');
    saveSelectedPrinter('restock', 'XP-80C');

    // ---------- الملصقات من البرنامج ----------
    setPrintTweak('labelHelper', true);
    helperCache = null;
    notices.length = 0;
    await printLabelsViaHelper('label', [{ html: '<b>x</b>', image: PNG, copies: 1 }], SIZE);
    out.helperSaid = notices.join(' | ');
    out.helperRoute = lastPrintRoute;

    // ---------- ورقة التزويد من البرنامج ----------
    setPrintTweak('sheetHelper', true);
    window.renderSheetImage = async () => ({ image: PNG, widthMm: 72.1, heightMm: 500 });
    notices.length = 0;
    await printSheetViaHelper('<p>ورقة</p>');
    out.sheetRoute = lastPrintRoute;
    out.sheetSaid = notices.join(' | ');

    // ============================================================
    // ⭐⭐⭐⭐ الملصق كنص مع مفتاح البرنامج مفتوح → لازم يقول QZ
    // ============================================================
    // دي الحالة اللي التنبيه اتعمل عشانها بالظبط: المفتاح مفتوح
    // والمستخدم فاكر إن الملصق بيخرج من البرنامج، وهو بيخرج من QZ.
    notices.length = 0;
    lastPrintRoute = '';
    const usedHelper = await printLabelsViaHelper('label', [{ html: '<b>x</b>', copies: 1 }], SIZE);
    out.htmlUsedHelper = usedHelper;
    out.htmlRouteAfter = lastPrintRoute;
    // وQZ هو اللي بيسجّل الطريق ساعتها
    notePrintRoute('qz');
    out.qzSaid = notices.join(' | ');
    out.qzRoute = lastPrintRoute;

    // ---------- نافذة المتصفح ----------
    notices.length = 0;
    notePrintRoute('browser');
    out.browserSaid = notices.join(' | ');

    // ============================================================
    // ⭐⭐⭐ لون الشريط بيقول نوع الرسالة
    // ============================================================
    // اتطلب بالنص: "مينفعش نحط الخطا بتاعه او السكوت في الشريط الاحمر
    // اللي عندنا في النظام لما يحصل خطا او مشكلة". قبل كده كان لون
    // واحد لكل حاجة، فالرسالة الخطيرة كانت بتعدّي زي أي رسالة.
    notices.length = 0; kinds.length = 0;
    helperFail('حاجة بسيطة', false);
    out.softKind = kinds[0];
    notices.length = 0; kinds.length = 0;
    helperFail('الورقة يمكن طلعت — متطبعش تاني', true);
    out.loudKind = kinds[0];

    // ---------- اسم مش معروف مايطلّعش تنبيه فاضي ----------
    notices.length = 0;
    notePrintRoute('');
    out.emptyNotices = notices.length;

    // ============================================================
    // ⭐⭐⭐ المفتاح بيقفل **التنبيه** بس — مش التسجيل
    // ============================================================
    // ⚠️ الفرق ده مهم: اللي بعت من التليفون بياخد الطريق في رسالة
    // النجاح، وده بيتقرا من lastPrintRoute. لو المفتاح قفل التسجيل
    // كمان، اللي بيقفل التنبيه على الكمبيوتر كان هيعمي التليفون معاه.
    out.defaultOn = getPrintTweak('showPrintRoute') === true;
    setPrintTweak('showPrintRoute', false);
    notices.length = 0;
    lastPrintRoute = '';
    notePrintRoute('qz');
    out.offNotices = notices.length;
    out.offStillRecorded = lastPrintRoute;
    setPrintTweak('showPrintRoute', true);

    // ============================================================
    // ⭐⭐⭐ الطلب الجاي من التليفون بيكتب الطريق في الطلب
    // ============================================================
    // من غير كده اللي بعت من تليفونه لازم يروح للكمبيوتر يشوف التنبيه.
    const written = [];
    state.user = { uid: 'u1' };
    state.profile = { name: 'الكمبيوتر', role: 'owner' };
    window.db = {
      collection: () => ({
        doc: () => ({
          update: (o) => { written.push(o); return Promise.resolve(); },
          onSnapshot: () => () => {},
          get: async () => ({ exists: false, data: () => null }),
        }),
      }),
    };
    setPrintTweak('labelHelper', true);
    helperCache = null;
    await executePrintJob('j1', { type: 'label', jobs: [{ html: '<b>x</b>', image: PNG, copies: 1 }], sizeOptions: SIZE });
    const done = written.find((o) => o.status === 'printed');
    out.remoteWroteRoute = done ? done.printRoute : null;

    window.showPrintNotice = realNotice;
    window.fetch = realFetch;
    setPrintTweak('labelHelper', false);
    setPrintTweak('sheetHelper', false);
    return out;
  });

  check('⭐⭐⭐ الملصقات من البرنامج → بيقول "من البرنامج المساعد"',
    r.helperRoute === 'helper' && /البرنامج المساعد/.test(r.helperSaid), [r.helperRoute, r.helperSaid]);
  check('⭐⭐ وورقة التزويد كمان',
    r.sheetRoute === 'helper' && /البرنامج المساعد/.test(r.sheetSaid), [r.sheetRoute, r.sheetSaid]);
  check('⭐⭐⭐⭐ الملصق كنص مع المفتاح مفتوح → البرنامج مابياخدهاش',
    r.htmlUsedHelper === false && r.htmlRouteAfter === '', [r.htmlUsedHelper, r.htmlRouteAfter]);
  check('⭐⭐⭐ وساعتها بيقول "من QZ Tray"',
    r.qzRoute === 'qz' && /QZ Tray/.test(r.qzSaid), [r.qzRoute, r.qzSaid]);
  check('⭐⭐ ونافذة المتصفح ليها نصها', /نافذة المتصفح/.test(r.browserSaid), r.browserSaid);
  check('⭐⭐⭐⭐ رسالة "يمكن الورق خرج، متطبعش تاني" بتطلع **حمرا**',
    r.loudKind === 'bad', r.loudKind);
  check('⭐⭐ والرسالة العادية تحذير مش خطر', r.softKind === 'warn', r.softKind);
  check('⭐⭐ وطريق مش معروف مايطلّعش تنبيه فاضي', r.emptyNotices === 0, r.emptyNotices);
  check('⭐ والمفتاح مفتوح افتراضيًا (إحنا في نص التجربة)', r.defaultOn, r.defaultOn);
  check('⭐⭐⭐ وقفله بيوقّف التنبيه', r.offNotices === 0, r.offNotices);
  check('⭐⭐⭐⭐ **بس التسجيل بيفضل** — عشان التليفون يشوف الطريق برضه',
    r.offStillRecorded === 'qz', r.offStillRecorded);
  check('⭐⭐⭐⭐ الطلب الجاي من التليفون بيكتب الطريق مع النتيجة',
    r.remoteWroteRoute === 'helper', r.remoteWroteRoute);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
