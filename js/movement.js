// ============================================================
// حركة المخزون — إيه اللي بيسحب وإيه اللي راكد
// ============================================================
// ⚠️ الملف ده **مش** وحدة معزولة (module). كل ملفات js بتتحمّل في مساحة
// أسماء واحدة مشتركة، فأي اسم هنا شايفه باقي الملفات والعكس.
//
// ============================================================
// ⭐⭐⭐ ليه مجموعة منفصلة ومش حقول جوّه الدرجة
// ============================================================
// الفكرة الأولى كانت نحط `lastMovedAt` جنب الكمية في مستند الدرجة —
// كتابة واحدة بدل اتنين. وده **كان هيكسر النظام كله**.
//
// السبب في firestore.rules: تعديل الدرجة متحكوم بـ`onlyChangedKeys([...])`
// بقايمة حقول **مقفولة بالظبط**، و`branchAction()` و`mainAction()` فيهم
// **17 تركيبة** مختلفة. أي حقل جديد في الكتابة لازم يتضاف للـ17 كلهم —
// وأي واحدة تفوتنا معناها إن العملية دي بتترفض من السيرفر **في صمت**،
// يعني **المحل مايقدرش يعدّل كمية**.
//
// فالحركة بتتخزّن في `gradeStats` بمستند لكل درجة، وقاعدة أمانه بسيطة
// ومستقلة. مستند الدرجة نفسه **مالوش أي علاقة** — بايت ببايت زي ما كان.
//
// وده كمان اللي صاحب النظام طلبه بالنص: "مش عاوزها تبقى جنب الدرجات".

const MOVEMENT_DEFAULT_DAYS = 15;
const MOVEMENT_DAYS_KEY = 'tazweed_movement_days';
const MOVEMENT_OPEN_KEY = 'tazweed_movement_open';
const MOVEMENT_SPAN_KEY = 'tazweed_movement_span';   // فترة "بتسحب بسرعة"
const MOVEMENT_GROUPS_KEY = 'tazweed_movement_groups'; // الفئات المقفولة
const MOVEMENT_SPANS = [
  { key: '1', label: 'الشهر ده', months: 1 },
  { key: '2', label: 'شهرين', months: 2 },
  { key: '3', label: '٣ شهور', months: 3 },
];
const MOVEMENT_MAX_STATS = 4000;
const MOVEMENT_LIST_CAP = 100;

let movementStats = null;    // آخر لقطة من gradeStats
let movementLoading = false;
let movementBackfill = null; // { done, total } وقت الملء

// معرّف المستند — الفئة والدرجة مع بعض، عشان يفضل ثابت ومايتكررش
function gradeStatsId(categoryId, gradeId) {
  return `${categoryId}__${gradeId}`;
}

function gradeStatsRef(categoryId, gradeId) {
  return db.collection('gradeStats').doc(gradeStatsId(categoryId, gradeId));
}

// مفتاح الشهر بتوقيت الجهاز — الشهر هو الوحدة اللي صاحب المحل بيفكر بيها
function movementMonthKey(d) {
  const t = d || new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

// عدد الأيام اللي بعدها الدرجة تتحسب "راكدة" — بيتظبط من شاشة التقرير
function getMovementDays() {
  const raw = parseInt(localStorage.getItem(MOVEMENT_DAYS_KEY), 10);
  return raw > 0 && raw <= 3650 ? raw : MOVEMENT_DEFAULT_DAYS;
}

function setMovementDays(n) {
  const v = parseInt(n, 10);
  if (v > 0 && v <= 3650) localStorage.setItem(MOVEMENT_DAYS_KEY, String(v));
}

// أي قسم مفتوح — بيتفتكر عشان ماتفتحهوش كل مرة
function getMovementOpen() {
  try {
    const saved = JSON.parse(localStorage.getItem(MOVEMENT_OPEN_KEY));
    return saved || { fast: true, idle: true, unknown: false };
  } catch (err) {
    return { fast: true, idle: true, unknown: false };
  }
}

// ============================================================
// الفئات المقفولة جوّه الأقسام
// ============================================================
// بنخزّن **المقفول** مش المفتوح: الافتراضي إن الفئة مفتوحة، فالقايمة
// بتفضل فاضية لحد ما المستخدم يقفل حاجة بنفسه.
//
// ⚠️ المفتاح فيه اسم الفئة، والاسم بيتحط في خاصية HTML. `escapeHTML`
// **مابتهربش علامة التنصيص** (بتستخدم textContent)، فاسم فيه `"` كان
// هيكسر الخاصية. بنستخدم encodeURIComponent — مافيهوش تنصيص ولا مسافات.
function getClosedGroups() {
  try {
    const raw = JSON.parse(localStorage.getItem(MOVEMENT_GROUPS_KEY));
    return Array.isArray(raw) ? new Set(raw) : new Set();
  } catch (err) {
    return new Set();
  }
}

function setClosedGroups(set) {
  try {
    localStorage.setItem(MOVEMENT_GROUPS_KEY, JSON.stringify([...set]));
  } catch (err) {
    /* التخزين مقفول — الفئات هتفضل مفتوحة وبس */
  }
}

function groupKey(kind, name) {
  return kind + '::' + name;
}

function setMovementOpen(map) {
  try {
    localStorage.setItem(MOVEMENT_OPEN_KEY, JSON.stringify(map));
  } catch (err) {
    /* التخزين مقفول — القسم هيفضل على الافتراضي وبس */
  }
}

// ============================================================
// التسجيل — بيتنده مع كل تغيير كمية
// ============================================================
// ⚠️ الفرق بين "اتحركت" و"اتباعت" مقصود:
//   • **اتحركت** = أي تغيير في أي كمية. منها بنعرف الراكد.
//   • **اتباعت** = كمية الفرع **قلّت**. منها بنعرف اللي بيسحب بسرعة.
// التزويد (نقل من الرئيسي للفرع) حركة **مش** بيع — الفرع بيزيد مش يقل.
function recordMovement(info) {
  if (!info || !info.categoryId || !info.gradeId) return null;
  if (typeof db === 'undefined' || !db || !state.user) return null;

  // ============================================================
  // ⚠️⚠️ الدالة دي **ممنوع** ترمي خطأ — مهما حصل
  // ============================================================
  // بتتنده من جوّه applyQuantityChange، يعني في نص أهم عملية في النظام.
  // لو رمت خطأ، تعديل الكمية نفسه بيقف — والتقرير ده **مجرد إضافة**،
  // مايصحّش يوقّع الشغل الأساسي.
  //
  // ده اتمسك من فحص حقيقي (batch1): بيئة من غير FieldValue خلّت السطر
  // ده يرمي TypeError، والخطأ طلع من تعديل الكمية مش من التقرير.
  const FV =
    typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue
      ? firebase.firestore.FieldValue
      : null;
  if (!FV || typeof FV.increment !== 'function') return null;

  try {
    return writeMovement(FV, info);
  } catch (err) {
    console.warn('تعذّر تسجيل حركة الدرجة (التعديل نفسه تمّ عادي):', err);
    return null;
  }
}

function writeMovement(FV, info) {
  const sold = Math.max(0, Number(info.soldQty) || 0);
  const now = FV.serverTimestamp();
  const inc = FV.increment;

  // ============================================================
  // ⭐ الدرجة اللي خلصت ورجعت = **درجة جديدة**
  // ============================================================
  // في محل القماش، الدرجة اللي خلصت من الفرع والرئيسي ورجعت تاني مش
  // نفس الدرجة — صبغة تانية وشحنة تانية. فعدّاد "راكدة من إمتى" لازم
  // يبدأ من أول يوم رجعت فيه، مش من تاريخ الشحنة اللي قبلها.
  //
  // ⚠️ استثناءين مقصودين (شوف isNewCycleGrade):
  //   • الدرجات الأساسية — الأبيض بيخلص وبيجي أبيض غيره، نفس الدرجة
  //   • الفئات اللي صاحب المحل علّم عليها "درجاتها بتتكرر"
  const payload = {
    categoryId: info.categoryId,
    categoryName: info.categoryName || '',
    gradeId: info.gradeId,
    gradeNumber: info.gradeNumber == null ? '' : String(info.gradeNumber),
    gradeName: info.gradeName || '',
    lastMovedAt: now,
    moves: inc(1),
  };

  if (sold > 0) {
    payload.lastSoldAt = now;
    payload.soldTotal = inc(sold);
    payload.soldByMonth = { [movementMonthKey()]: inc(sold) };
  }

  // رجعت بعد ما خلصت → ساعة "راكدة" تبدأ من أول
  if (info.newCycle) payload.cycleStartedAt = now;

  // merge:true عشان المستند يتعمل أول مرة ويتحدّث بعد كده من غير ما
  // نقراه الأول — ولا قراءة زيادة على أي تعديل كمية.
  return fireWrite(gradeStatsRef(info.categoryId, info.gradeId).set(payload, { merge: true }), 'حركة الدرجة');
}

// ============================================================
// قراءة اللقطة
// ============================================================
// مابنعملش onSnapshot: التقرير بيتفتح مرة كل كام يوم، واشتراك دايم على
// آلاف المستندات هيفضل شغّال في الخلفية على الفاضي.
async function loadMovementStats(force) {
  if (movementStats && !force) return movementStats;
  if (movementLoading) return movementStats;
  movementLoading = true;
  try {
    const snap = await db.collection('gradeStats').limit(MOVEMENT_MAX_STATS).get();
    const next = {};
    snap.docs.forEach((d) => (next[d.id] = d.data()));
    movementStats = next;
  } catch (err) {
    console.warn('تعذّرت قراءة حركة المخزون:', err);
    movementStats = movementStats || {};
  } finally {
    movementLoading = false;
  }
  return movementStats;
}

function movementToDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  return null;
}

// ============================================================
// الحساب — الدرجات جاهزة في الذاكرة أصلًا
// ============================================================
// allGradesCache بيتحدّث لايف من subscribeOverview (اشتراك موجود من زمان
// عشان الشارات)، فمافيش أي قراءة زيادة عشان نجيب قايمة الدرجات.
// الدرجة دي بتبدأ دورة جديدة لما ترجع بعد ما تخلص؟
// ⚠️ لأ في حالتين: الدرجات الأساسية (الأبيض بيخلص وبيجي أبيض غيره)،
// والفئات اللي صاحب المحل علّم عليها إن درجاتها بتتكرر.
function isNewCycleGrade(cat, grade) {
  if (grade && grade.isBase) return false;
  if (cat && cat.repeatGrades) return false;
  return true;
}

// الفترة اللي بيتحسب عليها "بتسحب بسرعة"
function getMovementSpan() {
  const raw = localStorage.getItem(MOVEMENT_SPAN_KEY);
  return MOVEMENT_SPANS.find((s) => s.key === raw) || MOVEMENT_SPANS[0];
}

function setMovementSpan(key) {
  if (MOVEMENT_SPANS.some((s) => s.key === key)) localStorage.setItem(MOVEMENT_SPAN_KEY, key);
}

// مفاتيح آخر N شهر (الشهر الحالي أولًا)
function movementMonthKeys(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(movementMonthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return out;
}

// ============================================================
// الحساب — الدرجات جاهزة في الذاكرة أصلًا
// ============================================================
// allGradesCache بيتحدّث لايف من subscribeOverview (اشتراك موجود من زمان
// عشان الشارات)، فمافيش أي قراءة زيادة عشان نجيب قايمة الدرجات.
function computeMovementReport() {
  const stats = movementStats || {};
  const days = getMovementDays();
  const span = getMovementSpan();
  const months = movementMonthKeys(span.months);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const cats = {};
  (state.categories || []).forEach((c) => (cats[c.id] = c));

  const grades = typeof allGradesCache !== 'undefined' && allGradesCache ? allGradesCache : null;
  if (!grades) return null;

  const fast = {};      // فئة → صفوف
  const idle = {};      // عندها تاريخ وماتحركتش
  const unknown = {};   // مالهاش أي تاريخ لسه
  let fastCount = 0;
  let idleCount = 0;
  let unknownCount = 0;
  let soldOut = 0;

  grades.forEach((g) => {
    if (!g.catId || !g.gradeId) return;
    const st = stats[gradeStatsId(g.catId, g.gradeId)] || null;
    const cat = cats[g.catId] || null;
    const catName = (cat && cat.name) || (st && st.categoryName) || 'بدون فئة';
    const label = `درجة ${g.name || g.number || ''}`;

    // ---- بتسحب بسرعة ----
    const soldSpan = st && st.soldByMonth
      ? months.reduce((sum, m) => sum + (Number(st.soldByMonth[m]) || 0), 0)
      : 0;
    if (soldSpan > 0) {
      (fast[catName] = fast[catName] || []).push({ label, qty: soldSpan });
      fastCount++;
    }

    // ---- راكدة ----
    // ⚠️⚠️ **الدرجة اللي مافيهاش بضاعة مش راكدة — هي خلصانة.**
    // أول نسخة كانت بتعدّها راكدة، وده كان بيغرق القايمة بدرجات مالهاش
    // أي كمية أصلًا — والمفروض القايمة دي تقول لك **فلوسك واقفة فين**.
    const branch = Number(g.branchQty) || 0;
    const main = Number(g.mainQty) || 0;
    const onHand = branch + main;
    if (onHand <= 0) {
      soldOut++;
      return;
    }

    const moved = st ? movementToDate(st.lastMovedAt) : null;
    // ⭐ ساعة الركود بتبدأ من **أحدث** حاجة: آخر حركة، أو أول يوم في
    // الدورة دي (الدرجة رجعت بعد ما خلصت = درجة جديدة).
    const cycle = st ? movementToDate(st.cycleStartedAt) : null;
    const fromMs = Math.max(moved ? moved.getTime() : 0, cycle ? cycle.getTime() : 0);

    // ============================================================
    // ⭐⭐⭐ "مالناش تاريخ عنها" ≠ "راكدة"
    // ============================================================
    // ⚠️ أول نسخة كانت بتحط الاتنين في قايمة واحدة، وده كان بيخلّي
    // القايمة تقول حاجة مش عارفاها:
    //   • "40 يوم"        = حقيقة، السجل بيقول كده
    //   • "من غير حركة"   = **صفحة فاضية**، مش حقيقة
    //
    // والدرجة بتبقى من غير تاريخ لسبب واضح: العمليات الجماعية (ظبط
    // كميات الفرع / الدرجات الأساسية) بتسجّل **سطر واحد للفئة كلها**
    // من غير أسماء الدرجات — فمفيش أثر لكل درجة لوحدها.
    //
    // النتيجة العملية على بيانات حقيقية: 602 درجة من غير تاريخ، أغلبها
    // قطعة واحدة، وكانت بتتصدّر القايمة وتزقّ اللي فعلًا فلوسه واقفة
    // فيه لتحت.
    //
    // ⭐ وبتتصلح لوحدها: أول تعديل كمية بيدّي الدرجة تاريخ وتنتقل
    // للقايمة الصح.
    if (!fromMs) {
      (unknown[catName] = unknown[catName] || []).push({ label, onHand });
      unknownCount++;
      return;
    }

    if (fromMs < cutoff) {
      (idle[catName] = idle[catName] || []).push({
        label,
        daysIdle: Math.floor((Date.now() - fromMs) / 86400000),
        onHand,
        fresh: !!(cycle && moved && cycle.getTime() >= moved.getTime()),
      });
      idleCount++;
    }
  });

  // ⭐ ترتيب المجموعات مش أبجدي — **الأهم فوق**:
  //   • بتسحب بسرعة  → الفئة اللي باعت أكتر
  //   • راكدة        → الفئة اللي فيها أكتر قطع واقفة (فلوسك واقفة فين)
  const sortGroups = (map, rank, cmp) =>
    Object.keys(map)
      .map((name) => ({ name, rows: map[name].sort(cmp) }))
      .sort((a, b) => rank(b.rows) - rank(a.rows) || a.name.localeCompare(b.name, 'ar'));

  const sumQty = (rows) => rows.reduce((n, r) => n + (r.qty || 0), 0);
  const sumOnHand = (rows) => rows.reduce((n, r) => n + (r.onHand || 0), 0);

  return {
    days,
    span,
    fast: sortGroups(fast, sumQty, (a, b) => b.qty - a.qty),
    idle: sortGroups(idle, sumOnHand, (a, b) => b.daysIdle - a.daysIdle),
    unknown: sortGroups(unknown, sumOnHand, (a, b) => b.onHand - a.onHand),
    fastCount,
    idleCount,
    unknownCount,
    soldOut,
    total: grades.length,
    tracked: Object.keys(stats).length,
  };
}


// ============================================================
// شاشة التقرير
// ============================================================
// لمنشئ النظام بس (مفتاح viewReports)، وكل قسم بيتفتح ويتقفل بزراره —
// عشان الشاشة ماتبقاش زحمة زي ما اتطلب.
function movementSectionHTML(key, icon, title, count, hint, bodyHTML, open) {
  return `
    <div class="mv-sec">
      <button type="button" class="pset-toggle" data-mv="${key}" aria-expanded="${open ? 'true' : 'false'}">
        <span class="pset-sec-title">${icon} ${escapeHTML(title)}<small>${escapeHTML(hint)}</small></span>
        <span style="display:flex; align-items:center; gap:8px;">
          <span class="mv-count">${escapeHTML(count)}</span>
          <span class="pset-chev">▾</span>
        </span>
      </button>
      <div class="pset-body" id="mv-body-${key}" ${open ? '' : 'hidden'}>${bodyHTML}</div>
    </div>`;
}

// ⭐ الصفوف **متجمّعة تحت فئتها** — مش قايمة واحدة سايحة.
// من غير ده، 20 درجة من 5 فئات بتبقى كومة مالهاش معنى: مش عارف تقرا
// منها "أنهي فئة اللي واقفة"، وده أهم سؤال في الشاشة.
function movementRowsHTML(groups, kind) {
  if (!groups.length) {
    const empty = {
      fast: 'مفيش حاجة اتباعت في الفترة دي.',
      idle: 'مفيش درجات راكدة بالمدة دي — كله بيتحرك. 👌',
      unknown: 'كل الدرجات عندها تاريخ. 👌',
    };
    return `<div class="home-empty" style="padding:1rem; text-align:center;">${empty[kind]}</div>`;
  }
  // ⭐ كل فئة ليها زرار قفل لوحدها — نفس فكرة الأقسام الكبيرة.
  // من غيره لازم تنزل تحت الفئة كلها عشان توصل للي بعدها، والفئة ممكن
  // تكون فيها 69 درجة.
  const closed = getClosedGroups();
  let shown = 0;
  const out = [];
  for (const grp of groups) {
    if (shown >= MOVEMENT_LIST_CAP) break;
    const rows = grp.rows.slice(0, MOVEMENT_LIST_CAP - shown);
    shown += rows.length;
    const shut = closed.has(groupKey(kind, grp.name));
    out.push(`
      <div class="mv-group">
        <button type="button" class="mv-group-head ${shut ? 'shut' : ''}"
                data-mv-group="${encodeURIComponent(groupKey(kind, grp.name))}"
                aria-expanded="${shut ? 'false' : 'true'}">
          <span class="mv-group-name">${escapeHTML(grp.name)}</span>
          <span class="mv-group-side">
            <span class="mv-count">${escapeHTML(grp.rows.length)}</span>
            <span class="pset-chev">▾</span>
          </span>
        </button>
        <div class="grade-cards" ${shut ? 'hidden' : ''}>
          ${rows
            .map((r) => {
              const right =
                kind === 'fast'
                  ? `<span class="mv-qty">${escapeHTML(r.qty)}</span>`
                  : kind === 'idle'
                    ? `<span class="mv-idle">${escapeHTML(r.daysIdle)} يوم</span>`
                    : '';
              const extra =
                kind === 'fast' ? '' : `<span class="mv-onhand">${escapeHTML(r.onHand)} قطعة</span>`;
              return `
              <div class="grade-card mv-row">
                <span class="mv-label">${escapeHTML(r.label)}${
                  r.fresh ? '<span class="mv-fresh" title="رجعت بعد ما خلصت — بتتحسب درجة جديدة">جديدة</span>' : ''
                }</span>
                <span class="mv-right">${extra}${right}</span>
              </div>`;
            })
            .join('')}
        </div>
      </div>`);
  }
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  if (total > shown) out.push(`<div class="mv-more">وفيه ${escapeHTML(total - shown)} كمان — دي أول ${escapeHTML(shown)}</div>`);
  return out.join('');
}

function movementScreenHTML() {
  const days = getMovementDays();
  const span = getMovementSpan();
  const open = getMovementOpen();

  if (movementBackfill) {
    const known = movementBackfill.total > 0;
    const pct = known ? Math.min(100, Math.round((movementBackfill.done / movementBackfill.total) * 100)) : 0;
    return `
      <div style="padding:1rem;">
        <div class="card" style="padding:16px; text-align:center;">
          <div style="font-size:15px; font-weight:600; margin-bottom:8px;">📈 بيقرا السجل القديم…</div>
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
            ${
              known
                ? `${escapeHTML(movementBackfill.done)} من ${escapeHTML(movementBackfill.total)} عملية — ${escapeHTML(pct)}%`
                : `${escapeHTML(movementBackfill.done)} عملية…`
            }
          </div>
          ${known ? `<div class="mv-bar"><span style="width:${pct}%"></span></div>` : '<div class="mv-bar mv-bar-wait"><span></span></div>'}
          <div style="font-size:12px; color:var(--text-muted); margin-top:10px;">
            سيب الشاشة مفتوحة لحد ما يخلص. بيحصل مرة واحدة بس.
          </div>
        </div>
      </div>`;
  }

  const rep = computeMovementReport();
  if (!rep) {
    return `<div style="padding:1rem;"><div class="home-empty" style="padding:2rem; text-align:center;">جارٍ تحميل الدرجات…</div></div>`;
  }

  // فيه فئة واحدة على الأقل مفتوحة؟ الزرار بيقلب حسب ده.
  const closedNow = getClosedGroups();
  const allKeys = [
    ...rep.fast.map((g) => groupKey('fast', g.name)),
    ...rep.idle.map((g) => groupKey('idle', g.name)),
    ...rep.unknown.map((g) => groupKey('unknown', g.name)),
  ];
  const anyOpen = allKeys.some((k) => !closedNow.has(k));

  return `
    <div style="padding:1rem;">
      <div class="card" style="padding:12px; margin-bottom:12px;">
        <div style="font-size:15px; font-weight:600;">📈 حركة المخزون</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:4px; line-height:1.7;">
          إيه اللي بيسحب بسرعة، وإيه اللي فلوسك واقفة فيه. الأرقام بتتجمّع
          لوحدها مع كل تعديل كمية — مافيش حاجة بتتحسب دلوقتي.
        </div>

        <div class="mv-days">
          <label for="mv-days-input">الدرجة تتحسب راكدة بعد</label>
          <input class="input" id="mv-days-input" type="number" min="1" max="3650"
                 inputmode="numeric" value="${escapeHTML(days)}" />
          <span>يوم</span>
        </div>

        <div class="mv-days" style="border-top:none; padding-top:0; margin-top:8px;">
          <label for="mv-span">"بتسحب بسرعة" بتحسب</label>
          <select class="input" id="mv-span" style="width:auto; min-width:110px;">
            ${MOVEMENT_SPANS.map(
              (sp) => `<option value="${sp.key}" ${sp.key === span.key ? 'selected' : ''}>${escapeHTML(sp.label)}</option>`
            ).join('')}
          </select>
        </div>

        <div class="mv-tools">
          <button class="btn" id="mv-fold">${anyOpen ? '⬆️ اقفل كل الفئات' : '⬇️ افتح كل الفئات'}</button>
          <button class="btn" id="mv-refresh">🔄 حدّث الأرقام</button>
          <button class="btn" id="mv-repeat">🔁 فئات درجاتها بتتكرر</button>
          <button class="btn" id="mv-backfill">📥 احسب من السجل القديم</button>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:8px; line-height:1.8;">
          عندك <strong>${escapeHTML(rep.total)}</strong> درجة في النظام.
          ${rep.soldOut ? `منهم <strong>${escapeHTML(rep.soldOut)}</strong> خلصانة (مافيش فيها بضاعة، فمش داخلة في الحساب).` : ''}
          ${
            rep.unknownCount
              ? `<br>و<strong>${escapeHTML(rep.unknownCount)}</strong> درجة لسه مالهاش تاريخ حركة — تحت في آخر قسم.`
              : ''
          }
        </div>
      </div>

      ${movementSectionHTML('fast', '🔥', 'بتسحب بسرعة', rep.fastCount,
        `الأكتر بيعًا خلال ${span.label}`, movementRowsHTML(rep.fast, 'fast'), open.fast)}

      ${movementSectionHTML('idle', '🧊', 'راكدة', rep.idleCount,
        `فيها بضاعة ومامتحركتش من ${days} يوم أو أكتر`, movementRowsHTML(rep.idle, 'idle'), open.idle)}

      ${movementSectionHTML('unknown', '❔', 'مافيش عنها تاريخ لسه', rep.unknownCount,
        'مش راكدة — إحنا بس مانعرفش عنها حاجة', movementRowsHTML(rep.unknown, 'unknown'), open.unknown)}

      ${
        rep.unknownCount
          ? `<div class="card" style="padding:12px; font-size:12px; color:var(--text-secondary); line-height:1.9;">
               <strong>❔ يعني إيه "مافيش عنها تاريخ"؟</strong>
               <br>النظام بيسجّل حركة الدرجة لما تعدّل كميتها لوحدها. لكن
               العمليات الجماعية — زي <strong>ظبط كميات الفرع</strong> و<strong>الدرجات
               الأساسية</strong> — بتتسجّل سطر واحد للفئة كلها من غير أسماء الدرجات.
               <br>فالدرجات دي مش راكدة، إحنا بس <strong>مالناش سطر عنها في السجل</strong>.
               <br>⭐ وبتتصلح لوحدها: أول ما تعدّل كمية أي درجة منهم، تاخد تاريخ
               وتنتقل للقايمة اللي فوق.
             </div>`
          : ''
      }
    </div>`;
}

// ============================================================
// فئات درجاتها بتتكرر
// ============================================================
// القاعدة الافتراضية: الدرجة اللي خلصت ورجعت = **درجة جديدة** (صبغة
// وشحنة تانية)، فساعة "راكدة" بتبدأ من أول.
//
// بس فيه فئات درجاتها ثابتة فعلًا — بتخلص وبتيجي **زيها بالظبط**.
// الشاشة دي بتخلّي صاحب المحل يعلّم عليها، وساعتها الدرجة بتفضل نفسها.
//
// ⚠️ الدرجات الأساسية **دايمًا** بتتعامل كده من غير ما تعلّم على حاجة —
// الأبيض بيخلص وبيجي أبيض غيره، ودي نفس الدرجة بالمنطق ده.
function openRepeatGradesDialog() {
  const cats = (state.categories || []).slice();
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:400px; width:100%; max-height:88vh; display:flex; flex-direction:column;">
      <div style="font-size:15px; font-weight:600; margin-bottom:6px;">🔁 فئات درجاتها بتتكرر</div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.8; margin-bottom:10px;">
        افتراضيًا: الدرجة اللي تخلص وترجع بتتحسب <strong>درجة جديدة</strong>،
        وعدّاد "راكدة" بيبدأ من أول.
        <br>علّم على الفئة اللي درجاتها <strong>بتتكرر زي ما هي</strong> —
        ساعتها الدرجة تفضل نفسها والعدّاد يكمّل.
        <br>⚠️ الدرجات الأساسية بتتعامل كده دايمًا من غير ما تعلّم.
      </div>
      <div style="flex:1; overflow:auto; border:1px solid var(--border); border-radius:8px; padding:6px;">
        ${
          cats.length
            ? cats
                .map(
                  (c) => `
          <label class="mv-cat-row">
            <input type="checkbox" data-repeat-cat="${escapeHTML(c.id)}" ${c.repeatGrades ? 'checked' : ''} />
            <span>${escapeHTML(c.name)}</span>
          </label>`
                )
                .join('')
            : '<div class="home-empty" style="padding:1rem; text-align:center;">مفيش فئات.</div>'
        }
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn btn-primary" id="mv-repeat-save" style="flex:1;">حفظ</button>
        <button class="btn" id="mv-repeat-cancel" style="flex:1;">إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.parentNode && document.body.removeChild(overlay);
  overlay.querySelector('#mv-repeat-cancel').addEventListener('click', close);
  overlay.querySelector('#mv-repeat-save').addEventListener('click', () =>
    safeAsync(async () => {
      // ⚠️ بنكتب **اللي اتغيّر بس** — مش كل الفئات. الحفظ على 39 فئة
      // وإنت غيّرت واحدة معناه 39 كتابة في السحابة على الفاضي.
      const boxes = overlay.querySelectorAll('[data-repeat-cat]');
      const changed = [];
      boxes.forEach((b) => {
        const id = b.getAttribute('data-repeat-cat');
        const cat = cats.find((c) => c.id === id);
        const was = !!(cat && cat.repeatGrades);
        if (b.checked !== was) changed.push({ id, on: b.checked });
      });
      for (const ch of changed) {
        await db.collection('categories').doc(ch.id).update({ repeatGrades: ch.on });
      }
      close();
      renderFromData();
    }, 'حفظ الفئات')
  );
}

function attachMovementEvents() {
  const daysEl = document.getElementById('mv-days-input');
  if (daysEl) {
    // ⚠️ نفس درس شاشة الأصناف: القيمة بتتسجّل **فورًا** والرسم هو اللي
    // بيتأجّل. لو أجّلنا التسجيل كمان، الرسم بيلاقي رقم قديم والحرف بيضيع.
    let timer = null;
    daysEl.addEventListener('input', () => {
      setMovementDays(daysEl.value);
      clearTimeout(timer);
      timer = setTimeout(() => {
        renderFromData();
        const again = document.getElementById('mv-days-input');
        if (again) {
          again.focus();
          const v = again.value;
          again.value = '';
          again.value = v;
        }
      }, 400);
    });
  }

  document.querySelectorAll('.pset-toggle[data-mv]').forEach((btn) => {
    const key = btn.getAttribute('data-mv');
    const box = document.getElementById('mv-body-' + key);
    if (!box) return;
    btn.addEventListener('click', () => {
      const willOpen = box.hidden;
      box.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
      const map = getMovementOpen();
      map[key] = willOpen;
      setMovementOpen(map);
    });
  });

  const spanEl = document.getElementById('mv-span');
  if (spanEl) {
    spanEl.addEventListener('change', () => {
      setMovementSpan(spanEl.value);
      renderFromData();
    });
  }

  // قفل/فتح الفئة الواحدة — معالج واحد لكلهم
  document.querySelectorAll('.mv-group-head[data-mv-group]').forEach((btn) => {
    const box = btn.nextElementSibling;
    if (!box) return;
    btn.addEventListener('click', () => {
      const key = decodeURIComponent(btn.getAttribute('data-mv-group'));
      const willOpen = box.hidden;
      box.hidden = !willOpen;
      btn.classList.toggle('shut', !willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
      const set = getClosedGroups();
      if (willOpen) set.delete(key);
      else set.add(key);
      setClosedGroups(set);
    });
  });

  const fold = document.getElementById('mv-fold');
  if (fold) {
    fold.addEventListener('click', () => {
      const heads = [...document.querySelectorAll('.mv-group-head[data-mv-group]')];
      const keys = heads.map((h) => decodeURIComponent(h.getAttribute('data-mv-group')));
      const set = getClosedGroups();
      const anyOpen = keys.some((k) => !set.has(k));
      // مفتوح واحد على الأقل → اقفل الكل. كلهم مقفولين → افتح الكل.
      if (anyOpen) keys.forEach((k) => set.add(k));
      else keys.forEach((k) => set.delete(k));
      setClosedGroups(set);
      renderFromData();
    });
  }

  const repeat = document.getElementById('mv-repeat');
  if (repeat) repeat.addEventListener('click', () => openRepeatGradesDialog());

  const refresh = document.getElementById('mv-refresh');
  if (refresh) {
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      refresh.textContent = '🔄 بيحدّث…';
      await loadMovementStats(true);
      renderFromData();
    });
  }

  const back = document.getElementById('mv-backfill');
  if (back) back.addEventListener('click', () => safeAsync(() => backfillMovementFromLog(), 'حساب الحركة من السجل'));
}


// ============================================================
// ملء الحركة من السجل القديم
// ============================================================
// ⚠️ ده اللي بيخلّي التقرير شغّال **من أول يوم** بدل ما يبدأ من الصفر.
// السجل مابيتمسحش من أول ما النظام اشتغل، فكل تاريخ المحل لسه موجود —
// والزرار ده بيحوّله لأرقام.
//
// بيتقرا على صفحات بدل قراءة واحدة: السجل ممكن يكون عشرات الآلاف،
// وقراءة واحدة كبيرة بتوقّع التليفون. وبيتكتب على دفعات بـbatch عشان
// الكتابة تبقى ذرّية ومش ألف طلب منفصل.
// ⚠️ الصفحة 1000 مش 500: عدد المستندات اللي بتتقرا هو هو، بس عدد
// الرحلات للسحابة بينص. على بيانات الموبايل الرحلة بتاخد وقت أكتر من
// البيانات نفسها.
const MOVEMENT_PAGE = 1000;
const MOVEMENT_WRITE_BATCH = 400;
// أقل وقت بين رسمتين لشريط التقدم — من غيره الشاشة بتتعاد رسمها مع كل
// صفحة والتقدم نفسه بيبقى أبطأ من الشغل الحقيقي.
const MOVEMENT_TICK_MS = 500;

// سطر السجل → حركة. "بيع" = كمية الفرع قلّت، وبس.
function movementFromLogEntry(e) {
  if (!e || !e.categoryId || !e.gradeId) return null;
  const at = e.timestamp && e.timestamp.toDate ? e.timestamp.toDate() : null;
  if (!at) return null;

  // باقي العمليات (طلب تزويد، خلصت، رجعت متاحة…) حركة برضه — بتقول إن
  // حد لمس الدرجة دي، وده بالظبط عكس "راكدة" — بس مش بيع.
  const sold =
    e.action === 'edit' && e.field === 'branchQty'
      ? Math.max(0, (Number(e.oldValue) || 0) - (Number(e.newValue) || 0))
      : 0;

  return {
    key: gradeStatsId(e.categoryId, e.gradeId),
    categoryId: e.categoryId,
    categoryName: e.categoryName || '',
    gradeId: e.gradeId,
    gradeNumber: e.gradeNumber == null ? '' : String(e.gradeNumber),
    at,
    sold,
  };
}

async function backfillMovementFromLog() {
  if (movementBackfill) return;
  if (typeof db === 'undefined' || !db) return;

  const ok = confirm(
    'هيقرا سجل العمليات كله ويحوّله لأرقام حركة.\n\n' +
      '• بيحصل مرة واحدة بس\n' +
      '• مابيمسحش ولا بيغيّر أي حاجة في السجل\n' +
      '• سيب الشاشة مفتوحة لحد ما يخلص\n\nنبدأ؟'
  );
  if (!ok) return;

  movementBackfill = { done: 0, total: 0 };
  renderFromData();

  const acc = {}; // key → الملخص المتجمّع
  let last = null;
  let scanned = 0;
  let lastTick = 0;

  try {
    // ============================================================
    // ⭐⭐ العدّ بـcount() — مش بقراءة السجل كله
    // ============================================================
    // ⚠️ أول نسخة كانت بتعمل `.get()` على المجموعة كلها **عشان تعرف
    // العدد بس**، وبعدين تقراها تاني على صفحات. يعني السجل بيتقرا
    // **مرتين**: 12,554 عملية بقت 25,108 قراءة.
    //
    // ده مش بطء وبس — الحد المجاني 50,000 قراءة في اليوم، فالتشغيلة
    // الواحدة كانت بتاكل **نص اليوم**.
    //
    // count() بترجّع الرقم من السيرفر بقراءة واحدة تقريبًا. ولو مش
    // متاحة لأي سبب، بنكمّل من غير نسبة مئوية — التقدم بيعرض العدد
    // اللي اتقرا وبس، والشغل بيمشي عادي.
    try {
      const agg = await db.collection('activityLog').count().get();
      movementBackfill.total = Number(agg.data().count) || 0;
    } catch (err) {
      movementBackfill.total = 0;
    }

    for (;;) {
      let q = db.collection('activityLog').orderBy('timestamp', 'asc').limit(MOVEMENT_PAGE);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;

      snap.docs.forEach((d) => {
        scanned++;
        const m = movementFromLogEntry(d.data());
        if (!m) return;
        const cur = acc[m.key] || {
          categoryId: m.categoryId,
          categoryName: m.categoryName,
          gradeId: m.gradeId,
          gradeNumber: m.gradeNumber,
          lastMovedAt: null,
          lastSoldAt: null,
          soldTotal: 0,
          soldByMonth: {},
          moves: 0,
        };
        cur.moves++;
        if (m.categoryName) cur.categoryName = m.categoryName;
        if (m.gradeNumber) cur.gradeNumber = m.gradeNumber;
        if (!cur.lastMovedAt || m.at > cur.lastMovedAt) cur.lastMovedAt = m.at;
        if (m.sold > 0) {
          cur.soldTotal += m.sold;
          const mk = movementMonthKey(m.at);
          cur.soldByMonth[mk] = (cur.soldByMonth[mk] || 0) + m.sold;
          if (!cur.lastSoldAt || m.at > cur.lastSoldAt) cur.lastSoldAt = m.at;
        }
        acc[m.key] = cur;
      });

      movementBackfill.done = scanned;
      // الرسم مرة كل نص ثانية بالكتير — مش مع كل صفحة
      const now = Date.now();
      if (now - lastTick > MOVEMENT_TICK_MS) {
        lastTick = now;
        renderFromData();
      }

      last = snap.docs[snap.docs.length - 1];
      if (snap.size < MOVEMENT_PAGE) break;
    }

    // الكتابة — بنستبدل المستند بالكامل (مش merge) عشان الحساب ده هو
    // المرجع الكامل للتاريخ، ولو الزرار اتضغط تاني مايتضاعفش.
    const keys = Object.keys(acc);
    for (let i = 0; i < keys.length; i += MOVEMENT_WRITE_BATCH) {
      const batch = db.batch();
      keys.slice(i, i + MOVEMENT_WRITE_BATCH).forEach((k) => {
        const v = acc[k];
        batch.set(db.collection('gradeStats').doc(k), {
          categoryId: v.categoryId,
          categoryName: v.categoryName,
          gradeId: v.gradeId,
          gradeNumber: v.gradeNumber,
          gradeName: '',
          lastMovedAt: v.lastMovedAt ? firebase.firestore.Timestamp.fromDate(v.lastMovedAt) : null,
          lastSoldAt: v.lastSoldAt ? firebase.firestore.Timestamp.fromDate(v.lastSoldAt) : null,
          soldTotal: v.soldTotal,
          soldByMonth: v.soldByMonth,
          moves: v.moves,
        });
      });
      await batch.commit();
    }

    movementBackfill = null;
    await loadMovementStats(true);
    renderFromData();
    alert(`تمام — اتحسبت حركة ${keys.length} درجة من ${scanned} عملية في السجل.`);
  } catch (err) {
    movementBackfill = null;
    renderFromData();
    console.error('فشل حساب الحركة من السجل:', err);
    alert('حصلت مشكلة وإحنا بنقرا السجل. جرّب تاني — مافيش حاجة اتلخبطت.');
  }
}
