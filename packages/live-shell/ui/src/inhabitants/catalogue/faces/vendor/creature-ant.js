/* creature-ant.js — the ant (a worker wood ant, Formica): a plan view on six legs, a narrow waist with a petiole node,
   a gaster that lays the trail, elbowed antennae that read it. The trail is the signature: marks are laid into the world
   under the body (creature-ground.js's world group), decay in seconds, and a follower with no mark sweeps for one — the
   mill is the failure the notes name. Built from creature-template-crab.js with SIDEWAYS false, PAIRS 3, and the
   alternating tripod R0 L1 R2 against L0 R1 L2. Read CREATURE-SPEC.md and CREATURE-NOTES-ANT.md with this file. */
(() => {
'use strict';
const SIDEWAYS = false, PAIRS = 3;
const K = window.CreatureKit; K.require('1.1.0', 'creature-ant');
const M = K.model({id:'ant', name:'Ant', sign:'', title:'ANT', sub:'a worker wood ant: the trail is the place',
  w:1000, h:780, pivot:[500, 392], axis:500, ink:K.ROSTER.umber, accent:K.ROSTER.amber, cam:[1, 500, 386]});
const {clamp, keys, env, pulse} = K, pos = v => Math.max(0, v);
const CX = 500, CY = 392;
const P = (a, b) => [CX + a, CY + b];                    // the body frame onto the canvas: a along the body toward the head, b to its right
const bone_ = n => M.bones[M.BI[n]];
function elbow(S, Wr, l1, l2, bend){ const dx = Wr[0] - S[0], dy = Wr[1] - S[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 4), t = Math.atan2(dy, dx) + bend * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)); return [S[0] + l1 * Math.cos(t), S[1] + l1 * Math.sin(t)]; }
const ell = (a, b, rx, ry, n = 12) => Array.from({length:n}, (_, k) => { const t = k * Math.PI * 2 / n; return P(a + rx * Math.cos(t), b + ry * Math.sin(t)); });
const along = (b, u, v) => { const dx = (b.q[0] - b.p[0]) / b.len, dy = (b.q[1] - b.p[1]) / b.len; return [b.p[0] + dx * u - dy * v, b.p[1] + dy * u + dx * v]; };

/* ---------- skeleton: the body in three regions (head, mesosoma, petiole + gaster); mandibles and antennae on the head ---------- */
M.bone('body', null, P(-66, 0), P(86, 0), {grp:'root', lim:[-.25, .25]});                 // the whole figure turns about the model pivot
M.bone('head', 'body', P(86, 0), P(182, 0), {grp:'head', lim:[-.85, .85]});
M.bone('waist', 'body', P(-66, 0), P(-84, 0), {grp:'gaster', lim:[-.6, .6]});
M.bone('gaster', 'waist', P(-84, 0), P(-268, 0), {grp:'gaster', lim:[-.6, .6]});
/* the antenna in the body frame (right side; the left mirrors it): the scape runs out and forward to the elbow, the funiculus turns forward and curves in to the tip. 12 segments in a worker, 1 + 11 */
const ANTP = [[164, 20], [192, 52], [226, 60], [260, 60], [290, 53]];
for(const s of [1, -1]){ const t = s > 0 ? 'R' : 'L';                                   // the mandibles: a blade each, tips converging in front
  M.bone('mand' + t, 'head', P(176, s * 22), P(214, s * 10), {grp:'head', lim:s > 0 ? [-.5, 1.15] : [-1.15, .5], sec:true, speed:16});
  M.bone('ant' + t, 'head', P(...ANTP[0].map((v, k) => k ? s * v : v)), P(...ANTP[1].map((v, k) => k ? s * v : v)), {grp:'feel', lim:[-1.1, 1.1], sec:true, speed:12});       // the scape, long, out and forward
  M.bone('antE' + t, 'ant' + t, P(...ANTP[1].map((v, k) => k ? s * v : v)), P(...ANTP[2].map((v, k) => k ? s * v : v)), {grp:'feel', lim:[-1.3, 1.3], sec:true, speed:14});   // the elbow, the funiculus' first run
  M.bone('antF' + t, 'antE' + t, P(...ANTP[2].map((v, k) => k ? s * v : v)), P(...ANTP[3].map((v, k) => k ? s * v : v)), {grp:'feel', lim:[-1.4, 1.4], sec:true, speed:16});   // the funiculus, forward
  M.bone('antT' + t, 'antF' + t, P(...ANTP[3].map((v, k) => k ? s * v : v)), P(...ANTP[4].map((v, k) => k ? s * v : v)), {grp:'feel', lim:[-1.4, 1.4], sec:true, speed:18});   // and the tip, which curls in
  M.bone('crew' + t, 'body', P(168, s * 116), P(226, s * 116), {grp:'crew', anat:false, speed:6});    // a helper at each flank (a prop bone, hinged at its own thorax; no anatomy view)
}
/* six legs, three IK bones each: hip on the mesosoma, foot splayed to its side, the knee forward on the fore and mid legs, back on the hind */
const LEGS = [], LEGG = [{hip:[62, 27], wr:[128, 112], ft:[152, 140], l:[74, 72], b:1}, {hip:[10, 24], wr:[30, 132], ft:[34, 168], l:[66, 66], b:-1}, {hip:[-42, 26], wr:[-100, 126], ft:[-132, 152], l:[74, 74], b:-1}];   // the hind leg's knee is forward of its line, the front leg's outward: bend = s * b
for(const s of [1, -1]) for(let i = 0; i < PAIRS; i++){
  const G = LEGG[i], tag = (s > 0 ? 'R' : 'L') + i, hip = P(G.hip[0], s * G.hip[1]), wrist = P(G.wr[0], s * G.wr[1]), foot = P(G.ft[0], s * G.ft[1]), bend = s * G.b;
  const E = elbow(hip, wrist, G.l[0], G.l[1], bend), grp = ((i + (s > 0 ? 0 : 1)) & 1) ? 'B' : 'A';
  M.bone('u' + tag, 'body', hip, E, {grp, lim:[-1.4, 1.4]}); M.bone('l' + tag, 'u' + tag, E, wrist, {grp, lim:[-2, 2]}); M.bone('f' + tag, 'l' + tag, wrist, foot, {grp, lim:[-2.2, 2.2]});
  LEGS.push({s, i, tag, grp, bend});
}
for(const L of LEGS) M.leg({bones:['u' + L.tag, 'l' + L.tag, 'f' + L.tag], bend:L.bend, kind:'leg' + L.i, side:L.s > 0 ? 'F' : 'N', grp:L.grp, roll:.55, reach:24});

/* ---------- the figure: mesosoma, head, mandibles, antennae, petiole node, gaster ---------- */
/* the mesosoma is three plates over one cell: the broad pronotum, the narrower mesonotum, the propodeum with the metanotal groove between (the notch a wood ant has) */
const TH = [[86, 5], [84, 16], [76, 25], [62, 30], [46, 31], [32, 27], [18, 23], [4, 22], [-8, 21], [-20, 24], [-36, 27], [-52, 24], [-64, 17], [-72, 9], [-76, 4]];
const thHalf = a => { for(let k = 0; k < TH.length - 1; k++){ const A = TH[k], B = TH[k + 1]; if(a <= A[0] && a >= B[0]) return A[1] + (B[1] - A[1]) * (A[0] - a) / (A[0] - B[0]); } return 4; };
const THORAX = K.chaikin(TH.map(([a, b]) => P(a, b)).concat(TH.slice().reverse().map(([a, b]) => P(a, -b))), 2);
M.zone('mesosoma', THORAX, {layer:6, tier:'L', h:36, bind:{rigid:'body'}, line:'region', tags:['body', 'mesosoma', 'thorax'], tone:.34});
const plate = (a0, a1, ins) => { const xs = Array.from({length:7}, (_, k) => a0 - (a0 - a1) * k / 6); return xs.map(a => P(a, thHalf(a) - ins)).concat(xs.slice().reverse().map(a => P(a, -(thHalf(a) - ins)))); };
for(const [n, a0, a1, tone] of [['pronotum', 82, 42, .36], ['mesonotum', 38, 4, .3], ['propodeum', -14, -70, .3]])
  M.zone(n, plate(a0, a1, 3.5), {layer:6.4, tier:'M', h:18, inset:.5, bind:{rigid:'body'}, line:'feature', tags:['body', 'mesosoma', 'thorax', 'plate'], tone});
const arc = (a, bow, w) => Array.from({length:7}, (_, k) => { const u = k / 6 * 2 - 1; return P(a - bow * (1 - u * u), u * w); });
M.line('promesoSuture', arc(40, 5, thHalf(40) - 4), {layer:6.45, bind:{rigid:'body'}, tags:['mesosoma'], tone:.55});
M.line('metanotalGroove', arc(-11, -4, thHalf(-11) - 3), {layer:6.45, bind:{rigid:'body'}, tags:['mesosoma'], tone:.6});
M.line('dorsalLine', [P(80, 0), P(40, 0), P(4, 0), P(-12, 0), P(-66, 0)], {layer:6.46, bind:{rigid:'body'}, tags:['mesosoma'], tone:.3});
M.shapes('spiracles', [[40, 1], [-56, 1]].flatMap(([a]) => [1, -1].map(s => ell(a, s * (thHalf(a) - 6), 2.2, 1.7, 6))), {layer:6.5, tier:'F', bind:{rigid:'body'}, line:'fine', tags:['body', 'mesosoma'], tone:.85});
for(const L of LEGS){ const hp = bone_('u' + L.tag).p; M.zone('coxa' + L.tag, K.ringPts(hp, 9.5, 8, 0), {layer:6.2, tier:'F', h:8, inset:.4, bind:{rigid:'u' + L.tag}, line:'feature', tags:['body', 'thorax', 'coxa', 'leg' + L.i], tone:.36}); }

const HEAD = K.chaikin([[86, 18], [100, 34], [128, 40], [158, 36], [176, 26], [182, 12], [182, 0], [182, -12], [176, -26], [158, -36], [128, -40], [100, -34], [86, -18]].map(([a, b]) => P(a, b)), 2);
M.zone('head', HEAD, {layer:7, tier:'L', h:30, bind:{rigid:'head'}, line:'region', tags:['head', 'body'], tone:.42});
M.line('vertexLine', arc(100, -6, 28), {layer:7.1, bind:{rigid:'head'}, tags:['head'], tone:.5});
M.line('frontalLine', [P(106, 0), P(134, 0), P(160, 0)], {layer:7.1, bind:{rigid:'head'}, tags:['head'], tone:.3});
for(const s of [1, -1]) M.zone('eye' + (s > 0 ? 'R' : 'L'), K.ellipsePts(P(144, s * 31), 10.5, 7.6, 14, s * -.35), {layer:9, tier:'F', h:5.2, inset:.35, bind:{rigid:'head'}, zone:'eyes', line:'feature', tags:['head', 'eye'], tone:.94});
M.shapes('ocelli', [[[169, 0], [175, 3.4], [175, -3.4]], [[160, 7], [165, 9.4], [163.5, 4.6]], [[160, -7], [165, -9.4], [163.5, -4.6]]].map(t => t.map(([a, b]) => P(a, b))), {layer:9.05, tier:'F', bind:{rigid:'head'}, zone:'eyes', line:'feature', tags:['head', 'ocellus'], tone:.86});
M.shape('clypeus', [[166, 16], [179, 10], [182, 0], [179, -10], [166, -16], [160, 0]].map(([a, b]) => P(a, b)), {layer:8.5, tier:'F', h:9, bind:{rigid:'head'}, line:'feature', tags:['head', 'clypeus'], tone:.3});
M.shape('labrum', [[180, 7], [186, 4], [187, 0], [186, -4], [180, -7], [177, 0]].map(([a, b]) => P(a, b)), {layer:8.55, tier:'F', bind:{rigid:'head'}, zone:'mouth', line:'feature', tags:['head', 'mouth'], tone:.5});

/* the mandibles: a toothed blade each (five teeth on the biting edge, the apical one longest), darker to the tip. Authored in the bone's frame: u along it, w out from the midline. */
const MBLADE = [[-8, 10], [4, 12.5], [18, 12], [32, 9.5], [44, 6], [53, 1.8], [55, -1], [49, -2.6], [45, -1.6], [41, -5.2], [37, -2.6], [33, -5.8], [29, -3.2], [25, -6.2], [21, -3.6], [16, -7], [10, -5.4], [2, -8.5], [-8, -8.5]];
for(const s of [1, -1]){ const t = s > 0 ? 'R' : 'L', b = bone_('mand' + t), ux = (b.q[0] - b.p[0]) / b.len, uy = (b.q[1] - b.p[1]) / b.len, nx = -uy * s, ny = ux * s;
  const bp = ([u, w]) => [b.p[0] + ux * u + nx * w, b.p[1] + uy * u + ny * w];
  M.zone('mandible' + t, MBLADE.map(bp), {layer:8.4, tier:'M', h:9, inset:.4, bind:{rigid:b.name}, zone:'mouth', line:'region', tags:['mandible', 'mandible' + t], tone:(x, y) => clamp(.34 + .6 * Math.pow(Math.max(0, ((x - b.p[0]) * ux + (y - b.p[1]) * uy) / 55), 1.6), 0, .96)});
  M.shape('mandCondyle' + t, K.ringPts(b.p, 6.4, 8, 0), {layer:8.45, tier:'F', bind:{rigid:'head'}, zone:'mouth', line:'feature', tags:['mandible', 'mandible' + t], tone:.5});
}
/* the antennae: a socket in the head, the scape, the elbow, the funiculus in three runs (eleven segments, ticked) to the tip */
for(const s of [1, -1]){ const t = s > 0 ? 'R' : 'L';
  M.zone('antSocket' + t, K.ringPts(P(ANTP[0][0], s * ANTP[0][1]), 6.6, 8, 0), {layer:8.62, tier:'F', h:6, inset:.4, bind:{rigid:'head'}, zone:'feel', line:'feature', tags:['antenna', 'antenna' + t], tone:.55});
  for(const [nm, w0, w1] of [['ant', 3.6, 3.3], ['antE', 3.0, 2.9], ['antF', 2.9, 2.8], ['antT', 2.8, 2.0]]){ const b = bone_(nm + t);
    M.limb(nm + t, [[b.p[0], b.p[1], w0, w0], [(b.p[0] + b.q[0]) / 2, (b.p[1] + b.q[1]) / 2, (w0 + w1) / 2, (w0 + w1) / 2], [b.q[0], b.q[1], w1, w1]], {layer:8.6, tier:'F', h:9, bind:{rigid:b.name}, zone:'feel', line:'feature', tags:['antenna', 'antenna' + t], tone:.52});
    const ticks = nm === 'ant' ? [] : nm === 'antT' ? [.3, .62, .92] : [.18, .42, .66, .9], ux = (b.q[0] - b.p[0]) / b.len, uy = (b.q[1] - b.p[1]) / b.len;
    if(ticks.length) M.shapes(nm + 'Seg' + t, ticks.map(f => { const x = b.p[0] + (b.q[0] - b.p[0]) * f, y = b.p[1] + (b.q[1] - b.p[1]) * f, hw = (w0 + (w1 - w0) * f) * 1.35; return [[x - ux * .9 - uy * hw, y - uy * .9 + ux * hw], [x + ux * .9 - uy * hw, y + uy * .9 + ux * hw], [x + ux * .9 + uy * hw, y + uy * .9 - ux * hw], [x - ux * .9 + uy * hw, y - uy * .9 - ux * hw]]; }), {layer:8.66, tier:'F', bind:{rigid:b.name}, zone:'feel', line:'feature', tags:['antenna', 'antenna' + t], tone:.78});
  }
  const e = bone_('ant' + t).q; M.shape('antElbow' + t, K.ringPts(e, 4.6, 8, 0), {layer:8.64, tier:'F', bind:{mix:[['ant' + t, .5], ['antE' + t, .5]]}, zone:'feel', line:'feature', tags:['antenna', 'antenna' + t], tone:.62});
}
M.zone('petiole', K.chaikin([[-88, 0], [-82, 12], [-70, 14], [-60, 8], [-58, 0], [-60, -8], [-70, -14], [-82, -12]].map(([a, b]) => P(a, b)), 1), {layer:7.2, tier:'M', h:14, bind:{rigid:'waist'}, line:'region', tags:['waist', 'petiole'], tone:.4});
const GASTER = K.chaikin([[-84, 18], [-96, 34], [-116, 48], [-146, 54], [-178, 54], [-210, 46], [-238, 32], [-256, 16], [-264, 4], [-266, 0], [-264, -4], [-256, -16], [-238, -32], [-210, -46], [-178, -54], [-146, -54], [-116, -48], [-96, -34], [-84, -18]].map(([a, b]) => P(a, b)), 2);
M.zone('gaster', GASTER, {layer:6.5, tier:'L', h:38, bind:{rigid:'gaster'}, line:'region', tags:['gaster', 'body'], tone:.4});
for(const [k, a0, a1] of [[1, -108, -118], [2, -144, -154], [3, -180, -190], [4, -214, -222]]) M.line('gasterBand' + k, [P(a0, 46 - k * 3), P(a0 - (a0 - a1) * .45 * 0 - 4, 22), P(a1, 0), P(a0 - 4, -22), P(a0, -46 + k * 3)], {layer:6.55, bind:{rigid:'gaster'}, tags:['gaster'], tone:.55});   // the tergites' hind margins, bowed backward
M.line('gasterRidge', [P(-96, 0), P(-160, 2), P(-230, 0)], {layer:6.56, bind:{rigid:'gaster'}, tags:['gaster'], tone:.32});
M.shape('acidopore', ell(-259, 0, 5.4, 4.6, 10), {layer:6.6, tier:'F', h:6, bind:{rigid:'gaster'}, line:'feature', tags:['gaster', 'acidopore'], tone:.9});
M.shapes('rayFringe', Array.from({length:8}, (_, k) => { const th = Math.PI * (.62 + .76 * k / 7), c = Math.cos(th), sn = Math.sin(th); return [[-259 + c * 5, sn * 5 - 1.2], [-259 + c * 5, sn * 5 + 1.2], [-259 + c * 11, sn * 11]].map(([a, b]) => P(a, b)); }), {layer:6.62, tier:'F', bind:{rigid:'gaster'}, line:'fine', tags:['gaster', 'acidopore'], tone:.7});

/* the six legs: coxa, then femur, tibia and tarsus (the IK's three bones), a knee patch at the joint, a ticked tarsus, two claws */
for(const L of LEGS){ const u = bone_('u' + L.tag), l = bone_('l' + L.tag), f = bone_('f' + L.tag);
  const mk = (b, w0, w1, nm) => M.limb(nm + L.tag, [[b.p[0], b.p[1], w0, w0], [(b.p[0] + b.q[0]) / 2, (b.p[1] + b.q[1]) / 2, (w0 + w1) / 2, (w0 + w1) / 2], [b.q[0], b.q[1], w1, w1]], {layer:5, tier:'M', h:14, bind:{rigid:b.name}, line:'region', tags:['leg', 'leg' + L.i], tone:.3});
  mk(u, 10, 8, 'femur'); mk(l, 7, 5.2, 'tibia'); mk(f, 4.4, 2.2, 'tarsus');
  M.zone('knee' + L.tag, K.ringPts(l.p, 10, 7.4, 0), {layer:5.05, tier:'F', h:9, inset:.4, bind:{mix:[[u.name, .5], [l.name, .5]]}, line:'feature', tags:['leg', 'leg' + L.i], tone:.42});
  const ux = (f.q[0] - f.p[0]) / f.len, uy = (f.q[1] - f.p[1]) / f.len, nx = -uy, ny = ux, q = f.q;
  M.shapes('tarsalSeg' + L.tag, [.28, .5, .72].map(g => { const x = f.p[0] + (f.q[0] - f.p[0]) * g, y = f.p[1] + (f.q[1] - f.p[1]) * g, hw = 4.2 - 2 * g; return [[x - ux * .9 - nx * hw, y - uy * .9 - ny * hw], [x + ux * .9 - nx * hw, y + uy * .9 - ny * hw], [x + ux * .9 + nx * hw, y + uy * .9 + ny * hw], [x - ux * .9 + nx * hw, y - uy * .9 + ny * hw]]; }), {layer:5.04, tier:'F', bind:{rigid:f.name}, line:'feature', tags:['leg', 'leg' + L.i], tone:.7});
  M.shapes('tarsalClaw' + L.tag, [[[q[0] - ux * 7 + nx * 2.4, q[1] - uy * 7 + ny * 2.4], [q[0] + ux * 3 + nx * 4.4, q[1] + uy * 3 + ny * 4.4], [q[0] + ux * 7, q[1] + uy * 7]], [[q[0] - ux * 7 - nx * 2.4, q[1] - uy * 7 - ny * 2.4], [q[0] + ux * 3 - nx * 4.4, q[1] + uy * 3 - ny * 4.4], [q[0] + ux * 7, q[1] + uy * 7]]], {layer:5.06, tier:'F', h:6, bind:{rigid:f.name}, zone:'paws', line:'feature', tags:['leg', 'leg' + L.i, 'claw'], tone:.85});
}

/* ---------- what the ant carries and who helps: crumb, seed, larva, corpse, scent bead, two helper silhouettes ---------- */
M.shapes('crumb', [[[236, -8], [244, -14], [254, -8], [257, 2], [250, 10], [239, 8], [233, 1]], [[258, -9], [264, -12], [268, -6], [263, -1]]].map(t => t.map(([a, b]) => P(234 + (a - 234) * 1.4, b * 1.4))), {layer:9.2, tier:'M', h:8, bind:{rigid:'head'}, zone:'load', line:'feature', tone:.82, show:'carryShow', tags:['crumb', 'load']});
M.zone('seed', K.chaikin([[238, -26], [260, -38], [292, -40], [318, -28], [326, 0], [318, 28], [292, 40], [260, 38], [238, 26], [232, 0]].map(([a, b]) => P(a, b)), 1), {layer:9.2, tier:'M', h:16, bind:{rigid:'head'}, zone:'load', line:'region', tone:.7, show:'bigShow', tags:['seed', 'load']});
M.line('seedRidge', [P(244, 0), P(284, 0), P(320, 0)], {layer:9.25, bind:{rigid:'head'}, show:'bigShow', tags:['seed', 'load'], tone:.4});
const LARVA = [[248, -56, 4.5], [240, -42, 8], [235, -24, 10], [233, -4, 10.5], [235, 16, 10.5], [240, 34, 9], [248, 50, 6.5], [256, 60, 4]];   // a grub, curled across the front of the head: the station (a, b) and its half width
M.limb('larva', LARVA.map(([a, b, w]) => P(a, b).concat([w, w])), {layer:5.2, tier:'M', h:11, bind:{rigid:'body'}, zone:'load', line:'region', show:'tendShow', tags:['larva', 'load'], tone:.36});
M.shape('larvaHead', ell(262, 66, 5.4, 4.6, 9), {layer:5.22, tier:'F', h:7, bind:{rigid:'body'}, zone:'load', line:'feature', show:'tendShow', tags:['larva', 'load'], tone:.55});
M.shapes('larvaSeg', LARVA.slice(1, 7).map(([a, b, w], k) => { const q = LARVA[k], r = LARVA[k + 2], tx = r[0] - q[0], ty = r[1] - q[1], tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl; return [[a - tx / tl * .9 - nx * w, b - ty / tl * .9 - ny * w], [a + tx / tl * .9 - nx * w, b + ty / tl * .9 - ny * w], [a + tx / tl * .9 + nx * w, b + ty / tl * .9 + ny * w], [a - tx / tl * .9 + nx * w, b - ty / tl * .9 + ny * w]].map(([x, y]) => P(x, y)); }), {layer:5.21, tier:'F', bind:{rigid:'body'}, zone:'load', line:'feature', show:'tendShow', tags:['larva', 'load'], tone:.66});
M.zone('corpseGaster', ell(256, 4, 22, 15, 12), {layer:9, tier:'M', h:13, bind:{rigid:'head'}, zone:'load', line:'region', show:'deadShow', tags:['corpse', 'load'], tone:.55});
M.zone('corpseThorax', ell(289, 2, 16, 11, 12), {layer:9, tier:'M', h:12, bind:{rigid:'head'}, zone:'load', line:'region', show:'deadShow', tags:['corpse', 'load'], tone:.6});
M.zone('corpseHead', ell(317, 0, 12, 9, 12), {layer:9, tier:'M', h:11, bind:{rigid:'head'}, zone:'load', line:'region', show:'deadShow', tags:['corpse', 'load'], tone:.65});
for(const [k, pts] of [[1, [[248, 16], [240, 28], [234, 36]]], [2, [[268, 18], [268, 30], [262, 38]]], [3, [[290, 12], [298, 22], [302, 30]]], [4, [[250, -8], [242, -20], [238, -28]]]] )
  M.line('corpseLeg' + k, pts.map(([a, b]) => P(a, b)), {layer:9.05, bind:{rigid:'head'}, show:'deadShow', tags:['corpse', 'load'], tone:.6});
M.shape('scent', [[-268, 0], [-264, 3.4], [-258, 2.6], [-254, 0], [-258, -2.6], [-264, -3.4]].map(([a, b]) => P(a, b)), {layer:6.7, tier:'F', h:6, bind:{rigid:'gaster'}, line:'feature', show:'layShow', tags:['scent'], tone:.55});
/* the helpers: one worker either side, hinged at its own thorax (the bone crewR / crewL), drawn dim and at about 0.8 of the ant's own length (they are props: dim, below the legs). They stand for the nestmates a recruit alerts and
   a group carry needs. A helper is authored in its own frame (u along it, v across) and put on the body at (CA, CB). */
const CA = 168, CB = 116, CK = 1.7;
for(const s of [1, -1]){ const t = s > 0 ? 'R' : 'L', on = 'crewShow' + t, tg = ['crew', 'crew' + t], H = (u, v) => P(CA + u * CK, s * (CB + v * CK)), Hell = (u, rx, ry) => ell(CA + u * CK, s * CB, rx * CK, ry * CK, 12);
  M.zone('crewGaster' + t, Hell(-44, 30, 19), {layer:4, tier:'F', h:17, bind:{rigid:'crew' + t}, zone:'crew', line:'region', show:on, dim:true, tags:tg, tone:.3});
  M.zone('crewThorax' + t, Hell(0, 24, 15), {layer:4, tier:'F', h:15, bind:{rigid:'crew' + t}, zone:'crew', line:'region', show:on, dim:true, tags:tg, tone:.32});
  M.zone('crewHead' + t, Hell(34, 14, 11), {layer:4, tier:'F', h:12, bind:{rigid:'crew' + t}, zone:'crew', line:'region', show:on, dim:true, tags:tg, tone:.36});
  for(const [k, q] of [[1, [[40, 6], [58, 20], [76, 28]]], [2, [[40, -6], [58, -20], [76, -28]]]]) M.line('crewAntenna' + t + k, q.map(([u, v]) => H(u, v)), {layer:4.05, bind:{rigid:'crew' + t}, show:on, dim:true, tags:tg, tone:.4});
  for(const [k, q] of [[1, [[6, 12], [18, 34], [8, 50]]], [2, [[-4, 12], [-12, 36], [-26, 48]]], [3, [[6, -12], [18, -34], [8, -50]]], [4, [[-4, -12], [-12, -36], [-26, -48]]], [5, [[-10, 12], [-30, 32], [-48, 42]]], [6, [[-10, -12], [-30, -32], [-48, -42]]]]) M.line('crewLeg' + t + k, q.map(([u, v]) => H(u, v)), {layer:4.05, bind:{rigid:'crew' + t}, show:on, dim:true, tags:tg, tone:.4});
}

/* ---------- muscles ----------
   Real names, and each turns the joint it really turns. The head's, the mandibles' and the antennae's are single muscles of the head capsule (an ant's closer fills the head; its opener is small).
   The legs read theirs from the IK's solved angles: the coxal promotor and remotor swing the leg at the thorax, the extensor and flexor tibiae fold the knee (they lie in the femur), the
   levator and depressor of the tarsus tilt the foot. NOTE: the model's `axis` is vertical (x = 500) and this body's symmetry is horizontal, so no muscle here is a `pair:'LR'`; the two sides are
   written out, each the mirror of the other by its sign `s`. */
const glow = (c, rx, ry, a = .4) => K.glow(c[0], c[1], rx, ry, a), cr = (cx, cy, rx, ry, ang, f, amp = .5, lo = .78, hi = .95) => K.crease(cx, cy, rx, ry, ang, f, amp, lo, hi);
const mu = (id, d) => M.muscle(id, d);
const SG = {R:1, L:-1}, SD = ['R', 'L'];
mu('breath', {name:'the breath (the gaster pumps)', g:'body', c:P(-170, 0), r:[70, 48], pull:[-.022, -.022], on:['gaster'], hue:'#8fd0a8', speed:5, host:'gaster', shade:glow(P(-170, 0), 60, 40, .22)});
mu('gasterCurl', {name:'flexor of the gaster (curls it under: it shortens, and the tip comes to the ground)', g:'body', c:P(-170, 0), r:[84, 52], on:['gaster'], hue:'#d8c89a', speed:7, host:'gaster', shade:glow(P(-170, 0), 70, 44, .3)});
mu('gasterSwingL', {name:'lateral muscle of the gaster (swings it to the left)', g:'body', c:P(-120, 0), r:[44, 36], on:['gaster', 'waist'], jt:[['waist', .3], ['gaster', .2]], hue:'#9aa6d8', speed:7, host:'gaster', shade:glow(P(-120, 0), 40, 30, .3)});
mu('gasterSwingR', {name:'lateral muscle of the gaster (swings it to the right)', g:'body', c:P(-120, 0), r:[44, 36], on:['gaster', 'waist'], jt:[['waist', -.3], ['gaster', -.2]], hue:'#e3806f', speed:7, host:'gaster', shade:glow(P(-120, 0), 40, 30, .3)});
mu('headTurnR', {name:'head turner (to the right)', g:'head', c:P(120, 0), r:[40, 34], on:['head'], jt:[['head', .62]], hue:'#e3806f', speed:9, host:'head', shade:glow(P(120, 0), 36, 30, .32)});
mu('headTurnL', {name:'head turner (to the left)', g:'head', c:P(120, 0), r:[40, 34], on:['head'], jt:[['head', -.62]], hue:'#9aa6d8', speed:9, host:'head', shade:glow(P(120, 0), 36, 30, .32)});
mu('headRaise', {name:'levator of the head (lifts it nearer the eye)', g:'head', c:P(130, 0), r:[44, 36], on:['head'], hue:'#7ec3e6', speed:7, host:'head', shade:glow(P(130, 0), 38, 30, .26)});
mu('headLower', {name:'depressor of the head (lowers it)', g:'head', c:P(130, 0), r:[44, 36], on:['head'], hue:'#d8c89a', speed:7, host:'head', shade:glow(P(130, 0), 38, 30, .26)});
mu('trunk', {name:'mesosomal flight-muscle block (sets the whole body rocking)', g:'body', c:P(10, 0), r:[60, 40], on:['mesosoma'], jt:[['body', .05]], hue:'#9aa6d8', speed:6, host:'body', shade:glow(P(10, 0), 52, 34, .2)});
for(const t of SD){ const s = SG[t], mb = bone_('mand' + t), mc = [(mb.p[0] + mb.q[0]) / 2, (mb.p[1] + mb.q[1]) / 2], hc = P(138, s * 14);
  mu('mandOpen' + t, {name:'abductor of the ' + (s > 0 ? 'right' : 'left') + ' mandible (small: it opens the blade)', g:'mouth', c:mc, r:[22, 18], on:['mandible', 'mandible' + t], jt:[['mand' + t, s * .95]], hue:'#7ec3e6', speed:16, host:'mand' + t, shade:glow(mc, 18, 14, .4)});
  mu('mandClose' + t, {name:'adductor of the ' + (s > 0 ? 'right' : 'left') + ' mandible (huge: it fills the head)', g:'mouth', c:hc, r:[40, 30], on:['head', 'mandible' + t], jt:[['mand' + t, -s * .36]], hue:'#e0523f', speed:22, host:'mand' + t, shade:K.both(cr(hc[0], hc[1], 34, 26, 1.2, .16, .6), glow(hc, 34, 26, .5))});
  const sc = bone_('ant' + t), sm = [(sc.p[0] + sc.q[0]) / 2, (sc.p[1] + sc.q[1]) / 2], fc = bone_('antF' + t).p;
  mu('scapeAbd' + t, {name:'abductor of the ' + (s > 0 ? 'right' : 'left') + ' scape (sweeps the antenna out)', g:'feelers', c:sm, r:[26, 26], on:['antenna' + t], jt:[['ant' + t, s * .55]], hue:'#d8c89a', speed:11, host:'ant' + t, shade:glow(sm, 22, 22, .4)});
  mu('scapeAdd' + t, {name:'adductor of the ' + (s > 0 ? 'right' : 'left') + ' scape (draws it in)', g:'feelers', c:sm, r:[26, 26], on:['antenna' + t], jt:[['ant' + t, -s * .55]], hue:'#8fb0a0', speed:11, host:'ant' + t, shade:glow(sm, 22, 22, .4)});
  mu('pedFlex' + t, {name:'flexor of the pedicel (curls the ' + (s > 0 ? 'right' : 'left') + ' funiculus in)', g:'feelers', c:fc, r:[30, 22], on:['antenna' + t], jt:[['antE' + t, -s * .42], ['antF' + t, -s * .5], ['antT' + t, -s * .62]], hue:'#c9a0dc', speed:13, host:'antE' + t, shade:glow(fc, 24, 18, .4)});
  mu('pedExt' + t, {name:'extensor of the pedicel (straightens the ' + (s > 0 ? 'right' : 'left') + ' funiculus)', g:'feelers', c:fc, r:[30, 22], on:['antenna' + t], jt:[['antE' + t, s * .3], ['antF' + t, s * .35], ['antT' + t, s * .4]], hue:'#5cc6b4', speed:13, host:'antE' + t, shade:glow(fc, 24, 18, .35)});
}
/* the legs: promotor and remotor at the coxa, extensor and flexor tibiae at the knee, levator and depressor of the tarsus */
const LEGNAME = ['fore', 'mid', 'hind'];
for(const L of LEGS){
  const {s, i, tag, bend} = L, u = 'u' + tag, l = 'l' + tag, f = 'f' + tag, nm = (s > 0 ? 'right ' : 'left ') + LEGNAME[i] + ' leg', g = 'leg ' + (i + 1) + (s > 0 ? ' right' : ' left'), on = ['leg' + i];
  const hc = bone_(u).p, kc = bone_(l).p, mid = [(bone_(l).p[0] + bone_(l).q[0]) / 2, (bone_(l).p[1] + bone_(l).q[1]) / 2], tc = bone_(f).p;
  const m = (id, name, c, r, hue, jt, shade) => mu(id + tag, {name, g, c, r, hue, speed:11, on, jt, host:jt[0][0], shade});
  m('prom', 'coxal promotor of the ' + nm + ' (swings it forward)', hc, [20, 20], '#7ec3e6', [[u, -.5 * s, 'r']], glow(hc, 16, 16, .45));
  m('rem', 'coxal remotor of the ' + nm + ' (swings it back)', hc, [20, 20], '#e3806f', [[u, .5 * s, 'r']], glow(hc, 16, 16, .45));
  m('flex', 'flexor tibiae of the ' + nm + ' (folds the knee)', kc, [20, 20], '#d8c89a', [[l, -bend * .75, 'r']], K.both(cr(kc[0], kc[1], 15, 15, 0, .2, .5), glow(kc, 15, 15, .45)));
  m('ext', 'extensor tibiae of the ' + nm + ' (straightens the knee)', mid, [22, 22], '#9aa6d8', [[l, bend * .75, 'r']], glow(mid, 14, 14, .38));
  m('depT', 'depressor of the tarsus of the ' + nm, tc, [14, 14], '#c9a0dc', [[f, .5, 'r']], glow(tc, 10, 10, .45));
  m('levT', 'levator of the tarsus of the ' + nm, tc, [14, 14], '#5cc6b4', [[f, -.5, 'r']], glow(tc, 10, 10, .45));
}
for(const L of LEGS){ const lg = M.legs[LEGS.indexOf(L)], id = b => b + L.tag; lg.mus = [L.s > 0 ? [id('prom'), id('rem'), -.34, .34] : [id('rem'), id('prom'), -.34, .34], L.bend > 0 ? [id('flex'), id('ext'), -.9, .9] : [id('ext'), id('flex'), -.9, .9], [id('depT'), id('levT'), -.6, .6]]; }
/* what is carried and who helps: each is shown by a muscle of its own, so a prop is a thing the body does (the load held in the jaws, the larva licked, the helpers alerted) */
mu('carryShow', {name:'the crumb (held in the jaws)', g:'props', c:P(250, 0), r:[26, 20], on:['crumb'], hue:'#d4a03c', speed:8, host:'head', shade:glow(P(250, 0), 20, 16, .25)});
mu('bigShow', {name:'the seed (held with the helpers)', g:'props', c:P(280, 0), r:[40, 40], on:['seed'], hue:'#d4a03c', speed:8, host:'head', shade:glow(P(280, 0), 30, 30, .22)});
mu('deadShow', {name:'the dead nestmate (carried out)', g:'props', c:P(285, 0), r:[50, 22], on:['corpse'], hue:'#8a8a98', speed:8, host:'head', shade:glow(P(285, 0), 40, 18, .2)});
mu('tendShow', {name:'the larva (licked and fed)', g:'props', c:P(240, 4), r:[30, 64], on:['larva'], hue:'#e3a0a6', speed:8, host:'body', shade:glow(P(240, 4), 22, 50, .25)});
mu('layShow', {name:'the scent bead (at the acidopore)', g:'props', c:P(-262, 0), r:[10, 8], on:['scent'], hue:'#d4a03c', speed:12, host:'gaster', shade:glow(P(-262, 0), 8, 6, .5)});
for(const t of SD){ const s = SG[t], cb = bone_('crew' + t).p;
  mu('crewShow' + t, {name:'the ' + (s > 0 ? 'right' : 'left') + ' helper (a nestmate alerted)', g:'crew', c:P(168, s * 116), r:[110, 44], on:['crew' + t], hue:'#a8b0c0', speed:7, host:'crew' + t, shade:glow(P(168, s * 116), 80, 34, .16)});
  mu('crewTurn' + t, {name:'the ' + (s > 0 ? 'right' : 'left') + ' helper turns to follow', g:'crew', c:P(168, s * 116), r:[100, 44], on:['crew' + t], jt:[['crew' + t, -s * 1.15]], hue:'#c9a0dc', speed:6, host:'crew' + t});
  mu('crewBack' + t, {name:'the ' + (s > 0 ? 'right' : 'left') + ' helper falls in behind', g:'crew', c:P(168, s * 116), r:[100, 44], on:['crew' + t], jt:[['crew' + t, -300, 'x']], hue:'#7ec3e6', speed:5, host:'crew' + t});
  mu('crewIn' + t, {name:'the ' + (s > 0 ? 'right' : 'left') + ' helper closes on the load', g:'crew', c:P(168, s * 116), r:[100, 44], on:['crew' + t], jt:[['crew' + t, -s * 54, 'y'], ['crew' + t, 96, 'x']], hue:'#5cc6b4', speed:5, host:'crew' + t});
}

/* ---------- postures ----------
   Seen from above, "low" is the legs drawn in and the head and gaster brought down; "carry" the jaws closed on a load with the antennae drawn in; "tend" the head turned to a larva at its side; "climb" the forelegs
   reaching ahead onto a stem and the head raised nearer the eye. A foot is placed by how far out it is (`r`, a share of the rest reach from the hip) and a shift. The first posture is where it starts. */
const foot = (L, r = 1, da = 0, db = 0) => { const h = bone_('u' + L.tag).p, w = bone_('f' + L.tag).p, q = bone_('f' + L.tag).q, t = [w[0] - h[0], w[1] - h[1]]; return [h[0] + t[0] * r + (q[0] - w[0]) + da, h[1] + t[1] * r + (q[1] - w[1]) + db, Math.atan2(q[1] - w[1], q[0] - w[0])]; };
const feet = (r = 1, fn) => LEGS.map(L => { const x = fn ? fn(L) : null; return foot(L, x && x.r || r, x && x.da || 0, x && x.db || 0); });
M.posture('stand', {feet:feet(1)});
M.posture('low', {feet:feet(.84)});
M.posture('carry', {feet:feet(.96, L => L.i === 0 ? {r:.92, da:-6, db:-L.s * 10} : null)});
M.posture('tend', {feet:feet(.94, L => L.i === 0 ? {r:.9, da:-4, db:-L.s * 6} : null), jt:{head:.1}});
M.posture('climb', {feet:feet(1, L => L.i === 0 ? {r:1, da:56, db:-L.s * 78} : L.i === 1 ? {r:1, da:22, db:-L.s * 16} : null)});
const LIFTS = LEGS.map(L => L.s * 13), TRI_A = [0, 4, 2], TRI_B = [3, 1, 5];     // the legs in the engine's order R0 R1 R2 L0 L1 L2: tripod A = R0 L1 R2, B = L0 R1 L2
const liftB = (list, d0, len, amt) => list.map(k => ['f' + k + 'y', d0, len, Math.sign(LIFTS[k]) * amt]);
const stepBumps = (t0, len, gap, amt) => liftB(TRI_A, t0, len, amt).concat(liftB(TRI_B, t0 + gap, len, amt));
M.edge('stand>low', {ms:1700, g:{root:[0, 1000], head:[200, 1100], gaster:[350, 1100], feel:[300, 1100], A:[0, 1200], B:[250, 1200]}, bumps:stepBumps(0, 700, 250, 7)});
M.edge('stand>carry', {ms:1900, g:{head:[0, 1100], feel:[100, 1100], gaster:[300, 1200], A:[0, 1300], B:[300, 1300]}, bumps:stepBumps(0, 700, 300, 7)});
M.edge('stand>tend', {ms:2100, g:{A:[0, 1300], B:[250, 1300], head:[500, 1300], feel:[300, 1300]}, bumps:stepBumps(0, 700, 250, 7)});
M.edge('stand>climb', {ms:2300, g:{root:[0, 1400], A:[0, 1500], B:[300, 1500], head:[500, 1300], feel:[300, 1300]}, bumps:stepBumps(0, 800, 300, 9)});
M.edge('carry>tend', {ms:1900, g:{head:[0, 1200], feel:[200, 1000], A:[0, 1300], B:[250, 1300]}, bumps:stepBumps(0, 700, 250, 6)});
M.edge('low>carry', {ms:1900, g:{A:[0, 1300], B:[300, 1300], head:[200, 1200], feel:[300, 1200], gaster:[400, 1200]}, bumps:stepBumps(0, 700, 300, 6)});
M.edge('low>tend', {ms:2000, g:{A:[0, 1300], B:[300, 1300], head:[300, 1300]}, bumps:stepBumps(0, 700, 300, 6)});

/* ---------- gaits ----------
   An ant walks on the alternating tripod: R0 L1 R2 (the fore leg and hind leg of one side with the middle leg of the other) stand while L0 R1 L2 swing, a half cycle apart, at a duty of 0.5 to 0.6. A forward
   walker's legs all push, so every foot trails (the ground's `trailing`). `off` is the landing phase and a LARGER value lands EARLIER, so inside a tripod the fore leg lands first. The kit's stride is short
   against a real ant's, which takes about ten steps a second: the figure's cycle is slower (the reading is the footfall order, not the rate). */
const N6 = 6, arr = f => LEGS.map(f), ZERO6 = new Array(N6).fill(0);
const OFF = () => arr(L => (((L.i + (L.s > 0 ? 0 : 1)) & 1) ? .5 : 0) + .02 * (PAIRS - 1 - L.i)), LIFT = arr(L => L.s * 13), FLEX = arr(L => L.s * .4);
M.gait('shuffle', {psi:0, base:'stand', label:'Shuffle', L:0, cyc:640, duty:.6, lift:LIFT, off:OFF(), flex:FLEX, hs:ZERO6, bob:1, cap:1.8, lead:0});
M.gait('creep', {psi:.5, base:'stand', label:'Creep', L:36, cyc:700, duty:.62, lift:LIFT, off:OFF(), flex:FLEX, hs:ZERO6, bob:1.1, cap:1.8, lead:0});
M.gait('carryWalk', {psi:.8, base:'stand', label:'Carry-walk', L:56, cyc:600, duty:.62, lift:LIFT.map(v => v * .8), off:OFF(), flex:FLEX, hs:ZERO6, bob:1.2, cap:1.8, lead:0});
M.gait('walk', {psi:1, base:'stand', label:'Walk', L:72, cyc:560, duty:.58, lift:LIFT, off:OFF(), flex:FLEX, hs:ZERO6, bob:1.6, cap:1.8, lead:0});
M.gait('run', {psi:2, base:'stand', label:'Run', L:90, cyc:380, duty:.5, lift:LIFT.map(v => v * 1.15), off:OFF(), flex:FLEX.map(v => v * 1.2), hs:ZERO6, bob:2.6, cap:1.6, lead:0});

/* ---------- the world under the ant: creature-ground.js's ground, and the trail laid into it ----------
   The ant stays upright on the page and the camera follows it; the world moves and turns about it, so a mark laid at the acidopore stays where it was laid. `world(c)` is the ant's own state on the
   svg (it survives c.reset, and is rebuilt when the clock runs backwards). */
const SVGNS = 'http://www.w3.org/2000/svg', mkEl = (tag, a = {}) => { const e = document.createElementNS(SVGNS, tag); for(const k in a) e.setAttribute(k, a[k]); return e; };
const groundOf = c => { if(!window.CreatureGround || !c.svg) return null; if(!c.svg.__cg) c.svg.__cg = CreatureGround.make(c, {pivot:[CX, CY], crest:1.25, seed:41, light:-2.3}); const g = c.svg.__cg; g.colour(c.C); return g; };
const f1 = v => Math.round(v * 10) / 10;
/* the landmarks are fixed points of the world, in the units of the page: the entrance of the nest (the boundary: `LIP` is the lip where a load is handed over), the field with its heap of crumbs (the forage), a heavy
   seed that one ant cannot carry, and the midden where the dead are put. The floor between them is where the trail is. Nothing here moves by itself: each change is something an action did. */
const NEST = [-560, 20], LIP = [NEST[0] + 66, NEST[1] + 8], FOOD = [520, -60], BIG = [560, 150], MIDDEN = [-60, 450], MARK_N = 150, PILE_MAX = 5, FOOD0 = 9;
const hexOf = n => CreatureGround.hex(n), mixI = (a, b, t) => CreatureGround.mixInt(a, b, t);
const ptsD = (pts, close = true) => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + (close ? 'Z' : '');
const blob = (x, y, r, k, n = 9) => ptsD(Array.from({length:n}, (_, i) => { const a = i * 2 * Math.PI / n, rr = r * (.8 + .24 * Math.abs(Math.sin(k * 7.3 + i * 2.1))); return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; }));
const ellW = (x, y, rx, ry, ang, n = 10) => Array.from({length:n}, (_, i) => { const t = i * 2 * Math.PI / n, u = Math.cos(t) * rx, v = Math.sin(t) * ry; return [x + u * Math.cos(ang) - v * Math.sin(ang), y + u * Math.sin(ang) + v * Math.cos(ang)]; });
/* a small ant lying in the world (a dead nestmate): its three ellipses as one path, its six legs curled as another */
function antD(x, y, ang, sc){
  const ca = Math.cos(ang), sa = Math.sin(ang), at = (u, v) => [x + (u * ca - v * sa) * sc, y + (u * sa + v * ca) * sc]; let body = '', legs = '';
  for(const [u, rx, ry] of [[-26, 20, 14], [6, 15, 9.5], [29, 11.5, 8.5]]){ const q = at(u, 0); body += ptsD(ellW(q[0], q[1], rx * sc, ry * sc, ang, 10)); }
  for(const [u, d1, d2] of [[16, 10, 18], [6, 2, 16], [-4, -10, 14]]) for(const s of [1, -1]) legs += ptsD([at(u, s * 6), at(u + d1, s * 22), at(u + d2, s * 30)], false);
  return {body, legs};
}
function worldInit(c, st){
  const g = groundOf(c); if(!g) return st;
  g.clear(); st.g = g; st.last = c.t; st.turn = 0; st.home = 0;
  /* in a crew (creature-crew.js) the world is the crew's: this group goes into the shared habitat in world coordinates (no transform of its own; the habitat's camera places it), the nest, the food and the midden are the
     scene's (the loads, the pile and the dead are the crew's objects), and the trail is ONE pool of marks in the habitat that every ant lays into and reads from (crew.antw is the scene's shared record). Its own page is unchanged. */
  const crew = c.crew, W = crew ? (crew.crew.antw || (crew.crew.antw = {})) : null; st.crew = !!crew; st.W = W;
  if(!st.grp){ st.grp = mkEl('g', {class:'an-world', 'pointer-events':'none'}); if(crew) crew.habitat.under.appendChild(st.grp); else c.svg.insertBefore(st.grp, c.rig); st.fx = mkEl('g', {class:'an-fx', 'pointer-events':'none'}); if(c.anat) c.svg.insertBefore(st.fx, c.anat); else c.svg.append(st.fx); }
  st.grp.textContent = ''; st.fx.textContent = '';
  const p = st.p = {}; for(const k of ['nestS', 'nest', 'rings', 'hole', 'foodS', 'food', 'midS', 'mid', 'midLegs', 'midDead', 'pileS', 'pile', 'bigS', 'big', 'deadS', 'deadLegs', 'dead']) st.grp.append(p[k] = mkEl('path'));
  const newMark = parent => { const e = mkEl('path', {fill:'none', 'stroke-width':W && W.markW || 4.6, 'stroke-linecap':'round'}); e.style.display = 'none'; parent.append(e); return {e, wx:0, wy:0, ang:0, t0:-1e9, s0:1, life:1, id:0, q:-1}; };
  if(W){ if(!W.marks){ W.trailG = W.trailG || mkEl('g', {class:'an-trail', 'pointer-events':'none'}); if(!W.trailG.parentNode) crew.habitat.under.appendChild(W.trailG); W.marks = Array.from({length:W.markN || 700}, () => newMark(W.trailG)); W.mi = 0; W.seq = 0; } st.trailG = W.trailG; st.marks = W.marks; }
  else { st.trailG = mkEl('g'); st.grp.append(st.trailG); st.marks = Array.from({length:MARK_N}, () => newMark(st.trailG)); }
  st.mi = 0; st.seq = 0; st.food = FOOD0; st.pile = []; st.dead = null; st.midden = []; st.big = {x:BIG[0], y:BIG[1], on:true, back:0}; st.foodBack = [];
  st.parts = Array.from({length:18}, () => { const e = mkEl('circle', {r:3, fill:'none'}); e.style.display = 'none'; st.fx.append(e); return {e, t0:-1e9, life:1, x:0, y:0, vx:0, vy:0, r:3}; }); st.pi = 0; st.fxOn = false;
  st.dirty = true; st.col = null; st.tickT = -1e9;
  if(crew && !crew.m.ant) crew.m.ant = crewApi(c);
  return st;
}
function world(c){ let st = c.svg.__an; if(!st || c.t < st.last - 1) st = c.svg.__an = worldInit(c, st || {}); st.last = Math.max(st.last || 0, c.t); return st; }
/* the soil, the crumbs and the dead take the ground's own colours; the trail and the spray take the accent */
function restyle(st, c){
  const g = st.g, C = g.col, p = st.p, rim = hexOf(C.rim), heap = hexOf(C.heap), mf = hexOf(C.moundFill), sh = hexOf(C.shade), dark = hexOf(mixI(C.moundFill, 0, .8));
  const S = (k, o) => { for(const a in o) p[k].setAttribute(a, o[a]); };
  for(const k of ['nestS', 'foodS', 'midS', 'pileS', 'bigS', 'deadS']) S(k, {fill:sh, 'fill-opacity':.4});
  S('nest', {fill:mf, stroke:rim, 'stroke-width':2.2}); S('rings', {fill:'none', stroke:rim, 'stroke-width':1.2, 'stroke-opacity':.4}); S('hole', {fill:dark, stroke:rim, 'stroke-width':1.6, 'stroke-opacity':.7});
  S('food', {fill:heap, stroke:rim, 'stroke-width':1.1, 'fill-opacity':.95}); S('mid', {fill:mf, stroke:rim, 'stroke-width':1.4, 'stroke-opacity':.6});
  S('midDead', {fill:heap, 'fill-opacity':.55, stroke:rim, 'stroke-width':1}); S('midLegs', {fill:'none', stroke:rim, 'stroke-width':1.4, 'stroke-opacity':.6, 'stroke-linecap':'round'});
  S('pile', {fill:heap, stroke:rim, 'stroke-width':1.1}); S('big', {fill:heap, stroke:rim, 'stroke-width':1.6}); S('dead', {fill:heap, 'fill-opacity':.7, stroke:rim, 'stroke-width':1.2}); S('deadLegs', {fill:'none', stroke:rim, 'stroke-width':1.6, 'stroke-opacity':.7, 'stroke-linecap':'round'});
  st.acc = hexOf(c.C.accent); for(const m of st.marks) m.e.setAttribute('stroke', st.acc); for(const q of st.parts) q.e.setAttribute('fill', st.acc);
}
function rebuildLand(st, now){
  const g = st.g, p = st.p, so = h => [Math.cos(g.light) * h * g.lightK, Math.sin(g.light) * h * g.lightK];
  let o = so(12);
  if(!st.crew){   // (in a crew the nest, the food and the midden are the scene's)
  p.nestS.setAttribute('d', blob(NEST[0] + o[0], NEST[1] + o[1], 58, 3, 22)); p.nest.setAttribute('d', blob(NEST[0], NEST[1], 56, 4, 22));
  p.rings.setAttribute('d', blob(NEST[0], NEST[1], 42, 5, 20) + blob(NEST[0], NEST[1], 31, 6, 18)); p.hole.setAttribute('d', blob(NEST[0], NEST[1], 21, 7, 16));
  let food = '', foodS = ''; o = so(5);
  for(let k = 0; k < st.food; k++){ const a = k * 2.399, r = 5 + 5.4 * Math.sqrt(k), x = FOOD[0] + Math.cos(a) * r, y = FOOD[1] + Math.sin(a) * r, rr = 6.2 + (k % 3) * 1.6; food += blob(x, y, rr, k + 1, 8); foodS += blob(x + o[0], y + o[1], rr, k + 1, 8); }
  p.food.setAttribute('d', food); p.foodS.setAttribute('d', foodS);
  o = so(7); p.midS.setAttribute('d', blob(MIDDEN[0] + o[0], MIDDEN[1] + o[1], 46, 9, 20)); p.mid.setAttribute('d', blob(MIDDEN[0], MIDDEN[1], 44, 10, 20));
  let mb = '', ml = ''; st.midden.forEach(q => { const a = antD(q.x, q.y, q.ang, .8); mb += a.body; ml += a.legs; }); p.midDead.setAttribute('d', mb); p.midLegs.setAttribute('d', ml);
  }
  let pile = '', pileS = ''; o = so(5);
  for(const q of st.pile){ const k = q.gone ? Math.max(0, 1 - (now - q.gone) / 420) : 1; if(k <= 0) continue; const r = (q.big ? 15 : 6.5) * k; pile += blob(q.x, q.y, r, q.k, 8); pileS += blob(q.x + o[0], q.y + o[1], r, q.k, 8); }
  p.pile.setAttribute('d', pile); p.pileS.setAttribute('d', pileS);
  if(st.big.on){ o = so(9); p.big.setAttribute('d', ptsD(ellW(st.big.x, st.big.y, 28, 20, .5, 14))); p.bigS.setAttribute('d', ptsD(ellW(st.big.x + o[0], st.big.y + o[1], 28, 20, .5, 14))); } else { p.big.setAttribute('d', ''); p.bigS.setAttribute('d', ''); }
  if(st.dead && !st.dead.carried){ const a = antD(st.dead.x, st.dead.y, st.dead.ang, 1); o = so(5); const s2 = antD(st.dead.x + o[0], st.dead.y + o[1], st.dead.ang, 1); p.dead.setAttribute('d', a.body); p.deadLegs.setAttribute('d', a.legs); p.deadS.setAttribute('d', s2.body); } else { p.dead.setAttribute('d', ''); p.deadLegs.setAttribute('d', ''); p.deadS.setAttribute('d', ''); }
  st.dirty = false;
}
/* ----- the trail: marks laid at the acidopore, in the world, each with its own strength and life; the follower reads them with its antennae and they fade ----- */
const alphaOf = (m, now) => { const u = (now - m.t0) / m.life; return m.t0 < -1e8 || u >= 1 ? 0 : m.s0 * Math.pow(1 - u, 1.3); };
const lifeOf = c => 12000 * Math.pow(2, 2 * c.pad.trail.L[0]);       // the evaporation: the Trail pad's x, from 3 s to 48 s
const tipOf = c => { const a = c.wp('mandR', bone_('mandR').q), b = c.wp('mandL', bone_('mandL').q); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
const acidAt = c => c.wp('gaster', P(-262, 0));
function addMark(c, st, wx, wy, ang, s0 = 1){
  const W = st.W, m = W ? W.marks[W.mi++ % W.marks.length] : st.marks[st.mi++ % MARK_N], dab = W && W.dab || 3.2, ca = Math.cos(ang) * dab, sa = Math.sin(ang) * dab;
  m.wx = wx; m.wy = wy; m.ang = ang; m.t0 = c.t; m.s0 = s0; m.life = lifeOf(c) * (.7 + .3 * s0); m.id = W ? ++W.seq : ++st.seq; m.q = -1;
  m.e.setAttribute('d', 'M' + f1(wx - ca) + ' ' + f1(wy - sa) + 'L' + f1(wx + ca) + ' ' + f1(wy + sa)); m.e.setAttribute('stroke', st.acc || '#d4a03c'); m.e.style.display = '';
}
function lay(c, st, s0 = 1){ const g = st.g, p = acidAt(c), q = c.wp('gaster', P(-238, 0)), w = g.toWorld(p[0], p[1]), w2 = g.toWorld(q[0], q[1]); addMark(c, st, w[0], w[1], Math.atan2(w[1] - w2[1], w[0] - w2[0]), s0); return w; }
function layAlong(c, st, a, s0 = 1){ const p = acidAt(c), w = st.g.toWorld(p[0], p[1]); if(!a.lw || Math.hypot(w[0] - a.lw[0], w[1] - a.lw[1]) >= 12){ a.lw = lay(c, st, s0); } }
/* a follower passing over a mark reinforces it (the Trail pad's y: none to full): the mark is brought back up to a strength and its clock restarts. With reinforcement on and a closed loop, nothing ever fades: the mill. */
function refreshNear(c, st, now, R = 20){
  const k = clamp(.5 + .5 * c.pad.trail.L[1], 0, 1); if(k <= .02) return; const p = acidAt(c), w = st.g.toWorld(p[0], p[1]);
  for(const m of st.marks){ if(m.t0 < -1e8 || Math.hypot(m.wx - w[0], m.wy - w[1]) > R) continue; if(alphaOf(m, now) < k){ m.s0 = k; m.t0 = now; m.life = lifeOf(c); m.q = -1; } }
}
/* what the antennae find: the best mark ahead (within a cone and a lookahead), the nearest mark anywhere, and how many are alive. Bearings are against the heading: positive is to the right. */
function pickMark(c, st, now){
  const g = st.g, H = [CX + 170, CY]; let best = null, bs = -1e9, near = null, nd = 1e9, n = 0;
  for(const m of st.marks){ const al = alphaOf(m, now); if(al < .05) continue; n++;
    const s = g.toScreen(m.wx, m.wy), dx = s[0] - H[0], dy = s[1] - H[1], d = Math.hypot(dx, dy), b = Math.atan2(dy, dx);
    const dc = Math.hypot(s[0] - CX, s[1] - CY); if(dc < nd){ nd = dc; near = {b:Math.atan2(s[1] - CY, s[0] - CX), d:dc, al}; }
    if(d > 38 && d < 210 && Math.abs(b) < 1.25){ const sc = d * .5 - 120 * Math.abs(b) + 40 * al; if(sc > bs){ bs = sc; best = {b, d, al}; } } }
  return {best, near, n};
}
/* ----- the world's own clock: marks fade, a load handed over is taken in after its delay, the spray flies, the crumbs come back ----- */
function tickWorld(c, st, now){
  if(now - st.tickT > 90){ st.tickT = now;
    for(const m of st.marks){ if(m.t0 < -1e8) continue; const al = alphaOf(m, now), q = Math.round(al * 14); if(q !== m.q){ m.q = q; if(q <= 0){ m.e.style.display = 'none'; m.t0 = -1e9; } else m.e.setAttribute('stroke-opacity', f1(q / 14 * .95)); } }
    for(const q of st.pile) if(!q.gone && now - q.t0 > q.delay){ q.gone = now; st.dirty = true; }
    if(st.pile.length && st.pile.some(q => q.gone && now - q.gone > 440)){ st.pile = st.pile.filter(q => !q.gone || now - q.gone <= 440); st.dirty = true; }
    for(let i = st.foodBack.length - 1; i >= 0; i--) if(now >= st.foodBack[i]){ st.foodBack.splice(i, 1); if(st.food < FOOD0){ st.food++; st.dirty = true; } }
    if(!st.big.on && now >= st.big.back){ st.big.on = true; st.big.x = BIG[0] + (c.rand() - .5) * 90; st.big.y = BIG[1] + (c.rand() - .5) * 90; st.dirty = true; }
  }
  if(st.pile.some(q => q.gone)) st.dirty = true;
  if(st.fxOn){ let any = false; for(const q of st.parts){ if(q.t0 < -1e8) continue; const age = now - q.t0; if(age >= q.life){ q.t0 = -1e9; q.e.style.display = 'none'; continue; } any = true; const u = age / q.life, k = 1 - Math.pow(u, 1.6), dr = Math.exp(-2.2 * age / 1000);
      q.e.setAttribute('cx', f1(q.x + q.vx * (1 - dr) / 2.2)); q.e.setAttribute('cy', f1(q.y + q.vy * (1 - dr) / 2.2)); q.e.setAttribute('r', f1(q.r * (.5 + .7 * u))); q.e.setAttribute('fill-opacity', f1(.8 * k)); }
    st.fxOn = any; }
}
function spray(c, st, x, y, vx, vy, life, r){ const q = st.parts[st.pi++ % st.parts.length]; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.t0 = c.t; q.life = life; q.r = r; q.e.style.display = ''; q.e.setAttribute('fill', st.acc || '#d4a03c'); st.fxOn = true; }
function drawWorld(c, st, now){
  const g = st.g; if(!g) return;
  if(st.col !== g.C || st.acc !== hexOf(c.C.accent)){ restyle(st, c); st.col = g.C; st.dirty = true; }
  tickWorld(c, st, now);
  if(st.dirty) rebuildLand(st, now);
  if(st.crew) return;   // (in a crew the habitat's own camera places the world)
  const tr = 'translate(' + CX + ' ' + CY + ') rotate(' + (g.phi * 180 / Math.PI).toFixed(3) + ') translate(' + (-g.cwX).toFixed(2) + ' ' + (-g.cwY).toFixed(2) + ')';
  if(st.tr !== tr){ st.tr = tr; st.grp.setAttribute('transform', tr); }
}


/* ---------- actions: a layer adds to the muscle targets and the pose, from wherever the body is; a gait-bound one may run on the legs ---------- */
const env_ = env, KS = (t, kk) => keys(t, kk), sinc = (t, f, ph = 0) => Math.sin(t * f + ph);
M.action('snap', {label:'Snap the mandibles', group:'Mouth', dur:2800, in:['stand', 'low', 'tend', 'climb'], f:(t, T, c, a) => {      // the closer is huge and the opener small: the blades open over a third of a second and shut in a few frames, twice
  const op = KS(t, [[0, 0], [360, 1], [860, 1], [920, 0], [1500, 0], [1800, 1], [2200, 1], [2260, 0], [2700, 0]]), sh = pulse(t, 900, 30, 40, 200) + pulse(t, 2240, 30, 40, 200);
  c.spec(T, {mandOpenR:op, mandOpenL:op, mandCloseR:.95 * sh, mandCloseL:.95 * sh, scapeAddR:.3 * sh, scapeAddL:.3 * sh}); }});
M.action('tap', {label:'Tap a foot', group:'Legs', dur:1500, in:['stand', 'low'], f:(t, T, c, a) => {      // a foot is lifted (drawn toward its knee) and put down again where it was, twice
  const k = a.k ?? (a.k = (c.rand() * LEGS.length) | 0), f = c.foot(k), u = pulse(t, 0, 160, 110, 180) + pulse(t, 620, 160, 110, 180);
  c.legReq(k, f[0], f[1] + LIFTS[k] * 1.2 * u, f[2] + FLEX[k] * u, {kk:16}); }});
M.action('antennaFlick', {label:'Flick the antennae', group:'Head', dur:1500, tiny:true, gait:true, f:(t, T, c, a) => {
  const u = pulse(t, 80, 110, 80, 330) + pulse(t, 560, 100, 80, 300);
  c.spec(T, {scapeAbdR:.45 * u, scapeAbdL:.32 * u, pedFlexR:.3 * u, pedFlexL:.45 * u}); }});
M.action('headScan', {label:'Scan', group:'Head', dur:2400, tiny:true, gait:true, f:(t, T, c, a) => {
  const u = env(t, 260, 1500, 500), w = sinc(t, .0042);
  c.spec(T, {headTurnR:pos(w) * .26 * u, headTurnL:pos(-w) * .26 * u, scapeAbdR:.3 * u, scapeAbdL:.3 * u, pedFlexR:.2 * u, pedFlexL:.2 * u}); }});
M.action('mouthWork', {label:'Work the mouthparts', group:'Mouth', dur:1600, tiny:true, gait:true, f:(t, T, c, a) => {
  const u = env(t, 200, 900, 400), h = sinc(t, .03);
  c.spec(T, {mandOpenR:pos(h) * .22 * u, mandOpenL:pos(h) * .22 * u, mandCloseR:pos(-h) * .12 * u, mandCloseL:pos(-h) * .12 * u}); }});
const turnAct = dir => (t, T, c, a) => { if(!a.go && t > 40){ a.go = 1; c.go('shuffle', {for:1700, turn:dir}); } };
M.action('turnLeft', {label:'Turn left', group:'Ground', dur:4200, in:['stand'], f:turnAct(-1)});
M.action('turnRight', {label:'Turn right', group:'Ground', dur:4200, in:['stand'], f:turnAct(1)});
/* ----- the agency actions: each is something an agent of this type does, and each leaves its mark in the world ----- */
const STEERING = new Set(['layTrail', 'followTrail', 'haul', 'groupCarry', 'clear', 'mill', 'lost', 'goEntrance', 'goField']);
function setGait(c, a, name){ const gs = c.gs; if(gs.on && gs.phase !== 'stop' && Math.abs(gs.psiT - M.gaits[name].psi) < .01) return; if(c.t - (a.gt ?? -1e9) < 300) return; a.gt = c.t; c.go(name); }
function halt(c, a, to = 'stand'){ if(c.t - (a.ht ?? -1e9) < 350) return; if(c.gs.on || c.pm.want !== to){ a.ht = c.t; c.go(to); } }
const settled = (c, p) => !c.gs.on && c.pm.node === p && !c.pm.tr && !c.pm.route.length && !c.pm.after;
const bearing = (c, st, W) => { const s = st.g.toScreen(W[0], W[1]), q = tipOf(c); return {b:Math.atan2(s[1] - CY, s[0] - CX), d:Math.hypot(s[0] - q[0], s[1] - q[1]), s}; };
/* walk toward a world point: steer by the bearing (step on the spot if it is behind), creep when near; returns {b, d} (the bearing and the distance from the mandibles' tips) */
function seek(c, st, a, W, o = {}){
  const r = bearing(c, st, W), ab = Math.abs(r.b); st.home = clamp((o.k ?? 2.2) * r.b, -1, 1);
  if(o.turn !== false && ab > 1.25 && r.d < 260) setGait(c, a, o.turn || 'shuffle'); else if(r.d < 230 || ab > .7) setGait(c, a, o.near || 'creep'); else setGait(c, a, o.gait || 'walk');
  return r;
}
/* arrived: within `R` of the point, or it has been within 90 and is now drawing away (it has passed it: a body with a turning circle cannot always stop on a point) */
function arrived(a, key, r, R = 46){ a[key] = Math.min(a[key] ?? 1e9, r.d); return r.d < R || (a[key] < 90 && r.d > a[key] + 30); }
const modeOf = c => c.gs.on ? 'ride' : c.pm.node === 'stand' && !c.pm.tr && !c.pm.route.length ? 'trip' : 'gesture';
const sweep = (t, amp, ph = 0) => ({R:amp * (.5 + .5 * Math.sin(t * .0105 + ph)), L:amp * (.5 + .5 * Math.sin(t * .0105 + ph + 2.6))});   // the antennae sweep one then the other, a few hertz

M.action('layTrail', {label:'Lay a trail', group:'Trail', dur:5200, gait:true, f:(t, T, c, a) => {
  /* the gaster is curled to the ground and drags a mark behind it, a dab every few body-widths of travel; the path curves a little so there is a trail to follow */
  const st = world(c); if(!st.g) return false;
  if(a.mode === undefined){ a.mode = modeOf(c); a.ph = c.rand() * 6.28; }
  const e = env(t, 500, 3100, 800);
  c.spec(T, {gasterCurl:.6 * e, layShow:e, scapeAbdR:.14, scapeAbdL:.14, breath:.2});
  if(a.mode === 'trip' && t > 100 && t < 3800) setGait(c, a, 'walk');
  if(a.mode !== 'gesture') st.home = t < 3800 ? .3 * Math.sin(t * .0011 + a.ph) : 0;
  if(t > 400 && t < 3700){ if(a.mode === 'gesture'){ if(!a.lw){ a.lw = lay(c, st); } } else layAlong(c, st, a); }
  if(a.mode === 'trip' && t > 3800){ halt(c, a, 'stand'); return !settled(c, 'stand') || t < 4200; }
  return t < 4800;
}});

M.action('followTrail', {label:'Follow the trail', group:'Trail', dur:20000, big:true, gait:true, f:(t, T, c, a) => {
  /* the antennae sweep and the ant turns toward the marks ahead; a follower with no mark casts about for one (wider and wider), and gives up. It reinforces the marks it passes (the Trail pad). */
  const st = world(c), now = c.t; if(!st.g) return false;
  if(a.mode === undefined){ a.mode = modeOf(c); a.ph = 'read'; a.t0 = 0; a.lost = 0; a.cast0 = 0; a.n = 0; }
  const s = sweep(t, 1), pk = pickMark(c, st, now), look = pk.best, dt = c.dtms, trip = a.mode === 'trip';
  let lean = 0, wide = .45;
  const food = bearing(c, st, FOOD);
  if(a.ph === 'read'){
    c.spec(T, {scapeAbdR:.6 * s.R, scapeAbdL:.6 * s.L, pedFlexR:.3 * s.R, pedFlexL:.3 * s.L, headTurnR:pos(Math.sin(t * .0042)) * .12, headTurnL:pos(-Math.sin(t * .0042)) * .12});
    if(a.mode === 'gesture' || t > 1300){ if(a.mode === 'gesture') return t < 2600; a.ph = pk.n ? 'follow' : 'cast'; a.cast0 = t; }
    return true;
  }
  if(a.ph === 'follow'){
    if(look){ a.lost = 0; lean = look.b; st.home = clamp(2.2 * look.b, -1, 1); if(trip){ setGait(c, a, Math.abs(look.b) > .55 ? 'creep' : 'walk'); } refreshNear(c, st, now); }
    else { a.lost += dt; if(a.lost > 650){ if(pk.near && pk.near.d < 620){ lean = pk.near.b; st.home = clamp(2.2 * pk.near.b, -1, 1); if(trip) setGait(c, a, Math.abs(pk.near.b) > .9 ? 'shuffle' : 'creep'); a.turning = 1; } else { a.ph = 'cast'; a.cast0 = t; } } }
    if(trip && food.d < 70){ a.ph = 'found'; a.t0 = t; }
    else if(!trip && t > 7000) return false;
  }
  if(a.ph === 'cast'){
    const k = clamp((t - a.cast0) / 3800); wide = .7 + .3 * k; st.home = (.35 + .5 * k) * Math.sin((t - a.cast0) * .0034);
    if(trip) setGait(c, a, 'creep');
    if(look){ a.ph = 'follow'; a.lost = 0; }
    else if(t - a.cast0 > 3800){ a.ph = 'lost'; a.t0 = t; }
    else if(!trip && t - a.cast0 > 2600) return false;
  }
  if(a.ph === 'found'){
    st.home = 0; if(trip) halt(c, a, 'stand'); const u = env(t - a.t0, 500, 1400, 500);
    c.spec(T, {headLower:.4 * u, scapeAddR:.3 * u, scapeAddL:.3 * u, mandOpenR:.3 * u, mandOpenL:.3 * u});
    if(t - a.t0 > 2300) return trip ? !settled(c, 'stand') : false;
    return true;
  }
  if(a.ph === 'lost'){
    st.home = 0; if(trip) halt(c, a, 'stand'); const u = env(t - a.t0, 600, 1200, 600);
    c.spec(T, {pedFlexR:.5 * u, pedFlexL:.5 * u, scapeAddR:.4 * u, scapeAddL:.4 * u, headLower:.3 * u});
    if(t - a.t0 > 2400) return trip ? !settled(c, 'stand') : false;
    return true;
  }
  /* the antennae: swept alternately; the one on the side of the mark leans into it, the other trails (bilateral comparison) */
  const l = clamp(lean * 1.2, -1, 1);
  c.spec(T, {scapeAbdR:wide * s.R * (1 + pos(l)) * .9, scapeAbdL:wide * s.L * (1 + pos(-l)) * .9, scapeAddR:pos(-l) * .3, scapeAddL:pos(l) * .3, pedFlexR:.25 * s.R + pos(l) * .3, pedFlexL:.25 * s.L + pos(-l) * .3, gasterCurl:.12, headTurnR:pos(l) * .14, headTurnL:pos(-l) * .14});
  return true;
}});

M.action('mill', {label:'The mill (cut off from the column)', group:'Trail', dur:26000, big:true, gait:true, f:(t, T, c, a) => {
  /* the failure the notes name: cut off, the ant follows its own trail round in a closed circle, reinforcing it at each pass, until it is exhausted. If the marks fade before it comes round (the Trail pad's evaporation
     fast, or reinforcement none) the loop breaks and it is simply lost; with a decay and reinforcement together, the mill is as long as the ant can walk. */
  const st = world(c), now = c.t; if(!st.g) return false;
  if(a.mode === undefined){ a.mode = modeOf(c); a.lost = 0; a.broken = 0; }
  const s = sweep(t, 1), trip = a.mode === 'trip', dt = c.dtms;
  if(!trip){ const u = env(t, 400, 1800, 500); c.spec(T, {scapeAbdR:.6 * s.R * u, scapeAbdL:.6 * s.L * u, pedFlexR:.3 * u, pedFlexL:.3 * u, gasterCurl:.3 * u}); return t < 3000; }
  const tired = clamp((t - 17500) / 3500), run = t > 1200 && t < 21000 && !a.broken;
  c.spec(T, {scapeAbdR:.7 * s.R * (1 - .5 * tired), scapeAbdL:.7 * s.L * (1 - .5 * tired), pedFlexR:.2 + .5 * tired, pedFlexL:.2 + .5 * tired, gasterCurl:.3 * (1 - tired), layShow:1 - tired, headLower:.5 * tired});
  if(t < 1200){ st.home = 0; return true; }
  if(run){
    setGait(c, a, tired > .5 ? 'creep' : 'walk'); st.home = 1;
    if(t < 6600) layAlong(c, st, a, 1);                                         // the first lap lays the trail; every later one only reads it, and reinforces it
    else { const pk = pickMark(c, st, now); if(pk.best){ a.lost = 0; refreshNear(c, st, now, 24); } else { a.lost += dt; if(a.lost > 1400){ a.broken = 1; a.tb = t; } } }
    return true;
  }
  st.home = a.broken ? .1 * Math.sin(t * .003) : 0; halt(c, a, 'stand');
  const u = env(t - (a.broken ? a.tb : 21000), 500, 1400, 600);
  c.spec(T, {pedFlexR:.4 * u, pedFlexL:.4 * u, scapeAddR:.3 * u, scapeAddL:.3 * u, headLower:.4 * u});
  return !settled(c, 'stand') || t < (a.broken ? a.tb : 21000) + 2400;
}});

M.action('recruit', {label:'Recruit nestmates', group:'Trail', dur:5800, gait:true, f:(t, T, c, a) => {
  /* the ant meets two nestmates, touches each with its antennae (antennal contact), leaves a mark; they turn from facing it to facing the trail, and go. The helpers are props on bones of their own, so no one is stolen from the ant. */
  const st = world(c); if(!st.g) return false;
  const e = env(t, 600, 4000, 900), turn = t < 2300 ? 1 : Math.max(0, 1 - (t - 2300) / 1500), tR = env(t - 700, 250, 450, 350), tL = env(t - 1500, 250, 450, 350);
  const away = clamp((t - 3900) / 1300);
  c.spec(T, {crewShowR:1.2 * e, crewShowL:1.2 * e, crewTurnR:turn, crewTurnL:turn, crewBackR:away, crewBackL:away,
    scapeAbdR:.2 + .35 * (1 - tR), scapeAddR:.55 * tR, pedFlexR:.5 * tR, scapeAbdL:.2 + .35 * (1 - tL), scapeAddL:.55 * tL, pedFlexL:.5 * tL,
    mandOpenR:.25 * pulse(t, 900, 200, 120, 220), mandOpenL:.25 * pulse(t, 1700, 200, 120, 220), headTurnR:.18 * tR, headTurnL:.18 * tL, gasterCurl:.4 * env(t, 1800, 1500, 800), layShow:env(t, 1800, 1500, 800)});
  if(t > 2000 && !a.mk){ a.mk = 1; lay(c, st, 1); }
}});

/* hauling: out to the item, grab it, carry it to the lip of the nest, put it down, and the receivers take it in after a delay (the Receivers pad). The delay is the demand: when the pile at the lip is full, the next load waits. */
const hauler = group => (t, T, c, a) => {
  const st = world(c), now = c.t; if(!st.g) return false;
  const DUR = group ? 30000 : 26000, dt = c.dtms, load = group ? 'bigShow' : 'carryShow', item = () => group ? [st.big.x, st.big.y] : FOOD;
  if(a.mode === undefined){ a.mode = modeOf(c); a.ph = 'out'; a.p0 = c.pm.node; a.lead = 0; }
  const crew = (u, inn) => c.spec(T, {crewShowR:1.2 * u, crewShowL:1.2 * u, crewInR:inn, crewInL:inn});
  if(a.mode !== 'trip'){
    const u = env(t, 450, 2300, 600); c.spec(T, {[load]:1.4 * u, mandCloseR:.5 * u, mandCloseL:.5 * u, pedFlexR:.3 * u, pedFlexL:.3 * u, headRaise:.3 * u}); if(group){ c.spec(T, {carryShow:-1.6 * u}); crew(u, u); }
    return t < 3300;
  }
  if(t > DUR - 3800 && a.ph !== 'done' && a.ph !== 'abort'){ a.ph = 'abort'; a.ta = t; }
  const mouth = (o, c2) => ({mandOpenR:o, mandOpenL:o, mandCloseR:c2, mandCloseL:c2});
  if(a.ph === 'out'){
    st.home = 0;
    if(!a.chk){ a.chk = 1; if(st.pile.length >= PILE_MAX - 2){ a.ph = 'wait'; a.tw = t; } }
    if((group ? !st.big.on : st.food <= 0) && a.ph === 'out'){ a.ph = 'empty'; a.te = t; }
    if(a.ph === 'out'){ const r = seek(c, st, a, item()); c.spec(T, {scapeAbdR:.3, scapeAbdL:.3, ...mouth(.12, 0)}); if(arrived(a, 'md', r)){ a.ph = 'grab'; a.tg = t; a.md = undefined; } }
  }
  if(a.ph === 'wait'){
    /* backpressure: too many loads wait at the lip, so this one is not fetched: it goes to the entrance and waits, feelers waving, until the receivers have cleared the pile */
    if(!a.atLip){ const r = seek(c, st, a, LIP, {k:1.6}); if(r.d < 80) a.atLip = 1; } else { st.home = 0; halt(c, a, 'stand'); } const s = sweep(t, 1);
    c.spec(T, {scapeAbdR:.6 * s.R, scapeAbdL:.6 * s.L, pedFlexR:.3, pedFlexL:.3, breath:.4});
    if(a.atLip && settled(c, 'stand') && (st.pile.length < PILE_MAX - 2 || t - a.tw > 5000)){ a.ph = 'out'; a.atLip = 0; }
    else if(t - a.tw > 7000) a.ph = 'done';
    return true;
  }
  if(a.ph === 'empty'){
    st.home = 0; halt(c, a, 'stand'); const u = env(t - a.te, 500, 1200, 500), s = sweep(t, 1);
    c.spec(T, {scapeAbdR:.6 * s.R * u, scapeAbdL:.6 * s.L * u, pedFlexR:.4 * u, pedFlexL:.4 * u, headLower:.3 * u});
    if(t - a.te > 2300 && settled(c, 'stand')) return false; return true;
  }
  if(a.ph === 'grab'){
    st.home = 0; halt(c, a, 'stand');
    if(!c.gs.on && a.tg2 === undefined) a.tg2 = t;
    if(a.tg2 !== undefined){
      const u = t - a.tg2, dn = env(u, 400, 500, 450), cls = env(u - 450, 250, 700, 300);
      c.spec(T, {headLower:.6 * dn, ...mouth(.9 * dn * (1 - cls), 1.1 * cls), scapeAddR:.3 * dn, scapeAddL:.3 * dn, [load]:1.4 * clamp((u - 750) / 300)});
      if(group){ c.spec(T, {carryShow:-1.6 * clamp((u - 500) / 300)}); crew(clamp((u - 300) / 600), clamp((u - 500) / 900)); }
      if(u > 800 && !a.took){ a.took = 1; if(group){ st.big.on = false; st.big.back = now + 9000; } else { st.food--; st.foodBack.push(now + 8000); } st.dirty = true; }
      if(u > 1500){ a.ph = 'back'; a.tb = t; a.lw = null; }
    }
  }
  if(a.ph === 'back'){
    let r;
    if(group){ const k = Math.floor((t - a.tb) / 2600) % 4, lead = [0, 1, -1, 0][k]; if(lead !== a.lead){ a.lead = lead; }
      r = bearing(c, st, LIP); st.home = lead === 0 ? clamp(2.2 * r.b, -1, 1) : .14 * lead; setGait(c, a, 'carryWalk');
      c.spec(T, {carryShow:-1.6, bigShow:1.4, ...mouth(0, .5), crewTurnR:a.lead > 0 ? .3 : 0, crewTurnL:a.lead < 0 ? .3 : 0, headTurnR:pos(st.home) * .3, headTurnL:pos(-st.home) * .3}); crew(1, 1); }
    else { r = seek(c, st, a, LIP, {gait:'carryWalk', near:'carryWalk', turn:'carryWalk'}); c.spec(T, {...mouth(0, .45), gasterCurl:.35, layShow:1, carryShow:1.4}); layAlong(c, st, a, 1); }
    if(arrived(a, 'md', r)){ a.ph = 'drop'; a.td = t; a.md = undefined; }
    return true;
  }
  if(a.ph === 'drop'){
    st.home = 0; halt(c, a, 'stand');
    if(!c.gs.on && a.td2 === undefined) a.td2 = t;
    if(a.td2 !== undefined){
      const u = t - a.td2, op = env(u, 300, 900, 400), gone = clamp((u - 350) / 250);
      c.spec(T, {...mouth(.8 * op, 0), headLower:.4 * op, [load]:1.4 * (1 - gone)}); if(group){ c.spec(T, {carryShow:-1.6}); crew(1 - clamp((u - 900) / 500), 1); }
      if(u > 350 && !a.put){ a.put = 1; const q = tipOf(c), w = st.g.toWorld(q[0], q[1]); st.pile.push({x:w[0], y:w[1], t0:now, delay:2000 * Math.pow(8, -c.pad.receivers.L[0]) * (group ? 2 : 1), k:c.rand() * 9, big:group}); st.dirty = true; }
      if(u > 1500) a.ph = 'done';
    }
  }
  if(a.ph === 'abort'){ st.home = 0; halt(c, a, a.p0); const u = clamp(1 - (t - a.ta) / 500); c.spec(T, {[load]:1.4 * u, carryShow:group ? -1.6 : 1.4 * u}); if(group) crew(u, u); return !settled(c, a.p0) || t - a.ta < 900; }
  if(a.ph === 'done'){ st.home = 0; halt(c, a, a.p0); c.spec(T, {carryShow:group ? -1.6 : 0}); return !settled(c, a.p0); }
  return true;
};
M.action('haul', {label:'Haul a crumb to the nest', group:'Carry', dur:26000, big:true, gait:true, f:hauler(false)});
M.action('groupCarry', {label:'Carry a seed together', group:'Carry', dur:30000, big:true, gait:true, f:hauler(true)});

M.action('clear', {label:'Clear out the dead', group:'Care', dur:23000, big:true, gait:true, f:(t, T, c, a) => {
  /* a nestmate has died on the floor: the ant antennates it first (the test that it is dead, not only a mark that says so), takes it in its jaws, carries it to the midden and puts it down */
  const st = world(c), now = c.t; if(!st.g) return false;
  if(a.mode === undefined){ a.mode = modeOf(c); a.ph = 'spawn'; a.p0 = c.pm.node; }
  const mouth = (o, c2) => ({mandOpenR:o, mandOpenL:o, mandCloseR:c2, mandCloseL:c2});
  if(a.mode !== 'trip'){ const u = env(t, 450, 2200, 600), s = sweep(t, 1); c.spec(T, {scapeAbdR:.5 * s.R * u, scapeAbdL:.5 * s.L * u, pedFlexR:.3 * u, pedFlexL:.3 * u, deadShow:1.4 * clamp(u - .3), carryShow:-1.6 * clamp(u - .3), ...mouth(.3 * pulse(t, 1300, 200, 200, 300), .5 * clamp(u - .3))}); return t < 3300; }
  if(t > 23000 - 3800 && a.ph !== 'done' && a.ph !== 'abort'){ a.ph = 'abort'; a.ta = t; }
  if(a.ph === 'spawn'){
    if(!st.dead){ const w = st.g.toWorld(CX + 250, CY + 120); st.dead = {x:w[0], y:w[1], ang:c.rand() * 6.28, carried:false}; st.dirty = true; }
    a.ph = 'approach';
  }
  if(a.ph === 'approach'){
    if(!st.dead){ a.ph = 'done'; } else { const r = seek(c, st, a, [st.dead.x, st.dead.y]); c.spec(T, {scapeAbdR:.4, scapeAbdL:.4, pedFlexR:.2, pedFlexL:.2}); if(arrived(a, 'md', r)){ a.ph = 'test'; a.tt = t; a.md = undefined; } }
  }
  if(a.ph === 'test'){
    st.home = 0; halt(c, a, 'stand');
    if(!c.gs.on){ if(a.tt2 === undefined) a.tt2 = t; const u = t - a.tt2, e = env(u, 300, 1700, 400), tap = Math.sin(u * .02), r = bearing(c, st, [st.dead.x, st.dead.y]);
      c.spec(T, {headLower:.45 * e, headTurnR:pos(r.b) * .3 * e, headTurnL:pos(-r.b) * .3 * e, scapeAbdR:pos(tap) * .5 * e, scapeAddR:pos(-tap) * .5 * e, scapeAbdL:pos(-tap) * .5 * e, scapeAddL:pos(tap) * .5 * e, pedFlexR:.35 * e, pedFlexL:.35 * e, ...mouth(pos(Math.sin(u * .012)) * .3 * e, 0)});
      if(u > 2100){ a.ph = 'lift'; a.tl = t; } }
  }
  if(a.ph === 'lift'){
    st.home = 0; const u = t - a.tl, cls = env(u, 250, 1600, 300), dn = env(u, 300, 400, 400);
    c.spec(T, {headLower:.5 * dn, ...mouth(.8 * (1 - clamp(u / 350)), 1.1 * clamp((u - 250) / 300)), deadShow:1.4 * clamp((u - 500) / 300), carryShow:-1.6 * clamp((u - 500) / 300)});
    if(u > 650 && !a.took){ a.took = 1; st.dead.carried = true; st.dirty = true; }
    if(u > 1300){ a.ph = 'carry'; a.tc = t; }
  }
  if(a.ph === 'carry'){
    const r = seek(c, st, a, MIDDEN, {gait:'carryWalk', near:'carryWalk', turn:'carryWalk'}); c.spec(T, {...mouth(0, .5), deadShow:1.4, carryShow:-1.6, headRaise:.2});
    if(arrived(a, 'md', r, 56)){ a.ph = 'drop'; a.td = t; a.md = undefined; }
    return true;
  }
  if(a.ph === 'drop'){
    st.home = 0; halt(c, a, 'stand');
    if(!c.gs.on){ if(a.td2 === undefined) a.td2 = t; const u = t - a.td2, op = env(u, 300, 700, 400), gone = clamp((u - 350) / 250);
      c.spec(T, {...mouth(.8 * op, 0), headLower:.4 * op, deadShow:1.4 * (1 - gone), carryShow:-1.6});
      if(u > 350 && !a.put){ a.put = 1; const q = tipOf(c), w = st.g.toWorld(q[0], q[1]); st.midden.push({x:w[0] + 20, y:w[1], ang:c.rand() * 6.28}); if(st.midden.length > 6) st.midden.shift(); st.dead = null; st.dirty = true; }
      if(u > 1400) a.ph = 'done'; }
  }
  if(a.ph === 'abort'){ st.home = 0; halt(c, a, a.p0); const u = clamp(1 - (t - a.ta) / 500); c.spec(T, {deadShow:1.4 * u * (st.dead && st.dead.carried ? 1 : 0), carryShow:-1.6 * (st.dead && st.dead.carried ? 1 : 0)}); if(st.dead && st.dead.carried && !a.put){ a.put = 1; const q = tipOf(c), w = st.g.toWorld(q[0], q[1]); st.midden.push({x:w[0], y:w[1], ang:0}); st.dead = null; st.dirty = true; } return !settled(c, a.p0) || t - a.ta < 900; }
  if(a.ph === 'done'){ st.home = 0; halt(c, a, a.p0); c.spec(T, {carryShow:-1.6}); return !settled(c, a.p0); }
  return true;
}});

M.action('lost', {label:'Lose the trail', group:'Trail', dur:6200, gait:true, f:(t, T, c, a) => {
  /* the run state the notes call failed: the trail has faded. The ant casts for it, wider and wider, turning on the spot; finds nothing; and its feelers droop */
  const st = world(c); if(!st.g) return false;
  if(a.mode === undefined) a.mode = modeOf(c);
  const k = clamp(t / 3600), s = sweep(t, 1), droop = clamp((t - 3600) / 1200), w = Math.sin(t * .0034), live = 1 - droop;
  c.spec(T, {scapeAbdR:.8 * s.R * (.4 + k) * live, scapeAbdL:.8 * s.L * (.4 + k) * live, pedFlexR:.2 + .5 * droop, pedFlexL:.2 + .5 * droop, scapeAddR:.4 * droop, scapeAddL:.4 * droop, headLower:.35 * droop, headTurnR:pos(w) * .3 * k * live, headTurnL:pos(-w) * .3 * k * live});
  if(a.mode === 'trip'){ if(t < 3600){ st.home = (.4 + .5 * k) * w; setGait(c, a, 'shuffle'); } else { st.home = 0; halt(c, a, 'stand'); return !settled(c, 'stand') || t < 4800; } }
  return t < 5400;
}});

const trek = (label, W, name) => M.action(name, {label, group:'Ground', dur:14000, gait:true, f:(t, T, c, a) => {
  /* walk to a zone of the hive: the entrance (the boundary) or the field (the forage), and stand there; these are what a stage uses to move the ant through its habitat */
  const st = world(c); if(!st.g) return false;
  if(a.mode === undefined) a.mode = modeOf(c);
  if(a.mode !== 'trip'){ const s = sweep(t, 1), u = env(t, 300, 1200, 500); c.spec(T, {scapeAbdR:.4 * s.R * u, scapeAbdL:.4 * s.L * u}); return t < 2000; }
  if(!a.arr){ const r = seek(c, st, a, W()); if(arrived(a, 'md', r) || t > 11000){ a.arr = t; } return true; }
  st.home = 0; halt(c, a, 'stand'); return !settled(c, 'stand');
}});
trek('Walk to the entrance', () => LIP, 'goEntrance');
trek('Walk to the field', () => FOOD, 'goField');

M.action('tendBrood', {label:'Tend the larva', group:'Care', dur:5400, in:['tend'], f:(t, T, c, a) => {
  /* the head to the larva: the mandibles lap, the antenna on that side strokes it, the gaster pulses (trophallaxis: the crop is passed to the grub), the feelers on the far side hold */
  const u = env(t, 500, 4000, 700), lick = Math.sin(t * .014), stroke = Math.sin(t * .009);
  c.spec(T, {headTurnR:.1 * u * lick, headLower:.3 * u * (.5 + .5 * lick), mandOpenR:pos(lick) * .3 * u, mandOpenL:pos(lick) * .3 * u, scapeAddR:(.5 + .4 * stroke) * u, pedFlexR:.4 * u, scapeAbdL:.3 * u, breath:.5 * u, gasterCurl:.14 * u * (.5 + .5 * Math.sin(t * .004))});
}});

M.action('alarm', {label:'Alarm (spray formic acid)', group:'Defence', dur:3800, in:['stand', 'low', 'climb'], f:(t, T, c, a) => {
  /* the gaster is curled forward under the thorax, the jaws gape, the feelers go up; then the acid is sprayed forward in a burst, and two nestmates come running (a prop on the helpers' bones) */
  const st = world(c); if(!st.g) return false;
  const u = env(t, 450, 1900, 800), came = env(t - 1500, 500, 1000, 600);
  c.spec(T, {gasterCurl:1.2 * u, headRaise:.4 * u, mandOpenR:.95 * u, mandOpenL:.95 * u, scapeAbdR:.5 * u, scapeAbdL:.5 * u, pedExtR:.5 * u, pedExtL:.5 * u, breath:.5 * u, crewShowR:1.2 * came, crewShowL:1.2 * came, crewTurnR:.1 * came, crewTurnL:.1 * came});
  if(t > 900 && t < 2000 && c.t - (a.sp ?? -1e9) > 45){ a.sp = c.t; const p = acidAt(c); for(let i = 0; i < 3; i++) spray(c, st, p[0] + 12, p[1] + (c.rand() - .5) * 20, 520 + c.rand() * 360, (c.rand() - .5) * 300, 520 + c.rand() * 300, 3.2 + c.rand() * 3.4); }
}});

M.action('groom', {label:'Clean an antenna', group:'Care', dur:4200, in:['stand', 'low'], f:(t, T, c, a) => {
  /* the foreleg's tibia has a notch with a comb: the ant draws an antenna through it, one side then the other */
  const u = env(t, 450, 3000, 650), mouth = c.wp('head', P(184, 0));
  for(const [k, s, t0] of [[0, 1, 0], [3, -1, 1800]]){ const e = env(t - 400 - t0, 400, 1100, 500), sw = Math.sin((t - t0) * .012), side = s;
    c.legTo(k, mouth[0] + 4 * sw, mouth[1] + side * (16 - 4 * sw), side * .3, e * (.35 + .65 * (.5 + .5 * sw)), e, {kk:12});
    c.spec(T, {[s > 0 ? 'scapeAddR' : 'scapeAddL']:.5 * e, [s > 0 ? 'pedFlexR' : 'pedFlexL']:.6 * e}); }
  c.spec(T, {headLower:.3 * u, mandOpenR:.12 * u, mandOpenL:.12 * u});
}});
M.action('climbReach', {label:'Reach and grip', group:'Legs', dur:3800, in:['climb'], f:(t, T, c, a) => {
  /* climbing: the forelegs reach ahead and take hold in turn, the head sways, the feelers probe the stem */
  const e = env(t, 400, 2900, 500);
  for(const [k, s, t0] of [[0, 1, 200], [3, -1, 1900]]){ const f = c.foot(k), u = pulse(t, t0, 450, 350, 500); c.legReq(k, f[0] + 24 * u, f[1] + s * -12 * u, f[2] + s * -.2 * u, {kk:14}); }
  c.spec(T, {headTurnR:pos(Math.sin(t * .003)) * .2 * e, headTurnL:pos(-Math.sin(t * .003)) * .2 * e, scapeAbdR:.5 * e, scapeAbdL:.5 * e, pedFlexR:.2 * e * (.5 + .5 * Math.sin(t * .01)), pedFlexL:.2 * e * (.5 + .5 * Math.sin(t * .01 + 2))});
}});


/* ---------- pads: the jaws, the antennae, the head, the gaster, the six legs (each split near and far), the ground ---------- */
const cl = v => Math.max(-1, Math.min(1, v));
M.pad('mandibles', {label:'Mandibles', group:'Mouth', x:['closed', 'open'], y:['slack', 'clamped'], map:(x, y) => ({mandOpenR:pos(x) * .9, mandOpenL:pos(x) * .9, mandCloseR:pos(-x) * .8 + pos(y) * .7, mandCloseL:pos(-x) * .8 + pos(y) * .7}), ghost:c => [cl(c.act('mandOpenR') - c.act('mandCloseR')), cl(c.act('mandCloseR'))]});
M.pad('antennae', {label:'Antennae', group:'Head', x:['drawn in', 'swept out'], y:['straight', 'curled'], map:(x, y) => ({scapeAbdR:pos(x), scapeAbdL:pos(x), scapeAddR:pos(-x), scapeAddL:pos(-x), pedFlexR:pos(y), pedFlexL:pos(y), pedExtR:pos(-y) * .8, pedExtL:pos(-y) * .8}), ghost:c => [cl(c.act('scapeAbdR') - c.act('scapeAddR')), cl(c.act('pedFlexR') - c.act('pedExtR'))]});
M.pad('head', {label:'Head', group:'Head', x:['left', 'right'], y:['lowered', 'raised'], map:(x, y) => ({headTurnR:pos(x), headTurnL:pos(-x), headRaise:pos(y), headLower:pos(-y)}), ghost:c => [cl(c.act('headTurnR') - c.act('headTurnL')), cl(c.act('headRaise') - c.act('headLower'))]});
M.pad('gaster', {label:'Gaster', group:'Body', x:['to the left', 'to the right'], y:['straight', 'curled under'], map:(x, y) => ({gasterSwingR:pos(x), gasterSwingL:pos(-x), gasterCurl:pos(y)}), ghost:c => [cl(c.act('gasterSwingR') - c.act('gasterSwingL')), cl(c.act('gasterCurl'))]});
for(let i = 0; i < PAIRS; i++) M.pad('leg' + i, {label:'Leg pair ' + (i + 1) + (i === 0 ? ' (fore)' : i === 2 ? ' (hind)' : ' (middle)'), group:'Limbs', split:'NF', leg:'leg' + i, x:['toward the head', 'toward the gaster'], y:['flexed', 'stretched']});
M.pad('steer', {label:'Steer (while it steps)', group:'Ground', value:true, x:['turn left', 'turn right'], y:['', ''], ghost:c => [cl(c.pad.steer.L[0]), 0]});
M.pad('trail', {label:'Trail · evaporation and reinforcement', group:'Trail', value:true, x:['evaporates fast', 'lasts long'], y:['not reinforced', 'followers reinforce'], ghost:c => [cl(c.pad.trail.L[0]), cl(c.pad.trail.L[1])]});
M.pad('receivers', {label:'Receivers · hand-off delay', group:'Trail', value:true, x:['slow to take in', 'quick to take in'], y:['', ''], ghost:c => [cl(c.pad.receivers.L[0]), 0]});
M.pad('soil', {label:'Soil · grain and prints', group:'Ground', value:true, x:['fine', 'coarse'], y:['fading', 'lasting'], ghost:c => [cl(c.pad.soil.L[0]), cl(c.pad.soil.L[1])]});

/* ---------- the shadows: the ground's light is fixed in the world, so a lifted foot's shadow leaves it ---------- */
function groundDraw(c, st){
  const g = st.g; if(!g) return; const o = z => g.shadowOff(z), line = (pts, zs) => 'M' + pts.map((p, i) => { const q = o(zs[i]); return f1(p[0] + q[0]) + ' ' + f1(p[1] + q[1]); }).join('L');
  const poly = (bone, pts, z) => { const q = o(z); return 'M' + pts.map(p => { const w = c.wp(bone, p); return f1(w[0] + q[0]) + ' ' + f1(w[1] + q[1]); }).join('L') + 'Z'; };
  g.shadow('thorax', poly('body', THORAX, 26), {fill:true, opacity:.46}); g.shadow('head', poly('head', HEAD, 26), {fill:true, opacity:.44}); g.shadow('gaster', poly('gaster', GASTER, 24), {fill:true, opacity:.46});
  LEGS.forEach((L, k) => { const lf = c.gait && c.gs.on && !c.gait.stance[k] ? Math.sin(Math.PI * Math.max(0, Math.min(1, c.gs.legs[k].p))) : 0, b = n => bone_(n + L.tag).p;
    g.shadow('leg' + k, line([c.wp('u' + L.tag, b('u')), c.wp('l' + L.tag, b('l')), c.wp('f' + L.tag, b('f')), c.toe(k)], [26, 54 + 10 * lf, 18 + 26 * lf, 36 * lf]), {w:9.5, opacity:.42}); });
  for(const s of [1, -1]){ const t = s > 0 ? 'R' : 'L';
    g.shadow('mand' + t, line([c.wp('mand' + t, bone_('mand' + t).p), c.wp('mand' + t, bone_('mand' + t).q)], [44, 36]), {w:7, opacity:.34});
    g.shadow('ant' + t, line([c.wp('ant' + t, bone_('ant' + t).p), c.wp('antE' + t, bone_('antE' + t).p), c.wp('antF' + t, bone_('antF' + t).p), c.wp('antT' + t, bone_('antT' + t).q)], [46, 56, 52, 44]), {w:3.2, opacity:.28}); }
  g.draw(); g.tick(c.dtms, c.t);
}

/* ---------- the crew's handle on an ant (creature-crew.js): c.crew.m.ant. Where its mouth and acidopore are in the world, the one shared trail, and how to lay and read it. A scene (crew-ant.js) builds its gestures and its
   patterns on these; none of it exists on the ant's own page. ---------- */
function crewApi(c){
  const S = () => world(c), w = p => S().g.toWorld(p[0], p[1]);
  return {
    tip:() => w(tipOf(c)),                                   // the middle of the two mandible tips, in the world
    acid:() => w(acidAt(c)),                                 // the acidopore
    head:() => w(c.wp('head', P(134, 0))),
    feel:() => ['antTR', 'antTL'].map(n => w(c.wp(n, bone_(n).q))),                    // the two antennae's tips
    part:(bone, u, v) => w(c.wp(bone, P(u, v))),             // a point of a bone in the body frame (u along the body toward the head, v to its right)
    bearing:(x, y) => bearing(c, S(), [x, y]),               // {b (against the heading, positive to the right, from the body's centre), d (from the mandibles' tips), s}
    lay:(s0 = 1) => lay(c, S(), s0), layAlong:(a, s0 = 1) => layAlong(c, S(), a, s0),
    pick:() => pickMark(c, S(), c.t), refresh:(R = 20) => refreshNear(c, S(), c.t, R),
    inject:(x, y, ang, s0 = 1) => addMark(c, S(), x, y, ang, s0),
    home:v => { const st = S(); if(v !== undefined) st.home = v; return st.home; },
    life:() => lifeOf(c), marks:() => S().W && S().W.marks,
  };
}

/* ---------- hooks ---------- */
const DEF = M.finish({
  reachCap:-999, strideMax:118,
  idle(c, now, Ti, dt){
    const st = world(c), g = st.g; if(!g) return;
    c.spec(Ti, {breath:.3 + .28 * Math.sin(now * .0046), trunk:.1 + .06 * Math.sin(now * .0027 + 1), headTurnR:pos(Math.sin(now * .0019)) * .05, headTurnL:pos(-Math.sin(now * .0019)) * .05,
      scapeAbdR:.12 + .08 * Math.sin(now * .0018), scapeAbdL:.12 + .08 * Math.sin(now * .0018 + 1.7), pedFlexR:.1 + .05 * Math.sin(now * .0022), pedFlexL:.1 + .05 * Math.sin(now * .0022 + 2.1)});
    if(!c.svg.__anGo){ c.svg.__anGo = 1; const go0 = c.go, play0 = c.play;
      c.go = (n, o) => { const S = c.svg.__an; if(o && o.turn !== undefined && S) S.turn = o.turn; return go0(n, o); };
      c.play = (n, a) => { const S = c.svg.__an; if(a && a.turn !== undefined && S) S.turn = a.turn; return play0(n, a); }; }
    if(!c.actions.some(x => !x.cut && (STEERING.has(x.name) || (c.d.actions[x.name] && c.d.actions[x.name].steers)))) st.home *= .86;
    const q = c.pad.soil.L; g.setParams({grain:q[0], persist:Math.pow(2, 1.6 * q[1] - 1), thrown:.4});
    const cx0 = g.cwX, cy0 = g.cwY;
    g.update(c, {now, dt, mirror:false, steer:st.turn + c.pad.steer.L[0] + st.home, legs:6, trailing:() => true, omega:1.8, onStop:() => { const S = c.svg.__an; if(S) S.turn = 0; }});
    /* in a crew a body that holds a load with others is held by it: the host sets m.drag (0..1) and the world moves under the feet by that share of the stride (the legs still work: at 0 they scrabble in place) */
    if(c.crew && c.crew.m.drag !== undefined && c.crew.m.drag < 1){ const k = Math.max(0, c.crew.m.drag); g.cwX = cx0 + (g.cwX - cx0) * k; g.cwY = cy0 + (g.cwY - cy0) * k; }
    if(c.crew && c.crew.m.nudge){ const n = c.crew.m.nudge; g.cwX += n[0]; g.cwY += n[1]; c.crew.m.nudge = null; }   // the load draws its holder along (a few units a frame, set by the host)
    st.last = now;
  },
  gaitBody(c, G, k, ph, mk){
    /* the carry-walk is the walk with a load in the jaws: jaws closed, feelers drawn in, head up, gaster curled (the weight of the carry is the gait's own, whatever posture it starts in) */
    const a = 2 * Math.PI * ph, sw = Math.sin(a + .5), w = (Math.abs(c.gs.psiT - .8) < .05 ? 1 : 0) * k;
    c.spec(c.Ta, {scapeAbdR:.12 * k * (.5 + .5 * Math.sin(a + 1.2)), scapeAbdL:.12 * k * (.5 + .5 * Math.sin(a + 1.2 + Math.PI)), gasterSwingL:.12 * k * pos(sw), gasterSwingR:.12 * k * pos(-sw), headTurnR:.05 * k * pos(-sw), headTurnL:.05 * k * pos(sw)});   // a walking ant's feelers sweep and its gaster and head sway against the tripods
    if(w > .01) c.spec(c.Ta, {carryShow:c.crew && !c.crew.m.crumb ? 0 : w, mandCloseR:.45 * w, mandCloseL:.45 * w, scapeAddR:.3 * w, scapeAddL:.3 * w, pedFlexR:.35 * w, pedFlexL:.35 * w, headRaise:.35 * w, gasterCurl:.3 * w});
  },
  postureHold(c, w, Ta){
    c.spec(Ta, {carryShow:c.crew && !c.crew.m.crumb ? 0 : w.carry, mandCloseR:.45 * w.carry, mandCloseL:.45 * w.carry, scapeAddR:.3 * w.carry + .25 * w.low, scapeAddL:.3 * w.carry + .25 * w.low, pedFlexR:.35 * w.carry + .2 * w.low + .25 * w.tend, pedFlexL:.35 * w.carry + .2 * w.low + .25 * w.tend, gasterCurl:.35 * w.carry + .3 * w.climb,
      headRaise:.35 * w.carry + .9 * w.climb, headLower:.55 * w.low + .25 * w.tend, tendShow:c.crew ? 0 : w.tend, mandOpenR:.14 * w.tend, mandOpenL:.14 * w.tend, scapeAbdR:.3 * w.climb + .3 * w.tend, scapeAbdL:.3 * w.climb + .3 * w.tend});
  },
  post(c, rot, sx, sy, now, dt){
    const hs = 1 + .06 * (c.act('headRaise') - c.act('headLower')), gc = c.act('gasterCurl'); c.scale('head', hs, hs); c.scale('gaster', 1 - .2 * gc, 1 + .05 * gc);
    if(c.gait) for(let k = 0; k < 6; k++) if(!c.gait.stance[k]){ const q = c.gs.legs[k].p, f = 1 + .12 * Math.sin(Math.PI * clamp(q)); c.scale('f' + LEGS[k].tag, f, f); }   // a lifted foot is nearer the eye
  },
  colour:(c, i, col) => { const P = c.d.parts[c.d.PPART[i]]; return P.tags.has('larva') ? K.mixInt(col, c.C.bone, .5) : col; },
  colourLive(c, now){ const st = world(c); drawWorld(c, st, now); groundDraw(c, st); },
  life:{rate:1.6, small:[['snap', 1.2, 7000, ['stand', 'low', 'tend', 'climb']], ['tap', 1.3, 6000, ['stand', 'low']], ['antennaFlick', 2, 4000], ['headScan', 1.8, 5000], ['mouthWork', 1.2, 6000], ['groom', 1.1, 14000, ['stand', 'low']],
      ['layTrail', 1.8, 9000, ['stand']], ['followTrail', 1.4, 18000, ['stand']], ['lost', .5, 40000, ['stand']], ['recruit', 1, 18000], ['haul', 1.1, 28000, ['stand']], ['groupCarry', .6, 46000, ['stand']], ['clear', .8, 36000, ['stand']], ['tendBrood', 1.3, 12000, ['tend']], ['alarm', .6, 24000, ['stand', 'low']], ['climbReach', 1.2, 8000, ['climb']], ['mill', .2, 120000, ['stand']]],
    moves:[['go:low', .7, 15000, ['stand']], ['go:stand', 1.4, 0, ['low', 'carry', 'tend', 'climb']], ['go:tend', .6, 22000, ['stand']], ['go:climb', .4, 30000, ['stand']], ['go:carry', .3, 30000, ['stand']], ['walk', 1, 12000, ['stand']], ['run', .5, 22000, ['stand']], ['turnLeft', .4, 30000, ['stand']], ['turnRight', .4, 30000, ['stand']], ['goEntrance', .3, 60000, ['stand']], ['goField', .3, 60000, ['stand']]],
    dwell:{stand:[2600, 5200], low:[3000, 5600], carry:[3000, 5200], tend:[3200, 5600], climb:[3000, 5000]}, gait:[['antennaFlick', 2, 4000], ['headScan', 1.4, 6000], ['layTrail', 1.6, 9000]], gaitFor:{walk:[3000, 6000], run:[2000, 4000], creep:[2600, 4600], carryWalk:[3000, 5000]}},
  audit:{allow:{deadParts:['^larva']}},   // the larva lies on the ground ahead of the jaws, a prop that stays with the body: its nearest drawn bone is an antenna's tip, which is no bone of its own (notes, round 3)
});
for(const D of DEF.IKD){ D.a[1] = D.a[0] + K.wrapA(D.a[1] - D.a[0]); D.a[2] = D.a[1] + K.wrapA(D.a[2] - D.a[1]); }   // the angles between a leg's bones on one branch (the kit's difference of atan2s breaks at the +-pi seam)
DEF.crewTools = {setGait, halt, settled, sweep, modeOf, bearing, STEERING, P, CX, CY};   // for the crew's gestures (crew-ant.js)
K.define(DEF);
})();
