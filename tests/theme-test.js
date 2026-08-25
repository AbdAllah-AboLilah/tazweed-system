// v0.57.3 — الثيمات: التباين والأسود الحقيقي
//
// ⚠️⚠️ الملف ده اتكتب بعد ما الثيم الليلي وصل للمحل و**النص فيه مش
// باين**. الفحص الأساسي هنا بيقيس تباين **كل نص في الشاشة** فعليًا،
// مش بيراجع الأكواد بالعين — لأن الباج الأصلي مكانش لون غلط، كان
// **لون ناقص** (زرار من غير color بيقع على أسود المتصفح).
const { chromium } = require('playwright');
const fs = require('fs');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 400)}` : ''));

const SETUP = () => {
  const noop = () => () => {};
  const mk = () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), collection: mk, onSnapshot: noop, get: () => Promise.resolve({ exists: false }) }), get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
  window.db = { collection: mk, collectionGroup: mk };
  state.user = { uid: 'u1' };
  state.profile = { name: 'AboLilah', role: 'owner', warehouseAccess: 'both' };
  state.view = 'dashboard'; state.screen = 'sheets'; state.isOnline = true;
  state.categories = [{ id: 'c1', name: 'كريب سادة', order: 1, colorGroups: ['بيجات', 'ألوان'], itemName: 'كريب سادة لوكس', barcodeNumber: '28144' }];
  state.activeCategoryId = 'c1';
  state.grades = [
    { id: 'g1', number: 1, group: 'بيجات', branchQty: 0, mainQty: 6, status: 'pending' },
    { id: 'g2', number: 2, group: 'بيجات', branchQty: 4, mainQty: 5, status: 'normal' },
    { id: 'g3', number: 3, group: 'ألوان', branchQty: 0, mainQty: 0, status: 'out' },
  ];
  state.pendingByCategory = {}; state.pendingCount = 2; state.outByCategory = {}; state.outCount = 1; state.lowStockByCategory = {}; state.lowStockCount = 1;
  render();
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const m = document.createElement('meta'); m.name = 'viewport';
      m.content = 'width=device-width, initial-scale=1'; document.head.appendChild(m);
    });
  });
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');
  await p.evaluate(SETUP);

  // أداة قياس التباين — بتشتغل على الشاشة المرسومة فعلًا
  const audit = async (theme, screen) =>
    p.evaluate(async ([theme, screen]) => {
      saveAppearance({ theme });
      if (screen === 'cats') { state.sideMenuOpen = true; state.screen = 'sheets'; }
      else { state.sideMenuOpen = false; state.screen = screen; }
      render();
      await new Promise((r) => setTimeout(r, 150));

      const parse = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
        const [r, g, bl, a] = m[1].split(',').map(Number);
        return { r, g, b: bl, a: a === undefined ? 1 : a };
      };
      const lum = (c) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      };
      const ratio = (a, bb) => { const l1 = lum(a), l2 = lum(bb); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
      // ⚠️ الخلفية الحقيقية مش دايمًا على العنصر نفسه — بنطلع لفوق
      // لحد ما نلاقي خلفية مش شفافة، زي ما العين بتشوف بالظبط.
      const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0.5) return c;
          n = n.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      };

      const bad = [];
      const seen = new Set();
      document.querySelectorAll('*').forEach((el) => {
        const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').trim();
        if (!txt || txt.length > 60) return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.2) return;
        const fg = parse(cs.color);
        if (!fg) return;
        const key = cs.color + '|' + cs.backgroundColor + '|' + el.className;
        if (seen.has(key)) return;
        seen.add(key);
        const cr = ratio(fg, bgOf(el));
        if (cr < 4.5) bad.push({ نص: txt.slice(0, 24), كلاس: (el.className || '').toString().slice(0, 24), تباين: +cr.toFixed(2) });
      });
      return bad.sort((a, bb) => a.تباين - bb.تباين);
    }, [theme, screen]);

  // ============================================================
  // ١) ⚠️⚠️ كل نص في كل ثيم لازم يبقى مقروء
  // ============================================================
  // 4.5 هو حد WCAG AA للنص العادي. الباج اللي وصل للمحل كان **1.27**
  // (أسود صافي على #1c1f25) — يعني مش باين خالص.
  for (const theme of ['paper', 'indigo', 'olive', 'wine', 'night']) {
    for (const screen of ['sheets', 'home', 'cats']) {
      const bad = await audit(theme, screen);
      check(`⭐⭐⭐ [${theme}/${screen}] كل نص مقروء (تباين ≥ 4.5)`, bad.length === 0, bad.slice(0, 5));
    }
  }

  // ============================================================
  // ٢) ⚠️ الليلي أسود **حقيقي** — عشان AMOLED
  // ============================================================
  // البكسل بيطفي عند #000000 بس. أي رمادي، حتى الغامق جدًا، معناه
  // إن البكسل شغّال وبياكل بطارية.
  const night = await p.evaluate(async () => {
    saveAppearance({ theme: 'night' });
    render();
    await new Promise((r) => setTimeout(r, 100));
    const cs = getComputedStyle(document.documentElement);
    return {
      bg: cs.getPropertyValue('--bg').trim(),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      surface: cs.getPropertyValue('--surface').trim(),
    };
  });
  check('⭐⭐⭐ الليلي خلفيته أسود حقيقي #000000',
    night.bg === '#000000' && /rgb\(0,\s*0,\s*0\)/.test(night.bodyBg), night);
  // ⚠️ الكارت لازم يبان مرتفع عن الخلفية — بس من غير ما الخلفية تولّع
  check('⭐ والكروت فوقه بتبان (مش أسود على أسود)',
    night.surface !== '#000000' && night.surface !== night.bg, night);

  // ============================================================
  // ٣) ⚠️⚠️ الزرار من غير color = أسود المتصفح الافتراضي
  // ============================================================
  // ده كان السبب الأصلي. الفحص ده بيمسكه في الكود مباشرة عشان لو حد
  // ضاف زرار جديد ونسي اللون، يعرف قبل ما يوصل للمحل.
  const css = fs.readFileSync(__dirname + '/../styles.css', 'utf8');
  const clickableRules = [];
  const re = /(^|\n)\s*([.#][^{}]*?)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[2].trim().replace(/\s+/g, ' ');
    const body = m[3];
    if (/:hover|:focus|::/.test(sel)) continue;
    if (!/\b(btn|chip|tab|qty-btn|more-item|bnav-item|appearance-opt|stat-tile-go|pset-toggle)\b/.test(sel)) continue;
    if (!/background\s*:/.test(body)) continue;
    if (/(^|;|\n)\s*color\s*:/.test(body)) continue;
    clickableRules.push(sel.slice(0, 50));
  }
  check('⭐⭐⭐ مفيش زرار بيحدد خلفية من غير لون خط', clickableRules.length === 0, clickableRules);

  // ⚠️ ومفيش لون أبيض مكتوب بالإيد على الشارات — كان أبيض على أصفر
  // بتباين 2.1 في **الثيمين**.
  check('⭐⭐ ونص الشارات ماشي على متغيّر مش أبيض ثابت',
    /--dot-text/.test(css) && !/\.cat-dot\s*\{[^}]*color:\s*#fff/.test(css), null);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);

  pass.filter((x) => x.includes('⭐')).forEach((x) => console.log('   ' + x));
  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach((x) => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
