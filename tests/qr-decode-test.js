// مقارنة عادلة: الطريقتين بيترسموا بنفس دقة الطابعة بالظبط (203 نقطة/بوصة).
//
// ⚠️ النقطة اللي غلّطت أول محاولة: المتصفح بيحوّل الملليمتر بـ96 نقطة/بوصة،
// يعني 38 مم = 143.6 بكسل مش 304. فلازم نظبّط deviceScaleFactor عشان
// الملصق يترسم بـ304 نقطة زي الطابعة بالظبط.
const { chromium } = require('playwright');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

const CODES = ['62808737','28144','12133','177555414','10632103','58047','8901234567890','999999999999'];
const DOTS_W = 304, DOTS_H = 200;         // 38×25 مم على 203 نقطة/بوصة
const CSS_W = 38 * 96 / 25.4;             // 143.6 بكسل CSS
const DSF = DOTS_W / CSS_W;               // 2.117
const QUIET = 30;

// الطابعة الحرارية بتفرد الحبر شوية — النقطة السودا بتكبر على جيرانها.
// ده بيضيّق المسافات البيضا وبيصعّب القراءة. بنحاكيه هنا عشان نشوف أنهي
// طريقة بتستحمل أكتر.
function inkSpread(data, W, H) {
  const src = Uint8Array.from(data);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y*W + x)*4;
    if (src[i] === 0) continue;
    let dark = false;
    for (let dy = -1; dy <= 1 && !dark; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x+dx, ny = y+dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      if (src[(ny*W+nx)*4] === 0) { dark = true; break; }
    }
    if (dark) { data[i]=data[i+1]=data[i+2]=90; }   // رمادي غامق = حبر مفرود
  }
}


// ⚠️ بندوّر على مكان الـQR في الصورة بدل ما نحسبه.
//
// أول نسختين من الفحص ده كانوا بيحسبوا المكان بمعادلة موازية لمعادلة
// النظام — وأول ما النظام حرّك المحتوى 2.4 نقطة، القص بقى بياكل حتة من
// الكود والفحص قال "القراءة فشلت 0/8" وإحنا فاكرين إن الملصق بايظ.
//
// الفحص اللي بيحسب المكان بنفسه بيكذب عليك أول ما التصميم يتغيّر.
// الفحص اللي **بيدوّر** بيفضل صادق.
function findQR(img, halfH) {
  // الـQR في الثلث الشمال من النصف العلوي، وهو أكبر كتلة سودا هناك
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  const limitX = Math.floor(img.width * 0.35);
  for (let y = 0; y < halfH; y++) {
    for (let x = 0; x < limitX; x++) {
      if (img.data[(y * img.width + x) * 4] < 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function decodeCrop(img, box, spread) {
  const W = box.w + QUIET*2, H = box.h + QUIET*2;
  const out = new PNG({ width: W, height: H });
  out.data.fill(255);
  for (let r = 0; r < box.h; r++) for (let c = 0; c < box.w; c++) {
    const sy = box.y + r, sx = box.x + c;
    if (sy < 0 || sy >= img.height || sx < 0 || sx >= img.width) continue;
    const si = (sy * img.width + sx) * 4, di = ((r+QUIET)*W + (c+QUIET))*4;
    // عتبة أبيض/أسود زي الطابعة الحرارية — مفيش رمادي
    const v = (img.data[si]+img.data[si+1]+img.data[si+2])/3 < 128 ? 0 : 255;
    out.data[di]=out.data[di+1]=out.data[di+2]=v; out.data[di+3]=255;
  }
  if (spread) inkSpread(out.data, W, H);
  const r = jsQR(new Uint8ClampedArray(out.data), W, H);
  return r && r.data;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof renderLabelPNG === 'function');
  const rows = [];

  for (const code of CODES) {
    const d = await p.evaluate(async (code) => {
      const opts = { pageWidthMm:38, pageHeightMm:25, halves:2 };
      const cat = { itemName:'Chanvie Leen 58047', barcodeNumber:code, originalPrice:620, sellingPrice:495 };
      const qr = await generateQRDataURL(code, 200);
      const best = buildBestQR(code);
      const mm = (v) => (v * 203) / 25.4;
      const halfH = Math.round(mm(25)/2);
      const contentH = halfH - mm(0.4)*2 - mm(0.6);
      const avail = Math.min(contentH - mm(0.4), mm(11));
      // ⚠️ المكان لازم يتحسب بنفس معادلة النظام بالظبط. أول مرة كنا
      // بنحسبه من pad وحده، والنظام بقى بيستخدم topOffset (هامش الأمان
      // نص فوق ونص تحت) — فالقص كان بيقطع حتة من الكود والقراءة بتفشل
      // 0/8 وإحنا فاكرين إن الملصق بايظ.
      const topOffset = mm(0.4) + mm(0.6) / 2;
      return { png: renderLabelPNG(cat, opts), html: buildLabelHTML(cat, opts, qr, 1),
               count: best.count, modulePx: Math.max(1, Math.floor(avail/best.count)),
               availDots: +avail.toFixed(2), pad: topOffset, padX: mm(1.6), contentH };
    }, code);

    // ---- الجديد: الصورة الأصلية بنقط الطابعة ----
    const nImg = PNG.sync.read(Buffer.from(d.png.split(',')[1], 'base64'));
    const qs = d.modulePx * d.count;
    const nBox = findQR(nImg, Math.round(nImg.height / 2));
    if (!nBox) throw new Error('مالقيناش الباركود في الصورة الجديدة');
    const newVal = decodeCrop(nImg, nBox, false);
    const newSpread = decodeCrop(nImg, nBox, true);

    // ---- القديم: HTML مرسوم بنفس دقة الطابعة ----
    const pg = await b.newPage({ viewport: { width: Math.round(CSS_W), height: 95 }, deviceScaleFactor: DSF });
    await pg.setContent(d.html.replace(/<script[\s\S]*?<\/script>/gi,''));
    const box = await pg.evaluate((dsf) => { const r = document.querySelector('.qr').getBoundingClientRect();
      return { x: Math.round(r.x*dsf), y: Math.round(r.y*dsf), w: Math.round(r.width*dsf), h: Math.round(r.height*dsf) }; }, DSF);
    const buf = await pg.screenshot();
    await pg.close();
    const oImg = PNG.sync.read(buf);
    const oBox = findQR(oImg, Math.round(oImg.height / 2)) || box;
    const oldVal = decodeCrop(oImg, oBox, false);
    const oldSpread = decodeCrop(oImg, oBox, true);

    rows.push({ code, count: d.count, oldPx: oBox.w, newPx: nBox.w,
      oldDots: +(oBox.w/d.count).toFixed(2), newDots: +(nBox.w/d.count).toFixed(2),
      oldOK: oldVal === code, newOK: newVal === code,
      oldSp: oldSpread === code, newSp: newSpread === code });
  }

  console.log('\nالباركود'.padEnd(17),'نقط/مربع','  طباعة نضيفة','  مع فرد الحبر');
  console.log('                        قديم→جديد    قديم  جديد    قديم  جديد');
  console.log('─'.repeat(72));
  rows.forEach(r => console.log(
    r.code.padEnd(15), (r.oldDots + '→' + r.newDots).padStart(11),
    (r.oldOK?'✅':'❌').padStart(7), (r.newOK?'✅':'❌').padStart(6),
    (r.oldSp?'✅':'❌').padStart(8), (r.newSp?'✅':'❌').padStart(6)));
  const c = (k) => rows.filter(r=>r[k]).length;
  console.log('─'.repeat(72));
  console.log(`طباعة نضيفة  — قديم: ${c('oldOK')}/${rows.length}   جديد: ${c('newOK')}/${rows.length}`);
  console.log(`مع فرد الحبر — قديم: ${c('oldSp')}/${rows.length}   جديد: ${c('newSp')}/${rows.length}`);
  await b.close();
})();
