// الدفعة 1 — إصلاحات
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,220)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');

  const boot = async () => p.evaluate(() => {
    const noop = () => () => {};
    const mk = () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve(), collection: mk, onSnapshot: noop, get: () => Promise.resolve({ exists: false }) }), get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
    window.db = { collection: mk, collectionGroup: mk, batch: () => ({ update(){}, set(){}, commit: () => Promise.resolve() }) };
    state.user = { uid: 'me' };
    state.profile = { name: 'AboLilah', role: 'owner', warehouseAccess: 'both' };
    state.view = 'dashboard'; state.screen = 'sheets'; state.isOnline = true;
    state.categories = [{ id: 'c1', name: 'كريب', order: 1, minQty: 0 }];
    state.activeCategoryId = 'c1';
    state.grades = [{ id: 'g1', number: 1, branchQty: 2, mainQty: 5, status: 'normal' }];
    state.pendingByCategory = {}; state.pendingCount = 0;
    state.outByCategory = {}; state.outCount = 0; state.lowStockByCategory = {};
    render();
  });
  await boot();

  // ---------- 1) الشريط العلوي مابيعلاش عند الحفظ ----------
  const bar = await p.evaluate(() => {
    const h = () => document.querySelector('.topbar').getBoundingClientRect().height;
    state.hasPendingWrites = false; render(); const online = h();
    state.hasPendingWrites = true;  render(); const saving = h();
    state.isOnline = false;         render(); const offline = h();
    state.isOnline = true; state.hasPendingWrites = false; render();
    return { online, saving, offline };
  });
  check('الشريط مابيعلاش وقت رفع البيانات', Math.abs(bar.saving - bar.online) < 0.5, bar);
  check('الشريط مابيعلاش وقت قطع النت', Math.abs(bar.offline - bar.online) < 0.5, bar);

  // ---------- 2) زرار التزويد فوري ومابيروحش للسحابة ----------
  const speed = await p.evaluate(async () => {
    let serverReads = 0, updates = 0;
    const gradeDoc = {
      get: () => { serverReads++; return new Promise(r => setTimeout(() => r({ exists: true, id: 'g1', data: () => ({ number: 1, status: 'normal' }) }), 1200)); },
      update: (u) => { updates++; return Promise.resolve(); },
      delete: () => Promise.resolve(),
    };
    const col = () => ({ doc: () => gradeDoc, add: () => Promise.resolve({}) });
    window.db = { collection: () => ({ doc: () => ({ collection: col }), add: () => Promise.resolve({}) }) };

    const t0 = performance.now();
    await requestShortage('g1');
    await cancelShortage('g1');
    await markOutOfStock('g1');
    await changeQuantity('c1', 'g1', 'branchQty', +1);
    await changeQuantity('c1', 'g1', 'branchQty', -1);
    return { ms: performance.now() - t0, serverReads, updates };
  });
  check('⭐ مفيش أي قراءة من السحابة (كانت 5)', speed.serverReads === 0, speed);
  check('⭐ 5 ضغطات في أقل من 100 مللي (كانت 6 ثواني)', speed.ms < 100, speed);
  check('الكتابات كلها اتبعتت', speed.updates === 5, speed);
  await boot();

  // ---------- 3) البحث: مفيش حرف بيضيع ----------
  const typed = await p.evaluate(async () => {
    // بنحمّل الأصناف بالطريقة الحقيقية (loadProducts) بدل ما نلعب في
    // متغيّر داخلي — كده بنختبر المسار اللي بيشتغل فعلًا.
    const LIST = [
      { name: 'كريب سادة', barcode: '111', code: '111' },
      { name: 'كريب لافوال', barcode: '222', code: '222' },
      { name: 'حجاب بيور', barcode: '333', code: '333' },
    ];
    window.db = { collection: () => ({ get: () => Promise.resolve({ docs: [
      { id: 'p0', data: () => ({ index: 0, items: LIST }) },
    ] }) }) };
    await loadProducts(true);
    state.profile = { name: 'x', role: 'print_operator' };
    state.screen = 'print'; state.printSearch = ''; state.printCart = [];
    render();

    const el = document.getElementById('print-search');
    const before = el;
    const word = 'كريب سادة';
    // بنكتب حرف حرف بسرعة — أسرع من مهلة الانتظار
    for (const ch of word) {
      el.value += ch;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 25));
    }
    await new Promise(r => setTimeout(r, 400));
    const after = document.getElementById('print-search');
    return {
      typed: word,
      inBox: after.value,
      sameElement: before === after,
      stateVal: state.printSearch,
      results: document.querySelectorAll('[data-add-product]').length,
      focused: document.activeElement === after,
    };
  });
  check('⭐ كل الحروف وصلت للخانة', typed.inBox === typed.typed, typed);
  check('⭐ خانة البحث نفسها مااتهدّتش وانت بتكتب', typed.sameElement, typed);
  check('الحالة متطابقة مع اللي مكتوب', typed.stateVal === typed.typed, typed);
  check('النتايج اتحدّثت', typed.results === 1, typed);

  // كتابة سريعة جدًا (أسرع من المهلة بكتير)
  const fast = await p.evaluate(async () => {
    const el = document.getElementById('print-search');
    el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true }));
    const word = 'حجاب بيور';
    for (const ch of word) {
      el.value += ch;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise(r => setTimeout(r, 400));
    return { inBox: document.getElementById('print-search').value, want: word };
  });
  check('⭐ كتابة سريعة جدًا: مفيش حرف ضاع', fast.inBox === fast.want, fast);

  // ---------- 4) الكاميرا على الأيفون ----------
  const cam = await p.evaluate(() => {
    const out = {};
    out.libLoaded = typeof jsQR !== 'undefined';
    out.withNative = isBarcodeScanSupported();
    // نحاكي سفاري: مفيش BarcodeDetector خالص
    const realBD = window.BarcodeDetector;
    delete window.BarcodeDetector;
    out.iphoneSupported = isBarcodeScanSupported();
    const d = createDetector();
    out.iphoneQrOnly = d.qrOnly;
    out.hasDetect = typeof d.detect === 'function';
    if (realBD) window.BarcodeDetector = realBD;
    return out;
  });
  check('مكتبة القراءة البديلة متحمّلة', cam.libLoaded, cam);
  check('⭐ الكاميرا شغّالة على الأيفون (كانت مخفية)', cam.iphoneSupported, cam);
  check('البديل بيقول إنه QR بس', cam.iphoneQrOnly === true, cam);
  check('واجهة القراءة موحّدة', cam.hasDetect, cam);

  // البديل بيقرا QR حقيقي فعلًا
  const decoded = await p.evaluate(async () => {
    const url = await generateQRDataURL('177555414', 300);
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height);
    const r = jsQR(d.data, c.width, c.height);
    return r && r.data;
  });
  check('⭐ البديل بيقرا ملصق النظام فعلًا', decoded === '177555414', decoded);

  // زرار الكاميرا بيبان في الشاشة
  const btns = await p.evaluate(() => {
    const realBD = window.BarcodeDetector;
    delete window.BarcodeDetector;
    state.profile = { name: 'x', role: 'print_operator' };
    state.screen = 'print'; render();
    const r = { scan: !!document.getElementById('print-scan-btn'), pick: !!document.getElementById('print-camera-btn') };
    if (realBD) window.BarcodeDetector = realBD;
    return r;
  });
  check('⭐ زرار "صوّر باركود" ظاهر على الأيفون', btns.scan, btns);
  check('زرار اختيار الكاميرا ظاهر كمان', btns.pick, btns);

  // ---------- 5) إظهار كلمة المرور ----------
  const pw = await p.evaluate(() => {
    state.view = 'login'; render();
    const input = document.getElementById('password');
    const t = document.getElementById('toggle-password');
    const start = input.type;
    t.click(); const shown = { type: input.type, icon: t.textContent.trim() };
    t.click(); const hidden = { type: input.type, icon: t.textContent.trim() };
    return { start, shown, hidden };
  });
  check('كلمة المرور مخفية من الأول', pw.start === 'password', pw);
  check('⭐ الضغط بيظهرها', pw.shown.type === 'text', pw);
  check('الأيقونة بتتغيّر', pw.shown.icon !== pw.hidden.icon, pw);
  check('الضغط تاني بيخفيها', pw.hidden.type === 'password', pw);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  console.log('\n✅ نجح (' + pass.length + ')');
  pass.filter(x => x.includes('⭐')).forEach(x => console.log('   ' + x));
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
