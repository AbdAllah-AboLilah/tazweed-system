// ============================================================
// 🩹 خمس عيوب اتبلّغوا مع بعض — كل واحد وحارسه
// ============================================================
// ⚠️⚠️ اتبلّغوا بالنص في رسالة واحدة:
//
//   ١) "لما بفتح شاشة الطباعة ل اول مرة وبكتوب لاقي الموشر اختفي
//      ولازم اضغط علي خانة الكتاب تاني واكمل كتابه"
//   ٢) "دلوقتي لو برنامج qz مش شغال إعدادات الطابعة علي الجهاز مش هتفتح"
//   ٣) "انا حدثت البرنامج المساعد قعدت اعمل ري فريش لحد م الاصدار
//      الجديد بان في الاعدادات"
//   ٤) "لو فتحت حاجه بسرعة ... الحاجه اللي فاتحها بتقفل وبرجع تاني
//      ل الشاشة الرئيسية"
//   ٥) "في ارسال الاعدادات من التليفون مفيش خيار حجم الخط ولا بتاع
//      الاسم ولا السعر ولا الباركود"
//
// ⚠️ رقم ٣ حارسه في helper-probe-test (مع باقي منطق الفحص المخزّن).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 240)}` : ''));

// ============================================================
// ⚠⚠ حارس على **التوصيلة** مش على المنطق بس
// ============================================================
// التخريب اللي كشف الحاجة للفحص ده: رجّعنا
// `window.location.reload()` في مستمع controllerchange — وكل الفحوص
// عدّت. السبب إن الفحص بينده على reloadWhenSafe بإيده، فمابيشوفش
// إن المستمع بطّل ينده عليها خالص — يعني الحارس يبقى **كود ميت**
// والطبعة تتقطع زي ما كانت.
const up = fs.readFileSync(path.join(__dirname, '..', 'js/update-prompt.js'), 'utf8');
const listener = up.slice(up.indexOf("addEventListener('controllerchange'"), up.indexOf("addEventListener('controllerchange'") + 300);
check('⭐⭐⭐⭐⭐ مستمع التحديث بينده على الحارس مش على الريفريش مباشرة',
  /reloadWhenSafe\s*\(/.test(listener) && !/location\.reload\s*\(/.test(listener), listener.slice(0, 200));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // ⚠️ مقاس تليفون: كل حاجة هنا اتبلّغت من التليفون.
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));

  // ⚠⚠ update-prompt.js **مش** في الهارنس المشترك عن قصد:
  // هو بيسجّل service worker، ومافيش sw.js جوّه tests/ — فالمتصفح
  // بيكتب 404 في الـconsole، وsmoke.js بيفشل على أي رسالة console.
  // (جرّبت أضيفه للهارنس وكسر smoke فعلًا.)
  //
  // فبنحقنه بـ<script> عادي **بعد** ما الصفحة تحمّل:
  //   • الدوال بتبقى عامة (عكس addInitScript اللي بيلفّها في دالة)
  //   • وDOMContentLoaded يكون عدّى خلاص، فـinitUpdatePrompt مابتشتغلش
  //     ومافيش تسجيل service worker — وده المطلوب
  const upPath = path.join(__dirname, '..', 'js/update-prompt.js');

  await p.goto('http://localhost:8899/tests/harness.html');
  await p.addScriptTag({ path: upPath });
  await p.waitForFunction(() =>
    typeof openScreen === 'function' && typeof openPrinterSettings === 'function' &&
    typeof takeResumeScreen === 'function' && typeof openPrintSettingsDialog === 'function');

  // ============================================================
  // ⭐⭐⭐⭐⭐ (١) خانة البحث مابتفضاش لما الأصناف تخلص تحميل
  // ============================================================
  const r1 = await p.evaluate(async () => {
    const out = {};
    // ⚠️⚠️ الشرط اللي بيخلّي الفحص حاسم: الأصناف **لسه بتتحمّل** وهو
    // بيكتب. ده بالظبط أول فتحة، ومن غير التأخير ده الفحص بيعدّي حتى
    // والعطل موجود.
    productsCache = null;
    let done;
    const slow = new Promise((res) => { done = res; });
    window.loadProducts = () => slow.then(() => {
      productsCache = [{ code: '1', name: 'حجاب جيل بيور', barcode: '111', price: '50' }];
      // ⚠️ فهرس البحث لازم يتبني معاها — التحميل الحقيقي بيعمل الاتنين،
      // ومن غيره searchProducts بتقع (productsIndex[i] على null).
      productsIndex = buildProductsIndex(productsCache);
      return productsCache;
    });

    state.user = { uid: 'me' };
    state.profile = { id: 'me', role: 'owner' };
    state.view = 'dashboard';
    openScreen('print');
    await new Promise((r) => setTimeout(r, 60));

    const input = document.getElementById('print-search');
    input.focus();
    input.value = 'حجاب';
    state.printSearch = 'حجاب';

    done();
    await new Promise((r) => setTimeout(r, 300));

    const after = document.getElementById('print-search');
    out.sameElement = after === input;
    out.stillFocused = document.activeElement === after;
    out.keptText = after ? after.value : null;
    // ⚠️ ومش كفاية نأجّل الرسم: قايمة النتايج لازم تتحدّث **وهو بيكتب**،
    // وإلا بتفضل "جارٍ تحميل الأصناف..." لحد ما يسيب الخانة.
    const box = document.getElementById('print-results');
    out.resultsFilled = !!box && box.textContent.indexOf('جارٍ تحميل') === -1;
    out.resultsHaveItem = !!box && box.textContent.indexOf('حجاب جيل بيور') !== -1;
    return out;
  });

  check('⭐⭐⭐⭐⭐ الأصناف خلصت تحميل → خانة البحث **ما اتهدّتش**',
    r1.sameElement === true, r1.sameElement);
  check('⭐⭐⭐⭐⭐ والمؤشر لسه فيها (الكيبورد مايتقفلش)',
    r1.stillFocused === true, r1.stillFocused);
  check('⭐⭐⭐⭐⭐ واللي كتبه ما اتمسحش',
    r1.keptText === 'حجاب', r1.keptText);
  check('⭐⭐⭐⭐ وقايمة النتايج اتحدّثت وهو بيكتب (مش مستنية يسيب الخانة)',
    r1.resultsFilled === true && r1.resultsHaveItem === true,
    { filled: r1.resultsFilled, item: r1.resultsHaveItem });

  // ============================================================
  // ⭐⭐⭐⭐⭐ (٢) إعدادات الطابعة بتفتح من غير QZ ولا المساعد
  // ============================================================
  const r2 = await p.evaluate(async () => {
    const out = {};
    saveSelectedPrinter('label', 'XP-235B');
    saveSelectedPrinter('restock', 'XP-80C');
    saveDeviceName('كمبيوتر الكاشير');

    helperCache = null; helperCacheAt = 0;
    const realFetch = window.fetch;
    window.fetch = async () => { throw new Error('مش شغّال'); };
    window.qz = undefined;
    // ⚠️ زرار الحفظ بينده على نبضة الجهاز فورًا، وهي بتكتب في السحابة.
    // من غير سحابة مقلّدة بترمي، والخطأ من المحاكاة مش من النظام.
    const q = {};
    q.where = () => q; q.orderBy = () => q; q.limit = () => q;
    q.onSnapshot = () => () => {}; q.get = async () => ({ empty: true, docs: [], forEach: () => {} });
    q.doc = () => ({
      set: async () => {}, get: async () => ({ exists: false, data: () => ({}) }),
      update: async () => {}, delete: async () => {}, onSnapshot: () => () => {},
    });
    q.add = async () => ({ id: 'x' });
    window.db = { collection: () => q };

    await openPrinterSettings();
    await new Promise((r) => setTimeout(r, 400));

    const fields = document.querySelector('#qz-printer-fields');
    out.bodyVisible = !!(fields && fields.offsetParent !== null);
    out.nameReachable = !!(document.querySelector('#qz-device-name') &&
      document.querySelector('#qz-device-name').offsetParent !== null);
    out.nameValue = document.querySelector('#qz-device-name').value;
    // الرسالة لسه بتقول للمستخدم يعمل إيه
    out.saysWhatToDo = /برنامج المساعد|QZ Tray/.test(document.querySelector('#qz-status-line').textContent);

    // المفاتيح جوّه قسم مطوي — بيتفتح بضغطة
    const tw = document.querySelector('.pset-toggle[data-pset="tweaks"]');
    if (tw) tw.click();
    await new Promise((r) => setTimeout(r, 120));
    out.tweaksReachable = Array.from(document.querySelectorAll('[data-tweak]'))
      .some((e) => e.offsetParent !== null);

    // ============================================================
    // ⭐⭐⭐⭐⭐ والحفظ **مايمسحش** الطابعة المحفوظة
    // ============================================================
    // ⚠️⚠️ ده الجزء الخطر: القايمة فاضية، فالخانة كانت هتقع على
    // "— اختار طابعة —" وأول ضغطة حفظ تمسح اسم الطابعة المتظبطة.
    // يعني فتح الإعدادات وQZ مقفول كان **بيضيّع الإعداد**.
    out.labelSel = document.querySelector('#qz-label-printer-select').value;
    document.querySelector('#qz-settings-save').click();
    await new Promise((r) => setTimeout(r, 150));
    out.labelAfterSave = getSavedPrinter('label');
    out.restockAfterSave = getSavedPrinter('restock');
    out.nameAfterSave = getDeviceName();

    window.fetch = realFetch;
    const ov = document.querySelector('#qz-printer-fields');
    if (ov && ov.parentNode && ov.parentNode.parentNode) {
      try { document.body.removeChild(ov.parentNode.parentNode); } catch (e) { /* اتقفلت خلاص */ }
    }
    return out;
  });

  check('⭐⭐⭐⭐⭐ مفيش QZ ولا مساعد → النافذة **بتفتح** مش بتفضل فاضية',
    r2.bodyVisible === true, r2.bodyVisible);
  check('⭐⭐⭐⭐⭐ واسم الجهاز موصول (ده اللي مكانش ينفع يتظبط)',
    r2.nameReachable === true && r2.nameValue === 'كمبيوتر الكاشير',
    { reachable: r2.nameReachable, value: r2.nameValue });
  check('⭐⭐⭐⭐⭐ والمفاتيح موصولة',
    r2.tweaksReachable === true, r2.tweaksReachable);
  check('⭐⭐⭐ والرسالة لسه بتقول يعمل إيه',
    r2.saysWhatToDo === true, r2.saysWhatToDo);
  check('⭐⭐⭐⭐⭐ والطابعة المحفوظة لسه مختارة رغم إن القايمة فاضية',
    r2.labelSel === 'XP-235B', r2.labelSel);
  check('⭐⭐⭐⭐⭐ والحفظ **مامسحش** الطابعتين (ده كان هيضيّع الإعداد)',
    r2.labelAfterSave === 'XP-235B' && r2.restockAfterSave === 'XP-80C',
    { label: r2.labelAfterSave, restock: r2.restockAfterSave });

  // ============================================================
  // ⭐⭐⭐⭐⭐ (٥) خانات حجم الخط ليها عنوان بيبان
  // ============================================================
  const r5 = await p.evaluate(() => {
    const out = {};
    state.printStations = [{
      id: 'dev-1', deviceName: 'كمبيوتر', labelPrinter: 'P', restockPrinter: 'P',
      printers: ['P'], appVersion: '0.94.0', lastSeen: { toMillis: () => Date.now() },
    }];
    openPrintSettingsDialog('dev-1');
    const ids = ['ps-namemm', 'ps-codemm', 'ps-pricemm'];
    out.allVisible = ids.every((id) => {
      const el = document.getElementById(id);
      return el && el.offsetParent !== null;
    });
    // ⚠️⚠️ الحارس الحقيقي: العنوان اللي **فوق الخانات مباشرة**، مش أي
    // مكان في الصفحة. الخانات كانت ظاهرة قبل التعديل كمان — اللي
    // اتغيّر إنها بقت تحت عنوان صح.
    const first = document.getElementById('ps-namemm');
    const group = first.closest('div[style*="flex"]');
    const heading = group ? group.previousElementSibling : null;
    out.headingText = heading ? heading.textContent.trim() : '';
    out.headingSaysFontSize = /حجم الخط/.test(out.headingText);
    // والاسم جوّه الخانة نفسه بيقول "حجم خط"
    out.labelsSayFontSize = ids.every((id) => {
      const el = document.getElementById(id);
      const lab = el.parentNode.querySelector('label');
      return lab && /حجم خط/.test(lab.textContent);
    });
    // ⚠️ والـid ما اتغيّرش — القرايه والحفظ معلّقين عليه
    out.idsIntact = ids.every((id) => !!document.getElementById(id));
    const ov = first.closest('div[style*="position:fixed"]');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    return out;
  });

  check('⭐⭐⭐⭐ التلات خانات ظاهرة على مقاس التليفون',
    r5.allVisible === true, r5.allVisible);
  check('⭐⭐⭐⭐⭐ وفوقها عنوان فيه **"حجم الخط"** (كانوا تحت "📦 الدفعات")',
    r5.headingSaysFontSize === true, r5.headingText);
  check('⭐⭐⭐⭐ وأسماء الخانات نفسها بتقول "حجم خط"',
    r5.labelsSayFontSize === true, r5.labelsSayFontSize);
  check('⭐⭐⭐⭐⭐ والـid ما اتغيّرش (الحفظ والقرايه زي ما هم)',
    r5.idsIntact === true, r5.idsIntact);

  // ============================================================
  // ⭐⭐⭐⭐⭐ (٤) التحديث مايقطعش طبعة، وبيرجّع لنفس الشاشة
  // ============================================================
  // ⚠️⚠️ بريفريش **حقيقي** — مش تقليد. لو قلّدنا location.reload
  // مكناش هنعرف إن الاستئناف بيعيش بعد الريفريش أصلًا، وده بيت القصيد.
  await p.evaluate(() => {
    window.__alive = true;
    state.user = { uid: 'me' }; state.profile = { id: 'me', role: 'owner' };
    state.screen = 'print';
    // ⚠⚠ لازم نسيب خانة البحث اللي فوق: التحديث بيستنى **الكتابة**
    // كمان مش الطباعة بس — وده مقصود. لو سبنا المؤشر في الخانة،
    // الفحص هيفشل وهو في الحقيقة بيشتغل صح.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    // ⚠️ اسم مجرّد مش window.activePrintCancel: المتغيّر معرّف بـlet
    // فمش خاصية على window، والكتابة على window مابتوصلش للكود.
    activePrintCancel = { requested: false, wake: null };
    reloadWhenSafe(0);
  });
  await p.waitForTimeout(1500);
  const alive = await p.evaluate(() => window.__alive === true);
  const noMarkYet = await p.evaluate(() => !localStorage.getItem('tazweed_resume_screen'));

  check('⭐⭐⭐⭐⭐ طبعة شغّالة → التحديث **مابيقفلش** الصفحة',
    alive === true, alive);
  check('⭐⭐⭐ ولسه مسجّلش علامة رجوع', noMarkYet === true, noMarkYet);

  const navigated = p.waitForNavigation({ timeout: 10000 }).then(() => true).catch(() => false);
  await p.evaluate(() => { activePrintCancel = null; });
  const reloaded = await navigated;
  check('⭐⭐⭐⭐⭐ والطبعة خلصت → بيعمل الريفريش فعلًا (مش بيلغيه)',
    reloaded === true, reloaded);

  // ⚠️ الريفريش شال السكربت المحقون — نحقنه تاني.
  // (والعلامة نفسها في localStorage، فهي عاشت الريفريش زي ما هي —
  //  وده بيت القصيد.)
  await p.addScriptTag({ path: upPath });
  await p.waitForFunction(() => typeof takeResumeScreen === 'function');
  const r4 = await p.evaluate(() => {
    const out = {};
    out.resumed = takeResumeScreen();
    out.resumedTwice = takeResumeScreen();
    // ⚠️ علامة قديمة بتترمي: المتصفح ممكن يكون قفل واتفتح بكرة.
    localStorage.setItem('tazweed_resume_screen', JSON.stringify({ screen: 'print', at: Date.now() - 300000 }));
    out.old = takeResumeScreen();
    // ⚠️ واسم شاشة مش موجودة بيترمي كمان — وإلا شاشة فاضية.
    localStorage.setItem('tazweed_resume_screen', JSON.stringify({ screen: 'شاشة-مخترعة', at: Date.now() }));
    out.bad = takeResumeScreen();
    // ⚠️ والرئيسية مابتتسجّلش أصلًا (هي الافتراضي).
    state.screen = 'home';
    rememberScreenForResume();
    out.home = takeResumeScreen();
    return out;
  });

  check('⭐⭐⭐⭐⭐ وبعد ما فتح تاني رجع لنفس الشاشة',
    r4.resumed === 'print', r4.resumed);
  check('⭐⭐⭐⭐ ومرة واحدة بس (مايفضلش يرجّعه كل فتحة)',
    r4.resumedTwice === '', r4.resumedTwice);
  check('⭐⭐⭐⭐ وعلامة قديمة بتترمي', r4.old === '', r4.old);
  check('⭐⭐⭐⭐ واسم شاشة مش موجودة بيترمي', r4.bad === '', r4.bad);
  check('⭐⭐⭐ والشاشة الرئيسية مابتتسجّلش', r4.home === '', r4.home);

  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
