// ============================================================
// 🔗 أوامر لكل الأجهزة + حالة الطابعة
// ============================================================
// اتطلب بالنص:
//   "هل في طريقه اوحد الاعدادات علي كل برامج المساعده"
//   "او ممكن اطلب ان كل نسخ المساعد ... تتحدث ل احدث اصدار"
//
// ⚠️⚠️ الخطر هنا مش "بيشتغل ولا لأ" — ده إن أمر واحد يتنفّذ **أكتر
// من مرة**. توحيد الإعدادات مرتين معناه إن اللي المستخدم غيّره بين
// المرتين بيتمسح. فالحراس على التكرار مش على النجاح.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 220)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 420, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof handleHelperCommand === 'function' && typeof readHelperPrinterState === 'function');

  const r = await p.evaluate(async () => {
    const out = { calls: [], reports: [] };
    state.user = { uid: 'me' };
    state.profile = { id: 'me', name: 'x', role: 'owner' };

    // سحابة مقلّدة بتسجّل نتايج الأوامر
    const q = {};
    out.sent = [];
    q.doc = (docId) => ({
      set: async (data) => {
        if (data.helperCmdResult) out.reports.push(data.helperCmdResult);
        // ⚠️ الأوامر المتبعتة لأجهزة تانية — ده قلب فحص التمرير (export)
        if (data.helperCmd) out.sent.push({ to: docId, cmd: data.helperCmd });
      },
      get: async () => ({ exists: false, data: () => ({}) }),
      update: async () => {}, delete: async () => {}, onSnapshot: () => () => {},
    });
    q.where = () => q; q.orderBy = () => q; q.limit = () => q;
    q.onSnapshot = () => () => {}; q.add = async () => ({ id: 'x' });
    q.get = async () => ({ empty: true, docs: [], forEach: () => {} });
    window.db = { collection: () => q };

    // مساعد مقلّد
    window.__helperUp = true;
    window.__importOk = true;
    window.fetch = async (u, opt) => {
      const url = String(u);
      out.calls.push(url.replace('http://127.0.0.1:7770', ''));
      // ⚠️ الترتيب مهم: '/printer/status' جوّاها '/status'، فلو
      // فحصنا القصيرة الأول هتبلع الطويلة.
      if (url.indexOf('/printer/status') !== -1) {
        return { ok: true, json: async () => ({ name: 'P235', raw: 16, blocking: true, summary: '⚠️ الورق خلص' }) };
      }
      if (url.indexOf('/status') !== -1) {
        if (!window.__helperUp) throw new Error('مقفول');
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.12.0', printers: ['P'] }) };
      }
      if (url.indexOf('/settings/export') !== -1) {
        return { ok: true, json: async () => ({ labelPrinter: 'P235', designs: [{ name: 'د' }] }) };
      }
      if (url.indexOf('/settings/import') !== -1) {
        return { ok: true, json: async () => (window.__importOk ? { ok: true, designs: 1 } : { ok: false, error: 'الملف بايظ' }) };
      }
      if (url.indexOf('/update/apply') !== -1) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      throw new Error('مش متوقّع: ' + url);
    };

    const reset = () => {
      out.calls.length = 0; out.reports.length = 0;
      helperCache = null; helperCacheAt = 0;
      printerStateCache = null; printerStateAt = 0;
      try { localStorage.removeItem('tazweed_helper_cmd_seen'); } catch (e) {}
      helperCmdSeeded = false;
    };
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));

    // ---- (1) أول لقطة = تسجيل بس، مافيش تنفيذ ----
    reset();
    handleHelperCommand({ helperCmd: { id: '111', kind: 'sync', payload: { a: 1 } } });
    await wait(150);
    out.firstSnapshotCalls = out.calls.filter((c) => c.indexOf('/settings/import') !== -1).length;

    // ---- (2) أمر جديد = ينفّذ مرة واحدة ----
    out.calls.length = 0; out.reports.length = 0;
    handleHelperCommand({ helperCmd: { id: '222', kind: 'sync', payload: { a: 1 } } });
    await wait(250);
    out.syncImports = out.calls.filter((c) => c.indexOf('/settings/import') !== -1).length;
    out.syncReport = out.reports[0] || null;

    // ---- (3) نفس الأمر تاني = **مايتنفّذش** ----
    out.calls.length = 0;
    handleHelperCommand({ helperCmd: { id: '222', kind: 'sync', payload: { a: 1 } } });
    await wait(200);
    out.repeatImports = out.calls.filter((c) => c.indexOf('/settings/import') !== -1).length;

    // ---- (4) أمر التحديث ----
    out.calls.length = 0; out.reports.length = 0;
    handleHelperCommand({ helperCmd: { id: '333', kind: 'update' } });
    await wait(250);
    out.updateCalls = out.calls.filter((c) => c.indexOf('/update/apply') !== -1).length;
    out.updateReport = out.reports[0] || null;

    // ---- (5) نوع مش معروف = يتجاهل ----
    out.calls.length = 0; out.reports.length = 0;
    handleHelperCommand({ helperCmd: { id: '444', kind: 'يمسح_كل_حاجة' } });
    await wait(200);
    out.unknownCalls = out.calls.length;
    out.unknownReports = out.reports.length;

    // ---- (6) المساعد مقفول = بيرد بالسبب ----
    reset();
    helperCmdSeeded = true;
    window.__helperUp = false;
    handleHelperCommand({ helperCmd: { id: '555', kind: 'update' } });
    await wait(250);
    out.downReport = out.reports[0] || null;
    window.__helperUp = true;

    // ---- (7) الاستيراد فشل = بيرد بالخطأ مش بينجح ----
    reset();
    helperCmdSeeded = true;
    window.__importOk = false;
    handleHelperCommand({ helperCmd: { id: '666', kind: 'sync', payload: { a: 1 } } });
    await wait(250);
    out.badReport = out.reports[0] || null;
    window.__importOk = true;

    // ============================================================
    // 📤 (9-13) التمرير: "يا جهاز كذا، وزّع إعداداتك"
    // ============================================================
    // ⚠️ ده اللي بيخلي الخطوة تشتغل من التليفون. التليفون مالوش
    // مساعد يقرا منه، فبيطلب من كمبيوتر إنه يبقى هو المصدر.
    window.getDeviceId = () => 'me-device';

    // ---- (9) التمرير بيقرا محليًا وبيوزّع sync ----
    reset();
    helperCmdSeeded = true;
    out.sent.length = 0;
    handleHelperCommand({ helperCmd: { id: '777', kind: 'export', to: ['a', 'b'] } });
    await wait(300);
    out.expExports = out.calls.filter((c) => c.indexOf('/settings/export') !== -1).length;
    out.expSent = out.sent.slice();
    out.expReport = out.reports[0] || null;

    // ---- (10) الجهاز نفسه بيتشال من القايمة ----
    reset();
    helperCmdSeeded = true;
    out.sent.length = 0;
    handleHelperCommand({ helperCmd: { id: '888', kind: 'export', to: ['a', 'me-device'] } });
    await wait(300);
    out.selfSent = out.sent.map((x) => x.to);

    // ---- (11) من غير أجهزة = بيرد بالسبب ومابيقراش أصلًا ----
    reset();
    helperCmdSeeded = true;
    out.sent.length = 0;
    handleHelperCommand({ helperCmd: { id: '999', kind: 'export', to: [] } });
    await wait(300);
    out.emptyReport = out.reports[0] || null;
    out.emptyExports = out.calls.filter((c) => c.indexOf('/settings/export') !== -1).length;
    out.emptySent = out.sent.length;

    // ---- (12) المساعد مقفول = مافيش توزيع خالص ----
    reset();
    helperCmdSeeded = true;
    out.sent.length = 0;
    window.__helperUp = false;
    handleHelperCommand({ helperCmd: { id: 'aaa', kind: 'export', to: ['a'] } });
    await wait(300);
    out.expDownReport = out.reports[0] || null;
    out.expDownSent = out.sent.length;
    window.__helperUp = true;

    // ---- (13) نفس أمر التمرير تاني = **مايتنفّذش** ----
    reset();
    helperCmdSeeded = true;
    out.sent.length = 0;
    handleHelperCommand({ helperCmd: { id: 'bbb', kind: 'export', to: ['a'] } });
    await wait(300);
    out.expFirst = out.sent.length;
    out.sent.length = 0;
    handleHelperCommand({ helperCmd: { id: 'bbb', kind: 'export', to: ['a'] } });
    await wait(300);
    out.expRepeat = out.sent.length;

    // ============================================================
    // ⏱️ (14-17) الأمر الطازة بينفّذ حتى في أول لقطة
    // ============================================================
    // ⚠⚠ اتبلّغ بالنص: "انا فتحت جهاز وبعت تحديث مش راضي يروحله".
    // الجهاز اللي بيفتح دلوقتي، أول لقطة عنده فيها الأمر اللي اتكتب
    // من ثانيتين — وكان بيتسجّل كأنه قديم ويضيع.

    // ---- (14) أمر طازة + أول لقطة = **بينفّذ** ----
    reset();
    out.calls.length = 0;
    handleHelperCommand({ helperCmd: { id: 'f1', kind: 'update', at: Date.now() - 2000 } });
    await wait(300);
    out.freshFirst = out.calls.filter((c) => c.indexOf('/update/apply') !== -1).length;

    // ⚠️ **من غير reset** عن قصد: بنجرّب نفس الأمر تاني على نفس
    // الجلسة. أي تصفير هنا بيمسح ختم "اتنفّذ خلاص" والفحص يبقى فاضي.
    out.calls.length = 0;
    handleHelperCommand({ helperCmd: { id: 'f1', kind: 'update', at: Date.now() } });
    await wait(300);
    out.freshRepeat = out.calls.filter((c) => c.indexOf('/update/apply') !== -1).length;

    // ---- (15) أمر قديم + أول لقطة = **مايتنفّذش** ----
    reset();
    out.calls.length = 0;
    handleHelperCommand({ helperCmd: { id: 'f2', kind: 'update', at: Date.now() - 60 * 60 * 1000 } });
    await wait(300);
    out.staleFirst = out.calls.filter((c) => c.indexOf('/update/apply') !== -1).length;

    // ---- (16) أمر من غير طابع وقت = بيتعامل كقديم (نسخة أقدم) ----
    reset();
    out.calls.length = 0;
    handleHelperCommand({ helperCmd: { id: 'f3', kind: 'update' } });
    await wait(300);
    out.noStampFirst = out.calls.filter((c) => c.indexOf('/update/apply') !== -1).length;

    // ---- (18) الأمر المتبعت عليه طابع وقت ----
    out.sent.length = 0;
    await sendHelperCommand(['z1'], 'update');
    out.stampSent = out.sent[0] && typeof out.sent[0].cmd.at === 'number'
      && Math.abs(Date.now() - out.sent[0].cmd.at) < 5000;

    // ---- (8) حالة الطابعة ----
    printerStateCache = null; printerStateAt = 0;
    out.calls.length = 0;
    out.pstate = await readHelperPrinterState();
    await readHelperPrinterState();
    out.pstateCalls = out.calls.filter((c) => c.indexOf('/printer/status') !== -1).length;

    return out;
  });

  // ============================================================
  // ⭐⭐⭐⭐⭐ التنفيذ مرة واحدة بالظبط
  // ============================================================
  check('⭐⭐⭐⭐⭐ أول لقطة بعد فتح الصفحة **مابتنفّذش**', r.firstSnapshotCalls === 0, r.firstSnapshotCalls);
  check('⭐⭐⭐⭐ والأمر الجديد بينفّذ', r.syncImports === 1, r.syncImports);
  // ⚠️⚠️ أهم فحص: توحيد الإعدادات مرتين بيمسح اللي المستخدم غيّره
  // بين المرتين.
  check('⭐⭐⭐⭐⭐ ونفس الأمر تاني **مابيتنفّذش**', r.repeatImports === 0, r.repeatImports);

  check('⭐⭐⭐⭐ وبيرد بنتيجة النجاح', r.syncReport && r.syncReport.ok === true, r.syncReport);
  check('⭐⭐⭐ والنتيجة عليها معرّف الأمر', r.syncReport && r.syncReport.id === '222', r.syncReport);

  check('⭐⭐⭐⭐ أمر التحديث بينده /update/apply', r.updateCalls === 1, r.updateCalls);
  check('⭐⭐⭐ وبيرد نجاح', r.updateReport && r.updateReport.ok === true, r.updateReport);

  // ⚠️⚠️ قايمة مقفولة: أمر من نسخة أجدد (أو حد لعب في المستند)
  // مايتنفّذش ومايتسجّلش.
  check('⭐⭐⭐⭐⭐ نوع أمر مش معروف بيتجاهل تمامًا',
    r.unknownCalls === 0 && r.unknownReports === 0, { c: r.unknownCalls, rep: r.unknownReports });

  // ⚠️ الجهاز اللي مافيهوش مساعد **بيقول كده** — من غيره اللي بعت
  // الأمر بيفتكر إن كله اتنفّذ.
  check('⭐⭐⭐⭐⭐ المساعد المقفول بيرد بالسبب',
    r.downReport && r.downReport.ok === false && /مش شغّال/.test(r.downReport.msg), r.downReport);
  check('⭐⭐⭐⭐ والفشل في الاستيراد بيرجّع الخطأ مش نجاح',
    r.badReport && r.badReport.ok === false && /بايظ/.test(r.badReport.msg), r.badReport);

  // ============================================================
  // ⭐⭐⭐⭐ حالة الطابعة
  // ============================================================
  check('⭐⭐⭐⭐ بتتقرا من البرنامج',
    r.pstate && r.pstate.blocking === true && /الورق خلص/.test(r.pstate.summary), r.pstate);
  // ⚠️ متخزّنة: النبضة بتشتغل كل 45 ثانية، والنداء ده محلي بس
  // مايصحّش يتكرر مع كل قراية.
  check('⭐⭐⭐ ومتخزّنة (نداء واحد للاتنين)', r.pstateCalls === 1, r.pstateCalls);

  // ============================================================
  // 📤 التمرير من التليفون
  // ============================================================
  // اتطلب بالنص: "ينفع اعمل الخطوة دي من التليفون يعني اقول مثلا
  // المساعد بتاع الجهاز الفلاني المتصل ده عاوز اعداداته ... تعمم".
  check('⭐⭐⭐⭐⭐ التمرير بيقرا إعدادات المساعد المحلي مرة واحدة',
    r.expExports === 1, r.expExports);
  check('⭐⭐⭐⭐⭐ وبيبعت sync لكل جهاز في القايمة',
    r.expSent.length === 2 && r.expSent.every((x) => x.cmd.kind === 'sync') &&
    r.expSent.map((x) => x.to).sort().join(',') === 'a,b',
    r.expSent);
  // ⚠️ الإعدادات نفسها لازم تروح — أمر sync فاضي بيتجاهل عند
  // المستقبِل ويرد "الأمر جه من غير إعدادات".
  check('⭐⭐⭐⭐ والإعدادات نفسها بتتحط في الأمر',
    r.expSent.length === 2 && r.expSent.every((x) => x.cmd.payload && x.cmd.payload.labelPrinter === 'P235'),
    r.expSent[0] && r.expSent[0].cmd);
  check('⭐⭐⭐ والمصدر بيرد بعدد اللي اتبعتلهم',
    r.expReport && r.expReport.ok === true && /2/.test(r.expReport.msg), r.expReport);

  // ⚠️ من غير ده الجهاز بيبعت لنفسه أمر توحيد — حلقة مالهاش لازمة
  // وممكن تلخبط الردود.
  check('⭐⭐⭐⭐ الجهاز المصدر مابيبعتش لنفسه',
    r.selfSent.length === 1 && r.selfSent[0] === 'a', r.selfSent);

  check('⭐⭐⭐⭐ أمر تمرير من غير أجهزة بيرد بالسبب ومابيقراش',
    r.emptyReport && r.emptyReport.ok === false && r.emptyExports === 0 && r.emptySent === 0,
    { rep: r.emptyReport, ex: r.emptyExports, sent: r.emptySent });

  // ⚠️⚠️ الأخطر: المساعد مقفول على المصدر. لو وزّعنا برضه،
  // هنكتب فوق إعدادات كل الأجهزة بحاجة فاضية.
  check('⭐⭐⭐⭐⭐ المصدر اللي مساعده مقفول **مايوزّعش**',
    r.expDownSent === 0 && r.expDownReport && r.expDownReport.ok === false,
    { sent: r.expDownSent, rep: r.expDownReport });

  check('⭐⭐⭐⭐⭐ ونفس أمر التمرير تاني مابيتنفّذش',
    r.expFirst === 1 && r.expRepeat === 0, { first: r.expFirst, again: r.expRepeat });

  // ============================================================
  // ⚠️⚠️ الجهاز المقفول: بيتشال من الاستهداف، والنص بيقول كده
  // ============================================================
  // الأمر اللي بيتكتب لجهاز مقفول بيتلغي أول ما يفتح (أول لقطة =
  // تسجيل وبس، وده متفحوص فوق). فالنص اللي كان بيقول "الجهاز المقفول
  // بينفّذ أول ما يفتح" كان **بيوعد بحاجة مش بتحصل**.
  const core = require('fs').readFileSync(require('path').join(__dirname, '..', 'js/print-core.js'), 'utf8');
  check('⭐⭐⭐⭐⭐ النص مابيوعدش إن المقفول هينفّذ لما يفتح',
    !/الجهاز المقفول بينفّذ/.test(core) && /الجهاز المقفول مش هيستلم/.test(core));
  check('⭐⭐⭐⭐ والاستهداف على الفاتحين بس',
    /const onlineOthers = \(\) => others\(\)\.filter\(\(x\) => isStationOnline\(x\)\);/.test(core) &&
    /const targetsFor = \(src\) => onlineOthers\(\)/.test(core));

  // ============================================================
  // ⏱️ الأمر الطازة
  // ============================================================
  // ⚠⚠ ده اللي بيحل "فتحت جهاز وبعت تحديث مش راضي يروحله".
  check('⭐⭐⭐⭐⭐ أمر اتبعت من ثانيتين بينفّذ حتى لو أول لقطة',
    r.freshFirst === 1, r.freshFirst);
  // ⚠⚠ والحارس الأصلي لسه مكانه: أمر من ساعة مايترجعش تاني —
  // توحيد الإعدادات مرتين بيرجّع اللي المستخدم غيّره بينهم.
  check('⭐⭐⭐⭐⭐ وأمر من ساعة **مايتنفّذش** في أول لقطة',
    r.staleFirst === 0, r.staleFirst);
  check('⭐⭐⭐⭐ وأمر من غير طابع وقت بيتعامل كقديم (الأأمن)',
    r.noStampFirst === 0, r.noStampFirst);
  check('⭐⭐⭐⭐⭐ والطازة برضه مابتتكررش',
    r.freshRepeat === 0, r.freshRepeat);
  check('⭐⭐⭐⭐ والأمر المتبعت عليه طابع وقت', r.stampSent === true, r.stampSent);

  // ⚠⚠ الردود بتخص الأمر اللي اتبعت دلوقتي بس — الشرح في print-core.
  const core2 = require('fs').readFileSync(require('path').join(__dirname, '..', 'js/print-core.js'), 'utf8');
  check('⭐⭐⭐⭐⭐ والردود بتتفلتر بمعرّف الأمر (مش بترجع ردود قديمة)',
    /String\(r\.id \|\| ''\) !== cmdId/.test(core2) && /let cmdId = '';/.test(core2));

  check('⭐ مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  console.log(pass.map((x) => '   ✓ ' + x).join('\n'));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    console.log(fail.map((x) => '   ✗ ' + x).join('\n'));
    process.exit(1);
  }
  console.log(`\nكل الفحوص نجحت (${pass.length}).`);
})();
