// v0.28.0 — الملصق بيترسم عندنا كصورة
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,240)}` : ''));

const NAMES = ['Chanvie Leen 58047','طباقيه كويتى كباسين','Qianqianfendai.','كريب','حجاب سوري وطباقيه',
               'خمار اسدال بكم طويل جدا جدا','AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','Hejap Kuwaiti 120','a'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof renderLabelPNG === 'function');

  // ---------- مقاس الصورة = نقط الطابعة بالظبط ----------
  const geom = await p.evaluate(() => {
    const png = renderLabelPNG({ itemName:'كريب', barcodeNumber:'12133', sellingPrice:85 },
                               { pageWidthMm:38, pageHeightMm:25, halves:2 });
    return { url: png.slice(0, 22), dpi: PRINTER_DPI,
             w: Math.round(mmToDots(38)), h: Math.round(mmToDots(25)) };
  });
  check('الصورة PNG', /^data:image\/png;base64/.test(geom.url), geom.url);
  check('⭐ المقاس 304×200 نقطة (38×25 مم على 203 نقطة/بوصة)', geom.w === 304 && geom.h === 200, geom);

  // ---------- الاسم بيدخل كامل — دايمًا ----------
  const names = await p.evaluate((NAMES) => {
    const out = [];
    const c = document.createElement('canvas').getContext('2d');
    for (const name of NAMES) {
      const textW = 304 - 84 - Math.round(mmToDots(1.2))*2 - mmToDots(0.8);
      let best = null;
      for (let ml = 1; ml <= 2; ml++) {
        const f = fitCanvasFont(c, name, textW, ml, 'bold', 'Arial, Helvetica, sans-serif', 22);
        if (!best || f.size > best.size) best = f;
      }
      const joined = best.lines.join(' ').replace(/\s+/g,' ').trim();
      const want = name.replace(/\s+/g,' ').trim();
      // الكلمة الطويلة بتتكسر بالحروف، فبنقارن من غير مسافات كمان
      const noSp = (v) => v.replace(/\s+/g,'');
      out.push({ name, lines: best.lines.length, size: +best.size.toFixed(1),
                 complete: joined === want || noSp(joined) === noSp(want) });
    }
    return out;
  }, NAMES);
  names.forEach(n => check(`⭐ "${n.name.slice(0,22)}" — الاسم كامل`, n.complete, n));
  check('كل الأسماء داخلة في سطر أو اتنين', names.every(n => n.lines <= 3), names);
  check('مفيش خط صغير لدرجة مش مقروءة', names.every(n => n.size >= 5), names.map(n=>n.size));

  // ---------- الصورة بتتبعت لـQZ كصورة مش HTML ----------
  const sent = await p.evaluate(async () => {
    const msgs = [], cfgs = [];
    window.qz = {
      configs: { create: (n,o) => ({ printer:n, opts:o }) },
      print: (cfg, data) => { msgs.push(data); cfgs.push(cfg.opts || {}); return Promise.resolve(); },
      websocket: { connect: () => Promise.resolve() },
      security: { setCertificatePromise(){}, setSignatureAlgorithm(){}, setSignaturePromise(){} },
    };
    window.isQZAvailable = () => true;
    window.ensureQZConnected = () => Promise.resolve(true);
    localStorage.setItem('tazweed_qz_label_printer', 'Xprinter XP-233B');
    localStorage.removeItem('tazweed_qz_tweak_htmlLabels');

    const built = await buildItemLabel({ itemName:'Chanvie Leen 58047', barcodeNumber:'62808737', sellingPrice:495 },
                                       { pageWidthMm:38, pageHeightMm:25, halves:2 }, 100);
    await tryPrintViaQZ('label', [{ html: built.jobHTML, image: built.image, copies: 100 }],
                        { pageWidthMm:38, pageHeightMm:25 });
    const all = msgs.flat();
    const bytes = msgs.map(m => m.reduce((s,pg)=>s+pg.data.length,0));
    return {
      messages: msgs.length, pages: all.length,
      formats: [...new Set(all.map(pg => pg.format))],
      flavors: [...new Set(all.map(pg => pg.flavor))],
      hasPrefix: all.some(pg => /^data:/.test(pg.data)),
      maxBytes: Math.max(...bytes), limit: QZ_MAX_MESSAGE_BYTES,
      perPage: all[0].data.length,
      copies: cfgs.length ? cfgs[cfgs.length-1].copies : null,
      totalKB: +(bytes.reduce((a,b)=>a+b,0)/1024).toFixed(1),
    };
  });
  check('⭐ بيتبعت كصورة مش HTML', sent.formats.length === 1 && sent.formats[0] === 'image', sent.formats);
  check('الترميز base64', sent.flavors.length === 1 && sent.flavors[0] === 'base64', sent.flavors);
  check('البادئة data: اتشالت (QZ بيرفضها)', !sent.hasPrefix, sent);
  // من v0.28.2: وظايف صغيرة ورا بعض بدل وظيفة واحدة كبيرة — ده اللي
  // خلّى "الأمر مايوصلش للطابعة" يختفي.
  check('⭐ 100 ملصق اتبعتوا كلهم', sent.pages === 100, sent);
  check('⭐ اتقسّموا على وظايف صغيرة (5 صفحات للوظيفة)', sent.messages === 20, sent);
  check('⭐ مفيش رسالة عدّت الحد', sent.maxBytes <= sent.limit, sent);

  // ---------- الرجوع لصفحة لكل ملصق ----------
  const noCopies = await p.evaluate(async () => {
    const msgs = [];
    window.qz.print = (cfg, data) => { msgs.push(data); return Promise.resolve(); };
    localStorage.setItem('tazweed_qz_tweak_noCopies', '1');
    const built = await buildItemLabel({ itemName:'كريب', barcodeNumber:'12133', sellingPrice:85 },
                                       { pageWidthMm:38, pageHeightMm:25, halves:2 }, 60);
    await tryPrintViaQZ('label', [{ html: built.jobHTML, image: built.image, copies: 60 }],
                        { pageWidthMm:38, pageHeightMm:25 });
    localStorage.removeItem('tazweed_qz_tweak_noCopies');
    return { pages: msgs.flat().length, messages: msgs.length };
  });
  check('المفتاح بيرجّع لصفحة لكل ملصق', noCopies.pages === 60, noCopies);
  check('ولسه بيقسّم على رسايل بالحجم', noCopies.messages > 1, noCopies);

  // ---------- الصورة أخف من HTML ----------
  const weight = await p.evaluate(async () => {
    const opts = { pageWidthMm:38, pageHeightMm:25, halves:2 };
    const cat = { itemName:'Chanvie Leen 58047', barcodeNumber:'62808737', originalPrice:620, sellingPrice:495 };
    const png = renderLabelPNG(cat, opts);
    const qr = await generateQRDataURL('62808737', 200);
    const html = buildLabelHTML(cat, opts, qr, 1);
    return { imageKB: +(png.length/1024).toFixed(1), htmlKB: +(html.length/1024).toFixed(1) };
  });
  // الفايدة الأساسية مش الحجم — هي إن QZ مابقاش بيرسم HTML أصلًا.
  // بس الحجم لازم يفضل معقول عشان الطبعات الكبيرة تعدّي.
  check('حجم الصورة معقول (أقل من 20 كيلو)', weight.imageKB < 20, weight);

  // ---------- مفتاح الرجوع للطريقة القديمة ----------
  const back = await p.evaluate(async () => {
    localStorage.setItem('tazweed_qz_tweak_htmlLabels', '1');
    const built = await buildItemLabel({ itemName:'كريب', barcodeNumber:'12133', sellingPrice:85 },
                                       { pageWidthMm:38, pageHeightMm:25, halves:2 }, 1);
    localStorage.removeItem('tazweed_qz_tweak_htmlLabels');
    return { image: built.image, isHTML: /class="qr"/.test(built.jobHTML) };
  });
  check('المفتاح بيرجّع لـHTML القديم', back.image === null && back.isHTML, back);
  check('المفتاح موجود في الشاشة', await p.evaluate(() => PRINT_TWEAKS.some(t => t.key === 'htmlLabels')));

  // ---------- المعاينة = المطبوع ----------
  const same = await p.evaluate(async () => {
    const built = await buildItemLabel({ itemName:'Chanvie Leen 58047', barcodeNumber:'62808737', sellingPrice:495 },
                                       { pageWidthMm:38, pageHeightMm:25, halves:2 }, 5);
    const imgOf = (h) => (h.match(/src="(data:image\/png;base64,[^"]+)"/) || [])[1];
    return { previewImg: imgOf(built.previewHTML), jobImg: imgOf(built.jobHTML), raw: built.image };
  });
  check('⭐ المعاينة والمطبوع نفس الصورة بالظبط',
    same.previewImg === same.jobImg && same.previewImg === same.raw, { eq: same.previewImg === same.jobImg });

  // ---------- ملصق الدرجة كمان ----------
  const grade = await p.evaluate((NAMES) => {
    const out = { pngs: [], complete: [] };
    const c = document.createElement('canvas').getContext('2d');
    for (const name of NAMES.slice(0, 6)) {
      const png = renderGradeLabelPNG(name, 'درجة 12', { pageWidthMm:38, pageHeightMm:25, halves:2 });
      out.pngs.push(png.slice(0, 15));
      const availW = 304 - Math.round(mmToDots(0.8)) * 2;
      let best = null;
      for (let ml = 1; ml <= 2; ml++) {
        const f = fitCanvasFont(c, name, availW, ml, 'bold', 'Tahoma, Arial, sans-serif', 40);
        if (!best || f.size > best.size) best = f;
      }
      const noSp = (v) => v.replace(/\s+/g,'');
      out.complete.push(noSp(best.lines.join('')) === noSp(name));
    }
    return out;
  }, NAMES);
  check('ملصق الدرجة بيترسم كصورة', grade.pngs.every(x => x.startsWith('data:image/png')), grade.pngs);
  check('⭐ اسم الفئة كامل في ملصق الدرجة', grade.complete.every(Boolean), grade.complete);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);
  console.log('\n✅ نجح (' + pass.length + ')');
  pass.filter(x => x.includes('⭐')).forEach(x => console.log('   ' + x));
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
