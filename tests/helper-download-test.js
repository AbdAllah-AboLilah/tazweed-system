// زرار تحميل البرنامج المساعد من جوه النظام
// ============================================================
// اتطلب بالنص: "زرار تحميل ل البرنامج المساعد من جوه النظام ... افتح
// يظهر زرار اضغط عليه يحمل احدث اصدار ... اثبت البرنامج وبعدين اقفل
// علي حسابه يختفي الزرار".
//
// ⚠️⚠️ أخطر حاجتين هنا **مش** الرابط:
//   ١) العطل اللي حصل قبل كده مع استيراد الأصناف: المفتاح مفتوح
//      و**مايحصلش حاجة**، لأن الزرار جوه صف مخبّي وراه زرار ترس
//      مالوش شرط للمفتاح ده. فالحساب اللي معاه المفتاح ده **بس**
//      لازم يشوف الترس.
//   ٢) الملف ~٧ ميجا، ولو عدّى على الـService Worker هيتخزّن في كاش
//      كل جهاز بيحمّله.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0, 200)}` : ''));

// ------------------------------------------------------------
// الملفات نفسها لازم تكون موجودة في المستودع
// ------------------------------------------------------------
// الرابط في الواجهة نسبي (helper/dist/...)، فلو الملف اتنقل أو اتشال
// الزرار هيدي 404 من غير أي رسالة. الفحص ده بيمسك ده.
const exePath = path.join(root, 'helper/dist/tazweed-helper.exe');
const verPath = path.join(root, 'helper/dist/VERSION');
check('⭐⭐ ملف البرنامج موجود في المسار اللي الزرار بيشاور عليه', fs.existsSync(exePath));
check('⭐ وملف النسخة موجود جنبه', fs.existsSync(verPath));

// ============================================================
// ⚠️⚠️ الـService Worker مايلمسش الملف
// ============================================================
// كل طلب من نفس الموقع بيتحفظ في الكاش. لازم يكون فيه خروج **قبل**
// الجزء ده، وإلا ٧ ميجا بتترمي في كاش كل جهاز.
const guardAt = swSrc.indexOf("'/helper/dist/'");
const cacheAt = swSrc.indexOf("fetch(request, { cache: 'no-cache' })");
check('⭐⭐⭐⭐ الـService Worker بيستثني ملف البرنامج من الكاش', guardAt !== -1);
check('⭐⭐⭐ والاستثناء **قبل** الجزء اللي بيحفظ', guardAt !== -1 && cacheAt !== -1 && guardAt < cacheAt,
  [guardAt, cacheAt]);
// ⚠️ الاستثناء مايشتغلش غير لما نسخة الـService Worker تتغيّر — المتصفح
// مابيركّبش نسخة جديدة إلا لما الملف يختلف. الفحص ده بيتأكد إن الرقم
// **مش أقدم** من النسخة اللي الاستثناء اتضاف فيها.
//
// ⚠️⚠️ مقارنة رقمية مش نص ثابت: الرقم بيتغيّر مع كل تحديث، والنص
// الثابت كان هيفشل بعد أول رفعة حتى لو كل حاجة مظبوطة.
const swVer = (swSrc.match(/const SW_VERSION = '([^']+)'/) || [])[1] || '0.0.0';
const asNum = (v) => v.split('.').map(Number).reduce((a, x) => a * 1000 + (x || 0), 0);
check(`⭐⭐ نسخة الـSW (${swVer}) مش أقدم من 0.81.0 (وإلا الاستثناء مش هيتركّب)`,
  asNum(swVer) >= asNum('0.81.0'), swVer);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof can === 'function' && typeof printWorkHTML === 'function');

  const r = await p.evaluate(async () => {
    const out = {};
    state.user = { uid: 'me' };
    state.printCart = [];
    state.printStations = [];

    // بنقرا الشاشة كنص بدل ما نرسمها كلها — الجزء اللي يهمنا هو
    // الأزرار، وده أسرع وأثبت.
    const screenFor = (profile) => {
      state.profile = profile;
      return printWorkHTML();
    };
    const hasDl = (html) => html.indexOf('print-helper-dl-btn') !== -1;
    const hasGear = (html) => html.indexOf('print-tools-btn') !== -1;

    // ---------- مقفول لكل الرتب ما عدا منشئ النظام ----------
    out.roles = {};
    ['branch_manager', 'supervisor', 'warehouse_keeper', 'print_operator', 'user'].forEach((role) => {
      out.roles[role] = hasDl(screenFor({ id: 'u', role }));
    });
    out.ownerHas = hasDl(screenFor({ id: 'me', role: 'owner' }));

    // ---------- بيتفتح لحساب بعينه ----------
    const opened = screenFor({ id: 'u', role: 'user', perms: { downloadHelper: true } });
    out.openedHas = hasDl(opened);

    // ============================================================
    // ⭐⭐⭐⭐ الحساب اللي معاه المفتاح ده **بس** لازم يشوف الترس
    // ============================================================
    // من غير كده الزرار موجود في HTML بس محدش يقدر يوصله — نفس عطل
    // "المفتاح مفتوح ومايحصلش حاجة".
    out.openedHasGear = hasGear(opened);
    // ⚠️ وحساب موظف الطباعة بالذات: مقفول على شاشة واحدة، فلو الترس
    // مابانش مافيش أي طريقة تانية يوصل بيها.
    const op = screenFor({ id: 'u', role: 'print_operator', perms: { downloadHelper: true } });
    out.operatorHasBoth = hasDl(op) && hasGear(op);

    // ---------- والقفل تاني بيخفيه ----------
    out.closedAgain = hasDl(screenFor({ id: 'u', role: 'user', perms: { downloadHelper: false } }));
    // ولا بيخلي الترس يظهر لحساب مالوش أي مفتاح تاني
    out.closedNoGear = hasGear(screenFor({ id: 'u', role: 'user', perms: { downloadHelper: false } }));

    // ---------- النافذة نفسها ----------
    // ============================================================
    // ⚠️⚠️ رابط عادي، مش تحميل بالجافاسكريبت
    // ============================================================
    // اتجرّب شكلين قبل كده والاتنين وقفوا في سكوت عند المستخدم:
    // <a download> على رابط الموقع، وبعده تحميل بشريط تقدم. الاتنين
    // كانوا بيحطوا طبقة بين الضغطة والمتصفح. اتبلّغ بالنص: "انا زهقت
    // حط مكانه لينك تحميل ... يفتح في المتصفح ويحمل وخلاص".
    state.profile = { id: 'me', role: 'owner' };
    const fetched = [];
    const realFetch = window.fetch;
    window.fetch = async (u) => {
      fetched.push(String(u));
      return { ok: true, text: async () => '1.5.0\n' + 'a'.repeat(64) + '\n' };
    };
    openHelperDownloadDialog();
    const link = document.getElementById('helper-dl-link');
    out.linkHref = link ? link.getAttribute('href') : '';
    out.linkTarget = link ? link.getAttribute('target') : '';
    out.linkRel = link ? link.getAttribute('rel') : '';
    out.noJsDownloader = !document.getElementById('helper-dl-go') && !document.getElementById('helper-dl-bar');
    out.saysSmartScreen = /برنامج غير معروف/.test(document.body.textContent);
    out.saysFromPC = /من الكمبيوتر/.test(document.body.textContent);
    await new Promise((res) => setTimeout(res, 40));
    out.verShown = (document.getElementById('helper-dl-ver') || {}).textContent || '';
    out.verFetched = fetched.filter((u) => u.indexOf('VERSION') !== -1).length;
    // ⚠️ فتح النافذة **مايبدأش** أي تحميل لوحده — التحميل بالضغطة بس
    out.noAutoDownload = fetched.every((u) => u.indexOf('.exe') === -1);
    document.getElementById('helper-dl-close').click();
    out.closedDialog = !document.getElementById('helper-dl-link');
    window.fetch = realFetch;
    return out;
  });

  Object.keys(r.roles).forEach((role) => {
    check('⭐⭐ مقفول افتراضيًا لرتبة ' + role, r.roles[role] === false, r.roles[role]);
  });
  check('⭐ ومنشئ النظام شايفه', r.ownerHas === true);
  check('⭐⭐⭐ وبيتفتح لحساب بعينه', r.openedHas === true);
  check('⭐⭐⭐⭐ والحساب ده يشوف زرار الترس كمان (وإلا الزرار مش قابل للوصول)',
    r.openedHasGear === true, r.openedHasGear);
  check('⭐⭐⭐⭐ وموظف الطباعة (المقفول على شاشة واحدة) بيشوف الاتنين',
    r.operatorHasBoth === true, r.operatorHasBoth);
  check('⭐⭐⭐ وقفل المفتاح بيخفي الزرار تاني', r.closedAgain === false);
  check('⭐⭐ ومابيسيبش الترس ظاهر لحساب مالوش مفاتيح تانية', r.closedNoGear === false);

  check('⭐⭐⭐⭐ الرابط على raw.githubusercontent — بيعدّي من غير الـService Worker',
    /^https:\/\/raw\.githubusercontent\.com\/.+tazweed-helper\.exe$/.test(r.linkHref), r.linkHref);
  check('⭐⭐⭐ وبيفتح تبويب جديد', r.linkTarget === '_blank', r.linkTarget);
  check('⭐⭐ ومعاه noopener', /noopener/.test(r.linkRel || ''), r.linkRel);
  check('⭐⭐⭐⭐ ومافيش تحميل بالجافاسكريبت تاني (الطبقة اللي كانت بتقف في سكوت)',
    r.noJsDownloader === true, r.noJsDownloader);
  check('⭐⭐⭐ وفتح النافذة مابيبدأش تحميل لوحده', r.noAutoDownload, r.noAutoDownload);
  check('⭐⭐⭐ والنافذة بتحذّر من رسالة "برنامج غير معروف" قبل ما تظهر', r.saysSmartScreen);
  check('⭐⭐ وبتقول إنه ينزّل من الكمبيوتر', r.saysFromPC);
  check('⭐⭐ وبتعرض أحدث نسخة', /1\.5\.0/.test(r.verShown), r.verShown);
  check('⭐ وبتقرا النسخة نداء واحد بس', r.verFetched === 1, r.verFetched);
  check('⭐ والنافذة بتتقفل', r.closedDialog === true);
  check('مفيش أخطاء في الصفحة', errs.length === 0, errs);

  await b.close();
  pass.forEach((n) => console.log('   ✓ ' + n));
  fail.forEach((n) => console.log('   ✗ ' + n));
  console.log(fail.length ? `\n❌ فشل (${fail.length})` : `\n✅ نجح (${pass.length})`);
  process.exit(fail.length ? 1 : 0);
})();
