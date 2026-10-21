/* creature-horse.js — the HORSE, on creature-kit.js. Read CREATURE-SPEC.md and CREATURE-NOTES-HORSE.md (the research note first).
   A horse in profile, facing right: an arched neck with a mane in locks, a forelock, a long head with a large eye, mobile ears and nostrils, a deep chest, powerful
   quarters, slender legs with clean joints (knee, fetlock, pastern, hoof) and a tail that is a chain. It has no zodiac sign. Its emblem is built into the anatomy:
   the VITAL FORCE runs as gold along the crest of the mane, down the line of the spine and out along the tail (the dorsal stripe the primitive horse carries),
   and the travelling light runs it from the poll to the tip of the tail. Ink: Bone. Accent: Lapis, for the eye. Everything else is additive and transient.

   THE UNICORN IS BUILT ON THIS FILE. The whole figure is one function, build(opts), and the parts that differ are separate: the hooves (opts.hoof: 'solid' or
   'cloven'), the tail (opts.tail: 'horse' or 'lion'), the forelock, the head, and attachment bones the unicorn hangs its horn and beard on ('horn', 'beardA',
   'beardB'). opts.extras(ctx) adds parts, muscles, actions and pads after everything else; opts.tune({M, hooks, ctx}) edits the hooks before they are finished.
   window.CreatureHorse = {build, geometry} exposes it. CREATURE-NOTES-HORSE.md, "How the unicorn derives", says how. */
(() => {
'use strict';
const K = window.CreatureKit;
const {chaikin, ringPts, clamp, fSmooth, env, pulse, keys, ramp, hash, gauss, catmull} = K, pos = v => Math.max(0, v), cl = v => Math.max(-1, Math.min(1, v));

function build(o = {}){
const M = K.model({id:o.id || 'horse', name:o.name || 'Horse', sign:o.sign ?? '', title:o.title || 'HORSE', sub:o.sub || 'the vital force that carries the hero · endurance, freedom, instinct',
  w:1000, h:780, groundY:740, pivot:[272, 398], axis:790, yawC:790, ink:o.ink || K.ROSTER.bone, accent:o.accent || K.ROSTER.lapis, far:{foreleg:[34, -4], hindleg:[38, -4], ears:[-13, -3]}, cam:[1.05, 512, 430]});

/* ---------- the head's frame: canvas units; origin the poll joint, u along the head toward the muzzle, v across it toward the throat (v < 0 is the face's front) ---------- */
const HJ = [790, 184], HR = 1.18, HS = .92, EU = [Math.cos(HR), Math.sin(HR)], EV = [-Math.sin(HR), Math.cos(HR)];
const H = (u, v) => [HJ[0] + HS * (u * EU[0] + v * EV[0]), HJ[1] + HS * (u * EU[1] + v * EV[1])];
const hv = (u, v) => [HS * (u * EU[0] + v * EV[0]), HS * (u * EU[1] + v * EV[1])];     // a vector in the head's frame, in canvas units
const HP = pts => pts.map(([u, v]) => H(u, v));
const HE = (u, v, ru, rv, rot = 0, n = 10) => Array.from({length:n}, (_, i) => { const a = i * 2 * Math.PI / n, x = Math.cos(a) * ru, y = Math.sin(a) * rv; return [u + x * Math.cos(rot) - y * Math.sin(rot), v + x * Math.sin(rot) + y * Math.cos(rot)]; });
const zc = k => () => k;
const polyAt = (P, d) => { let acc = 0; for(let i = 0; i < P.length - 1; i++){ const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); if(acc + l >= d || i === P.length - 2){ const u = clamp((d - acc) / (l || 1)); return {p:[P[i][0] + (P[i + 1][0] - P[i][0]) * u, P[i][1] + (P[i + 1][1] - P[i][1]) * u], t:[(P[i + 1][0] - P[i][0]) / (l || 1), (P[i + 1][1] - P[i][1]) / (l || 1)]}; } acc += l; } };
const polyLen = P => { let s = 0; for(let i = 0; i < P.length - 1; i++) s += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); return s; };
const spline = (P, per = 8) => catmull(P, per);

/* ---------- skeleton ---------- */
M.bone('body', null, [430, 398], [431, 398], {grp:'root'});
M.bone('pelvis', 'body', [430, 398], [226, 384], {grp:'rear', lim:[-.42, .42], speed:5.5});
M.bone('chest', 'body', [430, 398], [640, 384], {grp:'front', lim:[-.46, .46], speed:6});
/* the neck is a chain of five bones from the withers to the poll: it arches and lowers as one curve, and a head movement can start at its root and run out along it */
const NC = [[644, 344], [660, 294], [692, 242], [740, 204], [790, 184]];
const NECK = M.chain('neck', NC, 5, {parent:'chest', grp:'head', lim:[-.55, .65], sec:true, mot:true, speed:7.5});
M.bone('head', 'neck4', HJ, H(192, 0), {grp:'head', lim:[-1.85, .9], sec:true, mot:true, speed:9.5});
M.bone('jaw', 'head', H(26, 20), H(184, 14), {grp:'head', lim:[-.06, .42], sec:true, speed:14});
M.bone('earN', 'head', H(4, -32), H(-34, -92), {grp:'head', lim:[-1.7, 1.5], sec:true, speed:14});
M.bone('earF', 'head', H(4, -32), H(-34, -92), {grp:'head', lim:[-1.7, 1.5], sec:true, speed:14});
M.bone('forelockB', 'head', H(10, -40), H(76, -38), {grp:'head', lim:[-.9, .9], sec:true, speed:6, anat:false});
/* the mane rides on a bone per neck bone, so it lags the neck and streams out behind it */
const NCL = polyLen(NC), MANEB = NECK.map((nm, i) => { const a = polyAt(NC, NCL * (i + .5) / 5), tx = a.t[0], ty = a.t[1], nx = ty, ny = -tx, mx = a.p[0], my = a.p[1];
  const p = [mx + nx * (50 - i * 5), my + ny * (50 - i * 5)]; M.bone('mane' + i, nm, p, [p[0] - tx * 12 - nx * 6, p[1] - ty * 12 - ny * 6 + 78], {grp:'head', lim:[-1.1, 1.1], sec:true, speed:5, anat:false}); return 'mane' + i; });
/* the tail is a chain from the dock out to the end of the hair; the tip bone follows through */
const TC = [[214, 304], [194, 326], [176, 366], [164, 422], [160, 484], [164, 548], [172, 612]];
const TAILB = M.chain('tail', TC, 6, {parent:'pelvis', grp:'tail', lim:[-1.2, 1.2], sec:true, speed:3, wind:true});
M.bone('tailTip', 'tail5', TC[6], [TC[6][0] + 4, TC[6][1] + 40], {grp:'tail', lim:[-1.2, 1.2], sec:true, speed:6, anat:false});
/* attachment bones for the unicorn: a horn on the forehead, a beard under the chin. Nothing is bound to them in the horse. */
M.bone('horn', 'head', H(26, -40), H(100, -110), {grp:'head', lim:[-.2, .2], sec:true, speed:9, anat:false});
M.bone('beardA', 'jaw', H(150, 26), H(150, 66), {grp:'head', lim:[-.8, .8], sec:true, speed:6, anat:false});
M.bone('beardB', 'beardA', H(150, 66), H(150, 102), {grp:'head', lim:[-.8, .8], sec:true, speed:6, anat:false});
M.follower('tailTip', {k:3.2, w:11, z:.5, gain:.7});
for(const m of MANEB) M.follower(m, {k:3.3, w:9, z:.42, gain:.9, lim:.5, flutter:.03});
M.follower('forelockB', {k:3.6, w:10, z:.45, gain:.9, lim:.5, flutter:.03});
M.follower('beardB', {k:3.2, w:9, z:.4, gain:.8, lim:.5});
/* the legs: scapula, humerus, radius, then a foot bone from the carpus to the ground (the IK's), with the pastern and the hoof as child bones that turn at the fetlock and the coronet */
const FAR = {fore:[34, -4], hind:[38, -4]};
const J = {scap:[[604, 298], [660, 422]], hum:[[660, 422], [588, 494]], rad:[[588, 494], [604, 610]], hand:[[604, 610], [632, 735]], pastF:[[608, 692], [626, 722]], hoofF:[[626, 722], [646, 738]],
  fem:[[272, 400], [344, 486]], tib:[[344, 486], [250, 606]], foot:[[250, 606], [286, 735]], pastH:[[262, 692], [280, 722]], hoofH:[[280, 722], [300, 738]]};
for(const s of ['N', 'F']){
  const f = s === 'F' ? FAR.fore : [0, 0], h = s === 'F' ? FAR.hind : [0, 0], mv = ([a, b], q) => [[a[0] + q[0], a[1] + q[1]], [b[0] + q[0], b[1] + q[1]]];
  const sc = mv(J.scap, f), hu = mv(J.hum, f), ra = mv(J.rad, f), ha = mv(J.hand, f), pf = mv(J.pastF, f), hf = mv(J.hoofF, f), fe = mv(J.fem, h), ti = mv(J.tib, h), fo = mv(J.foot, h), ph = mv(J.pastH, h), hh = mv(J.hoofH, h);
  M.bone('scap' + s, 'chest', sc[0], sc[1], {grp:'front', lim:[-.5, .5], speed:10});
  M.bone('hum' + s, 'scap' + s, hu[0], hu[1], {grp:'front', lim:[-1.4, 1.7]}); M.bone('rad' + s, 'hum' + s, ra[0], ra[1], {grp:'front', lim:[-2.95, .95]}); M.bone('hand' + s, 'rad' + s, ha[0], ha[1], {grp:'front', lim:[-2.1, 3.2]});
  M.bone('pastF' + s, 'hand' + s, pf[0], pf[1], {grp:'front', lim:[-1.9, 1.5], speed:11}); M.bone('hoofF' + s, 'pastF' + s, hf[0], hf[1], {grp:'front', lim:[-1.5, 1.5], speed:11});
  M.bone('fem' + s, 'pelvis', fe[0], fe[1], {grp:'rear', lim:[-2.6, 1.5]}); M.bone('tib' + s, 'fem' + s, ti[0], ti[1], {grp:'rear', lim:[-1.05, 2.5]}); M.bone('foot' + s, 'tib' + s, fo[0], fo[1], {grp:'rear', lim:[-2.2, 3.2]});
  M.bone('pastH' + s, 'foot' + s, ph[0], ph[1], {grp:'rear', lim:[-1.9, 1.5], speed:11}); M.bone('hoofH' + s, 'pastH' + s, hh[0], hh[1], {grp:'rear', lim:[-1.5, 1.5], speed:11});
}
/* the legs on IK, in the order the gaits list them: fore near, fore far, hind near, hind far */
const FMUS = [['deltoid', 'latissimus', -.42, .38], ['brachialis', 'triceps', -.7, .5], ['extCarpi', 'flexCarpi', -.4, .55]], HMUS = [['hipFlex', 'glutes', -.42, .36], ['quads', 'hamstrings', -.5, .45], ['tibialis', 'gastroc', -.45, .55]];
M.leg({bones:['humN', 'radN', 'handN'], bend:1, kind:'fore', side:'N', roll:.7, reach:30, mus:FMUS});
M.leg({bones:['humF', 'radF', 'handF'], bend:1, kind:'fore', side:'F', roll:.7, reach:30, mus:FMUS});
M.leg({bones:['femN', 'tibN', 'footN'], bend:-1, kind:'hind', side:'N', roll:1, reach:30, mus:HMUS});
M.leg({bones:['femF', 'tibF', 'footF'], bend:-1, kind:'hind', side:'F', roll:1, reach:30, mus:HMUS});

/* ---------- the figure ----------
   Layers: far legs 1; tail 3; torso, ribs, the back's inlay 4; near legs 5; joint patches 5.5; shoulder and haunch 6; neck 7; the mane 7.5; far ear 7.9; the head's cells 9; the mouth's
   inside 10; jaw 10.8; muzzle 11; eye and lids 12-14; near ear 11.5; the forelock 12.5; the glyph's crest 7.8. The silhouette is drawn under layer 2 and up. */
/* the neck: stations [x, y, under, crest] along the chain's centreline */
const NS = [[644, 344, 66, 58], [660, 294, 54, 46], [692, 242, 44, 36], [740, 204, 34, 28], [790, 184, 28, 22]];
const NECKB = {chain:[...NECK, 'head'], sigma:26};
M.limb('neck', NS, {layer:5.9, tier:'M', h:26, bind:{chain:NECK, sigma:28}, tags:['neck'], line:'region', cols:3});
/* the crest line, from the withers to the poll, the line the mane grows along and the gold runs on */
const CREST = spline(NS.map(([x, y, u, c], i) => { const a = NS[Math.max(0, i - 1)], b = NS[Math.min(NS.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty); return [x + ty / l * c, y - tx / l * c]; }), 8);
const CRL = polyLen(CREST);
const insetP = (P, k) => P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; return [p[0] - ty / l * k, p[1] + tx / l * k]; });
M.line('nuchal', insetP(CREST.slice(0, -2), 9), {layer:5.95, tags:['neck'], bind:{chain:NECK, sigma:28}, host:['neck'], line:{k:.4, c:.55, r:'f', t:'bone', tk:.2}, noSil:true});
/* the torso: four large cells (shoulder and chest, ribs, loin, croup) whose outline is one smooth curve; high withers, a deep chest, a level back, a round croup */
const TP = {t0:[640, 302], t1:[596, 288], t2:[548, 294], t3:[500, 310], t4:[448, 320], t5:[398, 314], t6:[350, 298], t7:[306, 284], t8:[262, 282], r0:[222, 296], r1:[198, 332], r2:[190, 376], r3:[200, 418], r4:[232, 452],
  b0:[290, 452], b1:[342, 466], b2:[396, 482], b3:[452, 494], b4:[506, 500], b5:[558, 502], b6:[606, 500], b7:[650, 490], c0:[686, 464], c1:[700, 430], c2:[698, 386], c3:[680, 346], s1:[560, 420], s2:[420, 430], h1:[330, 430]};
const CELLS = {torsoA:['t0', 't1', 't2', 's1', 'b5', 'b6', 'b7', 'c0', 'c1', 'c2', 'c3'], torsoB:['t2', 't3', 't4', 't5', 's2', 'b3', 'b4', 'b5', 's1'], torsoC:['t6', 't5', 's2', 'b3', 'b2', 'b1', 'h1'], torsoD:['t8', 't7', 't6', 'h1', 'b1', 'b0', 'r4', 'r3', 'r2', 'r1', 'r0']};
const TB = {chain:['pelvis', 'body', 'chest'], sigma:70};
{ const nms = Object.keys(CELLS), sm = K.smoothCells(nms.map(k => CELLS[k].map(n => TP[n])), 2);
  nms.forEach((nm, i) => M.zone(nm, sm[i], {layer:4, tier:'L', ptier:'M', h:38, tags:['torso'], bind:TB, line:'region'})); }
/* the ribs as line work over the barrel, the flank fold, the elbow's pocket, the shoulder blade's outline */
{ const bel = x => { const B = [[340, 480], [396, 494], [452, 502], [506, 508], [558, 510], [606, 508]]; for(let k = 0; k < B.length - 1; k++) if(x <= B[k + 1][0]) return B[k][1] + (B[k + 1][1] - B[k][1]) * (x - B[k][0]) / (B[k + 1][0] - B[k][0]); return 508; };
  for(let q = 0; q < 8; q++){ const x = 440 + q * 17, y1 = 342 + (x - 440) * .05, xe = x - 36, ye = bel(xe) - 18;
    M.line('rib' + q, chaikin([[x, y1], [x - 5, y1 + (ye - y1) * .35], [x - 18, y1 + (ye - y1) * .7], [xe, ye]], 2, false), {layer:4.1, tags:['torso'], bind:TB, host:['torsoA', 'torsoB', 'torsoC'], line:{k:.4, c:.6, r:'f', t:'bone', tk:.15}}); } }
M.line('flankFold', chaikin([[332, 462], [346, 446], [354, 428], [356, 410]], 2, false), {layer:4.1, tags:['torso'], bind:TB, host:['torsoC', 'torsoD'], line:{k:.4, c:.6, r:'f', t:'bone', tk:.15}});
M.line('elbowPocket', chaikin([[640, 484], [618, 492], [594, 492], [572, 484]], 2, false), {layer:4.1, tags:['torso'], bind:TB, host:['torsoA'], line:{k:.4, c:.6, r:'f', t:'bone', tk:.15}});
M.rim('scapula', chaikin([[584, 296], [632, 304], [656, 350], [650, 412], [624, 432], [590, 372]], 2), {layer:4.2, tags:['torso'], bind:{mix:[['chest', .85], ['scapN', .15]]}, s:12, host:['torsoA', 'torsoB'], line:{k:.4, c:.78, r:'b', t:'bone', tk:.2}});

/* ---------- the legs: the strip meshes, the pastern and the hoof ---------- */
const FORE = [[656, 430, 38, 38], [624, 464, 34, 32], [592, 494, 30, 24], [596, 550, 26, 22], [603, 606, 20, 17], [604, 650, 12, 12], [606, 690, 11, 11], [610, 704, 10, 10]];
const HIND = [[276, 414, 66, 70], [312, 452, 60, 56], [342, 488, 44, 40], [296, 548, 38, 32], [252, 606, 26, 18], [254, 650, 13, 13], [262, 690, 11, 12], [266, 704, 10, 10]];
const shiftSt = (S, q) => S.map(p => [p[0] + q[0], p[1] + q[1], p[2], p[3]]);
function hoofParts(kind, side, far){
  const bone = (kind === 'fore' ? 'hoofF' : 'hoofH') + side, past = (kind === 'fore' ? 'pastF' : 'pastH') + side, f = kind === 'fore' ? (far ? FAR.fore : [0, 0]) : (far ? FAR.hind : [0, 0]), P0 = kind === 'fore' ? J.pastF : J.pastH, F = [P0[0][0] + f[0], P0[0][1] + f[1]], id = (kind === 'fore' ? 'F' : 'H') + side;
  const at = pts => pts.map(([x, y]) => [F[0] + x, F[1] + y]);
  const base = {layer:far ? 1 : 5, dim:far, tier:'F', zone:'paws', tags:[kind, side === 'F' ? 'F' : 'N', 'paw', 'hoofPart'], line:far ? 'far' : 'feature'};
  M.zone('pastern' + id, chaikin(at([[-9, 6], [10, 4], [20, 26], [24, 34], [8, 34], [-3, 20]]), 1), {...base, bind:{rigid:past}, h:9, tone:.12, tags:[kind, side === 'F' ? 'F' : 'N', 'leg', 'paw']});
  if(o.hoof === 'cloven'){
    M.zone('hoofA' + id, chaikin(at([[14, 28], [30, 25], [34, 34], [34, 48], [10, 48], [8, 36]]), 1), {...base, bind:{rigid:bone}, h:9, tone:.3});
    M.zone('hoofB' + id, chaikin(at([[28, 28], [44, 34], [56, 44], [58, 48], [34, 48], [34, 34]]), 1), {...base, bind:{rigid:bone}, h:9, tone:.3});
    M.shape('dew' + id, at([[0, 14], [-10, 24], [-3, 30]]), {...base, bind:{rigid:past}, tone:.9});
  } else {
    M.zone('hoofA' + id, chaikin(at([[14, 28], [28, 24], [34, 30], [34, 48], [10, 48], [8, 36]]), 1), {...base, bind:{rigid:bone}, h:10, tone:.3});
    M.zone('hoofB' + id, chaikin(at([[28, 24], [44, 34], [56, 44], [58, 48], [34, 48], [34, 30]]), 1), {...base, bind:{rigid:bone}, h:10, tone:.3});
    M.shape('coronet' + id, at([[8, 26], [20, 22], [34, 28], [28, 34], [14, 34]]), {...base, bind:{rigid:bone}, tone:.62});
  }
}
const legParts = (kind, side, S, far) => {
  const names = kind === 'fore' ? ['hum', 'rad', 'hand'] : ['fem', 'tib', 'foot'], b = {chain:names.map(n => n + side), sigma:22}, id = (kind === 'fore' ? 'F' : 'H') + side;
  const cm = {layer:far ? 1 : 5, dim:far, line:far ? 'far' : 'region', bind:b, tags:[kind, side === 'F' ? 'F' : 'N', 'leg'], tj:.03, h:far ? 36 : 24, tier:'M'};
  M.limb((kind === 'fore' ? 'foreU' : 'thigh') + side, S, {...cm, range:[0, 2]}); M.limb((kind === 'fore' ? 'foreL' : 'shin') + side, S, {...cm, range:[2, 4]});
  M.limb((kind === 'fore' ? 'cannonF' : 'cannonH') + side, S, {...cm, range:[4, 7], h:far ? 26 : 15, tier:'F'});
  hoofParts(kind, side, far);
};
legParts('fore', 'F', shiftSt(FORE, FAR.fore), true); legParts('hind', 'F', shiftSt(HIND, FAR.hind), true);

/* ---------- the tail ---------- */
if(o.tail === 'lion'){
  /* the lion's tail (the unicorn's): a thin cord on the same chain, ending in a tuft */
  M.limb('tail', TC.map(([x, y], i) => [x, y, 7.5 - i * .5, 7.5 - i * .5]), {layer:3, tier:'M', h:14, cols:1, bind:{chain:TAILB, sigma:20}, tags:['tail'], line:'region'});
  { const E = TC[6], sh = [[-6, 2], [-14, 18], [-18, 44], [-12, 74], [-2, 98], [8, 76], [14, 46], [16, 18], [7, 2]].map(([x, y]) => [E[0] + x, E[1] + y]);
    M.zone('tuft', chaikin(sh, 2), {layer:3, tier:'F', h:11, inset:.4, tags:['tail', 'tuft', 'mane'], zone:'mane', bind:{rigid:'tailTip'}, line:'region', tone:(x, y) => .14 + .34 * hash(Math.round(x + y * 3))}); }
} else {
  /* the horse's tail: the dock (bare, a limb along the first bones) and the hair, blades that flow out of it, longer toward the end, each bound along the chain */
  M.limb('dock', TC.slice(0, 4).map(([x, y], i) => [x, y, 10 - i * 1.6, 10 - i * 1.6]), {layer:3.2, tier:'M', h:14, cols:1, bind:{chain:TAILB, sigma:20}, tags:['tail'], line:'region'});
  const HAIR = [[0, .02, -3, 190, 11], [1, .05, 14, 240, 12], [2, .09, -16, 270, 12], [3, .12, 30, 300, 13], [4, .16, -30, 326, 13], [5, .2, 8, 336, 12.5], [6, .24, 42, 292, 11], [7, .28, -42, 280, 11], [8, .3, 24, 330, 11]];
  const TCX = TC.concat([[TC[6][0] + 6, TC[6][1] + 90]]), TL = polyLen(TC);
  for(const [k, s0, off, len, w] of HAIR){
    const S = [], n = 7; for(let i = 0; i <= n; i++){ const u = i / n, q = polyAt(TCX, TL * s0 + u * len), lat = off * Math.pow(u, 1.3) + Math.sin(u * 3.4 + k * 1.7) * 3.4 * u, hw = w * (u < .3 ? .5 + 1.7 * u : 1 - (u - .3) * .86) * (i === n ? .5 : 1) + .8;
      S.push([q.p[0] - q.t[1] * lat, q.p[1] + q.t[0] * lat, Math.max(1.4, hw)]); }
    M.strip('hair' + k, S, {layer:3 + .01 * k, tier:'F', ptier:'M', bind:{chain:[...TAILB, 'tailTip'], sigma:26}, tags:['tail', 'hair', 'mane'], zone:'mane', line:{k:.5, c:.7, r:'f', t:'bone', tk:.15}, tone:(x, y) => .05 + .28 * clamp((y - 330) / 300), tj:.05});
  }
}

/* ---------- the haunch, the gaskin and the leg's joints, the shoulder and the forearm ---------- */
legParts('fore', 'N', FORE, false); legParts('hind', 'N', HIND, false);
for(const [nm, pts, tg, ch, host] of [
  ['jElbow', [[590, 482], [606, 490], [606, 508], [590, 516], [572, 508], [568, 492]], 'fore', ['humN', 'radN'], ['foreUN', 'foreLN']],
  ['jCarpus', ringPts([603, 610], 16, 9, .3, .95), 'fore', ['radN', 'handN'], ['foreLN', 'cannonFN']],
  ['jFetlockF', ringPts([607, 692], 13, 9, .4, .95), 'fore', ['handN', 'pastFN'], ['cannonFN']],
  ['jStifle', ringPts([344, 488], 20, 9, .2), 'hind', ['femN', 'tibN'], ['thighN', 'shinN']],
  ['jHock', [[250, 590], [262, 600], [262, 620], [248, 628], [236, 618], [238, 598]], 'hind', ['tibN', 'footN'], ['shinN', 'cannonHN']],
  ['jFetlockH', ringPts([262, 692], 13, 9, .4, .95), 'hind', ['footN', 'pastHN'], ['cannonHN']]])
  M.zone(nm, pts, {layer:5.5, tier:'F', h:11, zone:'paws', tags:[tg, 'N', 'leg'], bind:{chain:ch, sigma:20}, host, line:'feature'});
M.zone('shouldN', chaikin([[596, 300], [640, 304], [682, 346], [706, 410], [698, 470], [668, 504], [626, 506], [590, 478], [572, 420], [570, 350]], 2), {layer:6, tier:'L', ptier:'M', h:42, tags:['fore', 'N', 'plate'], bind:{mix:[['chest', .7], ['scapN', .3]]}, line:{k:.45, c:.6, r:'b', t:'bone', tk:.1}});
M.zone('haunchN', chaikin([[212, 304], [262, 286], [312, 296], [346, 344], [352, 410], [338, 462], [304, 488], [262, 490], [224, 462], [200, 410], [196, 350]], 2), {layer:6, tier:'L', ptier:'M', h:42, tags:['hind', 'N', 'plate'], bind:{chain:['pelvis', 'femN'], sigma:44}, line:{k:.45, c:.6, r:'b', t:'bone', tk:.1}});

/* ---------- the glyph: the vital force, gold along the crest of the mane, down the line of the spine and out along the tail ---------- */
const BACK = [[596, 298], [548, 304], [500, 320], [448, 330], [398, 324], [350, 308], [306, 294], [262, 292], [228, 304]];
const DORS = [...CREST.slice().reverse(), ...spline(BACK, 5).slice(1), ...TC.slice(0, 7).map(p => p)];   // poll to the tip of the tail
const DL = polyLen(DORS), DCUM = [0]; for(let i = 1; i < DORS.length; i++) DCUM.push(DCUM[i - 1] + Math.hypot(DORS[i][0] - DORS[i - 1][0], DORS[i][1] - DORS[i - 1][1]));
const dorsS = (x, y, lo = 0, hi = DORS.length - 1) => { let bd = 1e9, bs = 0; for(let i = Math.max(0, lo); i < Math.min(hi, DORS.length - 1); i++){ const a = DORS[i], b = DORS[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)), d = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); if(d < bd){ bd = d; bs = DCUM[i] + t * (DCUM[i + 1] - DCUM[i]); } } return bs / DL; };
{ const g = {tier:'F', ink:'gold', zone:'glyph', line:'glyph', tone:.92, tj:0};
  const inset = (P, k) => P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; return [p[0] - ty / l * k, p[1] + tx / l * k]; });
  M.strip('crestInlay', inset(CREST, 6).filter((_, i) => i % 2 === 0 || i === CREST.length - 1).map(p => [p[0], p[1], 3.1]), {...g, layer:7.8, bind:{chain:[...NECK, 'head'], sigma:24}, tags:['glyph'], host:['neck', 'craniumC']});
  M.strip('backInlay', spline(BACK, 5).filter((_, i, a) => i % 2 === 0 || i === a.length - 1).map(p => [p[0], p[1] + 7, 2.8]), {...g, layer:4.6, bind:TB, tags:['glyph'], host:['torsoA', 'torsoB', 'torsoC', 'torsoD']});
  M.strip('tailInlay', polyAt2(TC, 7).map(p => [p[0], p[1], 2.6]), {...g, layer:3.6, bind:{chain:[...TAILB, 'tailTip'], sigma:24}, tags:['glyph']}); }
function polyAt2(P, n){ const out = [], L = polyLen(P); for(let i = 0; i <= n; i++){ const q = polyAt(P, L * i / n); out.push(q.p); } return out; }

/* ---------- the head, in profile ----------
   Every head part carries depth (z) and yaw, so a turn of the head toward the viewer foreshortens it and slides the near eye and ear across the skull. */
const HD = {bind:{rigid:'head'}, yaw:true};
const hz = (u, v) => 40 * Math.sqrt(Math.max(0, 1 - ((u - 70) / 150) ** 2)) * (1 - .4 * Math.abs(v) / 50);
const hl = (x, y) => [((x - HJ[0]) * EU[0] + (y - HJ[1]) * EU[1]) / HS, ((x - HJ[0]) * EV[0] + (y - HJ[1]) * EV[1]) / HS];   // a canvas point in the head's frame
const zh = (off = 0, extra) => (x, y) => { const [du, dv] = hl(x, y); return hz(du, dv) + off + (extra ? extra(du, dv) : 0); };
{ const cr = [[-16, -6], [0, -40], [30, -48], [62, -44], [80, -38], [84, -10], [86, 14], [80, 36], [66, 54], [48, 62], [26, 62], [8, 50], [-10, 28]],
      ns = [[80, -38], [112, -32], [148, -28], [174, -26], [190, -20], [198, -6], [198, 8], [180, 12], [158, 11], [132, 11], [106, 12], [86, 14], [84, -10]], sm = K.smoothCells([HP(cr), HP(ns)], 2);
  const fo = {...HD, layer:9, z:zh(0), tags:['head', 'face', 'skin'], zone:'face', line:'face'};
  M.zone('craniumC', sm[0], {...fo, tier:'L', ptier:'M', h:24});
  M.zone('nasalC', sm[1], {...fo, tier:'M', ptier:'M', h:19}); }
/* the mouth's inside lies under the upper lip and the jaw, so the jaw's drop uncovers it */
M.zone('cavity', HP([[92, 6], [150, 6], [176, 8], [186, 10], [186, 28], [160, 36], [120, 40], [92, 34]]), {...HD, layer:10, tier:'F', h:12, inset:.4, z:zh(-24), zone:'mouth', line:'mouth', tone:0, flush:1, tags:['head', 'face']});
M.zone('tongue', HP([[104, 24], [150, 22], [178, 24], [180, 32], [140, 36], [104, 34]]), {...HD, bind:{mix:[['jaw', .85], ['head', .15]]}, layer:10.1, tier:'F', h:10, inset:.4, z:zh(-20), zone:'mouth', line:'mouth', tone:.05, flush:.6, tags:['head', 'face', 'lo']});
M.zone('jaw', chaikin(HP([[26, 18], [60, 12], [100, 12], [150, 12], [178, 12], [190, 14], [192, 24], [180, 32], [152, 34], [118, 40], [88, 50], [62, 60], [38, 62], [18, 48]]), 1),
  {...HD, bind:{rigid:'jaw'}, layer:10.8, tier:'F', ptier:'F', h:14, z:zh(-4, (u, v) => 10 * Math.exp(-(((u - 80) / 80) ** 2 + ((v - 38) / 18) ** 2))), zone:'mouth', line:'feature', tags:['head', 'face', 'skin', 'lo'], tone:(x, y) => hl(x, y)[1] < 15 ? .85 : .06});
M.zone('muzzleC', chaikin(HP([[148, -27], [174, -25], [191, -18], [199, -4], [198, 9], [180, 13], [158, 11], [144, -4]]), 1), {...HD, layer:11, tier:'F', ptier:'F', h:12, z:zh(6), zone:'muzzle', line:'feature', tone:.42, tags:['head', 'face', 'skin', 'muz']});
for(let i = 0; i < 3; i++) M.shape('incU' + i, HP([[186 + i * 3.6 - 3, 11], [186 + i * 3.6 + 3, 11], [186 + i * 3.6, 19]]), {...HD, layer:10.5, z:zh(-16), zone:'mouth', line:'mouth', tone:.95, tags:['head', 'face', 'teeth']});
for(let i = 0; i < 3; i++) M.shape('incL' + i, HP([[185 + i * 3.6 - 3, 23], [185 + i * 3.6 + 3, 23], [185 + i * 3.6, 15]]), {...HD, bind:{rigid:'jaw'}, layer:10.9, z:zh(-16), zone:'mouth', line:'mouth', tone:.95, tags:['head', 'face', 'teeth', 'lo']});
M.line('faceLine', chaikin(HP([[-8, -24], [10, -42], [38, -49], [66, -45], [96, -36], [132, -30], [162, -27], [184, -21], [196, -8], [198, 8]]), 2, false), {...HD, layer:9.2, z:zh(0), line:'contour', tags:['head', 'face'], host:['craniumC', 'nasalC', 'muzzleC'], noSil:true});
M.line('jowl', chaikin(HP([[-8, 26], [8, 46], [28, 60], [52, 58], [76, 40], [86, 16]]), 2, false), {...HD, layer:9.2, z:zh(0), line:{k:.4, c:.62, r:'f', t:'bone', tk:.2}, tags:['head', 'face'], host:['craniumC', 'jaw'], noSil:true});
/* the eye: a large almond of fine facets with a horizontal pupil; the lids lie over it, the brow's ridge above */
const EYE = [62, -10], EYW = H(...EYE);
M.polar('eyeRing', EYW, [12, 19], [14, 14], {...HD, layer:12, tier:'F', ptier:'F', z:zh(8), zone:'eyes', line:'feature', tags:['head', 'face', 'eye'], tone:.3, a0:.2, sx:1.2});
M.polar('iris', EYW, [0, 7, 13], [6, 12], {...HD, layer:12.2, tier:'F', ptier:'F', z:zh(10), zone:'eyes', ink:'accent', line:'feature', flush:.15, tags:['head', 'face', 'eye'], tone:(x, y) => .72 + .28 * fSmooth(3, 11, Math.hypot(x - EYW[0], y - EYW[1])), twist:.2, sx:1.2});
M.shape('pupil', chaikin(HP(HE(EYE[0], EYE[1], 9.5, 4.8, 0, 10)), 1), {...HD, layer:12.4, z:zh(12), zone:'eyes', line:{k:.12, c:.2, r:0}, tone:0, tags:['head', 'face', 'eye', 'pupil']});
M.shape('lidU', chaikin(HP([[40, -20], [50, -32], [66, -34], [82, -28], [90, -16], [78, -20], [64, -23], [52, -20]]), 1), {...HD, layer:12.6, z:zh(14), zone:'brows', line:{k:.5, c:.72, r:'f', t:'bone', tk:.2}, tone:.5, flush:.2, tags:['head', 'face', 'lid']});
M.shape('lidL', chaikin(HP([[42, -2], [56, 6], [70, 6], [84, 0], [90, -8], [76, -2], [62, 1], [50, -1]]), 1), {...HD, layer:12.6, z:zh(14), zone:'brows', line:{k:.5, c:.72, r:'f', t:'bone', tk:.2}, tone:.45, flush:.15, tags:['head', 'face', 'lid']});
M.zone('brow', chaikin(HP([[28, -34], [52, -42], [80, -36], [94, -24], [80, -27], [56, -31], [34, -27]]), 1), {...HD, layer:12.7, tier:'F', ptier:'F', h:8, inset:.3, z:zh(12), zone:'brows', line:'feature', tone:.42, tags:['head', 'face', 'brow']});
/* the nostril and its wing */
M.shape('nostril', chaikin(HP(HE(172, -10, 12, 5.8, .3, 10)), 1), {...HD, layer:13, z:zh(16), zone:'muzzle', line:'feature', tone:.22, tags:['head', 'face', 'skin', 'nostril']});
M.shape('nostrilWing', chaikin(HP([[156, -22], [172, -26], [186, -18], [182, -13], [168, -15], [158, -13]]), 1), {...HD, layer:12.8, z:zh(14), zone:'muzzle', line:'feature', tone:.5, tags:['head', 'face', 'skin', 'nostril']});
/* the ears: long leaves on the poll, near and far, each on its own bone; the far one a little behind */
const EARP = [[-3, -36], [-10, -54], [-18, -76], [-26, -96], [-34, -104], [-40, -92], [-42, -72], [-36, -48], [-24, -36], [-10, -32]], EARI = [[-8, -44], [-14, -60], [-22, -82], [-30, -96], [-34, -86], [-36, -66], [-30, -50], [-18, -42]];
for(const s of ['N', 'F']){
  const f = s === 'F' ? [-13, -3] : [0, 0], sh = pts => HP(pts).map(([x, y]) => [x + f[0], y + f[1]]), far = s === 'F';
  M.zone('ear' + s, chaikin(sh(EARP), 1), {...HD, bind:{rigid:'ear' + s}, layer:far ? 7.9 : 11.5, tier:'F', h:11, z:zh(far ? -10 : 6), zone:'ears', line:far ? 'far' : 'feature', dim:far, tone:.24, tags:['head', 'ear', ...(far ? ['F'] : [])]});
  M.zone('earIn' + s, chaikin(sh(EARI), 1), {...HD, bind:{rigid:'ear' + s}, layer:far ? 7.95 : 11.6, tier:'F', h:8, inset:.3, z:zh(far ? -8 : 8), zone:'ears', line:far ? 'far' : 'feature', dim:far, tone:.4, flush:.5, tags:['head', 'ear', ...(far ? ['F'] : [])]});
}
/* the forelock and the mane: locks, each a strip that is rooted in the body it grows from and streams on a bone of its own (a follower), so it lags and overshoots */
function lock(name, root, dir, len, w, o = {}){
  const n = 6, S = [], bend = o.bend ?? 0; let a = dir, p = root.slice();
  for(let i = 0; i <= n; i++){ const u = i / n, hw = w * (u < .28 ? .55 + 1.6 * u : 1 - (u - .28) * .86) * (i === n ? .5 : 1) + .8; S.push([p[0], p[1], Math.max(1.3, hw)]); a += bend * len / n + (o.s ? Math.sin(u * 3.2 + o.s) * .07 : 0); p = [p[0] + Math.cos(a) * len / n, p[1] + Math.sin(a) * len / n]; }
  const nb = o.nb, mb = o.mb;
  M.strip(name, S, {layer:o.layer, tier:'F', ptier:'M', yaw:!!o.yaw, z:o.z, bind:(x, y) => { const t = clamp(Math.hypot(x - root[0], y - root[1]) / len), w2 = fSmooth(.05, .85, t); return [[nb, 1.001 - w2], [mb, w2 + .001]]; },
    tags:['mane', ...(o.tags || [])], zone:'mane', line:{k:.5, c:.7, r:'f', t:'bone', tk:.15}, tone:(x, y) => .05 + .3 * clamp(Math.hypot(x - root[0], y - root[1]) / len), tj:.05});
}
{ const fd = Math.atan2(hv(1, -.12)[1], hv(1, -.12)[0]);
  for(let k = 0; k < 4; k++){ const r = H(8 + k * 7, -42 + k * 1.5); lock('forelock' + k, r, fd + (k - 1.5) * .2, 74 + k * 8 - (k === 3 ? 14 : 0), 8.5, {layer:12.5, nb:'head', mb:'forelockB', yaw:true, z:zc(14), bend:.1 + .03 * k, s:k, tags:['head']}); } }
const MANEN = 17;
for(let k = 0; k < MANEN; k++){
  const s = .035 + k * (.93 / (MANEN - 1)), a = polyAt(CREST, CRL * s), tx = a.t[0], ty = a.t[1], seg = Math.min(4, Math.floor(s * 5)), hs_ = hash(k * 13 + 5);
  const ox = ty, oy = -tx, dx = ox * .95 - tx * .4, dy = oy * .95 - ty * .4, root = [a.p[0] - ox * 4, a.p[1] - oy * 4];
  lock('maneLock' + k, root, Math.atan2(dy, dx) + (hs_ - .5) * .22, 104 + 40 * hs_ + 26 * (1 - s), 11 + 3.6 * hs_, {layer:7.5 + .001 * k, nb:NECK[seg], mb:MANEB[seg], bend:-.0105 - .004 * hs_, s:k});
}

/* ---------- the muscles ----------
   The face rig's muscle (a gaussian field in rest space that displaces vertices and inks creases) that also turns the joints it really turns. Pairs: NF is the near and far
   limb (and ear). Head muscles are placed in the head's frame with hm; their displacement vectors are turned into canvas units with hv. */
const cr = (cx, cy, rx, ry, ang, f, amp = .5, lo = .78, hi = .95) => K.crease(cx, cy, rx, ry, ang, f, amp, lo, hi), soft = (cx, cy, rx, ry, amp) => K.glow(cx, cy, rx, ry, amp), both = K.both;
const hm = (id, name, g, c, r, q = {}) => { const w = H(...c); return M.muscle(id, {name, g, c:w, r:[r[0] * HS, r[1] * HS], speed:q.speed ?? 10, ...q, v:q.v && hv(...q.v), shade:q.sh && q.sh(w)}); };
const hsoft = (r, amp) => w => soft(w[0], w[1], r[0], r[1], amp), hcr = (r, ang, f, amp, lo, hi) => w => cr(w[0], w[1], r[0], r[1], ang, f, amp, lo, hi);
// the jaw: the closers against the opener; the masseter is large and the horse grinds sideways
hm('masseter', 'masseter', 'jaw', [34, 22], [28, 26], {v:[2, -10], hue:'#b09880', speed:8, jt:[['jaw', -.34, 'r']], sh:w => both(hcr([26, 22], 1.4, .2, .8, .78, .95)(w), hsoft([28, 26], .6)(w))});
hm('temporalis', 'temporalis', 'jaw', [30, -12], [24, 22], {v:[2, -6], hue:'#a09080', speed:8, jt:[['jaw', -.12, 'r']], sh:hsoft([24, 22], .5)});
hm('digastric', 'digastric (open the jaw)', 'jaw', [40, 40], [28, 18], {dir:[0, 1], hue:'#80a0a8', speed:9, jt:[['jaw', .34, 'r']], host:'jaw'});
hm('pterygoid', 'pterygoid (grind sideways)', 'jaw', [56, 24], [30, 14], {v:[3, 0], hue:'#c0b090', speed:11, jt:[['jaw', .05, 'r']], host:'jaw', dir:[1, 0]});
// the lips and nostril
hm('depLab', 'depressor labii inferioris (drop the lower lip)', 'lips', [170, 20], [26, 12], {v:[0, 10], hue:'#90a0c8', speed:10, on:['lo'], sh:hcr([26, 12], 1.3, .2, .7, .78, .95)});
hm('levLab', 'levator labii superioris (curl the upper lip)', 'lips', [160, -10], [32, 14], {v:[-14, -22], hue:'#e3806f', speed:12, on:['muz', 'nostril'], sh:hcr([30, 14], .5, .2, .8, .78, .95)});
hm('levNaso', 'levator nasolabialis (lift the lip, open the nostril)', 'lips', [146, -14], [30, 14], {v:[-2, -12], hue:'#d8c89a', speed:11, on:['muz', 'nostril', 'nasalC'], sh:both(hcr([28, 14], 1.1, .22, .8, .78, .95), hsoft([28, 14], .5))});
hm('nostrilD', 'dilator naris (flare the nostril)', 'lips', [168, -8], [16, 10], {pull:[-.5, -.7], hue:'#ff9a76', speed:14, on:['nostril'], sh:hsoft([16, 10], .5)});
hm('orbOris', 'orbicularis oris (purse the lips)', 'lips', [184, 2], [16, 18], {v:[3, 0], hue:'#d985a6', speed:12, on:['muz', 'incU0', 'incU1', 'incU2'], sh:hsoft([14, 16], .35)});
hm('zygo', 'zygomaticus (draw the mouth back)', 'lips', [120, 8], [24, 12], {v:[-8, -2], hue:'#c0a0d0', speed:12, on:['nasalC', 'muz', 'lo'], sh:hcr([22, 10], .3, .2, .6, .78, .95)});
// the eye and brow
hm('orbic', 'orbicularis oculi', 'eyes', [60, -8], [24, 16], {pull:[.5, .8], hue:'#ffbe00', speed:18, on:['skin', 'eye', 'lid'], sh:hcr([26, 16], .3, .25, .6, .78, .95)});
hm('levPalp', 'levator palpebrae (open the eye)', 'eyes', [60, -22], [24, 10], {v:[0, -8], hue:'#7ec3e6', speed:16, on:['lidU'], sh:hsoft([22, 10], .5)});
hm('laom', 'levator anguli oculi medialis (the inner brow)', 'eyes', [44, -30], [20, 12], {v:[-3, -10], hue:'#c79ae0', speed:10, on:['skin', 'brow', 'lid'], sh:both(hcr([18, 10], 1.2, .25, .7, .78, .95), hsoft([18, 10], .5))});
hm('dilator', 'pupil dilator', 'eyes', [60, -8], [14, 8], {pull:[-.8, -.8], hue:'#3b3a78', speed:10, on:['pupil']});
for(const [id, nm, v] of [['lookF', 'gaze forward', [5, 0]], ['lookB', 'gaze back', [-5, 0]], ['lookU', 'gaze up', [0, -3.5]], ['lookD', 'gaze down', [0, 3.5]]]) hm(id, nm, 'gaze', [60, -8], [10, 8], {v, hue:'#7ec3e6', speed:14, on:['pupil']});
// the ears: a near and a far, each its own; the muscles turn the ear's bone, and a sideways ear (an "aeroplane") is foreshortened (see idle)
const em = (id, name, c, r, v, jt, hue, speed = 14) => M.muscle(id, {name, g:'ears', pair:'NF', c:H(...c), r:[r[0] * HS, r[1] * HS], v:hv(...v), hue, speed, on:['ear'], jt});
em('earBack', 'auricularis posterior (ear back and down)', [-22, -66], [26, 36], [-4, 6], [['ear$', .85, 'r']], '#a89880');
em('earUp', 'auricularis superior (ear up)', [-22, -66], [26, 36], [0, -6], [['ear$', -.3, 'r']], '#b0a090');
em('earFwd', 'auricularis anterior (ear forward)', [-22, -66], [26, 36], [6, 0], [['ear$', -.62, 'r']], '#c0b8a0');
em('earOut', 'scutuloauricularis (ear out to the side)', [-22, -66], [26, 36], [0, 4], [['ear$', .38, 'r']], '#98a0b8');
M.muscle('splenius', {name:'splenius capitis (turn the head)', g:'neck', c:H(40, -30), r:[26 * HS, 30 * HS], v:hv(0, -2), hue:'#9a88c0', speed:6, on:['skin'], jt:[['@yaw', .62, 'yaw']]});
M.muscle('tongueOut', {name:'genioglossus (the tongue out)', g:'jaw', c:H(176, 24), r:[22 * HS, 14 * HS], v:hv(18, 2), hue:'#c85a6a', speed:11, on:['tongue']});
// the neck: the extensors (the nuchal ligament carries the head; these raise and hold it), the flexors, and the arch
const nj = (a, hg) => [...NECK.map((n, i) => [n, a[i], 'r']), ['head', hg, 'r']];
M.muscle('neckUp', {name:'splenius · semispinalis (neck extensors)', g:'neck', c:[700, 270], r:[62, 40], v:[0, -4], hue:'#7ec3e6', speed:6.5, on:['neck', 'mane'], jt:nj([-.1, -.1, -.09, -.08, -.07], -.05), shade:cr(700, 276, 60, 28, .7, .1, .45)});
M.muscle('neckDown', {name:'longus colli · sternocephalicus (neck flexors)', g:'neck', c:[706, 320], r:[50, 38], v:[0, 4], hue:'#ffbe00', speed:6.5, on:['neck'], jt:nj([.1, .1, .09, .08, .07], .05), shade:cr(706, 322, 46, 26, .7, .1, .4)});
M.muscle('neckArch', {name:'nuchal ligament and rhomboideus cervicis (the arch)', g:'neck', c:[680, 280], r:[60, 40], v:[2, -3], hue:'#9ab0d8', speed:6, on:['neck', 'mane'], jt:nj([-.07, -.05, .02, .07, .1], .13), shade:both(cr(690, 276, 58, 28, .7, .1, .5), soft(690, 276, 56, 30, .3))});
M.muscle('brachioceph', {name:'brachiocephalicus', g:'neck', pair:'NF', far:[34, -4], c:[664, 360], r:[44, 52], v:[0, -4], hue:'#7090a0', speed:7, on:['torso', 'fore', 'neck'], jt:[['neck0', -.04, 'r'], ['hum$', -.12, 'r']], shade:cr(664, 362, 40, 48, 2.2, .1, .5)});
M.muscle('throat', {name:'hyoid · laryngeal (the throat)', g:'neck', c:H(10, 40), r:[26, 20], v:hv(2, 5), hue:'#8fb0a0', speed:12, on:['neck'], shade:soft(740, 232, 24, 18, .5), host:'neck3'});
M.muscle('maneLift', {name:'mane erector (lift the crest)', g:'neck', c:[690, 262], r:[90, 50], v:[-2, -8], hue:'#d8a050', speed:6, on:['mane'], dir:[0, -1], host:'neck2'});
// the trunk
M.muscle('epaxial', {name:'longissimus dorsi (epaxial)', g:'spine', c:[420, 316], r:[200, 22], v:[0, -6], hue:'#c8a070', speed:7, on:['torso'], jt:[['pelvis', .08, 'r'], ['chest', -.08, 'r']], shade:cr(420, 320, 200, 18, 0, .09, .3)});
M.muscle('hypaxial', {name:'rectus abdominis (hypaxial)', g:'spine', c:[420, 496], r:[200, 22], v:[0, 6], hue:'#a8c0a0', speed:7, on:['torso'], jt:[['pelvis', -.14, 'r'], ['chest', .14, 'r']], shade:cr(420, 496, 200, 18, 0, .1, .3)});
M.muscle('intercostals', {name:'intercostals (the breath)', g:'spine', c:[500, 420], r:[130, 84], pull:[-.07, -.1], hue:'#8fd0a8', speed:5, on:['torso'], dir:[0, 1], host:'chest', shade:soft(500, 420, 120, 76, .1)});
M.muscle('flank', {name:'external oblique (the flank)', g:'spine', c:[330, 458], r:[60, 38], v:[3, 7], hue:'#b0d0a8', speed:6, on:['torso', 'hind'], dir:[0, 1], host:'pelvis', shade:soft(330, 458, 54, 34, .1)});
for(const [id, x, y] of [['panniculusA', 540, 410], ['panniculusB', 460, 396], ['panniculusC', 380, 384], ['panniculusD', 300, 372]]) M.muscle(id, {name:'panniculus carnosus (' + id.slice(10) + ')', g:'skin', c:[x, y], r:[44, 64], v:[0, -4], hue:'#d8b8a0', speed:16, on:['torso'], dir:[0, -1], host:x < 340 ? 'pelvis' : x < 470 ? 'body' : 'chest', shade:both(cr(x, y, 42, 58, 1.3, .16, .38), soft(x, y, 42, 58, .18))});
// the foreleg
const fm = (id, name, c, r, q) => M.muscle(id, {name, g:'foreleg', pair:'NF', c, r, speed:10, ...q});
fm('trapezius', 'trapezius', [598, 330], [66, 34], {v:[0, -9], hue:'#9a88c0', speed:8, on:['torso', 'fore', 'neck'], jt:[['scap$', .06, 'r']], shade:cr(598, 334, 56, 26, .7, .12, .55)});
fm('serratus', 'serratus ventralis', [596, 432], [42, 52], {v:[-4, -6], hue:'#c9a0dc', speed:9, on:['torso', 'fore'], jt:[['scap$', -.16, 'r']], shade:cr(596, 432, 38, 46, 1.2, .16, .55)});
fm('pectoral', 'pectoralis (superficial and deep)', [676, 456], [36, 44], {v:[6, 3], hue:'#d49aa0', speed:9, on:['torso', 'fore'], jt:[['hum$', .22, 'r']], shade:cr(676, 456, 32, 40, 1.9, .16, .55)});
fm('supraspinatus', 'supraspinatus', [630, 368], [34, 34], {v:[4, -6], hue:'#a8b890', speed:9, on:['torso', 'fore'], jt:[['hum$', -.22, 'r']], shade:cr(630, 368, 30, 30, .9, .16, .5)});
fm('deltoid', 'deltoid', [656, 428], [34, 40], {v:[8, -6], hue:'#e0b060', speed:10, on:['fore'], jt:[['hum$', -.42, 'r']], shade:cr(658, 432, 30, 36, .3, .18, .55)});
fm('latissimus', 'latissimus dorsi', [560, 440], [58, 54], {v:[-10, -8], hue:'#d47868', speed:9, on:['torso', 'fore'], jt:[['hum$', .38, 'r']], shade:cr(558, 444, 54, 50, -.6, .13, .6)});
fm('brachialis', 'biceps brachii · brachialis', [622, 470], [24, 44], {v:[5, -6], hue:'#e0a8b8', speed:11, on:['fore'], jt:[['rad$', -.7, 'r']], shade:cr(622, 470, 20, 40, 1.57, .22, .55)});
fm('triceps', 'triceps brachii (the three heads)', [584, 470], [32, 46], {v:[-7, -8], hue:'#e07088', speed:10, on:['fore'], jt:[['rad$', .5, 'r']], shade:cr(584, 470, 28, 42, 1.57, .2, .6)});
fm('extCarpi', 'extensor carpi radialis', [610, 560], [20, 44], {v:[0, -3], hue:'#a0c8c0', speed:13, on:['fore'], jt:[['hand$', -.4, 'r']], shade:cr(610, 560, 15, 38, 1.57, .26, .5)});
fm('flexCarpi', 'flexor carpi ulnaris', [592, 560], [20, 44], {v:[0, 4], hue:'#b0a0d0', speed:13, on:['fore'], jt:[['hand$', .55, 'r']], shade:cr(592, 560, 16, 38, 1.57, .26, .55)});
fm('sdf', 'superficial digital flexor (the tendon that holds the fetlock up)', [604, 660], [14, 40], {v:[-1, 3], hue:'#d8a8a0', speed:12, on:['fore'], jt:[['pastF$', .5, 'r']], shade:cr(604, 660, 11, 34, 1.57, .3, .45)});
fm('cde', 'common digital extensor', [610, 660], [14, 40], {v:[1, -2], hue:'#a0b8d0', speed:12, on:['fore'], jt:[['pastF$', -.55, 'r'], ['hoofF$', -.3, 'r']], shade:cr(610, 660, 11, 34, 1.57, .3, .4)});
fm('fdp', 'deep digital flexor (the tendon to the coffin bone: it closes the hoof)', [622, 702], [16, 34], {v:[-1, 2], hue:'#d0a0a8', speed:12, on:['fore'], jt:[['hoofF$', .8, 'r']], shade:cr(622, 702, 12, 28, 1.57, .3, .4)});   // the coronet joint had no muscle: the hoof turned only by a posture's channel and the gait's code
// the hindquarter
const hmu = (id, name, c, r, q) => M.muscle(id, {name, g:'hindleg', pair:'NF', c, r, speed:10, ...q});
hmu('hipFlex', 'iliopsoas (hip flexor)', [316, 432], [36, 36], {v:[4, -6], hue:'#c0a0d0', speed:9, on:['torso', 'hind'], jt:[['fem$', -.42, 'r']]});
hmu('tfl', 'tensor fasciae latae', [314, 372], [36, 34], {v:[5, -5], hue:'#d8a8c0', speed:9, on:['torso', 'hind'], jt:[['fem$', -.12, 'r']], shade:cr(314, 374, 32, 30, .5, .16, .5)});
hmu('glutes', 'gluteals (the great croup muscle)', [250, 350], [56, 56], {v:[-9, -4], hue:'#e0b060', speed:9, on:['torso', 'hind'], jt:[['fem$', .36, 'r']], shade:cr(250, 352, 50, 50, .5, .13, .6)});
hmu('hamstrings', 'biceps femoris · semitendinosus (hamstrings)', [232, 452], [34, 58], {v:[-8, 6], hue:'#d89060', speed:10, on:['hind'], jt:[['fem$', .18, 'r'], ['tib$', .45, 'r']], shade:cr(232, 452, 30, 54, 1.57, .18, .6)});
hmu('quads', 'quadriceps', [330, 462], [34, 46], {v:[8, -4], hue:'#c48070', speed:10, on:['hind'], jt:[['tib$', -.5, 'r'], ['fem$', -.06, 'r']], shade:cr(330, 462, 30, 42, 1.57, .2, .55)});
hmu('gastroc', 'gastrocnemius', [270, 570], [24, 46], {v:[-8, 6], hue:'#e07070', speed:12, on:['hind'], jt:[['foot$', .55, 'r']], shade:cr(270, 570, 20, 40, 1.57, .24, .6)});
hmu('tibialis', 'tibialis cranialis · peroneus tertius', [310, 566], [22, 44], {v:[4, -3], hue:'#8090c0', speed:12, on:['hind'], jt:[['foot$', -.45, 'r']], shade:cr(310, 566, 18, 38, 1.57, .26, .5)});
hmu('sdfH', 'superficial digital flexor (hind)', [258, 660], [14, 40], {v:[-1, 3], hue:'#d8a8a0', speed:12, on:['hind'], jt:[['pastH$', .5, 'r']], shade:cr(258, 660, 11, 34, 1.57, .3, .45)});
hmu('cdeH', 'long digital extensor (hind)', [266, 660], [14, 40], {v:[1, -2], hue:'#a0b8d0', speed:12, on:['hind'], jt:[['pastH$', -.55, 'r'], ['hoofH$', -.3, 'r']], shade:cr(266, 660, 11, 34, 1.57, .3, .4)});
hmu('fdpH', 'deep digital flexor (hind: it closes the hoof)', [274, 702], [16, 34], {v:[-1, 2], hue:'#d0a0a8', speed:12, on:['hind'], jt:[['hoofH$', .8, 'r']], shade:cr(274, 702, 12, 28, 1.57, .3, .4)});
// the tail: the dock, and the hair behind it
const tj = a => TAILB.map((n, i) => [n, a[i], 'r']);
M.muscle('levCaudae', {name:'levator caudae (lift the tail)', g:'tail', c:[186, 380], r:[34, 110], v:[0, 0], dir:[-1, 0], hue:'#d8c89a', speed:8, on:['tail'], jt:tj([.12, .08, .05, .04, .02, .015]), host:'tail1'});
M.muscle('depCaudae', {name:'depressor caudae (clamp it down)', g:'tail', c:[186, 380], r:[34, 110], v:[0, 0], dir:[1, 0], hue:'#8f9ac0', speed:11, on:['tail'], jt:tj([-.14, -.09, -.06, -.04, -.02, -.02]), host:'tail1'});
M.muscle('flexCaudae', {name:'intertransversarii caudae (curl the tail)', g:'tail', c:[176, 520], r:[30, 90], v:[0, 0], dir:[-1, 0], hue:'#c090c0', speed:12, on:['tail'], jt:tj([0, .03, .06, .09, .1, .1]), host:'tail4'});

/* ---------- postures and edges ----------
   stand (a hand's breadth low, so the legs have slack); alert (head high and arched, ears pricked, the weight back); doze (the head low, the near hind hoof cocked on its toe); graze (the head to the
   grass, a foreleg forward); kneel and lie (the horse goes down FRONT FIRST: the forelegs fold to the knees, the rear sinks after, and it ends on the sternum, the hind legs tucked to the side); sit (the dog-sitting
   stage of getting up: the forehand rises first on straight forelegs while the rear is still down); rear (rampant, on the hind legs). */
const PIV = [272, 398], HAND0 = Math.atan2(J.hand[1][1] - J.hand[0][1], J.hand[1][0] - J.hand[0][0]), FOOT0 = Math.atan2(J.foot[1][1] - J.foot[0][1], J.foot[1][0] - J.foot[0][0]);
const rotW = (p, th, dx, dy) => { const c = Math.cos(th), s = Math.sin(th); return [PIV[0] + c * (p[0] - PIV[0]) - s * (p[1] - PIV[1]) + dx, PIV[1] + s * (p[0] - PIV[0]) + c * (p[1] - PIV[1]) + dy]; };
const farOf = (f, q) => f && [f[0] + q[0], f[1] + q[1], f[2]];
const feet = (fn, hn, q = {}) => [fn, farOf(fn, [FAR.fore[0] + (q.fx || 0), FAR.fore[1] + (q.fy || 0)]), hn, farOf(q.hf || hn, [FAR.hind[0] + (q.hx || 0), FAR.hind[1] + (q.hy || 0)])];
const GT = [J.hand[1][0], 735], HT = [J.foot[1][0], 735];
const nk = (a, hd) => { const o2 = {head:hd}; a.forEach((v, i) => { o2['neck' + i] = v; }); return o2; };
M.posture('stand', {root:[0, 12, 0]});
M.posture('alert', {root:M.rootV(PIV, -.012, -2, 12), jt:{...nk([-.1, -.08, -.03, .04, .09], .12), tail0:.08, tail1:.06, tail2:.04, tail3:.03}, cam:[1.05, 508, 426]});
M.posture('doze', {root:[0, 18, .01], jt:{...nk([.3, .28, .22, .14, .04], -.62), tail0:.06}, feet:feet([GT[0], GT[1], HAND0], [HT[0] - 16, 718, FOOT0 + .2], {hf:[HT[0], HT[1], FOOT0]}), cam:[1.03, 530, 440]});
M.posture('graze', {root:M.rootV(PIV, .16, 0, 42), jt:{...nk([.38, .38, .38, .38, .38], -1.5), tail0:.04}, feet:feet([GT[0] + 44, GT[1], HAND0 - .12], [HT[0], HT[1], FOOT0], {fx:-18}), cam:[1.1, 552, 450]});
M.posture('kneel', {root:M.rootV(PIV, .19, 0, 22), jt:{...nk([.06, .05, .02, -.02, -.04], .06), pastFN:-.4, pastFF:-.4, hoofFN:-1.2, hoofFF:-1.2, tail0:.1}, feet:feet([586, 722, 2.76], [HT[0], HT[1], FOOT0], {fx:-4}), cam:[1.06, 540, 450]});
M.posture('lie', {root:[0, 224, -.01], jt:{...nk([-.1, -.06, -.02, .04, .1], -.05), pastFN:-.4, pastFF:-.4, hoofFN:-1.1, hoofFF:-1.1, pastHN:.4, pastHF:.4, tail0:.12, tail1:.08, tail2:-.1, tail3:-.4, tail4:-.5, tail5:-.3}, feet:feet([566, 734, 2.74], [330, 734, .14], {fx:-6, hx:14}), cam:[1.05, 530, 468], ground:1});
M.posture('sit', {root:M.rootV([610, 440], -.28, 4, 130), jt:{...nk([-.1, -.06, -.02, .04, .1], -.04), tail0:.22, tail1:-.2, tail2:-.4, tail3:-.4}, feet:feet([GT[0] - 6, GT[1], HAND0 + .02], [300, 734, .14]), cam:[1.08, 516, 440]});
{ const th = -.82, dx = 40, dy = 60, sh = rotW(J.hum[0], th, dx, dy);
  M.posture('rear', {root:M.rootV(PIV, th, dx, dy), jt:{...nk([-.14, -.08, -.02, .06, .12], .1), pastFN:.7, pastFF:.7, tail0:.3, tail1:.1, tail2:-.1}, feet:feet([sh[0] + 52, sh[1] + 120, 1.9], [HT[0] + 6, HT[1], FOOT0], {fx:-16}), cam:[1.45, 548, 330]}); }
M.edge('stand>alert', {ms:1300, g:{head:[0, 1000], front:[100, 900], root:[200, 900], rear:[300, 800], tail:[350, 800], cam:[0, 1200]}, bumps:[['rr', 0, 500, -.008]]});
M.edge('stand>doze', {ms:3200, g:{root:[0, 2400], rear:[500, 2200], front:[400, 2200], head:[900, 2100], tail:[800, 2200], cam:[0, 3000]}});
M.edge('stand>graze', {ms:2500, g:{root:[0, 1800], front:[200, 1700], head:[0, 1900], rear:[500, 1700], tail:[900, 1500], cam:[0, 2300]}});
M.edge('stand>kneel', {ms:2500, g:{front:[0, 1800], root:[300, 1800], head:[800, 1300], rear:[1500, 800], tail:[500, 1700], cam:[0, 2300]}, bumps:[['rr', 0, 800, -.012]]});
M.edge('kneel>lie', {ms:2900, g:{rear:[0, 1900], root:[200, 2000], front:[900, 1500], head:[1500, 1300], tail:[0, 1700], cam:[0, 2700]}});
M.edge('lie>sit', {ms:2800, g:{head:[0, 1300], front:[200, 1700], root:[300, 1800], rear:[1400, 1300], tail:[900, 1600], cam:[0, 2600]}});
M.edge('sit>stand', {ms:2500, g:{rear:[0, 1500], root:[200, 1800], front:[600, 1400], head:[900, 1300], tail:[900, 1300], cam:[400, 1900]}});
M.edge('stand>rear', {ms:2400, g:{rear:[0, 1100], root:[300, 1400], front:[500, 1300], head:[600, 1200], tail:[400, 1400], cam:[0, 900]}, bumps:[['ry', 0, 700, 16]]});
M.edge('rear>stand', {ms:2700, g:{head:[0, 1000], root:[250, 1500], front:[300, 1700], rear:[600, 1400], tail:[900, 1400], cam:[300, 2000]}, bumps:[['ry', 1800, 800, 9]]});
M.edge('alert>rear', {ms:1900, g:{rear:[0, 900], root:[200, 1100], front:[300, 1000], head:[400, 900], tail:[300, 1100], cam:[0, 700]}, bumps:[['ry', 0, 600, 14]]});
// the horse lies down by the front (stand to kneel to lie) and rises by the front (lie to sit to stand): the opposite way round is the slow way, so the router never takes it
for(const k of ['kneel>stand', 'lie>kneel', 'stand>sit', 'sit>lie']) M.edge(k, {ms:9000, g:{}});

/* ---------- gaits: one engine on a blend line ----------
   The legs are listed fore near, fore far, hind near, hind far; near is the horse's right (it faces right and we see its right side). walk: four beats, a lateral sequence (hind then the fore on the same side),
   each foot down about two thirds of the cycle; trot: two beats, the diagonal pairs together, a short suspension; canter: three beats, the right lead (the far hind alone, the near hind with the far fore, the near fore
   last, then a suspension); gallop: four beats, the transverse gallop (far hind, near hind, far fore, near fore, then the suspension with the legs gathered). The cycle times and duty factors are in the notes. */
M.gait('walk', {psi:1, base:'stand', L:190, cyc:1150, duty:.68, lift:[36, 36, 28, 28], off:[.75, .25, 0, .5], flex:[.5, .45, .5, .5], hs:[0, 0, 12, 12], bob:3, sink:0, cap:1.8, lead:0});
M.gait('trot', {psi:2, base:'stand', L:230, cyc:740, duty:.45, lift:[44, 44, 32, 32], off:[0, .5, .5, 0], flex:[.6, .55, .55, .55], hs:[0, 0, 14, 14], bob:7, sink:6, cap:1.6, lead:0});
M.gait('canter', {psi:3, base:'stand', L:240, cyc:600, duty:.4, lift:[50, 46, 34, 32], off:[0, .17, .17, .34], flex:[.7, .65, .55, .5], hs:[16, 0, 14, 0], bob:0, sink:8, cap:1.5, lead:3});
M.gait('gallop', {psi:4, base:'stand', L:210, cyc:520, duty:.3, lift:[62, 58, 36, 34], off:[0, .13, .33, .46], flex:[.35, .35, .25, .25], hs:[18, 0, 16, 0], bob:0, sink:12, cap:1.4, lead:3});

/* ---------- actions ----------
   Each adds to the muscle targets and the pose channels for its own clock. With no `in` an action is a layer (any posture, even mid-transition); with `in` it needs those postures and the horse
   goes to the nearest one first. Planted feet stay planted: a layered action never moves them, and a foot an action lifts (the paw, the stamp) is blended from where the posture has it and returned there.
   A head movement is staged from the body out: the chest and the root of the neck start it, each bone of the neck follows a little later, the head and the ears last. */
const KS = (t, kk) => keys(t, kk), sinc = (t, f, ph = 0) => Math.sin(t * f + ph), mid = v => [v, v];
const NKS = NECK.concat(['head']);
/* bend the neck chain (and the head) by amps, bone by bone, each a little after the one before it: kk is a smooth keyframe curve of t (ms); instant (jd) or smoothed (jt) */
const nbend = (c, t, kk, amps, delay = 70, inst = false) => NKS.forEach((n, i) => { if(!amps[i]) return; const v = KS(t - (inst ? 30 : 110) - delay * i, kk) * amps[i]; if(inst) c.jd(n, v); else c.jt(n, v); });
const LOWER = [.1, .1, .09, .08, .07, .04], RAISE = LOWER.map(v => -v);
const lockPuff = (c, a, key, t0, side = 1) => { if(a[key]) return; a[key] = 1; const p = c.wp('head', H(198, 0)); c.burstAt(p[0] + 10, p[1] + 6, 54, K.hexInt(K.ROSTER.bone), 'muzzle'); };
M.action('blink', {label:'Blink', group:'Face', dur:360, tiny:true, gait:true, f:(t, T, c) => { const e = env(t, 70, 40, 130); c.spec(T, {orbic:1.45 * e, levPalp:-.3 * e}); }});
M.action('slowblink', {label:'Slow blink', group:'Face', dur:3200, gait:true, f:(t, T, c) => { const b = KS(t, [[0, 0], [850, 1], [1500, 1], [2500, 0]]); c.Q.yaw += .06 * b; c.spec(T, {orbic:1.3 * b, levPalp:-.4 * b, earOut:mid(.2 * b), intercostals:.3 * b}); c.jt('chest', .006 * b); }});
M.action('ear', {label:'Ear flick', group:'Face', dur:760, tiny:true, gait:true, f:(t, T, c, a) => { const s = a.side ?? (a.side = c.rand() < .5 ? 0 : 1), e = pulse(t, 0, 70, 40, 140) + .7 * pulse(t, 230, 60, 20, 120), v = [0, 0]; v[s] = e; c.spec(T, {earBack:[.5 * v[0], .5 * v[1]], earUp:[.2 * v[1], .2 * v[0]]}); }});
M.action('listen', {label:'Listen', group:'Face', dur:4600, gait:true, f:(t, T, c) => {
  const N = KS(t, [[0, 0], [380, 1], [1500, .35], [2100, -.3], [3200, -.3], [4000, 0]]), F = KS(t, [[0, 0], [700, 0], [1050, 1], [2700, 1], [3500, 0]]), h = KS(t, [[0, 0], [500, 1], [3100, 1], [4400, 0]]);
  c.spec(T, {earFwd:[pos(N), pos(F)], earUp:[.3 * pos(N), .3 * pos(F)], earBack:[pos(-N) * .8, 0], earOut:[0, .3 * pos(-N)]}); c.Q.yaw += .14 * h; c.jt('chest', -.01 * h); nbend(c, t, [[0, 0], [600, 1], [3200, 1], [4400, 0]], [-.016, -.014, -.01, -.006, 0, 0], 90);
  c.spec(T, {levPalp:.3 * h, nostrilD:.25 * h}); }});
M.action('glance', {label:'Glance', group:'Face', dur:2800, gait:true, f:(t, T, c, a) => { const d = a.dir ?? (a.dir = c.rand() < .5 ? -1 : 1), g = [[0, 0], [380, 1], [1500, 1], [2500, 0]], gz = KS(t, [[0, 0], [260, 1], [1550, 1], [2300, 0]]), gs = KS(t, g);
  c.jt('chest', .008 * d * gs); nbend(c, t, g, [.016 * d, .02 * d, .022 * d, .02 * d, .014 * d, 0], 80); c.Q.yaw += .22 * gs * d;
  c.spec(T, {lookF:d > 0 ? gz : 0, lookB:d < 0 ? gz : 0, levPalp:.12 * gs, earFwd:d > 0 ? [.3 * gs, .1 * gs] : [.1 * gs, .3 * gs]}); }});
M.action('nod', {label:'Nod', group:'Face', dur:1600, gait:true, f:(t, T, c) => { const e = env(t, 200, 700, 450), sv = sinc(t, .0085); c.jd('chest', .009 * e * sv); c.jd('neck0', .02 * e * sinc(t, .0085)); c.jd('neck1', .03 * e * sinc(t - 60, .0085)); c.jd('neck2', .04 * e * sinc(t - 120, .0085)); c.jd('neck3', .05 * e * sinc(t - 180, .0085)); c.jd('head', .06 * e * sinc(t - 240, .0085)); }});
M.action('raise', {label:'Raise the head', group:'Face', dur:4200, gait:false, f:(t, T, c) => { const e = [[0, 0], [700, 1], [3000, 1], [4000, 0]], h = KS(t, e); c.jt('chest', -.012 * h); nbend(c, t, e, [-.07, -.07, -.06, -.02, .05, .08], 90); c.spec(T, {earFwd:mid(.9 * h), nostrilD:mid(.6 * h), levPalp:.4 * h, intercostals:.3 * h, neckArch:.4 * h}); }});
// breath and voice
M.action('sigh', {label:'Sigh', group:'Breath', dur:3000, gait:true, f:(t, T, c) => { const e = KS(t, [[0, 0], [1100, 1], [1400, .95], [2800, 0]]), x = KS(t, [[0, 0], [1300, 0], [1600, 1], [2900, 0]]); c.jt('chest', -.012 * e + .012 * x); c.spec(T, {intercostals:1.15 * e - .5 * x, flank:.8 * e - .4 * x, nostrilD:.25 * x, epaxial:.1 * e}); nbend(c, t, [[0, 0], [1100, 1], [1700, -.5], [2900, 0]], [-.008, -.008, -.006, 0, 0, 0], 100); }});
M.action('snort', {label:'Snort', group:'Breath', dur:1900, gait:true, f:(t, T, c, a) => {
  const p1 = pulse(t, 0, 80, 40, 260), p2 = pulse(t, 450, 80, 40, 280), p3 = .8 * pulse(t, 900, 80, 30, 300), s = p1 + p2 + p3;
  c.spec(T, {nostrilD:1.3 * s, levNaso:.4 * s, flank:.8 * s, intercostals:.9 * s, orbic:.3 * s, earBack:mid(.25 * s), throat:.3 * s, orbOris:.3 * s});
  c.jt('chest', .008 * s); nbend(c, t, [[0, 0], [100, 1], [400, 0], [550, 1], [1000, 0]], [.01, .012, .016, .02, .03, .04], 55, true);
  for(const [k, t0] of [[1, 90], [2, 540], [3, 980]]) if(t > t0 && !a['b' + k]){ a['b' + k] = 1; const p = c.wp('head', H(200, 6)); c.burstAt(p[0] + 8, p[1] + 10, 58, K.hexInt(K.ROSTER.bone), 'muzzle'); } }});
M.action('blow', {label:'Blow (flutter the lips)', group:'Breath', dur:2400, gait:true, f:(t, T, c) => { const e = env(t, 200, 1500, 600), w = .5 + .5 * sinc(t, .042); c.spec(T, {depLab:.9 * e * w, orbOris:.6 * e * (1 - w), nostrilD:.5 * e, intercostals:.6 * e, flank:.4 * e, digastric:.1 * e, levNaso:.2 * e * w}); c.jt('chest', .004 * e); }});
M.action('whinny', {label:'Whinny', group:'Voice', dur:4000, gait:true, f:(t, T, c, a) => {
  const inh = KS(t, [[0, 0], [650, 1], [1000, 0]]), e = env(t, 400, 1700, 900), hold = env(t, 600, 1400, 200), v = sinc(t, .052) * hold, A = c.shiftAmt();
  if(t > 1400 && !a.gl){ a.gl = 1; c.glyph(3200); }
  c.jt('chest', -.014 * e * A + .008 * inh); nbend(c, t, [[0, 0], [500, .5], [1200, 1], [2900, 1], [3800, 0]], [-.09 * A, -.09 * A, -.08 * A, -.05 * A, .02 * A, .16 * A], 80);
  c.spec(T, {digastric:.95 * e + .05 * v, depLab:.5 * e, levLab:.35 * e, levNaso:.5 * e, nostrilD:.9 * e + .5 * inh, orbic:.2 * e, earFwd:mid(.9 * e), earUp:mid(.4 * e), intercostals:1.1 * e + 1.1 * inh, flank:.9 * inh - .4 * e, throat:.7 * e + .25 * v, tongueOut:.25 * e, levPalp:.5 * e, neckArch:.5 * e, maneLift:.4 * e, levCaudae:.4 * e});
  c.flushT = Math.max(c.flushT, e); c.jd('head', .004 * v); }});
M.action('nicker', {label:'Nicker', group:'Voice', dur:2600, gait:true, f:(t, T, c) => { const e = env(t, 380, 1200, 700), v = .5 + .5 * sinc(t, .032), A = c.shiftAmt();
  nbend(c, t, [[0, 0], [500, 1], [1800, 1], [2500, 0]], [-.012 * A, -.012 * A, -.01 * A, -.006 * A, .01, .03], 90); c.spec(T, {digastric:.28 * e + .08 * e * v, depLab:.25 * e, nostrilD:.5 * e * (.6 + .4 * v), throat:.45 * e + .1 * e * v, intercostals:.6 * e, earFwd:mid(.7 * e), orbOris:.3 * e}); }});
// the mouth
M.action('lipFlap', {label:'Work the lips', group:'Mouth', dur:3400, gait:true, f:(t, T, c) => { const e = env(t, 300, 2500, 500), w = .5 + .5 * sinc(t, .0095, -1.2), w2 = .5 + .5 * sinc(t, .0095, .6); c.spec(T, {depLab:.7 * e * w, levNaso:.5 * e * w2, orbOris:.5 * e * (1 - w), nostrilD:.2 * e * w2, digastric:.1 * e * w2, zygo:.3 * e * w}); }});
M.action('flehmen', {label:'Flehmen (curl the lip)', group:'Mouth', dur:5200, f:(t, T, c) => { const e = KS(t, [[0, 0], [900, 1], [4200, 1], [5100, 0]]), A = c.shiftAmt();
  nbend(c, t, [[0, 0], [900, 1], [4200, 1], [5100, 0]], [-.06 * A, -.06 * A, -.05 * A, -.04 * A, -.02 * A, -.1 * A], 110); c.spec(T, {levLab:1.4 * e, levNaso:.9 * e, nostrilD:-.2 * e, digastric:.1 * e, depLab:.1 * e, orbic:.35 * e, earBack:mid(.3 * e), earOut:mid(.2 * e), neckArch:-.2 * e}); c.jt('chest', -.008 * e); }});
M.action('chew', {label:'Chew', group:'Mouth', dur:6400, in:['stand', 'doze', 'graze', 'alert'], f:(t, T, c) => { const ch = env(t, 600, 4800, 600), j = .5 + .5 * sinc(t, .0092, -1.6), x = sinc(t, .0046);
  c.spec(T, {digastric:.14 * ch * j, masseter:.15 * ch * (1 - j), pterygoid:pos(x) * .8 * ch, zygo:.12 * ch, earOut:mid(.15 * ch * (.5 + .5 * sinc(t, .0066))), orbic:.12 * ch}); }});
M.action('nibble', {label:'Nibble', group:'Mouth', dur:4200, gait:false, f:(t, T, c) => { const e = env(t, 400, 3000, 600), w = .5 + .5 * sinc(t, .011), A = c.shiftAmt();
  nbend(c, t, [[0, 0], [700, 1], [3500, 1], [4100, 0]], [.02 * A, .025 * A, .03 * A, .03 * A, .02, -.01], 90); c.jt('chest', .007 * e); c.spec(T, {orbOris:.8 * e * (1 - w), levNaso:.55 * e * w, depLab:.3 * e * w, nostrilD:.25 * e, earFwd:mid(.5 * e), digastric:.06 * e * w}); }});
M.action('yawn', {label:'Yawn', group:'Mouth', dur:3600, in:['stand', 'doze', 'lie', 'sit'], f:(t, T, c) => { const o2 = KS(t, [[0, 0], [700, .4], [1500, 1], [2300, 1], [3300, 0]]); c.spec(T, {digastric:1.1 * o2, orbic:1.2 * o2, earBack:mid(.5 * o2), throat:.4 * o2, levNaso:.4 * o2, nostrilD:.5 * o2, intercostals:.6 * o2, neckArch:-.3 * o2}); nbend(c, t, [[0, 0], [1500, 1], [3300, 0]], [-.02, -.02, -.02, -.01, 0, -.05], 110); }});
// head
M.action('toss', {label:'Toss the head', group:'Head', dur:2200, gait:true, f:(t, T, c) => { const a = [[0, 0], [260, -.7], [620, 1.2], [980, .2], [1700, 0]], m = KS(t, [[0, 0], [620, 0], [760, 1.1], [1400, 0]]);
  c.jd('chest', -.014 * KS(t, a)); nbend(c, t, a, [-.07, -.08, -.1, -.1, -.04, -.16], 55, true); c.jd('mane0', .1 * m * sinc(t, .03)); c.spec(T, {earBack:mid(.5 * pos(KS(t, a))), orbic:.3 * pos(KS(t, a)), throat:.25 * m, nostrilD:.5 * pos(KS(t, a)), maneLift:.5 * m}); }});
M.action('shakeHead', {label:'Shake the head', group:'Head', dur:2000, gait:true, f:(t, T, c) => { const e = env(t, 200, 900, 700), w = .026, q = sinc(t, w);
  c.jd('chest', .005 * e * sinc(t, w, -.4)); NKS.forEach((n, i) => c.jd(n, (.016 + .012 * i) * e * sinc(t - 55 * i, w, 0))); c.Q.yaw += .1 * e * sinc(t - 200, w);
  c.jd('earN', .3 * e * sinc(t, w * 1.2)); c.jd('earF', -.3 * e * sinc(t, w * 1.2, .8)); MANEB.forEach((m, i) => c.jd(m, .1 * e * sinc(t - 90 * i, w, 1))); c.jd('forelockB', .14 * e * sinc(t, w, 1.4)); c.spec(T, {orbic:.5 * e, earBack:mid(.3 * e)}); }});
M.action('sniff', {label:'Sniff', group:'Head', dur:5400, in:['stand', 'doze', 'graze', 'alert'], f:(t, T, c) => { const lo = KS(t, [[0, 0], [800, 1], [4000, 1], [5000, 0]]), sn = lo * (.5 + .5 * sinc(t, .021)), A = c.shiftAmt();
  nbend(c, t, [[0, 0], [800, 1], [4000, 1], [5000, 0]], [.05 * A, .05 * A, .045 * A, .04 * A, .03, -.02], 100); c.Q.yaw += .12 * sinc(t, .0016) * lo; c.jt('chest', .007 * lo); c.spec(T, {nostrilD:.8 * sn, levNaso:.3 * sn, levPalp:.15 * lo, earFwd:mid(.4 * lo), intercostals:.4 * sn}); }});
M.action('nuzzle', {label:'Nuzzle', group:'Head', dur:5000, in:['stand', 'alert'], f:(t, T, c) => { const lo = KS(t, [[0, 0], [900, 1], [4000, 1], [4900, 0]]), w = .5 + .5 * sinc(t, .0105), A = c.shiftAmt();
  nbend(c, t, [[0, 0], [900, 1], [4000, 1], [4900, 0]], [.07 * A, .08 * A, .09 * A, .09 * A, .06, -.04], 100); c.Q.yaw += .08 * lo; c.spec(T, {orbOris:.6 * lo * w, levNaso:.4 * lo * (1 - w), nostrilD:.5 * lo * (.5 + .5 * sinc(t, .021)), earFwd:mid(.5 * lo), depLab:.2 * lo * w, laom:.3 * lo, orbic:.15 * lo}); }});
// body
M.action('shake', {label:'Shake all over', group:'Body', dur:2600, big:true, in:['stand', 'alert'], f:(t, T, c) => {
  const e = d => env(t - d, 150, 1000, 800), ph = k => sinc(t, .03, -k), pre = KS(t, [[0, 0], [300, 1], [650, 0]]);
  c.rootAbout([450, 400], 0, 0, 7 * e(0) + 6 * pre); c.jd('chest', .018 * e(0) * ph(0)); c.jd('pelvis', .02 * e(200) * ph(2.4));
  NKS.forEach((n, i) => c.jd(n, (.02 + .012 * i) * e(40 * i) * ph(.5 + .5 * i))); TAILB.forEach((n, i) => c.jd(n, .1 * e(300 + 40 * i) * ph(4 + i))); MANEB.forEach((n, i) => c.jd(n, .16 * e(80 * i) * ph(1 + i)));
  c.spec(T, {orbic:.7 * e(0), earBack:mid(.6 * e(30)), intercostals:.4 * e(100), maneLift:.5 * e(80)});
  }});
M.action('swish', {label:'Swish the tail', group:'Body', dur:3400, gait:true, f:(t, T, c) => { const e = KS(t, [[0, 0], [500, 1], [2700, 1], [3400, 0]]);
  c.chainWave('tail', {amp:.0042 * e, lam:300, phase:-t * .0075, env:1, direct:true}); c.jd('tailTip', .2 * e * sinc(t - 800, .0034, .9)); c.spec(T, {levCaudae:.12 * e, flexCaudae:.15 * e}); }});
M.action('twitch', {label:'Twitch the skin', group:'Body', dur:1600, tiny:true, gait:true, f:(t, T, c, a) => {
  c.spec(T, {panniculusA:pulse(t, 0, 50, 30, 220) * 1.2, panniculusB:pulse(t, 110, 50, 30, 220) * 1.2, panniculusC:pulse(t, 220, 50, 30, 240) * 1.2, panniculusD:pulse(t, 330, 50, 30, 240) * 1.2});
  a.x = a.x ?? 340 + c.rand() * 220; for(const [k, t0, dx] of [[1, 0, 80], [2, 110, 0], [3, 220, -80], [4, 330, -160]]) if(t >= t0 && !a['t' + k]){ a['t' + k] = 1; const p = c.wp('chest', [a.x + dx, 396]); c.burstAt(p[0], p[1], 36, K.mixInt(K.hexInt(K.ROSTER.bone), c.C.ink, .2)); } }});
M.action('stamp', {label:'Stamp a hoof', group:'Body', dur:1600, in:['stand', 'alert'], f:(t, T, c, a) => { const k = a.leg ?? (a.leg = c.rand() < .5 ? 2 : 0), e = KS(t, [[0, 0], [160, 1], [400, 1], [520, 0]]), f = c.foot(k);
  const lift = pulse(t, 100, 160, 90, 200) * 36, tap = pulse(t, 620, 60, 10, 90) * 22, tilt = (k === 0 ? .5 : .45) * (pulse(t, 100, 160, 90, 200) + .5 * pulse(t, 620, 60, 10, 90));
  c.legTo(k, f[0] - 4 * e, f[1] - lift - tap, f[2] + tilt * (k === 0 ? 1 : -1), 1, 1, {kk:16}); c.rootAbout(PIV, 0, 0, 3 * e * c.shiftAmt()); c.jt('chest', -.004 * e);
  const pk = k === 0 ? 'pastFN' : 'pastHN'; c.jd(pk, .5 * pulse(t, 100, 160, 90, 200)); }});
M.action('paw', {label:'Paw the ground', group:'Display', dur:6200, big:true, in:['stand', 'alert', 'graze'], f:(t, T, c, a) => {
  const e = KS(t, [[0, 0], [500, 1], [5600, 1], [6100, 0]]), A = c.shiftAmt(), u = KS(t, [[0, 0], [700, 0], [1100, 1], [5200, 1], [5900, 0]]), cyc = clamp((t - 900) / 1100, 0, 4.4), p = cyc - Math.floor(cyc);
  const sw = clamp(p / .34), sc = clamp((p - .34) / .44), f = c.foot(0), dx = (cyc >= 4.4 || cyc <= 0) ? -30 : sw < 1 ? -30 + 76 * KS(sw, [[0, 0], [1, 1]]) : 46 - 76 * KS(sc, [[0, 0], [1, 1]]);
  const dy = (sw < 1 && cyc > 0 && cyc < 4.4) ? -56 * Math.sin(Math.PI * sw) : 0, db = (sw < 1 && cyc > 0 && cyc < 4.4) ? .7 * Math.sin(Math.PI * sw) : (sc < 1 ? -.12 : 0);
  c.legTo(0, f[0] + dx, f[1] + dy, f[2] + db, u, u, {kk:13}); c.jd('pastFN', .6 * (sw < 1 && cyc > 0 && cyc < 4.4 ? Math.sin(Math.PI * sw) : 0));
  c.rootAbout(PIV, -.004 * e * A, -6 * e * A, 2.5 * e * A + 1.6 * Math.sin(p * Math.PI * 2) * u); c.jt('chest', .01 * e); nbend(c, t, [[0, 0], [700, 1], [5500, 1], [6100, 0]], [.014 * A, .014 * A, .012 * A, .01 * A, .006, 0], 90);
  c.spec(T, {nostrilD:.45 * e + .3 * pulse(t, 600, 80, 40, 300), earBack:mid(.2 * e), levCaudae:.25 * e, intercostals:.5 * e}); }});
M.action('buck', {label:'Buck', group:'Display', dur:3000, big:true, in:['stand', 'alert'], f:(t, T, c, a) => {
  const g = KS(t, [[0, 0], [380, 1], [700, .15], [1100, 1.1], [1500, .1], [2100, 0]]), pre = KS(t, [[0, 0], [380, 1], [3000, 1]]), k = pos(g), A = c.shiftAmt();
  c.rootAbout([620, 740], .3 * k * A, 0, -10 * k * A); c.jt('chest', .04 * k); nbend(c, t, [[0, 0], [380, 1], [700, .1], [1100, 1], [1500, 0]], [.07, .08, .08, .08, .07, -.2], 60); 
  for(const q of [2, 3]){ const f = c.foot(q), kick = KS(t, [[0, 0], [380, 0], [560, 1], [720, 0], [1000, 0], [1260, 1], [1420, 0], [2000, 0]]); c.legTo(q, f[0] - 62 * kick, f[1] - 96 * kick * pre, f[2] - .6 * kick, 1, 1, {kk:16}); }
  c.jd('pastHN', .6 * KS(t, [[0, 0], [560, 1], [720, 0], [1260, 1], [1420, 0]])); c.jd('pastHF', .6 * KS(t, [[0, 0], [560, 1], [720, 0], [1260, 1], [1420, 0]]));
  c.spec(T, {earBack:mid(.8 * k), orbic:.5 * k, nostrilD:.8 * k, intercostals:.7 * k, levCaudae:.6 * k, maneLift:.6 * k}); c.flushT = Math.max(c.flushT, .4 * k); }});
M.action('crop', {label:'Crop the grass', group:'Body', dur:5200, in:['graze'], f:(t, T, c) => { const e = env(t, 500, 4000, 600), bt = .5 + .5 * sinc(t, .0042, -1.2), ch = .5 + .5 * sinc(t, .0094), A = c.shiftAmt();
  nbend(c, t, [[0, 0], [700, 1], [4400, 1], [5100, 0]], [.02, .02, .02, .02, .02, .06], 80); c.jd('neck3', .045 * e * bt); c.jd('head', -.05 * e * bt); c.spec(T, {orbOris:.6 * e * bt, levNaso:.5 * e * bt, digastric:.12 * e * ch, masseter:.1 * e * (1 - ch), pterygoid:.5 * e * pos(sinc(t, .0047)), earOut:mid(.25 * e), earFwd:mid(.25 * e * bt)}); }});
M.action('restHind', {label:'Rest a hind leg', group:'Body', dur:14000, in:['stand'], f:(t, T, c, a) => { const e = KS(t, [[0, 0], [1800, 1], [12000, 1], [13800, 0]]), f = c.foot(a.leg ?? (a.leg = c.rand() < .5 ? 2 : 3));
  c.legTo(a.leg, f[0] - 14 * e, f[1] - 14 * e, f[2] + .16 * e, 1, 1, {kk:7}); c.rootAbout(PIV, .006 * e, 0, 4 * e); c.jt('pelvis', .02 * e); c.jd(a.leg === 2 ? 'pastHN' : 'pastHF', .55 * e); c.spec(T, {orbic:.2 * e, earOut:mid(.2 * e)}); }});

/* ---------- pads ---------- */
const ga = (c, id, s = 0) => c.act(id, s);
M.pad('jaw', {label:'Jaw', group:'Head', x:['still', 'grind'], y:['shut', 'open'], map:(x, y) => ({digastric:pos(y), masseter:.7 * pos(-y), temporalis:.5 * pos(-y), pterygoid:pos(x)}), ghost:c => [cl(ga(c, 'pterygoid')), cl(ga(c, 'digastric') - ga(c, 'masseter'))]});
M.pad('lips', {label:'Lips · nostrils', group:'Head', x:['purse', 'flare'], y:['droop', 'curl'], map:(x, y) => ({orbOris:pos(-x), nostrilD:pos(x), levNaso:.5 * pos(x) + .3 * pos(y), depLab:pos(-y), levLab:pos(y), zygo:.3 * pos(-y)}), ghost:c => [cl(ga(c, 'nostrilD') - ga(c, 'orbOris')), cl(ga(c, 'levLab') - ga(c, 'depLab'))]});
M.pad('eyes', {label:'Eyes · brow', group:'Head', x:['squint', 'wide'], y:['calm', 'worried'], map:(x, y) => ({orbic:pos(-x), levPalp:pos(x), laom:pos(y)}), ghost:c => [cl(ga(c, 'levPalp') - ga(c, 'orbic')), cl(ga(c, 'laom'))]});
M.pad('gaze', {label:'Gaze', group:'Head', x:['back', 'forward'], y:['down', 'up'], map:(x, y) => ({lookF:pos(x), lookB:pos(-x), lookU:pos(y), lookD:pos(-y)}), ghost:c => [cl(ga(c, 'lookF') - ga(c, 'lookB')), cl(ga(c, 'lookU') - ga(c, 'lookD'))]});
M.pad('ears', {label:'Ears', group:'Head', split:'NF', x:['back', 'forward'], y:['out', 'perk'], map:(x, y) => ({earBack:pos(-x), earFwd:pos(x), earUp:pos(y), earOut:pos(-y)}), ghost:(c, s) => [cl(ga(c, 'earFwd', s) - ga(c, 'earBack', s)), cl(ga(c, 'earUp', s) - ga(c, 'earOut', s))]});
M.pad('head', {label:'Head · neck', group:'Head', x:['turn away', 'turn to'], y:['lower', 'raise'], map:(x, y) => ({splenius:x, neckUp:pos(y), neckDown:pos(-y)}), ghost:c => [cl(ga(c, 'splenius')), cl(-(c.jr[c.d.BI.neck0] + c.jr[c.d.BI.neck2]) / .2)]});   // raising and lowering the head is the neck extensors' and flexors' own work now (it was a joint channel beside them, so they never lit): their gains are the channel's
M.pad('arch', {label:'Neck arch', group:'Head', x:['stretch', 'arch'], y:['soft', 'tense'], map:(x, y) => ({neckArch:pos(x) + .3 * pos(y), neckDown:.4 * pos(-x), throat:.3 * pos(y)}), fx:(c, x, y) => { if(x < 0){ c.jt('head', -.12 * -x); NECK.forEach(n => c.jt(n, .02 * -x)); } }, ghost:c => [cl(ga(c, 'neckArch') - ga(c, 'neckDown')), cl(ga(c, 'throat'))]});
M.pad('mane', {label:'Mane · forelock', group:'Head', x:['sleek', 'lift'], y:['still', 'ripple'], map:x => ({maneLift:pos(x)}), fx:(c, x, y) => { c.rippleRate = pos(y); }, ghost:c => [cl(ga(c, 'maneLift')), cl(c.rippleRate)]});
M.pad('spine', {label:'Spine', group:'Body', x:['hollow', 'arch'], y:['crouch', 'rise'], map:x => ({epaxial:pos(-x), hypaxial:pos(x)}), fx:(c, x, y) => { c.Q.ry += 20 * pos(-y) - 3 * pos(y); c.jt('chest', -.05 * y); }, ghost:c => [cl(ga(c, 'hypaxial') - ga(c, 'epaxial')), cl(-c.root.y / 30)]});
M.pad('breath', {label:'Breath', group:'Body', x:['shallow', 'deep'], y:['slow', 'fast'], fx:(c, x, y) => { c.breath.depth = 2 ** (x * 1.4); c.breath.rate = 2 ** (y * 1.2); }, alwaysFx:false, ghost:c => [cl(Math.log2(c.breath.depth) / 1.4), cl(Math.log2(c.breath.rate) / 1.2)]});
M.pad('skin', {label:'Skin · panniculus', group:'Body', x:['rest', 'twitch'], y:['still', 'ripple'], map:x => ({panniculusA:pos(x), panniculusB:pos(x) * .8, panniculusC:pos(x) * .8, panniculusD:pos(x)}), fx:(c, x, y) => { const s = pos(y); c.spec(c.Ta, {panniculusA:.6 * s * (.5 + .5 * sinc(c.t, .012)), panniculusB:.6 * s * (.5 + .5 * sinc(c.t, .012, 1.1)), panniculusC:.6 * s * (.5 + .5 * sinc(c.t, .012, 2.2)), panniculusD:.6 * s * (.5 + .5 * sinc(c.t, .012, 3.3))}); }, ghost:c => [cl(ga(c, 'panniculusA')), cl(ga(c, 'panniculusB'))]});
M.pad('foreleg', {label:'Foreleg', group:'Limbs', split:'NF', leg:'fore', x:['back', 'reach'], y:['flex', 'extend'], map:(x, y) => ({deltoid:pos(x), latissimus:pos(-x), supraspinatus:.4 * pos(x), pectoral:.4 * pos(-x), brachialis:pos(-y), flexCarpi:.7 * pos(-y), sdf:.6 * pos(-y), fdp:.4 * pos(-y), triceps:pos(y), extCarpi:.5 * pos(y), cde:.4 * pos(y)})});
M.pad('hindleg', {label:'Hindleg', group:'Limbs', split:'NF', leg:'hind', x:['drive', 'swing'], y:['flex', 'extend'], map:(x, y) => ({glutes:pos(-x), gastroc:.5 * pos(-x) + .4 * pos(y), hipFlex:pos(x), tfl:.5 * pos(x), hamstrings:pos(-y), tibialis:.7 * pos(-y), sdfH:.6 * pos(-y), fdpH:.4 * pos(-y), quads:pos(y), cdeH:.4 * pos(y)})});
M.pad('tail', {label:'Tail', group:'Limbs', x:['clamp', 'lift'], y:['hang', 'swish'], map:x => ({depCaudae:pos(-x), levCaudae:pos(x)}), fx:(c, x, y) => { const s = pos(y); if(s > .02) c.chainWave('tail', {amp:.0042 * s, lam:300, phase:-c.t * .0075, direct:true}); }, ghost:c => [cl(ga(c, 'levCaudae') - ga(c, 'depCaudae')), cl(ga(c, 'flexCaudae'))]});

/* ---------- hooks: idle, what each posture holds, the gaits' body, the glyph's path, life ---------- */
const frac = x => x - Math.floor(x);
if(o.extras) o.extras({M, K, H, hv, HP, HJ, HR, HS, NECK, MANEB, TAILB, NC, TC, CREST, J, FAR, lock, polyAt, polyLen, spline, hz, zh, hl, KS, sinc, mid, nbend, hm, PIV, feet, nk, LOWER, RAISE});
/* the big muscles' creases are quieter: on the large cells a crease at full strength reads as a pale facet that stays for as long as the posture holds */
for(const d of Object.values(M.defs)) if(d.shade && ['spine', 'skin', 'foreleg', 'hindleg', 'neck', 'tail'].includes(d.g)){ const f = d.shade; d.shade = (x, y) => f(x, y) * .42; }
const hooks = {
  /* the anatomy audit reads these as deliberate: horn, beardA and beardB are the unicorn's attachment bones (nothing hangs on them in the horse); the forelock's roots grow from the head and stream on a follower;
     the flank fold and the elbow pocket are skin lines of the trunk that stay with it while the leg passes under them */
  audit:{allow:{emptyBones:['^(horn|beardA|beardB)$'], deadParts:['^forelock\\d$', '^(flankFold|elbowPocket)$'], fibres:['^flank$']}},   // (the flank's field reaches the thigh's parts too: its hip root is the pelvis)
  strideMax:250,
  idle(c, now, Ti){
    /* the breath is the only continuous motion in the trunk: about 12 a minute, deeper when asked. Everything else at rest is a bout (a goal that eases to a new target and holds) or a slow postural drift, one region at a time. */
    const br = .5 + .5 * Math.sin(now * .00126 * c.breath.rate + 1), d = c.breath.depth;
    c.spec(Ti, {intercostals:(.16 + .44 * br) * d, flank:(.1 + .34 * br) * d, nostrilD:.05 + .12 * br * d, earFwd:[.04 + .04 * Math.sin(now * .0005 + 2), .04 + .04 * Math.sin(now * .00053 + 4)]});
    if(!c.gs.on){
      const G = (key, range, amp, ms) => { if(c.every(key, range, now)) c.goal(key, (c.rand() * 2 - 1) * amp, ms[0] + c.rand() * (ms[1] - ms[0]), now); return c.goalAt(key, now); };
      const tc = G('tn.chest', [3500, 8000], .012, [3000, 5500]), tp = G('tn.pelvis', [4500, 9500], .01, [3500, 6000]), th = G('tn.head', [2600, 6500], 1, [2200, 4200]), tt = G('tn.tail', [2200, 5500], 1, [1800, 3800]);
      c.jt('chest', tc); c.jt('pelvis', tp);
      NKS.forEach((n, i) => { const v = c.goalAt('tn.head', now - 85 * i); c.jt(n, v * (i === 5 ? .02 : [.008, .01, .012, .012, .01][i] || 0)); });   // the head's drift runs out from the root of the neck
      TAILB.forEach((n, i) => c.jt(n, c.goalAt('tn.tail', now - 120 * i) * .028));
      c.rootAbout(PIV, G('tn.root', [4000, 9000], .004, [3500, 6500]), 0, 0);
      c.spec(Ti, {earBack:[pos(G('tn.eN', [2500, 7000], .22, [800, 1600])), pos(G('tn.eF', [2800, 7600], .22, [800, 1600]))], earOut:[pos(-c.goalAt('tn.eN', now)) * .5, pos(-c.goalAt('tn.eF', now)) * .5]});
    }
    for(const i of [0, 1, 2, 3, 4]) c.jd(MANEB[i], .014 * Math.sin(now * .0009 + i));
    if(c.every('blink', [2400, 6200], now)) c.actions.push({name:'blink', t0:now});
    if(c.every('ear', [5000, 12000], now)) c.actions.push({name:'ear', t0:now});
    if(c.every('twitch', [9000, 20000], now) && !c.gs.on) c.actions.push({name:'twitch', t0:now});
  },
  postureHold(c, w, Ta){
    const rest = w.lie + .5 * w.kneel + .4 * w.sit;
    c.spec(Ta, {intercostals:.3 * rest + .5 * w.doze + .95 * w.rear + .15 * w.alert, flank:.15 * w.lie, orbic:.5 * w.doze + .25 * w.lie + .35 * w.rear, levPalp:-.2 * w.doze + .4 * w.alert, earOut:mid(.65 * w.doze + .15 * w.lie), earFwd:mid(.9 * w.alert + .3 * w.graze + .3 * w.kneel), earBack:mid(.5 * w.rear),
      earUp:mid(.3 * w.alert), nostrilD:.6 * w.alert + .6 * w.rear + .2 * w.graze, depLab:.35 * w.doze, levNaso:.15 * w.alert + .15 * w.graze, laom:.25 * w.alert + .3 * w.rear, levCaudae:.3 * w.alert + .5 * w.rear + .1 * w.graze, depCaudae:.25 * w.lie + .2 * w.kneel,
      neckArch:.5 * w.alert + .5 * w.rear, maneLift:.15 * w.alert + .4 * w.rear, hypaxial:.1 * w.lie, epaxial:.3 * w.rear + .1 * w.alert, throat:.2 * w.alert, dilator:.4 * w.alert + .3 * w.rear});
  },
  gaitBody(c, G, k, ph, mk){
    /* the head and neck rock with the gait: twice a stride at the walk and the trot (a nod with each forefoot), once a stride at the canter and the gallop (down on the leading fore, up in the suspension); each bone of the neck
       a little after the one before it, so the movement runs out from the body. The back flexes and extends once a stride in the canter and gallop. The tail and mane stream. */
    const q = fSmooth(.46, .4, G.duty), u0 = frac(ph + G.off[0]), arg = 2 * Math.PI * (u0 - G.duty / 2), amp = keys(G.duty, [[.3, .05], [.4, .032], [.45, .008], [.68, .02]]) * k * mk, gal = fSmooth(.4, .3, G.duty), W = Math.PI * 2;
    NKS.forEach((n, i) => { const b = q * Math.cos(arg - .38 * i) + (1 - q) * Math.cos(2 * arg - .38 * i); c.jd(n, amp * [.7, .8, 1, 1.1, 1.3, 1.6][i] * b); });
    c.jt('chest', k * mk * (.045 * (q * Math.sin(W * ph + .2) + (1 - q) * .5 * Math.sin(2 * W * ph + .2)) * (1 + .5 * gal)));
    c.jt('pelvis', -k * mk * (.045 * (q * Math.sin(W * ph + 2.9) + (1 - q) * .5 * Math.sin(2 * W * ph + 1.4)) * (1 + .5 * gal)));
    if(c.gait){ const air = !c.gait.stance.some(Boolean); c.gA = (c.gA || 0) + ((air ? 1 : 0) - (c.gA || 0)) * .22; c.Q.by -= (q * 30 * (.5 + .9 * gal)) * c.gA * k; }
    const hoofA = [0, 0, 0, 0];
    for(let j = 0; j < 4; j++){ const L = c.gs.legs[j]; if(!L || (c.gait && c.gait.stance[j])) continue; const sn = Math.sin(Math.PI * L.p), fore = j < 2, side = j % 2 ? 'F' : 'N'; c.jd((fore ? 'pastF' : 'pastH') + side, (fore ? 1.15 : .95) * sn * k * Math.sqrt(mk)); hoofA[j] = .44 * sn * k; }   // the hoof closes through the deep flexor (.35 rad at .44 of its .8)
    c.spec(c.Ta, {fdp:[hoofA[0], hoofA[1]], fdpH:[hoofA[2], hoofA[3]]});
    /* the gallop stretches: the nose goes down a little, the neck reaches forward and the head comes down with it */
    c.Q.rr += .022 * gal * k; NECK.forEach(n => c.jt(n, .03 * gal * k)); c.jt('head', -.1 * gal * k);
    const sp = (1 - G.duty);
    c.spec(c.Ta, {levCaudae:(.1 + .45 * sp) * k * (1 + Math.sin(W * ph * (1 + q) + 1)), maneLift:.25 * k * sp, intercostals:.2 * k + .7 * k * gal, flank:.2 * k + .5 * k * gal, nostrilD:(.15 + .7 * gal) * k, neckArch:.3 * k * gal, earBack:mid(.35 * gal * k)});
    if(gal > .2) c.spec(c.Ta, {orbic:.25 * gal * k});
  },
  post(c, rot, sx, sy, now, dt){
    for(const s of [0, 1]){ const e = pos(c.act('earOut', s)); if(e > .01) c.scale(s ? 'earF' : 'earN', 1 - .42 * e, 1 + .12 * e); }
  },
  glyph:(x, y, P) => P.tags.has('glyph') ? [dorsS(x, y), 1] : null,
  ripple:{tag:'mane', centre:[700, 270], a0:.9},
  shiftOf:{lie:.95, kneel:.9, sit:.9, rear:.9, graze:.7, doze:.8},
  life:{rate:1.8,
    small:[['glance', 3.2, 5000, ['stand', 'alert', 'graze', 'doze'], {doze:1}], ['ear', 4, 2500], ['slowblink', 1.5, 9000], ['listen', 1.4, 12000, ['stand', 'alert', 'graze'], {alert:3}], ['swish', 2.4, 6000], ['twitch', 2.4, 5000], ['sigh', 1.6, 9000], ['snort', 1.1, 10000, ['stand', 'alert', 'graze'], {alert:2.4}],
      ['blow', .8, 14000, ['stand', 'doze', 'graze']], ['nod', .6, 14000, ['stand', 'alert']], ['toss', .55, 18000, ['stand', 'alert']], ['shakeHead', .6, 16000, ['stand', 'alert', 'graze']], ['lipFlap', 1.2, 10000, ['stand', 'doze', 'lie', 'graze'], {doze:3}],
      ['chew', 1.1, 14000, ['stand', 'doze', 'graze']], ['sniff', .6, 20000, ['stand', 'graze']], ['flehmen', .22, 50000, ['stand', 'alert']], ['stamp', .8, 12000, ['stand', 'alert']], ['paw', .3, 40000, ['stand', 'alert', 'graze']], ['whinny', .3, 40000, ['alert', 'stand'], {alert:1}], ['nicker', .3, 30000, ['stand', 'alert']],
      ['shake', .3, 60000, ['stand']], ['buck', .1, 90000, ['stand', 'alert']], ['crop', 3.2, 9000, ['graze']], ['nibble', .6, 20000, ['stand', 'graze']], ['nuzzle', .2, 60000, ['stand']], ['raise', .9, 14000, ['stand', 'graze', 'doze']], ['restHind', .7, 36000, ['stand']], ['yawn', .3, 70000, ['stand', 'doze', 'lie']], ['glyph', 1.3, 12000]],
    moves:[['go:alert', .8, 20000, ['stand', 'graze']], ['go:graze', 1.1, 26000, ['stand']], ['go:doze', .9, 30000, ['stand']], ['go:lie', .45, 50000, ['stand', 'doze']], ['go:stand', 1.4, 0, ['lie', 'kneel', 'sit', 'rear', 'alert', 'graze', 'doze']], ['walk', .9, 22000, ['stand']], ['trot', .5, 36000, ['stand']], ['canter', .3, 50000, ['stand']], ['gallop', .18, 70000, ['stand']], ['go:rear', .16, 90000, ['stand', 'alert']], ['go:stand', 1, 0, ['kneel', 'sit']]],
    dwell:{stand:[4000, 9000], alert:[3500, 6500], doze:[9000, 20000], graze:[8000, 16000], lie:[12000, 26000], kneel:[600, 1200], sit:[600, 1200], rear:[2400, 4000]},
    gait:[['glance', 3, 5000], ['ear', 3.5, 3000], ['swish', 2, 6000], ['snort', 1.4, 8000], ['shakeHead', .6, 14000], ['twitch', 2, 5000], ['toss', .6, 16000], ['whinny', .15, 70000], ['blow', .6, 14000]], gaitFor:{walk:[3500, 7500], trot:[3000, 5500], canter:[2800, 5000], gallop:[2200, 4000]}},
};
if(o.tune) o.tune({M, hooks, K});
return K.define(M.finish(hooks));
}
window.CreatureHorse = {build};
build({id:'horse'});
})();
