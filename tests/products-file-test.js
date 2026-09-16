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
    /fingerprint === uploadedFingerprint\(\)/.test(pf));

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
