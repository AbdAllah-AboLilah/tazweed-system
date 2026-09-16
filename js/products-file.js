// ============================================================
// 📦 ملف الأصناف — من الكمبيوتر للسحابة لوحده
// ============================================================
// اتطلب بالنص: "ممكن نربط المساعد ب الملف ولما يتغير اي حاجه في الملف
// يرفع الاصناف ل النظام بتاعنا".
//
// ⚠️⚠️ تقسيم الشغل — وده أهم قرار في الملف ده:
//
//   البرنامج المساعد  →  إيده على القرص: شايف الملف اتغيّر، وبيناوله
//   النظام (هنا)      →  بيقرا الإكسل ويرفع (هو اللي معاه السحابة)
//
// والسبب إن البرنامج مابيقراش الإكسل: قراءة أعمدة الـERP بتاعة المحل
// فيها فخين اتصلّحوا على بيانات حقيقية (الشرح عند PRODUCT_FIELDS):
// "سعر البيع" معناها **قبل** الخصم، و"القسم" معناها **الفرعي**. نسخة
// تانية من المنطق ده في البرنامج معناها إنها هتختلف عنه يوم ما حد
// يعدّل واحدة وينسى التانية — وساعتها ملصقات بأسعار غلط.
//
// فالكود اللي بيقرا الملف هنا هو **نفسه** اللي بيشتغل لما تستورد
// بإيدك: guessAllColumns و buildProductList و saveProducts. مافيش
// طريق تاني.

// ⚠️ مهلة قصيرة: الجهاز اللي مافيهوش البرنامج لازم يعدّي من غير ما
// يستنى — نفس منطق helperStatus في print-core.js.
const PFILE_PROBE_MS = 1500;

// ⚠️ الفحص مش بيتعاد مع كل رسمة لشاشة الأصناف: الشاشة بتترسم مع كل
// حرف بحث، ونداء على البرنامج مع كل حرف = بطء محسوس.
const PFILE_STATE_TTL_MS = 30000;

let pfileState = null;
let pfileStateAt = 0;
let pfileBusy = false;
// الرسالة اللي بتتكتب في شريط شاشة الأصناف بعد محاولة رفع
let pfileNote = '';
// ⚠️ البصمة اللي المستخدم قال عليها "مش دلوقتي": من غيرها الشريط
// هيفضل يطلع مع كل رسمة للشاشة وهو رافضه خلاص.
let pfileDismissed = '';

// ============================================================
// حالة الملف من البرنامج المساعد
// ============================================================
async function productsFileState(force) {
  if (!force && pfileState !== null && Date.now() - pfileStateAt < PFILE_STATE_TTL_MS) {
    return pfileState;
  }
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), PFILE_PROBE_MS);
    const res = await fetch(HELPER_URL + '/products/file', { signal: ctl.signal });
    clearTimeout(timer);
    pfileState = res.ok ? await res.json() : false;
  } catch (err) {
    // الفشل هنا **عادي**: معناه البرنامج مش شغّال على الجهاز ده.
    pfileState = false;
  }
  pfileStateAt = Date.now();
  return pfileState;
}

// ============================================================
// 🔎 سطر العناوين مش دايمًا أول سطر
// ============================================================
// ⚠️⚠️ الملف الخام اللي بيطلع من الـERP فوقه سطر عنوان وأعمدة فاضية
// على الشمال — اتقال بالنص: "انا بشيل اول ٢ عمود واول صف عشان يظبط
// الملف". ولو البرنامج هيرفع لوحده، مايصحّش نطلب منه يفضل يعدّل
// بإيده كل مرة.
//
// فبندوّر على سطر العناوين: بنجرّب أول 8 سطور، وناخد اللي الأعمدة
// بتاعته بتتعرّف أكتر. وشرط النجاح إن الاسم والباركود الاتنين
// اتلاقوا — من غيرهم الملف ده مش ملف أصناف أصلًا.
function findProductsHeaderRow(all) {
  let best = { row: -1, score: -1, guesses: null, headers: null };
  const limit = Math.min(8, all.length);
  for (let i = 0; i < limit; i++) {
    const headers = (all[i] || []).map((h) => String(h === undefined ? '' : h).trim());
    if (!headers.some((h) => h)) continue;
    const guesses = guessAllColumns(headers);
    const score = PRODUCT_FIELDS.reduce((n, f) => n + (guesses[f.key] >= 0 ? 1 : 0), 0);
    if (score > best.score) best = { row: i, score, guesses, headers };
  }
  if (!best.guesses) return null;
  if (best.guesses.name < 0 || best.guesses.barcode < 0) return null;
  return best;
}

// بترجّع قايمة الأصناف من بايتات الملف — أو بترمي خطأ بالعربي.
async function parseProductsFileBuffer(buf) {
  if (!(await ensureXLSX())) {
    throw new Error('مكتبة قراءة الإكسل ماتحمّلتش. اتصل بالنت وجرّب تاني.');
  }
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const head = findProductsHeaderRow(all);
  if (!head) {
    throw new Error('مالقيتش أعمدة اسم الصنف والباركود في الملف — اتأكد إنه ملف الأصناف الصح.');
  }
  const rows = all.slice(head.row + 1).filter((r) => r.some((c) => String(c || '').trim()));
  const list = buildProductList(rows, head.guesses);
  if (!list.length) throw new Error('الملف مفيهوش أي صنف.');
  return list;
}

// ============================================================
// ⬆️ الرفع
// ============================================================
// ⚠️ البصمة بتتحفظ في meta جنب العدد: من غيرها، كل جهاز بيفتح النظام
// هيفتكر إن الملف اتغيّر ويرفع تاني — نفس الملف، 24 كتابة كل مرة.
//
// ⚠️⚠️ والبصمة اللي بتتحفظ هي بتاعة **اللي اتنزّل فعلًا** (من ترويسة
// الرد) مش اللي كانت في الحالة: الملف ممكن يتغيّر بين السؤال والتنزيل.
// ============================================================
// 📶 بنقول للبرنامج المساعد إن الرفع ماشي
// ============================================================
// اتطلب بالنص: "ممكن نعمل شريط تقدم في لمساعد عند الرفع ولما يخلص
// يكتب انه خلص ويكتب تاريخ اخر رفع امتي زي اللي في النظام".
//
// ⚠️⚠️ ليه محتاجين نقوله أصلًا: البرنامج **مابيرفعش**. هو بيناول
// الملف بس، والرفع كله بيحصل هنا في المتصفح. فمن غير الأسطر دي،
// صفحة البرنامج عمرها ما هتعرف إن فيه حاجة بتحصل.
//
// ⚠️ ومن غير await ومن غير ما يوقّف أي حاجة: النداء ده تزويق، ولو
// البرنامج مقفول أو رفض، الرفع نفسه لازم يكمّل عادي.
function tellHelper(body) {
  try {
    fetch(HELPER_URL + '/products/file/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch (err) {
    /* البرنامج مش شغّال — مش مشكلة */
  }
}

async function uploadProductsFromHelper(onProgress, fallbackFingerprint) {
  const res = await fetch(HELPER_URL + '/products/file/raw');
  if (!res.ok) {
    let msg = 'مقدرتش أقرا الملف من البرنامج المساعد';
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch (err) {
      /* الرد مش JSON — بنسيب الرسالة العامة */
    }
    throw new Error(msg);
  }
  // ⚠️⚠️ الترويسة ممكن ترجع **فاضية** والبرنامج قديم: المتصفح مابيسمحش
  // للصفحة تقرا أي ترويسة من عندنا إلا لو البرنامج قال صراحةً إنها
  // مكشوفة (Access-Control-Expose-Headers) — وده اتضاف في 1.20.0.
  //
  // والبصمة الفاضية معناها إن النظام مش هيعرف إن الملف اترفع خلاص،
  // فهيرفع نفس الـ47 ألف صنف من أول وجديد **كل مرة يفتح**. فلو
  // الترويسة ماوصلتش، بنرجع للبصمة اللي قراناها من الحالة.
  const fingerprint = res.headers.get('X-Tazweed-Fingerprint') || fallbackFingerprint || '';
  const buf = await res.arrayBuffer();
  const list = await parseProductsFileBuffer(buf);
  tellHelper({ state: 'start', done: 0, total: list.length });
  // ⚠️ استبدال كامل — اتطلب بالنص: "وعاوز استبدال كامل لان انا ممكن
  // احذف اصناف او اضيف اصناف او اعدل اي صنف". يعني اللي اتشال من
  // الملف بيتشال من النظام، ومافيش حارس بيمنع النقصان.
  await saveProducts(
    list,
    (done, total) => {
      tellHelper({ state: 'working', done: done, total: total });
      if (onProgress) onProgress(done, total);
    },
    { sourceFingerprint: fingerprint }
  );
  tellHelper({ state: 'done', count: list.length, fingerprint: fingerprint });
  // السجل حاجة ثانوية — فشله مايلغيش نجاح الرفع نفسه.
  try {
    logActivity({ action: 'import_products_file', newValue: list.length });
  } catch (err) {
    console.warn('تعذّر تسجيل رفع ملف الأصناف في السجل:', err);
  }
  return { count: list.length, fingerprint };
}

// البصمة اللي النظام شايل منها دلوقتي
function uploadedFingerprint() {
  return (productsMeta && productsMeta.sourceFingerprint) || '';
}

// ============================================================
// الفحص اللي بيتنده أول ما النظام يفتح
// ============================================================
// ⚠️ اتطلب بالنص: "يرفع أول ما تفتح النظام".
//
// ⚠️⚠️ ومابيأخّرش فتح النظام: بينده بعد ما كل حاجة تبقى شغّالة،
// ومهلته ثانية ونص، والجهاز اللي مافيهوش البرنامج بيعدّي على طول.
async function checkProductsFile(opts) {
  const o = opts || {};
  if (pfileBusy) return;
  if (typeof canManageProducts === 'function' && !canManageProducts(state.profile)) return;
  const st = await productsFileState(o.force);
  if (!st || !st.path || !st.exists || !st.fingerprint) return;
  if (st.fingerprint === uploadedFingerprint()) return;
  if (!st.autoUpload) {
    // مقفول = مابنرفعش من ورا المستخدم. بنسأله.
    if (typeof onProductsFileChanged === 'function') onProductsFileChanged(st);
    if (!o.silent && typeof render === 'function' && state.screen === 'products') render();
    return;
  }
  await runProductsFileUpload(o);
}

// الرفع الفعلي + الرسالة اللي بتبان في الشريط
async function runProductsFileUpload(opts) {
  const o = opts || {};
  if (pfileBusy) return;
  if (typeof isServerReachable === 'function' && !isServerReachable()) {
    pfileNote = '⚠️ ملف الأصناف اتغيّر بس مفيش نت — هيترفع أول ما النت يرجع.';
    if (!o.silent && typeof render === 'function' && state.screen === 'products') render();
    return;
  }
  pfileBusy = true;
  pfileNote = '⏳ بيرفع ملف الأصناف من الكمبيوتر...';
  const paint = () => {
    if (!o.silent && typeof render === 'function' && state.screen === 'products') render();
  };
  paint();
  try {
    const r = await uploadProductsFromHelper(undefined, (pfileState && pfileState.fingerprint) || '');
    pfileDismissed = '';
    pfileNote = `✅ اترفع ملف الأصناف من الكمبيوتر — ${r.count} صنف.`;
  } catch (err) {
    console.error(err);
    pfileNote = `⚠️ مقدرتش أرفع ملف الأصناف: ${err.message || err}`;
    // ⚠️ الغلط بيوصل للبرنامج كمان: من غير كده الشريط عنده بيفضل
    // ماشي لحد ما يخلص بالمهلة، واللي قاعد على الكمبيوتر يفتكر إنه
    // شغّال وهو واقع.
    tellHelper({ state: 'error', error: String((err && err.message) || err) });
  }
  pfileBusy = false;
  // ⚠️ الحالة بتتقرا من الأول بعد الرفع: البصمة اتغيّرت، والشريط
  // لازم يعرف إن مافيش حاجة مستنية.
  pfileStateAt = 0;
  paint();
}

// ============================================================
// 🔔 الشريط اللي بيسأل — لما الرفع التلقائي مقفول
// ============================================================
// ⚠️ اتطلب بالنص: "لما اكون مش معلم علي الشيك بوكس بتاع الرفع
// التلقائي يجي تنبيه ل منشئ النظام ان في تغير حصل في الملف هل تريد
// رفع الملف".
//
// ⚠️⚠️ ومكانه شاشة الأصناف مش الشاشة الرئيسية: الرئيسية بتاعة المساعد
// مترتّبة بالنواقص، وحاجة زي دي بتتزحلق فيها. وده اللي اتطلب صراحةً
// إننا ناخد بالنا منه.
function productsFileBannerHTML() {
  const st = pfileState;
  const pending =
    st && st.path && st.exists && st.fingerprint && st.fingerprint !== uploadedFingerprint();
  const show = pending && st.fingerprint !== pfileDismissed;
  if (!pfileNote && !show) return '';
  return `
    <div class="card" id="pfile-banner" style="margin-bottom:12px; border-inline-start:3px solid var(--accent, #6b46c1);">
      ${pfileNote ? `<div style="font-size:13px; line-height:1.8;">${escapeHTML(pfileNote)}</div>` : ''}
      ${
        show && !pfileBusy
          ? `<div style="font-size:13px; line-height:1.8; ${pfileNote ? 'margin-top:8px;' : ''}">
               📦 ملف الأصناف على الكمبيوتر <strong>اتغيّر</strong>. ترفعه للنظام؟
               <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                 الرفع بيستبدل قايمة الأصناف كلها باللي في الملف.
               </div>
               <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                 <button class="btn btn-primary" id="pfile-upload">⬆️ ارفع دلوقتي</button>
                 <button class="btn" id="pfile-later">مش دلوقتي</button>
               </div>
             </div>`
          : ''
      }
    </div>`;
}

function attachProductsFileEvents() {
  const up = document.getElementById('pfile-upload');
  if (up) {
    up.addEventListener('click', () => {
      runProductsFileUpload({});
    });
  }
  const later = document.getElementById('pfile-later');
  if (later) {
    later.addEventListener('click', () => {
      pfileDismissed = (pfileState && pfileState.fingerprint) || '';
      pfileNote = '';
      if (typeof render === 'function') render();
    });
  }
}

// ============================================================
// ⏰ الفحص بيتعاد — مش مرة واحدة وخلاص
// ============================================================
// ⚠️⚠️ العطل اللي بيتصلّح هنا، اتبلّغ بالنص:
//
//   "دلوقتي انا اخترت المكان وعملت تحديث تلقائي ومفيش اي حاجه بتتحدث"
//
// والسبب إن الفحص كان **بيحصل مرة واحدة بس**، بعد الدخول بـ6 ثواني.
// والترتيب الطبيعي إن النظام بيبقى مفتوح **قبل** ما تروح تظبّط
// البرنامج المساعد — فالفحص بيكون عدّى والبرنامج لسه مافيهوش ملف،
// وبعد ما تظبّطه مافيش أي حاجة بترجع تسأل. والنتيجة: تظبّط كل حاجة
// صح ومايحصلش أي حاجة لحد ما تعمل ريفريش.
//
// فدلوقتي بيتعاد في تلات حالات:
//   ١) بعد الدخول بشوية (زي الأول)
//   ٢) كل شوية والصفحة مفتوحة قدامك
//   ٣) ⭐ أول ما ترجع للنظام بعد ما تكون سبته — ودي اللي بتمسك
//      "روحت ظبّطت البرنامج ورجعت"، من غير أي انتظار
const PFILE_BOOT_DELAY_MS = 6000;

// ⚠️ 3 دقايق: النداء رايح لـ127.0.0.1 (نفس الجهاز، مابيعدّيش على النت)
// ومهلته ثانية ونص — يعني تكلفته على سرعة النظام صفر عمليًا. وبرضه
// مابيشتغلش والصفحة مخفية، عشان مايفضلش شغّال في تبويب منسي.
const PFILE_WATCH_MS = 3 * 60 * 1000;
let pfileWatchTimer = null;

function scheduleProductsFileCheck() {
  setTimeout(() => {
    checkProductsFile({ silent: false }).catch(() => {});
  }, PFILE_BOOT_DELAY_MS);

  if (pfileWatchTimer) return; // مرة واحدة لكل جلسة
  pfileWatchTimer = setInterval(() => {
    if (document.hidden) return;
    checkProductsFile({}).catch(() => {});
  }, PFILE_WATCH_MS);

  // ⚠️ force: الحالة متخزّنة 30 ثانية، واللي رجع دلوقتي من البرنامج
  // المساعد غالبًا غيّر حاجة فيه **في الـ30 ثانية دول بالظبط**.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    checkProductsFile({ force: true }).catch(() => {});
  });
}
