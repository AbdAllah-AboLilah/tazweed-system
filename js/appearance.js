// ============================================================
// المظهر — الثيم والخط
// ============================================================
// ⚠️ الملف ده **مش** وحدة معزولة (module). كل ملفات js بتتحمّل في مساحة
// أسماء واحدة مشتركة، فأي اسم هنا شايفه باقي الملفات والعكس.
//
// ============================================================
// ⭐⭐ الاختيار **محلي على الجهاز**، مش في السحابة. ده مقصود.
// ============================================================
// ممكن حد يقول: "خلّي الثيم يتحفظ مع الحساب عشان يمشي معاه على أي
// جهاز". غلط هنا، لسببين:
//
//   ١) **السرعة** — الحفظ في السحابة معناه قراية عند كل فتحة قبل ما
//      نرسم أي حاجة، وإلا الشاشة هتفتح بلون وتتبدّل قدامك. النظام ده
//      بيفتح على تليفون في محل، والنص ثانية دي بتتحس.
//   ٢) **المنطق** — أمين المخزن بيشتغل على الكمبيوتر بتاع الطباعة
//      وعلى تليفونه. ممكن يحب "ليلي" على التليفون بالليل و"ورق حراري"
//      على شاشة الكمبيوتر. الجهاز هو الوحدة الصح مش الحساب.
//
// النتيجة: **صفر نداء شبكة** للمظهر. لا وقت الفتح ولا وقت التغيير.
const APPEARANCE_KEY = 'tazweed-appearance';

// ⚠️ الافتراضي "paper" — نفس شكل النظام قبل التحديث بالظبط. مقصود:
// ٤ ناس تانيين بيستخدموا النظام كل يوم، ومش من حقنا نغيّر شكل شغلهم
// من ورا ظهرهم. اللي عايز لون تاني بيختاره بنفسه.
const THEMES = [
  { id: 'paper',  name: 'ورق حراري', hint: 'اللي شغّال دلوقتي', swatch: '#185fa5' },
  { id: 'indigo', name: 'نيلي',      hint: 'أهدى على العين',     swatch: '#2b4c7e' },
  { id: 'olive',  name: 'زيتوني',    hint: 'دافي وهادي',         swatch: '#4a6b3f' },
  { id: 'wine',   name: 'عنّابي',     hint: 'غامق ودافي',         swatch: '#7d2f3d' },
  { id: 'night',  name: 'ليلي',      hint: 'للشغل بالليل',       swatch: '#6f9ede' },
];

// ⚠️ الافتراضي "plex". الخط بيتحمّل من جوّه المشروع (96 كيلو، مرة
// واحدة في العمر، والـservice worker بيخدمه من المحفوظ بعد كده).
// اللي مش عايزه يختار "خط الجهاز" و**مايتحمّلش خالص** — المتصفح
// مابينزّلش ملف خط إلا لو فيه كلام فعلًا بيستعمله.
const FONTS = [
  { id: 'plex',   name: 'بلكس عربي', hint: 'أوضح خط للأرقام' },
  { id: 'system', name: 'خط الجهاز', hint: 'زي الأول — مافيش أي تحميل' },
];

function readAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return {
      theme: THEMES.some((t) => t.id === saved.theme) ? saved.theme : 'paper',
      font: FONTS.some((f) => f.id === saved.font) ? saved.font : 'plex',
    };
  } catch (err) {
    return { theme: 'paper', font: 'plex' };
  }
}

// بيحط الاختيار على <html>. نفس اللي بيعمله السطر الصغير في index.html
// قبل أول رسمة — بس ده للتغيير وهو شغّال.
function applyAppearance(next) {
  const a = next || readAppearance();
  const root = document.documentElement;
  if (a.theme && a.theme !== 'paper') root.setAttribute('data-theme', a.theme);
  else root.removeAttribute('data-theme');
  root.setAttribute('data-font', a.font || 'plex');
  return a;
}

function saveAppearance(patch) {
  const next = { ...readAppearance(), ...patch };
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('تعذّر حفظ المظهر:', err);
  }
  applyAppearance(next);
  return next;
}

// ------------------------------------------------------------
// نافذة اختيار المظهر
// ------------------------------------------------------------
// ⚠️ التغيير بيتطبّق **وانت بتضغط**، من غير زرار "حفظ". السبب: ده
// اختيار شكل — الطريقة الوحيدة إنك تحكم عليه إنك تشوفه على النظام
// نفسه، مش على مربع صغير في نافذة.
function openAppearanceDialog() {
  const cur = readAppearance();
  const before = { ...cur };

  const overlay = document.createElement('div');
  overlay.className = 'appearance-overlay';
  overlay.innerHTML = `
    <div class="card appearance-card">
      <div class="appearance-title">🎨 المظهر</div>
      <div class="appearance-sub">التغيير بيحصل على طول — شوفه على النظام نفسه.</div>

      <div class="appearance-label">اللون</div>
      <div class="appearance-row" id="theme-row">
        ${THEMES.map(
          (t) => `
          <button class="appearance-opt ${cur.theme === t.id ? 'on' : ''}" data-theme-id="${escapeHTML(t.id)}">
            <span class="appearance-dot" style="background:${escapeHTML(t.swatch)};"></span>
            <span><b>${escapeHTML(t.name)}</b><br><small>${escapeHTML(t.hint)}</small></span>
          </button>`
        ).join('')}
      </div>

      <div class="appearance-label">الخط</div>
      <div class="appearance-row" id="font-row">
        ${FONTS.map(
          (f) => `
          <button class="appearance-opt ${cur.font === f.id ? 'on' : ''}" data-font-id="${escapeHTML(f.id)}">
            <span><b>${escapeHTML(f.name)}</b><br><small>${escapeHTML(f.hint)}</small></span>
          </button>`
        ).join('')}
      </div>

      <div class="appearance-actions">
        <button class="btn" id="appearance-reset">رجّع زي الأول</button>
        <button class="btn btn-primary" id="appearance-done">تمام</button>
      </div>
    </div>`;

  const close = () => overlay.remove();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) return close();

    const themeBtn = e.target.closest('[data-theme-id]');
    if (themeBtn) {
      saveAppearance({ theme: themeBtn.getAttribute('data-theme-id') });
      markOn(overlay, '#theme-row', themeBtn);
      return;
    }
    const fontBtn = e.target.closest('[data-font-id]');
    if (fontBtn) {
      saveAppearance({ font: fontBtn.getAttribute('data-font-id') });
      markOn(overlay, '#font-row', fontBtn);
      return;
    }
    if (e.target.closest('#appearance-reset')) {
      saveAppearance({ theme: 'paper', font: 'plex' });
      close();
      openAppearanceDialog();
      return;
    }
    if (e.target.closest('#appearance-done')) close();
  });

  document.body.appendChild(overlay);
  return { before, close };
}

function markOn(root, rowSel, btn) {
  const row = root.querySelector(rowSel);
  if (!row) return;
  row.querySelectorAll('.appearance-opt').forEach((b) => b.classList.remove('on'));
  btn.classList.add('on');
}
