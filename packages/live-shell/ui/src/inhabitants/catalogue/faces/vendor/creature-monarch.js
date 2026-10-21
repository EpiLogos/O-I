/* creature-monarch.js — Danaus plexippus, the adult female, on creature-kit.js. A plan-view insect: the body faces +x, the six legs walk in an alternating tripod, and the wings are membranes meshed as cells
   with black veins laid over them. A wing's spread is a MUSCLE, not a bone scale: the tergosternal elevator pulls every wing vertex toward the body axis (the wing seen from above is the cosine of its
   elevation: a beat is the span foreshortening to a sliver at the top of the stroke and opening to full at the horizontal), the basalar and subalar muscles sweep the wing about its shoulder, and the unexpanded
   wing is a second muscle (the crumple) that shrinks it toward its root until it has been pumped open. The page carries one tree (a bough, its leaves and the empty case of a chrysalis), one milkweed (an umbel to
   feed at, a leaf to lay on) and, in the relay, the inherited bearing as a dashed line from the head to the edge of the page.
   The agency: Metamorph is the route pupa -> emerge -> bask with the action `pump` (the pupa is silent but for its heart: a lub-dub on the gold beads; the pumped wings stay open in c.mon.exp); Relay is the action
   `relay` in `fly` (the bearing is read, flown steadily, and left on the page, dimming; nothing behind the animal). The figure's own lasting state is on c.mon (exp: how far the wings have been pumped, eggs: laid on
   the leaf, bear: how bright the bearing is). Read CREATURE-NOTES-MONARCH.md for the anatomy, the venation, the choices and the measured rounds. */
(() => {
'use strict';
const K = window.CreatureKit; K.require('1.1.0', 'creature-monarch');
const M = K.model({id:'monarch', name:'Monarch', sign:'', title:'MONARCH', sub:'Danaus plexippus · the adult: wings, roost and the inherited bearing',
  w:1000, h:780, pivot:[500, 400], axis:500, ink:K.ROSTER.cinnabar, accent:K.ROSTER.amber, cam:[1, 500, 390]});
const {clamp, keys, env, pulse, fSmooth, lerp, chaikin, ringPts, ellipsePts, catmull, hash, mixInt} = K, pos = v => Math.max(0, v), cl1 = v => Math.max(-1, Math.min(1, v));
const CX = 500, CY = 400, SIDE = [1, -1], SN = s => s > 0 ? 'R' : 'L';      // +1 the near side (below the body on the page), -1 the far
const P = (a, b) => [CX + a, CY + b];                                          // the body frame: a toward the head (+x), b to the near side (+y)
const rad = d => d * Math.PI / 180;
const bone_ = n => M.bones[M.BI[n]];
function elbow(S, W, l1, l2, bend){ const dx = W[0] - S[0], dy = W[1] - S[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 4), t = Math.atan2(dy, dx) + bend * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)); return [S[0] + l1 * Math.cos(t), S[1] + l1 * Math.sin(t)]; }

/* ---------- the wing's own geometry ----------
   A wing is a Coons patch: its four edges are smooth curves, and any point of it is (t, w): t along the span (0 the base, 1 the margin), w across the chord (0 the costa, 1 the inner margin).
   The veins are lines in that space, the cells between them are zones, and the outline is the patch's own edge. Points are in the body frame (a, b) of the near wing. */
const pathFn = pts => {
  const C = catmull(pts, 10), L = [0];
  for(let i = 1; i < C.length; i++) L.push(L[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
  const T = L[L.length - 1];
  return t => { const d = clamp(t) * T; let k = 1; while(k < C.length - 1 && L[k] < d) k++; const u = (d - L[k - 1]) / ((L[k] - L[k - 1]) || 1); return [C[k - 1][0] + (C[k][0] - C[k - 1][0]) * u, C[k - 1][1] + (C[k][1] - C[k - 1][1]) * u]; };
};
const patch = (C, O, I, B) => { const c0 = C(0), c1 = C(1), i0 = I(0), i1 = I(1);
  return (t, w) => { const a = C(t), b = I(t), p = B(w), q = O(w); return [0, 1].map(k => (1 - w) * a[k] + w * b[k] + (1 - t) * p[k] + t * q[k] - ((1 - t) * (1 - w) * c0[k] + t * (1 - w) * c1[k] + (1 - t) * w * i0[k] + t * w * i1[k])); }; };
/* the forewing: a rounded triangle, the costa gently convex, the apex rounded, the outer margin slanting back to the tornus, the inner margin short */
const FW = {key:'fore', t0:.1, layer:6, chainT:[0, .38, .72, 1], h:25,
  phi:patch(pathFn([[46, 18], [53, 70], [59, 130], [62, 190], [62, 246], [57, 288], [46, 314]]), pathFn([[46, 314], [30, 322], [8, 318], [-16, 305], [-42, 284], [-64, 258], [-78, 230]]),
    pathFn([[-14, 18], [-28, 60], [-42, 108], [-56, 158], [-68, 200], [-78, 230]]), pathFn([[46, 18], [16, 18], [-14, 18]]))};
/* the hindwing: rounder and smaller, its front edge lying under the forewing's inner margin, the outer margin scalloped, the anal margin hugging the abdomen */
const HW = {key:'hind', t0:.12, layer:5, chainT:[0, .5, 1], h:25,
  phi:patch(pathFn([[8, 20], [-10, 64], [-30, 114], [-50, 164], [-66, 208], [-80, 238]]), pathFn([[-80, 238], [-104, 244], [-132, 232], [-156, 208], [-174, 176], [-184, 136], [-186, 96]]),
    pathFn([[-4, 20], [-40, 24], [-86, 30], [-130, 38], [-166, 58], [-186, 96]]), pathFn([[8, 20], [2, 20], [-4, 20]]))};
/* the veins as fan lines in (t, w): w goes from w0 at the base to w1 at the margin. `sector` lines bound the cells; the others are drawn over them. */
const wl = (L, t) => L.w0 + (L.w1 - L.w0) * Math.pow(t, L.g || .9);
FW.sectors = [{w0:0, w1:0}, {w0:.22, w1:.17}, {w0:.43, w1:.40}, {w0:.63, w1:.62}, {w0:.82, w1:.84}, {w0:1, w1:1}];
FW.veins = [   // [name, w0, w1, tStart, tEnd, half width at the base, at the tip]
  ['Sc', .07, .035, .04, .80, 3.8, 2.3], ['R', .22, .17, .02, 1, 4.2, 2.6], ['R2', .13, .095, .50, 1, 2.6, 1.8], ['R3', .30, .27, .40, 1, 2.5, 1.7], ['M', .43, .40, .02, 1, 4.0, 2.5],
  ['M2', .53, .50, .45, 1, 2.6, 1.8], ['Cu', .63, .62, .02, 1, 3.8, 2.4], ['Cu2', .73, .74, .36, 1, 2.6, 1.8], ['A', .82, .84, .02, .95, 3.6, 2.2]];
FW.cross = [[[.51, .22], [.52, .33], [.51, .43]], [[.42, .43], [.43, .53], [.42, .63]]];     // the discocellular cross-veins: lines through (t, w) points
HW.sectors = [{w0:0, w1:0}, {w0:.28, w1:.22}, {w0:.52, w1:.50}, {w0:.76, w1:.78}, {w0:1, w1:1}];
HW.veins = [['Sc', .08, .05, .04, .72, 3.6, 2.2], ['Rs', .28, .22, .02, 1, 4.0, 2.4], ['M1', .40, .36, .30, 1, 2.6, 1.8], ['M', .52, .50, .02, 1, 3.8, 2.4], ['Cu', .64, .64, .30, 1, 2.6, 1.8], ['Cu2', .76, .78, .02, 1, 3.6, 2.2], ['A', .90, .90, .05, .86, 2.6, 1.7]];
HW.cross = [[[.45, .28], [.46, .40], [.45, .52]]];
const cvs = (s, p) => P(p[0], s * p[1]);

/* ---------- skeleton ----------
   body (root) · head · a three-bone abdomen · four-bone antennae each side · a ten-bone proboscis coiled in front of the face · a wing-plane bone per wing and a chain along each wing's middle
   (fore: three, hind: two) · six three-bone IK legs · the scene's bough, husk, milkweed and leaf, each on a bone of its own so nothing hangs on the root. */
M.bone('body', null, P(0, 0), P(70, 0), {grp:'root'});
M.bone('head', 'body', P(48, 0), P(78, 0), {grp:'head', lim:[-.7, .7], speed:9});
const ABD = M.chain('abd', [P(-20, 0), P(-60, 0), P(-110, 0), P(-174, 0)], 3, {parent:'body', grp:'abdomen', lim:[-.6, .6], speed:6});
const ANT_PTS = [[72, 7], [98, 24], [122, 38], [146, 48], [166, 54]];
const ANT = {};
for(const s of SIDE) ANT[SN(s)] = M.chain('ant' + SN(s), ANT_PTS.map(([a, b]) => P(a, b * s)), 4, {parent:'head', grp:'antenna', lim:[-.8, .8], speed:11});
for(const X in ANT) bone_(ANT[X][0]).lim = [-1.4, 1.4];   // the base can fold the whole antenna back against the head (the pupa holds it so)
/* the proboscis: a spiral of ten bones, the base at the mouth, the coil in front of the face. One muscle uncoils it (each bone turns by minus its own rest turn). */
const PROB = (() => { const L = 104, pts = [[78, 0]]; let x = 78, y = 0, th = -1.05; const n = 104;
  for(let i = 1; i <= n; i++){ const s = L * i / n, k = .05 + (.135 - .05) * Math.pow(s / L, 1); th += k * (L / n); x += Math.cos(th) * L / n; y += Math.sin(th) * L / n; pts.push([x, y]); }
  return pts; })();
const PROBN = M.chain('prob', PROB.map(([a, b]) => P(a, b)), 14, {parent:'head', grp:'mouth', lim:[-2.6, 2.6], speed:12});
const PROBREST = PROBN.map((n, i) => { const B = bone_(n), a = Math.atan2(B.q[1] - B.p[1], B.q[0] - B.p[0]); if(!i) return a; const Q = bone_(PROBN[i - 1]); return K.wrapA(a - Math.atan2(Q.q[1] - Q.p[1], Q.q[0] - Q.p[0])); });
/* the wings: per side a plane bone at the wing root (it turns the whole wing about the shoulder: the sweep, the fold back along the abdomen) and a chain along the wing's middle */
const WB = {fore:{R:[], L:[]}, hind:{R:[], L:[]}};
for(const s of SIDE) for(const G of [FW, HW]){
  const X = SN(s), pl = G === FW ? 'fwp' : 'hwp', pt = t => cvs(s, G.phi(t, .3)), r0 = pt(0);
  M.bone(pl + X, 'body', r0, [r0[0] + 26, r0[1]], {grp:'wing', anat:false, lim:s > 0 ? [-1.2, 1.8] : [-1.8, 1.2]});
  G.chainT.slice(0, -1).forEach((t, i) => { const n = G.key + X + i; M.bone(n, i ? G.key + X + (i - 1) : pl + X, pt(t), pt(G.chainT[i + 1]), {grp:'wing', lim:[-.5 - .35 * i, .5 + .35 * i], speed:7, sec:true}); WB[G.key][X].push(n); });
}
/* the six legs: hip, elbow (solved as the kit's IK will), wrist and toe. R0 R1 R2 then L0 L1 L2. The forelegs are short, as a brush-footed butterfly's are (drawn working, so the tripod reads). */
const HIP = [[40, 12], [6, 16], [-24, 16]], FOOT = [[80, 70], [16, 104], [-58, 96]], LEGS = [], BEND = [1, 1, 1];
for(const s of SIDE){
  const side = SN(s);
  HIP.forEach(([ha, hb], i) => {
    const tag = side + i, hip = P(ha, hb * s), foot = P(FOOT[i][0], FOOT[i][1] * s), wrist = [hip[0] + (foot[0] - hip[0]) * .8, hip[1] + (foot[1] - hip[1]) * .8];
    const d = Math.hypot(wrist[0] - hip[0], wrist[1] - hip[1]), l = d * .62, bend = s * BEND[i], E = elbow(hip, wrist, l, l, bend);
    const grp = ((i + (s > 0 ? 0 : 1)) & 1) ? 'B' : 'A';
    M.bone('u' + tag, 'body', hip, E, {grp, lim:[-2.2, 2.2], speed:9});
    M.bone('l' + tag, 'u' + tag, E, wrist, {grp, lim:[-2.6, 2.6], speed:9});
    M.bone('f' + tag, 'l' + tag, wrist, foot, {grp, lim:[-2.8, 2.8], speed:9});
    LEGS.push({s, side, i, tag, grp, bend, hip, E, wrist, foot});
  });
}
for(const L of LEGS) M.leg({bones:['u' + L.tag, 'l' + L.tag, 'f' + L.tag], bend:L.bend, kind:'leg' + L.i, side:L.s > 0 ? 'F' : 'N', grp:L.grp, roll:.6, reach:22});
/* two mechanism bones that carry the wing's held state (how far the elevator is on, how crumpled the wing is) as posture channels: an edge then stages them like any joint (the wings close and open on their own window,
   not on the average progress of the whole body), and postureHold reads them from the posture vector. Nothing is skinned to them. */
M.bone('stLift', 'body', P(0, 0), P(8, 0), {grp:'wing', anat:false, lim:[-2, 2]});
M.bone('stCrumple', 'body', P(0, 0), P(8, 0), {grp:'wing', anat:false, lim:[-2, 2]});
/* the scene: one tree (a bough, its leaves, the husk of a chrysalis), one milkweed (an umbel and a leaf) */
M.bone('bough', null, [280, 168], [920, 192], {grp:'scene', anat:false, lim:[-.1, .1]});
M.bone('husk', 'bough', [430, 172], [430, 410], {grp:'scene', anat:false, lim:[-.2, .2]});
M.bone('flower', null, [700, 770], [700, 585], {grp:'scene', anat:false, lim:[-.2, .2]});
M.bone('leaf', 'flower', [690, 622], [380, 628], {grp:'scene', anat:false, lim:[-.2, .2]});

/* ---------- the figure ----------
   The line model's colours, in the monarch's own terms: the membrane is ink (cinnabar, lifted toward the amber accent by the colour hook), the veins and the margins are bare skin (black),
   the white spots are bone. Lines are the gaps, so a dark hairline between orange triangles is what a vein is; the black ribbons over them are the thick veins. */
const LN = {wing:{k:.13, c:.1, r:'b', t:'cin', tk:.25}, vein:{k:.03, c:.03, r:0}, body:{k:.34, c:.7, r:'b', t:'bone', tk:.3}, bodyD:{k:.26, c:.5, r:'b', t:'bone', tk:.2}, spot:{k:.55, c:.8, r:0, t:'bone', tk:.6},
  leg:{k:.5, c:.85, r:'b', t:'bone', tk:.25}, thin:{k:.62, c:.88, r:'f', t:'bone', tk:.4}, fine:{k:.5, c:.8, r:'f', t:'bone', tk:.3}, scene:{k:.4, c:.7, r:'b', t:'umber', tk:.5}, rim:{k:.5, c:.9, r:'b', t:'bone', tk:.4}};
const mark = (P_, kind) => { P_.mk = kind; return P_; };
const VW = 1.12;       // the female's veins are thicker than the male's
function buildWing(G, s){
  const X = SN(s), key = G.key, bind = {chain:WB[key][X], sigma:48}, cv = p => cvs(s, p), phi = (t, w) => cv(G.phi(t, w));
  const tg = (...t) => ['wing', key, key + X, 'wing' + X, ...t], lay = G.layer, NT = 12, NE = 5, t0 = G.t0;
  { const pts = []; for(let q = 0; q <= 4; q++) pts.push(phi(t0 * q / 4, 0)); for(let q = 1; q <= 4; q++) pts.push(phi(t0, q / 4)); for(let q = 3; q >= 0; q--) pts.push(phi(t0 * q / 4, 1)); for(let q = 3; q >= 1; q--) pts.push(phi(0, q / 4));
    mark(M.zone(key + 'Root' + X, pts, {layer:lay, tier:'M', h:G.h, bind, line:LN.wing, tone:.4, zone:'skin', tags:tg('membrane', 'root')}), 'membrane'); }
  const tone0 = [.84, .76, .82, .76, .84];
  for(let j = 0; j + 1 < G.sectors.length; j++){
    const A = G.sectors[j], B_ = G.sectors[j + 1], pts = [];
    for(let q = 0; q <= NT; q++){ const t = lerp(t0, 1, q / NT); pts.push(phi(t, wl(A, t))); }
    for(let q = 1; q < NE; q++) pts.push(phi(1, lerp(wl(A, 1), wl(B_, 1), q / NE)));
    for(let q = NT; q >= 0; q--){ const t = lerp(t0, 1, q / NT); pts.push(phi(t, wl(B_, t))); }
    for(let q = 1; q < NE; q++) pts.push(phi(t0, lerp(wl(B_, t0), wl(A, t0), q / NE)));
    mark(M.zone(key + 'Cell' + j + X, pts, {layer:lay, tier:'M', h:G.h, bind, line:LN.wing, tone:tone0[j % 5], zone:'skin', tags:tg('membrane', 'cell')}), 'membrane');
  }
  const strip = (name, S, o) => mark(M.strip(name, S, {tier:'F', bind, line:LN.vein, tone:0, zone:'veins', tags:tg('vein'), ...o}), 'vein');
  for(const [nm, w0, w1, tS, tE, h0, h1] of G.veins){
    const L = {w0, w1}, n = Math.max(4, Math.round((tE - tS) * 16)), S = [];
    for(let q = 0; q <= n; q++){ const t = lerp(tS, tE, q / n), p = phi(t, wl(L, t)); S.push([p[0], p[1], lerp(h0, h1, q / n) * VW * (tS > .08 ? Math.min(1, .3 + 2.4 * q / n) : 1)]); }   // a branch is born thin
    strip(key + 'Vein' + nm + X, S, {layer:lay + .2});
  }
  G.cross.forEach((pts, i) => { const A = phi(...pts[0]), B_ = phi(...pts[pts.length - 1]), S = []; for(let q = 0; q <= 3; q++) S.push([lerp(A[0], B_[0], q / 3), lerp(A[1], B_[1], q / 3), 2.1 * VW]); strip(key + 'Cross' + i + X, S, {layer:lay + .2}); });
  { const S = []; for(let q = 0; q <= 18; q++){ const p = phi(G.band.t, lerp(.012, .988, q / 18)); S.push([p[0], p[1], G.band.hw]); } strip(key + 'Band' + X, S, {layer:lay + .3}); }
  if(key === 'fore'){
    const S = []; for(let q = 0; q <= 14; q++){ const p = phi(lerp(.0, .97, q / 14), .018); S.push([p[0], p[1], 3.6]); } strip('foreCosta' + X, S, {layer:lay + .25});
    const S2 = []; for(let q = 0; q <= 12; q++){ const p = phi(lerp(.12, .99, q / 12), .985); S2.push([p[0], p[1], 2.4]); } strip('foreInner' + X, S2, {layer:lay + .25});
    const pts = []; for(let q = 0; q <= 6; q++) pts.push(phi(lerp(.76, 1, q / 6), 0)); for(let q = 1; q <= 6; q++) pts.push(phi(1, .36 * q / 6)); for(let q = 1; q <= 5; q++) pts.push(phi(lerp(1, .82, q / 5), lerp(.36, .15, q / 5))); pts.push(phi(.78, .06));
    mark(M.zone('foreApex' + X, pts, {layer:lay + .1, tier:'M', h:14, bind, line:LN.vein, tone:0, zone:'veins', tags:tg('apex')}), 'black');
  }
  const rows = []; for(const [t, n, r, w0, w1] of G.rows){ const list = []; for(let q = 0; q < n; q++) list.push(ringPts(phi(t, lerp(w0, w1, n > 1 ? q / (n - 1) : .5)), r, 8)); rows.push(list); }
  mark(M.shapes(key + 'SpotsM' + X, rows[0], {layer:lay + .5, tier:'F', bind, line:LN.spot, tone:.95, zone:'spots', tags:tg('spot')}), 'spot');
  mark(M.shapes(key + 'SpotsS' + X, rows[1], {layer:lay + .5, tier:'F', bind, line:LN.spot, tone:.95, zone:'spots', tags:tg('spot')}), 'spot');
  if(G.apexSpots) mark(M.shapes(key + 'SpotsA' + X, G.apexSpots.map(([t, w, r]) => ringPts(phi(t, w), r, 9)), {layer:lay + .5, tier:'F', bind, line:LN.spot, tone:.95, zone:'spots', tags:tg('spot')}), 'spot');
}
FW.band = {t:.968, hw:13}; FW.rows = [[.976, 15, 4.3, .05, .95], [.925, 11, 3.2, .1, .92]]; FW.apexSpots = [[.86, .07, 6.4], [.91, .17, 5.4], [.81, .16, 5], [.955, .27, 4]];
HW.band = {t:.966, hw:11}; HW.rows = [[.972, 13, 4.6, .04, .96], [.918, 9, 3, .1, .9]];
for(const s of SIDE){ buildWing(HW, s); buildWing(FW, s); }

/* the body: ten dark, white-spotted segments on a three-bone chain, a robust thorax, a small round head with two eyes, clubbed antennae, palps and the coiled proboscis */
const interp = (T, u) => { for(let i = 0; i < T.length - 1; i++) if(u <= T[i + 1][0]) return lerp(T[i][1], T[i + 1][1], (u - T[i][0]) / (T[i + 1][0] - T[i][0] || 1)); return T[T.length - 1][1]; };
const HWID = [[0, 12], [.22, 15.5], [.5, 15], [.74, 11], [.9, 6.8], [1, 3]], SEGN = 10, SEGL = 15.4, SEG0 = -18;
const hwAt = a => interp(HWID, clamp((SEG0 - a) / (SEGN * SEGL)));
for(let i = 0; i < SEGN; i++){
  const a0 = SEG0 - SEGL * i + .8, a1 = SEG0 - SEGL * (i + 1), am = (a0 + a1) / 2, pts = [[a0, 1], [am, 1], [a1, 1], [a1, -1], [am, -1], [a0, -1]].map(([a, k]) => P(a, k * hwAt(a)));
  mark(M.zone('seg' + i, pts, {layer:7 + i * .001, tier:'F', h:9, bind:{chain:ABD, sigma:20}, line:LN.bodyD, tone:.1 + .01 * (i % 2), zone:'skin', tags:['body', 'abdomen']}), 'body');
}
{ const list = []; for(let i = 1; i < SEGN; i++){ const a = SEG0 - SEGL * (i + .5); for(const s of SIDE) list.push(ringPts(P(a, s * hwAt(a) * .72), 2.3 - .09 * i, 7)); }
  mark(M.shapes('abdSpots', list, {layer:7.3, tier:'F', bind:{chain:ABD, sigma:20}, line:LN.spot, tone:.95, zone:'spots', tags:['body', 'abdomen', 'spot']}), 'spot'); }
mark(M.zone('ovipositor', chaikin([P(-172, -3), P(-176, 0), P(-172, 3), P(-166, 4), P(-166, -4)], 1), {layer:7.1, tier:'F', h:5, bind:{rigid:ABD[2]}, line:LN.bodyD, tone:.2, zone:'skin', tags:['body', 'abdomen']}), 'body');
mark(M.zone('thorax', chaikin(ellipsePts(P(12, 0), 37, 22, 16), 1), {layer:7.4, tier:'M', h:13, bind:{rigid:'body'}, line:LN.body, tone:.12, zone:'skin', tags:['body', 'thorax']}), 'body');
mark(M.zone('collar', chaikin(ellipsePts(P(41, 0), 9, 17, 10), 1), {layer:7.5, tier:'F', h:7, bind:{rigid:'body'}, line:LN.body, tone:.18, zone:'skin', tags:['body', 'thorax']}), 'body');
M.line('thoraxLine', [P(34, 0), P(12, 0), P(-12, 0)], {layer:7.55, tier:'F', bind:{rigid:'body'}, line:{k:.22, c:.34, r:'f', t:'bone', tk:.2}, tone:.3, zone:'skin', tags:['body', 'thorax']});
{ const list = []; for(const s of SIDE) for(const [a, b, r] of [[40, 8, 2.6], [30, 15, 2.8], [18, 17, 2.8], [4, 16, 2.6], [-8, 12, 2.2], [26, 6, 2]]) list.push(ringPts(P(a, b * s), r, 7));
  mark(M.shapes('thoraxSpots', list, {layer:7.6, tier:'F', bind:{rigid:'body'}, line:LN.spot, tone:.95, zone:'spots', tags:['body', 'thorax', 'spot']}), 'spot'); }
mark(M.zone('head', chaikin(ellipsePts(P(62, 0), 15, 18, 14), 1), {layer:8, tier:'F', h:9, bind:{rigid:'head'}, line:LN.body, tone:.12, zone:'skin', tags:['body', 'head']}), 'body');
for(const s of SIDE){
  const X = SN(s);
  M.polar('eye' + X, P(60, 12 * s), [0, 3.6, 7.6], [6, 12], {layer:8.3, tier:'F', ptier:'F', bind:{rigid:'head'}, ink:'accent', line:LN.rim, tone:(x, y) => Math.hypot(x - (CX + 60), y - (CY + 12 * s)) < 3.8 ? .06 : .58, zone:'eyes', tags:['head', 'eye'], twist:.3});
  mark(M.shape('palp' + X, chaikin(ellipsePts(P(86, 9 * s), 12, 4, 8, s * .2), 1), {layer:8.1, tier:'F', bind:{rigid:'head'}, line:LN.bodyD, tone:.25, zone:'skin', tags:['head', 'palp']}), 'body');
  mark(M.shapes('headSpots' + X, [ringPts(P(70, 6 * s), 2, 6), ringPts(P(52, 14 * s), 2.2, 6), ringPts(P(66, 16 * s), 1.8, 6)], {layer:8.2, tier:'F', bind:{rigid:'head'}, line:LN.spot, tone:.95, zone:'spots', tags:['head', 'spot']}), 'spot');
  /* the antenna: a filament on four bones and a club at its end */
  ANT[X].forEach((n, i) => { const b = bone_(n); M.limb('antenna' + X + i, [[b.p[0], b.p[1], 1.9 - .1 * i, 1.9 - .1 * i], [b.q[0], b.q[1], 1.7 - .1 * i, 1.7 - .1 * i]], {layer:8.4, tier:'F', h:4, noSil:true, bind:{rigid:n}, line:LN.thin, tone:.35, zone:'feelers', tags:['head', 'antenna']}); });
  { const b = bone_(ANT[X][3]), dx = (b.q[0] - b.p[0]) / b.len, dy = (b.q[1] - b.p[1]) / b.len, q2 = [b.q[0] + dx * 12, b.q[1] + dy * 12], m = [b.p[0] + (b.q[0] - b.p[0]) * .45, b.p[1] + (b.q[1] - b.p[1]) * .45];
    M.limb('club' + X, [[m[0], m[1], 1.6, 1.6], [b.q[0] - dx * 5, b.q[1] - dy * 5, 4.2, 4.2], [q2[0], q2[1], 3, 3]], {layer:8.45, tier:'F', h:4, noSil:true, bind:{rigid:ANT[X][3]}, line:LN.thin, tone:.2, zone:'feelers', tags:['head', 'antenna']}); }
}
PROBN.forEach((n, i) => { const b = bone_(n), w = 2.1 - .05 * i; M.limb('proboscis' + i, [[b.p[0] - (b.q[0] - b.p[0]) * .12, b.p[1] - (b.q[1] - b.p[1]) * .12, w, w], [b.q[0] + (b.q[0] - b.p[0]) * .12, b.q[1] + (b.q[1] - b.p[1]) * .12, w - .05, w - .05]], {layer:8.5 + i * .001, tier:'F', h:3, noSil:true, bind:{rigid:n}, line:LN.thin, tone:.55, zone:'mouth', tags:['head', 'mouth', 'proboscis']}); });
/* the legs: rigid tapering segments, a knee patch, a tarsus and a small claw at the toe; they lie under the wings (as they do in life) */
for(const L of LEGS){
  const u = bone_('u' + L.tag), l = bone_('l' + L.tag), f = bone_('f' + L.tag), sc = L.i === 0 ? .82 : 1;
  const mk_ = (b, w0, w1, name) => M.limb(name + L.tag, [[b.p[0], b.p[1], w0 * sc, w0 * sc], [(b.p[0] + b.q[0]) / 2, (b.p[1] + b.q[1]) / 2, (w0 + w1) * sc / 2, (w0 + w1) * sc / 2], [b.q[0], b.q[1], w1 * sc, w1 * sc]], {layer:3, tier:'F', h:7, bind:{rigid:b.name}, noSil:true, line:LN.leg, tone:.14, zone:'legs', tags:['leg']});
  mk_(u, 5.4, 4.4, 'upper'); mk_(l, 4.2, 3.2, 'lower'); mk_(f, 2.9, 1.6, 'tarsus');
  M.zone('knee' + L.tag, ringPts(l.p, 5.6 * sc, 8, 0), {layer:3.1, tier:'F', h:6, inset:.4, bind:{mix:[[u.name, .5], [l.name, .5]]}, line:LN.leg, tone:.3, zone:'legs', tags:['leg']});
  const q = f.q, dx = (q[0] - f.p[0]) / f.len, dy = (q[1] - f.p[1]) / f.len, nx = -dy, ny = dx;
  M.shape('claw' + L.tag, [[q[0] - dx * 2, q[1] - dy * 2], [q[0] + dx * 6 + nx * 3, q[1] + dy * 6 + ny * 3], [q[0] + dx * 9, q[1] + dy * 9], [q[0] + dx * 6 - nx * 3, q[1] + dy * 6 - ny * 3]], {layer:3.2, tier:'F', bind:{rigid:f.name}, line:LN.leg, tone:.8, zone:'legs', tags:['leg', 'foot']});
}

/* ---------- the scene: the bough with its leaves and a chrysalis case, the milkweed with an umbel and a leaf; the egg appears on the leaf when it is laid ---------- */
const LEAFP = (c, ang, L, w, n = 9) => { const ca = Math.cos(ang), sa = Math.sin(ang), side = k => Array.from({length:n + 1}, (_, i) => { const u = i / n, v = k * w * Math.pow(Math.sin(Math.PI * Math.pow(u, .8)), .85); return [c[0] + ca * L * u - sa * v, c[1] + sa * L * u + ca * v]; });
  return side(1).concat(side(-1).reverse().slice(1, -1)); };
const SCN = {layer:2.1, tier:'M', line:LN.scene, zone:'scene', noSil:true};
M.limb('bough', [[270, 160, 14, 14], [400, 170, 17, 17], [560, 168, 16, 16], [720, 176, 14, 14], [850, 188, 11, 11], [930, 196, 7, 7]], {...SCN, h:15, bind:{rigid:'bough'}, tone:.2, tags:['scene', 'bough']});
M.limb('twigA', [[610, 174, 6, 6], [650, 222, 5, 5], [700, 250, 3.4, 3.4]], {...SCN, h:10, layer:2.15, bind:{rigid:'bough'}, tone:.2, tags:['scene', 'bough']});
M.limb('twigB', [[790, 182, 5, 5], [830, 226, 4, 4], [884, 262, 2.6, 2.6]], {...SCN, h:10, layer:2.15, bind:{rigid:'bough'}, tone:.2, tags:['scene', 'bough']});
{ const L = [[330, 168, 1.62, 92, 22], [520, 178, 1.9, 86, 21], [610, 180, 1.45, 96, 24], [700, 252, 1.7, 90, 22], [880, 262, 1.5, 84, 20], [780, 190, 1.85, 88, 22], [884, 196, 1.3, 70, 17]];
  mark(M.shapes('foliage', L.map(([x, y, a, l, w]) => LEAFP([x, y], a, l, w)), {...SCN, layer:2.2, tier:'M', bind:{rigid:'bough'}, tone:.22, tags:['scene', 'foliage']}), 'foliage');
  M.shapes('shaftFoliage', L.map(([x, y, a, l]) => { const ca = Math.cos(a), sa = Math.sin(a); return [[x, y], [x + ca * l * .92 - sa * 1.2, y + sa * l * .92 + ca * 1.2], [x + ca * l * .92 + sa * 1.2, y + sa * l * .92 - ca * 1.2]]; }), {layer:2.22, noSil:true, tier:'F', bind:{rigid:'bough'}, line:LN.fine, tone:.5, zone:'scene', tags:['scene', 'foliage']}); }
/* the chrysalis case: a jade teardrop hanging from the bough by a stalk, a black band and a row of gold beads near its top; seen through it, the adult folded inside */
const HUSK = chaikin([[430, 176], [439, 188], [449, 208], [465, 238], [477, 276], [480, 318], [472, 358], [452, 392], [430, 412], [408, 392], [388, 358], [380, 318], [383, 276], [395, 238], [411, 208], [421, 188]], 1);
mark(M.zone('case', HUSK, {layer:2.25, noSil:true, tier:'M', h:24, bind:{rigid:'husk'}, line:LN.scene, tone:.5, zone:'scene', show:'pupa', tags:['scene', 'case']}), 'jade');
M.rim('husk', HUSK, {layer:2.3, bind:{rigid:'husk'}, line:LN.fine, noSil:true, zone:'scene', tags:['scene', 'case', 'caseTop'], s:9});
M.line('slit', [[430, 336], [433, 362], [428, 390], [430, 411]], {layer:2.31, bind:{rigid:'husk'}, line:LN.fine, noSil:true, zone:'scene', tags:['scene', 'case', 'caseTop']});
{ const arc = (a, y0, k, n) => Array.from({length:n}, (_, i) => { const u = (i / (n - 1) - .5) * 2; return [430 + u * a, y0 + k * u * u]; });
  M.strip('goldBand', arc(40, 222, 8, 9).map(([x, y]) => [x, y, 2.6]), {layer:2.31, noSil:true, tier:'F', bind:{rigid:'husk'}, line:LN.vein, tone:0, zone:'scene', tags:['scene', 'case', 'caseTop']});
  M.shapes('goldDots', [...arc(38, 236, 9, 8).map(p => ringPts(p, 3.1, 7)), ...arc(30, 254, 8, 7).map(p => ringPts(p, 2.2, 6))], {layer:2.32, tier:'F', bind:{rigid:'husk'}, ink:'gold', line:'glyph', tone:.92, zone:'glyph', tags:['glyph', 'scene', 'case', 'caseTop', 'beads']}); }
/* the milkweed: a stem, a flat umbel of small flowers (pink, which is the ink), and one big leaf */
M.limb('stem', [[700, 780, 5.4, 5.4], [698, 700, 4.6, 4.6], [702, 640, 4, 4], [700, 598, 3.4, 3.4]], {...SCN, layer:2.1, h:12, bind:{rigid:'flower'}, tone:.22, tags:['scene', 'milkweed']});
{ const list = [], cen = [700, 572]; list.push(ringPts(cen, 9, 6)); for(let i = 0; i < 7; i++) list.push(ringPts([cen[0] + Math.cos(i * 6.2832 / 7 + .3) * 26, cen[1] + Math.sin(i * 6.2832 / 7 + .3) * 24], 9, 6)); for(let i = 0; i < 11; i++) list.push(ringPts([cen[0] + Math.cos(i * 6.2832 / 11) * 45, cen[1] + Math.sin(i * 6.2832 / 11) * 41], 8.2, 6));
  mark(M.shapes('umbel', list, {layer:2.5, noSil:true, tier:'F', bind:{rigid:'flower'}, line:LN.rim, tone:.55, zone:'scene', tags:['scene', 'milkweed', 'umbel']}), 'bloom');
  M.shapes('umbelHeads', list.map(p => { const c = [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length]; return ringPts(c, 3.2, 5); }), {layer:2.55, noSil:true, tier:'F', bind:{rigid:'flower'}, line:LN.fine, tone:.3, zone:'scene', tags:['scene', 'milkweed', 'umbel']}); }
{ const ang = Math.PI + .02, ca = Math.cos(ang), sa = Math.sin(ang), O = [686, 622], LL = 306, LP = LEAFP(O, ang, LL, 46, 14);
  mark(M.zone('mleaf', LP, {...SCN, layer:2.4, h:26, bind:{rigid:'leaf'}, tone:.24, tags:['scene', 'milkweed', 'mleaf']}), 'foliage');
  M.strip('mleafRib', Array.from({length:8}, (_, i) => { const u = .02 + .94 * i / 7; return [O[0] + ca * LL * u, O[1] + sa * LL * u, 2.4 - 1.5 * u]; }), {layer:2.45, tier:'F', bind:{rigid:'leaf'}, line:LN.fine, tone:.5, zone:'scene', tags:['scene', 'milkweed', 'mleaf']});
  M.shapes('mleafVeins', Array.from({length:12}, (_, i) => { const u = .1 + .07 * i, side = i % 2 ? 1 : -1, c = [O[0] + ca * LL * u, O[1] + sa * LL * u], w = 38 * Math.sin(Math.PI * Math.pow(u, .8)), e = [c[0] + ca * 18 - sa * side * w, c[1] + sa * 18 + ca * side * w];
    return [[c[0], c[1]], [e[0], e[1]], [e[0] + 1.6, e[1] + 1.6], [c[0] + 1.6, c[1] + 1.6]]; }), {layer:2.45, noSil:true, tier:'F', bind:{rigid:'leaf'}, line:LN.fine, tone:.45, zone:'scene', tags:['scene', 'milkweed', 'mleaf']}); }
[[408, 627], [446, 626], [486, 625]].forEach(([x, y], i) => mark(M.shape('egg' + (i + 1), ringPts([x, y], 4.2, 8), {layer:2.9, noSil:true, tier:'F', bind:{rigid:'leaf'}, line:LN.rim, tone:.9, zone:'scene', show:'egg' + (i + 1), tags:['scene', 'egg']}), 'egg'));

/* ---------- muscles: real names, each turning the joints it really turns; one per side where the body has two ----------
   The flight muscles of a butterfly are indirect: dorsolongitudinal and dorsoventral muscles in the thorax deform it, and the wing hinge turns that into a stroke; the direct muscles (basalar,
   subalar) steer the wing, sweeping it forward and back. Here the elevator is a field that foreshortens the wing across the body axis (the plane seen from above), and the direct muscles turn
   the wing plane about the shoulder. The crumple is the unexpanded wing: it shrinks the wing about its root until the haemolymph has been pumped into the veins. */
const glow = (c, rx, ry, a = .4) => K.glow(c[0], c[1], rx, ry, a);
const mus = (id, d) => M.muscle(id, d), BIG = [4000, 4000];
for(const s of SIDE){
  const X = SN(s), sg = s, sh = P(18, 12 * s);
  mus('fwLift' + X, {name:'tergosternal: forewing elevator (' + X + ')', g:'wing', c:P(0, 0), r:BIG, pull:[0, .93], on:['fore' + X], hue:'#7ec3e6', speed:24});
  mus('hwLift' + X, {name:'tergosternal: hindwing elevator (' + X + ')', g:'wing', c:P(0, 0), r:BIG, pull:[0, .93], on:['hind' + X], hue:'#9aa6d8', speed:24});
  mus('crumple' + X, {name:'unexpanded wing: the crumple (' + X + ')', g:'wing', c:P(14, 20 * s), r:BIG, pull:[.82, .82], on:['wing' + X], hue:'#c79ae0', speed:10});
  mus('basalar' + X, {name:'basalar: sweeps the forewing forward (' + X + ')', g:'wing', c:sh, r:[34, 24], on:['thorax'], jt:[['fwp' + X, -sg * .55]], hue:'#e3806f', speed:22});
  mus('subalar' + X, {name:'subalar: sweeps the forewing back (' + X + ')', g:'wing', c:P(8, 14 * s), r:[34, 24], on:['thorax'], jt:[['fwp' + X, sg * .7]], hue:'#ffbe00', speed:22});
  mus('hwSweep' + X, {name:'pleural: swings the hindwing (' + X + ')', g:'wing', c:P(0, 14 * s), r:[34, 24], on:['thorax'], jt:[['hwp' + X, sg * .5]], hue:'#d985a6', speed:20});
  mus('fwTip' + X, {name:'wing flexor: bends the forewing tip back (' + X + ')', g:'wing', c:P(30, 120 * s), r:[60, 60], on:['fore' + X], jt:[['fore' + X + '0', sg * .08], ['fore' + X + '1', sg * .3], ['fore' + X + '2', sg * .55]], hue:'#5cc6b4', speed:18});
  mus('hwTip' + X, {name:'wing flexor: bends the hindwing tip back (' + X + ')', g:'wing', c:P(-80, 120 * s), r:[60, 60], on:['hind' + X], jt:[['hind' + X + '0', sg * .1], ['hind' + X + '1', sg * .5]], hue:'#5cc6b4', speed:18});
  mus('antSweep' + X, {name:'antennal levator: sweeps the ' + (s > 0 ? 'right' : 'left') + ' antenna out', g:'antenna', c:P(110, 30 * s), r:[40, 30], on:['antenna'], jt:ANT[X].map(n => [n, sg * .13]), hue:'#9aa6d8', speed:12, shade:glow(P(110, 30 * s), 34, 26, .3)});
  mus('antCurl' + X, {name:'antennal flexor: curls the ' + (s > 0 ? 'right' : 'left') + ' antenna in', g:'antenna', c:P(120, 38 * s), r:[40, 30], on:['antenna'], jt:ANT[X].map((n, i) => [n, -sg * (.05 + .08 * i)]), hue:'#7ec3e6', speed:10});
}
mus('breath', {name:'the breath (abdominal pump)', g:'body', c:P(-95, 0), r:[70, 26], pull:[0, -.05], on:['abdomen'], hue:'#8fd0a8', speed:5, shade:glow(P(-95, 0), 60, 20, .25)});
mus('dlm', {name:'dorsolongitudinal: thorax, downstroke', g:'body', c:P(12, 0), r:[40, 26], pull:[-.05, .02], on:['thorax'], hue:'#e3806f', speed:20});
mus('dvm', {name:'dorsoventral: thorax, upstroke', g:'body', c:P(12, 0), r:[40, 26], pull:[.03, -.06], on:['thorax'], hue:'#7ec3e6', speed:20});
mus('abdCurlR', {name:'abdominal flexor: curls the abdomen to the right', g:'body', c:P(-95, 10), r:[70, 26], on:['abdomen'], jt:ABD.map((n, i) => [n, -(.14 + .08 * i)]), hue:'#e3806f', speed:7, shade:glow(P(-95, 10), 60, 18, .3)});
mus('abdCurlL', {name:'abdominal flexor: curls the abdomen to the left', g:'body', c:P(-95, -10), r:[70, 26], on:['abdomen'], jt:ABD.map((n, i) => [n, .14 + .08 * i]), hue:'#ffbe00', speed:7, shade:glow(P(-95, -10), 60, 18, .3)});
mus('headR', {name:'splenius: turns the head right', g:'head', c:P(48, 8), r:[26, 20], on:['head'], jt:[['head', .5]], hue:'#9aa6d8', speed:8});
mus('headL', {name:'splenius: turns the head left', g:'head', c:P(48, -8), r:[26, 20], on:['head'], jt:[['head', -.5]], hue:'#9aa6d8', speed:8});
/* the proboscis uncoils under haemolymph pressure (each bone turns by minus its own rest turn); one muscle swings it */
mus('probExt', {name:'proboscis uncoiling (stipital pressure)', g:'mouth', c:P(92, 0), r:[26, 20], on:['proboscis'], jt:PROBN.map((n, i) => [n, -PROBREST[i]]), hue:'#d985a6', speed:9, shade:glow(P(92, 0), 22, 18, .3)});
mus('probSwing', {name:'proboscis swing (the probing)', g:'mouth', c:P(86, 0), r:[26, 20], on:['proboscis'], jt:[[PROBN[0], .35]], hue:'#c79ae0', speed:10});
/* the scene's own motion: a breeze on the bough, the husk, the umbel and the leaf; the chrysalis heart; the things the figure's state shows */
mus('breezeBough', {name:'(breeze: the bough)', g:'scene', c:[600, 172], r:[80, 24], jt:[['bough', .02]], hue:'#8fd0a8', speed:3});
mus('breezeHusk', {name:'(breeze: the husk)', g:'scene', c:[430, 300], r:[40, 80], jt:[['husk', .05]], hue:'#8fd0a8', speed:3});
mus('breezeFlower', {name:'(breeze: the umbel)', g:'scene', c:[700, 640], r:[40, 100], jt:[['flower', .03]], hue:'#8fd0a8', speed:3});
mus('breezeLeaf', {name:'(breeze: the milkweed leaf)', g:'scene', c:[540, 624], r:[100, 30], jt:[['leaf', .06]], hue:'#8fd0a8', speed:3});
mus('heart', {name:'dorsal vessel: the pupa\'s heart', g:'scene', c:[430, 300], r:[70, 110], pull:[-.06, -.045], on:['case'], hue:'#e0523f', speed:16});
mus('pupa', {name:'(the chrysalis: the adult is inside)', g:'scene', hue:'#d4a03c', speed:7});
for(const i of [1, 2, 3]) mus('egg' + i, {name:'(egg ' + i + ' laid)', g:'scene', hue:'#d4a03c', speed:12});

/* ---------- postures: where the body is held ----------
   bask (basking: the wings flat to the sun, the feet on the ground) · roost (hung head up from the bough, the wings closed) · fly (the wingbeat; the legs drawn up) · feed (over the umbel, the proboscis
   reaching it) · emerge (just out of the chrysalis, hung from the empty case, the wings crumpled) · pupa (the adult, folded, seen through its own case) · down (on the ground, the wings still).
   The wings' own state (the elevator, the crumple) is held by the postureHold hook from the posture weights; the sweep is a joint channel here. */
const foot = (L, r = 1, da = 0, db = 0) => { const h = L.hip, w = bone_('f' + L.tag).p, q = bone_('f' + L.tag).q, t = [w[0] - h[0], w[1] - h[1]]; return [h[0] + t[0] * r + (q[0] - w[0]) + da, h[1] + t[1] * r + (q[1] - w[1]) + db, Math.atan2(q[1] - w[1], q[0] - w[0])]; };
const feet = (r = 1, da = 0, db = 0) => LEGS.map(L => foot(L, r, da, db));
const grip = () => LEGS.map(L => foot(L, 1, 22, 0));   // the legs reach out and forward to the twig: a foot far from folded (a tightly folded leg cannot be solved)
const SWEEP = (f, h = f, lift = 0, crumple = 0) => ({fwpR:f, fwpL:-f, hwpR:h, hwpL:-h, stLift:lift, stCrumple:crumple});   // the wing's sweep, and the state the elevator and the crumple hold
const PI2 = Math.PI / 2;
const ANTJ = k => Object.fromEntries(ANT.R.map((n, i) => [n, Array.isArray(k) ? k[i] : k]).concat(ANT.L.map((n, i) => [n, -(Array.isArray(k) ? k[i] : k)])));   // every antenna bone turned k (out for positive on the right, mirrored on the left)
/* the legs' targets are in the WORLD (the kit solves the IK from the hip as the root has put it): a posture that turns or lifts the root states its feet through the same transform */
const RT = (root, p) => { const [dx, dy, r] = root, c = Math.cos(r), s = Math.sin(r), x = p[0] - CX, y = p[1] - CY; return [CX + c * x - s * y + dx, CY + s * x + c * y + dy]; };
const POSE = (name, o) => { const root = o.root || [0, 0, 0], F = o.feet || feet(1); M.posture(name, {...o, feet:F.map(f => { const q = RT(root, f); return [q[0], q[1], f[2] + root[2]]; })}); };
POSE('bask', {});
POSE('roost', {root:[100, -122, -PI2], jt:SWEEP(.14, .2, .88), feet:grip()});
POSE('fly', {root:[0, -78, -.05], jt:SWEEP(0, .04, .06), feet:feet(.5)});
POSE('feed', {root:[34, 150, .25], jt:SWEEP(.22, .26, .5), feet:feet(.78)});
POSE('emerge', {root:[-70, 100, -PI2], jt:{...SWEEP(1.38, 1.42, 0, .74), ...ANTJ(.25)}, feet:grip()});
POSE('pupa', {root:[-70, -60, PI2], jt:{...SWEEP(1.5, 1.5, 0, .8), ...ANTJ([1.15, .55, .3, 0])}, feet:LEGS.map(L => { const p = P([66, 34, 4][L.i], 26 * L.s); return [p[0], p[1], Math.atan2(p[1] - L.hip[1], p[0] - L.hip[0])]; })});
POSE('down', {root:[-30, 62, .5], jt:{fwpR:.34, fwpL:-.08, hwpR:.1, hwpL:-.04, stLift:.3, head:.2, ...ANTJ(-.3)}, feet:feet(1, 0, 0)});
const GW = (w, r, A = [0, 1500], B = [250, 1500]) => ({wing:w, root:r, A, B, head:[300, 1600], abdomen:[200, 2000], antenna:[0, 1600], mouth:[0, 1200]});
M.edge('bask>roost', {ms:4400, g:GW([0, 1500], [700, 2800], [900, 2400], [1100, 2400])});
M.edge('bask>fly', {ms:3400, g:GW([300, 1800], [400, 2200], [0, 1000], [100, 1000]), bumps:[['ry', 0, 900, 22]]});
M.edge('bask>feed', {ms:3800, g:GW([200, 1600], [500, 2600], [800, 2300], [900, 2300])});
M.edge('bask>down', {ms:2800, g:GW([0, 1200], [300, 2200], [300, 2000], [400, 2000])});
M.edge('roost>fly', {ms:3800, g:GW([600, 1800], [0, 2600], [900, 2400], [1000, 2400]), bumps:[['ry', 600, 1100, 24]]});
M.edge('fly>feed', {ms:3800, g:GW([0, 1800], [200, 2800], [1800, 1800], [1900, 1800])});
M.edge('fly>down', {ms:3200, g:GW([0, 1400], [400, 2400], [1600, 1400], [1700, 1400])});
M.edge('emerge>bask', {ms:5600, g:GW([0, 3600], [1300, 3600], [2600, 2600], [2700, 2600])});
M.edge('emerge>roost', {ms:6200, g:GW([0, 3200], [800, 4400], [3400, 2500], [3500, 2500])});
M.edge('pupa>emerge', {ms:7600, g:{wing:[2800, 3600], root:[600, 5600], A:[3000, 4000], B:[3200, 4000], head:[800, 3000], abdomen:[1200, 4000], antenna:[2600, 3000], mouth:[2600, 3000], scene:[0, 2000]}, c:{ry:[1800, 4200], rx:[1800, 4200], rr:[1800, 4200]}, bumps:[['rx', 1800, 4200, -78]]});   // the body turns half a circle about its head, which stays at the case's mouth (the bump is the head's own offset from the pivot)
M.transitCost('pupa', 3000);

/* ---------- gaits: the alternating tripod. A = R0 L1 R2 against B = L0 R1 L2; a larger `off` lands earlier. The wings fold to a tent while it walks (the idle hook). ---------- */
const N6 = 6, arr = f => LEGS.map(f);
const OFF = () => arr(L => (((L.i + (L.s > 0 ? 0 : 1)) & 1) ? .5 : 0) + .02 * (2 - L.i)), LIFT = arr(L => -L.s * 13), FLEX = arr(L => L.s * .4);
M.gait('creep', {psi:.5, base:'bask', label:'Creep', L:22, cyc:1100, duty:.62, lift:LIFT, off:OFF(), flex:FLEX, hs:new Array(N6).fill(0), bob:.8, cap:1.8, lead:0});
M.gait('walk', {psi:1, base:'bask', label:'Walk', L:42, cyc:880, duty:.6, lift:LIFT, off:OFF(), flex:FLEX, hs:new Array(N6).fill(0), bob:1.2, cap:1.8, lead:0});

const MAL = K.hexInt(K.ROSTER.malachite), AMB = K.hexInt(K.ROSTER.amber), GOLD = K.hexInt(K.ROSTER.gold);

/* ---------- the figure's own state: the wingbeat, the heart, the eggs, the bearing ----------
   Run from the idle hook every frame, and made again when the clock goes back (c.reset). The state lives on c.mon (the kit already owns c.mn). */
const FREQ = 1.7;                                           // wingbeats a second at cruise: a real monarch beats 5 to 10, which a 60 Hz screen and the gate's frame limit cannot follow
const thOf = u => rad(16) + rad(46) * Math.cos(2 * Math.PI * u) + rad(5) * Math.cos(4 * Math.PI * u - .9);   // the wing's elevation: +66 degrees at the top of the stroke, -33 at the bottom
const liftOf = u => clamp((1 - Math.cos(thOf(u))) / .93, 0, 1);    // seen from above the span is the cosine of the elevation: this is the elevator's activation
const newMn = () => ({t:0, ph:0, k:0, bout:true, nextBout:0, flyAt:-1, kCap:1, kForce:null, lp:0, sway:0, hbAt:-1e9, hbNext:0, exp:0, eggs:0, bear:0, relay:0, raised:false, dash:0, lw:1});
const state = c => { if(!c.mon || c.t < c.mon.t - 1){ c.mon = newMn(); for(let i = 0; i < c.d.NPOLY; i++) c.colDirty.add(i); } return c.mon; };   // (the kit paints the colour hook only on a polygon that changes: mark them all, once)
const bonePt = (c, name, u = 1) => { const B = bone_(name); return c.wp(name, [B.p[0] + (B.q[0] - B.p[0]) * u, B.p[1] + (B.q[1] - B.p[1]) * u]); };

function figureStep(c, now, dt){
  const E = state(c), w = c.pm.w, node = c.pm.node, tr = c.pm.tr, T = c.Tp, tmp = Math.min(c.tempo, 1.25), mf = clamp(c.mot.scale, .5, 1.3), q = c.pad.flight.L;
  E.t = now;
  /* the wingbeat: bouts of flapping and glides in the flight posture, a steady beat in a relay, none anywhere else (the flight weight fades it in and out) */
  const fw = w.fly || 0, inFly = node === 'fly' && !tr;
  if(inFly){ if(E.flyAt < 0) E.flyAt = now; } else E.flyAt = -1;
  const take = (tr && tr.b === 'fly') || (inFly && now - E.flyAt < 2400);
  if(take){ E.bout = true; E.nextBout = now + 4200; }
  else if(inFly && now > E.nextBout){ E.bout = !E.bout; E.nextBout = now + (E.bout ? 3800 + c.rand() * 3200 : 2200 + c.rand() * 2200); }
  let kT = take ? 1 : E.kForce ?? Math.min(E.bout ? 1 : 0, E.kCap);
  kT = q[0] < 0 ? kT * (1 + q[0]) : Math.max(kT, q[0]);
  E.k += (kT - E.k) * (1 - Math.exp(-dt / 520));
  E.ph = (E.ph + dt * tmp * FREQ * Math.pow(2, .7 * q[1]) / 1000) % 1;
  const A = E.k * fw * mf, lf = liftOf(E.ph), lh = liftOf(E.ph - .09), lfv = (lf - E.lp) / Math.max(dt, 1) * 1000, sw = Math.sin(2 * Math.PI * (E.ph + .02)), sh = Math.sin(2 * Math.PI * (E.ph - .07));
  E.lp = lf; E.sway += dt * .0013;
  if(fw > .002){
    const dF = A * (lf - .06), dH = A * (lh - .06), tip = -A * clamp(lfv * .07, -.5, .5);
    c.spec(T, {fwLiftR:dF, fwLiftL:dF, hwLiftR:dH, hwLiftL:dH, basalarR:A * pos(sw) * .55, basalarL:A * pos(sw) * .55, subalarR:A * pos(-sw) * .43, subalarL:A * pos(-sw) * .43,
      hwSweepR:-.4 * sh * A, hwSweepL:-.4 * sh * A, fwTipR:tip, fwTipL:tip, hwTipR:tip * .8, hwTipL:tip * .8, dlm:A * pos(-lfv) * .22, dvm:A * pos(lfv) * .22});
    c.Q.bx += 5 * A * Math.sin(2 * Math.PI * (E.ph - .05)); c.Q.by += 4 * A * fw * Math.sin(E.sway);
    c.jd(ABD[0], .03 * A * Math.sin(2 * Math.PI * (E.ph + .2)));
  }
  E.kCap = 1; E.kForce = null;
  /* a posture change turns and lifts the body while the legs would have to carry their targets through it (half a circle from the pupa), and an IK leg that took the wrong branch stays on it: for the middle of every edge the legs ride the body (IK weight 0, which also clears the solver's memory) and are solved afresh at either end */
  { const meta = !!tr, u = meta ? tr.t / tr.ms : 0, lwT = meta ? 1 - fSmooth(.12, .26, u) * (1 - fSmooth(.9, .98, u)) : 1;
    E.lw += (lwT - E.lw) * (1 - Math.exp(-dt / (lwT < E.lw ? 260 : meta ? 300 : 90)));   // eased by hand: the kit's own blend of the IK weight is quick, and a redirect would show it
    if(E.lw < .999) for(let k = 0; k < c.d.NL; k++){ const r = c.Q.legs[k]; if(r) r.w = Math.min(r.w, E.lw); } }
  /* a walking butterfly folds its wings to a tent; the wings open again as it stops */
  const gk = c.gait ? c.gait.k : 0; if(gk > .001) c.spec(T, {fwLiftR:.8 * gk, fwLiftL:.8 * gk, hwLiftR:.82 * gk, hwLiftL:.82 * gk});
  /* the chrysalis: the heart beats (the silent stage is told from a stall by it); the case's outline rides over the adult inside */
  const pw = w.pupa || 0;
  if(pw > .55){ E.exp = 0; if(now > E.hbNext){ E.hbAt = now; E.hbNext = now + 1900 + 140 * Math.sin(now * .0007); c.glyph(1100); c.burstAt(430, 262, 56, GOLD, 'scene'); } }
  const hb = now - E.hbAt; c.spec(T, {heart:(pulse(hb, 0, 90, 70, 240) + .55 * pulse(hb, 300, 80, 50, 220)) * pw});
  if(pw > .5 && !E.raised){ E.raised = true; c.raise('caseTop'); } else if(pw < .3 && E.raised){ E.raised = false; c.raise(null); }
  /* the eggs laid so far stay on the leaf (the ground keeps its history); the bearing's line */
  c.spec(T, {egg1:E.eggs >= 1 ? 1.2 : 0, egg2:E.eggs >= 2 ? 1.2 : 0, egg3:E.eggs >= 3 ? 1.2 : 0});
  if(E.relay && !c.actions.some(a => a.name === 'relay' && !a.cut)) E.relay = 0;
  E.bear += ((E.relay ? 1 : 0) - E.bear) * (1 - Math.exp(-dt / (E.relay ? 700 : 5200)));
  E.dash = (E.dash + dt * .22 * E.bear) % 32;
  return E;
}

/* the bearing: a dashed line from the head toward the edge of the page and an arrowhead; nothing behind the animal (the whole direction is carried, the start is not) */
const SVGNS = 'http://www.w3.org/2000/svg', mkEl = (tag, a = {}) => { const e = document.createElementNS(SVGNS, tag); for(const k in a) e.setAttribute(k, a[k]); return e; };
function bearingDraw(c, E){
  let B = c.svg.__monB; if(!B){ B = c.svg.__monB = {g:mkEl('g', {'pointer-events':'none', class:'mon-bearing'}), line:mkEl('path', {fill:'none', 'stroke-width':3.6, 'stroke-linecap':'round', 'stroke-dasharray':'18 14'}), head:mkEl('path', {fill:'none', 'stroke-width':3.6, 'stroke-linecap':'round', 'stroke-linejoin':'round'}), sun:mkEl('circle', {r:15, fill:'none', 'stroke-width':2.4}), rays:mkEl('path', {fill:'none', 'stroke-width':2.4, 'stroke-linecap':'round'})};
    B.g.append(B.rays, B.sun, B.line, B.head); c.svg.insertBefore(B.g, c.rig); B.a = -1; }
  const a = E.bear; if(Math.abs(a - B.a) < .004 && !E.relay && a < .004) return; B.a = a;
  const col = K.intHex(mixInt(c.C.skin, c.C.bone, .85)), H = bonePt(c, 'head', 1), x0 = H[0] + 34, y0 = H[1], x1 = 962, len = Math.max(0, (x1 - x0) * clamp(a * 1.4));
  B.line.setAttribute('d', 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'H' + (x0 + len).toFixed(1)); B.line.setAttribute('stroke-dashoffset', (-E.dash).toFixed(1)); B.line.setAttribute('stroke', col); B.line.setAttribute('opacity', (.78 * Math.min(1, a * 1.6)).toFixed(3));
  const hx = x0 + len; B.head.setAttribute('d', 'M' + (hx - 16) + ' ' + (y0 - 11) + 'L' + hx + ' ' + y0 + 'L' + (hx - 16) + ' ' + (y0 + 11)); B.head.setAttribute('stroke', col); B.head.setAttribute('opacity', (len > 60 ? .85 * Math.min(1, a * 1.6) : 0).toFixed(3));
  const sx = 880, sy = 96, ra = Math.min(1, a * 1.5) * .7; B.sun.setAttribute('cx', sx); B.sun.setAttribute('cy', sy); B.sun.setAttribute('stroke', K.intHex(AMB)); B.sun.setAttribute('opacity', ra.toFixed(3));
  B.rays.setAttribute('d', Array.from({length:8}, (_, i) => { const t = i * Math.PI / 4; return 'M' + (sx + Math.cos(t) * 21).toFixed(1) + ' ' + (sy + Math.sin(t) * 21).toFixed(1) + 'L' + (sx + Math.cos(t) * 29).toFixed(1) + ' ' + (sy + Math.sin(t) * 29).toFixed(1); }).join('')); B.rays.setAttribute('stroke', K.intHex(AMB)); B.rays.setAttribute('opacity', ra.toFixed(3));
}

/* ---------- actions: layers on the posture. The lasting states (the wings' expansion, the eggs, the bearing) are the figure's own, in c.mon. ---------- */
const fwBoth = (v, h = v) => ({fwLiftR:v, fwLiftL:v, hwLiftR:h, hwLiftL:h});
M.action('flutter', {label:'Flutter', group:'Wings', dur:3200, f:(t, T, c) => {                         // the wings shiver, a quick small beat (warming the flight muscles)
  const u = env(t, 350, 2100, 600), a = .5 + .5 * Math.sin(t * .0345), b = .5 + .5 * Math.sin(t * .0345 - .6);
  c.spec(T, {...fwBoth(.26 * u * a, .26 * u * b), dlm:.5 * u * a, dvm:.5 * u * (1 - a), antSweepR:.18 * u, antSweepL:.18 * u, breath:.4 * u}); }});
M.action('glide', {label:'Glide', group:'Flight', dur:4400, in:['fly'], f:(t, T, c) => {                // the beat stops and the wings are held out: a flap-glide butterfly spends a third of its flight so
  const E = state(c), u = env(t, 800, 2600, 900); E.kCap = Math.min(E.kCap, 1 - u);
  c.spec(T, {...fwBoth(-.03 * u), basalarR:.1 * u, basalarL:.1 * u, antSweepR:.3 * u, antSweepL:.3 * u, antCurlR:.1 * u, antCurlL:.1 * u}); }});
M.action('relay', {label:'Relay: fly the inherited bearing', group:'Flight', dur:7600, big:true, in:['fly'], f:(t, T, c) => {   // one leg of the migration: the bearing is read (the antennae hold the clock), then flown steadily; the line stays after, handed on
  const E = state(c), e = env(t, 900, 4800, 900), rd = env(t, 350, 900, 600);
  E.relay = t > 250 && t < 6600 ? 1 : 0; if(e > .02) E.kForce = .92 * e;
  c.rootAbout(P(0, 0), .17 * (1 - fSmooth(250, 1700, t)) * (t < 6900 ? 1 : 0));                        // off the line at first, then onto it
  c.spec(T, {antSweepR:.5 * rd + .1, antSweepL:.5 * rd + .1, antCurlR:.2 * rd, antCurlL:.2 * rd, abdCurlL:.0}); }});
M.action('nectar', {label:'Nectar: uncoil the proboscis and feed', group:'Feeding', dur:7800, in:['feed'], f:(t, T, c, a) => {   // the proboscis uncoils, probes the florets and coils again; the thorax pumps
  const ext = env(t, 1100, 4900, 1000), probe = Math.sin(t * .0036) * env(t - 1500, 700, 3300, 800), pump = .5 + .5 * Math.sin(t * .013);
  c.spec(T, {probExt:ext, probSwing:.55 * probe, headR:.1 * ext, ...fwBoth(.05 * ext * (.5 + .5 * Math.sin(t * .02))), dvm:.4 * ext * pump, dlm:.4 * ext * (1 - pump), antSweepR:.08, antSweepL:.08, breath:.3 + .3 * pump * ext});
  const n = a.n ?? (a.n = 0), at = [2300, 3700, 5100][n]; if(at !== undefined && t > at){ a.n = n + 1; const tp = bonePt(c, PROBN[PROBN.length - 1], 1); c.burstAt(tp[0], tp[1], 34, GOLD, 'scene'); } }});
M.action('layEgg', {label:'Lay an egg on the milkweed', group:'Producing', dur:6600, in:['feed'], f:(t, T, c, a) => {   // the abdomen curls to the leaf, touches it, and an egg stays there (the next generation, laid)
  const E = state(c), cur = env(t, 1500, 2700, 1200), touch = pulse(t, 2600, 400, 900, 500);
  c.rootAbout(P(0, 0), -.2 * cur, -4 * cur, 34 * cur);
  c.spec(T, {abdCurlR:cur * 1.1 + touch * .12, ...fwBoth(.38 * cur + .04 * cur * Math.sin(t * .018)), antSweepR:.15, antSweepL:.15, breath:.4});
  if(!a.laid && t > 3100){ a.laid = 1; E.eggs = Math.min(3, E.eggs + 1); } }});
M.action('pump', {label:'Pump the wings open', group:'Metamorph', dur:11000, in:['emerge'], f:(t, T, c) => {   // the adult just out of the chrysalis pumps haemolymph into the wing veins; they unfold in steps and stay unfolded
  const E = state(c), step = keys(t, [[0, 0], [900, 0], [1500, .17], [2500, .17], [3100, .36], [4300, .36], [4900, .55], [6100, .55], [6700, .74], [8200, .74], [8800, .9], [10000, .9], [10600, 1]]);
  E.exp = Math.max(E.exp, step);
  const pm = Math.max(pulse(t, 700, 200, 250, 400), pulse(t, 2300, 200, 250, 400), pulse(t, 3900, 200, 250, 400), pulse(t, 5500, 200, 250, 400), pulse(t, 7100, 200, 250, 400), pulse(t, 8700, 200, 250, 400));
  c.spec(T, {breath:-.8 * pm, dlm:.3 * pm, abdCurlL:.1 * pm, antSweepR:.2, antSweepL:.2}); }});
M.action('sun', {label:'Bask in the sun', group:'Wings', dur:7600, in:['bask'], f:(t, T, c, a) => {              // the wings spread flat and tilt to the light; the thorax warms; a flush of amber crosses them
  const u = env(t, 1000, 5000, 1200), th = .5 + .5 * Math.sin(t * .0031);
  c.rootAbout(P(0, 0), -.07 * u); c.spec(T, {basalarR:.3 * u, basalarL:.3 * u, hwSweepR:-.3 * u, hwSweepL:-.3 * u, dlm:.35 * u * th, dvm:.35 * u * (1 - th), antSweepR:.3 * u, antSweepL:.3 * u, breath:.3 + .3 * u});
  if(!a.b && t > 500){ a.b = 1; c.burstAt(380, 300, 230, AMB); c.burstAt(380, 500, 230, AMB); } }});
M.action('settle', {label:'Settle on the roost', group:'Wings', dur:5200, in:['roost'], f:(t, T, c) => {         // hung from the bough: the wings close the last way, the antennae fold, the breath slows
  const u = env(t, 1200, 2600, 1200);
  c.spec(T, {...fwBoth(.07 * u), antCurlR:.5 * u, antCurlL:.5 * u, antSweepR:-.1 * u, antSweepL:-.1 * u, abdCurlR:.08 * u, breath:-.2 * u}); }});
M.action('antFlick', {label:'Antenna flick', group:'Head', dur:1200, tiny:true, f:(t, T, c) => { const u = pulse(t, 80, 120, 100, 340) + pulse(t, 540, 100, 90, 300);
  c.spec(T, {antSweepR:.6 * u, antSweepL:.4 * u, antCurlR:.3 * u, antCurlL:.2 * u}); }});
M.action('headScan', {label:'Scan', group:'Head', dur:2200, tiny:true, f:(t, T, c, a) => { const u = env(t, 300, 1000, 500), d = a.d ?? (a.d = c.rand() < .5 ? 1 : -1);
  c.spec(T, {[d > 0 ? 'headR' : 'headL']:.7 * u, antSweepR:.25 * u, antSweepL:.25 * u, antCurlR:.1 * u, antCurlL:.1 * u}); }});
M.action('probeTouch', {label:'Taste with the proboscis', group:'Feeding', dur:2600, tiny:true, f:(t, T, c) => { const u = env(t, 500, 900, 500);   // the proboscis half uncoils to taste the air and coils again
  c.spec(T, {probExt:.45 * u, probSwing:.3 * Math.sin(t * .006) * u}); }});

/* ---------- pads: the wings (left and right), the wingbeat, the antennae, the proboscis, the head, the abdomen, the six legs ---------- */
M.pad('wings', {label:'Wings', group:'Wings', split:'LR', alwaysFx:true, x:['open', 'folded'], y:['sweep forward', 'sweep back'],
  fx:(c, x, y, b) => { c.spec(c.Tp, {fwLiftL:pos(x), hwLiftL:pos(x), basalarL:pos(-y), subalarL:pos(y), fwLiftR:pos(b[0]), hwLiftR:pos(b[0]), basalarR:pos(-b[1]), subalarR:pos(b[1])}); },
  ghost:(c, s) => { const X = s ? 'R' : 'L'; return [cl1(c.act('fwLift' + X)), cl1(c.act('subalar' + X) - c.act('basalar' + X))]; }});
M.pad('flight', {label:'Wingbeat', group:'Wings', value:true, x:['glide', 'flap'], y:['slow', 'quick'], ghost:c => [cl1(c.pad.flight.L[0]), cl1(c.pad.flight.L[1])]});
M.pad('antennae', {label:'Antennae', group:'Head', x:['in', 'out'], y:['straight', 'curled'], map:(x, y) => ({antSweepR:x * .8, antSweepL:x * .8, antCurlR:pos(y) * .9, antCurlL:pos(y) * .9}),
  ghost:c => [cl1(c.act('antSweepR') / .8), cl1(c.act('antCurlR') / .9)]});
M.pad('proboscis', {label:'Proboscis', group:'Head', x:['left', 'right'], y:['coiled', 'uncoiled'], map:(x, y) => ({probExt:pos(y), probSwing:x * .8}), ghost:c => [cl1(c.act('probSwing') / .8), cl1(c.act('probExt'))]});
M.pad('head', {label:'Head', group:'Head', x:['left', 'right'], y:['', ''], map:x => ({headR:pos(x), headL:pos(-x)}), ghost:c => [cl1(c.act('headR') - c.act('headL')), 0]});
M.pad('abdomen', {label:'Abdomen', group:'Body', x:['curl left', 'curl right'], y:['still', 'pumping'], map:(x, y) => ({abdCurlR:pos(x), abdCurlL:pos(-x), breath:pos(y)}), ghost:c => [cl1(c.act('abdCurlR') - c.act('abdCurlL')), cl1(c.act('breath'))]});
for(let i = 0; i < 3; i++) M.pad('leg' + i, {label:'Leg pair ' + (i + 1), group:'Limbs', split:'NF', leg:'leg' + i, x:['back', 'forward'], y:['flexed', 'stretched']});

/* ---------- hooks ---------- */
const DEF = M.finish({
  reachCap:-999, strideMax:60,
  postureHold(c, w){
    const E = state(c), V = c.pm.V, CHI = c.d.CHI, l = V[CHI['j:stLift']], cr = V[CHI['j:stCrumple']] * (1 - E.exp);
    c.spec(c.Tp, {fwLiftR:l, fwLiftL:l, hwLiftR:l * 1.02, hwLiftL:l * 1.02, crumpleR:cr, crumpleL:cr, pupa:(w.pupa || 0) * 1.2, probExt:.55 * (w.down || 0)});   // grounded: the proboscis lies out, uncoiled
  },
  idle(c, now, Ti, dt){
    const E = figureStep(c, now, dt), rest = 1 - Math.min(1, 1.6 * (c.pm.w.pupa || 0)), calm = rest * (1 - Math.min(1, 1.6 * (c.pm.w.fly || 0)));   // the pupa is silent; the flier has its wingbeat
    c.spec(Ti, {breath:(.3 + .3 * Math.sin(now * .0021)) * rest, breezeBough:.5 * Math.sin(now * .0006), breezeHusk:.6 * Math.sin(now * .0009 + 1), breezeFlower:.6 * Math.sin(now * .0008 + 2), breezeLeaf:.6 * Math.sin(now * .0011 + .5),
      antSweepR:(.1 + .05 * Math.sin(now * .0017)) * rest, antSweepL:(.1 + .05 * Math.sin(now * .0017 + 1.3)) * rest, antCurlR:(.05 + .03 * Math.sin(now * .0023)) * rest, antCurlL:(.05 + .03 * Math.sin(now * .0023 + 2)) * rest,
      fwLiftR:.03 * calm * (.5 + .5 * Math.sin(now * .0016)), fwLiftL:.03 * calm * (.5 + .5 * Math.sin(now * .0016 + .4)), hwLiftR:.03 * calm * (.5 + .5 * Math.sin(now * .0016 - .5)), hwLiftL:.03 * calm * (.5 + .5 * Math.sin(now * .0016 - .1))});   // the wings breathe, a little, when held
  },
  colour:(c, i, col) => {
    const P_ = c.d.parts[c.d.PPART[i]], k = P_.mk; if(!k) return col;
    if(k === 'membrane') return mixInt(col, c.C.accent, .3 + .24 * hash(i * 7 + 1));
    if(k === 'spot') return mixInt(col, c.C.bone, .9);
    if(k === 'jade') return mixInt(col, MAL, .55);
    if(k === 'foliage') return mixInt(col, MAL, .5);
    if(k === 'bloom') return mixInt(col, c.C.bone, .35);
    if(k === 'egg') return mixInt(col, c.C.bone, .6);
    return col;
  },
  colourLive(c){ const E = state(c); bearingDraw(c, E); },
  glyph:(cx, cy, part) => part.tags.has('beads') ? [clamp((cx - 388) / 84), 1] : null,
  life:{rate:1.5,
    small:[['antFlick', 2.2, 5000], ['headScan', 1.2, 7000], ['probeTouch', .8, 12000, ['bask', 'roost', 'feed']], ['flutter', 1.1, 14000, ['bask', 'feed', 'roost']], ['sun', 1.5, 16000, ['bask']], ['nectar', 2.4, 10000, ['feed']], ['layEgg', .9, 26000, ['feed']],
      ['settle', 1.2, 14000, ['roost']], ['glide', 1.6, 12000, ['fly']], ['relay', 1, 30000, ['fly']], ['pump', 3, 30000, ['emerge']]],
    moves:[['go:roost', .8, 14000, ['bask', 'fly', 'feed']], ['go:bask', 1.3, 0, ['roost', 'feed', 'fly', 'down', 'emerge']], ['go:fly', 1.2, 12000, ['bask', 'roost', 'feed']], ['go:feed', 1, 14000, ['bask', 'fly']], ['walk', .8, 12000, ['bask']], ['go:emerge', 1, 0, ['pupa']]],
    dwell:{bask:[3500, 7000], roost:[4500, 9000], fly:[6000, 11000], feed:[4500, 9000], emerge:[9000, 13000], pupa:[8000, 12000], down:[6000, 9000]},
    gait:[['antFlick', 2, 5000]], gaitFor:{walk:[2500, 5000], creep:[2000, 3500]}},
});
for(const D of DEF.IKD){ D.a[1] = D.a[0] + K.wrapA(D.a[1] - D.a[0]); D.a[2] = D.a[1] + K.wrapA(D.a[2] - D.a[1]); }   // the angles between a leg's bones on one branch
K.define(DEF);
/* __NEXT__ */
})();
