/* crew-ant.js — the ant crew on the sand (CREW-NOTES-ANT.md). A scene for creature-crew.js: whole worker ants, each with every muscle, gait and action it has on its own page, in one world: a nest, a heap of food, a midden,
   a brood chamber, and the trail they lay into the habitat together. The four roster patterns (trail, tend, clear, haul) and the failure of each that can be run (the mill, the painted ant, the deadlock).
   Everything here is the scene's: the gestures the ants make to one another (touch, grip, lick, feed, lay, follow) are added to the ant's definition below from its own muscles; the loads, the brood, the corpse and
   the trail are what the ants hold, carry and lay; each carried thing follows the mandible tips of whoever holds it. */
(() => {
'use strict';
const K = window.CreatureKit, G = window.CreatureGround, D = K.get('ant');
const {clamp, env, keys, pulse} = K, T6 = D.crewTools, pos = v => v > 0 ? v : 0;
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, a = {}) => { const e = document.createElementNS(NS, tag); for(const k in a) e.setAttribute(k, a[k]); return e; };
const wrapA = a => { while(a > Math.PI) a -= 2 * Math.PI; while(a < -Math.PI) a += 2 * Math.PI; return a; };
const f1 = v => Math.round(v * 10) / 10, hyp = Math.hypot, U = h => [Math.cos(h), Math.sin(h)], dist = (a, b) => hyp(a[0] - b[0], a[1] - b[1]);
const hexc = n => G.hex(n), mixc = (a, b, t) => G.mixInt(a, b, t);
const rnd = seed => G.rng(seed);

/* ---------- what the ants do to each other and to what they hold: gestures added to the ant's own definition (its muscles, nothing new), each a layer that runs on a walk or a stand ----------
   An action is ended with end(m, name), which lets it go over a third of a second (never a cut). */
const act = (name, a) => { D.actions[name] = {dur:240000, label:name, group:'Crew', gait:true, ...a}; };
const ramp = (t, a) => a.rel === undefined ? 1 : clamp(1 - (a.now - a.rel) / 380);
const stepA = (c, a, T) => { a.now = c.t; };
/* touch: antennal contact. The head turns to what is touched (a member or a point), the feelers tap it in turn, the jaws a little ajar */
act('antennate', {label:'Touch with the antennae', f:(t, T, c, a) => {
  stepA(c, a, T); const tg = a.who ? a.who.pose() : a.pt, A = c.crew.m.ant, r = A.bearing(tg.x ?? tg[0], tg[1] ?? tg.y), dur = a.for ?? 2200, e = env(t, 350, 1e9, 1) * (a.rel === undefined ? 1 : ramp(t, a)), tap = Math.sin(t * .021 + (a.ph || 0));
  c.spec(T, {headLower:.3 * e, headTurnR:clamp(r.b / .62, 0, 1) * e, headTurnL:clamp(-r.b / .62, 0, 1) * e, scapeAbdR:(.25 + pos(tap) * .5) * e, scapeAddR:pos(-tap) * .45 * e, scapeAbdL:(.25 + pos(-tap) * .5) * e, scapeAddL:pos(tap) * .45 * e,
    pedFlexR:(.3 + .2 * pos(tap)) * e, pedFlexL:(.3 + .2 * pos(-tap)) * e, mandOpenR:.12 * e, mandOpenL:.12 * e});
  return a.rel !== undefined ? c.t - a.rel < 380 : t < dur;
}});
/* grip: the head goes down, the jaws open and close on the load, and hold it (a crumb shows in the jaws if a.crumb; every other load is the scene's, held at the tips). a.effort 0..1 is how hard it works. end(m, 'grip') opens the jaws. */
act('grip', {label:'Grip a load in the jaws', f:(t, T, c, a) => {
  stepA(c, a, T); const rel = a.rel === undefined ? -1 : c.t - a.rel; if(rel > 700) return false;
  const eff = a.effort ?? 0, dn = a.quick ? 1 : keys(t, [[0, 0], [380, 1], [620, 1], [900, .15]]), open = a.quick ? 0 : keys(t, [[0, 0], [300, 1], [560, 1], [700, 0]]), bite = a.quick ? 1 : keys(t, [[0, 0], [560, 0], [700, 1]]);
  const cl = 1.15 - (c.gs.on && Math.abs(c.gs.psiT - .8) < .05 ? .55 : 0), rl = rel < 0 ? 0 : clamp(rel / 320), rl2 = rel < 0 ? 0 : clamp((rel - 320) / 320), hold = bite * (1 - rl), up = keys(t, [[0, 0], [900, 1]]);
  c.spec(T, {headLower:(.55 * dn * (1 - up) + .3 * eff + .35 * rl * (1 - rl2)), headRaise:.18 * up * (1 - rl), mandOpenR:.9 * open * (1 - rl) + .8 * rl * (1 - rl2), mandOpenL:.9 * open * (1 - rl) + .8 * rl * (1 - rl2), mandCloseR:cl * hold, mandCloseL:cl * hold,
    scapeAddR:.3 * hold, scapeAddL:.3 * hold, pedFlexR:.35 * hold, pedFlexL:.35 * hold, trunk:.12 * eff * (.5 + .5 * Math.sin(t * .012)), carryShow:a.crumb ? 1.4 * clamp((t - 600) / 300) * (1 - rl2) : 0});
  return true;
}});
/* lick: the head down to the brood, the jaws lapping, the foreleg-side feeler stroking (the tend action's, on any posture) */
act('lick', {label:'Lick the brood', f:(t, T, c, a) => {
  stepA(c, a, T); const dur = a.for ?? 4000, u = env(t, 500, 1e9, 1) * (a.rel === undefined ? 1 : ramp(t, a)), lick = Math.sin(t * .014 + (a.ph || 0)), stroke = Math.sin(t * .009 + (a.ph || 0));
  c.spec(T, {headLower:.38 * u * (.5 + .5 * lick), headTurnR:pos(lick) * .1 * u, headTurnL:pos(-lick) * .1 * u, mandOpenR:pos(lick) * .3 * u, mandOpenL:pos(lick) * .3 * u, scapeAddR:(.4 + .3 * stroke) * u, scapeAddL:(.3 - .3 * stroke) * u, pedFlexR:.4 * u, pedFlexL:.3 * u, breath:.5 * u, gasterCurl:.14 * u * (.5 + .5 * Math.sin(t * .004))});
  return a.rel !== undefined ? c.t - a.rel < 380 : t < dur;
}});
/* trophallaxis: the mouth-to-mouth passing of the crop's contents. The giver offers (the jaws ajar, the gaster pulsing, the feelers slow); the taker begs (head low, the jaws open, the feelers drumming on the giver's face). */
act('trophal', {label:'Pass food mouth to mouth', f:(t, T, c, a) => {
  stepA(c, a, T); const dur = a.for ?? 4000, u = env(t, 450, 1e9, 1) * (a.rel === undefined ? 1 : ramp(t, a)), give = a.role === 'give', beat = .5 + .5 * Math.sin(t * .0055), tap = Math.sin(t * (give ? .008 : .02) + (a.ph || 0));
  const tg = a.who ? a.who.pose() : null, r = tg ? c.crew.m.ant.bearing(tg.x, tg.y) : {b:0};
  c.spec(T, {headLower:(give ? .12 : .28) * u, headRaise:(give ? .15 : 0) * u, headTurnR:clamp(r.b / .62, 0, 1) * u, headTurnL:clamp(-r.b / .62, 0, 1) * u, mandOpenR:(give ? .3 : .55) * u, mandOpenL:(give ? .3 : .55) * u,
    scapeAbdR:(give ? .2 : .25 + pos(tap) * .4) * u, scapeAddR:(give ? 0 : pos(-tap) * .4) * u, scapeAbdL:(give ? .2 : .25 + pos(-tap) * .4) * u, scapeAddL:(give ? 0 : pos(tap) * .4) * u, pedFlexR:.3 * u, pedFlexL:.3 * u,
    gasterCurl:(give ? .4 * beat : .1) * u, breath:(give ? .8 : .4) * u});
  return a.rel !== undefined ? c.t - a.rel < 380 : t < dur;
}});
/* lay: the gaster curled to the ground, a dab of scent dropped every few body widths of travel (the ant's own layAlong, into the one shared trail) */
act('trailLay', {label:'Lay a trail as it walks', f:(t, T, c, a) => {
  stepA(c, a, T); const A = c.crew.m.ant, u = env(t, 450, 1e9, 1) * (a.rel === undefined ? 1 : ramp(t, a)); if(a.rel !== undefined && c.t - a.rel >= 380) return false;
  c.spec(T, {gasterCurl:.6 * u, layShow:u, scapeAbdR:.14, scapeAbdL:.14, breath:.2});
  if(t > 300 && (a.rel === undefined)) A.layAlong(a, a.s0 ?? 1);
  return true;
}});
/* alert: the head up, the jaws gaping, the feelers raised: a disturbance read */
act('alert', {label:'Alert', f:(t, T, c, a) => {
  stepA(c, a, T); const dur = a.for ?? 1400, u = env(t, 250, dur - 600, 350);
  c.spec(T, {headRaise:.4 * u, mandOpenR:.55 * u, mandOpenL:.55 * u, scapeAbdR:.55 * u, scapeAbdL:.55 * u, pedExtR:.5 * u, pedExtL:.5 * u, breath:.5 * u});
  return t < dur;
}});
/* struggle: a live ant held in the jaws of another: the feelers lash, the jaws snap, the gaster thrashes */
act('struggle', {label:'Struggle when held', f:(t, T, c, a) => {
  stepA(c, a, T); const u = env(t, 300, 1e9, 1) * (a.rel === undefined ? 1 : ramp(t, a)), w = Math.sin(t * .03 + (a.ph || 0)), w2 = Math.sin(t * .021 + 1.3);
  c.spec(T, {scapeAbdR:(.35 + pos(w) * .6) * u, scapeAddR:pos(-w) * .5 * u, scapeAbdL:(.35 + pos(-w) * .6) * u, scapeAddL:pos(w) * .5 * u, pedFlexR:pos(w2) * .6 * u, pedFlexL:pos(-w2) * .6 * u, headTurnR:pos(w2) * .35 * u, headTurnL:pos(-w2) * .35 * u, gasterSwingR:pos(w) * .5 * u, gasterSwingL:pos(-w) * .5 * u, mandOpenR:pos(Math.sin(t * .02)) * .5 * u, mandOpenL:pos(Math.sin(t * .02)) * .5 * u});
  return a.rel !== undefined ? c.t - a.rel < 380 : true;
}});
/* limp: the body of a dead nestmate: the legs drawn up in and each curled its own way, the feelers fallen, the jaws slack, the gaster a little curled. Held for as long as it is wanted. */
const LEGTAG = ['R0', 'R1', 'R2', 'L0', 'L1', 'L2'], CURL = [[.52, .5], [.6, -.35], [.46, .4], [.58, -.5], [.48, .3], [.62, -.4]];
act('limp', {label:'Lie dead', gait:false, f:(t, T, c, a) => {
  stepA(c, a, T); const u = env(t, 900, 1e9, 1);
  for(let k = 0; k < 6; k++){ const hp = D.bones[D.BI['u' + LEGTAG[k]]].p, f = c.foot(k), s = 1 - (1 - CURL[k][0]) * u, ca = Math.cos(CURL[k][1] * u), sa = Math.sin(CURL[k][1] * u), dx = (f[0] - hp[0]) * s, dy = (f[1] - hp[1]) * s;
    c.legTo(k, hp[0] + dx * ca - dy * sa, hp[1] + dx * sa + dy * ca, f[2] + CURL[k][1] * .8 * u, u, u, {kk:12}); }
  c.spec(T, {pedFlexR:.75 * u, pedFlexL:.6 * u, scapeAddR:.45 * u, scapeAddL:.3 * u, mandOpenR:.28 * u, mandOpenL:.18 * u, gasterCurl:.3 * u, headLower:.3 * u, headTurnR:.2 * u});
  return true;
}});
/* follow the trail: read it with the feelers, turn to the marks ahead and walk them (reinforcing what the gaster passes), cast for it when it is lost, stop when the tips are within a.r of a.until (a world point), or, in a loop, never:
   it follows its own trail round until it tires (a.tireAt ms) and stops. The reason it ended is left on the member (m.followEnd). */
act('trailFollow', {label:'Follow the trail', steers:true, f:(t, T, c, a) => {
  const m = c.crew.m, A = m.ant, now = c.t, s = T6.sweep(t, 1), pk = A.pick(), look = pk.best, dt = c.dtms, tipD = a.until ? dist(A.tip(), a.until) : 1e9;
  if(a.ph === undefined){ a.ph = 'read'; a.lost = 0; a.cast0 = 0; a.t1 = 0; }
  const fin = reason => { if(a.ph === 'end') return; a.ph = 'end'; a.t1 = t; m.followEnd = {reason, t:c.t}; };
  let lean = 0, wide = .45; const tired = a.tireAt ? clamp((t - a.tireAt) / 3500) : 0;
  if(a.ph === 'read'){ c.spec(T, {scapeAbdR:.6 * s.R, scapeAbdL:.6 * s.L, pedFlexR:.3 * s.R, pedFlexL:.3 * s.L, headTurnR:pos(Math.sin(t * .0042)) * .12, headTurnL:pos(-Math.sin(t * .0042)) * .12}); if(t > (a.read ?? 1100)){ a.ph = pk.n ? 'follow' : 'cast'; a.cast0 = t; } return true; }
  if(a.ph === 'follow'){
    let blocked = false;   // a body ahead (within a.gap, in front) holds the walk back: a column keeps its places, it does not pile up
    if(a.gap){ const p = m.pose(); let dm = 1e9; for(const q of c.crew.crew.members){ if(q === m || !q.c.actions.some(x => x.name === 'trailFollow' && !x.cut)) continue; const qp = q.pose(), dx = qp.x - p.x, dy = qp.y - p.y, d = hyp(dx, dy); if(d < dm && Math.abs(wrapA(Math.atan2(dy, dx) - p.h)) < .8) dm = d; } if(dm < a.gap * .75){ blocked = true; T6.halt(c, a, 'stand'); } else if(dm < a.gap) blocked = 'slow'; }
    if(look){ a.lost = 0; lean = look.b; A.home(clamp(2.2 * look.b, -1, 1)); if(blocked !== true) T6.setGait(c, a, blocked || tired > .5 || Math.abs(look.b) > .55 ? 'creep' : 'walk'); A.refresh(a.reach ?? 24); }
    else { a.lost += dt; if(a.lost > 650){ if(pk.near && pk.near.d < (a.nearMax ?? 1000)){ lean = pk.near.b; A.home(clamp(2.2 * pk.near.b, -1, 1)); T6.setGait(c, a, Math.abs(pk.near.b) > .9 ? 'shuffle' : 'creep'); } else { a.ph = 'cast'; a.cast0 = t; } } }
    if(tipD < (a.r ?? 70)) fin('found');
    else if(a.tireAt && tired >= 1) fin('tired');
    else if(a.maxT && t > a.maxT) fin('timeout');
  }
  if(a.ph === 'cast'){ const k = clamp((t - a.cast0) / 3800); wide = .7 + .3 * k; A.home((.35 + .5 * k) * Math.sin((t - a.cast0) * .0034)); T6.setGait(c, a, 'creep'); if(look){ a.ph = 'follow'; a.lost = 0; } else if(t - a.cast0 > 3800) fin('lost'); }
  if(a.ph === 'end'){
    A.home(0); T6.halt(c, a, 'stand'); const u = env(t - a.t1, 500, 1400, 500), kind = m.followEnd.reason;
    c.spec(T, kind === 'found' ? {headLower:.4 * u, scapeAddR:.3 * u, scapeAddL:.3 * u, mandOpenR:.3 * u, mandOpenL:.3 * u} : {pedFlexR:.5 * u, pedFlexL:.5 * u, scapeAddR:.4 * u, scapeAddL:.4 * u, headLower:.3 * u});
    return !T6.settled(c, 'stand') || t < a.t1 + 600;
  }
  const l = clamp(lean * 1.2, -1, 1);
  c.spec(T, {scapeAbdR:wide * s.R * (1 + pos(l)) * .9 * (1 - .5 * tired), scapeAbdL:wide * s.L * (1 + pos(-l)) * .9 * (1 - .5 * tired), scapeAddR:pos(-l) * .3, scapeAddL:pos(l) * .3, pedFlexR:.25 * s.R + pos(l) * .3 + .5 * tired, pedFlexL:.25 * s.L + pos(-l) * .3 + .5 * tired, gasterCurl:.12 * (1 - tired), headTurnR:pos(l) * .14, headTurnL:pos(-l) * .14, headLower:.5 * tired});
  return true;
}});
/* ending a held gesture: the action lets go over a third of a second */
const end = (m, name) => { for(const x of m.c.actions) if(x.name === name && x.rel === undefined) x.rel = m.c.t; };
const running = (m, name) => m.c.actions.some(x => x.name === name && !x.cut);
/* the harmless small life only: the feelers and the jaws, never a walk or a trail of its own */
D.life.small = D.life.small.filter(x => ['antennaFlick', 'headScan', 'mouthWork'].includes(x[0])); D.life.gait = (D.life.gait || []).filter(x => ['antennaFlick', 'headScan'].includes(x[0]));
/* a dead ant is still: nothing of the idle's breath and sway */
{ const idle0 = D.idle; D.idle = (c, now, Ti, dt) => { idle0(c, now, Ti, dt); if(c.crew && c.crew.m.dead) Ti.fill(0); }; }

/* ====================================================== the scene ====================================================== */
const VIEW = {x:-1196, y:-1034, w:2120, h:2120};              // the main habitat (the trail's view): the nest at the lower left, the food at the upper right
const VIEW_MILL = {x:-1200, y:-1170, w:1840, h:1840}, VIEW_CLEAR = {x:-1300, y:-1160, w:2120, h:2120};       // each pattern's own, as tight as its bodies allow (every body whole in the pane)                // the main habitat: the nest at the lower left, the food at the upper right, the midden at the lower right
const NEST = [-700, 480], FOOD = [420, -440], MIDDEN = [620, 640];
const UOUT = (() => { const d = [FOOD[0] - NEST[0], FOOD[1] - NEST[1]], l = hyp(d[0], d[1]); return [d[0] / l, d[1] / l]; })(), HOUT = Math.atan2(UOUT[1], UOUT[0]);
const LIP = [NEST[0] + UOUT[0] * 210, NEST[1] + UOUT[1] * 210];
const TEND0 = [0, 4300], VIEW_TEND = {x:TEND0[0] - 1230, y:TEND0[1] - 1050, w:2500, h:2500};      // the brood chamber lies elsewhere on the same sand

const blobPts = (x, y, r, k, n = 18, wob = .2) => Array.from({length:n}, (_, i) => { const a = i * 2 * Math.PI / n, rr = r * (1 + wob * (Math.sin(k * 7.3 + i * 2.1) * .6 + Math.sin(k * 3.1 + i * 4.7) * .4)); return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; });
const smoothD = pts => { const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; let d = 'M' + f1(mid(pts[n - 1], pts[0])[0]) + ' ' + f1(mid(pts[n - 1], pts[0])[1]); for(let i = 0; i < n; i++){ const q = pts[i], m = mid(pts[i], pts[(i + 1) % n]); d += 'Q' + f1(q[0]) + ' ' + f1(q[1]) + ' ' + f1(m[0]) + ' ' + f1(m[1]); } return d + 'Z'; };
const blobD = (x, y, r, k, n, wob) => smoothD(blobPts(x, y, r, k, n, wob));
const ellD = (x, y, rx, ry, a = 0, n = 20) => 'M' + Array.from({length:n}, (_, i) => { const t = i * 2 * Math.PI / n, u = Math.cos(t) * rx, v = Math.sin(t) * ry; return f1(x + u * Math.cos(a) - v * Math.sin(a)) + ' ' + f1(y + u * Math.sin(a) + v * Math.cos(a)); }).join('L') + 'Z';

window.ANTCREW = {act, end, running};
CreatureCrew.page({title:'ANT', sign:'', sub:'the crew on the sand', view:VIEW, thumbPattern:'trail',
  setup(crew){
    const under = crew.habitat.under, over = crew.habitat.over, W = crew.antw = {markW:9, dab:5.5};   // (the trail's dabs are drawn larger than the ant's own page draws them: the pane is a fifth of the size)
    W.trailG = mk('g', {class:'an-trail', 'pointer-events':'none'}); under.appendChild(W.trailG);
    const ANTPAL = {ink:'#9a8268'};   // the ants' own ink a little brighter in this scene (the sand stays the figure's: it is made from the default palette)
    const addAnt = (name, role, at, h, o = {}) => { const m = crew.add({def:'ant', name, role, at, h, radius:190, seed:o.seed ?? 11 + crew.members.length * 7, life:o.life, gaits:o.gaits, z:o.z, palette:o.palette || ANTPAL}); m.c.pad.trail.L[0] = o.trailX ?? 1; m.c.pad.trail.L[1] = 0; return m; };
    const m0 = addAnt('probe', '', [0, 0], 0, {life:false, palette:{}}), PAL = m0.c.C, GC = m0.c.ground.col, hx = n => hexc(n);
    crew.sand({seed:7, crest:.3, C:PAL});
    const gStatic = mk('g', {class:'an-static', 'pointer-events':'none'}); under.insertBefore(gStatic, W.trailG);
    const gObj = mk('g', {class:'an-obj', 'pointer-events':'none'}), gTop = mk('g', {class:'an-top', 'pointer-events':'none'}); under.appendChild(gObj); over.appendChild(gTop);
    const skin = PAL.skin, bone = PAL.bone, ink = PAL.ink, accent = PAL.accent;
    const COL = {rim:hx(GC.rim), soil:hx(mixc(skin, bone, .09)), soilHi:hx(mixc(skin, bone, .16)), hole:hx(mixc(GC.moundFill, 0, .82)), shade:hx(GC.shade), heap:hx(GC.heap), heapHi:hx(mixc(skin, bone, .62)),
      larva:hx(mixc(skin, bone, .5)), larvaLine:hx(mixc(skin, bone, .8)), pupa:hx(mixc(skin, bone, .3)), pupaLine:hx(mixc(skin, bone, .62)), seed:hx(mixc(skin, PAL.umber, .55)), seedLine:hx(mixc(skin, bone, .5)), elaio:hx(mixc(skin, bone, .66)),
      drop:hx(mixc(skin, accent, .7)), accent:hx(accent), ink:hx(ink)};
    const path = (parent, d, a = {}) => { const e = mk('path', {d, ...a}); parent.appendChild(e); return e; };

    /* ---------- the habitat's fixed things: the nest, the heap of food, the midden, the brood chamber ---------- */
    const nest = (() => { const g = mk('g'), [x, y] = NEST; gStatic.appendChild(g);
      path(g, blobD(x + 26, y + 30, 360, 3, 22, .12), {fill:COL.shade, 'fill-opacity':.4});
      path(g, blobD(x, y, 350, 4, 22, .1), {fill:COL.soil, stroke:COL.rim, 'stroke-width':5, 'stroke-opacity':.8});
      path(g, blobD(x, y, 270, 5, 20, .1) + blobD(x, y, 205, 6, 18, .1), {fill:'none', stroke:COL.rim, 'stroke-width':3, 'stroke-opacity':.4});
      for(let i = 0; i < 26; i++){ const a = i * 2.399, r = 255 + (i % 5) * 20; path(g, blobD(x + Math.cos(a) * r, y + Math.sin(a) * r, 22 + (i % 4) * 7, i + 1, 8, .3), {fill:COL.heap, 'fill-opacity':.75, stroke:COL.rim, 'stroke-width':2, 'stroke-opacity':.6}); }
      path(g, blobD(x, y, 150, 7, 16, .12), {fill:COL.hole, stroke:COL.rim, 'stroke-width':4, 'stroke-opacity':.7}); return g; })();
    function foodHeap(n){ const g = mk('g'), crumbs = []; gStatic.appendChild(g); const R = rnd(31);
      for(let k = 0; k < n; k++){ const a = k * 2.399, r = 20 + 36 * Math.sqrt(k), cx = FOOD[0] + Math.cos(a) * r, cy = FOOD[1] + Math.sin(a) * r, rr = 26 + (k % 3) * 9 + R() * 8; crumbs.push({x:cx, y:cy, r:rr, k, gone:false}); }
      const draw = () => { g.textContent = ''; for(const c of crumbs){ if(c.gone) continue; path(g, blobD(c.x + 14, c.y + 16, c.r, c.k + 1, 9, .28), {fill:COL.shade, 'fill-opacity':.4}); path(g, blobD(c.x, c.y, c.r, c.k + 1, 9, .28), {fill:COL.heap, stroke:COL.rim, 'stroke-width':2.4, 'stroke-opacity':.7}); path(g, 'M' + f1(c.x - c.r * .35) + ' ' + f1(c.y - c.r * .25) + 'q' + f1(c.r * .3) + ' ' + f1(-c.r * .2) + ' ' + f1(c.r * .6) + ' 0', {fill:'none', stroke:COL.heapHi, 'stroke-width':2.4, 'stroke-linecap':'round', 'stroke-opacity':.7}); } };
      draw(); return {g, crumbs, draw, left:() => crumbs.filter(c => !c.gone).length, take(){ const L = crumbs.filter(c => !c.gone); if(!L.length) return null; const c = L.reduce((b, q) => dist([q.x, q.y], NEST) < dist([b.x, b.y], NEST) ? q : b); c.gone = true; draw(); return c; }, refill(){ for(const c of crumbs) c.gone = false; draw(); }}; }
    const food = foodHeap(16);
    const midden = (() => { const g = mk('g'), [x, y] = MIDDEN, R = rnd(9); gStatic.appendChild(g);
      path(g, blobD(x + 18, y + 20, 280, 9, 20, .18), {fill:COL.shade, 'fill-opacity':.45}); path(g, blobD(x, y, 270, 10, 20, .16), {fill:COL.soil, stroke:COL.rim, 'stroke-width':3.5, 'stroke-opacity':.5, 'stroke-dasharray':'2 14'});
      for(let i = 0; i < 22; i++){ const a = R() * 6.28, r = Math.sqrt(R()) * 220, cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r; if(i % 3 === 0) path(g, ellD(cx, cy, 34 + R() * 20, 14 + R() * 8, R() * 3, 12), {fill:COL.soilHi, stroke:COL.rim, 'stroke-width':2, 'stroke-opacity':.6}); else path(g, blobD(cx, cy, 12 + R() * 16, i, 7, .3), {fill:COL.heap, 'fill-opacity':.7, stroke:COL.rim, 'stroke-width':1.8, 'stroke-opacity':.5}); }
      return g; })();
    const chamber = (() => { const g = mk('g'), [x, y] = TEND0; gStatic.appendChild(g);
      path(g, blobD(x + 40, y + 40, 1180, 21, 26, .09), {fill:COL.shade, 'fill-opacity':.35}); path(g, blobD(x, y, 1160, 22, 26, .09), {fill:COL.hole, 'fill-opacity':.5, stroke:COL.rim, 'stroke-width':6, 'stroke-opacity':.6});
      path(g, blobD(x, y, 1040, 23, 24, .1), {fill:'none', stroke:COL.rim, 'stroke-width':2.5, 'stroke-opacity':.25, 'stroke-dasharray':'3 18'});
      const sx = x + 780, sy = y + 560;                                                             // the deeper chamber, where the brood is carried when its pile is disturbed
      path(g, blobD(sx + 20, sy + 24, 530, 31, 22, .08), {fill:COL.shade, 'fill-opacity':.35}); path(g, blobD(sx, sy, 520, 32, 22, .08), {fill:COL.hole, 'fill-opacity':.85, stroke:COL.rim, 'stroke-width':5, 'stroke-opacity':.7});
      path(g, blobD(sx, sy, 420, 33, 20, .08), {fill:'none', stroke:COL.rim, 'stroke-width':2.5, 'stroke-opacity':.3, 'stroke-dasharray':'3 16'}); return g; })();
    const SAFE = [TEND0[0] + 780, TEND0[1] + 560];

    /* ---------- things the ants hold: a grub, a pupa in its cocoon, a seed, a crumb, a drop. Local coordinates, facing +x, centred. ---------- */
    const larvaG = (seedK = 1) => { const g = mk('g'), N = 9, bend = 1.35, L = 205, R = L / bend, w = [15, 24, 31, 35, 37, 36, 33, 28, 19], segs = [];
      for(let i = 0; i < N; i++){ const u = .5 - i / (N - 1), ang = u * bend, cx = R * Math.sin(ang), cy = R * (1 - Math.cos(ang)) - R * (1 - Math.cos(bend / 2)) / 1.6, tx = Math.cos(ang), ty = Math.sin(ang);   // from the head (+x) round to the tail
        segs.push([cx, cy, ang, w[i]]); }
      for(const [cx, cy, ang, ry] of segs.slice().reverse()) path(g, ellD(cx, cy, 15, ry, ang, 14), {fill:COL.larva, stroke:COL.larvaLine, 'stroke-width':2.6, 'stroke-opacity':.85});
      const h = segs[0]; path(g, ellD(h[0] + 10 * Math.cos(h[2]), h[1] + 10 * Math.sin(h[2]), 11, 9, h[2], 10), {fill:COL.larva, stroke:COL.larvaLine, 'stroke-width':2.6, 'stroke-opacity':.9}); 
      return g; };
    const pupaG = () => { const g = mk('g'); path(g, ellD(0, 0, 105, 52, 0, 22), {fill:COL.pupa, stroke:COL.pupaLine, 'stroke-width':3, 'stroke-opacity':.85}); path(g, 'M-78 -28Q-24 -48 46 -34M-84 0Q0 -18 86 0M-78 28Q-24 48 46 34', {fill:'none', stroke:COL.pupaLine, 'stroke-width':2, 'stroke-opacity':.5, 'stroke-linecap':'round'}); path(g, 'M96 0Q104 -14 92 -24', {fill:'none', stroke:COL.pupaLine, 'stroke-width':2.4, 'stroke-opacity':.6}); return g; };
    const seedG = (rx = 285, ry = 175) => { const g = mk('g'); const pts = Array.from({length:22}, (_, i) => { const a = i * 2 * Math.PI / 22, tp = 1 + .12 * Math.cos(a), r = 1 + .035 * Math.sin(a * 3); return [Math.cos(a) * rx * r * (Math.cos(a) > 0 ? 1 : .94), Math.sin(a) * ry * r * tp]; });
      path(g, smoothD(pts.map(p => [p[0] + 22, p[1] + 26])), {fill:COL.shade, 'fill-opacity':.4}); path(g, smoothD(pts), {fill:COL.seed, stroke:COL.seedLine, 'stroke-width':4.5, 'stroke-opacity':.75});
      path(g, 'M' + f1(-rx * .78) + ' 0Q0 ' + f1(-ry * .22) + ' ' + f1(rx * .78) + ' 0M' + f1(-rx * .7) + ' ' + f1(-ry * .45) + 'Q0 ' + f1(-ry * .62) + ' ' + f1(rx * .6) + ' ' + f1(-ry * .4) + 'M' + f1(-rx * .7) + ' ' + f1(ry * .45) + 'Q0 ' + f1(ry * .62) + ' ' + f1(rx * .6) + ' ' + f1(ry * .4), {fill:'none', stroke:COL.seedLine, 'stroke-width':3, 'stroke-opacity':.4, 'stroke-linecap':'round'});
      path(g, blobD(-rx * .98, 0, 62, 5, 10, .3), {fill:COL.elaio, stroke:COL.seedLine, 'stroke-width':3, 'stroke-opacity':.7}); return g; };
    const dropG = () => { const g = mk('g'); path(g, ellD(0, 0, 15, 12, 0, 10), {fill:COL.drop, stroke:COL.accent, 'stroke-width':2.2, 'stroke-opacity':.9}); path(g, 'M-5 -4q3 -3 7 -2', {fill:'none', stroke:COL.heapHi, 'stroke-width':2, 'stroke-linecap':'round'}); return g; };
    const crumbG = () => { const g = mk('g'); path(g, blobD(0, 0, 34, 3, 9, .28), {fill:COL.heap, stroke:COL.rim, 'stroke-width':2.4, 'stroke-opacity':.8}); return g; };
    /* an object: a drawn thing in the habitat at (x, y) turned by a, drawn under the bodies (or over them: top) */
    const things = [];
    const thing = (kind, x, y, a, o = {}) => { const g = o.g || (kind === 'larva' ? larvaG(o.k) : kind === 'pupa' ? pupaG() : kind === 'seed' ? seedG(o.rx, o.ry) : kind === 'drop' ? dropG() : crumbG()), t = {kind, g, x, y, a, hold:null, s:o.s ?? 1, top:!!o.top, show(v){ g.style.display = v ? '' : 'none'; }};
      (o.top ? gTop : gObj).appendChild(g); t.draw = () => g.setAttribute('transform', 'translate(' + f1(t.x) + ' ' + f1(t.y) + ') rotate(' + f1(t.a * 180 / Math.PI) + ')' + (t.s !== 1 ? ' scale(' + t.s + ')' : '')); t.draw(); things.push(t); return t; };

    /* ---------- the scene's own clock: threads (an ant's life inside a pattern), hooks (what the bodies do to what they hold) ---------- */
    const hooks = [], threads = [];
    const condOf = v => typeof v === 'function' ? v : Array.isArray(v) ? (() => { const L = v.map(condOf); return () => L.every(f => f()); })() : () => true;
    const spawn = gen => { const th = {gen, wait:null, done:false}; threads.push(th); return th; };
    const stepThreads = () => { for(const th of threads){ if(th.done) continue; if(th.wait && !th.wait()) continue; th.wait = null;
      for(let n = 0; n < 40; n++){ let r; try { r = th.gen.next(); } catch(e){ th.done = true; console.error(e); break; } if(r.done){ th.done = true; break; } const v = r.value; if(typeof v === 'number'){ th.wait = crew.wait(v); break; } if(v === undefined || v === null) break; const f = condOf(v); if(f() === true) continue; th.wait = f; break; } } };
    const allDone = list => () => list.every(th => th.done);
    crew.tickHook = dt => { stepThreads(); for(const h of hooks) h(dt); for(const t of things) if(t.hold || t.dirty){ t.draw(); t.dirty = false; } };
    /* a gesture played and awaited: true once it has run and gone (or if it never started in 3 s) */
    const playC = (m, name, args) => { const c = m.c; c.play(name, args); const t0 = crew.t; let seen = false; return () => { const on = running(m, name); if(on) seen = true; return seen ? !on : crew.t - t0 > 3000; }; };
    const gone = (m, name) => () => !running(m, name);
    const settle = m => () => m.arrived && !m.c.gait;

    const carried = [];
    const pickUp = (t, m, ahead = 26, rot = Math.PI / 2) => { const [x, y] = m.ant.tip(), h = m.pose().h; carried.push({t, m, ahead, rot, t0:crew.t, from:[t.x, t.y, t.a], k:0}); t.hold = m; ST.pickSep = ST.pickSep || []; ST.pickSep.push(Math.round(dist([x, y], [t.x, t.y]))); };
    const putDown = t => { const i = carried.findIndex(k => k.t === t); if(i >= 0) carried.splice(i, 1); t.hold = null; t.dirty = true; };
    const stepCarried = () => { for(const k of carried){ const [x, y] = k.m.ant.tip(), h = k.m.pose().h, tx = x + Math.cos(h) * k.ahead, ty = y + Math.sin(h) * k.ahead, ta = h + k.rot; k.k = Math.min(1, (crew.t - k.t0) / 450); const e = k.k * k.k * (3 - 2 * k.k);
      k.t.x = k.from[0] + (tx - k.from[0]) * e; k.t.y = k.from[1] + (ty - k.from[1]) * e; k.t.a = k.from[2] + wrapA(ta - k.from[2]) * e; k.t.moved = (k.t.moved || 0) + 1; if(k.t.member) k.t.member.place(k.t.x, k.t.y, k.t.a); if(k.k >= 1){ const d = Math.abs(dist([k.t.x, k.t.y], [x, y]) - k.ahead); k.t.sepMax = Math.max(k.t.sepMax || 0, d); } } };
    /* ---------- casting: every pattern begins by taking down the last one and setting its own cast, so a run from a button, from the gate or from the shot tool is the same run ---------- */
    let ST = {};
    const dropMember = m => { try { const g = m.c.ground; if(g && g.printsG) g.printsG.remove(); const st = m.c.svg.__an; if(st && st.grp) st.grp.remove(); } catch(e){} crew.remove(m); };
    const clearMarks = () => { if(W.marks) for(const mk_ of W.marks){ mk_.t0 = -1e9; mk_.q = -1; mk_.e.style.display = 'none'; } };
    const reset = (view, o = {}) => {
      hooks.length = 0; threads.length = 0; carried.length = 0; for(const m of crew.members.slice()) dropMember(m); for(const t of things.splice(0)) t.g.remove(); gTop.textContent = ''; clearMarks(); food.refill(); ST = {t0:crew.t};
      under.appendChild(gObj); crew.setView(view || VIEW); crew.limits = o.limits || undefined; hooks.push(separate); hooks.push(bodyWatch); };
    /* what the pane must not show, watched for every pattern: a body whose whole length is not inside the pane (centre +- 290 units, the antennae's and gaster's reach), and two bodies lying on each other. A body is the segment from the gaster's tip to the mandibles'
       (268 behind its centre, 214 before it); two bodies are on each other when those segments come within STACK_D of each other (the body is about 110 wide: under 100 apart the bodies lie across each other; the personal space below keeps them 175 apart), unless one is touching the other on purpose (feelers or mouths on it, a body in her jaws,
       a pair the scene names in ST.exempt). */
    const STACK_D = 100;
    const capsule = m => { const p = m.pose(), u = [Math.cos(p.h), Math.sin(p.h)]; return [[p.x - u[0] * 268, p.y - u[1] * 268], [p.x + u[0] * 214, p.y + u[1] * 214]]; };
    const segD = (A, B) => { const d = (P, Q, R) => { const dx = R[0] - Q[0], dy = R[1] - Q[1], l2 = dx * dx + dy * dy || 1, u = clamp(((P[0] - Q[0]) * dx + (P[1] - Q[1]) * dy) / l2); return hyp(P[0] - Q[0] - dx * u, P[1] - Q[1] - dy * u); };
      const cross = (a, b, c, e) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, e) < 0 && o(c, e, a) * o(c, e, b) < 0; };
      return cross(A[0], A[1], B[0], B[1]) ? 0 : Math.min(d(A[0], B[0], B[1]), d(A[1], B[0], B[1]), d(B[0], A[0], A[1]), d(B[1], A[0], A[1])); };
    const touching = (a, b) => [[a, b], [b, a]].some(([x, y]) => x.c.actions.some(q => !q.cut && (q.name === 'antennate' || q.name === 'trophal') && q.who === y));
    /* personal space: two bodies that come within SEP_D of each other (and are not touching on purpose) are eased apart, a couple of units a frame each, by the ground sliding under their feet (m.nudge): the host's own avoidance works only on a walker
       that is steering to a point, and a body that is following a trail, standing, turning or waiting has no other. Off for the haul (the holders are held by the load). */
    const SEP_D = 175;
    const segClosest = (A, B) => { let best = null; const tryPt = (P, Q, R, flip) => { const dx = R[0] - Q[0], dy = R[1] - Q[1], l2 = dx * dx + dy * dy || 1, u = clamp(((P[0] - Q[0]) * dx + (P[1] - Q[1]) * dy) / l2), q = [Q[0] + dx * u, Q[1] + dy * u], d = hyp(P[0] - q[0], P[1] - q[1]); if(!best || d < best.d) best = {d, a:flip ? q : P, b:flip ? P : q}; };
      tryPt(A[0], B[0], B[1], false); tryPt(A[1], B[0], B[1], false); tryPt(B[0], A[0], A[1], true); tryPt(B[1], A[0], A[1], true); return best; };
    function separate(dt){ if(ST.noSep) return; const M = crew.members, caps = M.map(capsule);
      for(let i = 0; i < M.length; i++) for(let j = i + 1; j < M.length; j++){ const a = M[i], b = M[j]; if(a.held || b.held || (ST.exempt && (ST.exempt.has(a.name + '|' + b.name) || ST.exempt.has(b.name + '|' + a.name))) || touching(a, b)) continue;
        const c = segClosest(caps[i], caps[j]); if(c.d >= SEP_D) continue; let dx = c.a[0] - c.b[0], dy = c.a[1] - c.b[1], l = hyp(dx, dy);
        if(l < 1){ const pa = a.pose(), pb = b.pose(); dx = pa.x - pb.x; dy = pa.y - pb.y; l = hyp(dx, dy) || 1; } const k = Math.min(2.2, (SEP_D - c.d) * .1) / l;
        const add = (m, sx, sy) => { const n = m.nudge || [0, 0]; m.nudge = [n[0] + sx, n[1] + sy]; }; add(a, dx * k, dy * k); add(b, -dx * k, -dy * k); } }
    function bodyWatch(dt){ const M = crew.members, s = crew.cam.s, R = 290 * s, S = ST; S.margin = S.margin ?? 1e9; const K_ = S.stack || (S.stack = {run:{}, worst:0, who:'', n:0});
      for(const m of M){ const p = m.pose(), q = crew.toPane(p.x, p.y), mg = Math.min(q[0] - R, crew.W - q[0] - R, q[1] - R, crew.H - q[1] - R); if(mg < S.margin){ S.margin = mg; S.marginWho = m.name; S.marginAt = [Math.round(p.x), Math.round(p.y), Math.round(crew.t)]; } }
      const caps = M.map(capsule);
      for(let i = 0; i < M.length; i++) for(let j = i + 1; j < M.length; j++){ const a = M[i], b = M[j]; const k = i + '/' + j;
        if(a.held || b.held || (S.exempt && (S.exempt.has(a.name + '|' + b.name) || S.exempt.has(b.name + '|' + a.name))) || touching(a, b)){ K_.run[k] = 0; continue; }
        const d = segD(caps[i], caps[j]);
        if(d < (S.stackD ?? STACK_D)){ const r = K_.run[k] = (K_.run[k] || 0) + dt; if(r >= 300 && r < 300 + dt + 1) (K_.log || (K_.log = [])).push(a.name + ' / ' + b.name + ' from ' + ((crew.t - r) / 1000).toFixed(1) + ' s, ' + Math.round(d) + ' apart, ' + a.action() + '/' + b.action()); if(r > K_.worst){ K_.worst = r; K_.who = a.name + ' / ' + b.name + ' ' + Math.round(d); } } else K_.run[k] = 0; } }
    const A_ = (name, role, at, h, o) => addAnt(name, role, at, h, o);
    const hOf = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]);
    const off = (p, h, d, lat = 0) => [p[0] + Math.cos(h) * d - Math.sin(h) * lat, p[1] + Math.sin(h) * d + Math.cos(h) * lat];    // a point d along heading h and lat to its right
    const tips = m => m.ant.tip();
    /* how near the feelers of a come to b (the other's feeler tips, or its head): the measure of antennal contact */
    const feelD = (a, b) => { const fa = a.ant.feel(), fb = b.ant.feel(), hb = b.ant.head(); let d = 1e9; for(const p of fa){ for(const q of fb) d = Math.min(d, dist(p, q)); d = Math.min(d, dist(p, hb)); } return d; };
    const feelOnBody = (a, b) => { const fa = a.ant.feel(); let d = 1e9; for(const p of fa) for(const [u, v] of [[-150, 0], [-60, 0], [10, 0], [90, 0], [140, 0]]) d = Math.min(d, dist(p, b.ant.part('body', u, v))); return d; };
    const watchTouch = (key, a, b, f = feelD) => { ST.touch = ST.touch || {}; ST.touch[key] = 1e9; hooks.push(() => { if(running(a, 'antennate')) ST.touch[key] = Math.min(ST.touch[key], f(a, b)); }); };
    const record = (name, m) => { const r = ST.rec || (ST.rec = {}); r[name] = []; let t = 0; hooks.push(dt => { t += dt; if(t < 100) return; t = 0; const p = m.pose(), fa = m.c.actions.find(x => x.name === 'trailFollow' && !x.cut); r[name].push([crew.t, p.x, p.y, fa && fa.ph === 'follow' ? 1 : 0]); }); };
    const distToPath = (p, poly) => { let best = 1e9; for(let i = 0; i < poly.length - 1; i++){ const a = poly[i], b = poly[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, u = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2), q = [a[0] + dx * u, a[1] + dy * u]; best = Math.min(best, dist(p, q)); } return best; };
    const liveMarks = (min = .05) => { const now = crew.members[0] ? crew.members[0].c.t : 0; let n = 0, s = 0; for(const mk_ of W.marks){ if(mk_.t0 < -1e8) continue; const u = (now - mk_.t0) / mk_.life, al = u >= 1 ? 0 : mk_.s0 * Math.pow(1 - u, 1.3); if(al > min){ n++; s += al; } } return {n, s}; };

    /* ============================================ TRAIL ============================================
       A forager finds the food and walks home with a crumb in her jaws, laying the trail as she goes; nestmates she meets feel her with their antennae and fall in; they follow the trail out in a column, reinforcing it; it fades
       when it is no longer walked. Thread contract (CREW-NOTES-ANT.md): Start (the food is found), Stay (the trail, in the habitat), Count (the column), Reach (the food), Link (antennal contact), Join (fall in behind the marks),
       Change (the trail's strength, laid and reinforced and left to fade), Failure (the mill). */
    /* a route: the ant walks the waypoints without stopping at each (the next is taken up when it comes within `via` of the last), and stops at the end. A generator: yield* it. */
    function* route(m, pts, o = {}){
      if(o.turn !== false){ const p = m.pose(), h = hOf([p.x, p.y], pts[0]); if(Math.abs(wrapA(h - p.h)) > .6) yield m.face(h, {tol:.25}); }
      for(let i = 0; i < pts.length - 1; i++){ const w = pts[i]; m.goto(w[0], w[1], {r:o.r ?? 40, gait:o.gait}); yield () => m.dist(w[0], w[1]) < (o.via ?? 260); }
      const w = pts[pts.length - 1]; yield m.goto(w[0], w[1], {r:o.r ?? 40, h:o.h, gait:o.gait});
    }
    const bodyFails = (notes, stackMax = 1000) => { let ok = true; const K_ = ST.stack; if(K_ && K_.worst > stackMax){ ok = false; notes.push('two bodies stood on each other for ' + Math.round(K_.worst) + ' ms (' + K_.who + ')'); } if(ST.margin < -2){ ok = false; notes.push('a body left the pane: ' + ST.marginWho + ' by ' + Math.round(-ST.margin) + ' px at ' + JSON.stringify(ST.marginAt)); }
      notes.push('longest time two bodies lay within ' + STACK_D + ' of each other ' + (K_ ? Math.round(K_.worst) : '?') + ' ms; smallest margin of a whole body to the pane edge ' + Math.round(ST.margin) + ' px'); return ok; };
    const CPT = off(LIP, HOUT, 380), TIN = HOUT + Math.PI;                                  // the meeting place on the trail, and the heading of a forager coming home along it
    const SEARCH = [off(LIP, HOUT, 430, 0), off(LIP, HOUT, 800, -120)];                  // a forager's search: not a straight line to a food she does not yet know
    const STATION = [FOOD[0] - 280, FOOD[1] + 280];                                         // where she stands to take a crumb (her jaws at the heap's edge)
    const RETURN = (() => { const d = [CPT[0] - STATION[0], CPT[1] - STATION[1]], l = hyp(d[0], d[1]), u = [d[0] / l, d[1] / l], pp = [-u[1], u[0]], at = (a, lat) => [STATION[0] + u[0] * a + pp[0] * lat, STATION[1] + u[1] * a + pp[1] * lat]; return [at(.3 * l, 190), at(.66 * l, -190), CPT]; })();   // the way home is not a straight line: a gentle S
    const rimAt = a => [FOOD[0] + Math.cos(a) * 460, FOOD[1] + Math.sin(a) * 460];           // places round the heap's rim, facing in
    const WAIT = (() => { const n = [-Math.sin(HOUT), Math.cos(HOUT)], c = off(NEST, HOUT, 110); return [[-340, 0], [340, 0]].map(([lat, back]) => off(c, HOUT, back, lat)); })();   // resting parallel, a body's width and more apart, the forager's place in the middle of them
    const FAN = [[.65, 480], [-.65, 480]];                                          // where the three stand to meet her: ahead of her, a fan, head to head within a head's turn (no body on another's)
    const V = (c, a, d) => off(c, TIN + a, d);
    function trailBuild(){
      reset(VIEW);
      const scout = A_('Forager', 'scout', off(NEST, HOUT, 110), HOUT, {seed:5});
      const mkRec = (name, at, seed) => { const m = A_(name, 'recruit', at, HOUT, {seed}); m.go('low'); return m; };
      const rA = mkRec('Nestmate A', WAIT[0], 8), rB = mkRec('Nestmate B', WAIT[1], 12);
      for(const m of [rA, rB]) m.allow(scout), scout.allow(m);
      ST.scout = scout; ST.recs = [rA, rB]; ST.laid = []; ST.fed = []; ST.maxMarks = 0;
      record('Forager', scout); ST.recs.forEach(m => record(m.name, m)); for(const [k, m] of [['A', rA], ['B', rB]]){ watchTouch('forager-' + k, scout, m); watchTouch(k + '-forager', m, scout); }
      hooks.push(() => { const l = liveMarks(); if(l.n > ST.maxMarks) ST.maxMarks = l.n; if(ST.laying){ const p = scout.ant.acid(), L = ST.laid; if(!L.length || dist(p, L[L.length - 1]) > 40) L.push(p); } });
      return {scout, rA, rB};
    }
    function* stepTo(m, at, h){ yield m.go('stand'); yield m.goto(at[0], at[1], {r:45, h}); }
    function* followOut(m, delay, station, o = {}){
      yield crew.wait(delay); m.watch(null); m.go('stand');
      if(o.side){ yield m.face(hOf([m.pose().x, m.pose().y], o.side), {tol:.2}); yield m.goto(o.side[0], o.side[1], {r:60, gait:'walk'}); }     // a step aside, off the way out, before turning to it
      yield m.face(HOUT, {tol:.15});
      ST['go' + m.name] = true; if(m.name === 'Nestmate B') ST.marksAtGo = liveMarks(); yield playC(m, 'trailFollow', {until:FOOD, r:540, maxT:42000, nearMax:o.nearMax, gap:o.gap}); ST['end' + m.name] = m.followEnd;
      { const p = m.pose(), a0 = hOf(FOOD, [p.x, p.y]), a1 = hOf(FOOD, station), am = a0 + wrapA(a1 - a0) / 2, mid = [FOOD[0] + Math.cos(am) * 700, FOOD[1] + Math.sin(am) * 700];   // round the others' places, not through them
        yield* route(m, [mid, station], {r:50, via:260, h:hOf(station, FOOD), turn:false}); }
      yield playC(m, 'lick', {for:3600, ph:m.name.length}); ST.fed.push(m);
    }
    function* trailGen(run){
      const {scout, rA, rB} = ST.p, stn = {S:rimAt(TIN - 1.25), A:rimAt(TIN + 1.15), B:rimAt(TIN - .05)};
      run.set('thinking'); yield 500;
      /* 1. the forager leaves the nest and searches along the way out */
      scout.c.play('headScan'); yield* route(scout, SEARCH, {r:60, via:240, turn:false}); scout.c.play('antennaFlick');
      yield scout.goto(STATION[0], STATION[1], {r:50, h:hOf(STATION, FOOD)});
      /* 2. she finds it: a crumb is taken at the heap's edge */
      run.set('acting'); yield 600; scout.c.play('grip', {crumb:true}); yield 1300; ST.taken = !!food.take();
      /* 3. home with it, laying the trail; two nestmates rise in the nest and go to meet her, ahead of her place, either side of the way */
      run.set('producing'); yield scout.face(hOf(STATION, RETURN[0]), {tol:.2}); ST.laying = true; scout.c.play('trailLay');
      const meet = [spawn(stepTo(rA, V(CPT, FAN[0][0], FAN[0][1]), TIN + FAN[0][0] + Math.PI)), spawn(stepTo(rB, V(CPT, FAN[1][0], FAN[1][1]), TIN + FAN[1][0] + Math.PI))];
      yield* route(scout, RETURN, {r:40, via:240, gait:'walk', h:TIN});
      yield allDone(meet);
      /* 4. antennal contact: the forager and the two touch each other's feelers (her head turns to each in turn) */
      run.set('acting'); ST.touchT = crew.t;
      yield [playC(scout, 'antennate', {who:rA, for:1200}), playC(rA, 'antennate', {who:scout, for:2600, ph:1}), playC(rB, 'antennate', {who:scout, for:2600, ph:2})];
      yield playC(scout, 'antennate', {who:rB, for:1200});
      scout.watch(null); for(const m of [scout, rA, rB]) m.clearAllowed();
      /* 5. they fall in: she lets her crumb go at the nest's edge, turns and sets out along the trail; the three turn to it behind her and follow it out, one behind the other (the one in the middle steps aside first) */
      end(scout, 'trailLay'); ST.laying = false; end(scout, 'grip');
      const thS = spawn(followOut(scout, 0, stn.S)), thA = spawn(followOut(rA, 4000, stn.A)), thB = spawn(followOut(rB, 6600, stn.B));
      run.set('waiting'); yield allDone([thA, thB, thS]);
      ST.marksAtFeed = liveMarks(); run.set('producing'); yield 7000; ST.marksAfter = liveMarks();
    }
    const trailCheck = (cr, run) => { const S = ST, laid = S.laid, notes = []; let ok = true;
      const reach = [...S.recs, S.scout].map(m => { const r = (S.rec[m.name] || []).filter(p => p[0] > S.touchT); const mind = r.length ? Math.min(...r.map(p => dist([p[1], p[2]], FOOD))) : 1e9; return {name:m.name, mind:Math.round(mind), reason:(S['end' + m.name] || {}).reason}; });
      for(const r of reach) if(!(r.mind < 700 && r.reason === 'found')){ ok = false; notes.push(r.name + ' did not reach the food by the trail (' + r.mind + ', ' + r.reason + ')'); }
      let dev = 0, n = 0, joined = 0; for(const m of S.recs){ const R = (S.rec[m.name] || []).filter(p => p[0] > S.touchT); let on = false; for(const p of R){ const q = [p[1], p[2]], dp = distToPath(q, laid); if(!on && dp < 200){ on = true; joined++; } if(!on || !p[3]) continue; dev = Math.max(dev, dp); n++; } }
      if(!(joined === S.recs.length && dev < 300 && n >= 8)){ ok = false; notes.push('followers did not keep to the trail: joined ' + joined + ' of ' + S.recs.length + ', off it by up to ' + Math.round(dev) + ' (' + n + ' samples)'); }
      const tch = S.touch || {}, tmax = Math.max(...Object.values(tch)); if(!(tmax < 160)){ ok = false; notes.push('feelers did not meet: ' + JSON.stringify(tch)); } notes.push('antennal contact at ' + Object.entries(tch).map(([k, v]) => k + ' ' + Math.round(v)).join(', '));
      const m1 = S.marksAtGo, m2 = S.marksAfter; if(!(m1 && m2 && m1.n > 15 && m2.s < .8 * m1.s)){ ok = false; notes.push('the trail was not alive for the last follower or did not fade'); }
      if(!bodyFails(notes)) ok = false;
      notes.unshift('followers: ' + reach.map(r => r.name + ' ' + r.mind + ' (' + r.reason + ')').join(', ') + '; max path deviation ' + Math.round(dev) + '; marks peak ' + S.maxMarks + ', strength ' + (m1 ? m1.s.toFixed(1) : '?') + ' (' + (m1 ? m1.n : '?') + ' marks) when the last set out, to ' + (m2 ? m2.s.toFixed(1) : '?') + ' at the end');
      return {ok, notes:notes.join('; ')}; };


    /* ============================================ THE MILL (the trail's failure) ============================================
       The same column, on a trail whose marks lead into a loop that closes on itself: the leader comes round to her own tail's marks and follows them, the others follow her, each lap reinforces the loop (the ants' own refresh,
       the Trail pad's reinforcement), and nothing in it leads to food. It lasts as long as the marks ahead are alive and the ants can walk; it ends when they tire. */
    const MC = [-480, -250], MR = 480;                                                       // the loop: 480 across the way round, so that four bodies lie along it with a gap between them
    function millBuild(){
      reset(VIEW_MILL);
      const A0_ = Math.PI * 1.25, pos0 = [0, 1, 2, 3].map(k => { const a = A0_ + k * Math.PI / 2; return {p:[MC[0] + Math.cos(a) * MR, MC[1] + Math.sin(a) * MR], h:a - Math.PI / 2}; });      // four ants on the loop, a quarter of it apart, all going round the same way
      const ants = pos0.map((q, i) => A_(['Leader', 'Follower 1', 'Follower 2', 'Follower 3'][i], i ? 'column' : 'lead', q.p, q.h, {seed:21 + i * 5}));
      for(const m of ants) m.allow(...ants.filter(o => o !== m));
      const A0 = ants[0].ant, put = (x, y, h) => A0.inject(x, y, h);
      for(let th = 0; th < 2 * Math.PI * 1.06; th += 12 / MR){ put(MC[0] + Math.cos(A0_ - th) * MR, MC[1] + Math.sin(A0_ - th) * MR, A0_ - th - Math.PI / 2); }       // the loop's marks, laid before: the column's own track
      ST.ants = ants; ants.forEach(m => record(m.name, m)); ST.turn = {}; ants.forEach(m => ST.turn[m.name] = {last:null, sum:0});
      hooks.push(() => { for(const m of ants){ const p = m.pose(), a = Math.atan2(p.y - MC[1], p.x - MC[0]), T = ST.turn[m.name]; if(dist([p.x, p.y], MC) < MR + 260 && T.last !== null) T.sum += wrapA(a - T.last); if(dist([p.x, p.y], MC) < MR + 260) T.last = a; } });
      return ants;
    }
    function* millGen(run){
      const ants = ST.ants; run.set('thinking'); yield 400;
      const ths = ants.map((m, i) => spawn((function*(){ yield crew.wait(i * 900); yield playC(m, 'trailFollow', {loop:true, tireAt:50000 - i * 900, maxT:70000, gap:600}); ST['end' + m.name] = m.followEnd; })()));
      run.set('acting'); yield () => Math.abs(ST.turn.Leader.sum) > 2 * Math.PI * 1.1; run.set('stalled'); run.note('the column has come round to its own trail: it circles'); ST.circledAt = crew.t;
      yield allDone(ths); ST.marksAtEnd = liveMarks();
      return 'stalled';   // nothing was produced and nothing led anywhere: the run ends in the state it truly reached, with the bodies stopped
    }
    const millCheck = () => { const S = ST, notes = []; let ok = true; const laps = S.ants.map(m => ({name:m.name, laps:+(Math.abs(S.turn[m.name].sum) / (2 * Math.PI)).toFixed(2), reason:(S['end' + m.name] || {}).reason, food:Math.round(Math.min(...(S.rec[m.name] || [[0, 1e9, 1e9]]).map(p => dist([p[1], p[2]], FOOD))))}));
      for(const l of laps){ if(l.laps < 1.5){ ok = false; notes.push(l.name + ' circled only ' + l.laps + ' laps'); } if(l.food < 350){ ok = false; notes.push(l.name + ' reached the food'); } }
      notes.unshift('laps: ' + laps.map(l => l.name + ' ' + l.laps + ' (' + l.reason + ')').join(', ') + '; nearest to the food ' + Math.min(...laps.map(l => l.food)) + '; live marks at the end ' + (S.marksAtEnd ? S.marksAtEnd.n : '?'));
      if(!bodyFails(notes)) ok = false;
      return {ok, notes:notes.join('; ')}; };

    /* ============================================ TEND ============================================
       Nurses on the brood in the chamber: two lick the larvae at the pile's edge, two pass food mouth to mouth. When the pile is disturbed they stop, read it with the feelers, and each takes a larva or a cocoon in her jaws and carries it
       to the deeper chamber, the load held at her mandible tips for as long as she walks. Thread contract: Start (the nurse is at a larva), Stay (the pile, the chamber), Count (the brood moved), Reach (the deeper chamber), Link (the jaws
       on the load; the mouths that pass the drop), Join (the jaws close on it), Change (the pile's brood goes to the other chamber), Failure (a load dropped or left: the carried count is checked). */
    const PILE = [TEND0[0] - 350, TEND0[1] - 100], PILE_R = 400, SHOCK = [TEND0[0] - 880, TEND0[1] - 520], HPS = hOf(PILE, SAFE);
    function tendBuild(){
      reset(VIEW_TEND); hooks.push(stepCarried);
      const R = rnd(77), items = [], order = Array.from({length:14}, (_, i) => i), pts = [];
      for(const k of order){ const a = k * 2.399 + .4, r = (k < 5 ? 105 : 250) * Math.sqrt((k < 5 ? k + .5 : k - 4) / (k < 5 ? 5 : 9.5)) + (k < 5 ? 0 : 60); pts.push([PILE[0] + Math.cos(a) * r, PILE[1] + Math.sin(a) * r]); }
      for(let it = 0; it < 80; it++) for(let i = 0; i < pts.length; i++) for(let j = i + 1; j < pts.length; j++){ const dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1], d = hyp(dx, dy) || 1, need = (i < 5 && j < 5) ? 190 : 175; if(d < need){ const m = (need - d) / 2; pts[i][0] -= dx / d * m; pts[i][1] -= dy / d * m; pts[j][0] += dx / d * m; pts[j][1] += dy / d * m; } }
      for(const k of order){ const [x, y] = pts[k], a = hOf(PILE, [x, y]), r = dist(PILE, [x, y]), pupa = k < 5; items.push({k, pupa, a, r, t:null, spec:[x, y, pupa ? a * 1.7 : a + Math.PI / 2 + (R() - .5) * 1.6]}); }
      for(const it of items.filter(i => i.pupa)) it.t = thing('pupa', it.spec[0], it.spec[1], it.spec[2], {});
      for(const it of items.filter(i => !i.pupa)) it.t = thing('larva', it.spec[0], it.spec[1], it.spec[2], {k:it.k});
      const outer = items.filter(i => !i.pupa);
      const near = ang => outer.reduce((b, q) => Math.abs(wrapA(q.a - ang)) < Math.abs(wrapA(b.a - ang)) ? q : b);
      const L1 = near(Math.PI + .2), L2 = near(Math.PI * .62);
      const stationAt = it => { const al = hOf(PILE, [it.t.x, it.t.y]); return [it.t.x + Math.cos(al) * 214, it.t.y + Math.sin(al) * 214, al + Math.PI]; };
      const nurses = [[L1, 'Nurse 1', 4], [L2, 'Nurse 2', 9]].map(([it, nm, seed]) => { const [x, y, h] = stationAt(it), m = A_(nm, 'nurse', [x, y], h, {seed}); m.licks = it; return m; });
      const g1 = A_('Feeder', 'nurse', [TEND0[0] + 190, TEND0[1] - 640], 0, {seed:19}), g2 = A_('Fed', 'nurse', [TEND0[0] + 190 + 436, TEND0[1] - 640], Math.PI, {seed:24});
      g1.allow(g2); g2.allow(g1); ST.exempt = new Set([g1.name + '|' + g2.name]); ST.mouthMin = 1e9; hooks.push(() => { if(running(g1, 'trophal') && running(g2, 'trophal')) ST.mouthMin = Math.min(ST.mouthMin, dist(g1.ant.tip(), g2.ant.tip())); });
      for(const m of nurses) m.watch(null);
      const taken = new Set([L1, L2]), pickAt = ang => { const it = items.filter(q => !taken.has(q)).reduce((b, q) => { const sc = Math.abs(wrapA(q.a - ang)) - .0015 * q.r; return !b || sc < b.sc ? {q, sc} : b; }, null).q; taken.add(it); return it; };
      ST.plan = {n1:[L1, pickAt(L1.a + 1.5)], n2:[L2, pickAt(L2.a - 1.5)], g1:[pickAt(-.4)], g2:[pickAt(1.15)]};
      ST.items = items; ST.nurses = nurses; ST.pair = [g1, g2]; ST.stationAt = stationAt; ST.safeIn = []; ST.carriedBy = {};
      [...nurses, g1, g2].forEach(m => record(m.name, m));
      /* the drops of the pair's mouth-to-mouth: a bead from the giver's jaws to the taker's, one after another */
      const drop = thing('drop', 0, 0, 0, {top:true}); drop.show(false); ST.dropN = 0;
      hooks.push(() => { if(!ST.feeding) { drop.show(false); return; } const ph = ((crew.t - ST.feeding) % 1700) / 1700; if(ph < .5){ const a = g1.ant.tip(), b = g2.ant.tip(), u = ph / .5; drop.x = a[0] + (b[0] - a[0]) * u; drop.y = a[1] + (b[1] - a[1]) * u; drop.t0 = 1; drop.s = .7 + .5 * Math.sin(Math.PI * u); drop.show(true); drop.dirty = true; if(!drop.cnt || drop.cnt !== Math.floor((crew.t - ST.feeding) / 1700) + 1){ drop.cnt = Math.floor((crew.t - ST.feeding) / 1700) + 1; ST.dropN++; } } else drop.show(false); });
      /* the disturbance: rings spreading from where the roof was touched, and the pile stirring */
      const ring = mk('g'); gTop.appendChild(ring); const rings = [0, 1, 2].map(() => path(ring, '', {fill:'none', stroke:COL.heapHi, 'stroke-width':6, 'stroke-dasharray':'3 16', 'stroke-linecap':'round', opacity:0}));
      hooks.push(() => { if(ST.shock === undefined) return; const u = (crew.t - ST.shock) / 1000; rings.forEach((r, i) => { const v = u - i * .35; if(v < 0 || v > 2.2){ r.setAttribute('opacity', 0); return; } r.setAttribute('d', ellD(SHOCK[0], SHOCK[1], 40 + v * 560, 40 + v * 560, 0, 36)); r.setAttribute('opacity', (.7 * (1 - v / 2.2)).toFixed(2)); });
        if(u < 2.4) for(const it of items){ if(it.t.hold) continue; const w = Math.sin(u * 13 + it.k) * .16 * Math.max(0, 1 - u / 2.4); it.t.a = it.spec[2] + w; it.t.x = it.spec[0] + Math.cos(u * 11 + it.k * 2) * 6 * Math.max(0, 1 - u / 2.4); it.t.dirty = true; } });
      return {nurses, g1, g2, items};
    }
    const SIDE = [-Math.sin(HPS), Math.cos(HPS)], MID = [(PILE[0] + SAFE[0]) / 2, (PILE[1] + SAFE[1]) / 2], IDLE = [[TEND0[0] + 330, TEND0[1] - 720], [TEND0[0] - 120, TEND0[1] - 740], [TEND0[0] + 780, TEND0[1] - 520], [TEND0[0] - 650, TEND0[1] - 680]];
    function* carryJob(m, after, plan, idle, wait2){ const trips = plan.length;
      if(after){ yield () => ST.picked && ST.picked[after.name]; yield crew.wait(after.gap ?? 2500); }              // each starts when the one before has her load in her jaws and is on her way
      for(let trip = 0; trip < trips; trip++){
        if(trip > 0 && wait2) yield () => ST.picked && ST.picked[wait2];                       // the second trip is not begun while another is still taking hers
        const it = plan[trip]; if(!it) break; it.taken = true; ST.carriedBy[it.k] = m.name;
        const [sx, sy, sh] = ST.stationAt(it); yield m.goto(sx, sy, {r:45, h:sh}); m.watch(null);
        m.c.play('grip', {effort:.4}); yield 750; pickUp(it.t, m, it.pupa ? 20 : 26); (ST.picked = ST.picked || {})[m.name] = crew.t; yield 350;
        const k = ST.carryingN++, slot = [SAFE[0] + 120 * Math.cos(k * 2.4 + 2.3) * Math.sqrt(k + 1) * .85, SAFE[1] + 120 * Math.sin(k * 2.4 + 2.3) * Math.sqrt(k + 1) * .85], hd = hOf(MID, slot), dst = [slot[0] - Math.cos(hd) * 214, slot[1] - Math.sin(hd) * 214];
        yield* route(m, [[MID[0] + SIDE[0] * 240, MID[1] + SIDE[1] * 240], dst], {r:50, h:hd, via:200});
        end(m, 'grip'); yield 700; putDown(it.t); it.safe = true; ST.safeIn.push(it); yield 400;
        const back = [MID[0] - SIDE[0] * 240, MID[1] - SIDE[1] * 240];
        yield* route(m, trip < trips - 1 ? [back, [PILE[0] + 600 * Math.cos(HPS + 1.2), PILE[1] + 600 * Math.sin(HPS + 1.2)]] : [back, IDLE[idle]], {r:90, via:240, gait:'walk', h:trip < trips - 1 ? undefined : hOf(IDLE[idle], PILE)});
      }
    }
    function* tendGen(run){
      const {nurses, g1, g2} = ST.p; run.set('thinking'); yield 600;
      /* 1. at the brood: two lick the larvae, two pass food mouth to mouth */
      run.set('acting'); nurses.forEach((m, i) => m.c.play('lick', {for:1e9, ph:i * 2}));
      g1.watch(g2); g2.watch(g1); yield [playC(g1, 'antennate', {who:g2, for:1500}), playC(g2, 'antennate', {who:g1, for:1500, ph:1})];
      g1.c.play('trophal', {role:'give', who:g2, for:1e9}); g2.c.play('trophal', {role:'take', who:g1, for:1e9, ph:1}); ST.feeding = crew.t;
      run.set('producing'); yield 6000; ST.licked = nurses.map(m => ({name:m.name, d:Math.round(dist(m.ant.tip(), [m.licks.t.x, m.licks.t.y]))}));
      /* 2. the pile is disturbed */
      run.set('acting'); ST.shock = crew.t; run.note('the pile is disturbed'); const all = [...nurses, g1, g2];
      for(const m of all){ end(m, 'lick'); end(m, 'trophal'); } ST.feeding = 0; g1.watch(null); g2.watch(null);
      yield 500; yield all.map(m => playC(m, 'alert', {for:1500}));
      /* 3. each takes a larva or a cocoon to the deeper chamber */
      ST.carryingN = 0; const P_ = ST.plan, jobs = [spawn(carryJob(nurses[0], null, P_.n1, 3, 'Fed')), spawn(carryJob(nurses[1], nurses[0], P_.n2.slice(0, 1), 1)), spawn(carryJob(g1, nurses[1], P_.g1, 0)), spawn(carryJob(g2, g1, P_.g2, 2))];
      run.set('waiting'); yield allDone(jobs); run.set('producing'); yield 1500;
    }
    const tendCheck = () => { const S = ST, notes = []; let ok = true;
      if(!S.licked || S.licked.some(l => l.d > 140)){ ok = false; notes.push('a nurse was not at her larva: ' + JSON.stringify(S.licked)); }
      if(S.dropN < 3){ ok = false; notes.push('only ' + S.dropN + ' drops passed'); }
      if(!(S.mouthMin < 120)){ ok = false; notes.push('the two mouths were never together (' + Math.round(S.mouthMin) + ')'); }
      const inSafe = S.items.filter(i => dist([i.t.x, i.t.y], SAFE) < 420).length; if(inSafe < 5){ ok = false; notes.push('only ' + inSafe + ' of the brood reached the deeper chamber'); }
      if(S.items.some(i => i.t.hold)){ ok = false; notes.push('a load is still held'); }
      const sep = Math.max(...S.items.filter(i => i.t.sepMax !== undefined).map(i => i.t.sepMax)), ps = Math.max(...(S.pickSep || [0])); if(!(sep < 20)){ ok = false; notes.push('a load strayed from its carrier\'s jaws by ' + Math.round(sep)); }
      if(!bodyFails(notes)) ok = false;
      const by = Object.values(S.carriedBy).reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {});
      notes.unshift('licking at ' + S.licked.map(l => l.d).join('/') + ' from the larva; mouths ' + Math.round(S.mouthMin) + ' apart while feeding; ' + S.dropN + ' drops passed; ' + inSafe + ' of 14 in the deeper chamber, carried by ' + JSON.stringify(by) + '; widest hold ' + Math.round(sep) + ', widest pick-up reach ' + ps);
      return {ok, notes:notes.join('; ')}; };

    /* ============================================ CLEAR ============================================
       Undertakers. A nestmate lies dead on the floor by the nest: a whole ant, in a lying-dead pose (the legs drawn up and curled, the feelers fallen, the jaws slack). The undertakers come to it and touch it with their feelers (the test:
       the cue is chemical, the scene's 'dead' is a state of its body that the touch reads), one takes it in her jaws and carries it to the midden, and the others go back. The carried body follows her jaws, held at its middle across her path.
       The variant is the test's failure: a living ant painted with the cue is touched, taken and carried out too, struggling; set down she walks home. Thread contract: Start (a body on the floor), Stay (the midden), Count (one body moved),
       Reach (the midden), Link (feelers on the body; jaws on it), Join (the jaws close), Change (the floor is cleared), Failure (the painted live ant). */
    const CORPSE = [-260, -120], MID_DROP = [MIDDEN[0] - 220, MIDDEN[1] - 90];
    const memberThing = m => { const p = m.pose(); return {member:m, x:p.x, y:p.y, a:p.h, hold:null, dirty:false, draw(){}, g:{style:{}}}; };
    function clearBuild(live){
      reset(VIEW_CLEAR);
      const hc = .85, cp = live ? [CORPSE[0] + 60, CORPSE[1] - 20] : CORPSE;
      const body = A_(live ? 'Painted nestmate' : 'Dead nestmate', live ? 'painted' : 'dead', cp, hc, {seed:30, z:0, life:false, palette:live ? undefined : {ink:'#8e9196'}});   // a dead body is paler and colder than the living: the colour has gone out of it
      body.dead = !live; if(!live){ body.go('low'); body.c.play('limp'); } else body.go('stand');
      const st = (a, d) => [cp[0] + Math.cos(hc + a) * d, cp[1] + Math.sin(hc + a) * d];
      const u1 = A_('Undertaker 1', 'undertaker', [-560, 40], -.5, {seed:5}), u2 = A_('Undertaker 2', 'undertaker', [-800, 300], -.7, {seed:9});
      const ctl = live ? A_('Nestmate', 'clean', [-950, -480], .93, {seed:36, z:0}) : null;      // she stands west of the target, so the meeting with the first undertaker is half a pane from the painted ant
      body.allow(u1, u2), u1.allow(body), u2.allow(body);     // they may touch the body, not each other: the host keeps them apart
      if(ctl){ ctl.allow(u1); u1.allow(ctl); }
      ST.exempt = new Set([...[u1, u2].map(u => u.name + '|' + body.name), ...(ctl ? [u1.name + '|' + ctl.name] : [])]);   // what they touch on purpose is not a stack
      const bt = memberThing(body); ST.body = body; ST.bt = bt; ST.live = live; ST.u = [u1, u2]; ST.ctl = ctl; ST.cp = cp; ST.hc = hc;
      [body, u1, u2, ctl].filter(Boolean).forEach(m => record(m.name, m)); for(const [k, u] of [['u1', u1], ['u2', u2]]) watchTouch(k + '-body', u, body, feelOnBody); if(ctl) watchTouch('u1-clean', u1, ctl, feelOnBody);
      hooks.push(stepCarried);
      if(!live){  // the cue of death, made visible: a faint dotted halo of the accent round the body (a scent is not seen; the trail's amber is its one drawn form)
        const halo = mk('g'); path(halo, ellD(-20, 0, 330, 200, 0, 28), {fill:'none', stroke:COL.accent, 'stroke-width':6, 'stroke-dasharray':'2 18', 'stroke-linecap':'round', 'stroke-opacity':.55}); const t = thing('cue', 0, 0, 0, {g:halo});
        ST.halo = t; hooks.push(() => { const q = body.ant.part('body', 0, 0); t.x = q[0]; t.y = q[1]; t.a = body.pose().h; t.show(true); t.dirty = true; });
      }
      if(live){   // the paint: a dab of the cue on her back, carried with her
        const dot = mk('g'); path(dot, ellD(0, 0, 30, 24, 0, 14), {fill:COL.accent, 'fill-opacity':.55, stroke:COL.accent, 'stroke-width':3, 'stroke-opacity':.9}); const t = thing('paint', 0, 0, 0, {g:dot, top:true});
        hooks.push(() => { const q = body.ant.part('body', 14, 0); t.x = q[0]; t.y = q[1]; t.a = body.pose().h; t.dirty = true; });
      }
      return {body, u1, u2, ctl};
    }
    function* clearGen(run){
      const {body, u1, u2, ctl} = ST.p, live = ST.live, cp = ST.cp, hc = ST.hc, at = (a, d) => [cp[0] + Math.cos(hc + a) * d, cp[1] + Math.sin(hc + a) * d];
      run.set('thinking'); yield 500; run.set('acting');
      /* 1. they come to it, each to the place round it that is nearest her (a flank, the other flank, the tail end), and touch it with their feelers */
      const stations = [{p:at(Math.PI / 2, 400), h:hc - Math.PI / 2}, {p:at(-Math.PI / 2, 400), h:hc + Math.PI / 2}], ants = [u1, u2];   // they feel it with their antennae from a little way off; the one at the flank steps in to take it
      const test = function*(m, st, delay, dur){ yield crew.wait(delay); yield m.goto(st.p[0], st.p[1], {r:40, h:st.h}); m.watch(body); yield playC(m, 'antennate', {who:body, for:dur, ph:delay}); };
      if(live){                       // the first meets a clean nestmate on the way, touches her, finds nothing, and lets her go
        const cs = [ctl.pose().x, ctl.pose().y], hcl = hOf([u1.pose().x, u1.pose().y], cs);
        const stc = [cs[0] - Math.cos(hcl) * 440, cs[1] - Math.sin(hcl) * 440];
        yield u1.goto(stc[0], stc[1], {r:40, h:hcl}); u1.watch(ctl); ctl.watch(u1); yield [playC(u1, 'antennate', {who:ctl, for:2000}), playC(ctl, 'antennate', {who:u1, for:2000, ph:1})]; ST.ctlTouched = crew.t; u1.watch(null); ctl.watch(null); ctl.clearAllowed(); u1.clearAllowed(); u1.allow(body);
        spawn((function*(){ yield ctl.goto(-430, -830, {r:150}); })());
      }
      const perms = [[0, 1], [1, 0]], cost = pm => ants.reduce((sum, m, i) => sum + dist([m.pose().x, m.pose().y], stations[pm[i]].p), 0), pm = perms.reduce((b, q) => !b || cost(q) < cost(b) ? q : b, null);
      const order = ants.map((m, i) => i).sort((i, j) => dist([ants[i].pose().x, ants[i].pose().y], stations[pm[i]].p) - dist([ants[j].pose().x, ants[j].pose().y], stations[pm[j]].p));
      const carrier = ants[pm.indexOf(0)], others = ants.filter(m => m !== carrier);
      const ths = ants.map((m, i) => spawn(test(m, stations[pm[i]], order.indexOf(i) * 900, 2600 - order.indexOf(i) * 300)));
      yield allDone(ths); ST.tested = crew.t;
      /* 2. the one at the flank takes it in her jaws */
      for(const m of ants) m.watch(null);
      { const near = at(Math.PI / 2, 285); yield carrier.goto(near[0], near[1], {r:30, h:hc - Math.PI / 2}); }
      carrier.c.play('grip', {effort:.5}); yield 750; pickUp(ST.bt, carrier, 46, Math.PI / 2); /* the jaws on the near flank of the body, which lies across her path */ body.held = true; ST.carrier = carrier; if(live){ body.c.play('struggle'); body.go('creep'); } yield 400;
      run.set('producing'); const hd = hOf(cp, MID_DROP), dst = [MID_DROP[0] - Math.cos(hd) * 214, MID_DROP[1] - Math.sin(hd) * 214];
      /* the others go back toward the nest, each to a place of her own */
      for(const [m, p] of [[others[0], [-900, -330]]]) spawn((function*(){ yield m.goto(p[0], p[1], {r:100, gait:'walk'}); m.watch(null); })());
      yield carrier.face(hd, {tol:.3}); yield* route(carrier, [dst], {r:50, h:hd, via:200, turn:false});
      /* 3. she puts it down on the midden and goes home */
      end(carrier, 'grip'); yield 700; putDown(ST.bt); body.held = false; ST.dropped = crew.t; if(live){ end(body, 'struggle'); body.c.go('stand'); }
      yield 500; run.set('acting');
      if(live){ spawn((function*(){ yield 1200; yield body.goto(CORPSE[0] - 520, CORPSE[1] + 60, {r:100, gait:'walk'}); ST.walkedHome = crew.t; })()); }
      yield carrier.goto(live ? 380 : MIDDEN[0] - 700, live ? -380 : MIDDEN[1] - 450, {r:100, gait:'walk'}); carrier.c.play('groom'); yield 1200;
      if(live) yield () => ST.walkedHome; run.set('waiting'); yield 2500;
      if(live) return 'failed';   // the thread's purpose was to clear what is dead: it cleared a living ant. Every body did what it does; the test did not tell them apart.
    }
    const clearCheck = () => { const S = ST, notes = []; let ok = true, b = S.body, p = b.pose(); const dm = dist([p.x, p.y], MIDDEN), moved = dist([p.x, p.y], S.cp);
      if(!S.live){ if(!(dm < 330)){ ok = false; notes.push('the body did not reach the midden (' + Math.round(dm) + ')'); } }
      else { const home = dist([p.x, p.y], [CORPSE[0] - 520, CORPSE[1] + 60]); if(!(S.walkedHome && home < 250)){ ok = false; notes.push('the painted ant did not walk home (' + Math.round(home) + ')'); } if(!S.ctlTouched){ ok = false; notes.push('the clean nestmate was not touched'); } const mm = Math.max(...(S.rec[b.name] || [[0, 0, 0]]).map(q => dist([q[1], q[2]], MIDDEN))); const mind = Math.min(...(S.rec[b.name] || [[0, 1e9, 1e9]]).map(q => dist([q[1], q[2]], MIDDEN))); if(!(mind < 330)){ ok = false; notes.push('the painted ant was not carried to the midden (' + Math.round(mind) + ')'); } }
      const sep = S.bt.sepMax; if(!(sep === undefined || sep < 20)){ ok = false; notes.push('the body strayed from the jaws by ' + Math.round(sep)); }
      if(!S.carrier || S.bt.hold){ ok = false; notes.push('nobody carried it, or it is still held'); }
      if(S.tested === undefined){ ok = false; notes.push('no test was made'); }
      const tch = S.touch || {}; for(const [k, v] of Object.entries(tch)) if(!(v < 150)){ ok = false; notes.push('feelers never reached the body (' + k + ' ' + Math.round(v) + ')'); }
      if(!bodyFails(notes)) ok = false;
      notes.push('feelers on the body: ' + Object.entries(tch).map(([k, v]) => k + ' ' + Math.round(v)).join(', '));
      notes.unshift((S.live ? 'painted live ant: carried to the midden, then walked home' : 'dead nestmate carried to the midden: ' + Math.round(dm) + ' from its middle') + '; moved ' + Math.round(moved) + '; widest hold ' + Math.round(sep || 0) + ' (tested at ' + (S.tested / 1000).toFixed(1) + ' s)');
      return {ok, notes:notes.join('; ')}; };

    /* ============================================ HAUL ============================================
       A load too heavy for one: a dead caterpillar, 1100 units long. Four ants take it between them, two beside its head end and two beside its tail end, their jaws on its flanks, their heads turned in, all facing the way home.
       Nothing moves it but what they do. Each pushes along the way she faces (her gait is her thrust); the load stays put until their pulls add to more than it resists, turns with the moment of the pulls, and goes where they sum to.
       One ant at a time knows the way (her pull is true; the others' are a little off and wander) and the lead passes from one to the next, so the load's path bends at each change. Each holder is drawn along by what she grips, and her legs
       work against the ground in the measure that it is not moving. The failure is the tug of war: two of them pull the other way, the sums cancel, and the legs scrabble on a load that does not move.
       Thread contract: Start (a load too heavy for one), Stay (the load, the grips), Count (four), Reach (the nest), Link (jaws on its flanks, the moment of the pulls), Join (each takes a place and grips), Change (the lead passes), Failure (deadlock). */
    const SEED0 = [900, 40], HALF = 550, GRIP = [[500, -150, 'A'], [500, 150, 'B'], [-500, -150, 'C'], [-500, 150, 'D']];       // where each takes hold, in the load's frame: along it (+ toward its head), across it (- on its left)
    const V_GAIT = 151;
    const caterpillarG = () => { const g = mk('g'), N = 11, segs = [];
      for(let i = 0; i < N; i++){ const u = i / (N - 1); segs.push([470 - u * 940, 112 + 36 * Math.sin(Math.PI * Math.min(1, u * 1.1 + .05)) - 12 * u]); }
      for(const [x, ry] of segs.slice().reverse()) path(g, ellD(x + 26, 28, 74, ry, 0, 20), {fill:COL.shade, 'fill-opacity':.3});
      for(const [x, ry] of segs.slice().reverse()){ path(g, ellD(x, 0, 72, ry, 0, 20), {fill:COL.larva, stroke:COL.larvaLine, 'stroke-width':4, 'stroke-opacity':.85});
        path(g, 'M' + f1(x - 16) + ' ' + f1(-ry * .55) + 'q14 -10 30 0M' + f1(x - 16) + ' ' + f1(ry * .55) + 'q14 10 30 0', {fill:'none', stroke:COL.larvaLine, 'stroke-width':3, 'stroke-opacity':.5, 'stroke-linecap':'round'}); }
      path(g, 'M-480 0H430', {fill:'none', stroke:COL.larvaLine, 'stroke-width':3, 'stroke-opacity':.4, 'stroke-dasharray':'2 22', 'stroke-linecap':'round'});
      const hx = 556; path(g, ellD(hx, 0, 62, 68, 0, 18), {fill:COL.larva, stroke:COL.larvaLine, 'stroke-width':4.5, 'stroke-opacity':.9}); path(g, ellD(hx + 22, -28, 10, 10, 0, 8) + ellD(hx + 22, 28, 10, 10, 0, 8), {fill:COL.larvaLine, 'fill-opacity':.7});
      path(g, 'M' + f1(hx + 50) + ' -16q26 -6 34 8M' + f1(hx + 50) + ' 16q26 6 34 -8', {fill:'none', stroke:COL.larvaLine, 'stroke-width':4, 'stroke-linecap':'round'});
      for(const [x, ry] of segs.slice(0, 3)) for(const s_ of [-1, 1]) path(g, 'M' + f1(x + 10) + ' ' + f1(s_ * (ry - 6)) + 'l14 ' + f1(s_ * 34), {fill:'none', stroke:COL.larvaLine, 'stroke-width':4, 'stroke-linecap':'round', 'stroke-opacity':.8});
      return g; };
    const rotp = (a, x, y) => [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
    function haulBuild(dead){
      reset(VIEW); ST.noSep = true; ST.stackD = dead ? 20 : STACK_D; hooks.push(stepCarried);
      const th = hOf(SEED0, LIP), load = {x:SEED0[0], y:SEED0[1], a:th, v:[0, 0], w:0, hold:[], state:'wait', lead:0, leadAt:0, g:caterpillarG(), pull:[0, 0], tq:0};
      const T = thing('seed', load.x, load.y, load.a, {g:load.g}); load.t = T; ST.load = load; ST.dead = dead; ST.leads = [0];
      /* the camera goes with the load: the whole formation (1600 units along the load, 900 across) stays in the pane, the ants larger than the whole habitat's view gives */
      crew.follow(() => ({x:load.x - Math.cos(load.a) * 165, y:load.y - Math.sin(load.a) * 165, s:Math.min(crew.W, crew.H) / 2100})); crew.snapCam();
      const ants = GRIP.map(([ax, ay, nm], i) => { const back = dead && ax < 0, hd = th + (back ? Math.PI : 0), cx = ax + (back ? 1 : -1) * 211, cy = ay + (ay < 0 ? -53 : 53), c = rotp(th, cx, cy), at = [load.x + c[0], load.y + c[1]];
        const q = rotp(th, ...[[60, -620], [60, 620], [-780, -560], [-780, 560]][i]), from = [load.x + q[0], load.y + q[1]];
        const m = A_('Carrier ' + nm, 'carrier', from, hOf(from, at), {seed:40 + i * 6}); m.slot = {ax, ay, hd, at, turn:(ay < 0 ? 1 : -1) * (back ? -1 : 1) * .66, back}; m.nm = nm; return m; });
      ST.ants = ants; ants.forEach(m => record(m.name, m)); ST.resid = 0; ST.t0 = 0;
      for(const m of ants) m.allow(...ants.filter(o => o !== m));
      load.hold = ants.map(m => ({m, ax:m.slot.ax, ay:m.slot.ay, on:0}));
      hooks.push(dt => haulPhysics(load, dt / 1000));
      return ants;
    }
    /* the load's own mechanics, once a frame, after the bodies have moved */
    function haulPhysics(L, dt){
      const T = L.t; T.dirty = true;
      if(L.state === 'wait' || L.state === 'done'){ L.v = [0, 0]; L.w = 0; for(const h of L.hold){ h.m.drag = 1; } return; }
      let Fx = 0, Fy = 0, tq = 0, n = 0;
      for(const h of L.hold){ const c = h.m.c, p = h.m.pose(), on = c.gs.on && c.gs.phase !== 'stop' && c.gait ? Math.min(1, c.gs.k ?? 1) : 0; h.on = on; const fx = Math.cos(p.h) * on, fy = Math.sin(p.h) * on, r = rotp(L.a, h.ax, h.ay); Fx += fx; Fy += fy; tq += (r[0] * fy - r[1] * fx) / 150; n++; }
      const Fm = Math.hypot(Fx, Fy), MU = 1.05, VMAX = 85, k = 1 - Math.exp(-dt / .35);
      const tv = Fm > MU ? [Fx / Fm * VMAX * Math.min(1, (Fm - MU) / (n - MU)), Fy / Fm * VMAX * Math.min(1, (Fm - MU) / (n - MU))] : [0, 0];
      L.v[0] += (tv[0] - L.v[0]) * k; L.v[1] += (tv[1] - L.v[1]) * k; L.pull = [Fx, Fy]; L.tq = tq;
      const sp = Math.hypot(L.v[0], L.v[1]); let tw = Math.abs(tq) > 1.1 ? Math.max(-.3, Math.min(.3, .4 * (tq - Math.sign(tq) * 1.1))) : 0;
      if(sp > 25){ const dirA = Math.atan2(L.v[1], L.v[0]); tw += .8 * wrapA(dirA - L.a) * Math.min(1, sp / 70); }     // a thing drawn along trails its tail: its axis comes round to the way it is going
      L.w += (Math.max(-.45, Math.min(.45, tw)) - L.w) * k;
      L.x += L.v[0] * dt; L.y += L.v[1] * dt; L.a += L.w * dt; T.x = L.x; T.y = L.y; T.a = L.a;
      for(const h of L.hold){ const m = h.m, g = rotp(L.a, h.ax, h.ay), G = [L.x + g[0], L.y + g[1]], tip = m.ant.tip(), e = [G[0] - tip[0], G[1] - tip[1]], el = Math.hypot(e[0], e[1]);
        ST.resid = Math.max(ST.resid, el); const s = Math.min(1, 9 / (el || 1)) * .55; m.nudge = [e[0] * s, e[1] * s];
        const p = m.pose(); m.drag = Math.max(0, Math.min(1, (L.v[0] * Math.cos(p.h) + L.v[1] * Math.sin(p.h)) / V_GAIT)); h.el = el; }
    }
    function* haulGen(run){
      const L = ST.load, ants = ST.ants, dead = ST.dead, lip = LIP;
      run.set('thinking'); yield 600; run.set('acting');
      /* 1. they come to it from the two sides and touch it; each takes a place along its flanks and closes her jaws on it */
      const arrive = ants.map(m => spawn((function*(){ yield m.goto(m.slot.at[0], m.slot.at[1], {r:45, h:m.slot.hd}); m.watch(null); yield playC(m, 'antennate', {pt:[L.x, L.y], for:1300, ph:m.nm.charCodeAt(0)}); m.c.play('grip', {effort:.3, turn:m.slot.turn}); yield 1300; })()));
      yield allDone(arrive); ST.gripped = crew.t; L.state = 'haul'; L.leadAt = crew.t; run.note('four holders: the load is held');
      for(const m of ants) Object.assign(m.gaits, {far:'carryWalk', near:'carryWalk', fast:'carryWalk'});
      /* 2. they pull. Steering is by who pulls: the lead's pull is true, the others' wander; the lead passes on */
      const ORDER = dead ? [0] : [0, 2, 1, 3];
      ST.moveFrom = [L.x, L.y]; ST.pathLen = 0; let last = [L.x, L.y];
      hooks.push(() => { ST.pathLen += hyp(L.x - last[0], L.y - last[1]); last = [L.x, L.y]; if(L.state === 'haul'){ const d = distToPath([L.x, L.y], [SEED0, lip]); ST.devMax = Math.max(ST.devMax || 0, d); } });
      if(!dead) run.set('producing'); else run.set('acting');
      const release = () => { L.state = 'done'; for(const m of ants){ const pad = m.c.pad.steer; pad.L[0] = pad.R[0] = 0; m.drag = 1; m.nudge = null; m.c.go('stand'); end(m, 'grip'); } };
      const steer = dt => { if(L.state !== 'haul') return; if(!crew.run_ || crew.run_.cancelled){ release(); return; }   // Stop lets go
        const t = (crew.t - L.leadAt) / 1000; if(!dead && t > 3.6){ L.lead = (L.lead + 1) % 4; L.leadAt = crew.t; ST.leads.push(ORDER[L.lead] ?? L.lead); }
        const brg = hOf([L.x, L.y], lip);
        ants.forEach((m, i) => { const lead = (ORDER[L.lead] ?? 0) === i, bias = dead ? 0 : lead ? 0 : 1.0 * Math.sin(crew.t * .0007 + i * 2.1) + .2 * (i - 1.5), base = dead && m.slot.back ? Math.PI : 0, psi = L.a + base + Math.max(-.3, Math.min(.3, wrapA(brg + bias - L.a))), p = m.pose(), err = wrapA(psi - p.h), v = Math.max(-1, Math.min(1, 2.2 * err)), pad = m.c.pad.steer; pad.L[0] = pad.R[0] = v; if(!m.c.gs.on) m.c.go('carryWalk'); }); };
      hooks.push(steer);
      if(!dead){
        yield () => dist([L.x, L.y], lip) < 650; ST.arrived = crew.t;
        /* 3. she lets go; it stays where it was left */
        release(); run.set('waiting'); yield 2200; run.set('producing'); yield 800;
      } else {
        /* the pulls cancel: nothing moves, the legs scrabble. The run is stalled, and ends so, with the four still at it (the Stop button lets them go). */
        yield 3500; run.set('stalled'); run.note('the pulls cancel: the load does not move'); yield 10500; ST.stalledFor = crew.t - ST.gripped;
        return 'stalled';
      }
    }
    const haulCheck = () => { const S = ST, L = S.load, notes = []; let ok = true, moved = dist([L.x, L.y], SEED0), nest = dist([L.x, L.y], LIP);
      const hold = Math.round(S.resid); const leads = new Set(S.leads).size;
      if(!S.dead){ if(!(nest < 700)){ ok = false; notes.push('the load did not reach the nest (' + Math.round(nest) + ' from the lip)'); } if(!(moved > 700)){ ok = false; notes.push('it moved only ' + Math.round(moved)); } if(leads < 3){ ok = false; notes.push('the lead passed only ' + leads + ' times'); } if(!(S.devMax > 25)){ ok = false; notes.push('the path never bent (' + Math.round(S.devMax || 0) + ')'); } }
      else { if(!(moved < 140)){ ok = false; notes.push('the load moved ' + Math.round(moved) + ' in the tug of war'); } }
      if(!(hold < 150)){ ok = false; notes.push('a holder was drawn ' + hold + ' from her grip'); }
      if(!bodyFails(notes)) ok = false;
      notes.unshift(S.dead ? 'tug of war: the load moved ' + Math.round(moved) + ' in ' + ((S.stalledFor || 0) / 1000).toFixed(0) + ' s with all four walking; widest grip drift ' + hold : 'hauled ' + Math.round(moved) + ' (path ' + Math.round(S.pathLen) + ') to ' + Math.round(nest) + ' from the lip; the lead passed through ' + leads + ' of four; the path bent ' + Math.round(S.devMax || 0) + ' off the straight line; widest grip drift ' + hold);
      return {ok, notes:notes.join('; ')}; };

    const patterns = [
      {id:'trail', label:'Trail', note:'a forager finds the food and walks home laying the trail; the two nestmates she meets feel her with their antennae, fall in behind her and follow it out in a column, reinforcing it; it fades when it is no longer walked', run:run => { const p = trailBuild(); ST.p = p; return trailGen(run); }, maxMs:110000, check:trailCheck},
      {id:'mill', label:'Trail: the mill', note:'the failure: the column follows a trail that closes on itself, reinforcing it at every lap, and goes round until it tires; nothing in the loop leads to food. The run ends stalled', run:run => { const a = millBuild(); ST.ants = a; return millGen(run); }, maxMs:110000, expect:'stalled', check:millCheck},
      {id:'tend', label:'Tend', note:'nurses on the brood: two lick the larvae, two pass food mouth to mouth; when the pile is disturbed each takes a larva or a cocoon in her jaws to the deeper chamber', run:run => { const p = tendBuild(); ST.p = p; return tendGen(run); }, maxMs:110000, check:tendCheck},
      {id:'clear', label:'Clear', note:'undertakers: a dead nestmate lies on the floor; they touch it with their feelers from either side, one takes it in her jaws to the midden and the other goes back', run:run => { const p = clearBuild(false); ST.p = p; return clearGen(run); }, maxMs:90000, check:clearCheck},
      {id:'painted', label:'Clear: the painted ant', note:'the failure of the test: a living ant painted with the cue of death is touched, taken and carried out too, struggling; set down on the midden she walks home. The run ends failed', run:run => { const p = clearBuild(true); ST.p = p; return clearGen(run); }, maxMs:110000, expect:'failed', check:clearCheck},
      {id:'haul', label:'Haul', note:'four ants take a load too heavy for one between them, jaws on its flanks; it goes where their pulls sum to; one knows the way at a time and the lead passes on', run:run => { const a = haulBuild(false); ST.ants = a; return haulGen(run); }, maxMs:100000, check:haulCheck},
      {id:'deadlock', label:'Haul: the tug of war', note:'the failure: two of the four pull the other way; the sums cancel and the legs scrabble on a load that does not move. The run ends stalled, the four still at it', run:run => { const a = haulBuild(true); ST.ants = a; return haulGen(run); }, maxMs:60000, expect:'stalled', check:haulCheck},
    ];
    window.ANTCREW.state = () => ST;
    /* the page at rest: the trail's cast standing in the nest */
    trailBuild(); dropMember(m0);
    return {patterns};
  }});

})();
