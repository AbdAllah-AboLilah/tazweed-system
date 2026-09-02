// 🧪 ورقة التزويد كصورة بطولها الكامل — مفتاح `sheetImage`
// ============================================================
// ⚠️⚠️ **أهم فحص في الملف ده هو الأول**: المفتاح **مقفول** = الورقة
// مطابقة حرف بحرف للي النظام بيطلّعه، والكود الجديد **مابيتندهش خالص**.
// ده الوعد اللي اتقال لصاحب النظام بالنص: "علّم على المربّع وجرّب، ومفيش
// حاجة من القديم تتغيّر".
//
// ------------------------------------------------------------
// ليه الخاصية دي أصلًا
// ------------------------------------------------------------
// الورقة الأطول من فورم التعريف (297مم) **بتتصغّر**. وبعت المقاس لـQZ
// مجرّب وفشل: نفس الورقة اتبعتت بطولين مختلفين واتقصّت في نفس الصف.
// QZ 2.2.6 ضاف `size.custom` اللي بيعدّي الحد ده — بس **للصور بس**
// (اتعمل في PrintImage.java لوحده)، فالورقة لازم تترسم صورة.
//
// ------------------------------------------------------------
// ⚠️ الرقم اللي بيحدد إن دي تشتغل ولا لأ: عمق البت
// ------------------------------------------------------------
//   canvas.toDataURL العادي (32 بت) → 154 كيلو ← فوق حد الرسالة (48)
//   PNG بعمق 1 بت                    →  22 كيلو ← أصغر من الـHTML
// حد الرسالة **بيتضاع في صمت** لما يتعدّى، فالفرق مش تحسين — هو الفرق
// بين إنها تشتغل وإنها تسكت. عشان كده فيه فحص بيقرا عمق البت من الصورة.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof printRestockPaper === 'function' && typeof renderSheetImage === 'function');

  const r = await p.evaluate(async () => {
    const out = {};

    // ---------- بيئة ----------
    state.profile = { name: 'أحمد', role: 'owner' };
    state.user = { uid: 'u1' };
    const cat = { id: 'c1', name: 'كريب سادة لوكس', minQty: 3, groups: [] };
    const grades = Array.from({ length: 245 }, (_, i) => ({
      id: 'g' + i, number: String(i + 1), name: i % 12 === 0 ? 'أبيض' : '',
      group: 'المجموعة ' + (1 + Math.floor(i / 40)),
      branchQty: i % 7 === 0 ? 0 : (i % 23), mainQty: i % 5 === 0 ? 0 : (i % 17),
      status: i % 7 === 0 ? 'out' : 'normal', isBase: i % 12 === 0,
    }));

    // ---------- بنمسك اللي بيتبعت للطباعة بدل ما نطبع ----------
    const calls = [];
    window.deliverPrint = (type, jobs, sizeOptions, win, browserHTML) => {
      calls.push({ type, jobs, sizeOptions, browserHTML });
      return Promise.resolve(true);
    };
    window.showPrintPreview = () => Promise.resolve(true);   // الموافقة على المعاينة
    // اختيار المجموعة: "كل المجموعات مع بعض" = الورقة الطويلة اللي بنقيسها
    window.chooseRestockGroup = () => Promise.resolve({ group: null, withBase: true });
    const notices = [];
    window.showPrintNotice = (m) => notices.push(m);

    // بنعدّ نداءات الرسم عشان نتأكد إنه مابيتندهش والمفتاح مقفول
    let renderCalls = 0;
    const realRender = window.renderSheetImage;
    window.renderSheetImage = function () { renderCalls++; return realRender.apply(this, arguments); };

    const setTweak = (on) => { try { localStorage.setItem('tazweed_qz_tweak_sheetImage', on ? '1' : '0'); } catch (e) {} };
    const run = async () => { calls.length = 0; notices.length = 0; renderCalls = 0; await printRestockPaper(cat, grades); };

    // ============================================================
    // ⭐⭐⭐ (١) المفتاح مقفول → مفيش أي فرق عن القديم
    // ============================================================
    out.defaultOff = !!(PRINT_TWEAKS.find((t) => t.key === 'sheetImage') || {}).defaultOn === false;
    try { localStorage.removeItem('tazweed_qz_tweak_sheetImage'); } catch (e) {}
    out.offByDefault = getPrintTweak('sheetImage') === false;

    setTweak(false);
    await run();
    const off = calls[0] || {};
    out.offCalls = calls.length;
    out.offRenderCalls = renderCalls;
    out.offSizeIsNull = off.sizeOptions === null;
    out.offIsString = typeof off.jobs === 'string';
    // ⭐ المقارنة الحقيقية: الناتج مطابق **حرف بحرف** للي buildRestockHTML بتطلّعه
    const expected = buildRestockHTML(cat, grades, null, true);
    const strip = (s) => String(s || '').replace(/\d{1,2}:\d{2}:\d{2}[^<]*/g, '');  // الوقت بيتغيّر
    out.offIdentical = strip(off.jobs) === strip(expected);
    out.offLen = String(off.jobs || '').length;
    out.offNotices = notices.length;

    // ============================================================
    // (٢) المفتاح مفتوح → صورة
    // ============================================================
    setTweak(true);
    await run();
    const on = calls[0] || {};
    out.onCalls = calls.length;
    out.onRenderCalls = renderCalls;
    out.onIsArray = Array.isArray(on.jobs);
    const job = out.onIsArray ? on.jobs[0] : null;
    out.onHasImage = !!(job && typeof job.image === 'string' && job.image.startsWith('data:image/png;base64,'));
    // ⚠️ الـHTML لازم يفضل جنب الصورة وإلا normalizePrintJobs بترمي الوظيفة
    out.onJobHasHtml = !!(job && typeof job.html === 'string' && job.html.length > 1000);
    out.onSurvivesNormalize = normalizePrintJobs(on.jobs).length === 1;
    out.onCustom = !!(on.sizeOptions && on.sizeOptions.customSize === true);
    out.onWidthMm = on.sizeOptions && on.sizeOptions.pageWidthMm;
    out.onHeightMm = on.sizeOptions && on.sizeOptions.pageHeightMm;
    // ⚠️ نسخة الـHTML لازم تفضل موجودة — دي اللي نافذة المتصفح بتستخدمها
    out.onKeptBrowserHTML = typeof on.browserHTML === 'string' && on.browserHTML.length > 1000;

    // ---------- الصورة نفسها: عمق البت والحجم والمحتوى ----------
    if (out.onHasImage) {
      const b64 = job.image.split(',')[1];
      out.imgKB = +((b64.length) / 1024).toFixed(1);
      const bin = atob(b64.slice(0, 120));
      const by = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
      // ترويسة PNG: التوقيع، وIHDR فيه العرض/الطول/عمق البت/نوع اللون
      out.isPng = by[0] === 137 && by[1] === 80 && by[2] === 78 && by[3] === 71;
      const dv = new DataView(by.buffer);
      out.imgW = dv.getUint32(16);
      out.imgH = dv.getUint32(20);
      out.bitDepth = by[24];
      out.colorType = by[25];

      // ⚠️ الصورة مش فاضية — بنحمّلها ونعدّ النقط السودا فعلًا
      const im = new Image();
      await new Promise((res) => { im.onload = res; im.onerror = res; im.src = job.image; });
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = Math.min(im.height, 500);
      const cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
      out.darkPixels = dark;
    }

    // ============================================================
    // ⚠️ (٣) الرسم فشل → بيرجع للقديم ويقول
    // ============================================================
    window.renderSheetImage = () => Promise.resolve(null);
    calls.length = 0; notices.length = 0;
    await printRestockPaper(cat, grades);
    out.failFellBack = calls.length === 1 && typeof calls[0].jobs === 'string' && calls[0].sizeOptions === null;
    out.failToldUser = notices.length === 1;

    // ============================================================
    // ⚠️ (٤) الصورة أكبر من الحد → بيرجع للقديم ويقول
    // ============================================================
    window.renderSheetImage = () => Promise.resolve({ image: 'data:image/png;base64,AA', bytes: 99 * 1024, widthMm: 72.1, heightMm: 500 });
    calls.length = 0; notices.length = 0;
    await printRestockPaper(cat, grades);
    out.bigFellBack = calls.length === 1 && typeof calls[0].jobs === 'string' && calls[0].sizeOptions === null;
    out.bigToldUser = notices.length === 1 && /كبيرة/.test(notices[0] || '');

    window.renderSheetImage = realRender;
    setTweak(false);
    return out;
  });

  // ---------- (٥) المقاس المخصّص بيوصل لـQZ فعلًا ----------
  const qzCfg = await p.evaluate(async () => {
    const seen = [];
    window.qz = {
      configs: { create: (n, o) => ({ printer: n, opts: o }) },
      print: (cfg) => { seen.push(cfg.opts); return Promise.resolve(); },
      printers: { details: () => Promise.resolve([{ name: 'XP-80C' }]) },
    };
    window.isQZAvailable = () => true;
    window.ensureQZConnected = () => Promise.resolve(true);
    window.getSavedPrinter = () => 'XP-80C';
    window.qzPrinterExists = () => Promise.resolve(true);
    const jobs = [{ html: '<html><body>x</body></html>', image: 'data:image/png;base64,iVBORw0KGgo=', copies: 1 }];
    await tryPrintViaQZ('restock', jobs, { pageWidthMm: 72.1, pageHeightMm: 332, customSize: true });
    const withCustom = seen.slice();
    seen.length = 0;
    await tryPrintViaQZ('restock', jobs, { pageWidthMm: 72.1, pageHeightMm: 332 });
    return { withCustom, without: seen.slice() };
  });

  // ---------- (٦) الطباعة عن بُعد: المقاس والصورة بيوصلوا للجهاز التاني ----------
  // ⚠️ ده مسار صاحب النظام الأساسي: التليفون بيبعت والكمبيوتر بيطبع.
  // لو المقاس ضاع في الطريق، الجهاز المستقبِل هيطبع من غيره **في صمت**.
  const remote = await p.evaluate(async () => {
    const written = [];
    window.db = {
      collection: () => ({ doc: () => ({ set: (d) => { written.push(d); return Promise.resolve(); },
        onSnapshot: () => () => {} }) }),
    };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    window.alert = () => {};
    window.isServerReachable = () => true;
    state.user = { uid: 'u1' };
    state.profile = { name: 'أحمد' };
    const img = 'data:image/png;base64,iVBORw0KGgo=';
    await sendPrintJob('restock', 'dev1', [{ html: '<html><body>ورقة</body></html>', image: img, copies: 1 }],
      { pageWidthMm: 72.1, pageHeightMm: 332, customSize: true });
    const d = written[0] || {};
    return {
      sent: written.length,
      custom: !!(d.sizeOptions && d.sizeOptions.customSize === true),
      h: d.sizeOptions && d.sizeOptions.pageHeightMm,
      hasImage: !!(d.jobs && d.jobs[0] && d.jobs[0].image === img),
      kb: +(new TextEncoder().encode(JSON.stringify(d)).length / 1024).toFixed(1),
    };
  });
  check('⭐⭐ الطباعة عن بُعد: الطلب اتبعت', remote.sent === 1, remote);
  check('⭐⭐⭐ والمقاس المخصّص وصل للجهاز التاني', remote.custom, remote);
  check('⭐ بالطول الصح', remote.h === 332, remote.h);
  check('⭐⭐ والصورة وصلت معاه', remote.hasImage);

  const c1 = (qzCfg.withCustom[0] || {}).size || {};
  const c2 = (qzCfg.without[0] || {}).size || {};

  check('⭐ المفتاح مقفول افتراضيًا في التعريف', r.defaultOff);
  check('⭐ وبيرجع "مقفول" من غير أي اختيار محفوظ', r.offByDefault);
  check('⭐⭐⭐ مقفول: الكود الجديد **مااتندهش خالص**', r.offRenderCalls === 0, r.offRenderCalls);
  check('⭐⭐⭐ مقفول: الورقة مطابقة حرف بحرف للقديم', r.offIdentical, { len: r.offLen });
  check('⭐⭐ مقفول: بتتبعت نص زي الأول (مش مصفوفة)', r.offIsString);
  check('⭐⭐ مقفول: مفيش مقاس بيتبعت لـQZ', r.offSizeIsNull);
  check('⭐ مقفول: ومفيش أي رسالة للمستخدم', r.offNotices === 0, r.offNotices);

  check('⭐⭐ مفتوح: بتتبعت صورة', r.onHasImage);
  check('⭐⭐⭐ والصورة بعمق **1 بت** (مش 32)', r.bitDepth === 1, r.bitDepth);
  check('⭐ ونوعها رمادي', r.colorType === 0, r.colorType);
  check('⭐ وترويستها PNG سليمة', r.isPng);
  check('⭐⭐ وعرضها 576 نقطة (72.1مم × 203)', r.imgW === 576, r.imgW);
  check('⭐ وطولها معقول للورقة الطويلة', r.imgH > 2000 && r.imgH < 4000, r.imgH);
  check('⭐⭐⭐ وحجمها **تحت حد الرسالة** (48 كيلو)', r.imgKB > 0 && r.imgKB < 44, r.imgKB);
  check('⭐⭐ والصورة **مش فاضية** (فيها رسم فعلًا)', r.darkPixels > 5000, r.darkPixels);
  check('⭐⭐ والمقاس المخصّص اتبعت معاها', r.onCustom);
  check('⭐ بالطول الحقيقي المقيس', r.onHeightMm > 300 && r.onHeightMm < 500, r.onHeightMm);
  check('⭐ والعرض المطبوع فعلًا (72.1 مش 80)', r.onWidthMm === 72.1, r.onWidthMm);
  check('⭐ ونسخة الـHTML فضلت لنافذة المتصفح', r.onKeptBrowserHTML);
  check('⚠️⚠️ والـHTML جنب الصورة في الوظيفة نفسها', r.onJobHasHtml);
  check('⚠️⚠️ فالوظيفة **بتعدّي** من normalizePrintJobs', r.onSurvivesNormalize);

  check('⚠️⚠️ الرسم فشل → رجع للطريقة القديمة', r.failFellBack);
  check('⚠️ وقال للمستخدم (مش في سكوت)', r.failToldUser);
  check('⚠️⚠️ الصورة كبيرة → رجع للطريقة القديمة', r.bigFellBack);
  check('⚠️ وقال السبب', r.bigToldUser);

  check('⭐⭐⭐ QZ بيوصله custom:true', c1.custom === true, c1);
  check('⭐ بالمقاس الصح', c1.width === 72.1 && c1.height === 332, c1);
  check('⭐⭐ ومن غير المفتاح **مفيش** custom', c2.custom === undefined, c2);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
