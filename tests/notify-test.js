// ============================================================
// إشعارات طلبات التزويد
// ============================================================
// الحاجة دي **بترن في جيب حد** — فالأعطال فيها مش زي أعطال الشاشة. لو
// غلطت، التليفون بيرن غلط، والمستخدم بيقفل الإشعارات من أول يوم وخلاص.
// عشان كده الفحص هنا مركّز على "امتى **مايرنش**" أكتر من "امتى يرن".
//
// وفيه فحص مالوش علاقة بالبرمجة: **النغمة لازم تفضل من غير موسيقى**.
// الشرط ده طلب صريح من صاحب النظام، ولو حد جه بعدين وحسّن الصوت بمذبذب
// (oscillator) هيكسره من غير ما ياخد باله. الفحص بيقرا الملف نفسه.
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

// درجة واحدة في لقطة Firestore — نفس شكل الحاجة اللي بتيجي من السحابة
const doc = (catId, id, status, extra) => ({
  id,
  data: () => Object.assign({ status, number: id, isBase: false }, extra || {}),
  ref: { parent: { parent: { id: catId } } },
  metadata: { hasPendingWrites: (extra && extra.__mine) || false },
});
const snap = (docs) => ({ docs });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof onGradesSnapshotForNotify === 'function');

  // ------------------------------------------------------------
  // بيئة الفحص: بنعدّ النغمات والإشعارات بدل ما نشغّلهم فعلًا
  // ------------------------------------------------------------
  await p.evaluate(() => {
    window.__log = { sounds: 0, notifs: [] };
    window.__soundWorks = true;
    window.playNotifySound = () => { window.__log.sounds++; return window.__soundWorks; };
    window.showRestockNotification = (count, names, ring) => {
      window.__log.notifs.push({ count, names: names.slice(), ring: !!ring });
      return Promise.resolve(true);
    };
    window.clearRestockNotification = () => Promise.resolve();
    window.Notification = { permission: 'granted', requestPermission: () => Promise.resolve('granted') };
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });

    window.__setup = (profile) => {
      window.__log = { sounds: 0, notifs: [] };
      state.profile = profile;
      state.categories = [{ id: 'c1', name: 'كريب سادة' }];
      lsSet('notify_restock', true);
      resetRestockNotifyState();
    };
    // الشخص الطبيعي اللي المفروض يرن عنده
    window.__mainKeeper = { role: 'warehouse_keeper', perms: { editMainQty: true }, warehouseAccess: 'main' };
  });

  const run = async (steps, profile) => {
    return p.evaluate(([steps, profile]) => {
      window.__setup(profile || window.__mainKeeper);
      steps.forEach((docs) => {
        onGradesSnapshotForNotify({
          docs: docs.map((d) => ({
            id: d.id,
            data: () => ({ status: d.status, number: d.id, isBase: false }),
            ref: { parent: { parent: { id: d.cat } } },
            metadata: { hasPendingWrites: !!d.mine },
          })),
        });
      });
      return window.__log;
    }, [steps, profile]);
  };

  const P = (cat, id, mine) => ({ cat, id, status: 'pending', mine: !!mine });
  const N = (cat, id) => ({ cat, id, status: 'normal' });

  // ============================================================
  // 1) ⭐⭐ فتح النظام على طلبات قديمة = سكوت تام
  // ============================================================
  // ده أخطر عطل ممكن يحصل: أمين المخزن بيفتح النظام الصبح ولاقي 30 طلب
  // من امبارح — من غير خط أساس، التليفون هيرن 30 مرة على حاجة قديمة.
  const old = await run([[P('c1', '1'), P('c1', '2'), P('c1', '3')]]);
  check('⭐⭐ فتح النظام على طلبات قديمة مايرنّش خالص',
    old.sounds === 0 && old.notifs.length === 0, old);

  // ============================================================
  // 2) ⭐ الطلب الجديد بيرن
  // ============================================================
  const one = await run([
    [P('c1', '1')],
    [P('c1', '1'), P('c1', '2')],
  ]);
  check('⭐ الطلب الجديد بيرن مرة واحدة', one.sounds === 1, one);
  check('⭐ وبيطلع إشعار واحد فيه العدد الصح',
    one.notifs.length === 1 && one.notifs[0].count === 1, one);
  check('⭐ والإشعار مكتوب فيه اسم الفئة والدرجة',
    /كريب سادة/.test(one.notifs[0].names[0] || ''), one.notifs[0]);

  // ============================================================
  // 3) ⭐⭐ 20 طلب ورا بعض = نغمة **واحدة**
  // ============================================================
  // الشرط اللي اتحدد بالحرف: "إشعار واحد بيتحدّث، والنغمة مرة واحدة".
  // لو دي اتكسرت التليفون هيفضل يرن دقيقة كاملة.
  const burstSteps = [[]];
  const acc = [];
  for (let i = 1; i <= 20; i++) { acc.push(P('c1', String(i))); burstSteps.push(acc.slice()); }
  const burst = await run(burstSteps);
  check('⭐⭐ 20 طلب ورا بعض = نغمة واحدة بس', burst.sounds === 1, { نغمات: burst.sounds });
  check('⭐⭐ والعدّاد بيتجمّع في إشعار واحد بيتحدّث',
    burst.notifs.length === 20 && burst.notifs[19].count === 20,
    { إشعارات: burst.notifs.length, آخر_عدد: burst.notifs[19] && burst.notifs[19].count });

  // ============================================================
  // 4) ⭐⭐ طلبي أنا مايرجعش لي إشعار
  // ============================================================
  // لو نفس الشخص عنده صلاحية الفرع والرئيسي، طلبه هيرجّع له إشعار على
  // حاجة هو عاملها بنفسه. `hasPendingWrites` بتفرّق.
  const mine = await run([
    [P('c1', '1')],
    [P('c1', '1'), P('c1', '9', true)],
  ]);
  check('⭐⭐ الطلب اللي أنا عملته مايرنّش عندي', mine.sounds === 0 && mine.notifs.length === 0, mine);

  // ============================================================
  // 5) ⭐⭐ رجوع النت مايعملش إشعارات من جديد
  // ============================================================
  // Firestore بيبعت اللقطة كاملة تاني بعد ما الاتصال يرجع. المقارنة
  // بالمفاتيح مش بالعدد — فاللي كان معلّق ومفضل معلّق مش "جديد".
  const recon = await run([
    [P('c1', '1'), P('c1', '2')],
    [P('c1', '1'), P('c1', '2')],
    [P('c1', '2'), P('c1', '1')], // نفس الطلبات بترتيب مختلف
  ]);
  check('⭐⭐ رجوع النت مايكرّرش الإشعار', recon.sounds === 0 && recon.notifs.length === 0, recon);

  // ============================================================
  // 6) ⭐ الطلب اللي اتقفل ورجع اتطلب تاني = إشعار جديد
  // ============================================================
  const again = await run([
    [P('c1', '1')],
    [N('c1', '1')], // اتزوّد
    [P('c1', '1')], // اتطلب تاني
  ]);
  check('⭐ الدرجة اللي اتزوّدت ورجعت اتطلبت بترن تاني', again.sounds === 1, again);

  // ============================================================
  // 7) ⭐⭐ مين بيستقبل — والشرط اللي اتطلب بالحرف
  // ============================================================
  // "الإشعارات توصل لأي مستخدم عنده الصلاحية في التعديل في المخزن
  // الرئيسي، ولو كان مقفول وبعدين اتفتحله يبقى يجيله إشعارات."
  const two = [[P('c1', '1')], [P('c1', '1'), P('c1', '2')]];

  const branchOnly = await run(two, { role: 'user', perms: { editMainQty: false } });
  check('⭐⭐ اللي مالوش صلاحية الرئيسي مايجيلوش حاجة',
    branchOnly.sounds === 0 && branchOnly.notifs.length === 0, branchOnly);

  // ⚠️ الحالة دي هي اللي المفتاح لوحده مابيمسكهاش: معاه المفتاح، بس
  // محصور على مخزن الفرع — يعني مافيش عنده زرار "زوّد" أصلًا.
  const wrongWarehouse = await run(two, {
    role: 'warehouse_keeper', perms: { editMainQty: true }, warehouseAccess: 'branch',
  });
  check('⭐⭐ ومعاه المفتاح بس محصور على الفرع؟ برضه مايجيلوش',
    wrongWarehouse.sounds === 0 && wrongWarehouse.notifs.length === 0, wrongWarehouse);

  // ⭐ الشرط بتاع المستخدم: تفتح الصلاحية → يبدأ يرن من غير تحديث
  const liveGrant = await p.evaluate(() => {
    window.__setup({ role: 'user', perms: { editMainQty: false } });
    const s = (ids) => onGradesSnapshotForNotify({
      docs: ids.map((id) => ({
        id, data: () => ({ status: 'pending', number: id, isBase: false }),
        ref: { parent: { parent: { id: 'c1' } } }, metadata: { hasPendingWrites: false },
      })),
    });
    s(['1']);
    s(['1', '2']);
    const before = window.__log.sounds;
    // نفس الصفحة، من غير أي إعادة تحميل — الصلاحية بس اتفتحت من السحابة
    state.profile = { role: 'warehouse_keeper', perms: { editMainQty: true }, warehouseAccess: 'main' };
    s(['1', '2', '3']);
    return { before, after: window.__log.sounds, btn: restockNotifyButtonHTML() };
  });
  check('⭐⭐ فتحت الصلاحية وهو فاتح؟ يبدأ يرن فورًا من غير تحديث',
    liveGrant.before === 0 && liveGrant.after === 1, liveGrant);
  check('⭐ والزرار بيظهر له في القايمة',
    /restock-notify-btn/.test(liveGrant.btn), liveGrant.btn);

  const hiddenBtn = await p.evaluate(() => {
    state.profile = { role: 'user', perms: { editMainQty: false } };
    return restockNotifyButtonHTML();
  });
  check('⭐ ومخفي عن اللي مالوش دعوة بيه', hiddenBtn === '', hiddenBtn);

  // ============================================================
  // 8) ⭐ المفتاح مقفول = سكوت (وافتراضيًا مقفول)
  // ============================================================
  const offByDefault = await p.evaluate(() => {
    lsRemove('notify_restock');
    return notifyEnabled();
  });
  check('⭐ الإشعارات مقفولة افتراضيًا (مابنطلبش إذن من حد ماطلبش)',
    offByDefault === false, offByDefault);

  const turnedOff = await p.evaluate(() => {
    window.__setup(window.__mainKeeper);
    lsSet('notify_restock', false);
    const s = (ids) => onGradesSnapshotForNotify({
      docs: ids.map((id) => ({
        id, data: () => ({ status: 'pending', number: id, isBase: false }),
        ref: { parent: { parent: { id: 'c1' } } }, metadata: { hasPendingWrites: false },
      })),
    });
    s(['1']); s(['1', '2']);
    return window.__log;
  });
  check('⭐ قفلت المفتاح؟ سكوت تام', turnedOff.sounds === 0 && turnedOff.notifs.length === 0, turnedOff);

  // ============================================================
  // 9) ⭐ النظام قدامك مفتوح = نغمة من غير إشعار
  // ============================================================
  // الإشعار وانت باصص على الشاشة إزعاج — انت شايف الطلب في الجدول أصلًا.
  const visible = await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    window.__setup(window.__mainKeeper);
    const s = (ids) => onGradesSnapshotForNotify({
      docs: ids.map((id) => ({
        id, data: () => ({ status: 'pending', number: id, isBase: false }),
        ref: { parent: { parent: { id: 'c1' } } }, metadata: { hasPendingWrites: false },
      })),
    });
    s(['1']); s(['1', '2']);
    const out = window.__log;
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    return out;
  });
  check('⭐ والنظام قدامك: نغمة بس من غير إشعار',
    visible.sounds === 1 && visible.notifs.length === 0, visible);

  // ============================================================
  // 10) ⭐⭐ النغمة: **مافيش موسيقى** — شرط صريح من صاحب النظام
  // ============================================================
  // ⚠️ الفحص ده بيقرا الكود نفسه مش بيشغّل صوت. السبب: لو حد جه بعدين
  // "يحسّن" النغمة بمذبذب، الشرط بيتكسر من غير ما أي فحص سلوكي يحس.
  // ⚠️ لازم نشيل التعليقات الأول. أول نسخة من الفحص ده **فشلت على
  // تعليقاتها هي** — التعليق اللي بيشرح "مافيش OscillatorNode هنا" كان
  // بيتحسب مذبذب. الفحص اللي بيقرا كود لازم يقرا **كود**.
  const stripComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');
  const src = stripComments(fs.readFileSync(__dirname + '/../js/notify.js', 'utf8'));
  check('⭐⭐ مافيش مذبذب (oscillator) خالص — المذبذب هو اللي بيطلّع النغمات',
    !/createOscillator|OscillatorNode/.test(src), (src.match(/.*[Oo]scillator.*/g) || []).slice(0, 3));
  check('⭐⭐ مصدر الصوت ضوضاء عشوائية (مالهاش درجة موسيقية)',
    /Math\.random\(\) \* 2 - 1/.test(src) && /createBuffer\(/.test(src), null);
  // ⭐⭐ أقوى ضمان ضد اللحن: **الدالة مش قادرة** تعمل درجتين مختلفتين.
  // مافيش معامل تردد ولا درجة، وكل الطرقات بتتشغّل من **نفس الـbuffer**.
  const knockSig = (src.match(/function knockAt\(([^)]*)\)/) || [])[1] || '';
  check('⭐⭐ knockAt مالهاش أي معامل تردد أو درجة — فمستحيل طرقتين يختلفوا',
    knockSig.replace(/\s/g, '') === 'ctx,when', knockSig);
  check('⭐⭐ وكل الطرقات من نفس العيّنات حرفيًا (buffer واحد مخزّن)',
    /src\.buffer = knockBuffer;/.test(src) && /knockBuffer = buildKnockBuffer\(ctx\)/.test(src), null);
  check('⭐ والمسافات بين الطرقات متساوية (مافيش نمط إيقاعي)',
    /for \(let k = 0; k < KNOCK_COUNT; k\+\+\) knockAt\(notifyAudioCtx, t \+ k \* KNOCK_GAP\)/.test(src), null);
  check('⭐ والخفوت سريع (طرقة مش نغمة مستمرة)',
    /const KNOCK_DUR = 0\.0\d+;/.test(src), (src.match(/const KNOCK_DUR = .*/) || [])[0]);

  // ============================================================
  // 10ب) ⭐⭐ النغمة مسموعة فعلًا — بالقياس مش بالأذن
  // ============================================================
  // ⚠️ الشكوى اللي أدّت للفحص ده: "حاسس إن محدش هيشعر بيها". والقياس
  // أثبت إنها كانت **هادية فعلًا** (طاقة 0.018 من 1) و**قصيرة** (160
  // مللي). وأسوأ من كده: كانت **متغيّرة** — ذروة الضوضاء عشوائية، فنفس
  // الكود كان بيطلّع صوت مختلف كل مرة وأحيانًا بيفرقع (قص).
  //
  // الفحص بيشغّل النغمة 6 مرات ويقيس التلاتة: علوّ، ثبات، وطول.
  const loud = await p.evaluate(async () => {
    const runs = [];
    for (let t = 0; t < 6; t++) {
      knockBuffer = null; // نبني من الأول عشان نشوف تأثير عشوائية الضوضاء
      const ctx = new OfflineAudioContext(1, 44100, 44100);
      for (let k = 0; k < KNOCK_COUNT; k++) knockAt(ctx, 0.01 + k * KNOCK_GAP);
      const d = (await ctx.startRendering()).getChannelData(0);
      let peak = 0, sum = 0, clip = 0, last = 0;
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(d[i]);
        if (v > peak) peak = v;
        if (v >= 0.999) clip++;
        sum += d[i] * d[i];
        if (v > 0.02) last = i;
      }
      // ⚠️ عدّ الطرقات **لازم يبقى على الغلاف مش على العيّنة**: الضوضاء
      // بتعدّي الصفر مئات المرات جوّه الطرقة الواحدة، فالعدّ المباشر
      // طلّع 624 طرقة بدل 4. بنقسّم لمقاطع 5 مللي وناخد أعلى قيمة فيها.
      const BLK = Math.round(44100 * 0.005);
      const env = [];
      for (let i = 0; i < d.length; i += BLK) {
        let m = 0;
        for (let j = i; j < Math.min(i + BLK, d.length); j++) m = Math.max(m, Math.abs(d[j]));
        env.push(m > 0.02);
      }
      let knocks = 0;
      for (let i = 0; i < env.length; i++) if (env[i] && !env[i - 1]) knocks++;
      runs.push({ peak, rms: Math.sqrt(sum / d.length), clip, ms: Math.round(last / 44.1), knocks });
    }
    return {
      peakMin: +Math.min(...runs.map((r) => r.peak)).toFixed(3),
      peakMax: +Math.max(...runs.map((r) => r.peak)).toFixed(3),
      rmsMin: +Math.min(...runs.map((r) => r.rms)).toFixed(4),
      clip: runs.reduce((a, r) => a + r.clip, 0),
      ms: runs[0].ms,
      knocks: runs[0].knocks,
    };
  });
  // ⚠️ الأرقام دي مقارنة بالنسخة القديمة اللي المستخدم اشتكى منها:
  //   طاقة 0.0176 → دلوقتي فوق 0.05 (تلات أضعاف على الأقل)
  //   مدة 161 مللي → دلوقتي فوق 400
  check('⭐⭐ النغمة عالية فعلًا (طاقة أعلى 3 أضعاف من اللي اتشتكى منها)',
    loud.rmsMin > 0.05, loud);
  check('⭐⭐ ومدتها بقت نص ثانية تقريبًا مش لمحة', loud.ms > 400, loud);
  check('⭐⭐ ومفيش أي قص (فرقعة) — الذروة متطبّعة مش متروكة للعشوائية',
    loud.clip === 0 && loud.peakMax <= 0.95, loud);
  check('⭐⭐ والصوت **ثابت** كل مرة — نفس الذروة بالظبط',
    loud.peakMin === loud.peakMax, loud);
  check('⭐ وعدد الطرقات المسموعة صح', loud.knocks === 4, loud);

  // ============================================================
  // 11) ⭐ إعدادات الإشعار نفسه
  // ============================================================
  check('⭐⭐ فيه tag — من غيره كل طلب بيبقى إشعار منفصل على الشاشة',
    /tag: NOTIFY_TAG/.test(src), null);
  // ⚠️ الفحص ده كان بيتأكد إن `silent: true` **ثابتة**. اتغيّر عن قصد في
  // v0.52.0: السكوت الثابت كان بيطلّع إشعار من غير أي صوت لما أندرويد
  // يجمّد الصفحة (نغمتنا واقفة، ونغمة النظام قافلينها). دلوقتي بتتحدد
  // على حسب إن نغمتنا رنّت ولا لأ — الشرح في القسم 15 تحت.
  check('⭐⭐ السكوت مربوط بنغمتنا مش ثابت', /silent: !ring/.test(src), null);
  check('⭐ والإشعار من الـService Worker الأول (new Notification بترمي خطأ على أندرويد)',
    src.indexOf('reg.showNotification') < src.indexOf('new Notification('), null);

  // ============================================================
  // 12) ⭐ الضغط على الإشعار بيفتح النظام
  // ============================================================
  // من غير المستمع ده، الضغط على أندرويد مابيعملش أي حاجة.
  const sw = stripComments(fs.readFileSync(__dirname + '/../sw.js', 'utf8'));
  check('⭐⭐ فيه notificationclick في الـService Worker', /notificationclick/.test(sw), null);
  check('⭐ وبيركّز على النافذة المفتوحة بدل ما يفتح واحدة جديدة',
    /matchAll\(/.test(sw) && /client\.focus\(\)/.test(sw), null);
  check('⭐ وبيقفل الإشعار بعد الضغط', /event\.notification\.close\(\)/.test(sw), null);

  // ============================================================
  // 13) ⭐ الملف متحمّل ومحفوظ
  // ============================================================
  // ⚠️ لو الملف مش في قايمة sw.js، النظام من غير نت بيفتح **ناقص** —
  // وde بيرمي خطأ في الكونسول ويوقف الرسم.
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  check('⭐ notify.js متحمّل في index.html', /js\/notify\.js/.test(html), null);
  check('⭐⭐ وموجود في قايمة الحفظ بتاعة sw.js', /js\/notify\.js/.test(sw), null);
  check('⭐ ومتحمّل قبل app.js (app.js بينادي دواله في الرسم)',
    html.indexOf('js/notify.js') < html.indexOf('js/app.js'), null);

  // ============================================================
  // 14) ⭐ تغيير الحساب بيصفّر كل حاجة
  // ============================================================
  const switched = await p.evaluate(() => {
    window.__setup(window.__mainKeeper);
    const s = (ids) => onGradesSnapshotForNotify({
      docs: ids.map((id) => ({
        id, data: () => ({ status: 'pending', number: id, isBase: false }),
        ref: { parent: { parent: { id: 'c1' } } }, metadata: { hasPendingWrites: false },
      })),
    });
    s(['1']); s(['1', '2']);
    const beforeNames = window.__log.notifs[0].names.length;
    resetRestockNotifyState();
    window.__log = { sounds: 0, notifs: [] };
    s(['1', '2', '3']); // أول لقطة للحساب الجديد = خط أساس، مش إشعار
    return { beforeNames, after: window.__log };
  });
  check('⭐⭐ تغيير الحساب بيصفّر خط الأساس (الجديد مايرثش إشعارات القديم)',
    switched.beforeNames > 0 && switched.after.sounds === 0 && switched.after.notifs.length === 0, switched);

  // ============================================================
  // 15) ⭐⭐ الإشعار الساكت — العطل اللي كان هيفضّي الميزة من معناها
  // ============================================================
  // الإشعار كان متبعت `silent: true` **دايمًا**، عشان نغمتنا هي اللي ترن.
  // بس لما تبدّل لتطبيق تاني، أندرويد بيجمّد الصفحة ومحرّك الصوت بيقف:
  //
  //   نغمتنا ......... ❌ مجمّدة
  //   نغمة أندرويد ... ❌ إحنا قافلينها
  //   النتيجة ........ **إشعار من غير أي صوت**
  //
  // يعني بالظبط في الحالة اللي الميزة كلها اتعملت عشانها.
  const ringing = await p.evaluate(async () => {
    const s = (ids) => onGradesSnapshotForNotify({
      docs: ids.map((id) => ({
        id, data: () => ({ status: 'pending', number: id, isBase: false }),
        ref: { parent: { parent: { id: 'c1' } } }, metadata: { hasPendingWrites: false },
      })),
    });
    const out = {};

    // (أ) نغمتنا شغّالة → الإشعار ساكت (مانرنّش مرتين)
    window.__setup(window.__mainKeeper);
    window.__soundWorks = true;
    s(['1']); s(['1', '2']);
    out.soundOK = window.__log.notifs[0];

    // (ب) نغمتنا مش شغّالة (الصفحة متجمّدة) → أندرويد يرن
    window.__setup(window.__mainKeeper);
    window.__soundWorks = false;
    s(['1']); s(['1', '2']);
    out.soundDead = window.__log.notifs[0];

    // (ج) وسط الدفعة → ساكت برضه (النغمة مرة واحدة في الدفعة)
    window.__setup(window.__mainKeeper);
    window.__soundWorks = false;
    s(['1']); s(['1', '2']); s(['1', '2', '3']);
    out.midBurst = window.__log.notifs[1];
    out.midBurstSounds = window.__log.sounds;
    return out;
  });
  check('⭐⭐ نغمتنا رنّت؟ الإشعار ساكت (مافيش رنتين)',
    ringing.soundOK && ringing.soundOK.ring === false, ringing.soundOK);
  check('⭐⭐ نغمتنا ماقدرتش؟ أندرويد يرن بدل السكوت',
    ringing.soundDead && ringing.soundDead.ring === true, ringing.soundDead);
  check('⭐⭐ ووسط الدفعة ساكت — النغمة لسه مرة واحدة',
    ringing.midBurst && ringing.midBurst.ring === false, ringing.midBurst);
  check('⭐ والنغمة اتنادت مرة واحدة بس في الدفعة', ringing.midBurstSounds === 1, ringing);

  // ⚠️ `renotify` لازم تمشي مع `silent`: من غيرها الاستبدال بنفس الوسم
  // بيحصل **في سكوت** حتى لو silent=false — يعني الإصلاح مايشتغلش.
  check('⭐⭐ silent وrenotify متربطين بـring (مش ثابتين)',
    /renotify: !!ring/.test(src) && /silent: !ring/.test(src), null);
  check('⭐ ومفيش silent: true ثابتة فاضلة', !/silent: true/.test(src), null);
  check('⭐ والنغمة بترجّع نجحت ولا لأ', /return true;[\s\S]{0,120}return false;/.test(src), null);

  check('مفيش أخطاء في الصفحة', errors.length === 0, errors);
  await b.close();

  if (fail.length) {
    console.log(`❌ فشل (${fail.length}):`);
    fail.forEach((f) => console.log('   ' + f));
    console.log(`\n✅ نجح (${pass.length})`);
    process.exit(1);
  }
  console.log(`✅ نجح (${pass.length})`);
  pass.filter((x) => x.startsWith('⭐')).forEach((x) => console.log('   ' + x));
})();
