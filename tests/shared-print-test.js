// v0.28.2 — الإعدادات مشتركة، والوظايف صغيرة، والصورة مش بتتكبّر
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof tryPrintViaQZ === 'function');

  const setup = () => p.evaluate(() => {
    localStorage.clear();
    const msgs = [], cfgs = [];
    window.__msgs = msgs; window.__cfgs = cfgs;
    window.qz = {
      configs: { create: (n, o) => ({ printer: n, opts: o }) },
      print: (cfg, data) => { msgs.push(data); cfgs.push(cfg.opts || {}); return Promise.resolve(); },
      websocket: { connect: () => Promise.resolve() },
      security: { setCertificatePromise(){}, setSignatureAlgorithm(){}, setSignaturePromise(){} },
    };
    window.isQZAvailable = () => true;
    window.ensureQZConnected = () => Promise.resolve(true);
    localStorage.setItem('tazweed_qz_label_printer', 'Xprinter XP-233B');
    state.user = { uid: 'me' };
    window.db = { collection: () => ({ doc: () => ({ set: () => Promise.resolve(), onSnapshot: () => () => {} }) }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
  });
  await setup();

  // ---------- الإعدادات المضمونة بتتبعت لوحدها ----------
  const cfg = await p.evaluate(async () => {
    window.__msgs.length = 0; window.__cfgs.length = 0;
    const built = await buildItemLabel({ itemName:'Chanvie Leen 58047', barcodeNumber:'62808737', sellingPrice:495 },
                                       { pageWidthMm:38, pageHeightMm:25, halves:2 }, 3);
    await tryPrintViaQZ('label', [{ html: built.jobHTML, image: built.image, copies: 3 }],
                        { pageWidthMm:38, pageHeightMm:25 });
    return window.__cfgs[0];
  });
  check('⭐ الصورة مابتتكبّرش (ده كان سبب النغمشة)', cfg.scaleContent === false, cfg);
  check('⭐ الدقة = دقة الطابعة 203', cfg.density === 203, cfg);
  check('مفيش تنعيم للحواف', cfg.interpolation === 'nearest-neighbor', cfg);
  check('أبيض وأسود صريح', cfg.colorType === 'blackwhite', cfg);
  check('المقاس 38×25 مم', cfg.size && cfg.size.width === 38 && cfg.size.height === 25, cfg);
  check('مفيش هوامش زيادة', cfg.margins === 0, cfg);

  // ---------- وظايف صغيرة لـ100 ملصق ----------
  const big = await p.evaluate(async () => {
    window.__msgs.length = 0; window.__cfgs.length = 0;
    const built = await buildItemLabel({ itemName:'كريب', barcodeNumber:'12133', sellingPrice:85 },
                                       { pageWidthMm:38, pageHeightMm:25, halves:2 }, 100);
    await tryPrintViaQZ('label', [{ html: built.jobHTML, image: built.image, copies: 100 }],
                        { pageWidthMm:38, pageHeightMm:25 });
    const m = window.__msgs;
    return {
      jobs: m.length,
      pages: m.reduce((s,x)=>s+x.length,0),
      maxPages: Math.max(...m.map(x=>x.length)),
      maxKB: +(Math.max(...m.map(x=>x.reduce((s,pg)=>s+pg.data.length,0)))/1024).toFixed(0),
      perJob: QZ_PAGES_PER_JOB,
    };
  });
  check('⭐ 100 ملصق اتبعتوا كلهم', big.pages === 100, big);
  check('⭐ اتقسّموا على وظايف صغيرة', big.jobs === 20, big);
  check('⭐ مفيش وظيفة فيها أكتر من 5 صفحات', big.maxPages <= 5, big);
  check('أكبر وظيفة أقل من 60 كيلو', big.maxKB < 60, big);

  // ---------- الإعدادات مشتركة مش على الجهاز ----------
  const shared = await p.evaluate(async () => {
    const written = [];
    window.db = { collection: () => ({ doc: () => ({
      set: (d) => { written.push(d); return Promise.resolve(); },
      onSnapshot: () => () => {},
    }) }) };
    localStorage.removeItem('tazweed_shared_print');
    window.sharedPrintSettings = null;

    savePrintAlign({ x: 0.8, y: -0.4, shrink: 2 });
    setPrintTweak('sharp', true);
    const wroteAlign = written.some(w => w.align && w.align.x === 0.8);
    const wroteTweak = written.some(w => w.tweaks && w.tweaks.sharp === true);

    return { wroteAlign, wroteTweak, written: written.length };
  });
  check('⭐ الضبط بيتحفظ في السحابة', shared.wroteAlign, shared);
  check('⭐ المفاتيح بتتحفظ في السحابة', shared.wroteTweak, shared);

  // ---------- جهاز تاني فعلًا: صفحة جديدة، مفيش أي ذاكرة ----------
  const p2 = await b.newPage();
  await p2.goto('http://localhost:8899/tests/harness.html');
  await p2.waitForFunction(() => typeof getPrintAlign === 'function');
  const other = await p2.evaluate(() => {
    // الجهاز ده عمره ما اتظبط. الحاجة الوحيدة عنده هي نسخة السحابة
    // (اللي بتتحفظ تلقائيًا أول ما النظام يفتح).
    localStorage.clear();
    localStorage.setItem('tazweed_shared_print', JSON.stringify({
      align: { x: 1.4, y: 0.6, shrink: 3 }, tweaks: { blackwhite: true },
    }));
    return { align: getPrintAlign(), tweak: getPrintTweak('blackwhite'), css: printAlignCSS() };
  });
  check('⭐ جهاز جديد بياخد الضبط لوحده — من غير ما تلمسه',
    other.align.x === 1.4 && other.align.y === 0.6 && other.align.shrink === 3, other.align);
  check('⭐ وبياخد المفاتيح لوحده', other.tweak === true, other);
  check('والضبط بيوصل للملصق فعلًا', /translate\(1\.4mm, 0\.6mm\)/.test(other.css), other.css);

  // ---------- ولو النت مقطوع ----------
  const offline = await p2.evaluate(() => {
    // مفيش اتصال بالسحابة خالص — بس النسخة المحفوظة موجودة
    const a = getPrintAlign();
    localStorage.clear();
    return a;
  });
  check('آخر نسخة محفوظة بتشتغل من غير نت', offline.x === 1.4, offline);
  await p2.close();

  check('مفيش أخطاء صفحة', errors.length === 0, errors);
  console.log('\n✅ نجح (' + pass.length + ')');
  pass.filter(x => x.includes('⭐')).forEach(x => console.log('   ' + x));
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
