// ============================================================
// الملصق النصّي (HTML) — ده اللي رجع يبقى الافتراضي في v0.36.0
// ============================================================
// المستخدم جرّب الطريقتين على ورق حقيقي: الملصق النصّي طلع أنضف بكتير،
// والصورة كانت بتطلع منغمشة. فرجّعناه افتراضي — والفحص ده بيثبت إن
// الشكاوى الأربعة اللي جات مع الصور اتحلّت فعلًا.
//
// الشكاوى (من صور ملصقات مطبوعة):
//   1) اسم طويل = **كل** الكلام بيصغّر، حتى الرقم والسعر القصيّرين
//   2) الاسم الطويل جدًا مالوش غير سطرين، فبيطلع خط مايتقراش
//   3) الكلام نازل عن حرف الباركود العلوي
//   4) الحروف بتخرج بره اللاصقة عند حروف الورقة
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

const OPTS = { pageWidthMm: 38, pageHeightMm: 25, halves: 2 };
const MM = 96 / 25.4;

// أسماء حقيقية من المحل + الحالات اللي وقعت على ورق
const NAMES = [
  'كريب',
  'حجاب سوري وطباقيه',
  'Hejap Kuwaiti 120',
  'طباقيه كويتى كباسين',
  'Chanvie Leen 58047',
  'خمار اسدال بكم طويل جدا جدا زيادة',                 // طويل عربي
  'Biotherm whitening Cream senstive Area 100g offer',  // ده اللي صغّر كل حاجة
  'حجاب كريب سادة لوكس Premium Quality 2024',           // عربي + إنجليزي مخلوطين
  'حجاب كريب سادة لوكس بيجات درجة ممتازة جدا موديل 2024 عرض خاص', // طويل جدًا → ٣ سطور
  'Qianqianfendai.',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',                     // كلمة واحدة مستحيلة
  'a',
];
const VERY_LONG = 'حجاب كريب سادة لوكس بيجات درجة ممتازة جدا موديل 2024 عرض خاص';
const LONG = 'Biotherm whitening Cream senstive Area 100g offer';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildLabelHTML === 'function');

  const p2 = await b.newPage();

  // بيرسم الملصق ويقيس كل حاجة تهمنا فيه
  async function measure(name, extra) {
    const html = await p.evaluate(async ([nm, ex]) => {
      const url = await generateQRDataURL('62808737', 200);
      return buildLabelHTML(
        { itemName: nm, barcodeNumber: '62808737', originalPrice: 620, sellingPrice: 495, ...(ex || {}) },
        { pageWidthMm: 38, pageHeightMm: 25, halves: 2 }, url, 1
      );
    }, [name, extra]);
    await p2.setContent(html);
    return p2.evaluate(() => {
      const MM = 96 / 25.4;
      const px = (el) => el.getBoundingClientRect();
      const label = document.querySelector('.label');
      const halves = [...document.querySelectorAll('.half')];
      const L = px(label);
      const nm = document.querySelector('.name');
      const cd = document.querySelector('.code');
      const pr = document.querySelector('.price b');
      const qr = document.querySelector('.qr');
      const txt = document.querySelector('.txt');
      const fs = (el) => +(parseFloat(getComputedStyle(el).fontSize) / MM).toFixed(2);

      // أقرب مسافة بين أي حاجة فيها حبر وحرف الورقة (فوق/تحت/يمين/شمال)
      const inked = [...document.querySelectorAll('.name,.code,.price,.qr')];
      let minTop = Infinity, minBot = Infinity, minL = Infinity, minR = Infinity;
      for (const el of inked) {
        const r = px(el);
        if (!r.width || !r.height) continue;
        minTop = Math.min(minTop, r.top - L.top);
        minBot = Math.min(minBot, L.bottom - r.bottom);
        minL = Math.min(minL, r.left - L.left);
        minR = Math.min(minR, L.right - r.right);
      }

      return {
        nameMm: fs(nm), codeMm: fs(cd), priceMm: pr ? fs(pr) : 0,
        // القص الفعلي — مش الحساب
        clippedV: nm.scrollHeight > nm.clientHeight + 1,
        clippedH: nm.scrollWidth > nm.clientWidth + 1,
        lines: Math.round(nm.scrollHeight / (parseFloat(getComputedStyle(nm).lineHeight) || 1)),
        // فرق أعلى النص عن أعلى الباركود
        topGapMm: +((px(txt).top - px(qr).top) / MM).toFixed(2),
        qrMm: +(px(qr).width / MM).toFixed(2),
        // أقرب حبر لحرف الورقة
        edgeTopMm: +(minTop / MM).toFixed(2),
        edgeBotMm: +(minBot / MM).toFixed(2),
        edgeLMm: +(minL / MM).toFixed(2),
        edgeRMm: +(minR / MM).toFixed(2),
        // النصين مايتلاقوش
        overlap: halves.length === 2 &&
          px(halves[0]).bottom > px(halves[1]).top + 1,
        outOfHalf: [...document.querySelectorAll('.half')].some((h) => {
          const hr = px(h);
          return [...h.querySelectorAll('.name,.code,.price,.qr')].some((e) => {
            const r = px(e);
            return r.width && (r.bottom > hr.bottom + 1 || r.top < hr.top - 1);
          });
        }),
      };
    });
  }

  const rows = {};
  for (const n of NAMES) rows[n] = await measure(n);

  // ============================================================
  // 1) الاسم الطويل مابيصغّرش الرقم والسعر
  // ============================================================
  // ده جوهر الشكوى الأولى. المقارنة بين أقصر اسم وأطول اسم: الاسم لازم
  // يفرق، والرقم والسعر لازم **مايفرقوش**.
  const short = rows['كريب'];
  const long = rows[LONG];
  check('⭐ الاسم الطويل بيصغّر فعلًا (يعني المقارنة معناها حاجة)',
    long.nameMm < short.nameMm - 0.2, { short: short.nameMm, long: long.nameMm });

  // ⚠️ نقطة غلّطت أول محاولة: "الرقم مايتغيّرش خالص" مستحيل فيزيائيًا.
  // ارتفاع نص اللاصقة 9.9مم وخلاص — الاسم لما ياخد سطرين لازم حد يدفع.
  // اللي كان غلط إن **الرقم كان بيدفع بالتساوي**: كان بينزل من 2.75 لـ2.06
  // (خسارة 25%) عشان الاسم بس. دلوقتي بينزل 4% — والفرق ده هو التعديل.
  const drop = (a, b) => +(1 - b / a).toFixed(3);
  check('⭐ الرقم بيخسر أقل من 10% عشان الاسم الطويل (كان 25%)',
    drop(short.codeMm, long.codeMm) < 0.1, { short: short.codeMm, long: long.codeMm, drop: drop(short.codeMm, long.codeMm) });
  check('⭐ والسعر كمان',
    drop(short.priceMm, long.priceMm) < 0.1, { short: short.priceMm, long: long.priceMm, drop: drop(short.priceMm, long.priceMm) });
  // ⭐ الأهم: الرقم والسعر بقوا **أكبر من الاسم** في الأسماء الطويلة.
  // الطريقة القديمة كانت بتخلّيهم تلاتتهم بنفس المقاس بالظبط.
  check('⭐ الرقم أكبر من الاسم في الاسم الطويل', long.codeMm > long.nameMm, long);
  check('⭐ السعر أكبر من الاسم في الاسم الطويل', long.priceMm > long.nameMm, long);
  // ⭐ القاعدة العامة: **لما نزنق**، مفيش اسم يخلّي الرقم أو السعر أصغر
  // منه. ده اللي بيمنع رجوع العطل بأي اسم تاني، مش بس اللي في القايمة دي.
  //
  // ⚠️ القاعدة على الأسماء اللي بتاخد أكتر من سطر بس. الاسم اللي بيدخل في
  // سطر واحد مافيش زنقة أصلًا — كله بمقاسه الطبيعي، والاسم بيبقى أكبر
  // حاجة على الملصق وده **الصح** (هو اللي بتقراه الأول).
  const multi = NAMES.filter((n) => rows[n].lines > 1);
  check('في أسماء بتاخد أكتر من سطر (يعني القاعدة اتفحصت فعلًا)', multi.length >= 4, multi.length);
  for (const n of multi) {
    const r = rows[n];
    check(`⭐ "${n.slice(0, 24)}" — الرقم والسعر مش أصغر من الاسم`,
      r.codeMm >= r.nameMm - 0.05 && r.priceMm >= r.nameMm - 0.05, r);
  }
  // والاسم اللي في سطر واحد بياخد راحته — مافيش حد بيدفع تمنه
  for (const n of NAMES.filter((x) => rows[x].lines === 1)) {
    check(`"${n.slice(0, 24)}" — سطر واحد: الرقم والسعر بمقاسهم الكامل`,
      Math.abs(rows[n].codeMm - short.codeMm) < 0.05 &&
      Math.abs(rows[n].priceMm - short.priceMm) < 0.05, rows[n]);
  }

  // ============================================================
  // 2) السطر التالت — بس لما يبقى مكسب
  // ============================================================
  check('⭐ الاسم الطويل جدًا بياخد ٣ سطور', rows[VERY_LONG].lines === 3, rows[VERY_LONG]);
  check('الاسم القصير فاضل سطر واحد (مش بيتفرد على الفاضي)',
    rows['كريب'].lines === 1, rows['كريب']);
  // ⚠️ السطر التالت مش مجاني — بياكل من ارتفاع باقي السطور. فالمفروض
  // ياخده **بس** لما يطلّع خط أكبر. الاسمين دول بيثبتوا الحالتين:
  //   • LONG      → سطرين أكبر، فمابياخدش التالت
  //   • VERY_LONG → التالت أكبر، فبياخده
  check('⭐ والاسم اللي السطرين أحسن له مابياخدش التالت', rows[LONG].lines === 2, rows[LONG]);
  check('⭐ والسطر التالت طلّع خط أكبر فعلًا',
    rows[VERY_LONG].nameMm > 1.45, rows[VERY_LONG].nameMm);

  // ============================================================
  // 3) الكلام مع حرف الباركود العلوي
  // ============================================================
  for (const n of NAMES) {
    check(`"${n.slice(0, 24)}" — النص مع حرف الباركود`,
      Math.abs(rows[n].topGapMm) < 0.35, { gap: rows[n].topGapMm });
  }

  // ============================================================
  // 4) الأسماء كلها كاملة — عربي وإنجليزي ومخلوط
  // ============================================================
  for (const n of NAMES) {
    const r = rows[n];
    check(`⭐ "${n.slice(0, 24)}" — الاسم كامل`, !r.clippedV && !r.clippedH, r);
    check(`"${n.slice(0, 24)}" — جوه نصّ اللاصقة`, !r.outOfHalf && !r.overlap, r);
  }

  // ============================================================
  // 5) نقط الأمان — الحبر بعيد عن حرف الورقة
  // ============================================================
  // الطابعة بتلعب 1–1.5مم وهي بتسحب الورق. أي حبر أقرب من كده لحرف
  // الورقة بيتاكل. الفحص ده هو اللي كان هيمسك "Hejap Kuwaiti 12(".
  const PLAY_MM = 1.5;
  for (const n of NAMES) {
    const r = rows[n];
    check(`⭐ "${n.slice(0, 24)}" — الحبر بعيد ${PLAY_MM}مم عن حروف الورقة`,
      r.edgeTopMm >= PLAY_MM && r.edgeBotMm >= PLAY_MM &&
      r.edgeLMm >= PLAY_MM && r.edgeRMm >= PLAY_MM,
      { t: r.edgeTopMm, b: r.edgeBotMm, l: r.edgeLMm, r: r.edgeRMm });
  }

  // ============================================================
  // 6) الباركود مارجعش صغير عشان الهوامش
  // ============================================================
  // لما كان الهامش 2مم على الأربع جهات، الباركود نزل 8.1مم. الهامش
  // الداخلي (خط القص) رجّعه 9.5.
  check('⭐ الباركود ≥ 9مم', rows['كريب'].qrMm >= 9, rows['كريب'].qrMm);

  // ============================================================
  // 7) "من غير سعر" — المكان بيروح للاسم والرقم
  // ============================================================
  // ⚠️ الاسم القصير مابيكبرش لما نشيل السعر — هو أصلًا واقف عند سقفه
  // (2.7مم) أو عند عرض العمود. اللي بيستفيد هو الاسم **الطويل** اللي
  // الارتفاع هو اللي زانقه. فالفحص لازم يبقى على اسم طويل.
  const noPriceHTML = await p.evaluate(async (nm) => {
    const url = await generateQRDataURL('62808737', 200);
    return buildLabelHTML({ itemName: nm, barcodeNumber: '62808737', sellingPrice: 495 },
      { pageWidthMm: 38, pageHeightMm: 25, halves: 2, noPrice: true }, url, 1);
  }, LONG);
  await p2.setContent(noPriceHTML);
  const np = await p2.evaluate(() => ({
    hasPrice: !!document.querySelector('.price'),
    nameMm: +(parseFloat(getComputedStyle(document.querySelector('.name')).fontSize) / (96 / 25.4)).toFixed(2),
    codeMm: +(parseFloat(getComputedStyle(document.querySelector('.code')).fontSize) / (96 / 25.4)).toFixed(2),
  }));
  check('⭐ "من غير سعر" شال السعر فعلًا', !np.hasPrice, np);
  check('⭐ والاسم الطويل كبر بعد ما خد مكانه',
    np.nameMm > rows[LONG].nameMm, { with: rows[LONG].nameMm, without: np.nameMm });
  check('⭐ والرقم كمان رجع لمقاسه الطبيعي',
    np.codeMm >= short.codeMm - 0.05, { np: np.codeMm, natural: short.codeMm });

  // ============================================================
  // 8) السعر المشطوب مابيزنقش السعر الحقيقي
  // ============================================================
  // الفراغ بين السعرين كان مربوط بالحشو، فلما الحشو الآمن كبر بقى 4مم
  // جوه عمود عرضه 24 — والسعر اضطر يصغّر.
  const noDisc = await measure('حجاب سوري وطباقيه', { originalPrice: 0 });
  check('⭐ وجود سعر مشطوب مابيصغّرش سعر البيع',
    Math.abs(noDisc.priceMm - rows['حجاب سوري وطباقيه'].priceMm) < 0.05,
    { withDiscount: rows['حجاب سوري وطباقيه'].priceMm, without: noDisc.priceMm });
  // والسعرين مع بعض لازم يدخلوا العمود من غير ما يتقصوا
  check('⭐ السعرين مع بعض داخلين في العمود',
    rows['حجاب سوري وطباقيه'].edgeLMm >= 1.5 && rows['حجاب سوري وطباقيه'].edgeRMm >= 1.5,
    rows['حجاب سوري وطباقيه']);

  await b.close();

  console.log('\n' + 'الاسم'.padEnd(34) + 'اسم  رقم  سعر  سطور  فجوة  حروف');
  console.log('─'.repeat(78));
  for (const n of NAMES) {
    const r = rows[n];
    console.log(n.slice(0, 32).padEnd(34) +
      `${r.nameMm}  ${r.codeMm}  ${r.priceMm}   ${r.lines}    ${r.topGapMm}   ` +
      `${Math.min(r.edgeTopMm, r.edgeBotMm, r.edgeLMm, r.edgeRMm)}`);
  }
  console.log('─'.repeat(78));

  if (fail.length) {
    console.log(`\n❌ فشل (${fail.length}):`);
    fail.forEach((f) => console.log('   ' + f));
    console.log(`\n✅ نجح (${pass.length})`);
    process.exit(1);
  }
  console.log(`\n✅ نجح (${pass.length})`);
  pass.filter((x) => x.startsWith('⭐')).forEach((x) => console.log('   ' + x));
})();
