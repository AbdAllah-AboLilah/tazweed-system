// ============================================================
// 🎨 تصميم البرنامج المساعد → الورق
// ============================================================
// ⚠️⚠️ المفتاح ده بيغيّر **كل** الملصقات دفعة واحدة لشكل المستخدم
// عمله بإيده. فالحراسة هنا على حاجتين مش واحدة:
//
//   ١) وهو **مقفول** (الافتراضي): الملصق متطابق بايت ببايت مع اللي
//      كان، ومافيش ولا نداء للبرنامج المساعد.
//
//   ٢) وهو **مفتوح** والبرنامج مش شغّال أو التصميم بايظ: الملصق
//      بيطلع بالشكل القديم، **مايقفش**. الطباعة عمرها ما تفشل
//      عشان إعداد شكل — اللي واقف قدام الماكينة مش هيعرف يصلّحها.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 220)}` : ''));

const CAT = {
  itemName: 'بونيه حجاب — بندانه سوري مفتوح درجة 4',
  barcodeNumber: '6221031490112',
  sellingPrice: 85,
  originalPrice: 110,
};
const SIZE = { pageWidthMm: 38, pageHeightMm: 25, halves: 2, copies: 1 };

// نفس شكل التصميم اللي البرنامج بيرجّعه على /design/for
const DESIGN = {
  name: 'ملصق المحل', widthMm: 38, heightMm: 25, halves: 2, cols: 1, font: 'system',
  elements: [
    { kind: 'qr', x: 2.0, y: 1.5, w: 9.5, h: 9.5 },
    { kind: 'name', x: 12.5, y: 1.2, w: 23.5, h: 4.6, fontMm: 1.9, lines: 2, align: 'center', weight: 'normal', overflow: 'shrink', show: 'always' },
    { kind: 'code', x: 12.5, y: 5.9, w: 23.5, h: 2.9, fontMm: 2.4, lines: 1, align: 'center', weight: 'normal', overflow: 'shrink', show: 'always' },
    // ⚠️ السعرين مفصولين: القديم على الشمال والسعر على اليمين.
    // البرنامج المساعد بيفصلهم قبل ما يبعت (splitPrices)، فده شكل
    // اللي بيوصل هنا فعلًا.
    { kind: 'price', x: 22.0, y: 8.8, w: 14.0, h: 2.9, fontMm: 2.4, lines: 1, align: 'center', weight: 'bold', overflow: 'shrink', show: 'always' },
    { kind: 'oldPrice', x: 12.5, y: 8.8, w: 9.0, h: 2.9, fontMm: 2.0, lines: 1, align: 'center', weight: 'normal', overflow: 'shrink', show: 'ifDiscount' },
  ],
};
const QUARTER = { ...DESIGN, name: 'مقسوم ٤', cols: 2 };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildItemLabel === 'function' && typeof getHelperDesign === 'function');

  // مساعد مقلّد: بيعدّ النداءات وبيسجّل الأدوار اللي اتطلبت
  await p.evaluate((d) => {
    window.__calls = [];
    window.__mode = 'ok';
    window.__designs = d;
    window.fetch = async (u) => {
      const url = String(u);
      if (url.indexOf('/design/for') === -1) throw new Error('مش متوقّع');
      const role = (url.match(/role=([^&]+)/) || [])[1] || '';
      window.__calls.push(decodeURIComponent(role));
      if (window.__mode === 'down') throw new Error('البرنامج مش شغّال');
      if (window.__mode === 'garbage') {
        return { ok: true, json: async () => ({ design: { widthMm: 0, elements: [] } }) };
      }
      const key = decodeURIComponent(role);
      return {
        ok: true,
        json: async () => ({
          role: key,
          hidePrice: key === 'noPrice',
          design: key === 'quarter' ? window.__designs.quarter : window.__designs.normal,
        }),
      };
    };
  }, { normal: DESIGN, quarter: QUARTER });

  const build = (opts) => p.evaluate(async (o) => {
    window.__calls = [];
    const r = await buildItemLabel(o.cat, o.size, 1);
    return { img: r.image || '', px: r.previewPx || null, calls: window.__calls.slice() };
  }, { cat: CAT, size: opts || SIZE });

  // ============================================================
  // ⭐⭐⭐⭐⭐ مقفول = مافيش أي تغيير ومافيش أي نداء
  // ============================================================
  const off = await build();
  check('⭐⭐⭐ المفتاح مقفول افتراضيًا', await p.evaluate(() => getPrintTweak('helperDesign') === false), null);
  check('⭐⭐⭐⭐⭐ ومافيش ولا نداء للبرنامج المساعد', off.calls.length === 0, off.calls);
  check('⭐ والملصق اتبنى عادي', off.img.length > 500, off.img.length);

  // ============================================================
  // ⭐⭐⭐⭐⭐ مفتوح = الملصق بيترسم من التصميم فعلًا
  // ============================================================
  await p.evaluate(() => setPrintTweak('helperDesign', true));
  const on = await build();
  check('⭐⭐⭐⭐ بيطلب الدور الصح (عادي)', on.calls.join(',') === 'normal', on.calls);
  check('⭐⭐⭐⭐⭐ والصورة **اتغيّرت** عن الشكل المحفور', on.img !== off.img && on.img.length > 500, {
    same: on.img === off.img,
  });
  // ⚠️ ومقاس الصورة من **التصميم** مش من إعدادات الشاشة: 38مم على
  // 203 نقطة/بوصة = 304 نقطة. لو اتحسب غلط، الطابعة هتمطّها.
  check('⭐⭐⭐⭐ وبمقاس نقط الطابعة من التصميم',
    on.px && on.px.w === 304 && on.px.h === 200, on.px);

  // ⚠️ التخزين: الملصق التاني مالوش نداء — دفعة 200 ملصق معناها 200
  // نداء لو مخزّناش، والتصميم مابيتغيّرش وانت بتطبع.
  const again = await build();
  check('⭐⭐⭐⭐ والملصق اللي بعده مالوش نداء (متخزّن)', again.calls.length === 0, again.calls);
  check('⭐⭐⭐ وبيطلّع نفس الصورة بالظبط', again.img === on.img, null);

  // ============================================================
  // ⭐⭐⭐⭐⭐ من غير سعر — الإجابة على السؤال اللي اتسأل بالنص
  // ============================================================
  // "هل لما اطبع ملصق من غير سعر هيتم تنفيذ التصميم من غير السعر
  //  ولا ده هيحتاج نعمله تصميم معين"
  // الإجابة: نفس التصميم، والسعر بيختفي. والفحص ده بيثبتها.
  const noPrice = await build({ ...SIZE, noPrice: true });
  check('⭐⭐⭐⭐ بيطلب دور "من غير سعر"', noPrice.calls.join(',') === 'noPrice', noPrice.calls);
  check('⭐⭐⭐⭐ والصورة غير اللي فيها سعر', noPrice.img !== on.img, null);

  // ⚠️⚠️ وأقوى من كده: لازم تبقى **مطابقة بالظبط** لرسم نفس التصميم
  // وعناصر السعر مشيلة منه. كده بنثبت إن السعر **اختفى** مش إنه
  // اتزحلق أو اتصغّر.
  const manual = await p.evaluate((a) => {
    const d = JSON.parse(JSON.stringify(a.design));
    d.elements = d.elements.filter((e) => e.kind !== 'price' && e.kind !== 'oldPrice');
    return renderDesignPNG(a.cat, a.size, d, false);
  }, { cat: CAT, size: SIZE, design: DESIGN });
  check('⭐⭐⭐⭐⭐ والسعر **اختفى** مش اتزحلق', noPrice.img === manual, null);

  // ============================================================
  // ⭐⭐⭐⭐ مقسوم ٤ بياخد دوره هو
  // ============================================================
  const q = await p.evaluate(async (o) => {
    window.__calls = [];
    const r = await buildQuarterLabel(o.cat, o.size, 1);
    return { img: r.image || '', calls: window.__calls.slice() };
  }, { cat: CAT, size: SIZE });
  check('⭐⭐⭐⭐ مقسوم ٤ بيطلب دور quarter', q.calls.join(',') === 'quarter', q.calls);
  check('⭐⭐⭐ وبيطلّع صورة غير الملصق العادي', q.img && q.img !== on.img, null);

  // ============================================================
  // ⭐⭐⭐⭐⭐ البرنامج مقفول / التصميم بايظ = نرجع للشكل القديم
  // ============================================================
  // ⚠️⚠️ ده أهم فحص في الملف. الطباعة عمرها ما تقف عشان إعداد شكل.
  const down = await p.evaluate(async (o) => {
    clearHelperDesignCache();
    window.__mode = 'down';
    const r = await buildItemLabel(o.cat, o.size, 1);
    return r.image || '';
  }, { cat: CAT, size: SIZE });
  check('⭐⭐⭐⭐⭐ البرنامج مش شغّال → الملصق بالشكل القديم بايت ببايت', down === off.img, {
    same: down === off.img, len: down.length,
  });

  const junk = await p.evaluate(async (o) => {
    clearHelperDesignCache();
    window.__mode = 'garbage';
    const r = await buildItemLabel(o.cat, o.size, 1);
    return r.image || '';
  }, { cat: CAT, size: SIZE });
  check('⭐⭐⭐⭐⭐ تصميم بايظ → الملصق بالشكل القديم بايت ببايت', junk === off.img, {
    same: junk === off.img,
  });

  // ============================================================
  // ⭐⭐⭐ قفل المفتاح بيرجّع كل حاجة **فورًا**
  // ============================================================
  // ⚠️ من غير مسح المتخزّن، المستخدم بيقفل المفتاح وبيفضل يطبع
  // بالتصميم لحد دقيقة — ويفتكر إن القفل مش شغّال.
  const back = await p.evaluate(async (o) => {
    window.__mode = 'ok';
    setPrintTweak('helperDesign', false);
    window.__calls = [];
    const r = await buildItemLabel(o.cat, o.size, 1);
    return { img: r.image || '', calls: window.__calls.slice() };
  }, { cat: CAT, size: SIZE });
  check('⭐⭐⭐⭐ القفل بيرجّع الشكل القديم على طول', back.img === off.img, null);
  check('⭐⭐⭐ ومافيش نداء بعد القفل', back.calls.length === 0, back.calls);

  // ============================================================
  // ⭐⭐⭐⭐⭐ اتجاه كل نوع نص — عطل حقيقي اتمسك من الصورة
  // ============================================================
  // ⚠️⚠️ أول نسخة من renderDesignPNG كانت بترسم **كل** حاجة بـrtl
  // (لأنها كانت بتنده drawLines اللي بتفرضها)، والنتيجة على الورق:
  //
  //     المطلوب: 85 L.E        اللي طلع: L.E 85
  //
  // ومحدش كان هيلاحظ من الكود: الاسم العربي بيطلع صح والملصق شكله
  // سليم. الفحص ده بيتجسّس على الكانفاس نفسه ويسجّل الاتجاه اللي
  // كل نص اترسم بيه — فمافيش طريقة يعدّي بيها من غير ما يبان.
  const dirs = await p.evaluate((a) => {
    const seen = [];
    const realGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const ctx = realGet.apply(this, args);
      if (!ctx || ctx.__spied) return ctx;
      const realFill = ctx.fillText.bind(ctx);
      ctx.fillText = (t, x, y) => {
        seen.push({ t: String(t), dir: ctx.direction });
        return realFill(t, x, y);
      };
      ctx.__spied = true;
      return ctx;
    };
    try {
      renderDesignPNG(a.cat, a.size, a.design, false);
    } finally {
      HTMLCanvasElement.prototype.getContext = realGet;
    }
    return seen;
  }, { cat: CAT, size: SIZE, design: DESIGN });

  const dirOf = (needle) => {
    const row = dirs.find((r) => r.t.indexOf(needle) !== -1);
    return row ? row.dir : null;
  };
  check('⭐⭐⭐⭐⭐ السعر بيترسم **إنجليزي** (وإلا 85 L.E بتتقلب)',
    dirOf('85 L.E') === 'ltr', dirs);
  check('⭐⭐⭐⭐⭐ والسعر القديم كمان', dirOf('110 L.E') === 'ltr', dirs);
  check('⭐⭐⭐⭐ ورقم الباركود', dirOf('6221031490112') === 'ltr', dirs);
  // ⚠️ والاسم **عربي** — من غيرها `الCopy` بتتطبع `لاCopy`.
  check('⭐⭐⭐⭐⭐ واسم الصنف بيترسم عربي', dirOf('بونيه') === 'rtl', dirs);

  // ============================================================
  // ⭐⭐⭐⭐⭐ كل سعر في صندوقه — والقديم على الشمال
  // ============================================================
  // اتطلب بالنص: "المفروض السعر اللي هو بعد الخصم يبقي علي اليمين
  // وقبل الخصم علي اليسار والاتنين يتحركوا لوحدهم".
  //
  // ⚠️ الفحص على **مكان الرسم** مش على الصورة: الصورة بتفرق لأي
  // سبب (خط، تصغير)، لكن إحداثي الرسم بيقول بالظبط كل رقم راح فين.
  const spots = await p.evaluate((a) => {
    const seen = [];
    const bars = [];
    const realGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const ctx = realGet.apply(this, args);
      if (!ctx || ctx.__spied2) return ctx;
      const realFill = ctx.fillText.bind(ctx);
      const realRect = ctx.fillRect.bind(ctx);
      ctx.fillText = (t, x, y) => { seen.push({ t: String(t), x, y }); return realFill(t, x, y); };
      ctx.fillRect = (x, y, w, h) => { bars.push({ x, y, w, h }); return realRect(x, y, w, h); };
      ctx.__spied2 = true;
      return ctx;
    };
    try {
      renderDesignPNG(a.cat, a.size, a.design, false);
    } finally {
      HTMLCanvasElement.prototype.getContext = realGet;
    }
    return { seen, bars };
  }, { cat: CAT, size: SIZE, design: DESIGN });

  const at = (needle) => {
    const row = spots.seen.find((r) => r.t.indexOf(needle) !== -1);
    return row || null;
  };
  const sell = at('85 L.E');
  const old = at('110 L.E');

  check('⭐⭐⭐⭐⭐ السعر القديم بيترسم **على شمال** السعر، مش فوقه',
    !!(sell && old) && old.x < sell.x, { old: old && old.x, sell: sell && sell.x });

  // ⚠️⚠️ والأدق: كل واحد في **نص صندوقه هو**. النسبة بتشيل أي
  // معامل تكبير في الكانفاس، فالفحص بيقيس المكان مش الوحدة.
  //   القديم: 12.5 + 9.0/2  = 17.0مم
  //   السعر:  22.0 + 14.0/2 = 29.0مم
  const ratio = sell && old ? old.x / sell.x : 0;
  check('⭐⭐⭐⭐⭐ وكل واحد في نص صندوقه هو (17.0مم و29.0مم)',
    Math.abs(ratio - 17.0 / 29.0) < 0.02, { ratio, want: 17.0 / 29.0 });

  // ⚠️ والقديم **بره** صندوق السعر تمامًا: ده اللي كان بيحصل قبل
  // كده والرقمين كانوا بيتراكبوا — "110L.E85 L.E".
  check('⭐⭐⭐⭐ والقديم بره صندوق السعر خالص',
    ratio < 22.0 / 29.0, { ratio, edge: 22.0 / 29.0 });

  // ⚠️ الشطب لسه موجود: من غيره القديم بيبان كأنه سعر تاني.
  const near = spots.bars.filter((r) => old && Math.abs(r.x + r.w / 2 - old.x) < 6 && r.h <= 4);
  check('⭐⭐⭐⭐ والسعر القديم لسه مشطوب', near.length >= 1, { bars: spots.bars.length, near: near.length });

  // ============================================================
  // ⭐⭐⭐⭐⭐ والمسار الكامل بينزّل الخط **قبل** ما يرسم
  // ============================================================
  // ⚠⚠ الكانفاس مابيطلبش الخط عشان انت كتبت اسمه — لازم حد
  // ينزّله الأول. ولو رسمنا قبل ما ينزل، الملصق بيطلع بخط الجهاز
  // **في سكوت** والمعاينة فاضلة صح.
  //
  // ⚠️ والفحص ده بيستخدم خط **مالمسوش حد في الملف ده** (تجوّل):
  // أي خط اتحمّل فوق بيفضل محمّل في الصفحة، فالفحص كان هيعدّي حتى
  // لو المسار مابينزّلش حاجة.
  const hookFont = await p.evaluate(async (o) => {
    setLabelFontId('system');
    await ensureLabelFontReady();
    window.__designs.normal = { ...window.__designs.normal, font: 'tajawal' };
    clearHelperDesignCache();
    window.__mode = 'ok';
    setPrintTweak('helperDesign', true);

    let fam = '';
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const c = real.apply(this, args);
      if (c && !c.__hookSpy) {
        Object.defineProperty(c, 'font', {
          set(v) { if (/px /.test(v) && !fam) fam = v.split('px ')[1]; this.__f = v; },
          get() { return this.__f || '10px sans-serif'; },
        });
        c.__hookSpy = true;
      }
      return c;
    };
    try {
      await buildItemLabel(o.cat, o.size, 1);
    } finally {
      HTMLCanvasElement.prototype.getContext = real;
    }
    return fam;
  }, { cat: CAT, size: SIZE });

  check('⭐⭐⭐⭐⭐ المسار الكامل بينزّل خط التصميم قبل ما يرسم',
    /TZ Tajawal/.test(hookFont), hookFont);

  // ============================================================
  // ⭐⭐⭐⭐⭐ خط **التصميم** بيكسب على خط الإعدادات
  // ============================================================
  // ⚠⚠ اتبلّغ بالنص: "انا كنت معدل الخط في الملصق في البرنامج
  // المساعد طلع ب الخط الافتراضي ليه عشان في الاعدادات بتاع النظام
  // شغال علي الخط الافتراضي".
  //
  // التصميم شايل خط بتاعه، والمصمّم بيعرضه بيه وبيطبع تجربته بيه —
  // وكان النظام بيتجاهله. فاللي في المصمّم غير اللي على الورق، وده
  // بيفضّي المصمّم من معناه.
  const fontUsed = await p.evaluate(async (a) => {
    // ⚠️ إعدادات النظام على "خط الجهاز" — زي حالة اللي بلّغ بالظبط
    setLabelFontId('system');
    await ensureLabelFontReady();

    const grab = async (fontId) => {
      const d = JSON.parse(JSON.stringify(a.design));
      d.font = fontId;
      if (fontId) await ensureFontReadyById(fontId);
      let fam = '';
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args) {
        const c = real.apply(this, args);
        if (c && !c.__famSpy) {
          Object.defineProperty(c, 'font', {
            set(v) { if (/px /.test(v) && !fam) fam = v.split('px ')[1]; this.__f = v; },
            get() { return this.__f || '10px sans-serif'; },
          });
          c.__famSpy = true;
        }
        return c;
      };
      try { renderDesignPNG(a.cat, a.size, d, false); } finally {
        HTMLCanvasElement.prototype.getContext = real;
      }
      return fam;
    };

    const out = {
      cairo: await grab('cairo'),
      almarai: await grab('almarai'),
      system: await grab('system'),
    };
    setLabelFontId('system');
    return out;
  }, { cat: CAT, size: SIZE, design: DESIGN });

  check('⭐⭐⭐⭐⭐ خط التصميم بيترسم بيه فعلًا (والإعدادات على خط الجهاز)',
    /TZ Cairo/.test(fontUsed.cairo), fontUsed);
  check('⭐⭐⭐⭐ وتصميم تاني بخط تاني بياخد خطه هو',
    /TZ Almarai/.test(fontUsed.almarai), fontUsed);
  // ⚠⚠ والتصميم اللي على "خط الجهاز" **مايغيّرش حاجة**: اللي ظابط
  // خط في الإعدادات ومعندهوش خط في التصميم لازم يفضل زي ما هو.
  check('⭐⭐⭐⭐⭐ وتصميم على "خط الجهاز" بيرجع لإعداد النظام',
    !/TZ /.test(fontUsed.system), fontUsed);

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
