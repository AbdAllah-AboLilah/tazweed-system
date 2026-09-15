// ============================================================
// 🖥️ الطباعة والنافذة مخفية — وده الوضع الطبيعي مش الاستثناء
// ============================================================
// ⚠️⚠️ العطل اللي بيتحل، اتبلّغ بالنص على مرتين، والجملتين مع بعض هما
// اللي حلّوه:
//   "جهاز الكمبيوتر لما بطبع منه مبيعملش معاينه ولما ببعت من التليفون
//    في ورق بيطلع ب معاينه وورق من غير معاينه"
//   "النظام انا مثبته علي سطح المكتب وفي نفس الوقت في برامج تانيه
//    شغاله علي جهاز الكمبيوتر"
//
// يعني: الطباعة من الكمبيوتر **وانت قدامه** شغّالة دايمًا، والطباعة من
// التليفون **والنافذة مخفية** هي اللي بتلخبط.
//
// --- السبب ---
// قياس طول الورقة كان بيستنى `requestAnimationFrame`، وكروم **بيوقّفه
// خالص** للنافذة المخفية (مش بيبطّئه — بيوقّفه). فالوعد عمره ما بيتحقق،
// ورسم الورقة بيتعلّق، والطلب كله بيقف مستني من غير أي رسالة.
//
// القياس قبل الإصلاح:
//     النافذة قدامك       → صورة في 0.4 ثانية
//     النافذة مخفية       → **اتعلّقت، عمرها ما رجعت**
//     إطارات بطيئة (1/ث)  → صورة في 5.3 ثانية
//
// ⚠️ ودي حالة الاستعمال الأساسية: الطباعة عن بُعد معناها بالتعريف إن
// محدش واقف قدام الجهاز.
//
// ⚠️⚠️ وأخطر حاجة في الملف ده مش السرعة — إن **الصورة تفضل هي هي**.
// كل حكاية قص ورقة التزويد في v0.77 كانت من قياس طول غلط، فأي تعديل
// في القياس لازم يثبت إنه مابيغيّرش ولا بايت.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof renderSheetImage === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const sheet = (rows) => {
      let body = '';
      for (let i = 1; i <= rows; i++) {
        body += `<div style="font-size:13px;padding:2px 0;border-bottom:1px solid #000">صنف ${i} — درجة ${i % 9} — كمية ${i % 40}</div>`;
      }
      return `<html><head><meta charset="utf-8"><style>body{width:72.1mm;margin:0;font-family:sans-serif}</style></head><body>${body}</body></html>`;
    };

    const realRAF = window.requestAnimationFrame;
    // ⚠️ النافذة المخفية في كروم: الإطار **مابيتندهش أبدًا**. مش تأخير،
    // وقوف تام. عشان كده التقليد بيرجّع 0 ومابينفّذش الدالة.
    const hiddenRAF = () => 0;
    // ونافذة ورا نافذة تانية: إطار كل ثانية تقريبًا.
    const slowRAF = (cb) => setTimeout(() => cb(performance.now()), 1000);

    const timed = async (raf, html) => {
      window.requestAnimationFrame = raf;
      const t0 = Date.now();
      const res = await Promise.race([
        renderSheetImage(html),
        new Promise((r2) => setTimeout(() => r2('__وقفت__'), 8000)),
      ]);
      window.requestAnimationFrame = realRAF;
      return { res, ms: Date.now() - t0 };
    };

    // ============================================================
    // ⭐⭐⭐⭐⭐ النافذة المخفية لازم ترسم، مش تتعلّق
    // ============================================================
    const html120 = sheet(120);
    const front = await timed(realRAF, html120);
    const hidden = await timed(hiddenRAF, html120);
    const slow = await timed(slowRAF, html120);

    out.frontOK = !!(front.res && front.res.image);
    out.hiddenOK = !!(hidden.res && hidden.res.image);
    out.slowOK = !!(slow.res && slow.res.image);
    out.hiddenHung = hidden.res === '__وقفت__';
    out.hiddenMs = hidden.ms;
    out.frontMs = front.ms;

    // ============================================================
    // ⭐⭐⭐⭐⭐ والصورة **هي هي** — مش أقصر ولا مقصوصة
    // ============================================================
    // ده الحارس اللي بيمنع تكرار عطل v0.77: قياس أسرع بطول غلط بيطلّع
    // ورقة مقصوصة، والمستخدم مابيكتشفش غير على الورق.
    out.same = {};
    for (const rows of [40, 120, 300]) {
      const html = sheet(rows);
      const f = await timed(realRAF, html);
      const h = await timed(hiddenRAF, html);
      const s = await timed(slowRAF, html);
      out.same[rows] = {
        identical:
          !!(f.res && f.res.image) &&
          f.res.image === (h.res && h.res.image) &&
          f.res.image === (s.res && s.res.image),
        mm: [f.res && f.res.heightMm, h.res && h.res.heightMm, s.res && s.res.heightMm],
      };
    }

    // ============================================================
    // ⭐⭐⭐⭐⭐ والمسار كامل: طلب جاي من التليفون والنافذة مخفية
    // ============================================================
    // ⚠️⚠️ ده الفحص اللي بيثبت إن **العطل اللي اتبلّغ** اتحل، مش إن
    // دالة الرسم بقت أسرع. اللي المستخدم بيشوفه هو: ورقة بتيجي من
    // التليفون → نافذة طباعة بتفتح على الكمبيوتر. فالفحص بيقيس
    // بالظبط: هل نافذة المتصفح بتتفتح ولا لأ.
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };
    try { localStorage.setItem('tazweed_qz_tweak_sheetHelper', '1'); } catch (e) {}

    let helperPrints = 0;
    let browserOpened = 0;
    const realFetch = window.fetch;
    window.fetch = async (u, o) => {
      const t = String(u);
      if (t.indexOf('/status') !== -1) {
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.5.0', printers: ['P'] }) };
      }
      if (t.indexOf('/print') !== -1) { helperPrints++; return { ok: true, json: async () => ({ ok: true }) }; }
      return realFetch(u, o);
    };
    window.getSavedPrinter = () => 'P';
    window.printHTMLSilently = () => { browserOpened++; };
    window.tryPrintViaQZ = async () => false; // QZ مش شغّال، زي ما بيحصل
    window.db = { collection: () => ({ add: async () => ({}), doc: () => ({ update: async () => {}, onSnapshot: () => () => {}, set: async () => {} }) }) };
    const realNotice2 = window.showPrintNotice;
    window.showPrintNotice = () => {};

    const job = { type: 'restock', sizeOptions: null, spec: null, jobs: [{ html: sheet(120), copies: 1 }] };
    helperCache = null;
    window.requestAnimationFrame = hiddenRAF;   // النافذة مخفية
    const t1 = Date.now();
    const finished = await Promise.race([
      executePrintJob('j-hidden', job).then(() => 'خلصت'),
      new Promise((r2) => setTimeout(() => r2('__وقفت__'), 10000)),
    ]);
    window.requestAnimationFrame = realRAF;
    out.e2e = {
      finished: finished === 'خلصت',
      helperPrints,
      browserOpened,
      ms: Date.now() - t1,
    };

    window.showPrintNotice = realNotice2;
    window.fetch = realFetch;
    window.requestAnimationFrame = realRAF;
    return out;
  });

  check('⭐⭐ النافذة قدامك بترسم (الوضع الطبيعي شغّال)', r.frontOK === true, r.frontOK);

  check('⭐⭐⭐⭐⭐ والنافذة مخفية بترسم كمان — مابتتعلّقش',
    r.hiddenOK === true && r.hiddenHung === false, { ok: r.hiddenOK, hung: r.hiddenHung });
  check('⭐⭐⭐⭐ وفي وقت معقول مش دقايق', r.hiddenMs < 5000, r.hiddenMs);
  check('⭐⭐⭐ والنافذة ورا نافذة تانية بترسم برضه', r.slowOK === true, r.slowOK);

  // ⚠️ الوضع العادي مايتأثرش: الإطار بيكسب السباق وهو موجود.
  check('⭐⭐⭐ والوضع العادي مابطّأش', r.frontMs < 3000, r.frontMs);

  Object.keys(r.same).forEach((rows) => {
    check(`⭐⭐⭐⭐⭐ الصورة مطابقة بايت ببايت في التلات حالات (${rows} صف)`,
      r.same[rows].identical === true, r.same[rows]);
  });

  // ============================================================
  // ⭐⭐⭐⭐⭐ الإثبات النهائي — ده اللي المستخدم بيشوفه
  // ============================================================
  check('⭐⭐⭐⭐⭐ طلب من التليفون والنافذة مخفية: الطبعة بتخلص مش بتتعلّق',
    r.e2e.finished === true, r.e2e);
  check('⭐⭐⭐⭐⭐ وبتروح للبرنامج المساعد فعلًا',
    r.e2e.helperPrints === 1, r.e2e);
  check('⭐⭐⭐⭐⭐ و**مافيش** نافذة طباعة بتتفتح على الكمبيوتر (ده العطل)',
    r.e2e.browserOpened === 0, r.e2e);
  check('⭐⭐⭐ وفي وقت معقول', r.e2e.ms < 8000, r.e2e.ms);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
