// ============================================================
// 🔌 فحص البرنامج المساعد: الفشل مايتخزّنش للأبد
// ============================================================
// ⚠️⚠️ العطل اللي بيتحل، اتبلّغ بالنص: "بردوا في ورق لما يتبعت بيجي
// امر الاول علي جهاز الكمبيوتر ويظهر المعاينه"، ومعاه: "النظام علي
// الكمبيوتر علي احدث نسخة ومتصل بالمساعد ونفس الوضع في الهاتف".
//
// والاتنين صح مع بعض: البرنامج شغّال **دلوقتي**، بس النظام سأل عنه
// مرة واحدة زمان ولقاه مش شغّال، وخزّن الإجابة **للأبد**:
//     if (helperCache !== null) return helperCache;
//
// وده بيحصل كل يوم في المحل: الكمبيوتر بيقوم، المتصفح بيفتح مع
// الويندوز، والبرنامج لسه بيشتغل. أول طبعة بتلاقيه مش جاهز، وباقي
// اليوم كله بيروح لنافذة المتصفح — والورقة بتتقص.
//
// ⚠️ والفحص ده بيحرس **التكلفة** كمان: النجاح لازم يفضل متخزّن
// للجلسة، وإلا كل طبعة هتدفع فحص شبكة زيادة. صاحب النظام طلب صراحةً
// إن سرعة النظام ماتقلّش.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof helperStatus === 'function' && typeof HELPER_MISS_TTL_MS === 'number');

  const r = await p.evaluate(async () => {
    const out = {};
    let probes = 0;
    let running = false;

    const realFetch = window.fetch;
    window.fetch = async (u, o) => {
      const s = String(u);
      if (s.indexOf('/status') !== -1) {
        probes++;
        if (!running) throw new Error('البرنامج مش شغّال');
        return { ok: true, json: async () => ({ app: 'tazweed-helper', version: '1.5.0', printers: ['P'] }) };
      }
      return realFetch(u, o);
    };

    const reset = () => { helperCache = null; helperCacheAt = 0; probes = 0; };

    // ============================================================
    // ⭐⭐⭐⭐⭐ السيناريو الحقيقي: البرنامج بيشتغل **بعد** أول فحص
    // ============================================================
    reset();
    running = false;
    out.firstMiss = !(await helperStatus());          // مش شغّال
    running = true;                                    // البرنامج قام دلوقتي
    out.stillMissImmediately = !(await helperStatus()); // جوّه نافذة الـTTL: لسه لأ
    out.probesInWindow = probes;

    // ⚠️ بنزوّر مرور الوقت بدل ما ننتظر — الفحص لازم يفضل سريع.
    helperCacheAt = Date.now() - (HELPER_MISS_TTL_MS + 1000);
    const after = await helperStatus();
    out.foundAfterTTL = !!(after && after.app);
    out.probesAfterTTL = probes;

    // ============================================================
    // ⭐⭐⭐⭐ النجاح بيفضل متخزّن للجلسة (السرعة)
    // ============================================================
    reset();
    running = true;
    await helperStatus();
    await helperStatus();
    await helperStatus();
    out.probesWhenRunning = probes;

    // ============================================================
    // ⭐⭐⭐ والفشل مابيغرقش الشبكة جوّه النافذة
    // ============================================================
    reset();
    running = false;
    for (let i = 0; i < 5; i++) await helperStatus();
    out.probesWhenMissing = probes;

    window.fetch = realFetch;
    helperCache = null; helperCacheAt = 0;
    return out;
  });

  check('⭐⭐ أول فحص والبرنامج مش شغّال → مش شغّال', r.firstMiss === true, r.firstMiss);
  check('⭐⭐ وجوّه نافذة الانتظار مابنسألش تاني', r.stillMissImmediately === true, r.stillMissImmediately);
  check('⭐⭐⭐ وفحص واحد بس في النافذة دي (مش بنغرق الشبكة)',
    r.probesInWindow === 1, r.probesInWindow);

  check('⭐⭐⭐⭐⭐ وبعد ما الوقت يعدّي، النظام بيلاقي البرنامج اللي قام',
    r.foundAfterTTL === true, r.foundAfterTTL);
  check('⭐⭐⭐⭐ يعني سأل تاني فعلًا', r.probesAfterTTL === 2, r.probesAfterTTL);

  check('⭐⭐⭐⭐ والبرنامج شغّال → فحص واحد للجلسة كلها (السرعة ماتقلّش)',
    r.probesWhenRunning === 1, r.probesWhenRunning);
  check('⭐⭐⭐ والبرنامج مش شغّال → فحص واحد كمان في النافذة',
    r.probesWhenMissing === 1, r.probesWhenMissing);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
