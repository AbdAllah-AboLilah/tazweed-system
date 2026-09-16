// ============================================================
// 📄 خط ورقة التزويد
// ============================================================
// اتطلب بالنص: "هو احنا ممكن نغير خط ورقة التزويد ... بدون م تأثر
// علي حجمها او شكلها او توزيع الجدول او شكله"، وبعدين "اعمل خط ورقة
// التزويد زي اقتراحك".
//
// ⚠️⚠️ والفخ اللي الملف ده موجود عشانه: الورقة **مش** بتترسم زي
// الملصق. الملصق كانفاس (document.fonts.load بتكفّي)، والورقة بتتسلسل
// XML وبتترسم جوّه <foreignObject> جوّه <svg> محمّل كـ<img>.
//
// و**الصورة مايسمحلهاش تجيب أي ملف من بره** — قانون في المتصفح نفسه.
// يعني @font-face بيشاور على ملف مش هيتحمّل جوّه الصورة.
//
// ولو عملناها غلط، النتيجة أوحش من إن الخط مايتغيّرش:
//   • القياس في إطار حقيقي → الخط بينزل → ارتفاع كذا
//   • الرسم جوّه الصورة → الخط مابينزلش → ارتفاع مختلف
//   • الورقة بتتقص
//
// فالفحص الأهم هنا مش "الـCSS فيه اسم الخط" — ده **الصورة اتغيّرت**.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 200)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 900, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildRestockHTML === 'function' && typeof sheetFontStack === 'function');

  const setup = () => p.evaluate(() => {
    state.profile = { id: 'me', name: 'x', role: 'owner' };
    const cat = { id: 'c1', name: 'كريب سادة', itemName: 'كريب' };
    const grades = [];
    for (let i = 1; i <= 24; i++) {
      grades.push({ id: 'g' + i, number: String(i), branchQty: 0, mainQty: 5, status: 'pending', group: 'بيجات' });
    }
    window.__cat = cat;
    window.__grades = grades;
  });
  await setup();

  const build = () => p.evaluate(() => buildRestockHTML(window.__cat, window.__grades, 'بيجات', false, ''));

  // ============================================================
  // ⭐⭐⭐⭐⭐ الافتراضي = ورقة متطابقة بالحرف
  // ============================================================
  const off = await build();
  check('⭐⭐⭐ الافتراضي هو خط الجهاز',
    await p.evaluate(() => getSheetFontId() === 'system'), null);
  check('⭐⭐⭐⭐⭐ والورقة مافيهاش أي @font-face', off.indexOf('@font-face') === -1, null);
  check('⭐⭐⭐⭐ ونص الخطوط زي ما هو بالحرف',
    /font-family: Tahoma, Arial, sans-serif;/.test(off), null);

  // ============================================================
  // ⭐⭐⭐⭐⭐ الاختيار: البايتات جوّه الورقة مش رابط لملف
  // ============================================================
  const on = await p.evaluate(async () => {
    setSheetFontId('tajawal');
    const ready = await ensureSheetFontReady();
    return { ready, html: buildRestockHTML(window.__cat, window.__grades, 'بيجات', false, '') };
  });
  check('⭐⭐⭐ بايتات الخط اتجهّزت', on.ready === true, on.ready);
  check('⭐⭐⭐⭐ ونص الخطوط بقى الخط المختار',
    /font-family: 'TZ Tajawal', Tahoma, Arial, sans-serif;/.test(on.html), null);
  // ============================================================
  // ⚠️⚠️⚠️ الورقة فيها **رابط**، والصورة فيها **البايتات**
  // ============================================================
  // ده اتغيّر في v1.5.0، والعطل اللي خلّاه يتغيّر اتبلّغ بالنص:
  //   "لما غيرت الخط الي المراعي بيطبع كل مجموعة مع بعض بالرغم من اني
  //    عامل الورقة كلها مرة واحده"
  //
  // القياس على فئة 57 درجة: الورقة بخط الجهاز 9.6 كيلو، وبالمراعي
  // **140** — منها 130 للخط. وحد أمر الطباعة 44، فالورقة كانت بتتقسّم.
  //
  // فالبايتات اتنقلت للمكان الوحيد اللي محتاجها: الصورة (الشرح عند
  // sheetFontFaceCSS و renderSheetImage).
  check('⭐⭐⭐⭐⭐ الورقة فيها **رابط** للخط مش بايتات',
    on.html.indexOf('data:font') === -1 && /src:url\('[^']*\/fonts\/[^']+\.woff2'\)/.test(on.html),
    on.html.slice(on.html.indexOf('@font-face'), on.html.indexOf('@font-face') + 160));
  check('⭐⭐⭐ والوزنين موجودين', (on.html.match(/@font-face/g) || []).length >= 4, null);

  // ============================================================
  // ⭐⭐⭐⭐⭐ الرابط **مطلق** — عشان الطباعة من التليفون
  // ============================================================
  // ⚠⚠ اتسأل بالنص: "عاوزك تتاكد من ارسال ورقة التزويد من الهاتف
  // عند تغير الخط هتطلع مظبوطه ب الخط اللي اتغير في النظام مش خط
  // الهاتف".
  //
  // الورقة بتتبني على **التليفون** وبتتبعت للكمبيوتر جاهزة. فالرابط
  // اللي جوّاها لازم يكون مطلق: الرابط النسبي بيتحلّ على الجهاز اللي
  // بيرسم، ولو مساره مختلف الخط مش هينزل والورقة تطلع بخط الجهاز.
  const urls = [...on.html.matchAll(/src:url\('([^']+)'\)/g)].map((m) => m[1]);
  check('⭐⭐⭐⭐⭐ وروابط الخط **مطلقة** (عشان الجهاز التاني يوصلها)',
    urls.length >= 4 && urls.every((u) => /^https?:\/\//.test(u)), urls.slice(0, 2));

  // ⚠️ والخط اللي بيتكتب في الورقة هو **المشترك** من السحابة، مش
  // اللي محفوظ على التليفون. getSheetFontId بتقرا المشترك الأول.
  const shared = await p.evaluate(() => {
    const before = getSheetFontId();
    window.__printFields = { sheetFont: 'cairo' };
    const realRead = window.readPrintField;
    window.readPrintField = (k) => (k === 'sheetFont' ? 'cairo' : realRead(k));
    const got = getSheetFontId();
    window.readPrintField = realRead;
    return { before, got };
  });
  check('⭐⭐⭐⭐⭐ والخط بيتقرا من الإعداد **المشترك** مش من الجهاز',
    shared.got === 'cairo', shared);

  // ⚠️⚠️ وده اللي بيحرس العطل نفسه: حجم الورقة لازم يفضل تحت الحد
  // مهما كان الخط، وإلا بتتقسّم لكل مجموعة لوحدها.
  const sizes = await p.evaluate(async () => {
    const out = [];
    for (const id of ['system', 'almarai', 'cairo', 'tajawal', 'plex']) {
      setSheetFontId(id);
      await ensureSheetFontReady();
      const html = buildRestockHTML(window.__cat, window.__grades, '', true, '');
      out.push({ id, kb: +(new TextEncoder().encode(html).length / 1024).toFixed(1) });
    }
    setSheetFontId('tajawal');
    await ensureSheetFontReady();
    return { rows: out, limitKB: RESTOCK_SAFE_BYTES / 1024 };
  });
  const over = sizes.rows.filter((x) => x.kb > sizes.limitKB * 0.5);
  check('⭐⭐⭐⭐⭐ وحجم الورقة بأي خط أقل من نص الحد (مابتتقسّمش)',
    over.length === 0, { الحد: sizes.limitKB, المقاسات: sizes.rows });

  // ⚠️ والبايتات لسه موجودة — بس في نسختها هي، اللي بتروح للصورة.
  const inlineCSS = await p.evaluate(() => sheetFontFaceInlineCSS());
  check('⭐⭐⭐⭐ والبايتات لسه متاحة للصورة',
    /src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{500,}\)/.test(inlineCSS), null);

  // ============================================================
  // ⭐⭐⭐⭐⭐ والبايتات بتوصل **جوّه الصورة** فعلًا
  // ============================================================
  // ⚠️⚠️ ده أهم فحص في الملف بعد الحجم، والسبب اتقاس:
  // لما شيلنا الحقن وجرّبنا، الصورة طلعت 28.2مم بدل 27.4 — يعني
  // **القياس** حصل بالخط المختار (في الإطار، والرابط شغّال فيه)
  // و**الرسم** حصل بخط الجهاز (في الصورة، والرابط مش شغّال). الفرق
  // ده معناه ورقة بتتقص من تحت.
  //
  // ⚠️ والفحص بيتجسّس على التسلسل نفسه — يعني بيشوف اللي بيدخل
  // الصورة بالظبط. مقارنة الصور ببعض **مش كفاية**: الصورتين بيختلفوا
  // في الطول حتى لو الخط مانزلش، فالمقارنة بتعدّي وهي فاضية.
  const inImage = await p.evaluate(async () => {
    setSheetFontId('almarai');
    await ensureSheetFontReady();
    const html = buildRestockHTML(window.__cat, window.__grades, '', true, '');
    let xml = '';
    const real = XMLSerializer.prototype.serializeToString;
    XMLSerializer.prototype.serializeToString = function (node) {
      const out = real.call(this, node);
      if (out.length > xml.length) xml = out;
      return out;
    };
    try {
      await renderSheetImage(html);
    } finally {
      XMLSerializer.prototype.serializeToString = real;
    }
    setSheetFontId('tajawal');
    await ensureSheetFontReady();
    return { hasBytes: xml.indexOf('data:font/woff2') !== -1, len: xml.length };
  });
  check('⭐⭐⭐⭐⭐ والبايتات بتوصل جوّه الصورة (وإلا الورقة تتقاس بخط وترسم بخط)',
    inImage.hasBytes === true, inImage);

  // ============================================================
  // ⭐⭐⭐⭐⭐ والجدول **مايتغيّرش** — ده اللي اتسأل عنه بالنص
  // ============================================================
  // "بدون م تأثر علي حجمها او شكلها او توزيع الجدول او شكله"
  const geo = (html) => ({
    width: (html.match(/width: (\d+)mm/) || [])[1],
    cols: (html.match(/column-count: (\d+)/) || [])[1],
    page: (html.match(/@page \{ size: (\d+)mm/) || [])[1],
    rowH: (html.match(/min-height: ([\d.]+)mm/) || [])[1],
  });
  const g1 = geo(off), g2 = geo(on.html);
  check('⭐⭐⭐⭐⭐ عرض الورقة وعدد الأعمدة وارتفاع السطر زي ما هم',
    JSON.stringify(g1) === JSON.stringify(g2) && g1.width === '66' && g1.cols === '4', { g1, g2 });

  // ============================================================
  // ⭐⭐⭐⭐⭐ الدليل الحقيقي: الصورة نفسها اتغيّرت
  // ============================================================
  // ⚠️ كل اللي فوق ممكن يعدّي والصورة تطلع بخط الجهاز — لأن الصورة
  // بترسم في سياق تاني. فبنرسمها فعلًا ونقارن.
  const img = await p.evaluate(async () => {
    setSheetFontId('system');
    await ensureSheetFontReady();
    const a = await renderSheetImage(buildRestockHTML(window.__cat, window.__grades, 'بيجات', false, ''));

    setSheetFontId('tajawal');
    await ensureSheetFontReady();
    const c = await renderSheetImage(buildRestockHTML(window.__cat, window.__grades, 'بيجات', false, ''));

    setSheetFontId('system');
    return {
      okA: !!(a && a.image), okB: !!(c && c.image),
      same: a && c ? a.image === c.image : null,
      hA: a ? a.heightMm : 0, hB: c ? c.heightMm : 0,
      wA: a ? a.widthMm : 0, wB: c ? c.widthMm : 0,
    };
  });
  check('⭐⭐⭐ الورقة اترسمت كصورة في الحالتين', img.okA && img.okB, img);
  check('⭐⭐⭐⭐⭐ والصورة **اتغيّرت** فعلًا — يعني الخط وصل جوّه الصورة',
    img.same === false, img);
  // ⚠️ والعرض ثابت بالمليمتر: ده اللي بيضمن إن الورقة مش هتتمط ولا تتقص.
  check('⭐⭐⭐⭐ وعرض الورقة بالمليمتر واحد في الحالتين', img.wA === img.wB, img);
  // ⚠️ والطول ممكن يفرق — وده متوقّع ومقبول (اتفقنا عليه بالنص)، بس
  // مش بفرق مجنون. أكتر من 25% معناه إن الخط مااتحمّلش في ناحية.
  const drift = Math.abs(img.hA - img.hB) / Math.max(1, img.hA);
  check('⭐⭐⭐⭐ وطول الورقة قريب (مش فرق مجنون)', drift < 0.25, { ...img, drift: +drift.toFixed(3) });

  // ============================================================
  // ⭐⭐⭐⭐⭐ الحارس: بايتات مش جاهزة = خط الجهاز، مش نص حل
  // ============================================================
  // ⚠️⚠️ لو الملفات فشلت تتجاب (نت مقطوع، ملف ناقص)، **مايصحّش**
  // نكتب اسم الخط في الورقة: القياس هيحصل بخط الجهاز والرسم كمان،
  // بس لو كتبنا الاسم من غير البايتات، الإطار ممكن يلاقي الخط
  // محمّل من styles.css والصورة لأ — وساعتها الورقة بتتقص.
  //
  // فالقاعدة: يا البايتات جاهزة والاسم مكتوب، يا الاتنين لأ.
  const guarded = await p.evaluate(async () => {
    const real = window.fetch;
    setSheetFontId('cairo');
    sheetFontReadyId = '';
    Object.keys(sheetFontBytes).forEach((k) => delete sheetFontBytes[k]);
    window.fetch = async () => { throw new Error('مفيش نت'); };
    const ready = await ensureSheetFontReady();
    const html = buildRestockHTML(window.__cat, window.__grades, 'بيجات', false, '');
    window.fetch = real;
    setSheetFontId('system');
    return { ready, hasFace: html.indexOf('@font-face') !== -1, stack: /font-family: ([^;]+);/.exec(html)[1] };
  });
  check('⭐⭐⭐⭐ الجلب لو فشل بيقول فشل', guarded.ready === false, guarded);
  check('⭐⭐⭐⭐⭐ والورقة بترجع لخط الجهاز بالحرف',
    guarded.hasFace === false && guarded.stack === 'Tahoma, Arial, sans-serif', guarded);

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
