/* =====================================================================
   cube.js — 3x3x3 küp mantığı
   Kübik (cubie) gösterimi: cp/co (köşe yer/yön), ep/eo (kenar yer/yön)
   Facelet gösterimi: 54 elemanlı dizi, her eleman bir yüz harfi (U R F D L B)
   Tarayıcı ve Node üzerinde çalışır.
   ===================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Cube = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- Sabitler ---------- */

  // Köşe kimlikleri
  var URF = 0, UFL = 1, ULB = 2, UBR = 3, DFR = 4, DLF = 5, DBL = 6, DRB = 7;
  // Kenar kimlikleri
  var UR = 0, UF = 1, UL = 2, UB = 3, DR = 4, DF = 5, DL = 6, DB = 7,
      FR = 8, FL = 9, BL = 10, BR = 11;

  var CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
  var EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  var FACE_INDEX = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

  // Facelet indeksleri: U 0-8, R 9-17, F 18-26, D 27-35, L 36-44, B 45-53
  var CORNER_FACELET = [
    [8, 9, 20],   // URF : U9 R1 F3
    [6, 18, 38],  // UFL : U7 F1 L3
    [0, 36, 47],  // ULB : U1 L1 B3
    [2, 45, 11],  // UBR : U3 B1 R3
    [29, 26, 15], // DFR : D3 F9 R7
    [27, 44, 24], // DLF : D1 L9 F7
    [33, 53, 42], // DBL : D7 B9 L7
    [35, 17, 51]  // DRB : D9 R9 B7
  ];
  var EDGE_FACELET = [
    [5, 10],  // UR : U6 R2
    [7, 19],  // UF : U8 F2
    [3, 37],  // UL : U4 L2
    [1, 46],  // UB : U2 B2
    [32, 16], // DR : D6 R8
    [28, 25], // DF : D2 F8
    [30, 43], // DL : D4 L8
    [34, 52], // DB : D8 B8
    [23, 12], // FR : F6 R4
    [21, 41], // FL : F4 L6
    [50, 39], // BL : B6 L4
    [48, 14]  // BR : B4 R6
  ];
  var CORNER_COLOR = [
    ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
    ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B']
  ];
  var EDGE_COLOR = [
    ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'],
    ['D', 'R'], ['D', 'F'], ['D', 'L'], ['D', 'B'],
    ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R']
  ];

  /* ---------- Temel hareket tanımları (çeyrek tur, saat yönü) ---------- */

  var BASE = {
    U: {
      cp: [UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB], co: [0, 0, 0, 0, 0, 0, 0, 0],
      ep: [UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    R: {
      cp: [DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR], co: [2, 0, 0, 1, 1, 0, 0, 2],
      ep: [FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    F: {
      cp: [UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB], co: [1, 2, 0, 0, 2, 1, 0, 0],
      ep: [UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]
    },
    D: {
      cp: [URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR], co: [0, 0, 0, 0, 0, 0, 0, 0],
      ep: [UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    L: {
      cp: [URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB], co: [0, 1, 2, 0, 0, 2, 1, 0],
      ep: [UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    B: {
      cp: [URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL], co: [0, 0, 1, 2, 0, 0, 2, 1],
      ep: [UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1]
    }
  };

  // Hareket listesi: her yüz için 1, 2, 3 çeyrek tur
  var MOVE_NAMES = [];
  var MOVE_TABLE = [];
  var MOVE_ID = {};

  function identity() {
    return {
      cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0],
      ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    };
  }

  // a durumuna b hareketini uygula (sonuç: a'dan sonra b)
  function compose(a, b) {
    var cp = new Array(8), co = new Array(8), ep = new Array(12), eo = new Array(12), i;
    for (i = 0; i < 8; i++) {
      cp[i] = a.cp[b.cp[i]];
      co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
    }
    for (i = 0; i < 12; i++) {
      ep[i] = a.ep[b.ep[i]];
      eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
    }
    return { cp: cp, co: co, ep: ep, eo: eo };
  }

  (function buildMoves() {
    for (var f = 0; f < FACES.length; f++) {
      var face = FACES[f];
      var q1 = BASE[face];
      var q2 = compose(q1, q1);
      var q3 = compose(q2, q1);
      var variants = [[face, q1], [face + '2', q2], [face + "'", q3]];
      for (var v = 0; v < 3; v++) {
        MOVE_ID[variants[v][0]] = MOVE_NAMES.length;
        MOVE_NAMES.push(variants[v][0]);
        MOVE_TABLE.push(variants[v][1]);
      }
    }
  })();

  /* ---------- Durum ---------- */

  function solved() { return identity(); }

  function clone(s) {
    return { cp: s.cp.slice(), co: s.co.slice(), ep: s.ep.slice(), eo: s.eo.slice() };
  }

  function equals(a, b) {
    for (var i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
    for (var j = 0; j < 12; j++) if (a.ep[j] !== b.ep[j] || a.eo[j] !== b.eo[j]) return false;
    return true;
  }

  function isSolved(s) {
    for (var i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
    for (var j = 0; j < 12; j++) if (s.ep[j] !== j || s.eo[j] !== 0) return false;
    return true;
  }

  function applyMove(s, move) {
    var id = typeof move === 'number' ? move : MOVE_ID[move];
    if (id === undefined) throw new Error('Bilinmeyen hareket: ' + move);
    return compose(s, MOVE_TABLE[id]);
  }

  function applyAlg(s, alg) {
    var moves = typeof alg === 'string' ? parseAlg(alg) : alg;
    var out = s;
    for (var i = 0; i < moves.length; i++) out = applyMove(out, moves[i]);
    return out;
  }

  /* ---------- Notasyon ---------- */

  function parseAlg(text) {
    if (Array.isArray(text)) return text.slice();
    var out = [];
    var tokens = String(text).replace(/[（）()]/g, ' ').trim().split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!t) continue;
      t = t.replace(/’/g, "'").replace(/2'/, '2');
      if (!(t in MOVE_ID)) throw new Error('Geçersiz hareket: ' + t);
      out.push(t);
    }
    return out;
  }

  function algToString(moves) { return moves.join(' '); }

  function invertMove(m) {
    if (m.length === 1) return m + "'";
    if (m[1] === '2') return m;
    return m[0];
  }

  function invertAlg(moves) {
    var out = [];
    for (var i = moves.length - 1; i >= 0; i--) out.push(invertMove(moves[i]));
    return out;
  }

  var QUARTERS = { "": 1, "2": 2, "'": 3 };
  var FROM_QUARTER = { 1: '', 2: '2', 3: "'" };

  // Aynı yüzdeki komşu hareketleri birleştirir, etkisiz olanları atar
  function simplify(moves) {
    var out = [];
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var face = m[0];
      var amount = QUARTERS[m.slice(1)];
      while (out.length) {
        var prev = out[out.length - 1];
        if (prev[0] !== face) break;
        amount = (amount + QUARTERS[prev.slice(1)]) % 4;
        out.pop();
      }
      if (amount % 4 !== 0) out.push(face + FROM_QUARTER[amount % 4]);
    }
    return out;
  }

  /* ---------- Facelet dönüşümleri ---------- */

  function toFacelets(s) {
    var f = new Array(54), i, n;
    for (i = 0; i < 6; i++) f[i * 9 + 4] = FACES[i];
    for (i = 0; i < 8; i++) {
      var cj = s.cp[i], cori = s.co[i];
      for (n = 0; n < 3; n++) f[CORNER_FACELET[i][(n + cori) % 3]] = CORNER_COLOR[cj][n];
    }
    for (i = 0; i < 12; i++) {
      var ej = s.ep[i], eori = s.eo[i];
      for (n = 0; n < 2; n++) f[EDGE_FACELET[i][(n + eori) % 2]] = EDGE_COLOR[ej][n];
    }
    return f;
  }

  function faceletsToString(f) { return f.join(''); }

  /* Facelet dizisinden kübik duruma; { state, errors } döner */
  function fromFacelets(input) {
    var f = typeof input === 'string' ? input.split('') : input.slice();
    var errors = [];
    if (f.length !== 54) return { state: null, errors: ['Küp 54 kareden oluşmalı.'] };

    // 1) Merkezler benzersiz mi
    var centers = {}, i;
    for (i = 0; i < 6; i++) {
      var c = f[i * 9 + 4];
      if (!c) return { state: null, errors: ['Tüm kareler boyanmalı.'] };
      if (centers[c] !== undefined) errors.push('İki yüzün merkez rengi aynı: bu bir küpte olamaz.');
      centers[c] = i;
    }

    // 2) Renk sayıları
    var counts = {};
    for (i = 0; i < 54; i++) {
      if (!f[i]) return { state: null, errors: ['Tüm kareler boyanmalı.'] };
      counts[f[i]] = (counts[f[i]] || 0) + 1;
    }
    var keys = Object.keys(counts);
    for (i = 0; i < keys.length; i++) {
      if (counts[keys[i]] !== 9) {
        errors.push('Her renkten tam 9 kare olmalı; şu an "' + keys[i] + '" renginden ' + counts[keys[i]] + ' kare var.');
      }
    }
    if (errors.length) return { state: null, errors: errors };

    var s = identity();
    // 3) Köşeler
    var seenCorner = {};
    for (i = 0; i < 8; i++) {
      var fl = CORNER_FACELET[i];
      var ori = -1, n;
      for (n = 0; n < 3; n++) {
        if (f[fl[n]] === 'U' || f[fl[n]] === 'D') { ori = n; break; }
      }
      if (ori < 0) {
        return { state: null, errors: ['Bir köşe parçası hatalı: her köşede U veya D yüzünün rengi bulunmalı. (' + CORNER_NAMES[i] + ')'] };
      }
      var c1 = f[fl[ori]], c2 = f[fl[(ori + 1) % 3]], c3 = f[fl[(ori + 2) % 3]];
      var found = -1;
      for (var j = 0; j < 8; j++) {
        if (CORNER_COLOR[j][0] === c1 && CORNER_COLOR[j][1] === c2 && CORNER_COLOR[j][2] === c3) { found = j; break; }
      }
      if (found < 0) {
        return { state: null, errors: ['Böyle bir köşe parçası yok: ' + c1 + c2 + c3 + '. Renkleri kontrol edin.'] };
      }
      if (seenCorner[found]) return { state: null, errors: ['Aynı köşe parçası iki kez girilmiş: ' + CORNER_NAMES[found] + '.'] };
      seenCorner[found] = true;
      s.cp[i] = found;
      s.co[i] = ori % 3;
    }
    // 4) Kenarlar
    var seenEdge = {};
    for (i = 0; i < 12; i++) {
      var efl = EDGE_FACELET[i];
      var a = f[efl[0]], b = f[efl[1]];
      var fe = -1, ori2 = 0;
      for (var k = 0; k < 12; k++) {
        if (EDGE_COLOR[k][0] === a && EDGE_COLOR[k][1] === b) { fe = k; ori2 = 0; break; }
        if (EDGE_COLOR[k][0] === b && EDGE_COLOR[k][1] === a) { fe = k; ori2 = 1; break; }
      }
      if (fe < 0) return { state: null, errors: ['Böyle bir kenar parçası yok: ' + a + b + '. Renkleri kontrol edin.'] };
      if (seenEdge[fe]) return { state: null, errors: ['Aynı kenar parçası iki kez girilmiş: ' + EDGE_NAMES[fe] + '.'] };
      seenEdge[fe] = true;
      s.ep[i] = fe;
      s.eo[i] = ori2;
    }
    var verdict = validate(s);
    if (verdict.length) return { state: null, errors: verdict };
    return { state: s, errors: [] };
  }

  /* --------------------------------------------------------------
     Kısmi girişin parça tutarlılığı.
     Her kenar 2, her köşe 3 kareden oluşur: boyanmış kareler gerçek bir
     parçaya uymalı ve iki slot aynı parçayı paylaşamaz. Yarım boyanmış
     küplerde de çalışır; eksik kareler serbest bırakılır.
     Dönen değer: { ok, bad: [{ kind, slot, name, colors, reason }] }
     reason: 'yok'    -> bu renk birleşimine sahip parça yok
             'tekrar' -> parçalar birbirine tutarlı biçimde dağıtılamıyor
     -------------------------------------------------------------- */
  function candidates(f, slots, pieces, size) {
    var out = [], i, j, r, n, ok;
    for (i = 0; i < slots.length; i++) {
      var cand = [];
      for (j = 0; j < pieces.length; j++) {
        for (r = 0; r < size; r++) {
          ok = true;
          for (n = 0; n < size; n++) {
            var c = f[slots[i][n]];
            if (c && c !== pieces[j][(n + r) % size]) { ok = false; break; }
          }
          if (ok) { cand.push(j); break; }
        }
      }
      out.push(cand);
    }
    return out;
  }

  /* Maksimum eşleme (Kuhn): eşlenemeyen slotların listesini döndürür.
     Az seçenekli slotlar önce işlenir, böylece suçlu slot daha anlaşılır olur. */
  function unmatchedSlots(cand) {
    var n = cand.length, i;
    var pieceTo = new Array(n).fill(-1);
    var order = [];
    for (i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { return cand[a].length - cand[b].length; });

    function augment(u, seen) {
      for (var t = 0; t < cand[u].length; t++) {
        var p = cand[u][t];
        if (seen[p]) continue;
        seen[p] = true;
        if (pieceTo[p] < 0 || augment(pieceTo[p], seen)) { pieceTo[p] = u; return true; }
      }
      return false;
    }
    var out = [];
    for (i = 0; i < order.length; i++) {
      if (!augment(order[i], new Array(n).fill(false))) out.push(order[i]);
    }
    return out;
  }

  function partialCheck(input) {
    var f = typeof input === 'string' ? input.split('') : input;
    var bad = [], i;

    function collect(kind, slots, pieces, names, size) {
      var cand = candidates(f, slots, pieces, size);
      var empty = [];
      for (var k = 0; k < cand.length; k++) {
        if (!cand[k].length) empty.push(k);
      }
      var list = empty.length ? empty : unmatchedSlots(cand);
      var reason = empty.length ? 'yok' : 'tekrar';
      for (var m = 0; m < list.length; m++) {
        var slot = list[m], cols = [];
        for (var n = 0; n < size; n++) if (f[slots[slot][n]]) cols.push(f[slots[slot][n]]);
        bad.push({ kind: kind, slot: slot, name: names[slot], colors: cols, reason: reason });
      }
    }

    collect('corner', CORNER_FACELET, CORNER_COLOR, CORNER_NAMES, 3);
    collect('edge', EDGE_FACELET, EDGE_COLOR, EDGE_NAMES, 2);
    return { ok: bad.length === 0, bad: bad };
  }

  /* Bir facelet indeksinin ait olduğu parça: { kind, slot } ya da merkezse null */
  function pieceOf(idx) {
    var i, n;
    for (i = 0; i < 8; i++) {
      for (n = 0; n < 3; n++) if (CORNER_FACELET[i][n] === idx) return { kind: 'corner', slot: i, name: CORNER_NAMES[i] };
    }
    for (i = 0; i < 12; i++) {
      for (n = 0; n < 2; n++) if (EDGE_FACELET[i][n] === idx) return { kind: 'edge', slot: i, name: EDGE_NAMES[i] };
    }
    return null;
  }

  /* Kübik durumun çözülebilirlik denetimi */
  function validate(s) {
    var errors = [], i;
    var twist = 0;
    for (i = 0; i < 8; i++) twist += s.co[i];
    if (twist % 3 !== 0) errors.push('Köşelerden biri yanlış çevrilmiş görünüyor (köşe yönü toplamı tutmuyor). Köşe renklerini yeniden kontrol edin.');
    var flip = 0;
    for (i = 0; i < 12; i++) flip += s.eo[i];
    if (flip % 2 !== 0) errors.push('Kenarlardan biri ters takılmış görünüyor (kenar yönü toplamı tutmuyor). Kenar renklerini yeniden kontrol edin.');
    if (parity(s.cp) !== parity(s.ep)) errors.push('İki parça yer değiştirmiş görünüyor (permütasyon paritesi tutmuyor). Bir kenar veya köşe çiftini yeniden kontrol edin.');
    return errors;
  }

  function parity(perm) {
    var p = 0;
    for (var i = perm.length - 1; i > 0; i--) {
      for (var j = i - 1; j >= 0; j--) if (perm[j] > perm[i]) p++;
    }
    return p % 2;
  }

  /* ---------- Karıştırma ---------- */

  function randomScramble(len) {
    len = len || 22;
    var out = [], lastFace = '', beforeFace = '';
    var opposite = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
    while (out.length < len) {
      var face = FACES[Math.floor(Math.random() * 6)];
      if (face === lastFace) continue;
      // aynı eksende üçüncü kez dönmeyi engelle (U D U gibi)
      if (face === beforeFace && opposite[face] === lastFace) continue;
      var suffix = ['', '2', "'"][Math.floor(Math.random() * 3)];
      out.push(face + suffix);
      beforeFace = lastFace;
      lastFace = face;
    }
    return out;
  }

  function fromScramble(alg) { return applyAlg(solved(), alg); }

  /* ---------- Yardımcılar (çözücü için) ---------- */

  function edgeSolved(s, e) { return s.ep[e] === e && s.eo[e] === 0; }
  function cornerSolved(s, c) { return s.cp[c] === c && s.co[c] === 0; }
  function edgeAt(s, slot) { return { piece: s.ep[slot], ori: s.eo[slot] }; }
  function cornerAt(s, slot) { return { piece: s.cp[slot], ori: s.co[slot] }; }
  function findEdge(s, piece) { for (var i = 0; i < 12; i++) if (s.ep[i] === piece) return i; return -1; }
  function findCorner(s, piece) { for (var i = 0; i < 8; i++) if (s.cp[i] === piece) return i; return -1; }

  /* Bütün küp döndürmesi y (U yönünde): yüz harflerini çevirir.
     k kez uygulanır: F->R->B->L->F  (yani y' yönünde harf kaydırma) */
  var Y_CYCLE = ['F', 'R', 'B', 'L'];
  function rotateFaceLetter(face, k) {
    var i = Y_CYCLE.indexOf(face);
    if (i < 0) return face; // U, D değişmez
    return Y_CYCLE[(i + k + 4) % 4];
  }
  function rotateAlg(alg, k) {
    var moves = typeof alg === 'string' ? parseAlg(alg) : alg;
    var out = [];
    for (var i = 0; i < moves.length; i++) {
      out.push(rotateFaceLetter(moves[i][0], k) + moves[i].slice(1));
    }
    return out;
  }

  return {
    // sabitler
    FACES: FACES, FACE_INDEX: FACE_INDEX,
    CORNER_NAMES: CORNER_NAMES, EDGE_NAMES: EDGE_NAMES,
    CORNER_FACELET: CORNER_FACELET, EDGE_FACELET: EDGE_FACELET,
    CORNER_COLOR: CORNER_COLOR, EDGE_COLOR: EDGE_COLOR,
    MOVE_NAMES: MOVE_NAMES, MOVE_ID: MOVE_ID,
    CORNER: { URF: URF, UFL: UFL, ULB: ULB, UBR: UBR, DFR: DFR, DLF: DLF, DBL: DBL, DRB: DRB },
    EDGE: { UR: UR, UF: UF, UL: UL, UB: UB, DR: DR, DF: DF, DL: DL, DB: DB, FR: FR, FL: FL, BL: BL, BR: BR },
    // durum
    solved: solved, identity: identity, clone: clone, equals: equals, isSolved: isSolved,
    applyMove: applyMove, applyAlg: applyAlg, compose: compose,
    // notasyon
    parseAlg: parseAlg, algToString: algToString, invertAlg: invertAlg, invertMove: invertMove,
    simplify: simplify, rotateAlg: rotateAlg, rotateFaceLetter: rotateFaceLetter,
    // facelet
    toFacelets: toFacelets, fromFacelets: fromFacelets, faceletsToString: faceletsToString,
    partialCheck: partialCheck, pieceOf: pieceOf,
    validate: validate, parity: parity,
    // karıştırma
    randomScramble: randomScramble, fromScramble: fromScramble,
    // sorgular
    edgeSolved: edgeSolved, cornerSolved: cornerSolved, edgeAt: edgeAt, cornerAt: cornerAt,
    findEdge: findEdge, findCorner: findCorner
  };
});
