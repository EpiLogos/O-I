/* creature-lion.js — the LION, first of the creature set. The face rig's way of drawing, applied to a whole
   mythological figure. Leo: a lion passant guardant, the head turned full to the viewer inside the sun; the haunch
   and the tail carry the sign ♌ as inlay.
   RENDERING (the face rig's model, faceColours / mask / faceSkinTarget): one ink. skin = mix(ground, wash, .08), line =
   mix(skin, ink, .38). Polygons have no stroke: they are filled with skin and inset from each other, and the lines are the
   gaps, where a backing path in the line colour shows through. A line is as heavy as its gap: big cells (tier L) get heavy
   lines, mid triangulation (M) lighter, the fine tier (F) the thinnest. Ink tone goes only where a feature needs it; all other
   colour is additive and transient (crease ink, flush, flips and holds, bursts, the map view's hues) and fades.
   MESH: three nested tiers. L cells are broad planes (flank, shoulder, haunch, the sun's disc, the forehead and cheeks);
   M triangulates where the form bends (legs, tail, mane); F is fine where expression and articulation happen (eyes, lids,
   muzzle, nose, ears, paws, toes, joints, the lock tips). Fine zones sit on top of the large cells that contain them.
   Plain JS + SVG, no dependencies. API at the bottom: mountCreature(el, opts), creatureRestSvg(opts). */
(() => {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const VW = 1000, VH = 780;

/* ---------- small maths, in the face rig's own form ---------- */
const wrapA = x => { while(x > Math.PI) x -= 2 * Math.PI; while(x < -Math.PI) x += 2 * Math.PI; return x; };
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fSmooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
const lineSet = (v, lo, hi) => fSmooth(lo, hi, v);
const hash = i => { let h = Math.imul((i >>> 0) + 1, 2654435761) >>> 0; h ^= h >>> 15; return (Math.imul(h, 2246822519) >>> 0) / 4294967296; };
const strHash = s => { let h = 2166136261; for(let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const HEX2 = Array.from({length:256}, (_, i) => i.toString(16).padStart(2, '0'));
const hexInt = s => /^#[0-9a-f]{6}$/i.test(s) ? parseInt(s.slice(1), 16) : 0x888888;
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
function segDist(x, y, ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
function pip(P, x, y){
  let c = false;
  for(let i = 0, j = P.length - 1; i < P.length; j = i++){
    const a = P[i], b = P[j];
    if((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
const edgeDist = (P, x, y) => { let d = 1e9; for(let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; d = Math.min(d, segDist(x, y, a[0], a[1], b[0], b[1])); } return d; };

/* ---------- the owner's palette, and the face rig's colour model ---------- */
const ROSTER = {obsidian:'#1A1A2E', bone:'#E8E4D9', cinnabar:'#C44536', lapis:'#2E5A88', malachite:'#3A7D5C', amber:'#D4A03C', umber:'#6B5B4F', gold:'#B8963E'};
const GROUND = '#1b1d20';
/* The lion's ink is Amber. wash only sets the skin's faint tint (skin = mix(ground, wash, .08)). The rest of the roster
   appears additively: flushes, flips and holds, bursts, the map's hues, the glyph's gold. */
function creaturePalette(o = {}){
  const P = {...ROSTER, ...o};
  P.ink = o.ink || ROSTER.amber; P.wash = o.wash || P.ink; P.ground = o.ground || GROUND;
  return P;
}
/* faceColours: skin, line; plus the glyph's gold line and the dim line of the far tier, and the additive colours as ints. */
function creatureColours(P){
  const skin = mixInt(hexInt(P.ground), hexInt(P.wash), .08), ink = hexInt(P.ink), gold = hexInt(P.gold);
  const C = {skin, ink, gold, bone:hexInt(P.bone), cin:hexInt(P.cinnabar), umber:hexInt(P.umber), line:mixInt(skin, mixInt(ink, hexInt(P.bone), .25), .9)};
  C.ls = PARTS.map(part => lineStyle(C, part));
  return C;
}
/* Line hierarchy, as the face rig draws it: three weights that differ clearly.
   CONTOUR (heavy, brightest): the figure's silhouette and the outline of the major masses (rosettes, the head's rim).
   REGION BORDER (medium, mid value): the outline of each region (a flank cell, a leg segment, a cheek, an eye).
   HAIRLINE (about a third of a border, darker, closer to the fill): the gaps between the triangles inside a region.
   Each part's table entry: `k` the hairline's mix toward ink, `c` the border/contour mix, `r` its role ('c' contour, 'b' border, 0 none),
   `t` a nearby roster tone mixed into the ink by `tk`, `bs` a stroke on the backing (the mane's outline). */
const LK = 1;
const LINES = [
  [/^(fore[UL]F|thighF|shinF|footF|pawFF|pawHF|palmFF|palmHF|toeFF|toeHF|clawFF|clawHF)/, {k:.22, c:.4, r:'b'}],
  [/^rib/, {k:.4, c:.6, r:'f', t:'bone', tk:.15}], [/^scapula/, {k:.4, c:.78, r:'b', t:'bone', tk:.2}], [/^(palm|toe)/, {k:.6, c:.8, r:'f'}], [/^claw/, {k:.9, c:1, t:'bone', tk:.6}],
  [/^sunDisc/, {k:.34, c:.55, r:'b'}], [/^sun/, {k:.5, c:.7}], [/^(haunchRing|tailInlay)/, {k:.8, c:.9}],
  [/^faceRim/, {k:.5, c:1, r:'c', t:'bone', tk:.3}], [/^(foreheadC|cheek|faceC)/, {k:.4, c:.62, r:'b'}],
  [/^jaw/, {k:.5, c:.95, r:'b', t:'bone', tk:.3}], [/^(eye|lid)/, {k:.62, c:1, r:'b', t:'bone', tk:.38}],
  [/^nose/, {k:.6, c:1, r:'b', t:'bone', tk:.32}], [/^(pad|bridge)/, {k:.55, c:.95, r:'b', t:'bone', tk:.22}], [/^(nostril|spot|whisk)/, {k:.6, c:.8}],
  [/^(cavity|tongue|can|inc)/, {k:.4, c:.6, t:'cin', tk:.4}], [/^ear/, {k:.5, c:.9, r:'b', t:'bone', tk:.2}],
  [/^maneB/, {k:.4, c:.95, bs:3.2, t:'bone', tk:.3}], [/^maneM/, {k:.5, c:.62}], [/^maneF/, {k:.8, c:.88, t:'bone', tk:.1}], [/^maneU/, {k:.34, c:.46, t:'umber', tk:.3}],
  [/^torso/, {k:.62, c:.84, r:'b', t:'bone', tk:.18}], [/^(shouldN|haunchN)/, {k:.62, c:1, r:'c', t:'bone', tk:.3}],
  [/^(fore[UL]N|thighN|shinN|footN)/, {k:.62, c:.88, r:'b', t:'bone', tk:.2}],
  [/^j[A-Z]/, {k:.6, c:.9, r:'b', t:'bone', tk:.3}], [/^paw/, {k:.62, c:.88, r:'b'}], [/^(tail|tuft)/, {k:.6, c:.86, r:'b'}],
];
function lineStyle(C, P){
  const L = (LINES.find(l => l[0].test(P.name)) || [0, {k:.5, c:.85}])[1], base = P.ink === 'gold' ? C.gold : C.ink, tint = {bone:C.bone, cin:C.cin, umber:C.umber}[L.t];
  const ink = tint ? mixInt(base, tint, L.tk) : base;
  return {fill:mixInt(C.skin, ink, L.k * LK), stroke:mixInt(C.skin, ink, L.c), role:L.r || 0, bs:L.bs || 0};
}
/* The three tiers: the gap between polygons (the line's weight) and the weight of a cell's own outline. User units of the 1000-wide canvas. */
const TIERS = [{gap:3.2, back:5.4}, {gap:1.9, back:3.2}, {gap:1.05, back:1.8}], TI = {L:0, M:1, F:2};

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

/* ---------- the model: vertices, parts, polygons ---------- */
const HS = .84, HC = [742, 252], MC = [738, 262];          // the head's scale and centre; the mane's centre
const FAR = {fore:[52, -6], hind:[60, -4]};                 // the far legs stand forward of the near ones
const VX = [], VY = [], VZ = [], VYAW = [], VP = [];        // rest vertices (world), depth, whether yaw moves them, owning part
const PV = [], PPART = [], PTIER = [];                      // polygons: vertex ids, owning part, tier (0 L, 1 M, 2 F)
const PARTS = [];
const hw = ([x, y]) => [HC[0] + HS * x, HC[1] + HS * y];
const hz = (x, y) => 78 * Math.sqrt(Math.max(0, 1 - (x / 138) ** 2 - ((y + 8) / 156) ** 2));   // the head's dome, head units
const sym = half => half.map(p => [p[0], p[1]]).concat(half.slice().reverse().filter(p => p[0] !== 0).map(([x, y]) => [-x, y]));
const mirror = P => P.map(([x, y]) => [2 * HC[0] - x, y]).reverse();
const shift = (P, dx, dy) => P.map(([x, y]) => [x + dx, y + dy]);
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
/* An outline from stations [x, y, back, front]: the width either side of a centreline, smoothed. Limbs and tail. */
function limbOutline(S, smooth = 2){
  const L = [], R = [];
  S.forEach((s, i) => {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    L.push([s[0] - ty * s[2], s[1] + tx * s[2]]); R.push([s[0] + ty * s[3], s[1] - tx * s[3]]);
  });
  return chaikin(L.concat(R.reverse()), smooth);
}
/* A part: its tier, the ink it takes (ink or gold), whether it is the dim far tier, which muscles' fields may reach it (tags). */
function addPart(name, o){
  const p = {name, layer:o.layer ?? 5, tags:new Set(o.tags || []), tier:TI[o.tier || 'M'], ptier:TI[o.ptier || o.tier || 'M'], ink:o.ink || 'ink', dim:!!o.dim, flush:o.flush || 0, flip:o.flip ?? 1,
    show:o.show, open:false, bind:o.bind, yaw:!!o.yaw, v0:VX.length, p0:PV.length, locks:o.locks, order:PARTS.length, bias:o.bias || 0, tj:o.tj ?? .04, nosil:!!o.nosil};
  p.tags.add(name); PARTS.push(p); return p;
}
function vtx(p, x, y, z = 0, yaw = 0){ VX.push(x); VY.push(y); VZ.push(z); VYAW.push(yaw); VP.push(p.order); return VX.length - 1; }
function poly(p, ids, tier){ PV.push(ids); PPART.push(p.order); PTIER.push(tier ?? p.ptier); }
function close(p){ p.v1 = VX.length; p.p1 = PV.length; return p; }
const TIER_H = [60, 30, 10];  // default facet size by tier
/* The near forearm and the near hind foot (with their paws and wrist and hock patches) are drawn above the mane and the face, always: a paw raised to the muzzle (lick, wipe) or a hind foot brought to the neck (scratch) is
   in front of the mane and the face, while the upper arm and the thigh stay under the shoulder and haunch rosettes and the mane's drape. Round 8 toggled the whole limb to the top when the paw rose, and half the limb's
   polygons (10 to 21 of 45, measured in Round 9) changed their cover at that moment: a pop. The lower limb never overlaps the mane or the face in any other posture or gait (0 of 30 polygons; the crouch's folded forearm 5). */
const LAYER_LOWER = 14.5;
/* Even sampling. A closed outline is cut into runs at its corners (turns over 55 degrees) and each run is sampled at equal arc length,
   so the boundary points are evenly spaced and the outline is as smooth as the authored curve. */
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
/* Chaikin that keeps pinned corners: the cells of one group share corner points, so those stay where they are and the runs between them are smoothed. */
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
/* Smooth a group of cells that share corners: a corner used by two or more cells is pinned. */
function smoothCells(polys, n = 2){
  const cnt = new Map(); polys.forEach(P => P.forEach(p => cnt.set(pkey(p), (cnt.get(pkey(p)) || 0) + 1)));
  return polys.map(P => chaikinPinned(P, p => cnt.get(pkey(p)) > 1, n));
}
/* A zone: a hand-placed outline filled with well-shaped triangles of size h. The outline is sampled evenly at about h; interior points start on
   a hex lattice and are relaxed toward the centroids of their triangles (a few Lloyd steps) before the Delaunay pass that makes the polygons,
   so edge cells and interior cells are the same size and there are no slivers. A zone's tier says how big a cell it wants. */
function zone(name, outline, o = {}){
  const P = addPart(name, o), h = o.h || TIER_H[P.tier], s = h * (o.bs ?? .95);
  const B = evenOutline(outline, s), nB = B.length, pts = B.slice();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const [x, y] of B){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const inset = Math.max(.72 * s, h * (o.inset ?? .6)), dy = h * .866;
  for(let r = 0, y = y0 + dy * .5; y < y1; y += dy, r++) for(let x = x0 + (r & 1 ? h * .5 : 0) + h * .25; x < x1; x += h)
    if(pip(B, x, y) && edgeDist(B, x, y) > inset) pts.push([x, y]);
  for(let it = 0; it < (o.relax ?? 4) && pts.length > nB; it++){
    const T = delaunay(pts), sx = new Float64Array(pts.length), sy = new Float64Array(pts.length), sa = new Float64Array(pts.length);
    for(const t of T){
      const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]], cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
      if(!pip(B, cx, cy)) continue;
      const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
      for(const v of t){ sx[v] += cx * ar; sy[v] += cy * ar; sa[v] += ar; }
    }
    for(let i = nB; i < pts.length; i++) if(sa[i] > 0){ const q = [sx[i] / sa[i], sy[i] / sa[i]]; if(pip(B, q[0], q[1]) && edgeDist(B, q[0], q[1]) > inset * .9) pts[i] = q; }
  }
  const zf = o.z || (() => 0), ya = o.yaw ? 1 : 0;
  const ids = pts.map(([x, y]) => vtx(P, x, y, zf(x, y), ya));
  const adj = (i, j) => i < nB && j < nB && (Math.abs(i - j) === 1 || Math.abs(i - j) === nB - 1);
  for(const t of delaunay(pts)){
    const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
    if(Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2 < h * h * .05) continue;
    if(!pip(B, (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3)) continue;
    let bad = false;
    for(const [i, j] of [[0, 1], [1, 2], [0, 2]]){ const u = t[i], v = t[j]; if(u < nB && v < nB && !adj(u, v) && !pip(B, (pts[u][0] + pts[v][0]) / 2, (pts[u][1] + pts[v][1]) / 2)) bad = true; }
    if(bad) continue;
    poly(P, [ids[t[0]], ids[t[1]], ids[t[2]]]);
  }
  P.loop = ids.slice(0, nB);
  return close(P);
}
function resampleOpen(Q, n){   // n+1 points at equal arc length along an open polyline
  const L = [0]; for(let i = 1; i < Q.length; i++) L.push(L[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]));
  const out = []; let k = 1;
  for(let q = 0; q <= n; q++){
    const d = L[L.length - 1] * q / n; while(k < Q.length - 1 && L[k] < d) k++;
    const t = (d - L[k - 1]) / ((L[k] - L[k - 1]) || 1); out.push([Q[k - 1][0] + (Q[k][0] - Q[k - 1][0]) * t, Q[k - 1][1] + (Q[k][1] - Q[k - 1][1]) * t]);
  }
  return out;
}
/* A limb or tail region as a strip mesh. The centreline (with its widths) is smoothed and sampled densely; each region of a limb takes the
   stretch between two of its joints and cuts it at equal spacing, perpendicular to the centreline, so the cells are near-square, the outline is
   a smooth curve, and neighbouring regions share the cross-section at their joint. Cells are cut into triangles on alternating diagonals. */
function chaikin4(P, n){   // open Chaikin on [x, y, a, b] vectors, ends kept
  for(let k = 0; k < n; k++){
    const Q = [P[0]];
    for(let i = 0; i < P.length - 1; i++){ const a = P[i], b = P[i + 1]; Q.push(a.map((v, j) => v * .75 + b[j] * .25), a.map((v, j) => v * .25 + b[j] * .75)); }
    Q.push(P[P.length - 1]); P = Q;
  }
  return P;
}
function limbDense(S){
  const C = chaikin4(S, 3), cum = [0]; for(let i = 1; i < C.length; i++) cum.push(cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
  const N = Math.max(8, Math.round(cum[cum.length - 1] / 3)), D = []; let k = 1;
  for(let q = 0; q <= N; q++){
    const d = cum[cum.length - 1] * q / N; while(k < C.length - 1 && cum[k] < d) k++;
    const t = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1); D.push(C[k - 1].map((v, j) => v + (C[k][j] - v) * t));
  }
  D.forEach((p, i) => { const a = D[Math.max(0, i - 1)], b = D[Math.min(D.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; p.push(-ty / l, tx / l); });   // p[4], p[5]: the left normal
  return D;
}
function limbMesh(name, S, o = {}){
  const P = addPart(name, o), h = o.h || TIER_H[P.tier], D = limbDense(S), [r0, r1] = o.range || [0, S.length - 1];
  const near = st => { let bi = 0, bd = 1e9; D.forEach((p, i) => { const d = Math.hypot(p[0] - st[0], p[1] - st[1]); if(d < bd){ bd = d; bi = i; } }); return bi; };
  const iA = r0 === 0 ? 0 : near(S[r0]), iB = r1 === S.length - 1 ? D.length - 1 : near(S[r1]), seg = D.slice(iA, iB + 1);
  const cum = [0]; for(let i = 1; i < seg.length; i++) cum.push(cum[i - 1] + Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]));
  const meanW = seg.reduce((a, p) => a + p[2] + p[3], 0) / seg.length, cols = o.cols ?? Math.max(1, Math.round(meanW / h)), cellW = meanW / cols;
  const rows = Math.max(1, Math.round(cum[cum.length - 1] / cellW)), zf = o.z || (() => 0), grid = []; let k = 1;
  for(let i = 0; i <= rows; i++){
    const d = cum[cum.length - 1] * i / rows; while(k < seg.length - 1 && cum[k] < d) k++;
    const t = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1), q = seg[k - 1].map((v, j) => v + (seg[k][j] - v) * t), nl = Math.hypot(q[4], q[5]) || 1, row = [];
    for(let j = 0; j <= cols; j++){ const u = j / cols, off = q[2] - (q[2] + q[3]) * u, x = q[0] + q[4] / nl * off, y = q[1] + q[5] / nl * off; row.push(vtx(P, x, y, zf(x, y), 0)); }
    grid.push(row);
  }
  for(let i = 0; i < rows; i++) for(let j = 0; j < cols; j++){
    const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j + 1], d = grid[i + 1][j];
    if((i + j) & 1){ poly(P, [a, b, c]); poly(P, [a, c, d]); } else { poly(P, [a, b, d]); poly(P, [b, c, d]); }
  }
  P.loop = [...grid.map(r => r[0]), ...grid[rows].slice(1), ...grid.map(r => r[cols]).reverse().slice(1), ...grid[0].slice(0, -1).reverse().slice(0, -1)];
  return close(P);
}
/* A rim: an outline with no fill, drawn as a heavy line (the head's contour inside the mane). */
function rim(name, outline, o = {}){
  const P = addPart(name, o), B = evenOutline(outline, o.s || 10), zf = o.z || (() => 0), ya = o.yaw ? 1 : 0;
  P.loop = B.map(([x, y]) => vtx(P, x, y, zf(x, y), ya)); return close(P);
}
function ringPts(c, r, n, a0 = 0, sx = 1){ return Array.from({length:n}, (_, i) => [c[0] + Math.cos(a0 + i * 2 * Math.PI / n) * r * sx, c[1] + Math.sin(a0 + i * 2 * Math.PI / n) * r]); }
/* A polar mesh: rings [r…] with sectors [n…] per ring (rings[0] may be 0, a single centre vertex). Quads where counts match, triangles otherwise. */
function polar(name, c, rings, sectors, o = {}){
  const P = addPart(name, o), z = o.z || (() => 0), ya = o.yaw ? 1 : 0, tw = o.twist || 0, R = rng(strHash(name));
  const lv = rings.map((r, k) => {
    if(r === 0) return [vtx(P, c[0], c[1], z(c[0], c[1]), ya)];
    const n = sectors[rings[0] === 0 ? k - 1 : k], a0 = tw * k + (o.jit ? (R() - .5) * o.jit : 0);
    return ringPts(c, r, n, a0).map(([x, y]) => vtx(P, x + (o.jit ? (R() - .5) * o.jit * r * .12 : 0), y, z(x, y), ya));
  });
  for(let k = 0; k + 1 < lv.length; k++){
    const A = lv[k], Bq = lv[k + 1], m = A.length, n = Bq.length;
    if(m === 1){ for(let j = 0; j < n; j++) poly(P, [A[0], Bq[j], Bq[(j + 1) % n]]); continue; }
    if(m === n){ for(let j = 0; j < n; j++) poly(P, [A[j], Bq[j], Bq[(j + 1) % n], A[(j + 1) % m]]); continue; }
    let i = 0, j = 0;
    while(i < m || j < n){
      const advA = j >= n || (i < m && (i + 1) / m <= (j + 1) / n + 1e-9);
      if(advA && i < m){ poly(P, [A[i % m], A[(i + 1) % m], Bq[j % n]]); i++; } else { poly(P, [A[i % m], Bq[j % n], Bq[(j + 1) % n]]); j++; }
    }
  }
  const last = lv[lv.length - 1]; P.loop = last.length > 2 ? last : [];
  return close(P);
}
/* A strip of quads along a polyline of stations [x, y, halfwidth]. The inlay. */
function strip(name, S, o = {}){
  const P = addPart(name, o);
  const lv = S.map((s, i) => {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    return [vtx(P, s[0] - ty * s[2], s[1] + tx * s[2]), vtx(P, s[0] + ty * s[2], s[1] - tx * s[2])];
  });
  for(let i = 0; i + 1 < lv.length; i++) poly(P, [lv[i][0], lv[i + 1][0], lv[i + 1][1], lv[i][1]]);
  return close(P);
}
/* An ordinary small polygon (a tooth, a spot, a whisker) from hand-placed points. */
function shape(name, pts, o = {}){
  const P = addPart(name, o), zf = o.z || (() => 0), ya = o.yaw ? 1 : 0;
  const ids = pts.map(([x, y]) => vtx(P, x, y, zf(x, y), ya));
  if(pts.length === 4 && o.split){ poly(P, [ids[0], ids[1], ids[2]]); poly(P, [ids[0], ids[2], ids[3]]); } else poly(P, ids);
  P.loop = ids;
  return close(P);
}

/* ---------- the skeleton ---------- */
const BONES = [], BI = {};
function bone(name, parent, p, q){ BI[name] = BONES.length; BONES.push({name, parent:parent ? BI[parent] : -1, p, q, len:Math.hypot(q[0] - p[0], q[1] - p[1])}); }
const J = {  // joints, world rest
  body:[420, 405], pelvisT:[236, 398], chestT:[620, 392], neckP:[610, 390], neckT:[730, 336], headT:[742, 252],
  scap:[[556, 350], [594, 432]], hum:[[594, 432], [600, 526]], rad:[[600, 526], [612, 640]], hand:[[612, 640], [640, 742]],
  fem:[[266, 418], [306, 516]], tib:[[306, 516], [240, 626]], foot:[[240, 626], [266, 742]],
};
/* the tail's centreline: a smooth curve that rises off the haunch, arches over the back, drops and curls into the loop */
const TAIL_PTS = [[268, 360, 17], [238, 326, 15.6], [202, 282, 14.2], [186, 226, 13], [206, 172, 12], [252, 140, 11], [310, 134, 10.2], [362, 150, 9.4], [394, 190, 8.6], [388, 236, 7.8], [354, 258, 7], [322, 240, 6.4], [326, 206, 5.8]];   // the tail tapers to a slim tip
const TAIL_SPLINE = (() => {   // Catmull–Rom through the stations, sampled densely
  const S = [], P = TAIL_PTS, n = P.length;
  for(let i = 0; i < n - 1; i++){
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
    for(let k = 0; k < 12; k++){
      const t = k / 12, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      S.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  S.push(P[n - 1]); return S;
})();
const TAIL_J = (() => {   // eight bones along the spline, equal in length
  const S = TAIL_SPLINE, L = [0]; for(let i = 1; i < S.length; i++) L.push(L[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
  const tot = L[L.length - 1], Jn = [];
  for(let k = 0; k <= 8; k++){ const d = tot * k / 8; let i = 1; while(i < L.length - 1 && L[i] < d) i++; const t = (d - L[i - 1]) / (L[i] - L[i - 1] || 1); Jn.push([S[i - 1][0] + (S[i][0] - S[i - 1][0]) * t, S[i - 1][1] + (S[i][1] - S[i - 1][1]) * t]); }
  return Jn;
})();
(() => {
  bone('body', null, J.body, [J.body[0] + 1, J.body[1]]);
  bone('pelvis', 'body', J.body, J.pelvisT); bone('chest', 'body', J.body, J.chestT);
  bone('neck', 'chest', J.neckP, J.neckT); bone('head', 'neck', J.neckT, J.headT);
  bone('jaw', 'head', [742, 270], [742, 330]);
  bone('earR', 'head', hw([84, -100]), hw([112, -128])); bone('earL', 'head', hw([-84, -100]), hw([-112, -128]));
  bone('sun', 'head', [742, 256], [742, 40]);
  for(let k = 0; k < 8; k++) bone('t' + k, k ? 't' + (k - 1) : 'pelvis', TAIL_J[k], TAIL_J[k + 1]);
  bone('tuftB', 't7', TAIL_J[8], [TAIL_J[8][0], TAIL_J[8][1] - 60]);   // the tuft hangs from the tail's end on its own bone, so it can follow through
  for(const s of ['N', 'F']){
    const f = s === 'F' ? FAR.fore : [0, 0], h = s === 'F' ? FAR.hind : [0, 0];
    const mv = ([a, b]) => [[a[0] + f[0], a[1] + f[1]], [b[0] + f[0], b[1] + f[1]]], mh = ([a, b]) => [[a[0] + h[0], a[1] + h[1]], [b[0] + h[0], b[1] + h[1]]];
    const sc = mv(J.scap), hu = mv(J.hum), ra = mv(J.rad), ha = mv(J.hand), fe = mh(J.fem), ti = mh(J.tib), fo = mh(J.foot);
    bone('scap' + s, 'chest', sc[0], sc[1]); bone('hum' + s, 'scap' + s, hu[0], hu[1]); bone('rad' + s, 'hum' + s, ra[0], ra[1]); bone('hand' + s, 'rad' + s, ha[0], ha[1]);
    bone('toeF' + s, 'hand' + s, [ha[1][0] + 2, ha[1][1] - 2], [ha[1][0] + 2, ha[1][1] + 22]);   // the digits: they turn at the knuckle under the palm, curling in the swing and pushing off at the end of the stance; the claws ride on this bone
    bone('fem' + s, 'pelvis', fe[0], fe[1]); bone('tib' + s, 'fem' + s, ti[0], ti[1]); bone('foot' + s, 'tib' + s, fo[0], fo[1]);
    bone('toeH' + s, 'foot' + s, [fo[1][0] + 2, fo[1][1] - 2], [fo[1][0] + 2, fo[1][1] + 22]);
  }
})();
const NB = BONES.length;

/* ---------- the figure ---------- */
// the torso's outline points, named; the cells are cut between them (deep chest, high withers, tucked waist)
const TP = {t0:[650, 318], t1:[600, 312], t2:[548, 320], t3:[496, 336], t4:[444, 350], t5:[392, 356], t6:[342, 348], t7:[294, 336], t8:[250, 328], r0:[220, 342], r1:[202, 376], r2:[198, 414], r3:[206, 456], r4:[230, 478],
  b0:[272, 486], b1:[322, 470], b2:[366, 452], b3:[410, 458], b4:[456, 480], b5:[506, 510], b6:[556, 536], b7:[610, 546], c0:[654, 536], c1:[682, 498], c2:[692, 430], c3:[682, 366],
  s1:[556, 430], s2:[386, 420], h1:[338, 412]};
const CELLS = {  // the large drawing cells of the flank: shoulder and chest, ribs, loin, rump
  torsoA:['t0', 't1', 't2', 's1', 'b6', 'b7', 'c0', 'c1', 'c2', 'c3'], torsoB:['t2', 't3', 't4', 't5', 's2', 'b3', 'b4', 'b5', 'b6', 's1'],
  torsoC:['t6', 't5', 's2', 'b3', 'b2', 'b1', 'h1'], torsoD:['t8', 't7', 't6', 'h1', 'b1', 'b0', 'r4', 'r3', 'r2', 'r1', 'r0']};
const LEG = {
  fore:[[592, 408, 54, 52], [598, 462, 48, 48], [602, 520, 48, 40], [609, 570, 32, 30], [613, 620, 26, 25], [619, 672, 25, 26], [626, 712, 26, 28], [632, 732, 29, 36]],
  hind:[[266, 410, 58, 64], [282, 452, 56, 62], [304, 498, 48, 42], [290, 540, 38, 38], [266, 584, 34, 34], [240, 626, 42, 28], [246, 672, 25, 25], [256, 712, 25, 29], [264, 734, 29, 37]],
};
for(const k of ['fore', 'hind']) LEG[k] = LEG[k].map(([x, y, a, b]) => [x, y, a * 1.12, b * 1.12]);   // heavier limbs
const PAW0 = {
  fore:[[606, 714], [634, 706], [664, 718], [682, 738], [684, 750], [672, 756], [658, 750], [646, 758], [632, 750], [618, 758], [604, 750], [598, 734]],
  hind:[[226, 710], [252, 702], [284, 714], [300, 736], [302, 750], [290, 756], [276, 750], [262, 758], [248, 750], [234, 758], [220, 750], [216, 734]],
};
const PAW = {fore:chaikin(PAW0.fore, 2), hind:chaikin(PAW0.hind, 2)};   // toes are rounded lobes, not a sawtooth
/* the mane's tips run longer toward the shoulder (lower left), shorter above */
const maneTip = (a, base) => base + 14 * Math.sin(3 * a + 1.1) + 60 * Math.max(0, Math.cos(a - 2.3)) ** 1.3 + 14 * Math.max(0, Math.sin(a));
/* A row of mane locks: a shared base ring, then each lock is one mid-tier quad and a fine-tier tip cut into three. */
function mane(name, o){
  const P = addPart(name, {layer:o.layer, tags:['head', 'mane'], yaw:true, flip:1, tier:'M', tj:.05}), N = o.N, R = rng(strHash(name));
  const pol = (a, r) => [MC[0] + Math.cos(a) * r, MC[1] + Math.sin(a) * r];
  const zz = -o.depth, base = [];
  for(let j = 0; j < N; j++){ const [x, y] = pol(o.off + (j - .5) * 2 * Math.PI / N, o.rb); base.push(vtx(P, x, y, zz, 1)); }
  P.locks = [];
  for(let j = 0; j < N; j++){
    const a0 = o.off + j * 2 * Math.PI / N, pitch = 2 * Math.PI / N, tipR = maneTip(a0, o.tip) * (.9 + .2 * R()), sw = o.sweep * (.7 + .6 * R());
    const mr = o.rb + (tipR - o.rb) * .42, mw = pitch * .56;
    const ml = vtx(P, ...pol(a0 - mw + sw * .5, mr), zz, 1), mrv = vtx(P, ...pol(a0 + mw + sw * .5, mr), zz, 1);
    const tv = vtx(P, ...pol(a0 + sw, tipR), zz, 1);
    const cx = (VX[ml] + VX[mrv] + VX[tv]) / 3, cy = (VY[ml] + VY[mrv] + VY[tv]) / 3, tc = vtx(P, cx, cy, zz, 1);
    const b0 = base[j], b1 = base[(j + 1) % N], first = PV.length;
    poly(P, [b0, b1, mrv, ml]);
    poly(P, [ml, mrv, tc], 2); poly(P, [mrv, tv, tc], 2); poly(P, [tv, ml, tc], 2);
    const ids = []; for(let q = first; q < PV.length; q++) ids.push(q); P.locks.push(ids);
  }
  return close(P);
}
function polyline(name, pts, o = {}){
  const P = addPart(name, o), ids = pts.map(([x, y]) => vtx(P, x, y, 0, 0)); P.loop = ids; P.open = true; return close(P);
}
/* A paw: the dorsal base and the palm pad ride on the hand or foot bone; the three toes and the claws ride on the digit bone below it (toeF or toeH), which turns at the
   knuckle, so the toes curl in the swing and press off at the end of the stance while the paw's block rolls on the wrist. The claws are always drawn and always where the
   toe is: retracted they are a sliver inside the toe's lobe, under it in the draw order (the sheath); the claw protractor (flexor digitorum profundus) draws each out to its full
   length, so a claw grows out of its toe and never pops into view. Placed on the hand or foot bone's tip; far paws are shifted. */
const CLAW_FULL = (x, y) => [[x - 4, y + 7], [x + 4, y + 7], [x + 3, y + 22]], CLAW_SHEATH = (x, y) => [[x - 2.5, y - 1], [x + 2.5, y - 1], [x, y + 2]];
function paw(id, kind, side, off, o){
  const bone = kind === 'fore' ? 'hand' + side : 'foot' + side, tbn = kind === 'fore' ? 'toeF' + side : 'toeH' + side, tip = BONES[BI[bone]].q, X = tip[0], Y = tip[1];
  const at = pts => pts.map(([x, y]) => [X + x, Y + y]), tg = n => [kind, side, n], base = {layer:o.layer, dim:o.dim, tier:'F'}, b = {...base, bind:{rigid:bone}}, bt = {...base, bind:{rigid:tbn}};
  zone('paw' + id, chaikin(at([[-30, -26], [-14, -38], [14, -40], [36, -30], [46, -14], [38, -2], [18, 2], [-10, 2], [-30, -6]]), 1), {...b, h:20, tags:tg('paw')});
  zone('palm' + id, at(ringPts([4, -1], 13, 10, 0, 1.6)), {...b, h:13, tags:tg('paw')});
  const TOES = [[-24, 12], [2, 16], [28, 12]];
  TOES.forEach(([x, y], i) => { const sh = shape('claw' + id + i, at(CLAW_SHEATH(x, y)), {...bt, tags:tg('claw'), nosil:true}); sh.full = at(CLAW_FULL(x, y)); });   // under the toe lobes in the draw order
  TOES.forEach(([x, y], i) => zone('toe' + id + i, at(ringPts([x, y], 9, 9, 0, 1.25)), {...bt, h:10, inset:.35, tags:tg('toe')}));
}
function build(){
  const hd = (name, half, o) => zone(name, sym(half).map(hw), {tags:['head', 'face'], yaw:true, ...o});
  const hp = (name, poly, o) => { zone(name + 'R', poly.map(hw), {tags:['head', 'face', 'R'], yaw:true, ...o}); zone(name + 'L', mirror(poly.map(hw)), {tags:['head', 'face', 'L'], yaw:true, ...o}); };
  const zh = (off = 0, extra) => (x, y) => { const u = (x - HC[0]) / HS, v = (y - HC[1]) / HS; return (hz(u, v) + off + (extra ? extra(u, v) : 0)) * HS; };
  const lip = [[0, 71], [14, 83], [30, 91], [48, 91], [66, 85], [80, 77]];
  const LIPS = lip.slice().reverse();
  const padZ = zh(0, (u, v) => 30 * Math.exp(-((u / 70) ** 2 + ((v - 46) / 40) ** 2)));
  const SC = [742, 256];

  // 0 the sun: disc (large cells), ring, rays — the solar half of the glyph layer, inked in gold leaf
  polar('sunDisc', SC, [0, 110, 218], [7, 13], {layer:0, tier:'L', ink:'gold', tags:['sun', 'glyph'], bind:{rigid:'sun'}, twist:.12, flip:.5});
  polar('sunRing', SC, [214, 232], [30, 30], {layer:1, tier:'M', ink:'gold', tags:['sun', 'glyph'], bind:{rigid:'sun'}, flip:.8, tj:0});
  { const P = addPart('sunRays', {layer:1, tier:'M', ink:'gold', tags:['sun', 'glyph'], bind:{rigid:'sun'}, flip:.8});
    for(let j = 0; j < 20; j++){ const a = j * Math.PI / 10 + .03, w = .055, r0 = 232, r1 = j % 2 ? 246 : 258, p = (aa, r) => vtx(P, SC[0] + Math.cos(aa) * r, SC[1] + Math.sin(aa) * r); poly(P, [p(a - w, r0), p(a + w, r0), p(a, r1)]); }
    close(P); }
  // 1 far legs: the dim tier
  { const d = FAR.fore, e = FAR.hind;
    { const st = LEG.fore.map(q => [q[0] + d[0], q[1] + d[1], q[2], q[3]]), cm = {layer:2, h:40, dim:true, bind:{chain:['humF', 'radF', 'handF'], sigma:22}, tags:['fore', 'F', 'leg']};
      limbMesh('foreUF', st, {...cm, range:[0, 3]}); limbMesh('foreLF', st, {...cm, range:[3, st.length - 1]}); }
    { const st = LEG.hind.map(q => [q[0] + e[0], q[1] + e[1], q[2], q[3]]), cm = {layer:2, h:40, dim:true, bind:{chain:['femF', 'tibF', 'footF'], sigma:24}, tags:['hind', 'F', 'leg']};
      limbMesh('thighF', st, {...cm, range:[0, 2]}); limbMesh('shinF', st, {...cm, range:[2, 5]}); limbMesh('footF', st, {...cm, range:[5, st.length - 1]}); }
    paw('FF', 'fore', 'F', d, {layer:2, dim:true});
    paw('HF', 'hind', 'F', e, {layer:2, dim:true}); }
  // 2 tail, behind the body; the tuft is fine
  limbMesh('tail', TAIL_PTS.map(([x, y, r]) => [x, y, r, r]), {layer:3, h:25, cols:1, tags:['tail'], bind:{chain:['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'], sigma:34}});
  { const E = TAIL_J[8], tuftShape = [[-6, 4], [-14, -14], [-17, -36], [-11, -58], [-3, -82], [4, -112], [9, -80], [15, -56], [18, -34], [14, -14], [7, 4]].map(([x, y]) => [E[0] + x, E[1] + y]);
    zone('tuft', chaikin(tuftShape, 2), {layer:3, tier:'F', h:11, inset:.4, tags:['tail', 'tuft'], bind:{rigid:'tuftB'}}); }
  // 3 the torso: four large cells
  { const nms = Object.keys(CELLS), sm = smoothCells(nms.map(k => CELLS[k].map(n => TP[n])), 2);   // the flank's cells share corners, so the outline between them is one smooth curve
    nms.forEach((nm, i) => zone(nm, sm[i], {layer:4, tier:'L', ptier:'M', h:34, tags:['torso'], bind:{chain:['pelvis', 'chest'], sigma:70, blade:{bone:'scapN', k:.7, r0:30, r1:85}}})); }
  // 4 the near legs (mid) with fine paws and fine patches at the joints
  { const cm = {layer:5, h:28, tags:['fore', 'N', 'leg'], bind:{chain:['humN', 'radN', 'handN'], sigma:22}};
    limbMesh('foreUN', LEG.fore, {...cm, range:[0, 3]}); limbMesh('foreLN', LEG.fore, {...cm, layer:LAYER_LOWER, range:[3, LEG.fore.length - 1]}); }
  { const cm = {layer:5, h:28, tags:['hind', 'N', 'leg'], bind:{chain:['femN', 'tibN', 'footN'], sigma:24}};
    limbMesh('thighN', LEG.hind, {...cm, range:[0, 2]}); limbMesh('shinN', LEG.hind, {...cm, range:[2, 5]}); limbMesh('footN', LEG.hind, {...cm, layer:LAYER_LOWER, range:[5, LEG.hind.length - 1]}); }
  paw('FN', 'fore', 'N', [0, 0], {layer:LAYER_LOWER});
  paw('HN', 'hind', 'N', [0, 0], {layer:LAYER_LOWER});
  // the joints as anatomy: the elbow's point, the wrist's pad, the kneecap, the hock's point
  for(const [nm, pts, tg, ch] of [
    ['jElbow', [[596, 514], [606, 520], [606, 538], [596, 548], [574, 542], [564, 528]], 'fore', ['humN', 'radN']],
    ['jWrist', ringPts([598, 644], 10, 8, .3, .8), 'fore', ['radN', 'handN']],
    ['jStifle', ringPts([322, 510], 14, 9, .2), 'hind', ['femN', 'tibN']],
    ['jHock', [[250, 610], [252, 634], [240, 648], [222, 642], [204, 618], [214, 604]], 'hind', ['tibN', 'footN']]])
    zone(nm, pts, {layer:nm === 'jWrist' || nm === 'jHock' ? LAYER_LOWER : 5, tier:'F', h:12, tags:[tg, 'N', 'leg'], bind:{chain:ch, sigma:20}});
  // the ribcage and the shoulder blade, drawn as line work over the flank's cells: they move with the breath and the stride
  { const belly = x => { const B = [[322, 470], [366, 452], [410, 458], [456, 480], [506, 510], [556, 536], [610, 546]]; for(let k = 0; k < B.length - 1; k++) if(x <= B[k + 1][0]) return B[k][1] + (B[k + 1][1] - B[k][1]) * (x - B[k][0]) / (B[k + 1][0] - B[k][0]); return 546; };
    for(let q = 0; q < 7; q++){ const x = 446 + q * 17, y1 = 364 + (x - 446) * .1, xe = x - 34, ye = belly(xe) - 14; polyline('rib' + q, chaikin([[x, y1], [x - 4, y1 + (ye - y1) * .35], [x - 14, y1 + (ye - y1) * .7], [xe, ye]], 2, false), {layer:4, tags:['torso'], bind:{chain:['pelvis', 'chest'], sigma:70, blade:{bone:'scapN', k:.7, r0:30, r1:85}}}); } }
  rim('scapula', chaikin([[552, 346], [592, 352], [614, 394], [604, 436], [576, 424], [556, 382]], 2), {layer:4, tags:['torso'], bind:{mix:[['chest', .3], ['scapN', .7]]}, s:12});
  // 5 the rosettes over the shoulder and haunch: large planes that hide the leg tops and carry the muscles' bulge
  polar('shouldN', [596, 428], [0, 46, 92], [6, 12], {layer:6, tier:'L', tags:['fore', 'N', 'plate'], bind:{mix:[['chest', .35], ['scapN', .65]]}, twist:.26});
  polar('haunchN', [268, 418], [0, 49, 98], [6, 12], {layer:6, tier:'L', tags:['hind', 'N', 'plate'], bind:{chain:['pelvis', 'femN'], sigma:44}, twist:.26});
  // 6 the mane: an underlay, then three rows of locks, all behind the face
  zone('maneU', ringPts(MC, 150, 22), {layer:7, tier:'F', ptier:'M', h:46, inset:.4, tags:['head', 'mane'], yaw:true, z:() => -52, flip:1});
  mane('maneB', {layer:7, N:24, off:.05, rb:100, tip:200, sweep:.26, depth:52});
  mane('maneM', {layer:7, N:28, off:.11, rb:100, tip:176, sweep:.22, depth:44});
  mane('maneF', {layer:7, N:32, off:.17, rb:100, tip:152, sweep:.18, depth:36});
  // 7 the head, bottom to top: ears, the large cells of the face, the mouth's inside, teeth, muzzle, jaw, nose, brows and eyes
  const earPoly = [[68, -100], [80, -128], [104, -140], [122, -124], [120, -96], [100, -84]], earIn = [[84, -104], [92, -124], [106, -128], [112, -112], [106, -96]];
  const earBind = s => ({rigid:'ear' + s});
  zone('earR', earPoly.map(hw), {layer:8, tier:'F', h:12.5, tags:['head', 'ear', 'R'], yaw:true, z:zh(-10), bind:earBind('R')});
  zone('earL', mirror(earPoly.map(hw)), {layer:8, tier:'F', h:12.5, tags:['head', 'ear', 'L'], yaw:true, z:zh(-10), bind:earBind('L')});
  zone('earInR', earIn.map(hw), {layer:8, tier:'F', h:8, inset:.3, tags:['head', 'ear', 'R'], yaw:true, z:zh(-6), bind:earBind('R'), flush:.5});
  zone('earInL', mirror(earIn.map(hw)), {layer:8, tier:'F', h:8, inset:.3, tags:['head', 'ear', 'L'], yaw:true, z:zh(-6), bind:earBind('L'), flush:.5});
  const skin = {bind:{rigid:'head'}, z:zh(0)};
  { const fh = sym([[0, -124], [38, -121], [76, -108], [104, -86], [110, -66], [60, -76], [10, -66], [0, -60]]).map(hw), chR = [[104, -86], [122, -52], [130, -10], [126, 36], [114, 78], [98, 108], [80, 100], [96, 44], [100, -20], [110, -66]].map(hw), chL = mirror(chR),
      fc = sym([[0, -60], [10, -66], [60, -76], [110, -66], [100, -20], [96, 44], [80, 100], [98, 108], [52, 138], [0, 146]]).map(hw), sm = smoothCells([fh, chR, chL, fc], 2);
    const fo = {layer:9, ...skin, yaw:true, tags:['head', 'face', 'skin']};
    zone('foreheadC', sm[0], {...fo, tier:'L', ptier:'M', h:24}); zone('cheekR', sm[1], {...fo, tier:'L', ptier:'M', h:26, tags:['head', 'face', 'skin', 'R']}); zone('cheekL', sm[2], {...fo, tier:'L', ptier:'M', h:26, tags:['head', 'face', 'skin', 'L']});
    zone('faceC', sm[3], {...fo, tier:'M', h:28});
    rim('faceRim', chaikin(sym([[0, -124], [38, -121], [76, -108], [104, -86], [122, -52], [130, -10], [126, 36], [114, 78], [90, 114], [52, 138], [0, 146]]).map(hw), 2), {layer:9, yaw:true, z:skin.z, bind:skin.bind, tags:['head', 'face'], s:12}); }
  // the mouth's inside lies under the muzzle and the jaw, so the jaw's drop and the lip's lift uncover it
  hd('cavity', [[0, 52], [14, 64], [30, 72], [48, 72], [66, 66], [80, 58], [82, 96], [80, 128], [66, 142], [48, 148], [30, 148], [14, 140], [0, 130]], {layer:10, tier:'M', h:30, inset:.4, z:zh(-30), bind:{rigid:'head'}, flush:1});
  hd('tongue', [[0, 104], [16, 100], [30, 108], [36, 128], [26, 142], [0, 146]], {layer:10, tier:'F', h:15, inset:.4, z:zh(-24), bind:{mix:[['jaw', .85], ['head', .15]]}, flush:.6});
  { /* the protruding tongue is always drawn and always at the lips: at rest it is folded to a point on the lip line (nothing shows), and the tongue protruder (with the curler) unfolds it from there, so it grows out of the mouth and never pops */
    const tp = zone('tongueOut', [[-14, 78], [14, 78], [19, 100], [17, 116], [8, 124], [0, 126], [-8, 124], [-17, 116], [-19, 100]].map(hw), {layer:12, tier:'F', h:11, inset:.4, tags:['head', 'face', 'tongue2'], yaw:true, z:zh(8), bind:{rigid:'jaw'}}), an = hw([0, 79]);
    tp.full = []; for(let v = tp.v0; v < tp.v1; v++){ tp.full.push([VX[v], VY[v]]); VX[v] = an[0]; VY[v] = an[1]; } }
  const tooth = (name, pts, bone, o = {}) => { shape(name + 'R', pts.map(hw), {layer:10, tier:'F', tags:['head', 'face', 'R', 'teeth'], yaw:true, z:zh(-16), bind:{rigid:bone}, flip:0, ...o}); shape(name + 'L', mirror(pts.map(hw)), {layer:10, tier:'F', tags:['head', 'face', 'L', 'teeth'], yaw:true, z:zh(-16), bind:{rigid:bone}, flip:0, ...o}); };
  tooth('canU', [[34, 58], [54, 58], [44, 124]], 'head'); tooth('incU1', [[3, 62], [15, 62], [9, 94]], 'head'); tooth('incU2', [[16, 62], [28, 62], [23, 98]], 'head');
  tooth('canD', [[24, 100], [44, 100], [34, 52]], 'jaw'); tooth('incD1', [[3, 98], [15, 98], [9, 74]], 'jaw'); tooth('incD2', [[16, 98], [28, 98], [22, 78]], 'jaw');
  hp('pad', [[2, 60], [34, 26], [66, 16], [90, 30], [96, 56], [88, 76]].concat(LIPS.slice(0, 6).map(p => [p[0], p[1] + 3])).concat([[2, 74]]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]), {layer:11, tier:'F', h:16.5, z:padZ, bind:{rigid:'head'}, tags:['head', 'face', 'skin']});
  hd('jaw', [[0, 68]].concat(lip.slice(1).map(p => [p[0], p[1] - 3])).concat([[92, 104], [84, 136], [58, 158], [0, 166]]), {layer:11, tier:'F', h:20, z:zh(0, (u, v) => 14 * Math.exp(-((u / 60) ** 2 + ((v - 110) / 30) ** 2))), bind:{rigid:'jaw'}, tags:['head', 'face', 'skin', 'lo']});
  hd('nose', [[0, 18], [34, 20], [44, 32], [30, 52], [0, 64]], {layer:12, tier:'F', h:10, inset:.4, z:zh(0, (u, v) => 34 * Math.exp(-((u / 70) ** 2 + ((v - 46) / 40) ** 2)) + 12), bind:{rigid:'head'}, flush:.5, tags:['head', 'face', 'skin']});
  hd('bridge', [[0, -58], [14, -54], [24, -34], [32, -6], [36, 18], [0, 18]], {layer:11, tier:'F', h:15, z:zh(6), bind:{rigid:'head'}, tags:['head', 'face', 'skin']});
  const nostril = [[13, 34], [31, 33], [22, 47]];
  shape('nostrilR', nostril.map(hw), {layer:13, tier:'F', tags:['head', 'face', 'R', 'skin'], yaw:true, z:zh(30), bind:{rigid:'head'}, flip:0});
  shape('nostrilL', mirror(nostril.map(hw)), {layer:13, tier:'F', tags:['head', 'face', 'L', 'skin'], yaw:true, z:zh(30), bind:{rigid:'head'}, flip:0});
  // vibrissae spots, three rows a side, then the long whiskers
  for(const [i, [u, v]] of [[46, 44], [60, 40], [74, 44], [50, 58], [64, 56], [78, 58], [54, 72], [68, 70]].entries()){
    const sp = [[u - 3, v + 2], [u + 3, v + 2], [u, v - 3]];
    shape('spotR' + i, sp.map(hw), {layer:13, tier:'F', tags:['head', 'face', 'R', 'skin'], yaw:true, z:zh(30, (a, b) => 30 * Math.exp(-((a / 70) ** 2 + ((b - 46) / 40) ** 2))), bind:{rigid:'head'}, flip:0});
    shape('spotL' + i, mirror(sp.map(hw)), {layer:13, tier:'F', tags:['head', 'face', 'L', 'skin'], yaw:true, z:zh(30, (a, b) => 30 * Math.exp(-((a / 70) ** 2 + ((b - 46) / 40) ** 2))), bind:{rigid:'head'}, flip:0});
  }
  for(const [i, [u, v, a]] of [[80, 52, -.18], [84, 62, .06], [80, 72, .3]].entries()){
    const L = 66, c = Math.cos(a), s = Math.sin(a), w = 1.5, pts = [[u, v - w], [u + L * c, v + L * s - w], [u + L * c, v + L * s + w], [u, v + w]];
    shape('whiskR' + i, pts.map(hw), {layer:13, tier:'F', tags:['head', 'face', 'R', 'whisk', 'skin'], yaw:true, z:zh(26), bind:{rigid:'head'}, flip:0, split:true});
    shape('whiskL' + i, mirror(pts.map(hw)), {layer:13, tier:'F', tags:['head', 'face', 'L', 'whisk', 'skin'], yaw:true, z:zh(26), bind:{rigid:'head'}, flip:0, split:true});
  }
  // the eye: an almond of fine iris facets with a round pupil; the lids are the layer above
  const almond = [[28, -26], [44, -44], [66, -50], [88, -44], [98, -36], [84, -24], [62, -18], [40, -18]];
  const lidU = [[8, -64], [44, -76], [86, -78], [114, -64], [106, -40], [98, -36], [88, -44], [66, -50], [44, -44], [28, -26], [16, -40]];
  const lidL = [[28, -26], [40, -18], [62, -18], [84, -24], [98, -36], [106, -22], [94, -4], [62, 4], [34, 0], [20, -12]];
  hp('eye', almond, {layer:12, tier:'F', h:10.4, inset:.3, z:zh(-4), bind:{rigid:'head'}, flip:.3});
  const pup = c => ringPts(c, 9.5, 9, .2), pc = [62, -34];
  shape('pupilR', pup(pc).map(hw), {layer:13, tier:'F', tags:['head', 'face', 'R', 'eye', 'pupil'], yaw:true, z:zh(-1), bind:{rigid:'head'}, flip:0});
  shape('pupilL', mirror(pup(pc).map(hw)), {layer:13, tier:'F', tags:['head', 'face', 'L', 'eye', 'pupil'], yaw:true, z:zh(-1), bind:{rigid:'head'}, flip:0});
  const gl = [[54, -42], [60, -42], [56, -36]];
  shape('glintR', gl.map(hw), {layer:13, tier:'F', tags:['head', 'face', 'R', 'eye', 'pupil'], yaw:true, z:zh(0), bind:{rigid:'head'}, flip:0});
  shape('glintL', mirror(gl.map(hw)), {layer:13, tier:'F', tags:['head', 'face', 'L', 'eye', 'pupil'], yaw:true, z:zh(0), bind:{rigid:'head'}, flip:0});
  hp('lidL', lidL, {layer:14, tier:'F', h:14, inset:.35, z:zh(3), bind:{rigid:'head'}, flush:.4, tags:['head', 'face', 'skin']});
  hp('lidU', lidU, {layer:14, tier:'F', h:14.5, inset:.35, z:zh(8), bind:{rigid:'head'}, flush:.5, tags:['head', 'face', 'skin']});
  // 8 the glyph layer's body half: ♌ is the haunch ring, the tail's rise, its arch and the loop of the tail's end, inked in gold leaf
  { const hc = [268, 418], n = 24;
    const P = addPart('haunchRing', {layer:15, tier:'M', ink:'gold', tags:['hind', 'N', 'glyph'], bind:{chain:['pelvis', 'femN'], sigma:44}, flip:.4, tj:0});
    const ring = r => Array.from({length:n}, (_, i) => vtx(P, hc[0] + Math.cos(i * 2 * Math.PI / n) * r, hc[1] + Math.sin(i * 2 * Math.PI / n) * r));
    const a = ring(58), b = ring(66);
    for(let i = 0; i < n; i++) poly(P, [a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]]);
    close(P); }
  strip('tailInlay', TAIL_SPLINE.filter((_, i) => i % 4 === 0 || i === TAIL_SPLINE.length - 1).map(([x, y, w], i, a) => [x, y, 1.5 + 1.9 * (1 - i / (a.length - 1))]), {layer:15, tier:'F', ink:'gold', tags:['tail', 'glyph'], bind:{chain:['pelvis', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'], sigma:34}, flip:.3, tj:0});
}
build();
/* ---------- derived data: draw order, centroids, ink tones, skin weights ---------- */
const NPOLY = PV.length, NVERT = VX.length;
const DRAW = PARTS.slice().sort((a, b) => a.layer - b.layer || a.order - b.order);
const PCX = new Float32Array(NPOLY), PCY = new Float32Array(NPOLY);
PV.forEach((ids, i) => { let x = 0, y = 0; for(const v of ids){ x += VX[v]; y += VY[v]; } PCX[i] = x / ids.length; PCY[i] = y / ids.length; });
const LIPY = u => { u = Math.abs(u); const L = [[0, 71], [14, 83], [30, 91], [48, 91], [66, 85], [80, 77], [100, 77]]; for(let k = 0; k < L.length - 1; k++) if(u <= L[k + 1][0]) return L[k][1] + (L[k + 1][1] - L[k][1]) * (u - L[k][0]) / (L[k + 1][0] - L[k][0]); return 77; };
const PUPR = hw([62, -34]), PUPL = [2 * HC[0] - PUPR[0], PUPR[1]];
/* How much ink a polygon takes, 0 (bare skin) to 1 (full ink). Most of the figure is bare skin; ink goes where a feature needs it. */
const TONE = [
  [/^pupil/, () => 0], [/^glint/, () => 1],
  [/^eyeR/, (x, y) => .7 + .3 * clamp(Math.hypot(x - PUPR[0], y - PUPR[1]) / (34 * HS))],
  [/^eyeL/, (x, y) => .7 + .3 * clamp(Math.hypot(x - PUPL[0], y - PUPL[1]) / (34 * HS))],
  [/^(nostril|spot|whisk)/, () => .95], [/^lid/, () => .8], [/^pad/, () => .34], [/^nose/, () => .85], [/^bridge/, () => .16],
  [/^jaw/, (x, y) => { const u = (x - HC[0]) / HS, v = (y - HC[1]) / HS; return v - LIPY(u) < 8 ? .9 : .08; }],
  [/^(cavity|tongue)/, () => 0], [/^(can|inc)/, () => .95], [/^earIn/, () => .4], [/^ear/, () => .24],
  [/^maneU/, () => .03],
  [/^maneB/, (x, y) => 0.03 + .24 * clamp((Math.hypot(x - MC[0], y - MC[1]) - 92) / 110) ** 1.2],
  [/^maneM/, (x, y) => .05 + .5 * clamp((Math.hypot(x - MC[0], y - MC[1]) - 92) / 80) ** 1.2],
  [/^maneF/, (x, y) => .05 + .4 * clamp((Math.hypot(x - MC[0], y - MC[1]) - 90) / 58) ** 1.1],
  [/^sunDisc/, () => 0], [/^sunRing/, (x, y) => .45 + .45 * hash(Math.round(Math.atan2(y - 256, x - 742) * 5.73))], [/^sunRays/, () => .9],
  [/^palm/, () => .42], [/^toe/, () => .2], [/^claw/, () => .96], [/^tongueOut/, () => .55],
  [/^(haunchRing|tailInlay)/, () => .92], [/^tuft/, (x, y) => .12 + .3 * hash(Math.round(x + y))],
];
const PTONE = new Float32Array(NPOLY);
for(let i = 0; i < NPOLY; i++){
  const P = PARTS[PPART[i]], cx = PCX[i], cy = PCY[i], f = TONE.find(t => t[0].test(P.name));
  const t = f ? f[1](cx, cy) : .03 + .08 * (1 - (cy - 60) / 700) + P.bias + (vnoise(cx * .03, cy * .03) - .5) * .05;
  PTONE[i] = clamp(t + (hash(i * 7 + 3) - .5) * P.tj, 0, 1);
}

/* ZONES, as the face rig's FACE.skinW: the skin effects (drift, jitter, bursts, flips and holds, the colour field, a click's burst) cover the
   body's general skin and keep out of the features, which keep their own ink and react only to their own muscles. Each polygon has a
   zone; the effect weight of a zone says how much of an effect it takes. The mane takes only the mane ripple, the glyph only the glyph pulse. */
const ZONES = [[/^(eye|pupil|glint)/, 'eyes'], [/^lid/, 'brows'], [/^(pad|nose|nostril|spot|whisk|bridge)/, 'muzzle'], [/^(jaw|cavity|tongue|can|inc)/, 'mouth'], [/^ear/, 'ears'],
  [/^mane/, 'mane'], [/^(paw|palm|toe|claw|j[A-Z])/, 'paws'], [/^(sun|haunchRing|tailInlay)/, 'glyph'], [/^(foreheadC|cheek|faceC|faceRim)/, 'face']];
const ZONE_W = {skin:1, face:.3, eyes:0, brows:0, muzzle:0, mouth:0, ears:0, mane:0, paws:0, glyph:0};
const ZONE_NAMES = ['skin', 'face', 'eyes', 'brows', 'muzzle', 'mouth', 'ears', 'mane', 'paws', 'glyph'];
for(const P of PARTS) P.zone = (ZONES.find(z => z[0].test(P.name)) || [0, 'skin'])[1];
const FW = new Float32Array(NPOLY), ZLIST = Object.fromEntries(ZONE_NAMES.map(z => [z, []]));
for(let i = 0; i < NPOLY; i++){ const z = PARTS[PPART[i]].zone; FW[i] = ZONE_W[z]; ZLIST[z].push(i); }

/* Skin weights. Each part binds to bones by one of four rules; a vertex follows the nearest bones by a capsule falloff,
   so a limb bends smoothly at its joint and the torso arches along the spine. */
const SKB = new Int16Array(NVERT * 3).fill(-1), SKW = new Float32Array(NVERT * 3);
function capsule(b, x, y){ const B = BONES[b]; return segDist(x, y, B.p[0], B.p[1], B.q[0], B.q[1]); }
function skinVertex(v){
  const P = PARTS[VP[v]], x = VX[v], y = VY[v]; let L = [];
  const bind = P.bind || (P.tags.has('mane') ? {manemix:1} : {rigid:'head'});
  if(bind.rigid) L = [[BI[bind.rigid], 1]];
  else if(bind.mix) L = bind.mix.map(([n, w]) => [BI[n], w]);
  else if(bind.manemix){ const r = Math.hypot(x - MC[0], y - MC[1]), w = 1 - .45 * fSmooth(110, 190, r); L = [[BI.head, w], [BI.neck, 1 - w]]; }
  else {
    const ids = bind.chain.map(n => BI[n]), d = ids.map(b => capsule(b, x, y)), dm = Math.min(...d);
    L = ids.map((b, k) => [b, Math.exp(-(((d[k] - dm) / bind.sigma) ** 2))]);
    if(bind.blade){   // the skin over the shoulder blade slides with it: within the blade's reach the scapula takes a share (k at the blade, nothing past r1), so the withers lift and the flank slides when the blade turns and rises
      const bb = BI[bind.blade.bone], dd = capsule(bb, x, y), ws = bind.blade.k * (1 - fSmooth(bind.blade.r0, bind.blade.r1, dd));
      if(ws > .01){ const sum = L.reduce((a, q) => a + q[1], 0) || 1; L = L.map(([b, w]) => [b, w / sum * (1 - ws)]); L.push([bb, ws]); }
    }
  }
  L.sort((a, b) => b[1] - a[1]); L = L.slice(0, 3).filter(a => a[1] > .02);
  const sum = L.reduce((s, a) => s + a[1], 0);
  L.forEach(([b, w], k) => { SKB[v * 3 + k] = b; SKW[v * 3 + k] = w / sum; });
}
for(let v = 0; v < NVERT; v++) skinVertex(v);
PARTS.forEach(P => { P.bones = new Set(); for(let v = P.v0; v < P.v1; v++) for(let k = 0; k < 3; k++) if(SKB[v * 3 + k] >= 0) P.bones.add(SKB[v * 3 + k]); P.boneList = [...P.bones]; });

/* ---------- appearance: the line model ---------- */
const r10 = v => Math.round(v * 10) / 10;
/* Line weights in canvas units, never thinner than a fraction of a pixel: `gap` is each polygon's inset (so a hairline is twice it), `c` a contour,
   `b` a region border, `sil` the silhouette's stroke (half of it shows). */
function gapTable(size){
  const u = VW / size, px = size < 70 ? .5 : size < 150 ? .32 : size < 300 ? .2 : 0;
  return {gap:[.62, .56, .42].map(d => Math.max(d, px * u / 2)), c:Math.max(6.2, px * u * 3.2), b:Math.max(3.3, px * u * 1.8), f:Math.max(1.9, px * u), sil:Math.max(10.5, px * u * 5.5)};
}
/* The silhouette path (the face rig's sil): every near part's backing, drawn once beneath everything but the sun, heavily stroked. */
const inSil = P => !P.dim && !P.tags.has('glyph') && !P.show && !P.open && !P.nosil;
const inkOf = (C, P) => P.ink === 'gold' ? C.gold : C.ink;
function baseColours(C){ const out = new Int32Array(NPOLY); for(let i = 0; i < NPOLY; i++) out[i] = mixInt(C.skin, inkOf(C, PARTS[PPART[i]]), PTONE[i]); return out; }
/* One part's geometry from posed vertex positions X, Y: each polygon inset from its neighbours by the tier's gap (scaled about its
   incentre, so every edge moves in by the same distance), and the backing path of the un-inset polygons that the gaps show through. */
function partGeom(P, X, Y, gt, out, vs){
  for(let v = P.v0; v < P.v1; v++) vs[v] = Math.round(X[v] * 2) / 2 + ',' + Math.round(Y[v] * 2) / 2;
  let lp = '';
  if(P.loop && P.loop.length > 2){ const l = P.loop; lp = 'M' + vs[l[0]]; for(let q = 1; q < l.length; q++) lp += 'L' + vs[l[q]]; if(!P.open) lp += 'Z'; }
  partGeom.loop = lp;   // the backing is half-unit exact: it lies under the gaps
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
    const g = gt[PTIER[i]], d = Math.min(g, r * .8), k = r > 1e-4 ? (r - d) / r : .2;
    let s = ''; for(let q = 0; q < n; q++){ const v = ids[q]; s += (q ? ' ' : '') + r10(ix + (X[v] - ix) * k) + ',' + r10(iy + (Y[v] - iy) * k); }
    out[i] = s;
  }
  return back;
}
/* The static rest-pose render: a backing path in the line colour per part, the inset polygons grouped by fill. */
function restSvg(o = {}){
  const size = o.size || 200, P0 = creaturePalette(o.palette), C = creatureColours(P0), col = baseColours(C), G = gapTable(size), h = Math.round(size * VH / VW);
  const out = new Array(NPOLY), vs = new Array(NVERT);
  let body = '', sil = '', silDone = false;
  const pieces = DRAW.map(part => {
    const back = partGeom(part, VX, VY, G.gap, out, vs);
    if(inSil(part)) sil += part.zone === 'mane' ? back : partGeom.loop;
    const ls = C.ls[part.order], lp = partGeom.loop;
    let b = `<path d="${back}" fill="${intHex(ls.fill)}"${ls.bs ? ` stroke="${intHex(ls.stroke)}" stroke-width="${r10(ls.bs)}" stroke-linejoin="round"` : ''}/>`;
    const groups = new Map();
    for(let i = part.p0; i < part.p1; i++){ const c = col[i], d = 'M' + out[i].replace(/ /g, 'L') + 'Z'; groups.set(c, (groups.get(c) || '') + d); }
    for(const [c, d] of groups) b += `<path d="${d}" fill="${intHex(c)}"/>`;
    if(ls.role && lp) b += `<path d="${lp}" fill="none" stroke="${intHex(ls.stroke)}" stroke-width="${r10(ls.role === 'c' ? G.c : ls.role === 'f' ? G.f : G.b)}" stroke-linejoin="round"/>`;
    return b;
  });
  DRAW.forEach((part, k) => { if(!silDone && part.layer >= 2){ body += `<path d="${sil}" fill="${intHex(C.line)}" stroke="${intHex(C.line)}" stroke-width="${r10(G.sil)}" stroke-linejoin="round"/>`; silDone = true; } body += pieces[k]; });
  return `<svg class="creature" xmlns="${NS}" width="${size}" height="${h}" viewBox="0 0 ${VW} ${VH}">${body}</svg>`;
}
window.__r = n => restSvg({size:n}); window.__n = [NPOLY, NVERT, PARTS.length, PARTS.map(p => [p.name, p.p1 - p.p0])];
/* ---------- the glyph's path: the light's travel ----------
   The sign is traced once: from the tail's root up the tail (so the light climbs the arch and the loop), out through the tuft's end, then round
   the haunch ring and across to the sun's ring and rays, which flash at the end. GS is each glyph polygon's place on that path, 0 to 1. */
const GS = new Float32Array(NPOLY).fill(-1), GH = new Float32Array(NPOLY).fill(1);
{ const ring = PARTS.find(P => P.name === 'haunchRing'), inl = PARTS.find(P => P.name === 'tailInlay'), nr = ring.p1 - ring.p0, ni = inl.p1 - inl.p0;
  for(let i = inl.p0; i < inl.p1; i++) GS[i] = .04 + .5 * (i - inl.p0) / (ni - 1);                 // up the tail
  for(let i = ring.p0; i < ring.p1; i++){ const a = (Math.atan2(PCY[i] - 418, PCX[i] - 268) + Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI); GS[i] = .56 + .26 * a / (2 * Math.PI); }   // round the ring
  for(const P of PARTS) if(P.name === 'sunRing' || P.name === 'sunRays') for(let i = P.p0; i < P.p1; i++){ const a = (Math.atan2(PCY[i] - 256, PCX[i] - 742) + 4 * Math.PI) % (2 * Math.PI); GS[i] = .9 + .1 * a / (2 * Math.PI); }
  // a halo: the tail's body and the tuft light a little as the light passes along them, the haunch's rosette round the ring
  for(const nm of ['tail', 'tuft', 'haunchN']){ const P = PARTS.find(q => q.name === nm);
    for(let i = P.p0; i < P.p1; i++){
      if(nm === 'haunchN'){ if(Math.hypot(PCX[i] - 268, PCY[i] - 418) > 92) continue; const a = (Math.atan2(PCY[i] - 418, PCX[i] - 268) + Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI); GS[i] = .56 + .26 * a / (2 * Math.PI); }
      else if(nm === 'tuft') GS[i] = .52;
      else { let bi = 0, bd = 1e9; TAIL_SPLINE.forEach((q, k) => { const d = Math.hypot(q[0] - PCX[i], q[1] - PCY[i]); if(d < bd){ bd = d; bi = k; } }); GS[i] = .04 + .5 * bi / (TAIL_SPLINE.length - 1); }
      GH[i] = .8; } } }
const GLYPH_I = []; for(let i = 0; i < NPOLY; i++) if(GS[i] >= 0) GLYPH_I.push(i);

/* ---------- part tags the muscles select by ---------- */
for(const P of PARTS){
  const n = P.name;
  if(/^(maneB|maneM|maneF|maneU)/.test(n)) P.tags.add('mane');
  if(/^(maneB|maneM|maneF)/.test(n)) P.tags.add('locks');
  if(/^(eye|pupil|glint)/.test(n)) P.tags.add('eye');
  if(/^(jaw|canD|incD|tongue)/.test(n)) P.tags.add('lo');
}

/* ---------- the muscles: gaussian fields over the mesh, each with the bones it turns ----------
   c, r, v, pull, speed, hue, shade are the face rig's own fields. New here: `pair` (LR mirrors across the head's axis, NF is
   the near and far leg), `on` (which parts' vertices the field can reach, by tag), `jt` (the joints it turns: [bone, gain, kind],
   kind r = rotation in radians, y = slide in px, yaw = the head's turn), hd (c and r are in head units), vm:0 (v does not mirror). */
const cr = (cx, cy, rx, ry, ang, f, amp = .5, lo = .78, hi = .95) => { const ca = Math.cos(ang), sa = Math.sin(ang); return (x, y) => gauss(x, y, cx, cy, rx, ry) * lineSet(Math.abs(Math.sin(((x - cx) * ca + (y - cy) * sa) * f)), lo, hi) * amp; };
const hcr = (c, rx, ry, ang, f, amp, lo, hi) => { const w = hw(c); return cr(w[0], w[1], rx * HS, ry * HS, ang, f / HS, amp, lo, hi); };
const soft = (c, rx, ry, amp) => { const w = hw(c); return (x, y) => gauss(x, y, w[0], w[1], rx * HS, ry * HS) * amp; };
const both = (a, b) => (x, y) => Math.max(a(x, y), b(x, y));   // creases over a soft glow, so a muscle reads even where the facets are few
const MUSCLE_DEFS = {
  // the face: jaw, lips, nose, eyes, ears, turn
  temporalis:{name:'temporalis', g:'jaw', pair:'LR', hd:1, c:[110, -44], r:[32, 40], v:[7, -17], speed:8, hue:'#a09080', jt:[['jaw', -6, 'y']], shade:both(hcr([112, -42], 30, 36, 1.2, .2, .95), soft([112, -44], 30, 38, .75))},
  masseter:{name:'masseter', g:'jaw', pair:'LR', hd:1, c:[106, 50], r:[30, 40], v:[9, -22], speed:8, hue:'#b09880', jt:[['jaw', -8, 'y']], shade:both(hcr([106, 56], 26, 38, 1.45, .22, .95), soft([106, 52], 28, 38, .75))},
  digastric:{name:'digastric', g:'jaw', pair:'LR', hd:1, c:[50, 128], r:[40, 24], v:[0, 0], dir:[0, 1], speed:9, hue:'#80a0a8', jt:[['jaw', 25, 'y']], host:'jaw'},
  depLab:{name:'depressor labii inferioris', g:'jaw', pair:'LR', hd:1, c:[42, 116], r:[32, 26], v:[4, 20], speed:10, hue:'#90a0c8', on:['lo'], shade:hcr([42, 112], 26, 22, 1.3, .2, .8)},
  levLabii:{name:'levator labii superioris (snarl)', g:'lips', pair:'LR', hd:1, c:[50, 46], r:[34, 30], v:[11, -28], speed:12, hue:'#e3806f', on:['skin'], shade:hcr([46, 36], 28, 28, .5, .2, .9)},
  nasolab:{name:'nasolabialis', g:'lips', pair:'LR', hd:1, c:[72, 54], r:[26, 28], v:[20, -14], speed:11, hue:'#d8c89a', on:['skin'], shade:both(hcr([74, 52], 22, 24, 1.1, .22, .85), soft([74, 50], 24, 26, .7))},
  nasalis:{name:'nasalis (nose wrinkler)', g:'lips', pair:'LR', hd:1, c:[22, -12], r:[22, 38], v:[-4, -20], speed:12, hue:'#d985a6', on:['skin'], shade:hcr([24, -8], 22, 34, 1.57, .3, .95)},
  orbic:{name:'orbicularis oculi', g:'eyes', pair:'LR', hd:1, c:[62, -34], r:[44, 28], pull:[.5, .9], speed:18, hue:'#ffbe00', on:['skin'], shade:hcr([66, -34], 40, 26, .3, .25, .7)},
  levPalp:{name:'levator palpebrae', g:'eyes', pair:'LR', hd:1, c:[62, -60], r:[42, 16], v:[0, -22], speed:16, hue:'#7ec3e6', on:['skin'], shade:both(hcr([62, -64], 36, 14, 1.57, .3, .8), soft([62, -66], 38, 14, .7))},
  frontalis:{name:'frontalis (brow raiser)', g:'eyes', pair:'LR', hd:1, c:[58, -94], r:[46, 24], v:[0, -16], speed:10, hue:'#c79ae0', on:['skin'], shade:both(hcr([58, -98], 44, 24, 1.57, .22, .8), soft([58, -98], 46, 24, .65))},
  corrug:{name:'corrugator supercilii', g:'eyes', pair:'LR', hd:1, c:[34, -64], r:[34, 16], v:[-22, 18], speed:11, hue:'#e0523f', on:['skin'], shade:both(hcr([28, -62], 24, 16, 0, .3, .95), soft([30, -62], 26, 16, .8))},
  dilator:{name:'pupil dilator', g:'eyes', pair:'LR', hd:1, c:[62, -34], r:[16, 16], pull:[-.8, -.8], speed:10, hue:'#3b3a78', on:['pupil']},
  lookR:{name:'gaze right', g:'gaze', pair:'LR', hd:1, vm:0, c:[62, -34], r:[16, 16], v:[9, 0], speed:14, hue:'#7ec3e6', on:['pupil']},
  lookL:{name:'gaze left', g:'gaze', pair:'LR', hd:1, vm:0, c:[62, -34], r:[16, 16], v:[-9, 0], speed:14, hue:'#7ec3e6', on:['pupil']},
  lookU:{name:'gaze up', g:'gaze', pair:'LR', hd:1, vm:0, c:[62, -34], r:[16, 16], v:[0, -7], speed:14, hue:'#7ec3e6', on:['pupil']},
  lookD:{name:'gaze down', g:'gaze', pair:'LR', hd:1, vm:0, c:[62, -34], r:[16, 16], v:[0, 7], speed:14, hue:'#7ec3e6', on:['pupil']},
  earBack:{name:'auricularis posterior', g:'ears', pair:'LR', hd:1, c:[100, -112], r:[30, 28], v:[10, 14], speed:14, hue:'#a89880', on:['ear'], jt:[['ear$', .95, 'r']]},
  earUp:{name:'auricularis superior', g:'ears', pair:'LR', hd:1, c:[100, -112], r:[26, 26], v:[-2, -6], speed:14, hue:'#b0a090', on:['ear'], jt:[['ear$', -.45, 'r']]},
  splenius:{name:'splenius capitis (turn)', g:'neck', pair:'LR', hd:1, c:[112, -76], r:[26, 40], v:[0, -3], speed:6, hue:'#9a88c0', on:['skin'], jt:[['@yaw', .62, 'yaw'], ['head', .05, 'r']]},
  brachioceph:{name:'brachiocephalicus', g:'neck', pair:'NF', grp:'fore', c:[632, 372], r:[42, 50], v:[0, -3], speed:7, hue:'#7090a0', on:['torso', 'fore'], jt:[['neck', -.07, 'r'], ['hum$', -.12, 'r']], shade:cr(632, 372, 40, 46, 2.2, .1, .5)},
  longusColli:{name:'longus colli and longus capitis (neck and head flexors)', g:'neck', c:[640, 392], r:[40, 40], v:[0, 2], speed:7, hue:'#8fb0a0', on:['torso'], jt:[['neck', .2, 'r'], ['head', .1, 'r']], bf:1},
  nuchal:{name:'nuchal extensors (semispinalis capitis, splenius)', g:'neck', c:[656, 340], r:[46, 26], v:[0, -6], speed:7, hue:'#a8a0d0', on:['torso'], jt:[['neck', -.2, 'r'], ['head', -.06, 'r']], bf:1, shade:cr(656, 342, 42, 22, .5, .1, .55)},
  arrector:{name:'mane erector', g:'mane', c:MC, r:[190, 190], pull:[-.15, -.15], speed:7, hue:'#d8a050', on:['locks'], dir:[1, 0], host:'head'},
  // the trunk
  epaxial:{name:'epaxial (erector spinae)', g:'spine', c:[430, 336], r:[190, 24], v:[0, -7], speed:7, hue:'#c8a070', on:['torso'], jt:[['pelvis', .08, 'r'], ['chest', -.08, 'r']], bf:1, shade:cr(430, 340, 190, 20, 0, .09, .6)},
  hypaxial:{name:'hypaxial (rectus abdominis)', g:'spine', c:[430, 478], r:[190, 26], v:[0, 7], speed:7, hue:'#a8c0a0', on:['torso'], jt:[['pelvis', -.16, 'r'], ['chest', .16, 'r']], bf:1, shade:cr(430, 476, 190, 20, 0, .1, .6)},
  intercostals:{name:'intercostals', g:'spine', c:[500, 430], r:[120, 76], pull:[-.085, -.15], speed:5, hue:'#8fd0a8', on:['torso'], dir:[0, 1], host:'chest', shade:cr(500, 430, 110, 70, 0, .12, .5)},
  // the shoulder girdle and foreleg
  trapezius:{name:'trapezius (draws the blade back)', g:'fore', pair:'NF', grp:'fore', c:[548, 346], r:[72, 34], v:[0, -9], speed:8, hue:'#9a88c0', on:['torso', 'fore'], jt:[['scap$', .2, 'r']], bf:1, shade:cr(548, 350, 60, 26, .7, .12, .6)},
  rhomboideus:{name:'rhomboideus (holds the blade up and back)', g:'fore', pair:'NF', grp:'fore', c:[534, 332], r:[40, 26], v:[-4, -7], speed:8, hue:'#8a78b8', on:['torso', 'fore'], jt:[['scap$', .18, 'r']], bf:1, shade:cr(534, 336, 36, 22, .8, .12, .6)},
  serratus:{name:'serratus ventralis (swings the blade forward)', g:'fore', pair:'NF', grp:'fore', c:[578, 424], r:[44, 52], v:[-4, -6], speed:9, hue:'#c9a0dc', on:['torso', 'fore'], jt:[['scap$', -.3, 'r']], bf:1, shade:cr(578, 424, 40, 46, 1.2, .16, .6)},
  omotrans:{name:'omotransversarius (draws the blade forward)', g:'fore', pair:'NF', grp:'fore', c:[600, 366], r:[36, 26], v:[6, -4], speed:9, hue:'#b098d0', on:['torso', 'fore'], jt:[['scap$', -.2, 'r']], bf:1, shade:cr(600, 368, 32, 22, 1.1, .12, .55)},
  deltoid:{name:'deltoid', g:'fore', pair:'NF', grp:'fore', c:[598, 436], r:[34, 40], v:[8, -6], speed:10, hue:'#e0b060', on:['fore'], jt:[['hum$', -.42, 'r']], shade:cr(600, 440, 30, 36, .3, .18, .6)},
  latissimus:{name:'latissimus dorsi', g:'fore', pair:'NF', grp:'fore', c:[524, 432], r:[60, 52], v:[-10, -8], speed:9, hue:'#d47868', on:['torso', 'fore'], jt:[['hum$', .38, 'r']], shade:cr(520, 436, 56, 48, -.6, .13, .66)},
  triceps:{name:'triceps brachii', g:'fore', pair:'NF', grp:'fore', c:[572, 486], r:[28, 50], v:[-7, -8], speed:10, hue:'#e07088', on:['fore'], jt:[['rad$', -.5, 'r']], shade:cr(572, 486, 24, 46, 1.57, .2, .66)},
  brachialis:{name:'biceps / brachialis', g:'fore', pair:'NF', grp:'fore', c:[620, 486], r:[24, 46], v:[5, -6], speed:11, hue:'#e0a8b8', on:['fore'], jt:[['rad$', .8, 'r']], shade:cr(620, 486, 20, 40, 1.57, .22, .6)},
  flexCarpi:{name:'flexor carpi', g:'fore', pair:'NF', grp:'fore', c:[613, 600], r:[22, 44], v:[0, 4], speed:13, hue:'#b0a0d0', on:['fore'], jt:[['hand$', .55, 'r']], shade:cr(613, 600, 18, 38, 1.57, .26, .6)},
  extCarpi:{name:'extensor carpi', g:'fore', pair:'NF', grp:'fore', c:[624, 598], r:[20, 40], v:[0, -3], speed:13, hue:'#a0c8c0', on:['fore'], jt:[['hand$', -.4, 'r']], shade:cr(624, 598, 16, 36, 1.57, .26, .55)},
  // the hindquarter
  hipFlex:{name:'iliopsoas (hip flexor)', g:'hind', pair:'NF', grp:'hind', c:[304, 432], r:[36, 36], v:[4, -6], speed:9, hue:'#c0a0d0', on:['torso', 'hind'], jt:[['fem$', -.42, 'r']], shade:soft([0, 0], 1, 1, 0)},
  glutes:{name:'gluteals', g:'hind', pair:'NF', grp:'hind', c:[250, 404], r:[48, 50], v:[-8, -4], speed:9, hue:'#e0b060', on:['torso', 'hind'], jt:[['fem$', .36, 'r']], shade:cr(250, 404, 44, 44, .5, .13, .65)},
  hamstrings:{name:'biceps femoris (hamstrings)', g:'hind', pair:'NF', grp:'hind', c:[248, 476], r:[32, 54], v:[-8, 6], speed:10, hue:'#d89060', on:['hind'], jt:[['fem$', .18, 'r'], ['tib$', .45, 'r']], shade:cr(248, 476, 28, 50, 1.57, .18, .66)},
  quads:{name:'quadriceps', g:'hind', pair:'NF', grp:'hind', c:[320, 470], r:[32, 46], v:[8, -4], speed:10, hue:'#c48070', on:['hind'], jt:[['tib$', -.5, 'r'], ['fem$', -.06, 'r']], shade:cr(322, 470, 28, 42, 1.57, .2, .6)},
  gastroc:{name:'gastrocnemius', g:'hind', pair:'NF', grp:'hind', c:[230, 590], r:[26, 44], v:[-8, 6], speed:12, hue:'#e07070', on:['hind'], jt:[['foot$', .55, 'r']], shade:cr(230, 590, 22, 40, 1.57, .24, .66)},
  tibialis:{name:'tibialis cranialis', g:'hind', pair:'NF', grp:'hind', c:[266, 600], r:[22, 42], v:[4, -3], speed:12, hue:'#8090c0', on:['hind'], jt:[['foot$', -.45, 'r']], shade:cr(268, 600, 18, 38, 1.57, .26, .55)},
  // paws and tongue
  toeSpreadFore:{name:'interossei (toe spreaders, fore)', g:'fore', pair:'NF', grp:'fore', c:[640, 752], r:[36, 18], pull:[-.5, 0], speed:14, hue:'#d8c89a', on:['toe']},
  toeSpreadHind:{name:'interossei (toe spreaders, hind)', g:'hind', pair:'NF', grp:'hind', c:[266, 752], r:[36, 18], pull:[-.5, 0], speed:14, hue:'#d8c89a', on:['toe']},
  toeGripFore:{name:'flexor digitorum superficialis (toe flexors, fore)', g:'fore', pair:'NF', grp:'fore', c:[640, 752], r:[36, 18], v:[-1, 3], speed:14, hue:'#b0a0d0', on:['toe', 'palm'], jt:[['toeF$', .7, 'r']], bf:1},
  toeGripHind:{name:'flexor digitorum superficialis (toe flexors, hind)', g:'hind', pair:'NF', grp:'hind', c:[266, 752], r:[36, 18], v:[-1, 3], speed:14, hue:'#b0a0d0', on:['toe', 'palm'], jt:[['toeH$', .7, 'r']], bf:1},
  toeExtFore:{name:'extensor digitorum communis (toe extensors, fore)', g:'fore', pair:'NF', grp:'fore', c:[640, 736], r:[36, 20], v:[1, -3], speed:14, hue:'#a0c8c0', on:['toe'], jt:[['toeF$', -.5, 'r']], bf:1},
  toeExtHind:{name:'extensor digitorum longus (toe extensors, hind)', g:'hind', pair:'NF', grp:'hind', c:[266, 736], r:[36, 20], v:[1, -3], speed:14, hue:'#a0c8c0', on:['toe'], jt:[['toeH$', -.5, 'r']], bf:1},
  clawFore:{name:'flexor digitorum profundus (draws the claws out, fore)', g:'fore', pair:'NF', grp:'fore', c:[640, 762], r:[1e4, 1e4], grow:1, dir:[0, 1], fibLen:26, speed:16, hue:'#e8e4d9', on:['claw']},
  clawHind:{name:'flexor digitorum profundus (draws the claws out, hind)', g:'hind', pair:'NF', grp:'hind', c:[266, 762], r:[1e4, 1e4], grow:1, dir:[0, 1], fibLen:26, speed:16, hue:'#e8e4d9', on:['claw']},
  tongueOut:{name:'tongue protruder (genioglossus)', g:'jaw', hd:1, c:[0, 128], r:[26, 46], v:[0, 50], grow:1, speed:11, hue:'#c85a6a', on:['tongue2']},
  tongueCurl:{name:'tongue curler', g:'jaw', hd:1, c:[0, 150], r:[14, 22], v:[14, -34], speed:12, hue:'#e07a7a', on:['tongue2']},
  // the tail
  levCaudae:{name:'levator caudae (sacrocaudalis dorsalis)', g:'tail', c:[230, 220], r:[110, 120], v:[0, 0], dir:[0, -1], speed:8, hue:'#d8c89a', on:['tail'], jt:[['t0', -.07, 'r'], ['t1', -.07, 'r'], ['t2', -.06, 'r'], ['t3', -.05, 'r']], bf:1, host:'t1'},
  depCaudae:{name:'depressor caudae (sacrocaudalis ventralis)', g:'tail', c:[230, 220], r:[110, 120], v:[0, 0], dir:[0, 1], speed:11, hue:'#8f9ac0', on:['tail'], jt:[['t0', .09, 'r'], ['t1', .09, 'r'], ['t2', .07, 'r'], ['t3', .05, 'r']], bf:1, host:'t1'},
  flexMid:{name:'caudal flexor (mid)', g:'tail', c:[360, 160], r:[70, 60], v:[0, 0], dir:[-1, 0], speed:12, hue:'#c090c0', on:['tail'], jt:[['t3', .1, 'r'], ['t4', .14, 'r'], ['t5', .16, 'r'], ['t6', .18, 'r']], bf:1, host:'t4'},
  flexTip:{name:'intertransversarii (tip curl)', g:'tail', c:[350, 230], r:[50, 50], v:[0, 0], dir:[-1, 0], speed:14, hue:'#e0a060', on:['tail'], jt:[['t5', .12, 'r'], ['t6', .2, 'r'], ['t7', .3, 'r']], bf:1, host:'t6'},
};
const MUS = [], MI = {}, SIDES = {LR:['L', 'R'], NF:['N', 'F']};
const boneOf = (tpl, side) => BI[tpl.replace('$', side)];
(() => {
  const tmp = new Float32Array(NVERT);
  for(const [id, d] of Object.entries(MUSCLE_DEFS)){
    for(const side of d.pair ? SIDES[d.pair] : ['C']){
      const mir = side === 'L', far = side === 'F', off = far ? FAR[d.grp || 'fore'] : [0, 0];
      const sc = d.hd ? HS : 1, c0 = d.hd ? hw(d.c) : d.c, r = d.r.map(q => q * sc);
      const inst = {id, side, def:d, n:MUS.length, verts:[], dx:[], dy:[], parts:new Set(), wPoly:new Float32Array(NPOLY), shadeI:[], shadeW:[], jl:[]};
      MI[id + '.' + side] = inst.n;
      tmp.fill(0);
      const to = (x, y) => [(mir ? 2 * HC[0] - x : x) - off[0], y - off[1]];
      for(const P of PARTS){
        if(!(d.on || ['skin']).some(t => P.tags.has(t))) continue;
        if(d.pair === 'NF' && (side === 'F') !== P.tags.has('F')) continue;
        for(let v = P.v0; v < P.v1; v++){
          const fp = P.full ? P.full[v - P.v0] : null, [X, Y] = to(fp ? fp[0] : VX[v], fp ? fp[1] : VY[v]), w = gauss(X, Y, c0[0], c0[1], r[0], r[1]);   // a part that rests folded (a claw in its sheath, the tongue) has its muscles placed by its unfolded shape
          if(w < .03) continue;
          tmp[v] = w;
          let vx = 0, vy = 0, gx = 0, gy = 0;
          if(d.pull){ vx = (c0[0] - X) * d.pull[0]; vy = (c0[1] - Y) * d.pull[1]; } else if(d.v){ vx = d.v[0] * sc; vy = d.v[1] * sc; }
          if(d.grow && fp){ gx = fp[0] - VX[v]; gy = fp[1] - VY[v]; }   // `grow`: the whole way from the folded shape to the unfolded one, at full activation
          if(vx || vy || gx || gy){ inst.verts.push(v); inst.dx.push((mir && d.vm !== 0 ? -vx : vx) * w + gx); inst.dy.push(vy * w + gy); inst.parts.add(P.order); }
        }
        if(d.shade) for(let i = P.p0; i < P.p1; i++){ const [X, Y] = to(PCX[i], PCY[i]), s = Math.min(.6, d.shade(X, Y)); if(s > .03){ inst.shadeI.push(i); inst.shadeW.push(s); } }
      }
      for(let i = 0; i < NPOLY; i++){ let w = 0; for(const v of PV[i]) if(tmp[v] > w) w = tmp[v]; inst.wPoly[i] = w; }
      inst.verts = Int32Array.from(inst.verts); inst.dx = Float32Array.from(inst.dx); inst.dy = Float32Array.from(inst.dy);
      inst.shadeI = Int32Array.from(inst.shadeI); inst.shadeW = Float32Array.from(inst.shadeW); inst.partList = [...inst.parts];
      // the joints it turns; the left side mirrors every rotation
      for(const [tpl, g, kind] of d.jt || []){
        if(kind === 'yaw') inst.jl.push([-1, mir ? -g : g, 2]);
        else inst.jl.push([boneOf(tpl, side), kind === 'r' && mir ? -g : g, kind === 'y' ? 1 : 0]);
      }
      // the fibre drawn in the anatomy view: from its origin to its insertion, on the bones it joins
      const dir = d.dir || (d.v && (d.v[0] || d.v[1]) ? d.v : [0, -1]), dl = Math.hypot(dir[0], dir[1]) || 1, reach = d.fibLen ?? Math.max(r[0], r[1]) * .9;
      const cx = (mir ? 2 * HC[0] - c0[0] : c0[0]) + off[0], cy = c0[1] + off[1], dx = (mir ? -dir[0] : dir[0]) / dl, dy = dir[1] / dl;
      const ins = inst.jl.find(j => j[2] < 2), insB = ins ? ins[0] : d.host ? boneOf(d.host, side) : d.hd ? BI.head : BI.chest;
      inst.fib = {o:[cx - dx * reach, cy - dy * reach], i:[cx, cy], ob:ins ? Math.max(0, BONES[insB].parent) : insB, ib:insB, yaw:!!d.hd};
      if(inst.fib.ob === BI.body) inst.fib.ob = BI.chest;
      MUS.push(inst);
    }
  }
})();
const NM = MUS.length;
for(const m of MUS) m.leg = !!(m.def.pair === 'NF' && (m.def.grp === 'fore' || m.def.grp === 'hind') && m.id !== 'brachioceph');
/* The joint readout: the joints that a pose channel turns (the shoulder blade, the neck, the head, the trunk, the digits) have their agonists and antagonists, and the pose lights them, as the
   IK solve lights the legs' muscles. `bf` marks those muscles; BF_SCALE is the angle at which the muscle is at full effort. The share of a muscle's activation that comes from the readout
   (`actsB`) displays and bulges, but does not turn the joint again: the pose already did. A muscle driven by anything else (a pad, a held bar, an action) turns its joint as before. */
for(const m of MUS) m.bf = !!m.def.bf;
const BF_SCALE = {scapN:.3, scapF:.3, neck:.3, head:.25, pelvis:.12, chest:.12, toeFN:.7, toeFF:.7, toeHN:.7, toeHF:.7, t0:.3, t1:.3, t2:.3, t3:.3, t4:.3, t5:.3, t6:.3, t7:.3};
const BFD = Object.entries(BF_SCALE).map(([name, scale]) => { const b = BI[name], pos = [], neg = []; for(const m of MUS) if(m.bf) for(const [bb, g, kd] of m.jl) if(bb === b && kd === 0) (g > 0 ? pos : neg).push(m.n); return {b, scale, pos, neg, name}; });

/* the muscle each polygon belongs to most, for the map view */
const DOM = new Int16Array(NPOLY).fill(-1);
for(let i = 0; i < NPOLY; i++){ let bw = .3; for(const m of MUS) if(m.wPoly[i] > bw){ bw = m.wPoly[i]; DOM[i] = m.n; } }
const musHue = MUS.map(m => hexInt(m.def.hue));
const SHOWP = PARTS.filter(P => P.show).map(P => ({k:P.order, n:MI[P.show + '.' + (P.tags.has('F') ? 'F' : P.tags.has('N') ? 'N' : 'C')]}));

/* ---------- the behaviours: what the creature does, as muscle activations over time ---------- */
const env = (t, att, hold, rel) => t < 0 ? 0 : t < att ? fSmooth(0, att, t) : t < att + hold ? 1 : t < att + hold + rel ? 1 - fSmooth(att + hold, att + hold + rel, t) : 0;
const pulse = (t, t0, att, hold, rel) => env(t - t0, att, hold, rel);
/* an activation spec is {muscle: a} or {muscle: [left, right]} (or [near, far]), resolved per instance */
function spec(T, S, k = 1){
  for(const id in S){
    const v = S[id], d = MUSCLE_DEFS[id]; if(!d) continue;
    if(!d.pair){ T[MI[id + '.C']] += k * (Array.isArray(v) ? (v[0] + v[1]) / 2 : v); continue; }
    SIDES[d.pair].forEach((s, j) => { T[MI[id + '.' + s]] += k * (Array.isArray(v) ? v[j] : v); });
  }
}
const LEGS = [['N', 'fore', .25], ['F', 'fore', .75], ['N', 'hind', 0], ['F', 'hind', .5]];
/* a leg's walk: u in 0..1; stance to .6 (the leg goes back), then the swing (it lifts and goes forward) */
function gait(T, ph){
  for(const [s, g, off] of LEGS){
    const u = (ph + off) % 1, sg = u < .6 ? 1 - 2 * u / .6 : -1 + 2 * (u - .6) / .4, fwd = Math.max(0, sg), back = Math.max(0, -sg), sw = u >= .6 ? Math.sin(Math.PI * (u - .6) / .4) : 0;
    const set = (id, v) => { T[MI[id + '.' + s]] += v; };
    if(g === 'fore'){ set('deltoid', fwd * .95); set('latissimus', back * .95); set('serratus', fwd * .5); set('brachialis', sw * .95); set('flexCarpi', sw * .9); set('triceps', u < .6 ? .3 : 0); }
    else { set('hipFlex', fwd * .95); set('glutes', back * .95); set('hamstrings', sw * .75); set('tibialis', sw * .65); set('gastroc', (u < .6 ? .25 : 0) + back * .35); set('quads', u < .6 ? .2 : 0); }
  }
}
/* the actions: each is a function of time since it started; it adds to the muscle targets and may move the body channels (c.ch). */
const ACTIONS = {
  roar:{dur:2900, f(t, T, c, a){
    if(t > 1500 && !a.gl){ a.gl = 1; c.glyph(3200); }
    const e = env(t, 320, 1150, 780), hold = env(t, 360, 1000, 80), v = .045 * Math.sin(t * .05) * hold;
    spec(T, {digastric:e * 1.05 + v, depLab:e * .5, levLabii:e * .95, nasalis:e * .9, nasolab:e * .5, corrug:e * .85, orbic:e * .3, earBack:e, arrector:e * 1.1, dilator:e * .5,
      intercostals:e * .9, brachioceph:e * .5, epaxial:e * .35, levCaudae:e * .4, masseter:-e * .3, temporalis:-e * .3});
    spec(T, {deltoid:e * .15, serratus:e * .2});
    c.flushT = Math.max(c.flushT, e);
    { const wr = 1 - .5 * c.pm.w.rear, wl = 1 - .35 * c.pm.w.lie; jt(c, 'neck', -.08 * e * wr * wl + .02 * v); jt(c, 'head', -.06 * e * wr); }   // the head goes up and back and the chest lifts, in whatever posture the lion is in
  }},
  turn:{dur:3300, f(t, T, c, a){
    const e = env(t, 950, 1000, 1000), d = a.dir || 1;
    spec(T, {splenius:d > 0 ? [0, e] : [e, 0], brachioceph:e * .12, earUp:d > 0 ? [0, e * .3] : [e * .3, 0], levPalp:e * .25});
  }},
  flick:{dur:1500, f(t, T){
    spec(T, {depCaudae:pulse(t, 0, 110, 40, 200) * 1.1, flexMid:pulse(t, 90, 110, 30, 260) * 1.1, flexTip:pulse(t, 170, 110, 60, 320) * 1.3, levCaudae:pulse(t, 330, 130, 20, 400) * .9});
  }},
  blink:{dur:360, f(t, T){ const e = env(t, 70, 40, 130); spec(T, {orbic:e * 1.45, levPalp:-e * .3}); }},
  ear:{dur:700, f(t, T, c, a){ const e = env(t, 60, 40, 120) + .8 * pulse(t, 260, 60, 20, 120), L = a.side === 'L' ? 1 : 0; spec(T, {earBack:L ? [e * .9, 0] : [0, e * .9], earUp:L ? [-e * .2, 0] : [0, -e * .2]}); }},
  /* Pounce. From a held crouch (or, as a running leap, from a trot): a wind-up (the rump wiggles, the tail tip twitches, the ears and pupils fix), the load (the body sinks onto the hind legs),
     the push (the hind legs drive, the body pitches up), the flight (all four feet leave the ground, the forelegs reach and the hind legs trail, the ground slides away under the lion), the landing
     (the forepaws touch first and take the weight, the hind paws a beat later; the ground slows to a stop under planted paws) and the settle back into the crouch (or the stand, or the trot).
     Every foot is an IK target set relative to where the posture or the gait has it, so nothing is replayed from a fixed start. */
  pounce:{dur:3300, big:1, f(t, T, c, a){
    if(a.run === undefined) a.run = c.gs.on;
    const run = a.run, tt = run ? t + 760 : t, Tf = 2060, Th = 2150, Td = 320, V0 = 420, tempo = Math.max(.01, c.tempo);
    const wu = run ? 0 : K(tt, [[0, 0], [260, 1], [680, 1], [820, 0]]);
    const cr = K(tt, [[700, 0], [1000, 1], [1130, 1], [1220, 0]]), lo = K(tt, [[1000, 0], [1140, 1], [1290, 0]]);
    const arc = Math.sin(Math.PI * clamp((tt - 1230) / (Tf - 1230))), air = K(tt, [[1120, 0], [1260, 1], [Tf, 1], [Tf + 160, 0]]);
    const land = pulse(tt, Tf - 20, 120, 60, 520), settle = K(tt, [[Tf + 200, 0], [Tf + 700, 1]]);
    // the camp: ears and pupils fix on the prey, the tail tip twitches, the rump wiggles
    const wig = Math.sin(tt * .031) * wu;
    jd(c, 'pelvis', .04 * wig); jd(c, 'body', .008 * wig); c.Q.bx += 2 * wig; jd(c, 't6', .3 * wu * Math.sin(tt * .012)); jd(c, 't7', .4 * wu * Math.sin(tt * .012 + .8));
    spec(T, {dilator:[.9 * wu + .5 * air, .9 * wu + .5 * air], earUp:[.5 * wu, .5 * wu], levPalp:[.3 * wu, .3 * wu], nasalis:.2 * wu});
    { const cl = K(tt, [[900, 0], [1150, 1], [Tf + 400, 1], [Tf + 900, 0]]); spec(T, {clawFore:[cl, cl], clawHind:[cl, cl], toeSpreadFore:[cl, cl], toeSpreadHind:[cl, cl], digastric:.5 * air + .2 * land, levLabii:.35 * air, corrug:.5 * wu + .3 * air, arrector:.4 * (wu + air), hypaxial:.4 * cr + .2 * lo, intercostals:.5 * land, levCaudae:.5 * air + .3 * lo}); }
    // the body: sinks in the load, rises and falls in the arc (the root is smoothed, so the arc is drawn a little bigger), takes the landing in the chest
    c.Q.ry += 9 * wu + 24 * cr - (run ? 120 : 150) * arc + 28 * land * (run ? .5 : 1);
    c.Q.rr += K(tt, [[1000, 0], [1140, -.1], [1300, -.13], [1650, -.02], [2000, .13], [2100, .1], [2400, 0]]);
    jt(c, 'chest', .05 * cr - .04 * air + .09 * land); jt(c, 'neck', -.1 * arc + .1 * land * 0 + .04 * cr); jt(c, 'head', -.06 * arc);
    // the legs: set against where the posture (or the gait) has each foot now. In the air a foot reaches or trails; from touchdown on, a static pounce's foot stays on its point of the ground while the ground slows to a stop.
    const rr_ = tau => V0 * Td / 1000 * (.5 - tau + tau ** 3 - tau ** 4 / 2), slide = k => run ? 0 : rr_(clamp(((k < 2 ? Tf : Th) - Tf) / Td));
    for(let k = 0; k < 4; k++){
      const fore = k < 2, tl = fore ? 1210 : 1520, tc = fore ? Tf : Th, q = c.Q.legs[k]; if(!q) continue;   // the hind feet stay planted through the push, until the legs have driven out straight (hip, knee and hock extended: Round 9 measured the knee at 34 to 42 degrees through the push, because the feet used to leave the ground at 1150 with the legs still folded), then trail
      let ox, oy, ob, w;
      if(tt < tc){ const u = clamp((tt - tl) / (tc - tl)), sn = Math.sin(Math.PI * u); ox = slide(k) * u + (fore ? 98 : -135) * sn; oy = (fore ? 150 : 62) * Math.pow(sn, .85); ob = (fore ? -.45 : .42) * sn; w = K(tt, [[tl - 150, 0], [tl, 1]]); }
      else { ox = run ? 0 : rr_(clamp((tt - Tf) / Td)); oy = 0; ob = 0; w = 1 - K(tt, [[Tf + Td + 40, 0], [Tf + Td + 340, 1]]); }
      const jit = 6 * land * (fore ? 1 : .6);   // the paws splay a little on the impact
      legReq(c, k, q.x + ox * w, q.y - oy * w + jit * 0, q.b + ob * w, {kk:w > .01 ? 38 : (q.kk ?? 8), direct:w > .01 ? false : q.direct, sw:q.sw});
    }
    if(!run){ const G = K(tt, [[1230, 0], [1340, 1]]) * (1 - ss(0, 1, (tt - Tf) / Td)); c.gv += V0 * tempo * G; c.Q.ground = 1; }
    if(t > 3000 && !a.th){ a.th = 1; if(a.then) goPosture(c, a.then); }
  }},
};

const ss = (a, b, x) => fSmooth(a, b, x);
/* ---------- the gesture suite ----------
   Each gesture is a function of time that asks for a pose (the root, the joints, the feet) and adds muscle activations. Timing is written by hand:
   anticipation (the weight goes where the move will come from), staggered joints (the elbow before the paw; the neck before the head; down the tail
   each joint later than the last), secondary parts that lag (the mane's erector, the ears, the tuft) and a settle after. `big` gestures own the body:
   starting one stops another and the life layer waits for it. The pose helpers move the root about a pivot; feet planted by IK stay planted. */
const TREST = []; for(let k = 0; k < 8; k++){ const B = BONES[BI['t' + k]]; TREST.push(Math.atan2(B.q[1] - B.p[1], B.q[0] - B.p[0])); }
/* the tail by absolute directions (radians, y down) for its eight bones, blended in by k; the joint rotations are worked out from the rest directions */
const SPHINX_TAIL = [1.2, 2.1, 3.0, 3.9, 4.8, 5.7, 6.6, 7.5];   // a coil on the ground behind the haunch, turning the same way as the rest curl, so it only has to tighten
const bendsOf = (dirs, parent = 0) => dirs.map((d, i) => i ? wrapA(wrapA(d - dirs[i - 1]) - wrapA(TREST[i] - TREST[i - 1])) : wrapA(d - TREST[0] - parent));
const SPHINX_B = bendsOf(SPHINX_TAIL);
/* The tail between the rest curl and a pose: the two curl the same way, so the tail does not unroll; the bends tighten first (the tail winds up into a compact coil beside the rump)
   and then the root swings down behind the haunch. It never shoots up or out, and the tip stays within the coil's reach of the rump. */
function tailDirs(c, dirs, k, parent = 0){
  const B = dirs === SPHINX_TAIL ? SPHINX_B : bendsOf(dirs, parent), eb = fSmooth(0, 1, clamp(k * 2)), er = fSmooth(0, 1, clamp(k * 2 - .75));
  for(let i = 0; i < 8; i++) jt(c, 't' + i, B[i] * (i ? eb : er));
}
const lerp = (a, b, u) => a + (b - a) * u, rest = k => IKD[k].tip, REST_B = k => IKD[k].a[2];
const pose4 = (c, k, x, y, b, o) => legReq(c, k, x, y, b, o);
const rampE = (t, a, b, c2, d) => K(t, [[a, 0], [b, 1], [c2, 1], [d, 0]]);   // a smooth up, hold, down
function tailWave(c, t, amp, f, lag, curl = 0){   // a travelling wave down the tail: each joint later than the last, bigger toward the end
  for(let k = 0; k < 8; k++) jd(c, 't' + k, amp * (.35 + k * .12) * Math.sin(f * (t - k * lag)) + curl * (k > 1 ? .12 : .04));
}
function toTop(c, on, kind){ c.topFore(on, kind); }
/* Sitting: the rear goes down (the pelvis slides, the hind legs fold with the hocks on the ground and the paws tucked forward), the forelegs stay planted
   and straight, the chest rises a little and the tail curls round. k is how far down. */
const sitPose_unused = (c, k, o = {}, tk = k) => {
  c.Q.pdy = 168 * k; c.Q.pdx = 22 * k; jt(c, 'chest', .1 * k); jt(c, 'neck', -.06 * k); jt(c, 'head', .04 * k);
  const hf = fSmooth(0, 1, k);
  pose4(c, 2, lerp(rest(2)[0], 366, hf), lerp(rest(2)[1], 752, hf), lerp(REST_B(2), .04, hf), {kk:8});
  pose4(c, 3, lerp(rest(3)[0], 410, hf), lerp(rest(3)[1], 750, hf), lerp(REST_B(3), .05, hf), {kk:7});
  if(!o.noTail) tailDirs(c, SPHINX_TAIL, tk);
};
const headOff = (c, a, t, t0 = 480) => { if(!a.hd || t < t0){ const h = wp(c, 'head', HC); a.hd = [h[0] - HC[0], h[1] - HC[1]]; } return a.hd; };   // where the head is, against its place at rest: the posture's contribution, taken just before the action's own move begins
const shiftAmt = c => clamp(1 - .8 * c.pm.w.sit - .95 * c.pm.w.lie - .5 * c.pm.w.crouch, .1, 1);        // how much weight shift a standing action needs in this posture
/* a foot target blended from where the posture has the foot (the base layer) to the action's own: ux, uy, ub are how far along each coordinate is */
function legTo(c, k, x, y, b, ux, uy = ux, ub = ux, o = {}){
  if(o.reach){   // keep the action's own target where the leg can fold and stretch to it: a head lifted by a pad would otherwise put it inside the shoulder
    const D = IKD[k], m = c.bm, po = D.par * 6, Sx = m[po] * D.S[0] + m[po + 2] * D.S[1] + m[po + 4], Sy = m[po + 1] * D.S[0] + m[po + 3] * D.S[1] + m[po + 5], dx = x - Sx, dy = y - Sy, d = Math.hypot(dx, dy) || 1, dd = clamp(d, o.reach[0], o.reach[1]);
    x = Sx + dx / d * dd; y = Sy + dy / d * dd;
  }
  const q = c.Q.legs[k] || {x:rest(k)[0], y:rest(k)[1], b:REST_B(k)}; legReq(c, k, lerp(q.x, x, ux), lerp(q.y, y, uy), lerp(q.b, b, ub), o); }
const ACTIONS2 = {
  /* GROOMING */
  /* Lick: the weight goes back (anticipation; less when sitting, none when lying), the elbow lifts, the paw follows and comes forward to the mouth, the head dips to meet it and works over it in strokes, the tongue
     pulsing with them; then the head lifts first, the paw lowers and plants, and the weight returns. Where the mouth is comes from where the head is when the action starts, so it works in any posture that has a free foreleg. */
  lick:{dur:5000, big:1, f(t, T, c, a){
    const hd = headOff(c, a, t), A = shiftAmt(c);
    const wt = K(t, [[0, 0], [450, 1], [1500, .6], [3900, .6], [4800, 0]]);                      // weight shift back
    const ul = K(t, [[0, 0], [500, 0], [1500, 1], [3700, 1], [4400, 0]]), uf = K(t, [[0, 0], [900, 0], [1850, 1], [3600, 1], [4300, 0]]);   // the paw lifts, then comes forward
    const hdp = K(t, [[0, 0], [700, 0], [1800, 1], [3500, 1], [4150, 0]]);                         // the head dips to meet it
    const str = K(t, [[0, 0], [1700, 0], [2000, 1], [3300, 1], [3600, 0]]), ph = (t - 1700) * .0115, st = Math.sin(ph) * str;
    toTop(c, uf > .3 && t < 4300);
    rootAbout(c, [420, 405], -.03 * wt * A, -12 * wt * A, 4 * hdp * A);
    legTo(c, 0, 778 + hd[0] + 8 * st, 482 + hd[1] + 5 * st, -.42, uf, ul, uf, {kk:9, reach:[165, 232]});
    jt(c, 'neck', .42 * hdp + .04 * st); jt(c, 'head', .2 * hdp + .07 * st); jt(c, 'chest', .04 * hdp * A);
    c.Q.yaw += .06 * hdp;
    spec(T, {tongueOut:str * (.5 + .5 * Math.max(0, Math.sin(ph + 1.2))), digastric:.26 * str + .08 * hdp, orbic:.5 * hdp, earBack:.35 * hdp, depLab:.2 * str, tongueCurl:.3 * str, flexTip:.25 * hdp});
    spec(T, {deltoid:[.5 * ul, 0], brachialis:[.8 * ul, 0], flexCarpi:[.5 * uf, 0]});
    tailWave(c, t, .08 * wt, .0021, 220);
  }},
  wipe:{dur:4200, big:1, f(t, T, c, a){
    const hd = headOff(c, a, t), A = shiftAmt(c);
    const u = K(t, [[0, 0], [600, 0], [1300, 1], [3300, 1], [3900, 0]]), uw = K(t, [[0, 0], [800, 0], [1400, 1], [3300, 1], [3900, 0]]);
    const sw = Math.sin((t - 1300) * .0072), sweep = (t > 1300 && t < 3300) ? sw : 0, sa = rampE(t, 1300, 1600, 3100, 3300);
    toTop(c, uw > .3 && t < 3900);
    rootAbout(c, [420, 405], -.014 * u * A, -12 * u * A, 7 * u * A);
    // the paw goes up the face (rising as it passes the brow) and back down the cheek
    const py = 330 + hd[1] - 62 * sweep * sa, px = 744 + hd[0] - 8 * sweep * sa;
    legTo(c, 0, px, py, -1.75 + .25 * sweep * sa, uw, uw, uw, {kk:12, reach:[165, 232]});
    jt(c, 'neck', .1 * u); jt(c, 'head', .06 * u); c.Q.yaw += -.18 * u;
    const closing = fSmooth(300 + hd[1], 255 + hd[1], py) * u;   // the eyes close as the paw passes them
    spec(T, {orbic:[.2 * u + 1.25 * closing, .2 * u + 1.25 * closing], earBack:[0, .9 * u], nasalis:.3 * sa * Math.abs(sweep), depLab:.2 * u});
  }},
  /* SHAKE: a wave from the head to the tail */
  shake:{dur:3300, big:1, f(t, T, c, a2){
    // a crouch and a flick of the head the other way (anticipation), then a shake that starts at the head and travels to the tail: each segment starts later and
    // is phased behind the one before; the mane flies out and settles late, the ears flap, and the legs flex under the body's bounce (the feet stay planted)
    const env = d => Math.max(0, K(t - d, [[0, 0], [300, -.28], [640, 1], [1450, .85], [2500, 0]])), pre = K(t, [[0, 0], [300, 1], [650, 0]]);
    const w = .04, ph = (k, o = 0) => Math.sin(w * (t - 95 * k) + o);
    const A = shiftAmt(c), Bq = clamp(1 - .45 * c.pm.w.sit - .6 * c.pm.w.lie, .3, 1);   // a sitting or lying lion shakes with less of the body's bounce, and no crouch
    rootAbout(c, [420, 405], -.012 * pre * A, 0, 12 * pre * A + 26 * env(140) * A);   // the body sinks into its legs a little while it shakes, so the bounce never lifts a planted foot
    c.Q.yaw += .5 * env(0) * ph(0);
    jd(c, 'head', .2 * env(0) * ph(.4)); jd(c, 'neck', .14 * env(60) * ph(1)); jd(c, 'chest', .075 * env(140) * ph(2)); jd(c, 'body', .03 * env(200) * ph(3)); jd(c, 'pelvis', .08 * env(260) * ph(4));
    c.Q.by += 9 * Bq * env(160) * Math.sin(w * 2 * (t - 95 * 2)); c.Q.bx += 8 * Bq * env(160) * Math.sin(w * (t - 95 * 2) - .6);
    for(let k = 0; k < 8; k++) jd(c, 't' + k, .17 * (k + 1) / 8 * env(280 + 40 * k) * ph(5 + k * .9));
    jd(c, 'earR', .8 * env(30) * ph(.2)); jd(c, 'earL', -.8 * env(30) * ph(.6));
    const m = env(140);
    spec(T, {arrector:[.85 * m + .3 * pre, .85 * m + .3 * pre], earBack:[.5 * env(30), .5 * env(30)], orbic:.7 * env(0), depLab:.3 * env(0) * Math.abs(ph(.5)), levLabii:.2 * env(0), intercostals:.4 * env(100)});
    if(t > 500 && !a2.fl){ a2.fl = 1; waveFlips(c, c.t, 1400); }
  }},
  /* HIND LEGS */
  scratch:{dur:5800, big:1, f(t, T, c){
    const u = K(t, [[0, 0], [500, 0], [1500, 1], [4400, 1], [5200, 0]]), ua = K(t, [[0, 0], [1200, 0], [1700, 1], [4100, 1], [4700, 0]]), p = K(t, [[0, 0], [350, 1], [800, 0]]);
    const kick = Math.sin((t - 1400) * .043), kick2 = Math.sin((t - 1400) * .043 * .5 + .8);
    rootAbout(c, [420, 405], .012 * p, -3 * p, -2 * p);
    toTop(c, u > .3 && t < 5000, 'hind');
    // the near hind foot comes up to the neck, the knee leading; the head tilts down into it; then fast, repeated kicks
    const hip = wp(c, 'femN', [266, 418]);
    legTo(c, 2, hip[0] + 262 + 15 * kick * ua, hip[1] - 168 + 10 * kick * ua, -.95 + .3 * kick * ua, u, u, u, {kk:10});
    jt(c, 'neck', .5 * u + .02 * kick * ua); jt(c, 'head', .3 * u + .06 * kick * ua); c.Q.yaw += -.1 * u; jt(c, 'chest', .06 * u + .015 * kick2 * ua);
    spec(T, {orbic:.62 * u, earBack:.6 * u, nasalis:.12 * ua, intercostals:.2 * u + .2 * ua * Math.abs(kick), depLab:.1 * ua, clawHind:[.9 * ua, 0], toeSpreadHind:[.5 * ua, 0], lookD:[.4 * u, .4 * u]});   // the claws come out for the kicks
    c.Q.by += 2 * ua * kick2;
  }},
  stretch:{dur:7600, big:1, f(t, T, c){
    const bow = K(t, [[0, 0], [1100, 1], [3300, 1], [4300, 0]]), back = K(t, [[0, 0], [4200, 0], [5300, 1], [6500, 1], [7400, 0]]), ant = K(t, [[0, 0], [350, 1], [800, 0]]);
    // the play bow: pivot on the forepaws, the chest sinks and the rump rises; the forepaws reach ahead
    rootAbout(c, [640, 742], .42 * bow, -12 * ant, 130 * bow + 6 * ant); c.Q.cam = {s:1 + .16 * bow, x:500 + 76 * bow, y:390 + 18 * bow};
    pose4(c, 0, rest(0)[0] + 96 * bow, 742, REST_B(0) - .2 * bow, {kk:9}); pose4(c, 1, rest(1)[0] + 110 * bow, 738, REST_B(1) - .2 * bow, {kk:8});
    // then the back stretch: the hind legs go out behind, the forelegs reach, the spine dips and the head comes up
    rootAbout(c, [266, 742], -.2 * back, 40 * back, -4 * back);
    pose4(c, 2, rest(2)[0] - 70 * back, 742, REST_B(2) + .15 * back, {kk:8}); pose4(c, 3, rest(3)[0] - 40 * back, 738, REST_B(3) + .15 * back, {kk:8});
    jt(c, 'neck', -.28 * back + .08 * bow); jt(c, 'head', -.2 * back); jt(c, 'chest', .12 * back); jt(c, 'pelvis', -.1 * back);
    for(let q = 0; q < 8; q++) jt(c, 't' + q, -.14 * (back + bow));
    spec(T, {epaxial:-.0, hypaxial:.6 * back, intercostals:.6 * (bow + back), digastric:.55 * back, orbic:.9 * back, earBack:.5 * back, levCaudae:.4 * bow + .5 * back, nasalis:.3 * back, tongueOut:.25 * back, clawFore:[.8 * bow, .8 * bow], clawHind:[.8 * back, .8 * back], toeSpreadFore:[.6 * bow, .6 * bow], toeSpreadHind:[.6 * back, .6 * back]});   // a stretching cat spreads its toes and puts its claws out
  }},
  yawn:{dur:4600, big:1, f(t, T, c){
    const o = K(t, [[0, 0], [650, 0], [1250, 1], [2500, 1], [3500, 0]]), inh = K(t, [[0, 0], [650, 1], [1250, 0]]), sq = K(t, [[0, 0], [800, 0], [1300, 1], [2550, 1], [3300, 0]]), tg = K(t, [[0, 0], [1500, 0], [2000, 1], [2600, 1], [3300, 0]]);
    rootAbout(c, [420, 405], -.02 * o + .02 * inh, -4 * o, -6 * inh);
    jt(c, 'neck', -.22 * o); jt(c, 'head', -.18 * o); jt(c, 'chest', -.04 * o);
    spec(T, {digastric:1.7 * o + .04 * Math.sin(t * .02) * o, depLab:.7 * o, orbic:1.45 * sq, levLabii:.5 * o, nasalis:.8 * o, nasolab:.6 * o, tongueOut:.5 * tg, tongueCurl:1 * tg, earBack:.9 * o, arrector:.35 * o, intercostals:1.3 * inh + .3 * o, corrug:.4 * o});
    c.flushT = Math.max(c.flushT, .5 * o);
  }},
  slowblink:{dur:3200, big:0, f(t, T, c){
    const b = K(t, [[0, 0], [850, 1], [1500, 1], [2500, 0]]);
    jt(c, 'head', .05 * b); jt(c, 'neck', .03 * b); c.Q.yaw += .08 * b;
    spec(T, {orbic:1.35 * b, levPalp:-.4 * b, earBack:.25 * b, nasolab:.12 * b, intercostals:.3 * b});
  }},
  /* HEAD AND SENSES */
  sniff:{dur:6200, big:1, f(t, T, c){
    const lo = K(t, [[0, 0], [700, 1], [3000, 1], [3600, 0]]), fl = K(t, [[0, 0], [3300, 0], [3900, 1], [5300, 1], [6000, 0]]), sn = lo * (.5 + .5 * Math.sin(t * .021)) * (1 - fl);
    rootAbout(c, [420, 405], .05 * lo * shiftAmt(c), 18 * lo * shiftAmt(c), 20 * lo * shiftAmt(c) - 2 * fl);
    jt(c, 'neck', .42 * lo - .62 * fl); jt(c, 'head', .12 * lo - .3 * fl); jt(c, 'chest', .08 * lo - .02 * fl);
    c.Q.yaw += .2 * Math.sin(t * .0016) * lo;
    spec(T, {nasalis:.45 * sn + .8 * fl, nasolab:.35 * sn + .4 * fl, levLabii:.15 * lo + 1.15 * fl, digastric:.55 * fl, depLab:.2 * fl, orbic:.7 * fl, levPalp:.1 * lo, earBack:.3 * lo, corrug:.5 * fl, tongueOut:.1 * lo * sn, flexTip:.3 * lo, lookD:[.7 * lo * (1 - fl), .7 * lo * (1 - fl)], lookU:[.5 * fl, .5 * fl]});
  }},
  flehmen:{dur:3600, big:1, f(t, T, c){
    const fl = K(t, [[0, 0], [600, 1], [2600, 1], [3400, 0]]);
    jt(c, 'neck', -.6 * fl); jt(c, 'head', -.3 * fl); rootAbout(c, [420, 405], -.02 * fl, 0, 0);
    spec(T, {nasalis:.9 * fl, nasolab:.4 * fl, levLabii:1.2 * fl, digastric:.5 * fl, depLab:.2 * fl, orbic:.7 * fl, corrug:.5 * fl, earBack:.25 * fl});
  }},
  toss:{dur:2000, big:0, f(t, T, c){
    const a = K(t, [[0, 0], [260, -1], [560, 1.25], [820, .15], [1300, 0]]), m = K(t, [[0, 0], [560, 0], [700, 1.2], [1300, 0]]);
    jt(c, 'neck', .22 * a); jt(c, 'head', .2 * a); rootAbout(c, [420, 405], -.018 * a, 0, -5 * Math.max(a, 0));
    spec(T, {arrector:[m, m], earBack:[.5 * Math.max(a, 0), .5 * Math.max(a, 0)], depLab:.1 * m, orbic:.3 * Math.max(a, 0)});
    jd(c, 'earR', .5 * m * Math.sin(t * .03)); jd(c, 'earL', -.5 * m * Math.sin(t * .03));
  }},
  listen:{dur:4400, big:0, f(t, T, c){
    const L = K(t, [[0, 0], [380, 1], [1500, .2], [2100, -.4], [3200, -.4], [4000, 0]]), R = K(t, [[0, 0], [700, 0], [1050, 1], [2700, 1], [3500, 0]]), h = K(t, [[0, 0], [450, 1], [3000, 1], [4200, 0]]);
    spec(T, {earUp:[Math.max(0, L), Math.max(0, R)], earBack:[Math.max(0, -L), 0]});
    c.Q.yaw += .22 * h; jt(c, 'neck', -.04 * h); spec(T, {levPalp:[.3 * h, .3 * h], nasalis:.1 * h, frontalis:[.45 * h, .45 * h]});
  }},
  /* TAIL */
  sigh:{dur:2800, big:0, f(t, T, c){
    const e = K(t, [[0, 0], [1000, 1], [1300, .95], [2600, 0]]), x = K(t, [[0, 0], [1200, 0], [1500, 1], [2700, 0]]);
    jt(c, 'chest', -.022 * e); jt(c, 'neck', .018 * e - .02 * x); rootAbout(c, [420, 405], 0, 0, -3 * e + 4 * x);
    spec(T, {intercostals:1.15 * e - .5 * x, epaxial:.1 * e, arrector:.1 * e, nasalis:.12 * e, levPalp:.1 * e, earBack:.12 * x});
  }},
  glance:{dur:2600, big:0, f(t, T, c, a){
    const d = a.dir || 1, g = K(t, [[0, 0], [300, 1], [1500, 1], [2400, 0]]), gz = K(t, [[0, 0], [160, 1], [1550, 1], [2200, 0]]);
    c.Q.yaw += .17 * d * g; jt(c, 'neck', -.02 * g); jt(c, 'head', .02 * g);
    spec(T, {lookR:d > 0 ? [gz, gz] : 0, lookL:d < 0 ? [gz, gz] : 0, levPalp:.15 * g, earUp:d > 0 ? [0, .3 * g] : [.3 * g, 0]});
  }},
  swish:{dur:3000, big:0, f(t, T, c){
    const e = K(t, [[0, 0], [500, 1], [2100, 1], [3000, 0]]);
    tailWave(c, t, .36 * e, .0033, 150);
    jd(c, 't7', .38 * e * Math.sin(.0033 * (t - 150 * 8) + .9) + .2 * e * Math.sin(.011 * t));   // the tuft flicks at the end of the move
    spec(T, {levCaudae:.4 * e, flexTip:.6 * e * (.5 + .5 * Math.sin(.0033 * t))});
  }},
  lash:{dur:2400, big:0, f(t, T, c){
    const e = K(t, [[0, 0], [260, 1], [1700, 1], [2400, 0]]), q = Math.sin(.0105 * t);
    rootAbout(c, [420, 405], .0, 0, 0);
    tailWave(c, t, .5 * e, .0088, 70, .3);
    jd(c, 't7', .4 * e * Math.sin(.0088 * (t - 70 * 8) + 1.2));
    jt(c, 'pelvis', -.04 * e); c.Q.yaw += -.12 * e;
    spec(T, {depCaudae:.8 * e * Math.max(0, q), levCaudae:.9 * e * Math.max(0, -q), flexMid:.8 * e, flexTip:1 * e * Math.abs(q), earBack:.8 * e, orbic:.45 * e, levLabii:.28 * e * Math.abs(q), corrug:.6 * e, nasolab:.2 * e});
  }},
  shift:{dur:1700, big:0, f(t, T, c){
    const a = K(t, [[0, 0], [450, 1], [1200, 1], [1700, 0]]);
    rootAbout(c, [420, 405], -.012 * a, 10 * a, 0); legReq(c, 3, rest(3)[0] + 8 * a, 738 - 8 * a * Math.sin(Math.PI * K(t, [[300, 0], [900, 1]])), REST_B(3) + .3 * a * Math.sin(Math.PI * K(t, [[300, 0], [900, 1]])), {kk:9});
    jt(c, 'head', -.03 * a);
  }},
};
Object.assign(ACTIONS, ACTIONS2);
/* a wave of panel flips that rides the shake: from the head to the tail over the body skin */
function waveFlips(c, now, span){
  const st = c.stops;
  for(const i of FLIPPABLE){ const d = clamp((PCX[i] - 150) / 800); flip(c, i, now, (1 - d) * span * .75, {col:palInt(st, c.rand()), dur:200, hold:420, w:.6}); }
}
/* The life layer: when nothing big is playing the lion now and then does something on its own, so a lion left alone is always gently alive. Each entry is [name, weight, cooldown ms, the postures it
   suits]. A choice is weighted down for a while after it was made and never repeats itself back to back, so it varies. `rate` scales how often. Small actions are layers over whatever posture the lion
   is in; the lion also chooses its postures over time (sits, lies a while, stands up, walks a few steps, crouches and pounces), each held for a while first. */
const ALLP = ['stand', 'sit', 'lie', 'crouch'];
const LIFE = [['ear', 4, 3000], ['blink2', 2.5, 5000], ['swish', 3, 6000], ['shift', 3, 6000, ['stand']], ['glance', 3, 5000], ['sigh', 2.5, 9000, ALLP], ['slowblink', 2, 9000, ALLP], ['listen', 1.4, 14000], ['flick', 1.6, 8000],
  ['glyph', 1.6, 12000], ['toss', .8, 20000], ['lash', .35, 40000, ALLP], ['yawn', .8, 30000, ['stand', 'sit', 'lie']], ['sniff', .45, 40000, ['stand', 'sit']], ['lick', .5, 40000, ['stand', 'sit', 'lie']], ['wipe', .4, 50000, ['stand', 'sit', 'lie']],
  ['shake', .25, 70000, ['stand', 'sit']], ['stretch', .15, 90000, ['stand']], ['scratch', .55, 60000, ['sit']]];
const LIFE_MOVES = [['go:sit', .8, 28000, ['stand']], ['go:lie', .4, 40000, ['stand', 'sit']], ['go:stand', 1.1, 0, ['sit', 'lie', 'crouch', 'rear'], {crouch:.35, sit:1.2, lie:1.0}], ['walk', .9, 22000, ['stand']], ['trot', .35, 50000, ['stand']], ['go:crouch', .4, 60000, ['stand']],
  ['pounce', .6, 20000, ['crouch']], ['stalk', .35, 40000, ['crouch']], ['go:rear', .14, 110000, ['stand']]];
const DWELL = {stand:[4000, 9000], sit:[9000, 22000], lie:[10000, 26000], crouch:[2500, 5200], rear:[2600, 4600]};
const GAIT_LIFE = [['toss', .8, 20000], ['glance', 3, 5000], ['ear', 4, 3000], ['sniff', .5, 30000], ['swish', 2, 6000], ['roar', .12, 90000]];
function lifeStep(c, now){
  const L = c.life; if(!L.on) return;
  const S = c.pm, g = c.gs;
  if(L.node !== S.node && !S.tr){ L.node = S.node; const d = DWELL[S.node]; L.dwell = now + (d[0] + c.rand() * (d[1] - d[0])) / Math.max(.2, L.rate / 2.4); }
  if(c.actions.some(a => ACTIONS[a.name].big && !a.cut) || S.tr || S.route.length || S.after || S.pend.length || (g.on && g.phase === 'stop')){ L.next = Math.max(L.next, now + 1400); return; }
  if(now < L.next) return;
  const choose = (list, here) => {
    const w = list.map(([n, wt, cd, ok, wm]) => (n === L.last || (ok && !ok.includes(here))) ? 0 : ((wm && wm[here]) ?? wt) * clamp(((now - (L.at[n] ?? -1e9)) / cd) || 1, .04, 1));
    let r = c.rand() * w.reduce((a, b) => a + b, 0); if(!(r > 0)) return null;
    for(let i = 0; i < list.length; i++){ if((r -= w[i]) < 0) return list[i][0]; } return null;
  };
  let pick;
  if(g.on){   // a walk is on: a small thing on the upper body now and then; the walk ends on its own timer
    pick = choose(GAIT_LIFE, 'walk'); L.next = now + (2200 + c.rand() * 3800) / Math.max(.05, L.rate);
    if(g.psi >= 1.4 && c.rand() < .08){ L.last = 'pounce'; c.play('pounce', {then:null}); return; }
  } else {
    const here = S.node, moving = now >= L.dwell;
    if(here === 'rear' && moving){ L.last = 'go:stand'; c.go('stand'); L.next = now + 1200; return; }
    if(moving && c.rand() < clamp(.4 + (now - L.dwell) / 20000, .4, .9)) pick = choose(LIFE_MOVES, here);   // once it has stayed in a posture a while, it is likely to move on
    if(!pick) pick = choose(LIFE, here);
    L.next = now + (1800 + c.rand() * 4200) / Math.max(.05, L.rate);
  }
  if(!pick) return;
  L.last = pick; L.at[pick] = now;
  if(pick === 'ear') c.actions.push({name:'ear', t0:now, side:c.rand() < .5 ? 'L' : 'R'});
  else if(pick === 'blink2'){ c.actions.push({name:'blink', t0:now}); c.actions.push({name:'blink', t0:now + 260}); }
  else if(pick === 'glance') c.actions.push({name:'glance', t0:now, dir:c.rand() < .5 ? -1 : 1});
  else if(pick === 'glyph') c.glyph(2800 + c.rand() * 800);
  else if(pick.startsWith('go:')){ c.go(pick.slice(3)); L.next = now + 1200; }
  else if(pick === 'walk'){ c.go('walk', {for:(3200 + c.rand() * 4500) * 2.4 / Math.max(.4, L.rate)}); L.next = now + 3000; }
  else if(pick === 'trot'){ c.go('trot', {for:(2400 + c.rand() * 2400) * 2.4 / Math.max(.4, L.rate)}); L.next = now + 2500; }
  else if(pick === 'stalk'){ c.go('stalk', {for:3400 + c.rand() * 3200}); L.next = now + 2500; }
  else if(pick === 'pounce'){ c.play('pounce', {then:c.rand() < .5 ? 'stand' : null}); L.next = now + 3000; }
  else c.play(pick);
}
const IDLE_BLINK = [2400, 6200], IDLE_EAR = [7000, 15000], IDLE_GLANCE = [9000, 18000];

/* ---------- the pads: two-axis controls over muscle groups, as the face rig's pads. x and y run -1..1. The pucks set a manual
   layer that adds to the actions; split pads take one puck per side (L, R for the head; near, far for the limbs). ---------- */
const pos = v => Math.max(0, v);
const ga = (c, id, s) => { const d = MUSCLE_DEFS[id], n = d.pair ? MI[id + '.' + SIDES[d.pair][s]] : MI[id + '.C']; return c.acts[n] || 0; };
const cl = v => Math.max(-1, Math.min(1, v));
const PADS = {
  jaw:   {label:'Jaw', x:['bite', 'snarl'], y:['shut', 'open'], map:(x, y) => ({digastric:pos(y), depLab:.6 * pos(y), masseter:.8 * pos(-x), temporalis:.8 * pos(-x), levLabii:.9 * pos(x), nasalis:.5 * pos(x)}),
    ghost:(c) => [cl(ga(c, 'levLabii', 0) - ga(c, 'masseter', 0)), cl(ga(c, 'digastric', 0))]},
  muzzle:{label:'Muzzle', split:'LR', x:['pads', 'wrinkle'], y:['lower', 'lift'], map:(x, y) => ({nasolab:pos(-x), nasalis:pos(x), levLabii:.8 * pos(y), depLab:.8 * pos(-y)}),
    ghost:(c, s) => [cl(ga(c, 'nasalis', s) - ga(c, 'nasolab', s)), cl(ga(c, 'levLabii', s) - ga(c, 'depLab', s))]},
  brows: {label:'Brow · lids', split:'LR', x:['squint', 'wide'], y:['knit', 'raise'], map:(x, y) => ({orbic:pos(-x), levPalp:pos(x), corrug:pos(-y), frontalis:pos(y)}),
    ghost:(c, s) => [cl(ga(c, 'levPalp', s) - ga(c, 'orbic', s)), cl(ga(c, 'frontalis', s) - ga(c, 'corrug', s))]},
  ears:  {label:'Ears', split:'LR', x:['back', 'forward'], y:['droop', 'perk'], map:(x, y) => ({earBack:pos(-x) + .5 * pos(-y), earUp:pos(x) + .8 * pos(y)}),
    ghost:(c, s) => [cl(ga(c, 'earUp', s) - ga(c, 'earBack', s)), cl(ga(c, 'earUp', s) - ga(c, 'earBack', s) * .5)]},
  gaze:  {label:'Gaze', x:['left', 'right'], y:['down', 'up'], map:(x, y) => ({lookR:pos(x), lookL:pos(-x), lookU:pos(y), lookD:pos(-y)}),
    ghost:(c) => [cl(ga(c, 'lookR', 0) - ga(c, 'lookL', 0)), cl(ga(c, 'lookU', 0) - ga(c, 'lookD', 0))]},
  head:  {label:'Head', x:['yaw left', 'yaw right'], y:['nod', 'lift'], map:(x, y) => ({splenius:[pos(-x), pos(x)], longusColli:pos(-y), nuchal:pos(y)}), fx:(c, x, y) => { c.Q.jt[BI.neck] += -.3 * y; c.Q.jt[BI.head] += -.1 * y; },   // lift and nod: the pose channels carry most of it (so the legs never notice) and the nuchal extensors or the flexors (longus colli) the rest, a real pair
    ghost:(c) => [cl(ga(c, 'splenius', 1) - ga(c, 'splenius', 0)), cl(-c.rot[BI.neck] / .5)]},
  mane:  {label:'Mane', x:['sleek', 'erect'], y:['still', 'ripple'], map:x => ({arrector:x}), fx:(c, x, y) => { c.rippleRate = pos(y); },
    ghost:(c) => [cl(ga(c, 'arrector', 0)), cl(c.rippleRate || 0)]},
  spine: {label:'Spine', x:['sway', 'arch'], y:['crouch', 'rise'], map:(x, y) => ({epaxial:pos(-x), hypaxial:pos(x)}),
    fx:(c, x, y) => { c.Q.ry += 20 * pos(-y) - 3 * pos(y); c.Q.jt[BI.chest] += -.07 * y; c.Q.jt[BI.neck] += .12 * pos(-y); },   // the body's height goes through the pose channel, not the muscles: the planted feet stay planted and the IK flexes the legs
    ghost:(c) => [cl((c.jr[BI.pelvis] - c.jr[BI.chest]) / .2), cl(-c.root.y / 20)]},
  /* The leg pads are offsets inside the IK, on top of the gait or the pose: reach shifts the foot target along the ground, flex lifts the paw and curls it (scaled by how much of a swing the
     foot is in, so a planted foot is never lifted), extend flattens the swing. `map` is only used when a gesture hands the legs to the muscles (the pounce). */
  foreleg:{label:'Foreleg', split:'NF', leg:'fore', x:['back', 'reach'], y:['flex', 'extend'], map:(x, y) => ({deltoid:pos(x), latissimus:pos(-x), serratus:.4 * pos(x), brachialis:pos(-y), flexCarpi:.7 * pos(-y), triceps:pos(y), extCarpi:.5 * pos(y)}),
    ghost:(c, s) => legGhost(c, s)},
  hindleg:{label:'Hindleg', split:'NF', leg:'hind', x:['drive', 'swing'], y:['flex', 'extend'], map:(x, y) => ({glutes:pos(-x), gastroc:.5 * pos(-x) + .4 * pos(y), hipFlex:pos(x), hamstrings:pos(-y), tibialis:.7 * pos(-y), quads:pos(y)}),
    ghost:(c, s) => legGhost(c, 2 + s)},
  /* The paws: the toe flexors and extensors turn the digit bones, and the claw protractor draws the claws out of their sheaths (they grow out of the toe: no pop). One pad a pair. */
  forepaw:{label:'Forepaws', x:['extend', 'curl'], y:['claws in', 'claws out'], map:(x, y) => ({toeExtFore:pos(-x), toeGripFore:pos(x), clawFore:pos(y), toeSpreadFore:.6 * pos(y)}),
    ghost:(c) => [cl(ga(c, 'toeGripFore', 0) - ga(c, 'toeExtFore', 0)), cl(ga(c, 'clawFore', 0))]},
  hindpaw:{label:'Hindpaws', x:['extend', 'curl'], y:['claws in', 'claws out'], map:(x, y) => ({toeExtHind:pos(-x), toeGripHind:pos(x), clawHind:pos(y), toeSpreadHind:.6 * pos(y)}),
    ghost:(c) => [cl(ga(c, 'toeGripHind', 0) - ga(c, 'toeExtHind', 0)), cl(ga(c, 'clawHind', 0))]},
  tail:  {label:'Tail', x:['lower', 'lift'], y:['uncurl', 'curl'], map:(x, y) => ({depCaudae:pos(-x), levCaudae:pos(x), flexMid:pos(y), flexTip:y}),
    ghost:(c) => [cl(ga(c, 'levCaudae', 0) - ga(c, 'depCaudae', 0)), cl(ga(c, 'flexTip', 0))]},
  breath:{label:'Breath', x:['shallow', 'deep'], y:['slow', 'fast'], map:() => ({}), fx:(c, x, y) => { c.breath.depth = 2 ** (x * 1.4); c.breath.rate = 2 ** (y * 1.2); },
    ghost:(c) => [cl(Math.log2(c.breath.depth) / 1.4), cl(Math.log2(c.breath.rate) / 1.2)]},
  dynamics:{label:'Dynamics', special:1, x:['slow', 'quick'], y:['loose', 'tight'], ghost:(c) => [cl(Math.log2(c.tempo)), cl((c.dyn.damp - .78) / .55)]},
  motion:{label:'Motion', special:1, x:['small', 'large'], y:['still', 'lively'], ghost:(c) => [cl(Math.log2(c.mot.scale) / 1.2), cl(Math.log2(c.mot.idle) / 1.2)]},
};
/* where the foot actually is against its rest place, as the pad's axes: the ghost shows the real pose, gait included */
function legGhost(c, k){ const D = IKD[k], L = c.leg[k]; return [cl((L.x - D.tip[0]) / 40), cl((D.tip[1] - L.y) / 70)]; }
const PAD_ORDER = ['jaw', 'muzzle', 'brows', 'ears', 'gaze', 'head', 'mane', 'spine', 'foreleg', 'hindleg', 'forepaw', 'hindpaw', 'tail', 'breath', 'dynamics', 'motion'];
const newPads = () => Object.fromEntries(PAD_ORDER.map(k => [k, {L:[0, 0], R:[0, 0], split:false}]));
/* the pucks' layer: each pad's muscles for this frame, into T; dynamics and motion set the springs and the scale */
function padsApply(c, T, now){
  const p = c.pad;
  c.dyn.speed = 2 ** p.dynamics.L[0]; c.dyn.damp = .78 + p.dynamics.L[1] * (p.dynamics.L[1] > 0 ? .57 : .48);   // tempo (x0.5 to x2) and the damping of the secondary chains
  c.mot.scale = 2 ** (.9 * p.motion.L[0]); c.mot.idle = 2 ** (1.2 * p.motion.L[1]);
  c.Tleg.fill(0);
  for(const name of PAD_ORDER){
    const P = PADS[name], q = p[name]; if(P.special) continue;
    const a = q.L, b = q.split ? q.R : q.L;
    if(P.leg){ const k0 = P.leg === 'fore' ? 0 : 2; c.padLegRaw[k0 * 2] = a[0]; c.padLegRaw[k0 * 2 + 1] = a[1]; c.padLegRaw[(k0 + 1) * 2] = b[0]; c.padLegRaw[(k0 + 1) * 2 + 1] = b[1]; }   // offsets inside the IK (see step)
    if(Math.abs(a[0]) + Math.abs(a[1]) + Math.abs(b[0]) + Math.abs(b[1]) < .02 && !P.alwaysFx) continue;
    const SA = P.map(a[0], a[1]), SB = P.map(b[0], b[1]), S = {};
    for(const k of new Set([...Object.keys(SA), ...Object.keys(SB)])){ const va = SA[k] || 0, vb = SB[k] || 0; S[k] = Array.isArray(va) ? va : [va, vb]; }
    spec(P.leg ? c.Tleg : T, S);   // a leg pad's muscle targets are kept aside: they only apply when the legs are on the muscles
    if(P.fx) P.fx(c, a[0], a[1]);
  }
}

/* The behaviour palette: the colours that drift, jitter, bursts, ripples, flips and holds, the mane ripple, the field and the glyph pulse draw from.
   One or more hex colours (a single one is used flat); settable live with setBehPalette. */
const BEH_PAL = [ROSTER.malachite, ROSTER.lapis, ROSTER.gold, ROSTER.cinnabar];
const stopsOf = list => { const a = list.map(hexInt); return a.length > 1 ? a : [a[0], a[0]]; };

/* ---------- a live creature ---------- */
const LIVE = [], CSS_ID = 'creature-css';
function ensureCss(){
  if(document.getElementById(CSS_ID)) return;
  const st = document.createElement('style'); st.id = CSS_ID;
  st.textContent = '.creature .pn{transform-box:fill-box;transform-origin:center}.creature.anat-on .part{opacity:.28}.creature .anat .fiber{fill:none;stroke-linecap:round;cursor:pointer}.creature .anat .bone{fill:#eadcc8;fill-opacity:.16;stroke:#f4ead8;stroke-width:2;stroke-linejoin:round}.creature .anat .bone.line{fill:none;stroke-width:2.4}.creature .anat .jt{fill:#f4ead8;fill-opacity:.8}';
  document.head.appendChild(st);
}
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for(const k in attrs) e.setAttribute(k, attrs[k]); return e; };

function mountCreature(el, o = {}){
  const opt = {size:o.size || 320, live:!!o.live, palette:o.palette, view:o.view || 'skin', seed:o.seed ?? 7};
  if(!opt.live){
    el.innerHTML = restSvg({size:opt.size, palette:opt.palette});
    return {live:false, el, setPalette(p){ opt.palette = p; el.innerHTML = restSvg({size:opt.size, palette:p}); }, resize(n){ opt.size = n; el.innerHTML = restSvg({size:n, palette:opt.palette}); }, destroy(){ el.innerHTML = ''; }};
  }
  ensureCss();
  const c = {el, opt, size:opt.size, view:opt.view, rand:rng(opt.seed), flips:new Map(), hold:new Map(), beh:{style:'drift', rate:.6}, flipAcc:0, actions:[], paused:false, last:0, cpu:0, frames:0, cpuAvg:0, t:0,
    acts:new Float32Array(NM), T:new Float32Array(NM), Ti:new Float32Array(NM), Ta:new Float32Array(NM), Tp:new Float32Array(NM), vel:new Float32Array(NM), drawn:new Float32Array(NM), direct:new Float32Array(NM), delay:new Float32Array(NM),
    rot:new Float32Array(NB), sx:new Float32Array(NB), sy:new Float32Array(NB), bm:new Float32Array(NB * 6), bmPrev:new Float32Array(NB * 6), bMoved:new Uint8Array(NB),
    DX:new Float32Array(NVERT), DY:new Float32Array(NVERT), X:new Float32Array(NVERT), Y:new Float32Array(NVERT), shade:new Float32Array(NPOLY), shadeDrawn:new Float32Array(NPOLY), vs:new Array(NVERT), pstr:new Array(NPOLY).fill(''), pnew:new Array(NPOLY),
    pdirty:new Uint8Array(PARTS.length), snap:PARTS.map(P => new Float32Array(P.boneList.length * 6).fill(1e9)), partYaw:new Float32Array(PARTS.length).fill(99), fill:new Int32Array(NPOLY).fill(-1), ch:{x:0, y:0, r:0}, chS:{x:0, y:0, r:0}, yaw:0, yawDrawn:99, flush:0, flushT:0, flushDrawn:0, sunA:0, force:true, colDirty:new Set(), musMoved:true,
    pad:newPads(), leg:newLegs(), ik:[0, 1, 2, 3].map(() => ({over:0, rel:0, w:0})), ikRaw:[[], [], [], []], ikS:[0, 1, 2, 3].map(() => ({v:[0, 0, 0], n:[0, 0, 0]})), gait:null, rfix:0, sk:1, tm:cdS(1), pl:cdS(8), mn:cdS(NB), mnS:new Float32Array(NB), padLegRaw:new Float32Array(8), Tl:new Float32Array(NM), Tleg:new Float32Array(NM), Tb:new Float32Array(NM), actsB:new Float32Array(NM), velB:new Float32Array(NM), sc:cdS(6), scx:[0, 0], scy:[0, 0], tempo:1, limHits:0, limMax:0, tuft:{th:0, v:0, A:0, Af:0}, rs:cdS(3), js:cdS(NB), ts:cdS(1), ps:cdS(2), cs:cdS(3), legK:1, root:{x:0, y:0, r:0}, jr:new Float32Array(NB), ikd:new Float32Array(NB), Q:newPose(), cam:{s:1, x:500, y:390}, gx:0, groundA:0, dtms:16, dyn:{speed:1, damp:.78}, mot:{scale:1, idle:1}, breath:{depth:1, rate:1}, rippleRate:0, nextRipple:0, fieldDrawn:0, life:{on:true, rate:2.4, next:2500, last:'', at:{}, node:'', dwell:0}, top:false, pm:newPM(), gs:newGait()};
  const setColours = () => { c.P = creaturePalette(opt.palette); c.C = creatureColours(c.P); c.ci = c.C; c.base = baseColours(c.C); };
  c.behPal = (o.behPalette || BEH_PAL).slice(); c.stops = stopsOf(c.behPal);
  setColours();
  c.setPalette = p => { opt.palette = p; setColours(); for(let i = 0; i < NPOLY; i++) c.colDirty.add(i); if(c.svg) styleAll(c); };
  buildDom(c); creatureApi(c);
  c.cs.x.set([1, 500, 390]); c.tm.x[0] = 1;
  c.nextBlink = 1200 + c.rand() * 2000; c.nextEar = 4000 + c.rand() * 5000; c.nextGlance = 5000 + c.rand() * 5000;
  LIVE.push(c); startLoop();
  step(c, 0, 16);
  return c;
}
/* The line weights and the backing colours for this size and palette. */
function styleAll(c){
  const G = gapTable(c.size), C = c.C; c.gt = G.gap;
  c.sil.setAttribute('fill', intHex(C.line)); c.sil.setAttribute('stroke', intHex(C.line)); c.sil.setAttribute('stroke-width', r10(G.sil));
  PARTS.forEach((P, k) => {
    const b = c.backs[k], ls = C.ls[k]; b.setAttribute('fill', intHex(ls.fill));
    if(ls.bs){ b.setAttribute('stroke', intHex(ls.stroke)); b.setAttribute('stroke-width', r10(ls.bs)); } else b.removeAttribute('stroke');
    const lp = c.loops[k]; if(lp){ lp.setAttribute('stroke', intHex(ls.stroke)); lp.setAttribute('stroke-width', r10(ls.role === 'c' ? G.c : ls.role === 'f' ? G.f : G.b)); }
  });
  c.force = true;
}
function updateGround(c){
  const G = c.gt ? 1 : 1, A = c.groundA; c.groundDrawn = A;
  let n = '', f = '', off = ((c.gx % 90) + 90) % 90;
  for(let x = -270 - off; x < 1300; x += 90){ n += 'M' + r10(x) + ' ' + (GROUND_Y + 3) + 'v9'; f += 'M' + r10(x + 45) + ' ' + (GROUND_Y - 4) + 'v6'; }
  c.groundEl.setAttribute('d', 'M-300 ' + (GROUND_Y + 3) + 'H1300M-300 ' + (GROUND_Y - 4) + 'H1300' + n + f); c.groundEl.setAttribute('opacity', A.toFixed(2));
}
function buildDom(c){
  const C0 = c.C;
  const h = Math.round(c.size * VH / VW);
  const svg = svgEl('svg', {class:'creature', width:c.size, height:h, viewBox:`0 0 ${VW} ${VH}`}); svg.style.overflow = 'visible'; svg.style.touchAction = 'none';
  const rig = svgEl('g', {class:'rig'});
  c.shown = {}; c.groups = []; c.backs = []; c.loops = []; c.polys = new Array(NPOLY); c.bd = new Array(PARTS.length).fill(''); c.ld = new Array(PARTS.length).fill('');
  c.sil = svgEl('path', {'stroke-linejoin':'round'}); let silDone = false;
  for(const P of DRAW){
    if(!silDone && P.layer >= 2){ rig.appendChild(c.sil); silDone = true; }
    const g = svgEl('g', {class:'part'}); c.groups[P.order] = g; if(P.show){ g.style.display = 'none'; c.shown[P.order] = false; }
    const b = svgEl('path', {'stroke-linejoin':'round'}); c.backs[P.order] = b; g.appendChild(b);
    for(let i = P.p0; i < P.p1; i++){ const pg = svgEl('polygon', {class:'pn', points:'', fill:intHex(c.base[i])}); c.polys[i] = pg; c.fill[i] = c.base[i]; g.appendChild(pg); }
    if(C0.ls[P.order].role && P.loop && P.loop.length > 2){ const lp = svgEl('path', {fill:'none', 'stroke-linejoin':'round', 'stroke-linecap':'round'}); c.loops[P.order] = lp; g.appendChild(lp); }
    rig.appendChild(g);
  }
  c.groundEl = svgEl('path', {fill:'none', 'stroke-width':'1.6', opacity:'0'}); c.groundEl.setAttribute('stroke', intHex(C0.line)); c.groundDrawn = 0; svg.appendChild(c.groundEl);
  svg.appendChild(rig); c.svg = svg; c.rig = rig;
  c.anat = svgEl('g', {class:'anat'}); c.anat.style.display = 'none'; svg.appendChild(c.anat);
  svg.addEventListener('pointerdown', e => {   // a click on the figure spawns a burst of colour
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    burst(c, c.t, q.x, q.y, 150, palInt(c.stops, c.rand()));
  });
  c.el.innerHTML = ''; c.el.appendChild(svg);
  styleAll(c);
  svg.classList.toggle('anat-on', c.view === 'anatomy');
}


/* ---------- joint limits ----------
   Rotation limits (radians, relative to the rest pose) for every limited joint. The spine, neck, head, ears and tail are clamped after every channel has been summed; the leg joints are
   clamped inside the IK solve, so a leg can never over-extend or fold its knee the wrong way. The elbow only flexes (radius -2.95..0.06); the stifle and hock flex the other way. */
const LIMITS = {pelvis:[-.55, .5], chest:[-.55, .55], neck:[-.9, 1.05], head:[-.8, .8], earR:[-1.2, 1.2], earL:[-1.2, 1.2], scapN:[-.5, .5], scapF:[-.5, .5], toeFN:[-.8, 1.1], toeFF:[-.8, 1.1], toeHN:[-.8, 1.1], toeHF:[-.8, 1.1], tuftB:[-1.2, 1.2], body:[-1.25, 1.25],
  humN:[-1.45, 1.75], humF:[-1.45, 1.75], radN:[-2.95, .06], radF:[-2.95, .06], handN:[-2.1, 1.9], handF:[-2.1, 1.9], femN:[-2.65, 1.55], femF:[-2.65, 1.55], tibN:[-1.05, 1.75], tibF:[-1.05, 1.75], footN:[-2.2, 1.7], footF:[-2.2, 1.7]};
for(let k = 0; k < 8; k++) LIMITS['t' + k] = k ? [-2.4, 2.4] : [-3, 3];
const LIMLO = new Float32Array(NB).fill(-99), LIMHI = new Float32Array(NB).fill(99);
for(const [n, [lo, hi]] of Object.entries(LIMITS)){ LIMLO[BI[n]] = lo; LIMHI[BI[n]] = hi; }
const SECB = new Uint8Array(NB); for(const n of ['neck', 'head', 'jaw', 'earR', 'earL', 'tuftB', 'sun']) SECB[BI[n]] = 1; for(let k = 0; k < 8; k++) SECB[BI['t' + k]] = 1;   // the secondary chains: dynamics and motion scale act on these only
const MOTJT = new Uint8Array(NB); for(const n of ['neck', 'head', 'earR', 'earL']) MOTJT[BI[n]] = 1;   // whose pose channel (not only its wiggles) the motion scale scales

/* ---------- the pose layer: root, spine and tail joints, legs on IK, postures ----------
   Gestures ask for a pose each frame (c.Q): the root's rotation about the hip and its slide, extra joint rotations (smoothed per joint, so the
   spine, neck and head follow the root with a lag), direct joint wiggles, the head's turn, the camera, and for each leg a foot target. A leg with
   a target is solved by two-bone IK (femur and tibia, or humerus and radius) from the world position of its shoulder or hip, so a planted paw
   stays planted however the body moves; the muscles then take the activations that match the solved angles, so the bulge and creases follow. */
const GROUND_Y = 756, HIP = [266, 418];
const LEGK = [['fore', 'N'], ['fore', 'F'], ['hind', 'N'], ['hind', 'F']];
const IKD = LEGK.map(([kind, side]) => {
  const bn = kind === 'fore' ? ['hum', 'rad', 'hand'] : ['fem', 'tib', 'foot'], b = bn.map(n => BI[n + side]), B = b.map(i => BONES[i]);
  return {kind, side, b, par:B[0].parent, S:B[0].p, l1:B[0].len, l2:B[1].len, l3:B[2].len, a:B.map(x => Math.atan2(x.q[1] - x.p[1], x.q[0] - x.p[0])), bend:kind === 'fore' ? 1 : -1, tip:B[2].q.slice()};
});
const IKLEG = new Int8Array(NB).fill(-1); IKD.forEach((D, k) => { IKLEG[D.b[0]] = k; });
const IKMUS = {fore:[['deltoid', 'latissimus', -.42, .38], ['triceps', 'brachialis', -.5, .8], ['extCarpi', 'flexCarpi', -.4, .55]], hind:[['hipFlex', 'glutes', -.42, .36], ['quads', 'hamstrings', -.5, .45], ['tibialis', 'gastroc', -.45, .55]]};
const LEGMUS = IKD.map(D => MUS.filter(m => m.def.pair === 'NF' && m.def.grp === D.kind && m.side === D.side).map(m => m.n));
const LEGB = new Uint8Array(NB), LEGOF = new Int8Array(NB).fill(-1); IKD.forEach((D, k) => D.b.forEach(b => { LEGB[b] = 1; LEGOF[b] = k; }));
/* the joint rotations each leg's muscles can add (held muscle bars): [muscle, bone, gain] */
const LEGJ = IKD.map((D, k) => { const o = []; for(const n of LEGMUS[k]) for(const [b, g, kd] of MUS[n].jl) if(kd === 0 && D.b.includes(b)) o.push({n, b, g}); return o; });
const JSPEED = new Float32Array(NB).fill(8);
for(const [n, v] of [['pelvis', 6.5], ['chest', 7], ['neck', 9], ['head', 11], ['scapN', 10], ['scapF', 10], ['jaw', 14], ['earR', 14], ['earL', 14]]) JSPEED[BI[n]] = v;
for(let k = 0; k < 8; k++) JSPEED[BI['t' + k]] = 2.4;   // one rate for every tail joint, so the tail keeps the shape it is blended to on the way   // a heavy tail: big pose changes take a second or so (fast wiggles use the instant channel)
/* Critically damped smoothing (no overshoot, no linear segments): a state x with velocity v chases target T at rate k. Every pose channel runs
   through it, so a gesture that starts or is cut blends from wherever the body is. Sub-stepped so a long frame cannot go unstable. */
function cdamp(S, i, T, k, dt, z = 1){   // z is the damping ratio: 1 critical, below 1 it overshoots and rings, above 1 it is heavy
  const n = Math.max(1, Math.ceil(dt * k / 1000 / .5)), h = dt / 1000 / n; let x = S.x[i], v = S.v[i];
  for(let q = 0; q < n; q++){ v += (k * k * (T - x) - 2 * z * k * v) * h; x += v * h; }
  S.x[i] = x; S.v[i] = v; return x;
}
const cdS = n => ({x:new Float32Array(n), v:new Float32Array(n)});
function newPose(){ return {pdx:0, pdy:0, bx:0, by:0, rx:0, ry:0, rr:0, jt:new Float32Array(NB), jd:new Float32Array(NB), yaw:0, cam:null, legs:[null, null, null, null], legOff:false, ground:0}; }
function newLegs(){ return IKD.map(D => ({vx:0, vy:0, vb:0, sx:D.tip[0], sy:D.tip[1], sb:D.a[2], dw:0, w:1, wT:1, x:D.tip[0], y:D.tip[1], b:D.a[2], tx:D.tip[0], ty:D.tip[1], tb:D.a[2], direct:false, front:false, kk:14})); }
/* two-bone IK for one leg, run inside the forward kinematics as soon as the leg's parent bone has its matrix */
function solveLeg(c, k){
  const D = IKD[k], L = c.leg[k], w = L.w; if(w < .002) return;
  const bm = c.bm, o = D.par * 6, r = c.rot;
  const Sx = bm[o] * D.S[0] + bm[o + 2] * D.S[1] + bm[o + 4], Sy = bm[o + 1] * D.S[0] + bm[o + 3] * D.S[1] + bm[o + 5], phi = Math.atan2(bm[o + 1], bm[o]);
  // the wrist is where the foot target is, minus the foot segment (a paw angle the joint cannot reach is clamped below: the paw's tilt gives, the toe stays near its target)
  const l3b = D.b[2], tb = L.b;
  const Wx = L.x - D.l3 * Math.cos(tb), Wy = L.y - D.l3 * Math.sin(tb), dx = Wx - Sx, dy = Wy - Sy, d = Math.hypot(dx, dy) || 1;
  const dc = clamp(d, Math.abs(D.l1 - D.l2) + .5, D.l1 + D.l2 - 4), a = Math.atan2(dy, dx), g = Math.acos(clamp((D.l1 * D.l1 + dc * dc - D.l2 * D.l2) / (2 * D.l1 * dc), -1, 1));
  const th1 = a + D.bend * g, Ex = Sx + D.l1 * Math.cos(th1), Ey = Sy + D.l1 * Math.sin(th1);
  const th2 = Math.atan2(Sy + dc * Math.sin(a) - Ey, Sx + dc * Math.cos(a) - Ex);
  // the joint angles, unwrapped inside each joint's own range (so nothing flips at +-pi): the knee's bend is the interior angle's complement, always on its own side
  const kb = -D.bend * (Math.PI - Math.acos(clamp((D.l1 * D.l1 + D.l2 * D.l2 - dc * dc) / (2 * D.l1 * D.l2), -1, 1)));
  let sat = false;   // a joint of this leg is at the end of its range: the foot cannot go where it is asked (the gait lifts a stance foot that is dragged there)
  const PS = c.ikS[k], ang = (x, q) => { const lo = LIMLO[D.b[q]], hi = LIMHI[D.b[q]], ref = PS.n[q] && L.w >= .05 ? PS.v[q] : (lo + hi) / 2, u = ref + wrapA(x - ref); if(u > hi - .06 || u < lo + .06) sat = true; return u > hi ? hi : u < lo ? lo : u; };   // the angle nearest to where the joint was, bounded by its range: continuous even when the raw angle goes round the circle
  const d1 = ang(th1 - phi - D.a[0], 0), d2 = kb - (D.a[1] - D.a[0]), d3 = ang(tb - th2 - (D.a[2] - D.a[1]), 2);
  const dd = [d1, d2, d3];
  c.ikRaw[k] = [d1, d2, d3, d, th1];
  for(let q = 0; q < 3; q++){ const b = D.b[q], v = dd[q] + c.mnS[b], lo = LIMLO[b], hi = LIMHI[b]; dd[q] = v < lo ? lo : v > hi ? hi : v; if(v < lo - .002 || v > hi + .002){ c.limHits++; c.limMax = Math.max(c.limMax, v < lo ? lo - v : v - hi); } }   // held muscles add to the solve; the limits then bound it
  { const inf = c.ik[k]; inf.over = d - (D.l1 + D.l2 - 4); inf.rel = th2 - th1; inf.w = w; L.sat = sat; }
  if(c.ikRange){ const R = c.ikRange[k]; for(let q = 0; q < 3; q++){ R[q][0] = Math.min(R[q][0], dd[q]); R[q][1] = Math.max(R[q][1], dd[q]); } }
  { const P = c.ikS[k], LIMQ = [22, 22, 28];   // the solved angles change by at most 22 rad/s (the paw's 28): whatever the pads and tempo ask, a leg cannot flip in a frame (a foot lags its target instead)
    for(let q = 0; q < 3; q++){ const lim = LIMQ[q] * c.dtms / 1000; if(L.w < .05 || P.n[q] === 0){ P.v[q] = dd[q]; P.n[q] = 1; } else { const dv = dd[q] - P.v[q]; P.v[q] += dv > lim ? lim : dv < -lim ? -lim : dv; } dd[q] = P.v[q]; } }
  for(let q = 0; q < 3; q++){ const b = D.b[q], v = r[b] * (1 - w) + dd[q] * w; r[b] = v < LIMLO[b] ? LIMLO[b] : v > LIMHI[b] ? LIMHI[b] : v; c.ikd[b] = dd[q]; }
}
/* world position of a point fixed to a bone (rest coordinates), from the last frame's bone matrices */
function wp(c, bone, p){ const o = BI[bone] * 6, m = c.bm; return [m[o] * p[0] + m[o + 2] * p[1] + m[o + 4], m[o + 1] * p[0] + m[o + 3] * p[1] + m[o + 5]]; }
/* the root: a rotation about Q by th and a slide, expressed about the hip */
function rootAbout(c, Q, th, dx = 0, dy = 0){
  const ct = Math.cos(th), st = Math.sin(th), vx = HIP[0] - Q[0], vy = HIP[1] - Q[1], q = c.Q;
  q.rr += th; q.rx += ct * vx - st * vy + Q[0] - HIP[0] + dx; q.ry += st * vx + ct * vy + Q[1] - HIP[1] + dy;
}
/* A foot target from a gait or gesture. sw is how much of the leg pads' lift and flex applies now (a planted foot asks for 0, so the pads can never unplant it). */
const legReq = (c, k, x, y, b, o = {}) => { c.Q.legs[k] = {x, y, b, w:o.w ?? 1, direct:!!o.direct, kk:o.kk, sw:o.sw ?? 1}; };
const K = (t, keys) => { if(t <= keys[0][0]) return keys[0][1]; for(let i = 0; i < keys.length - 1; i++) if(t < keys[i + 1][0]){ const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * u * u * (3 - 2 * u); } return keys[keys.length - 1][1]; };
const jt = (c, name, v) => { c.Q.jt[BI[name]] += v; }, jd = (c, name, v) => { c.Q.jd[BI[name]] += v; };

/* ---------- the posture system (Round 8) ----------
   The lion is always IN a posture or MOVING BETWEEN two. A posture is a held, stable whole-body pose: a vector of channels (the root's slide and pitch, how far the front and the rear of the body
   have dropped, the pelvis, chest, neck and head, the tail's eight bends, where each paw stands, the camera and whether the ground is shown). Stand, sit, lie (the sphinx), crouch and rear are
   nodes of a graph; each edge is a staged transition (the rear leads, or the front, as the anatomy goes; the head and tail follow through). A transition blends from wherever the body is, so it can be
   interrupted and redirected at any moment, and a request that is not a neighbour routes through the graph. Actions are layers added onto the current posture: they never reset it.
   Walk, trot and stalk are not postures of their own: they are the gait engine running on the stand (or the crouch). */
const NV = 33, CHN = {rx:0, F:1, rr:2, pdx:3, R:4, pelvis:5, chest:6, neck:7, head:8, t0:9, l0:17, cs:29, cx:30, cy:31, gnd:32};
const CHGRP = (() => { const g = new Array(NV).fill('root'); g[CHN.F] = 'front'; g[CHN.R] = 'rear'; g[CHN.pdx] = 'rear'; g[CHN.pelvis] = 'rear'; g[CHN.chest] = 'front'; g[CHN.neck] = 'head'; g[CHN.head] = 'head';
  for(let q = 0; q < 8; q++) g[CHN.t0 + q] = 'tail';
  for(let k = 0; k < 4; k++) for(let q = 0; q < 3; q++) g[CHN.l0 + k * 3 + q] = k < 2 ? 'front' : 'rear';
  g[CHN.cs] = g[CHN.cx] = g[CHN.cy] = g[CHN.gnd] = 'cam'; return g; })();
const rootV = (pv, th, dx = 0, dy = 0) => { const ct = Math.cos(th), st = Math.sin(th), vx = HIP[0] - pv[0], vy = HIP[1] - pv[1]; return [ct * vx - st * vy + pv[0] - HIP[0] + dx, st * vx + ct * vy + pv[1] - HIP[1] + dy, th]; };
function mkP(o){
  const v = new Float32Array(NV), r = o.root || [0, 0, 0], j = o.jt || {};
  v[0] = r[0]; v[1] = r[1]; v[2] = r[2]; v[3] = o.pdx || 0; v[4] = o.R ?? r[1];
  v[5] = j.pelvis || 0; v[6] = j.chest || 0; v[7] = j.neck || 0; v[8] = j.head || 0;
  for(let q = 0; q < 8; q++) v[9 + q] = o.tail ? o.tail[q] : 0;
  for(let k = 0; k < 4; k++){ const l = o.legs && o.legs[k] || [IKD[k].tip[0], IKD[k].tip[1], IKD[k].a[2]]; v[17 + k * 3] = l[0]; v[18 + k * 3] = l[1]; v[19 + k * 3] = l[2]; }
  const cm = o.cam || [1, 500, 390]; v[29] = cm[0]; v[30] = cm[1]; v[31] = cm[2]; v[32] = o.gnd || 0;
  return v;
}
const POSTURE_NAMES = ['stand', 'sit', 'lie', 'crouch', 'rear'], STAND_DROP = 16;
const POSTURES = {};
{
  const rest = k => [IKD[k].tip[0], IKD[k].tip[1], IKD[k].a[2]];
  POSTURES.stand = mkP({root:[0, STAND_DROP, 0], R:STAND_DROP});   // stood a hand's breadth low, so the legs have some slack: a lion that rises or tips a little (a roar, a lick) does not lift a planted foot
  // sit: the rear down (the pelvis slides and the hind legs fold, hocks on the ground, paws tucked forward), the forelegs planted and straight, the chest a little up, the tail coiled round
  POSTURES.sit = mkP({root:[0, 4, 0], R:172, pdx:22, jt:{chest:.14, neck:-.1, head:.05}, tail:SPHINX_B, legs:[null, null, [366, 752, .04], [410, 750, .05]], cam:[1.04, 500, 396]});
  // lie: the sphinx. The whole body on the ground, the forepaws side by side ahead, the hind paws tucked, the head up and level, the tail wound beside the haunch
  POSTURES.lie = mkP({root:[0, 212, 0], R:212, jt:{chest:-.03, neck:-.13, head:.08}, tail:SPHINX_B, legs:[[806, 751, .2], [838, 748, .22], [358, 750, .04], [400, 750, .05]], cam:[.94, 490, 430], gnd:1});
  // crouch: low and ready, the front sunk onto bent forelegs, the rump a little higher over folded hind legs, the head level and forward, the tail held low and curled
  POSTURES.crouch = mkP({root:[0, 104, .08], R:52, jt:{chest:.14, neck:.3, head:-.26}, tail:[.8, -.1, 0, 0, 0, .1, .15, .1], legs:[[700, 742, IKD[0].a[2] - .55], [752, 736, IKD[1].a[2] - .55], [290, 742, IKD[2].a[2]], [350, 738, IKD[3].a[2]]], cam:[1, 500, 390], gnd:1});
  // rear: held rampant on the hind legs, balanced (the body a little lowered so both hind feet reach the ground), the forelegs free and reaching forward, the head up
  { const rv = rootV(HIP, -.92, 28, 44); POSTURES.rear = mkP({root:rv, R:rv[1], jt:{chest:-.08, neck:.62, head:.05}, legs:[[724, 262, -.5], [746, 226, -.4], null, null], cam:[1.5, 450, 260]}); }
}
/* the edges: each is a staged blend from one posture to the next. g gives a [delay, length] in ms for a group of channels (root, front, rear, head, tail, cam), c for a single channel; bumps are
   [channel, delay, length, amount], a small push added on top (the weight shift before a move, the settle after it). A missing reverse edge is the forward one run backwards. */
const EDGES = {
  'stand>sit':   {ms:2300, g:{rear:[0, 1500], root:[100, 1500], front:[450, 1300], head:[650, 1300], tail:[500, 1700], cam:[0, 2200]}, bumps:[['rr', 0, 800, .016], ['chest', 1400, 800, -.02]]},
  'sit>stand':   {ms:2400, g:{front:[0, 1000], head:[0, 1100], root:[150, 1400], rear:[350, 1600], tail:[800, 1300], cam:[500, 1800]}, bumps:[['rr', 100, 900, .02]]},
  'stand>lie':   {ms:4400, g:{rear:[520, 1700], front:[1900, 1700], root:[1900, 1700], head:[2800, 1500], tail:[700, 2700], cam:[0, 3800]}, c:{l2x:[600, 1800], l2y:[600, 1800], l2b:[600, 1800], l3x:[700, 1800], l3y:[700, 1800], l3b:[700, 1800]}, bumps:[['rr', 0, 700, .02], ['F', 3500, 700, 5]]},
  'lie>stand':   {ms:4000, g:{head:[0, 1100], front:[200, 1500], root:[200, 1500], rear:[1300, 1500], tail:[500, 3300], cam:[0, 3000]}, bumps:[['F', 3000, 800, 5]]},
  'sit>lie':     {ms:3200, g:{rear:[0, 1300], front:[300, 1700], root:[300, 1700], head:[1200, 1500], tail:[200, 1500], cam:[0, 2800]}},
  'lie>sit':     {ms:3200, g:{front:[0, 1500], root:[0, 1500], head:[200, 1300], rear:[500, 1500], tail:[300, 1500], cam:[0, 2800]}},
  'stand>crouch':{ms:1400, g:{root:[0, 1000], front:[0, 1000], rear:[150, 950], head:[350, 900], tail:[200, 1100], cam:[0, 1300]}, bumps:[['rr', 0, 500, -.012]]},
  'crouch>stand':{ms:1300, g:{head:[0, 800], front:[100, 800], root:[150, 850], rear:[300, 850], tail:[400, 800], cam:[0, 1200]}},
  'crouch>lie':  {ms:2000, g:{rear:[0, 1300], front:[400, 1400], root:[400, 1400], head:[800, 1100], tail:[300, 1500], cam:[0, 1900]}},
  'lie>crouch':  {ms:2000, g:{front:[0, 1300], root:[0, 1300], head:[200, 1000], rear:[500, 1300], tail:[400, 1400], cam:[0, 1900]}},
  'stand>rear':  {ms:2500, g:{root:[350, 1500], front:[500, 1400], rear:[0, 1100], head:[600, 1300], tail:[300, 1600], cam:[0, 1500]}, bumps:[['F', 0, 650, 22], ['R', 0, 650, 22]]},
  'rear>stand':  {ms:2600, g:{head:[0, 900], root:[200, 1500], front:[300, 1700], rear:[500, 1400], tail:[800, 1500], cam:[300, 2100]}, bumps:[['F', 1500, 700, 12], ['R', 1500, 700, 8]]},
};
const EDGE_LIST = Object.keys(EDGES).map(k => k.split('>'));
const NEIGH = {}; for(const [a, b] of EDGE_LIST){ (NEIGH[a] = NEIGH[a] || new Set()).add(b); (NEIGH[b] = NEIGH[b] || new Set()).add(a); }
const specOf = (a, b) => {
  const f = EDGES[a + '>' + b]; if(f) return f;
  const r = EDGES[b + '>' + a]; if(!r) return {ms:2200, g:{}};
  // the forward edge run backwards: every [delay, length] mirrors in the total time; a bump is dropped (a settle on the way in is not an anticipation on the way out)
  const rv = d => d && [r.ms - d[0] - d[1], d[1]], o = {ms:r.ms, g:{}, c:{}, bumps:[]};
  for(const k in r.g) o.g[k] = rv(r.g[k]); for(const k in r.c || {}) o.c[k] = rv(r.c[k]);
  return o;
};
const edgeMs = (a, b) => specOf(a, b).ms;
/* the cheapest chain of edges from a to b (Dijkstra over the five nodes) */
function pathOf(a, b){
  if(a === b) return [a];
  const dist = {[a]:0}, prev = {}, todo = new Set(POSTURE_NAMES);
  while(todo.size){ let u = null; for(const n of todo) if(dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n; if(u === null) break; todo.delete(u); if(u === b) break;
    for(const n of NEIGH[u] || []){ const d = dist[u] + edgeMs(u, n) + (u !== a ? TRANSIT[u] || 0 : 0); if(dist[n] === undefined || d < dist[n]){ dist[n] = d; prev[n] = u; } } }
  const out = [b]; while(out[0] !== a && prev[out[0]]) out.unshift(prev[out[0]]); return out;
}
const TRANSIT = {crouch:2600, rear:5000};   // passing through a posture on the way costs extra: a lion goes to ground by its own edge, not by way of a stalk
const costOf = (a, b) => { const p = pathOf(a, b); let s = 0; for(let i = 0; i < p.length - 1; i++) s += edgeMs(p[i], p[i + 1]); return s; };
const CHNAMES = {}; { for(const [n, i] of Object.entries(CHN)) CHNAMES[n] = i; for(let q = 0; q < 8; q++) CHNAMES['t' + q] = 9 + q; for(let k = 0; k < 4; k++){ CHNAMES['l' + k + 'x'] = 17 + k * 3; CHNAMES['l' + k + 'y'] = 18 + k * 3; CHNAMES['l' + k + 'b'] = 19 + k * 3; } }

function newPM(){ return {V:Float32Array.from(POSTURES.stand), node:'stand', tr:null, route:[], want:'stand', pend:[], settle:0, hold:0, gait:null, after:null, w:{stand:1, sit:0, lie:0, crouch:0, rear:0}, gw:0, dl:new Float32Array(NV * 2)}; }
/* start an edge a>b from wherever the body is now (V); rd shortens the delays when it is a redirect, so nothing waits for a stage that is already under way */
function startEdge(c, a, b, rd = 0, scale = 1){
  const S = c.pm, sp = specOf(a, b), ms = Math.max(500, sp.ms * scale), dl = S.dl;
  for(let i = 0; i < NV; i++){
    let d = [0, sp.ms], nm = null;
    const g = sp.g[CHGRP[i]]; if(g) d = g;
    const cn = Object.keys(CHNAMES).find(n => CHNAMES[n] === i); if(sp.c && sp.c[cn]) d = sp.c[cn];
    let d0 = d[0], l = d[1];
    if(i >= 17 && i < 29 && ((i - 17) / 3 | 0) % 2 === 1 && !(sp.c && sp.c[cn])) d0 += 90;      // the far leg follows the near one
    if(i === 9 && !(sp.c && sp.c[cn])){ d0 += l * .3; l *= .7; } else if(i > 9 && i < 17 && !(sp.c && sp.c[cn])) l *= .7;   // the tail winds up first, then the root swings
    dl[i * 2] = d0 * scale * (rd ? .35 : 1); dl[i * 2 + 1] = Math.max(120, l * scale);
  }
  S.tr = {a, b, from:S.V.slice(), to:POSTURES[b], ms, t:0, sp, rd};
  S.node = a;
}
const ss3 = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
function edgeEval(S){
  const tr = S.tr, V = S.V, dl = S.dl, t = tr.t;
  for(let i = 0; i < NV; i++){ const u = ss3((t - dl[i * 2]) / dl[i * 2 + 1]); V[i] = tr.from[i] + (tr.to[i] - tr.from[i]) * u; }
  for(const [n, d, l, amp] of tr.sp.bumps || []){ const u = (t - d) / l; if(u > 0 && u < 1){ const s = Math.sin(Math.PI * u); V[CHNAMES[n]] += amp * s * s; } }
  // how much of each posture the body is in now, for the actions that adapt to it
  let m = 0; for(let i = 0; i < NV; i++) m += ss3((t - dl[i * 2]) / dl[i * 2 + 1]); m /= NV;
  return m;
}
function postWeights(S, m){
  const w = S.w; for(const n of POSTURE_NAMES) w[n] = 0;
  if(S.tr){ w[S.tr.a] += 1 - m; w[S.tr.b] += m; } else w[S.node] = 1;
}
function postStep(c, dtv){
  const S = c.pm; S.hold += dtv; let m = 1;
  if(S.tr){
    S.tr.t += dtv; m = edgeEval(S);
    if(S.tr.t >= S.tr.ms){ S.V.set(S.tr.to); S.node = S.tr.b; S.tr = null; S.hold = 0; m = 1;
      if(S.route.length){ startEdge(c, S.node, S.route.shift()); m = 0; } else S.settle = 0; }
  }
  postWeights(S, S.tr ? m : 1);
  if(!S.tr) S.settle += dtv;
  postApply(c);
  // what each posture holds in the muscles: the rested postures breathe deeper and let the tail and ears go slack; the crouch is alert; the rear is a held effort
  const w = S.w, br = Math.sin(c.t * .0016);
  spec(c.Ta, {intercostals:.4 * (w.sit + w.lie) + .14 * br * (w.sit + w.lie) + .9 * w.rear, hypaxial:.1 * w.sit + .15 * w.lie + .2 * w.crouch, depCaudae:.3 * w.sit + .2 * w.lie, arrector:.08 * w.sit + .06 * w.lie + .9 * w.rear + .1 * w.crouch, flexTip:.12 * w.lie, earBack:.12 * w.lie + .4 * w.rear,
    earUp:[.4 * w.crouch, .4 * w.crouch], levPalp:[.2 * w.crouch, .2 * w.crouch], dilator:[.35 * w.crouch, .35 * w.crouch], corrug:.25 * w.crouch + .3 * w.rear, digastric:.2 * w.rear, levLabii:.25 * w.rear, epaxial:.3 * w.rear, levCaudae:.4 * w.rear + .1 * w.crouch,
    clawFore:[.8 * w.rear, .8 * w.rear], toeSpreadFore:[.8 * w.rear, .8 * w.rear]});
}
function postApply(c){
  const S = c.pm, V = S.V, Q = c.Q;
  Q.rx += V[0]; Q.ry += V[1]; Q.rr += V[2]; Q.pdx += V[3]; Q.pdy += V[4] - V[1];
  Q.jt[BI.pelvis] += V[5]; Q.jt[BI.chest] += V[6]; Q.jt[BI.neck] += V[7]; Q.jt[BI.head] += V[8];
  for(let q = 0; q < 8; q++) Q.jt[BI['t' + q]] += V[9 + q];
  if(!c.gs || !c.gs.on) for(let k = 0; k < 4; k++) legReq(c, k, V[17 + k * 3], V[18 + k * 3], V[19 + k * 3], {kk:k % 2 ? 7 : 8});
  Q.cam = {s:V[29], x:V[30], y:V[31]}; Q.ground = Math.max(Q.ground, V[32]);
}
/* Ask for a posture. From wherever the body is: a neighbour is one staged edge, anything else is routed through the graph; a request made mid-transition either carries on to the node ahead
   and routes from there, or turns back to the node behind, whichever is shorter. */
function routeTo(c, target){
  const S = c.pm; S.want = target;
  if(!S.tr){
    if(S.node === target){ S.route = []; return; }
    const p = pathOf(S.node, target); S.route = p.slice(2); startEdge(c, S.node, p[1]); return;
  }
  const tr = S.tr;
  if(tr.b === target){ S.route = []; return; }
  const prog = clamp(tr.t / tr.ms), ahead = costOf(tr.b, target) + tr.ms * (1 - prog), back = costOf(tr.a, target) + tr.ms * prog * .8;
  if(back < ahead){   // turn round: an edge from here back to the node behind, as long as the way back took (a short way is quick), then on from there
    const rest = pathOf(tr.a, target); S.route = rest.slice(1); const a = tr.a, b = tr.b; startEdge(c, b, a, 1, clamp(prog, .4, 1)); S.node = a;
  } else { S.route = pathOf(tr.b, target).slice(1); }
}
/* ---------- the gait engine ----------
   Stalk, walk and trot are one engine with a mode between 0 (stalk) and 2 (trot): the gait parameters (stride, cadence, duty, lift, footfall offsets, bob) are blended along it, so changing mode is a
   morph of the footfalls on the running clock, never a restart. Each foot is a small state machine (stance or swing, with its own progress), kept in step with the clock by a gentle rate
   correction, so it can never jump: the stride envelope grows from nothing at a start (the first step leads with a foreleg) and shrinks to nothing at a stop (each foot takes its last step in
   under the body), and the ground scroll follows the envelope. A stance foot is pinned to a point of the ground from touchdown to lift-off. */
/* off: where each foot's stance begins in the cycle, for [foreN, foreF, hindN, hindF]. The walk and the stalk are LATERAL SEQUENCE, as every cat's: a hind foot lands, then the fore foot of the
   same side a quarter of a cycle later (hind-near, fore-near, hind-far, fore-far). The trot is diagonal pairs (foreN with hindF, foreF with hindN). Round 8 had written the walk's offsets so
   that the OPPOSITE fore foot followed a hind foot, a diagonal sequence; measured, Round 9. The trot's offsets are written 1 and .5 so that the blend from the walk takes the short way round. */
const GAITP = {
  stalk:{L:100, cyc:2500, duty:.8, lift:[24, 24, 20, 20], off:[.75, .25, 0, .5], bob:1.2, sink:0, flex:[.3, .28, .6, .6], hs:[0, 0, 8, 8], sc:.17, cap:1.5},
  walk:{L:172, cyc:1150, duty:.66, lift:[24, 24, 22, 22], off:[.75, .25, 0, .5], bob:3.5, sink:20, flex:[.45, .4, .55, .55], hs:[0, 0, 12, 12], sc:.1, cap:1.9},
  trot:{L:172, cyc:640, duty:.46, lift:[32, 32, 30, 30], off:[1, .5, .5, 1], bob:7, sink:24, flex:[.55, .5, .65, .65], hs:[0, 0, 14, 14], sc:.1, cap:1.55},
};
const GAIT_ORDER = [GAITP.stalk, GAITP.walk, GAITP.trot], GAIT_PSI = {stalk:0, walk:1, trot:2};
const GMIX = {};
function gaitMix(psi){
  const i = Math.min(1, Math.floor(clamp(psi, 0, 2 - 1e-6))), f = clamp(psi - i, 0, 1), A = GAIT_ORDER[i], B = GAIT_ORDER[i + 1], o = GMIX, l = (a, b) => a + (b - a) * f;
  for(const k of ['L', 'cyc', 'duty', 'bob', 'sink', 'sc', 'cap']) o[k] = l(A[k], B[k]);
  for(const k of ['lift', 'off', 'flex', 'hs']){ o[k] = o[k] || [0, 0, 0, 0]; for(let q = 0; q < 4; q++) o[k][q] = l(A[k][q], B[k][q]); }
  return o;
}
const frac1 = x => x - Math.floor(x), wrap1 = x => x - Math.round(x);
function newGait(){ return {on:false, phase:'idle', psi:1, psiT:1, ph:0, kl:0, k:0, legs:[0, 1, 2, 3].map(() => ({stance:true, p:0, W:0, lx:0, x:0})), endAt:0, age:0}; }
function gaitStart(c, mode){
  const g = c.gs, G = gaitMix(GAIT_PSI[mode]), S = c.pm; g.on = true; g.phase = 'start'; g.psi = g.psiT = GAIT_PSI[mode]; g.kl = 0; g.k = 0; g.age = 0; g.endAt = 0;
  g.ph = frac1(G.duty - G.off[0] - .012);   // the near foreleg lifts first
  for(let i = 0; i < 4; i++){ const L = g.legs[i], tgt = frac1(g.ph + G.off[i]); L.stance = true; L.p = tgt < G.duty ? tgt / G.duty : 0; L.W = S.V[17 + i * 3] + c.gx; L.x = S.V[17 + i * 3]; }
}
function gaitStep(c, dt){
  const g = c.gs, Q = c.Q, S = c.pm;
  if(!g.on){ c.gait = null; return; }
  g.age += dt;
  const G = gaitMix(g.psi), tempo = Math.min(c.tempo, G.cap), mk = clamp(c.mot.scale, .45, 1.7);
  g.psi += clamp(g.psiT - g.psi, -dt / 1700, dt / 1700);      // the mode morphs at a steady rate, the clock runs on
  if(g.endAt && c.t >= g.endAt && g.phase !== 'stop'){ g.phase = 'stop'; g.endAt = 0; }
  const cadM = Math.pow(tempo, .65), dtc = dt * cadM / G.cyc;
  g.kl = clamp(g.kl + (g.phase === 'stop' ? -dtc / .8 : dtc / .95), 0, 1);
  const k = ss(0, 1, g.kl); g.k = k; if(g.phase === 'start' && g.kl >= 1) g.phase = 'run';
  const lift = mk * (g.phase === 'stop' ? Math.max(.3, ss(0, .6, g.kl)) : Math.max(.55, ss(0, .5, g.kl))), bobM = mk, Lk = Math.min(G.L * 1.4, G.L * Math.pow(tempo, .35) * Math.pow(mk, .8), 105 + 225 * Math.pow(1 - S.w.crouch, 1.8)) * k * c.sk;   // a lowered body cannot reach as far: the stride is capped as the lion crouches
  g.ph += dtc;
  const V = Lk * cadM / (G.duty * G.cyc / 1000), ph = g.ph, direct = g.age > 700 && !(g.phase === 'stop' && k < .3);
  c.gv = V; Q.ground = 1; const gxN = c.gx + c.gv * dt / 1000;
  const st = [0, 0, 0, 0]; c.gait = {name:g.psi < .5 ? 'stalk' : g.psi < 1.5 ? 'walk' : 'trot', ph:g.ph, stance:st, duty:G.duty, k, t:c.t, tempo, cad:cadM / G.cyc, psi:g.psi, phase:g.phase};
  let allDown = true, worst = 0, worstI = -1;
  const final = g.phase === 'stop' && g.kl <= 0;   // the stride has gone: the feet step in under the body one by one, and the gait is done when each stands on its place
  for(let i = 0; i < 4; i++){
    const D = IKD[i], L = g.legs[i], x0 = S.V[17 + i * 3] + G.hs[i] * k, gy = D.tip[1], b0 = S.V[19 + i * 3], front = x0 + Lk / 2;
    if(final){ if(!L.stance) L.p += dtc * 2.2 / (1 - G.duty); }
    else { const tgt = frac1(ph + G.off[i]), my = L.stance ? L.p * G.duty : G.duty + L.p * (1 - G.duty), err = wrap1(tgt - my), m = clamp(1 + 2.6 * err, .4, 2.2);
      L.p += L.stance ? dtc * m / G.duty : dtc * m / (1 - G.duty); }
    if(L.stance && L.p >= 1){ L.stance = false; L.p = clamp(L.p - 1, 0, .4); L.lx = L.W - gxN; }
    else if(L.stance && !final && k > .25 && (L.W - gxN < x0 - Lk / 2 - 14 || (c.leg[i].sat && L.p > .12))){ L.stance = false; L.p = 0; L.lx = L.W - gxN; }   // a foot left behind its place (the body lowered or the stride changed under it) lifts early, rather than be dragged past its reach
    else if(!L.stance && L.p >= 1){ L.stance = true; L.p = final ? 0 : clamp(L.p - 1, 0, .4); L.W = front + gxN; }
    let x, y, b, sw = 0; const s = L.p, my2 = L.stance ? L.p * G.duty : G.duty + L.p * (1 - G.duty), bk = L.stance ? ss(0, .5, k) : Math.max(.35, ss(0, .5, k));
    if(L.stance){ x = L.W - gxN; y = gy; b = b0 - .04 * (.5 - s) - .13 * (1 - fSmooth(0, .22, s)) + .2 * fSmooth(.74, 1, s) * (i > 1 ? 1 : .7); }
    else { const e = s * s * (3 - 2 * s), sn = Math.sin(Math.PI * s); x = L.lx + (front - L.lx) * e; y = gy - G.lift[i] * lift * sn; sw = sn; b = b0 + .2 * (i > 1 ? 1 : .7) * (1 - fSmooth(0, .35, s)) + G.flex[i] * Math.sin(Math.PI * s) * Math.sqrt(mk) - .13 * fSmooth(.7, 1, s); }
    b = b0 + (b - b0) * bk;
    st[i] = L.stance; if(!L.stance) allDown = false; L.x = x;
    const er = Math.max(Math.abs(x - S.V[17 + i * 3]), final ? Math.abs(c.leg[i].x - S.V[17 + i * 3]) : 0); if(L.stance && er > worst){ worst = er; worstI = i; }   // at the end the gait waits for the foot itself (it follows its target on a spring), not only for the target
    legReq(c, i, x, y, b, {direct, kk:12, sw});
    { const tg = (i < 2 ? 'toeF' : 'toeH') + D.side;   // the digits: they press off at the end of the stance (extended), curl through the swing, and open again before they land
      jd(c, tg, (L.stance ? -.45 * fSmooth(.5, 1, s) : .62 * Math.sin(Math.PI * s) - .3 * fSmooth(.72, 1, s)) * bk * (i < 2 ? 1 : .85)); }
  }
  if(final && allDown){ if(worst > 3){ const L = g.legs[worstI]; L.stance = false; L.p = 0; L.lx = L.W - gxN; } else { g.on = false; g.phase = 'idle'; c.gait = null; c.gv = 0; return; } }
  const w2 = 4 * Math.PI * ph, trotish = clamp(g.psi - 1, 0, 1);
  // the body's own motion rides the DIRECT channels: the root's and the joints' springs (6.5 to 7 rad/s) take most of a bounce away at the trot's 2.8 Hz (measured in Round 9: a bob of 10 drew 1.3), and the
  // gait's phase already says exactly when each should be where, so nothing here is smoothed again. The steady drop of the body stays on the root.
  // The sagittal motion is two beats a cycle (one beat of a lateral-sequence walk is a fore foot landing, the next a hind foot): the body is lowest as a fore foot lands (the walk's vault) and as the stance
  // pair is mid-stance (the trot's spring), and pitches nose down with it; the spine flexes with the pitch (chest and pelvis in opposition). No once-a-cycle sagittal term: it would favour one side.
  const hv = Math.cos(w2 - 3.0), hq = Math.sin(w2 - 3.0);
  Q.ry += G.sink * k - STAND_DROP * k * S.w.stand;
  // the bounce dips from the height the feet were planted at and returns to it as the next pair lands: down only, so the body going up never lifts a foot planted for the stride (the legs have no slack at
  // touchdown, and a bounce that rose there took the trot's planted feet off the ground under Motion large and the Spine pad's rise), and the legs compress at mid-stance as a spring-mass gait's do
  Q.by += G.bob * bobM * (1 + hv) * k;
  jd(c, 'body', .016 * (1 + .9 * trotish) * hv * k * mk);
  jd(c, 'chest', .03 * hq * k * mk); jd(c, 'pelvis', -.03 * hq * k * mk);
  jd(c, 'neck', .05 * k * mk * Math.sin(w2 + 2.4)); jd(c, 'head', -.035 * k * mk * Math.sin(w2 + 2.4));
  spec(c.Ta, {levCaudae:.22 * k * (1 + Math.sin(w2 + 1)), depCaudae:.05 * k, flexTip:.2 * k * (1 + Math.sin(w2 + 2.6)) * .5, arrector:.08 * k * (1 + Math.sin(w2 + 2.4)), intercostals:.2 * k});
}
/* ---------- asking for postures and actions ---------- */
/* Which postures each action works in. `in` lists them (absent: every posture, even mid-transition, because the action is only a layer); `gait` says whether the legs may be walking. An action
   asked for outside its postures does not run from a fixed start: the lion moves to the nearest posture where it is possible (staged, from wherever it is), and the action begins when it arrives. */
const ACT_NEED = {
  yawn:{in:['stand', 'sit', 'lie', 'crouch']}, shake:{in:['stand', 'sit', 'lie', 'crouch']}, lick:{in:['stand', 'sit', 'lie']}, wipe:{in:['stand', 'sit', 'lie']}, scratch:{in:['sit']}, stretch:{in:['stand']},
  shift:{in:['stand']}, pounce:{in:['crouch'], gait:g => g.psi >= 1.4}, sniff:{in:['stand', 'sit', 'lie', 'crouch'], gait:true}, flehmen:{in:['stand', 'sit', 'lie', 'crouch'], gait:true},
  roar:{gait:true}, toss:{gait:true}, listen:{gait:true}, glance:{gait:true}, swish:{gait:true}, lash:{gait:true}, flick:{gait:true}, sigh:{in:['stand', 'sit', 'lie', 'crouch']}, slowblink:{in:['stand', 'sit', 'lie', 'crouch']},
};
function actionReady(c, name){
  const N = ACT_NEED[name]; if(!N) return true;
  const S = c.pm, g = c.gs;
  if(g.on) return g.phase !== 'stop' && !!(typeof N.gait === 'function' ? N.gait(g) : N.gait);
  if(!N.in) return true;
  return N.in.includes(S.node) && !S.tr && !S.route.length && S.settle >= 380;
}
function actionRoute(c, name){
  const N = ACT_NEED[name], S = c.pm, g = c.gs;
  if(g.on){ if(g.phase !== 'stop') gaitStop(c); return; }
  if(!N.in || N.in.includes(S.want)) return;
  const here = S.tr ? S.tr.b : S.node; let best = null, bc = 1e9;
  for(const n of N.in){ const cst = costOf(here, n); if(cst < bc){ bc = cst; best = n; } }
  if(best) routeTo(c, best);
}
function startAction(c, name, a){
  if(ACTIONS[name].big){ for(const x of c.actions) if(ACTIONS[x.name].big) x.cut = c.t; c.topFore(false); }
  c.actions.push({name, t0:c.t, ...a});
}
function gaitStop(c){ const g = c.gs; if(g.on && g.phase !== 'stop') g.phase = 'stop'; g.endAt = 0; }
function goGait(c, mode, o = {}){
  const S = c.pm, g = c.gs, base = mode === 'stalk' ? 'crouch' : 'stand';
  for(const x of c.actions) if(x.name === 'lick' || x.name === 'wipe' || x.name === 'scratch' || x.name === 'stretch' || x.name === 'shift') x.cut = c.t;
  S.pend.length = 0;
  if(g.on){
    g.psiT = GAIT_PSI[mode]; if(g.phase === 'stop') g.phase = g.kl >= 1 ? 'run' : 'start'; g.endAt = o.for ? c.t + o.for : 0;
    if(S.want !== base && (S.node === 'stand' || S.node === 'crouch' || S.tr)) routeTo(c, base);   // stalk lowers the body, walk and trot raise it again, on the running legs
    return;
  }
  if(!S.tr && !S.route.length && S.node === base){ gaitStart(c, mode); if(o.for) g.endAt = c.t + o.for; S.after = null; return; }
  S.after = {gait:mode, for:o.for}; routeTo(c, base);
}
function goPosture(c, name, o = {}){
  if(GAIT_PSI[name] !== undefined) return goGait(c, name, o);
  const S = c.pm, g = c.gs;
  S.pend.length = 0;
  if(g.on){ gaitStop(c); S.after = {go:name}; S.want = name; return; }
  S.after = null; routeTo(c, name);
}
/* things that have to happen on arrival, or when the gait has finished: a posture asked for after a walk, a gait asked for after a move, an action waiting for its posture */
function afterCheck(c){
  const S = c.pm, g = c.gs;
  if(S.after && !g.on){
    const a = S.after;
    if(a.go){ S.after = null; routeTo(c, a.go); }
    else if(a.gait && !S.tr && !S.route.length){ const base = a.gait === 'stalk' ? 'crouch' : 'stand'; if(S.node === base){ S.after = null; gaitStart(c, a.gait); if(a.for) g.endAt = c.t + a.for; } else routeTo(c, base); }
  }
  if(S.pend.length){
    const rest = [];
    for(const p of S.pend){ if(actionReady(c, p.name)) startAction(c, p.name, p.a); else { rest.push(p); } }
    S.pend = rest;
    if(rest.length && !g.on && !S.tr && !S.route.length) actionRoute(c, rest[0].name);
  }
}
/* where the lion is, for the page and the gates */
function postureInfo(c){
  const S = c.pm, g = c.gs, tr = S.tr, mode = g.on ? (g.psi < .5 ? 'stalk' : g.psi < 1.5 ? 'walk' : 'trot') : null;
  return {at:S.node, moving:!!tr, from:tr ? tr.a : null, to:tr ? tr.b : null, u:tr ? clamp(tr.t / tr.ms) : 1, route:S.route.slice(), want:S.want, gait:mode, gaitPhase:g.phase, pending:S.pend.map(p => p.name),
    after:S.after ? (S.after.gait || S.after.go) : null, label:mode ? (g.phase === 'stop' ? mode + ' (stopping)' : mode) : tr ? tr.a + ' to ' + tr.b : S.node, weights:Object.assign({}, S.w)};
}

/* The shoulder blade is part of the foreleg. It is a floating bone: no collarbone holds it, so it rotates about the withers end and slides on the ribs, and it supplies a good part of the
   stride. It is placed from where the foot is against the shoulder: a foot ahead of its rest place swings the glenoid forward (rotation, and a share as slide), a foot behind swings it
   back, so in a walk the blade turns with the stride, in a stalk or a crouch (the chest down between the blades) the blades lift above the back, in a reach the blade follows the paw.
   The leg's IK then solves from the shoulder where the blade has put it. The trapezius and rhomboideus (back and up) and the serratus and omotransversarius (forward) are lit by the readout. */
const SC = {rot:.26, slide:.07, up:.35, lever:82, lim:.44};
function scapulaStep(c, k, D, L, dt){
  // placed from the paw's displacement from its rest place (and the body's slide and sink), never from the shoulder's own wobble: a shake, a toss or a lick moves the shoulder a few units at 6 Hz, and a blade that
  // answered would only fight the IK, which cannot follow that fast (a standing shake took the far foot 6.4 units off its place, against 3.8 without the blade)
  const sd = D.side === 'N' ? 0 : 1, w = clamp(L.w, 0, 1) * fSmooth(600, 665, L.y), R = c.root;
  const rel = clamp(L.x - D.tip[0] - R.x, -260, 260), drop = 70 * clamp(c.pm.w.crouch + c.pm.w.lie, 0, 1);   // the chest sinks between the blades in a crouch and a lie, so the blades stand up from the back there (not in a stand, where a quick sink, as the shake's, must not lift the shoulder)
  const kq = 18 * c.legK;   // the blade keeps up with the stride at any tempo (the feet's own springs do)
  const th = cdamp(c.sc, sd * 3, clamp(-SC.rot * rel / SC.lever, -SC.lim, SC.lim) * w, kq, dt);
  c.scx[sd] = cdamp(c.sc, sd * 3 + 1, clamp(SC.slide * rel, -24, 24) * w, kq, dt);
  c.scy[sd] = cdamp(c.sc, sd * 3 + 2, -SC.up * drop * w, 10, dt);
  c.Q.jd[BI['scap' + D.side]] += th;
}
function jointReadout(c){
  const jd = c.Q.jd;
  for(const f of BFD){
    const ang = c.jr[f.b] + jd[f.b]; if(ang > -.01 && ang < .01) continue;
    const a = Math.min(1.5, Math.abs(ang) / f.scale), list = ang > 0 ? f.pos : f.neg;
    for(const n of list) c.Tb[n] += a;
  }
}
/* ---------- one frame ---------- */
function step(c, now, dt){
  c.t = now; c.dtms = dt;
  const Q = c.Q; Q.rx = Q.ry = Q.rr = Q.bx = Q.by = Q.pdx = Q.pdy = 0; Q.jt.fill(0); Q.jd.fill(0); Q.yaw = 0; Q.cam = null; Q.legs.fill(null); Q.legOff = false; Q.ground = 0; c.gv = 0;
  const Ti = c.Ti, Ta = c.Ta, Tp = c.Tp, T = c.T; Ti.fill(0); Ta.fill(0); Tp.fill(0); c.Tl.fill(0); c.Tb.fill(0); c.ch.x = c.ch.y = c.ch.r = 0; c.flushT = 0;
  c.breath.depth = 1; c.breath.rate = 1; c.rippleRate = 0;
  padsApply(c, Tp, now);
  c.tempo = clamp(cdamp(c.tm, 0, c.dyn.speed, 3.5, dt), .45, 2.2); const tempo = c.tempo; c.legK = Math.max(1, tempo);   // the dynamics pad's speed is the tempo of every action, gait and gesture, as one clock
  postStep(c, dt * tempo); gaitStep(c, dt); afterCheck(c);
  // idle: breath, tail sway, mane, a slow glance, blinks and ear twitches
  const bd = c.breath.depth, br = .5 + .5 * Math.sin(now * .00145 * c.breath.rate + 1);
  spec(Ti, {intercostals:(.18 + .38 * br) * bd, epaxial:.05 * br * bd, arrector:.05 + .05 * Math.sin(now * .0009), levCaudae:.12 + .12 * Math.sin(now * .0006), flexTip:.1 + .1 * Math.sin(now * .0011 + 1), flexMid:.04 + .04 * Math.sin(now * .0008), longusColli:.03 * br, splenius:[.06 + .06 * Math.sin(now * .00031), .06 + .06 * Math.sin(now * .00031 + 3.1)]});
  if(now >= c.nextBlink){ c.actions.push({name:'blink', t0:now}); c.nextBlink = now + IDLE_BLINK[0] + c.rand() * (IDLE_BLINK[1] - IDLE_BLINK[0]); if(c.rand() < .22) c.actions.push({name:'blink', t0:now + 230}); }
  if(now >= c.nextEar){ c.actions.push({name:'ear', t0:now, side:c.rand() < .5 ? 'L' : 'R'}); c.nextEar = now + IDLE_EAR[0] + c.rand() * (IDLE_EAR[1] - IDLE_EAR[0]); }
  if(now >= c.nextGlance){ c.actions.push({name:'turn', t0:now, dir:c.rand() < .5 ? -1 : 1, soft:1}); c.nextGlance = now + IDLE_GLANCE[0] + c.rand() * (IDLE_GLANCE[1] - IDLE_GLANCE[0]); }
  c.actions = c.actions.filter(a => {
    if(now < a.t0) return true;
    a.tv = a.tv === undefined ? now - a.t0 : a.tv + dt * tempo; const t = a.tv;   // each action has its own clock, which runs at the tempo
    const A = ACTIONS[a.name]; if(t > A.dur) return false;
    if(a.cut && now - a.cut > 120){ if(a.name === 'wipe') c.topFore(false); return false; }
    if(a.soft){ const T2 = new Float32Array(NM); A.f(t, T2, c, a); for(let n = 0; n < NM; n++) Ti[n] += T2[n] * .4; } else if(A.f(t, Ta, c, a) === false) return false;
    return true;
  });
  lifeStep(c, now);
  if(c.rippleRate > .1 && now >= c.nextRipple){ ripple(c, now); c.nextRipple = now + 1500 / c.rippleRate; }
  // the legs. A gait or gesture asks for a foot target (the base layer, which owns the timing); the leg pads then add offsets to it, inside the IK; the IK solves the leg
  // and the muscles take the activations that match the solved angles, so bulge and creases follow. The legs go to the muscles only when a gesture says so (the pounce).
  if(Q.legOff) for(let n = 0; n < NM; n++) Tp[n] += c.Tleg[n];
  {   // reach: a planted foot must be reachable. The reach each leg's target needs is worked out ahead of the foot (from the target, not the foot's lagging position), so a foot about to land
    // is already reachable when it lands; if one is short (a long stride, a reach offset, a tall pad), the body lowers by what is missing and comes up again when there is slack.
    let need = -1e9, any = false, fold = 1e9;
    for(let k = 0; k < 4; k++){
      const D = IKD[k], L = c.leg[k], rq = Q.legs[k]; if(Q.legOff || L.w < .5) continue;
      const px = c.padLegRaw[k * 2] * (D.kind === 'fore' ? 36 : 34), py = c.padLegRaw[k * 2 + 1];
      let tx = (rq ? rq.x : D.tip[0]) + px, ty = rq ? rq.y : D.tip[1], tb = rq ? rq.b : D.a[2];
      if(ty < 600) continue; ty += Math.max(0, py) * .5 * (D.tip[1] - ty); tb += .12 * Math.max(0, py);   // as the leg block will offset the target
      const o = D.par * 6, bm = c.bm, Sx = bm[o] * D.S[0] + bm[o + 2] * D.S[1] + bm[o + 4], Sy = bm[o + 1] * D.S[0] + bm[o + 3] * D.S[1] + bm[o + 5];
      const over = Math.hypot(tx - D.l3 * Math.cos(tb) - Sx, ty - D.l3 * Math.sin(tb) - Sy) - (D.l1 + D.l2 - 4);
      need = Math.max(need, over + 8); any = true;   // the body is kept 8 units above the legs' reach, so a foot landing at the tempo's pace (the reach manager answers a frame late) is already within it 
    }
    if(!(c.gait && now - c.gait.t < 80)) any = false;   // the reach manager works for the gaits, whose contacts it keeps; a gesture's poses are authored and own their reach
    if(any){ if(need > .3) c.rfix += need * 1.2; else if(need < -6) c.rfix += (need + 6) * .025; } else c.rfix *= .96;
    const cap = clamp(78 - c.root.y, 0, 58); c.rfix = clamp(c.rfix, 0, cap);   // the body goes no lower than the legs can still work from, whatever the pads and the stride ask
    // if the body is as low as it can go and a foot is still out of reach, the stride shortens (and lengthens again when there is room): the contact is kept, the amplitude gives
    if(any && need > .3 && c.rfix >= cap - 2) c.sk = Math.max(.45, c.sk - .02); else if(!any || need < -8) c.sk = Math.min(1, c.sk + .006);
  }
  for(let k = 0; k < 4; k++){
    const D = IKD[k], L = c.leg[k], rq = Q.legs[k];
    const px = cdamp(c.pl, k * 2, c.padLegRaw[k * 2], 14, dt), py = cdamp(c.pl, k * 2 + 1, c.padLegRaw[k * 2 + 1], 14, dt), flex = Math.max(0, -py), ext = Math.max(0, py);
    let tx, ty, tb, sw = 1, w = 1, direct = false, kk = 14;
    if(rq){ tx = rq.x; ty = rq.y; tb = rq.b; sw = rq.sw; w = rq.w; direct = rq.direct; kk = rq.kk ?? 14; } else { tx = D.tip[0]; ty = D.tip[1]; tb = D.a[2]; }
    tx += px * (D.kind === 'fore' ? 36 : 34); ty += ext * .5 * (D.tip[1] - ty) - flex * 70 * sw; tb += -.7 * flex * sw + .12 * ext;
    L.tx = tx; L.ty = ty; L.tb = tb; L.wT = Q.legOff ? 0 : w; L.direct = direct; L.kk = kk;
    {   // the foot follows its target on a critically damped spring; a gait asks to be followed exactly (a planted foot must not lag the ground), and that is blended in and out, never switched
      const kq = L.kk * c.legK, n = Math.max(1, Math.ceil(dt * kq / 1000 / .5)), h = dt / 1000 / n;
      for(let q = 0; q < n; q++){ L.vx += (kq * kq * (L.tx - L.sx) - 2 * kq * L.vx) * h; L.vy += (kq * kq * (L.ty - L.sy) - 2 * kq * L.vy) * h; L.vb += (kq * kq * wrapA(L.tb - L.sb) - 2 * kq * L.vb) * h; L.sx += L.vx * h; L.sy += L.vy * h; L.sb += L.vb * h; }
      L.dw += ((L.direct ? 1 : 0) - L.dw) * (1 - Math.exp(-dt * 4.5 / 1000));
      L.x = L.sx + (L.tx - L.sx) * L.dw; L.y = L.sy + (L.ty - L.sy) * L.dw; L.b = L.sb + wrapA(L.tb - L.sb) * L.dw;
    }
    L.w += (L.wT - L.w) * (1 - Math.exp(-dt * 6 / 1000));
    if(L.w > .3){ const tab = IKMUS[D.kind]; for(let q = 0; q < 3; q++){ const dl = c.ikd[D.b[q]], e = tab[q]; if(dl < 0) c.Tl[MI[e[0] + '.' + D.side]] += dl / e[2] * L.w; else c.Tl[MI[e[1] + '.' + D.side]] += dl / e[3] * L.w; } }
    // held muscles (the muscle list) add to the solved joints
    for(let q = 0; q < 3; q++){ const b = D.b[q]; let m = 0; for(const j of LEGJ[k]) if(j.b === b) m += c.direct[j.n] * j.g; c.mnS[b] = cdamp(c.mn, b, m, 14, dt); }
    if(D.kind === 'fore') scapulaStep(c, k, D, L, dt);
  }
  jointReadout(c);   // the joints a pose channel turns (the scapula, neck, head, trunk, digits) light their muscles, as the legs' muscles are lit from the solve
  const ik = c.mot.idle, mk = c.mot.scale, mkl = clamp(mk, .6, 1.3);   // the motion scale scales the muscles' action (a leg's more gently); the legs' own joints come from the IK and are not scaled
  for(let n = 0; n < NM; n++) T[n] = Ti[n] * ik + Ta[n] * (MUS[n].leg ? mkl : mk) + c.Tl[n] + c.Tb[n] + Tp[n] + c.direct[n];
  // the muscles' springs, as in faceMuscles. The speed is fixed; the dynamics pad's damping applies to the secondary muscles only (the leg muscles only bulge with the IK-driven joints)
  const s0 = Math.min(.05, dt / 1000), sub = clamp(Math.ceil(s0 * 18 / .55), 1, 6), s = s0 / sub, zeta = c.dyn.damp; let moved = false;
  for(let q = 0; q < sub; q++) for(const m of MUS){
    const n = m.n, a = c.acts[n], k = m.def.speed, z = m.leg ? .78 : zeta;
    c.vel[n] += (k * k * (T[n] - a) - 2 * k * z * c.vel[n]) * s; c.acts[n] = a + c.vel[n] * s;
    if(m.bf){ const ab = c.actsB[n]; c.velB[n] += (k * k * (c.Tb[n] - ab) - 2 * k * z * c.velB[n]) * s; c.actsB[n] = ab + c.velB[n] * s; }   // the same spring on the readout share alone, so it can be taken off the joint's turn
  }
  for(const sp of SHOWP){ const vis = c.acts[sp.n] > .04; if(vis !== c.shown[sp.k]){ c.shown[sp.k] = vis; c.groups[sp.k].style.display = vis ? '' : 'none'; if(vis) c.pdirty[sp.k] = 1; } }
  for(const m of MUS){ const n = m.n; if(Math.abs(c.acts[n] - c.drawn[n]) > .004){ moved = true; for(const p of m.partList) c.pdirty[p] = 1; c.drawn[n] = c.acts[n]; } }
  c.flush += (c.flushT - c.flush) * Math.min(1, dt / 140);
  // body channels (root slide and tilt) chase their targets; the sun turns
  const cs = c.chS, kk = Math.min(1, dt / 90);
  cs.x += (c.ch.x * mk - cs.x) * kk; cs.y += (c.ch.y * mk - cs.y) * kk; cs.r += (c.ch.r * mk - cs.r) * kk;
  c.sunA = Math.floor(now * .00003 * 500) / 500;
  // joints from muscles
  const rot = c.rot, sy = c.sy, sx = c.sx; rot.fill(0); sy.fill(0); sx.fill(0); let yaw = 0;
  for(const m of MUS){ const a = c.acts[m.n] - (m.bf ? c.actsB[m.n] : 0); if(Math.abs(a) < .0005) continue; for(const [b, g, kd] of m.jl){ if(kd === 0) rot[b] += a * g; else if(kd === 1) sy[b] += a * g; else yaw += a * g; } }
  sy[BI.jaw] = clamp(sy[BI.jaw], -4, 62);
  sx[BI.scapN] += c.scx[0]; sy[BI.scapN] += c.scy[0]; sx[BI.scapF] += c.scx[1]; sy[BI.scapF] += c.scy[1];   // the blade slides on the ribs
  // the root turns about the hip and slides; the spine, neck, head and tail take their extra rotations with a lag per joint
  const R = c.root; R.x = cdamp(c.rs, 0, Q.rx, 6.5, dt); R.y = cdamp(c.rs, 1, Q.ry, 6.5, dt); R.r = cdamp(c.rs, 2, Q.rr, 7, dt);
  const th = R.r + cs.r, ct = Math.cos(th), st = Math.sin(th), vx = J.body[0] - HIP[0], vy = J.body[1] - HIP[1];
  rot[BI.body] += th; sx[BI.body] += ct * vx - st * vy + HIP[0] - J.body[0] + R.x + cs.x; sy[BI.body] += st * vx + ct * vy + HIP[1] - J.body[1] + R.y + cs.y + c.rfix;
  { const zs = clamp(c.dyn.damp / .78, .35, 1.7), mkc = clamp(mk, .35, 1.8), rm = Math.pow(Math.max(1, tempo), .7);
    for(let b = 0; b < NB; b++){   // the joint channels: the spine and legs follow critically damped; the secondary chains (neck, head, ears, tail) take the dynamics pad's damping and the motion scale
      const sec = SECB[b]; c.jr[b] = cdamp(c.js, b, Q.jt[b], JSPEED[b] * (b >= BI.t0 && b <= BI.t7 ? 1 : .8) * rm, dt, sec ? zs : 1);
      rot[b] += (MOTJT[b] ? mkc * c.jr[b] : c.jr[b]) + (sec ? mkc : 1) * Q.jd[b];
    } }
  sx[BI.body] += Q.bx; sy[BI.body] += Q.by; sx[BI.pelvis] += cdamp(c.ps, 0, Q.pdx, 6, dt); sy[BI.pelvis] += cdamp(c.ps, 1, Q.pdy, 6, dt);
  // the tuft follows through: it lags the tail's end (a follower of the tail's absolute angle) and overshoots on an underdamped spring
  { const tf = c.tuft; let A = rot[BI.body] + rot[BI.pelvis]; for(let k = 0; k < 8; k++) A += rot[BI['t' + k]];
    tf.Af = cdamp(c.ts, 0, A, 3.2, dt); const tgt = clamp(-(A - tf.Af) * .8 + .07 * Math.sin(c.t * .0013) + .04 * Math.sin(c.t * .0031 + 1), -.5, .5);
    const n = Math.max(1, Math.ceil(dt / 8)), h = dt / 1000 / n, w = 11, z = clamp(.5 * c.dyn.damp / .78, .2, 1.2); for(let q = 0; q < n; q++){ tf.v += (w * w * (tgt - tf.th) - 2 * z * w * tf.v) * h; tf.th += tf.v * h; }
    rot[BI.tuftB] += tf.th; }
  rot[BI.sun] += c.sunA; yaw += Q.yaw;
  // the ground scrolls under a walking lion; the camera follows a tall pose (a rearing lion needs more room)
  c.gx += c.gv * dt / 1000; c.groundA += (Q.ground - c.groundA) * (1 - Math.exp(-dt * 5 / 1000));
  if(c.groundEl && (c.gv || Math.abs(c.groundA - c.groundDrawn) > .01)) updateGround(c);
  { const tg = Q.cam || {s:1, x:500, y:390}, cm = c.cam; cm.s = cdamp(c.cs, 0, tg.s, 2.4, dt); cm.x = cdamp(c.cs, 1, tg.x, 2.4, dt); cm.y = cdamp(c.cs, 2, tg.y, 2.4, dt);
    const vb = [r10(cm.x - 500 * cm.s), r10(cm.y - 390 * cm.s), r10(1000 * cm.s), r10(780 * cm.s)].join(' '); if(vb !== c.vb){ c.vb = vb; c.svg.setAttribute('viewBox', vb); } }
  yaw = clamp(yaw, -.9, .9);
  for(let b = 0; b < NB; b++){ if(LEGB[b] && c.leg[LEGOF[b]].w > .5) continue; const v = rot[b], lo = LIMLO[b], hi = LIMHI[b]; if(v < lo || v > hi){ rot[b] = v < lo ? lo : hi; c.limHits++; c.limMax = Math.max(c.limMax, v < lo ? lo - v : v - hi); } }   // the limits bound every limited joint except the IK legs, which are bound inside the solve
  c.ikd.fill(0);
  fk(c);
  c.yaw = yaw;
  if(moved || c.musMoved){ musApply(c); c.musMoved = false; }
  // which parts moved: a muscle over them moved, or a bone of theirs or the head's turn has moved since the part was last drawn
  // (each part keeps its own snapshot, so slow idle motion redraws a part only when it has moved a visible fraction of a pixel)
  const cs_ = Math.cos(yaw), sn_ = Math.sin(yaw), dirtyParts = [], bm0 = c.bm;
  PARTS.forEach((P, k) => {
    let d = c.pdirty[k] || c.force || (P.yaw && Math.abs(yaw - c.partYaw[k]) > .002);
    const sn = c.snap[k], bl = P.boneList;
    if(!d) for(let q = 0; q < bl.length && !d; q++){ const o = bl[q] * 6; for(let e = 0; e < 6; e++) if(Math.abs(bm0[o + e] - sn[q * 6 + e]) > (e < 4 ? 8e-4 : .2)){ d = 1; break; } }
    if(d){ dirtyParts.push(k); c.pdirty[k] = 0; c.partYaw[k] = yaw; for(let q = 0; q < bl.length; q++) for(let e = 0; e < 6; e++) sn[q * 6 + e] = bm0[bl[q] * 6 + e]; }
  });
  const t0 = c.prof ? performance.now() : 0;
  if(c.prof){ c.prof.cnt = c.prof.cnt || {}; for(const k of dirtyParts) c.prof.cnt[PARTS[k].name] = (c.prof.cnt[PARTS[k].name] || 0) + 1; }
  for(const k of dirtyParts){
    if(c.shown[k] === false){ c.pdirty[k] = 1; continue; }
    const P = PARTS[k], bm = c.bm, DX = c.DX, DY = c.DY, X = c.X, Y = c.Y;
    for(let v = P.v0; v < P.v1; v++){
      let x = VX[v] + DX[v], y = VY[v] + DY[v];
      if(VYAW[v]) x = HC[0] + (x - HC[0]) * cs_ + VZ[v] * sn_;
      let px = 0, py = 0;
      for(let q = 0; q < 3; q++){ const b = SKB[v * 3 + q]; if(b < 0) break; const w = SKW[v * 3 + q], o = b * 6; px += w * (bm[o] * x + bm[o + 2] * y + bm[o + 4]); py += w * (bm[o + 1] * x + bm[o + 3] * y + bm[o + 5]); }
      X[v] = px; Y[v] = py;
    }
    const bd = partGeom(P, X, Y, c.gt, c.pnew, c.vs); c.bd[k] = bd; c.ld[k] = partGeom.loop; c.backs[k].setAttribute('d', bd); if(c.loops[k]) c.loops[k].setAttribute('d', partGeom.loop);
    for(let i = P.p0; i < P.p1; i++) if(c.pnew[i] !== c.pstr[i]){ c.pstr[i] = c.pnew[i]; c.polys[i].setAttribute('points', c.pnew[i]); }
  }
  const t1 = c.prof ? performance.now() : 0;
  if(dirtyParts.length){ let sil = ''; for(const P of PARTS) if(inSil(P)) sil += P.zone === 'mane' ? c.bd[P.order] : c.ld[P.order]; c.sil.setAttribute('d', sil); }
  const t2 = c.prof ? performance.now() : 0; if(c.prof){ c.prof.geom += t1 - t0; c.prof.sil += t2 - t1; c.prof.n++; c.prof.parts += dirtyParts.length; }
  c.force = false;
  if(c.view === 'anatomy') drawAnatomy(c);
  if(c.gp){ if(c.t - c.gp.t0 > c.gp.dur){ c.gp = null; } for(const i of GLYPH_I) c.colDirty.add(i); }
  // behaviour: flips and the drifting colour field
  if(c.beh && c.beh.style !== 'off' && c.beh.style !== 'field') spawn(c, now, dt);
  if(c.beh.style === 'field' && now - c.fieldDrawn > 70){ c.fieldDrawn = now; for(const i of FLIPPABLE) c.colDirty.add(i); }
  flipStep(c, now);
  // colour: the muscles' crease ink, the flush, the view
  if(Math.abs(c.flush - c.flushDrawn) > .01){ c.flushDrawn = c.flush; for(const P of PARTS) if(P.flush) for(let i = P.p0; i < P.p1; i++) c.colDirty.add(i); }
  for(const i of c.colDirty) if(!c.flips.has(i)) fillPoly(c, i, polyColour(c, i, now));
  c.colDirty.clear();
}
function fillPoly(c, i, col){ if(c.fill[i] !== col){ c.fill[i] = col; c.polys[i].setAttribute('fill', intHex(col)); } }
/* faceSkinTarget, for the lion: skin, mixed toward ink by tone; then everything else is additive: the crease ink, the roar's flush,
   a flip's hold fading out, the drifting field; in the map view, the dominant muscle's hue by activation. */
/* The light on the sign: a bright head travelling the path, a long fading wake of the behaviour palette behind it, and a white-hot core. */
function glyphLight(c, i, col){
  const g = c.gp, u = (c.t - g.t0) / g.dur; if(u < 0) return col;
  const e = u < 0 ? 0 : u > 1 ? 1 : .5 * u + .5 * u * u * (3 - 2 * u), head = -.1 + 1.28 * e, d = head - GS[i];
  if(d < -.02) return col;
  const hw = GH[i], sunq = GS[i] > .88 ? .55 : 1, core = Math.exp(-((d / .09) ** 2)) * hw * sunq, wake = d > 0 ? Math.exp(-d / .22) * (1 - fSmooth(.86, 1, u)) * hw : 0, fade = 1 - fSmooth(.9, 1, u);
  if(core * fade < .02 && wake < .02) return col;
  const hue = palInt(c.stops, clamp(GS[i] * 1.2 + (g.h || 0)));
  let o = mixInt(col, hue, clamp(wake * .9) * (GS[i] > .88 ? .7 : 1));
  o = mixInt(o, mixInt(c.C.bone, 0xffffff, .4), clamp(core * fade * 1.15));
  return o;
}
function polyColour(c, i, now){
  const P = PARTS[PPART[i]], C = c.C;
  if(c.view === 'map'){
    const m = DOM[i];
    if(m < 0 || P.tags.has('glyph')) return c.base[i];
    return mixInt(c.base[i], musHue[m], Math.min(1, Math.max(.14 + .72 * clamp(Math.abs(c.acts[m])), PTONE[i])));
  }
  let col = c.base[i]; const sh = c.shade[i];
  if(GS[i] >= 0 && c.gp) col = glyphLight(c, i, col);
  if(sh > .01) col = mixInt(col, C.ink, Math.min(.6, sh));
  if(P.flush && c.flush > .02) col = mixInt(col, C.cin, clamp(c.flush * P.flush * (P.name === 'cavity' ? .85 : .55)));
  if(c.beh.style === 'field' && FW[i] >= .3){
    const t = now * .001, n = fbm(PCX[i] * .011 + t * .35, PCY[i] * .011 - t * .25 + fbm(PCX[i] * .006 - t * .2, PCY[i] * .006 + 3.1) * 1.6);
    const a = (c.beh.amp ?? .5) * fSmooth(.42, .78, n) * FW[i]; if(a > .02) col = mixInt(col, palInt(c.stops, n * 1.3 - .15), Math.min(.82, a));
  }
  const h = c.hold.get(i);
  if(h){ const p = (now - h.t0) / h.dur; if(p >= 1) c.hold.delete(i); else { const ha = .85 * (1 - p) ** 1.6 * h.w; col = mixInt(col, h.col, ha); } }
  return col;
}
/* the muscles' displacement and crease ink for the current activations (musApply) */
function musApply(c){
  c.DX.fill(0); c.DY.fill(0); c.shade.fill(0);
  for(const m of MUS){
    const a = c.acts[m.n]; if(Math.abs(a) < .002) continue;
    const V = m.verts, dx = m.dx, dy = m.dy;
    for(let k = 0; k < V.length; k++){ const v = V[k]; c.DX[v] += a * dx[k]; c.DY[v] += a * dy[k]; }
    if(a > 0) for(let k = 0; k < m.shadeI.length; k++) c.shade[m.shadeI[k]] += a * m.shadeW[k];
  }
  for(let i = 0; i < NPOLY; i++) if(Math.abs(c.shade[i] - c.shadeDrawn[i]) > .01){ c.shadeDrawn[i] = c.shade[i]; c.colDirty.add(i); }
  if(c.view === 'map') for(let i = 0; i < NPOLY; i++) c.colDirty.add(i);
}
/* forward kinematics: every bone's matrix is its parent's, then its own turn about its pivot and its slide */
function fk(c){
  const bm = c.bm, prev = c.bmPrev;
  for(let b = 0; b < NB; b++){
    if(IKLEG[b] >= 0) solveLeg(c, IKLEG[b]);
    const B = BONES[b], th = c.rot[b], ca = Math.cos(th), sa = Math.sin(th), px = B.p[0], py = B.p[1], o = b * 6;
    const La = ca, Lb = sa, Lc = -sa, Ld = ca, Le = px - ca * px + sa * py + c.sx[b], Lf = py - sa * px - ca * py + c.sy[b];
    if(B.parent < 0){ bm[o] = La; bm[o + 1] = Lb; bm[o + 2] = Lc; bm[o + 3] = Ld; bm[o + 4] = Le; bm[o + 5] = Lf; }
    else {
      const q = B.parent * 6, Pa = bm[q], Pb = bm[q + 1], Pc = bm[q + 2], Pd = bm[q + 3], Pe = bm[q + 4], Pf = bm[q + 5];
      bm[o] = Pa * La + Pc * Lb; bm[o + 1] = Pb * La + Pd * Lb; bm[o + 2] = Pa * Lc + Pc * Ld; bm[o + 3] = Pb * Lc + Pd * Ld; bm[o + 4] = Pa * Le + Pc * Lf + Pe; bm[o + 5] = Pb * Le + Pd * Lf + Pf;
    }
    let mv = 0; for(let k = 0; k < 6; k++) if(Math.abs(bm[o + k] - prev[o + k]) > (k < 4 ? 3e-4 : .05)) mv = 1;
    c.bMoved[b] = mv; if(mv) for(let k = 0; k < 6; k++) prev[o + k] = bm[o + k];
  }
}
/* ---------- the behaviour layer: panel flips and holds, as in the face rig. Their colour is additive and fades. ---------- */
const FLIPPABLE = []; for(let i = 0; i < NPOLY; i++) if(FW[i] >= .3) FLIPPABLE.push(i);   // the general skin takes the effects
function flip(c, i, now, delay, o = {}){
  if(c.flips.has(i)) return;
  const w = o.w ?? FW[i];
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
  const list = zone ? ZLIST[zone] : FLIPPABLE, w = zone && zone !== 'skin' ? 1 : undefined;
  for(const i of list){ const d = Math.hypot(PCX[i] - cx, PCY[i] - cy); if(d < R * (.75 + .5 * vnoise(PCX[i] * .02, PCY[i] * .02))) flip(c, i, now, d * 2.1 + 140 * vnoise(PCX[i] * .03 + now * .001, PCY[i] * .03), {col, w}); }
}
const LOCKS = PARTS.filter(P => P.locks);
function ripple(c, now, col){
  for(const P of LOCKS) P.locks.forEach(polys => { const a = (Math.atan2(PCY[polys[0]] - MC[1], PCX[polys[0]] - MC[0]) + Math.PI * 2 + .9) % (Math.PI * 2); for(const i of polys) flip(c, i, now, a / (Math.PI * 2) * 1100, {col:col ?? palInt(c.stops, c.rand()), dur:220, hold:520, w:1}); });
}
function spawn(c, now, dt){
  const B = c.beh, st = c.stops; c.flipAcc += (B.rate ?? .6) * dt / 1000;
  const pick = () => FLIPPABLE[(c.rand() * FLIPPABLE.length) | 0];
  const due = () => { if(c.flipAcc >= 1){ c.flipAcc -= 1; return true; } return false; };
  switch(B.style){
    case 'drift': while(due()) flip(c, pick(), now, c.rand() * 200, {col:palInt(st, .3 + .7 * c.rand())}); break;
    case 'jitter': while(due()) flip(c, pick(), now, 0, {twitch:true, dur:110 + c.rand() * 90, col:palInt(st, .75)}); break;
    case 'burst': while(due()){ const i = pick(); burst(c, now, PCX[i], PCY[i], 90 + c.rand() * 120, palInt(st, .3 + .7 * c.rand())); } break;
    case 'ripple': if(c.flipAcc >= 1){ c.flipAcc = 0; ripple(c, now); } break;
  }
}
/* ---------- the anatomy view: bones as kites, ribs, the skull, and one fibre per muscle ---------- */
const RIBS = Array.from({length:9}, (_, k) => { const x = 452 + k * 21, ds = 118 + 16 * Math.sin(k / 8 * Math.PI) + (k > 6 ? 0 : 0); return [[x, 350], [x + 18, 350 + ds * .35], [x + 30, 350 + ds * .8], [x + 18 + (k - 4) * 3, 350 + ds + 46 - k * 3]]; });
const SKULL = {
  cranium:[[-68, -112], [0, -122], [68, -112], [100, -70], [96, -6], [66, 38], [34, 46], [20, 70], [-20, 70], [-34, 46], [-66, 38], [-96, -6], [-100, -70]],
  orbitR:ringPts([60, -34], 24, 10), orbitL:ringPts([-60, -34], 24, 10),
  nasal:[[0, -16], [14, 20], [10, 44], [0, 52], [-10, 44], [-14, 20]],
  archR:[[96, -8], [122, 8], [118, 40], [92, 52]], archL:[[-96, -8], [-122, 8], [-118, 40], [-92, 52]],
  maxilla:[[-52, 52], [52, 52], [60, 74], [30, 88], [-30, 88], [-60, 74]],
  mandible:[[-62, 78], [62, 78], [74, 112], [50, 146], [0, 154], [-50, 146], [-74, 112]],
};
function drawAnatomy(c){
  if(!c.anatBuilt){ buildAnatomy(c); }
  const bm = c.bm, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  const T = (x, y, b, z = 0, yaw = false) => { if(yaw) x = HC[0] + (x - HC[0]) * cs + z * sn; const o = b * 6; return [bm[o] * x + bm[o + 2] * y + bm[o + 4], bm[o + 1] * x + bm[o + 3] * y + bm[o + 5]]; };
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
  c.anatBuilt = true; c.anatEls = []; c.fibers = [];
  const add = (pts, b, cls, o = {}) => { const el = svgEl(cls === 'line' ? 'polyline' : 'polygon', {class:'bone' + (cls === 'line' ? ' line' : '')}); c.anat.appendChild(el); c.anatEls.push({el, pts, b, ...o}); };
  for(let b = 0; b < NB; b++){
    const B = BONES[b]; if(['body', 'sun', 'neck'].includes(B.name)) continue;
    const [px, py] = B.p, [qx, qy] = B.q, l = B.len || 1, nx = -(qy - py) / l, ny = (qx - px) / l, w = Math.min(11, l * .13) + (/^(pelvis|chest)/.test(B.name) ? 4 : 0);
    if(/^(earR|earL)$/.test(B.name)) continue;
    add([[px, py], [px + (qx - px) * .22 + nx * w, py + (qy - py) * .22 + ny * w], [qx, qy], [px + (qx - px) * .22 - nx * w, py + (qy - py) * .22 - ny * w]], b, 'poly');
    const j = svgEl('circle', {class:'jt', r:5, cx:px, cy:py}); // joints ride the same matrices
    c.anat.appendChild(j); c.anatEls.push({el:j, pts:[[px, py]], b, joint:1});
  }
  RIBS.forEach(r => add(chaikin(r, 2, false), BI.chest, 'line'));
  for(let k = 0; k < 14; k++){ const x = 236 + k * 27.5, b = x < 420 ? BI.pelvis : BI.chest, y = 358 - 8 * Math.sin(k / 13 * Math.PI) + (x < 300 ? (x - 300) * .1 : 0); add([[x - 7, y], [x, y - 9], [x + 7, y], [x, y + 9]], b, 'poly'); }
  for(const [k, pts] of Object.entries(SKULL)){
    const world = pts.map(hw), b = k === 'mandible' ? BI.jaw : BI.head;
    add(world, b, /^arch/.test(k) ? 'line' : 'poly', {yaw:true, z:k === 'mandible' ? 40 : 60});
  }
  for(const m of MUS){
    const el = svgEl('line', {class:'fiber', stroke:m.def.hue}); el.dataset.n = m.n;
    const t = svgEl('title'); t.textContent = m.def.name + (m.side === 'C' ? '' : ' ' + m.side); el.appendChild(t);
    el.addEventListener('pointerdown', ev => { ev.stopPropagation(); c.direct[m.n] = Math.abs(c.direct[m.n]) > .5 ? 0 : 1; if(c.onPad) c.onPad(m.n); });
    c.anat.appendChild(el); c.fibers.push({el, m});
  }
}

function creatureApi(c){
  c.play = (name, a = {}) => {
    if(name === 'stride') name = 'walk';
    if(GAIT_PSI[name] !== undefined || POSTURE_NAMES.includes(name)){ goPosture(c, name, a); return; }
    if(!ACTIONS[name]) return;
    if(ACT_NEED[name] && !actionReady(c, name)){ c.pm.pend = c.pm.pend.filter(p => p.name !== name); c.pm.pend.push({name, a}); actionRoute(c, name); return; }
    startAction(c, name, a);
  };
  c.go = (name, o) => goPosture(c, name, o);
  c.posture = () => postureInfo(c);
  c.topFore = () => {};   // the lower limbs are always above the mane (LAYER_LOWER): nothing to raise, so nothing can jump
  c.stop = name => { if(GAIT_PSI[name] !== undefined){ gaitStop(c); return; } c.actions = c.actions.filter(a => a.name !== name); };
  c.toe = k => { const D = IKD[k], o = D.b[2] * 6, m = c.bm; return [m[o] * D.tip[0] + m[o + 2] * D.tip[1] + m[o + 4], m[o + 1] * D.tip[0] + m[o + 3] * D.tip[1] + m[o + 5]]; };
  c.running = name => GAIT_PSI[name] !== undefined ? c.gs.on && c.gs.phase !== 'stop' && c.gait && c.gait.name === name : POSTURE_NAMES.includes(name) ? c.pm.node === name && !c.pm.tr : c.actions.some(a => a.name === name && !a.endT);
  c.setView = v => {
    c.view = v; c.svg.classList.toggle('anat-on', v === 'anatomy'); c.anat.style.display = v === 'anatomy' ? '' : 'none';
    for(let i = 0; i < NPOLY; i++) c.colDirty.add(i);
    if(v === 'anatomy'){ c.force = true; }
  };
  c.setLife = (on, rate) => { c.life.on = !!on; if(rate != null) c.life.rate = rate; c.life.next = c.t + 1500; };
  c.setBeh = b => { Object.assign(c.beh, b); };
  c.resize = n => { c.size = n; if(!c.fit){ c.svg.setAttribute('width', n); c.svg.setAttribute('height', Math.round(n * VH / VW)); } styleAll(c); };   // c.fit: the page sizes the svg by CSS
  c.pad_direct = (n, v) => { c.direct[n] = v; };
  c.reset = () => { c.pm = newPM(); c.gs = newGait(); c.gait = null; c.direct.fill(0); c.pad = newPads(); c.actions = []; c.leg = newLegs(); c.root.x = c.root.y = c.root.r = 0; c.jr.fill(0); c.rs.x.fill(0); c.rs.v.fill(0); c.js.x.fill(0); c.js.v.fill(0); c.cs.x.set([1, 500, 390]); c.cs.v.fill(0); c.tm.x[0] = 1; c.tm.v.fill(0); c.rfix = 0; c.sk = 1; c.ikS.forEach(P => P.n.fill(0)); c.pl.x.fill(0); c.pl.v.fill(0); c.mn.x.fill(0); c.mn.v.fill(0); c.tempo = 1; c.tuft.th = c.tuft.v = 0; c.ts.x.fill(0); c.ts.v.fill(0); c.ps.x.fill(0); c.ps.v.fill(0); c.actsB.fill(0); c.velB.fill(0); c.sc.x.fill(0); c.sc.v.fill(0); c.scx = [0, 0]; c.scy = [0, 0]; c.groundA = 0; c.gx = 0; c.cam.s = 1; c.cam.x = 500; c.cam.y = 390; c.topFore(false); c.flips.forEach((f, i) => { c.polys[i].style.transform = ''; }); c.flips.clear(); c.hold.clear(); for(let i = 0; i < NPOLY; i++) c.colDirty.add(i); };
  c.burst = col => burst(c, c.t, 742, 256, 190, col ?? palInt(c.stops, c.rand()), 'glyph');   // the sun burst: the glyph zone only
  c.burstAt = (x, y, R = 150, col, zone) => burst(c, c.t, x, y, R, col ?? palInt(c.stops, c.rand()), zone);
  c.setBehPalette = list => { c.behPal = list.slice(); c.stops = stopsOf(c.behPal); if(c.beh.style === 'field') for(const i of FLIPPABLE) c.colDirty.add(i); };
  c.ripple = () => ripple(c, c.t);
  c.glyph = (dur = 3000) => { c.gp = {t0:c.t, dur, h:c.rand() * .3}; };
  c.glyphOld = () => { for(const P of PARTS) if(P.tags.has('glyph') && !P.tags.has('sun')) for(let i = P.p0; i < P.p1; i++) flip(c, i, c.t, (P.name === 'haunchRing' ? (i - P.p0) * 18 : 500 + (i - P.p0) * 22), {col:palInt(c.stops, c.rand()), dur:200, hold:1600, w:1}); };
  c.advance = (ms, st = 16) => { let t = c.t; const end = t + ms; while(t < end){ t = Math.min(end, t + st); step(c, t, st); } };
  c.destroy = () => { const k = LIVE.indexOf(c); if(k >= 0) LIVE.splice(k, 1); c.el.innerHTML = ''; };
  c.pause = p => { c.paused = p; };
  c.muscles = MUS; c.defs = MUSCLE_DEFS; c.PADS = PADS; c.PAD_ORDER = PAD_ORDER;
  c.setPad = (name, v, side = 'L') => { const q = c.pad[name]; if(side === 'both'){ q.L = v.slice(); q.R = v.slice(); } else q[side] = v.slice(); };
  c.resetPad = name => { c.pad[name] = {L:[0, 0], R:[0, 0], split:false}; };
  return c;
}
let RAF = 0, FRAME = 0;
function startLoop(){
  if(RAF) return;
  const loop = now => {
    RAF = requestAnimationFrame(loop); FRAME++;
    if(document.hidden) return;
    for(const c of LIVE){
      if(c.paused) continue;
      if(!c.t0) c.t0 = now;
      const small = c.size < 110;
      if(small && FRAME % 3) continue;
      const dt = Math.min(80, now - (c.last || now - 16)); c.last = now;
      const a = performance.now();
      step(c, now - c.t0, dt);
      const ms = performance.now() - a; c.cpu += ms; c.frames++; c.cpuAvg += (ms - c.cpuAvg) * .05;
    }
  };
  RAF = requestAnimationFrame(loop);
}
/* Mesh quality: the smallest interior angle of every triangle outside the mane, in the rest pose (the mane keeps its jagged blades). */
function meshQuality(all = false){
  let n = 0, minA = 180, sum = 0, u20 = 0, u25 = 0, u30 = 0; const per = {};
  for(let i = 0; i < NPOLY; i++){
    const ids = PV[i], P = PARTS[PPART[i]]; if(ids.length !== 3 || P.zone === 'mane' || P.full || (!all && /^(whisk|can|inc|spot|nostril|pupil|glint|sunRays)/.test(P.name))) continue;   // the mane, and the hand-placed teeth, whiskers and spots, are not meshes
    const a = [VX[ids[0]], VY[ids[0]]], b = [VX[ids[1]], VY[ids[1]]], c = [VX[ids[2]], VY[ids[2]]];
    const ang = (p, q, r) => { const ux = q[0] - p[0], uy = q[1] - p[1], vx = r[0] - p[0], vy = r[1] - p[1]; return Math.acos(clamp((ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1), -1, 1)) * 180 / Math.PI; };
    const m = Math.min(ang(a, b, c), ang(b, c, a), ang(c, a, b));
    n++; sum += m; if(m < minA) minA = m; if(m < 20) u20++; if(m < 25) u25++; if(m < 30) u30++;
    const z = P.name; (per[z] = per[z] || [0, 0]); per[z][0]++; if(m < 20) per[z][1]++;
  }
  return {triangles:n, minAngle:+minA.toFixed(2), meanMinAngle:+(sum / n).toFixed(1), under20:+(100 * u20 / n).toFixed(1), under25:+(100 * u25 / n).toFixed(1), under30:+(100 * u30 / n).toFixed(1), per};
}
window.mountCreature = mountCreature; window.creatureRestSvg = restSvg;
window.CREATURES = Object.assign(window.CREATURES || {}, {lion:{mount:mountCreature, restSvg, muscles:MUS, defs:MUSCLE_DEFS, bones:BONES, polys:NPOLY, verts:NVERT, parts:PARTS, palette:creaturePalette, meshQuality, LIMITS, GAITS:GAITP, GAIT_CAP:{stalk:1.5, walk:1.9, trot:1.55}, POSTURES, EDGES, CHN, POSTURE_NAMES, ACT_NEED, pathOf, ROSTER, PADS, PAD_ORDER, TIERS, ZONE_W, ZONE_NAMES, LINES, counts:PARTS.map(p => [p.name, p.p1 - p.p0]),
  rest:{VX, VY, VZ, SKB, SKW, PV, PPART, PCX, PCY, NB, IKD, JSPEED, SECB}}});   // read-only views of the rest mesh and its skin weights, for tools/lion-audit.mjs

})();
