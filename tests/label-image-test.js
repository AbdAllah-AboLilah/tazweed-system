// 🧪 مقسوم ٤ والمسمّى كصورة — مفتاح مستقل لكل واحد + ترميز 1 بت
// ============================================================
// ⚠️⚠️ ليه مفتاح مستقل لكل واحد:
// الاتنين كانوا مربوطين بمفتاح "ابعت الملصق كنص" بتاع **كل** الملصقات.
// يعني عشان تجرّب مقسوم ٤ كصورة، لازم تغيّر الملصق العادي معاه —
// فمستحيل تجرّب واحد لوحده على ورق.
//
// ⚠️⚠️ وليه أصلًا بنعيد فتح الموضوع:
//   v0.36  التجربة على ورق اللي قررت "النص أحسن" → المفتاح اتقفل على النص
//   v0.38  اتبنى مسار الصورة النضيف (تنعيم فائق + متوسط 9 عيّنات + عتبة)
//          — والإصدار ده اسمه بالحرف "المسمّى المنغمش من شاشة الطباعة"
// يعني الحكم اتاخد **قبل إصدارين** من الكود اللي اتعمل عشان النغمشة.
// الصورة اللي اتحكم عليها **مش** الصورة الموجودة دلوقتي.
//
// ------------------------------------------------------------
// ⚠️⚠️⚠️ وأهم فحص في الملف: النقط **مابتتغيّرش**
// ------------------------------------------------------------
// إحنا **مابنعيدش رسم** الملصق — بنعيد **تخزينه** بس (1 بت بدل 32).
// التصميم والخطوط والمقاسات والنقط لازم يفضلوا زي ما هم **بالحرف**.
// الفحص بيقارن الصورة قبل وبعد **بكسل ببكسل** ولازم يبقوا متطابقين.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildQuarterLabel === 'function' && typeof buildTextLabel === 'function' && typeof imageJobTo1Bit === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    const cat = { id: 'c1', name: 'Hejap Kuwaiti Chiffon 120', sellingPrice: 250, originalPrice: 180, barcode: '6221055123456' };

    const K = { html: 'tazweed_qz_tweak_htmlLabels', q: 'tazweed_qz_tweak_quarterImage', g: 'tazweed_qz_tweak_gradeImage' };
    const set = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
    const reset = () => { set(K.html, true); set(K.q, false); set(K.g, false); };

    // ---------- الافتراضي: الاتنين مقفولين ----------
    const defOf = (k) => (PRINT_TWEAKS.find((t) => t.key === k) || {}).defaultOn !== true;
    out.qDefaultOff = defOf('quarterImage');
    out.gDefaultOff = defOf('gradeImage');
    set(K.q, null); set(K.g, null);
    out.qOffNoSave = getPrintTweak('quarterImage') === false;
    out.gOffNoSave = getPrintTweak('gradeImage') === false;

    // ============================================================
    // ⭐⭐⭐ (١) المفاتيح مقفولة → كل حاجة نص زي الأول
    // ============================================================
    reset();
    const qOff = await buildQuarterLabel(cat, size, 1);
    const gOff = buildTextLabel('كريب سادة لوكس درجة 56', size, 1);
    const iOff = await buildItemLabel(cat, size, 1);
    out.offQuarterIsText = qOff.image === null;
    out.offGradeIsText = gOff.image === null;
    out.offItemIsText = iOff.image === null;

    // ============================================================
    // ⭐⭐ (٢) مقسوم ٤ لوحده → صورة، والباقي نص
    // ============================================================
    reset(); set(K.q, true);
    const q1 = await buildQuarterLabel(cat, size, 1);
    const g1 = buildTextLabel('كريب سادة لوكس درجة 56', size, 1);
    const i1 = await buildItemLabel(cat, size, 1);
    out.qOnIsImage = typeof q1.image === 'string' && q1.image.indexOf('data:image/png') === 0;
    out.qOnGradeStillText = g1.image === null;      // ⚠️ المسمّى مااتأثرش
    out.qOnItemStillText = i1.image === null;       // ⚠️ والملصق العادي كمان

    // ============================================================
    // ⭐⭐ (٣) المسمّى لوحده → صورة، والباقي نص
    // ============================================================
    reset(); set(K.g, true);
    const q2 = await buildQuarterLabel(cat, size, 1);
    const g2 = buildTextLabel('كريب سادة لوكس درجة 56', size, 1);
    const i2 = await buildItemLabel(cat, size, 1);
    out.gOnIsImage = typeof g2.image === 'string' && g2.image.indexOf('data:image/png') === 0;
    out.gOnQuarterStillText = q2.image === null;
    out.gOnItemStillText = i2.image === null;

    // ============================================================
    // ⚠️ (٤) المفتاح القديم لسه شغّال زي ما هو (توافق)
    // ============================================================
    reset(); set(K.html, false);
    const qc = await buildQuarterLabel(cat, size, 1);
    const gc = buildTextLabel('درجة 56', size, 1);
    const ic = await buildItemLabel(cat, size, 1);
    out.legacyAllImages = !!qc.image && !!gc.image && !!ic.image;
    reset();

    // ============================================================
    // ⭐⭐⭐ (٥) الترميز 1 بت: النقط **مابتتغيّرش ولا نقطة**
    // ============================================================
    const px = async (url) => {
      const im = new Image();
      await new Promise((res) => { im.onload = res; im.onerror = res; im.src = url; });
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      // بنقارن الإضاءة بس (أبيض/أسود) — القناة الرابعة مالهاش معنى هنا
      const a = new Uint8Array(c.width * c.height);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) a[j] = d[i] < 128 ? 0 : 255;
      return { w: c.width, h: c.height, a };
    };

    set(K.q, true);
    const qImg = (await buildQuarterLabel(cat, size, 1)).image;
    const small = await imageJobTo1Bit(qImg);
    out.reencoded = typeof small === 'string' && small !== qImg;
    if (out.reencoded) {
      const A = await px(qImg), B = await px(small);
      out.sameSize = A.w === B.w && A.h === B.h;
      let diff = 0;
      for (let i = 0; i < A.a.length; i++) if (A.a[i] !== B.a[i]) diff++;
      out.pixelDiff = diff;                       // ⭐ لازم يبقى صفر
      out.beforeKB = +(qImg.length / 1024).toFixed(1);
      out.afterKB = +(small.length / 1024).toFixed(1);
      // عمق البت الحقيقي من ترويسة PNG
      const bin = atob(small.split(',')[1].slice(0, 60));
      const by = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
      out.bitDepth = by[24];
    }

    // ============================================================
    // ⚠️⚠️ (٥ب) المرمِّز نفسه — بمدخلات بتوصل لحُرّاسه
    // ============================================================
    // ⚠️ الفحوص اللي فوق **ماتقدرش** تمسك عطل في العتبة ولا في الخلفية
    // البيضا، لأن صورة الملصق أصلًا مصمتة وأبيض/أسود صافي — فالحارسين
    // دول مابيتنفّذوش عليها أصلًا. (اتأكدنا: خرّبنا الاتنين والفحوص عدّت،
    // وفحص الورقة كمان عدّى.)
    //
    // فبنفحصهم هنا **مباشرة** بمدخلات مصنوعة مخصوص.

    // --- العتبة لازم تبقى في النص بالظبط (128) ---
    // تدرّج رمادي من 0 لـ255. أي عتبة غير 128 بتغيّر مكان الحد.
    const ramp = document.createElement('canvas');
    ramp.width = 256; ramp.height = 1;
    const rctx = ramp.getContext('2d');
    for (let i = 0; i < 256; i++) { rctx.fillStyle = `rgb(${i},${i},${i})`; rctx.fillRect(i, 0, 1, 1); }
    const rampUrl = 'data:image/png;base64,' + (await canvasToPng1Bit(ramp));
    {
      const im = new Image();
      await new Promise((res) => { im.onload = res; im.onerror = res; im.src = rampUrl; });
      const c = document.createElement('canvas');
      c.width = 256; c.height = 1;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, 256, 1).data;
      let firstWhite = -1;
      for (let i = 0; i < 256; i++) if (d[i * 4] >= 128) { firstWhite = i; break; }
      // ⚠️ التوقّع **128 أو 129** مش 128 بالظبط: معاملات الإضاءة
      // (0.299+0.587+0.114) بتجمع 0.9999999 مش 1، فالرمادي 128 بيحسب
      // 127.99 ويقع ناحية الأسود. الفرق نقطة واحدة مالوش أي أثر على
      // الورق — واللي بيهم إن الحد في **النص**، فأي عتبة تانية (200
      // مثلًا) بتبان فورًا.
      out.thresholdAt = firstWhite;
    }

    // --- الشفاف لازم يبقى **أبيض** مش أسود ---
    // من غير كده، الشفاف بيتقرا أسود والملصق يطلع محروق.
    //
    // ⚠️⚠️ الحماية دي **متكرّرة في مكانين** وكل واحد لوحده كافي:
    //   1) imageJobTo1Bit بتملا الكانفاس أبيض قبل ما ترسم الصورة
    //   2) canvasToPng1Bit بتخلط بالأبيض حسب الشفافية: 255 * (1 - a)
    //
    // اتأكدنا بالتخريب: شيل أي واحدة لوحدها → الفحص **بيعدّي** (التانية
    // بتغطّيها). شيل الاتنين → **بيفشل**.
    //
    // ⚠️ فمحدش يشيل واحدة منهم فاكرها زيادة: هي مش زيادة، هي شبكة
    // التانية. ولو حد شال الاتنين، الفحص ده هو اللي هيمسكها.
    const tr = document.createElement('canvas');
    tr.width = 8; tr.height = 8;
    const tctx = tr.getContext('2d');
    tctx.clearRect(0, 0, 8, 8);                 // كله شفاف
    tctx.fillStyle = '#000'; tctx.fillRect(0, 0, 2, 2);   // مربع أسود صغير
    const trUrl = tr.toDataURL('image/png');
    const trSmall = await imageJobTo1Bit(trUrl);
    if (trSmall) {
      const im = new Image();
      await new Promise((res) => { im.onload = res; im.onerror = res; im.src = trSmall; });
      const c = document.createElement('canvas');
      c.width = 8; c.height = 8;
      const x = c.getContext('2d');
      x.fillStyle = '#888'; x.fillRect(0, 0, 8, 8);   // رمادي عشان نفرّق
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, 8, 8).data;
      const corner = d[(7 * 8 + 7) * 4];    // ركن كان شفاف
      const dot = d[0];                      // النقطة السودا
      out.transparentIsWhite = corner >= 200;
      out.blackStaysBlack = dot < 50;
    }

    // ============================================================
    // ⚠️⚠️⚠️ (٥ج) الطباعة عن بُعد: **الجهاز اللي بيطبع** هو اللي بيقرر
    // ============================================================
    // ده بالظبط العطل اللي وقعنا فيه في ورقة التزويد: المفتاح اتقرا على
    // الجهاز **الباعت**، فالطباعة من التليفون طلعت مختلفة عن الكمبيوتر.
    //
    // الملصق محمي بآلية تانية: الطلب بيتبعت ومعاه **وصفة** (spec)،
    // والجهاز المستقبِل بيعيد بناء الملصق من الوصفة **بمفاتيحه هو**
    // (rebuildFromSpec). فمهما كان الباعت، اللي بيحكم هو اللي بيطبع.
    //
    // الفحص ده بيثبت ده فعلًا مش بالتخمين.
    reset();
    const specs = [
      { kind: 'quarter', cat, copies: 1 },
      { kind: 'text', text: 'كريب سادة لوكس درجة 56', copies: 1 },
      { kind: 'many', items: [{ kind: 'quarter', cat, copies: 1 }, { kind: 'text', text: 'درجة 7', copies: 1 }] },
    ];
    const rebuilt = async () => {
      const o = {};
      for (const sp of specs) {
        const res = await rebuildFromSpec(sp, size);
        o[sp.kind] = Array.isArray(res) ? res.map((x) => !!x.image) : null;
      }
      return o;
    };
    // الجهاز اللي بيطبع مفاتيحه **مقفولة** → نص، مهما كان الباعت
    out.remoteOff = await rebuilt();
    // ولما يفتحهم هو → صورة
    set(K.q, true); set(K.g, true);
    out.remoteOn = await rebuilt();
    reset();

    // ============================================================
    // ⚠️⚠️⚠️ (٥د) المقاس المخصّص للملصق — العطل اللي بان على ورق
    // ============================================================
    // ملصق مطبوع من المحل: العمود اليمين **مقصوص** ("Kuwaiti 12" بدل
    // "Kuwaiti 120"). والصورة اللي بنبعتها **سليمة** (304×200 بالظبط،
    // هوامش 12 و13، الخانات الأربعة كاملة) — يعني بتتقص بعد ما تسيبنا.
    //
    // شكوى QZ #1413: "التحجيم مقفول → الصورة **تتقص**؛ السبب إن المساحة
    // القابلة للطباعة أصغر من اللازم". وإحنا التحجيم عندنا مقفول.
    // و`custom` هو التعديل اللي اتعمل ردًا على الشكوى دي.
    const seen = [];
    window.qz = {
      configs: { create: (n, o) => ({ printer: n, opts: o }) },
      print: (cfg, pages) => { seen.push({ opts: cfg.opts, pages }); return Promise.resolve(); },
      printers: { details: () => Promise.resolve([{ name: 'XP-235B' }]) },
    };
    window.isQZAvailable = () => true;
    window.ensureQZConnected = () => Promise.resolve(true);
    window.getSavedPrinter = () => 'XP-235B';

    const sendAndRead = async (jobs) => {
      seen.length = 0;
      await tryPrintViaQZ('label', jobs, { pageWidthMm: 38, pageHeightMm: 25 });
      const c = seen[0] || {};
      return { size: (c.opts || {}).size || null, fmt: ((c.pages || [])[0] || {}).format };
    };

    set(K.q, true);
    const qJob = await buildQuarterLabel(cat, size, 1);
    out.imgCustom = await sendAndRead([{ html: qJob.jobHTML, image: qJob.image, copies: 1 }]);

    // ⚠️⚠️ والمسمّى كمان — مش مقسوم ٤ بس.
    // القاعدة مش مربوطة بنوع الملصق: **أي طبعة كل صفحاتها صور** بتاخد
    // المقاس المخصّص. الفحص ده اتضاف بعد ما صاحب النظام سأل "عملتها
    // للمسمّى ولا لمقسوم ٤ بس؟" — والإجابة كانت من التشغيل مش من فحص
    // ثابت، وده مايكفيش.
    reset(); set(K.g, true);
    const gJob = buildTextLabel('كريب سادة لوكس درجة 56', size, 1);
    out.gradeCustom = await sendAndRead([{ html: gJob.jobHTML, image: gJob.image, copies: 1 }]);

    // والملصق العادي لما المفتاح القديم يتقفل
    reset(); set(K.html, false);
    const iJob = await buildItemLabel(cat, size, 1);
    out.itemCustom = await sendAndRead([{ html: iJob.jobHTML, image: iJob.image, copies: 1 }]);

    // ⚠️ والنص **مايتأثرش**: QZ بيتجاهل custom مع HTML أصلًا، فلو حطيناه
    // عليه بنكون بنغيّر حاجة من غير سبب.
    reset();
    const tJob = buildTextLabel('درجة 56', size, 1);
    out.htmlCustom = await sendAndRead([{ html: tJob.jobHTML, copies: 1 }]);

    // ⚠️ وخليط (صورة + نص) → مانحطّهوش: مش كل الصفحات صور
    set(K.q, true);
    const qJob2 = await buildQuarterLabel(cat, size, 1);
    reset();
    const tJob2 = buildTextLabel('درجة 7', size, 1);
    out.mixedCustom = await sendAndRead([
      { html: qJob2.jobHTML, image: qJob2.image, copies: 1 },
      { html: tJob2.jobHTML, copies: 1 },
    ]);
    reset();

    // ============================================================
    // ⭐⭐⭐ (٥هـ) وزن الخط: الصورة لازم تطابق النص
    // ============================================================
    // ⚠️ العطل: نسخة الـHTML بتاعت كل الملصقات بتستخدم bold، ونسخة
    // الصورة كانت normal. يعني نفس الملصق بوزنين مختلفين — واللي بيفتح
    // مفتاح الصورة كان الخط بيرقّ عنده من غير ما حد يقصد.
    //
    // الفحص ده بيقارن **الحبر الفعلي** في الصورة بحبر نفس النص مرسوم
    // عادي — لو الصورة مش أتقل، يبقى الوزن رجع normal.
    const inkOf = async (url) => {
      const im = new Image();
      await new Promise((res) => { im.onload = res; im.onerror = res; im.src = url; });
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
      return dark / (c.width * c.height);
    };

    out.labelWeight = typeof LABEL_WEIGHT === 'string' ? LABEL_WEIGHT : null;

    // نفس النص بالظبط: مرة بوزن النظام ومرة بـnormal — ونقارن الحبر
    const inkAt = (weight) => {
      const W = 304, H = 200, S = 3;
      const c = document.createElement('canvas');
      c.width = W * S; c.height = H * S;
      const x = c.getContext('2d');
      x.scale(S, S);
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `${weight} 17px Tahoma, Arial, sans-serif`;
      x.fillText('كريب سادة لوكس درجة 56', W / 2, H / 2);
      const d = x.getImageData(0, 0, W * S, H * S).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
      return dark;
    };
    out.inkBold = inkAt('bold');
    out.inkNormal = inkAt('normal');

    // والملصق الحقيقي: حبره لازم يبقى قريب من الغامق مش من العادي
    set(K.g, true);
    const wJob = buildTextLabel('كريب سادة لوكس درجة 56', size, 1);
    out.realInk = await inkOf(wJob.image);
    reset();

    // ⚠️ (٦) صورة بايظة → بيرجّع null مايكسرش الطباعة
    out.badReturnsNull = (await imageJobTo1Bit('data:image/png;base64,####')) === null;
    out.nonImageNull = (await imageJobTo1Bit('<html></html>')) === null;

    // ⚠️ (٧) قايمة من غير صور → مفيش أي تغيير
    out.noImagesUntouched = (await shrinkImageJobs([{ html: '<b>x</b>', copies: 1 }])) === null;

    reset();
    return out;
  });

  check('⭐ مقسوم ٤: المفتاح مقفول افتراضيًا', r.qDefaultOff && r.qOffNoSave);
  check('⭐ المسمّى: المفتاح مقفول افتراضيًا', r.gDefaultOff && r.gOffNoSave);

  check('⭐⭐⭐ مقفولين: مقسوم ٤ نص زي الأول', r.offQuarterIsText);
  check('⭐⭐⭐ مقفولين: المسمّى نص زي الأول', r.offGradeIsText);
  check('⭐⭐⭐ مقفولين: الملصق العادي نص زي الأول', r.offItemIsText);

  check('⭐⭐ مقسوم ٤ لوحده → صورة', r.qOnIsImage);
  check('⚠️⚠️ والمسمّى **مااتأثرش**', r.qOnGradeStillText);
  check('⚠️⚠️ والملصق العادي **مااتأثرش**', r.qOnItemStillText);

  check('⭐⭐ المسمّى لوحده → صورة', r.gOnIsImage);
  check('⚠️⚠️ ومقسوم ٤ مااتأثرش', r.gOnQuarterStillText);
  check('⚠️⚠️ والملصق العادي مااتأثرش', r.gOnItemStillText);

  check('⚠️ المفتاح القديم لسه بيشتغل زي ما هو', r.legacyAllImages);

  check('⭐⭐ الترميز اشتغل والصورة اتغيّرت', r.reencoded);
  check('⭐⭐⭐ والنقط **مطابقة بالظبط** (صفر اختلاف)', r.pixelDiff === 0, r.pixelDiff);
  check('⭐⭐ ونفس المقاس بالنقطة', r.sameSize);
  check('⭐⭐ والعمق بقى 1 بت', r.bitDepth === 1, r.bitDepth);
  check('⭐⭐⭐ والحجم قلّ أكتر من ٧٠٪',
    r.afterKB > 0 && r.afterKB < r.beforeKB * 0.3, { قبل: r.beforeKB, بعد: r.afterKB });

  check('⚠️⚠️⚠️ عن بُعد: الجهاز اللي بيطبع مقفول عنده → نص',
    r.remoteOff && r.remoteOff.quarter[0] === false && r.remoteOff.text[0] === false
      && r.remoteOff.many[0] === false && r.remoteOff.many[1] === false, r.remoteOff);
  check('⚠️⚠️⚠️ ولما يفتحهم هو → صورة (مهما كان الباعت)',
    r.remoteOn && r.remoteOn.quarter[0] === true && r.remoteOn.text[0] === true
      && r.remoteOn.many[0] === true && r.remoteOn.many[1] === true, r.remoteOn);

  check('⭐⭐⭐ الملصق كصورة → custom:true بيتبعت', r.imgCustom && r.imgCustom.size && r.imgCustom.size.custom === true, r.imgCustom);
  check('⭐⭐ بالمقاس الحقيقي للملصق (38×25)',
    r.imgCustom && r.imgCustom.size && r.imgCustom.size.width === 38 && r.imgCustom.size.height === 25, r.imgCustom);
  check('⭐ واللي بيتبعت صورة فعلًا', r.imgCustom && r.imgCustom.fmt === 'image', r.imgCustom);
  check('⭐⭐⭐ والمسمّى كصورة → custom:true كمان (مش مقسوم ٤ بس)',
    r.gradeCustom && r.gradeCustom.size && r.gradeCustom.size.custom === true && r.gradeCustom.fmt === 'image', r.gradeCustom);
  check('⭐⭐ والملصق العادي كصورة → custom:true',
    r.itemCustom && r.itemCustom.size && r.itemCustom.size.custom === true && r.itemCustom.fmt === 'image', r.itemCustom);

  check('⚠️⚠️ والملصق كنص **مايتأثرش** (مفيش custom)',
    r.htmlCustom && r.htmlCustom.fmt === 'html' && !(r.htmlCustom.size || {}).custom, r.htmlCustom);
  check('⚠️⚠️ وخليط صورة + نص → مفيش custom (مش كله صور)',
    r.mixedCustom && !(r.mixedCustom.size || {}).custom, r.mixedCustom);

  check('⭐⭐⭐ وزن خط الصورة = bold (مطابق لنسخة الـHTML)', r.labelWeight === 'bold', r.labelWeight);
  check('⭐⭐ والغامق فعلًا أتقل من العادي في الحبر',
    r.inkBold > r.inkNormal * 1.1, { غامق: r.inkBold, عادي: r.inkNormal });
  check('⭐⭐ والملصق الحقيقي فيه حبر (مرسوم فعلًا)', r.realInk > 0.02, r.realInk);

  check('⚠️⚠️ عتبة المرمِّز في النص (128±1)', r.thresholdAt >= 128 && r.thresholdAt <= 129, r.thresholdAt);
  check('⚠️⚠️ الشفاف بيبقى **أبيض** مش أسود', r.transparentIsWhite);
  check('⚠️ والأسود بيفضل أسود', r.blackStaysBlack);

  check('⚠️ صورة بايظة → بيرجّع null (مايكسرش الطباعة)', r.badReturnsNull);
  check('⚠️ حاجة مش صورة → null', r.nonImageNull);
  check('⚠️ قايمة من غير صور → مفيش تغيير', r.noImagesUntouched);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
