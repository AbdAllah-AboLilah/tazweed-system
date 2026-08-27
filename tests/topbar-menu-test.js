// قايمة ☰ — لازم تفضل جوّه الشاشة على أي مقاس
// ============================================================
// ⚠️ العطل اللي خلّى الفحص ده يتكتب: القايمة كانت منسدلة على الموبايل
// بس، وعلى الكمبيوتر صف أزرار جوّه الشريط العلوي. ده كان شغّال وهي
// 7 أزرار، وكل بند جديد كان بيقرّبها من الحافة لحد ما خرجت.
//
// القياس وقتها على شاشة 1280: عرض القايمة 1176 بكسل وبادئة عند -200،
// يعني 200 بكسل بره الشاشة ومفيش طريقة توصلهم — والاسم اتزنق لعرض صفر.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

const WIDTHS = [360, 390, 768, 1280, 1366, 1920];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  for (const w of WIDTHS) {
    const p = await b.newPage({ viewport: { width: w, height: 800 } });
    await p.goto('http://localhost:8899/tests/harness.html');
    await p.waitForFunction(() => typeof render === 'function');
    const r = await p.evaluate(() => {
      const noop = () => () => {};
      const mk = () => ({ doc: () => ({ set: () => Promise.resolve(), update: () => Promise.resolve(), collection: mk, onSnapshot: noop, get: () => Promise.resolve({ exists: false }) }), get: () => Promise.resolve({ docs: [] }), where: mk, orderBy: mk, limit: mk, onSnapshot: noop, add: () => Promise.resolve({}) });
      window.db = { collection: mk, collectionGroup: mk, batch: () => ({ set() {}, commit: () => Promise.resolve() }) };
      state.user = { uid: 'me' };
      state.view = 'dashboard';
      state.profile = { name: 'AboLilah', role: 'owner' };
      state.categories = [{ id: 'c1', name: 'كريب', order: 1 }];
      state.screen = 'home';
      state.isNarrow = window.innerWidth <= 700;
      render();

      const panel = document.getElementById('menu-panel');
      const toggle = document.getElementById('menu-toggle-btn');
      const name = document.querySelector('.topbar-name');
      const meta = document.querySelector('.topbar-meta');
      if (!panel || !toggle || !name || !meta) return { missing: true };

      const shutHidden = getComputedStyle(panel).display === 'none';
      const toggleShown = getComputedStyle(toggle).display !== 'none';

      panel.classList.add('open');
      const rp = panel.getBoundingClientRect();
      const rn = name.getBoundingClientRect();
      const rm = meta.getBoundingClientRect();
      const out = {
        shutHidden,
        toggleShown,
        openW: Math.round(rp.width),
        offscreen: rp.left < -1 || rp.right > window.innerWidth + 1,
        nameW: Math.round(rn.width),
        overlap: rn.left < rm.right - 1 && rn.right > rm.left + 1,
        hScroll: document.documentElement.scrollWidth - window.innerWidth,
        buttons: panel.querySelectorAll('.btn').length,
        hasMovement: panel.innerHTML.includes('حركة المخزون'),
      };
      panel.classList.remove('open');
      return out;
    });

    check(`${w}: القايمة مقفولة في الأول`, r.shutHidden, r);
    check(`${w}: زرار ☰ ظاهر`, r.toggleShown, r);
    check(`${w}: القايمة المفتوحة جوّه الشاشة`, r.offscreen === false, r);
    check(`${w}: الاسم ليه عرض`, r.nameW > 0, r);
    check(`${w}: الاسم مش متغطي`, r.overlap === false, r);
    check(`${w}: مفيش زحلقة أفقية`, r.hScroll <= 0, r);
    check(`${w}: حركة المخزون في القايمة`, r.hasMovement, r);
    await p.close();
  }

  await b.close();
  console.log(`\n✅ نجح: ${pass.length}`);
  pass.forEach((t) => console.log('   ✓ ' + t));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    fail.forEach((t) => console.log('   ✗ ' + t));
    process.exit(1);
  }
  console.log('\nكل الفحوص نجحت.');
})();
