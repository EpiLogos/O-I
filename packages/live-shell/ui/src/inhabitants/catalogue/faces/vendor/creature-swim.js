/* creature-swim.js — CreatureSwim: what the kit does not have for a body that swims. CREATURE-SPEC.md section 14 ("Swimming bodies"); the design is in CREATURE-NOTES-FISHES.md.
   Two halves, so that the physics can be tested without a page:
   1. The SIMULATION (this half, no DOM, no kit): a fish as a planar body in the water, the swim law (the tail's beat is the thrust), the shape of the body as joint angles (a wave
      that grows toward the tail, plus the static bend of a turn), the controller that steers it to a slot, the cord as a rope, and the recoil that makes the body one free animal.
      Units are the page's (canvas units, seconds); a body's length is L and every rate below is in lengths a second.
   2. The MODEL (fish(M, o), further down): the fish's bones, skin, fins and muscles, built into a kit model by one call, so the template and the roster entry share it.
   Exports CreatureSwim. */
(() => {
'use strict';
const root = typeof window !== 'undefined' ? window : globalThis;
const VERSION = '1.0.0';
const CHANGELOG = ['1.0.0 (18 Oct 2026): new. The fish body (bones, skin, fins, muscles), the swim law (speed = 0.8 · wavelength · beat), the steering controller, the rope, the recoil.'];
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = a => { a = (a + Math.PI) % (2 * Math.PI); if(a < 0) a += 2 * Math.PI; return a - Math.PI; };
const TAU = Math.PI * 2;

/* ---------- the fish as a body in the water ----------
   State: x, y (the centre of mass), psi (the heading, clockwise on a y-down page), vx, vy (the velocity, world), om (the yaw rate), phi (the wave's phase), f (its frequency, Hz),
   amp (how much of the wave's full amplitude is on), dpsi (the recoil's share of the heading), sT (the thrust, as the speed in units/s it would hold against the drag; negative brakes).
   Parameters are lengths a second (times L) unless named otherwise. */
const FISH = {
  L:300, lambda:1, slip:.8,            // the wavelength (in L) and the share of a wavelength the body advances per beat
  tip:.1, head:.12,                    // the tail tip's half amplitude (in L) and the share of it that reaches the head
  ku:2.2,                              // axial drag: acceleration (in L/s^2) per (speed in L/s) squared of error: the body is in the inertial regime
  klin:1.0,                            // axial drag at low speed, per second (viscous): a fish that stops thrusting stops
  kv:6,                                // sideways damping, per second: a fish slips forward, not across
  kpsi:3.2, zeta:.92,                  // the heading's natural frequency and damping
  kfb:3,                               // the speed controller's gain, per second
  cruise:.65, vmax:1.5, brake:.35,     // a cruise, the fastest the controller asks for, the most it brakes (all in L/s)
  fmin:.35, fidle:.28,                 // the beat when hovering (Hz) and the share of the wave that stays on then
  omHover:.9, omRun:2.4,               // the fastest yaw (rad/s) hovering and at speed
  dead:.2, hover:.14, aHover:.7,       // the dead-band round a slot (in L): inside it a fish holds, turns to the slot's heading and closes the rest by sculling with its pectorals (a slow sideways drift of at most `hover` L/s, an acceleration of at most `aHover` L/s^2)
  rg:.21, fin:.3,                      // radius of gyration, in L (a cord's torque turns the body by torque / rg^2 L^2), and the share of that torque the body does not hold off
  tie:[.03, -.10],                     // the cord's tie in the body's frame (forward, left), in L: the belly at the girth, a little ahead of the centre of mass (which is at .43 of the length, the girth at .40), on the belly's side (the left is the back's)
};
function newFish(o = {}){
  const P = {...FISH, ...o, tie:(o.tie || FISH.tie).slice()}, F = {P, x:o.x ?? 0, y:o.y ?? 0, psi:o.psi ?? 0, vx:0, vy:0, om:0, phi:o.phi ?? 0, f:P.fmin, amp:P.fidle, dpsi:0, sT:0, psiC:o.psi ?? 0, wff:0, spd:0, u:0, v:0, bend:0};
  return F;
}
const axes = psi => ({fx:Math.cos(psi), fy:Math.sin(psi), lx:Math.sin(psi), ly:-Math.cos(psi)});   // forward and left (the back's side) as world vectors
/* where the tie is, in the world */
function tieOf(F){ const A = axes(F.psi + F.dpsi), L = F.P.L, t = F.P.tie; return [F.x + (A.fx * t[0] + A.lx * t[1]) * L, F.y + (A.fy * t[0] + A.ly * t[1]) * L]; }
/* the beat the thrust asks for: speed-equivalent sT = slip · lambda · L · f */
const beatOf = (P, sT) => Math.max(P.fmin, Math.max(0, sT) / (P.slip * P.lambda * P.L));
const drag = (P, x) => P.ku * x * Math.abs(x) / P.L + P.klin * x;   // the axial drag at speed x; a thrust sT is whatever balances the drag at sT, so the swim law is exact
const invDrag = (P, W) => { const a = P.ku / P.L, b = P.klin; return Math.sign(W) * (-b + Math.sqrt(b * b + 4 * a * Math.abs(W))) / (2 * a); };
/* one substep h: thrust against drag along the body, damping across it, the heading chasing psiC (with the slot's own yaw rate in wff), an outside force (units/s^2, world) at the tie that also turns the body */
function subFish(F, h, force){
  const P = F.P, L = P.L, A = axes(F.psi), u = F.vx * A.fx + F.vy * A.fy, v = F.vx * A.lx + F.vy * A.ly, ax0 = drag(P, F.sT) - drag(P, u);
  let ax = A.fx * ax0 - A.lx * P.kv * v + (F.hx || 0), ay = A.fy * ax0 - A.ly * P.kv * v + (F.hy || 0), tq = 0;
  if(force){
    ax += force[0]; ay += force[1];
    const rx = (A.fx * P.tie[0] + A.lx * P.tie[1]) * L, ry = (A.fy * P.tie[0] + A.ly * P.tie[1]) * L;
    tq = P.fin * (rx * force[1] - ry * force[0]) / (P.rg * P.rg * L * L);   // the fins and the tail hold the body against most of a cord's torque
  }
  const spd = Math.hypot(F.vx, F.vy), omMax = P.omHover + (P.omRun - P.omHover) * sstep(0, .5 * L, spd);
  let aw = P.kpsi * P.kpsi * wrap(F.psiC - F.psi) + 2 * P.kpsi * P.zeta * (F.wff - F.om) + tq;
  if(F.om > omMax && aw > 0) aw = 0; if(F.om < -omMax && aw < 0) aw = 0;
  F.vx += ax * h; F.vy += ay * h; F.om += aw * h;
  F.x += F.vx * h; F.y += F.vy * h; F.psi += F.om * h;
}
/* after a frame: the speeds in the body's axes, the beat the thrust asks for (a frequency from the thrust, the phase integrated so the wave never restarts), the wave's share easing with the thrust */
function settleFish(F, dt){
  const P = F.P, L = P.L, A = axes(F.psi); F.u = F.vx * A.fx + F.vy * A.fy; F.v = F.vx * A.lx + F.vy * A.ly; F.spd = Math.hypot(F.vx, F.vy);
  F.f += (beatOf(P, F.sT) - F.f) * (1 - Math.exp(-dt * 6));
  F.phi += TAU * F.f * dt;
  const on = P.fidle + (1 - P.fidle) * sstep(.04 * L, .22 * L, Math.max(0, F.sT));
  F.amp += (on - F.amp) * (1 - Math.exp(-dt * 5));
}
/* integrate one frame in substeps of at most 4 ms */
function stepFish(F, dt, force){ const n = Math.max(1, Math.ceil(dt / .004)), h = dt / n; for(let q = 0; q < n; q++) subFish(F, h, force); settleFish(F, dt); return F; }
/* two fish and the cord between them, integrated together: the tension is worked out every substep (it is stiff), from the ties and their speeds. ln is the cord's length (tie to tie). Returns the last tension. */
function stepPair(A, B, dt, ln){
  const n = Math.max(1, Math.ceil(dt / .004)), h = dt / n; let C = null;
  for(let q = 0; q < n; q++){
    const ta = tieOf(A), tb = tieOf(B), ux = tb[0] - ta[0], uy = tb[1] - ta[1], d = Math.hypot(ux, uy) || 1e-6;
    const vrel = ((B.vx - A.vx) * ux + (B.vy - A.vy) * uy) / d; C = cordTension(ta, tb, ln, vrel);
    subFish(A, h, [C.ux * C.T, C.uy * C.T]); subFish(B, h, [-C.ux * C.T, -C.uy * C.T]);
  }
  settleFish(A, dt); settleFish(B, dt); return C;
}
/* steer a fish to a slot {x, y, psi, vx, vy, w}: velocity feed-forward plus a proportional pull toward the place, the heading to face where it goes when it is going somewhere and the slot's heading
   when it is not. env: {bounds:{x0,y0,x1,y1}, others:[fish]} adds soft walls and the fish's personal space. Sets sT, psiC, wff. */
function steer(F, slot, env = {}){
  const P = F.P, L = P.L, vmax = P.vmax * L, ex = slot.x - F.x, ey = slot.y - F.y, dd = Math.hypot(ex, ey), kp = 1.25, sv = Math.hypot(slot.vx || 0, slot.vy || 0);
  /* a still slot is reached and held (a latch: in when inside .6 of the dead-band, out beyond 1.4 of it); a moving slot is always pursued */
  if(sv > .03 * L) F.hold = false; else if(F.hold ? dd > P.dead * 1.4 * L : dd < P.dead * .6 * L) F.hold = !F.hold;
  let vdx = 0, vdy = 0; F.hx = F.hy = 0; F.hov = 0;
  if(F.hold){   // sculling: a slow sideways drift to the slot, whatever the heading
    const vH = P.hover * L, k = dd > 1e-6 ? Math.min(1, vH / (3 * dd)) : 0, wx = 3 * ex * k, wy = 3 * ey * k, aM = P.aHover * L;
    let hx = 4 * (wx - F.vx), hy = 4 * (wy - F.vy); const m = Math.hypot(hx, hy); if(m > aM){ hx *= aM / m; hy *= aM / m; } F.hx = hx; F.hy = hy; F.hov = Math.min(1, m / aM);
  }
  if(!F.hold){ const k = dd > 1e-6 ? Math.min(1, vmax / (kp * dd)) : 0; vdx = (slot.vx || 0) + kp * ex * k; vdy = (slot.vy || 0) + kp * ey * k; }
  const b = env.bounds;
  if(b){ const m = (env.wall ?? .62) * L, push = (d, sgn) => d < m ? sgn * vmax * sstep(m, 0, d) * 1.4 : 0; vdx += push(F.x - b.x0, 1) + push(b.x1 - F.x, -1); vdy += push(F.y - b.y0, 1) + push(b.y1 - F.y, -1); }
  for(const O of env.others || []){ const dx = F.x - O.x, dy = F.y - O.y, d = Math.hypot(dx, dy) || 1, r = (env.avoidR ?? .58) * L; if(d < r){ const k = vmax * sstep(r, r * .35, d); vdx += dx / d * k; vdy += dy / d * k; } }
  let spd = Math.hypot(vdx, vdy); if(spd > vmax){ vdx *= vmax / spd; vdy *= vmax / spd; spd = vmax; }
  const hv = spd > 1e-6 ? Math.atan2(vdy, vdx) : slot.psi, w = F.hold ? sstep(.04 * L, .15 * L, spd) : 1;   // pursuing: face where it is going; holding: the slot's heading
  F.psiC = slot.psi + wrap(hv - slot.psi) * w;
  F.wff = F.hold ? 0 : (slot.w || 0);   // the slot's own yaw rate, carried when it moves (the ring)
  const A = axes(F.psi), align = Math.max(0, Math.cos(wrap(F.psiC - F.psi)));
  const uC = spd * align * align, u = F.vx * A.fx + F.vy * A.fy;
  F.sT = clamp(invDrag(P, drag(P, u) + P.kfb * (uC - u)), -P.brake * L, 1.6 * L);
  return F;
}
/* the static bend a turn asks for: the body lies along its own path, so the curvature is the path's, yaw rate over speed (capped, and gentler as the fish stops) */
function turnBend(F){ const P = F.P, u = Math.abs(F.u) + .15 * P.L; return clamp(F.om * P.L / u * .9, -1.9, 1.9); }

/* ---------- the shape: joint angles for a wave and a bend ----------
   The wave is a lateral displacement along the body (waveY, its slope waveSlope); the direction of the body at an arc length s from the snout, toward the head and clockwise positive, is -atan of that
   slope plus the bend (dirAt). A bone's rotation relative to its parent is the difference of the directions at their middles (drive, below, turns it into muscle targets). */
function waveY(P, amp, phi, s){   // the displacement across the body, in units; s from the snout, wave runs head to tail
  const L = P.L, u = clamp(s / L), env = P.head + (1 - P.head) * u * u, k = TAU / (P.lambda * L);
  return amp * P.tip * L * env * Math.sin(k * s - phi);
}
function waveSlope(P, amp, phi, s){
  const L = P.L, u = clamp(s / L), env = P.head + (1 - P.head) * u * u, de = 2 * (1 - P.head) * u / L, k = TAU / (P.lambda * L);
  return amp * P.tip * L * (de * Math.sin(k * s - phi) + env * k * Math.cos(k * s - phi));
}
/* the direction of the body at arc length s, toward the head: the wave's slope plus a bend spread evenly (bend: the total turn from the head to the tail, positive = the belly side concave) */
function dirAt(F, s, bend){ const P = F.P, u = clamp(s / P.L); return -Math.atan(waveSlope(P, F.amp, F.phi, s)) + bend * (.5 - u); }
/* ---------- recoil ----------
   Points of the body in the frame of the rest pose (positions), a mass each. Given this frame's points and the last frame's, return the angular rate that makes the shape's motion carry no
   angular momentum about its centroid; and the centroid. */
function recoilRate(pts, prev, mass, dt){
  let M = 0, cx = 0, cy = 0; for(let i = 0; i < pts.length; i++){ M += mass[i]; cx += mass[i] * pts[i][0]; cy += mass[i] * pts[i][1]; }
  cx /= M; cy /= M;
  if(!prev) return {rate:0, cx, cy};
  let Ls = 0, I = 0;
  for(let i = 0; i < pts.length; i++){ const x = pts[i][0] - cx, y = pts[i][1] - cy, vx = (pts[i][0] - prev[i][0]) / dt, vy = (pts[i][1] - prev[i][1]) / dt; Ls += mass[i] * (x * vy - y * vx); I += mass[i] * (x * x + y * y); }
  return {rate:-Ls / (I || 1), cx, cy};
}

/* ---------- the cord: a rope with its ends on two ties ----------
   A Verlet chain of n+1 nodes, inextensible by distance constraints, stiffened a little against kinking, dragged by the water (still): a slack cord drifts and loops, a taut one is straight. */
function newRope(ax, ay, bx, by, len, n = 14){
  const R = {n, len, rest:len / n, x:new Float64Array(n + 1), y:new Float64Array(n + 1), px:new Float64Array(n + 1), py:new Float64Array(n + 1), drag:2.4, side:1};
  const d = Math.hypot(bx - ax, by - ay), h = d < len ? Math.sqrt(3 * Math.max(d, 1) * (len - d) / 8) : 0, nx = -(by - ay) / (d || 1), ny = (bx - ax) / (d || 1), s = ny >= 0 ? 1 : -1;
  for(let i = 0; i <= n; i++){ const u = i / n, bow = 4 * u * (1 - u) * h * s; R.x[i] = R.px[i] = ax + (bx - ax) * u + nx * bow; R.y[i] = R.py[i] = ay + (by - ay) * u + ny * bow; }
  return R;
}
function stepRope(R, ax, ay, bx, by, dt){
  const n = R.n, sub = Math.max(1, Math.ceil(dt / .006)), h = dt / sub, damp = Math.exp(-R.drag * h), rest = R.rest;
  const sx0 = new Float64Array(n + 1), sy0 = new Float64Array(n + 1), mstep = 650 * h;   // no node moves faster than 650 units/s, constraint corrections included: a loop that flips sides swings, it does not snap
  for(let q = 0; q < sub; q++){
    for(let i = 0; i <= n; i++){ sx0[i] = R.x[i]; sy0[i] = R.y[i]; }
    for(let i = 1; i < n; i++){
      let vx = (R.x[i] - R.px[i]) * damp, vy = (R.y[i] - R.py[i]) * damp; const sp = Math.hypot(vx, vy), cap = 520 * h;   // a loose loop never whips: its own momentum is limited to 520 units/s if(sp > cap){ vx *= cap / sp; vy *= cap / sp; }
      R.px[i] = R.x[i]; R.py[i] = R.y[i]; R.x[i] += vx; R.y[i] += vy;
    }
    R.px[0] = R.x[0] = ax; R.py[0] = R.y[0] = ay; R.px[n] = R.x[n] = bx; R.py[n] = R.y[n] = by;
    for(let i = 1; i < n; i++){ const k = .05; R.x[i] += (.5 * (R.x[i - 1] + R.x[i + 1]) - R.x[i]) * k; R.y[i] += (.5 * (R.y[i - 1] + R.y[i + 1]) - R.y[i]) * k; }   // a little stiffness: a slack cord curves, it does not zig-zag
    for(let it = 0; it < 6; it++){
      for(let i = 0; i < n; i++){
        const dx = R.x[i + 1] - R.x[i], dy = R.y[i + 1] - R.y[i], d = Math.hypot(dx, dy) || 1e-6, e = (d - rest) / d;
        const wa = i === 0 ? 0 : 1, wb = i + 1 === n ? 0 : 1, w = wa + wb; if(!w) continue;
        R.x[i] += dx * e * wa / w; R.y[i] += dy * e * wa / w; R.x[i + 1] -= dx * e * wb / w; R.y[i + 1] -= dy * e * wb / w;
      }
      for(let i = 0; i + 2 <= n; i++){   // bending: no node folds back on its neighbours (the chord of three nodes is at least 1.82 segments)
        const dx = R.x[i + 2] - R.x[i], dy = R.y[i + 2] - R.y[i], d = Math.hypot(dx, dy) || 1e-6, min = 1.82 * rest;
        if(d < min){ const e = (min - d) / d * .22, wa = i === 0 ? 0 : 1, wb = i + 2 === n ? 0 : 1, w = (wa + wb) || 1; R.x[i] -= dx * e * wa / w * 2; R.y[i] -= dy * e * wa / w * 2; R.x[i + 2] += dx * e * wb / w * 2; R.y[i + 2] += dy * e * wb / w * 2; }
      }
    }
    for(let i = 1; i < n; i++){ const dx = R.x[i] - sx0[i], dy = R.y[i] - sy0[i], m = Math.hypot(dx, dy); if(m > mstep){ R.x[i] = sx0[i] + dx * mstep / m; R.y[i] = sy0[i] + dy * mstep / m; } }
  }
  return R;
}
/* the tension the cord puts on its ends: a stiff, damped, one-sided spring on the chord. Returns {T, ux, uy, d} with the unit vector from A to B; the force on A is +T u and on B -T u. */
function cordTension(A, B, ln, vrel){   // A, B: tie points; vrel: the rate the chord lengthens
  const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1e-6, ux = dx / d, uy = dy / d, K = 900, C = 60;   // units/s^2 of pull on a body of mass 1: a stiff, damped, one-sided spring
  const T = d > ln ? Math.max(0, K * (d - ln) + C * vrel) : 0;
  return {T, ux, uy, d};
}


/* ---------- the model: a fish in a kit model ----------
   fish(M, {prefix, cx, cy, L, layer, rot, parent}) builds one fish into the model M and returns what the simulation and the creature need: its bones, its spine, its joints, its tie. The fish is drawn
   facing right, its back up, the snout at cx + .4 L, its root joint (and the cord's tie) at cx, the tail's end at cx - .6 L (and its fin .17 L past that); every point is then turned by `rot` about (cx, cy),
   the fish's rest heading (a quarter turn is the only angle the muscles' fields are made for).
   Every part is named with the prefix; every muscle is named prefix + id. Spine bones turn through their muscles only (an epaxial and a hypaxial for each joint). */
const PROF = [[0, 0, 0], [.02, .014, .012], [.06, .040, .036], [.12, .072, .064], [.20, .096, .086], [.30, .110, .102], [.40, .108, .100], [.50, .097, .090], [.60, .080, .075], [.70, .060, .056], [.80, .040, .038], [.88, .027, .026], [.93, .022, .022], [1, .024, .024]];
const interp = (s, col) => {   // a smooth read of the profile: cosine between stations
  s = clamp(s, 0, 1); let i = 0; while(i < PROF.length - 2 && PROF[i + 1][0] < s) i++;
  const a = PROF[i], b = PROF[i + 1], t = (s - a[0]) / (b[0] - a[0]), e = (1 - Math.cos(Math.PI * t)) / 2; return a[col] + (b[col] - a[col]) * e;
};
const hd = s => interp(s, 1), hv = s => interp(s, 2);
const SPINE = [['f1', .31, .40, 'root'], ['f2', .22, .31, 'f1'], ['f3', .13, .22, 'f2'], ['head', 0, .13, 'f3'], ['b1', .40, .49, 'root'], ['b2', .49, .58, 'b1'], ['b3', .58, .67, 'b2'], ['b4', .67, .76, 'b3'], ['b5', .76, .85, 'b4'], ['b6', .85, .93, 'b5']];   // [name, s at one end, s at the other, parent]: parents come first; a forward bone (f1 to head) has its joint at the larger s
function fish(M, o = {}){
  const K = root.CreatureKit; if(!K) throw new Error('creature-swim: load creature-kit.js first');
  const pf = o.prefix || '', L = o.L || 300, cx = o.cx ?? 500, cy = o.cy ?? 390, lay = o.layer ?? 5, rot0 = o.rot || 0, N = n => pf + n, parent = o.parent || null;
  const cr = Math.cos(rot0), sr = Math.sin(rot0);
  /* the fish is drawn straight, facing right, then every point is turned about its centre of mass by rot (its rest heading): a pair can rest as the sign, one fish up and one down */
  const X = s => cx + (.40 - s) * L, Yd = d => cy + d * L;
  const Tp = (x, y) => [cx + cr * (x - cx) - sr * (y - cy), cy + sr * (x - cx) + cr * (y - cy)];
  const at = (s, d = 0) => Tp(X(s), Yd(d));
  const unrot = (x, y) => [cx + cr * (x - cx) + sr * (y - cy), cy - sr * (x - cx) + cr * (y - cy)];   // back to the straight drawing
  const G = {zone:'glyph', ink:'gold', line:'glyph', tone:.95, tags:['glyph']};
  const F = {pf, L, cx, cy, X, hd, hv, at, unrot, rot0, spine:[], joints:[], names:{}, muscles:[], tieRest:at(.40, hv(.40))};
  /* ---- bones ---- (joint first, then end) */
  const B = (n, par, p, q, b) => { M.bone(N(n), par ? N(par) : parent, p, q, b); F.names[n] = N(n); return N(n); };
  B('root', null, at(.40), at(.36), {grp:'root', lim:[-3.3, 3.3]});   // the heading, wrapped to a half turn each way
  const sp = {anat:true, grp:'spine', speed:o.speed ?? 26, lim:[-.8, .8]};
  for(const [n, a, b, par] of SPINE){
    const fwd = n[0] === 'f' || n === 'head', j = fwd ? b : a, e = fwd ? a : b;   // a forward bone: joint at its rear (the larger s), end toward the snout
    B(n, par, at(j), at(e), {...sp});
    F.joints.push({bone:N(n), name:n, s:(a + b) / 2, fwd, a, b});
    F.spine.push(N(n));
  }
  B('cau', 'b6', at(.93), at(1.08), {grp:'tail', lim:[-.7, .7], sec:true, speed:9});
  B('cauU', 'cau', at(1.0, -.008), at(1.14, -.07), {grp:'tail', lim:[-.5, .5], sec:true, speed:12});
  B('cauL', 'cau', at(1.0, .008), at(1.14, .07), {grp:'tail', lim:[-.5, .5], sec:true, speed:12});
  B('pecN', 'f2', at(.236, .040), at(.336, .088), {grp:'fins', lim:[-.8, 1.3], sec:true, speed:12});
  B('pecF', 'f2', at(.252, .030), at(.346, .070), {grp:'fins', lim:[-.8, 1.3], sec:true, speed:12});
  B('pelN', 'f1', at(.30, .094), at(.37, .15), {grp:'fins', lim:[-.7, 1], sec:true, speed:12});
  B('pelF', 'f1', at(.31, .088), at(.375, .135), {grp:'fins', lim:[-.7, 1], sec:true, speed:12});
  B('op', 'f3', at(.19, -.088), at(.205, .075), {grp:'head', lim:[-.4, .2], sec:true, speed:14});
  B('jaw', 'head', at(.075, .030), at(.004, .016), {grp:'head', lim:[-.06, .62], sec:true, speed:16});
  const chain = (names, sigma) => ({chain:names.map(N), sigma});
  const spineAll = ['head', 'f3', 'f2', 'f1', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'cau'], spineBind = (sigma = 18) => chain(spineAll, sigma);
  const vOf = (x, y) => { const q = unrot(x, y); return (q[1] - cy) / L; };   // the dorsoventral place of a rest point, in L (negative: toward the back)
  /* ---- the body ---- */
  const st = []; for(let s = .15; s <= .951; s += .05){ const q = at(s); st.push([q[0], q[1], hd(s) * L, hv(s) * L]); }
  const dorsalTone = (x, y) => .035 + .09 * clamp((-vOf(x, y) / .11 + 1) / 2);
  M.limb(N('body'), st, {layer:lay, tier:'M', h:o.hBody ?? 13, bind:spineBind(16), line:'region', tags:['body', 'fish', pf || 'solo'], tone:dorsalTone, zone:'skin', tj:.03});
  /* ---- the head: the skull and cheek above the mouth line, the lower jaw, the cavity, the operculum and its gill, the eye ---- */
  const sd = list => list.map(([s, d]) => at(s, d));
  M.zone(N('head'), sd([[0, .006], [.012, -.011], [.035, -.032], [.07, -.052], [.11, -.072], [.15, -.086], [.19, -.094], [.225, -.088], [.236, -.02], [.232, .05], [.215, .082], [.20, .086], [.16, .078], [.125, .068], [.10, .053], [.075, .028], [.04, .016], [.012, .010]]), {layer:lay + .2, tier:'F', h:11, bind:chain(['head', 'f3'], 9), line:'contour', zone:'face', tags:['head', 'fish', pf || 'solo'], tone:(x, y) => .07 + .06 * clamp(-vOf(x, y) / .09 / 2 + .5)});
  M.zone(N('cavity'), sd([[.004, .009], [.04, .016], [.073, .028], [.074, .042], [.04, .036], [.008, .024]]), {layer:lay + .1, tier:'F', h:7, bind:{rigid:N('head')}, line:'mouth', zone:'mouth', tone:0, tags:['mouth', 'fish']});
  M.zone(N('jaw'), sd([[.0, .012], [.04, .016], [.075, .029], [.102, .054], [.097, .064], [.07, .060], [.04, .046], [.012, .030]]), {layer:lay + .3, tier:'F', h:9, bind:{rigid:N('jaw')}, line:'feature', zone:'mouth', tone:.22, tags:['jaw', 'mouth', 'fish']});
  M.zone(N('gill'), sd([[.216, -.072], [.238, -.04], [.242, .008], [.232, .05], [.212, .071], [.200, .02]]), {layer:lay + .35, tier:'F', h:9, bind:{rigid:N('f3')}, line:'mouth', zone:'gills', tone:0, tags:['gill', 'fish']});
  M.zone(N('operculum'), sd([[.188, -.090], [.222, -.080], [.240, -.045], [.244, .005], [.236, .050], [.214, .078], [.186, .080], [.176, .020], [.178, -.050]]), {layer:lay + .4, tier:'F', h:10, bind:{rigid:N('op')}, line:'feature', zone:'gills', tone:(x, y) => .14 + .1 * clamp(((unrot(x, y)[0] - X(.19)) / (-.06 * L)) + .5), tags:['operculum', 'fish']});
  const [ex, ey] = at(.075, -.016);
  M.polar(N('eye'), [ex, ey], [0, 5, 10.5], [8, 12], {layer:lay + .5, tier:'F', bind:{rigid:N('head')}, zone:'eyes', ink:'accent', line:'feature', tone:(x, y) => Math.hypot(x - ex, y - ey) < 5.2 ? 0 : .92, tags:['eye', 'fish']});
  M.shape(N('nostril'), [at(.028, -.020), at(.040, -.023), at(.040, -.015), at(.028, -.014)], {layer:lay + .45, bind:{rigid:N('head')}, zone:'muzzle', line:'feature', tone:.7, tags:['fish']});
  /* ---- fins: a ray is a quad, the gaps between rays are the lines ---- */
  const FIN = {k:.6, c:.82, r:0, t:'bone', tk:.25, bs:2.2}, FINF = {k:.3, c:.5, r:0, bs:1.6};
  const ray = (b, t, wb, wt) => { const dx = t[0] - b[0], dy = t[1] - b[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; return [[b[0] + nx * wb, b[1] + ny * wb], [b[0] - nx * wb, b[1] - ny * wb], [t[0] - nx * wt, t[1] - ny * wt], [t[0] + nx * wt, t[1] + ny * wt]]; };
  const rayS = (b, t, wb, wt) => ray(Tp(b[0], b[1]), Tp(t[0], t[1]), wb, wt);   // a ray drawn straight, then turned
  const dorsalRays = [], HD = [.080, .088, .082, .070, .058, .040, .036, .046, .056, .050, .034];
  HD.forEach((h, i) => { const s = .27 + .35 * i / (HD.length - 1), b = [X(s), Yd(-hd(s)) + 4], t = [b[0] - .45 * h * L, b[1] - h * L]; dorsalRays.push(rayS(b, t, 4.4, 2.3)); });
  M.shapes(N('dorsal'), dorsalRays, {layer:lay - .5, tier:'F', bind:spineBind(22), line:FIN, zone:'fins', tone:.17, tags:['dorsal', 'fin', 'fish']});
  const analRays = [], HA = [.044, .050, .046, .040, .032, .022];
  HA.forEach((h, i) => { const s = .55 + .12 * i / (HA.length - 1), b = [X(s), Yd(hv(s)) - 4], t = [b[0] - .4 * h * L, b[1] + h * L]; analRays.push(rayS(b, t, 4.2, 2.2)); });
  M.shapes(N('anal'), analRays, {layer:lay - .5, tier:'F', bind:spineBind(22), line:FIN, zone:'fins', tone:.17, tags:['anal', 'fin', 'fish']});
  const fan = (hs, hd_, a0, a1, n, len0, len1, wb, wt) => Array.from({length:n}, (_, i) => { const u = n > 1 ? i / (n - 1) : 0, a = a0 + (a1 - a0) * u, l = (len0 + (len1 - len0) * u) * L, hx = X(hs), hy = Yd(hd_); return rayS([hx, hy], [hx - Math.cos(a) * l, hy + Math.sin(a) * l], wb, wt); });
  M.shapes(N('pectoral'), fan(.236, .040, -.15, .95, 7, .108, .078, 3.6, 2.2), {layer:lay + .6, tier:'F', bind:{rigid:N('pecN')}, line:FIN, zone:'fins', tone:.2, tags:['pectoral', 'fin', 'N', 'fish']});
  M.shapes(N('pectoralF'), fan(.252, .030, -.1, .9, 7, .1, .072, 3.4, 2.1), {layer:lay - .9, tier:'F', dim:true, bind:{rigid:N('pecF')}, line:FINF, zone:'fins', tone:.14, tags:['pectoral', 'fin', 'F', 'fish']});
  M.shapes(N('pelvic'), fan(.30, .094, .2, 1.1, 4, .088, .066, 3.2, 2), {layer:lay + .55, tier:'F', bind:{rigid:N('pelN')}, line:FIN, zone:'fins', tone:.2, tags:['pelvic', 'fin', 'N', 'fish']});
  M.shapes(N('pelvicF'), fan(.31, .088, .15, 1, 4, .08, .06, 3, 1.9), {layer:lay - .95, tier:'F', dim:true, bind:{rigid:N('pelF')}, line:FINF, zone:'fins', tone:.14, tags:['pelvic', 'fin', 'F', 'fish']});
  const cauRays = Array.from({length:9}, (_, i) => { const a = (-36 + 9 * i) * Math.PI / 180, u = Math.abs(a) / (36 * Math.PI / 180), l = (.115 + .078 * Math.pow(u, 1.3)) * L, b = [X(.945), cy + Math.sin(a) * 4], t = [b[0] - Math.cos(a) * l, b[1] + Math.sin(a) * l]; return rayS(b, t, 3.6, 3.0); });
  const cauBind = (x, y) => { const q = unrot(x, y), above = q[1] < cy, t = clamp(Math.max(0, (X(.945) - q[0]) / (.19 * L)) * 1.05); return above ? [[N('cau'), 1 - t * .7], [N('cauU'), t * .7]] : [[N('cau'), 1 - t * .7], [N('cauL'), t * .7]]; };
  M.shapes(N('caudal'), cauRays, {layer:lay - .5, tier:'F', bind:cauBind, line:FIN, zone:'fins', tone:.2, tags:['caudal', 'fin', 'fish']});
  /* ---- the sign, built in: the lateral line (the arc), the girth band (the bar crossing it), the tie ring (where the cord leaves the belly) ---- */
  const lat = []; for(let i = 0; i <= 18; i++){ const u = i / 18, s = .235 + (.96 - .235) * u, d = -(.052 + .016 * Math.sin(Math.PI * Math.min(1, u / .4))) * Math.pow(1 - u, .9), q = at(s, d); lat.push([q[0], q[1], 2.6 - 1.1 * u]); }
  M.strip(N('lateral'), lat, {...G, layer:lay + .1, bind:spineBind(14), host:[N('body'), N('operculum')], tags:['glyph', 'lateral', 'fish']});
  M.strip(N('girth'), [0, .25, .5, .75, 1].map(u => { const q = Tp(X(.40), lerp(Yd(-hd(.40)) + 1.5, Yd(hv(.40)) - 1.5, u)); return [q[0], q[1], 2.8]; }), {...G, layer:lay + .12, bind:chain(['f1', 'b1'], 10), host:[N('body')], tags:['glyph', 'girth', 'fish']});
  const tr = at(.40, hv(.40) - .003);
  M.polar(N('ring'), tr, [4.6, 9], [10, 10], {...G, layer:lay + .2, bind:chain(['f1', 'b1'], 10), tags:['glyph', 'ring', 'fish']});
  F.lat = lat;
  return F;
}

/* ---------- the muscles of one fish ----------
   An epaxial and a hypaxial for every spine joint (the dorsal and ventral arms of the myomere's chevron; the picture's convention, CREATURE-NOTES-FISHES.md 2.3), the fins' own, the operculum's and
   the jaw's. Names are pf + id. Returns the table of axial gains the runtime needs. */
const GAIN = {f1:.42, f2:.42, f3:.40, head:.34, b1:.42, b2:.44, b3:.46, b4:.48, b5:.5, b6:.5};
function fishMuscles(M, F, o = {}){
  const K = root.CreatureKit, pf = F.pf, L = F.L, N = n => pf + n, A_ = (s, d = 0) => F.at(s, d), sw = Math.abs(Math.sin(F.rot0)) > .7, RR = (a, b) => sw ? [b, a] : [a, b], cr = Math.cos(F.rot0), sr = Math.sin(F.rot0), RV = (x, y) => [cr * x - sr * y, sr * x + cr * y];   // a fish at rest turned a quarter: its muscles' fields turn with it (their radii swap)
  const nm = {f1:'mid-trunk, fore', f2:'trunk, fore', f3:'nape', head:'head', b1:'mid-trunk, hind', b2:'trunk, hind', b3:'rear trunk', b4:'rear trunk (tail)', b5:'peduncle', b6:'peduncle (tail)'};
  for(const j of F.joints){
    const g = GAIN[j.name] * (o.gain ?? 1), plus = j.fwd ? 'hypax' : 'epax', mk = (side) => {
      const dorsal = side === 'epax', cc = A_(j.s, dorsal ? -.05 : .05), ang = (dorsal ? .95 : -.95) + F.rot0, hue = dorsal ? '#9aa6d8' : '#e3a76f', rx = Math.max(.035 * L, (j.b - j.a) * L * .62);
      const sign = side === plus ? 1 : -1;
      M.muscle(N(side + '_' + j.name), {name:(dorsal ? 'epaxial myomeres: ' : 'hypaxial myomeres: ') + nm[j.name], g:'axial', c:cc, r:RR(rx, .042 * L), on:[N(j.name === 'head' ? 'head' : 'body')], jt:[[j.bone, g * sign, 'r']], hue, speed:o.speed ?? 26, shade:K.crease(cc[0], cc[1], ...RR(rx, .04 * L), ang, .2, .4, .6, .9)});
    };
    mk('epax'); mk('hypax'); F.names['gain_' + j.name] = g;
  }
  const fg = (id, name, c, r, on, jt, hue, extra = {}) => M.muscle(N(id), {name, g:'fins', c, r, on, jt, hue, speed:12, shade:K.glow(c[0], c[1], r[0] * .8, r[1] * .8, .42), ...extra});
  fg('pecProt', 'pectoral protractor', A_(.30, .045), RR(.05 * L, .035 * L), [N('pectoral')], [[N('pec$'), .7, 'r']], '#7ec3e6', {pair:'NF', far:RV(-8, -4)});
  fg('pecRet', 'pectoral retractor', A_(.30, .052), RR(.05 * L, .035 * L), [N('pectoral')], [[N('pec$'), -.45, 'r']], '#5cc6b4', {pair:'NF', far:RV(-8, -4)});
  fg('pelProt', 'pelvic protractor', A_(.33, .11), RR(.04 * L, .03 * L), [N('pelvic')], [[N('pel$'), .55, 'r']], '#c79ae0', {pair:'NF', far:RV(-6, -3)});
  fg('pelRet', 'pelvic retractor', A_(.34, .115), RR(.04 * L, .03 * L), [N('pelvic')], [[N('pel$'), -.4, 'r']], '#d985a6', {pair:'NF', far:RV(-6, -3)});
  fg('dorUp', 'dorsal erector', A_(.44, -.17), RR(.16 * L, .05 * L), [N('dorsal')], [], '#ffbe00', {v:RV(0, -11)});
  fg('dorDown', 'dorsal depressor', A_(.44, -.17), RR(.16 * L, .05 * L), [N('dorsal')], [], '#e3806f', {v:RV(0, 9)});
  fg('anUp', 'anal depressor', A_(.61, .13), RR(.07 * L, .04 * L), [N('anal')], [], '#ffbe00', {v:RV(0, 8)});
  fg('anDown', 'anal erector', A_(.61, .13), RR(.07 * L, .04 * L), [N('anal')], [], '#e3806f', {v:RV(0, -6)});
  fg('cauFlexUp', 'caudal flexor (dorsal)', A_(1.0), RR(.06 * L, .05 * L), [N('caudal')], [[N('cau'), -.6, 'r']], '#9aa6d8');
  fg('cauFlexDn', 'caudal flexor (ventral)', A_(1.0), RR(.06 * L, .05 * L), [N('caudal')], [[N('cau'), .6, 'r']], '#e3a76f');
  fg('cauSpread', 'caudal spreader', A_(1.04), RR(.06 * L, .08 * L), [N('caudal')], [[N('cauU'), .32, 'r'], [N('cauL'), -.32, 'r']], '#7ec3e6');
  fg('cauClose', 'caudal adductor', A_(1.04), RR(.06 * L, .08 * L), [N('caudal')], [[N('cauU'), -.3, 'r'], [N('cauL'), .3, 'r']], '#5cc6b4');
  const hg = (id, name, c, r, on, jt, hue, extra = {}) => M.muscle(N(id), {name, g:'head', c, r, on, jt, hue, speed:14, shade:K.glow(c[0], c[1], r[0] * .8, r[1] * .8, .45), ...extra});
  hg('opOpen', 'dilator operculi', A_(.215, -.02), RR(.035 * L, .06 * L), [N('operculum')], [[N('op'), -.2, 'r']], '#e3806f');
  hg('opShut', 'adductor operculi', A_(.2, .02), RR(.03 * L, .05 * L), [N('operculum')], [[N('op'), .07, 'r']], '#9aa6d8');
  hg('jawDrop', 'sternohyoid and geniohyoid (the jaw drops)', A_(.07, .05), RR(.05 * L, .03 * L), [N('jaw')], [[N('jaw'), .5, 'r']], '#e3806f');
  hg('jawShut', 'adductor mandibulae', A_(.1, .025), RR(.04 * L, .03 * L), [N('head')], [[N('jaw'), -.06, 'r']], '#a09080');
}

/* ---------- the runtime: the wave into muscle targets, the recoil out of the joints, the tie, the cord's bones ---------- */
const mmul = (P, Lm) => [P[0] * Lm[0] + P[2] * Lm[1], P[1] * Lm[0] + P[3] * Lm[1], P[0] * Lm[2] + P[2] * Lm[3], P[1] * Lm[2] + P[3] * Lm[3], P[0] * Lm[4] + P[2] * Lm[5] + P[4], P[1] * Lm[4] + P[3] * Lm[5] + P[5]];
const local = (b, th) => { const c = Math.cos(th), s = Math.sin(th), [px, py] = b.p; return [c, s, -s, c, px - c * px + s * py, py - s * px - c * py]; };
function bind(c, F){
  const d = c.d, MI = d.MI, BI = d.BI, pf = F.pf, J = [];
  F.joints.forEach((j, k) => {
    const par = SPINE.find(e => e[0] === j.name)[3], pj = par === 'root' ? -1 : F.joints.findIndex(q => q.name === par), g = F.names['gain_' + j.name], plus = j.fwd ? 'hypax_' : 'epax_', minus = j.fwd ? 'epax_' : 'hypax_';
    J.push({k, b:BI[j.bone], pj, s:j.s, g, mp:MI[pf + plus + j.name + '.C'], mm:MI[pf + minus + j.name + '.C'], lo:d.LIMLO[BI[j.bone]], hi:d.LIMHI[BI[j.bone]], bone:d.bones[BI[j.bone]]});
  });
  const root = d.bones[BI[pf + 'root']], P0 = root.p.slice();
  /* mass points: the middle of every spine bone, weighted by the cross-section and the span; the tail fin's middle, lightly */
  const mass = J.map(j => { const e = F.joints[j.k]; return (hd(e.s) + hv(e.s)) * Math.abs(e.b - e.a) * F.L * F.L; });
  /* the tie: the ring's rest centre, skinned to f1 and b1 by the kit's own capsule weights */
  const tie = F.tieRest, ids = [pf + 'f1', pf + 'b1'].map(n => BI[n]), wts = ids.map(b => { const B = d.bones[b], dd = segDist(tie[0], tie[1] - 1, B.p[0], B.p[1], B.q[0], B.q[1]); return dd; }), dm = Math.min(...wts), we = wts.map(v => Math.exp(-(((v - dm) / 10) ** 2))), ws = we[0] + we[1];
  const R = {F, J, P0, mass, rootB:BI[pf + 'root'], tie, tieB:ids, tieW:we.map(v => v / ws), prev:null, dpsi:0, mid:[], sim:null, fu:MI[pf + 'cauFlexUp.C'], fd:MI[pf + 'cauFlexDn.C'], Af:0, At:null};
  return R;
}
function segDist(px, py, ax, ay, bx, by){ const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
/* the muscle targets for the wave and the bend: for every spine joint, the rotation relative to its parent that puts the bone along the body's direction at its middle; the muscle that turns it
   that way is driven, with a little co-contraction (the body is stiff when it works) */
function drive(c, R, sim, Ti, bend0, extra){
  /* the bend is what the body asks for, but a body does not change its curl in a frame: a first-order lag (.18 s) and a rate limit (4 rad/s), so a fish turning in place and reversing does not whip its tail */
  const dts = Math.min(.08, (c.dtms || 16) / 1000); if(R.b === undefined) R.b = bend0; { const want = (bend0 - R.b) * (1 - Math.exp(-dts / .18)), cap = 4 * dts; R.b += clamp(want, -cap, cap); } const bend = R.b;
  const F = R.F, root = dirAt(sim, .40 * sim.P.L, bend); let A = 0;
  for(const j of R.J){
    const ph = j.pj < 0 ? root : dirAt(sim, R.J[j.pj].s * sim.P.L, bend), rel = dirAt(sim, j.s * sim.P.L, bend) - ph + (extra ? extra[j.k] || 0 : 0), e = clamp(rel / j.g, -1.4, 1.4), co = .04 + .1 * Math.abs(e);
    Ti[j.mp] += Math.max(0, e) + co; Ti[j.mm] += Math.max(0, -e) + co;
    if(!j.fwd) A += rel;
  }
  /* the tail fin trails the peduncle: its flexors are driven by how far the spine's turn from the root to the peduncle has run ahead of a slow copy of itself (so only the body's bend moves the fin, never the fish's heading) */
  { const k = 1 - Math.exp(-(c.dtms || 16) / 1000 * 3.2); R.Af += (A - R.Af) * k; const fin = clamp(-.9 * (A - R.Af), -.6, .6) / .6; Ti[R.fu] += Math.max(0, -fin); Ti[R.fd] += Math.max(0, fin); }
}
/* after the muscles: the joints as they are -> the shape in the rest frame -> recoil and the centre -> the root bone's rotation and slide (the whole fish, in the world). Returns the world tie. */
function place(c, R, sim, rot, sx, sy, dt){
  const d = c.d, F = R.F, bones = d.bones, LO = d.LIMLO, HI = d.LIMHI;
  for(const j of R.J){ const v = rot[j.b]; rot[j.b] = v < LO[j.b] ? LO[j.b] : v > HI[j.b] ? HI[j.b] : v; }
  const Mx = new Array(R.J.length), pts = [];
  R.J.forEach(j => { const Lm = local(j.bone, rot[j.b]); Mx[j.k] = j.pj < 0 ? Lm : mmul(Mx[j.pj], Lm); const m = Mx[j.k], b = j.bone, mx = (b.p[0] + b.q[0]) / 2, my = (b.p[1] + b.q[1]) / 2; pts.push([m[0] * mx + m[2] * my + m[4], m[1] * mx + m[3] * my + m[5]]); });
  const rr = recoilRate(pts, R.prev && R.prev.length === pts.length ? R.prev : null, R.mass, Math.max(dt, 1e-3) / 1000);
  R.prev = pts;
  const dts = Math.max(dt, 0) / 1000; sim.dpsi += (rr.rate - sim.dpsi / .6) * dts; sim.dpsi = clamp(sim.dpsi, -.3, .3);
  const psi = sim.psi + sim.dpsi - F.rot0, cs = Math.cos(psi), sn = Math.sin(psi), P0 = R.P0, vx = rr.cx - P0[0], vy = rr.cy - P0[1];   // the root turns by the heading less the way the fish was drawn
  rot[R.rootB] = wrap(psi); sx[R.rootB] = sim.x - P0[0] - (cs * vx - sn * vy); sy[R.rootB] = sim.y - P0[1] - (sn * vx + cs * vy);
  /* the tie: the ring's centre carried by f1 and b1, then by the root */
  let tx = 0, ty = 0; R.tieB.forEach((b, q) => { const j = R.J.find(e => e.b === b), m = Mx[j.k], w = R.tieW[q]; tx += w * (m[0] * R.tie[0] + m[2] * R.tie[1] + m[4]); ty += w * (m[1] * R.tie[0] + m[3] * R.tie[1] + m[5]); });
  const ux = tx - P0[0], uy = ty - P0[1], W = [P0[0] + cs * ux - sn * uy + sx[R.rootB], P0[1] + sn * ux + cs * uy + sy[R.rootB]];
  /* where the tie really is on the body now, in the body's own axes: a bent body carries its girth off the centre of mass, and the simulation must pull on the tie that is drawn */
  { const Ax = axes(sim.psi + sim.dpsi), wx = W[0] - sim.x, wy = W[1] - sim.y, L = sim.P.L, tf = (wx * Ax.fx + wy * Ax.fy) / L, tl = (wx * Ax.lx + wy * Ax.ly) / L, k = 1 - Math.exp(-Math.max(dts, 0) * 14); sim.P.tie = [sim.P.tie[0] + (tf - sim.P.tie[0]) * k, sim.P.tie[1] + (tl - sim.P.tie[1]) * k]; }
  return W;
}
/* the cord's bones from a rope: bone k runs from node k to node k+1. Bone 0 slides to node 0 and turns; every other bone turns by the change in direction AND slides along its parent's axis by the difference
   between the rope's segment and the bone's length, so its joint lies exactly on its node (a chain laid by angles alone carries the length mismatch down its whole run, and a loose loop that changes shape
   swings the far half of the cord by tens of units a frame). */
function laySpine(c, names, rope, rot, sx, sy){
  const d = c.d; let prev = 0, prevLen = 0;
  for(let k = 0; k < names.length; k++){
    const b = d.BI[names[k]], B = d.bones[b], rest = Math.atan2(B.q[1] - B.p[1], B.q[0] - B.p[0]), a = Math.atan2(rope.y[k + 1] - rope.y[k], rope.x[k + 1] - rope.x[k]), seg = Math.hypot(rope.x[k + 1] - rope.x[k], rope.y[k + 1] - rope.y[k]);
    if(k === 0){ rot[b] = wrap(a - rest); sx[b] = rope.x[0] - B.p[0]; sy[b] = rope.y[0] - B.p[1]; prev = a - rest; }
    else { rot[b] = wrap((a - rest) - prev); sx[b] = prevSeg - prevLen; sy[b] = 0; prev = a - rest; }
    var prevSeg = seg; prevLen = B.len;
  }
}

/* ---------- the water: motes the fish stir, and bubbles from the mouth ----------
   A layer of the figure's own svg, under the fish: a scatter of dim motes fixed in the water (a world the body moves through, so a swimming fish is seen to swim) that the fish push as they pass, and
   bubbles that rise from a mouth on a gulp, a cough or a yawn. Lines, not fills: a ring of the ink, fading. water(c).step(ms, fish) each frame; water(c).emit(x, y, n). */
function water(c, o = {}){
  const NS = 'http://www.w3.org/2000/svg', R = o.rect || [-60, -60, 1060, 840], mk = (r) => { const e = document.createElementNS(NS, 'circle'); e.setAttribute('r', r); g.appendChild(e); return e; };
  if(c.waterG && c.waterG.parentNode) c.waterG.parentNode.removeChild(c.waterG);
  const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'water'); g.style.pointerEvents = 'none'; c.waterG = g; c.svg.insertBefore(g, c.rig);
  const rnd = c.rand, W = R[2] - R[0], H = R[3] - R[1], motes = [], bubbles = [];
  for(let i = 0; i < (o.motes ?? 34); i++){ const e = mk(1.2); motes.push({x:R[0] + rnd() * W, y:R[1] + rnd() * H, vx:0, vy:0, r:1.3 + rnd() * 1.9, a:.14 + .3 * rnd(), ph:rnd() * 6.28, e}); }
  for(let i = 0; i < (o.bubbles ?? 22); i++){ const e = mk(3); e.setAttribute('fill', 'none'); bubbles.push({on:false, x:0, y:0, vx:0, vy:0, r:3, age:0, life:2.5, e}); e.style.display = 'none'; }
  let ink = '', drift = o.drift ?? [5, -3];
  const W_ = {
    emit(x, y, n = 3, vx = 0, vy = 0){ let k = 0; for(const b of bubbles){ if(b.on || k >= n) continue; k++; b.on = true; b.x = x + (rnd() - .5) * 10; b.y = y + (rnd() - .5) * 8; b.vx = vx * .2 + (rnd() - .5) * 14; b.vy = vy * .2 - 26 - rnd() * 22; b.r = 3 + rnd() * 4; b.age = -rnd() * .5; b.life = 1.8 + rnd() * 1.6; b.e.style.display = ''; } },
    step(ms, fish){
      const dt = Math.min(.08, ms / 1000), col = lighten(c.P && c.P.ink ? c.P.ink : '#8aa');
      if(col !== ink){ ink = col; for(const m of motes) m.e.setAttribute('fill', col); for(const b of bubbles) b.e.setAttribute('stroke', col); }
      const t = (c.t || 0) / 1000;
      for(const m of motes){
        for(const F of fish){ const L = F.P.L, dx = m.x - F.x, dy = m.y - F.y, d = Math.hypot(dx, dy), r = .55 * L; if(d < r){ const k = (1 - d / r) ** 2 * F.spd * 1.6 * dt * 60 / 60; m.vx += (F.vx * .35 + dx / (d || 1) * F.spd * .12) * k * dt * 6; m.vy += (F.vy * .35 + dy / (d || 1) * F.spd * .12) * k * dt * 6; } }
        m.vx += (drift[0] + 3 * Math.sin(t * .31 + m.ph) - m.vx) * Math.min(1, dt * 1.4); m.vy += (drift[1] + 3 * Math.cos(t * .27 + m.ph) - m.vy) * Math.min(1, dt * 1.4);
        m.x += m.vx * dt; m.y += m.vy * dt; if(m.x < R[0]) m.x += W; else if(m.x > R[2]) m.x -= W; if(m.y < R[1]) m.y += H; else if(m.y > R[3]) m.y -= H;
        m.e.setAttribute('cx', m.x.toFixed(1)); m.e.setAttribute('cy', m.y.toFixed(1)); m.e.setAttribute('r', m.r.toFixed(2)); m.e.setAttribute('opacity', (m.a * (.7 + .3 * Math.sin(t * 1.3 + m.ph))).toFixed(3));
      }
      for(const b of bubbles){
        if(!b.on) continue; b.age += dt; if(b.age < 0) continue;
        if(b.age > b.life){ b.on = false; b.e.style.display = 'none'; continue; }
        b.vx += (Math.sin(b.age * 5 + b.r) * 16 - b.vx) * dt * 2; b.x += b.vx * dt; b.y += b.vy * dt; b.r += dt * .5;
        const u = b.age / b.life; b.e.setAttribute('cx', b.x.toFixed(1)); b.e.setAttribute('cy', b.y.toFixed(1)); b.e.setAttribute('r', b.r.toFixed(2)); b.e.setAttribute('stroke-width', '1.3'); b.e.setAttribute('opacity', (.7 * (1 - u * u)).toFixed(3));
      }
    },
  };
  return W_;
}
const lighten = hex => { const n = parseInt(hex.slice(1), 16), b = [232, 228, 217], m = (v, w) => Math.round(v + (w - v) * .55); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => m(v, b[i]).toString(16).padStart(2, '0')).join(''); };   // the ink toward bone, so the water's rings read
/* the mouth's tip in the world, for bubbles */
function mouthOf(c, F){ const d = c.d, B = d.bones[d.BI[F.pf + 'jaw']]; return c.wp(F.pf + 'jaw', B.q); }

root.CreatureSwim = {water, mouthOf, fish, fishMuscles, bind, drive, place, laySpine, GAIN, fishPts:null, SPINE, hd, hv, VERSION, CHANGELOG, newFish, stepFish, stepPair, steer, turnBend, tieOf, axes, beatOf, waveY, waveSlope, dirAt, recoilRate, newRope, stepRope, cordTension, FISH, util:{clamp, lerp, sstep, wrap}};
CreatureSwim.require = (min, who = 'a creature') => { const a = VERSION.split('.').map(Number), b = String(min).split('.').map(Number); for(let i = 0; i < 3; i++){ if((a[i] || 0) > (b[i] || 0)) return true; if((a[i] || 0) < (b[i] || 0)) throw new Error(who + ' needs creature-swim.js ' + min + ' or later, and this is ' + VERSION); } return true; };
})();
