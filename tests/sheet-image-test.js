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
// ------------------------------------------------------------
// ⚠️⚠️ الدرس اللي جه من تجربة حقيقية على ورق (v0.72.1)
// ------------------------------------------------------------
// أول نسخة كانت بتقرا المفتاح على الجهاز **الباعت**. النتيجة:
//     الطباعة من الكمبيوتر اللي عليه الطابعة → اشتغلت ✅
//     الطباعة من التليفون لنفس الكمبيوتر      → رجعت مصغّرة ❌
// السبب إن الإعداد استثناء **للكمبيوتر**، والتليفون بيقرا استثناءه هو.
// القرار اتنقل للجهاز اللي بيطبع (tryPrintViaQZ) — النقطة الوحيدة اللي
// المسارين بيعدّوا منها. وفيه فحص تحت للحالة دي بالظبط.
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

    state.profile = { name: 'أحمد', role: 'owner' };
    state.user = { uid: 'u1' };
    const cat = { id: 'c1', name: 'كريب سادة لوكس', minQty: 3, groups: [] };
    const grades = Array.from({ length: 245 }, (_, i) => ({
      id: 'g' + i, number: String(i + 1), name: i % 12 === 0 ? 'أبيض' : '',
      group: 'المجموعة ' + (1 + Math.floor(i / 40)),
      branchQty: i % 7 === 0 ? 0 : (i % 23), mainQty: i % 5 === 0 ? 0 : (i % 17),
      status: i % 7 === 0 ? 'out' : 'normal', isBase: i % 12 === 0,
    }));
    const html = buildRestockHTML(cat, grades, null, true);

    // ---------- طابعة وهمية: بنمسك اللي بيوصلها فعلًا ----------
    const sent = [];
    window.qz = {
      configs: { create: (n, o) => ({ printer: n, opts: o }) },
      print: (cfg, pages) => { sent.push({ opts: cfg.opts, pages }); return Promise.resolve(); },
      printers: { details: () => Promise.resolve([{ name: 'XP-80C' }]) },
    };
    window.isQZAvailable = () => true;
    window.ensureQZConnected = () => Promise.resolve(true);
    window.getSavedPrinter = () => 'XP-80C';
    const notices = [];
    window.showPrintNotice = (m) => notices.push(m);

    const setTweak = (on) => { try { localStorage.setItem('tazweed_qz_tweak_sheetImage', on ? '1' : '0'); } catch (e) {} };
    // الطلب زي ما بيوصل بالظبط: نص HTML، من غير أي مقاس
    const printAsDevice = async (tweakOn) => {
      setTweak(tweakOn);
      sent.length = 0; notices.length = 0;
      await tryPrintViaQZ('restock', [{ html, copies: 1 }], null);
      return sent[0] || {};
    };

    // ============================================================
    // ⭐ (١) المفتاح مقفول افتراضيًا
    // ============================================================
    out.defaultOff = (PRINT_TWEAKS.find((t) => t.key === 'sheetImage') || {}).defaultOn !== true;
    try { localStorage.removeItem('tazweed_qz_tweak_sheetImage'); } catch (e) {}
    out.offByDefault = getPrintTweak('sheetImage') === false;

    // ============================================================
    // ⭐⭐⭐ (٢) مقفول → اللي بيوصل الطابعة **نص زي الأول** ومفيش مقاس
    // ============================================================
    const off = await printAsDevice(false);
    const offPage = (off.pages || [])[0] || {};
    out.offIsHtml = offPage.format === 'html';
    out.offNoImage = offPage.format !== 'image';
    out.offNoSize = !(off.opts && off.opts.size);
    out.offNoNotice = notices.length === 0;
    // ⭐ ومحتوى الصفحة مطابق حرف بحرف للي buildRestockHTML بتطلّعه
    out.offIdentical = offPage.data === html;

    // ============================================================
    // ⭐⭐⭐ (٣) مفتوح → صورة + مقاس مخصّص
    // ============================================================
    const on = await printAsDevice(true);
    const onPage = (on.pages || [])[0] || {};
    out.onIsImage = onPage.format === 'image' && onPage.flavor === 'base64';
    out.onCustom = !!(on.opts && on.opts.size && on.opts.size.custom === true);
    out.onWidth = on.opts && on.opts.size && on.opts.size.width;
    out.onHeight = on.opts && on.opts.size && on.opts.size.height;
    out.onUnits = on.opts && on.opts.units;

    if (out.onIsImage) {
      const b64 = onPage.data;
      out.imgKB = +(b64.length / 1024).toFixed(1);
      const bin = atob(b64.slice(0, 120));
      const by = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
      out.isPng = by[0] === 137 && by[1] === 80 && by[2] === 78 && by[3] === 71;
      const dv = new DataView(by.buffer);
      out.imgW = dv.getUint32(16);
      out.imgH = dv.getUint32(20);
      out.bitDepth = by[24];
      out.colorType = by[25];

      const im = new Image();
      await new Promise((res) => { im.onload = res; im.onerror = res; im.src = 'data:image/png;base64,' + b64; });
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
    // ⚠️⚠️⚠️ (٤) الحالة اللي فشلت على الورق: الطلب جاي من جهاز تاني
    // ============================================================
    // الجهاز الباعت (التليفون) المفتاح عنده **مقفول**، فبيبعت نص عادي.
    // الجهاز اللي بيطبع المفتاح عنده **مفتوح** → المفروض يحوّلها هو.
    setTweak(true);
    sent.length = 0;
    const remoteJob = { type: 'restock', jobs: [{ html, copies: 1 }], sizeOptions: null };
    await tryPrintViaQZ(remoteJob.type, remoteJob.jobs, remoteJob.sizeOptions);
    const rp = ((sent[0] || {}).pages || [])[0] || {};
    out.remoteBecameImage = rp.format === 'image';
    out.remoteCustom = !!((sent[0] || {}).opts && sent[0].opts.size && sent[0].opts.size.custom === true);

    // وبالعكس: الجهاز اللي بيطبع مقفول عنده → يفضل نص مهما كان الباعت
    setTweak(false);
    sent.length = 0;
    await tryPrintViaQZ('restock', [{ html, copies: 1 }], null);
    const rp2 = ((sent[0] || {}).pages || [])[0] || {};
    out.remoteOffStaysHtml = rp2.format === 'html';

    // ============================================================
    // ⚠️ (٥) الرجوع للقديم لما الرسم يفشل أو الحجم يكبر
    // ============================================================
    const realRender = window.renderSheetImage;
    setTweak(true);

    window.renderSheetImage = () => Promise.resolve(null);
    sent.length = 0; notices.length = 0;
    await tryPrintViaQZ('restock', [{ html, copies: 1 }], null);
    out.failStaysHtml = (((sent[0] || {}).pages || [])[0] || {}).format === 'html';
    out.failNoSize = !((sent[0] || {}).opts && sent[0].opts.size);
    out.failToldUser = notices.length === 1;

    window.renderSheetImage = () => Promise.resolve({ image: 'data:image/png;base64,AA', bytes: 99 * 1024, widthMm: 72.1, heightMm: 500 });
    sent.length = 0; notices.length = 0;
    await tryPrintViaQZ('restock', [{ html, copies: 1 }], null);
    out.bigStaysHtml = (((sent[0] || {}).pages || [])[0] || {}).format === 'html';
    out.bigToldUser = notices.length === 1 && /كبيرة/.test(notices[0] || '');

    // ============================================================
    // ⚠️ (٦) الملصقات مالهاش دعوة — المفتاح مفتوح وبرضه نص
    // ============================================================
    window.renderSheetImage = realRender;
    sent.length = 0;
    await tryPrintViaQZ('label', [{ html: '<html><body>ملصق</body></html>', copies: 1 }], { pageWidthMm: 38, pageHeightMm: 25 });
    const lp = ((sent[0] || {}).pages || [])[0] || {};
    out.labelUntouched = lp.format === 'html';
    out.labelNoCustom = !((sent[0] || {}).opts && sent[0].opts.size && sent[0].opts.size.custom);

    // ============================================================
    // ⭐⭐ (٧) المسار المحلي كامل: من الزرار لحد الطابعة
    // ============================================================
    // ⚠️ ده اللي اشتغل على ورق حقيقي. القرار اتنقل مكان تاني، فلازم
    // نتأكد إنه **لسه** شغّال من نفس الجهاز، مش بس عن بُعد.
    window.showPrintPreview = () => Promise.resolve(true);
    window.chooseRestockGroup = () => Promise.resolve({ group: null, withBase: true });
    window.choosePrintTarget = () => Promise.resolve('local');
    window.logPrintJob = () => {};   // بتكتب في السحابة — مالهاش لازمة هنا

    setTweak(true);
    sent.length = 0;
    await printRestockPaper(cat, grades);
    const lo = ((sent[0] || {}).pages || [])[0] || {};
    out.localOnIsImage = lo.format === 'image';
    out.localOnCustom = !!((sent[0] || {}).opts && sent[0].opts.size && sent[0].opts.size.custom === true);

    setTweak(false);
    sent.length = 0;
    await printRestockPaper(cat, grades);
    const lf = ((sent[0] || {}).pages || [])[0] || {};
    out.localOffIsHtml = lf.format === 'html';
    out.localOffNoSize = !((sent[0] || {}).opts && sent[0].opts.size);

    setTweak(false);
    return out;
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

  check('⭐ المفتاح مقفول افتراضيًا في التعريف', r.defaultOff);
  check('⭐ وبيرجع "مقفول" من غير أي اختيار محفوظ', r.offByDefault);

  check('⭐⭐⭐ مقفول: اللي بيوصل الطابعة **نص** زي الأول', r.offIsHtml);
  check('⭐⭐⭐ مقفول: ومطابق حرف بحرف للي buildRestockHTML بتطلّعه', r.offIdentical);
  check('⭐⭐ مقفول: ومفيش أي مقاس بيتبعت', r.offNoSize);
  check('⭐ مقفول: ومفيش أي رسالة للمستخدم', r.offNoNotice);

  check('⭐⭐ مفتوح: اللي بيوصل الطابعة **صورة**', r.onIsImage);
  check('⭐⭐⭐ ومعاها custom:true', r.onCustom);
  check('⭐ بالعرض المطبوع فعلًا (72.1 مش 80)', r.onWidth === 72.1, r.onWidth);
  check('⭐ وبالطول الحقيقي المقيس', r.onHeight > 300 && r.onHeight < 500, r.onHeight);
  check('⭐ وبوحدة مم', r.onUnits === 'mm', r.onUnits);
  check('⭐⭐⭐ والصورة بعمق **1 بت** (مش 32)', r.bitDepth === 1, r.bitDepth);
  check('⭐ ونوعها رمادي وترويستها سليمة', r.isPng && r.colorType === 0, [r.isPng, r.colorType]);
  check('⭐⭐ وعرضها 576 نقطة (72.1مم × 203)', r.imgW === 576, r.imgW);
  check('⭐ وطولها معقول', r.imgH > 2000 && r.imgH < 4000, r.imgH);
  check('⭐⭐⭐ وحجمها تحت حد الرسالة (48 كيلو)', r.imgKB > 0 && r.imgKB < 44, r.imgKB);
  check('⭐⭐ والصورة مش فاضية (فيها رسم فعلًا)', r.darkPixels > 5000, r.darkPixels);

  check('⚠️⚠️⚠️ طلب جاي كنص من جهاز تاني → الجهاز اللي بيطبع بيحوّله صورة', r.remoteBecameImage);
  check('⚠️⚠️ ومعاه المقاس المخصّص', r.remoteCustom);
  check('⚠️⚠️ والعكس: الجهاز اللي بيطبع مقفول عنده → يفضل نص', r.remoteOffStaysHtml);

  check('⚠️⚠️ الرسم فشل → فضل نص وطبع عادي', r.failStaysHtml);
  check('⚠️ ومن غير مقاس مخصّص', r.failNoSize);
  check('⚠️ وقال للمستخدم (مش في سكوت)', r.failToldUser);
  check('⚠️⚠️ الصورة كبيرة → فضل نص', r.bigStaysHtml);
  check('⚠️ وقال السبب', r.bigToldUser);

  check('⚠️⚠️ الملصقات مااتلمستش (المفتاح مفتوح وبرضه نص)', r.labelUntouched);
  check('⚠️ ومفيش custom عليها', r.labelNoCustom);

  check('⭐⭐ المسار المحلي (نفس الجهاز): مفتوح → صورة', r.localOnIsImage);
  check('⭐⭐ ومعاها المقاس المخصّص', r.localOnCustom);
  check('⭐⭐ والمسار المحلي: مقفول → نص زي الأول', r.localOffIsHtml);
  check('⭐ ومن غير أي مقاس', r.localOffNoSize);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
