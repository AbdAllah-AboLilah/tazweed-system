// تسجيل التليفون لإشعارات "والنظام مقفول"
// ============================================================
// الإشعار القديم بيشتغل والنظام مفتوح بس. ده بيسجّل التليفون في
// السحابة عشان الدالة تبعتله حتى وهو مقفول.
//
// ⚠️⚠️ أخطر تلات حاجات هنا **مش** التسجيل نفسه:
//   ١) لو التسجيل فشل، الإشعار المحلي لازم يفضل شغّال زي ما هو.
//   ٢) الجهاز بيكتب `wantsRestock` بنفسه — فلازم يحدّثها لما الصلاحية
//      تتقفل، وإلا يفضل يرن بعد ما اتقفلت عنه.
//   ٣) من غير مفتاح الإشعارات (VAPID) مافيش تسجيل — ولازم يتقال ليه.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 200)}` : ''));

// الـService Worker بتاع الإشعارات لازم يكون موجود فعلًا — الرابط
// نسبي، ولو الملف مش موجود التسجيل بيفشل من غير أي رسالة مفهومة.
check('⭐⭐ ملف الـService Worker بتاع الإشعارات موجود',
  fs.existsSync(path.join(root, 'firebase-messaging-sw.js')));
// ⚠️ وبيستورد **ملف القيم** مش firebase-config.js: التاني بينده
// firebase.auth() اللي مش موجود جوه الـWorker، فبيوقّعه.
const swSrc = fs.readFileSync(path.join(root, 'firebase-messaging-sw.js'), 'utf8');
check('⭐⭐⭐⭐ وبياخد القيم من الملف اللي مافيهوش auth (وإلا الـWorker بيقع)',
  swSrc.includes('firebase-config-values.js') && !swSrc.includes("importScripts('./firebase-config.js')"));
check('⭐⭐ وبيستخدم نفس وسم الإشعار المحلي (عشان مايكوّمش إشعارات)',
  swSrc.includes('tazweed-restock'));
// نسخة المكتبة في الـWorker لازم تطابق اللي في الصفحة
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ver = (idx.match(/firebasejs\/([\d.]+)\//) || [])[1];
check(`⭐⭐⭐ نسخة Firebase في الـWorker نفس اللي في الصفحة (${ver})`,
  !!ver && swSrc.includes(`firebasejs/${ver}/`), ver);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof registerPushDevice === 'function' && typeof syncPushAudience === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    const writes = [];
    state.user = { uid: 'u1' };
    state.profile = { name: 'أمين', role: 'warehouse_keeper', warehouseAccess: 'main' };
    window.db = {
      collection: (c) => ({
        doc: (d) => ({
          set: (data, opts) => { writes.push({ path: c + '/' + d, data, opts }); return Promise.resolve(); },
        }),
      }),
    };
    // ⚠️ Notification مش موجود في المتصفح المعزول — بنركّبه
    window.Notification = { permission: 'granted', requestPermission: async () => 'granted' };
    let gotTokenCalls = 0;
    window.firebase = {
      messaging: () => ({
        getToken: async () => { gotTokenCalls++; return 'TOK123'; },
      }),
      firestore: { FieldValue: { serverTimestamp: () => 'TS' } },
    };
    navigator.serviceWorker.register = async () => ({ scope: 'x' });

    const reset = () => { writes.length = 0; gotTokenCalls = 0; };

    // ---------- من غير مفتاح VAPID: مافيش تسجيل، وبسبب واضح ----------
    window.FIREBASE_VAPID_KEY = '';
    reset();
    out.noKeyToken = await registerPushDevice();
    out.noKeyWrites = writes.length;
    out.noKeyReason = pushBlockedReason();

    // ---------- بالمفتاح: بيسجّل ----------
    window.FIREBASE_VAPID_KEY = 'BFakeKey';
    setNotifyEnabled(true);
    reset();
    out.token = await registerPushDevice();
    out.wrote = writes[0] ? writes[0].path : '';
    out.data = writes[0] ? writes[0].data : null;
    out.merged = !!(writes[0] && writes[0].opts && writes[0].opts.merge);

    // ============================================================
    // ⭐⭐⭐⭐ الصلاحية اتقفلت → الجهاز بيقول للسحابة فورًا
    // ============================================================
    state.profile = { name: 'موظف', role: 'print_operator' };
    reset();
    syncPushAudience();
    await new Promise((res) => setTimeout(res, 20));
    out.afterLock = writes[0] ? writes[0].data.wantsRestock : null;

    // ---------- المستخدم قفل الإشعارات بنفسه ----------
    state.profile = { name: 'أمين', role: 'warehouse_keeper', warehouseAccess: 'main' };
    reset();
    disableRestockNotifications();
    await new Promise((res) => setTimeout(res, 20));
    out.afterUserOff = writes[0] ? writes[0].data.wantsRestock : null;

    // ============================================================
    // ⭐⭐⭐⭐ التسجيل فشل → الإشعار المحلي لازم يفضل شغّال
    // ============================================================
    setNotifyEnabled(false);
    window.firebase.messaging = () => ({ getToken: async () => { throw new Error('مفيش نت'); } });
    reset();
    const ok = await enableRestockNotifications();
    out.enabledDespiteFailure = ok === true && notifyEnabled() === true;
    out.stateAfterFailure = restockNotifyState();

    setNotifyEnabled(false);
    return out;
  });

  check('⭐⭐⭐⭐ من غير مفتاح الإشعارات → مافيش تسجيل ومافيش كتابة',
    r.noKeyToken === '' && r.noKeyWrites === 0, [r.noKeyToken, r.noKeyWrites]);
  check('⭐⭐⭐ وبيقول السبب بالنص (مش سكوت)',
    /مفتاح الإشعارات/.test(r.noKeyReason || ''), r.noKeyReason);

  check('⭐⭐⭐ بالمفتاح: بيسجّل التوكن', r.token === 'TOK123', r.token);
  check('⭐⭐⭐ وبيكتبه في pushTokens باسم التوكن نفسه',
    r.wrote === 'pushTokens/TOK123', r.wrote);
  check('⭐⭐⭐⭐ وبيكتب uid بتاعه (القاعدة بترفض أي uid تاني)',
    !!r.data && r.data.uid === 'u1', r.data);
  check('⭐⭐⭐ وبيعلّم إنه عايز إشعارات التزويد',
    !!r.data && r.data.wantsRestock === true, r.data);
  check('⭐⭐ وبـmerge عشان مايمسحش حقول تانية', r.merged === true, r.merged);

  check('⭐⭐⭐⭐ الصلاحية اتقفلت → الجهاز بيبلّغ السحابة فورًا',
    r.afterLock === false, r.afterLock);
  check('⭐⭐⭐ والمستخدم قفل الإشعارات → نفس الكلام',
    r.afterUserOff === false, r.afterUserOff);

  check('⭐⭐⭐⭐ التسجيل فشل → الإشعار المحلي فضل شغّال',
    r.enabledDespiteFailure === true, r.enabledDespiteFailure);
  check('⭐⭐⭐ والمفتاح في الشاشة بيبان مفتوح',
    r.stateAfterFailure === 'on', r.stateAfterFailure);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
