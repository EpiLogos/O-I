/* creature-ring.js: the model of a body eating its own tail (an ouroboros). Engine-free: no DOM, no knowledge of any mesh. window.CreatureRing,
   and module.exports when loaded by node (tools/creature-ring-test.mjs tests it there). VERSION and CHANGELOG are below.

   WHAT IT MODELS
   A long body whose jaws close on its own tail and take it in a gulp at a time, working a large meal: each gulp opens the jaws, walks them
   forward over a short length of the tail, closes them, and sends a lump of the swallowed length down the throat and into the body. The tail
   is the thin end, so the thinning body goes in first and the throat has to open further and further. Gulps grow smaller and the pauses
   between them longer as the thick body arrives, and the whole business takes 40 to 60 s at tempo 1 whatever the number of gulps. It can
   stop at any stage and hold, run on to a very small ring, and run backwards (release): the same gulps played the other way, faster, with
   the lump coming back up the throat and the jaws opening as the tail slides out. The model is one time law, so a release from any stage
   retraces the swallow that reached it exactly.

   WHAT EACH CALLER MUST SUPPLY (create(o))
     length      the body's full length, px
     headLength  the head's length, px (the throat's first stretch, and the size of a gulp's scale)
     minLength   the shortest visible length that stays, head included: the swallow stops when this is all that is left. The caller knows
                 what its body can bend into (its tightest bend, its thickest part), so it says; creature-body.js works it out from its
                 profile and its clamp. The swallowed length at the end is length - minLength - start.
     halfWidth   optional: s => half-width of the body at the station s px from the snout (the tail's thickness profile). Without it, a
                 linear taper from tipWidth to the body's width is assumed.
     tipWidth    optional, default 1: the tail tip's half-width
     bodyWidth   optional, default 16: the widest half-width
     start       the length already in the mouth at the start of the ring, px (default 0)
     duration    ms to swallow everything at tempo 1 (default 48000)
     seed        optional number: varies gulp sizes a little, repeatably
   WHAT IT GIVES BACK
     model.state(tau) -> {v, gape, lumps:[{pos, amp, w, born}], gulp, phase, ringLength, fraction, gulpAt:[t...]}
       v          swallowed length, px (start .. start + vmax), monotone in tau
       gape       0..1: how far the jaws are open (1 is as wide as the head can). The jaws hold the tail between gulps at a width that
                  follows its thickness, open wider to take each gulp, and close to the hold again
       lumps      the lumps in transit (px from the mouth along the body, amplitude 0..1 of the swallowed thickness, width px)
       ringLength the body left outside (length - v): the ring's circumference less whatever the caller adds for its own head
       fraction   v's share of its range, 0..1
       gulp       the index of the gulp in progress, phase 0..1 within it
     model.tauOf(v) the time position at which the swallowed length is v (resume from a stage); model.duration; model.gulps (their times
     and lengths); model.vmax
     model.controller({maxSpeed, maxAccel, releaseRate}) -> {swallow(), release(fast), hold(), toFraction(f), setFraction(f), step(dtMs), state, tau,
       mode, atStart, atEnd, settled, tempo}: runs tau forward, back or still, smoothly (the rate eases, so a stop or a reversal never jerks), at the
       tempo; maxSpeed (px/s, optional) bounds how fast the swallowed length may change, so a fast release cannot shoot the tail out; maxAccel
       (px/s², optional) bounds how fast that speed may change, so the tail never starts or stops sliding in one frame (state.v then lags the
       law's own, state.lawV, by a few px, and settled says when they agree).
   TEMPO is a multiplier on the controller's clock; the model's own times are at tempo 1. */
(function(root){
'use strict';
const VERSION = '1.1.0';
const CHANGELOG = [
  {date:'2026-10-19', version:'1.1.0', what:'controller({maxAccel}): the swallowed length given out (state.v) follows the time law\'s with its speed changing by at most maxAccel px/s², and slows in time to stop where the law stops. With maxSpeed alone a quick release went from still to full speed in one frame at every gulp. state.lawV is the law\'s own; settled says the two agree. Without maxAccel nothing changes.'},
  {date:'2026-10-16', version:'1.0.0', what:'First version, for the serpent (creature-body.js 2.0.0): one time law for swallow and release; gulps shrink and slow toward the end; 48 s at tempo 1 whatever the gulp count; lumps; holds and resumes at any stage.'},
];
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const s5 = u => { u = clamp(u); return u * u * u * (10 - 15 * u + 6 * u * u); };
/* the pace of the swallow along its own clock: fast at first, slowing toward the end like a snake working a large meal */
const PACE = 1.8;
const progress = x => 1 - Math.pow(1 - clamp(x), PACE);      // the share swallowed after the share x of the time
const progressInv = u => 1 - Math.pow(1 - clamp(u), 1 / PACE);
function hashf(i){ let h = Math.imul((i >>> 0) + 1, 2654435761) >>> 0; h ^= h >>> 15; return (Math.imul(h, 2246822519) >>> 0) / 4294967296; }

function create(o){
  if(!(o && o.length > 0 && o.headLength > 0 && o.minLength > 0)) throw new Error('CreatureRing.create needs length, headLength and minLength');
  const L = o.length, HL = o.headLength, start = o.start || 0, T = o.duration || 48000, seed = o.seed || 0;
  const vmax = Math.max(1, L - o.minLength - start);
  const tip = o.tipWidth ?? 1, wide = o.bodyWidth ?? 16;
  const hw = o.halfWidth || (s => tip + (wide - tip) * clamp(1 - (s / L - .25) / .75));   // a plain taper, tip to trunk, if the caller gives none
  const d0 = o.gulp ?? Math.max(10, .032 * L);   // the first gulp's length
  /* the gulps: boundaries in swallowed length, each gulp shorter than the last; their times are read off the pace law, so the total is T */
  const gulps = []; let v = 0, k = 0;
  while(v < vmax - 1e-6){
    const u = v / vmax, jit = 1 + .12 * (hashf(k * 7 + seed * 131) - .5);
    let dv = d0 * (1 - .5 * u) * jit; if(vmax - v - dv < .35 * dv) dv = vmax - v;   // no sliver of a gulp at the end
    dv = Math.min(dv, vmax - v);
    gulps.push({v0:v, v1:v + dv, t0:T * progressInv(v / vmax), t1:T * progressInv((v + dv) / vmax)}); v += dv; k++;
  }
  const lastG = gulps[gulps.length - 1]; lastG.t1 = T; lastG.v1 = vmax;
  /* the throat: the swallowed length's thickness at the mouth sets how far the jaws must open */
  const need = s => clamp(hw(s) / Math.max(1, wide));                        // 0..1: the thickness of the part now entering
  const holdG = n => .16 + .34 * n;                                           // the jaws' hold on the tail between gulps
  const openG = n => Math.min(1, .5 + .55 * n);                               // and how wide they open to take a gulp
  const LUMP_SPEED = Math.max(60, .11 * L), LUMP_REACH = 4 * HL + 80;         // px/s down the body, and how far the lump is carried before it is part of the body
  function find(tau){ let lo = 0, hi = gulps.length - 1; while(lo < hi){ const m = (lo + hi + 1) >> 1; if(gulps[m].t0 <= tau) lo = m; else hi = m - 1; } return lo; }
  /* swallowed length at tau: inside a gulp it advances in its middle third (the jaws walk forward), eased */
  function vAt(tau){
    tau = clamp(tau, 0, T); const i = find(tau), g = gulps[i], d = g.t1 - g.t0, p = d > 0 ? (tau - g.t0) / d : 1;
    const a = s5((p - .22) / .42);   // 0 until the jaws are open, 1 by the time they start to close
    return g.v0 + (g.v1 - g.v0) * a;
  }
  /* the time position at which the swallowed length is v (the end of its gulp's advance, reached from the left) */
  function tauOf(vv){
    vv = clamp(vv, 0, vmax); if(vv <= 0) return 0; if(vv >= vmax) return T;
    let i = 0; while(i < gulps.length - 1 && gulps[i].v1 < vv) i++;
    const g = gulps[i], a = (vv - g.v0) / Math.max(1e-9, g.v1 - g.v0);
    let lo = 0, hi = 1; for(let q = 0; q < 30; q++){ const m = (lo + hi) / 2; if(s5(m) < a) lo = m; else hi = m; }
    return g.t0 + (g.t1 - g.t0) * clamp(.22 + .42 * lo);
  }
  function state(tau){
    tau = clamp(tau, 0, T); const i = find(tau), g = gulps[i], d = Math.max(1, g.t1 - g.t0), p = (tau - g.t0) / d, vv = vAt(tau);
    const n = need(L - (start + vv));        // the thickness of the tail now at the mouth (station L - swallowed)
    const hold = holdG(n), open = openG(n);
    /* the jaws: at their hold, open for the gulp, close back */
    const gape = hold + (open - hold) * (sstep(.02, .24, p) * (1 - sstep(.62, .84, p)));
    /* the lumps: this gulp's, and the previous gulps' still on their way, down the throat and into the body, fading as they spread */
    const lumps = [];
    for(let j = Math.max(0, i - 3); j <= i; j++){
      const gj = gulps[j], dj = Math.max(1, gj.t1 - gj.t0), born = gj.t0 + dj * .5, age = (tau - born) / 1000;
      if(age < 0) continue; const reach = age * LUMP_SPEED; if(reach > LUMP_REACH * 1.15) continue;
      const nj = need(L - (start + gj.v1)), size = clamp((gj.v1 - gj.v0) / d0);
      lumps.push({pos:HL * .15 + reach, amp:(.3 + .7 * nj) * (.55 + .45 * size) * sstep(0, .12, age) * (1 - sstep(.55 * LUMP_REACH / LUMP_SPEED, 1.15 * LUMP_REACH / LUMP_SPEED, age)), w:HL * (.32 + .22 * nj), born, gulp:j});
    }
    return {v:start + vv, gape, lumps, gulp:i, phase:clamp(p), ringLength:L - start - vv, fraction:vv / vmax};
  }
  const model = {VERSION, length:L, headLength:HL, vmax, start, duration:T, gulps, state, tauOf, vAt, hold:holdG, open:openG, need, lumpSpeed:LUMP_SPEED, lumpReach:LUMP_REACH,
    gulpTimes:() => gulps.map(g => g.t0)};
  /* the controller: tau forward at 1 (swallow), still (hold), backward at RELEASE (release); the rate eases so nothing starts or stops with a jerk */
  model.controller = (c = {}) => {
    const RELEASE = c.releaseRate ?? 2.4;
    const ct = {tau:c.tau ?? 0, rate:0, want:0, mode:'hold', tempo:1, target:null, state:null, onEnd:null, vs:null, vv:0};
    /* the swallowed length given out: the law's, or (maxAccel) a follower of it whose speed changes by at most maxAccel and which slows in time to
       stop where the law's stops (its speed toward the law is at most what it could still shed over the distance left) */
    const follow = dt => {
      const law = ct.state.v; ct.state.lawV = law; if(!c.maxAccel) return;
      if(ct.vs == null || dt <= 0){ if(ct.vs == null){ ct.vs = law; ct.vv = 0; } ct.state.v = ct.vs; return; }
      const A = c.maxAccel, err = law - ct.vs, want = Math.sign(err) * Math.min(c.maxSpeed || Infinity, .9 * Math.sqrt(2 * A * Math.abs(err)), 14 * Math.abs(err));
      ct.vv += clamp(want - ct.vv, -A * dt, A * dt); ct.vs += ct.vv * dt;
      if(Math.abs(law - ct.vs) < .05 && Math.abs(ct.vv) < 2){ ct.vs = law; ct.vv = 0; }
      ct.state.v = ct.vs; ct.state.ringLength = L - ct.vs;
    };
    const refresh = (dt = 0) => { ct.state = state(ct.tau); follow(dt); };
    ct.swallow = () => { ct.target = null; ct.mode = 'swallow'; ct.want = 1; };
    ct.release = (fast = 1) => { ct.target = null; ct.mode = 'release'; ct.want = -RELEASE * fast; };
    ct.hold = () => { ct.target = null; ct.mode = 'hold'; ct.want = 0; };
    ct.toFraction = f => { ct.target = tauOf(clamp(f) * vmax); ct.mode = 'goto'; };
    ct.setFraction = f => { ct.tau = tauOf(clamp(f) * vmax); ct.rate = 0; ct.want = 0; ct.mode = 'hold'; ct.target = null; ct.vs = null; refresh(); };
    ct.reset = () => { ct.tau = 0; ct.rate = 0; ct.want = 0; ct.mode = 'hold'; ct.target = null; ct.vs = null; refresh(); };
    ct.step = ms => {
      const dt = Math.max(0, ms) / 1000 * ct.tempo;
      if(ct.mode === 'goto' && ct.target != null){
        const err = ct.target - ct.tau, fast = Math.min(T * .08, Math.abs(err) * 1.5 + 200);   // ease in, and in again at the end
        ct.want = Math.sign(err) * Math.min(RELEASE, Math.max(.25, fast / 1000 * 3)) * (Math.abs(err) < 30 ? 0 : 1);
        if(Math.abs(err) < 30 && Math.abs(ct.rate) < .05){ ct.mode = 'hold'; ct.want = 0; ct.target = null; }
      }
      ct.rate += (ct.want - ct.rate) * (1 - Math.exp(-3.2 * dt));
      /* the swallowed length never moves faster than maxSpeed (px/s): a quick release must not shoot the tail out of the mouth */
      let dTau = ct.rate * dt * 1000;
      if(c.maxSpeed && dt > 0){ const v0 = vAt(ct.tau), lim = c.maxSpeed * dt, vOf = f => Math.abs(vAt(clamp(ct.tau + dTau * f, 0, T)) - v0); if(vOf(1) > lim){ let lo = 0, hi = 1; for(let q = 0; q < 14; q++){ const mid = (lo + hi) / 2; if(vOf(mid) > lim) hi = mid; else lo = mid; } dTau *= lo; } }   // (v is steepest mid-gulp, so the fraction of the step that fits is found by bisection)
      ct.tau = clamp(ct.tau + dTau, 0, T);
      if(ct.tau <= 0 && ct.rate < 0){ ct.rate = 0; if(ct.mode === 'release') ct.mode = 'hold'; ct.want = 0; }
      if(ct.tau >= T && ct.rate > 0){ ct.rate = 0; if(ct.mode === 'swallow') ct.mode = 'hold'; ct.want = 0; }
      refresh(dt); return ct.state;
    };
    Object.defineProperties(ct, {atStart:{get:() => ct.tau <= 1}, atEnd:{get:() => ct.tau >= T - 1}, fraction:{get:() => ct.state.fraction},
      settled:{get:() => ct.vs == null || ct.vs === ct.state.lawV}});   // (the follower lands on the law's length exactly: it snaps within .05 px)
    refresh(); return ct;
  };
  return model;
}
const api = {VERSION, CHANGELOG, create, progress, progressInv};
if(typeof module !== 'undefined' && module.exports) module.exports = api;
if(typeof window !== 'undefined') window.CreatureRing = api;
})(typeof window !== 'undefined' ? window : globalThis);
