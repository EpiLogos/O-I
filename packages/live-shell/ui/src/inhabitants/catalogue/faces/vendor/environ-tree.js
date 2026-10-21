/* environ-tree.js — the tree: the first environ built to CREATURE-SPEC.md's standard (Part II, section 24). Its research note is ENVIRON-NOTES-TREE.md;
   read it first. A real tree, generated, not drawn by hand: a seeded botanical model in three dimensions, then meshed and drawn on creature-kit.js in the
   face rig's line model, in the continuous body's view (seen from in front and above at 0.62 rad), so the serpent (creature-body.js) can climb it on a stage.

   THE FAMILY. The tree is a family of species on one growth engine (environ-growth.js; the species are data in environ-species.js): apple, oak, pine and a
   bonsai (cbonsai's own rules). generate({species, id, life, mult, lean, budget}) grows one: the seed is the id (a string; the same species, id and
   params always give the same tree), life is its size and age, mult its branchiness (higher is fewer shoots, as in cbonsai), lean its lean. The engine's
   output is turned into the one tree shape the figure, the year and the stage read (T below). generate({seed}) with no species is the earlier fixed
   recipe, kept as 'apple-classic' (the stage still builds on it); it needs neither growth file.

   THE MODEL (world units are millimetres; the serpent is 1080 long):
   - The trunk: about 120 across at 300 up, leaning a little, with a root flare of five lobes that spreads it to about 190 at the ground and is gone by
     about 200 up; the central leader runs on to about 1400.
   - Four scaffold limbs from about 480 up, set round the trunk at the golden angle (137.5 degrees) and 75 apart, at 50-62 degrees from the vertical;
     each bends up toward the light along its length and sags a little in its middle under its own weight; the leader carries a few smaller limbs above.
   - Secondary limbs along the scaffolds' outer three quarters, alternating sides; leafy shoots on the secondaries and the scaffolds' outer halves;
     fruiting spurs (short, stubby) along two-year-and-older wood.
   - Radii by the pipe model (Leonardo's rule, exponent 2): a point's cross-section is the sum of the tips it carries.
   - Leaves: alternate along the shoots (2/5 phyllotaxis, 144 degrees apart), in rosettes of four or five on the spurs; ovate blades about 75 by 42 on
     petioles about 30, held up and out toward the light. Each leaf is two halves either side of its midrib, so the midrib is a line (a gap).
   - Fruit: apples on spurs in the outer crown, hanging on short stalks; each one's place is a product's on a stage.
   - Surface roots: a few, leaving the flare and going into the soil within a short run.
   MESH: every branch is a tube (rings round its centreline by parallel transport, columns round it); only the cells that face the viewer are kept;
   cells are bark plates, longer than wide and set in alternate rows, shaded by a light from the upper left (tone stays near the ground, as the line
   model asks); each branch is cut into segments that are drawn in depth order with the leaves and fruit. Leaves are in the accent ink (malachite),
   the wood in the tree's own (umber).

   EnvironTree.generate(o) gives the tree in the world; EnvironTree.figure(o) defines the kit figure(s) for a view; EnvironTree.look(c, zones, now)
   sets the zones' look from a run (environ-kit.js run.zones()); EnvironTree.course(T, o) gives the course a body climbs: round the trunk, out along a
   scaffold to its fruit. */
(() => {
'use strict';
const VERSION = '1.2.0';
const CHANGELOG = [
  {date:'2026-10-20', version:'1.2.0', what:'A family of species on the growth engine: generate({species, id, life, mult, lean, budget}) grows apple, oak, pine or bonsai from environ-growth.js and environ-species.js into the same T the figure reads (T.species, T.id, each branch\'s birth step t, T.courseId). The earlier recipe stays as apple-classic (generate({seed}) with no species: the stage). Per-species leaves (ovate, lobed, round, needle), products (apple, acorn, cone, berry), bark, evergreen (no leaf fall), the course limb chosen from the tree, the ground and leaf-fall ring scaled by the species.'},
  {date:'2026-10-19', version:'1.1.0', what:'The year (growth, leaf fall, fruit drop, die-back), the seed and blossom organs; reads PHENOLOGY from environ-kit.js 1.2.0.'}];
const EK = window.EnvironKit, K = window.CreatureKit;
/* the growth files are bound when a species is asked for, so a page that builds the classic tree needs only environ-kit.js and this file (the stage) */
const growthOf = () => { const G = window.EnvironGrowth; if(!G || !window.EnvironSpecies) throw new Error('environ-tree: a species needs environ-growth.js and environ-species.js loaded before it'); return G; };
const GY = EK.GY, GZ = EK.GZ;
/* ---------- small 3D maths ---------- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rotAbout = (v, k, th) => { const c = Math.cos(th), s = Math.sin(th); return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))); };
const CAM = [0, GZ, GY];                      // toward the camera (depth toward it is Y cos P + Z sin P)
const LIGHT = norm([-.5, .45, .75]);          // from the upper left, a little toward the viewer
const depthOf = p => p[1] * GZ + p[2] * GY;
/* a screen direction as the world direction across the view that projects onto it (in the plane square to the camera) */
const proj2world = (sx, sy) => { const up = [0, -GY, GZ]; return norm(add([sx, 0, 0], mul(up, -sy))); };
const proj = p => [p[0], p[1] * GY - p[2] * GZ];
const D2R = Math.PI / 180, GOLDEN = 137.5 * D2R;

/* a limb grown from a point in a direction: bending up toward the light as it goes (more toward its tip), sagging in its middle under its weight,
   wandering a little; a point every `step` */
function grow(R, start, dir, L, o = {}){
  const step = o.step || 20, n = Math.max(2, Math.ceil(L / step)), pts = [start.slice()]; let d = norm(dir), p = start.slice();
  const up = o.up ?? .8, sag = o.sag ?? .4, wob = o.wob ?? .22, ph = R() * 6.3, ph2 = R() * 6.3;
  for(let k = 1; k <= n; k++){
    const t = k / n, bend = (up * (.25 + t) - sag * Math.sin(Math.PI * t) * (1 - t * .5)) * step / 100;
    const w = [Math.sin(ph + t * 5.1), Math.sin(ph2 + t * 4.3), 0];
    d = norm(add(add(d, [0, 0, bend]), mul(w, wob * step / 100)));
    p = add(p, mul(d, step)); pts.push(p);
  }
  return pts;
}
/* parallel-transport frames along a centreline: T (tangent), N and B (round it), N started as the part of `up` across the tangent */
function frames(pts){
  const n = pts.length, T = [], N = [], B = [];
  for(let i = 0; i < n; i++) T.push(norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
  let N0 = sub([0, 0, 1], mul(T[0], T[0][2])); if(len(N0) < .2) N0 = sub([0, 1, 0], mul(T[0], T[0][1])); N0 = norm(N0);
  N.push(N0); B.push(cross(T[0], N0));
  for(let i = 1; i < n; i++){ const ax = cross(T[i - 1], T[i]), s = len(ax); let Ni = N[i - 1]; if(s > 1e-6){ Ni = rotAbout(Ni, mul(ax, 1 / s), Math.asin(Math.min(1, s))); } Ni = norm(sub(Ni, mul(T[i], dot(Ni, T[i])))); N.push(Ni); B.push(cross(T[i], Ni)); }
  return {T, N, B};
}
const arcLen = pts => { const a = [0]; for(let i = 1; i < pts.length; i++) a.push(a[i - 1] + len(sub(pts[i], pts[i - 1]))); return a; };

/* ---------- the earlier fixed recipe: 'apple-classic' (generate({seed}) with no species) ----------
   One architecture (three scaffolds at the golden angle, a second tier, the same secondaries, shoots and spurs) varied only in lengths and angles: 300 seeds
   give three scaffolds every time and two shapes in all (ENVIRON-NOTES-TREE.md, Round 4). It is kept so the look the owner accepted stays reachable, and the
   stage builds on it until it is moved to the engine. Its random draws are in a fixed order: do not reorder them. */
function generateClassic(o = {}){
  const R = K.rng(o.seed ?? 11), H = o.height ?? 1750, zS = o.scaffoldAt ?? 600, az0 = o.az0 ?? .32;
  const B = [], add_ = b => { b.idx = B.length; b.kids = []; B.push(b); if(b.parent) b.parent.kids.push(b); return b; };
  /* the trunk and leader: a gentle lean and wander */
  const tp = []; for(let z = 0; z <= H; z += 20) tp.push([10 * Math.sin(z / 280 + 1) + z * .016, 7 * Math.sin(z / 330 + .4) - z * .008, z]);
  const trunk = add_({id:'trunk', order:0, pts:tp, parent:null, at:0, kind:'trunk'});
  const idxAtZ = (b, z) => { let k = 0; while(k < b.pts.length - 1 && b.pts[k][2] < z) k++; return k; };
  /* scaffolds: the golden angle round the trunk; the first heads front and right, where a stage's course goes */
  /* the first tier: three scaffolds from about 600 up, 190 apart along the trunk (orchard practice: 150-250, none above another), 46-58 degrees
     from the vertical */
  for(let i = 0; i < 3; i++){
    const h = zS + i * 190 + R() * 25, at = idxAtZ(trunk, h), az = az0 + i * GOLDEN, c = (46 + R() * 12) * D2R;
    const dir = [Math.sin(c) * Math.cos(az), Math.sin(c) * Math.sin(az), Math.cos(c)];
    add_({id:'s' + i, order:1, pts:grow(R, trunk.pts[at], dir, 820 + R() * 140 - i * 70, {step:22, up:.6, sag:.75, wob:.2}), parent:trunk, at, kind:'scaffold', az});
  }
  /* the leader's own limbs above the scaffolds */
  /* the second tier and above: the leader's own limbs, shorter as they go up */
  for(let j = 0, h = zS + 620; h < H - 140; j++, h += 170 + R() * 40){
    const at = idxAtZ(trunk, h), az = az0 + (3 + j) * GOLDEN, c = (46 + R() * 10) * D2R;
    add_({id:'u' + j, order:1, pts:grow(R, trunk.pts[at], [Math.sin(c) * Math.cos(az), Math.sin(c) * Math.sin(az), Math.cos(c)], 520 - j * 90 + R() * 50, {step:20, up:.8, sag:.4}), parent:trunk, at, kind:'upper', az});
  }
  /* a child off a branch at arc s (0..1): `angle` from the parent, turned round it by `roll` from straight up, a length, a habit */
  const child = (b, s, angle, roll, L, o2, id, kind, order) => {
    const A = arcLen(b.pts), want = s * A[A.length - 1]; let k = 0; while(k < A.length - 1 && A[k] < want) k++;
    const F = frames(b.pts), T = F.T[k]; let side = sub([0, 0, 1], mul(T, T[2])); if(len(side) < .2) side = F.N[k]; side = norm(rotAbout(norm(side), T, roll));
    const dir = norm(add(mul(T, Math.cos(angle)), mul(side, Math.sin(angle))));
    return add_({id, order, pts:grow(R, b.pts[k], dir, L, o2), parent:b, at:k, kind});
  };
  /* secondaries along the scaffolds and the upper limbs, alternating sides */
  for(const b of B.filter(q => q.order === 1)){
    const L1 = arcLen(b.pts).slice(-1)[0]; let side = R() < .5 ? 1 : -1, n = 0;
    for(let s = .18 + R() * .06; s < .92; s += (115 + R() * 40) / L1, side = -side, n++){
      const L2 = (210 + R() * 140) * (1 - .45 * s) * (b.kind === 'upper' ? .7 : 1);
      child(b, s, (38 + R() * 18) * D2R, side * (70 + R() * 45) * D2R, L2, {step:16, up:1.05, sag:.2, wob:.25}, b.id + 'b' + n, 'secondary', 2);
    }
  }
  /* leafy shoots (this year's growth) on the secondaries and the outer halves of the scaffolds and upper limbs; spurs on two-year wood */
  for(const b of B.filter(q => q.order === 1 || q.order === 2)){
    const L1 = arcLen(b.pts).slice(-1)[0], s0 = b.order === 1 ? .4 : .12; let n = 0, side = 1;
    for(let s = s0 + R() * .08; s < .97; s += (b.order === 1 ? 95 : 62 + R() * 30) / L1, side = -side, n++)
      child(b, s, (32 + R() * 22) * D2R, side * (40 + R() * 100) * D2R, 70 + R() * (b.order === 1 ? 120 : 90), {step:12, up:1.5, sag:.05, wob:.3}, b.id + 'h' + n, 'shoot', 3);
    /* the branch's own tip carries a shoot too */
    const e = b.pts.length - 1; n++;
    add_({id:b.id + 'h' + n, order:3, pts:grow(R, b.pts[e], norm(sub(b.pts[e], b.pts[e - 1])), 90 + R() * 60, {step:12, up:1.3, sag:0, wob:.25}), parent:b, at:e, kind:'shoot'});
    let m = 0;
    for(let s = (b.order === 1 ? .3 : .1) + R() * .1; s < .93; s += (60 + R() * 40) / L1, m++)
      child(b, s, (60 + R() * 30) * D2R, (R() * 2 - 1) * 110 * D2R, 16 + R() * 12, {step:6, up:.6, sag:0, wob:.1}, b.id + 'p' + m, 'spur', 3);
  }
  /* radii by the pipe model: tips carried; a tip is a shoot's or a spur's end */
  const tips = b => b._t ?? (b._t = 1 + b.kids.reduce((a, q) => a + tips(q), 0) - (b.kids.length && b.kind !== 'shoot' && b.kind !== 'spur' ? 1 : 0));
  for(const b of B){
    const n = b.pts.length, r0 = b.kind === 'spur' ? 4.6 : 3.4; b.r = [];
    for(let k = 0; k < n; k++){ let t = b.kind === 'spur' || b.kind === 'shoot' ? 1 : 0; for(const q of b.kids) if(q.at >= k) t += tips(q); if(b.kind !== 'spur' && b.kind !== 'shoot' && t === 0) t = 1; b.r.push(r0 * Math.sqrt(Math.max(1, t)) * (b.kind === 'shoot' ? 1 - .45 * k / n : 1)); }
  }
  /* a branch starts where it leaves its parent's surface (its first points, inside the parent, are dropped), with a collar a little wider than
     itself where it joins */
  for(const b of B){ b.trim = 0; if(!b.parent) continue; const P0 = b.parent.pts[b.at], rP = b.parent.r[b.at]; let k = 0; while(k < b.pts.length - 3 && len(sub(b.pts[k], P0)) < rP * .8) k++; b.trim = k; }
  for(const b of B){ if(b.parent) b.at = Math.max(0, b.at - b.parent.trim); }
  for(const b of B){ if(b.trim){ b.pts = b.pts.slice(b.trim); b.r = b.r.slice(b.trim); } if(b.parent) for(let q = 0; q < Math.min(4, b.r.length); q++) b.r[q] *= 1 + .22 * (1 - q / 4); }
  /* the trunk's flare: five lobes that widen the base and are gone by about 200 up */
  const flare = z => 1 + .6 * Math.exp(-Math.max(0, z) / 110);   // (young trees show little flare; the base about 1.6 times the trunk)
  trunk.lobes = {n:5, ph:R() * 6.3, amp:z => .34 * Math.exp(-Math.max(0, z) / 115)};
  trunk.r = trunk.r.map((r, k) => r * flare(trunk.pts[k][2]));
  /* surface roots: leaving the flare, gone into the soil within a short run */
  const roots = [];
  /* (each leaves the flare at a lobe, where the lobe runs down into it) */
  for(let k = 0; k < 5; k++){
    const a = (2 * Math.PI * k - trunk.lobes.ph) / 5 + (R() - .5) * .15, r0 = trunk.r[0], st = [Math.cos(a) * r0 * .55 + trunk.pts[0][0], Math.sin(a) * r0 * .55 + trunk.pts[0][1], 34];
    /* it runs out at the surface, half buried, and is gone into the soil where its top meets the ground */
    const L = 140 + R() * 130, bend = (R() - .5) * .5, pts = [], rs = [];
    for(let q = 0; q <= 12; q++){ const u = q / 12, th = a + bend * u * u, rr = (30 - 22 * Math.pow(u, .8)) * (.85 + .3 * R()), z = 34 - 46 * Math.pow(u, 1.5); if(z + rr * .6 < 0 && q > 3) break; pts.push([st[0] + Math.cos(th) * L * u, st[1] + Math.sin(th) * L * u, z]); rs.push(rr); }
    roots.push({id:'root' + k, pts, r:rs, a});
  }
  /* leaves: along shoots (alternate, 144 degrees apart) and in rosettes on spurs; each a frame: base, midrib direction, blade normal, size */
  const leaves = [];
  const leaf = (b, base, axis, around, k, L, incl = 32) => {
    /* the petiole leaves the stem at 45-65 degrees, turned round it; the blade is held up and out toward the light */
    const dirOut = norm(add(mul(axis, .5 + .2 * R()), mul(around, .85)));
    const pet = add(base, mul(dirOut, 24 + 10 * R()));
    let mid = norm(add(dirOut, [0, 0, -.25 + .4 * R()]));
    /* the blade's normal: up, leaned toward the light by `incl` degrees (the blade's inclination from the horizontal, measured: shoot leaves about 30,
       spur leaves about 45), held square to the midrib, with a little roll */
    const Lh = norm([LIGHT[0], LIGHT[1], 0]), a = (incl + (R() - .5) * 20) * D2R, n0 = add(mul([0, 0, 1], Math.cos(a)), mul(Lh, Math.sin(a)));
    const nrm = norm(rotAbout(norm(sub(n0, mul(mid, dot(n0, mid)))), mid, (R() - .5) * .4));
    leaves.push({branch:b, base, pet, mid, nrm, L:L * (.85 + .3 * R()), W:L * (.52 + .1 * R())});
  };
  for(const b of B){
    if(b.kind === 'shoot'){ const F = frames(b.pts), A = arcLen(b.pts), tot = A[A.length - 1]; let th = R() * 6.3, s = 14;
      while(s < tot - 4){ let k = 0; while(k < A.length - 1 && A[k] < s) k++; const around = rotAbout(F.N[k], F.T[k], th); leaf(b, b.pts[k], F.T[k], around, k, 64 + 18 * (s / tot), 30); th += 144 * D2R; s += 26 + R() * 10; }
      const e = b.pts.length - 1; leaf(b, b.pts[e], F.T[e], F.N[e], e, 58); }
    if(b.kind === 'spur'){ const F = frames(b.pts), e = b.pts.length - 1, n = 5 + Math.floor(R() * 3), th0 = R() * 6.3; for(let q = 0; q < n; q++) leaf(b, b.pts[e], F.T[e], rotAbout(F.N[e], F.T[e], th0 + q * 2 * Math.PI / n), e, 66 + 14 * R(), 45); }
  }
  /* fruit: on spurs in the outer crown that face the viewer, below the top; the course's scaffold's outermost such spur first */
  const spurs = B.filter(b => b.kind === 'spur'), outer = s => { const p = s.pts[s.pts.length - 1]; return Math.hypot(p[0], p[1]); };
  const cand = spurs.filter(s => { const p = s.pts[s.pts.length - 1]; return p[2] < H - 150 && p[2] > zS + 80 && depthOf(p) > depthOf(trunk.pts[idxAtZ(trunk, p[2])]) - 60 && outer(s) > 220; });
  const ancestor = b => { while(b.parent && b.order > 1) b = b.parent; return b; };
  const s0 = cand.filter(s => ancestor(s).id === 's0').sort((a, b) => outer(b) - outer(a))[0];
  const picked = s0 ? [s0] : [];
  for(const s of cand.sort((a, b) => depthOf(b.pts[b.pts.length - 1]) - depthOf(a.pts[a.pts.length - 1]))){ if(picked.length >= (o.fruit ?? 14)) break; const p = s.pts[s.pts.length - 1]; if(picked.every(q => len(sub(q.pts[q.pts.length - 1], p)) > 120)) picked.push(s); }
  /* in the order products take them: the course's own first, then each the farthest on screen from those already taken, so successive products spread
     over the crown (taken in depth order, the first three crowded one limb, and a small set apple hid between two ripe ones) */
  const tip = s => proj(s.pts[s.pts.length - 1]), order = picked.length ? [picked.shift()] : [];
  while(picked.length){ let bi = 0, bd = -1; picked.forEach((s, i) => { const p = tip(s), d = Math.min(...order.map(q => { const r = tip(q); return Math.hypot(p[0] - r[0], p[1] - r[1]); })); if(d > bd){ bd = d; bi = i; } }); order.push(picked.splice(bi, 1)[0]); }
  /* (the stalk about 20-28 long, measured for Gala-type apples; the apple hangs from it) */
  const fruit = order.map(s => { const p = s.pts[s.pts.length - 1], rr = 34 + 6 * R(), hang = add(p, [6 * (R() - .5), 4 + 6 * R(), -(22 + 6 * R()) - rr * .8]); return {spur:s, top:p, at:hang, r:rr, scaffold:ancestor(s).id}; });
  /* the trunk's centre and radius at a height (for a body that winds round it) */
  const trunkAt = z => { const k = Math.min(trunk.pts.length - 2, Math.max(0, Math.floor(z / 20))), u = Math.max(0, Math.min(1, (z - trunk.pts[k][2]) / 20)); return {c:add(trunk.pts[k], mul(sub(trunk.pts[k + 1], trunk.pts[k]), u)), r:trunk.r[k] + (trunk.r[k + 1] - trunk.r[k]) * u}; };
  return {B, trunk, roots, leaves, fruit, trunkAt, H, zS, seed:o.seed ?? 11, species:classicSpecies(), id:o.id ?? null, courseId:'s0', gR:520};
}

/* ---------- the family: a species grown by the engine ----------
   generate({species, id, life, mult, lean, budget}) grows the species' table on environ-growth.js (the seed is the id) and turns the plant into T:
     B       the branches: {id, order, kind, type, pts, r, parent, at, kids, idx, t (the turn it began), tn (the turn of each of its points), tip (its tip id)}. The engine's
             tip types map to the figure's kinds through the table (trunk, scaffold, upper, secondary, shoot, spur; order 0 the trunk, 1 a limb off it, 2 a secondary,
             3 a twig); a type with branch:false is foliage only (no wood: its leaves ride its parent's wood)
     leaves  {branch, base, pet, mid, nrm, L, W, shape}; roots; fruit the product places {spur, top, at, r, scaffold (its order-1 limb's id, or 'trunk')}
     species the table (what is drawn: leaf, product, blossom, bark, evergreen, ...); id; seed; plant (the engine's plant, for a later job that feeds it); H; zS; gR (the
     ground ring's radius); courseId (the limb a body climbs: chosen from the tree, see chooseCourse)
   The classic recipe gives the same fields (its course limb is 's0'). */
const PREFIX = {trunk:'trunk', scaffold:'s', upper:'u', secondary:'b', shoot:'h', spur:'p'};
const classicSpecies = () => ({key:'apple-classic', name:'Apple', latin:'Malus domestica', evergreen:false, classic:true, leaf:{shape:'ovate'},
  product:{kind:'apple', colors:{set:0x9DB860, ripening:0xB8963E, ripe:0xC44536, harvested:0xD4A03C, fallen:0x6B5B4F}}, blossom:{bud:0xD98FA6, open:0xFBF3F0}, bark:{tone:1, plates:1}, ground:{r:520}});
const VERT_BUDGET = 90000;   // (the kit spreads every vertex into one call: 120,000 is the most it can take)
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpN = (a, b, u) => a + (b - a) * u;
const pickN = (R, v) => Array.isArray(v) ? v[0] + (v[1] - v[0]) * R() : v;
/* the limb a body climbs: an order-1 limb that leaves the trunk well above the ground, is long and thick and lies across the view (its horizontal run on screen),
   leaning toward the viewer a little. The classic tree's was always 's0'. */
function chooseCourse(B, trunk, withProduct){
  const top = trunk.pts[trunk.pts.length - 1][2];
  const arc = b => { let a = 0; for(let i = 1; i < b.pts.length; i++) a += len(sub(b.pts[i], b.pts[i - 1])); return a; };
  const limbs = B.filter(b => b.order === 1 && b.kind !== 'trunk' && b.kind !== 'shoot' && b.kind !== 'spur' && b.pts.length >= 10);
  /* a limb with a product on it to climb to, and with room: its foot well above the ground (the helix round the trunk below it), then any limb, then the longest branch */
  const tiers = [b => b.pts[0][2] > top * .2 && b.pts[0][2] < top * .85, b => b.pts[0][2] > top * .1];
  let cand = []; for(const ok of tiers){ cand = limbs.filter(b => ok(b) && (!withProduct || withProduct.has(b.id))); if(cand.length) break; }
  if(!cand.length) cand = limbs.filter(b => !withProduct || withProduct.has(b.id));
  if(!cand.length) cand = limbs;
  let best = null, bs = -1;
  for(const b of cand){
    const e = b.pts[b.pts.length - 1], p0 = b.pts[0], L = arc(b) || 1, dx = Math.abs(e[0] - p0[0]), front = ((e[1] - p0[1]) / L + 1) / 2;
    const sc = Math.min(L, 1300) * b.r[Math.min(b.r.length - 1, 1)] * (dx / L) * (.55 + .45 * front);
    if(sc > bs){ bs = sc; best = b; }
  }
  if(!best) best = B.filter(b => b.order >= 1 && b.pts.length >= 4).sort((a, b) => arc(b) - arc(a))[0];
  return best ? best.id : 'trunk';
}
/* a leaf's frame: the petiole leaves the stem at 45-65 degrees turned round it; the blade is held up and out toward the light, leaned by `incl` degrees
   (the blade's measured inclination), square to the midrib, with a little roll */
function mkLeaf(out, R, hb, base, axis, around, L, spec){
  const dirOut = norm(add(mul(axis, .5 + .2 * R()), mul(around, .85))), pl = pickN(R, spec.pet || [24, 34]);
  const pet = add(base, mul(dirOut, pl));
  const mid = norm(add(dirOut, [0, 0, -.25 + .4 * R()]));
  const Lh = norm([LIGHT[0], LIGHT[1], 0]), a = ((spec.incl ?? 32) + (R() - .5) * 20) * D2R, n0 = add(mul([0, 0, 1], Math.cos(a)), mul(Lh, Math.sin(a)));
  const nrm = norm(rotAbout(norm(sub(n0, mul(mid, dot(n0, mid)))), mid, (R() - .5) * .4)), asp = pickN(R, spec.aspect ?? .56);
  out.push({branch:hb, base, pet, mid, nrm, L:L * (.85 + .3 * R()), W:L * (asp + .1 * (R() - .5)), shape:spec.shape});
}
/* needles: a tuft radiating from a point in a cone about the axis, drooping a little; each a thin blade that always shows its flat to the viewer */
function mkNeedles(out, R, hb, base, axis, N, B2, spec){
  const n = Math.max(1, Math.round(pickN(R, spec.n || [7, 10]))), spread = (spec.spread ?? 38) * D2R, th0 = R() * 6.3;
  for(let j = 0; j < n; j++){
    const a = th0 + j / n * 2 * Math.PI + (R() - .5) * .5, th = spread * (.35 + .65 * R()), ring = add(mul(N, Math.cos(a)), mul(B2, Math.sin(a)));
    let mid = norm(add(mul(axis, Math.cos(th)), mul(ring, Math.sin(th)))); mid = norm(add(mid, [0, 0, -(spec.droop ?? .12)]));
    const nrm = norm(sub(CAM, mul(mid, dot(CAM, mid)))), L = pickN(R, spec.len || [70, 110]);
    out.push({branch:hb, base, pet:base.slice(), mid, nrm, L, W:pickN(R, spec.width || 6), shape:'needle'});
  }
}
function placeLeaves(P, sp, R, B, byTip, hostOf, turnP){
  const out = [], along = sp.leaf && sp.leaf.along || {};
  const lay = (hb, pts, spec) => {
    if(pts.length < 2) return; const F = frames(pts), A = arcLen(pts), tot = A[A.length - 1], e = pts.length - 1, at = s => { let k = 0; while(k < A.length - 1 && A[k] < s) k++; return k; };
    const shape = sp.leaf.shape; spec = {shape, ...spec};
    if(spec.arrangement === 'alternate'){
      let th = R() * 6.3, s = spec.start ?? 14; const sz = spec.size ?? 64;
      while(s < tot - 4){ const k = at(s), around = rotAbout(F.N[k], F.T[k], th); mkLeaf(out, R, hb, pts[k], F.T[k], around, pickN(R, sz) + (spec.grow || 0) * (s / tot), spec); th += (spec.phyllo ?? 144) * D2R; s += pickN(R, spec.gap || [26, 36]); }
      if(spec.end) mkLeaf(out, R, hb, pts[e], F.T[e], F.N[e], spec.end, {...spec, incl:32});
    } else if(spec.arrangement === 'rosette'){
      const n = Math.floor(pickN(R, [spec.n[0], spec.n[1] + 1])), th0 = R() * 6.3;
      for(let q = 0; q < n; q++) mkLeaf(out, R, hb, pts[e], F.T[e], rotAbout(F.N[e], F.T[e], th0 + q * 2 * Math.PI / n), pickN(R, spec.size || [66, 80]), spec);
    } else if(spec.arrangement === 'cluster'){
      /* a few leaves at each station along the twig and a spray at its end */
      let s = spec.start ?? 0; const gap = spec.gap || [18, 26];
      while(s < tot){ const k = at(s), n = Math.max(1, Math.round(pickN(R, spec.n || [2, 3]))); for(let q = 0; q < n; q++) mkLeaf(out, R, hb, pts[k], F.T[k], rotAbout(F.N[k], F.T[k], R() * 6.3), pickN(R, spec.size || [44, 56]), spec); s += pickN(R, gap); }
      for(let q = 0; q < (spec.end ?? 2); q++) mkLeaf(out, R, hb, pts[e], F.T[e], rotAbout(F.N[e], F.T[e], R() * 6.3), pickN(R, spec.size || [44, 56]), spec);
    } else if(spec.arrangement === 'tuft'){
      let s = spec.start ?? 0; const gap = spec.gap || [60, 90];
      if(spec.along) while(s < tot - 8){ const k = at(s); mkNeedles(out, R, hb, pts[k], F.T[k], F.N[k], F.B[k], {...spec, n:spec.along}); s += pickN(R, gap); }
      mkNeedles(out, R, hb, pts[e], F.T[e], F.N[e], F.B[e], spec);
    }
  };
  for(const b of B){ const spec = along[b.type]; if(spec) lay(b, b.pts, spec); }
  /* foliage-only tips: their leaves ride the nearest wood above them, one group a fan (the topmost foliage-only tip under that wood), so the leaf fall and the
     year take a fan at a time, not the whole of a trunk's foliage at once. A group is a stand-in branch {id, host, parent, order 3, pts} that is not in B. */
  const fans = new Map();
  for(const tip of P.tips){
    const ty = P.species.types[tip.type]; if(ty.branch !== false) continue; const spec = along[tip.type], hb = hostOf(tip); if(!spec || !hb) continue;
    if(along[hb.type]){ lay(hb, tip.nodes.map(i => turnP(P.nodes[i].p)), spec); continue; }
    let top = tip; while(top.parent >= 0 && P.species.types[P.tips[top.parent].type].branch === false) top = P.tips[top.parent];
    let g = fans.get(top.id); if(!g){ g = {id:'f' + top.id, host:hb, parent:hb, order:3, kind:'foliage', pts:[turnP(P.nodes[top.nodes[0]].p)]}; fans.set(top.id, g); }
    lay(g, tip.nodes.map(i => turnP(P.nodes[i].p)), spec);
  }
  return out;
}
/* the places products hang: sites on the types the species names, in the outer crown, below the top, facing the viewer; the course limb's outermost first, then each
   the farthest on screen from those taken, so successive products spread over the crown. The filters are relaxed in turn if a tree has too few. */
function productSites(sp, B, trunk, H, ancestor, trunkAt){
  const pr = sp.product; if(!pr) return {cand:[]};
  const on = new Set(pr.on || []), sites = B.filter(b => on.has(b.type) && b.pts.length >= 2), n = pr.n ?? 14, tipOf = s => s.pts[s.pts.length - 1];
  const outerOf = s => { const p = tipOf(s); return Math.hypot(p[0] - trunk.pts[0][0], p[1] - trunk.pts[0][1]); };
  const levels = [[true, pr.outer ?? 220], [false, pr.outer ?? 220], [false, (pr.outer ?? 220) * .5], [false, 0]];
  let cand = [];
  for(const [facing, outer] of levels){
    cand = sites.filter(s => { const p = tipOf(s); return p[2] < H * (pr.zMax ?? .91) && p[2] > H * (pr.zMin ?? .34) + 40 && (!facing || depthOf(p) > depthOf(trunkAt(p[2]).c) - 60) && outerOf(s) > outer; });
    if(cand.length >= Math.min(n, 8)) break;
  }
  return {cand, outerOf, tipOf};
}
function pickProducts(sp, R, S, courseId, ancestor){
  const pr = sp.product; if(!pr) return [];
  const {cand, outerOf, tipOf} = S, n = pr.n ?? 14;
  const sep = (pr.sep ?? 120) * (pr.r ? (pr.r[0] + pr.r[1]) / 76 : 1), picked = [];
  const first = cand.filter(s => ancestor(s).id === courseId).sort((a, b) => outerOf(b) - outerOf(a))[0]; if(first) picked.push(first);
  /* (no limb takes more than perLimb: the first build put eight apples on one) */
  const per = pr.perLimb ?? 4, onLimb = s => picked.filter(q => ancestor(q).id === ancestor(s).id).length;
  for(const s of cand.slice().sort((a, b) => depthOf(tipOf(b)) - depthOf(tipOf(a)))){ if(picked.length >= n) break; if(!picked.includes(s) && onLimb(s) < per && picked.every(q => len(sub(tipOf(q), tipOf(s))) > sep)) picked.push(s); }
  if(picked.length < Math.min(n, 5)) for(const s of cand){ if(picked.length >= Math.min(n, 5)) break; if(!picked.includes(s) && picked.every(q => len(sub(tipOf(q), tipOf(s))) > sep * .4)) picked.push(s); }
  const tip2 = s => proj(tipOf(s)), order = picked.length ? [picked.shift()] : [];
  while(picked.length){ let bi = 0, bd = -1; picked.forEach((s, i) => { const p = tip2(s), d = Math.min(...order.map(q => { const r = tip2(q); return Math.hypot(p[0] - r[0], p[1] - r[1]); })); if(d > bd){ bd = d; bi = i; } }); order.push(picked.splice(bi, 1)[0]); }
  const hangK = {apple:.8, acorn:1.0, cone:1.2, berry:.7}[pr.kind] ?? .8;
  return order.map(s => { const p = tipOf(s), rr = pickN(R, pr.r || [34, 40]), st = pickN(R, pr.stalk || [22, 28]), hang = add(p, [6 * (R() - .5), 4 + 6 * R(), -(st + rr * hangK)]); return {spur:s, top:p, at:hang, r:rr, scaffold:ancestor(s).id}; });
}
function generateEngine(o){
  const G = growthOf(), name = o.species || 'apple', sp = G.species[name];
  if(!sp) throw new Error('environ-tree: no species ' + name + ' (the family: ' + Object.keys(G.species).join(', ') + ')');
  const id = String(o.id ?? 'tree'), seed = G.seedOf(id), P = G.grow(name, id, {life:o.life, mult:o.mult, lean:o.lean, budget:o.budget}), R = G.rng(G.seedOf(id + '\u0001draw'));
  const types = sp.types, rad = P.radii(), br = P.branches(), B = [], byTip = new Map();
  /* the tree is turned about its trunk to show its widest side to the view (a tree has no front; the stage's has one): the turn is chosen from the plant, so the
     same id always shows the same side. T.rot is the turn, in radians. */
  const rot = (() => { let best = 0, bw = -1; const nodes = P.nodes.filter(nd => nd.p[2] > 80 && types[nd.type].kind !== 'trunk');
    for(let k = 0; k < 24; k++){ const a = k * Math.PI / 12, c = Math.cos(a), s2 = Math.sin(a); let lo = 1e9, hi = -1e9, dep = 0;
      for(const nd of nodes){ const x = nd.p[0] * c - nd.p[1] * s2; if(x < lo) lo = x; if(x > hi) hi = x; dep += nd.p[0] * s2 + nd.p[1] * c; }
      const w = hi - lo + .15 * dep / Math.max(1, nodes.length) * 4; if(w > bw){ bw = w; best = a; } }
    return best; })();
  const rc = Math.cos(rot), rs = Math.sin(rot), turn = p => [p[0] * rc - p[1] * rs, p[0] * rs + p[1] * rc, p[2]];
  for(const bb of br){ if(rot) bb.pts = bb.pts.map(turn);
    /* (a branch of fewer than four points has no room for its collar: it is not drawn, and carries no leaves) */
    const ty = types[bb.type]; if(ty.branch === false || bb.pts.length < (bb.parent >= 0 ? 4 : 2)) continue;
    const par = bb.parent >= 0 ? byTip.get(bb.parent) : null; if(bb.parent >= 0 && !par) continue;
    const kind = ty.kind === 'trunk' && par ? 'scaffold' : ty.kind, small = kind === 'shoot' || kind === 'spur';
    /* the order: what grows off the trunk is a limb (1) unless it is a twig (3); the rest are secondaries (2) or twigs (3) */
    const order = !par ? 0 : small ? Math.max(3, ty.order) : par.order === 0 ? 1 : Math.max(2, ty.order);
    const b = {id:kind === 'trunk' ? 'trunk' : (PREFIX[kind] || 'x') + bb.id, order, kind, type:bb.type, pts:bb.pts.map(p => p.slice()), r:bb.nodes.map(i => rad[i]), parent:par, at:bb.at,
      t:bb.t0, tn:bb.nodes.map(i => P.nodes[i].t), tip:bb.id, idx:B.length, kids:[]};
    if(par) par.kids.push(b); B.push(b); byTip.set(bb.id, b);
  }
  const trunk = B[0]; if(!trunk || trunk.kind !== 'trunk') throw new Error('environ-tree: the species grew no trunk');
  const hostOf = tip => { let t = tip; while(t && types[t.type].branch === false) t = P.tips[t.parent]; return t ? byTip.get(t.id) : null; };
  /* the trunk's flare: lobes that widen the base and are gone a little way up (before the branches are trimmed to its surface) */
  const fl = sp.flare || {amount:.6, h:110}, lb = sp.lobes || {n:5, amp:.34, h:115}, flare = z => 1 + fl.amount * Math.exp(-Math.max(0, z) / fl.h);
  trunk.lobes = {n:lb.n, ph:R() * 6.3, amp:z => lb.amp * Math.exp(-Math.max(0, z) / lb.h)};
  trunk.r = trunk.r.map((r, k) => r * flare(trunk.pts[k][2]));
  /* a branch starts where it leaves its parent's surface (its first points, inside the parent, are dropped), with a collar a little wider than itself where it joins.
     (The parent's own collar is on its first four points, so a child that leaves one near its base clears the collared radius, not the bare one.) A branch too short to
     clear its parent's surface is not a branch but a stub inside it: it is dropped, and so is whatever grew from it (a twig is excepted: a stub is what a spur is). */
  for(const b of B){ b.trim = 0; if(!b.parent) continue; if(b.parent.drop){ b.drop = true; continue; }
    /* a child that leaves its parent inside the part of it that is trimmed away (inside the grandparent's surface) leaves the grandparent: it is the parent's sibling */
    while(b.parent.parent && b.at < b.parent.trim){ const par = b.parent; par.kids = par.kids.filter(q => q !== b); b.parent = par.parent; b.at = par.at; b.parent.kids.push(b); }
    const P0 = b.parent.pts[b.at], q0 = b.at - b.parent.trim, rP = b.parent.r[b.at] * (b.parent.parent && q0 >= 0 && q0 < 4 ? 1 + .22 * (1 - q0 / 4) : 1); let k = 0;
    while(k < b.pts.length - 3 && len(sub(b.pts[k], P0)) < rP * .8) k++; b.trim = k;
    if(b.kind !== 'spur' && len(sub(b.pts[k], P0)) < rP * .8 - 1e-6) b.drop = true; }
  for(const b of B) if(b.drop){ byTip.delete(b.tip); if(b.parent) b.parent.kids = b.parent.kids.filter(q => q !== b); }
  B.splice(0, B.length, ...B.filter(b => !b.drop)); B.forEach((b, i) => { b.idx = i; });
  /* a child that leaves its parent inside the part of it that was trimmed starts at the parent's first visible point, no thicker than the parent there */
  for(const b of B){ if(!b.parent) continue; if(b.at < b.parent.trim){ b.cap = b.parent.r[b.parent.trim]; b.at = 0; } else b.at -= b.parent.trim; }
  for(const b of B){ if(b.trim){ b.pts = b.pts.slice(b.trim); b.r = b.r.slice(b.trim); b.tn = b.tn.slice(b.trim); } if(b.cap) b.r = b.r.map(r => Math.min(r, b.cap)); if(b.parent) for(let q = 0; q < Math.min(4, b.r.length); q++) b.r[q] *= 1 + .22 * (1 - q / 4); }
  for(const b of B) if(b.order === 1){ const q = b.pts[Math.min(3, b.pts.length - 1)], p0 = b.pts[0]; b.az = Math.atan2(q[1] - p0[1], q[0] - p0[0]); }
  /* surface roots: leaving the flare, gone into the soil within a short run */
  const roots = [];
  for(let k = 0; k < (sp.roots ?? 5); k++){
    const nR = sp.roots ?? 5, a = (2 * Math.PI * k - trunk.lobes.ph) / nR + (R() - .5) * .15, r0 = trunk.r[0], st = [Math.cos(a) * r0 * .55 + trunk.pts[0][0], Math.sin(a) * r0 * .55 + trunk.pts[0][1], 34];
    const L = (140 + R() * 130) * (r0 / 70) ** .5, bend = (R() - .5) * .5, pts = [], rs = [], rs0 = Math.min(1.6, Math.max(.7, r0 / 70));
    for(let q = 0; q <= 12; q++){ const u = q / 12, th = a + bend * u * u, rr = (30 - 22 * Math.pow(u, .8)) * (.85 + .3 * R()) * rs0, z = 34 - 46 * Math.pow(u, 1.5); if(z + rr * .6 < 0 && q > 3) break; pts.push([st[0] + Math.cos(th) * L * u, st[1] + Math.sin(th) * L * u, z]); rs.push(rr); }
    roots.push({id:'root' + k, pts, r:rs, a});
  }
  let leaves = placeLeaves(P, sp, R, B, byTip, hostOf, turn);
  /* a cap on the leaves, so a dense tree stays inside what the kit can build (it holds every vertex in one array, and 120,000 is the most it can take) and what a frame
     can draw: the species' own cap, and the vertices left once the wood has its share. The thinning is even, from the tree's own random stream. */
  { const per = {ovate:22, round:22, lobed:40, needle:5}[sp.leaf.shape] ?? 22; let wood = 0;
    for(const b of B){ const cols = b.kind === 'trunk' ? 16 : b.order === 1 ? 10 : b.order === 2 ? 7 : b.kind === 'spur' ? 5 : 4; wood += (Math.ceil((b.pts.length - 1) / 2) + 1) * (cols + 1); }
    const cap = Math.min(sp.leaf.max ?? 1600, Math.floor((VERT_BUDGET - wood - 4000) / per));
    if(leaves.length > cap){ const key = leaves.map(() => R()), cut = key.slice().sort((a, b) => a - b)[Math.max(0, cap) - 1] ?? -1; leaves = leaves.filter((_, i) => key[i] <= cut); } }
  const H = B.reduce((m, b) => b.pts.reduce((m2, p) => Math.max(m2, p[2]), m), 0);   // the tree's height (an oak's bole is shorter than its crown)
  const trunkAt = z => { const T2 = trunk.pts; let k = 0; while(k < T2.length - 2 && T2[k + 1][2] < z) k++; const u = clampN((z - T2[k][2]) / ((T2[k + 1][2] - T2[k][2]) || 1), 0, 1); return {c:add(T2[k], mul(sub(T2[k + 1], T2[k]), u)), r:trunk.r[k] + (trunk.r[k + 1] - trunk.r[k]) * u}; };
  const ancestor = b => { while(b.parent && b.order > 1) b = b.parent; return b.order === 1 ? b : trunk; };
  const sites = productSites(sp, B, trunk, H, ancestor, trunkAt), courseId = chooseCourse(B, trunk, new Set(sites.cand.map(s => ancestor(s).id))), fruit = pickProducts(sp, R, sites, courseId, ancestor);
  const zS = B.filter(b => b.order === 1).reduce((m, b) => Math.min(m, b.pts[0][2]), H);
  return {B, trunk, roots, leaves, fruit, trunkAt, H, zS, seed, id, rot, species:{key:name, ...sp}, plant:P, courseId, gR:sp.ground ? sp.ground.r : 520, opts:P.opts};
}
/* the entry: a species and an id grow a tree on the engine; no species and no id is the earlier recipe (the stage's call), as is 'apple-classic' */
function generate(o = {}){
  if(o.species == null && o.id == null) return generateClassic(o);
  if(o.species === 'apple-classic') return generateClassic({...o, seed:o.seed ?? growthOf().seedOf(o.id ?? 'tree')});
  return generateEngine(o);
}

/* ---------- the course a body climbs: round the trunk, then out along the tree's course limb (T.courseId: the classic's 's0'; a grown tree's is chosen
   from it) on its upper side ---------- */
function course(T, o = {}){
  const bodyB = o.bodyB ?? 15, pitch = o.pitch ?? 250, dir = o.dir ?? -1, a0 = o.a0 ?? 2.3, z0 = o.z0 ?? 14, cid = o.limb ?? T.courseId ?? 's0', s = T.B.find(b => b.id === cid), z1 = Math.min(o.z1 ?? 1e9, s.pts[0][2] - 40);
  const pts = [], turns = (z1 - z0) / pitch, n = Math.ceil(turns * 90);
  for(let q = 0; q <= n; q++){ const u = q / n, a = a0 + dir * turns * 2 * Math.PI * u, z = z0 + (z1 - z0) * u, t = T.trunkAt(z), lob = T.trunk.lobes.amp(z) * Math.cos(T.trunk.lobes.n * a + T.trunk.lobes.ph), rr = t.r * (1 + Math.max(0, lob)) + bodyB + 2; pts.push([t.c[0] + rr * Math.cos(a), t.c[1] + rr * Math.sin(a), z]); }
  const helixEnd = pts.length;
  /* onto the scaffold: over its upper side from its base out toward the course's fruit */
  const F = frames(s.pts), on = k => { const up = norm(sub([0, 0, 1], mul(F.T[k], F.T[k][2]))); return add(s.pts[k], mul(up, s.r[k] + bodyB + 1)); };
  const fr = T.fruit.find(f => f.scaffold === cid), A = arcLen(s.pts); let kEnd = s.pts.length - 3;
  if(fr){ let best = 1e9; for(let k = 2; k < s.pts.length - 2; k++){ const d = len(sub(s.pts[k], fr.top)); if(d < best){ best = d; kEnd = k; } } kEnd = Math.min(s.pts.length - 3, kEnd + 2); }
  if(!T.species.classic) kEnd = Math.max(kEnd, Math.min(s.pts.length - 3, 8));   // (a grown tree's course runs out along its limb at least this far, whatever the product's place)
  const last = pts[pts.length - 1], j0 = 2, join = add(mul(last, .5), mul(on(j0), .5)); join[2] += 12;
  const run = [join]; for(let k = j0; k <= kEnd; k += 1) run.push(on(k));
  return {helix:pts, branch:run, all:pts.concat(run), helixEnd, pitch, dir, a0, z0, z1, fruit:fr};
}

/* ---------- the kit figure(s) ----------
   figure(o): {T (the generated tree), view [x, y, w, h] in the body's screen units, id, split (a function (part) -> 'front' | 'back')}. The kit canvas
   is 1000 wide (the creatures' own), so the kit's line weights are theirs: kit = (screen - view corner) * 1000 / w. Defines o.id and, if split is
   given, o.id + 'Front'. */
function figure(o){
  K.require('1.1.0', 'environ-tree');
  const T = o.T, V = o.view, sc = 1000 / V[2], W = 1000, Hh = Math.round(V[3] * sc), id = o.id || 'tree';
  /* what is drawn of the species: its leaf, product, blossom and bark (a classic tree has the apple's) */
  const SP = T.species || classicSpecies(), LF = SP.leaf || {shape:'ovate'}, PR = SP.product || classicSpecies().product, BL = SP.blossom, BK = SP.bark || {}, gR = (T.gR ?? 520) / 520, courseId = T.courseId ?? 's0';
  const kp = p => { const s = proj(p); return [(s[0] - V[0]) * sc, (s[1] - V[1]) * sc]; };
  const mkModel = (mid, name) => K.model({id:mid, name, sign:'', title:name.toUpperCase(), sub:SP.latin || '', w:W, h:Hh, pivot:kp([0, 0, 0]), axis:kp([0, 0, 0])[0], ink:BK.ink || K.ROSTER.umber, accent:LF.accent || K.ROSTER.malachite,
    zones:{crown:.7, trunk:.15, roots:.15, fruit:0, blossom:0, seed:0}, cam:[1, W / 2, Hh / 2]});
  const MB = mkModel(id, (SP.name || 'Apple') + ' tree'), MF = o.split ? mkModel(id + 'Front', (SP.name || 'Apple') + ' tree, front') : null;
  /* bones: the base, the trunk (rigid), one per order-1 limb (a secondary chain: it gives under a load and settles), one per fruit (its scale is its growth) */
  const bonesFor = M => {
    M.bone('base', null, kp([0, 0, 0]), kp([0, 0, 60]), {grp:'root', anat:false});
    M.bone('trunk', 'base', kp([0, 0, 0]), kp(T.trunk.pts[T.trunk.pts.length - 1]), {grp:'root', lim:[-.01, .01], anat:false});
    for(const b of T.B.filter(q => q.order === 1)) M.bone('L_' + b.id, 'trunk', kp(b.pts[0]), kp(b.pts[b.pts.length - 1]), {grp:'crown', lim:[-.06, .06], sec:true, speed:2.2, anat:false});
    T.fruit.forEach((f, k) => M.bone('fr' + k, f.scaffold === 'trunk' ? 'trunk' : 'L_' + f.scaffold, kp(f.top), kp(f.at), {grp:'fruit', lim:[-.4, .4], sec:true, speed:5, anat:false}));
  };
  bonesFor(MB); if(MF) bonesFor(MF);
  const limbOf = b => { while(b.parent && b.order > 1) b = b.parent; return b.order === 1 ? 'L_' + b.id : 'trunk'; };
  /* a part from 3D cells: verts (3D), polys (index lists), tones; its outline from the projected centreline (a tube's) or given */
  const LINES = {
    bark:{k:.52, c:.8, r:'b', t:'bone', tk:.18}, twig:{k:.5, c:.78, r:'f', t:'bone', tk:.18}, root:{k:.46, c:.7, r:'b', t:'bone', tk:.1},
    leaf:{k:.5, c:.72, r:'f', t:'bone', tk:.12}, fruit:{k:.55, c:.85, r:'f', t:'bone', tk:.2},
  };
  let nParts = 0;
  /* every growable part declares its organ, the point in the world it grows about, and its parent part. The same declarations are the def's
     growth hierarchy (NODES, attached below): a leaf group can be drawn in the front model while its shoot is in the back, so the hierarchy is
     kept for the whole tree, not per model. */
  const NODES = [], FALLS = [];
  const part = (M, name, verts, polys, tones, opt) => {
    const base = opt.base ? kp(opt.base) : null;
    const P = M.part(name, {line:LINES[opt.line], layer:opt.layer, tier:opt.tier || 'M', zone:opt.zone, ink:opt.ink, tags:opt.tags, bind:opt.bind, noSil:true,
      organ:opt.organ, base, parent:opt.parent || null, tone:(x, y, i) => tones[i - P.p0] ?? .05});
    if(opt.organ) NODES.push({name, organ:opt.organ, base, parent:opt.parent || null});
    const ids = verts.map(p => { const k = kp(p); return M.vtx(P, k[0], k[1], 0); });
    for(const pl of polys) M.poly(P, pl.map(q => ids[q]));
    if(opt.outline){ P.loop = opt.outline.map(p => { const k = kp(p); return M.vtx(P, k[0], k[1], 0); }); }
    M.close(P); nParts++; return P;
  };
  /* a tube's visible cells between rings a and b of a branch; plates longer than wide in alternate rows; shaded by the light */
  /* (stride: rings every `stride` points, so the plates are longer than wide; the plates' corners are moved a little along the axis, so they are
     irregular, as bark is) */
  const tube = (M, b, a, e, cols, stride = 1) => {
    const F = frames(b.pts), verts = [], ring = [], polys = [], tones = [], dth = 2 * Math.PI / cols, at = [];
    const lob = b.lobes;
    for(let i = a; i <= e; i += stride) at.push(i); if(at[at.length - 1] !== e) at.push(e);
    at.forEach((i, ri) => { const row = []; const sp = ri ? len(sub(b.pts[i], b.pts[at[ri - 1]])) : 0;
      for(let j = 0; j <= cols; j++){ const th = (j + (ri & 1) * .5) * dth; let r = b.r[i]; if(lob) r *= 1 + lob.amp(b.pts[i][2]) * Math.cos(lob.n * th + lob.ph); r *= 1 + .04 * Math.sin(i * 2.3 + j * 1.7);
        const nr = add(mul(F.N[i], Math.cos(th)), mul(F.B[i], Math.sin(th))), jig = ri && ri < at.length - 1 ? (K.hash(i * 97 + j * 13 + 5) - .5) * .45 * sp : 0;
        row.push(verts.length); verts.push(add(add(b.pts[i], mul(nr, r)), mul(F.T[i], jig))); }
      ring.push(row); });
    for(let i = 0; i < ring.length - 1; i++) for(let j = 0; j < cols; j++){
      const q = [ring[i][j], ring[i][j + 1], ring[i + 1][j + 1], ring[i + 1][j]], c0 = mul(add(add(verts[q[0]], verts[q[1]]), add(verts[q[2]], verts[q[3]])), .25), ii = at[i];
      const nr = norm(sub(c0, b.pts[ii])), facing = dot(nr, CAM); if(facing < -.08) continue;
      polys.push(q); const lit = Math.max(0, dot(nr, LIGHT)), rim = Math.max(0, 1 - facing * 2.2);
      tones.push(Math.max(.01, (.03 + .13 * lit * lit - .03 * rim + .025 * K.hash(ii * 31 + j)) * DEPTHK(depthOf(c0))));
    }
    /* its outline: the projected centreline offset by its radius across the screen (an orthographic tube is as wide as it is round) */
    const s2 = []; for(let i = a; i <= e; i++) s2.push(proj(b.pts[i]));
    const L = [], Rr = [];
    for(let i = a; i <= e; i++){ const k = i - a, p = s2[k], q = s2[Math.min(s2.length - 1, k + 1)], m = s2[Math.max(0, k - 1)], tx = q[0] - m[0], ty = q[1] - m[1], l = Math.hypot(tx, ty) || 1;
      /* (across the flare the outline follows the lobe that stands out on each side) */
      const side = sgn => { if(!b.lobes) return b.r[i]; const n = norm(sub(proj2world(sgn * -ty / l, sgn * tx / l), [0, 0, 0])); let best = 0; for(let j = 0; j < 24; j++){ const th = j / 24 * 2 * Math.PI, rr = b.r[i] * (1 + b.lobes.amp(b.pts[i][2]) * Math.cos(b.lobes.n * th + b.lobes.ph)), F2 = frames(b.pts.slice(Math.max(0, i - 1), i + 2)), nr = add(mul(F2.N[Math.min(1, i)], Math.cos(th)), mul(F2.B[Math.min(1, i)], Math.sin(th))), w = dot(nr, n) * rr; if(w > best) best = w; } return best; };
      const rl = side(1), rr = side(-1); L.push([p[0] - ty / l * rl, p[1] + tx / l * rl]); Rr.unshift([p[0] + ty / l * rr, p[1] - tx / l * rr]); }
    const back = L.concat(Rr).map(p => [p[0], p[1]]);
    return {verts, polys, tones, outline2:back, depth:depthOf(b.pts[(a + e) >> 1])};
  };
  /* the 2D outline needs to be given as world points the projection returns: lift it back (any world point projecting there will do: Y = y / GY at Z 0) */
  const lift = p2 => [p2[0], p2[1] / GY, 0];
  /* further back is darker: the crown has depth (a factor from .55 at the back to 1.1 at the front) */
  const DEPTHK = dp => .55 + .55 * Math.max(0, Math.min(1, (dp - depthRange[0]) / (depthRange[1] - depthRange[0])));
  const depthRange = (() => { let lo = 1e9, hi = -1e9; for(const b of T.B) for(const p of b.pts){ const d = depthOf(p); if(d < lo) lo = d; if(d > hi) hi = d; } return [lo - 100, hi + 100]; })();
  const layerOf = d => 2 + 90 * (d - depthRange[0]) / (depthRange[1] - depthRange[0]);
  const which = P => (MF && o.split(P) === 'front') ? MF : MB;
  /* branches, cut into segments drawn in depth order */
  for(const b of T.B){
    const n = b.pts.length, isTrunk = b.kind === 'trunk', small = b.kind === 'shoot' || b.kind === 'spur';
    /* one part a branch (a part's outline is closed, so a branch cut into parts would show a band at every cut); the trunk's plates are about
       24 across and 40 tall */
    let cols = isTrunk ? 16 : b.order === 1 ? 10 : b.order === 2 ? 7 : b.kind === 'spur' ? 5 : 4, stride = isTrunk || b.order === 1 ? 2 : b.order === 2 ? 2 : b.kind === 'shoot' ? 3 : 2;
    if(!SP.classic){
      /* a grown tree's points are as its species stepped them: rings every so far along, whatever the step (the classic's: 40, 44, 40, 32, 36, 12) */
      let a = 0; for(let i = 1; i < n; i++) a += len(sub(b.pts[i], b.pts[i - 1])); const sp0 = a / Math.max(1, n - 1) || 20, want = isTrunk ? 42 : b.order === 1 ? 42 : b.order === 2 ? 32 : b.kind === 'spur' ? 12 : 30;
      stride = clampN(Math.round(want / sp0), 1, 5);
      if(BK.plates && BK.plates !== 1) cols = Math.max(3, Math.round(cols / BK.plates));
    }
    const t = tube(null, b, 0, n - 1, cols, stride);
    if(BK.tone && BK.tone !== 1) for(let i = 0; i < t.tones.length; i++) t.tones[i] *= BK.tone;
    /* a branch whose cells all face away has no part, but it is still a node of the growth hierarchy: its leaves and blossoms compose through it */
    if(!t.polys.length){ NODES.push({name:'w_' + b.id, organ:isTrunk ? 'trunk' : small ? 'shoot' : 'limb', base:kp(b.pts[0]), parent:b.parent ? 'w_' + b.parent.id : null}); continue; }
    const info = {kind:b.kind, id:b.id, depth:t.depth, mid:b.pts[n >> 1], b}, M = which(info);
    part(M, 'w_' + b.id, t.verts, t.polys, t.tones, {line:small ? 'twig' : 'bark', layer:layerOf(t.depth) + (small ? .3 : 0) - (isTrunk ? 4 : 0), tier:small ? 'F' : 'M', zone:isTrunk ? 'trunk' : 'branches',
      organ:isTrunk ? 'trunk' : small ? 'shoot' : 'limb', base:b.pts[0], parent:b.parent ? 'w_' + b.parent.id : null,
      bind:{rigid:isTrunk ? 'trunk' : limbOf(b)}, tags:['wood', b.kind, b.id], outline:t.outline2.map(lift)});
  }
  /* the ground under it: a disc of soil, so the tree stands on something (a stage that draws its own ground, with the record on it, asks for none) */
  if(o.ground !== false){ const verts = [], polys = [], tones = [], n = 28, rings = [0, .45, .75, 1], R0 = 520 * gR, c0 = T.trunk.pts[0];
    for(let i = 0; i < rings.length; i++) for(let j = 0; j < (i ? n : 1); j++){ const a = j / n * 2 * Math.PI + (i & 1) * Math.PI / n, r = rings[i] * R0 * (1 + .05 * Math.sin(a * 3 + i)); verts.push([c0[0] + Math.cos(a) * r, c0[1] + Math.sin(a) * r, 0]); }
    const id = (i, j) => i === 0 ? 0 : 1 + (i - 1) * n + ((j % n) + n) % n;
    for(let j = 0; j < n; j++){ polys.push([0, id(1, j), id(1, j + 1)]); tones.push(.02); }
    for(let i = 1; i < rings.length - 1; i++) for(let j = 0; j < n; j++){ polys.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]); tones.push(.025 - .006 * i); }
    part(MB, 'ground', verts, polys, tones, {line:{k:.18, c:.25, r:'f'}, layer:0, tier:'L', zone:'ground', bind:{rigid:'base'}, tags:['ground']}); }
  /* the seed: an apple pip on the ground at the trunk's foot, the one organ that holds the empty start of the year (its weight is PHENOLOGY's
     seed). It is drawn in the ground's own layer, in front of it, and shrinks to nothing as the rootling takes over. */
  { const f = kp(T.trunk.pts[0]), cx = f[0] - 58, cy = f[1] - 7, a = -.5, ca = Math.cos(a), sa = Math.sin(a), pts = [];
    for(let i = 0; i < 14; i++){ const th = i / 14 * 2 * Math.PI, rr = 1 - .24 * Math.cos(th), x = Math.cos(th) * 15 * rr, y = Math.sin(th) * 26 * (1 - .08 * Math.cos(th)); pts.push([cx + x * ca - y * sa, cy + x * sa + y * ca]); }
    MB.shape('seed', pts, {line:{k:.5, c:.7, r:'f', t:'bone', tk:.12}, layer:1, tier:'L', zone:'seed', noSil:true, tone:() => .42,
      organ:'seed', base:[cx, cy], parent:null, bind:{rigid:'base'}, tags:['seed']});
    NODES.push({name:'seed', organ:'seed', base:[cx, cy], parent:null});
  }
  /* surface roots */
  for(const r of T.roots){ const t = tube(null, {pts:r.pts, r:r.r}, 0, r.pts.length - 1, 8); part(MB, r.id, t.verts, t.polys, t.tones.map(x => x * .8), {line:'root', layer:layerOf(t.depth) - (depthOf(r.pts[5]) < 0 ? 1 : 0), tier:'M', zone:'roots',
    organ:'root', base:r.pts[0], parent:null, bind:{rigid:'base'}, tags:['root'], outline:t.outline2.map(lift)}); }
  /* leaves, a part per shoot or spur: each blade two halves either side of its midrib, base and tip cells, and its petiole as a sliver. The blade's outline is the
     species': ovate (the apple's), round, lobed (the oak's), or a needle (one thin cell that always shows its flat). */
  const BLADES = {
    ovate:{us:[0, .16, .38, .62, .84, 1], hw:u => Math.pow(Math.sin(Math.PI * Math.pow(u, .78)), .9) * (1 - .18 * u), cut:3},
    round:{us:[0, .2, .45, .7, .9, 1], hw:u => Math.pow(Math.sin(Math.PI * Math.pow(u, .9)), .72), cut:3},
    lobed:{us:[0, .08, .18, .28, .38, .48, .58, .68, .78, .87, .95, 1], hws:[0, .24, .36, .72, .5, .92, .62, 1, .72, .8, .42, 0], cut:6},
  };
  const groups = new Map(); for(const L of T.leaves){ const g = groups.get(L.branch) || []; g.push(L); groups.set(L.branch, g); }
  for(const [b, list] of groups){
    const verts = [], polys = [], tones = [], lv = []; let dsum = 0;
    for(const L of list){
      const side = norm(cross(L.nrm, L.mid)), facing = Math.abs(dot(L.nrm, CAM)); if(facing < .12) continue;
      const lv0 = verts.length;
      const P0 = L.pet, at = (u, v) => add(add(P0, mul(L.mid, u * L.L)), mul(side, v * L.W * .5));
      const lit = Math.max(0, dot(L.nrm[2] >= 0 ? L.nrm : mul(L.nrm, -1), LIGHT)), under = dot(L.nrm, CAM) < 0 ? 1 : 0, dk = DEPTHK(depthOf(L.pet));
      if(L.shape === 'needle'){
        /* a needle: base, shoulders and tip, one cell, tone by its light */
        const b0 = verts.length; verts.push(at(0, .6), at(.5, 1), at(1, 0), at(.5, -1), at(0, -.6)); polys.push([b0, b0 + 1, b0 + 2, b0 + 3, b0 + 4]);
        tones.push(Math.max(.04, (.1 + .22 * lit - .05 * under + .04 * K.hash(lv0 * 7 + 3)) * dk));
        lv.push({v0:lv0, v1:verts.length}); dsum += depthOf(L.pet); continue;
      }
      const BL2 = BLADES[L.shape] || BLADES.ovate, us = BL2.us, nU = us.length, hwAt = i => BL2.hws ? BL2.hws[i] : BL2.hw(us[i]), base = verts.length;
      us.forEach((u, i) => { const w = hwAt(i); verts.push(at(u, 0)); verts.push(at(u, w)); verts.push(at(u, -w)); });
      const V = (k, s) => base + k * 3 + s;   // s: 0 midrib, 1 left edge, 2 right edge
      /* each half: a base cell and a tip cell, the margin running through all the stations; the gap between the halves is the midrib */
      for(const sd of [1, 2]){
        const A = [V(0, 0)]; for(let i = 1; i <= BL2.cut; i++) A.push(V(i, sd)); A.push(V(BL2.cut, 0)); polys.push(A);
        const Bq = [V(BL2.cut, 0)]; for(let i = BL2.cut; i <= nU - 2; i++) Bq.push(V(i, sd)); Bq.push(V(nU - 1, 0)); polys.push(Bq);
        for(let q = 0; q < 2; q++) tones.push(Math.max(.04, (.12 + .2 * lit * (sd === 1 ? 1 : .85) - .07 * under + .03 * q) * dk));
      }
      /* the petiole: a sliver from the stem to the blade */
      const pb = verts.length, sd2 = mul(side, 2.2); verts.push(add(L.base, sd2), add(L.pet, sd2), add(L.pet, mul(sd2, -1)), add(L.base, mul(sd2, -1))); polys.push([pb, pb + 1, pb + 2, pb + 3]); tones.push(.1);
      lv.push({v0:lv0, v1:verts.length});
      dsum += depthOf(L.pet);
    }
    if(!polys.length) continue;
    const depth = dsum / list.length, info = {kind:'leaves', id:b.id, depth, mid:list[0].pet, b}, M = which(info);
    let bx = 0, by = 0, bz = 0; for(const L of list){ bx += L.base[0]; by += L.base[1]; bz += L.base[2]; }
    const P = part(M, 'lv_' + b.id, verts, polys, tones, {line:'leaf', layer:layerOf(depth) + .5, tier:'F', zone:'crown', ink:'accent',
      organ:'leaf', base:[bx / list.length, by / list.length, bz / list.length], parent:'w_' + (b.host || b).id, bind:{rigid:limbOf(b.host || b)}, tags:['leaves', b.id]});
    /* the fall: one morph a group, each leaf lying flat on the ground ring about the trunk's foot. The landing coordinates are fixed here, so
       the morph touches only this group's vertices; its weight (the fraction fallen) is set by growStep from the year's leafFall. */
    if(!SP.evergreen){ const KP = verts.map(kp), n = verts.length, DX = new Float32Array(n), DY = new Float32Array(n), LG = new Float32Array(n);
      lv.forEach((q, li) => {
        const m = q.v1 - q.v0; if(!m) return;
        let cx = 0, cy = 0; for(let j = q.v0; j < q.v1; j++){ cx += KP[j][0]; cy += KP[j][1]; } cx /= m; cy /= m;
        const h1 = K.hash(q.v0 * 31 + b.id.length * 7 + 11), h2 = K.hash(q.v0 * 17 + 3), h3 = K.hash(q.v0 * 53 + 29);
        const a = h1 * Math.PI * 2, rad = (150 + h2 * 310) * gR, g = kp([Math.cos(a) * rad, Math.sin(a) * rad, 0]);
        const th = h3 * Math.PI * 2, ca = Math.cos(th), sa = Math.sin(th), tx = g[0], ty = g[1] - 1.5;
        for(let j = q.v0; j < q.v1; j++){
          const px = KP[j][0] - cx, py = KP[j][1] - cy, rx = px * ca - py * sa, ry = (px * sa + py * ca) * .30;
          DX[j] = tx + rx - KP[j][0]; DY[j] = ty + ry - KP[j][1]; LG[j] = .55 * (li / Math.max(1, lv.length - 1)) + .08 * h3;
        }
      });
      const p0 = P.v0;
      M.morph('fall_' + b.id, (x, y, PP, v) => { const j = v - p0; return j >= 0 && j < n ? [DX[j], DY[j]] : null; }, {part:'lv_' + b.id, k:8, lag:(x, y, PP, v) => LG[v - p0] || 0});
      FALLS.push({name:'fall_' + b.id, start:0});
    }
  }
  /* blossom: a cluster on every product's site and on the twelve next sites that face the viewer. One part a site, so the organ's weight (the
     year's blossom) scales the cluster about the site's tip; pink in the bud, white at full flower (the colour is in look()). A species with no blossom has none. */
  if(BL){ const seen = new Set(), spurs = [], onSite = BL.on ? b => BL.on.includes(b.type) : b => b.kind === 'spur';
    for(const f of T.fruit) if(!seen.has(f.spur)){ seen.add(f.spur); spurs.push(f.spur); }
    const extra = T.B.filter(b => onSite(b) && !seen.has(b) && depthOf(b.pts[b.pts.length - 1]) > depthRange[0] + (depthRange[1] - depthRange[0]) * .3)
      .sort((a, b) => depthOf(b.pts[b.pts.length - 1]) - depthOf(a.pts[a.pts.length - 1])).slice(0, BL.extra ?? 12);
    const bs = BL.size ?? 1;
    for(const spur of spurs.concat(extra)){
      const tip = spur.pts[spur.pts.length - 1], c = kp(tip), depth = depthOf(tip), info = {kind:'blossom', id:spur.id, depth, mid:tip, b:spur}, M = which(info);
      const R = K.rng(Math.floor(K.hash(spur.id.length * 71 + depth * 13 + 5) * 1e9)), shapes = [];
      for(let q = 0; q < (BL.n ?? 3); q++){
        const ox = c[0] + (R() - .5) * 20 * bs, oy = c[1] + (R() - .5) * 13 * bs, a0 = R() * 6.283, s = (.82 + R() * .34) * bs;
        for(let j = 0; j < 5; j++){
          const a = a0 + j / 5 * Math.PI * 2, px = ox + Math.cos(a) * 7 * s, py = oy + Math.sin(a) * 7 * s, ca = Math.cos(a), sa = Math.sin(a), pts = [];
          for(let v = 0; v < 8; v++){ const th = v / 8 * Math.PI * 2, rx = Math.cos(th) * 5.4 * s, ry = Math.sin(th) * 3.8 * s; pts.push([px + rx * ca - ry * sa, py + rx * sa + ry * ca]); }
          shapes.push(pts);
        }
        const ctr = []; for(let v = 0; v < 6; v++){ const th = v / 6 * Math.PI * 2; ctr.push([ox + Math.cos(th) * 2.4 * bs, oy + Math.sin(th) * 2.4 * bs]); } shapes.push(ctr);
      }
      M.shapes('bl_' + spur.id, shapes, {layer:layerOf(depth) + .55, tier:'F', zone:'blossom', ink:'accent', line:{k:.5, c:.72, r:'f', t:'bone', tk:.12}, noSil:true,
        tone:() => .56, organ:'blossom', base:c, parent:'w_' + spur.id, bind:{rigid:limbOf(spur)}, tags:['blossom', spur.id]});
      NODES.push({name:'bl_' + spur.id, organ:'blossom', base:c, parent:'w_' + spur.id});
    }
  }
  /* fruit: a product each on its own bone, with its stalk; its tone shades it round. Drawn over the leaves: a product must read at a glance (the places were
     chosen on the side of the crown that faces the viewer). The apple and the berry are round; the acorn is a tall nut under a cap; the cone a tall scaled ellipse. */
  const PK = PR.kind || 'apple', PSX = {apple:1, berry:1, acorn:.66, cone:.44}[PK] ?? 1, PRINGS = {apple:[[0, .5, .86, 1], [5, 9, 12]], berry:[[0, .55, 1], [4, 8]], acorn:[[0, .5, .86, 1], [5, 9, 12]], cone:[[0, .3, .6, .85, 1], [5, 8, 10, 12]]}[PK] || [[0, .5, .86, 1], [5, 9, 12]];
  T.fruit.forEach((f, k) => {
    for(const M of MF ? [MB, MF] : [MB]){
      const front = MF && o.split({kind:'fruit', id:'fr' + k, depth:depthOf(f.at), mid:f.at}) === 'front'; if(MF && (M === MF) !== !!front) continue;
      const c2 = kp(f.at), rr = f.r * sc, fb = kp(f.top);
      M.polar('fruit' + k, c2, PRINGS[0].map(q => rr * q), PRINGS[1], {layer:93 + k * .01, tier:'F', zone:'fruit', line:LINES.fruit, noSil:true, bind:{rigid:'fr' + k}, tags:['fruit', 'fruit' + k], sx:PSX,
        organ:'fruit', base:fb, parent:'w_' + f.spur.id,
        tone:(x, y) => { const dx = (x - c2[0]) / (rr * PSX), dy = (y - c2[1]) / rr; return Math.max(.08, .42 - .3 * Math.hypot(dx + .35, dy + .4) + (PK === 'cone' ? .09 * Math.cos(dy * 11) : 0)); }});
      if(PK === 'acorn'){
        /* the cup on the nut: a cap with its stem */
        const w = rr * PSX, y0 = c2[1] - rr * .52, cap = [[c2[0] - w * 1.04, y0 + rr * .12], [c2[0] - w * .8, y0 - rr * .22], [c2[0], y0 - rr * .34], [c2[0] + w * .8, y0 - rr * .22], [c2[0] + w * 1.04, y0 + rr * .12], [c2[0], y0 + rr * .26]], stem = [[c2[0] - 2, y0 - rr * .3], [c2[0] + 2, y0 - rr * .3], [c2[0] + 2, fb[1]], [c2[0] - 2, fb[1]]];
        const P = M.shapes('stalk' + k, [cap, stem], {layer:92.9 + k * .01, tier:'F', zone:'fruit', line:LINES.fruit, noSil:true, bind:{rigid:'fr' + k}, tags:['fruit', 'stalk'], tone:(x, y, i) => i - P.p0 === 0 ? .62 : .2, organ:'fruit', base:fb, parent:'w_' + f.spur.id});
      } else M.line('stalk' + k, [fb, [c2[0], c2[1] - rr * (PK === 'cone' ? 1 : .9)]], {layer:92.9 + k * .01, zone:'fruit', bind:{rigid:'fr' + k}, tags:['fruit', 'stalk'],
        organ:'fruit', base:fb, parent:'w_' + f.spur.id});
      NODES.push({name:'fruit' + k, organ:'fruit', base:fb, parent:'w_' + f.spur.id}, {name:'stalk' + k, organ:'fruit', base:fb, parent:'w_' + f.spur.id});
    }
  });
  for(const M of MF ? [MB, MF] : [MB]) M.posture('stand', {root:[0, 0, 0]});
  const hooks = M => ({
    idle(c, now, Ti, dt){ const E = c.env || {}; const fw = E.fruitW || []; for(let k = 0; k < T.fruit.length; k++){ const w = Math.max(.02, fw[k] || 0); if(c.d.BI['fr' + k] !== undefined) c.scale('fr' + k, w, w); }
      /* a load bends a limb: the course's scaffold gives under a body as far out as it is (E.load 0..1); a rustle when a helper starts (E.sway) */
      if(E.load && c.d.BI['L_' + courseId] !== undefined) c.jt('L_' + courseId, .035 * E.load);
      if(E.sway) for(const b of T.B.filter(q => q.order === 1)) c.jd('L_' + b.id, E.sway * .012 * Math.sin(now * .005 + b.az * 3)); },
    /* a change of state redraws the zones; between changes only the zones that move (a pulse up the roots, the band at the head) are redrawn */
    colourLive(c, now){ const E = c.env; if(!E) return; const d = c.d;
      if(E.key !== c.envKey){ c.envKey = E.key; for(let i = 0; i < d.NPOLY; i++) c.colDirty.add(i); return; }
      if(E.anim) for(const z in E.zonesAnim) if(E.zonesAnim[z]) for(const i of (d.ZLIST[z] || [])) c.colDirty.add(i); },
    colour(c, i, col, now){ return look(c, i, col, now); },
  });
  /* the groups' fall starts, spread evenly over the year's fall window: at any moment of leaf fall only a band of groups is moving */
  FALLS.forEach((f, i) => { f.start = FALLS.length > 1 ? .05 + (i / (FALLS.length - 1)) * .79 : .05; });
  const defs = [K.define(MB.finish(hooks(MB)))]; if(MF) defs.push(K.define(MF.finish(hooks(MF))));
  for(const d of defs){ d.T = T; d.view = V; d.sc = sc; d.kp = kp; d.grow = NODES; d.falls = FALLS; }
  return {back:defs[0], front:defs[1] || null, parts:nParts};
}

/* ---------- the year in the tree ----------
   The tree is grown by object change, not by colour. Every part declares an organ (def.grow, the same declarations def.PARTI exposes); the
   year's organ weights (PHENOLOGY.at) become a group matrix for each part, composed down the parent hierarchy: about its base, a part scales
   by its own weight inside its parent's scale. The trunk is non-uniform (girth across, height up); every other organ is uniform. A leaf group
   also carries one morph a group (environ-tree figure) that lays each leaf flat on the ground; leafFall, the fraction still on the tree,
   drives each group's weight with a stagger. Fruit detaches and lands as itself: its group matrix is replaced by a world-space fall that
   cancels its bone, so the fallen apple lies still while the tree sways. A failure takes die-back: shoots shorten, outer limbs give a little,
   leaves and wood grey, the year held. */
const APPLE = EK.PHENOLOGY.PROFILES.apple, LEAD = .25, SPUR_LEAD = .20, FALL_MS = 900, FALL_WIN = .16;
/* the year is one profile (the apple's BBCH table) for the whole family; a species flag changes how it reads: an evergreen keeps its leaves (no leaf fall) */
const yearOf = (T, year, lead = 0) => EK.PHENOLOGY.at(APPLE, Math.min(1, year + lead), {evergreen:!!(T.species && T.species.evergreen)});
const clamp01 = v => Math.max(0, Math.min(1, v)), smooth01 = v => v * v * (3 - 2 * v);
const IMAT = [1, 0, 0, 1, 0, 0];
const mulM = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const about = (b, sx, sy) => [sx, 0, 0, sy, b[0] * (1 - sx), b[1] * (1 - sy)];
const applyM = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const invM = m => { const det = m[0] * m[3] - m[1] * m[2] || 1e-9; return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]; };
const aboutDrop = (c, sx, sy, th, p) => { const ca = Math.cos(th), sa = Math.sin(th), a = ca * sx, b = sa * sx, cc = -sa * sy, dd = ca * sy; return [a, b, cc, dd, c[0] - (a * p[0] + cc * p[1]), c[1] - (b * p[0] + dd * p[1])]; };
/* the year's organ weights for one moment, with die-back's two reductions (shoots, outer limbs) */
function yearWeights(c, E){
  const T = c.d.T, die = E.dieK || 0, q = yearOf(T, E.year);
  const BMAP = c.d.BMAP || (c.d.BMAP = new Map(T.B.map(b => ['w_' + b.id, b])));
  return {q, die, BMAP, courseId:T.courseId ?? 's0', lead:yearOf(T, E.year, LEAD), spur:yearOf(T, E.year, SPUR_LEAD)};
}
/* one node's scales: the trunk is girth across and trunk up; everything else is its organ's uniform weight */
function nodeScale(n, Y){
  const q = Y.q, die = Y.die;
  if(n.organ === 'trunk') return [q.w.girth, q.w.trunk];
  if(n.organ === 'limb'){ const b = Y.BMAP.get(n.name); let v = b && b.id === Y.courseId ? Y.lead.w.limb : q.w.limb; if(b && (b.order >= 2 || b.kind === 'upper')) v *= 1 - .06 * die; return [v, v]; }
  if(n.organ === 'shoot'){ const b = Y.BMAP.get(n.name); let v = b && b.kind === 'spur' ? Y.spur.w.shoot : q.w.shoot; v *= 1 - .55 * die; return [v, v]; }
  const v = Math.max(0, q.w[n.organ] ?? 0); return [v, v];
}
/* the fruit's ground place, fixed when its fall begins: a point on the front ground ring, its centre lifted by its squashed radius */
function dropPlace(d, k, sLand){
  const f = d.T.fruit[k], h1 = K.hash(k * 97 + 31), h2 = K.hash(k * 53 + 7), a = Math.PI * (.15 + .7 * h1), rad = (170 + 260 * h2) * ((d.T.gR ?? 520) / 520);
  const gp = d.kp([Math.cos(a) * rad, Math.sin(a) * rad, 0]), rr = f.r * d.sc * Math.max(.25, sLand);
  return [gp[0], gp[1] - rr * .80];
}
/* the world-space fall of one apple: at u=0 it is exactly the hanging apple (bone and group), at u=1 it lies on the ground; the group matrix
   cancels the bone, so the landed apple is detached from the tree's sway. */
function dropForm(c, d, E, k, q, u, pm){
  const f = d.T.fruit[k], c2 = d.kp(f.at), b = d.kp(f.top), bi = d.BI['fr' + k]; if(bi == null) return null;
  const o = bi * 6, bm = c.bm, B = [bm[o], bm[o + 1], bm[o + 2], bm[o + 3], bm[o + 4], bm[o + 5]];
  const sOwn = Math.max(0, q.w.fruit), sB = Math.max(.05, (E.fruitW || [])[k] ?? 1), sHang = Math.max(.05, sOwn * sB);
  if(!E.dropSize[k]) E.dropSize[k] = sHang;
  const sLand = E.dropSize[k], Bc = [B[0] * c2[0] + B[2] * c2[1] + B[4], B[1] * c2[0] + B[3] * c2[1] + B[5]];
  /* the hanging apple's visible centre: its base mapped by the parent chain, then its own weight about that base (see mat) */
  const pb = applyM(pm, b), cw = [pb[0] + sOwn * (Bc[0] - b[0]), pb[1] + sOwn * (Bc[1] - b[1])];
  if(!E.dropG[k]) E.dropG[k] = dropPlace(d, k, sLand);
  const g = E.dropG[k], t = clamp01(u), ang0 = Math.atan2(B[1], B[0]), th = ang0 + (E.dropRot[k] - ang0) * t;
  const sc = sHang + (sLand - sHang) * t, cx = cw[0] + (g[0] - cw[0]) * t, cy = cw[1] + (g[1] - cw[1]) * t;
  return mulM(aboutDrop([cx, cy], sc, sc * (1 - .18 * t), th, c2), invM(B));
}
/* the drop targets: the season's own (a fixed two of the nine places, spread through fruitDrop) and, at die-back, the whole crop (fruitDrop .8
   brings every one down: a dying tree holds no fruit); a refused product's apple drops whatever the season */
function dropTargets(c, E, q){
  const T = c.d.T;
  if(!E.dropAt){ const ord = T.fruit.map((f, k) => [K.hash(k * 97 + 31), k]).sort((a, b) => a[0] - b[0]); E.dropAt = T.fruit.map(() => Infinity);
    const n = Math.max(2, Math.round(T.fruit.length * .22)); for(let j = 0; j < n && j < ord.length; j++) E.dropAt[ord[j][1]] = .04 + .19 * (j / Math.max(1, n - 1));
    for(let j = n; j < ord.length; j++) E.dropAt[ord[j][1]] = .30 + .50 * ((j - n) / Math.max(1, ord.length - 1 - n)); }
  const fd = Math.max(q.fruitDrop, .8 * (E.dieK || 0));
  return T.fruit.map((f, k) => Math.max(fd >= E.dropAt[k] ? 1 : 0, E.fruit && E.fruit[k] === 'fallen' ? 1 : 0));
}
function dropPrep(c, E, q){
  const T = c.d.T;
  if(!E.dropU){ const n = T.fruit.length; E.dropU = Array(n).fill(0); E.dropDir = Array(n).fill(0); E.dropT0 = Array(n).fill(0); E.dropFrom = Array(n).fill(0); E.dropSize = Array(n).fill(0); E.dropG = Array(n).fill(null); E.dropRot = T.fruit.map((f, k) => (K.hash(k * 29 + 13) - .5) * .9); }
  E.dropT = dropTargets(c, E, q); return E.dropT;
}
/* the forms, the leaf fall and the drop for the current year */
function applyGrowth(c, E, instant){
  const d = c.d, T = d.T, Y = yearWeights(c, E), q = Y.q, die = Y.die;
  E.phase = q.phase; E.bbch = q.bbch; E.seasonQ = q; E.blossom = q.w.blossom;
  E.leafFall = T.species && T.species.evergreen ? 0 : Math.max(q.leafFall, .85 * die); E.fruitDrop = Math.max(q.fruitDrop, .8 * die);
  const nodes = new Map(); for(const n of d.grow || []) if(!nodes.has(n.name)) nodes.set(n.name, n);
  const memo = new Map(), dropM = new Map();
  /* wood inherits its parent's scale (a branch on a small limb is itself small); a leaf, blossom or fruit takes only its position from the
     parent chain — its own year weight is its size — so a sapling's leaves and flowers read full-size where they hang */
  const mat = name => {
    if(memo.has(name)) return memo.get(name);
    const n = nodes.get(name); if(!n) return IMAT;
    const pm = n.parent ? mat(n.parent) : IMAT, s = nodeScale(n, Y);
    let m;
    if(n.organ === 'leaf' || n.organ === 'blossom' || n.organ === 'fruit'){ const p = applyM(pm, n.base); m = mulM([1, 0, 0, 1, p[0] - n.base[0], p[1] - n.base[1]], about(n.base, s[0], s[1])); }
    else m = mulM(pm, about(n.base, s[0], s[1]));
    memo.set(name, m); return m;
  };
  for(const n of d.grow || []){
    if(d.PARTN[n.name] === undefined) continue;
    if(n.organ === 'fruit' && /^(fruit|stalk)\d+$/.test(n.name)){
      const k = +n.name.match(/\d+$/)[0], u = E.dropU ? E.dropU[k] || 0 : 0;
      if(u > .0001){
        let m = dropM.get(k); if(m === undefined){ m = dropForm(c, d, E, k, q, u, n.parent ? mat(n.parent) : IMAT); dropM.set(k, m); }
        c.form(n.name, m); continue;
      }
    }
    c.form(n.name, mat(n.name));
  }
  /* the leaves that are still on the tree, per group; the fallen group's colour follows its own weight */
  E.fallW = E.fallW || {};
  for(const f of d.falls || []){
    const u = clamp01((E.leafFall - f.start) / FALL_WIN);
    E.fallW[f.name.slice(5)] = u;
    if(instant) c.morphNow(f.name, u); else c.setMorph(f.name, u);
  }
  E.ready = ready(c);
}
/* one frame of the year: pace the growth, ease die-back, time each apple's fall, then place everything. o.instant places it at once (a seek). */
function growStep(c, dtMs, o = {}){
  if(!c.d.grow) return null;
  const E = c.env || (c.env = {}), T = c.d.T;
  if(E.clock == null) E.clock = 0;
  if(E.year == null) E.year = E.yearT ?? 1;
  E.clock += Math.max(0, Math.min(120, dtMs || 16));
  if(E.grow){ const g = E.grow, u = clamp01((E.clock - g.t0) / g.ms); E.year = g.from + (g.to - g.from) * smooth01(u); if(u >= 1) E.grow = null; }
  if(E.dieT != null){ const w = E.dieK || 0; E.dieK = w + (E.dieT - w) * (1 - Math.exp(-Math.max(0, dtMs || 16) / 500)); if(Math.abs(E.dieT - E.dieK) < .002) E.dieK = E.dieT; }
  const q = yearOf(T, E.year), tg = dropPrep(c, E, q);
  for(let k = 0; k < tg.length; k++){
    if(tg[k] !== E.dropDir[k]){ E.dropDir[k] = tg[k]; E.dropFrom[k] = E.dropU[k]; E.dropT0[k] = E.clock; if(tg[k]){ E.dropSize[k] = 0; E.dropG[k] = null; } }
    if(o.instant){ E.dropU[k] = tg[k]; continue; }
    const t = clamp01((E.clock - E.dropT0[k]) / FALL_MS);
    E.dropU[k] = tg[k] ? E.dropFrom[k] + (1 - E.dropFrom[k]) * t * t : E.dropFrom[k] * (1 - smooth01(t));
    if(t >= 1) E.dropU[k] = tg[k];
  }
  applyGrowth(c, E, !!o.instant);
  return E;
}
/* the year's target: paced, with a floor and a ceiling so a first generation's jump is slow enough to see and a nudge is quick */
function setYear(c, year, o = {}){
  const E = c.env || (c.env = {}), y = clamp01(+year || 0);
  E.yearT = y;
  if(o.instant){ E.year = y; E.grow = null; growStep(c, 0, {instant:true}); return E; }
  if(E.year == null) E.year = y;
  if(E.grow && E.grow.to === y) return E;
  const from = E.year, jump = Math.abs(y - from);
  E.grow = {from, to:y, t0:E.clock || 0, ms:Math.max(700, Math.min(5200, 700 + 9000 * jump))};
  return E;
}
/* what the stage asks before a climb: is the trunk full, and is the course's scaffold out (it leads the limb curve by a quarter year) */
function ready(c){
  const E = c.env || {}, y = E.year ?? 1, T = c.d.T, q = yearOf(T, y), l = yearOf(T, y, LEAD);
  return {trunk:q.w.trunk, s0:l.w.limb, course:q.w.trunk >= .99 && l.w.limb >= .97};
}
/* a failure's die-back: shoots shorten, outer limbs give a little, the year holds where it was */
function setDieback(c, k, o = {}){
  const E = c.env || (c.env = {}), t = clamp01(k);
  E.dieT = t; if(o.instant) E.dieK = t; else if(E.dieK == null) E.dieK = 0;
  return E;
}

/* ---------- the look of the zones by run state (additive, as the line model asks) ---------- */
const RIPE = {set:0x9DB860, ripening:0xB8963E, ripe:0xC44536, harvested:0xD4A03C, fallen:0x6B5B4F};   // (set: a young apple's pale green, apart from the leaves' malachite, which hid it)
function look(c, i, col, now){
  const E = c.env; if(!E) return col;
  const d = c.d, P = d.parts[d.PPART[i]], z = P.zone, C = c.C, T = d.T, die = E.dieK || 0, SP = T.species || classicSpecies(), RP = (SP.product && SP.product.colors) || RIPE, BL = SP.blossom || {}, LFa = SP.leaf || {};
  const lowTrunk = z === 'trunk' && E.yBase != null && d.PCY[i] > E.yBase - (E.yBase - E.yTop) * .13;
  if(z === 'seed'){
    col = K.mixInt(col, 0x8A6A3F, .5); if(die) col = K.mixInt(col, 0x6F665A, .4 * die);
  } else if(z === 'blossom'){
    const b = Math.min(1, (E.blossom || 0) * 1.15); col = K.mixInt(col, K.mixInt(BL.bud ?? 0xD98FA6, BL.open ?? 0xFBF3F0, b), .75); if(die) col = K.mixInt(col, 0x6F665A, .35 * die);
  } else if(z === 'roots' || (lowTrunk && E.roots !== 'rest' && E.roots != null)){
    if(E.roots === 'drawing'){ const y = d.PCY[i], ph = (now * .0012 - y * .012) % 1; col = K.mixInt(col, C.lapis, .18 + .22 * Math.max(0, Math.sin(ph * 6.283))); }
    else if(E.roots === 'grey') col = K.mixInt(col, 0x55585c, .45); else if(E.roots === 'flush') col = K.mixInt(col, C.cin, .4); else if(E.roots === 'dark') col = K.mixInt(col, 0x000000, .3);
  } else if(z === 'trunk' || z === 'branches'){
    if(die) col = K.mixInt(col, 0x6F665A, .45 * die);
    const u = E.yTop != null ? (E.yBase - d.PCY[i]) / (E.yBase - E.yTop) : 0, h = E.height || 0;
    if(z === 'trunk' && u <= h && (E.trunk === 'growing' || E.trunk === 'grown' || E.trunk === 'held')) col = K.mixInt(col, C.bone, E.trunk === 'growing' ? .1 : .06);
    if(z === 'trunk' && E.trunk === 'growing' && Math.abs(u - h) < .05) col = K.mixInt(col, C.gold, .3 * (1 - Math.abs(u - h) / .05));
    if(E.trunk === 'grey' && Math.abs(u - h) < .3) col = K.mixInt(col, 0x55585c, .5);
    if(E.trunk === 'flush' && Math.abs(u - h) < .3) col = K.mixInt(col, C.cin, .45);
  } else if(z === 'crown'){
    if(die) col = K.mixInt(col, 0x6F665A, .35 * die);
    const autumn = SP.evergreen ? 0 : clamp01(((E.year ?? 1) - .90) / .10), fallen = (E.fallW && E.fallW[P.name]) || 0;
    if(autumn > 0){ if(fallen > .45) col = K.mixInt(col, 0x6B5B4F, .55); else col = K.mixInt(col, LFa.autumn ?? 0xC08A2E, .45 * autumn); }
    if(E.crown === 'in leaf') col = K.mixInt(col, C.accent, .1);
    if(E.crown === 'dim' || E.season === 'quiescent') col = K.mixInt(col, 0x000000, .28);
    if(E.crown === 'grey') col = K.mixInt(col, 0x55585c, .35);
    if(E.season === 'closed') col = K.mixInt(col, C.umber, .5);
  } else if(z === 'fruit'){
    const k = +(P.name.match(/\d+$/) || [0])[0], r = (E.fruit || [])[k];
    if(!r){ const rip = smooth01(clamp01(((E.year ?? 1) - .42) / .48)); col = K.mixInt(col, K.mixInt(RP.set, RP.ripe, rip), .55); }
    if(r && RP[r] != null){ col = K.mixInt(C.skin, RP[r], Math.min(.97, .38 + d.PTONE[i] * (r === 'ripe' || r === 'harvested' ? 1.7 : 1.3))); if(d.PTONE[i] > .36) col = K.mixInt(col, 0xffffff, (d.PTONE[i] - .36) * 1.4); }
    if(r === 'harvested') col = K.mixInt(col, 0xffffff, .08 + .06 * Math.sin(now * .003 + k));
  }
  return col;
}
/* the zones from run.zones(): how far up the trunk (the serpent's head's screen height there), which fruit and how ripe, and growth by scale */
function setLook(c, Z, now, o = {}){
  const d = c.d, T = d.T, E = c.env || (c.env = {});
  if(!E.fruitW) E.fruitW = [];
  E.roots = Z.roots; E.trunk = Z.trunk; E.crown = Z.crown; E.season = Z.season; E.height = o.height ?? Z.height; E.fruit = Z.fruit.slice(0, T.fruit.length);
  if(E.yBase == null){ E.yBase = d.kp([0, 0, 0])[1]; E.yTop = d.kp(T.trunk.pts[T.trunk.pts.length - 1])[1]; }
  if(o.yHead != null) E.height = Math.max(0, Math.min(1, (E.yBase - o.yHead) / (E.yBase - E.yTop)));
  /* a refused apple is not hidden: it keeps the size it had (a fallen product is a fallen apple, not a missing one). With no product at a
     place, the year's own fruit shows there if the caller asks for it (fruitAll: the page's year demo), and nothing shows otherwise. */
  const target = T.fruit.map((f, k) => { const r = E.fruit[k];
    return r === 'set' ? .45 : r === 'ripening' ? .7 : r === 'ripe' || r === 'harvested' ? 1 : r === 'fallen' ? Math.max(.55, E.fruitW[k] || 0) : r == null && o.fruitAll ? 1 : 0; });
  for(let k = 0; k < T.fruit.length; k++){ const t = target[k], w = E.fruitW[k] || 0; E.fruitW[k] = o.instant ? t : w + (t - w) * .05; }
  E.zonesAnim = {roots:E.roots === 'drawing', trunk:E.trunk === 'growing', branches:false, fruit:E.fruit.includes('harvested')};
  E.anim = E.zonesAnim.roots || E.zonesAnim.trunk || E.zonesAnim.fruit;
  /* the season is in the key too, quantized: the year's tint redraws the cells as often as the tint visibly moves, not every frame */
  E.key = [E.roots, E.trunk, E.crown, E.season, E.height.toFixed(3), E.fruit.join(','), Math.round((E.year ?? 1) * 40), Math.round((E.leafFall ?? 0) * 20), Math.round((E.dieK ?? 0) * 20)].join('|');
  E.load = o.load || 0; E.sway = o.sway || 0;
  return E;
}
window.EnvironTree = {VERSION, CHANGELOG, generate, course, figure, setLook, look, setYear, growStep, ready, setDieback, chooseCourse, proj, depthOf, frames, CAM, LIGHT};
})();
