// ⚠️ الفحص ده محتاج **محاكي Firestore** ونسخة محلية من مكتبة Firebase:
//
//   npm i firebase@10.12.0 firebase-tools
//   mkdir -p tests/offline-harness && cp node_modules/firebase/firebase-app-compat.js \
//     node_modules/firebase/firebase-firestore-compat.js tests/offline-harness/
//   (وملف index.html صغير بيحمّل الاتنين — شوف آخر الملف)
//
//   npx firebase emulators:exec --only firestore --project offline-test \
//     "node tests/offline-persistence-test.js"
//
// وممكن تحدد مكان تاني للملفات بـ OFFLINE_HARNESS_DIR.
// ⚠️ الفحص ده على **محاكي Firestore الحقيقي** — مش تقليد.
// السؤال اللي بيجاوب عليه: لو النت فصل، التعديلات بتفضل محفوظة؟
// والسجل بيسمع الحركات اللي اتعملت والنت مقفول؟
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DIR = process.env.OFFLINE_HARNESS_DIR || (__dirname + '/offline-harness');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x)}` : ''));

const srv = http.createServer((q, s) => {
  const f = path.join(DIR, q.url === '/' ? 'index.html' : q.url);
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'text/javascript' });
    s.end(d);
  });
});

(async () => {
  await new Promise((r) => srv.listen(8123, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://127.0.0.1:8123/');
  await p.waitForFunction(() => window.__ready && window.firebase && firebase.firestore);

  const r = await p.evaluate(async () => {
    firebase.initializeApp({ apiKey: 'x', projectId: 'offline-test' });
    const fsdb = firebase.firestore();
    fsdb.useEmulator('127.0.0.1', 8080);
    let persisted = true;
    await fsdb.enablePersistence({ synchronizeTabs: true }).catch(() => { persisted = false; });

    const grade = fsdb.collection('categories').doc('c1').collection('grades').doc('g1');
    const log = fsdb.collection('activityLog');

    // 1) متصلين: قيمة أولية
    await grade.set({ number: 5, branchQty: 10, mainQty: 0, status: 'normal' });
    const before = (await grade.get()).data().branchQty;

    // 2) نفصل النت
    await fsdb.disableNetwork();

    // 3) نعدّل ونسجّل في السجل — الاتنين وإحنا مفصولين
    grade.update({ branchQty: 7 });
    log.add({ action: 'edit', categoryId: 'c1', gradeId: 'g1', field: 'branchQty',
              oldValue: 10, newValue: 7, userId: 'u1', userName: 'أنا',
              timestamp: firebase.firestore.FieldValue.serverTimestamp() });

    // 4) القراية من الذاكرة المحلية
    const offSnap = await grade.get();
    const offVal = offSnap.data().branchQty;
    const offFromCache = offSnap.metadata.fromCache;
    const offPending = offSnap.metadata.hasPendingWrites;

    // والسجل: السطر الجديد بيبان وإحنا مفصولين؟
    const offLog = await log.orderBy('timestamp', 'desc').limit(50).get();
    const offLogCount = offLog.size;
    const offLogPending = offLog.docs.filter((d) => d.metadata.hasPendingWrites).length;
    const offTsNull = offLog.docs.length ? offLog.docs[0].data().timestamp === null : null;

    // 5) تعديل تاني وإحنا لسه مفصولين
    grade.update({ branchQty: 3 });
    const off2 = (await grade.get()).data().branchQty;

    // 6) نقفل الصفحة ونفتحها؟ مش هينفع هنا — بس نتأكد إن الكتابة في IndexedDB
    const dbs = (await indexedDB.databases()).map((d) => d.name).filter((n) => /firestore/i.test(n));

    // 7) النت يرجع
    await fsdb.enableNetwork();
    await new Promise((res) => setTimeout(res, 2500));

    // 8) نقرا من **السيرفر** مباشرة
    const onVal = (await grade.get({ source: 'server' })).data().branchQty;
    const onLog = await log.orderBy('timestamp', 'desc').limit(50).get({ source: 'server' });
    const onLogCount = onLog.size;
    const syncedTs = onLog.docs.length ? !!onLog.docs[0].data().timestamp : false;
    const onAction = onLog.docs.length ? onLog.docs[0].data().action : '';

    return { persisted, before, offVal, offFromCache, offPending, off2, onVal,
             offLogCount, offLogPending, offTsNull, onLogCount, syncedTs, onAction, dbs };
  });

  console.log(JSON.stringify(r, null, 1));
  check('التخزين المحلي اشتغل', r.persisted, r);
  check('⭐ التعديل وإحنا مفصولين بيبان فورًا', r.offVal === 7, r);
  check('⭐ والتعديل التاني كمان محفوظ', r.off2 === 3, r);
  check('البيانات بتتقري من الذاكرة المحلية', r.offFromCache === true, r);
  check('والكتابة متعلّمة "لسه مترفعتش"', r.offPending === true, r);
  check('⭐ السجل بيسجّل الحركة والنت مقفول', r.offLogCount >= 1, r);
  check('وسطر السجل متعلّم إنه لسه مترفعش', r.offLogPending >= 1, r);
  check('التخزين المحلي في IndexedDB', r.dbs.length >= 1, r);
  check('⭐⭐ التعديل وصل السيرفر بعد رجوع النت', r.onVal === 3, r);
  check('⭐⭐ والسجل وصل السيرفر', r.onLogCount >= 1, r);
  check('ونوع العملية اتسجّل صح', r.onAction === 'edit', r);
  check('ووقت السطر اتحدّد بعد الرفع', r.syncedTs, r);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  srv.close();
  console.log(`\n✅ نجح: ${pass.length}`);
  pass.forEach((t) => console.log('   ✓ ' + t));
  if (fail.length) {
    console.log(`\n❌ فشل: ${fail.length}`);
    fail.forEach((t) => console.log('   ✗ ' + t));
    process.exit(1);
  }
  console.log('\nكل الفحوص نجحت.');
})();
