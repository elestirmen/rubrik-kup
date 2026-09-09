/* =====================================================================
   app.js — uygulama kabuğu: Oyna / Küpümü Çöz / Öğren
   ===================================================================== */
(function (root) {
  'use strict';

  var Cube = root.Cube, Solver = root.Solver, Scene = root.Scene, Content = root.Content;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  var LS = { settings: 'rubrik.settings.v2', solves: 'rubrik.solves.v2', net: 'rubrik.net.v1' };

  var TURN_GLYPH = { '': '\u21bb', "'": '\u21ba', '2': '180\u00b0' };
  var TURN_TEXT = {
    '': 'saat yönünde çeyrek tur',
    "'": 'saat yönünün tersine çeyrek tur',
    '2': 'yarım tur (180°)'
  };
  function moveGlyph(mv) { return TURN_GLYPH[mv.slice(1)] || ''; }
  function moveText(mv) { return TURN_TEXT[mv.slice(1)] || ''; }
  function faceLabel(mv) { return Content.FACE_NAMES[mv[0]].tr; }

  function load(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function store(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* özel mod */ }
  }

  var settings = Object.assign(
    { theme: 'dark', palette: 'klasik', sound: true, speed: 220, inspection: false },
    load(LS.settings, {})
  );
  var scheme = Object.assign({}, Content.DEFAULT_SCHEME, load(LS.net, {}).scheme || {});

  /* ------------------------------------------------------------------
     Genel yardımcılar
     ------------------------------------------------------------------ */

  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.theme === 'light' ? '#f6f4ef' : '#06070d');
  }

  function applyColors() {
    var pal = Content.PALETTES[settings.palette] || Content.PALETTES.klasik;
    FACES.forEach(function (f) {
      document.documentElement.style.setProperty('--cube-' + f.toLowerCase(), pal[scheme[f]]);
    });
  }

  function colorHex(face) {
    var pal = Content.PALETTES[settings.palette] || Content.PALETTES.klasik;
    return pal[scheme[face]];
  }
  function colorName(face) { return Content.COLOR_NAMES[scheme[face]]; }

  var toastTimer = null;
  function coarsePointer() {
    try { return !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches); }
    catch (e) { return false; }
  }

  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, ms || 2600);
  }

  var actx = null;
  function sfx(kind) {
    if (!settings.sound) return;
    try {
      var Ctx = root.AudioContext || root.webkitAudioContext;
      if (!Ctx) return;
      actx = actx || new Ctx();
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime;
      if (kind === 'turn') {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(180 + Math.random() * 60, t);
        o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.1);
        o.connect(g); g.connect(actx.destination);
        o.start(t); o.stop(t + 0.11);
      } else if (kind === 'solve') {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          var o2 = actx.createOscillator(), g2 = actx.createGain();
          o2.type = 'sine';
          o2.frequency.setValueAtTime(f, t + i * 0.09);
          g2.gain.setValueAtTime(0.0001, t + i * 0.09);
          g2.gain.exponentialRampToValueAtTime(0.09, t + i * 0.09 + 0.02);
          g2.gain.exponentialRampToValueAtTime(0.0008, t + i * 0.09 + 0.42);
          o2.connect(g2); g2.connect(actx.destination);
          o2.start(t + i * 0.09); o2.stop(t + i * 0.09 + 0.45);
        });
      } else if (kind === 'error') {
        var o3 = actx.createOscillator(), g3 = actx.createGain();
        o3.type = 'sawtooth';
        o3.frequency.setValueAtTime(160, t);
        o3.frequency.exponentialRampToValueAtTime(80, t + 0.18);
        g3.gain.setValueAtTime(0.045, t);
        g3.gain.exponentialRampToValueAtTime(0.0008, t + 0.2);
        o3.connect(g3); g3.connect(actx.destination);
        o3.start(t); o3.stop(t + 0.21);
      }
    } catch (e) { /* sessiz geç */ }
  }

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = $('#confetti');
    var pal = Content.PALETTES[settings.palette];
    var colors = Object.keys(pal).map(function (k) { return pal[k]; });
    for (var i = 0; i < 80; i++) {
      var p = el('span', 'cf');
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 220 - 110) + 'px');
      p.style.setProperty('--rot', (Math.random() * 1080 - 540) + 'deg');
      p.style.animation = 'cfFall ' + (1.7 + Math.random() * 1.5) + 's ' + (Math.random() * 0.45) + 's var(--ease-in-out) forwards';
      box.appendChild(p);
    }
    setTimeout(function () { box.innerHTML = ''; }, 3800);
  }

  function fmtTime(ms) {
    if (ms === null || ms === undefined) return '—';
    var s = ms / 1000;
    if (s < 60) return s.toFixed(2);
    var m = Math.floor(s / 60);
    var r = s - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2);
  }

  /* ------------------------------------------------------------------
     Görünüm (sekme) yönetimi
     ------------------------------------------------------------------ */

  var currentView = 'play';
  function showView(name) {
    currentView = name;
    $$('.view').forEach(function (v) {
      var on = v.id === 'view-' + name;
      v.classList.toggle('is-active', on);
      v.hidden = !on;
    });
    $$('.tab').forEach(function (t) {
      var on = t.dataset.view === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (name === 'solve') solveMod.onShow();
    if (name === 'learn') learnMod.onShow();
    if (window.scrollY > 90) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  }

  /* ==================================================================
     OYNA
     ================================================================== */

  var playMod = (function () {
    var scene = null;
    var cube = Cube.solved();
    var history = [];
    var scramble = [];
    var moveCount = 0;
    var assisted = false;
    var busy = false;
    var solves = load(LS.solves, []);
    var timer = { mode: 'idle', t0: 0, elapsed: 0, raf: null, inspectT0: 0 };

    function init() {
      scene = Scene.create({
        mount: $('#play-stage'),
        zoom: 5.35, zoom0: 5.35,
        badge: coarsePointer() ? 'Kareyi sürükle: hamle · Boşluğu sürükle: görünüm' : 'Sol tuş: hamle · Sağ tuş: görünüm',
        onUserMove: function (mv) { doMove(mv, true); }
      });
      scene.setSpeed(settings.speed);
      buildPad();
      bindUi();
      renderStats();
      updateHud();
    }

    function buildPad() {
      var grid = $('#pad-grid');
      grid.innerHTML = '';
      FACES.forEach(function (f) {
        var g = el('div', 'pad__group');
        [f, f + "'", f + '2'].forEach(function (mv, i) {
          var b = el('button', 'pad__btn' + (i === 0 ? ' pad__btn--main' : ''), mv);
          b.type = 'button';
          b.dataset.move = mv;
          b.title = Content.FACE_NAMES[f].long + (i === 0 ? ' — saat yönü' : (i === 1 ? ' — ters yön' : ' — yarım tur'));
          b.addEventListener('click', function () { doMove(mv, true); flash(b); });
          g.appendChild(b);
        });
        grid.appendChild(g);
      });
    }

    function flash(btn) {
      btn.classList.add('is-flash');
      setTimeout(function () { btn.classList.remove('is-flash'); }, 160);
    }

    function bindUi() {
      $('#btn-scramble').addEventListener('click', function () { newScramble(); });
      $('#btn-reset').addEventListener('click', function () { reset(); });
      $('#btn-undo').addEventListener('click', function () { undo(); });
      $('#btn-hint').addEventListener('click', function () { hint(); });
      $('#btn-autosolve').addEventListener('click', function () { autosolve(); });
      $('#btn-orbit-reset').addEventListener('click', function () { scene.resetView(); });
      $('#btn-clear-stats').addEventListener('click', function () {
        if (!solves.length) return;
        solves = []; store(LS.solves, solves); renderStats(); toast('İstatistikler temizlendi.');
      });
      $('#btn-inspection').addEventListener('click', function () {
        settings.inspection = !settings.inspection;
        this.setAttribute('aria-pressed', settings.inspection ? 'true' : 'false');
        store(LS.settings, settings);
        updateHud();
      });
      $('#btn-inspection').setAttribute('aria-pressed', settings.inspection ? 'true' : 'false');

      $$('.seg__btn[data-speed]').forEach(function (b) {
        b.classList.toggle('is-active', String(settings.speed) === b.dataset.speed);
        b.addEventListener('click', function () {
          settings.speed = parseInt(b.dataset.speed, 10);
          store(LS.settings, settings);
          scene.setSpeed(settings.speed);
          $$('.seg__btn[data-speed]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
        });
      });

      var sel = $('#palette-select');
      sel.value = settings.palette;
      sel.addEventListener('change', function () {
        settings.palette = sel.value; store(LS.settings, settings); applyColors();
      });

      var snd = $('#sound-toggle');
      snd.checked = settings.sound;
      snd.addEventListener('change', function () {
        settings.sound = snd.checked; store(LS.settings, settings);
      });
    }

    /* ---- hamle ---- */
    function doMove(mv, fromUser, silent) {
      if (busy) return;
      cube = Cube.applyMove(cube, mv);
      history.push(mv);
      moveCount++;
      if (!silent) sfx('turn');
      if (fromUser && timer.mode === 'ready') startTimer();
      else if (fromUser && timer.mode === 'inspect') startTimer();
      updateHud();
      hideHint();
      return scene.move(mv).then(function () {
        if (Cube.isSolved(cube) && timer.mode === 'running') finishSolve();
        else if (Cube.isSolved(cube) && moveCount > 0) updateHud();
      });
    }

    function applySequence(moves, opts) {
      opts = opts || {};
      busy = true;
      setControlsDisabled(true);
      moves.forEach(function (mv) { cube = Cube.applyMove(cube, mv); history.push(mv); moveCount++; });
      updateHud();
      return scene.moves(moves, {
        duration: opts.duration,
        gap: opts.gap,
        onMove: function () { if (!opts.silent) sfx('turn'); }
      }).then(function () {
        busy = false;
        setControlsDisabled(false);
        updateHud();
        if (Cube.isSolved(cube) && timer.mode === 'running') finishSolve();
      });
    }

    function setControlsDisabled(v) {
      ['#btn-scramble', '#btn-reset', '#btn-undo', '#btn-hint', '#btn-autosolve'].forEach(function (s) {
        $(s).disabled = v;
      });
      $$('.pad__btn').forEach(function (b) { b.disabled = v; });
      scene.setBusy(v);
    }

    function newScramble() {
      stopTimer(true);
      cube = Cube.solved();
      history = [];
      moveCount = 0;
      assisted = false;
      scramble = Cube.randomScramble(22);
      scene.setState(cube);
      hideHint();
      $('#scramble-box').hidden = false;
      var box = $('#scramble-moves');
      box.innerHTML = '';
      scramble.forEach(function (m) { box.appendChild(el('span', null, m)); });
      busy = true;
      setControlsDisabled(true);
      var c = Cube.solved();
      scramble.forEach(function (m) { c = Cube.applyMove(c, m); });
      scene.moves(scramble, { duration: 78, onMove: function () { sfx('turn'); } }).then(function () {
        cube = c;
        moveCount = 0;
        history = [];
        busy = false;
        setControlsDisabled(false);
        timer.mode = 'ready';
        timer.elapsed = 0;
        renderTime(0);
        updateHud();
      });
    }

    function reset() {
      stopTimer(true);
      cube = Cube.solved();
      history = [];
      moveCount = 0;
      assisted = false;
      scramble = [];
      $('#scramble-box').hidden = true;
      hideHint();
      scene.setState(cube);
      scene.highlight(null);
      timer.mode = 'idle';
      renderTime(0);
      updateHud();
    }

    function undo() {
      if (busy || !history.length) return;
      var mv = history.pop();
      var inv = Cube.invertMove(mv);
      cube = Cube.applyMove(cube, inv);
      moveCount = Math.max(0, moveCount - 1);
      assisted = true;
      updateHud();
      scene.move(inv);
      sfx('turn');
    }

    /* ---- kronometre ---- */
    function startTimer() {
      timer.mode = 'running';
      timer.t0 = performance.now();
      tick();
      updateHud();
    }

    function tick() {
      cancelAnimationFrame(timer.raf);
      function frame() {
        if (timer.mode === 'running') {
          timer.elapsed = performance.now() - timer.t0;
          renderTime(timer.elapsed);
          timer.raf = requestAnimationFrame(frame);
        } else if (timer.mode === 'inspect') {
          var left = 15000 - (performance.now() - timer.inspectT0);
          if (left <= 0) { startTimer(); return; }
          renderTime(left, true);
          timer.raf = requestAnimationFrame(frame);
        }
      }
      timer.raf = requestAnimationFrame(frame);
    }

    function stopTimer(silent) {
      cancelAnimationFrame(timer.raf);
      if (timer.mode === 'running' && !silent) timer.mode = 'stopped';
      else timer.mode = timer.mode === 'running' ? 'idle' : timer.mode;
    }

    function startInspection() {
      timer.mode = 'inspect';
      timer.inspectT0 = performance.now();
      tick();
      updateHud();
    }

    function finishSolve() {
      cancelAnimationFrame(timer.raf);
      timer.elapsed = performance.now() - timer.t0;
      timer.mode = 'stopped';
      renderTime(timer.elapsed);
      updateHud();
      confetti();
      sfx('solve');
      if (assisted) {
        toast('Çözdün! Yardım kullandığın için süre kaydedilmedi.', 3400);
      } else {
        solves.push({ t: Math.round(timer.elapsed), moves: moveCount, scramble: scramble.join(' '), date: Date.now() });
        if (solves.length > 400) solves = solves.slice(-400);
        store(LS.solves, solves);
        var best = Math.min.apply(null, solves.map(function (s) { return s.t; }));
        toast(best === Math.round(timer.elapsed) ? 'Yeni rekor: ' + fmtTime(timer.elapsed) + ' saniye!' : 'Çözüldü: ' + fmtTime(timer.elapsed), 3200);
        renderStats();
      }
    }

    function renderTime(ms, inspect) {
      var txt = inspect ? Math.ceil(ms / 1000) + ' sn' : fmtTime(ms);
      $('#timer-big').textContent = txt;
      $('#play-timer').textContent = txt;
      $('#timer-big').classList.toggle('is-inspect', !!inspect);
      $('#timer-big').classList.toggle('is-running', timer.mode === 'running');
    }

    function updateHud() {
      $('#play-movecount').textContent = moveCount + ' hamle';
      var s = $('#play-status');
      if (timer.mode === 'running') s.textContent = 'Süre işliyor';
      else if (timer.mode === 'inspect') s.textContent = 'İnceleme süresi';
      else if (timer.mode === 'ready') s.textContent = settings.inspection ? 'Boşluk: incelemeyi başlat' : 'Bir hamle yap, sayaç başlasın';
      else if (Cube.isSolved(cube)) s.textContent = moveCount ? 'Çözüldü' : 'Karıştır ve başla';
      else s.textContent = 'Serbest oyun';
      $('#timer-help').innerHTML = timer.mode === 'ready' && settings.inspection
        ? '<kbd>Boşluk</kbd> ile 15 saniyelik incelemeyi başlat.'
        : 'Karıştır, sonra ilk hamlede sayaç çalışır. <kbd>Boşluk</kbd>: yeni karıştırma.';
    }

    /* ---- yardım ---- */
    function hideHint() { $('#hint-box').hidden = true; scene.highlight(null); }

    function hint() {
      if (busy) return;
      if (Cube.isSolved(cube)) { toast('Küp zaten çözülü.'); return; }
      var btn = $('#btn-hint');
      btn.disabled = true;
      setTimeout(function () {
        var step = null;
        try { step = Solver.nextStep(cube); } catch (e) { step = null; }
        btn.disabled = false;
        if (!step) { toast('İpucu hesaplanamadı.'); return; }
        assisted = true;
        var box = $('#hint-box');
        box.hidden = false;
        box.innerHTML = '';
        box.appendChild(el('strong', null, step.stageTitle + (step.title ? ' — ' + step.title : '')));
        box.appendChild(el('div', 'hint-box__moves', step.moves.join('  ')));
        if (step.note) box.appendChild(el('div', null, step.note));
        var apply = el('button', 'btn btn--sm', 'Bu adımı oynat');
        apply.type = 'button';
        apply.style.marginTop = '10px';
        apply.addEventListener('click', function () {
          applySequence(step.moves, { gap: 60 });
        });
        box.appendChild(apply);
        scene.highlight(step.targets || null);
      }, 30);
    }

    function autosolve() {
      if (busy) return;
      if (Cube.isSolved(cube)) { toast('Küp zaten çözülü.'); return; }
      var btn = $('#btn-autosolve');
      btn.disabled = true;
      var old = btn.innerHTML;
      btn.textContent = 'Hesaplanıyor…';
      setTimeout(function () {
        var res = null;
        try { res = Solver.solve(cube); } catch (e) { res = null; }
        btn.innerHTML = old;
        btn.disabled = false;
        if (!res || !res.ok) { toast('Çözüm bulunamadı.'); sfx('error'); return; }
        assisted = true;
        var all = [];
        res.steps.forEach(function (s) { all = all.concat(s.moves); });
        toast(res.totalMoves + ' hamlede çözülüyor…', 2200);
        applySequence(all, { duration: Math.min(140, settings.speed), gap: 10 });
      }, 30);
    }

    /* ---- istatistik ---- */
    function avgOf(n) {
      if (solves.length < n) return null;
      var last = solves.slice(-n).map(function (s) { return s.t; }).sort(function (a, b) { return a - b; });
      var trimmed = last.slice(1, last.length - 1);
      if (!trimmed.length) return null;
      return trimmed.reduce(function (a, b) { return a + b; }, 0) / trimmed.length;
    }

    function renderStats() {
      var best = solves.length ? Math.min.apply(null, solves.map(function (s) { return s.t; })) : null;
      $('#stat-best').textContent = best === null ? '—' : fmtTime(best);
      $('#stat-last').textContent = solves.length ? fmtTime(solves[solves.length - 1].t) : '—';
      var a5 = avgOf(5), a12 = avgOf(12);
      $('#stat-ao5').textContent = a5 === null ? '—' : fmtTime(a5);
      $('#stat-ao12').textContent = a12 === null ? '—' : fmtTime(a12);
      var list = $('#solve-list');
      list.innerHTML = '';
      solves.slice(-12).reverse().forEach(function (s, i) {
        var li = el('li', s.t === best ? 'is-best' : null);
        li.appendChild(el('span', null, String(solves.length - i)));
        li.appendChild(el('span', 't', fmtTime(s.t)));
        li.appendChild(el('span', 'm', s.moves + ' hamle'));
        list.appendChild(li);
      });
    }

    /* ---- klavye ---- */
    function onKey(ev) {
      if (currentView !== 'play') return;
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      var k = ev.key.toLowerCase();
      if (ev.code === 'Space') {
        ev.preventDefault();
        if (timer.mode === 'ready' && settings.inspection) startInspection();
        else if (timer.mode === 'running') { /* çözülünce durur */ }
        else newScramble();
        return;
      }
      if (k === 'z' && (ev.ctrlKey || ev.metaKey || !ev.shiftKey)) { undo(); return; }
      var idx = ['u', 'r', 'f', 'd', 'l', 'b'].indexOf(k);
      if (idx >= 0) {
        ev.preventDefault();
        var mv = FACES[idx] + (ev.altKey ? '2' : (ev.shiftKey ? "'" : ''));
        doMove(mv, true);
        var btn = $('.pad__btn[data-move="' + mv.replace(/'/g, "\\'") + '"]');
        if (btn) flash(btn);
      }
    }

    return {
      init: init,
      onKey: onKey,
      refreshSpeed: function () { if (scene) scene.setSpeed(settings.speed); }
    };
  })();

  /* ==================================================================
     KÜPÜMÜ ÇÖZ
     ================================================================== */

  var solveMod = (function () {
    /* boyama sırası: Üst, Sol, Ön, Sağ, Arka, Alt */
    var ORDER = [];
    ['U', 'L', 'F', 'R', 'B', 'D'].forEach(function (f) {
      var base = FACES.indexOf(f) * 9;
      for (var i = 0; i < 9; i++) if (i !== 4) ORDER.push(base + i);
    });

    var colors = new Array(54).fill(null);
    var active = 'D';
    var cursor = 0;
    var editCenters = false;
    var undoStack = [];
    var preview = null, guide = null;
    var solution = null, startState = null, flat = [], pos = 0;
    var busy = false;
    var ready = false;

    function init() {
      buildNet();
      buildPalette();
      bind();
      resetColors();
      var saved = load(LS.net, null);
      if (saved && saved.colors && saved.colors.length === 54 && Cube.partialCheck(saved.colors).ok) {
        colors = saved.colors.slice();
      }
      refresh();
    }

    function onShow() {
      if (!preview) {
        preview = Scene.create({
          mount: $('#hold-stage'), zoom: 6.3, zoom0: 6.3, interactive: true
        });
        preview.orbit(-0.62, 0.5);
        preview.setSpin(0.0022);
        preview.setFacelets(colors);
      }
      if (!guide) {
        guide = Scene.create({
          mount: $('#guide-stage'), zoom: 5.35, zoom0: 5.35,
          badge: 'Sürükleyerek çevir'
        });
        guide.setSpeed(settings.speed);
      }
    }

    /* ---------- açılım ---------- */
    function buildNet() {
      var net = $('#net');
      net.innerHTML = '';
      ['U', 'L', 'F', 'R', 'B', 'D'].forEach(function (f) {
        var face = el('div', 'net-face');
        face.dataset.face = f;
        face.appendChild(el('span', 'net-face__label', Content.FACE_NAMES[f].tr + ' (' + f + ')'));
        for (var i = 0; i < 9; i++) {
          var idx = FACES.indexOf(f) * 9 + i;
          var cell = el('button', 'net-cell' + (i === 4 ? ' is-center' : ''));
          cell.type = 'button';
          cell.dataset.index = String(idx);
          cell.setAttribute('aria-label', Content.FACE_NAMES[f].tr + ' yüzü, ' + (i + 1) + '. kare');
          cell.addEventListener('click', function () { onCellClick(parseInt(this.dataset.index, 10)); });
          cell.addEventListener('pointerenter', function (ev) {
            if (ev.buttons === 1) onCellClick(parseInt(this.dataset.index, 10), true);
          });
          face.appendChild(cell);
        }
        net.appendChild(face);
      });
    }

    function buildPalette() {
      var box = $('#palette');
      box.innerHTML = '';
      FACES.forEach(function (f, i) {
        var b = el('button', 'pal');
        b.type = 'button';
        b.dataset.face = f;
        b.setAttribute('role', 'radio');
        var dot = el('span', 'pal__dot');
        dot.style.setProperty('--c', 'var(--cube-' + f.toLowerCase() + ')');
        b.appendChild(dot);
        b.appendChild(el('span', 'pal__name', colorName(f)));
        b.appendChild(el('span', 'pal__key', String(i + 1)));
        b.addEventListener('click', function () { setActive(f); });
        box.appendChild(b);
      });
      setActive(active);
    }

    function refreshPaletteNames() {
      $$('#palette .pal').forEach(function (b) {
        var f = b.dataset.face;
        $('.pal__name', b).textContent = colorName(f);
      });
    }

    function refreshPaletteState(counts) {
      $$('#palette .pal').forEach(function (b) {
        var full = counts[b.dataset.face] >= 9;
        b.classList.toggle('is-full', full);
        b.title = full ? colorName(b.dataset.face) + ': 9/9 tamam' : '';
      });
    }

    function setActive(f) {
      active = f;
      $$('#palette .pal').forEach(function (b) {
        var on = b.dataset.face === f;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }

    function resetColors() {
      colors = new Array(54).fill(null);
      FACES.forEach(function (f) { colors[FACES.indexOf(f) * 9 + 4] = f; });
      undoStack = [];
      cursor = 0;
    }

    function isCenter(idx) { return idx % 9 === 4; }

    function countOf(face) {
      var n = 0;
      for (var i = 0; i < 54; i++) if (colors[i] === face) n++;
      return n;
    }

    function pieceWord(kind) { return kind === 'edge' ? 'kenar' : 'köşe'; }

    function badPieceText(b) {
      var names = b.colors.map(function (c) { return colorName(c); }).join(' + ');
      if (b.reason === 'yok') {
        return 'Böyle bir ' + pieceWord(b.kind) + ' parçası yok: ' + names +
          '. Gerçek küpte bu renkler aynı parçada yan yana gelmez.';
      }
      return 'Bu ' + pieceWord(b.kind) + ' parçası zaten girilmiş: ' + names +
        '. Her parça küpte yalnızca bir kez bulunur.';
    }

    /* Hatalı parçalar arasından dokunulan kareye ait olanı seç */
    function pickBad(bad, idx) {
      var own = Cube.pieceOf(idx);
      for (var i = 0; i < bad.length; i++) {
        if (own && bad[i].kind === own.kind && bad[i].slot === own.slot) return bad[i];
      }
      return bad[0];
    }

    function flashCell(idx) {
      var cell = $('#net .net-cell[data-index="' + idx + '"]');
      if (!cell) return;
      cell.classList.remove('is-bad');
      void cell.offsetWidth;
      cell.classList.add('is-bad');
      setTimeout(function () { cell.classList.remove('is-bad'); }, 420);
    }

    function onCellClick(idx, dragging) {
      if (isCenter(idx)) {
        if (!editCenters) { toast('Merkezler sabit. Değiştirmek için "Merkezleri değiştir".'); return; }
        swapCenters(FACES[Math.floor(idx / 9)], active);
        return;
      }
      /* bir renk en fazla 9 kare olabilir */
      if (colors[idx] !== active && countOf(active) >= 9) {
        toast(colorName(active) + ' renginden zaten 9 kare var. Fazlasını boyamak için önce birini sil.');
        if (!dragging) sfx('error');
        return;
      }
      /* parça tutarlılığı: kenar 2, köşe 3 renk taşır ve birleşim gerçek bir
         parçaya uymalı; aynı parça iki yerde olamaz */
      var prev = colors[idx];
      var wasBad = Cube.partialCheck(colors).bad.length;
      colors[idx] = active;
      var chk = Cube.partialCheck(colors);
      if (chk.bad.length > wasBad) {
        colors[idx] = prev;
        toast(badPieceText(pickBad(chk.bad, idx)), 3600);
        if (!dragging) sfx('error');
        flashCell(idx);
        return;
      }

      undoStack.push({ idx: idx, prev: prev });
      if ($('#autoadvance').checked) {
        var o = ORDER.indexOf(idx);
        cursor = Math.min(ORDER.length - 1, (o < 0 ? cursor : o) + 1);
      } else if (!dragging) {
        var oo = ORDER.indexOf(idx);
        if (oo >= 0) cursor = oo;
      }
      refresh();
    }

    /* Merkez rengini değiştir: iki yüzün rengini takas et, görünen boyama korunur */
    function swapCenters(face, otherFace) {
      if (face === otherFace) return;
      var tmp = scheme[face];
      scheme[face] = scheme[otherFace];
      scheme[otherFace] = tmp;
      for (var i = 0; i < 54; i++) {
        if (colors[i] === face) colors[i] = otherFace;
        else if (colors[i] === otherFace) colors[i] = face;
      }
      applyColors();
      refreshPaletteNames();
      refresh();
      toast(Content.FACE_NAMES[face].tr + ' yüzü artık ' + colorName(face).toLowerCase() + '.');
    }

    function bind() {
      $('#btn-net-clear').addEventListener('click', function () {
        resetColors(); refresh(); toast('Açılım temizlendi.');
      });
      $('#btn-net-undo').addEventListener('click', function () { undo(); });
      $('#btn-net-sample').addEventListener('click', function () {
        var st = Cube.fromScramble(Cube.randomScramble(24));
        colors = Cube.toFacelets(st);
        undoStack = [];
        refresh();
        toast('Örnek karışık küp yüklendi. "Çözümü oluştur"a basabilirsin.');
      });
      $('#btn-net-centers').addEventListener('click', function () {
        editCenters = !editCenters;
        this.setAttribute('aria-pressed', editCenters ? 'true' : 'false');
        $('#net').classList.toggle('is-centers-editable', editCenters);
        toast(editCenters
          ? 'Merkeze dokunarak o yüzün rengini seçili renkle değiştir.'
          : 'Merkezler yeniden sabitlendi.');
      });
      $('#btn-solve').addEventListener('click', function () { buildSolution(); });
      $('#btn-restart-input').addEventListener('click', function () { gotoStep(1); });
      $('#btn-copy-solution').addEventListener('click', copySolution);
      $('#btn-print').addEventListener('click', printSolution);
      $('#guide-next').addEventListener('click', function () { nextMove(); });
      $('#guide-prev').addEventListener('click', function () { prevMove(); });
      $('#guide-play').addEventListener('click', function () { watchStep(); });
      $('#step-done').addEventListener('click', function () { finishStep(); });
      $('#step-prev').addEventListener('click', function () { prevStep(); });
    }

    function undo() {
      var last = undoStack.pop();
      if (!last) return;
      colors[last.idx] = last.prev;
      var o = ORDER.indexOf(last.idx);
      if (o >= 0) cursor = o;
      refresh();
    }

    /* ---------- görsel yenileme ---------- */
    function refresh() {
      var filled = 0, counts = {};
      FACES.forEach(function (f) { counts[f] = 0; });
      for (var i = 0; i < 54; i++) {
        if (colors[i]) { filled++; counts[colors[i]]++; }
      }
      $$('#net .net-cell').forEach(function (cell) {
        var idx = parseInt(cell.dataset.index, 10);
        if (colors[idx]) cell.dataset.color = colors[idx];
        else delete cell.dataset.color;
        cell.classList.toggle('is-cursor', ORDER[cursor] === idx);
      });
      $('#net-filled').textContent = String(filled);

      var cbox = $('#counters');
      cbox.innerHTML = '';
      FACES.forEach(function (f) {
        var c = el('div', 'counter' + (counts[f] === 9 ? ' is-ok' : (counts[f] > 9 ? ' is-over' : '')));
        var dot = el('span', 'counter__dot');
        dot.style.setProperty('--c', 'var(--cube-' + f.toLowerCase() + ')');
        c.appendChild(dot);
        c.appendChild(el('span', null, colorName(f)));
        c.appendChild(el('span', 'counter__n', counts[f] + '/9'));
        cbox.appendChild(c);
      });

      refreshPaletteState(counts);
      renderHold();
      if (preview) preview.setFacelets(colors);
      validate(filled, counts);
      store(LS.net, { colors: colors, scheme: scheme });
    }

    function renderHold() {
      var list = $('#hold-list');
      list.innerHTML = '';
      [['D', 'altta'], ['F', 'sana dönük (ön)'], ['U', 'üstte'], ['R', 'sağda'], ['L', 'solda'], ['B', 'arkada']].forEach(function (pair) {
        var li = el('li');
        var sw = el('span', 'hold__swatch');
        sw.style.setProperty('--c', 'var(--cube-' + pair[0].toLowerCase() + ')');
        li.appendChild(sw);
        var strong = el('strong', null, colorName(pair[0]));
        li.appendChild(strong);
        li.appendChild(document.createTextNode(' ' + pair[1]));
        list.appendChild(li);
      });
    }

    function msg(kind, text) {
      var m = el('div', 'msg msg--' + kind);
      var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', kind === 'ok' ? 'M5 13l4 4L19 7' : 'M12 8v5M12 16.5v.5M12 3l9 16H3L12 3Z');
      icon.appendChild(path);
      m.appendChild(icon);
      m.appendChild(el('span', null, text));
      return m;
    }

    function validate(filled, counts) {
      var box = $('#validation');
      box.innerHTML = '';
      ready = false;
      var over = FACES.filter(function (f) { return counts[f] > 9; });
      if (over.length) {
        over.forEach(function (f) {
          box.appendChild(msg('bad', colorName(f) + ' renginden ' + counts[f] + ' kare var, en fazla 9 olabilir.'));
        });
        $('#btn-solve').disabled = true;
        return;
      }
      var chk = Cube.partialCheck(colors);
      if (!chk.ok) {
        chk.bad.slice(0, 3).forEach(function (b) { box.appendChild(msg('bad', badPieceText(b))); });
        $('#btn-solve').disabled = true;
        return;
      }
      if (filled < 54) {
        box.appendChild(msg('warn', (54 - filled) + ' kare daha boyanmalı. Kalan kareler sönük görünür.'));
        box.appendChild(msg('ok', 'Girilen kenar ve köşeler tutarlı.'));
      } else {
        var res = Cube.fromFacelets(colors);
        if (res.state) {
          box.appendChild(msg('ok', 'Küp geçerli. Çözüm hazırlanabilir.'));
          ready = true;
        } else {
          res.errors.slice(0, 3).forEach(function (e) { box.appendChild(msg('bad', e)); });
        }
      }
      $('#btn-solve').disabled = !ready;
    }

    /* ---------- adım göstergesi ---------- */
    function gotoStep(n) {
      $('#solve-input').hidden = n !== 1;
      $('#solve-guide').hidden = n !== 2;
      $$('#wizard-steps .steps__item').forEach(function (it) {
        var i = parseInt(it.dataset.step, 10);
        it.classList.toggle('is-active', i === n);
        it.classList.toggle('is-done', i < n);
      });
      if (n === 2 && guide) setTimeout(function () { guide.orbit(-0.62, 0.5); }, 30);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }

    /* ---------- çözüm ---------- */
    function buildSolution() {
      var res = Cube.fromFacelets(colors);
      if (!res.state) { toast('Küp geçerli değil.'); sfx('error'); return; }
      var btn = $('#btn-solve');
      btn.disabled = true;
      var old = btn.innerHTML;
      btn.textContent = 'Hesaplanıyor…';
      setTimeout(function () {
        var out = null;
        try { out = Solver.solve(res.state); } catch (e) { out = null; }
        btn.innerHTML = old;
        btn.disabled = false;
        if (!out || !out.ok) {
          toast('Çözüm üretilemedi: ' + ((out && out.error) || 'bilinmeyen hata'));
          sfx('error');
          return;
        }
        solution = out;
        startState = res.state;
        flat = [];
        out.steps.forEach(function (st, si) {
          st.moves.forEach(function (mv) { flat.push({ move: mv, step: si }); });
        });
        pos = 0;
        onShow();
        guide.setState(startState);
        gotoStep(2);
        renderTimeline();
        renderGuide();
        if (Cube.isSolved(startState)) toast('Küp zaten çözülü görünüyor.');
        else toast(out.totalMoves + ' hamlelik yol hazır. Küpü rehberdeki gibi tut.', 3600);
      }, 30);
    }

    function currentStepIndex() {
      if (!flat.length) return 0;
      return flat[Math.min(pos, flat.length - 1)].step;
    }

    function stateAt(p) {
      var s = Cube.clone(startState);
      for (var i = 0; i < p; i++) s = Cube.applyMove(s, flat[i].move);
      return s;
    }

    function renderTimeline() {
      var tl = $('#timeline');
      tl.innerHTML = '';
      solution.stages.forEach(function (stg, i) {
        var b = el('button', 'tl');
        b.type = 'button';
        b.dataset.stage = String(i);
        b.appendChild(el('span', 'tl__n', String(i + 1)));
        b.appendChild(el('span', 'tl__t', stg.title));
        var n = stg.steps.reduce(function (a, s) { return a + s.moves.length; }, 0);
        b.appendChild(el('span', 'tl__c', n + ' hamle'));
        b.addEventListener('click', function () { jumpToStage(i); });
        tl.appendChild(b);
      });
    }

    function stageOfStep(si) {
      var seen = 0;
      for (var i = 0; i < solution.stages.length; i++) {
        var cnt = solution.stages[i].steps.length;
        if (si < seen + cnt) return i;
        seen += cnt;
      }
      return solution.stages.length - 1;
    }

    function jumpToStage(stageIdx) {
      if (busy) return;
      var target = 0, seen = 0, found = false;
      for (var i = 0; i < solution.stages.length && !found; i++) {
        for (var j = 0; j < solution.stages[i].steps.length; j++) {
          if (i === stageIdx) { target = solution.steps[seen].moveOffset; found = true; break; }
          seen++;
        }
        if (!found && i === stageIdx) { found = true; }
      }
      pos = target;
      guide.setState(stateAt(pos));
      renderGuide();
    }

    function renderGuide() {
      if (!solution) return;
      var done = pos >= flat.length;
      var si = currentStepIndex();
      var step = solution.steps[si];
      var stageIdx = stageOfStep(si);
      var stage = solution.stages[stageIdx];

      $('#guide-stagename').textContent = done ? 'Küp çözüldü' : stage.title;
      $('#guide-progress-text').textContent = pos + ' / ' + flat.length + ' hamle';
      $('#guide-progress').style.width = (flat.length ? (pos / flat.length * 100) : 100).toFixed(1) + '%';
      $('#total-moves').textContent = flat.length + ' hamle';

      $('#step-badge').textContent = 'Adım ' + (si + 1) + ' / ' + solution.steps.length;
      $('#step-title').textContent = done ? 'Tebrikler, küp çözüldü!' : (step.title || stage.title);
      $('#step-alg').textContent = done ? '' : (step.name + (step.setup ? ' · hazırlık: ' + step.setup : ''));
      $('#step-note').textContent = done
        ? 'Tüm hamleler tamamlandı. Küpün altı ve yanları tek renk olmalı.'
        : (step.note || '');

      var mc = $('#movecards');
      mc.innerHTML = '';
      if (!done) {
        step.moves.forEach(function (mv, i) {
          var g = pos - step.moveOffset;
          var card = el('div', 'mc' + (i < g ? ' is-done' : (i === g ? ' is-current' : '')));
          card.appendChild(el('span', 'mc__m', mv));
          card.appendChild(el('span', 'mc__d', moveGlyph(mv)));
          card.appendChild(el('span', 'mc__n', (i + 1) + '/' + step.moves.length));
          card.title = faceLabel(mv) + ' yüzü, ' + moveText(mv);
          mc.appendChild(card);
        });
      }

      var now = $('#now-move');
      now.innerHTML = '';
      if (done) {
        now.hidden = true;
      } else {
        now.hidden = false;
        var mv = flat[pos].move;
        now.appendChild(el('span', 'now-move__k', mv));
        var txt = el('span');
        txt.appendChild(document.createTextNode('Şimdi '));
        txt.appendChild(el('strong', null, faceLabel(mv).toLocaleUpperCase('tr')));
        txt.appendChild(document.createTextNode(' yüzünü '));
        txt.appendChild(el('strong', null, moveText(mv)));
        txt.appendChild(document.createTextNode(' çevir — o yüze karşıdan bakarken.'));
        now.appendChild(txt);
      }

      var holdChip = $('#guide-hold');
      holdChip.innerHTML = '';
      var i1 = el('i'); i1.style.background = 'var(--cube-d)';
      var i2 = el('i'); i2.style.background = 'var(--cube-f)';
      holdChip.appendChild(i1);
      holdChip.appendChild(document.createTextNode(colorName('D') + ' altta'));
      holdChip.appendChild(i2);
      holdChip.appendChild(document.createTextNode(colorName('F') + ' önde'));

      $('#stage-intro').textContent = stage.intro || '';
      $('#stage-goal').textContent = 'Hedef: ' + (stage.goal || '');

      $$('#timeline .tl').forEach(function (b) {
        var i = parseInt(b.dataset.stage, 10);
        b.classList.toggle('is-active', i === stageIdx && !done);
        b.classList.toggle('is-done', i < stageIdx || done);
      });

      renderAllMoves();

      $('#guide-prev').disabled = pos === 0 || busy;
      $('#guide-next').disabled = done || busy;
      $('#guide-play').disabled = done || busy;
      $('#step-done').disabled = done || busy;
      $('#step-prev').disabled = si === 0 && pos === 0;
      $('#guide-next').innerHTML = done
        ? 'Bitti'
        : 'Sonraki hamle: <b style="font-family:Space Grotesk,monospace;margin-left:4px">' + flat[pos].move + '</b>';

      guide.highlight(done ? null : (step.targets || null));
    }

    function renderAllMoves() {
      var box = $('#all-moves');
      box.innerHTML = '';
      var idx = 0;
      solution.stages.forEach(function (stg) {
        var wrap = el('div', 'all-moves__stage');
        wrap.appendChild(el('div', 'all-moves__title', stg.title));
        stg.steps.forEach(function (st) {
          st.moves.forEach(function (mv) {
            var span = el('span', 'am' + (idx < pos ? ' is-done' : (idx === pos ? ' is-current' : '')), mv);
            wrap.appendChild(span);
            idx++;
          });
          wrap.appendChild(document.createTextNode(' '));
        });
        box.appendChild(wrap);
      });
    }

    function nextMove() {
      if (busy || pos >= flat.length) return;
      busy = true;
      renderGuide();
      var mv = flat[pos].move;
      sfx('turn');
      guide.move(mv).then(function () {
        pos++;
        busy = false;
        renderGuide();
        if (pos >= flat.length) { confetti(); sfx('solve'); }
      });
    }

    function prevMove() {
      if (busy || pos === 0) return;
      busy = true;
      renderGuide();
      pos--;
      var inv = Cube.invertMove(flat[pos].move);
      guide.move(inv).then(function () {
        busy = false;
        renderGuide();
      });
    }

    function finishStep() {
      if (busy || pos >= flat.length) return;
      var si = currentStepIndex();
      var step = solution.steps[si];
      var target = step.moveOffset + step.moves.length;
      busy = true;
      var rest = [];
      for (var i = pos; i < target; i++) rest.push(flat[i].move);
      guide.moves(rest, { duration: 90, onMove: function () { sfx('turn'); } }).then(function () {
        pos = target;
        busy = false;
        renderGuide();
        if (pos >= flat.length) { confetti(); sfx('solve'); }
      });
    }

    function prevStep() {
      if (busy) return;
      var si = currentStepIndex();
      var step = solution.steps[si];
      var target = (pos > step.moveOffset) ? step.moveOffset
        : (si > 0 ? solution.steps[si - 1].moveOffset : 0);
      pos = target;
      guide.setState(stateAt(pos));
      renderGuide();
    }

    /* Adımı bir kez izlet, sonra mevcut duruma dön */
    function watchStep() {
      if (busy || pos >= flat.length) return;
      var si = currentStepIndex();
      var step = solution.steps[si];
      var here = pos;
      var rest = [];
      for (var i = pos; i < step.moveOffset + step.moves.length; i++) rest.push(flat[i].move);
      if (!rest.length) return;
      busy = true;
      renderGuide();
      guide.moves(rest, { duration: 340, gap: 130, onMove: function () { sfx('turn'); } }).then(function () {
        return new Promise(function (r) { setTimeout(r, 700); });
      }).then(function () {
        guide.setState(stateAt(here));
        busy = false;
        renderGuide();
        toast('Şimdi sen yap: hamleleri tek tek uygula.', 2400);
      });
    }

    function solutionText() {
      var lines = ['Rubrik — küp çözüm yönergesi', ''];
      lines.push('Küpü şöyle tut: ' + colorName('D') + ' altta, ' + colorName('F') + ' önde.');
      lines.push('Toplam ' + flat.length + ' hamle.', '');
      solution.stages.forEach(function (stg, i) {
        lines.push((i + 1) + ') ' + stg.title + ' — ' + stg.goal);
        stg.steps.forEach(function (st) {
          lines.push('   ' + (st.title ? st.title + ': ' : '') + st.moves.join(' '));
        });
        lines.push('');
      });
      return lines.join('\n');
    }

    function copySolution() {
      var text = solutionText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('Çözüm kopyalandı.'); },
          function () { toast('Kopyalanamadı.'); });
      } else {
        var ta = el('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('Çözüm kopyalandı.'); } catch (e) { toast('Kopyalanamadı.'); }
        ta.remove();
      }
    }

    function printSolution() {
      var area = $('#print-area') || el('div');
      area.id = 'print-area';
      area.innerHTML = '';
      area.appendChild(el('h1', 'pr-h1', 'Rubrik — küp çözüm yönergesi'));
      area.appendChild(el('p', 'pr-sub', 'Küpü şöyle tut: ' + colorName('D') + ' altta, ' + colorName('F') + ' önde. Toplam ' + flat.length + ' hamle.'));
      solution.stages.forEach(function (stg, i) {
        var d = el('div', 'pr-stage');
        d.appendChild(el('h3', null, (i + 1) + ') ' + stg.title));
        d.appendChild(el('p', null, stg.intro + ' Hedef: ' + stg.goal));
        stg.steps.forEach(function (st) {
          var p = el('p', 'pr-step');
          if (st.title) p.appendChild(document.createTextNode(st.title + ': '));
          var b = el('b', null, st.moves.join(' '));
          p.appendChild(b);
          d.appendChild(p);
        });
        area.appendChild(d);
      });
      if (!area.parentNode) document.body.appendChild(area);
      window.print();
    }

    function onKey(ev) {
      if (currentView !== 'solve') return;
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      if (!$('#solve-guide').hidden) {
        if (ev.key === 'ArrowRight' || ev.code === 'Space') { ev.preventDefault(); nextMove(); }
        else if (ev.key === 'ArrowLeft') { ev.preventDefault(); prevMove(); }
        else if (ev.key === 'Enter') { ev.preventDefault(); finishStep(); }
        return;
      }
      // renk girişi kısayolları
      var n = parseInt(ev.key, 10);
      if (n >= 1 && n <= 6) {
        ev.preventDefault();
        setActive(FACES[n - 1]);
        var idx = ORDER[cursor];
        if (idx !== undefined) onCellClick(idx);
        return;
      }
      if (ev.key === 'Backspace') {
        ev.preventDefault();
        if (cursor > 0) cursor--;
        var i2 = ORDER[cursor];
        undoStack.push({ idx: i2, prev: colors[i2] });
        colors[i2] = null;
        refresh();
        return;
      }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); cursor = Math.min(ORDER.length - 1, cursor + 1); refresh(); }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); cursor = Math.max(0, cursor - 1); refresh(); }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); cursor = Math.min(ORDER.length - 1, cursor + 3); refresh(); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); cursor = Math.max(0, cursor - 3); refresh(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); }
    }

    return { init: init, onShow: onShow, onKey: onKey, refreshColors: function () { refreshPaletteNames(); refresh(); } };
  })();

  /* ==================================================================
     ÖĞREN
     ================================================================== */

  var learnMod = (function () {
    var scene = null;
    var cube = Cube.solved();
    var built = false;

    function onShow() {
      if (!scene) {
        scene = Scene.create({ mount: $('#learn-stage'), zoom: 6.0, zoom0: 6.0 });
        scene.setSpeed(260);
        scene.orbit(-0.66, 0.5);
      }
      if (!built) { build(); built = true; }
    }

    function play(moves) {
      var list = typeof moves === 'string' ? Cube.parseAlg(moves) : moves;
      list.forEach(function (mv) { cube = Cube.applyMove(cube, mv); });
      scene.moves(list, { gap: 40, onMove: function () { sfx('turn'); } });
    }

    function build() {
      var ng = $('#notation-grid');
      ng.innerHTML = '';
      Content.NOTATION.forEach(function (n) {
        var b = el('button', 'nt');
        b.type = 'button';
        b.appendChild(el('span', 'nt__m', n.move));
        b.appendChild(el('span', 'nt__d', n.desc));
        b.addEventListener('click', function () { play([n.move]); });
        ng.appendChild(b);
      });

      var ml = $('#method-list');
      ml.innerHTML = '';
      Content.METHOD.forEach(function (m, i) {
        var li = el('li', 'mt');
        var head = el('div', 'mt__head');
        head.appendChild(el('span', 'mt__n', String(i + 1)));
        head.appendChild(el('span', 'mt__t', m.title));
        li.appendChild(head);
        li.appendChild(el('p', 'mt__b', m.body));
        li.appendChild(el('p', 'mt__goal', 'Hedef: ' + m.goal));
        ml.appendChild(li);
      });

      var ag = $('#algs-grid');
      ag.innerHTML = '';
      Content.ALG_CARDS.forEach(function (a) {
        var b = el('button', 'ag');
        b.type = 'button';
        b.appendChild(el('span', 'ag__t', a.name));
        b.appendChild(el('span', 'ag__m', a.alg));
        b.appendChild(el('span', 'ag__d', a.when));
        b.addEventListener('click', function () { play(a.alg); toast(a.name + ' oynatılıyor.'); });
        ag.appendChild(b);
      });

      $('#learn-reset').addEventListener('click', function () {
        cube = Cube.solved();
        scene.setState(cube);
      });
      $('#learn-scramble').addEventListener('click', function () {
        var scr = Cube.randomScramble(18);
        play(scr);
      });
    }

    return { onShow: onShow };
  })();

  /* ==================================================================
     Açılış
     ================================================================== */

  function boot() {
    applyTheme();
    applyColors();

    $('#theme-btn').addEventListener('click', function () {
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
      store(LS.settings, settings);
      applyTheme();
    });

    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () { showView(t.dataset.view); });
    });

    playMod.init();
    solveMod.init();

    document.addEventListener('keydown', function (ev) {
      playMod.onKey(ev);
      solveMod.onKey(ev);
    });

    var hash = location.hash.slice(1);
    showView(['play', 'solve', 'learn'].indexOf(hash) >= 0 ? hash : 'play');

    // çapraz tablo hazırlığını boş zamana bırak
    var idle = root.requestIdleCallback || function (fn) { return setTimeout(fn, 900); };
    idle(function () { try { Solver.buildCrossTable(); } catch (e) { /* yoksay */ } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
