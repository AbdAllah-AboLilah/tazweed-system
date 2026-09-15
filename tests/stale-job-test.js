// ============================================================
// ⏳ طلب الطباعة القديم مايتطبعش — بيتقفل
// ============================================================
// ⚠️⚠️ العطل ده اتشخّص **من بيانات الجهاز نفسه** بعد ما اتشخّص غلط
// أربع مرات بالتخمين. كارت الجهاز قال:
//     آخر طبعة: ✅ ورقة تزويد 📦 من البرنامج المساعد
//     السبب:    اتطبعت من البرنامج المساعد.
// يعني الطلب اللي اتبعت **نجح**. ومع ذلك نافذة طباعة ويندوز ظهرت
// والمستخدم عمل إلغاء والورقة طلعت.
//
// فالنافذة دي مش من الطلب الجديد — دي من **طلب قديم** بيتنفّذ في نفس
// اللحظة.
//
// --- السبب ---
// الاستماع كان بياخد كل طلب حالته pending للجهاز ده، من غير أي حد
// للعمر. والحماية من التكرار (handledPrintJobIds) عايشة في ذاكرة
// الصفحة وبتتفضّى مع كل فتح للتطبيق.
//
// وكان فيه طلبات كتير عالقة على pending: عطل النافذة المخفية (قبل
// v0.89.0) كان **بيعلّق الطلب للأبد** من غير ما يكتب نتيجة. فكل مرة
// التطبيق يقفل ويفتح، البقايا دي بتتنفّذ من الأول.
//
// ⚠️ والفحص ده بيقيس السلوك، مش بيقرا الكود: القديم مايوصلش
// executePrintJob خالص، والجديد يوصل.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof subscribePrintJobs === 'function' && typeof PRINT_JOB_MAX_AGE_MS === 'number');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', name: 'أنا', role: 'owner' };

    const executed = [];
    const closed = [];
    window.executePrintJob = async (id) => { executed.push(id); };
    window.getDeviceId = () => 'dev-1';

    let snapCb = null;
    window.db = {
      collection: () => ({
        add: async () => ({}),
        doc: (id) => ({
          update: async (data) => { closed.push({ id, data }); },
          set: async () => {},
          onSnapshot: () => () => {},
        }),
        where: function () { return this; },
        onSnapshot: (cb) => { snapCb = cb; return () => {}; },
      }),
    };
    window.firebase = {
      firestore: { FieldValue: { serverTimestamp: () => 'TS' } },
    };

    const MIN = 60 * 1000;
    const job = (id, ageMin) => ({
      id,
      data: () => ({
        targetDeviceId: 'dev-1',
        status: 'pending',
        type: 'restock',
        // ⚠️ شكل تاريخ فايرستور: كائن فيه toMillis
        createdAt: ageMin === null ? null : { toMillis: () => Date.now() - ageMin * MIN },
      }),
    });

    subscribePrintJobs();
    snapCb({
      docs: [
        job('جديد', 0),          // دلوقتي
        job('مقبول', 5),          // 5 دقايق — لسه مقبول
        job('قديم', 45),          // 45 دقيقة — بقايا
        job('قديم-جدًا', 60 * 26), // من امبارح
        job('بدون-تاريخ', null),  // التاريخ لسه ماوصلش
      ],
    });
    await new Promise((r2) => setTimeout(r2, 50));

    out.executed = executed.slice();
    out.closed = closed.map((c) => c.id);
    out.closedReason = (closed[0] && closed[0].data && closed[0].data.failReason) || '';
    out.closedStatus = (closed[0] && closed[0].data && closed[0].data.status) || '';
    out.maxAgeMin = PRINT_JOB_MAX_AGE_MS / 60000;
    return out;
  });

  check('⭐⭐⭐⭐⭐ الطلب القديم **مايتطبعش** (ده العطل)',
    r.executed.indexOf('قديم') === -1 && r.executed.indexOf('قديم-جدًا') === -1, r.executed);
  check('⭐⭐⭐⭐⭐ والطلب الجديد بيتطبع عادي',
    r.executed.indexOf('جديد') !== -1, r.executed);
  check('⭐⭐⭐⭐ والطلب اللي بقاله 5 دقايق لسه بيتطبع (الجهاز كان مشغول)',
    r.executed.indexOf('مقبول') !== -1, r.executed);

  // ⚠️ اللي معرفناش عمره بيتطبع: أحسن من إننا نضيّع طلب حقيقي.
  check('⭐⭐⭐⭐ واللي تاريخه لسه ماوصلش بيتطبع مش بيتقفل',
    r.executed.indexOf('بدون-تاريخ') !== -1, r.executed);

  check('⭐⭐⭐⭐⭐ والقديم **بيتقفل** مش بيتساب معلّق',
    r.closed.indexOf('قديم') !== -1 && r.closed.indexOf('قديم-جدًا') !== -1, r.closed);
  check('⭐⭐⭐⭐ بحالة "فشل" (الانتقال المسموح في القواعد)',
    r.closedStatus === 'failed', r.closedStatus);
  check('⭐⭐⭐⭐ ومعاه سبب مفهوم بيقول عمره',
    /الطلب قديم/.test(r.closedReason) && /دقيقة/.test(r.closedReason), r.closedReason);
  check('⭐⭐ ومابيتقفلش الجديد', r.closed.indexOf('جديد') === -1, r.closed);
  check('⭐⭐⭐ والحد 10 دقايق', r.maxAgeMin === 10, r.maxAgeMin);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
