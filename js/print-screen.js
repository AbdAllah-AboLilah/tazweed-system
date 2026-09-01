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

  // ------------------------------------------------------------
  // ⭐ شكل الملصق بيتحدّد **لكل صنف في السلة على حدة**
  // ------------------------------------------------------------
  // مش إعداد واحد للطبعة كلها: في نفس الطبعة ممكن يكون فيه صنف عايزه
  // بالملصق الكامل وصنف تاني عايزه مقسوم أربعة.
  //
  // القاعدة: "عادي" و"مقسوم (٤)" **الاتنين مايتختاروش مع بعض** — الملصق
  // له شكل واحد. و"بدون السعر" مستقلة، بتتحط على أي واحد فيهم.
  //
  // ملصق المسمّى (النص الحر) مالوش مفاتيح خالص — مافيهوش سعر ولا باركود
  // أصلًا فمفيش حاجة تتقسم أو تتشال.
  const modeRow = (it, i) =>
    it.custom
      ? ''
      : `
      <div class="cart-modes">
        <label><input type="checkbox" data-cart-mode="${i}" value="normal" ${
          it.mode !== 'quarter' ? 'checked' : ''
        } /> عادي</label>
        <label><input type="checkbox" data-cart-mode="${i}" value="quarter" ${
          it.mode === 'quarter' ? 'checked' : ''
        } /> مقسوم (٤)</label>
        <label><input type="checkbox" data-cart-noprice="${i}" ${it.noPrice ? 'checked' : ''} /> بدون السعر</label>
      </div>`;

  const cartHTML = !cart.length
    ? `<div class="home-empty">السلة فاضية. ضيف أصناف من فوق.</div>`
    : cart
        .map(
          (it, i) => `
      <div class="cart-item">
        <div class="home-row" style="border:0; padding-bottom:4px;">
          <div style="flex:1; min-width:0;">
            <div class="home-row-title">${escapeHTML(it.custom ? customText(it.custom) : it.product.name)}</div>
            <div class="home-row-sub">${
              it.custom ? '✍️ مسمّى' : escapeHTML(it.product.barcode || it.product.code || '—')
            }</div>
          </div>
          <div class="qty-cell">
            <button class="qty-btn" data-cart-dec="${i}">−</button>
            <input class="qty-input" type="number" min="1" max="1000" value="${escapeHTML(it.qty)}"
                   data-cart-qty="${i}" inputmode="numeric" />
            <button class="qty-btn" data-cart-inc="${i}">+</button>
          </div>
          <button class="btn" style="padding:4px 10px; font-size:12px; color:var(--danger-text);" data-cart-del="${i}">حذف</button>
        </div>
        ${modeRow(it, i)}
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
        <!-- ============================================================
             ⭐ زرار واحد بطل، والباقي أخف
             ============================================================
             كانوا ٦ زراير بنفس الحجم واللون ورا بعض: اطبع · فرّغ ·
             أضف مسمّى · إعدادات · الكاميرا · حدّث الأصناف. عينك مش
             عارفة تبدأ منين، مع إن واحد بس منهم هو اللي بتيجي عشانه.
             ⚠️ **ولا زرار اتشال** — الإعدادات وتحديث الأصناف اتلمّوا
             تحت ⚙️، وهو زرار بيفتح/يقفل صف الإعدادات تحته. -->
        <button class="btn btn-primary print-go" id="print-cart-btn" ${totalLabels ? '' : 'disabled'}>🖨️ اطبع المحدّد (${totalLabels})</button>
        <div class="print-second-row">
          <button class="btn" id="print-screen-custom-btn">✍️ أضف مسمّى</button>
          ${isBarcodeScanSupported() ? `<button class="btn" id="print-camera-btn">🎥 الكاميرا</button>` : ''}
          <button class="btn" id="print-clear-btn" ${cart.length ? '' : 'disabled'}>تفريغ السلة</button>
          ${
            can(state.profile, 'printerSetup') || canManageProducts(state.profile)
              ? `<button class="btn print-gear" id="print-tools-btn" title="إعدادات" aria-label="إعدادات">⚙️</button>`
              : ''
          }
        </div>
        <div class="print-tools" id="print-tools-row" hidden>
          ${can(state.profile, 'printerSetup') ? `<button class="btn" id="print-settings-btn">⚙️ إعدادات الطابعة</button>` : ''}
          ${/* ⭐ تحديث ملف الأصناف من شاشة الطباعة نفسها.

                ⚠️ المفتاح `importProducts` كان موجود في الإعدادات وبتفتحه
                للحساب ده **ومايحصلش حاجة**. السبب: زرار الاستيراد كان في
                شاشة "الأصناف" بس، وحساب موظف الطباعة **مقفول على شاشة
                واحدة** (dashboardHTML بترجع بدري ومعاها شاشة الطباعة بس،
                من غير شريط تنقّل أصلًا). فمكانش فيه أي طريقة يوصلها.

                الحل إن الزرار ييجي **له**، مش إنه يروح للشاشة — عشان
                الحساب ده مقصود إنه مايشوفش المخزن. */ ''}
          ${canManageProducts(state.profile) ? `<button class="btn" id="print-products-import-btn">📥 حدّث ملف الأصناف</button>` : ''}
        </div>
        ${
          // سطر صغير تحت الأزرار — بيقول آخر مرة الملف اتحدّث فيها.
          // ⚠️ مكانه هنا عن قصد: تحت أزرار الأدوات، مش جنب زرار الطباعة —
          // عشان مايزاحمش الفعل الأساسي في الشاشة.
          typeof productsUpdatedText === 'function' && productsUpdatedText()
            ? `<div class="prod-updated">📅 آخر تحديث لملف الأصناف: ${escapeHTML(productsUpdatedText())}</div>`
            : ''
        }
      </div>
    </div>`;
}

// بتضيف ملصق نص حر للسلة. مفتاحه فريد كل مرة عشان تقدر تضيف أكتر من
// مسمّى مختلف في نفس الطبعة من غير ما يندمجوا.
// بتنضّف السلة المحفوظة قبل ما تدخل الشاشة.
//
// ليه موجودة؟ نسخة اتشحنت كانت بتحفظ ملصق المسمّى **من غير** بياناته
// (شوف التعليق في local-store.js). العناصر المكسورة دي موجودة خلاص على
// أجهزة الناس، والشاشة كانت بتقع عليها بدل ما تفتح.
//
// القاعدة: العنصر لازم يكون يا صنف (product) يا مسمّى (custom). أي حاجة
// تانية بتتشال في صمت — أحسن من إن الشاشة كلها تبوظ.
function sanitizePrintCart(list) {
  // ⚠️ بنقبل الشكلين: الجديد (text) والقديم (line1) — السلات المحفوظة
  // على أجهزة الناس بالشكل القديم مالهاش ذنب.
  return (Array.isArray(list) ? list : []).filter(
    (it) => it && (it.product || (it.custom && (it.custom.text || it.custom.line1)))
  );
}

// ============================================================
// ⚠️ نص المسمّى — بيقرا الشكل الجديد **والقديم**
// ============================================================
// من v0.42.0 المسمّى بقى نص واحد (`text`). قبلها كان سطرين
// (`line1`/`line2`)، وفيه سلات محفوظة على أجهزة الناس بالشكل القديم —
// لو قرأناها غلط، الملصق هيطلع فاضي من غير أي رسالة خطأ.
function customText(c) {
  if (!c) return '';
  if (c.text) return String(c.text);
  return [c.line1, c.line2].map((x) => String(x || '').trim()).filter(Boolean).join(' — ');
}

function addCustomLabelToCart(text, qty) {
  state.printCart = state.printCart || [];
  state.printCart.push({
    key: 'custom:' + Date.now() + ':' + Math.random().toString(36).slice(2, 7),
    custom: { text: String(text || '').trim() },
    qty: Math.max(1, Math.min(MAX_LABEL_COPIES, Number(qty) || 1)),
  });
  saveWorkState();
  render();
}

function addProductToPrintCart(product, qty, shape) {
  state.printCart = state.printCart || [];
  const add = Math.max(1, Math.min(MAX_LABEL_COPIES, Number(qty) || 1));
  const mode = shape && shape.mode === 'quarter' ? 'quarter' : 'normal';
  const noPrice = !!(shape && shape.noPrice);
  // ⚠️ الدمج بقى على **الباركود + شكل الملصق**: نفس الصنف بشكلين مختلفين
  // لازم يفضل سطرين، وإلا الشكل الجديد هيمسح القديم في صمت.
  const key = (product.barcode || product.code || product.name) + '|' + mode + (noPrice ? '|np' : '');
  const found = state.printCart.find((it) => it.key === key);
  if (found) {
    found.qty = Math.min(MAX_LABEL_COPIES, (found.qty || 0) + add);
  } else {
    state.printCart.push({ key, product, qty: add, mode, noPrice });
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
            (value, qty, shape) => {
              const product = findProductByBarcode(value);
              if (!product) return;
              addProductToPrintCart(product, qty, shape);
              render();
            },
            true,
            {
              askQty: true,
              askShape: true,
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

  // ⭐ بعد الاستيراد بنرسم الشاشة من جديد عشان نتايج البحث تتحدّث فورًا
  // بالأصناف الجديدة — من غير ده المستخدم بيستورد ومايشوفش أي فرق.
  const importBtn = document.getElementById('print-products-import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () =>
      safeAsync(() => openProductsImportDialog(() => render()), 'استيراد ملف الأصناف')
    );
  }

  attachPrintResultEvents();

  const changeQty = (i, next) => {
    const cart = state.printCart || [];
    if (!cart[i]) return;
    cart[i].qty = Math.max(1, Math.min(MAX_LABEL_COPIES, next));
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

  // ---- مفاتيح شكل الملصق لكل صنف ----
  // "عادي" و"مقسوم" بيتصرّفوا كاختيار واحد: الضغط على واحد بيلغي التاني،
  // والضغط على المتعلّم أصلًا مابيعملش حاجة (لازم يفضل شكل مختار).
  document.querySelectorAll('[data-cart-mode]').forEach((box) => {
    box.addEventListener('change', () => {
      const i = Number(box.getAttribute('data-cart-mode'));
      const it = (state.printCart || [])[i];
      if (!it) return;
      it.mode = box.value === 'quarter' ? 'quarter' : 'normal';
      saveWorkState();
      render();
    });
  });
  document.querySelectorAll('[data-cart-noprice]').forEach((box) => {
    box.addEventListener('change', () => {
      const i = Number(box.getAttribute('data-cart-noprice'));
      const it = (state.printCart || [])[i];
      if (!it) return;
      it.noPrice = box.checked;
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

  // ⚙️ بيفتح/يقفل صف الإعدادات. مافيش نافذة ولا شاشة جديدة — الزراير
  // اللي كانت ظاهرة على طول بقت مخبّية لحد ما تطلبها.
  const toolsBtn = document.getElementById('print-tools-btn');
  const toolsRow = document.getElementById('print-tools-row');
  if (toolsBtn && toolsRow) {
    toolsBtn.addEventListener('click', () => {
      toolsRow.hidden = !toolsRow.hidden;
      toolsBtn.classList.toggle('on', !toolsRow.hidden);
    });
  }

  // ملصق النص الحر متاح من هنا كمان، مش من جوه الفئة بس. الموظف الواقف
  // عند الطابعة هو أكتر واحد بيحتاجه، وحسابه مابيشوفش شاشة الفئات أصلًا.
  // ملصق المسمّى بقى **بيتضاف للسلة** بدل ما يتطبع لوحده — عشان تطبع
  // مسمّى مع أصناف في نفس الطبعة من غير ما تعمل طبعتين.
  const customBtn = document.getElementById('print-screen-custom-btn');
  if (customBtn) customBtn.addEventListener('click', () => openCustomLabelDialog({ toCart: true }));

  const printBtn = document.getElementById('print-cart-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      // العدد لكل صنف متحدّد في السلة، فخانة "عدد اللاصقات" العامة
      // مالهاش لازمة هنا (نفس منطق ملصقات الدرجات).
      // ومفتاح "من غير سعر" مابقاش هنا: بقى **لكل صنف** جوه السلة، لأن
      // الطبعة الواحدة ممكن تجمع أصناف بأشكال مختلفة.
      promptLabelSize((sizeOptions) => safeAsync(() => printCartLabels(sizeOptions), 'طباعة السلة'), {
        hideCopies: true,
      });
    });
  }
}

// بتبني ملصق صنف واحد من السلة حسب الشكل المختار له.
// بترجّع { html, image } — والصورة بتتستخدم في المعاينة وفي وظيفة الطباعة.
async function buildCartItemLabel(item, sizeOptions) {
  if (item.custom) {
    // ⚠️ لازم تعدّي من buildTextLabel زي باقي الشاشات. النسخة القديمة كانت
    // بترسم صورة **على طول** من غير ما تبصّ على مفتاح "ابعت الملصق كنص" —
    // فنفس المسمّى كان يطلع نضيف من شاشة الفئات ومنغمش من هنا.
    const b = buildTextLabel(customText(item.custom), sizeOptions, 1);
    return { html: b.jobHTML, image: b.image };
  }

  const source = productAsLabelSource(item.product);
  const opts = { ...sizeOptions, noPrice: !!item.noPrice };

  if (item.mode === 'quarter') {
    // ⭐ بيعدّي من buildQuarterLabel اللي بيحترم مفتاح "ابعت كنص" زي باقي
    // الملصقات — قبل كده كان **صورة دايمًا**، وده اللي كان بيخلّيه الوحيد
    // اللي بيطلع منغمش على الورق.
    const q = await buildQuarterLabel(source, opts, 1);
    if (q) return { html: q.jobHTML, image: q.image };
  }

  const built = await buildItemLabel(source, opts, item.qty);
  return { html: built.jobHTML, image: built.image };
}

async function printCartLabels(sizeOptions) {
  const cart = (state.printCart || []).filter((it) => it.qty > 0);
  if (!cart.length) return;

  // ⚠️ تحذير الأصناف اللي ملهاش رقم باركود — ملصقها بيطلع من غير كود.
  // (الشرح المطوّل في renderLabelPNG جوه js/print-label.js)
  // الملصق النصّي (مسمّى) مالوش كود أصلًا، فمش داخل في الحسبة.
  if (typeof confirmMissingBarcode === 'function') {
    const sources = cart
      .filter((it) => !it.custom && it.mode !== 'quarter')
      .map((it) => productAsLabelSource(it.product));
    if (!confirmMissingBarcode(sources)) return;
  }

  // كل صنف بيتحوّل لوظيفة طباعة مستقلة بعدد نسخه. الملصق بيترسم عندنا
  // كصورة جاهزة (buildItemLabel) قبل ما يتبعت لأي طابعة — فشكله مضمون
  // مايتغيّرش على أي جهاز.
  const jobs = [];
  for (const item of cart) {
    jobs.push({ ...(await buildCartItemLabel(item, sizeOptions)), copies: item.qty });
  }

  const total = cart.reduce((s, it) => s + it.qty, 0);
  // المعاينة بتعرض الصورة بمقاسها الحقيقي بالبكسل — الشرح في
  // wrapImageLabelPreviewHTML جوه js/app.js
  const firstPreview = jobs[0] && jobs[0].image
    ? [{ html: wrapImageLabelPreviewHTML(jobs[0].image, labelDots(sizeOptions).w, labelDots(sizeOptions).h), copies: total }]
    : jobs;
  const approved = await showPrintPreview(
    firstPreview,
    { ...sizeOptions, previewPx: jobs[0] && jobs[0].image ? labelDots(sizeOptions) : null },
    total
  );
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

  // ⭐ وصفة لكل صنف في السلة — الجهاز اللي هيطبع بيعيد بناءهم بخطوطه هو
  const spec = {
    kind: 'many',
    items: cart.map((it) =>
      it.custom
        ? { kind: 'text', text: customText(it.custom), copies: it.qty }
        : {
            kind: it.mode === 'quarter' ? 'quarter' : 'item',
            cat: { ...productAsLabelSource(it.product), __noPrice: !!it.noPrice },
            copies: it.qty,
          }
    ),
  };
  const delivered = await deliverPrint('label', jobs, sizeOptions, 'width=420,height=320', browserHTML, spec);

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
