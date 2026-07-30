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
      renderUsersList();
    },
    (err) => console.warn('تعذّر قراءة قائمة المستخدمين:', err)
  );
}

function renderUsersList() {
  const el = document.getElementById('users-list');
  if (!el) return;

  const users = state.users || [];
  if (!users.length) {
    el.innerHTML = '<div style="font-size:12px; color:var(--text-secondary); padding:8px;">مفيش حسابات لسه.</div>';
    return;
  }

  el.innerHTML = `
    <table style="width:100%; font-size:12px; border-collapse:collapse;">
      <thead><tr>
        <th style="text-align:start; padding:6px;">الاسم</th>
        <th style="text-align:start; padding:6px;">الصلاحية</th>
        <th style="text-align:center; padding:6px;">تعديل</th>
      </tr></thead>
      <tbody>
        ${users
          .map((u) => {
            const isMe = u.id === state.user.uid;
            const access =
              u.role === ROLES.WAREHOUSE_KEEPER
                ? ` (${{ branch: 'الفرع', main: 'الرئيسي', both: 'الاتنين' }[u.warehouseAccess] || 'غير محدد'})`
                : '';
            return `<tr>
              <td style="padding:6px; border-top:1px solid var(--border);">
                ${escapeHTML(u.name || '—')}${isMe ? ' <span style="color:var(--text-muted);">(انت)</span>' : ''}
                ${u.loginName ? `<div style="font-size:10px; color:var(--text-muted);">${escapeHTML(u.loginName)}</div>` : ''}
              </td>
              <td style="padding:6px; border-top:1px solid var(--border);">
                ${escapeHTML(ROLE_LABELS_AR[u.role] || u.role || '—')}${escapeHTML(access)}
              </td>
              <td style="padding:6px; border-top:1px solid var(--border); text-align:center;">
                ${isMe ? '—' : `<button class="btn" style="padding:2px 8px; font-size:11px;" data-edit-user="${escapeHTML(u.id)}">تعديل</button>`}
              </td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;

  el.querySelectorAll('[data-edit-user]').forEach((btn) => {
    btn.addEventListener('click', () => editUserRole(btn.getAttribute('data-edit-user')));
  });
}

function roleSelectHTML(id, current) {
  return `
    <select class="input" id="${id}">
      ${Object.values(ROLES)
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

function openUserAdmin() {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:420px; width:100%; max-height:88vh; overflow:auto;">
      <div style="font-size:15px; font-weight:500; margin-bottom:12px;">حسابات المستخدمين</div>

      <div id="users-list" style="margin-bottom:16px;"></div>

      <div style="border-top:1px solid var(--border); padding-top:12px;">
        <div style="font-size:13px; font-weight:500; margin-bottom:8px;">➕ إضافة حساب جديد</div>
        <form id="add-user-form">
          <div class="field">
            <label>اسم الشخص</label>
            <input class="input" id="nu-name" required />
          </div>
          <div class="field">
            <label>اسم الدخول</label>
            <input class="input" id="nu-username" required autocomplete="off" placeholder="مثال: Test-Print" />
            <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;" id="nu-username-hint">
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
          <div class="field">
            <label style="display:flex; align-items:center; gap:8px; font-weight:normal;">
              <input type="checkbox" id="nu-remote-print" />
              يقدر يبعت طباعة لجهاز تاني
            </label>
          </div>
          <div id="nu-status" style="font-size:12px; margin-bottom:10px;"></div>
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn" type="button" id="users-close">إغلاق</button>
            <button class="btn btn-primary" type="submit" id="nu-submit">إنشاء الحساب</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    if (overlay.parentNode) document.body.removeChild(overlay);
  };
  document.getElementById('users-close').addEventListener('click', close);

  wireRoleVisibility('nu-role', 'nu-access-wrap');
  subscribeUsers();

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
    const canSendRemotePrint = document.getElementById('nu-remote-print').checked;

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
        canSendRemotePrint,
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

function editUserRole(uid) {
  const user = (state.users || []).find((u) => u.id === uid);
  if (!user) return;

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2100;padding:12px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:320px; width:100%;">
      <div style="font-size:14px; font-weight:500; margin-bottom:12px;">تعديل: ${escapeHTML(user.name || '')}</div>
      <div class="field">
        <label>اسم الشخص</label>
        <input class="input" id="eu-name" value="${escapeHTML(user.name || '')}" />
      </div>
      <div class="field">
        <label>الصلاحية</label>
        ${roleSelectHTML('eu-role', user.role)}
      </div>
      <div class="field" id="eu-access-wrap">
        <label>يعدّل في أنهي مخزن؟</label>
        ${accessSelectHTML('eu-access', user.warehouseAccess || 'branch')}
      </div>
      <div class="field">
        <label style="display:flex; align-items:center; gap:8px; font-weight:normal;">
          <input type="checkbox" id="eu-remote-print" ${user.canSendRemotePrint ? 'checked' : ''} />
          يقدر يبعت طباعة لجهاز تاني
        </label>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn" id="eu-cancel">إلغاء</button>
        <button class="btn btn-primary" id="eu-save">حفظ</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  wireRoleVisibility('eu-role', 'eu-access-wrap');
  const close = () => document.body.removeChild(overlay);
  document.getElementById('eu-cancel').addEventListener('click', close);

  document.getElementById('eu-save').addEventListener('click', async () => {
    const role = document.getElementById('eu-role').value;
    try {
      await db.collection('users').doc(uid).update({
        name: document.getElementById('eu-name').value.trim(),
        role,
        warehouseAccess: role === ROLES.WAREHOUSE_KEEPER ? document.getElementById('eu-access').value : null,
        canSendRemotePrint: document.getElementById('eu-remote-print').checked,
      });
      await logActivity({ action: 'edit_user', categoryName: user.name || '', newValue: role });
      close();
    } catch (err) {
      alert('تعذّر الحفظ: ' + (err.message || err));
    }
  });
}
