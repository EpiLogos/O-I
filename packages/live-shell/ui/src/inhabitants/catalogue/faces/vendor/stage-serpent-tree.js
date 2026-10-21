/* stage-serpent-tree.js — the serpent and the tree: the agency SDK's first worked example (CREATURE-SPEC.md sections 20 and 25). A recorded run's
   events (tools/runs/*.json, O-I's own vocabulary; tools/record-run.mjs makes them from a real session) drive both, through environ-kit.js's run:
   the serpent shows the agent's act and the tree the process's course. Four signals read at a glance: where the serpent is (its progress: the roots,
   up the trunk, the crown), its posture (its activity), the fruit and their ripeness (the products), and breath (only while check-ins arrive).

   One engine each, nothing new: the serpent is the roster serpent (creature-serpent.js's definition on creature-body.js) with one state added, the
   course it holds on the tree (creature-body.js 2.1.0: a body follows a laid course in three dimensions); the tree is the apple tree (environ-tree.js
   on creature-kit.js) in the same view, so the serpent winds round its trunk, the back of each turn hidden by the trunk's silhouette, and the leaves
   nearer than it in the crown are drawn over it (a second kit figure of the same tree).

   Rules (spec 25.2): no action without an event (the serpent's own life is off; every movement is caused by something in the run); the idle stays
   still; reduced motion means posture changes only (no breath, flick or sway; the serpent is placed, not crawled).

   The tree's year is the third thing the run drives, and its targets too are set only in take(): the reads draw the seedling out, the first write
   brings the trunk to its full height, a return brings out the course's own limb, and the run's end lets the year finish. The tree paces its own
   growth toward those targets (environ-tree.js setYear); when the serpent is asked to climb before the wood it needs is out, it waits where it is
   (a held climb, released by step() when the year has caught up). At the end the tree finishes its year — leaves down, the last apples fallen — for
   twelve seconds of animation before the stage is done. A failed run takes die-back: the shoots shorten, the leaves and wood grey, the year holds
   where it was, and every apple that was hanging comes down.

   Two clocks: the run's (the recording's own times, played at `speed` run-ms a real ms, with long gaps shortened to `gapCap`, as the DLW's Stretched
   time scale shortens deep time: the shortening is shown) and the animation's (real time: the serpent moves at its own pace whatever the speed). A
   stall freezes the serpent's clock: it stops where it is and does not breathe.

   StageSerpentTree.mount(el, {run, speed, gapCap, reduced, size}) returns the stage; StageSerpentTree.page() builds the page in the creature shell. */
(() => {
'use strict';
const EK = window.EnvironKit, ET = window.EnvironTree, BD = window.CreatureBody, K = window.CreatureKit, SD = window.SERPENT_DEF;
const TREE = ET.generate({seed:11});
const COURSE = ET.course(TREE, {dir:-1, a0:2.3, pitch:280});
/* the stage's view, in the continuous body's screen units (x = X, y = Y sin P - Z cos P): the tree's extent and the ground in front of it */
const VIEW = (() => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const see = p => { const s = ET.proj(p); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); };
  for(const b of TREE.B) for(const p of b.pts) see(p); for(const L of TREE.leaves) see(L.pet); see([0, 520, 0]); see([-560, 0, 0]); see([560, 0, 0]);
  return [Math.round(x0 - 70), Math.round(y0 - 70), Math.round(x1 - x0 + 140), Math.round(y1 - y0 + 120)]; })();
/* which parts of the tree are drawn over the serpent: those nearer the viewer than its course in the crown, close to it */
const CR = COURSE.branch;
const nearerThanCourse = info => {
  if(!['leaves', 'shoot', 'spur', 'secondary', 'fruit'].includes(info.kind)) return 'back';
  let best = 1e9, bd = 0; for(const c of CR){ const dd = Math.hypot(info.mid[0] - c[0], info.mid[1] - c[1], info.mid[2] - c[2]); if(dd < best){ best = dd; bd = ET.depthOf(c); } }
  /* (fruit is drawn over the leaves, as a product must read at a glance: in front unless it hangs behind the course, close to it) */
  if(info.kind === 'fruit') return best < 300 && info.depth < bd - 30 ? 'back' : 'front';
  return best < 300 && info.depth > bd + 30 ? 'front' : 'back';
};
/* the course's arc length, so a climb can be asked for as "this far along it" */
const ARC = (() => { const a = [0]; for(let i = 1; i < COURSE.all.length; i++){ const p = COURSE.all[i - 1], q = COURSE.all[i]; a.push(a[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])); } return a; })();
const S_TRUNK = ARC[COURSE.helixEnd - 1], S_END = ARC[ARC.length - 1];
const coursePart = (s0, s1) => { const out = []; for(let i = 0; i < ARC.length; i++) if(ARC[i] >= s0 - 1e-6 && ARC[i] <= s1 + 1e-6) out.push(COURSE.all[i]); return out; };
const HEAP_AT = {x:-250, y:250, rho:-.4};   // the heap among the roots, front left of the trunk

/* the serpent for the stage: the roster's, with the course it holds on the tree, and the stage's own small acts (each run by an event) */
const SDEF = {...SD, chunk:4,
  states:{...SD.states, course:{label:'on the tree', track:true, fill:() => {}, par:{}, neck:{H:4, sb:0, pitch:.02}, gaze:'rel', tail:{curl:0}}},
  actions:{...SD.actions,
    offer:{label:'offer', ms:2600, run:x => { x.busy(2400); x.goal('H', 52, 1100); x.goal('pitch', -.16, 900); x.at(800, () => x.tongue(2)); }},
    offerStill:{label:'offer (reduced motion)', ms:1200, run:x => { x.goal('H', 52, 1100); x.goal('pitch', -.16, 900); }},
    rest:{label:'rest', ms:1600, run:x => { x.goal('H', x.state === 'heap' ? 18 : 2, 1500); x.goal('pitch', .06, 1200); x.goal('sb', 0, 1200); }},
    raise:{label:'raise', ms:1400, run:x => { x.goal('H', x.state === 'heap' ? 128 : 24, 1300); x.goal('pitch', -.04, 1000); }},
    drop:{label:'let the head fall', ms:1800, run:x => { x.goal('H', 0, 900); x.goal('pitch', .3, 900); x.goal('sb', .2, 900); }},
    flick1:{label:'one flick', ms:500, run:x => x.tongue(1)},
    glance:{label:'glance', ms:1200, run:x => x.lookAt(x.f.headFwd + x.R(-1, 1), x.R(700, 1100))},
    watch:{label:'look out', ms:1000, run:x => x.lookAt(Math.PI / 2 + .25, 900)},
  },
  bouts:{},
};
const SERPENT = BD.build(SDEF);

function mount(el, o = {}){
  const rec = o.run, speed = o.speed ?? 40, gapCap = o.gapCap ?? 5 * 60000, size = o.size || 760;
  el.style.position = 'relative'; el.innerHTML = ''; el.style.width = size + 'px'; el.style.height = Math.round(size * VIEW[3] / VIEW[2]) + 'px';
  const layer = (z) => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:' + z; el.appendChild(d); return d; };
  /* the ground: its record (paths worn, skins shed, fruit fallen) under everything */
  const lGround = layer(1), lTree = layer(2), lBody = layer(3), lFront = layer(4);
  const NS = 'http://www.w3.org/2000/svg', mk = (t, a = {}) => { const e = document.createElementNS(NS, t); for(const k in a) e.setAttribute(k, a[k]); return e; };
  const gsv = mk('svg', {viewBox:VIEW.join(' '), width:size, height:Math.round(size * VIEW[3] / VIEW[2]), preserveAspectRatio:'xMidYMid meet'}); lGround.appendChild(gsv);
  const P = (X, Y, Z) => ET.proj([X, Y, Z]), pt = p => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  { const n = 72, d = []; for(let q = 0; q < n; q++){ const a = q / n * Math.PI * 2, r = 560 * (1 + .05 * Math.sin(a * 5) + .03 * Math.sin(a * 11)); d.push(pt(P(r * Math.cos(a), r * Math.sin(a) + 40, 0))); }
    gsv.appendChild(mk('path', {d:'M' + d.join('L') + 'Z', fill:'#14161a', stroke:'#2b2a27', 'stroke-width':2})); }
  const gWorn = mk('path', {fill:'none', stroke:'#3a3528', 'stroke-width':0, 'stroke-linecap':'round', 'stroke-linejoin':'round', opacity:.8}); gsv.appendChild(gWorn);
  const gSkins = mk('g'); gsv.appendChild(gSkins);   // (fallen fruit is the tree's own now: the apples that drop land as themselves)
  /* the tree (a kit figure), then the serpent over it */
  if(!K.get('stageTree')) ET.figure({T:TREE, view:VIEW, id:'stageTree', split:nearerThanCourse, ground:false});
  const tree = K.mount('stageTree', lTree, {size, live:true, life:false, palette:{ground:'#0f1113'}}), treeF = K.mount('stageTreeFront', lFront, {size, live:true, life:false, palette:{ground:'#0f1113'}});
  /* the year it opens on: the seed while a run is about to play (the serpent heaps at the roots); the grown tree for a still with no run */
  const year0 = o.year ?? (rec ? .02 : .90);
  /* the year only ever goes forward: each event's anchor is a request, and the stage keeps the highest one (a read after a write must not pull
     the tree back to the seedling) */
  const years = y => { if(y <= S.yearT) return; S.yearT = y; if(!S.seeking) for(const t of [tree, treeF]) ET.setYear(t, y); };
  for(const t of [tree, treeF]) ET.setYear(t, year0, {instant:true});
  tree.pause(true); treeF.pause(true);
  /* behaviour (colour moving over the skin) is off on a stage: the kit's default is a drift, a flicker nothing in the run caused, and the idle stays still (spec 25.2). The owner's Behaviour card turns it on. */
  for(const t of [tree, treeF]) t.setBeh({style:'off'});
  /* the leaves in front of the serpent thin where they cover it: a band along its body in the front figure's mask, so that where it is reads at a
     glance in the crown (the near leaves hid it whole when it lay out along a limb) */
  const fsvg = lFront.querySelector('svg'), fsc = 1000 / VIEW[2], seeId = 'stageSee' + Math.random().toString(36).slice(2, 8);
  const seeBand = mk('path', {fill:'none', stroke:'#000', 'stroke-opacity':.72, 'stroke-width':(4 * (SDEF.width ?? 16) * fsc).toFixed(1), 'stroke-linecap':'round', 'stroke-linejoin':'round'});
  { const m = mk('mask', {id:seeId, maskUnits:'userSpaceOnUse', x:-2000, y:-2000, width:5000, height:5000}), defs = mk('defs'); m.append(mk('rect', {x:-2000, y:-2000, width:5000, height:5000, fill:'#fff'}), seeBand); defs.appendChild(m); fsvg.prepend(defs);
    for(const g of fsvg.querySelectorAll(':scope > g')) g.setAttribute('mask', 'url(#' + seeId + ')'); }
  const sv = SERPENT.mountCreature(lBody, {size, live:false, life:false, view:VIEW, vw:VIEW[2], vh:VIEW[3], occluders:1});
  for(const s of el.querySelectorAll('svg')){ s.style.width = size + 'px'; s.style.height = Math.round(size * VIEW[3] / VIEW[2]) + 'px'; }
  sv.setState('heap', {x:HEAP_AT.x, y:HEAP_AT.y, rho:HEAP_AT.rho}); sv.life(false); sv.breath(false);
  /* the trunk's silhouette masks the turns behind it (it does not move: the trunk is rigid): the screen outline of its tube, lobes and all */
  { const tr = TREE.trunk, L = [], Rr = [], zTop = COURSE.z1 + 120;
    for(let k = 0; k < tr.pts.length && tr.pts[k][2] <= zTop; k++){ const p = tr.pts[k], c = P(p[0], p[1], p[2]); let r = tr.r[k]; let rmax = r; for(let j = 0; j < 24; j++){ const th = j / 24 * 2 * Math.PI; rmax = Math.max(rmax, r * (1 + tr.lobes.amp(p[2]) * Math.cos(tr.lobes.n * th + tr.lobes.ph))); } L.push([c[0] - rmax, c[1]]); Rr.unshift([c[0] + rmax, c[1]]); }
    const c0 = tr.pts[0], bot = []; for(let q = 0; q <= 16; q++){ const a = Math.PI * q / 16, r = tr.r[0] * (1 + tr.lobes.amp(0)); bot.push(P(c0[0] + r * Math.cos(a), c0[1] + r * Math.sin(a) * .9, 0)); }
    sv.occluder(0, {d:'M' + bot.map(pt).join('L') + 'L' + L.map(pt).join('L') + 'L' + Rr.map(pt).join('L') + 'Z', cx:c0[0], cy:c0[1], r:tr.r[0] * 1.4 + 60, z1:zTop, on:true}); }

  /* the run: events on the run's clock, with long gaps shortened (the map from the recording's time to the stage's) */
  const EV = rec ? rec.events : [], TM = [], NE = EV.length;
  { let t = 0; for(let i = 0; i < NE; i++){ const g = i ? EV[i].at - EV[i - 1].at : EV[0].at; t += Math.min(g, gapCap); TM.push(t); } }
  const total = NE ? TM[NE - 1] + 2000 : 0;
  const origAt = p => { if(!NE) return 0; let lo = 0, hi = NE - 1; if(p <= TM[0]) return EV[0].at; if(p >= TM[hi]) return EV[hi].at + (p - TM[hi]); while(hi - lo > 1){ const m = (lo + hi) >> 1; if(TM[m] <= p) lo = m; else hi = m; } const gs = TM[hi] - TM[lo], go = EV[hi].at - EV[lo].at; return EV[lo].at + (p - TM[lo]) * (gs > 0 ? go / gs : 0); };
  const newRun = () => EK.run({beat:rec ? rec.beat : 15000, stallBeats:rec ? rec.stallBeats : 3, id:rec && rec.source ? rec.source.transcript : 'run'});
  /* the state a run starts from (seek returns to it): one list, so a restart cannot leave a field of the last playing behind */
  const fresh = () => ({p:0, k:0, run:newRun(), on:'heap', at:0, want:0, moving:false, lastFlick:-1e9, lastLook:-1e9, reads:0, sig:null, zones:null, prevState:'queued', frozen:false, dim:0, dimDrawn:0, flushT:0, log:[], skinsN:0, fallenN:0, done:false,
    pending:null, writes:0, returns:0, failed:false, coda:null, yearT:year0, restT:0, offerDue:false, lookOut:false, sway:0, shedAt:0, fast:0, seeD:null, wornW:0, tOrig:0, seeking:false, placing:false});
  const S = {...fresh(), playing:false, speed, reduced:!!o.reduced, inkBase:0x3A7D5C, error:null, cpu:0};
  const say = (what) => { S.log.push({p:S.p, what}); if(S.log.length > 60) S.log.shift(); };

  /* ---------- the serpent's acts, each caused by the run ---------- */
  /* the tree must be grown where the serpent goes: the trunk before the climb, and the course's own limb before it leaves the trunk. A climb
     asked for too early is held (S.pending) and released by step() when the year has caught up. */
  const yearReady = s => { if(S.seeking) return true; const r = ET.ready(tree); return s > S_TRUNK + 4 ? r.course : r.trunk >= .99; };
  const climbTo = s => {
    s = Math.min(S_END, Math.max(0, s)); S.want = Math.max(S.want, s);
    if(S.want <= S.at + 4) return;
    if(S.seeking) return;   // (a seek takes the events at once and places the serpent once, at S.want)
    if(!yearReady(S.want)){ S.pending = Math.max(S.pending || 0, S.want); return; }
    if(S.moving || S.frozen) return;   // (the request stays in S.want: step() takes it up when the serpent is free)
    const from = S.at, to = S.want, path = coursePart(from, to);
    if(path.length < 3) return;
    if(S.reduced){ /* posture changes only: no crawl; it is placed at its new place on the course */ sv.follow(path, {speed:40, delay:0}); S.at = to; S.on = 'course'; S.fast = 1; return; }
    S.moving = true; S.on = 'course';
    sv.follow(path, {speed:from === 0 ? .55 : .42, delay:from === 0 ? 700 : 120, then:() => { S.moving = false; S.at = to; if(S.want > S.at + 4) climbTo(S.want); }});
    say('climbs to ' + Math.round(to / S_END * 100) + '% of the course');
  };
  const play = name => { if(!S.frozen && !S.seeking) sv.play(name); };
  /* (the acts are the serpent's own: a flick, a glance, a look out; rate-limited so a burst of events reads as a burst, not a shake) */
  const flick = now => { if(S.seeking || S.reduced || S.moving || now - S.lastFlick < 650) return; S.lastFlick = now; play('flick1'); };
  const look = (now, out) => { if(S.seeking || S.reduced || S.moving || (!out && now - S.lastLook < 1800)) return; S.lastLook = now; play(out ? 'watch' : 'glance'); };

  /* one event in: the reducer takes it; then the acts it causes */
  const take = (ev, now) => {
    const R = S.run, before = R.state, phase0 = R.phase, nP = R.products.length; R.apply(ev);
    const k = ev.kind;
    /* the year's targets are set only here, by the run's own events: the tree grows as the work does (the seed, the seedling, the trunk, the
       course's limb, the year's end). A failed run sets no more targets: its year holds, and the tree takes die-back instead. */
    if(!S.failed){
      if(k === 'thought' || k === 'knowledge'){ S.reads++; years(Math.min(.20, .10 + .01 * (S.reads - 1))); if(S.reads % 5 === 0) look(now); else flick(now); }
      if(k === 'generation' || k === 'curation'){ const w = ++S.writes; years(Math.min(.68, .58 + .015 * (w - 1))); if(R.phase === 'trunk') climbTo(R.height() / .9 * S_TRUNK * .97); }
      if(k === 'return'){ const n = ++S.returns; years(n === 1 ? .72 : Math.min(.90, .72 + .03 * (n - 1))); climbTo(S_END); S.offerDue = true; }
    }
    if(k === 'approval' && ev.state === 'requested') S.lookOut = true;
    if(k === 'approval' && ev.state === 'answered'){ S.lookOut = false; play('rest'); }
    if(k === 'shed' && !S.seeking){ sv.f.shed = {t0:sv.now(), ms:7000}; S.shedAt = now; }
    if(k === 'member' && ev.state === 'Working') S.sway = 1;
    if(R.state === 'failed' && before !== 'failed'){ S.failed = true; S.pending = null; play('drop'); S.flushT = 1; for(const t of [tree, treeF]) ET.setDieback(t, 1, {instant:S.seeking}); }
    if(R.state === 'done' && before !== 'done'){ play('rest'); }
    if(R.state === 'thinking' && before === 'queued' && S.on === 'heap') play('raise');
  };
  /* ---------- the stage's step: the run's clock, then the bodies on real time ---------- */
  const step = (dtReal) => {
    const now = performance.now();
    if(S.playing && NE){ S.p = Math.min(total, S.p + dtReal * S.speed); }
    while(S.k < NE && TM[S.k] <= S.p) take(EV[S.k++], now);
    const tOrig = origAt(S.p), sig = S.run.signals(tOrig), Z = S.run.zones(tOrig);
    S.sig = sig; S.zones = Z; S.tOrig = tOrig;
    /* the serpent: frozen in a stall (its clock stops), breathing only while check-ins arrive, dimmed when done */
    S.frozen = sig.posture === 'stalled' && !S.placing;   // (a seek into a stall still places the serpent; the stall holds it there)
    /* a request to climb is never lost: climbTo only records it while the serpent is frozen or mid-stretch, and this takes it up the moment it is free
       (an event that landed in the frame a stall ended in used to be dropped, and the serpent then stood where it was until the next write) */
    if(!S.seeking && !S.moving && !S.frozen && !S.failed && S.pending == null && S.want > S.at + 4) climbTo(S.want);
    sv.breath(sig.breath && !S.reduced);
    if(S.reduced){ if(sv.f.beh.style !== 'off') sv.behaviour('off'); if(tree.beh.style !== 'off') treePair.setBeh({style:'off'}); }   // (reduced motion: no ripple; setReduced keeps the owner's styles to give back)
    treeF.pad = tree.pad; treeF.direct = tree.direct;   // (the front figure follows the first's pads and held muscles, even after a reset replaced them)
    if(S.offerDue && !S.moving && S.at >= S_END - 6 && !S.frozen){ S.offerDue = false; play(S.reduced ? 'offerStill' : 'offer'); }
    if(S.lookOut && !S.moving && !S.frozen && sig.posture === 'waiting'){ S.lookOut = false; look(now, true); }
    const dimT = sig.posture === 'done' ? .45 : sig.posture === 'queued' ? .2 : 0; S.dim += (dimT - S.dim) * Math.min(1, dtReal / 900);
    if(Math.abs(S.dim - (S.dimDrawn || 0)) > .01){ S.dimDrawn = S.dim; sv.setPalette({ink:K.intHex(K.mixInt(S.inkBase, 0x1b1d20, S.dim))}); }
    if(!S.frozen) sv.advance(S.fast ? 4000 : dtReal); S.fast = 0;
    { const f = sv.f, d = []; for(let i = 0; i < f.X.length; i += 6) d.push(Math.round((f.X[i] - VIEW[0]) * fsc) + ' ' + Math.round((f.Y[i] * EK.GY - f.z[i] * EK.GZ - VIEW[1]) * fsc)); const dd = 'M' + d.join('L'); if(dd !== S.seeD){ S.seeD = dd; seeBand.setAttribute('d', dd); } }
    /* the tree: its zones from the run */
    /* the tree's zones from the run; the bark lit up to the serpent's head; the limb it lies on gives under it as far out as it is */
    const hd = sv.head(), yHead = (hd.y * EK.GY - hd.z * EK.GZ - VIEW[1]) * 1000 / VIEW[2], load = S.at > S_TRUNK ? Math.min(1, (S.at - S_TRUNK) / (S_END - S_TRUNK)) : 0;
    /* the year: paced on the animation clock from the targets take() set; then any climb the tree was holding is released */
    for(const t of [tree, treeF]) ET.growStep(t, dtReal);
    if(!S.failed && !S.frozen && S.pending != null && yearReady(S.pending)){ const s = S.pending; S.pending = null; climbTo(s); }
    for(const t of [tree, treeF]) ET.setLook(t, Z, now, {instant:S.reduced, yHead:Z.trunk === 'growing' || Z.trunk === 'grown' || Z.trunk === 'held' || Z.trunk === 'grey' ? yHead : null, load:S.reduced ? 0 : load, sway:S.reduced ? 0 : (S.sway || 0)});
    S.sway = (S.sway || 0) * .97;
    tree.advance(dtReal); treeF.advance(dtReal);
    /* the ground's record: the path worn from the roots to the trunk, fallen fruit, shed skins */
    { const w = Math.min(9, S.run.made * .12 + (S.at > 0 ? 2 : 0)); if(Math.abs(w - (S.wornW || 0)) > .05){ S.wornW = w; const pts = [P(HEAP_AT.x + 40, HEAP_AT.y - 30, 0), P(-90, 90, 0), P(COURSE.all[0][0], COURSE.all[0][1], 0)]; gWorn.setAttribute('d', 'M' + pt(pts[0]) + 'Q' + pt(pts[1]) + ' ' + pt(pts[2])); gWorn.setAttribute('stroke-width', w.toFixed(1)); } }
    if(S.shedAt && now - S.shedAt > 6500){ S.shedAt = 0; const sp = sv.spine3(), d = []; for(let i = 0; i < sp.X.length; i += 3) d.push(pt([sp.X[i], sp.D[i] * EK.GY - sp.Z[i] * EK.GZ])); gSkins.appendChild(mk('path', {d:'M' + d.join('L'), fill:'none', stroke:'#8a8f7a', 'stroke-width':10, 'stroke-opacity':.18, 'stroke-linecap':'round'})); S.skinsN++; }
    /* the end: the run's clock is done, and the tree finishes its year (the leaves down, the last apples landed) for twelve seconds of
       animation before the stage calls itself done */
    if(S.p >= total && NE && S.coda == null){ S.coda = 0; if(!S.failed) years(1); }
    /* the stage is done when the year has had its twelve seconds and the serpent has come to rest: the run's end may find it still on its way
       up the course (its pace is its own whatever the run's), so the coda is also where its last climb finishes */
    if(S.coda != null){
      S.coda += dtReal;
      if(S.coda >= 12000){ if(!S.moving && S.pending == null) S.restT += dtReal; else S.restT = 0; if(S.restT >= 2500) S.done = true; }
    }
  };
  /* the real-time loop (a page), or the virtual clock (gates). A step that throws stops the run's clock and says so (S.error, shown on the page, and
     once in the console): it does not go on throwing at sixty frames a second over a half-applied frame. Play clears it. */
  let raf = 0, last = 0, said = false;
  const guarded = dt => { const t0 = performance.now(); try { step(dt); } catch(e){ S.error = e; S.playing = false; if(!said){ said = true; console.error('stage: ' + (e && e.stack || e)); } } S.cpu += (performance.now() - t0 - S.cpu) * .05; };
  const loop = t => { raf = requestAnimationFrame(loop); const dt = last ? Math.min(80, t - last) : 16; last = t; guarded(dt); };
  if(o.live !== false){ raf = requestAnimationFrame(loop); }
  /* the figure's size follows its panel (CreaturePage.fitTo): the box, the layers' svgs, the serpent's and both tree figures' */
  const aspect = VIEW[3] / VIEW[2];
  const sizeTo = px => { px = Math.max(120, Math.round(px)); const h = Math.round(px * aspect); el.style.width = px + 'px'; el.style.height = h + 'px';
    for(const s of el.querySelectorAll('svg')){ s.style.width = px + 'px'; s.style.height = h + 'px'; } sv.resize(px); tree.resize(px); treeF.resize(px); };
  /* the tree's front figure (a second figure of the same tree, drawn over the serpent) shares the first's pads and held muscles, and one handle writes both */
  const SYNC = new Set(['setBeh', 'setBehPalette', 'ripple', 'flipWave', 'glyph', 'setPalette', 'setLayer', 'setView', 'holdMuscle', 'resetPad', 'setPad']);
  const treePair = new Proxy(tree, {get(t, k){ const v = t[k]; if(typeof v !== 'function') return v; return (...a) => { const r = v.apply(t, a); if(SYNC.has(k) && typeof treeF[k] === 'function') treeF[k](...a); return r; }; }});
  const api = {
    S, sv, tree, treeF, treePair, TREE, COURSE, VIEW, total,
    play(){ S.error = null; S.playing = true; }, pause(){ S.playing = false; }, playing:() => S.playing,
    setSpeed(v){ S.speed = v; },
    /* reduced motion: posture changes only. Behaviour (colour moving over the skin) is a ripple of its own, so it is held off, and the owner's styles come back with the motion */
    setReduced(v){ v = !!v; if(v && !S.reduced) S.behKeep = {s:sv.behaviour().style, t:tree.beh.style}; if(!v && S.reduced && S.behKeep){ sv.behaviour(S.behKeep.s); treePair.setBeh({style:S.behKeep.t}); S.behKeep = null; } S.reduced = v; },
    advance(ms, st = 16){ for(let t = 0; t < ms; t += st) step(st); },
    resize:sizeTo, size:() => parseFloat(el.style.width) || size,
    /* put the serpent at s along the course at once (as reduced motion places it), for a still such as the library's preview */
    place(s){ const r = S.reduced; S.reduced = true; climbTo(s); S.reduced = r; for(let k = 0; k < 30; k++) step(16); },
    /* to p on the run's clock, at once. The events go through the reducer; the year and the serpent are placed where the run puts them, as reduced
       motion places a body; nothing is replayed. (It used to run the whole run up to p, the serpent's crawl and the tree's growth step by step, in one
       call, and the page was frozen for the 5 to 30 s that took: the scrubber's and Restart's one job.) Then it plays on from there. */
    seek(p){
      const keep = S.playing, red = S.reduced; p = Math.max(0, Math.min(total, +p || 0));
      S.playing = false; S.reduced = true; Object.assign(S, fresh()); S.seeking = true; S.error = null;
      sv.setState('heap', HEAP_AT); sv.life(false); gSkins.innerHTML = '';
      for(const t of [tree, treeF]){ ET.setDieback(t, 0, {instant:true}); ET.setYear(t, year0, {instant:true}); }
      while(S.k < NE && TM[S.k] <= p) take(EV[S.k++], 0);
      S.p = p; S.seeking = false;
      const grow = () => { for(const t of [tree, treeF]){ ET.setYear(t, S.yearT, {instant:true}); ET.setDieback(t, S.failed ? 1 : 0, {instant:true}); } };
      /* the serpent is placed first (the offer waits: its raised head would hold back a climb that starts from the heap), then the act the run's end or
         failure asks for, each given four seconds of the body's own time in one call (S.fast) and not played out */
      const due = S.offerDue; S.offerDue = false; S.placing = true;
      grow(); if(S.want > 4) climbTo(S.want);
      step(16); grow();   // (a run at its end starts its coda here)
      S.offerDue = due; if(S.run.state === 'failed') sv.play('drop'); else if(S.run.state === 'done') sv.play('rest');
      S.fast = 1; step(16); for(let k = 0; k < 8; k++) step(16);
      S.dim = S.sig.posture === 'done' ? .45 : S.sig.posture === 'queued' ? .2 : 0; step(16);
      if(S.coda != null){ S.coda = 12000; S.restT = 2500; step(16); }   // (the end of a run is a stage that is done: its year has been had)
      S.placing = false;
      S.reduced = red; S.playing = keep;
    },
    signals:() => S.sig, zones:() => S.zones, log:() => S.log.slice(),
    destroy(){ cancelAnimationFrame(raf); el.innerHTML = ''; },
  };
  return api;
}

/* ---------- the page, in the creature shell ---------- */
async function page(o = {}){
  const q = new URLSearchParams(location.search), file = q.get('run') || o.run || 'tools/runs/refinement-close-2026-10-18.json';
  /* ?thumb=1: the figure alone, a still of the serpent partway up the trunk (the creatures library's preview), drawn larger than the frame and
     cropped about its middle so the serpent reads at a thumbnail's size */
  if(q.has('thumb')){
    document.body.style.cssText = 'margin:0;background:#0b0d11;height:100vh;overflow:hidden;position:relative';
    /* (the crop's centre: the trunk, a little above where the serpent winds round it) */
    const fx = -VIEW[0] / VIEW[2], fy = (-360 - VIEW[1]) / VIEW[3], wrap = document.createElement('div'), box = document.createElement('div');
    wrap.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(${(-fx * 100).toFixed(1)}%, ${(-fy * 100).toFixed(1)}%)`; wrap.appendChild(box); document.body.appendChild(wrap);
    const st = window.STAGE = mount(box, {run:null, size:Math.min(innerWidth, innerHeight * VIEW[2] / VIEW[3]) * 1.8 | 0, live:false, reduced:true});
    st.place(S_TRUNK * .8); window.STAGE_READY = true; return st;
  }
  const ui = CreaturePage.frame({title:'Serpent and tree', sign:'', sub:'a run as a creature in its habitat · ' + file.split('/').pop()}), {$, card, button} = ui;
  const rec = await (await fetch(file, {cache:'no-store'})).json();
  const reduced = q.has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fig = $('fig'); fig.style.display = 'grid'; fig.style.placeItems = 'center';
  const box = document.createElement('div'); fig.appendChild(box);
  const st = window.STAGE = mount(box, {run:rec, speed:+(q.get('speed') || 40), reduced, size:640, live:!q.has('still')});
  CreaturePage.fitTo(fig, VIEW[3] / VIEW[2], px => st.resize(px));   // (the figure follows its panel: the window, the splitter, the library's viewer)
  window.STAGE_READY = true;
  const h = (t, c, html) => { const e = document.createElement(t); if(c) e.className = c; if(html != null) e.innerHTML = html; return e; };
  const errEl = h('p', 'card-note'); errEl.style.color = '#e08a5a';
  /* the run: transport, speed, the source */
  { const a = card('Run', 'a real session, recorded as O-I events; long gaps shortened'), row = h('div', 'row'); a.appendChild(row);
    const pb = h('button', 'ghost-button', 'Play'); pb.onclick = () => { if(st.playing()) st.pause(); else st.play(); }; row.appendChild(pb); const syncPlay = () => { const on = st.playing(); if(pb.dataset.on !== String(on)){ pb.dataset.on = String(on); pb.textContent = on ? 'Pause' : 'Play'; pb.classList.toggle('on', on); } }; setInterval(syncPlay, 150);
    const rb = h('button', 'ghost-button', 'Restart'); rb.onclick = () => { st.seek(0); }; row.appendChild(rb);
    const rm = h('button', 'ghost-button' + (reduced ? ' on' : ''), 'Reduced motion'); rm.onclick = () => { rm.classList.toggle('on'); st.setReduced(rm.classList.contains('on')); }; row.appendChild(rm);
    const rg = h('label', 'range', '<span class="swatch-label">speed</span><input type="range" min="5" max="400" step="5" value="' + st.S.speed + '"><output>' + st.S.speed + '×</output>'); a.appendChild(rg);
    rg.querySelector('input').oninput = e => { st.setSpeed(+e.target.value); rg.querySelector('output').textContent = e.target.value + '×'; };
    const sc = h('input'); sc.type = 'range'; sc.min = 0; sc.max = st.total; sc.step = 1000; sc.value = 0; sc.style.width = '100%'; sc.onchange = () => st.seek(+sc.value); a.appendChild(sc);
    a.appendChild(h('p', 'card-note', esc(rec.source.transcript) + ' · lines ' + rec.source.lines.join('–') + ' · ' + rec.source.from.slice(0, 16).replace('T', ' ') + ' to ' + rec.source.to.slice(11, 16) + ' UTC · ' + rec.events.length + ' events'));
    setInterval(() => { if(document.activeElement !== sc) sc.value = st.S.p; }, 250);
    a.appendChild(errEl);
  }
  /* the four signals */
  const sigBox = h('div', 'signals'); { const a = card('The four signals', 'where it is, its posture, the fruit, breath'); a.appendChild(sigBox); }
  const logBox = h('div', 'events'); { const a = card('Events', 'the latest the run gave, and what each caused'); a.appendChild(logBox); }
  { const a = card('Run states', 'CREATURE-SPEC.md 25.3'); const t = h('table', 'states'); t.innerHTML = '<tr><th>state</th><th>where</th><th>posture</th><th>breath</th></tr>' +
    [['queued', 'the roots', 'heap, head down', 'no'], ['thinking', 'where it has got to', 'a flick or a look for each read', 'yes'], ['acting', 'the trunk', 'climbing, a step a write', 'yes'], ['waiting', 'where it was', 'still, looking out', 'yes'], ['stalled', 'where it stopped', 'frozen', 'no'], ['producing', 'the crown', 'neck out, offering', 'yes'], ['done', 'the crown', 'at rest, dim', 'no'], ['failed', 'where it was', 'head fallen, slack', 'no']].map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join(''); a.appendChild(t); }
  /* The figures' own standard parameter surface (CREATURE-SPEC.md 25.4): the serpent's acts, pads, muscles, behaviour and colours; the tree's pads
     (Dynamics and Motion), behaviour and colours; views and layers for both. The run drives the two of them; a held pad or a pressed act is the
     owner's own hand, and goes home on release. Life and the postures are not offered: the idle stays still on a stage, and the run places the serpent. */
  const SD_ACTS = ['flick1', 'glance', 'watch', 'offer', 'rest', 'raise', 'drop', 'yawn', 'tailflick', 'lure', 'rattle', 'peek', 'rear', 'shed'], actBtns = [];
  { const a = card('Serpent · Acts', 'your own hand: the run\'s own acts come from its events · greyed where an act does not work'), row = h('div', 'row'); a.appendChild(row);
    for(const k of SD_ACTS){ const A = SDEF.actions[k]; if(!A) continue; const b = button(A.label); b.onclick = () => st.sv.play(k); row.appendChild(b); actBtns.push([b, A]); } }
  /* (the colours card sets the ink; the stage dims that ink toward the ground when the run is done, so the owner's ink is kept as the base it dims from) */
  const svUi = Object.assign(Object.create(st.sv), {setPalette(p){ if(p.ink) st.S.inkBase = parseInt(p.ink.slice(1), 16); st.sv.setPalette({...p, ...(p.ink ? {ink:K.intHex(K.mixInt(st.S.inkBase, 0x1b1d20, st.S.dim))} : {})}); }});
  const sStd = BodyPage.cards(svUi, SERPENT, ui, {prefix:'Serpent', pad:id => id !== 'ring' && id !== 'strike'});   // (no ring or strike: the stage's states are the heap and the course)
  const tStd = CreaturePage.kitCards(st.treePair, K.get('stageTree'), ui, {prefix:'Tree'});
  { const v = $('views');
    for(const k of ['skin', 'map', 'anatomy']){ const b = button(k, 'chip' + (k === 'skin' ? ' on' : '')); b.dataset.view = k; b.onclick = () => { st.sv.setView(k); st.treePair.setView(k); v.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('on', x === b)); }; v.appendChild(b); }
    v.appendChild(h('span', 'gap'));
    for(const [l, ks, kt] of [['lines', 'contour', 'lines'], ['fills', 'mesh', 'fills']]){ const b = button(l, 'chip on'); b.onclick = () => { b.classList.toggle('on'); const on = b.classList.contains('on'); st.sv.setLayer(ks, on); st.treePair.setLayer(kt, on); }; v.appendChild(b); } }
  $('reset').onclick = () => { sStd.reset(); tStd.reset(); for(const n of K.get('stageTree').PAD_ORDER) st.treePair.resetPad(n); st.sv.behaviour('off'); st.treePair.setBeh({style:'off'}); };   // (the parameters go home; the run goes on)
  setInterval(() => { sStd.tick(); tStd.tick(); }, 100);
  const RIPE = {set:'#9DB860', ripening:'#B8963E', ripe:'#C44536', harvested:'#D4A03C', fallen:'#6B5B4F'};   // (the tree's own: environ-tree.js RIPE)
  const fmt = ms => { const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return (m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min ' + s + ' s'); };
  setInterval(() => {
    const s = st.signals(); if(!s) return; const R = st.S.run;
    const where = s.where.phase === 'roots' ? 'at the roots' : s.where.phase === 'trunk' ? 'on the trunk, ' + Math.round(s.where.height / .9 * 100) + '% of the way up' : 'in the crown';
    sigBox.innerHTML = `<div class="sig"><b>where</b><span>${where}</span></div><div class="sig"><b>posture</b><span class="st st-${s.posture}">${s.posture}</span></div>
      <div class="sig"><b>fruit</b><span>${s.products.length ? s.products.map(p => `<i class="fruit" title="${esc(p.id)}: ${p.ripeness}" style="background:${RIPE[p.ripeness]}"></i>${esc(p.id.replace('commit ', ''))} ${p.ripeness}`).join(' · ') : 'none yet'}</span></div>
      <div class="sig"><b>breath</b><span>${s.breath ? 'breathing' : 'still'} · last check-in ${R.lastCheckIn == null ? 'none' : fmt(Math.max(0, st.S.tOrig - R.lastCheckIn)) + ' ago'}</span></div>
      <div class="sig dim"><b>run clock</b><span>${fmt(st.S.tOrig || 0)} of ${fmt(rec.length)} · ${R.reads} reads · ${R.made} writes · ${R.products.length} returns</span></div>`;
    const S = st.S;
    $('state').textContent = (S.error ? 'stopped' : s.posture).toUpperCase(); $('state').classList.toggle('live', st.playing() && !S.frozen); $('state').title = S.error ? String(S.error && S.error.message || S.error) : 'the run\'s state: ' + s.posture;
    $('readout').innerHTML = `${rec.events.length} events · ${S.speed}× · <b>${S.cpu.toFixed(2)} ms</b> · engine ${SERPENT.VERSION} · kit ${K.VERSION}`;
    errEl.textContent = S.error ? 'stopped: ' + String(S.error && S.error.message || S.error) + ' (Play goes on)' : '';
    { const stt = st.sv.state(); for(const [b, A] of actBtns){ const ok = (!A.in || A.in.includes(stt)) && (!A.not || !A.not.includes(stt)); b.disabled = !ok; b.style.opacity = ok ? 1 : .45; } }
    const evs = R.events.slice(-7).reverse();
    logBox.innerHTML = evs.map(e => `<div class="ev"><b>${esc(e.kind)}</b> ${esc(e.state || e.outcome || '')} ${esc(e.subject_ref || '')}${e.inferred ? ' <i>(inferred: ' + esc(e.inferred) + ')</i>' : ''}${e.apiError ? ' <i>(API error)</i>' : ''}</div>`).join('');
  }, 200);
  if(!q.has('paused')) st.play();
  return st;
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[ch]);
window.StageSerpentTree = {mount, page, VIEW, TREE, COURSE, SERPENT, S_TRUNK, S_END};
})();
