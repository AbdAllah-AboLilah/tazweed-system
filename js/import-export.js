// ============================================================
// استيراد بيانات الإكسل + تصدير نسخة احتياطية
// ============================================================
// المشكلة اللي بيحلها ده: ملف الإكسل الأصلي فيه ~2000 درجة موزّعة على 25
// شيت. إدخالها بالإيد يعني ضغط "إضافة درجة" ألفين مرة. الشاشة دي بتقراها
// من الملف وتعملها كلها لوحدها.
//
// كل حاجة بتشتغل في المتصفح نفسه — الملف مابيتبعتش لأي سيرفر خارجي.

// ============================================================
// ⭐ مكتبة الإكسل بتتحمّل **وقت الحاجة** مش مع فتح النظام
// ============================================================
// ⚠️ القياس اللي أدّى للتغيير ده (فتح النظام على موبايل بمعالج أبطأ 4×):
//
//   الفتح الكامل ............ 2107 مث
//   منهم xlsx.full.min.js ... 1956 مث   ← أكتر من 90٪ من الوقت
//
// والمكتبة دي (~900 كيلو) بتتستخدم في حاجتين بس: استيراد إكسل وتصدير
// نسخة احتياطية — الاتنين **ورا ضغطة زرار**، ومقصورين على صلاحية
// `excelTools`. يعني أمين المخزن اللي بيفتح النظام 40 مرة في اليوم على
// تليفونه كان بيستنى المكتبة دي كل مرة **وهو عمره ما هيستخدمها**.
//
// دلوقتي بتتحمّل أول ما تدوس "استيراد" أو "تصدير"، مرة واحدة في الجلسة.
//
// ⚠️ وبتفضل شغّالة من غير نت: الملف محفوظ في الـService Worker
// (CDN_LIBS في sw.js)، فالتحميل بييجي من الذاكرة المحلية لو مفيش
// إنترنت. متشيلوش من قايمة الحفظ.
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxLoading = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    // اتحمّل قبل كده؟ (لو حد لسه حاطط الوسم في الصفحة مثلًا)
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded === '1') return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.dataset.loaded = '0';
    el.onload = () => { el.dataset.loaded = '1'; resolve(); };
    el.onerror = () => reject(new Error('تعذّر تحميل: ' + src));
    document.head.appendChild(el);
  });
}

// بترجّع true لو المكتبة جاهزة. بتتنادى قبل أي استخدام لـXLSX.
async function ensureXLSX() {
  if (typeof XLSX !== 'undefined') return true;
  if (!xlsxLoading) {
    xlsxLoading = loadScriptOnce(XLSX_URL).catch((err) => {
      // ⚠️ بنصفّر الوعد عشان المحاولة الجاية تبدأ من الأول بدل ما تفضل
      // ترجّع نفس الفشل للأبد
      xlsxLoading = null;
      throw err;
    });
  }
  try {
    await xlsxLoading;
    return typeof XLSX !== 'undefined';
  } catch (err) {
    console.warn(err);
    return false;
  }
}

// ------------------------------------------------------------
// قراءة شيت وتحويله لفئة + درجات
// ------------------------------------------------------------
// شكل الشيت في ملفك: صف عناوين فيه "الدرجة" و"العدد" متكررين جنب بعض
// (بلوكات)، وتحتيهم أرقام الدرجات. وفوقهم سطر "الصنف:" باسم الصنف.
//
// وفيه شيتات (زي "كريب سادة لوكس") فيها **أكتر من مجموعة** جنب بعض، كل
// واحدة باسم صنف مستقل وترقيم مستقل — بنتعامل مع كل مجموعة كفئة لوحدها.
function parseSheet(sheetName, rows) {
  // rows = مصفوفة صفوف، كل صف مصفوفة خلايا (زي ما SheetJS بيرجّعها)
  const headerRowIndex = rows.findIndex((row) => row.some((c) => String(c || '').trim() === 'الدرجة'));
  if (headerRowIndex === -1) return [];

  const headerRow = rows[headerRowIndex];
  const gradeCols = [];
  headerRow.forEach((cell, i) => {
    if (String(cell || '').trim() === 'الدرجة') gradeCols.push(i);
  });
  if (!gradeCols.length) return [];

  // أسماء الأصناف: بندوّر فوق صف العناوين على خلية مكتوب فيها "الصنف:"،
  // والاسم بيبقى في خلية على يمينها (مش لازم اللي جنبها بالظبط).
  const itemNames = []; // { col, name }
  for (let r = 0; r < headerRowIndex; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (String(row[c] || '').trim() === 'الصنف:') {
        for (let k = c + 1; k < Math.min(c + 4, row.length); k++) {
          const v = String(row[k] || '').trim();
          if (v) {
            itemNames.push({ col: c, name: v });
            break;
          }
        }
      }
    }
  }

  // كل اسم صنف بيحكم الأعمدة اللي بعده لحد الاسم اللي بعده.
  // لو مفيش أسماء خالص، الشيت كله مجموعة واحدة باسم الشيت.
  const groups = [];
  if (!itemNames.length) {
    groups.push({ name: sheetName, itemName: '', cols: gradeCols });
  } else {
    itemNames.forEach((entry, idx) => {
      const nextCol = idx + 1 < itemNames.length ? itemNames[idx + 1].col : Infinity;
      const cols = gradeCols.filter((c) => c >= entry.col && c < nextCol);
      if (cols.length) {
        groups.push({
          name: itemNames.length > 1 ? `${sheetName} — ${entry.name}` : sheetName,
          itemName: entry.name,
          cols,
        });
      }
    });
  }

  // نجمع أرقام الدرجات من أعمدة كل مجموعة
  return groups
    .map((g) => {
      const numbers = new Set();
      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        g.cols.forEach((c) => {
          const raw = row[c];
          if (raw === undefined || raw === null || raw === '') return;
          const n = Number(String(raw).trim());
          if (Number.isFinite(n) && Number.isInteger(n) && n > 0 && n < 100000) numbers.add(n);
        });
      }
      return {
        name: g.name,
        itemName: g.itemName,
        grades: [...numbers].sort((a, b) => a - b),
      };
    })
    .filter((g) => g.grades.length > 0);
}

// ------------------------------------------------------------
// شاشة الاستيراد
// ------------------------------------------------------------
function openImportDialog() {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:420px; width:100%; max-height:88vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:4px;">استيراد من ملف إكسل</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.7; margin-bottom:12px;">
        اختار ملف الإكسل بتاعك، والنظام هيقرا الشيتات ويعملك الفئات والدرجات.
        هتشوف معاينة بكل اللي هيتضاف <strong>قبل</strong> ما يتحفظ.
      </div>

      <div class="field">
        <input class="input" type="file" id="import-file" accept=".xlsx,.xls" />
      </div>

      <div id="import-status" style="font-size:12px; color:var(--text-secondary); margin-bottom:10px;"></div>
      <div id="import-preview" style="display:none;"></div>

      <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
        <button class="btn" id="import-close">إغلاق</button>
        <button class="btn btn-primary" id="import-confirm" style="display:none;">حفظ في النظام</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('import-close').addEventListener('click', close);

  const statusEl = document.getElementById('import-status');
  const previewEl = document.getElementById('import-preview');
  const confirmBtn = document.getElementById('import-confirm');
  let parsed = [];

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    statusEl.textContent = 'جارٍ تجهيز قارئ الإكسل...';
    if (!(await ensureXLSX())) {
      statusEl.textContent = 'مكتبة قراءة الإكسل ماتحمّلتش. اتأكد إنك متصل بالإنترنت وجرّب تاني.';
      return;
    }

    statusEl.textContent = 'جارٍ قراءة الملف...';
    previewEl.style.display = 'none';
    confirmBtn.style.display = 'none';

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      parsed = [];
      wb.SheetNames.forEach((name) => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
        parseSheet(name, rows).forEach((g) => parsed.push(g));
      });
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'تعذّر قراءة الملف. اتأكد إنه ملف إكسل صحيح (xlsx).';
      return;
    }

    if (!parsed.length) {
      statusEl.textContent = 'مفيش أي شيت بالشكل المتوقّع (صف فيه "الدرجة" و"العدد") في الملف ده.';
      return;
    }

    // الفئات الموجودة أصلًا — عشان منكررش حاجة
    const existing = new Set(state.categories.map((c) => c.name));
    const totalGrades = parsed.reduce((s, g) => s + g.grades.length, 0);
    const newOnes = parsed.filter((g) => !existing.has(g.name));
    const dupes = parsed.length - newOnes.length;

    statusEl.innerHTML = `
      لقيت <strong>${parsed.length}</strong> فئة فيهم <strong>${totalGrades}</strong> درجة.
      ${dupes ? `<br><span style="color:var(--text-muted);">${dupes} منهم موجودين عندك خلاص وهيتخطّوا.</span>` : ''}`;

    previewEl.innerHTML = `
      <div style="max-height:34vh; overflow:auto; border:1px solid var(--border); border-radius:6px;">
        <table style="width:100%; font-size:12px; border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:start; padding:6px; position:sticky; top:0; background:var(--bg-secondary,#eee);">الفئة</th>
            <th style="text-align:start; padding:6px; position:sticky; top:0; background:var(--bg-secondary,#eee);">اسم الصنف</th>
            <th style="text-align:center; padding:6px; position:sticky; top:0; background:var(--bg-secondary,#eee);">درجات</th>
          </tr></thead>
          <tbody>
            ${parsed
              .map((g) => {
                const dup = existing.has(g.name);
                return `<tr style="${dup ? 'opacity:0.45;' : ''}">
                  <td style="padding:5px 6px; border-top:1px solid var(--border);">${escapeHTML(g.name)}</td>
                  <td style="padding:5px 6px; border-top:1px solid var(--border);">${escapeHTML(g.itemName || '—')}</td>
                  <td style="padding:5px 6px; border-top:1px solid var(--border); text-align:center;">
                    ${dup ? 'موجودة' : g.grades.length}
                  </td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`;
    previewEl.style.display = 'block';

    if (newOnes.length) {
      confirmBtn.style.display = 'inline-block';
      confirmBtn.textContent = `حفظ ${newOnes.length} فئة في النظام`;
    } else {
      statusEl.innerHTML += '<br>كل الفئات دي موجودة عندك خلاص — مفيش جديد يتضاف.';
    }
  });

  confirmBtn.addEventListener('click', async () => {
    // الاستيراد بيكتب آلاف المستندات على دفعات، وبيستنى تأكيد السيرفر بعد
    // كل دفعة عشان يوريك التقدّم ويوقف بأمان لو حصلت مشكلة. من غير نت،
    // الدفعة الأولى مش هتخلص خالص — فبنقول ده صراحة بدل ما الشاشة تعلّق.
    if (!state.isOnline) {
      statusEl.innerHTML =
        '⚠️ الاستيراد محتاج إنترنت (بيرفع آلاف السطور). اتصل بالنت وحاول تاني.<br>' +
        '<span style="color:var(--text-muted);">باقي النظام شغّال عادي من غير نت.</span>';
      return;
    }

    const existing = new Set(state.categories.map((c) => c.name));
    const toAdd = parsed.filter((g) => !existing.has(g.name));

    confirmBtn.disabled = true;
    document.getElementById('import-file').disabled = true;
    let doneCats = 0;
    let doneGrades = 0;

    try {
      let order = state.categories.length;
      for (const group of toAdd) {
        statusEl.innerHTML = `جارٍ الحفظ... <strong>${doneCats}/${toAdd.length}</strong> فئة، ${doneGrades} درجة`;

        const catRef = await db.collection('categories').add({
          name: group.name,
          itemName: group.itemName || '',
          barcodeNumber: '',
          originalPrice: 0,
          sellingPrice: 0,
          order: order++,
        });

        // الكتابة على دفعات (batch) — أسرع بكتير من درجة درجة، والحد
        // الأقصى للدفعة الواحدة في Firestore هو 500 عملية.
        for (let i = 0; i < group.grades.length; i += 400) {
          const chunk = group.grades.slice(i, i + 400);
          const batch = db.batch();
          chunk.forEach((number) => {
            batch.set(catRef.collection('grades').doc(), {
              number,
              branchQty: 0,
              mainQty: 0,
              status: 'normal',
            });
          });
          await batch.commit();
          doneGrades += chunk.length;
          statusEl.innerHTML = `جارٍ الحفظ... <strong>${doneCats}/${toAdd.length}</strong> فئة، ${doneGrades} درجة`;
        }

        doneCats++;
        await logActivity({
          action: 'import_category',
          categoryId: catRef.id,
          categoryName: group.name,
          newValue: group.grades.length,
        });
      }

      statusEl.innerHTML = `✅ تم — اتضافت <strong>${doneCats}</strong> فئة و<strong>${doneGrades}</strong> درجة.`;
      confirmBtn.style.display = 'none';
    } catch (err) {
      console.error(err);
      statusEl.innerHTML = `⚠️ وقف عند الفئة رقم ${doneCats + 1}. اللي اتحفظ قبلها موجود.<br>السبب: ${escapeHTML(err.message || err)}`;
      confirmBtn.disabled = false;
    }
  });
}

// ------------------------------------------------------------
// تصدير نسخة احتياطية لإكسل
// ------------------------------------------------------------
// بيعمل ملف فيه شيت لكل فئة (زي ملفك الأصلي)، وشيت ملخّص.
async function exportToExcel() {
  if (!(await ensureXLSX())) {
    alert('مكتبة الإكسل ماتحمّلتش. اتأكد إنك متصل بالإنترنت وجرّب تاني.');
    return;
  }

  const wb = XLSX.utils.book_new();
  const summary = [['الفئة', 'اسم الصنف', 'الباركود', 'السعر الأصلي', 'سعر البيع', 'عدد الدرجات', 'خلصت نهائيًا', 'طلب معلّق']];
  const used = new Set();

  for (const cat of state.categories) {
    const snap = await db.collection('categories').doc(cat.id).collection('grades').orderBy('number').get();
    const grades = snap.docs.map((d) => d.data());

    summary.push([
      cat.name,
      cat.itemName || '',
      cat.barcodeNumber || '',
      cat.originalPrice || 0,
      cat.sellingPrice || 0,
      grades.length,
      grades.filter((g) => g.status === 'out').length,
      grades.filter((g) => g.status === 'pending').length,
    ]);

    const rows = [
      ['الصنف:', cat.itemName || cat.name],
      ['الباركود:', cat.barcodeNumber || ''],
      [],
      ['الدرجة', 'المجموعة', 'الفرع', 'الرئيسي', 'الحالة'],
      // الدرجات الأساسية بتتصدّر باسمها (أبيض/أسود/أوف وايت) مش برقمها
      // السالب، عشان الملف يفضل مقروء زي ملف الإكسل الأصلي.
      ...grades.map((g) => [
        g.isBase && g.name ? g.name : g.number,
        g.group || '',
        g.branchQty || 0,
        g.mainQty || 0,
        statusLabel(g.status),
      ]),
    ];

    // أسماء شيتات إكسل: 31 حرف كحد أقصى، وممنوع فيها : \ / ? * [ ]
    let sheetName = String(cat.name).replace(/[:\\/?*[\]]/g, ' ').slice(0, 28) || 'فئة';
    let n = 2;
    while (used.has(sheetName)) sheetName = `${sheetName.slice(0, 26)} ${n++}`;
    used.add(sheetName);

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'ملخص');

  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  XLSX.writeFile(wb, `نسخة-احتياطية-التزويد-${stamp}.xlsx`);
}
