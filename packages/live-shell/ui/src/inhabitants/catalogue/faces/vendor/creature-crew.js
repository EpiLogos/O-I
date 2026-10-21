/* creature-crew.js — CreatureCrew: several full creatures in one shared world. CREATURE-SPEC.md Part II (sections 19 to 28): a Count of Crew is not a bigger creature, it is several of them, each a whole body,
   doing one thing between them. A pattern (scout, recruit, quorum, trail, relay ...) is a crew preset and the creature is its face; this file is the pane the crew stands in.

   WHAT IT IS. A pane with three layers: the HABITAT under the bodies (one world, fixed, one camera), the MEMBERS (each a complete kit creature, mounted with K.mount(def, el, {crew}), with every
   muscle, gait and action it has on its own page), and the HABITAT over them. The bodies are not drawn into the world; each member's <svg> is a rigid sheet laid on the pane (translate, rotate, scale),
   so nothing about a body changes when it joins a crew. What does change is who owns the ground: a member that walks keeps its own ground (creature-ground.js) as its record of where it is and which way
   it faces, in WORLD coordinates, and the host reads that and places the sheet. The world a creature used to draw round itself (the comb, the sand) is drawn once, by the member the scene names as the
   owner, into the habitat; the marks a member leaves (a dance's track, a scent, a stored cell) go into the habitat too, in world coordinates, under the one camera.

   THE CONTRACT A CREATURE KEEPS TO BE A MEMBER (see CREW-NOTES.md):
   - it reads c.crew (null on its own page; every line it adds for a crew is behind that test, so its own page is unchanged);
   - its world group goes into c.crew.habitat.under (or .over), in world coordinates, with no transform of its own; its static world is built only if c.crew.owner;
   - a walking body keeps its ground (c.ground, creature-ground.js 1.1.0): pose() and place(x, y, h) are how the host reads and sets it. A body that flies (a profile figure) is placed by the host from m.fl.

   THE MEMBER (m). m.c the kit creature; m.pose(); m.place(x, y, h); m.goto(x, y, {r}) walks there (it steers with the steer pad and picks the gait by distance) and returns a condition; m.face(h); m.stop();
   m.do(action, args) plays an action and returns a condition that is true when it has ended; m.go(posture) the same for a posture; m.flyTo(x, y, {speed, hover}) for a flier; m.say(text) a caption.
   THE RUN. crew.run(name, function*(run){ ... }) is a pattern as a generator: every yield is a condition (a function that returns true when it is met, an array of them for "all", crew.wait(ms), m.goto(...),
   m.do(...)). Time is the crew's own clock (crew.t), so a pattern runs the same on the virtual clock the gates drive (crew.advance) as on a screen.
   Exports window.CreatureCrew. */
(() => {
'use strict';
const K = window.CreatureKit; K.require('1.3.0', 'creature-crew');
const VERSION = '1.0.0', CHANGELOG = [{date:'2026-10-20', version:'1.0.0', what:'First: the pane (habitat under, members, habitat over, one camera), members as full kit creatures placed by their ground (a walker) or by the host (a flier), goto / do / go / flyTo conditions, the generator runner, the page.'}];
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const wrapA = a => { while(a > Math.PI) a -= 2 * Math.PI; while(a < -Math.PI) a += 2 * Math.PI; return a; };
const sm = (dt, k) => 1 - Math.exp(-dt / k);
const mkS = (tag, a = {}) => { const e = document.createElementNS(NS, tag); for(const k in a) e.setAttribute(k, a[k]); return e; };
const RUN_STATES = ['queued', 'thinking', 'acting', 'waiting', 'stalled', 'producing', 'done', 'failed'];

const CSS = `
.cw-pane{position:relative;width:100%;height:100%;min-height:0;overflow:hidden;touch-action:none;user-select:none}
.cw-pane>svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none}
.cw-stage{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.cw-m{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;pointer-events:none}
.cw-m>svg{display:block;overflow:visible}
.cw-cap{position:absolute;left:0;top:0;transform:translate(-50%,-100%);padding:3px 7px;border:1px solid var(--line-strong,#2a2f3a);background:rgba(8,10,14,.82);color:var(--platinum,#cfd3da);font:9px/1.3 var(--mono,monospace);letter-spacing:.04em;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .25s}
.cw-cap.on{opacity:1}
.cw-hit{pointer-events:auto;cursor:pointer}
`;
let cssDone = false;
const ensureCss = () => { if(cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };

/* ---------- conditions: a function that is true when it is met; arrays are "all of" ---------- */
const cond = v => typeof v === 'function' ? v : Array.isArray(v) ? (() => { const L = v.map(cond); return () => L.every(f => f()); })() : (typeof v === 'number' ? null : () => true);
const any = (...L) => { const F = L.map(cond); return () => F.some(f => f()); };
const all = (...L) => { const F = L.map(cond); return () => F.every(f => f()); };

function make(el, o = {}){
  ensureCss();
  el.innerHTML = '';
  const pane = document.createElement('div'); pane.className = 'cw-pane'; el.appendChild(pane);
  const under = mkS('svg', {class:'cw-under'}), stage = document.createElement('div'), over = mkS('svg', {class:'cw-over'}), cap = document.createElement('div');
  stage.className = 'cw-stage'; cap.className = 'cw-cap';
  const gU = mkS('g', {class:'cw-cam'}), gO = mkS('g', {class:'cw-cam'}); under.appendChild(gU); over.appendChild(gO);
  pane.append(under, stage, over, cap);
  const crew = {el, pane, stage, VERSION, members:[], t:0, W:1000, H:600, cam:{x:0, y:0, s:.5}, camT:{x:0, y:0, s:.5}, camFollow:null, view:o.view || null, paused:false, run:null, runs:[], sel:null, speed:1, onSelect:null, onRun:null,
    habitat:{under:gU, over:gO, root:pane}, captions:new Map()};
  /* ---------- the camera: the world point at the middle of the pane and a scale (px per world unit) ---------- */
  const fitPane = () => { const r = pane.getBoundingClientRect(); crew.W = r.width || 1000; crew.H = r.height || 600; crew.paneDirty = true; };
  crew.fit = fitPane; fitPane();
  if(window.ResizeObserver) new ResizeObserver(fitPane).observe(pane);
  crew.setView = (v, snap = true) => { crew.view = v; crew.camFollow = null; if(snap) crew.snapCam(); };           // v: {x, y, w, h} the world rectangle the pane should show
  crew.viewCam = () => { const v = crew.view; if(!v) return crew.camT; return {x:v.x + v.w / 2, y:v.y + v.h / 2, s:Math.min(crew.W / v.w, crew.H / v.h)}; };
  crew.snapCam = () => { const t = crew.camFollow ? crew.camFollow() : crew.viewCam(); Object.assign(crew.cam, t); Object.assign(crew.camT, t); crew.paneDirty = true; crew.drawCam(); };
  crew.follow = fn => { crew.camFollow = fn; };                                                                       // fn() returns {x, y, s}; null goes back to the view
  crew.centroid = (list = crew.members, s) => { let x = 0, y = 0, n = 0; for(const m of list){ const p = m.pose(); x += p.x; y += p.y; n++; } return n ? {x:x / n, y:y / n, s:s ?? crew.cam.s} : {x:crew.cam.x, y:crew.cam.y, s:crew.cam.s}; };
  crew.drawCam = () => {
    const c = crew.cam, tr = `translate(${(crew.W / 2).toFixed(2)} ${(crew.H / 2).toFixed(2)}) scale(${c.s.toFixed(5)}) translate(${(-c.x).toFixed(2)} ${(-c.y).toFixed(2)})`;
    if(tr !== crew.trDrawn){ crew.trDrawn = tr; gU.setAttribute('transform', tr); gO.setAttribute('transform', tr); }
    crew.toPane = (x, y) => [(x - c.x) * c.s + crew.W / 2, (y - c.y) * c.s + crew.H / 2];
    crew.toWorld = (px, py) => [(px - crew.W / 2) / c.s + c.x, (py - crew.H / 2) / c.s + c.y];
  };
  crew.drawCam();

  /* ---------- members ---------- */
  const sortZ = () => { const lo = Math.min(0, ...crew.members.map(m => m.z)); for(const m of crew.members) m.wrap.style.zIndex = String(Math.round(m.z - lo)); };   // a negative z only orders members; it never sinks one under the habitat
  crew.remove = m => { const i = crew.members.indexOf(m); if(i < 0) return; crew.members.splice(i, 1); m.c.destroy(); m.wrap.remove(); };
  crew.clear = () => { crew.cancel(); for(const m of crew.members.slice()) crew.remove(m); gU.textContent = ''; gO.textContent = ''; crew.t = 0; };

  /* ---------- the member's verbs ---------- */
  const proto = {
    pose(){ const c = this.c; if(this.kind === 'walk' && c.ground) return c.ground.pose(); return {x:this.fl.x, y:this.fl.y, h:this.fl.face > 0 ? -this.fl.pitch : Math.PI + this.fl.pitch}; },
    place(x, y, h = 0){ const c = this.c; this.fl.x = x; this.fl.y = y; this.fl.vx = this.fl.vy = 0; this.fl.face = Math.cos(h) >= 0 ? 1 : -1; this.fl.pitch = 0; if(this.kind === 'walk' && c.ground){ c.ground.place(x, y, h); } this.sync(); },
    dist(x, y){ const p = this.pose(); return Math.hypot(x - p.x, y - p.y); },
    /* walk to a world point; a condition (true when within r of it and the body has stopped) */
    goto(x, y, o = {}){ this.target = [x, y]; this.tolR = o.r ?? 40; this.arrived = false; this.goalH = o.h ?? null; this.gotoSpeed = o.gait || null; return () => this.arrived; },
    face(h, o = {}){ this.target = null; this.goalH = h; this.tolH = o.tol ?? .12; this.arrived = false; return () => this.arrived; },
    stop(){ this.target = null; this.goalH = null; this.arrived = true; this.steer = 0; if(this.kind === 'walk') settleSteer(this); },
    /* an action, and a condition for its end; args as c.play takes them */
    do(name, args){ const c = this.c, t0 = c.t; c.play(name, args); let seen = false; return () => { const on = c.actions.some(a => a.name === name); if(on) seen = true; return seen ? !on : c.t - t0 > 400; }; },
    go(posture, o){ const c = this.c; c.go(posture, o); return () => { const p = c.pm; return p.node === posture && !p.moving && !p.route.length; }; },
    flyTo(x, y, o = {}){ const f = this.fl; f.tx = x; f.ty = y; f.tolF = o.r ?? 30; f.speed = o.speed ?? f.speed; f.hoverAt = o.hover ?? 0; this.flying = true; return () => !this.flying; },
    /* keep facing a member (or a world point [x, y]) while standing: it turns on the spot when it is more than tol off, and stops when it is within a third of that; null stops */
    watch(who, o = {}){ this.watching = who; this.watchTol = o.tol ?? .35; this.turning = false; },
    allow(...others){ this.allowed = this.allowed || new Set(); for(const o of others) this.allowed.add(o); return this; },
    clearAllowed(){ this.allowed = null; return this; },
    sayFor(text, ms = 2600){ this.say = text; this.sayUntil = crew.t + ms; },
    action(){ const c = this.c; const a = c.actions.filter(x => !x.cut && !(c.d.actions[x.name] && c.d.actions[x.name].tiny)).map(x => x.name); return a.length ? a[a.length - 1] : (c.gait && c.gs.on ? c.gait.name : c.pm.node); },
    /* the sheet: place the body's <svg> on the pane. A walker is turned by its heading; a flier faces left or right and pitches. */
    sync(){
      const c = this.c, d = this.d, cm = d.cam0, cs = cm[0], q = c.size / (d.W * cs), vx = cm[1] - d.W / 2 * cs, vy = cm[2] - d.H / 2 * cs, pc = [(d.pivot[0] - vx) * q, (d.pivot[1] - vy) * q];
      const p = this.pose(), P = crew.toPane(p.x, p.y), K_ = crew.cam.s * this.k;
      let tr;
      if(this.kind === 'walk') tr = `translate(${P[0].toFixed(2)}px,${P[1].toFixed(2)}px) rotate(${(p.h * 180 / Math.PI).toFixed(3)}deg) scale(${K_.toFixed(5)}) translate(${(-pc[0]).toFixed(2)}px,${(-pc[1]).toFixed(2)}px)`;
      else tr = `translate(${P[0].toFixed(2)}px,${P[1].toFixed(2)}px) scale(${(this.fl.face * K_).toFixed(5)},${K_.toFixed(5)}) rotate(${(-this.fl.pitch * 180 / Math.PI).toFixed(3)}deg) translate(${(-pc[0]).toFixed(2)}px,${(-pc[1]).toFixed(2)}px)`;
      if(tr !== this.trDrawn){ this.trDrawn = tr; this.wrap.style.transform = tr; }
    },
  };
  const steerPad = (m, v) => { const p = m.c.pad.steer; if(!p) return; p.L[0] = v; p.R[0] = v; };
  const settleSteer = m => steerPad(m, 0);
  const startGait = (c, name) => { const pm = c.pm; if(pm.node !== 'stand' || pm.moving) return; if(c.gait && c.gait.name === name) return; if(c.d.GAIT_PSI && c.d.GAIT_PSI[name] === undefined) return; c.go(name); };

  /* what the host does for a member once it has moved: steer a walker towards its goal, move a flier, place the sheet */
  function afterStep(m, c, now, dt){
    if(!m.proto) return;   // (still being built)
    const dts = Math.min(dt, 80) / 1000;
    if(m.kind === 'walk' && c.ground){
      const p = c.ground.pose();
      if(m.target){
        const dx = m.target[0] - p.x, dy = m.target[1] - p.y, dist = Math.hypot(dx, dy);
        /* keep clear of the others: each walker within the two radii's reach pushes the heading away from it, more the closer it is (a member the walker may touch is in m.allowed) */
        let ax = dist > 1 ? dx / dist : 0, ay = dist > 1 ? dy / dist : 0;
        for(const o of crew.members){ if(o === m || o.kind !== 'walk' || (m.allowed && m.allowed.has(o)) || (o.allowed && o.allowed.has(m))) continue; const q = o.pose(), ox = p.x - q.x, oy = p.y - q.y, od = Math.hypot(ox, oy), R = (m.r + o.r) * 1.25;
          if(od < R && od > 1){ const w = Math.pow(1 - od / R, 1.5) * 2.4; ax += ox / od * w; ay += oy / od * w; } }
        const err = wrapA(Math.atan2(ay, ax) - p.h);
        if(dist < m.tolR){ m.target = null; steerPad(m, 0); if(c.gait) c.go('stand'); m.arrived = !c.gait && !c.pm.moving && c.pm.node === 'stand'; if(!m.arrived && m.goalH === null) m.pendingStop = true; }
        else { m.arrived = false; steerPad(m, clamp(2.2 * err, -1, 1)); if(Math.abs(err) > .8) startGait(c, m.gaits.turn); else startGait(c, m.gotoSpeed || (dist > 700 ? m.gaits.fast : dist > 160 ? m.gaits.far : m.gaits.near)); }
      } else if(m.goalH !== null){
        const err = wrapA(m.goalH - p.h);
        if(Math.abs(err) < (m.tolH ?? .12)){ steerPad(m, 0); if(c.gait) c.go('stand'); if(!c.gait && !c.pm.moving){ m.goalH = null; m.arrived = true; } }
        else { steerPad(m, clamp(2.4 * err, -1, 1)); startGait(c, m.gaits.turn); }
      } else if(m.watching){
        const w = m.watching, q = Array.isArray(w) ? {x:w[0], y:w[1]} : w.pose(), err = wrapA(Math.atan2(q.y - p.y, q.x - p.x) - p.h);
        if(m.turning){ if(Math.abs(err) < m.watchTol / 3) m.turning = false; } else if(Math.abs(err) > m.watchTol) m.turning = true;
        if(m.turning){ steerPad(m, clamp(2.4 * err, -1, 1)); startGait(c, m.gaits.turn); } else { steerPad(m, 0); if(c.gait && c.gait.name === m.gaits.turn) c.go('stand'); }
      } else if(m.pendingStop || !m.arrived){ if(c.gait) c.go('stand'); if(!c.gait && !c.pm.moving){ m.arrived = true; m.pendingStop = false; } steerPad(m, 0); }
    } else if(m.kind === 'fly'){
      const f = m.fl;
      if(f.tx !== null && m.flying){
        const dx = f.tx - f.x, dy = f.ty - f.y, dist = Math.hypot(dx, dy), sp = f.speed * (dist < 200 ? .25 + .75 * dist / 200 : 1) * (f.hoverAt ? 1 : 1);
        const wx = dist > 1 ? dx / dist * sp : 0, wy = dist > 1 ? dy / dist * sp : 0, k = sm(dts * 1000, 380);
        f.vx += (wx - f.vx) * k; f.vy += (wy - f.vy) * k;
        if(dist < f.tolF){ m.flying = false; f.tx = f.ty = null; }
      } else { const k = sm(dts * 1000, 520); f.vx -= f.vx * k; f.vy -= f.vy * k; }
      f.x += f.vx * dts; f.y += f.vy * dts; f.spd = Math.hypot(f.vx, f.vy);
      if(Math.abs(f.vx) > 22) f.face += ((f.vx > 0 ? 1 : -1) - f.face) * (Math.abs(f.face) < 1 ? 1 : 1), f.face = f.vx > 0 ? 1 : -1;
      const pitchT = clamp(Math.atan2(-f.vy, Math.abs(f.vx) + 80) * .55 - .06 * clamp(f.spd / 320), -.9, .9) * clamp(f.spd / 120);
      f.pitch += (pitchT - f.pitch) * sm(dts * 1000, 260);
      f.hover = clamp(1 - f.spd / 140);
    }
    m.sync();
  }
  /* spec: {def, name, role, at:[x, y], h, kind:'walk'|'fly', scale, owner, seed, palette, life (false: none; 'full': moves too; default: the small actions), gaits:{far, near, fast, turn}, z} */
  crew.add = spec => {
    const d = typeof spec.def === 'string' ? K.get(spec.def) : spec.def; if(!d) throw new Error('creature-crew: no creature ' + spec.def);
    // the member object (with its verbs) exists before K.mount, because the kit's first step, inside K.mount, calls afterStep
    const wrap = document.createElement('div'); wrap.className = 'cw-m'; stage.appendChild(wrap);
    const m = Object.create(proto);
    Object.assign(m, {crew, d, def:d.id, name:spec.name || d.name, role:spec.role || '', kind:spec.kind || 'walk', k:spec.scale ?? 1, wrap, owner:!!spec.owner, z:spec.z ?? crew.members.length, spec, r:spec.radius ?? 130, target:null, watching:null, turning:false, tolR:40, goalH:null, say:'', sayUntil:-1, arrived:true, steer:0, flying:false, proto:false,
      gaits:Object.assign({far:'walk', near:'creep', fast:'run', turn:'shuffle'}, spec.gaits || {}),
      fl:{x:0, y:0, vx:0, vy:0, spd:0, face:1, pitch:0, hover:0, tx:null, ty:null, speed:spec.speed ?? 320, alt:0}});
    m.link = {m, crew, owner:m.owner, habitat:crew.habitat, after:(c, now, dt) => afterStep(m, c, now, dt)};
    m.c = K.mount(d, wrap, {size:d.W, life:crew.noLife ? false : spec.life === undefined ? true : spec.life !== false, lifeSmall:spec.life !== 'full', seed:spec.seed ?? 11 + crew.members.length * 7, palette:spec.palette || {}, crew:m.link, lifeRate:spec.lifeRate});
    m.proto = true;
    crew.members.push(m); sortZ();
    const at = spec.at || [0, 0]; m.place(at[0], at[1], spec.h ?? 0);
    return m;
  };

  /* ---------- the ground: a sand that never ends, in the figure's own one ink (grain, three scales of ripple crests, stones, each its own period so the repeat does not show), the same marks creature-ground.js draws
     round a lone creature, here as SVG patterns filling the habitat, so every member and every mark stand on the one ground. o: {C (a palette from a member's c.C; default the first member's), seed, crest (the ripples' direction), rect:[x0, y0, x1, y1]} ---------- */
  crew.sand = (o = {}) => {
    const G = window.CreatureGround; if(!G || !G.rippleMarks) throw new Error('creature-crew: load creature-ground.js 1.1.0 first');
    const C = o.C || (crew.members[0] && crew.members[0].c.C); if(!C) throw new Error('creature-crew: sand() needs a palette (add a member first, or pass o.C)');
    const seed = o.seed ?? 11, crest = o.crest ?? .32, R = o.rect || [-6000, -6000, 6000, 6000], light = o.light ?? -2.3, SH = [Math.cos(light + Math.PI), Math.sin(light + Math.PI)];
    const r1 = v => Math.round(v * 10) / 10, gr = C.skin, ink = C.ink, bone = C.bone, L = (t, tone = ink) => '#' + ('000000' + (G.mixInt(gr, tone, t) >>> 0).toString(16)).slice(-6), Z = t => '#' + ('000000' + (G.mixInt(gr, 0, t) >>> 0).toString(16)).slice(-6);
    const defs = mkS('defs'), g = mkS('g', {class:'cw-sand'}); g.appendChild(defs);
    const rect = (x, y, w, h, fill) => mkS('rect', {x, y, width:w, height:h, fill});
    const cls = [['grain', 300, 2, 0], ['grainB', 300, 3.2, 0], ['fine', 330, 1.2, 2.6], ['ripple', 460, 2.1, 5], ['coarse', 720, 3.2, 8], ['stone', 760, 1.7, 5]];
    const marks = {grain:G.dotsMarks(300, 46, seed + 1).filter(m => !m[2]), grainB:G.dotsMarks(300, 46, seed + 1).filter(m => m[2]), fine:G.rippleMarks(330, 30, 80, crest, seed + 2, 4), ripple:G.rippleMarks(460, 64, 190, crest, seed + 3, 8), coarse:G.rippleMarks(720, 140, 420, crest, seed + 4, 16), stone:G.stoneMarks(760, 13, seed + 5, 6, 22)};
    const crestP = (k, K) => (m, ox, oy) => { const [x, y, a, h, bd] = m, ca = Math.cos(a), sa = Math.sin(a), cx = x + ox + SH[0] * k, cy = y + oy + SH[1] * k, st = 2 * h / K, nx = -sa, ny = ca;
      let d = 'M' + r1(cx - ca * h) + ' ' + r1(cy - sa * h) + 'Q' + r1(cx - ca * h + ca * st / 2 + nx * bd) + ' ' + r1(cy - sa * h + sa * st / 2 + ny * bd) + ' ' + r1(cx - ca * h + ca * st) + ' ' + r1(cy - sa * h + sa * st);
      for(let q = 2; q <= K; q++) d += 'T' + r1(cx - ca * h + ca * st * q) + ' ' + r1(cy - sa * h + sa * st * q); return d; };
    const stoneP = k => (m, ox, oy) => { const [x, y, r, ph, tall] = m, rx = r, ry = r * (.58 + .3 * tall), cx = x + ox + SH[0] * k * r, cy = y + oy + SH[1] * k * r, a = ph * 30;
      return 'M' + r1(cx - rx) + ' ' + r1(cy) + 'a' + r1(rx) + ' ' + r1(ry) + ' ' + r1(a) + ' 1 0 ' + r1(2 * rx) + ' 0a' + r1(rx) + ' ' + r1(ry) + ' ' + r1(a) + ' 1 0 ' + r1(-2 * rx) + ' 0'; };
    const dotP = (m, ox, oy) => 'M' + r1(m[0] + ox) + ' ' + r1(m[1] + oy) + 'h.1';
    const layers = {grain:[[dotP, L(.34), 2]], grainB:[[dotP, L(.42), 3.2]], fine:[[crestP(2, 2), Z(.55), 2.6], [crestP(0, 2), L(.26), 1.2]], ripple:[[crestP(4, 3), Z(.6), 5], [crestP(0, 3), L(.32), 2.1]], coarse:[[crestP(7, 4), Z(.6), 8], [crestP(0, 4), L(.36), 3.2]], stone:[[stoneP(.5), Z(.6), 5], [stoneP(0), L(.46), 1.7]]};
    const weight = {grain:.85, grainB:.77, fine:.18, ripple:1, coarse:.34, stone:.8};
    for(const [name, T] of cls){
      const pat = mkS('pattern', {id:'cwp-' + name + '-' + (++sandN), patternUnits:'userSpaceOnUse', width:T, height:T, x:-T / 2, y:-T / 2});
      for(const [f, stroke, w] of layers[name]){ let d = ''; for(let i = -1; i <= 1; i++) for(let j = -1; j <= 1; j++) for(const m of marks[name]) d += f(m, i * T + T / 2, j * T + T / 2);
        pat.appendChild(mkS('path', {d, fill:'none', stroke, 'stroke-width':w, 'stroke-linecap':'round', 'stroke-linejoin':'round'})); }
      defs.appendChild(pat); const r = rect(R[0], R[1], R[2] - R[0], R[3] - R[1], 'url(#' + pat.id + ')'); r.setAttribute('opacity', weight[name]); g.appendChild(r);
    }
    g.insertBefore(rect(R[0], R[1], R[2] - R[0], R[3] - R[1], L(.075)), defs.nextSibling);
    crew.habitat.under.insertBefore(g, crew.habitat.under.firstChild); return g;
  };
  let sandN = 0;

  /* ---------- time and the run ---------- */
  crew.wait = ms => { const t1 = crew.t + ms; return () => crew.t >= t1; };
  crew.until = f => f;
  /* n places on a ring round (cx, cy), the first at angle a0 (a clockwise angle on the page, 0 towards +x), each facing the middle: [{x, y, h}] */
  crew.ring = (cx, cy, n, r, a0 = 0, face = 1) => Array.from({length:n}, (_, i) => { const a = a0 + i * 2 * Math.PI / n; return {x:cx + r * Math.cos(a), y:cy + r * Math.sin(a), h:wrapA(a + (face > 0 ? Math.PI : 0))}; });
  crew.all = all; crew.any = any;
  crew.sleep = ms => crew.wait(ms);
  crew.set = (list, f) => list.map(f);
  crew.run_ = null;
  /* a pattern: fn(run) is a generator. run.state is one of the eight run states (spec 25); run.set(state) changes it; run.log keeps what happened. */
  crew.start = (name, fn, o = {}) => {
    crew.cancel();
    const run = {name, state:'queued', t0:crew.t, log:[], wait:null, gen:null, error:null, set(s){ if(RUN_STATES.includes(s) && s !== run.state){ run.state = s; run.log.push({t:crew.t, state:s}); if(crew.onRun) crew.onRun(run); } }, note(text){ run.log.push({t:crew.t, note:text}); if(crew.onRun) crew.onRun(run); }, crew};
    try { run.gen = fn(run); } catch(e){ run.error = e; run.ended = true; run.set('failed'); crew.run_ = run; return run; }
    run.set('thinking'); crew.run_ = run; crew.runs.push(run); if(crew.onRun) crew.onRun(run);
    return run;
  };
  crew.cancel = () => { const r = crew.run_; if(r && !r.ended){ r.cancelled = true; r.ended = true; r.set('done'); r.note('cancelled'); try { r.gen && r.gen.return(); } catch(e){} } crew.run_ = null; for(const m of crew.members){ m.stop(); if(m.flying){ m.flying = false; m.fl.tx = m.fl.ty = null; } } };
  const runStep = () => {
    const r = crew.run_; if(!r || !r.gen || r.ended) return;
    if(r.wait && !r.wait()) { r.stallT = r.stallT ?? crew.t; if(crew.t - r.stallT > 45000 && r.state !== 'stalled') r.set('stalled'); return; }
    r.stallT = null; if(r.state === 'stalled') r.set('acting');
    r.wait = null;
    let n = 0;
    while(n++ < 50){
      let res;
      try { res = r.gen.next(); } catch(e){ r.error = e; r.ended = true; r.set('failed'); r.note(String(e && e.message || e)); console.error(e); return; }
      if(res.done){ r.ended = true; r.set(RUN_STATES.includes(res.value) ? res.value : 'done'); return; }   // a generator may end on its true state: return 'stalled' or 'failed'
      if(r.state === 'thinking' || r.state === 'queued') r.set('acting');
      const v = res.value;
      if(typeof v === 'number'){ r.wait = crew.wait(v); return; }
      if(v === undefined || v === null) return;   // one tick
      const f = cond(v); if(f() === true) continue;   // already met: carry on in the same tick
      r.wait = f; return;
    }
  };
  /* ---------- the clock: tick() by the host's rAF; advance(ms) on the virtual clock (gates, shots) ---------- */
  crew.tick = dt => {
    if(crew.paused) return;
    crew.t += dt;
    runStep();
    // the camera
    const tgt = crew.camFollow ? crew.camFollow() : crew.viewCam(), k = sm(dt, crew.camFollow ? 700 : 260);
    if(crew.paneDirty){ crew.paneDirty = false; if(!crew.camFollow){ Object.assign(crew.cam, tgt); } }
    crew.cam.x += (tgt.x - crew.cam.x) * k; crew.cam.y += (tgt.y - crew.cam.y) * k; crew.cam.s += (tgt.s - crew.cam.s) * k;
    crew.drawCam();
    for(const m of crew.members) if(m.kind === 'walk' || m.kind === 'fly'){ if(!m.c.paused) continue; }   // (members paused by a gate are stepped by advance)
    // captions
    for(const m of crew.members){ if(m.say && crew.t > m.sayUntil) m.say = ''; }
    if(crew.tickHook) crew.tickHook(dt);
  };
  let last = 0, raf = 0;
  const loop = now => { raf = requestAnimationFrame(loop); if(document.hidden) return; const dt = Math.min(80, last ? now - last : 16); last = now; if(!crew.virtual) crew.tick(dt * crew.speed); };
  raf = requestAnimationFrame(loop);
  /* the virtual clock: the members and the crew advance together in steps of st ms, deterministically */
  crew.advance = (ms, st = 16) => { crew.virtual = true; for(const m of crew.members) m.c.pause(true); let t = 0; while(t < ms){ t += st; for(const m of crew.members) m.c.advance(st, st); crew.tick(st); } };
  crew.live = () => { crew.virtual = false; for(const m of crew.members) m.c.pause(false); };
  crew.destroy = () => { cancelAnimationFrame(raf); crew.clear(); };
  crew.probe = () => ({t:Math.round(crew.t), members:crew.members.map(m => { const p = m.pose(); return {name:m.name, role:m.role, x:Math.round(p.x), y:Math.round(p.y), h:+p.h.toFixed(2), action:m.action(), cpu:+m.c.cpuAvg.toFixed(2), arrived:m.arrived}; }), run:crew.run_ ? {name:crew.run_.name, state:crew.run_.state} : null, cpu:+crew.members.reduce((s, m) => s + m.c.cpuAvg, 0).toFixed(2)});
  return crew;
}

/* ---------- the page: the pane in the shared shell, with the patterns (crew presets), the members, the run ----------
   CreatureCrew.page({id, title, sign, sub, view:{x, y, w, h}, setup(crew, ui) -> {patterns:[{id, label, note, run:function*(run){}}], params:[...]}, thumbPattern})
   ?thumb=1 draws the pane alone (the library's preview) and runs the first pattern; ?still holds the pattern off; ?pattern=<id> starts one; ?solo turns the members' small life off (for the gates). */
function page(spec){
  const CP = window.CreaturePage; if(!CP) throw new Error('creature-crew: load creature-page.js first');
  const q = new URLSearchParams(location.search), thumb = q.has('thumb');
  document.title = spec.title + (spec.sign ? ' ' + spec.sign : '') + ' · crew';
  const h = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; };
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[ch]);
  let ui, host;
  if(thumb){
    document.body.style.cssText = 'margin:0;background:#0b0d11;overflow:hidden;height:100vh'; host = h('div'); host.style.cssText = 'width:100vw;height:100vh'; document.body.appendChild(host);
  } else { ui = CP.frame({title:spec.title, sign:spec.sign, sub:spec.sub}); host = ui.$('fig'); host.style.padding = '10px'; }
  const crew = make(host, {view:spec.view}); window.CREW = crew;
  crew.noLife = q.has('solo');
  const scene = spec.setup(crew, ui) || {};
  crew.patterns = scene.patterns || [];
  crew.snapCam();
  const startPattern = id => { const P = crew.patterns.find(x => x.id === id); if(!P) return; crew.cancel(); crew.pattern = P; crew.start(P.id, P.run); };
  crew.startPattern = startPattern;
  if(thumb){ if(!q.has('still') && crew.patterns[0]) startPattern(q.get('pattern') || spec.thumbPattern || crew.patterns[0].id); return crew; }
  const {$, card, button} = ui;
  /* the patterns */
  { const a = card('Patterns', 'a pattern is a crew preset: the same bodies, one thing between them'); const row = h('div', 'row'); a.appendChild(row);
    for(const P of crew.patterns){ const b = button(P.label || P.id); b.dataset.pat = P.id; b.title = P.note || ''; b.onclick = () => startPattern(P.id); row.appendChild(b); }
    row.appendChild(h('span', 'gap')); const st = button('Stop', 'ghost-button warn'); st.onclick = () => { crew.cancel(); crew.pattern = null; }; row.appendChild(st);
    const note = h('div', 'hint'); note.id = 'patnote'; a.appendChild(note); }
  /* the run: the eight run states, the one it is in, and what it has done */
  { const a = card('Run', 'the run states of the agency spec (25): where this pattern is'); const row = h('div', 'row'); row.id = 'runstates'; a.appendChild(row);
    for(const s of RUN_STATES){ const c = h('span', 'chip'); c.textContent = s; c.dataset.s = s; row.appendChild(c); }
    const log = h('div', 'hint'); log.id = 'runlog'; log.style.whiteSpace = 'pre-wrap'; a.appendChild(log); }
  /* the members */
  { const a = card('Crew', 'each a whole creature: click one to follow it'); const list = h('div', 'mus-list'); list.id = 'members'; list.style.gridTemplateColumns = 'minmax(0,1fr) minmax(0,1.2fr) 52px'; a.appendChild(list); }
  /* parameters of the scene */
  if(scene.params && scene.params.length){ const a = card('Habitat'); for(const P of scene.params){ const r = h('label', 'range', `<span class="swatch-label">${esc(P.label)}</span><input type="range" min="${P.min}" max="${P.max}" step="${P.step ?? .01}" value="${P.value}"><output>${(+P.value).toFixed(2)}</output>`); r.querySelector('input').oninput = e => { P.apply(+e.target.value); r.querySelector('output').textContent = (+e.target.value).toFixed(2); }; a.appendChild(r); } }
  { const a = card('Time'); const r = h('label', 'range', `<span class="swatch-label">speed</span><input type="range" min=".1" max="3" step=".05" value="1"><output>1.00</output>`); r.querySelector('input').oninput = e => { crew.speed = +e.target.value; for(const m of crew.members){ const p = m.c.pad.dynamics; p.L[0] = p.R[0] = Math.log2(crew.speed); } r.querySelector('output').textContent = (+e.target.value).toFixed(2); }; a.appendChild(r);
    const cam = h('div', 'row'); const f = button('Follow the crew'), v = button('Whole habitat'); f.onclick = () => crew.follow(() => crew.centroid(crew.members, crew.followS ?? crew.cam.s)); v.onclick = () => crew.follow(null); cam.append(f, v); a.appendChild(cam); }
  $('reset').onclick = () => { crew.cancel(); crew.clear(); const sc = spec.setup(crew, ui) || {}; crew.patterns = sc.patterns || crew.patterns; crew.snapCam(); };
  /* the select ring and the live readout */
  crew.select = m => { crew.sel = m; crew.follow(m ? (() => ({...m.pose(), s:crew.cam.s})) : null); };
  setInterval(() => {
    const run = crew.run_, k = crew.probe();
    $('state').textContent = (run ? run.state : 'idle').toUpperCase(); $('state').classList.toggle('live', !!run && !run.ended);
    document.querySelectorAll('#runstates .chip').forEach(c => c.classList.toggle('on', !!run && c.dataset.s === run.state));
    document.querySelectorAll('[data-pat]').forEach(b => b.setAttribute('aria-pressed', !!(run && crew.pattern && crew.pattern.id === b.dataset.pat && !run.ended)));
    $('patnote').textContent = crew.pattern ? (crew.pattern.note || '') : '';
    $('runlog').textContent = run ? run.log.slice(-5).map(e => (e.t / 1000).toFixed(1) + 's ' + (e.state || e.note)).join('\n') : '';
    const list = $('members');
    if(list.childElementCount !== crew.members.length){ list.innerHTML = ''; for(const m of crew.members){ const n = h('div', 'nm'), r = h('div', 'nm'), c = h('div'); n.textContent = m.name; r.textContent = m.role; n.onclick = () => crew.select(crew.sel === m ? null : m); list.append(n, r, c); } }
    crew.members.forEach((m, i) => { const c = list.children[i * 3 + 2], r = list.children[i * 3 + 1]; r.textContent = m.role + (m.role ? ' · ' : '') + m.action(); c.textContent = m.c.cpuAvg.toFixed(1) + ' ms'; list.children[i * 3].style.color = crew.sel === m ? 'var(--accent)' : ''; });
    $('readout').innerHTML = crew.members.length + ' creatures · <b>' + k.cpu.toFixed(1) + ' ms</b> · kit ' + K.VERSION + ' · crew ' + VERSION;
  }, 140);
  if(q.get('pattern')) startPattern(q.get('pattern'));
  return crew;
}
window.CreatureCrew = {make, page, all, any, RUN_STATES, VERSION, CHANGELOG};
})();
