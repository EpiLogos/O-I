/* creature-crab.js — the CRAB, Cancer ♋, on creature-kit.js. Read CREATURE-SPEC.md and CREATURE-NOTES-CRAB.md (the research note first).
   A crab seen from above, as the zodiac drew it, facing the top of the page: a broad domed carapace split into its regions, eyes on stalks that rise and fold,
   a mouth that is always working, two heavy claws with an opening finger, eight jointed legs in zigzags. It walks SIDEWAYS, along the page's x, the way the kit's gait
   engine already runs, with a floor of sand ripples and a tide line scrolling behind it.
   The sign is the anatomy: two curled claws, gold, worked into the shell's gastric and cardiac regions (the 6 and the 9 of ♋ laid on the carapace); the
   travelling light runs the one and then the other. The moon, a bone crescent, is held up in the right claw.
   Ink: Bone. Accent: Lapis (the eye, water). Everything else is additive and transient. */
(() => {
'use strict';
const K = window.CreatureKit, M = K.model({id:'crab', name:'Crab', sign:'♋', title:'CRAB', sub:'Cancer · the sign of the Moon, the shell that is a home',
  w:1000, h:780, pivot:[500, 420], axis:500, yawC:500, ink:K.ROSTER.bone, accent:K.ROSTER.lapis, cam:[1, 500, 392]});
const {chaikin, ringPts, clamp, fSmooth, env, pulse, keys, ramp, hash, gauss} = K, pos = v => Math.max(0, v), cl = v => Math.max(-1, Math.min(1, v));

/* ---------- frames ----------
   Everything is authored on the viewer's right (+x) relative to the shell's centre (CX, CY) and mirrored for the left. `at(s, dx, dy)` places a point for side s ('R' or 'L').
   `bpt(bone, u, v)` places a point in a bone's own frame: u along the bone from its joint, v across it (positive to the clockwise side, flipped for the left so a left part
   is the mirror of the right one). Authoring a part in its bone's frame keeps the geometry tied to the skeleton whatever numbers move. */
const CX = 500, CY = 420, SG = {R:1, L:-1}, SIDES = ['R', 'L'];
const at = (s, dx, dy) => [CX + SG[s] * dx, CY + dy];
const bone_ = n => M.bones[M.BI[n]];
const bdir = n => { const B = bone_(n); return [(B.q[0] - B.p[0]) / B.len, (B.q[1] - B.p[1]) / B.len]; };
const bpt = (n, u, v, s) => { const B = bone_(n), [dx, dy] = bdir(n), sg = SG[s]; return [B.p[0] + dx * u - dy * v * sg, B.p[1] + dy * u + dx * v * sg]; };
const bpts = (n, list, s) => list.map(([u, v]) => bpt(n, u, v, s));
/* the elbow of a two-bone leg, as the kit's IK solves it (so the authored rest pose is the solved one) */
function elbow(S, W, l1, l2, bend){ const dx = W[0] - S[0], dy = W[1] - S[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 4), a = Math.atan2(dy, dx), g = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), t = a + bend * g; return [S[0] + l1 * Math.cos(t), S[1] + l1 * Math.sin(t)]; }
const mirAng = a => Math.PI - a;

/* ---------- the skeleton ----------
   body: the root, about the shell's centre. shell: the carapace (it rocks, and scales a little to show it rising). The floor and the sand have no parent: they stay
   in the world while the body moves. Each walking leg is three IK bones (merus, carpus-and-propodus, dactyl) hung from the body; each claw is four (arm, forearm,
   palm with its fixed finger, and the dactyl that opens). */
M.bone('body', null, [CX, CY], [CX, CY - 120], {grp:'root'});
M.bone('shell', 'body', [CX, CY], [CX, CY - 120], {grp:'root', lim:[-.2, .2], speed:7});
M.bone('sand', null, [CX, 700], [CX + 1, 700], {grp:'cam', anat:false, ylim:[-60, 1000]});

/* the walking legs, on the right (legs 1 to 4, front to back): hip, wrist, the dactyl's angle, merus and carpus-propodus lengths, the elbow's side, the swing's lift
   (towards the elbow: a lifted foot is drawn in) and the dactyl's flex. The dactyl is 48 long. */
const L3 = 48;
const LEG = [
  {hip:[166, -46], wr:[304, -98], tb:-.55, l1:100, l2:96, bend:-1, lift:14, flex:-.45},
  {hip:[172, 2], wr:[322, -22], tb:-.25, l1:102, l2:98, bend:-1, lift:14, flex:-.45},
  {hip:[162, 50], wr:[314, 70], tb:.2, l1:100, l2:96, bend:1, lift:-14, flex:.45},
  {hip:[132, 94], wr:[262, 152], tb:.6, l1:92, l2:90, bend:1, lift:-14, flex:.45},
];
const LEGK = [];   // the legs in the kit's order: right 1-4, left 1-4, then the claws
for(const s of SIDES) LEG.forEach((G, n) => {
  const nn = n + 1, sg = SG[s], hip = at(s, ...G.hip), wr = at(s, ...G.wr), bend = G.bend * sg, E = elbow(hip, wr, G.l1, G.l2, bend), tb = s === 'R' ? G.tb : mirAng(G.tb), tip = [wr[0] + L3 * Math.cos(tb), wr[1] + L3 * Math.sin(tb)];
  const grp = ((n + (s === 'R' ? 0 : 1)) & 1) ? 'legsB' : 'legsA';   // the alternating tetrapods: R1 R3 L2 L4 against L1 L3 R2 R4
  M.bone('mer' + s + nn, 'body', hip, E, {grp, lim:[-1.15, 1.15], speed:9});
  M.bone('pro' + s + nn, 'mer' + s + nn, E, wr, {grp, lim:[-1.7, 1.7], speed:9});
  M.bone('dac' + s + nn, 'pro' + s + nn, wr, tip, {grp, lim:[-1.9, 1.9], speed:9});
  LEGK.push({s, n, nn, G, bend, hip, E, wr, tip, grp});
});

/* the claws (chelipeds), on the right: shoulder, wrist, the fixed finger's tip, in the folded guard (the elbow out, the finger turned to the mouth) the crab rests in */
const CLAW = {hip:[100, -100], wr:[146, -214], tip:[50, -250], l1:92, l2:72, bend:1};
for(const s of SIDES){
  const sg = SG[s], hip = at(s, ...CLAW.hip), wr = at(s, ...CLAW.wr), tip = at(s, ...CLAW.tip), E = elbow(hip, wr, CLAW.l1, CLAW.l2, CLAW.bend * sg);
  M.bone('arm' + s, 'body', hip, E, {grp:'claws', lim:[-1.4, 1.4], speed:8});
  M.bone('fore' + s, 'arm' + s, E, wr, {grp:'claws', lim:[-2.1, 2.1], speed:8});
  M.bone('palm' + s, 'fore' + s, wr, tip, {grp:'claws', lim:[-2.3, 2.3], speed:9});
  M.bone('dact' + s, 'palm' + s, bpt('palm' + s, 58, 14, s), bpt('palm' + s, 104, -3, s), {grp:'claws', lim:s === 'R' ? [-.5, 1.6] : [-1.6, .5], sec:true, speed:22});
}
/* the abdomen: the flap folded forward under the thorax (a female's, broad, since she carries the eggs under it), hinged at the rear of the sternum. A crab's is not seen from above and this one is not either: the carapace
   covers it. It is there for the anatomy view (where the carapace is faint) and answers a flexor that tucks it and an extensor that lifts it. */
M.bone('abd', 'body', [CX, CY + 108], [CX, CY - 34], {grp:'root', lim:[-.4, .4], sec:true, speed:6});
/* the eyes on their stalks (the stalk is what rises, lengthens and folds; the eye is a short bone on its end) */
for(const s of SIDES){
  M.bone('stalk' + s, 'shell', at(s, 54, -128), at(s, 68, -170), {grp:'eyes', lim:[-1.95, 1.95], sec:true, mot:true, speed:10});
  const q = bone_('stalk' + s).q, d = bdir('stalk' + s);
  M.bone('eye' + s, 'stalk' + s, q, [q[0] + d[0] * 16, q[1] + d[1] * 16], {grp:'eyes', lim:[-.8, .8], sec:true, speed:16});
}
/* the antennules (short, two-branched, they flick) and the antennae (longer than a real crab's, so they read) */
for(const s of SIDES){
  M.chain('atn' + s, [at(s, 22, -138), at(s, 30, -160), at(s, 37, -184)], 3, {parent:'shell', grp:'feel', lim:[-1.5, 1.5], speed:13, wind:false});
  M.chain('ant' + s, [at(s, 40, -134), at(s, 62, -154), at(s, 88, -170), at(s, 118, -176)], 4, {parent:'shell', grp:'feel', lim:[-1.3, 1.3], speed:8, wind:false});
}
/* the mouthparts: the third maxillipeds are two doors over the mouth, each with a palp and a beating exopod */
for(const s of SIDES){
  M.bone('mx' + s, 'shell', at(s, 4, -134), at(s, 15, -178), {grp:'mouth', lim:s === 'R' ? [-.5, 1.0] : [-1.0, .5], sec:true, speed:15});
  M.bone('mxp' + s, 'mx' + s, at(s, 15, -178), at(s, 22, -196), {grp:'mouth', lim:[-1.1, 1.1], sec:true, speed:18});
  M.bone('mf' + s, 'mx' + s, at(s, 14, -152), at(s, 30, -170), {grp:'mouth', lim:[-1.15, 1.15], sec:true, speed:20});
}
for(let k = 0; k < 6; k++) M.bone('bub' + k, 'shell', [CX + (k % 2 ? 6 : -6), CY - 180], [CX + (k % 2 ? 6 : -6), CY - 190], {grp:'mouth', anat:false, sec:true, speed:8});
M.bone('moon', 'palmR', bpt('palmR', 84, 4, 'R'), bpt('palmR', 94, 4, 'R'), {grp:'claws', anat:false, speed:8});

/* ---------- the legs on IK, in the order the gaits list them: right 1-4, left 1-4, right claw, left claw ----------
   The muscle names are the crab's: the promotor and remotor swing the leg at the thorax, the flexor and extensor of the carpopodite fold the knee, the levator and depressor of
   the dactyl tilt the foot. A leg reads its muscles from the IK's solved angles, so they bulge and crease with the pose. */
for(const L of LEGK){
  const {s, nn, G, bend} = L, fw = s === 'R', id = (b, n) => b + s + nn;
  M.leg({bones:['mer' + s + nn, 'pro' + s + nn, 'dac' + s + nn], bend, kind:'leg' + nn, side:fw ? 'F' : 'N', grp:L.grp, roll:.6, reach:26,
    mus:[fw ? [id('prom'), id('rem'), -.34, .34] : [id('rem'), id('prom'), -.34, .34], bend > 0 ? [id('flex'), id('ext'), -.9, .9] : [id('ext'), id('flex'), -.9, .9], [id('depD'), id('levD'), -.6, .6]]});
}
const CLAWMUS = s => [s === 'R' ? ['cProm' + s, 'cRem' + s, -.34, .34] : ['cRem' + s, 'cProm' + s, -.34, .34], ['cFlex' + s, 'cExt' + s, -.8, .8], ['cBend' + s, 'cStr' + s, -.6, .6]];
M.leg({bones:['armR', 'foreR', 'palmR'], bend:CLAW.bend, kind:'claw', side:'F', grp:'claws', roll:0, reach:30, mus:CLAWMUS('R')});
M.leg({bones:['armL', 'foreL', 'palmL'], bend:-CLAW.bend, kind:'claw', side:'N', grp:'claws', roll:0, reach:30, mus:CLAWMUS('L')});

/* ---------- the figure ----------
   Layers: the floor 0 and the bubbles' water; the mouthparts 2; the legs 3; the claws' arms 4; the carapace 6 and its teeth 7; the glyph 8; the antennae 8; the eyestalks 9 and eyes 10;
   the claws' palms and fingers 11; the moon 13; the sand 16. The silhouette is drawn under layer 2 and up. */
const gp = (name, bone, o = {}) => ({bind:{rigid:bone}, ...o});
/* ----- the carapace: its regions are the large cells; the nodes are shared corners, so a ridge is one line between two cells ----- */
const RN = {O0:[0, -134], O1:[34, -138], O2:[62, -132], O3:[96, -126], O4:[132, -116], O5:[166, -98], O6:[194, -68], O7:[210, -18], O8:[218, 30], O9:[204, 74], O10:[170, 110], O11:[112, 134], O12:[46, 142], O13:[0, 144],
  na:[62, -84], nb:[100, -94], nc:[70, -34], nd:[40, 2], ne:[66, 38], nf:[54, 82], ng:[146, -42], nz:[0, -92], nm:[0, 14], nr:[0, 98]};
const pr = (s, names) => names.map(n => at(s, ...RN[n]));
/* a cell symmetric about the axis: the right-hand corners in order, then the left-hand ones back, the corners on the axis once */
const sym = names => { const R = names.map(n => RN[n]), out = R.map(([x, y]) => [CX + x, CY + y]); for(let i = R.length - 1; i >= 0; i--) if(R[i][0] !== 0) out.push([CX - R[i][0], CY + R[i][1]]); return out; };
const CELLS = {
  frontal:sym(['O0', 'O1', 'O2', 'O3', 'nb', 'na', 'nz']), gastric:sym(['nz', 'na', 'nc', 'nd', 'nm']), cardiac:sym(['nm', 'nd', 'ne', 'nf', 'nr']), rear:sym(['nr', 'nf', 'O10', 'O11', 'O12', 'O13']),
  hepaticR:pr('R', ['nb', 'O3', 'O4', 'O5', 'ng', 'nc', 'na']), hepaticL:pr('L', ['nb', 'O3', 'O4', 'O5', 'ng', 'nc', 'na']),
  branchialR:pr('R', ['nc', 'ng', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10', 'nf', 'ne', 'nd']), branchialL:pr('L', ['nc', 'ng', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10', 'nf', 'ne', 'nd']),
};
{ const nms = Object.keys(CELLS), sm = K.smoothCells(nms.map(k => CELLS[k]), 2);
  nms.forEach((nm, i) => M.zone(nm, sm[i], {layer:6, tier:'L', ptier:'M', h:nm.startsWith('branchial') ? 44 : 38, tags:['shell', 'carapace'].concat(nm.endsWith('R') ? ['R'] : nm.endsWith('L') ? ['L'] : []), bind:{rigid:'shell'}, line:'region',
    tone:(x, y) => nm === 'gastric' || nm === 'cardiac' ? .1 + .05 * Math.sin(y * .05) : .05 + .1 * (1 - Math.min(1, Math.hypot(x - CX, y - CY) / 230))})); }
/* ----- the scalloped edge: the nine rounded lobes of the pie-crust margin (the anterolateral margin, from the eye to the widest point; the posterolateral margin behind it is plain); and the frontal teeth ----- */
{ const R = ['O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8'].map(n => RN[n]), P = K.catmull(R, 10), cum = [0];
  for(let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const at_ = d => { let k = 1; while(k < P.length - 1 && cum[k] < d) k++; const u = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1); return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * u, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * u, P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]]; };
  const N = 9, tot = cum[cum.length - 1]; const list = { R:[], L:[] };
  for(let i = 0; i < N; i++){ const d = tot * (i + .5) / N, [x, y, tx, ty] = at_(d), l = Math.hypot(tx, ty) || 1, nx = ty / l, ny = -tx / l, w = 18, o = 8 - 4 * Math.abs(i / (N - 1) - .45);   // an outward normal
    const poly = [[x - tx / l * w + nx * -3, y - ty / l * w + ny * -3], [x - tx / l * w * .55 + nx * (o * .8), y - ty / l * w * .55 + ny * (o * .8)], [x + nx * o, y + ny * o], [x + tx / l * w * .55 + nx * (o * .8), y + ty / l * w * .55 + ny * (o * .8)], [x + tx / l * w + nx * -3, y + ty / l * w + ny * -3]];
    list.R.push(poly.map(([a, b]) => [CX + a, CY + b])); list.L.push(poly.map(([a, b]) => [CX - a, CY + b])); }
  for(const s of SIDES) M.shapes('edgeTeeth' + s, list[s], {layer:7, tier:'F', bind:{rigid:'shell'}, tags:['shell', 'teeth', s], line:'feature', tone:.5, zone:'skin'}); }
/* the orbits (the notches the eyes rest in) and the frontal teeth */
for(const s of SIDES){
  M.zone('orbit' + s, K.ellipsePts(at(s, 70, -128), 22, 11, 14, s === 'R' ? -.28 : .28 + Math.PI).map(p => p), {layer:7, tier:'F', h:9, bind:{rigid:'shell'}, tags:['shell', 'orbit', s], line:'feature', tone:.28});
}
M.shapes('frontalTeeth', [[[-10, -131], [-3, -131], [-6.5, -142]], [[3, -131], [10, -131], [6.5, -142]], [[-30, -135], [-16, -134], [-23, -146]], [[16, -134], [30, -135], [23, -146]]].map(t => t.map(([x, y]) => [CX + x, CY + y])), {layer:7, tier:'F', bind:{rigid:'shell'}, tags:['shell', 'teeth'], line:'feature', tone:.55});

/* ----- the abdomen flap under the carapace: seven somites, broad (the female's) ----- */
{ const ys = [104, 84, 64, 44, 24, 4, -16, -34], ws = [58, 94, 108, 108, 94, 74, 48, 20];
  M.shapes('abdomen', ys.slice(0, -1).map((y, i) => [[CX - ws[i], CY + y], [CX + ws[i], CY + y], [CX + ws[i + 1], CY + ys[i + 1]], [CX - ws[i + 1], CY + ys[i + 1]]]), {layer:2, tier:'M', bind:{rigid:'abd'}, zone:'abdomen', tags:['abdomen', 'underside'], line:'dim', tone:.12}); }
/* ----- the walking legs: rigid armoured segments (merus, carpus, propodus, dactyl) with joint patches over the hinges ----- */
for(const L of LEGK){
  const {s, nn} = L, mer = 'mer' + s + nn, pro = 'pro' + s + nn, dac = 'dac' + s + nn, l1 = bone_(mer).len, l2 = bone_(pro).len, tg = ['leg', s, 'leg' + nn];
  const st = (b, list) => list.map(([u, w]) => { const p = bpt(b, u, 0, s); return [p[0], p[1], w, w]; });
  const base = {layer:3, bind:{rigid:mer}, tags:[...tg, 'merus'], line:'region', tj:.03};
  M.limb('merus' + s + nn, st(mer, [[-10, 15], [l1 * .3, 17.5], [l1 * .7, 15.5], [l1 + 6, 13]]), {...base, tier:'M', h:15});
  M.limb('carpus' + s + nn, st(pro, [[-10, 12], [12, 12.5], [32, 11]]), {...base, bind:{rigid:pro}, tags:[...tg, 'carpus'], tier:'M', h:14});
  M.limb('propodus' + s + nn, st(pro, [[30, 10.5], [l2 * .6, 9], [l2 + 6, 7.2]]), {...base, bind:{rigid:pro}, tags:[...tg, 'propodus'], tier:'F', h:13});
  M.shape('dactyl' + s + nn, bpts(dac, [[-6, 7.4], [12, 6.8], [30, 4.2], [L3 + 3, 0], [30, -4.2], [12, -6.8], [-6, -7.4]], s), {layer:3, bind:{rigid:dac}, tags:[...tg, 'dactyl', 'paw'], zone:'paws', line:'feature', tone:.8});
  M.shapes('spines' + s + nn, [24, 48, 72].map(u => bpts(mer, [[u - 6, L.G.bend * 15.5], [u + 6, L.G.bend * 15.5], [u + 1, L.G.bend * 23]], s)), {layer:3, tier:'F', bind:{rigid:mer}, tags:[...tg, 'spines'], line:'feature', tone:.7});
  M.zone('kneeA' + s + nn, ringPts(bpt(pro, 0, 0, s), 14.5, 10, 0), {layer:3, tier:'F', h:10, inset:.4, bind:{mix:[[mer, .5], [pro, .5]]}, tags:[...tg, 'joint'], line:'feature', tone:.2, host:null});
  M.zone('kneeB' + s + nn, ringPts(bpt(pro, l2, 0, s), 10, 8, 0), {layer:3, tier:'F', h:8, inset:.4, bind:{mix:[[pro, .5], [dac, .5]]}, tags:[...tg, 'joint'], line:'feature', tone:.2, host:null});
}

/* ----- the claws: arm (merus) and forearm (carpus) as rigid segments, the palm, the fixed finger and the dactyl that opens ----- */
for(const s of SIDES){
  const arm = 'arm' + s, fore = 'fore' + s, palm = 'palm' + s, dact = 'dact' + s, tg = ['claw', s];
  const st = (b, list) => list.map(([u, w]) => { const p = bpt(b, u, 0, s); return [p[0], p[1], w, w]; });
  M.limb('cArm' + s, st(arm, [[-10, 18], [28, 21], [66, 19], [98, 16]]), {layer:4, tier:'M', h:19, bind:{rigid:arm}, tags:[...tg, 'cmerus'], line:'region'});
  M.limb('cFore' + s, st(fore, [[-8, 15], [28, 16], [60, 14], [80, 12.5]]), {layer:5, tier:'M', h:18, bind:{rigid:fore}, tags:[...tg, 'ccarpus'], line:'region'});
  M.zone('cElbow' + s, ringPts(bpt(fore, 0, 0, s), 17, 10, 0), {layer:5, tier:'F', h:11, inset:.4, bind:{mix:[[arm, .5], [fore, .5]]}, tags:[...tg, 'joint'], line:'feature', tone:.2, host:null});
  M.zone('cWrist' + s, ringPts(bpt(palm, 0, 0, s), 14, 10, 0), {layer:11, tier:'F', h:10, inset:.4, bind:{mix:[[fore, .5], [palm, .5]]}, tags:[...tg, 'joint'], line:'feature', tone:.2, host:null});
  /* the two claws differ, as the edible crab's do: the CRUSHER (the right) has a heavier palm and short thick fingers with two blunt molars; the CUTTER (the left) has a slimmer palm and longer, finer fingers with a row of small sharp teeth */
  const Z = s === 'R' ? {pw:1.12, fw:1.16, fl:.93} : {pw:.92, fw:.82, fl:1.09}, cu = ([u, v]) => [u, v * Z.pw], fp = ([u, v]) => [u < 54 ? u : 54 + (u - 54) * Z.fl, v * Z.fw], fd = ([u, v]) => [u * Z.fl, v * Z.fw];
  M.zone('palm' + s, bpts(palm, [[-10, -14], [0, -27], [24, -36], [48, -34], [64, -24], [70, -10], [66, 4], [60, 14], [52, 30], [28, 39], [4, 33], [-10, 16]].map(cu), s), {layer:11, tier:'M', h:19, bind:{rigid:palm}, tags:[...tg, 'palm', 'manus'], line:'contour', tone:(x, y) => .08 + .08 * hash(Math.round(x + y * 3))});
  M.zone('pollex' + s, bpts(palm, [[54, -33], [78, -28], [98, -16], [108, -4], [111, 0], [96, 0], [80, 0], [64, -2], [58, -8]].map(fp), s), {layer:11, tier:'F', h:10, inset:.4, bind:{rigid:palm}, zone:'claws', tags:[...tg, 'finger'], line:'feature', tone:(x, y) => .45 + .45 * fSmooth(60, 110, Math.hypot(x - bone_(palm).p[0], y - bone_(palm).p[1]))});
  M.zone('dactylus' + s, bpts(dact, [[-9, 0], [-6, 12], [8, 16], [26, 13], [42, 7], [54, 1], [57, -1], [46, -3], [30, -6], [14, -7], [0, -8], [-8, -6]].map(fd), s), {layer:12, tier:'F', h:10, inset:.4, bind:{rigid:dact}, zone:'claws', tags:[...tg, 'finger', 'dactylus'], line:'feature', tone:(x, y) => .45 + .45 * fSmooth(14, 57, Math.hypot(x - bone_(dact).p[0], y - bone_(dact).p[1]))});
  const crush = s === 'R', tD = crush ? [18, 35].map(u => [[u - 9, -6], [u + 9, -6.5], [u + 6, -15.5], [u - 6, -15.5]]) : [10, 20, 30, 40, 49].map(u => [[u - 3.3, -6], [u + 3.3, -6.5], [u + .5, -13.5]]), tP = crush ? [72, 90].map(u => [[u - 9, 0], [u + 9, 0], [u + 6, 10.5], [u - 6, 10.5]]) : [64, 73, 82, 91, 100].map(u => [[u - 3.3, 0], [u + 3.3, 0], [u, 7.5]]);
  M.shapes('cTeethD' + s, tD.map(t => bpts(dact, t.map(([u, v]) => [u * Z.fl, v]), s)), {layer:12, tier:'F', bind:{rigid:dact}, zone:'claws', tags:[...tg, 'teeth'], line:'feature', tone:.95});
  M.shapes('cTeethP' + s, tP.map(t => bpts(palm, t.map(([u, v]) => [u < 54 ? u : 54 + (u - 54) * Z.fl, v]), s)), {layer:11, tier:'F', bind:{rigid:palm}, zone:'claws', tags:[...tg, 'teeth'], line:'feature', tone:.95});
}

/* ----- the growth lines on the branchial regions (arcs that echo the margin, as the edible crab's shell has) ----- */
for(const s of SIDES) for(let k = 1; k <= 2; k++){
  const pts = ['O6', 'O7', 'O8', 'O9'].map(n => [RN[n][0] + (RN.ne[0] - RN[n][0]) * .2 * k, RN[n][1] + (RN.ne[1] - RN[n][1]) * .2 * k]).map(([x, y]) => at(s, x, y));
  M.line('growth' + s + k, K.catmull(pts, 5), {layer:6, tags:['shell', s], bind:{rigid:'shell'}, host:['branchial' + s], line:{k:.4, c:.5, r:'f', t:'bone', tk:.1}});
}

/* ----- the eyes on their stalks ----- */
for(const s of SIDES){
  const sb = 'stalk' + s, eb = 'eye' + s, tg = ['eye', s];
  M.strip('stalkS' + s, [[0, 6.5], [10, 6.3], [22, 5.8], [34, 5.4], [44, 5.2]].map(([u, w]) => { const p = bpt(sb, u, 0, s); return [p[0], p[1], w]; }), {layer:9, tier:'F', bind:{rigid:sb}, tags:['stalk', s, 'skin'], line:'region', tone:.12});
  const c = bpt(eb, 6, 0, s);
  M.polar('eyeball' + s, c, [0, 5.5, 11.5], [8, 14], {layer:10, tier:'F', bind:{rigid:eb}, zone:'eyes', ink:'accent', line:'feature', tags:[...tg, 'eyeball'], tj:.02,
    tone:(x, y) => Math.hypot(x - c[0], y - c[1]) < 5.8 ? .42 : .88});
  M.shape('pupil' + s, ringPts(c, 3.6, 8, 0), {layer:11, bind:{rigid:eb}, zone:'eyes', line:'feature', tone:0, tags:[...tg, 'pupil']});
}

/* ----- the antennules (short, two-branched) and the antennae ----- */
for(const s of SIDES){
  const A = M.chains['atn' + s], B = M.chains['ant' + s];
  const along = (ch, hw0, hw1) => { const pts = ch.names.map(n => bone_(n).p).concat([bone_(ch.names[ch.names.length - 1]).q]); return pts.map(([x, y], i) => [x, y, hw0 + (hw1 - hw0) * i / (pts.length - 1)]); };
  M.strip('antulE' + s, along(A, 1.9, .6), {layer:8, tier:'F', bind:{chain:A.names, sigma:9}, zone:'feel', tags:['feeler', s], line:{k:.6, c:.95, r:'f', t:'bone', tk:.2}, tone:.6});
  M.strip('antenna' + s, along(B, 1.8, .5), {layer:8, tier:'F', bind:{chain:B.names, sigma:12}, zone:'feel', tags:['feeler', s], line:{k:.6, c:.95, r:'f', t:'bone', tk:.2}, tone:.6});
}

/* ----- the mouthparts: a dark mouth under the front margin, the two maxilliped doors, their palps and the beating exopods ----- */
M.zone('mouth', K.ellipsePts([CX, CY - 150], 24, 24, 16, 0), {layer:1, tier:'F', h:11, inset:.4, bind:{rigid:'shell'}, zone:'mouth', line:'mouth', tone:0, flush:1, tags:['mouth']});
for(const s of SIDES){
  const mx = 'mx' + s, tg = ['mouthpart', s];
  M.zone('door' + s, bpts(mx, [[-2, -4], [4, -11], [16, -14], [30, -12], [42, -6], [49, 0], [42, 6], [30, 9], [16, 11], [4, 8], [-2, 4]], s), {layer:2, tier:'F', h:10, inset:.4, bind:{rigid:mx}, zone:'mouth', line:'feature', tone:.42, tags:[...tg, 'door']});
  M.strip('palp' + s, [[0, 2.4], [8, 2.1], [16, 1.4]].map(([u, w]) => { const p = bpt('mxp' + s, u, 0, s); return [p[0], p[1], w]; }), {layer:2, tier:'F', bind:{rigid:'mxp' + s}, zone:'mouth', line:{k:.6, c:.95, r:'f', t:'bone', tk:.2}, tone:.6, tags:[...tg, 'palp']});
  M.strip('exopod' + s, [[0, 1.8], [8, 1.5], [16, 1.0], [22, .6]].map(([u, w]) => { const p = bpt('mf' + s, u, 0, s); return [p[0], p[1], w]; }), {layer:2, tier:'F', bind:{rigid:'mf' + s}, zone:'mouth', line:{k:.6, c:.95, r:'f', t:'bone', tk:.2}, tone:.6, tags:[...tg, 'exopod']});
}

/* ----- the sign: two curled claws in gold, the 6 and the 9 of ♋ laid on the shell. The light runs the left one (its ring, then its tail over the shell to the right) and then the other ----- */
const GC = [0, 6];   // the glyph's centre on the shell
const curl = (flip) => { const f = ([x, y]) => flip ? [2 * GC[0] - x, 2 * GC[1] - y] : [x, y];
  return {ring:f([-58, 14]), tail:[[-58, -10], [-44, -34], [-14, -50], [24, -50], [58, -36], [84, -14]].map(f)}; };
const GLY = {A:curl(false), B:curl(true)};
const glyHost = ['gastric', 'cardiac', 'branchialR', 'branchialL', 'hepaticR', 'hepaticL'];
for(const k of ['A', 'B']){
  const g = GLY[k], gold = {layer:8, tier:'F', ink:'gold', zone:'glyph', line:'glyph', tone:.92, tj:0, bind:{rigid:'shell'}, tags:['glyph', 'shell'], host:glyHost};
  M.polar('curlRing' + k, [CX + g.ring[0], CY + g.ring[1]], [14, 23], [14, 14], {...gold});
  const tp = K.catmull(g.tail, 5), n = tp.length;
  M.strip('curlTail' + k, tp.map(([x, y], i) => [CX + x, CY + y, 6.6 - 5 * Math.pow(i / (n - 1), 1.3)]), {...gold});
}
const glyS = (x, y, P) => {   // each glyph polygon's place on the sign's path, 0 to 1
  if(!P.tags.has('glyph')) return null;
  const k = P.name.endsWith('A') ? 0 : 1, g = GLY[k ? 'B' : 'A'], base = k * .5;
  if(P.name.startsWith('curlRing')){ const c = [CX + g.ring[0], CY + g.ring[1]], a0 = Math.atan2(g.tail[0][1] - g.ring[1], g.tail[0][0] - g.ring[0]), a = ((Math.atan2(y - c[1], x - c[0]) - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return [base + .2 * (a / (2 * Math.PI)), 1]; }
  const tp = K.catmull(g.tail, 5); let bi = 0, bd = 1e9; tp.forEach(([px, py], i) => { const d = Math.hypot(CX + px - x, CY + py - y); if(d < bd){ bd = d; bi = i; } });
  return [base + .2 + .3 * bi / (tp.length - 1), 1];
};

/* ----- the moon: a bone crescent held in the right claw, its horns up the claw's line (shown only while it is raised) ----- */
{ const Co = [44, 0], Ro = 46, Ci = [62, 0], Ri = 38.5, N = 56, ring = (C, R) => Array.from({length:N}, (_, i) => { const a = i * 2 * Math.PI / N; return [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a), a]; });
  const dist = (P, C) => Math.hypot(P[0] - C[0], P[1] - C[1]);
  const outer = ring(Co, Ro).filter(P => dist(P, Ci) > Ri), inner = ring(Ci, Ri).filter(P => dist(P, Co) < Ro);
  const order = (L, C) => { const ang = L.map(P => Math.atan2(P[1] - C[1], P[0] - C[0])); let k0 = 0; // start after the gap: the point whose predecessor is far
    for(let i = 0; i < L.length; i++){ const q = L[(i + L.length - 1) % L.length], d = Math.hypot(L[i][0] - q[0], L[i][1] - q[1]); if(d > 2 * Math.PI * (C === Co ? Ro : Ri) / N * 1.5){ k0 = i; break; } } return L.slice(k0).concat(L.slice(0, k0)); };
  const o = order(outer, Co), n = order(inner, Ci).reverse(), poly = o.concat(n).map(([u, v]) => bpt('moon', u, v, 'R'));
  M.zone('moon', poly, {layer:10, tier:'F', h:9, inset:.45, bind:{rigid:'moon'}, show:'moonShow', zone:'moon', line:'feature', tone:.9, tj:.03, tags:['moon']});
}

/* ----- bubbles: six rings that drift up from the mouth, each shown by its own muscle ----- */
for(let k = 0; k < 6; k++) M.polar('bubble' + k, [CX + (k % 2 ? 6 : -6), CY - 184], [3.4, 6], [8, 8], {layer:12, tier:'F', bind:{rigid:'bub' + k}, show:'bubble' + k, zone:'bubbles', line:'feature', tone:.7, tags:['bubble']});

/* ----- the ground is not drawn here: creature-ground.js draws it (world sand, prints, shadows, the heap over a buried crab) from the hooks below. The `sand` bone stays as a channel: the postures' edges slide it ('s:sand.y') and the burial reads it. ----- */


/* ---------- muscles ----------
   Real names. The walking legs and claws read theirs from the IK's solved angles (each joint has an agonist and an antagonist), so they bulge and crease with the pose; the rest
   turn joints or slide parts when they are driven. Pairs: LR mirrors across the shell's axis (rotations mirror too); a muscle with a side in its id (prom R1) is one leg's. */
const cr = (cx, cy, rx, ry, ang, f, amp = .5, lo = .78, hi = .95) => K.crease(cx, cy, rx, ry, ang, f, amp, lo, hi), soft = K.glow, both = K.both;
const bang = n => { const d = bdir(n); return Math.atan2(d[1], d[0]); };
for(const L of LEGK){
  const {s, nn, bend} = L, mer = 'mer' + s + nn, pro = 'pro' + s + nn, dac = 'dac' + s + nn, g = 'leg ' + nn + (s === 'R' ? ' right' : ' left'), fw = s === 'R' ? 1 : -1, on = ['leg' + nn];
  const hc = bpt(mer, 18, 0, s), ec = bone_(pro).p, wc = bone_(dac).p, mid2 = bpt(pro, bone_(pro).len * .6, 0, s);
  const m = (id, name, c, r, hue, jt, shade, speed = 11) => M.muscle(id + s + nn, {name, g, c, r, hue, speed, on, jt, shade, host:jt[0][0]});
  m('prom', 'promotor of the leg ' + nn + ' (swings it forward)', hc, [20, 20], '#7ec3e6', [[mer, -.5 * fw, 'r']], soft(hc[0], hc[1], 16, 16, .45));
  m('rem', 'remotor of the leg ' + nn + ' (swings it back)', hc, [20, 20], '#e3806f', [[mer, .5 * fw, 'r']], soft(hc[0], hc[1], 16, 16, .45));
  m('flex', 'flexor of the carpopodite ' + nn + ' (folds the knee)', ec, [22, 22], '#d8c89a', [[pro, -bend * .75, 'r']], both(cr(ec[0], ec[1], 16, 16, bang(pro) + .6, .2, .6), soft(ec[0], ec[1], 16, 16, .5)));
  m('ext', 'extensor of the carpopodite ' + nn + ' (straightens the knee)', mid2, [24, 24], '#9aa6d8', [[pro, bend * .75, 'r']], both(cr(mid2[0], mid2[1], 16, 16, bang(pro), .2, .5), soft(mid2[0], mid2[1], 14, 14, .35)));
  m('depD', 'depressor of the dactyl ' + nn, wc, [14, 14], '#c9a0dc', [[dac, .5, 'r']], soft(wc[0], wc[1], 10, 10, .45));
  m('levD', 'levator of the dactyl ' + nn, wc, [14, 14], '#5cc6b4', [[dac, -.5, 'r']], soft(wc[0], wc[1], 10, 10, .45));
}
for(const s of SIDES){
  const arm = 'arm' + s, fore = 'fore' + s, palm = 'palm' + s, g = 'claw ' + (s === 'R' ? 'right' : 'left'), fw = SG[s], on = ['claw'], ac = bpt(arm, 24, 0, s), ec = bone_(fore).p, wc = bone_(palm).p;
  const m = (id, name, c, r, hue, jt, shade) => M.muscle(id + s, {name, g, c, r, hue, speed:10, on, jt, shade, host:jt[0][0]});
  m('cProm', 'promotor of the cheliped (swings the arm forward)', ac, [24, 24], '#7ec3e6', [[arm, -.5 * fw, 'r']], soft(ac[0], ac[1], 20, 20, .4));
  m('cRem', 'remotor of the cheliped (swings the arm back)', ac, [24, 24], '#e3806f', [[arm, .5 * fw, 'r']], soft(ac[0], ac[1], 20, 20, .4));
  m('cFlex', 'flexor of the carpopodite (folds the elbow)', ec, [26, 26], '#d8c89a', [[fore, -CLAW.bend * fw * .7, 'r']], both(cr(ec[0], ec[1], 18, 18, bang(fore) + .6, .18, .6), soft(ec[0], ec[1], 18, 18, .5)));
  m('cExt', 'extensor of the carpopodite (opens the elbow)', ec, [26, 26], '#9aa6d8', [[fore, CLAW.bend * fw * .7, 'r']], soft(ec[0], ec[1], 18, 18, .35));
  m('cBend', 'bender of the propodite (turns the palm in)', wc, [20, 20], '#c9a0dc', [[palm, .5 * fw, 'r']], soft(wc[0], wc[1], 14, 14, .4));
  m('cStr', 'stretcher of the propodite (turns the palm out)', wc, [20, 20], '#5cc6b4', [[palm, -.5 * fw, 'r']], soft(wc[0], wc[1], 14, 14, .4));
}
/* the pincer: the closer fills the palm and is strong, the opener is small and slow */
{ const pc = bpt('palmR', 34, 4, 'R'), dc = bpt('dactR', 24, 0, 'R');
  M.muscle('closer', {name:'closer of the dactyl (adductor, fills the palm)', g:'claw fingers', pair:'LR', c:pc, r:[34, 34], hue:'#e0523f', speed:36, on:['claw'], jt:[['dact$', -.28, 'r']], host:'palm$', shade:both(cr(pc[0], pc[1], 30, 30, bang('palmR') + 1.2, .17, .7), soft(pc[0], pc[1], 30, 30, .55)), dir:[-1, 0]});
  M.muscle('opener', {name:'opener of the dactyl (abductor)', g:'claw fingers', pair:'LR', c:dc, r:[20, 20], hue:'#7ec3e6', speed:20, on:['claw'], jt:[['dact$', 1.05, 'r']], host:'dact$', shade:soft(dc[0], dc[1], 16, 16, .4)}); }
/* the eyes: the stalk is raised and lengthened (the scale is applied in `post`), folded into its orbit, swung out and in; the pupil moves within the eye */
{ const sc = bpt('stalkR', 22, 0, 'R'), ec = bpt('eyeR', 6, 0, 'R');
  M.muscle('eyeUp', {name:'levator of the eyestalk (raises it)', g:'eyes', pair:'LR', c:sc, r:[12, 28], hue:'#7ec3e6', speed:9, on:['stalk'], host:'stalk$', shade:soft(sc[0], sc[1], 10, 24, .5), dir:[0, -1]});
  M.muscle('eyeFold', {name:'retractor of the eyestalk (folds it into the orbit)', g:'eyes', pair:'LR', c:sc, r:[14, 26], hue:'#e3806f', speed:9, on:['stalk'], jt:[['stalk$', 1.3, 'r']], host:'stalk$', shade:soft(sc[0], sc[1], 12, 22, .5), dir:[1, 0]});
  M.muscle('eyeOut', {name:'abductor of the eyestalk (swings it out)', g:'eyes', pair:'LR', c:sc, r:[14, 26], hue:'#d8c89a', speed:10, on:['stalk'], jt:[['stalk$', .32, 'r']], host:'stalk$', dir:[1, 0]});
  M.muscle('eyeIn', {name:'adductor of the eyestalk (swings it in)', g:'eyes', pair:'LR', c:sc, r:[14, 26], hue:'#9aa6d8', speed:10, on:['stalk'], jt:[['stalk$', -.32, 'r']], host:'stalk$', dir:[-1, 0]});
  for(const [id, nm, v] of [['lookR', 'gaze right', [3.4, 0]], ['lookL', 'gaze left', [-3.4, 0]], ['lookU', 'gaze up', [0, -3]], ['lookD', 'gaze down', [0, 3]]])
    M.muscle(id, {name:nm + ' (the pseudopupil)', g:'gaze', pair:'LR', c:ec, r:[9, 9], v, vm:0, hue:'#7ec3e6', speed:16, on:['pupil'], host:'eye$'}); }
/* the feelers: the antennules flick, the antennae sweep and curl */
{ const ac = bpt('atnR0', 22, 0, 'R'), nc = bpt('antR1', 10, 0, 'R'), ch = (pre, n, g) => g.map((v, i) => [pre + '$' + i, v, 'r']);
  M.muscle('atnFlick', {name:'flexor of the antennule (the flick)', g:'feelers', pair:'LR', c:ac, r:[14, 30], hue:'#d985a6', speed:22, on:['feeler'], jt:ch('atn', 3, [-.5, -.75, -.8]), host:'atn$0', dir:[-1, 0]});
  M.muscle('atnLift', {name:'extensor of the antennule (the return)', g:'feelers', pair:'LR', c:ac, r:[14, 30], hue:'#9aa6d8', speed:8, on:['feeler'], jt:ch('atn', 3, [.3, .45, .5]), host:'atn$0', dir:[1, 0]});
  M.muscle('antOut', {name:'abductor of the antenna (sweeps it out)', g:'feelers', pair:'LR', c:nc, r:[18, 30], hue:'#d8c89a', speed:7, on:['feeler'], jt:ch('ant', 4, [.28, .3, .26, .22]), host:'ant$0', dir:[1, 0]});
  M.muscle('antIn', {name:'adductor of the antenna (sweeps it in)', g:'feelers', pair:'LR', c:nc, r:[18, 30], hue:'#8fb0a0', speed:7, on:['feeler'], jt:ch('ant', 4, [-.28, -.3, -.26, -.22]), host:'ant$0', dir:[-1, 0]});
  M.muscle('antCurl', {name:'flexor of the antenna (curls it)', g:'feelers', pair:'LR', c:nc, r:[18, 30], hue:'#c9a0dc', speed:6, on:['feeler'], jt:ch('ant', 4, [.05, .18, .3, .42]), host:'ant$0', dir:[1, 0]}); }
/* the mouthparts: the maxilliped doors open and close, their palps sweep, the exopods beat; the gill bailer (scaphognathite) pumps behind the front corners of the shell */
{ const dc = bpt('mxR', 24, 0, 'R'), pc = bpt('mxpR', 8, 0, 'R'), fc = bpt('mfR', 10, 0, 'R');
  M.muscle('mxOpen', {name:'abductor of the third maxilliped (opens the door)', g:'mouth', pair:'LR', c:dc, r:[16, 28], hue:'#e3806f', speed:12, on:['mouthpart'], jt:[['mx$', .72, 'r']], host:'mx$', shade:soft(dc[0], dc[1], 12, 24, .45), dir:[1, 0]});
  M.muscle('mxClose', {name:'adductor of the third maxilliped (shuts it)', g:'mouth', pair:'LR', c:dc, r:[16, 28], hue:'#9aa6d8', speed:12, on:['mouthpart'], jt:[['mx$', -.32, 'r']], host:'mx$', dir:[-1, 0]});
  M.muscle('palpOut', {name:'palp of the maxilliped (sweeps out)', g:'mouth', pair:'LR', c:pc, r:[10, 14], hue:'#d8c89a', speed:20, on:['mouthpart'], jt:[['mxp$', .75, 'r']], host:'mxp$', dir:[1, 0]});
  M.muscle('palpIn', {name:'palp of the maxilliped (sweeps in)', g:'mouth', pair:'LR', c:pc, r:[10, 14], hue:'#8fb0a0', speed:20, on:['mouthpart'], jt:[['mxp$', -.75, 'r']], host:'mxp$', dir:[-1, 0]});
  M.muscle('exoBeat', {name:'exopod of the maxilliped (the beating flagellum)', g:'mouth', pair:'LR', c:fc, r:[10, 14], hue:'#c9a0dc', speed:22, on:['mouthpart'], jt:[['mf$', .85, 'r']], host:'mf$', dir:[1, 0]});
  M.muscle('exoBack', {name:'exopod of the maxilliped (the recovery)', g:'mouth', pair:'LR', c:fc, r:[10, 14], hue:'#5cc6b4', speed:22, on:['mouthpart'], jt:[['mf$', -.85, 'r']], host:'mf$', dir:[-1, 0]});
  M.muscle('scaph', {name:'scaphognathite (the gill bailer: the breath)', g:'shell', pair:'LR', c:at('R', 150, -56), r:[56, 52], v:[1.5, -.4], hue:'#8fd0a8', speed:7, on:['carapace'], host:'shell', dir:[1, 0], shade:both(soft(at('R', 150, -56)[0], at('R', 150, -56)[1], 50, 46, .26), cr(at('R', 150, -56)[0], at('R', 150, -56)[1], 50, 46, 0, .1, .35))}); }
/* the abdomen: tucked tight under the thorax, lifted a little to ventilate or to shed sand */
M.muscle('abdFlex', {name:'flexor of the abdomen (tucks the flap under the thorax)', g:'abdomen', c:[CX, CY + 30], r:[60, 80], hue:'#d8c89a', speed:6, on:['abdomen'], jt:[['abd', -.3, 'r']], host:'abd', dir:[0, -1]});
M.muscle('abdExt', {name:'extensor of the abdomen (lifts the flap)', g:'abdomen', c:[CX, CY - 10], r:[60, 80], hue:'#9aa6d8', speed:6, on:['abdomen'], jt:[['abd', .3, 'r']], host:'abd', dir:[0, 1]});
/* the shell: it rises and sinks (its size shows it, since it is seen from above), rocks to either side, and the carapace's muscle attachments show as crease light */
M.muscle('rise', {name:'levator of the carapace (stands the crab up on its legs)', g:'shell', c:[CX, CY - 10], r:[150, 110], hue:'#7ec3e6', speed:5, on:['carapace'], host:'shell', dir:[0, -1], shade:soft(CX, CY - 10, 120, 90, .22)});
M.muscle('sink', {name:'depressor of the carapace (lowers it)', g:'shell', c:[CX, CY - 10], r:[150, 110], hue:'#d8c89a', speed:5, on:['carapace'], host:'shell', dir:[0, 1]});
M.muscle('rockR', {name:'lateral rocker (leans the shell to the right)', g:'shell', c:[CX + 90, CY], r:[100, 120], hue:'#d8c89a', speed:7, on:['carapace'], jt:[['shell', .09, 'r']], host:'shell', dir:[1, 0]});
M.muscle('rockL', {name:'lateral rocker (leans the shell to the left)', g:'shell', c:[CX - 90, CY], r:[100, 120], hue:'#d8c89a', speed:7, on:['carapace'], jt:[['shell', -.09, 'r']], host:'shell', dir:[-1, 0]});
M.muscle('gastric', {name:'gastric mill (the grinding stomach: a pulse under the gastric region)', g:'shell', c:[CX, CY - 40], r:[46, 44], hue:'#e0b060', speed:6, on:['carapace'], host:'shell', shade:both(soft(CX, CY - 40, 44, 40, .3), cr(CX, CY - 40, 40, 36, .6, .12, .4))});
M.muscle('moonShow', {name:'the moon (held up)', g:'display', c:bpt('palmR', 80, 4, 'R'), r:[40, 40], hue:'#bfd0e8', speed:6, on:['moon'], host:'palmR', dir:[0, -1]});
for(let k = 0; k < 6; k++) M.muscle('bubble' + k, {name:'bubble ' + (k + 1) + ' (froth at the mouth)', g:'display', c:[CX + 14 * Math.cos(k * 1.05), CY - 168 + 8 * Math.sin(k * 1.05)], r:[10, 10], hue:'#7ec3e6', speed:14, on:['bubble'], host:'shell', dir:[0, -1]});

/* ---------- postures ----------
   Seen from above, "standing up" is the shell nearer the eye (a little larger) and the legs' knees raised (the feet drawn in), "low" the reverse. Each posture names the
   feet of all ten limbs (the eight legs and the two claws) and the sand's slide (the sand is hidden below the view in every posture but the dug-in one). A foot is placed by
   its leg's reach (a share of the rest stride's span from the hip) and its swing about the hip; a claw by its wrist and the palm's direction. */
const PIV = [CX, CY], SAND_OFF = 900;
const FOOTB = LEGK.map(L => 'dac' + L.s + L.nn).concat(['palmR', 'palmL']);
const a0 = k => { const B = bone_(FOOTB[k]); return Math.atan2(B.q[1] - B.p[1], B.q[0] - B.p[0]); };   // the default angle the kit gives a foot (the bone's)
const wrapTo = (a, ref) => ref + K.wrapA(a - ref);
const rotP = (p, th) => { const c = Math.cos(th), s = Math.sin(th); return [PIV[0] + c * (p[0] - PIV[0]) - s * (p[1] - PIV[1]), PIV[1] + s * (p[0] - PIV[0]) + c * (p[1] - PIV[1])]; };
const CL3 = bone_('palmR').len;
function legFoot(k, o = {}){   // a walking leg's foot, in the right-hand frame then mirrored: r the reach, sw the swing about the hip, dx and dy a shift, tb a turn of the dactyl
  const L = LEGK[k], G = L.G, r = o.r ?? 1, sw = o.sw ?? 0, hip = G.hip, v = [(G.wr[0] - hip[0]) * r, (G.wr[1] - hip[1]) * r], c = Math.cos(sw), s = Math.sin(sw);
  const w = [hip[0] + c * v[0] - s * v[1], hip[1] + s * v[0] + c * v[1]], tb = G.tb + sw * .6 + (o.tb || 0), tip = [w[0] + L3 * Math.cos(tb) + (o.dx || 0), w[1] + L3 * Math.sin(tb) + (o.dy || 0)];
  return [L.s === 'R' ? CX + tip[0] : CX - tip[0], CY + tip[1], wrapTo(L.s === 'R' ? tb : mirAng(tb), a0(k))];
}
const clawXY = (s, tip, b) => [s === 'R' ? CX + tip[0] : CX - tip[0], CY + tip[1], s === 'R' ? b : mirAng(b)];
function clawFoot(s, wr, b){ return clawXY(s, [wr[0] + CL3 * Math.cos(b), wr[1] + CL3 * Math.sin(b)], b); }
/* a posture: reach r and swing sw per leg (1 to 4), the claws' wrists and palm directions (in the right one's frame; none is the guard), dy a shift of everything (the crab
   backing), turn a rotation about the shell's centre, sand the sand's slide */
function mk(o = {}){
  const R = o.r || [1, 1, 1, 1], SW = o.sw || [0, 0, 0, 0], th = o.turn || 0, dy = o.dy || 0, feet = [];
  for(let k = 0; k < 8; k++) feet.push(legFoot(k, {r:R[LEGK[k].n], sw:SW[LEGK[k].n]}));
  SIDES.forEach((s, i) => { const c = o.claw && (o.claw[s] || o.claw.both), B = bone_('palm' + s), f = c ? clawFoot(s, c[0], c[1]) : [B.q[0], B.q[1], a0(8 + i)]; feet.push([f[0], f[1], wrapTo(f[2], a0(8 + i))]); });
  return {root:th ? M.rootV(PIV, th, 0, dy) : [0, dy, 0], slide:{sand:[0, o.sand ?? SAND_OFF]}, jt:o.jt, cam:o.cam || [1, 500, 392],
    feet:feet.map(f => { if(th){ const q = rotP([f[0], f[1]], th); return [q[0], q[1], f[2] + th]; } return [f[0], f[1] + dy, f[2]]; })};
}
M.posture('rest', mk());
M.posture('raised', mk({r:[.82, .8, .8, .82], sw:[-.05, -.02, .02, .05], claw:{both:[[118, -198], -1.72]}}));
M.posture('threat', mk({r:[.9, .88, .88, .9], sw:[-.14, -.06, .07, .14], claw:{both:[[190, -192], -1.1]}}));
M.posture('tucked', mk({r:[.54, .52, .52, .55], sw:[.26, .13, -.1, -.22], claw:{both:[[88, -170], -2.9]}}));
M.posture('dug-in', mk({r:[.92, .8, .62, .56], sw:[-.06, 0, .12, .22], claw:{both:[[124, -204], -2.25]}, dy:62, sand:0, cam:[1, 500, 404]}));
M.posture('turn-left', mk({turn:-.5}));
M.posture('turn-right', mk({turn:.5}));
/* an edge's lifts: while a leg's foot moves it is lifted (drawn toward its knee) by a hump on its y channel */
const liftB = (list, d0, len, amt = 12) => list.map(k => ['f' + k + 'y', d0, len, (LEGK[k].G.lift > 0 ? -1 : 1) * amt]);
const A_ = [0, 2, 5, 7], B_ = [1, 3, 4, 6];   // the legs of the two tetrapods (R1 R3 L2 L4 and R2 R4 L1 L3)
const stepBumps = (t0, len, gap, amt) => liftB(A_, t0, len, amt).concat(liftB(B_, t0 + gap, len, amt));
M.edge('rest>raised', {ms:2100, g:{root:[0, 1500], legsA:[0, 1400], legsB:[350, 1400], claws:[250, 1500], cam:[0, 1900]}, bumps:stepBumps(0, 900, 350, 10)});
M.edge('rest>threat', {ms:1700, g:{root:[0, 1100], legsA:[0, 1000], legsB:[200, 1000], claws:[0, 1200], cam:[0, 1500]}, bumps:stepBumps(0, 650, 200, 10)});
M.edge('raised>threat', {ms:1400, g:{root:[0, 900], legsA:[0, 900], legsB:[150, 900], claws:[0, 1000], cam:[0, 1200]}, bumps:stepBumps(0, 600, 150, 8)});
M.edge('rest>tucked', {ms:1900, g:{claws:[0, 1000], legsA:[200, 1200], legsB:[450, 1200], root:[300, 1400], cam:[0, 1700]}, bumps:stepBumps(200, 800, 250, 12)});
M.edge('rest>dug-in', {ms:3400, g:{legsA:[0, 1500], legsB:[500, 1500], root:[200, 2100], claws:[1400, 1500], cam:[0, 3000]}, c:{'s:sand.y':[900, 2400]}, bumps:stepBumps(0, 900, 500, 10)});
M.edge('tucked>dug-in', {ms:2600, g:{legsA:[0, 1300], legsB:[300, 1300], root:[0, 1700], claws:[1000, 1400], cam:[0, 2400]}, c:{'s:sand.y':[500, 2000]}});
M.edge('rest>turn-left', {ms:3000, g:{root:[200, 2500], claws:[0, 2200], legsA:[0, 2700], legsB:[0, 2700], cam:[0, 2800]}, c:turnC()});
M.edge('rest>turn-right', {ms:3000, g:{root:[200, 2500], claws:[0, 2200], legsA:[0, 2700], legsB:[0, 2700], cam:[0, 2800]}, c:turnC()});
/* a turn on the spot: the body rotates steadily, and each foot steps once, alternately, so that the feet are never far from where the turned body wants them */
function turnC(){ const c = {}; for(let k = 0; k < 8; k++){ const d = [0, 560, 1120, 1680][k & 3] + (LEGK[k].grp === 'legsB' ? 280 : 0); c['f' + k + 'x'] = [d, 900]; c['f' + k + 'y'] = [d, 900]; c['f' + k + 'b'] = [d, 900]; } return c; }

/* ---------- gaits: one engine on a blend line ----------
   The crab walks along the page's x (sideways for it): every foot strides along x, so the right-hand legs lead (their stance pulls the foot in toward the body: they flex) and the
   left-hand ones trail (their stance pushes it out: they extend), as the literature has it. The two tetrapods alternate: R1 R3 L2 L4 against L1 L3 R2 R4 (a half cycle apart), and
   inside a tetrapod the legs land front to back a few hundredths of a cycle apart (a larger `off` lands EARLIER). Arrays are in the order right 1-4, left 1-4, then the two claws (which
   ride the engine with no stride of their own: `idle` holds them on their posture's place). Lift is toward the knee; the dactyl tilts with it. */
const LIFT = [14, 14, -14, -14, 14, 14, -14, -14, 0, 0], FLEX = [-.45, -.45, .45, .45, .45, .45, -.45, -.45, 0, 0], ZERO = new Array(10).fill(0);
const OFFW = [.06, .53, 0, .47, .56, .03, .5, -.03, 0, 0], OFFS = [.02, .52, 0, .5, .52, .02, .5, 0, 0, 0];   // R1 R2 R3 R4 L1 L2 L3 L4: A = R1 R3 L2 L4 near 0, B = R2 R4 L1 L3 near .5
M.gait('walk', {psi:1, base:'rest', label:'Walk right', L:80, cyc:520, duty:.62, lift:LIFT, off:OFFW, flex:FLEX, hs:ZERO, bob:2.2, sink:0, cap:1.8, lead:0});
M.gait('scuttle', {psi:2, base:'rest', label:'Scuttle right', L:100, cyc:420, duty:.52, lift:LIFT.map(v => v * 1.15), off:OFFS, flex:FLEX.map(v => v * 1.2), hs:ZERO, bob:3.4, sink:0, cap:1.6, lead:0});
/* The shuffle: the same stepping with no stride (L 0), so the crab marches on the spot. It is the gait the turns use: the ground turns about the crab (`groundStep`) and each planted foot stays on its point of
   the world, so the feet step round. By itself it turns nothing: the turn comes from the Turn actions or the Steer pad, so the kit's probe measures its feet like any other gait's. */
M.gait('spin', {psi:0, base:'rest', label:'Shuffle', L:0, cyc:620, duty:.62, lift:LIFT, off:OFFW, flex:FLEX, hs:ZERO, bob:1.2, sink:0, cap:1.8, lead:0});
/* The kit's gait engine strides toward +x only (a negative stride makes every foot lift the moment it lands). The crab is mirror-symmetric, so a walk to the left is the same walk seen in a
   mirror: `walkL` and `scuttleL` are the same two gaits, run on the engine unchanged, and the figure's whole rig is drawn mirrored about the shell's axis while one of them runs (`setMirror`
   below). Nothing in the kit sees the mirror, so every gate measures the real stance feet. The mirror is only ever switched at a standstill, with the crab squared up (see `crabGo`). Kit request 2. */
for(const [n, g] of [['walkL', 'walk'], ['scuttleL', 'scuttle']]) M.gait(n, {...M.gaits[g], psi:-M.gaits[g].psi, label:g === 'walk' ? 'Walk left' : 'Scuttle left'});

/* ---------- actions ----------
   Each adds to the muscle targets and the pose channels for its own clock. With no `in` an action is a layer (any posture); with `in` it needs those postures. A claw is led by its
   foot (the palm's tip) along a path blended from where the posture has it, so nothing starts from a reset. */
const KS = (t, kk) => keys(t, kk), sinc = (t, f, ph = 0) => Math.sin(t * f + ph), mid = v => [v, v];
const sd = (s, v) => s === 'R' ? [0, v] : [v, 0];          // a pair's value for one side: the kit's pairs are [L, R]
const CK = {R:8, L:9}, other = s => s === 'R' ? 'L' : 'R';
const GUARD_TIP = [50, -250];
/* lead claw s along targets [tip, palm direction, weight] in its own right-hand frame: pos = foot + w1 (T1 - foot) + w2 (T2 - T1) ... */
function clawGo(c, s, targets, o = {}){
  const k = CK[s], fp = c.foot(k); let x = fp[0], y = fp[1], b = fp[2], cur = fp;
  for(const [tip, bb, u] of targets){ const T = clawXY(s, tip, bb), tb = cur[2] + K.wrapA(T[2] - cur[2]); x += (T[0] - cur[0]) * u; y += (T[1] - cur[1]) * u; b += (tb - cur[2]) * u; cur = [T[0], T[1], tb]; }
  c.legReq(k, x, y, b + crab(c).cd[s], {kk:o.kk ?? 12});
}
const eyeSd = (s, v) => sd(s, v);
const avail = c => { const w = c.postureW(); return clamp(1 - .75 * w.threat - .2 * w['dug-in'] - .15 * w.raised, .2, 1); };   // how much of the fingers' opening a posture leaves free (the threat holds them wide)
M.action('clawWave', {label:'Claw wave', group:'Display', dur:7400, in:['rest', 'raised'], f:(t, T, c, a) => {
  /* the fiddler's display: the claw is flexed in, then swung out and up and brought back, in a run of four waves, one claw only; the shell leans away from it, the eye on that side rises to watch */
  const s = a.s ?? (a.s = c.rand() < .5 ? 'R' : 'L'), o = other(s), e = env(t, 900, 5000, 1000), n = clamp((t - 800) / 1200, 0, 4), p = n - Math.floor(n), live = n > 0 && n < 4;   // whole waves only, so the claw is at rest between them and at the end
  const w = live ? KS(p, [[0, 0], [.34, 1], [.54, 1], [1, 0]]) * e : 0, hold = e;
  clawGo(c, s, [[[214, -266], -1.38, w]]); clawGo(c, o, [[[84, -262], -2.35, .22 * w]]);
  const op = KS(p, [[0, 0], [.2, 0], [.36, 1], [.52, 1], [.7, 0], [1, 0]]) * (live ? e : 0);
  c.spec(T, {opener:sd(s, .85 * op * avail(c)), closer:sd(s, .25 * (1 - op) * hold), eyeUp:sd(s, .5 * hold), lookR:mid(s === 'R' ? .5 * hold : 0), lookL:mid(s === 'L' ? .5 * hold : 0), antOut:sd(s, .3 * hold)});
  c.jt('shell', (s === 'R' ? -1 : 1) * .028 * w); c.rootAbout(PIV, 0, (s === 'R' ? -4 : 4) * w, -2 * w);
}});
const MOUTH = [16, -170], REACH = [66, -310];
M.action('feed', {label:'Feed', group:'Mouth', dur:11200, in:['rest', 'raised', 'dug-in'], f:(t, T, c, a) => {
  /* the claws pick in turn and carry to the mouth: reach out and open, close on the morsel, bring it to the doors, hold while the mouthparts take it, back to the guard; four picks */
  const e = env(t, 700, 9400, 900), q = t - 900, i = Math.floor(q / 2500), p = q - i * 2500, on = q >= 0 && i < 4, s0 = a.s0 ?? (a.s0 = c.rand() < .5 ? 'R' : 'L'), s = i % 2 ? other(s0) : s0, o = other(s);
  const Ur = on ? KS(p, [[0, 0], [520, 1], [1900, 1], [2500, 0]]) : 0, Um = on ? KS(p, [[0, 0], [880, 0], [1500, 1], [1900, 1], [2500, 0]]) : 0;
  if(on) clawGo(c, s, [[REACH, -1.9, Ur], [MOUTH, 2.5, Um]]);
  const op = on ? KS(p, [[0, 0], [160, .95], [500, .95], [660, 0]]) : 0, hold = on ? KS(p, [[0, 0], [700, 0], [1100, .6], [2000, .6], [2400, 0]]) : 0;
  const door = on ? KS(p, [[0, 0], [900, 0], [1300, .85], [1800, .85], [2200, 0]]) : 0, work = e * (.35 + .65 * (on ? KS(p, [[0, 0], [900, 0], [1300, 1], [2000, 1], [2400, .2]]) : 0));
  c.spec(T, {opener:sd(s, .95 * op * avail(c)), closer:sd(s, .7 * hold), mxOpen:mid(.85 * door), palpOut:mid(pos(sinc(t, .021)) * work), palpIn:mid(pos(-sinc(t, .021)) * work), exoBeat:mid(pos(sinc(t, .03, 1)) * work), exoBack:mid(pos(-sinc(t, .03, 1)) * work), gastric:.6 * work, atnFlick:mid(.5 * pos(sinc(t, .0095)) * e)});
  c.flushT = Math.max(c.flushT, .7 * door); c.jt('shell', (s === 'R' ? -1 : 1) * .02 * Math.max(Ur, Um)); c.rootAbout(PIV, 0, 0, -3 * Um);
  c.spec(T, {lookD:mid(.6 * e)});
}});
M.action('groomEye', {label:'Groom an eye', group:'Mouth', dur:6200, in:['rest', 'raised', 'dug-in'], f:(t, T, c, a) => {
  /* the stalk is lifted to the mouthparts, which wipe it (the doors open, the palps sweep, the exopods beat), and put back */
  const s = a.s ?? (a.s = c.rand() < .5 ? 'R' : 'L'), o = other(s), e = KS(t, [[0, 0], [900, 1], [5100, 1], [6000, 0]]), wipe = e * env(t - 1300, 300, 2800, 400), st = crab(c);
  st.groom[s] = e; c.jt('stalk' + s, (s === 'R' ? -1 : 1) * -1.38 * e); c.jd('stalk' + s, (s === 'R' ? -1 : 1) * .1 * wipe * sinc(t, .0105));
  c.spec(T, {eyeFold:eyeSd(o, .35 * e), mxOpen:mid(.9 * wipe), palpOut:mid(pos(sinc(t, .0105 + .0, 1.6)) * wipe), palpIn:mid(pos(-sinc(t, .0105, 1.6)) * wipe), exoBeat:mid(pos(sinc(t, .018)) * wipe), exoBack:mid(pos(-sinc(t, .018)) * wipe), eyeUp:eyeSd(s, e), gastric:.4 * e});
  c.flushT = Math.max(c.flushT, .4 * wipe);
}});
M.action('snap', {label:'Snap a claw', group:'Display', dur:3400, f:(t, T, c, a) => {
  /* the opener is small and slow, the closer huge: the claw opens over a third of a second and shuts in a few frames, twice; the arm kicks forward with the shut */
  const s = a.s ?? (a.s = c.rand() < .5 ? 'R' : 'L'), op = KS(t, [[0, 0], [380, 1], [900, 1], [960, 0], [1500, 0], [1850, 1], [2250, 1], [2310, 0], [3000, 0]]), kick = pulse(t, 940, 40, 20, 260) + .8 * pulse(t, 2290, 40, 20, 260);
  c.spec(T, {opener:sd(s, op * avail(c)), closer:sd(s, 1.5 * (pulse(t, 940, 30, 50, 200) + pulse(t, 2290, 30, 50, 200))), antIn:mid(.4 * kick), eyeFold:mid(.35 * kick)});
  clawGo(c, s, [[[GUARD_TIP[0] + 22, GUARD_TIP[1] - 30], -2.55, .45 * Math.max(op * .5, kick)]]); c.jt('shell', (s === 'R' ? -1 : 1) * .014 * kick); c.flushT = Math.max(c.flushT, .25 * kick);
}});
M.action('bubble', {label:'Bubble', group:'Mouth', dur:4600, f:(t, T, c, a) => {
  /* froth: the mouthparts blow rings that drift forward and up from the mouth, each shown for its own second and a half */
  const st = crab(c), e = env(t, 400, 2900, 800);
  c.spec(T, {mxOpen:mid(.55 * e), palpOut:mid(pos(sinc(t, .016)) * e), palpIn:mid(pos(-sinc(t, .016)) * e), exoBeat:mid(pos(sinc(t, .034)) * e), exoBack:mid(pos(-sinc(t, .034)) * e), gastric:.7 * e});
  c.flushT = Math.max(c.flushT, .5 * e);
  for(let k = 0; k < 6; k++){ const age = t - (400 + k * 340 + (k * 83) % 120); if(age < 0 || age > 1700) continue; const u = age / 1700, sgn = k % 2 ? 1 : -1;
    st.bub[k] = {x:sgn * (6 + 22 * u + 6 * Math.sin(u * 6 + k)), y:-(34 + 150 * u * (.6 + .4 * u)), s:.5 + .9 * fSmooth(0, .7, u)}; T[c.d.MI['bubble' + k + '.C']] += 1.2 * env(age, 90, 1350, 150); }
}});
M.action('eyeDuck', {label:'Duck the eyes', group:'Eyes', dur:2800, gait:true, f:(t, T, c) => {
  const e = pulse(t, 0, 140, 900, 700), fr = 1 - .9 * c.postureW().tucked;   // folded already when tucked
  c.spec(T, {eyeFold:mid(1.25 * e * fr), eyeUp:mid(-.4 * e * fr), antIn:mid(.5 * e * fr), lookD:mid(.4 * e)});
}});
M.action('antennaFlick', {label:'Flick the antennules', group:'Feelers', dur:2400, tiny:true, gait:true, f:(t, T, c, a) => {
  /* the flick: a fast downstroke (about 50 ms) and a slower return, in a bout of five, the two sides a hair apart */
  let L = 0, R = 0; for(let i = 0; i < 5; i++){ L += pulse(t, i * 360, 50, 20, 240); R += pulse(t, i * 360 + 70, 50, 20, 240); }
  c.spec(T, {atnFlick:[1.1 * L, 1.1 * R], antOut:mid(.25 * env(t, 300, 1400, 500)), antCurl:[.4 * L, .4 * R]});
}});
M.action('scan', {label:'Scan', group:'Eyes', dur:5200, gait:true, f:(t, T, c, a) => {
  /* the eyes rise and look about, one then the other, the antennae sweep */
  const e = env(t, 600, 3600, 900), look = KS(t, [[0, 0], [700, 1], [1700, -1], [2700, .6], [3500, -.5], [4300, 0]]) * e, look2 = KS(t, [[0, 0], [900, -.6], [2000, 1], [3200, -1], [4300, 0]]) * e;
  c.spec(T, {eyeUp:mid(.55 * e), eyeOut:[.35 * e, .35 * e], lookR:[pos(look2), pos(look)], lookL:[pos(-look2), pos(-look)], lookU:mid(.3 * e), antOut:mid(.4 * e)});
}});
M.action('mouthWork', {label:'Work the mouthparts', group:'Mouth', dur:3600, tiny:true, gait:true, f:(t, T, c) => {
  const e = env(t, 500, 2400, 700), s1 = sinc(t, .0135), s2 = sinc(t, .027, .7);
  c.spec(T, {mxOpen:mid(.4 * e * (.5 + .5 * sinc(t, .0042))), palpOut:mid(pos(s1) * e), palpIn:mid(pos(-s1) * e), exoBeat:mid(pos(s2) * e), exoBack:mid(pos(-s2) * e), gastric:.5 * e});
  c.flushT = Math.max(c.flushT, .3 * e);
}});
M.action('clawAdjust', {label:'Adjust the claws', group:'Display', dur:3000, tiny:true, gait:true, f:(t, T, c, a) => {
  /* a small re-grip: one claw shifts its guard a little and works its finger */
  const s = a.s ?? (a.s = c.rand() < .5 ? 'R' : 'L'), e = env(t, 500, 1400, 900), w = KS(t, [[0, 0], [700, 1], [1500, -.3], [2300, 0]]);
  clawGo(c, s, [[[GUARD_TIP[0] + 18 * w, GUARD_TIP[1] - 12 * Math.abs(w) + 8], -2.78 + .22 * w, e]], {kk:9}); c.spec(T, {opener:sd(s, .45 * pos(w) * e * avail(c)), closer:sd(s, .3 * pos(-w) * e)});
}});
M.action('legTap', {label:'Tap a foot', group:'Body', dur:1700, in:['rest', 'raised', 'threat'], f:(t, T, c, a) => {
  /* a foot is lifted and put down again where it was (the crab testing the ground), twice */
  const k = a.k ?? (a.k = [0, 1, 2, 3, 4, 5, 6, 7][(c.rand() * 8) | 0]), f = c.foot(k), lift = pulse(t, 0, 160, 120, 170) + pulse(t, 620, 160, 120, 170), lf = LEGK[k].G.lift;
  c.legTo(k, f[0], f[1] - (lf > 0 ? 1 : -1) * 16 * lift, f[2] + (LEGK[k].s === 'R' ? 1 : -1) * (lf > 0 ? -.5 : .5) * lift * .8, 1, 1, {kk:16});
}});
M.action('moon', {label:'Raise the moon', group:'Zodiac', dur:11400, in:['rest', 'raised'], f:(t, T, c, a) => {
  /* the zodiac's image: the crab lifts the crescent in its right claw, the other claw raised beside it; the moon is lit, the light runs the sign over the shell, and the moon is lowered */
  const e = KS(t, [[0, 0], [2600, 1], [8600, 1], [11000, 0]]), hold = env(t - 2600, 700, 4600, 1400), A = c.shiftAmt();
  clawGo(c, 'R', [[[196, -290], -1.3, e]], {kk:10}); clawGo(c, 'L', [[[128, -262], -1.95, .55 * e]], {kk:10});
  c.spec(T, {moonShow:1.3 * KS(t, [[0, 0], [2000, 0], [3000, 1], [8200, 1], [9200, 0]]), rise:.5 * e, eyeUp:mid(.8 * e), lookR:mid(.5 * hold), lookU:mid(.55 * hold), antOut:mid(.5 * e), closer:[.2 * e, .45 * e], opener:[0, 0]});
  c.jt('shell', -.02 * e); if(t > 3300 && !a.gl){ a.gl = 1; c.glyph(3400); }
  c.flushT = Math.max(c.flushT, .2 * hold);
}});
/* sidesteps: a few steps of the walk, one way or the other (the other way needs `walkL`, see below), then it stops where its feet are on their places; and turns on the spot */
M.action('sidestepR', {label:'Sidestep right', group:'Walk', dur:700, in:['rest'], f:(t, T, c, a) => { if(!a.go){ a.go = 1; c.go('walk', {for:2500}); } }});
M.action('sidestepL', {label:'Sidestep left', group:'Walk', dur:700, in:['rest'], f:(t, T, c, a) => { if(!a.go){ a.go = 1; c.go('walkL', {for:2500}); } }});
/* a turn: the crab shuffles its feet round (the ground turns under it: the Turn actions ask the gait for a steer and hold it), a pivot is the older posture, the body held turned on the sand */
const turnAct = dir => (t, T, c, a) => { if(!a.go && t > 30){ a.go = 1; c.go('spin', {for:1700, turn:dir}); } };   // a gait asked for with `turn` carries its steer (-1 left, 1 right) until it ends
M.action('turnLeft', {label:'Turn left', group:'Walk', dur:4200, in:['rest'], f:turnAct(-1)});
M.action('turnRight', {label:'Turn right', group:'Walk', dur:4200, in:['rest'], f:turnAct(1)});
M.action('pivotLeft', {label:'Pivot left', group:'Walk', dur:8200, in:['rest'], f:(t, T, c, a) => { if(!a.go && t > 30){ a.go = 1; c.go('turn-left'); } if(!a.back && t > 4700){ a.back = 1; c.go('rest'); } }});
M.action('pivotRight', {label:'Pivot right', group:'Walk', dur:8200, in:['rest'], f:(t, T, c, a) => { if(!a.go && t > 30){ a.go = 1; c.go('turn-right'); } if(!a.back && t > 4700){ a.back = 1; c.go('rest'); } }});

/* ---------- pads ---------- */
const ga = (c, id, s = 0) => c.act(id, s);
M.pad('eyes', {label:'Eyestalks', group:'Eyes', split:'LR', x:['folded', 'raised'], y:['swung in', 'swung out'], map:(x, y) => ({eyeFold:pos(-x), eyeUp:pos(x), eyeIn:pos(-y), eyeOut:pos(y)}), ghost:(c, s) => [cl(ga(c, 'eyeUp', s) - ga(c, 'eyeFold', s)), cl(ga(c, 'eyeOut', s) - ga(c, 'eyeIn', s))]});
M.pad('gaze', {label:'Gaze', group:'Eyes', x:['left', 'right'], y:['down', 'up'], map:(x, y) => ({lookR:pos(x), lookL:pos(-x), lookU:pos(y), lookD:pos(-y)}), ghost:c => [cl(ga(c, 'lookR', 1) - ga(c, 'lookL', 1)), cl(ga(c, 'lookU', 1) - ga(c, 'lookD', 1))]});
M.pad('antennule', {label:'Antennules', group:'Feelers', split:'LR', x:['laid back', 'flick'], y:['curled', 'extended'], map:(x, y) => ({atnFlick:pos(x), atnLift:pos(y) + pos(-x) * .3}), ghost:(c, s) => [cl(ga(c, 'atnFlick', s)), cl(ga(c, 'atnLift', s))]});
M.pad('antenna', {label:'Antennae', group:'Feelers', split:'LR', x:['swept in', 'swept out'], y:['straight', 'curled'], map:(x, y) => ({antIn:pos(-x), antOut:pos(x), antCurl:pos(y)}), ghost:(c, s) => [cl(ga(c, 'antOut', s) - ga(c, 'antIn', s)), cl(ga(c, 'antCurl', s))]});
M.pad('mouth', {label:'Maxillipeds', group:'Mouth', split:'LR', x:['shut', 'open'], y:['still', 'working'], map:(x, y) => ({mxClose:pos(-x), mxOpen:pos(x), palpOut:.5 * pos(y), exoBeat:.5 * pos(y)}), ghost:(c, s) => [cl(ga(c, 'mxOpen', s) - ga(c, 'mxClose', s)), cl(ga(c, 'palpOut', s))]});
M.pad('breath', {label:'Gill bailer · breath', group:'Mouth', x:['shallow', 'deep'], y:['slow', 'fast'], fx:(c, x, y) => { c.breath.depth = 2 ** (x * 1.3); c.breath.rate = 2 ** (y * 1.2); }, alwaysFx:false, ghost:c => [cl(Math.log2(c.breath.depth) / 1.3), cl(Math.log2(c.breath.rate) / 1.2)]});
M.pad('fingers', {label:'Claw fingers', group:'Claws', split:'LR', x:['closed', 'open'], y:['slack', 'gripping'], map:(x, y) => ({opener:pos(x), closer:pos(-x) * .6 + pos(y) * .8}), ghost:(c, s) => [cl(ga(c, 'opener', s) - ga(c, 'closer', s)), cl(ga(c, 'closer', s))]});
M.pad('claws', {label:'Claw arms', group:'Claws', split:'NF', leg:'claw', x:['left', 'right'], y:['flexed', 'extended']});
for(let n = 1; n <= 4; n++) M.pad('leg' + n, {label:'Leg ' + n + (n === 1 ? ' (front)' : n === 4 ? ' (rear)' : ''), group:'Legs', split:'NF', leg:'leg' + n, x:['toward the left', 'toward the right'], y:['flexed', 'stretched']});
M.pad('shell', {label:'Shell', group:'Body', x:['lean left', 'lean right'], y:['lowered', 'raised'], map:(x, y) => ({rockL:pos(-x), rockR:pos(x), sink:pos(-y), rise:pos(y)}), ghost:c => [cl(ga(c, 'rockR') - ga(c, 'rockL')), cl(ga(c, 'rise') - ga(c, 'sink'))]});
M.pad('pivot', {label:'Steer · pivot', group:'Body', x:['turn left', 'turn right'], y:['', ''], fx:(c, x, y) => { c.Q.rr += .1 * x; }, ghost:c => [cl(c.root.r / .1), 0]});
M.pad('sand', {label:'Sand · grain and burial', group:'Ground', x:['fine', 'coarse'], y:['bare', 'buried'], fx:(c, x, y) => { c.slide('sand', 0, -SAND_OFF * pos(y)); }, ghost:c => [cl(c.pad.sand.L[0]), cl(1 - c.sy[c.d.BI.sand] / SAND_OFF)]});
M.pad('prints', {label:'Prints and spray', group:'Ground', value:true, x:['fading', 'lasting'], y:['none thrown', 'much thrown'], ghost:c => [cl(c.pad.prints.L[0]), cl(c.pad.prints.L[1])]});

/* ---------- hooks: idle, what each posture holds, the gaits' body, post, colour, the glyph's path, life ---------- */
function initCr(c){
  if(c.rig){ c.rig.removeAttribute('transform'); if(c.anat) c.anat.removeAttribute('transform'); for(const P of c.d.parts) if(P.tags.has('glyph')) c.groups[P.order].removeAttribute('transform'); }
  if(c.ps) c.ps.x[2 * c.d.BI.sand + 1] = c.pm.V[c.d.CHI['s:sand.y']];
  const g = groundOf(c); if(g) g.clear();
  return {last:c.t, groom:{R:0, L:0}, bub:new Array(6).fill(null), bubL:new Array(6).fill(null), lift:new Float32Array(10), liftD:new Float32Array(10), moonD:0, cd:{R:0, L:0}, mirror:false, pend:null, symW:0,
    g, gaitTurn:0, buryPrev:0, dig:0, digPh:0, digLift:new Float32Array(8), digT:new Array(8).fill(0), moundKey:'', moundOn:false};
}
const crab = c => (!c.cr || c.t < c.cr.last - 1) ? (c.cr = initCr(c)) : c.cr;
let LEGP = null, SHELLP = null, LEGLIST = null, SHELLLIST = null;
/* ----- the mirror, and asking for a walk to the other side -----
   Asking for a gait on the other side stops the walk if there is one, lets the crab settle to the rest posture with its claws, eyes and feelers square (the asymmetric parts of life fade for
   the moment), and only when the figure is its own mirror image to within a few units does the rig flip and the gait start. The switch is therefore not seen. */
const SYMP = [['palmR', 'palmL'], ['eyeR', 'eyeL'], ['antR3', 'antL3'], ['atnR2', 'atnL2'], ['dactR', 'dactL'], ['dacR1', 'dacL1'], ['dacR2', 'dacL2'], ['dacR3', 'dacL3'], ['dacR4', 'dacL4'], ['stalkR', 'stalkL']];
function asym(c){ let m = Math.abs(c.rot[c.d.BI.shell]) * 260; for(const [a, b] of SYMP){ const A = bone_(a), B = bone_(b), pa = c.wp(a, A.q), pb = c.wp(b, B.q); m = Math.max(m, Math.hypot(pa[0] - (2 * CX - pb[0]), pa[1] - pb[1])); } return m; }
function setMirror(c, on){
  const st = crab(c); if(st.mirror === on) return; st.mirror = on; const t = on ? 'translate(' + 2 * CX + ',0) scale(-1,1)' : null;
  for(const e of [c.rig, c.anat]) if(e){ if(t) e.setAttribute('transform', t); else e.removeAttribute('transform'); }
  for(const P of c.d.parts) if(P.tags.has('glyph')){ const g = c.groups[P.order]; if(t) g.setAttribute('transform', t); else g.removeAttribute('transform'); }   // the sign is lettering: it is drawn the right way round
}
const gaitSide = (n, cur = 'R') => n === 'spin' ? cur : /L$/.test(n) ? 'L' : 'R';
function crabGo(c, name, o){
  const st = crab(c); if(o && o.turn !== undefined) st.gaitTurn = o.turn;
  const go = c.crabGo0, cur = st.mirror ? 'L' : 'R', want = gaitSide(name, cur);
  if(want === cur){ st.pend = null; return go(name, o); }
  st.pend = {name, o, t0:c.t}; if(c.gs.on && c.gs.phase !== 'stop') c.stop();
}
function pending(c, now){
  const st = crab(c), P = st.pend; if(!P) return;
  if(c.gs.on){ return; }
  if(c.pm.node !== 'rest' || c.pm.tr || c.pm.route.length){ if(c.pm.want !== 'rest' && !c.pm.tr) c.crabGo0('rest'); return; }
  if(c.pm.after || c.pm.pend.length) return;
  if(c.actions.length) c.actions.forEach(a => { if(!a.cut) a.cut = now; });
  if(c.pm.settle > 500){ const A = asym(c); if(A < 2.5 || now - P.t0 > 7000){ st.flipAsym = A; st.pend = null; setMirror(c, gaitSide(P.name, st.mirror ? 'L' : 'R') === 'L'); c.crabGo0(P.name, P.o); } }
}
/* ---------- the ground: creature-ground.js, driven from the hooks (round 4) ----------
   The crab stays upright on the page (the camera follows it); the GROUND moves. It travels along the crab's own sideways axis when the legs walk and turns about the crab when they
   steer, and a planted foot keeps its point of the WORLD, so on the page it rides the sand. The heading is the ground's turn (`phi`), the ripples, stones, prints and the light are fixed
   in the world. The engine's frame is the rig's (mirrored on the page while the crab walks to its left): everything here is done in the engine's frame and put on the page with `pagePt`. */
const OMEGA = .8;                                         // rad/s the ground turns at a full steer
const rot2 = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * x - s * y, s * x + c * y]; };
const pagePt = (st, x, y) => st.mirror ? [2 * CX - x, y] : [x, y];
const SHELLOUT = (() => { const R = ['O0', 'O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10', 'O11', 'O12', 'O13'].map(n => RN[n]); return R.map(([x, y]) => [CX + x, CY + y]).concat(R.slice(1, -1).reverse().map(([x, y]) => [CX - x, CY + y])); })();
const f1 = v => Math.round(v * 10) / 10;
function groundOf(c){
  if(!window.CreatureGround || !c.svg) return null;
  if(!c.svg.__cg) c.svg.__cg = CreatureGround.make(c, {pivot:[CX, CY], crest:.3, seed:21, light:-2.3}); c.svg.__cg.crest = .3;
  const g = c.svg.__cg; g.colour(c.C); return g;
}
/* digging in: while the sand is rising over the crab (its burial is changing) the rear legs, the third and the fourth, scoop in turn: the foot strokes inward and forward under the carapace, drawing
   sand over it (it is lifted and brought out again on the return, which the shadow shows), and a few grains fly from it onto the body. The scoop is added to the posture's own foot places and fades with the
   burial's rate of change, so a held dig-in is still and the feet are back on their places when it ends. */
function shovel(c, st, now, dt){
  const b = clamp(1 - c.sy[c.d.BI.sand] / SAND_OFF), rate = Math.abs(b - st.buryPrev) / Math.max(dt, 1) * 1000; st.buryPrev = b;
  const tr = c.pm.tr, inEdge = !!tr && (tr.a === 'dug-in' || tr.b === 'dug-in'), A = inEdge && !c.gs.on ? fSmooth(.03, .14, rate) : 0;   // only while the posture's own edge is taking it in or out of the sand
  st.dig += (A - st.dig) * (1 - Math.exp(-dt / (A > st.dig ? 170 : 110)));
  if(st.dig < .004){ st.digLift.fill(0); return; }
  st.digPh += dt / 880 * st.dig;
  for(const k of [2, 3, 6, 7]){
    const rq = c.Q.legs[k]; if(!rq) continue;
    const L = LEGK[k], ph = (st.digPh + (k === 2 || k === 7 ? 0 : .5)) % 1, sgn = L.s === 'R' ? 1 : -1;
    const stroke = ph < .55 ? ph / .55 : 1 - (ph - .55) / .45, u = stroke * stroke * (3 - 2 * stroke);
    const lift = ph < .5 ? 0 : Math.sin(Math.PI * (ph - .5) / .5);
    const dx = sgn * (30 - 64 * u), dy = 16 - 50 * u, db = sgn * (.3 - .8 * u);
    rq.x += dx * st.dig; rq.y += dy * st.dig; rq.b += db * st.dig; st.digLift[k] = lift * st.dig;
    if(ph > .5 && !st.digT[k]){ st.digT[k] = 1; const g = st.g; if(g){ const [px, py] = pagePt(st, rq.x, rq.y), o = c.wp('shell', [CX, CY]), dxs = o[0] - px, dys = o[1] + 40 - py, d = Math.hypot(dxs, dys) || 1;
        g.throwGrains(px, py, dxs / d * 120, dys / d * 120, 150, 5, now, {sx:34, sy:34, life:900, z:6}); } }
    if(ph < .45) st.digT[k] = 0;
  }
}
/* the world's step and the feet's: called from `idle`, after the gait engine has asked for the feet (the work is creature-ground.js's `update`) */
function groundStep(c, st, now, dt){
  const g = st.g; if(!g) return;
  const ps = c.pad.sand.L, pr = c.pad.prints.L; g.setParams({grain:ps[0], persist:Math.pow(2, 1.6 * pr[0]), thrown:pr[1] < 0 ? 1 + pr[1] : 1 + 1.2 * pr[1]});
  g.update(c, {now, dt, mirror:st.mirror, steer:st.gaitTurn + c.pad.pivot.L[0], legs:8, trailing:k => k >= 4, omega:OMEGA, onStop:() => { st.gaitTurn = 0; }});
}
/* the shadows (a hole in the texture, along the world's light), the heap over a buried crab, the grains: drawn after the frame's pose */
function groundDraw(c, st, now){
  const g = st.g; if(!g) return;
  const d = c.d, wp = (b, p) => { const q = c.wp(b, p); return pagePt(st, q[0], q[1]); }, W = c.postureW();
  const sh = (pts, zs, w) => 'M' + pts.map((p, i) => { const o = g.shadowOff(zs[i]); return f1(p[0] + o[0]) + ' ' + f1(p[1] + o[1]); }).join('L');
  const zb = 30 + 22 * (c.act('rise') - c.act('sink')) - 8 * W['dug-in'], ob = g.shadowOff(zb);
  g.shadow('body', 'M' + SHELLOUT.map(p => { const q = wp('shell', p); return f1(q[0] + ob[0]) + ' ' + f1(q[1] + ob[1]); }).join('L') + 'Z', {fill:true, opacity:.5});
  for(let k = 0; k < 8; k++){
    const L = LEGK[k], gs = c.gs, lf = c.gait && c.gs.on && !c.gait.stance[k] ? Math.sin(Math.PI * clamp(gs.legs[k].p)) : st.digLift[k], hip = wp('mer' + L.s + L.nn, bone_('mer' + L.s + L.nn).p), kn = wp('pro' + L.s + L.nn, bone_('pro' + L.s + L.nn).p), wr = wp('dac' + L.s + L.nn, bone_('dac' + L.s + L.nn).p), t = c.toe(k), toe = pagePt(st, t[0], t[1]);
    g.shadow('leg' + k, sh([hip, kn, wr, toe], [28, 58 + 10 * lf, 20 + 28 * lf, 38 * lf]), {w:10.5, opacity:.46});
  }
  const up = clamp(W.raised * .8 + W.threat + .5 * W['dug-in']);
  for(const s of SIDES){ const sh0 = wp('arm' + s, bone_('arm' + s).p), el = wp('fore' + s, bone_('fore' + s).p), wr = wp('palm' + s, bone_('palm' + s).p), q = c.wp('palm' + s, bone_('palm' + s).q), tip = pagePt(st, q[0], q[1]);
    g.shadow('claw' + s, sh([sh0, el, wr, tip], [32, 52 + 30 * up, 44 + 50 * up, 40 + 50 * up]), {w:13, opacity:.46}); }
  moundDraw(c, st, g, clamp(1 - c.sy[d.BI.sand] / SAND_OFF), now);
  g.draw(); g.tick(c.dtms, now);
}
/* the heap: a mound that grows behind the crab as it backs into the sand and rises over its carapace from the rear (its front edge crosses the shell); the sand's own ripples run over it
   (the world's crest direction, so the heap belongs to the ground), the buried carapace shows through as a dashed outline, grains lie on it and spill down its front */
function moundDraw(c, st, g, b, now){
  if(b < .012){ if(st.moundOn){ g.heap('', '', '', ''); g.shadow('heap', '', {fill:true}); st.moundOn = false; } return; }
  const o = c.wp('shell', [CX, CY]), e = b * b * (3 - 2 * b), gr = Math.pow(e, .7), key = Math.round(b * 300) + ',' + Math.round(o[1]) + ',' + Math.round(g.phi * 60);
  if(key === st.moundKey) return; st.moundKey = key; st.moundOn = true;
  const cx = o[0], cy = o[1] + 250 - 180 * e, rx = 318 * gr, ry = 162 * gr, N = 64;
  const ring = (k, wob) => Array.from({length:N}, (_, i) => { const a = i * 2 * Math.PI / N, w = k * (1 + wob * (.5 * Math.sin(a * 3 + 1.1) + .35 * Math.sin(a * 7 + 2.3) + .25 * Math.sin(a * 11 + .6))); return [cx + rx * w * Math.cos(a), cy + ry * w * Math.sin(a)]; });
  const path = (pts, close) => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + (close ? 'Z' : ''), outer = ring(1, .03);
  const front = outer.filter((p, i) => { const a = i * 2 * Math.PI / N; return a > Math.PI * 1.04 && a < Math.PI * 1.96; });
  /* the sand's ripples over the heap: sinuous crests across its bounding box, in the world's direction (a clip path keeps them on the heap) */
  const ang = g.crest + g.phi, ca = Math.cos(ang), sa = Math.sin(ang), span = rx + 30; let lines = '';
  for(let v = -ry - 20, r = 0; v <= ry + 20; v += 21 + (r++ % 3) * 3){ const pts = []; for(let u = -span; u <= span; u += 26){ const w = 4.5 * Math.sin(u * .045 + r * 1.7) + 2 * Math.sin(u * .11 + r); pts.push([cx + u * ca - (v + w) * sa, cy + u * sa + (v + w) * ca]); } lines += path(pts) + ' '; }
  const shell = SHELLOUT.map(([x, y]) => { const q = c.wp('shell', [x, y]); return q; });
  let dots = ''; for(let i = 0; i < 40; i++){ const a = (i * 2.399) % (2 * Math.PI), r = .25 + .72 * ((i * 0.618) % 1); dots += 'M' + f1(cx + rx * r * Math.cos(a)) + ' ' + f1(cy + ry * r * Math.sin(a)) + 'h.1'; }
  /* avalanche runs: short strokes down the front slope */
  let spill = ''; front.forEach((p, i) => { if(i % 3) return; const a = Math.atan2(p[1] - cy, p[0] - cx), l = 7 + 9 * ((i * 7) % 5) / 4; spill += 'M' + f1(p[0]) + ' ' + f1(p[1] - 6) + 'l' + f1(Math.cos(a) * l) + ' ' + f1(Math.sin(a) * l); });
  /* its volume: a darker crescent on the side away from the light, and its cast shadow on the ground beside it */
  const so = g.shadowOff(34), toL = [-so[0] * .5, -so[1] * .5], inner = outer.map(p => [cx + (p[0] - cx) * .93 + toL[0], cy + (p[1] - cy) * .93 + toL[1]]);
  g.heap(path(outer, true), lines, path(front), dots + spill, path(shell, true), path(outer, true) + path(inner, true));
  g.shadow('heap', path(outer.map(p => [p[0] + so[0], p[1] + so[1]]), true), {fill:true, opacity:.5});
}
const DEF = M.finish({
  reachCap:-999, strideMax:118,
  lifePick(c, pick, now){ return !!crab(c).pend; },
  idle(c, now, Ti, dt){
    const st = crab(c); st.last = now;
    if(!c.crabGo0){ c.crabGo0 = c.go; const play = c.play; c.go = (n, o) => c.d.GAIT_PSI[n] !== undefined ? crabGo(c, n, o) : c.crabGo0(n, o); c.play = (n, a) => c.d.GAIT_PSI[n] !== undefined ? crabGo(c, n, a) : play(n, a); }
    pending(c, now); st.symW += ((st.pend ? 1 : 0) - st.symW) * (1 - Math.exp(-dt / (st.pend ? 380 : 1600))); const sq = 1 - st.symW;
    /* the breath: the gill bailer pumps, slow, and the gastric mill pulses under the stomach */
    const br = .5 + .5 * Math.sin(now * .0044 * c.breath.rate + 1), dep = c.breath.depth;
    c.spec(Ti, {scaph:(.2 + .42 * br) * dep, gastric:.12 + .2 * (.5 + .5 * Math.sin(now * .0019 + 2)), abdFlex:.3 + .08 * br, abdExt:.06 * (.5 + .5 * Math.sin(now * .0013))});
    /* the mouthparts are never still: the palps, the exopods and the doors flutter at a few hertz, the effort wandering (the Maxillipeds pad's y raises it) */
    const mw = 1 + 1.5 * pos(c.pad.mouth.L[1]), amp = (.5 + .5 * K.vnoise(now * .00035, 3.7)) * mw, ph = i => now * .001 * i;
    c.spec(Ti, {palpOut:[.3 * amp * pos(Math.sin(ph(9.6))), .3 * amp * pos(Math.sin(ph(9.6) + 1.1))], palpIn:[.3 * amp * pos(-Math.sin(ph(9.6))), .3 * amp * pos(-Math.sin(ph(9.6) + 1.1))],
      exoBeat:[.34 * amp * pos(Math.sin(ph(16.5) + .5)), .34 * amp * pos(Math.sin(ph(16.5) + 2))], exoBack:[.2 * amp * pos(-Math.sin(ph(16.5) + .5)), .2 * amp * pos(-Math.sin(ph(16.5) + 2))],
      mxOpen:mid(.1 + .1 * Math.sin(ph(3.4)) * amp)});
    /* the eyes: each looks about on its own, a quick glance and a stay (minimum-jerk goals); the stalks drift a little */
    const lk = {lookR:[0, 0], lookL:[0, 0], lookU:[0, 0], lookD:[0, 0]}, sw = [0, 0];
    for(let i = 0; i < 2; i++){
      if(c.every('gz' + i, [1300, 4200], now)){ c.goal('gx' + i, (c.rand() * 2 - 1) * .95, 340 + c.rand() * 120); c.goal('gy' + i, (c.rand() * 2 - 1) * .7, 340 + c.rand() * 120); }
      if(c.every('sw' + i, [3000, 8000], now)) c.goal('sw' + i, (c.rand() * 2 - 1) * .5, 1500 + c.rand() * 900);
      const gx = c.goalAt('gx' + i, now), gy = c.goalAt('gy' + i, now); lk.lookR[i] = pos(gx); lk.lookL[i] = pos(-gx); lk.lookU[i] = pos(-gy); lk.lookD[i] = pos(gy); sw[i] = c.goalAt('sw' + i, now);
    }
    c.spec(Ti, {...lk, eyeOut:[pos(sw[0]) * .5 * sq, pos(sw[1]) * .5 * sq], eyeIn:[pos(-sw[0]) * .5 * sq, pos(-sw[1]) * .5 * sq]});
    /* the antennae and antennules sway and re-aim; the antennules flick now and then; the claws' fingers shift their grip */
    for(let i = 0; i < 2; i++){ if(c.every('as' + i, [2500, 7000], now)){ c.goal('as' + i, (c.rand() * 2 - 1) * .8, 1300 + c.rand() * 800); c.goal('ac' + i, c.rand(), 1500 + c.rand() * 900); } if(c.every('fg' + i, [3500, 9000], now)) c.goal('fg' + i, c.rand(), 1200 + c.rand() * 800); }
    const as = [c.goalAt('as0', now), c.goalAt('as1', now)], ac = [c.goalAt('ac0', now), c.goalAt('ac1', now)], fg = [c.goalAt('fg0', now), c.goalAt('fg1', now)];
    c.spec(Ti, {antOut:[pos(as[0]) * .4 * sq, pos(as[1]) * .4 * sq], antIn:[pos(-as[0]) * .4 * sq, pos(-as[1]) * .4 * sq], antCurl:[.25 * ac[0] * sq, .25 * ac[1] * sq], closer:[.05 + .12 * fg[0] * sq, .05 + .12 * fg[1] * sq], opener:[.05 * (1 - fg[0]) * sq, .05 * (1 - fg[1]) * sq]});
    if(c.every('flick', [3200, 8500], now)) c.actions.push({name:'antennaFlick', t0:now});
    /* postural tone: the shell leans and rises a hair, now one way, now the other; the claws drift on their guard; none of it moves the feet */
    if(c.every('rk', [3500, 9000], now)){ c.goal('rk', (c.rand() * 2 - 1) * .55, 2200 + c.rand() * 1400); c.goal('rs', (c.rand() * 2 - 1) * .5, 2600 + c.rand() * 1400); }
    const rk = c.goalAt('rk', now), rs = c.goalAt('rs', now); c.spec(Ti, {rockR:pos(rk) * .5 * sq, rockL:pos(-rk) * .5 * sq, rise:pos(rs) * .4, sink:pos(-rs) * .4});
    for(const s of SIDES){
      const i = s === 'R' ? 1 : 0, key = 'cd' + s;
      if(c.every(key, [2800, 7500], now)) c.goal(key + 'b', (c.rand() * 2 - 1) * .1, 1600 + c.rand() * 900);
      st.cd[s] = c.goalAt(key + 'b', now) * (s === 'R' ? 1 : -1) * sq;   // the claw turns a little about its fingertip, which stays on its place
      const f = c.foot(CK[s]), kg = c.gs.on ? c.gs.k : 0, ph = c.gs.on ? c.gs.ph : 0, lean = (s === 'R' ? 9 : -6) * kg + 5 * kg * Math.sin(2 * Math.PI * ph + .4), bob = 3 * kg * Math.sin(4 * Math.PI * ph + 1.2); c.legReq(CK[s], f[0] + lean, f[1] + bob, f[2] + st.cd[s], {kk:9});   // on the move the claws are held out a little towards the way it goes (the leading one further) and sway with the stride, a little behind the shell's roll (they are held, not rocked)   // the claws hold their posture's place through a gait too: they take no part in the stride
      if(c.gait) c.gait.stance[CK[s]] = false;   // and they are carried, not planted
    }
    if(!c.gs.on){ for(let k = 0; k < 8; k++) st.lift[k] += (0 - st.lift[k]) * (1 - Math.exp(-dt / 70)); }
    shovel(c, st, now, dt); groundStep(c, st, now, dt);
  },
  postureHold(c, w, Ta){
    const turn = w['turn-left'] + w['turn-right'];
    c.spec(Ta, {eyeUp:mid(.5 * w.rest + w.raised + w.threat + w['dug-in'] + .5 * turn), eyeFold:mid(w.tucked), eyeOut:mid(.4 * w.threat + .2 * w['dug-in']), opener:mid(.14 * w.raised + w.threat + .22 * w['dug-in']), closer:mid(.2 * w.rest + .15 * w.raised + .5 * w.tucked),
      rise:.7 * w.raised + w.threat + .3 * w['dug-in'], sink:.9 * w.tucked + .6 * w['dug-in'], antOut:mid(.5 * w.threat + .3 * w.raised + .2 * w['dug-in']), antIn:mid(.7 * w.tucked), antCurl:mid(.5 * w.tucked), mxClose:mid(.8 * w.tucked), scaph:.35 * w['dug-in'] + .2 * w.tucked, gastric:.25 * w.threat, abdFlex:.5 * w.tucked + .3 * w['dug-in'], abdExt:.35 * w.threat});
  },
  gaitBody(c, G, k, ph, mk){
    /* the shell rocks over the stepping tetrapods, the eyes hold level against it (the stalks counter-rotate), the antennae trail; and the shell is a hair nearer the eye as the trailing legs push */
    const a = 2 * Math.PI * ph, w2 = 2 * a, ch = /^scuttle/.test(G.name) ? 1.5 : 1, roll = .03 * k * mk * ch * Math.sin(a + .4);
    c.jt('shell', roll); c.jd('stalkR', -roll * .8); c.jd('stalkL', -roll * .8); crab(c).rock = k * mk * ch * .014 * (.5 + .5 * Math.sin(w2 + .8));
    for(const s of SIDES) for(let i = 0; i < 3; i++) c.jd('ant' + s + i, .035 * k * mk * ch * Math.sin(a - .7 * i + (s === 'R' ? 0 : 1.3)));
    c.spec(c.Ta, {scaph:.25 * k * ch, gastric:.2 * k, rise:.25 * k * ch});
  },
  post(c, rot, sx, sy, now, dt){
    const st = crab(c), d = c.d, e = Math.exp(-dt / 110);
    /* the shell's size shows its height; the stalks lengthen and fold (the eye bone counters the scale so the ball stays round); the bubbles and the moon */
    const sh = 1 + .075 * (c.act('rise') - c.act('sink')) + (st.rock || 0); st.rock = 0; c.scale('shell', sh, sh);
    for(const s of SIDES){ const i = s === 'R' ? 1 : 0, g = st.groom[s]; st.groom[s] *= 0; const al = clamp(1 + .55 * c.act('eyeUp', i) - .48 * c.act('eyeFold', i) + .4 * g, .45, 1.85); c.scale('stalk' + s, al, 1); c.scale('eye' + s, 1 / al, 1); }
    for(let k = 0; k < 6; k++){ const b = st.bub[k], B = d.BI['bub' + k]; if(b){ st.bubL[k] = b; st.bub[k] = null; } const q = st.bubL[k]; if(q){ sx[B] = q.x; sy[B] = q.y; c.scale('bub' + k, q.s, q.s); if(c.act('bubble' + k) < .02) st.bubL[k] = null; } else { sx[B] = 0; sy[B] = 0; } }
    if(c.gait) for(let k = 0; k < 8; k++){ const L = LEGK[k]; if(!c.gait.stance[k]){ const q = c.gs.legs[k].p, f = 1 + .15 * Math.sin(Math.PI * clamp(q)); c.scale('dac' + L.s + L.nn, f, f); } }   // a lifted foot is nearer the eye
    const mg = .06 + .94 * fSmooth(.04, .9, c.act('moonShow')); c.scale('moon', mg, mg);
  },
  colour(c, i, col, now){
    /* a lifted foot is brighter (nearer the eye); the shell takes the moon's light while it is held up */
    const st = c.cr; if(!st) return col;
    const k = LEGP[i]; if(k >= 0 && st.lift[k] > .02) col = K.mixInt(col, c.C.bone, .3 * st.lift[k]);
    if(SHELLP[i] && st.moonD > .02) col = K.mixInt(col, K.mixInt(c.C.bone, K.hexInt(K.ROSTER.lapis), .35), .22 * st.moonD);
    return col;
  },
  colourLive(c, now){
    const st = crab(c), g = c.gait;
    for(let k = 0; k < 8; k++){ const tgt = Math.max(g && !g.stance[k] ? 1 : 0, st.digLift[k]); st.lift[k] += (tgt - st.lift[k]) * (1 - Math.exp(-c.dtms / 60)); if(Math.abs(st.lift[k] - st.liftD[k]) > .03){ st.liftD[k] = st.lift[k]; for(const i of LEGLIST[k]) c.colDirty.add(i); } }
    groundDraw(c, st, now);
    const mw = clamp(c.act('moonShow') * 1.2, 0, 1); st.moonD += (mw - st.moonD) * (1 - Math.exp(-c.dtms / 300));
    if(Math.abs(st.moonD - (st.moonDD || 0)) > .015){ st.moonDD = st.moonD; for(const i of SHELLLIST) c.colDirty.add(i); }
  },
  glyph:glyS,
  shiftOf:{tucked:.9, 'dug-in':.9, 'turn-left':.6, 'turn-right':.6, raised:.8, threat:.6},
  life:{rate:1.6,
    small:[['scan', 2.6, 4000], ['mouthWork', 2.4, 4500], ['antennaFlick', 2.2, 3500], ['clawAdjust', 2.4, 5000], ['eyeDuck', .5, 20000], ['groomEye', 1.1, 14000], ['feed', 1.3, 22000, ['rest', 'raised', 'dug-in']], ['bubble', 1, 15000, ['rest', 'dug-in', 'tucked']],
      ['snap', .6, 20000, ['rest', 'raised', 'threat']], ['clawWave', .9, 26000, ['rest', 'raised']], ['legTap', 1.2, 9000, ['rest', 'raised', 'threat']], ['moon', .45, 52000, ['rest']], ['glyph', 1.2, 14000]],
    moves:[['go:raised', .8, 18000, ['rest']], ['go:threat', .6, 26000, ['raised', 'rest']], ['go:tucked', .4, 32000, ['rest']], ['go:dug-in', .35, 55000, ['rest', 'tucked']], ['go:rest', 1.6, 0, ['raised', 'threat', 'tucked', 'dug-in', 'turn-left', 'turn-right']],
      ['walk', .6, 14000, ['rest']], ['walkL', .6, 14000, ['rest']], ['scuttle', .3, 26000, ['rest']], ['scuttleL', .3, 26000, ['rest']], ['turnLeft', .5, 30000, ['rest']], ['turnRight', .5, 30000, ['rest']], ['pivotLeft', .25, 42000, ['rest']], ['pivotRight', .25, 42000, ['rest']]],
    dwell:{rest:[3500, 8000], raised:[4500, 8500], threat:[3000, 6000], tucked:[3500, 7000], 'dug-in':[6000, 11000], 'turn-left':[1000, 2000], 'turn-right':[1000, 2000]},
    gait:[['scan', 2.4, 4000], ['antennaFlick', 2.2, 3500], ['mouthWork', 1.6, 5000], ['eyeDuck', .3, 20000]], gaitFor:{walk:[3500, 7500], walkL:[3500, 7500], scuttle:[2500, 4500], scuttleL:[2500, 4500]}},
});
/* the kit takes the angle between a leg's bones as a plain difference of atan2s, which is wrong for a leg pointing along -x whose bones straddle the +-pi seam (every
   left leg's does): put the rest angles on one branch (Kit request 1) */
for(const D of DEF.IKD){ D.a[1] = D.a[0] + K.wrapA(D.a[1] - D.a[0]); D.a[2] = D.a[1] + K.wrapA(D.a[2] - D.a[1]); }
/* which polygons are a leg's, which the shell's: for the colour hook */
{ LEGP = new Int8Array(DEF.NPOLY).fill(-1); SHELLP = new Uint8Array(DEF.NPOLY); LEGLIST = LEGK.map(() => []); SHELLLIST = [];
  for(let i = 0; i < DEF.NPOLY; i++){ const P = DEF.parts[DEF.PPART[i]]; if(P.tags.has('leg') && !P.tags.has('joint')){ const n = [...P.tags].find(t => /^leg\d$/.test(t)), k = (P.tags.has('R') ? 0 : 4) + (+n.slice(3)) - 1; LEGP[i] = k; LEGLIST[k].push(i); } else if(P.tags.has('carapace')){ SHELLP[i] = 1; SHELLLIST.push(i); } } }
K.define(DEF);
})();
