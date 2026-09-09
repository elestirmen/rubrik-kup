/* =====================================================================
   geometry.js — Küpün uzamsal modeli
   26 kübik parça, konum + 3x3 yönelim matrisi ile tutulur.
   Hem 3B görüntüleyici hem de 2B açılım (net) yerleşimi buradan beslenir.
   ===================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Geom = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

  var FACE_NORMAL = {
    U: [0, 1, 0], D: [0, -1, 0],
    R: [1, 0, 0], L: [-1, 0, 0],
    F: [0, 0, 1], B: [0, 0, -1]
  };

  /* Bir yüzün 0..8 arası kare indeksinin uzamsal konumu.
     Yerleşim standart 2B açılıma birebir uyar:
              U
           L  F  R  B
              D                                  */
  function faceletPos(face, i) {
    var r = Math.floor(i / 3), c = i % 3;
    switch (face) {
      case 'U': return [c - 1, 1, r - 1];
      case 'D': return [c - 1, -1, 1 - r];
      case 'F': return [c - 1, 1 - r, 1];
      case 'B': return [1 - c, 1 - r, -1];
      case 'R': return [1, 1 - r, 1 - c];
      case 'L': return [-1, 1 - r, c - 1];
    }
    throw new Error('Bilinmeyen yüz: ' + face);
  }

  /* Konum + normalden yüz indeksine geri dönüş */
  function posToFacelet(face, pos) {
    for (var i = 0; i < 9; i++) {
      var p = faceletPos(face, i);
      if (p[0] === pos[0] && p[1] === pos[1] && p[2] === pos[2]) return i;
    }
    return -1;
  }

  function cubiePositions() {
    var out = [];
    for (var x = -1; x <= 1; x++) {
      for (var y = -1; y <= 1; y++) {
        for (var z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          out.push([x, y, z]);
        }
      }
    }
    return out;
  }

  function dirName(v) {
    var e = 0.5;
    if (v[1] > e) return 'U';
    if (v[1] < -e) return 'D';
    if (v[0] > e) return 'R';
    if (v[0] < -e) return 'L';
    if (v[2] > e) return 'F';
    if (v[2] < -e) return 'B';
    return null;
  }

  /* --- matris yardımcıları (satır-ana, 3x3, dizi[9]) --- */

  var IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  function matMul(a, b) {
    var o = new Array(9);
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
      }
    }
    return o;
  }

  function matVec(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
  }

  function matTranspose(m) {
    return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
  }

  function matRound(m) {
    var o = new Array(9);
    for (var i = 0; i < 9; i++) o[i] = Math.round(m[i]);
    return o;
  }

  /* Eksen etrafında çeyrek tur döndürme matrisi.
     q pozitifse eksenin ucundan bakıldığında saat yönünün TERSİ (sağ el kuralı). */
  function rotationMatrix(axis, q) {
    var t = ((q % 4) + 4) % 4;
    var s = [0, 1, 0, -1][t];
    var c = [1, 0, -1, 0][t];
    if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
    if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  }

  /* Hareketin ekseni, yönü ve katman seçimi */
  var MOVE_AXIS = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' };

  /* Bir hareketin matrisi: dış taraftan bakıldığında saat yönü.
     Yüzün normali eksenin + yönüyse -90°, - yönüyse +90°. */
  function moveMatrix(move) {
    var face = move[0];
    var amount = move.slice(1) === '2' ? 2 : (move.slice(1) === "'" ? 3 : 1);
    var n = FACE_NORMAL[face];
    var axis = MOVE_AXIS[face];
    var sign = (n[0] + n[1] + n[2]) > 0 ? -1 : 1;
    return rotationMatrix(axis, sign * amount);
  }

  /* Hareketin döndürdüğü katmandaki parça mı? */
  function inLayer(pos, face) {
    var n = FACE_NORMAL[face];
    return pos[0] * n[0] + pos[1] * n[1] + pos[2] * n[2] === 1;
  }

  /* --- kübik parça kümesi --- */

  function createCubies() {
    var list = cubiePositions().map(function (p) {
      var stickers = {};
      for (var i = 0; i < FACES.length; i++) {
        var f = FACES[i], n = FACE_NORMAL[f];
        if (p[0] * n[0] + p[1] * n[1] + p[2] * n[2] === 1) stickers[f] = f;
      }
      return { pos: p.slice(), mat: IDENT.slice(), stickers: stickers, home: p.slice() };
    });
    return list;
  }

  function applyMoveGeom(cubies, move) {
    var face = move[0];
    var m = moveMatrix(move);
    for (var i = 0; i < cubies.length; i++) {
      var cu = cubies[i];
      if (!inLayer(cu.pos, face)) continue;
      cu.pos = matVec(m, cu.pos).map(Math.round);
      cu.mat = matRound(matMul(m, cu.mat));
    }
    return cubies;
  }

  function applyAlgGeom(cubies, moves) {
    for (var i = 0; i < moves.length; i++) applyMoveGeom(cubies, moves[i]);
    return cubies;
  }

  function cubieAt(cubies, pos) {
    for (var i = 0; i < cubies.length; i++) {
      var p = cubies[i].pos;
      if (p[0] === pos[0] && p[1] === pos[1] && p[2] === pos[2]) return cubies[i];
    }
    return null;
  }

  /* Bir parçanın dünya yönü f'ye bakan yüzündeki renk (yüz harfi) */
  function stickerAt(cubie, face) {
    var local = matVec(matTranspose(cubie.mat), FACE_NORMAL[face]);
    var name = dirName(local);
    return name ? cubie.stickers[name] : undefined;
  }

  /* Uzamsal modelden 54 elemanlı facelet dizisi */
  function geomToFacelets(cubies) {
    var f = new Array(54);
    for (var fi = 0; fi < FACES.length; fi++) {
      var face = FACES[fi];
      for (var i = 0; i < 9; i++) {
        var pos = faceletPos(face, i);
        if (i === 4) { f[fi * 9 + 4] = face; continue; }
        var cu = cubieAt(cubies, pos);
        f[fi * 9 + i] = cu ? stickerAt(cu, face) : undefined;
      }
    }
    return f;
  }

  return {
    FACES: FACES, FACE_NORMAL: FACE_NORMAL, MOVE_AXIS: MOVE_AXIS, IDENT: IDENT,
    faceletPos: faceletPos, posToFacelet: posToFacelet, cubiePositions: cubiePositions,
    dirName: dirName,
    matMul: matMul, matVec: matVec, matTranspose: matTranspose, matRound: matRound,
    rotationMatrix: rotationMatrix, moveMatrix: moveMatrix, inLayer: inLayer,
    createCubies: createCubies, applyMoveGeom: applyMoveGeom, applyAlgGeom: applyAlgGeom,
    cubieAt: cubieAt, stickerAt: stickerAt, geomToFacelets: geomToFacelets
  };
});
