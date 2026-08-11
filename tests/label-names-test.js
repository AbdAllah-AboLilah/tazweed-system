// الاسم الطويل: هل بيدخل كامل ولا لسه بيتقص بنقط؟
// الفحص بيقيس **الرسم الفعلي** في المتصفح، مش الحساب.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

// أسماء حقيقية من صور المستخدم + حالات متطرفة
const NAMES = [
  'Qianqianfendai.',            // كلمة واحدة طويلة — دي اللي طلعت "Qianqianfendai. ."
  'طباقيه كويتى كباسين',        // دي اللي طلعت "طباقيه كويتى كباسين..."
  'حجاب بيور قطعتين',           // دي كانت ظابطة
  'كريب',                        // قصير جدًا
  'Hejap Kuwaiti 120',
  'خمار اسدال بكم طويل جدا جدا زيادة',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',  // كلمة واحدة مستحيلة
  'كريب سادة لوكس بيجات',
  'a',
  'حجاب سوري وطباقيه',
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildLabelHTML === 'function');

  const p2 = await b.newPage();
  const rows = [];

  for (const name of NAMES) {
    for (const kind of ['صنف', 'درجة']) {
      const html = await p.evaluate(async ([nm, k]) => {
        const opts = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
        if (k === 'صنف') {
          const url = await generateQRDataURL('28144', 200);
          return buildLabelHTML({ itemName: nm, barcodeNumber: '28144', originalPrice: 115, sellingPrice: 90 }, opts, url, 1);
        }
        return buildGradeLabelHTML(nm + ' — درجة 12', opts, 1);
      }, [name, kind]);

      await p2.setContent(html);
      const m = await p2.evaluate(() => {
        // ⚠️ .l1 مابقاش موجود — الملصق النصّي بقى نص واحد بيلف في .t
        const sel = document.querySelector('.name') || document.querySelector('.t');
        const half = document.querySelector('.half');
        const cs = getComputedStyle(sel);
        const MM = 96 / 25.4;
        return {
          text: sel.textContent,
          // القص بيحصل لما المحتوى أطول من المساحة الظاهرة
          clippedV: sel.scrollHeight > sel.clientHeight + 1,
          clippedH: sel.scrollWidth > sel.clientWidth + 1,
          ellipsis: cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none',
          fontMm: +(parseFloat(cs.fontSize) / MM).toFixed(2),
          outOfHalf: sel.getBoundingClientRect().bottom > half.getBoundingClientRect().bottom + 1,
        };
      });
      rows.push({ name, kind, ...m });
      // ⭐ الشرط الحقيقي: الاسم **مايتقصّش فعلًا**.
      check(`[${kind}] "${name}" — الاسم كامل مش متقصوص`, !m.clippedV && !m.clippedH, m);
      // ⚠️ كان هنا "مفيش نقط (…)" بمعنى إن خاصية القص **متعرّفة** أصلًا.
      // ده كان صح لما القص كان بيحصل **بالغلط** (الحساب يقول داخل والرسم
      // يقول لأ). دلوقتي النقط بقت **خطة أخيرة مقصودة** في الملصق النصّي
      // والمقسوم — بتتعرّف دايمًا وبتشتغل بس لو الاسم فعلًا مش داخل.
      // فوجودها مش عطل؛ العطل إنها **تشتغل** على اسم كان المفروض يدخل،
      // وده اللي بيقيسه السطر اللي فوق.
      check(`[${kind}] "${name}" — النقط ماشتغلتش على اسم كان بيدخل`,
        !m.clippedV && !m.clippedH, m);
      check(`[${kind}] "${name}" — جوه حدود اللاصقة`, !m.outOfHalf, m);
      check(`[${kind}] "${name}" — الخط مش صغير لدرجة مش مقروءة`, m.fontMm >= 1.0, m);
    }
  }

  console.log('\n' + '─'.repeat(78));
  console.log('الاسم'.padEnd(34) + 'النوع'.padEnd(8) + 'الخط'.padEnd(8) + 'متقصوص؟');
  console.log('─'.repeat(78));
  rows.forEach(r => console.log(
    r.name.slice(0,32).padEnd(34) + r.kind.padEnd(8) + (r.fontMm + 'مم').padEnd(9) +
    ((r.clippedV || r.clippedH) ? '❌ آه' : '✅ لأ')
  ));
  console.log('─'.repeat(78));
  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
