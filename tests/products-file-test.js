// ============================================================
// 📦 ربط ملف الأصناف بالبرنامج المساعد
// ============================================================
// اتطلب بالنص: "حط خانة في المساعد ... وانا اختار مكان الملف ... وكمان
// حط تحت شيك بوكس الرفع التلقائي بمجرد تغير اي حاجه في الملف وعاوز
// استبدال كامل ... وكمان حاجه عاوز العملية دي تبان كامله في السجل".
//
// ⚠️⚠️ أخطر حاجة هنا هي **سطر العناوين**: الملف الخام اللي بيطلع من
// الـERP فوقه سطر وعلى الشمال عمودين زيادة — اتقال بالنص "انا بشيل
// اول ٢ عمود واول صف عشان يظبط الملف". ولو البرنامج هيرفع لوحده،
// لازم يعرف يلاقي العناوين من غير ما حد ينضّف الملف بإيده.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const pf = fs.readFileSync(path.join(root, 'js/products-file.js'), 'utf8');
const prod = fs.readFileSync(path.join(root, 'js/products.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const testpage = fs.readFileSync(path.join(root, 'helper/testpage.go'), 'utf8');
const mainGo = fs.readFileSync(path.join(root, 'helper/main.go'), 'utf8');

const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof findProductsHeaderRow === 'function');

  const headerOf = (rows) =>
    p.evaluate((rows) => {
      const h = findProductsHeaderRow(rows);
      return h ? { row: h.row, headers: h.headers, guesses: h.guesses } : null;
    }, rows);

  // ============================================================
  // 1) ⭐⭐ الملف الخام زي ما بيطلع من الـERP
  // ============================================================
  // سطر عنوان فوق، وعمودين فاضيين على الشمال — والعناوين في السطر التاني.
  const raw = await headerOf([
    ['', '', 'كشف الأصناف', '', '', '', '', ''],
    ['', '', 'اسم الصنف', 'الباركود', 'سعر البيع', 'السعر بعد الخصم', 'القسم الرئيسي', 'القسم'],
    ['', '', 'ايشارب سادة', '10632103', '250', '199', 'ايشاربات', 'سادة'],
  ]);
  check('⭐⭐ الملف الخام: بيلاقي سطر العناوين وهو **مش** أول سطر',
    raw && raw.row === 1, raw);
  check('⭐⭐ والعمودين الفاضيين على الشمال مابيلخبطوش التخمين',
    raw && raw.headers[raw.guesses.name] === 'اسم الصنف' &&
      raw.headers[raw.guesses.barcode] === 'الباركود', raw && raw.guesses);
  // نفس فخ الأسعار اللي في import-columns-test — لازم يفضل صح هنا كمان
  check('⭐⭐ "السعر بعد الخصم" → السعر الفعلي، و"سعر البيع" → المشطوب',
    raw && raw.headers[raw.guesses.price] === 'السعر بعد الخصم' &&
      raw.headers[raw.guesses.origPrice] === 'سعر البيع', raw && raw.guesses);
  check('⭐ و"القسم" → الفرعي', raw && raw.headers[raw.guesses.subDept] === 'القسم', raw && raw.guesses);

  // ============================================================
  // 2) الملف اللي اتنضّف بالإيد — العناوين في أول سطر
  // ============================================================
  const clean = await headerOf([
    ['اسم الصنف', 'الباركود', 'سعر البيع', 'السعر بعد الخصم', 'القسم الرئيسي', 'القسم'],
    ['ايشارب', '1', '2', '1.5', 'أ', 'ب'],
  ]);
  check('الملف المنضّف: العناوين في أول سطر', clean && clean.row === 0, clean);

  // ============================================================
  // 3) ⭐ ملف غلط = وقفة، مش رفع نص قايمة
  // ============================================================
  // ⚠️ ده اللي بيمنع إن حد يحط ملف تاني في نفس المكان بالغلط
  // فيتمسح كل الأصناف ويتحط مكانها حاجة تانية خالص.
  const wrong = await headerOf([
    ['التاريخ', 'الرصيد', 'ملاحظات'],
    ['2026-01-01', '5', 'x'],
  ]);
  check('⭐ ملف مالوش علاقة → بيرفض (مافيش اسم ولا باركود)', wrong === null, wrong);

  // ============================================================
  // 4) ⭐⭐ الرفع بيستخدم كود الاستيراد نفسه — مش نسخة تانية
  // ============================================================
  // السبب مكتوب في الملف: نسخة تانية من قراءة الأعمدة معناها إنها
  // هتختلف يوم ما حد يعدّل واحدة وينسى التانية → ملصقات بأسعار غلط.
  check('⭐⭐ بيستخدم buildProductList بتاع الاستيراد', /buildProductList\(/.test(pf));
  check('⭐⭐ وguessAllColumns بتاع الاستيراد', /guessAllColumns\(/.test(pf));
  check('⭐⭐ وsaveProducts بتاع الاستيراد (استبدال كامل)', /saveProducts\(/.test(pf));
  // ⚠️ بنشيل التعليقات الأول: الشرح **بيذكر** أسماء الأعمدة عن قصد
  // (عشان اللي بيقرا يفهم الفخ)، واللي ممنوع هو إن الكود نفسه يقرا
  // بيها — يعني نسخة تانية من المنطق.
  const pfCode = pf.replace(/^\s*\/\/.*$/gm, '');
  check('مافيش نسخة تانية من أسماء الأعمدة في كود products-file.js',
    !/السعر بعد الخصم|سعر البيع/.test(pfCode));

  // ============================================================
  // 5) ⭐⭐ البصمة — من غيرها الملف بيترفع كل مرة تفتح النظام
  // ============================================================
  check('⭐⭐ البصمة بتتحفظ في meta مع الرفع',
    /sourceFingerprint/.test(pf) && /extraMeta/.test(prod));
  check('⭐⭐ وsaveProducts بتحطها في السحابة **وفي الذاكرة**',
    (prod.match(/extraMeta \|\| \{\}/g) || []).length >= 2, (prod.match(/extraMeta \|\| \{\}/g) || []).length);
  check('⭐⭐ والبصمة اللي بتتحفظ جاية من ترويسة اللي اتنزّل فعلًا',
    /X-Tazweed-Fingerprint/.test(pf));
  check('⭐ ومافيش رفع لو البصمة زي ما هي',
    /st\.fingerprint === known/.test(pf));

  // ============================================================
  // 6) السجل — اتطلب بالنص إن العملية تبان إنها من البرنامج
  // ============================================================
  check('⭐ الرفع بيتسجّل في السجل', /logActivity\(\{ action: 'import_products_file'/.test(pf));
  check('⭐⭐ والسجل بيكتب إنها من **البرنامج المساعد**',
    /import_products_file/.test(app) && /اترفع من البرنامج المساعد/.test(app));
  check('والعملية ليها قسم في تبويبات السجل (مش كارت فاضي)',
    /'import_products_file'\]/.test(app) || /import_products', 'import_products_file'/.test(app));

  // ============================================================
  // 7) الشريط اللي بيسأل لما الرفع التلقائي مقفول
  // ============================================================
  check('⭐ فيه شريط بيسأل "ترفعه؟" لما المفتاح مقفول', /pfile-upload/.test(pf) && /ترفعه/.test(pf));
  check('⭐ و"مش دلوقتي" بتسكّته لنفس النسخة بس', /pfileDismissed/.test(pf));
  check('والشريط بيتحط في شاشة الأصناف', /productsFileBannerHTML\(\)/.test(prod));
  check('وأزراره متوصّلة', /attachProductsFileEvents\(\)/.test(prod));

  // ============================================================
  // 8) ⭐ السرعة — الشرط اللي اتقال بالنص "سرعة النظام متقليش"
  // ============================================================
  check('⭐⭐ مهلة النداء على البرنامج قصيرة (الجهاز اللي مافيهوش بيعدّي)',
    /PFILE_PROBE_MS = 1[0-9]{3}/.test(pf), (pf.match(/PFILE_PROBE_MS = \d+/) || [])[0]);
  check('⭐⭐ والحالة متخزّنة — مش نداء مع كل حرف بحث في شاشة الأصناف',
    /PFILE_STATE_TTL_MS/.test(pf) && /Date\.now\(\) - pfileStateAt < PFILE_STATE_TTL_MS/.test(pf));
  check('⭐ والفحص بعد الدخول بشوية مش وقته', /PFILE_BOOT_DELAY_MS/.test(pf) && /scheduleProductsFileCheck/.test(app));

  // ============================================================
  // 9) الصلاحية — مش أي حد يرفع
  // ============================================================
  check('⭐ الفحص بيقف لو المستخدم مالوش صلاحية تحديث الأصناف',
    /canManageProducts\(state\.profile\)/.test(pf));

  // ============================================================
  // 10) خانة البرنامج المساعد نفسها
  // ============================================================
  check('⭐⭐ زرار "اختار الملف" بيفتح شاشة الويندوز من البرنامج',
    /products\/file\/pick/.test(testpage) && /products\/file\/pick/.test(mainGo));
  check('⭐ وفيه خانة مسار تتكتب بالإيد كمان', /pf-path/.test(testpage));
  check('⭐ وشيك بوكس الرفع التلقائي', /pf-auto/.test(testpage) && /autoUpload/.test(testpage));
  check('والبرنامج بيقدّم الملف نفسه للنظام', /products\/file\/raw/.test(mainGo));
  check('والملف متحمّل في الصفحة', /js\/products-file\.js/.test(idx));

  // ============================================================
  // 11) ⭐⭐ السلوك نفسه — بمساعد مزيّف في الصفحة
  // ============================================================
  // ⚠️ العطل اللي الفحوص دي اتعملت عشانه، اتبلّغ بالنص:
  //   "اخترت المكان وعملت تحديث تلقائي ومفيش اي حاجه بتتحدث"
  // والسبب إن الفحص كان بيحصل **مرة واحدة** بعد الدخول، والترتيب
  // الطبيعي إن النظام بيبقى مفتوح قبل ما تظبّط البرنامج.
  const run = (opts) =>
    p.evaluate(async (opts) => {
      const trace = [];
      // ⚠️ بالاسم المجرّد مش window.: المتغيّرات المعرّفة بـlet مابتبقاش
      // خصائص على window، فـwindow.x = ... بيعمل حاجة تانية خالص
      // والكود بيفضل شايف القديمة.
      state.profile = { role: 'owner' };
      state.screen = 'products';
      window.canManageProducts = () => true;
      window.isServerReachable = () => true;
      window.render = () => {};
      window.logActivity = () => trace.push('log');
      productsMeta = { sourceFingerprint: opts.saved };
      window.parseProductsFileBuffer = async () => [{ name: 'ص', barcode: '1', price: 1 }];
      window.saveProducts = async (list, prog, extra) =>
        trace.push('save:' + JSON.stringify(extra));
      window.fetch = async (url) => {
        if (String(url).endsWith('/products/file')) {
          return {
            ok: true,
            json: async () => ({
              path: 'C:/x.xlsx', exists: true,
              fingerprint: opts.onDisk, autoUpload: opts.auto,
            }),
          };
        }
        return {
          ok: true,
          headers: { get: () => opts.header },
          arrayBuffer: async () => new ArrayBuffer(8),
        };
      };
      pfileState = null; pfileStateAt = 0; pfileNote = ''; pfileDismissed = '';
      await checkProductsFile({ force: true });
      return { trace, note: pfileNote, banner: productsFileBannerHTML() };
    }, opts);

  const same = await run({ saved: 'AAA', onDisk: 'AAA', auto: true, header: 'AAA' });
  check('⭐⭐ نفس الملف = مافيش رفع (مش 24 كتابة كل مرة تفتح النظام)',
    same.trace.length === 0, same.trace);

  const changed = await run({ saved: 'OLD', onDisk: 'NEW', auto: true, header: 'NEW' });
  check('⭐⭐ الملف اتغيّر + الرفع التلقائي مفتوح = بيرفع',
    changed.trace.join('|') === 'save:{"sourceFingerprint":"NEW"}|log', changed.trace);

  // ⚠️⚠️ ده اللي اتقاس في متصفح حقيقي: من غير Access-Control-Expose-Headers
  // الصفحة بتقرا الترويسة **فاضية**، فالبصمة بتتحفظ فاضية — ونفس الملف
  // (47 ألف صنف) بيترفع من أول وجديد كل مرة النظام يفتح.
  const noHeader = await run({ saved: 'OLD', onDisk: 'NEW', auto: true, header: null });
  check('⭐⭐ والترويسة لو ماوصلتش (برنامج قديم) بيرجع لبصمة الحالة — مش فاضي',
    noHeader.trace[0] === 'save:{"sourceFingerprint":"NEW"}', noHeader.trace);

  const off = await run({ saved: 'OLD', onDisk: 'NEW', auto: false, header: 'NEW' });
  check('⭐⭐ الرفع التلقائي مقفول = مافيش رفع من ورا المستخدم',
    off.trace.length === 0, off.trace);
  check('⭐ وبيسأل في شريط شاشة الأصناف', /pfile-upload/.test(off.banner));

  // ============================================================
  // 11ب) ⭐ النظام بيقول للبرنامج إن الرفع ماشي
  // ============================================================
  // ⚠️ البرنامج مابيرفعش — فمن غير الأسطر دي صفحته عمرها ما هتعرف
  // إن فيه حاجة بتحصل، والشريط عمره ما هيتحرك.
  const prog = await p.evaluate(async () => {
    const sent = [];
    state.profile = { role: 'owner' };
    state.screen = 'products';
    window.canManageProducts = () => true;
    window.isServerReachable = () => true;
    window.render = () => {};
    window.logActivity = () => {};
    productsMeta = { sourceFingerprint: 'OLD' };
    window.parseProductsFileBuffer = async () => [{ name: 'ص', barcode: '1', price: 1 }];
    window.saveProducts = async (list, onProgress) => {
      if (onProgress) onProgress(2000, 4000);
    };
    window.fetch = async (url, opt) => {
      const u = String(url);
      if (u.endsWith('/products/file/progress')) {
        sent.push(JSON.parse(opt.body).state);
        return { ok: true, json: async () => ({}) };
      }
      if (u.endsWith('/products/file')) {
        return { ok: true, json: async () => ({ path: 'x', exists: true, fingerprint: 'NEW', autoUpload: true }) };
      }
      return { ok: true, headers: { get: () => 'NEW' }, arrayBuffer: async () => new ArrayBuffer(8) };
    };
    pfileState = null; pfileStateAt = 0; pfileNote = '';
    await checkProductsFile({ force: true });
    return sent;
  });
  check('⭐⭐ بيقول للبرنامج: بدأ / ماشي / خلص',
    prog.join(',') === 'start,working,done', prog);

  // ============================================================
  // 11ج) ⭐⭐⭐ نفس الملف مايترفعش تاني — حتى والأصناف مش متحمّلة
  // ============================================================
  // ⚠️⚠️ العطل اللي اتقاس واتصلّح، اتبلّغ بالنص:
  //   "المساعد حاسسه انه بيرفع كذا مرة مفيش طريقة يعرف بيها ان رفع
  //    الملف ده قبل كده"
  //
  // والسبب: البصمة في مستند meta، وmeta مابتتقرا غير جوّه loadProducts
  // — واللي مابيشتغلش إلا لما تفتح شاشة الأصناف أو الطباعة. والفحص
  // بيجري بعد الدخول بـ6 ثواني وانت لسه على الرئيسية، فالبصمة فاضية
  // و"الملف اتغيّر" → ارفع. كل مرة.
  //
  // ⚠️ القياس قبل التصليح: 3 فتحات = 3 رفعات لنفس الملف بالظبط.
  const dedup = await p.evaluate(async () => {
    const out = { uploads: 0, metaReads: 0 };
    state.profile = { role: 'owner' }; state.screen = 'home';
    window.canManageProducts = () => true;
    window.isServerReachable = () => true;
    window.render = () => {};
    window.logActivity = () => {};
    window.parseProductsFileBuffer = async () => [{ name: 'ص', barcode: '1', price: 1 }];
    let cloudFP = 'SAME';
    window.saveProducts = async () => { out.uploads++; };
    window.db = { collection: () => ({ doc: () => ({ get: async () => {
      out.metaReads++;
      return { exists: true, data: () => ({ count: 5, sourceFingerprint: cloudFP }) };
    } }) }) };
    const helper = (fp) => async (url) => {
      const u = String(url);
      if (u.endsWith('/products/file/progress')) return { ok: true, json: async () => ({}) };
      if (u.endsWith('/products/file'))
        return { ok: true, json: async () => ({ path: 'x', exists: true, fingerprint: fp, autoUpload: true }) };
      return { ok: true, headers: { get: () => fp }, arrayBuffer: async () => new ArrayBuffer(8) };
    };
    // ⚠️ الأصناف **مش** متحمّلة — دي الحالة الطبيعية بعد الدخول
    productsMeta = null; pfileKnownFP = null; pfileKnownAt = 0;
    window.fetch = helper('SAME');
    for (let i = 0; i < 3; i++) {
      pfileState = null; pfileStateAt = 0;
      await checkProductsFile({ force: true });
    }
    out.sameFile = out.uploads;

    // الملف اتغيّر فعلًا
    window.fetch = helper('NEW');
    pfileState = null; pfileStateAt = 0; pfileKnownAt = 0;
    await checkProductsFile({ force: true });
    out.afterChange = out.uploads;

    // القراءة وقعت (مفيش نت) = عند الشك مانرفعش
    window.db = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('offline'); } }) }) };
    productsMeta = null; pfileKnownFP = null; pfileKnownAt = 0;
    pfileState = null; pfileStateAt = 0;
    await checkProductsFile({ force: true });
    out.afterOffline = out.uploads;
    return out;
  });
  check('⭐⭐⭐ نفس الملف + 3 فتحات للنظام = صفر رفع (والأصناف مش متحمّلة)',
    dedup.sameFile === 0, dedup);
  check('⭐⭐ ولما الملف يتغيّر فعلًا بيرفع مرة واحدة',
    dedup.afterChange === 1, dedup);
  check('⭐⭐⭐ ولما مانعرفش (القراءة وقعت) **مابنرفعش** — الشك مايستبدلش 47 ألف صنف',
    dedup.afterOffline === 1, dedup);
  check('⭐ والتأكد بيكلّف قراءة واحدة صغيرة مش تحميل الأصناف كلها',
    dedup.metaReads <= 3, dedup);
  check('⭐⭐ وفيه قراءة أخيرة قبل الرفع مباشرة (جهاز تاني يكون سبقنا)',
    /uploadedFingerprint\(true\)/.test(pf));

  // ============================================================
  // 12) ⭐ الفحص بيتعاد — مش مرة واحدة بعد الدخول وخلاص
  // ============================================================
  check('⭐⭐ فتح شاشة الأصناف بيسأل البرنامج من الأول',
    /screen === 'products' && typeof checkProductsFile/.test(app));
  check('⭐⭐ والرجوع للنظام بعد ما تسيبه بيسأل كمان (visibilitychange)',
    /visibilitychange/.test(pf) && /force: true/.test(pf));
  check('⭐ وفيه فحص كل شوية والصفحة مفتوحة', /PFILE_WATCH_MS/.test(pf));
  check('⭐ ومابيشتغلش والصفحة مخفية', /document\.hidden/.test(pf));

  // والشريط نفسه في صفحة البرنامج
  check('⭐ الشريط موجود في صفحة البرنامج وبيتحرك بالنسبة',
    /pf-bar/.test(testpage) && /pfDrawProgress/.test(testpage));
  check('⭐⭐ وسطر "آخر رفع" بنفس شكل تاريخ النظام (اسم اليوم الأول)',
    /pfStamp/.test(testpage) && /weekday:'long'/.test(testpage));
  check('⭐⭐ وبيحذّر لو الملف اتغيّر بعد آخر رفع',
    /changedSinceUpload/.test(testpage) && /changedSinceUpload/.test(mainGo + testpage));
  check('⭐ والسؤال كل ثانية بيقف أول ما الرفع يخلص', /pfStopPoll/.test(testpage));

  // ============================================================
  // 13) ⬆️ الرفع اليدوي — زرار «ارفع دلوقتي»
  // ============================================================
  // اتطلب بالنص: "ممكن تضيف زرار رفع في البرنامج المساعد عشان لو مش
  // متاكد انه رفع اضغط عليه يرفع علي طول يعني رفع يدوي".
  //
  // ⚠️⚠️ والحاجة اللي الفحص ده موجود عشانها: الرفع اليدوي لازم
  // **يعدّي من فوق حارس التكرار**. الحارس ده معمول للرفع التلقائي
  // (يمنع كل جهاز في المحل يرفع نفس الـ47 ألف صنف)، لكن اللي دايس
  // بإيده وهو مش متأكد، إجابته المفروضة إن الرفع يحصل.
  check('⭐⭐⭐ الرفع اليدوي بيعدّي من فوق حارس التكرار',
    /if \(!o\.manual && st0 && st0\.fingerprint\)/.test(pf), pf.slice(0, 0));
  check('⭐⭐ والزرار الثابت بيبان بس لو فيه ملف متظبّط فعلًا',
    /function productsManualUploadHTML/.test(pf) &&
    /if \(!st \|\| !st\.path \|\| !st\.exists\) return ''/.test(pf));
  check('⭐⭐ ومربوط بصلاحية إدارة الأصناف',
    /productsManualUploadHTML[\s\S]{0,400}canManageProducts/.test(pf));
  check('⭐ وبيتحط في شريط أدوات شاشة الأصناف',
    /productsManualUploadHTML\(\)/.test(prod));
  check('⭐⭐ ولو الملف هو نفسه المرفوع بيسأل الأول (24 كتابة على الفاضي)',
    /pfile-manual[\s\S]{0,900}confirm\(/.test(pf));
  check('⭐⭐ ومفيش نت = بيقول إن الدوسة مامشيتش، مش "هيترفع بعدين"',
    /o\.manual[\s\S]{0,120}الرفع مش هيشتغل/.test(pf));

  // ⚠️⚠️ حدود المسؤولية: البرنامج **بيفتح النظام**، مش بيرفع.
  check('⭐⭐⭐ زرار البرنامج بيفتح النظام على ?upload=1 (مش بيرفع بنفسه)',
    /upload-now/.test(mainGo) && /pf-now/.test(testpage));
  check('⭐⭐ والنظام بيقرا العلامة ويرفع يدوي',
    /consumeUploadFlag/.test(pf) && /manual: true/.test(pf));
  check('⭐⭐⭐ والعلامة بتتشال من العنوان (ريفريش مايرفعش تاني)',
    /history\.replaceState/.test(pf) && /q\.delete\('upload'\)/.test(pf));

  const flag = await p.evaluate(() => {
    // بنحاكي الفتح على العلامة ونتأكد إنها بتتقرا مرة واحدة بس
    history.replaceState(null, '', location.pathname + '?upload=1&x=2');
    const first = consumeUploadFlag();
    const second = consumeUploadFlag();
    return { first, second, url: location.search };
  });
  check('⭐⭐⭐ العلامة بتتقرا مرة واحدة بس', flag.first === true && flag.second === false, flag);
  check('⭐⭐ والباقي في العنوان مابيتشالش', /x=2/.test(flag.url) && !/upload/.test(flag.url), flag);

  // ============================================================
  // 14) 🔢 الرقم القصير — ن٣
  // ============================================================
  // اتطلب بالنص: "ايه رايك تكتب جوه بعد التحديث تكتب جواه التاريخ
  // والوقت ... او حتي تكتب اي دي ارقام مثلا".
  //
  // ⚠️⚠️ وأهم فحص هنا: **الشكل واحد في النظام وفي البرنامج**. الرقم
  // ده وظيفته الوحيدة إنه يتقارن بالعين بين شاشتين — ولو واحد كتبه
  // صغير والتاني كبير، أو واحد 8 حروف والتاني 6، المقارنة نفسها
  // بايظة وهي اللي الميزة كلها قايمة عليها.
  const codeGo = /func shortFP[\s\S]{0,400}?strings\.ToUpper\(fp\[:8\]\)/.test(
    fs.readFileSync(path.join(root, 'helper/productsfile.go'), 'utf8')
  );
  check('⭐⭐⭐ البرنامج: 8 حروف كبيرة', codeGo);

  const codeJs = await p.evaluate(() => {
    const out = {};
    productsMeta = { sourceFingerprint: 'b8f1a2c3d4e5f60718293a4b5c6d7e8f90' };
    out.full = productsShortCode();
    out.html = productsShortCodeHTML();
    productsMeta = { sourceFingerprint: 'abc' };
    out.tooShort = productsShortCode();
    productsMeta = {};
    out.missing = productsShortCode();
    productsMeta = null;
    out.noMeta = productsShortCode();
    return out;
  });
  check('⭐⭐⭐ النظام: نفس الـ8 حروف الكبيرة بالظبط', codeJs.full === 'B8F1A2C3', codeJs);
  check('⭐⭐ وبصمة ناقصة = مفيش رقم (مش نص مقصوص)',
    codeJs.tooShort === '' && codeJs.missing === '' && codeJs.noMeta === '', codeJs);
  check('⭐ والسطر بيقول إنه لازم يطابق اللي في البرنامج',
    /لازم يطابق/.test(codeJs.html), codeJs.html);
  check('⭐ والسطر بيبان في شاشة الأصناف وفي شاشة الطباعة',
    /productsShortCodeHTML\(\)/.test(prod) &&
    /productsShortCodeHTML/.test(fs.readFileSync(path.join(root, 'js/print-screen.js'), 'utf8')));
  check('⭐⭐ والبرنامج بيوري رقم الملف ورقم المرفوع مع بعض',
    /st\.shortCode/.test(testpage) && /st\.lastUploadShort/.test(testpage));

  check('مفيش أخطاء في الصفحة', errors.length === 0, errors);
  await b.close();

  if (fail.length) {
    console.log(`❌ فشل (${fail.length}):`);
    fail.forEach((f) => console.log('   ' + f));
    console.log(`\n✅ نجح (${pass.length})`);
    process.exit(1);
  }
  console.log(`✅ نجح (${pass.length})`);
  pass.filter((x) => x.startsWith('⭐')).forEach((x) => console.log('   ' + x));
})();
