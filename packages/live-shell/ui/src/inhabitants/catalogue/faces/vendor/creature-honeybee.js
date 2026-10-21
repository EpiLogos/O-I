/* creature-honeybee.js — a worker honeybee (Apis mellifera), seen from above, in her hive. Read CREATURE-SPEC.md and CREATURE-NOTES-HONEYBEE.md (the research note first).

   THE ANIMAL. A worker, about 13 mm: a head with two big compound eyes, three ocelli, elbowed antennae (a scape and eleven more segments), spoon mandibles and a long folded proboscis; a fuzzy
   thorax of five dorsal plates; the narrow petiole; a banded abdomen of six visible tergites with the sting at its tip and the wax plates under it; two pairs of transparent wings coupled in flight by
   a row of hooks (the hamuli) on the hindwing; six legs, the hind pair with the pollen press, the comb and the basket on the tibia, the front pair with the antenna cleaner. Plan view, facing right.
   The wings are drawn the way the face rig draws a line: as veins (the cells are the gaps) with no fill, so the animal shows through them, as it does through a bee's wing.

   THE AGENCY (spec 19-28). The roster says Scout, Recruit, Quorum, Guard, Haul, Tend; changes with age. Each is an action the real animal does: the waggle dance (a figure-eight on the comb whose straight run
   carries a direction and whose circuits carry quality, and a stop signal ends it), the tremble dance (the unloading delay read as demand: Haul's backpressure), a scouting flight out and back, a guard's
   antennal check at the entrance (admit or refuse by odour), trophallaxis, grooming, packing pollen, the sting, fanning. The hive under her is a comb in a world that stays put (creature-ground.js): the
   store, the dance floor, the entrance and the field. Honest limits are in the notes. */
(() => {
'use strict';
const K = window.CreatureKit; K.require('1.2.0', 'creature-honeybee');
const M = K.model({id:'honeybee', name:'Honeybee', sign:'', title:'HONEYBEE', sub:'a worker, and the hive that is her record', w:1000, h:780, pivot:[500, 392], axis:500,
  ink:K.ROSTER.amber, accent:K.ROSTER.lapis, cam:[1, 470, 392]});
const {clamp, keys, env, pulse, mixInt, ringPts, chaikin, fSmooth, hash} = K, pos = v => Math.max(0, v), cl = v => Math.max(-1, Math.min(1, v));
const CX = 500, CY = 392, SIDE = [1, -1];                        // the body frame: a is forward (+x) from the middle of the thorax, b is the animal's right (+y on the page)
const P = (a, b) => [CX + a, CY + b];
const sd = s => s > 0 ? 'R' : 'L';
const bone_ = n => M.bones[M.BI[n]];
const interp = (T, x) => { for(let i = 0; i < T.length - 1; i++) if(x <= T[i + 1][0]){ const t = (x - T[i][0]) / (T[i + 1][0] - T[i][0] || 1); return T[i][1] + (T[i + 1][1] - T[i][1]) * t; } return T[T.length - 1][1]; };
function elbow(S, Wr, l1, l2, bend){ const dx = Wr[0] - S[0], dy = Wr[1] - S[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 4), t = Math.atan2(dy, dx) + bend * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)); return [S[0] + l1 * Math.cos(t), S[1] + l1 * Math.sin(t)]; }
const rot2 = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/* ---------- the proportions (1 mm = 41 units; the worker is about 13 mm, so about 540 units from the mandibles to the sting) ---------- */
const TH = [[-86, 34], [-78, 48], [-64, 60], [-46, 68], [-26, 73], [-6, 76], [14, 77], [34, 75], [50, 70], [64, 62], [74, 51], [80, 38], [84, 26]];   // the thorax's half width by a
const AB = [[-300, 12], [-290, 24], [-272, 42], [-250, 58], [-228, 68], [-204, 73], [-180, 74], [-156, 70], [-134, 60], [-118, 44], [-108, 28]];     // the abdomen's, from the tip to the petiole
const ABW = a => interp(AB, a), THW = a => interp(TH, a);

/* a plate between two stations of a body whose half width is given by w(a): bows are how far the plate's edges bulge along the body at the middle (positive: towards the head); half 1 or -1 takes the right or left half only */
function plate(w, a0, a1, bow0 = 0, bow1 = 0, half = 0, n = 5){
  const L = [], pts = [], N = Math.max(3, Math.round((a1 - a0) / 10)), sgn = half || 1;
  const lo = half ? 0 : -1, hi = 1;                                      // across the plate, as a share of the half width: from lo to hi
  for(let k = 0; k <= n; k++){ const u = lo + (hi - lo) * k / n; pts.push([a1 + bow1 * Math.cos(u * Math.PI / 2), sgn * u * w(a1)]); }
  for(let k = 1; k <= N; k++){ const a = a1 - (a1 - a0) * k / N; pts.push([a, sgn * w(a)]); }
  pts[pts.length - 1][0] += 0;
  for(let k = n - 1; k >= 0; k--){ const u = lo + (hi - lo) * k / n; pts.push([a0 + bow0 * Math.cos(u * Math.PI / 2), sgn * u * w(a0)]); }
  if(!half) for(let k = N - 1; k >= 1; k--){ const a = a0 + (a1 - a0) * k / N; pts.push([a, -w(a)]); }
  return pts.map(([a, b]) => P(a, b));
}

/* ---------- skeleton: body, thorax, a two-part abdomen with the sting, the neck and head, mouthparts, antennae, wings, legs ---------- */
M.bone('body', null, P(0, 0), P(60, 0), {grp:'root'});
M.bone('thorax', 'body', P(0, 0), P(80, 0), {grp:'thorax', lim:[-.08, .08], speed:5});
M.bone('abd', 'body', P(-96, 0), P(-218, 0), {grp:'abdomen', lim:[-.3, .3], speed:6, sec:true});
M.bone('abd2', 'abd', P(-218, 0), P(-300, 0), {grp:'abdomen', lim:[-.34, .34], speed:7, sec:true});
M.bone('sting', 'abd2', P(-262, 0), P(-392, 0), {grp:'sting', lim:[-.2, .2], speed:10, sec:true});
M.bone('head', 'thorax', P(84, 0), P(194, 0), {grp:'head', lim:[-.4, .4], speed:9, sec:true});
for(const s of SIDE) M.bone('mand' + sd(s), 'head', P(172, s * 38), P(224, s * 12), {grp:'mandible', lim:[-.55, .55], speed:14, sec:true});
M.bone('prob1', 'head', P(194, 0), P(280, 0), {grp:'proboscis', lim:[-.35, .35], speed:9, sec:true});
M.bone('prob2', 'prob1', P(280, 0), P(366, 0), {grp:'proboscis', lim:[-.4, .4], speed:11, sec:true});
M.bone('glossa', 'prob2', P(366, 0), P(452, 0), {grp:'proboscis', lim:[-.4, .4], speed:14, sec:true});

/* the antennae: the scape (long, from the socket), then the pedicel and the ten flagellomeres bent at the elbow; a bone each so the whole can curl */
const ANT = {R:[], L:[]}, ANTP = {};
{ const S0 = [182, 12], E0 = [236, 26];
  const flag = [E0]; let a = 1.05, p = E0;                                       // the flagellum leaves the elbow outward, then curves forward at its tip
  const lens = [13, 15, 14, 14, 13, 13, 12, 12, 11, 11, 10];                    // the pedicel and ten flagellomeres
  for(let i = 0; i < lens.length; i++){ a -= .035 + .005 * i; p = [p[0] + lens[i] * Math.cos(a), p[1] + lens[i] * Math.sin(a)]; flag.push(p); }
  ANTP.scape = [S0, E0]; ANTP.flag = flag;
  for(const s of SIDE){ const side = sd(s);
    M.bone('scape' + side, 'head', P(S0[0], s * S0[1]), P(E0[0], s * E0[1]), {grp:'antenna', lim:[-.7, .7], speed:9, sec:true}); ANT[side].push('scape' + side);
    for(let i = 0; i < 11; i++){ const nm = 'fl' + side + i; M.bone(nm, i ? 'fl' + side + (i - 1) : 'scape' + side, P(flag[i][0], s * flag[i][1]), P(flag[i + 1][0], s * flag[i + 1][1]), {grp:'antenna', lim:[-.55, .55], speed:9, sec:true}); ANT[side].push(nm); } } }

/* the wings. A wing is a rigid bone from its hinge; its rest is folded back over the body, held in a loose V. fw is the forewing (9.1 mm long, 3.0 mm wide), hw the hindwing (6.7 by 1.9 mm). */
const WL = {f:372, h:276}, WW = {f:124, h:80}, WHINGE = {f:[22, 56], h:[-42, 50]}, WSPLAY = .27;     // lengths, widths, hinges (a, b), the V's half angle at rest
const WANG = s => Math.atan2(s * Math.sin(WSPLAY), -Math.cos(WSPLAY));                           // a wing's rest direction (the angle of its bone)
for(const s of SIDE){ const side = sd(s);
  for(const k of ['f', 'h']){ const H = WHINGE[k], U = [Math.cos(WANG(s)), Math.sin(WANG(s))];
    M.bone((k === 'f' ? 'fw' : 'hw') + side, 'thorax', P(H[0], s * H[1]), [CX + H[0] + U[0] * WL[k], CY + s * H[1] + U[1] * WL[k]], {grp:'wing', lim:s > 0 ? [-2.75, .35] : [-.35, 2.75], speed:16, sec:true}); }
  /* the stroke's envelope: a bone that carries three arcs of the wing's sweep, turned to the wing's mean and scaled to the beat, so the beat's reach is drawn as the wing blurs */
  const H = WHINGE.f; M.bone('blur' + side, 'thorax', P(H[0], s * H[1]), [CX + H[0] + Math.cos(WANG(s)) * 100, CY + s * H[1] + Math.sin(WANG(s)) * 100], {grp:'wing', lim:s > 0 ? [-2.75, .35] : [-.35, 2.75], speed:16, sec:true, anat:false});
}

/* the legs: hip, then the tibia-tarsus joint (the ankle) and the toe in the body frame; the kit solves the knee. Front legs reach forward and out, the middle pair out, the hind pair back and out. */
const HIP = [[48, 40], [0, 48], [-46, 44]], TOE = [[178, 150], [70, 206], [-150, 176]], DIRT = [.55, 1.2, 2.7];                 // hips and toes in the body frame (a forward, b outward), the tarsus's direction from the ankle to the toe
const L1 = [76, 96, 112], L2 = [84, 106, 126], L3 = [78, 86, 94];                                              // femur, tibia and tarsus as seen from above (the femur and tibia slope down, so they foreshorten; the tarsus lies flat)
const BEND = [-1, 1, 1], LEGS = [];
for(const s of SIDE) for(let i = 0; i < 3; i++){
  const tag = sd(s) + i, hip = P(HIP[i][0], s * HIP[i][1]), toe = P(TOE[i][0], s * TOE[i][1]), dt = [Math.cos(DIRT[i]), s * Math.sin(DIRT[i])], wrist = [toe[0] - dt[0] * L3[i], toe[1] - dt[1] * L3[i]];
  const E = elbow(hip, wrist, L1[i], L2[i], BEND[i] * s);
  const grp = ((i + (s > 0 ? 0 : 1)) & 1) ? 'B' : 'A';                       // R0 L1 R2 against L0 R1 L2: the alternating tripod
  M.bone('u' + tag, 'body', hip, E, {grp, lim:[-2.6, 2.6]}); M.bone('l' + tag, 'u' + tag, E, wrist, {grp, lim:[-2.8, 2.8]}); M.bone('f' + tag, 'l' + tag, wrist, toe, {grp, lim:[-2.8, 2.8]});
  LEGS.push({s, i, tag, grp, hip, toe, wrist});
}
for(const L of LEGS) M.leg({bones:['u' + L.tag, 'l' + L.tag, 'f' + L.tag], bend:BEND[L.i] * L.s, kind:'leg' + L.i, side:L.s > 0 ? 'F' : 'N', grp:L.grp, roll:.6, reach:26,
  mus:[['pro' + L.tag, 'rem' + L.tag, -.4, .4], ['fle' + L.tag, 'ext' + L.tag, -.9, .9], ['dep' + L.tag, 'lev' + L.tag, -.6, .6]]});

/* ---------- the figure ---------- */
const ring = (c, r, n = 10, a0 = 0) => ringPts(c, r, n, a0);
const hairs = (pts, len, w) => pts.map(([x, y, ang, l]) => { const L = l ?? len, c = Math.cos(ang), s = Math.sin(ang); return [[x - s * w, y + c * w], [x + s * w, y - c * w], [x + c * L, y + s * L]]; });
const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

/* the abdomen: a membrane under six tergites, all skinned along the two abdomen bones so it bends as one body; a banded tone, the intersegmental gaps for the lines */
const ABS = a => { const w = fSmooth(-176, -246, a); return [['abd', 1 - w], ['abd2', w]].filter(x => x[1] > .01); };
M.zone('membrane', plate(ABW, -304, -104, -10, 14), {layer:5.4, tier:'L', h:44, bind:(x, y) => ABS(x - CX), line:'dim', tone:.02, tags:['body', 'abdomen'], zone:'skin'});
const TERG = [-110, -146, -184, -218, -250, -278, -304];
for(let i = 0; i < 6; i++){
  const a1 = TERG[i] + (i ? 10 : 0), a0 = TERG[i + 1], bow = i === 5 ? -14 : -6, n = 'tergite' + (i + 1);
  M.zone(n, plate(ABW, a0, a1, bow, 0), {layer:6 - i * .02, tier:'M', h:i === 5 ? 12 : i === 4 ? 17 : 24, bind:(x, y) => ABS(x - CX), line:'region', tags:['body', 'abdomen', 'tergite'],
    tone:(x, y) => { const a = x - CX, u = (a1 - a) / (a1 - a0); return .05 + .015 * i + .16 * fSmooth(.52, .86, u) + (hash(Math.round(x * .5 + y * 3)) - .5) * .02; }});
}
/* the wax plates: eight pale mirrors on the sternites, four a side, under the tergites' edges; the wax glands' muscle slides them out to show */
{ const list = [];
  for(const s of SIDE) for(let i = 0; i < 4; i++){ const a = -166 - i * 32, w = ABW(a); list.push([P(a + 14, s * (w - 24)), P(a - 12, s * (w - 24)), P(a - 14, s * (w - 4)), P(a + 12, s * (w - 4))]); }
  M.shapes('waxPlates', list, {layer:5.2, tier:'F', bind:(x, y) => ABS(x - CX), line:'feature', tone:.32, tags:['body', 'abdomen', 'wax'], zone:'wax'}); }
/* the petiole, the thin stalk between the thorax and the gaster */
M.shape('petiole', plate(a => 12 + 10 * Math.abs((a + 92) / 14), -108, -80, -2, 2), {layer:5.6, tier:'F', bind:{rigid:'abd'}, line:'region', tags:['body', 'abdomen'], tone:.14, zone:'skin'});
/* the sting: a stylet in its sheath, two lancets either side, drawn under the tip and folded inside it at rest; the muscle that protracts it scales the bone */
M.limb('quillSting', [[...P(-262, 0), 6.4, 6.4], [...P(-330, 0), 4.4, 4.4], [...P(-394, 0), .8, .8]], {layer:5.5, tier:'F', h:7, cols:1, bind:{rigid:'sting'}, line:'feature', tone:.82, tags:['body', 'sting'], zone:'sting'});
for(const s of SIDE) M.limb('quillLancet' + sd(s), [[...P(-270, s * 7.4), 2.2, 2.2], [...P(-330, s * 5.2), 1.7, 1.7], [...P(-386, s * 1.8), .7, .7]], {layer:5.52, tier:'F', h:6, cols:1, bind:{rigid:'sting'}, line:'feature', tone:.6, tags:['body', 'sting'], zone:'sting'});
M.shape('stingBase', ring(P(-262, 0), 12, 8), {layer:5.55, tier:'F', bind:{rigid:'abd2'}, line:'feature', tone:.5, tags:['body', 'sting'], zone:'sting'});

/* the thorax: five dorsal plates (pronotum, the scutum in two halves, scutellum, metanotum, propodeum) and the fur */
const THP = [[52, 84, 4, 0], [-10, 52, -5, -3, 1], [-10, 52, -5, -3, -1], [-40, -10, -9, -4], [-56, -40, -3, -9], [-84, -56, -10, -2]];
const THN = ['pronotum', 'scutumR', 'scutumL', 'scutellum', 'metanotum', 'propodeum'];
THP.forEach(([a0, a1, b0, b1, half], k) => M.zone(THN[k], plate(THW, a0, a1, b0, b1, half || 0), {layer:6.2, tier:'M', h:k === 4 ? 13 : k === 5 ? 18 : 28, bind:{rigid:'thorax'}, line:'region', tags:['body', 'thorax'], zone:'skin',
  tone:(x, y) => .07 + .05 * Math.sin((x - CX) * .04 + k) + (hash(Math.round(x + y * 5)) - .5) * .02}));
M.line('notaulusR', [P(48, 8), P(24, 14), P(4, 12), P(-8, 6)], {layer:6.5, bind:{rigid:'thorax'}, tags:['body', 'thorax'], line:'fine', tone:.2});
M.line('notaulusL', [P(48, -8), P(24, -14), P(4, -12), P(-8, -6)], {layer:6.5, bind:{rigid:'thorax'}, tags:['body', 'thorax'], line:'fine', tone:.2});
{ const R = rnd(11), list = [];                                       // the fur: backward-pointing barbed hairs over the plates, and a fringe leaving the outline
  for(let i = 0; i < 230; i++){ const a = -80 + R() * 160, w = THW(a), b = (R() * 2 - 1) * (w - 8); if(Math.abs(b) > w - 6) continue; const p = P(a, b); list.push([p[0], p[1], Math.PI + (R() - .5) * .9 + Math.sign(b) * .3 * (Math.abs(b) / w), 12 + R() * 9]); }
  M.shapes('whiskThorax', hairs(list, 14, 1.9), {layer:7, tier:'F', bind:{rigid:'thorax'}, line:{k:.55, c:.8, r:0, t:'bone', tk:.3}, tone:.5, tags:['body', 'thorax', 'hair'], zone:'hair'});
  const rim = []; for(let i = 0; i < 70; i++){ const a = -84 + R() * 168, w = THW(a), s = R() < .5 ? 1 : -1, p = P(a, s * (w - 3)), out = Math.atan2(s * 1, 0) + (a > 0 ? -s * .4 : s * .4); rim.push([p[0], p[1], out + (R() - .5) * .5, 10 + R() * 9]); }
  M.shapes('whiskRim', hairs(rim, 12, 2), {layer:5.9, tier:'F', bind:{rigid:'thorax'}, line:{k:.5, c:.7, r:0, t:'bone', tk:.3}, tone:.42, tags:['body', 'thorax', 'hair'], zone:'hair'}); }
{ const R = rnd(23), list = [];                                       // a little fur on the first tergites and a collar behind the head
  for(let i = 0; i < 70; i++){ const a = -112 - R() * 50, w = ABW(a), b = (R() * 2 - 1) * (w - 6), p = P(a, b); list.push([p[0], p[1], Math.PI + (R() - .5) * .7, 9 + R() * 6]); }
  M.shapes('whiskAbd', hairs(list, 11, 1.5), {layer:6.8, tier:'F', bind:(x, y) => ABS(x - CX), line:{k:.5, c:.7, r:0, t:'bone', tk:.3}, tone:.4, tags:['body', 'abdomen', 'hair'], zone:'hair'}); }

/* the head: a rounded triangle seen from above, the clypeus and labrum at the front, two compound eyes, three ocelli, and the antenna sockets */
const HD = [[84, 22], [86, 36], [96, 48], [112, 57], [132, 62], [154, 59], [172, 49], [184, 36], [190, 20], [192, 0]];
const HDW = a => interp(HD, a);
const headOutline = chaikin(HD.map(([a, b]) => P(a, b)).concat(HD.slice().reverse().map(([a, b]) => P(a, -b))), 1);
M.zone('head', headOutline, {layer:8, tier:'M', h:24, bind:{rigid:'head'}, line:'region', tags:['body', 'head'], zone:'skin', tone:(x, y) => .07 + .05 * Math.sin((x - CX) * .06)});
M.zone('clypeus', plate(a => 26 - (a - 168) * .4, 168, 192, 3, 5), {layer:8.3, tier:'F', h:12, bind:{rigid:'head'}, line:'feature', tags:['head', 'mouth'], zone:'mouth', tone:.2});
M.zone('labrum', chaikin([P(190, -12), P(204, -9), P(210, 0), P(204, 9), P(190, 12)], 1), {layer:8.35, tier:'F', h:9, bind:{rigid:'head'}, line:'feature', tags:['head', 'mouth'], zone:'mouth', tone:.3});
for(const s of SIDE){ const side = sd(s), c = P(134, s * 47);                  // the compound eye: a kidney of facets, the eye's one colour
  const outline = K.ellipsePts(c, 37, 18.5, 18, 0.12 * s);
  M.zone('eye' + side, outline, {layer:8.5, tier:'F', h:11, inset:.5, bind:{rigid:'head'}, line:'feature', ink:'accent', zone:'eyes', tags:['head', 'eye'],
    tone:(x, y) => .38 + .5 * (1 - Math.min(1, Math.hypot((x - c[0]) / 32, (y - c[1]) / 16)))});
  for(const [a, b, r, nm] of [[112, 15, 6, 'ocL'], [112, -15, 6, 'ocR'], [130, 0, 6.5, 'ocM']]) if(s > 0) M.polar(nm, P(a, b), [0, r], [8], {layer:8.6, tier:'F', h:7, bind:{rigid:'head'}, line:'feature', tags:['head', 'ocellus'], zone:'eyes', tone:.6});
  M.shape('socket' + side, ring(P(184, s * 14), 5.4, 8, .3), {layer:8.4, tier:'F', bind:{rigid:'head'}, line:'fine', tags:['head', 'antenna'], tone:.3});
}
{ const R = rnd(31), list = [];                                       // the face's fur, short and brown, between the eyes and behind them
  for(let i = 0; i < 60; i++){ const a = 88 + R() * 78, w = HDW(a), b = (R() * 2 - 1) * (w - 20); const p = P(a, b); if(Math.hypot(a - 134, Math.abs(b) - 47) < 20) continue; list.push([p[0], p[1], Math.PI + (R() - .5) * .8, 7 + R() * 5]); }
  M.shapes('whiskHead', hairs(list, 8, 1.3), {layer:8.2, tier:'F', bind:{rigid:'head'}, line:{k:.5, c:.7, r:0, t:'bone', tk:.3}, tone:.4, tags:['body', 'head', 'hair'], zone:'hair'}); }
/* the mandibles: spoon-shaped blades, hinged at the sides of the face, closing across the front */
for(const s of SIDE){ const side = sd(s), b = 'mand' + side;
  M.limb('mandible' + side, [[...P(172, s * 38), 9, 9], [...P(190, s * 30), 8.6, 7], [...P(210, s * 18), 7.4, 5], [...P(224, s * 10), 5, 2.4], [...P(230, s * 6), 1.4, 1.4]], {layer:8.7, tier:'F', h:9, bind:{rigid:b}, line:'contour', tags:['head', 'mandible', 'mouth'], zone:'mouth', tone:cx => clamp((cx - CX - 176) / 60, .25, .95)});
  M.shapes('mteeth' + side, [[P(206, s * 21), P(214, s * 16), P(210, s * 13)], [P(214, s * 15), P(222, s * 12), P(217, s * 9)]], {layer:8.75, tier:'F', bind:{rigid:b}, line:'feature', tone:.95, tags:['head', 'mandible', 'mouth'], zone:'mouth'}); }
/* the proboscis, folded back under the head and thorax at rest (hidden under them) and swung out and forward to feed: the sheath of the maxillae, the prementum and the hairy glossa with its spoon */
M.limb('stipes', [[...P(194, 0), 7.5, 7.5], [...P(280, 0), 6.5, 6.5]], {layer:4.2, tier:'F', h:10, cols:1, bind:{rigid:'prob1'}, line:'region', tags:['proboscis', 'mouth'], zone:'mouth', tone:.2});
M.limb('prementum', [[...P(280, 0), 6.5, 6.5], [...P(366, 0), 5, 5]], {layer:4.22, tier:'F', h:10, cols:1, bind:{rigid:'prob2'}, line:'region', tags:['proboscis', 'mouth'], zone:'mouth', tone:.26});
M.limb('glossaShaft', [[...P(366, 0), 3.4, 3.4], [...P(440, 0), 2.6, 2.6], [...P(452, 0), 3.2, 3.2]], {layer:4.24, tier:'F', h:10, cols:1, bind:{rigid:'glossa'}, line:'feature', tags:['proboscis', 'mouth'], zone:'mouth', tone:.5});
M.zone('labellum', ring(P(452, 0), 6, 8), {layer:4.26, tier:'F', h:7, inset:.4, bind:{rigid:'glossa'}, line:'feature', tags:['proboscis', 'mouth'], zone:'mouth', tone:.6});
for(const s of SIDE) M.limb('palp' + sd(s), [[...P(372, s * 4), 2.6, 2.6], [...P(400, s * 6), 2.2, 2.2], [...P(420, s * 5), 1.4, 1.4]], {layer:4.23, tier:'F', h:8, cols:1, bind:{rigid:'prob2'}, line:'fine', tags:['proboscis', 'mouth'], zone:'mouth', tone:.3});
M.polar('droplet', P(458, 0), [0, 2], [8], {layer:4.3, tier:'F', h:4, bind:{rigid:'glossa'}, line:'feature', ink:'gold', tags:['proboscis', 'droplet'], zone:'mouth', tone:.7});

/* the antennae: a scape and an elbow, then eleven short segments each its own bead, narrowing; the sensilla make the beads rough */
for(const s of SIDE){ const side = sd(s), A = ANT[side];
  const b0 = bone_(A[0]); M.limb('scapeP' + side, [[b0.p[0], b0.p[1], 6.2, 6.2], [b0.q[0], b0.q[1], 5.2, 5.2]], {layer:8.8, tier:'F', h:10, cols:1, bind:{rigid:A[0]}, line:'region', tags:['head', 'antenna', 'scape'], zone:'skin', tone:.2});
  for(let i = 0; i < 11; i++){ const b = bone_(A[i + 1]), w = 3.0 - i * .1;
    M.limb('ant' + side + i, [[b.p[0], b.p[1], w, w], [b.q[0], b.q[1], w - .35, w - .35]], {layer:8.82 + i * .001, tier:'F', h:9, cols:1, bind:{rigid:A[i + 1]}, line:'feature', tags:['head', 'antenna'], zone:'skin', tone:.28 + (i % 2) * .08}); } }

/* the wings. A wing is veins and an outline; the cells are the gaps. A point on a wing is (u, c): u along it from the hinge as a share of its length, c across it from the leading edge as a share of its chord (0 leading, 1 trailing). */
const WOUT = {f:{L:[[0, .22], [.03, .08], [.1, .025], [.25, 0], [.5, 0], [.7, .012], [.84, .04], [.93, .09], [.985, .17]], T:[[0, .3], [.04, .52], [.1, .72], [.2, .88], [.35, .99], [.5, 1], [.65, .95], [.78, .8], [.88, .6], [.95, .42], [.99, .26]]},
  h:{L:[[0, .24], [.04, .09], [.12, .02], [.3, 0], [.55, 0], [.8, .02], [.93, .08], [.985, .18]], T:[[0, .32], [.06, .56], [.14, .76], [.28, .93], [.42, 1], [.58, .96], [.74, .82], [.86, .62], [.94, .42], [.99, .26]]}};
const VEINS = {f:[                                                    // [name, role, points (u, c)]: schematic after Ruttner's plates of Apis mellifera: the radius along the front, three submarginal cells, the discoidal cells under them
  ['R', 'thick', [[.05, .16], [.14, .12], [.3, .1], [.56, .09]]],
  ['Rmargin', 'thick', [[.56, .09], [.72, .07], [.86, .08], [.95, .12]]],
  ['Cu', 'mid', [[.04, .3], [.14, .31], [.26, .34], [.4, .37]]],
  ['subm1', 'mid', [[.4, .37], [.5, .31], [.58, .3], [.6, .09]]],
  ['lower', 'mid', [[.58, .3], [.7, .26], [.82, .2], [.87, .12], [.86, .09]]],
  ['subm2', 'fine', [[.7, .26], [.7, .075]]],
  ['subm3', 'fine', [[.82, .2], [.82, .08]]],
  ['M', 'mid', [[.12, .5], [.26, .51], [.4, .5], [.52, .52], [.62, .5], [.74, .42]]],
  ['mcu', 'fine', [[.4, .37], [.4, .5]]],
  ['disc1', 'fine', [[.52, .52], [.58, .3]]],
  ['disc2', 'fine', [[.62, .5], [.7, .26]]],
  ['anal', 'fine', [[.05, .46], [.18, .62], [.3, .74], [.42, .8]]],
  ['basal', 'fine', [[.14, .31], [.12, .5]]],
  ['stigma', 'thick', [[.54, .06], [.6, .06], [.6, .1], [.54, .1]]]],
  h:[
  ['R', 'thick', [[.05, .18], [.2, .1], [.45, .07], [.7, .07], [.9, .1]]],
  ['M', 'mid', [[.08, .36], [.22, .34], [.38, .34], [.5, .3]]],
  ['Cu', 'fine', [[.14, .5], [.3, .5], [.44, .42]]],
  ['cross', 'fine', [[.22, .34], [.26, .5]]],
  ['anal', 'fine', [[.1, .62], [.26, .74], [.4, .8]]]]};
/* a point on a wing, in the rest pose: the hinge, u along the wing (a share of its length), c across it from the leading edge (a share of its chord; the hinge is at c .26). The leading edge is the outer one when the wing lies folded back. */
const wingPt = (s, k, u, c) => { const H = WHINGE[k], ang = WANG(s), U = [Math.cos(ang), Math.sin(ang)], N = s > 0 ? [U[1], -U[0]] : [-U[1], U[0]];   // N: across the wing, towards its leading edge
  return [CX + H[0] + U[0] * u * WL[k] - N[0] * (c - .26) * WW[k], CY + s * H[1] + U[1] * u * WL[k] - N[1] * (c - .26) * WW[k]]; };
const wingOutline = (s, k) => { const O = WOUT[k], L = O.L.map(([u, c]) => wingPt(s, k, u, c)), T = O.T.map(([u, c]) => wingPt(s, k, u, c)); return chaikin(L.concat([wingPt(s, k, 1.0, .215)], T.slice().reverse()), 1); };
const WLINE = {thick:{k:.55, c:.8, r:'b', t:'bone', tk:.3}, mid:{k:.5, c:.7, r:'f', t:'bone', tk:.3}, fine:{k:.4, c:.5, r:'f', t:'bone', tk:.2}, edge:{k:.5, c:.74, r:'f', t:'bone', tk:.28}};
/* the thin veins as one walk through the net (a vein is gone over twice where the walk doubles back); the radius and the stigma are the thick part */
const WALK = {
  f:[[.04, .3], [.14, .31], [.26, .34], [.4, .37], [.5, .31], [.58, .3], [.6, .09], [.58, .3], [.7, .26], [.7, .075], [.7, .26], [.82, .2], [.82, .08], [.82, .2], [.87, .12], [.86, .09], [.87, .12], [.82, .2], [.7, .26], [.62, .5], [.74, .42], [.62, .5],
     [.52, .52], [.58, .3], [.52, .52], [.4, .5], [.4, .37], [.4, .5], [.26, .51], [.12, .5], [.14, .31], [.12, .5], [.18, .62], [.3, .74], [.42, .8], [.3, .74], [.18, .62], [.05, .46]],
  h:[[.08, .36], [.22, .34], [.38, .34], [.5, .3], [.38, .34], [.22, .34], [.26, .5], [.14, .5], [.3, .5], [.44, .42], [.3, .5], [.26, .5], [.1, .62], [.26, .74], [.4, .8]]};
const THICK = {f:[[.05, .16], [.14, .12], [.3, .1], [.56, .09], [.72, .07], [.86, .08], [.95, .12]], h:[[.05, .18], [.2, .1], [.45, .07], [.7, .07], [.9, .1]]};
for(const s of SIDE) for(const k of ['f', 'h']){
  const side = sd(s), bn = (k === 'f' ? 'fw' : 'hw') + side, nm = (k === 'f' ? 'forewing' : 'hindwing') + side, lay = k === 'f' ? 9.2 : 9, tg = ['wing', k === 'f' ? 'forewing' : 'hindwing', side];
  const closed = wingOutline(s, k); closed.push(closed[0]);
  M.line(nm + 'Edge', closed, {layer:lay, bind:{rigid:bn}, line:WLINE.edge, tags:tg, zone:'wings'});
  M.line(nm + 'Radius', THICK[k].map(([u, c]) => wingPt(s, k, u, c)), {layer:lay + .01, bind:{rigid:bn}, line:WLINE.thick, tags:tg, zone:'wings'});
  M.line(nm + 'Veins', WALK[k].map(([u, c]) => wingPt(s, k, u, c)), {layer:lay + .01, bind:{rigid:bn}, line:WLINE.fine, tags:tg, zone:'wings'});
  if(k === 'f'){ const q = [[.54, .06], [.6, .06], [.6, .105], [.54, .105]].map(([u, c]) => wingPt(s, k, u, c)); M.shape('stigma' + side, q, {layer:lay + .02, tier:'F', bind:{rigid:bn}, line:'feature', tone:.5, tags:tg, zone:'wings'}); }
  else {                                                                // the hamuli: a row of about twenty hooks on the hindwing's leading edge, which catch the forewing's rear fold and make the pair one surface
    const list = []; for(let i = 0; i < 21; i++){ const u = .42 + .54 * i / 20, a = wingPt(s, k, u - .005, .005), b = wingPt(s, k, u + .005, .005), t = wingPt(s, k, u + .012, -.1);
      list.push([a, b, t]); }
    M.shapes('whiskHamuli' + side, list, {layer:lay + .03, tier:'F', bind:{rigid:bn}, line:{k:.6, c:.9, r:0, t:'bone', tk:.4}, tone:.95, tags:[...tg, 'hamuli'], zone:'wings'}); }
}
/* the stroke's envelope: arcs of the wing's sweep at three radii and the two reversals; at rest scaled to nothing at the hinge, opened to the beat's reach in flight */
for(const s of SIDE){ const side = sd(s), H = P(WHINGE.f[0], s * WHINGE.f[1]), a0 = WANG(s), T = .66;
  const pt = (t, r) => [H[0] + Math.cos(a0 + t) * r, H[1] + Math.sin(a0 + t) * r], arc = (r, t0, t1, n = 10) => Array.from({length:n + 1}, (_, i) => pt(t0 + (t1 - t0) * i / n, r)), RR = [.34, .58, .8, 1].map(f => f * WL.f);
  const path = [pt(-T, RR[0]), pt(-T, RR[3]), ...arc(RR[3], -T, T), pt(T, RR[0]), ...arc(RR[0], T, -T, 6), ...arc(RR[1], -T, T), ...arc(RR[2], T, -T)];
  M.line('blur' + side, path, {layer:8.9, bind:{rigid:'blur' + side}, line:{k:.3, c:.42, r:'f', t:'bone', tk:.1}, tags:['wing', 'blur', side], zone:'wings'}); }
/* the legs. A coxa under the thorax, a femur, the tibia, then the tarsus of five segments (the first, the basitarsus, the longest) ending in two claws and a pad. The hind pair carry the pollen
   press (at the tibia's end), the comb (rows of bristles on the basitarsus) and the basket (the smooth hollow of the tibia fringed with long curved hairs, where the pellet is carried); the front pair
   carry the antenna cleaner, a notch with a comb at the base of the basitarsus. */
const dirOf = b => [(b.q[0] - b.p[0]) / b.len, (b.q[1] - b.p[1]) / b.len];
const bp = (b, u, v = 0) => { const d = dirOf(b); return [b.p[0] + d[0] * u - d[1] * v, b.p[1] + d[1] * u + d[0] * v]; };               // a point on a bone: u along it, v across (the clockwise side)
const bang = b => Math.atan2(b.q[1] - b.p[1], b.q[0] - b.p[0]);
const outer = (b, s) => { const d = dirOf(b); return d[0] * s > 0 ? 1 : -1; };                                                       // the sign of v that points away from the body's midline
const stat = (b, list) => list.map(([u, wp, wn]) => { const p = bp(b, u * b.len, 0); return [p[0], p[1], wp, wn ?? wp]; });
const LEGW = {
  fem:[[[0, 11, 11], [.5, 13.5, 13.5], [1, 11, 11]], [[0, 12, 12], [.5, 14.5, 14.5], [1, 11.5, 11.5]], [[0, 12, 12], [.5, 15.5, 15.5], [1, 12, 12]]],
  tib:[[[0, 8.6, 8.6], [.5, 10, 10], [1, 9, 9]], [[0, 8.6, 8.6], [.5, 10, 10], [1, 9.4, 9.4]], [[0, 8, 8], [.45, 12, 12], [.8, 17, 17], [1, 19, 19]]],
  bas:[[[0, 6, 6], [.5, 7, 7]], [[0, 6, 6], [.5, 7, 7]], [[0, 18, 18], [.64, 21, 21]]]};
const TS = [[.52, .62], [.64, .74], [.76, .85], [.87, .96]];                                  // the four smaller tarsomeres along the tarsus bone (fractions), the same for every leg
const LEGPART = {};
for(const L of LEGS){
  const s = L.s, tag = L.tag, i = L.i, ub = bone_('u' + tag), lb = bone_('l' + tag), fb = bone_('f' + tag), tg = ['leg', 'leg' + i, sd(s)], hind = i === 2, front = i === 0;
  const base = {layer:3 + .01 * i, tier:'M', h:13, line:'region', tags:tg};
  M.limb('femur' + tag, stat(ub, LEGW.fem[i]), {...base, bind:{rigid:ub.name}});
  M.limb('tibia' + tag, stat(lb, LEGW.tib[i]), {...base, bind:{rigid:lb.name}, layer:base.layer + .002});
  M.limb('basitarsus' + tag, stat(fb, LEGW.bas[i]), {...base, bind:{rigid:fb.name}, tier:hind ? 'M' : 'F', h:hind ? 13 : 11, layer:base.layer + .003});
  TS.forEach(([u0, u1], q) => { const a0 = u0 + (hind ? .14 : 0), a1 = u1 + (hind ? .08 : 0), w0 = 4.6 - q * .3, w1 = 4.2 - q * .3;
    M.shape('tarsomere' + (q + 2) + tag, [bp(fb, a0 * fb.len, w0), bp(fb, a1 * fb.len, w1), bp(fb, a1 * fb.len, -w1), bp(fb, a0 * fb.len, -w0)], {...base, tier:'F', bind:{rigid:fb.name}, line:'feature', tone:.2 + .05 * q, layer:base.layer + .004}); });
  M.shape('knee' + tag, ring(lb.p, hind ? 11 : 9.5, 9), {...base, tier:'F', bind:{mix:[[ub.name, .5], [lb.name, .5]]}, line:'feature', tone:.22, layer:base.layer + .006});
  M.shape('ankle' + tag, ring(fb.p, hind ? 11 : 8, 9), {...base, tier:'F', bind:{mix:[[lb.name, .5], [fb.name, .5]]}, line:'feature', tone:.22, layer:base.layer + .006});
  M.shape('trochanter' + tag, ring(bp(ub, 6, 0), 10, 8), {...base, tier:'F', bind:{rigid:ub.name}, line:'feature', tone:.2, layer:base.layer + .005});
  { const q = fb.q, d = dirOf(fb), n = [-d[1], d[0]];                                                // the claws: two curved hooks and the pad between them
    for(const sg of [-1, 1]) M.shape('claw' + (sg > 0 ? 'a' : 'b') + tag, [[q[0] - d[0] * 2 + n[0] * sg * 2, q[1] - d[1] * 2 + n[1] * sg * 2], [q[0] + d[0] * 10 + n[0] * sg * 7, q[1] + d[1] * 10 + n[1] * sg * 7], [q[0] + d[0] * 17 + n[0] * sg * 3, q[1] + d[1] * 17 + n[1] * sg * 3], [q[0] + d[0] * 7 + n[0] * sg * 3, q[1] + d[1] * 7 + n[1] * sg * 3]],
      {layer:base.layer + .007, tier:'F', bind:{rigid:fb.name}, line:'feature', tone:.9, tags:[...tg, 'foot', 'claw']});
    M.shape('arolium' + tag, [[q[0] - d[0] * 3 + n[0] * 4, q[1] - d[1] * 3 + n[1] * 4], [q[0] + d[0] * 8 + n[0] * 3, q[1] + d[1] * 8 + n[1] * 3], [q[0] + d[0] * 8 - n[0] * 3, q[1] + d[1] * 8 - n[1] * 3], [q[0] - d[0] * 3 - n[0] * 4, q[1] - d[1] * 3 - n[1] * 4]], {layer:base.layer + .0075, tier:'F', bind:{rigid:fb.name}, line:'feature', tone:.5, tags:[...tg, 'foot']}); }
  const R = rnd(100 + i * 7 + (s > 0 ? 0 : 50));
  if(front){                                                                                         // the antenna cleaner: a comb of teeth along a notch on the inner edge of the first tarsal segment, and the flap (velum) on the tibia that closes it
    const sg = -outer(fb, s), teeth = [];
    for(let q = 0; q < 7; q++){ const p = bp(fb, 3 + q * 3.4, sg * 5.2), a = bang(fb) + sg * Math.PI / 2; teeth.push(hairs([[p[0], p[1], a, 5.5]], 5.5, 1.1)[0]); }
    M.shapes('whiskStrigil' + tag, teeth, {layer:base.layer + .008, tier:'F', bind:{rigid:fb.name}, line:{k:.6, c:.9, r:0, t:'bone', tk:.4}, tone:.9, tags:[...tg, 'strigil', 'hair'], zone:'legs'});
    const e = bp(lb, lb.len - 4, sg * 8); M.shape('velum' + tag, [e, bp(lb, lb.len + 6, sg * 12), bp(lb, lb.len + 14, sg * 6), bp(lb, lb.len + 4, sg * 2)], {layer:base.layer + .0085, tier:'F', bind:{rigid:lb.name}, line:'feature', tone:.6, tags:[...tg, 'strigil'], zone:'legs'}); }
  if(i === 1){ const og = outer(lb, s), e = bp(lb, lb.len - 3, og * 8); M.shape('spur' + tag, [e, bp(lb, lb.len + 7, og * 12), bp(lb, lb.len + 3, og * 3)], {layer:base.layer + .0085, tier:'F', bind:{rigid:lb.name}, line:'feature', tone:.7, tags:[...tg, 'spur'], zone:'legs'}); }
  if(hind){
    const og = outer(lb, s), wid = u => interp(LEGW.tib[2].map(([a, b]) => [a, b]), u), cen = u => og * wid(u) * .32, hw = u => wid(u) * .5 * Math.sin(Math.PI * clamp((u - .12) / .8));
    const rimA = [], rimB = []; for(let q = 0; q <= 10; q++){ const u = .12 + .8 * q / 10; rimA.push(bp(lb, u * lb.len, cen(u) + og * hw(u))); rimB.push(bp(lb, u * lb.len, cen(u) - og * hw(u))); }
    M.zone('basket' + tag, rimA.concat(rimB.reverse()), {...base, tier:'F', h:10, inset:.4, bind:{rigid:lb.name}, line:'feature', tone:.04, layer:base.layer + .004, tags:[...tg, 'basket']});
    const fr = []; for(let q = 0; q < 17; q++){ const u = .16 + .74 * q / 16, p = bp(lb, u * lb.len, og * (wid(u) - 1)), dir = bang(lb) - og * Math.PI / 2 * .8 + (R() - .5) * .3; fr.push([p[0], p[1], dir, 9 + R() * 4]); }
    M.shapes('whiskCorb' + tag, hairs(fr, 10, 1.3), {layer:base.layer + .01, tier:'F', bind:{rigid:lb.name}, line:{k:.55, c:.8, r:0, t:'bone', tk:.3}, tone:.55, tags:[...tg, 'basket', 'hair'], zone:'legs'});
    const pc = bp(lb, .52 * lb.len, og * wid(.52) * .3), ang = bang(lb);                          // the pollen pellet: a speck at rest, swollen to its full size by the load muscle about its centre
    LEGPART[tag] = {pc, ang, og};
    M.shape('pelletRim' + tag, K.ellipsePts(pc, .34, .22, 10, ang), {layer:base.layer + .012, tier:'F', bind:{rigid:lb.name}, line:{k:.6, c:.6, r:0, t:'bone', tk:.2}, tone:.46, tags:[...tg, 'pellet'], zone:'load'});
    M.shape('pellet' + tag, K.ellipsePts(pc, .26, .17, 10, ang), {layer:base.layer + .013, tier:'F', bind:{rigid:lb.name}, line:{k:.6, c:.6, r:0, t:'bone', tk:.2}, tone:.8, ink:'gold', tags:[...tg, 'pellet'], zone:'load'});
    const comb = [], dF = dirOf(fb); for(let q = 0; q < 9; q++) for(let w = 0; w < 4; w++){ const p = bp(fb, (.04 + .066 * q) * fb.len, -og * (3 + w * 4.4)); comb.push(hairs([[p[0], p[1], Math.atan2(-og * dF[0], og * dF[1]), 6]], 6, 1.1)[0]); }
    M.shapes('whiskPecten' + tag, comb, {layer:base.layer + .009, tier:'F', bind:{rigid:fb.name}, line:{k:.55, c:.8, r:0, t:'bone', tk:.3}, tone:.6, tags:[...tg, 'comb', 'hair'], zone:'legs'});
    const e = bp(lb, lb.len - 8, og * 8); M.shape('press' + tag, [e, bp(lb, lb.len + 4, og * 19), bp(lb, lb.len + 12, og * 14), bp(lb, lb.len + 6, og * 3)], {layer:base.layer + .011, tier:'F', bind:{rigid:lb.name}, line:'feature', tone:.7, tags:[...tg, 'press'], zone:'legs'});
  } else {                                                                                             // short setae along the femur and tibia
    const hs = []; for(let q = 0; q < 12; q++){ const b = q < 6 ? ub : lb, u = (.15 + .13 * (q % 6)) * b.len, v = (R() < .5 ? 1 : -1) * (LEGW.tib[i][1][1] - 1), p = bp(b, u, v); hs.push([p[0], p[1], bang(b) + (v > 0 ? 1.2 : -1.2) + (R() - .5) * .4, 7 + R() * 4]); }
    M.shapes('whisk' + tag, hairs(hs, 8, 1.3), {layer:base.layer + .01, tier:'F', bind:{mix:[[ub.name, .5], [lb.name, .5]]}, line:{k:.5, c:.7, r:0, t:'bone', tk:.3}, tone:.4, tags:[...tg, 'hair'], zone:'legs'}); }
}

/* ---------- muscles ----------
   The body's own names. A wing is swung by the basalar (forward) and subalar (back) direct muscles and folded by the third axillary; the dorsolongitudinal and dorsoventral muscles of the thorax power the beat
   (the thorax pulses). The antenna's scape has its levator and depressor; the mandible its opener and closer; the proboscis its stipital and prementum muscles. Legs read their muscles from the IK. */
const glow = (c, rx, ry, a = .42) => K.glow(c[0], c[1], rx, ry, a), addM = (id, d) => M.muscle(id, d);
addM('breath', {name:'the breath (the abdomen pumps: its sterna draw in and out)', g:'body', c:P(-190, 0), r:[110, 80], pull:[-.02, -.026], on:['abdomen'], hue:'#8fd0a8', speed:5, host:'abd', shade:glow(P(-190, 0), 70, 52, .25)});
addM('crop', {name:'the honey stomach (the crop fills with nectar and swells the abdomen)', g:'body', c:P(-190, 0), r:[110, 80], pull:[-.075, -.11], on:['abdomen'], hue:'#d4a03c', speed:3, host:'abd', shade:glow(P(-190, 0), 60, 48, .2)});
addM('abdRaise', {name:'the abdomen\'s levator (raises it: the gaster shortens from above)', g:'abdomen', c:P(-190, 0), r:[130, 90], pull:[.07, 0], on:['abdomen'], hue:'#7ec3e6', speed:6, host:'abd', shade:glow(P(-190, 0), 60, 48, .25)});
addM('abdBendL', {name:'bender of the abdomen, left (lateral tergo-sternal muscles)', g:'abdomen', c:P(-170, -34), r:[70, 38], jt:[['abd', .2], ['abd2', .15]], on:['abdomen'], hue:'#9aa6d8', speed:14, host:'abd', shade:glow(P(-170, -34), 56, 30, .35)});
addM('abdBendR', {name:'bender of the abdomen, right', g:'abdomen', c:P(-170, 34), r:[70, 38], jt:[['abd', -.2], ['abd2', -.15]], on:['abdomen'], hue:'#e3806f', speed:14, host:'abd', shade:glow(P(-170, 34), 56, 30, .35)});
addM('waxGlandR', {name:'wax glands, right (the mirrors slide out between the sternites)', g:'abdomen', c:P(-200, 56), r:[80, 22], v:[0, 13], on:['wax'], hue:'#d8c89a', speed:3, host:'abd', shade:glow(P(-200, 56), 70, 20, .3)});
addM('waxGlandL', {name:'wax glands, left', g:'abdomen', c:P(-200, -56), r:[80, 22], v:[0, -13], on:['wax'], hue:'#d8c89a', speed:3, host:'abd', shade:glow(P(-200, -56), 70, 20, .3)});
addM('stingProtract', {name:'the sting\'s protractor (the stylet and lancets slide out of the sting chamber)', g:'sting', c:P(-290, 0), r:[50, 30], on:['sting'], v:[-4, 0], hue:'#e0523f', speed:12, host:'sting', shade:glow(P(-290, 0), 36, 22, .5)});
addM('stingAimL', {name:'the sting\'s aim, left (the quadrate plates)', g:'sting', c:P(-280, -8), r:[40, 22], jt:[['sting', .16]], on:['sting'], hue:'#9aa6d8', speed:14, host:'sting', shade:glow(P(-280, -8), 30, 16, .35)});
addM('stingAimR', {name:'the sting\'s aim, right', g:'sting', c:P(-280, 8), r:[40, 22], jt:[['sting', -.16]], on:['sting'], hue:'#e3806f', speed:14, host:'sting', shade:glow(P(-280, 8), 30, 16, .35)});
addM('trunk', {name:'the thorax sway (the thoracic ganglion\'s postural tone)', g:'body', c:P(0, 0), r:[70, 60], jt:[['thorax', .06]], on:['thorax'], hue:'#9aa6d8', speed:5, host:'thorax', shade:glow(P(0, 0), 60, 50, .2)});
addM('power', {name:'the thorax\'s power muscles (dorsolongitudinal and dorsoventral: the box that beats the wings)', g:'wings', c:P(0, 0), r:[90, 70], pull:[-.02, -.012], on:['thorax'], hue:'#d4a03c', speed:30, host:'thorax', shade:glow(P(0, 0), 70, 56, .25)});
for(const s of SIDE){ const side = sd(s), W = 'fw' + side, V = 'hw' + side, B = 'blur' + side, hc = P(WHINGE.f[0], s * 50);
  addM('wingOpen' + side, {name:'axillary muscles of the ' + (s > 0 ? 'right' : 'left') + ' wing (they unfold it from the back)', g:'wings', c:hc, r:[34, 28], jt:[[W, -1.45 * s], [V, -1.43 * s], [B, -1.45 * s]], on:['wing', 'thorax'], hue:'#7ec3e6', speed:8, host:W, shade:glow(hc, 28, 22, .3)});
  addM('wingFold' + side, {name:'third axillary muscle, ' + (s > 0 ? 'right' : 'left') + ' (it folds the wing back over the abdomen)', g:'wings', c:hc, r:[34, 28], jt:[[W, .3 * s], [V, .3 * s], [B, .3 * s]], on:['wing', 'thorax'], hue:'#e3806f', speed:8, host:W, shade:glow(hc, 28, 22, .3)});
  addM('basalar' + side, {name:'basalar muscle, ' + (s > 0 ? 'right' : 'left') + ' (it swings the wing forward)', g:'wings', c:P(40, s * 60), r:[26, 20], jt:[[W, -.19 * s], [V, -.18 * s]], on:['wing'], hue:'#d8c89a', speed:30, host:W, shade:glow(P(40, s * 60), 22, 18, .3)});
  addM('subalar' + side, {name:'subalar muscle, ' + (s > 0 ? 'right' : 'left') + ' (it swings the wing back)', g:'wings', c:P(0, s * 60), r:[26, 20], jt:[[W, .19 * s], [V, .18 * s]], on:['wing'], hue:'#9aa6d8', speed:30, host:W, shade:glow(P(0, s * 60), 22, 18, .3)});
  addM('hamuli' + side, {name:'the hamuli\'s coupling, ' + (s > 0 ? 'right' : 'left') + ' (the hindwing\'s hooks take the forewing\'s fold)', g:'wings', c:P(-42, s * 52), r:[24, 18], jt:[[V, -.1 * s]], on:['wing'], hue:'#c9a0dc', speed:10, host:V, shade:glow(P(-42, s * 52), 20, 16, .3)});
}
/* the head, the mouthparts and the antennae */
addM('headTurnR', {name:'the neck muscles, turning the head right', g:'head', c:P(130, 0), r:[50, 50], jt:[['head', .36]], on:['head'], hue:'#e3806f', speed:11, host:'head', shade:glow(P(130, 0), 46, 40, .3)});
addM('headTurnL', {name:'the neck muscles, turning the head left', g:'head', c:P(130, 0), r:[50, 50], jt:[['head', -.36]], on:['head'], hue:'#9aa6d8', speed:11, host:'head', shade:glow(P(130, 0), 46, 40, .3)});
for(const s of SIDE){ const side = sd(s), c = P(200, s * 22);
  addM('mandOpen' + side, {name:'opener of the ' + (s > 0 ? 'right' : 'left') + ' mandible', g:'mandible', c, r:[24, 18], jt:[['mand' + side, .5 * s]], on:['mandible'], hue:'#7ec3e6', speed:14, host:'mand' + side, shade:glow(c, 20, 14, .4)});
  addM('mandClose' + side, {name:'closer of the ' + (s > 0 ? 'right' : 'left') + ' mandible', g:'mandible', c, r:[24, 18], jt:[['mand' + side, -.3 * s]], on:['mandible'], hue:'#e0523f', speed:14, host:'mand' + side, shade:glow(c, 20, 14, .4)});
  const A = ANT[side], sc = bone_(A[0]), cs = P(210, s * 36);
  addM('scapeOut' + side, {name:'levator of the ' + side + ' scape (swings the antenna out)', g:'antenna', c:cs, r:[26, 18], jt:[[A[0], .5 * s]], on:['antenna'], hue:'#d8c89a', speed:9, host:A[0], shade:glow(cs, 20, 14, .3)});
  addM('scapeIn' + side, {name:'depressor of the ' + side + ' scape (swings the antenna in)', g:'antenna', c:cs, r:[26, 18], jt:[[A[0], -.4 * s]], on:['antenna'], hue:'#8fb0a0', speed:9, host:A[0], shade:glow(cs, 20, 14, .3)});
  const flag = A.slice(1), cf = P(250, s * 60);
  addM('flSweep' + side, {name:'the pedicel\'s muscle, ' + side + ' (sweeps the flagellum out)', g:'antenna', c:cf, r:[46, 38], jt:flag.map((n, i) => [n, s * (.04 + .006 * i)]), on:['antenna'], hue:'#9aa6d8', speed:8, host:flag[0], shade:glow(cf, 36, 28, .28)});
  addM('flCurl' + side, {name:'the pedicel\'s flexor, ' + side + ' (curls the flagellum)', g:'antenna', c:P(262, s * 84), r:[44, 34], jt:flag.map((n, i) => [n, -s * (.018 + .005 * i)]), on:['antenna'], hue:'#c9a0dc', speed:7, host:flag[0], shade:glow(P(262, s * 84), 34, 26, .26)}); }
addM('probExtend', {name:'the proboscis\' stipital muscles (they swing it out from under the head)', g:'proboscis', c:P(240, 0), r:[80, 20], jt:[['prob1', .06], ['prob2', -.04]], on:['proboscis'], hue:'#e3806f', speed:6, host:'prob1', shade:glow(P(240, 0), 60, 14, .35)});
addM('probSwingR', {name:'the proboscis, swung right', g:'proboscis', c:P(280, 0), r:[70, 20], jt:[['prob1', .22]], on:['proboscis'], hue:'#d8c89a', speed:9, host:'prob1', shade:glow(P(280, 0), 50, 14, .3)});
addM('probSwingL', {name:'the proboscis, swung left', g:'proboscis', c:P(280, 0), r:[70, 20], jt:[['prob1', -.22]], on:['proboscis'], hue:'#9aa6d8', speed:9, host:'prob1', shade:glow(P(280, 0), 50, 14, .3)});
addM('probLap', {name:'the glossa\'s retractors (the tongue laps: it dips out and in)', g:'proboscis', c:P(420, 0), r:[50, 18], jt:[['glossa', .24]], on:['proboscis'], hue:'#c9a0dc', speed:18, host:'glossa', shade:glow(P(420, 0), 40, 12, .4)});
addM('droplet', {name:'the honey drop at the tongue\'s tip (it swells as the exchange goes)', g:'proboscis', c:P(458, 0), r:[24, 24], pull:[-4.2, -4.2], on:['droplet'], hue:'#d4a03c', speed:7, host:'glossa'});
/* the legs: a promotor and remotor at the coxa, a flexor and extensor of the tibia, a depressor and levator of the tarsus (read from the solved angles) */
for(const L of LEGS){ const s = L.s, tag = L.tag, i = L.i, ub = bone_('u' + tag), lb = bone_('l' + tag), fb = bone_('f' + tag), g = 'leg ' + (i + 1) + (s > 0 ? ' right' : ' left'), fw = s, bend = BEND[i] * s, on = ['leg' + i, sd(s)];
  const hc = bp(ub, 22, 0), ec = lb.p, wc = fb.p;
  const m = (id, name, c, r, hue, jt, shade) => addM(id + tag, {name, g, c, r, hue, speed:11, on, jt, shade, host:jt[0][0]});
  m('pro', 'promotor of the leg ' + (i + 1) + ' (swings it forward)', hc, [20, 20], '#7ec3e6', [['u' + tag, -.5 * fw]], glow(hc, 16, 16, .4));
  m('rem', 'remotor of the leg ' + (i + 1) + ' (swings it back)', hc, [20, 20], '#e3806f', [['u' + tag, .5 * fw]], glow(hc, 16, 16, .4));
  m('fle', 'flexor of the tibia ' + (i + 1) + ' (folds the knee)', ec, [22, 22], '#d8c89a', [['l' + tag, -bend * .75]], glow(ec[0], ec[1], 16, 16, .45));
  m('ext', 'extensor of the tibia ' + (i + 1) + ' (straightens the knee)', bp(lb, lb.len * .6, 0), [24, 24], '#9aa6d8', [['l' + tag, bend * .75]], glow(...bp(lb, lb.len * .6, 0), 14, 14, .35));
  m('dep', 'depressor of the tarsus ' + (i + 1), wc, [14, 14], '#c9a0dc', [['f' + tag, .5]], glow(wc[0], wc[1], 10, 10, .45));
  m('lev', 'levator of the tarsus ' + (i + 1), wc, [14, 14], '#5cc6b4', [['f' + tag, -.5]], glow(wc[0], wc[1], 10, 10, .45));
  if(i === 2){ const lp = LEGPART[tag], d = dirOf(lb);
    addM('pollenLoad' + tag, {name:'the pollen load on the ' + sd(s) + ' hind leg (the packed pellet in the basket)', g:'hind leg', c:lp.pc, r:[60, 60], pull:[-99, -99], on:['pellet'], hue:'#d4a03c', speed:2.4, host:'l' + tag});
    addM('press' + tag, {name:'the pollen press, ' + sd(s) + ' (the auricle and rastellum pack the pellet up the basket)', g:'hind leg', c:bp(lb, lb.len + 4, lp.og * 12), r:[22, 22], v:[-d[0] * 11, -d[1] * 11], on:['press'], hue:'#e3806f', speed:12, host:'l' + tag, shade:glow(...bp(lb, lb.len + 4, lp.og * 12), 16, 16, .4)}); } }
/* ---------- postures: each names the six feet ----------
   A foot is placed by how far out it is (`r`, a share of the rest reach from the hip) and shifted by (da, db). The first posture is where it starts. A bee on the comb stands on all six; in flight the legs are tucked
   (the front pair under the head, the hind pair trailing), the body is not standing on anything and the ground is far below. */
function foot(L, r = 1, da = 0, db = 0){ const h = L.hip, f = bone_('f' + L.tag), w = f.p, t = [w[0] - h[0], w[1] - h[1]];
  return [h[0] + t[0] * r + (f.q[0] - w[0]) + da, h[1] + t[1] * r + (f.q[1] - w[1]) + db, Math.atan2(f.q[1] - f.p[1], f.q[0] - f.p[0])]; }
const feet = (r = 1, f) => LEGS.map(L => f ? f(L, r) : foot(L, r));
const at3 = (L, a, b, ang) => { const f = bone_('f' + L.tag), a0 = Math.atan2(f.q[1] - f.p[1], f.q[0] - f.p[0]); return [CX + a, CY + L.s * b, a0 + K.wrapA(Math.atan2(L.s * Math.sin(ang), Math.cos(ang)) - a0)]; };   // a toe's place (a, b) in the body frame and the tarsus's direction (the right side's angle, mirrored for the left)
M.posture('stand', {feet:feet(1)});
M.posture('rest', {feet:feet(.84), root:[0, 5, 0], jt:{head:-.03}});
M.posture('feed', {feet:feet(1, (L, r) => L.i === 0 ? foot(L, .78, 26, -L.s * 40) : L.i === 1 ? foot(L, 1, 4, 0) : foot(L, 1, -4, 0)), root:[8, 0, 0], cam:[1.16, 560, 392]});
M.posture('guard', {feet:feet(1, (L, r) => L.i === 0 ? foot(L, .88, 22, L.s * 12) : L.i === 1 ? foot(L, 1.02, 0, L.s * 6) : foot(L, 1.04, -6, L.s * 4)), root:[-8, 0, 0], jt:{head:-.02}});
M.posture('dance', {feet:feet(1.03), root:[-4, 0, 0], jt:{abd:-.03}});
M.posture('fan', {feet:feet(1, (L, r) => L.i === 2 ? foot(L, 1.04, -10, L.s * 12) : L.i === 1 ? foot(L, 1.02, -4, L.s * 8) : foot(L, 1, 0, L.s * 10)), root:[-14, 3, 0], cam:[1.32, 450, 392], jt:{head:.04}});
M.posture('flight', {feet:LEGS.map(L => L.i === 0 ? at3(L, 150, 50, -.6) : L.i === 1 ? at3(L, 20, 100, 1.7) : at3(L, -240, 30, Math.PI + .12)), root:[0, 0, 0], cam:[1.32, 450, 392], ground:0, jt:{head:.0}});
{ const th = .45, dx = 6, dy = 20, rp = f => { const c = Math.cos(th), s = Math.sin(th), x = f[0] - CX, y = f[1] - CY; return [CX + c * x - s * y + dx, CY + s * x + c * y + dy, f[2] + th]; };
  M.posture('fallen', {feet:LEGS.map(L => rp(L.i === 0 ? at3(L, 120, 90, .9) : L.i === 1 ? at3(L, 30, 120, 1.7) : at3(L, -90, 110, 2.5))), root:M.rootV([CX, CY], th, dx, dy), jt:{head:.1, abd:.14, abd2:.1}, cam:[1.1, 470, 392]}); }
const EDGE = (key, ms, extra = {}) => M.edge(key, {ms, g:{root:[0, ms * .6], A:[ms * .1, ms * .6], B:[ms * .22, ms * .6], head:[ms * .2, ms * .6], abdomen:[ms * .1, ms * .7], wing:[0, ms * .7], cam:[0, ms * .6], antenna:[ms * .1, ms * .5]}, ...extra});
EDGE('stand>rest', 1800); EDGE('stand>feed', 2000); EDGE('stand>guard', 1500); EDGE('stand>dance', 1400); EDGE('stand>fan', 2200); EDGE('stand>flight', 2600, {bumps:[['ry', 0, 800, 10]]}); EDGE('stand>fallen', 1800);

/* ---------- gaits: the alternating tripod. R0 L1 R2 against L0 R1 L2; `off` is the landing phase and a larger value lands earlier ---------- */
const N = 6, arr = f => LEGS.map(f);
const OFF = () => arr(L => (((L.i + (L.s > 0 ? 0 : 1)) & 1) ? .5 : 0) + .02 * (2 - L.i));
const LIFT = arr(L => -L.s * 12), FLEX = arr(L => L.s * .4), HS = new Array(N).fill(0);
M.gait('shuffle', {psi:0, base:'stand', label:'Shuffle', L:0, cyc:600, duty:.6, lift:LIFT, off:OFF(), flex:FLEX, hs:HS, bob:1, cap:1.8, lead:0});
M.gait('creep', {psi:.5, base:'stand', label:'Creep', L:30, cyc:760, duty:.6, lift:LIFT, off:OFF(), flex:FLEX, hs:HS, bob:1.1, cap:1.8, lead:0});
M.gait('walk', {psi:1, base:'stand', label:'Walk', L:78, cyc:540, duty:.58, lift:LIFT, off:OFF(), flex:FLEX, hs:HS, bob:1.8, cap:1.8, lead:0});
M.gait('run', {psi:2, base:'stand', label:'Run', L:98, cyc:400, duty:.52, lift:LIFT.map(v => v * 1.15), off:OFF(), flex:FLEX.map(v => v * 1.15), hs:HS, bob:2.6, cap:1.7, lead:0});

/* ---------- the figure's own state, run from the idle hook every frame ----------
   The wing beat: the real one is about 230 a second, far past what a screen shows; here it is drawn slowed to FREQ beats a second, by the basalar and subalar muscles in turn, with the wing's pitch
   flipping at each reversal and the envelope of the true stroke drawn as arcs (the bee "blurs"). The loads (pollen in the two baskets, nectar in the crop, a drop on the tongue) are lasting state, written to
   their muscles every frame; they survive an action and are cleared by a reset. */
const FREQ = 2.4, TAU = 2 * Math.PI;
const newE = () => ({t:0, ph:0, A:0, bz:0, load:[0, 0], crop:0, drop:0, loadT:[0, 0], cropT:0, dropT:0, fv:0, fvT:0, om:0, h:0, stopAt:-1e9, so:0, sf:0, sh:0});
const sm = (x, k, dt) => 1 - Math.exp(-dt / k);
function figureStep(c, now, dt){
  const E = c.hb || (c.hb = newE()); if(now < E.t - 1) Object.assign(E, newE()); E.t = now;
  const pw = c.pm.w, bt = c.pad.beat.L, mk = Math.max(.3, c.mot.scale);
  const fly = Math.max(pw.flight || 0, pw.fan || 0), tgt = clamp(fly + E.bz, 0, 1.15);
  E.A += (tgt - E.A) * sm(1, E.bz > fly ? 160 : 380, dt);
  E.ph = (E.ph + dt * FREQ * Math.pow(2, .8 * bt[0]) * Math.min(c.tempo, 1.4) / 1000) % 1;
  const amp = E.A * Math.pow(2, .5 * bt[1]), sn = Math.sin(TAU * E.ph);
  c.spec(c.Ti, {basalarR:amp * pos(sn), basalarL:amp * pos(sn), subalarR:amp * pos(-sn), subalarL:amp * pos(-sn), power:E.A * (.5 + .5 * Math.cos(2 * TAU * E.ph)) * .9});
  const flip = 1 - .36 * clamp(E.A * 1.4) * (.5 + .5 * Math.cos(2 * TAU * E.ph + .5));
  for(const side of ['R', 'L']){ c.scale('fw' + side, 1, flip); c.scale('hw' + side, 1, flip);
    const b = .0004 + fSmooth(0, .85, E.A); c.scale('blur' + side, b, b); }
  c.Q.by += -5 * E.A * (.5 - .5 * Math.cos(2 * TAU * E.ph)); c.jd('thorax', .008 * E.A * Math.sin(2 * TAU * E.ph));
  /* the mouthparts and the sting are scaled from their muscles: the proboscis swings out and forward from folded back under the head, the glossa laps, the sting slides out of its chamber */
  c.scale('prob1', -1 + 2 * clamp(c.act('probExtend')), 1); c.scale('glossa', 1 + .32 * clamp(c.act('probLap')), 1); c.scale('sting', .28 + .72 * clamp(c.act('stingProtract')), 1);
  /* the loads */
  for(let k = 0; k < 2; k++) E.load[k] += (E.loadT[k] - E.load[k]) * sm(1, 700, dt);
  E.crop += (E.cropT - E.crop) * sm(1, 900, dt); E.drop += (E.dropT - E.drop) * sm(1, 300, dt);
  c.spec(c.Ta, {pollenLoadR2:E.load[0] / mk, pollenLoadL2:E.load[1] / mk, crop:E.crop / mk, droplet:E.drop / mk});
  E.h += ((pw.flight || 0) * (150 + 8 * Math.sin(now * .0017)) - E.h) * sm(1, 700, dt);
  E.bz = 0; E.dropT = 0;                                              // set again each frame by the action that wants them
}

const groundOf = c => { if(!window.CreatureGround || !c.svg) return null; if(!c.svg.__cg) c.svg.__cg = CreatureGround.make(c, {pivot:[CX, CY], crest:1.25, seed:41}); const g = c.svg.__cg; g.colour(c.C); return g; };
/* ---------- the hive: a comb, the dance floor, the entrance and the field, in a world that stays put (creature-ground.js keeps the world under the body; the body does not leave the page) ----------
   The comb is a lattice of six-sided worker cells (5.3 mm across, 217 units, so the bee stands on a cell or two) with the contents a comb has: empty cells, capped honey, pollen, capped brood, open nectar. The
   dance floor is a stretch of capped comb near the entrance with the sun line drawn on it (straight up the page is the direction of the sun) and the marks of dances, which fade. The entrance is a gap in a wall with a
   landing board; beyond it is the field, with flowers. Nothing here moves by itself: the actions and the figure's own flight move the bee through it, and everything the bee does to it persists until it fades. */
const CW = 217, CR = CW / Math.sqrt(3), RH = CR * 1.5;
const ENT = {x:1290, gap:175, board:210}, DANCE = {x:560, y:0, r:300}, ROAMC = [300, 0];
const CELLS = {i0:-13, i1:8, j0:-12, j1:12, x0:-2500}, BROOD = {on:false, x:0, y:0, r:0};   // the comb's extent, and a patch of open brood (a lone bee's world has none; a crew's can: see crewWorld below)
const FLOWERS = [[1900, -270, 170], [1770, 430, 150], [2340, 90, 190], [2090, -650, 160], [1660, -560, 140], [2150, 520, 150]];
const cellXY = (i, j) => [i * CW + (j & 1) * CW / 2, j * RH];
const hexAt = (cx, cy, r, a0 = Math.PI / 6) => Array.from({length:6}, (_, k) => [cx + r * Math.cos(a0 + k * Math.PI / 3), cy + r * Math.sin(a0 + k * Math.PI / 3)]);
const f1 = v => Math.round(v * 10) / 10;
const pathOf = (pts, close = true) => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + (close ? 'Z' : '');
const circP = (x, y, r) => 'M' + f1(x - r) + ' ' + f1(y) + 'a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(2 * r) + ' 0a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(-2 * r) + ' 0';
const SVGNS = 'http://www.w3.org/2000/svg';
const mk = (tag, a = {}) => { const e = document.createElementNS(SVGNS, tag); for(const k in a) e.setAttribute(k, a[k]); return e; };
const hexc = n => '#' + ((n >>> 0) & 0xffffff).toString(16).padStart(6, '0');
const wrapA = K.wrapA;
const zoneAt = (x, y) => x > ENT.x + 20 ? 'field' : Math.abs(x - ENT.x) < 190 && Math.abs(y) < ENT.gap + 40 ? 'entrance' : Math.hypot(x - DANCE.x, y - DANCE.y) < DANCE.r ? 'dance floor' : 'comb';

function buildWorld(st){
  const R = rnd(7), D = {lines:'', dep:'', dep2:'', capF:'', capL:'', pollen1:'', pollen2:'', brood:'', shine:'', cells:[]};
  for(let j = CELLS.j0; j <= CELLS.j1; j++) for(let i = CELLS.i0; i <= CELLS.i1; i++){
    const [cx, cy] = cellXY(i, j); if(cx > ENT.x - 40 || cx < CELLS.x0) continue;
    const dance = Math.hypot(cx - DANCE.x, cy - DANCE.y) < DANCE.r + 80, h = hash(i * 131 + j * 7 + 5), bro = BROOD.on && Math.hypot(cx - BROOD.x, cy - BROOD.y) < BROOD.r, kind = dance ? (h < .78 ? 'cap' : 'empty') : bro ? (h < .8 ? 'brood' : h < .9 ? 'pollen' : 'empty') : h < .30 ? 'empty' : h < .56 ? 'cap' : h < .68 ? 'pollen' : h < .84 ? 'brood' : 'nectar';
    D.cells.push({i, j, cx, cy, kind});
    D.lines += pathOf(hexAt(cx, cy, CR));
    if(kind === 'empty'){ D.dep += pathOf(hexAt(cx, cy, CR * .8)); D.dep2 += pathOf(hexAt(cx, cy, CR * .52)); }
    else if(kind === 'cap'){ D.capF += pathOf(hexAt(cx, cy, CR * .9)); D.capL += pathOf(hexAt(cx, cy, CR * .72)) + circP(cx, cy, 3); }
    else if(kind === 'pollen'){ D.dep += pathOf(hexAt(cx, cy, CR * .8)); for(let q = 0; q < 9; q++){ const a = R() * 6.283, d = Math.sqrt(R()) * CR * .55, r = 7 + R() * 7; if(q % 2) D.pollen1 += circP(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r); else D.pollen2 += circP(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r); } }
    else if(kind === 'brood'){ D.brood += circP(cx, cy, CR * .74) + circP(cx, cy, CR * .3); D.shine += 'M' + f1(cx - CR * .5) + ' ' + f1(cy - CR * .18) + 'q' + f1(CR * .12) + ' ' + f1(-CR * .34) + ' ' + f1(CR * .46) + ' ' + f1(-CR * .22); }
    else { D.dep += pathOf(hexAt(cx, cy, CR * .8)); D.shine += 'M' + f1(cx - CR * .4) + ' ' + f1(cy - CR * .3) + 'q' + f1(CR * .35) + ' ' + f1(-CR * .22) + ' ' + f1(CR * .64) + ' ' + f1(-CR * .02); }
  }
  st.cellsD = D;
  /* the dance floor: a dashed ring, the sun line (straight up the page) and its sun */
  st.dFloor = circP(DANCE.x, DANCE.y, DANCE.r) ;
  st.dLine = 'M' + DANCE.x + ' ' + (DANCE.y + DANCE.r * .92) + 'L' + DANCE.x + ' ' + (DANCE.y - DANCE.r * .92);
  { let sun = circP(DANCE.x, DANCE.y - DANCE.r - 34, 20); for(let k = 0; k < 12; k++){ const a = k * Math.PI / 6; sun += 'M' + f1(DANCE.x + Math.cos(a) * 30) + ' ' + f1(DANCE.y - DANCE.r - 34 + Math.sin(a) * 30) + 'l' + f1(Math.cos(a) * 12) + ' ' + f1(Math.sin(a) * 12); } st.dSun = sun; }
  /* the entrance wall (a propolis ridge with a gap), the landing board */
  { let wall = '', ticks = ''; for(const [y0, y1] of [[-1900, -ENT.gap], [ENT.gap, 1900]]){ wall += 'M' + (ENT.x - 18) + ' ' + y0 + 'L' + (ENT.x - 18) + ' ' + y1 + 'M' + (ENT.x + 18) + ' ' + y0 + 'L' + (ENT.x + 18) + ' ' + y1; for(let y = y0 + 20; y < y1; y += 46) ticks += 'M' + (ENT.x - 18) + ' ' + f1(y) + 'l36 ' + (y1 > 0 ? 14 : -14); }
    st.wall = wall; st.wallTicks = ticks;
    st.board = 'M' + (ENT.x + 18) + ' ' + (-ENT.gap - 24) + 'L' + (ENT.x + ENT.board) + ' ' + (-ENT.gap - 24) + 'Q' + (ENT.x + ENT.board + 40) + ' 0 ' + (ENT.x + ENT.board) + ' ' + (ENT.gap + 24) + 'L' + (ENT.x + 18) + ' ' + (ENT.gap + 24);
    st.posts = circP(ENT.x, -ENT.gap, 24) + circP(ENT.x, ENT.gap, 24); }
  /* the field: flowers of six petals, and short grass */
  { let petals = '', cores = '', grass = ''; FLOWERS.forEach(([x, y, r], n) => { const a0 = hash(n + 3) * 6.28; for(let k = 0; k < 6; k++){ const a = a0 + k * Math.PI / 3, px = x + Math.cos(a) * r * .55, py = y + Math.sin(a) * r * .55;
        petals += 'M' + f1(px + Math.cos(a) * r * .5) + ' ' + f1(py + Math.sin(a) * r * .5) + 'Q' + f1(px + Math.cos(a + 1.5) * r * .3) + ' ' + f1(py + Math.sin(a + 1.5) * r * .3) + ' ' + f1(x + Math.cos(a) * r * .18) + ' ' + f1(y + Math.sin(a) * r * .18) + 'Q' + f1(px + Math.cos(a - 1.5) * r * .3) + ' ' + f1(py + Math.sin(a - 1.5) * r * .3) + ' ' + f1(px + Math.cos(a) * r * .5) + ' ' + f1(py + Math.sin(a) * r * .5) + 'Z'; }
      cores += circP(x, y, r * .2); for(let k = 0; k < 8; k++) cores += circP(x + Math.cos(k * .785) * r * .3, y + Math.sin(k * .785) * r * .3, 3); });
    for(let q = 0; q < 220; q++){ const x = ENT.x + 240 + R() * 1500, y = (R() * 2 - 1) * 1100, a = -1.57 + (R() - .5) * .8, l = 14 + R() * 16; grass += 'M' + f1(x) + ' ' + f1(y) + 'l' + f1(Math.cos(a) * l) + ' ' + f1(Math.sin(a) * l); }
    st.petals = petals; st.cores = cores; st.grass = grass; }
}

function worldInit(c, st){
  const g = groundOf(c); if(!g) return st;
  g.clear(); st.g = g;
  /* in a crew (creature-crew.js) the world is the crew's: this group goes into the shared habitat in world coordinates (no transform of its own), and only the crew's owner builds the comb, the dance floor, the entrance and the field;
     every member keeps its own marks, stores and tokens in its own group. On its own page nothing changes. */
  const crew = c.crew, own = !crew || crew.owner;
  if(!st.grp){ st.grp = mk('g', {class:'hv-world', 'pointer-events':'none'}); if(crew) crew.habitat.under.appendChild(st.grp); else c.svg.insertBefore(st.grp, g.under); const sand = g.under.children[1]; if(sand) sand.style.display = 'none'; }
  st.grp.textContent = '';
  buildWorld(st);
  const els = st.els = {}, add = (k, a = {}) => { els[k] = mk('path', {fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round', ...a}); st.grp.append(els[k]); return els[k]; };
  const addS = (k, a = {}) => { if(own) return add(k, a); const {d, ...rest} = a; els[k] = mk('path', {fill:'none', ...rest}); return els[k]; };   // a static layer a member that does not own the world keeps unattached
  const D = st.cellsD;
  addS('capF', {d:D.capF, 'stroke-width':1}); addS('lines', {d:D.lines, 'stroke-width':2.4}); addS('dep', {d:D.dep, 'stroke-width':1.6}); addS('dep2', {d:D.dep2, 'stroke-width':1.2}); addS('capL', {d:D.capL, 'stroke-width':1.5});
  addS('brood', {d:D.brood, 'stroke-width':1.7}); addS('shine', {d:D.shine, 'stroke-width':1.8}); addS('pollen1', {d:D.pollen1, 'stroke-width':1.2}); addS('pollen2', {d:D.pollen2, 'stroke-width':1.2});
  addS('dFloor', {d:st.dFloor, 'stroke-width':2.2, 'stroke-dasharray':'3 14'}); addS('dLine', {d:st.dLine, 'stroke-width':1.8, 'stroke-dasharray':'10 10'}); addS('dSun', {d:st.dSun, 'stroke-width':2});
  addS('wall', {d:st.wall, 'stroke-width':4}); addS('wallT', {d:st.wallTicks, 'stroke-width':1.8}); addS('board', {d:st.board, 'stroke-width':2.4}); addS('posts', {d:st.posts, 'stroke-width':3});
  addS('grass', {d:st.grass, 'stroke-width':1.8}); addS('petals', {d:st.petals, 'stroke-width':2}); addS('cores', {d:st.cores, 'stroke-width':1.6});
  /* the marks the bee leaves (the dance's runs and loops, the scent of fanning, the nectar and pollen stored): pooled, fading */
  st.marks = Array.from({length:70}, () => { const e = mk('path', {fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round'}); e.style.display = 'none'; st.grp.append(e); return {e, t0:-1e9, life:1, kind:''}; }); st.mi = 0;
  st.store = [];                                                         // cells the bee has filled, by (i, j): they stay
  st.storeEl = add('store', {'stroke-width':2.4}); st.storeF = add('storeF', {'stroke-width':1}); if(own) st.grp.insertBefore(st.storeF, els.lines);
  /* the odour token a guard meets: a small hexagon with a dot, and two puffs behind it */
  st.tok = mk('g', {}); st.tok.style.display = 'none'; st.tokP = mk('path', {fill:'none', 'stroke-width':2.4, 'stroke-linecap':'round'}); st.tokD = mk('path', {fill:'none', 'stroke-width':2, 'stroke-linecap':'round', 'stroke-dasharray':'2 7'}); st.tok.append(st.tokD, st.tokP); st.grp.append(st.tok);
  st.partner = mk('path', {fill:'none', 'stroke-width':2.4, 'stroke-linecap':'round', 'stroke-linejoin':'round'}); st.partner.style.display = 'none'; st.grp.append(st.partner);
  st.flowerPulse = mk('path', {fill:'none', 'stroke-width':3, 'stroke-linecap':'round'}); st.flowerPulse.style.display = 'none'; st.grp.append(st.flowerPulse);
  st.last = c.t; st.home = 0; st.homeAt = -1e9; st.turn = 0; st.col = null; st.tr = null; st.cur = null; st.visits = [0, 0, 0, 0, 0, 0];
  return st;
}
function world(c){
  const st = c.svg.__hw;
  if(!st || c.t < st.last - 1){ c.svg.__hw = worldInit(c, st || {}); }
  c.svg.__hw.last = Math.max(c.svg.__hw.last || 0, c.t);
  return c.svg.__hw;
}
function worldColour(c, st){
  const C = c.C; if(st.col === C) return; st.col = C;
  const L = (t, tone = C.ink) => hexc(mixInt(C.skin, tone, t)), E = st.els;
  const set = (k, stroke, fill, op) => { const e = E[k]; e.setAttribute('stroke', stroke); if(fill) e.setAttribute('fill', fill); if(op !== undefined) e.setAttribute('opacity', op); };
  set('capF', 'none', hexc(mixInt(C.skin, C.ink, .15)), .9); set('lines', L(.36)); set('dep', L(.2)); set('dep2', L(.13)); set('capL', L(.28)); set('brood', L(.3)); set('shine', L(.5, C.bone)); set('pollen1', L(.55, C.gold), hexc(mixInt(C.skin, C.gold, .28)), .95); set('pollen2', L(.5), hexc(mixInt(C.skin, C.ink, .3)), .95);
  set('dFloor', L(.5, C.gold)); set('dLine', L(.5, C.gold)); set('dSun', L(.6, C.gold)); set('wall', L(.5, C.umber)); set('wallT', L(.3, C.umber)); set('board', L(.4, C.umber)); set('posts', L(.55, C.umber), hexc(mixInt(C.skin, C.umber, .3)));
  set('grass', L(.28, C.lapis)); set('petals', L(.5, C.bone), hexc(mixInt(C.skin, C.bone, .1))); set('cores', L(.7, C.gold), hexc(mixInt(C.skin, C.gold, .35)));
  E.store.setAttribute('stroke', L(.7, C.gold)); E.storeF.setAttribute('fill', hexc(mixInt(C.skin, C.gold, .32)));
  st.tokP.setAttribute('stroke', L(.8, C.bone)); st.tokD.setAttribute('stroke', L(.5, C.bone)); st.partner.setAttribute('stroke', L(.8, C.gold)); st.flowerPulse.setAttribute('stroke', L(.9, C.gold));
}
/* a fading mark in the world: a path, a colour toward (ink, gold, bone...), how long it lasts (ms) */
function addMark(c, st, d, tone, life, w = 2.4, kind = ''){
  const m = st.marks[st.mi++ % st.marks.length]; m.t0 = c.t; m.life = life * Math.pow(2, 1.1 * c.pad.comb.L[1]); m.kind = kind; m.tone = tone;
  m.e.setAttribute('d', d); m.e.setAttribute('stroke-width', w); m.e.setAttribute('stroke', hexc(mixInt(c.C.skin, tone, .85))); m.e.setAttribute('opacity', '.9'); m.e.style.display = ''; return m; }
function fadeMarks(c, st, now){
  if(st.fadeT && now - st.fadeT < 100) return; st.fadeT = now;
  for(const m of st.marks){ if(m.t0 < -1e8) continue; const u = (now - m.t0) / m.life; if(u >= 1){ m.t0 = -1e9; m.e.style.display = 'none'; continue; } m.e.setAttribute('opacity', (.9 * Math.pow(1 - u, 1.3)).toFixed(2)); }
}
/* the cell nearest a world point, and filling it (pollen or honey) for good */
function nearestCell(x, y){ let best = null, bd = 1e9; const j0 = Math.round(y / RH); for(let j = j0 - 1; j <= j0 + 1; j++){ const i0 = Math.round((x - (j & 1) * CW / 2) / CW); for(let i = i0 - 1; i <= i0 + 1; i++){ const [cx, cy] = cellXY(i, j), d = Math.hypot(cx - x, cy - y); if(d < bd){ bd = d; best = {i, j, cx, cy}; } } } return best; }
function fillCell(c, st, cell, kind){
  if(!cell || st.store.some(s => s.i === cell.i && s.j === cell.j)) return false;
  st.store.push({i:cell.i, j:cell.j, kind}); let d = '', f = '';
  for(const s of st.store){ const [cx, cy] = cellXY(s.i, s.j); if(s.kind === 'honey'){ f += pathOf(hexAt(cx, cy, CR * .86)); d += pathOf(hexAt(cx, cy, CR * .68)); } else { for(let q = 0; q < 8; q++){ const a = q * .785 + hash(s.i * 7 + s.j + q) * 2, dd = CR * .38 * (q % 2 ? .6 : 1); f += circP(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd, 9); } d += circP(cx, cy, CR * .7); } }
  st.storeEl.setAttribute('d', d); st.storeF.setAttribute('d', f); return true;
}
const bodyWorld = st => [st.g.cwX, st.g.cwY], heading = st => -st.g.phi;
/* the world's step each frame: its transform, the marks' fade */
function drawWorld(c, st, now){
  const g = st.g; if(!g) return; worldColour(c, st);
  if(!c.crew){ const phi = g.phi * 180 / Math.PI, tr = `translate(${CX} ${CY}) rotate(${phi.toFixed(3)}) translate(${(-g.cwX).toFixed(2)} ${(-g.cwY).toFixed(2)})`;
    if(st.tr !== tr){ st.tr = tr; st.grp.setAttribute('transform', tr); } }   // (in a crew the habitat's own camera places the world)
  fadeMarks(c, st, now);
  if(!c.actions.some(a => a.name === 'guardCheck')) st.tok.style.display = 'none';                // an arrival or a partner leaves with the action that brought it, even if it is cut short
  if(!c.actions.some(a => a.name === 'trophallaxis')) st.partner.style.display = 'none';
}
/* the shadows: along the world's light, a point z units above the comb thrown that far; the body (three pieces), the four wings, each leg through its joints, the antennae. In flight the whole animal is high (E.h) and its shadow lies off to one side. */
const SHP = {abd:plate(ABW, -304, -104, -10, 14), th:plate(THW, -86, 84, 0, 0), head:headOutline};
const WSH = {};
for(const s of SIDE) for(const k of ['f', 'h']) WSH[k + sd(s)] = wingOutline(s, k);
function groundDraw(c, st){
  const g = st.g; if(!g) return; const E = c.hb || {h:0}, h = E.h || 0, o = z => g.shadowOff(z), line = (pts, zs) => 'M' + pts.map((p, i) => { const q = o(zs[i]); return f1(p[0] + q[0]) + ' ' + f1(p[1] + q[1]); }).join('L');
  const poly = (pts, bone, z) => { const q = o(z); return 'M' + pts.map(p => { const w = c.wp(typeof bone === 'function' ? bone(p) : bone, p); return f1(w[0] + q[0]) + ' ' + f1(w[1] + q[1]); }).join('L') + 'Z'; };
  const zb = 26 + h;
  g.shadow('abd', poly(SHP.abd, p => p[0] - CX > -218 ? 'abd' : 'abd2', zb), {fill:true, opacity:.42}); g.shadow('th', poly(SHP.th, 'thorax', zb + 4), {fill:true, opacity:.42}); g.shadow('head', poly(SHP.head, 'head', zb), {fill:true, opacity:.4});
  for(const s of SIDE){ const side = sd(s); for(const k of ['f', 'h']) g.shadow('w' + k + side, poly(WSH[k + side], (k === 'f' ? 'fw' : 'hw') + side, zb + 10 + (k === 'h' ? -2 : 0)), {fill:true, opacity:.16 + .1 * (E.A || 0)}); }
  LEGS.forEach((L, k) => { const lf = c.gait && c.gs.on && !c.gait.stance[k] ? Math.sin(Math.PI * Math.max(0, Math.min(1, c.gs.legs[k].p))) : 0, ub = bone_('u' + L.tag), lb = bone_('l' + L.tag), fb = bone_('f' + L.tag), hh = h * .9;
    g.shadow('leg' + k, line([c.wp('u' + L.tag, ub.p), c.wp('l' + L.tag, lb.p), c.wp('f' + L.tag, fb.p), c.toe(k)], [20 + hh, 40 + hh + 8 * lf, 14 + hh + 20 * lf, hh + 30 * lf]), {w:10, opacity:.4}); });
  for(const s of SIDE){ const t = sd(s), A = ANT[t]; g.shadow('ant' + t, line([c.wp(A[0], bone_(A[0]).p), c.wp(A[1], bone_(A[1]).p), c.wp(A[6], bone_(A[6]).p), c.wp(A[11], bone_(A[11]).q)], [zb + 6, zb + 6, zb + 8, zb + 6]), {w:3, opacity:.3}); }
  g.draw(); g.tick(c.dtms, c.t);
}
/* ---------- the gait the dance is walked on: a slow, even walk between the creep and the walk ---------- */
M.gait('waggleRun', {psi:.8, base:'stand', label:'Waggle run', L:64, cyc:640, duty:.6, lift:LIFT, off:OFF(), flex:FLEX, hs:HS, bob:1.2, cap:1.8, lead:0});

/* ---------- navigation: the bee walks and flies by steering the world's heading; an action says where to go ---------- */
const startGait = (c, name) => { const pm = c.pm; if(pm.node !== 'stand' || pm.moving) return; if(c.gait && c.gait.name === name) return; c.go(name); };
function steerTo(c, st, tx, ty, gain = 2.2){ const b = bodyWorld(st), dx = tx - b[0], dy = ty - b[1], err = wrapA(Math.atan2(dy, dx) - heading(st)); st.home = clamp(gain * err, -1, 1); st.homeAt = c.t; return {dist:Math.hypot(dx, dy), err}; }
function walkTo(c, st, tx, ty, o = {}){                                  // true once the bee stands there (the gait has stopped)
  const {dist, err} = steerTo(c, st, tx, ty), r = o.r ?? 40;
  if(dist < r){ st.home = 0; if(c.gait) c.go('stand'); return !c.gait && !c.pm.moving; }
  if(Math.abs(err) > .8) startGait(c, 'shuffle'); else startGait(c, dist > 700 ? 'run' : dist > 160 ? 'walk' : 'creep');
  return false;
}
function turnTo(c, st, psi, o = {}){                                       // turn on the spot to a world heading (true when within tol)
  const err = wrapA(psi - heading(st)); st.home = clamp(2.4 * err, -1, 1); st.homeAt = c.t;
  if(Math.abs(err) < (o.tol ?? .12)){ st.home = 0; return true; }
  startGait(c, 'shuffle'); return false;
}
const settleDown = (c, st) => { st.home = 0; if(c.gait) c.go('stand'); };

/* ---------- actions ----------
   Each is something the animal does, tied to a pattern the roster gives her. Layers run in any posture; the ones that walk or fly steer the world and always end on the stand. */
const WAG = 3.1;                                                           // abdomen waggles a second, drawn slowed (the dancer's are about 13)
const wag = (t, k) => { const s = Math.sin(t * WAG * .00628); return {abdBendR:k * pos(s), abdBendL:k * pos(-s)}; };

/* Recruit: the waggle dance. A straight run along a bearing from the sun line (straight up the page), the abdomen waggling and the wings buzzing; then a return that loops back to the start, to one side, and the next circuit to the other. The run's direction carries
   the bearing, the number of circuits the quality; a stop signal from another bee ends it. Her track is laid on the floor as marks that fade. */
M.action('waggle', {label:'Waggle dance', group:'Recruit', dur:24000, big:true, f:(t, T, c, a) => {
  const st = world(c), E = c.hb, g = st.g; if(!g) return false;
  if(a.mode === undefined){ a.mode = c.pm.node === 'stand' && !c.gait && !c.pm.moving ? 'floor' : 'spot'; a.n = a.circuits ?? 2; a.bear = a.bearing ?? (c.rand() * 2 - 1) * 1.0; a.psiR = -Math.PI / 2 + a.bear; a.side = c.rand() < .5 ? -1 : 1; if(c.crew && a.loop) a.side = a.loop; a.k = 0; a.phase = 'goto'; a.p0 = 0; a.stop0 = E.stopAt; a.acc = 0; }
  if(a.mode === 'spot'){ const u = env(t, 300, 3400, 500); E.bz = Math.max(E.bz, .22 * u); c.spec(T, {...wag(t, .6 * u), abdRaise:.3 * u, flSweepR:.2 * u, flSweepL:.2 * u}); return t < 4200; }
  const here = bodyWorld(st), h = heading(st), D = c.crew && a.at ? a.at : [DANCE.x, DANCE.y], ph = a.phase, tp = t - a.p0, stopped = E.stopAt > a.stop0 || t > 21800;
  const next = n => { a.phase = n; a.p0 = t; a.acc = 0; a.prev = h; };
  const trace = (kind, w) => { if(!a.m || a.mk !== kind){ a.mk = kind; a.pts = []; a.m = addMark(c, st, 'M0 0', kind === 'run' ? c.C.gold : c.C.bone, 24000, w, kind); }
    if(!a.pts.length || Math.hypot(here[0] - a.pts[a.pts.length - 1][0], here[1] - a.pts[a.pts.length - 1][1]) > 14){ a.pts.push([here[0], here[1]]); if(a.pts.length > 1) a.m.e.setAttribute('d', pathOf(a.pts, false)); a.m.t0 = c.t; } };
  if(stopped && ph !== 'end'){ next('end'); }
  if(ph === 'goto'){ const d = Math.hypot(D[0] - here[0], D[1] - here[1]); if(walkTo(c, st, D[0], D[1], {r:90}) || tp > 8000){ settleDown(c, st); next('face'); } return true; }
  if(ph === 'face'){ if(turnTo(c, st, a.psiR, {tol:.1}) || tp > 3500){ settleDown(c, st); next('run'); a.start = here.slice(); a.m = null; } return true; }
  if(ph === 'run'){
    const u = env(tp, 120, 1e6, 0), d = Math.hypot(here[0] - a.start[0], here[1] - a.start[1]);
    st.home = clamp(2.4 * wrapA(a.psiR - h), -1, 1); st.homeAt = c.t; if(c.pm.node === 'stand' && !c.pm.moving && !(c.gait && c.gait.name === 'waggleRun')) c.go('waggleRun');
    if(c.gait && c.gait.name === 'waggleRun' && c.gait.phase === 'run'){ E.bz = Math.max(E.bz, .24); c.spec(T, {...wag(tp, .85), abdRaise:.32}); if(!a.pt0) a.pt0 = tp; trace('run', 6); }
    if(d > 190 || tp > 3200){ a.pt0 = 0; next('turn1'); a.a0 = h; a.m = null; }
    return true; }
  if(ph === 'turn1' || ph === 'turn2'){
    st.omegaT = 1.55; st.home = a.side; st.homeAt = c.t; startGait(c, 'waggleRun'); if(c.gait && c.gait.name !== 'waggleRun') c.go('waggleRun');
    a.acc += wrapA(h - a.prev) * a.side; a.prev = h; trace('loop', 3.4); c.spec(T, {abdRaise:.12});
    if(a.acc > Math.PI - .14 || tp > 3600){ next(ph === 'turn1' ? 'back' : 'again'); a.bp = here.slice(); } return true; }
  if(ph === 'back'){ const tgt = a.psiR + Math.PI; st.home = clamp(2.4 * wrapA(tgt - h), -1, 1); st.homeAt = c.t; startGait(c, 'waggleRun'); if(c.gait && c.gait.name !== 'waggleRun') c.go('waggleRun'); trace('loop', 3.4);
    if(Math.hypot(here[0] - a.bp[0], here[1] - a.bp[1]) > 180 || tp > 2600) next('turn2'); return true; }
  if(ph === 'again'){ a.k++; a.side = -a.side; if(a.k >= a.n) next('end'); else { next('run'); a.start = here.slice(); a.m = null; } return true; }
  /* end: back on the stand, facing wherever the loop left her */
  settleDown(c, st); return t < 23200 && (c.gait || c.pm.moving || tp < 600); }});

/* Quorum: the stop signal, a short head-butt with a vibration, sent to a dancer whose site has been found poor (and, among scouts, to a rival's dancers); it ends a dance. */
M.action('stopSignal', {label:'Stop signal', group:'Recruit', dur:1500, in:['stand', 'dance', 'guard'], f:(t, T, c, a) => {
  const E = c.hb; if(!a.sent){ a.sent = 1; E.stopAt = c.t; }
  const u = env(t, 140, 520, 340), v = Math.sin(t * .066);
  c.Q.bx += 3 * u * v; c.spec(T, {headTurnR:.5 * pulse(t, 100, 160, 240, 300), power:.4 * u, abdRaise:.3 * u, scapeOutR:.4 * u, scapeOutL:.4 * u}); E.bz = Math.max(E.bz, .16 * u); }});
/* Quorum: piping, the scouts' call to take off once enough of them agree: the thorax shivers hard with the wings left folded and the abdomen lifted */
M.action('pipe', {label:'Piping', group:'Recruit', dur:3600, in:['stand', 'dance'], f:(t, T, c) => {
  const u = env(t, 400, 2400, 700), v = .5 + .5 * Math.sin(t * .045);
  c.spec(T, {power:.95 * u * v, abdRaise:.4 * u, wingFoldR:.5 * u, wingFoldL:.5 * u, mandOpenR:.18 * u, mandOpenL:.18 * u, scapeOutR:.3 * u, scapeOutL:.3 * u, flSweepR:.2 * u, flSweepL:.2 * u}); c.Q.bx += 1.4 * u * Math.sin(t * .05); }});

/* Haul: the tremble dance. A forager made to wait for a receiver shakes her whole body while she walks about the comb, not along any bearing; she recruits more receivers. How long and how hard she shakes reads the delay (a.delay, 0 to 1). */
M.action('tremble', {label:'Tremble dance', group:'Haul', dur:6500, gait:true, f:(t, T, c, a) => {
  const st = world(c), dl = a.delay ?? .6, len = 2800 + 2600 * dl, u = env(t, 350, len, 700);
  if(!a.go && c.pm.node === 'stand' && !c.gait && t > 250){ a.go = 1; c.go('creep', {for:len}); }
  if(c.gait){ st.home = .85 * Math.sin(t * .0016 + 1) * u; st.homeAt = c.t; }
  const v = Math.sin(t * .029), amp = (.5 + .5 * dl) * u;
  c.Q.bx += 5.5 * amp * v; c.Q.by += 2.6 * amp * Math.sin(t * .023 + 1);
  c.spec(T, {abdRaise:.38 * u, flSweepR:.35 * u, flSweepL:.35 * u, scapeOutR:.3 * u, scapeOutL:.3 * u, trunk:.5 * amp * v, ...wag(t * .4, .25 * amp)}); }});

/* Scout: out and back. She lifts off, flies out through the entrance to a flower, hovers and reads it (the nectar's taste, a sip), and flies back to land on the dance floor. */
M.action('scout', {label:'Scout flight', group:'Scout', dur:18500, big:true, f:(t, T, c, a) => {
  const st = world(c), E = c.hb, g = st.g; if(!g) return false;
  if(a.mode === undefined){ a.mode = c.pm.node === 'stand' && !c.pm.moving ? 'fly' : 'look'; a.phase = 'lift'; a.fl = a.flower ?? ((c.rand() * FLOWERS.length) | 0); a.p0 = 0; a.wp = 0; }
  const here = bodyWorld(st), tp = t - a.p0, F = FLOWERS[a.fl];
  const next = n => { a.phase = n; a.p0 = t; a.wp = 0; };
  if(a.mode === 'look'){ const u = env(t, 300, 3000, 500); c.spec(T, {scapeOutR:.5 * u, scapeOutL:.5 * u, flSweepR:.4 * u * Math.sin(t * .006), flSweepL:.4 * u * Math.sin(t * .006 + 1.2), headTurnR:.3 * u * pos(Math.sin(t * .003)), headTurnL:.3 * u * pos(-Math.sin(t * .003))}); return t < 3800; }
  if(t > 14800 && a.phase !== 'land') next('land');
  if(a.phase === 'lift'){ if(c.gait){ c.go('stand'); } else if(c.pm.node !== 'flight' && c.pm.want !== 'flight' && !c.pm.moving) c.go('flight'); if(c.pm.node === 'flight' && !c.pm.moving && tp > 600){ next('out'); } if(tp > 4200) next('out'); return true; }
  const fly = (x, y, r) => { const d = steerTo(c, st, x, y, 2.6); E.fvT = 1; return d.dist < r; };
  if(a.phase === 'out'){ const way = [[ENT.x - 40, 0], [F[0] - 120, F[1]]]; if(fly(way[a.wp][0], way[a.wp][1], 150)){ if(++a.wp >= way.length) next('look'); } if(tp > 8000) next('look'); return true; }
  if(a.phase === 'look'){ const d = steerTo(c, st, F[0], F[1], 2); E.fvT = Math.hypot(F[0] - here[0], F[1] - here[1]) > 160 ? .35 : .0; const u = env(tp, 300, 1500, 400);
    c.spec(T, {flSweepR:.4 * u * Math.sin(tp * .007), flSweepL:.4 * u * Math.sin(tp * .007 + 1), probExtend:.8 * pulse(tp, 600, 300, 500, 300), probLap:.6 * pulse(tp, 700, 200, 400, 200)});
    if(!a.pulse && Math.hypot(F[0] - here[0], F[1] - here[1]) < 220){ a.pulse = c.t; st.visits[a.fl]++; }
    if(tp > 2300) next('back'); return true; }
  if(a.phase === 'back'){ const way = [[ENT.x - 40, 0], [DANCE.x + 160, 0]]; if(fly(way[a.wp][0], way[a.wp][1], a.wp ? 120 : 150)){ if(++a.wp >= way.length) next('land'); } if(tp > 8000) next('land'); return true; }
  /* land */
  E.fvT = 0; st.home = 0; if(c.pm.node !== 'stand' && c.pm.want !== 'stand') c.go('stand'); return !(c.pm.node === 'stand' && !c.pm.moving && tp > 800); }});

/* Guard: at the entrance she meets each arrival with her antennae and admits or refuses it by its odour. a.verdict is 'admit' or 'refuse'. A mimic that carries the right smell passes (the pattern's failure); the record of what she
   admitted is the token she leaves behind. */
M.action('guardCheck', {label:'Guard: check an arrival', group:'Guard', dur:17500, big:true, f:(t, T, c, a) => {
  const st = world(c), E = c.hb, g = st.g; if(!g) return false;
  const W = c.crew && a.who;                                              // in a crew the arrival is a real bee (a crew member, a.who), checked by what its odour says (m.odour against the guard's own); no token is drawn
  if(a.mode === undefined){ a.mode = c.pm.node === 'stand' && !c.pm.moving ? 'post' : 'look'; a.v = a.verdict ?? (W ? ((W.odour || 'colony') === (c.crew.m.odour || 'colony') ? 'admit' : 'refuse') : null) ?? (c.rand() < .65 ? 'admit' : 'refuse'); a.phase = 'goto'; a.p0 = 0; a.y = (c.rand() < .5 ? -1 : 1) * 60; }
  const here = bodyWorld(st), tp = t - a.p0, next = n => { a.phase = n; a.p0 = t; };
  const tok = (x, y, show, tone) => { const e = st.tok; e.style.display = show && !c.crew ? '' : 'none'; if(!show || c.crew) return; e.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`); st.tokP.setAttribute('d', pathOf(hexAt(0, 0, 30)) + circP(0, 0, 6)); st.tokD.setAttribute('d', 'M-80 -12Q-60 -26 -42 -12M-100 12Q-78 26 -56 12'); st.tokP.setAttribute('stroke', hexc(mixInt(c.C.skin, tone, .9))); };
  const sweep = (u, f) => c.spec(T, {scapeOutR:.55 * u, scapeOutL:.55 * u, flSweepR:.5 * u * Math.sin(t * f), flSweepL:.5 * u * Math.sin(t * f + 1.7), flCurlR:.15 * u, flCurlL:.15 * u});
  if(a.mode === 'look'){ const u = env(t, 300, 3200, 500); sweep(u, .011); tok(0, 0, false); return t < 4000; }
  const post = [ENT.x - 80, a.y];
  if(t > 15300 && a.phase !== 'end'){ tok(0, 0, false); next('end'); }
  if(a.phase === 'goto'){ if(walkTo(c, st, post[0], post[1], {r:70}) || tp > 8000){ settleDown(c, st); next('face'); } return true; }
  if(a.phase === 'face'){ if(turnTo(c, st, 0, {tol:.1}) || tp > 3000){ settleDown(c, st); next('wait'); } return true; }
  if(a.phase === 'wait'){ if(c.pm.node !== 'guard' && c.pm.want !== 'guard') c.go('guard'); if(c.pm.node === 'guard' && !c.pm.moving){ next('arrive'); a.tx = ENT.x + 380; } return tp < 6000 || true; }
  if(a.phase === 'arrive' && W){ const hd = [here[0] + Math.cos(heading(st)) * 190, here[1] + Math.sin(heading(st)) * 190], q = W.pose(); sweep(.5, .008); if(Math.hypot(q.x - hd[0], q.y - hd[1]) < 560 || tp > 14000) next('inspect'); return true; }   // (a crew: she waits for the real arrival to come within reach of her antennae)
  if(a.phase === 'arrive'){ const u = fSmooth(0, 2200, tp), x = ENT.x + 420 - (ENT.x + 420 - (here[0] + 215)) * u; tok(x, here[1] * .0 + a.y * .4 * (1 - u), true, c.C.bone); sweep(.5 + .5 * u, .008); if(tp > 2300) next('inspect'); return true; }
  if(a.phase === 'inspect'){ tok(here[0] + 215, a.y * 0, true, c.C.bone); sweep(1, .016); c.spec(T, {headTurnR:.28 * Math.sin(tp * .006) * .5 + .12, headTurnL:.28 * Math.sin(tp * .006 + 2.4) * .5 + .12, mandOpenR:.1, mandOpenL:.1}); if(tp > 2200) next(a.v); return true; }
  if(a.phase === 'admit'){ const u = fSmooth(0, 2400, tp); tok(here[0] + 215 - (here[0] + 215 - (ENT.x - 380)) * u, -a.y * 1.3 * Math.sin(Math.PI * u), true, c.C.bone);
    c.spec(T, {scapeOutR:.7 * env(tp, 300, 1400, 600), scapeOutL:.7 * env(tp, 300, 1400, 600), headTurnR:.4 * env(tp, 300, 1500, 500), flSweepR:.2, flSweepL:.2});
    if(tp > 2800){ tok(0, 0, false); next('end'); } return true; }
  if(a.phase === 'refuse'){ const u = fSmooth(300, 1800, tp), v = env(tp, 150, 800, 500); tok(here[0] + 215 + 340 * u, a.y * .3 * u, tp < 1900, c.C.cin);
    E.bz = Math.max(E.bz, .35 * v); c.Q.rx += 14 * pulse(tp, 100, 160, 260, 300);
    c.spec(T, {mandOpenR:.9 * v, mandOpenL:.9 * v, wingOpenR:.45 * v, wingOpenL:.45 * v, stingProtract:.6 * v, abdRaise:.4 * v, flSweepR:.3 * v, flSweepL:.3 * v, scapeOutR:.3 * v, scapeOutL:.3 * v});
    if(tp > 2600){ tok(0, 0, false); next('end'); } return true; }
  tok(0, 0, false); if(c.pm.node !== 'stand' && c.pm.want !== 'stand') c.go('stand'); return !(c.pm.node === 'stand' && !c.pm.moving && tp > 500); }});
/* Tend: trophallaxis, a mouth-to-mouth exchange of nectar with a nestmate (a.dir 'give' or 'take'). The proboscis goes out and laps, a drop rises at its tip and passes; the crop shrinks (or swells). */
M.action('trophallaxis', {label:'Trophallaxis', group:'Tend', dur:7200, in:['feed'], f:(t, T, c, a) => {
  const st = world(c), E = c.hb, g = st.g; if(!g) return false;
  if(a.init === undefined){ a.init = 1; a.give = (a.dir ?? (E.crop > .3 ? 'give' : c.rand() < .5 ? 'give' : 'take')) === 'give'; a.c0 = E.crop; a.c1 = a.give ? Math.max(0, E.crop - .5) : Math.min(1, E.crop + .5); a.h = heading(st); a.b = bodyWorld(st); }
  const u = env(t, 700, 5300, 700), lap = .5 + .5 * Math.sin(t * .0155), part = st.partner, px = a.b[0] + Math.cos(a.h) * 492, py = a.b[1] + Math.sin(a.h) * 492;
  c.spec(T, {probLap:.7 * u * lap, probExtend:.1 * u, probSwingR:.25 * u * pos(Math.sin(t * .0033)), probSwingL:.25 * u * pos(-Math.sin(t * .0033)), flSweepR:.3 * u * Math.sin(t * .005), flSweepL:.3 * u * Math.sin(t * .005 + 1.1), scapeOutR:.25 * u, scapeOutL:.25 * u});
  E.dropT = Math.max(E.dropT, u * (.35 + .65 * fSmooth(0, 1, .5 + .5 * Math.sin(t * .0022 - 1.2)))); E.cropT = a.c0 + (a.c1 - a.c0) * fSmooth(900, 5400, t);
  part.style.display = u > .02 && !c.crew ? '' : 'none'; if(u > .02 && !c.crew){ part.setAttribute('transform', `translate(${f1(px)} ${f1(py)}) rotate(${(a.h * 180 / Math.PI).toFixed(1)})`); part.setAttribute('d', 'M0 -26Q26 -26 26 0Q26 26 0 26Q-26 26 -26 0Q-26 -26 0 -26M10 -22Q34 -46 56 -44M10 22Q34 46 56 44M-8 -8l-10 0M-8 8l-10 0'); part.setAttribute('opacity', (.9 * u).toFixed(2)); }
  if(t > 6600) part.style.display = 'none'; }});

/* Tend: grooming. The foreleg's notch cleans the antenna: the scape is drawn through it from base to tip (one side, then the other). The head dips to meet the leg. */
M.action('groom', {label:'Clean the antennae', group:'Tend', dur:5200, in:['stand'], f:(t, T, c) => {
  for(const [s, k, w] of [[1, 0, 0], [-1, 3, 1]]){ const t0 = 300 + w * 2300, u = env(t - t0, 300, 1500, 400), q = .5 + .5 * Math.sin((t - t0) * .0072 - 1), side = s > 0 ? 'R' : 'L';
    if(u > .01){ const px = 150 + 64 * q, py = 38 + 8 * q;
      c.legTo(k, CX + px, CY + s * py, Math.atan2(s * Math.sin(-.4), Math.cos(-.4)), u * .95, u, {kk:12});
      c.spec(T, {['scapeOut' + side]:.55 * u, ['flSweep' + side]:.75 * u, ['flCurl' + side]:.5 * u * q, ['headTurn' + side]:.18 * u, mandOpenR:.05 * u, mandOpenL:.05 * u}); } } }});

/* Haul: packing pollen. The front legs brush the fur of the head and thorax, the middle legs gather it onto the hind legs' combs, the hind legs rub together and the presses pack it up into the baskets. The loads grow. */
M.action('pollen', {label:'Pack pollen', group:'Haul', dur:6800, in:['stand'], f:(t, T, c, a) => {
  const E = c.hb, u = env(t, 500, 5200, 800), q = Math.sin(t * .009), p = Math.sin(t * .0075 + 1), r = Math.sin(t * .0082 + 2.2);
  for(const s of SIDE){ const side = sd(s), k0 = s > 0 ? 0 : 3, k1 = k0 + 1, k2 = k0 + 2, ph = s > 0 ? 0 : 1.5;
    c.legTo(k0, CX + 118 + 26 * Math.sin(t * .009 + ph), CY + s * (24 + 20 * Math.sin(t * .007 + ph)), Math.atan2(s * Math.sin(-.9), Math.cos(-.9)), u * .9, u, {kk:12});
    c.legTo(k1, CX - 52 + 26 * Math.sin(t * .0075 + ph), CY + s * (118 + 14 * Math.sin(t * .0075 + ph)), Math.atan2(s * Math.sin(2.1), Math.cos(2.1)), u * .85, u, {kk:12});
    c.legTo(k2, CX - 154 + 18 * Math.sin(t * .0082 + ph), CY + s * (118 + 10 * Math.sin(t * .0082 + ph)), Math.atan2(s * Math.sin(2.9), Math.cos(2.9)), u * .85, u, {kk:12});
    c.spec(T, {['press' + side + '2']:.9 * u * (.5 + .5 * Math.sin(t * .011 + ph)), ['flSweep' + side]:.2 * u}); }
  const kk = fSmooth(900, 5400, t); for(let k = 0; k < 2; k++) E.loadT[k] = Math.max(E.loadT[k], a.l0 === undefined ? (a.l0 = E.loadT[k]) + .6 * kk : a.l0 + .6 * kk); E.loadT[0] = Math.min(1, E.loadT[0]); E.loadT[1] = Math.min(1, E.loadT[1]);
  c.spec(T, {abdBendR:.3 * u * pos(q), abdBendL:.3 * u * pos(-q)}); }});
/* Tend and Haul: unloading into a cell. She backs to the comb and the load goes into the cell under her (pollen or nectar, whichever she carries); the cell stays filled. */
M.action('unload', {label:'Unload into a cell', group:'Haul', dur:4600, in:['stand'], f:(t, T, c, a) => {
  const st = world(c), E = c.hb, g = st.g; if(!g) return false; const u = env(t, 500, 3000, 600), r = Math.sin(t * .01);
  c.legTo(1, CX - 40, CY + 130 + 8 * r, 1.9, u * .8, u, {kk:12}); c.legTo(4, CX - 40, CY - 130 - 8 * r, -1.9, u * .8, u, {kk:12});
  c.spec(T, {abdRaise:.4 * u, pressR2:.7 * u * pos(r), pressL2:.7 * u * pos(-r), flSweepR:.25 * u, flSweepL:.25 * u});
  if(!a.done && t > 1500){ a.done = 1; const b = bodyWorld(st), cell = nearestCell(b[0] + Math.cos(heading(st)) * 60, b[1] + Math.sin(heading(st)) * 60);
    if(E.crop > .15 || E.loadT[0] > .15){ fillCell(c, st, cell, E.crop > .15 ? 'honey' : 'pollen'); E.loadT[0] = E.loadT[1] = 0; E.cropT = 0; } }
  if(a.done) E.loadT[0] = E.loadT[1] = 0; }});
/* Guard: the sting. The abdomen swings to one side, the sting slides out of its chamber, a jab; the wings flare and the mandibles open. */
M.action('sting', {label:'Sting', group:'Guard', dur:3000, in:['stand', 'guard'], f:(t, T, c, a) => {
  const E = c.hb, sd_ = a.side ?? (a.side = c.rand() < .5 ? 1 : -1), u = env(t, 350, 1500, 600), j = pulse(t, 700, 140, 220, 300) + pulse(t, 1300, 140, 220, 300);
  c.spec(T, {[sd_ > 0 ? 'abdBendR' : 'abdBendL']:.9 * u, [sd_ > 0 ? 'stingAimR' : 'stingAimL']:.7 * u, stingProtract:.45 * u + .55 * j, abdRaise:.5 * u, mandOpenR:.7 * u, mandOpenL:.7 * u, wingOpenR:.4 * u, wingOpenL:.4 * u, scapeOutR:.3 * u, scapeOutL:.3 * u});
  E.bz = Math.max(E.bz, .3 * u); c.Q.rx += 8 * j; }});
/* Keep and Haul: fanning at the entrance, the abdomen raised to show the Nasonov gland and the wings driving air, which carries the colony's scent out to the returning foragers. Rings of scent leave the abdomen's tip and fade. */
M.action('fanScent', {label:'Fan the scent', group:'Tend', dur:6000, in:['fan'], f:(t, T, c, a) => {
  const st = world(c), g = st.g; if(!g) return false; const u = env(t, 500, 4600, 700);
  c.spec(T, {abdRaise:.45 * u, abdBendR:.1 * u * Math.sin(t * .004), abdBendL:.1 * u * Math.sin(t * .004 + 3.1)}); c.hb.bz = Math.max(c.hb.bz, .1);
  if(u > .2 && (!a.last || c.t - a.last > 700)){ a.last = c.t; const tip = c.wp('abd2', P(-300, 0)), w = g.toWorld(tip[0], tip[1]), h = heading(st);
    for(let k = 0; k < 3; k++){ const r = 40 + k * 34, a0 = h + Math.PI - .9, a1 = h + Math.PI + .9; let d = ''; for(let q = 0; q <= 8; q++){ const aa = a0 + (a1 - a0) * q / 8; d += (q ? 'L' : 'M') + f1(w[0] + Math.cos(aa) * (r + 120)) + ' ' + f1(w[1] + Math.sin(aa) * (r + 120)); }
      addMark(c, st, d, c.C.gold, 2600 - k * 400, 2 - k * .2, 'scent'); } } }});
/* Tend: working wax. The glands slide the scales out between the sterna; the mandibles chew them soft. */
M.action('waxWork', {label:'Work wax', group:'Tend', dur:5400, in:['stand', 'rest'], f:(t, T, c) => {
  const u = env(t, 800, 3300, 900), m = Math.sin(t * .014);
  c.spec(T, {waxGlandR:.9 * u, waxGlandL:.9 * u, mandOpenR:.45 * u * pos(m), mandOpenL:.45 * u * pos(m), mandCloseR:.3 * u * pos(-m), mandCloseL:.3 * u * pos(-m), abdRaise:.2 * u, flSweepR:.2 * u, flSweepL:.2 * u}); }});
/* shivering: the thorax's power muscles contract with the wings uncoupled, which warms her; the thorax pulses and the body trembles a little */
M.action('shiver', {label:'Shiver to warm up', group:'Body', dur:4000, in:['stand', 'rest'], f:(t, T, c) => {
  const u = env(t, 500, 2800, 600), v = .5 + .5 * Math.sin(t * .05); c.spec(T, {power:.9 * u * v, wingFoldR:.25 * u, wingFoldL:.25 * u, breath:.5 * u}); c.Q.bx += 1.2 * u * Math.sin(t * .06); }});
/* a wing stretch: the wings lifted out of their fold, a flutter, and folded again */
M.action('stretch', {label:'Stretch the wings', group:'Body', dur:3800, in:['stand', 'rest'], f:(t, T, c) => {
  const u = env(t, 900, 1300, 1100), fl = .5 + .5 * Math.sin(t * .02); c.spec(T, {wingOpenR:.85 * u, wingOpenL:.85 * u, wingFoldR:-.4 * u, wingFoldL:-.4 * u, basalarR:.4 * u * fl, basalarL:.4 * u * fl, abdRaise:.25 * u, scapeOutR:.2 * u, scapeOutL:.2 * u}); }});
const turnAct = dir => (t, T, c, a) => { if(!a.go && t > 40){ a.go = 1; c.go('shuffle', {for:1700, turn:dir}); } };
M.action('turnLeft', {label:'Turn left', group:'Ground', dur:4200, in:['stand'], f:turnAct(-1)});
M.action('turnRight', {label:'Turn right', group:'Ground', dur:4200, in:['stand'], f:turnAct(1)});
/* tiny layers: they run everywhere and never touch the feet */
M.action('antennaFlick', {label:'Antenna flick', group:'Head', dur:1200, tiny:true, f:(t, T, c) => { const u = pulse(t, 80, 120, 120, 360) + pulse(t, 520, 100, 100, 300); c.spec(T, {scapeOutR:.5 * u, scapeOutL:.4 * u, flSweepR:.5 * u, flSweepL:.35 * u, flCurlR:.3 * u, flCurlL:.2 * u}); }});
M.action('mouthWork', {label:'Mouth work', group:'Head', dur:1500, tiny:true, f:(t, T, c) => { const u = env(t, 200, 800, 300), h = Math.sin(t * .026); c.spec(T, {mandOpenR:.4 * u * pos(h), mandOpenL:.4 * u * pos(h), mandCloseR:.2 * u * pos(-h), mandCloseL:.2 * u * pos(-h), probLap:.2 * u * pos(h)}); }});
M.action('headScan', {label:'Scan', group:'Head', dur:2000, tiny:true, f:(t, T, c) => { const u = env(t, 250, 1100, 450), s = Math.sin(t * .0048); c.spec(T, {headTurnR:.5 * u * pos(s), headTurnL:.5 * u * pos(-s), scapeOutR:.25 * u, scapeOutL:.25 * u, flSweepR:.3 * u, flSweepL:.3 * u}); }});


/* ---------- pads ---------- */
M.pad('antennae', {label:'Antennae', group:'Head', x:['in', 'out'], y:['level', 'curl'], map:(x, y) => ({scapeOutR:pos(x) * .9, scapeOutL:pos(x) * .9, scapeInR:pos(-x) * .9, scapeInL:pos(-x) * .9, flSweepR:x * .7, flSweepL:x * .7, flCurlR:pos(y), flCurlL:pos(y)}),
  ghost:c => [cl(c.act('scapeOutR') - c.act('scapeInR')), cl(c.act('flCurlR'))]});
M.pad('head', {label:'Head', group:'Head', x:['left', 'right'], y:['', ''], map:x => ({headTurnR:pos(x), headTurnL:pos(-x)}), ghost:c => [cl(c.act('headTurnR') - c.act('headTurnL')), 0]});
M.pad('mouth', {label:'Mandibles · proboscis', group:'Head', x:['closed', 'open'], y:['folded', 'out'], map:(x, y) => ({mandOpenR:pos(x), mandOpenL:pos(x), mandCloseR:pos(-x), mandCloseL:pos(-x), probExtend:pos(y), probLap:pos(y) * pos(x) * .8}),
  ghost:c => [cl(c.act('mandOpenR') - c.act('mandCloseR')), cl(c.act('probExtend'))]});
M.pad('wings', {label:'Wings', group:'Wings', x:['folded', 'spread'], y:['swept back', 'swept forward'], map:(x, y) => ({wingOpenR:pos(x), wingOpenL:pos(x), wingFoldR:pos(-x), wingFoldL:pos(-x), basalarR:pos(y) * .6, basalarL:pos(y) * .6, subalarR:pos(-y) * .6, subalarL:pos(-y) * .6, hamuliR:pos(x) * .5, hamuliL:pos(x) * .5}),
  ghost:c => [cl(c.act('wingOpenR') - c.act('wingFoldR')), cl(c.act('basalarR') - c.act('subalarR'))]});
M.pad('beat', {label:'Wingbeat · rate and reach', group:'Wings', value:true, x:['slow', 'fast'], y:['narrow', 'wide'], ghost:c => [cl(c.pad.beat.L[0]), cl(c.pad.beat.L[1])]});
M.pad('abdomen', {label:'Abdomen', group:'Body', x:['left', 'right'], y:['lowered', 'raised'], map:(x, y) => ({abdBendL:pos(-x), abdBendR:pos(x), abdRaise:pos(y)}), ghost:c => [cl(c.act('abdBendR') - c.act('abdBendL')), cl(c.act('abdRaise'))]});
M.pad('sting', {label:'Sting', group:'Body', x:['sheathed', 'out'], y:['aim left', 'aim right'], map:(x, y) => ({stingProtract:pos(x), stingAimL:pos(-y), stingAimR:pos(y)}), ghost:c => [cl(c.act('stingProtract')), cl(c.act('stingAimR') - c.act('stingAimL'))]});
M.pad('loads', {label:'Nectar · pollen · wax', group:'Body', x:['empty', 'laden'], y:['', 'wax'], map:(x, y) => ({crop:pos(x), pollenLoadR2:pos(x), pollenLoadL2:pos(x), waxGlandR:pos(y), waxGlandL:pos(y)}), ghost:c => [cl(c.act('crop')), cl(c.act('waxGlandR'))]});
M.pad('body', {label:'Body', group:'Body', x:['slack', 'tense'], y:['', ''], map:x => ({breath:pos(x) * .5, trunk:x}), ghost:c => [cl(c.act('trunk') / .06), 0]});
for(let i = 0; i < 3; i++) M.pad('leg' + i, {label:'Leg pair ' + (i + 1), group:'Limbs', split:'NF', leg:'leg' + i, x:['left', 'right'], y:['flexed', 'stretched']});
M.pad('steer', {label:'Steer (while it steps)', group:'Ground', value:true, x:['turn left', 'turn right'], y:['', ''], ghost:c => [cl(c.pad.steer.L[0]), 0]});
M.pad('comb', {label:'Comb · prints', group:'Ground', value:true, x:['', ''], y:['fading', 'lasting'], ghost:c => [0, cl(c.pad.comb.L[1])]});

/* ---------- a crew's world (creature-crew.js, crew-honeybee.js, CREW-NOTES-HONEYBEE.md) ----------
   The hive above is drawn for one bee: a 300-unit dance floor, a 175-unit entrance gap, six small flowers. A crew of bees needs the world at its own scale. crewWorld(cfg) sets it, before the first bee of the crew is
   mounted (a bee builds the world when she first steps): cfg is {dance:{x, y, r}, ent:{x, gap, board}, flowers:[[x, y, r], ...], cells:{i0, i1, j0, j1, x0} (the comb's extent), brood:{x, y, r} (a patch of open brood)}.
   Only a crew page calls it; a bee on her own page never does, and every default is what it was. It also hands out the body's outline (half widths by a) so that a crew can tell a touch from a miss. */
function crewWorld(cfg = {}){
  if(cfg.dance) Object.assign(DANCE, cfg.dance);
  if(cfg.ent) Object.assign(ENT, cfg.ent);
  if(cfg.flowers){ FLOWERS.length = 0; FLOWERS.push(...cfg.flowers); }
  if(cfg.cells) Object.assign(CELLS, cfg.cells);
  if(cfg.brood) Object.assign(BROOD, cfg.brood, {on:true}); else if(cfg.brood === null) BROOD.on = false;
  return {DANCE, ENT, FLOWERS, CELLS, BROOD};
}
window.CreatureHoneybee = {crewWorld, ABW, THW, HDW, CX, CY, FREQ, CW, RH, cellXY, nearestCell};

const DEF = M.finish({
  reachCap:-999, strideMax:104,
  /* the anatomy audit (tools/creature-anatomy-audit.mjs) reads these as deliberate, with the reason: the hamuli are the hindwing's hooks; at rest they lie under the forewing's rear fold, so the audit finds the forewing nearest to them, but they belong to the hindwing, to which they are bound, and that is what couples the pair in flight */
  /* and the compound eyes: bound to the head, but the audit's nearest bone to an eye at the head's side is the foreleg's tibia, which lies close beside it in plan view (the eye is on the head and turns with it; the leg is a different bone) */
  audit:{allow:{deadParts:['^whiskHamuli[RL]$', '^eye[RL]$']}},
  idle(c, now, Ti, dt){
    figureStep(c, now, dt);
    const st = world(c), g = st.g; if(!g) return;
    const E = c.hb, pw = c.pm.w;
    c.spec(Ti, {breath:.3 + .3 * Math.sin(now * .0044), trunk:.1 * Math.sin(now * .0021), flSweepR:.1 + .05 * Math.sin(now * .0033), flSweepL:.1 + .05 * Math.sin(now * .0033 + 1.7), flCurlR:.06 + .04 * Math.sin(now * .0041), flCurlL:.06 + .04 * Math.sin(now * .0041 + 2.1)});
    if(!c.svg.__hwGo){ c.svg.__hwGo = 1; const go0 = c.go, play0 = c.play;
      c.go = (n, o) => { const S = c.svg.__hw; if(o && o.turn !== undefined && S) S.turn = o.turn; return go0(n, o); };
      c.play = (n, a) => { const S = c.svg.__hw; if(a && a.turn !== undefined && S) S.turn = a.turn; return play0(n, a); }; }
    if(now - st.homeAt > 90) st.home *= .86;
    const b = bodyWorld(st), far = Math.hypot(b[0] - ROAMC[0], b[1] - ROAMC[1]);
    let roam = 0; if(!c.crew && c.life && c.life.on && c.gait && now - st.homeAt > 300 && far > 850){ const err = wrapA(Math.atan2(ROAMC[1] - b[1], ROAMC[0] - b[0]) - heading(st)); roam = clamp(2.6 * err, -1, 1); }
    const steer = clamp(st.turn + c.pad.steer.L[0] + st.home + roam, -1, 1), om = st.omegaT || 1.35; st.omegaT = 0;
    g.setParams({grain:0, persist:Math.pow(2, 1.5 * c.pad.comb.L[1]), thrown:0});
    g.update(c, {now, dt, mirror:false, steer, legs:6, trailing:() => true, omega:om, onStop:() => { const S = c.svg.__hw; if(S) S.turn = 0; }});
    /* flight: the world scrolls under her at a cruise speed while she holds the flight posture, and turns at the rate she steers */
    const fl = pw.flight || 0;
    E.fv += (E.fvT * fSmooth(.55, .95, fl) - E.fv) * sm(1, 500, dt); E.fvT = 0; E.om += ((fl > .6 ? steer : 0) - E.om) * sm(1, 320, dt);
    if(!c.gait && (E.fv > .003 || Math.abs(E.om) > .003)) g.step(560 * E.fv * dt / 1000, -E.om * 2.4 * dt / 1000);
    { const op = Math.max(0, (c.act('wingOpenR') + c.act('wingOpenL')) / 2), cm = c.Q.cam; if(cm && op > .05) c.Q.cam = {s:Math.max(cm.s, 1 + .4 * fSmooth(.15, .95, op)), x:cm.x, y:cm.y}; }   // the camera makes room for wings opened off a posture that frames them folded
    E.zone = zoneAt(b[0], b[1]);
    st.last = now;
  },
  colour:(c, i, col) => col,
  colourLive(c, now){ const st = world(c); drawWorld(c, st, now); groundDraw(c, st); },
  postureHold(c, w, Ta){
    const g = w.guard || 0, d = w.dance || 0, fn = w.fan || 0, fl = w.flight || 0, rs = w.rest || 0, st = w.stand || 0, fd = w.feed || 0, fa = w.fallen || 0;
    const E = c.hb || (c.hb = newE()), k = 1 - Math.exp(-Math.min(60, c.dtms || 16) / 430);   // the wings follow the posture through a slow low-pass, so a redirected transition never swings them quickly
    E.so += ((.26 * g + .5 * d + fn + fl + .46 * fa) - E.so) * k; E.sf += ((.7 * rs + .4 * (st + fd) + .2 * g) - E.sf) * k; E.sh += ((.5 * fl + .3 * fn + .2 * d) - E.sh) * k;
    const fold = E.sf, open = E.so, ham = E.sh;
    c.spec(Ta, {wingFoldR:fold, wingFoldL:fold, wingOpenR:open, wingOpenL:open, hamuliR:ham, hamuliL:ham, abdRaise:.25 * d + .55 * fn + .12 * g, probExtend:.95 * fd, mandOpenR:.22 * g + .1 * fd, mandOpenL:.22 * g + .1 * fd,
      scapeOutR:.3 * g + .15 * fd + .2 * fl, scapeOutL:.3 * g + .15 * fd + .2 * fl, flSweepR:.3 * g + .2 * fl, flSweepL:.3 * g + .2 * fl, flCurlR:.3 * fa, flCurlL:.1 * fa, headTurnR:.25 * fa});
  },
  life:{rate:1.4,
    small:[['antennaFlick', 1.6, 5000], ['headScan', 1.2, 7000], ['mouthWork', 1, 8000], ['groom', 1.2, 14000, ['stand']], ['stretch', .7, 28000, ['stand', 'rest']], ['waxWork', .5, 34000, ['stand', 'rest']], ['shiver', .5, 38000, ['stand', 'rest']],
      ['tremble', .8, 34000, ['stand']], ['waggle', .9, 40000, ['stand']], ['guardCheck', .7, 46000, ['stand']], ['scout', .8, 52000, ['stand']], ['pollen', .8, 36000, ['stand']], ['unload', .6, 40000, ['stand']], ['trophallaxis', 1.4, 20000, ['feed']],
      ['stopSignal', .5, 30000, ['stand', 'dance']], ['pipe', .4, 42000, ['stand', 'dance']], ['sting', .3, 60000, ['guard']], ['fanScent', 1.4, 20000, ['fan']]],
    moves:[['go:rest', .7, 14000, ['stand']], ['go:stand', 1.3, 0, ['rest', 'feed', 'guard', 'dance', 'fan']], ['go:feed', .6, 20000, ['stand']], ['go:guard', .6, 22000, ['stand']], ['go:dance', .5, 22000, ['stand']], ['go:fan', .5, 24000, ['stand']],
      ['walk', 1, 10000, ['stand']], ['creep', .6, 12000, ['stand']], ['run', .3, 26000, ['stand']], ['turnLeft', .5, 22000, ['stand']], ['turnRight', .5, 22000, ['stand']]],
    dwell:{stand:[2200, 4200], rest:[3000, 6000], feed:[5000, 9000], guard:[4000, 8000], dance:[3500, 7000], fan:[5000, 9000], flight:[3000, 6000], fallen:[5000, 9000]},
    gait:[['antennaFlick', 1.6, 5000], ['tremble', .8, 30000], ['headScan', 1, 8000]], gaitFor:{walk:[3000, 6000], creep:[2400, 4400], run:[1800, 3200]}},
});
for(const D of DEF.IKD){ D.a[1] = D.a[0] + K.wrapA(D.a[1] - D.a[0]); D.a[2] = D.a[1] + K.wrapA(D.a[2] - D.a[1]); }
K.define(DEF);
})();
