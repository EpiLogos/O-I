/* creature-bull.js — the BULL, Taurus ♉, on creature-kit.js. Read CREATURE-SPEC.md and CREATURE-NOTES-BULL.md (the research note first).
   A bull statant guardant: the body in profile, facing right, the head turned full to the viewer so both horns, both eyes and the whole face read.
   The sign is the anatomy: the horns are the crescent (gold inlay along both horns and across the brow between their bases), and a gold ring on the
   forehead sits in the crescent's cup, so the circle and the arc of ♉ lie on the face itself. The travelling light traces the crescent from the left
   horn's tip, over the brow, up to the right horn's tip, then round the ring.
   Ink: Malachite (sensation, the body). Accent: Amber, for the eye. Everything else is additive and transient. */
(() => {
'use strict';
const K = window.CreatureKit, M = K.model({id:'bull', name:'Bull', sign:'♉', title:'BULL', sub:'Taurus · the first aion, the law of the herd',
  w:1000, h:780, groundY:740, pivot:[262, 400], axis:808, yawC:808, ink:K.ROSTER.malachite, accent:K.ROSTER.amber, far:{foreleg:[46, -4], hindleg:[52, -4]}, cam:[1.05, 528, 400]});
const {chaikin, ringPts, clamp, fSmooth, env, pulse, keys, ramp, hash, gauss} = K, pos = v => Math.max(0, v), cl = v => Math.max(-1, Math.min(1, v));

/* ---------- the head's frame: units are canvas units, origin the face's centre, u right, v down ---------- */
const HC = [808, 412], HS = 1.18;
const hw = ([u, v]) => [HC[0] + HS * u, HC[1] + HS * v];
const mr = P => P.map(([x, y]) => [2 * HC[0] - x, y]).reverse();
const sym = half => half.map(p => [p[0], p[1]]).concat(half.slice().reverse().filter(p => p[0] !== 0).map(([x, y]) => [-x, y]));
const hz = (u, v) => 76 * Math.sqrt(Math.max(0, 1 - (u / 96) ** 2 - ((v - 4) / 132) ** 2));
const zh = (off = 0, extra) => (x, y) => { const u = (x - HC[0]) / HS, v = (y - HC[1]) / HS; return HS * (hz(u, v) + off + (extra ? extra(u, v) : 0)); };
const H = (u, v) => hw([u, v]);

/* ---------- skeleton ---------- */
M.bone('body', null, [400, 385], [401, 385], {grp:'root'});
M.bone('pelvis', 'body', [400, 385], [226, 372], {grp:'rear', lim:[-.42, .42], speed:5.5});
M.bone('chest', 'body', [400, 385], [620, 372], {grp:'front', lim:[-.46, .46], speed:6});
M.bone('hump', 'chest', [545, 336], [545, 292], {grp:'front', lim:[-.14, .14], sec:true, speed:10});
M.bone('neck', 'chest', [612, 374], [768, 390], {grp:'head', lim:[-.8, 1.05], sec:true, mot:true, speed:7.5});
M.bone('head', 'neck', [768, 390], [812, 452], {grp:'head', lim:[-.7, .7], sec:true, mot:true, speed:9.5});
M.bone('jaw', 'head', [808, 488], [808, 540], {grp:'head', ylim:[-3, 38], sec:true, speed:14});
M.bone('earR', 'head', H(62, -72), H(140, -75), {grp:'head', lim:[-1.1, 1.1], sec:true, speed:14});
M.bone('earL', 'head', H(-62, -72), H(-140, -75), {grp:'head', lim:[-1.1, 1.1], sec:true, speed:14});
M.bone('dewA', 'neck', [730, 462], [708, 510], {grp:'head', lim:[-.55, .55], sec:true, speed:6});
M.bone('dewB', 'dewA', [708, 510], [688, 552], {grp:'head', lim:[-.6, .6], sec:true, speed:6});
const TJ = [[198, 352], [188, 394], [180, 448], [174, 506], [171, 565], [171, 615]];
for(let k = 0; k < 5; k++) M.bone('tail' + k, k ? 'tail' + (k - 1) : 'pelvis', TJ[k], TJ[k + 1], {grp:'tail', lim:k ? [-2, 2] : [-2.6, 2.6], sec:true, speed:2.6, windRoot:k === 0, wind:k > 0});
M.bone('tuftB', 'tail4', TJ[5], [172, 692], {grp:'tail', lim:[-1.2, 1.2], sec:true, speed:6});
M.follower('tuftB', {k:3.2, w:11, z:.5, gain:.7});
M.follower('dewB', {k:3.4, w:9, z:.42, gain:.85, lim:.55, flutter:.02});
M.follower('hump', {k:4.5, w:12, z:.55, gain:.45, lim:.1, flutter:0});
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
   Layers: far legs 1; tail 3; torso, ribs, scapula 4; near legs, hump, hooves 5; shoulder and haunch rosettes, dewlap 6; neck 7; ears and horns 8; the face's cells 9;
   the mouth's inside and teeth 10; muzzle, jaw, bridge 11; nostrils, eyes 12; pupils 13; lids 14; the glyph 15. The silhouette is drawn under layer 2 and up. */
const FORE = [[598, 418, 64, 60], [596, 476, 58, 54], [593, 536, 46, 44], [598, 592, 36, 34], [603, 648, 27, 26], [607, 690, 19, 19], [612, 716, 20, 21], [620, 731, 21, 24]];
const HIND = [[264, 408, 72, 76], [286, 452, 68, 66], [316, 498, 54, 46], [296, 548, 42, 38], [262, 612, 38, 28], [266, 662, 20, 20], [273, 706, 18, 18], [280, 726, 20, 22]];
const shiftSt = (S, o) => S.map(q => [q[0] + o[0], q[1] + o[1], q[2], q[3]]);
function hoof(id, kind, side, o){
  const bone = kind === 'fore' ? 'hand' + side : 'foot' + side, toe = kind === 'fore' ? 'toeF' + side : 'toeH' + side, tip = M.bones[M.BI[bone]].q, X = tip[0], Y = tip[1], at = pts => pts.map(([x, y]) => [X + x, Y + y]);
  const base = {layer:o.layer, dim:o.dim, bind:{rigid:toe}, tier:'F', zone:'paws', tags:[kind, side === 'F' ? 'F' : 'N', 'paw'], line:o.dim ? 'far' : 'feature'};
  M.zone('hoofA' + id, chaikin(at([[-22, -18], [4, -23], [6, -23], [6, 5], [-24, 5], [-29, -6]]), 1), {...base, h:11, tone:.3});
  M.zone('hoofB' + id, chaikin(at([[6, -23], [28, -17], [40, -4], [42, 5], [6, 5]]), 1), {...base, h:11, tone:.3});
  M.shape('dew' + id, at([[-24, -22], [-34, -14], [-27, -8]]), {...base, tone:.9});
}
const legParts = (kind, side, S, far) => {
  const names = kind === 'fore' ? ['hum', 'rad', 'hand'] : ['fem', 'tib', 'foot'], b = {chain:names.map(n => n + side), sigma:22}, id = (kind === 'fore' ? 'F' : 'H') + side;
  const cm = {layer:far ? 1 : 5, dim:far, line:far ? 'far' : 'region', bind:b, tags:[kind, side === 'F' ? 'F' : 'N', 'leg'], tj:.03, h:far ? 40 : 26, tier:'M'};
  M.limb((kind === 'fore' ? 'foreU' : 'thigh') + side, S, {...cm, range:[0, 2]}); M.limb((kind === 'fore' ? 'foreL' : 'shin') + side, S, {...cm, range:[2, 4]});
  M.limb((kind === 'fore' ? 'cannonF' : 'cannonH') + side, S, {...cm, range:[4, 7], h:far ? 30 : 17, tier:'F'});
  hoof(id, kind, side, {layer:far ? 1 : 5, dim:far});
};
legParts('fore', 'F', shiftSt(FORE, FAR.fore), true); legParts('hind', 'F', shiftSt(HIND, FAR.hind), true);
/* the tail hangs from the tailhead to the hock with a switch of hair; behind the body */
M.limb('tail', TJ.map(([x, y], i) => [x, y, 9.5 - i * .6, 9.5 - i * .6]), {layer:3, tier:'M', h:16, cols:1, bind:{chain:['tail0', 'tail1', 'tail2', 'tail3', 'tail4'], sigma:20}, tags:['tail'], line:'region'});
{ const E = TJ[5], sh = [[-6, 2], [-13, 16], [-17, 40], [-12, 68], [-3, 92], [6, 70], [13, 42], [15, 16], [7, 2]].map(([x, y]) => [E[0] + x, E[1] + y]);
  M.zone('tuft', chaikin(sh, 2), {layer:3, tier:'F', h:11, inset:.4, tags:['tail', 'tuft'], bind:{rigid:'tuftB'}, line:'region', tone:(x, y) => .14 + .34 * hash(Math.round(x + y * 3))}); }
/* the torso: four large cells (shoulder and chest, ribs, loin, rump) whose outline is one smooth curve; deep chest, high withers, the hump */
const TP = {t0:[650, 318], t1:[596, 280], t2:[545, 264], t3:[495, 280], t4:[448, 316], t5:[396, 338], t6:[344, 344], t7:[296, 338], t8:[252, 332], r0:[214, 342], r1:[190, 366], r2:[180, 408], r3:[186, 452], r4:[206, 488],
  b0:[246, 502], b1:[300, 498], b2:[350, 512], b3:[402, 536], b4:[456, 552], b5:[510, 558], b6:[565, 558], b7:[612, 552], c0:[656, 546], c1:[690, 516], c2:[702, 462], c3:[692, 396], s1:[552, 430], s2:[392, 440], h1:[322, 420]};
const CELLS = {torsoA:['t0', 't1', 't2', 's1', 'b6', 'b7', 'c0', 'c1', 'c2', 'c3'], torsoB:['t2', 't3', 't4', 't5', 's2', 'b3', 'b4', 'b5', 'b6', 's1'], torsoC:['t6', 't5', 's2', 'b3', 'b2', 'b1', 'h1'], torsoD:['t8', 't7', 't6', 'h1', 'b1', 'b0', 'r4', 'r3', 'r2', 'r1', 'r0']};
{ const nms = Object.keys(CELLS), sm = K.smoothCells(nms.map(k => CELLS[k].map(n => TP[n])), 2);
  nms.forEach((nm, i) => M.zone(nm, sm[i], {layer:4, tier:'L', ptier:'M', h:36, tags:['torso'], bind:{chain:['pelvis', 'body', 'chest'], sigma:70}, line:'region'})); }
/* the ribs, as line work over the barrel, and the shoulder blade's outline */
{ const bel = x => { const B = [[300, 498], [350, 512], [402, 536], [456, 552], [510, 558], [565, 558], [612, 552]]; for(let k = 0; k < B.length - 1; k++) if(x <= B[k + 1][0]) return B[k][1] + (B[k + 1][1] - B[k][1]) * (x - B[k][0]) / (B[k + 1][0] - B[k][0]); return 552; };
  for(let q = 0; q < 7; q++){ const x = 410 + q * 19, y1 = 392 + (x - 410) * .04, xe = x - 30, ye = bel(xe) - 22;
    M.line('rib' + q, chaikin([[x, y1], [x - 4, y1 + (ye - y1) * .35], [x - 15, y1 + (ye - y1) * .7], [xe, ye]], 2, false), {layer:4, tags:['torso'], bind:{chain:['pelvis', 'body', 'chest'], sigma:70}, host:['torsoB', 'torsoC'], line:{k:.4, c:.6, r:'f', t:'bone', tk:.15}}); } }
M.line('flankFold', chaikin([[300, 498], [326, 474], [346, 446], [356, 416]], 2, false), {layer:4, tags:['torso'], bind:{chain:['pelvis', 'body', 'chest'], sigma:70}, host:['torsoC', 'torsoD'], line:{k:.4, c:.6, r:'f', t:'bone', tk:.15}});
M.line('elbowPocket', chaikin([[640, 534], [618, 546], [592, 548], [570, 540]], 2, false), {layer:4, tags:['torso'], bind:{chain:['pelvis', 'body', 'chest'], sigma:70}, host:['torsoA'], line:{k:.4, c:.6, r:'f', t:'bone', tk:.15}});
M.rim('scapula', chaikin([[536, 306], [588, 312], [616, 356], [608, 416], [578, 432], [548, 384]], 2), {layer:4, tags:['torso'], bind:{mix:[['chest', .85], ['scapN', .15]]}, s:12, host:['torsoA', 'torsoB'], line:{k:.4, c:.78, r:'b', t:'bone', tk:.2}});
/* the hump: the mass of rhomboid and trapezius over the withers, riding its own bone so it lags the stride */
M.zone('hump', chaikin([[486, 316], [518, 294], [550, 288], [588, 298], [618, 326], [604, 354], [556, 370], [508, 362], [484, 338]], 2), {layer:5, tier:'M', h:24, tags:['torso', 'hump'], bind:{mix:[['hump', .3], ['chest', .7]]}, host:['torsoA', 'torsoB', 'neck', 'shouldN'], line:'region'});
/* the near legs (mid) with fine cannon and hoof, and the joints as anatomy */
legParts('fore', 'N', FORE, false); legParts('hind', 'N', HIND, false);
for(const [nm, pts, tg, ch, host] of [
  ['jElbow', [[592, 524], [606, 532], [606, 552], [592, 562], [572, 552], [566, 536]], 'fore', ['humN', 'radN'], ['foreUN', 'foreLN']],
  ['jCarpus', ringPts([603, 650], 13, 9, .3, .9), 'fore', ['radN', 'handN'], ['foreLN', 'cannonFN']],
  ['jStifle', ringPts([320, 500], 16, 9, .2), 'hind', ['femN', 'tibN'], ['thighN', 'shinN']],
  ['jHock', [[264, 596], [270, 616], [262, 630], [244, 628], [234, 610], [244, 596]], 'hind', ['tibN', 'footN'], ['shinN', 'cannonHN']]])
  M.zone(nm, pts, {layer:5, tier:'F', h:12, zone:'paws', tags:[tg, 'N', 'leg'], bind:{chain:ch, sigma:20}, host, line:'feature'});
/* the shoulder and haunch masses: large planes that hide the leg tops and carry the muscles' bulge */
M.zone('shouldN', chaikin([[540, 304], [598, 290], [652, 338], [680, 410], [672, 484], [640, 534], [592, 548], [556, 512], [530, 440], [522, 368]], 2), {layer:6, tier:'L', ptier:'M', h:40, tags:['fore', 'N', 'plate'], bind:{mix:[['chest', .7], ['scapN', .3]]}, line:'contour'});
M.zone('haunchN', chaikin([[196, 358], [246, 336], [300, 346], [336, 392], [338, 448], [322, 494], [296, 524], [254, 532], [220, 506], [196, 458], [184, 404]], 2), {layer:6, tier:'L', ptier:'M', h:40, tags:['hind', 'N', 'plate'], bind:{chain:['pelvis', 'femN'], sigma:44}, line:'contour'});
/* the dewlap: the loose fold from the throat to the brisket; it hangs from its own bones and swings */
M.zone('dewlap', chaikin([[744, 470], [722, 488], [702, 514], [686, 548], [670, 558], [654, 540], [660, 500], [684, 472], [718, 462]], 2), {layer:6, tier:'M', h:22, tags:['neck', 'dewlap'], bind:{chain:['neck', 'dewA', 'dewB'], sigma:26}, line:'region'});
for(let q = 0; q < 4; q++){ const y = 488 + q * 16; M.line('dewFold' + q, chaikin([[730 - q * 14, y - 4], [710 - q * 12, y + 4], [690 - q * 9, y + 6], [672 - q * 5, y + 3]], 2, false), {layer:6, tags:['neck', 'dewlap'], bind:{chain:['neck', 'dewA', 'dewB'], sigma:26}, host:['dewlap'], line:{k:.4, c:.6, r:'f'}}); }
/* the neck: a thick mass from the withers to the poll, over the shoulder, with its folds */
M.zone('neck', chaikin([[574, 282], [630, 298], [700, 320], [772, 338], [812, 362], [816, 440], [800, 490], [748, 488], [704, 486], [666, 476], [630, 456], [600, 424], [578, 360]], 2), {layer:7, tier:'M', h:28, bind:{chain:['chest', 'neck', 'head'], sigma:26}, tags:['neck'], line:'region'});
M.line('nuchal', chaikin([[600, 296], [660, 312], [720, 330], [772, 344]], 2, false), {layer:7, tags:['neck'], bind:{chain:['chest', 'neck', 'head'], sigma:26}, host:['neck'], line:{k:.4, c:.6, r:'f', t:'bone', tk:.2}});
for(let q = 0; q < 3; q++){ const x = 650 + q * 32; M.line('neckFold' + q, chaikin([[x + 8, 322 + q * 6], [x, 372], [x - 6, 424], [x - 2, 470]], 2, false), {layer:7, tags:['neck'], bind:{chain:['chest', 'neck', 'head'], sigma:26}, host:['neck'], line:{k:.4, c:.55, r:'f'}}); }

/* ---------- the head: ears and horns behind the face, then the face's cells, the mouth, the muzzle, the eyes and lids, the glyph ----------
   Every head part carries depth (z) and yaw, so a head turn shows parallax: the muzzle slides across the cheek, the far eye and far horn compress. */
const hd = (name, half, o) => M.zone(name, sym(half).map(hw), {yaw:true, ...o});
const hp = (name, poly, o = {}) => { const tg = o.tags || ['head', 'face', 'skin'], bs = sd => o.bindSide ? {rigid:o.bindSide + sd} : o.bind;
  M.zone(name + 'R', poly.map(hw), {yaw:true, ...o, bind:bs('R'), tags:[...tg, 'R']}); M.zone(name + 'L', mr(poly.map(hw)), {yaw:true, ...o, bind:bs('L'), tags:[...tg, 'L']}); };
const hs = (name, pts, o = {}) => { const tg = o.tags || ['head', 'face', 'skin']; M.shape(name + 'R', pts.map(hw), {yaw:true, ...o, tags:[...tg, 'R']}); M.shape(name + 'L', mr(pts.map(hw)), {yaw:true, ...o, tags:[...tg, 'L']}); };
/* the horns and the poll's ridge are one crescent, tip to tip, behind the face: it is the arc of the sign */
const HORN_R = [[0, -100, 15], [24, -103, 16.5], [48, -108, 16], [70, -116, 14.5], [90, -128, 13], [108, -144, 11.5], [122, -164, 10], [130, -188, 8], [131, -212, 5.6], [126, -234, 3]];
const HORN = HORN_R.slice(1).reverse().map(([u, v, r]) => [-u, v, r]).concat(HORN_R);
const HORN_W = HORN.map(([u, v]) => hw([u, v])), HORN_CUM = [0]; for(let i = 1; i < HORN_W.length; i++) HORN_CUM.push(HORN_CUM[i - 1] + Math.hypot(HORN_W[i][0] - HORN_W[i - 1][0], HORN_W[i][1] - HORN_W[i - 1][1]));
const hornS = (x, y) => { let bi = 0, bd = 1e9; for(let i = 0; i < HORN_W.length - 1; i++){ const a = HORN_W[i], b = HORN_W[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)), d = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); if(d < bd){ bd = d; bi = HORN_CUM[i] + t * (HORN_CUM[i + 1] - HORN_CUM[i]); } } return bi / HORN_CUM[HORN_CUM.length - 1]; };
const hornZ = (x, y) => HS * (18 + .4 * Math.max(0, Math.abs(x - HC[0]) / HS - 46));
const hornTone = (x, y) => { const u = Math.abs(x - HC[0]) / HS, v = (y - HC[1]) / HS; return .2 + .72 * fSmooth(46, 190, u + Math.max(0, -(v + 118)) * .55); };
M.limb('horns', HORN.map(([u, v, r]) => { const p = hw([u, v]); return [p[0], p[1], r * HS, r * HS]; }), {layer:8, tier:'F', h:16, bind:{rigid:'head'}, yaw:true, z:hornZ, zone:'horns', line:'feature', tags:['head', 'horn'], tone:hornTone, tj:.03});
const earPoly = [[56, -82], [82, -92], [116, -90], [144, -78], [152, -66], [134, -58], [100, -56], [68, -58], [56, -64]], earIn = [[72, -78], [100, -84], [128, -76], [136, -68], [120, -62], [96, -62], [74, -64]];
hp('ear', earPoly, {layer:8, tier:'F', h:13, zone:'ears', line:'feature', tags:['head', 'ear'], z:zh(-12), bindSide:'ear', tone:.26});
hp('earIn', earIn, {layer:8, tier:'F', h:9, inset:.3, zone:'ears', line:'feature', tags:['head', 'ear'], z:zh(-8), bindSide:'ear', flush:.5, tone:.4});
const FACE = [[0, -100], [28, -101], [50, -97], [61, -82], [65, -60], [68, -40], [60, -18], [50, 10], [46, 40], [50, 62], [58, 80], [60, 96], [44, 108], [0, 113]];
{ const fh = sym([[0, -100], [28, -101], [50, -97], [61, -82], [64, -62], [36, -68], [0, -64]]).map(hw), chR = [[64, -62], [68, -40], [60, -18], [50, 10], [46, 40], [50, 62], [38, 64], [27, 38], [29, -6], [33, -34], [36, -68]].map(hw), chL = mr(chR),
      fc = sym([[0, -64], [36, -68], [33, -34], [29, -6], [27, 38], [36, 64], [0, 70]]).map(hw), sm = K.smoothCells([fh, chR, chL, fc], 2);
  const fo = {layer:9, bind:{rigid:'head'}, yaw:true, z:zh(0), tags:['head', 'face', 'skin'], zone:'face'};
  M.zone('foreheadC', sm[0], {...fo, tier:'L', ptier:'M', h:24, line:'face'}); M.zone('cheekR', sm[1], {...fo, tier:'L', ptier:'M', h:26, line:'face', tags:['head', 'face', 'skin', 'R']});
  M.zone('cheekL', sm[2], {...fo, tier:'L', ptier:'M', h:26, line:'face', tags:['head', 'face', 'skin', 'L']}); M.zone('faceC', sm[3], {...fo, tier:'M', h:26, line:'face'});
  M.rim('faceRim', chaikin(sym(FACE).map(hw), 2), {layer:9, yaw:true, z:fo.z, bind:fo.bind, tags:['head', 'face'], s:12, zone:'face', line:'contour'}); }
// the mouth's inside lies under the muzzle and the jaw, so the jaw's drop uncovers it; the bull's teeth are the lower incisors and an upper dental pad
hd('cavity', [[0, 90], [24, 90], [44, 88], [50, 100], [44, 114], [28, 122], [0, 126]], {layer:10, tier:'M', h:22, inset:.4, z:zh(-30), bind:{rigid:'head'}, flush:1, zone:'mouth', line:'mouth', tone:0, tags:['head', 'face']});
hd('tongue', [[0, 100], [14, 98], [26, 104], [28, 114], [18, 124], [0, 128]], {layer:10, tier:'F', h:13, inset:.4, z:zh(-24), bind:{mix:[['jaw', .85], ['head', .15]]}, flush:.6, zone:'mouth', line:'mouth', tone:0, tags:['head', 'face', 'lo']});
hd('tongueOut', [[-17, 94], [17, 94], [16, 104], [12, 113], [6, 118], [0, 119], [-6, 118], [-12, 113], [-16, 104]], {layer:10, tier:'F', h:11, inset:.4, tags:['head', 'face', 'tongue2'], z:zh(8), bind:{rigid:'jaw'}, zone:'mouth', line:'mouth', tone:.55, flush:.9});
for(let i = 0; i < 4; i++){ const u = 5 + i * 8.6; hs('inc' + i, [[u - 3.8, 94], [u + 3.8, 94], [u, 106]], {layer:10, tier:'F', z:zh(-16), bind:{rigid:'jaw'}, zone:'mouth', line:'mouth', tone:.95, tags:['head', 'face', 'teeth', 'lo']}); }
hd('dentalPad', [[0, 88], [32, 87], [46, 90], [32, 96], [0, 96]], {layer:10, tier:'F', h:9, inset:.3, z:zh(-14), bind:{rigid:'head'}, zone:'mouth', line:'mouth', tone:.5, tags:['head', 'face']});
// the muzzle (the broad nose and upper lip), the jaw, the nasal bridge, the nostrils
hd('muzzle', [[0, 50], [24, 48], [46, 54], [58, 68], [61, 84], [52, 95], [30, 98], [0, 99]], {layer:11, tier:'F', h:15, z:zh(0, (u, v) => 28 * Math.exp(-((u / 60) ** 2 + ((v - 72) / 40) ** 2))), bind:{rigid:'head'}, zone:'muzzle', line:'feature', tone:.5, tags:['head', 'face', 'skin', 'muz']});
hd('jaw', [[0, 90], [24, 90], [46, 88], [52, 98], [44, 110], [26, 118], [0, 121]], {layer:11, tier:'F', h:17, z:zh(0, (u, v) => 12 * Math.exp(-((u / 50) ** 2 + ((v - 104) / 24) ** 2))), bind:{rigid:'jaw'}, zone:'mouth', line:'feature', tags:['head', 'face', 'skin', 'lo'], tone:(x, y) => (y - HC[1]) < 95 ? .85 : .08});
hd('bridge', [[0, -34], [13, -30], [21, -4], [25, 28], [19, 54], [0, 56]], {layer:11, tier:'F', h:15, z:zh(6), bind:{rigid:'head'}, zone:'muzzle', line:{k:.34, c:.5, r:'b'}, tone:.1, tags:['head', 'face', 'skin']});
hs('nostril', chaikin(ringPts([0, 0], 1, 10, 0).map(([a, b]) => { const x = a * 17, y = b * 10, r = -.45; return [28 + x * Math.cos(r) - y * Math.sin(r), 74 + x * Math.sin(r) + y * Math.cos(r)]; }), 1), {layer:13, z:zh(30), bind:{rigid:'head'}, zone:'muzzle', line:'feature', tone:.22, tags:['head', 'face', 'skin', 'nostril']});
// the eye: an almond of fine iris facets with a horizontal pupil (a bovine eye's); the lids lie over it
const almond = [[26, -46], [36, -62], [54, -67], [70, -58], [73, -46], [64, -32], [46, -27], [32, -35]], PUPC = [49, -46], PR = hw(PUPC), PL = [2 * HC[0] - PR[0], PR[1]];
const lidU = [[22, -52], [32, -72], [54, -79], [78, -68], [81, -48], [73, -46], [70, -58], [54, -67], [36, -62], [26, -46]], lidL = [[26, -46], [32, -35], [46, -27], [64, -32], [73, -46], [81, -44], [68, -22], [46, -17], [30, -24], [22, -40]];
hp('eye', almond, {layer:12, tier:'F', h:9.6, inset:.3, z:zh(0, (u, v) => 10 * Math.exp(-(((u - 48) / 22) ** 2 + ((v + 46) / 18) ** 2))), bind:{rigid:'head'}, zone:'eyes', ink:'accent', line:'feature', flush:.15, tags:['head', 'face', 'eye'],
  tone:(x, y) => .7 + .3 * clamp(Math.hypot(x - (x < HC[0] ? PL[0] : PR[0]), y - PR[1]) / 32)});
const pup = c => [[c[0] - 16, c[1]], [c[0] - 9, c[1] - 6.5], [c[0], c[1] - 7.5], [c[0] + 9, c[1] - 6.5], [c[0] + 16, c[1]], [c[0] + 9, c[1] + 6.5], [c[0], c[1] + 7.5], [c[0] - 9, c[1] + 6.5]];
hs('pupil', pup(PUPC), {layer:13, z:zh(2), bind:{rigid:'head'}, zone:'eyes', line:'feature', tone:0, tags:['head', 'face', 'eye', 'pupil']});
hp('lidL', lidL, {layer:14, tier:'F', h:10, inset:.35, z:zh(5), bind:{rigid:'head'}, zone:'brows', line:{k:.5, c:.72, r:'f', t:'bone', tk:.2}, flush:.2, tone:.5});
hp('lidU', lidU, {layer:14, tier:'F', h:10, inset:.35, z:zh(9), bind:{rigid:'head'}, zone:'brows', line:{k:.5, c:.72, r:'f', t:'bone', tk:.2}, flush:.25, tone:.55});
/* the glyph ♉: the gold inlay runs the whole crescent, tip to tip along the horns and the poll's ridge, and the ring sits in its cup on the forehead */
{ const g = {layer:15, tier:'F', ink:'gold', zone:'glyph', line:'glyph', tone:.92, tj:0, yaw:true, bind:{rigid:'head'}};
  M.strip('crescentInlay', HORN.slice(1, -1).map(([u, v, r], i, a) => { const p = hw([u, v]), e = Math.min(i, a.length - 1 - i) / 4; return [p[0], p[1], HS * (1.2 + 1.6 * clamp(1 - Math.abs(u) / 150))]; }), {...g, z:(x, y) => hornZ(x, y) + 3, tags:['glyph', 'head'], host:['horns']});
  M.polar('browRing', hw([0, -67]), [18 * HS, 24 * HS], [20, 20], {...g, z:zh(4), tags:['glyph', 'head'], host:['foreheadC', 'faceC']}); }

/* ---------- muscles ----------
   The face rig's muscle (a gaussian field in rest space that displaces vertices and inks creases) that also turns the joints it really turns. Pairs: LR mirrors across the
   head's axis (rotations mirror too), NF is the near and far limb. Head muscles are placed on the right half of the face (u > 0); the left instance mirrors them. */
const cr = (cx, cy, rx, ry, ang, f, amp = .5, lo = .78, hi = .95) => K.crease(cx, cy, rx, ry, ang, f, amp, lo, hi), soft = (cx, cy, rx, ry, amp) => K.glow(cx, cy, rx, ry, amp), both = K.both;
const hcr = (c, rx, ry, ang, f, amp, lo, hi) => { const w = H(...c); return cr(w[0], w[1], rx * HS, ry * HS, ang, f / HS, amp, lo, hi); }, hsoft = (c, rx, ry, amp) => { const w = H(...c); return soft(w[0], w[1], rx * HS, ry * HS, amp); };
const hm = (id, name, g, c, r, o) => M.muscle(id, {name, g, pair:'LR', c:H(...c), r:r.map(q => q * HS), speed:o.speed ?? 10, ...o, v:o.v && o.v.map(q => q * HS)});
// the jaw: closers against the opener; the bull chews sideways, so the pterygoids slide the jaw to a side
hm('temporalis', 'temporalis', 'jaw', [58, -84], [26, 24], {v:[6, -14], hue:'#a09080', speed:8, jt:[['jaw', -6, 'y']], shade:both(hcr([58, -84], 24, 22, 1.2, .2, .95), hsoft([58, -84], 26, 24, .7))});
hm('masseter', 'masseter', 'jaw', [48, 56], [26, 36], {v:[5, -16], hue:'#b09880', speed:8, jt:[['jaw', -8, 'y']], shade:both(hcr([48, 58], 22, 34, 1.45, .22, .95), hsoft([48, 56], 26, 36, .7))});
hm('digastric', 'digastric', 'jaw', [26, 106], [30, 20], {dir:[0, 1], hue:'#80a0a8', speed:9, jt:[['jaw', 18, 'y']], host:'jaw'});
M.muscle('chewR', {name:'pterygoid (jaw to the right)', g:'jaw', c:H(20, 100), r:[30 * HS, 24 * HS], hue:'#c0b090', speed:11, jt:[['jaw', 7, 'x']], host:'jaw', dir:[1, 0]});
M.muscle('chewL', {name:'pterygoid (jaw to the left)', g:'jaw', c:H(-20, 100), r:[30 * HS, 24 * HS], hue:'#c0b090', speed:11, jt:[['jaw', -7, 'x']], host:'jaw', dir:[-1, 0]});
hm('depLab', 'depressor labii inferioris', 'lips', [24, 106], [26, 20], {v:[3, 14], hue:'#90a0c8', speed:10, on:['lo'], shade:hcr([24, 104], 24, 18, 1.3, .2, .8)});
hm('levLab', 'levator labii superioris (curl the lip)', 'lips', [28, 66], [28, 26], {v:[6, -22], hue:'#e3806f', speed:12, on:['skin'], shade:hcr([28, 62], 26, 24, .5, .2, .9)});
hm('nasolab', 'nasolabialis', 'lips', [40, 76], [22, 24], {v:[14, -10], hue:'#d8c89a', speed:11, on:['skin'], shade:both(hcr([40, 74], 20, 22, 1.1, .22, .85), hsoft([40, 74], 22, 24, .7))});
hm('nostril', 'dilator naris (flare the nostril)', 'lips', [24, 74], [22, 18], {pull:[-.42, -.36], hue:'#ff9a76', speed:14, on:['nostril', 'muz'], shade:hsoft([24, 74], 20, 16, .5)});
hm('nasalis', 'nasalis (wrinkle the nose)', 'lips', [18, 20], [20, 40], {v:[-3, -18], hue:'#d985a6', speed:12, on:['skin'], shade:hcr([20, 24], 20, 36, 1.57, .3, .95)});
// the eye and brow
hm('orbic', 'orbicularis oculi', 'eyes', [48, -46], [34, 22], {pull:[.5, .9], hue:'#ffbe00', speed:18, on:['skin'], shade:hcr([50, -46], 32, 20, .3, .25, .7)});
hm('levPalp', 'levator palpebrae', 'eyes', [48, -72], [34, 14], {v:[0, -18], hue:'#7ec3e6', speed:16, on:['skin'], shade:both(hcr([48, -74], 30, 12, 1.57, .3, .8), hsoft([48, -74], 32, 12, .65))});
hm('frontalis', 'frontalis (raise the brow)', 'eyes', [40, -88], [40, 18], {v:[0, -12], hue:'#c79ae0', speed:10, on:['skin'], shade:both(hcr([40, -92], 38, 18, 1.57, .22, .8), hsoft([40, -92], 40, 18, .6))});
hm('corrug', 'corrugator supercilii', 'eyes', [26, -72], [26, 14], {v:[-14, 12], hue:'#e0523f', speed:11, on:['skin'], shade:both(hcr([24, -70], 22, 14, 0, .3, .95), hsoft([24, -70], 24, 14, .75))});
hm('dilator', 'pupil dilator', 'eyes', [48, -46], [16, 12], {pull:[-.8, -.8], hue:'#3b3a78', speed:10, on:['pupil']});
for(const [id, nm, v] of [['lookR', 'gaze right', [8, 0]], ['lookL', 'gaze left', [-8, 0]], ['lookU', 'gaze up', [0, -4]], ['lookD', 'gaze down', [0, 4]]]) hm(id, nm, 'gaze', [48, -46], [14, 12], {v, vm:0, hue:'#7ec3e6', speed:14, on:['pupil']});
// ears: the bull's ear is a broad leaf held to the side; it drops, rises and swivels
hm('earBack', 'auricularis posterior (ear back and down)', 'ears', [100, -72], [44, 24], {v:[0, 10], hue:'#a89880', speed:14, on:['ear'], jt:[['ear$', .9, 'r']]});
hm('earUp', 'auricularis superior (ear up)', 'ears', [100, -72], [44, 24], {v:[0, -8], hue:'#b0a090', speed:14, on:['ear'], jt:[['ear$', -.5, 'r']]});
hm('earFwd', 'auricularis anterior (ear forward)', 'ears', [112, -72], [34, 22], {v:[10, 0], vm:1, hue:'#c0b8a0', speed:13, on:['ear'], jt:[['ear$', -.2, 'r']]});
hm('splenius', 'splenius capitis (turn the head)', 'neck', [70, -50], [26, 40], {v:[0, -3], hue:'#9a88c0', speed:6, on:['skin'], jt:[['@yaw', .62, 'yaw'], ['head', .05, 'r']]});
// the tongue
M.muscle('tongueOut', {name:'genioglossus (the tongue out)', g:'jaw', c:H(0, 118), r:[26 * HS, 40 * HS], v:[0, 46 * HS], hue:'#c85a6a', speed:11, on:['tongue2']});
hm('tongueFlick', 'tongue flick (to the nostril)', 'jaw', [0, 114], [24, 20], {v:[16, -92], hue:'#e07a7a', speed:12, on:['tongue2']});
// the neck and the hump
M.muscle('neckUp', {name:'semispinalis capitis (neck extensor)', g:'neck', c:[700, 340], r:[70, 36], v:[0, -5], hue:'#7ec3e6', speed:6.5, on:['neck', 'torso'], jt:[['neck', -.55, 'r'], ['head', -.06, 'r']], shade:cr(700, 342, 66, 30, 0, .1, .5)});
M.muscle('neckDown', {name:'longus colli · scalenus (neck flexor)', g:'neck', c:[700, 452], r:[64, 28], v:[0, 4], hue:'#ffbe00', speed:6.5, on:['neck', 'dewlap'], jt:[['neck', .5, 'r'], ['head', .05, 'r']], shade:cr(700, 450, 60, 24, 0, .1, .5)});
M.muscle('rhomboid', {name:'rhomboideus · trapezius (the hump)', g:'neck', c:[556, 326], r:[62, 36], v:[0, -9], hue:'#9a88c0', speed:8, on:['hump', 'torso', 'neck'], jt:[['chest', -.03, 'r']], shade:both(cr(556, 330, 56, 30, .6, .12, .6), soft(556, 326, 56, 32, .5))});
M.muscle('throat', {name:'hyoid · laryngeal (the throat)', g:'neck', c:[748, 458], r:[34, 24], v:[0, 9], hue:'#8fb0a0', speed:12, on:['neck', 'dewlap'], shade:soft(748, 458, 32, 22, .55), host:'neck'});
M.muscle('cutaneus', {name:'cutaneus colli (lift the dewlap)', g:'neck', c:[716, 522], r:[34, 34], v:[6, -14], hue:'#c8b090', speed:9, on:['dewlap'], shade:cr(716, 522, 30, 30, 1.2, .14, .5)});
for(const [id, x] of [['bolusLow', 640], ['bolusMid', 692], ['bolusHigh', 744]]) M.muscle(id, {name:'cud bolus (' + id.slice(5).toLowerCase() + ')', g:'neck', c:[x, 462], r:[22, 15], v:[0, 9], hue:'#b0c8a0', speed:12, on:['neck', 'dewlap'], shade:soft(x, 462, 20, 14, .55), host:'neck'});
M.muscle('brachioceph', {name:'brachiocephalicus', g:'neck', pair:'NF', far:[46, -4], c:[640, 372], r:[46, 54], v:[0, -4], hue:'#7090a0', speed:7, on:['torso', 'fore', 'neck'], jt:[['neck', -.06, 'r'], ['hum$', -.12, 'r']], shade:cr(640, 372, 40, 48, 2.2, .1, .5)});
// the trunk
M.muscle('epaxial', {name:'longissimus dorsi (epaxial)', g:'spine', c:[400, 334], r:[190, 22], v:[0, -6], hue:'#c8a070', speed:7, on:['torso'], jt:[['pelvis', .08, 'r'], ['chest', -.08, 'r']], shade:cr(400, 338, 190, 18, 0, .09, .6)});
M.muscle('hypaxial', {name:'rectus abdominis (hypaxial)', g:'spine', c:[400, 524], r:[190, 24], v:[0, 6], hue:'#a8c0a0', speed:7, on:['torso'], jt:[['pelvis', -.14, 'r'], ['chest', .14, 'r']], shade:cr(400, 524, 190, 18, 0, .1, .6)});
M.muscle('intercostals', {name:'intercostals', g:'spine', c:[490, 440], r:[120, 76], pull:[-.075, -.12], hue:'#8fd0a8', speed:5, on:['torso'], dir:[0, 1], host:'chest', shade:soft(490, 440, 110, 70, .2)});
M.muscle('flank', {name:'external oblique (the flank)', g:'spine', c:[340, 482], r:[58, 40], v:[3, 7], hue:'#b0d0a8', speed:6, on:['torso', 'hind'], dir:[0, 1], host:'pelvis', shade:soft(340, 482, 52, 36, .2)});
for(const [id, x, y] of [['panniculusA', 470, 420], ['panniculusB', 392, 404], ['panniculusC', 314, 392]]) M.muscle(id, {name:'panniculus carnosus (' + id.slice(10) + ')', g:'skin', c:[x, y], r:[46, 62], v:[0, -4], hue:'#d8b8a0', speed:16, on:['torso'], dir:[0, -1], host:'chest', shade:both(cr(x, y, 44, 58, 1.3, .16, .6), soft(x, y, 44, 58, .35))});
// the foreleg
const fm = (id, name, c, r, o) => M.muscle(id, {name, g:'foreleg', pair:'NF', c, r, speed:10, ...o});
fm('trapezius', 'trapezius', [548, 346], [72, 34], {v:[0, -9], hue:'#9a88c0', speed:8, on:['torso', 'fore', 'hump'], jt:[['scap$', .06, 'r']], shade:cr(548, 350, 60, 26, .7, .12, .6)});
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
// the tail: it hangs, and swings forward and back like a pendulum; the tip curls
M.muscle('levCaudae', {name:'levator caudae (swing the tail out and up)', g:'tail', c:[186, 440], r:[34, 110], v:[0, 0], dir:[-1, 0], hue:'#d8c89a', speed:8, on:['tail'], jt:[['tail0', .09, 'r'], ['tail1', .07, 'r'], ['tail2', .06, 'r'], ['tail3', .04, 'r']], host:'tail1'});
M.muscle('depCaudae', {name:'depressor caudae (hold it in)', g:'tail', c:[186, 440], r:[34, 110], v:[0, 0], dir:[1, 0], hue:'#8f9ac0', speed:11, on:['tail'], jt:[['tail0', -.08, 'r'], ['tail1', -.06, 'r'], ['tail2', -.05, 'r'], ['tail3', -.04, 'r']], host:'tail1'});
M.muscle('flexMid', {name:'caudal flexor (mid)', g:'tail', c:[174, 530], r:[30, 50], v:[0, 0], dir:[-1, 0], hue:'#c090c0', speed:12, on:['tail'], jt:[['tail2', .08, 'r'], ['tail3', .1, 'r'], ['tail4', .1, 'r']], host:'tail3'});
M.muscle('flexTip', {name:'intertransversarii (the switch)', g:'tail', c:[172, 620], r:[28, 50], v:[0, 0], dir:[-1, 0], hue:'#e0a060', speed:14, on:['tail', 'tuft'], jt:[['tail4', .1, 'r'], ['tuftB', .3, 'r']], host:'tail4'});

/* ---------- postures and edges ----------
   Stand (a hand's breadth low, so the legs have slack), lie (sternal: the bull goes down front first, kneeling, and the rear folds after; it gets up rear first, then the
   front), kneel (the front on its knees, the rear still up: the stage between), brace (the head lowered and turned to the foe, shoulders loaded, the tail stiff: the charge
   comes from it) and rear (rampant on the hind legs). */
const PIV = [262, 400], HAND0 = Math.atan2(85, 19), FOOT0 = Math.atan2(123, 18);
const rotW = (p, th, dx, dy) => { const c = Math.cos(th), s = Math.sin(th); return [PIV[0] + c * (p[0] - PIV[0]) - s * (p[1] - PIV[1]) + dx, PIV[1] + s * (p[0] - PIV[0]) + c * (p[1] - PIV[1]) + dy]; };
const farOf = (f, o) => f && [f[0] + o[0], f[1] + o[1], f[2]];
const feet = (fn, hn, o = {}) => [fn, farOf(fn, [FAR.fore[0] + (o.fx || 0), FAR.fore[1]]), hn, farOf(hn, [FAR.hind[0] + (o.hx || 0), FAR.hind[1]])];
const TAILHANG = {tail0:0, tail1:0, tail2:0, tail3:0, tail4:0};
M.posture('stand', {root:[0, 16, 0]});
M.posture('brace', {root:M.rootV(PIV, .055, 0, 8), jt:{chest:.05, neck:.52, head:-.3, tail0:.2, tail1:.08, tail2:.05}, feet:feet([640, 735, HAND0 + .05], [268, 735, FOOT0]), cam:[1.1, 522, 412]});
M.posture('kneel', {root:M.rootV(PIV, .2, 0, 14), jt:{chest:.3, neck:-.46, head:.1, tail0:.1, toeFN:-1.2, toeFF:-1.2}, feet:feet([588, 734, 2.72], [280, 735, FOOT0], {fx:-6}), cam:[1.05, 530, 414]});
M.posture('lie', {root:[0, 176, -.012], jt:{chest:.04, neck:-.2, head:.12, tail0:.12, tail1:.05, tail2:-.3, tail3:-.85, tail4:-.7, toeFN:-1.2, toeFF:-1.2, toeHN:1.15, toeHF:1.15}, feet:feet([596, 734, 2.72], [338, 733, .12], {fx:-4, hx:12}), cam:[1.05, 535, 428], ground:1});
{ const th = -.62, dx = 24, dy = 46, sh = rotW(J.hum[0], th, dx, dy), rv = M.rootV(PIV, th, dx, dy);
  M.posture('rear', {root:rv, jt:{chest:-.1, neck:.5, head:-.12, tail0:.35, toeFN:-.3, toeFF:-.3}, feet:feet([sh[0] + 48, sh[1] + 150, 1.75], [286, 735, FOOT0], {fx:-18}), cam:[1.3, 535, 345]}); }
M.edge('stand>brace', {ms:1900, g:{head:[0, 1300], front:[250, 1300], root:[300, 1400], rear:[550, 1100], tail:[700, 1000], cam:[0, 1800]}, bumps:[['rr', 0, 600, -.012]]});
M.edge('stand>kneel', {ms:2300, g:{front:[0, 1700], root:[250, 1750], head:[900, 1200], rear:[1500, 700], tail:[500, 1600], cam:[0, 2200]}, bumps:[['rr', 0, 800, -.012]]});
M.edge('kneel>lie', {ms:2900, g:{rear:[0, 1800], root:[200, 1900], front:[900, 1500], head:[1500, 1300], tail:[0, 1500], cam:[0, 2700]}});
M.edge('lie>kneel', {ms:2700, g:{rear:[0, 1600], root:[0, 1500], head:[0, 1200], front:[1300, 1300], tail:[900, 1700], cam:[0, 2400]}});
M.edge('kneel>stand', {ms:2300, g:{rear:[0, 900], front:[500, 1500], root:[400, 1500], head:[900, 1200], tail:[900, 1200], cam:[400, 1800]}});
M.edge('stand>rear', {ms:2700, g:{rear:[0, 1200], root:[350, 1500], front:[500, 1400], head:[700, 1300], tail:[400, 1500], cam:[0, 1500]}, bumps:[['ry', 0, 700, 16]]});
M.edge('rear>stand', {ms:2900, g:{head:[0, 1000], root:[250, 1600], front:[300, 1800], rear:[600, 1500], tail:[900, 1500], cam:[300, 2200]}, bumps:[['ry', 1900, 800, 9]]});

/* ---------- gaits: one engine on a blend line ----------
   walk and trot run on the stand; the charge is a transverse gallop and runs on the brace, so it comes from the threat. */
M.gait('walk', {psi:1, base:'stand', L:104, cyc:1500, duty:.7, lift:[34, 34, 32, 32], off:[.75, .25, 0, .5],   /* lateral sequence: a hind foot, then the fore foot of the same side a quarter cycle later (it was diagonal sequence) */ flex:[.55, .5, .65, .65], hs:[0, 0, 10, 10], bob:3.5, sink:0, cap:1.8, lead:0});
M.gait('trot', {psi:2, base:'stand', L:134, cyc:860, duty:.5, lift:[44, 44, 40, 40], off:[0, .5, .5, 0], flex:[.7, .65, .8, .8], hs:[0, 0, 12, 12], bob:7, sink:6, cap:1.6, lead:0});
M.gait('charge', {psi:3, base:'brace', L:168, cyc:660, duty:.38, lift:[56, 56, 52, 52], off:[.56, .45, .1, 0], flex:[.9, .85, 1.05, 1.05], hs:[0, 0, 16, 16], bob:11, sink:12, cap:1.5, lead:3});

/* ---------- actions ----------
   Each adds to the muscle targets and the pose channels for its own clock. With no `in` an action is a layer (any posture, even mid-transition); with `in` it needs those
   postures and the bull goes to the nearest one first. Planted feet stay planted: a layered action never moves them, and a foot an action lifts (the paw) is blended from where
   the posture has it and returned there. */
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
// breath and voice
M.action('sigh', {label:'Sigh', group:'Breath', dur:2800, gait:true, f:(t, T, c) => { const e = KS(t, [[0, 0], [1000, 1], [1300, .95], [2600, 0]]), x = KS(t, [[0, 0], [1200, 0], [1500, 1], [2700, 0]]); c.jt('chest', -.02 * e); c.jt('neck', .02 * e - .02 * x); c.spec(T, {intercostals:1.15 * e - .5 * x, flank:.8 * e - .4 * x, nostril:mid(.3 * x), epaxial:.1 * e}); }});
M.action('snort', {label:'Snort', group:'Breath', dur:1800, gait:true, f:(t, T, c, a) => {
  const p1 = pulse(t, 0, 80, 40, 260), p2 = pulse(t, 430, 80, 40, 280), p3 = .8 * pulse(t, 880, 80, 30, 300), s = p1 + p2 + p3;
  c.spec(T, {nostril:mid(1.25 * s), nasalis:.2 * s, flank:.8 * s, intercostals:.9 * s, orbic:mid(.3 * s), earBack:mid(.25 * s), throat:.3 * s}); c.jt('neck', .05 * s); c.jt('head', .05 * s);
  for(const [k, t0] of [[1, 90], [2, 520], [3, 960]]) if(t > t0 && !a['b' + k]){ a['b' + k] = 1; const p = c.wp('head', hw([30 * (k % 2 ? 1 : -1), 76])); c.burstAt(p[0], p[1], 56, K.hexInt(K.ROSTER.bone), 'muzzle'); } }});
M.action('bellow', {label:'Bellow', group:'Voice', dur:3800, gait:true, f:(t, T, c, a) => {
  const inh = KS(t, [[0, 0], [650, 1], [1000, 0]]), e = env(t, 300, 1700, 900), hold = env(t, 500, 1400, 150), v = .05 * sinc(t, .052) * hold, A = c.shiftAmt();
  if(t > 1300 && !a.gl){ a.gl = 1; c.glyph(3200); }
  c.jt('neck', -.2 * e * A + .06 * inh * A); c.jt('head', -.16 * e); c.jt('chest', -.03 * e + .03 * inh);
  c.spec(T, {digastric:mid(.95 * e + v), depLab:mid(.5 * e), levLab:mid(.55 * e), nostril:mid(.9 * e + .5 * inh), corrug:mid(.7 * e), orbic:mid(.35 * e), earBack:mid(.45 * e), dilator:mid(.5 * e), intercostals:1.1 * e + 1.1 * inh, flank:.9 * inh - .4 * e, throat:.6 * e + .22 * hold * sinc(t, .052), cutaneus:.6 * e, rhomboid:.4 * e, tongueOut:.3 * e, masseter:mid(-.2 * e)});
  c.jd('dewA', .08 * hold * sinc(t, .052)); c.flushT = Math.max(c.flushT, e); raiseTongue(c, e * .6, t, 3800); }});
M.action('low', {label:'Low (a moo)', group:'Voice', dur:2800, gait:true, f:(t, T, c) => { const e = env(t, 380, 1200, 700), v = .035 * sinc(t, .03) * e, A = c.shiftAmt();
  c.jt('neck', -.1 * e * A); c.jt('head', -.07 * e); c.spec(T, {digastric:mid(.55 * e + v), depLab:mid(.25 * e), nostril:mid(.3 * e), throat:.45 * e + .1 * e * sinc(t, .03), intercostals:.7 * e, flank:.3 * e, earBack:mid(.2 * e)}); }});
M.action('lickNose', {label:'Lick the nose', group:'Mouth', dur:3600, gait:true, f:(t, T, c) => { const e = env(t, 300, 2600, 500), w = .5 + .5 * sinc(t, .0072, -1.2), side = sinc(t, .0036) > 0 ? 1 : 0;
  const u = [0, 0]; u[side] = 1; c.spec(T, {tongueOut:.1 * e, tongueFlick:[(.4 + .45 * w) * e * u[0], (.4 + .45 * w) * e * u[1]], digastric:mid(.14 * e), nostril:mid(.3 * e * w), orbic:mid(.18 * e)}); c.jt('head', .03 * e); c.flushT = Math.max(c.flushT, .5 * e); raiseTongue(c, e, t, 3600); }});
M.action('flehmen', {label:'Flehmen (curl the lip)', group:'Mouth', dur:3800, f:(t, T, c) => { const e = KS(t, [[0, 0], [650, 1], [2800, 1], [3700, 0]]), A = c.shiftAmt();
  c.jt('neck', -.42 * e * A); c.jt('head', -.2 * e); c.spec(T, {levLab:mid(1.25 * e), nasalis:.95 * e, nostril:mid(-.3 * e), digastric:mid(.3 * e), depLab:mid(.15 * e), orbic:mid(.4 * e), corrug:mid(.4 * e), earBack:mid(.3 * e), nasolab:mid(.4 * e)}); }});
M.action('chew', {label:'Chew the cud', group:'Mouth', dur:7200, in:['lie', 'stand'], f:(t, T, c) => {
  /* a bolus rises up the neck (three bands lit in turn, low to high), is ground sideways for five seconds, and is swallowed (high to low) */
  const ch = env(t, 600, 5400, 600), x = sinc(t, .0044), j = .5 + .5 * sinc(t, .0088, -1.6), bo = t0 => pulse(t, t0, 180, 30, 200);
  c.spec(T, {bolusLow:bo(0) + bo(6800), bolusMid:bo(250) + bo(6550), bolusHigh:bo(500) + bo(6300), digastric:mid(.17 * ch * j), masseter:mid(.14 * ch * (1 - j)), chewR:pos(x) * 1.5 * ch, chewL:pos(-x) * 1.5 * ch,
    nostril:mid(.06 * ch), earBack:mid(.12 * ch * (.5 + .5 * sinc(t, .0066)))}); }});
// head
M.action('shakeHead', {label:'Shake the head', group:'Head', dur:1700, gait:true, f:(t, T, c) => { const e = env(t, 150, 800, 600), w = .03;
  c.Q.yaw += .13 * e * sinc(t, w); c.jd('head', .05 * e * sinc(t, w, 1.2)); c.jd('neck', .03 * e * sinc(t, w, .6)); c.jd('earR', .3 * e * sinc(t, w * 1.2)); c.jd('earL', -.3 * e * sinc(t, w * 1.2, .8)); c.jd('dewA', .12 * e * sinc(t, w, 2)); c.spec(T, {orbic:mid(.5 * e), earBack:mid(.3 * e)}); }});
M.action('toss', {label:'Toss the head', group:'Head', dur:2000, gait:true, f:(t, T, c) => { const a = KS(t, [[0, 0], [260, -1], [560, 1.2], [860, .15], [1400, 0]]), m = KS(t, [[0, 0], [560, 0], [700, 1.1], [1300, 0]]);
  c.jt('neck', -.2 * a); c.jt('head', -.2 * a); c.jd('dewA', .1 * m * sinc(t, .03)); c.spec(T, {earBack:mid(.5 * pos(a)), orbic:mid(.3 * pos(a)), throat:.25 * m}); }});
M.action('sniff', {label:'Sniff', group:'Head', dur:5200, in:['stand', 'lie', 'brace'], gait:false, f:(t, T, c) => { const lo = KS(t, [[0, 0], [700, 1], [3800, 1], [4800, 0]]), sn = lo * (.5 + .5 * sinc(t, .021)), A = c.shiftAmt();
  c.jt('neck', .3 * lo * A); c.jt('head', -.1 * lo * A); c.Q.yaw += .15 * sinc(t, .0016) * lo; c.spec(T, {nostril:mid(.7 * sn), nasalis:.35 * sn, nasolab:mid(.3 * sn), levPalp:mid(.15 * lo), earFwd:mid(.3 * lo), intercostals:.4 * sn}); }});
// body
M.action('shake', {label:'Shake all over', group:'Body', dur:2400, big:true, in:['stand'], f:(t, T, c) => {
  const e = d => env(t - d, 150, 900, 700), ph = k => sinc(t, .03, -k), pre = KS(t, [[0, 0], [300, 1], [650, 0]]);
  c.rootAbout([450, 400], 0, 0, 10 * e(0) + 8 * pre); c.Q.yaw += .1 * e(0) * ph(0);
  c.jd('head', .06 * e(0) * ph(.4)); c.jd('neck', .06 * e(60) * ph(1)); c.jd('chest', .05 * e(140) * ph(2)); c.jd('pelvis', .06 * e(240) * ph(3));
  for(let k = 0; k < 5; k++) c.jd('tail' + k, .16 * e(300 + 40 * k) * ph(4 + k)); c.jd('dewA', .14 * e(0) * ph(1)); c.jd('hump', .03 * e(100) * ph(2));
  c.spec(T, {orbic:mid(.7 * e(0)), earBack:mid(.6 * e(30)), intercostals:.4 * e(100), rhomboid:.3 * e(60)});
  }});
M.action('swish', {label:'Swish the tail', group:'Body', dur:3000, gait:true, f:(t, T, c) => { const e = KS(t, [[0, 0], [500, 1], [2200, 1], [3000, 0]]);
  for(let k = 0; k < 5; k++) c.jd('tail' + k, .12 * e * (.4 + k * .15) * sinc(t - 150 * k, .0034)); c.jd('tuftB', .25 * e * sinc(t - 800, .0034, .9)); c.spec(T, {levCaudae:.2 * e, flexTip:.5 * e * (.5 + .5 * sinc(t, .0034))}); }});
M.action('lash', {label:'Lash the tail', group:'Body', dur:2400, gait:true, f:(t, T, c) => { const e = KS(t, [[0, 0], [260, 1], [1700, 1], [2400, 0]]), q = sinc(t, .0105);
  for(let k = 0; k < 5; k++) c.jd('tail' + k, .1 * e * (.35 + k * .14) * sinc(t - 70 * k, .0088)); c.jd('tuftB', .3 * e * sinc(t - 400, .0088, 1.2)); c.jt('pelvis', -.03 * e);
  c.spec(T, {levCaudae:.3 * pos(-q) * e + .1 * e, depCaudae:.4 * pos(q) * e, flexMid:.4 * e, flexTip:.5 * e * Math.abs(q), earBack:mid(.4 * e), orbic:mid(.4 * e), corrug:mid(.5 * e), nostril:mid(.3 * e)}); }});
M.action('twitch', {label:'Twitch the skin', group:'Body', dur:1500, tiny:true, gait:true, f:(t, T, c, a) => {
  c.spec(T, {panniculusA:pulse(t, 0, 50, 30, 220) * 1.2, panniculusB:pulse(t, 110, 50, 30, 220) * 1.2, panniculusC:pulse(t, 220, 50, 30, 240) * 1.2});
  a.x = a.x ?? 300 + c.rand() * 280; for(const [k, t0, dx] of [[1, 0, 0], [2, 120, -70], [3, 240, -140]]) if(t >= t0 && !a['t' + k]){ a['t' + k] = 1; const p = c.wp('chest', [a.x + dx, 410]); c.burstAt(p[0], p[1], 46, K.mixInt(K.hexInt(K.ROSTER.bone), c.C.ink, .45)); } }});
M.action('stamp', {label:'Stamp a hoof', group:'Body', dur:1500, in:['stand', 'brace'], f:(t, T, c, a) => { const k = a.leg ?? (a.leg = c.rand() < .5 ? 2 : 0), e = KS(t, [[0, 0], [160, 1], [400, 1], [520, 0]]), f = c.foot(k);
  const lift = pulse(t, 100, 160, 90, 200) * 34, tap = pulse(t, 620, 60, 10, 90) * 22, tilt = (k === 0 ? .5 : .45) * (pulse(t, 100, 160, 90, 200) + .5 * pulse(t, 620, 60, 10, 90));
  c.legTo(k, f[0] - 4 * e, f[1] - lift - tap, f[2] + tilt * (k === 0 ? 1 : -1), 1, 1, {kk:16}); c.rootAbout(PIV, 0, 0, 3 * e * c.shiftAmt()); }});
M.action('paw', {label:'Paw the ground', group:'Display', dur:6600, big:true, in:['stand', 'brace'], f:(t, T, c, a) => {
  const e = KS(t, [[0, 0], [500, 1], [6000, 1], [6500, 0]]), A = c.shiftAmt(), u = KS(t, [[0, 0], [700, 0], [1100, 1], [5500, 1], [6200, 0]]), cyc = clamp((t - 900) / 1150, 0, 4.4), p = cyc - Math.floor(cyc);
  const sw = clamp(p / .34), sc = clamp((p - .34) / .44), f = c.foot(0), dx = (cyc >= 4.4 || cyc <= 0) ? -34 : sw < 1 ? -34 + 68 * KS(sw, [[0, 0], [1, 1]]) : 34 - 68 * KS(sc, [[0, 0], [1, 1]]);
  const dy = (sw < 1 && cyc > 0 && cyc < 4.4) ? -48 * Math.sin(Math.PI * sw) : 0, db = (sw < 1 && cyc > 0 && cyc < 4.4) ? .75 * Math.sin(Math.PI * sw) : (sc < 1 ? -.12 : 0);
  c.legTo(0, f[0] + dx, f[1] + dy, f[2] + db, u, u, {kk:13});
  c.rootAbout(PIV, -.006 * e * A, -9 * e * A, 3 * e * A + 2 * Math.sin(p * Math.PI * 2) * u); c.jt('neck', .22 * e * A); c.jt('head', -.1 * e * A); c.Q.yaw += .1 * e; c.jt('chest', .02 * e);
  c.spec(T, {nostril:mid(.45 * e + .3 * pulse(t, 600, 80, 40, 300)), corrug:mid(.5 * e), earBack:mid(.3 * e), rhomboid:.4 * e, levCaudae:.2 * e, intercostals:.5 * e, hypaxial:.15 * e}); }});
M.action('hook', {label:'Hook with the horns', group:'Display', dur:2900, big:true, in:['stand', 'brace'], f:(t, T, c, a) => { const d = a.dir ?? (a.dir = c.rand() < .5 ? -1 : 1), w = KS(t, [[0, 0], [500, -1], [860, 1.35], [1300, .35], [2100, 0]]), A = c.shiftAmt();
  c.jt('neck', -.36 * w * A + .1 * pos(-w) * A); c.jt('head', -.26 * w); c.Q.yaw += d * .36 * w; c.rootAbout(PIV, -.02 * w * A, 0, 8 * pos(-w) * A); c.jt('chest', -.04 * w);
  const m = pos(w); c.spec(T, {nostril:mid(.7 * m), earBack:mid(.45 * m), corrug:mid(.6 * m), orbic:mid(.3 * m), throat:.3 * m, rhomboid:.5 * m, intercostals:.5 * m}); c.flushT = Math.max(c.flushT, .5 * m); }});

/* ---------- pads ---------- */
const ga = (c, id, s = 0) => c.act(id, s);
M.pad('jaw', {label:'Jaw', group:'Head', x:['to the left', 'to the right'], y:['shut', 'open'], map:(x, y) => ({digastric:pos(y), depLab:.5 * pos(y), masseter:.7 * pos(-y), temporalis:.5 * pos(-y), chewR:pos(x), chewL:pos(-x)}), ghost:c => [cl(ga(c, 'chewR') - ga(c, 'chewL')), cl(ga(c, 'digastric') - ga(c, 'masseter'))]});
M.pad('muzzle', {label:'Muzzle · nostrils', group:'Head', split:'LR', x:['pads', 'flare'], y:['lower', 'curl'], map:(x, y) => ({nasolab:pos(-x), nostril:pos(x), levLab:pos(y), depLab:.7 * pos(-y), nasalis:.5 * pos(y)}), ghost:(c, s) => [cl(ga(c, 'nostril', s) - ga(c, 'nasolab', s)), cl(ga(c, 'levLab', s) - ga(c, 'depLab', s))]});
M.pad('eyes', {label:'Eyes · brow', group:'Head', split:'LR', x:['squint', 'wide'], y:['knit', 'raise'], map:(x, y) => ({orbic:pos(-x), levPalp:pos(x), corrug:pos(-y), frontalis:pos(y)}), ghost:(c, s) => [cl(ga(c, 'levPalp', s) - ga(c, 'orbic', s)), cl(ga(c, 'frontalis', s) - ga(c, 'corrug', s))]});
M.pad('gaze', {label:'Gaze', group:'Head', x:['left', 'right'], y:['down', 'up'], map:(x, y) => ({lookR:pos(x), lookL:pos(-x), lookU:pos(y), lookD:pos(-y)}), ghost:c => [cl(ga(c, 'lookR') - ga(c, 'lookL')), cl(ga(c, 'lookU') - ga(c, 'lookD'))]});
M.pad('ears', {label:'Ears', group:'Head', split:'LR', x:['back', 'forward'], y:['droop', 'perk'], map:(x, y) => ({earBack:pos(-x) + .5 * pos(-y), earUp:pos(y), earFwd:pos(x)}), ghost:(c, s) => [cl(ga(c, 'earFwd', s) - ga(c, 'earBack', s)), cl(ga(c, 'earUp', s) - .5 * ga(c, 'earBack', s))]});
M.pad('head', {label:'Head', group:'Head', x:['turn left', 'turn right'], y:['lowered', 'raised'], map:(x, y) => ({splenius:[pos(-x), pos(x)]}), fx:(c, x, y) => { c.jt('neck', -.5 * y); c.jt('head', -.18 * y); }, ghost:c => [cl(ga(c, 'splenius', 1) - ga(c, 'splenius', 0)), cl(-c.jr[c.d.BI.neck] / .5)]});
M.pad('hook', {label:'Hook · toss', group:'Head', x:['sweep left', 'sweep right'], y:['dip', 'toss'], fx:(c, x, y) => { c.Q.yaw += .45 * x; c.jt('neck', -.4 * pos(y) + .3 * pos(-y)); c.jt('head', -.3 * pos(y) + .15 * pos(-y)); c.jt('chest', -.04 * y); }, ghost:c => [cl(c.yaw / .45), cl(-c.jr[c.d.BI.head] / .3)]});
M.pad('neck', {label:'Neck · hump', group:'Body', x:['curl', 'extend'], y:['relaxed', 'bunched'], map:(x, y) => ({neckDown:pos(-x), neckUp:pos(x), rhomboid:pos(y), throat:.3 * pos(y)}), ghost:c => [cl(ga(c, 'neckUp') - ga(c, 'neckDown')), cl(ga(c, 'rhomboid'))]});
M.pad('spine', {label:'Spine', group:'Body', x:['sway', 'arch'], y:['crouch', 'rise'], map:x => ({epaxial:pos(x), hypaxial:pos(-x)}), fx:(c, x, y) => { c.Q.ry += 20 * pos(-y) - 3 * pos(y); c.jt('chest', -.05 * y); }, ghost:c => [cl(ga(c, 'epaxial') - ga(c, 'hypaxial')), cl(-c.root.y / 30)]});
M.pad('breath', {label:'Breath', group:'Body', x:['shallow', 'deep'], y:['slow', 'fast'], fx:(c, x, y) => { c.breath.depth = 2 ** (x * 1.4); c.breath.rate = 2 ** (y * 1.2); }, alwaysFx:false, ghost:c => [cl(Math.log2(c.breath.depth) / 1.4), cl(Math.log2(c.breath.rate) / 1.2)]});
M.pad('skin', {label:'Dewlap · skin', group:'Body', x:['hang', 'lift'], y:['still', 'twitch'], map:x => ({cutaneus:pos(x)}), fx:(c, x, y) => { const s = pos(y); c.jd('dewA', .22 * s * sinc(c.t, .0042)); c.jd('dewB', .26 * s * sinc(c.t, .0042, 1)); c.spec(c.Ta, {panniculusA:.6 * s * (.5 + .5 * sinc(c.t, .012)), panniculusB:.6 * s * (.5 + .5 * sinc(c.t, .012, 1.1)), panniculusC:.6 * s * (.5 + .5 * sinc(c.t, .012, 2.2))}); }, ghost:c => [cl(ga(c, 'cutaneus')), cl(ga(c, 'panniculusB'))]});
M.pad('foreleg', {label:'Foreleg', group:'Limbs', split:'NF', leg:'fore', x:['back', 'reach'], y:['flex', 'extend'], map:(x, y) => ({deltoid:pos(x), latissimus:pos(-x), supraspinatus:.4 * pos(x), pectoral:.4 * pos(-x), brachialis:pos(-y), flexCarpi:.7 * pos(-y), hoofFlexF:.5 * pos(-y), hoofExtF:.4 * pos(y), triceps:pos(y), extCarpi:.5 * pos(y)})});
M.pad('hindleg', {label:'Hindleg', group:'Limbs', split:'NF', leg:'hind', x:['drive', 'swing'], y:['flex', 'extend'], map:(x, y) => ({glutes:pos(-x), gastroc:.5 * pos(-x) + .4 * pos(y), hipFlex:pos(x), tfl:.5 * pos(x), hamstrings:pos(-y), tibialis:.7 * pos(-y), hoofFlexH:.5 * pos(-y), hoofExtH:.4 * pos(y), quads:pos(y)})});
M.pad('tail', {label:'Tail', group:'Limbs', x:['hold in', 'swing out'], y:['straight', 'curl'], map:(x, y) => ({depCaudae:pos(-x), levCaudae:pos(x), flexMid:.6 * pos(y), flexTip:y}), ghost:c => [cl(ga(c, 'levCaudae') - ga(c, 'depCaudae')), cl(ga(c, 'flexTip'))]});

/* ---------- hooks: idle, what each posture holds, the gaits' body, the glyph's path, life ---------- */
const cirS = (x, y, c0) => (((Math.atan2(y - c0[1], x - c0[0]) + Math.PI * 2.5) % (Math.PI * 2)) / (Math.PI * 2)), RING = hw([0, -67]);
K.define(M.finish({
  /* the anatomy audit reads these as deliberate: the nuchal line, the elbow pocket and the flank fold are skin lines of the trunk and neck that stay with them while the ear or the leg lies under or beside them */
  audit:{allow:{deadParts:['^(nuchal|elbowPocket|flankFold)$']}},
  strideMax:230,
  idle(c, now, Ti){
    const br = .5 + .5 * Math.sin(now * .00125 * c.breath.rate + 1), d = c.breath.depth;
    c.spec(Ti, {intercostals:(.12 + .38 * br) * d, flank:(.1 + .32 * br) * d, nostril:mid(.04 + .1 * br * d), epaxial:.05 * Math.sin(now * .0007), levCaudae:.07 + .07 * Math.sin(now * .0006), flexTip:.1 + .1 * Math.sin(now * .0011 + 1), earBack:[.06 + .05 * Math.sin(now * .0008), .06 + .05 * Math.sin(now * .0009 + 1.3)],
      lookR:mid(pos(Math.sin(now * .00057)) * .5), lookL:mid(pos(-Math.sin(now * .00057)) * .5), earFwd:mid(.06 + .05 * Math.sin(now * .0005 + 2))});
    if(c.every('blink', [2400, 6200], now)) c.actions.push({name:'blink', t0:now});
    if(c.every('ear', [5000, 12000], now)) c.actions.push({name:'ear', t0:now});
    if(c.every('twitch', [9000, 20000], now) && !c.gs.on) c.actions.push({name:'twitch', t0:now});
  },
  postureHold(c, w, Ta){
    const rest = w.lie + .5 * w.kneel;
    c.spec(Ta, {intercostals:.34 * rest + .3 * w.brace + .9 * w.rear, flank:.12 * w.lie + .2 * w.brace, nostril:mid(.38 * w.brace + .25 * w.rear), corrug:mid(.4 * w.brace + .3 * w.rear), earBack:mid(.22 * w.brace + .12 * w.rear + .12 * w.lie), earFwd:mid(.2 * w.kneel), rhomboid:.6 * w.brace + .25 * w.rear,
      splenius:[0, .85 * w.brace], levCaudae:.25 * w.brace + .3 * w.rear, depCaudae:.3 * w.lie, flexTip:.15 * w.lie, orbic:mid(.25 * w.lie), neckUp:.2 * w.rear, hypaxial:.1 * w.lie + .2 * w.brace, epaxial:.3 * w.rear + .1 * w.brace,
      throat:.15 * w.brace, dilator:mid(.3 * w.brace), levPalp:mid(.2 * w.brace)});
  },
  gaitBody(c, G, k, ph, mk){
    { const fl = [0, 0, 0, 0], ex = [0, 0, 0, 0];   // the feet through a step: the hoof closes as the foot lifts and opens to land
      for(let j = 0; j < 4; j++){ const L = c.gs.legs[j]; if(!L || L.stance) continue; const p = clamp(L.p); fl[j] = .75 * fSmooth(0, .25, p) * (1 - fSmooth(.45, .8, p)); ex[j] = .6 * fSmooth(.6, .95, p); }
      c.spec(c.Ta, {hoofFlexF:[fl[0] * k, fl[1] * k], hoofFlexH:[fl[2] * k, fl[3] * k], hoofExtF:[ex[0] * k, ex[1] * k], hoofExtH:[ex[2] * k, ex[3] * k]}); }
    const w2 = 4 * Math.PI * ph, ch = G.name === 'charge' ? 1.7 : G.name === 'trot' ? 1.15 : 1, a = 2 * Math.PI * ph;
    c.jt('neck', .05 * k * mk * ch * Math.sin(w2 + 2.4)); c.jt('head', -.03 * k * mk * ch * Math.sin(w2 + 2.4)); c.jt('chest', (.045 * Math.sin(a + .2) + .02 * Math.sin(w2)) * k * mk * ch); c.jt('pelvis', (-.045 * Math.sin(a + 2.9) - .02 * Math.sin(w2 + 1.2)) * k * mk * ch);
    c.jd('body', .012 * k * mk * ch * Math.sin(a + 1.4));
    c.spec(c.Ta, {levCaudae:(.1 + .12 * (ch - 1)) * k * (1 + Math.sin(w2 + 1)), rhomboid:.25 * k * ch, intercostals:.22 * k * ch, flank:.2 * k * ch, nostril:mid((.1 + .35 * (ch - 1)) * k), earBack:mid(.2 * (ch - 1) * k)});
  },
  glyph:(x, y, P) => P.name === 'crescentInlay' ? [.02 + .6 * hornS(x, y), 1] : P.name === 'horns' ? [.02 + .6 * hornS(x, y), .5] : P.name === 'browRing' ? [.64 + .36 * cirS(x, y, RING), 1] : P.name === 'foreheadC' && Math.hypot(x - RING[0], y - RING[1]) < 40 * HS ? [.64 + .36 * cirS(x, y, RING), .35] : null,
  shiftOf:{lie:.95, kneel:.9, rear:.9, brace:.45},
  life:{rate:1.8,
    small:[['glance', 3, 5000], ['ear', 3.5, 3000], ['slowblink', 1.6, 9000], ['swish', 2.6, 6000], ['twitch', 2.2, 5000], ['sigh', 2, 9000], ['snort', 1.5, 9000], ['nod', .8, 12000], ['shakeHead', .9, 14000], ['toss', .8, 16000],
      ['lickNose', 1, 14000], ['listen', 1.3, 12000], ['low', .5, 30000, ['stand', 'brace', 'lie']], ['bellow', .35, 40000, ['stand', 'brace', 'rear']], ['glyph', 1.4, 12000],
      ['flehmen', .5, 40000, ['stand', 'lie']], ['chew', 2.2, 20000, ['lie'], {lie:3.5}], ['chew', .7, 40000, ['stand']], ['sniff', .5, 30000, ['stand']], ['stamp', .9, 12000, ['stand', 'brace']], ['shake', .3, 60000, ['stand']],
      ['lash', .7, 20000, ['brace', 'stand']], ['paw', 1.9, 22000, ['brace']], ['paw', .25, 60000, ['stand']], ['hook', 1.1, 26000, ['brace']], ['hook', .2, 70000, ['stand']], ['snort', 2.4, 7000, ['brace'], {brace:2.4}]],
    moves:[['go:lie', .6, 36000, ['stand']], ['go:stand', 1.4, 0, ['lie', 'kneel', 'rear']], ['go:brace', .9, 30000, ['stand']], ['charge', .9, 28000, ['brace']], ['go:stand', .7, 0, ['brace']], ['walk', .6, 22000, ['stand']], ['trot', .3, 50000, ['stand']], ['go:rear', .2, 90000, ['stand']], ['go:stand', 1, 0, ['kneel']]],
    dwell:{stand:[4000, 9000], lie:[12000, 26000], kneel:[600, 1200], brace:[5000, 9000], rear:[2600, 4600]},
    gait:[['glance', 3, 5000], ['ear', 3.5, 3000], ['swish', 2, 6000], ['snort', 1.4, 8000], ['shakeHead', .6, 14000], ['twitch', 2, 5000], ['toss', .6, 16000], ['bellow', .15, 70000]], gaitFor:{walk:[3500, 7500], trot:[3000, 5500], charge:[2800, 4600]}},
}));
})();
