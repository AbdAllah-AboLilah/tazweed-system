// ============================================================
// إدارة حسابات المستخدمين من داخل النظام (للمدير بس)
// ============================================================
// قبل كده كان لازم تفتح Firebase Console وتعمل الحساب يدويًا وتكتب
// بياناته في users/{uid} بإيدك. الشاشة دي بتعمل الاتنين مرة واحدة.
//
// ملحوظة تقنية مهمة: إنشاء حساب جديد بـ createUserWithEmailAndPassword
// **بيسجّل دخول الحساب الجديد تلقائيًا** ويطلّع المدير من حسابه. عشان
// نتفاداها، بنعمل نسخة تانية منفصلة من Firebase (اسمها 'user-creator')
// وننشئ الحساب من خلالها — فجلسة المدير مبتتلمسش خالص.

let secondaryApp = null;

function getSecondaryAuth() {
  if (!secondaryApp) {
    secondaryApp = firebase.initializeApp(firebaseConfig, 'user-creator');
  }
  return secondaryApp.auth();
}

let unsubUsers = null;

function subscribeUsers() {
  if (unsubUsers) unsubUsers();
  unsubUsers = db.collection('users').onSnapshot(
    (snap) => {
      state.users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // الشاشة بترسم لوحدها من state — نفس منطق باقي الشاشات.
      if (state.view === 'dashboard' && state.screen === 'users') renderFromData();
    },
    (err) => console.warn('تعذّر قراءة قائمة المستخدمين:', err)
  );
}

// ============================================================
// شاشة الحسابات (شاشة كاملة، مش نافذة)
// ============================================================
// ليه شاشة كاملة؟ لأن جدول المفاتيح بقى 15 مفتاح في 5 مجموعات — ده مش
// بيدخل في نافذة صغيرة، وكنت هتفضل تمرّر جواها. والتاب بتاعها بيظهر
// **للي عنده مفتاح إدارة الحسابات بس**، فباقي الناس شاشتهم زي ما هي.
// ============================================================
// كارت الحساب — بديل صف الجدول على الموبايل
// ============================================================
// الجدول كان ٤ أعمدة (الاسم · الرتبة · المفاتيح · تعديل) في شاشة ٣٩٠
// بكسل، يعني كل عمود ٩٧ بكسل — الاسم بيتقص والرتبة بتتلزق.
//
// ⚠️ **نفس البيانات بالحرف** — نفس الاسم ونفس اسم الدخول ونفس الرتبة
// ونفس عدّاد المفاتيح ونفس زرار التعديل بنفس الـ`data-edit-user`، عشان
// attachUsersScreenEvents تلاقيه من غير أي تغيير.
// ============================================================
// خانة "الفئات" — يعدّل الكميات في أنهي فئات
// ============================================================
// ⚠️⚠️ **مافيش حاجة معلّمة = كل الفئات.** ده مقصود عشان كل الحسابات
// الموجودة دلوقتي تفضل زي ما هي — ولا واحد فيهم عنده الحقل ده أصلًا.
// لو خليناها "مافيش معلّم = مافيش فئات"، كل حساب في النظام كان هيتقفل
// عليه التعديل أول ما التحديث ينزل.
//
// ⚠️ القايمة ممكن تبقى طويلة على التليفون، فمعاها خانة بحث وزرار
// "علّم الكل" — من غيرهم اللف على ٤٠ فئة بالإيد مرهق.
function categoryAccessHTML(user) {
  const cats = (typeof state !== 'undefined' && state && state.categories) || [];
  const picked = Array.isArray(user.categoryAccess) ? user.categoryAccess.filter(Boolean) : [];
  const set = {};
  picked.forEach((id) => (set[id] = true));

  if (!cats.length) {
    return '<div style="font-size:12px; color:var(--text-muted);">مافيش فئات لسه.</div>';
  }

  const rows = cats
    .map(
      (c) => `
      <label class="cat-acc-row" data-cat-name="${escapeHTML((c.name || '').toLowerCase())}"
             style="display:flex; gap:8px; align-items:center; padding:7px 4px; border-bottom:1px solid var(--border); font-size:13px; cursor:pointer;">
        <input type="checkbox" data-cat-access="${escapeHTML(c.id)}" ${set[c.id] ? 'checked' : ''}
               style="flex:0 0 auto;" />
        <span>${escapeHTML(c.name || '—')}</span>
      </label>`
    )
    .join('');

  return `
    <input class="input" id="eu-cat-search" placeholder="🔍 دوّر على فئة..." style="margin-bottom:8px;" />
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <button type="button" class="btn" id="eu-cat-all" style="font-size:11px; padding:4px 10px; min-height:28px;">علّم الكل</button>
      <button type="button" class="btn" id="eu-cat-none" style="font-size:11px; padding:4px 10px; min-height:28px;">شيل الكل</button>
    </div>
    <div id="eu-cat-list" style="max-height:200px; overflow:auto; border:1px solid var(--border); border-radius:8px; padding:0 8px;">
      ${rows}
    </div>
    <div id="eu-cat-count" style="font-size:11px; color:var(--text-secondary); margin-top:6px;"></div>`;
}

// أسامي اللي شغّالين على الحساب المشترك.
// ⚠️ قراءة **مرة واحدة** لما النافذة تفتح — مافيش استماع مباشر، عشان
// ما نزوّدش أي حِمل على النظام. الشرح الكامل عند publishOperatorName.
async function loadOperatorNames(uid) {
  try {
    const snap = await db.collection('users').doc(uid).collection('operators').get();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
  } catch (err) {
    console.warn('تعذّرت قراءة أسماء الحساب المشترك:', err);
    return null;
  }
}

function operatorListHTML(list) {
  if (list === null) return '<span style="color:var(--text-muted);">تعذّرت القراءة.</span>';
  if (!list.length) {
    return '<span style="color:var(--text-muted);">لسه محدش كتب اسمه على الحساب ده.</span>';
  }
  return list
    .map((o) => {
      let when = '';
      try {
        const d = o.lastSeen && typeof o.lastSeen.toDate === 'function' ? o.lastSeen.toDate() : null;
        if (d) when = ` — آخر مرة ${d.toLocaleDateString('ar-EG')}`;
      } catch (err) {}
      return `<div style="padding:3px 0;">👤 ${escapeHTML(o.name || o.id)}<span style="color:var(--text-muted); font-size:11px;">${escapeHTML(when)}</span></div>`;
    })
    .join('');
}

function userCardsHTML(users, me) {
  return users
    .map((u) => {
      const isMe = u.id === me;
      const owner = isOwner(u);
      const access =
        u.warehouseAccess && can(u, 'editBranchQty') !== can(u, 'editMainQty')
          ? ''
          : u.warehouseAccess
            ? ` (${{ branch: 'الفرع', main: 'الرئيسي', both: 'الاتنين' }[u.warehouseAccess] || ''})`
            : '';
      const customCount = u.perms ? Object.keys(u.perms).length : 0;
      const catN = Array.isArray(u.categoryAccess) ? u.categoryAccess.filter(Boolean).length : 0;
      return `
      <div class="grade-card">
        <div class="gc-head">
          <span class="gc-num">
            ${owner ? '⭐ ' : ''}${escapeHTML(u.name || '—')}${isMe ? ' <span style="color:var(--text-muted); font-weight:400; font-size:13px;">(انت)</span>' : ''}${u.sharedAccount ? ' <span class="badge badge-purple">مشترك</span>' : ''}
          </span>
          <button class="btn" style="padding:4px 12px; font-size:12px; min-height:32px;" data-edit-user="${escapeHTML(u.id)}">تعديل</button>
        </div>
        ${
          u.loginName
            ? `<div class="gc-line"><span class="gc-label">اسم الدخول</span>
                 <span style="direction:ltr; font-size:13px;">${escapeHTML(u.loginName)}</span></div>`
            : ''
        }
        <div class="gc-line">
          <span class="gc-label">الرتبة</span>
          <span style="font-size:14px; font-weight:500;">${escapeHTML(ROLE_LABELS_AR[u.role] || u.role || '—')}${escapeHTML(access)}</span>
        </div>
        ${
          catN
            ? `<div class="gc-line"><span class="gc-label">الفئات</span>
                 <span class="badge badge-purple">${escapeHTML(catN)} فئة بس</span></div>`
            : ''
        }
        <div class="gc-line" style="margin-bottom:0;">
          <span class="gc-label">المفاتيح</span>
          <span>${
            customCount
              ? `<span class="badge badge-purple">${escapeHTML(customCount)} مُعدّل</span>`
              : '<span style="color:var(--text-muted); font-size:13px;">القالب</span>'
          }</span>
        </div>
      </div>`;
    })
    .join('');
}

function usersScreenHTML() {
  const users = state.users || [];
  const me = state.user ? state.user.uid : '';

  const rows = users
    .map((u) => {
      const isMe = u.id === me;
      const owner = isOwner(u);
      const access =
        u.warehouseAccess && can(u, 'editBranchQty') !== can(u, 'editMainQty')
          ? ''
          : u.warehouseAccess
            ? ` (${{ branch: 'الفرع', main: 'الرئيسي', both: 'الاتنين' }[u.warehouseAccess] || ''})`
            : '';
      // عدد المفاتيح اللي اتغيّرت عن قالب رتبته — عشان تشوف بسرعة مين
      // عنده استثناءات.
      const customCount = u.perms ? Object.keys(u.perms).length : 0;
      return `
      <tr>
        <td>
          <strong>${escapeHTML(u.name || '—')}</strong>${isMe ? ' <span style="color:var(--text-muted);">(انت)</span>' : ''}${u.sharedAccount ? ' <span class="badge badge-purple">مشترك</span>' : ''}
          ${u.loginName ? `<div style="font-size:11px; color:var(--text-muted); direction:ltr; text-align:start;">${escapeHTML(u.loginName)}</div>` : ''}
        </td>
        <td style="white-space:nowrap;">
          ${owner ? '⭐ ' : ''}${escapeHTML(ROLE_LABELS_AR[u.role] || u.role || '—')}${escapeHTML(access)}
        </td>
        <td style="text-align:center;">
          ${customCount ? `<span class="badge badge-purple">${escapeHTML(customCount)} مُعدّل</span>` : '<span style="color:var(--text-muted); font-size:12px;">القالب</span>'}
        </td>
        <td style="text-align:center; white-space:nowrap;">
          <button class="btn" style="padding:3px 10px; font-size:12px;" data-edit-user="${escapeHTML(u.id)}">تعديل</button>
        </td>
      </tr>`;
    })
    .join('');

  const cards = state.isNarrow ? userCardsHTML(users, me) : '';

  const myProfile = users.find((u) => u.id === me) || state.profile || {};
  const iAmOwner = isOwner(myProfile);

  // ============================================================
  // ⭐ كارت صاحب الحساب — فوق، مش سطر وسط الباقيين
  // ============================================================
  // رتبة "منشئ النظام" كانت ⭐ صغيرة جنب كلمة وسط الجدول، ومعرّف
  // الحساب كارت رمادي تحت الشاشة خالص. الاتنين بقوا كارت واحد فوق:
  // الرتبة واضحة، والمعرّف جوّاه مع زرار النسخ.
  //
  // ⚠️ ده **شكل بس**. الصلاحيات والرتب وطريقة إضافة/تعديل الحسابات
  // زي ما هي بالحرف.
  const ownerCardHTML = `
    <div class="card owner-card">
      <div class="owner-head">
        <span class="owner-mark">${iAmOwner ? '👑' : '👤'}</span>
        <span class="owner-who">
          <b>${escapeHTML(myProfile.name || state.profile?.name || '')}</b>
          <small>${escapeHTML(ROLE_LABELS_AR[myProfile.role] || myProfile.role || '')}</small>
        </span>
      </div>
      ${
        iAmOwner
          ? `<div class="owner-protected">🔒 رتبة محمية — مش بتتغيّر من جوّه النظام</div>`
          : ''
      }
      <div class="owner-uid-label">🔑 معرّف حسابك</div>
      <div class="owner-uid-note">
        الرقم ده هو اللي بيربط رتبة "منشئ النظام" بحسابك في قواعد الأمان،
        فمحدش يقدر ينزّل رتبتك ولا يحذف حسابك.
      </div>
      <div class="owner-uid-row">
        <code id="my-uid">${escapeHTML(me)}</code>
        <button class="btn" id="copy-uid-btn">📋 نسخ</button>
      </div>
    </div>`;

  return `
    <div style="padding:1rem;">
      ${ownerCardHTML}
      <div class="card" style="padding:12px; margin-bottom:12px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;">
            <div style="font-size:15px; font-weight:500;">👥 حسابات المستخدمين</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px; line-height:1.7;">
              الرتبة بتملا المفاتيح تلقائيًا، وتقدر تفتح أو تقفل مفتاح واحد
              لشخص واحد من غير ما تغيّر رتبته.
            </div>
          </div>
          <button class="btn btn-primary" id="add-user-btn">➕ حساب جديد</button>
        </div>
      </div>

      ${
        users.length
          ? state.isNarrow
            ? `<div class="grade-cards" data-keep-scroll="users">${cards}</div>`
            : `<div class="card" data-keep-scroll="users" style="padding:0; overflow:auto;">
               <table>
                 <thead><tr>
                   <th class="sticky-th">الاسم</th>
                   <th class="sticky-th">الرتبة</th>
                   <th class="sticky-th">المفاتيح</th>
                   <th class="sticky-th"></th>
                 </tr></thead>
                 <tbody>${rows}</tbody>
               </table>
             </div>`
          : `<div class="home-empty" style="padding:2rem; text-align:center;">جارٍ تحميل الحسابات...</div>`
      }

    </div>`;
}

function attachUsersScreenEvents() {
  const addBtn = document.getElementById('add-user-btn');
  if (addBtn) addBtn.addEventListener('click', () => openAddUserDialog());

  document.querySelectorAll('[data-edit-user]').forEach((btn) => {
    btn.addEventListener('click', () => editUserRole(btn.getAttribute('data-edit-user')));
  });

  const copyBtn = document.getElementById('copy-uid-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const uid = (document.getElementById('my-uid') || {}).textContent || '';
      // navigator.clipboard مش شغّال على كل المتصفحات/الاتصالات، فبنعمل
      // بديل يدوي بيحدّد النص عشان المستخدم ينسخه بنفسه.
      const done = () => { copyBtn.textContent = '✅ اتنسخ'; setTimeout(() => (copyBtn.textContent = '📋 نسخ'), 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(uid).then(done).catch(() => selectUid());
      } else {
        selectUid();
      }
      function selectUid() {
        const el = document.getElementById('my-uid');
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }
}

function roleSelectHTML(id, current) {
  return `
    <select class="input" id="${id}">
      ${ASSIGNABLE_ROLES.concat(current === ROLES.ADMIN ? [ROLES.ADMIN] : [])
        .map((r) => `<option value="${r}" ${r === current ? 'selected' : ''}>${escapeHTML(ROLE_LABELS_AR[r])}</option>`)
        .join('')}
    </select>`;
}

function accessSelectHTML(id, current) {
  const opts = { branch: 'مخزن الفرع بس', main: 'المخزن الرئيسي بس', both: 'الاتنين' };
  return `
    <select class="input" id="${id}">
      ${Object.entries(opts)
        .map(([v, label]) => `<option value="${v}" ${v === current ? 'selected' : ''}>${escapeHTML(label)}</option>`)
        .join('')}
    </select>`;
}

// بيظهر/بيخفي خانة "يعدّل في أنهي مخزن" حسب الرتبة المختارة —
// الخانة دي ليها معنى مع أمين المخزن بس.
function wireRoleVisibility(roleId, wrapId) {
  const roleEl = document.getElementById(roleId);
  const wrapEl = document.getElementById(wrapId);
  const sync = () => {
    wrapEl.style.display = roleEl.value === ROLES.WAREHOUSE_KEEPER ? 'block' : 'none';
  };
  roleEl.addEventListener('change', sync);
  sync();
}

function openAddUserDialog() {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:420px; width:100%; max-height:88vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:12px;">➕ إضافة حساب جديد</div>
      <div>
        <form id="add-user-form">
          <div class="field">
            <label>اسم الشخص</label>
            <input class="input" id="nu-name" required />
          </div>
          <div class="field">
            <label>اسم الدخول</label>
            <input class="input" id="nu-username" required autocomplete="off" placeholder="مثال: Test-Print" />
            <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
              اكتب أي اسم عادي — النظام بيكمّل الباقي لوحده. لو عايز تستخدم
              إيميل حقيقي، اكتبه كامل وهو هيتقبل زي ما هو.
            </div>
          </div>
          <div class="field">
            <label>الباسورد (٦ حروف على الأقل)</label>
            <input class="input" type="text" id="nu-password" required minlength="6" autocomplete="off" />
            <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
              الباسورد ظاهر عمدًا عشان تقدر تكتبه وتديه للموظف
            </div>
          </div>
          <div class="field">
            <label>الصلاحية</label>
            ${roleSelectHTML('nu-role', ROLES.USER)}
          </div>
          <div class="field" id="nu-access-wrap">
            <label>يعدّل في أنهي مخزن؟</label>
            ${accessSelectHTML('nu-access', 'branch')}
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-bottom:10px; line-height:1.7;">
            الحساب هياخد مفاتيح رتبته تلقائيًا. تقدر تعدّل أي مفتاح لوحده
            بعد ما تعمله، من زرار "تعديل" في القايمة.
          </div>
          <div id="nu-status" style="font-size:12px; margin-bottom:10px;"></div>
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn" type="button" id="users-close">إلغاء</button>
            <button class="btn btn-primary" type="submit" id="nu-submit">إنشاء الحساب</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('users-close').addEventListener('click', close);

  wireRoleVisibility('nu-role', 'nu-access-wrap');

  document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('nu-status');
    const submitBtn = document.getElementById('nu-submit');
    const name = document.getElementById('nu-name').value.trim();
    const username = document.getElementById('nu-username').value.trim();
    const email = usernameToEmail(username);
    const password = document.getElementById('nu-password').value;
    const role = document.getElementById('nu-role').value;
    const warehouseAccess = role === ROLES.WAREHOUSE_KEEPER ? document.getElementById('nu-access').value : null;

    if (!email) {
      statusEl.style.color = 'var(--danger-text)';
      statusEl.textContent = 'اسم الدخول لازم يكون فيه حروف أو أرقام.';
      return;
    }

    submitBtn.disabled = true;
    statusEl.style.color = 'var(--text-secondary)';
    statusEl.textContent = 'جارٍ إنشاء الحساب...';

    let created = null;
    try {
      // النسخة التانية من Firebase — عشان جلسة المدير متتلمسش
      const secondaryAuth = getSecondaryAuth();
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      created = cred.user;

      await db.collection('users').doc(created.uid).set({
        name,
        role,
        warehouseAccess,
        // اسم الدخول بيتحفظ عشان المدير يفتكره ويقدر يديه للموظف تاني
        loginName: emailToUsername(email),
      });

      await secondaryAuth.signOut();
      await logActivity({ action: 'add_user', categoryName: name, newValue: role });

      statusEl.style.color = 'var(--ok)';
      statusEl.textContent = `✅ اتعمل حساب "${name}". اسم الدخول: ${emailToUsername(email)} — والباسورد اللي كتبته.`;
      document.getElementById('add-user-form').reset();
      wireRoleVisibility('nu-role', 'nu-access-wrap');
    } catch (err) {
      console.error(err);
      const messages = {
        'auth/email-already-in-use': 'اسم الدخول ده مستخدم في حساب تاني — اختار اسم غيره.',
        'auth/invalid-email': 'اسم الدخول فيه حروف مش مقبولة. استخدم حروف إنجليزي وأرقام و- و. بس.',
        'auth/weak-password': 'الباسورد ضعيف — لازم ٦ حروف على الأقل.',
      };
      statusEl.style.color = 'var(--danger-text)';
      statusEl.textContent = '⚠️ ' + (messages[err.code] || err.message || 'حصل خطأ.');

      // لو الحساب اتعمل بس صف البيانات فشل، منسيبش حساب يتيم من غير صلاحيات.
      if (created) {
        try { await created.delete(); } catch (e) { /* الحساب هيتشال يدويًا */ }
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ============================================================
// تعديل حساب: الرتبة + المفاتيح واحد واحد
// ============================================================
// كل مفتاح ليه 3 حالات مش 2:
//   • "زي الرتبة"  → مفيش استثناء متسجّل، بيمشي مع القالب حتى لو غيّرت
//                     الرتبة بعدين
//   • "مفتوح"      → استثناء بفتح
//   • "مقفول"      → استثناء بقفل
//
// التفرقة دي مهمة: لو خزّنّا كل المفاتيح كقيم ثابتة، تغيير الرتبة بعد كده
// مش هيغيّر أي حاجة — والمستخدم هيفتكر إنه غيّر الصلاحيات وهو مغيّرش.
function permissionRowsHTML(user) {
  const perms = user.perms || {};
  return PERMISSION_GROUPS.map(
    (g) => `
    <div style="margin-bottom:14px;">
      <div style="font-size:12px; font-weight:500; color:var(--text-secondary); margin-bottom:6px;">${escapeHTML(g.name)}</div>
      ${g.items
        .map((item) => {
          const stored = typeof perms[item.key] === 'boolean' ? String(perms[item.key]) : '';
          const fromRole = !!(ROLE_PRESETS[user.role] && ROLE_PRESETS[user.role][item.key]);
          return `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--border);">
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px;">${item.danger ? '🔴 ' : ''}${escapeHTML(item.label)}</div>
            ${item.hint ? `<div style="font-size:10px; color:var(--text-muted);">${escapeHTML(item.hint)}</div>` : ''}
          </div>
          <select class="input" style="width:120px; padding:4px 6px; font-size:12px;" data-perm="${escapeHTML(item.key)}">
            <option value="" ${stored === '' ? 'selected' : ''}>زي الرتبة (${fromRole ? 'مفتوح' : 'مقفول'})</option>
            <option value="true" ${stored === 'true' ? 'selected' : ''}>مفتوح</option>
            <option value="false" ${stored === 'false' ? 'selected' : ''}>مقفول</option>
          </select>
        </div>`;
        })
        .join('')}
    </div>`
  ).join('');
}

function editUserRole(uid) {
  const user = (state.users || []).find((u) => u.id === uid);
  if (!user) return;

  const isMe = state.user && uid === state.user.uid;
  const targetIsOwner = isOwner(user);
  // ⚠️ منشئ النظام محمي: محدش يقدر ينزّل رتبته — ولا هو بنفسه بالغلط.
  // ده مش تجميل: من غيره أي مدير يقدر يقفل صاحب المحل بره نظامه.
  const lockRole = targetIsOwner;

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2100;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:440px; width:100%; max-height:90vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:2px;">
        تعديل: ${escapeHTML(user.name || '')}${isMe ? ' (انت)' : ''}
      </div>
      ${user.loginName ? `<div style="font-size:11px; color:var(--text-muted); direction:ltr; text-align:start; margin-bottom:12px;">${escapeHTML(user.loginName)}</div>` : '<div style="margin-bottom:12px;"></div>'}

      <div class="field">
        <label>اسم الشخص</label>
        <input class="input" id="eu-name" value="${escapeHTML(user.name || '')}" />
      </div>
      <div class="field">
        <label>الرتبة</label>
        ${lockRole
          ? `<input class="input" value="${escapeHTML(ROLE_LABELS_AR[user.role] || user.role)}" disabled />
             <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
               ⭐ رتبة منشئ النظام محمية — مش بتتغيّر من جوه النظام.
             </div>`
          : roleSelectHTML('eu-role', user.role)}
      </div>
      <div class="field" id="eu-access-wrap">
        <label>يعدّل في أنهي مخزن؟</label>
        ${accessSelectHTML('eu-access', user.warehouseAccess || 'branch')}
      </div>

      <div class="field">
        <label>يعدّل الكميات في أنهي فئات؟</label>
        <div style="font-size:11px; color:var(--text-secondary); margin:2px 0 8px; line-height:1.7;">
          <strong>سيبها كلها فاضية = كل الفئات.</strong> علّم على فئات معيّنة
          عشان تقفل عليه التعديل في اللي غيرها.
          <br>دي على <strong>الكميات بس</strong> (يزوّد وينقّص، ومعاها طلب
          التزويد والرد عليه). إضافة الدرجات وتعديل الفئة نفسها بمفاتيحهم تحت.
        </div>
        ${categoryAccessHTML(user)}
      </div>

      <div class="field">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="eu-shared" ${user.sharedAccount ? 'checked' : ''} />
          <span>حساب مشترك (أكتر من شخص بيستخدمه)</span>
        </label>
        <div style="font-size:11px; color:var(--text-secondary); margin-top:4px; line-height:1.7;">
          لما تعلّمها، أي جهاز يدخل بالحساب ده هيتساله مرة واحدة عن اسم اللي
          ماسكه. الاسم بيتحفظ على الجهاز نفسه، وبيتكتب جنب اسم الحساب فوق
          ومع كل حركة في السجل — عشان تعرف مين عمل إيه.
        </div>
        ${user.sharedAccount ? `
        <div style="margin-top:8px; padding:8px; background:var(--surface-muted); border-radius:8px; font-size:12px; line-height:1.8;">
          <div style="font-weight:500; margin-bottom:4px;">👥 اللي شغّالين على الحساب ده</div>
          <div id="eu-operators"><span style="color:var(--text-muted);">بيحمّل...</span></div>
        </div>` : ''}
      </div>

      <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:4px;">
        <div style="font-size:13px; font-weight:500; margin-bottom:2px;">🔑 المفاتيح</div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:10px; line-height:1.7;">
          سيبها "زي الرتبة" عشان تفضل تمشي مع القالب لو غيّرت الرتبة بعدين.
        </div>
        <div id="eu-perms">${permissionRowsHTML(user)}</div>
      </div>

      <div style="display:flex; gap:8px; justify-content:space-between; align-items:center; margin-top:12px;">
        <button class="btn" id="eu-reset" style="font-size:12px;">إرجاع الكل لقالب الرتبة</button>
        <span style="display:flex; gap:8px;">
          <button class="btn" id="eu-cancel">إلغاء</button>
          <button class="btn btn-primary" id="eu-save">حفظ</button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  if (!lockRole) {
    wireRoleVisibility('eu-role', 'eu-access-wrap');
    // تغيير الرتبة بيعيد رسم المفاتيح عشان "زي الرتبة" توري القيمة الجديدة
    document.getElementById('eu-role').addEventListener('change', (e) => {
      document.getElementById('eu-perms').innerHTML = permissionRowsHTML({ ...user, role: e.target.value, perms: readPerms() });
    });
  }

  function readPerms() {
    const out = {};
    overlay.querySelectorAll('[data-perm]').forEach((sel) => {
      if (sel.value === 'true') out[sel.getAttribute('data-perm')] = true;
      else if (sel.value === 'false') out[sel.getAttribute('data-perm')] = false;
    });
    return out;
  }

  // ------------------------------------------------------------
  // خانة الفئات: البحث، علّم/شيل الكل، والعدّاد
  // ------------------------------------------------------------
  function readCategoryAccess() {
    const out = [];
    overlay.querySelectorAll('[data-cat-access]').forEach((cb) => {
      if (cb.checked) out.push(cb.getAttribute('data-cat-access'));
    });
    return out;
  }

  function refreshCatCount() {
    const el = overlay.querySelector('#eu-cat-count');
    if (!el) return;
    const n = readCategoryAccess().length;
    const total = overlay.querySelectorAll('[data-cat-access]').length;
    // ⚠️ الرسالة دي مهمة: من غيرها المستخدم مش هيعرف إن "مافيش معلّم"
    // معناها **كل الفئات** مش **مافيش فئات** — وده عكس المتوقع تمامًا.
    el.innerHTML = n
      ? `معلّم <strong>${escapeHTML(n)}</strong> من ${escapeHTML(total)} — التعديل مقفول في الباقي.`
      : '<strong>مافيش حاجة معلّمة = كل الفئات مفتوحة.</strong>';
  }

  const catSearch = overlay.querySelector('#eu-cat-search');
  if (catSearch) {
    catSearch.addEventListener('input', () => {
      const q = (catSearch.value || '').trim().toLowerCase();
      overlay.querySelectorAll('.cat-acc-row').forEach((row) => {
        row.hidden = !!q && (row.getAttribute('data-cat-name') || '').indexOf(q) === -1;
      });
    });
  }
  const catAll = overlay.querySelector('#eu-cat-all');
  const catNone = overlay.querySelector('#eu-cat-none');
  // ⚠️ "علّم الكل" بيشتغل على **اللي ظاهر بعد البحث** بس — لو شغّل على
  // الكل وانت فلتر، هتعلّم فئات انت مش شايفها ومش قاصدها.
  if (catAll) {
    catAll.addEventListener('click', () => {
      overlay.querySelectorAll('.cat-acc-row').forEach((row) => {
        if (row.hidden) return;
        const cb = row.querySelector('[data-cat-access]');
        if (cb) cb.checked = true;
      });
      refreshCatCount();
    });
  }
  if (catNone) {
    catNone.addEventListener('click', () => {
      overlay.querySelectorAll('.cat-acc-row').forEach((row) => {
        if (row.hidden) return;
        const cb = row.querySelector('[data-cat-access]');
        if (cb) cb.checked = false;
      });
      refreshCatCount();
    });
  }
  overlay.querySelectorAll('[data-cat-access]').forEach((cb) => cb.addEventListener('change', refreshCatCount));
  refreshCatCount();

  // أسامي الحساب المشترك — قراءة مرة واحدة، والنافذة مابتستنّاهاش.
  const opsBox = overlay.querySelector('#eu-operators');
  if (opsBox) {
    loadOperatorNames(uid).then((list) => {
      if (opsBox.isConnected !== false) opsBox.innerHTML = operatorListHTML(list);
    });
  }

  const close = () => { if (overlay.parentNode) document.body.removeChild(overlay); };
  document.getElementById('eu-cancel').addEventListener('click', close);
  document.getElementById('eu-reset').addEventListener('click', () => {
    overlay.querySelectorAll('[data-perm]').forEach((sel) => (sel.value = ''));
  });

  document.getElementById('eu-save').addEventListener('click', async () => {
    const role = lockRole ? user.role : document.getElementById('eu-role').value;
    const perms = readPerms();
    try {
      await db.collection('users').doc(uid).update({
        name: document.getElementById('eu-name').value.trim(),
        role,
        warehouseAccess: document.getElementById('eu-access').value,
        sharedAccount: document.getElementById('eu-shared').checked,
        categoryAccess: readCategoryAccess(),
        perms,
      });
      await logActivity({ action: 'edit_user', categoryName: user.name || '', newValue: role });
      close();
    } catch (err) {
      alert('تعذّر الحفظ: ' + (err.message || err));
    }
  });
}
