// v0.56.0 — المظهر: الثيم والخط، وتكلفتهم على السرعة
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ============================================================
  // ١) الملفات والقواعد — من غير متصفح
  // ============================================================
  const css = fs.readFileSync(__dirname + '/../styles.css', 'utf8');
  const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

  // ⚠️⚠️ الخط لازم يفضل **من جوّه المشروع**. لو رجع لجوجل:
  //   • نداء ملف تنسيقات + لحد ٨ ملفات خط في كل فتحة
  //   • و**بيفشل من غير نت** والنظام ده بيشتغل من غير نت
  // ⚠️ بندوّر على **تحميل فعلي** مش على أي ذكر للاسم — الشرح اللي في
  // styles.css بيشرح ليه مابنجيبوش من جوجل، وكان بيوقّع الفحص نفسه.
  const noComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  const liveCode = noComments(css) + noComments(html) + noComments(sw);
  check('⭐⭐⭐ مافيش خط بيتجاب من جوجل',
    !/fonts\.(googleapis|gstatic)\.com/.test(liveCode),
    (liveCode.match(/.*fonts\.(googleapis|gstatic)\.com.*/) || [])[0]);
  check('⭐⭐ الخط محفوظ جوّه المشروع', /url\('\.\/fonts\/plex-ar-/.test(css), null);

  const fontFiles = fs.readdirSync(__dirname + '/../fonts').filter((f) => f.endsWith('.woff2'));
  const fontKB = fontFiles.reduce((s, f) => s + fs.statSync(__dirname + '/../fonts/' + f).size, 0) / 1024;
  check('⭐ وزنين بس (٤ ملفات) مش تلاتة', fontFiles.length === 4, fontFiles);
  // ⚠️ السقف ده مقصود. التلات أوزان كانت 143 كيلو — والفرق بين 600
  // و700 مش باين على الشاشة، فمش مستاهل نص الحجم.
  check('⭐⭐ حجم الخط كله تحت ١١٠ كيلو', fontKB < 110, Math.round(fontKB) + 'KB');

  // ⚠️⚠️ أهم فحص في الملف. من غير القاعدة دي، ملفات الخط بتتسأل عن
  // الشبكة في **كل فتحة** — نداءين زيادة على تليفون بيشتغل ببيانات.
  // بندوّر على القاعدة نفسها: شرط على /fonts/ + .woff2، وجوّه الفرع
  // بتاعه caches.match قبل أي fetch.
  // ⚠️ القاعدة في sw.js مكتوبة كـregex، يعني الشرطة متهرّبة (fonts\\/)
  // — فبندوّر على 'woff2' مش على 'fonts/'.
  const fontRuleAt = sw.indexOf('woff2');
  const fontRule = fontRuleAt >= 0 ? sw.slice(Math.max(0, fontRuleAt - 200), fontRuleAt + 700) : '';
  check('⭐⭐⭐ الـsw بيخدم الخط من المحفوظ الأول',
    /fonts/.test(fontRule) &&
      fontRule.indexOf('caches.match(request)') >= 0 &&
      fontRule.indexOf('caches.match(request)') < fontRule.indexOf('fetch(request)'),
    { at: fontRuleAt, head: fontRule.slice(0, 120) });

  // ⚠️ والخط **مش** في قايمة الحفظ المسبق عن قصد: اللي بيختار "خط
  // الجهاز" مايتحمّلش عنده خالص.
  check('⭐ والخط مش في الحفظ المسبق (اللي مايستعملوش مايحمّلوش)',
    !/APP_SHELL[\s\S]*woff2[\s\S]*?\];/.test(sw), null);

  check('⭐⭐ appearance.js في قايمة حفظ الـsw', /'\.\/js\/appearance\.js'/.test(sw), null);
  check('⭐⭐ والمظهر بيتحط قبل أول رسمة (سطر في <head>)',
    html.indexOf('tazweed-appearance') < html.indexOf('./js/app.js'), null);

  // ⚠️ الاختيار محلي — أي كتابة في السحابة هنا معناها قراية عند كل
  // فتحة قبل الرسم، ووميض في اللون. الشرح الكامل في appearance.js.
  const appSrc = fs.readFileSync(__dirname + '/../js/appearance.js', 'utf8');
  check('⭐⭐⭐ المظهر بيتحفظ على الجهاز — مافيش نداء سحابة',
    /localStorage/.test(appSrc) && !/(db\.|firestore|collection\()/.test(appSrc), null);

  // ============================================================
  // ٢) الألوان: مافيش لون مكتوب بالإيد في الواجهة
  // ============================================================
  // ⚠️ أي لون مكتوب بالإيد بيفضل ثابت في كل الثيمات — يعني في الثيم
  // الليلي بيبقى نص فاتح على خلفية فاتحة. ملفات الطباعة **مستثناة**:
  // دي بتترسم على ورق مش على شاشة، وألوانها لازم تفضل ثابتة.
  for (const f of ['app.js', 'dashboard.js', 'user-admin.js']) {
    const src = fs.readFileSync(__dirname + '/../js/' + f, 'utf8');
    const hits = src.match(/#[0-9a-fA-F]{6}\b/g) || [];
    check('⭐⭐ مافيش لون مكتوب بالإيد في ' + f, hits.length === 0, hits.slice(0, 6));
  }
  const bodyCss = css.slice(css.indexOf('* {\n  box-sizing'));
  const cssHits = (bodyCss.match(/#[0-9a-fA-F]{3,6}\b/g) || []);
  check('⭐ وألوان styles.css كلها في المتغيّرات فوق', cssHits.length <= 6, cssHits);

  // ⚠️ الثيم الليلي لازم يعرّف **كل** متغيّر لوني في :root. اللي
  // يتنسى بيفضل بلون النهار وبيطلع نص فاتح على خلفية فاتحة.
  const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const nightBlock = css.slice(css.indexOf(':root[data-theme="night"]'), css.indexOf('}', css.indexOf(':root[data-theme="night"]')));
  const colorVars = (rootBlock.match(/--[a-z-]+(?=:\s*#)/g) || []);
  const missing = colorVars.filter((v) => !nightBlock.includes(v + ':'));
  check('⭐⭐⭐ الثيم الليلي معرّف كل متغيّر لوني', missing.length === 0, missing);

  // ============================================================
  // ٣) على متصفح حقيقي
  // ============================================================
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof openAppearanceDialog === 'function');

  const defaults = await p.evaluate(() => {
    localStorage.removeItem('tazweed-appearance');
    const a = applyAppearance();
    return {
      theme: a.theme, font: a.font,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      dataFont: document.documentElement.getAttribute('data-font'),
    };
  });
  // ⚠️ الافتراضي "ورق حراري" مقصود: ٤ ناس تانيين بيستخدموا النظام كل
  // يوم، ومش من حقنا نغيّر شكل شغلهم من ورا ظهرهم.
  check('⭐⭐ الافتراضي = ورق حراري (نفس شكل النظام قبل التحديث)',
    defaults.theme === 'paper' && defaults.dataTheme === null, defaults);
  check('⭐ والخط الافتراضي بلكس', defaults.font === 'plex' && defaults.dataFont === 'plex', defaults);

  const themed = await p.evaluate(() => {
    const out = {};
    ['paper', 'indigo', 'olive', 'wine', 'night'].forEach((t) => {
      saveAppearance({ theme: t });
      const cs = getComputedStyle(document.documentElement);
      out[t] = {
        bg: cs.getPropertyValue('--bg').trim(),
        text: cs.getPropertyValue('--text-primary').trim(),
        accent: cs.getPropertyValue('--accent').trim(),
      };
    });
    saveAppearance({ theme: 'paper' });
    return out;
  });
  check('⭐⭐ الخمس ثيمات بيغيّروا الألوان فعلًا',
    new Set(Object.values(themed).map((v) => v.bg)).size === 5, themed);

  // ⚠️ الفحص ده بيمسك أوحش عطل ممكن: نص غامق على خلفية غامقة.
  const lum = (hex) => {
    const m = hex.replace('#', '');
    const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const contrasts = Object.entries(themed).map(([k, v]) => [k, +Math.abs(lum(v.bg) - lum(v.text)).toFixed(2)]);
  check('⭐⭐⭐ كل ثيم فيه فرق واضح بين النص والخلفية',
    contrasts.every(([, d]) => d > 0.5), contrasts);

  const saved = await p.evaluate(() => {
    saveAppearance({ theme: 'night', font: 'system' });
    const raw = JSON.parse(localStorage.getItem('tazweed-appearance'));
    const fam = getComputedStyle(document.body).fontFamily;
    saveAppearance({ theme: 'paper', font: 'plex' });
    const fam2 = getComputedStyle(document.body).fontFamily;
    return { raw, systemFam: fam, plexFam: fam2 };
  });
  check('⭐ الاختيار بيتحفظ على الجهاز', saved.raw.theme === 'night' && saved.raw.font === 'system', saved.raw);
  check('⭐⭐ "خط الجهاز" مافيهوش بلكس (يعني مافيش تحميل)',
    !/Plex/i.test(saved.systemFam), saved.systemFam);
  check('⭐⭐ و"بلكس" بيتحط فعلًا', /Plex/i.test(saved.plexFam), saved.plexFam);

  // النافذة نفسها
  const dlg = await p.evaluate(async () => {
    openAppearanceDialog();
    await new Promise((r) => setTimeout(r, 60));
    const themes = [...document.querySelectorAll('[data-theme-id]')];
    const fonts = [...document.querySelectorAll('[data-font-id]')];
    const small = themes.filter((el) => el.getBoundingClientRect().height < 44).length;
    themes.find((el) => el.getAttribute('data-theme-id') === 'olive').click();
    await new Promise((r) => setTimeout(r, 40));
    const applied = document.documentElement.getAttribute('data-theme');
    document.getElementById('appearance-reset').click();
    await new Promise((r) => setTimeout(r, 60));
    const afterReset = document.documentElement.getAttribute('data-theme');
    document.querySelector('.appearance-overlay')?.remove();
    return { themes: themes.length, fonts: fonts.length, small, applied, afterReset };
  });
  check('⭐ النافذة فيها الخمس ثيمات والخطين', dlg.themes === 5 && dlg.fonts === 2, dlg);
  // ⚠️ 44 بكسل = أصغر مقاس الصباع مابيغلطش عليه. الشغل من الموبايل.
  check('⭐⭐ وكل اختيار ارتفاعه ٤٤ بكسل على الأقل', dlg.small === 0, dlg);
  check('⭐⭐ والتغيير بيتطبّق وانت بتضغط (من غير زرار حفظ)', dlg.applied === 'olive', dlg);
  check('⭐⭐ و"رجّع زي الأول" بيرجّع ورق حراري', dlg.afterReset === null, dlg);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  pass.filter((x) => x.includes('⭐')).forEach((x) => console.log('   ' + x));
  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach((x) => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
