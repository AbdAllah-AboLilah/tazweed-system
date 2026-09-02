// "على كل الأجهزة" — بيمسح المفتاح الواحد مش الحزمة كلها
// ============================================================
// ⚠️⚠️ العطل اللي بيحرسه: `tweaks` و`align` مش قيم مفردة — دول **حزم**:
//     tweaks = { noScale, blackwhite, sheetImage, ... }
//     align  = { x, y, shrink }
//
// والنسخة الأولى كانت بتمسح الحزمة **كلها** من استثناء كل جهاز. يعني لو
// غيّرت مفتاح واحد على كل الأجهزة، الجهاز اللي له إعداد خاص بيفقد **كل**
// مفاتيحه الخاصة — مش اللي غيّرته بس.
//
//   قبل:  الكمبيوتر → tweaks = { noScale: مقفول, sheetImage: مفتوح }
//   غيّرت blackwhite على الكل
//   بعد:  الكمبيوتر → tweaks اتمسحت كلها ← فقد الاتنين
//
// ⚠️ والخطر إن ده بيحصل **في صمت**: الإعداد بيرجع للعام من غير أي رسالة،
// والورق هو اللي بيقول بعد ما تكون طبعت غلط.
//
// ⚠️ نقطة تانية بيحرسها: المسح المتداخل لازم يبقى `update` بمسار نقطة.
// في `set` النقطة بتتحسب **اسم حقل حرفي** — يعني كنا هنعمل حقل اسمه
// "tweaks.blackwhite" بدل ما نمسح حاجة، والاستثناء يفضل شغّال.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof savePrintFieldsForAll === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const calls = [];
    let failNext = null;

    const mkDoc = (id) => ({
      set: (d, o) => { calls.push({ id, op: 'set', d: JSON.parse(JSON.stringify(d, (k, v) => (v && v.__del ? '<<DEL>>' : v))), o }); return Promise.resolve(); },
      update: (d) => {
        if (failNext) { const e = failNext; failNext = null; return Promise.reject(e); }
        calls.push({ id, op: 'update', d: JSON.parse(JSON.stringify(d, (k, v) => (v && v.__del ? '<<DEL>>' : v))) });
        return Promise.resolve();
      },
    });
    window.db = { collection: () => ({ doc: mkDoc }) };
    window.firebase = { firestore: { FieldValue: { delete: () => ({ __del: true }), serverTimestamp: () => 'TS' } } };
    window.saveSharedPrintSettings = (c) => { calls.push({ id: '<<GLOBAL>>', op: 'shared', d: c }); return Promise.resolve(); };

    const run = async (patch, ids) => { calls.length = 0; const n = await savePrintFieldsForAll(patch, ids || ['devA', 'devB']); return { n, calls: calls.slice() }; };

    // ============================================================
    // ⭐⭐⭐ (١) مفتاح واحد جوه حزمة → المسح للمفتاح ده بس
    // ============================================================
    const one = await run({ tweaks: { blackwhite: true } });
    out.oneCleared = one.n;
    const dev = one.calls.filter((c) => c.id !== '<<GLOBAL>>');
    out.oneUsesUpdate = dev.length === 2 && dev.every((c) => c.op === 'update');
    out.oneKeys = dev[0] ? Object.keys(dev[0].d) : [];
    // ⚠️ ده جوهر التصليح: المفتاح الواحد بمساره، مش الحزمة
    out.oneIsSubKey = out.oneKeys.length === 1 && out.oneKeys[0] === 'tweaks.blackwhite';
    out.oneNotWholeBundle = out.oneKeys.indexOf('tweaks') === -1;
    // والعام اتحفظ
    out.oneGlobal = JSON.stringify((one.calls.find((c) => c.id === '<<GLOBAL>>') || {}).d) === JSON.stringify({ tweaks: { blackwhite: true } });

    // ============================================================
    // ⭐⭐ (٢) كذا مفتاح جوه الحزمة → كل واحد بمساره
    // ============================================================
    const many = await run({ tweaks: { blackwhite: true, noScale: false } });
    const d2 = many.calls.find((c) => c.id === 'devA') || {};
    out.manyKeys = Object.keys(d2.d || {}).sort();
    out.manyOk = out.manyKeys.length === 2
      && out.manyKeys[0] === 'tweaks.blackwhite' && out.manyKeys[1] === 'tweaks.noScale';

    // ============================================================
    // ⭐⭐ (٣) المعايرة حزمة كمان (x/y/تصغير)
    // ============================================================
    const al = await run({ align: { x: 1 } });
    const d3 = al.calls.find((c) => c.id === 'devA') || {};
    out.alignKeys = Object.keys(d3.d || {});
    out.alignOk = out.alignKeys.length === 1 && out.alignKeys[0] === 'align.x';

    // ============================================================
    // ⭐ (٤) القيمة المفردة زي ما هي — مفيش مسار
    // ============================================================
    const flat = await run({ batch: 30 });
    const d4 = flat.calls.find((c) => c.id === 'devA') || {};
    out.flatKeys = Object.keys(d4.d || {});
    out.flatOk = out.flatKeys.length === 1 && out.flatKeys[0] === 'batch';

    // ============================================================
    // ⭐ (٥) خليط: مفردة + حزمة مع بعض
    // ============================================================
    const mix = await run({ batch: 30, tweaks: { sheetImage: true } });
    const d5 = mix.calls.find((c) => c.id === 'devA') || {};
    out.mixKeys = Object.keys(d5.d || {}).sort();
    out.mixOk = out.mixKeys.length === 2 && out.mixKeys[0] === 'batch' && out.mixKeys[1] === 'tweaks.sheetImage';

    // ============================================================
    // ⚠️ (٦) جهاز مالوش استثناء أصلًا → مش عطل
    // ============================================================
    failNext = { code: 'not-found' };
    const miss = await run({ tweaks: { blackwhite: true } }, ['devA', 'devB']);
    out.missCleared = miss.n;   // واحد بس نجح، والتاني مالوش مستند
    out.missNoThrow = true;

    // ⚠️ (٧) وفشل حقيقي مايوقفش الباقي
    failNext = { code: 'permission-denied' };
    const err = await run({ tweaks: { blackwhite: true } }, ['devA', 'devB']);
    out.errCleared = err.n;

    // ⚠️ (٨) تعديل فاضي = مفيش أي كتابة
    const empty = await run({});
    out.emptyNoWrites = empty.n === 0 && empty.calls.length === 0;

    // ⚠️⚠️ (٩) حزمة **فاضية** — الحالة اللي بتعدّي من الحارس الأول
    // `cleanPrintFields` بتسيب `{ tweaks: {} }` عدّي (مش undefined ولا
    // فاضي كنص)، فالدالة بتكمّل — وهنا مافيش أي مفتاح نمسحه. من غير
    // الحارس بنبعت `update({})` لكل جهاز على الفاضي.
    const hollow = await run({ tweaks: {} });
    out.hollowDeviceWrites = hollow.calls.filter((c) => c.id !== '<<GLOBAL>>').length;

    return out;
  });

  check('⭐⭐⭐ مفتاح واحد → المسح لمساره هو بس (tweaks.blackwhite)', r.oneIsSubKey, r.oneKeys);
  check('⭐⭐⭐ والحزمة كلها **ماتتمسحش**', r.oneNotWholeBundle, r.oneKeys);
  check('⭐⭐ وبيستخدم update (المسار مالوش معنى في set)', r.oneUsesUpdate);
  check('⭐ والعام اتحفظ صح', r.oneGlobal);
  check('⭐ واتمسح من الجهازين', r.oneCleared === 2, r.oneCleared);

  check('⭐⭐ كذا مفتاح → كل واحد بمساره', r.manyOk, r.manyKeys);
  check('⭐⭐ المعايرة حزمة كمان → align.x بس', r.alignOk, r.alignKeys);
  check('⭐ القيمة المفردة زي ما هي (batch)', r.flatOk, r.flatKeys);
  check('⭐ خليط مفردة + حزمة', r.mixOk, r.mixKeys);

  check('⚠️ جهاز مالوش استثناء → مش عطل والباقي بيكمّل', r.missCleared === 1, r.missCleared);
  check('⚠️ فشل حقيقي مايوقفش الباقي', r.errCleared === 1, r.errCleared);
  check('⚠️ تعديل فاضي → مفيش أي كتابة', r.emptyNoWrites);
  check('⚠️⚠️ حزمة فاضية → مفيش أي أمر مسح على الأجهزة', r.hollowDeviceWrites === 0, r.hollowDeviceWrites);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
