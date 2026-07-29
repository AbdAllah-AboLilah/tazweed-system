// ============================================================
// مسح الباركود بكاميرا الموبايل
// ============================================================
// تصوّر باركود أي صنف (QR أو باركود خطي) والنظام يفتحلك التاب بتاعه على طول،
// أو يحطّه في سلة الطباعة — حسب المكان اللي فتحت منه المسح.
//
// بيستخدم BarcodeDetector — دي حاجة **مبنية جوه المتصفح نفسه** (Chrome على
// أندرويد بيدعمها)، فمفيش مكتبة خارجية تتحمّل ولا حجم زيادة على النظام.
// لو المتصفح مش بيدعمها، بنقول للمستخدم يكتب الرقم بإيده بدل ما نسيبه
// قدام شاشة مكسورة.

const CAMERA_ID_KEY = 'tazweed_camera_id';

function isBarcodeScanSupported() {
  return typeof BarcodeDetector !== 'undefined' && !!navigator.mediaDevices;
}

function getSavedCameraId() {
  try {
    return localStorage.getItem(CAMERA_ID_KEY) || '';
  } catch (err) {
    return '';
  }
}

function saveCameraId(id) {
  try {
    if (id) localStorage.setItem(CAMERA_ID_KEY, id);
    else localStorage.removeItem(CAMERA_ID_KEY);
  } catch (err) {
    console.error('تعذّر حفظ اختيار الكاميرا:', err);
  }
}

// أجهزة كتير فيها أكتر من كاميرا خلفية (عادية + عريضة + ماكرو)، والمتصفح
// بيختار واحدة عشوائيًا — وساعات بيختار الوايد اللي صورتها مش واضحة قريب،
// فالباركود مابيتقراش. عشان كده بنسأل مرة واحدة بس ونحفظ الاختيار.
async function listCameras() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  } catch (err) {
    return [];
  }
}

// بيفتح قايمة الكاميرات ويحفظ الاختيار. بيرجّع معرّف الكاميرا المختارة،
// أو '' لو المستخدم قفل من غير اختيار.
function openCameraChooser() {
  return new Promise(async (resolve) => {
    // لازم إذن الكاميرا يتاخد الأول، وإلا أسماء الكاميرات بترجع فاضية
    // من المتصفح (سياسة خصوصية) وتظهر "كاميرا 1، كاميرا 2" من غير معنى.
    let warmup = null;
    try {
      warmup = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      /* هنكمّل عادي — القايمة هتظهر بأسماء عامة */
    }
    const cams = await listCameras();
    if (warmup) warmup.getTracks().forEach((t) => t.stop());

    if (!cams.length) {
      alert('مش لاقي أي كاميرا على الجهاز ده.');
      resolve('');
      return;
    }

    const saved = getSavedCameraId();
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:3200;padding:12px;';
    overlay.innerHTML = `
      <div class="card" style="max-width:340px; width:100%;">
        <div style="font-size:15px; font-weight:500; margin-bottom:4px;">اختار الكاميرا</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.7;">
          الاختيار ده بيتحفظ على الجهاز ده، ومش هيتسألك تاني.
          لو الباركود مش بيتقرا، غيّر الكاميرا من هنا.
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          ${cams
            .map(
              (c, i) => `
            <button class="btn ${c.deviceId === saved ? 'btn-primary' : ''}" data-cam="${escapeHTML(c.deviceId)}">
              ${escapeHTML(c.label || `كاميرا ${i + 1}`)}
            </button>`
            )
            .join('')}
        </div>
        <div style="display:flex; gap:8px; justify-content:space-between;">
          <button class="btn" id="cam-auto">اختيار تلقائي</button>
          <button class="btn" id="cam-cancel">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = (value) => {
      if (overlay.parentNode) document.body.removeChild(overlay);
      resolve(value);
    };

    overlay.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cam');
        saveCameraId(id);
        close(id);
      });
    });
    overlay.querySelector('#cam-auto').addEventListener('click', () => {
      saveCameraId('');
      close('');
    });
    overlay.querySelector('#cam-cancel').addEventListener('click', () => close(getSavedCameraId()));
  });
}

// onResult: دالة تتنادى بالقيمة المقروءة. لو مبعتّهاش، السلوك الافتراضي
// هو فتح الفئة اللي ليها الباركود ده (زي الأول).
// keepOpen: بيسيب الكاميرا شغّالة بعد كل قراءة عشان تصوّر أصناف ورا بعض
// من غير ما تفتح الشاشة كل مرة (بيستخدم في شاشة الطباعة).
async function openBarcodeScanner(onResult, keepOpen) {
  const handle = onResult || handleScannedBarcode;

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
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button class="btn" id="scan-switch">🎥 غيّر الكاميرا</button>
      <button class="btn" id="scan-cancel">${keepOpen ? 'تم' : 'إلغاء'}</button>
    </div>`;
  document.body.appendChild(overlay);

  // بنمسك العناصر من جوه الـoverlay نفسه مش من الصفحة كلها — لو فيه أكتر
  // من شاشة مفتوحة، كل واحدة بتلاقي عناصرها هي.
  const video = overlay.querySelector('#scan-video');
  const msg = overlay.querySelector('#scan-msg');
  let stream = null;
  let stopped = false;

  const stopStream = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  const close = () => {
    stopped = true;
    stopStream();
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  overlay.querySelector('#scan-cancel').addEventListener('click', close);

  if (!isBarcodeScanSupported()) {
    msg.innerHTML = 'المتصفح ده مش بيدعم قراءة الباركود بالكاميرا.<br>جرّب Chrome، أو اكتب رقم الباركود بإيدك.';
    return;
  }

  const start = async () => {
    stopStream();
    let camId = getSavedCameraId();

    // أول مرة على الجهاز: نسأل المستخدم يختار الكاميرا مرة واحدة بس.
    if (!camId) {
      const cams = await listCameras();
      if (cams.length > 1) {
        camId = await openCameraChooser();
      }
    }

    const constraints = camId
      ? { video: { deviceId: { exact: camId } } }
      : { video: { facingMode: { ideal: 'environment' } } };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // الكاميرا المحفوظة ممكن تكون اتشالت أو مشغولة — نرجع للتلقائي بدل
      // ما نسيب المستخدم قدام شاشة سودة.
      if (camId) {
        saveCameraId('');
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        } catch (err2) {
          console.error(err2);
          msg.innerHTML = 'مقدرتش أفتح الكاميرا.<br>اتأكد إنك سمحت للموقع باستخدامها من إعدادات المتصفح.';
          return false;
        }
      } else {
        console.error(err);
        msg.innerHTML = 'مقدرتش أفتح الكاميرا.<br>اتأكد إنك سمحت للموقع باستخدامها من إعدادات المتصفح.';
        return false;
      }
    }

    // نفس درس شاشة إعدادات الطابعة: المستخدم ممكن يكون قفل الشاشة وإحنا
    // لسه بنستنى إذن الكاميرا. من غير الفحص ده الكاميرا كانت هتفضل شغّالة
    // بعد ما الشاشة تتقفل (اللمبة تفضل نوّرة).
    if (stopped) {
      stopStream();
      return false;
    }

    video.srcObject = stream;
    await video.play();
    return true;
  };

  overlay.querySelector('#scan-switch').addEventListener('click', () =>
    safeAsync(async () => {
      await openCameraChooser();
      await start();
    }, 'تغيير الكاميرا')
  );

  if (!(await start())) return;

  const detector = new BarcodeDetector({
    formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf'],
  });

  let lastValue = '';
  let lastAt = 0;

  const tick = async () => {
    if (stopped) return;
    try {
      const found = await detector.detect(video);
      if (found.length) {
        const value = String(found[0].rawValue || '').trim();
        // نفس الباركود قدام الكاميرا بيتقرا عشرات المرات في الثانية —
        // بنتجاهل التكرار لمدة ثانية ونص عشان ما يتضافش 30 مرة.
        const now = Date.now();
        if (value && (value !== lastValue || now - lastAt > 1500)) {
          lastValue = value;
          lastAt = now;
          if (keepOpen) {
            msg.textContent = `✅ ${value}`;
            handle(value);
          } else {
            close();
            handle(value);
            return;
          }
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
    // مش فئة؟ يمكن يكون صنف من قاعدة الأصناف — نوريه للمستخدم بدل ما
    // نقوله "مش لاقي" وخلاص.
    const product = typeof findProductByBarcode === 'function' ? findProductByBarcode(value) : null;
    if (product) {
      if (confirm(`الباركود ده لصنف في قاعدة الأصناف:\n${product.name}\n\nتحب تطبع ملصق له؟`)) {
        safeAsync(() => printProductLabel(product), 'طباعة الملصق');
      }
      return;
    }
    alert(`مفيش فئة ولا صنف بالباركود ده:\n${value}\n\nتقدر تضيفه لفئة من زرار "تعديل" فوق الجدول.`);
    return;
  }

  state.activeCategoryId = match.id;
  state.screen = 'sheets';
  render();
  subscribeGrades(match.id);
}
