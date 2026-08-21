// ============================================================
// قاعدة الأصناف: مانزّلش 7 ميجا كل جلسة على الفاضي
// ============================================================
// ⚠️ القياس اللي أدّى للتعديل (46,052 صنف في المحل):
//
//   حجم القاعدة .......... ~7 ميجا
//   قراءات Firestore ..... 24
//   وكل ده كان بيتنزّل **كل جلسة**، حتى لو مفيش حاجة اتغيّرت.
//
// السبب: `.get()` بتروح للسحابة الأول دايمًا، والنسخة المحلية بتتستخدم
// **بس** لما النت يقطع. وأمين المخزن بيفتح شاشة الطباعة عشرات المرات في
// اليوم، والاستيراد بيحصل مرة في الشهر — يعني 449 مرة من الـ450 كنا
// بننزّل حاجة موجودة عنده أصلًا.
//
// ⚠️⚠️ وأخطر حاجة في التعديل ده: **نسخة ناقصة أسوأ من تنزيل زيادة**.
// لو الذاكرة المحلية اتمسحت أو نقصت والنظام استخدمها، المستخدم هيدوّر
// على صنف موجود ومايلاقيهوش — من غير أي رسالة. عشان كده أغلب الفحص هنا
// على **الحالات اللي المفروض نرجع فيها للتنزيل الكامل**.
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 300)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof loadProducts === 'function');

  // سحابة مزيّفة بتعدّ: كام مرة رحنا للسيرفر، وكام مرة قرينا من الجهاز
  await p.evaluate(() => {
    window.__setupDB = (opts) => {
      const o = Object.assign({ count: 5, stampMs: 1000, cacheCount: null, metaThrows: false }, opts || {});
      window.__hits = { server: 0, cache: 0, meta: 0 };
      const mk = (n) => Array.from({ length: n }, (_, i) => ({ name: 'صنف ' + i, barcode: 'B' + i }));
      const chunkDocs = (n) => [{ id: 'chunk_0', data: () => ({ index: 0, items: mk(n) }) }];
      const metaDoc = {
        exists: true,
        data: () => ({ count: o.count, chunks: 1, updatedAt: { toMillis: () => o.stampMs } }),
      };
      window.db = {
        collection: () => ({
          doc: (id) => ({
            get: () => {
              if (id === 'meta') {
                window.__hits.meta++;
                if (o.metaThrows) return Promise.reject(Object.assign(new Error('offline'), { code: 'unavailable' }));
                return Promise.resolve(metaDoc);
              }
              return Promise.resolve({ exists: false, data: () => null });
            },
            set: () => Promise.resolve(),
          }),
          get: (src) => {
            if (src && src.source === 'cache') {
              window.__hits.cache++;
              const n = o.cacheCount === null ? o.count : o.cacheCount;
              return Promise.resolve({ docs: [metaDoc.exists ? { id: 'meta', data: metaDoc.data } : null, ...chunkDocs(n)].filter(Boolean) });
            }
            window.__hits.server++;
            return Promise.resolve({ docs: [{ id: 'meta', data: metaDoc.data }, ...chunkDocs(o.count)] });
          },
        }),
      };
      // نصفّر الذاكرة اللي في الصفحة عشان كل حالة تبدأ من الأول
      productsCache = null; productsIndex = null; productsLoading = null; productsMeta = null;
    };
  });

  const run = (opts, clearStamp) =>
    p.evaluate(async ([opts, clearStamp]) => {
      if (clearStamp) localStorage.removeItem('tazweed_products_stamp');
      window.__setupDB(opts);
      const list = await loadProducts();
      return { n: list.length, hits: window.__hits, stamp: localStorage.getItem('tazweed_products_stamp') };
    }, [opts, clearStamp]);

  // ============================================================
  // 1) ⭐ أول مرة على الجهاز: تنزيل كامل + حفظ البصمة
  // ============================================================
  const first = await run({ count: 5, stampMs: 1000 }, true);
  check('⭐ أول مرة: بينزّل من السحابة', first.hits.server === 1 && first.n === 5, first);
  check('⭐ والبصمة اتحفظت', !!first.stamp && first.stamp.includes('1000'), first);

  // ============================================================
  // 2) ⭐⭐ الجلسة اللي بعدها: **صفر تنزيل**
  // ============================================================
  // ده جوهر التعديل — نفس التاريخ يعني نفس البيانات.
  const second = await run({ count: 5, stampMs: 1000 }, false);
  check('⭐⭐ نفس التاريخ: مفيش أي تنزيل من السحابة',
    second.hits.server === 0, second.hits);
  check('⭐⭐ واتقرت من ذاكرة الجهاز', second.hits.cache === 1, second.hits);
  check('⭐ وقراءة واحدة صغيرة بس للتاريخ', second.hits.meta === 1, second.hits);
  check('⭐ والأصناف كاملة', second.n === 5, second);

  // ============================================================
  // 3) ⭐⭐ استورد ملف جديد؟ ينزّل من الأول
  // ============================================================
  const changed = await run({ count: 9, stampMs: 2000 }, false);
  check('⭐⭐ التاريخ اتغيّر: بينزّل كامل', changed.hits.server === 1 && changed.n === 9, changed);
  check('⭐ والبصمة اتحدّثت', changed.stamp.includes('2000'), changed);

  // ============================================================
  // 4) ⭐⭐ الحارس: نسخة ناقصة على الجهاز = ننزّل من الأول
  // ============================================================
  // ⚠️ ده أهم فحص في الملف. لو الذاكرة المحلية نقصت واستخدمناها،
  // المستخدم هيدوّر على صنف موجود ومايلاقيهوش — **من غير أي رسالة**.
  const short = await run({ count: 9, stampMs: 2000, cacheCount: 4 }, false);
  check('⭐⭐ الذاكرة ناقصة (4 من 9): رجعنا للسحابة',
    short.hits.server === 1 && short.n === 9, short);

  const empty = await run({ count: 9, stampMs: 2000, cacheCount: 0 }, false);
  check('⭐⭐ والذاكرة فاضية خالص: رجعنا للسحابة',
    empty.hits.server === 1 && empty.n === 9, empty);

  // ============================================================
  // 5) ⭐ مفيش نت: النظام لسه بيشتغل
  // ============================================================
  // قراءة التاريخ بتفشل، وبنكمّل بالطريقة العادية — وFirestore بيرجّع
  // النسخة المحلية لوحده لما مفيش اتصال.
  const offline = await run({ count: 9, stampMs: 2000, metaThrows: true }, false);
  check('⭐ مفيش نت: بيكمّل عادي ومابيقعش', offline.n === 9 && errors.length === 0, offline);

  // ============================================================
  // 6) ⭐ التاريخ لسه ماتأكدش من السيرفر → مانعتمدش عليه
  // ============================================================
  // `serverTimestamp` بترجع null لحظة الكتابة. لو حفظنا بصمة ناقصة،
  // الأجهزة ممكن تفضل على نسخة قديمة.
  const noStamp = await p.evaluate(async () => {
    localStorage.removeItem('tazweed_products_stamp');
    window.__setupDB({ count: 5, stampMs: 0 });
    await loadProducts();
    const saved = localStorage.getItem('tazweed_products_stamp');
    // الجلسة اللي بعدها لازم تنزّل تاني
    window.__setupDB({ count: 5, stampMs: 0 });
    await loadProducts();
    return { saved, server: window.__hits.server };
  });
  check('⭐ تاريخ مش متأكّد: مابنحفظش بصمة', noStamp.saved === null, noStamp);
  check('⭐ وبننزّل كل مرة (الأأمن)', noStamp.server === 1, noStamp);

  // ============================================================
  // 7) ⭐⭐ زرار "تحديث الملف" بيتخطّى كل ده
  // ============================================================
  const forced = await p.evaluate(async () => {
    window.__setupDB({ count: 5, stampMs: 1000 });
    await loadProducts();          // بصمة محفوظة
    window.__setupDB({ count: 5, stampMs: 1000 });
    await loadProducts(true);      // المستخدم طلب تحديث
    return window.__hits;
  });
  check('⭐⭐ `force` بينزّل من السحابة غصب', forced.server === 1, forced);
  check('⭐ ومابيقراش من الذاكرة أصلًا', forced.cache === 0, forced);

  // ============================================================
  // 8) ⭐ الاستيراد بيشيل البصمة القديمة
  // ============================================================
  const afterSave = await p.evaluate(async () => {
    localStorage.setItem('tazweed_products_stamp', '"1000:5"');
    window.__setupDB({ count: 5, stampMs: 1000 });
    await saveProducts([{ name: 'جديد', barcode: 'X' }]);
    return localStorage.getItem('tazweed_products_stamp');
  });
  check('⭐⭐ بعد استيراد ملف جديد: البصمة اتشالت', afterSave === null, { afterSave });

  check('مفيش أخطاء في الصفحة', errors.length === 0, errors);
  await b.close();

  if (fail.length) {
    console.log(`❌ فشل (${fail.length}):`);
    fail.forEach((f) => console.log('   ' + f));
    console.log(`\n✅ نجح (${pass.length})`);
    process.exit(1);
  }
  console.log(`✅ نجح (${pass.length})`);
  pass.filter((x) => x.startsWith('⭐')).forEach((x) => console.log('   ' + x));
})();
