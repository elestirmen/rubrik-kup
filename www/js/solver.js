/* =====================================================================
   solver.js — Katman katman (başlangıç yöntemi) çözücü
   Çıktı: insanın takip edebileceği, açıklamalı adımlar.
   Yöntem:
     1) Alt artı      -> indirgenmiş durum uzayında BFS mesafe tablosu (en kısa)
     2) Alt köşeler   -> algoritma havuzunda arama (parça parça)
     3) Orta katman   -> algoritma havuzunda arama (parça parça)
     4) Üst artı      -> F R U R' U' F' havuzu
     5) Üst yüz       -> Sune / Anti-Sune havuzu
     6) Üst köşeler   -> A-perm (3'lü döngü) + T/Y-perm (parite durumu)
     7) Üst kenarlar  -> U-perm / H-perm
   ===================================================================== */
(function (root, factory) {
  'use strict';
  var Cube = (typeof module === 'object' && module.exports) ? require('./cube.js') : root.Cube;
  var api = factory(Cube);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Solver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Cube) {
  'use strict';

  var E = Cube.EDGE, K = Cube.CORNER;

  /* ------------------------------------------------------------------
     Algoritma tanımları. Her biri "ön-sağ" konumu için yazılmıştır;
     diğer konumlar y ekseni etrafında harf kaydırmayla üretilir.
     ------------------------------------------------------------------ */

  var CORNER_ALGS = [
    { alg: "R U R'", name: "Sağ el", note: "Köşeyi sağ eliyle yuvasına indirir." },
    { alg: "R U' R'", name: "Sağ el (ters)", note: "Köşeyi ters yönden yuvasına indirir." },
    { alg: "R U2 R'", name: "Sağ el (çift)", note: "Köşeyi yarım tur çevirip indirir." },
    { alg: "F' U F", name: "Sol el", note: "Köşeyi ön yüzden yuvasına indirir." },
    { alg: "F' U' F", name: "Sol el (ters)", note: "Köşeyi ön yüzden ters yönde indirir." },
    { alg: "F' U2 F", name: "Sol el (çift)", note: "Köşeyi ön yüzden yarım turla indirir." }
  ];
  var CORNER_EJECT = { alg: "R U R'", name: "Köşeyi çıkar", note: "Yanlış yuvadaki köşeyi üst katmana çıkarır." };

  var MIDDLE_ALGS = [
    { alg: "U R U' R' U' F' U F", name: "Sağa ekleme", note: "Kenarı sağ taraftan orta katmana sokar." },
    { alg: "U' F' U F U R U' R'", name: "Sola ekleme", note: "Kenarı sol taraftan orta katmana sokar." }
  ];

  var OLL_CROSS_ALGS = [
    { alg: "F R U R' U' F'", name: "Artı algoritması", note: "Üst kenarların yönünü düzeltir." },
    { alg: "F U R U' R' F'", name: "Artı algoritması (2)", note: "Nokta durumunda kısa yol sağlar." }
  ];

  var COLL_ALGS = [
    { alg: "R U R' U R U2 R'", name: "Sune", note: "Üç köşeyi saat yönünde çevirir." },
    { alg: "R U2 R' U' R U' R'", name: "Anti-Sune", note: "Üç köşeyi ters yönde çevirir." }
  ];

  var CPLL_ALGS = [
    { alg: "R' F R' B2 R F' R' B2 R2", name: "A-perm", note: "Üç köşeyi yer değiştirir, yönlerini bozmaz." },
    { alg: "R2 B2 R F R' B2 R F' R", name: "A-perm (ters)", note: "Üç köşeyi diğer yönde döndürür." },
    { alg: "R U R' U' R' F R2 U' R' U' R U R' F'", name: "T-perm", note: "Komşu iki köşeyi (ve iki kenarı) takas eder." },
    { alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'", name: "Y-perm", note: "Çapraz iki köşeyi (ve iki kenarı) takas eder." }
  ];

  var EPLL_ALGS = [
    { alg: "R U' R U R U R U' R' U' R2", name: "U-perm", note: "Üç üst kenarı döndürür." },
    { alg: "R2 U R U R' U' R' U' R' U R'", name: "U-perm (ters)", note: "Üç üst kenarı ters yönde döndürür." },
    { alg: "R2 U2 R U2 R2 U2 R2 U2 R U2 R2", name: "H-perm", note: "Karşılıklı iki kenar çiftini takas eder." }
  ];

  var AUF_PREFIX = ['', 'U', 'U2', "U'"];

  /* Havuz üretimi: y kaydırması (slot) + AUF ön eki */
  function buildMacros(algs, slotK, aufList) {
    var out = [];
    aufList = aufList || AUF_PREFIX;
    for (var i = 0; i < algs.length; i++) {
      var base = Cube.rotateAlg(Cube.parseAlg(algs[i].alg), slotK);
      for (var a = 0; a < aufList.length; a++) {
        var pre = aufList[a] ? Cube.parseAlg(aufList[a]) : [];
        var moves = Cube.simplify(pre.concat(base));
        if (!moves.length) continue;
        out.push({
          moves: moves,
          name: algs[i].name,
          note: algs[i].note,
          setup: aufList[a],
          baseAlg: algs[i].alg
        });
      }
    }
    return out;
  }

  function pureAuf() {
    return [
      { moves: ['U'], name: 'Hizalama', note: 'Üst katmanı çevirerek doğru konuma getirir.', setup: 'U', baseAlg: 'U' },
      { moves: ['U2'], name: 'Hizalama', note: 'Üst katmanı yarım tur çevirir.', setup: 'U2', baseAlg: 'U2' },
      { moves: ["U'"], name: 'Hizalama', note: 'Üst katmanı ters yönde çevirir.', setup: "U'", baseAlg: "U'" }
    ];
  }

  /* ------------------------------------------------------------------
     Durum anahtarı ve hedef testleri
     ------------------------------------------------------------------ */

  function stateKey(s) {
    var a = new Array(40), i, n = 0;
    for (i = 0; i < 8; i++) a[n++] = s.cp[i] * 3 + s.co[i];
    for (i = 0; i < 12; i++) a[n++] = s.ep[i] * 2 + s.eo[i];
    return String.fromCharCode.apply(null, a);
  }

  var CROSS_EDGES = [E.DF, E.DR, E.DB, E.DL];
  var D_CORNERS = [K.DFR, K.DRB, K.DBL, K.DLF];
  var MIDDLE_EDGES = [E.FR, E.BR, E.BL, E.FL];
  var U_CORNERS = [K.URF, K.UFL, K.ULB, K.UBR];
  var U_EDGES = [E.UR, E.UF, E.UL, E.UB];

  function crossDone(s) {
    for (var i = 0; i < 4; i++) if (!Cube.edgeSolved(s, CROSS_EDGES[i])) return false;
    return true;
  }
  function edgesSolved(s, list) {
    for (var i = 0; i < list.length; i++) if (!Cube.edgeSolved(s, list[i])) return false;
    return true;
  }
  function cornersSolved(s, list) {
    for (var i = 0; i < list.length; i++) if (!Cube.cornerSolved(s, list[i])) return false;
    return true;
  }
  function uEdgesOriented(s) {
    for (var i = 0; i < 4; i++) if (s.eo[U_EDGES[i]] !== 0) return false;
    return true;
  }
  function uCornersOriented(s) {
    for (var i = 0; i < 4; i++) if (s.co[U_CORNERS[i]] !== 0) return false;
    return true;
  }
  /* Üst katman bir U dönüşüyle yerine oturuyor mu? */
  function upToAuf(s, test) {
    var cur = s;
    for (var k = 0; k < 4; k++) {
      if (test(cur)) return k;
      cur = Cube.applyMove(cur, 'U');
    }
    return -1;
  }
  function uCornersPlaced(s) {
    return cornersSolved(s, U_CORNERS);
  }

  /* ------------------------------------------------------------------
     Alt artı: indirgenmiş durum uzayında BFS mesafe tablosu
     Durum = 4 alt kenarın (yuva, yön) bilgisi -> 24^4 = 331776 olasılık
     ------------------------------------------------------------------ */

  var crossTable = null;
  var edgeStep = null; // edgeStep[moveId][code] -> yeni code

  function buildEdgeStep() {
    edgeStep = [];
    for (var m = 0; m < Cube.MOVE_NAMES.length; m++) {
      var mv = Cube.applyMove(Cube.solved(), Cube.MOVE_NAMES[m]); // hareketin kendi tablosu
      var invEp = new Array(12);
      for (var i = 0; i < 12; i++) invEp[mv.ep[i]] = i;
      var tab = new Uint8Array(24);
      for (var slot = 0; slot < 12; slot++) {
        var dest = invEp[slot];
        for (var flip = 0; flip < 2; flip++) {
          tab[slot * 2 + flip] = dest * 2 + ((flip + mv.eo[dest]) % 2);
        }
      }
      edgeStep.push(tab);
    }
  }

  function crossCode(s) {
    var code = 0;
    for (var i = 3; i >= 0; i--) {
      var piece = CROSS_EDGES[i];
      var slot = Cube.findEdge(s, piece);
      code = code * 24 + slot * 2 + s.eo[slot];
    }
    return code;
  }

  function buildCrossTable() {
    if (crossTable) return crossTable;
    if (!edgeStep) buildEdgeStep();
    var SIZE = 24 * 24 * 24 * 24;
    var dist = new Int8Array(SIZE);
    dist.fill(-1);
    // hedef: her kenar kendi yuvasında ve düz
    var goal = 0;
    for (var i = 3; i >= 0; i--) goal = goal * 24 + CROSS_EDGES[i] * 2;
    dist[goal] = 0;
    var queue = new Int32Array(SIZE);
    queue[0] = goal;
    var head = 0, tail = 1;
    while (head < tail) {
      var cur = queue[head++];
      var d = dist[cur];
      var c0 = cur % 24, c1 = Math.floor(cur / 24) % 24, c2 = Math.floor(cur / 576) % 24, c3 = Math.floor(cur / 13824) % 24;
      for (var m = 0; m < 18; m++) {
        var t = edgeStep[m];
        var nxt = t[c0] + 24 * (t[c1] + 24 * (t[c2] + 24 * t[c3]));
        if (dist[nxt] === -1) {
          dist[nxt] = d + 1;
          queue[tail++] = nxt;
        }
      }
    }
    crossTable = dist;
    return dist;
  }

  function solveCross(state) {
    var dist = buildCrossTable();
    var code = crossCode(state);
    var moves = [];
    var guard = 0;
    while (dist[code] > 0 && guard++ < 20) {
      var d = dist[code];
      var c0 = code % 24, c1 = Math.floor(code / 24) % 24, c2 = Math.floor(code / 576) % 24, c3 = Math.floor(code / 13824) % 24;
      var picked = -1, pickedCode = -1;
      for (var m = 0; m < 18; m++) {
        var t = edgeStep[m];
        var nxt = t[c0] + 24 * (t[c1] + 24 * (t[c2] + 24 * t[c3]));
        if (dist[nxt] === d - 1) { picked = m; pickedCode = nxt; break; }
      }
      if (picked < 0) return null;
      moves.push(Cube.MOVE_NAMES[picked]);
      code = pickedCode;
    }
    return dist[code] === 0 ? moves : null;
  }

  /* ------------------------------------------------------------------
     Havuz araması (genişlik öncelikli, makro sayısına göre en kısa)
     ------------------------------------------------------------------ */

  function pathMoveCount(path) {
    var n = 0;
    for (var i = 0; i < path.length; i++) n += path[i].moves.length;
    return n;
  }

  function searchMacros(state, macros, goalFn, maxDepth) {
    if (goalFn(state)) return [];
    var seen = Object.create(null);
    seen[stateKey(state)] = 1;
    var frontier = [{ state: state, path: [] }];
    for (var d = 1; d <= maxDepth; d++) {
      var next = [];
      var best = null, bestLen = Infinity;
      for (var i = 0; i < frontier.length; i++) {
        var node = frontier[i];
        for (var j = 0; j < macros.length; j++) {
          var mac = macros[j];
          var st = Cube.applyAlg(node.state, mac.moves);
          var k = stateKey(st);
          if (seen[k]) continue;
          seen[k] = 1;
          var path = node.path.concat([mac]);
          if (goalFn(st)) {
            var len = pathMoveCount(path);
            if (len < bestLen) { best = path; bestLen = len; }
          } else if (d < maxDepth) {
            next.push({ state: st, path: path });
          }
        }
      }
      if (best) return best;
      frontier = next;
      if (!frontier.length) break;
    }
    return null;
  }

  /* ------------------------------------------------------------------
     Aşamalar
     ------------------------------------------------------------------ */

  var STAGE_META = [
    {
      key: 'cross', title: 'Alt Artı',
      goal: 'Alt yüzde artı: 4 kenar alt yüzde, yan renkleri merkezlerle eşleşmiş.',
      intro: 'İlk hedef, alt yüzün merkeziyle aynı renkte olan 4 kenar parçasını alt yüze getirmek. ' +
             'Kenarların yandaki renkleri de komşu merkezlerle aynı olmalı; yoksa artı "yanlış" olur.'
    },
    {
      key: 'corners', title: 'Alt Köşeler',
      goal: 'İlk katman tamam: alt yüz tek renk, yan şeritler eşleşmiş.',
      intro: 'Şimdi alt katmanın 4 köşesini yerleştiriyoruz. Her köşeyi önce üst katmanda hedef yuvasının ' +
             'tam üstüne getirip, sonra sağ/sol el hareketiyle aşağı indiriyoruz.'
    },
    {
      key: 'middle', title: 'Orta Katman',
      goal: 'Alt iki katman tamam.',
      intro: 'Orta katmanın 4 kenarını yerine sokuyoruz. Kenarı üst katmanda hedef yuvasının yanına ' +
             'getirip sağa veya sola ekleme hareketini uyguluyoruz.'
    },
    {
      key: 'ollEdges', title: 'Üst Artı',
      goal: 'Üst yüzde artı şekli.',
      intro: 'Üst yüzde artı oluşturuyoruz. Burada sadece kenarların yönü önemli; yerleri şimdilik önemsiz.'
    },
    {
      key: 'ollCorners', title: 'Üst Yüzü Tamamla',
      goal: 'Üst yüz tamamen tek renk.',
      intro: 'Üst köşeleri çevirerek üst yüzü tek renk yapıyoruz. Sune ailesindeki hareketi doğru köşeyi ' +
             'sağ-ön üstte tutarak tekrarlıyoruz.'
    },
    {
      key: 'cpll', title: 'Köşeleri Yerleştir',
      goal: 'Üst köşeler doğru köşelerde.',
      intro: 'Üst köşeleri kendi köşelerine taşıyoruz. Bu adımda köşelerin yönü bozulmaz, sadece yer değişir.'
    },
    {
      key: 'epll', title: 'Kenarları Yerleştir',
      goal: 'Küp çözüldü.',
      intro: 'Son olarak üst kenarları yerine taşıyoruz. Bu adım bitince küp tamamen çözülür.'
    }
  ];

  function stepFrom(macro, extra) {
    var step = {
      moves: macro.moves.slice(),
      name: macro.name,
      note: macro.note,
      setup: macro.setup || '',
      baseAlg: macro.baseAlg || ''
    };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) step[k] = extra[k];
    return step;
  }

  var SLOT_LABEL_CORNER = { 4: 'ön-sağ', 7: 'arka-sağ', 6: 'arka-sol', 5: 'ön-sol' };
  var SLOT_LABEL_EDGE = { 8: 'ön-sağ', 11: 'arka-sağ', 10: 'arka-sol', 9: 'ön-sol' };

  function solve(startState) {
    var state = Cube.clone(startState);
    var stages = [];
    var failure = null;

    function pushStage(meta, steps) {
      stages.push({
        key: meta.key, title: meta.title, goal: meta.goal, intro: meta.intro, steps: steps
      });
    }

    /* 1) Alt artı */
    var crossSteps = [];
    if (!crossDone(state)) {
      var crossMoves = solveCross(state);
      if (!crossMoves) { failure = 'Alt artı çözülemedi.'; }
      else if (crossMoves.length) {
        crossSteps.push({
          moves: Cube.simplify(crossMoves),
          name: 'Artıyı kur',
          note: 'Bu hareket dizisi 4 alt kenarı en kısa yoldan yerine getirir.',
          setup: '', baseAlg: '',
          targets: { edges: CROSS_EDGES.slice() }
        });
        state = Cube.applyAlg(state, crossMoves);
      }
    }
    pushStage(STAGE_META[0], crossSteps);

    /* 2) Alt köşeler */
    var cornerSteps = [];
    if (!failure) {
      var doneCorners = [];
      for (var ci = 0; ci < D_CORNERS.length; ci++) {
        var slot = D_CORNERS[ci];
        var k = ci; // DFR=0, DRB=1, DBL=2, DLF=3
        if (Cube.cornerSolved(state, slot)) { doneCorners.push(slot); continue; }
        var solvedList = doneCorners.slice();
        var goal = (function (slot, solvedList) {
          return function (s) {
            if (!Cube.cornerSolved(s, slot)) return false;
            if (!crossDone(s)) return false;
            return cornersSolved(s, solvedList);
          };
        })(slot, solvedList);

        var macros = buildMacros(CORNER_ALGS, k);
        for (var other = 0; other < 4; other++) {
          if (other === k) continue;
          macros = macros.concat(buildMacros([CORNER_EJECT], other));
        }
        var path = searchMacros(state, macros, goal, 3);
        if (!path) path = searchMacros(state, macros, goal, 4);
        if (!path) { failure = 'Alt köşe yerleştirilemedi (' + Cube.CORNER_NAMES[slot] + ').'; break; }
        for (var p = 0; p < path.length; p++) {
          cornerSteps.push(stepFrom(path[p], {
            title: SLOT_LABEL_CORNER[slot] + ' köşe',
            targets: { corners: [slot] }
          }));
          state = Cube.applyAlg(state, path[p].moves);
        }
        doneCorners.push(slot);
      }
    }
    pushStage(STAGE_META[1], cornerSteps);

    /* 3) Orta katman */
    var middleSteps = [];
    if (!failure) {
      var doneEdges = [];
      for (var mi = 0; mi < MIDDLE_EDGES.length; mi++) {
        var eslot = MIDDLE_EDGES[mi];
        if (Cube.edgeSolved(state, eslot)) { doneEdges.push(eslot); continue; }
        var solvedEdges = doneEdges.slice();
        var goalE = (function (eslot, solvedEdges) {
          return function (s) {
            if (!Cube.edgeSolved(s, eslot)) return false;
            if (!crossDone(s)) return false;
            if (!cornersSolved(s, D_CORNERS)) return false;
            return edgesSolved(s, solvedEdges);
          };
        })(eslot, solvedEdges);

        var macrosE = [];
        for (var kk = 0; kk < 4; kk++) macrosE = macrosE.concat(buildMacros(MIDDLE_ALGS, kk));
        var pathE = searchMacros(state, macrosE, goalE, 3);
        if (!pathE) pathE = searchMacros(state, macrosE, goalE, 4);
        if (!pathE) { failure = 'Orta katman kenarı yerleştirilemedi (' + Cube.EDGE_NAMES[eslot] + ').'; break; }
        for (var pe = 0; pe < pathE.length; pe++) {
          middleSteps.push(stepFrom(pathE[pe], {
            title: SLOT_LABEL_EDGE[eslot] + ' kenar',
            targets: { edges: [eslot] }
          }));
          state = Cube.applyAlg(state, pathE[pe].moves);
        }
        doneEdges.push(eslot);
      }
    }
    pushStage(STAGE_META[2], middleSteps);

    /* 4) Üst artı */
    var ollESteps = [];
    if (!failure && !uEdgesOriented(state)) {
      var macrosOE = buildMacros(OLL_CROSS_ALGS, 0);
      var pathOE = searchMacros(state, macrosOE, function (s) { return uEdgesOriented(s); }, 4);
      if (!pathOE) { failure = 'Üst artı oluşturulamadı.'; }
      else {
        for (var i4 = 0; i4 < pathOE.length; i4++) {
          ollESteps.push(stepFrom(pathOE[i4], { title: 'Üst artı', targets: { edges: U_EDGES.slice() } }));
          state = Cube.applyAlg(state, pathOE[i4].moves);
        }
      }
    }
    pushStage(STAGE_META[3], ollESteps);

    /* 5) Üst köşe yönleri */
    var ollCSteps = [];
    if (!failure && !uCornersOriented(state)) {
      var macrosOC = buildMacros(COLL_ALGS, 0);
      var pathOC = searchMacros(state, macrosOC, function (s) {
        return uCornersOriented(s) && uEdgesOriented(s);
      }, 5);
      if (!pathOC) { failure = 'Üst yüz tamamlanamadı.'; }
      else {
        for (var i5 = 0; i5 < pathOC.length; i5++) {
          ollCSteps.push(stepFrom(pathOC[i5], { title: 'Üst yüz', targets: { corners: U_CORNERS.slice() } }));
          state = Cube.applyAlg(state, pathOC[i5].moves);
        }
      }
    }
    pushStage(STAGE_META[4], ollCSteps);

    /* 6) Üst köşe yerleri */
    var cpllSteps = [];
    if (!failure && upToAuf(state, uCornersPlaced) < 0) {
      var macrosCP = buildMacros(CPLL_ALGS, 0);
      var pathCP = searchMacros(state, macrosCP, function (s) {
        return upToAuf(s, uCornersPlaced) >= 0 && uCornersOriented(s) && uEdgesOriented(s);
      }, 3);
      if (!pathCP) { failure = 'Üst köşeler yerleştirilemedi.'; }
      else {
        for (var i6 = 0; i6 < pathCP.length; i6++) {
          cpllSteps.push(stepFrom(pathCP[i6], { title: 'Köşe yerleşimi', targets: { corners: U_CORNERS.slice() } }));
          state = Cube.applyAlg(state, pathCP[i6].moves);
        }
      }
    }
    pushStage(STAGE_META[5], cpllSteps);

    /* 7) Üst kenar yerleri + son hizalama */
    var epllSteps = [];
    if (!failure && !Cube.isSolved(state)) {
      var macrosEP = buildMacros(EPLL_ALGS, 0).concat(pureAuf());
      var pathEP = searchMacros(state, macrosEP, function (s) { return Cube.isSolved(s); }, 4);
      if (!pathEP) { failure = 'Üst kenarlar yerleştirilemedi.'; }
      else {
        for (var i7 = 0; i7 < pathEP.length; i7++) {
          epllSteps.push(stepFrom(pathEP[i7], { title: 'Kenar yerleşimi', targets: { edges: U_EDGES.slice() } }));
          state = Cube.applyAlg(state, pathEP[i7].moves);
        }
      }
    }
    pushStage(STAGE_META[6], epllSteps);

    if (failure) return { ok: false, error: failure, stages: stages };
    if (!Cube.isSolved(state)) return { ok: false, error: 'Çözüm doğrulanamadı.', stages: stages };

    var result = { ok: true, stages: stages };
    finalize(result, startState);
    return result;
  }

  /* Adım sınırlarındaki aynı yüz hareketlerini birleştir, durumları hesapla */
  function finalize(result, startState) {
    var flat = [];
    var s, st;
    for (s = 0; s < result.stages.length; s++) {
      var stg = result.stages[s];
      for (st = 0; st < stg.steps.length; st++) {
        stg.steps[st].stageKey = stg.key;
        stg.steps[st].stageTitle = stg.title;
        flat.push(stg.steps[st]);
      }
    }
    // sınır birleştirme
    for (var i = 0; i < flat.length - 1; i++) {
      var a = flat[i], b = flat[i + 1];
      while (a.moves.length && b.moves.length && a.moves[a.moves.length - 1][0] === b.moves[0][0]) {
        var merged = Cube.simplify([a.moves[a.moves.length - 1], b.moves[0]]);
        a.moves.pop();
        b.moves.shift();
        if (merged.length) { b.moves.unshift(merged[0]); break; }
      }
    }
    // boş adımları at
    var kept = [];
    for (s = 0; s < result.stages.length; s++) {
      result.stages[s].steps = result.stages[s].steps.filter(function (x) { return x.moves.length > 0; });
      kept = kept.concat(result.stages[s].steps);
    }
    result.stages = result.stages.filter(function (x) { return x.steps.length > 0; });

    // durumları yeniden hesapla ve numaralandır
    var cur = Cube.clone(startState);
    var total = 0;
    for (var n = 0; n < kept.length; n++) {
      kept[n].index = n;
      kept[n].before = Cube.clone(cur);
      cur = Cube.applyAlg(cur, kept[n].moves);
      kept[n].after = Cube.clone(cur);
      kept[n].moveOffset = total;
      total += kept[n].moves.length;
    }
    result.steps = kept;
    result.totalMoves = total;
    result.finalState = cur;
    result.solvedOk = Cube.isSolved(cur);
    return result;
  }

  /* Tek hamle ipucu: mevcut durum için sıradaki adım */
  function nextStep(state) {
    var res = solve(state);
    if (!res.ok || !res.steps || !res.steps.length) return null;
    return res.steps[0];
  }

  return {
    solve: solve,
    nextStep: nextStep,
    buildCrossTable: buildCrossTable,
    STAGE_META: STAGE_META,
    _internal: {
      searchMacros: searchMacros, buildMacros: buildMacros, solveCross: solveCross,
      crossDone: crossDone, uEdgesOriented: uEdgesOriented, uCornersOriented: uCornersOriented,
      D_CORNERS: D_CORNERS, MIDDLE_EDGES: MIDDLE_EDGES, CROSS_EDGES: CROSS_EDGES
    }
  };
});
