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
          <strong>${escapeHTML(u.name || '—')}</strong>${isMe ? ' <span style="color:var(--text-muted);">(انت)</span>' : ''}
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

  return `
    <div style="padding:1rem;">
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
          ? `<div class="card" data-keep-scroll="users" style="padding:0; overflow:auto;">
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

      <div class="card" style="padding:12px; margin-top:12px;">
        <div style="font-size:13px; font-weight:500; margin-bottom:6px;">🔑 معرّف حسابك</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px; line-height:1.7;">
          الرقم ده هو اللي بيربط رتبة "منشئ النظام" بحسابك في قواعد الأمان،
          فمحدش يقدر ينزّل رتبتك ولا يحذف حسابك.
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <code style="flex:1; min-width:180px; direction:ltr; text-align:start; font-size:12px;
                       background:var(--surface-muted); padding:8px; border-radius:8px; overflow-wrap:anywhere;"
                id="my-uid">${escapeHTML(me)}</code>
          <button class="btn" id="copy-uid-btn">📋 نسخ</button>
        </div>
      </div>
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

      statusEl.style.color = '#2e7d32';
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
        perms,
      });
      await logActivity({ action: 'edit_user', categoryName: user.name || '', newValue: role });
      close();
    } catch (err) {
      alert('تعذّر الحفظ: ' + (err.message || err));
    }
  });
}
