// فحص شامل للنظام — الشاشات والنوافذ على الموبايل والكمبيوتر، نهاري وليلي
// ============================================================
// الفحوصات دي اتكتبت بعد مراجعة كاملة للنظام، وكل واحدة فيها بتحرس
// عطل **اتقاس فعلًا**:
//
//   1) ⚠️⚠️ علامة التنصيص في اسم الصنف كانت بتقص السمة:
//      `خمار 30" اسدال` → `خمار 30` — يعني الطباعة بتدوّر على صنف تاني
//   2) ⚠️⚠️ الكيبورد العربي: خانة type=number **بتمسح** الأرقام العربية
//      (٥٧ بتبقى فاضية)، والفاضي كان بيتحسب صفر — وصفر في المخزنين
//      معناه "خلصت نهائيًا". يعني الدرجة تتعلّم خلصانة وانت ماعملتش حاجة.
//      ⭐ الخانة بقت type=text بكيبورد رقمي والأرقام بتتحوّل — فـ٥٧ بقت
//      **بتشتغل صح**. والفاضي بيتحسب صفر (ده اختيار صاحب النظام: المسح
//      غالبًا بداية تصغير رقم).
//   3) الكسور والأرقام الضخمة كانت بتعدّي للسحابة
//   4) زراير ✏️/🗑️ الفئة كانت 27px على الموبايل — و🗑️ بتمسح فئة كاملة
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ============================================================
  // 1) علامة التنصيص
  // ============================================================
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('http://localhost:8899/tests/harness.html');
    await p.waitForFunction(() => typeof escapeHTML === 'function');
    const r = await p.evaluate(() => {
      const out = {};
      out.escapesQuote = escapeHTML('12"') === '12&quot;';
      out.escapesApos = escapeHTML("it's") === 'it&#39;s';
      out.stillEscapesTags = escapeHTML('<b>&</b>').indexOf('&lt;b&gt;') === 0;
      // ⚠️ العرض مايتأثرش: &quot; بتترسم علامة تنصيص عادية
      const d = document.createElement('div');
      d.innerHTML = escapeHTML('خمار 30" اسدال');
      out.rendersBack = d.textContent === 'خمار 30" اسدال';

      state.profile = { name: 'A', role: 'owner' }; state.isNarrow = true; state.user = { uid: 'u1' };
      const root = document.getElementById('root') || (() => { const x = document.createElement('div'); x.id = 'root'; document.body.appendChild(x); return x; })();
      // ⚠️⚠️ الحالة الحقيقية: مقاسات القماش بتتكتب بالبوصة
      productsCache = [{ name: 'خمار 30" اسدال', barcode: '', price: 100, dept: 'ملابس' }];
      productsIndex = buildProductsIndex(productsCache);
      productsMeta = { count: 1, updatedAt: { toDate: () => new Date() } };
      state.productSearch = 'خمار';
      root.innerHTML = productsScreenHTML();
      const btn = document.querySelector('[data-print-product]');
      out.productAttr = btn ? btn.getAttribute('data-print-product') : null;

      // وخانة البحث نفسها
      state.productSearch = 'قماش 30"';
      root.innerHTML = productsScreenHTML();
      const inp = document.getElementById('products-search');
      out.searchValue = inp ? inp.value : null;
      return out;
    });
    check('⭐⭐ escapeHTML بتهرّب علامة التنصيص', r.escapesQuote);
    check('والفاصلة العليا', r.escapesApos);
    check('ولسه بتهرّب الوسوم', r.stillEscapesTags);
    check('⭐ والعرض مايتأثرش', r.rendersBack);
    check('⭐⭐ اسم صنف فيه " مابيتقصّش', r.productAttr === 'خمار 30" اسدال', r.productAttr);
    check('⭐ وخانة البحث بتقبلها', r.searchValue === 'قماش 30"', r.searchValue);
    check('مفيش أخطاء (علامة التنصيص)', errs.length === 0, errs);
    await p.close();
  }

  // ============================================================
  // 2) خانة الكمية
  // ============================================================
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto('http://localhost:8899/tests/harness.html');
    await p.waitForFunction(() => typeof dashboardHTML === 'function');
    const r = await p.evaluate(() => {
      const out = {}; const sent = [];
      window.setQuantity = (c, g, f, v) => sent.push(v);
      state.profile = { name: 'A', role: 'owner' }; state.user = { uid: 'u1' }; state.isNarrow = true;
      state.view = 'dashboard'; state.screen = 'sheets';
      state.categories = [{ id: 'c1', name: 'كريب', minQty: 3 }]; state.activeCategoryId = 'c1';
      state.grades = [{ id: 'g1', number: '1', branchQty: 7, mainQty: 5, status: 'normal' }];
      const root = document.getElementById('root') || (() => { const x = document.createElement('div'); x.id = 'root'; document.body.appendChild(x); return x; })();
      root.innerHTML = dashboardHTML(); attachDashboardEvents();
      const inp = document.querySelector('.qty-input');
      out.kind = { type: inp.type, mode: inp.getAttribute('inputmode') };
      const fire = (v) => { sent.length = 0; inp.value = v; inp.dispatchEvent(new Event('change', { bubbles: true })); return { sent: sent.slice(), shown: inp.value }; };
      out.empty = fire('');
      out.arabic = fire('٥٧');
      out.persian = fire('۴۵');
      out.zero = fire('0');
      out.frac = fire('5.7');
      out.huge = fire('55555555');
      out.neg = fire('-4');
      out.ok = fire('12');
      out.junk = fire('abc');
      out.max = typeof MAX_GRADE_QTY !== 'undefined' ? MAX_GRADE_QTY : null;
      // ⚠️ ده سبب المشكلة الأصلية: type=number **بيمسح** الأرقام العربية
      // قبل ما الكود يشوفها. الفحص ده بيوثّق ليه الخانة مابقتش number.
      const probe = document.createElement('input'); probe.type = 'number';
      probe.value = '٥٧'; out.numberTypeWipesArabic = probe.value === '';
      // والخانة بتاعتنا بتحتفظ بيها
      inp.value = '٥٧'; out.ourInputKeepsArabic = inp.value === '٥٧';
      out.convert = { ar: arabicDigitsToEnglish('٥٧'), fa: arabicDigitsToEnglish('۴۵'), mix: arabicDigitsToEnglish('1٢3'), plain: arabicDigitsToEnglish('57') };
      return out;
    });
    check('⚠️ type=number بيمسح الأرقام العربية (سبب العطل الأصلي)', r.numberTypeWipesArabic);
    check('⭐⭐ فعشان كده الخانة بقت text بكيبورد رقمي', r.kind.type === 'text' && r.kind.mode === 'numeric', r.kind);
    check('⭐ والخانة بتحتفظ بالأرقام العربية', r.ourInputKeepsArabic);
    check('⭐⭐ ٥٧ بتتحفظ 57 (كانت بتتمسح وتبقى صفر)', r.arabic.sent[0] === 57, r.arabic);
    check('⭐ والفارسي كمان', r.persian.sent[0] === 45, r.persian);
    check('والتحويل بيسيب الإنجليزي زي ما هو', r.convert.plain === '57' && r.convert.mix === '123', r.convert);
    check('⭐ خانة فاضية = صفر (اختيار صاحب النظام)', r.empty.sent[0] === 0, r.empty);
    check('وصفر صريح كمان', r.zero.sent[0] === 0, r.zero);
    check('الكسر بيتقرّب', r.frac.sent[0] === 6, r.frac);
    check('والرقم الضخم بيتقص عند الحد', r.huge.sent[0] === r.max, r.huge);
    check('والسالب بيبقى صفر', r.neg.sent[0] === 0, r.neg);
    check('والرقم العادي بيعدّي زي ما هو', r.ok.sent[0] === 12, r.ok);
    check('⭐ والكلام مايتحسبش صفر — بيرجّع القديم', r.junk.sent.length === 0 && r.junk.shown === '7', r.junk);
    check('⭐ والخانة بتوري الرقم اللي اتحفظ فعلًا', r.arabic.shown === '57' && r.frac.shown === '6', [r.arabic.shown, r.frac.shown]);
    check('مفيش أخطاء (الكميات)', errs.length === 0, errs);
    await p.close();
  }

  // ============================================================
  // 3) كل الشاشات والنوافذ × موبايل/كمبيوتر × نهاري/ليلي
  // ============================================================
  const sweep = [];
  for (const vp of [{ n: 'موبايل', w: 390, h: 844 }, { n: 'كمبيوتر', w: 1366, h: 900 }]) {
    for (const theme of ['light', 'dark']) {
      const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
      const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
      await p.goto('http://localhost:8899/tests/harness.html');
      await p.waitForFunction(() => typeof dashboardHTML === 'function');
      const out = await p.evaluate(async (theme) => {
        const bad = [];
        document.documentElement.setAttribute('data-theme', theme);
        state.isNarrow = window.innerWidth < 700;
        state.user = { uid: 'u1' }; state.profile = { name: 'عبدالله', role: 'owner' }; state.view = 'dashboard';
        const ts = (ms) => ({ toDate: () => new Date(ms) });
        const now = Date.now();
        state.categories = Array.from({ length: 8 }, (_, i) => ({ id: 'c' + i, name: 'فئة ' + i, itemName: 'صنف ' + i, sellingPrice: 100, minQty: 3 }));
        state.activeCategoryId = 'c0';
        state.grades = Array.from({ length: 16 }, (_, i) => ({ id: 'g' + i, number: String(i + 1), branchQty: i % 6, mainQty: i % 4, status: i % 5 === 0 ? 'pending' : 'normal' }));
        state.users = [{ id: 'u1', name: 'عبدالله', role: 'owner' }, { id: 'u2', name: 'محمود', role: 'print_operator', sharedAccount: true }];
        state.activityLog = Array.from({ length: 20 }, (_, i) => ({ action: ['edit','print','add_grade','import_products','edit_user'][i%5],
          categoryName: 'فئة ' + (i%8), gradeNumber: String(i), field: 'branchQty', oldValue: 5, newValue: 3,
          userName: 'عبدالله', printLabel: 'سلة طباعة', itemName: 'كريب', timestamp: ts(now - i*3600000) }));
        state.printStations = [{ id:'d1', deviceName:'كمبيوتر الكاشير', labelPrinter:'XP', printers:['XP','HP'],
          appVersion:'0.69.1', printSetup:{batch:20,lead:0,pace:420}, lastSeen:{toMillis:()=>now-5000} }];
        state.deviceSettings = {};
        state.printCart = [{ product: { name: 'كريب سادة', barcode: '6221' }, qty: 5, mode: 'normal' }];
        allGradesCache = Array.from({ length: 200 }, (_, i) => ({ catId:'c'+(i%8), gradeId:'g'+i, name:String(i), number:String(i), branchQty:i%6, mainQty:i%4 }));
        movementStats = {}; movementStatsAt = Date.now(); movementStatsError = '';
        allGradesCache.forEach((g,i) => { if (i%4) movementStats[g.catId+'__'+g.gradeId] = { lastMovedAt: ts(now - (i%90)*86400000), soldByMonth: {} }; });
        productsCache = Array.from({ length: 60 }, (_, i) => ({ name:'صنف '+i, barcode:'99'+i, price:50, dept:'ملابس' }));
        productsIndex = buildProductsIndex(productsCache);
        productsMeta = { count: 60, updatedAt: ts(now - 86400000), updatedByName: 'عبدالله' };
        const root = document.getElementById('root') || (() => { const d = document.createElement('div'); d.id='root'; document.body.appendChild(d); return d; })();

        // ⚠️ الدرج المقفول بيقعد برّه الشاشة عن قصد — لازم يتستثنى وإلا
        // كل ملاحظة حقيقية بتغرق وسط 40 وهمية.
        const hidden = (el) => {
          if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return true;
          const s = getComputedStyle(el);
          if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return true;
          let n = el;
          while (n && n !== document.body) {
            if (n.classList && n.classList.contains('side-menu') && !n.classList.contains('open')) return true;
            if (n.hasAttribute && n.hasAttribute('hidden')) return true;
            n = n.parentElement;
          }
          return false;
        };
        const inScroller = (el) => {
          let n = el.parentElement;
          while (n && n !== document.body) {
            const s = getComputedStyle(n);
            if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
            n = n.parentElement;
          }
          return false;
        };
        const scan = (where) => {
          const ids = {};
          document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id]||0)+1; });
          Object.keys(ids).filter((k) => ids[k] > 1).forEach((k) => bad.push(`${where}: معرّف مكرر #${k}`));
          if (document.documentElement.scrollWidth > window.innerWidth + 1) bad.push(`${where}: تمرير أفقي`);
          document.querySelectorAll('button, input, select').forEach((el) => {
            if (hidden(el) || inScroller(el)) return;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (r.right > window.innerWidth + 2 || r.left < -2) bad.push(`${where}: عنصر برّه الشاشة (${el.className.split(' ')[0]||el.tagName})`);
            // ⚠️ الصباع محتاج 30px. الاستثناء الوحيد: شريط الأخطاء بتاع
            // التطوير (مالوش كلاس) — مش أداة استخدام يومي.
            // ⚠️ اللي بيتقاس هو **مساحة الضغط** مش شكل الزرار: النقطة
            // الصغيرة في الشريط العلوي شكلها 18px عن قصد، ومساحة ضغطها
            // اتوسّعت بطبقة شفافة حواليها.
            if (window.innerWidth < 700 && el.tagName === 'BUTTON' && r.height > 0 && el.className) {
              const after = getComputedStyle(el, '::after');
              const grow = after.content !== 'none' && after.position === 'absolute'
                ? Math.abs(parseFloat(after.top) || 0) * 2 : 0;
              if (r.height + grow < 30)
                bad.push(`${where}: مساحة ضغط ${Math.round(r.height + grow)}px "${(el.textContent||'').trim().slice(0,14)}"`);
            }
          });
        };

        for (const s of ['home','sheets','products','print','activity','users','movement']) {
          state.screen = s;
          try { root.innerHTML = dashboardHTML(); attachDashboardEvents(); }
          catch (e) { bad.push(`شاشة ${s}: خطأ — ${e.message}`); continue; }
          scan('شاشة ' + s);
        }

        state.screen = 'home'; root.innerHTML = dashboardHTML();
        const dialogs = [
          ['ألوان الفئة', () => openColorGroupsDialog('c0')],
          ['حدود التنبيه', () => openCriticalQtyDialog('c0')],
          ['كميات الفرع', () => openBulkBranchQtyDialog('c0')],
          ['مدى الدرجات', () => openAddGradeRangeDialog('c0')],
          ['المظهر', () => openAppearanceDialog()],
          ['إضافة حساب', () => openAddUserDialog()],
          ['تعديل حساب', () => editUserRole('u2')],
          ['ملصق مكتوب', () => openCustomLabelDialog()],
          ['اختيار صنف', () => openProductPicker(() => {})],
          ['استيراد الأصناف', () => openProductsImportDialog(() => {})],
          ['فئات بتتكرر', () => openRepeatGradesDialog()],
          ['إعدادات الطباعة', () => openPrintSettingsDialog('all')],
          ['اسم المستخدم', () => askOperatorName(true)],
        ];
        for (const [name, fn] of dialogs) {
          try { const r = fn(); if (r && r.then) await r; }
          catch (e) { bad.push(`نافذة ${name}: خطأ — ${e.message}`); continue; }
          await new Promise((r) => setTimeout(r, 25));
          const ov = [...document.querySelectorAll('body > div')].filter((d) => d.style.position === 'fixed').pop();
          if (!ov) { bad.push(`نافذة ${name}: مافتحتش`); continue; }
          scan('نافذة ' + name);
          const card = ov.querySelector('.card');
          if (card) {
            const rc = card.getBoundingClientRect();
            if (rc.height > window.innerHeight + 1) bad.push(`نافذة ${name}: أطول من الشاشة`);
            if (rc.width > window.innerWidth + 1) bad.push(`نافذة ${name}: أعرض من الشاشة`);
          }
          ov.remove();
        }
        return bad;
      }, theme);
      const tag = `${vp.n}/${theme === 'dark' ? 'ليلي' : 'نهاري'}`;
      out.forEach((x) => sweep.push(`[${tag}] ${x}`));
      errs.forEach((e) => sweep.push(`[${tag}] خطأ: ${e.slice(0, 100)}`));
      await p.close();
    }
  }
  check('⭐⭐ كل الشاشات والنوافذ نضيفة (موبايل/كمبيوتر × نهاري/ليلي)', sweep.length === 0, sweep.slice(0, 8));

  await b.close();
  pass.forEach((n) => console.log('   ⭐ ' + n));
  fail.forEach((n) => console.log('   ❌ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
