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
    return JSON.parse(localStorage.getItem(MOVEMENT_OPEN_KEY)) || { fast: true, idle: true };
  } catch (err) {
    return { fast: true, idle: true };
  }
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
function computeMovementReport() {
  const stats = movementStats || {};
  const days = getMovementDays();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const month = movementMonthKey();
  const catName = {};
  (state.categories || []).forEach((c) => (catName[c.id] = c.name));

  const grades = typeof allGradesCache !== 'undefined' && allGradesCache ? allGradesCache : null;
  if (!grades) return null;

  const fast = [];
  const idle = [];

  grades.forEach((g) => {
    if (!g.catId || !g.gradeId) return;
    const st = stats[gradeStatsId(g.catId, g.gradeId)] || null;
    const name = catName[g.catId] || (st && st.categoryName) || '';
    const label = `${name}${name ? ' — ' : ''}درجة ${g.name || g.number || ''}`;

    const soldMonth = st && st.soldByMonth ? Number(st.soldByMonth[month]) || 0 : 0;
    if (soldMonth > 0) fast.push({ label, qty: soldMonth, catId: g.catId });

    const moved = st ? movementToDate(st.lastMovedAt) : null;
    const movedMs = moved ? moved.getTime() : 0;
    if (movedMs < cutoff) {
      idle.push({
        label,
        catId: g.catId,
        since: moved,
        // من غير أي حركة مسجّلة خالص = مامتحركتش من ساعة ما اتعملت
        daysIdle: moved ? Math.floor((Date.now() - movedMs) / 86400000) : null,
        branchQty: Number(g.branchQty) || 0,
      });
    }
  });

  fast.sort((a, b) => b.qty - a.qty);
  // الأقدم الأول — دي اللي واقفة من أطول مدة
  idle.sort((a, b) => (b.daysIdle == null ? 1 : a.daysIdle == null ? -1 : b.daysIdle - a.daysIdle));

  return { days, month, fast, idle, total: grades.length, tracked: Object.keys(stats).length };
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

function movementRowsHTML(list, kind) {
  if (!list.length) {
    return `<div class="home-empty" style="padding:1rem; text-align:center;">${
      kind === 'fast' ? 'مفيش حاجة اتباعت الشهر ده لسه.' : 'مفيش درجات راكدة بالمدة دي — كله بيتحرك. 👌'
    }</div>`;
  }
  const rows = list
    .slice(0, MOVEMENT_LIST_CAP)
    .map((r) => {
      const right =
        kind === 'fast'
          ? `<span class="mv-qty">${escapeHTML(r.qty)}</span>`
          : `<span class="mv-idle">${r.daysIdle == null ? 'من غير حركة' : `${escapeHTML(r.daysIdle)} يوم`}</span>`;
      return `
      <div class="grade-card mv-row">
        <span class="mv-label">${escapeHTML(r.label)}</span>
        ${right}
      </div>`;
    })
    .join('');
  const more =
    list.length > MOVEMENT_LIST_CAP
      ? `<div class="mv-more">وفيه ${escapeHTML(list.length - MOVEMENT_LIST_CAP)} كمان — دي أول ${escapeHTML(MOVEMENT_LIST_CAP)}</div>`
      : '';
  return `<div class="grade-cards">${rows}</div>${more}`;
}

function movementScreenHTML() {
  const days = getMovementDays();
  const open = getMovementOpen();

  if (movementBackfill) {
    const pct = movementBackfill.total ? Math.round((movementBackfill.done / movementBackfill.total) * 100) : 0;
    return `
      <div style="padding:1rem;">
        <div class="card" style="padding:16px; text-align:center;">
          <div style="font-size:15px; font-weight:600; margin-bottom:8px;">📈 بيقرا السجل القديم…</div>
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
            ${escapeHTML(movementBackfill.done)} من ${escapeHTML(movementBackfill.total)} عملية — ${escapeHTML(pct)}%
          </div>
          <div class="mv-bar"><span style="width:${pct}%"></span></div>
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

  return `
    <div style="padding:1rem;">
      <div class="card" style="padding:12px; margin-bottom:12px;">
        <div style="font-size:15px; font-weight:600;">📈 حركة المخزون</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:4px; line-height:1.7;">
          إيه اللي بيسحب بسرعة، وإيه اللي واقف. الأرقام بتتجمّع لوحدها مع كل
          تعديل كمية — مافيش حاجة بتتحسب دلوقتي.
        </div>

        <div class="mv-days">
          <label for="mv-days-input">الدرجة تتحسب راكدة بعد</label>
          <input class="input" id="mv-days-input" type="number" min="1" max="3650"
                 inputmode="numeric" value="${escapeHTML(days)}" />
          <span>يوم</span>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">
          غيّر الرقم وهو بيتحفظ لوحده. مثال: ١٥ يوم، أو ٣٠، أو ٩٠.
        </div>

        <div class="mv-tools">
          <button class="btn" id="mv-refresh">🔄 حدّث الأرقام</button>
          <button class="btn" id="mv-backfill">📥 احسب من السجل القديم</button>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:8px; line-height:1.7;">
          متتبّع منها <strong>${escapeHTML(rep.tracked)}</strong> درجة من <strong>${escapeHTML(rep.total)}</strong>.
          لو الرقم قليل، دوس "احسب من السجل القديم" مرة واحدة عشان تاريخك كله يتحسب.
        </div>
      </div>

      ${movementSectionHTML('fast', '🔥', 'بتسحب بسرعة', rep.fast.length,
        `الأكتر بيعًا في شهر ${rep.month}`, movementRowsHTML(rep.fast, 'fast'), open.fast)}

      ${movementSectionHTML('idle', '🧊', 'راكدة', rep.idle.length,
        `مامتحركتش من ${days} يوم أو أكتر`, movementRowsHTML(rep.idle, 'idle'), open.idle)}
    </div>`;
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
const MOVEMENT_PAGE = 500;
const MOVEMENT_WRITE_BATCH = 400;

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

  try {
    // بنعدّ الأول عشان شريط التقدم يبقى ليه معنى
    try {
      const countSnap = await db.collection('activityLog').get();
      movementBackfill.total = countSnap.size;
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
      renderFromData();

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
