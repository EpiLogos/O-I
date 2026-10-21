/* creature-fishes.js — the Fishes (Pisces ♓): two fish tied by a cord, on creature-kit.js and creature-swim.js. The design is in CREATURE-NOTES-FISHES.md (read section 2 first).
   The pair is one fish and its half-turn: fish B is fish A turned half a turn about the cord's midpoint, so the two swim in opposite directions with their bellies to the cord, and the sign ♓ is
   what that symmetry looks like with its axis upright. The sign is built into the animals: each fish's lateral line is an arc, the cord (with a gold band across each fish's girth) is the bar,
   the knot at the cord's middle is its centre; the travelling light is a ripple that spreads from the knot.
   Everything that moves is a body in the water (creature-swim.js): each fish is a planar body with thrust that is its tail's beat, a wave that grows toward the tail, solved recoil, and a controller
   that steers it to a slot; the cord is a rope with a stiff tension on the fish. The postures are formations: where the two fish are and which way they face, in the pair's frame, which turns
   (Θ). The kit's edges and routing blend the formation's numbers; the fish swim to follow them, so no transition is a slide.
   Facing: each fish drawn straight at rest (A heading up on the left, B down on the right: the sign). The canvas 1000 by 780. */
(() => {
'use strict';
const K = window.CreatureKit, S = window.CreatureSwim; K.require('1.1.0', 'creature-fishes'); S.require('1.0.0', 'creature-fishes');
const {env, keys, pulse} = K, cl = v => Math.max(-1, Math.min(1, v)), pos = v => Math.max(0, v), U = S.util, TAU = Math.PI * 2, PI = Math.PI;
const L = 300, ELL = 170, C0 = [500, 390], BELLY = .10 * L, PAIR_R = .5;   // the fish's length, the cord's length (tie to tie), the pair's centre, the belly's depth at the girth
const M = K.model({id:'fishes', name:'Fishes', sign:'♓', title:'FISHES', sub:'Pisces · two fish tied by a cord', w:1000, h:780, pivot:[500, 390], axis:500, yawC:500, ink:K.ROSTER.lapis, accent:K.ROSTER.amber, cam:[.7, 500, 390]});
M.bone('world', null, [500, 390], [510, 390], {grp:'root'});
const FA = S.fish(M, {prefix:'A', cx:C0[0] - ELL / 2 - BELLY, cy:C0[1], L, parent:'world', layer:7.5, rot:-PI / 2});
const FB = S.fish(M, {prefix:'B', cx:C0[0] + ELL / 2 + BELLY, cy:C0[1], L, parent:'world', layer:3.5, rot:PI / 2});
S.fishMuscles(M, FA); S.fishMuscles(M, FB);
/* the cord: fourteen bones from A's tie to B's, a strip over them, a bead at the middle (the knot, Alrescha) */
const TA = FA.tieRest, TB = FB.tieRest, CORD = M.chain('cord', Array.from({length:15}, (_, i) => [TA[0] + (TB[0] - TA[0]) * i / 14, TA[1] + (TB[1] - TA[1]) * i / 14]), 14, {parent:'world', grp:'cord', lim:[-3.4, 3.4], sec:false, speed:8});
M.limb('cord', Array.from({length:8}, (_, i) => [TA[0] + (TB[0] - TA[0]) * i / 7, TA[1] + (TB[1] - TA[1]) * i / 7, 2.8, 2.8]), {layer:3, tier:'F', h:7, cols:1, bind:{chain:CORD, sigma:5}, zone:'glyph', ink:'gold', line:'glyph', tone:(x, y, i) => i & 1 ? .95 : .6, noSil:true, tags:['glyph', 'cord']});
M.polar('knot', [(TA[0] + TB[0]) / 2, TA[1]], [3.6, 8.2], [8, 8], {layer:3.2, tier:'F', bind:{chain:[CORD[6], CORD[7]], sigma:4}, zone:'glyph', ink:'gold', line:'glyph', tone:.98, noSil:true, tags:['glyph', 'knot']});
M.posture('sign', {cam:[.7, 500, 390]});
M.posture('lying', {cam:[.7, 500, 390]});
M.posture('close', {cam:[.7, 500, 390]});
M.posture('classic', {cam:[.7, 500, 395]});
M.posture('ring', {cam:[.7, 500, 390]});
for(const [a, b, ms] of [['sign', 'lying', 4200], ['sign', 'close', 3400], ['sign', 'classic', 4600], ['sign', 'ring', 3600], ['lying', 'close', 3400], ['lying', 'classic', 4200], ['lying', 'ring', 3600], ['close', 'classic', 4200], ['close', 'ring', 3600], ['classic', 'ring', 4200]]) M.edge(a + '>' + b, {ms, g:{}, c:{}});

/* ---------- the formations ----------
   A formation is a pair of headings (hA, hB, at Θ = 0), the direction from A's tie to B's (phi), the distance between the ties (dt, as a share of the cord), the pair's angle it holds (th, mod per; per 0
   means free), how fast it turns (om, rad/s) and the static bend each fish holds (bend, rad; the belly's side is positive). The pair's frame is turned by Θ, which a formation holds or spins. */
const FORM = {
  sign:   {hA:-PI / 2, hB:PI / 2, phi:0,       dt:1,      th:0,      per:PI,  om:0,   bend:-.95},
  lying:  {hA:-PI / 2, hB:PI / 2, phi:0,       dt:1,      th:PI / 2, per:PI,  om:0,   bend:-.95},
  close:  {hA:-PI / 2, hB:PI / 2, phi:0,       dt:.56, th:0,      per:PI,  om:0,   bend:-.5},
  classic:{hA:-PI / 2, hB:PI,     phi:.62,     dt:.95, th:0,      per:TAU, om:0,   bend:-.3},
  ring:   {hA:-PI / 2, hB:PI / 2, phi:0,       dt:1.012,  th:null,   per:0,    om:.9,  bend:0},
};
const FN = Object.keys(FORM), nrm = a => Math.atan2(Math.sin(a), Math.cos(a)), wrapP = (a, p) => a - p * Math.round(a / p - 1e-6);   // (a tie turns the positive way)
/* the blended formation from the posture weights w (angles blended as vectors) */
function formation(w, pad){
  let sA = 0, cA = 0, sB = 0, cB = 0, sP = 0, cP = 0, dt = 0, om = 0, bend = 0, tot = 0; const hold = [];
  for(const n of FN){ const q = w[n] || 0; if(q < .001) continue; const f = FORM[n]; tot += q; sA += q * Math.sin(f.hA); cA += q * Math.cos(f.hA); sB += q * Math.sin(f.hB); cB += q * Math.cos(f.hB); sP += q * Math.sin(f.phi); cP += q * Math.cos(f.phi); dt += q * f.dt; om += q * f.om; bend += q * f.bend; hold.push([q, f]); }
  if(!tot) return null;
  return {hA:Math.atan2(sA, cA), hB:Math.atan2(sB, cB), phi:Math.atan2(sP, cP), dt:dt / tot * (pad.dt ?? 1), om:om / tot, bend:bend / tot, hold, tot};
}
/* the fish's slot for a formation turned by theta about C: the tie is put on the line at its end, and the centre of mass is the tie's belly-width back along the fish's own side */
function slots(fm, th, rt, fish, ln = ELL){
  const ph = fm.phi + th + rt, ex = Math.cos(ph), ey = Math.sin(ph), half = fm.dt * ln / 2, out = [];
  for(const [k, h, sg, q] of [['A', fm.hA, -1, 0], ['B', fm.hB, 1, 1]]){
    const psi = h + th, A = S.axes(psi), tx = C0[0] + sg * half * ex, ty = C0[1] + sg * half * ey, T0 = fish[q].P.tie[0] * L, BL = -fish[q].P.tie[1] * L, x = tx - A.fx * T0 + A.lx * BL, y = ty - A.fy * T0 + A.ly * BL;   // the tie is BELLY on the belly's side (-left) and a little ahead of the centre of mass
    out.push({x, y, psi, tie:[tx, ty], vx:0, vy:0, w:fm.om});
  }
  if(fm.om) for(const sl of out){ sl.vx = -fm.om * (sl.y - C0[1]); sl.vy = fm.om * (sl.x - C0[0]); }
  return out;
}

/* ---------- pads ---------- */
M.pad('pair', {label:'Pair', group:'Pair', x:['left', 'right'], y:['close', 'taut'], fx:(c, x, y) => { const s = sw(c); s.padTh = x * PI; s.padDt = 1 + (y < 0 ? y * .45 : y * 0); }, alwaysFx:true, ghost:c => [cl(sw(c).padTh / PI), cl(-(1 - (sw(c).padDt ?? 1)) / .45)]});
M.pad('swim', {label:'Swim', group:'Fish', split:'LR', splitLabel:'A·B', x:['hover', 'sprint'], y:['coast', 'beat'], fx:(c, x, y, b) => { const s = sw(c); s.padThr = [pos(x) * 1.1, pos(b[0]) * 1.1]; s.padBeat = [y, b[1]]; }, alwaysFx:true, ghost:(c, k) => [cl(sw(c).fish[k ? 1 : 0].sT / (1.3 * L)), cl(sw(c).fish[k ? 1 : 0].f / 2)]});
M.pad('bend', {label:'Bend', group:'Fish', split:'LR', splitLabel:'A·B', x:['belly in', 'back in'], y:['stiff', 'supple'], fx:(c, x, y, b) => { const s = sw(c); s.padBend = [-x * 1.2, -b[0] * 1.2]; }, alwaysFx:true, ghost:(c, k) => [cl(-sw(c).bend[k ? 1 : 0] / 1.2), 0]});
M.pad('mouth', {label:'Mouth and gills', group:'Head', split:'LR', splitLabel:'A·B', x:['shut', 'wide'], y:['still', 'pump'], fx:(c, x, y, b) => { for(const [k, p, v] of [['A', 'A', [x, y]], ['B', 'B', b]]) c.spec(c.Tp, {[k + 'jawDrop']:pos(v[0]), [k + 'jawShut']:pos(-v[0]), [k + 'opOpen']:pos(v[0]) * .5 + pos(v[1]), [k + 'opShut']:pos(-v[1])}); }, ghost:(c, k) => [cl(c.act((k ? 'B' : 'A') + 'jawDrop')), cl(c.act((k ? 'B' : 'A') + 'opOpen'))]});
M.pad('fins', {label:'Fins', group:'Fins', split:'LR', splitLabel:'A·B', x:['fold', 'spread'], y:['back', 'forward'], fx:(c, x, y, b) => { for(const [k, v] of [['A', [x, y]], ['B', b]]) c.spec(c.Tp, {[k + 'pecProt']:pos(v[1]) + pos(v[0]) * .5, [k + 'pecRet']:pos(-v[1]), [k + 'dorUp']:pos(v[0]), [k + 'dorDown']:pos(-v[0]), [k + 'cauSpread']:pos(v[0]), [k + 'cauClose']:pos(-v[0]), [k + 'pelProt']:pos(v[0]) * .6, [k + 'anDown']:pos(v[0]) * .6}); }, ghost:(c, k) => [cl(c.act((k ? 'B' : 'A') + 'dorUp') - c.act((k ? 'B' : 'A') + 'dorDown')), cl(c.act((k ? 'B' : 'A') + 'pecProt') - c.act((k ? 'B' : 'A') + 'pecRet'))]});
M.pad('cord', {label:'Cord', group:'Pair', x:['short', 'long'], y:['still water', 'current'], fx:(c, x, y) => { const s = sw(c); s.padLen = 1 + x * .22; s.padDrag = 2.4 * (1 + Math.max(0, y) * 2.2 - Math.max(0, -y) * .5); }, alwaysFx:true, ghost:c => [cl((sw(c).len - 1) / .22), 0]});
const sw = c => (c.sw && c.sw.fr <= c.frames) ? c.sw : init(c);   // (a reset of the figure starts the water over)

/* ---------- actions ---------- */
/* bubbles from the mouth of the fish an action is for, once, at time `at` into it */
const bubbles = (c, a, t, at, n) => { if(t < at || a.bub) return; a.bub = 1; const s = sw(c), k = pick(c, a) === 'A' ? 0 : 1, m = S.mouthOf(c, k ? FB : FA); if(s.water) s.water.emit(m[0], m[1], n, s.fish[k].vx, s.fish[k].vy); };
const pick = (c, a) => a.fish || (a.fish = c.rand() < .5 ? 'A' : 'B');
const SP = (c, a, id) => pick(c, a) + id;
M.action('gulp', {label:'Gulp', group:'Head', dur:900, big:true, f:(t, T, c, a) => { bubbles(c, a, t, 380, 2); c.spec(T, {[SP(c, a, 'jawDrop')]:1.0 * env(t, 120, 260, 360), [SP(c, a, 'opOpen')]:1.1 * env(t, 100, 300, 400)}); }});
M.action('cough', {label:'Cough (clear the gills)', group:'Head', dur:700, big:true, f:(t, T, c, a) => { bubbles(c, a, t, 150, 5); c.spec(T, {[SP(c, a, 'jawDrop')]:.7 * pulse(t, 0, 80, 60, 300), [SP(c, a, 'opOpen')]:1.6 * pulse(t, 40, 120, 80, 340), [SP(c, a, 'dorUp')]:.6 * env(t, 30, 200, 300)}); }});
M.action('yawn', {label:'Yawn', group:'Head', dur:2600, big:true, f:(t, T, c, a) => { bubbles(c, a, t, 1500, 4); const o = keys(t, [[0, 0], [500, .35], [1100, 1], [1700, 1], [2400, 0]]); c.spec(T, {[SP(c, a, 'jawDrop')]:.95 * o, [SP(c, a, 'opOpen')]:1.4 * o, [SP(c, a, 'pecProt')]:.4 * o}); }});
M.action('flare', {label:'Flare the fins', group:'Fins', dur:2200, f:(t, T, c, a) => { const e = env(t, 300, 1300, 600), k = pick(c, a); c.spec(T, {[k + 'dorUp']:e, [k + 'pecProt']:.9 * e, [k + 'pelProt']:.8 * e, [k + 'cauSpread']:.8 * e, [k + 'anDown']:.7 * e}); }});
M.action('flick', {label:'Flick the dorsal fin', group:'Fins', dur:900, f:(t, T, c, a) => c.spec(T, {[SP(c, a, 'dorUp')]:.9 * pulse(t, 0, 100, 80, 360), [SP(c, a, 'dorDown')]:.5 * pulse(t, 320, 90, 70, 300)})});
M.action('dart', {label:'Dart (the other is yanked)', group:'Body', dur:1400, big:true, f:(t, T, c, a) => { if(!a.fired){ a.fired = 1; const k = pick(c, a); sw(c).burst[k === 'A' ? 0 : 1] = {t0:c.t, dur:900, to:1.4 * L}; } }});
M.action('glyph', {label:'Sign', group:'Behaviour', dur:100, f:(t, T, c) => { if(t < 50) c.glyph(3200); return false; }});

/* ---------- the simulation: the two fish, the cord, the pair's frame ---------- */
function init(c){
  const d = c.d, s = {fish:null, R:[S.bind(c, FA), S.bind(c, FB)], th:0, rt:0, padTh:0, padDt:1, padThr:[0, 0], padBeat:[0, 0], padBend:[0, 0], padLen:1, padDrag:2.4, len:1, bend:[0, 0], burst:[null, null], tie:[[0, 0], [0, 0]], rope:null, slot:null, bounds:{x0:C0[0] - 350, y0:C0[1] - 273, x1:C0[0] + 350, y1:C0[1] + 273}, last:-1};
  const w0 = {sign:1}, fm = formation(w0, {}), fz = [S.newFish({L}), S.newFish({L, phi:1.7})], sl = slots(fm, 0, 0, fz);
  fz[0].x = sl[0].x; fz[0].y = sl[0].y; fz[0].psi = fz[0].psiC = sl[0].psi; fz[1].x = sl[1].x; fz[1].y = sl[1].y; fz[1].psi = fz[1].psiC = sl[1].psi; s.fish = fz;
  s.slot = sl;
  s.rope = S.newRope(sl[0].tie[0], sl[0].tie[1], sl[1].tie[0], sl[1].tie[1], ELL, 14);
  s.fish[0].hold = s.fish[1].hold = true;
  s.fr = c.frames; s.water = null; c.sw = s; return s;
}
/* the controller and the water, before the muscles' springs */
function frame(c, now, Ti, dt){
  const s = sw(c); s.fr = c.frames; const h = Math.min(dt, 80) / 1000, A = s.fish[0], B = s.fish[1], w = c.postureW(), fm = formation(w, {dt:s.padDt});
  if(!(h > 0) || !fm) return;
  /* the pair's frame: turned at the formation's rate, and drawn to the angle a formation holds (the nearest of its equivalents) */
  let dth = fm.om, kh = 0;
  for(const [q, f] of fm.hold){ if(f.per){ dth += q * 1.1 * wrapP(f.th - s.th, f.per); kh += q; } }
  s.th += dth * h; if(s.th > PI || s.th < -PI) s.th = wrapP(s.th, TAU);
  s.len += (s.padLen - s.len) * Math.min(1, h * 3); const ln = ELL * s.len;
  s.slot = slots(fm, s.th + s.padTh, 0, s.fish, ln);
  /* the fish steered, the burst, the water */
  for(let k = 0; k < 2; k++){
    const F = s.fish[k]; S.steer(F, s.slot[k], {bounds:s.bounds, others:[s.fish[1 - k]], avoidR:PAIR_R, wall:.3});
    const b = s.burst[k]; if(b){ const u = (c.t - b.t0) / b.dur; if(u < 1) F.sT = Math.max(F.sT, b.to * Math.sin(PI * Math.min(1, u * 1.15))); else s.burst[k] = null; }
    if(s.padThr[k] > .02) F.sT = Math.max(F.sT, s.padThr[k] * L);   // the Swim pad: a floor under the thrust (sprint), a held beat (against the cord), or a coast
    if(s.padBeat[k] > .05) F.sT = Math.max(F.sT, s.padBeat[k] * .8 * L); else if(s.padBeat[k] < -.3) F.sT = Math.min(F.sT, 0);
  }
  S.stepPair(A, B, h, ln);
  /* the shape: the turn's bend (the body lies on its path) and the formation's own (hanging from the cord, or none) */
  for(let k = 0; k < 2; k++){
    const F = s.fish[k], tb = S.turnBend(F), blend = clamp01(F.spd / (.3 * L));
    const bend = s.bend[k] = U.clamp(tb + fm.bend * (1 - .7 * blend) * (k ? 1 : 1) + s.padBend[k], -1.9, 1.9);
    S.drive(c, s.R[k], F, Ti, bend);
  }
  /* breath: each fish pumps its gills at its own rate (the mouth a little ahead), the fins sculling; hovering fish scull more */
  for(let k = 0; k < 2; k++){
    const F = s.fish[k], p = k ? 'B' : 'A', br = .5 + .5 * Math.sin(now * (.0068 + .0007 * k) * c.breath.rate + 1 + 2 * k), pump = (.16 + .34 * br) * c.breath.depth, hov = Math.max(F.hov || 0, 1 - clamp01(F.spd / (.25 * L)) * 0);
    c.spec(Ti, {[p + 'opOpen']:pump, [p + 'jawDrop']:.12 * br, [p + 'dorUp']:.15 + .1 * Math.sin(now * (.0009 + .0002 * k)), [p + 'pecProt']:(.12 + .25 * hov * (.5 + .5 * Math.sin(now * .004 + k))) + .3 * pos(-F.sT / (.3 * L)), [p + 'pecRet']:.1 * Math.sin(now * .0021 + 3 * k)});
  }
  /* the cord: fixed to the ties as drawn last frame; its length and the water's drag come from the pads */
  s.rope.rest = (ln - 4) / 14; s.rope.drag = s.padDrag;   // the drawn cord is 4 units shorter than the one that pulls: a taut pair shows a straight bar, not the jitter of the ties
}
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
/* after the muscles: each fish into the world, the ties, the rope between them, the cord's bones */
function post(c, rot, sx, sy, now, dt){
  const s = c.sw; if(!s) return; const h = Math.min(dt, 80);
  s.tie[0] = S.place(c, s.R[0], s.fish[0], rot, sx, sy, h); s.tie[1] = S.place(c, s.R[1], s.fish[1], rot, sx, sy, h);
  S.stepRope(s.rope, s.tie[0][0], s.tie[0][1], s.tie[1][0], s.tie[1][1], h / 1000);
  if(!s.water && c.svg) s.water = S.water(c); if(s.water) s.water.step(h, s.fish);
  S.laySpine(c, CORD, s.rope, rot, sx, sy);
}

K.define(M.finish({
  pair:{ell:ELL, length:L},   // the tests read the cord's length from here
  audit:{allow:{deadParts:['^[AB]ring$']}},   // the tie ring sits on the cord's end by design
  idle:frame, post,
  /* the sign's light: a ripple from the knot, out along the cord, across each girth, then both ways along each lateral line to the head and the tail */
  glyph(x, y, P){
    const n = P.name;
    if(n === 'knot') return [0, 1];
    if(n === 'cord') return [Math.min(.3, Math.abs(x - 500) / ((TB[0] - TA[0]) / 2) * .3), 1];
    const F = n[0] === 'A' ? FA : n[0] === 'B' ? FB : null; if(!F) return null;
    const q = F.unrot(x, y), body = n.slice(1);
    if(body === 'ring') return [.3, 1];
    if(body === 'girth') return [.3 + .07 * clamp01((q[1] - (F.cy + F.hv(.4) * L)) / (-(F.hd(.4) + F.hv(.4)) * L)), 1];
    if(body === 'lateral') { const sb = .4 - (q[0] - F.cx) / L; return [.38 + .62 * clamp01(Math.abs(sb - .4) / .56), 1]; }
    return null;
  },
  life:{rate:1.5, small:[['gulp', 2, 6000], ['cough', .6, 25000], ['yawn', .5, 30000], ['flare', 1, 16000], ['flick', 2, 7000], ['dart', .5, 30000], ['glyph', 1.2, 14000]],
    moves:[['go:lying', 1, 0, ['sign', 'close', 'classic', 'ring']], ['go:classic', 1, 0, ['sign', 'lying', 'close', 'ring']], ['go:ring', 1, 0, ['sign', 'lying', 'close', 'classic']], ['go:sign', 1.4, 0, ['lying', 'close', 'classic', 'ring']], ['go:close', .7, 0, ['sign', 'lying', 'classic', 'ring']]],
    dwell:{sign:[9000, 15000], lying:[8000, 14000], close:[7000, 12000], classic:[8000, 14000], ring:[12000, 20000]}},
}));
})();
