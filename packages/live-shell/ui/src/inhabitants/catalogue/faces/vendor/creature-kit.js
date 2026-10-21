/* creature-kit.js — the shared engine of the animal-symbol set. The standard it implements is CREATURE-SPEC.md; read that first.

   Lifted from the lion (creature-lion.js, rounds 1-8), which is the reference figure: everything here that was the lion's own is now a
   declaration the creature makes. A creature file builds a model and hands it to define():

     (() => {
       const K = CreatureKit, M = K.model({id:'bull', name:'Bull', sign:'♉', w:1000, h:780, groundY:740, pivot:[300, 420], axis:760});
       M.bone(...); M.zone(...); M.limb(...); M.muscle(...); M.leg(...); M.posture(...); M.edge(...); M.gait(...); M.action(...); M.pad(...);
       K.define(M.finish({idle, life, postureHold, gaitBody, post, colour}));
     })();

   then a page calls CreaturePage.build('bull') (creature-page.js), or K.mount('bull', el, opts) for a bare figure.

   RENDERING is the face rig's line model: one ink. skin = mix(ground, wash, .08). Polygons have no stroke; each is inset from its
   neighbours and the lines are the gaps, where a backing path in the line colour shows through, so a line is as heavy as its gap.
   Three line roles (contour, region border, hairline) differ clearly in weight and value. Ink tone goes only where a feature needs
   it; every other colour is additive and transient (crease ink, flush, flips and holds, bursts, the field, the glyph's light, the
   map view's hues) and keeps to the zones that take it.
   MOTION is muscles over a skeleton: a muscle is a gaussian field in rest space (it displaces vertices and inks creases) that also
   turns joints. Over it sit the pose channels: a posture graph (held whole-body poses and staged, interruptible edges between them),
   a gait engine (feet pinned to the ground in stance), actions that layer onto whatever posture the body is in, a life layer that
   chooses actions and postures over time, and pads that offset everything inside the IK. Every channel is spring-smoothed.
   Plain JS + SVG, no dependencies. Exports window.CreatureKit. */
(() => {
'use strict';
const K = {};
const NS = 'http://www.w3.org/2000/svg';

/* ---------- small maths ---------- */
const wrapA = x => { while(x > Math.PI) x -= 2 * Math.PI; while(x < -Math.PI) x += 2 * Math.PI; return x; };
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, u) => a + (b - a) * u;
const fSmooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
const hash = i => { let h = Math.imul((i >>> 0) + 1, 2654435761) >>> 0; h ^= h >>> 15; return (Math.imul(h, 2246822519) >>> 0) / 4294967296; };
const strHash = s => { let h = 2166136261; for(let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const HEX2 = Array.from({length:256}, (_, i) => i.toString(16).padStart(2, '0'));
const hexInt = s => typeof s === 'number' ? s : /^#[0-9a-f]{6}$/i.test(s) ? parseInt(s.slice(1), 16) : 0x888888;
const intHex = c => '#' + HEX2[c >> 16 & 255] + HEX2[c >> 8 & 255] + HEX2[c & 255];
function mixInt(a, b, t){
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = a >> 16 & 255, g = a >> 8 & 255, l = a & 255;
  return ((r + ((b >> 16 & 255) - r) * t + .5) | 0) << 16 | ((g + ((b >> 8 & 255) - g) * t + .5) | 0) << 8 | ((l + ((b & 255) - l) * t + .5) | 0);
}
function palInt(stops, v){ v = clamp(v, 0, .999) * (stops.length - 1); const i = v | 0; return mixInt(stops[i], stops[i + 1], v - i); }
function vnoise(x, y){
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => hash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663));
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a0 = h(xi, yi), a1 = h(xi + 1, yi), b0 = h(xi, yi + 1), b1 = h(xi + 1, yi + 1);
  return a0 + (a1 - a0) * u + (b0 + (b1 - b0) * u - a0 - (a1 - a0) * u) * v;
}
const fbm = (x, y) => .62 * vnoise(x, y) + .38 * vnoise(x * 2.03 + 17.1, y * 2.03 - 9.4);
function segDist(x, y, ax, ay, bx, by){ const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)); return Math.hypot(x - ax - t * dx, y - ay - t * dy); }
function pip(P, x, y){ let c = false; for(let i = 0, j = P.length - 1; i < P.length; j = i++){ const a = P[i], b = P[j]; if((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
const edgeDist = (P, x, y) => { let d = 1e9; for(let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; d = Math.min(d, segDist(x, y, a[0], a[1], b[0], b[1])); } return d; };
/* time shapes: an envelope (attack, hold, release), a pulse at t0, smooth keyframes [[t, v], ...] */
const env = (t, att, hold, rel) => t < 0 ? 0 : t < att ? fSmooth(0, att, t) : t < att + hold ? 1 : t < att + hold + rel ? 1 - fSmooth(att + hold, att + hold + rel, t) : 0;
const pulse = (t, t0, att, hold, rel) => env(t - t0, att, hold, rel);
const keys = (t, kk) => { if(t <= kk[0][0]) return kk[0][1]; for(let i = 0; i < kk.length - 1; i++) if(t < kk[i + 1][0]){ const u = (t - kk[i][0]) / (kk[i + 1][0] - kk[i][0]); return kk[i][1] + (kk[i + 1][1] - kk[i][1]) * u * u * (3 - 2 * u); } return kk[kk.length - 1][1]; };
const ramp = (t, a, b, c, d) => keys(t, [[a, 0], [b, 1], [c, 1], [d, 0]]);   // a smooth up, hold, down
/* Critically damped smoothing (no overshoot, no linear segments): x with velocity v chases T at rate k. z is the damping ratio:
   1 critical, under 1 it rings, over 1 it is heavy. Sub-stepped so a long frame cannot go unstable. */
function cdamp(S, i, T, k, dt, z = 1){
  const n = Math.max(1, Math.ceil(dt * k / 1000 / .5)), h = dt / 1000 / n; let x = S.x[i], v = S.v[i];
  for(let q = 0; q < n; q++){ v += (k * k * (T - x) - 2 * z * k * v) * h; x += v * h; }
  S.x[i] = x; S.v[i] = v; return x;
}
const cdS = n => ({x:new Float32Array(n), v:new Float32Array(n)});
function chaikin(P, n = 1, closed = true){
  for(let k = 0; k < n; k++){
    const Q = [];
    for(let i = 0; i < P.length; i++){
      const a = P[i], b = P[(i + 1) % P.length];
      if(!closed && i === 0) Q.push(a);
      if(!closed && i === P.length - 1){ Q.push(a); break; }
      Q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    P = Q;
  }
  return P;
}
/* Catmull-Rom through points, per samples per span (open) */
function catmull(P, per = 8){ const out = [], n = P.length; for(let i = 0; i < n - 1; i++){ const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)]; for(let k = 0; k < per; k++){ const t = k / per, t2 = t * t, t3 = t2 * t; out.push(p1.map((_, c) => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); } } out.push(P[n - 1].slice()); return out; }
const ringPts = (c, r, n, a0 = 0, sx = 1) => Array.from({length:n}, (_, i) => [c[0] + Math.cos(a0 + i * 2 * Math.PI / n) * r * sx, c[1] + Math.sin(a0 + i * 2 * Math.PI / n) * r]);
const ellipsePts = (c, rx, ry, n, a0 = 0) => Array.from({length:n}, (_, i) => [c[0] + Math.cos(a0 + i * 2 * Math.PI / n) * rx, c[1] + Math.sin(a0 + i * 2 * Math.PI / n) * ry]);
/* An outline from stations [x, y, back, front]: the width either side of a centreline, smoothed (legs, tails, necks). */
function limbOutline(S, smooth = 2){
  const L = [], R = [];
  S.forEach((s, i) => {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    L.push([s[0] - ty * s[2], s[1] + tx * s[2]]); R.push([s[0] + ty * s[3], s[1] - tx * s[3]]);
  });
  return chaikin(L.concat(R.reverse()), smooth);
}
Object.assign(K, {NS, wrapA, clamp, lerp, fSmooth, gauss, hash, strHash, rng, hexInt, intHex, mixInt, palInt, vnoise, fbm, segDist, pip, edgeDist, env, pulse, keys, ramp, cdamp, cdS, chaikin, catmull, ringPts, ellipsePts, limbOutline});

/* ---------- the owner's palette, and the face rig's colour model ---------- */
const ROSTER = {obsidian:'#1A1A2E', bone:'#E8E4D9', cinnabar:'#C44536', lapis:'#2E5A88', malachite:'#3A7D5C', amber:'#D4A03C', umber:'#6B5B4F', gold:'#B8963E'};
const GROUND = '#1b1d20';
/* A creature's palette: its ink (one roster colour), the wash (the skin's faint tint, default the ink), the ground, the accent (the eye, or
   one feature the creature reserves it for) and the glyph's gold. The rest of the roster only ever arrives additively. */
function palette(def, o = {}){
  const P = {...ROSTER, ...o};
  P.ink = o.ink || def.ink || ROSTER.amber; P.wash = o.wash || P.ink; P.ground = o.ground || def.ground || GROUND; P.accent = o.accent || def.accent || ROSTER.amber;
  return P;
}
/* the line roles, as presets a part names (or an object of its own): k is the hairline's mix toward the ink (the gaps), c the outline's mix,
   r the outline's role (c contour heavy, b region border medium, f fine; 0 no outline), t a roster tone mixed into the ink by tk, bs a stroke on the
   backing (a wild edge such as a mane's). Values from the lion's rounds 3-4: contours brightest, borders .8-.9, hairlines .5-.62, recessive parts dim. */
const LINE = {
  contour:{k:.62, c:1, r:'c', t:'bone', tk:.3}, region:{k:.62, c:.88, r:'b', t:'bone', tk:.2}, feature:{k:.62, c:1, r:'b', t:'bone', tk:.38}, face:{k:.4, c:.62, r:'b'},
  far:{k:.22, c:.4, r:'b'}, fine:{k:.6, c:.8, r:'f'}, mouth:{k:.4, c:.6, t:'cin', tk:.4}, glyph:{k:.8, c:.9}, plain:{k:.5, c:.85}, dim:{k:.34, c:.46, t:'umber', tk:.3},
};
const TIERS = {L:0, M:1, F:2}, TIER_H = [60, 30, 10];   // default facet size by tier
function colours(def, P){
  const skin = mixInt(hexInt(P.ground), hexInt(P.wash), .08), ink = hexInt(P.ink), gold = hexInt(P.gold), accent = hexInt(P.accent);
  const C = {skin, ink, gold, accent, bone:hexInt(P.bone), cin:hexInt(P.cinnabar), umber:hexInt(P.umber), lapis:hexInt(P.lapis), line:mixInt(skin, mixInt(ink, hexInt(P.bone), .25), .9)};
  C.inkOf = part => part.ink === 'gold' ? gold : part.ink === 'accent' ? accent : ink;
  C.ls = def.parts.map(part => {
    const L = part.line, base = C.inkOf(part), tint = {bone:C.bone, cin:C.cin, umber:C.umber, lapis:C.lapis}[L.t];
    const ik = tint ? mixInt(base, tint, L.tk) : base;
    return {fill:mixInt(skin, ik, L.k), stroke:mixInt(skin, ik, L.c), role:L.r || 0, bs:L.bs || 0};
  });
  return C;
}
const stopsOf = list => { const a = list.map(hexInt); return a.length > 1 ? a : [a[0], a[0]]; };
const BEH_PAL = [ROSTER.malachite, ROSTER.lapis, ROSTER.gold, ROSTER.cinnabar];
Object.assign(K, {ROSTER, GROUND, LINE, TIERS, BEH_PAL});

/* ---------- Delaunay (Bowyer–Watson): the triangulator behind every zone ---------- */
function delaunay(P0){
  const R = rng(97), P = P0.map(p => [p[0] + (R() - .5) * .6, p[1] + (R() - .5) * .6]), n = P.length;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const [x, y] of P){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  const d = Math.max(x1 - x0, y1 - y0) * 20 + 1, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const X = P.map(p => p[0]).concat([mx - d, mx, mx + d]), Y = P.map(p => p[1]).concat([my - d, my + d, my - d]);
  const circ = (a, b, c) => {
    const ax = X[a], ay = Y[a], bx = X[b] - ax, by = Y[b] - ay, cx = X[c] - ax, cy = Y[c] - ay, D = 2 * (bx * cy - by * cx);
    if(Math.abs(D) < 1e-9) return [0, 0, -1];
    const ux = (cy * (bx * bx + by * by) - by * (cx * cx + cy * cy)) / D, uy = (bx * (cx * cx + cy * cy) - cx * (bx * bx + by * by)) / D;
    return [ax + ux, ay + uy, ux * ux + uy * uy];
  };
  let T = [{v:[n, n + 1, n + 2], c:circ(n, n + 1, n + 2)}];
  for(let i = 0; i < n; i++){
    const px = X[i], py = Y[i], keep = [], E = new Map();
    for(const t of T){
      const c = t.c;
      if((px - c[0]) ** 2 + (py - c[1]) ** 2 < c[2]){
        for(let k = 0; k < 3; k++){ const a = t.v[k], b = t.v[(k + 1) % 3], key = a < b ? a * 65536 + b : b * 65536 + a; if(E.has(key)) E.delete(key); else E.set(key, [a, b]); }
      } else keep.push(t);
    }
    for(const [a, b] of E.values()) keep.push({v:[a, b, i], c:circ(a, b, i)});
    T = keep;
  }
  return T.filter(t => t.v[0] < n && t.v[1] < n && t.v[2] < n).map(t => t.v);
}
/* Even sampling: a closed outline is cut into runs at its corners (turns over 55 degrees) and each run sampled at equal arc length. */
function evenOutline(P, s){
  const n = P.length, turn = i => { const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n]; const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]]; return Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])); };
  let corners = []; for(let i = 0; i < n; i++) if(turn(i) > .96) corners.push(i);
  if(!corners.length) corners = [0];
  const out = [];
  for(let c = 0; c < corners.length; c++){
    const i0 = corners[c], i1 = corners[(c + 1) % corners.length], run = [P[i0]];
    for(let i = (i0 + 1) % n; ; i = (i + 1) % n){ run.push(P[i]); if(i === i1) break; }
    let L = 0; for(let i = 1; i < run.length; i++) L += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]);
    const m = Math.max(1, Math.round(L / s)); let k = 1, acc = 0;
    out.push(run[0]);
    for(let q = 1; q < m; q++){
      const d = L * q / m;
      while(k < run.length - 1 && acc + Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]) < d){ acc += Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]); k++; }
      const seg = Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]) || 1, t = (d - acc) / seg;
      out.push([run[k - 1][0] + (run[k][0] - run[k - 1][0]) * t, run[k - 1][1] + (run[k][1] - run[k - 1][1]) * t]);
    }
  }
  return out;
}
/* Chaikin that keeps pinned corners, and a group smoother: cells that share corners keep them, the runs between are smoothed. */
function chaikinPinned(P, pinned, n = 2){
  const idx = []; P.forEach((p, i) => { if(pinned(p)) idx.push(i); });
  if(!idx.length) return chaikin(P, n);
  const out = [];
  for(let c = 0; c < idx.length; c++){
    const i0 = idx[c], i1 = idx[(c + 1) % idx.length], run = [P[i0]];
    for(let i = (i0 + 1) % P.length; ; i = (i + 1) % P.length){ run.push(P[i]); if(i === i1) break; }
    const sm = chaikin(run, n, false); sm.pop(); out.push(...sm);
  }
  return out;
}
const pkey = p => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20);
function smoothCells(polys, n = 2){
  const cnt = new Map(); polys.forEach(P => P.forEach(p => cnt.set(pkey(p), (cnt.get(pkey(p)) || 0) + 1)));
  return polys.map(P => chaikinPinned(P, p => cnt.get(pkey(p)) > 1, n));
}
function chaikin4(P, n){ for(let k = 0; k < n; k++){ const Q = [P[0]]; for(let i = 0; i < P.length - 1; i++){ const a = P[i], b = P[i + 1]; Q.push(a.map((v, j) => v * .75 + b[j] * .25), a.map((v, j) => v * .25 + b[j] * .75)); } Q.push(P[P.length - 1]); P = Q; } return P; }
function limbDense(S){
  const C = chaikin4(S, 3), cum = [0]; for(let i = 1; i < C.length; i++) cum.push(cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
  const N = Math.max(8, Math.round(cum[cum.length - 1] / 3)), D = []; let k = 1;
  for(let q = 0; q <= N; q++){
    const d = cum[cum.length - 1] * q / N; while(k < C.length - 1 && cum[k] < d) k++;
    const t = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1); D.push(C[k - 1].map((v, j) => v + (C[k][j] - v) * t));
  }
  D.forEach((p, i) => { const a = D[Math.max(0, i - 1)], b = D[Math.min(D.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; p.push(-ty / l, tx / l); });
  return D;
}
Object.assign(K, {delaunay, evenOutline, smoothCells});

/* ---------- the model: a creature declares its figure, rig and behaviour here ----------
   Coordinates are the creature's canvas (w by h, default 1000 by 780), y down. Everything is authored in the rest pose. */
K.model = function(o = {}){
  const M = {o, W:o.w || 1000, H:o.h || 780, VX:[], VY:[], VZ:[], VYAW:[], VP:[], PV:[], PPART:[], PTIER:[], parts:[], bones:[], BI:{}, defs:{}, legs:[], postures:{}, edges:{}, transit:{}, gaits:{}, actions:{}, pads:{}, padGroups:[], zoneW:Object.assign({skin:1, face:.3}, o.zones || {})};
  const PI_ = M.parts;
  /* a part: one drawing unit with its own backing, outline and options (see CREATURE-SPEC.md, "Parts") */
  M.part = (name, p = {}) => {
    const line = typeof p.line === 'object' ? p.line : LINE[p.line || 'plain'];
    if(!line) throw new Error('creature-kit: unknown line preset ' + p.line + ' on ' + name);
    const P = {name, layer:p.layer ?? 5, tags:new Set(p.tags || []), tier:TIERS[p.tier || 'M'], ptier:TIERS[p.ptier || p.tier || 'M'], ink:p.ink || 'ink', dim:!!p.dim, flush:p.flush || 0,
      show:p.show, open:false, bind:p.bind, yaw:!!p.yaw, v0:M.VX.length, p0:M.PV.length, order:PI_.length, bias:p.bias || 0, tj:p.tj ?? .04, tone:p.tone, zone:p.zone || 'skin', line,
      host:p.host, noSil:!!p.noSil, silBack:!!p.silBack, ripple:p.ripple,
      organ:p.organ || null, base:p.base ? p.base.slice() : null, parent:p.parent || null};
    P.tags.add(name); PI_.push(P); return P;
  };
  M.vtx = (P, x, y, z = 0, yaw = P.yaw ? 1 : 0) => { M.VX.push(x); M.VY.push(y); M.VZ.push(z); M.VYAW.push(yaw); M.VP.push(P.order); return M.VX.length - 1; };
  M.poly = (P, ids, tier) => { M.PV.push(ids); M.PPART.push(P.order); M.PTIER.push(tier ?? P.ptier); };
  M.close = P => { P.v1 = M.VX.length; P.p1 = M.PV.length; return P; };
  const zf0 = () => 0;
  /* A zone: a hand-placed outline filled with well-shaped triangles of size h (boundary sampled evenly, interior on a hex lattice relaxed by
     Lloyd steps, then Delaunay, triangles outside the outline dropped). The face's cells, the flank's cells, an ear, an eye. */
  M.zone = (name, outline, p = {}) => {
    const P = M.part(name, p), h = p.h || TIER_H[P.tier], s = h * (p.bs ?? .95);
    const B = evenOutline(outline, s), nB = B.length, pts = B.slice();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for(const [x, y] of B){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const inset = Math.max(.72 * s, h * (p.inset ?? .6)), dy = h * .866;
    for(let r = 0, y = y0 + dy * .5; y < y1; y += dy, r++) for(let x = x0 + (r & 1 ? h * .5 : 0) + h * .25; x < x1; x += h)
      if(pip(B, x, y) && edgeDist(B, x, y) > inset) pts.push([x, y]);
    for(let it = 0; it < (p.relax ?? 4) && pts.length > nB; it++){
      const T = delaunay(pts), sx = new Float64Array(pts.length), sy = new Float64Array(pts.length), sa = new Float64Array(pts.length);
      for(const t of T){
        const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]], cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
        if(!pip(B, cx, cy)) continue;
        const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
        for(const v of t){ sx[v] += cx * ar; sy[v] += cy * ar; sa[v] += ar; }
      }
      for(let i = nB; i < pts.length; i++) if(sa[i] > 0){ const q = [sx[i] / sa[i], sy[i] / sa[i]]; if(pip(B, q[0], q[1]) && edgeDist(B, q[0], q[1]) > inset * .9) pts[i] = q; }
    }
    const zf = p.z || zf0, ids = pts.map(([x, y]) => M.vtx(P, x, y, zf(x, y)));
    const adj = (i, j) => i < nB && j < nB && (Math.abs(i - j) === 1 || Math.abs(i - j) === nB - 1);
    for(const t of delaunay(pts)){
      const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
      if(Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2 < h * h * .05) continue;
      if(!pip(B, (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3)) continue;
      let bad = false;
      for(const [i, j] of [[0, 1], [1, 2], [0, 2]]){ const u = t[i], v = t[j]; if(u < nB && v < nB && !adj(u, v) && !pip(B, (pts[u][0] + pts[v][0]) / 2, (pts[u][1] + pts[v][1]) / 2)) bad = true; }
      if(bad) continue;
      M.poly(P, [ids[t[0]], ids[t[1]], ids[t[2]]]);
    }
    P.loop = ids.slice(0, nB);
    return M.close(P);
  };
  /* A limb, neck or tail region as a strip mesh. S is the centreline as stations [x, y, back, front]; it is smoothed and cut at equal spacing
     perpendicular to itself, in near-square cells split on alternating diagonals. range [i, j] takes the stretch between two stations, so a leg is
     cut into regions at its joints that share the cross-section there. */
  M.limb = (name, S, p = {}) => {
    const P = M.part(name, p), h = p.h || TIER_H[P.tier], D = limbDense(S), [r0, r1] = p.range || [0, S.length - 1];
    const near = st => { let bi = 0, bd = 1e9; D.forEach((q, i) => { const d = Math.hypot(q[0] - st[0], q[1] - st[1]); if(d < bd){ bd = d; bi = i; } }); return bi; };
    const iA = r0 === 0 ? 0 : near(S[r0]), iB = r1 === S.length - 1 ? D.length - 1 : near(S[r1]), seg = D.slice(iA, iB + 1);
    const cum = [0]; for(let i = 1; i < seg.length; i++) cum.push(cum[i - 1] + Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]));
    const meanW = seg.reduce((a, q) => a + q[2] + q[3], 0) / seg.length, cols = p.cols ?? Math.max(1, Math.round(meanW / h)), cellW = meanW / cols;
    const rows = Math.max(1, Math.round(cum[cum.length - 1] / cellW)), zf = p.z || zf0, grid = []; let k = 1;
    for(let i = 0; i <= rows; i++){
      const d = cum[cum.length - 1] * i / rows; while(k < seg.length - 1 && cum[k] < d) k++;
      const t = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1), q = seg[k - 1].map((v, j) => v + (seg[k][j] - v) * t), nl = Math.hypot(q[4], q[5]) || 1, row = [];
      for(let j = 0; j <= cols; j++){ const u = j / cols, off = q[2] - (q[2] + q[3]) * u, x = q[0] + q[4] / nl * off, y = q[1] + q[5] / nl * off; row.push(M.vtx(P, x, y, zf(x, y))); }
      grid.push(row);
    }
    for(let i = 0; i < rows; i++) for(let j = 0; j < cols; j++){
      const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j + 1], d = grid[i + 1][j];
      if((i + j) & 1){ M.poly(P, [a, b, c]); M.poly(P, [a, c, d]); } else { M.poly(P, [a, b, d]); M.poly(P, [b, c, d]); }
    }
    P.loop = [...grid.map(r => r[0]), ...grid[rows].slice(1), ...grid.map(r => r[cols]).reverse().slice(1), ...grid[0].slice(0, -1).reverse().slice(0, -1)];
    P.grid = grid;
    return M.close(P);
  };
  /* A rim: an outline with no fill, drawn as a heavy line (a head's contour inside a mane). */
  M.rim = (name, outline, p = {}) => { const P = M.part(name, p), B = evenOutline(outline, p.s || 10), zf = p.z || zf0; P.loop = B.map(([x, y]) => M.vtx(P, x, y, zf(x, y))); return M.close(P); };
  /* An open line (a rib, a scapula's edge, a fold): drawn as the part's outline only. */
  M.line = (name, pts, p = {}) => { const P = M.part(name, {line:'fine', ...p}), zf = p.z || zf0; P.loop = pts.map(([x, y]) => M.vtx(P, x, y, zf(x, y))); P.open = true; return M.close(P); };
  /* A polar mesh: rings [r…] (rings[0] may be 0, a centre vertex) with sectors [n…]; quads where counts match, triangles otherwise. Rosettes, discs, eyes. */
  M.polar = (name, c, rings, sectors, p = {}) => {
    const P = M.part(name, p), z = p.z || zf0, tw = p.twist || 0, R = rng(strHash(name)), sx = p.sx || 1;
    const lv = rings.map((r, k) => {
      if(r === 0) return [M.vtx(P, c[0], c[1], z(c[0], c[1]))];
      const n = sectors[rings[0] === 0 ? k - 1 : k], a0 = (p.a0 || 0) + tw * k + (p.jit ? (R() - .5) * p.jit : 0);
      return ringPts(c, r, n, a0, sx).map(([x, y]) => M.vtx(P, x + (p.jit ? (R() - .5) * p.jit * r * .12 : 0), y, z(x, y)));
    });
    for(let k = 0; k + 1 < lv.length; k++){
      const A = lv[k], Bq = lv[k + 1], m = A.length, n = Bq.length;
      if(m === 1){ for(let j = 0; j < n; j++) M.poly(P, [A[0], Bq[j], Bq[(j + 1) % n]]); continue; }
      if(m === n){ for(let j = 0; j < n; j++) M.poly(P, [A[j], Bq[j], Bq[(j + 1) % n], A[(j + 1) % m]]); continue; }
      let i = 0, j = 0;
      while(i < m || j < n){
        const advA = j >= n || (i < m && (i + 1) / m <= (j + 1) / n + 1e-9);
        if(advA && i < m){ M.poly(P, [A[i % m], A[(i + 1) % m], Bq[j % n]]); i++; } else { M.poly(P, [A[i % m], Bq[j % n], Bq[(j + 1) % n]]); j++; }
      }
    }
    const last = lv[lv.length - 1]; P.loop = last.length > 2 ? last : [];
    return M.close(P);
  };
  /* A strip of quads along a polyline of stations [x, y, halfwidth]: an inlay, a band, a feather's vane. */
  M.strip = (name, S, p = {}) => {
    const P = M.part(name, p), zf = p.z || zf0;
    const lv = S.map((s, i) => {
      const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const p1 = [s[0] - ty * s[2], s[1] + tx * s[2]], p2 = [s[0] + ty * s[2], s[1] - tx * s[2]];
      return [M.vtx(P, p1[0], p1[1], zf(...p1)), M.vtx(P, p2[0], p2[1], zf(...p2))];
    });
    for(let i = 0; i + 1 < lv.length; i++) M.poly(P, [lv[i][0], lv[i + 1][0], lv[i + 1][1], lv[i][1]]);
    P.loop = [...lv.map(l => l[0]), ...lv.map(l => l[1]).reverse()];
    return M.close(P);
  };
  /* A hand-placed polygon (a tooth, a claw, a spot, a horn's tip). split: a quad as two triangles. */
  M.shape = (name, pts, p = {}) => {
    const P = M.part(name, p), zf = p.z || zf0, ids = pts.map(([x, y]) => M.vtx(P, x, y, zf(x, y)));
    if(pts.length === 4 && p.split){ M.poly(P, [ids[0], ids[1], ids[2]]); M.poly(P, [ids[0], ids[2], ids[3]]); } else M.poly(P, ids);
    P.loop = ids;
    return M.close(P);
  };
  /* Several hand-placed polygons in one part (a fan of feathers, a row of teeth). Each entry is a list of points. */
  M.shapes = (name, list, p = {}) => {
    const P = M.part(name, p), zf = p.z || zf0;
    for(const pts of list){ const ids = pts.map(([x, y]) => M.vtx(P, x, y, zf(x, y))); M.poly(P, ids); }
    P.loop = []; return M.close(P);
  };

  /* ---------- the skeleton ----------
     bone(name, parent, p, q, o): p is the joint (the pivot), q the bone's end. o: grp (the posture stage it belongs to: root, front, rear, head,
     tail, wing…), lim [lo, hi] (rotation limits against rest, radians), sec (a secondary chain: takes the Dynamics damping and the Motion scale),
     mot (its pose channel is scaled by Motion too), speed (how fast its pose channel follows, default 8), ylim [lo, hi] (a slide bone's range),
     wind / windRoot (a chain that winds up before it swings, as a tail does on a posture change). */
  M.bone = (name, parent, p, q, b = {}) => {
    M.BI[name] = M.bones.length;
    M.bones.push({name, parent:parent ? M.BI[parent] : -1, p, q, len:Math.hypot(q[0] - p[0], q[1] - p[1]), grp:b.grp || 'root', anat:b.anat ?? true, lim:b.lim, sec:!!b.sec, mot:!!b.mot, speed:b.speed || 8, ylim:b.ylim, wind:!!b.wind, windRoot:!!b.windRoot});
    if(parent && M.BI[parent] === undefined) throw new Error('creature-kit: bone ' + name + ' before its parent ' + parent);
    return M.BI[name];
  };
  /* a follower: a bone that lags the absolute angle of its chain and overshoots (a tail tuft, a crest, a feather tip) */
  M.followers = [];
  /* a morph: a second form of the same mesh, blended in by a weight 0..1 (a lamb's head into a ram's, horns growing out of their buds). fn(x, y, part)
     gives each rest vertex its displacement in the full form, or null; lag(x, y, part) (0..0.85) holds a vertex back until the weight passes it, so a
     horn grows from its base to its tip rather than swelling all at once. The skeleton does not morph: keep bones where both forms can use them. */
  M.morphs = [];
  M.morph = (name, fn, o = {}) => { M.morphs.push({name, fn, lag:o.lag || null, k:o.k ?? 1.2, start:o.start ?? 0, part:o.part || null, parts:o.parts || null}); };   // part/parts: only these parts' vertices are evaluated (a per-group morph on a large figure)
  /* a chain: a long run of bones along a polyline (a serpent's body, a dragon's neck and tail, a long tail), named name0..name(n-1) from
     the first point to the last, each a child of the one before (the first a child of `parent`). n bones evenly spaced by arc length.
     Returns the names. Bind a strip along it with M.limb(..., {bind:{chain:names, sigma}}). The bones carry the chain's own rest length,
     so c.chainWave can lay a bend along it by arc length. */
  M.chains = {};
  M.chain = (name, pts, n, o = {}) => {
    const L = [0]; for(let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const at = d => { let k = 1; while(k < pts.length - 1 && L[k] < d) k++; const u = (d - L[k - 1]) / ((L[k] - L[k - 1]) || 1); return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u]; };
    const names = [], tot = L[L.length - 1];
    for(let i = 0; i < n; i++){ const nm = name + i; M.bone(nm, i ? name + (i - 1) : o.parent || null, at(tot * i / n), at(tot * (i + 1) / n), {grp:o.grp || 'tail', lim:o.lim || [-1.2, 1.2], sec:o.sec ?? true, mot:o.mot, speed:o.speed ?? 6, wind:i > 0 && o.wind, windRoot:i === 0 && o.wind}); names.push(nm); }
    M.chains[name] = {names, len:tot, seg:tot / n};
    return names;
  };
  M.follower = (bone, f = {}) => { M.followers.push({bone, k:f.k ?? 3.2, w:f.w ?? 11, z:f.z ?? .5, gain:f.gain ?? .8, lim:f.lim ?? .5, flutter:f.flutter ?? .05}); };
  /* a leg on two-bone IK: bones [upper, lower, foot]; bend 1 or -1 (which way the middle joint folds); kind (fore, hind, or any name the
     leg pads use); side N (near) or F (far); grp (its posture stage); reach (how far the leg pad's reach shifts the foot); roll (how much the
     foot rolls through the stance); mus: for each of the three joints [flexor id, extensor id, gain when negative, gain when positive], so the
     muscles take the activations that match the solved angles and bulge with the pose. */
  M.leg = l => { M.legs.push({...l, grp:l.grp || (l.kind === 'hind' ? 'rear' : l.kind === 'fore' ? 'front' : 'legs'), reach:l.reach ?? 35, roll:l.roll ?? 1}); return M.legs.length - 1; };

  /* ---------- the muscles ----------
     The face rig's muscle: centre c, radii r, a vector v (or pull toward the centre), speed, hue, shade (the crease ink: K.crease, K.glow,
     K.both). New for creatures: pair (LR mirrors across the model's axis, NF is the near and far limb, the far set offset by `far`), on (which
     parts' vertices it reaches, by tag; default skin), jt (the joints it turns: [bone, gain, kind], kind r rotation, y or x a slide, yaw the
     head's turn; '$' in a bone name is replaced by the side), vm:0 (v does not mirror), g (the group the page lists it under). */
  M.muscle = (id, d) => { M.defs[id] = Object.assign({name:id, g:'body', speed:8, hue:'#9aa6d8'}, d); return id; };

  /* ---------- the posture graph ----------
     posture(name, {root:[dx, dy, r] about the pivot, slide:{bone:[dx, dy]}, jt:{bone:angle}, feet:[[x, y, angle] or null per leg], cam:[scale,
     cx, cy], ground:0..1}). Everything not given is the rest pose. The first posture declared is the one the creature starts in.
     edge('a>b', {ms, g:{group:[delay, length]}, c:{channel:[delay, length]}, bumps:[[channel, delay, length, amount]]}). A missing reverse edge
     is the forward one run backwards. transit(name, ms): passing through this posture on the way costs extra. */
  M.posture = (name, s) => { M.postures[name] = s; };
  M.edge = (key, s) => { M.edges[key] = s; };
  M.transitCost = (name, ms) => { M.transit[name] = ms; };
  M.rootV = (pv, th, dx = 0, dy = 0) => { const pivot = M.o.pivot || [M.W / 2, M.H / 2], ct = Math.cos(th), st = Math.sin(th), vx = pivot[0] - pv[0], vy = pivot[1] - pv[1]; return [ct * vx - st * vy + pv[0] - pivot[0] + dx, st * vx + ct * vy + pv[1] - pivot[1] + dy, th]; };
  /* ---------- gaits ----------
     gait(name, {psi (its place on the blend line: gaits next to each other morph into each other), base (the posture it runs on), L (stride),
     cyc (ms per cycle), duty (the share of a cycle a foot is down), lift[], off[] (footfall phase per leg), flex[], hs[] (each foot's stance
     shift forward), bob, sink, cap (the highest tempo its contacts hold), lead (the leg that lifts first)}). */
  M.gait = (name, g) => { M.gaits[name] = {base:'stand', lead:0, bob:4, sink:0, cap:1.9, ...g}; };
  /* ---------- actions ----------
     action(name, {label, group, dur (ms), big (one big action at a time), in:[postures it works in] (absent: every posture, it is a layer),
     gait:true|fn (it may run on a gait), f(t, T, c, a)}). f adds to the muscle targets T and to the pose (c.jt, c.jd, c.rootAbout, c.legTo...);
     return false to end early. */
  M.action = (name, a) => { M.actions[name] = {dur:2000, label:name, group:'Actions', ...a}; };
  /* ---------- pads ----------
     pad(id, {label, group (the card it sits in), x:[low, high], y:[low, high] (the edge labels), split:'LR'|'NF', map(x, y) -> {muscle:value or
     [L, R]}, fx(c, x, y) (pose channels, for what is not a muscle), ghost(c, side) -> [x, y] (where the body actually is, on the pad's axes),
     leg:kind (a leg pad: an offset inside the IK)}). */
  M.pad = (id, p) => { M.pads[id] = {group:'Body', ...p}; if(!M.padGroups.includes(M.pads[id].group)) M.padGroups.push(M.pads[id].group); };
  /* ---------- digits: the toes of a foot (anatomy audit, round 5) ----------
     M.digits(foot, {parent, at:[x, y], side:'N'|'F'|'', toes:[{id, dir, off, phal:[lengths before the claw], claw, w, flex, lim, curve}], layer, dim, line, tone, zone, tags, grp, speed}) builds, for every toe, a chain
     of bones, one per phalanx, the last the UNGUAL (the claw's own), named `toe<id><k><side>` (k from 1); a strip part per phalanx bound rigidly to its own bone; the claw, bound to the ungual; and a
     plantar pad on the first phalanx. A toe part is never left skinned to the foot it hangs from. A bird has 2, 3, 4 and 5 phalanges on toes I (the hallux) to IV, the claw counted.
     dir: 0 is forward (+x), pi back; off the toe's base from `at`; w the half-width at the base (it tapers); flex +1 for a toe that curls by turning clockwise (a forward toe) and -1 for the hallux;
     lim [[lo, hi], ...] per bone (the default is a bird's: the first joint a little freer to extend, the rest bending right round); curve the side the claw hooks to (default: toward the ground).
     Returns {id:{bones, parts, claw, pad, p0, dir, flex}}; M.digitMuscles(returned, {...}) gives the toes their muscles. */
  M.digits = (foot, o) => {
    const side = o.side || '', out = {}, tags = ['leg', 'foot', 'digit', ...(o.tags || [])], DL = [[-.7, 1.5], [-.45, 1.75], [-.4, 1.75], [-.35, 1.7], [-.35, 1.7]];
    (o.toes || []).forEach((t, ti) => {
      const n = t.phal.length, dir = t.dir || 0, tx = Math.cos(dir), ty = Math.sin(dir), nx = -ty, ny = tx, flex = t.flex ?? (tx >= 0 ? 1 : -1), cv = t.curve ?? flex, w0 = t.w ?? 8;
      const p0 = [o.at[0] + (t.off ? t.off[0] : 0), o.at[1] + (t.off ? t.off[1] : 0)], pts = [p0]; for(let k = 0; k < n; k++) pts.push([pts[k][0] + tx * t.phal[k], pts[k][1] + ty * t.phal[k]]);
      const names = Array.from({length:n + 1}, (_, k) => 'toe' + t.id + (k + 1) + side), wd = k => w0 * (1 - .42 * Math.min(1, k / Math.max(1, n)));
      names.forEach((nm, k) => {
        const a = k === 0 ? p0 : pts[k], b = k < n ? pts[k + 1] : [pts[n][0] + tx * t.claw, pts[n][1] + ty * t.claw], lim = t.lim && t.lim[k] ? t.lim[k] : DL[Math.min(k === n ? 1 : k, DL.length - 1)].map(v => v);
        M.bone(nm, k ? names[k - 1] : o.parent, a, b, {grp:o.grp || 'legs', lim:flex < 0 && !(t.lim && t.lim[k]) ? [-lim[1], -lim[0]] : lim, sec:true, speed:o.speed ?? 12, anat:'line'});
      });
      const line = o.line || 'feature', zone = o.zone || 'paws', layer = (o.layer ?? 5.72) + ti * .001, dim = !!o.dim, base = {layer, tier:'F', ptier:'F', dim, line, tags:[...tags, 'toe', 'toe' + t.id], zone, tone:o.tone ?? .22};
      const parts = [];
      for(let k = 0; k < n; k++){ M.limb('toe' + t.id + (k + 1) + side, [[pts[k][0], pts[k][1], wd(k), wd(k)], [pts[k + 1][0], pts[k + 1][1], wd(k + 1), wd(k + 1)]], {...base, h:11, cols:1, bind:{rigid:names[k]}}); parts.push('toe' + t.id + (k + 1) + side); }
      const pe = pts[n], s = t.claw / 40, q = (a, b) => [pe[0] + tx * a * s + nx * b, pe[1] + ty * a * s + ny * b], wc = wd(n);
      M.shape('claw' + t.id + side, [q(-8, -wc * .7 * cv), q(8, -wc * .75 * cv), q(22, -wc * .3 * cv), q(34, wc * .9 * cv), q(40, wc * 2.7 * cv), q(30, wc * 1.8 * cv), q(18, wc * 1.1 * cv), q(6, wc * .7 * cv), q(-8, wc * .7 * cv)], {...base, layer:layer + .02, tags:[...tags, 'claw', 'toe' + t.id], bind:{rigid:names[n]}, tone:.95});
      const pc = [p0[0] + tx * t.phal[0] * .45 + nx * w0 * .5 * cv, p0[1] + ty * t.phal[0] * .45 + ny * w0 * .5 * cv], pr = [t.phal[0] * .3, w0 * .34];
      M.shape('padToe' + t.id + side, Array.from({length:6}, (_, i) => { const a = i * Math.PI / 3, u = Math.cos(a) * pr[0], v = Math.sin(a) * pr[1]; return [pc[0] + tx * u + nx * v, pc[1] + ty * u + ny * v]; }), {...base, layer:layer + .01, tags:[...tags, 'pad', 'toe' + t.id], bind:{rigid:names[0]}, tone:.5});
      out[t.id] = {id:t.id, bones:names, parts, claw:'claw' + t.id + side, pad:'padToe' + t.id + side, p0, dir, flex, phal:t.phal.slice(), w:w0};
    });
    return out;
  };
  /* M.digitMuscles(digits, {pair:'NF', g:'toes', far, hue, flexGain, splay:{II:-.26, IV:.22}}): the toes' muscles. A flexor and an extensor for every toe (flexor digitorum longus slips, extensor digitorum longus,
     the hallux's own), the outer toes' abductors (which fan the first phalanx), and the foot's shared flexDig, extDig and abdDig, which turn them all together. Each turns the toe's bones, the distal
     ones through more than the proximal ones, so a toe curls from the tip. `digits` is what M.digits returned for the near side (a bone's side letter becomes `$` when paired). */
  M.digitMuscles = (D, o = {}) => {
    const pair = o.pair === undefined ? 'NF' : o.pair, T = n => pair ? n.slice(0, -1) + '$' : n, g = o.g || 'toes', fg = o.flexGain ?? 1, W = [.85, 1, 1.05, 1.05, .7], splay = o.splay || {II:-.26, IV:.22}, far = o.far;
    const mk = (id, name, jt, c, r, on, hue, speed = 12) => M.muscle(id, {name, g, pair:pair || undefined, far, c, r, on, jt, hue, speed, shade:glow_(c, r[0] * .8, r[1] * .8, .42)}), glow_ = (c, rx, ry, a) => K.glow(c[0], c[1], rx, ry, a);
    const NAMES = {I:'hallux', II:'toe II', III:'toe III', IV:'toe IV'}, all = [], none = [], spread = [];
    for(const [id, d] of Object.entries(D)){
      const k = d.bones.length, ws = d.bones.map((b, i) => W[Math.min(i, W.length - 1)] * (i === k - 1 ? .8 : 1)), wsum = ws.reduce((a, b) => a + b, 0), tot = Math.min(fg, 1.15 * k), gains = d.bones.map((b, i) => [T(b), d.flex * tot * ws[i] / wsum]), c = [d.p0[0] + Math.cos(d.dir) * d.phal[0], d.p0[1] + Math.sin(d.dir) * d.phal[0]], r = [Math.max(30, d.phal.reduce((a, b) => a + b, 0) * .7), 16];
      mk('flex' + id, (id === 'I' ? 'flexor hallucis longus' : 'flexor digitorum longus') + ' (' + NAMES[id] + ')', gains, c, r, ['toe' + id], o.hue || '#e3806f');
      mk('ext' + id, (id === 'I' ? 'extensor hallucis longus' : 'extensor digitorum longus') + ' (' + NAMES[id] + ')', gains.map(([b, v]) => [b, -v * .4]), c, r, ['toe' + id], o.hueExt || '#7ec3e6');
      all.push(...gains); none.push(...gains.map(([b, v]) => [b, -v * .4]));
      if(splay[id]){ mk('abd' + id, 'abductor digiti (' + NAMES[id] + ', the fan)', [[T(d.bones[0]), splay[id]]], c, r, ['toe' + id], o.hueAbd || '#9aa6d8'); spread.push([T(d.bones[0]), splay[id]]); }
    }
    const first = Object.values(D)[0], cc = [first.p0[0] + 20, first.p0[1] - 4], rr = [60, 24];
    mk('flexDig', 'flexor digitorum (the grip, every toe)', all, cc, rr, ['toe', 'claw'], o.hue || '#e3806f');
    mk('extDig', 'extensor digitorum (every toe open)', none, cc, rr, ['toe', 'claw'], o.hueExt || '#7ec3e6');
    mk('abdDig', 'abductor digiti (the toes fan out)', spread, cc, rr, ['toe', 'claw'], o.hueAbd || '#9aa6d8');
  };
  M.finish = hooks => finishModel(M, hooks);
  return M;
};
/* crease shades, as the face rig draws them: a gaussian times a band of creases at angle `ang` and frequency f; a soft glow; the larger of two */
K.crease = (cx, cy, rx, ry, ang, f, amp = .5, lo = .78, hi = .95) => { const ca = Math.cos(ang), sa = Math.sin(ang); return (x, y) => gauss(x, y, cx, cy, rx, ry) * fSmooth(lo, hi, Math.abs(Math.sin(((x - cx) * ca + (y - cy) * sa) * f))) * amp; };
K.glow = (cx, cy, rx, ry, amp = .5) => (x, y) => gauss(x, y, cx, cy, rx, ry) * amp;
K.both = (a, b) => (x, y) => Math.max(a(x, y), b(x, y));

/* ---------- finish: everything derived from the declarations, once ----------
   hooks (all optional): idle(c, now, Ti, dt) the breath and small idle motion; postureHold(c, w, Ta) what each posture holds in the muscles;
   gaitBody(c, G, k, ph, mk) a gait's spine, neck and tail swing; post(c, rot, sx, sy, now, dt) last touches on the joints before the
   limits (a sun's turn); colour(c, i, col, now) an extra additive colour; glyph(cx, cy, part) -> [s, halo] or null: the place of a glyph
   polygon on the sign's path (0..1) for the travelling light; life {small, moves, dwell, gait, gaitFor}; lifePick(c, pick, now) -> true when
   the creature handles a pick itself; ripple {tag, centre} the ring a ripple runs round; info {sign, archetype, sub};
   guard(c, target) -> false to hold a request to go to the posture `target` (a state the creature must undo first, such as a tail it has eaten); it keeps
   c.pm.after (a gait waiting on the route) and calls c.go(target) again when it is ready. */
function finishModel(M, hooks = {}){
  const o = M.o, def = Object.assign({}, hooks);
  Object.assign(def, {id:o.id, name:o.name || o.id, sign:o.sign || '', title:o.title || (o.name || o.id).toUpperCase(), sub:o.sub || '', ink:o.ink, accent:o.accent, ground:o.ground,
    W:M.W, H:M.H, groundY:o.groundY ?? null, pivot:o.pivot || [M.W / 2, M.H / 2], axis:o.axis ?? M.W / 2, yawC:o.yawC ?? o.axis ?? M.W / 2, far:o.far || {}, silLayer:o.silLayer ?? 2,
    cam0:o.cam || [1, M.W / 2, M.H / 2], parts:M.parts, bones:M.bones, BI:M.BI, defs:M.defs, legs:M.legs, gaits:M.gaits, actions:M.actions, pads:M.pads, zoneW:M.zoneW, followers:M.followers});
  const VX = Float32Array.from(M.VX), VY = Float32Array.from(M.VY), VZ = Float32Array.from(M.VZ), VYAW = Uint8Array.from(M.VYAW), VP = Int16Array.from(M.VP);
  const PV = M.PV, PPART = Int16Array.from(M.PPART), PTIER = Uint8Array.from(M.PTIER), PARTS = M.parts, BONES = M.bones, BI = M.BI, NB = BONES.length;
  const NPOLY = PV.length, NVERT = VX.length;
  if(!NB) throw new Error('creature-kit: a creature needs at least one bone');
  Object.assign(def, {VX, VY, VZ, VYAW, VP, PV, PPART, PTIER, NPOLY, NVERT, NB});
  def.DRAW = PARTS.slice().sort((a, b) => a.layer - b.layer || a.order - b.order);
  /* the growable parts, as the model declared them: an organ, the point it grows about (canvas coords), its parent part. Empty when a
     model declares none, so the hook is inert for every creature that does not use it. c.form(name, matrix) places one part's group. */
  def.PARTI = PARTS.filter(P => P.organ).map(P => ({name:P.name, organ:P.organ, base:P.base ? P.base.slice() : null, parent:P.parent || null, part:P.order}));
  def.PARTN = Object.fromEntries(def.PARTI.map((p, i) => [p.name, i]));
  const PCX = new Float32Array(NPOLY), PCY = new Float32Array(NPOLY);
  PV.forEach((ids, i) => { let x = 0, y = 0; for(const v of ids){ x += VX[v]; y += VY[v]; } PCX[i] = x / ids.length; PCY[i] = y / ids.length; });
  def.PCX = PCX; def.PCY = PCY;
  /* ink tone per polygon: 0 bare skin .. 1 full ink. A part's tone is a number or a function of the polygon's centre; the default is bare skin
     with a faint light from above. */
  const PTONE = new Float32Array(NPOLY), top = Math.min(...VY), hgt = (Math.max(...VY) - top) || 1;
  for(let i = 0; i < NPOLY; i++){
    const P = PARTS[PPART[i]], cx = PCX[i], cy = PCY[i];
    const t = typeof P.tone === 'function' ? P.tone(cx, cy, i, P) : typeof P.tone === 'number' ? P.tone : .03 + .08 * (1 - (cy - top) / hgt) + P.bias + (vnoise(cx * .03, cy * .03) - .5) * .05;
    PTONE[i] = clamp(t + (hash(i * 7 + 3) - .5) * P.tj, 0, 1);
  }
  def.PTONE = PTONE;
  /* zones, as the face rig's skinW: how much of the general skin effects (drift, jitter, bursts, flips, the field) each zone takes */
  const ZN = [...new Set(['skin', ...Object.keys(M.zoneW), ...PARTS.map(P => P.zone)])], FW = new Float32Array(NPOLY), ZLIST = Object.fromEntries(ZN.map(z => [z, []]));
  for(let i = 0; i < NPOLY; i++){ const z = PARTS[PPART[i]].zone; FW[i] = M.zoneW[z] ?? 0; ZLIST[z].push(i); }
  def.ZONES = ZN; def.FW = FW; def.ZLIST = ZLIST;
  def.FLIPPABLE = []; for(let i = 0; i < NPOLY; i++) if(FW[i] >= .3) def.FLIPPABLE.push(i);
  /* skin weights: a part binds rigidly to a bone, to a fixed mix, along a chain by capsule distance (so a limb bends at its joint and a torso
     arches along its spine), or by its own function. The default is the root bone. */
  const SKB = new Int16Array(NVERT * 3).fill(-1), SKW = new Float32Array(NVERT * 3);
  const capsule = (b, x, y) => { const B = BONES[b]; return segDist(x, y, B.p[0], B.p[1], B.q[0], B.q[1]); };
  const bix = n => { const b = BI[n]; if(b === undefined) throw new Error('creature-kit: no bone ' + n); return b; };
  for(let v = 0; v < NVERT; v++){
    const P = PARTS[VP[v]], x = VX[v], y = VY[v], bind = P.bind || {rigid:BONES[0].name}; let L;
    if(typeof bind === 'function') L = bind(x, y).map(([n, w]) => [bix(n), w]);
    else if(bind.rigid) L = [[bix(bind.rigid), 1]];
    else if(bind.mix) L = bind.mix.map(([n, w]) => [bix(n), w]);
    else { const ids = bind.chain.map(bix), d = ids.map(b => capsule(b, x, y)), dm = Math.min(...d); L = ids.map((b, k) => [b, Math.exp(-(((d[k] - dm) / (bind.sigma || 30)) ** 2))]); }
    L.sort((a, b) => b[1] - a[1]); L = L.slice(0, 3).filter(a => a[1] > .02);
    const sum = L.reduce((s, a) => s + a[1], 0) || 1;
    L.forEach(([b, w], k) => { SKB[v * 3 + k] = b; SKW[v * 3 + k] = w / sum; });
  }
  def.SKB = SKB; def.SKW = SKW;
  PARTS.forEach(P => { P.bones = new Set(); for(let v = P.v0; v < P.v1; v++) for(let k = 0; k < 3; k++) if(SKB[v * 3 + k] >= 0) P.bones.add(SKB[v * 3 + k]); P.boneList = [...P.bones]; });
  /* the muscles, instanced per side */
  const SIDES = {LR:['L', 'R'], NF:['N', 'F']}, MUS = [], MI = {}, tmp = new Float32Array(NVERT), AX = def.axis;
  for(const [id, d] of Object.entries(M.defs)){
    for(const side of d.pair ? SIDES[d.pair] : ['C']){
      const mir = side === 'L', far = side === 'F', off = far ? (d.far || def.far[d.g] || def.far.default || [0, 0]) : [0, 0], c0 = d.c, r = d.r;
      const inst = {id, side, def:d, n:MUS.length, verts:[], dx:[], dy:[], parts:new Set(), wPoly:new Float32Array(NPOLY), shadeI:[], shadeW:[], jl:[]};
      MI[id + '.' + side] = inst.n; tmp.fill(0);
      const to = (x, y) => [(mir ? 2 * AX - x : x) - off[0], y - off[1]];
      if(c0 && r) for(const P of PARTS){
        if(!(d.on || ['skin']).some(t => P.tags.has(t) || P.zone === t)) continue;
        if(d.pair === 'NF' && (side === 'F') !== P.tags.has('F')) continue;
        if(d.pair === 'LR' && P.tags.has(mir ? 'R' : 'L') && !P.tags.has('LR')) continue;   // a part tagged for one side only takes that side's muscle
        for(let v = P.v0; v < P.v1; v++){
          const [X, Y] = to(VX[v], VY[v]), w = gauss(X, Y, c0[0], c0[1], r[0], r[1]);
          if(w < .03) continue;
          tmp[v] = w;
          let vx = 0, vy = 0;
          if(d.pull){ vx = (c0[0] - X) * d.pull[0]; vy = (c0[1] - Y) * d.pull[1]; } else if(d.v){ vx = d.v[0]; vy = d.v[1]; }
          if(vx || vy){ inst.verts.push(v); inst.dx.push((mir && d.vm !== 0 ? -vx : vx) * w); inst.dy.push(vy * w); inst.parts.add(P.order); }
        }
        if(d.shade) for(let i = P.p0; i < P.p1; i++){ const [X, Y] = to(PCX[i], PCY[i]), s = Math.min(.6, d.shade(X, Y)); if(s > .03){ inst.shadeI.push(i); inst.shadeW.push(s); } }
      }
      for(let i = 0; i < NPOLY; i++){ let w = 0; for(const v of PV[i]) if(tmp[v] > w) w = tmp[v]; inst.wPoly[i] = w; }
      inst.verts = Int32Array.from(inst.verts); inst.dx = Float32Array.from(inst.dx); inst.dy = Float32Array.from(inst.dy);
      inst.shadeI = Int32Array.from(inst.shadeI); inst.shadeW = Float32Array.from(inst.shadeW); inst.partList = [...inst.parts];
      for(const [tpl, g, kind] of d.jt || []){
        if(kind === 'yaw'){ inst.jl.push([-1, mir ? -g : g, 2]); continue; }
        const b = BI[tpl.replace('$', side)]; if(b === undefined) throw new Error('creature-kit: muscle ' + id + ' turns no bone ' + tpl.replace('$', side));
        inst.jl.push([b, ((kind || 'r') === 'r' || kind === 'x') && mir ? -g : g, kind === 'y' ? 1 : kind === 'x' ? 3 : 0]);   // a mirrored side turns and slides the other way
      }
      // the fibre the anatomy view draws: from the parent bone to the bone it turns
      const dir = d.dir || (d.v && (d.v[0] || d.v[1]) ? d.v : [0, -1]), dl = Math.hypot(dir[0], dir[1]) || 1, reach = c0 && r ? Math.max(r[0], r[1]) * .9 : 20;
      const cx = c0 ? (mir ? 2 * AX - c0[0] : c0[0]) + off[0] : 0, cy = c0 ? c0[1] + off[1] : 0, ddx = (mir ? -dir[0] : dir[0]) / dl, ddy = dir[1] / dl;
      /* the bone the muscle's field lies on, by skin weight over the polygons it reaches (anatomy audit, round 5): a muscle with no joint and no `host` hangs on it (it was hung on the root, so a lid's
         or a tongue's fibre stayed behind when the head turned), and a muscle whose body lies on one bone but which turns another (a pectoralis on the keel turning the humerus) starts on it */
      let dom = 0; { const sh = new Float32Array(NB); for(let i = 0; i < NPOLY; i++){ const w = inst.wPoly[i]; if(w < .3) continue; for(const v of PV[i]) for(let k = 0; k < 3; k++){ const b = SKB[v * 3 + k]; if(b < 0) break; sh[b] += w * SKW[v * 3 + k]; } } for(let b = 1; b < NB; b++) if(sh[b] > sh[dom]) dom = b; } inst.dom = dom;
      const ins = inst.jl.find(j => j[2] !== 2), insB = ins ? ins[0] : d.host ? BI[d.host.replace('$', side)] : dom;
      let fo = c0 ? [cx - ddx * reach, cy - ddy * reach] : null, fi = c0 ? [cx, cy] : null, fib_b = insB, fob = ins ? Math.max(0, BONES[insB].parent) : insB;
      if(c0 && ins && dom !== insB){   // the body of the muscle is far from the bone it turns, and on a bone that is not that bone or below it: the tendon runs to the nearest point of the bone, the belly starts on its own bone
        const B = BONES[insB], bx = B.q[0] - B.p[0], by = B.q[1] - B.p[1], t = clamp(((cx - B.p[0]) * bx + (cy - B.p[1]) * by) / (bx * bx + by * by || 1)), qx = B.p[0] + bx * t, qy = B.p[1] + by * t;
        let under = false; for(let q = dom; q >= 0; q = BONES[q].parent) if(q === insB) under = true;
        if(Math.hypot(cx - qx, cy - qy) > 45 && !under){ fo = [cx, cy]; fi = [qx, qy]; fob = dom; }
        else if(Math.hypot(cx - qx, cy - qy) > 45 && under){ fib_b = dom; fob = dom; }   // a muscle that turns a whole chain (a neck's extensors, a tail's) by its first bone but lies far along it: the fibre rides the bone it lies on
      }
      inst.fib = c0 ? {o:fo, i:fi, ob:fob, ib:fib_b, yaw:!!d.yaw} : null;
      MUS.push(inst);
    }
  }
  def.MUS = MUS; def.MI = MI; def.NM = MUS.length; def.SIDES = SIDES;
  const legBones = new Set(); M.legs.forEach(L => L.bones.forEach(n => legBones.add(bix(n))));
  for(const m of MUS) m.leg = m.jl.some(j => j[2] === 0 && legBones.has(j[0]));
  def.DOM = new Int16Array(NPOLY).fill(-1);
  for(let i = 0; i < NPOLY; i++){ let bw = .3; for(const m of MUS) if(m.wPoly[i] > bw){ bw = m.wPoly[i]; def.DOM[i] = m.n; } }
  def.musHue = MUS.map(m => hexInt(m.def.hue));
  def.SHOWP = PARTS.filter(P => P.show).map(P => { const s = P.show.includes('.') ? P.show : P.show + '.' + (P.tags.has('F') ? 'F' : P.tags.has('N') ? 'N' : P.tags.has('L') ? 'L' : P.tags.has('R') ? 'R' : 'C'); const n = MI[s] ?? MI[P.show + '.C'] ?? MI[P.show + '.N']; if(n === undefined) throw new Error('creature-kit: part ' + P.name + ' shown by no muscle ' + s); return {k:P.order, n}; });
  /* joints: limits, speeds, which chains are secondary */
  def.LIMLO = new Float32Array(NB).fill(-99); def.LIMHI = new Float32Array(NB).fill(99); def.JSPEED = new Float32Array(NB); def.SECB = new Uint8Array(NB); def.MOTJT = new Uint8Array(NB);
  def.YLO = new Float32Array(NB).fill(-1e4); def.YHI = new Float32Array(NB).fill(1e4);
  BONES.forEach((B, b) => { if(B.lim){ def.LIMLO[b] = B.lim[0]; def.LIMHI[b] = B.lim[1]; } def.JSPEED[b] = B.speed; def.SECB[b] = B.sec ? 1 : 0; def.MOTJT[b] = B.mot ? 1 : 0; if(B.ylim){ def.YLO[b] = B.ylim[0]; def.YHI[b] = B.ylim[1]; } });
  def.CHAINS = M.chains || {};
  def.FOLLOW = M.followers.map(f => { const b = bix(f.bone), chain = []; for(let q = BONES[b].parent; q >= 0; q = BONES[q].parent) chain.push(q); return {...f, b, chain}; });
  /* legs on IK */
  def.IKD = M.legs.map(L => {
    const b = L.bones.map(bix), B = b.map(i => BONES[i]);
    if(B[1].parent !== b[0] || B[2].parent !== b[1]) throw new Error('creature-kit: a leg\'s bones must be a chain: ' + L.bones.join(' '));
    const mus = (L.mus || []).map(e => e && [MI[e[0] + '.' + (L.side || 'C')] ?? MI[e[0] + '.C'], MI[e[1] + '.' + (L.side || 'C')] ?? MI[e[1] + '.C'], e[2], e[3]]);
    return {...L, b, par:B[0].parent, S:B[0].p, l1:B[0].len, l2:B[1].len, l3:B[2].len, a:B.map(x => Math.atan2(x.q[1] - x.p[1], x.q[0] - x.p[0])), bend:L.bend ?? 1, tip:B[2].q.slice(), mus, ms:new Set(mus.flatMap(e => e ? [e[0], e[1]] : []).filter(v => v !== undefined))};
  });
  const NL = def.IKD.length; def.NL = NL;
  def.IKLEG = new Int8Array(NB).fill(-1); def.IKD.forEach((D, k) => { def.IKLEG[D.b[0]] = k; });
  def.LEGB = new Uint8Array(NB); def.LEGOF = new Int8Array(NB).fill(-1); def.IKD.forEach((D, k) => D.b.forEach(b => { def.LEGB[b] = 1; def.LEGOF[b] = k; }));
  def.LEGJ = def.IKD.map(D => { const out = []; for(const m of MUS) for(const [b, g, kd] of m.jl) if(kd === 0 && D.b.includes(b)) out.push({n:m.n, b, g}); return out; });
  /* the posture channels: the root (slide and turn about the pivot), each slide bone, each joint a posture names, each foot, the camera, the ground */
  const PN = Object.keys(M.postures); if(!PN.length) M.postures.stand = {}, PN.push('stand');
  const slideB = new Set(), jointB = new Set();
  for(const s of Object.values(M.postures)){ Object.keys(s.slide || {}).forEach(n => slideB.add(bix(n))); Object.keys(s.jt || {}).forEach(n => jointB.add(bix(n))); }
  const CH = [], CHI = {}, addCh = (name, grp) => { CHI[name] = CH.length; CH.push({name, grp}); };
  addCh('rx', 'root'); addCh('ry', 'root'); addCh('rr', 'root');
  for(const b of slideB){ addCh('s:' + BONES[b].name + '.x', BONES[b].grp); addCh('s:' + BONES[b].name + '.y', BONES[b].grp); }
  for(const b of jointB) addCh('j:' + BONES[b].name, BONES[b].grp);
  def.IKD.forEach((D, k) => { addCh('f' + k + 'x', D.grp); addCh('f' + k + 'y', D.grp); addCh('f' + k + 'b', D.grp); });
  addCh('cs', 'cam'); addCh('cx', 'cam'); addCh('cy', 'cam'); addCh('gnd', 'cam');
  def.CH = CH; def.CHI = CHI; def.NV = CH.length; def.slideB = [...slideB]; def.jointB = [...jointB];
  def.slideIdx = def.slideB.map(b => [b, CHI['s:' + BONES[b].name + '.x'], CHI['s:' + BONES[b].name + '.y']]); def.jointIdx = def.jointB.map(b => [b, CHI['j:' + BONES[b].name]]);
  def.chWind = CH.map(ch => { if(!ch.name.startsWith('j:')) return 0; const B = BONES[BI[ch.name.slice(2)]]; return B.windRoot ? 2 : B.wind ? 1 : 0; });
  def.chFar = CH.map(ch => { const m = /^f(\d+)[xyb]$/.exec(ch.name); return m && def.IKD[+m[1]].side === 'F' ? 1 : 0; });
  const mkP = s => {
    const v = new Float32Array(def.NV), r = s.root || [0, 0, 0];
    v[0] = r[0]; v[1] = r[1]; v[2] = r[2];
    for(const [n, d] of Object.entries(s.slide || {})){ v[CHI['s:' + n + '.x']] = d[0]; v[CHI['s:' + n + '.y']] = d[1]; }
    for(const [n, a] of Object.entries(s.jt || {})) v[CHI['j:' + n]] = a;
    def.IKD.forEach((D, k) => { const f = s.feet && s.feet[k] || [D.tip[0], D.tip[1], D.a[2]]; v[CHI['f' + k + 'x']] = f[0]; v[CHI['f' + k + 'y']] = f[1]; v[CHI['f' + k + 'b']] = f[2] ?? D.a[2]; });
    const cm = s.cam || def.cam0; v[CHI.cs] = cm[0]; v[CHI.cx] = cm[1]; v[CHI.cy] = cm[2]; v[CHI.gnd] = s.ground || 0;
    return v;
  };
  def.POSTURE_NAMES = PN; def.POSTURES = Object.fromEntries(PN.map(n => [n, mkP(M.postures[n])])); def.POSTURE_SPECS = M.postures; def.REST_POSTURE = PN[0];
  def.EDGES = M.edges; def.TRANSIT = M.transit;
  def.NEIGH = {}; for(const k of Object.keys(M.edges)){ const [a, b] = k.split('>'); if(!def.POSTURES[a] || !def.POSTURES[b]) throw new Error('creature-kit: edge ' + k + ' names an undeclared posture'); (def.NEIGH[a] = def.NEIGH[a] || new Set()).add(b); (def.NEIGH[b] = def.NEIGH[b] || new Set()).add(a); }
  for(const n of PN) if(PN.length > 1 && !def.NEIGH[n]) throw new Error('creature-kit: posture ' + n + ' has no edge');
  /* gaits along their blend line */
  def.GAIT_ORDER = Object.entries(M.gaits).sort((a, b) => (a[1].psi ?? 0) - (b[1].psi ?? 0)).map(([n, g]) => ({name:n, ...g}));
  def.GAIT_ORDER.forEach((g, i) => { if(g.psi === undefined) g.psi = i; });
  def.GAIT_PSI = Object.fromEntries(def.GAIT_ORDER.map(g => [g.name, g.psi]));
  for(const g of def.GAIT_ORDER) for(const k of ['lift', 'off', 'flex', 'hs']) if(!g[k] || g[k].length !== NL) throw new Error('creature-kit: gait ' + g.name + ' needs ' + k + ' for each of ' + NL + ' legs');
  /* pads, with the two every creature has: Dynamics (the tempo of everything, and the damping of the secondary chains) and Motion (how big
     the actions are, and how lively the idle) */
  const cl = v => Math.max(-1, Math.min(1, v));
  M.pad('dynamics', {label:'Dynamics', group:'Dynamics', special:1, x:['slow', 'quick'], y:['loose', 'tight'], ghost:c => [cl(Math.log2(c.tempo)), cl((c.dyn.damp - .78) / .55)]});
  M.pad('motion', {label:'Motion', group:'Dynamics', special:1, x:['small', 'large'], y:['still', 'lively'], ghost:c => [cl(Math.log2(c.mot.scale) / 1.2), cl(Math.log2(c.mot.idle) / 1.2)]});
  def.PAD_ORDER = Object.keys(M.pads); def.PAD_GROUPS = M.padGroups.filter(g => g !== 'Dynamics').concat(['Dynamics']);
  for(const [id, p] of Object.entries(M.pads)) if(!p.special && !p.map && !p.fx && !p.leg && !p.value) throw new Error('creature-kit: pad ' + id + ' needs map, fx, leg or value:true (a pad the creature only reads, c.pad[id].L)');
  /* the glyph: each glyph polygon's place on the sign's path, for the travelling light */
  def.GS = new Float32Array(NPOLY).fill(-1); def.GH = new Float32Array(NPOLY).fill(1);
  if(def.glyph) for(let i = 0; i < NPOLY; i++){ const r = def.glyph(PCX[i], PCY[i], PARTS[PPART[i]], i); if(r){ def.GS[i] = r[0]; def.GH[i] = r[1] ?? 1; } }
  def.GLYPH_I = []; for(let i = 0; i < NPOLY; i++) if(def.GS[i] >= 0) def.GLYPH_I.push(i);
  /* the ripple: the polygons of the tagged parts, ordered by angle round the centre (a mane's ripple); without one, a sweep along the body */
  { const rp = def.ripple || {}, tagged = PARTS.filter(P => rp.tag ? P.tags.has(rp.tag) : false), list = [];
    if(tagged.length){ const c0 = rp.centre || [M.W / 2, M.H / 2]; for(const P of tagged) for(let i = P.p0; i < P.p1; i++) list.push([i, ((Math.atan2(PCY[i] - c0[1], PCX[i] - c0[0]) + Math.PI * 2 + (rp.a0 || .9)) % (Math.PI * 2)) / (Math.PI * 2)]); }
    else { let x0 = 1e9, x1 = -1e9; for(const i of def.FLIPPABLE){ x0 = Math.min(x0, PCX[i]); x1 = Math.max(x1, PCX[i]); } for(const i of def.FLIPPABLE) list.push([i, (PCX[i] - x0) / ((x1 - x0) || 1)]); }
    def.RIPPLE = list; def.rippleW = tagged.length ? 1 : null; }
  def.inSil = P => !P.dim && !P.tags.has('glyph') && !P.show && !P.open && !P.noSil;
  def.life = Object.assign({small:[], moves:[], dwell:{}, gait:[], gaitFor:{}, rate:1.5}, def.life || {});
  /* morphs, evaluated once */
  def.MORPHS = M.morphs.map(m => { const vs = [], dx = [], dy = [], lg = []; const parts = new Set();
    const one = m.part ? PARTS.find(P => P.name === m.part) : null, many = m.parts ? new Set(m.parts.map(n => PARTS.find(P => P.name === n)).filter(Boolean).map(P => P.order)) : null;
    const v0 = one ? one.v0 : 0, v1 = one ? one.v1 : NVERT;
    for(let v = v0; v < v1; v++){ const P = PARTS[VP[v]]; if(many && !many.has(P.order)) continue; const r = m.fn(VX[v], VY[v], P, v); if(!r || (!r[0] && !r[1])) continue; vs.push(v); dx.push(r[0]); dy.push(r[1]); lg.push(m.lag ? clamp(m.lag(VX[v], VY[v], P, v), 0, .85) : 0); parts.add(P.order); }
    return {name:m.name, k:m.k, start:m.start, verts:Int32Array.from(vs), dx:Float32Array.from(dx), dy:Float32Array.from(dy), lag:Float32Array.from(lg), parts:[...parts]}; });
  def.MORPHI = Object.fromEntries(def.MORPHS.map((m, i) => [m.name, i]));
  def.BAX = BONES.map(B => { const l = B.len || 1; return [(B.q[0] - B.p[0]) / l, (B.q[1] - B.p[1]) / l]; });
  def.counts = {polys:NPOLY, verts:NVERT, parts:PARTS.length, bones:NB, muscles:MUS.length, defs:Object.keys(M.defs).length, postures:PN.length, gaits:def.GAIT_ORDER.length, actions:Object.keys(M.actions).length, pads:def.PAD_ORDER.length};
  return def;
}

/* ---------- the posture runtime ----------
   The creature is always IN a posture or MOVING BETWEEN two. An edge is a staged blend that starts from wherever the body is (so it can be
   interrupted and redirected at any moment); a request that is not a neighbour routes through the graph (Dijkstra over edge times, with the
   transit costs); a request made mid-edge carries on to the node ahead or turns back, whichever is shorter. */
const ss3 = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
function specOf(d, a, b){
  const f = d.EDGES[a + '>' + b]; if(f) return f;
  const r = d.EDGES[b + '>' + a]; if(!r) return {ms:2200, g:{}};
  const rv = q => q && [r.ms - q[0] - q[1], q[1]], o = {ms:r.ms, g:{}, c:{}, bumps:[]};
  for(const k in r.g) o.g[k] = rv(r.g[k]); for(const k in r.c || {}) o.c[k] = rv(r.c[k]);
  return o;
}
const edgeMs = (d, a, b) => specOf(d, a, b).ms;
function pathOf(d, a, b){
  if(a === b) return [a];
  const dist = {[a]:0}, prev = {}, todo = new Set(d.POSTURE_NAMES);
  while(todo.size){ let u = null; for(const n of todo) if(dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n; if(u === null) break; todo.delete(u); if(u === b) break;
    for(const n of d.NEIGH[u] || []){ const q = dist[u] + edgeMs(d, u, n) + (u !== a ? d.TRANSIT[u] || 0 : 0); if(dist[n] === undefined || q < dist[n]){ dist[n] = q; prev[n] = u; } } }
  const out = [b]; while(out[0] !== a && prev[out[0]]) out.unshift(prev[out[0]]); return out[0] === a ? out : [a];
}
const costOf = (d, a, b) => { const p = pathOf(d, a, b); let s = 0; for(let i = 0; i < p.length - 1; i++) s += edgeMs(d, p[i], p[i + 1]); return p[p.length - 1] === b ? s : 1e9; };
function newPM(d){ const w = Object.fromEntries(d.POSTURE_NAMES.map(n => [n, 0])); w[d.REST_POSTURE] = 1; return {V:Float32Array.from(d.POSTURES[d.REST_POSTURE]), node:d.REST_POSTURE, tr:null, route:[], want:d.REST_POSTURE, pend:[], settle:0, hold:0, after:null, w, dl:new Float32Array(d.NV * 2)}; }
function startEdge(c, a, b, rd = 0, scale = 1, prog = null){
  const d = c.d, S = c.pm, sp = specOf(d, a, b), ms = Math.max(500, sp.ms * scale), dl = S.dl;
  for(let i = 0; i < d.NV; i++){
    const ch = d.CH[i], own = sp.c && sp.c[ch.name]; let q = own || sp.g[ch.grp] || [0, sp.ms], d0 = q[0], l = q[1];
    if(!own && d.chFar[i]) d0 += 90;                                   // the far leg follows the near one
    if(!own && d.chWind[i] === 2){ d0 += l * .3; l *= .7; } else if(!own && d.chWind[i] === 1) l *= .7;   // a winding chain tightens first, then its root swings
    dl[i * 2] = d0 * scale * (rd ? .35 + .65 * (prog ? prog[i] : 0) : 1); dl[i * 2 + 1] = Math.max(120, l * scale);   // a redirect keeps the stage order of the channels that had moved most
  }
  S.tr = {a, b, from:S.V.slice(), to:d.POSTURES[b], ms, t:0, sp, rd};
  S.node = a;
}
function edgeEval(c){
  const d = c.d, S = c.pm, tr = S.tr, V = S.V, dl = S.dl, t = tr.t;
  let m = 0;
  for(let i = 0; i < d.NV; i++){ const u = ss3((t - dl[i * 2]) / dl[i * 2 + 1]); V[i] = tr.from[i] + (tr.to[i] - tr.from[i]) * u; m += u; }
  for(const [n, dd, l, amp] of tr.sp.bumps || []){ const u = (t - dd) / l, i = d.CHI[n]; if(i !== undefined && u > 0 && u < 1){ const s = Math.sin(Math.PI * u); V[i] += amp * s * s; } }
  return m / d.NV;
}
function postStep(c, dtv){
  const d = c.d, S = c.pm; S.hold += dtv; let m = 1;
  if(S.tr){
    S.tr.t += dtv; m = edgeEval(c);
    if(S.tr.t >= S.tr.ms){ S.V.set(S.tr.to); S.node = S.tr.b; S.tr = null; S.hold = 0; m = 1;
      if(S.route.length){ startEdge(c, S.node, S.route.shift()); m = 0; } else S.settle = 0; }
  }
  /* the weights of each posture the body is in: eased, so a redirected transition (whose progress restarts) never makes them jump */
  const raw = S.wr || (S.wr = {}); for(const n of d.POSTURE_NAMES) raw[n] = 0;
  if(S.tr){ raw[S.tr.a] += 1 - m; raw[S.tr.b] += m; } else raw[S.node] = 1;
  const kw = 1 - Math.exp(-dtv * 7 / 1000); for(const n of d.POSTURE_NAMES) S.w[n] += (raw[n] - S.w[n]) * (S.wInit ? kw : 1); S.wInit = 1;
  if(!S.tr) S.settle += dtv;
  const V = S.V, Q = c.Q;
  Q.rx += V[0]; Q.ry += V[1]; Q.rr += V[2];
  for(const [b, ix, iy] of d.slideIdx){ Q.sx[b] += V[ix]; Q.sy[b] += V[iy]; }
  for(const [b, i] of d.jointIdx) Q.jt[b] += V[i];
  if(!c.gs.on) for(let k = 0; k < d.NL; k++) legReq(c, k, V[d.CHI['f' + k + 'x']], V[d.CHI['f' + k + 'y']], V[d.CHI['f' + k + 'b']], {kk:d.IKD[k].side === 'F' ? 7 : 8});
  Q.cam = {s:V[d.CHI.cs], x:V[d.CHI.cx], y:V[d.CHI.cy]}; Q.ground = Math.max(Q.ground, V[d.CHI.gnd]);
  if(d.postureHold) d.postureHold(c, S.w, c.Ta);
}
function routeTo(c, target){
  const d = c.d, S = c.pm; if(!d.POSTURES[target]) return;
  if(d.guard && d.guard(c, target) === false) return;   // the creature holds the request (the dragon gives back the tail it has eaten before it leaves the ring) and issues it again itself
  S.want = target;
  if(!S.tr){
    if(S.node === target){ S.route = []; return; }
    const p = pathOf(d, S.node, target); if(p.length < 2) return; S.route = p.slice(2); startEdge(c, S.node, p[1]); return;
  }
  const tr = S.tr;
  if(tr.b === target){ S.route = []; return; }
  const prog = clamp(tr.t / tr.ms), ahead = costOf(d, tr.b, target) + tr.ms * (1 - prog), back = costOf(d, tr.a, target) + tr.ms * prog * .8;
  if(back < ahead){ const rest = pathOf(d, tr.a, target); S.route = rest.slice(1); const a = tr.a, b = tr.b, pr = new Float32Array(d.NV); for(let i = 0; i < d.NV; i++) pr[i] = ss3((tr.t - S.dl[i * 2]) / S.dl[i * 2 + 1]); startEdge(c, b, a, 1, clamp(prog, .4, 1), pr); S.node = a; }
  else S.route = pathOf(d, tr.b, target).slice(1);
}

/* ---------- the gait engine ----------
   All the creature's gaits are one engine with a mode psi along their blend line: the parameters (stride, cadence, duty, lift, footfall
   offsets, bob) are blended, so changing gait morphs the footfalls on the running clock and the stride never resets. Each foot is a small state
   machine (stance or swing, with its own progress), kept in step with the clock by a bounded rate correction, so it never jumps. A stance foot
   is pinned to a point of the ground from touchdown to lift-off. Start: the stride grows from nothing and the lead leg lifts first. Stop: the
   stride shrinks to nothing, each foot steps in, and the gait ends when every foot stands on its posture's place. */
const frac1 = x => x - Math.floor(x), wrap1 = x => x - Math.round(x);
function gaitMix(d, psi){
  const O = d.GAIT_ORDER, o = d.GMIX || (d.GMIX = {});
  let i = 0; while(i < O.length - 2 && psi > O[i + 1].psi) i++;
  const A = O[i], B = O[Math.min(i + 1, O.length - 1)], f = B === A ? 0 : clamp((psi - A.psi) / (B.psi - A.psi)), l = (a, b) => a + (b - a) * f;
  for(const k of ['L', 'cyc', 'duty', 'bob', 'sink', 'cap', 'roll']) o[k] = l(A[k] ?? 0, B[k] ?? 0);
  for(const k of ['lift', 'off', 'flex', 'hs']){ o[k] = o[k] || new Array(d.NL).fill(0); for(let q = 0; q < d.NL; q++) o[k][q] = l(A[k][q], B[k][q]); }
  o.name = f < .5 ? A.name : B.name; o.base = f < .5 ? A.base : B.base; o.lead = A.lead;
  return o;
}
function newGait(d){ return {on:false, phase:'idle', psi:0, psiT:0, ph:0, kl:0, k:0, legs:d.IKD.map(() => ({stance:true, p:0, W:0, lx:0, x:0})), endAt:0, age:0}; }
function gaitStart(c, mode){
  const d = c.d, g = c.gs, S = c.pm; g.on = true; g.phase = 'start'; g.psi = g.psiT = d.GAIT_PSI[mode]; g.kl = 0; g.k = 0; g.age = 0; g.endAt = 0;
  const G = gaitMix(d, g.psi);
  g.ph = frac1(G.duty - G.off[G.lead || 0] - .012);   // the lead leg lifts first
  for(let i = 0; i < d.NL; i++){ const L = g.legs[i], tgt = frac1(g.ph + G.off[i]), fx = S.V[d.CHI['f' + i + 'x']]; L.stance = true; L.p = tgt < G.duty ? tgt / G.duty : 0; L.W = fx + c.gx; L.x = fx; }
}
function gaitStep(c, dt){
  const d = c.d, g = c.gs, Q = c.Q, S = c.pm;
  if(!g.on){ c.gait = null; return; }
  g.age += dt;
  const G = gaitMix(d, g.psi), tempo = Math.min(c.tempo, G.cap), mk = clamp(c.mot.scale, .45, 1.7);
  g.psi += clamp(g.psiT - g.psi, -dt / 1700, dt / 1700);
  if(g.endAt && c.t >= g.endAt && g.phase !== 'stop'){ g.phase = 'stop'; g.endAt = 0; }
  const cadM = Math.pow(tempo, .65), dtc = dt * cadM / G.cyc;
  g.kl = clamp(g.kl + (g.phase === 'stop' ? -dtc / .8 : dtc / .95), 0, 1);
  const k = fSmooth(0, 1, g.kl); g.k = k; if(g.phase === 'start' && g.kl >= 1) g.phase = 'run';
  const lowW = d.gaitLow ? d.gaitLow(c) : 0;   // a lowered body cannot reach as far: the stride is capped as it lowers
  const lift = mk * (g.phase === 'stop' ? Math.max(.3, fSmooth(0, .6, g.kl)) : Math.max(.55, fSmooth(0, .5, g.kl))), Lk = Math.min(G.L * 1.4, G.L * Math.pow(tempo, .35) * Math.pow(mk, .8), (d.strideMax || 1e9) - lowW) * k * c.sk;
  g.ph += dtc;
  const V = Lk * cadM / (G.duty * G.cyc / 1000), ph = g.ph, direct = g.age > 700 && !(g.phase === 'stop' && k < .3);
  c.gv = V; Q.ground = 1; const gxN = c.gx + c.gv * dt / 1000;
  const st = new Array(d.NL).fill(false); c.gait = {name:G.name, ph:g.ph, stance:st, duty:G.duty, k, t:c.t, tempo, cad:cadM / G.cyc, psi:g.psi, phase:g.phase};
  let allDown = true, worst = 0, worstI = -1;
  const final = g.phase === 'stop' && g.kl <= 0;
  for(let i = 0; i < d.NL; i++){
    const D = d.IKD[i], L = g.legs[i], x0 = S.V[d.CHI['f' + i + 'x']] + G.hs[i] * k, gy = S.V[d.CHI['f' + i + 'y']], b0 = S.V[d.CHI['f' + i + 'b']], front = x0 + Lk / 2, roll = D.roll;
    if(final){ if(!L.stance) L.p += dtc * 2.2 / (1 - G.duty); }
    else { const tgt = frac1(ph + G.off[i]), my = L.stance ? L.p * G.duty : G.duty + L.p * (1 - G.duty), err = wrap1(tgt - my), m = clamp(1 + 2.6 * err, .4, 2.2);
      L.p += L.stance ? dtc * m / G.duty : dtc * m / (1 - G.duty); }
    if(L.stance && L.p >= 1){ L.stance = false; L.p = clamp(L.p - 1, 0, .4); L.lx = L.W - gxN; }
    else if(L.stance && !final && k > .25 && L.W - gxN < x0 - Lk / 2 - 14){ L.stance = false; L.p = 0; L.lx = L.W - gxN; }   // a foot left behind lifts early rather than be dragged past its reach
    else if(!L.stance && L.p >= 1){ L.stance = true; L.p = final ? 0 : clamp(L.p - 1, 0, .4); L.W = front + gxN; }
    let x, y, b, sw = 0; const s = L.p, bk = L.stance ? fSmooth(0, .5, k) : Math.max(.35, fSmooth(0, .5, k));
    if(L.stance){ x = L.W - gxN; y = gy; b = b0 - .04 * (.5 - s) - .13 * (1 - fSmooth(0, .22, s)) + .2 * fSmooth(.74, 1, s) * roll; }
    else { const e = s * s * (3 - 2 * s), sn = Math.sin(Math.PI * s); x = L.lx + (front - L.lx) * e; y = gy - G.lift[i] * lift * sn; sw = sn; b = b0 + .2 * roll * (1 - fSmooth(0, .35, s)) + G.flex[i] * sn * Math.sqrt(mk) - .13 * fSmooth(.7, 1, s); }
    b = b0 + (b - b0) * bk;
    st[i] = L.stance; if(!L.stance) allDown = false; L.x = x;
    const er = Math.abs(x - S.V[d.CHI['f' + i + 'x']]); if(L.stance && er > worst){ worst = er; worstI = i; }
    legReq(c, i, x, y, b, {direct, kk:12, sw});
  }
  if(final && allDown){ if(worst > 3){ const L = g.legs[worstI]; L.stance = false; L.p = 0; L.lx = L.W - gxN; } else { g.on = false; g.phase = 'idle'; c.gait = null; c.gv = 0; return; } }
  const w2 = 4 * Math.PI * ph;
  Q.ry += (G.sink + G.bob * mk * Math.sin(w2 + 1.1)) * k; Q.rr += .012 * k * mk * Math.sin(w2 + .2);
  if(d.gaitBody) d.gaitBody(c, G, k, ph, mk);
}
/* ---------- asking for postures, gaits and actions ---------- */
function actionReady(c, name){
  const A = c.d.actions[name], S = c.pm, g = c.gs; if(!A) return false;
  if(g.on) return g.phase !== 'stop' && !!(typeof A.gait === 'function' ? A.gait(g, c) : A.gait);
  if(!A.in) return true;
  return A.in.includes(S.node) && !S.tr && !S.route.length && S.settle >= 380;
}
function actionRoute(c, name){
  const d = c.d, A = d.actions[name], S = c.pm, g = c.gs;
  if(g.on){ if(g.phase !== 'stop') gaitStop(c); return; }
  if(!A.in || A.in.includes(S.want)) return;
  const here = S.tr ? S.tr.b : S.node; let best = null, bc = 1e9;
  for(const n of A.in){ const cst = costOf(d, here, n); if(cst < bc){ bc = cst; best = n; } }
  if(best) routeTo(c, best);
}
function startAction(c, name, a){
  const A = c.d.actions[name];
  if(A.big){ for(const x of c.actions) if(c.d.actions[x.name] && c.d.actions[x.name].big) x.cut = c.t; c.raise(null); }
  c.actions.push({name, t0:c.t, ...a});
}
function gaitStop(c){ const g = c.gs; if(g.on && g.phase !== 'stop') g.phase = 'stop'; g.endAt = 0; }
function goGait(c, mode, o = {}){
  const d = c.d, S = c.pm, g = c.gs, base = d.GAIT_ORDER.find(x => x.name === mode).base;
  for(const x of c.actions) if(d.actions[x.name] && d.actions[x.name].in) x.cut = c.t;   // a posture-bound action ends when the legs start walking
  S.pend.length = 0;
  if(g.on){
    g.psiT = d.GAIT_PSI[mode]; if(g.phase === 'stop') g.phase = g.kl >= 1 ? 'run' : 'start'; g.endAt = o.for ? c.t + o.for : 0;
    if(S.want !== base) routeTo(c, base);
    return;
  }
  if(!S.tr && !S.route.length && S.node === base){ gaitStart(c, mode); if(o.for) g.endAt = c.t + o.for; S.after = null; return; }
  S.after = {gait:mode, for:o.for}; routeTo(c, base);
}
function goPosture(c, name, o = {}){
  const d = c.d;
  if(d.GAIT_PSI[name] !== undefined) return goGait(c, name, o);
  if(!d.POSTURES[name]) return;
  const S = c.pm, g = c.gs; S.pend.length = 0;
  if(g.on){ gaitStop(c); S.after = {go:name}; S.want = name; return; }
  S.after = null; routeTo(c, name);
}
function afterCheck(c){
  const d = c.d, S = c.pm, g = c.gs;
  if(S.after && !g.on){
    const a = S.after;
    if(a.go){ S.after = null; routeTo(c, a.go); }
    else if(a.gait && !S.tr && !S.route.length){ const base = d.GAIT_ORDER.find(x => x.name === a.gait).base; if(S.node === base){ S.after = null; gaitStart(c, a.gait); if(a.for) g.endAt = c.t + a.for; } else routeTo(c, base); }
  }
  if(S.pend.length){
    const rest = [];
    for(const p of S.pend){ if(actionReady(c, p.name)) startAction(c, p.name, p.a); else rest.push(p); }
    S.pend = rest;
    if(rest.length && !g.on && !S.tr && !S.route.length) actionRoute(c, rest[0].name);
  }
}
function postureInfo(c){
  const S = c.pm, g = c.gs, tr = S.tr, mode = g.on && c.gait ? c.gait.name : g.on ? 'gait' : null;
  return {at:S.node, moving:!!tr, from:tr ? tr.a : null, to:tr ? tr.b : null, u:tr ? clamp(tr.t / tr.ms) : 1, route:S.route.slice(), want:S.want, gait:mode, gaitPhase:g.phase, pending:S.pend.map(p => p.name),
    after:S.after ? (S.after.gait || S.after.go) : null, label:mode ? (g.phase === 'stop' ? mode + ' (stopping)' : mode) : tr ? tr.a + ' to ' + tr.b : S.node, weights:Object.assign({}, S.w)};
}

/* ---------- life: small actions in whatever posture it is in, and moves between postures over time ----------
   life.small and life.moves are lists of [pick, weight, cooldown ms, postures it may happen in, {posture: weight}]; a pick is an action, a gait
   name, or 'go:<posture>'. dwell {posture:[min, max] ms} is how long a posture is held before a move is likely; gait (the same form) is what it
   does while walking; gaitFor {gait:[min, max] ms} how long a walk lasts. rate (0 still .. 4 restless) divides every wait. Never the same pick twice
   running; each pick waits out its own cooldown. */
function lifeStep(c, now){
  const d = c.d, L = c.life, LF = d.life; if(!L.on || L.rate <= 0) return;
  const S = c.pm, g = c.gs, rate = L.rate;
  if(L.node !== S.node && !S.tr){ L.node = S.node; const dw = LF.dwell[S.node] || [4000, 9000]; L.dwell = now + (dw[0] + c.rand() * (dw[1] - dw[0])) / Math.max(.2, rate / 1.5); }
  if(c.actions.some(a => d.actions[a.name] && d.actions[a.name].big && !a.cut) || S.tr || S.route.length || S.after || S.pend.length || (g.on && g.phase === 'stop')){ L.next = Math.max(L.next, now + 1400); return; }
  if(now < L.next) return;
  const choose = (list, here) => {
    const w = list.map(([n, wt, cd, ok, wm]) => (n === L.last || (ok && !ok.includes(here))) ? 0 : ((wm && wm[here]) ?? wt) * clamp(((now - (L.at[n] ?? -1e9)) / (cd || 1)) || 1, .04, 1));
    let r = c.rand() * w.reduce((a, b) => a + b, 0); if(!(r > 0)) return null;
    for(let i = 0; i < list.length; i++){ if((r -= w[i]) < 0) return list[i][0]; } return null;
  };
  let pick;
  if(g.on){ pick = choose(LF.gait, c.gait ? c.gait.name : 'walk'); L.next = now + (2200 + c.rand() * 3800) / Math.max(.05, rate); }
  else {
    const here = S.node, moving = now >= L.dwell;
    if(moving && !L.smallOnly && c.rand() < clamp(.4 + (now - L.dwell) / 20000, .4, .9)) pick = choose(LF.moves, here);
    if(!pick) pick = choose(LF.small, here);
    L.next = now + (1800 + c.rand() * 4200) / Math.max(.05, rate);
  }
  if(!pick) return;
  L.last = pick; L.at[pick] = now;
  if(d.lifePick && d.lifePick(c, pick, now)) return;
  if(pick.startsWith('go:')){ c.go(pick.slice(3)); L.next = now + 1200; }
  else if(d.GAIT_PSI[pick] !== undefined){ const f = LF.gaitFor[pick] || [3000, 7000]; c.go(pick, {for:(f[0] + c.rand() * (f[1] - f[0])) * 1.5 / Math.max(.4, rate)}); L.next = now + 3000; }
  else if(pick === 'glyph') c.glyph(2800 + c.rand() * 800);
  else c.play(pick, {life:1});
}

/* ---------- pads ---------- */
const newPads = d => Object.fromEntries(d.PAD_ORDER.map(k => [k, {L:[0, 0], R:[0, 0], split:false}]));
function spec(c, T, S, k = 1){
  const d = c.d;
  for(const id in S){
    const v = S[id], df = d.defs[id]; if(!df) continue;
    if(!df.pair){ T[d.MI[id + '.C']] += k * (Array.isArray(v) ? (v[0] + v[1]) / 2 : v); continue; }
    const sd = d.SIDES[df.pair], a = Array.isArray(v) ? v[0] : v, b = Array.isArray(v) ? v[1] : v;
    T[d.MI[id + '.' + sd[0]]] += k * a; T[d.MI[id + '.' + sd[1]]] += k * b;
  }
}
function padsApply(c, T){
  const d = c.d, p = c.pad;
  c.dyn.speed = 2 ** p.dynamics.L[0]; c.dyn.damp = .78 + p.dynamics.L[1] * (p.dynamics.L[1] > 0 ? .57 : .48);
  c.mot.scale = 2 ** (.9 * p.motion.L[0]); c.mot.idle = 2 ** (1.2 * p.motion.L[1]);
  c.Tleg.fill(0); c.padLegRaw.fill(0);
  for(const name of d.PAD_ORDER){
    const P = d.pads[name], q = p[name]; if(P.special) continue;
    const a = q.L, b = q.split ? q.R : q.L;
    if(P.leg) d.IKD.forEach((D, k) => { if(D.kind !== P.leg) return; const v = D.side === 'F' ? b : a; c.padLegRaw[k * 2] = v[0]; c.padLegRaw[k * 2 + 1] = v[1]; });
    if(Math.abs(a[0]) + Math.abs(a[1]) + Math.abs(b[0]) + Math.abs(b[1]) < .02 && !P.alwaysFx) continue;
    if(P.map){
      const SA = P.map(a[0], a[1], c), SB = P.map(b[0], b[1], c), Sx = {};
      for(const k of new Set([...Object.keys(SA), ...Object.keys(SB)])){ const va = SA[k] || 0, vb = SB[k] || 0; Sx[k] = Array.isArray(va) ? va : [va, vb]; }
      spec(c, P.leg ? c.Tleg : T, Sx);   // a leg pad's muscles apply only when an action hands the legs to the muscles
    }
    if(P.fx) P.fx(c, a[0], a[1], b);
  }
}
function legGhost(c, k){ const D = c.d.IKD[k], L = c.leg[k], cl = v => Math.max(-1, Math.min(1, v)); return [cl((L.x - D.tip[0]) / 40), cl((D.tip[1] - L.y) / 70)]; }

/* ---------- the legs: two-bone IK, run inside the forward kinematics as soon as the leg's parent has its matrix ---------- */
function newLegs(d){ return d.IKD.map(D => ({vx:0, vy:0, vb:0, sx:D.tip[0], sy:D.tip[1], sb:D.a[2], dw:0, w:1, wT:1, x:D.tip[0], y:D.tip[1], b:D.a[2], tx:D.tip[0], ty:D.tip[1], tb:D.a[2], direct:false, kk:14})); }
function legReq(c, k, x, y, b, o = {}){ c.Q.legs[k] = {x, y, b, w:o.w ?? 1, direct:!!o.direct, kk:o.kk, sw:o.sw ?? 1}; }
function solveLeg(c, k){
  const d = c.d, D = d.IKD[k], L = c.leg[k], w = L.w; if(w < .002) return;
  const bm = c.bm, o = D.par * 6, r = c.rot, LIMLO = d.LIMLO, LIMHI = d.LIMHI;
  const Sx = bm[o] * D.S[0] + bm[o + 2] * D.S[1] + bm[o + 4], Sy = bm[o + 1] * D.S[0] + bm[o + 3] * D.S[1] + bm[o + 5], phi = Math.atan2(bm[o + 1], bm[o]);
  const tb = L.b, Wx = L.x - D.l3 * Math.cos(tb), Wy = L.y - D.l3 * Math.sin(tb), dx = Wx - Sx, dy = Wy - Sy, dd0 = Math.hypot(dx, dy) || 1;
  const dc = clamp(dd0, Math.abs(D.l1 - D.l2) + .5, D.l1 + D.l2 - 4), a = Math.atan2(dy, dx), g = Math.acos(clamp((D.l1 * D.l1 + dc * dc - D.l2 * D.l2) / (2 * D.l1 * dc), -1, 1));
  const th1 = a + D.bend * g, Ex = Sx + D.l1 * Math.cos(th1), Ey = Sy + D.l1 * Math.sin(th1);
  const th2 = Math.atan2(Sy + dc * Math.sin(a) - Ey, Sx + dc * Math.cos(a) - Ex);
  const kb = -D.bend * (Math.PI - Math.acos(clamp((D.l1 * D.l1 + D.l2 * D.l2 - dc * dc) / (2 * D.l1 * D.l2), -1, 1)));
  const PS = c.ikS[k], ang = (x, q) => { const lo = LIMLO[D.b[q]], hi = LIMHI[D.b[q]], ref = PS.n[q] && L.w >= .05 ? PS.v[q] : (lo > -90 ? (lo + hi) / 2 : 0), u = ref + wrapA(x - ref); return u > hi ? hi : u < lo ? lo : u; };
  const dd = [ang(th1 - phi - D.a[0], 0), kb - wrapA(D.a[1] - D.a[0]), ang(tb - th2 - wrapA(D.a[2] - D.a[1]), 2)];   // the rest angles between bones are wrapped: a leg whose bones straddle the -x seam (every left leg of a sideways body) would otherwise fold double
  for(let q = 0; q < 3; q++){ const b = D.b[q], v = dd[q] + c.mnS[b], lo = LIMLO[b], hi = LIMHI[b]; dd[q] = v < lo ? lo : v > hi ? hi : v; if(v < lo - .002 || v > hi + .002){ c.limHits++; c.limMax = Math.max(c.limMax, v < lo ? lo - v : v - hi); } }
  { const inf = c.ik[k]; inf.over = dd0 - (D.l1 + D.l2 - 4); inf.w = w; }
  { const LIMQ = [22, 22, 28];   // the solved angles change by at most 22 rad/s (the foot's 28): no pad or tempo can flip a leg in a frame
    for(let q = 0; q < 3; q++){ const lim = LIMQ[q] * c.dtms / 1000; if(L.w < .05 || PS.n[q] === 0){ PS.v[q] = dd[q]; PS.n[q] = 1; } else { const dv = dd[q] - PS.v[q]; PS.v[q] += dv > lim ? lim : dv < -lim ? -lim : dv; } dd[q] = PS.v[q]; } }
  for(let q = 0; q < 3; q++){ const b = D.b[q], v = r[b] * (1 - w) + dd[q] * w; r[b] = v < LIMLO[b] ? LIMLO[b] : v > LIMHI[b] ? LIMHI[b] : v; c.ikd[b] = dd[q]; }
}
function fk(c){
  const d = c.d, B = d.bones, NB = d.NB, bm = c.bm;
  for(let b = 0; b < NB; b++){
    if(d.IKLEG[b] >= 0) solveLeg(c, d.IKLEG[b]);
    const Bn = B[b], th = c.rot[b], ca = Math.cos(th), sa = Math.sin(th), px = Bn.p[0], py = Bn.p[1], o = b * 6;
    let La = ca, Lb = sa, Lc = -sa, Ld = ca, Le = px - ca * px + sa * py + c.sx[b], Lf = py - sa * px - ca * py + c.sy[b];
    let s1 = c.Q.sa[b], s2 = c.Q.sc[b]; if(Math.abs(s1) < .03) s1 = s1 < 0 ? -.03 : .03; if(Math.abs(s2) < .03) s2 = s2 < 0 ? -.03 : .03;   // through zero (a wing edge-on) the geometry would collapse and flicker: keep a sliver
    if(s1 !== 1 || s2 !== 1){   // the bone scaled along its own rest axis (s1) and across it (s2), about its joint: a wing foreshortened as it beats past the viewer
      const [ux, uy] = d.BAX[b], vx = -uy, vy = ux, S11 = s1 * ux * ux + s2 * vx * vx, S12 = s1 * ux * uy + s2 * vx * vy, S22 = s1 * uy * uy + s2 * vy * vy;
      const A11 = ca * S11 - sa * S12, A12 = ca * S12 - sa * S22, A21 = sa * S11 + ca * S12, A22 = sa * S12 + ca * S22;
      La = A11; Lb = A21; Lc = A12; Ld = A22; Le = px + c.sx[b] - (A11 * px + A12 * py); Lf = py + c.sy[b] - (A21 * px + A22 * py);
    }
    if(Bn.parent < 0){ bm[o] = La; bm[o + 1] = Lb; bm[o + 2] = Lc; bm[o + 3] = Ld; bm[o + 4] = Le; bm[o + 5] = Lf; }
    else {
      const q = Bn.parent * 6, Pa = bm[q], Pb = bm[q + 1], Pc = bm[q + 2], Pd = bm[q + 3], Pe = bm[q + 4], Pf = bm[q + 5];
      bm[o] = Pa * La + Pc * Lb; bm[o + 1] = Pb * La + Pd * Lb; bm[o + 2] = Pa * Lc + Pc * Ld; bm[o + 3] = Pb * Lc + Pd * Ld; bm[o + 4] = Pa * Le + Pc * Lf + Pe; bm[o + 5] = Pb * Le + Pd * Lf + Pf;
    }
  }
}

/* ---------- appearance: line weights and part geometry ---------- */
const r10 = v => Math.round(v * 10) / 10;
/* Line weights in canvas units, never thinner than a fraction of a pixel: gap is each polygon's inset per tier (a hairline is twice it), c a
   contour, b a region border, f a fine line, sil the silhouette's stroke (half of it shows). */
function gapTable(d, size){
  const u = d.W / size, px = size < 70 ? .5 : size < 150 ? .32 : size < 300 ? .2 : 0;
  return {gap:[.62, .56, .42].map(g => Math.max(g, px * u / 2)), c:Math.max(6.2, px * u * 3.2), b:Math.max(3.3, px * u * 1.8), f:Math.max(1.9, px * u), sil:Math.max(10.5, px * u * 5.5)};
}
/* one part's geometry from posed vertices X, Y: each polygon inset about its incentre by the tier's gap, and the backing path the gaps show */
function partGeom(d, P, X, Y, gt, out, vs){
  const PV = d.PV, PTIER = d.PTIER;
  for(let v = P.v0; v < P.v1; v++) vs[v] = Math.round(X[v] * 2) / 2 + ',' + Math.round(Y[v] * 2) / 2;
  let lp = '';
  if(P.loop && P.loop.length > 2){ const l = P.loop; lp = 'M' + vs[l[0]]; for(let q = 1; q < l.length; q++) lp += 'L' + vs[l[q]]; if(!P.open) lp += 'Z'; }
  partGeom.loop = lp;
  let back = '';
  for(let i = P.p0; i < P.p1; i++){
    const ids = PV[i], n = ids.length; let ix, iy, r;
    back += 'M' + vs[ids[0]]; for(let q = 1; q < n; q++) back += 'L' + vs[ids[q]]; back += 'Z';
    if(n === 3){
      const a = ids[0], b = ids[1], c = ids[2], ax = X[a], ay = Y[a], bx = X[b], by = Y[b], cx = X[c], cy = Y[c];
      const la = Math.sqrt((bx - cx) * (bx - cx) + (by - cy) * (by - cy)), lb = Math.sqrt((ax - cx) * (ax - cx) + (ay - cy) * (ay - cy)), lc = Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)), s = la + lb + lc;
      r = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / (s || 1); ix = (la * ax + lb * bx + lc * cx) / (s || 1); iy = (la * ay + lb * by + lc * cy) / (s || 1);
    } else {
      ix = 0; iy = 0; for(const v of ids){ ix += X[v]; iy += Y[v]; } ix /= n; iy /= n; r = 1e9;
      for(let q = 0; q < n; q++){ const a = ids[q], b = ids[(q + 1) % n]; r = Math.min(r, segDist(ix, iy, X[a], Y[a], X[b], Y[b])); }
    }
    const g = gt[PTIER[i]], dd = Math.min(g, r * .8), k = r > 1e-4 ? (r - dd) / r : .2;
    let s = ''; for(let q = 0; q < n; q++){ const v = ids[q]; s += (q ? ' ' : '') + r10(ix + (X[v] - ix) * k) + ',' + r10(iy + (Y[v] - iy) * k); }
    out[i] = s;
  }
  return back;
}
const baseColours = (d, C) => { const out = new Int32Array(d.NPOLY); for(let i = 0; i < d.NPOLY; i++) out[i] = mixInt(C.skin, C.inkOf(d.parts[d.PPART[i]]), d.PTONE[i]); return out; };
/* the static rest-pose render: a backing path in the line colour per part, the inset polygons grouped by fill */
function restSvg(d, o = {}){
  const size = o.size || 200, P0 = palette(d, o.palette), C = colours(d, P0), col = baseColours(d, C), G = gapTable(d, size), h = Math.round(size * d.H / d.W);
  const out = new Array(d.NPOLY), vs = new Array(d.NVERT);
  let body = '', sil = '', silDone = false;
  const pieces = d.DRAW.map(part => {
    const back = partGeom(d, part, d.VX, d.VY, G.gap, out, vs), lp = partGeom.loop;
    if(d.inSil(part)) sil += part.silBack ? back : lp;
    if(part.show) return '';
    const ls = C.ls[part.order];
    let b = `<path d="${back}" fill="${intHex(ls.fill)}"${ls.bs ? ` stroke="${intHex(ls.stroke)}" stroke-width="${r10(ls.bs)}" stroke-linejoin="round"` : ''}/>`;
    const groups = new Map();
    for(let i = part.p0; i < part.p1; i++){ const c = col[i], dd = 'M' + out[i].replace(/ /g, 'L') + 'Z'; groups.set(c, (groups.get(c) || '') + dd); }
    for(const [c, dd] of groups) b += `<path d="${dd}" fill="${intHex(c)}"/>`;
    if(ls.role && lp) b += `<path d="${lp}" fill="none" stroke="${intHex(ls.stroke)}" stroke-width="${r10(ls.role === 'c' ? G.c : ls.role === 'f' ? G.f : G.b)}" stroke-linejoin="round"/>`;
    return b;
  });
  d.DRAW.forEach((part, k) => { if(!silDone && part.layer >= d.silLayer){ body += `<path d="${sil}" fill="${intHex(C.line)}" stroke="${intHex(C.line)}" stroke-width="${r10(G.sil)}" stroke-linejoin="round"/>`; silDone = true; } body += pieces[k]; });
  const [cs, cx, cy] = d.cam0;
  return `<svg class="creature" xmlns="${NS}" width="${size}" height="${h}" viewBox="${r10(cx - d.W / 2 * cs)} ${r10(cy - d.H / 2 * cs)} ${r10(d.W * cs)} ${r10(d.H * cs)}">${body}</svg>`;
}

/* ---------- one frame ---------- */
function step(c, now, dt){
  const d = c.d, NB = d.NB, NM = d.NM, MUS = d.MUS, BONES = d.bones;
  c.t = now; c.dtms = dt;
  const Q = c.Q; Q.rx = Q.ry = Q.rr = Q.bx = Q.by = 0; Q.sx.fill(0); Q.sy.fill(0); Q.sa.fill(1); Q.sc.fill(1); Q.jt.fill(0); Q.jd.fill(0); Q.yaw = 0; Q.cam = null; Q.legs.fill(null); Q.legOff = false; Q.ground = 0; c.gv = 0;
  const Ti = c.Ti, Ta = c.Ta, Tp = c.Tp, T = c.T; Ti.fill(0); Ta.fill(0); Tp.fill(0); c.Tl.fill(0); c.ch.x = c.ch.y = c.ch.r = 0; c.flushT = 0;
  c.breath.depth = 1; c.breath.rate = 1; c.rippleRate = 0;
  padsApply(c, Tp);
  c.tempo = clamp(cdamp(c.tm, 0, c.dyn.speed, 3.5, dt), .45, 2.2); const tempo = c.tempo; c.legK = Math.max(1, tempo);
  postStep(c, dt * tempo); gaitStep(c, dt); afterCheck(c);
  if(d.idle) d.idle(c, now, Ti, dt);
  c.actions = c.actions.filter(a => {
    if(now < a.t0) return true;
    a.tv = a.tv === undefined ? now - a.t0 : a.tv + dt * tempo; const t = a.tv;   // each action has its own clock, which runs at the tempo
    const A = d.actions[a.name]; if(!A || t > A.dur * (a.durK || 1)) return false;
    if(a.cut && now - a.cut > 120) return false;
    if(a.soft){ const T2 = c.Tsoft; T2.fill(0); A.f(t, T2, c, a); for(let n = 0; n < NM; n++) Ti[n] += T2[n] * .4; } else if(A.f(t, Ta, c, a) === false) return false;
    return true;
  });
  lifeStep(c, now);
  if(c.rippleRate > .1 && now >= c.nextRipple){ ripple(c, now); c.nextRipple = now + 1500 / c.rippleRate; }
  if(Q.legOff) for(let n = 0; n < NM; n++) Tp[n] += c.Tleg[n];
  /* reach: a planted foot must be reachable; if one is short the body lowers by what is missing, and the stride shortens at the cap */
  if(d.NL){
    let need = -1e9, any = false;
    for(let k = 0; k < d.NL; k++){
      const D = d.IKD[k], L = c.leg[k], rq = Q.legs[k]; if(Q.legOff || L.w < .5) continue;
      const px = c.padLegRaw[k * 2] * D.reach, py = c.padLegRaw[k * 2 + 1];
      let tx = (rq ? rq.x : D.tip[0]) + px, ty = rq ? rq.y : D.tip[1], tb = rq ? rq.b : D.a[2]; if(ty < D.tip[1] - 150) continue; ty += Math.max(0, py) * .5 * (D.tip[1] - ty); tb += .12 * Math.max(0, py);
      const o = D.par * 6, bm = c.bm, Sx = bm[o] * D.S[0] + bm[o + 2] * D.S[1] + bm[o + 4], Sy = bm[o + 1] * D.S[0] + bm[o + 3] * D.S[1] + bm[o + 5];
      need = Math.max(need, Math.hypot(tx - D.l3 * Math.cos(tb) - Sx, ty - D.l3 * Math.sin(tb) - Sy) - (D.l1 + D.l2 - 4)); any = true;
    }
    if(!(c.gait && now - c.gait.t < 80)) any = false;
    if(any){ if(need > .3) c.rfix += need * 1.2; else if(need < -6) c.rfix += (need + 6) * .025; } else c.rfix *= .96;
    const cap = clamp((d.reachCap ?? 78) - c.root.y, 0, 45); c.rfix = clamp(c.rfix, 0, cap);
    if(any && need > .3 && c.rfix >= cap - 2) c.sk = Math.max(.45, c.sk - .02); else if(!any || need < -8) c.sk = Math.min(1, c.sk + .006);
  }
  for(let k = 0; k < d.NL; k++){
    const D = d.IKD[k], L = c.leg[k], rq = Q.legs[k];
    const px = cdamp(c.pl, k * 2, c.padLegRaw[k * 2], 14, dt), py = cdamp(c.pl, k * 2 + 1, c.padLegRaw[k * 2 + 1], 14, dt), flex = Math.max(0, -py), ext = Math.max(0, py);
    let tx, ty, tb, sw = 1, w = 1, direct = false, kk = 14;
    if(rq){ tx = rq.x; ty = rq.y; tb = rq.b; sw = rq.sw; w = rq.w; direct = rq.direct; kk = rq.kk ?? 14; } else { tx = D.tip[0]; ty = D.tip[1]; tb = D.a[2]; }
    tx += px * D.reach; ty += ext * .5 * (D.tip[1] - ty) - flex * 70 * sw; tb += -.7 * flex * sw + .12 * ext;
    L.tx = tx; L.ty = ty; L.tb = tb; L.wT = Q.legOff ? 0 : w; L.direct = direct; L.kk = kk;
    { const kq = L.kk * c.legK, n = Math.max(1, Math.ceil(dt * kq / 1000 / .5)), h = dt / 1000 / n;
      for(let q = 0; q < n; q++){ L.vx += (kq * kq * (L.tx - L.sx) - 2 * kq * L.vx) * h; L.vy += (kq * kq * (L.ty - L.sy) - 2 * kq * L.vy) * h; L.vb += (kq * kq * wrapA(L.tb - L.sb) - 2 * kq * L.vb) * h; L.sx += L.vx * h; L.sy += L.vy * h; L.sb += L.vb * h; }
      L.dw += ((L.direct ? 1 : 0) - L.dw) * (1 - Math.exp(-dt * 4.5 / 1000));
      L.x = L.sx + (L.tx - L.sx) * L.dw; L.y = L.sy + (L.ty - L.sy) * L.dw; L.b = L.sb + wrapA(L.tb - L.sb) * L.dw; }
    L.w += (L.wT - L.w) * (1 - Math.exp(-dt * 6 / 1000));
    if(L.w > .3) for(let q = 0; q < 3; q++){ const e = D.mus[q]; if(!e) continue; const dl = c.ikd[D.b[q]]; if(dl < 0 && e[0] !== undefined) c.Tl[e[0]] += dl / e[2] * L.w; else if(dl >= 0 && e[1] !== undefined) c.Tl[e[1]] += dl / e[3] * L.w; }
    /* the other muscles that turn this leg's bones (a synergist the leg's `mus` does not name: a supraspinatus beside the deltoid, a pectoralis beside the latissimus) fire at half, in the direction they turn, with the solved angle: before, they lit only when an action handed the legs to the muscles (anatomy audit, round 5) */
    if(L.w > .3) for(const j of d.LEGJ[k]){ if(D.ms.has(j.n)) continue; const dl = c.ikd[j.b]; if(dl * j.g > 0) c.Tl[j.n] += Math.min(1.2, Math.abs(dl / j.g)) * .5 * L.w; }
    for(let q = 0; q < 3; q++){ const b = D.b[q]; let m = 0; for(const j of d.LEGJ[k]) if(j.b === b) m += c.direct[j.n] * j.g; c.mnS[b] = cdamp(c.mn, b, m, 14, dt); }
  }
  const ik = c.mot.idle, mk = c.mot.scale, mkl = clamp(mk, .6, 1.3);
  for(let n = 0; n < NM; n++) T[n] = Ti[n] * ik + Ta[n] * (MUS[n].leg ? mkl : mk) + c.Tl[n] + Tp[n] + c.direct[n];
  /* the muscles' springs, as in faceMuscles; the Dynamics damping applies to the muscles outside the legs */
  const s0 = Math.min(.05, dt / 1000), sub = clamp(Math.ceil(s0 * 18 / .55), 1, 6), s = s0 / sub, zeta = c.dyn.damp; let moved = false;
  for(let q = 0; q < sub; q++) for(const m of MUS){
    const n = m.n, a = c.acts[n], k = m.def.speed, z = m.leg ? .78 : zeta;
    c.vel[n] += (k * k * (T[n] - a) - 2 * k * z * c.vel[n]) * s; c.acts[n] = a + c.vel[n] * s;
  }
  for(const sp of d.SHOWP){ const vis = c.acts[sp.n] > .04; if(vis !== c.shown[sp.k]){ c.shown[sp.k] = vis; c.groups[sp.k].style.display = vis ? '' : 'none'; if(vis) c.pdirty[sp.k] = 1; } }
  for(const m of MUS){ const n = m.n; if(Math.abs(c.acts[n] - c.drawn[n]) > .004){ moved = true; for(const p of m.partList) c.pdirty[p] = 1; c.drawn[n] = c.acts[n]; } }
  c.flush += (c.flushT - c.flush) * Math.min(1, dt / 140);
  const cs = c.chS, kc = Math.min(1, dt / 90);
  cs.x += (c.ch.x * mk - cs.x) * kc; cs.y += (c.ch.y * mk - cs.y) * kc; cs.r += (c.ch.r * mk - cs.r) * kc;
  /* joints from the muscles, then the pose channels: the root about the pivot, the joint channels (secondary chains take the damping and the
     Motion scale), the slides, the followers */
  const rot = c.rot, sy = c.sy, sx = c.sx; rot.fill(0); sy.fill(0); sx.fill(0); let yaw = 0;
  for(const m of MUS){ const a = c.acts[m.n]; if(Math.abs(a) < .0005) continue; for(const [b, g, kd] of m.jl){ if(kd === 0) rot[b] += a * g; else if(kd === 1) sy[b] += a * g; else if(kd === 3) sx[b] += a * g; else yaw += a * g; } }
  const R = c.root; R.x = cdamp(c.rs, 0, Q.rx, 6.5, dt); R.y = cdamp(c.rs, 1, Q.ry, 6.5, dt); R.r = cdamp(c.rs, 2, Q.rr, 7, dt);
  { const B0 = BONES[0], pv = d.pivot, th = R.r + cs.r, ct = Math.cos(th), st = Math.sin(th), vx = B0.p[0] - pv[0], vy = B0.p[1] - pv[1];
    rot[0] += th; sx[0] += ct * vx - st * vy + pv[0] - B0.p[0] + R.x + cs.x; sy[0] += st * vx + ct * vy + pv[1] - B0.p[1] + R.y + cs.y + c.rfix; }
  { const zs = clamp(c.dyn.damp / .78, .35, 1.7), mkc = clamp(mk, .35, 1.8), rm = Math.pow(Math.max(1, tempo), .7);
    for(let b = 0; b < NB; b++){
      const sec = d.SECB[b]; c.jr[b] = cdamp(c.js, b, Q.jt[b], d.JSPEED[b] * rm, dt, sec ? zs : 1);
      rot[b] += (d.MOTJT[b] ? mkc * c.jr[b] : c.jr[b]) + (sec ? mkc : 1) * Q.jd[b];
    } }
  sx[0] += Q.bx; sy[0] += Q.by;
  for(const b of d.slideB){ sx[b] += cdamp(c.ps, b * 2, Q.sx[b], 6, dt); sy[b] += cdamp(c.ps, b * 2 + 1, Q.sy[b], 6, dt); }
  for(let k = 0; k < d.FOLLOW.length; k++){
    const F = d.FOLLOW[k], tf = c.fol[k]; let A = 0; for(const q of F.chain) A += rot[q];
    tf.Af = cdamp(tf.S, 0, A, F.k, dt); const tgt = clamp(-(A - tf.Af) * F.gain + F.flutter * (Math.sin(c.t * .0013 + k) + .6 * Math.sin(c.t * .0031 + 1 + k)), -F.lim, F.lim);
    const n = Math.max(1, Math.ceil(dt / 8)), h = dt / 1000 / n, w = F.w, z = clamp(F.z * c.dyn.damp / .78, .2, 1.2); for(let q = 0; q < n; q++){ tf.v += (w * w * (tgt - tf.th) - 2 * z * w * tf.v) * h; tf.th += tf.v * h; }
    rot[F.b] += tf.th;
  }
  for(let b = 0; b < NB; b++) if(sy[b] < d.YLO[b] || sy[b] > d.YHI[b]) sy[b] = clamp(sy[b], d.YLO[b], d.YHI[b]);
  yaw += Q.yaw;
  if(d.post) d.post(c, rot, sx, sy, now, dt);
  /* the ground scrolls under a walking creature; the camera follows the posture */
  c.gx += c.gv * dt / 1000; c.groundA += (Q.ground - c.groundA) * (1 - Math.exp(-dt * 5 / 1000));
  if(c.groundEl && d.groundY != null && (c.gv || Math.abs(c.groundA - c.groundDrawn) > .01)) updateGround(c);
  { const tg = c.crew ? {s:d.cam0[0], x:d.cam0[1], y:d.cam0[2]} : Q.cam || {s:d.cam0[0], x:d.cam0[1], y:d.cam0[2]}, cm = c.cam;
    if(c.crew){ cm.s = tg.s; cm.x = tg.x; cm.y = tg.y; } else { cm.s = cdamp(c.cs, 0, tg.s, 2.4, dt); cm.x = cdamp(c.cs, 1, tg.x, 2.4, dt); cm.y = cdamp(c.cs, 2, tg.y, 2.4, dt); }   // a crew member's own camera is fixed: the crew's camera is the host's
    const vb = [r10(cm.x - d.W / 2 * cm.s), r10(cm.y - d.H / 2 * cm.s), r10(d.W * cm.s), r10(d.H * cm.s)].join(' '); if(vb !== c.vb){ c.vb = vb; c.svg.setAttribute('viewBox', vb); } }
  yaw = clamp(yaw, -.9, .9);
  for(let b = 0; b < NB; b++){ if(d.LEGB[b] && c.leg[d.LEGOF[b]].w > .5) continue; const v = rot[b], lo = d.LIMLO[b], hi = d.LIMHI[b]; if(v < lo || v > hi){ rot[b] = v < lo ? lo : hi; c.limHits++; c.limMax = Math.max(c.limMax, v < lo ? lo - v : v - hi); } }
  c.ikd.fill(0);
  fk(c);
  c.yaw = yaw;
  for(let k = 0; k < d.MORPHS.length; k++){   // morphs chase their targets on a critically damped spring at their own rate
    const was = c.morph[k], kk = c.morphK[k], n = Math.max(1, Math.ceil(dt * kk / 1000 / .5)), hh = dt / 1000 / n;
    for(let q = 0; q < n; q++){ c.morphV[k] += (kk * kk * (c.morphT[k] - c.morph[k]) - 2 * kk * c.morphV[k]) * hh; c.morph[k] += c.morphV[k] * hh; }
    if(Math.abs(c.morph[k] - was) > 1e-5){ moved = true; for(const p of d.MORPHS[k].parts) c.pdirty[p] = 1; }
  }
  if(moved || c.musMoved){ musApply(c); c.musMoved = false; }
  /* which parts moved: a muscle over them, a bone of theirs, or the head's turn since the part was last drawn (each part keeps its own snapshot) */
  const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), dirtyParts = [], bm0 = c.bm, PARTS = d.parts;
  for(let k = 0; k < PARTS.length; k++){
    const P = PARTS[k]; let dd = c.pdirty[k] || c.force || (P.yaw && Math.abs(yaw - c.partYaw[k]) > .002);
    const sn = c.snap[k], bl = P.boneList;
    if(!dd) for(let q = 0; q < bl.length && !dd; q++){ const o = bl[q] * 6; for(let e = 0; e < 6; e++) if(Math.abs(bm0[o + e] - sn[q * 6 + e]) > (e < 4 ? 8e-4 : .2)){ dd = 1; break; } }
    if(dd){ dirtyParts.push(k); c.pdirty[k] = 0; c.partYaw[k] = yaw; for(let q = 0; q < bl.length; q++) for(let e = 0; e < 6; e++) sn[q * 6 + e] = bm0[bl[q] * 6 + e]; }
  }
  const VX = d.VX, VY = d.VY, VZ = d.VZ, VYAW = d.VYAW, SKB = d.SKB, SKW = d.SKW, YC = d.yawC;
  for(const k of dirtyParts){
    if(c.shown[k] === false){ c.pdirty[k] = 1; continue; }
    const P = PARTS[k], bm = c.bm, DX = c.DX, DY = c.DY, X = c.X, Y = c.Y;
    for(let v = P.v0; v < P.v1; v++){
      let x = VX[v] + DX[v], y = VY[v] + DY[v];
      if(VYAW[v]) x = YC + (x - YC) * cy_ + VZ[v] * sy_;
      let px = 0, py = 0;
      for(let q = 0; q < 3; q++){ const b = SKB[v * 3 + q]; if(b < 0) break; const w = SKW[v * 3 + q], o = b * 6; px += w * (bm[o] * x + bm[o + 2] * y + bm[o + 4]); py += w * (bm[o + 1] * x + bm[o + 3] * y + bm[o + 5]); }
      X[v] = px; Y[v] = py;
    }
    const bd = partGeom(d, P, X, Y, c.gt, c.pnew, c.vs); c.bd[k] = bd; c.ld[k] = partGeom.loop; c.backs[k].setAttribute('d', bd); if(c.loops[k]) c.loops[k].setAttribute('d', partGeom.loop);
    for(let i = P.p0; i < P.p1; i++) if(c.pnew[i] !== c.pstr[i]){ c.pstr[i] = c.pnew[i]; c.polys[i].setAttribute('points', c.pnew[i]); }
  }
  if(dirtyParts.length){ let sil = ''; for(const P of PARTS) if(d.inSil(P) && c.shown[P.order] !== false) sil += P.silBack ? c.bd[P.order] : c.ld[P.order]; c.sil.setAttribute('d', sil); }
  c.force = false;
  if(c.view === 'anatomy') drawAnatomy(c);
  if(c.gp){ if(c.t - c.gp.t0 > c.gp.dur) c.gp = null; for(const i of d.GLYPH_I) c.colDirty.add(i); }
  if(c.beh.style !== 'off' && c.beh.style !== 'field') spawn(c, now, dt);
  if(c.beh.style === 'field' && now - c.fieldDrawn > 70){ c.fieldDrawn = now; for(const i of d.FLIPPABLE) c.colDirty.add(i); }
  flipStep(c, now);
  if(Math.abs(c.flush - c.flushDrawn) > .01){ c.flushDrawn = c.flush; for(const P of PARTS) if(P.flush) for(let i = P.p0; i < P.p1; i++) c.colDirty.add(i); }
  if(d.colour && d.colourLive) d.colourLive(c, now);
  for(const i of c.hold.keys()) c.colDirty.add(i);   // a held colour fades frame by frame (and is dropped when spent), so it is redrawn every frame it lives
  for(const i of c.colDirty) if(!c.flips.has(i)) fillPoly(c, i, polyColour(c, i, now));
  c.colDirty.clear();
  c.frames++;
  if(c.crew && c.crew.after) c.crew.after(c, now, dt);   // the host places the member in the shared world, once the member has moved
}
function fillPoly(c, i, col){ if(c.fill[i] !== col){ c.fill[i] = col; c.polys[i].setAttribute('fill', intHex(col)); } }
/* the travelling light on the glyph: a bright head along the sign's path, a fading wake in the behaviour palette, a white-hot core */
function glyphLight(c, i, col){
  const d = c.d, g = c.gp, u = (c.t - g.t0) / g.dur; if(u < 0) return col;
  const e = u > 1 ? 1 : .5 * u + .5 * u * u * (3 - 2 * u), head = -.1 + 1.28 * e, dd = head - d.GS[i];
  if(dd < -.02) return col;
  const hw = d.GH[i], core = Math.exp(-((dd / .09) ** 2)) * hw, wake = dd > 0 ? Math.exp(-dd / .22) * (1 - fSmooth(.86, 1, u)) * hw : 0, fade = 1 - fSmooth(.9, 1, u);
  if(core * fade < .02 && wake < .02) return col;
  let o = mixInt(col, palInt(c.stops, clamp(d.GS[i] * 1.2 + (g.h || 0))), clamp(wake * .9));
  return mixInt(o, mixInt(c.C.bone, 0xffffff, .4), clamp(core * fade * 1.15));
}
/* faceSkinTarget for a creature: the base (skin toward ink by tone), then everything additive */
function polyColour(c, i, now){
  const d = c.d, P = d.parts[d.PPART[i]], C = c.C;
  if(c.view === 'map'){ const m = d.DOM[i]; if(m < 0 || P.tags.has('glyph')) return c.base[i]; return mixInt(c.base[i], d.musHue[m], Math.min(1, Math.max(.14 + .72 * clamp(Math.abs(c.acts[m])), d.PTONE[i]))); }
  let col = c.base[i]; const sh = c.shade[i];
  if(d.GS[i] >= 0 && c.gp) col = glyphLight(c, i, col);
  if(sh > .01) col = mixInt(col, C.ink, Math.min(.6, sh));
  if(P.flush && c.flush > .02) col = mixInt(col, C.cin, clamp(c.flush * P.flush));
  if(c.beh.style === 'field' && d.FW[i] >= .3){
    const t = now * .001, n = fbm(d.PCX[i] * .011 + t * .35, d.PCY[i] * .011 - t * .25 + fbm(d.PCX[i] * .006 - t * .2, d.PCY[i] * .006 + 3.1) * 1.6);
    const a = .5 * fSmooth(.42, .78, n) * d.FW[i]; if(a > .02) col = mixInt(col, palInt(c.stops, n * 1.3 - .15), Math.min(.82, a));
  }
  if(d.colour) col = d.colour(c, i, col, now);
  const h = c.hold.get(i);
  if(h){ const p = (now - h.t0) / h.dur; if(p >= 1) c.hold.delete(i); else col = mixInt(col, h.col, .85 * (1 - p) ** 1.6 * h.w); }
  return col;
}
function musApply(c){
  const d = c.d;
  c.DX.fill(0); c.DY.fill(0); c.shade.fill(0);
  for(let k = 0; k < d.MORPHS.length; k++){ const w = c.morph[k]; if(Math.abs(w) < 1e-4) continue; const M_ = d.MORPHS[k], V = M_.verts;
    for(let q = 0; q < V.length; q++){ const lg = M_.lag[q], u = lg ? ss3((w - lg) / (1 - lg)) : w; if(u === 0) continue; c.DX[V[q]] += u * M_.dx[q]; c.DY[V[q]] += u * M_.dy[q]; } }
  for(const m of d.MUS){
    const a = c.acts[m.n]; if(Math.abs(a) < .002) continue;
    const V = m.verts, dx = m.dx, dy = m.dy;
    for(let k = 0; k < V.length; k++){ const v = V[k]; c.DX[v] += a * dx[k]; c.DY[v] += a * dy[k]; }
    if(a > 0) for(let k = 0; k < m.shadeI.length; k++) c.shade[m.shadeI[k]] += a * m.shadeW[k];
  }
  for(let i = 0; i < d.NPOLY; i++) if(Math.abs(c.shade[i] - c.shadeDrawn[i]) > .01){ c.shadeDrawn[i] = c.shade[i]; c.colDirty.add(i); }
  if(c.view === 'map') for(let i = 0; i < d.NPOLY; i++) c.colDirty.add(i);
}
/* ---------- the behaviour layer: panel flips and holds, as in the face rig; their colour is additive and fades ---------- */
function flip(c, i, now, delay, o = {}){
  if(c.flips.has(i)) return;
  const w = o.w ?? c.d.FW[i];
  if(o.col != null && w < .3) return;
  c.flips.set(i, {w, t0:now + delay, dur:o.dur || 190 + c.rand() * 160, axis:c.rand() < .5, col:o.col, twitch:!!o.twitch, hold:o.hold ?? 600 + c.rand() * 1100, reps:o.reps || 1});
}
function flipStep(c, now){
  for(const [i, fl] of c.flips){
    const p = (now - fl.t0) / fl.dur; if(p < 0) continue;
    const el = c.polys[i];
    if(p >= 1){
      if(fl.reps > 1){ fl.reps--; fl.t0 = now + 40 + c.rand() * 120; continue; }
      el.style.transform = ''; c.flips.delete(i);
      if(fl.col != null && !fl.twitch) c.hold.set(i, {col:fl.col, t0:now, dur:fl.hold, w:fl.w});
      fillPoly(c, i, polyColour(c, i, now)); continue;
    }
    const sc = fl.twitch ? 1 - .82 * Math.sin(Math.PI * p) : Math.max(.04, Math.abs(Math.cos(Math.PI * p)));
    el.style.transform = fl.axis ? `scale(${sc.toFixed(3)},1)` : `scale(1,${sc.toFixed(3)})`;
    if(fl.twitch) fillPoly(c, i, p > .3 && p < .7 ? mixInt(c.base[i], fl.col ?? c.C.ink, .7 * fl.w) : polyColour(c, i, now));
    else if(p >= .5) fillPoly(c, i, fl.col != null ? mixInt(c.base[i], fl.col, .85 * fl.w) : polyColour(c, i, now));
  }
}
function burst(c, now, cx, cy, R, col, zone){
  const d = c.d, list = zone ? d.ZLIST[zone] || [] : d.FLIPPABLE, w = zone && zone !== 'skin' ? 1 : undefined;
  for(const i of list){ const dd = Math.hypot(d.PCX[i] - cx, d.PCY[i] - cy); if(dd < R * (.75 + .5 * vnoise(d.PCX[i] * .02, d.PCY[i] * .02))) flip(c, i, now, dd * 2.1 + 140 * vnoise(d.PCX[i] * .03 + now * .001, d.PCY[i] * .03), {col, w}); }
}
function ripple(c, now, col){ const d = c.d; for(const [i, u] of d.RIPPLE) flip(c, i, now, u * 1100, {col:col ?? palInt(c.stops, c.rand()), dur:220, hold:520, w:d.rippleW ?? undefined}); }
function spawn(c, now, dt){
  const d = c.d, B = c.beh, st = c.stops; c.flipAcc += (B.rate ?? .6) * dt / 1000;
  if(!d.FLIPPABLE.length) return;
  const pick = () => d.FLIPPABLE[(c.rand() * d.FLIPPABLE.length) | 0], due = () => { if(c.flipAcc >= 1){ c.flipAcc -= 1; return true; } return false; };
  switch(B.style){
    case 'drift': while(due()) flip(c, pick(), now, c.rand() * 200, {col:palInt(st, .3 + .7 * c.rand())}); break;
    case 'jitter': while(due()) flip(c, pick(), now, 0, {twitch:true, dur:110 + c.rand() * 90, col:palInt(st, .75)}); break;
    case 'burst': while(due()){ const i = pick(); burst(c, now, d.PCX[i], d.PCY[i], 90 + c.rand() * 120, palInt(st, .3 + .7 * c.rand())); } break;
    case 'ripple': if(c.flipAcc >= 1){ c.flipAcc = 0; ripple(c, now); } break;
  }
}
/* a wave of flips along the body (a shake's), from one end to the other */
function waveFlips(c, now, span, fromX = null){
  const d = c.d, st = c.stops; let x0 = 1e9, x1 = -1e9; for(const i of d.FLIPPABLE){ x0 = Math.min(x0, d.PCX[i]); x1 = Math.max(x1, d.PCX[i]); }
  for(const i of d.FLIPPABLE){ let u = (d.PCX[i] - x0) / ((x1 - x0) || 1); if(fromX !== null && fromX > (x0 + x1) / 2) u = 1 - u; flip(c, i, now, u * span * .75, {col:palInt(st, c.rand()), dur:200, hold:420, w:.6}); }
}

/* ---------- the anatomy view: bones as kites, joints, one fibre per muscle (plus any extras the creature lists) ---------- */
function drawAnatomy(c){
  const d = c.d;
  if(!c.anatBuilt) buildAnatomy(c);
  const bm = c.bm, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  const T = (x, y, b, z = 0, yaw = false) => { if(yaw) x = d.yawC + (x - d.yawC) * cs + z * sn; const o = b * 6; return [bm[o] * x + bm[o + 2] * y + bm[o + 4], bm[o + 1] * x + bm[o + 3] * y + bm[o + 5]]; };
  for(const e of c.anatEls){
    const pts = e.pts.map(p => T(p[0], p[1], e.b, e.z || 0, e.yaw));
    if(e.joint){ e.el.setAttribute('cx', r10(pts[0][0])); e.el.setAttribute('cy', r10(pts[0][1])); } else e.el.setAttribute('points', pts.map(p => r10(p[0]) + ',' + r10(p[1])).join(' '));
  }
  for(const f of c.fibers){
    const m = f.m, a = Math.max(0, c.acts[m.n]), fb = m.fib;
    const p1 = T(fb.o[0], fb.o[1], fb.ob, 40, fb.yaw), p2 = T(fb.i[0], fb.i[1], fb.ib, 40, fb.yaw);
    f.el.setAttribute('x1', r10(p1[0])); f.el.setAttribute('y1', r10(p1[1]));
    f.el.setAttribute('x2', r10(p2[0] + (p1[0] - p2[0]) * a * .4)); f.el.setAttribute('y2', r10(p2[1] + (p1[1] - p2[1]) * a * .4));
    f.el.setAttribute('stroke-width', (3 + a * 8).toFixed(1)); f.el.setAttribute('stroke-opacity', (.34 + a * .66).toFixed(2));
  }
}
function buildAnatomy(c){
  const d = c.d; c.anatBuilt = true; c.anatEls = []; c.fibers = [];
  const add = (pts, b, line, o = {}) => { const el = svgEl(line ? 'polyline' : 'polygon', {class:'bone' + (line ? ' line' : '')}); c.anat.appendChild(el); c.anatEls.push({el, pts, b, ...o}); };
  d.bones.forEach((B, b) => {
    if(B.len < 4 || B.anat === false) return;
    if(B.anat === 'line'){ add([B.p, B.q], b, true); return; }
    const [px, py] = B.p, [qx, qy] = B.q, l = B.len, nx = -(qy - py) / l, ny = (qx - px) / l, w = Math.min(11, l * .13);
    add([[px, py], [px + (qx - px) * .22 + nx * w, py + (qy - py) * .22 + ny * w], [qx, qy], [px + (qx - px) * .22 - nx * w, py + (qy - py) * .22 - ny * w]], b, false);
    const j = svgEl('circle', {class:'jt', r:5, cx:px, cy:py}); c.anat.appendChild(j); c.anatEls.push({el:j, pts:[[px, py]], b, joint:1});
  });
  for(const e of d.anatomy || []) add(e.pts, d.BI[e.bone], !!e.line, {yaw:!!e.yaw, z:e.z || 0});
  for(const m of d.MUS){
    if(!m.fib) continue;
    const el = svgEl('line', {class:'fiber', stroke:m.def.hue}), t = svgEl('title'); t.textContent = m.def.name + (m.side === 'C' ? '' : ' ' + m.side); el.appendChild(t);
    el.addEventListener('pointerdown', ev => { ev.stopPropagation(); c.direct[m.n] = Math.abs(c.direct[m.n]) > .5 ? 0 : 1; });
    c.anat.appendChild(el); c.fibers.push({el, m});
  }
}

/* ---------- a live creature ---------- */
const LIVE = [], CSS_ID = 'creature-kit-css';
function ensureCss(){
  if(document.getElementById(CSS_ID)) return;
  const st = document.createElement('style'); st.id = CSS_ID;
  st.textContent = '.creature .pn{transform-box:fill-box;transform-origin:center}.creature.anat-on .part{opacity:.28}.creature .anat .fiber{fill:none;stroke-linecap:round;cursor:pointer}.creature .anat .bone{fill:#eadcc8;fill-opacity:.16;stroke:#f4ead8;stroke-width:2;stroke-linejoin:round}.creature .anat .bone.line{fill:none;stroke-width:2.4}.creature .anat .jt{fill:#f4ead8;fill-opacity:.8}';
  document.head.appendChild(st);
}
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for(const k in attrs) e.setAttribute(k, attrs[k]); return e; };
function styleAll(c){
  const d = c.d, G = gapTable(d, c.size), C = c.C; c.gt = G.gap;
  c.sil.setAttribute('fill', intHex(C.line)); c.sil.setAttribute('stroke', intHex(C.line)); c.sil.setAttribute('stroke-width', r10(G.sil));
  d.parts.forEach((P, k) => {
    const b = c.backs[k], ls = C.ls[k]; b.setAttribute('fill', intHex(ls.fill));
    if(ls.bs){ b.setAttribute('stroke', intHex(ls.stroke)); b.setAttribute('stroke-width', r10(ls.bs)); } else b.removeAttribute('stroke');
    const lp = c.loops[k]; if(lp){ lp.setAttribute('stroke', intHex(ls.stroke)); lp.setAttribute('stroke-width', r10(ls.role === 'c' ? G.c : ls.role === 'f' ? G.f : G.b)); }
  });
  if(c.groundEl) c.groundEl.setAttribute('stroke', intHex(C.line));
  c.force = true;
}
function updateGround(c){
  const d = c.d, A = c.groundA, gy = d.groundY; c.groundDrawn = A;
  let n = '', f = '', off = ((c.gx % 90) + 90) % 90;
  for(let x = -270 - off; x < d.W + 300; x += 90){ n += 'M' + r10(x) + ' ' + (gy + 3) + 'v9'; f += 'M' + r10(x + 45) + ' ' + (gy - 4) + 'v6'; }
  c.groundEl.setAttribute('d', 'M-300 ' + (gy + 3) + 'H' + (d.W + 300) + 'M-300 ' + (gy - 4) + 'H' + (d.W + 300) + n + f); c.groundEl.setAttribute('opacity', A.toFixed(2));
}
function buildDom(c){
  const d = c.d, C0 = c.C, h = Math.round(c.size * d.H / d.W);
  const svg = svgEl('svg', {class:'creature', width:c.size, height:h, viewBox:`0 0 ${d.W} ${d.H}`}); svg.style.overflow = 'visible'; svg.style.touchAction = 'none';
  const rig = svgEl('g', {class:'rig'});
  c.shown = {}; c.groups = []; c.backs = []; c.loops = []; c.polys = new Array(d.NPOLY); c.bd = new Array(d.parts.length).fill(''); c.ld = new Array(d.parts.length).fill('');
  c.sil = svgEl('path', {'stroke-linejoin':'round'}); let silDone = false;
  for(const P of d.DRAW){
    if(!silDone && P.layer >= d.silLayer){ rig.appendChild(c.sil); silDone = true; }
    const g = svgEl('g', {class:'part'}); g.dataset.part = P.name; c.groups[P.order] = g; if(P.show){ g.style.display = 'none'; c.shown[P.order] = false; }
    const b = svgEl('path', {'stroke-linejoin':'round'}); c.backs[P.order] = b; g.appendChild(b);
    for(let i = P.p0; i < P.p1; i++){ const pg = svgEl('polygon', {class:'pn', points:'', fill:intHex(c.base[i])}); c.polys[i] = pg; c.fill[i] = c.base[i]; g.appendChild(pg); }
    if(C0.ls[P.order].role && P.loop && P.loop.length > 2){ const lp = svgEl('path', {fill:'none', 'stroke-linejoin':'round', 'stroke-linecap':'round'}); c.loops[P.order] = lp; g.appendChild(lp); }
    rig.appendChild(g);
  }
  if(!silDone) rig.appendChild(c.sil);
  if(d.groundY != null){ c.groundEl = svgEl('path', {fill:'none', 'stroke-width':'1.6', opacity:'0'}); c.groundDrawn = 0; svg.appendChild(c.groundEl); }
  svg.appendChild(rig); c.svg = svg; c.rig = rig;
  c.anat = svgEl('g', {class:'anat'}); c.anat.style.display = 'none'; svg.appendChild(c.anat);
  svg.addEventListener('pointerdown', e => {   // a click on the figure spawns a burst of colour on the skin
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    burst(c, c.t, q.x, q.y, 150, palInt(c.stops, c.rand()));
  });
  c.el.innerHTML = ''; c.el.appendChild(svg);
  styleAll(c);
}
function newState(c){
  const d = c.d, NB = d.NB, NM = d.NM, NPOLY = d.NPOLY, NVERT = d.NVERT, NL = d.NL;
  Object.assign(c, {flips:new Map(), hold:new Map(), beh:{style:'drift', rate:.6}, flipAcc:0, actions:[], paused:false, last:0, cpu:0, frames:0, cpuAvg:0, t:0,
    acts:new Float32Array(NM), T:new Float32Array(NM), Ti:new Float32Array(NM), Ta:new Float32Array(NM), Tp:new Float32Array(NM), Tsoft:new Float32Array(NM), Tl:new Float32Array(NM), Tleg:new Float32Array(NM),
    vel:new Float32Array(NM), drawn:new Float32Array(NM), direct:new Float32Array(NM),
    rot:new Float32Array(NB), sx:new Float32Array(NB), sy:new Float32Array(NB), bm:new Float32Array(NB * 6),
    DX:new Float32Array(NVERT), DY:new Float32Array(NVERT), X:Float32Array.from(d.VX), Y:Float32Array.from(d.VY), shade:new Float32Array(NPOLY), shadeDrawn:new Float32Array(NPOLY), vs:new Array(NVERT), pstr:new Array(NPOLY).fill(''), pnew:new Array(NPOLY),
    pdirty:new Uint8Array(d.parts.length), snap:d.parts.map(P => new Float32Array(P.boneList.length * 6).fill(1e9)), partYaw:new Float32Array(d.parts.length).fill(99), fill:new Int32Array(NPOLY).fill(-1),
    ch:{x:0, y:0, r:0}, chS:{x:0, y:0, r:0}, yaw:0, flush:0, flushT:0, flushDrawn:0, force:true, colDirty:new Set(), musMoved:true,
    leg:newLegs(d), ik:d.IKD.map(() => ({over:0, w:0})), ikS:d.IKD.map(() => ({v:[0, 0, 0], n:[0, 0, 0]})), gait:null, rfix:0, sk:1, tm:cdS(1), pl:cdS(NL * 2 + 2), mn:cdS(NB), mnS:new Float32Array(NB), padLegRaw:new Float32Array(NL * 2 + 2),
    tempo:1, limHits:0, limMax:0, rs:cdS(3), js:cdS(NB), ps:cdS(NB * 2), cs:cdS(3), legK:1, root:{x:0, y:0, r:0}, jr:new Float32Array(NB), ikd:new Float32Array(NB),
    Q:{rx:0, ry:0, rr:0, bx:0, by:0, sx:new Float32Array(NB), sy:new Float32Array(NB), sa:new Float32Array(NB).fill(1), sc:new Float32Array(NB).fill(1), jt:new Float32Array(NB), jd:new Float32Array(NB), yaw:0, cam:null, legs:new Array(NL).fill(null), legOff:false, ground:0},
    cam:{s:d.cam0[0], x:d.cam0[1], y:d.cam0[2]}, gx:0, gv:0, groundA:0, groundDrawn:0, dtms:16, dyn:{speed:1, damp:.78}, mot:{scale:1, idle:1}, breath:{depth:1, rate:1}, rippleRate:0, nextRipple:0, fieldDrawn:0,
    pm:newPM(d), gs:newGait(d), goals:{}, morph:Float32Array.from(d.MORPHS, m => m.start), morphT:Float32Array.from(d.MORPHS, m => m.start), morphV:new Float32Array(d.MORPHS.length), morphK:Float32Array.from(d.MORPHS, m => m.k), fol:d.FOLLOW.map(() => ({th:0, v:0, Af:0, S:cdS(1)})), timers:{}, top:null});
  c.pad = newPads(d);
  c.cs.x.set([d.cam0[0], d.cam0[1], d.cam0[2]]); c.tm.x[0] = 1;
}
/* the handle: the same contract for every creature (CREATURE-SPEC.md, "The handle") */
function api(c){
  const d = c.d;
  c.play = (name, a = {}) => {
    if(d.GAIT_PSI[name] !== undefined || d.POSTURES[name]){ goPosture(c, name, a); return; }
    if(!d.actions[name]) return;
    if(!actionReady(c, name)){ c.pm.pend = c.pm.pend.filter(p => p.name !== name); c.pm.pend.push({name, a}); actionRoute(c, name); return; }
    startAction(c, name, a);
  };
  c.go = (name, o) => goPosture(c, name, o);
  c.posture = () => postureInfo(c);
  c.stop = name => { if(!name || d.GAIT_PSI[name] !== undefined){ gaitStop(c); if(name) return; } c.actions = c.actions.filter(a => name && a.name !== name); };
  c.running = name => d.GAIT_PSI[name] !== undefined ? c.gs.on && c.gs.phase !== 'stop' && c.gait && c.gait.name === name : d.POSTURES[name] ? c.pm.node === name && !c.pm.tr : c.actions.some(a => a.name === name && !a.cut);
  /* bring the parts with a tag above everything else (a leg raised over the body) and back (null) */
  c.raise = tag => { if(c.top === tag) return; c.top = tag; const ord = d.DRAW.filter(P => P.layer >= d.silLayer); for(const P of ord) if(!tag || !P.tags.has(tag)) c.rig.appendChild(c.groups[P.order]); if(tag) for(const P of ord) if(P.tags.has(tag)) c.rig.appendChild(c.groups[P.order]); };
  c.setView = v => { c.view = v; c.svg.classList.toggle('anat-on', v === 'anatomy'); c.anat.style.display = v === 'anatomy' ? '' : 'none'; for(let i = 0; i < d.NPOLY; i++) c.colDirty.add(i); c.force = true; };
  c.setLayer = (name, on) => {
    d.parts.forEach(P => {
      const g = c.groups[P.order], gl = P.tags.has('glyph'), back = c.backs[P.order];
      if(name === 'lines' && !gl){ back.style.visibility = on ? '' : 'hidden'; c.sil.style.display = on ? '' : 'none'; if(c.loops[P.order]) c.loops[P.order].style.display = on ? '' : 'none'; }
      if(name === 'fills' && !gl) [...g.children].forEach(e => { if(e !== back && e !== c.loops[P.order]) e.style.display = on ? '' : 'none'; });
      if(name === 'glyph' && gl) g.style.visibility = on ? '' : 'hidden';
    });
  };
  c.setLife = (on, rate) => { c.life.on = !!on; if(rate != null) c.life.rate = rate; c.life.next = c.t + 1500; };
  c.setBeh = b => { Object.assign(c.beh, b); if(c.beh.style !== 'field') for(const i of d.FLIPPABLE) c.colDirty.add(i); };
  c.setBehPalette = list => { c.behPal = list.slice(); c.stops = stopsOf(c.behPal); for(const i of d.FLIPPABLE) c.colDirty.add(i); };
  c.setPalette = p => { c.opt.palette = Object.assign({}, c.opt.palette || {}, p); c.P = palette(d, c.opt.palette); c.C = colours(d, c.P); c.base = baseColours(d, c.C); for(let i = 0; i < d.NPOLY; i++) c.colDirty.add(i); if(c.svg) styleAll(c); };
  c.resize = n => { c.size = n; if(!c.fit){ c.svg.setAttribute('width', n); c.svg.setAttribute('height', Math.round(n * d.H / d.W)); } styleAll(c); };
  c.setPad = (name, v, side = 'L') => { const q = c.pad[name]; if(!q) return; if(side === 'both' || !q.split){ q.L = v.slice(); q.R = v.slice(); } else q[side] = v.slice(); };
  c.resetPad = name => { c.pad[name] = {L:[0, 0], R:[0, 0], split:false}; };
  c.padGhost = (name, s = 0) => { const P = d.pads[name]; if(P.ghost) return P.ghost(c, s); if(P.leg){ const k = d.IKD.findIndex(D => D.kind === P.leg && (D.side === 'F') === (s === 1)); return k >= 0 ? legGhost(c, k) : [0, 0]; } return [0, 0]; };
  c.holdMuscle = (n, v) => { c.direct[n] = v; };
  c.setMorph = (name, w, k) => { const i = d.MORPHI[name]; if(i === undefined) return; c.morphT[i] = w; if(k) c.morphK[i] = k; };
  c.morphW = name => { const i = d.MORPHI[name]; return i === undefined ? 0 : c.morph[i]; };
  c.morphNow = (name, w) => { const i = d.MORPHI[name]; if(i === undefined) return; c.morph[i] = c.morphT[i] = w; c.morphV[i] = 0; c.musMoved = true; for(const p of d.MORPHS[i].parts) c.pdirty[p] = 1; };
  /* place a part's whole group with an affine matrix [a,b,c,d,e,f] (null clears it). No vertex or layout work: the geometry of every
     polygon, loop and backing path stays as built, and the group rides the bones. A part declares organ/base/parent on M.part
     (def.PARTI); a model that declares none has no parts to form, so the hook is inert. */
  c.form = (name, m) => {
    const i = d.PARTN[name]; if(i === undefined) return;
    const P = d.PARTI[i], g = c.groups[P.part]; if(!g) return;
    const s = m ? 'matrix(' + m.map(v => { const q = Math.round(v * 1e4) / 1e4; return q === 0 ? 0 : q; }).join(' ') + ')' : '';
    if(g._form !== s){ g._form = s; if(s) g.setAttribute('transform', s); else g.removeAttribute('transform'); }
  };
  c.scale = (bone, along, across = 1) => { const b = d.BI[bone]; c.Q.sa[b] *= along; c.Q.sc[b] *= across; };
  c.act = (id, s = 0) => { const df = d.defs[id]; if(!df) return 0; const n = df.pair ? d.MI[id + '.' + d.SIDES[df.pair][s]] : d.MI[id + '.C']; return c.acts[n] || 0; };
  c.spec = (T, S, k) => spec(c, T, S, k);
  c.jt = (bone, v) => { c.Q.jt[d.BI[bone]] += v; };
  c.jd = (bone, v) => { c.Q.jd[d.BI[bone]] += v; };
  c.slide = (bone, x, y) => { const b = d.BI[bone]; c.Q.sx[b] += x; c.Q.sy[b] += y; };
  c.rootAbout = (pv, th, dx = 0, dy = 0) => { const r = rootVOf(d, pv, th, dx, dy), q = c.Q; q.rx += r[0]; q.ry += r[1]; q.rr += r[2]; };
  c.legReq = (k, x, y, b, o) => legReq(c, k, x, y, b, o);
  c.foot = k => { const V = c.pm.V, CHI = d.CHI; return [V[CHI['f' + k + 'x']], V[CHI['f' + k + 'y']], V[CHI['f' + k + 'b']]]; };
  /* blend a foot from where the posture has it to an action's own target by u (and the angle by ub): never from the rest pose */
  c.legTo = (k, x, y, b, u, ub = u, o = {}) => { const f = c.foot(k); legReq(c, k, f[0] + (x - f[0]) * u, f[1] + (y - f[1]) * u, f[2] + wrapA(b - f[2]) * ub, o); };
  c.wp = (bone, p) => { const o = d.BI[bone] * 6, m = c.bm; return [m[o] * p[0] + m[o + 2] * p[1] + m[o + 4], m[o + 1] * p[0] + m[o + 3] * p[1] + m[o + 5]]; };
  c.toe = k => { const D = d.IKD[k], o = D.b[2] * 6, m = c.bm; return [m[o] * D.tip[0] + m[o + 2] * D.tip[1] + m[o + 4], m[o + 1] * D.tip[0] + m[o + 3] * D.tip[1] + m[o + 5]]; };
  c.every = (key, range, now) => { const t = c.timers; if(t[key] === undefined) t[key] = now + range[0] + c.rand() * (range[1] - range[0]); if(now < t[key]) return false; t[key] = now + range[0] + c.rand() * (range[1] - range[0]); return true; };
  c.postureW = () => c.pm.w;
  /* goals: a value that eases to a new target on a minimum-jerk curve and holds there (the serpent's bouts). c.goal(key, to, ms) starts a
     move from wherever it is; c.goalAt(key) reads it. Use them for life's bouts: a head turning to look and staying, a tail tucking. */
  c.goalAt = (key, now = c.t) => { const g = c.goals[key]; if(!g) return 0; const u = clamp((now - g.t0) / g.ms); return g.from + (g.to - g.from) * u * u * u * (10 - 15 * u + 6 * u * u); };
  c.goal = (key, to, ms, at = c.t) => { const v = c.goalAt(key, at); c.goals[key] = {from:v, to, t0:at, ms:Math.max(1, ms)}; };
  /* a bend laid along a chain (SERPENT-MOTION-RESEARCH 2.1). Curvature amp (radians per unit length at the peak) as a sine of arc length
     with wavelength lam (units). With ground:true the phase follows the scrolling ground (c.gx), so while the creature walks or slithers
     the bends stay put on the ground and the body flows through them (a travelling wave, head to tail). phase moves it by hand (a standing
     shape that drifts slowly, for a resting neck). from/to (0..1) limit it to part of the chain, eased in and out. Adds to the joint channel
     (jt, smoothed per joint) unless direct:true (jd, the instant channel). */
  c.chainWave = (name, o = {}) => {
    /* name: one chain, or a body made of several laid end to end: [{name, reverse}] in order from the head back. A long body is best rooted
       in its middle (a bend at a chain's root moves the whole chain): a front chain from the middle out to the head (reverse:true, since it
       runs away from the head) and a tail chain from the middle out to the tail. Arc length runs from the head through them all, and a
       reversed chain bends the other way, so the wave is one wave along the whole body. */
    const parts = Array.isArray(name) ? name : [{name, reverse:!!o.fromTip}], segs = [];
    let tot = 0; for(const p of parts){ const C = d.CHAINS[p.name]; if(!C) return; segs.push([C, p.reverse, tot]); tot += C.len; }
    const lam = o.lam || tot * .5, amp = o.amp ?? .004, a0 = o.from ?? 0, a1 = o.to ?? 1, e = o.env ?? 1;
    const th0 = amp * e * lam / (2 * Math.PI), j0 = 1 - th0 * th0 / 4 + th0 ** 4 / 64 - th0 ** 6 / 2304;   // the tangent swing, and J0 of it: the body covers 1/J0 more arc than ground
    const ph = (o.phase || 0) - (o.ground ? 2 * Math.PI * c.gx / (lam * Math.max(.3, j0)) : 0);   // a bend fixed on the ground sits further back along the body as the body moves on (s - gx)
    for(const [C, rev, base] of segs){ const n = C.names.length;
      for(let i = 0; i < n; i++){
        const s0 = base + (rev ? (n - 1 - i) : i) * C.seg + C.seg / 2, u = s0 / tot; if(u < a0 || u > a1) continue;
        const w = fSmooth(a0, a0 + .08, u) * (1 - fSmooth(a1 - .08, a1, u)), k = (rev ? -1 : 1) * amp * Math.sin(2 * Math.PI * s0 / lam + ph) * w * e * C.seg;
        if(o.direct) c.Q.jd[d.BI[C.names[i]]] += k; else c.Q.jt[d.BI[C.names[i]]] += k;
      } }
    /* carry:true also turns and shifts the root with the wave, so the whole body lies on the path the bends describe (a path fixed on the
       ground, with ground:true) instead of swinging about a pinned middle. rootAt is the root's arc position (default: where the chains
       meet, the end of the first). The heading along the path is the curvature's integral and its offset the heading's, both closed form
       for a sine. carry is the sign (1 or -1) that matches the chains' bend direction to the root's turn. */
    if(o.carry){
      const sr = o.rootAt ?? (segs.length > 1 ? segs[1][2] : 0), q = 2 * Math.PI / lam, ur = sr / tot;
      const w = (ur < a0 || ur > a1) ? 0 : fSmooth(a0, a0 + .08, ur) * (1 - fSmooth(a1 - .08, a1, ur)), A = amp * e * w;
      const head = -A / q * Math.cos(q * sr + ph), off = -A / (q * q) * Math.sin(q * sr + ph), B = d.bones[0], bl = B.len || 1, nx = -(B.q[1] - B.p[1]) / bl, ny = (B.q[0] - B.p[0]) / bl;
      c.Q.jd[0] += o.carry * head; c.Q.bx += o.carry * off * nx; c.Q.by += o.carry * off * ny;   // the instant channels: a smoothed root would lag the wave and the body would slip
    }
  };
  c.shiftAmt = () => clamp(1 - d.POSTURE_NAMES.reduce((s, n) => s + (n === d.REST_POSTURE ? 0 : c.pm.w[n] * (d.shiftOf ? d.shiftOf[n] ?? .8 : .8)), 0), .1, 1);
  c.burst = (col, zone = 'glyph') => { const L = d.ZLIST[zone] || []; let x = 0, y = 0; for(const i of L){ x += d.PCX[i]; y += d.PCY[i]; } burst(c, c.t, x / (L.length || 1), y / (L.length || 1), 260, col ?? palInt(c.stops, c.rand()), zone); };
  c.burstAt = (x, y, R = 150, col, zone) => burst(c, c.t, x, y, R, col ?? palInt(c.stops, c.rand()), zone);
  c.flipWave = (span = 1400, fromX = null) => waveFlips(c, c.t, span, fromX);
  c.ripple = col => ripple(c, c.t, col);
  c.glyph = (dur = 3000) => { if(d.GLYPH_I.length) c.gp = {t0:c.t, dur, h:c.rand() * .3}; };
  c.advance = (ms, st = 16) => { let t = c.t; const end = t + ms; while(t < end){ t = Math.min(end, t + st); step(c, t, st); } };
  c.pause = p => { c.paused = p; };
  c.destroy = () => { const k = LIVE.indexOf(c); if(k >= 0) LIVE.splice(k, 1); c.el.innerHTML = ''; };
  c.reset = () => {
    const keep = {el:c.el, opt:c.opt, size:c.size, view:c.view, d, svg:c.svg, rig:c.rig, anat:c.anat, groups:c.groups, backs:c.backs, loops:c.loops, polys:c.polys, sil:c.sil, groundEl:c.groundEl, bd:c.bd, ld:c.ld, shown:c.shown, life:c.life, behPal:c.behPal, stops:c.stops, P:c.P, C:c.C, base:c.base, gt:c.gt, fit:c.fit, rand:c.rand, beh0:c.beh};
    for(const [i] of c.flips) c.polys[i].style.transform = '';
    const paused = c.paused; newState(c); Object.assign(c, keep); c.beh = keep.beh0; c.paused = paused; c.life = {...keep.life, next:2500, last:'', at:{}, node:'', dwell:0};   // life keeps whether it is on and its rate; its schedule starts over c.gp = null; c.top = '?'; c.raise(null); for(let i = 0; i < d.NPOLY; i++){ c.colDirty.add(i); c.fill[i] = -1; } c.force = true; step(c, c.t || 0, 16);
  };
  c.info = () => ({id:d.id, name:d.name, ...d.counts});
  c.probe = PROBE(c);
  return c;
}
const rootVOf = (d, pv, th, dx, dy) => { const P = d.pivot, ct = Math.cos(th), st = Math.sin(th), vx = P[0] - pv[0], vy = P[1] - pv[1]; return [ct * vx - st * vy + pv[0] - P[0] + dx, st * vx + ct * vy + pv[1] - P[1] + dy, th]; };
/* the registry: creature files define(), pages mount() by id */
const REG = {};
K.define = def => { REG[def.id] = def; return def; };
K.get = id => REG[id];
K.list = () => Object.keys(REG);
K.restSvg = (id, o) => restSvg(typeof id === 'string' ? REG[id] : id, o);
K.mount = (id, el, o = {}) => {
  const d = typeof id === 'string' ? REG[id] : id; if(!d) throw new Error('creature-kit: no creature ' + id);
  const opt = {size:o.size || 320, live:o.live !== false, palette:o.palette || {}, view:o.view || 'skin', seed:o.seed ?? 7};
  if(!opt.live){ el.innerHTML = restSvg(d, {size:opt.size, palette:opt.palette}); return {live:false, el, d, setPalette(p){ opt.palette = Object.assign({}, opt.palette, p); el.innerHTML = restSvg(d, {size:opt.size, palette:opt.palette}); }, resize(n){ opt.size = n; el.innerHTML = restSvg(d, {size:n, palette:opt.palette}); }, destroy(){ el.innerHTML = ''; }}; }
  ensureCss();
  const c = {el, opt, d, size:opt.size, view:opt.view, rand:rng(opt.seed), crew:o.crew || null};   // crew: the host this creature is a member of (creature-crew.js); null for a creature on its own page
  newState(c);
  c.life = {on:o.life !== false, rate:o.lifeRate ?? d.life.rate, next:2500, last:'', at:{}, node:'', dwell:0, smallOnly:!!o.lifeSmall};   // smallOnly: the small actions only, never a move between postures (a crew member's moves are the crew's)
  c.behPal = (o.behPalette || d.behPalette || BEH_PAL).slice(); c.stops = stopsOf(c.behPal);
  c.P = palette(d, opt.palette); c.C = colours(d, c.P); c.base = baseColours(d, c.C);
  buildDom(c); api(c);
  c.svg.classList.toggle('anat-on', c.view === 'anatomy');
  LIVE.push(c); startLoop();
  step(c, 0, 16);
  return c;
};
let RAF = 0, FRAME = 0;
const STATS = {n:0, ms:0};
function startLoop(){
  if(RAF) return;
  const loop = now => {
    RAF = requestAnimationFrame(loop); FRAME++;
    if(document.hidden) return;
    for(const c of LIVE){
      if(c.paused) continue;
      if(!c.t0) c.t0 = now - (c.t || 0);
      if(c.size < 110 && FRAME % 3) continue;
      const dt = Math.min(80, Math.max(0, now - (c.last || now - 16))); c.last = now;
      const a = performance.now();
      step(c, now - c.t0, dt);
      const ms = performance.now() - a; c.cpu += ms; c.cpuAvg += (ms - c.cpuAvg) * .05; STATS.n++; STATS.ms += ms;
    }
  };
  RAF = requestAnimationFrame(loop);
}
K.STATS = STATS; K.LIVE = LIVE;
/* mesh quality: the smallest interior angle of every triangle, in the rest pose; parts matching `skip` (hand-placed shapes) are left out */
K.meshQuality = (id, skip = null) => {
  const d = typeof id === 'string' ? REG[id] : id; let n = 0, minA = 180, sum = 0, u20 = 0, u25 = 0;
  for(let i = 0; i < d.NPOLY; i++){
    const ids = d.PV[i], P = d.parts[d.PPART[i]]; if(ids.length !== 3 || (skip && skip.test(P.name))) continue;
    const p = ids.map(v => [d.VX[v], d.VY[v]]), ang = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - a[0], vy = c[1] - a[1]; return Math.acos(clamp((ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1), -1, 1)) * 180 / Math.PI; };
    const m = Math.min(ang(p[0], p[1], p[2]), ang(p[1], p[2], p[0]), ang(p[2], p[0], p[1]));
    n++; sum += m; if(m < minA) minA = m; if(m < 20) u20++; if(m < 25) u25++;
  }
  return {triangles:n, minAngle:+minA.toFixed(2), meanMinAngle:+(sum / (n || 1)).toFixed(1), under20:+(100 * u20 / (n || 1)).toFixed(1), under25:+(100 * u25 / (n || 1)).toFixed(1)};
};

/* ---------- the probe: the standard gates, measured inside the page on the virtual clock ----------
   tools/creature-gate.mjs calls these through Playwright and holds the numbers to the spec's limits. Every run starts from a reset with life and
   behaviour off, and is driven by c.advance, so it draws the same frames every time. Measures, per run: the largest single-frame vertex step,
   the largest step and jerk (second difference) per 48 ms, joint-limit hits, vertices out of the view, overlays out of their hosts, and stance
   slip on a gait. */
function PROBE(c){
  const d = c.d, NV_ = d.NVERT, PARTS = d.parts;
  const vis = new Uint8Array(NV_);
  /* reach: how far each vertex rests from the pivot, against the lion's 330. A wingtip 560 out moves further per frame for the same motion, so
     its steps are divided by its reach factor before they are held to the limits (watch() reports both the raw and the scaled maximum) */
  const REACH = d.reachRef || 330, rf = Float32Array.from(d.VX, (x, v) => Math.max(1, Math.hypot(x - d.pivot[0], d.VY[v] - d.pivot[1]) / REACH));
  const refreshVis = () => { for(const P of PARTS){ const on = c.shown[P.order] !== false && !P.tags.has('free'); for(let v = P.v0; v < P.v1; v++) vis[v] = on ? 1 : 0; } };
  const hostParts = PARTS.filter(P => P.host).map(P => ({P, hosts:P.host.map(n => { const H = PARTS.find(q => q.name === n); if(!H) throw new Error('probe: host ' + n + ' of ' + P.name + ' is no part'); return H; })}));
  const loopPts = H => (H.loop || []).map(v => [c.X[v], c.Y[v]]);
  const overlaysOut = () => { let n = 0, worst = 0; for(const {P, hosts} of hostParts){ if(c.shown[P.order] === false) continue; const L = hosts.map(loopPts); for(let v = P.v0; v < P.v1; v++){ const x = c.X[v], y = c.Y[v]; if(L.some(l => pip(l, x, y))) continue; const e = Math.min(...L.map(l => edgeDist(l, x, y))); if(e > 5){ n++; worst = Math.max(worst, e); } } } return {n, worst}; };
  const outOfView = (m = 40) => { const cm = c.cam, x0 = cm.x - d.W / 2 * cm.s - m, x1 = cm.x + d.W / 2 * cm.s + m, y0 = cm.y - d.H / 2 * cm.s - m, y1 = cm.y + d.H / 2 * cm.s + m; let n = 0; for(let v = 0; v < NV_; v++) if(vis[v] && (c.X[v] < x0 || c.X[v] > x1 || c.Y[v] < y0 || c.Y[v] > y1)) n++; return n; };
  const fresh = () => { c.reset(); c.setLife(false); c.setBeh({style:'off'}); for(const n of d.PAD_ORDER) c.resetPad(n); if(c.probeSetup) c.probeSetup(c); c.advance(300, 16); };   // probeSetup: the state the gate runs in (a two-state creature is gated in both)
  const held = () => { const p = c.posture(); return !p.moving && !p.route.length && !p.gait && !c.pm.after && !c.pm.pend.length && c.pm.settle > 700 && !c.actions.some(a => !a.cut && !(d.actions[a.name] && d.actions[a.name].tiny)); };
  const settle = (maxMs = 20000) => { let t = 0; while(t < maxMs){ c.advance(16, 16); t += 16; if(held()) break; } return t; };
  /* watch the body for ms: advance frame by frame and measure */
  const watch = (ms, o = {}) => {
    refreshVis();
    const st = o.st || 16, out = {frameMax:0, step48:0, jerk48:0, lim:0, oov:0, overlay:0, overlayWorst:0, slip:0, frames:0};
    const lim0 = c.limHits; let px = Float32Array.from(c.X), py = Float32Array.from(c.Y), qx = null, qy = null, ax = px.slice(), ay = py.slice(), acc = 0;
    const stance = d.NL ? d.IKD.map(() => null) : [];
    for(let t = 0; t < ms; t += st){
      c.advance(st, st); out.frames++; acc += st;
      { const was = vis.slice(); refreshVis(); for(let v = 0; v < NV_; v++) if(vis[v] && !was[v]){ px[v] = ax[v] = c.X[v]; py[v] = ay[v] = c.Y[v]; if(qx){ qx[v] = c.X[v]; qy[v] = c.Y[v]; } } }   // a part that has just appeared starts from where it is shown
      let fm = 0, fr = 0; for(let v = 0; v < NV_; v++){ if(!vis[v]) continue; const s = Math.hypot(c.X[v] - px[v], c.Y[v] - py[v]); if(s > fr) fr = s; if(s / rf[v] > fm) fm = s / rf[v]; }
      if(fm > out.frameMax){ out.frameMax = fm; out.frameAt = Math.round(t); } out.frameRaw = Math.max(out.frameRaw || 0, fr);
      px.set(c.X); py.set(c.Y);
      if(acc >= 48){
        acc = 0; let sm = 0, jm = 0;
        for(let v = 0; v < NV_; v++){ if(!vis[v]) continue; const dx = c.X[v] - ax[v], dy = c.Y[v] - ay[v], s = Math.hypot(dx, dy) / rf[v]; if(s > sm) sm = s; if(qx){ const j = Math.hypot(dx - (ax[v] - qx[v]), dy - (ay[v] - qy[v])) / rf[v]; if(j > jm) jm = j; } }
        out.step48 = Math.max(out.step48, sm); out.jerk48 = Math.max(out.jerk48, jm); qx = ax.slice(); qy = ay.slice(); ax.set(c.X); ay.set(c.Y);
        out.oov = Math.max(out.oov, outOfView(o.margin ?? 40));
        const ov = overlaysOut(); out.overlay = Math.max(out.overlay, ov.n); out.overlayWorst = Math.max(out.overlayWorst, ov.worst);
      }
      if(!(c.gait && c.gs.phase === 'run' && c.gs.age > 1600)) stance.fill(null); else for(let k = 0; k < d.NL; k++){ const toe = c.toe(k); if(c.gait.stance[k] && c.gs.legs[k].p > .08 && c.gs.legs[k].p < .92){ if(stance[k]){ const s = Math.abs(toe[0] + c.gx - stance[k][0]); out.slip = Math.max(out.slip, s); } else stance[k] = [toe[0] + c.gx, toe[1]]; } else stance[k] = null; }
      if(o.each) o.each(c, t, out);
    }
    out.lim = c.limHits - lim0;
    for(const k of ['frameMax', 'step48', 'jerk48', 'slip', 'overlayWorst']) out[k] = +out[k].toFixed(2);
    return out;
  };
  const untilHeld = (maxMs = 20000, o) => { let t = 0; const agg = {frameMax:0, step48:0, jerk48:0, lim:0, oov:0, overlay:0, overlayWorst:0, slip:0, frames:0}; while(t < maxMs){ const r = watch(160, o); t += 160; for(const k in r) if(typeof r[k] === 'number') agg[k] = k === 'lim' || k === 'frames' ? agg[k] + r[k] : Math.max(agg[k], r[k]); if(held()) break; } agg.ms = t; return agg; };
  const feetOff = () => { let w = 0; for(let k = 0; k < d.NL; k++){ const f = c.foot(k), t = c.toe(k); if(c.leg[k].w > .5) w = Math.max(w, Math.hypot(t[0] - f[0], t[1] - f[1])); } return +w.toFixed(2); };
  return {
    fresh, held, settle, watch, untilHeld, feetOff, overlaysOut, outOfView,
    /* every posture to every other, routed through the graph */
    routes(){
      const out = [];
      for(const a of d.POSTURE_NAMES) for(const b of d.POSTURE_NAMES){ if(a === b) continue; fresh(); c.go(a); settle(); c.go(b); const w = untilHeld(20000); out.push({from:a, to:b, ...w, ended:c.posture().at, feet:feetOff(), path:pathOf(d, a, b).join('>')}); }
      return out;
    },
    /* a transition redirected part way (to the node behind, or elsewhere) */
    interrupts(){
      const out = [], P = d.POSTURE_NAMES;
      for(const a of P) for(const b of P){ if(a === b || !(d.NEIGH[a] && d.NEIGH[a].has(b))) continue;
        for(const u of [.35, .65]){ fresh(); c.go(a); settle(); c.go(b); const ms = edgeMs(d, a, b) * u; c.advance(ms, 16); const back = P.find(n => n !== a && n !== b && d.NEIGH[a] && d.NEIGH[a].has(n)) || a; c.go(back); const w = untilHeld(20000); out.push({from:a, to:b, at:u, then:back, ...w, ended:c.posture().at, feet:feetOff()}); } }
      return out;
    },
    /* each action in each posture it works in (and on each gait it may run on): the posture must not change */
    actions(o = {}){
      const out = [];
      for(const [name, A] of Object.entries(d.actions)){
        if(o.only && !o.only.includes(name)) continue;
        for(const p of A.in || d.POSTURE_NAMES){
          fresh(); c.go(p); settle(); const f0 = d.NL ? d.IKD.map((_, k) => c.toe(k)) : [];
          c.play(name); const w = watch(A.dur + 600); const info = c.posture(); settle(4000);
          const back = d.NL ? Math.max(...d.IKD.map((_, k) => { const t = c.toe(k); return Math.hypot(t[0] - f0[k][0], t[1] - f0[k][1]); })) : 0;
          out.push({action:name, posture:p, ...w, after:info.at, moved:info.moving || info.at !== p, feetBack:+back.toFixed(2)});
        }
        if(A.gait) for(const g of d.GAIT_ORDER){ fresh(); c.go(g.name); c.advance(2500, 16); c.play(name); const w = watch(A.dur + 400); out.push({action:name, posture:g.name, ...w, after:c.gait ? c.gait.name : 'stopped', moved:!c.gait}); }
      }
      return out;
    },
    /* actions asked for outside their postures go to the nearest posture where they work, and start there */
    routed(){
      const out = [];
      for(const [name, A] of Object.entries(d.actions)){ if(!A.in) continue; const from = d.POSTURE_NAMES.find(p => !A.in.includes(p)); if(!from) continue;
        fresh(); c.go(from); settle(); c.play(name); let t = 0; while(t < 15000 && !c.actions.some(a => a.name === name)){ c.advance(16, 16); t += 16; }
        out.push({action:name, from, started:c.actions.some(a => a.name === name), at:c.posture().at, ms:t}); }
      return out;
    },
    /* every gait run, blended into its neighbours, and stopped */
    gaits(){
      const out = [], G = d.GAIT_ORDER;
      for(const g of G){ fresh(); c.go(g.name); const w = watch(4000); c.stop(g.name); const s = untilHeld(8000); out.push({gait:g.name, ...w, stopMs:s.ms, stopFrameMax:s.frameMax, feet:feetOff()}); }
      for(let i = 0; i + 1 < G.length; i++) for(const [a, b] of [[G[i], G[i + 1]], [G[i + 1], G[i]]]){ fresh(); c.go(a.name); c.advance(2500, 16); c.go(b.name); const w = watch(3500); out.push({gait:a.name + '>' + b.name, ...w}); }
      return out;
    },
    /* each posture held: the feet stay on their places and nothing creeps */
    holds(){ return d.POSTURE_NAMES.map(p => { fresh(); c.go(p); settle(); const t0 = d.NL ? d.IKD.map((_, k) => c.toe(k)) : []; c.advance(3000, 16); const creep = d.NL ? Math.max(...d.IKD.map((_, k) => { const t = c.toe(k); return Math.hypot(t[0] - t0[k][0], t[1] - t0[k][1]); })) : 0; return {posture:p, feet:feetOff(), creep:+creep.toFixed(2), oov:(refreshVis(), outOfView())}; }); },
    /* zoning: the skin effects never reach a zone that does not take them */
    zoning(ms = 3000){
      fresh(); const leaks = new Set(); c.setBeh({style:'burst', rate:6}); refreshVis();
      for(let t = 0; t < ms; t += 16){ c.advance(16, 16); if(t % 400 < 16){ const i = d.FLIPPABLE[(t / 16 | 0) % d.FLIPPABLE.length]; if(i !== undefined) c.burstAt(d.PCX[i], d.PCY[i], 260); } for(const [i] of c.flips) if(d.FW[i] < .3) leaks.add(i); for(const [i] of c.hold) if(d.FW[i] < .3) leaks.add(i); }
      c.setBeh({style:'off'});
      return {leaks:leaks.size, zones:[...new Set([...leaks].map(i => d.parts[d.PPART[i]].zone))]};
    },
    /* random pad and dynamics settings against a gait or an action */
    random(n = 24, seed = 5){
      const R = rng(seed), out = [], pads = d.PAD_ORDER, acts = Object.keys(d.actions);
      for(let k = 0; k < n; k++){
        fresh();
        for(const id of pads){ if(R() < .45) continue; const P = d.pads[id], v = [R() * 2 - 1, R() * 2 - 1]; c.setPad(id, v); if(P.split && R() < .3){ c.pad[id].split = true; c.pad[id].R = [R() * 2 - 1, R() * 2 - 1]; } }
        const useGait = d.GAIT_ORDER.length && R() < .4, what = useGait ? d.GAIT_ORDER[(R() * d.GAIT_ORDER.length) | 0].name : acts[(R() * acts.length) | 0];
        c.advance(600, 16); c.play(what); const w = watch(useGait ? 3500 : Math.min(6000, (d.actions[what] || {dur:3000}).dur + 1500));
        out.push({k, what, pads:Object.fromEntries(pads.filter(id => c.pad[id].L[0] || c.pad[id].L[1]).map(id => [id, c.pad[id].L.map(v => +v.toFixed(2))])), ...w});
      }
      return out;
    },
    /* life on: it must keep moving, visit its postures, and never pop */
    life(ms = 60000, rate = 3){
      fresh(); c.setLife(true, rate); const visits = {}, picks = {}; let last = c.posture().at;
      const w = watch(ms, {each:(cc) => { const p = cc.posture(); if(!p.moving && p.at !== last){ visits[p.at] = (visits[p.at] || 0) + 1; last = p.at; } const L = cc.life; if(L.last && L.at[L.last] === cc.t) picks[L.last] = (picks[L.last] || 0) + 1; }});
      c.setLife(false);
      return {...w, visits, picks};
    },
  };
}
/* ---------- versions ----------
   The kit, the shared engines (creature-body.js, creature-ring.js) and the shared helper (creature-ground.js) each carry a VERSION and a CHANGELOG. A template calls K.require(version) with the version it was
   written against, so a creature copied from it fails loudly on an older kit instead of inheriting a defect that has since been fixed; the page's readout shows the kit's version. */
K.VERSION = '1.3.0';
K.CHANGELOG = [
  {date:'2026-10-20', version:'1.3.0', what:'A creature can be a member of a crew (creature-crew.js). K.mount takes o.crew (the host: it provides habitat, owner and after(c, now, dt)) and o.lifeSmall (life runs the small actions only, never a move between postures). A member\'s camera is fixed at the model\'s own (the host\'s camera is the crew\'s), and the host\'s after() runs at the end of every step, once the member has moved, to place it in the shared world. Inert for every creature mounted without a crew.'},
  {date:'2026-10-19', version:'1.2.0', what:'An environ can grow a figure. M.part takes organ, base and parent (the growable identity); the finished definition exposes them as def.PARTI (with the part order) and def.PARTN (name to index), and c.form(name, [a,b,c,d,e,f]) places one part group (null clears it). The geometry, bones and morphs are untouched, so the hook is inert for every model that declares no organ. First use: the apple tree\'s year (environ-tree.js 1.1.0).'},
  {date:'2026-10-16', version:'1.0.0', what:'The kit as the owner first met it: the lion\'s engine generalised (model builder, posture graph, gait engine, actions, life, pads, probe, morphs, bone scale, followers), the gate and the four templates.'},
  {date:'2026-10-18', version:'1.1.0', what:'Refinement pass. routeTo calls the creature\'s guard(c, target) hook, so a figure can hold a request while it undoes a lasting state (the dragon gives back the tail it has eaten before it leaves the ring). The anatomy view\'s fibres: a muscle with no joint or host hangs on the bone its field lies on, not the root; a muscle that lies on one bone but turns another starts on its own bone; a chain muscle lying far along the chain rides the bone it lies on. M.digits and M.digitMuscles build a foot\'s toes (phalanx bones, claws, pads, muscles) from one call. Muscles that turn an IK leg\'s bones but are not named in mus now fire at half with the solved angle. VERSION, CHANGELOG and require. Gate: o.page, o.persists (actions that leave a lasting state), the anatomy suite (tools/creature-anatomy-audit.mjs).'},
];
K.require = (min, who = 'a creature') => {
  const a = K.VERSION.split('.').map(Number), b = String(min).split('.').map(Number);
  for(let i = 0; i < 3; i++){ if((a[i] || 0) > (b[i] || 0)) return true; if((a[i] || 0) < (b[i] || 0)) throw new Error(who + ' needs creature-kit.js ' + min + ' or later, and this is ' + K.VERSION); }
  return true;
};
K.PROBE = PROBE;
K.pathOf = (id, a, b) => pathOf(typeof id === 'string' ? REG[id] : id, a, b);
window.CreatureKit = K;
})();
