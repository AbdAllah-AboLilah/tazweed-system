// ============================================================
// 🔒 نافذتين على نفس الكمبيوتر = طبعة واحدة
// ============================================================
// ⚠️⚠️ العطل اتشخّص من **بيانات الجهاز**: كارت الجهاز بيقول
//     آخر طبعة: ✅ ورقة تزويد 📦 من البرنامج المساعد
// يعني الطبعة نجحت. ومع ذلك نافذة طباعة ويندوز ظهرت والمستخدم عمل
// إلغاء والورقة طلعت. فالنافذة دي **مش من الطلب ده** — دي من نافذة
// تانية بتنفّذ نفس الطلب.
//
// --- وليه بقى بيحصل ---
// النظام بيسمع على الطلبات المتبعتة لرقم الجهاز. وقبل v0.91.0 كل
// متصفح كان ليه رقم عشوائي لوحده، فنافذة واحدة بس كانت بتشوف الطلب.
//
// ولما وحّدنا رقم الماكينة (عشان الكمبيوتر يتحسب جهاز واحد — وده
// اتطلب صراحةً)، **كل** النوافذ بقت بنفس الرقم، فكلها بتشوف نفس الطلب
// وكلها بتنفّذه.
//
// ⚠️ يعني إصلاح فتح عطل تاني. الفحص ده بيحرس إن الاتنين متحلّين مع
// بعض: الكمبيوتر جهاز واحد، **و** الطلب بيتنفّذ مرة واحدة.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof claimPrintJob === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };

    // ---- مساعد مقلّد فيه نفس قفل الحجز ----
    const taken = {};
    let helperOn = true;
    let hasClaimRoute = true;
    let claimCalls = 0;
    const realFetch = window.fetch;
    window.fetch = async (u, o) => {
      const t = String(u);
      if (t.indexOf('/status') !== -1) {
        if (!helperOn) throw new Error('مش شغّال');
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.7.0', printers: ['P'] }) };
      }
      if (t.indexOf('/claim') !== -1) {
        claimCalls++;
        if (!hasClaimRoute) return { ok: false, status: 404, json: async () => ({}) };
        const id = JSON.parse(o.body).job;
        const mine = !taken[id];
        taken[id] = true;
        return { ok: true, json: async () => ({ ok: true, mine }) };
      }
      return realFetch(u, o);
    };

    // ============================================================
    // ⭐⭐⭐⭐⭐ نافذتين بتشوفوا نفس الطلب → واحدة بس تنفّذه
    // ============================================================
    helperCache = null;
    out.first = await claimPrintJob('job-1');
    out.second = await claimPrintJob('job-1');
    out.third = await claimPrintJob('job-1');

    // وطلب تاني مالوش علاقة بيعدّي عادي
    out.otherJob = await claimPrintJob('job-2');

    // ============================================================
    // ⭐⭐⭐⭐ البرنامج مش شغّال → ننفّذ عادي
    // ============================================================
    // ⚠️ الأرقام مابتتوحّدش أصلًا من غيره، فالتصادم مش موجود.
    // والرفض هنا كان هيمنع الطباعة على الأجهزة اللي مافيهاش البرنامج.
    helperCache = null;
    helperOn = false;
    claimCalls = 0;
    out.noHelper = await claimPrintJob('job-3');
    out.noHelperCalls = claimCalls;
    helperOn = true;

    // ---------- نسخة قديمة من البرنامج مافيهاش الباب ----------
    helperCache = null;
    hasClaimRoute = false;
    out.oldHelper = await claimPrintJob('job-4');
    hasClaimRoute = true;

    // ---------- الاتصال بيقع ----------
    helperCache = null;
    window.fetch = async (u) => {
      if (String(u).indexOf('/status') !== -1) {
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.7.0', printers: ['P'] }) };
      }
      throw new Error('اتقطع');
    };
    out.brokenClaim = await claimPrintJob('job-5');

    window.fetch = realFetch;
    return out;
  });

  check('⭐⭐⭐⭐⭐ أول نافذة بتاخد الطلب', r.first === true, r.first);
  check('⭐⭐⭐⭐⭐ والتانية **مابتنفّذوش** (ده اللي بيمنع المعاينة)',
    r.second === false, r.second);
  check('⭐⭐⭐⭐ والتالتة كمان', r.third === false, r.third);
  check('⭐⭐⭐ وطلب تاني مالوش علاقة بيعدّي عادي', r.otherJob === true, r.otherJob);

  check('⭐⭐⭐⭐⭐ والبرنامج مش شغّال → الطلب بيتنفّذ عادي',
    r.noHelper === true, r.noHelper);
  check('⭐⭐⭐ ومن غير أي نداء زيادة على الشبكة', r.noHelperCalls === 0, r.noHelperCalls);

  // ⚠️ الطبعة الضايعة أوحش من الطبعة المكررة — فأي فشل معناه "نفّذ".
  check('⭐⭐⭐⭐ ونسخة قديمة من البرنامج (مافيهاش الباب) → بيتنفّذ',
    r.oldHelper === true, r.oldHelper);
  check('⭐⭐⭐⭐ والاتصال لو وقع → بيتنفّذ', r.brokenClaim === true, r.brokenClaim);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
