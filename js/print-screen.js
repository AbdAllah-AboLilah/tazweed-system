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

// ============================================================
// 🖨️ تاب الأجهزة — التحكم في الطابعات من أي جهاز
// ============================================================
// ليه جوه شاشة الطباعة مش شاشة لوحدها؟ لأن ده بالظبط المكان اللي
// المشكلة بتبان فيه: بتيجي تطبع، الطبعة تطلع غلط، فتعدّل وتجرّب تاني.
// شاشة منفصلة معناها إنك تخرج من اللي بتعمله وترجع.
//
// ⚠️ والتابات **مابتظهرش أصلًا** إلا لصاحب صلاحية إعدادات الطابعة. أي
// حساب تاني (موظف الطباعة مثلًا) بيشوف الشاشة زي ما هي بالظبط من غير أي
// فرق — ولا حتى شريط تابات فاضي.
function canControlPrinters(profile) {
  return can(profile || state.profile, 'remoteControl');
}

function getPrintTab() {
  return state.printTab === 'devices' && canControlPrinters() ? 'devices' : 'work';
}

// "آخر ظهور" بكلام بني آدم — الجهاز المقفول لازم يبان **إنه مقفول**
// وقافل من امتى، عشان اللي بيغيّر إعداد يعرف هيستنى قد إيه.
function stationSeenText(station) {
  const ms = station && station.lastSeen && station.lastSeen.toMillis ? station.lastSeen.toMillis() : 0;
  if (!ms) return 'مش معروف';
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 2) return 'دلوقتي';
  if (mins < 60) return `من ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `من ${hrs} ساعة`;
  return `من ${Math.floor(hrs / 24)} يوم`;
}

// الاستثناءات الحقيقية بتاعة جهاز — الحقول اللي في القايمة الحصرية بس.
// ⚠️ مستند الاستثناء فيه كمان updatedAt وupdatedByName، ودول **مش**
// إعدادات — لو عددناهم، الجهاز يبان إن عنده استثناءين وهو مالوش ولا واحد.
function deviceOverrideKeys(deviceId) {
  const d = (state.deviceSettings || {})[deviceId];
  if (!d) return [];
  return PRINT_FIELD_KEYS.filter((k) => d[k] !== undefined && d[k] !== null);
}

function stationCardHTML(st) {
  const online = isStationOnline(st);
  const setup = st.printSetup || {};
  const printers = Array.isArray(st.printers) ? st.printers : [];
  const own = deviceOverrideKeys(st.id);

  return `
    <div class="dev-card ${online ? '' : 'off'}">
      <div class="dev-head">
        <span class="dev-dot ${online ? 'on' : ''}"></span>
        <span class="dev-name">${escapeHTML(st.deviceName || 'جهاز بدون اسم')}</span>
        <span class="dev-seen">${online ? 'شغّال' : `مقفول — آخر ظهور ${escapeHTML(stationSeenText(st))}`}</span>
      </div>

      <div class="dev-lines">
        <div><span>طابعة الملصق</span><b>${escapeHTML(st.labelPrinter || '—')}</b></div>
        <div><span>طابعة ورقة التزويد</span><b>${escapeHTML(st.restockPrinter || '—')}</b></div>
        <div><span>الدفعة / التقديم / الإيقاع</span><b>${escapeHTML(setup.batch ?? '—')} · ${escapeHTML(setup.lead ?? '—')} · ${escapeHTML(setup.pace ?? '—')}مث</b></div>
        <div><span>طابعات متعرّفة عليه</span><b>${escapeHTML(printers.length || 0)}</b></div>
        <div><span>نسخة النظام</span><b>${escapeHTML(st.appVersion || '—')}</b></div>
      </div>

      ${
        own.length
          ? `<div class="dev-wait">
               ⚠️ <strong>${escapeHTML(own.length)}</strong> إعداد خاص بالجهاز ده (${escapeHTML(own.map(printFieldLabel).join('، '))}) — مش ماشي مع العام.
               <button class="btn dev-mini" data-dev-reset="${escapeHTML(st.id)}">رجّعه للعام</button>
             </div>`
          : ''
      }

      <div class="dev-btns">
        <button class="btn" data-dev-edit="${escapeHTML(st.id)}">⚙️ عدّل إعداداته</button>
        <button class="btn" data-dev-frame="${escapeHTML(st.id)}" ${online ? '' : 'disabled'}>🖨️ اطبع الإطار</button>
        <button class="btn" data-dev-fonts="${escapeHTML(st.id)}" ${online ? '' : 'disabled'}>🧪 عيّنة الخطوط</button>
      </div>
    </div>`;
}

function printDevicesHTML() {
  const stations = (state.printStations || []).slice().sort((a, b) => {
    const ao = isStationOnline(a) ? 0 : 1;
    const bo = isStationOnline(b) ? 0 : 1;
    return ao - bo || String(a.deviceName || '').localeCompare(String(b.deviceName || ''), 'ar');
  });
  const online = stations.filter(isStationOnline).length;
  const withOwn = stations.filter((s) => deviceOverrideKeys(s.id).length).length;

  return `
    <div class="home-wrap">
      <div class="home-card">
        <div class="home-title">
          ⚙️ ظبط الإعدادات
          <span class="home-hint">${stations.length} جهاز — ${online} شغّال</span>
        </div>
        <div class="dev-note">
          افتح النافذة، اختار <strong>على مين</strong>، واملا الخانة اللي عايز
          تغيّرها بس. أي خانة تسيبها فاضية <strong>مابتتلمسش</strong>.
          <br>الجهاز المقفول بياخد التعديل أول ما يفتح.
        </div>
        <button class="btn btn-primary print-go" id="dev-open-settings">⚙️ افتح الإعدادات</button>
        ${
          withOwn
            ? `<div class="dev-note" style="margin-top:8px;">
                 ⚠️ فيه <strong>${escapeHTML(withOwn)}</strong> جهاز عنده إعدادات خاصة.
                 لو حفظت على <strong>كل الأجهزة</strong>، هتتمسح وياخدوا العام —
                 والنافذة هتقولك مين قبل ما تحفظ.
               </div>`
            : ''
        }
      </div>

      <div class="home-card">
        <div class="home-title">🖨️ الأجهزة</div>
        <div class="dev-note">
          ⚠️ زراير التجربة محتاجة الجهاز يكون <strong>شغّال دلوقتي</strong> —
          الورقة بتخرج من ماكينة حقيقية، ودي مش حاجة تتأجّل.
        </div>
        ${
          stations.length
            ? stations.map((st) => stationCardHTML(st)).join('')
            : `<div class="home-empty">مفيش أجهزة مسجّلة. أي كمبيوتر عليه QZ Tray وطابعة محفوظة بيسجّل نفسه لوحده.</div>`
        }
      </div>
    </div>`;
}

function printScreenHTML() {
  // ⚠️ من غير صلاحية = الشاشة زي ما هي بالظبط. مفيش شريط تابات ولا أي
  // فرق في الشكل — عشان حساب الطباعة مايتلخبطش بحاجة مش بتاعته.
  if (!canControlPrinters()) return printWorkHTML();

  const tab = getPrintTab();
  const tabs = `
    <div class="print-tabs" role="tablist">
      ${PRINT_TABS.map(
        (t) => `
        <button type="button" class="print-tab ${tab === t.key ? 'on' : ''}" role="tab"
                aria-selected="${tab === t.key}" data-print-tab="${t.key}">
          ${t.icon} ${escapeHTML(t.label)}
        </button>`
      ).join('')}
    </div>`;

  return tabs + (tab === 'devices' ? printDevicesHTML() : printWorkHTML());
}

const PRINT_TABS = [
  { key: 'work', icon: '🖨️', label: 'الطباعة' },
  { key: 'devices', icon: '⚙️', label: 'الأجهزة' },
];

function printWorkHTML() {
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

// ============================================================
// أحداث تاب الأجهزة
// ============================================================
function attachPrintDeviceEvents() {
  document.querySelectorAll('[data-print-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.printTab = btn.getAttribute('data-print-tab');
      render();
    });
  });

  document.querySelectorAll('[data-dev-edit]').forEach((btn) => {
    // بيفتح نفس النافذة بس بالجهاز ده مختار سلفًا
    btn.addEventListener('click', () => openPrintSettingsDialog(btn.getAttribute('data-dev-edit')));
  });

  const openAll = document.getElementById('dev-open-settings');
  if (openAll) openAll.addEventListener('click', () => openPrintSettingsDialog('all'));

  document.querySelectorAll('[data-dev-reset]').forEach((btn) => {
    btn.addEventListener('click', () =>
      safeAsync(async () => {
        const id = btn.getAttribute('data-dev-reset');
        const st = (state.printStations || []).find((s) => s.id === id);
        const keys = deviceOverrideKeys(id).map(printFieldLabel).join('، ');
        if (!confirm(`هيتشال الإعداد الخاص بـ"${(st && st.deviceName) || 'الجهاز'}" (${keys})\nوهيرجع ياخد الإعداد العام. تمام؟`)) return;
        await clearDeviceOverrides(id);
      }, 'رجّع الجهاز للعام')
    );
  });

  document.querySelectorAll('[data-dev-frame]').forEach((btn) => {
    btn.addEventListener('click', () =>
      safeAsync(() => sendRemoteTestPrint(btn.getAttribute('data-dev-frame'), 'frame'), 'طباعة الإطار')
    );
  });

  document.querySelectorAll('[data-dev-fonts]').forEach((btn) => {
    btn.addEventListener('click', () =>
      safeAsync(() => sendRemoteTestPrint(btn.getAttribute('data-dev-fonts'), 'fonts'), 'عيّنة الخطوط')
    );
  });

}

// ============================================================
// ⭐ طباعة تجربة على جهاز تاني
// ============================================================
// ⚠️ التجربة دي **مالهاش معنى** غير على الورق اللي في الماكينة. فمفيش
// معاينة ولا "احفظ وجرّب بعدين": بتتبعت للجهاز على طول، والورقة بتخرج.
//
// وعشان كده الزرار **مقفول لو الجهاز مقفول** — أمر مؤجّل هنا معناه ورقة
// بتخرج بكرة الصبح ومحدش فاهم منين جت.
async function sendRemoteTestPrint(deviceId, kind) {
  const st = (state.printStations || []).find((s) => s.id === deviceId);
  if (!st) return;
  if (!isStationOnline(st)) {
    alert('الجهاز ده مقفول دلوقتي. زراير التجربة محتاجة الجهاز يكون شغّال.');
    return;
  }

  // المقاس بيتاخد من الضبط المشترك — نفس اللي الجهاز التاني بيطبع بيه.
  const w = LABEL_SIZE.pageWidthMm;
  const h = LABEL_SIZE.pageHeightMm;
  const sizeOptions = { pageWidthMm: w, pageHeightMm: h, halves: 1 };

  if (kind === 'fonts') {
    // ⚠️ عيّنة الخطوط **مش HTML** — دي أوامر بلغة الطابعة نفسها. فبتتبعت
    // كأمر خام، والجهاز التاني بينفّذها بطابعته المحفوظة.
    await sendPrintJob('label', deviceId, [{ html: '', copies: 1 }], sizeOptions, '', null, {
      kind: 'fontSample', w, h,
    });
    return;
  }

  const html = buildFrameHTML(w, h);
  await sendPrintJob('label', deviceId, [{ html, copies: 1 }], sizeOptions, html, null);
}

// ============================================================
// ⚙️ نافذة الإعدادات — "على مين؟" فوق، والباقي تحته
// ============================================================
// ⭐ الفكرة كلها في سطر: **الخانة الفاضية مابتتلمسش**. فتقدر تغيّر حاجة
// واحدة صغيرة على جهاز واحد، أو تغيّر كل حاجة على كل الأجهزة — نفس
// النافذة ونفس الخطوات.
//
// ⚠️ وقاعدة "الكل يكسب": الحفظ على كل الأجهزة **بيمسح** استثناءات نفس
// الحقول من كل جهاز. من غيرها، الجهاز اللي أخد استثناء مرة كان هيفضل
// واقف عليه للأبد وانت مش فاهم ليه التغيير مش واصل — عطل صامت. والنافذة
// بتقولك أسماء الأجهزة **قبل** ما تمسح.
function openPrintSettingsDialog(preselectDeviceId) {
  const stations = state.printStations || [];
  const target = preselectDeviceId || 'all';

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2200;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:440px; width:100%; max-height:92vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:10px;">⚙️ إعدادات الطباعة</div>

      <div class="field" style="background:var(--surface-muted); padding:9px; border-radius:8px;">
        <label style="font-weight:500;">على مين؟</label>
        <select class="input" id="ps-target">
          <option value="all"${target === 'all' ? ' selected' : ''}>🖨️ كل الأجهزة</option>
          ${stations
            .map(
              (st) =>
                `<option value="${escapeHTML(st.id)}"${target === st.id ? ' selected' : ''}>${escapeHTML(st.deviceName || 'جهاز')}${
                  isStationOnline(st) ? '' : ' (مقفول)'
                }</option>`
            )
            .join('')}
        </select>
        <div id="ps-scope-note" style="font-size:11px; color:var(--text-secondary); margin-top:6px; line-height:1.7;"></div>
      </div>

      <div style="font-size:11px; color:var(--text-muted); line-height:1.7; margin:4px 0 10px;">
        الرقم الباهت جوه كل خانة هو <strong>اللي شغّال دلوقتي</strong>.
        سيب الخانة <strong>فاضية</strong> عشان ما تتغيّرش.
      </div>

      <div style="font-size:12px; font-weight:500; margin-bottom:5px;">📦 الدفعات</div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
        <div class="field" style="width:105px; margin-bottom:0;">
          <label style="font-size:11px;">الدفعة</label>
          <input class="input" type="number" id="ps-batch" min="1" max="200" inputmode="numeric" style="padding:6px;" />
        </div>
        <div class="field" style="width:105px; margin-bottom:0;">
          <label style="font-size:11px;">التقديم</label>
          <input class="input" type="number" id="ps-lead" min="0" max="50" inputmode="numeric" style="padding:6px;" />
        </div>
        <div class="field" style="width:105px; margin-bottom:0;">
          <label style="font-size:11px;">الإيقاع (مث)</label>
          <input class="input" type="number" id="ps-pace" min="0" max="3000" inputmode="numeric" style="padding:6px;" />
        </div>
      </div>

      <div style="font-size:12px; font-weight:500; margin-bottom:5px;">🎯 المعايرة</div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
        <div class="field" style="width:105px; margin-bottom:0;">
          <label style="font-size:11px;">يمين/شمال</label>
          <input class="input" type="number" id="ps-x" step="0.2" inputmode="decimal" style="padding:6px;" />
        </div>
        <div class="field" style="width:105px; margin-bottom:0;">
          <label style="font-size:11px;">فوق/تحت</label>
          <input class="input" type="number" id="ps-y" step="0.2" inputmode="decimal" style="padding:6px;" />
        </div>
        <div class="field" style="width:105px; margin-bottom:0;">
          <label style="font-size:11px;">تصغير %</label>
          <input class="input" type="number" id="ps-shrink" step="1" min="0" inputmode="numeric" style="padding:6px;" />
        </div>
      </div>

      <div id="ps-printers"></div>

      <div style="font-size:12px; font-weight:500; margin:10px 0 5px;">🧪 المفاتيح المتقدمة</div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">سيبها "زي ما هي" عشان ما تتغيّرش.</div>
      ${PRINT_TWEAKS.map(
        (t) => `
        <div style="display:flex; gap:8px; align-items:center; padding:5px 0; border-bottom:1px solid var(--border);">
          <span style="flex:1; min-width:0; font-size:12px;">${escapeHTML(t.label)}</span>
          <select class="input" style="width:110px; padding:4px 6px; font-size:12px;" data-ps-tweak="${escapeHTML(t.key)}">
            <option value="">زي ما هي</option>
            <option value="1">مفتوح</option>
            <option value="0">مقفول</option>
          </select>
        </div>`
      ).join('')}

      <div id="ps-warn" style="font-size:11.5px; line-height:1.7; margin:10px 0; display:none;"></div>
      <div id="ps-status" style="font-size:12px; min-height:16px; margin-bottom:8px;"></div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" id="ps-save" style="flex:1;">احفظ</button>
        <button class="btn" id="ps-close">إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => { if (overlay.parentNode) document.body.removeChild(overlay); };
  overlay.querySelector('#ps-close').addEventListener('click', close);

  const targetEl = overlay.querySelector('#ps-target');
  const noteEl = overlay.querySelector('#ps-scope-note');
  const printersEl = overlay.querySelector('#ps-printers');
  const warnEl = overlay.querySelector('#ps-warn');

  // ============================================================
  // ⭐ القيمة الشغّالة دلوقتي — بتتكتب جوه الخانة كـplaceholder
  // ============================================================
  // ⚠️ العطل اللي بيصلحه: الخانات كانت **فاضية** وبس. فانت تفتح النافذة
  // على جهاز ومتعرفش هو واقف على كام أصلًا — تضطر تقفل وتبص على كارت
  // الجهاز وترجع تفتح.
  //
  // ⚠️ وليه placeholder مش قيمة حقيقية في الخانة؟ لأن القيمة الحقيقية
  // معناها إن كل خانة "اتكتبت"، فأي حفظ هيبعت **كل** الإعدادات — وقاعدة
  // "الفاضي مايتلمسش" تروح، ومعاها القدرة إنك تغيّر حاجة واحدة بس.
  const currentFor = (t) => {
    if (t === 'all') {
      const sh = getSharedPrintSettings() || {};
      const a = sh.align || {};
      return {
        batch: sh.batch !== undefined && sh.batch !== null ? sh.batch : PRINT_BATCH_DEFAULT,
        lead: sh.lead !== undefined && sh.lead !== null ? sh.lead : PRINT_LEAD_DEFAULT,
        pace: sh.pace !== undefined && sh.pace !== null ? sh.pace : PRINT_PACE_MS_PER_LABEL,
        x: a.x || 0, y: a.y || 0, shrink: a.shrink || 0,
        tweaks: sh.tweaks || {},
      };
    }
    // ⭐ الجهاز بينشر إعداداته **النافذة فعلًا** مع كل نبضة — فدي الحقيقة
    // اللي على الماكينة، مش تخميننا.
    const st = stations.find((x) => x.id === t) || {};
    const ps = st.printSetup || {};
    const a = ps.align || {};
    return {
      batch: ps.batch ?? PRINT_BATCH_DEFAULT,
      lead: ps.lead ?? PRINT_LEAD_DEFAULT,
      pace: ps.pace ?? PRINT_PACE_MS_PER_LABEL,
      x: a.x || 0, y: a.y || 0, shrink: a.shrink || 0,
      tweaks: ps.tweaks || {},
    };
  };

  // بيجمع اللي اتكتب — الفاضي بيتشال في cleanPrintFields.
  const collect = () => {
    const num = (id, dec) => {
      const el = overlay.querySelector('#' + id);
      if (!el || el.value === '') return undefined;
      const n = dec ? Number(el.value) : parseInt(el.value, 10);
      return Number.isFinite(n) ? n : undefined;
    };
    const align = {};
    const x = num('ps-x', true); if (x !== undefined) align.x = x;
    const y = num('ps-y', true); if (y !== undefined) align.y = y;
    const sh = num('ps-shrink'); if (sh !== undefined) align.shrink = sh;

    const tweaks = {};
    overlay.querySelectorAll('[data-ps-tweak]').forEach((sel) => {
      if (sel.value === '1') tweaks[sel.getAttribute('data-ps-tweak')] = true;
      else if (sel.value === '0') tweaks[sel.getAttribute('data-ps-tweak')] = false;
    });

    const pick = (id) => {
      const el = overlay.querySelector('#' + id);
      return el && el.value ? el.value : undefined;
    };

    return {
      batch: num('ps-batch'),
      lead: num('ps-lead'),
      pace: num('ps-pace'),
      align: Object.keys(align).length ? align : undefined,
      tweaks: Object.keys(tweaks).length ? tweaks : undefined,
      labelPrinter: pick('ps-label-printer'),
      restockPrinter: pick('ps-restock-printer'),
    };
  };

  // بيتنده مع كل تغيير: بيوري الطابعات بتاعة الجهاز المختار، وبيحذّر من
  // الاستثناءات اللي "على الكل" هتمسحها.
  const refresh = () => {
    const t = targetEl.value;

    // القيم الشغّالة دلوقتي جوه الخانات
    const cur = currentFor(t);
    const ph = (id, v) => {
      const el = overlay.querySelector('#' + id);
      if (el) el.placeholder = String(v);
    };
    ph('ps-batch', cur.batch);
    ph('ps-lead', cur.lead);
    ph('ps-pace', cur.pace);
    ph('ps-x', cur.x);
    ph('ps-y', cur.y);
    ph('ps-shrink', cur.shrink);
    // والمفاتيح: "زي ما هي" بتقول هي دلوقتي إيه
    overlay.querySelectorAll('[data-ps-tweak]').forEach((sel) => {
      const key = sel.getAttribute('data-ps-tweak');
      const on = typeof cur.tweaks[key] === 'boolean'
        ? cur.tweaks[key]
        : !!(PRINT_TWEAKS.find((x) => x.key === key) || {}).defaultOn;
      sel.options[0].textContent = `زي ما هي (${on ? 'مفتوح' : 'مقفول'})`;
    });

    if (t === 'all') {
      noteEl.textContent = `التعديل هيروح لكل الأجهزة (${stations.length}).`;
      // ⚠️ اختيار الطابعة **مالوش معنى على الكل** — كل ماكينة ليها
      // طابعتها باسمها، واسم واحد على الكل معناه إن الباقي هيدوّر على
      // طابعة مش موجودة عنده.
      printersEl.innerHTML =
        '<div style="font-size:11px; color:var(--text-secondary); line-height:1.7;">⚠️ اختيار الطابعة بيتعمل لجهاز واحد بس — كل ماكينة ليها طابعتها باسمها.</div>';
    } else {
      const st = stations.find((s) => s.id === t);
      noteEl.textContent = st && isStationOnline(st)
        ? '🟢 الجهاز شغّال — التعديل هيوصله خلال ثواني.'
        : '🔴 الجهاز مقفول — التعديل هيتحفظ وياخده أول ما يفتح.';
      const printers = (st && Array.isArray(st.printers) ? st.printers : []);
      printersEl.innerHTML = printers.length
        ? `<div style="font-size:12px; font-weight:500; margin:10px 0 5px;">🖨️ الطابعات</div>
           ${[['ps-label-printer', 'طابعة الملصق', st.labelPrinter], ['ps-restock-printer', 'طابعة ورقة التزويد', st.restockPrinter]]
             .map(
               ([id, label, cur]) => `
             <div class="field">
               <label style="font-size:11px;">${escapeHTML(label)}</label>
               <select class="input" id="${id}">
                 <option value="">${escapeHTML(cur || '—')} (زي ما هي)</option>
                 ${printers.map((n) => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('')}
               </select>
             </div>`
             )
             .join('')}`
        : `<div style="font-size:11px; color:var(--warning-text); background:var(--warning-bg); padding:8px; border-radius:8px; line-height:1.7; margin-top:8px;">
             الجهاز ده لسه مابعتش قايمة طابعاته. افتح النظام عليه مرة واستنى دقيقة.
           </div>`;
    }

    // ⭐ التحذير: مين هيتمسح استثناءه
    const patch = cleanPrintFields(collect());
    const keys = Object.keys(patch);
    if (t === 'all' && keys.length) {
      const hit = stations
        .map((st) => ({ st, own: deviceOverrideKeys(st.id).filter((k) => keys.indexOf(k) > -1) }))
        .filter((r) => r.own.length);
      if (hit.length) {
        warnEl.style.display = 'block';
        warnEl.style.cssText =
          'font-size:11.5px; line-height:1.7; margin:10px 0; display:block; background:var(--warning-bg); color:var(--warning-text); padding:9px; border-radius:8px;';
        warnEl.innerHTML =
          '⚠️ <strong>تنبيه:</strong> الأجهزة دي عندها إعدادات خاصة هتتمسح وتاخد العام:<br>' +
          hit
            .map((r) => `• <strong>${escapeHTML(r.st.deviceName || 'جهاز')}</strong> — ${escapeHTML(r.own.map(printFieldLabel).join('، '))}`)
            .join('<br>');
        return;
      }
    }
    warnEl.style.display = 'none';
  };

  targetEl.addEventListener('change', refresh);
  overlay.addEventListener('input', refresh);
  overlay.addEventListener('change', refresh);
  refresh();

  overlay.querySelector('#ps-save').addEventListener('click', () =>
    safeAsync(async () => {
      const box = overlay.querySelector('#ps-status');
      const t = targetEl.value;
      const patch = collect();
      if (!Object.keys(cleanPrintFields(patch)).length) {
        box.style.color = 'var(--danger-text)';
        box.textContent = 'ماكتبتش أي حاجة تتغيّر.';
        return;
      }

      box.style.color = 'var(--text-secondary)';
      box.textContent = 'جارٍ الحفظ...';
      if (t === 'all') {
        const cleared = await savePrintFieldsForAll(patch, stations.map((s) => s.id));
        box.style.color = 'var(--ok)';
        box.textContent = `✅ اتحفظ لكل الأجهزة${cleared ? ` (واتمسح ${cleared} استثناء)` : ''}.`;
      } else {
        await savePrintFieldsForDevice(t, patch);
        box.style.color = 'var(--ok)';
        box.textContent = '✅ اتحفظ للجهاز ده.';
      }
      setTimeout(close, 1200);
    }, 'حفظ الإعدادات')
  );
}

function attachPrintScreenEvents() {
  // ⚠️ الأول: زراير التابات موجودة في الحالتين، وتاب الأجهزة مافيهوش
  // خانة بحث ولا سلة — فباقي الربط تحت بيتخطّى لوحده (كله بيتأكد إن
  // العنصر موجود قبل ما يربط).
  attachPrintDeviceEvents();

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
