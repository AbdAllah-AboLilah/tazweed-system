// ============================================================
// مسح الباركود بكاميرا الموبايل
// ============================================================
// تصوّر باركود أي صنف (QR أو باركود خطي) والنظام يفتحلك التاب بتاعه على طول.
//
// بيستخدم BarcodeDetector — دي حاجة **مبنية جوه المتصفح نفسه** (Chrome على
// أندرويد بيدعمها)، فمفيش مكتبة خارجية تتحمّل ولا حجم زيادة على النظام.
// لو المتصفح مش بيدعمها، بنقول للمستخدم يكتب الرقم بإيده بدل ما نسيبه
// قدام شاشة مكسورة.

function isBarcodeScanSupported() {
  return typeof BarcodeDetector !== 'undefined' && !!navigator.mediaDevices;
}

async function openBarcodeScanner() {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:3000;';
  overlay.innerHTML = `
    <div style="position:relative; width:100%; max-width:520px;">
      <video id="scan-video" playsinline muted style="width:100%; display:block;"></video>
      <!-- إطار التصويب: مجرد دليل بصري للمستخدم إنه يوجّه الكاميرا -->
      <div style="position:absolute; inset:18% 12%; border:3px solid rgba(255,255,255,0.85); border-radius:12px; pointer-events:none;"></div>
    </div>
    <div id="scan-msg" style="color:#fff; font-size:14px; margin-top:16px; text-align:center; padding:0 16px; line-height:1.7;">
      وجّه الكاميرا على الباركود
    </div>
    <button class="btn" id="scan-cancel" style="margin-top:16px;">إلغاء</button>`;
  document.body.appendChild(overlay);

  const video = document.getElementById('scan-video');
  const msg = document.getElementById('scan-msg');
  let stream = null;
  let stopped = false;

  const close = () => {
    stopped = true;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('scan-cancel').addEventListener('click', close);

  if (!isBarcodeScanSupported()) {
    msg.innerHTML = 'المتصفح ده مش بيدعم قراءة الباركود بالكاميرا.<br>جرّب Chrome، أو اكتب رقم الباركود بإيدك.';
    return;
  }

  try {
    // facingMode: 'environment' = الكاميرا الخلفية (مش السيلفي)
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    console.error(err);
    msg.innerHTML = 'مقدرتش أفتح الكاميرا.<br>اتأكد إنك سمحت للموقع باستخدامها من إعدادات المتصفح.';
    return;
  }

  const detector = new BarcodeDetector({
    formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf'],
  });

  const tick = async () => {
    if (stopped) return;
    try {
      const found = await detector.detect(video);
      if (found.length) {
        const value = String(found[0].rawValue || '').trim();
        if (value) {
          close();
          handleScannedBarcode(value);
          return;
        }
      }
    } catch (err) {
      // فشل قراءة إطار واحد مش سبب لإيقاف المسح — بنكمّل عادي.
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// بيدوّر على الفئة اللي ليها الباركود ده ويفتحها.
// بيقارن كنص وكرقم، لأن "012133" و"12133" نفس الباركود عمليًا.
function handleScannedBarcode(value) {
  const normalize = (v) => String(v || '').trim().replace(/^0+/, '');
  const target = normalize(value);

  const match = state.categories.find((c) => normalize(c.barcodeNumber) === target);

  if (!match) {
    alert(`مفيش فئة بالباركود ده:\n${value}\n\nتقدر تضيفه لفئة من زرار "تعديل" فوق الجدول.`);
    return;
  }

  state.activeCategoryId = match.id;
  state.showActivityLog = false;
  render();
  subscribeGrades(match.id);
}
