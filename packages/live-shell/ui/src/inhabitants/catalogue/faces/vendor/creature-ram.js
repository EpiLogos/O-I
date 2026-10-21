/* creature-ram.js — the RAM · LAMB, Aries ♈, on creature-kit.js. Read CREATURE-SPEC.md and CREATURE-NOTES-RAM.md (the research note first).
   A sheep statant guardant: the body in profile facing right, the head turned full to the viewer so both horns, both eyes and the whole face read (the bull's view).
   TWO STATES in one body, joined by a growth weight g (0 the lamb, 1 the ram) that is a kit morph ("grow"): the lamb has a round skull, large eyes, soft ears, a tight fleece
   and horn buds under a woolly poll; the ram has the great spiral horns (a stack of growth stages the morph blends, so the horn lengthens and curls as it grows), a heavy brow,
   a long Roman face, a thick neck, a ruff and a heavy fleece. The horns ARE the sign: seen from the front the pair is the glyph ♈ (two arcs curling out and down over a
   stem), so the gold inlay runs along both horns, across the brow between their bases, and down the nasal ridge as the stem. The travelling light traces it.
   Ink: Cinnabar (feeling, the blood of the sacrifice). Accent: Amber, for the eye. Everything else is additive and transient. */
(() => {
'use strict';
const K = window.CreatureKit, M = K.model({id:'ram', name:'Ram · Lamb', sign:'♈', title:'RAM · LAMB', sub:'Aries · the lamb that loses its innocence',
  w:1000, h:780, groundY:740, pivot:[262, 400], axis:796, yawC:796, ink:K.ROSTER.cinnabar, accent:K.ROSTER.amber, far:{foreleg:[46, -4], hindleg:[52, -4]}, cam:[1.05, 528, 400]});
const {chaikin, ringPts, clamp, fSmooth, env, pulse, keys, ramp, hash, gauss} = K, pos = v => Math.max(0, v), cl = v => Math.max(-1, Math.min(1, v));
const lerp = (a, b, u) => a + (b - a) * u;

/* ---------- the head's frame: canvas units, origin the face's centre, u right, v down ---------- */
const HC = [792, 376], HS = 1.12;
const hw = ([u, v]) => [HC[0] + HS * u, HC[1] + HS * v];
const mr = P => P.map(([x, y]) => [2 * HC[0] - x, y]).reverse();
const sym = half => half.map(p => [p[0], p[1]]).concat(half.slice().reverse().filter(p => p[0] !== 0).map(([x, y]) => [-x, y]));
const hz = (u, v) => 70 * Math.sqrt(Math.max(0, 1 - (u / 92) ** 2 - ((v - 4) / 128) ** 2));
const zh = (off = 0, extra) => (x, y) => { const u = (x - HC[0]) / HS, v = (y - HC[1]) / HS; return HS * (hz(u, v) + off + (extra ? extra(u, v) : 0)); };
const H = (u, v) => hw([u, v]);

/* ---------- skeleton ---------- */
M.bone('body', null, [400, 385], [401, 385], {grp:'root'});
M.bone('pelvis', 'body', [400, 385], [226, 372], {grp:'rear', lim:[-.42, .42], speed:5.5});
M.bone('chest', 'body', [400, 385], [620, 372], {grp:'front', lim:[-.46, .46], speed:6});
M.bone('neck', 'chest', [612, 366], [752, 330], {grp:'head', lim:[-2.3, 1.1], sec:true, mot:true, speed:7.5});
M.bone('head', 'neck', [752, 330], [798, 394], {grp:'head', lim:[-1.2, 1.4], sec:true, mot:true, speed:9.5});
M.bone('jaw', 'head', H(0, 76), H(0, 128), {grp:'head', ylim:[-3, 34], sec:true, speed:14});
M.bone('earR', 'head', H(54, -32), H(142, -40), {grp:'head', lim:[-1.1, 1.1], sec:true, speed:14});
M.bone('earL', 'head', H(-54, -32), H(-142, -40), {grp:'head', lim:[-1.1, 1.1], sec:true, speed:14});
/* wool rides on its own bones, so the fleece sways behind the body's stride: a neck ruff, the brisket, the belly, the rump */
M.bone('woolN', 'neck', [690, 346], [704, 432], {grp:'head', lim:[-.85, .85], sec:true, speed:6, anat:false});
M.bone('woolC', 'chest', [636, 430], [648, 520], {grp:'front', lim:[-.85, .85], sec:true, speed:6, anat:false});
M.bone('woolB', 'body', [400, 440], [400, 528], {grp:'root', lim:[-.85, .85], sec:true, speed:6, anat:false});
M.bone('woolR', 'pelvis', [236, 404], [210, 486], {grp:'rear', lim:[-.85, .85], sec:true, speed:6, anat:false});
const TJ = [[198, 352], [190, 392], [184, 436], [181, 480], [181, 520]];
for(let k = 0; k < 4; k++) M.bone('tail' + k, k ? 'tail' + (k - 1) : 'pelvis', TJ[k], TJ[k + 1], {grp:'tail', lim:k ? [-2, 2] : [-2.6, 2.6], sec:true, speed:2.8, windRoot:k === 0, wind:k > 0});
M.follower('tail3', {k:3.2, w:11, z:.5, gain:.6});
M.follower('woolN', {k:3.4, w:9, z:.4, gain:.9, lim:.34, flutter:.02});
M.follower('woolC', {k:3.4, w:9, z:.4, gain:.9, lim:.34, flutter:.02});
M.follower('woolB', {k:3.2, w:8, z:.38, gain:.9, lim:.34, flutter:.02});
M.follower('woolR', {k:3.2, w:8, z:.38, gain:.9, lim:.34, flutter:.02});
const FAR = {fore:[46, -4], hind:[52, -4]};
const J = {scap:[[560, 330], [606, 438]], hum:[[606, 438], [592, 536]], rad:[[592, 536], [603, 650]], hand:[[603, 650], [622, 735]], fem:[[262, 400], [318, 498]], tib:[[318, 498], [262, 612]], foot:[[262, 612], [280, 735]]};
for(const s of ['N', 'F']){
  const f = s === 'F' ? FAR.fore : [0, 0], h = s === 'F' ? FAR.hind : [0, 0], mv = ([a, b], o) => [[a[0] + o[0], a[1] + o[1]], [b[0] + o[0], b[1] + o[1]]];
  const sc = mv(J.scap, f), hu = mv(J.hum, f), ra = mv(J.rad, f), ha = mv(J.hand, f), fe = mv(J.fem, h), ti = mv(J.tib, h), fo = mv(J.foot, h);
  M.bone('scap' + s, 'chest', sc[0], sc[1], {grp:'front', lim:[-.5, .5], speed:10});
  M.bone('hum' + s, 'scap' + s, hu[0], hu[1], {grp:'front', lim:[-1.4, 1.7]}); M.bone('rad' + s, 'hum' + s, ra[0], ra[1], {grp:'front', lim:[-2.95, .06]}); M.bone('hand' + s, 'rad' + s, ha[0], ha[1], {grp:'front', lim:[-2.1, 3.2]});
  M.bone('fem' + s, 'pelvis', fe[0], fe[1], {grp:'rear', lim:[-2.6, 1.5]}); M.bone('tib' + s, 'fem' + s, ti[0], ti[1], {grp:'rear', lim:[-1.05, 1.75]}); M.bone('foot' + s, 'tib' + s, fo[0], fo[1], {grp:'rear', lim:[-2.2, 3.2]});
  M.bone('toeF' + s, 'hand' + s, ha[1], [ha[1][0] + 8, ha[1][1]], {grp:'front', lim:[-1.8, 1.8], speed:10}); M.bone('toeH' + s, 'foot' + s, fo[1], [fo[1][0] + 8, fo[1][1]], {grp:'rear', lim:[-1.8, 1.8], speed:10});
}
/* the legs on IK, in the order the gaits list them: fore near, fore far, hind near, hind far */
const FMUS = [['deltoid', 'latissimus', -.42, .38], ['brachialis', 'triceps', -.7, .5], ['extCarpi', 'flexCarpi', -.4, .55]], HMUS = [['hipFlex', 'glutes', -.42, .36], ['quads', 'hamstrings', -.5, .45], ['tibialis', 'gastroc', -.45, .55]];
M.leg({bones:['humN', 'radN', 'handN'], bend:1, kind:'fore', side:'N', roll:.7, reach:30, mus:FMUS});
M.leg({bones:['humF', 'radF', 'handF'], bend:1, kind:'fore', side:'F', roll:.7, reach:30, mus:FMUS});
M.leg({bones:['femN', 'tibN', 'footN'], bend:-1, kind:'hind', side:'N', roll:1, reach:30, mus:HMUS});
M.leg({bones:['femF', 'tibF', 'footF'], bend:-1, kind:'hind', side:'F', roll:1, reach:30, mus:HMUS});

/* ---------- the figure ----------
   Layers: far legs 1; fringe wool behind the body 3; tail 3; torso 4; the front row of wool 4.5; near legs 5; shoulder and haunch masses 6; neck 7; the neck's ruff 7.4; ears and horns 8;
   the poll's wool 8.6; the face's cells 9; the mouth's inside and teeth 10; muzzle, jaw, bridge 11; nostrils, eyes 12; pupils 13; lids 14; the glyph 15. The silhouette is drawn under layer 2 and up.
   Every wool lock is a part of the one fleece family (zone 'fleece', tag 'fleece'); a lock is built twice, as the lamb's and as the ram's, and the morph is the difference. */
const FORE = [[598, 418, 46, 44], [596, 476, 38, 36], [593, 536, 28, 27], [598, 592, 20, 19], [603, 648, 14, 14], [607, 690, 11, 11], [612, 716, 12, 12], [620, 731, 13, 15]];
const HIND = [[264, 408, 58, 60], [286, 452, 52, 52], [316, 498, 40, 36], [296, 548, 31, 28], [262, 612, 25, 19], [266, 662, 12, 12], [273, 706, 11, 11], [280, 726, 12, 13]];
const shiftSt = (S, o) => S.map(q => [q[0] + o[0], q[1] + o[1], q[2], q[3]]);
function hoof(id, kind, side, o){
  const bone = kind === 'fore' ? 'hand' + side : 'foot' + side, toe = kind === 'fore' ? 'toeF' + side : 'toeH' + side, tip = M.bones[M.BI[bone]].q, X = tip[0], Y = tip[1], at = pts => pts.map(([x, y]) => [X + x, Y + y]);
  const base = {layer:o.layer, dim:o.dim, bind:{rigid:toe}, tier:'F', zone:'paws', tags:[kind, side === 'F' ? 'F' : 'N', 'paw'], line:o.dim ? 'far' : 'feature'};
  M.zone('hoofA' + id, chaikin(at([[-15, -14], [2, -17], [4, -17], [4, 5], [-17, 5], [-20, -5]]), 1), {...base, h:9, tone:.3});
  M.zone('hoofB' + id, chaikin(at([[4, -17], [20, -12], [29, -4], [31, 5], [4, 5]]), 1), {...base, h:9, tone:.3});
}
const legParts = (kind, side, S, far) => {
  const names = kind === 'fore' ? ['hum', 'rad', 'hand'] : ['fem', 'tib', 'foot'], b = {chain:names.map(n => n + side), sigma:22}, id = (kind === 'fore' ? 'F' : 'H') + side;
  const cm = {layer:far ? 1 : 5, dim:far, line:far ? 'far' : 'region', bind:b, tags:[kind, side === 'F' ? 'F' : 'N', 'leg'], tj:.03, h:far ? 40 : 26, tier:'M'};
  M.limb((kind === 'fore' ? 'foreU' : 'thigh') + side, S, {...cm, range:[0, 2]}); M.limb((kind === 'fore' ? 'foreL' : 'shin') + side, S, {...cm, range:[2, 4]});
  M.limb((kind === 'fore' ? 'cannonF' : 'cannonH') + side, S, {...cm, range:[4, 7], h:far ? 30 : 16, tier:'F'});
  hoof(id, kind, side, {layer:far ? 1 : 5, dim:far});
};
legParts('fore', 'F', shiftSt(FORE, FAR.fore), true); legParts('hind', 'F', shiftSt(HIND, FAR.hind), true);
/* the tail: a thin woolly tail hanging from the tailhead to the hock (the lamb's wag is its signature) */
M.limb('tail', TJ.map(([x, y], i) => [x - 4, y, 5.5 - i * .9, 5.5 - i * .9]), {layer:6.4, tier:'M', h:16, cols:1, bind:{chain:['tail0', 'tail1', 'tail2', 'tail3'], sigma:20}, tags:['tail'], line:'region'});
/* the torso: four large cells (shoulder and chest, ribs, loin, rump) whose outline is one smooth curve; a level back, a deep barrel */
const TP = {t0:[655, 322], t1:[600, 310], t2:[548, 314], t3:[500, 324], t4:[452, 334], t5:[400, 340], t6:[348, 342], t7:[298, 340], t8:[252, 340], r0:[214, 350], r1:[190, 374], r2:[181, 414], r3:[186, 456], r4:[206, 490],
  b0:[246, 506], b1:[300, 512], b2:[350, 520], b3:[402, 530], b4:[456, 538], b5:[510, 540], b6:[565, 538], b7:[612, 530], c0:[656, 520], c1:[690, 490], c2:[704, 440], c3:[696, 380], s1:[552, 430], s2:[392, 440], h1:[322, 420]};
const CELLS = {torsoA:['t0', 't1', 't2', 's1', 'b6', 'b7', 'c0', 'c1', 'c2', 'c3'], torsoB:['t2', 't3', 't4', 't5', 's2', 'b3', 'b4', 'b5', 'b6', 's1'], torsoC:['t6', 't5', 's2', 'b3', 'b2', 'b1', 'h1'], torsoD:['t8', 't7', 't6', 'h1', 'b1', 'b0', 'r4', 'r3', 'r2', 'r1', 'r0']};
const BODYB = {chain:['pelvis', 'body', 'chest'], sigma:70};
{ const nms = Object.keys(CELLS), sm = K.smoothCells(nms.map(k => CELLS[k].map(n => TP[n])), 2);
  nms.forEach((nm, i) => M.zone(nm, sm[i], {layer:4, tier:'L', ptier:'M', h:36, tags:['torso'], bind:BODYB, line:'region'})); }
/* the near legs, with fine cannon and hoof, and the joints as anatomy */
legParts('fore', 'N', FORE, false); legParts('hind', 'N', HIND, false);
for(const [nm, pts, tg, ch, host] of [
  ['jElbow', [[592, 524], [604, 532], [604, 550], [592, 558], [574, 550], [570, 536]], 'fore', ['humN', 'radN'], ['foreUN', 'foreLN']],
  ['jCarpus', ringPts([603, 650], 11, 9, .3, .9), 'fore', ['radN', 'handN'], ['foreLN', 'cannonFN']],
  ['jStifle', ringPts([320, 500], 15, 9, .2), 'hind', ['femN', 'tibN'], ['thighN', 'shinN']],
  ['jHock', [[266, 598], [271, 616], [263, 628], [247, 626], [239, 610], [247, 598]], 'hind', ['tibN', 'footN'], ['shinN', 'cannonHN']]])
  M.zone(nm, pts, {layer:5, tier:'F', h:11, zone:'paws', tags:[tg, 'N', 'leg'], bind:{chain:ch, sigma:20}, host, line:'feature'});
/* the neck: a thick mass from the withers to the poll, over the shoulder (the ram's thickens) */
M.zone('neck', chaikin([[570, 300], [630, 298], [700, 300], [752, 300], [790, 316], [800, 372], [792, 440], [742, 448], [696, 452], [658, 452], [626, 434], [596, 392], [576, 340]], 2), {layer:7, tier:'M', h:28, bind:{chain:['chest', 'neck', 'head'], sigma:26}, tags:['neck'], line:'region'});
M.line('nuchal', chaikin([[600, 308], [660, 308], [720, 310], [770, 316]], 2, false), {layer:7, tags:['neck'], bind:{chain:['chest', 'neck', 'head'], sigma:26}, host:['neck'], line:{k:.4, c:.6, r:'f', t:'bone', tk:.2}});

/* ---------- wool ----------
   A lock is a teardrop blade rooted in an outline point, leaning along the flow of the fleece (down and back). It is built twice, as the lamb's (short, tight) and the ram's (long, heavy);
   the morph 'fleece' moves each vertex from one to the other. */
const FLOW = [-.55, .83];
const lockPoly = (p, n, d, len, bw, curl) => {
  const t = [-d[1], d[0]], tip = [p[0] + d[0] * len + t[0] * curl * len * .25, p[1] + d[1] * len + t[1] * curl * len * .25];
  const at = (a, b) => [p[0] + d[0] * len * a + t[0] * bw * b, p[1] + d[1] * len * a + t[1] * bw * b];
  const mid = [p[0] + d[0] * len * .55 + t[0] * curl * len * .12, p[1] + d[1] * len * .55 + t[1] * curl * len * .12];
  return [[p[0] - t[0] * bw * .5 - n[0] * 6, p[1] - t[1] * bw * .5 - n[1] * 6], [mid[0] - t[0] * bw * .62, mid[1] - t[1] * bw * .62], at(.86, -.2).map((v, i) => v + (tip[i] - at(1, 0)[i]) * .5), tip,
    at(.86, .2).map((v, i) => v + (tip[i] - at(1, 0)[i]) * .5), [mid[0] + t[0] * bw * .62, mid[1] + t[1] * bw * .62], [p[0] + t[0] * bw * .5 - n[0] * 6, p[1] + t[1] * bw * .5 - n[1] * 6]];
};
const FLEECE = new Map();   // part order -> {v0, lamb:[[x, y] per local vertex], ram:[[x, y]...]}: the morph 'fleece' is the difference
/* a run of locks along an outline: pts (a closed or open polyline, dense), spacing, and per-lock [lamb length, ram length] */
function lockRun(name, outline, o){
  const closed = o.closed ?? true, R = K.rng(K.strHash(name)), pts = o.dense ? outline : chaikin(outline, 3, closed);
  const cum = [0]; const n = pts.length, last = closed ? n : n - 1;
  for(let i = 1; i <= last; i++){ const a = pts[i - 1], b = pts[i % n]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const L = cum[last], N = Math.max(2, Math.round(L / o.gap)), at = s => { let k = 1; while(k < last && cum[k] < s) k++; const a = pts[k - 1], b = pts[k % n], u = (s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; };
  let area = 0; for(let i = 0; i < n; i++){ const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; } const sgn = o.out ?? (area > 0 ? 1 : -1);
  const lamb = [], ram = [];
  for(let q = 0; q < N; q++){
    const s = L * (q + .5) / N, p = at(s), p2 = at(s + 4), p1 = at(s - 4 < 0 ? s - 4 + L : s - 4);
    let tx = p2[0] - p1[0], ty = p2[1] - p1[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nrm = [ty * sgn, -tx * sgn], lean = o.lean ?? .75;
    let d = [nrm[0] * (1 - lean) + FLOW[0] * lean * 1.1, nrm[1] * (1 - lean) + FLOW[1] * lean * 1.1]; const dl = Math.hypot(d[0], d[1]); d = [d[0] / dl, d[1] / dl];
    const j = .8 + .4 * R(), lz = o.len(p, nrm, q), curl = (R() - .5) * .8;
    lamb.push(lockPoly(p, nrm, d, lz[0] * j, o.bw * (o.bwL ?? 1), curl)); ram.push(lockPoly(p, nrm, d, lz[1] * j, o.bw * 1.12, curl * 1.3));
  }
  const P = M.shapes(name, lamb, {layer:o.layer, tier:'F', zone:'fleece', line:o.line || {k:.55, c:.8, r:0, t:'bone', tk:.12}, tags:['fleece', ...(o.tags || [])], bind:o.bind, silBack:!!o.sil, tone:o.tone ?? ((x, y, i) => .1 + .34 * hash(i * 13 + 5)), tj:.05, yaw:!!o.yaw, z:o.z});
  FLEECE.set(P.order, {v0:P.v0, lamb:lamb.flat(), ram:ram.flat()});
  return P;
}
/* the wool follows the body's bones and sways on the wool bones behind it (the followers) */
const woolBind = (x, y) => {
  const near = [['pelvis', Math.exp(-(((x - 230) / 150) ** 2))], ['body', Math.exp(-(((x - 410) / 150) ** 2))], ['chest', Math.exp(-(((x - 620) / 140) ** 2))]];
  const sw = (n, w) => [n, w * .5];
  if(y > 470) near.push(sw('woolB', Math.exp(-(((x - 420) / 150) ** 2))), sw('woolC', Math.exp(-(((x - 640) / 70) ** 2))));
  if(x < 270) near.push(sw('woolR', Math.exp(-(((y - 430) / 90) ** 2))));
  return near.map(([n, w]) => [n, w + .001]);
};
{ // the fringe: wool hanging beyond the body's outline, behind the torso
  const loop = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 'r0', 'r1', 'r2', 'r3', 'r4', 'b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'c0', 'c1', 'c2', 'c3'].map(k => TP[k]);
  const len = (p, n, q) => { const belly = clamp((p[1] - 440) / 90), back = clamp((340 - p[1]) / 40); return [22 + 14 * belly, 34 + 26 * belly + 8 * back]; };
  lockRun('fringeBack', loop, {layer:3, gap:20, bw:38, len, bind:woolBind, sil:true, tags:['body'], tone:(x, y, i) => .2 + .3 * hash(i * 13 + 5)});
}
/* the fleece's body: rows of rounded puffs laid like scales, the lowest row first so each row's scalloped lower edge shows over the one beneath; each row is a part whose scallop is
   its outline, so every row of wool reads as a line. The lamb's puffs are small and tight (the soft curl of new wool); the ram's are large and heavy. */
const inPoly = (P, x, y) => K.pip(P, x, y);
function puffRows(prefix, region, o){
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for(const [x, y] of region){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const sp = o.sp, dy = sp * .78, R = K.rng(K.strHash(prefix)), rows = [];
  for(let row = 0, y = y0 + dy * .5; y < y1 + dy * .5; y += dy, row++){
    const runs = []; let cur = null;
    for(let x = x0 + (row & 1 ? sp * .5 : 0); x < x1 + sp * .5; x += sp){
      const px = x + (R() - .5) * 3, py = y + (R() - .5) * 3, k = o.k ? o.k(px, py) : 1;
      if(!inPoly(region, px, py) || (o.skip && o.skip(px, py))){ cur = null; continue; }
      if(!cur){ cur = []; runs.push(cur); } cur.push({x:px, y:py, rl:o.rl * k * (.94 + .12 * R()), rr:o.rr * k * (.94 + .12 * R())});
    }
    for(const r of runs) rows.push({row, run:r});
  }
  const out = [];
  rows.sort((a, b) => b.row - a.row).forEach(({row, run}, idx) => {   // the lowest row first
    const P = M.part(prefix + idx, {layer:o.layer, tier:'F', zone:'fleece', line:o.line || {k:.52, c:.8, r:'f', t:'bone', tk:.14}, tags:['fleece', ...o.tags], bind:o.bind, yaw:!!o.yaw, tone:(x, y, i) => (o.tone || .16) + .24 * hash(i * 17 + idx), tj:.05});
    const lamb = [], ram = [], add = (a, b) => { const id = M.vtx(P, a[0], a[1], o.z ? o.z(a[0], a[1]) : 0, o.yaw ? 1 : 0); lamb.push(a); ram.push(b); return id; };
    const ell = (c, r, q, n) => { const a = q * 2 * Math.PI / n; return [c.x + Math.cos(a) * r * 1.08, c.y + Math.sin(a) * r * .94]; };
    for(const c of run){ const ids = []; for(let q = 0; q < 9; q++) ids.push(add(ell(c, c.rl, q, 9), ell(c, c.rr, q, 9))); M.poly(P, ids); }
    const loop = [];   // the scallop: each lobe's lower arc from where it meets its left neighbour to where it meets its right neighbour
    run.forEach((c, k) => {
      const lim = (r, side) => { const nb = run[k + side]; if(!nb) return side < 0 ? Math.PI : 0; const half = Math.abs(nb.x - c.x) / 2, rx = r * 1.08; return Math.acos(clamp(side * half / rx, -1, 1)) * (side < 0 ? 1 : 1); };
      const aL = lim(c.rl, -1), aR = lim(c.rl, 1), bL = lim(c.rr, -1), bR = lim(c.rr, 1), N = 5;
      for(let q = 0; q <= N; q++){ if(k && q === 0) continue; const u = q / N, a = [c.x + Math.cos(lerp(aL, aR, u)) * c.rl * 1.08, c.y + Math.sin(lerp(aL, aR, u)) * c.rl * .94], b = [c.x + Math.cos(lerp(bL, bR, u)) * c.rr * 1.08, c.y + Math.sin(lerp(bL, bR, u)) * c.rr * .94]; loop.push(add(a, b)); }
    });
    P.loop = loop; P.open = true; M.close(P);
    if(o.about){ const [ab, sc] = o.about; for(let q = 0; q < ram.length; q++) ram[q] = [ab[0] + (lamb[q][0] - ab[0]) * sc, ab[1] + (lamb[q][1] - ab[1]) * sc]; }
    FLEECE.set(P.order, {v0:P.v0, lamb:lamb.flat(), ram:ram.flat()}); out.push(P);
  });
  return out;
}
{ const loop = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 'r0', 'r1', 'r2', 'r3', 'r4', 'b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'c0', 'c1', 'c2', 'c3'].map(k => TP[k]), body = chaikin(loop, 2);
  const SH = chaikin([[540, 306], [598, 292], [650, 338], [676, 410], [668, 484], [638, 530], [592, 544], [556, 510], [530, 440], [522, 368]], 2), HA = chaikin([[196, 360], [246, 338], [298, 348], [334, 392], [336, 448], [320, 492], [294, 520], [254, 528], [220, 502], [196, 456], [184, 406]], 2);
  const inner = (x, y) => !inPoly(SH, x, y) && !inPoly(HA, x, y);
  puffRows('puffBody', body, {layer:4.2, sp:27, rl:13.5, rr:19, bind:BODYB, tags:['torso', 'body'], skip:(x, y) => !inner(x, y), tone:.12});
  puffRows('puffShoulder', SH, {layer:6, sp:27, rl:13.5, rr:19, bind:{mix:[['chest', .72], ['scapN', .28]]}, tags:['fore', 'N', 'plate'], tone:.14});
  puffRows('puffHaunch', HA, {layer:6, sp:27, rl:13.5, rr:19, bind:{chain:['pelvis', 'femN'], sigma:44}, tags:['hind', 'N', 'plate'], tone:.14});
}

{ // the neck's wool and the ram's ruff
  /* the neck's wool follows the neck's chain and sways on the neck's wool bone (woolN: it had a follower and the shake and strike actions turn it, but nothing was bound to it): the hanging wool takes up to half its weight from it */
  const neckBind = (x, y) => { const nm = ['chest', 'neck', 'head'], ds = nm.map(n => { const B = M.bones[M.BI[n]]; return K.segDist(x, y, B.p[0], B.p[1], B.q[0], B.q[1]); }), dm = Math.min(...ds), W = M.bones[M.BI.woolN], dw = K.segDist(x, y, W.p[0], W.p[1], W.q[0], W.q[1]);
    return [...nm.map((n, i) => [n, Math.exp(-(((ds[i] - dm) / 26) ** 2)) + .001]), ['woolN', .5 * Math.exp(-((dw / 46) ** 2)) * fSmooth(300, 440, y) + .001]]; };
  const NK = chaikin([[570, 300], [630, 298], [700, 300], [752, 300], [770, 330], [770, 400], [760, 440], [742, 448], [696, 452], [658, 452], [626, 434], [596, 392], [576, 340]], 2);
  puffRows('puffNeck', NK, {layer:7.2, sp:25, rl:11.5, rr:16, bind:neckBind, tags:['neck'], tone:.14});
  lockRun('ruff', [[780, 438], [742, 448], [696, 452], [658, 452], [626, 434]], {closed:false, out:1, layer:7.4, gap:19, bw:30, lean:.55, tags:['neck', 'ruff'], bind:neckBind, len:(p, n, q) => [8, 40], tone:(x, y, i) => .2 + .3 * hash(i * 11 + 4)});
}

/* ---------- the head: ears and horns behind the face, then the face's cells, the mouth, the muzzle, the eyes and lids, the glyph ----------
   Every head part carries depth (z) and yaw, so a head turn shows parallax: the muzzle slides across the cheek, the far eye and far horn compress. */
const hd = (name, half, o) => M.zone(name, sym(half).map(hw), {yaw:true, ...o});
const hp = (name, poly, o = {}) => { const tg = o.tags || ['head', 'face', 'skin'], bs = sd => o.bindSide ? {rigid:o.bindSide + sd} : o.bind;
  M.zone(name + 'R', poly.map(hw), {yaw:true, ...o, bind:bs('R'), tags:[...tg, 'R']}); M.zone(name + 'L', mr(poly.map(hw)), {yaw:true, ...o, bind:bs('L'), tags:[...tg, 'L']}); };
const hs = (name, pts, o = {}) => { const tg = o.tags || ['head', 'face', 'skin']; M.shape(name + 'R', pts.map(hw), {yaw:true, ...o, tags:[...tg, 'R']}); M.shape(name + 'L', mr(pts.map(hw)), {yaw:true, ...o, tags:[...tg, 'L']}); };
const earPoly = [[48, -36], [72, -52], [104, -58], [134, -52], [146, -42], [132, -30], [102, -24], [72, -22], [52, -26]], earIn = [[62, -34], [92, -44], [120, -42], [130, -36], [116, -31], [90, -30], [66, -28]];
hp('ear', earPoly, {layer:7.9, tier:'F', h:12, zone:'ears', line:'feature', tags:['head', 'ear'], z:zh(-12), bindSide:'ear', tone:.26});
hp('earIn', earIn, {layer:7.9, tier:'F', h:9, inset:.3, zone:'ears', line:'feature', tags:['head', 'ear'], z:zh(-8), bindSide:'ear', flush:.5, tone:.4});
const FACE = [[0, -94], [26, -97], [48, -91], [59, -76], [63, -54], [60, -30], [52, -4], [44, 22], [38, 48], [33, 70], [31, 90], [24, 104], [0, 110]];
{ const fh = sym([[0, -94], [26, -97], [48, -91], [59, -76], [62, -60], [36, -66], [0, -64]]).map(hw), chR = [[62, -60], [63, -54], [60, -30], [52, -4], [44, 22], [38, 48], [30, 58], [26, 34], [28, -4], [32, -34], [36, -66]].map(hw), chL = mr(chR),
      fc = sym([[0, -64], [36, -66], [32, -34], [28, -4], [26, 34], [30, 58], [0, 64]]).map(hw), sm = K.smoothCells([fh, chR, chL, fc], 2);
  const fo = {layer:9, bind:{rigid:'head'}, yaw:true, z:zh(0), tags:['head', 'face', 'skin'], zone:'face'};
  M.zone('foreheadC', sm[0], {...fo, tier:'L', ptier:'M', h:24, line:'face'}); M.zone('cheekR', sm[1], {...fo, tier:'L', ptier:'M', h:26, line:'face', tags:['head', 'face', 'skin', 'R']});
  M.zone('cheekL', sm[2], {...fo, tier:'L', ptier:'M', h:26, line:'face', tags:['head', 'face', 'skin', 'L']}); M.zone('faceC', sm[3], {...fo, tier:'M', h:26, line:'face'});
  M.rim('faceRim', chaikin(sym(FACE).map(hw), 2), {layer:9, yaw:true, z:fo.z, bind:fo.bind, tags:['head', 'face'], s:12, zone:'face', line:'contour'}); }
// the mouth's inside lies under the muzzle and the jaw, so the jaw's drop uncovers it; a sheep has lower incisors and an upper dental pad
hd('cavity', [[0, 88], [18, 88], [28, 90], [28, 102], [22, 112], [0, 116]], {layer:10, tier:'M', h:20, inset:.4, z:zh(-30), bind:{rigid:'head'}, flush:1, zone:'mouth', line:'mouth', tone:0, tags:['head', 'face']});
hd('tongue', [[0, 98], [11, 96], [20, 102], [22, 111], [14, 119], [0, 122]], {layer:10, tier:'F', h:12, inset:.4, z:zh(-24), bind:{mix:[['jaw', .85], ['head', .15]]}, flush:.6, zone:'mouth', line:'mouth', tone:0, tags:['head', 'face', 'lo']});
hd('tongueOut', [[-13, 92], [13, 92], [12, 102], [9, 110], [5, 115], [0, 116], [-5, 115], [-9, 110], [-12, 102]], {layer:10, tier:'F', h:10, inset:.4, tags:['head', 'face', 'tongue2'], z:zh(8), bind:{rigid:'jaw'}, zone:'mouth', line:'mouth', tone:.55, flush:.9});
for(let i = 0; i < 4; i++){ const u = 3 + i * 6.2; hs('inc' + i, [[u - 3, 92], [u + 3, 92], [u, 103]], {layer:10, tier:'F', z:zh(-16), bind:{rigid:'jaw'}, zone:'mouth', line:'mouth', tone:.95, tags:['head', 'face', 'teeth', 'lo']}); }
hd('dentalPad', [[0, 86], [24, 85], [34, 88], [24, 94], [0, 94]], {layer:10, tier:'F', h:8, inset:.3, z:zh(-14), bind:{rigid:'head'}, zone:'mouth', line:'mouth', tone:.5, tags:['head', 'face']});
// the muzzle: two upper lips split by the philtrum, narrow, with the nose pad; the jaw; the nasal bridge; the nostrils
hp('muzzle', [[0, 56], [14, 54], [26, 60], [32, 74], [32, 90], [24, 102], [12, 106], [0, 104]], {layer:11, tier:'F', h:13, z:zh(0, (u, v) => 24 * Math.exp(-((u / 40) ** 2 + ((v - 80) / 34) ** 2))), bind:{rigid:'head'}, zone:'muzzle', line:'feature', tone:.5, tags:['head', 'face', 'skin', 'muz']});
hd('jaw', [[0, 90], [16, 90], [28, 94], [26, 106], [16, 115], [0, 118]], {layer:11, tier:'F', h:15, z:zh(0, (u, v) => 10 * Math.exp(-((u / 40) ** 2 + ((v - 102) / 22) ** 2))), bind:{rigid:'jaw'}, zone:'mouth', line:'feature', tags:['head', 'face', 'skin', 'lo'], tone:(x, y) => (y - HC[1]) < 92 ? .85 : .08});
hd('bridge', [[0, -40], [7, -34], [12, -6], [14, 26], [11, 52], [0, 54]], {layer:11, tier:'F', h:14, z:zh(6), bind:{rigid:'head'}, zone:'muzzle', line:{k:.34, c:.5, r:'b'}, tone:.1, tags:['head', 'face', 'skin']});
hs('nostril', chaikin(ringPts([0, 0], 1, 10, 0).map(([a, b]) => { const x = a * 11, y = b * 6.5, r = -.55; return [15 + x * Math.cos(r) - y * Math.sin(r), 86 + x * Math.sin(r) + y * Math.cos(r)]; }), 1), {layer:13, z:zh(26), bind:{rigid:'head'}, zone:'muzzle', line:'feature', tone:.22, tags:['head', 'face', 'skin', 'nostril']});
// the eye: an almond of fine iris facets with a horizontal pupil (a sheep's); the lids lie over it
const almond = [[24, -36], [32, -48], [48, -53], [62, -47], [66, -36], [58, -25], [42, -22], [30, -26]], PUPC = [45, -37], PR = hw(PUPC), PL = [2 * HC[0] - PR[0], PR[1]];
const lidU = [[21, -40], [28, -56], [48, -63], [69, -55], [73, -40], [66, -36], [62, -47], [48, -53], [32, -48], [24, -36]], lidL = [[21, -34], [27, -21], [42, -16], [61, -19], [73, -34], [66, -36], [58, -25], [42, -22], [30, -26], [24, -36]];
hp('eye', almond, {layer:12, tier:'F', h:9, inset:.3, z:zh(0, (u, v) => 10 * Math.exp(-(((u - 46) / 22) ** 2 + ((v + 38) / 18) ** 2))), bind:{rigid:'head'}, zone:'eyes', ink:'accent', line:'feature', flush:.15, tags:['head', 'face', 'eye'],
  tone:(x, y) => .7 + .3 * clamp(Math.hypot(x - (x < HC[0] ? PL[0] : PR[0]), y - PR[1]) / 28)});
const pup = c => [[c[0] - 15, c[1]], [c[0] - 9, c[1] - 6], [c[0], c[1] - 7], [c[0] + 9, c[1] - 6], [c[0] + 15, c[1]], [c[0] + 9, c[1] + 6], [c[0], c[1] + 7], [c[0] - 9, c[1] + 6]];
hs('pupil', pup(PUPC), {layer:13, z:zh(2), bind:{rigid:'head'}, zone:'eyes', line:'feature', tone:0, tags:['head', 'face', 'eye', 'pupil']});
hp('lidL', lidL, {layer:14, tier:'F', h:10, inset:.35, z:zh(5), bind:{rigid:'head'}, zone:'brows', line:{k:.5, c:.72, r:'f', t:'bone', tk:.2}, flush:.2, tone:.5});
hp('lidU', lidU, {layer:14, tier:'F', h:10, inset:.35, z:zh(9), bind:{rigid:'head'}, zone:'brows', line:{k:.5, c:.72, r:'f', t:'bone', tk:.2}, flush:.25, tone:.55});

/* ---------- the horns: a spiral that grows ----------
   The horn is one mesh (a strip of rows by a few columns, the head's bone), authored as a stack of GROWTH STAGES: the same spiral truncated at a larger and larger share of its length, so
   it lengthens and its curl is set as it goes (a ram's horn grows from the base; the keratin sheath curls because the outer side grows faster). The rest form is the bud under the
   poll's wool; each stage is a kit morph (hornG1..hornG5) holding the difference from the stage before, and the driver blends them from the one growth weight. Two more morphs
   (hornOpen, hornTight) change the full spiral's curl. The geometry is the sign: seen from the front the pair of horns is the glyph, two arcs curling out and down over a stem. */
const HORN_ROWS = 26, STAGES = [.06, .18, .36, .58, .8, 1];
const hornDense = curl => {   // the full horn's centreline in head units (right side), arclength-parametrised
  const th0 = -128 * Math.PI / 180, th1 = (196 + 42 * curl) * Math.PI / 180, r0 = 98, r1 = 27 - 6 * curl, C = [100, -12], pts = [], N = 260;
  for(let i = 0; i <= N; i++){ const u = i / N, th = lerp(th0, th1, u), r = r0 * Math.pow(r1 / r0, u); pts.push([C[0] + Math.cos(th) * r, C[1] + Math.sin(th) * r]); }
  const cum = [0]; for(let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return {pts, cum, L:cum[N], at(A){ let k = 1; while(k < N && cum[k] < A) k++; const a = pts[k - 1], b = pts[k], u = (A - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1), tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1; return {u:lerp(a[0], b[0], u), v:lerp(a[1], b[1], u), tx:tx / tl, ty:ty / tl}; }};
};
const DENSE = {}; const dense = curl => DENSE[curl] || (DENSE[curl] = hornDense(curl));
const hornW = (t, f) => { const hb = lerp(8.5, 17.5, Math.pow(f, .45)), tip = 1.6 + .4 * f; return tip + (hb - tip) * Math.pow(1 - t, 1.1); };
function hornPos(side, f, curl, cols, wk){   // [x, y] canvas positions of the rows by (cols + 1) vertices, for the horn grown to the share f of its length
  const D = dense(curl), out = [];
  for(let i = 0; i < HORN_ROWS; i++){
    const t = i / (HORN_ROWS - 1), q = D.at(f * t * D.L), w = hornW(t, f) * wk;
    for(let j = 0; j <= cols; j++){ const off = w * (2 * j / cols - 1); out.push(hw([side * (q.u - q.ty * off), q.v + q.tx * off])); }
  }
  return out;
}
const HORNMOD = new Map();
function hornPart(name, side, o){
  const cols = o.cols, P = M.part(name, {layer:o.layer, tier:'F', ptier:'F', zone:o.zone || 'horns', line:o.line, tags:[...o.tags, side > 0 ? 'R' : 'L'], bind:{rigid:'head'}, yaw:true, tone:o.tone, tj:o.tj ?? .03, ink:o.ink, flush:o.flush || 0});
  const stage = j => hornPos(side, STAGES[j], 0, cols, o.wk), st = STAGES.map((_, j) => stage(j)), full = st[st.length - 1], open = hornPos(side, 1, -1, cols, o.wk), tight = hornPos(side, 1, 1, cols, o.wk);
  const ids = []; for(let i = 0; i < HORN_ROWS; i++){ ids.push([]); for(let j = 0; j <= cols; j++){ const k = i * (cols + 1) + j, u = Math.abs(full[k][0] - HC[0]) / HS; ids[i].push(M.vtx(P, st[0][k][0], st[0][k][1], HS * (14 + .2 * u + (o.zk || 0)), 1)); } }
  for(let i = 0; i + 1 < HORN_ROWS; i++) for(let j = 0; j < cols; j++) M.poly(P, [ids[i][j], ids[i][j + 1], ids[i + 1][j + 1], ids[i + 1][j]]);
  P.loop = [...ids.map(r => r[0]), ...ids.map(r => r[cols]).reverse()];
  M.close(P);
  const flat = a => Float32Array.from(a.flat());
  HORNMOD.set(P.order, {v0:P.v0, st:st.map(flat), open:flat(open), tight:flat(tight), cols});
  return P;
}
const ringTone = (P, cols) => (x, y, i) => { const li = i - P.p0, row = Math.floor(li / cols), col = li % cols, t = row / (HORN_ROWS - 1); return clamp(.3 + .62 * Math.pow(t, .8) + (row & 1 ? .1 : -.04) + (col === 0 ? -.07 : .05), 0, 1); };
for(const side of [-1, 1]){
  const sd = side > 0 ? 'R' : 'L', P = hornPart('horn' + sd, side, {cols:2, layer:8, wk:1, tags:['head', 'horn'], line:'feature', flush:.7});
  P.tone = ringTone(P, 2);
}
/* the poll's wool lies over the horn buds: a soft cap of curls on the lamb that recedes as the horns come */
{ const cap = chaikin([[-62, -80], [-58, -108], [-34, -134], [0, -142], [34, -134], [58, -108], [62, -80], [30, -86], [0, -88], [-30, -86]].map(hw), 2);
  puffRows('pollCurl', cap, {layer:8.6, sp:19, rl:10.5, rr:6.5, bind:{rigid:'head'}, yaw:true, z:zh(18), tags:['head', 'poll'], tone:.2, about:[hw([0, -92]), .5]}); }
/* the sign: gold inlay along both horns, across the brow between their bases, and down the nasal ridge (the stem of the glyph) */
{ const g = {layer:15, ink:'gold', zone:'glyph', line:'glyph', tone:.92, tj:0, tags:['glyph', 'head']};
  for(const side of [-1, 1]){ const sd = side > 0 ? 'R' : 'L'; hornPart('hornInlay' + sd, side, {...g, cols:1, wk:.2, zk:3, tags:['glyph', 'head', 'horn']}); }
  M.strip('browInlay', Array.from({length:9}, (_, q) => { const u = -40 + q * 10; return [...hw([u, -85 - 5 * (1 - (u / 42) ** 2)]), 2.6 * HS]; }), {...g, yaw:true, bind:{rigid:'head'}, z:zh(4), host:['foreheadC'], tags:['glyph', 'head', 'skin']});
  M.strip('stemInlay', Array.from({length:12}, (_, q) => { const v = -78 + q * 12; return [...hw([0, v]), (2.2 + .8 * (q / 11)) * HS]; }), {...g, yaw:true, bind:{rigid:'head'}, z:zh(10), host:['foreheadC', 'faceC'], tags:['glyph', 'head', 'skin']}); }

/* ---------- the growth morphs ---------- */
M.morph('grow', () => null);   // the one weight: 0 the lamb, 1 the ram (the driver reads it and sets the others)
for(let j = 1; j < STAGES.length; j++) M.morph('hornG' + j, (x, y, P, v) => { const H = HORNMOD.get(P.order); if(!H) return null; const k = (v - H.v0) * 2; return [H.st[j][k] - H.st[j - 1][k], H.st[j][k + 1] - H.st[j - 1][k + 1]]; });
M.morph('hornOpen', (x, y, P, v) => { const H = HORNMOD.get(P.order); if(!H) return null; const k = (v - H.v0) * 2, F = H.st[STAGES.length - 1]; return [H.open[k] - F[k], H.open[k + 1] - F[k + 1]]; });
M.morph('hornTight', (x, y, P, v) => { const H = HORNMOD.get(P.order); if(!H) return null; const k = (v - H.v0) * 2, F = H.st[STAGES.length - 1]; return [H.tight[k] - F[k], H.tight[k + 1] - F[k + 1]]; });
M.morph('fleece', (x, y, P, v) => { const F = FLEECE.get(P.order); if(!F) return null; const k = (v - F.v0) * 2; return [F.ram[k] - F.lamb[k], F.ram[k + 1] - F.lamb[k + 1]]; });

/* the ram's head, neck and body: the lamb is the rest form (a round skull, big eyes, a short muzzle); the ram's skull is longer below the eye, broader at the brow, with smaller eyes. The head's
   morph is a map of the face's own units, applied to every part of the head, with the eyes shrunk about their own centres. */
const T = (u, v) => { const lo = v > -30, dv = (lo ? .14 : .08) * (v + 30), brow = fSmooth(30, -60, v), du = u * (.03 + .07 * brow - .05 * fSmooth(40, 100, v)); return [du, dv]; };
const EYEC = [45, -37];
M.morph('headM', (x, y, P, v) => {
  if(!P.tags.has('head') || P.tags.has('horn') || P.tags.has('poll')) return null;
  const u = (x - HC[0]) / HS, vv = (y - HC[1]) / HS;
  if(P.tags.has('eye') || P.name.startsWith('lid')){ const sg = u < 0 ? -1 : 1, cu = sg * EYEC[0], t = T(cu, EYEC[1]), s = .8; return [(t[0] + (s - 1) * (u - cu)) * HS, (t[1] + (s - 1) * (vv - EYEC[1])) * HS]; }
  const t = T(u, vv); return [t[0] * HS, t[1] * HS];
});
/* the lamb's head is the other end of the same map: a shorter face under a high round brow, wider set, with bigger eyes */
const TL = (u, v) => [u * .12 * fSmooth(60, -10, v) * (1 - fSmooth(-20, -60, v) * .6), (v > -25 ? -.22 : .1) * (v + 25)];
M.morph('lambM', (x, y, P) => {
  if(!P.tags.has('head') || P.tags.has('horn') || P.tags.has('poll')) return null;
  const u = (x - HC[0]) / HS, vv = (y - HC[1]) / HS;
  if(P.tags.has('eye') || P.name.startsWith('lid')){ const sg = u < 0 ? -1 : 1, cu = sg * EYEC[0], t = TL(cu, EYEC[1]), s = 1.16; return [(t[0] + (s - 1) * (u - cu)) * HS, (t[1] + (s - 1) * (vv - EYEC[1])) * HS]; }
  const t = TL(u, vv); return [t[0] * HS, t[1] * HS];
});
/* the lamb's body sits higher on its legs: a shallower barrel (the legs are a larger share of a lamb's height) */
M.morph('lambBody', (x, y, P) => { if(!(P.tags.has('torso') || P.tags.has('plate') || P.tags.has('body'))) return null; return [0, -(y - 340) * .12]; });
const NAX = (x) => 366 - (x - 612) * (36 / 140);
M.morph('neckM', (x, y, P) => { if(!P.tags.has('neck')) return null; return [0, (y - NAX(x)) * .24 - 8 * fSmooth(570, 740, x)]; });
const legAx = (P, y) => { const kind = P.tags.has('fore') ? FORE : HIND, S = P.tags.has('F') ? shiftSt(kind, P.tags.has('fore') ? FAR.fore : FAR.hind) : kind; let k = 1; while(k < S.length - 1 && S[k][1] < y) k++; const a = S[k - 1], b = S[k], t = clamp((y - a[1]) / ((b[1] - a[1]) || 1), 0, 1); return lerp(a[0], b[0], t); };
M.morph('bodyM', (x, y, P) => {
  if(P.tags.has('leg') || P.tags.has('paw')) return [(x - legAx(P, y)) * .15, 0];
  if(P.tags.has('torso') && !P.tags.has('fleece')) return [fSmooth(560, 700, x) * (x - 560) * .05, fSmooth(430, 530, y) * 18];
  return null;
});

/* ---------- muscles ----------
   The face rig's muscle (a gaussian field in rest space that displaces vertices and inks creases) that also turns the joints it really turns. Pairs: LR mirrors across the
   head's axis (rotations mirror too), NF is the near and far limb. Head muscles are placed on the right half of the face (u > 0); the left instance mirrors them. */
const cr = (cx, cy, rx, ry, ang, f, amp = .5, lo = .78, hi = .95) => K.crease(cx, cy, rx, ry, ang, f, amp, lo, hi), soft = (cx, cy, rx, ry, amp) => K.glow(cx, cy, rx, ry, amp), both = K.both;
const hcr = (c, rx, ry, ang, f, amp, lo, hi) => { const w = H(...c); return cr(w[0], w[1], rx * HS, ry * HS, ang, f / HS, amp, lo, hi); }, hsoft = (c, rx, ry, amp) => { const w = H(...c); return soft(w[0], w[1], rx * HS, ry * HS, amp); };
const hm = (id, name, g, c, r, o) => M.muscle(id, {name, g, pair:'LR', c:H(...c), r:r.map(q => q * HS), speed:o.speed ?? 10, ...o, v:o.v && o.v.map(q => q * HS)});
// the jaw: closers against the opener; a sheep chews sideways, so the pterygoids slide the jaw to a side
hm('temporalis', 'temporalis', 'jaw', [56, -80], [26, 24], {v:[6, -14], hue:'#a09080', speed:8, jt:[['jaw', -6, 'y']], shade:both(hcr([56, -80], 24, 22, 1.2, .2, .95), hsoft([56, -80], 26, 24, .7))});
hm('masseter', 'masseter', 'jaw', [44, 50], [26, 36], {v:[5, -16], hue:'#b09880', speed:8, jt:[['jaw', -8, 'y']], shade:both(hcr([44, 52], 22, 34, 1.45, .22, .95), hsoft([44, 50], 26, 36, .7))});
hm('digastric', 'digastric', 'jaw', [20, 104], [28, 20], {dir:[0, 1], hue:'#80a0a8', speed:9, jt:[['jaw', 18, 'y']], host:'jaw'});
M.muscle('chewR', {name:'pterygoid (jaw to the right)', g:'jaw', c:H(16, 98), r:[28 * HS, 24 * HS], hue:'#c0b090', speed:11, jt:[['jaw', 7, 'x']], host:'jaw', dir:[1, 0]});
M.muscle('chewL', {name:'pterygoid (jaw to the left)', g:'jaw', c:H(-16, 98), r:[28 * HS, 24 * HS], hue:'#c0b090', speed:11, jt:[['jaw', -7, 'x']], host:'jaw', dir:[-1, 0]});
hm('depLab', 'depressor labii inferioris', 'lips', [20, 104], [24, 20], {v:[3, 14], hue:'#90a0c8', speed:10, on:['lo'], shade:hcr([20, 102], 22, 18, 1.3, .2, .8)});
hm('levLab', 'levator labii superioris (curl the lip)', 'lips', [22, 66], [26, 26], {v:[6, -22], hue:'#e3806f', speed:12, on:['skin'], shade:hcr([22, 62], 24, 24, .5, .2, .9)});
hm('nasolab', 'nasolabialis', 'lips', [30, 78], [20, 24], {v:[12, -10], hue:'#d8c89a', speed:11, on:['skin'], shade:both(hcr([30, 76], 18, 22, 1.1, .22, .85), hsoft([30, 76], 20, 24, .7))});
hm('nostril', 'dilator naris (flare the nostril)', 'lips', [18, 82], [20, 18], {pull:[-.42, -.36], hue:'#ff9a76', speed:14, on:['nostril', 'muz'], shade:hsoft([18, 82], 18, 16, .5)});
hm('nasalis', 'nasalis (wrinkle the nose)', 'lips', [14, 20], [18, 40], {v:[-3, -18], hue:'#d985a6', speed:12, on:['skin'], shade:hcr([14, 24], 18, 36, 1.57, .3, .95)});
// the eye and brow
hm('orbic', 'orbicularis oculi', 'eyes', [45, -37], [32, 22], {pull:[.5, .9], hue:'#ffbe00', speed:18, on:['skin'], shade:hcr([46, -38], 30, 20, .3, .25, .7)});
hm('levPalp', 'levator palpebrae', 'eyes', [45, -62], [32, 14], {v:[0, -18], hue:'#7ec3e6', speed:16, on:['skin'], shade:both(hcr([46, -64], 28, 12, 1.57, .3, .8), hsoft([46, -64], 30, 12, .65))});
hm('frontalis', 'frontalis (raise the brow)', 'eyes', [34, -84], [38, 18], {v:[0, -12], hue:'#c79ae0', speed:10, on:['skin'], shade:both(hcr([34, -86], 36, 18, 1.57, .22, .8), hsoft([34, -86], 38, 18, .6))});
hm('corrug', 'corrugator supercilii', 'eyes', [24, -62], [24, 14], {v:[-14, 12], hue:'#e0523f', speed:11, on:['skin'], shade:both(hcr([22, -60], 20, 14, 0, .3, .95), hsoft([22, -60], 22, 14, .75))});
hm('dilator', 'pupil dilator', 'eyes', [45, -37], [16, 12], {pull:[-.8, -.8], hue:'#3b3a78', speed:10, on:['pupil']});
for(const [id, nm, v] of [['lookR', 'gaze right', [8, 0]], ['lookL', 'gaze left', [-8, 0]], ['lookU', 'gaze up', [0, -4]], ['lookD', 'gaze down', [0, 4]]]) hm(id, nm, 'gaze', [45, -37], [14, 12], {v, vm:0, hue:'#7ec3e6', speed:14, on:['pupil']});
// ears: a sheep's ear is a leaf held out to the side; it drops, rises and swivels
hm('earBack', 'auricularis posterior (ear back and down)', 'ears', [100, -40], [44, 24], {v:[0, 10], hue:'#a89880', speed:14, on:['ear'], jt:[['ear$', .9, 'r']]});
hm('earUp', 'auricularis superior (ear up)', 'ears', [100, -40], [44, 24], {v:[0, -8], hue:'#b0a090', speed:14, on:['ear'], jt:[['ear$', -.5, 'r']]});
hm('earFwd', 'auricularis anterior (ear forward)', 'ears', [112, -40], [34, 22], {v:[10, 0], vm:1, hue:'#c0b8a0', speed:13, on:['ear'], jt:[['ear$', -.2, 'r']]});
hm('splenius', 'splenius capitis (turn the head)', 'neck', [60, -50], [26, 40], {v:[0, -3], hue:'#9a88c0', speed:6, on:['skin'], jt:[['@yaw', .62, 'yaw'], ['head', .05, 'r']]});
M.muscle('tongueOut', {name:'genioglossus (the tongue out)', g:'jaw', c:H(0, 112), r:[24 * HS, 36 * HS], v:[0, 40 * HS], hue:'#c85a6a', speed:11, on:['tongue2']});
hm('tongueFlick', 'tongue flick (to the nostril)', 'jaw', [0, 108], [22, 18], {v:[14, -80], hue:'#e07a7a', speed:12, on:['tongue2']});
// the neck
M.muscle('neckUp', {name:'semispinalis capitis (neck extensor)', g:'neck', c:[690, 322], r:[70, 36], v:[0, -5], hue:'#7ec3e6', speed:6.5, on:['neck', 'torso'], jt:[['neck', -.55, 'r'], ['head', -.06, 'r']], shade:cr(690, 324, 66, 30, 0, .1, .5)});
M.muscle('neckDown', {name:'longus colli · scalenus (neck flexor)', g:'neck', c:[690, 430], r:[64, 28], v:[0, 4], hue:'#ffbe00', speed:6.5, on:['neck'], jt:[['neck', .5, 'r'], ['head', .05, 'r']], shade:cr(690, 430, 60, 24, 0, .1, .5)});
M.muscle('rhomboid', {name:'rhomboideus · trapezius (the withers)', g:'neck', c:[580, 320], r:[62, 36], v:[0, -7], hue:'#9a88c0', speed:8, on:['torso', 'neck'], jt:[['chest', -.03, 'r']], shade:both(cr(580, 322, 56, 30, .6, .12, .6), soft(580, 320, 56, 32, .5))});
M.muscle('throat', {name:'hyoid · laryngeal (the throat)', g:'neck', c:[760, 440], r:[34, 24], v:[0, 8], hue:'#8fb0a0', speed:12, on:['neck'], shade:soft(760, 440, 32, 22, .55), host:'neck'});
M.muscle('brachioceph', {name:'brachiocephalicus', g:'neck', pair:'NF', far:[46, -4], c:[640, 380], r:[46, 54], v:[0, -4], hue:'#7090a0', speed:7, on:['torso', 'fore', 'neck'], jt:[['neck', -.06, 'r'], ['hum$', -.12, 'r']], shade:cr(640, 380, 40, 48, 2.2, .1, .5)});
// the trunk
M.muscle('epaxial', {name:'longissimus dorsi (epaxial)', g:'spine', c:[400, 340], r:[190, 22], v:[0, -6], hue:'#c8a070', speed:7, on:['torso'], jt:[['pelvis', .08, 'r'], ['chest', -.08, 'r']], shade:cr(400, 344, 190, 18, 0, .09, .6)});
M.muscle('hypaxial', {name:'rectus abdominis (hypaxial)', g:'spine', c:[400, 520], r:[190, 24], v:[0, 6], hue:'#a8c0a0', speed:7, on:['torso'], jt:[['pelvis', -.14, 'r'], ['chest', .14, 'r']], shade:cr(400, 520, 190, 18, 0, .1, .6)});
M.muscle('intercostals', {name:'intercostals', g:'spine', c:[490, 440], r:[120, 76], pull:[-.075, -.12], hue:'#8fd0a8', speed:5, on:['torso'], dir:[0, 1], host:'chest', shade:soft(490, 440, 110, 70, .2)});
M.muscle('flank', {name:'external oblique (the flank)', g:'spine', c:[340, 482], r:[58, 40], v:[3, 7], hue:'#b0d0a8', speed:6, on:['torso', 'hind'], dir:[0, 1], host:'pelvis', shade:soft(340, 482, 52, 36, .2)});
for(const [id, x, y] of [['panniculusA', 470, 420], ['panniculusB', 392, 404], ['panniculusC', 314, 392]]) M.muscle(id, {name:'panniculus carnosus (' + id.slice(10) + ')', g:'skin', c:[x, y], r:[46, 62], v:[0, -4], hue:'#d8b8a0', speed:16, on:['torso'], dir:[0, -1], host:'chest', shade:both(cr(x, y, 44, 58, 1.3, .16, .6), soft(x, y, 44, 58, .35))});
// the fleece: the arrector fields lift the wool outward, so it ruffles and settles
for(const [id, x, y, nm] of [['woolA', 520, 400, 'the fleece (shoulder)'], ['woolB', 400, 410, 'the fleece (back)'], ['woolC', 290, 420, 'the fleece (rump)']]) M.muscle(id, {name:'arrector pili · ' + nm, g:'skin', c:[x, y], r:[70, 90], pull:[-.07, -.07], hue:'#e0b8a0', speed:6, on:['fleece'], dir:[0, -1], host:x < 340 ? 'pelvis' : x < 460 ? 'body' : 'chest', shade:soft(x, y, 66, 80, .16)});
// the foreleg
const fm = (id, name, c, r, o) => M.muscle(id, {name, g:'foreleg', pair:'NF', c, r, speed:10, ...o});
fm('trapezius', 'trapezius', [548, 346], [72, 34], {v:[0, -9], hue:'#9a88c0', speed:8, on:['torso', 'fore'], jt:[['scap$', .06, 'r']], shade:cr(548, 350, 60, 26, .7, .12, .6)});
fm('serratus', 'serratus ventralis', [578, 424], [44, 52], {v:[-4, -6], hue:'#c9a0dc', speed:9, on:['torso', 'fore'], jt:[['scap$', -.16, 'r']], shade:cr(578, 424, 40, 46, 1.2, .16, .6)});
fm('pectoral', 'pectoralis (superficial and deep)', [648, 484], [38, 44], {v:[6, 3], hue:'#d49aa0', speed:9, on:['torso', 'fore'], jt:[['hum$', .22, 'r']], shade:cr(648, 484, 34, 40, 1.9, .16, .6)});
fm('supraspinatus', 'supraspinatus', [584, 378], [34, 34], {v:[4, -6], hue:'#a8b890', speed:9, on:['torso', 'fore'], jt:[['hum$', -.22, 'r']], shade:cr(584, 378, 30, 30, .9, .16, .55)});
fm('deltoid', 'deltoid', [606, 440], [36, 42], {v:[8, -6], hue:'#e0b060', speed:10, on:['fore'], jt:[['hum$', -.42, 'r']], shade:cr(608, 444, 32, 38, .3, .18, .6)});
fm('latissimus', 'latissimus dorsi', [524, 436], [62, 54], {v:[-10, -8], hue:'#d47868', speed:9, on:['torso', 'fore'], jt:[['hum$', .38, 'r']], shade:cr(520, 440, 58, 50, -.6, .13, .66)});
fm('brachialis', 'biceps brachii · brachialis', [616, 490], [24, 48], {v:[5, -6], hue:'#e0a8b8', speed:11, on:['fore'], jt:[['rad$', -.7, 'r']], shade:cr(616, 490, 20, 42, 1.57, .22, .6)});
fm('triceps', 'triceps brachii', [570, 490], [30, 52], {v:[-7, -8], hue:'#e07088', speed:10, on:['fore'], jt:[['rad$', .5, 'r']], shade:cr(570, 490, 26, 48, 1.57, .2, .66)});
fm('extCarpi', 'extensor carpi', [610, 600], [22, 44], {v:[0, -3], hue:'#a0c8c0', speed:13, on:['fore'], jt:[['hand$', -.4, 'r']], shade:cr(610, 600, 16, 38, 1.57, .26, .55)});
fm('flexCarpi', 'flexor carpi', [592, 600], [22, 44], {v:[0, 4], hue:'#b0a0d0', speed:13, on:['fore'], jt:[['hand$', .55, 'r']], shade:cr(592, 600, 18, 38, 1.57, .26, .6)});
// the hindquarter
const hmu = (id, name, c, r, o) => M.muscle(id, {name, g:'hindleg', pair:'NF', c, r, speed:10, ...o});
hmu('hipFlex', 'iliopsoas (hip flexor)', [302, 438], [36, 36], {v:[4, -6], hue:'#c0a0d0', speed:9, on:['torso', 'hind'], jt:[['fem$', -.42, 'r']]});
hmu('tfl', 'tensor fasciae latae', [292, 392], [34, 32], {v:[5, -5], hue:'#d8a8c0', speed:9, on:['torso', 'hind'], jt:[['fem$', -.12, 'r']], shade:cr(292, 394, 30, 28, .5, .16, .55)});
hmu('glutes', 'gluteals', [236, 404], [50, 52], {v:[-8, -4], hue:'#e0b060', speed:9, on:['torso', 'hind'], jt:[['fem$', .36, 'r']], shade:cr(236, 404, 46, 46, .5, .13, .65)});
hmu('hamstrings', 'biceps femoris (hamstrings)', [228, 472], [34, 58], {v:[-8, 6], hue:'#d89060', speed:10, on:['hind'], jt:[['fem$', .18, 'r'], ['tib$', .45, 'r']], shade:cr(228, 472, 30, 54, 1.57, .18, .66)});
hmu('quads', 'quadriceps', [312, 472], [34, 48], {v:[8, -4], hue:'#c48070', speed:10, on:['hind'], jt:[['tib$', -.5, 'r'], ['fem$', -.06, 'r']], shade:cr(312, 472, 30, 44, 1.57, .2, .6)});
hmu('gastroc', 'gastrocnemius', [244, 588], [26, 46], {v:[-8, 6], hue:'#e07070', speed:12, on:['hind'], jt:[['foot$', .55, 'r']], shade:cr(244, 588, 22, 40, 1.57, .24, .66)});
hmu('tibialis', 'tibialis cranialis', [286, 590], [22, 44], {v:[4, -3], hue:'#8090c0', speed:12, on:['hind'], jt:[['foot$', -.45, 'r']], shade:cr(286, 590, 18, 38, 1.57, .26, .55)});
/* the hooves (anatomy audit, round 5): the coronet joint was turned only by a posture's channel and a pad, and no muscle was its own. Each foot has a deep digital flexor and a digital extensor, driven through the swing
   (the foot lifts: the hoof closes under it, then opens to land); the muscles turn the hoof's bone (toeF fore, toeH hind) and light with it */
{ const hoofM = (id, name, bone, g, jt, hue) => { const p = M.bones[M.BI[bone + 'N']].p, c = [p[0] + 8, p[1] - 10]; M.muscle(id, {name, g, pair:'NF', c, r:[26, 26], on:['paw'], jt, hue, speed:12, shade:soft(c[0], c[1], 22, 22, .35)}); };
  hoofM('hoofFlexF', 'flexor digitorum profundus (the forehoof)', 'toeF', 'foreleg', [['toeF$', .8, 'r']], '#d8a8a0'); hoofM('hoofExtF', 'extensor digitorum (the forehoof)', 'toeF', 'foreleg', [['toeF$', -.5, 'r']], '#a0b8d0');
  hoofM('hoofFlexH', 'flexor digitorum profundus (the hind hoof)', 'toeH', 'hindleg', [['toeH$', .8, 'r']], '#d8a8a0'); hoofM('hoofExtH', 'extensor digitorum (the hind hoof)', 'toeH', 'hindleg', [['toeH$', -.5, 'r']], '#a0b8d0'); }
// the tail: it hangs, and swings forward and back; the lamb's wag is its signature
M.muscle('levCaudae', {name:'levator caudae (swing the tail out and up)', g:'tail', c:[186, 440], r:[34, 110], v:[0, 0], dir:[-1, 0], hue:'#d8c89a', speed:8, on:['tail'], jt:[['tail0', .09, 'r'], ['tail1', .07, 'r'], ['tail2', .06, 'r'], ['tail3', .04, 'r']], host:'tail1'});
M.muscle('depCaudae', {name:'depressor caudae (hold it in)', g:'tail', c:[186, 440], r:[34, 110], v:[0, 0], dir:[1, 0], hue:'#8f9ac0', speed:11, on:['tail'], jt:[['tail0', -.08, 'r'], ['tail1', -.06, 'r'], ['tail2', -.05, 'r'], ['tail3', -.04, 'r']], host:'tail1'});
M.muscle('flexMid', {name:'caudal flexor (mid)', g:'tail', c:[182, 490], r:[30, 50], v:[0, 0], dir:[-1, 0], hue:'#c090c0', speed:12, on:['tail'], jt:[['tail2', .08, 'r'], ['tail3', .1, 'r']], host:'tail2'});
M.muscle('flexTip', {name:'intertransversarii (the tip)', g:'tail', c:[181, 515], r:[28, 40], v:[0, 0], dir:[-1, 0], hue:'#e0a060', speed:14, on:['tail'], jt:[['tail3', .12, 'r']], host:'tail3'});

/* ---------- postures and edges ----------
   Stand (a hand's breadth low, so the legs have slack), lie (sternal: sheep go down front first, kneeling, and the rear folds after; they get up rear first), kneel (the front on its knees,
   the rear still up: the stage between, and how a sheep grazes), agnus (the Agnus Dei: recumbent, the head turned back over the shoulder), brace (the head lowered, shoulders loaded, the
   tail stiff: the ram's charge comes from it, and the lamb's play-bow) and rear (up on the hind legs, for the clash). */
const PIV = [262, 400], HAND0 = Math.atan2(85, 19), FOOT0 = Math.atan2(123, 18);
const rotW = (p, th, dx, dy) => { const c = Math.cos(th), s = Math.sin(th); return [PIV[0] + c * (p[0] - PIV[0]) - s * (p[1] - PIV[1]) + dx, PIV[1] + s * (p[0] - PIV[0]) + c * (p[1] - PIV[1]) + dy]; };
const farOf = (f, o) => f && [f[0] + o[0], f[1] + o[1], f[2]];
const feet = (fn, hn, o = {}) => [fn, farOf(fn, [FAR.fore[0] + (o.fx || 0), FAR.fore[1]]), hn, farOf(hn, [FAR.hind[0] + (o.hx || 0), FAR.hind[1]])];
M.posture('stand', {root:[0, 16, 0]});
M.posture('brace', {root:M.rootV(PIV, .055, 0, 8), jt:{chest:.05, neck:.52, head:-.3, tail0:.2, tail1:.08, tail2:.05}, feet:feet([640, 735, HAND0 + .05], [268, 735, FOOT0]), cam:[1.1, 522, 412]});
M.posture('kneel', {root:M.rootV(PIV, .2, 0, 14), jt:{chest:.3, neck:-.46, head:.1, tail0:.1, toeFN:-1.2, toeFF:-1.2}, feet:feet([588, 734, 2.72], [280, 735, FOOT0], {fx:-6}), cam:[1.05, 530, 414]});
M.posture('lie', {root:[0, 186, -.012], jt:{chest:.04, neck:-.2, head:.12, tail0:.12, tail1:.05, tail2:-.3, tail3:-.6, toeFN:-1.2, toeFF:-1.2, toeHN:1.15, toeHF:1.15}, feet:feet([596, 734, 2.72], [338, 733, .12], {fx:-4, hx:12}), cam:[1.05, 535, 428], ground:1});
M.posture('agnus', {root:[0, 186, -.012], jt:{chest:.08, neck:-1.75, head:.9, tail0:.12, tail1:.05, tail2:-.3, tail3:-.6, toeFN:-1.2, toeFF:-1.2, toeHN:1.15, toeHF:1.15}, feet:feet([596, 734, 2.72], [338, 733, .12], {fx:-4, hx:12}), cam:[1.05, 520, 428], ground:1});
{ const th = -.62, dx = 24, dy = 46, sh = rotW(J.hum[0], th, dx, dy), rv = M.rootV(PIV, th, dx, dy);
  M.posture('rear', {root:rv, jt:{chest:-.1, neck:.5, head:-.12, tail0:.35, toeFN:-.3, toeFF:-.3}, feet:feet([sh[0] + 48, sh[1] + 150, 1.75], [286, 735, FOOT0], {fx:-18}), cam:[1.3, 535, 345]}); }
M.edge('stand>brace', {ms:1900, g:{head:[0, 1300], front:[250, 1300], root:[300, 1400], rear:[550, 1100], tail:[700, 1000], cam:[0, 1800]}, bumps:[['rr', 0, 600, -.012]]});
M.edge('stand>kneel', {ms:2300, g:{front:[0, 1700], root:[250, 1750], head:[900, 1200], rear:[1500, 700], tail:[500, 1600], cam:[0, 2200]}, bumps:[['rr', 0, 800, -.012]]});
M.edge('kneel>lie', {ms:2900, g:{rear:[0, 1800], root:[200, 1900], front:[900, 1500], head:[1500, 1300], tail:[0, 1500], cam:[0, 2700]}});
M.edge('lie>kneel', {ms:2700, g:{rear:[0, 1600], root:[0, 1500], head:[0, 1200], front:[1300, 1300], tail:[900, 1700], cam:[0, 2400]}});
M.edge('kneel>stand', {ms:2300, g:{rear:[0, 900], front:[500, 1500], root:[400, 1500], head:[900, 1200], tail:[900, 1200], cam:[400, 1800]}});
M.edge('lie>agnus', {ms:2600, g:{head:[0, 2200], root:[400, 1600], front:[0, 1200], rear:[0, 1200], tail:[0, 1500], cam:[0, 2400]}});
M.edge('stand>rear', {ms:2700, g:{rear:[0, 1200], root:[350, 1500], front:[500, 1400], head:[700, 1300], tail:[400, 1500], cam:[0, 1500]}, bumps:[['ry', 0, 700, 16]]});
M.edge('rear>stand', {ms:2900, g:{head:[0, 1000], root:[250, 1600], front:[300, 1800], rear:[600, 1500], tail:[900, 1500], cam:[300, 2200]}, bumps:[['ry', 1900, 800, 9]]});

/* ---------- gaits: one engine on a blend line ----------
   pronk (the lamb's stiff-legged bounce, all four feet together), walk and trot run on the stand; the charge is a transverse gallop and runs on the brace, so it comes from the threat. */
M.gait('pronk', {psi:.4, base:'stand', L:58, cyc:760, duty:.4, lift:[64, 64, 62, 62], off:[0, .02, .03, .05], flex:[.5, .5, .55, .55], hs:[0, 0, 8, 8], bob:5, sink:0, cap:1.6, lead:0});
M.gait('walk', {psi:1, base:'stand', L:104, cyc:1500, duty:.7, lift:[34, 34, 32, 32], off:[.75, .25, 0, .5],   /* lateral sequence: a hind foot, then the fore foot of the same side a quarter cycle later (it was diagonal sequence) */ flex:[.55, .5, .65, .65], hs:[0, 0, 10, 10], bob:3.5, sink:0, cap:1.8, lead:0});
M.gait('trot', {psi:2, base:'stand', L:134, cyc:860, duty:.5, lift:[44, 44, 40, 40], off:[0, .5, .5, 0], flex:[.7, .65, .8, .8], hs:[0, 0, 12, 12], bob:7, sink:6, cap:1.6, lead:0});
M.gait('charge', {psi:3, base:'brace', L:168, cyc:660, duty:.38, lift:[56, 56, 52, 52], off:[.56, .45, .1, 0], flex:[.9, .85, 1.05, 1.05], hs:[0, 0, 16, 16], bob:11, sink:12, cap:1.5, lead:3});

/* ---------- actions ----------
   Each adds to the muscle targets and the pose channels for its own clock. With no `in` an action is a layer (any posture, even mid-transition); with `in` it needs those
   postures and the sheep goes to the nearest one first. Planted feet stay planted: a layered action never moves them, and a foot an action lifts is blended from where
   the posture has it and returned there. The growth weight g gates them: a lamb's action (marked lamb) fades as the ram arrives, a ram's (marked ram) fades in with it, and
   those both have (a butt, a bleat) change how they look: a lamb's butt is a nudge, a ram's a charge. */
const G_ = c => c.morphW('grow'), RM = c => fSmooth(.35, .95, c.morphW('grow')), LM = c => 1 - fSmooth(.05, .65, c.morphW('grow'));
const KS = (t, kk) => keys(t, kk), sinc = (t, f, ph = 0) => Math.sin(t * f + ph);
const mid = v => [v, v];
const raiseTongue = (c, e, t, dur) => { if(e > .05 && t < dur - 80) c.raise('tongue2'); else if(c.top === 'tongue2') c.raise(null); };
M.action('blink', {label:'Blink', group:'Face', dur:360, tiny:true, gait:true, f:(t, T, c) => { const e = env(t, 70, 40, 130); c.spec(T, {orbic:mid(1.45 * e), levPalp:mid(-.3 * e)}); }});
M.action('slowblink', {label:'Slow blink', group:'Face', dur:3200, gait:true, f:(t, T, c) => { const b = KS(t, [[0, 0], [850, 1], [1500, 1], [2500, 0]]); c.jt('head', .035 * b); c.Q.yaw += .08 * b; c.spec(T, {orbic:mid(1.35 * b), levPalp:mid(-.4 * b), earBack:mid(.2 * b), intercostals:.3 * b}); }});
M.action('ear', {label:'Ear flick', group:'Face', dur:760, tiny:true, gait:true, f:(t, T, c, a) => { const s = a.side ?? (a.side = c.rand() < .5 ? 0 : 1), e = pulse(t, 0, 70, 40, 140) + .7 * pulse(t, 230, 60, 20, 120), v = [0, 0]; v[s] = e; c.spec(T, {earBack:[.45 * v[0], .45 * v[1]], earUp:[.2 * v[1], .2 * v[0]]}); }});
M.action('listen', {label:'Listen', group:'Face', dur:4400, gait:true, f:(t, T, c) => { const L = KS(t, [[0, 0], [380, 1], [1500, .3], [2100, -.3], [3200, -.3], [4000, 0]]), R = KS(t, [[0, 0], [700, 0], [1050, 1], [2700, 1], [3500, 0]]), h = KS(t, [[0, 0], [450, 1], [3000, 1], [4200, 0]]);
  c.spec(T, {earFwd:[pos(L), pos(R)], earUp:[.4 * pos(L), .4 * pos(R)], earBack:[pos(-L), 0]}); c.Q.yaw += .2 * h; c.jt('neck', -.03 * h); c.spec(T, {levPalp:mid(.3 * h)}); }});
M.action('glance', {label:'Glance', group:'Face', dur:2600, gait:true, f:(t, T, c, a) => { const d = a.dir ?? (a.dir = c.rand() < .5 ? -1 : 1), g = KS(t, [[0, 0], [300, 1], [1500, 1], [2400, 0]]), gz = KS(t, [[0, 0], [160, 1], [1550, 1], [2200, 0]]);
  c.Q.yaw += .2 * d * g; c.spec(T, {lookR:d > 0 ? mid(gz) : mid(0), lookL:d < 0 ? mid(gz) : mid(0), levPalp:mid(.12 * g), earFwd:d > 0 ? [0, .3 * g] : [.3 * g, 0]}); }});
M.action('nod', {label:'Nod', group:'Face', dur:1500, gait:true, f:(t, T, c) => { const e = env(t, 200, 700, 450); c.jt('neck', .1 * e * sinc(t, .009)); c.jt('head', -.07 * e * sinc(t, .009)); }});
// breath and voice: the lamb's bleat is high and quick and small, the ram's a long deep baa
M.action('sigh', {label:'Sigh', group:'Breath', dur:2800, gait:true, f:(t, T, c) => { const e = KS(t, [[0, 0], [1000, 1], [1300, .95], [2600, 0]]), x = KS(t, [[0, 0], [1200, 0], [1500, 1], [2700, 0]]); c.jt('chest', -.02 * e); c.jt('neck', .02 * e - .02 * x); c.spec(T, {intercostals:1.15 * e - .5 * x, flank:.8 * e - .4 * x, nostril:mid(.3 * x), epaxial:.1 * e}); }});
M.action('snort', {label:'Snort', group:'Breath', dur:1800, gait:true, f:(t, T, c, a) => {
  const p1 = pulse(t, 0, 80, 40, 260), p2 = pulse(t, 430, 80, 40, 280), p3 = .8 * pulse(t, 880, 80, 30, 300), s = p1 + p2 + p3;
  c.spec(T, {nostril:mid(1.25 * s), nasalis:.2 * s, flank:.8 * s, intercostals:.9 * s, orbic:mid(.3 * s), earBack:mid(.25 * s), throat:.3 * s}); c.jt('neck', .05 * s); c.jt('head', .05 * s);
  for(const [k, t0] of [[1, 90], [2, 520], [3, 960]]) if(t > t0 && !a['b' + k]){ a['b' + k] = 1; const p = c.wp('head', hw([20 * (k % 2 ? 1 : -1), 86])); c.burstAt(p[0], p[1], 50, K.hexInt(K.ROSTER.bone), 'muzzle'); } }});
M.action('bleat', {label:'Bleat', group:'Voice', dur:3400, gait:true, f:(t, T, c, a) => {
  const R = RM(c), e = env(t, 260, 1400 + 700 * R, 700), hold = env(t, 420, 1200 + 700 * R, 150), fr = lerp(.058, .03, R), v = lerp(.05, .035, R) * sinc(t, fr) * hold, inh = KS(t, [[0, 0], [550, 1], [880, 0]]), A = c.shiftAmt();
  c.jt('neck', -lerp(.16, .22, R) * e * A + .05 * inh * A); c.jt('head', -.14 * e); c.jt('chest', -.025 * e + .025 * inh);
  c.spec(T, {digastric:mid(lerp(.55, .95, R) * e + v), depLab:mid(.4 * e), levLab:mid(.35 * e), nostril:mid(.7 * e + .4 * inh), corrug:mid(.4 * e), earBack:mid(.3 * e), intercostals:1 * e + 1 * inh, flank:.8 * inh - .3 * e, throat:.5 * e + .22 * hold * sinc(t, fr), tongueOut:.2 * e * R, masseter:mid(-.15 * e)});
  c.flushT = Math.max(c.flushT, .5 * e * R); if(t > 1100 && !a.gl && R > .9){ a.gl = 1; c.glyph(3000); } raiseTongue(c, e * R * .5, t, 3400); }});
M.action('lickNose', {label:'Lick the nose', group:'Mouth', dur:3600, gait:true, f:(t, T, c) => { const e = env(t, 300, 2600, 500), w = .5 + .5 * sinc(t, .0072, -1.2), side = sinc(t, .0036) > 0 ? 1 : 0;
  const u = [0, 0]; u[side] = 1; c.spec(T, {tongueOut:.1 * e, tongueFlick:[(.4 + .45 * w) * e * u[0], (.4 + .45 * w) * e * u[1]], digastric:mid(.14 * e), nostril:mid(.3 * e * w), orbic:mid(.18 * e)}); c.jt('head', .03 * e); c.flushT = Math.max(c.flushT, .5 * e); raiseTongue(c, e, t, 3600); }});
M.action('flehmen', {label:'Flehmen · lip curl (ram)', group:'Mouth', dur:3800, gait:false, f:(t, T, c) => { const e = KS(t, [[0, 0], [650, 1], [2800, 1], [3700, 0]]) * RM(c), A = c.shiftAmt();
  c.jt('neck', -.42 * e * A); c.jt('head', -.2 * e); c.spec(T, {levLab:mid(1.25 * e), nasalis:.95 * e, nostril:mid(-.3 * e), digastric:mid(.3 * e), depLab:mid(.15 * e), orbic:mid(.4 * e), corrug:mid(.4 * e), earBack:mid(.3 * e), nasolab:mid(.4 * e)}); }});
M.action('chew', {label:'Chew the cud', group:'Mouth', dur:7200, in:['lie', 'stand', 'agnus'], f:(t, T, c) => {
  const ch = env(t, 600, 5400, 600), x = sinc(t, .0044), j = .5 + .5 * sinc(t, .0088, -1.6), sw = pulse(t, 300, 180, 30, 260) + pulse(t, 6600, 180, 30, 260);
  c.spec(T, {digastric:mid(.17 * ch * j), masseter:mid(.14 * ch * (1 - j)), chewR:pos(x) * 1.5 * ch, chewL:pos(-x) * 1.5 * ch, throat:.5 * sw, nostril:mid(.06 * ch), earBack:mid(.12 * ch * (.5 + .5 * sinc(t, .0066)))}); }});
// head
M.action('shakeHead', {label:'Shake the head', group:'Head', dur:1700, gait:true, f:(t, T, c) => { const e = env(t, 150, 800, 600), w = .03;
  c.Q.yaw += .11 * e * sinc(t, w); c.jd('head', .045 * e * sinc(t, w, 1.2)); c.jd('neck', .03 * e * sinc(t, w, .6)); c.jd('earR', .2 * e * sinc(t, w * 1.2)); c.jd('earL', -.2 * e * sinc(t, w * 1.2, .8)); c.jd('woolN', .1 * e * sinc(t, w, 2)); c.spec(T, {orbic:mid(.5 * e), earBack:mid(.3 * e)}); }});
M.action('toss', {label:'Toss the head', group:'Head', dur:2000, gait:true, f:(t, T, c) => { const a = KS(t, [[0, 0], [260, -1], [560, 1.2], [860, .15], [1400, 0]]), m = KS(t, [[0, 0], [560, 0], [700, 1.1], [1300, 0]]);
  c.jt('neck', -.2 * a); c.jt('head', -.2 * a); c.jd('woolN', .1 * m * sinc(t, .03)); c.spec(T, {earBack:mid(.5 * pos(a)), orbic:mid(.3 * pos(a)), throat:.25 * m}); }});
M.action('sniff', {label:'Sniff', group:'Head', dur:5200, in:['stand', 'lie', 'brace'], gait:false, f:(t, T, c) => { const lo = KS(t, [[0, 0], [700, 1], [3800, 1], [4800, 0]]), sn = lo * (.5 + .5 * sinc(t, .021)), A = c.shiftAmt();
  c.jt('neck', .3 * lo * A); c.jt('head', -.1 * lo * A); c.Q.yaw += .15 * sinc(t, .0016) * lo; c.spec(T, {nostril:mid(.7 * sn), nasalis:.35 * sn, nasolab:mid(.3 * sn), levPalp:mid(.15 * lo), earFwd:mid(.3 * lo), intercostals:.4 * sn}); }});
M.action('nuzzle', {label:'Nuzzle · suckle (lamb)', group:'Head', dur:4200, in:['stand'], f:(t, T, c) => { const e = KS(t, [[0, 0], [500, 1], [3500, 1], [4100, 0]]) * LM(c), b = .5 + .5 * sinc(t, .017, -1.4), A = c.shiftAmt();
  c.jt('neck', .22 * e * A - .09 * e * b * A); c.jt('head', -.16 * e * A + .1 * e * b); c.rootAbout(PIV, 0, 0, 2 * e * b);
  c.spec(T, {digastric:mid(.2 * e * b), masseter:mid(.15 * e * (1 - b)), nostril:mid(.25 * e), orbic:mid(.5 * e), earBack:mid(.3 * e)});
  for(let k = 0; k < 4; k++) c.jd('tail' + k, .16 * e * (.4 + .2 * k) * sinc(t - 60 * k, .019)); }});
// body
M.action('shake', {label:'Shake all over', group:'Body', dur:2400, big:true, in:['stand'], f:(t, T, c) => {
  const e = d => env(t - d, 150, 900, 700), ph = k => sinc(t, .03, -k), pre = KS(t, [[0, 0], [300, 1], [650, 0]]);
  c.rootAbout([450, 400], 0, 0, 10 * e(0) + 8 * pre); c.Q.yaw += .1 * e(0) * ph(0);
  c.jd('head', .06 * e(0) * ph(.4)); c.jd('neck', .06 * e(60) * ph(1)); c.jd('chest', .05 * e(140) * ph(2)); c.jd('pelvis', .06 * e(240) * ph(3));
  for(let k = 0; k < 4; k++) c.jd('tail' + k, .16 * e(300 + 40 * k) * ph(4 + k)); for(const [b, d, k] of [['woolN', 60, 1], ['woolC', 140, 2], ['woolB', 200, 3], ['woolR', 260, 4]]) c.jd(b, .3 * e(d) * ph(k));
  c.spec(T, {orbic:mid(.7 * e(0)), earBack:mid(.6 * e(30)), intercostals:.4 * e(100), rhomboid:.3 * e(60), woolA:.6 * e(100), woolB:.6 * e(160), woolC:.6 * e(220)});
  }});
M.action('wag', {label:'Wag the tail', group:'Body', dur:3000, gait:true, f:(t, T, c) => { const e = KS(t, [[0, 0], [400, 1], [2300, 1], [3000, 0]]), fr = lerp(.02, .0085, RM(c)), k0 = lerp(1, .55, RM(c));
  for(let k = 0; k < 4; k++) c.jd('tail' + k, .13 * k0 * e * (.4 + k * .2) * sinc(t - 60 * k, fr)); c.spec(T, {levCaudae:.25 * e * LM(c) + .1 * e, flexTip:.5 * e * (.5 + .5 * sinc(t, fr)), earBack:mid(.12 * e * LM(c))}); }});
M.action('swish', {label:'Swish the tail', group:'Body', dur:3000, gait:true, f:(t, T, c) => { const e = KS(t, [[0, 0], [500, 1], [2200, 1], [3000, 0]]);
  for(let k = 0; k < 4; k++) c.jd('tail' + k, .12 * e * (.4 + k * .17) * sinc(t - 150 * k, .0034)); c.spec(T, {levCaudae:.2 * e, flexTip:.5 * e * (.5 + .5 * sinc(t, .0034))}); }});
M.action('twitch', {label:'Twitch the skin', group:'Body', dur:1500, tiny:true, gait:true, f:(t, T, c, a) => {
  c.spec(T, {panniculusA:pulse(t, 0, 50, 30, 220) * 1.2, panniculusB:pulse(t, 110, 50, 30, 220) * 1.2, panniculusC:pulse(t, 220, 50, 30, 240) * 1.2});
  a.x = a.x ?? 300 + c.rand() * 280; for(const [k, t0, dx] of [[1, 0, 0], [2, 120, -70], [3, 240, -140]]) if(t >= t0 && !a['t' + k]){ a['t' + k] = 1; const p = c.wp('chest', [a.x + dx, 410]); c.burstAt(p[0], p[1], 46, K.mixInt(K.hexInt(K.ROSTER.bone), c.C.ink, .45)); } }});
M.action('stamp', {label:'Stamp a hoof', group:'Body', dur:1500, in:['stand', 'brace'], f:(t, T, c, a) => { const k = a.leg ?? (a.leg = c.rand() < .5 ? 2 : 0), e = KS(t, [[0, 0], [160, 1], [400, 1], [520, 0]]), f = c.foot(k);
  const lift = pulse(t, 100, 160, 90, 200) * 34, tap = pulse(t, 620, 60, 10, 90) * 22, tilt = (k === 0 ? .5 : .45) * (pulse(t, 100, 160, 90, 200) + .5 * pulse(t, 620, 60, 10, 90));
  c.legTo(k, f[0] - 4 * e, f[1] - lift - tap, f[2] + tilt * (k === 0 ? 1 : -1), 1, 1, {kk:16}); c.rootAbout(PIV, 0, 0, 3 * e * c.shiftAmt()); }});
// the lamb's play: a hop with a twist, and the startle
M.action('gambol', {label:'Gambol · hop (lamb)', group:'Play', dur:3600, in:['stand'], f:(t, T, c, a) => {
  const L = LM(c), hops = [[250, 1], [1250, .85], [2250, 1]], hh = hops.reduce((s, [t0, k]) => s + k * pulse(t, t0, 260, 0, 440), 0), tw = hops.reduce((s, [t0, k], i) => s + (i % 2 ? -1 : 1) * k * pulse(t, t0, 260, 0, 440), 0), h = 84 * hh * L;
  for(let k = 0; k < 4; k++){ const f = c.foot(k); c.legTo(k, f[0], f[1] - .85 * h, f[2] - .12 * (k < 2 ? 1 : -1) * hh * L, 1, 1, {kk:18}); }
  c.rootAbout(PIV, .035 * tw * L, 0, -h); c.Q.yaw += .14 * tw * L; c.jt('neck', -.1 * hh * L); c.jt('head', -.06 * hh * L); for(let k = 0; k < 4; k++) c.jd('tail' + k, .2 * hh * L * (.3 + k * .2) * sinc(t, .02));
  c.spec(T, {earUp:mid(.5 * hh * L), earFwd:mid(.3 * hh * L), orbic:mid(-.2 * hh * L), nostril:mid(.3 * hh * L)}); }});
M.action('startle', {label:'Startle (lamb)', group:'Play', dur:2000, tiny:false, f:(t, T, c) => { const L = LM(c) * .8 + .2, p = pulse(t, 0, 160, 0, 380), h = 56 * p * L, f2 = pulse(t, 0, 120, 700, 500);
  for(let k = 0; k < 4; k++){ const f = c.foot(k); c.legTo(k, f[0], f[1] - .85 * h, f[2], 1, 1, {kk:20}); }
  c.rootAbout(PIV, 0, 0, -h); c.jt('neck', -.12 * f2); c.jt('head', -.06 * f2); c.spec(T, {earFwd:mid(.8 * f2), earUp:mid(.6 * f2), levPalp:mid(.8 * f2), nostril:mid(.7 * f2), dilator:mid(.5 * f2), intercostals:.6 * f2}); }});
// the ram's display: paw, butt, clash. The butt is a nudge for the lamb and a charge for the ram.
M.action('paw', {label:'Paw the ground (ram)', group:'Display', dur:6600, big:true, in:['stand', 'brace'], f:(t, T, c, a) => {
  const R = RM(c), e = KS(t, [[0, 0], [500, 1], [6000, 1], [6500, 0]]), A = c.shiftAmt(), u = KS(t, [[0, 0], [700, 0], [1100, 1], [5500, 1], [6200, 0]]) * (.3 + .7 * R), cyc = clamp((t - 900) / 1150, 0, 4.4), p = cyc - Math.floor(cyc);
  const sw = clamp(p / .34), sc = clamp((p - .34) / .44), f = c.foot(0), dx = (cyc >= 4.4 || cyc <= 0) ? -34 : sw < 1 ? -34 + 68 * KS(sw, [[0, 0], [1, 1]]) : 34 - 68 * KS(sc, [[0, 0], [1, 1]]);
  const dy = (sw < 1 && cyc > 0 && cyc < 4.4) ? -48 * Math.sin(Math.PI * sw) : 0, db = (sw < 1 && cyc > 0 && cyc < 4.4) ? .75 * Math.sin(Math.PI * sw) : (sc < 1 ? -.12 : 0);
  c.legTo(0, f[0] + dx, f[1] + dy, f[2] + db, u, u, {kk:13});
  c.rootAbout(PIV, -.006 * e * A, -9 * e * A, 3 * e * A + 2 * Math.sin(p * Math.PI * 2) * u); c.jt('neck', .22 * e * A); c.jt('head', -.1 * e * A); c.Q.yaw += .1 * e; c.jt('chest', .02 * e);
  c.spec(T, {nostril:mid(.45 * e + .3 * pulse(t, 600, 80, 40, 300)), corrug:mid(.5 * e), earBack:mid(.3 * e), rhomboid:.4 * e, levCaudae:.2 * e, intercostals:.5 * e, hypaxial:.15 * e}); }});
M.action('butt', {label:'Butt', group:'Display', dur:2600, big:true, in:['stand', 'brace'], f:(t, T, c, a) => { const R = RM(c), d = a.dir ?? (a.dir = c.rand() < .5 ? -1 : 1), A = c.shiftAmt();
  const w = KS(t, [[0, 0], [520, -1], [900, 1.35], [1250, .3], [2200, 0]]), s = lerp(.38, 1, R), lunge = pos(KS(t, [[0, 0], [700, 0], [920, 1], [1300, .1], [2000, 0]])) * R;
  c.jt('neck', -.34 * w * A * s + .12 * pos(-w) * A * s); c.jt('head', -.24 * w * s); c.Q.yaw += d * .3 * w * s; c.rootAbout(PIV, -.02 * w * A * s + .03 * lunge, 22 * lunge * A, 8 * pos(-w) * A * s + 6 * lunge); c.jt('chest', -.04 * w * s);
  const m = pos(w) * s; c.spec(T, {nostril:mid(.6 * m), earBack:mid(.4 * m), corrug:mid(.6 * m * R), orbic:mid(.3 * m), throat:.3 * m, rhomboid:.5 * m, intercostals:.5 * m}); c.flushT = Math.max(c.flushT, .5 * m * R); }});
M.action('clash', {label:'Clash (ram)', group:'Display', dur:3400, big:true, in:['rear'], f:(t, T, c, a) => { const R = RM(c), A = 1;
  const wind = KS(t, [[0, 0], [650, 1], [900, 1], [1050, 0], [3400, 0]]), strike = pulse(t, 760, 320, 80, 700), rec = KS(t, [[0, 0], [1000, 0], [1160, 1], [1450, .3], [2400, 0]]) * R;
  c.rootAbout(PIV, -.06 * wind + .62 * strike * R, 16 * wind + 60 * strike * R, -22 * wind + 38 * strike * R); c.jt('neck', -.2 * wind + .5 * strike * R); c.jt('head', .1 * wind - .45 * strike * R); c.jt('chest', -.05 * wind + .08 * strike * R); c.Q.yaw += .14 * strike * R;
  for(const k of [0, 1]){ const f = c.foot(k), u = clamp(strike * 1.4); c.legTo(k, f[0] + 90 * u, f[1] + (735 - f[1]) * u, f[2] + (HAND0 - f[2]) * u, 1, 1, {kk:13}); }
  c.spec(T, {nostril:mid(.8 * (wind + strike)), corrug:mid(.8 * strike), orbic:mid(.7 * strike), earBack:mid(.3 * strike), rhomboid:.6 * strike, intercostals:.8 * strike + .5 * wind, flank:.3 * strike});
  c.jd('chest', .03 * rec * sinc(t, .05)); c.jd('woolN', .07 * rec * sinc(t, .04)); c.jd('woolC', .1 * rec * sinc(t, .045, 1)); c.flushT = Math.max(c.flushT, .8 * strike * R);
  if(t > 1060 && !a.b){ a.b = 1; const p = c.wp('head', hw([0, -90])); c.burstAt(p[0], p[1], 140, K.hexInt(K.ROSTER.gold), 'horns'); c.glyph(2400); } }});
// the change: the lamb loses its innocence (grow), and the rite that returns it (the sacrifice). g is moved by the action itself, on its own clock.
M.action('growUp', {label:'Lose innocence · grow the horns', group:'Growth', dur:17400, big:true, in:['stand'], f:(t, T, c, a) => {
  const g0 = a.g0 ?? (a.g0 = c.morphW('grow')), span = 10600 * Math.max(.25, 1 - g0), t1 = 2700, t2 = t1 + span, A = c.shiftAmt();
  const u = clamp((t - t1) / span), gv = lerp(g0, 1, fSmooth(0, 1, u)), grow = fSmooth(0, .08, u) * (1 - fSmooth(.92, 1, u)), pre = KS(t, [[0, 0], [700, 1], [2400, 1], [3000, 0]]);
  c.morphNow('grow', gv);
  c.jt('neck', -.07 * pre * A); c.spec(T, {earFwd:mid(.7 * pre), earUp:mid(.5 * pre), levPalp:mid(.5 * pre), nostril:mid(.3 * pre), intercostals:.3 * pre});
  const pulses = grow * (.5 + .5 * sinc(t, .0021)), bump = grow * pos(sinc(t, .0034, 1)); c.Q.yaw += .1 * grow * sinc(t, .0026); c.jd('head', .05 * bump * sinc(t, .021)); c.jd('neck', .03 * bump * sinc(t, .021, 1)); c.jd('earR', .25 * bump * sinc(t, .023)); c.jd('earL', -.25 * bump * sinc(t, .023, 1));
  c.jt('chest', .02 * grow); c.rootAbout(PIV, 0, 0, 2 * pulses); c.jt('neck', -.05 * u * A);
  c.spec(T, {intercostals:.6 * grow, flank:.4 * grow, corrug:mid(.5 * grow), orbic:mid(.25 * pulses), nostril:mid(.3 * grow), frontalis:mid(.4 * grow), woolA:.5 * grow, woolB:.5 * grow, woolC:.5 * grow});
  c.flushT = Math.max(c.flushT, .85 * grow); if(u > .97 && !a.gl){ a.gl = 1; c.glyph(3400); }
  const post = t - t2;   // the first sounds of the ram: a deep bleat, a snort, the first stamp
  if(post > 0){ const e = env(post, 300, 1500, 700), v = .03 * sinc(post, .03) * env(post, 500, 1200, 150);
    c.jt('neck', -.2 * e * A); c.jt('head', -.14 * e); c.spec(T, {digastric:mid(.9 * e + v), depLab:mid(.4 * e), nostril:mid(.8 * e), throat:.5 * e + .2 * e * sinc(post, .03), intercostals:1.1 * e, earBack:mid(.3 * e), tongueOut:.2 * e});
    const f = c.foot(0), s = pulse(post, 2300, 160, 60, 260), tp = pulse(post, 2650, 60, 10, 90); c.legTo(0, f[0], f[1] - 34 * s - 22 * tp, f[2] + .5 * (s + .5 * tp), 1, 1, {kk:16}); const p3 = pulse(post, 3200, 80, 30, 280); c.spec(T, {nostril:mid(1 * p3), flank:.7 * p3}); } }});
M.action('sacrifice', {label:'The sacrifice · return to the lamb', group:'Growth', dur:14800, big:true, in:['agnus'], f:(t, T, c, a) => {
  const g0 = a.g0 ?? (a.g0 = c.morphW('grow')), t1 = 3600, span = 7000, u = clamp((t - t1) / span), gv = lerp(g0, 0, fSmooth(0, 1, u)), still = KS(t, [[0, 0], [900, 1], [t1 + span, 1], [12000, 0]]), grow = fSmooth(0, .1, u) * (1 - fSmooth(.9, 1, u));
  c.morphNow('grow', gv);
  c.spec(T, {orbic:mid(.55 * still), levPalp:mid(-.3 * still), intercostals:.45 * still + .15 * grow, flank:.3 * still, earBack:mid(.25 * still), dilator:mid(-.3 * still)});
  c.flushT = Math.max(c.flushT, .9 * grow); if(t > 3200 && !a.gl){ a.gl = 1; c.glyph(3600); }
  const ex = KS(t, [[0, 0], [t1 + span + 500, 0], [t1 + span + 2000, 1], [t1 + span + 3600, 0]]); c.spec(T, {nostril:mid(.3 * ex), earFwd:mid(.4 * ex), levPalp:mid(.3 * ex)}); }});

/* ---------- pads ---------- */
const ga = (c, id, s = 0) => c.act(id, s);
M.pad('jaw', {label:'Jaw', group:'Head', x:['to the left', 'to the right'], y:['shut', 'open'], map:(x, y) => ({digastric:pos(y), depLab:.5 * pos(y), masseter:.7 * pos(-y), temporalis:.5 * pos(-y), chewR:pos(x), chewL:pos(-x)}), ghost:c => [cl(ga(c, 'chewR') - ga(c, 'chewL')), cl(ga(c, 'digastric') - ga(c, 'masseter'))]});
M.pad('muzzle', {label:'Muzzle · nostrils', group:'Head', split:'LR', x:['pads', 'flare'], y:['lower', 'curl'], map:(x, y) => ({nasolab:pos(-x), nostril:pos(x), levLab:pos(y), depLab:.7 * pos(-y), nasalis:.5 * pos(y)}), ghost:(c, s) => [cl(ga(c, 'nostril', s) - ga(c, 'nasolab', s)), cl(ga(c, 'levLab', s) - ga(c, 'depLab', s))]});
M.pad('eyes', {label:'Eyes · brow', group:'Head', split:'LR', x:['squint', 'wide'], y:['knit', 'raise'], map:(x, y) => ({orbic:pos(-x), levPalp:pos(x), corrug:pos(-y), frontalis:pos(y)}), ghost:(c, s) => [cl(ga(c, 'levPalp', s) - ga(c, 'orbic', s)), cl(ga(c, 'frontalis', s) - ga(c, 'corrug', s))]});
M.pad('gaze', {label:'Gaze', group:'Head', x:['left', 'right'], y:['down', 'up'], map:(x, y) => ({lookR:pos(x), lookL:pos(-x), lookU:pos(y), lookD:pos(-y)}), ghost:c => [cl(ga(c, 'lookR') - ga(c, 'lookL')), cl(ga(c, 'lookU') - ga(c, 'lookD'))]});
M.pad('ears', {label:'Ears', group:'Head', split:'LR', x:['back', 'forward'], y:['droop', 'perk'], map:(x, y) => ({earBack:pos(-x) + .5 * pos(-y), earUp:pos(y), earFwd:pos(x)}), ghost:(c, s) => [cl(ga(c, 'earFwd', s) - ga(c, 'earBack', s)), cl(ga(c, 'earUp', s) - .5 * ga(c, 'earBack', s))]});
M.pad('head', {label:'Head', group:'Head', x:['turn left', 'turn right'], y:['lowered', 'raised'], map:(x, y) => ({splenius:[pos(-x), pos(x)]}), fx:(c, x, y) => { c.jt('neck', -.5 * y); c.jt('head', -.18 * y); }, ghost:c => [cl(ga(c, 'splenius', 1) - ga(c, 'splenius', 0)), cl(-c.jr[c.d.BI.neck] / .5)]});
M.pad('hook', {label:'Butt · toss', group:'Head', x:['sweep left', 'sweep right'], y:['dip', 'toss'], fx:(c, x, y) => { c.Q.yaw += .45 * x; c.jt('neck', -.4 * pos(y) + .3 * pos(-y)); c.jt('head', -.3 * pos(y) + .15 * pos(-y)); c.jt('chest', -.04 * y); }, ghost:c => [cl(c.yaw / .45), cl(-c.jr[c.d.BI.head] / .3)]});
M.pad('neck', {label:'Neck · withers', group:'Body', x:['curl', 'extend'], y:['relaxed', 'bunched'], map:(x, y) => ({neckDown:pos(-x), neckUp:pos(x), rhomboid:pos(y), throat:.3 * pos(y)}), ghost:c => [cl(ga(c, 'neckUp') - ga(c, 'neckDown')), cl(ga(c, 'rhomboid'))]});
M.pad('spine', {label:'Spine', group:'Body', x:['sway', 'arch'], y:['crouch', 'rise'], map:x => ({epaxial:pos(x), hypaxial:pos(-x)}), fx:(c, x, y) => { c.Q.ry += 20 * pos(-y) - 3 * pos(y); c.jt('chest', -.05 * y); }, ghost:c => [cl(ga(c, 'epaxial') - ga(c, 'hypaxial')), cl(-c.root.y / 30)]});
M.pad('breath', {label:'Breath', group:'Body', x:['shallow', 'deep'], y:['slow', 'fast'], fx:(c, x, y) => { c.breath.depth = 2 ** (x * 1.4); c.breath.rate = 2 ** (y * 1.2); }, alwaysFx:false, ghost:c => [cl(Math.log2(c.breath.depth) / 1.4), cl(Math.log2(c.breath.rate) / 1.2)]});
M.pad('fleece', {label:'Fleece', group:'Body', x:['tight', 'heavy'], y:['smooth', 'ruffled'], fx:(c, x, y) => { c.fleeceX = x; const s = pos(y); c.spec(c.Ta, {woolA:.8 * s * (.5 + .5 * sinc(c.t, .006)), woolB:.8 * s * (.5 + .5 * sinc(c.t, .006, 1.4)), woolC:.8 * s * (.5 + .5 * sinc(c.t, .006, 2.8))}); c.jd('woolB', .22 * s * sinc(c.t, .0042)); c.jd('woolC', .22 * s * sinc(c.t, .0042, 1)); c.jd('woolN', .22 * s * sinc(c.t, .0042, 2)); }, alwaysFx:true, ghost:c => [cl(c.fleeceNow ?? 0), cl(ga(c, 'woolB'))]});
M.pad('foreleg', {label:'Foreleg', group:'Limbs', split:'NF', leg:'fore', x:['back', 'reach'], y:['flex', 'extend'], map:(x, y) => ({deltoid:pos(x), latissimus:pos(-x), supraspinatus:.4 * pos(x), pectoral:.4 * pos(-x), brachialis:pos(-y), flexCarpi:.7 * pos(-y), hoofFlexF:.5 * pos(-y), hoofExtF:.4 * pos(y), triceps:pos(y), extCarpi:.5 * pos(y)})});
M.pad('hindleg', {label:'Hindleg', group:'Limbs', split:'NF', leg:'hind', x:['drive', 'swing'], y:['flex', 'extend'], map:(x, y) => ({glutes:pos(-x), gastroc:.5 * pos(-x) + .4 * pos(y), hipFlex:pos(x), tfl:.5 * pos(x), hamstrings:pos(-y), tibialis:.7 * pos(-y), hoofFlexH:.5 * pos(-y), hoofExtH:.4 * pos(y), quads:pos(y)})});
M.pad('tail', {label:'Tail', group:'Limbs', x:['hold in', 'swing out'], y:['straight', 'curl'], map:(x, y) => ({depCaudae:pos(-x), levCaudae:pos(x), flexMid:.6 * pos(y), flexTip:y}), ghost:c => [cl(ga(c, 'levCaudae') - ga(c, 'depCaudae')), cl(ga(c, 'flexTip'))]});
/* the growth pad: x is the one weight from the lamb (left) to the ram (right); y is the horns' curl, open at the bottom and tight at the top. Resting at the centre it leaves the creature's own state alone. */
M.pad('growth', {label:'Growth · horn curl', group:'Growth', x:['lamb', 'ram'], y:['open curl', 'tight curl'], alwaysFx:true, fx:(c, x, y) => { c.curlPad = y; if(Math.abs(x) + Math.abs(y) > .03 && !c.actions.some(a => !a.cut && (a.name === 'growUp' || a.name === 'sacrifice'))) c.setMorph('grow', clamp((x + 1) / 2), 2.2); }, ghost:c => [cl(2 * c.morphW('grow') - 1), cl(c.curlNow ?? 0)]});

/* ---------- the driver: the one growth weight g sets every morph ---------- */
const WEIGHTS = (g, c) => { const f = clamp(fSmooth(.2, 1, g) + (c.fleeceX || 0) * .5), cu = c.curlPad || 0, h5 = clamp(g * 5 - 4);
  return {hornG1:clamp(g * 5), hornG2:clamp(g * 5 - 1), hornG3:clamp(g * 5 - 2), hornG4:clamp(g * 5 - 3), hornG5:h5, headM:fSmooth(.08, .85, g), lambM:1 - fSmooth(.0, .5, g), lambBody:1 - fSmooth(.0, .7, g), neckM:fSmooth(.25, .95, g), bodyM:fSmooth(.3, 1, g), fleece:f, hornOpen:pos(-cu) * h5, hornTight:pos(cu) * h5}; };
function drive(c){
  const g = c.morphW('grow'), W = WEIGHTS(g, c), I = c.d.MORPHI; c.fleeceNow = W.fleece * 2 - 1 - 2 * fSmooth(.2, 1, g) + 0; c.curlNow = (W.hornTight - W.hornOpen);
  for(const n in W){ const i = I[n]; if(Math.abs(c.morph[i] - W[n]) > 2e-4) c.morphNow(n, W[n]); }
}

/* ---------- hooks: idle, what each posture holds, the gaits' body, the glyph's path, life ---------- */
const GLYPH = {hornL:[.02, .28, true], hornR:[.38, .3]};
const RAMONLY = new Set(['clash', 'flehmen', 'paw', 'charge', 'go:rear']), LAMBONLY = new Set(['gambol', 'nuzzle', 'startle', 'pronk']);
K.define(M.finish({
  /* the anatomy audit reads these as deliberate: the wool puffs are a body overlay that lies over the shoulder, the neck and the tail's root and stays with the trunk; the far eye's parts lie by the far ear's root */
  audit:{allow:{deadParts:['^puff(Body|Shoulder|Haunch|Neck)\\d*$', '^(eye|pupil|lidU|lidL)[RL]$']}},
  strideMax:230,
  ripple:{tag:'fleece', centre:[450, 420]},
  idle(c, now, Ti){
    drive(c);
    const R = RM(c), L = LM(c), br = .5 + .5 * Math.sin(now * .00125 * c.breath.rate * (1 + .4 * L) + 1), d = c.breath.depth;
    c.spec(Ti, {intercostals:(.12 + .38 * br) * d, flank:(.1 + .32 * br) * d, nostril:mid(.04 + .1 * br * d), epaxial:.05 * Math.sin(now * .0007), levCaudae:.07 + .07 * Math.sin(now * .0006) + .12 * L * pos(Math.sin(now * .0023)), flexTip:.1 + .1 * Math.sin(now * .0011 + 1), earBack:[.06 + .05 * Math.sin(now * .0008), .06 + .05 * Math.sin(now * .0009 + 1.3)],
      lookR:mid(pos(Math.sin(now * .00057)) * .5), lookL:mid(pos(-Math.sin(now * .00057)) * .5), earFwd:mid(.06 + .05 * Math.sin(now * .0005 + 2) + .14 * L), woolB:.1 + .1 * br});
    c.jt('neck', .05 * L - .06 * R); c.jt('head', -.02 * L + .02 * R);   // the lamb carries its head lower and softer, the ram high and squared
    if(c.every('blink', [2400, 6200], now)) c.actions.push({name:'blink', t0:now});
    if(c.every('ear', [3400 - 1200 * L, 8000 - 3000 * L], now)) c.actions.push({name:'ear', t0:now});
    if(c.every('twitch', [9000, 20000], now) && !c.gs.on) c.actions.push({name:'twitch', t0:now});
  },
  postureHold(c, w, Ta){
    const rest = w.lie + .5 * w.kneel + w.agnus;
    c.spec(Ta, {intercostals:.34 * rest + .3 * w.brace + .9 * w.rear, flank:.12 * rest + .2 * w.brace, nostril:mid(.38 * w.brace + .25 * w.rear), corrug:mid(.4 * w.brace + .3 * w.rear), earBack:mid(.22 * w.brace + .12 * w.rear + .12 * rest), earFwd:mid(.2 * w.kneel), rhomboid:.6 * w.brace + .25 * w.rear,
      splenius:[0, .85 * w.brace + .5 * w.agnus], levCaudae:.25 * w.brace + .3 * w.rear, depCaudae:.3 * rest, flexTip:.15 * rest, orbic:mid(.25 * rest + .2 * w.agnus), neckUp:.2 * w.rear, hypaxial:.1 * rest + .2 * w.brace, epaxial:.3 * w.rear + .1 * w.brace,
      throat:.15 * w.brace, dilator:mid(.3 * w.brace), levPalp:mid(.2 * w.brace)});
  },
  gaitBody(c, G, k, ph, mk){
    { const fl = [0, 0, 0, 0], ex = [0, 0, 0, 0];   // the feet through a step: the hoof closes as the foot lifts and opens to land
      for(let j = 0; j < 4; j++){ const L = c.gs.legs[j]; if(!L || L.stance) continue; const p = clamp(L.p); fl[j] = .75 * fSmooth(0, .25, p) * (1 - fSmooth(.45, .8, p)); ex[j] = .6 * fSmooth(.6, .95, p); }
      c.spec(c.Ta, {hoofFlexF:[fl[0] * k, fl[1] * k], hoofFlexH:[fl[2] * k, fl[3] * k], hoofExtF:[ex[0] * k, ex[1] * k], hoofExtH:[ex[2] * k, ex[3] * k]}); }
    const w2 = 4 * Math.PI * ph, ch = G.name === 'charge' ? 1.7 : G.name === 'trot' ? 1.15 : G.name === 'pronk' ? 1.3 : 1, a = 2 * Math.PI * ph;
    c.jt('neck', .05 * k * mk * ch * Math.sin(w2 + 2.4)); c.jt('head', -.03 * k * mk * ch * Math.sin(w2 + 2.4)); c.jt('chest', (.045 * Math.sin(a + .2) + .02 * Math.sin(w2)) * k * mk * ch); c.jt('pelvis', (-.045 * Math.sin(a + 2.9) - .02 * Math.sin(w2 + 1.2)) * k * mk * ch);
    c.jd('body', .012 * k * mk * ch * Math.sin(a + 1.4));
    { const wP = clamp(1 - Math.abs((c.gait ? c.gait.psi : 1) - .4) / .6); if(wP > 0){ let sw = 0; for(const L of c.gs.legs) if(!L.stance) sw += Math.sin(Math.PI * clamp(L.p)) / c.gs.legs.length; c.Q.ry -= 52 * wP * k * Math.sqrt(mk) * sw; c.jt('neck', -.1 * wP * k * sw); c.jt('chest', -.03 * wP * k * sw); } }
    c.spec(c.Ta, {levCaudae:(.1 + .12 * (ch - 1)) * k * (1 + Math.sin(w2 + 1)) * (1 + LM(c)), rhomboid:.25 * k * ch, intercostals:.22 * k * ch, flank:.2 * k * ch, nostril:mid((.1 + .35 * (ch - 1)) * k), earBack:mid(.2 * (ch - 1) * k)});
  },
  glyph:(x, y, P, i) => {
    const li = i - P.p0;
    if(P.name === 'hornInlayL' || P.name === 'hornL'){ const cols = P.name === 'hornL' ? 2 : 1, t = clamp(Math.floor(li / cols) / (HORN_ROWS - 1)); return [.02 + .28 * (1 - t), P.name === 'hornL' ? .5 : 1]; }
    if(P.name === 'hornInlayR' || P.name === 'hornR'){ const cols = P.name === 'hornR' ? 2 : 1, t = clamp(Math.floor(li / cols) / (HORN_ROWS - 1)); return [.38 + .3 * t, P.name === 'hornR' ? .5 : 1]; }
    if(P.name === 'browInlay') return [.3 + .08 * clamp(((x - HC[0]) / HS + 40) / 80), 1];
    if(P.name === 'stemInlay') return [.72 + .28 * clamp(((y - HC[1]) / HS + 78) / 132), 1];
    return null;
  },
  lifePick(c, pick, now){
    const g = c.morphW('grow'), ram = g > .6, lamb = g < .4;
    if((RAMONLY.has(pick) && !ram) || (LAMBONLY.has(pick) && !lamb)) return true;
    if(pick === 'sacrifice' && g < .9) return true; if(pick === 'growUp' && g > .1) return true; if(pick === 'go:agnus' && g > .1) return true;
    return false;
  },
  shiftOf:{lie:.95, kneel:.9, rear:.9, brace:.45, agnus:.95},
  life:{rate:1.6,
    small:[['glance', 3, 5000], ['ear', 3.5, 3000], ['slowblink', 1.6, 9000], ['swish', 1.6, 7000], ['wag', 1.8, 7000], ['twitch', 2.2, 5000], ['sigh', 2, 9000], ['snort', 1.2, 9000], ['nod', .8, 12000], ['shakeHead', .9, 14000], ['toss', .7, 16000],
      ['lickNose', 1, 14000], ['listen', 1.3, 12000], ['bleat', 1.2, 16000, ['stand', 'brace', 'lie', 'agnus']], ['glyph', 1.2, 14000], ['flehmen', .6, 40000, ['stand', 'lie']], ['chew', 2.4, 20000, ['lie', 'agnus'], {lie:3.5, agnus:3.5}], ['chew', .7, 40000, ['stand']],
      ['sniff', .5, 30000, ['stand']], ['stamp', .8, 12000, ['stand', 'brace']], ['shake', .3, 60000, ['stand']], ['nuzzle', 1.6, 18000, ['stand']], ['gambol', 1.4, 14000, ['stand']], ['startle', .7, 30000, ['stand', 'brace']],
      ['paw', 1.6, 22000, ['brace']], ['butt', 1.2, 18000, ['brace']], ['butt', .3, 40000, ['stand']], ['clash', 2, 12000, ['rear']], ['growUp', 1.5, 60000, ['stand']], ['sacrifice', .35, 90000, ['lie', 'agnus', 'stand']], ['snort', 2.2, 7000, ['brace'], {brace:2.2}]],
    moves:[['go:lie', .6, 36000, ['stand']], ['go:stand', 1.4, 0, ['lie', 'kneel', 'rear', 'agnus']], ['go:agnus', .5, 50000, ['lie']], ['go:brace', .9, 30000, ['stand']], ['charge', .9, 28000, ['brace']], ['pronk', 1.4, 20000, ['stand']], ['go:stand', .7, 0, ['brace']], ['walk', .6, 22000, ['stand']], ['trot', .3, 50000, ['stand']], ['go:rear', .6, 70000, ['brace']], ['go:stand', 1, 0, ['kneel']]],
    dwell:{stand:[4000, 9000], lie:[12000, 26000], kneel:[600, 1200], brace:[5000, 9000], rear:[2600, 4600], agnus:[10000, 20000]},
    gait:[['glance', 3, 5000], ['ear', 3.5, 3000], ['swish', 2, 6000], ['wag', 1.6, 6000], ['snort', 1.4, 8000], ['shakeHead', .6, 14000], ['twitch', 2, 5000], ['toss', .6, 16000]], gaitFor:{walk:[3500, 7500], trot:[3000, 5500], charge:[2800, 4600], pronk:[2800, 5200]}},
}));
})();
