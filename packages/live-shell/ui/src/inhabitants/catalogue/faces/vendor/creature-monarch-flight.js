/* creature-monarch-flight.js — Danaus plexippus, the adult female, seen from the SIDE, facing right, on creature-kit.js. The plan-view monarch (creature-monarch.js) stays the specimen of the anatomy; this is the same
   animal drawn the way a flier has to be drawn to fly: in profile, where a wing's stroke can be seen.
   THE WING. The planform is the plan-view one (a Coons patch of cells under black veins, white-spotted margins) stood on its end: the span runs UP the page from the hinge on the thorax, the chord along the body.
   Seen from the side a wing at elevation beta shows its span times |sin beta| (flat is a line along the body, straight up is the whole planform), so the wing hangs from a WING-PLANE bone (rest axis along the body)
   that is scaled across by sin beta, negative below the body (the planform flips, the leading edge stays in front: c.scale(bone, along, across), as the eagle's). The wing is skinned across three (the hind two)
   such planes in parallel, each with its own elevation and its own in-plane sweep bone, so the elevation changes along the span: the tip LAGS the base through the beat, and the wing is curved. The near wings
   are in front of the body and the near legs, the far wings behind it, a little higher and further back (a three-quarter view), dim.
   THE BEAT (figureStep) is a cycle on those bones, run from the idle hook by the flight posture's weight so it fades in and out and never pops: about 3.5 a second at cruise, in bouts with glides between (the wings
   held in a V), the elevation from +66 degrees at the top (the clap) to -38 at the bottom, the sweep forward on the downstroke and back on the upstroke, the hindwing a little behind, the body rising on the
   downstroke with the abdomen swinging against it. A wing's held state (how far up it stands, how crumpled it is) is a posture channel on three mechanism bones (stS, stH, stC), so an edge stages it.
   IN A CREW (creature-crew.js, kind:'fly') the host owns the place and gives the figure m.fl = {vx, vy, spd, face, pitch, hover}: the idle hook reads it for the beat's rate and the glides.
   The agency: Metamorph is the route chrysalis -> emerge -> (pump) -> fly; Relay is the flight leg (flapBout, glide), landing (bask), nectar and layEgg. Read CREATURE-NOTES-MONARCH-FLIGHT.md (CREW-NOTES-MONARCH-FLIGHT.md). */
(() => {
'use strict';
const K = window.CreatureKit; K.require('1.3.0', 'creature-monarch-flight');
const CX = 500, BY = 470, HY = BY - 22, B0 = 18;                              // the body axis (y = BY) and the wing hinge, on the thorax's back
const FAR_W = [-8, -17], FAR_A = [-7, -9], FAR_L = [-9, -5];                   // the far side, seen a little from above and in front: higher, further back, dim
const M = K.model({id:'monarch-flight', name:'Monarch flight', sign:'', title:'MONARCH IN FLIGHT', sub:'Danaus plexippus · the adult in profile: the beat, the glide, the roost and the relay',
  w:1000, h:780, pivot:[CX, BY], axis:CX, ink:K.ROSTER.cinnabar, accent:K.ROSTER.amber, cam:[1, 500, 390], far:{wing:FAR_W, antenna:FAR_A, leg:FAR_L}});
const {clamp, keys, env, pulse, fSmooth, lerp, chaikin, ringPts, ellipsePts, catmull, hash, mixInt} = K, pos = v => Math.max(0, v), cl1 = v => Math.max(-1, Math.min(1, v));
const SIDES = ['N', 'F'];
const P = (a, b) => [CX + a, BY + b];                                          // the body frame: a toward the head (+x), b down the page (the belly is +b)
const rad = d => d * Math.PI / 180;
const bone_ = n => M.bones[M.BI[n]];
function elbow(S, W, l1, l2, bend){ const dx = W[0] - S[0], dy = W[1] - S[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 4), t = Math.atan2(dy, dx) + bend * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)); return [S[0] + l1 * Math.cos(t), S[1] + l1 * Math.sin(t)]; }

/* ---------- the wing's own geometry (the plan-view monarch's, CREATURE-NOTES-MONARCH.md "Wing geometry") ----------
   A wing is a Coons patch phi(t, w): t along the span (0 the base, 1 the margin), w across the chord (0 the costa, 1 the inner margin), in the body frame (a, b) of the near wing; here b is the span
   and the page shows it upward from the hinge (wmap). */
const pathFn = pts => {
  const C = catmull(pts, 10), L = [0];
  for(let i = 1; i < C.length; i++) L.push(L[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
  const T = L[L.length - 1];
  return t => { const d = clamp(t) * T; let k = 1; while(k < C.length - 1 && L[k] < d) k++; const u = (d - L[k - 1]) / ((L[k] - L[k - 1]) || 1); return [C[k - 1][0] + (C[k][0] - C[k - 1][0]) * u, C[k - 1][1] + (C[k][1] - C[k - 1][1]) * u]; };
};
const patch = (C, O, I, B) => { const c0 = C(0), c1 = C(1), i0 = I(0), i1 = I(1);
  return (t, w) => { const a = C(t), b = I(t), p = B(w), q = O(w); return [0, 1].map(k => (1 - w) * a[k] + w * b[k] + (1 - t) * p[k] + t * q[k] - ((1 - t) * (1 - w) * c0[k] + t * (1 - w) * c1[k] + (1 - t) * w * i0[k] + t * w * i1[k])); }; };
const FW = {key:'fore', pre:'fw', t0:.1, h:25, nz:3, span:306, hinge:[CX + 12, HY],
  phi:patch(pathFn([[46, 18], [53, 70], [59, 130], [62, 190], [62, 246], [57, 288], [46, 314]]), pathFn([[46, 314], [30, 322], [8, 318], [-16, 305], [-42, 284], [-64, 258], [-78, 230]]),
    pathFn([[-14, 18], [-28, 60], [-42, 108], [-56, 158], [-68, 200], [-78, 230]]), pathFn([[46, 18], [16, 18], [-14, 18]]))};
const HW = {key:'hind', pre:'hw', t0:.12, h:25, nz:2, span:222, hinge:[CX + 2, HY],
  phi:patch(pathFn([[8, 20], [-10, 64], [-30, 114], [-50, 164], [-66, 208], [-80, 238]]), pathFn([[-80, 238], [-104, 244], [-132, 232], [-156, 208], [-174, 176], [-184, 136], [-186, 96]]),
    pathFn([[-4, 20], [-40, 24], [-86, 30], [-130, 38], [-166, 58], [-186, 96]]), pathFn([[8, 20], [2, 20], [-4, 20]]))};
const wl = (L, t) => L.w0 + (L.w1 - L.w0) * Math.pow(t, L.g || .9);
FW.sectors = [{w0:0, w1:0}, {w0:.22, w1:.17}, {w0:.43, w1:.40}, {w0:.63, w1:.62}, {w0:.82, w1:.84}, {w0:1, w1:1}];
FW.veins = [['Sc', .07, .035, .04, .80, 3.8, 2.3], ['R', .22, .17, .02, 1, 4.2, 2.6], ['R2', .13, .095, .50, 1, 2.6, 1.8], ['R3', .30, .27, .40, 1, 2.5, 1.7], ['M', .43, .40, .02, 1, 4.0, 2.5],
  ['M2', .53, .50, .45, 1, 2.6, 1.8], ['Cu', .63, .62, .02, 1, 3.8, 2.4], ['Cu2', .73, .74, .36, 1, 2.6, 1.8], ['A', .82, .84, .02, .95, 3.6, 2.2]];
FW.cross = [[[.51, .22], [.52, .33], [.51, .43]], [[.42, .43], [.43, .53], [.42, .63]]];
HW.sectors = [{w0:0, w1:0}, {w0:.28, w1:.22}, {w0:.52, w1:.50}, {w0:.76, w1:.78}, {w0:1, w1:1}];
HW.veins = [['Sc', .08, .05, .04, .72, 3.6, 2.2], ['Rs', .28, .22, .02, 1, 4.0, 2.4], ['M1', .40, .36, .30, 1, 2.6, 1.8], ['M', .52, .50, .02, 1, 3.8, 2.4], ['Cu', .64, .64, .30, 1, 2.6, 1.8], ['Cu2', .76, .78, .02, 1, 3.6, 2.2], ['A', .90, .90, .05, .86, 2.6, 1.7]];
HW.cross = [[[.45, .28], [.46, .40], [.45, .52]]];
FW.band = {t:.968, hw:13}; FW.rows = [[.976, 15, 4.3, .05, .95], [.925, 11, 3.2, .1, .92]]; FW.apexSpots = [[.86, .07, 6.4], [.91, .17, 5.4], [.81, .16, 5], [.955, .27, 4]];
HW.band = {t:.966, hw:11}; HW.rows = [[.972, 13, 4.6, .04, .96], [.918, 9, 3, .1, .9]];
const WOFF = X => X === 'F' ? FAR_W : [0, 0];
const wmap = X => p => [CX + p[0] + WOFF(X)[0], HY - (p[1] - B0) + WOFF(X)[1]];            // a plan-view wing point (a along the body, b out along the span) to the page: the wing stands on end

/* ---------- skeleton ----------
   body (root) · head · a three-bone abdomen · four-bone antennae, near and far · the proboscis, a spiral of fourteen bones under the face · per wing, per side: three (two) wing-plane bones in parallel at the hinge, each scaled across
   by the sine of its own elevation, and a sweep bone under each that turns the planform in its own plane · six three-bone IK legs · mechanism bones that carry the wing's held state · the scene. */
M.bone('body', null, P(0, 0), P(70, 0), {grp:'root'});
M.bone('head', 'body', P(48, 0), P(78, 0), {grp:'head', lim:[-.9, 1.5], speed:9});
const ABD = M.chain('abd', [P(-20, 0), P(-60, 0), P(-110, 0), P(-174, 0)], 3, {parent:'body', grp:'abdomen', lim:[-1.35, .9], speed:6});
const ANT_PTS = [[68, -12], [92, -34], [118, -54], [142, -68], [164, -74]];
const ANT = {};
for(const X of SIDES){ const off = X === 'F' ? FAR_A : [0, 0]; ANT[X] = M.chain('ant' + X, ANT_PTS.map(([a, b]) => P(a + off[0], b + off[1])), 4, {parent:'head', grp:'antenna', lim:[-.9, .9], speed:11}); bone_(ANT[X][0]).lim = [-1.4, 1.4]; }
/* the proboscis: a flat spiral in the median plane under the face (the side view is its real one), fourteen bones; one muscle uncoils it (each bone turns by minus its own rest turn) */
const PROB = (() => { const L = 104, n = 104, pts = [[76, 12]]; let x = 76, y = 12, th = .8;
  for(let i = 1; i <= n; i++){ const s = L * i / n, k = .05 + (.135 - .05) * (s / L); th += k * (L / n); x += Math.cos(th) * L / n; y += Math.sin(th) * L / n; pts.push([x, y]); }
  return pts; })();
const PROBN = M.chain('prob', PROB.map(([a, b]) => P(a, b)), 14, {parent:'head', grp:'mouth', lim:[-2.6, 2.6], speed:12});
const PROBREST = PROBN.map((n, i) => { const B = bone_(n), a = Math.atan2(B.q[1] - B.p[1], B.q[0] - B.p[0]); if(!i) return a; const Q = bone_(PROBN[i - 1]); return K.wrapA(a - Math.atan2(Q.q[1] - Q.p[1], Q.q[0] - Q.p[0])); });
/* the wings */
const WBN = {fore:{N:[], F:[]}, hind:{N:[], F:[]}};
for(const X of SIDES) for(const G of [FW, HW]){
  const off = WOFF(X), h = [G.hinge[0] + off[0], G.hinge[1] + off[1]];
  for(let i = 0; i < G.nz; i++){
    M.bone(G.pre + 'p' + i + X, 'body', h, [h[0] + 24, h[1]], {grp:'wing', anat:false, lim:[0, 0]});
    M.bone(G.pre + 's' + i + X, G.pre + 'p' + i + X, h, [h[0], h[1] - G.span * (i + 1) / G.nz], {grp:'wing', lim:[-1.75, 1.15], speed:20});
    WBN[G.key][X].push(G.pre + 's' + i + X);
  }
}
/* the six legs: hip, elbow (solved as the kit's IK will), wrist and toe, R0 R1 R2 near then far. The forelegs are short, as a brush-footed butterfly's are, and held up against the chest. */
const HIP = [[40, 16], [8, 20], [-22, 20]], FOOT = [[84, 92], [28, 126], [-46, 124]], BEND = [-1, -1, 1], LEGS = [];
for(const X of SIDES){
  const off = X === 'F' ? FAR_L : [0, 0];
  HIP.forEach(([ha, hb], i) => {
    const tag = X + i, hip = P(ha + off[0], hb + off[1]), foot = P(FOOT[i][0] + off[0], FOOT[i][1] + off[1]), wrist = [hip[0] + (foot[0] - hip[0]) * .8, hip[1] + (foot[1] - hip[1]) * .8];
    const d = Math.hypot(wrist[0] - hip[0], wrist[1] - hip[1]), l = d * .62, E_ = elbow(hip, wrist, l, l, BEND[i]);
    M.bone('u' + tag, 'body', hip, E_, {grp:'legs', lim:[-2.2, 2.2], speed:9});
    M.bone('l' + tag, 'u' + tag, E_, wrist, {grp:'legs', lim:[-2.6, 2.6], speed:9});
    M.bone('f' + tag, 'l' + tag, wrist, foot, {grp:'legs', lim:[-2.8, 2.8], speed:9});
    LEGS.push({X, i, tag, hip, E:E_, wrist, foot, bend:BEND[i], far:X === 'F'});
  });
}
for(const L of LEGS) M.leg({bones:['u' + L.tag, 'l' + L.tag, 'f' + L.tag], bend:L.bend, kind:'leg' + L.i, side:L.X, grp:'legs', roll:.6, reach:22});
/* mechanism: the wing's held state as posture channels (so an edge stages it on the wing's own window): stS the forewing's held sin(elevation), stH the hindwing's, stC how crumpled the unexpanded wing is */
for(const n of ['stS', 'stH', 'stC']) M.bone(n, 'body', P(0, 0), P(8, 0), {grp:'wing', anat:false, lim:[-2, 2]});
/* the scene: a bough with the empty case of a chrysalis, a milkweed (an umbel, one leaf), the ground; on its page only (a crew's habitat is the scene's) */
const GY = 748, STEM = 690, UMB = [690, 546], LEAF0 = [686, 672], LEAF1 = [322, 700];
M.bone('bough', null, [120, 118], [570, 98], {grp:'scene', anat:false, lim:[-.1, .1]});
M.bone('husk', 'bough', [230, 106], [230, 400], {grp:'scene', anat:false, lim:[-.2, .2]});
M.bone('flower', null, [STEM, GY], [STEM, 540], {grp:'scene', anat:false, lim:[-.2, .2]});
M.bone('leaf', 'flower', LEAF0, LEAF1, {grp:'scene', anat:false, lim:[-.15, .15]});

/* ---------- the figure ----------
   The line model's colours, in the monarch's own terms: the membrane is ink (cinnabar, lifted toward the amber accent by the colour hook: orange, paler on the underside the up-stroke shows), veins and margins bare skin (black),
   the white spots bone. The far side is the same, dim. */
const LN = {wing:{k:.13, c:.1, r:'b', t:'cin', tk:.25}, wingF:{k:.1, c:.2, r:'b', t:'bone', tk:.08}, vein:{k:.03, c:.03, r:0}, veinF:{k:.05, c:.05, r:0}, body:{k:.34, c:.7, r:'b', t:'bone', tk:.3}, bodyD:{k:.26, c:.5, r:'b', t:'bone', tk:.2},
  spot:{k:.55, c:.8, r:0, t:'bone', tk:.6}, spotF:{k:.3, c:.5, r:0, t:'bone', tk:.3}, leg:{k:.5, c:.85, r:'b', t:'bone', tk:.25}, legF:{k:.26, c:.45, r:'b', t:'bone', tk:.1}, thin:{k:.62, c:.88, r:'f', t:'bone', tk:.4}, thinF:{k:.3, c:.5, r:'f', t:'bone', tk:.2},
  fine:{k:.5, c:.8, r:'f', t:'bone', tk:.3}, scene:{k:.4, c:.7, r:'b', t:'umber', tk:.5}, rim:{k:.5, c:.9, r:'b', t:'bone', tk:.4}};
const mark = (P_, kind, wk) => { P_.mk = kind; if(wk) P_.wk = wk; return P_; };
const VW = 1.12;       // the female's veins are thicker than the male's
/* a part's skin across a wing's planes: by how far up the span it lies */
function wingBind(G, X){
  const yh = G.hinge[1] + WOFF(X)[1], n = G.nz, pre = G.pre;
  return (x, y) => { const sg = clamp((yh - y) / G.span); let w;
    if(n === 3){ const w2 = fSmooth(.52, .9, sg), w0 = 1 - fSmooth(.1, .5, sg); w = [w0, Math.max(0, 1 - w0 - w2), w2]; } else { const w1 = fSmooth(.2, .8, sg); w = [1 - w1, w1]; }
    return w.map((v, i) => [pre + 's' + i + X, v]); };
}
function buildWing(G, X){
  const far = X === 'F', key = G.key, bind = wingBind(G, X), cv = wmap(X), phi = (t, w) => cv(G.phi(t, w)), wk = key + X;
  const tg = (...t) => ['wing', key, key + X, 'wing' + X, ...(far ? ['F'] : []), ...t], lay = (far ? 1 : 9) + (key === 'fore' ? .4 : 0) + (far && key === 'fore' ? -.3 : 0), NT = far ? 7 : 12, NE = far ? 3 : 5, t0 = G.t0, dim = far, GH = far ? 46 : G.h;   // the far wing is mostly hidden: a coarser mesh, the main veins only
  const LW = far ? LN.wingF : LN.wing, LV = far ? LN.veinF : LN.vein, LS = far ? LN.spotF : LN.spot;
  { const pts = []; for(let q = 0; q <= 4; q++) pts.push(phi(t0 * q / 4, 0)); for(let q = 1; q <= 4; q++) pts.push(phi(t0, q / 4)); for(let q = 3; q >= 0; q--) pts.push(phi(t0 * q / 4, 1)); for(let q = 3; q >= 1; q--) pts.push(phi(0, q / 4));
    mark(M.zone(key + 'Root' + X, pts, {layer:lay, tier:'M', h:GH, bind, line:LW, tone:.4, zone:'skin', dim, tags:tg('membrane', 'root')}), 'membrane', wk); }
  const tone0 = [.84, .76, .82, .76, .84];
  for(let j = 0; j + 1 < G.sectors.length; j++){
    const A = G.sectors[j], B_ = G.sectors[j + 1], pts = [];
    for(let q = 0; q <= NT; q++){ const t = lerp(t0, 1, q / NT); pts.push(phi(t, wl(A, t))); }
    for(let q = 1; q < NE; q++) pts.push(phi(1, lerp(wl(A, 1), wl(B_, 1), q / NE)));
    for(let q = NT; q >= 0; q--){ const t = lerp(t0, 1, q / NT); pts.push(phi(t, wl(B_, t))); }
    for(let q = 1; q < NE; q++) pts.push(phi(t0, lerp(wl(B_, t0), wl(A, t0), q / NE)));
    mark(M.zone(key + 'Cell' + j + X, pts, {layer:lay, tier:'M', h:GH, bind, line:LW, tone:tone0[j % 5], zone:'skin', dim, tags:tg('membrane', 'cell')}), 'membrane', wk);
  }
  const strip = (name, S, o) => mark(M.strip(name, S, {tier:'F', bind, line:LV, tone:0, zone:'veins', dim, tags:tg('vein'), ...o}), 'vein');
  for(const [nm, w0, w1, tS, tE, h0, h1] of G.veins){
    if(far && !['R', 'M', 'Cu', 'A', 'Rs', 'Sc'].includes(nm)) continue;
    const L = {w0, w1}, n = Math.max(4, Math.round((tE - tS) * 16)), S = [];
    for(let q = 0; q <= n; q++){ const t = lerp(tS, tE, q / n), p = phi(t, wl(L, t)); S.push([p[0], p[1], lerp(h0, h1, q / n) * VW * (tS > .08 ? Math.min(1, .3 + 2.4 * q / n) : 1)]); }   // a branch is born thin
    strip(key + 'Vein' + nm + X, S, {layer:lay + .2});
  }
  if(!far) G.cross.forEach((pts, i) => { const A = phi(...pts[0]), B_ = phi(...pts[pts.length - 1]), S = []; for(let q = 0; q <= 3; q++) S.push([lerp(A[0], B_[0], q / 3), lerp(A[1], B_[1], q / 3), 2.1 * VW]); strip(key + 'Cross' + i + X, S, {layer:lay + .2}); });
  { const S = []; for(let q = 0; q <= 18; q++){ const p = phi(G.band.t, lerp(.012, .988, q / 18)); S.push([p[0], p[1], G.band.hw]); } strip(key + 'Band' + X, S, {layer:lay + .3}); }
  if(key === 'fore'){
    const S = []; for(let q = 0; q <= 14; q++){ const p = phi(lerp(.0, .97, q / 14), .018); S.push([p[0], p[1], 3.6]); } strip('foreCosta' + X, S, {layer:lay + .25});
    const S2 = []; for(let q = 0; q <= 12; q++){ const p = phi(lerp(.12, .99, q / 12), .985); S2.push([p[0], p[1], 2.4]); } strip('foreInner' + X, S2, {layer:lay + .25});
    const pts = []; for(let q = 0; q <= 6; q++) pts.push(phi(lerp(.76, 1, q / 6), 0)); for(let q = 1; q <= 6; q++) pts.push(phi(1, .36 * q / 6)); for(let q = 1; q <= 5; q++) pts.push(phi(lerp(1, .82, q / 5), lerp(.36, .15, q / 5))); pts.push(phi(.78, .06));
    mark(M.zone('foreApex' + X, pts, {layer:lay + .1, tier:'M', h:14, bind, line:LV, tone:0, zone:'veins', dim, tags:tg('apex')}), 'black');
  }
  const rows = []; for(const [t, n, r, w0, w1] of G.rows){ const list = []; for(let q = 0; q < n; q++) list.push(ringPts(phi(t, lerp(w0, w1, n > 1 ? q / (n - 1) : .5)), r, 8)); rows.push(list); }
  mark(M.shapes(key + 'SpotsM' + X, rows[0], {layer:lay + .5, tier:'F', bind, line:LS, tone:.95, zone:'spots', dim, tags:tg('spot')}), 'spot');
  if(!far) mark(M.shapes(key + 'SpotsS' + X, rows[1], {layer:lay + .5, tier:'F', bind, line:LS, tone:.95, zone:'spots', dim, tags:tg('spot')}), 'spot');
  if(G.apexSpots) mark(M.shapes(key + 'SpotsA' + X, G.apexSpots.map(([t, w, r]) => ringPts(phi(t, w), r, 9)), {layer:lay + .5, tier:'F', bind, line:LS, tone:.95, zone:'spots', dim, tags:tg('spot')}), 'spot');
}
for(const X of ['F', 'N']){ buildWing(HW, X); buildWing(FW, X); }

/* the body: ten dark, white-spotted segments on a three-bone chain, a robust thorax, a small round head with a large eye, clubbed antennae, a palp and the coiled proboscis */
const interp = (T, u) => { for(let i = 0; i < T.length - 1; i++) if(u <= T[i + 1][0]) return lerp(T[i][1], T[i + 1][1], (u - T[i][0]) / (T[i + 1][0] - T[i][0] || 1)); return T[T.length - 1][1]; };
const HWID = [[0, 12], [.22, 15.5], [.5, 15], [.74, 11], [.9, 6.8], [1, 3]], SEGN = 10, SEGL = 15.4, SEG0 = -18;
const hwAt = a => interp(HWID, clamp((SEG0 - a) / (SEGN * SEGL)));
for(let i = 0; i < SEGN; i++){
  const a0 = SEG0 - SEGL * i + .8, a1 = SEG0 - SEGL * (i + 1), am = (a0 + a1) / 2, pts = [[a0, 1], [am, 1], [a1, 1], [a1, -1], [am, -1], [a0, -1]].map(([a, k]) => P(a, k * hwAt(a)));
  mark(M.zone('seg' + i, pts, {layer:7 + i * .001, tier:'F', h:9, bind:{chain:ABD, sigma:20}, line:LN.bodyD, tone:.1 + .01 * (i % 2), zone:'skin', tags:['body', 'abdomen']}), 'body');
}
{ const list = []; for(let i = 1; i < SEGN; i++){ const a = SEG0 - SEGL * (i + .5); list.push(ringPts(P(a, hwAt(a) * .18), 2.5 - .09 * i, 7)); }
  mark(M.shapes('abdSpots', list, {layer:7.3, tier:'F', bind:{chain:ABD, sigma:20}, line:LN.spot, tone:.95, zone:'spots', tags:['body', 'abdomen', 'spot']}), 'spot'); }
mark(M.zone('ovipositor', chaikin([P(-172, -3), P(-176, 0), P(-172, 3), P(-166, 4), P(-166, -4)], 1), {layer:7.1, tier:'F', h:5, bind:{rigid:ABD[2]}, line:LN.bodyD, tone:.2, zone:'skin', tags:['body', 'abdomen']}), 'body');
mark(M.zone('thorax', chaikin(ellipsePts(P(12, -2), 38, 26, 16), 1), {layer:7.4, tier:'M', h:13, bind:{rigid:'body'}, line:LN.body, tone:.12, zone:'skin', tags:['body', 'thorax']}), 'body');
mark(M.zone('collar', chaikin(ellipsePts(P(42, 0), 9, 17, 10), 1), {layer:7.5, tier:'F', h:7, bind:{rigid:'body'}, line:LN.body, tone:.18, zone:'skin', tags:['body', 'thorax']}), 'body');
M.line('thoraxLine', [P(34, -18), P(12, -24), P(-12, -18)], {layer:7.55, tier:'F', bind:{rigid:'body'}, line:{k:.22, c:.34, r:'f', t:'bone', tk:.2}, tone:.3, zone:'skin', tags:['body', 'thorax']});
mark(M.shapes('thoraxSpots', [[40, 4, 2.6], [30, 12, 2.8], [18, 14, 2.8], [4, 14, 2.6], [-8, 11, 2.2], [26, -2, 2], [10, 4, 2]].map(([a, b, r]) => ringPts(P(a, b), r, 7)), {layer:7.6, tier:'F', bind:{rigid:'body'}, line:LN.spot, tone:.95, zone:'spots', tags:['body', 'thorax', 'spot']}), 'spot');
mark(M.zone('head', chaikin(ellipsePts(P(62, -2), 15, 17, 14), 1), {layer:10, tier:'F', h:9, bind:{rigid:'head'}, line:LN.body, tone:.12, zone:'skin', tags:['body', 'head']}), 'body');
M.polar('eyeN', P(65, -4), [0, 3.6, 7.6], [6, 12], {layer:10.3, tier:'F', ptier:'F', bind:{rigid:'head'}, ink:'accent', line:LN.rim, tone:(x, y) => Math.hypot(x - (CX + 65), y - (BY - 4)) < 3.8 ? .06 : .58, zone:'eyes', tags:['head', 'eye'], twist:.3});
mark(M.shape('palpN', chaikin(ellipsePts(P(84, 11), 13, 4.4, 8, .3), 1), {layer:10.1, tier:'F', bind:{rigid:'head'}, line:LN.bodyD, tone:.25, zone:'skin', tags:['head', 'palp']}), 'body');
mark(M.shapes('headSpots', [ringPts(P(70, -10), 2, 6), ringPts(P(54, -12), 2.2, 6), ringPts(P(58, 6), 1.8, 6)], {layer:10.2, tier:'F', bind:{rigid:'head'}, line:LN.spot, tone:.95, zone:'spots', tags:['head', 'spot']}), 'spot');
/* the antennae: a filament on four bones and a club at its end; the far one is the same, dim, behind the head */
for(const X of SIDES){
  const far = X === 'F', lay = far ? 1.6 : 10.4, LT = far ? LN.thinF : LN.thin, tg = (...t) => ['head', 'antenna', ...(far ? ['F'] : []), ...t];
  ANT[X].forEach((n, i) => { const b = bone_(n); M.strip('antenna' + X + i, [[b.p[0], b.p[1], 1.9 - .1 * i], [b.q[0], b.q[1], 1.7 - .1 * i]], {layer:lay, tier:'F', noSil:true, dim:far, bind:{rigid:n}, line:LT, tone:.35, zone:'feelers', tags:tg()}); });
  { const b = bone_(ANT[X][3]), dx = (b.q[0] - b.p[0]) / b.len, dy = (b.q[1] - b.p[1]) / b.len, q2 = [b.q[0] + dx * 12, b.q[1] + dy * 12], m = [b.p[0] + (b.q[0] - b.p[0]) * .45, b.p[1] + (b.q[1] - b.p[1]) * .45];
    M.strip('club' + X, [[m[0], m[1], 1.6], [b.q[0] - dx * 5, b.q[1] - dy * 5, 4.2], [q2[0], q2[1], 3]], {layer:lay + .05, tier:'F', noSil:true, dim:far, bind:{rigid:ANT[X][3]}, line:LT, tone:.2, zone:'feelers', tags:tg()}); }
}
PROBN.forEach((n, i) => { const b = bone_(n), w = 2.1 - .05 * i; M.limb('proboscis' + i, [[b.p[0] - (b.q[0] - b.p[0]) * .12, b.p[1] - (b.q[1] - b.p[1]) * .12, w, w], [b.q[0] + (b.q[0] - b.p[0]) * .12, b.q[1] + (b.q[1] - b.p[1]) * .12, w - .05, w - .05]], {layer:10.5 + i * .001, tier:'F', h:3, noSil:true, bind:{rigid:n}, line:LN.thin, tone:.55, zone:'mouth', tags:['head', 'mouth', 'proboscis']}); });
/* the legs: rigid tapering segments, a knee patch, a tarsus and a small claw at the toe; the near legs lie in front of the body and behind the near wings, the far legs behind the body */
for(const L of LEGS){
  const far = L.far, u = bone_('u' + L.tag), l = bone_('l' + L.tag), f = bone_('f' + L.tag), sc = L.i === 0 ? .82 : 1, lay = far ? 1.5 : 7.8, LL = far ? LN.legF : LN.leg, tg = (...t) => ['leg', ...(far ? ['F'] : []), ...t];
  const mk_ = (b, w0, w1, name) => M.limb(name + L.tag, [[b.p[0], b.p[1], w0 * sc, w0 * sc], [(b.p[0] + b.q[0]) / 2, (b.p[1] + b.q[1]) / 2, (w0 + w1) * sc / 2, (w0 + w1) * sc / 2], [b.q[0], b.q[1], w1 * sc, w1 * sc]], {layer:lay, tier:'F', h:7, bind:{rigid:b.name}, noSil:true, dim:far, line:LL, tone:.14, zone:'legs', tags:tg()});
  mk_(u, 5.4, 4.4, 'upper'); mk_(l, 4.2, 3.2, 'lower'); mk_(f, 2.9, 1.6, 'tarsus');
  M.zone('knee' + L.tag, ringPts(l.p, 5.6 * sc, 8, 0), {layer:lay + .1, tier:'F', h:6, inset:.4, bind:{mix:[[u.name, .5], [l.name, .5]]}, noSil:true, dim:far, line:LL, tone:.3, zone:'legs', tags:tg()});
  const q = f.q, dx = (q[0] - f.p[0]) / f.len, dy = (q[1] - f.p[1]) / f.len, nx = -dy, ny = dx;
  M.shape('claw' + L.tag, [[q[0] - dx * 2, q[1] - dy * 2], [q[0] + dx * 6 + nx * 3, q[1] + dy * 6 + ny * 3], [q[0] + dx * 9, q[1] + dy * 9], [q[0] + dx * 6 - nx * 3, q[1] + dy * 6 - ny * 3]], {layer:lay + .2, tier:'F', bind:{rigid:f.name}, noSil:true, dim:far, line:LL, tone:.8, zone:'legs', tags:tg('foot')});
}

/* ---------- the scene (its own page only): a bough with the empty case of a chrysalis, the milkweed with an umbel and a leaf, the ground; the egg appears on the leaf when it is laid ---------- */
const LEAFP = (c, ang, L, w, n = 9) => { const ca = Math.cos(ang), sa = Math.sin(ang), side = k => Array.from({length:n + 1}, (_, i) => { const u = i / n, v = k * w * Math.pow(Math.sin(Math.PI * Math.pow(u, .8)), .85); return [c[0] + ca * L * u - sa * v, c[1] + sa * L * u + ca * v]; });
  return side(1).concat(side(-1).reverse().slice(1, -1)); };
const SCN = {layer:2.1, tier:'M', line:LN.scene, zone:'scene', noSil:true, show:'scene'};
M.limb('bough', [[110, 120, 14, 14], [250, 114, 17, 17], [400, 108, 16, 16], [520, 100, 13, 13], [580, 96, 8, 8]], {...SCN, h:15, bind:{rigid:'bough'}, tone:.2, tags:['scene', 'bough']});
{ const L = [[330, 106, -1.62, 66, 17], [440, 100, -1.5, 70, 18], [160, 124, 1.75, 62, 16], [330, 108, 1.55, 76, 18], [500, 100, 1.5, 70, 17], [90, 122, 2.2, 60, 14]];
  mark(M.shapes('foliage', L.map(([x, y, a, l, w]) => LEAFP([x, y], a, l, w)), {...SCN, layer:2.2, bind:{rigid:'bough'}, tone:.22, tags:['scene', 'foliage']}), 'foliage'); }
/* the chrysalis case: a jade barrel hung from a silk pad on the bough by a stalk, a black band and a row of gold beads near its top; the adult is folded inside (the chrysalis posture) or has left it (emerge). It stays with the figure's sheet. */
const HUSK0 = [[430, 176], [439, 188], [449, 208], [465, 238], [477, 276], [480, 318], [472, 358], [452, 392], [430, 412], [408, 392], [388, 358], [380, 318], [383, 276], [395, 238], [411, 208], [421, 188]];
const HUSK = chaikin(HUSK0.map(([x, y]) => [230 + (x - 430) * 1.35, 150 + (y - 176) * 1.32]), 1);          // hangs from (230, 150): a barrel 311 long and 135 across at its widest (the adult is 273 from head to tail and folds inside)
const CASE_TOP = [230, 130];
M.limb('stalk', [[230, 108, 3.4, 3.4], [230, 128, 2.6, 2.6], [230, 150, 2.2, 2.2]], {layer:2.2, tier:'F', h:6, noSil:true, bind:{rigid:'husk'}, line:LN.fine, tone:.4, zone:'scene', show:'pupa', tags:['scene', 'case', 'stalk']});
mark(M.zone('case', HUSK, {layer:2.25, noSil:true, tier:'M', h:24, bind:{rigid:'husk'}, line:LN.scene, tone:.5, zone:'scene', show:'pupa', tags:['scene', 'case']}), 'jade');
M.rim('husk', HUSK, {layer:2.3, bind:{rigid:'husk'}, line:LN.fine, noSil:true, zone:'scene', tags:['scene', 'case', 'caseTop'], s:9, show:'pupa'});
M.line('slit', [[230, 335], [233, 375], [228, 408], [230, 432]], {layer:2.31, bind:{rigid:'husk'}, line:LN.fine, noSil:true, zone:'scene', tags:['scene', 'case', 'caseTop'], show:'pupa'});
{ const arc = (a, y0, k, n) => Array.from({length:n}, (_, i) => { const u = (i / (n - 1) - .5) * 2; return [230 + u * a, y0 + k * u * u]; });
  M.strip('goldBand', arc(40, 200, 8, 9).map(([x, y]) => [x, y, 2.6]), {layer:2.31, noSil:true, tier:'F', bind:{rigid:'husk'}, line:LN.vein, tone:0, zone:'scene', show:'pupa', tags:['scene', 'case', 'caseTop']});
  M.shapes('goldDots', [...arc(38, 214, 9, 8).map(p => ringPts(p, 3.1, 7)), ...arc(30, 232, 8, 7).map(p => ringPts(p, 2.2, 6))], {layer:2.32, tier:'F', bind:{rigid:'husk'}, ink:'gold', line:'glyph', tone:.92, zone:'glyph', show:'pupa', tags:['glyph', 'scene', 'case', 'caseTop', 'beads']}); }
/* the milkweed: a stem, a flat umbel of small flowers (pink, which is the ink), one big leaf seen nearly edge-on, and the ground line */
M.limb('stem', [[STEM, GY, 5.4, 5.4], [STEM - 2, 700, 4.6, 4.6], [STEM + 2, 620, 4, 4], [STEM, 580, 3.4, 3.4]], {...SCN, layer:2.1, h:12, bind:{rigid:'flower'}, tone:.22, tags:['scene', 'milkweed']});
{ const list = [], cen = UMB; list.push(ringPts(cen, 9, 6)); for(let i = 0; i < 7; i++) list.push(ringPts([cen[0] + Math.cos(i * 6.2832 / 7 + .3) * 26, cen[1] + Math.sin(i * 6.2832 / 7 + .3) * 20], 9, 6)); for(let i = 0; i < 11; i++) list.push(ringPts([cen[0] + Math.cos(i * 6.2832 / 11) * 45, cen[1] + Math.sin(i * 6.2832 / 11) * 30], 8.2, 6));
  mark(M.shapes('umbel', list, {...SCN, layer:2.5, tier:'F', bind:{rigid:'flower'}, line:LN.rim, tone:.55, tags:['scene', 'milkweed', 'umbel']}), 'bloom');
  M.shapes('umbelHeads', list.map(p => { const c = [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length]; return ringPts(c, 3.2, 5); }), {...SCN, layer:2.55, tier:'F', bind:{rigid:'flower'}, line:LN.fine, tone:.3, tags:['scene', 'milkweed', 'umbel']}); }
const LEAFANG = Math.atan2(LEAF1[1] - LEAF0[1], LEAF1[0] - LEAF0[0]), LEAFL = Math.hypot(LEAF1[0] - LEAF0[0], LEAF1[1] - LEAF0[1]), LEAFW = 12;
mark(M.zone('mleaf', LEAFP(LEAF0, LEAFANG, LEAFL, LEAFW, 18), {...SCN, layer:2.4, h:14, bind:{rigid:'leaf'}, tone:.24, tags:['scene', 'milkweed', 'mleaf']}), 'foliage');
M.strip('mleafRib', Array.from({length:8}, (_, i) => { const u = .02 + .94 * i / 7; return [LEAF0[0] + (LEAF1[0] - LEAF0[0]) * u, LEAF0[1] + (LEAF1[1] - LEAF0[1]) * u, 1.4 - .7 * u]; }), {...SCN, layer:2.45, tier:'F', bind:{rigid:'leaf'}, line:LN.fine, tone:.5, tags:['scene', 'milkweed', 'mleaf']});
const LEAFTOP = x => { const u = (LEAF0[0] - x) / (LEAF0[0] - LEAF1[0]), cy = LEAF0[1] + (LEAF1[1] - LEAF0[1]) * u, hw = LEAFW * Math.pow(Math.sin(Math.PI * Math.pow(clamp(u), .8)), .85); return cy - hw; };   // the leaf's upper surface at x
M.line('groundLine', [[-20, GY + 4], [200, GY + 2], [500, GY + 5], [800, GY + 3], [1020, GY + 4]], {layer:2.05, noSil:true, bind:{rigid:'flower'}, line:LN.scene, tone:.3, zone:'scene', show:'scene', tags:['scene', 'ground']});
const CURLK = [1.4, 1.2, 1.62], EGGX = [431, 410, 449];
EGGX.forEach((x, i) => mark(M.shape('egg' + (i + 1), ellipsePts([x, LEAFTOP(x) - 4.4], 4.4, 5.6, 8), {layer:2.9, noSil:true, tier:'F', bind:{rigid:'leaf'}, line:LN.rim, tone:.9, zone:'scene', show:'egg' + (i + 1), tags:['scene', 'egg']}), 'egg'));

/* ---------- muscles: real names, each turning the joints it really turns; one per side where the body has two (near N and far F) ----------
   The flight muscles of a butterfly are indirect (dorsolongitudinal and dorsoventral muscles deform the thorax, and the wing hinge turns that into a stroke); the direct muscles (basalar, subalar) steer the wing, sweeping it
   forward and back. The elevation itself is a plane scale (see the header), driven by the figure's hook and biased by the Wings pad; the thorax muscles light with it. */
const glow = (c, rx, ry, a = .4) => K.glow(c[0], c[1], rx, ry, a);
const mus = (id, d) => M.muscle(id, d);
const FWZ = i => 'fws' + i + '$', HWZ = i => 'hws' + i + '$';
mus('basalar', {name:'basalar: sweeps the forewing forward', g:'wing', pair:'NF', c:P(8, -14), r:[34, 24], on:['thorax'], jt:[[FWZ(0), .5], [FWZ(1), .5], [FWZ(2), .55]], hue:'#e3806f', speed:22});
mus('subalar', {name:'subalar: sweeps the forewing back', g:'wing', pair:'NF', c:P(14, -14), r:[34, 24], on:['thorax'], jt:[[FWZ(0), -.7], [FWZ(1), -.7], [FWZ(2), -.75]], hue:'#ffbe00', speed:22});
mus('hwFwd', {name:'pleural: swings the hindwing forward', g:'wing', pair:'NF', c:P(0, -14), r:[34, 24], on:['thorax'], jt:[[HWZ(0), .45], [HWZ(1), .5]], hue:'#d985a6', speed:20});
mus('hwBack', {name:'pleural: swings the hindwing back', g:'wing', pair:'NF', c:P(0, -10), r:[34, 24], on:['thorax'], jt:[[HWZ(0), -.6], [HWZ(1), -.65]], hue:'#c79ae0', speed:20});
mus('fwTip', {name:'wing flexor: bends the forewing tip back', g:'wing', pair:'NF', c:P(30, -150), r:[60, 60], on:['fore'], jt:[[FWZ(1), -.1], [FWZ(2), -.35]], hue:'#5cc6b4', speed:18});
mus('hwTip', {name:'wing flexor: bends the hindwing tip back', g:'wing', pair:'NF', c:P(-80, -120), r:[60, 60], on:['hind'], jt:[[HWZ(1), -.35]], hue:'#5cc6b4', speed:18});
mus('antLev', {name:'antennal levator: raises the antenna', g:'antenna', pair:'NF', c:P(110, -40), r:[40, 30], on:['antenna'], jt:ANT.N.map((n, i) => ['ant$' + i, -.12]), hue:'#9aa6d8', speed:12, shade:glow(P(110, -40), 34, 26, .3)});
mus('antDep', {name:'antennal depressor: lowers and curls the antenna', g:'antenna', pair:'NF', c:P(120, -48), r:[40, 30], on:['antenna'], jt:ANT.N.map((n, i) => ['ant$' + i, .06 + .07 * i]), hue:'#7ec3e6', speed:10});
mus('breath', {name:'the breath (abdominal pump)', g:'body', c:P(-95, 0), r:[70, 26], pull:[0, -.05], on:['abdomen'], hue:'#8fd0a8', speed:5, shade:glow(P(-95, 0), 60, 20, .25)});
mus('dlm', {name:'dorsolongitudinal: thorax, downstroke', g:'body', c:P(12, -4), r:[40, 26], pull:[-.05, .02], on:['thorax'], hue:'#e3806f', speed:20});
mus('dvm', {name:'dorsoventral: thorax, upstroke', g:'body', c:P(12, -4), r:[40, 26], pull:[.03, -.06], on:['thorax'], hue:'#7ec3e6', speed:20});
mus('abdRaise', {name:'abdominal extensor: lifts the abdomen', g:'body', c:P(-95, -10), r:[70, 26], on:['abdomen'], jt:ABD.map((n, i) => [n, .12 + .06 * i]), hue:'#ffbe00', speed:7, shade:glow(P(-95, -10), 60, 18, .3)});
mus('abdCurl', {name:'abdominal flexor: curls the abdomen down', g:'body', c:P(-95, 10), r:[70, 26], on:['abdomen'], jt:ABD.map((n, i) => [n, -(.3 + .15 * i)]), hue:'#e3806f', speed:7, shade:glow(P(-95, 10), 60, 18, .3)});
mus('headUp', {name:'splenius: lifts the head', g:'head', c:P(48, -10), r:[26, 20], on:['head'], jt:[['head', -.5]], hue:'#9aa6d8', speed:8});
mus('headDown', {name:'sternocleidomastoid analogue: lowers the head', g:'head', c:P(48, 10), r:[26, 20], on:['head'], jt:[['head', .6]], hue:'#9aa6d8', speed:8});
mus('probExt', {name:'proboscis uncoiling (stipital pressure)', g:'mouth', c:P(92, 16), r:[26, 20], on:['proboscis'], jt:PROBN.map((n, i) => [n, -PROBREST[i]]), hue:'#d985a6', speed:9, shade:glow(P(92, 16), 22, 18, .3)});
mus('probSwing', {name:'proboscis swing (the probing)', g:'mouth', c:P(86, 14), r:[26, 20], on:['proboscis'], jt:[[PROBN[0], .3]], hue:'#c79ae0', speed:10});
/* the scene's own motion, the chrysalis heart, and the things the figure's state shows */
mus('breezeBough', {name:'(breeze: the bough)', g:'scene', c:[350, 108], r:[100, 24], jt:[['bough', .02]], hue:'#8fd0a8', speed:3});
mus('breezeHusk', {name:'(breeze: the husk)', g:'scene', c:[230, 280], r:[40, 80], jt:[['husk', .05]], hue:'#8fd0a8', speed:3});
mus('breezeFlower', {name:'(breeze: the umbel)', g:'scene', c:[STEM, 600], r:[40, 100], jt:[['flower', .03]], hue:'#8fd0a8', speed:3});
mus('breezeLeaf', {name:'(breeze: the milkweed leaf)', g:'scene', c:[640, 690], r:[100, 30], jt:[['leaf', .06]], hue:'#8fd0a8', speed:3});
mus('heart', {name:'dorsal vessel: the pupa\'s heart', g:'scene', c:[230, 300], r:[80, 130], pull:[-.06, -.045], on:['case'], hue:'#e0523f', speed:16});
mus('pupa', {name:'(the chrysalis case is shown)', g:'scene', hue:'#d4a03c', speed:7});
mus('scene', {name:'(the page\'s own scene is shown)', g:'scene', hue:'#d4a03c', speed:7});
for(const i of [1, 2, 3]) mus('egg' + i, {name:'(egg ' + i + ' laid)', g:'scene', hue:'#d4a03c', speed:12});

/* ---------- postures: where the body is held ----------
   fly (the wingbeat; the legs drawn up; level) · bask (standing on the milkweed leaf, the wings in a V to the sun) · roost (on the leaf, the wings closed together above the back: the emblem) · feed (on the umbel, the proboscis down)
   · down (on the ground, the wings spread low) · chrysalis (the adult folded in its own case, head down) · emerge (just out of the case, hung from it head up, the wings small and crumpled). The wing's held state (stS, stH, stC) and its
   sweep are posture channels; the elevation's beat is the hook's. */
const RT = (root, p) => { const [dx, dy, r] = root, c = Math.cos(r), s = Math.sin(r), x = p[0] - CX, y = p[1] - BY; return [CX + c * x - s * y + dx, BY + s * x + c * y + dy]; };
const footRest = L => { const w = bone_('f' + L.tag).p, q = bone_('f' + L.tag).q; return [q[0], q[1], Math.atan2(q[1] - w[1], q[0] - w[0])]; };
const STAND = LEGS.map(footRest);
const TUCKB = [[50, 40], [-4, 70], [-46, 84]];       // the legs drawn up in flight: the forelegs against the chest, the others trailing under the abdomen
const TUCK = LEGS.map(L => { const t = TUCKB[L.i], o = L.far ? FAR_L : [0, 0], p = P(t[0] + o[0], t[1] + o[1]), h = L.hip; return [p[0], p[1], Math.atan2(p[1] - h[1], p[0] - h[0])]; });
/* a standing posture: the root's turn r and the world point the middle foot (near) stands on: the root is solved so the foot lands there; the others keep their places in the body frame */
function standRoot(r, at){ const f = RT([0, 0, r], STAND[1]); return [at[0] - f[0], at[1] - f[1], r]; }
const feetThrough = (root, F) => F.map(f => { const q = RT(root, f); return [q[0], q[1], f[2] + root[2]]; });
const SWEEP = (f, h = f, o = {}) => { const j = {...o}; for(const X of SIDES){ for(let i = 0; i < 3; i++) j['fws' + i + X] = f; for(let i = 0; i < 2; i++) j['hws' + i + X] = h; } return j; };
const HELD = (s, h = s, c = 0) => ({stS:s, stH:h, stC:c});
const ANTJ = (k, side = 'NF') => { const o = {}; for(const X of side) ANT[X].forEach((n, i) => { o[n] = Array.isArray(k) ? k[i] : k; }); return o; };
const SG = .41, SGH = .38, GLIDE_SW = .1, GLIDE_SWH = .02;     // the glide's held wings: a shallow V (24 and 22 degrees above the level)
const POSE = (name, o) => { const root = o.root || [0, 0, 0]; M.posture(name, {...o, feet:feetThrough(root, o.feet || STAND)}); };
const FLYROOT = [0, 0, -.12];
POSE('fly', {root:FLYROOT, jt:{...SWEEP(GLIDE_SW, GLIDE_SWH), ...HELD(SG, SGH), head:.1, ...ANTJ(-.08)}, feet:TUCK});
const BASK_AT = [530, LEAFTOP(530)], BASK_R = standRoot(0, BASK_AT);
POSE('bask', {root:BASK_R, jt:{...SWEEP(.08, .02), ...HELD(.64, .56), head:.12}});
POSE('roost', {root:BASK_R, jt:{...SWEEP(-.06, .3), ...HELD(.99, .96), head:.1, ...ANTJ(.2)}, slide:{fwp0F:[8, 12], fwp1F:[8, 12], fwp2F:[8, 12], hwp0F:[8, 12], hwp1F:[8, 12]}});
const FEED_AT = [UMB[0] - 52, UMB[1] - 33], FEED_R = standRoot(.4, FEED_AT);
POSE('feed', {root:FEED_R, jt:{...SWEEP(-.04, -.06), ...HELD(.84, .74), head:.9}});
const DOWN_AT = [884, GY - 2], DOWN_R = standRoot(.08, DOWN_AT);
POSE('down', {root:DOWN_R, jt:{...SWEEP(.1, 0), ...HELD(.2, .12), head:.34, ...ANTJ(.7)}});
/* the chrysalis: the adult, head down, folded inside the case (the wings crumpled and swept back along the body, the antennae folded, the legs against the chest); the emerged adult hangs head up from the empty case */
const CHR_R = (() => { const c = Math.cos(Math.PI / 2), s = Math.sin(Math.PI / 2), t = [12, 0]; return [230 - (CX + c * t[0] - s * t[1]), 350 - (BY + s * t[0] + c * t[1]), Math.PI / 2]; })();
const CHR_FEET = [[66, 34], [34, 26], [8, 22]].map(p => P(...p));
POSE('chrysalis', {root:CHR_R, jt:{...SWEEP(-1.5), ...HELD(1, 1, .8), head:.2, ...ANTJ([1.15, .55, .3, 0])}, feet:[...CHR_FEET, ...CHR_FEET.map(p => [p[0] + FAR_L[0], p[1] + FAR_L[1]])].map((p, i) => [p[0], p[1], Math.atan2(p[1] - LEGS[i].hip[1], p[0] - LEGS[i].hip[0])])});
const EMG_R = (() => { const r = -Math.PI / 2, c = Math.cos(r), s = Math.sin(r), t = [66, 0]; return [230 - (CX + c * t[0] - s * t[1]), 452 - (BY + s * t[0] + c * t[1]), r]; })();
const GRIP = LEGS.map(L => { const o = L.far ? FAR_L : [0, 0], t = [[88, 22], [58, 40], [30, 46]][L.i], p = P(t[0] + o[0], t[1] + o[1]); return [p[0], p[1], Math.atan2(p[1] - L.hip[1], p[0] - L.hip[0])]; });
POSE('emerge', {root:EMG_R, jt:{...SWEEP(-1.4, -1.45), ...HELD(1, 1, .74), head:-.1, ...ANTJ(.25)}, feet:GRIP, cam:[1, 500, 450]});   // (the hang is long: the page's camera lowers to keep the wings in view)
const GW = (w, r, l = [0, 1500]) => ({wing:w, root:r, legs:l, head:[300, 1600], abdomen:[200, 2000], antenna:[0, 1600], mouth:[0, 1200]});
M.edge('fly>bask', {ms:3600, g:GW([300, 1800], [500, 2600], [900, 2400]), bumps:[['ry', 0, 900, -22]]});
M.edge('fly>roost', {ms:4000, g:GW([200, 2200], [600, 2800], [1000, 2500])});
M.edge('fly>feed', {ms:3800, g:GW([0, 1800], [300, 2800], [1000, 2400])});
M.edge('fly>down', {ms:3400, g:GW([0, 1600], [400, 2600], [1300, 1800])});
M.edge('bask>roost', {ms:2600, g:{wing:[0, 2000], head:[200, 1800], abdomen:[300, 1800], antenna:[0, 1600]}});
M.edge('bask>feed', {ms:4000, g:GW([600, 2000], [200, 3200], [800, 2800]), bumps:[['ry', 0, 1400, -60]]});
M.edge('bask>down', {ms:3800, g:GW([0, 1400], [300, 2600], [900, 2400]), bumps:[['ry', 0, 2400, -110]]});
M.edge('emerge>fly', {ms:5200, g:GW([0, 3400], [900, 4000], [2400, 2400]), bumps:[['ry', 2400, 2400, 18]]});
M.edge('emerge>bask', {ms:6000, g:GW([0, 3600], [1300, 4400], [3200, 2400])});
M.edge('chrysalis>emerge', {ms:7600, g:{wing:[2800, 3600], root:[600, 5600], legs:[1800, 4000], head:[800, 3000], abdomen:[1200, 4000], antenna:[2600, 3000], mouth:[2600, 3000], scene:[0, 2000]}, c:{ry:[1800, 4200], rx:[1800, 4200], rr:[1800, 4200]}, bumps:[['rx', 1800, 4200, -58]]});   // the body turns half a circle about its head, which stays at the case's mouth
M.transitCost('chrysalis', 3000);
/* where the feet stand in each posture, in the figure's own canvas (the crew's scene reads these to put a figure down on its plant) */
const ANCHOR = {bask:BASK_AT, roost:BASK_AT, feed:FEED_AT, down:DOWN_AT, chrysalis:CASE_TOP, emerge:[230, 452]};

const MAL = K.hexInt(K.ROSTER.malachite), AMB = K.hexInt(K.ROSTER.amber), GOLD = K.hexInt(K.ROSTER.gold);

/* ---------- the figure's own state: the wingbeat, the heart, the eggs ----------
   Run from the idle hook every frame, and made again when the clock goes back (c.reset). The state lives on c.mon (the kit owns c.mn). */
const KF = .22;                                    // how much of the body's bob and pitch the tucked legs follow (a fifth: they hang loose; fully rigid would carry the toes 20 units off their posture's place)
const FREQ = 3.5;                                   // wingbeats a second at cruise: a monarch really beats 5 to 10; 3 to 4 reads on a 60 Hz screen as a beat with its up-clap and its down-sweep (CREW-NOTES-MONARCH-FLIGHT.md, "The beat")
const MID = rad(14), AMPF = rad(52);                // the elevation runs +66 degrees at the top of the stroke to -38 at the bottom
const thOf = (u, am, mid = MID) => mid + am * Math.cos(2 * Math.PI * u - .22 * Math.sin(2 * Math.PI * u));
const sinTh = (u, am, mid = MID) => Math.sin(thOf(u, am, mid));
const ZLAG = {fore:[0, .022, .05], hind:[.05, .075]}, ZAMP = {fore:[1, .97, .93], hind:[.88, .82]};
const SWP = u => rad(6) - rad(14) * Math.cos(2 * Math.PI * (u - .03));        // in-plane sweep: back at the top, forward at the bottom
const newMn = () => ({t:0, ph:.3, k:0, bout:true, nextBout:0, flyAt:-1, kCap:1, kForce:null, lp:0, hbAt:-1e9, hbNext:0, exp:0, eggs:0, lw:1, face:{foreN:1, foreF:1, hindN:1, hindF:1}, faceDrawn:{}, pad:[0, 0, 0, 0], vs:0, sp:0});
const state = c => { if(!c.mon || c.t < c.mon.t - 1){ c.mon = newMn(); c.mon.ph = c.rand(); for(let i = 0; i < c.d.NPOLY; i++) c.colDirty.add(i); } return c.mon; };   // (the kit paints the colour hook only on a polygon that changes: mark them all, once)
const bonePt = (c, name, u = 1) => { const B = bone_(name); return c.wp(name, [B.p[0] + (B.q[0] - B.p[0]) * u, B.p[1] + (B.q[1] - B.p[1]) * u]); };

/* a crew member can begin in a posture (spec.start): the posture state, its smoothers and the legs' places are set to it at once, so a figure that is to hang in a chrysalis or roost on a bough does not first fly there */
function snapTo(c, name){
  const d = c.d, S = c.pm, V = d.POSTURES[name]; if(!V) return;
  S.V.set(V); S.node = name; S.want = name; S.tr = null; S.route.length = 0; S.pend.length = 0; S.after = null; S.settle = 1e5; S.hold = 0; S.wInit = 0;
  for(const n of d.POSTURE_NAMES) S.w[n] = n === name ? 1 : 0;
  for(let i = 0; i < 3; i++){ c.rs.x[i] = V[i]; c.rs.v[i] = 0; }
  for(const [b, i] of d.jointIdx){ c.js.x[b] = V[i]; c.js.v[b] = 0; }
  for(const [b, ix, iy] of d.slideIdx){ c.ps.x[b * 2] = V[ix]; c.ps.v[b * 2] = 0; c.ps.x[b * 2 + 1] = V[iy]; c.ps.v[b * 2 + 1] = 0; }
  d.IKD.forEach((D, k) => { const x = V[d.CHI['f' + k + 'x']], y = V[d.CHI['f' + k + 'y']], b = V[d.CHI['f' + k + 'b']], L = c.leg[k]; Object.assign(L, {x, y, b, sx:x, sy:y, sb:b, tx:x, ty:y, tb:b, vx:0, vy:0, vb:0, w:1, wT:1}); c.ikS[k].n = [0, 0, 0]; });
  c.force = true;
}
function figureStep(c, now, dt){
  const E = state(c); if(!E.started){ E.started = true; const st = c.crew && c.crew.m && c.crew.m.spec && c.crew.m.spec.start; if(st) snapTo(c, st); }
  const w = c.pm.w, node = c.pm.node, tr = c.pm.tr, T = c.Tp, tmp = Math.min(c.tempo, 1)   /* the beat's rate is the Dynamics pad's to slow, not to quicken: a faster beat moves the wing further than the figure's limits (set for 3.5 a second) allow */, mf = clamp(c.mot.scale, .5, 1.3), q = c.pad.flight.L, V = c.pm.V, CHI = c.d.CHI;
  const FL = c.crew && c.crew.m ? c.crew.m.fl : null, hv = FL ? FL.hover : 0, spd = FL ? FL.spd : 200;
  E.t = now;
  /* the beat: bouts of flapping and glides in the flight posture (no glides while it hovers), none anywhere else (the flight weight fades it in and out) */
  const wf = w.fly || 0, inFly = node === 'fly' && !tr;
  if(inFly){ if(E.flyAt < 0) E.flyAt = now; } else E.flyAt = -1;
  const take = (tr && tr.b === 'fly') || (inFly && now - E.flyAt < 1800);
  if(take){ E.bout = true; E.nextBout = now + 1800 + c.rand() * 1400; }
  else if(inFly && now > E.nextBout){ E.bout = !E.bout; E.nextBout = now + (E.bout ? 1500 + c.rand() * 1500 : 650 + c.rand() * 900); }
  let kT = take || hv > .5 ? 1 : E.kForce ?? Math.min(E.bout ? 1 : 0, E.kCap);
  kT = q[0] < 0 ? kT * (1 + q[0]) : Math.max(kT, q[0]);
  E.k += (kT - E.k) * (1 - Math.exp(-dt / 190));
  E.ph = (E.ph + dt * tmp * FREQ * Math.pow(2, .6 * q[1]) / 1000) % 1;
  const A = E.k * wf * mf, depth = 1 + .06 * hv - .08 * clamp((spd - 200) / 200);
  const held = (ch, f) => V[CHI['j:' + ch]] ?? f, hS = held('stS', 0), hH = held('stH', 0), cr0 = held('stC', 0) * (1 - E.exp), cr = 1 - .82 * cr0;
  const GS = {fore:SG, hind:SGH}, HS = {fore:hS, hind:hH}, SGW = {fore:GLIDE_SW, hind:GLIDE_SWH};
  const padN = E.pad[0], padF = E.pad[2];
  let lead = 0; E.sv = E.sv || {foreN:0, foreF:0, hindN:0, hindF:0};
  for(const X of SIDES) for(const G of [FW, HW]){
    const k = G.key, far = X === 'F', ph0 = far ? .03 : 0, kk = k === 'hind' ? .9 : 1;
    for(let i = 0; i < G.nz; i++){
      const u = E.ph - ZLAG[k][i] - ph0 - (k === 'hind' ? .0 : 0), sB = sinTh(u, AMPF * ZAMP[k][i] * depth * kk), sw = SWP(u - .02) * (k === 'hind' ? .8 : 1);
      let s = HS[k] + A * (sB - GS[k]) + .5 * (far ? padF : padN) * (1 - .5 * A);
      s = clamp(s, -1, 1);
      c.scale(G.pre + 'p' + i + X, cr, cr * s);
      c.jd(G.pre + 's' + i + X, A * (sw - SGW[k]));
      if(i === 0) E.sv[k + X] = s;
      if(k === 'fore' && i === 0 && !far) lead = s;
    }
  }
  const lf = (lead - E.lp) / Math.max(dt, 1) * 1000; E.lp = lead; E.vs += (lf - E.vs) * (1 - Math.exp(-dt / 40));
  /* which face of each wing the side view shows (the underside while it is up, the upper side while it is below the body): the colour hook paints it; a hysteresis keeps the edge-on moment from flickering */
  for(const key in E.sv){ const s = E.sv[key], f = E.face[key]; if(s > .07 && f > 0) E.face[key] = -1; else if(s < -.07 && f < 0) E.face[key] = 1; }
  { const dn = pos(-E.vs) / 11, up = pos(E.vs) / 11;   // (E.vs: the wing's sine per second, about +-16 at the quickest): the thorax's engine lights with the stroke; the direct muscles are the pads' and the actions' (the beat's own sweep is the joints', as the eagle's)
    c.spec(T, {dlm:A * dn * .9, dvm:A * up * .9}); }
  if(A > .002){
    const bob = -20 * A * (.5 - .5 * Math.cos(2 * Math.PI * (E.ph - .1))), pitch = .07 * A * Math.sin(2 * Math.PI * (E.ph - .05));
    c.Q.by += bob; c.jd('body', pitch);
    { const ct = Math.cos(pitch), st = Math.sin(pitch);   // the tucked legs ride the body's bob and pitch (their targets are in the world, the body is moving in it)
      for(let k = 0; k < c.d.NL; k++){ const f = c.foot(k), x = f[0] - CX, y = f[1] - BY; c.legReq(k, f[0] + KF * (CX + ct * x - st * y - f[0]), f[1] + KF * (BY + st * x + ct * y + bob - f[1]), f[2] + KF * pitch, {kk:18}); } }
    c.jd('head', -pitch * .9 + .015 * A * Math.sin(2 * Math.PI * (E.ph + .1)));
    c.jd(ABD[0], -.13 * A * Math.sin(2 * Math.PI * (E.ph - .05))); c.jd(ABD[1], -.07 * A * Math.sin(2 * Math.PI * (E.ph - .12)));
    for(const X of SIDES) ANT[X].forEach((n, i) => c.jd(n, .03 * A * (1 + i) * Math.sin(2 * Math.PI * (E.ph - .08 - i * .02))));
  }
  E.kCap = 1; E.kForce = null;
  /* a posture change turns and lifts the body while the legs would have to carry their targets through it (half a circle from the chrysalis), and an IK leg that took the wrong branch stays on it: for the middle of every edge that
     touches the chrysalis or the emerged hang the legs ride the body (IK weight 0, which also clears the solver's memory) and are solved afresh at either end */
  { const meta = !!tr && (tr.a === 'chrysalis' || tr.b === 'chrysalis' || tr.a === 'emerge' || tr.b === 'emerge'), u = meta ? tr.t / tr.ms : 0, lwT = meta ? 1 - fSmooth(.12, .26, u) * (1 - fSmooth(.9, .98, u)) : 1;
    E.lw += (lwT - E.lw) * (1 - Math.exp(-dt / (lwT < E.lw ? 260 : meta ? 300 : 90)));
    if(E.lw < .999) for(let k = 0; k < c.d.NL; k++){ const r = c.Q.legs[k]; if(r) r.w = Math.min(r.w, E.lw); } }
  /* the chrysalis: the heart beats (the silent stage is told from a stall by it); the case's outline rides over the adult inside */
  const pw = w.chrysalis || 0;
  if(pw > .55){ E.exp = 0; if(now > E.hbNext){ E.hbAt = now; E.hbNext = now + 1900 + 140 * Math.sin(now * .0007); E.beats = (E.beats || 0) + 1; c.glyph(1100); c.burstAt(230, 232, 56, GOLD, 'scene'); } }
  const hb = now - E.hbAt; c.spec(T, {heart:(pulse(hb, 0, 90, 70, 240) + .55 * pulse(hb, 300, 80, 50, 220)) * pw});
  if((pw + (w.emerge || 0)) > .5 && !E.raised){ E.raised = true; c.raise('caseTop'); } else if((pw + (w.emerge || 0)) < .3 && E.raised){ E.raised = false; c.raise(null); }
  /* the eggs laid so far stay on the leaf (its own page) */
  c.spec(T, {egg1:E.eggs >= 1 ? 1.2 : 0, egg2:E.eggs >= 2 ? 1.2 : 0, egg3:E.eggs >= 3 ? 1.2 : 0});
  return E;
}

/* ---------- actions: layers on the posture. The lasting states (the wings' expansion, the eggs) are the figure's own, in c.mon. ---------- */
M.action('flapBout', {label:'Flap: a bout of wingbeats', group:'Flight', dur:5000, in:['fly'], f:(t, T, c) => { const E = state(c), e = env(t, 500, 3600, 700); if(e > .02) E.kForce = e; c.spec(T, {antLev:[.2 * e, .2 * e]}); }});
M.action('glide', {label:'Glide', group:'Flight', dur:3600, in:['fly'], f:(t, T, c) => { const E = state(c), u = env(t, 500, 2000, 700); E.kCap = Math.min(E.kCap, 1 - u);   // the beat stops and the wings are held out in a V: a flap-glide butterfly spends a third of its flight so
  c.spec(T, {basalar:.1 * u, antLev:.3 * u}); }});
M.action('flutter', {label:'Flutter', group:'Wings', dur:3000, in:['bask', 'feed', 'roost'], f:(t, T, c) => {   // the wings shiver, a quick small beat (warming the flight muscles): the held wings tremble about where they stand
  const u = env(t, 350, 1900, 600), a = Math.sin(t * .036), b = Math.sin(t * .036 - .6);
  for(const X of SIDES){ c.jd('fws0' + X, .06 * u * a); c.jd('fws1' + X, .09 * u * a); c.jd('fws2' + X, .12 * u * b); c.jd('hws0' + X, .05 * u * b); c.jd('hws1' + X, .08 * u * b); }
  c.spec(T, {dvm:.5 * u * (.5 + .5 * a), dlm:.5 * u * (.5 - .5 * a), antLev:[.18 * u, .18 * u], breath:.4 * u}); }});
M.action('nectar', {label:'Nectar: uncoil the proboscis and feed', group:'Feeding', dur:7800, in:['feed'], f:(t, T, c, a) => {   // the proboscis uncoils, probes the florets and coils again; the thorax pumps
  const ext = env(t, 1100, 4900, 1000), probe = Math.sin(t * .0036) * env(t - 1500, 700, 3300, 800), pump = .5 + .5 * Math.sin(t * .013);
  c.spec(T, {probExt:ext, probSwing:.55 * probe, headDown:.2 * ext, dvm:.4 * ext * pump, dlm:.4 * ext * (1 - pump), antLev:[.08, .08], breath:.3 + .3 * pump * ext});
  for(const X of SIDES){ c.jd('fws0' + X, .04 * ext * Math.sin(t * .02)); c.jd('fws2' + X, .07 * ext * Math.sin(t * .02 - .5)); }
  const n = a.n ?? (a.n = 0), at = [2300, 3700, 5100][n]; if(at !== undefined && t > at){ a.n = n + 1; const tp = bonePt(c, PROBN[PROBN.length - 1], 1); c.burstAt(tp[0], tp[1], 34, GOLD, 'scene'); } }});
M.action('layEgg', {label:'Lay an egg on the milkweed', group:'Producing', dur:6600, in:['bask'], f:(t, T, c, a) => {   // the wings half close, the abdomen curls down to the leaf, touches it, and an egg stays there (the next generation, laid)
  const E = state(c), cur = env(t, 1500, 2700, 1200), touch = pulse(t, 2600, 400, 900, 500), kc = CURLK[a.n0 ?? (a.n0 = E.eggs % 3)];   // each egg its own place on the leaf: the curl reaches a little further or less
  c.spec(T, {abdCurl:cur * kc + touch * .1, headDown:.12 * cur, antLev:[.15, .15], breath:.4});
  for(const X of SIDES){ c.jd('fws0' + X, -.1 * cur); c.jd('fws1' + X, -.1 * cur); c.jd('hws0' + X, -.12 * cur); }
  c.Q.by += 18 * cur;
  if(!a.laid && t > 3100){ a.laid = 1; E.eggs = Math.min(3, E.eggs + 1); E.laid = (E.laid || 0) + 1; } }});
M.action('pump', {label:'Pump the wings open', group:'Metamorph', dur:11000, in:['emerge'], f:(t, T, c) => {   // the adult just out of the chrysalis pumps haemolymph into the wing veins; they unfold in steps and stay unfolded
  const E = state(c), step = keys(t, [[0, 0], [900, 0], [1500, .17], [2500, .17], [3100, .36], [4300, .36], [4900, .55], [6100, .55], [6700, .74], [8200, .74], [8800, .9], [10000, .9], [10600, 1]]);
  E.exp = Math.max(E.exp, step);
  const pm = Math.max(pulse(t, 700, 200, 250, 400), pulse(t, 2300, 200, 250, 400), pulse(t, 3900, 200, 250, 400), pulse(t, 5500, 200, 250, 400), pulse(t, 7100, 200, 250, 400), pulse(t, 8700, 200, 250, 400));
  c.spec(T, {breath:-.8 * pm, dlm:.3 * pm, abdRaise:.1 * pm, antLev:[.2, .2]}); }});
M.action('sun', {label:'Bask in the sun', group:'Wings', dur:7600, in:['bask'], f:(t, T, c, a) => {              // the wings open to the light and tilt; the thorax warms; a flush of amber crosses them
  const u = env(t, 1000, 5000, 1200), th = .5 + .5 * Math.sin(t * .0031);
  for(const X of SIDES){ c.jd('fws0' + X, .14 * u); c.jd('fws1' + X, .16 * u); c.jd('fws2' + X, .18 * u); c.jd('hws0' + X, .1 * u); c.jd('hws1' + X, .12 * u); }
  c.spec(T, {dlm:.35 * u * th, dvm:.35 * u * (1 - th), antLev:[.3 * u, .3 * u], breath:.3 + .3 * u});
  if(!a.b && t > 500){ a.b = 1; c.burstAt(520, 330, 230, AMB); c.burstAt(520, 480, 230, AMB); } }});
M.action('settle', {label:'Settle on the roost', group:'Wings', dur:5200, in:['roost'], f:(t, T, c) => {         // the wings press together, the antennae fold, the breath slows
  const u = env(t, 1200, 2600, 1200);
  for(const X of SIDES){ c.jd('fws0' + X, -.05 * u); c.jd('hws0' + X, -.06 * u); }
  c.spec(T, {antDep:.5 * u, breath:-.2 * u, headDown:.1 * u}); }});
M.action('antFlick', {label:'Antenna flick', group:'Head', dur:1200, tiny:true, f:(t, T, c) => { const u = pulse(t, 80, 120, 100, 340) + pulse(t, 540, 100, 90, 300);
  c.spec(T, {antLev:[.6 * u, .4 * u], antDep:[.3 * u, .2 * u]}); }});
M.action('headScan', {label:'Scan', group:'Head', dur:2200, tiny:true, f:(t, T, c, a) => { const u = env(t, 300, 1000, 500), d = a.d ?? (a.d = c.rand() < .5 ? 1 : -1);
  c.spec(T, {[d > 0 ? 'headUp' : 'headDown']:.7 * u, antLev:[.25 * u, .25 * u], antDep:[.1 * u, .1 * u]}); }});
M.action('probeTouch', {label:'Taste with the proboscis', group:'Feeding', dur:2600, tiny:true, f:(t, T, c) => { const u = env(t, 500, 900, 500);   // the proboscis half uncoils to taste the air and coils again
  c.spec(T, {probExt:.45 * u, probSwing:.3 * Math.sin(t * .006) * u}); }});

/* ---------- pads: the wings (near and far), the wingbeat, the antennae, the proboscis, the head, the abdomen, the six legs ---------- */
M.pad('wings', {label:'Wings', group:'Wings', split:'NF', alwaysFx:true, x:['lower', 'raise'], y:['sweep forward', 'sweep back'],
  map:(x, y) => ({basalar:pos(-y), subalar:pos(y), hwFwd:pos(-y) * .8, hwBack:pos(y) * .8, dvm:pos(x) * .6, dlm:pos(-x) * .6}),
  fx:(c, x, y, b) => { const E = state(c); E.pad = [x, y, b[0], b[1]]; },
  ghost:(c, s) => { const X = s ? 'F' : 'N'; return [cl1(c.act('basalar', s) - c.act('subalar', s)), cl1(c.act('subalar', s) - c.act('basalar', s))]; }});
M.pad('wingtips', {label:'Wing tips', group:'Wings', split:'NF', x:['straight', 'bent back'], y:['', ''], map:x => ({fwTip:pos(x), hwTip:pos(x) * .8}), ghost:(c, s) => [cl1(c.act('fwTip', s)), 0]});
M.pad('flight', {label:'Wingbeat', group:'Wings', value:true, x:['glide', 'flap'], y:['slow', 'quick'], ghost:c => [cl1(c.pad.flight.L[0]), cl1(c.pad.flight.L[1])]});
M.pad('antennae', {label:'Antennae', group:'Head', split:'NF', x:['lower', 'raise'], y:['straight', 'curled'], map:(x, y) => ({antLev:pos(x) * .8, antDep:pos(y) * .9 + pos(-x) * .8}), ghost:(c, s) => [cl1(c.act('antLev', s) / .8 - c.act('antDep', s)), cl1(c.act('antDep', s) / .9)]});
M.pad('proboscis', {label:'Proboscis', group:'Head', x:['left', 'right'], y:['coiled', 'uncoiled'], map:(x, y) => ({probExt:pos(y), probSwing:x * .8}), ghost:c => [cl1(c.act('probSwing') / .8), cl1(c.act('probExt'))]});
M.pad('head', {label:'Head', group:'Head', x:['down', 'up'], y:['', ''], map:x => ({headUp:pos(x), headDown:pos(-x)}), ghost:c => [cl1(c.act('headUp') - c.act('headDown')), 0]});
M.pad('abdomen', {label:'Abdomen', group:'Body', x:['curl down', 'lift'], y:['still', 'pumping'], map:(x, y) => ({abdRaise:pos(x), abdCurl:pos(-x), breath:pos(y)}), ghost:c => [cl1(c.act('abdRaise') - c.act('abdCurl')), cl1(c.act('breath'))]});
for(let i = 0; i < 3; i++) M.pad('leg' + i, {label:'Leg pair ' + (i + 1), group:'Limbs', split:'NF', leg:'leg' + i, x:['back', 'forward'], y:['flexed', 'stretched']});

/* ---------- hooks ---------- */
const DEF = M.finish({
  reachCap:-999, strideMax:60,
  postureHold(c, w){
    const pw = (w.chrysalis || 0) + (w.emerge || 0);
    c.spec(c.Tp, {pupa:pw * 1.2, probExt:.25 * (w.down || 0)});   // grounded: the proboscis lies half out
  },
  idle(c, now, Ti, dt){
    const E = figureStep(c, now, dt), rest = 1 - Math.min(1, 1.6 * (c.pm.w.chrysalis || 0)), calm = rest * (1 - Math.min(1, 1.6 * (c.pm.w.fly || 0)));   // the chrysalis is silent but for its heart; the flier has its wingbeat
    c.spec(Ti, {breath:(.3 + .3 * Math.sin(now * .0021)) * rest, scene:c.crew ? 0 : 1.2, breezeBough:.5 * Math.sin(now * .0006), breezeHusk:.6 * Math.sin(now * .0009 + 1), breezeFlower:.6 * Math.sin(now * .0008 + 2), breezeLeaf:.6 * Math.sin(now * .0011 + .5),
      antLev:[(.1 + .05 * Math.sin(now * .0017)) * rest, (.1 + .05 * Math.sin(now * .0017 + 1.3)) * rest], antDep:[(.05 + .03 * Math.sin(now * .0023)) * rest, (.05 + .03 * Math.sin(now * .0023 + 2)) * rest]});
    /* the wings breathe, a little, when they are held */
    if(calm > .01) for(const X of SIDES){ const k = .012 * calm; c.jd('fws1' + X, k * Math.sin(now * .0016 + (X === 'F' ? .4 : 0))); c.jd('fws2' + X, 1.4 * k * Math.sin(now * .0016 - .5 + (X === 'F' ? .4 : 0))); }
  },
  colour:(c, i, col) => {
    const P_ = c.d.parts[c.d.PPART[i]], k = P_.mk; if(!k) return col;
    if(k === 'membrane'){ const E = c.mon, far = P_.tags.has('F'), vent = E && E.face[P_.wk] < 0, hind = P_.tags.has('hind');
      let o = mixInt(col, c.C.accent, .3 + .24 * hash(i * 7 + 1));
      if(vent) o = mixInt(o, c.C.gold, hind ? .36 : .16), o = mixInt(o, c.C.bone, hind ? .1 : .05);   // the underside the up-stroke shows: paler, yellower, most on the hindwing
      return far ? mixInt(o, c.C.skin, .42) : o; }
    if(k === 'spot') return mixInt(col, c.C.bone, P_.tags.has('F') ? .6 : .9);
    if(k === 'jade') return mixInt(col, MAL, .55);
    if(k === 'foliage') return mixInt(col, MAL, .5);
    if(k === 'bloom') return mixInt(col, c.C.bone, .35);
    if(k === 'egg') return mixInt(col, c.C.bone, .6);
    return col;
  },
  /* in a crew the pattern says when a figure feeds, lays, pumps: life keeps only the small things (an antenna flick, a scan, a flutter, a glide) */
  lifePick(c, pick){ return !!c.crew && (pick === 'layEgg' || pick === 'nectar' || pick === 'pump' || pick === 'sun'); },
  colourLive(c){ const E = state(c); for(const key of ['foreN', 'hindN']) if(E.faceDrawn[key] !== E.face[key]){ E.faceDrawn[key] = E.face[key]; for(const i of DEF.WIN[key]) c.colDirty.add(i); } },
  glyph:(cx, cy, part) => part.tags.has('beads') ? [clamp((cx - 188) / 84), 1] : null,
  life:{rate:1.5,
    small:[['antFlick', 2.2, 5000], ['headScan', 1.2, 7000], ['probeTouch', .8, 12000, ['bask', 'roost', 'feed']], ['flutter', 1.1, 14000, ['bask', 'feed', 'roost']], ['sun', 1.5, 16000, ['bask']], ['nectar', 2.4, 10000, ['feed']], ['layEgg', .9, 26000, ['bask']],
      ['settle', 1.2, 14000, ['roost']], ['glide', 1.6, 12000, ['fly']], ['flapBout', 1, 14000, ['fly']], ['pump', 3, 30000, ['emerge']]],
    moves:[['go:roost', .8, 14000, ['bask', 'fly', 'feed']], ['go:bask', 1.3, 0, ['roost', 'feed', 'fly', 'down', 'emerge']], ['go:fly', 1.4, 12000, ['bask', 'roost', 'feed']], ['go:feed', 1, 14000, ['bask', 'fly']], ['go:emerge', 1, 0, ['chrysalis']]],
    dwell:{bask:[3500, 7000], roost:[4500, 9000], fly:[7000, 12000], feed:[4500, 9000], emerge:[9000, 13000], chrysalis:[8000, 12000], down:[6000, 9000]}},
});
for(const D of DEF.IKD){ D.a[1] = D.a[0] + K.wrapA(D.a[1] - D.a[0]); D.a[2] = D.a[1] + K.wrapA(D.a[2] - D.a[1]); }   // the angles between a leg's bones on one branch
DEF.WIN = {foreN:[], foreF:[], hindN:[], hindF:[]}; for(let i = 0; i < DEF.NPOLY; i++){ const P_ = DEF.parts[DEF.PPART[i]]; if(P_.mk === 'membrane') DEF.WIN[P_.wk].push(i); }
/* what a crew's scene needs to know: where the feet stand in each posture, and the page's own scene (the milkweed, the leaf, the bough), in the figure's canvas, to draw the same scene at the crew's scale */
DEF.mf = {snapTo, fresh:c => { c.mon = newMn(); c.mon.ph = c.rand(); c.mon.started = true; for(let i = 0; i < c.d.NPOLY; i++) c.colDirty.add(i); }, anchor:ANCHOR, pivot:[CX, BY], hinge:{fore:FW.hinge, hind:HW.hinge}, caseTop:CASE_TOP, leafTop:LEAFTOP, leaf:[LEAF0, LEAF1], leafW:LEAFW, umbel:UMB, eggs:EGGX, glide:{fore:SG, hind:SGH}, freq:FREQ, ground:GY, stem:STEM,
  bough:[[110, 120, 14], [250, 114, 17], [400, 108, 16], [520, 100, 13], [580, 96, 8]], husk:HUSK, tucked:TUCKB};
/* the gate's limits were made for a lion walking; a monarch's wing beats 3.5 a second (about 17 frames a cycle) through +66 to -38 degrees, which moves the tip about 100 units a frame: a deliberate periodic motion, not a pop. The numbers are measured (CREW-NOTES-MONARCH-FLIGHT.md, "Limits"); continuity limits (joint limits, slip, out of view, overlay, feet) are not touched. */
DEF.gateLimits = {frame:125, interruptFrame:125, step48:310, jerk48:340, creepBy:{fly:4}, reason:'a wingbeat at 3.5 Hz (tip 100 units a frame, measured 99-102 frame, 258 step48, 320 jerk48; the beat is checked for smoothness directly by creature-monarch-flight-shots); only the flight posture may creep (a beating body)'};
K.define(DEF);
})();
