/* creature-eagle.js — the eagle of vision and spiritual ascent, on creature-kit.js. The standard is CREATURE-SPEC.md; the research and the rounds are in
   CREATURE-NOTES-EAGLE.md. A golden eagle in profile facing right, perched with Z-folded wings in the rest pose; the displayed posture is the heraldic
   double-headed eagle (round 4): the body turns frontal, the far wing comes round to mirror the near one, a gilded second head grows and resolves.

   THE WING is a bone chain (humerus, ulna, hand) with a bone for every flight feather (primaries on the hand, secondaries on the ulna, tertials on the
   humerus, the alula on the thumb), each feather a part bound to its own bone, a covert bound to the bone of the feather it overlies. Each primary has a
   second bone near its tip, blended in by position along the feather, so it can bend under load. The whole wing hangs from a WING-PLANE bone: its rest axis
   is the body's long axis, so scaling it across (c.scale) squashes the wing in the direction perpendicular to the body, which is what a wing turning about
   the body's axis looks like from the side: full face-on when raised, edge-on when level, flipped when below. A negative scale mirrors the wing across the
   body's axis: that is how the far wing comes round to the other side of the double eagle.
   THE FLAP (flapStep) is a cycle on that chain, run from the idle hook by the flight posture's weight so it fades in and out and never pops: the wing's
   plane tilts (the scale), the arm sweeps forward on the downstroke and back on the upstroke, the elbow and wrist flex as it rises, the primaries separate and
   twist, each joint a little later than the one before, so the tip traces a loop. */
(() => {
'use strict';
const K = window.CreatureKit;
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI, wrap = K.wrapA, {clamp, fSmooth, chaikin, ringPts, env, pulse, keys, ramp, lerp} = K, pos = v => Math.max(0, v), cl = v => Math.max(-1, Math.min(1, v));
const TF = K.TIERS.F, TM = K.TIERS.M, TL = K.TIERS.L;

/* ---------- frames: the body is a tilted egg, authored in a frame (a along the body toward the chest, b toward the belly) ---------- */
const O = [470, 430], UA = rad(-38), U = [Math.cos(UA), Math.sin(UA)], V = [-U[1], U[0]];
const B = (a, b) => [O[0] + a * U[0] + b * V[0], O[1] + a * U[1] + b * V[1]];
const at = (p, ang, len) => [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const lerp2 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
const GROUND = 742;
/* a world direction along the body toward the tail, turned beta radians toward the belly (the folded wing's feathers lie along it) */
const bdir = beta => Math.atan2(-U[1] * Math.cos(beta) + V[1] * Math.sin(beta), -U[0] * Math.cos(beta) + V[0] * Math.sin(beta));
const FAR = {wing:[26, -12], leg:[34, 0]};
const AXM = 574, MX = p => [2 * AXM - p[0], p[1]];   // the line the two heads mirror about: the neck's base

const M = K.model({id:'eagle', name:'Eagle', sign:'', title:'EAGLE', sub:'vision · the soul\'s ascent', w:1000, h:780, groundY:GROUND, pivot:O, axis:AXM, yawC:664,
  ink:K.ROSTER.lapis, accent:K.ROSTER.amber, far:FAR, cam:[1, 520, 400]});

/* ---------- the skeleton ---------- */
M.bone('body', null, O, B(40, -14), {grp:'root', anat:'line'});
M.bone('pelvis', 'body', O, B(-150, -6), {grp:'rear', lim:[-.7, .7]});
M.bone('chest', 'body', O, B(190, -30), {grp:'front', lim:[-.8, .8]});
/* the head and neck, twice: R is the head of the profile (facing right), L its mirror (the double eagle's second head, facing left) */
const N0 = [574, 290], N1 = [598, 254], HJ = [624, 226], HR = rad(10);
const HS = .84, H = (x, y) => [HJ[0] + (x * Math.cos(HR) - y * Math.sin(HR)) * HS, HJ[1] + (x * Math.sin(HR) + y * Math.cos(HR)) * HS];
const SIDES = ['R', 'L'], MS = s => s === 'R' ? (p => p) : MX, LIM = (s, l) => s === 'R' ? l : [-l[1], -l[0]];
for(const s of SIDES){
  const m = MS(s);
  M.bone('neck1' + s, 'chest', m(N0), m(N1), {grp:'head', lim:LIM(s, [-1.9, 1.5]), sec:true, mot:true, speed:9});
  M.bone('neck2' + s, 'neck1' + s, m(N1), m(HJ), {grp:'head', lim:LIM(s, [-1.5, 1.9]), sec:true, mot:true, speed:10});
  M.bone('head' + s, 'neck2' + s, m(HJ), m(H(190, 6)), {grp:'head', lim:LIM(s, [-1.3, 1.5]), sec:true, mot:true, speed:12});
  M.bone('jaw' + s, 'head' + s, m(H(52, 30)), m(H(180, 40)), {grp:'head', lim:LIM(s, [-.06, .62]), sec:true, speed:14});
  M.bone('hackle' + s, 'neck2' + s, m(H(10, -10)), m(H(-46, 30)), {grp:'head', lim:LIM(s, [-1, 1]), sec:true, speed:6});
  M.follower('hackle' + s, {k:3, w:10, z:.45, gain:.9, lim:.5, flutter:.04});
}
M.bone('sun', 'chest', B(372, 12), B(392, 12), {grp:'front', lim:[-3.4, 3.4], anat:false});   // the sun behind the heads: slid in from out of frame by the hook
const TB = B(-148, -8), TA = rad(125);
M.bone('tail', 'pelvis', TB, at(TB, TA, 215), {grp:'tail', lim:[-1.2, 1.9], sec:true, speed:4});
const NREC = 12;
for(let k = 0; k < NREC; k++){
  const off = (k - 5.5) * 2.6, p = [TB[0] + Math.cos(TA + Math.PI / 2) * off, TB[1] + Math.sin(TA + Math.PI / 2) * off], ang = TA + rad((k - 5.5) * .7), Lk = 215 - Math.abs(k - 5.5) * 3.2;
  M.bone('rec' + k, 'tail', p, at(p, ang, Lk), {grp:'fan', lim:[-1.8, 1.8], sec:true, speed:9, anat:false});
}
/* legs: femur (hidden in the belly), tibiotarsus, tarsometatarsus; the four toes, each a chain of phalanx bones to its claw (M.digits, built with the foot's mesh below) */
const LEGJ = [B(-30, 70), [566, 540], [506, 642], [526, 729]];
for(const side of ['N', 'F']){
  const f = side === 'F' ? FAR.leg : [0, 0], J = LEGJ.map(p => add(p, f)), T = J[3];
  M.bone('hip' + side, 'pelvis', J[0], add(J[0], [0, 20]), {grp:'legs', lim:[0, 0], anat:false});   // the leg's root: the double eagle slides the far leg out by it (an IK leg is slid by its parent, never by its own first bone)
  M.bone('fem' + side, 'hip' + side, J[0], J[1], {grp:'legs', lim:[-3.1, 2.8]});
  M.bone('tib' + side, 'fem' + side, J[1], J[2], {grp:'legs', lim:[-1.4, 3.2]});
  M.bone('tars' + side, 'tib' + side, J[2], J[3], {grp:'legs', lim:[-3.1, 3.0]});
}
/* the wings: the wing-plane bone, humerus, ulna, hand, and a bone for every flight feather (and a tip bone for each primary). Rest is the Z-fold. */
const SHO = B(110, -72);
const WR = {hum:[100, rad(142)], uln:[116, rad(-20)], hand:[72, rad(121)]};
const PRI = 10, SEC = 12, TER = 4, ALU = 3;
const PL = [285, 305, 320, 332, 338, 336, 326, 306, 278, 232], SL = [222, 229, 235, 239, 241, 241, 238, 232, 224, 214, 202, 190], TL_ = [196, 182, 166, 148], AL = [60, 54, 46];
const TIPU = .42;   // where on a primary its tip bone begins
const WG = {};   // the wing's rest geometry, per side
for(const side of ['N', 'F']){
  const off = side === 'F' ? FAR.wing : [0, 0], S = add(SHO, off), E = at(S, WR.hum[1], WR.hum[0]), W = at(E, WR.uln[1], WR.uln[0]), Hd = at(W, WR.hand[1], WR.hand[0]);
  const g = WG[side] = {S, E, W, H:Hd, pri:[], sec:[], ter:[], alu:[]};
  M.bone('wp' + side, 'chest', S, add(S, [U[0] * 90, U[1] * 90]), {grp:'wing', anat:false, lim:[0, 0]});
  M.bone('hum' + side, 'wp' + side, S, E, {grp:'wing', lim:[-4.7, 4.7], sec:true, speed:9});
  M.bone('uln' + side, 'hum' + side, E, W, {grp:'wing', lim:[-4.7, 4.7], sec:true, speed:9.5});
  M.bone('hand' + side, 'uln' + side, W, Hd, {grp:'wing', lim:[-4.7, 4.7], sec:true, speed:10});
  for(let k = 0; k < PRI; k++){   // P1 inner .. P10 outer, on the hand
    const p = lerp2(W, Hd, .06 + .94 * k / (PRI - 1)), ang = bdir(rad(8 + k * 1.2)), tip = at(p, ang, PL[k]);
    g.pri.push({p, ang, L:PL[k]}); M.bone('pri' + k + side, 'hand' + side, p, tip, {grp:'fan', lim:[-3.4, 3.4], sec:true, speed:11, anat:false});
    M.bone('priT' + k + side, 'pri' + k + side, at(p, ang, PL[k] * TIPU), tip, {grp:'fan', lim:[-1.1, 1.1], sec:true, speed:12, anat:false});
  }
  for(let j = 0; j < SEC; j++){   // S1 outer (by the wrist) .. S12 inner (by the elbow), on the ulna
    const p = lerp2(W, E, .08 + .84 * j / (SEC - 1)), ang = bdir(rad(16 - j * 1.4));
    g.sec.push({p, ang, L:SL[j]}); M.bone('sec' + j + side, 'uln' + side, p, at(p, ang, SL[j]), {grp:'fan', lim:[-3.4, 3.4], sec:true, speed:11, anat:false});
  }
  for(let j = 0; j < TER; j++){   // tertials, on the humerus
    const p = lerp2(E, S, .14 + .5 * j / (TER - 1)), ang = bdir(rad(3 + j * 2.5));
    g.ter.push({p, ang, L:TL_[j]}); M.bone('ter' + j + side, 'hum' + side, p, at(p, ang, TL_[j]), {grp:'fan', lim:[-3.4, 3.4], sec:true, speed:11, anat:false});
  }
  for(let j = 0; j < ALU; j++){   // the alula, on the thumb at the wrist
    const p = lerp2(W, Hd, .12), ang = bdir(rad(14 + j * 3));
    g.alu.push({p, ang, L:AL[j]}); M.bone('alu' + j + side, 'hand' + side, p, at(p, ang, AL[j]), {grp:'fan', lim:[-3.4, 3.4], sec:true, speed:12, anat:false});
  }
}
const REST = Object.fromEntries(M.bones.map(b => [b.name, Math.atan2(b.q[1] - b.p[1], b.q[0] - b.p[0])]));
const LEGMUS = [['hipFlex', 'caudofem', -.4, .4], ['quads', 'hamstrings', -.5, .5], ['tibialis', 'gastroc', -.5, .5]];
M.leg({bones:['femN', 'tibN', 'tarsN'], bend:-1, kind:'leg', side:'N', grp:'legs', roll:.6, reach:30, mus:LEGMUS});
M.leg({bones:['femF', 'tibF', 'tarsF'], bend:-1, kind:'leg', side:'F', grp:'legs', roll:.6, reach:30, mus:LEGMUS});

/* ---------- mesh helpers ---------- */
/* the eagle's line presets: the kit's, a little brighter (lapis is the darkest of the roster inks, so the same mix reads dimmer than the lion's amber) */
const LN = {contour:{k:.7, c:1, r:'c', t:'bone', tk:.4}, region:{k:.68, c:.96, r:'b', t:'bone', tk:.32}, feature:{k:.68, c:1, r:'b', t:'bone', tk:.46}};
const FL = {k:.68, c:.98, r:'b', t:'bone', tk:.34};   // a near primary's lines
const FLS = {k:.66, c:.9, r:'f', t:'bone', tk:.3};     // a secondary's or tertial's: a finer outline, so the folded stack reads as tiers and not as a stack of heavy outlines
const FARL = {k:.3, c:.5, r:'b', t:'bone', tk:.1};      // the far wing's, dim and behind: the kit's `far`, a little brighter (restyled toward FL as the eagle turns frontal)
const LEAFLINE = {k:.62, c:.95, r:0, t:'bone', tk:.3, bs:2.6};   // each leaf is one polygon pair: its outline is a stroke on the backing
const LEAFFAR = {k:.28, c:.5, r:0, t:'bone', tk:.1, bs:2.4};
const interp = (T, u) => { for(let i = 0; i < T.length - 1; i++) if(u <= T[i + 1][0]){ const t = (u - T[i][0]) / (T[i + 1][0] - T[i][0] || 1); return [lerp(T[i][1], T[i + 1][1], t), lerp(T[i][2], T[i + 1][2], t)]; } return [T[T.length - 1][1], T[T.length - 1][2]]; };
const ROWS = [0, .12, .26, .42, .58, .72, .84, .93, 1];
const PROF = {
  pri:[[0, .22, .26], [.08, .5, .6], [.3, .8, 1], [.52, 1, 1], [.66, .4, 1], [.78, .36, .95], [.9, .3, .72], [.97, .2, .4], [1, .1, .16]],   // emarginated: the leading vane steps in at the notch
  sec:[[0, .22, .26], [.1, .6, .7], [.4, .95, 1], [.7, 1, 1], [.88, .9, .92], [.97, .6, .62], [1, .3, .3]],
  ter:[[0, .24, .28], [.12, .7, .8], [.4, 1, 1], [.75, 1, 1], [.92, .8, .86], [1, .4, .4]],
  rec:[[0, .26, .3], [.1, .66, .7], [.4, .94, 1], [.75, 1, 1], [.9, .96, .98], [.96, .8, .85], [1, .34, .38]],
  alu:[[0, .3, .34], [.2, .9, 1], [.6, 1, 1], [.9, .7, .76], [1, .3, .3]],
};
/* A flight feather: a shaft with two vanes, as rows of quads (the shaft is the middle run of vertices, so the gap between the vanes is the rachis).
   The leading (narrow) vane is on the + normal side. prof is [[u, fraction of the leading half-width, fraction of the trailing half-width], ...]. `bind` may be a function
   (a primary blends its base bone into its tip bone along its length). */
function feather(name, o){
  const t = [Math.cos(o.ang), Math.sin(o.ang)], n = [-t[1], t[0]], rows = o.rows || ROWS, prof = o.prof || PROF.sec, wl = o.w[0], wr = o.w[1];
  const P = M.part(name, {layer:o.layer, tags:o.tags || [], tier:'M', ptier:'M', bind:o.bind || {rigid:o.bone}, line:o.line || FL, zone:o.zone || 'feathers', dim:!!o.dim, tj:.03, ink:o.ink,
    tone:o.tone || ((x, y) => { const u = ((x - o.p[0]) * t[0] + (y - o.p[1]) * t[1]) / o.L; return o.t0 + (o.t1 - o.t0) * fSmooth(o.tu || .45, 1, u) + (o.bar ? .2 * fSmooth(.74, .8, u) * (1 - fSmooth(.93, .98, u)) : 0); })});
  const L = [], C = [], R = [];
  rows.forEach(u => {
    const [fl, fr] = interp(prof, u), c = [o.p[0] + t[0] * o.L * u, o.p[1] + t[1] * o.L * u];
    L.push(M.vtx(P, c[0] + n[0] * wl * fl, c[1] + n[1] * wl * fl)); C.push(M.vtx(P, c[0], c[1])); R.push(M.vtx(P, c[0] - n[0] * wr * fr, c[1] - n[1] * wr * fr));
  });
  for(let i = 0; i + 1 < rows.length; i++){
    const tier = rows[i] >= (o.fineFrom ?? .72) ? TF : TM;
    M.poly(P, [L[i], L[i + 1], C[i + 1], C[i]], tier); M.poly(P, [C[i], C[i + 1], R[i + 1], R[i]], tier);
  }
  P.loop = [...L, ...R.slice().reverse()];
  return M.close(P);
}
/* a contour feather or covert: two polygons (the vanes) either side of a shaft. Widest a little before the middle, pointed. */
const LEAF = (p, ang, L, w) => {
  const t = [Math.cos(ang), Math.sin(ang)], n = [-t[1], t[0]], at_ = (u, s) => [p[0] + t[0] * L * u + n[0] * w * s, p[1] + t[1] * L * u + n[1] * w * s], left = [at_(0, 0)], right = [at_(0, 0)];
  for(const [u, f] of [[0, .3], [.3, .92], [.6, 1], [.86, .6]]){ left.push(at_(u, f)); right.push(at_(u, -f)); }
  left.push(at_(1, 0)); right.push(at_(1, 0));
  return {polys:[left, right]};
};
const mapLeaf = (lf, m) => ({polys:lf.polys.map(poly => poly.map(m))});
const keyOf = (x, y) => Math.fround(x) + ',' + Math.fround(y);
/* several leaf-shaped polygons in one part, each bound to its own bone (the part's bind looks the bone up by vertex), each with its own tone if it gives one */
function leaves(name, list, o){
  const map = new Map(), P = M.part(name, {layer:o.layer, tags:o.tags || [], tier:'M', ptier:o.ptier || 'M', line:o.line || LEAFLINE, zone:o.zone || 'feathers', dim:!!o.dim, tj:.03, ink:o.ink, tone:o.tone ?? .06, yaw:!!o.yaw, show:o.show});
  const tones = new Map();
  for(const it of list) for(const poly of it.pts.polys){ if(it.tone !== undefined) tones.set(M.PV.length, it.tone); const ids = poly.map(([x, y]) => { map.set(keyOf(x, y), it.bone); return M.vtx(P, x, y, o.z ? o.z(x, y) : 0, o.yaw ? 1 : 0); }); M.poly(P, ids, it.tier ?? TM); }
  if(tones.size){ const base = o.tone ?? .06; P.tone = (x, y, i) => tones.get(i) ?? base; }
  P.loop = []; P.bind = (x, y) => [[map.get(keyOf(x, y)), 1]];
  return M.close(P);
}

/* ---------- the tail: twelve rectrices (rest: a closed blade), upper coverts ---------- */
for(let k = 0; k < NREC; k++){
  const b = M.bones[M.BI['rec' + k]], ang = REST['rec' + k], L = Math.hypot(b.q[0] - b.p[0], b.q[1] - b.p[1]);
  feather('rec' + k, {bone:'rec' + k, p:b.p, ang, L, w:[17, 17], prof:PROF.rec, layer:3 + Math.abs(k - 5.5) * -.01 + .1, tags:['tail', 'tailfeather'], t0:.07, t1:.24, tu:.5, bar:true});
}
{ const list = [];
  for(let i = 0; i < 9; i++){ const u = i / 8, off = (u - .5) * 34, p = [TB[0] + Math.cos(TA + Math.PI / 2) * off, TB[1] + Math.sin(TA + Math.PI / 2) * off], ang = TA + (u - .5) * .5 + (K.hash(i + 71) - .5) * .06; list.push({bone:'tail', pts:LEAF(at(p, TA, -10), ang, 84 + 14 * Math.sin(Math.PI * u), 14), tier:TM, tone:.14 + .04 * u}); }
  leaves('tailCov', list, {layer:3.6, tags:['feathers', 'plumage', 'tail'], tone:.14}); }

/* ---------- the wings ---------- */
for(const side of ['N', 'F']){
  const far = side === 'F', g = WG[side], tg = far ? ['F'] : [], base = far ? {dim:true, line:FARL} : {line:FL}, rows = far ? [0, .3, .62, .88, 1] : ROWS, LL = far ? LEAFFAR : LEAFLINE;
  const lay = (a, b) => far ? 1 + (a - 6) * .2 + b : a + b, fine = far ? 2 : .72, lv = (o) => ({...o, line:LL, dim:far});
  for(let k = 0; k < PRI; k++){
    const f = g.pri[k], bone = 'pri' + k + side, tip = 'priT' + k + side, w = [12 + 2 * (k < 9), 18 + 2 * (k < 9)], tx = Math.cos(f.ang), ty = Math.sin(f.ang);
    const bind = (x, y) => { const u = clamp(((x - f.p[0]) * tx + (y - f.p[1]) * ty) / f.L), q = fSmooth(TIPU - .1, TIPU + .26, u); return [[tip, q + 1e-3], [bone, 1 - q + 1e-3]]; };
    feather('pri' + k + side, {...base, bone, bind, p:f.p, ang:f.ang, L:f.L, w, prof:PROF.pri, rows, layer:lay(6, (9 - k) * .01), tags:['wing', 'primary', ...tg], t0:.11, t1:far ? .2 : .38, tu:.5, fineFrom:fine});
  }
  for(let j = 0; j < SEC; j++){
    const f = g.sec[j], bone = 'sec' + j + side;
    feather('sec' + j + side, {...base, ...(far ? {} : {line:FLS}), bone, p:f.p, ang:f.ang, L:f.L, w:[18, 24], prof:PROF.sec, rows, layer:lay(6.2, j * .01), tags:['wing', 'secondary', ...tg], t0:.1, t1:far ? .16 : .3, tu:.5, fineFrom:fine});
  }
  for(let j = 0; j < TER; j++){
    const f = g.ter[j], bone = 'ter' + j + side;
    feather('ter' + j + side, {...base, ...(far ? {} : {line:FLS}), bone, p:f.p, ang:f.ang, L:f.L, w:[20, 26], prof:PROF.ter, rows, layer:lay(6.3, j * .01), tags:['wing', 'tertial', ...tg], t0:.12, t1:far ? .14 : .26, tu:.5, fineFrom:fine});
  }
  g.alu.forEach((f, j) => feather('alu' + j + side, {...base, bone:'alu' + j + side, p:f.p, ang:f.ang, L:f.L, w:[6, 8], prof:PROF.alu, rows:[0, .3, .6, .85, 1], layer:lay(6.55, j * .01), tags:['wing', 'alula', ...tg], t0:.06, t1:.3, tu:.4}));
  /* coverts: the greater primary coverts and greater secondary coverts ride their own flight feather's bone, the median coverts the secondaries', the lesser ones the secondaries' they lie over */
  leaves('cvPri' + side, g.pri.map((f, k) => ({bone:'pri' + k + side, pts:LEAF(at(f.p, f.ang, 6), f.ang, 92, 12), tier:TM})), lv({layer:lay(6.35, 0), tags:['wing', 'covert', ...tg], tone:far ? .07 : .13}));
  leaves('cvSec' + side, g.sec.map((f, j) => ({bone:'sec' + j + side, pts:LEAF(at(f.p, f.ang, 4), f.ang, 74, 15), tier:TM})), lv({layer:lay(6.4, 0), tags:['wing', 'covert', ...tg], tone:far ? .08 : .15}));
  leaves('cvMed' + side, g.sec.map((f, j) => ({bone:'sec' + j + side, pts:LEAF(at(f.p, f.ang, 2), f.ang, 46, 13), tier:TM, tone:far ? .09 : .18})), lv({layer:lay(6.5, 0), tags:['wing', 'covert', ...tg], tone:.17}));
  leaves('cvTer' + side, g.ter.map((f, j) => ({bone:'ter' + j + side, pts:LEAF(at(f.p, f.ang, 4), f.ang, 58, 15), tier:TM})), lv({layer:lay(6.45, 0), tags:['wing', 'covert', ...tg], tone:far ? .08 : .15}));
  { const d = [g.W[0] - g.E[0], g.W[1] - g.E[1]], dl = Math.hypot(d[0], d[1]), n = [-d[1] / dl, d[0] / dl], items = [];
    for(let r = 0; r < 4; r++) for(let i = 0; i < 7; i++){
      const t = .07 + .14 * i + (r % 2) * .07, off = -2 + r * 15, b = [g.E[0] + d[0] * t + n[0] * off, g.E[1] + d[1] * t + n[1] * off], j = clamp(Math.round(((1 - t) - .08) / .84 * (SEC - 1)), 0, SEC - 1), h = K.hash(r * 13 + i * 5 + 3);
      items.push({bone:'sec' + j + side, pts:LEAF(b, bdir(rad(8 + 6 * h)), 30 + 6 * h, 10), tier:TM, tone:(far ? .08 : .16) + .03 * r});
    }
    leaves('cvLes' + side, items, lv({layer:lay(6.57, 0), tags:['wing', 'covert', ...tg], tone:.17})); }
  const W = g.W, E = g.E, S = g.S, Hd = g.H, al = far ? FARL : LN.region;
  M.limb('armUln' + side, [[E[0], E[1], 36, 17], [W[0], W[1], 38, 15]], {layer:lay(6.55, 0), tier:'M', h:20, bind:{rigid:'uln' + side}, tags:['wing', 'arm', ...tg], line:al, dim:far, tone:.1});
  M.limb('armHum' + side, [[S[0], S[1], 22, 20], [E[0], E[1], 20, 18]], {layer:lay(6.52, 0), tier:'M', h:20, bind:{rigid:'hum' + side}, tags:['wing', 'arm', ...tg], line:al, dim:far, tone:.07});
  M.limb('armHand' + side, [[W[0], W[1], 18, 11], [Hd[0], Hd[1], 12, 6]], {layer:lay(6.56, 0), tier:'M', h:16, bind:{rigid:'hand' + side}, tags:['wing', 'arm', ...tg], line:al, dim:far, tone:.08});
  M.polar('wrist' + side, W, [0, 12, 24], [6, 12], {layer:lay(6.6, 0), tier:'F', bind:{rigid:'hand' + side}, tags:['wing', 'arm', ...tg], line:al, dim:far, twist:.25, tone:.12});
  M.polar('elbow' + side, E, [0, 13, 26], [6, 12], {layer:lay(6.58, 0), tier:'F', bind:{rigid:'uln' + side}, tags:['wing', 'arm', ...tg], line:al, dim:far, twist:.25, tone:.08});
  M.polar('shoulder' + side, S, [0, 16, 32], [6, 12], {layer:lay(6.7, 0), tier:'F', ptier:'F', bind:{mix:[['chest', .8], ['hum' + side, .2]]}, tags:['wing', 'arm', 'plate', ...tg], line:al, dim:far, twist:.3, tone:.08});
}
/* the scapulars: contour feathers over the root of the wing; they stay with the body when the wing rises */
leaves('scapulars', Array.from({length:8}, (_, i) => { const p = B(104 - i * 16, -70 - i * 2.2), ang = bdir(rad(-4 + i * 2.2)); return {bone:'chest', pts:LEAF(p, ang, 150 - i * 9, 21), tier:TM, tone:.16 + .03 * i}; }), {layer:6.8, tags:['feathers', 'plumage'], tone:.16});

/* ---------- the body ---------- */
const TOR = {R0:[-152, -6], T1:[-126, -48], T2:[-72, -74], T3:[-20, -84], T4:[60, -88], T5:[130, -90], T6:[180, -74], T7:[206, -38], F1:[206, 16], F2:[188, 64], F3:[142, 100], D4:[60, 112], D3:[-20, 106], D2:[-82, 88], D1:[-130, 54]};
const TP = Object.fromEntries(Object.entries(TOR).map(([k, [a, b]]) => [k, B(a, b)])), mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
{ const cells = K.smoothCells([[TP.R0, TP.T1, TP.T2, TP.T3, mid(TP.T3, TP.D3), TP.D3, TP.D2, TP.D1], [TP.T3, TP.T4, mid(TP.T4, TP.D4), TP.D4, TP.D3, mid(TP.T3, TP.D3)], [TP.T4, TP.T5, TP.T6, TP.T7, TP.F1, TP.F2, TP.F3, TP.D4, mid(TP.T4, TP.D4)]], 2);
  ['torsoC', 'torsoB', 'torsoA'].forEach((nm, i) => M.zone(nm, cells[i], {layer:5, tier:'L', ptier:'M', h:38, bind:{chain:['pelvis', 'body', 'chest'], sigma:60}, tags:['torso'], line:LN.region, tone:.1}));
}
/* breast feathers: tiers of overlapping contour feathers over the chest and belly, lying down and back. Drawn belly first, so each tier laps over the one below it,
   and each tier a step lighter than the one under it, so the overlap reads. */
{ const outline = chaikin(Object.values(TP), 2), list = [];
  for(let r = 0, a = -34; a < 206; a += 30, r++) for(let b = -70 + (r % 2) * 14; b < 112; b += 28){
    const p = B(a, b); if(!K.pip(outline, p[0], p[1]) || K.edgeDist(outline, p[0], p[1]) < 5) continue;
    const beta = rad(18 + 52 * fSmooth(0, 190, a) + 14 * fSmooth(10, 100, b)), h = K.hash(Math.round(a * 7 + b * 13));
    list.push({bone:'chest', pts:LEAF(p, bdir(beta) + (h - .5) * .25, 58 + 8 * h, 19), tier:TM, tone:.08 + .022 * r + .05 * fSmooth(40, -80, b)});
  }
  leaves('breast', list, {layer:5.6, tags:['feathers', 'plumage'], tone:.1, ptier:'M'});
}
/* the double eagle's breast: symmetric tiers of scale feathers about the body's axis, drawn over the profile breast while the body is frontal (the `frontal` muscle shows them) */
const B0 = 12;   // the body's centre line, in b
{ const list = [];
  for(let r = 5; r >= 0; r--) for(let i = 0; i <= r + 1; i++){
    const a = 176 - 34 * r, n = r + 2, b = B0 + (i - (n - 1) / 2) * 31, out = (b - B0) * .0042, h = K.hash(r * 9 + i);
    const dir = Math.atan2(-U[1] * Math.cos(out) + V[1] * Math.sin(out), -U[0] * Math.cos(out) + V[0] * Math.sin(out));
    list.push({bone:'chest', pts:LEAF(B(a, b), dir, 54 + 6 * h, 20), tier:TM, tone:.07 + .02 * (5 - r) + .03 * h});
  }
  leaves('breastFront', list, {layer:5.8, tags:['feathers', 'plumage', 'frontal'], tone:.12, show:'frontal'});
}
/* the gilded roundel on the double eagle's breast and the halo behind its heads: anatomy of the emblem, shown with the frontal body */
{ const G = {tier:'F', ptier:'F', ink:'gold', zone:'glyph', line:'glyph', tj:0, bind:{rigid:'chest'}, tags:['glyph', 'frontal'], show:'frontal'};
  M.polar('emblemRing', B(78, B0), [26, 33, 38], [18, 18, 18], {...G, layer:5.9, tone:.92});
  M.polar('emblemCore', B(78, B0), [0, 12, 19], [6, 12], {...G, layer:5.9, tone:.5, twist:.3});
  /* the sun behind the heads: it comes down from the top right, out of frame, as the wings open (the `sun` bone slides it, the `sun` muscle shows it) */
  const SG = {...G, bind:{rigid:'sun'}, tags:['glyph', 'free', 'sun'], show:'sun'};
  M.polar('haloRing', B(372, B0), [76, 84], [36, 36], {...SG, layer:4.9, tone:.86});
  M.polar('haloDisc', B(372, B0), [0, 40, 76], [8, 18], {...SG, layer:4.85, tone:.2, twist:.2});
  { const P = M.part('haloRays', {layer:4.9, tags:['glyph', 'free', 'sun'], tier:'F', ptier:'F', ink:'gold', zone:'glyph', line:'glyph', tj:0, bind:{rigid:'sun'}, tone:.9, show:'sun'}), c = B(372, B0);
    for(let j = 0; j < 24; j++){ const aa = j * Math.PI / 12, w = .07, r0 = 92, r1 = j % 2 ? 106 : 124, p = (an, r) => M.vtx(P, c[0] + Math.cos(an) * r, c[1] + Math.sin(an) * r); M.poly(P, [p(aa - w, r0), p(aa + w, r0), p(aa, r1)]); }
    M.close(P); }
}
/* the necks: a short thick column under each head, the nape feathers (the hackles) over it. L is the mirror, the twin that grows in the double eagle. */
const NECK_ST = [[568, 322, 64, 68], [582, 284, 56, 60], [602, 252, 48, 52], [626, 232, 42, 44]];
for(const s of SIDES){
  const m = MS(s), twin = s === 'L';
  M.limb('neck' + s, NECK_ST.map(([x, y, a, b]) => { const q = m([x, y]); return s === 'R' ? [q[0], q[1], a, b] : [q[0], q[1], b, a]; }), {layer:5.3, tier:'M', h:24, bind:{chain:['chest', 'neck1' + s, 'neck2' + s, 'head' + s], sigma:26}, tags:['neck', s, ...(twin ? ['twin'] : [])], line:LN.region, tone:.08, show:twin ? 'twinHead' : undefined});
  const NAPE = m(H(-4, -12)), list = [];
  for(const [row, n, L0, w] of [[0, 8, 100, 17], [1, 7, 86, 15], [2, 6, 70, 13]]) for(let i = 0; i < n; i++){
    const u = i / (n - 1), p = m([lerp(H(-4, -12)[0] - 4 - row * 5, H(-4, -12)[0] - 62 + row * 24, u), lerp(H(-4, -12)[1] + 2 + row * 10, H(-4, -12)[1] + 80 + row * 8, u)]), ang = rad(118 + 22 * u - row * 6 + 6 * K.hash(i + row * 9));
    const lf = LEAF([lerp(H(-4, -12)[0] - 4 - row * 5, H(-4, -12)[0] - 62 + row * 24, u), lerp(H(-4, -12)[1] + 2 + row * 10, H(-4, -12)[1] + 80 + row * 8, u)], ang, L0 * (.9 + .2 * K.hash(i + row * 9)) * (1 - .2 * u), w);
    list.push({bone:'hackle' + s, pts:mapLeaf(lf, m), tier:TM, tone:.12 + .08 * row + .05 * u});
  }
  const P = leaves('hackles' + s, list, {layer:8, tags:['feathers', 'plumage', 'hackle', 'head', s, ...(twin ? ['twin'] : [])], tone:.16, ptier:'M', show:twin ? 'twinHead' : undefined});
  P.bind = (x, y) => { const d = Math.hypot(x - NAPE[0], y - NAPE[1]), wh = 1 - fSmooth(0, 44, d), wk = fSmooth(16, 80, d); return [['head' + s, wh + .001], ['hackle' + s, wk * (1 - wh) + .001], ['neck2' + s, (1 - wk) * (1 - wh) + .001]]; };
}

/* ---------- the head, in profile: the brow and the beak read first ---------- */
const HEADLX = (x, y) => { const q = [x - HJ[0], y - HJ[1]], c = Math.cos(-HR), s = Math.sin(-HR); return [(q[0] * c - q[1] * s) / HS, (q[0] * s + q[1] * c) / HS]; };
function buildHead(s){
  const m = MS(s), twin = s === 'L', hp = pts => pts.map(([x, y]) => m(H(x, y))), lx = (x, y) => HEADLX(...m([x, y])), sh = twin ? 'twinHead' : undefined;
  const HD = {bind:{rigid:'head' + s}, yaw:!twin, tags:['head', s, ...(twin ? ['twin'] : [])], show:sh}, T = (...t) => [...HD.tags, ...t];
  const EY = [68, -12], EYW = m(H(...EY));
  const skull = chaikin(hp([[-10, -2], [8, -26], [34, -40], [68, -46], [96, -42], [110, -36], [114, 0], [112, 22], [92, 26], [70, 32], [46, 44], [20, 56], [-4, 54], [-14, 38]]), 1);
  M.zone('skull' + s, skull, {...HD, layer:9, tier:'M', ptier:'M', h:22, zone:'face', line:LN.contour, tags:T('skull'), z:() => 0, tone:.07});
  /* the face's feathering: small contour feathers lying back over the crown and the cheek, a tier per row, clear of the eye */
  { const list = [];
    for(let r = 0; r < 4; r++) for(let i = 0; i < 6; i++){
      const x = 14 + i * 15 + (r % 2) * 7, y = -36 + r * 16, ex = Math.hypot((x - EY[0]) / 34, (y - EY[1]) / 27); if(ex < 1 || x > 100 || (y > 22 && x > 52) || x < 6) continue;
      const h = K.hash(r * 11 + i * 7 + (twin ? 5 : 0)), lf = LEAF(H(x, y), HR + Math.PI + (h - .5) * .5 + .12 * r, 24 * HS, 7.5 * HS);
      list.push({bone:'head' + s, pts:mapLeaf(lf, m), tier:TF, tone:.1 + .03 * r});
    }
    leaves('faceFeathers' + s, list, {layer:9.2, tags:T('feathers', 'face'), tone:.12, zone:'face', ptier:'F', yaw:!twin, z:() => 6, show:sh}); }
  M.zone('cavity' + s, hp([[98, 22], [124, 20], [150, 21], [168, 26], [166, 34], [146, 38], [120, 42], [96, 42], [88, 32]]), {...HD, layer:9.4, tier:'F', ptier:'F', h:10, zone:'mouth', line:'mouth', tags:T('mouth'), z:() => -10, tone:0, flush:1});
  M.zone('tongue' + s, hp([[102, 34], [126, 32], [146, 35], [152, 39], [130, 42], [104, 42]]), {bind:{mix:[['jaw' + s, .85], ['head' + s, .15]]}, yaw:!twin, tags:T('mouth', 'tongue'), show:sh, layer:9.5, tier:'F', ptier:'F', h:8, zone:'mouth', line:'mouth', z:() => -6, tone:.1, flush:.6});
  M.zone('jaw' + s, chaikin(hp([[46, 30], [72, 25], [100, 24], [124, 24], [146, 26], [160, 31], [164, 36], [156, 41], [136, 44], [110, 49], [84, 55], [58, 59], [40, 54], [30, 45]]), 1), {...HD, bind:{rigid:'jaw' + s}, layer:10, tier:'F', ptier:'F', h:10, zone:'mouth', line:LN.feature, tags:T('jaw'), z:() => 6,
    tone:(x, y) => { const [u, v] = lx(x, y); return v < 28 + .02 * Math.max(0, u - 100) ? .8 : .3 + .2 * fSmooth(110, 175, u); }});
  M.zone('beakU' + s, chaikin(hp([[104, -36], [130, -34], [160, -26], [182, -8], [194, 16], [199, 52], [190, 47], [182, 34], [170, 26], [150, 24], [126, 25], [104, 24]]), 1), {...HD, layer:10.5, tier:'F', ptier:'F', h:9, zone:'beak', line:LN.feature, tags:T('beak', 'cere'), z:() => 12,
    tone:(x, y) => { const [u, v] = lx(x, y); return u < 144 ? .42 : .5 + .3 * fSmooth(150, 196, u) + (v > 20 ? .15 : 0); }});
  M.shape('nostril' + s, hp([[124, -22], [138, -24], [141, -14], [128, -10]]), {...HD, layer:10.8, tier:'F', zone:'beak', line:LN.feature, tags:T('beak'), z:() => 18, tone:1, split:true});
  M.polar('eyeRing' + s, EYW, [13 * HS, 19 * HS], [14, 14], {...HD, layer:10.2, tier:'F', ptier:'F', zone:'eyes', line:LN.feature, tags:T('eye'), z:() => 20, tone:.3, a0:.2});
  M.polar('iris' + s, EYW, [0, 6.5 * HS, 13 * HS], [6, 12], {...HD, layer:10.4, tier:'F', ptier:'F', zone:'eyes', ink:'accent', line:LN.feature, tags:T('eye'), z:() => 22, tone:(x, y) => .74 + .26 * fSmooth(4, 11, Math.hypot(x - EYW[0], y - EYW[1])), twist:.2});
  M.shape('pupil' + s, ringPts(EYW, 6.5 * HS, 10), {...HD, layer:10.6, tier:'F', zone:'eyes', line:{k:.12, c:.2, r:0}, tags:T('eye', 'pupil'), z:() => 24, tone:0});
  M.shape('lidL' + s, hp([[52, 7], [68, 4], [84, 7], [88, 13], [68, 17], [54, 13]]), {...HD, layer:10.7, tier:'F', zone:'brows', line:LN.feature, tags:T('lid', 'lidL'), z:() => 24, tone:.42});
  M.shape('lidU' + s, hp([[40, -52], [68, -60], [100, -52], [104, -36], [94, -26], [68, -28], [46, -26], [38, -36]]), {...HD, layer:10.8, tier:'F', zone:'brows', line:LN.feature, tags:T('lid', 'lidU'), z:() => 26, tone:.5});
  M.shape('memb' + s, hp([[84, -24], [90, -20], [90, 0], [84, 4]]), {...HD, layer:10.9, tier:'F', zone:'eyes', line:LN.feature, tags:T('memb'), z:() => 28, tone:.34});
  /* the brow ridge: the supraorbital shelf that gives an eagle its stern look, a heavy overhang (a tier of its own) with a second, lighter row of small feathers along its front */
  M.zone('brow' + s, hp([[30, -46], [62, -58], [96, -54], [116, -38], [108, -26], [80, -31], [60, -29], [40, -27], [24, -33]]), {...HD, layer:11, tier:'F', ptier:'F', h:8, zone:'brows', line:LN.feature, tags:T('brow'), z:() => 26, tone:.5});
}
for(const s of SIDES) buildHead(s);

/* ---------- the legs: feathered trousers and boots, bare toes and talons ---------- */
let FOOT = null;   // the near foot's toes, as M.digits made them (the muscles, the grip's lock and the flight's curl read it)
for(const side of ['N', 'F']){
  const far = side === 'F', f = far ? FAR.leg : [0, 0], J = LEGJ.map(p => add(p, f)), T = J[3], base = far ? {dim:true, line:FARL, layer:1.4} : {line:LN.region}, tg = far ? ['F'] : [], mv = pts => pts.map(p => add(p, f));
  const trou = chaikin(mv([[486, 486], [518, 480], [556, 494], [580, 530], [574, 576], [556, 616], [540, 646], [518, 656], [498, 644], [490, 610], [478, 560], [474, 520]]), 1);
  M.zone('thigh' + side, trou, {...base, layer:far ? 1.4 : 5.5, tier:'M', ptier:'M', h:far ? 34 : 24, bind:{chain:['fem' + side, 'tib' + side], sigma:24}, tags:['leg', 'thigh', ...tg], zone:'skin', tone:.07});
  if(!far) leaves('trouser' + side, [0, 1, 2, 3, 4, 5].map(i => ({bone:'tib' + side, pts:LEAF([474 + i * 3.4 + f[0], 548 + i * 17 + f[1]], rad(100 + i * 3), 52 - i * 3, 12), tier:TM, tone:.1 + .02 * i})), {layer:5.55, tags:['feathers', 'plumage', 'leg'], tone:.1});
  M.limb('boot' + side, [[J[2][0], J[2][1], 21, 21], [T[0] - 1, T[1] - 14, 16, 17], [T[0], T[1] + 2, 14, 15]], {...base, layer:far ? 1.4 : 5.6, tier:'M', h:far ? 30 : 18, bind:{rigid:'tars' + side}, tags:['leg', 'boot', ...tg], zone:'skin', tone:.07});
  M.polar('ankle' + side, J[2], [0, 12, 22], [6, 10], {layer:far ? 1.45 : 5.7, tier:'F', dim:far, line:far ? FARL : 'dim', bind:{rigid:'tars' + side}, tags:['leg', 'ankle', ...tg], zone:'skin', twist:.2, tone:.07});
  M.polar('toeBase' + side, [T[0] + 4, T[1] + 4], [0, 9, 17], [6, 10], {layer:far ? 1.45 : 5.7, tier:'F', dim:far, line:far ? FARL : LN.feature, bind:{rigid:'tars' + side}, tags:['leg', 'foot', ...tg], zone:'paws', tone:.2});
  /* the four toes (anatomy audit, round 5): II, III and IV forward with 3, 4 and 5 phalanges, the claw counted (the ungual is its own bone, so a talon bends at its own joint), and the hallux I behind with 2,
     the longest talon. In profile the toes lie nearly along one line: II a little up and back (the inner toe, farther from us), IV a little down and forward (the outer toe, nearer), so they read as separate toes */
  const digs = M.digits('foot', {parent:'tars' + side, at:T, side, layer:far ? 1.46 : 5.72, dim:far, line:far ? FARL : LN.feature, tags:tg, grp:'legs', toes:[
    {id:'II', dir:.11, off:[0, -3], phal:[28, 22], claw:38, w:8},
    {id:'III', dir:.17, off:[0, 1], phal:[26, 20, 16], claw:34, w:8},
    {id:'IV', dir:.24, off:[0, 4], phal:[14, 12, 11, 10], claw:30, w:7},
    {id:'I', dir:Math.PI - .22, off:[-2, 2], phal:[28], claw:44, w:8}]});
  if(!far) FOOT = digs;
}

/* ---------- the glyph: a gilded inlay down the leading edge of each wing and along every primary's shaft, along the necks and crowns and down the tail; the light climbs the wing in
   profile and, in the double eagle, runs the emblem's outline: tail, left wing, both heads, right wing, tail ---------- */
{ const G = {tier:'F', ptier:'F', ink:'gold', zone:'glyph', line:'glyph', tone:.92, tj:0};
  for(const side of ['N', 'F']){
    const g = WG[side], far = side === 'F', tg = ['glyph', 'wing', ...(far ? ['F'] : [])], lay = far ? 1.3 : 6, lb = far ? .6 : 0;
    for(let k = 0; k < PRI; k++){
      const f = g.pri[k], t = [Math.cos(f.ang), Math.sin(f.ang)], st = [.1, .22, .36, .5, .64, .78, .9].map(u => [f.p[0] + t[0] * f.L * u, f.p[1] + t[1] * f.L * u, 2.2 - 1.1 * u]);
      const bind = (x, y) => { const u = clamp(((x - f.p[0]) * t[0] + (y - f.p[1]) * t[1]) / f.L), q = fSmooth(TIPU - .1, TIPU + .26, u); return [['priT' + k + side, q + 1e-3], ['pri' + k + side, 1 - q + 1e-3]]; };
      M.strip('glyphPri' + k + side, st, {...G, layer:(far ? 1.3 : 6) + (9 - k) * .01 + .004, bind, tags:tg});
    }
    const bar = (nm, bone, a, b, hw, lay_) => M.strip(nm, [0, .25, .5, .75, 1].map(u => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), hw]), {...G, layer:lay_, bind:{rigid:bone}, tags:tg});
    const ly = far ? 1.2 : 6.575;
    bar('glyphHum' + side, 'hum' + side, lerp2(g.S, g.E, .18), lerp2(g.S, g.E, .9), 2.6, ly);
    bar('glyphUln' + side, 'uln' + side, lerp2(g.E, g.W, .16), lerp2(g.E, g.W, .9), 2.6, ly);
    bar('glyphHand' + side, 'hand' + side, lerp2(g.W, g.H, .12), lerp2(g.W, g.H, .96), 2.2, ly);
    M.polar('glyphElbow' + side, g.E, [15, 19.5], [12, 12], {...G, layer:far ? 1.21 : 6.59, bind:{rigid:'uln' + side}, tags:tg});
    M.polar('glyphWrist' + side, g.W, [15, 19.5], [12, 12], {...G, layer:far ? 1.22 : 6.62, bind:{rigid:'hand' + side}, tags:tg});
  }
  for(const s of SIDES){   // a gilded line along each head's crown and down its neck
    const m = MS(s), twin = s === 'L';
    M.strip('glyphHead' + s, [[8, -40], [36, -52], [70, -58], [100, -52], [122, -36]].map(([x, y]) => { const p = m(H(x, y)); return [p[0], p[1], 2.6 - .005 * x]; }), {...G, layer:11.1, bind:{rigid:'head' + s}, yaw:!twin, tags:['glyph', 'head', s, ...(twin ? ['twin'] : [])], show:twin ? 'twinHead' : undefined});
    M.strip('glyphNeck' + s, [N0, [584, 272], [602, 246], H(0, 10)].map(p => { const q = m(p); return [q[0], q[1], 3]; }), {...G, layer:5.35, bind:{chain:['chest', 'neck1' + s, 'neck2' + s, 'head' + s], sigma:26}, tags:['glyph', 'neck', s, ...(twin ? ['twin'] : [])], show:twin ? 'twinHead' : undefined});
  }
  for(const k of [2, 3, 4, 5, 6, 7, 8, 9]){   // down the middle rectrices
    const b = M.bones[M.BI['rec' + k]], t = [Math.cos(REST['rec' + k]), Math.sin(REST['rec' + k])], L = Math.hypot(b.q[0] - b.p[0], b.q[1] - b.p[1]);
    M.strip('glyphRec' + k, [.14, .3, .46, .62, .78].map(u => [b.p[0] + t[0] * L * u, b.p[1] + t[1] * L * u, 2.2 - 1.2 * u]), {...G, layer:3.1 + Math.abs(k - 5.5) * -.01 + .01, bind:{rigid:'rec' + k}, tags:['glyph', 'tail']});
  }
}

/* ---------- muscles: real names, each turning the joints it really turns. The head's are paired L and R: the R instance is the head of the profile, the L instance
   works the mirror head (the double eagle's second head) through the model's mirror line. ---------- */
const HV = (x, y) => [(x * Math.cos(HR) - y * Math.sin(HR)) * HS, (x * Math.sin(HR) + y * Math.cos(HR)) * HS];   // a head-local vector in the world
const EYW = H(66, -12);
const glow = (c, rx, ry, a = .5) => K.glow(c[0], c[1], rx, ry, a);
const hm = (id, d) => M.muscle(id, {pair:'LR', ...d});
hm('depressor', {name:'depressor mandibulae', g:'jaw', c:H(46, 38), r:[34, 26], on:['jaw', 'head'], jt:[['jaw$', .56]], hue:'#e3806f', speed:13, shade:glow(H(46, 38), 26, 20, .55)});
hm('adductor', {name:'adductor mandibulae', g:'jaw', c:H(66, 8), r:[34, 30], on:['skull'], v:HV(0, -2.5), jt:[['jaw$', -.04]], hue:'#a09080', speed:11, shade:glow(H(66, 8), 28, 24, .45)});
hm('tongue', {name:'tongue (hyoid)', g:'jaw', c:H(130, 34), r:[60, 40], on:['tongue'], v:HV(16, -3), hue:'#d985a6', speed:9});
hm('lidDown', {name:'orbicularis oculi (upper lid)', g:'eye', c:H(70, -36), r:[80, 60], on:['lidU'], v:HV(0, 27), hue:'#c79ae0', speed:20});
hm('lidUp', {name:'orbicularis oculi (lower lid)', g:'eye', c:H(70, 10), r:[80, 60], on:['lidL'], v:HV(0, -11), hue:'#9aa6d8', speed:20});
hm('nictitans', {name:'pyramidalis (nictitating membrane)', g:'eye', c:H(86, -8), r:[80, 80], on:['memb'], v:HV(-32, 0), hue:'#7ec3e6', speed:24});
hm('corrugator', {name:'corrugator (the glare)', g:'brow', c:H(72, -40), r:[70, 40], on:['brow', 'lidU'], v:HV(4, 8), hue:'#e3806f', speed:12, shade:glow(H(72, -40), 36, 18, .5)});
hm('frontalis', {name:'frontalis (brow lift)', g:'brow', c:H(72, -40), r:[70, 40], on:['brow', 'lidU'], v:HV(-2, -10), hue:'#5cc6b4', speed:12});
hm('pupilCon', {name:'iris sphincter', g:'eye', c:EYW, r:[40, 40], on:['pupil'], pull:[.5, .5], hue:'#ffbe00', speed:14});
hm('pupilDil', {name:'iris dilator', g:'eye', c:EYW, r:[40, 40], on:['pupil'], pull:[-.34, -.34], hue:'#c79ae0', speed:14});
M.muscle('turnA', {name:'splenius (turn away)', g:'neck', jt:[['head', .55, 'yaw']], hue:'#9aa6d8', speed:6});
M.muscle('turnT', {name:'splenius (turn toward)', g:'neck', jt:[['head', -.55, 'yaw']], hue:'#9aa6d8', speed:6});
hm('neckExt', {name:'neck extensors', g:'neck', c:[596, 262], r:[46, 70], on:['neck'], v:[-3, -2], jt:[['neck1$', -.34], ['neck2$', -.26], ['head$', .3]], hue:'#7ec3e6', speed:6, shade:glow([596, 262], 36, 52, .4)});
hm('neckFlex', {name:'longus colli', g:'neck', c:[604, 258], r:[46, 70], on:['neck'], v:[3, 2], jt:[['neck1$', .4], ['neck2$', .32], ['head$', -.3]], hue:'#ffbe00', speed:6});
hm('headUp', {name:'rectus capitis dorsalis', g:'neck', c:H(8, -4), r:[40, 40], on:['skull'], jt:[['head$', -.5]], hue:'#5cc6b4', speed:11});
hm('headDown', {name:'rectus capitis ventralis', g:'neck', c:H(8, 30), r:[40, 40], on:['skull'], jt:[['head$', .5]], hue:'#d985a6', speed:11});
hm('hackleUp', {name:'hackle erector', g:'plumage', c:H(-10, 0), r:[80, 80], on:['hackle'], pull:[-.2, -.2], jt:[['hackle$', -.55]], hue:'#e3806f', speed:7, shade:glow(H(-10, 20), 40, 40, .35)});
/* what the figure's own state drives (no fields: they show parts): the second head, the frontal breast and its emblem, the far eye */
M.muscle('twinHead', {name:'(the second head)', g:'emblem', hue:'#d4a03c', speed:7});
M.muscle('frontal', {name:'(the frontal body)', g:'emblem', hue:'#d4a03c', speed:7});
M.muscle('sun', {name:'(the sun)', g:'emblem', hue:'#d4a03c', speed:7});
/* the trunk and the plumage */
M.muscle('epaxial', {name:'epaxial', g:'trunk', c:B(10, -80), r:[160, 40], on:['torso'], v:[V[0] * -3, V[1] * -3], jt:[['chest', -.1], ['pelvis', .1]], hue:'#9aa6d8', speed:5, shade:glow(B(10, -80), 120, 26, .35)});
M.muscle('hypaxial', {name:'hypaxial', g:'trunk', c:B(10, 90), r:[160, 40], on:['torso'], v:[V[0] * 3, V[1] * 3], jt:[['chest', .1], ['pelvis', -.1]], hue:'#ffbe00', speed:5, shade:glow(B(10, 90), 120, 26, .35)});
M.muscle('keel', {name:'sternal breathing', g:'trunk', c:B(120, 30), r:[80, 80], on:['torso', 'breast'], v:[V[0] * 4.5, V[1] * 4.5], hue:'#d985a6', speed:4, shade:glow(B(120, 30), 60, 60, .3)});
M.muscle('erector', {name:'contour feather erector', g:'plumage', c:O, r:[300, 300], on:['plumage'], pull:[-.1, -.1], hue:'#e3806f', speed:6, shade:glow(O, 140, 160, .28)});

/* ---------- the wing's pose maths ----------
   T names where the bones point, in the REST frame of the body (the body's long axis at -38 degrees): hum, uln and hand are absolute directions in degrees, and for each
   group of feathers [first, last] is the angle of the first and last feather relative to the bone it grows from (the others between). wingJt works the joint rotations out
   from the rest geometry. The elbow and the wrist are hinges (they go through straight, never the long way round); the shoulder takes the short way. */
const FEATHERS = {pri:[PRI, 'hand'], sec:[SEC, 'uln'], ter:[TER, 'hum']};
function wingJt(side, T){
  const o = {}, hAbs = rad(T.hum), uAbs = rad(T.uln), dAbs = rad(T.hand);
  o['hum' + side] = wrap(hAbs - REST['hum' + side]);
  o['uln' + side] = wrap(uAbs - hAbs) - wrap(REST['uln' + side] - REST['hum' + side]);
  o['hand' + side] = wrap(dAbs - uAbs) - wrap(REST['hand' + side] - REST['uln' + side]);
  for(const [key, [n, host]] of Object.entries(FEATHERS)){
    const sg = T[key]; if(!sg) continue;
    for(let k = 0; k < n; k++){ const sig = lerp(sg[0], sg[1], n > 1 ? k / (n - 1) : 0), rest = wrap(REST[key + k + side] - REST[host + side]); o[key + k + side] = wrap(rad(sig) - rest); }
  }
  if(T.alu) for(let k = 0; k < ALU; k++){ const sig = lerp(T.alu[0], T.alu[1], k / (ALU - 1)), rest = wrap(REST['alu' + k + side] - REST['hand' + side]); o['alu' + k + side] = wrap(rad(sig) - rest); }
  return o;
}
/* the change in joint angles between two poses of the same wing, with no wrapping (a difference of two wrapped angles jumps by a turn when a feather's angle crosses the wrap: the flap needs the continuous one) */
function wingDelta(side, TA_, TG_){
  const o = {}, r = rad;
  o['hum' + side] = r(TA_.hum - TG_.hum); o['uln' + side] = r((TA_.uln - TA_.hum) - (TG_.uln - TG_.hum)); o['hand' + side] = r((TA_.hand - TA_.uln) - (TG_.hand - TG_.uln));
  for(const [key, [n]] of Object.entries(FEATHERS)) for(let k = 0; k < n; k++){ const f = k / (n - 1); o[key + k + side] = r(lerp(TA_[key][0], TA_[key][1], f) - lerp(TG_[key][0], TG_[key][1], f)); }
  // the alula is raised by its own muscle (aluRaise), not by the pose delta
  return o;
}
/* the tail: spread is the angle between neighbouring feathers (radians), lift turns the whole tail about its base */
const tailJt = (spread, lift = 0) => { const o = {tail:lift}; for(let k = 0; k < NREC; k++) o['rec' + k] = (k - 5.5) * spread; return o; };
const restRel = (key, k) => deg(wrap(REST[key + k + 'N'] - REST[FEATHERS[key][1] + 'N']));
const RR = {priA:restRel('pri', 0), priB:restRel('pri', PRI - 1), secA:restRel('sec', 0), secB:restRel('sec', SEC - 1), terA:restRel('ter', 0), terB:restRel('ter', TER - 1), alu:deg(wrap(REST.alu0N - REST.handN))};
const UPA = -128;   // the body's "up" in the rest frame: perpendicular to its axis, the direction a raised wing points
/* A wing pose P = {s, sig, e, h, sep, tw, al}: s the wing plane's squash across the body (1 face-on and raised, 0 edge-on, negative below), sig the arm's sweep forward (degrees, from
   straight up), e and h the flexion of the elbow and of the wrist (0 extended, 1 folded), sep how far the primaries separate, tw their twist, al the alula raised. poseT gives the bones'
   directions. */
/* a feather's target angle on the short way round from its rest angle (the same turn the posture's joint takes, and continuous through the whole cycle) */
const nearTo = (restDeg, target) => restDeg + deg(wrap(rad(target - restDeg)));
function poseT(P){
  const hum = UPA + P.sig, uln = hum + 6 - 150 * P.e, hand = uln - 10 + 140 * P.h;
  const open = 1 - P.h * (1 - Math.min(1, P.sep)), o2 = 1 - .85 * P.e;
  const fan = (restA, restB, a, b, u) => [lerp(restA, nearTo(restA, a), u), lerp(restB, nearTo(restB, b), u)];
  return {hum, uln, hand, pri:fan(RR.priA, RR.priB, -34 - 22 * P.sep, 6 + 12 * P.sep, open), sec:fan(RR.secA, RR.secB, -78, -104, o2), ter:fan(RR.terA, RR.terB, -76, -98, o2), alu:fan(RR.alu, RR.alu, 50, 72, P.al)};
}
const mixP = (A, B_, u) => { const o = {}; for(const k in A) o[k] = lerp(A[k], B_[k], u); return o; };
const GLIDE = {s:.5, sig:-26, e:0, h:0, sep:.9, tw:0, al:.2};          // gliding and soaring: the wings out and raised, the primaries fingered
const MANTLEP = {s:-.72, sig:40, e:.2, h:.25, sep:.3, tw:0, al:0};   // mantling: the wings spread forward and down over the prey
const LANDP = {s:.55, sig:38, e:0, h:0, sep:.8, tw:0, al:1};           // landing: the wings cupped forward to brake, the alula up
/* the double eagle: the wings in world angles (the left wing; the right is its mirror), converted into the rest frame once the body's turn is known */
const RRD = -.91;
const DISP_W = {hum:-150, uln:-128, hand:-104, pri:[-30, 24], sec:[-72, -102], ter:[-74, -98], alu:[50, 72]};
const dispT = () => ({...DISP_W, hum:DISP_W.hum - deg(RRD), uln:DISP_W.uln - deg(RRD), hand:DISP_W.hand - deg(RRD)});
/* the cycle's samples (eight round, periodic Catmull-Rom): u = 0 the top of the stroke, .5 the bottom. The downstroke is the power stroke: the wing extended, swept forward,
   its plane tilting from raised through level (edge-on) to below; the upstroke: the wrist leads, the wing half folds and is drawn up and back, the primaries separate and twist. */
const cyc = (v, u) => { const n = v.length; u = ((u % 1) + 1) % 1; const x = u * n, i = Math.floor(x), t = x - i, p0 = v[(i + n - 1) % n], p1 = v[i % n], p2 = v[(i + 1) % n], p3 = v[(i + 2) % n]; return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); };
const CY = {s:[.96, .8, .22, -.24, -.44, -.1, .42, .84], sig:[-8, 0, 8, 16, 16, 4, -10, -16], e:[0, 0, 0, .03, .1, .34, .5, .3], h:[0, 0, .02, .06, .18, .5, .6, .3], sep:[.15, .15, .2, .2, .35, .9, .9, .5], tw:[0, 0, 0, 0, .1, .6, .85, .4], al:[.3, .7, 1, 1, .6, 0, 0, .1]};
const LAGS = {s:0, sig:.03, e:.06, h:.12, sep:.16, tw:.18, al:0};
function flapPose(u, tk = 0){
  const P = {}; for(const k in CY) P[k] = cyc(CY[k], u - LAGS[k]);
  P.e = clamp(P.e, 0, 1); P.h = clamp(P.h, 0, 1); P.sep = clamp(P.sep, 0, 1.1); P.tw = clamp(P.tw, 0, 1); P.al = clamp(P.al, 0, 1);
  P.s -= .2 * tk * (1 - fSmooth(.25, .85, P.s)); P.sig += 8 * tk;   // take-off: deeper, lower beats
  return P;
}

/* the wing: raisers and lowerers of the humerus, the coupled elbow and wrist, the feather spreaders */
const FAN = {pri:[-52, 6], sec:[-80, -104], ter:[-78, -98], alu:[55, 75]};
const fanGains = (key, sg) => { const n = FEATHERS[key][0], host = FEATHERS[key][1]; return Array.from({length:n}, (_, k) => [key + k + '$', wrap(rad(lerp(sg[0], sg[1], k / (n - 1))) - wrap(REST[key + k + 'N'] - REST[host + 'N']))]); };
{ const g = WG.N, wf = (id, name, jt, c, r, hue, on, sh = .42, o = {}) => M.muscle(id, {name, g:'wing', pair:'NF', c, r, on, jt, hue, speed:9, shade:glow(c, r[0] * .8, r[1] * .8, sh), ...o});
  wf('supracoracoideus', 'supracoracoideus (upstroke)', [['hum$', 1.85]], g.S, [70, 60], '#7ec3e6', ['arm', 'covert']);
  wf('pectoralis', 'pectoralis (downstroke)', [['hum$', -1.0]], B(130, 10), [70, 60], '#e3806f', ['arm', 'covert']);
  wf('triceps', 'triceps (extends the elbow and the wrist)', [['uln$', 2.83], ['hand$', -2.46]], lerp2(g.E, g.W, .5), [60, 40], '#5cc6b4', ['arm', 'covert']);
  wf('biceps', 'biceps (flexes the elbow)', [['uln$', -.7], ['hand$', .45]], lerp2(g.E, g.W, .5), [60, 40], '#ffbe00', ['arm', 'covert']);
  wf('extMeta', 'extensor metacarpi (the wrist)', [['hand$', -.9]], g.W, [40, 40], '#9aa6d8', ['arm']);
  wf('flexMeta', 'flexor carpi (the wrist)', [['hand$', .7]], g.W, [40, 40], '#d985a6', ['arm']);
  wf('priSpread', 'primary spreaders', fanGains('pri', FAN.pri), lerp2(g.W, g.H, .6), [60, 60], '#c79ae0', ['primary', 'covert'], .38);
  wf('secSpread', 'secondary spreaders', fanGains('sec', FAN.sec), lerp2(g.E, g.W, .5), [60, 50], '#c79ae0', ['secondary', 'covert'], .34);
  wf('terSpread', 'tertial spreaders', fanGains('ter', FAN.ter), lerp2(g.S, g.E, .5), [50, 40], '#c79ae0', ['tertial'], .3);
  wf('aluRaise', 'alula (the thumb)', Array.from({length:ALU}, (_, k) => ['alu' + k + '$', wrap(rad(lerp(FAN.alu[0], FAN.alu[1], k / 2)) - wrap(REST['alu' + k + 'N'] - REST.handN))]), lerp2(g.W, g.H, .1), [30, 30], '#5cc6b4', ['alula'], .3, {speed:12});
}
/* the tail: the fan, and the base's lift and drop */
M.muscle('tailSpread', {name:'tail fan (abductors)', g:'tail', c:at(TB, TA, 100), r:[80, 80], on:['tailfeather'], jt:Array.from({length:NREC}, (_, k) => ['rec' + k, (k - 5.5) * rad(7.5)]), hue:'#c79ae0', speed:9, shade:glow(at(TB, TA, 80), 50, 80, .3)});
M.muscle('tailUp', {name:'levator caudae', g:'tail', c:at(TB, TA, 40), r:[50, 50], on:['tailfeather'], jt:[['tail', .5]], hue:'#7ec3e6', speed:7});
M.muscle('tailDown', {name:'depressor caudae', g:'tail', c:at(TB, TA, 40), r:[50, 50], on:['tailfeather'], jt:[['tail', -.42]], hue:'#ffbe00', speed:7});
/* the legs and the grip */
{ const lg = (id, name, c, jt, hue) => M.muscle(id, {name, g:'leg', pair:'NF', c, r:[26, 44], on:['leg'], jt, hue, speed:10, shade:glow(c, 22, 36, .42)});
  lg('hipFlex', 'iliotibialis (hip flexor)', [540, 520], [['fem$', -.4]], '#c79ae0'); lg('caudofem', 'caudofemoralis (hip extensor)', [488, 520], [['fem$', .4]], '#e3806f');
  lg('quads', 'femorotibialis (knee extensor)', [556, 570], [['tib$', -.5]], '#7ec3e6'); lg('hamstrings', 'flexor cruris (knee flexor)', [496, 580], [['tib$', .5]], '#5cc6b4');
  lg('tibialis', 'tibialis cranialis', [520, 640], [['tars$', -.5]], '#9aa6d8'); lg('gastroc', 'gastrocnemius', [500, 640], [['tars$', .5]], '#ffbe00');
  M.digitMuscles(FOOT, {pair:'NF', g:'toes', far:FAR.leg, flexGain:2.6});   // a flexor and an extensor for every toe, the outer toes' abductors, and the shared flexDig, extDig and abdDig
}

/* ---------- postures ----------
   The folded wing is the rest pose (perched). The others name where the wing bones point (wingJt of a pose). The feet are placed in the world. The wing plane's squash (and
   the far wing's mirror) is not a posture channel: the hook works it out from the posture weights and the body's turn. */
const PV0 = [520, 690];   // the feet: the body turns over them
const carry = (p, r) => { const ct = Math.cos(r[2]), st = Math.sin(r[2]), vx = p[0] - O[0], vy = p[1] - O[1]; return [O[0] + ct * vx - st * vy + r[0], O[1] + st * vx + ct * vy + r[1]]; };
const headJt = (s, A1, A2, A3, rr) => { const r1 = rad(A1), r2 = rad(A2), r3 = rad(A3); return {['neck1' + s]:wrap(r1 - REST['neck1' + s] - rr), ['neck2' + s]:wrap(r2 - r1) - wrap(REST['neck2' + s] - REST['neck1' + s]), ['head' + s]:wrap(r3 - r2) - wrap(REST['head' + s] - REST['neck2' + s])}; };
const wingsOf = (PN, PF = PN) => ({...wingJt('N', poseT(PN)), ...wingJt('F', poseT(PF))});
const X0 = 520, Y0 = 400;
M.posture('perched', {root:[0, 12, 0], slide:{wpF:[0, 0], hipF:[0, 0], neck1R:[0, 0], neck1L:[0, 0], neck2R:[0, 0], neck2L:[0, 0], sun:[0, 0]}, cam:[.92, 495, 470], ground:1});
M.posture('crouch', {root:M.rootV(PV0, .2, 12, 62), jt:{humN:.34, humF:.28, ...tailJt(rad(1.5), -.2), neck1R:.3, neck2R:.24, headR:-.16}, cam:[1, 545, 455], ground:1});
M.posture('mantle', {root:M.rootV(PV0, .38, 6, 40), jt:{...wingsOf(MANTLEP, {...MANTLEP, sig:52, e:.3, h:.34}), ...tailJt(rad(2.5), -.1), neck1R:.14, neck2R:.12, headR:-.02}, cam:[1.24, 625, 462], ground:1});
{ const T = dispT(), rv = [X0 - O[0], Y0 - O[1], RRD], tl = tailJt(rad(7.5), wrap(rad(90) - (REST.tail + RRD)));
  M.posture('displayed', {root:rv, jt:{...wingJt('N', T), ...wingJt('F', T), ...tl, ...headJt('R', -70, -50, -6, RRD), ...headJt('L', -110, -130, -174, RRD)}, feet:[[X0 + 152, 568, rad(62)], [X0 - 128, 568, rad(118)]], cam:[1.5, 520, 318], ground:0}); }
/* flight: the wings in the glide pose (the beat is the hook's, a layer on it); the legs drawn up under the belly, tibiotarsus back, tarsus forward along the belly, the toes curled */
const FLIGHT_RR = .5, FLIGHT_ROOT = [0, -190, FLIGHT_RR];
const tuckFoot = side => { const tip = B(side === 'F' ? 0 : 6, side === 'F' ? 116 : 112), f = carry(tip, FLIGHT_ROOT); return [f[0], f[1], UA + FLIGHT_RR + .2]; };
const TOEW = [.85, 1, 1.05, 1.05, .7];   // how much of a toe's curl each of its phalanges takes: the tip curls most, the claw least
/* a toe curled through `total` radians, shared out along its bones as the flexor does (the bones' names end in the near side's letter: side swaps it) */
const toeCurl = (side, total, o = {}) => { for(const d of Object.values(FOOT)){ const w = d.bones.map((_, i) => TOEW[Math.min(i, TOEW.length - 1)] * (i === d.bones.length - 1 ? .8 : 1)), sm = w.reduce((a, b) => a + b, 0), tt = Math.min(total, 1.15 * d.bones.length); d.bones.forEach((b, i) => { o[b.slice(0, -1) + side] = d.flex * tt * w[i] / sm; }); } return o; };   // the hallux has two bones: it closes through less
{ const curl = side => toeCurl(side, 3.3);
  M.posture('flight', {root:FLIGHT_ROOT, jt:{...wingsOf(GLIDE, {...GLIDE, sig:-22}), ...tailJt(rad(5), .12), ...curl('N'), ...curl('F'), neck1R:-.3, neck2R:-.2, headR:.05}, feet:[tuckFoot('N'), tuckFoot('F')], cam:[1.55, 590, 150], ground:0}); }
/* edges: staged as the anatomy goes. The wing lifts from the shoulder outward (the humerus, then the elbow, then the hand, then the feathers fan) and folds the other way. */
const armSeq = (h, u, d) => { const c = {}; for(const s of ['N', 'F']){ c['j:hum' + s] = h; c['j:uln' + s] = u; c['j:hand' + s] = d; } return c; };
M.edge('perched>displayed', {ms:7000, g:{legs:[1500, 2600], rear:[0, 2200], root:[300, 3600], front:[300, 3000], head:[2300, 3000], wing:[1200, 3400], fan:[2600, 3000], tail:[2800, 2400], cam:[0, 2400]}, c:armSeq([1100, 3400], [1500, 3200], [1900, 3000]), bumps:[['rr', 0, 800, .03]]});
M.edge('perched>mantle', {ms:3800, g:{rear:[0, 1500], root:[0, 1700], front:[150, 1600], legs:[0, 1500], head:[500, 1600], wing:[500, 2300], fan:[1100, 2000], tail:[300, 1700], cam:[0, 1600]}, c:armSeq([500, 1400], [900, 1600], [1300, 1600])});
M.edge('perched>crouch', {ms:1600, g:{root:[0, 1200], front:[0, 1100], rear:[150, 1000], legs:[100, 1100], head:[300, 1100], wing:[250, 1250], fan:[300, 1100], tail:[200, 1200], cam:[0, 1500]}, bumps:[['rr', 0, 500, -.012]]});
M.edge('crouch>flight', {ms:4700, g:{legs:[300, 1900], rear:[0, 1000], root:[300, 1900], front:[350, 1800], head:[400, 1900], wing:[450, 2300], fan:[1500, 2200], tail:[500, 1900], cam:[0, 1400]}, c:armSeq([450, 1500], [1000, 2000], [1400, 1900]), bumps:[['ry', 0, 600, 30]]});
M.edge('perched>flight', {ms:5400, g:{legs:[500, 2000], rear:[0, 1100], root:[500, 2000], front:[550, 1900], head:[600, 2000], wing:[650, 2400], fan:[1700, 2300], tail:[700, 2000], cam:[0, 1500]}, c:armSeq([650, 1600], [1200, 2200], [1700, 2000]), bumps:[['ry', 0, 1100, 38], ['rr', 0, 900, .06]]});
M.edge('flight>perched', {ms:6600, g:{root:[0, 3600], rear:[200, 3100], front:[200, 3100], legs:[0, 3600], head:[300, 3000], tail:[900, 3000], fan:[3300, 2000], cam:[3000, 3500]}, c:armSeq([4300, 1900], [3600, 2100], [3300, 1900])});
M.edge('flight>displayed', {ms:7000, g:{wing:[0, 3700], fan:[400, 3500], root:[1200, 3600], rear:[1300, 2800], front:[1300, 2800], legs:[1100, 3600], head:[2400, 3000], tail:[500, 3200], cam:[900, 4000]}, c:armSeq([0, 3400], [400, 3200], [800, 3000]), bumps:[['cs', 500, 4400, .5], ['cy', 500, 4400, 90]]});
M.edge('flight>crouch', {ms:6600, g:{root:[0, 3600], rear:[200, 3100], front:[200, 3100], legs:[0, 3600], head:[300, 3000], tail:[900, 3000], fan:[3300, 2000], cam:[3000, 3500]}, c:armSeq([4300, 1900], [3600, 2100], [3300, 1900])});
M.edge('displayed>flight', {ms:5600, g:{legs:[200, 2800], rear:[0, 1300], root:[200, 3000], front:[300, 2800], head:[0, 2400], wing:[0, 2800], fan:[400, 2500], tail:[500, 2600], cam:[0, 1500]}, c:armSeq([0, 2600], [300, 2600], [600, 2600]), bumps:[['ry', 0, 800, 36]]});
M.transitCost('flight', 6000);
/* gaits: a walk, and a hop that is an airborne bound (both feet push off together, the body clears the ground on half-open wings and comes down on both feet) */
M.gait('walk', {psi:1, base:'perched', L:64, cyc:1500, duty:.64, lift:[30, 30], off:[0, .5], flex:[.6, .6], hs:[0, 0], bob:4, sink:0, cap:1.7, lead:0});
M.gait('hop', {psi:2, base:'perched', L:120, cyc:1250, duty:.4, lift:[96, 92], off:[0, .02], flex:[1.1, 1.1], hs:[0, 0], bob:0, sink:0, cap:1.4, lead:0});

/* ---------- the figure's own state: the wing plane, the flap, the turn to frontal, the second head ----------
   Run from the idle hook every frame. The body's turn (f, 0 in profile to 1 frontal) is read from the root's rotation channel, so everything that belongs to the turn is staged as the root is. */
const FREQ = 1.25;   // wingbeats a second at cruise
const vec = (a, b) => [a * U[0] + b * V[0], a * U[1] + b * V[1]];
const nv = (p, q, l) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / d * l, (q[1] - p[1]) / d * l]; };
const NECKLEN = 120;   // the double eagle's necks are longer than the profile's: the second neck bone slides out along the first
const SUN_OFF = [1010, -640];   // where the sun waits, out of frame at the top right, as a world offset from where it rests
const SLIDES = {hipF:vec(-26.8, -136.9), wpF:vec(-27.9, 161.5), neck1R:vec(-7, 97), neck1L:vec(-7, 29), neck2R:nv(N0, N1, NECKLEN), neck2L:nv(MX(N0), MX(N1), NECKLEN)};
const newE = () => ({ph:0, k:1, kA:1, kCap:1, kForce:null, w:0, t:0, f:0, dev:0, res:0, gild:1, gildDrawn:-1, tk:0, flightAt:-1, land:0, landF:0, nextBout:0, bout:true, sPrev:1, vs:0, styleC:null, styleW:-1, styleN:0, sparked:false, legsUp:false, mw:0, sm:0, smDrawn:-1, sunU:0, sunT:0, sunOffT:9999, bob:0, lock:[0, 0], fh:[0, 0], td:[-1e9, -1e9], to:[-1e9, -1e9]});
const GLIDE_F = {...GLIDE, sig:-22};
const TG = {N:poseT(GLIDE), F:poseT(GLIDE_F)};
const ssn = x => x * x * (3 - 2 * x);
function figureStep(c, now, dt){
  const E = c.eg || (c.eg = newE());
  if(now < E.t - 1) Object.assign(E, newE());   // the clock went back: the figure was reset
  E.t = now;
  const pw = c.pm.w, tr = c.pm.tr, node = c.pm.node, tmp = c.tempo;
  /* the turn to frontal */
  const f = clamp(-c.root.r / .91, 0, 1), sm = ssn(f); E.f = f; E.sm = sm;
  for(const [b, v] of Object.entries(SLIDES)) c.slide(b, v[0] * sm, v[1] * sm);
  c.scale('tail', 1 - .2 * sm, 1); c.scale('hackleR', 1 - .45 * sm, 1 - .3 * sm); c.scale('hackleL', 1 - .45 * sm, 1 - .3 * sm);
  const mF = 1 - 2 * fSmooth(.3, .8, f);                      // the far wing comes round: across the body's axis, through edge-on
  /* the second head: it exists only in the emblem. It starts to grow, gilded, from its neck's base once the body is frontal, resolves into a full head, and goes (quickly) as soon as the body turns away */
  E.dev = fSmooth(.935, .985, f);   // tied straight to the turn: it is nothing while the body is not frontal
  if(E.dev > .96) E.res = Math.min(1, E.res + dt / 2600); else E.res = Math.max(0, E.res - dt / 500);
  E.gild = 1 - ssn(E.res);
  const ds = Math.max(.02, Math.pow(E.dev, 1.15)); c.scale('neck1L', ds, ds);
  c.spec(c.Ti, {twinHead:E.dev * 1.2, frontal:fSmooth(.2, .55, f) * 1.2});
  /* the sun comes down from the top right, out of frame, as the wings open (the posture's weight), and rises back out as they fold */
  { const wd = pw.displayed || 0, want = wd > (E.sunU > .5 ? .86 : .5) ? 1 : 0;   // it starts down once the wings are well open, and starts back up as they begin to fold
    E.sunU = clamp(E.sunU + (want ? dt : -dt) / (want ? 2600 : 2000)); const sunT = ssn(E.sunU); E.sunT = sunT;
    const r = c.root.r, cr = Math.cos(-r), sr = Math.sin(-r), o = [SUN_OFF[0] * (1 - sunT), SUN_OFF[1] * (1 - sunT)];
    c.slide('sun', cr * o[0] - sr * o[1], sr * o[0] + cr * o[1]); c.jd('sun', 1.3 * (1 - sunT));
    if(sunT > .004) E.sunOffT = 0; else E.sunOffT += dt;
    c.spec(c.Ti, {sun:sunT > .004 || E.sunOffT < 1100 ? 1.2 : 0}); }
  if(sm > .97 && !E.sparked){ E.sparked = true; c.glyph(3800); } else if(sm < .5) E.sparked = false;
  restyleFar(c, sm, E);
  if(sm > .5 && !E.legsUp){ E.legsUp = true; c.raise('leg'); } else if(sm < .35 && E.legsUp){ E.legsUp = false; c.raise(null); }   // the double eagle's legs are drawn over its tail
  /* the beat */
  const w0 = pw.flight || 0; E.w += (w0 - E.w) * (1 - Math.exp(-dt / 240)); const w = E.w;
  const inFlight = node === 'flight' && !tr;
  if(inFlight){ if(E.flightAt < 0) E.flightAt = now; } else E.flightAt = -1;
  const tkT = (tr && tr.b === 'flight') || (inFlight && now - E.flightAt < 3200) ? 1 : 0; E.tk += (tkT - E.tk) * (1 - Math.exp(-dt / 900));
  if(inFlight && !tkT && now > E.nextBout){ E.bout = !E.bout; E.nextBout = now + (E.bout ? 4500 + c.rand() * 3000 : 3000 + c.rand() * 2500); }
  if(tkT) { E.bout = true; E.nextBout = now + 5000; }
  const kT = E.tk > .1 ? 1 : E.kForce ?? Math.min(E.bout ? 1 : 0, E.kCap);
  E.k += (kT - E.k) * (1 - Math.exp(-dt / 650)); const A = E.k;
  const landT = tr && tr.a === 'flight' && tr.b !== 'flight' ? ssn(clamp((tr.t / tr.ms - .12) / .3)) * (1 - ssn(clamp((tr.t / tr.ms - .72) / .2))) : 0;
  E.land += (Math.max(landT, E.landF) - E.land) * (1 - Math.exp(-dt / 400));
  E.ph = (E.ph + dt * Math.min(tmp, 1.15) * FREQ * (1 - .22 * E.tk) / 1000) % 1;
  E.mw += ((pw.mantle || 0) - E.mw) * (1 - Math.exp(-dt / 180));   // the posture weight jumps when an edge is turned round: follow it smoothly
  const spost = side => 1 + E.mw * ((side === 'F' ? MANTLEP.s * .8 : MANTLEP.s) - 1);   // the posture weights sum to 1, so no normalising: a flight weight of 1 leaves exactly 1
  let sNear = 1;
  for(const side of ['N', 'F']){
    const far = side === 'F', u = E.ph - (far ? .07 : 0);
    let P = mixP(GLIDE, flapPose(u, E.tk), A); P = mixP(P, LANDP, E.land);
    if(far) P.s *= .96;
    if(w > .001){ const dl = wingDelta(side, poseT(P), TG[side]); for(const n in dl) c.jd(n, w * dl[n]); }
    const pad = (c.act('supracoracoideus', far ? 1 : 0) - c.act('pectoralis', far ? 1 : 0)) * .4;
    let s = lerp(spost(side), P.s, w) + pad * (1 - w * .6);
    if(far) s *= mF; else sNear = s;
    c.scale('wp' + side, 1, s);
    if(w > .001){   // the primaries separate (the fan above), twist (narrow) and bend under load, the outer ones most
      const tw = P.tw * A * w;
      for(let k = 0; k < PRI; k++){ if(tw > .01) c.scale('pri' + k + side, 1, 1 - .55 * tw * (.55 + .45 * k / (PRI - 1))); }
    }
  }
  E.vs += ((sNear - E.sPrev) / Math.max(dt, 1) * 1000 - E.vs) * (1 - Math.exp(-dt / 90)); E.sPrev = sNear;
  if(w > .001) for(const side of ['N', 'F']) for(let k = 0; k < PRI; k++) c.jd('priT' + k + side, clamp(E.vs * .075, -.55, .55) * (.25 + .75 * k / (PRI - 1)) * Math.min(1, A + E.land) * w);
  if(w > .001){
    const bob = -14 * A * w * (.5 - .5 * Math.cos(2 * Math.PI * (E.ph - .12))), pitch = 0.012 * A * w * Math.sin(2 * Math.PI * (E.ph - .05));
    c.Q.by += bob; c.jd('body', pitch);
    c.jd('neck1R', -2 * bob / 120); c.jd('headR', -pitch + 3 * bob / 220);      // the head holds still: the neck takes the bob and the pitch
    c.jd('tail', (.08 * Math.sin(2 * Math.PI * (E.ph + .15)) * A + .1 * Math.sin(now * .0004)) * w);
    c.spec(c.Ti, {tailSpread:(.3 + .4 * (1 - A)) * w + 1.1 * E.land, tailDown:.5 * E.land, extDig:.8 * E.land * w, abdDig:.7 * E.land * w, aluRaise:(clamp(cyc(CY.al, E.ph), 0, 1) * A + E.land) * w});
  }
  /* the feet's contact: a foot that comes down clamps (the toes close on touchdown), a foot that leaves the ground for flight lets go first (the toes open as the legs push, then curl) */
  for(const k of [0, 1]){
    const D = c.d.IKD[k], h = D.tip[1] - c.toe(k)[1];
    if(E.fh[k] > 12 && h <= 12) E.td[k] = now; else if(E.fh[k] <= 8 && h > 8 && ((tr && tr.b === 'flight') || (c.gs.on && c.gait && c.gait.name === 'hop'))) E.to[k] = now;
    E.fh[k] = h;
  }
  { const td = [0, 1].map(k => env(now - E.td[k], 30, 90, 360)), to = [0, 1].map(k => env(now - E.to[k], 50, 140, 380));
    c.spec(c.Ti, {flexDig:[.35 * td[0], .35 * td[1]], extDig:[.7 * to[0], .7 * to[1]], abdDig:[.5 * to[0], .5 * to[1]]}); }
  E.bob = 0;
  E.kCap = 1; E.kForce = null; E.landF = 0;
}
/* the far wing is dim and behind in profile; as the body turns frontal it comes round and takes the near wing's lines, so the emblem is symmetrical */
const FARP = M.parts.filter(P => P.dim && P.tags.has('F'));
const nearOf = P => P.line === LEAFFAR ? LEAFLINE : P.tags.has('wing') ? FL : P.tags.has('toe') || P.tags.has('claw') || P.tags.has('foot') ? LN.feature : LN.region;
function restyleFar(c, w, E){
  if(E.styleC === c.C && Math.abs(E.styleW - w) < .015 && (++E.styleN % 90)) return;
  E.styleC = c.C; E.styleW = w;
  const C = c.C, ls = (L) => { const tint = {bone:C.bone, cin:C.cin, umber:C.umber, lapis:C.lapis}[L.t], ik = tint ? K.mixInt(C.ink, tint, L.tk) : C.ink; return [K.mixInt(C.skin, ik, L.k), K.mixInt(C.skin, ik, L.c)]; };
  for(const P of FARP){
    const a = ls(P.line), b = ls(nearOf(P)), back = c.backs[P.order], lp = c.loops[P.order];
    back.setAttribute('fill', K.intHex(K.mixInt(a[0], b[0], w)));
    if(P.line.bs){ back.setAttribute('stroke', K.intHex(K.mixInt(a[1], b[1], w))); }
    if(lp) lp.setAttribute('stroke', K.intHex(K.mixInt(a[1], b[1], w)));
  }
}

/* ---------- actions: layers on whatever posture it is in; the big ones need one ---------- */
const addJt = (c, map, k) => { for(const n in map) if(Math.abs(map[n] * k) > 1e-4) c.jd(n, map[n] * k); };   // a wing pose, as a pull away from the posture the body is in
const hjt = (c, n, v) => { c.jt(n + 'R', v); c.jt(n + 'L', -v); };   // a turn of both heads' joints (the second head is the mirror, so its rotation is opposite)
const hjd = (c, n, v) => { c.jd(n + 'R', v); c.jd(n + 'L', -v); };
const STRETCH = wingJt('N', {hum:128, uln:138, hand:150, pri:[-12, 6], sec:[-10, 8], ter:[-4, 10]});
M.action('blink', {label:'Blink', group:'Face', dur:320, tiny:true, gait:true, f:(t, T, c) => c.spec(T, {lidDown:1.05 * env(t, 80, 60, 150), lidUp:.7 * env(t, 80, 60, 150)})});
M.action('nictitate', {label:'Third eyelid', group:'Face', dur:320, tiny:true, gait:true, f:(t, T, c) => c.spec(T, {nictitans:1.1 * env(t, 40, 80, 110)})});
M.action('glare', {label:'Glare', group:'Face', dur:2800, gait:true, f:(t, T, c) => { const e = env(t, 380, 1500, 700); c.spec(T, {corrugator:1.05 * e, pupilCon:.8 * e, lidDown:.14 * e}); hjt(c, 'head', .05 * e); }});
M.action('glance', {label:'Glance', group:'Head', dur:2600, gait:true, f:(t, T, c, a) => { const e = env(t, 420, 1300, 750), d = a.dir ?? (a.dir = c.rand() < .5 ? -1 : 1); c.spec(T, d > 0 ? {turnA:e} : {turnT:e}); hjt(c, 'neck2', -.05 * e); hjt(c, 'head', .03 * e * d); }});
M.action('bob', {label:'Head bob', group:'Head', dur:1500, gait:true, f:(t, T, c) => { const e = env(t, 150, 700, 400), ph = t * .0145; hjd(c, 'neck1', .1 * e * Math.sin(ph)); hjd(c, 'neck2', -.15 * e * Math.sin(ph + .3)); hjd(c, 'head', .06 * e * Math.sin(ph + 1.2)); c.spec(T, {pupilCon:.4 * e}); }});
M.action('cock', {label:'Head cock', group:'Head', dur:3200, gait:true, f:(t, T, c, a) => { const e = env(t, 380, 1800, 800), d = a.dir ?? (a.dir = c.rand() < .5 ? 1 : -1); c.spec(T, {turnT:.6 * e, pupilCon:.5 * e}); hjt(c, 'head', .2 * e * d); hjt(c, 'neck2', -.07 * e * d); hjt(c, 'neck1', .05 * e); }});
M.action('call', {label:'Call', group:'Head', dur:3400, f:(t, T, c, a) => {
  const o = keys(t, [[0, 0], [550, .6], [1000, 1], [2500, 1], [3300, 0]]), pu = .5 + .5 * Math.sin(t * .02), n = env(t, 300, 2100, 800);
  hjt(c, 'neck1', -.2 * o); hjt(c, 'neck2', -.32 * o); hjt(c, 'head', -.62 * o); c.rootAbout([520, 540], -.02, 0, -3 * o);
  c.spec(T, {depressor:(1.15 - .22 * pu) * n, tongue:.6 * n, adductor:0, lidDown:.1 * n, hackleUp:.5 * n, keel:1.2 * o, erector:.25 * o});
  c.flushT = Math.max(c.flushT, .5 * n); if(t > 900 && !a.fl){ a.fl = 1; c.glyph(2600); } }});
M.action('gape', {label:'Gape', group:'Head', dur:2300, gait:true, f:(t, T, c) => { const o = env(t, 500, 900, 700); c.spec(T, {depressor:.85 * o, tongue:.4 * o, lidDown:.4 * o, keel:.9 * o}); hjt(c, 'head', -.1 * o); }});
/* the double eagle's heads act apart: one sweeps up and calls, the other looks down and across; or both call, a beat apart */
M.action('headsLook', {label:'Heads look', group:'Head', dur:4200, in:['displayed'], f:(t, T, c, a) => {
  const e = env(t, 600, 2600, 900), sw = Math.sin(t * .0021), d = a.dir ?? (a.dir = c.rand() < .5 ? 1 : -1);
  c.jd('neck1R', (.2 * sw * d) * e); c.jd('neck2R', -.16 * sw * d * e); c.jd('headR', .1 * sw * d * e);
  c.jd('neck1L', (.2 * Math.sin(t * .0021 + 1.9) * d) * e); c.jd('neck2L', .16 * Math.sin(t * .0021 + 1.9) * d * e); c.jd('headL', -.1 * Math.sin(t * .0021 + 1.9) * d * e);
  c.spec(T, {corrugator:[.5 * e, .3 * e], pupilCon:[.5 * e, .2 * e]}); }});
M.action('twinCall', {label:'Both call', group:'Head', dur:4600, in:['displayed'], f:(t, T, c, a) => {
  const oR = keys(t, [[0, 0], [600, .8], [1100, 1], [2300, 1], [3000, 0]]), oL = keys(t, [[0, 0], [900, 0], [1500, .8], [2000, 1], [3200, 1], [4000, 0]]), pu = .5 + .5 * Math.sin(t * .02), g = 1.15 - .22 * pu;
  c.jd('neck1R', -.2 * oR); c.jd('neck2R', -.3 * oR); c.jd('headR', -.6 * oR); c.jd('neck1L', .2 * oL); c.jd('neck2L', .3 * oL); c.jd('headL', .6 * oL);
  c.spec(T, {depressor:[g * env(t - 900, 600, 1900, 700), g * env(t, 600, 1700, 700)], keel:.8 * Math.max(oL, oR)});
  if(t > 1000 && !a.fl){ a.fl = 1; c.glyph(3200); } }});
M.action('fanTail', {label:'Tail fan', group:'Plumage', dur:2600, gait:true, f:(t, T, c) => { const e = env(t, 400, 1400, 700); c.spec(T, {tailSpread:1.15 * e, tailUp:.3 * e}); }});
M.action('fluff', {label:'Fluff', group:'Plumage', dur:2600, gait:true, f:(t, T, c) => { const e = env(t, 500, 1300, 800); c.spec(T, {erector:.9 * e, hackleUp:.5 * e, keel:.5 * e}); }});
M.action('grip', {label:'Grip', group:'Legs', dur:2000, tiny:true, f:(t, T, c) => { const e = env(t, 350, 800, 600) * (1 - (c.postureW().flight || 0)); c.spec(T, {flexDig:1.05 * e, abdDig:-.2 * e}); }});   // in flight the toes are already a fist
M.action('toeRoll', {label:'Toe roll', group:'Legs', dur:2600, f:(t, T, c) => {   // the grip closes toe by toe, the hallux first, then III, II and IV, and lets go in the same order
  const nf = 1 - (c.postureW().flight || 0), e = i => nf * env(t - 190 * i, 280, 650, 420); c.spec(T, {flexI:1 * e(0), flexIII:.95 * e(1), flexII:.95 * e(2), flexIV:.95 * e(3), abdDig:.35 * env(t, 200, 500, 500)}); }});
M.action('shiftFoot', {label:'Shift weight', group:'Legs', dur:2200, in:['perched'], f:(t, T, c) => {
  const a = env(t, 450, 800, 700), u = Math.sin(Math.PI * clamp((t - 700) / 900)), A = c.shiftAmt();
  c.rootAbout([540, 690], -.014 * a * A, 4 * a * A, 0); c.legTo(0, 526 + 6 * u, 729 - 22 * u, c.foot(0)[2] - .3 * u, 1, 1, {kk:9});
  hjt(c, 'head', -.03 * a); }});
M.action('rouse', {label:'Rouse', group:'Plumage', dur:3800, big:true, in:['perched'], f:(t, T, c, a) => {
  const up = env(t, 650, 1900, 900), ev = d => env(t - d, 160, 1150, 700), ph = k => Math.sin(t * .036 - k), A = c.shiftAmt();
  c.spec(T, {erector:1.05 * up, hackleUp:.8 * up, keel:.9 * up, corrugator:.5 * up, lidDown:.25 * ev(0)});
  hjd(c, 'head', .11 * ev(0) * ph(.3)); hjd(c, 'neck2', .1 * ev(70) * ph(.9)); hjd(c, 'neck1', .08 * ev(140) * ph(1.5)); c.jd('chest', .05 * ev(220) * ph(2.2)); c.jd('pelvis', .06 * ev(320) * ph(3)); c.jd('tail', .14 * ev(420) * ph(3.8));
  for(let k = 0; k < NREC; k++) c.jd('rec' + k, .05 * ev(480 + 30 * k) * ph(4 + k * .3));
  for(const s of ['N', 'F']){ c.jd('hum' + s, .06 * ev(260) * ph(2.4)); c.jd('uln' + s, .05 * ev(300) * ph(2.8)); }
  c.spec(T, {priSpread:.25 * ev(300) * (.5 + .5 * ph(2))});
  c.rootAbout(O, 0, 0, 7 * ev(120) * A); c.Q.by += 3.5 * ev(160) * Math.sin(t * .072);
  if(t > 600 && !a.fl){ a.fl = 1; c.flipWave(1300, 760); c.burstAt(650, 225, 760, K.mixInt(K.hexInt(K.ROSTER.lapis), K.hexInt(K.ROSTER.bone), .12), 'feathers'); } }});
M.action('preen', {label:'Preen', group:'Plumage', dur:6600, big:true, in:['perched'], f:(t, T, c) => {
  const o = keys(t, [[0, 0], [1300, 1], [5500, 1], [6400, 0]]), st = env(t, 1500, 3800, 600) * Math.sin((t - 1500) * .0105), r = env(t, 1500, 3700, 800), sw = .5 + .5 * Math.sin((t - 1500) * .0052);
  c.jt('neck1R', -1.2 * o + .06 * st); c.jt('neck2R', 1.1 * o + .1 * st); c.jt('headR', .85 * o + .16 * st); c.Q.yaw += -.08 * o;
  c.jd('humN', .1 * r * sw); c.jd('ulnN', -.08 * r * sw);
  c.spec(T, {depressor:.22 * st * st, adductor:.2 * o, lidDown:.4 * o, keel:.3 * o, secSpread:[.25 * r * sw, 0], erector:.1 * r});
  c.rootAbout([540, 690], -.012 * o, 0, 0); }});
M.action('stretchWing', {label:'Wing stretch', group:'Wings', dur:6000, big:true, in:['perched'], f:(t, T, c) => {
  const w = keys(t, [[0, 0], [1500, 1], [3700, 1], [5200, 0]]), lg = keys(t, [[0, 0], [1200, 0], [2000, 1], [3600, 1], [4600, 0]]), A = c.shiftAmt();
  addJt(c, STRETCH, w); c.rootAbout([540, 690], .05 * w * A, -4 * w * A, 0); c.Q.cam = {s:.92 + .22 * w, x:495 - 70 * w, y:470 - 6 * w};
  c.legTo(0, 526 - 74 * lg, 729 - 52 * lg, c.foot(0)[2] - .5 * lg, lg, lg, {kk:8});
  hjt(c, 'head', .08 * w); hjt(c, 'neck2', .06 * w); c.spec(T, {lidDown:.2 * w, tailSpread:.5 * w, tailUp:.2 * w, flexDig:[.5 * lg, 0]}); }});
/* the double eagle's wings beat where it hangs: the plane of each tilts down toward level and back (the squash), the arms sweep, the body lifts as they fall */
M.action('flapGround', {label:'Wing beats', group:'Wings', dur:5200, big:true, in:['displayed'], f:(t, T, c, a) => {
  const e = env(t, 700, 3400, 900), ph = (t - 700) * .0042, dn = .5 - .5 * Math.cos(ph), A = c.shiftAmt();
  if(t > 600 && !a.fl){ a.fl = 1; c.glyph(3000); }
  const sc = 1 - .62 * dn * e; c.scale('wpN', 1, sc); c.scale('wpF', 1, sc);
  for(const s of ['N', 'F']){ c.jd('hum' + s, .2 * Math.sin(ph) * e); c.jd('uln' + s, -.3 * (.5 + .5 * Math.cos(ph - .6)) * e + .15 * e); c.jd('hand' + s, .4 * (.5 + .5 * Math.cos(ph - 1.2)) * e - .2 * e); }
  c.Q.by += -12 * e * Math.sin(Math.PI * dn) * A; c.spec(T, {priSpread:-.2 * (.5 + .5 * Math.cos(ph - .6)) * e, tailSpread:.2 * e, keel:.8 * e}); }});
M.action('soar', {label:'Soar', group:'Flight', dur:7000, in:['flight'], f:(t, T, c) => { const e = env(t, 900, 4600, 1000); c.eg.kCap = Math.min(c.eg.kCap, 1 - e); c.spec(T, {priSpread:.34 * e, secSpread:.2 * e, tailSpread:.7 * e, keel:.3 * e}); }});
M.action('flapBout', {label:'Flap', group:'Flight', dur:6000, in:['flight'], f:(t, T, c) => { const e = env(t, 600, 4200, 900); if(e > .02) c.eg.kForce = e; c.spec(T, {keel:.5 * e}); }});
M.action('flare', {label:'Flare to land', group:'Flight', dur:3600, in:['flight'], f:(t, T, c) => { const e = env(t, 900, 1700, 900); c.eg.landF = Math.max(c.eg.landF, e); c.spec(T, {extDig:.9 * e, abdDig:.9 * e}); hjt(c, 'head', .12 * e); }});

/* ---------- pads ---------- */
M.pad('beak', {label:'Beak', group:'Head', split:'LR', x:['clench', 'tongue'], y:['shut', 'open'], map:(x, y) => ({depressor:pos(y), adductor:pos(-y) + .5 * pos(-x), tongue:pos(x) * (.3 + pos(y))}), ghost:(c, s) => [cl(c.act('tongue', s)), cl(c.act('depressor', s) - c.act('adductor', s))]});
M.pad('eye', {label:'Eye · brow', group:'Head', split:'LR', x:['wary', 'glare'], y:['shut', 'wide'], map:(x, y) => ({corrugator:pos(x), frontalis:pos(-x) + .5 * pos(y), lidDown:pos(-y), lidUp:.6 * pos(-y)}), ghost:(c, s) => [cl(c.act('corrugator', s) - c.act('frontalis', s)), cl(c.act('frontalis', s) - c.act('lidDown', s))]});
M.pad('pupil', {label:'Pupil · third lid', group:'Head', split:'LR', x:['dilate', 'constrict'], y:['clear', 'sweep'], map:(x, y) => ({pupilDil:pos(-x), pupilCon:pos(x), nictitans:pos(y)}), ghost:(c, s) => [cl(c.act('pupilCon', s) - c.act('pupilDil', s)), cl(c.act('nictitans', s))]});
M.pad('head', {label:'Head', group:'Head', split:'LR', x:['turn away', 'turn toward'], y:['lower', 'raise'], map:(x, y) => ({turnT:pos(x), turnA:pos(-x), headUp:pos(y), headDown:pos(-y)}), ghost:(c, s) => [cl(c.act('turnT') - c.act('turnA')), cl(c.act('headUp', s) - c.act('headDown', s))]});
M.pad('neck', {label:'Neck', group:'Head', split:'LR', x:['retract', 'reach'], y:['drop', 'lift'], map:(x, y) => ({neckExt:pos(y) + .7 * pos(-x), neckFlex:pos(-y) + .7 * pos(x)}), ghost:(c, s) => [cl(c.act('neckFlex', s) - c.act('neckExt', s)), cl(c.act('neckExt', s) - c.act('neckFlex', s))]});
M.pad('bob', {label:'Head bob · cock', group:'Head', x:['tilt back', 'tilt forward'], y:['bob back', 'bob forward'], map:x => ({headDown:pos(x), headUp:pos(-x)}), fx:(c, x, y) => { hjd(c, 'neck1', .2 * y); hjd(c, 'neck2', -.3 * y); }, ghost:c => [cl(c.act('headDown', 1) - c.act('headUp', 1)), 0]});
M.pad('wings', {label:'Wings', group:'Wings', split:'NF', x:['fold', 'spread'], y:['lower', 'raise'], map:(x, y) => ({triceps:pos(x), biceps:.4 * pos(-x), supracoracoideus:.85 * pos(y), pectoralis:pos(-y)}), ghost:(c, s) => [cl(c.act('triceps', s) - c.act('biceps', s)), cl(c.act('supracoracoideus', s) - c.act('pectoralis', s))]});
M.pad('hand', {label:'Hand · feathers', group:'Wings', split:'NF', x:['close', 'fan'], y:['fold', 'extend'], map:(x, y) => ({priSpread:pos(x), secSpread:.85 * pos(x), terSpread:.7 * pos(x), extMeta:pos(y), flexMeta:pos(-y), aluRaise:.8 * pos(y)}), ghost:(c, s) => [cl(c.act('priSpread', s)), cl(c.act('extMeta', s) - c.act('flexMeta', s))]});
M.pad('plumage', {label:'Plumage', group:'Plumage', x:['sleek', 'roused'], y:['hackles down', 'hackles up'], map:(x, y) => ({erector:x, hackleUp:pos(y)}), ghost:c => [cl(c.act('erector')), cl(c.act('hackleUp', 1))]});
M.pad('tail', {label:'Tail', group:'Plumage', x:['close', 'fan'], y:['lower', 'lift'], map:(x, y) => ({tailSpread:pos(x), tailDown:pos(-y), tailUp:pos(y)}), ghost:c => [cl(c.act('tailSpread')), cl(c.act('tailUp') - c.act('tailDown'))]});
M.pad('spine', {label:'Spine', group:'Body', x:['sway', 'arch'], y:['crouch', 'rise'], map:x => ({epaxial:pos(x), hypaxial:pos(-x)}), fx:(c, x, y) => { c.Q.ry += 20 * pos(-y) - 3 * pos(y); }, ghost:c => [cl(c.act('epaxial') - c.act('hypaxial')), cl(-c.root.y / 30)]});
M.pad('breath', {label:'Breath', group:'Body', x:['shallow', 'deep'], y:['slow', 'fast'], fx:(c, x, y) => { c.breath.depth = 2 ** (x * 1.4); c.breath.rate = 2 ** (y * 1.2); }, ghost:c => [cl(Math.log2(c.breath.depth) / 1.4), cl(Math.log2(c.breath.rate) / 1.2)]});
M.pad('legs', {label:'Legs', group:'Limbs', split:'NF', leg:'leg', x:['back', 'reach'], y:['flex', 'extend'], map:(x, y) => ({caudofem:pos(-x), hipFlex:pos(x), hamstrings:pos(-y), quads:pos(y)})});
M.pad('toes', {label:'Hallux · outer toes', group:'Limbs', split:'NF', x:['hallux free', 'hallux grip'], y:['inner toe II', 'outer toe IV'], map:(x, y) => ({flexI:pos(x), extI:pos(-x), flexII:pos(-y), extII:.6 * pos(y), flexIV:pos(y), extIV:.6 * pos(-y)}), ghost:(c, s) => [cl(c.act('flexI', s) - c.act('extI', s)), cl(c.act('flexIV', s) - c.act('flexII', s))]});
M.pad('talons', {label:'Talons', group:'Limbs', split:'NF', x:['open', 'clench'], y:['together', 'spread'], map:(x, y) => ({flexDig:pos(x), extI:pos(-x), extII:pos(-x), extIII:pos(-x), extIV:pos(-x), abdII:pos(y), abdIV:pos(y)}), ghost:(c, s) => [cl(c.act('flexDig', s) - c.act('extIII', s)), cl(c.act('abdII', s))]});

/* ---------- the glyph's path: where each polygon of the sign lies on the light's travel, 0 to 1. In the double eagle the light runs the emblem: the tail, the left wing (its
   primaries from the inner to the outer, then back along the arm to the shoulder), the left head, the right head, the right wing (shoulder out along the arm, then its primaries), and
   ends at the tail again ---------- */
const PATH = {tail:[0, .07], priL:[.09, .28], armL:[.29, .4], headL:[.41, .5], headR:[.5, .59], armR:[.6, .71], priR:[.72, .93], tailEnd:[.94, 1]};
function glyphS(x, y, P){
  const n = P.name; let m;
  const along = (f, p0 = f.p) => clamp(((x - p0[0]) * Math.cos(f.ang) + (y - p0[1]) * Math.sin(f.ang)) / f.L);
  if((m = /^glyphRec(\d)$/.exec(n))) return [lerp(PATH.tail[0], PATH.tail[1], (+m[1] - 2) / 7), 1];
  if((m = /^(glyphPri|pri)(\d)([NF])$/.exec(n))){ const k = +m[2], side = m[3], f = WG[side].pri[k], R_ = PATH[side === 'N' ? 'priL' : 'priR']; return [lerp(R_[0], R_[1], (k + along(f) * .9) / 10), n.startsWith('glyph') ? 1 : .16]; }
  if((m = /^glyph(Hum|Uln|Hand|Elbow|Wrist)([NF])$/.exec(n))){
    const side = m[2], R_ = PATH[side === 'N' ? 'armL' : 'armR'], g = WG[side], order = {Hand:0, Wrist:.18, Uln:.4, Elbow:.62, Hum:.85}[m[1]], t = side === 'N' ? order : 1 - order;
    return [lerp(R_[0], R_[1], t), 1];
  }
  if((m = /^glyph(Head|Neck)([RL])$/.exec(n))){ const R_ = PATH[m[2] === 'L' ? 'headL' : 'headR'], u = m[1] === 'Neck' ? .0 : .5; return [lerp(R_[0], R_[1], m[2] === 'L' ? u + (m[1] === 'Head' ? clamp(((x - 524) / 90)) * .45 : 0) : u + (m[1] === 'Head' ? clamp(((x - 624) / 90)) * .45 : 0)), 1]; }
  if((m = /^(sec|ter|cvPri|cvSec|cvMed|cvTer|cvLes|alu|wrist|elbow|armHum|armUln|armHand|shoulder)(\d*)([NF])$/.exec(n))){
    const side = m[3], R_ = PATH[side === 'N' ? 'priL' : 'priR'], j = m[2] === '' ? 5 : +m[2]; const t = clamp((j + .5) / (m[1] === 'ter' ? 4 : SEC)) * (side === 'N' ? 1 : 1);
    return [lerp(R_[0], R_[1], side === 'N' ? t : 1 - t * .5), .1];
  }
  if(P.tags.has('head') && P.tags.has('L')) return [lerp(PATH.headL[0], PATH.headL[1], .5), .1];
  if(P.tags.has('head') && P.tags.has('R')) return [lerp(PATH.headR[0], PATH.headR[1], .5), .1];
  if(P.tags.has('neck')) return [P.tags.has('L') ? .43 : .52, .1];
  if(P.tags.has('tailfeather')){ const k = +/\d+/.exec(n)[0]; return [lerp(PATH.tail[0], PATH.tail[1], k / 11), .12]; }
  return null;
}

/* ---------- hooks: idle, posture holds, the gait's body, the glyph's path, the twin's gilding, life ---------- */
const HOOKS = {
  /* the anatomy audit (tools/creature-anatomy-audit.mjs) reads these as deliberate: the scapulars are contour feathers on the shoulder girdle that stay with the body when the wing rises (they lie over the humerus,
     bound to the chest); the mouth's cavity is the inside of the mouth, which stays with the skull while the jaw turns over it */
  audit:{allow:{deadParts:['^scapulars$', '^cavity[RL]$']}},
  idle(c, now, Ti, dt){
    const br = .5 + .5 * Math.sin(now * .00135 * c.breath.rate + 1), fl = c.pm.w.flight || 0;
    c.spec(Ti, {keel:(.22 + .5 * br) * c.breath.depth, tailUp:.05 * Math.sin(now * .0006), erector:.05 * Math.sin(now * .0009 + 2)});
    c.Q.yaw += .035 * Math.sin(now * .00031) * (1 - fl); hjt(c, 'head', .012 * Math.sin(now * .00057));
    if(c.every('blink', [2200, 6200], now)) c.actions.push({name:'blink', t0:now});
    if(c.every('nict', [5200, 14000], now)) c.actions.push({name:'nictitate', t0:now});
    figureStep(c, now, dt);
    /* the camera keeps the wings in view when a pad or an action lifts them above what the posture's camera frames, or lets an opened wing hang low */
    { const m = id => Math.max(c.act(id, 0), c.act(id, 1), 0), ext = m('triceps'), up = m('supracoracoideus') * (.85 + .15 * ext), low = ext * (.35 + .65 * m('pectoralis')) * .8, cm = c.Q.cam;
      if(cm && up + low > .01) c.Q.cam = {s:cm.s + .8 * up + .5 * low, x:cm.x - 70 * up - 30 * low, y:cm.y - 170 * up + 90 * low}; }
  },
  postureHold(c, w, Ta){ c.spec(Ta, {corrugator:.3 * w.crouch + .35 * w.mantle + .3 * w.displayed + .1 * w.flight, erector:.12 * w.mantle + .3 * w.displayed, keel:.35 * w.crouch + .3 * w.mantle + .45 * w.displayed + .15 * w.flight, pupilCon:.2 * w.crouch + .3 * w.mantle,
    extDig:.7 * w.displayed, abdDig:.95 * w.displayed}); },
  /* the tendon lock: the flexor tendons of the toes run behind the knee and the ankle, so a leg that folds (a squat, a crouch, a mantle, the tuck of flight) pulls the toes shut with no muscle: the passive grip of a perch.
     Read from the legs' solved joint angles of the last frame; it fades where the posture owns the feet (the displayed posture's fan, the flight's fist). */
  post(c, rot, sx, sy, now, dt){
    const E = c.eg, d = c.d; if(!E || !FOOT) return;
    for(const k of [0, 1]){
      const s = k ? 'F' : 'N', knee = c.ikd[d.BI['tib' + s]], ank = c.ikd[d.BI['tars' + s]], own = Math.max(c.pm.w.displayed || 0, E.w);
      const T_ = clamp(.9 * pos(knee - .12) + .55 * pos(-ank - .05), 0, 1.3) * c.leg[k].w * (1 - own) * (.1 + .9 * fSmooth(6, 30, E.fh[k]));   // on the flat ground the floor stops the toes closing: the lock grips only a foot that is off it (a perch's, a swing's)
      E.lock[k] += (T_ - E.lock[k]) * (1 - Math.exp(-dt / 150));
      if(E.lock[k] > .002) for(const [id, t] of Object.entries(FOOT)){ const w = t.bones.map((_, i) => TOEW[Math.min(i, TOEW.length - 1)] * (i === t.bones.length - 1 ? .8 : 1)), sm = w.reduce((a, b) => a + b, 0); t.bones.forEach((b, i) => { const bi = d.BI[b.slice(0, -1) + s], add = E.lock[k] * 1.5 * t.flex * w[i] / sm, room = add > 0 ? d.LIMHI[bi] - rot[bi] : rot[bi] - d.LIMLO[bi]; rot[bi] += Math.sign(add) * Math.min(Math.abs(add), Math.max(0, room - .02)); }); }   // the lock never takes a joint to its stop
    }
  },
  gaitBody(c, G, k, ph, mk){
    const w = 4 * Math.PI * ph; hjt(c, 'neck1', .05 * k * mk * Math.sin(w + 2.2)); hjt(c, 'neck2', -.08 * k * mk * Math.sin(w + 2.2)); c.jt('chest', .02 * k * mk * Math.sin(2 * Math.PI * ph)); c.jt('tail', .05 * k * mk * Math.sin(2 * Math.PI * ph + 2.6));
    /* the feet through a step: the toes close as the foot lifts (the flexors), open and fan as it reaches for the ground, press flat and fan a little at touchdown, and close as the foot rolls off (the push) */
    { const fl = [0, 0], ex = [0, 0], ab = [0, 0];
      [0, 1].forEach(i => { const L = c.gs.legs[i]; if(!L) return; const p = clamp(L.p);
        if(L.stance){ ab[i] = .4 * (1 - fSmooth(0, .3, p)); ex[i] = .15 * (1 - fSmooth(0, .25, p)); fl[i] = .5 * fSmooth(.72, 1, p); }
        else { fl[i] = .5 * fSmooth(0, .22, p) * (1 - fSmooth(.45, .75, p)); ex[i] = .5 * fSmooth(.55, .95, p); ab[i] = .55 * fSmooth(.6, 1, p); } });
      c.spec(c.Ta, {flexDig:[fl[0] * k, fl[1] * k], extDig:[ex[0] * k, ex[1] * k], abdDig:[ab[0] * k, ab[1] * k]}); }
    if(G.name === 'hop'){   // the bound: both feet off together, the body clear of the ground on half-open wings
      const s0 = c.gs.legs[0], s1 = c.gs.legs[1], air = !s0.stance && !s1.stance ? Math.sin(Math.PI * clamp(Math.min(s0.p, s1.p))) : 0;
      c.Q.ry -= 92 * air * k; { const cm = c.Q.cam; if(cm) c.Q.cam = {s:cm.s + .26 * k, x:cm.x - 20 * k, y:cm.y - 50 * k}; }   // the camera makes room for the bound
       c.jd('body', -.05 * air * k); c.spec(c.Ta, {supracoracoideus:.3 * air * k, triceps:.3 * air * k, tailSpread:.6 * air * k, keel:.5 * air * k});
    }
  },
  glyph:(x, y, P) => glyphS(x, y, P),
  /* the second head is gold while it grows, then resolves into the ink */
  colour(c, i, col){ const E = c.eg; if(!E) return col; const P = c.d.parts[c.d.PPART[i]];
    if(E.gild > .01 && P.tags.has('twin')) col = K.mixInt(col, c.C.gold, .85 * E.gild);
    if(E.sm > .01 && D.FARP.has(i)) col = K.mixInt(col, c.C.ink, .14 * E.sm * (P.tags.has('wing') ? 1 : .6));   // the far wing and leg take the near ones' tone as the body turns frontal
    return col; },
  colourLive(c){ const E = c.eg; if(!E) return; if(Math.abs(E.gild - E.gildDrawn) > .01){ E.gildDrawn = E.gild; for(const i of D.TWINP) c.colDirty.add(i); } if(Math.abs(E.sm - E.smDrawn) > .02){ E.smDrawn = E.sm; for(const i of D.FARP) c.colDirty.add(i); } },
  ripple:{tag:'feathers', centre:[560, 400], a0:.6},
  shiftOf:{crouch:.55, mantle:.7, displayed:.75, flight:1},
  life:{rate:1.6,
    small:[['glance', 3, 5000], ['bob', 2.2, 7000], ['cock', 1.6, 9000], ['nictitate', 1.6, 6000], ['glare', 1.1, 14000], ['fluff', 1.3, 12000, ['perched', 'crouch', 'displayed']], ['fanTail', .9, 16000, ['perched', 'displayed', 'mantle', 'flight']], ['grip', 1, 12000, ['perched', 'crouch']], ['toeRoll', .8, 15000, ['perched', 'crouch', 'mantle']],
      ['shiftFoot', 1.4, 9000, ['perched']], ['gape', .5, 24000, ['perched', 'mantle']], ['call', .55, 30000, ['perched', 'displayed', 'flight']], ['rouse', .45, 60000, ['perched']], ['preen', .6, 45000, ['perched']], ['stretchWing', .3, 70000, ['perched']],
      ['flapGround', .9, 22000, ['displayed']], ['headsLook', 1.4, 14000, ['displayed']], ['twinCall', .7, 28000, ['displayed']], ['soar', 1.2, 12000, ['flight']], ['flapBout', 1.1, 12000, ['flight']], ['flare', .0001, 90000, ['flight']], ['glyph', 1, 14000]],
    moves:[['go:displayed', .8, 22000, ['perched', 'mantle']], ['go:mantle', .6, 24000, ['perched']], ['go:crouch', .45, 30000, ['perched']], ['go:perched', 1.1, 0, ['displayed', 'mantle', 'crouch']], ['go:flight', 1.4, 0, ['crouch', 'displayed'], {crouch:2.4}],
      ['go:perched', 1.6, 0, ['flight']], ['walk', .7, 20000, ['perched']], ['hop', .45, 40000, ['perched']]],
    dwell:{perched:[5000, 11000], displayed:[6000, 12000], mantle:[4500, 9000], crouch:[1800, 3400], flight:[9000, 15000]},
    gait:[['glance', 3, 5000], ['bob', 1, 8000], ['fanTail', .8, 12000], ['nictitate', 1.4, 6000]], gaitFor:{walk:[3000, 6500], hop:[2200, 4000]}},
};
const D = M.finish(HOOKS);
D.TWINP = []; D.FARP = new Set(); for(let i = 0; i < D.NPOLY; i++){ const P = D.parts[D.PPART[i]]; if(P.tags.has('twin')) D.TWINP.push(i); if(P.dim && P.tags.has('F')) D.FARP.add(i); }
K.define(D);
})();
