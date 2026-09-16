// ============================================================
// ↻ زرار الريفريش + الإشعار اللي وصل متأخّر
// ============================================================
// اتبلّغ واتسأل بالنص:
//   "وعاوزك تتاكد ان زرار الري فريش شغال كويس لان بحس ان مش بيشتغل كويس"
//   "لو ... في طلب تزويد اتبعت وفتحت بعد ٣ ساعات كده هيجيلي إشعار طيب
//    لو كان طلب التزويد خلاص اتزود او اتلغي هيجي بردوا ولا هيتاكد الاول"
//
// ⚠️⚠️ السبب اللي اتقاس في الريفريش: isUserTyping بترجّع true لمجرد إن
// الخانة **مركّز عليها**. شاشة الطباعة بتفضل كده طول الوقت، فالريفريش
// كان بيستنى 600 ثانية على جهاز محدش بيكتب عليه.
//
// فالفحوص هنا على الفرق ده بالظبط: "مركّز" ≠ "بيكتب".
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 220)}` : ''));

const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const bodyOf = (code, name) => {
  const i = code.indexOf('function ' + name + '(');
  if (i === -1) return '';
  const open = code.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < code.length; j++) {
    if (code[j] === '{') depth++;
    else if (code[j] === '}' && --depth === 0) return code.slice(open, j + 1);
  }
  return '';
};

(async () => {
  // ============================================================
  // (أ) فحص المصدر: كل مسار بيستعمل الدالة الصح
  // ============================================================
  // ⚠️ ليه فحص مصدر أصلًا؟ لأن الغلط الأصلي مكانش في السلوك — كان في
  // إن **مسار** استعمل الدالة الغلط. ولو حد رجّعها تاني بكرة، الفحص ده
  // هو اللي هيمسكه بالاسم.
  const core = src('js/print-core.js');
  const upd = src('js/update-prompt.js');
  const app = src('js/app.js');

  check('⭐⭐⭐⭐⭐ الريفريش عن بُعد بيستعمل isUserTypingNow',
    /isUserTypingNow\(\)/.test(bodyOf(core, 'waitThenReload')), bodyOf(core, 'waitThenReload').slice(0, 300));
  check('⭐⭐⭐⭐⭐ والتحديث التلقائي كمان',
    /isUserTypingNow\(\)/.test(bodyOf(upd, 'reloadWhenSafe')), bodyOf(upd, 'reloadWhenSafe').slice(0, 300));
  // ⚠️⚠️ ودي **مالهاش لازم تتغيّر**: ضياع المؤشر بيحصل بالتركيز لوحده،
  // فإعادة الرسم لازم تفضل بتأجّل على أي خانة مركّز عليها.
  check('⭐⭐⭐⭐⭐ لكن إعادة الرسم لسه بتستعمل isUserTyping (المؤشر بيضيع بالتركيز لوحده)',
    /isUserTyping\(\)/.test(bodyOf(app, 'renderFromData')) &&
    !/isUserTypingNow\(\)/.test(bodyOf(app, 'renderFromData')),
    bodyOf(app, 'renderFromData'));

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 420, height: 800 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof isUserTypingNow === 'function' && typeof clearSettledCategoryNotifications === 'function');

  // ============================================================
  // (ب) "مركّز" ≠ "بيكتب"
  // ============================================================
  const r = await p.evaluate(async () => {
    const out = {};
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));

    const inp = document.createElement('input');
    inp.type = 'text';
    document.body.appendChild(inp);

    // (1) مفيش تركيز خالص
    inp.blur();
    document.body.focus();
    out.noFocus = { typing: isUserTyping(), now: isUserTypingNow() };

    // (2) ⭐ الحالة اللي كانت بتعطّل الريفريش: مركّز، ومحدش بيكتب
    lastTypeAt = 0;
    inp.focus();
    out.focusIdle = { typing: isUserTyping(), now: isUserTypingNow() };

    // (3) بيكتب فعلًا دلوقتي
    inp.value = 'كريب';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(20);
    out.typingNow = { typing: isUserTyping(), now: isUserTypingNow() };

    // (4) كتب من 25 ثانية وساب إيده
    lastTypeAt = Date.now() - 25000;
    out.typedLongAgo = { typing: isUserTyping(), now: isUserTypingNow() };

    // (5) ضغطة زرار (كيبورد الكمبيوتر) بتتحسب كتابة
    lastTypeAt = 0;
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await wait(20);
    out.keydown = { now: isUserTypingNow() };

    // (6) خانة قراءة-فقط مش كتابة
    lastTypeAt = Date.now();
    inp.readOnly = true;
    out.readOnly = { now: isUserTypingNow() };
    inp.readOnly = false;
    inp.blur();
    inp.remove();

    // ============================================================
    // ⏰ الإشعار المتأخّر
    // ============================================================
    const closed = [];
    const mk = (tag) => ({ tag, close() { closed.push(tag); } });
    // ⚠️ تسجيلين: sw.js بيرسم الإشعار المحلي، وfirebase-messaging-sw.js
    // بنطاق تاني بيرسم اللي جاي من السحابة. القديم كان بيبص في واحد بس.
    navigator.serviceWorker.getRegistrations = async () => [
      { getNotifications: async () => [mk('tazweed-restock'), mk('tazweed-restock-cat1')] },
      { getNotifications: async () => [mk('tazweed-restock-cat2'), mk('whatsapp-3')] },
    ];

    // cat2 لسه فيها طلب معلّق، cat1 خلاص اتزوّدت
    closed.length = 0;
    await clearSettledCategoryNotifications(new Set(['cat2']));
    out.settled = closed.slice();

    // مسح كامل (رجعت للنظام) = كل بتوعنا، وبس
    closed.length = 0;
    await clearRestockNotification();
    out.cleared = closed.slice();

    // ============================================================
    // إمتى المسح بيشتغل أصلًا
    // ============================================================
    let calls = [];
    window.clearSettledCategoryNotifications = async (cats) => { calls.push([...cats].sort()); };

    const snap = (rows) => ({
      docs: rows.map(([catId, id]) => ({
        id,
        data: () => ({ status: 'pending', number: 5, group: 'بيجات' }),
        ref: { parent: { parent: { id: catId } } },
        metadata: { hasPendingWrites: false },
      })),
    });

    notifyBaseline = null;
    notifyPrevCats = null;
    state.categories = [{ id: 'cat1', name: 'كريب' }, { id: 'cat2', name: 'شيفون' }];

    calls = [];
    onGradesSnapshotForNotify(snap([['cat1', 'g1'], ['cat2', 'g2']]));   // أول لقطة
    out.firstSnap = calls.length;

    calls = [];
    onGradesSnapshotForNotify(snap([['cat1', 'g1'], ['cat2', 'g2']]));   // نفس الوضع
    out.sameSnap = calls.length;

    calls = [];
    onGradesSnapshotForNotify(snap([['cat1', 'g1'], ['cat2', 'g2'], ['cat1', 'g3']])); // زاد طلب
    out.grewSnap = calls.length;

    calls = [];
    onGradesSnapshotForNotify(snap([['cat2', 'g2']]));                   // cat1 اتزوّدت
    out.shrankSnap = calls.length;
    out.shrankCats = calls[0] || null;

    return out;
  });

  check('⭐⭐ مفيش تركيز = مفيش كتابة',
    r.noFocus.typing === false && r.noFocus.now === false, r.noFocus);

  // ============================================================
  // ⭐⭐⭐⭐⭐ ده هو العطل بالظبط
  // ============================================================
  check('⭐⭐⭐⭐⭐ خانة مركّز عليها ومحدش بيكتب: isUserTyping بتقول "بيكتب" — وisUserTypingNow لأ',
    r.focusIdle.typing === true && r.focusIdle.now === false, r.focusIdle);

  check('⭐⭐⭐⭐⭐ وبيكتب فعلًا = الاتنين بيقولوا آه (الحماية لسه موجودة)',
    r.typingNow.typing === true && r.typingNow.now === true, r.typingNow);
  check('⭐⭐⭐⭐ وساب إيده من 25 ثانية = مفيش حاجة تتحمى',
    r.typedLongAgo.now === false, r.typedLongAgo);
  check('⭐⭐⭐ وضغطة زرار بتتحسب كتابة', r.keydown.now === true, r.keydown);
  check('⭐⭐ وخانة قراءة-فقط مش كتابة', r.readOnly.now === false, r.readOnly);

  // ============================================================
  // ⏰ الإشعار المتأخّر
  // ============================================================
  // ⚠️⚠️ الأهم: إشعار فئة **لسه فيها طلب** مايتقفلش. لو اتقفل، الميزة
  // بتتحوّل لعطل: الإشعار الحقيقي بيختفي قبل ما حد ياخد باله.
  check('⭐⭐⭐⭐⭐ إشعار الفئة اللي خلص طلبها بيتقفل، واللي لسه معلّقة **لأ**',
    r.settled.length === 1 && r.settled[0] === 'tazweed-restock-cat1', r.settled);
  // ⚠️ والوسم العام مش من شغل الدالة دي — resetRestockBurst هي اللي
  // بتمسحه لما ترجع للنظام.
  check('⭐⭐⭐⭐ والوسم العام مابيتلمسش هنا',
    r.settled.indexOf('tazweed-restock') === -1, r.settled);
  check('⭐⭐⭐⭐⭐ وإشعارات برّه النظام مابتتقفلش خالص',
    r.settled.indexOf('whatsapp-3') === -1 && r.cleared.indexOf('whatsapp-3') === -1,
    { s: r.settled, c: r.cleared });

  // ⚠️ التسجيل التاني (نطاق الإشعارات البعيدة) هو اللي كان بره المسح
  // تمامًا — إشعار السحابة عمره ما كان بيتقفل.
  check('⭐⭐⭐⭐⭐ المسح بيدوّر في **التسجيلين** مش واحد',
    r.cleared.length === 3 && r.cleared.indexOf('tazweed-restock-cat2') !== -1, r.cleared);

  check('⭐⭐⭐⭐ المسح بيشتغل أول لقطة بعد الفتح (حالة "قفلت ٣ ساعات وفتحت")',
    r.firstSnap === 1, r.firstSnap);
  // ⚠️ حِمل: سؤال المتصفح عن الإشعارات مع كل لقطة = نداء مجاني على كل
  // جهاز في المحل مقابل لا حاجة.
  check('⭐⭐⭐⭐ ومابيشتغلش لما مافيش حاجة اتغيّرت',
    r.sameSnap === 0 && r.grewSnap === 0, { same: r.sameSnap, grew: r.grewSnap });
  check('⭐⭐⭐⭐⭐ وبيشتغل أول ما فئة تخرج من المعلّق',
    r.shrankSnap === 1 && JSON.stringify(r.shrankCats) === '["cat2"]',
    { n: r.shrankSnap, cats: r.shrankCats });

  check('⭐ مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  console.log(pass.map((x) => '   ✓ ' + x).join('\n'));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    console.log(fail.map((x) => '   ✗ ' + x).join('\n'));
    process.exit(1);
  }
  console.log(`\nكل الفحوص نجحت (${pass.length}).`);
})();
