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
    q.doc = () => ({
      set: async (data) => { if (data.helperCmdResult) out.reports.push(data.helperCmdResult); },
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
