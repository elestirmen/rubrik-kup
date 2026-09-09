#!/usr/bin/env node
/* Rubrik küp motoru ve çözücü testleri.  Kullanım: node test/run.js [tur-sayisi] */
'use strict';

const path = require('path');
const Cube = require(path.join(__dirname, '..', 'www', 'js', 'cube.js'));
const Geom = require(path.join(__dirname, '..', 'www', 'js', 'geometry.js'));
const Solver = require(path.join(__dirname, '..', 'www', 'js', 'solver.js'));

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); return true; }
  fail++;
  console.log('  HATA ' + name + (detail ? ' -- ' + detail : ''));
  failures.push(name + (detail ? ' -- ' + detail : ''));
  return false;
}

function section(t) { console.log('\n' + t); }

/* ---------- 1. İki bağımsız küp modeli ---------- */
section('1) Kübik gösterim ile uzamsal modelin karsilastirmasi');
{
  let allOk = true;
  for (const m of Cube.MOVE_NAMES) {
    const cu = Geom.createCubies();
    Geom.applyMoveGeom(cu, m);
    const a = Geom.geomToFacelets(cu).join('');
    const b = Cube.faceletsToString(Cube.toFacelets(Cube.applyMove(Cube.solved(), m)));
    if (a !== b) allOk = false;
  }
  check('18 temel hareket iki modelde ayni', allOk);

  let randOk = true;
  for (let i = 0; i < 300; i++) {
    const alg = Cube.randomScramble(12);
    const cu = Geom.createCubies();
    Geom.applyAlgGeom(cu, alg);
    const a = Geom.geomToFacelets(cu).join('');
    const b = Cube.faceletsToString(Cube.toFacelets(Cube.applyAlg(Cube.solved(), alg)));
    if (a !== b) { randOk = false; console.log('  fark: ' + alg.join(' ')); break; }
  }
  check('300 rastgele dizi iki modelde ayni', randOk);
}

/* ---------- 2. Grup özellikleri ---------- */
section('2) Hareketlerin grup ozellikleri');
{
  for (const f of Cube.FACES) {
    let s = Cube.solved();
    for (let i = 0; i < 4; i++) s = Cube.applyMove(s, f);
    check(f + ' hareketinin mertebesi 4', Cube.isSolved(s));
  }
  let s = Cube.solved();
  for (let i = 0; i < 6; i++) s = Cube.applyAlg(s, "R U R' U'");
  check("(R U R' U') alti kez uygulaninca cozulur", Cube.isSolved(s));

  s = Cube.solved();
  for (let i = 0; i < 6; i++) s = Cube.applyAlg(s, "R U R' U R U2 R'");
  check('Sune alti kez uygulaninca cozulur', Cube.isSolved(s));

  const superflip = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2";
  s = Cube.applyAlg(Cube.solved(), superflip);
  check('Superflip: tum parcalar yerinde', s.ep.every((v, i) => v === i) && s.cp.every((v, i) => v === i));
  check('Superflip: 12 kenar ters, koseler duz', s.eo.every(v => v === 1) && s.co.every(v => v === 0));

  let invOk = true;
  for (let i = 0; i < 200; i++) {
    const alg = Cube.randomScramble(14);
    const st = Cube.applyAlg(Cube.applyAlg(Cube.solved(), alg), Cube.invertAlg(alg));
    if (!Cube.isSolved(st)) { invOk = false; break; }
  }
  check('alg + ters(alg) = cozulmus', invOk);

  let simpOk = true;
  for (let i = 0; i < 300; i++) {
    const alg = Cube.randomScramble(16).concat(Cube.randomScramble(16));
    const a = Cube.applyAlg(Cube.solved(), alg);
    const b = Cube.applyAlg(Cube.solved(), Cube.simplify(alg));
    if (!Cube.equals(a, b)) { simpOk = false; break; }
  }
  check('simplify() kupun durumunu degistirmiyor', simpOk);

  let rotOk = true;
  const order = (a) => { let st = Cube.solved(), n = 0; do { st = Cube.applyAlg(st, a); n++; } while (!Cube.isSolved(st) && n < 400); return n; };
  for (let i = 0; i < 100; i++) {
    const alg = Cube.randomScramble(10);
    if (Cube.rotateAlg(alg, 4).join(' ') !== alg.join(' ')) { rotOk = false; break; }
    if (order(alg) !== order(Cube.rotateAlg(alg, 1))) { rotOk = false; break; }
  }
  check('rotateAlg tutarli (mertebe korunuyor, 4 tur ozdes)', rotOk);
}

/* ---------- 3. Facelet dönüşümleri ---------- */
section('3) Facelet donusumleri ve dogrulama');
{
  let rtOk = true;
  for (let i = 0; i < 500; i++) {
    const st = Cube.fromScramble(Cube.randomScramble(20));
    const f = Cube.toFacelets(st);
    const back = Cube.fromFacelets(f);
    if (!back.state || !Cube.equals(back.state, st)) { rtOk = false; console.log('  hata: ' + back.errors); break; }
  }
  check('500 rastgele durum: facelet -> durum -> facelet tutarli', rtOk);

  const solvedF = Cube.toFacelets(Cube.solved());
  const twist = solvedF.slice();
  twist[8] = 'R'; twist[9] = 'F'; twist[20] = 'U';
  check('Tek kose cevrilmis kup reddedilir', Cube.fromFacelets(twist).state === null);

  const flip = solvedF.slice();
  flip[7] = 'F'; flip[19] = 'U';
  check('Tek kenar ters kup reddedilir', Cube.fromFacelets(flip).state === null);

  const swap = solvedF.slice();
  swap[7] = 'U'; swap[19] = 'R'; swap[5] = 'U'; swap[10] = 'F';
  check('Iki kenari takas edilmis kup reddedilir', Cube.fromFacelets(swap).state === null);

  const dup = solvedF.slice();
  dup[0] = 'R';
  check('Renk sayisi bozuk kup reddedilir', Cube.fromFacelets(dup).state === null);

  const missing = solvedF.slice();
  missing[0] = null;
  check('Eksik boyama reddedilir', Cube.fromFacelets(missing).state === null);

  check('Cozulmus kup kabul edilir', Cube.fromFacelets(solvedF).state !== null);

  const rotated = Cube.toFacelets(Cube.fromScramble("R U R' U'"));
  check('Karisik gecerli kup kabul edilir', Cube.fromFacelets(rotated).state !== null);
}

/* ---------- 4. Çözücü ---------- */
section('4) Cozucu (rastgele kupler)');
{
  const rounds = parseInt(process.argv[2] || '2000', 10);
  let t0 = Date.now();
  Solver.buildCrossTable();
  const tableMs = Date.now() - t0;

  let okAll = true, solvedAll = true, chainAll = true, stagesAll = true;
  let totalMoves = 0, maxMoves = 0, minMoves = 1e9, maxMs = 0, sumMs = 0;
  let worstScramble = null, maxSteps = 0;
  const stageMoves = {};

  for (let i = 0; i < rounds; i++) {
    const scr = Cube.randomScramble(20 + (i % 8));
    const start = Cube.fromScramble(scr);
    const t = Date.now();
    const res = Solver.solve(start);
    const ms = Date.now() - t;
    sumMs += ms;
    if (ms > maxMs) maxMs = ms;
    if (!res.ok) { okAll = false; console.log('  COZULEMEDI: ' + scr.join(' ') + ' -- ' + res.error); break; }

    let all = [];
    for (const st of res.steps) all = all.concat(st.moves);
    const end = Cube.applyAlg(start, all);
    if (!Cube.isSolved(end)) { solvedAll = false; console.log('  HATALI COZUM: ' + scr.join(' ')); break; }
    if (all.length !== res.totalMoves) { chainAll = false; console.log('  hamle sayisi tutmuyor'); break; }

    let cur = Cube.clone(start);
    for (const st of res.steps) {
      if (!Cube.equals(st.before, cur)) { chainAll = false; break; }
      cur = Cube.applyAlg(cur, st.moves);
      if (!Cube.equals(st.after, cur)) { chainAll = false; break; }
      if (!st.stageTitle || !st.moves.length) { stagesAll = false; break; }
    }
    if (!chainAll) { console.log('  ZINCIR BOZUK: ' + scr.join(' ')); break; }

    for (const stg of res.stages) {
      const n = stg.steps.reduce((a, b) => a + b.moves.length, 0);
      stageMoves[stg.title] = (stageMoves[stg.title] || 0) + n;
    }

    totalMoves += res.totalMoves;
    if (res.steps.length > maxSteps) maxSteps = res.steps.length;
    if (res.totalMoves > maxMoves) { maxMoves = res.totalMoves; worstScramble = scr.join(' '); }
    if (res.totalMoves < minMoves) minMoves = res.totalMoves;
  }

  check(rounds + ' rastgele kupun hepsi cozuldu', okAll);
  check('Uretilen cozumler kupu gercekten cozuyor', solvedAll);
  check('Adim zincirleri (before/after) tutarli', chainAll);
  check('Her adimin asama bilgisi ve hamlesi var', stagesAll);
  if (okAll && solvedAll) {
    console.log('  arti tablosu kurulumu  : ' + tableMs + ' ms');
    console.log('  ortalama hamle         : ' + (totalMoves / rounds).toFixed(1));
    console.log('  en az / en cok hamle   : ' + minMoves + ' / ' + maxMoves);
    console.log('  en cok adim sayisi     : ' + maxSteps);
    console.log('  ortalama / en kotu sure: ' + (sumMs / rounds).toFixed(2) + ' ms / ' + maxMs + ' ms');
    console.log('  asama basina ortalama hamle:');
    for (const k of Object.keys(stageMoves)) {
      console.log('    ' + k.padEnd(22) + (stageMoves[k] / rounds).toFixed(1));
    }
  }
}

/* ---------- 5. Sınır durumları ---------- */
section('5) Sinir durumlari');
{
  const solvedRes = Solver.solve(Cube.solved());
  check('Cozulmus kup: 0 hamle', solvedRes.ok && solvedRes.totalMoves === 0, String(solvedRes.totalMoves));

  let singleOk = true;
  for (const m of Cube.MOVE_NAMES) {
    const r = Solver.solve(Cube.applyMove(Cube.solved(), m));
    if (!r.ok || !Cube.isSolved(r.finalState)) { singleOk = false; console.log('  hata: ' + m); break; }
  }
  check('Tek hamlelik kuplerin hepsi cozuluyor', singleOk);

  const sf = Cube.applyAlg(Cube.solved(), "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
  const rsf = Solver.solve(sf);
  check('Superflip cozuluyor', rsf.ok && Cube.isSolved(rsf.finalState), rsf.error || '');
  if (rsf.ok) console.log('  superflip hamle sayisi: ' + rsf.totalMoves);

  const tp = Cube.applyAlg(Cube.solved(), "R U R' U' R' F R2 U' R' U' R U R' F'");
  const rtp = Solver.solve(tp);
  check('Parite durumu (T-perm) cozuluyor', rtp.ok && Cube.isSolved(rtp.finalState), rtp.error || '');

  const hint = Solver.nextStep(Cube.fromScramble("R U R'"));
  check('nextStep() ipucu donduruyor', hint && hint.moves.length > 0);
}

console.log('\n' + '-'.repeat(52));
console.log('Gecen: ' + pass + '   Basarisiz: ' + fail);
if (fail) {
  console.log('\nBasarisiz testler:');
  failures.forEach(f => console.log('  x ' + f));
  process.exit(1);
}
console.log('Tum testler gecti');
