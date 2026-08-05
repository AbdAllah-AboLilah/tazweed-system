// الدفعة التانية — تجربة الاستخدام
const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,240)}` : ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof render === 'function');

  const boot = () => p.evaluate(() => {
    const noop = () => () => {};
    const writes = []; window.__writes = writes;
    const mk = () => ({ doc: (id) => ({ id, set:(d)=>{writes.push({set:d});return Promise.resolve();},
        update:(d)=>{writes.push({update:d,id});return Promise.resolve();}, delete:()=>{writes.push({del:1});return Promise.resolve();},
        collection: mk, onSnapshot: noop, get:()=>Promise.resolve({exists:false}) }),
      get:()=>Promise.resolve({docs:[]}), where: mk, orderBy: mk, onSnapshot: noop, add:(d)=>{writes.push({add:d});return Promise.resolve({});} });
    window.db = { collection: mk, collectionGroup: mk, batch: () => ({ update:(r,d)=>writes.push({batch:d}), set(){}, commit:()=>Promise.resolve() }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    state.user={uid:'me'}; state.profile={name:'x',role:'owner',warehouseAccess:'both'};
    state.view='dashboard'; state.screen='sheets'; state.isOnline=true;
    state.categories = ['أ','ب','ج','د','هـ'].map((n,i)=>({ id:'c'+i, name:'فئة '+n, order:i+1, minQty:0, colorGroups:['بيجات','الوان'] }));
    state.activeCategoryId='c0';
    state.grades=[{ id:'g1', number:1, branchQty:2, mainQty:5, status:'normal' }];
    state.pendingByCategory={}; state.pendingCount=0; state.outByCategory={}; state.outCount=0; state.lowStockByCategory={};
    state.sideMenuOpen=true; state.categoryOrderMode=false; state.catMoving=null;
    state.showAddGradeForm=false; state.lastGradeGroup=''; state.lastAddedGrade=null; state.newGradeStartsWithOne=false;
    render();
  });
  await boot();

  // ---------- 1) شاشة إضافة الدرجة ----------
  const addForm = await p.evaluate(async () => {
    document.getElementById('tool-add-btn').click();
    document.getElementById('add-grade-btn').click();
    const out = { opened: !!document.getElementById('add-grade-form') };
    out.branchDefault = document.getElementById('new-grade-branch').value;

    // نختار مجموعة ونضيف
    document.getElementById('new-grade-group').value = 'الوان';
    document.getElementById('new-grade-number').value = '7';
    document.getElementById('add-grade-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 150));

    out.stillOpen = !!document.getElementById('add-grade-form');
    out.groupRemembered = document.getElementById('new-grade-group').value;
    out.numberCleared = document.getElementById('new-grade-number').value === '';
    out.focused = document.activeElement && document.activeElement.id === 'new-grade-number';
    out.confirmMsg = document.querySelector('.card') ? document.body.textContent.includes('اتضافت درجة 7') : false;
    return out;
  });
  check('شاشة الإضافة بتفتح من قايمة "إضافة"', addForm.opened, addForm);
  check('⭐ الافتراضي في الفرع بقى صفر', addForm.branchDefault === '0', addForm);
  check('⭐ الشاشة بتفضل مفتوحة بعد الإضافة', addForm.stillOpen, addForm);
  check('⭐ المجموعة بتتفكر', addForm.groupRemembered === 'الوان', addForm);
  check('⭐ رقم الدرجة بيتفضّى والمؤشر فيه', addForm.numberCleared && addForm.focused, addForm);
  check('رسالة تأكيد بالدرجة اللي اتضافت', addForm.confirmMsg, addForm);

  const startOne = await p.evaluate(() => {
    const box = document.getElementById('grade-start-one');
    box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
    return { branch: document.getElementById('new-grade-branch').value, state: state.newGradeStartsWithOne };
  });
  check('مفتاح "ابدأ بـ1" بيغيّر الافتراضي', startOne.branch === '1' && startOne.state === true, startOne);
  await boot();

  // ---------- 2) الترتيب بضغطتين ----------
  const order = await p.evaluate(async () => {
    state.categoryOrderMode = true; render();
    const names = () => [...document.querySelectorAll('.side-item-order .side-item-name')].map(e => e.textContent.trim());
    const before = names();
    // امسك آخر فئة
    const picks = [...document.querySelectorAll('[data-cat-pick]')];
    picks[picks.length - 1].click();
    await new Promise(r => setTimeout(r, 50));
    const held = state.catMoving;
    const heldShown = !!document.querySelector('.side-item-held');
    // حطها مكان أول واحدة
    document.querySelectorAll('[data-cat-pick]')[0].click();
    await new Promise(r => setTimeout(r, 120));
    return { before, after: names(), held, heldShown, stillHolding: state.catMoving,
             orders: state.categories.map(c => ({ n: c.name, o: c.order })) };
  });
  check('⭐ ضغطة واحدة بتمسك الفئة', !!order.held && order.heldShown, order);
  check('⭐ الضغطة التانية بتنقلها لأول القايمة', order.after[0] === order.before[order.before.length - 1], order);
  check('باقي الفئات اتزحلقت مش اتبدّلت', order.after[1] === order.before[0], order);
  check('الإمساك بيتفك بعد النقل', order.stillHolding === null, order);
  check('الترتيب المحفوظ اتحدّث 1..5', order.orders.every((c, i) => c.o === i + 1), order.orders);

  const unpick = await p.evaluate(async () => {
    const btn = document.querySelector('[data-cat-pick]');
    btn.click(); await new Promise(r => setTimeout(r, 50));
    const first = state.catMoving;
    document.querySelector('[data-cat-pick]').click(); await new Promise(r => setTimeout(r, 50));
    return { first, after: state.catMoving };
  });
  check('الضغط على نفس الفئة بيسيبها', !!unpick.first && unpick.after === null, unpick);
  await boot();

  // ---------- 3) تعديل وحذف الفئة من القايمة ----------
  const acts = await p.evaluate(() => ({
    rename: document.querySelectorAll('[data-cat-rename]').length,
    del: document.querySelectorAll('[data-cat-delete]').length,
    cats: state.categories.length,
  }));
  check('زرار تعديل جنب كل فئة', acts.rename === acts.cats, acts);
  check('زرار حذف جنب كل فئة', acts.del === acts.cats, acts);

  const rename = await p.evaluate(async () => {
    window.prompt = () => 'فئة جديدة';
    document.querySelector('[data-cat-rename]').click();
    await new Promise(r => setTimeout(r, 120));
    return { name: state.categories[0].name, wrote: window.__writes.some(w => w.update && w.update.name === 'فئة جديدة') };
  });
  check('⭐ تعديل الاسم شغّال من القايمة', rename.name === 'فئة جديدة', rename);
  check('والتعديل بيتكتب في السحابة', rename.wrote, rename);

  const delWrong = await p.evaluate(async () => {
    const n = state.categories.length;
    window.prompt = () => 'اسم غلط';
    window.alert = () => {};
    window.__writes.length = 0;
    document.querySelector('[data-cat-delete]').click();
    await new Promise(r => setTimeout(r, 120));
    return { before: n, deleted: window.__writes.some(w => w.del) };
  });
  check('⭐ الحذف بيترفض لو الاسم مش مطابق', !delWrong.deleted, delWrong);

  const delRight = await p.evaluate(async () => {
    const name = state.categories[0].name;
    window.prompt = () => name;
    window.__writes.length = 0;
    document.querySelector('[data-cat-delete]').click();
    await new Promise(r => setTimeout(r, 150));
    return { asked: name, deleted: window.__writes.length > 0 };
  });
  check('⭐ الحذف بيتم لما تكتب الاسم صح', delRight.deleted, delRight);
  await boot();

  // ---------- 4) ضم الزراير ----------
  const menus = await p.evaluate(() => {
    const bar = document.querySelector('.tabs').parentElement;
    const toolbar = [...document.querySelectorAll('div')].find(d => d.querySelector('#tool-add-btn'));
    const direct = toolbar ? [...toolbar.children].filter(c => c.tagName === 'BUTTON' || c.classList.contains('tool-menu')).length : 0;
    document.getElementById('tool-add-btn').click();
    const openAdd = document.getElementById('tool-add-panel').classList.contains('open');
    document.getElementById('tool-cat-btn').click();
    const openCat = document.getElementById('tool-cat-panel').classList.contains('open');
    const addStillOpen = document.getElementById('tool-add-panel').classList.contains('open');
    return { direct, openAdd, openCat, addStillOpen,
             hasDelete: !!document.getElementById('delete-category-btn') };
  });
  check('⭐ شريط الفئة بقى فيه عناصر أقل', menus.direct <= 5, menus);
  check('قايمة "إضافة" بتفتح', menus.openAdd, menus);
  check('قايمة "الفئة" بتفتح', menus.openCat, menus);
  check('فتح واحدة بتقفل التانية', !menus.addStillOpen, menus);
  check('⭐ حذف الفئة اتشال من جوه الفئة', !menus.hasDelete, menus);

  // ---------- 5) الشريط المتثبّت وسهم فوق ----------
  const sticky = await p.evaluate(() => {
    const tabs = document.querySelector('.tabs');
    const cs = getComputedStyle(tabs);
    const topbar = document.querySelector('.topbar').getBoundingClientRect().height;
    return { pos: cs.position, top: cs.top, topbarH: Math.round(topbar),
             toTop: !!document.getElementById('to-top-btn') };
  });
  check('⭐ شريط الفئات متثبّت', sticky.pos === 'sticky', sticky);
  check('⭐ متثبّت تحت الشريط العلوي بالظبط', parseInt(sticky.top, 10) === sticky.topbarH, sticky);
  check('سهم الرجوع لفوق موجود', sticky.toTop, sticky);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);
  console.log('\n✅ نجح (' + pass.length + ')');
  pass.filter(x => x.includes('⭐')).forEach(x => console.log('   ' + x));
  if (fail.length) { console.log('\n❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
