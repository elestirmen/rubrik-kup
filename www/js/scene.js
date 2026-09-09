/* =====================================================================
   scene.js — CSS 3B küp görüntüleyici
   * 26 kübik parça, her biri matrix3d ile yerleştirilir
   * Katman dönüşü: 9 parça geçici bir sarmalayıcıya alınıp döndürülür,
     bitince dönüş parçaların kendi matrisine işlenir
   * Işık: yüz normallerinin görünüm matrisiyle döndürülmüş hali üzerinden
     hesaplanır, CSS değişkenleri olarak yazılır (kare başına stil yazılmaz)
   * Etkileşim: boşlukta sürükleme -> yörünge, kare üzerinde sürükleme -> katman
   ===================================================================== */
(function (root) {
  'use strict';

  var Cube = root.Cube, Geom = root.Geom;

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  var LIGHT = normalize([-0.24, 0.78, 0.58]);
  var KEY_MAP = { U: 'u', R: 'r', F: 'f', D: 'd', L: 'l', B: 'b' };

  function normalize(v) {
    var n = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function rotAxisAngle(axis, rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
    if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  }

  /* Kendi sağ elli uzayımızdan (y yukarı) CSS uzayına (y aşağı) matris */
  function cssMatrix(m, tx, ty, tz) {
    var a0 = m[0], a1 = -m[1], a2 = m[2];
    var a3 = -m[3], a4 = m[4], a5 = -m[5];
    var a6 = m[6], a7 = -m[7], a8 = m[8];
    return 'matrix3d(' +
      a0.toFixed(6) + ',' + a3.toFixed(6) + ',' + a6.toFixed(6) + ',0,' +
      a1.toFixed(6) + ',' + a4.toFixed(6) + ',' + a7.toFixed(6) + ',0,' +
      a2.toFixed(6) + ',' + a5.toFixed(6) + ',' + a8.toFixed(6) + ',0,' +
      tx.toFixed(3) + ',' + (-ty).toFixed(3) + ',' + tz.toFixed(3) + ',1)';
  }

  /* Mantıksal yuva -> uzamsal konum (vurgu için) */
  function cornerSlotPos(slot) {
    var fl = Cube.CORNER_FACELET[slot][0];
    return faceletIndexToPos(fl);
  }
  function edgeSlotPos(slot) {
    var fl = Cube.EDGE_FACELET[slot][0];
    return faceletIndexToPos(fl);
  }
  function faceletIndexToPos(idx) {
    var face = FACES[Math.floor(idx / 9)];
    return Geom.faceletPos(face, idx % 9);
  }

  function create(opts) {
    var mount = opts.mount;
    var interactive = opts.interactive !== false;
    var onUserMove = opts.onUserMove || null;
    var onOrbit = opts.onOrbit || null;

    var state = {
      yaw: -0.62, pitch: 0.52,
      spin: 0, speed: 220,
      busy: false,
      queue: Promise.resolve(),
      cs: 60,
      destroyed: false
    };

    mount.classList.add('cube-stage');
    mount.innerHTML = '';

    var glow = document.createElement('div');
    glow.className = 'cube-stage__glow';
    var drop = document.createElement('div');
    drop.className = 'cube-stage__drop';
    var worldEl = document.createElement('div');
    worldEl.className = 'cube-world';
    var rootEl = document.createElement('div');
    rootEl.className = 'cube-root';
    worldEl.appendChild(rootEl);
    mount.appendChild(glow);
    mount.appendChild(drop);
    mount.appendChild(worldEl);

    if (opts.badge) {
      var badge = document.createElement('div');
      badge.className = 'cube-stage__badge';
      badge.textContent = opts.badge;
      mount.appendChild(badge);
    }

    /* ---- parçaları kur ---- */
    var cubies = Geom.createCubies();
    cubies.forEach(function (cu) {
      var el = document.createElement('div');
      el.className = 'cubie';
      cu.el = el;
      cu.facets = {};
      for (var i = 0; i < FACES.length; i++) {
        var f = FACES[i];
        var facet = document.createElement('div');
        facet.className = 'facet';
        facet.dataset.local = f;
        facet.dataset.dir = f;
        var st = document.createElement('div');
        st.className = 'sticker';
        st.hidden = true;
        facet.appendChild(st);
        facet._sticker = st;
        facet._cubie = cu;
        el.appendChild(facet);
        cu.facets[f] = facet;
      }
      rootEl.appendChild(el);
    });

    /* ---- boyut ---- */
    function measure() {
      var w = mount.clientWidth || 320;
      var h = mount.clientHeight || 320;
      var cs = Math.max(22, Math.min(w, h) / (opts.zoom || 5.9));
      state.cs = cs;
      mount.style.setProperty('--cs', cs.toFixed(2) + 'px');
      paintTransforms();
    }

    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(mount);
    } else {
      window.addEventListener('resize', measure);
    }

    /* ---- yerleştirme ---- */
    function paintTransforms() {
      var cs = state.cs;
      for (var i = 0; i < cubies.length; i++) {
        var cu = cubies[i];
        cu.el.style.transform = cssMatrix(cu.mat, cu.pos[0] * cs, cu.pos[1] * cs, cu.pos[2] * cs);
      }
    }

    function refreshDirs() {
      for (var i = 0; i < cubies.length; i++) {
        var cu = cubies[i];
        for (var f = 0; f < FACES.length; f++) {
          var local = FACES[f];
          var world = Geom.dirName(Geom.matVec(cu.mat, Geom.FACE_NORMAL[local]));
          cu.facets[local].dataset.dir = world;
        }
      }
    }

    function viewMatrix() {
      return Geom.matMul(rotAxisAngle('x', state.pitch), rotAxisAngle('y', state.yaw));
    }

    function shadeFor(nWorld) {
      var d = Math.max(0, dot(nWorld, LIGHT));
      var amb = 0.38 - 0.36 * Math.pow(d, 0.75);
      return clamp(amb, 0.01, 0.4);
    }

    function updateShading(V, layerMat) {
      var s = mount.style;
      for (var i = 0; i < FACES.length; i++) {
        var f = FACES[i];
        var n = Geom.matVec(V, Geom.FACE_NORMAL[f]);
        s.setProperty('--sh-' + KEY_MAP[f], shadeFor(n).toFixed(3));
        if (layerMat) {
          var nl = Geom.matVec(V, Geom.matVec(layerMat, Geom.FACE_NORMAL[f]));
          s.setProperty('--shl-' + KEY_MAP[f], shadeFor(nl).toFixed(3));
        } else {
          s.setProperty('--shl-' + KEY_MAP[f], shadeFor(n).toFixed(3));
        }
      }
    }

    function updateWorld(layerMat) {
      var V = viewMatrix();
      worldEl.style.transform = cssMatrix(V, 0, 0, 0);
      updateShading(V, layerMat);
      mount.style.setProperty('--drop-scale', (0.55 + 0.6 * Math.abs(Math.cos(state.pitch))).toFixed(3));
      if (onOrbit) onOrbit(state.yaw, state.pitch);
    }

    /* ---- durum boyama ---- */
    function setState(cubeState) {
      setFacelets(Cube.toFacelets(cubeState));
    }

    /* 54 elemanlı facelet dizisinden boya. Boş (null) kareler sönük kalır. */
    function setFacelets(facelets) {
      // parçaları evine döndür
      var home = Geom.createCubies();
      for (var i = 0; i < cubies.length; i++) {
        cubies[i].pos = home[i].pos.slice();
        cubies[i].mat = Geom.IDENT.slice();
        cubies[i].stickers = {};
        for (var f = 0; f < FACES.length; f++) {
          var face = FACES[f];
          var n = Geom.FACE_NORMAL[face];
          var p = cubies[i].pos;
          var facet = cubies[i].facets[face];
          if (p[0] * n[0] + p[1] * n[1] + p[2] * n[2] === 1) {
            var idx = Geom.posToFacelet(face, p);
            var color = facelets[FACES.indexOf(face) * 9 + idx];
            cubies[i].stickers[face] = color;
            facet._sticker.hidden = false;
            if (color) {
              facet._sticker.classList.remove('sticker--empty');
              facet._sticker.dataset.color = color;
            } else {
              facet._sticker.classList.add('sticker--empty');
              delete facet._sticker.dataset.color;
            }
          } else {
            facet._sticker.hidden = true;
            delete facet._sticker.dataset.color;
          }
        }
      }
      paintTransforms();
      refreshDirs();
      updateWorld();
    }

    /* ---- hareket animasyonu ---- */
    function animateMove(move, duration) {
      return new Promise(function (resolve) {
        var face = move[0];
        var suffix = move.slice(1);
        var quarters = suffix === '2' ? 2 : (suffix === "'" ? -1 : 1);
        var axis = Geom.MOVE_AXIS[face];
        var n = Geom.FACE_NORMAL[face];
        var sign = (n[0] + n[1] + n[2]) > 0 ? -1 : 1;
        var target = sign * quarters * Math.PI / 2;

        var layerEl = document.createElement('div');
        layerEl.className = 'cube-layer';
        var moving = [];
        for (var i = 0; i < cubies.length; i++) {
          if (Geom.inLayer(cubies[i].pos, face)) {
            moving.push(cubies[i]);
            layerEl.appendChild(cubies[i].el);
          }
        }
        rootEl.appendChild(layerEl);

        function finish() {
          Geom.applyMoveGeom(cubies, move);
          for (var j = 0; j < moving.length; j++) rootEl.appendChild(moving[j].el);
          layerEl.remove();
          paintTransforms();
          refreshDirs();
          updateWorld();
          resolve();
        }

        if (duration <= 0) { finish(); return; }

        var t0 = null;
        function frame(now) {
          if (state.destroyed) { finish(); return; }
          if (t0 === null) t0 = now;
          var p = Math.min(1, (now - t0) / duration);
          var rad = target * easeInOut(p);
          var m = rotAxisAngle(axis, rad);
          layerEl.style.transform = cssMatrix(m, 0, 0, 0);
          updateWorld(m);
          if (p < 1) requestAnimationFrame(frame);
          else finish();
        }
        requestAnimationFrame(frame);
      });
    }

    /* ---- kuyruk ---- */
    function enqueue(moves, options) {
      options = options || {};
      var list = typeof moves === 'string' ? Cube.parseAlg(moves) : moves.slice();
      var dur = options.duration === undefined ? state.speed : options.duration;
      var gap = options.gap === undefined ? 0 : options.gap;
      state.queue = state.queue.then(function () {
        var chain = Promise.resolve();
        list.forEach(function (mv, i) {
          chain = chain.then(function () {
            if (options.onMove) options.onMove(mv, i);
            return animateMove(mv, dur);
          });
          if (gap) chain = chain.then(function () { return wait(gap); });
        });
        return chain;
      });
      return state.queue;
    }

    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    /* ---- vurgu ---- */
    function highlight(targets) {
      for (var i = 0; i < cubies.length; i++) cubies[i].el.classList.remove('is-target');
      if (!targets) return;
      var list = [];
      if (targets.corners) targets.corners.forEach(function (c) { list.push(cornerSlotPos(c)); });
      if (targets.edges) targets.edges.forEach(function (e) { list.push(edgeSlotPos(e)); });
      list.forEach(function (pos) {
        var cu = Geom.cubieAt(cubies, pos);
        if (cu) cu.el.classList.add('is-target');
      });
    }

    /* ---- yörünge ve sürükleyerek döndürme ---- */
    var drag = null;
    var pointers = new Map();
    var pinchStart = null;

    function projectScreen(V, w) {
      var v = Geom.matVec(V, w);
      return [v[0], -v[1]];
    }

    function pickMove(facet, cubie, dx, dy) {
      var V = viewMatrix();
      var dName = facet.dataset.dir;
      var d = Geom.FACE_NORMAL[dName];
      var axes = [];
      var basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      for (var i = 0; i < 3; i++) {
        if (Math.abs(dot(basis[i], d)) > 0.5) continue;
        axes.push(basis[i]);
        axes.push([-basis[i][0], -basis[i][1], -basis[i][2]]);
      }
      var dragLen = Math.hypot(dx, dy) || 1;
      var best = null, bestScore = -Infinity;
      for (var a = 0; a < axes.length; a++) {
        var sp = projectScreen(V, axes[a]);
        var spLen = Math.hypot(sp[0], sp[1]) || 1;
        var score = (sp[0] * dx + sp[1] * dy) / (spLen * dragLen);
        if (score > bestScore) { bestScore = score; best = axes[a]; }
      }
      if (!best || bestScore < 0.25) return null;
      var r = cross(d, best).map(Math.round);
      var k = dot(cubie.pos, r);
      if (Math.abs(k) !== 1) return null; // orta dilim: yörünge olarak ele al
      var faceName = null;
      for (var f = 0; f < FACES.length; f++) {
        var n = Geom.FACE_NORMAL[FACES[f]];
        if (dot(n, r) === k) { faceName = FACES[f]; break; }
      }
      if (!faceName) return null;
      var nFace = Geom.FACE_NORMAL[faceName];
      return dot(nFace, r) === 1 ? faceName + "'" : faceName;
    }

    function onPointerDown(ev) {
      if (!interactive) return;
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        pinchStart = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom: opts.zoom || 5.9 };
        drag = null;
        return;
      }
      var facet = ev.target.closest ? ev.target.closest('.facet') : null;
      drag = {
        id: ev.pointerId,
        x0: ev.clientX, y0: ev.clientY,
        yaw0: state.yaw, pitch0: state.pitch,
        facet: facet && facet._cubie ? facet : null,
        mode: 'idle'
      };
      mount.classList.add('is-grabbing');
      mount.setPointerCapture && mount.setPointerCapture(ev.pointerId);
    }

    function onPointerMove(ev) {
      if (!interactive) return;
      if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size === 2 && pinchStart) {
        var pts = Array.from(pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        var ratio = d / (pinchStart.dist || 1);
        opts.zoom = clamp(pinchStart.zoom / ratio, 4.2, 11);
        measure();
        return;
      }
      if (!drag || drag.id !== ev.pointerId) return;
      var dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      if (drag.mode === 'idle') {
        if (Math.hypot(dx, dy) < 14) return;
        if (drag.facet && !state.busy) {
          var mv = pickMove(drag.facet, drag.facet._cubie, dx, dy);
          if (mv) {
            drag.mode = 'done';
            if (onUserMove) onUserMove(mv);
            return;
          }
        }
        drag.mode = 'orbit';
      }
      if (drag.mode === 'orbit') {
        state.yaw = drag.yaw0 + dx * 0.0102;
        state.pitch = clamp(drag.pitch0 + dy * 0.0092, -1.35, 1.35);
        updateWorld();
      }
    }

    function onPointerUp(ev) {
      pointers.delete(ev.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (drag && drag.id === ev.pointerId) drag = null;
      mount.classList.remove('is-grabbing');
    }

    function onWheel(ev) {
      if (!interactive) return;
      ev.preventDefault();
      opts.zoom = clamp((opts.zoom || 5.9) + (ev.deltaY > 0 ? 0.4 : -0.4), 4.2, 11);
      measure();
    }

    if (interactive) {
      mount.addEventListener('pointerdown', onPointerDown);
      mount.addEventListener('pointermove', onPointerMove);
      mount.addEventListener('pointerup', onPointerUp);
      mount.addEventListener('pointercancel', onPointerUp);
      mount.addEventListener('pointerleave', onPointerUp);
      mount.addEventListener('wheel', onWheel, { passive: false });
    }

    /* ---- kendiliğinden dönme ---- */
    var spinRaf = null;
    function spinFrame() {
      if (state.destroyed || !state.spin) { spinRaf = null; return; }
      state.yaw += state.spin;
      updateWorld();
      spinRaf = requestAnimationFrame(spinFrame);
    }
    function setSpin(v) {
      state.spin = v || 0;
      if (state.spin && !spinRaf) spinRaf = requestAnimationFrame(spinFrame);
    }

    /* ---- kurulum ---- */
    measure();
    setState(Cube.solved());
    updateWorld();

    return {
      el: mount,
      cubies: cubies,
      setState: setState,
      setFacelets: setFacelets,
      move: function (mv, options) { return enqueue([mv], options); },
      moves: enqueue,
      highlight: highlight,
      setSpeed: function (ms) { state.speed = ms; },
      getSpeed: function () { return state.speed; },
      setSpin: setSpin,
      setZoom: function (z) { opts.zoom = clamp(z, 4.2, 11); measure(); },
      orbit: function (yaw, pitch) {
        if (yaw !== undefined) state.yaw = yaw;
        if (pitch !== undefined) state.pitch = clamp(pitch, -1.35, 1.35);
        updateWorld();
      },
      resetView: function () { state.yaw = -0.62; state.pitch = 0.52; opts.zoom = opts.zoom0 || 5.9; measure(); updateWorld(); },
      idle: function () { return state.queue; },
      setBusy: function (v) { state.busy = !!v; },
      /* geliştirme denetimi: 3B modelin renkleri mantıksal durumla aynı mı */
      facelets: function () {
        return Geom.geomToFacelets(cubies).join('');
      },
      destroy: function () {
        state.destroyed = true;
        if (ro) ro.disconnect();
        mount.innerHTML = '';
      }
    };
  }

  root.Scene = { create: create };
})(window);
