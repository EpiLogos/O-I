/* crew-honeybee.js — the honeybee crew on the comb (CREW-NOTES-HONEYBEE.md). A scene for creature-crew.js: a few whole bees on the floor of the hive, in plan view, doing the roster's patterns between them:
   recruit (the waggle dance and the followers that read it with their antennae), quorum (rival dances, stop signals, piping), guard (real arrivals checked at the gap, and the mimic that passes), haul (a loaded
   forager, receivers, trophallaxis, the tremble dance) and tend (nurses at the brood, a chain of trophallaxis). Scout's flight is the profile lane (creature-honeybee-flight), not this page.
   Every body is the honeybee of creature-honeybee.js, mounted whole by the host; this file builds the world at the crew's scale (CreatureHoneybee.crewWorld), the few actions the crew needs that a lone bee has no
   use for (attend: reach the antennae to a point on another bee's body, with the tips measured), and the patterns. */
(() => {
'use strict';
const K = window.CreatureKit, HB = window.CreatureHoneybee, DEF = K.get('honeybee');
const PI = Math.PI, TAU = 2 * PI, hyp = Math.hypot, cl = (v, a = -1, b = 1) => v < a ? a : v > b ? b : v, pos = v => v > 0 ? v : 0, wrap = a => { while(a > PI) a -= TAU; while(a < -PI) a += TAU; return a; };
const CX = HB.CX, CY = HB.CY, sm = (dt, k) => 1 - Math.exp(-dt / k);

/* ---------- the world at the crew's scale: a dance floor wide enough for a dancer and her followers (800 across), an entrance gap of 680 (a bee is 540 long, 150 wide), a landing board and a field with the sites ---------- */
const DANCE = {x:650, y:0, r:800}, ENT = {x:1800, gap:420, board:340};
const BOARD = [ENT.x + 170, 0];                                               // the middle of the landing board: where a bee leaves from and arrives at
const dirOf = psi => [Math.cos(psi), Math.sin(psi)];
const siteAt = (psi, d = 800) => [BOARD[0] + d * Math.cos(psi), BOARD[1] + d * Math.sin(psi)];
const DECOR = [[ENT.x + 1150, 880, 190], [ENT.x + 1450, -980, 170], [ENT.x + 560, 1000, 160], [ENT.x + 1900, 330, 180], [ENT.x + 640, -1020, 150]];
function world(o = {}){ HB.crewWorld({dance:DANCE, ent:ENT, cells:{i1:11, j1:17}, flowers:[...(o.flowers || []), ...(o.decor === false ? [] : DECOR)], brood:o.brood === undefined ? null : o.brood}); }

/* ---------- a bee's body in the world: the body frame (a forward from the middle of the thorax, b to the animal's right) and the kit's own frame, both to the world and back ---------- */
const bw = (m, a, b) => { const p = m.pose(), c = Math.cos(p.h), s = Math.sin(p.h); return [p.x + m.k * (c * a - s * b), p.y + m.k * (s * a + c * b)]; };
const kw = (m, p) => bw(m, p[0] - CX, p[1] - CY);
const wb = (m, x, y) => { const P = m.pose(), c = Math.cos(P.h), s = Math.sin(P.h), dx = (x - P.x) / m.k, dy = (y - P.y) / m.k; return [c * dx + s * dy, -s * dx + c * dy]; };
const wk = (m, x, y) => { const q = wb(m, x, y); return [q[0] + CX, q[1] + CY]; };
const BODY = [[150, 0, 52], [60, 0, 66], [-10, 0, 76], [-150, 0, 72], [-215, 0, 70], [-262, 0, 48], [-294, 0, 20]];              // the body as circles (a, b, r): head, thorax, abdomen: for deciding, not for measuring
const bodyGap = (m, x, y) => { const q = wb(m, x, y); let best = 1e9; for(const [a, b, r] of BODY) best = Math.min(best, hyp(q[0] - a, q[1] - b) - r); return best * m.k; };
const ANTQ = {R:[], L:[]}; for(const s of ['R', 'L']) for(let i = 0; i < 11; i++) ANTQ[s].push(DEF.bones[DEF.BI['fl' + s + i]].q);
/* where a bee's antennae end: the tip and the joints behind it, in the world */
const antTips = (m, n = 3) => { const c = m.c, out = {R:[], L:[]}; for(const s of ['R', 'L']) for(let i = 10; i > 10 - n; i--) out[s].push(kw(m, c.wp('fl' + s + i, ANTQ[s][i]))); return out; };
const antSocket = (m, s) => kw(m, m.c.wp('head', [CX + 182, CY + (s === 'R' ? 12 : -12)]));
/* the real measure of a touch: the distance of an antenna's last joints to the nearest vertex of the other bee's body (the mesh as it is drawn now: the plates of the abdomen, thorax and head) */
const bodyVerts = new WeakMap();
function vertsOf(m){ let v = bodyVerts.get(m.d); if(!v){ v = []; for(const P of m.d.parts) if(P.tags.has('body') && !P.tags.has('hair') && !P.tags.has('free')) for(let i = P.v0; i < P.v1; i++) v.push(i); bodyVerts.set(m.d, v); } return v; }
function meshGap(m, g){                                                                    // the smallest distance (world units) from m's antenna tips to g's body mesh
  const T = antTips(m, 3), V = vertsOf(g), X = g.c.X, Y = g.c.Y; let best = 1e9;
  for(const s of ['R', 'L']) for(const p of T[s]){ const q = wk(g, p[0], p[1]); for(let k = 0; k < V.length; k++){ const d = (X[V[k]] - q[0]) * (X[V[k]] - q[0]) + (Y[V[k]] - q[1]) * (Y[V[k]] - q[1]); if(d < best) best = d; } }
  return Math.sqrt(best) * g.k;
}

/* ---------- attend: the antennae reach to a point on another bee. The crew's one new action (it exists only on this page: it is added to the creature's definition here, and the creature's own file does not know it).
   a.sites() returns the points to touch, in the world (the abdomen's flank, a nestmate's antennae, a mouth), or null to let the antennae rest. Each antenna aims at the nearest point on its own side: the scape swings in or out
   until the line from its socket through its tip runs at the point (the error is measured on the drawn tip, every frame), the flagellum curls when the point is nearer than the antenna is long, and taps a little. ---------- */
DEF.actions.attend = {label:'Antennate', group:'Crew', dur:1e9, gait:true, f:(t, T, c, a) => {
  const m = c.crew && c.crew.m; if(!m || !a.sites) return false;
  const S = a.s || (a.s = {u:{R:0, L:0}, cu:{R:0, L:0}, ht:0, w:0, hit:{R:1e9, L:1e9}}), dt = c.dtms || 16, pts = a.sites(), on = !!pts && pts.length;
  S.w += ((on ? 1 : 0) - S.w) * sm(dt, 260);
  let hd = 0;
  for(const side of ['R', 'L']){
    const s = side === 'R' ? 1 : -1, sock = antSocket(m, side), tip = kw(m, c.wp('fl' + side + '10', ANTQ[side][10]));
    if(on){
      const ah = Math.atan2(tip[1] - sock[1], tip[0] - sock[0]), mine = m.pose().h;
      let best = null, bd = 1e9; for(const p of pts){ const d = hyp(p[0] - sock[0], p[1] - sock[1]), side_ = Math.sin(Math.atan2(p[1] - sock[1], p[0] - sock[0]) - mine) * s; const sc = d * (side_ < -.15 ? 1.8 : 1); if(sc < bd){ bd = sc; best = p; } }
      const err = wrap(Math.atan2(best[1] - sock[1], best[0] - sock[0]) - ah), reach = hyp(tip[0] - sock[0], tip[1] - sock[1]), want = hyp(best[0] - sock[0], best[1] - sock[1]);
      S.u[side] = cl(S.u[side] + err * s * 2.0 * sm(dt, 200), -1.15, 1.25); S.cu[side] += (cl((reach - want) / 70, 0, 1) - S.cu[side]) * sm(dt, 300); S.hit[side] = hyp(best[0] - tip[0], best[1] - tip[1]);
      hd += wrap(Math.atan2(best[1] - sock[1], best[0] - sock[0]) - mine) * .5;
    } else { S.u[side] += (0 - S.u[side]) * sm(dt, 500); S.cu[side] += (0 - S.cu[side]) * sm(dt, 500); }
  }
  S.ht += (cl(hd / .36, -.7, .7) * S.w - S.ht) * sm(dt, 300);
  const tap = (a.tap ?? 1) * S.w, ph = t * (a.rate ?? .03);
  const u = S.u, o = {};
  for(const side of ['R', 'L']){ const s = side === 'R' ? 1 : -1, tp = Math.sin(ph + (side === 'R' ? 0 : 2.1));
    o['scapeOut' + side] = pos(u[side]) * S.w; o['scapeIn' + side] = pos(-u[side]) * S.w; o['flSweep' + side] = (.2 * u[side] + .13 * tap * tp) * S.w; o['flCurl' + side] = .55 * S.cu[side] * S.w + .08 * tap * (.5 + .5 * Math.sin(ph * .7 + 1)); }
  o.headTurnR = pos(S.ht); o.headTurnL = pos(-S.ht);
  c.spec(T, o);
}};
const LIFE_OK = ['antennaFlick', 'headScan', 'mouthWork'];                    // a crew member's own life is its small tics only: no scouting flight, dance or trophallaxis of its own accord in the middle of a pattern
DEF.lifePick = (c, pick) => c.crew && !LIFE_OK.includes(pick);

/* ---------- the scene: drivers (small per-tick controllers), the cast of a pattern, the evidence a pattern's check reads ---------- */
let crew = null, DR = [], EV = {};
const drive = fn => { let done = false; DR.push(dt => { if(!done && fn(dt) === true) done = true; return done; }); return () => done; };
const tickHook = dt => { for(let i = DR.length - 1; i >= 0; i--) if(DR[i](dt)) DR.splice(i, 1); };
const pileNote = () => ' | bodies overlapping by more than 30 units for ' + (PILE.ms / 1000).toFixed(1) + ' s' + (PILE.worst ? ' (worst ' + PILE.worst.toFixed(0) + ', ' + PILE.pair + ')' : '');
const wait = ms => crew.wait(ms);
/* a little pattern of its own, run beside the main one (a leaver's walk out of the hive): the same generator rules (a yielded function is a condition, a number a wait in ms) on the crew's clock */
function spawn(fn){
  const gen = fn(); let w = null, fin = false;
  drive(() => { if(w && !w()) return false; w = null;
    for(let n = 0; n < 30; n++){ const r = gen.next(); if(r.done){ fin = true; return true; } const v = r.value; if(typeof v === 'number'){ w = wait(v); return false; } if(v == null) return false; const f = crew.all(v); if(!f()){ w = f; return false; } } return false; });
  return () => fin;
}
const until = f => f;
const both = (...L) => crew.all(...L);
/* a member of the crew: the bee on the comb. role is what she does in this pattern. */
function bee(name, role, at, h, o = {}){
  const m = crew.add({def:'honeybee', name, role, at, h, owner:crew.members.length === 0, seed:o.seed ?? 5 + 3 * crew.members.length, palette:o.palette || {}, radius:o.radius ?? 150, life:o.life ?? true});
  m.odour = o.odour || 'colony'; m.k = m.k || 1; dress(m);
  if(crew.virtual) m.c.pause(true);
  return m;
}
/* walk to a point, then stand still (a walker that is told to keep watching a body never reports that it has arrived, so a walk that is waited on clears the watch first) */
const to = (m, x, y, o) => { m.watch(null); return m.goto(x, y, o); };
const stand = m => { m.c.go('stand'); return () => m.c.pm.node === 'stand' && !m.c.pm.moving && !m.c.gait; };
const headOf = m => bw(m, 190, 0);
const mouthOf = m => bw(m, 232, 0);
const dancing = m => { const A = m.c.actions.find(x => x.name === 'waggle'); return A && !A.cut ? A : null; };
const runPhase = m => { const A = dancing(m); return !!A && A.phase === 'run' && !!m.c.gait && m.c.gait.name === 'waggleRun'; };
const ang = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0);

/* the touch points on a bee's body that an antenna can reach: the flank of the abdomen, the sting end, the sides of the thorax; the nestmate's antennae, the mouth */
const flank = (g, side) => [bw(g, -150, side * 74), bw(g, -215, side * 72), bw(g, -262, side * 46)];
const abdomen = g => [...flank(g, 1), ...flank(g, -1), bw(g, -292, 0)];
const thorax = g => [bw(g, 20, 76), bw(g, 20, -76), bw(g, 80, 60), bw(g, 80, -60)];
const feelers = g => { const T = antTips(g, 2); return [...T.R, ...T.L]; };

/* the distance between two bees' antennae: the nearest pair of the last joints (the tips) */
function feelGap(a, b){ const A = antTips(a, 2), B = antTips(b, 2); let best = 1e9; for(const sa of ['R', 'L']) for(const pa of A[sa]) for(const sb of ['R', 'L']) for(const pb of B[sb]) best = Math.min(best, hyp(pa[0] - pb[0], pa[1] - pb[1])); return best; }
/* an odour is not a thing on the comb but the guard reads it: it is drawn as a ring of dots round the bee that carries it (gold for the colony's, cinnabar for a stranger's) */
function aura(m, tone){
  const e = mkS('circle', {fill:'none', stroke:hex(m.c.C[tone === 'colony' ? 'gold' : 'cin']), 'stroke-width':9, 'stroke-dasharray':'1 30', 'stroke-linecap':'round', opacity:'.8', r:290}); crew.habitat.under.appendChild(e); m.aura = e;
  drive(() => { const p = m.pose(); e.setAttribute('cx', p.x.toFixed(0)); e.setAttribute('cy', p.y.toFixed(0)); e.setAttribute('transform', 'rotate(' + (crew.t * .004).toFixed(2) + ' ' + p.x.toFixed(0) + ' ' + p.y.toFixed(0) + ')'); e.setAttribute('stroke', hex(m.c.C[m.smell === 'colony' ? 'gold' : 'cin'])); });
  m.smell = tone; return e;
}
/* a ring of places round the dance, in the world: the dancer works in the middle (her run and loops are about 450 across), the followers stand outside it facing her, near enough that her body comes within reach of their antennae
   (a follower's antennae end 340 from the middle of its thorax) and far enough that it never comes into their bodies. th is the angle from the run's direction, r the distance from the middle of the dance. */
const RING = [{th:PI, r:640}, {th:PI / 2 + .35, r:700}, {th:-PI / 2 - .35, r:700}];
const ringSpot = (psi, k) => { const R = RING[k], a = psi + R.th; return [DANCE.x + R.r * Math.cos(a), DANCE.y + R.r * Math.sin(a)]; };

/* a bee that flies: from the board, along a heading, to a distance. The world scrolls under her at the cruise speed the figure itself sets (c.hb.fvT), and she steers by the steer pad; this is the plan-view flight the creature already has. */
const steerOf = m => { const p = m.c.pad.steer; if(p) p.L[0] = p.R[0] = 0; return v => { if(p){ p.L[0] = v; p.R[0] = v; } }; };
function flyAlong(m, psi, dist, speed = .5){
  m.stop(); const set = steerOf(m); let x0 = null;
  return drive(dt => { const p = m.pose(); if(!x0) x0 = [p.x, p.y]; const E = m.c.hb; if(hyp(p.x - x0[0], p.y - x0[1]) >= dist){ set(0); E.fvT = 0; return true; } E.fvT = speed; set(cl(2.2 * wrap(psi - p.h), -1, 1)); });
}
const takeoff = m => { m.c.go('flight'); return () => m.c.pm.node === 'flight' && !m.c.pm.moving; };

/* a follower keeps to its side of the dancer: a bearing from the middle of her dance (fixed in the world, and the middle follows her only slowly: it is where she has been these few seconds), at 640 from it, where her body swinging
   round her run and loops comes within reach of its antennae (they end 340 from the middle of its thorax) without coming into its own. If she comes within 480 of it, it steps back; if she is more than 760 off (the dance has moved on),
   it goes to the new place. The host keeps the walkers clear of one another. */
function keepSector(f, theta, dancer, o = {}){
  const D = o.d ?? 620, near = o.near ?? 500, far = o.far ?? 760, tok = {live:true}, p0 = dancer.pose(); if(f.tok) f.tok.live = false; f.tok = tok; f.sector = theta; f.following = dancer; f.watch(dancer);
  const anc = {x:p0.x, y:p0.y}, home = (extra = 0) => [anc.x + (D + extra) * Math.cos(theta), anc.y + (D + extra) * Math.sin(theta)];
  const go = (extra = 0) => { const h = home(extra); f.goto(h[0], h[1], {r:80}); f.watch(dancer); };
  go(); let back = false;
  drive(dt => { if(!tok.live) return true; const p = dancer.pose(), q = f.pose(), d = hyp(q.x - p.x, q.y - p.y), a = sm(dt, 3500); anc.x += (p.x - anc.x) * a; anc.y += (p.y - anc.y) * a;
    if(!back && d < near){ back = true; go(180); }                                          // she is coming into it: step out of her way, at once, whatever it was doing
    else if(back && d > near + 120){ back = false; go(); }
    else if(!back && !f.target && (d > far || hyp(q.x - home()[0], q.y - home()[1]) > 260)) go(); });
  return tok;
}
const unfollow = f => { if(f.tok) f.tok.live = false; f.tok = null; f.following = null; f.watch(null); };
/* the world's strokes were drawn for one bee at a pane a few hundred units across; a crew's pane is 2600 across, so every stroke of the comb, the floor, the wall and the field is thickened to read at that scale
   (the comb's own widths times 2.3; set here, on the elements the creature built) */
const NSVG = 'http://www.w3.org/2000/svg', mkS = (tag, a = {}) => { const e = document.createElementNS(NSVG, tag); for(const k in a) e.setAttribute(k, a[k]); return e; };
const hex = n => '#' + ((n >>> 0) & 0xffffff).toString(16).padStart(6, '0');
function dress(m, k = 2.3){ const st = m.c.svg.__hw; if(!st || !st.els || st.dressed) return; st.dressed = true; for(const key in st.els){ const e = st.els[key], w = parseFloat(e.getAttribute('stroke-width')); if(w) e.setAttribute('stroke-width', (w * k).toFixed(2)); } }
/* where a bee has been, laid on the comb: the last 16 s of her path in age bins that fade, the straight run of a waggle dance thicker than the loops between */
function track(m, o = {}){
  const g = mkS('g', {'pointer-events':'none'}), life = o.life ?? 16000, bin = life / 8, run = [], loop = []; crew.habitat.under.appendChild(g);
  for(let b = 0; b < 8; b++){ const op = (1 - b / 8) ** 1.3 * (o.alpha ?? .7); for(const [arr, w] of [[loop, o.loop ?? 11], [run, o.run ?? 24]]) arr.push(mkS('path', {fill:'none', stroke:hex(m.c.C[o.tone || 'gold']), 'stroke-width':w, 'stroke-linecap':'round', 'stroke-linejoin':'round', opacity:op.toFixed(2)})); }
  g.append(...loop, ...run); const S = []; let last = -1e9, draw = -1e9;
  drive(() => { const t = crew.t, p = m.pose();
    if(t - last > 90){ last = t; S.push({t, x:p.x, y:p.y, r:runPhase(m)}); while(S.length && t - S[0].t > life) S.shift(); }
    if(t - draw > 220){ draw = t; for(let b = 0; b < 8; b++){ let dl = '', dr = ''; for(let i = 1; i < S.length; i++){ const age = t - S[i].t; if(age < b * bin || age >= (b + 1) * bin + 90) continue; const seg = 'M' + S[i - 1].x.toFixed(0) + ' ' + S[i - 1].y.toFixed(0) + 'L' + S[i].x.toFixed(0) + ' ' + S[i].y.toFixed(0); if(S[i].r) dr += seg; else dl += seg; } loop[b].setAttribute('d', dl); run[b].setAttribute('d', dr); } }
    return o.until ? o.until() : false; });
  return g;
}
/* ---------- the stage: a pattern's cast and world, laid out afresh each time it starts (so the page can run any pattern, in any order, from a clean comb) ---------- */
/* how much the bodies overlap, as the eye counts it (the gate counts centres): every tick, for every pair, the gap between their body circles; the time a pair spent more than 30 units into each other is kept */
let PILE = {ms:0, worst:0, pair:'', ev:[]};
const circlesOf = m => BODY.map(([a, b, r]) => { const p = bw(m, a, b); return [p[0], p[1], r * m.k]; });
function pileStep(dt){ const M = crew.members, C = M.map(circlesOf); let any = false;
  for(let i = 0; i < M.length; i++) for(let j = i + 1; j < M.length; j++){ let g = 1e9; for(const a of C[i]) for(const b of C[j]) g = Math.min(g, hyp(a[0] - b[0], a[1] - b[1]) - a[2] - b[2]);
    if(g < -30){ any = true; if(-g > PILE.worst){ PILE.worst = -g; PILE.pair = M[i].name + '/' + M[j].name; } if(!PILE.ev.some(e => e[1] === M[i].name + '/' + M[j].name && crew.t - e[0] < 1500)) PILE.ev.push([Math.round(crew.t), M[i].name + '/' + M[j].name, Math.round(-g)]); } }
  if(any) PILE.ms += dt; }
function reset(view){
  crew.clear(); DR = []; EV = {t0:0}; PILE = {ms:0, worst:0, pair:'', ev:[]}; crew.tickHook = dt => { tickHook(dt); pileStep(dt); }; if(view) crew.setView(view);
}
const sees = (a, b) => hyp(a.pose().x - b.pose().x, a.pose().y - b.pose().y);

/* =============================== 1. RECRUIT =============================== */
const REC = {psi:-.3};
const DANCER = {ink:'#F2D98A'};                                              // the dancer's ink, a little lighter than the others', so that the one the others are reading is the one that shows
const VIEW_DANCE = {x:DANCE.x - 1300, y:DANCE.y - 1300, w:2600, h:2600}, VIEW_WIDE = {x:-300, y:-1650, w:3300, h:3300};   // the dance, close; then the whole way out to the field, so that every body stays in the pane
function stageRecruit(){
  const psi = REC.psi, site = siteAt(psi);
  reset(VIEW_DANCE);
  world({flowers:[[site[0], site[1], 320]]});
  const dancer = bee('Dancer', 'scout, back from the field', [DANCE.x + 160, DANCE.y + 120], PI, {seed:5, palette:DANCER});
  const F = [0, 1, 2].map(i => { const a = psi + PI + (i - 1) * 1.15, x = DANCE.x + 1000 * Math.cos(a), y = DANCE.y + 1000 * Math.sin(a); return bee('Follower ' + (i + 1), 'recruit', [x, y], a + PI + (i - 1) * .3, {seed:8 + i}); });
  dress(dancer); track(dancer);
  EV = {dancer, F, psi, site, danceMs:0, contact:F.map(() => 0), near:F.map(() => 0), decode:F.map(() => ({s:0, c:0, n:0})), left:[], gone:[], gap:F.map(() => 1e9), t0:crew.t, exit:[]};
  return {dancer, F, psi, site};
}
function* recruit(run, cast){
  const {dancer, F, psi, site} = cast, bearing = psi + PI / 2;
  /* the evidence, every tick: whether each follower's antennae are on the dancer's body (the mesh as drawn), and what her run says while they are (the heading of the waggle run, read as a bearing) */
  drive(dt => {
    if(dancing(dancer)) EV.danceMs += dt;
    F.forEach((f, i) => { const g = meshGap(f, dancer); EV.gap[i] = Math.min(EV.gap[i], g);
      if(g < 42 && f.attending) EV.contact[i] += dt;                                    // her body touched by the antennae (the mesh)
      if(g < 150 && f.attending){ EV.near[i] += dt; if(runPhase(dancer)){ const h = dancer.pose().h, D = EV.decode[i]; D.s += Math.sin(h); D.c += Math.cos(h); D.n++; } } });   // within 150 (about 3.5 mm): in the near field of her wings, which is what a follower reads the dance from
    return run.state === 'done' || run.state === 'failed';
  });
  yield dancer.goto(DANCE.x, DANCE.y, {r:60});
  yield stand(dancer);
  const dn = dancer.do('waggle', {circuits:3, bearing, loop:1, at:[DANCE.x, DANCE.y]});
  /* the followers come to the dance, one after another, and stand on the ring facing her; one that is too near her body steps back */
  F.forEach((f, i) => keepSector(f, psi + PI + (i - 1) * 1.15, dancer));
  yield wait(2500);
  F.forEach((f, i) => { f.c.play('attend', {sites:() => dancing(dancer) ? abdomen(dancer) : null, tap:1}); f.attending = true; });
  yield dn;
  run.set('producing');
  yield wait(500);
  /* what each follower read: the heading of her run, from the touches (a bearing from the sun line is the heading plus a quarter turn) */
  F.forEach((f, i) => { unfollow(f); const D = EV.decode[i]; f.decoded = D.n ? Math.atan2(D.s, D.c) : null; f.attending = false; f.c.stop('attend'); f.watch(null); });
  /* and they leave, one at a time, by the entrance, each along the bearing it read, out into the field; she stays where she danced */
  crew.setView(VIEW_WIDE, false);
  const out = F.filter(f => f.decoded !== null), gone = [], spots = [[BOARD[0] + 80, 0], [BOARD[0] - 20, -400], [BOARD[0] - 20, 400]];
  /* each leaver has its own lane to the gap and its own place on the board, and goes round the dancer, who stays where she danced: the one that was behind her goes round by the north, the one at her south by the south, so that no two cross */
  const lane = f => { const p = dancer.pose(), q = f.pose(), a = wrap(Math.atan2(q.y - p.y, q.x - p.x) - EV.psi); return Math.abs(a) > 2.3 ? 0 : a > 0 ? 2 : 1; };     // 0 behind her (centre lane), 2 south, 1 north
  const order = out.slice().sort((a, b) => [1, 2, 0].indexOf(lane(a)) - [1, 2, 0].indexOf(lane(b)));                      // the north one first, then the south, and the one that was behind her last, round by the north
  order.forEach((f, i) => { const k = lane(f), sp = spots[k], dp = dancer.pose();
    spawn(function*(){
      yield wait(i * 3600);
      if(k === 0){ yield f.goto(dp.x + 80, dp.y - 760, {r:100, gait:'run'}); }                                      // round her by the north
      yield f.goto(ENT.x - 200, sp[1] * .9, {r:90, gait:'run'}); yield f.goto(sp[0], sp[1], {r:70, gait:'run'}); yield f.face(f.decoded, {tol:.15}); yield stand(f);
      yield takeoff(f); EV.exit.push({name:f.name, t:crew.t, h:f.pose().h, x:f.pose().x}); yield flyAlong(f, f.decoded + [0, -.16, .16][k], 340 + i * 60, .5); gone.push(f); EV.gone.push({name:f.name, x:f.pose().x, y:f.pose().y});
    }); });
  yield () => gone.length >= out.length; EV.left = gone.map(f => f.name);
  yield wait(1200);
}

const recruitCheck = () => { const E = EV, rows = E.F.map((f, i) => ({n:f.name, near:E.near[i], touch:E.contact[i], dec:f.decoded === null ? null : wrap(f.decoded - E.psi)}));
  const reach = rows.filter(r => r.near >= .2 * E.danceMs).length, decoded = rows.filter(r => r.dec !== null && Math.abs(r.dec) < .35).length, out = E.gone.filter(g => g.x > ENT.x + ENT.board).length;
  const ok = reach >= 3 && rows.filter(r => r.touch >= 800).length >= 2 && decoded >= 2 && out >= 2;
  return {ok, notes:'the dance ran ' + (E.danceMs / 1000).toFixed(1) + ' s; antennae within reach (150) of her for ' + rows.map(r => (r.near / 1000).toFixed(1)).join(' / ') + ' s, on her body for ' + rows.map(r => (r.touch / 1000).toFixed(1)).join(' / ') + ' s; read ' + rows.map(r => r.dec === null ? 'nothing' : (r.dec >= 0 ? '+' : '') + r.dec.toFixed(2)).join(' / ') + ' rad off her bearing; ' + out + ' left by the entrance and flew out along it' + pileNote()}; };

/* =============================== 4. GUARD =============================== */
const VIEW_ENT = {x:ENT.x - 1500, y:-1400, w:2800, h:2800}, FOREIGN = {ink:'#C44536'};
function stageGuard(who){
  reset(VIEW_ENT); world({});
  const g1 = bee('Guard 1', 'guard', [ENT.x - 170, -340], 0, {seed:21}), g2 = bee('Guard 2', 'guard', [ENT.x - 170, 340], 0, {seed:22});
  dress(g1); g1.c.go('guard'); g2.c.go('guard');
  const A = [];
  who.forEach(([kind, y], i) => {
    const foreign = kind !== 'nestmate', x = bee(kind === 'nestmate' ? 'Forager (nestmate)' : kind === 'robber' ? 'Robber' : 'Robber (mimic)', 'arrival', [ENT.x + 880, y], PI, {seed:30 + i, palette:foreign ? FOREIGN : {}, odour:kind === 'robber' ? 'foreign' : 'colony'});
    x.type = kind; x.robber = foreign; aura(x, x.odour); if(!foreign){ x.c.hb.cropT = .8; x.c.hb.loadT[0] = x.c.hb.loadT[1] = .7; }
    A.push(x); });
  EV = {guards:[g1, g2], A, t0:crew.t, touch:A.map(() => 0), inside:A.map(() => false), verdict:A.map(() => null), robbed:0};
  return {g1, g2, A};
}
/* the record of what a guard admitted (the spec asks the guard for one): a tick on the wall by her post for every arrival she lets in, the mimic's as well */
const ledgerTick = G => { const n = (G.led = (G.led || 0) + 1), p = G.pose(), sg = p.y < 0 ? -1 : 1, x = ENT.x - 90 - n * 30, y0 = p.y + sg * 190; crew.habitat.over.appendChild(mkS('path', {d:'M' + x + ' ' + y0 + 'l0 ' + (sg * 90), stroke:'#d4a03c', 'stroke-width':11, 'stroke-linecap':'round', opacity:'.85'})); };
function* guardRun(run, cast){
  const {g1, g2, A} = cast, GS = [g1, g2];
  drive(dt => { A.forEach((x, i) => { const G = x.guard; if(G && feelGap(x, G) < 60) EV.touch[i] += dt; if(x.pose().x < ENT.x - 200) EV.inside[i] = true; }); return run.state === 'done' || run.state === 'failed'; });
  yield () => g1.c.pm.node === 'guard' && g2.c.pm.node === 'guard' && !g1.c.pm.moving && !g2.c.pm.moving;
  run.set('waiting');
  for(let i = 0; i < A.length; i++){
    const X = A[i], G = GS[i % 2], gp = G.pose(), meet = [gp.x + 650, gp.y], side = i % 2 ? -1 : 1;
    X.guard = G; EV.cur = i;
    yield to(X, meet[0], meet[1], {r:70, gait:'run'});
    run.set('acting');
    X.watch(G);
    /* each holds out its antennae to the other's: the guard from her post, the arrival where it stopped */
    G.c.play('attend', {sites:() => feelers(X), tap:1.4}); X.c.play('attend', {sites:() => feelers(G), tap:1.4});
    const t0 = crew.t; yield wait(2500); yield () => EV.touch[i] >= 1500 || crew.t - t0 > 9000;           // she does not judge before her antennae have been on it
    const v = X.odour === G.odour ? 'admit' : 'refuse'; EV.verdict[i] = v;
    G.c.stop('attend'); X.c.stop('attend'); X.watch(null);
    if(v === 'admit'){
      G.c.play('headScan');
      ledgerTick(G);
      if(X.robber){ run.note('FAILURE: ' + X.name + ' smells of the colony and is admitted'); EV.robbed++; } else run.set('producing');
      yield to(X, ENT.x + 60, 0, {r:80}); yield to(X, ENT.x - 760, 0, {r:80});
      if(X.robber){                                                    // the mimic is in, and goes for the honey
        yield to(X, ENT.x - 1050, 220 * side, {r:70}); yield X.go('feed'); X.c.play('trophallaxis', {dir:'take'}); EV.robbedAt = crew.t; yield wait(4500); yield X.go('stand');
      } else yield to(X, ENT.x - 1150, 160 * side, {r:70});
    } else {
      yield G.go('stand'); G.c.play('sting', {side});
      const out = spawn(function*(){ yield to(X, ENT.x + 560, X.pose().y * .4, {r:80, gait:'run'}); yield takeoff(X); X.flew = true; yield flyAlong(X, 0, 260, .6); });
      yield wait(700); yield to(G, gp.x + 110, gp.y, {r:60, gait:'run'}); yield wait(500); yield to(G, gp.x, gp.y, {r:60}); yield G.face(0, {tol:.12}); yield G.go('guard');
      yield out;
    }
    run.set('waiting'); yield wait(1200);
  }
  if(EV.robbed){ yield wait(600); return 'failed'; }                      // the run ends in what happened: a robber is in
  run.set('producing'); yield wait(600);
}
const guardCheck = want => { const ok = [], bad = []; EV.A.forEach((x, i) => { const v = EV.verdict[i], touched = EV.touch[i] >= 1200, inside = EV.inside[i], w = want[i];
  const right = v === w.verdict && touched && inside === w.inside; (right ? ok : bad).push(x.name + ': ' + (v || 'unchecked') + ', antennae ' + (EV.touch[i] / 1000).toFixed(1) + ' s, ' + (inside ? 'got in' : 'kept out')); });
  return {ok:!bad.length, notes:(bad.length ? 'WRONG ' + bad.join('; ') + ' | ' : '') + ok.join('; ') + pileNote()}; };

/* =============================== 2. QUORUM =============================== */
/* Three scouts are back from three sites and dance them: the livelier the dance (the more circuits to a bout) the sooner it wins a follower (a follower is won by the run it has seen: one run of a three-circuit dance, two of a
   two-circuit one, three of a one-circuit one, which never shows three in a bout), and a follower that finds its dance too poor to win it goes to a livelier one. A scout that has been won for a site dances it too, and carries the
   stop signal to a rival dancer. When a site has QUORUM scouts won for it they pipe, and that site is chosen. */
const SITES = [{id:'A', psi:-.95, spot:[400, -660], circ:1, rest:3500, sect:[PI - .3, -.5]}, {id:'B', psi:-.2, spot:[1020, 0], circ:3, rest:2500, sect:[-PI / 2 + .15, PI / 2 - .15, .3]}, {id:'C', psi:.5, spot:[400, 660], circ:2, rest:3000, sect:[PI + .3, .5]}], QUORUM = 2, VIEW_Q = {x:-800, y:-1300, w:2800, h:2600};
/* the failure of a quorum: two equal dances, one scout won for each, a count of two that neither reaches, and no stop signal to break the tie (the spec: a quorum needs a stop signal) */
const TIE = [{id:'A', psi:-.6, spot:[520, -560], circ:3, rest:2500, sect:[PI - .3, -.5]}, {id:'B', psi:.4, spot:[520, 560], circ:3, rest:2500, sect:[PI + .3, .5]}];
let SS = SITES;
const runsNeeded = circ => circ >= 3 ? 1 : circ === 2 ? 2 : 3;
function stageQuorum(tie){
  reset(VIEW_Q); world({decor:false}); SS = tie ? TIE : SITES;
  const D = SS.map((S, i) => bee('Dancer ' + S.id, 'dances site ' + S.id, S.spot, S.psi + (i - 1) * .7, {seed:70 + i, palette:DANCER}));
  const F = (tie ? [[140, -200, -1.2], [440, 230, .9]] : [[640, -230, 2.9], [640, 270, -2.6], [330, 20, .1]]).map(([x, y, h], i) => bee('Follower ' + (i + 1), 'uncommitted', [x, y], h, {seed:80 + i}));
  dress(D[0]); D.forEach(d => track(d));
  SS.forEach(S => crew.habitat.under.appendChild(mkS('path', {d:'M' + S.spot[0] + ' ' + S.spot[1] + 'l' + (560 * Math.cos(S.psi)).toFixed(0) + ' ' + (560 * Math.sin(S.psi)).toFixed(0), fill:'none', stroke:'#d4a03c', 'stroke-width':9, 'stroke-dasharray':'2 26', 'stroke-linecap':'round', opacity:'.32'})));   // the bearing each one dances, drawn from where she dances it
  const ids0 = () => Object.fromEntries(SS.map(S => [S.id, 0]));
  EV = {D, F, tie, t0:crew.t, tally:ids0(), won:Object.fromEntries(SS.map(S => [S.id, []])), chosen:null, piped:[], stops:0, stopT:null, runs:F.map(ids0), left:[]};
  return {D, F};
}
function* quorumRun(run, cast){
  const {D, F} = cast, byId = Object.fromEntries(D.map((d, i) => [SS[i].id, d])), dB = byId.B, dC = byId.C, S = Object.fromEntries(SS.map(s => [s.id, s])), tie = EV.tie;
  drive(dt => { F.forEach((f, k) => { const dm = f.following; if(!dm) return; const run_ = runPhase(dm) && hyp(f.pose().x - dm.pose().x, f.pose().y - dm.pose().y) < 760; if(run_ && !f.inRun){ f.inRun = true; f.runs++; EV.runs[k][dm.site]++; } else if(!run_) f.inRun = false; }); return run.state === 'done' || run.state === 'failed'; });
  D.forEach((d, i) => { d.site = SS[i].id; d.over = false; });
  /* the dancers: bouts of their circuits, with a rest between, until stopped */
  D.forEach((d, i) => spawn(function*(){ const st = SS[i]; yield wait(i * 700); while(!d.over){ const a = d.do('waggle', {circuits:st.circ, bearing:st.psi + PI / 2, loop:i % 2 ? 1 : -1, at:st.spot}); yield a; if(d.over) break; yield wait(st.rest); } }));
  run.set('acting');
  /* the followers: each starts at one dance */
  const win = (f, id) => { EV.tally[id]++; EV.won[id].push(f.name); f.won = id; f.role = 'won for ' + id; EV.wonT = EV.wonT || {}; EV.wonT[id] = crew.t; };
  const used = {A:0, B:0, C:0};
  const visit = (f, dm) => { f.runs = 0; f.inRun = false; const st = S[dm.site], th = st.sect[used[dm.site]++ % st.sect.length]; keepSector(f, th, dm); f.c.stop('attend'); f.c.play('attend', {sites:() => dancing(dm) ? abdomen(dm) : null, tap:1}); };
  const judged = (f, id) => () => f.runs >= runsNeeded(S[id].circ) || (f.runs > 0 && f.runs < runsNeeded(S[id].circ) && !dancing(byId[id]) && f.t_ && crew.t - f.t_ > 3000);
  const flow = (f, first, then) => spawn(function*(){
    yield wait(1200); let id = first; f.t_ = crew.t;
    for(;;){ visit(f, byId[id]); f.t_ = null;
      const need = runsNeeded(S[id].circ);
      // wait until it has seen as many runs as it needs, or the dance gives out (a bout over with too few runs seen)
      yield () => f.runs >= need || (f.runs >= 1 && f.runs < need && !dancing(byId[id]) && S[id].circ < need);
      if(f.runs >= need){ win(f, id); break; }
      const left_ = id; f.c.stop('attend'); unfollow(f); id = then; f.sectorShift = 1.1; run.note(f.name + ' leaves ' + left_ + '\'s dance: too few runs to win her');
    }
    f.won_ = true;
  });
  if(tie){ flow(F[0], 'A', 'A'); flow(F[1], 'B', 'B'); } else { flow(F[0], 'A', 'B'); flow(F[1], 'C', 'C'); flow(F[2], 'B', 'B'); }
  /* the scout won for B goes to the C dancer and gives her the stop signal: a head-butt and a shiver, which ends her dance */
  if(!tie) spawn(function*(){ yield () => F[2].won === 'B' && crew.t - EV.wonT.B > 8000; const X = F[2]; EV.stopping = true; X.c.stop('attend'); unfollow(X); const target = dC;
    const near_ = d_ => drive(() => { const p = target.pose(), q = X.pose(), d = hyp(q.x - p.x, q.y - p.y) || 1, gx = p.x + (q.x - p.x) / d * d_, gy = p.y + (q.y - p.y) / d * d_; if(!X.target || hyp(X.target[0] - gx, X.target[1] - gy) > 130) X.goto(gx, gy, {r:80, gait:'run'}); return hyp(q.x - p.x, q.y - p.y) < d_ + 60; });
    yield near_(640);                                                   // it comes to her, and keeps clear of her swing
    yield () => !dancing(target);                                       // and delivers the signal in the pause between two bouts, when she stands
    yield near_(420);
    X.stop(); X.watch(target); yield wait(700); X.c.play('attend', {sites:() => thorax(target), tap:2}); X.c.play('stopSignal'); yield wait(900);
    target.c.hb.stopAt = target.c.t; EV.stops++; EV.stopT = crew.t; target.over = true; X.c.stop('attend'); X.watch(null);
    const p = dB.pose(); keepSector(X, SS[1].sect[0], dB); X.c.play('attend', {sites:() => dancing(dB) ? abdomen(dB) : null, tap:1}); EV.stopping = false; });
  /* the count: when a site has its quorum of scouts, they pipe, the dancers of the others stand down, and that site is chosen */
  yield () => (Math.max(...Object.values(EV.tally)) >= QUORUM && !EV.stopping) || (tie && crew.t - EV.t0 > 32000);
  if(tie && Math.max(...Object.values(EV.tally)) < QUORUM){ EV.deadlock = true; run.note('FAILURE: one scout won for each of two equal dances, a count of ' + QUORUM + ' is never reached, and nothing stops either dance'); yield wait(1500); return 'stalled'; }
  const win_ = SS.map(s => s.id).find(id => EV.tally[id] >= QUORUM); EV.chosen = win_; EV.quorumT = crew.t; run.set('producing');
  D.forEach(d => { d.over = true; d.c.stop('waggle'); d.stop(); d.c.go('stand'); });
  F.forEach(f => { f.c.stop('attend'); });
  yield wait(1500);
  const choir = [byId[win_], ...F.filter(f => f.won === win_)]; choir.forEach(m => { m.watch(null); m.stop(); });
  yield choir.map(m => stand(m));
  choir.forEach(m => { m.c.play('pipe'); EV.piped.push(m.name); });
  /* the chosen bearing is drawn on the floor, from the dance floor's middle, as the line the dance gave */
  const psi = S[win_].psi, ray = mkS('path', {d:'M' + DANCE.x + ' ' + DANCE.y + 'L' + (DANCE.x + 1500 * Math.cos(psi)).toFixed(0) + ' ' + (DANCE.y + 1500 * Math.sin(psi)).toFixed(0), fill:'none', stroke:'#d4a03c', 'stroke-width':14, 'stroke-dasharray':'2 34', 'stroke-linecap':'round', opacity:'0'}); crew.habitat.over.appendChild(ray);
  const t0 = crew.t; yield drive(() => { const u = cl((crew.t - t0) / 2400); ray.setAttribute('opacity', (.85 * u).toFixed(2)); return u >= 1; });
  yield wait(2800);
}
const tieCheck = () => { const T = EV.tally, ds = EV.D.filter(d => !d.over).length;
  const ok = EV.deadlock && Object.values(T).every(n => n === 1) && EV.stops === 0 && ds === 2 && !EV.chosen;
  return {ok, notes:'tally ' + JSON.stringify(T) + ' (quorum ' + QUORUM + '): no site chosen, no stop signal given, ' + ds + ' of 2 dancers still at it (neither was stopped) when the run ended' + pileNote()}; };
const quorumCheck = () => { const T = EV.tally, ch = EV.chosen, others = ['A', 'B', 'C'].filter(k => k !== ch).map(k => T[k]);
  const ok = ch === 'B' && T[ch] >= QUORUM && others.every(n => n < T[ch]) && EV.piped.length >= 3 && EV.stops >= 1;
  return {ok, notes:'tally A ' + T.A + ' / B ' + T.B + ' / C ' + T.C + ' (quorum ' + QUORUM + '); chosen ' + ch + ' with ' + (T[ch] || 0) + '; piped by ' + EV.piped.join(', ') + '; stop signals delivered ' + EV.stops + '; runs seen ' + JSON.stringify(EV.runs) + pileNote()}; };

/* a bee's loads: nectar in the crop (the abdomen swells), pollen in the baskets of the hind legs */
const load = (m, crop, pollen = 0) => { const E = m.c.hb; E.crop = E.cropT = crop; E.load[0] = E.load[1] = E.loadT[0] = E.loadT[1] = pollen; };
const cropOf = m => m.c.hb.crop;
const mouthTip = m => kw(m, m.c.wp('glossa', DEF.bones[DEF.BI.glossa].q));
const headAt = (m, d = 215) => bw(m, d, 0);
/* two bees give and take by mouth: each goes to the feeding posture facing the other, the giver and the taker play the two halves of the exchange (the crop falls in one and rises in the other), and they part to stand */
function* exchange(giver, taker){
  giver.watch(null); taker.watch(null);
  yield [giver.go('stand'), taker.go('stand')];
  const pa = giver.pose(), pb = taker.pose();
  yield [giver.face(ang(pa.x, pa.y, pb.x, pb.y), {tol:.1}), taker.face(ang(pb.x, pb.y, pa.x, pa.y), {tol:.1})];
  yield [giver.go('feed'), taker.go('feed')];
  const a = giver.do('trophallaxis', {dir:'give'}), b = taker.do('trophallaxis', {dir:'take'}); EV.exch = (EV.exch || 0) + 1;
  yield [a, b];
  yield [giver.go('stand'), taker.go('stand')];
}

/* =============================== 5. HAUL =============================== */
const VIEW_STORE = {x:ENT.x - 2000, y:-1200, w:2400, h:2400}, X0 = ENT.x - 420;
function stageHaul(jam){
  reset(VIEW_STORE); world({decor:false});
  const R1 = bee('Receiver 1', 'receiver', [X0, -720], -PI / 2, {seed:41}), R2 = bee('Receiver 2', 'receiver', [X0, 720], PI / 2, {seed:42});
  const R3 = bee('Receiver 3', 'receiver', [ENT.x - 1320, -640], .6, {seed:43}), R4 = bee('Receiver 4', 'receiver', [ENT.x - 1380, 700], -.5, {seed:44});
  const F = bee('Forager', 'forager', [ENT.x + 130, 0], PI, {seed:40});
  dress(R1); load(F, .95, .7); load(R1, 1); load(R2, 1); load(R3, jam ? 1 : 0); load(R4, jam ? 1 : 0);
  R1.c.go('feed'); R2.c.go('feed');
  EV = {F, R:[R1, R2, R3, R4], t0:crew.t, crop0:.95, touch:[0, 0], gap:[1e9, 1e9], recruited:[], tremble:0, wait0:null, stores:0, jam};
  return {F, R1, R2, R3, R4};
}
function* haulRun(run, cast){
  const {F, R1, R2, R3, R4} = cast, jam = EV.jam;
  drive(dt => { EV.touch[0] += feelGap(F, R1) < 70 || meshGap(F, R1) < 50 ? dt : 0; EV.touch[1] += meshGap(F, R2) < 50 ? dt : 0;
    for(const [i, R] of [[0, R3], [1, R4]]){ if(R.exch) EV.gap[i] = Math.min(EV.gap[i], hyp(...[mouthTip(F)[0] - headAt(R)[0], mouthTip(F)[1] - headAt(R)[1]])); }
    EV.stores = [R1, R2, R3, R4].reduce((n, m) => n + ((m.c.svg.__hw && m.c.svg.__hw.store) ? m.c.svg.__hw.store.length : 0), 0);
    return run.state === 'done' || run.state === 'failed'; });
  yield [R1.go('feed'), R2.go('feed')];
  run.set('acting');
  /* she comes in through the gap with her load, and looks for a receiver: the two nearest are busy, heads down in the cells, and do not turn */
  yield to(F, X0, -150, {r:70, gait:'run'}); yield F.face(-PI / 2, {tol:.1});
  F.c.play('attend', {sites:() => abdomen(R1), tap:1.6}); EV.wait0 = crew.t; run.set('waiting');
  yield wait(3600); F.c.stop('attend');
  yield to(F, X0, 150, {r:70}); yield F.face(PI / 2, {tol:.1});
  F.c.play('attend', {sites:() => abdomen(R2), tap:1.6}); yield wait(3600); F.c.stop('attend');
  /* the wait is long: she turns to the hive and shakes (the tremble dance); the longer she has waited the harder she shakes. The shaking stirs the idle receivers, which come to her. */
  const summon = (R, heading, d, delay) => { const h = {live:true}; spawn(function*(){ yield wait(delay); R.watch(null); EV.recruited.push(R.name); R.c.play('attend', {sites:() => feelers(F), tap:1.2}); let last = -1e9;
    yield drive(() => { if(!h.live) return true; if(crew.t - last > 700){ last = crew.t; const p = F.pose(); R.goto(p.x + d * Math.cos(heading), p.y + d * Math.sin(heading), {r:90}); } return false; }); }); return h; };
  yield F.face(PI, {tol:.1});
  const rounds = jam ? 3 : 1, calls = [];
  for(let r = 0; r < rounds; r++){
    EV.tremble++; const delay = cl((crew.t - EV.wait0) / 16000, .35, 1);
    F.c.play('tremble', {delay}); EV.tremT = EV.tremT ?? crew.t;
    if(!jam && r === 0){ calls.push(summon(R3, PI, 760, 1500), summon(R4, PI - .9, 820, 3300)); }
    yield wait(5600);
    if(jam){ F.c.stop('tremble'); yield to(F, X0, 0, {r:80}); yield F.face(PI, {tol:.1}); yield wait(1500); }
  }
  if(jam){
    run.note('FAILURE: every receiver is full; no one comes, the load stays and the line behind it backs up');
    yield wait(2500); return 'stalled';
  }
  /* the receiver that came first takes her load; then the second */
  const take = function*(R, call, heading){
    call.live = false; R.c.stop('attend'); F.c.stop('tremble'); F.watch(null); yield F.go('stand'); yield F.face(heading, {tol:.1}); const p = F.pose(), spot = [p.x + 780 * Math.cos(heading), p.y + 780 * Math.sin(heading)];
    yield to(R, spot[0], spot[1], {r:70}); R.exch = true;
    yield* exchange(F, R); R.exch = false;
  };
  run.set('producing');
  yield* take(R3, calls[0], PI);
  const away3 = spawn(function*(){ yield to(R3, R3.pose().x - 300, R3.pose().y - 160, {r:80}); yield R3.face(PI, {tol:.2}); yield stand(R3); R3.c.play('unload'); yield wait(5000); });
  yield* take(R4, calls[1], PI - .9);
  const away4 = spawn(function*(){ yield to(R4, R4.pose().x - 300, R4.pose().y + 160, {r:80}); yield R4.face(PI, {tol:.2}); yield stand(R4); R4.c.play('unload'); yield wait(5000); });
  yield [away3, away4];
  yield wait(600);
}
const haulCheck = jam => { const F = EV.F, R = EV.R, gain = R.slice(2).reduce((n, m) => n + cropOf(m), 0), left = cropOf(F);
  if(jam) return {ok:left > .8 && EV.tremble >= 3 && EV.stores === 0 && !EV.recruited.length, notes:'she still carries ' + left.toFixed(2) + ' of her load after ' + EV.tremble + ' tremble dances; no receiver recruited; ' + EV.stores + ' cells filled' + pileNote()};
  const ok = left < .15 && gain + EV.stores * .5 >= .8 && EV.recruited.length >= 2 && EV.exch >= 2;
  return {ok, notes:'her load ' + EV.crop0 + ' -> ' + left.toFixed(2) + '; receivers took ' + gain.toFixed(2) + ' in the crop and stored ' + EV.stores + ' cell(s); recruited ' + EV.recruited.length + '; mouth gaps ' + EV.gap.map(g => g.toFixed(0)).join(', ') + '; the wait before the tremble ' + (((EV.tremT || 0) - (EV.wait0 || 0)) / 1000).toFixed(1) + ' s' + pileNote()}; };

/* =============================== 6. TEND =============================== */
const BROOD = {x:-150, y:1500, r:620}, VIEW_TEND = {x:-1000, y:100, w:2700, h:2600};
const CHAIN = [[660, 1250, 0], [1360, 1250, PI], [1360, 1950, -PI / 2], [660, 1950, 0]];   // the four bees of the chain, in a square 700 across: A faces east, B west, C north, D east (each turns to the next as its turn comes)
function fedMark(x, y){ const g = mkS('g', {opacity:'0'}); g.append(mkS('circle', {cx:x, cy:y, r:44, fill:'#d4a03c', 'fill-opacity':.35, stroke:'#d4a03c', 'stroke-width':6}), mkS('circle', {cx:x, cy:y, r:76, fill:'none', stroke:'#d4a03c', 'stroke-width':4, 'stroke-dasharray':'2 12', 'stroke-linecap':'round'})); crew.habitat.over.appendChild(g); return g; }
function stageTend(){
  reset(VIEW_TEND); world({brood:BROOD, decor:false});
  const bees = CHAIN.map(([x, y, h], i) => bee('Chain ' + 'ABCD'[i], i === 0 ? 'carries nectar' : 'passes it on', [x, y], h, {seed:51 + i}));
  bees.forEach((b, i) => load(b, i === 0 ? .9 : .1, 0));
  const N = [bee('Nurse 1', 'nurse', [-540, 1050], 0, {seed:61}), bee('Nurse 2', 'nurse', [-520, 1950], 0, {seed:62})]; N.forEach(n => load(n, .6, 0));
  dress(bees[0]);
  const cells = bees[0].c.svg.__hw.cellsD.cells.filter(c => c.kind === 'brood' && hyp(c.cx - BROOD.x, c.cy - BROOD.y) < 470);
  const pick = (up) => { const L = cells.filter(c => up ? c.cy < BROOD.y - 120 : c.cy > BROOD.y + 120).sort((a, b) => hyp(a.cx - BROOD.x, a.cy - BROOD.y) - hyp(b.cx - BROOD.x, b.cy - BROOD.y)); const out = []; for(const c of L){ if(out.every(o => hyp(o.cx - c.cx, o.cy - c.cy) > 330)) out.push(c); if(out.length === 2) break; } return out; };
  const mine = [pick(true), pick(false)];
  EV = {chain:bees, N, mine, t0:crew.t, fed:[], gaps:[], exch:0, crop0:bees.map(b => cropOf(b)), pairGap:[1e9, 1e9, 1e9], inspected:0, marks:[]};
  return {chain:bees, N, mine};
}
function* tendRun(run, cast){
  const {chain, N, mine} = cast, [A, B, C, D] = chain;
  drive(dt => { [[A, B], [B, C], [C, D]].forEach(([g, t], k) => { if(g.exchanging) EV.pairGap[k] = Math.min(EV.pairGap[k], hyp(mouthTip(g)[0] - headAt(t)[0], mouthTip(g)[1] - headAt(t)[1])); }); return run.state === 'done' || run.state === 'failed'; });
  run.set('acting');
  /* the nurses, each at two brood cells: she stands off the cell facing it, reaches the antennae over it (the inspection), then puts her mouth in (the feeding) and the cell is fed */
  const nurse = (n, cells) => spawn(function*(){
    for(const cell of cells){
      const p = n.pose(), h = ang(p.x, p.y, cell.cx, cell.cy), st = [cell.cx - 430 * Math.cos(h), cell.cy - 430 * Math.sin(h)];
      yield to(n, st[0], st[1], {r:50}); yield n.face(ang(n.pose().x, n.pose().y, cell.cx, cell.cy), {tol:.05}); yield stand(n);
      const rim = [0, 1, 2, 3, 4, 5].map(k => [cell.cx + 110 * Math.cos(k * PI / 3 + PI / 6), cell.cy + 110 * Math.sin(k * PI / 3 + PI / 6)]);
      n.c.play('attend', {sites:() => rim, tap:1.7}); yield wait(3000); n.c.stop('attend'); EV.inspected++;
      yield n.go('feed'); const mk = fedMark(cell.cx, cell.cy); EV.marks.push(mk); n.c.play('trophallaxis', {dir:'give'});
      const t0 = crew.t; yield wait(2200); EV.gaps.push(hyp(mouthTip(n)[0] - cell.cx, mouthTip(n)[1] - cell.cy)); EV.fed.push([cell.i, cell.j]);
      yield drive(() => { const u = cl((crew.t - t0) / 2600); mk.setAttribute('opacity', u.toFixed(2)); return u >= 1; }); yield wait(1500); n.c.stop('trophallaxis'); yield n.go('stand');
    }
  });
  const nu = N.map((n, k) => nurse(n, mine[k]));
  /* the chain: nectar from the one that carries it to the last, mouth to mouth, each turning to the next */
  for(const [g, t, k] of [[A, B, 0], [B, C, 1], [C, D, 2]]){ g.exchanging = true; yield* exchange(g, t); g.exchanging = false; if(k === 0) run.set('producing'); }
  yield nu;
  yield wait(800);
}
const tendCheck = () => { const [A, B, C, D] = EV.chain, dn = cropOf(D) - EV.crop0[3], gaps = EV.gaps.map(g => g.toFixed(0)).join(', ');
  const ok = cropOf(A) < EV.crop0[0] - .35 && dn > .35 && EV.exch === 3 && EV.pairGap.every(g => g < 180) && EV.fed.length >= 3 && EV.gaps.every(g => g < 110);
  return {ok, notes:'nectar ' + EV.crop0[0] + ' -> ' + cropOf(A).toFixed(2) + ' in the first, ' + EV.crop0[3] + ' -> ' + cropOf(D).toFixed(2) + ' in the last; ' + EV.exch + ' mouth-to-mouth exchanges, mouths ' + EV.pairGap.map(g => g.toFixed(0)).join('/') + ' apart; ' + EV.fed.length + ' brood cells fed (mouth to cell centre ' + gaps + ')' + pileNote()}; };

/* ---------- the page ---------- */
CreatureCrew.page({title:'HONEYBEE', sign:'', sub:'the crew on the comb', view:{x:DANCE.x - 1050, y:DANCE.y - 1050, w:2100, h:2100}, thumbPattern:'recruit',
  setup(c){
    crew = c; crew.tickHook = tickHook;
    const patterns = [
      {id:'recruit', label:'Recruit', note:'the waggle dance: a dancer, and the followers that gather round her, feel the run with their antennae, read the bearing and leave by the entrance along it', run:r => recruit(r, stageRecruit()), maxMs:80000, check:recruitCheck},
      {id:'quorum', label:'Quorum', note:'three dancers advertise three sites, the livelier dance wins followers sooner, a won scout stops a rival\'s dance, and when enough are won for one site they pipe and it is chosen', run:r => quorumRun(r, stageQuorum()), maxMs:120000, check:quorumCheck},
      {id:'quorum-tie', label:'Quorum: the tie', note:'the failure: two equal dances, one scout won for each, a count that neither reaches, and no stop signal to break it', run:r => quorumRun(r, stageQuorum(true)), maxMs:80000, expect:'stalled', check:tieCheck},
      {id:'guard', label:'Guard', note:'two guards at the gap; foragers walk in from the field, each is felt over with the antennae and admitted or refused by its odour', run:r => guardRun(r, stageGuard([['nestmate', -340], ['robber', 340]])), maxMs:90000, check:() => guardCheck([{verdict:'admit', inside:true}, {verdict:'refuse', inside:false}])},
      {id:'guard-mimic', label:'Guard: the mimic', note:'the failure: a robber that carries the colony\'s smell is admitted, and goes to the honey', run:r => guardRun(r, stageGuard([['robber', -340], ['mimic', 340]])), maxMs:90000, expect:'failed', check:() => { const c = guardCheck([{verdict:'refuse', inside:false}, {verdict:'admit', inside:true}]); return {ok:c.ok && EV.robbed === 1, notes:c.notes + (EV.robbed === 1 ? ' | the mimic was admitted and fed on the store' : ' | no robbery')}; }},
      {id:'haul', label:'Haul', note:'a loaded forager finds the receivers busy; she shakes (the tremble dance), more receivers come, and take the load mouth to mouth', run:r => haulRun(r, stageHaul(false)), maxMs:120000, check:() => haulCheck(false)},
      {id:'haul-jam', label:'Haul: the jam', note:'the failure: every receiver is full, the tremble recruits no one, and the load stays with her', run:r => haulRun(r, stageHaul(true)), maxMs:90000, expect:'stalled', check:() => haulCheck(true)},
      {id:'tend', label:'Tend', note:'two nurses inspect and feed the brood, head over the cell; four bees pass nectar down a chain, mouth to mouth', run:r => tendRun(r, stageTend()), maxMs:120000, check:tendCheck},
    ];
    stageRecruit(); window.HBC = {EV:() => EV, PILE:() => PILE};
    return {patterns};
  }});
})();
