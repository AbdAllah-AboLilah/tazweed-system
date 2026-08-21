// ============================================================
// إذن الكاميرا على الآيفون — سؤال واحد بدل اتنين
// ============================================================
// الشكوى: "ليه على الآيفون كل مرة يدوسوا على الكاميرا بيطلب الإذن؟"
//
// وطلع فيه **سببين**، واحد مننا وواحد من آبل:
//
//   1) ❌ **مننا**: زرار "اختيار تلقائي" كان بينده `saveCameraId('')`،
//      والدالة كانت **بتمسح** المحفوظ لما القيمة تبقى فاضية. فالكود
//      مايقدرش يفرق بين "لسه ماختارش" و"اختار تلقائي" — والنتيجة إن
//      نافذة اختيار الكاميرا بتظهر **كل مرة**، مع إنها مكتوب فيها
//      "الاختيار ده بيتحفظ ومش هيتسألك تاني".
//
//   2) ❌ **مننا كمان**: النافذة دي كانت **بتفتح الكاميرا** عشان تقرا
//      أسماء الكاميرات وتقفلها، وبعدين التصوير بيفتحها تاني. على أندرويد
//      مابيبانش، **وعلى الآيفون سفاري بيسأل في كل فتحة** — فسؤالين.
//
//   3) ⚠️ **من آبل**: سفاري مابيحفظش إذن الكاميرا حتى للتطبيقات المثبّتة
//      على الشاشة الرئيسية. ده مالناش فيه حيلة — الفحص ده بيغطّي 1 و2 بس.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof openBarcodeScanner === 'function');

  // كاميرتين زي أي آيفون، وعدّاد لكل مرة الكاميرا بتتفتح فيها
  await p.evaluate(() => {
    window.__setupCam = (nCams) => {
      window.__opens = 0;
      localStorage.removeItem('tazweed_camera_id');
      const cams = Array.from({ length: nCams }, (_, i) => ({
        kind: 'videoinput', deviceId: 'cam' + i, label: 'كاميرا ' + (i + 1),
      }));
      navigator.mediaDevices.enumerateDevices = () => Promise.resolve(cams.slice());
      // ⚠️ لازم **MediaStream حقيقي**: `video.srcObject` بترفض أي كائن
      // مزيّف. بنولّد واحد من canvas — أقرب حاجة لكاميرا من غير كاميرا.
      navigator.mediaDevices.getUserMedia = () => {
        window.__opens++; // ⭐ كل فتحة = سؤال إذن على الآيفون
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        c.getContext('2d').fillRect(0, 0, 64, 64);
        return Promise.resolve(c.captureStream(1));
      };
      // الفيديو مابيشتغلش في الفحص — بنخليه يعدّي
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    };
    // بتقفل أي شاشة تصوير مفتوحة وتوقّف حلقتها
    window.__closeScanner = () => {
      document.querySelectorAll('#cam-cancel').forEach((b) => b.click());
      document.querySelectorAll('#scan-cancel').forEach((b) => b.click());
    };
    window.__clickCam = (sel) => {
      const btn = document.querySelector(sel);
      if (!btn) return false;
      btn.click();
      return true;
    };
  });

  // ============================================================
  // 1) ⭐⭐ "اختيار تلقائي" بيتحفظ فعلًا
  // ============================================================
  const auto = await p.evaluate(async () => {
    window.__setupCam(2);
    const before = localStorage.getItem('tazweed_camera_id');
    saveCameraId('');                       // ده اللي زرار "تلقائي" بينده
    return {
      before,
      after: localStorage.getItem('tazweed_camera_id'),
      hasChoice: hasCameraChoice(),
      activeId: activeCameraId(),
    };
  });
  check('⭐⭐ "اختيار تلقائي" بيتحفظ مش بيتمسح', auto.after === 'auto', auto);
  check('⭐⭐ والنظام بيعتبره **اختيار** (مش هيسأل تاني)', auto.hasChoice === true, auto);
  check('⭐ وبرضه بيفتح الكاميرا التلقائية (مش بيدوّر على معرّف اسمه auto)',
    auto.activeId === '', auto);
  check('⭐ و"لسه ماختارش" لسه متميّزة', auto.before === null, auto);

  // ============================================================
  // 2) ⭐⭐ فتح الكاميرا **مرة واحدة** مش مرتين
  // ============================================================
  // ده جوهر الشكوى: كل فتحة = سؤال إذن على الآيفون.
  const opens = await p.evaluate(async () => {
    window.__setupCam(2);
    // أول مرة على الجهاز — مفيش اختيار محفوظ
    openBarcodeScanner(() => {}, false, {});
    await new Promise((r) => setTimeout(r, 150));
    const firstOpens = window.__opens;
    const chooserUp = !!document.getElementById('cam-auto');
    // نقول "سيبها زي ما هي"
    window.__clickCam('#cam-cancel');
    await new Promise((r) => setTimeout(r, 100));
    const saved = localStorage.getItem('tazweed_camera_id');
    window.__closeScanner();
    return { firstOpens, chooserUp, saved };
  });
  check('⭐⭐ أول فتحة: الكاميرا اتفتحت **مرة واحدة** بس',
    opens.firstOpens === 1, { فتحات: opens.firstOpens });
  check('⭐ ونافذة الاختيار ظهرت (بعد ما الصورة اشتغلت)', opens.chooserUp === true, opens);
  check('⭐⭐ و"سيبها زي ما هي" اتحفظت — مش هتسأل تاني',
    opens.saved === 'auto', opens);

  // ============================================================
  // 3) ⭐⭐ الفتحة اللي بعدها: مفيش نافذة ومفيش سؤال زيادة
  // ============================================================
  // ده اللي المستخدم اشتكى منه بالحرف — النافذة بتظهر كل مرة.
  const second = await p.evaluate(async () => {
    window.__opens = 0; // الاختيار محفوظ من اللي فات
    openBarcodeScanner(() => {}, false, {});
    await new Promise((r) => setTimeout(r, 150));
    const out = { opens: window.__opens, chooserUp: !!document.getElementById('cam-auto') };
    window.__closeScanner();
    return out;
  });
  check('⭐⭐ الفتحة الجاية: نافذة الاختيار **مابتظهرش**', second.chooserUp === false, second);
  check('⭐⭐ والكاميرا بتتفتح مرة واحدة (سؤال إذن واحد)', second.opens === 1, second);

  // ============================================================
  // 4) ⭐ كاميرا واحدة؟ مفيش سؤال أصلًا
  // ============================================================
  const one = await p.evaluate(async () => {
    window.__setupCam(1);
    openBarcodeScanner(() => {}, false, {});
    await new Promise((r) => setTimeout(r, 150));
    const out = {
      opens: window.__opens,
      chooserUp: !!document.getElementById('cam-auto'),
      saved: localStorage.getItem('tazweed_camera_id'),
    };
    window.__closeScanner();
    return out;
  });
  check('⭐ كاميرا واحدة: مفيش نافذة اختيار', one.chooserUp === false, one);
  check('⭐ وفتحة واحدة بس', one.opens === 1, one);
  check('⭐ واتسجّل إنه مايتسألش تاني', one.saved === 'auto', one);

  // ============================================================
  // 5) ⭐ اختيار كاميرا معيّنة بيتحفظ وبيشتغل
  // ============================================================
  const picked = await p.evaluate(async () => {
    window.__setupCam(2);
    openBarcodeScanner(() => {}, false, {});
    await new Promise((r) => setTimeout(r, 150));
    const btn = document.querySelector('[data-cam="cam1"]');
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 200));
    const out = { saved: localStorage.getItem('tazweed_camera_id'), active: activeCameraId() };
    window.__closeScanner();
    return out;
  });
  check('⭐ اختيار كاميرا معيّنة بيتحفظ', picked.saved === 'cam1', picked);
  check('⭐ وبتتفتح هي فعلًا المرة الجاية', picked.active === 'cam1', picked);

  // ============================================================
  // 6) ⭐ زرار "تبديل الكاميرا" لسه شغّال
  // ============================================================
  // ⚠️ لازم يفضل موجود: هو المخرج الوحيد لو المتصفح اختار كاميرا وحشة
  // (وايد أو ماكرو) والباركود مابيتقراش.
  const switchable = await p.evaluate(async () => {
    window.__setupCam(2);
    localStorage.setItem('tazweed_camera_id', 'auto');
    openBarcodeScanner(() => {}, false, {});
    await new Promise((r) => setTimeout(r, 150));
    const has = !!document.getElementById('scan-switch');
    document.getElementById('scan-switch').click();
    await new Promise((r) => setTimeout(r, 200));
    const out = { has, chooserUp: !!document.getElementById('cam-auto') };
    document.querySelectorAll('#cam-cancel').forEach((b) => b.click());
    window.__closeScanner();
    return out;
  });
  check('⭐ زرار "غيّر الكاميرا" موجود', switchable.has === true, switchable);
  check('⭐⭐ وبيفتح النافذة حتى بعد ما الاختيار اتحفظ', switchable.chooserUp === true, switchable);

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
