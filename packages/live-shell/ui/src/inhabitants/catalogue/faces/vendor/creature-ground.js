/* creature-ground.js — the GROUND of a creature seen from above (a plan), as one system: sand that belongs to the world, a camera that follows the creature, and everything the
   feet do to it. Written for the crab (round 4) and meant for every many-legged body seen from above (a spider, a scorpion, an insect): see creature-template-crab.js.

   WHAT IT IS. The creature stays where it is on the page; the ground moves under it. The ground is a rigid transform of the world about the creature's centre: `cw` is the world point under
   the centre, `phi` the angle the ground has turned on the page. Walking moves `cw` along the creature's own sideways axis; turning turns `phi`. A foot that is planted keeps the same WORLD
   point, so on the page it moves with the ground. The creature's heading is therefore never lost (it is `phi`), and the ripples, stones, prints and the light all stay put in the world.
   Nothing here touches the kit: the creature's hooks drive it (idle: step the world, plant and lift feet; colourLive: draw).

   WHAT IT DRAWS (one ink, the figure's own line language, no fills but the dark ground; colour only from the palette):
   - under the figure: a pool of sand tone, a world pattern (grain, ripples, stones, each in its own tile period so the repeat does not show), the footprints, and the cast
     shadows (a hole in the texture: the carapace and each leg, offset by the height of each point along a light that is fixed in the WORLD, so a turning crab turns its shadows);
   - over the figure: the heap of sand a buried crab lies under, and the grains in the air.
   Two fades keep the ground from having an edge: a radial mask on everything under the figure.
   Parameters the owner can play with (see `params`): grain (fine to coarse ripples), persistence (how long a print lasts), thrown (how much sand the feet throw and heap).

   Cost: the world pattern is a few thousand static path segments in four <path> elements, moved by ONE transform per frame; prints and grains are pooled elements updated only while they live. */
(() => {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
let UID = 0;
const mk = (tag, a = {}) => { const e = document.createElementNS(NS, tag); for(const k in a) e.setAttribute(k, a[k]); return e; };
const hex = n => '#' + ('000000' + (n >>> 0).toString(16)).slice(-6);
const mixInt = (a, b, t) => { const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255, br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255; return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t); };
const rng = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v, r1 = v => Math.round(v * 10) / 10;
const wrap = a => { while(a > Math.PI) a -= 2 * Math.PI; while(a < -Math.PI) a += 2 * Math.PI; return a; };
const rot = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * x - s * y, s * x + c * y]; };

/* the world pattern: each class has its own tile period T and a list of marks in tile coordinates (centred on the tile) */
function dotsMarks(T, N, seed){ const R = rng(seed), out = []; for(let i = 0; i < N; i++) out.push([(R() - .5) * T, (R() - .5) * T, R() < .26 ? 1 : 0]); return out; }
/* ripple crests: rows of long, sinuous, broken crests running one way (a0), each row a little out of step with its neighbours, like wave ripples on firm sand. `sp` is the row spacing
   (across the crests), `len` the mean crest length, `amp` the wobble. A mark is [x, y, angle, half length, bend]. */
function rippleMarks(T, sp, len, a0, seed, amp = 6){
  const R = rng(seed), out = [], ca = Math.cos(a0), sa = Math.sin(a0), half = T * .72, rows = Math.ceil(half / sp);
  for(let r = -rows; r <= rows; r++){
    const v0 = r * sp + (R() - .5) * sp * .35; let u = -half + R() * len * .5;
    while(u < half){
      const L = len * (.55 + R() * .9), uc = u + L / 2, x = uc * ca - v0 * sa, y = uc * sa + v0 * ca, drift = .12 * Math.sin((x * .9 + y * .5) * 2 * Math.PI / T + seed) + .1 * Math.sin((y * 1.3 - x * .4) * 2 * Math.PI / T + 2 * seed);
      if(x >= -T / 2 && x < T / 2 && y >= -T / 2 && y < T / 2) out.push([x, y, a0 + drift + (R() - .5) * .08, L / 2, (R() - .5) * amp * 2]);
      u += L + len * (.18 + R() * .6);
    }
  }
  return out;
}
function stoneMarks(T, N, seed, rMin, rMax){ const R = rng(seed), out = []; for(let i = 0; i < N; i++){ const r = rMin + (rMax - rMin) * Math.pow(R(), 1.6); out.push([(R() - .5) * T, (R() - .5) * T, r, R() * 6, R()]); } return out; }

function make(c, o = {}){
  const svg = c.svg, PIV = o.pivot || [500, 420], UIDn = ++UID;
  const G = Object.assign({}, proto, {PIV, T:{}, phi:0, cw:[0, 0], cwX:0, cwY:0, params:{grain:0, persist:1, thrown:1}, pin:[], sw:[], last:[], fade:0, turned:false, om:0, wasOn:false, light:o.light ?? -2.3, lightK:o.lightK ?? .5, R:o.radius || 640, drawn:{}, prints:[], pi:0, parts:[], seed:o.seed ?? 11, time:0, rand:c.rand, lastFade:undefined, crew:c.crew || null});
  /* ---- dom: under the figure, over it ---- */
  const defs = mk('defs'), g1 = mk('radialGradient', {id:'cgr' + UIDn, gradientUnits:'userSpaceOnUse', cx:PIV[0], cy:PIV[1], r:G.R});
  g1.append(mk('stop', {offset:'0', 'stop-color':'#fff', 'stop-opacity':'1'}), mk('stop', {offset:'.5', 'stop-color':'#fff', 'stop-opacity':'.92'}), mk('stop', {offset:'.78', 'stop-color':'#fff', 'stop-opacity':'.38'}), mk('stop', {offset:'1', 'stop-color':'#fff', 'stop-opacity':'0'}));
  const mask = mk('mask', {id:'cgm' + UIDn, maskUnits:'userSpaceOnUse', x:PIV[0] - G.R - 20, y:PIV[1] - G.R - 20, width:2 * G.R + 40, height:2 * G.R + 40}); mask.append(mk('rect', {x:PIV[0] - G.R - 20, y:PIV[1] - G.R - 20, width:2 * G.R + 40, height:2 * G.R + 40, fill:'url(#cgr' + UIDn + ')'}));
  const g2 = mk('radialGradient', {id:'cgp' + UIDn, gradientUnits:'userSpaceOnUse', cx:PIV[0], cy:PIV[1], r:G.R * .92}); G.poolStops = [mk('stop', {offset:'0'}), mk('stop', {offset:'1'})]; g2.append(...G.poolStops);
  defs.append(g1, mask, g2);
  const under = mk('g', {class:'cg-under', 'pointer-events':'none'}), masked = mk('g', {mask:'url(#cgm' + UIDn + ')'}), pool = mk('circle', {cx:PIV[0], cy:PIV[1], r:G.R, fill:'url(#cgp' + UIDn + ')'});
  const world = mk('g', {class:'cg-world'}), cls = {};
  for(const [name, T, w, ws] of [['grain', 300, 2, 0], ['grainB', 300, 3.2, 0], ['fine', 330, 1.2, 2.6], ['ripple', 460, 2.1, 5], ['coarse', 720, 3.2, 8], ['stone', 760, 1.7, 5]]){
    const grp = mk('g', {class:'cg-' + name}), pathS = ws ? mk('path', {fill:'none', 'stroke-width':ws, 'stroke-linecap':'round', 'stroke-linejoin':'round'}) : null, path = mk('path', {fill:'none', 'stroke-width':w, 'stroke-linecap':'round', 'stroke-linejoin':'round'});
    if(pathS) grp.append(pathS); grp.append(path); world.append(grp); cls[name] = {T, grp, path, pathS, w};
  }
  G.cls = cls;
  const prints = mk('g', {class:'cg-prints'}); world.append(prints); G.printsG = prints;
  const shade = mk('g', {class:'cg-shade'}); G.shadeG = shade; G.sh = {};
  masked.append(pool, world); under.append(defs, masked, shade);
  /* in a crew (creature-crew.js) the sand is the crew's (crew.sand) and the prints are laid in the shared habitat, in world coordinates with no transform of their own; the shadows stay with the body */
  if(c.crew){ masked.style.display = 'none'; c.crew.habitat.under.appendChild(prints); }
  const over = mk('g', {class:'cg-over', 'pointer-events':'none'});
  const clip = mk('clipPath', {id:'cgc' + UIDn}), clipP = mk('path'); clip.append(clipP); defs.append(clip); G.clipP = clipP;
  G.mound = {fill:mk('path'), shade:mk('path', {'fill-rule':'evenodd'}), lines:mk('path', {fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round', 'clip-path':'url(#cgc' + UIDn + ')'}), ghost:mk('path', {fill:'none', 'stroke-linecap':'round', 'stroke-dasharray':'9 11', 'clip-path':'url(#cgc' + UIDn + ')'}), rim:mk('path', {fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round'}), dots:mk('path', {fill:'none', 'stroke-linecap':'round'})};
  over.append(G.mound.fill, G.mound.shade, G.mound.lines, G.mound.ghost, G.mound.rim, G.mound.dots);
  G.air = {a:mk('path', {fill:'none', 'stroke-linecap':'round'}), b:mk('path', {fill:'none', 'stroke-linecap':'round'})}; over.append(G.air.a, G.air.b);
  svg.insertBefore(under, c.rig); if(c.anat) svg.insertBefore(over, c.anat); else svg.append(over);
  G.under = under; G.over = over;
  /* ---- the marks ---- */
  G.marks = {
    grain:dotsMarks(cls.grain.T, 46, G.seed + 1).filter(m => !m[2]), grainB:dotsMarks(cls.grainB.T, 46, G.seed + 1).filter(m => m[2]),
    fine:rippleMarks(cls.fine.T, 30, 80, o.crest ?? .32, G.seed + 2, 4), ripple:rippleMarks(cls.ripple.T, 64, 190, o.crest ?? .32, G.seed + 3, 8), coarse:rippleMarks(cls.coarse.T, 140, 420, o.crest ?? .32, G.seed + 4, 16),
    stone:stoneMarks(cls.stone.T, 13, G.seed + 5, 6, 22),
  };
  /* the lattice copies of one class that can ever be on the page (the world point under the centre stays within half a tile of the tile origin) */
  const copies = (T, R) => { const n = Math.ceil((R + .71 * T + T / 2) / T), out = []; for(let i = -n; i <= n; i++) for(let j = -n; j <= n; j++) if(Math.hypot(i * T, j * T) <= R + 1.42 * T) out.push([i * T, j * T]); return out; };
  const R_VIS = G.R + 40;
  const build = (name, f, which = 'path') => { const K = cls[name], list = G.marks[name]; let d = ''; for(const [ox, oy] of copies(K.T, R_VIS)) for(const m of list) d += f(m, ox, oy); K[which].setAttribute('d', d); };
  build('grain', (m, ox, oy) => 'M' + r1(m[0] + ox) + ' ' + r1(m[1] + oy) + 'h.1');
  build('grainB', (m, ox, oy) => 'M' + r1(m[0] + ox) + ' ' + r1(m[1] + oy) + 'h.1');
  const SH = [Math.cos(G.light + Math.PI), Math.sin(G.light + Math.PI)];   // the shadow side of a crest (the light is fixed in the world)
  /* a crest is a chain of quadratic segments (Q then T, each reflecting the last control point): an S-shaped, sinuous line, `K` half-waves long */
  const crest = (k, K) => (m, ox, oy) => { const [x, y, a, h, bd] = m, ca = Math.cos(a), sa = Math.sin(a), cx = x + ox + SH[0] * k, cy = y + oy + SH[1] * k, st = 2 * h / K, nx = -sa, ny = ca;
    let d = 'M' + r1(cx - ca * h) + ' ' + r1(cy - sa * h) + 'Q' + r1(cx - ca * h + ca * st / 2 + nx * bd) + ' ' + r1(cy - sa * h + sa * st / 2 + ny * bd) + ' ' + r1(cx - ca * h + ca * st) + ' ' + r1(cy - sa * h + sa * st);
    for(let q = 2; q <= K; q++) d += 'T' + r1(cx - ca * h + ca * st * q) + ' ' + r1(cy - sa * h + sa * st * q); return d; };
  for(const [n, k, K] of [['fine', 2, 2], ['ripple', 4, 3], ['coarse', 7, 4]]){ build(n, crest(0, K)); build(n, crest(k, K), 'pathS'); }
  const stoneEll = (m, ox, oy, k) => { const [x, y, r, ph, tall] = m, rx = r, ry = r * (.58 + .3 * tall), cx = x + ox + SH[0] * k * r, cy = y + oy + SH[1] * k * r, a = ph * 30;
    return 'M' + r1(cx - rx) + ' ' + r1(cy) + 'a' + r1(rx) + ' ' + r1(ry) + ' ' + r1(a) + ' 1 0 ' + r1(2 * rx) + ' 0a' + r1(rx) + ' ' + r1(ry) + ' ' + r1(a) + ' 1 0 ' + r1(-2 * rx) + ' 0'; };
  build('stone', (m, ox, oy) => stoneEll(m, ox, oy, 0)); build('stone', (m, ox, oy) => stoneEll(m, ox, oy, .5), 'pathS');
  /* ---- the pooled prints (in absolute world coordinates, in the world group) ---- */
  const NP = o.prints || 240; for(let i = 0; i < NP; i++){ const e = mk('path', {fill:'none', 'stroke-linecap':'round', 'stroke-linejoin':'round', opacity:'0', 'stroke-width':2.1}); prints.append(e); G.prints.push({e, t0:-1e9, life:0, q:0, str:0, x:0, y:0}); }
  /* ---- the particles: grains in the air (screen frame), two sizes ---- */
  G.par = []; G.parMax = o.grains || 90;
  colour(G, c.C); c.ground = G;   // the creature's handle on its ground: a crew host reads and sets the pose through it (pose, place)
  return G;
}

/* the palette: the sand's tone is the figure's ink at low strength; every stroke is a mix toward it, so the ground stays inside the one ink */
function colour(G, C){
  if(G.C === C) return; G.C = C;
  const gr = C.skin, ink = C.ink, bone = C.bone;
  const L = (t, tone = ink) => hex(mixInt(gr, tone, t));
  G.col = {pool:mixInt(gr, ink, .075), grain:L(.34), grainB:L(.42), fine:L(.26), ripple:L(.32), coarse:L(.36), stone:L(.46), stoneS:mixInt(gr, 0, .6), fineS:mixInt(gr, 0, .55), rippleS:mixInt(gr, 0, .6), coarseS:mixInt(gr, 0, .6), print:mixInt(gr, bone, .78), heap:mixInt(gr, bone, .45), shade:mixInt(gr, 0, .86), moundFill:mixInt(gr, 0, .1), rim:mixInt(gr, bone, .6), dust:mixInt(gr, bone, .75)};
  G.poolStops[0].setAttribute('stop-color', hex(G.col.pool)); G.poolStops[0].setAttribute('stop-opacity', '.95'); G.poolStops[1].setAttribute('stop-color', hex(G.col.pool)); G.poolStops[1].setAttribute('stop-opacity', '0');
  for(const k of ['grain', 'grainB', 'fine', 'ripple', 'coarse', 'stone']){ G.cls[k].path.setAttribute('stroke', G.col[k]); if(G.cls[k].pathS) G.cls[k].pathS.setAttribute('stroke', G.col[k + 'S']); }
  G.mound.fill.setAttribute('fill', hex(G.col.moundFill)); G.mound.shade.setAttribute('fill', hex(G.col.shade)); G.mound.shade.setAttribute('fill-opacity', '.55'); G.mound.lines.setAttribute('stroke', L(.34)); G.mound.ghost.setAttribute('stroke', hex(mixInt(gr, bone, .3))); G.mound.rim.setAttribute('stroke', hex(G.col.rim)); G.mound.dots.setAttribute('stroke', L(.7));
  G.air.a.setAttribute('stroke', hex(G.col.dust)); G.air.b.setAttribute('stroke', hex(G.col.dust));
  for(const k in G.sh){ const s = G.sh[k]; s.setAttribute('stroke', hex(G.col.shade)); if(s.dataset.fill === '1') s.setAttribute('fill', hex(G.col.shade)); }
  G.shadeDirty = true;
}
const proto = {
  colour(C){ colour(this, C); },
  /* the weights of the three ripple scales from the grain parameter (-1 fine ... +1 coarse) */
  scaleWeights(){ const g = clamp(this.params.grain, -1, 1); return {grain:clamp(.85 - .45 * g, .1, 1), fine:clamp(.18 - .9 * g, 0, 1), ripple:clamp(1 - .55 * Math.abs(g), .3, 1), coarse:clamp(.34 + .75 * g, 0, 1), stone:clamp(.8 + .2 * g, .3, 1)}; },
  /* the world's step: the creature travelled `dx` along its own sideways axis (page units, signed; + is towards the page's right) and the ground turned `dphi` (+ is clockwise on the page) */
  step(dx, dphi){
    // the world point under the centre moves along the creature's sideways axis, expressed in the world: R(-phi) (dx, 0)
    this.phi += dphi; const [sx, sy] = rot(dx, 0, -this.phi); this.cwX += sx; this.cwY += sy; this.stepDirty = true;
  },
  /* where the creature is in the world, and where it faces (a clockwise angle on a y-down page, so 0 is towards +x): a crew host reads it to place the body in a shared world, and sets it with place() */
  pose(){ return {x:this.cwX, y:this.cwY, h:-this.phi}; },
  place(x, y, h = 0){ this.cwX = x; this.cwY = y; this.phi = -h; this.pin.length = 0; this.sw.length = 0; this.last.length = 0; this.fade = 0; this.turned = false; this.om = 0; this.stepDirty = true; },
  /* screen -> world (absolute) and back */
  toWorld(sx, sy){ const [x, y] = rot(sx - this.PIV[0], sy - this.PIV[1], -this.phi); return [this.cwX + x, this.cwY + y]; },
  toScreen(wx, wy){ const [x, y] = rot(wx - this.cwX, wy - this.cwY, this.phi); return [this.PIV[0] + x, this.PIV[1] + y]; },
  /* the light, in screen coordinates: fixed in the world, so it turns with the ground. Returns the shadow's offset of a point z units above the ground. */
  shadowOff(z){ const [x, y] = rot(Math.cos(this.light), Math.sin(this.light), this.phi); return [-x * z * this.lightK, -y * z * this.lightK]; },
  /* ---- the world and the feet, once a frame (call it from the creature's `idle` hook, after the gait engine has asked for the feet) ----
     o: now, dt (ms); mirror (the rig is drawn mirrored about x = PIV[0]: the creature walks to ITS left); steer (-1 turn left .. 1 turn right, carried only while the legs are stepping);
        legs (how many walking legs, the first `lead` of them being the leading side); trailing(k) true for the legs that push; omega (rad/s the ground turns at a full steer, default .8).
     It moves the world by the crab's travel, turns it by the steer, and pins every stance foot to its point of the world: the foot's request (c.Q.legs[k]) is rewritten, so the engine's feet ride the
     ground exactly (a foot is asked for exactly while it turns: the engine's own spring would let it lag by a few hundredths of a second). With no steer it changes nothing the engine asked for.
     A foot that lands plants a print, a foot that lifts may throw a few grains. Returns {om, running}. */
  update(c, o){
    const now = o.now, dt = o.dt, m = o.mirror ? -1 : 1, gs = c.gs, gait = c.gait, running = !!(gait && gs.on && now - gait.t < 80), kk = running ? gs.k : 0, [CX, CY] = this.PIV, nL = o.legs ?? 8, OM = o.omega ?? .8;
    if(gs.on) this.wasOn = true; else if(this.wasOn){ this.wasOn = false; if(o.onStop) o.onStop(); }
    const want = clamp(o.steer ?? 0, -1, 1); this.om += (want * kk - this.om) * (1 - Math.exp(-dt / 260));
    const dphi = -this.om * OM * dt / 1000, omE = m * -this.om * OM, dOm = m * dphi, gv = running ? c.gv : 0;   // the ground turns clockwise on the page when the creature turns left
    this.step(m * gv * dt / 1000, dphi);
    if(!running){
      /* the hand-off at the end of a gait: the feet were asked for exactly (and rotated by the turn); the engine now asks for the posture's places, which can be a few units off. Blend from where each foot was to
         the engine's request over a third of a second, still exactly, so nothing snaps. */
      for(let k = 0; k < nL; k++){ this.pin[k] = null; this.sw[k] = null; }
      if(this.fade > 0 && this.last.length){ this.fade = Math.max(0, this.fade - dt / 340); const u = 1 - this.fade, e = u * u * (3 - 2 * u);
        for(let k = 0; k < nL; k++){ const rq = c.Q.legs[k], L = this.last[k]; if(!rq || !L) continue; rq.x = L.x + (rq.x - L.x) * e; rq.y = L.y + (rq.y - L.y) * e; rq.b = L.b + wrap(rq.b - L.b) * e; rq.sw = L.sw + (rq.sw - L.sw) * e; rq.direct = true; c.leg[k].dw = 1; }   // (the swing weight too: a leg pad's flex acts only in swing, and a posture asks for it whole)
        if(this.fade <= 0){ this.last.length = 0; this.turned = false; } }
      return {om:this.om, running}; }
    const turning = Math.abs(this.om) > .004, Tst = gait.duty / (gait.cad * 1000), beta = -omE * Tst / 2;   // a foot lands ahead of where the turn will carry it, so that it passes its own place mid-stance
    if(turning) this.turned = true; this.fade = this.turned ? 1 : 0;
    const page = (x, y) => m < 0 ? [2 * CX - x, y] : [x, y];
    for(let k = 0; k < nL; k++){
      const rq = c.Q.legs[k]; if(!rq) continue; if(turning){ rq.direct = true; c.leg[k].dw = Math.min(1, c.leg[k].dw + .09); }   // exact feet, brought in over a few frames so that the first one does not jump
      let P = this.pin[k];
      if(gait.stance[k]){
        if(!P){ let x = rq.x, y = rq.y, b = rq.b; if(this.sw[k]){ const [rx, ry] = rot(x - CX, y - CY, beta); x = CX + rx; y = CY + ry; b += beta; } P = this.pin[k] = {x, y, b}; this.sw[k] = null;
          const [px, py] = page(P.x, P.y), vx = -gv + omE * -(P.y - CY), vy = omE * (P.x - CX), sp = Math.hypot(vx, vy), ux = sp > 8 ? vx / sp : -1, uy = sp > 8 ? vy / sp : 0, trail = o.trailing ? o.trailing(k) : false, mag = clamp((.4 + sp / 300) * (trail ? 1 : .62), .25, 1);
          this.stamp(px, py, m < 0 ? Math.PI - P.b : P.b, m < 0 ? -ux : ux, uy, mag, now, {skid:trail ? sp / 38 : sp / 70}); }
        else { const [rx, ry] = rot(P.x - CX, P.y - CY, dOm); P.x = CX + rx - gv * dt / 1000; P.y = CY + ry; P.b += dOm; }
        rq.x = P.x; rq.y = P.y; rq.b = P.b;
      } else {
        if(P){ this.sw[k] = {dx:P.x - rq.x, dy:P.y - rq.y, db:wrap(P.b - rq.b)};
          const [px, py] = page(P.x, P.y), vx = -gv + omE * -(P.y - CY), vy = omE * (P.x - CX), sp = Math.hypot(vx, vy), trail = o.trailing ? o.trailing(k) : false, n = (trail ? 1.4 : .6) * clamp(sp / 200, 0, 1.6);
          if(n > .3){ const ux = sp ? vx / sp : -1, uy = sp ? vy / sp : 0; this.throwGrains(px, py, (m < 0 ? -ux : ux) * 38, uy * 38, 70, Math.round(n * 3), now, {sx:30, sy:30, life:420}); }
          this.pin[k] = null; }
        const S = this.sw[k], s = gs.legs[k].p, e = s * s * (3 - 2 * s); let x = rq.x, y = rq.y, b = rq.b;
        if(S){ x += S.dx * (1 - e); y += S.dy * (1 - e); b += S.db * (1 - e); }
        if(Math.abs(beta) > 1e-5){ const [rx, ry] = rot(x - CX, y - CY, beta * e); x = CX + rx; y = CY + ry; b += beta * e; }
        rq.x = x; rq.y = y; rq.b = b;
      }
      this.last[k] = {x:rq.x, y:rq.y, b:rq.b, sw:rq.sw};
    }
    return {om:this.om, running};
  },
  /* a footprint planted at screen point (sx, sy), the dactyl pointing `ang`, pushing the sand towards (hx, hy) (a unit vector, screen): mag 0..1 */
  stamp(sx, sy, ang, hx, hy, mag, now, o = {}){
    const [wx, wy] = this.toWorld(sx, sy), P = this.prints[this.pi = (this.pi + 1) % this.prints.length], life = (o.life ?? 9000) * this.params.persist;
    // the dactyl's slit, two crescents either side of it, the heap behind (on the side the foot pushes the sand towards), a scratch if it skidded
    const a = ang - this.phi, ca = Math.cos(a), sa = Math.sin(a), rx = 9.5 + 3 * mag, ry = 3.6 + 1.1 * mag;
    const poly = Array.from({length:10}, (_, i) => { const t = i * 2 * Math.PI / 10, x = rx * Math.cos(t), y = ry * Math.sin(t); return [wx + ca * x - sa * y, wy + sa * x + ca * y]; });
    const [lhx, lhy] = rot(hx, hy, -this.phi), hl = Math.hypot(lhx, lhy) || 1, ux = lhx / hl, uy = lhy / hl, px = -uy, py = ux, off = 8 + 5 * mag;
    const hc = [wx + ux * off, wy + uy * off], w = 7 + 6 * mag;
    let d = 'M' + poly.map(p => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'Z';
    d += 'M' + r1(hc[0] - px * w) + ' ' + r1(hc[1] - py * w) + 'Q' + r1(hc[0] + ux * (3 + 5 * mag)) + ' ' + r1(hc[1] + uy * (3 + 5 * mag)) + ' ' + r1(hc[0] + px * w) + ' ' + r1(hc[1] + py * w);
    if(o.skid){ const l = o.skid; d += 'M' + r1(wx + ux * 3) + ' ' + r1(wy + uy * 3) + 'l' + r1(ux * l) + ' ' + r1(uy * l); }
    if(mag > .55) d += 'M' + r1(hc[0] + ux * 8 - px * w * .6) + ' ' + r1(hc[1] + uy * 8 - py * w * .6) + 'Q' + r1(hc[0] + ux * 11) + ' ' + r1(hc[1] + uy * 11) + ' ' + r1(hc[0] + ux * 8 + px * w * .6) + ' ' + r1(hc[1] + uy * 8 + py * w * .6);
    P.e.setAttribute('d', d); P.e.setAttribute('stroke', hex(this.col.print)); P.t0 = now; P.life = life; P.str = .55 + .45 * mag; P.q = -1; P.e.style.display = ''; return P;
  },
  /* grains thrown into the air: screen frame. (x, y) start, (vx, vy) page velocity, vz up, z start; they fall back and are gone when they land (or `land` is called with them) */
  throwGrains(x, y, vx, vy, vz, n, now, o = {}){
    const amt = this.params.thrown; n = Math.round(n * amt); const P = this.par;
    for(let i = 0; i < n && P.length < this.parMax; i++){ const j = this.rand ? this.rand() : Math.random(); P.push({x, y, vx:vx * (.7 + .6 * Math.random()) + (Math.random() - .5) * (o.sx ?? 24), vy:vy * (.7 + .6 * Math.random()) + (Math.random() - .5) * (o.sy ?? 24), z:o.z ?? 4, vz:vz * (.6 + .8 * Math.random()), t:0, life:o.life ?? 700, big:Math.random() < .3, land:o.land || null}); }
  },
  tick(dt, now){
    // the grains: simple ballistics (z is height, drawn as a size and an offset of the grain from its ground point); a grain that lands is dropped
    const P = this.par; if(P.length || this.airDrawn){
      let da = '', db = '';
      for(let i = P.length - 1; i >= 0; i--){ const q = P[i]; q.t += dt; q.vz -= 900 * dt / 1000; q.z += q.vz * dt / 1000; q.x += q.vx * dt / 1000; q.y += q.vy * dt / 1000; q.vx *= 1 - .8 * dt / 1000; q.vy *= 1 - .8 * dt / 1000;
        if((q.z <= 0 && q.vz < 0) || q.t > q.life){ P.splice(i, 1); continue; }
        const s = 'M' + r1(q.x) + ' ' + r1(q.y - q.z * .5) + 'h.1'; if(q.big) db += s; else da += s; }
      this.air.a.setAttribute('d', da); this.air.b.setAttribute('d', db); this.air.a.setAttribute('stroke-width', 3.4); this.air.b.setAttribute('stroke-width', 5.2); this.airDrawn = !!(da || db);
    }
    // the prints fade (their opacity is set only when it changes by a step)
    if(now - this.lastFade > 90 || this.lastFade === undefined){ this.lastFade = now;
      for(const p of this.prints){ if(p.t0 < -1e8) continue; const age = (now - p.t0) / p.life, o = age >= 1 ? 0 : (1 - age) * (1 - age) * p.str, q = Math.round(o * 14); if(q !== p.q){ p.q = q; if(q <= 0){ p.e.style.display = 'none'; p.t0 = -1e9; } else p.e.setAttribute('opacity', (q / 14).toFixed(2)); } } }
  },
  /* the world, drawn: one transform per class group, and the print group; the scale weights set the layers' opacity */
  draw(){
    if(this.stepDirty || this.paramsDirty || this.drawn.phi === undefined){
      const deg = this.phi * 180 / Math.PI, px = this.PIV[0], py = this.PIV[1];
      for(const k in this.cls){ const K = this.cls[k], nx = Math.round(this.cwX / K.T), ny = Math.round(this.cwY / K.T), ox = this.cwX - nx * K.T, oy = this.cwY - ny * K.T;
        K.grp.setAttribute('transform', 'translate(' + r1(px) + ' ' + r1(py) + ') rotate(' + deg.toFixed(2) + ') translate(' + r1(-ox) + ' ' + r1(-oy) + ')'); }
      if(!this.crew) this.printsG.setAttribute('transform', 'translate(' + r1(px) + ' ' + r1(py) + ') rotate(' + deg.toFixed(2) + ') translate(' + r1(-this.cwX) + ' ' + r1(-this.cwY) + ')');
      this.drawn.phi = this.phi; this.stepDirty = false;
    }
    if(this.paramsDirty || this.drawn.w === undefined){ const w = this.scaleWeights(); for(const k of ['grain', 'fine', 'ripple', 'coarse', 'stone']) this.cls[k].grp.setAttribute('opacity', w[k].toFixed(2)); this.cls.grainB.grp.setAttribute('opacity', (w.grain * .9).toFixed(2)); this.drawn.w = 1; this.paramsDirty = false; }
  },
  setParams(p){ for(const k in p) if(p[k] !== undefined && Math.abs((this.params[k] ?? 1e9) - p[k]) > .004){ this.params[k] = p[k]; this.paramsDirty = true; } },
  /* a shadow element by key: a filled polygon (fill:true) or a thick round stroked line; `d` its path; the element is made on first use */
  shadow(key, d, o = {}){
    let e = this.sh[key]; if(!e){ e = this.sh[key] = mk('path', {fill:o.fill ? hex(this.col.shade) : 'none', stroke:hex(this.col.shade), 'stroke-linecap':'round', 'stroke-linejoin':'round', opacity:o.opacity ?? .5}); e.dataset.fill = o.fill ? '1' : '0'; if(o.w) e.setAttribute('stroke-width', o.w); this.shadeG.append(e); }
    if(e.__d !== d){ e.__d = d; e.setAttribute('d', d); }
  },
  /* the heap over a buried body: `fill` an evenodd path (the heap's outline), `lines` the contours, `rim` its crest, `dots` the grains on it */
  heap(fill, lines, rim, dots, ghost = '', shade = ''){ const M = this.mound; M.shade.setAttribute('d', shade); M.fill.setAttribute('d', fill); this.clipP.setAttribute('d', fill); M.lines.setAttribute('d', lines); M.ghost.setAttribute('d', ghost); M.rim.setAttribute('d', rim); M.dots.setAttribute('d', dots); M.lines.setAttribute('stroke-width', 2.1); M.ghost.setAttribute('stroke-width', 2.2); M.rim.setAttribute('stroke-width', 3.2); M.dots.setAttribute('stroke-width', 3); },
  clear(){ this.heap('', '', '', ''); if(this.sh.heap){ this.sh.heap.setAttribute('d', ''); this.sh.heap.__d = ''; } this.pin.length = 0; this.last.length = 0; this.fade = 0; this.turned = false; this.sw.length = 0; this.om = 0; this.wasOn = false; for(const p of this.prints){ p.t0 = -1e9; p.q = 0; p.e.style.display = 'none'; } this.par.length = 0; this.cwX = this.cwY = 0; this.phi = 0; this.stepDirty = true; this.pi = 0; },
};
const VERSION = '1.1.0', CHANGELOG = [{date:'2026-10-20', version:'1.1.0', what:'For a crew (creature-crew.js): make() leaves the ground on the creature as c.ground, and pose() / place(x, y, h) read and set where the body is in the world and which way it faces, so a host can put several creatures in one shared world. In a crew the sand is hidden and the prints are laid in the crew\'s habitat in world coordinates; the mark generators are exported (dotsMarks, rippleMarks, stoneMarks) for crew.sand.'},
  {date:'2026-10-17', version:'1.0.0', what:'First version, for the crab (round 4): a world-fixed ground under a camera that follows the creature; world sand (grain, ripples in three scales, stones), persistent prints, shadows along a light fixed in the world, a heap over a buried body, grains in the air; update() rewrites each stance foot\'s request so it keeps its world point through a turn.'}];
window.CreatureGround = {make, rot, hex, mixInt, rng, clamp, dotsMarks, rippleMarks, stoneMarks, VERSION, CHANGELOG};
})();
