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
  // ⚠️⚠️ **أهم سطر في الملف**: data: مش url لملف. لو ده اتغيّر لرابط،
  // الورقة هتتقاس بخط وتترسم بخط تاني.
  check('⭐⭐⭐⭐⭐ والخط متكتوب بالبايتات جوّه الورقة (data:)',
    /src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{500,}\)/.test(on.html), null);
  check('⭐⭐⭐⭐⭐ ومافيش أي رابط لملف خط في الورقة',
    !/url\(['"]?https?:/.test(on.html) && on.html.indexOf('/fonts/') === -1, null);
  check('⭐⭐⭐ والوزنين موجودين', (on.html.match(/@font-face/g) || []).length >= 4, null);

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
