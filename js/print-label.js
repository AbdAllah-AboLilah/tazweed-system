// ============================================================
// الملصقات — رسم ملصق الصنف والدرجة والمسمّى
// ============================================================
// ⚠️ الملف ده **مش** وحدة معزولة (module). كل ملفات js بتتحمّل في مساحة
// أسماء واحدة مشتركة، فأي اسم هنا شايفه باقي الملفات والعكس. التقسيم
// للتنظيم بس: كل ملف عن حاجة واحدة عشان اللي بيعدّل يلاقي اللي بيدوّر
// عليه من غير ما يقلّب في 8000 سطر.
//
// كل حاجة بترسم ملصق: الباركود، الصور، الـHTML، وقياس الخطوط.
// ⭐ الملصق النصّي بيتبني من buildTextLabel **بس** — متكتبش نسخة تانية.


// بترجّع كائن الكود بأقل عدد مربعات ممكن، أو null لو المكتبة مش موجودة.
//
// ------------------------------------------------------------
// ⚠️ ترتيب الاختيار هنا مش عشوائي — اتبنى على قياس
// ------------------------------------------------------------
// جرّبنا 8 باركودات حقيقية على فاكّ QR مع محاكاة الطباعة الحرارية، وطلع:
//
//   • الوضع الرقمي (Numeric) بيغيّر شكل مصفوفة الكود كلها. للأرقام
//     الطويلة ده مكسب كبير، لكن للأرقام القصيرة الكود بيتملي "حشو" ثابت
//     ومتكرر، والنتيجة قراءة **أسوأ** — قِسناها: 0 من 6 نجحت بالوضع
//     الرقمي مقابل 3 من 6 بالوضع العادي.
//
//   • والمفاجأة: المكتبة الجديدة بتطلّع باركود الـ13 رقم في 21 مربع
//     **حتى بالوضع العادي** (القديمة كانت بتطلّعه 25). يعني المكسب كله
//     كان جاي من إن المكتبة القديمة بتختار نسخة أكبر من اللازم، مش من
//     الوضع الرقمي.
//
// فالقاعدة: نبدأ بـ**نفس الإعداد اللي شغّال دلوقتي** (وضع عادي + مستوى M)،
// ومانغيّرش غير لو التغيير **بيقلّل عدد المربعات فعلًا**. كده الباركودات
// اللي بتتقرا كويس دلوقتي مابتتغيّرش بأي حرف، والباركودات الطويلة بس هي
// اللي بتستفيد.
function buildBestQR(content) {
  if (typeof qrcode !== 'function') return null;

  const isDigits = /^[0-9]+$/.test(content);
  // بالترتيب: الأول هو إعداد النظام الحالي، وبعده البدائل اللي ممكن تصغّر
  // الكود. أول واحد يوصل لأقل عدد مربعات هو اللي بياخدها (التعادل للأول).
  const combos = [
    { mode: 'Byte', level: 'M' },
    ...(isDigits ? [{ mode: 'Numeric', level: 'M' }] : []),
    { mode: 'Byte', level: 'L' },
    ...(isDigits ? [{ mode: 'Numeric', level: 'L' }] : []),
  ];

  let best = null;
  for (const combo of combos) {
    try {
      const qr = qrcode(0, combo.level);
      qr.addData(content, combo.mode);
      qr.make();
      const count = qr.getModuleCount();
      if (!best || count < best.count) best = { qr, count, ...combo };
    } catch (err) {
      // المحتوى مش داخل في الإعداد ده — عادي، نجرّب اللي بعده
    }
  }
  return best;
}

function generateQRDataURL(text, sizePx) {
  const content = String(text || '');

  const best = buildBestQR(content);
  if (best) {
    // بنرسم المربعات بنفسنا على مقاس **من مضاعفات عددها بالظبط**، فكل
    // مربع بيطلع بنفس عدد البكسلات من غير تقريب.
    //
    // ⚠️ والمقاس بيفضل قريب من 200 بكسل زي ما كان. جرّبنا قبل كده نكبّره
    // لـ400 عشان "الدقة" والنتيجة كانت **أسوأ** على الطابعة: الصورة بتتصغّر
    // لـ86 نقطة طباعة، وكل ما التصغير يزيد بيضيع تفاصيل أكتر. (التفاصيل
    // في README — v0.23.1)
    const target = Number(sizePx) || 200;
    const scale = Math.max(1, Math.round(target / best.count));
    const side = best.count * scale;

    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, side, side);
      ctx.fillStyle = '#000000';
      for (let row = 0; row < best.count; row++) {
        for (let col = 0; col < best.count; col++) {
          if (best.qr.isDark(row, col)) ctx.fillRect(col * scale, row * scale, scale, scale);
        }
      }
      try {
        return Promise.resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        /* هنكمّل للطريقة القديمة تحت */
      }
    }
  }

  // احتياطي: المكتبة القديمة، لو الجديدة مش متحمّلة لأي سبب.
  return legacyQRDataURL(content, sizePx);
}

function legacyQRDataURL(text, sizePx) {
  return new Promise((resolve) => {
    if (typeof QRCode === 'undefined') {
      resolve('');
      return;
    }
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed; left:-9999px; top:-9999px;';
    document.body.appendChild(holder);
    try {
      new QRCode(holder, { text: String(text || ''), width: sizePx, height: sizePx, correctLevel: QRCode.CorrectLevel.M });
    } catch (err) {
      document.body.removeChild(holder);
      resolve('');
      return;
    }
    setTimeout(() => {
      let dataUrl = '';
      const canvas = holder.querySelector('canvas');
      const img = holder.querySelector('img');
      try {
        if (canvas) dataUrl = canvas.toDataURL('image/png');
        else if (img && img.src) dataUrl = img.src;
      } catch (err) {
        dataUrl = '';
      }
      document.body.removeChild(holder);
      resolve(dataUrl);
    }, 60);
  });
}

// شكل الملصق مأخوذ من صورة الملصق الحقيقي (Crepe Sadda Luxe) اللي بعتها:
//   [ QR ]   اسم الصنف
//            رقم الباركود
//            السعر الأصلي مشطوب   السعر الفعلي
//
// نقطة جوهرية اتصلحت هنا: الشكل القديم كان بيحط الـQR **فوق** التلات سطور،
// وده مستحيل فيزيائيًا يدخل — نص اللاصقة ارتفاعه 12.5مم والـQR لوحده عايز
// ~11مم، فالسعر كان بيتقطع بره حدود الورق. لما الـQR بقى **جنب** النص،
// الـ11مم بتاعته بتاخد الارتفاع كله والسطور بتاخد العرض الباقي.
//
// نقطة تانية: اللاصقة مقسومة نصين والماكينة بتحسبهم لاصقة واحدة، فبنطبع
// **نفس المحتوى مرتين، مرة في كل نص** — بالظبط زي لفة الملصقات الأصلية.
// ============================================================
// 🖼️ رسم الملصق كصورة — بنقط الطابعة بالظبط
// ============================================================
// ⚠️ ليه اتعمل ده، بالتفصيل، عشان محدش يرجّعه بالغلط:
//
// الطريقة القديمة كانت بتبعت **HTML** للطابعة، واللي بيرسمه هو محرك تاني
// خالص (جافا جوه QZ على كمبيوتر الكاشير). المحرك ده:
//   • عنده خطوط مختلفة عن المتصفح اللي عندك
//   • بيقسّم السطور بمقاسات مختلفة
//   • فبيطلع شكل **مختلف عن المعاينة اللي شوفتها**
//
// والنتيجة الحقيقية اللي حصلت: المعاينة على التليفون بتقول
// "Chanvie Leen 58047" كامل، والمطبوع بيقول "Chanvie Leen" بس — الجزء
// اللي مادخلش بيتقص في صمت. جرّبنا نصلّحها بالقياس وبهامش أمان، وفضلت.
//
// السبب إن المشكلة **مش في الحساب** — المشكلة إن اللي بيرسم مش إحنا.
//
// فبقينا **نرسم الملصق بنفسنا** على canvas بمقاس نقط الطابعة بالظبط،
// ونبعت صورة جاهزة. المحرك التاني مابقاش ليه أي دور: بياخد صورة ويحطها
// على الورق زي ما هي.
//
//   38 مم × 203 نقطة/بوصة ÷ 25.4  =  304 نقطة
//   25 مم × 203 ÷ 25.4             =  200 نقطة
//
// ومكسب تاني مهم: مربعات الـQR بقت **عدد صحيح من النقط** (4 نقط للمربع)
// بدل ما المحرك يصغّرها بكسر ويضيّع حروفها.
//
// ومكسب تالت: الصورة أخف بكتير من HTML فيه صورة base64 جوّه — فالطبعات
// الكبيرة (100 ملصق) بقت تعدّي، وقبل كده كانت بتقف.
const PRINTER_DPI = 203; // Xprinter XP-233B وأغلب الطابعات الحرارية

// ============================================================
// ⭐ الهامش الآمن — أهم رقم في الملصق
// ============================================================
// الطابعة الحرارية بتسحب الورق ميكانيكيًا، وفيه لعب طبيعي **حوالي 1 إلى
// 1.5 مم** في كل طبعة. الملصق اللي محتواه لازق في الحرف بيتقص.
//
// ده حصل فعلًا واتصوّر على ورق (v0.33): "Hejap Kuwaiti 12(" و
// "Balea Repaie Vi" — الكلام متقصوص من حرف اللاصقة.
//
// القياس اللي بنينا عليه: بمحاكاة إزاحة 1.5 مم على التصميم القديم
// (هامش 1 مم) **522 نقطة حبر وقعت بره الورق والكود بطّل يتقرا**.
// وبهامش 2 مم: صفر نقطة ضاعت والكود اتقرا.
//
// ⚠️ التمن: اللاصقة 12.5 مم ارتفاع، ومربع الكود لازم عدد صحيح من نقط
// الطابعة. فبهامش 2 مم الكود بينزل من 10.5 لـ7.9 مم. مافيش حل يجمع
// الاتنين — ده مقاس الورق مش اختيار.
const SAFE_MARGIN_MM = 2.0;

// ============================================================
// سُمك خط الملصق
// ============================================================
// الطابعة الحرارية بتفرد الحبر حوالين كل نقطة سودا — ده اللي بيلزّق
// الحروف ببعض ("النغمشة"). القياس على نفس النص:
//
//   غامق → 7.7% حبر، وبعد الفرد 11.9%
//   عادي → 5.5% حبر، وبعد الفرد  9.7%
//
// الفرد نفسه (+4.2%) واحد في الحالتين — **ده حرارة الطابعة مش تصميمنا**.
// بس الغامق بيبدأ من نقطة أعلى، فبينتهي بحبر أكتر بـ23%.
//
// ⚠️ سجل المحاولات (عشان محدش يلف في الدايرة تاني):
//   • غامق + تكبير من QZ  → منغمش (السبب كان التكبير، اتصلح v0.28.3)
//   • عادي                → اتجرّب وقتها وبان باهت — **بس التجربة دي كانت
//     قبل ما نصلّح التكبير**، يعني المقارنة مكانتش نضيفة
//   • عادي + من غير تكبير + هوامش آمنة → اللي إحنا فيه دلوقتي
//
// 📌 الحل الأساسي للنغمشة **مش هنا**: هو تنزيل الحرارة من إعدادات
// الطابعة (🔥 وضوح الطباعة). ده بيقلّل الفرد من المصدر.
const LABEL_WEIGHT = 'normal';

const mmToDots = (mm) => (mm * PRINTER_DPI) / 25.4;
// العكس — بنحتاجه لما نحسب حاجة بالنقط (زي مربعات الباركود) وننزّلها CSS
const dotsToMm = (dots) => (dots * 25.4) / PRINTER_DPI;

// مقاس الملصق بنقط الطابعة — 38×25 مم = 304×200 نقطة
function labelDots(sizeOptions) {
  return {
    w: Math.round(mmToDots(sizeOptions.pageWidthMm)),
    h: Math.round(mmToDots(sizeOptions.pageHeightMm)),
  };
}

// بتدوّر على أكبر حجم خط بيخلّي النص يدخل في عدد السطور المسموح —
// **بنفس الـcontext اللي هيرسم**، فالقياس مطابق للرسم 100%.
function fitCanvasFont(ctx, text, maxW, maxLines, weight, family, capPx) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { size: capPx || 10, lines: [] };

  const layout = (size) => {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (ctx.measureText(next).width <= maxW || !cur) {
        // كلمة واحدة أطول من السطر كله → بتتكسر بالحروف
        if (!cur && ctx.measureText(w).width > maxW) {
          let piece = '';
          for (const ch of w) {
            if (ctx.measureText(piece + ch).width > maxW && piece) {
              lines.push(piece);
              piece = ch;
            } else piece += ch;
          }
          cur = piece;
          continue;
        }
        cur = next;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  let lo = 3;
  let hi = capPx || 60;
  let best = layout(lo);
  let bestSize = lo;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    const lines = layout(mid);
    if (lines.length <= maxLines) {
      lo = mid;
      best = lines;
      bestSize = mid;
    } else {
      hi = mid;
    }
  }
  return { size: bestSize, lines: best };
}

// بترسم نص متعدد السطور في النص أفقيًا، وبترجّع الارتفاع اللي أخده.
function drawLines(ctx, lines, size, weight, family, centerX, topY, lineH) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, centerX, topY + lineH * (i + 0.5)));
  return lineH * lines.length;
}

// ============================================================
// 🔍 الرسم بدقة أعلى وبعدين التصغير
// ============================================================
// ⚠️ المشكلة اللي بيحلها ده: الطابعة الحرارية **أبيض وأسود بس**، مفيش
// عندها رمادي. فلما نرسم خط صغير (21 نقطة ارتفاع) ونحوّله لأبيض/أسود
// على طول، حروفه بتطلع **مسنّنة ومنغمشة** — كل نقطة يا بيضا يا سودا،
// ومفيش حاجة في النص تنعّم الحرف.
//
// الحل: نرسم على مساحة **3 أضعاف** (912×600 بدل 304×200)، وبعدين نصغّر
// بحساب **متوسط كل 9 نقط**. كده كل نقطة نهائية بتاخد قرارها من 9 عيّنات
// مش من واحدة — فحرف الخط بيقع في مكانه الصح وحوافه بتبقى أنضف بكتير.
//
// والباركود مابيتأثرش: مربعاته بتترسم بمقاس من مضاعفات 3 بالظبط، فالتصغير
// بيرجّعها زي ما هي حرف بحرف.
const RENDER_SCALE = 3;

function makeHiResCanvas(W, H) {
  const c = document.createElement('canvas');
  c.width = W * RENDER_SCALE;
  c.height = H * RENDER_SCALE;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.scale(RENDER_SCALE, RENDER_SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';
  return { canvas: c, ctx };
}

// بتصغّر بالمتوسط وبتحوّل لأبيض/أسود، وبترجّع data URL.
function shrinkToPrinterDots(bigCanvas, W, H) {
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  if (!octx) return '';

  try {
    const big = bigCanvas.getContext('2d').getImageData(0, 0, W * RENDER_SCALE, H * RENDER_SCALE).data;
    const img = octx.createImageData(W, H);
    const d = img.data;
    const S = RENDER_SCALE;
    const area = S * S;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let sy = 0; sy < S; sy++) {
          const row = (y * S + sy) * W * S;
          for (let sx = 0; sx < S; sx++) {
            const i = (row + x * S + sx) * 4;
            sum += big[i] * 0.299 + big[i + 1] * 0.587 + big[i + 2] * 0.114;
          }
        }
        // العتبة 50%: النقطة بتبقى سودا لو أغلب الـ9 عيّنات سودا. ده
        // بيحافظ على سُمك الحرف الحقيقي — العتبة العالية كانت بتتخّنه.
        const v = sum / area < 128 ? 0 : 255;
        const di = (y * W + x) * 4;
        d[di] = d[di + 1] = d[di + 2] = v;
        d[di + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return out.toDataURL('image/png');
  } catch (err) {
    console.warn('تعذّر تصغير الملصق:', err);
    return '';
  }
}

// بترسم الملصق كله وبترجّع data URL لصورة PNG.
function renderLabelPNG(cat, sizeOptions) {
  const { pageWidthMm, pageHeightMm } = sizeOptions;
  const halves = sizeOptions.halves || 1;
  const W = Math.round(mmToDots(pageWidthMm));
  const H = Math.round(mmToDots(pageHeightMm));
  const halfH = Math.round(H / halves);

  const hi = makeHiResCanvas(W, H);
  if (!hi) return '';
  const ctx = hi.ctx;

  const FAMILY = 'Arial, Helvetica, Tahoma, sans-serif';
  const name = String(cat.itemName || cat.name || '');
  const code = String(cat.barcodeNumber || '');
  const sellNum = Number(cat.sellingPrice) || 0;
  const origNum = Number(cat.originalPrice) || 0;
  const hasDiscount = origNum > 0 && origNum !== sellNum;
  // ⭐ "من غير سعر": بتشيل سطر السعر خالص — والاسم والرقم بياخدوا مكانه،
  // يعني الخط بيكبر مش بس السعر بيختفي. مفيدة لما تكون الأسعار بتتغيّر
  // كتير أو الملصق للتعريف مش للبيع.
  const showPrice = !!cat.sellingPrice && !sizeOptions.noPrice;

  // نفس هندسة الملصق القديم بالظبط، بس بالنقط بدل الملليمترات
  // ⭐ الهامش الآمن على **حرف الورقة** بس، مش على خط القص اللي في النص —
  // نفس منطق الملصق النصّي بالظبط (شوف الشرح في buildLabelHTML).
  // ده اللي رجّع الباركود من 7.9مم لـ9.5مم من غير ما نضحّي بالأمان.
  const outer = mmToDots(SAFE_MARGIN_MM);
  const inner = mmToDots(halves > 1 ? 0.6 : SAFE_MARGIN_MM);
  const pad = outer;
  const padX = mmToDots(SAFE_MARGIN_MM);
  const gapX = mmToDots(0.8);
  const contentH = halfH - outer - inner;

  // ⭐ الـQR بمربعات من عدد صحيح من النقط — ده اللي بيخلّيه يتقرا بسرعة.
  const best = buildBestQR(code || name);
  const qrAvail = Math.min(contentH, mmToDots(11));
  let qrSize = Math.floor(qrAvail);
  let modulePx = 0;
  if (best) {
    modulePx = Math.max(1, Math.floor(qrAvail / best.count));
    qrSize = modulePx * best.count;
  }

  const textW = W - qrSize - padX * 2 - gapX;
  const textCx = padX + qrSize + gapX + textW / 2;

  const LINE = 1.2;
  const otherLines = 1 + (showPrice ? 1 : 0);
  const capPx = mmToDots(2.7);

  for (let h = 0; h < halves; h++) {
    const top = h * halfH;
    // النص الأول: الهامش الكبير فوق. النص التاني: الكبير تحت.
    const topOffset = h === 0 ? outer : inner;

    // --- الـQR ---
    if (best && qrSize > 0) {
      const qrY = top + topOffset + (contentH - qrSize) / 2;
      const qrX = padX;
      for (let row = 0; row < best.count; row++) {
        for (let col = 0; col < best.count; col++) {
          if (best.qr.isDark(row, col)) {
            ctx.fillRect(qrX + col * modulePx, qrY + row * modulePx, modulePx, modulePx);
          }
        }
      }
    }

    // --- النص: بنختار سطر ولا سطرين للاسم زي ما في الشاشة ---
    let chosen = null;
    for (let maxLines = 1; maxLines <= 2; maxLines++) {
      const byHeight = contentH / ((maxLines + otherLines) * LINE);
      const fit = fitCanvasFont(ctx, name, textW, maxLines, LABEL_WEIGHT, FAMILY, Math.min(byHeight, capPx));
      if (!chosen || fit.size > chosen.size) chosen = { ...fit, maxLines, byHeight };
    }

    const nameLines = chosen.lines.length;
    const byHeight = contentH / ((nameLines + otherLines) * LINE);
    // ⭐ المقاسات بأعداد صحيحة من نقط الطابعة.
    // السبب: المقاس الكسري بيخلّي عمود الحرف يقع بين نقطتين، فمرة بيطلع
    // نقطة ومرة نقطتين — وده اللي بيدّي إحساس إن الخط "مش مظبوط".
    const nameSize = Math.max(6, Math.round(Math.min(chosen.size, byHeight, capPx)));
    const codeSize = Math.max(6, Math.round(Math.min(byHeight, nameSize * 0.9)));
    const priceSize = Math.max(6, Math.round(Math.min(byHeight, nameSize * 1.15)));
    const oldPriceSize = Math.max(5, Math.round(priceSize * 0.8));

    const lineH = contentH / (nameLines + otherLines);
    let y = top + topOffset;

    ctx.fillStyle = '#000000';
    // اسم الصنف غامق زي الرقم والسعر — اتطلب كده صراحة بعد ما جرّبنا
    // الخط العادي وطلع باهت جنبهم.
    //
    // ⚠️ سجل المحاولات هنا، عشان محدش يلف في نفس الدايرة تاني:
    //   • bold + تكبير الصورة من QZ  → منغمش (السبب كان التكبير، v0.28.3)
    //   • عادي                        → أنضف بس باهت جنب الرقم والسعر
    //   • bold + من غير تكبير         → اللي إحنا فيه دلوقتي
    //
    // الحل الجذري مش في سُمك الخط أصلًا: خطوط المتصفح مصمّمة للشاشة، وإحنا
    // بنطبع على 203 نقطة/بوصة. الطريقة الاحترافية إن **الطابعة ترسم النص
    // بخطها الداخلي** (أوامر TSPL) بدل ما نبعتلها صورة — شوف
    // buildTSPLFontSample تحت.
    y += drawLines(ctx, chosen.lines, nameSize, LABEL_WEIGHT, FAMILY, textCx, y, lineH);

    drawLines(ctx, [code], codeSize, LABEL_WEIGHT, FAMILY, textCx, y, lineH);
    y += lineH;

    if (showPrice) {
      const sell = `${cat.sellingPrice} L.E`;
      const orig = hasDiscount ? `${cat.originalPrice} L.E` : '';
      const gap = mmToDots(0.8);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      ctx.font = `normal ${oldPriceSize}px ${FAMILY}`;
      const origW = orig ? ctx.measureText(orig).width : 0;
      ctx.font = `${LABEL_WEIGHT} ${priceSize}px ${FAMILY}`;
      const sellW = ctx.measureText(sell).width;
      const totalW = origW + (orig ? gap : 0) + sellW;
      let x = textCx - totalW / 2;
      const cy = y + lineH / 2;

      if (orig) {
        ctx.font = `normal ${oldPriceSize}px ${FAMILY}`;
        ctx.fillText(orig, x, cy);
        // الشطبة
        const lineY = cy;
        ctx.fillRect(x, lineY - Math.max(1, oldPriceSize * 0.04), origW, Math.max(1, oldPriceSize * 0.08));
        x += origW + gap;
      }
      ctx.font = `${LABEL_WEIGHT} ${priceSize}px ${FAMILY}`;
      ctx.fillText(sell, x, cy);
      ctx.textAlign = 'center';
    }
  }

  return shrinkToPrinterDots(hi.canvas, W, H);
}

// ============================================================
// ✂️ الملصق المقسوم أربعة
// ============================================================
// اللاصقة 38×25 مم بتتقسم أربع خلايا 19×12.5، وبينهم خط أسود رأسي تقصّ
// عليه بالمقص. يعني من نفس اللفة بتطلع 4 ملصقات بدل 2.
//
// ------------------------------------------------------------
// ⚠️ مقاس الـQR بيقفز، مابيتدرّجش — الرقم ده متقاس
// ------------------------------------------------------------
// مربع الكود لازم يكون **عدد صحيح من نقط الطابعة**، والكود 21 مربع.
// فالمقاسات الممكنة تلاتة بس:
//
//   4 نقط/مربع → 10.5 مم   (ده اللي في الملصق العادي، ومجرّب على ورق)
//   3 نقط/مربع →  7.9 مم   (اللي مستخدم هنا)
//   2 نقط/مربع →  5.3 مم
//
// مافيش حاجة بينهم. لو طلبت 9 مم، الحساب بينزل لـ7.9 لوحده.
//
// اخترنا 3 لأن 4 بياكل 10.5 من الـ19 مم فمايفضلش للنص إلا 6 مم — والرقم
// كان بيخرج بره عموده ويركب على الكود.
//
// ⚠️ 3 نقط/مربع **مااتجربتش على ورق حقيقي**. فحص القراءة عندنا بيقول
// إنها بتتقرا، لكن نفس الفحص بيفشل على الملصق اللي شغّال في المحل فعلًا
// لما نحاكي فرد الحبر — يعني المحاكاة متشائمة وماينفعش نبني عليها. أول
// طبعة لازم تتجرّب على الماكينة قبل أي كمية.
const QUARTER_QR_DOTS_PER_MODULE = 3;

// بترسم خلية واحدة من الملصق المقسوم على السياق اللي جايلها.
//
// ⭐ كل سطر بيتقصّ على **عرض عموده** مش على الارتفاع بس. ده كان سبب إن
// رقم الباركود يخرج من عموده ويركب على الكود: مقاسه كان متحسوب من
// الارتفاع لوحده، والعرض مالوش أي دور في الحساب.
function drawQuarterCell(ctx, cat, x0, y0, W, H, noPrice) {
  const F = 'Arial, Helvetica, Tahoma, sans-serif';
  const name = String(cat.itemName || cat.name || '');
  const code = String(cat.barcodeNumber || '');
  const showPrice = !!cat.sellingPrice && !noPrice;

  // نفس الهامش الآمن، بس محسوب من حرف **الخلية** — والخلايا الجوانية
  // بتاخد نصه لأن جنبها خط القص مش حرف الورق.
  const pad = mmToDots(SAFE_MARGIN_MM);
  const padX = mmToDots(SAFE_MARGIN_MM * 0.75);
  const gapX = mmToDots(0.6);
  const SAFETY = 0;
  const contentH = H - pad * 2 - SAFETY;
  const top = y0 + pad + SAFETY / 2;

  // --- الكود ---
  const best = buildBestQR(code || name);
  let qrSize = 0;
  if (best) {
    const modulePx = Math.max(1, Math.min(QUARTER_QR_DOTS_PER_MODULE, Math.floor(contentH / best.count)));
    qrSize = modulePx * best.count;
    const qrY = top + (contentH - qrSize) / 2;
    for (let r = 0; r < best.count; r++) {
      for (let c = 0; c < best.count; c++) {
        if (best.qr.isDark(r, c)) ctx.fillRect(x0 + padX + c * modulePx, qrY + r * modulePx, modulePx, modulePx);
      }
    }
  }

  // --- عمود النص جنبه ---
  const textW = W - qrSize - padX * 2 - gapX;
  const cx = x0 + padX + qrSize + gapX + textW / 2;
  const LINE = 1.15;
  // أربع سطور كحد أقصى: اسم (١ أو ٢) + رقم + سعر
  const rows = 2 + 1 + (showPrice ? 1 : 0);
  const lineH = contentH / rows;
  const capPx = lineH / LINE;

  // الاسم: سطر، وسطرين لو طويل، و"…" لو حتى السطرين مكفوش.
  //
  // ⚠️ الترتيب هنا مهم: بندوّر على **أكبر خط بيخلّي الاسم يدخل في سطرين**،
  // مش بنثبّت الخط على ارتفاع السطر ونقص اللي زاد. الغلطة دي حصلت فعلًا:
  // في نسخة "من غير سعر" السطور بتقل فارتفاع السطر بيكبر، فالخط كبر،
  // فالاسم بقى مش داخل واتقص — يعني **مساحة أكبر أدّت لاسم أقصر**.
  //
  // القص بـ"…" بقى الملاذ الأخير: بس لما الخط ينزل تحت الحد اللي يتقرا.
  const MIN_NAME_DOTS = 8;
  const fitName = fitCanvasFont(ctx, name, textW, 2, LABEL_WEIGHT, F, capPx);
  let nameSize = Math.round(fitName.size);
  let nameLines = fitName.lines;
  if (nameSize < MIN_NAME_DOTS) {
    nameSize = MIN_NAME_DOTS;
    ctx.font = `bold ${nameSize}px ${F}`;
    const words = name.trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (ctx.measureText(next).width <= textW || !cur) cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    nameLines = lines.slice(0, 2);
    if (lines.length > 2 && nameLines[1]) {
      let last = nameLines[1];
      while (last.length && ctx.measureText(last + '…').width > textW) last = last.slice(0, -1);
      nameLines[1] = last + '…';
    }
  }

  ctx.fillStyle = '#000000';
  let y = top;
  y += drawLines(ctx, nameLines, nameSize, LABEL_WEIGHT, F, cx, y, lineH);

  // اللي فضل من الارتفاع بيتوزّع على الرقم والسعر — فالاسم القصير بيدّي
  // للرقم والسعر مساحة أكبر بدل ما تروح فاضي.
  const restRows = rows - nameLines.length;
  const restH = restRows > 0 ? (contentH - lineH * nameLines.length) / restRows : lineH;
  const fitOne = (text, cap) => {
    const f = fitCanvasFont(ctx, text, textW, 1, LABEL_WEIGHT, F, cap);
    return Math.max(5, Math.round(Math.min(f.size, cap)));
  };

  if (code) {
    drawLines(ctx, [code], fitOne(code, Math.min(restH / LINE, nameSize)), LABEL_WEIGHT, F, cx, y, restH);
    y += restH;
  }
  if (showPrice) {
    const price = `${cat.sellingPrice} L.E`;
    drawLines(ctx, [price], fitOne(price, Math.min(restH / LINE, nameSize * 1.2)), LABEL_WEIGHT, F, cx, y, restH);
  }
}

function renderQuarterLabelPNG(cat, sizeOptions) {
  const W = Math.round(mmToDots(sizeOptions.pageWidthMm));
  const H = Math.round(mmToDots(sizeOptions.pageHeightMm));
  const hi = makeHiResCanvas(W, H);
  if (!hi) return '';
  const ctx = hi.ctx;

  const cellW = Math.floor(W / 2);
  const cellH = Math.floor(H / 2);
  ctx.fillStyle = '#000000';
  [
    [0, 0],
    [W - cellW, 0],
    [0, H - cellH],
    [W - cellW, H - cellH],
  ].forEach(([x, y]) => drawQuarterCell(ctx, cat, x, y, cellW, cellH, sizeOptions.noPrice));

  // خط القص: نقطتين في النص. **مابيلمسش حرف الورقة** — بيبدأ وينتهي عند
  // الهامش الآمن زي باقي المحتوى، عشان الإزاحة ماتاكلش منه.
  const cutPad = mmToDots(SAFE_MARGIN_MM);
  ctx.fillStyle = '#000000';
  ctx.fillRect(Math.floor(W / 2) - 1, cutPad, 2, H - cutPad * 2);

  return shrinkToPrinterDots(hi.canvas, W, H);
}

// ============================================================
// ⭐ "مقسوم ٤" كنص (HTML) — زي باقي الملصقات
// ============================================================
// كان الملصق الوحيد اللي **مالوش نسخة نصّية**، فكان مجبور يترسم كصورة —
// وده اللي كان بيخلّيه يطلع منغمش على الورق وباقي الملصقات نضيفة (شوف
// مفتاح htmlLabels: النص بيترسم بمحرّك الطابعة على دقتها مباشرة، والصورة
// بتعدّي على إعادة رسم).
//
// وكان فيه عطل تاني جوّه: مقاس الرقم والسعر كان **مربوط بمقاس الاسم**
//     fitOne(code, Math.min(restH / LINE, nameSize))
// يعني اسم طويل = خط صغير = الرقم والسعر يصغّروا معاه، مع إن مالهمش ذنب.
//
// القاعدة هنا (اللي اتفقنا عليها):
//   • الرقم والسعر **مقاسهم ثابت** — مايتأثروش بالاسم خالص
//   • الاسم بياخد اللي فاضل: سطر لو قصير، سطرين لو طويل
//   • ولو لسه مش كافي → **نقط (…)** على اللي مش ظاهر
//
// ⚠️ النقط دي بتتحط بـCSS (`-webkit-line-clamp`) عن قصد هنا، عكس الملصق
// العادي اللي شيلناها منه. الفرق: هناك بنصغّر الخط لحد ما الاسم يدخل
// كامل (المساحة تسمح)، وهنا المساحة ربع اللاصقة — فالتصغير لحد ما يدخل
// بيوصّل لخط مايتقراش. النقط أنضف من اسم مايتقراش.
function buildQuarterLabelHTML(cat, sizeOptions, qrDataUrl, copies) {
  const { pageWidthMm, pageHeightMm } = sizeOptions;
  const copyCount = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(copies, 10) || 1));
  const cellW = pageWidthMm / 2;
  const cellH = pageHeightMm / 2;

  const name = String(cat.itemName || cat.name || '');
  const code = String(cat.barcodeNumber || '');
  const showPrice = !!cat.sellingPrice && !sizeOptions.noPrice;

  // نفس هوامش الصورة بالظبط: الحرف الخارجي بالهامش الكامل، والجوّاني
  // (اللي جنب خط القص) بثلاثة أرباعه — مافيش طابعة بتاكل من خط القص.
  const pad = SAFE_MARGIN_MM;
  const padX = SAFE_MARGIN_MM * 0.75;
  const gapX = 0.6;
  const LINE = 1.15;
  const contentH = cellH - pad * 2;

  // الباركود: مربعاته لازم تبقى عدد صحيح من نقط الطابعة وإلا بيتلغبط.
  const qrMm = Math.min(contentH, dotsToMm(QUARTER_QR_DOTS_PER_MODULE * 21));
  const textW = cellW - qrMm - padX * 2 - gapX;

  // ------------------------------------------------------------
  // المقاسات: الرقم والسعر الأول (ثابتين)، والاسم بياخد الباقي
  // ------------------------------------------------------------
  const rows = 2 + 1 + (showPrice ? 1 : 0); // اسم(٢) + رقم + سعر
  const rowH = contentH / rows;
  const cap = rowH / LINE;

  const priceText = showPrice ? `${cat.sellingPrice} L.E` : '';
  const codeSize = Math.min(cap, fitWrappedFontSizeMm(code, textW, 1, true));
  const priceSize = showPrice ? Math.min(cap, fitWrappedFontSizeMm(priceText, textW, 1, true)) : 0;

  // اللي فاضل للاسم بعد ما الرقم والسعر خدوا حقهم
  const nameBudget = contentH - (codeSize + priceSize) * LINE;
  // سطر ولا سطرين؟ اللي بيطلّع خط أكبر — بالظبط زي الملصق العادي.
  let nameSize = 0;
  let nameLines = 1;
  for (let L = 1; L <= 2; L++) {
    const size = Math.min(nameBudget / (L * LINE), fitWrappedFontSizeMm(name, textW, L, true), cap);
    if (size > nameSize) { nameSize = size; nameLines = L; }
  }
  // ولو الخط نزل تحت حد القراءة، بنثبّته عند الحد ونسيب النقط تقص الزيادة
  const MIN_NAME_MM = dotsToMm(8);
  if (nameSize < MIN_NAME_MM) { nameSize = MIN_NAME_MM; nameLines = 2; }

  const cellHTML = `
      <div class="cell">
        ${qrDataUrl ? `<img class="q" src="${qrDataUrl}" alt="">` : '<div class="q"></div>'}
        <div class="t">
          <div class="n">${escapeHTML(name)}</div>
          <div class="c">${escapeHTML(code)}</div>
          ${showPrice ? `<div class="p">${escapeHTML(priceText)}</div>` : ''}
        </div>
      </div>`;

  const rowOfCells = `<div class="half">${cellHTML}${cellHTML}</div>`;

  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ملصق مقسوم - ${escapeHTML(name)}</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, Tahoma, sans-serif; width: ${pageWidthMm}mm; color: #000; line-height: ${LINE}; }
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; position: relative; ${printAlignCSS()} }
        .label + .label { page-break-before: always; break-before: page; }
        .half { height: ${cellH}mm; width: 100%; display: flex; }
        .cell {
          width: ${cellW}mm; height: ${cellH}mm;
          display: flex; align-items: center; gap: ${gapX}mm;
          padding: ${pad}mm ${padX}mm;
          overflow: hidden;
        }
        .q { width: ${qrMm.toFixed(2)}mm; height: ${qrMm.toFixed(2)}mm; flex: 0 0 ${qrMm.toFixed(2)}mm; display: block; }
        .t {
          flex: 1; min-width: 0; text-align: center;
          height: ${contentH.toFixed(2)}mm;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .t > * { flex: 0 0 auto; }
        /* ⭐ النقط: الاسم بس. الرقم والسعر مالهمش داعي — مقاسهم متقاس على
           عرضهم أصلًا فبيدخلوا دايمًا. */
        .n {
          font-size: ${nameSize.toFixed(2)}mm; font-weight: bold;
          overflow: hidden; overflow-wrap: anywhere; word-break: break-word;
          display: -webkit-box; -webkit-box-orient: vertical;
          -webkit-line-clamp: ${nameLines};
          max-height: ${(nameLines * LINE * nameSize).toFixed(2)}mm;
        }
        /* ⚠️ مفيش letter-spacing هنا عن قصد. العمود ضيق جدًا (7.5مم)،
           وقياس الخط مابيعرفش عن التباعد ده حاجة — فكان بيحسب إن الرقم
           داخل وهو بيتقص فعليًا على الشاشة. (الملصق العادي عمود أوسع
           فالتباعد فيه مايضرش.) */
        .c { font-size: ${codeSize.toFixed(2)}mm; font-weight: bold; white-space: nowrap; }
        .p { font-size: ${priceSize.toFixed(2)}mm; font-weight: bold; white-space: nowrap; }
        /* خط القص في النص — مابيلمسش حرف الورقة، بيبدأ وينتهي عند الهامش */
        .cut {
          position: absolute; top: ${pad}mm; bottom: ${pad}mm;
          left: 50%; width: 0.25mm; margin-left: -0.125mm; background: #000;
        }
      </style>
    </head>
    <body>${`<div class="label">${rowOfCells}${rowOfCells}<div class="cut"></div></div>`.repeat(copyCount)}</body>
    </html>
  `;
}

// بتبني "مقسوم ٤" بالطريقة المعتمدة (نص)، أو كصورة لو المستخدم قفل
// المفتاح — نفس شكل buildItemLabel و buildTextLabel بالظبط.
//
// ⚠️ أي شاشة عايزة تطبع مقسوم ٤ **لازم** تعدّي من هنا. متكتبش نسخة تانية —
// ده بالظبط اللي خلّى المسمّى يطلع بشكلين مختلفين قبل كده.
async function buildQuarterLabel(cat, sizeOptions, copies) {
  const n = Math.max(1, parseInt(copies, 10) || 1);
  if (!getPrintTweak('htmlLabels')) {
    const png = renderQuarterLabelPNG(cat, sizeOptions);
    if (png) {
      const d = labelDots(sizeOptions);
      return {
        previewHTML: wrapImageLabelPreviewHTML(png, d.w, d.h),
        jobHTML: wrapImageLabelHTML(png, sizeOptions, 1),
        fallbackHTML: wrapImageLabelHTML(png, sizeOptions, n),
        image: png,
        previewPx: d,
      };
    }
  }
  // مربع الباركود صغير هنا (ربع اللاصقة)، فبنطلبه بدقة تكفي من غير تضخيم
  const qrPx = Math.round(mmToDots(dotsToMm(QUARTER_QR_DOTS_PER_MODULE * 21)) * 3);
  const qrDataUrl = await generateQRDataURL(cat.barcodeNumber || cat.name, qrPx);
  const jobHTML = buildQuarterLabelHTML(cat, sizeOptions, qrDataUrl, 1);
  return {
    previewHTML: jobHTML,
    jobHTML,
    fallbackHTML: buildQuarterLabelHTML(cat, sizeOptions, qrDataUrl, n),
    image: null,
    previewPx: null,
  };
}

// ملصق الدرجة كصورة كمان — نفس السبب بالظبط: نص بس، بس المحرك التاني
// بيقسّمه بمقاسات مختلفة فبيتقص.
function renderGradeLabelPNG(categoryName, gradeLabel, sizeOptions) {
  const { pageWidthMm, pageHeightMm } = sizeOptions;
  const halves = sizeOptions.halves || 1;
  const W = Math.round(mmToDots(pageWidthMm));
  const H = Math.round(mmToDots(pageHeightMm));
  const halfH = Math.round(H / halves);

  const hi = makeHiResCanvas(W, H);
  if (!hi) return '';
  const ctx = hi.ctx;

  const FAMILY = 'Tahoma, Arial, sans-serif';
  const line1 = String(categoryName || '');
  const line2 = String(gradeLabel || '');
  // الهامش الآمن على حرف الورقة بس — خط القص اللي في النص مش حرف
  const outer = mmToDots(SAFE_MARGIN_MM);
  const inner = mmToDots(halves > 1 ? 0.6 : SAFE_MARGIN_MM);
  const pad = outer;
  const availW = W - mmToDots(SAFE_MARGIN_MM) * 2;
  const availH = halfH - outer - inner;
  const LINE = 1.2;

  for (let h = 0; h < halves; h++) {
    const top = h * halfH;
    const topOffset = h === 0 ? outer : inner;

    let chosen = null;
    for (let maxLines = 1; maxLines <= 2; maxLines++) {
      const byHeight = availH / ((maxLines + 1) * LINE);
      const fit = fitCanvasFont(ctx, line1, availW, maxLines, LABEL_WEIGHT, FAMILY, byHeight);
      if (!chosen || fit.size > chosen.size) chosen = fit;
    }
    const n1 = chosen.lines.length;
    const byHeight = availH / ((n1 + 1) * LINE);
    // مقاسات بأعداد صحيحة من نقط الطابعة — الشرح في renderLabelPNG
    const size1 = Math.max(6, Math.round(Math.min(chosen.size, byHeight)));
    const fit2 = fitCanvasFont(ctx, line2, availW, 1, LABEL_WEIGHT, FAMILY, byHeight);
    const size2 = Math.max(6, Math.round(Math.min(fit2.size, byHeight)));

    const lineH = availH / (n1 + 1);
    // المحتوى في نص النصف رأسيًا
    const blockH = lineH * (n1 + 1);
    let y = top + topOffset + (availH - blockH) / 2;
    y += drawLines(ctx, chosen.lines, size1, LABEL_WEIGHT, FAMILY, W / 2, y, lineH);
    drawLines(ctx, fit2.lines.length ? fit2.lines : [line2], size2, LABEL_WEIGHT, FAMILY, W / 2, y, lineH);
  }

  return shrinkToPrinterDots(hi.canvas, W, H);
}

// بتلفّ الصورة في صفحة HTML بمقاس الملصق — للمعاينة ولنافذة طباعة
// المتصفح (لما QZ مش موجود). الصورة هي هي في الحالتين.
function wrapImageLabelHTML(dataUrl, sizeOptions, copies) {
  const { pageWidthMm, pageHeightMm } = sizeOptions;
  const copyCount = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(copies, 10) || 1));
  const one = `<div class="label"><img src="${dataUrl}" alt=""></div>`;
  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ملصق</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body { width: ${pageWidthMm}mm; }
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; ${printAlignCSS()} }
        .label + .label { page-break-before: always; break-before: page; }
        .label img { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; display: block; image-rendering: pixelated; }
      </style>
    </head>
    <body>${one.repeat(copyCount)}</body>
    </html>
  `;
}

// ============================================================
// 🔍 نسخة المعاينة — بمقاس بكسلات الصورة الحقيقي
// ============================================================
// ⚠️ ليه دي موجودة أصلًا؟
//
// المعاينة كانت بتوري الصورة **منغمشة** حتى لما الملصق المطبوع يطلع نضيف.
// السبب مش في الصورة، السبب في طريقة عرضها:
//
//   الصورة الحقيقية    = 304 بكسل عرض
//   المتصفح بيعرضها بـ 38 مم = 143.6 بكسل   ← بيرمي نص البكسلات!
//   وبعدين المعاينة بتكبّر اللي فضل 12 ضعف   ← بتكبّر التلف
//
// يعني كنا بنضيّع نص الصورة وبعدين نضخّم الباقي. الحل إن المعاينة تعرض
// الصورة **بمقاسها الحقيقي بالبكسل** وتكبّرها من غير ما ترميها الأول.
function wrapImageLabelPreviewHTML(dataUrl, widthPx, heightPx) {
  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>معاينة</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { width: ${widthPx}px; height: ${heightPx}px; background: #fff; }
        img { width: ${widthPx}px; height: ${heightPx}px; display: block; image-rendering: pixelated; }
      </style>
    </head>
    <body><img src="${dataUrl}" alt=""></body>
    </html>
  `;
}

function buildLabelHTML(cat, sizeOptions, qrDataUrl, copies) {
  const { pageWidthMm, pageHeightMm, halves } = sizeOptions;
  const halfHeight = pageHeightMm / (halves || 1);
  const copyCount = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(copies, 10) || 1));

  const name = String(cat.itemName || cat.name || '');

  // ------------------------------------------------------------
  // السعر: السعر المشطوب بيظهر **بس لو فيه خصم فعلي**
  // ------------------------------------------------------------
  // كان بيتكتب "85 L.E مشطوب  85 L.E" على أصناف مالهاش خصم أصلًا — رقم
  // مكرر مشطوب جنب نفسه، بياخد نص عرض اللاصقة ومالوش أي معنى، وبيصغّر
  // السعر الحقيقي عشان يفضلّه مكان.
  const sellNum = Number(cat.sellingPrice) || 0;
  const origNum = Number(cat.originalPrice) || 0;
  const hasDiscount = origNum > 0 && origNum !== sellNum;
  const showPrice = !!cat.sellingPrice && !sizeOptions.noPrice;
  const priceHTML = showPrice
    ? `<div class="price">${
        hasDiscount ? `<s>${escapeHTML(cat.originalPrice)} L.E</s>` : ''
      }<b>${escapeHTML(cat.sellingPrice)} L.E</b></div>`
    : '';

  // ------------------------------------------------------------
  // ⭐ الهامش الآمن **بره بس** — الخط اللي في النص مش حرف ورق
  // ------------------------------------------------------------
  // الطابعة بتلعب 1-1.5مم وهي بتسحب الورق، فأي محتوى أقرب من كده لحرف
  // اللاصقة بيتاكل (اتصوّر على ورق: "Hejap Kuwaiti 12(").
  //
  // بس ده بينطبق على **حروف الورقة** بس — فوق أول نص وتحت تاني نص.
  // الخط اللي بينهم في النص ده مجرد مكان القص، مافيش طابعة بتاكل منه
  // حاجة. لما كنا بنحط 2مم على الأربع جهات كنا بنضيّع 8مم من 25 من غير
  // أي سبب، والباركود كان بيصغّر لـ8مم عشانهم.
  //
  // دلوقتي: 2مم على الحرف الخارجي، و0.6مم بس على خط القص (كفاية إن
  // الكلام مايلزقش في بعضه) — والباركود رجع 9.5مم.
  const OUTER_MM = SAFE_MARGIN_MM;
  const INNER_MM = halves > 1 ? 0.6 : SAFE_MARGIN_MM;
  const pad = OUTER_MM;
  const LINE = 1.2;
  const contentH = halfHeight - OUTER_MM - INNER_MM;

  // ------------------------------------------------------------
  // ⭐ هامش حقيقي حوالين الـQR — سبب "الباركود متاكل منه حتة"
  // ------------------------------------------------------------
  // قِسنا الشكل القديم: الـQR كان **بالظبط** بمقاس المساحة المتاحة له
  // (فرق 0.002 ملم بس!). يعني صفر تحمّل لأي تقريب.
  //
  // والتقريب حاصل إجباري: محرك العرض بيحوّل الملليمترات لبكسلات، والطابعة
  // بتحوّلها لنقط (0.125 ملم للنقطة الواحدة). أي كسر بيتقرّب، والنتيجة إن
  // صف أو عمود من مربعات الـQR بيتقطع من الحرف.
  //
  // وقطع حرف الـQR مش زي قطع حرف من صورة عادية: الحروف دي هي **نمط
  // التوقيت** اللي القارئ بيبني عليه شبكة المربعات كلها. فقطع صف واحد
  // بيخلي القراءة صعبة جدًا — بالظبط اللي كان بيحصل.
  //
  // الحل: بنقلّل الحشو من 0.6 لـ0.4 ملم (فبتزيد المساحة المتاحة)، وبنسيب
  // 0.4 ملم فاضيين حوالين الـQR. كده حجم المربعات **مايتغيّرش خالص**
  // (نفس 10.7 ملم اللي كانت شغّالة)، بس بقى فيه فسحة تستحمل التقريب.
  const QR_SLACK_MM = 0.4;
  const qrBox = Math.min(contentH - QR_SLACK_MM, 11);

  // ------------------------------------------------------------
  // ⭐ الـQR بعيد عن حرف اللاصقة الشمال
  // ------------------------------------------------------------
  // الحشو الجانبي كان 0.4 ملم بس، والـQR أول حاجة على الشمال — فأي زحلقة
  // بسيطة في تغذية الورق (أو حرف اللاصقة نفسه المدوّر) كانت بتاكل عمود من
  // مربعاته. والعمود ده من نمط التصويب، فالقارئ بيتوه.
  //
  // 1.2 ملم على الجانبين = تلات أضعاف اللي كان. والعرض 38 ملم، فالمساحة
  // الباقية للنص لسه أكتر من كفاية (24 ملم).
  const padX = SAFE_MARGIN_MM;
  const gapX = 0.8;
  const textW = pageWidthMm - qrBox - padX * 2 - gapX;

  const otherLines = 1 + (showPrice ? 1 : 0); // الباركود + السعر
  const codeText = String(cat.barcodeNumber || '');
  const priceText = cat.sellingPrice ? `${cat.sellingPrice} L.E` : '';
  const oldPriceText = hasDiscount ? `${cat.originalPrice} L.E` : '';
  // السعر المشطوب والسعر الحقيقي في نفس السطر، فبنقيسهم مع بعض.
  const priceLineText = (oldPriceText ? oldPriceText + '  ' : '') + priceText;

  // ============================================================
  // ⭐ توزيع الارتفاع: كل سطر بمقاسه هو، والتصغير **بالنسبة** لو زنقنا
  // ============================================================
  // العطل اللي اتصوّر على ورق: صنف اسمه طويل ("Biotherm whitening Cream
  // senstive Area 100g offer") طلع بكل كلامه صغير — حتى الرقم والسعر
  // القصيّرين. السبب إن الطريقة القديمة كانت بتقسّم الارتفاع على عدد
  // السطور **بالتساوي**: الاسم لما ياخد سطرين بدل سطر، عدد السطور يبقى 4
  // بدل 3، فنصيب كل سطر ينزل من 2.75مم لـ2.06 — والرقم والسعر بيدفعوا
  // التمن مع إنهم مالهمش ذنب.
  //
  // دلوقتي:
  //   • كل عنصر ليه "مقاسه الطبيعي" = أكبر خط يخلّيه يدخل في **عرضه هو**
  //     (والاسم كمان محكوم بسقف 2.7مم عشان مايبقاش أكبر من اللزوم).
  //   • الرقم والسعر ليهم سقف نسبي من نصيب السطر الواحد — الرقم أقل
  //     شوية لأنه خطة الطوارئ، والسعر أعلى لأنه أهم رقم للزبون.
  //   • لو مجموع الطبيعي عدّى الارتفاع المتاح، **الكل** بيصغّر بنفس
  //     النسبة. يعني الاسم الطويل بيدفع نصيبه بس، مش بيجرّ الباقي معاه.
  //
  // وبنجرّب سطر/سطرين/تلاتة للاسم وناخد اللي بيطلّع أكبر خط للاسم — فده
  // بياخد السطر التالت **بس** لما يبقى مكسب فعلي، مش كل مرة.
  const evenShare = contentH / ((1 + otherLines) * LINE); // نصيب السطر لو الاسم سطر واحد
  const CODE_SHARE = 0.88;  // الرقم: خطة الطوارئ لو الباركود مارضيش يتقرا
  const PRICE_SHARE = 0.95; // السعر: أهم رقم للزبون
  const codeNat = Math.min(evenShare * CODE_SHARE, fitWrappedFontSizeMm(codeText, textW, 1, true));
  const priceNat = showPrice
    ? Math.min(evenShare * PRICE_SHARE, fitWrappedFontSizeMm(priceLineText, textW, 1, true))
    : 0;
  const otherH = (codeNat + priceNat) * LINE;

  let best = { lines: 1, size: 0, factor: 1 };
  for (let L = 1; L <= 3; L++) {
    const nat = Math.min(2.7, fitWrappedFontSizeMm(name, textW, L, true));
    const needed = L * nat * LINE + otherH;
    if (needed <= contentH) {
      // فيه مكان للكل بمقاسه الطبيعي — الفاضل بيبقى فراغ وخلاص
      if (nat > best.size + 1e-6) best = { lines: L, size: nat, factor: 1 };
      continue;
    }
    let factor = contentH / needed;
    let size = nat * factor;
    // ------------------------------------------------------------
    // ⭐ لما نزنق، **الاسم** هو اللي يتنازل — مش الرقم والسعر
    // ------------------------------------------------------------
    // الاسم على سطرين بمقاس السطر الواحد بياخد ضِعف الارتفاع، فلو سبناه
    // بيجرّ الرقم والسعر تحته. القاعدة: الرقم والسعر عمرهم ما يبقوا أصغر
    // من الاسم. لو ده حصل، بنعيد الحساب والاسم مربوط بمقاس الرقم —
    // فالتلاتة بيوصلوا لتوازن بدل ما الاسم ياكل من نصيبهم.
    if (size > codeNat * factor) {
      factor = contentH / ((L * codeNat + codeNat + priceNat) * LINE);
      size = Math.min(nat, codeNat * factor);
    }
    if (size > best.size + 1e-6) best = { lines: L, size, factor };
  }
  const nameLines = best.lines;
  const nameSize = best.size;
  const codeSize = codeNat * best.factor;
  const priceSize = priceNat * best.factor;
  const oldPriceSize = priceSize * 0.8;

  const qrHTML = qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="">` : '<div class="qr"></div>';

  const halfHTML = `
      <div class="half">
        ${qrHTML}
        <div class="txt">
          <div class="name">${escapeHTML(name)}</div>
          <div class="code">${escapeHTML(cat.barcodeNumber || '')}</div>
          ${priceHTML}
        </div>
      </div>`;

  return `
    <!doctype html>
    <html dir="ltr" lang="en">
    <head>
      <meta charset="UTF-8">
      <title>ملصق - ${escapeHTML(name)}</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, Helvetica, Tahoma, sans-serif;
          width: ${pageWidthMm}mm;
          color: #000; line-height: ${LINE};
        }
        .label {
          width: ${pageWidthMm}mm; height: ${pageHeightMm}mm;
          overflow: hidden;
          ${printAlignCSS()}
        }
        .label + .label { page-break-before: always; break-before: page; }
        .half {
          height: ${halfHeight}mm; width: 100%;
          display: flex; align-items: center; gap: ${gapX}mm;
          padding: ${OUTER_MM}mm ${padX}mm ${INNER_MM}mm;
          overflow: hidden;
        }
        /* النص التاني مقلوب: الهامش الكبير بقى تحت (على حرف الورقة)
           والصغير فوق (على خط القص). الارتفاع المتاح واحد في الحالتين،
           فمقاس الخط واحد — الفرق مكان الفراغ بس. */
        .half + .half { padding: ${INNER_MM}mm ${padX}mm ${OUTER_MM}mm; }
        .qr { width: ${qrBox}mm; height: ${qrBox}mm; flex: 0 0 ${qrBox}mm; display: block; }
        /* ⭐ عمود النص بنفس ارتفاع الكود بالظبط، والسطور بتتوزّع فيه.
           كده أول سطر بيبدأ مع حرف الكود العلوي وآخر سطر بينتهي مع
           السفلي. قبل كده كان متمركز رأسيًا، فلما يكون أقصر من الكود
           كان بيبان نازل عنه شوية. */
        .txt {
          flex: 1; min-width: 0; text-align: center;
          height: ${contentH.toFixed(2)}mm;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        /* ⚠️ الأسطر ماينضغطوش. من غير ده، لو مجموع ارتفاعهم عدّى العمود
           بكسر بسيط، الفليكس بيضغطهم والاسم بيتقص من تحت. */
        .txt > * { flex: 0 0 auto; }
        /* ⚠️ مفيش -webkit-line-clamp هنا عن قصد.
           هي اللي كانت بتحط "…" مكان باقي الاسم. دلوقتي حجم الخط متقاس
           على التقسيم الحقيقي، فالاسم بيدخل كامل — ولو حصلت مفاجأة على
           جهاز غريب، اسم متزنوق شوية أحسن من اسم ناقص. */
        .name {
          font-size: ${nameSize.toFixed(2)}mm; font-weight: bold;
          overflow-wrap: anywhere; word-break: break-word;
          max-height: ${(nameLines * LINE * nameSize).toFixed(2)}mm;
          overflow: hidden;
        }
        /* الرقم bold: على الطابعة الحرارية الخط الرفيع بيطلع باهت ومتقطّع،
           والرقم ده هو خطة الطوارئ لو الباركود مارضيش يتقرا — فلازم يبان. */
        .code { font-size: ${codeSize.toFixed(2)}mm; letter-spacing: 0.15mm; font-weight: bold; }
        /* ⚠️ الفراغ ده رقم ثابت عن قصد. كان مربوط بالحشو، فلما كبّرنا
           الحشو الآمن بقى 4مم بين السعرين جوه عمود عرضه 24 — والسعر
           اضطر يصغّر عشانه. */
        .price { display: flex; justify-content: center; align-items: baseline; gap: 1.2mm; white-space: nowrap; }
        .price s { font-weight: normal; font-size: ${oldPriceSize.toFixed(2)}mm; }
        .price b { font-weight: bold; font-size: ${priceSize.toFixed(2)}mm; }
      </style>
    </head>
    <body>${`<div class="label">${halfHTML.repeat(halves || 1)}</div>`.repeat(copyCount)}</body>
    </html>
  `;
}

// بتبني ملصق الصنف بالطريقة المعتمدة (صورة)، أو بالطريقة القديمة (HTML)
// لو المستخدم فتح مفتاح الرجوع لها.
//
// بترجّع { previewHTML, jobHTML, image } — والـimage بتتبعت لـQZ مباشرة
// لما تكون موجودة.
async function buildItemLabel(cat, sizeOptions, copies) {
  if (!getPrintTweak('htmlLabels')) {
    const png = renderLabelPNG(cat, sizeOptions);
    if (png) {
      return {
        previewHTML: wrapImageLabelPreviewHTML(png, labelDots(sizeOptions).w, labelDots(sizeOptions).h),
        jobHTML: wrapImageLabelHTML(png, sizeOptions, 1),
        fallbackHTML: wrapImageLabelHTML(png, sizeOptions, copies),
        image: png,
        previewPx: labelDots(sizeOptions),
      };
    }
  }
  const qrPx = Math.round((sizeOptions.pageHeightMm / (sizeOptions.halves || 1)) * 16);
  const qrDataUrl = await generateQRDataURL(cat.barcodeNumber || cat.name, qrPx);
  return {
    previewHTML: buildLabelHTML(cat, sizeOptions, qrDataUrl, 1),
    jobHTML: buildLabelHTML(cat, sizeOptions, qrDataUrl, 1),
    fallbackHTML: buildLabelHTML(cat, sizeOptions, qrDataUrl, copies),
    image: null,
  };
}

// ============================================================
// ⭐ الملصق النصّي (سطرين) — **نقطة واحدة** لكل اللي بيطبعوه
// ============================================================
// الملصق ده بيتطبع من تلات أماكن: "طباعة مسمّى" في شاشة الفئات، ورمز 🖨️
// جنب الدرجة، وشاشة الطباعة (السلة).
//
// ⚠️⚠️ العطل اللي خلّى الدالة دي تتكتب: التلاتة كانوا **كل واحد بينفّذ
// نفس المنطق لوحده**. اتنين منهم بيبصّوا على مفتاح "ابعت الملصق كنص"
// والتالت (شاشة الطباعة) نسي — فنفس المسمّى بالظبط كان يطلع **نضيف** لو
// طبعته من شاشة الفئات و**منغمش** لو طبعته من شاشة الطباعة.
//
// ده مش عطل غريب، ده نتيجة طبيعية لتكرار المنطق: أي مفتاح جديد لازم
// يتضاف في تلات أماكن، وأول ما واحد يتنسي يحصل اختلاف صامت.
//
// فأي حاجة بتطبع ملصق نصّي **لازم** تعدّي من هنا. متكتبش نسخة تانية.
//
// بترجّع نفس شكل buildItemLabel بالظبط عشان الاتنين يتعاملوا بنفس الطريقة.
function buildTextLabel(line1, line2, sizeOptions, copies) {
  const n = Math.max(1, parseInt(copies, 10) || 1);
  if (!getPrintTweak('htmlLabels')) {
    const png = renderGradeLabelPNG(line1, line2, sizeOptions);
    if (png) {
      const d = labelDots(sizeOptions);
      return {
        previewHTML: wrapImageLabelPreviewHTML(png, d.w, d.h),
        jobHTML: wrapImageLabelHTML(png, sizeOptions, 1),
        fallbackHTML: wrapImageLabelHTML(png, sizeOptions, n),
        image: png,
        previewPx: d,
      };
    }
    // الرسم فشل (متصفح من غير canvas) → بنكمّل على النص بدل ورق فاضي
  }
  const jobHTML = buildGradeLabelHTML(line1, line2, sizeOptions, 1);
  return {
    previewHTML: jobHTML,
    jobHTML,
    fallbackHTML: buildGradeLabelHTML(line1, line2, sizeOptions, n),
    image: null,
    previewPx: null,
  };
}

async function printLabel(cat, sizeOptions) {
  const copies = sizeOptions.copies || 1;
  const built = await buildItemLabel(cat, sizeOptions, copies);

  // المعاينة بتوري لاصقة واحدة بس (مفيش فايدة من عرض 20 نسخة متطابقة)،
  // واللي بيتطبع فعلًا هو العدد اللي طلبته.
  // previewPx بتقول للمعاينة تعرض الصورة بمقاسها الحقيقي بالبكسل
  const approved = await showPrintPreview(
    built.previewHTML,
    { ...sizeOptions, previewPx: built.previewPx },
    copies
  );
  if (!approved) return;

  // لكل نسخة صفحة مستقلة (مصفوفة) عشان QZ ما يحشرهمش في لاصقة واحدة،
  // ومستند واحد بفواصل صفحات للطريقة العادية (نافذة المتصفح).
  const jobs = [{ html: built.jobHTML, image: built.image, copies }];
  await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', built.fallbackHTML);
}

// ------------------------------------------------------------
// ملصق الدرجة — تصميم مختلف تمامًا عن ملصق الصنف
// ------------------------------------------------------------
// ده مأخوذ من صورة الملصق الحقيقي اللي بتطبعه على ماكينة الباركود:
// **نص بس**، سطرين في نص اللاصقة:
//
//        كريب سادة لوكس
//           درجة 56
//
// من غير QR ولا رقم باركود ولا أسعار خالص — ده ملصق تعريف للطبعة، مش
// ملصق سعر. والاسم بيتاخد من **اسم الفئة بالعربي** (مش الاسم الإنجليزي
// بتاع الكاشير).

// ============================================================
// قياس الخط — أكبر حجم يخلي النص **كامل** يدخل
// ============================================================
// ⚠️ درس اتعلمناه من ملصقات اتطبعت غلط فعلًا:
//
// الطريقة القديمة كانت بتقيس النص على **سطر واحد**، وبعدين لو مش داخل
// بتقول "خلاص هينقسم سطرين" وتكبّر الخط ×1.85 — رقم متخمّن مبني على إن
// الاسم هينقسم نصين متساويين.
//
// والعربي (والإنجليزي) مابينقسمش متساوي. "طباقيه كويتى كباسين" بتتقسم
// "طباقيه كويتى" / "كباسين" — السطر الأول أطول من النص بكتير، فبيطلع بره
// المساحة، والمتصفح بيقصّه ويحط "…" مكان باقي الاسم.
//
// الطريقة دي بتقيس **التقسيم الحقيقي**: بتجرّب حجم، تشوف النص بيتقسم كام
// سطر فعليًا بالعرض المتاح، وتدوّر على أكبر حجم بيدخل في عدد السطور
// المسموح. مفيش تخمين خالص.
const FIT_REF_PX = 100; // بنقيس عند 100px ونحسب النسبة

// هامش أمان 4%: القياس بيحصل في كروم بخط Tahoma، لكن اللي بيرسم الملصق
// وقت الطباعة ممكن يكون محرك تاني بخط بديل مقاساته مختلفة شوية. الـ4% دي
// بتستحمل الفرق ده — وده سبب "الاسم بيتاكل على جهاز تاني".
const FIT_SAFETY = 0.96;

function fitMeasureCtx(bold) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${bold ? 'bold ' : ''}${FIT_REF_PX}px Tahoma, Arial, sans-serif`;
  return ctx;
}

// بتحسب النص بياخد كام سطر لو عرض السطر = budget (بوحدات القياس المرجعية).
// بتحاكي سلوك المتصفح: بيقسّم عند المسافات، ولو كلمة واحدة أطول من السطر
// كله بيكسرها جوّه (عشان عندنا overflow-wrap: anywhere).
function wrappedLineCount(wordWidths, spaceW, budget) {
  if (!(budget > 0)) return Infinity;
  let lines = 1;
  let cur = 0;

  for (let i = 0; i < wordWidths.length; i++) {
    const w = wordWidths[i];
    const add = cur === 0 ? w : spaceW + w;

    if (cur + add <= budget) {
      cur += add;
      continue;
    }

    // الكلمة بتدخل سطر لوحدها → سطر جديد
    if (w <= budget) {
      lines++;
      cur = w;
      continue;
    }

    // كلمة أطول من السطر كله → بتتكسر جوّه على أكتر من سطر
    if (cur > 0) lines++;
    const full = Math.floor(w / budget);
    lines += full - 1;
    cur = w - full * budget;
    if (cur === 0) cur = budget;
    else lines++;
  }

  return lines;
}

// أكبر حجم خط (مم) يخلي النص يدخل **كامل** في maxLines سطر بالعرض ده.
function fitWrappedFontSizeMm(text, maxWidthMm, maxLines, bold) {
  const str = String(text || '').trim();
  const lines = Math.max(1, maxLines || 1);
  if (!str) return maxWidthMm;

  try {
    const ctx = fitMeasureCtx(bold);
    const words = str.split(/\s+/).filter(Boolean);
    const wordWidths = words.map((w) => ctx.measureText(w).width);
    const spaceW = ctx.measureText(' ').width;
    const total = ctx.measureText(str).width;
    if (!total) return maxWidthMm;

    const usableMm = maxWidthMm * FIT_SAFETY;

    // سطر واحد → معادلة مباشرة، مفيش داعي لأي بحث
    const oneLine = (usableMm * FIT_REF_PX) / total;
    if (lines === 1) return oneLine;

    // أكتر من سطر: أكبر حجم ممكن نظريًا هو اللي بيملا كل السطور، وأقل
    // حاجة هي حجم السطر الواحد. بنبحث بينهم عن أكبر واحد فعلًا بيدخل.
    let lo = oneLine;
    let hi = oneLine * lines;
    // budget بوحدات القياس المرجعية عند حجم s (مم): usableMm * REF / s
    const fits = (s) => wrappedLineCount(wordWidths, spaceW, (usableMm * FIT_REF_PX) / s) <= lines;
    if (!fits(hi)) {
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      return lo;
    }
    return hi;
  } catch (err) {
    // آخر خط دفاع: تقدير خشن. أصغر من اللازم أحسن من أكبر — الأصغر
    // بيطلع اسم كامل بخط صغير، والأكبر بيطلع اسم ناقص.
    return (maxWidthMm * lines) / Math.max(1, str.length) * 1.6;
  }
}

// بتختار بين "سطر واحد" و"سطرين" للاسم: بتحسب حجم الخط الناتج في
// الحالتين وتاخد الأكبر.
//
// ليه مش دايمًا سطرين؟ لأن السطرين بياخدوا ارتفاع أكتر، فنصيب السطر
// الواحد من الارتفاع بيقل. الاسم القصير بيطلع أكبر وأوضح في سطر واحد.
// ⭐ بنجرّب لحد **تلات** سطور للاسم.
// السبب: الاسم الطويل على سطرين بيضطر الخط يصغّر جدًا. السطر التالت
// بيدّي الحروف مساحة أكبر — بس بيتاخد **بس** لو طلّع خط أكبر فعلًا،
// لأن السطر الزيادة بياكل من ارتفاع السطور التانية.
function pickNameLayout(name, widthMm, contentH, lineHeight, otherLines, capMm) {
  let best = { lines: 1, size: 0 };
  for (let lines = 1; lines <= 3; lines++) {
    const byHeight = contentH / ((lines + otherLines) * lineHeight);
    const byWidth = fitWrappedFontSizeMm(name, widthMm, lines, true);
    const size = Math.min(byHeight, byWidth, capMm || Infinity);
    if (size > best.size) best = { lines, size };
  }
  return best;
}

// gradeLabel = النص اللي هيتكتب في السطر التاني: "درجة 56" للدرجات
// المرقّمة، أو الاسم نفسه ("أبيض") للدرجات الأساسية.
function buildGradeLabelHTML(categoryName, gradeLabel, sizeOptions, copies) {
  const { pageWidthMm, pageHeightMm, halves } = sizeOptions;
  const halfHeight = pageHeightMm / (halves || 1);
  const copyCount = Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(copies, 10) || 1));

  // هامش أمان زي ملصق الصنف بالظبط: كبير على حرف الورقة، صغير على خط
  // القص اللي في النص. (شوف الشرح المطوّل في buildLabelHTML)
  const OUTER_MM = SAFE_MARGIN_MM;
  const INNER_MM = halves > 1 ? 0.6 : SAFE_MARGIN_MM;
  const pad = OUTER_MM;
  const availableW = pageWidthMm - SAFE_MARGIN_MM * 2;
  const availableH = halfHeight - OUTER_MM - INNER_MM;

  const line1 = String(categoryName || '');
  const line2 = String(gradeLabel || '');

  // اسم الفئة الطويل بيتقسم على سطرين بدل ما يتقطع أو يخرج بره اللاصقة.
  const LINE = 1.2;
  const layout = pickNameLayout(line1, availableW, availableH, LINE, 1, null);
  const nameLines = layout.lines;
  const size1 = layout.size;
  const byHeight = availableH / ((nameLines + 1) * LINE);
  const size2 = Math.min(byHeight, fitWrappedFontSizeMm(line2, availableW, 1, true));

  const halfHTML = `
      <div class="half">
        <div class="l1">${escapeHTML(line1)}</div>
        <div class="l2">${escapeHTML(line2)}</div>
      </div>`;

  return `
    <!doctype html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>ملصق ${escapeHTML(gradeLabel)}</title>
      <style>
        @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Tahoma, Arial, sans-serif; width: ${pageWidthMm}mm; color: #000; }
        .label { width: ${pageWidthMm}mm; height: ${pageHeightMm}mm; overflow: hidden; ${printAlignCSS()} }
        .label + .label { page-break-before: always; break-before: page; }
        .half {
          height: ${halfHeight}mm; width: 100%;
          padding: ${OUTER_MM}mm ${SAFE_MARGIN_MM}mm ${INNER_MM}mm;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; overflow: hidden;
        }
        /* النص التاني مقلوب — الهامش الكبير على حرف الورقة السفلي */
        .half + .half { padding: ${INNER_MM}mm ${SAFE_MARGIN_MM}mm ${OUTER_MM}mm; }
        .l1, .l2 { font-weight: bold; line-height: ${LINE}; }
        /* ⚠️ مفيش -webkit-line-clamp — شوف الشرح في ملصق الصنف فوق. */
        .l1 {
          font-size: ${size1.toFixed(2)}mm;
          overflow-wrap: anywhere; word-break: break-word;
          max-height: ${(nameLines * LINE * size1).toFixed(2)}mm;
          overflow: hidden;
        }
        .l2 { white-space: nowrap; }
        .l2 { font-size: ${size2.toFixed(2)}mm; }
      </style>
    </head>
    <body>${`<div class="label">${halfHTML.repeat(halves || 1)}</div>`.repeat(copyCount)}</body>
    </html>
  `;
}

async function printGradeLabels(cat, sizeOptions) {
  const picks = state.grades
    .map((g) => ({ grade: g, qty: (state.gradeLabelQty || {})[g.id] || 0 }))
    .filter((p) => p.qty > 0);

  if (!picks.length) return;

  // ⭐ نفس بنّاء الملصق النصّي اللي بتستخدمه كل الشاشات — شوف buildTextLabel
  const buildOne = (label, copies) => {
    const b = buildTextLabel(cat.name, label, sizeOptions, copies);
    return {
      html: copies > 1 ? b.fallbackHTML : b.jobHTML,
      preview: b.image ? b.previewHTML : null,
      image: b.image,
    };
  };

  const nameOf = (g) => gradeLabelText(g, sizeOptions.withGroup);

  // المعاينة بتوري أول درجة محدّدة كنموذج
  const first = buildOne(nameOf(picks[0].grade), 1);
  const total = picks.reduce((s, p) => s + p.qty, 0);
  const approved = await showPrintPreview(
    first.preview || first.html,
    { ...sizeOptions, previewPx: first.image ? labelDots(sizeOptions) : null },
    total
  );
  if (!approved) return;

  // كل لاصقة صفحة مستقلة عند QZ (مصفوفة)، عشان ما يحشرش أكتر من واحدة
  // في نفس اللاصقة.
  const built = picks.map((p) => ({ ...buildOne(nameOf(p.grade), 1), copies: p.qty }));
  const jobs = built.map((x) => ({ html: x.html, image: x.image, copies: x.copies }));

  // نسخة واحدة بفواصل صفحات لنافذة طباعة المتصفح (بتتعامل مع مستند واحد).
  const bodies = [];
  built.forEach((x) => {
    const body = extractLabelBody(x.html);
    for (let i = 0; i < x.copies; i++) bodies.push(body);
  });
  const browserHTML = built[0].html.replace(/<body>[\s\S]*<\/body>/, `<body>${bodies.join('')}</body>`);

  await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', browserHTML);
}

// ------------------------------------------------------------
// ✍️ طباعة مسمّى — ملصق نص حر
// ------------------------------------------------------------
// نفس تصميم ملصق الدرجة بالظبط (سطرين نص في نص اللاصقة، من غير QR ولا
// سعر)، بس النص بتكتبه إنت بإيدك بدل ما ييجي من الفئة والدرجة.
//
// الحاجة دي كانت بتتعمل بره النظام على برنامج الطابعة: أي ملصق تعريف
// (اسم مورّد، ملاحظة على كرتونة، "بضاعة مرتجعة") كان بيحتاج تفتح برنامج
// تاني وتظبّط المقاس من الأول. دلوقتي بياخد نفس مقاس وضبط ملصقاتنا.
function openCustomLabelDialog(opts) {
  const toCart = !!(opts && opts.toCart);
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:340px; width:100%; max-height:88vh; overflow:auto;">
      <div style="margin-bottom:12px; font-size:14px; font-weight:500; text-align:center;">✍️ طباعة مسمّى</div>
      <form id="custom-label-form">
        <div class="field">
          <label>السطر الأول</label>
          <input class="input" id="custom-line1" maxlength="60" placeholder="مثلًا: كريب سادة لوكس" required />
        </div>
        <div class="field">
          <label>السطر التاني (اختياري)</label>
          <input class="input" id="custom-line2" maxlength="60" placeholder="مثلًا: درجة 56" />
        </div>
        <div class="field">
          <label>عدد اللاصقات</label>
          <input class="input" type="number" id="custom-copies" value="1" min="1" max="1000" inputmode="numeric" />
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="btn btn-primary" type="submit">${toCart ? '➕ أضف للسلة' : '🖨️ كمّل'}</button>
          <button class="btn" type="button" id="custom-cancel">إلغاء</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => document.body.removeChild(overlay);
  document.getElementById('custom-cancel').addEventListener('click', close);
  const first = document.getElementById('custom-line1');
  if (first) first.focus();

  document.getElementById('custom-label-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const line1 = document.getElementById('custom-line1').value.trim();
    const line2 = document.getElementById('custom-line2').value.trim();
    const raw = parseInt(document.getElementById('custom-copies').value, 10);
    const copies = Math.max(1, Math.min(MAX_LABEL_COPIES, Number.isNaN(raw) ? 1 : raw));
    if (!line1 && !line2) return;
    close();
    if (toCart) {
      addCustomLabelToCart(line1, line2, copies);
      return;
    }
    safeAsync(() => printTextLabel(line1, line2, { ...LABEL_SIZE, copies }), 'طباعة المسمّى');
  });
}

// بتطبع ملصق نص حر (سطرين). نفس مسار ملصق الدرجة: صورة بمقاس نقط
// الطابعة، معاينة، وبعدين وظايف طباعة صغيرة.
async function printTextLabel(line1, line2, sizeOptions) {
  const copies = sizeOptions.copies || 1;
  const built = buildTextLabel(line1, line2, sizeOptions, copies);

  const approved = await showPrintPreview(
    built.previewHTML,
    { ...sizeOptions, previewPx: built.previewPx },
    copies
  );
  if (!approved) return;

  const jobs = [{ html: built.jobHTML, image: built.image, copies }];
  await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', built.fallbackHTML);
}

// ------------------------------------------------------------
// 🖨️ ملصق درجة واحدة من جوه الصف
// ------------------------------------------------------------
// وضع "ملصقات الدرجات" هدفه الطبعات الكبيرة: تدخل الوضع، تعلّم على 20
// درجة، تكتب عدد لكل واحدة، تخرج. لكن أكتر حاجة بتحصل فعلًا هي **درجة
// واحدة دلوقتي** — وكانت بتاخد نفس الخمس خطوات.
//
// الرمز ده بيختصرها: دوسة تفتح خانة عدد جوه نفس الصف، ودوسة تطبع.
async function printOneGradeLabel(gradeId, copies) {
  const cat = state.categories.find((c) => c.id === state.activeCategoryId);
  const g = state.grades.find((x) => x.id === gradeId);
  if (!cat || !g) return;
  // ⭐ الرمز ده **دايمًا** بيكتب اسم المجموعة لو الدرجة ليها مجموعة.
  // مش تابع لمفتاح: إنت واقف على الدرجة في قايمة مجموعتها، فالملصق
  // المفروض يقول نفس اللي شايفه على الشاشة.
  await printTextLabel(cat.name || '', gradeLabelText(g, true), {
    ...LABEL_SIZE,
    copies: Math.max(1, Math.min(MAX_LABEL_COPIES, copies || 1)),
  });
}

function extractLabelBody(fullHTML) {
  const match = fullHTML.match(/<body>([\s\S]*)<\/body>/);
  return match ? match[1] : '';
}
