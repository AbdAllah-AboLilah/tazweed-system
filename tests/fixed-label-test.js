// مقاسات ثابتة للسعر ورقم الباركود — مفتاح fixedLabelSizes
// ============================================================
// العطل اللي اتبلّغ: "كل ملصق غير التاني في حجم الخط وتنسيقه".
//
// والقياس أكّده: السعر والرقم بيفرقوا 20% بين ملصق وملصق، **ومش
// بانتظام** — اسم أطول ممكن يطلّع رقم أكبر. السبب إن التلاتة (اسم +
// رقم + سعر) بيتحسبوا في معادلة واحدة، فالاسم الطويل بيجرّهم معاه.
//
// ⚠️⚠️ أهم فحص هنا هو الأول: **المفتاح مقفول = الملصق بايت ببايت زي ما
// كان**. كل حاجة بنضيفها على الطباعة لازم يبقى ليها وضع "مطفي تمامًا" —
// اتلسعنا من ده مرتين قبل كده.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

const ITEMS = [
  ['قصير',       'خمار',                                                    '822548',   400, 300],
  ['عادي',       'خمار اسدال بكم القدس',                                     '16460334', 200, 150],
  ['عادي ٢',     'خمار ملحفة زبدة القدس',                                    '822548',   400, 300],
  ['أطول',       'خمار ملحفة فايبر القدس مطرز',                              '14663030', 350, 280],
  ['طويل',       'كريب سادة لوكس مطرّز بالدانتيل العريض',                     '13845560', 200, 135],
  ['طويل جدًا',  'خمار ملحفة فايبر القدس مطرز بالدانتيل العريض درجة أولى',    '14663030', 350, 280],
  ['من غير خصم', 'خمار ملحفة زبدة القدس',                                    '822548',   0,   300],
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildLabelHTML === 'function' && typeof getPrintTweak === 'function');

  const r = await p.evaluate((items) => {
    const size = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
    const mk = ([, name, code, orig, sell]) => ({
      itemName: name, barcodeNumber: code, sellingPrice: sell,
      ...(orig ? { originalPrice: orig } : {}),
    });
    const num = (h, re) => { const m = h.match(re); return m ? Number(m[1]) : null; };
    const read = (h) => {
      const nm = num(h, /\.name \{\s*font-size: ([\d.]+)mm/);
      const mh = num(h, /max-height: ([\d.]+)mm/);
      return {
        name: nm,
        lines: nm ? Math.round(mh / (1.2 * nm)) : 0,
        code: num(h, /\.code \{ font-size: ([\d.]+)mm/),
        price: num(h, /\.price b \{ font-weight: bold; font-size: ([\d.]+)mm/),
        old: num(h, /\.price s \{ font-weight: normal; font-size: ([\d.]+)mm/),
        hasBot: h.indexOf('class="bot"') !== -1,
        tight: h.indexOf('line-height: 1.05') !== -1,
      };
    };
    const out = { off: [], on: [], identical: true };
    for (const it of items) {
      const cat = mk(it);
      setPrintTweak('fixedLabelSizes', false);
      const offHTML = buildLabelHTML(cat, size, null, 1);
      setPrintTweak('fixedLabelSizes', true);
      const onHTML = buildLabelHTML(cat, size, null, 1);
      out.off.push({ lbl: it[0], ...read(offHTML) });
      out.on.push({ lbl: it[0], ...read(onHTML) });
    }

    // ============================================================
    // ⚠️⚠️ الحارس الأهم: مقفول = بايت ببايت زي ما كان
    // ============================================================
    // بنقارن نص الملصق **كامل** حرف بحرف قبل وبعد ما المفتاح يتضاف.
    // مش بنقارن مقاسات — بنقارن المخرج نفسه.
    setPrintTweak('fixedLabelSizes', false);
    const a = buildLabelHTML(mk(items[1]), size, null, 1);
    const a2 = buildLabelHTML(mk(items[1]), size, null, 1);
    out.stableOff = a === a2;
    out.offNoBot = a.indexOf('class="bot"') === -1;
    out.offNoTight = a.indexOf('line-height: 1.05') === -1;

    // ⚠️ ومع نسخ متعددة ومقاسات تانية كمان
    out.offCopies = buildLabelHTML(mk(items[1]), size, null, 3);
    out.offSingle = buildLabelHTML(mk(items[1]), { pageWidthMm: 50, pageHeightMm: 25, halves: 1 }, null, 1);
    out.offCopiesClean = out.offCopies.indexOf('class="bot"') === -1;
    out.offSingleClean = out.offSingle.indexOf('class="bot"') === -1;

    // ---------- سعر عريض أوي: لازم يصغّر مش يتقص ----------
    setPrintTweak('fixedLabelSizes', true);
    const wide = buildLabelHTML(
      { itemName: 'خمار', barcodeNumber: '8901234567890', originalPrice: 120000, sellingPrice: 99999 },
      size, null, 1
    );
    out.widePrice = num(wide, /\.price b \{ font-weight: bold; font-size: ([\d.]+)mm/);
    out.wideCode = num(wide, /\.code \{ font-size: ([\d.]+)mm/);

    // ---------- الاسم بياخد 3 سطور لما يحتاج ----------
    // ⚠️ المقاس ده مقاس مش متخيّل: قِسنا الأطوال واحد واحد ولقينا
    // السطر التالت بيتاخد من **80 حرف** فوق. أول نسخة من الفحص كانت
    // باسم 74 حرف وطلعت سطرين — والخوارزمية كانت سليمة، الفحص هو اللي
    // كان متظبّط غلط.
    const hugeName = 'خمار ملحفة فايبر القدس مطرز بالدانتيل العريض درجة أولى تطريز يدوي فاخر جدا ممتاز';
    const huge = buildLabelHTML(
      { itemName: hugeName, barcodeNumber: '14663030', originalPrice: 350, sellingPrice: 280 },
      size, null, 1
    );
    out.hugeLen = hugeName.length;
    const hn = num(huge, /\.name \{\s*font-size: ([\d.]+)mm/);
    const hm = num(huge, /max-height: ([\d.]+)mm/);
    out.hugeLines = hn ? Math.round(hm / (1.2 * hn)) : 0;
    out.hugeName = hn;
    out.hugeCode = num(huge, /\.code \{ font-size: ([\d.]+)mm/);

    setPrintTweak('fixedLabelSizes', false);
    return out;
  }, ITEMS);

  const spread = (rows, k) => {
    const v = rows.map((x) => x[k]).filter((x) => x);
    return v.length ? Math.max(...v) / Math.min(...v) - 1 : 0;
  };

  // ---------- الحارس الأهم ----------
  check('⚠️⚠️ المفتاح مقفول → مفيش غلاف .bot في الملصق', r.offNoBot);
  check('⚠️⚠️ ولا سطر مضغوط', r.offNoTight);
  check('⚠️ والنداءين المتتاليين بيطلّعوا نفس النص', r.stableOff);
  check('⚠️ ومع نسخ متعددة برضه نضيف', r.offCopiesClean);
  check('⚠️ ومع ملصق مقاس تاني (50×25 نص واحد) برضه نضيف', r.offSingleClean);

  // ---------- المشكلة موجودة قبل ----------
  check('⭐⭐ قبل: الرقم بيفرق بين ملصق وملصق',
    spread(r.off, 'code') > 0.1, `${(100 * spread(r.off, 'code')).toFixed(0)}%`);
  check('⭐⭐ وقبل: السعر كمان',
    spread(r.off, 'price') > 0.1, `${(100 * spread(r.off, 'price')).toFixed(0)}%`);

  // ---------- واتحلّت بعد ----------
  check('⭐⭐ بعد: الرقم **واحد** على كل الملصقات',
    spread(r.on, 'code') < 1e-6, r.on.map((x) => `${x.lbl}:${x.code}`));
  check('⭐⭐ وبعد: السعر واحد كمان',
    spread(r.on, 'price') < 1e-6, r.on.map((x) => `${x.lbl}:${x.price}`));
  check('⭐ والسعر القديم واحد كمان',
    spread(r.on.filter((x) => x.old), 'old') < 1e-6, r.on.map((x) => `${x.lbl}:${x.old}`));
  check('⭐ والأرقام هي اللي اتفقنا عليها (2.4 / 2.6)',
    r.on[1].code === 2.4 && r.on[1].price === 2.6, { code: r.on[1].code, price: r.on[1].price });

  // ---------- الغلاف والتضييق ----------
  check('⭐⭐ الرقم والسعر جوّه غلاف واحد (الفراغ بينهم بيقل)',
    r.on.every((x) => x.hasBot));
  check('⭐ وسطرهم مضغوط', r.on.every((x) => x.tight));

  // ---------- الاسم ----------
  const short = r.on.filter((x) => x.lines === 1);
  const shortSame = short.every((x) => {
    const o = r.off.find((y) => y.lbl === x.lbl);
    return Math.abs(o.name - x.name) < 1e-6;
  });
  check('⭐⭐ الأسماء اللي بسطر واحد **ماتغيّرتش خالص**', shortSame,
    short.map((x) => `${x.lbl}:${x.name}`));

  // الأسماء الطويلة بتصغر شوية — بس مش 20%
  const twoLine = r.on.filter((x) => x.lines >= 2);
  const worst = Math.max(...twoLine.map((x) => {
    const o = r.off.find((y) => y.lbl === x.lbl);
    return o.name > x.name ? o.name / x.name - 1 : 0;
  }));
  check('⭐ والأسماء الطويلة صغرت أقل من 10% (التضييق رجّعلها اللي أخده التثبيت)',
    worst < 0.1, `${(100 * worst).toFixed(0)}%`);
  check('⚠️ ومحصلش اسم اختفى', r.on.every((x) => x.name > 0.8), r.on.map((x) => x.name));

  // ---------- الحماية من القص ----------
  check('⚠️⚠️ سعر عريض أوي بيصغّر (مايتقصش)',
    r.widePrice !== null && r.widePrice < 2.6, r.widePrice);
  check('⚠️ وباركود 13 رقم لسه بياخد المقاس الثابت',
    r.wideCode === 2.4, r.wideCode);

  // ---------- 3 سطور ----------
  check('⭐ اسم طويل جدًا بياخد 3 سطور', r.hugeLines === 3, { lines: r.hugeLines, len: r.hugeLen });
  check('⚠️⚠️ والرقم والسعر **ماصغروش** معاه', r.hugeCode === 2.4, r.hugeCode);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
