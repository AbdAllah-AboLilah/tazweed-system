// ============================================================
// 🧭 كل مفتاح طباعة بيقول بيخص مين — المساعد ولا QZ
// ============================================================
// اتطلب بالنص: "واعمل اقتراح اكتب اسم الاعداد بيخص مين المساعد ولا qz".
//
// السبب إن ده لازم: المفاتيح مقسّمة مجموعات من v0.84.0، بس المجموعة
// مابتقولش إن مفتاح زي "أبيض وأسود صريح" **بيتجاهل تمامًا** لما الطبعة
// تروح للبرنامج المساعد — المساعد مابيعديش على تعريف الويندوز أصلًا.
// فاللي بيظبط مفتاح QZ وهو شغّال على المساعد بيستنى فرق مش هييجي،
// ويفضل يلف من غير ما يعرف إن المفتاح ده مالوش لازمة عنده.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 200)}` : ''));

// ------------------------------------------------------------
// ⚠️ ألوان الشارة لازم تيجي من متغيّرات الثيم
// ------------------------------------------------------------
// اللون المكتوب بالإيد بيفضل ثابت في الوضع الليلي فيطلع نص فاتح على
// خلفية فاتحة. (نفس القاعدة اللي في appearance-test.)
const src = fs.readFileSync(path.join(root, 'js/print-core.js'), 'utf8');
const badgeBlock = src.slice(
  src.indexOf('const PRINT_TWEAK_ROUTE_BADGE'),
  src.indexOf('function printTweakBadgeHTML')
);
check('⭐⭐⭐ ألوان الشارة كلها من متغيّرات الثيم (مافيش لون مكتوب بالإيد)',
  badgeBlock.length > 0 && !/#[0-9a-fA-F]{3,6}/.test(badgeBlock), badgeBlock.slice(0, 200));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof PRINT_TWEAKS !== 'undefined' && typeof printTweakBadgeHTML === 'function');

  const r = await p.evaluate(async () => {
    const out = {};

    // ============================================================
    // ⭐⭐⭐⭐ كل مفتاح موجود لازم يكون له سطر
    // ============================================================
    // من غير الحارس ده، أي مفتاح جديد هيتضاف من غير شارة — وهيبقى
    // المفتاح الوحيد اللي محدش عارف بيخص مين، وهو أصلًا الجديد اللي
    // محتاج التوضيح أكتر من غيره.
    out.missing = PRINT_TWEAKS.map((t) => t.key).filter((k) => !PRINT_TWEAK_ROUTE[k]);

    // ولا سطر زيادة لمفتاح مااتشالش (بيدي إحساس كاذب إن الجدول كامل)
    const live = PRINT_TWEAKS.map((t) => t.key);
    out.extra = Object.keys(PRINT_TWEAK_ROUTE).filter((k) => live.indexOf(k) === -1);

    // وكل قيمة لازم تكون واحدة من التلاتة المعروفة
    out.badValues = Object.keys(PRINT_TWEAK_ROUTE).filter(
      (k) => ['helper', 'qz', 'both'].indexOf(PRINT_TWEAK_ROUTE[k]) === -1
    );

    // ============================================================
    // ⭐⭐⭐ التصنيف نفسه لازم يطابق الكود اللي بيقرا المفاتيح
    // ============================================================
    // الجدول ده وصف، والكود هو الحقيقة. لو اتعارضوا، الشارة بتكذب.
    // فبنتأكد من التلات مفاتيح اللي بيقرّروا الطريق فعلًا.
    out.routeKeys = PRINT_TWEAKS.filter((t) => PRINT_TWEAK_ROUTE[t.key] === 'helper').map((t) => t.key).sort();

    out.badges = {
      helper: printTweakBadgeHTML('sheetHelper'),
      qz: printTweakBadgeHTML('noScale'),
      both: printTweakBadgeHTML('lightQR'),
      unknown: printTweakBadgeHTML('مفتاح-مش-موجود'),
    };

    // ---------- الشارة بتظهر فعلًا جنب اسم المفتاح ----------
    // ⚠️ مش بنفحص الدالة لوحدها: الدالة ممكن تشتغل صح والنتيجة
    // ماتتحطش في الشاشة خالص — ده بالظبط اللي حصل مع زرار التحميل.
    document.body.innerHTML = '<div id="app"></div>';
    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };
    let html = '';
    try {
      // ⚠️ الدالة بتستنى قايمة الطابعات من QZ الأول. من غير QZ بترجّع
      // قايمة فاضية وبتكمّل الرسم عادي — واللي يهمنا هنا الرسم.
      await openPrinterSettings();
      html = document.body.innerHTML;
    } catch (err) {
      out.htmlError = String(err);
    }
    // ⚠️⚠️ مش كفاية ندوّر على نص الشارة في الصفحة: سطر الشرح فوق
    // المجموعات فيه الشارات التلاتة أصلًا، فالفحص كان بيعدّي حتى لو
    // المفاتيح نفسها مالهاش ولا شارة. (اتمسك بالتخريب.)
    //
    // فبندوّر على الشارة **ملزوقة باسم المفتاح** بالظبط: النص بتاع
    // المفتاح وبعده على طول الشارة، من غير أي حاجة بينهم.
    const glued = (key) => {
      const t = PRINT_TWEAKS.find((x) => x.key === key);
      if (!t) return false;
      const at = html.indexOf(t.label);
      if (at === -1) return false;
      // ⚠️ ٤٠٠ حرف مش ٢٠٠: الستايل بتاع الشارة لوحده حوالي ٢٠٠ حرف،
      // فالنافذة الضيقة كانت بتقول "مش موجودة" وهي ملزوقة فعلًا.
      // بس لسه ضيقة كفاية إنها ماتوصلش للمفتاح اللي بعده.
      const after = html.slice(at + t.label.length, at + t.label.length + 400);
      const badge = PRINT_TWEAK_ROUTE_BADGE[PRINT_TWEAK_ROUTE[key]];
      return !!badge && after.indexOf(badge.text) !== -1;
    };
    out.gluedHelper = glued('sheetHelper');
    out.gluedQz = glued('blackwhite');
    out.gluedBoth = glued('lightQR');
    out.htmlHasLegend = /الشارة جنب كل مفتاح بتقول بيخص مين/.test(html);

    return out;
  });

  check('⭐⭐⭐⭐⭐ كل مفتاح في PRINT_TWEAKS له سطر في جدول الطريق',
    r.missing.length === 0, r.missing);
  check('⭐⭐⭐ ومافيش سطر لمفتاح مااتشالش', r.extra.length === 0, r.extra);
  check('⭐⭐⭐ وكل القيم من التلاتة المعروفة', r.badValues.length === 0, r.badValues);
  check('⭐⭐⭐⭐ ومفتاحين بس هما اللي بيغيّروا الطريق للمساعد',
    JSON.stringify(r.routeKeys) === JSON.stringify(['labelHelper', 'sheetHelper']), r.routeKeys);

  check('⭐⭐ شارة المساعد فيها كلمة المساعد', /المساعد/.test(r.badges.helper), r.badges.helper);
  check('⭐⭐ وشارة QZ فيها QZ', /QZ/.test(r.badges.qz), r.badges.qz);
  check('⭐⭐ وشارة الاتنين مختلفة عنهم',
    r.badges.both !== r.badges.helper && r.badges.both !== r.badges.qz, r.badges.both);
  check('⭐⭐⭐ والمفتاح المش معروف بيرجّع فاضي (الشارة زيادة، عمرها ما توقّع الشاشة)',
    r.badges.unknown === '', r.badges.unknown);

  check('⭐⭐⭐⭐⭐ شارة المساعد ملزوقة باسم مفتاحها في الشاشة',
    r.gluedHelper === true, { glued: r.gluedHelper, err: r.htmlError });
  check('⭐⭐⭐⭐⭐ وشارة QZ ملزوقة باسم مفتاحها', r.gluedQz === true, r.gluedQz);
  check('⭐⭐⭐⭐ وشارة "الاتنين" كمان', r.gluedBoth === true, r.gluedBoth);
  check('⭐⭐⭐ ومعاها سطر بيفسّر الشارات', r.htmlHasLegend === true, r.htmlHasLegend);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
