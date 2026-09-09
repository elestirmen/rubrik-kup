#!/usr/bin/env node
/* =====================================================================
   ui.js — arayüz işlev testi (isteğe bağlı; jsdom gerektirir)

   Kurulum ve çalıştırma:
     mkdir -p /tmp/rubrik-ui && cd /tmp/rubrik-ui && npm init -y && npm i jsdom
     NODE_PATH=/tmp/rubrik-ui/node_modules node /opt/oyunlar/rubrik/test/ui.js

   Kapsam: açılış, hamleler, karıştırma, ipucu, otomatik çözüm, renk girişi
   ve doğrulama, çözüm rehberinin baştan sona yürütülmesi, öğren bölümü, tema.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const WWW = path.join(__dirname, '..', 'www');
const errors = [];
const logs = [];

const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
vc.on('warn', (...a) => logs.push('warn: ' + a.join(' ')));

const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');

(async () => {
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;
  const doc = win.document;

  /* --- eksik tarayıcı API'leri --- */
  win.ResizeObserver = class { constructor(cb){ this.cb = cb; } observe(){ } disconnect(){ } };
  win.matchMedia = win.matchMedia || (q => ({ matches: false, media: q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
  win.AudioContext = undefined;
  win.requestIdleCallback = undefined;
  let clock = 0;
  win.requestAnimationFrame = cb => win.setTimeout(() => { clock += 1000; cb(clock); }, 0);
  win.cancelAnimationFrame = id => win.clearTimeout(id);
  Object.defineProperty(win.Element.prototype, 'clientWidth', { get(){ return 600; }, configurable: true });
  Object.defineProperty(win.Element.prototype, 'clientHeight', { get(){ return 420; }, configurable: true });
  win.HTMLElement.prototype.setPointerCapture = function(){};
  win.HTMLElement.prototype.releasePointerCapture = function(){};
  win.print = function(){ logs.push('print() çağrıldı'); };
  win.scrollTo = function(){};
  Object.defineProperty(win, 'scrollY', { get(){ return 0; }, configurable: true });

  /* --- betikleri sırayla yükle --- */
  for (const f of ['cube.js', 'geometry.js', 'solver.js', 'scene.js', 'content.js', 'app.js']) {
    const code = fs.readFileSync(path.join(WWW, 'js', f), 'utf8');
    try {
      win.eval(code);
    } catch (e) {
      errors.push('yükleme hatası (' + f + '): ' + e.message);
    }
  }
  // DOMContentLoaded zaten geçti; app.js kendi boot'unu çalıştırır
  await tick(60);

  let pass = 0, fail = 0;
  const check = (name, cond, extra) => {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  HATA ' + name + (extra ? ' -- ' + extra : '')); }
  };

  function tick(ms) { return new Promise(r => win.setTimeout(r, ms)); }
  function click(sel) {
    const n = doc.querySelector(sel);
    if (!n) { errors.push('bulunamadı: ' + sel); return false; }
    n.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    return true;
  }
  function key(k, opts) {
    doc.dispatchEvent(new win.KeyboardEvent('keydown', Object.assign({ key: k, code: k, bubbles: true }, opts || {})));
  }

  console.log('\n1) Acilis');
  check('Betikler hatasiz yuklendi', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('Kup sahnesi olustu (26 parca)', doc.querySelectorAll('#play-stage .cubie').length === 26,
    String(doc.querySelectorAll('#play-stage .cubie').length));
  check('Her parcanin 6 yuzu var (156 yuz)', doc.querySelectorAll('#play-stage .facet').length === 156);
  check('Cozulmus kupte 54 gorunur sticker var',
    doc.querySelectorAll('#play-stage .sticker:not([hidden])').length === 54,
    String(doc.querySelectorAll('#play-stage .sticker:not([hidden])').length));
  check('Hareket tuslari kuruldu (18)', doc.querySelectorAll('#pad-grid .pad__btn').length === 18);
  check('Renk paleti kuruldu (6)', doc.querySelectorAll('#palette .pal').length === 6);
  check('Acilim 54 kare', doc.querySelectorAll('#net .net-cell').length === 54);

  /* sticker renk dagilimi: her renkten 9 */
  const counts = {};
  doc.querySelectorAll('#play-stage .sticker:not([hidden])').forEach(s => {
    counts[s.dataset.color] = (counts[s.dataset.color] || 0) + 1;
  });
  check('Sahnede her renkten 9 sticker', Object.keys(counts).length === 6 && Object.values(counts).every(v => v === 9),
    JSON.stringify(counts));

  console.log('\n2) Oyna: hamleler ve karistirma');
  const before = doc.querySelectorAll('#play-stage .sticker[data-color]').length;
  click('.pad__btn[data-move="R"]');
  await tick(120);
  check('R tusundan sonra hata yok', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('Hamle sayaci arttı', doc.querySelector('#play-movecount').textContent.indexOf('1 hamle') === 0,
    doc.querySelector('#play-movecount').textContent);

  key('u', { shiftKey: true });
  await tick(120);
  check("Klavye U' calisti", doc.querySelector('#play-movecount').textContent.indexOf('2 hamle') === 0,
    doc.querySelector('#play-movecount').textContent);

  click('#btn-undo');
  await tick(120);
  check('Geri al calisti', doc.querySelector('#play-movecount').textContent.indexOf('1 hamle') === 0);

  click('#btn-scramble');
  await tick(2600);
  check('Karistirma listesi gosterildi', doc.querySelectorAll('#scramble-moves span').length === 22,
    String(doc.querySelectorAll('#scramble-moves span').length));
  check('Karistirmadan sonra hata yok', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('Durum: hamle bekleniyor', /sayaç|incele/i.test(doc.querySelector('#play-status').textContent),
    doc.querySelector('#play-status').textContent);

  console.log('\n3) Oyna: ipucu ve otomatik cozum');
  click('#btn-hint');
  await tick(700);
  check('Ipucu kutusu goruntulendi', !doc.querySelector('#hint-box').hidden);
  check('Ipucu hamleleri var', /[URFDLB]/.test(doc.querySelector('.hint-box__moves').textContent),
    doc.querySelector('.hint-box__moves') ? doc.querySelector('.hint-box__moves').textContent : '(yok)');
  check('Vurgulanan parca var', doc.querySelectorAll('#play-stage .cubie.is-target').length > 0,
    String(doc.querySelectorAll('#play-stage .cubie.is-target').length));

  click('#btn-autosolve');
  await tick(1000);
  let waited = 0;
  while (doc.querySelector('#btn-autosolve').disabled && waited < 40000) { await tick(500); waited += 500; }
  await tick(800);
  const solvedStickers = {};
  doc.querySelectorAll('#play-stage .facet[data-dir="U"] .sticker:not([hidden])').forEach(s => {
    solvedStickers[s.dataset.color] = (solvedStickers[s.dataset.color] || 0) + 1;
  });
  check('Otomatik cozum bitti, ust yuz tek renk', solvedStickers.U === 9, JSON.stringify(solvedStickers));
  check('Otomatik cozumde hata yok', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log('\n4) Kupumu Coz: renk girisi');
  click('#tab-solve');
  await tick(200);
  check('Coz sekmesi acildi', doc.querySelector('#view-solve').classList.contains('is-active'));
  check('Onizleme sahnesi kuruldu', doc.querySelectorAll('#hold-stage .cubie').length === 26);
  check('Tut listesi dolduruldu', doc.querySelectorAll('#hold-list li').length === 6);

  // eksik boyama: cozum dugmesi kapali olmali
  check('Eksik boyamada cozum dugmesi kapali', doc.querySelector('#btn-solve').disabled === true);
  check('Uyari mesaji gosterildi', /kare daha/.test(doc.querySelector('#validation').textContent),
    doc.querySelector('#validation').textContent.slice(0, 60));

  // klavyeyle boyama
  key('3');
  await tick(50);
  check('Klavye ile boyama calisti', doc.querySelectorAll('#net .net-cell[data-color]').length === 7,
    String(doc.querySelectorAll('#net .net-cell[data-color]').length));
  click('#btn-net-undo');
  await tick(50);
  check('Geri al: boyama silindi', doc.querySelectorAll('#net .net-cell[data-color]').length === 6);

  // gecersiz kup: tum kareleri ayni renge boyayalim
  const cells = Array.from(doc.querySelectorAll('#net .net-cell:not(.is-center)'));
  doc.querySelector('#palette .pal[data-face="F"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  cells.forEach(c => c.dispatchEvent(new win.MouseEvent('click', { bubbles: true })));
  await tick(150);
  check('Gecersiz kup reddedildi', doc.querySelector('#btn-solve').disabled === true);
  check('Hata mesaji uretildi', /renk|kose|kenar|9 kare/i.test(doc.querySelector('#validation').textContent),
    doc.querySelector('#validation').textContent.slice(0, 80));

  // ornek karisik kup
  click('#btn-net-clear');
  await tick(80);
  click('#btn-net-sample');
  await tick(200);
  check('Ornek kup 54 kareyi doldurdu', doc.querySelector('#net-filled').textContent === '54',
    doc.querySelector('#net-filled').textContent);
  check('Gecerli kup: cozum dugmesi acildi', doc.querySelector('#btn-solve').disabled === false,
    doc.querySelector('#validation').textContent.slice(0, 80));
  check('Onizleme sahnesinde 54 boyali sticker', doc.querySelectorAll('#hold-stage .sticker[data-color]').length === 54, String(doc.querySelectorAll('#hold-stage .sticker[data-color]').length));

  console.log('\n5) Kupumu Coz: rehber');
  click('#btn-solve');
  await tick(1200);
  check('Rehber adimina gecildi', doc.querySelector('#solve-guide').hidden === false);
  check('Yol haritasi dolduruldu', doc.querySelectorAll('#timeline .tl').length >= 5,
    String(doc.querySelectorAll('#timeline .tl').length));
  check('Hamle kartlari var', doc.querySelectorAll('#movecards .mc').length > 0);
  check('Ilk hamle vurgulu', doc.querySelectorAll('#movecards .mc.is-current').length === 1);
  const totalTxt = doc.querySelector('#total-moves').textContent;
  const total = parseInt(totalTxt, 10);
  check('Toplam hamle sayisi makul (40-200)', total >= 40 && total <= 200, totalTxt);
  check('Tum cozum listesi dolduruldu', doc.querySelectorAll('#all-moves .am').length === total,
    doc.querySelectorAll('#all-moves .am').length + ' / ' + total);
  check('Asama aciklamasi var', doc.querySelector('#stage-intro').textContent.length > 30);
  check('Rehber sahnesinde vurgulu parca var', doc.querySelectorAll('#guide-stage .cubie.is-target').length > 0);

  // adim adim ilerle: once tek hamle, sonra adim adim bitir
  click('#guide-next');
  await tick(400);
  check('Bir hamle ilerledi', /^1 \//.test(doc.querySelector('#guide-progress-text').textContent),
    doc.querySelector('#guide-progress-text').textContent);
  click('#guide-prev');
  await tick(400);
  check('Bir hamle geri alindi', /^0 \//.test(doc.querySelector('#guide-progress-text').textContent),
    doc.querySelector('#guide-progress-text').textContent);

  // klavye ile tum cozumu yuru
  let guard = 0;
  while (guard++ < 400) {
    const txt = doc.querySelector('#guide-progress-text').textContent;
    const m = txt.match(/^(\d+) \/ (\d+)/);
    if (m && m[1] === m[2]) break;
    key('ArrowRight');
    await tick(30);
  }
  await tick(500);
  const finalTxt = doc.querySelector('#guide-progress-text').textContent;
  const fm = finalTxt.match(/^(\d+) \/ (\d+)/);
  check('Tum hamleler yurundu', fm && fm[1] === fm[2], finalTxt);
  check('Bitis mesaji gosterildi', /çözüldü/i.test(doc.querySelector('#guide-stagename').textContent),
    doc.querySelector('#guide-stagename').textContent);

  // rehber sahnesi gercekten cozulmus mu: her yuzun 9 karesi tek renk
  const faceColors = {};
  ['U','R','F','D','L','B'].forEach(f => {
    const set = {};
    doc.querySelectorAll('#guide-stage .facet[data-dir="' + f + '"] .sticker:not([hidden])').forEach(s => {
      set[s.dataset.color] = (set[s.dataset.color] || 0) + 1;
    });
    faceColors[f] = set;
  });
  const allUniform = Object.keys(faceColors).every(f => {
    const k = Object.keys(faceColors[f]);
    return k.length === 1 && faceColors[f][k[0]] === 9;
  });
  check('Rehber sonunda 3B kup cozulmus', allUniform, JSON.stringify(faceColors));

  click('#btn-print');
  await tick(200);
  check('Yazdirma alani olusturuldu', !!doc.querySelector('#print-area') && doc.querySelectorAll('#print-area .pr-stage').length >= 5,
    String(doc.querySelectorAll('#print-area .pr-stage').length));

  console.log('\n6) Ogren');
  click('#tab-learn');
  await tick(300);
  check('Ogren sekmesi acildi', doc.querySelector('#view-learn').classList.contains('is-active'));
  check('Notasyon kartlari (18)', doc.querySelectorAll('#notation-grid .nt').length === 18);
  check('Yontem listesi (7)', doc.querySelectorAll('#method-list .mt').length === 7);
  check('Algoritma kartlari', doc.querySelectorAll('#algs-grid .ag').length >= 10);
  check('Ogrenme kupu kuruldu', doc.querySelectorAll('#learn-stage .cubie').length === 26);
  doc.querySelector('#notation-grid .nt').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick(400);
  doc.querySelector('#algs-grid .ag').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await tick(900);
  check('Ogren etkilesimleri hatasiz', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log('\n7) Tema ve ayarlar');
  click('#theme-btn');
  await tick(80);
  check('Tema aydinliga gecti', doc.documentElement.dataset.theme === 'light', doc.documentElement.dataset.theme);
  click('#theme-btn');
  await tick(80);
  check('Tema karanliga dondu', doc.documentElement.dataset.theme === 'dark');

  console.log('\n' + '-'.repeat(52));
  if (errors.length) {
    console.log('Konsol hatalari:');
    errors.slice(0, 12).forEach(e => console.log('  ! ' + e));
  }
  console.log('Gecen: ' + pass + '   Basarisiz: ' + fail + '   Hata kaydi: ' + errors.length);
  process.exit(fail || errors.length ? 1 : 0);
})();
