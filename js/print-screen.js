// ============================================================
// شاشة طباعة الباركود
// ============================================================
// الفكرة: موظف واقف عند الطابعة، قدامه كوم أصناف عايز يطبعلها ملصقات.
// بيصوّر باركود الصنف بالكاميرا (أو يبحث بالاسم)، الصنف بيتحط في "سلة
// الطباعة" بعدد، وفي الآخر ضغطة واحدة بتطبع الكل.
//
// الشاشة دي ليها رتبة خاصة (موظف طباعة) — الحساب ده بيفتح عليها على طول
// ومايشوفش أي حاجة تانية في النظام.

// ============================================================
// ⚠️ نتايج البحث في دالة لوحدها — والسبب مش تنظيم كود
// ============================================================
// المشكلة اللي كانت بتحصل وانت بتكتب على التليفون: بعد كل حرف كنا بننادي
// render()، و render() بيعمل root.innerHTML = ... يعني **بيهدّ الشاشة كلها
// ويبنيها من الأول** — بما فيها خانة البحث اللي صباعك واقف فيها.
//
// والخانة الجديدة بترسم بالقيمة المتسجّلة في state، فأي حرف كتبته في
// اللحظة اللي بين الضغطة والرسم **بيتمسح**. وده بالظبط اللي كان بيحصل:
// "بضغط على الحرف مش بيسمع، بمسح وبضغط تاني".
//
// الحل: وانت بتكتب، بنحدّث **قايمة النتايج بس** (updatePrintResults تحت)
// ومابنلمسش خانة الكتابة خالص.
function printResultsHTML() {
  const results = productsCache ? searchProducts(state.printSearch, '', 40) : [];
  return !productsCache
    ? `<div class="home-empty">جارٍ تحميل الأصناف...</div>`
    : !productsCache.length
      ? `<div class="home-empty">
           مفيش أصناف متحمّلة لسه.
           ${canManageProducts(state.profile) ? 'افتح شاشة "الأصناف" واستورد الملف.' : 'اطلب من المدير يستورد ملف الأصناف.'}
         </div>`
      : !state.printSearch
        ? `<div class="home-empty">صوّر باركود بالكاميرا، أو اكتب اسم الصنف فوق.</div>`
        : !results.length
          ? `<div class="home-empty">مفيش نتيجة لـ"${escapeHTML(state.printSearch)}".</div>`
          : results
              .map(
                (p, i) => `
        <div class="home-row">
          <div style="flex:1; min-width:0;">
            <div class="home-row-title">${escapeHTML(p.name)}</div>
            <div class="home-row-sub">${escapeHTML(p.barcode || p.code || '—')}${p.price ? ` — ${escapeHTML(p.price)} ج` : ''}</div>
          </div>
          <button class="btn" data-add-product="${i}">+ أضف</button>
        </div>`
              )
              .join('');
}

function printScreenHTML() {
  const cart = state.printCart || [];
  const totalLabels = cart.reduce((s, it) => s + (it.qty || 0), 0);
  const resultsHTML = printResultsHTML();

  const cartHTML = !cart.length
    ? `<div class="home-empty">السلة فاضية. ضيف أصناف من فوق.</div>`
    : cart
        .map(
          (it, i) => `
      <div class="home-row">
        <div style="flex:1; min-width:0;">
          <div class="home-row-title">${escapeHTML(it.product.name)}</div>
          <div class="home-row-sub">${escapeHTML(it.product.barcode || it.product.code || '—')}</div>
        </div>
        <div class="qty-cell">
          <button class="qty-btn" data-cart-dec="${i}">−</button>
          <input class="qty-input" type="number" min="1" max="200" value="${escapeHTML(it.qty)}"
                 data-cart-qty="${i}" inputmode="numeric" />
          <button class="qty-btn" data-cart-inc="${i}">+</button>
        </div>
        <button class="btn" style="padding:4px 10px; font-size:12px; color:var(--danger-text);" data-cart-del="${i}">حذف</button>
      </div>`
        )
        .join('');

  return `
    <div class="home-wrap">
      <div class="home-card">
        <div class="home-title">🔎 دوّر على الصنف</div>
        <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
          <input class="input" id="print-search" style="flex:1; min-width:150px;"
                 value="${escapeHTML(state.printSearch || '')}" placeholder="اسم الصنف أو الباركود..." />
          ${isBarcodeScanSupported() ? `<button class="btn btn-primary" id="print-scan-btn">📷 صوّر باركود</button>` : ''}
        </div>
        <div id="print-results" data-keep-scroll="print-results" style="max-height:34vh; overflow:auto;">${resultsHTML}</div>
      </div>

      <div class="home-card">
        <div class="home-title">
          🧺 سلة الطباعة
          <span class="home-hint">${cart.length} صنف — ${totalLabels} ملصق</span>
        </div>
        <div data-keep-scroll="print-cart" style="max-height:38vh; overflow:auto;">${cartHTML}</div>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button class="btn btn-primary" id="print-cart-btn" ${totalLabels ? '' : 'disabled'}>🖨️ اطبع المحدّد (${totalLabels})</button>
          <button class="btn" id="print-clear-btn" ${cart.length ? '' : 'disabled'}>تفريغ السلة</button>
          ${can(state.profile, 'printerSetup') ? `<button class="btn" id="print-settings-btn">⚙️ إعدادات الطابعة</button>` : ''}
          ${isBarcodeScanSupported() ? `<button class="btn" id="print-camera-btn">🎥 اختيار الكاميرا</button>` : ''}
        </div>
      </div>
    </div>`;
}

function addProductToPrintCart(product, qty) {
  state.printCart = state.printCart || [];
  const add = Math.max(1, Math.min(200, Number(qty) || 1));
  const key = product.barcode || product.code || product.name;
  const found = state.printCart.find((it) => it.key === key);
  if (found) {
    found.qty = Math.min(200, (found.qty || 0) + add);
  } else {
    state.printCart.push({ key, product, qty: add });
  }
  // السلة بتتحفظ على الجهاز — لو التطبيق قفل، بترجع زي ما هي.
  saveWorkState();
  return key;
}

// بتوقّف المؤشر في خانة عدد الصنف ده وتحدّد الرقم اللي فيها، فأول رقم
// تكتبه بيستبدله على طول (مش بيتزنق جنبه).
function focusCartQty(key) {
  const idx = (state.printCart || []).findIndex((it) => it.key === key);
  if (idx < 0) return;
  const el = document.querySelector(`[data-cart-qty="${idx}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'nearest' });
  el.focus();
  el.select();
}

// أزرار "أضف" جوه قايمة النتايج. اتفصلت لوحدها عشان تتربط من تاني بعد
// التحديث الموضعي للنتايج — من غير ما نعيد رسم الشاشة كلها.
function attachPrintResultEvents() {
  document.querySelectorAll('[data-add-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const found = searchProducts(state.printSearch, '', 40);
      const p = found[Number(btn.getAttribute('data-add-product'))];
      if (!p) return;
      const key = addProductToPrintCart(p);
      // خانة البحث بتتفضّى، والمؤشر بيروح **لخانة العدد** بتاعة الصنف ده
      // على طول — عشان ترتيب الشغل الطبيعي هو: دوّر، ضيف، اكتب العدد.
      // (كان بيرجع لخانة البحث، فكنت لازم تنزل بإيدك للسلة كل مرة.)
      state.printSearch = '';
      render();
      focusCartQty(key);
    });
  });
}

// بتحدّث قايمة النتايج **في مكانها** من غير ما تلمس خانة البحث ولا السلة.
// أي حاجة تانية في الشاشة بتفضل زي ما هي بالظبط — بما فيها مكان صباعك.
function updatePrintResults() {
  const box = document.getElementById('print-results');
  if (!box) return;
  box.innerHTML = printResultsHTML();
  box.scrollTop = 0;
  attachPrintResultEvents();
}

function attachPrintScreenEvents() {
  const searchEl = document.getElementById('print-search');
  if (searchEl) {
    let timer = null;
    searchEl.addEventListener('input', () => {
      // القيمة بتتسجّل **فورًا** مع كل حرف — من غير أي انتظار. كده لو حصل
      // رسم للشاشة لأي سبب تاني، بيلاقي آخر حاجة كتبتها مش قيمة قديمة.
      state.printSearch = searchEl.value;
      clearTimeout(timer);
      timer = setTimeout(updatePrintResults, 160);
    });
  }

  const scanBtn = document.getElementById('print-scan-btn');
  if (scanBtn) {
    // بعد كل تصويرة، بيظهر كارت **جوه شاشة الكاميرا** فيه اسم الصنف
    // والباركود وخانة العدد. تضغط "تم" فيتحوّل للسلة، والكاميرا تفضل
    // مفتوحة للصنف اللي بعده — فمش محتاج تخرج وتدخل مع كل صنف.
    scanBtn.addEventListener('click', () =>
      safeAsync(
        () =>
          openBarcodeScanner(
            (value, qty) => {
              const product = findProductByBarcode(value);
              if (!product) return;
              addProductToPrintCart(product, qty);
              render();
            },
            true,
            {
              askQty: true,
              lookup: (value) => {
                const p = findProductByBarcode(value);
                if (!p) return null;
                const price = p.price ? ` — ${p.price} ج` : '';
                return { title: p.name, subtitle: `${p.barcode || p.code || value}${price}` };
              },
            }
          ),
        'فتح الكاميرا'
      )
    );
  }

  const cameraBtn = document.getElementById('print-camera-btn');
  if (cameraBtn) cameraBtn.addEventListener('click', () => safeAsync(() => openCameraChooser(), 'اختيار الكاميرا'));

  attachPrintResultEvents();

  const changeQty = (i, next) => {
    const cart = state.printCart || [];
    if (!cart[i]) return;
    cart[i].qty = Math.max(1, Math.min(200, next));
    saveWorkState();
    render();
  };

  document.querySelectorAll('[data-cart-inc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.getAttribute('data-cart-inc'));
      changeQty(i, (state.printCart[i].qty || 1) + 1);
    });
  });
  document.querySelectorAll('[data-cart-dec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.getAttribute('data-cart-dec'));
      changeQty(i, (state.printCart[i].qty || 1) - 1);
    });
  });
  document.querySelectorAll('[data-cart-qty]').forEach((input) => {
    input.addEventListener('change', () => {
      const i = Number(input.getAttribute('data-cart-qty'));
      changeQty(i, parseInt(input.value, 10) || 1);
    });
  });
  document.querySelectorAll('[data-cart-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.getAttribute('data-cart-del'));
      (state.printCart || []).splice(i, 1);
      saveWorkState();
      render();
    });
  });

  const clearBtn = document.getElementById('print-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.printCart = [];
      saveWorkState();
      render();
    });
  }

  const settingsBtn = document.getElementById('print-settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => safeAsync(() => openPrinterSettings(), 'فتح إعدادات الطابعة'));

  const printBtn = document.getElementById('print-cart-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      // العدد لكل صنف متحدّد في السلة، فخانة "عدد اللاصقات" العامة
      // مالهاش لازمة هنا (نفس منطق ملصقات الدرجات).
      promptLabelSize((sizeOptions) => safeAsync(() => printCartLabels(sizeOptions), 'طباعة السلة'), true);
    });
  }
}

async function printCartLabels(sizeOptions) {
  const cart = (state.printCart || []).filter((it) => it.qty > 0);
  if (!cart.length) return;

  const qrPx = Math.round((sizeOptions.pageHeightMm / (sizeOptions.halves || 1)) * 16);

  // كل صنف بيتحوّل لوظيفة طباعة مستقلة بعدد نسخه. الـQR بيتولّد هنا
  // كصورة جاهزة قبل ما نبعت لأي طابعة — نفس سبب ملصق الصنف العادي.
  const jobs = [];
  for (const item of cart) {
    const source = productAsLabelSource(item.product);
    const qr = await generateQRDataURL(source.barcodeNumber || source.name, qrPx);
    jobs.push({
      html: buildLabelHTML(source, sizeOptions, qr, 1),
      copies: item.qty,
    });
  }

  const total = cart.reduce((s, it) => s + it.qty, 0);
  const approved = await showPrintPreview(jobs, sizeOptions, total);
  if (!approved) return;

  // نسخة واحدة بفواصل صفحات لنافذة طباعة المتصفح (بتتعامل مع مستند واحد).
  // هنا لازم نكرّر كل ملصق بعدد نسخه بنفسنا، لأن المستند الواحد مافيهوش
  // مفهوم "عدد نسخ" زي طلب الطباعة في QZ.
  const bodies = [];
  jobs.forEach((j) => {
    const body = extractLabelBody(j.html);
    for (let i = 0; i < j.copies; i++) bodies.push(body);
  });
  const browserHTML = jobs[0].html.replace(/<body>[\s\S]*<\/body>/, `<body>${bodies.join('')}</body>`);

  const delivered = await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', browserHTML);

  // السلة بتتفضّى **بس** لو الطباعة اتبعتت فعلًا. لو المستخدم ألغى اختيار
  // الجهاز، أو فشل التجهيز، السلة بتفضل زي ما هي — عشان مايخسرش 20 صنف
  // عدّهم بإيده على ضغطة غلط.
  if (delivered) {
    state.printCart = [];
    state.printSearch = '';
    saveWorkState();
    render();
  }
}
