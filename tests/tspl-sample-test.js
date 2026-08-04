const { chromium } = require('playwright');
const pass = [], fail = [];
const check = (n, c, x) => (c ? pass : fail).push(n + (x !== undefined && !c ? ` → ${JSON.stringify(x).slice(0,200)}` : ''));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('http://localhost:8899/tests/harness.html');
  await p.waitForFunction(() => typeof buildTSPLFontSample === 'function');

  const t = await p.evaluate(() => {
    const cmds = buildTSPLFontSample(38, 25, 'Hejap Kuwaiti 120', '10632103');
    const lines = cmds.split('\r\n');
    return {
      cmds, lines,
      hasSize: /^SIZE 38 mm,25 mm$/.test(lines[0]),
      hasCLS: lines.includes('CLS'),
      hasPrint: lines.includes('PRINT 1,1'),
      textLines: lines.filter(l => l.startsWith('TEXT ')).length,
      qr: lines.filter(l => l.startsWith('QRCODE ')),
      fonts: lines.filter(l => l.startsWith('TEXT ')).map(l => (l.match(/,"(\d)",/) || [])[1]),
      endsBlank: lines[lines.length - 1] === '',
    };
  });
  check('أمر المقاس أول سطر', t.hasSize, t.lines[0]);
  check('فيه CLS قبل الرسم', t.hasCLS, t.lines);
  check('فيه أمر الطباعة في الآخر', t.hasPrint, t.lines);
  check('⭐ بيعرض 4 خطوط مختلفة', t.textLines >= 4, t.textLines);
  check('⭐ الخطوط 1 و2 و3 موجودين', ['1','2','3'].every(f => t.fonts.includes(f)), t.fonts);
  check('⭐ الباركود من توليد الطابعة نفسها', t.qr.length === 1 && /QRCODE 8,120,M,4,A,0,"10632103"/.test(t.qr[0]), t.qr);
  check('الأوامر بتنتهي بسطر فاضي (شرط TSPL)', t.endsBlank, t.lines.slice(-2));

  // الاقتباسات الخطيرة بتتشال
  const esc = await p.evaluate(() => buildTSPLFontSample(38, 25, 'A"B\\C', '12"3'));
  check('علامات التنصيص بتتشال (مش بتكسر الأمر)', !/A"B/.test(esc) && /AB/.test(esc), esc.split('\r\n')[5]);

  // بيتبعت خام مش صورة
  const sent = await p.evaluate(async () => {
    const msgs = [];
    window.qz = { configs: { create: (n) => ({ printer: n }) }, print: (c, d) => { msgs.push(d); return Promise.resolve(); },
      websocket: { connect: () => Promise.resolve() }, security: { setCertificatePromise(){}, setSignatureAlgorithm(){}, setSignaturePromise(){} } };
    window.isQZAvailable = () => true; window.ensureQZConnected = () => Promise.resolve(true);
    await printTSPLFontSample('Xprinter XP-233B', 38, 25, 'Hejap Kuwaiti 120', '10632103');
    return msgs.flat();
  });
  check('⭐ بيتبعت كأمر خام للطابعة مباشرة', sent.length === 1 && sent[0].type === 'raw' && sent[0].format === 'command', sent[0]);

  // الزرار في الشاشة
  const ui = await p.evaluate(async () => {
    state.user = { uid: 'me' }; state.profile = { name: 'x', role: 'owner' };
    state.categories = [{ id:'c1', name:'كريب', order:1 }]; state.activeCategoryId='c1'; state.grades=[];
    state.view='dashboard'; state.screen='sheets';
    const noop = () => () => {};
    const mk = () => ({ doc: () => ({ set:()=>Promise.resolve(), collection: mk, onSnapshot: noop }), get:()=>Promise.resolve({docs:[]}), where: mk, orderBy: mk, onSnapshot: noop });
    window.db = { collection: mk, collectionGroup: mk };
    render();
    window.getAvailableQZPrinters = () => Promise.resolve(['Xprinter XP-233B']);
    openPrinterSettings();
    await new Promise(r => setTimeout(r, 300));
    const btn = document.getElementById('tspl-sample');
    document.getElementById('qz-label-printer-select').value = '';
    btn.click();
    await new Promise(r => setTimeout(r, 100));
    const msg = document.getElementById('tspl-status').textContent;
    document.getElementById('qz-settings-close').click();
    return { exists: !!btn, msg };
  });
  check('زرار العيّنة موجود في الإعدادات', ui.exists, ui);
  check('بيرفض من غير اختيار طابعة', /اختار طابعة/.test(ui.msg), ui.msg);

  // ---------- السرعة والحرارة ----------
  const q = await p.evaluate(async () => {
    const msgs = [];
    const written = [];
    window.qz = { configs: { create: (n) => ({ printer: n }) }, print: (c, d) => { msgs.push(d); return Promise.resolve(); },
      websocket: { connect: () => Promise.resolve() }, security: { setCertificatePromise(){}, setSignatureAlgorithm(){}, setSignaturePromise(){} } };
    window.isQZAvailable = () => true; window.ensureQZConnected = () => Promise.resolve(true);
    window.db = { collection: () => ({ doc: () => ({ set: (d) => { written.push(d); return Promise.resolve(); }, onSnapshot: () => () => {} }) }) };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
    state.user = { uid: 'me' };
    localStorage.removeItem('tazweed_shared_print');

    const before = getPrintQuality();
    await applyPrintQuality('Xprinter XP-233B', 2, 6);
    const cmd = msgs.flat()[0];
    // الحدود
    await applyPrintQuality('Xprinter XP-233B', 99, 99);
    const clamped = msgs.flat()[1].data;
    localStorage.removeItem('tazweed_shared_print');
    return { before, cmd, clamped, written, lines: cmd.data.split('\r\n') };
  });
  check('⭐ السرعة والحرارة بتتبعت كأمر خام', q.cmd.type === 'raw' && q.cmd.format === 'command', q.cmd);
  check('⭐ أمر السرعة صح', q.lines.includes('SPEED 2'), q.lines);
  check('⭐ أمر الحرارة صح', q.lines.includes('DENSITY 6'), q.lines);
  check('القيم الافتراضية معقولة', q.before.speed === 3 && q.before.density === 8, q.before);
  check('القيم بتتقيّد بالحدود', /SPEED 8/.test(q.clamped) && /DENSITY 15/.test(q.clamped), q.clamped);
  check('⭐ بتتحفظ في السحابة عشان كل الأجهزة',
    q.written.some(w => w.quality && w.quality.speed === 2 && w.quality.density === 6), q.written);

  const qui = await p.evaluate(async () => {
    // بنرجّع القيم للافتراضي الأول — الفحص اللي فوق ساب 8/15 محفوظين،
    // والشاشة بتفتح على المحفوظ (وده الصح).
    await applyPrintQuality('Xprinter XP-233B', 3, 8);
    state.profile = { name: 'x', role: 'owner' };
    window.getAvailableQZPrinters = () => Promise.resolve(['Xprinter XP-233B']);
    openPrinterSettings();
    await new Promise(r => setTimeout(r, 300));
    const sp = document.getElementById('pq-speed'), dn = document.getElementById('pq-density');
    const out = { exists: !!sp && !!dn, speed: sp && sp.value, density: dn && dn.value };
    document.getElementById('qz-label-printer-select').value = '';
    document.getElementById('pq-apply').click();
    await new Promise(r => setTimeout(r, 100));
    out.msg = document.getElementById('pq-status').textContent;
    document.getElementById('qz-settings-close').click();
    return out;
  });
  check('خانات السرعة والحرارة في الشاشة', qui.exists, qui);
  check('بتفتح بالقيم الحالية', qui.speed === '3' && qui.density === '8', qui);
  check('بترفض من غير اختيار طابعة', /اختار طابعة/.test(qui.msg), qui.msg);

  check('مفيش أخطاء صفحة', errors.length === 0, errors);
  console.log('\n✅ نجح (' + pass.length + ')');
  if (fail.length) { console.log('❌ فشل (' + fail.length + '):'); fail.forEach(x => console.log('   ' + x)); }
  console.log('\n--- الأوامر اللي هتتبعت للطابعة ---');
  console.log(t.cmds.replace(/\r\n/g, '\n'));
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
