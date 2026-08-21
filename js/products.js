// ============================================================
// قاعدة بيانات الأصناف (الأصناف اللي في الكاشير — عشرات الآلاف)
// ============================================================
// المشكلة اللي بتحلها: عندك ملف إكسل فيه كل أصناف المحل (ممكن يوصل 50 ألف
// صنف). عايز تبحث فيه في أي وقت، وتطبع باركود منه، وتربط فئات النظام
// بأصناف منه — وكل ده يشتغل **حتى لو الجهاز مش متصل بالنت**.
//
// ------------------------------------------------------------
// ليه مش بنربط ملف الإكسل نفسه؟
// ------------------------------------------------------------
// المتصفح مش بيقدر "يفضل متصل" بملف على جهازك. أول ما تقفل الصفحة، الربط
// بيروح، ولازم تختار الملف تاني كل مرة — ولو الملف على جهاز واحد بس،
// باقي الأجهزة مش هتشوفه أصلًا.
//
// الحل اللي اشتغلنا بيه: **تستورد الملف مرة واحدة**، والنظام يحفظ الأصناف
// في السحابة، وكل جهاز ياخد نسخة محلية منها لوحده. بعد كده الملف نفسه
// مالوش لازمة — البحث والطباعة شغالين حتى من غير نت.
//
// ------------------------------------------------------------
// ليه بنحفظهم في "قطع" مش مستند لكل صنف؟
// ------------------------------------------------------------
// الباقة المجانية في Firestore بتسمح بـ20 ألف كتابة في اليوم. لو كل صنف
// مستند لوحده، استيراد 50 ألف صنف = 50 ألف كتابة = تعدّي الحد وتوقّف.
//
// فبنحط 2000 صنف في مستند واحد ("قطعة"). يعني 50 ألف صنف = 25 كتابة بس،
// وقراءتهم كلهم = 25 قراءة. وFirestore بيحفظ المستندات دي محليًا لوحده،
// فتاني مرة بيفتحوا من غير نت وبسرعة.

const PRODUCTS_CHUNK_SIZE = 2000;

// نسخة الأصناف في الذاكرة + فهرس بحث نصّي جاهز.
// الفهرس ده هو سر السرعة: بدل ما نلف على 50 ألف كائن وندخل جوه حقوله في كل
// ضغطة زرار، بنجهّز نص واحد صغير لكل صنف مرة واحدة عند التحميل، والبحث
// بيبقى مجرد indexOf على نص — 2 مللي ثانية لأسوأ حالة على تليفون متوسط.
let productsCache = null; // [{ code, name, barcode, price, origPrice, dept }]
let productsIndex = null; // [نص بحث موحّد لكل صنف بنفس الترتيب]
let productsLoading = null;
let productsMeta = null;

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// بيشيل الأصفار البادئة عشان "012133" و"12133" يتحسبوا نفس الباركود.
function normalizeBarcode(value) {
  return String(value || '').trim().replace(/^0+/, '');
}

function buildProductsIndex(list) {
  // p.code موجود لتوافق الاستيرادات القديمة اللي كانت بتحفظ كود منفصل
  return list.map((p) =>
    normalizeSearchText(`${p.name} ${p.barcode} ${p.code || ''} ${p.dept} ${p.subDept || ''}`)
  );
}

// بيحمّل الأصناف مرة واحدة لكل جلسة. لو مفيش نت، Firestore بيرجّع النسخة
// المحفوظة محليًا من غير أي كود إضافي مننا.
function loadProducts(force) {
  if (productsCache && !force) return Promise.resolve(productsCache);
  if (productsLoading && !force) return productsLoading;

  productsLoading = (async () => {
    const snap = await db.collection('products').get();
    const chunks = [];
    snap.docs.forEach((d) => {
      if (d.id === 'meta') {
        productsMeta = d.data();
        return;
      }
      const data = d.data();
      chunks.push({ index: Number(data.index) || 0, items: data.items || [] });
    });
    chunks.sort((a, b) => a.index - b.index);

    const list = [];
    chunks.forEach((c) => c.items.forEach((it) => list.push(it)));
    productsCache = list;
    productsIndex = buildProductsIndex(list);
    return list;
  })();

  productsLoading.catch(() => {
    productsLoading = null;
  });
  return productsLoading;
}

function productDepartments() {
  const set = new Set();
  (productsCache || []).forEach((p) => {
    if (p.dept) set.add(p.dept);
  });
  return [...set].sort();
}

// الأقسام الفرعية **اللي جوه قسم رئيسي معيّن** — عشان لو اخترت "ملابس"
// تشوف الفرعية بتاعته بس، مش كل الفرعية في المحل.
function productSubDepartments(dept) {
  const set = new Set();
  (productsCache || []).forEach((p) => {
    if (dept && p.dept !== dept) return;
    if (p.subDept) set.add(p.subDept);
  });
  return [...set].sort();
}

// بحث نصي في الفهرس الجاهز. كل الكلمات لازم تظهر (بحث "و" مش "أو")،
// عشان لما تكتب "كريب اسود" ما يجيبش كل الكريب وكل الأسود.
function searchProducts(query, dept, limit, subDept) {
  const list = productsCache || [];
  const words = normalizeSearchText(query).split(' ').filter(Boolean);
  const max = limit || 500;
  const out = [];

  for (let i = 0; i < list.length && out.length < max; i++) {
    if (dept && list[i].dept !== dept) continue;
    if (subDept && list[i].subDept !== subDept) continue;
    if (words.length) {
      const hay = productsIndex[i];
      let ok = true;
      for (let w = 0; w < words.length; w++) {
        if (hay.indexOf(words[w]) === -1) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    out.push(list[i]);
  }
  return out;
}

function findProductByBarcode(value) {
  const target = normalizeBarcode(value);
  if (!target) return null;
  const list = productsCache || [];
  for (let i = 0; i < list.length; i++) {
    if (normalizeBarcode(list[i].barcode) === target) return list[i];
    if (normalizeBarcode(list[i].code) === target) return list[i];
  }
  return null;
}

// ------------------------------------------------------------
// حفظ الأصناف في السحابة (على قطع)
// ------------------------------------------------------------
async function saveProducts(list, onProgress) {
  const chunks = [];
  for (let i = 0; i < list.length; i += PRODUCTS_CHUNK_SIZE) {
    chunks.push(list.slice(i, i + PRODUCTS_CHUNK_SIZE));
  }

  // القطع القديمة اللي زيادة عن الجديدة لازم تتمسح، وإلا هتفضل أصناف
  // قديمة ظاهرة بعد استيراد ملف أصغر.
  const existing = await db.collection('products').get();
  const oldChunkIds = existing.docs.map((d) => d.id).filter((id) => id !== 'meta');

  for (let i = 0; i < chunks.length; i++) {
    await db.collection('products').doc(`chunk_${i}`).set({ index: i, items: chunks[i] });
    if (onProgress) onProgress(Math.min(list.length, (i + 1) * PRODUCTS_CHUNK_SIZE), list.length);
  }

  for (const id of oldChunkIds) {
    const n = Number(String(id).replace('chunk_', ''));
    if (Number.isFinite(n) && n >= chunks.length) {
      await db.collection('products').doc(id).delete();
    }
  }

  await db.collection('products').doc('meta').set({
    count: list.length,
    chunks: chunks.length,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedByName: (state.profile && state.profile.name) || '',
  });

  productsCache = list;
  productsIndex = buildProductsIndex(list);
}

// ------------------------------------------------------------
// استيراد ملف الأصناف مع **اختيار الأعمدة**
// ------------------------------------------------------------
// ملفات الكاشير بتختلف من محل لمحل: عمود الاسم ممكن يكون الأول أو التالت،
// والباركود ممكن يكون اسمه "الكود" أو "Barcode". فبدل ما نخمّن، بنوري
// عناوين الملف الحقيقية وانت تختار كل عمود بيقابل إيه.
// ملحوظة مهمة اتصلحت: كان فيه حقل "كود الصنف" منفصل عن "الباركود".
// في الواقع في ملفات الكاشير الاتنين نفس الحاجة، فكان بيتكرر ويلخبط.
// بقى حقل واحد: الباركود.
//
// وضفنا "القسم الفرعي" — القسم الرئيسي فيه أقسام جواه (ملابس ← طرح ←
// كريب مثلًا)، وده كان ناقص خالص.
const PRODUCT_FIELDS = [
  { key: 'name', label: 'اسم الصنف', required: true, hints: ['اسم الصنف', 'الصنف', 'اسم', 'صنف', 'name', 'item', 'product', 'description'] },
  { key: 'barcode', label: 'الباركود', required: false, hints: ['باركود', 'barcode', 'ean', 'upc', 'كود', 'code', 'sku'] },
  // ترتيب التلميحات مهم: الأدق الأول. "بعد الخصم" هو سعر البيع الفعلي،
  // و"سعر البيع" المجرد في ملفات كتير هو السعر قبل الخصم.
  { key: 'price', label: 'سعر البيع (الفعلي)', required: false, hints: ['بعد الخصم', 'سعر البيع', 'بيع', 'price', 'sell', 'سعر'] },
  { key: 'origPrice', label: 'السعر قبل الخصم', required: false, hints: ['قبل الخصم', 'قبل', 'اصلي', 'أصلي', 'original', 'old'] },
  { key: 'dept', label: 'القسم الرئيسي', required: false, hints: ['القسم الرئيسي', 'رئيسي', 'قسم', 'مجموعة', 'category', 'dept', 'group'] },
  { key: 'subDept', label: 'القسم الفرعي', required: false, hints: ['القسم الفرعي', 'فرعي', 'تحت', 'sub', 'subcategory'] },
];

// used: أرقام الأعمدة اللي اتحجزت لحقول قبل كده.
// ⚠️ الفحص ده كان ناقص، وده اللي خلّى "الباركود" و"كود الصنف" يتخمّنوا
// **نفس العمود** — عمود واحد مايقدرش يكون معناه حاجتين.
function guessColumn(headers, field, used) {
  const norm = headers.map((h) => normalizeSearchText(h));
  const free = (i) => i !== -1 && !(used || []).includes(i);

  // مطابقة كاملة الأول (الأدق)، وبعدين مطابقة جزئية
  for (const hint of field.hints) {
    const h = normalizeSearchText(hint);
    const i = norm.findIndex((x, idx) => x === h && free(idx));
    if (i !== -1) return i;
  }
  for (const hint of field.hints) {
    const h = normalizeSearchText(hint);
    const i = norm.findIndex((x, idx) => x && x.indexOf(h) !== -1 && free(idx));
    if (i !== -1) return i;
  }
  return -1;
}

function openProductsImportDialog(onDone) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2600;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:460px; width:100%; max-height:90vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:4px;">استيراد ملف الأصناف</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.7; margin-bottom:12px;">
        اختار ملف الإكسل، وبعدين قوللي كل عمود فيه معناه إيه. الاستيراد بيتعمل
        <strong>مرة واحدة</strong> — بعدها البحث والطباعة شغّالين حتى من غير نت.
      </div>

      <div class="field">
        <input class="input" type="file" id="pimport-file" accept=".xlsx,.xls,.csv" />
      </div>

      <div id="pimport-status" style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;"></div>
      <div id="pimport-map" style="display:none;"></div>
      <div id="pimport-preview" style="display:none; margin-top:10px;"></div>

      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px;">
        <button class="btn" id="pimport-close">إغلاق</button>
        <button class="btn btn-primary" id="pimport-confirm" style="display:none;">حفظ في النظام</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('pimport-close').addEventListener('click', close);

  const statusEl = document.getElementById('pimport-status');
  const mapEl = document.getElementById('pimport-map');
  const previewEl = document.getElementById('pimport-preview');
  const confirmBtn = document.getElementById('pimport-confirm');

  let rows = [];
  let headers = [];

  const renderPreview = () => {
    const map = {};
    PRODUCT_FIELDS.forEach((f) => {
      const sel = document.getElementById(`pmap-${f.key}`);
      map[f.key] = sel ? Number(sel.value) : -1;
    });

    if (map.name < 0) {
      previewEl.style.display = 'none';
      confirmBtn.style.display = 'none';
      statusEl.innerHTML = '⚠️ لازم تختار عمود <strong>اسم الصنف</strong> على الأقل.';
      return null;
    }

    const list = buildProductList(rows, map);
    statusEl.innerHTML = `جاهز: <strong>${list.length}</strong> صنف من الملف.`;

    previewEl.innerHTML = `
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">أول 5 أصناف — اتأكد إن الأعمدة مظبوطة:</div>
      <div style="max-height:26vh; overflow:auto; border:1px solid var(--border); border-radius:8px;">
        <table style="width:100%; font-size:11px; border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:start; padding:5px;">الاسم</th>
            <th style="text-align:start; padding:5px;">الباركود</th>
            <th style="text-align:start; padding:5px;">السعر</th>
            <th style="text-align:start; padding:5px;">القسم</th>
            <th style="text-align:start; padding:5px;">الفرعي</th>
          </tr></thead>
          <tbody>
            ${list
              .slice(0, 5)
              .map(
                (p) => `<tr>
                  <td style="padding:4px 5px; border-top:1px solid var(--border);">${escapeHTML(p.name)}</td>
                  <td style="padding:4px 5px; border-top:1px solid var(--border);">${escapeHTML(p.barcode || '—')}</td>
                  <td style="padding:4px 5px; border-top:1px solid var(--border);">${escapeHTML(p.price || 0)}</td>
                  <td style="padding:4px 5px; border-top:1px solid var(--border);">${escapeHTML(p.dept || '—')}</td>
                  <td style="padding:4px 5px; border-top:1px solid var(--border);">${escapeHTML(p.subDept || '—')}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
    previewEl.style.display = 'block';
    confirmBtn.style.display = list.length ? 'inline-block' : 'none';
    confirmBtn.textContent = `حفظ ${list.length} صنف`;
    return list;
  };

  document.getElementById('pimport-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // ⚠️ بتتحمّل وقت الحاجة — الشرح الكامل عند ensureXLSX في import-export.js
    statusEl.textContent = 'جارٍ تجهيز قارئ الإكسل...';
    if (!(await ensureXLSX())) {
      statusEl.textContent = 'مكتبة قراءة الإكسل ماتحمّلتش. اتصل بالنت وجرّب تاني.';
      return;
    }

    statusEl.textContent = 'جارٍ قراءة الملف...';
    mapEl.style.display = 'none';
    previewEl.style.display = 'none';
    confirmBtn.style.display = 'none';

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const all = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      headers = (all[0] || []).map((h) => String(h || '').trim());
      rows = all.slice(1).filter((r) => r.some((c) => String(c || '').trim()));
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'تعذّر قراءة الملف. اتأكد إنه إكسل صحيح.';
      return;
    }

    if (!headers.length || !rows.length) {
      statusEl.textContent = 'الملف فاضي أو مفيهوش صف عناوين في أول سطر.';
      return;
    }

    // بنخمّن الحقول بالترتيب، وكل حقل بيحجز عموده فمحدش ياخده تاني.
    const usedCols = [];
    const guesses = {};
    PRODUCT_FIELDS.forEach((f) => {
      const g = guessColumn(headers, f, usedCols);
      guesses[f.key] = g;
      if (g !== -1) usedCols.push(g);
    });

    mapEl.innerHTML = `
      <div style="font-size:13px; font-weight:500; margin:6px 0 8px;">كل عمود معناه إيه؟</div>
      ${PRODUCT_FIELDS.map((f) => {
        const guess = guesses[f.key];
        return `
        <div class="field" style="margin-bottom:8px;">
          <label>${escapeHTML(f.label)}${f.required ? ' *' : ''}</label>
          <select class="input" id="pmap-${f.key}">
            <option value="-1">— مش موجود —</option>
            ${headers
              .map(
                (h, i) =>
                  `<option value="${i}" ${i === guess ? 'selected' : ''}>${escapeHTML(h || `عمود ${i + 1}`)}</option>`
              )
              .join('')}
          </select>
        </div>`;
      }).join('')}`;
    mapEl.style.display = 'block';

    PRODUCT_FIELDS.forEach((f) => {
      document.getElementById(`pmap-${f.key}`).addEventListener('change', renderPreview);
    });
    renderPreview();
  });

  confirmBtn.addEventListener('click', async () => {
    if (!state.isOnline) {
      statusEl.innerHTML = '⚠️ الاستيراد محتاج إنترنت (بيرفع الأصناف للسحابة). اتصل وحاول تاني.';
      return;
    }
    const list = renderPreview();
    if (!list || !list.length) return;

    confirmBtn.disabled = true;
    document.getElementById('pimport-file').disabled = true;
    try {
      await saveProducts(list, (done, total) => {
        statusEl.innerHTML = `جارٍ الحفظ... <strong>${done}</strong> من ${total}`;
      });
      statusEl.innerHTML = `✅ اتحفظ <strong>${list.length}</strong> صنف. البحث والطباعة شغّالين دلوقتي حتى من غير نت.`;
      confirmBtn.style.display = 'none';
      // السجل حاجة ثانوية — فشله مايلغيش نجاح الاستيراد نفسه.
      try {
        logActivity({ action: 'import_products', newValue: list.length });
      } catch (err) {
        console.warn('تعذّر تسجيل الاستيراد في السجل:', err);
      }
      if (onDone) onDone();
    } catch (err) {
      console.error(err);
      statusEl.innerHTML = `⚠️ فشل الحفظ: ${escapeHTML(err.message || err)}`;
      confirmBtn.disabled = false;
    }
  });
}

function buildProductList(rows, map) {
  const pick = (row, idx) => (idx >= 0 ? String(row[idx] === undefined ? '' : row[idx]).trim() : '');
  const num = (v) => {
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const out = [];
  const seen = new Set();
  rows.forEach((row) => {
    const name = pick(row, map.name);
    if (!name) return;
    const barcode = pick(row, map.barcode);
    // مفتاح التكرار: الباركود لو موجود، وإلا الاسم.
    const key = barcode || name;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      name,
      barcode,
      price: num(pick(row, map.price)),
      origPrice: num(pick(row, map.origPrice)),
      dept: pick(row, map.dept),
      subDept: pick(row, map.subDept),
    });
  });
  return out;
}

// ============================================================
// شاشة قاعدة بيانات الأصناف
// ============================================================
const PRODUCTS_PAGE_SIZE = 50;

function productsScreenHTML() {
  if (!productsCache) {
    return `<div class="home-empty" style="padding:2rem; text-align:center;">جارٍ تحميل الأصناف...</div>`;
  }

  const total = productsCache.length;
  if (!total) {
    return `
      <div class="card" style="margin:1rem; text-align:center;">
        <div style="font-size:15px; font-weight:500; margin-bottom:8px;">مفيش أصناف متحمّلة لسه</div>
        <div style="font-size:13px; color:var(--text-secondary); line-height:1.8; margin-bottom:14px;">
          استورد ملف الأصناف بتاع الكاشير مرة واحدة، وبعدها هتقدر تبحث فيه وتطبع
          منه باركود — حتى من غير إنترنت.
        </div>
        ${
          canManageProducts(state.profile)
            ? `<button class="btn btn-primary" id="products-import-btn">📥 استيراد ملف الأصناف</button>`
            : `<div style="font-size:12px; color:var(--text-muted);">اطلب من المدير يستورد الملف.</div>`
        }
      </div>`;
  }

  const results = searchProducts(state.productSearch, state.productDept, 5000, state.productSubDept);
  const pages = Math.max(1, Math.ceil(results.length / PRODUCTS_PAGE_SIZE));
  const page = Math.min(state.productPage || 1, pages);
  const start = (page - 1) * PRODUCTS_PAGE_SIZE;
  const shown = results.slice(start, start + PRODUCTS_PAGE_SIZE);
  const depts = productDepartments();
  const subDepts = productSubDepartments(state.productDept);

  const rowsHTML = shown
    .map(
      (p, i) => `
      <tr>
        <td style="color:var(--text-muted);">${start + i + 1}</td>
        <td>${escapeHTML(p.name)}</td>
        <td style="white-space:nowrap;">${escapeHTML(p.barcode || p.code || '—')}</td>
        <td style="white-space:nowrap;">${p.price ? escapeHTML(p.price) : '—'}</td>
        <td>${escapeHTML(p.dept || '—')}</td>
        <td>${escapeHTML(p.subDept || '—')}</td>
        <td style="white-space:nowrap;">
          <button class="btn" style="padding:4px 10px; font-size:12px;"
                  data-print-product="${escapeHTML(p.barcode || p.code || p.name)}">🏷️ طباعة</button>
        </td>
      </tr>`
    )
    .join('');

  const cardsHTML = shown
    .map(
      (p) => `
      <div class="grade-card">
        <div class="gc-head">
          <span class="gc-num" style="font-size:13px;">${escapeHTML(p.name)}</span>
        </div>
        <div class="gc-line"><span class="gc-label">الباركود</span><span>${escapeHTML(p.barcode || p.code || '—')}</span></div>
        <div class="gc-line"><span class="gc-label">السعر</span><span>${p.price ? escapeHTML(p.price) : '—'}</span></div>
        <div class="gc-line"><span class="gc-label">القسم الرئيسي</span><span>${escapeHTML(p.dept || '—')}</span></div>
        <div class="gc-line"><span class="gc-label">القسم الفرعي</span><span>${escapeHTML(p.subDept || '—')}</span></div>
        <button class="btn" style="width:100%;" data-print-product="${escapeHTML(p.barcode || p.code || p.name)}">🏷️ طباعة ملصق</button>
      </div>`
    )
    .join('');

  return `
    <div style="padding:1rem;">
      <div class="card" style="margin-bottom:12px; padding:12px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
          <div class="field" style="flex:1; min-width:170px; margin-bottom:0;">
            <label>ابحث بالاسم أو الباركود</label>
            <input class="input" id="products-search" value="${escapeHTML(state.productSearch || '')}"
                   placeholder="اكتب أي جزء من الاسم..." />
          </div>
          ${
            depts.length
              ? `<div class="field" style="width:150px; margin-bottom:0;">
                   <label>القسم الرئيسي</label>
                   <select class="input" id="products-dept">
                     <option value="">كل الأقسام</option>
                     ${depts
                       .map(
                         (d) =>
                           `<option value="${escapeHTML(d)}" ${d === state.productDept ? 'selected' : ''}>${escapeHTML(d)}</option>`
                       )
                       .join('')}
                   </select>
                 </div>`
              : ''
          }
          ${
            subDepts.length
              ? `<div class="field" style="width:150px; margin-bottom:0;">
                   <label>القسم الفرعي</label>
                   <select class="input" id="products-sub-dept">
                     <option value="">كل الفرعية</option>
                     ${subDepts
                       .map(
                         (d) =>
                           `<option value="${escapeHTML(d)}" ${d === state.productSubDept ? 'selected' : ''}>${escapeHTML(d)}</option>`
                       )
                       .join('')}
                   </select>
                 </div>`
              : ''
          }
          ${isBarcodeScanSupported() ? `<button class="btn" id="products-scan-btn">📷 مسح</button>` : ''}
          ${canManageProducts(state.profile) ? `<button class="btn" id="products-import-btn">📥 تحديث الملف</button>` : ''}
        </div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:10px;">
          إجمالي الأصناف: <strong>${escapeHTML(total)}</strong>
          ${state.productSearch || state.productDept || state.productSubDept ? ` — نتيجة البحث: <strong>${escapeHTML(results.length)}</strong>` : ''}
        </div>
      </div>

      ${
        results.length
          ? state.isNarrow
            ? `<div class="grade-cards">${cardsHTML}</div>`
            : `<div class="card" data-keep-scroll="products" style="padding:0; overflow:auto;">
                 <table>
                   <thead><tr>
                     <th class="sticky-th">#</th>
                     <th class="sticky-th">اسم الصنف</th>
                     <th class="sticky-th">الباركود</th>
                     <th class="sticky-th">السعر</th>
                     <th class="sticky-th">القسم الرئيسي</th>
                     <th class="sticky-th">القسم الفرعي</th>
                     <th class="sticky-th"></th>
                   </tr></thead>
                   <tbody>${rowsHTML}</tbody>
                 </table>
               </div>`
          : `<div class="home-empty" style="text-align:center; padding:2rem;">مفيش نتيجة للبحث ده.</div>`
      }

      ${
        pages > 1
          ? `<div style="display:flex; gap:8px; align-items:center; justify-content:center; margin-top:12px; flex-wrap:wrap;">
               <button class="btn" id="products-prev" ${page <= 1 ? 'disabled' : ''}>السابق</button>
               <span style="font-size:13px;">صفحة ${page} من ${pages}</span>
               <button class="btn" id="products-next" ${page >= pages ? 'disabled' : ''}>التالي</button>
             </div>`
          : ''
      }
    </div>`;
}

function attachProductsEvents() {
  const importBtn = document.getElementById('products-import-btn');
  if (importBtn) importBtn.addEventListener('click', () => openProductsImportDialog(() => render()));

  const searchEl = document.getElementById('products-search');
  if (searchEl) {
    // بنستنى وقفة صغيرة بعد آخر حرف بدل ما نعيد الرسم مع كل ضغطة —
    // الفرق محسوس لما تكون بتبحث في عشرات الآلاف.
    let timer = null;
    searchEl.addEventListener('input', () => {
      // ⚠️ القيمة بتتسجّل **فورًا** مع كل حرف، والرسم هو اللي بيتأجّل.
      // لو أجّلنا التسجيل كمان (زي ما كان)، الرسم بيلاقي قيمة قديمة
      // وبيرجّع خانة البحث لحالة قبل آخر حرف — فالحرف بيضيع. ده كان بيبان
      // على التليفون بالذات: "بضغط الحرف مش بيسمع".
      state.productSearch = searchEl.value;
      state.productPage = 1;
      clearTimeout(timer);
      timer = setTimeout(() => {
        render();
        const again = document.getElementById('products-search');
        if (again) {
          again.focus();
          again.setSelectionRange(again.value.length, again.value.length);
        }
      }, 220);
    });
  }

  const deptEl = document.getElementById('products-dept');
  if (deptEl) {
    deptEl.addEventListener('change', () => {
      state.productDept = deptEl.value;
      // القسم الفرعي المختار غالبًا مش موجود جوه القسم الرئيسي الجديد،
      // فبنصفّره عشان ما تلاقيش نفسك ببحث مالوش نتيجة من غير سبب واضح.
      state.productSubDept = '';
      state.productPage = 1;
      render();
    });
  }

  const subDeptEl = document.getElementById('products-sub-dept');
  if (subDeptEl) {
    subDeptEl.addEventListener('change', () => {
      state.productSubDept = subDeptEl.value;
      state.productPage = 1;
      render();
    });
  }

  const scanBtn = document.getElementById('products-scan-btn');
  if (scanBtn) {
    scanBtn.addEventListener('click', () =>
      safeAsync(
        () =>
          openBarcodeScanner((value) => {
            state.productSearch = value;
            state.productPage = 1;
            render();
          }),
        'فتح الكاميرا'
      )
    );
  }

  const prev = document.getElementById('products-prev');
  if (prev) prev.addEventListener('click', () => { state.productPage = Math.max(1, (state.productPage || 1) - 1); render(); });
  const next = document.getElementById('products-next');
  if (next) next.addEventListener('click', () => { state.productPage = (state.productPage || 1) + 1; render(); });

  document.querySelectorAll('[data-print-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-print-product');
      const product = (productsCache || []).find(
        (p) => (p.barcode || p.code || p.name) === key
      );
      if (product) safeAsync(() => printProductLabel(product), 'طباعة الملصق');
    });
  });
}

// بيحوّل صنف من قاعدة الأصناف لشكل الملصق اللي buildLabelHTML بيفهمه.
function productAsLabelSource(product) {
  return {
    name: product.name,
    itemName: product.name,
    barcodeNumber: product.barcode || product.code || '',
    originalPrice: product.origPrice || 0,
    sellingPrice: product.price || 0,
  };
}

function printProductLabel(product) {
  // safeAsync مهمة هنا: من غيرها أي فشل جوه printLabel بيطلع للمستخدم
  // كرسالة إنجليزي خام تحت الشاشة مكتوب فيها "Promise: ..." — لأن الدالة
  // بترجّع وعد مافيش حد ماسك فشله (الكلبك جوه promptLabelSize).
  promptLabelSize((sizeOptions) =>
    safeAsync(() => printLabel(productAsLabelSource(product), sizeOptions), 'طباعة الملصق')
  );
}

// ============================================================
// اختيار صنف من القاعدة (بيستخدم في ربط الفئة بصنف)
// ============================================================
// بدل ما تكتب اسم الصنف والباركود والسعر بإيدك في كل فئة، بتدوّر وتختار
// والنظام بيملا الأربع خانات لوحده.
function openProductPicker(onPick) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2600;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:460px; width:100%; max-height:88vh; display:flex; flex-direction:column;">
      <div style="font-size:15px; font-weight:500; margin-bottom:8px;">اختار صنف من قاعدة الأصناف</div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <input class="input" id="picker-search" placeholder="ابحث بالاسم أو الباركود..." style="flex:1;" />
        ${isBarcodeScanSupported() ? `<button class="btn" id="picker-scan">📷</button>` : ''}
      </div>
      <div id="picker-results" style="flex:1; overflow:auto; border:1px solid var(--border); border-radius:8px; min-height:120px;"></div>
      <div style="display:flex; justify-content:flex-end; margin-top:12px;">
        <button class="btn" id="picker-close">إغلاق</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('picker-close').addEventListener('click', close);

  const resultsEl = document.getElementById('picker-results');
  const searchEl = document.getElementById('picker-search');

  const draw = () => {
    if (!productsCache) {
      resultsEl.innerHTML = '<div style="padding:14px; font-size:13px; color:var(--text-secondary);">جارٍ تحميل الأصناف...</div>';
      return;
    }
    if (!productsCache.length) {
      resultsEl.innerHTML =
        '<div style="padding:14px; font-size:13px; color:var(--text-secondary);">مفيش أصناف متحمّلة. استورد ملف الأصناف الأول من شاشة "الأصناف".</div>';
      return;
    }
    const found = searchProducts(searchEl.value, '', 60);
    if (!found.length) {
      resultsEl.innerHTML = '<div style="padding:14px; font-size:13px; color:var(--text-secondary);">مفيش نتيجة.</div>';
      return;
    }
    resultsEl.innerHTML = found
      .map(
        (p, i) => `
        <div class="home-row" style="padding:8px 10px; cursor:pointer;" data-pick="${i}">
          <div style="flex:1; min-width:0;">
            <div class="home-row-title">${escapeHTML(p.name)}</div>
            <div class="home-row-sub">${escapeHTML(p.barcode || p.code || '—')}${p.price ? ` — ${escapeHTML(p.price)} ج` : ''}</div>
          </div>
        </div>`
      )
      .join('');
    resultsEl.querySelectorAll('[data-pick]').forEach((row) => {
      row.addEventListener('click', () => {
        const p = found[Number(row.getAttribute('data-pick'))];
        close();
        onPick(p);
      });
    });
  };

  let timer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(draw, 200);
  });

  const scanBtn = document.getElementById('picker-scan');
  if (scanBtn) {
    scanBtn.addEventListener('click', () =>
      safeAsync(
        () =>
          openBarcodeScanner((value) => {
            searchEl.value = value;
            draw();
          }),
        'فتح الكاميرا'
      )
    );
  }

  loadProducts().then(draw).catch(() => draw());
  draw();
  searchEl.focus();
}
