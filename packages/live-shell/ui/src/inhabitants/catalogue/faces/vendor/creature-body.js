/* creature-body.js: the engine for continuous bodies (serpents, eels, the dragon's tail; see CREATURE-SPEC.md section 14).
   CreatureBody.build(def) returns {mountCreature, STATES, ACTIONS, PADS, ...} for one kind of body, described by def:
     length, width (the widest half-width), head {length, hinge, rigid, lip, eye {s, psi, r}, fangs}, neck [from, to], tailLength,
     profile {a:[[s, half-width]...], b:[[s, half-height]...]}, columns (scales round the body), ink, palette,
     states {id: {label, fill(f, k, P, B), par, neck {H, sb, pitch}, gaze 'world'|'rel', tail {curl}, ring?, tight?, rootAt?, lock?}},
     actions {id: {label, in?, not?, ms?, run(x)}}, bouts {stateId: {name: weight}}, start, region?, pattern?, tongue?.
   What it does, once, for any such body:
   - One surface. A tube whose cross-section changes along its length carries one scale lattice from the snout to the tail tip:
     quads on the head (plates with straight edges), a row of triangles, then diamonds. Lines are the gaps between cells over a
     line-coloured backing, as in the face rig.
   - Shape is curvature; place is friction. Each frame the plan curvature is summed from the base (the state, or the track the head has
     laid) and the layers (look, S-bend, tail, tone packets, pads). It is integrated into a shape, and the shape is put down where the
     parts touching the ground slide least (sideways slip costs about thirty times forward slip).
   - Height is contact: a part that lies over another rests on it, with eased ramps. The neck rises by its own raise.
   - States are reached by crawling into them: the head lays the new shape on a tape ahead of it, tail end first, and the body follows.
   - A ring state (ring: true) is closed every frame (a pill-shaped loop, FILLS.ring, or a figure of eight, FILLS.eight, whose last straight run
     lies along the head, so the tail goes in at the snout). It holds the true tip of its tail between its lips, swallows it (swallow) for 48 s
     down to the smallest its shape allows, holds at any stage (ringHold) and lets it out (release), by the shared time law in creature-ring.js
     (load it first). Every move out of it lets the tail out first. VERSION and CHANGELOG are exported with the body.
   - A strike (x.strike) is a real launch: cock, dwell, unfold onto a target with the anterior coil paying out, bite or miss, draw back.
   - Every posture value moves through a spring under a minimum-jerk goal; the neck answers along its length, head first.
   - Each posture value rests at its home: what a held pad sets, or the state's own posture (a state may lock some: a ring's head holds its tail).
     An action, a strike or a move takes the values it animates while it runs, from wherever they are, and gives them back at home (x.home). The
     body steps at its own time (the Dynamics tempo), never more than a 60 Hz frame of it at once. */
(() => {
'use strict';
const VERSION = '2.3.0';
const CHANGELOG = [
  {date:'2026-10-19', version:'2.3.0', what:'Round 20. Animations work from wherever the body is and give it back. Each posture channel rests at its home: the value a held pad gives it, or the state\'s own posture. An action (all its goals, for its whole length), the strike, a move between states and a tongue flick take the channels they animate while they run, so a held pad no longer pins them: a strike with the head held cocks from there and draws back there, a yawn with the mouth held half open opens wide and settles half open. Actions are written from home (x.home(channel)); if one is cut short what it held goes home (a strike stopped mid-lunge no longer leaves the head down and the neck rigid), if it finishes its last pose stays. Life\'s small bouts take nothing (a held pad still overrides them). A ring locks its head, neck and tail (a held head, neck, tail or muscle used to open it by 70 to 480 px); a held mouth only opens its jaws wider than the swallow; held muscles bend it a fifth as much on the trunk and not at all at the neck, and a crawl not at all (each share eased through a spring). A tongue flick owns the tongue from out to back in. The body steps at its own time, never more than a 60 Hz frame of it at once (a quick tempo made the strike\'s springs grow without end). Motion scales what moves (waves, sway, drift, lure, rattle, life\'s ranges), not postures, aims, a strike or a ring. A strike\'s cock lasts as long as the raise it has to make. state.lock names channels a state holds itself.'},
  {date:'2026-10-19', version:'2.2.0', what:'Round 19. A ring holds the true tip of its tail between its lips: the swallowed length is measured from the lips (par.S 0 is the tip), the whole tail is drawn, the shape still closes at the jaw angle (past the tail\'s end while little is in). Coming to a ring the jaws open and close on the tip; leaving, they open off it. Every move out of a ring (a state, an action that needs another state such as a strike, roam, life) lets the tail out first at the ring\'s pace: before, an action pulled the swallowed tail out of the head in one frame. A second closed form, FILLS.eight (a figure of eight, turns 0, crossing over itself), with a time law and a smallest size for each ring state. A ring\'s shape is solved each frame with the layers on it (tone, shifts, pads, the look): its runs and arcs take up what they move the tail by, so it stays shut (a packet on a tight loop used to open it by tens of px). The strike aims along the way the head looks instead of turning it back to the coil first, and its launch no longer snaps a still-settling raise up to its mark. Fixed: a move never reset the tail\'s curl, lure, lift or the jaws, and the lower bout fell through into raise (both lost behind comments); a lone station resting a px above its neighbours was a tent the ground ramps kept as a 26-33 degree kink in the nautilus\'s neck (the smoothing may now round it by up to 1.2 px).'},
  {date:'2026-10-19', version:'2.1.0', what:'A body can follow a laid course in three dimensions (x.follow(path) and api.follow): up a trunk, along a branch, down again. The tape now carries a height and a world place for each step as well as the curvature: a station on a laid course stands on its height (support, as well as contact) and is pinned to its place by the fit, so the body winds round a trunk exactly and does not drift. A state with track:true holds the course it arrived on. On a course each station is where the course says (follow-the-leader exactly); a raised head comes down before it moves off; the approach is steered, never tighter than the body can bend; the neck is the course plus what a look adds to its curvature, so it lies on the course until it looks; a station on a raised course stands on its height with no ramp (a ramp shallower than a climb held the body off its trunk). For a stage: a fixed view (o.view), occluders (o.occluders, api.occluder) that hide the chunks behind a trunk, a chunk size (def.chunk), and an event breath (api.breathe). Nothing changes for a body that does not use them.'},
  {date:'2026-10-16', version:'2.0.0', what:'Round 18. The neck is an elevation-angle field (arc length kept, no steeper than the body is long: its hard elbows are gone, 46-81 deg turns between stations became 15-20). The strike is a real launch: cock into a tall S, unfold out and down onto a target with the anterior coil paying out, bite or miss, draw back along the same shapes. The ring eats its tail for real (creature-ring.js 1.0.0): a 48 s swallow of gulps that shrink and slow, the tail drawn into the mouth, the swallowed length hidden only in the head and throat, a lump down the neck, fullness, to a very small ring, held or released from any stage.'},
  {date:'2026-10-15', version:'1.2.0', what:'Round 17. Behaviour and colour controls, muscle holds, body, moving and dynamics pads.'},
  {date:'2026-10-15', version:'1.1.0', what:'Rounds 14-16. One surface from snout to tail, curvature placed by friction, height by contact, states reached by crawling; the engine made general (definitions, FILLS, the shared page).'},
];
if(typeof window.CreatureRing === 'undefined') throw new Error('creature-body.js needs creature-ring.js loaded before it: <script src="creature-ring.js"></script>');
const CRING = window.CreatureRing;
const SVGNS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const s5 = u => { u = clamp(u); return u * u * u * (10 - 15 * u + 6 * u * u); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;
const hash = i => { let h = Math.imul((i >>> 0) + 1, 2654435761) >>> 0; h ^= h >>> 15; return (Math.imul(h, 2246822519) >>> 0) / 4294967296; };
const HEX2 = Array.from({length:256}, (_, i) => i.toString(16).padStart(2, '0'));
const hexInt = s => typeof s === 'number' ? s : parseInt(s.slice(1), 16);
const intHex = c => '#' + HEX2[c >> 16 & 255] + HEX2[c >> 8 & 255] + HEX2[c & 255];
function mixInt(a, b, t){
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = a >> 16 & 255, g = a >> 8 & 255, l = a & 255;
  return ((r + ((b >> 16 & 255) - r) * t + .5) | 0) << 16 | ((g + ((b >> 8 & 255) - g) * t + .5) | 0) << 8 | ((l + ((b & 255) - l) * t + .5) | 0);
}
const addInt = (a, b, t) => { const f = (x, y) => Math.min(255, x + y * t + .5) | 0; return f(a >> 16 & 255, b >> 16 & 255) << 16 | f(a >> 8 & 255, b >> 8 & 255) << 8 | f(a & 255, b & 255); };

/* the roster's colours. Malachite is the serpent's one ink; every other colour arrives additively. */
const ROSTER = {obsidian:0x1A1A2E, bone:0xE8E4D9, cinnabar:0xC44536, lapis:0x2E5A88, malachite:0x3A7D5C, amber:0xD4A03C, umber:0x6B5B4F, gold:0xB8963E, ground:0x1b1d20};
function makePal(o = {}){
  const p = {...ROSTER};
  for(const k in o) if(o[k] != null) p[k] = hexInt(o[k]);
  if(p.ink == null) p.ink = p.malachite;
  if(p.wash == null) p.wash = p.ink;
  if(p.eye == null) p.eye = p.amber;
  p.skin = mixInt(p.ground, p.wash, .08);
  p.line = mixInt(p.skin, p.ink, .86);
  p.saddle = mixInt(p.ground, p.wash, .2);
  p.crown = mixInt(p.ground, p.wash, .15);
  p.belly = mixInt(p.ground, p.bone, .075);
  p.labial = mixInt(p.ground, p.bone, .11);
  p.mouth = mixInt(p.ground, p.cinnabar, .34);
  p.shadow = 0x000000;
  return p;
}

function pchip(K){
  const n = K.length, x = K.map(k => k[0]), y = K.map(k => k[1]), h = [], d = [], m = new Array(n);
  for(let i = 0; i < n - 1; i++){ h.push(x[i + 1] - x[i]); d.push((y[i + 1] - y[i]) / h[i]); }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for(let i = 1; i < n - 1; i++){ if(d[i - 1] * d[i] <= 0){ m[i] = 0; continue; } const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  return s => {
    let i = 0; while(i < n - 2 && s > x[i + 1]) i++;
    const t = clamp((s - x[i]) / h[i]), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

function build(def){
/* ---------- the body: stations along it, and its cross-section ----------
   s runs from the snout tip (0) to the tail tip (L). a is the half-width, b the half-height. The head is wide and flat, with the jaw's angle at
   s = HINGE. A pinch marks the neck. The trunk is round and thickest near a third of the length, and the tail tapers to a point. */
const HD = def.head || {}, L = def.length ?? 1080, AMAX = def.width ?? 16, HL = HD.length ?? 46, HINGE = HD.hinge ?? 43, HEADR = HD.rigid ?? 41;
const NECK0 = (def.neck || [])[0] ?? 50, NECK1 = (def.neck || [])[1] ?? 205, TAIL0 = L - (def.tailLength ?? 270);
const KA = def.profile.a, KB = def.profile.b;
const fA = pchip(KA), fB = pchip(KB);
const S = [];
for(let s = 0; s < L - 1.6; s += s < 66 ? 2.2 : s > L - 90 ? 3 : 3.6) S.push(+s.toFixed(3));
S.push(L);
const N = S.length, DS = new Float64Array(N);
for(let i = 0; i < N - 1; i++) DS[i] = S[i + 1] - S[i];
DS[N - 1] = DS[N - 2];
const A0 = Float64Array.from(S, fA), B0 = Float64Array.from(S, fB);
const idxAt = s => { let lo = 0, hi = N - 1; while(hi - lo > 1){ const m = (lo + hi) >> 1; if(S[m] <= s) lo = m; else hi = m; } return lo; };
const atS = (arr, s) => { if(s <= 0) return arr[0]; if(s >= L) return arr[N - 1]; const i = idxAt(s), t = (s - S[i]) / DS[i]; return arr[i] + (arr[i + 1] - arr[i]) * t; };
const M = idxAt(L * .45);   // the station the shape is integrated from, near the body's middle
const J0 = new Int32Array(N);   // for each station, the first station far enough along the body to lie on it
for(let i = 0, j = 0; i < N; i++){ while(j < N && S[j] < S[i] + 52) j++; J0[i] = j; }
/* the neck's look is spread over the neck with a smooth weight whose integral is one */
const WN = new Float64Array(N);
{ let t = 0; for(let i = 0; i < N; i++){ const s = S[i]; if(s > NECK0 && s < NECK1){ const u = (s - NECK0) / (NECK1 - NECK0); WN[i] = Math.sin(Math.PI * u) ** 2; t += WN[i] * DS[i]; } } for(let i = 0; i < N; i++) WN[i] /= t; }

/* ---------- the lattice ----------
   NC columns round the body; psi = 0 is the middle of the back, psi = +-pi the belly, and +psi the snake's left. Behind the head, row r's
   vertices sit half a column over from its neighbours', so the cells are diamonds: each centred between two vertices of a row, its top and
   bottom on the rows either side. On the head the rows line up, so the cells are quads and a plate built of them has straight edges. One row
   of triangles joins the two. */
const NC = def.columns ?? 14, DPSI = TAU / NC, LIP = HD.lip ?? 1.72;
const vid = (r, c) => r * NC + ((c % NC) + NC) % NC;
const RJ = idxAt(HINGE + 3), OFF = Uint8Array.from({length:N}, (_, r) => r <= RJ ? 0 : (r - RJ) & 1);
const SIN_E = [], COS_E = [], SIN_O = [], COS_O = [];
for(let c = 0; c < NC; c++){ SIN_E.push(Math.sin(c * DPSI)); COS_E.push(Math.cos(c * DPSI)); SIN_O.push(Math.sin((c + .5) * DPSI)); COS_O.push(Math.cos((c + .5) * DPSI)); }
const LW = {contour:2.2, region:1.15, hair:.62};
const CELLS = [], PLATES = new Map();
const plateId = k => { if(k == null) return -1; if(!PLATES.has(k)) PLATES.set(k, PLATES.size); return PLATES.get(k); };
/* what a cell is: its region (for the lines between regions and the map) and the plate it belongs to (cells of one plate show no line between) */
const region = def.region || regionHead;
function regionHead(r, s, psi){
  const ap = Math.abs(psi), sd = psi >= 0 ? 'L' : 'R';
  if(s < HINGE + 2){
    if(ap <= .98){
      if(s < 5) return ['crown', 'rostral'];
      if(s < 11) return ['crown', 'inas' + sd];
      if(s < 19) return ['crown', 'pref' + sd];
      if(s < 33) return ap < .42 ? ['crown', 'frontal'] : ['crown', 'supoc' + sd];
      return ['crown', 'pari' + sd];
    }
    if(ap <= 1.36) return ['side', s < 5 ? 'rostral' : 'sd' + sd + Math.floor(r / 2)];
    if(ap <= LIP) return ['supralab', s < 5 ? 'rostral' : 'sl' + sd + Math.floor(r / 3)];
    if(ap <= 2.3) return ['infralab', 'il' + sd + Math.floor(r / 3)];
    return ['chin', s < 7 ? 'mental' : 'chin' + sd + Math.floor(r / 5)];
  }
  if(ap > 2.3) return ['ventral', 'v' + Math.floor(r / 2)];
  return [ap < 1.2 ? 'dorsal' : 'lateral', null];
}
const ZONES = ['crown', 'side', 'supralab', 'infralab', 'chin', 'dorsal', 'lateral', 'ventral'];
const addCell = (v, r, s, psi) => { const [zone, pk] = region(r, s, psi); CELLS.push({v, r, s, psi, zone:ZONES.indexOf(zone), plate:plateId(pk), jaw:Math.abs(psi) > LIP && s < HINGE + 15, ins:[0, 0, 0, 0], rep:null}); };
for(let r = 0; r < RJ; r++) for(let c = 0; c < NC; c++) addCell([vid(r, c), vid(r + 1, c), vid(r + 1, c + 1), vid(r, c + 1)], r, (S[r] + S[r + 1]) / 2, wrap((c + .5) * DPSI));
for(let c = 0; c < NC; c++) addCell([vid(RJ, c), vid(RJ + 1, c), vid(RJ, c + 1), vid(RJ, c + 1)], RJ, S[RJ] + DS[RJ] / 3, wrap((c + .5) * DPSI));
for(let r = RJ + 1; r < N - 1; r++) for(let c = 0; c < NC; c++){ const o = OFF[r]; addCell([vid(r, c), vid(r + 1, c + o), vid(r, c + 1), vid(r - 1, c + o)], r, S[r], wrap((c + .5 * o + .5) * DPSI)); }
/* the line on each edge: none inside a plate, a region line between regions or round a plate, a hairline between scales */
{ const edge = new Map(), key = (a, b) => a < b ? a + ':' + b : b + ':' + a;
  CELLS.forEach((C, i) => { for(let k = 0; k < 4; k++){ if(C.v[k] === C.v[(k + 1) & 3]) continue; const kk = key(C.v[k], C.v[(k + 1) & 3]); (edge.get(kk) || edge.set(kk, []).get(kk)).push(i); } });
  CELLS.forEach((C, i) => { for(let k = 0; k < 4; k++){
    if(C.v[k] === C.v[(k + 1) & 3]) continue;
    const nb = edge.get(key(C.v[k], C.v[(k + 1) & 3])).find(j => j !== i), D = nb == null ? null : CELLS[nb];
    let w = LW.hair;
    if(D){ if(C.plate >= 0 && C.plate === D.plate) w = 0; else if(C.zone !== D.zone || C.plate >= 0 || D.plate >= 0 || C.jaw !== D.jaw) w = (C.zone === 5 && D.zone === 6) || (C.zone === 6 && D.zone === 5) ? LW.hair : LW.region; }
    C.ins[k] = w / 2;
  } });
  /* a plate takes its colour from one cell, so it is one even fill */
  const first = new Map(); CELLS.forEach(C => { if(C.plate >= 0){ if(!first.has(C.plate)) first.set(C.plate, C); C.rep = first.get(C.plate); } });
}
const JAWV = [...new Set(CELLS.filter(C => C.jaw).flatMap(C => C.v))], JSLOT = new Map(JAWV.map((v, i) => [v, i]));
/* chunks: the head as one, then runs of eight rows; each is drawn whole, nearest last */
const CHUNKS = [];
{ const rh = idxAt(HL + 22); CHUNKS.push({r0:0, r1:rh, head:true}); const CK = def.chunk ?? 8; for(let r = rh + 1; r < N - 1; r += CK) CHUNKS.push({r0:r, r1:Math.min(N - 2, r + CK - 1)}); }
for(const K of CHUNKS) K.cells = CELLS.map((C, i) => i).filter(i => CELLS[i].r >= K.r0 && CELLS[i].r <= K.r1);
const ROWCELLS = Array.from({length:N}, () => []); CELLS.forEach((C, i) => ROWCELLS[C.r].push(i));

/* ---------- the view ----------
   Seen from in front and above, at P below the horizontal (orthographic). Plan X runs right, plan Y toward the viewer, Z up. On the screen,
   x = X and y = Y sin P - Z cos P. Depth toward the camera is Y cos P + Z sin P. */
const PITCH = .62, GY = Math.sin(PITCH), GZ = Math.cos(PITCH);

/* ---------- springs under minimum-jerk goals: every posture value moves through one ---------- */
/* the look turns from following a world direction to following the body: the body-relative channel starts where the look is, so the
   look's target does not step */
const toRel = (f, to, ms, now) => { const ch = f.ch; if(f.gazeMode !== 'rel'){ ch.rel.v = ch.rel.tg = ch.rel.ts = ch.look.v; ch.rel.vel = 0; ch.rel.g = null; f.gazeMode = 'rel'; } goal(ch.rel, to, ms, now); };
const chan = (v, w = 9) => ({v, vel:0, tg:v, w, w0:w, g:null});
function goal(c, to, ms, now, ease){ c.g = {from:c.tg, to, t0:now, ms:Math.max(1, ms), ease}; }
/* the target is softened before the spring follows it, so even a target that is simply set (a pad, a gaze given way) starts and stops
   without a kick: position, speed and acceleration all stay continuous */
function chStep(c, now, dt){
  if(c.we){ const u = (now - c.we.t0) / c.we.ms; c.w = u >= 1 ? c.w0 : c.we.from + (c.w0 - c.we.from) * s5(u); if(u >= 1) c.we = null; }   // (a stiffness let go of eases back)
  if(c.g){ const u = (now - c.g.t0) / c.g.ms; c.tg = c.g.from + (c.g.to - c.g.from) * (c.g.ease || s5)(u); if(u >= 1) c.g = null; }
  if(c.ts == null) c.ts = c.tg;
  c.ts += (c.tg - c.ts) * (1 - Math.exp(-c.w * 1.8 * dt));
  const a = c.w * c.w * (c.ts - c.v) - 2 * c.w * c.vel; c.vel += a * dt; c.v += c.vel * dt;
}

/* ---------- the states: the body's definition gives each its plan curvature, from the head ---------- */
const STATES = def.states, STATE_IDS = Object.keys(STATES), RING_IDS = STATE_IDS.filter(k => STATES[k].ring), RING = RING_IDS[0];
const isRing = id => !!(STATES[id] && STATES[id].ring);
/* a ring closes on itself turning once round (the pill), or not at all (the figure of eight, whose two loops turn opposite ways) */
const ringTurns = id => STATES[id].turns ?? STATES[id].fill.turns ?? 1;
/* a state with track:true is a laid course held (follow): it has no shape of its own and is reached only by following a course */
const TRACK = STATE_IDS.find(k => STATES[k].track) || null, isTrack = id => !!(STATES[id] && STATES[id].track);
/* A ring holds its tail at the lips (round 19). ch.ring is the length of tail past the lip point (LIPD behind the snout tip): 0 is the true tip held
   between the lips, and the swallow draws it in from there. The shapes are closed at the jaw angle's point, so the station there is
   s1 = L - ring + RUNIN, which lies past the tail's end (L) until RUNIN of tail is in: the tail runs straight on along the head's axis, so a station
   that does not exist is where it would be. The visible tail stops RING_DM short of s1 (the part between the lips and the jaw angle is drawn under the
   head's cells, so it shows only between the open jaws). */
const LIPD = HD.bite ?? 3, RUNIN = S[idxAt(HEADR)] - LIPD;   // (the closure starts at the station at the jaw angle, so the run in is measured from it)
const ringS1 = f => L - f.ch.ring.v + RUNIN;
const RING_SPEED = .19 * L, RING_ACCEL = 6 * RING_SPEED, RING_DM = 4, RING_LUMP = .3;   // (the tail reaches its top speed in a sixth of a second, never in one frame)
const ringFull = id => STATES[id].par.full ?? .12;
/* the stretches of the body its muscles are read and held in */
const REGIONS = (() => { const a = NECK1 + (TAIL0 - NECK1) / 3, b = NECK1 + 2 * (TAIL0 - NECK1) / 3; return [['neck', NECK0, NECK1], ['fore', NECK1, a], ['mid', a, b], ['rear', b, TAIL0], ['tail', TAIL0, L]]; })();
const B = {S, N, DS, L, HL, HEADR, NECK0, NECK1, TAIL0, AMAX, LIPD, RUNIN, ringS1, fA, fB, idxAt, sstep, s5, clamp, lerp, TAU};
/* the ring's time law (creature-ring.js) with this body's own numbers, one for each ring state (each shape can shrink to its own smallest). The
   smallest is found by bending the state's own fill: every station's curvature must keep a radius of at least 1.2 half-widths with the fullness (the
   clamp for a ring is 1.05), and the fill may refuse a size (an eight's crossing needs room) */
const RINGMS = Object.fromEntries(RING_IDS.map(id => {
  const P0 = STATES[id].par, full = ringFull(id), k = new Float64Array(N);
  const fits = s1 => {
    const pf = {ch:{ring:{v:L - s1 + RUNIN}}, coil:1, br:0, par:{}};
    STATES[id].fill(pf, k, P0, B);
    if(pf._ringBad) return false;
    for(let i = 0; i < N && S[i] <= s1; i++) if(Math.abs(k[i]) * A0[i] * (1 + full) * 1.2 > 1) return false;
    return true;
  };
  let lo = HEADR + 2 * (HEADR + 8) + 40, hi = L + RUNIN - (P0.S ?? 0);   // (fits at hi, the start; the smallest that fits is found by halving)
  for(let it = 0; it < 16 && hi - lo > 1; it++){ const m = .5 * (lo + hi); if(fits(m)) hi = m; else lo = m; }
  return [id, CRING.create({length:L, headLength:HL, minLength:Math.min(L - (P0.S ?? 0) - 40, hi - RUNIN), start:P0.S ?? 0, halfWidth:s => fA(s), tipWidth:fA(L - 1), bodyWidth:AMAX, duration:P0.duration ?? 48000, seed:P0.seed ?? 1})];   // (its controllers are capped at RING_SPEED px/s of swallowed length: 3.4 px a frame)
}));
const RINGM = RING ? RINGMS[RING] : null;

/* ---------- one body ---------- */
function create(o = {}){
  const F64 = () => new Float64Array(N);
  const f = {
    pal:makePal({ink:def.ink, ...(def.palette || {}), ...(o.palette || {})}), view:'skin', layers:{contour:true, mesh:true, glyph:false},
    state:o.state || def.start || STATE_IDS[0], trav:null, tape:false, h:0, tp:new Float64Array(16000), tp0:0, tz:new Float64Array(16000), tax:new Float64Array(16000).fill(NaN), tay:new Float64Array(16000).fill(NaN), sup:F64(), anc:false,
    k:F64(), base:F64(), kN:F64(), zN:F64(), zsP:F64(), ARk:Float64Array.from(A0), eN:F64(), eT:F64(), zs:F64(), ra:F64(), z:F64(), rest:F64(), restS:F64(), zr:F64(), w:F64(), X:F64(), Y:F64(), Xp:F64(), Yp:F64(), tx:F64(), ty:F64(),
    bx:F64(), by:F64(), th:F64(), act:F64(), kPrev:F64(), AR:Float64Array.from(A0), BR:Float64Array.from(B0), zl:F64(),
    A:0, TX:0, TY:0, rootFwd:0, headFwd:0, hideFrom:L + 1, coil:1, br:0, breathOn:true, lifeOn:o.life !== false, rate:1.5,
    ch:{look:chan(0, 7), gaze:chan(0, 3), rel:chan(0, 4), H:chan(0, 6), sb:chan(0, 7), pitch:chan(0, 6), gape:chan(0, 12), tongue:chan(0, 30),
      curl:chan(0, 4), lure:chan(0, 5), rattle:chan(0, 8), tailUp:chan(0, 5), ring:chan(RING ? STATES[RING].par.S ?? 0 : 0, 3), lunge:chan(0, 30)},
    gazeMode:'rel', packets:[], later:[], gen:0, pads:{}, held:new Set(), own:{}, bulge:null, shed:null, flick:0, rg:null, rgs:null, ringOn:false, ringDone:null,
    nextBout:0, nextPacket:0, nextMove:0, nextTongue:0, busy:0, queue:null, log:[], vt:null, lastT:0, paused:false, dragDrive:0,
    cam:{x:0, y:0, ok:false}, frames:0, cpu:0, bt:performance.now(),
    /* what the pads set and keep (not held postures): the tempo of everything and the size of every movement, the pace and wriggle of a
       move, the coil's set and the breath's depth; and the muscles held by hand */
    dyn:{tempo:1, motion:1}, mv:{pace:1, wriggle:1}, breathDepth:1, musHold:{}, musC:chan(1, 4), musCN:chan(1, 4), musW:1,
    /* the behaviour layer: additive colour on the body's skin (never the head, eye or lips), in a style, at a rate, from a palette */
    beh:{style:'off', rate:1, pal:[ROSTER.amber, ROSTER.lapis, ROSTER.cinnabar, ROSTER.gold], fx:[]}, glyphRun:null,
  };
  f.par = Object.fromEntries(STATE_IDS.map(k => [k, {...STATES[k].par}]));
  /* each ring state eats on its own time law; f.rg is the one in use (the state the body is in, or last was) */
  f.rgBy = Object.fromEntries(RING_IDS.map(k => [k, RINGMS[k].controller({maxSpeed:RING_SPEED, maxAccel:RING_ACCEL})])); f.rgId = isRing(f.state) ? f.state : RING; f.rg = f.rgBy[f.rgId] || null;
  return f;
}
const clock = f => f.bt;   // the body's own clock: it runs at the Dynamics pad's tempo
/* timers set by bouts and actions belong to the moment they were set in: a move to another state drops the ones still pending (gen) */
const at = (f, ms, fn) => f.later.push({t:clock(f) + ms, fn, gen:f.gen});
const R_ = (a, b) => a + Math.random() * (b - a);
const say = (f, what) => { f.log.push({t:Math.round(clock(f)), what}); if(f.log.length > 40) f.log.shift(); };

/* ---------- the tape: the curvature the head has laid down, kept under the body and ahead of it ---------- */
const tapeAt = (f, sig) => { const x = sig - f.tp0, i = Math.floor(x); if(i < 0) return f.tp[0]; if(i >= f.tp.length - 1) return f.tp[f.tp.length - 1]; return f.tp[i] + (f.tp[i + 1] - f.tp[i]) * (x - i); };
/* a laid course (follow) also writes, for each step of the tape, the height the body stands at there and the world place it passes (NaN where the
   tape was written from a shape on the ground: no height to stand on, no place to be pinned to) */
const tzAt = (f, sig) => { const x = sig - f.tp0, i = Math.floor(x); if(i < 0 || i >= f.tz.length - 1) return 0; return f.tz[i] + (f.tz[i + 1] - f.tz[i]) * (x - i); };
const ancAt = (f, sig, out) => { const x = sig - f.tp0, i = Math.floor(x); if(i < 0 || i >= f.tax.length - 1) return false; const a = f.tax[i], b = f.tax[i + 1]; if(a !== a || b !== b) return false; const u = x - i; out[0] = a + (b - a) * u; out[1] = f.tay[i] + (f.tay[i + 1] - f.tay[i]) * u; return true; };
function tapeRoom(f, ahead){
  if(f.h + ahead + 4 < f.tp0 + f.tp.length) return;
  const keep = Math.floor(f.h - L - 40 - f.tp0), n = f.tp.length - keep;
  f.tp.copyWithin(0, keep); f.tp.fill(0, n); f.tz.copyWithin(0, keep); f.tz.fill(0, n); f.tax.copyWithin(0, keep); f.tax.fill(NaN, n); f.tay.copyWithin(0, keep); f.tay.fill(NaN, n); f.tp0 += keep;
}
/* the shape the body has now, written under it, so a move starts from exactly where it lies */
function tapeHere(f){
  tapeRoom(f, 4000);
  for(let sig = Math.floor(f.h - L - 2); sig <= Math.ceil(f.h) + 1; sig++){ const j = sig - f.tp0; if(j >= 0 && j < f.tp.length){ f.tp[j] = atS(f.base, clamp(f.h - sig, 0, L)); f.tz[j] = 0; f.tax[j] = NaN; f.tay[j] = NaN; } }
}

/* ---------- composing the curvature: base, then the layers ---------- */
function compose(f, now, dt = 1 / 60){
  const k = f.k, ch = f.ch, t = now / 1000;
  if(f.tape) for(let i = 0; i < N; i++) k[i] = tapeAt(f, f.h - S[i]);
  else {
    STATES[f.state].fill(f, k, f.par[f.state], B);
    /* just arrived: the laid track gives way to the state's live shape over a second, so breath or a coil's set never jumps in */
    const u = f.arrive ? (now - f.arrive) / 1100 : 1;
    if(u < 1){ const m = s5(u); for(let i = 0; i < N; i++) k[i] = lerp(tapeAt(f, f.h - S[i]), k[i], m); } else f.arrive = 0;
  }
  f.base.set(k);
  /* a strike pays out the anterior coil: the stretch of the heap behind the neck straightens as the lunge goes, so the head can reach further than
     the free neck is long. The turning taken out of it is the heading the head ends up facing; the strike aimed the head there at the start, so
     the neck's look relaxes as the arm swings round */
  if(f.lng && ch.lunge.v > 1e-4){ const w = f.lng.w, lam = ch.lunge.v * (f.lng.leadAmp ?? 1); for(let i = 0; i < N; i++) if(w[i] > 0) k[i] -= lam * w[i] * k[i]; }
  /* the size of every movement (the Dynamics pad) scales what moves: the waves of tone, the sway, the drift of the look, the lure and the rattle;
     not a posture (a curl, an S-bend, a look aimed somewhere), and not what a strike or a ring must reach */
  const mo = f.dyn.motion, sb = ch.sb.v, curl = ch.curl.v, lure = ch.lure.v * mo, rat = ch.rattle.v * mo;
  const zl = f.zl; zl.fill(0);
  for(let i = 0; i < N; i++){
    const s = S[i];
    if(s > TAIL0){ const u = (s - TAIL0) / (L - TAIL0); k[i] += curl * 2.6 / (L - TAIL0) * u ** 1.6 + lure * .03 * Math.sin(TAU * (s - L) / 62 + TAU * 2.4 * t) * u * u + rat * .011 * Math.sin(TAU * 17 * t + s * .06) * u ** 4; }
  }
  /* packets of tone: a bend with a counter-bend either side, so it moves the body where it is and nowhere else */
  /* (in the nautilus, whose turns touch, a packet mostly rises and settles instead; it keeps the kind it was born as for its whole life) */
  for(const p of f.packets){
    const age = (now - p.t0) / p.life; if(age >= 1) continue;
    const env = Math.sin(Math.PI * age) ** 2 * mo, c = p.c + p.v * (now - p.t0) / 1000, A = p.A * env * (p.naut ? .3 : 1);
    const i0 = idxAt(Math.max(0, c - 3 * p.w)), i1 = idxAt(Math.min(L, c + 3 * p.w));
    for(let i = i0; i <= i1; i++){ const u = (S[i] - c) / p.w, e = Math.exp(-u * u); k[i] += A * (1 - 2 * u * u) * e; if(p.naut) zl[i] += 3.2 * env * e * Math.sign(p.A); }
  }
  f.packets = f.packets.filter(p => now - p.t0 < p.life);
  /* the look: whatever turning is left between the neck's root and where the head means to face */
  let K = 0; for(let i = 0; i < N && S[i] < NECK1; i++) K += k[i] * DS[i];
  const drift = (.05 * Math.sin(.37 * t) + .03 * Math.sin(.91 * t + 1.3)) * mo;
  /* unwrapped about the look it has now: a gaze that ends up behind the neck stays on the side it was on, instead of flipping across */
  const want = f.gazeMode === 'world' ? ch.look.v + wrap(ch.gaze.v + drift - f.rootFwd + K - ch.look.v) : ch.rel.v + drift * .6;
  /* past what the neck can turn, the gaze gives way (it is dragged round with the body) instead of piling up until it flips sides */
  if(f.gazeMode === 'world' && Math.abs(want) > 1.75){ const ex = want - Math.sign(want) * 1.75; ch.gaze.v -= ex; ch.gaze.tg -= ex; if(ch.gaze.g){ ch.gaze.g.from -= ex; ch.gaze.g.to -= ex; } }
  ch.look.tg = clamp(want, -1.75, 1.75);
  const look = ch.look.v;
  /* the neck's own bend (its S and the turn of the look) runs along it: the head answers first and the base follows a moment later, so a
     look or a coil of the neck travels down the body instead of the whole neck bending at once */
  const sway = f.lifeOn && !f.trav && ch.H.v > 40 && !f.held.has('neck') ? (.1 * Math.sin(.23 * t) + .06 * Math.sin(.61 * t + 1)) * mo : 0, sbw = sb + sway, fast = Math.max(1, ch.sb.w / ch.sb.w0);
  for(let i = 0; i < N && S[i] < NECK1; i++){
    const s = S[i], u = clamp((s - NECK0) / (NECK1 - NECK0)), tgt = (s > NECK0 ? sbw * .034 * Math.sin(TAU * u) * Math.sin(Math.PI * u) : 0) - look * WN[i];
    const rate = lerp(16, 4.5, u) * fast; f.kN[i] = dt >= 1 ? tgt : f.kN[i] + (tgt - f.kN[i]) * (1 - Math.exp(-rate * dt));
    k[i] += f.kN[i];
  }
  /* a muscle held by hand bends its stretch. A ring takes only as much of that as it can and stay shut (a full hold on a tight loop opened it by
     hundreds of px), and none of a neck hold (the neck holds the head that holds the tail); a crawl takes none (it follows its laid track, and a
     held bend would swing the head off it). Each share changes through a spring: one that started to change at a rate would kick the tail's tip */
  for(const [mc, ring] of [[f.musC, RING_MUS], [f.musCN, RING_MUS_NECK]]){ mc.tg = f.trav ? 0 : isRing(f.state) ? ring : 1; if(dt >= 1){ mc.v = mc.ts = mc.tg; mc.vel = 0; } else chStep(mc, now, dt); }
  f.musW = clamp(f.musC.v, 0, 1);
  for(const [name, a, b] of REGIONS){ const v = f.musHold[name] * (name === 'neck' ? clamp(f.musCN.v, 0, 1) : f.musW); if(!v) continue; for(let i = 0; i < N; i++){ const s = S[i]; if(s <= a || s >= b) continue; k[i] += v * .016 * Math.sin(Math.PI * (s - a) / (b - a)) ** 2; } }
  /* the head does not bend; nothing bends tighter than the body allows */
  for(let i = 0; i < N; i++){
    const s = S[i]; if(s < HEADR + 6) k[i] *= sstep(HEADR - 4, HEADR + 6, s);
    const lim = (f.ringOn || (isRing(f.state) && !f.tape) ? .95 : .8) / Math.max(f.ARk[i], 7); k[i] = clamp(k[i], -lim, lim);   // a ring may bend a little tighter: it takes the body's own thickness to its smallest
  }
  if(isRing(f.state) && !f.tape){
    /* the jaws hold the tail's last run straight along the head: tone, a shift or a ripple does not bend it there (it would point the tail out of
       the mouth however well the ring is closed at the jaw angle) */
    const s1 = ringS1(f), F = f.par[f.state].flat ?? HEADR + 8;
    for(let i = N - 1; i >= 0 && S[i] > s1 - F - 36; i--) k[i] = f.base[i] + (k[i] - f.base[i]) * (1 - sstep(s1 - F - 36, s1 - F - 6, S[i]));
    /* the ring's own shape is solved again with the layers on it (tone, a shift, a pad, the look): its runs and arcs take up whatever the layers
       move the tail's end by, and its arcs give up whatever turning the layers add, so it stays shut however they bend it. On a tight loop a
       packet of tone moves the far end by tens of px, more than the three smooth corrections below can take out (an eight opened by up to 69).
       While arriving it is this shape that the laid track gives way to, so the hand-over is continuous. */
    planFactors(f);
    if(STATES[f.state].fill.layered){
      const i0 = idxAt(HEADR), i1 = idxAt(s1), m = f.arrive ? s5((now - f.arrive) / 1100) : 1; let turn = 0;
      for(let i = 0; i < N; i++) RD[i] = k[i] - f.base[i];
      for(let i = i0; i < i1; i++) turn += RD[i] * DS[i]; turn += RD[i1] * (s1 - S[i1]);
      STATES[f.state].fill(f, RK, f.par[f.state], B, {d:RD, hf:HF, turn});
      for(let i = 0; i < N; i++){ const lim = .95 / Math.max(f.ARk[i], 7), nb = m < 1 ? lerp(tapeAt(f, f.h - S[i]), RK[i], m) : RK[i]; f.base[i] = nb; k[i] = clamp(nb + RD[i], -lim, lim); }
    }
    /* on arrival the closing eases in with the state's own shape; the correction belongs to the shape, so a move sets off from the ring as closed */
    const pre = Float64Array.from(k); close(f, k, f.arrive ? s5((now - f.arrive) / 1100) : 1); for(let i = 0; i < N; i++) f.base[i] += k[i] - pre[i];
  }
  if(isRing(f.state) && !f.tape){ const hf = ringS1(f) - RING_DM; f.hideFrom = hf >= L ? L + 1 : hf; }   // the visible tail ends in the mouth, a few px before the jaw angle's station (all of it shows while less than RUNIN is in); the jaws' opening comes from the ring's time law
  f.bite = 0;
}

/* the ring stays shut. Whatever bends the ouroboros (tone, breath, a swallow) must still bring the tail round to the jaw angle, facing the way
   the head faces (turned once round for a ring, not at all for an eight). Three smooth corrections along the trunk (an even bend and one wave of
   it either way) are solved each frame to close it. The plan is measured as integrate() lays it: a stretch that rises over another part (an
   eight's crossing) covers less ground than its length (HF, from last frame's heights). */
const HF = new Float64Array(N).fill(1), RD = new Float64Array(N), RK = new Float64Array(N);
function planFactors(f){ for(let i = 0; i < N - 1; i++){ const q = (f.z[i + 1] - f.z[i]) / DS[i]; HF[i] = Math.sqrt(Math.max(.03, 1 - q * q)); } }
function ringEnd(k, s1){
  const i0 = idxAt(HEADR), i1 = idxAt(s1); let th = 0, x = 0, y = 0;
  for(let i = i0; i < i1; i++){ const t2 = th + k[i] * DS[i], h = DS[i] * HF[i]; x += h * Math.cos(.5 * (th + t2)); y += h * Math.sin(.5 * (th + t2)); th = t2; }
  const fr = (s1 - S[i1]); return [x + fr * Math.cos(th), y + fr * Math.sin(th), th + k[i1] * fr];
}
function close(f, k, wgt = 1){
  const s1 = ringS1(f), a = HEADR + 60, b = s1 - 50, dir = f.par[f.state].dir, turns = ringTurns(f.state);
  const basis = j => { const out = new Float64Array(N); for(let i = 0; i < N; i++){ const s = S[i]; if(s < a || s > b) continue; const u = (s - a) / (b - a), w = Math.sin(Math.PI * u) ** 2; out[i] = w * (j === 0 ? 1 : j === 1 ? Math.cos(TAU * u) : Math.sin(TAU * u)); } return out; };
  if(!close.B) close.B = {};
  const key = Math.round(s1); if(!close.B[key]){ close.B = {[key]:[basis(0), basis(1), basis(2)]}; }
  const B = close.B[key];
  for(let it = 0; it < 2; it++){
    const e0 = ringEnd(k, s1), res = [e0[0], e0[1], e0[2] - dir * TAU * turns], eps = 2e-4, J = []; if(it === 0) f.ringRes0 = res.slice(); else f.ringRes1 = res.slice();
    for(let j = 0; j < 3; j++){ const kk = Float64Array.from(k); for(let i = 0; i < N; i++) kk[i] += eps * B[j][i]; const e = ringEnd(kk, s1); J.push([(e[0] - e0[0]) / eps, (e[1] - e0[1]) / eps, (e[2] - e0[2]) / eps]); }
    /* solve J^T c = -res (columns of J are the three modes' effects) */
    const m = [[J[0][0], J[1][0], J[2][0]], [J[0][1], J[1][1], J[2][1]], [J[0][2], J[1][2], J[2][2]]];
    const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    if(Math.abs(det) < 1e-12) return;
    const col = (j, r) => { const q = m.map(row => row.slice()); for(let i = 0; i < 3; i++) q[i][j] = r[i]; return q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) - q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) + q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0]); };
    const r = [-res[0], -res[1], -res[2]], c = [col(0, r) / det, col(1, r) / det, col(2, r) / det];
    for(let j = 0; j < 3; j++){ const cj = clamp(c[j], -.01, .01) * wgt; for(let i = 0; i < N; i++) k[i] += cj * B[j][i]; }   // (always the whole step: a step chosen afresh each frame, halved or not, makes the shape jump between frames)
  }
}

/* ---------- breath and the throat: the cross-section swells ---------- */
function swell(f, now){
  const t = now / 1000, P = 7.6 / Math.max(.4, Math.sqrt(f.rate / 1.5)), u = (t % P) / P;
  const b = !f.breathOn ? 0 : u < .3 ? s5(u / .3) : u < .36 ? 1 : u < .62 ? 1 - s5((u - .36) / .26) : 0;
  f.br = lerp(f.br, b, .2);
  /* a ring that is eating its tail: lumps going down the throat and into the body, the body fuller as it takes length in (the swallowed volume
     has to go somewhere), and the end of the tail drawn in to the width of the mouth it is entering */
  const st = f.ringOn ? f.rgs : null, s1 = ringS1(f), full = st ? ringFull(f.state) * Math.pow(st.fraction, .85) : 0;
  for(let i = 0; i < N; i++){
    const s = S[i], lung = sstep(90, 200, s) * (1 - sstep(520, 720, s));
    let g = 1 + .075 * f.br * lung * f.breathDepth, ar, br;
    if(st) g += full * sstep(60, 160, s) * (1 - sstep(s1 - 150, s1 - 50, s));
    f.ARk[i] = A0[i] * g;   // (what the body can bend round: the throat's lumps pass, and do not make the ring open)
    if(st){
      for(const lp of st.lumps){ const c = lp.pos + HL * .3, d = (s - c) / lp.w; if(d > -3 && d < 3) g += RING_LUMP * lp.amp * Math.exp(-d * d) * sstep(HL * .7, HL * 1.5, s); }
    }
    ar = A0[i] * g; br = B0[i] * g;
    if(st){ const tp = sstep(s1 - HEADR - 70, s1 - HEADR + 2, s); if(tp > 0){ ar = lerp(ar, Math.min(ar, 5.4 + .1 * ar), tp); br = lerp(br, Math.min(br, 4.8 + .1 * br), tp); } }
    f.AR[i] = ar; f.BR[i] = br;
  }
}

/* ---------- height: contact, the neck's raise, the tail's lift ---------- */
/* The raised neck, as an elevation angle along the body (round 18). Its height is no longer a profile placed on the stations (which was steeper
   than the body is long: the neck stretched threefold in its steep part and met the coil and the head in two hard elbows). The neck's slope e(s)
   is a field; z is its integral from the root, so arc length is conserved and nothing is steeper than the body is long. The field is a smooth
   hump (zero at the root, where the body leaves the coil flat; zero at the head, which carries only its own tilt), scaled to put the head at
   the height H. riseLen is how much body the free neck holds: long enough that the steepest part stays under about 70 degrees. */
const riseLen = H => 36 + 1.3 * Math.sqrt(H * H + 36);
const riseRoot = H => HL + riseLen(H);
const EP = new Float64Array(N), EBW = new Float64Array(N), CB = 14;
/* fills f.eT with the target elevation angle of every station for a head height H, a head pitch, and the root at sr; returns the plan reach of
   the free neck (the sum of cos e ds), which a strike needs to know */
function elevation(f, H, pitch, sr){
  const eT = f.eT, Lr = Math.max(8, sr - HL), i1 = idxAt(sr);
  let iH = 0; while(iH < i1 && S[iH] < HL) iH++;
  for(let i = 0; i < N; i++){
    if(i >= i1){ eT[i] = 0; EBW[i] = 0; EP[i] = 0; continue; }
    const s = S[i], u = clamp((s - HL) / Lr);
    EBW[i] = s <= HL ? 0 : sstep(0, .3, u) * (1 - sstep(.7, 1, u));
    EP[i] = -pitch * (1 - sstep(0, .38, u));
  }
  let lo = -1.45, hi = 1.52;
  for(let it = 0; it < 18; it++){
    const mid = .5 * (lo + hi); let h = 0;
    for(let i = iH; i < i1; i++) h += Math.sin(EP[i] + mid * EBW[i]) * DS[i];
    if(h < H) lo = mid; else hi = mid;
  }
  const ph = .5 * (lo + hi); let reach = 0;
  for(let i = 0; i < i1; i++){ eT[i] = EP[i] + ph * EBW[i]; if(i >= iH) reach += Math.cos(eT[i]) * DS[i]; }
  f.elPhi = ph;
  return reach;
}
function heights(f, dt){
  const X = f.X, Y = f.Y, AR = f.AR, BR = f.BR, rest = f.rest, restS = f.restS, z = f.z, zr = f.zr, hide = f.hideFrom;
  const tt = (f.vt ?? performance.now()) / 1000, up = f.ch.tailUp.v;
  /* the head's height above the root: the channel (with a slow sway while raised), and a strike's lunge takes it down toward the target's height */
  const Hc = f.ch.H.v + (f.lifeOn && !f.trav && f.ch.H.v > 40 ? 3 * Math.sin(.29 * tt) + 1.6 * Math.sin(.71 * tt + 2) : 0);
  const lam = f.ch.lunge.v, Hh = lam > 1e-4 && f.lng ? Hc + lam * (f.lng.Hl - Hc) : Hc;
  /* the free neck holds as much body as its cocked height needs; a strike keeps that length (the neck unfolds, it does not shorten as it drops) */
  /* the free neck's length follows its target at a limited speed (fast to grow, slower to shrink): a root that ran up the body as the neck lowered
     would leave the slopes still lagging behind it as a sharp bend where the neck meets what it lies on */
  const srT = riseRoot(Math.max(0, Hc));
  f.srS = f.srS == null || dt >= 1 ? srT : f.srS + Math.max(-60 * dt, Math.min(100 * dt, (srT - f.srS) * (1 - Math.exp(-6 * dt))));
  const sr = f.srS, ir = idxAt(sr), kd = 1 - Math.exp(-7 * dt), ku = 1 - Math.exp(-13 * dt);
  f.reach = elevation(f, Hh + CB, f.ch.pitch.v, sr);   // (CB: the raise is blended onto the terrain over a width of 2 CB and sits CB below itself where it is clear of it)
  const fast = Math.max(1, f.ch.H.w / f.ch.H.w0), eN = f.eN, eT = f.eT, iD = idxAt(Math.min(L, riseRoot(240) + 40));
  /* a laid course (follow): each station stands at least at the height the course has where it lies (a trunk climbed, a branch); 0 elsewhere */
  const sp = f.sup; if(f.tape) for(let i = 0; i < N; i++) sp[i] = tzAt(f, f.h - S[i]); else sp.fill(0);
  /* the head does not ride over the tail it holds (the tail goes into the mouth), nor over the tip it is coming to bite or has just let go */
  const ringNear = isRing(f.state) || (f.trav && (isRing(f.trav.to) || isRing(f.trav.from))), sNear = L - (f.ringOn ? f.ch.ring.v : 0) - 90;
  let hrun = 0, rootRest = 0;   // the raise left in the slopes from here to the deepest the root can be: parts that fell behind the root while the neck was lowering keep falling by their own lag
  for(let i = N - 1; i >= 0; i--){
    let r = BR[i];
    if(S[i] <= hide) for(let j = J0[i]; j < N; j++){
      if(S[j] > hide) break;
      if(j < ir) continue;   // within the rising neck nothing rests on the rise itself: an upright neck overlaps itself in plan without lying on itself
      if(ringNear && S[i] < HEADR + 12 && S[j] > sNear) continue;
      const dx = X[i] - X[j]; if(dx > 44 || dx < -44) continue;   // wider than any contact reaches (1.25 x two widths), so the cut never truncates a lift
      const dy = Y[i] - Y[j], ra = AR[i] + AR[j], d2 = dx * dx + dy * dy; if(d2 >= 1.5625 * ra * ra) continue;
      /* the lift begins a little before the two touch and is full well before they are centred, eased: a circle's own profile is a cliff at
         the edge, and a body sliding onto another would jump */
      const zz = zr[j] + (BR[i] + BR[j]) * s5((1.25 * ra - Math.sqrt(d2)) / (.9 * ra)); if(zz > r) r = zz;   // j lies tailward, so its height this pass is already known: the stack is exact in one pass
    }
    rest[i] = r;
    restS[i] = !restS[i] || dt >= 1 ? r : restS[i] + (r - restS[i]) * (r > restS[i] ? ku : kd);   // eased both ways: climbing quickly, settling slowly
    if(i === ir){ const t = (sr - S[ir]) / DS[ir], zr0 = dt >= 1 ? restS : f.zsP, i2 = Math.min(N - 1, ir + 1), want = Math.max(lerp(zr0[ir], zr0[i2], clamp(t)), lerp(sp[ir], sp[i2], clamp(t))); f.rootZ = f.rootZ == null || dt >= 1 ? want : f.rootZ + (want - f.rootZ) * (1 - Math.exp(-(want < f.rootZ ? 12 : 5) * dt)); rootRest = want; }   // (the root's height follows down faster than up: a root that has come down off a coil's top must not hold the neck up)
    let q = restS[i] + f.zl[i];
    const rs = Math.max(restS[i], sp[i]);   // what the station stands on: what it rests on, or the course it was laid on
    /* each part's slope answers in turn, head first, and the height is the integral of the slopes from the root: so a raise or a lunge runs down
       the neck, and arc length is kept at every moment (a lag on the heights themselves would stretch the neck as it moved) */
    const rate = lerp(13, 5, clamp((S[i] - HL) / 160)) * fast;
    eN[i] = dt >= 1 ? eT[i] : eN[i] + (eT[i] - eN[i]) * (1 - Math.exp(-rate * dt));
    if(i < iD) hrun += Math.sin(eN[i]) * DS[i];
    /* the neck stands on the root's height, smoothed in time; the part just above the root moves from what the ground is there to that height, so
       a root that has moved faster than its smoothed height can follow (a lowering neck) never leaves a step */
    let ra = (i < ir ? rootRest + (f.rootZ - rootRest) * sstep(0, 1, (sr - S[i]) / Math.max(45, 2.5 * Math.abs(f.rootZ - rootRest))) : rs) + hrun;   // (the blend is wide enough that it adds under 0.4 of slope to the raise's own)
    f.zN[i] = ra;
    if(S[i] > TAIL0 && up > .01){ const u = (S[i] - TAIL0) / (L - TAIL0); ra = Math.max(ra, rs + up * 46 * u * u * u); }
    f.zs[i] = q; f.ra[i] = ra;
    zr[i] = Math.max(q, sp[i], ra);   // (what lies further toward the head rests on this height, raise and all)
  }
  /* ramps either side of whatever the body lies over. Only the resting height is ramped: the neck's rise is already smooth, and ramping
     it too sent a front rippling abruptly down the body behind a fast rise */
  const zs = f.zs;
  /* (the ground under the neck and head slopes away from a high neighbour more gently than under the rest of the body, so a neck passing over
     the edge of a coil does not turn sharply there) */
  const rampAt = i => S[i] < NECK1 + 130 ? .3 : .5;
  /* a station laid on a raised course (a trunk, a branch) stands on it and is neither ramped nor smoothed: the course is already smooth and as steep as
     the body laid on it, and a ramp shallower than a climb (a helix falls about .6 a px) held the whole body above its trunk, by more toward the tail */
  const onC = i => sp[i] > .5;
  if(f.tape) for(let i = 0; i < N; i++) if(onC(i)) zs[i] = Math.max(zs[i], sp[i] + f.zl[i]);
  for(let i = N - 2; i >= 0; i--) if(!onC(i)) zs[i] = Math.max(zs[i], zs[i + 1] - rampAt(i) * DS[i]);
  for(let i = 1; i < N; i++) if(!onC(i)) zs[i] = Math.max(zs[i], zs[i - 1] - rampAt(i) * DS[i - 1]);
  /* (the smoothing may round a lone station's peak a little below what it rests on: one station lifted a px above its neighbours, with the ramps
     either side of it, is a tent whose ridge turned the nautilus's neck 26-33 degrees between stations) */
  for(let pass = 0; pass < 6; pass++) for(let i = 1; i < N - 1; i++) if(!onC(i)) zs[i] = Math.max(restS[i] - Math.min(1.2, Math.max(0, restS[i] - .5 * (restS[i - 1] + restS[i + 1]))), (zs[i - 1] + 2 * zs[i] + zs[i + 1]) / 4);
  if(f.tape) for(let i = 0; i < N; i++) zs[i] = Math.max(zs[i], sp[i] + f.zl[i]);   // (and nothing on the ground beside a course sinks into it)
  f.zsP.set(zs);   // (the ramped ground, kept for next frame: the neck's root stands on it, so a neck lowered beside a coil lands on the slope the coil makes, not below it)
  for(let i = 0; i < N; i++){
    /* the raise takes over from the resting height smoothly: a plain max is a kink where a rising neck overtakes what it lay on, and the
       part would leap from still to rising in one frame (g is 0 below, x - 5 above 10, and its slope runs 0 to 1 in between) */
    const x = f.ra[i] - zs[i]; z[i] = zs[i] + (x <= 0 ? 0 : x >= 2 * CB ? x - CB : x * x / (4 * CB));
    const off = Math.max(0, z[i] - Math.max(restS[i], sp[i]) - f.zl[i]);   // (a station on its course touches it, as one on the ground does)
    f.w[i] = S[i] > hide ? 0 : Math.exp(-off / 5) * (A0[i] * B0[i]) / (AMAX * AMAX) + 1e-4;
  }
}

/* ---------- the shape, and where friction puts it ---------- */
function integrate(f){
  const k = f.k, z = f.z, th = f.th, bx = f.bx, by = f.by;
  th[M] = 0; bx[M] = 0; by[M] = 0;
  const hor = (i, j) => { const ds = Math.abs(S[j] - S[i]), q = (z[j] - z[i]) / ds; return ds * Math.sqrt(Math.max(.03, 1 - q * q)); };
  for(let i = M; i < N - 1; i++){ th[i + 1] = th[i] + .5 * (k[i] + k[i + 1]) * DS[i]; const m = .5 * (th[i] + th[i + 1]), hs = hor(i, i + 1); bx[i + 1] = bx[i] + hs * Math.cos(m); by[i + 1] = by[i] + hs * Math.sin(m); }
  for(let i = M; i > 0; i--){ th[i - 1] = th[i] - .5 * (k[i] + k[i - 1]) * DS[i - 1]; const m = .5 * (th[i] + th[i - 1]), hs = hor(i - 1, i); bx[i - 1] = bx[i] - hs * Math.cos(m); by[i - 1] = by[i] - hs * Math.sin(m); }
}
const CN = 1, CT = .033, KANC = 6;
/* a station on a laid course (follow) is pinned to the world place the course gave it, isotropically and KANC times as hard as friction holds a
   station on the ground: the body then winds round a trunk exactly however its shape was integrated */
const AX = new Float64Array(N), AY = new Float64Array(N), AH = new Uint8Array(N), ATMP = [0, 0];
function fit(f, drive){
  const bx = f.bx, by = f.by, w = f.w, Xp = f.Xp, Yp = f.Yp, tx = f.tx, ty = f.ty;
  let A = f.A, TX = f.TX, TY = f.TY, na = 0;
  if(f.tape) for(let i = 0; i < N; i++){ AH[i] = ancAt(f, f.h - S[i], ATMP) ? 1 : 0; if(AH[i]){ AX[i] = ATMP[0]; AY[i] = ATMP[1]; na++; } } else AH.fill(0);
  f.anc = na;
  f.neckPin = (f.neckPin ?? 1) + ((f.trav ? 1 : .06) - (f.neckPin ?? 1)) * .06;
  if(f.pinBlend != null && f.pinBlend < 1) f.pinBlend = Math.min(1, f.pinBlend + .045);   // (a course taking hold: about a third of a second)
  for(let it = 0; it < 3; it++){
    const ca = Math.cos(A), sa = Math.sin(A);
    let sw = 0, cx = 0, cy = 0;
    for(let i = 0; i < N; i++){ const wi = w[i]; sw += wi; cx += wi * (ca * bx[i] - sa * by[i] + TX); cy += wi * (sa * bx[i] + ca * by[i] + TY); }
    cx /= sw; cy /= sw;
    let H00 = 0, H01 = 0, H02 = 0, H11 = 0, H12 = 0, H22 = 0, g0 = 0, g1 = 0, g2 = 0;
    for(let i = 0; i < N; i++){
      let wi = w[i]; if(wi < 1e-5) continue;
      const qx = ca * bx[i] - sa * by[i] + TX, qy = sa * bx[i] + ca * by[i] + TY, t0 = tx[i], t1 = ty[i];
      let rx, ry, m00, m01, m11;
      if(AH[i] && S[i] >= NECK1){ rx = qx - AX[i]; ry = qy - AY[i]; m00 = m11 = 1; m01 = 0; wi *= KANC; }   // (the neck is free: a look moves the head, not the coil)
      else { if(AH[i]) wi *= .1; rx = qx - (Xp[i] - drive * t0); ry = qy - (Yp[i] - drive * t1); const d = CT - CN; m00 = CN + d * t0 * t0; m01 = d * t0 * t1; m11 = CN + d * t1 * t1; }
      const jx = -(qy - cy), jy = qx - cx;
      const a0 = m00 * jx + m01 * jy, a1 = m01 * jx + m11 * jy, mr0 = m00 * rx + m01 * ry, mr1 = m01 * rx + m11 * ry;
      H00 += wi * m00; H01 += wi * m01; H02 += wi * a0; H11 += wi * m11; H12 += wi * a1; H22 += wi * (jx * a0 + jy * a1);
      g0 += wi * mr0; g1 += wi * mr1; g2 += wi * (jx * mr0 + jy * mr1);
    }
    const e = 1e-7 * sw; H00 += e; H11 += e; H22 += e * 1e3;
    /* the 3x3 solve, by Cramer's rule */
    const c00 = H11 * H22 - H12 * H12, c01 = H02 * H12 - H01 * H22, c02 = H01 * H12 - H02 * H11, det = H00 * c00 + H01 * c01 + H02 * c02;
    if(Math.abs(det) < 1e-12) break;
    const c11 = H00 * H22 - H02 * H02, c12 = H01 * H02 - H00 * H12, c22 = H00 * H11 - H01 * H01;
    const dx = -(c00 * g0 + c01 * g1 + c02 * g2) / det, dy = -(c01 * g0 + c11 * g1 + c12 * g2) / det, dA = -(c02 * g0 + c12 * g1 + c22 * g2) / det;
    const cd = Math.cos(dA), sd = Math.sin(dA), ux = TX - cx, uy = TY - cy;
    TX = cd * ux - sd * uy + cx + dx; TY = sd * ux + cd * uy + cy + dy; A += dA;
    if(Math.abs(dA) < 1e-7 && Math.abs(dx) + Math.abs(dy) < 1e-5) break;
  }
  f.A = A; f.TX = TX; f.TY = TY;
  place(f);
}
function place(f){
  const ca = Math.cos(f.A), sa = Math.sin(f.A);
  for(let i = 0; i < N; i++){ f.X[i] = ca * f.bx[i] - sa * f.by[i] + f.TX; f.Y[i] = sa * f.bx[i] + ca * f.by[i] + f.TY; }
  const pinned = f.tape && f.anc ? pinCourse(f) : false;
  for(let i = 0; i < N; i++){ const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), dx = f.X[b] - f.X[a], dy = f.Y[b] - f.Y[a], l = Math.hypot(dx, dy) || 1; f.tx[i] = dx / l; f.ty[i] = dy / l; }
  const iN = idxAt(NECK1);
  if(pinned){ f.rootFwd = Math.atan2(f.Y[iN] - f.Y[iN + 2], f.X[iN] - f.X[iN + 2]); f.headFwd = Math.atan2(f.Y[0] - f.Y[2], f.X[0] - f.X[2]); }
  else { f.rootFwd = f.th[iN] + f.A + Math.PI; f.headFwd = f.th[0] + f.A + Math.PI; }
  f.Xp.set(f.X); f.Yp.set(f.Y);
}
/* a body on a laid course is where the course says (follow-the-leader exactly): each pinned station is put on its place; a free stretch (the neck of a
   body holding its course, which looks about; a gap that was raised when the course was laid) is integrated from the pin beside it with the body's
   own curvature and plan length, and a gap between two pins is bent to meet both. The rigid fit's placement is only the start (and what the friction
   uses next frame); this is what is drawn. The neck is pinned only while travelling. */
const PRE_X = new Float64Array(N), PRE_Y = new Float64Array(N);
function pinCourse(f){
  const X = f.X, Y = f.Y, k = f.k, z = f.z, np = f.neckPin ?? 1, pb = f.pinBlend ?? 1;
  if(pb < 1){ PRE_X.set(X); PRE_Y.set(Y); }
  /* (the neck is never pinned: it is integrated from the body behind it with the course's own curvature, so it follows the course as the body moves and
     looks about when the body holds) */
  const pin = i => AH[i] === 1 && S[i] >= NECK1;
  let any = false; for(let i = 0; i < N; i++) if(pin(i)){ X[i] = AX[i]; Y[i] = AY[i]; any = true; }
  if(!any) return false;
  const hor = (i, j) => { const ds = Math.abs(S[j] - S[i]), q = (z[j] - z[i]) / ds; return ds * Math.sqrt(Math.max(.03, 1 - q * q)); };
  /* the heading toward the tail at a pin: from it to the nearest other pin either side (never from a free station, whose place is not yet known) */
  const headingAt = j => { for(let d = 1; d <= 8; d++){ if(j + d < N && pin(j + d)) return Math.atan2(Y[j + d] - Y[j], X[j + d] - X[j]); if(j - d >= 0 && pin(j - d)) return Math.atan2(Y[j] - Y[j - d], X[j] - X[j - d]); } return f.headFwd + Math.PI; };
  let i = 0;
  while(i < N){
    if(pin(i)){ i++; continue; }
    let j = i; while(j < N && !pin(j)) j++;   // free run [i, j)
    const a = i - 1, b = j;                    // the pins either side (a < 0: none toward the head; b = N: none toward the tail)
    if(a < 0 && b >= N) return false;
    if(a < 0){   // the neck, toward the head from the pin at its root: the course's own places, deflected by what the neck adds to the course's curvature
      /* two integrations from the root over the course's own spacing (its pins' plan distances): one with the neck's live curvature (the course's, plus
         a look or an S-bend), one with the course's curvature alone; the neck is the course plus their difference. With nothing added it lies exactly
         on the course (no height noise turned into plan length); a look bends it smoothly from its root. */
      const kc = q => { let v = tapeAt(f, f.h - S[q]); const s0 = S[q]; if(s0 < HEADR + 6) v *= sstep(HEADR - 4, HEADR + 6, s0); const lim = .8 / Math.max(f.ARk[q], 7); return clamp(v, -lim, lim); };
      const base = q => { if(AH[q] === 1) return [AX[q], AY[q]]; return null; };
      /* (past the course's end, where a station has no place on it, the course goes on by its own integration from the last place it had) */
      let th1 = headingAt(b), th2 = th1, p1x = X[b], p1y = Y[b], p2x = X[b], p2y = Y[b], cx = X[b], cy = Y[b];
      for(let q = b; q > i; q--){
        const B0q = base(q), B1q = base(q - 1), hs = B0q && B1q ? Math.hypot(B0q[0] - B1q[0], B0q[1] - B1q[1]) : hor(q - 1, q);
        const t1 = th1 - .5 * (k[q] + k[q - 1]) * DS[q - 1], t2 = th2 - .5 * (kc(q) + kc(q - 1)) * DS[q - 1];
        const ex = hs * Math.cos(.5 * (th2 + t2)), ey = hs * Math.sin(.5 * (th2 + t2));
        p1x -= hs * Math.cos(.5 * (th1 + t1)); p1y -= hs * Math.sin(.5 * (th1 + t1)); p2x -= ex; p2y -= ey; th1 = t1; th2 = t2;
        if(B1q){ cx = B1q[0]; cy = B1q[1]; } else { cx -= ex; cy -= ey; }
        X[q - 1] = cx + (p1x - p2x); Y[q - 1] = cy + (p1y - p2y);
      }
    } else if(b < N){   // a gap between two pins: a smooth curve from one to the other along their headings, the stations spaced by their arc
      const ha = headingAt(a), hb = headingAt(b), L0 = S[b] - S[a], m = L0 * .9, P0 = [X[a], Y[a]], P1 = [X[b], Y[b]], T0 = [Math.cos(ha) * m, Math.sin(ha) * m], T1 = [Math.cos(hb) * m, Math.sin(hb) * m];
      for(let q = i; q < j; q++){ const p = hermite(P0, T0, P1, T1, (S[q] - S[a]) / L0); X[q] = p[0]; Y[q] = p[1]; }
    } else {     // from pin a on to the tail
      let th = headingAt(a), px = X[a], py = Y[a];
      for(let q = a; q < N - 1; q++){ const t2 = th + .5 * (k[q] + k[q + 1]) * DS[q], mm = .5 * (th + t2), hs = hor(q, q + 1); px += hs * Math.cos(mm); py += hs * Math.sin(mm); th = t2; X[q + 1] = px; Y[q + 1] = py; }
    }
    i = j;
  }
  if(pb < 1) for(let q = 0; q < N; q++){ X[q] = PRE_X[q] + (X[q] - PRE_X[q]) * s5(pb); Y[q] = PRE_Y[q] + (Y[q] - PRE_Y[q]) * s5(pb); }
  return true;
}

/* ---------- moving: a route to a new state, laid on the tape ahead of the head ---------- */
function shapeOf(f, id){
  const k = new Float64Array(N), x = new Float64Array(N), y = new Float64Array(N), th = new Float64Array(N);
  const keep = {coil:f.coil, br:f.br, o:f.ch.ring.v}; f.coil = 1; f.br = 0; if(isRing(id)) f.ch.ring.v = f.par[id].S ?? 0;
  STATES[id].fill(f, k, f.par[id], B);
  f.coil = keep.coil; f.br = keep.br; f.ch.ring.v = keep.o;
  for(let i = 0; i < N; i++) if(S[i] < HEADR + 6) k[i] *= sstep(HEADR - 4, HEADR + 6, S[i]);
  for(let i = 0; i < N - 1; i++){ th[i + 1] = th[i] + .5 * (k[i] + k[i + 1]) * DS[i]; const m = .5 * (th[i] + th[i + 1]); x[i + 1] = x[i] + DS[i] * Math.cos(m); y[i + 1] = y[i] + DS[i] * Math.sin(m); }
  let cx = 0, cy = 0; for(let i = 0; i < N; i++){ cx += x[i]; cy += y[i]; } cx /= N; cy /= N;
  let ext = 0; for(let i = 0; i < N; i++) ext = Math.max(ext, Math.hypot(x[i] - cx, y[i] - cy));
  return {k, x, y, th, cx, cy, ext};
}
const hermite = (p0, t0, p1, t1, u) => { const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2; return [h00 * p0[0] + h10 * t0[0] + h01 * p1[0] + h11 * t1[0], h00 * p0[1] + h10 * t0[1] + h01 * p1[1] + h11 * t1[1]]; };
function planRoute(f, id, far = 1, at = null){
  const sh = shapeOf(f, id), hx = f.X[0], hy = f.Y[0], hf = f.headFwd;
  let bcx = 0, bcy = 0; for(let i = 0; i < N; i++){ bcx += f.X[i]; bcy += f.Y[i]; } bcx /= N; bcy /= N;
  let best = null;
  /* (at: the caller places the state, {x, y, rho} for its centre and turn, as a stage puts the heap among a tree's roots; one candidate, no search) */
  for(let n = 0; n < (at ? 1 : 70); n++){
    const ang = n < 35 ? hf + R_(-1.3, 1.3) : R_(0, TAU), d = (sh.ext + R_(110, 360)) * far, cx = at ? at.x : bcx + d * Math.cos(ang), cy = at ? at.y : bcy + d * Math.sin(ang), rho = at ? at.rho : R_(0, TAU);
    const ca = Math.cos(rho), sa = Math.sin(rho), W = i => [ca * (sh.x[i] - sh.cx) - sa * (sh.y[i] - sh.cy) + cx, sa * (sh.x[i] - sh.cx) + ca * (sh.y[i] - sh.cy) + cy];
    const E = W(N - 1), eF = sh.th[N - 1] + rho + Math.PI, dist = Math.hypot(E[0] - hx, E[1] - hy), m = .5 * dist + 70;
    const t0 = [Math.cos(hf) * m, Math.sin(hf) * m], t1 = [Math.cos(eF) * m, Math.sin(eF) * m];
    let len = 0, kmax = 0, prev = [hx, hy], ph = hf;
    for(let q = 1; q <= 48; q++){ const p = hermite([hx, hy], t0, E, t1, q / 48), dx = p[0] - prev[0], dy = p[1] - prev[1], l = Math.hypot(dx, dy), a = Math.atan2(dy, dx); len += l; if(l > .1){ kmax = Math.max(kmax, Math.abs(wrap(a - ph)) / l); ph = a; } prev = p; }
    let pen = 0;
    for(let i = 0; i < N; i += 6){ const p = W(i); const r = Math.hypot(p[0], p[1]); if(r > 470) pen += (r - 470) * .4; for(let j = 0; j < N; j += 8){ const dd = Math.hypot(p[0] - f.X[j], p[1] - f.Y[j]); if(dd < 3 * AMAX) pen += (3 * AMAX - dd) * .6; } }
    const score = len * .6 + pen + Math.max(0, kmax - 1 / (2.4 * AMAX)) * 9000;
    if(!best || score < best.score) best = {score, E, eF, t0, t1, len, rho, cx, cy, W};
  }
  /* the approach, sampled at 1 px, with a wave about it, then its curvature */
  const pts = [];
  for(let q = 0; q <= 400; q++) pts.push(hermite([hx, hy], best.t0, best.E, best.t1, q / 400));
  const res = [pts[0]]; let acc = 0;
  for(let q = 1; q < pts.length; q++){ const a = pts[q - 1], b = pts[q], l = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = 1 - acc; while(t <= l){ const u = t / l; res.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); t += 1; } acc = l - (t - 1); }
  /* (the wave's envelope is clamped at zero: sin(pi) can round a hair below it, and a negative number to the power 1.5 is NaN) */
  const n = res.length, lam = R_(330, 430), amp = (n > 260 ? R_(30, 48) : 0) * Math.min(1, n / 500) * f.mv.wriggle, ph0 = Math.random() < .5 ? 0 : Math.PI;
  const wav = res.map((p, q) => { const a = q < n - 1 ? Math.atan2(res[q + 1][1] - p[1], res[q + 1][0] - p[0]) : Math.atan2(p[1] - res[q - 1][1], p[0] - res[q - 1][0]), e = Math.max(0, Math.sin(Math.PI * q / (n - 1))) ** 1.5, o = amp * e * Math.sin(TAU * q / lam + ph0); return [p[0] - Math.sin(a) * o, p[1] + Math.cos(a) * o]; });
  const hd = []; for(let q = 0; q < n - 1; q++) hd.push(Math.atan2(wav[q + 1][1] - wav[q][1], wav[q + 1][0] - wav[q][0]));
  const kf = new Float64Array(n); for(let q = 1; q < n - 1; q++){ const dl = Math.hypot(wav[q + 1][0] - wav[q][0], wav[q + 1][1] - wav[q][1]) || 1; kf[q] = wrap(hd[q] - hd[q - 1]) / dl; }
  const ks = new Float64Array(n); for(let q = 0; q < n; q++){ let s = 0, ws = 0; for(let d = -14; d <= 14; d++){ const j = q + d; if(j < 0 || j >= n) continue; const g = Math.exp(-(d * d) / 50); s += kf[j] * g; ws += g; } ks[q] = s / ws; }
  return {to:id, appr:ks, sh, best, wav};
}
function startMove(f, id, o = {}){
  f.gen++; f.busy = 0;
  const now = clock(f), r = planRoute(f, id, o.far || 1, o.at || null);
  if(!f.tape){ tapeHere(f); f.tape = true; }
  tapeRoom(f, r.appr.length + L + 40);
  const h0 = f.h, k0 = tapeAt(f, h0), n = r.appr.length, ch0H = f.ch.H.v;
  /* a placed state (o.at) is pinned to its place as it is laid, so it lands where the caller put it; any other route is placed by friction alone */
  const pin = !!o.at, sx = pin ? Float64Array.from(S, s => 0) : null, sy = pin ? Float64Array.from(S, s => 0) : null;
  if(pin){ const W = r.best.W; for(let i = 0; i < N; i++){ const w = W(i); sx[i] = w[0]; sy[i] = w[1]; } }
  for(let q = 1; q <= n; q++){ const j = Math.round(h0 + q - f.tp0), kb = -r.appr[q - 1], u = s5(q / 40); f.tp[j] = lerp(k0, kb, u); f.tz[j] = 0; f.tax[j] = pin ? r.wav[Math.min(q, r.wav.length - 1)][0] : NaN; f.tay[j] = pin ? r.wav[Math.min(q, r.wav.length - 1)][1] : NaN; }
  for(let q = 0; q <= L + 1; q++){ const j = Math.round(h0 + n + q - f.tp0), s0 = clamp(L - q, 0, L); f.tp[j] = atS(r.sh.k, s0); f.tz[j] = 0; f.tax[j] = pin ? atS(sx, s0) : NaN; f.tay[j] = pin ? atS(sy, s0) : NaN; }
  /* where the approach meets the state's own shape the curvature steps; a step running down the body kicks it as it passes stations, so
     the join is smoothed over a body width or two */
  { const jc = Math.round(h0 + n - f.tp0), a0 = Math.max(0, jc - 90), a1 = Math.min(f.tp.length - 1, jc + 90), src = f.tp.slice(a0 - 40, a1 + 41);
    for(let j = a0; j <= a1; j++){ let sum = 0, ws = 0; for(let d = -40; d <= 40; d++){ const g = Math.exp(-(d * d) / (2 * 14 * 14)); sum += src[j - a0 + 40 + d] * g; ws += g; } const w = 1 - Math.abs(j - jc) / 90; f.tp[j] = lerp(f.tp[j], sum / ws, s5(w * 1.6)); } }
  f.trav = {to:id, from:f.state, end:h0 + n + L, t0:now + (o.delay ?? (ch0H > 40 ? 800 : 300)), len:n + L, v:0, vmax:(o.speed || 1) * R_(205, 250), settled:false, then:o.then || null};
  f.hideFrom = L + 1;
  const ch = f.ch;
  /* the move has the posture until it has arrived and settled (held pads give way to it, and have it back at the new state's home) */
  for(const k of MOVE_CH) take(f, k, Infinity);
  drive(f, 'H', 12, ch0H > 40 ? 1550 : 600, now); drive(f, 'sb', 0, 900, now); drive(f, 'pitch', .04, 900, now);   // a raised head comes down first, unhurried
  drive(f, 'curl', 0, 900, now); drive(f, 'lure', 0, 400, now); drive(f, 'tailUp', 0, 500, now);
  /* a ring lets go of its tail: the jaws open off the tip as the head draws away, then close */
  if(isRing(f.state)){ drive(f, 'gape', .45, 260, now); at(f, 420, () => drive(f, 'gape', 0, 500)); } else drive(f, 'gape', 0, 300, now);
  toRel(f, 0, 900, now);
  say(f, 'move to ' + id);
}
/* ---------- following a laid course: up a trunk, along a branch, down again ----------
   path: the world points [x, y, z] the head is to pass, in order (plan x and y, height z of the body's centreline). The head reaches the course's
   start by a short approach (a curve in plan from where it faces, its height eased), then the course is laid on the tape ahead of it, one cell for
   every 1 px of arc: the plan curvature (the heading's change per unit of arc, so a climbing helix keeps its plan radius), the height, and the world
   place. The body follows the head along it. Each station stands on its cell's height (as well as on whatever it touches) and the fit pins it to its
   cell's place, so the body winds round a trunk exactly and keeps no drift. On arrival the body holds the course (the def's track state) until the
   next move; a further follow continues from where the head is. o: {speed, delay, then, state}. */
function resample3(P, step = 1){
  const out = [P[0].slice()]; let acc = 0;
  for(let q = 1; q < P.length; q++){
    const a = P[q - 1], b = P[q], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if(l < 1e-9) continue;
    let t = step - acc; while(t <= l){ const u = t / l; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); t += step; }
    acc = l - (t - step);
  }
  return out;
}
function follow(f, path, o = {}){
  const to = o.state || TRACK; if(!to || !path || path.length < 2) return false;
  if(isRing(f.state) && !f.trav){ leaveRing(f, () => follow(f, path, o)); return true; }
  /* a raised head comes down before the body moves off (a lifted neck is short in plan: laid as it is, the course would not fit the body) */
  if(!f.tape && f.ch.H.v > 18){ for(const k of MOVE_CH) take(f, k, Infinity); drive(f, 'H', 8, 900); drive(f, 'pitch', .04, 900); toRel(f, 0, 700, clock(f)); f.pendingFollow = {path, o}; say(f, 'lowers its head to move'); return true; }
  f.gen++; f.busy = 0;
  let hx = f.X[0], hy = f.Y[0], hz = Math.max(f.restS[0], f.sup[0]), hf = f.headFwd;
  /* on a held course the course goes on from where it was laid (its last pinned place, facing along it), not from a head that has looked aside:
     the neck's pins bring the head back as the body moves */
  if(f.tape){ const A0 = [0, 0], A1 = [0, 0]; if(ancAt(f, f.h - 1, A0) && ancAt(f, f.h - 5, A1)){ hx = A0[0]; hy = A0[1]; hz = tzAt(f, f.h - 1); hf = Math.atan2(A0[1] - A1[1], A0[0] - A1[0]); } }
  const now = clock(f), ch0H = f.ch.H.v;
  const C = resample3(path, 1);
  if(C.length < 3) return false;
  /* the approach: from the head, facing as it faces, to the course's start, entering along it. It is steered, not fitted: a point leaves the head
     at its heading and turns toward a lead point behind the course's start (then the start itself) no tighter than the body can bend (radius
     TURN_R), so a target behind the head is reached by a loop the body can make; its height eases from the ground at the head to the course's */
  const a1 = Math.atan2(C[2][1] - C[0][1], C[2][0] - C[0][0]), dist = Math.hypot(C[0][0] - hx, C[0][1] - hy);
  let A = [];
  if(dist > .5 && dist <= 24){ const pts = []; for(let q = 0; q <= 8; q++){ const u = q / 8; pts.push([hx + (C[0][0] - hx) * u, hy + (C[0][1] - hy) * u, hz + (C[0][2] - hz) * u]); } A = resample3(pts, 1); A.pop(); }   // (the course begins just ahead: a short straight join, so its places have no gap)
  else if(dist > 24){
    const TURN_R = Math.max(45, 3 * AMAX), lead = [C[0][0] - Math.cos(a1) * 3 * TURN_R, C[0][1] - Math.sin(a1) * 3 * TURN_R], pts = [[hx, hy]];
    let px = hx, py = hy, th = hf, passed = dist < 3 * TURN_R;
    for(let q = 0; q < 6000; q++){
      const tg = passed ? C[0] : lead, want = Math.atan2(tg[1] - py, tg[0] - px), dth = wrap(want - th);
      th += clamp(dth, -1 / TURN_R, 1 / TURN_R); px += Math.cos(th); py += Math.sin(th); pts.push([px, py]);
      if(!passed && Math.hypot(lead[0] - px, lead[1] - py) < TURN_R * .8) passed = true;
      const dd = Math.hypot(C[0][0] - px, C[0][1] - py); if(passed && (dd < 4 || (dd < TURN_R && Math.cos(Math.atan2(C[0][1] - py, C[0][0] - px) - th) < 0))) break;
    }
    const ex = pts[pts.length - 1]; for(let q = 1; q <= 6; q++){ const u = q / 6; pts.push([ex[0] + (C[0][0] - ex[0]) * u, ex[1] + (C[0][1] - ex[1]) * u]); }   // (joined straight to the course's first place: no gap in the places)
    const n0 = pts.length; A = resample3(pts.map((p, q) => [p[0], p[1], hz + (C[0][2] - hz) * s5(q / (n0 - 1))]), 1); A.pop();
  }
  const P = A.concat(C), n = P.length;
  /* the curvature of the whole laid line, per unit of arc, smoothed over a few px (the hermite and the course meet with a small step in curvature) */
  const hd = []; for(let q = 0; q < n - 1; q++) hd.push(Math.atan2(P[q + 1][1] - P[q][1], P[q + 1][0] - P[q][0]));
  const kf = new Float64Array(n); for(let q = 1; q < n - 1; q++){ const dl = Math.hypot(P[q + 1][0] - P[q][0], P[q + 1][1] - P[q][1], P[q + 1][2] - P[q][2]) || 1; kf[q] = wrap(hd[q] - hd[q - 1]) / dl; }
  const ks = new Float64Array(n); for(let q = 0; q < n; q++){ let sm = 0, ws = 0; for(let d = -8; d <= 8; d++){ const j = q + d; if(j < 0 || j >= n) continue; const g = Math.exp(-(d * d) / 18); sm += kf[j] * g; ws += g; } ks[q] = sm / ws; }
  /* a body on the ground starts its course as it lies: its tape is its live shape (the curvature it was drawn with last frame, layers and all), and
     each station is pinned where it lies, so the whole body is one track from its tail to the course's end and nothing is placed by compromise */
  if(!f.tape){ tapeHere(f); f.tape = true; f.pinBlend = 0;
    for(let sig = Math.floor(f.h - L); sig <= Math.ceil(f.h); sig++){ const j = sig - f.tp0; if(j < 0 || j >= f.tp.length) continue; const s0 = clamp(f.h - sig, 0, L), i = idxAt(s0), u = clamp((s0 - S[i]) / DS[i]), i2 = Math.min(N - 1, i + 1);
      /* (the head was lowered before the course is laid, so the whole body lies nearly flat and every station is pinned where it lies: a gap of
         unpinned cells would change which pin the free neck hangs from as it passed, and the head would jump) */
      f.tp[j] = atS(f.k, s0); f.tax[j] = f.X[i] + (f.X[i2] - f.X[i]) * u; f.tay[j] = f.Y[i] + (f.Y[i2] - f.Y[i]) * u; f.tz[j] = 0; }
    /* the live curvature carries the layers (the neck's look and S-bend, the tail's curl, lure and rattle): they are in the tape now, so their channels
       start again from nothing, or they would be added twice and the body would jump as the course takes hold */
    const ch = f.ch; f.kN.fill(0); f.packets = [];
    for(const c of ['curl', 'sb', 'lure', 'rattle', 'tailUp']){ ch[c].v = ch[c].tg = 0; ch[c].ts = 0; ch[c].vel = 0; ch[c].g = null; }
    f.gazeMode = 'rel'; for(const c of ['rel', 'look']){ ch[c].v = ch[c].tg = 0; ch[c].ts = 0; ch[c].vel = 0; ch[c].g = null; } }
  tapeRoom(f, n + 40);
  const h0 = f.h, k0 = tapeAt(f, h0);
  for(let q = 1; q < n; q++){ const j = Math.round(h0 + q - f.tp0); if(j < 0 || j >= f.tp.length) continue; f.tp[j] = lerp(k0, -ks[q], s5(q / 30)); f.tz[j] = P[q][2]; f.tax[j] = P[q][0]; f.tay[j] = P[q][1]; }
  f.trav = {to, from:f.state, end:h0 + n - 1, t0:now + (o.delay ?? (ch0H > 40 ? 800 : 200)), len:n - 1, v:0, vmax:(o.speed || 1) * R_(205, 250), settled:!!o.keepNeck, then:o.then || null, course:true};
  f.hideFrom = L + 1;
  const ch = f.ch;
  for(const k of MOVE_CH) take(f, k, Infinity);
  if(!o.keepNeck){ drive(f, 'H', 12, ch0H > 40 ? 1550 : 600, now); drive(f, 'sb', 0, 900, now); drive(f, 'pitch', .04, 900, now); }
  drive(f, 'curl', 0, 900, now); drive(f, 'lure', 0, 400, now); drive(f, 'tailUp', 0, 500, now); drive(f, 'gape', 0, 300, now);
  toRel(f, 0, 900, now);
  say(f, 'follow a course of ' + (n - 1) + ' px (approach ' + A.length + ' px from ' + dist.toFixed(1) + ' px away)');
  return true;
}
function travel(f, dt, now){
  const tr = f.trav; if(!tr) return 0;
  if(now < tr.t0) return 0;
  const rem = tr.end - f.h, ramp = s5((now - tr.t0) / 900), want = tr.vmax * f.mv.pace * ramp * Math.min(1, Math.sqrt(Math.max(0, rem) / 280)) * (1 + .06 * Math.sin(now / 1000 * 2.1));
  tr.v += (want - tr.v) * (1 - Math.exp(-dt * 6));
  let step = Math.max(tr.v, rem < 30 ? 7 : 0) * dt;
  if(step >= rem){ step = rem; }
  f.h += step;
  /* coming to a ring: the jaws open as the head comes round to its tail's tip, and close on it as it arrives (the ring's time law holds it from there) */
  if(!tr.bite && isRing(tr.to) && rem < 160){ tr.bite = true; drive(f, 'gape', .5, 520, now); }
  /* coming in: the neck and tail take the new state's posture over the last stretch */
  if(!tr.settled && rem < 420){
    /* (to its home there: the posture a held pad gives, or the state's own; a ring's own wherever the pads are. The tail takes the state's own while
       it still crawls, and a held tail's pose once the body has stopped: a hard curl or a lift would pull it off the track) */
    tr.settled = true; const to = tr.to;
    drive(f, 'H', home(f, 'H', to), 1600, now); drive(f, 'sb', home(f, 'sb', to), 1400, now); drive(f, 'pitch', home(f, 'pitch', to), 1400, now); drive(f, 'curl', home(f, 'curl', to, false), 1800, now);
    drive(f, 'tailUp', home(f, 'tailUp', to, false), 1400, now); drive(f, 'lure', home(f, 'lure', to, false), 1400, now); if(!isRing(to)) drive(f, 'gape', home(f, 'gape', to), 900, now);
  }
  if(f.h >= tr.end - 1e-6){
    const track = !!STATES[tr.to].track;   // (a course is held: the body stays on the tape, standing on its heights and pinned to its places)
    f.h = tr.end; f.trav = null; f.tape = track; f.state = tr.to; f.arrive = track ? 0 : now; say(f, 'arrived ' + tr.to);
    /* the move lets the posture go as its settling goals finish (a ring's jaws at once: its law has them now) */
    for(const k in f.own) if(f.own[k].until === Infinity) f.own[k].until = now + 1800;
    if(isRing(tr.to)) delete f.own.gape;
    for(const k of ['curl', 'tailUp', 'lure']) if(padHolds(f, k) && !locked(f, k)) drive(f, k, home(f, k), 1600, now);
    /* a state that looks about the world takes the way its head faces on arrival as where it rests its gaze (a held head keeps its own turn) */
    toRel(f, home(f, 'rel', tr.to), 700, now); take(f, 'rel', now + 700);
    if(STATES[tr.to].gaze === 'world' && !padHolds(f, 'rel')){ const ch = f.ch; ch.gaze.v = ch.gaze.tg = f.headFwd; ch.gaze.vel = 0; ch.gaze.g = null; f.gazeMode = 'world'; f.gazeBase = f.headFwd; goal(ch.gaze, f.gazeBase + R_(-.3, .3), 1800, now); }
    if(isRing(tr.to)){ useRing(f, tr.to); f.ch.ring.v = f.ch.ring.tg = f.par[tr.to].S ?? 0; f.ch.ring.vel = 0; f.ch.ring.ts = null; f.rg.reset(); }
    f.nextBout = now + R_(600, 1600);
    if(tr.then) tr.then();
    else if(f.queue){ const q = f.queue; f.queue = null; at(f, 300, () => play(f, q)); }
  }
  return step;
}

/* ---------- home: where each posture channel rests, and what may move it (round 20) ----------
   A channel rests at its home: the value a held pad gives it, or else the state's own posture. Whatever animates a channel (an action, a strike,
   a move between states, a tongue flick) takes it for as long as it runs: a held pad does not pin it against the animation, which starts from
   wherever the channel is and gives it back at home. So a strike with the head held high cocks from there and comes back there, and a yawn
   with the mouth held half open opens wide and settles half open again. Life's own small bouts take nothing: a held pad still overrides them.
   A state may hold channels itself (lock): a ring's head holds its tail, so it does not rise, tilt, turn or bend its neck there, and the tail does
   not curl or lift; no pad moves those while the body is in the ring (the Ring pad is its control). */
const PADCH = {H:['head', p => (p.y + 1) / 2 * 200], rel:['head', p => -p.x * 1.4], sb:['neck', p => (p.x + 1) / 2], pitch:['neck', p => -p.y * .45],
  tongue:['mouth', p => Math.max(0, p.x)], gape:['mouth', p => Math.max(0, p.y)], curl:['tail', p => -p.x * 2], tailUp:['tail', p => Math.max(0, p.y)], lure:['tail', p => Math.max(0, p.y)]};
const POSE_CH = [...Object.keys(PADCH), 'rattle'], MOVE_CH = ['H', 'sb', 'pitch', 'rel', 'curl', 'lure', 'tailUp', 'gape'];
const RING_LOCK = {H:0, sb:0, pitch:0, rel:0, curl:0, tailUp:0, lure:0, rattle:0, tongue:0}, RING_MUS = .2, RING_MUS_NECK = 0;
const lockOf = id => STATES[id].lock ?? (isRing(id) ? RING_LOCK : null);
const locked = (f, k, id = f.state) => { const lk = lockOf(id); return !!lk && lk[k] != null; };
const padHolds = (f, k) => { const pc = PADCH[k], p = pc && f.pads[pc[0]]; return !!(p && p.on); };
function home(f, k, id = f.state, pads = true){
  const lk = lockOf(id); if(lk && lk[k] != null) return lk[k];
  if(pads && padHolds(f, k)) return PADCH[k][1](f.pads[PADCH[k][0]]);
  const S0 = STATES[id]; if(S0.neck[k] != null) return S0.neck[k]; if(k === 'curl') return S0.tail.curl ?? 0; return 0;
}
/* an animation's hold on a channel: until a time, and only while the animation that took it is the current one (a new action or move ends it) */
const owned = (f, k) => { const o = f.own[k]; return !!o && o.gen === f.gen && o.until > clock(f); };
function take(f, k, until){ const o = f.own[k]; f.own[k] = {gen:f.gen, until:o && o.gen === f.gen ? Math.max(o.until, until) : until}; }
function drive(f, k, to, ms, now = clock(f), ease){ goal(f.ch[k], to, ms, now, ease); take(f, k, now + ms + 40); if(f.onDrive) f.onDrive(k, to, ms, now); }   // (onDrive: a gate's probe)
/* a channel let go of off its home goes back there (gently; a posture's own variation is left as it is) */
const SETTLE_TOL = {H:16, sb:.1, pitch:.06};
function settle(f, k, ms = 700){
  const c = f.ch[k], now = clock(f);
  if(k === 'rel'){ if(f.gazeMode === 'rel' && Math.abs(c.tg - home(f, k)) > .02) goal(c, home(f, k), ms, now); return; }
  if(k === 'gape' && f.ringOn) return;   // (the ring's law has the jaws)
  const h = home(f, k); if(Math.abs(c.tg - h) > (SETTLE_TOL[k] ?? .02)) goal(c, h, ms, now);
}

/* ---------- actions: the body's definition gives each a run(x); the engine routes it to a state that allows it, and gives it x ---------- */
const ACTIONS = def.actions || {};
function tongue(f, n = 2){
  const now = clock(f), ch = f.ch; if(def.tongue === false || (isRing(f.state) && !f.trav) || (f.trav && isRing(f.trav.to) && f.trav.end - f.h < 400)) return 0;
  let end = 0;
  for(let q = 0; q < n; q++){ const t0 = q * R_(380, 620), t1 = t0 + R_(260, 420); at(f, t0, () => { drive(f, 'tongue', 1, 110); f.flick = clock(f); }); at(f, t1, () => drive(f, 'tongue', home(f, 'tongue'), 150)); end = Math.max(end, t1 + 150); }
  take(f, 'tongue', now + end + 40);   // (the tongue is the flicks' from the first out to the last back in)
  return n * 520;
}
/* (no looking about while moving, nor in a ring, whose head holds the tail; life does not look about while the head is held, an action does) */
function lookAt(f, heading, ms, act = false){ const now = clock(f), ch = f.ch; if((f.held.has('head') && !act) || f.trav || isRing(f.state)) return; if(f.gazeMode !== 'world'){ ch.gaze.v = ch.gaze.tg = f.headFwd; ch.gaze.vel = 0; f.gazeMode = 'world'; } goal(ch.gaze, ch.gaze.tg + wrap(heading - ch.gaze.tg), ms, now); if(act) take(f, 'rel', now + ms + 900); }   // (an action's look stays a moment before a held head takes it back)
function packet(f, c, A, w = R_(34, 60), v = R_(-50, 50), life = R_(2600, 4800)){ f.packets.push({c, A, w, v, life, t0:clock(f), naut:!!STATES[f.state].tight && !f.trav}); }
/* back to the posture, never quite the same place twice: the posture is a region to settle in, not a mark to hit. Its home: what a held pad
   sets (exactly), or the state's own. Life leaves a held channel to its pad; an action (act) brings it back there itself */
const VARY = {H:14, sb:.09, pitch:.05};
function backTo(f, ms = 1100, act = false){
  const S0 = STATES[f.state], now = clock(f); if(f.trav) return;
  for(const k of Object.keys(S0.neck)){
    const held = padHolds(f, k); if((held && !act) || (!act && owned(f, k))) continue;
    const v = home(f, k), to = held || locked(f, k) ? v : v + (v ? R_(-1, 1) * VARY[k] : 0), m = ms * R_(.85, 1.25);
    if(act) drive(f, k, to, m, now); else goal(f.ch[k], to, m, now);
  }
}
/* what an action's run gets: the body, its channels, and the engine's verbs (each on the body's own clock). Its goals take their channels
   (home(k) is where each rests: the pad's, or the state's); a channel the state locks is not moved */
function ctx(f){
  const ch = f.ch, key = c => typeof c === 'string' ? c : Object.keys(ch).find(k => ch[k] === c);
  return {f, ch, now:clock(f), state:f.state, R:R_, L, HL, NECK1, TAIL0,
    goal:(c, to, ms) => { const k = key(c); if(k && ch[k] && !locked(f, k)) drive(f, k, to, ms); }, home:k => home(f, k), at:(ms, fn) => at(f, ms, fn), clock:() => clock(f),
    busy:ms => { f.busy = clock(f) + ms; }, tongue:n => tongue(f, n), lookAt:(h, ms) => lookAt(f, h, ms, true), packet:(...a) => packet(f, ...a),
    backTo:ms => backTo(f, ms, true), strike:o => strike(f, o), swallow:o => swallow(f, o), release:o => release(f, o), ringHold:() => ringRun(f, 'hold'), ringTo:fr => { if(f.rg && f.ringOn) f.rg.toFraction(fr); }, shed:ms => { f.shed = {t0:clock(f), ms}; }, play:n => play(f, n)};
}
function play(f, name){
  const A = ACTIONS[name]; if(!A) return;
  if(A.roam){ const others = STATE_IDS.filter(k => k !== f.state && !isTrack(k)); if(!f.trav) moveTo(f, others[Math.floor(Math.random() * others.length)], {far:1.8}); return; }
  if(f.trav){ f.queue = name; return; }
  if(A.in && !A.in.includes(f.state)){ f.queue = name; say(f, name + ' needs ' + A.in[0]); moveTo(f, A.in[0]); return; }
  if(A.not && A.not.includes(f.state)){ f.queue = name; say(f, name + ' cannot be done in ' + f.state); moveTo(f, STATE_IDS.find(k => !A.not.includes(k) && !isTrack(k))); return; }
  say(f, name); f.queue = null;
  f.gen++;   // a new action takes over: what the last one still had pending (a settle back, a look) would fight it; what it held and this one does not take goes home
  if(!A.run) return;
  A.run(ctx(f));
  /* the channels it drives are its own for the whole action (its ms, its busy time, its last timer), not only while each goal runs: between a
     yawn's opening and its closing a held pad must not snap the jaws back */
  const now = clock(f); let end = Math.max(now + (A.ms ?? 0), f.busy); for(const L_ of f.later) if(L_.gen === f.gen) end = Math.max(end, L_.t);
  for(const k in f.own) if(f.own[k].gen === f.gen) f.own[k].until = Math.max(f.own[k].until, end);
}
/* ---------- the strike: cock, launch, bite or miss, draw back (round 18) ----------
   From wherever the body is (a heap), the neck draws back into a tall S (the raise and the plan S-bend), then unfolds: the lunge channel takes
   the head's height from the cocked height down to the target's, with the free neck's length kept, so the neck swings out and down as one
   body and the head travels about the neck's own length (the strike of a viper is the extension of the curved neck and the anterior third of
   the body, SERPENT-RESEARCH.md). The coil is not moved by hand: it stays where friction holds it. The stroke runs about 240 ms to contact
   with its speed peaking a third of the way in; the jaws open before contact and close on it (a bite, held), or overshoot and recover (a
   miss); the draw back takes about a second along the same shapes. def.strike overrides any of these numbers. */
const skewEase = u => s5(1 - Math.pow(1 - clamp(u), 1.55));   // the stroke's speed peaks about a third of the way in
function strike(f, o = {}){
  if(f.trav) return;
  const now = clock(f), ch = f.ch, P = {cockH:200, cockSb:1.6, cockPitch:-.04, cockMs:700, dwell:160, launchMs:240, holdMs:380, recoverMs:1100, gape:.95, over:.12, hitZ:11, aim:0, reach:1, lead:80, miss:false, ...(def.strike || {}), ...o};
  /* where it strikes: by default ahead along the way the head looks now (it is not turned back to the coil's heading first), as far as the unfolded
     neck and the coil's paying out reach. aim turns it from there (radians),
     reach shortens it (a fraction of the full reach), dist or target ([x, y] in the body's plan frame, as spine3's X and D) name the place; the Strike pad
     sets the aim and the reach of the next one */
  const spad = f.pads.strike; if(spad && o.aim == null) P.aim += spad.x * .7; if(spad && o.reach == null) P.reach = .5 + .5 * (spad.y + 1) / 2;
  const iB = idxAt(NECK1 + 10 + P.lead + 30), bx = f.X[iB], by = f.Y[iB];
  let r = 1;   // how far of the full reach (set below, once the target is known)   // (the reference is the first station beyond the stretch that pays out: it stays put)
  f.gen++; f.hit = null; say(f, 'strike');
  /* the head turns to the target while it cocks: a heading, or the way it faces now, plus an aim */
  /* the stretch of coil that will straighten, and the heading its turning gives the arm */
  const sa = NECK1 + 10, sb2 = sa + P.lead, wU = new Float64Array(N); let alpha = 0;
  for(let i = 0; i < N; i++){ const s = S[i]; wU[i] = P.lead > 0 ? sstep(sa, sa + 25, s) * (1 - sstep(sb2 - 25, sb2, s)) : 0; alpha += wU[i] * f.base[i] * DS[i]; }
  f.lng = {w:wU, alpha, Hl:0, t0:now}; const g0 = f.gazeMode === 'world' ? ch.gaze.tg : f.headFwd;
  if(P.target){ const dx = P.target[0] - bx, dy = P.target[1] - by; P.aim = wrap(Math.atan2(dy, dx) - (f.rootFwd + alpha)); P.dist = Math.hypot(dx, dy); }
  else if(o.aim == null) P.aim += wrap(f.headFwd - (f.rootFwd + alpha));   // (the look it has, against the heading the arm will take)
  P.aim = clamp(P.aim, -.9, .25);   // (the neck turns the head about 100 degrees from the coil's heading and the coil's paying out has already used most of that to the right)
  r = clamp(P.dist != null ? P.dist / Math.max(60, f.strikeRef ?? .5 * (riseRoot(P.cockH) + P.lead)) : P.reach, .25, 1);
  P.cockH = Math.max(lerp(110, P.cockH, clamp((r - .25) / .6)), Math.min(home(f, 'H'), P.cockH));   // a short strike does not rear as high (nor drop a head held high to cock lower)
  /* the cock takes as long as the raise it has to make: its time is for the state's own posture, and from a head held low it has further to go
     (the launch must not come before the neck is up) */
  const Hn = STATES[f.state].neck.H ?? 0, refH = Math.max(40, Math.abs(P.cockH - Hn));
  P.cockMs *= clamp(Math.sqrt(Math.abs(P.cockH - ch.H.v) / refH), 1, 1.8);
  const total = P.cockMs + P.dwell + P.launchMs + P.holdMs + P.recoverMs;
  f.busy = now + total + 300;
  const head = f.rootFwd + alpha + P.aim;
  /* the strike has the head, the neck and the jaws for its whole length, wherever the pads hold them: it cocks from where they are and draws back to them */
  for(const k of ['H', 'sb', 'pitch', 'gape', 'rel', 'lunge']) take(f, k, now + total + 200);
  drive(f, 'H', P.cockH, P.cockMs, now); drive(f, 'sb', P.cockSb, P.cockMs * .9, now); drive(f, 'pitch', P.cockPitch, P.cockMs * .8, now);
  const wasRel = f.gazeMode === 'rel';
  if(wasRel){ ch.gaze.v = ch.gaze.tg = f.headFwd; ch.gaze.vel = 0; ch.gaze.g = null; f.gazeMode = 'world'; } goal(ch.gaze, ch.gaze.tg + wrap(head - ch.gaze.tg), P.cockMs, now);
  packet(f, NECK1 + 60, .006, 60, 40, 1800);   // the coil takes the load in its first turn
  const stiff = on => { for(const c of [ch.sb, ch.H, ch.pitch, ch.gape, ch.lunge]) c.w = on ? 42 : c.w0; };
  at(f, P.cockMs + P.dwell, () => {
    /* the launch stiffens the springs; the raise is held where it has got to, so a cock still settling is not snapped up to its mark the
       instant before the head drops (a 10 px hitch, upward, before the lunge) */
    const t = clock(f); f.lng.Hl = P.hitZ - (f.rootZ ?? 0); ch.H.g = null; ch.H.tg = ch.H.ts = ch.H.v; stiff(true);
    /* how far it reaches: a shorter strike rears lower and pays out less of the coil, and still comes down on the ground (a strike that stopped its
       descent would hang in the air) */
    f.lng.leadAmp = clamp((r - .6) / .4, 0, 1); f.hit = {r, t:0};
    drive(f, 'sb', -.1, P.launchMs * .7, t); drive(f, 'pitch', .3, P.launchMs, t);
    goal(ch.lunge, 1 + (P.miss ? P.over : 0), P.launchMs * (P.miss ? 1.1 : 1), t, skewEase);
    drive(f, 'gape', P.gape, P.launchMs * .5, t);                    // the jaws open before contact
    if(!P.miss) at(f, P.launchMs * .92, () => drive(f, 'gape', .05, 80));   // and close on it
    f.hit.t = t + P.launchMs; f.hit.miss = P.miss;
    at(f, P.launchMs, () => { if(!P.miss && r > .95) f.strikeRef = Math.hypot(f.X[0] - bx, f.Y[0] - by); });   // (what a full strike measured from the neck's base: the scale for a strike to a distance)
  });
  at(f, P.cockMs + P.dwell + P.launchMs + P.holdMs, () => {
    const t = clock(f); stiff(false);
    goal(ch.lunge, 0, P.recoverMs, t); drive(f, 'gape', home(f, 'gape'), 500, t); backTo(f, P.recoverMs * .9, true);
    /* the look goes back to what it was: the held head's turn, a body-relative look, or the way it watched the world */
    if(padHolds(f, 'rel') || (wasRel && STATES[f.state].gaze !== 'world')){ toRel(f, home(f, 'rel'), P.recoverMs, t); take(f, 'rel', t + P.recoverMs); }
    else goal(ch.gaze, g0, P.recoverMs, t);
    at(f, P.recoverMs + 100, () => { if(f.ch.lunge.v < 1e-3) f.lng = null; });
  });
}

/* a ring eats its tail on creature-ring.js's time law. swallow runs on (to the smallest ring: about 48 s at tempo 1), ringHold stops it where it is,
   release plays it back out (faster, from wherever it has got to). {ms} stops it after that long; {fast} releases quicker. Returns how long it will run. */
function ringRun(f, mode, o = {}){
  if(!f.rg || !isRing(f.state) || f.trav) return 0;
  const now = clock(f), rg = f.rg, RM = RINGMS[f.rgId], T = RM.duration, fast = o.fast || 1;
  f.gen++; f.ringDone = null;   // a new instruction takes over: the stop timer of the last would fight it, and a pending leave is called off (leaveRing sets it again)
  say(f, 'ring ' + mode);
  if(mode === 'swallow') rg.swallow(); else if(mode === 'release') rg.release(fast); else rg.hold();
  /* (a release runs back at 2.4 x fast, but never lets the tail out faster than RING_SPEED px/s; the rate eases in and out over about 0.6 s) */
  const remain = mode === 'swallow' ? T - rg.tau : mode === 'release' ? Math.max(rg.tau / (2.4 * fast), (rg.state.v - RM.start) / RING_SPEED * 1000) + 600 : 0, run = o.ms != null ? Math.min(o.ms, remain) : remain;
  f.busy = now + run + 500;
  if(o.ms != null && o.ms < remain) at(f, o.ms, () => rg.hold());
  return run;
}
const swallow = (f, o) => ringRun(f, 'swallow', o), release = (f, o) => ringRun(f, 'release', o);
/* before a ring can move on it lets its tail out, all of it, to the tip between the lips; then 'then' runs (the move) */
function leaveRing(f, then){ if(!f.rg || !isRing(f.state) || f.rg.atStart){ then(); return; } ringRun(f, 'release', {fast:3}); f.ringDone = then; }
/* every move to another state goes through here: out of a ring, the tail comes out first (a strike asked for in the ouroboros lets go, crawls to the
   heap and strikes; it never pulls its swallowed tail out through the back of its head) */
function moveTo(f, id, o = {}){ if(f.trav || !STATES[id]) return; leaveRing(f, () => startMove(f, id, o)); }
/* the ring state whose time law is in use */
function useRing(f, id){ if(!f.rgBy[id]) return; f.rgId = id; f.rg = f.rgBy[id]; }

/* ---------- life: bouts per state, from the definition's weights; a bout that names an action plays it ---------- */
const BOUTS = def.bouts || {};
function pickBout(f){
  const S0 = STATES[f.state], W = {...(BOUTS[f.state] || {look:1})};
  if(S0.ring && f.held.has('ring')){ W.swallow = W.release = W.regrip = 0; W.shift = W.shift ?? 1; }
  else if(S0.ring){ const fr = f.rg ? f.rg.fraction : 0; W.swallow = fr > .985 ? 0 : (W.swallow ?? 3) * (fr < .03 ? 1.8 : 1); W.release = fr < .015 ? 0 : (W.release ?? 3) * (fr > .5 ? 1.8 : .8); W.regrip = fr > .02 && fr < .98 ? 1.3 : 0; }
  if(home(f, 'H') > 60 && f.ch.H.tg < 60){ W.lower = 0; W.look = 1; W.raise = 4; }
  let t = 0; for(const k in W) t += W[k]; let r = Math.random() * t;
  for(const k in W){ r -= W[k]; if(r <= 0) return k; } return 'look';
}
function bout(f, name){
  const now = clock(f), ch = f.ch, S0 = STATES[f.state], world = S0.gaze === 'world';
  switch(name){
    case 'look': { const m = f.dyn.motion; lookAt(f, world ? f.gazeBase + R_(-1.1, 1.1) * m : f.rootFwd + R_(-1.2, 1.2) * m, R_(800, 1600)); if(world && !f.held.has('head')) goal(ch.H, home(f, 'H') + R_(-18, 22) * m, R_(900, 1600), now); } if(Math.random() < .6) packet(f, NECK1 + R_(0, 60), R_(.003, .007) * (Math.random() < .5 ? 1 : -1), 50, R_(50, 90)); if(Math.random() < .5) at(f, R_(400, 900), () => tongue(f, 1 + Math.floor(R_(0, 3)))); return R_(1800, 4200);
    case 'tongue': return tongue(f, 1 + Math.floor(R_(1, 4)));
    case 'lower': if(f.held.has('head')) return 600; goal(ch.H, Math.min(56, home(f, 'H')), 1800, now);   // (not lower than the neck can lie along a coil's rim without turning sharply there)
      goal(ch.pitch, .1, 1500, now); goal(ch.sb, .05, 1500, now); return R_(2200, 3000);
    case 'raise': backTo(f, 1700); return 1800;
    case 'tail': if(!f.held.has('tail')) goal(ch.curl, clamp(home(f, 'curl') + R_(-1.4, 1.4) * f.dyn.motion, -1.8, 1.8), R_(1000, 1800), now); return R_(1200, 2400);
    case 'shift': packet(f, R_(NECK1, L - 160), R_(.006, .012) * (Math.random() < .5 ? 1 : -1), R_(50, 80), R_(-70, 70), R_(3200, 5200)); return R_(1200, 2600);
    /* life swallows and releases in parts: a run of some seconds, then it holds and works at what it has, then perhaps on (or back) again */
    case 'swallow': { const fr = f.rg.fraction; return swallow(f, {ms:fr > .8 ? R_(3000, 8000) : R_(5000, 16000)}); }
    case 'release': { const fr = f.rg.fraction; return release(f, {ms:fr < .2 ? 9e4 : R_(3500, 10000)}); }
    case 'regrip': { const fr = f.rg.fraction; f.gen++; f.rg.toFraction(clamp(fr + R_(-.05, .06))); f.busy = clock(f) + 2400; return 2400; }
  }
  if(ACTIONS[name]){ play(f, name); return ACTIONS[name].ms ?? 2000; }
  return 1000;
}
function lifeStep(f, now){
  if(!f.lifeOn) return;
  const rate = Math.max(.05, f.rate);
  if(now >= f.nextPacket){ if(!f.trav) packet(f, R_(NECK1 - 20, L - 120), R_(.0035, .0075) * (Math.random() < .5 ? 1 : -1)); f.nextPacket = now + R_(1600, 3600) / Math.sqrt(rate); }
  if(f.trav){ if(now >= f.nextTongue){ tongue(f, 1 + Math.floor(R_(0, 2))); f.nextTongue = now + R_(1500, 3800) / Math.sqrt(rate); } if(!f.held.has('head')) f.ch.rel.tg = .22 * Math.sin(now / 1000 * .8) + .1 * Math.sin(now / 1000 * 1.9); return; }
  if(now < f.busy || f.ringDone) return;
  if(STATE_IDS.length > 1 && now >= f.nextMove && f.nextMove){ f.nextMove = now + R_(45e3, 100e3) / rate; const others = STATE_IDS.filter(k => k !== f.state && !isTrack(k)), to = others[Math.floor(Math.random() * others.length)]; if(to) moveTo(f, to, {far:!isRing(f.state) && Math.random() < .3 ? 1.8 : 1}); return; }
  if(!f.nextMove) f.nextMove = now + R_(45e3, 100e3) / rate;
  if(now >= f.nextBout){ const b = pickBout(f), d = bout(f, b); say(f, 'bout ' + b); f.nextBout = Math.max(now + d, f.busy) + R_(500, 3000) / rate ** .7; }
}

/* ---------- one step of the world ---------- */
function step(f, now, dt){
  for(let q = f.later.length - 1; q >= 0; q--){ const L_ = f.later[q]; if(L_.gen != null && L_.gen !== f.gen){ f.later.splice(q, 1); continue; } if(now >= L_.t){ f.later.splice(q, 1); L_.fn(); } }
  lifeStep(f, now);
  applyPads(f);
  /* the behaviour layer: one-shots fade out; the burst style throws a burst somewhere on the body now and then */
  if(f.beh.fx.length) f.beh.fx = f.beh.fx.filter(e => now - e.t0 < 3500);
  if(f.beh.style === 'burst' && Math.random() < dt * f.beh.rate * .7) f.beh.fx.push({kind:'burst', s0:R_(NECK0, L - 60), t0:now, col:f.beh.pal[Math.floor(Math.random() * f.beh.pal.length)]});
  /* a ring's swallow runs on the shared time law: it gives the swallowed length, the jaws and the lumps, and the channels are set from it */
  const ringOn = f.ringOn = !!RING && isRing(f.state) && !f.trav && !f.tape;
  if(ringOn){ f.rgs = f.rg.step(dt * 1000); if(!owned(f, 'gape')){ const g = f.rgs.gape * .95; f.ch.gape.g = null; f.ch.gape.tg = padHolds(f, 'gape') ? Math.max(g, home(f, 'gape')) : g; } } else f.rgs = null;
  for(const k in f.ch) chStep(f.ch[k], now, dt);
  if(ringOn){ const c = f.ch.ring; c.v = c.tg = f.rgs.v; c.vel = 0; c.g = null; if(f.ringDone && f.rg.atStart && f.rg.settled && Math.abs(f.rg.rate) < .08){ const fn = f.ringDone; f.ringDone = null; fn(); } }
  if(f.pendingFollow && f.ch.H.v < 14 && Math.abs(f.ch.H.vel) < 25){ const pf = f.pendingFollow; f.pendingFollow = null; follow(f, pf.path, pf.o); }
  const drive = travel(f, dt, now);
  if(f.trav && isRing(f.trav.from)) f.hideFrom = L + 1;
  swell(f, now);
  compose(f, now, dt);
  heights(f, dt);
  integrate(f);
  fit(f, drive);
  let bad = !Number.isFinite(f.A + f.TX + f.TY + f.z[0]); for(let i = 0; i < N && !bad; i += 1) if(!Number.isFinite(f.X[i] + f.Y[i])) bad = true;
  if(bad){ const nf = a => { for(let i = 0; i < N; i++) if(!Number.isFinite(a[i])) return i; return -1; }; say(f, 'recovered from a bad solve (first non-finite: k ' + nf(f.k) + ', z ' + nf(f.z) + ', bx ' + nf(f.bx) + ', X ' + nf(f.X) + ', A ' + f.A + ')'); const st = f.trav ? f.trav.to : f.state, cx = f.cam.x; setState(f, st, {x:Number.isFinite(cx) ? cx : 0}); return; }
  /* the muscles: the concave side of each bend that is being made or held, and more while it changes */
  const k = f.k, g = 1 - Math.exp(-dt * 8), held = f.tape ? 1 : .35;
  for(let i = 0; i < N; i++){ const a = (k[i] - (1 - held) * f.base[i]) * f.AR[i] * 3 + (k[i] - f.kPrev[i]) / Math.max(dt, 1e-3) * f.AR[i] * .5; f.act[i] += (clamp(a, -1, 1) - f.act[i]) * g; }
  f.kPrev.set(k);
}

/* ---------- pads: a held pad overrides life for its channels ---------- */
const PADS = {
  head:{label:'Head', x:['turn right', 'turn left'], y:['lower', 'raise'], ch:['rel', 'H']},
  neck:{label:'Neck', x:['straight', 'S-bend'], y:['nose down', 'nose up'], ch:['sb', 'pitch']},
  mouth:{label:'Mouth', x:['tongue in', 'tongue out'], y:['shut', 'gape'], ch:['tongue', 'gape']},
  tail:{label:'Tail', x:['curl right', 'curl left'], y:['down', 'up and lure'], ch:['curl', 'tailUp']},
  body:{label:'Body', x:['coil tight', 'coil loose'], y:['shallow breath', 'deep breath'], keep:true},
  moving:{label:'Moving', x:['slow', 'quick'], y:['straight', 'wriggling'], keep:true},
  dynamics:{label:'Dynamics', x:['slow tempo', 'quick tempo'], y:['small motion', 'large motion'], keep:true},
};
if(Object.keys(ACTIONS).some(k => /^strike/.test(k))) PADS.strike = {label:'Strike', x:['aim left', 'aim right'], y:['short', 'full reach'], keep:true};   // set and kept: the aim and the reach of the next strike
if(RING) PADS.ring = {label:'Ring', x:['', ''], y:['all out', 'swallowed'], ch:['ring']};   // drag up to swallow toward that stage, down to let it out; it holds where it is let go
function applyPads(f){
  const ch = f.ch, now = clock(f);
  /* what an animation held and has let go of: if it finished, the channel stays where it left it (a pose meant to last, such as a head laid down,
     lasts); if it was cut short (a new action or move took over without that channel) it goes home, its stiffness gone with it (a strike stopped
     mid-lunge must not leave the head down and the neck rigid). A pad that holds it takes it back below either way */
  for(const k in f.own){ if(owned(f, k)) continue; const o = f.own[k], c = ch[k]; delete f.own[k]; if(c.w !== c.w0 && !c.we) c.we = {from:c.w, t0:now, ms:400}; if(o.gen !== f.gen && o.until > now && (!padHolds(f, k) || locked(f, k))) settle(f, k, k === 'lunge' ? 1100 : 700); }   // (a lunge stopped short draws back at a strike's own pace)
  /* a held posture pad holds its channels at home, except those an animation has taken or the state locks (a ring holds those itself) */
  for(const k of POSE_CH){
    if(owned(f, k)) continue;
    const c = ch[k];
    if(locked(f, k)){ if(!f.trav && !c.g && Math.abs(c.tg - home(f, k)) > 1e-3) goal(c, home(f, k), 600, now); continue; }
    if(!padHolds(f, k) || (k === 'gape' && f.ringOn)) continue;   // (in a ring the jaws are the law's: a held mouth only opens them wider, in step)
    if(k === 'rel' && f.gazeMode !== 'rel'){ ch.rel.v = ch.rel.ts = ch.look.v; ch.rel.vel = 0; f.gazeMode = 'rel'; }
    c.g = null; c.tg = home(f, k);
  }
  for(const id in f.pads){
    const p = f.pads[id]; if(!p.on) continue;
    if(id === 'body'){ f.coil = 1 + .2 * p.x; f.breathDepth = 1 + p.y; }
    if(id === 'moving'){ f.mv.pace = 1 + (p.x < 0 ? .55 : .7) * p.x; f.mv.wriggle = 1 + p.y; }
    if(id === 'dynamics'){ f.dyn.tempo = 1 + (p.x < 0 ? .6 : .8) * p.x; f.dyn.motion = 1 + .6 * p.y; }
    if(id === 'ring' && f.ringOn){ const fr = Math.max(0, Math.min(1, (p.y + 1) / 2)); if(Math.abs(fr - (p._to ?? -1)) > .004){ p._to = fr; f.rg.toFraction(fr); } }
  }
}
function padGhost(f, id){
  const ch = f.ch;
  if(id === 'head') return [clamp(-ch.look.v / 1.4, -1, 1), clamp(ch.H.v / 100 - 1, -1, 1)];
  if(id === 'neck') return [clamp(ch.sb.v * 2 - 1, -1, 1), clamp(-ch.pitch.v / .45, -1, 1)];
  if(id === 'mouth') return [clamp(ch.tongue.v * 2 - 1, -1, 1), clamp(ch.gape.v * 2 - 1, -1, 1)];
  if(id === 'body') return [clamp((f.coil - 1) / .2, -1, 1), clamp(f.breathDepth - 1, -1, 1)];
  if(id === 'moving') return [clamp((f.mv.pace - 1) / (f.mv.pace < 1 ? .55 : .7), -1, 1), clamp(f.mv.wriggle - 1, -1, 1)];
  if(id === 'ring') return [0, f.rg ? clamp(f.rg.fraction * 2 - 1, -1, 1) : -1];
  if(id === 'strike') return f.pads.strike ? [f.pads.strike.x, f.pads.strike.y] : [0, 1];
  if(id === 'dynamics') return [clamp((f.dyn.tempo - 1) / (f.dyn.tempo < 1 ? .6 : .8), -1, 1), clamp((f.dyn.motion - 1) / .6, -1, 1)];
  return [clamp(-ch.curl.v / 2, -1, 1), clamp(ch.tailUp.v * 2 - 1, -1, 1)];
}

/* ---------- putting a state down at once (the first frame, and tests) ---------- */
function setState(f, id, o = {}){
  f.state = id; f.trav = null; f.tape = false; f.packets = []; f.later = []; f.busy = 0; f.queue = null; f.bulge = null; f.pendingFollow = null; f.own = {};
  const S0 = STATES[id], ch = f.ch;
  for(const c of Object.values(ch)){ c.g = null; c.vel = 0; c.ts = null; }
  for(const [k, v] of Object.entries(S0.neck)){ ch[k].v = ch[k].tg = v; }
  ch.curl.v = ch.curl.tg = S0.tail.curl; if(isRing(id)) useRing(f, id); ch.ring.v = ch.ring.tg = isRing(id) ? f.par[id].S ?? 0 : 0; for(const k in f.rgBy) f.rgBy[k].reset(); f.ringDone = null; ch.look.v = ch.look.tg = 0; ch.rel.v = ch.rel.tg = 0;
  ch.gape.v = ch.gape.tg = 0; ch.tongue.v = ch.tongue.tg = 0; ch.lure.v = ch.lure.tg = 0; ch.tailUp.v = ch.tailUp.tg = 0; ch.rattle.v = ch.rattle.tg = 0; ch.lunge.v = ch.lunge.tg = 0; f.lng = null;
  f.gazeMode = S0.gaze;
  f.hideFrom = L + 1; f.z.fill(0); f.restS.fill(0); f.X.fill(0); f.Y.fill(0);
  for(let i = 0; i < N; i++){ f.z[i] = B0[i]; f.w[i] = 1; }
  const now = clock(f);
  for(let pass = 0; pass < 6; pass++){
    swell(f, now); compose(f, now, 1); heights(f, 1); integrate(f);
    let cx = 0, cy = 0; for(let i = 0; i < N; i++){ cx += f.bx[i]; cy += f.by[i]; } cx /= N; cy /= N;
    let rho = o.rho ?? 0;
    if(o.rho == null && S0.rootAt){ const iN = idxAt(S0.rootAt(f.par[id])), a = Math.atan2(f.by[iN] - cy, f.bx[iN] - cx); rho = -Math.PI / 2 - .5 - a; }
    f.A = rho; const ca = Math.cos(rho), sa = Math.sin(rho), px = o.x ?? 0, py = o.y ?? 0;
    f.TX = px - (ca * cx - sa * cy); f.TY = py - (sa * cx + ca * cy);
    place(f);
    let K = 0; for(let i = 0; i < N && S[i] < NECK1; i++) K += f.base[i] * DS[i];
    f.gazeBase = f.rootFwd - K + .25; if(S0.gaze === 'world') ch.gaze.v = ch.gaze.tg = f.gazeBase;
    ch.look.v = ch.look.tg = f.gazeMode === 'world' ? clamp(wrap(ch.gaze.v - f.rootFwd + K), -1.75, 1.75) : 0;
  }
  f.h = 0; f.tp0 = -L - 200; f.tp.fill(0); f.tz.fill(0); f.tax.fill(NaN); f.tay.fill(NaN); f.sup.fill(0); f.anc = false;
  f.nextBout = now + 900; f.nextPacket = now + 500; f.nextMove = 0;
  /* settle: the set-up passes approximate the live step (its lags start where they are); forty quiet frames let them agree, so the first
     shown frame is not a twitch */
  { const lo = f.lifeOn; f.lifeOn = false; for(let q = 0; q < 40; q++) step(f, now, 1 / 60); f.lifeOn = lo; f.packets = []; f.later = []; f.cam.ok = false; }
  f.cam.ok = false;
}

/* ---------- drawing ---------- */
const RW = {cx:new Float64Array(N), cy:new Float64Array(N), cz:new Float64Array(N), tx:new Float64Array(N), ty:new Float64Array(N), tz:new Float64Array(N), ux:new Float64Array(N), uy:new Float64Array(N), uz:new Float64Array(N), sx:new Float64Array(N), sy:new Float64Array(N), sz:new Float64Array(N)};
const PX = new Float64Array(N * NC), PY = new Float64Array(N * NC), JX = new Float64Array(JAWV.length), JY = new Float64Array(JAWV.length);
const SLX = new Float64Array(N), SLY = new Float64Array(N), SRX = new Float64Array(N), SRY = new Float64Array(N), DEP = new Float64Array(N), PM = new Float64Array(N);
let FRONT = 0;
function frames(f){
  const {cx, cy, cz, tx, ty, tz, ux, uy, uz, sx, sy, sz} = RW, X = f.X, Y = f.Y, Z = f.z;
  for(let i = 0; i < N; i++){ cx[i] = X[i]; cy[i] = Y[i]; cz[i] = Z[i]; }
  for(let i = 0; i < N; i++){
    const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
    let x = cx[b] - cx[a], y = cy[b] - cy[a], z = cz[b] - cz[a]; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l; tx[i] = x; ty[i] = y; tz[i] = z;
  }
  /* up: the vertical, square to the body, carried from the tail forward where the body stands upright */
  let pux = 0, puy = 0, puz = 1;
  for(let i = N - 1; i >= 0; i--){
    const t0 = tx[i], t1 = ty[i], t2 = tz[i];
    let x = -t2 * t0, y = -t2 * t1, z = 1 - t2 * t2, l = Math.hypot(x, y, z);
    if(l < .35){ const d = pux * t0 + puy * t1 + puz * t2, qx = pux - d * t0, qy = puy - d * t1, qz = puz - d * t2, ql = Math.hypot(qx, qy, qz) || 1, m = l / .35; x = lerp(qx / ql, x / (l || 1), m); y = lerp(qy / ql, y / (l || 1), m); z = lerp(qz / ql, z / (l || 1), m); l = Math.hypot(x, y, z) || 1; }
    x /= l; y /= l; z /= l; ux[i] = x; uy[i] = y; uz[i] = z; pux = x; puy = y; puz = z;
    sx[i] = t1 * z - t2 * y; sy[i] = t2 * x - t0 * z; sz[i] = t0 * y - t1 * x;
  }
  /* the vertices, the silhouette of each row, its depth */
  for(let r = 0; r < N; r++){
    const a = f.AR[r], b = f.BR[r], base = r * NC, SN = OFF[r] ? SIN_O : SIN_E, CS = OFF[r] ? COS_O : COS_E;
    for(let c = 0; c < NC; c++){ const p = a * SN[c], q = b * CS[c], X3 = cx[r] + p * sx[r] + q * ux[r], Y3 = cy[r] + p * sy[r] + q * uy[r], Z3 = cz[r] + p * sz[r] + q * uz[r]; PX[base + c] = X3; PY[base + c] = Y3 * GY - Z3 * GZ; }
    const al = (sy[r] * GZ + sz[r] * GY) / Math.max(a, .01), be = (uy[r] * GZ + uz[r] * GY) / Math.max(b, .01), pm = Math.atan2(al, be); PM[r] = pm;
    for(const [ps, OX, OY] of [[pm - Math.PI / 2, SLX, SLY], [pm + Math.PI / 2, SRX, SRY]]){ const p = a * Math.sin(ps), q = b * Math.cos(ps); OX[r] = cx[r] + p * sx[r] + q * ux[r]; OY[r] = (cy[r] + p * sy[r] + q * uy[r]) * GY - (cz[r] + p * sz[r] + q * uz[r]) * GZ; }
    DEP[r] = cy[r] * GZ + cz[r] * GY;
  }
  /* the lower jaw: its vertices turned down about the jaw's hinge */
  const gp = Math.max(f.ch.gape.v, f.bite || 0) * .92, rh = idxAt(HINGE), hx = cx[rh] - .3 * f.BR[rh] * ux[rh], hy = cy[rh] - .3 * f.BR[rh] * uy[rh], hz = cz[rh] - .3 * f.BR[rh] * uz[rh], kx = sx[rh], ky = sy[rh], kz = sz[rh];
  for(let q = 0; q < JAWV.length; q++){
    const v = JAWV[q], r = (v / NC) | 0, ang = gp * (1 - sstep(HINGE - 4, HINGE + 12, S[r]));
    const base = r * NC, c = v - base, a = f.AR[r], b = f.BR[r], p = a * (OFF[r] ? SIN_O : SIN_E)[c], qq = b * (OFF[r] ? COS_O : COS_E)[c];
    let x = cx[r] + p * sx[r] + qq * ux[r] - hx, y = cy[r] + p * sy[r] + qq * uy[r] - hy, z = cz[r] + p * sz[r] + qq * uz[r] - hz;
    if(ang > 1e-4){ const co = Math.cos(ang), si = Math.sin(ang), d = kx * x + ky * y + kz * z, cxp = ky * z - kz * y, cyp = kz * x - kx * z, czp = kx * y - ky * x; x = x * co + cxp * si + kx * d * (1 - co); y = y * co + cyp * si + ky * d * (1 - co); z = z * co + czp * si + kz * d * (1 - co); }
    JX[q] = x + hx; JY[q] = (y + hy) * GY - (z + hz) * GZ;
  }
}
const fx = v => Math.round(v * 10) / 10;
function cellPts(C){
  const v = C.v; if(!C.jaw) return [PX[v[0]], PY[v[0]], PX[v[1]], PY[v[1]], PX[v[2]], PY[v[2]], PX[v[3]], PY[v[3]]];
  const o = []; for(let k = 0; k < 4; k++){ const q = JSLOT.get(v[k]); o.push(JX[q], JY[q]); } return o;
}
const area4 = p => .5 * ((p[4] - p[0]) * (p[7] - p[3]) - (p[6] - p[2]) * (p[5] - p[1]));
/* a cell shrunk by its own line on each edge: each corner moves to where its two inset edges meet */
function inset(p, ins, ar){
  const sg = ar > 0 ? 1 : -1, emax = Math.max(ins[0], ins[1], ins[2], ins[3]);
  if(emax <= 0) return p;
  const sc = Math.min(1, Math.sqrt(Math.abs(ar)) * .2 / emax), o = new Array(8), nx = [], ny = [];
  for(let k = 0; k < 4; k++){ const j = (k + 1) & 3, dx = p[2 * j] - p[2 * k], dy = p[2 * j + 1] - p[2 * k + 1], l = Math.hypot(dx, dy) || 1; nx.push(-dy / l * sg); ny.push(dx / l * sg); }
  for(let k = 0; k < 4; k++){
    const a = (k + 3) & 3, e1 = ins[a] * sc, e2 = ins[k] * sc, det = nx[a] * ny[k] - ny[a] * nx[k];
    let dx, dy;
    if(Math.abs(det) < .2){ dx = nx[a] * e1 + nx[k] * e2; dy = ny[a] * e1 + ny[k] * e2; }
    else { dx = (e1 * ny[k] - e2 * ny[a]) / det; dy = (nx[a] * e2 - nx[k] * e1) / det; const m = Math.hypot(dx, dy), cap = 2.5 * emax * sc; if(m > cap){ dx *= cap / m; dy *= cap / m; } }
    o[2 * k] = p[2 * k] + dx; o[2 * k + 1] = p[2 * k + 1] + dy;
  }
  return o;
}
const poly = p => 'M' + fx(p[0]) + ' ' + fx(p[1]) + 'L' + fx(p[2]) + ' ' + fx(p[3]) + 'L' + fx(p[4]) + ' ' + fx(p[5]) + 'L' + fx(p[6]) + ' ' + fx(p[7]) + 'Z';
/* the saddles down the back and the spots along the flanks */
const pattern = def.pattern || patternSaddles;
function patternSaddles(s, psi){
  if(s < HL + 14) return 0;
  const P = 50, ap = Math.abs(psi), u = ((s + 9) % P) / P - .5, v = ((s + 9 + P / 2) % P) / P - .5;
  const saddle = 1 - (Math.abs(u) * 2.7 + ap / 1.05), spot = ap > 1.15 && ap < 2.1 ? 1 - (Math.abs(v) * 4.2 + Math.abs(ap - 1.62) * 3.4) : -1;
  return (saddle > .1 || spot > .1) && s < L - 40 ? 1 : 0;
}
const MAPC = [ROSTER.amber, ROSTER.gold, ROSTER.cinnabar, ROSTER.cinnabar, ROSTER.umber, ROSTER.malachite, ROSTER.lapis, ROSTER.bone];
/* the behaviour layer's colour on one cell: the style's own (drift, jitter, field, ripple), then any one-shot (a ripple down the body, a
   burst ringing out from a point, a shimmer), whichever is stronger; quantised so a chunk keeps few distinct fills */
function behTint(f, C, ci, now){
  const B = f.beh, n = B.pal.length; if(!n || (B.style === 'off' && !B.fx.length)) return null;
  const t = now / 1000 * B.rate, s = C.s, h = hash(ci * 7 + 3);
  let a = 0, col = B.pal[Math.floor(h * n) % n];
  if(B.style === 'drift') a = Math.max(0, Math.sin(t * .7 + h * TAU) - .55) * 1.6;
  else if(B.style === 'jitter') a = hash(ci * 131 + Math.floor(t * 9)) > .9 ? .7 : 0;
  else if(B.style === 'field'){ const v = Math.sin(s / 110 - t * .9) * Math.cos(C.psi * 1.6 + t * .5); a = Math.max(0, v - .25) * 1.1; col = B.pal[Math.floor(((s / L + t * .05) % 1 + 1) % 1 * n) % n]; }
  else if(B.style === 'ripple'){ const u = s - t * 220, ph = (u % 340 + 340) % 340; a = Math.max(0, 1 - ph / 70) * .8; col = B.pal[((Math.floor(u / 340) % n) + n) % n]; }
  for(const e of B.fx){
    const age = (now - e.t0) / 1000; let v = 0;
    if(e.kind === 'ripple'){ const d = Math.abs(s - (age * 480 - 40)); if(d < 60) v = (1 - d / 60) * Math.max(0, 1 - age / 3.2); }
    else if(e.kind === 'burst'){ const d = Math.abs(Math.abs(s - e.s0) - age * 360); if(d < 45) v = (1 - d / 45) * Math.max(0, 1 - age / 1.6); }
    else if(e.kind === 'shimmer'){ const d = s - age * 700; if(d < 0 && d > -220) v = .7 * (1 + d / 220) * (hash(ci + Math.floor(age * 20)) > .5 ? 1 : .3); }
    if(v > a){ a = v; col = e.col; }
  }
  a = Math.round(Math.min(1, a) * 8) / 8;
  return a > 0 ? [col, a] : null;
}
function cellColour(f, C, now, ci){
  const P = f.pal, R = C.rep || C, s = R.s, psi = R.psi;
  if(f.view === 'map') return mixInt(P.skin, MAPC[C.zone], C.jaw ? .55 : .42);
  if(f.view === 'anatomy') return mixInt(P.ground, P.skin, .5);
  let c = C.zone === 0 ? P.crown : C.zone === 2 || C.zone === 3 ? P.labial : C.zone === 4 || C.zone === 7 ? P.belly : pattern(s, psi) ? P.saddle : P.skin;
  if(C.zone === 5 || C.zone === 6){
    const a = f.act[C.r], side = psi > 0 ? -a : a, lat = 1 - Math.abs(Math.abs(psi) - 1.55) / 1.1;
    if(side > .08 && lat > 0) c = addInt(c, P.amber, Math.min(.5, (side - .08) * .6) * lat);
  }
  if(C.zone >= 5){ const bt = behTint(f, C, ci, now); if(bt) c = addInt(c, bt[0], bt[1] * .6); }
  if(f.shed){ const u = (now - f.shed.t0) / f.shed.ms, front = u * (L + 160) - 80, d = front - s; if(d > 0 && d < 200) c = addInt(c, P.wash, .32 * (1 - d / 200)); else if(d <= 0 && d > -40) c = mixInt(c, P.line, .35 * (1 + d / 40)); }
  return c;
}
/* one chunk of the body drawn into its element set E, rows K.r0 to r1: the backing, the cells inset by their lines, the contour, the gold chain
   and (for the head) the mouth, fangs, eyes and tongue */
function drawChunk(f, K, E, r1, now, mesh, contour, glyph){
    let back = '', stroke = '', sil = '';
    const fills = new Map();
    /* the backing: the ribbon between the chunk's first and last rows, and the cells of those rows whole (their teeth reach past the ribbon) */
    if(!K.head && r1 > K.r0){
      /* the region between the visible half-rings of the first and last rows, bounded by the silhouettes. A sloping tube's ring bulges along
         its axis on the screen, so the ends follow the ring, not a chord. Wound the same way as the cells, or the nonzero fill cancels where
         the two overlap. */
      const xs = [], ys = [], ring = (r, a0, a1) => { const a = f.AR[r], b = f.BR[r]; for(let q = 0; q <= 8; q++){ const ps = a0 + (a1 - a0) * q / 8, p = a * Math.sin(ps), w = b * Math.cos(ps); xs.push(RW.cx[r] + p * RW.sx[r] + w * RW.ux[r]); ys.push((RW.cy[r] + p * RW.sy[r] + w * RW.uy[r]) * GY - (RW.cz[r] + p * RW.sz[r] + w * RW.uz[r]) * GZ); } };
      for(let r = K.r0; r <= r1; r++){ xs.push(SLX[r]); ys.push(SLY[r]); }
      ring(r1, PM[r1] - Math.PI / 2, PM[r1] + Math.PI / 2);
      for(let r = r1; r >= K.r0; r--){ xs.push(SRX[r]); ys.push(SRY[r]); }
      ring(K.r0, PM[K.r0] + Math.PI / 2, PM[K.r0] - Math.PI / 2);
      let ar = 0; for(let q = 0, n = xs.length; q < n; q++){ const j = (q + 1) % n; ar += xs[q] * ys[j] - xs[j] * ys[q]; }
      if(ar * FRONT < 0){ xs.reverse(); ys.reverse(); }
      back += 'M' + xs.map((x, q) => fx(x) + ' ' + fx(ys[q])).join('L') + 'Z';
    }
    for(const ci of K.cells){
      const C = CELLS[ci]; if(C.r > r1) continue;
      const p = cellPts(C), ar = area4(p);
      if(ar * FRONT <= .02) continue;
      if(K.head || C.r === K.r0 || C.r === r1){ const ps = poly(p); back += ps; if(K.head && C.r < r1 - 1) stroke += ps; }
      if(!mesh) continue;
      const q = inset(p, C.ins, ar); if(area4(q) * FRONT <= .01) continue;
      const col = cellColour(f, C, now, ci); let a = fills.get(col); if(!a) fills.set(col, a = []); a.push(poly(q));
    }
    /* the contour: the silhouette's two edges (and round the snout or the tail tip at the ends) */
    if(contour){
      const rs = K.head ? 0 : K.r0, re = r1 >= N - 3 ? N - 1 : r1 + 1, Lp = [], Rp = [];   // one row past the chunk, so the contour runs on into the next
      for(let r = rs; r <= re; r++){ Lp.push(fx(SLX[r]) + ' ' + fx(SLY[r])); Rp.push(fx(SRX[r]) + ' ' + fx(SRY[r])); }
      if(rs === 0) sil = 'M' + Lp.reverse().join('L') + 'L' + Rp.join('L');   // round the snout
      else if(re === N - 1) sil = 'M' + Lp.join('L') + 'L' + Rp.reverse().join('L');   // round the tail tip
      else sil = 'M' + Lp.join('L') + 'M' + Rp.join('L');
    }
    E.back.setAttribute('d', back); E.sil.setAttribute('d', sil); if(E.stroke) E.stroke.setAttribute('d', contour ? stroke : '');
    let n = 0;
    for(const [col, list] of fills){ let p = E.fills[n]; if(!p){ p = document.createElementNS(SVGNS, 'path'); E.g.insertBefore(p, E.after); E.fills.push(p); } p.setAttribute('d', list.join('')); const hx = intHex(col); if(p._c !== hx){ p.setAttribute('fill', hx); p._c = hx; } n++; }
    for(; n < E.fills.length; n++) if(E.fills[n].getAttribute('d')) E.fills[n].setAttribute('d', '');
    /* the gold chain down the back */
    let gd = '';
    const gr = f.glyphRun ? (now - f.glyphRun) / 1000 : -1, gf = gr >= 0 ? gr * 620 - 60 : -1e9; if(gr > 2.6) f.glyphRun = null;
    if(glyph || gr >= 0) for(let r = K.r0 - (K.r0 % 3); r <= r1; r += 3){ if(r < 4 || r > N - 6 || RW.uy[r] * GZ + RW.uz[r] * GY < .12) continue; const b = f.BR[r] * 1.02, x0 = RW.cx[r] + b * RW.ux[r], y0 = RW.cy[r] + b * RW.uy[r], z0 = RW.cz[r] + b * RW.uz[r], P2 = (x, y, z) => fx(x) + ' ' + fx(y * GY - z * GZ), lit = gr >= 0 ? Math.exp(-(((S[r] - gf) / 70) ** 2)) : 0, l = 2.6 * (1 + 1.4 * lit) * (glyph || lit > .05 ? 1 : 0), w = Math.min(1.8, f.AR[r] * .14) * (1 + 1.4 * lit); gd += 'M' + P2(x0 + RW.tx[r] * l, y0 + RW.ty[r] * l, z0 + RW.tz[r] * l) + 'L' + P2(x0 + RW.sx[r] * w, y0 + RW.sy[r] * w, z0 + RW.sz[r] * w) + 'L' + P2(x0 - RW.tx[r] * l, y0 - RW.ty[r] * l, z0 - RW.tz[r] * l) + 'L' + P2(x0 - RW.sx[r] * w, y0 - RW.sy[r] * w, z0 - RW.sz[r] * w) + 'Z'; }
    E.glyph.setAttribute('d', gd);
    if(K.head) head(f, E, now);
}
function render(f, now){
  const t0 = performance.now(), P = f.pal;
  frames(f);
  if(!FRONT){ const C = CELLS.find(c => c.r === M && Math.abs(c.psi) < .3); FRONT = area4(cellPts(C)) > 0 ? 1 : -1; if(RW.uz[M] < 0) FRONT = -FRONT; }
  /* the camera follows the body, slowly */
  /* the camera follows the body and widens to keep all of it in frame, slowly */
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for(let i = 0; i < N; i += 2){ if(S[i] > f.hideFrom) break; const x = f.X[i], y = f.Y[i] * GY - f.z[i] * GZ; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, zw = clamp(Math.max((x1 - x0 + 120), (y1 - y0 + 120) * f.VW / f.VH) / f.VW, 1, 1.9);
  if(f.viewFix){ f.cam.x = f.viewFix[0] + f.viewFix[2] / 2; f.cam.y = f.viewFix[1] + f.viewFix[3] / 2; f.cam.z = f.viewFix[2] / f.VW; f.cam.ok = true; }   // (a stage's view: fixed, the world does not follow the body)
  else if(!f.cam.ok){ f.cam.x = mx; f.cam.y = my; f.cam.z = zw; f.cam.ok = true; } else {
    /* the camera is slow, but a strike's reach would leave the view before it caught up: when any of the body is within 30 px of the edge it follows at once */
    const hw = f.VW * f.cam.z / 2 - 30, hh = f.VH * f.cam.z / 2 - 30, edge = x0 < f.cam.x - hw || x1 > f.cam.x + hw || y0 < f.cam.y - hh || y1 > f.cam.y + hh, tc = edge ? .25 : .9, tz = edge ? .35 : 1.4;
    const k = 1 - Math.exp(-(f.dtR || .016) / tc), kz = 1 - Math.exp(-(f.dtR || .016) / tz); f.cam.x += (mx - f.cam.x) * k; f.cam.y += (my - f.cam.y) * k; f.cam.z += (zw - f.cam.z) * kz; }
  const VW = f.VW * f.cam.z, VH = f.VH * f.cam.z; f.svg.setAttribute('viewBox', `${fx(f.cam.x - VW / 2)} ${fx(f.cam.y - VH / 2)} ${fx(VW)} ${fx(VH)}`);
  /* the shadow on the ground */
  { let sL = '', sR = ''; for(let i = 0; i < N; i += 2){ if(S[i] > f.hideFrom) break; const a = f.AR[i] * 1.1 * clamp(1 - (f.z[i] - f.restS[i]) / 36) * (f.sup[i] > 18 ? 0 : 1), nx = -f.ty[i], ny = f.tx[i], gx = f.X[i] + f.z[i] * .12, gy = f.Y[i] + f.z[i] * .05; sL += (i ? 'L' : 'M') + fx(gx + nx * a) + ' ' + fx((gy + ny * a) * GY); sR = 'L' + fx(gx - nx * a) + ' ' + fx((gy - ny * a) * GY) + sR; } f.shadow.setAttribute('d', sL + sR + 'Z'); }
  const hideR = idxAt(f.hideFrom), mesh = f.layers.mesh, contour = f.layers.contour, glyph = f.layers.glyph;
  /* a ring that is eating its tail: the last stretch of the visible tail is drawn into the head's own group, between the mouth and the head's
     cells, so it goes in between the jaws and is hidden by the head's cells behind them; the rest of the tail is drawn as usual */
  const sLip = L - f.ch.ring.v, eating = f.ringOn && idxAt(sLip - 56) > idxAt(HL + 40), rIn = eating ? idxAt(sLip - 56) : N, hr = Math.min(hideR, rIn);
  const order = [];
  CHUNKS.forEach((K, ki) => {
    const E = f.el[ki]; let dep = 0; for(let r = K.r0; r <= K.r1; r++) dep += DEP[r] + .8 * (f.restS[r] - B0[r]); dep /= K.r1 - K.r0 + 1; if(K.head) dep += 6; order.push([dep, ki]);   // what lies on top of other body is drawn after it
    if(K.r0 > hr){ E.g.style.display = 'none'; return; } E.g.style.display = '';
    if(f.occ){ let mx_ = 0, my_ = 0, mz_ = 0, c_ = 0; for(let r = K.r0; r <= K.r1; r++){ mx_ += f.X[r]; my_ += f.Y[r]; mz_ += f.z[r]; c_++; } mx_ /= c_; my_ /= c_; mz_ /= c_;
      let m = ''; for(const O of f.occ) if(O.on && my_ < O.cy && mz_ < O.z1 && Math.hypot(mx_ - O.cx, my_ - O.cy) < O.r) { m = O.url; break; }   // (behind the trunk's axis, within reach of it and below its top)
      if(E.mask !== m){ E.mask = m; if(m) E.g.setAttribute('mask', m); else E.g.removeAttribute('mask'); } }
    drawChunk(f, K, E, Math.min(K.r1, hr - 1), now, mesh, contour, glyph);
  });
  { const E = f.el[CHUNKS.length];
    if(eating && hideR - 1 > rIn){ E.g.style.display = ''; const cells = []; for(let r = rIn; r <= hideR - 1; r++) for(const ci of ROWCELLS[r]) cells.push(ci); drawChunk(f, {r0:rIn, r1:hideR - 1, head:false, cells}, E, hideR - 1, now, mesh, contour, false); } else E.g.style.display = 'none'; }
  order.sort((a, b) => a[0] - b[0]);
  const key = order.map(o => o[1]).join(',');
  if(key !== f.orderKey){ f.orderKey = key; for(const [, ki] of order) f.body.appendChild(f.el[ki].g); }
  if(f.view === 'anatomy') anatomy(f); else if(f.anat) f.anat.style.display = 'none';
  f.cpu = f.cpu * .9 + (performance.now() - t0) * .1;
}
/* the head's own parts: the open mouth (under the cells), fangs, eyes and tongue (over them) */
function head(f, E, now){
  const P = f.pal, gp = Math.max(f.ch.gape.v, f.bite || 0), rh = idxAt(HINGE), sx3 = (x, y, z) => fx(x) + ' ' + fx(y * GY - z * GZ);
  let mouth = '';
  if(gp > .02){
    const chain = (side, jaw) => { const out = []; for(let r = 1; r <= rh + 1; r++){ const o = OFF[r]; let best = -1, bd = 9; for(let c = 0; c < NC; c++){ const ps = wrap((c + .5 * o) * DPSI), d = Math.abs(ps - side * LIP); if(d < bd){ bd = d; best = c; } } const v = vid(r, best); if(jaw){ const q = JSLOT.get(v); out.push(q == null ? [PX[v], PY[v]] : [JX[q], JY[q]]); } else out.push([PX[v], PY[v]]); } return out; };
    const uL = chain(1, false), uR = chain(-1, false), jL = chain(1, true), jR = chain(-1, true);
    const pts = [...uL.reverse(), ...uR, ...jR.reverse(), ...jL];
    mouth = 'M' + pts.map(p => fx(p[0]) + ' ' + fx(p[1])).join('L') + 'Z';
  }
  E.mouth.setAttribute('d', mouth);
  /* fangs, down from the front of the upper jaw as it opens */
  let fang = '';
  if(HD.fangs !== false && gp > .25){ const r = idxAt(7), {cx, cy, cz, ux, uy, uz, tx, ty, tz, sx, sy, sz} = RW; for(const sd of [1, -1]){ const a = f.AR[r] * .62 * sd, x = cx[r] + a * sx[r] - .2 * f.BR[r] * ux[r], y = cy[r] + a * sy[r] - .2 * f.BR[r] * uy[r], z = cz[r] + a * sz[r] - .2 * f.BR[r] * uz[r], l = 9 * (gp - .2); fang += 'M' + sx3(x - tx[r] * 1.4, y - ty[r] * 1.4, z - tz[r] * 1.4) + 'L' + sx3(x - ux[r] * l + tx[r] * 1.6, y - uy[r] * l + ty[r] * 1.6, z - uz[r] * l + tz[r] * 1.6) + 'L' + sx3(x + tx[r] * 1.4, y + ty[r] * 1.4, z + tz[r] * 1.4) + 'Z'; } }
  E.fang.setAttribute('d', fang);
  /* the eyes: an amber disc on each side, a slit pupil, a glint, wherever that side faces the camera */
  let iris = '', pupil = '', glint = '';
  { const EY = HD.eye || {}, r = idxAt(EY.s ?? 21), {cx, cy, cz, ux, uy, uz, tx, ty, tz, sx, sy, sz} = RW;
    for(const sd of [1, -1]){
      const ps = (EY.psi ?? 1.06) * sd, a = f.AR[r], b = f.BR[r], nx = Math.sin(ps) / a * sx[r] + Math.cos(ps) / b * ux[r], ny = Math.sin(ps) / a * sy[r] + Math.cos(ps) / b * uy[r], nz = Math.sin(ps) / a * sz[r] + Math.cos(ps) / b * uz[r], nl = Math.hypot(nx, ny, nz);
      const face = (ny * GZ + nz * GY) / nl; if(face < .08) continue;
      const ox = cx[r] + a * Math.sin(ps) * sx[r] + b * Math.cos(ps) * ux[r] + nx / nl * .6, oy = cy[r] + a * Math.sin(ps) * sy[r] + b * Math.cos(ps) * uy[r] + ny / nl * .6, oz = cz[r] + a * Math.sin(ps) * sz[r] + b * Math.cos(ps) * uz[r] + nz / nl * .6;
      const vx = Math.cos(ps) * sx[r] - Math.sin(ps) * ux[r], vy = Math.cos(ps) * sy[r] - Math.sin(ps) * uy[r], vz = Math.cos(ps) * sz[r] - Math.sin(ps) * uz[r];
      const ell = (rad, rt, rv, dx = 0, dy = 0) => { let s = ''; for(let q = 0; q < 14; q++){ const a2 = q / 14 * TAU, c1 = Math.cos(a2) * rad * rt, c2 = Math.sin(a2) * rad * rv; s += (q ? 'L' : 'M') + sx3(ox + tx[r] * (c1 + dx) + vx * (c2 + dy), oy + ty[r] * (c1 + dx) + vy * (c2 + dy), oz + tz[r] * (c1 + dx) + vz * (c2 + dy)); } return s + 'Z'; };
      const er = EY.r ?? 3.7; iris += ell(er, 1, 1); pupil += ell(er * .84, EY.round ? .84 : .26, 1); glint += ell(.75, 1, 1, -1.1, -1.2 * sd);
    }
  }
  E.iris.setAttribute('d', iris); E.pupil.setAttribute('d', pupil); E.glint.setAttribute('d', glint);
  /* the tongue: out from the notch in the snout, forked, flickering up and down */
  let tg = '';
  const tv = f.ch.tongue.v;
  if(tv > .03){
    const r = 0, {cx, cy, cz, tx, ty, tz, ux, uy, uz, sx, sy, sz} = RW, t = (now - f.flick) / 1000, fl = .42 * Math.sin(TAU * 9 * t) * Math.min(1, tv * 1.6), l = 30 * tv;
    const bx0 = cx[r] - tx[r] * .5 - ux[r] * 1.6, by0 = cy[r] - ty[r] * .5 - uy[r] * 1.6, bz0 = cz[r] - tz[r] * .5 - uz[r] * 1.6;
    const dir = (u, k) => [-tx[r] * Math.cos(u) + ux[r] * Math.sin(u) + sx[r] * k, -ty[r] * Math.cos(u) + uy[r] * Math.sin(u) + sy[r] * k, -tz[r] * Math.cos(u) + uz[r] * Math.sin(u) + sz[r] * k];
    const d0 = dir(fl * .4 - .08, 0), m = [bx0 + d0[0] * l * .68, by0 + d0[1] * l * .68, bz0 + d0[2] * l * .68];
    tg = 'M' + sx3(bx0, by0, bz0) + 'L' + sx3(...m);
    for(const k of [.38, -.38]){ const d1 = dir(fl, k); tg += 'M' + sx3(...m) + 'L' + sx3(m[0] + d1[0] * l * .34, m[1] + d1[1] * l * .34, m[2] + d1[2] * l * .34); }
  }
  E.tongue.setAttribute('d', tg);
  void P;
}
function anatomy(f){
  if(!f.anat){ f.anat = document.createElementNS(SVGNS, 'g'); f.anat.innerHTML = '<path class="sp" fill="none"/><path class="mL" fill="none" stroke-width="3"/><path class="mR" fill="none" stroke-width="3"/><path class="vb" fill="none" stroke-width="1"/>'; f.svg.appendChild(f.anat); }
  f.anat.style.display = '';
  const {cx, cy, cz, sx, sy, sz} = RW, P2 = (x, y, z) => fx(x) + ' ' + fx(y * GY - z * GZ);
  let sp = '', vb = '', mL = '', mR = '';
  for(let i = 0; i < N; i += 2){ sp += (i ? 'L' : 'M') + P2(cx[i], cy[i], cz[i]); }
  for(let i = 30; i < N - 4; i += 4){ const w = f.AR[i] * .5; vb += 'M' + P2(cx[i] + sx[i] * w, cy[i] + sy[i] * w, cz[i] + sz[i] * w) + 'L' + P2(cx[i] - sx[i] * w, cy[i] - sy[i] * w, cz[i] - sz[i] * w); }
  for(let i = 24; i < N - 6; i += 2){ const w = f.AR[i] * .62; mL += (i > 24 ? 'L' : 'M') + P2(cx[i] + sx[i] * w, cy[i] + sy[i] * w, cz[i] + sz[i] * w); mR += (i > 24 ? 'L' : 'M') + P2(cx[i] - sx[i] * w, cy[i] - sy[i] * w, cz[i] - sz[i] * w); }
  const g = f.anat.children, P = f.pal;
  g[0].setAttribute('d', sp); g[0].setAttribute('stroke', intHex(P.bone)); g[0].setAttribute('stroke-width', '2.4');
  g[3].setAttribute('d', vb); g[3].setAttribute('stroke', intHex(P.bone));
  let aL = 0, aR = 0; for(let i = 0; i < N; i++){ aL = Math.max(aL, -f.act[i]); aR = Math.max(aR, f.act[i]); }
  g[1].setAttribute('d', mL); g[1].setAttribute('stroke', intHex(mixInt(P.line, P.cinnabar, .2 + aL * .8)));
  g[2].setAttribute('d', mR); g[2].setAttribute('stroke', intHex(mixInt(P.line, P.cinnabar, .2 + aR * .8)));
}

/* ---------- mounting ---------- */
let OCC_UID = 0;
function mountCreature(el, o = {}){
  const f = create(o); f._step = step; f._render = render;
  const svg = document.createElementNS(SVGNS, 'svg');
  f.VW = o.vw || 570; f.VH = o.vh || 463; f.svg = svg; f.viewFix = o.view || null;
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.style.display = 'block';
  const size = o.size || 600; svg.setAttribute('width', size); svg.setAttribute('height', Math.round(size * f.VH / f.VW));
  el.appendChild(svg);
  f.shadow = document.createElementNS(SVGNS, 'path'); svg.appendChild(f.shadow);
  f.body = document.createElementNS(SVGNS, 'g'); svg.appendChild(f.body);
  /* occluders (a stage's trunk): the chunks of body behind one are masked by its silhouette, which the stage keeps current (api.occluder) */
  if(o.occluders){ const defs = document.createElementNS(SVGNS, 'defs'); svg.insertBefore(defs, svg.firstChild); f.occ = [];
    for(let k = 0; k < o.occluders; k++){ const id = 'cbocc' + (++OCC_UID), m = document.createElementNS(SVGNS, 'mask'), r = document.createElementNS(SVGNS, 'rect'), p = document.createElementNS(SVGNS, 'path');
      m.setAttribute('id', id); m.setAttribute('maskUnits', 'userSpaceOnUse'); m.setAttribute('x', -1e4); m.setAttribute('y', -1e4); m.setAttribute('width', 2e4); m.setAttribute('height', 2e4);
      r.setAttribute('x', -1e4); r.setAttribute('y', -1e4); r.setAttribute('width', 2e4); r.setAttribute('height', 2e4); r.setAttribute('fill', '#fff'); p.setAttribute('fill', '#000');
      m.append(r, p); defs.appendChild(m); f.occ.push({url:'url(#' + id + ')', path:p, on:false, cx:0, cy:0, r:0, z1:0}); } }
  f.el = CHUNKS.map(K => {
    const g = document.createElementNS(SVGNS, 'g'), mk = cls => { const p = document.createElementNS(SVGNS, 'path'); if(cls) p.setAttribute('class', cls); g.appendChild(p); return p; };
    const E = {g, fills:[]};
    if(K.head) E.mouth = mk();   // the open mouth lies under the head's backing, so only the gap between the jaws shows it
    E.sil = mk(); E.back = mk(); if(K.head) E.stroke = mk();
    E.after = mk(); E.glyph = mk();
    if(K.head){ E.fang = mk(); E.iris = mk(); E.pupil = mk(); E.glint = mk(); E.tongue = mk(); }
    f.body.appendChild(g); return E;
  });
  /* the head's inner layer: the tail going into the mouth is drawn here, between the open mouth and the head's cells */
  { const g = document.createElementNS(SVGNS, 'g'), E = {g, fills:[]}, mk = () => { const p = document.createElementNS(SVGNS, 'path'); g.appendChild(p); return p; };
    E.sil = mk(); E.back = mk(); E.after = mk(); E.glyph = mk(); g.style.display = 'none'; f.el[0].g.insertBefore(g, f.el[0].sil); f.el.push(E); }
  const recolour = () => {
    const P = f.pal, line = intHex(P.line);
    f.shadow.setAttribute('fill', '#000'); f.shadow.setAttribute('fill-opacity', '.28');
    for(const E of f.el){
      E.back.setAttribute('fill', line);
      E.sil.setAttribute('fill', 'none'); E.sil.setAttribute('stroke', line); E.sil.setAttribute('stroke-width', LW.contour * 2); E.sil.setAttribute('stroke-linejoin', 'round'); E.sil.setAttribute('stroke-linecap', 'butt');
      E.after.setAttribute('d', '');
      E.glyph.setAttribute('fill', intHex(P.gold));
      if(E.stroke){ E.stroke.setAttribute('fill', 'none'); E.stroke.setAttribute('stroke', line); E.stroke.setAttribute('stroke-width', LW.contour * 2); E.stroke.setAttribute('stroke-linejoin', 'round');
        E.mouth.setAttribute('fill', intHex(P.mouth)); E.mouth.setAttribute('stroke', line); E.mouth.setAttribute('stroke-width', LW.region);
        E.fang.setAttribute('fill', intHex(P.bone)); E.iris.setAttribute('fill', intHex(P.eye)); E.iris.setAttribute('stroke', line); E.iris.setAttribute('stroke-width', LW.region);
        E.pupil.setAttribute('fill', intHex(P.obsidian)); E.glint.setAttribute('fill', intHex(P.bone));
        E.tongue.setAttribute('fill', 'none'); E.tongue.setAttribute('stroke', intHex(P.cinnabar)); E.tongue.setAttribute('stroke-width', '1.5'); E.tongue.setAttribute('stroke-linecap', 'round'); E.tongue.setAttribute('stroke-linejoin', 'round'); }
      for(const p of E.fills) p._c = null;
    }
  };
  recolour();
  setState(f, f.state);
  render(f, clock(f));
  /* the handle */
  const api = {
    f, N, L, cells:CELLS.length, plates:PLATES.size,
    pause:on => { f.paused = on; if(on) f.vt = f.vt ?? performance.now(); else f.vt = null; },
    advance:(ms, st = 1000 / 60) => { let t = f.vt ?? performance.now(); const end = t + ms; while(t < end - 1e-6){ const d = Math.min(st, end - t), te = f.dyn.tempo, n = bodySteps(d / 1000 * te); t += d; f.vt = t; f.dtR = d / 1000; for(let q = 0; q < n; q++){ f.bt += d / n * te; step(f, f.bt, d / n / 1000 * te); } } f.vt = t; render(f, f.bt); return t; },
    realtime:() => { f.vt = null; f.lastT = performance.now(); },
    now:() => clock(f),
    state:() => f.state, travelling:() => !!f.trav, moving:() => f.trav ? f.trav.to : null,
    goState:(id, o) => { if(!STATES[id] || f.trav || isTrack(id)) return; moveTo(f, id, o || {}); },
    setState:(id, o) => { setState(f, id, o); render(f, clock(f)); },
    play:name => play(f, name),
    strike:o => strike(f, o),
    follow:(path, o) => follow(f, path, o),
    occluder:(k, o) => { const O = f.occ && f.occ[k]; if(!O) return; if(o.d != null) O.path.setAttribute('d', o.d); for(const key of ['cx', 'cy', 'r', 'z1', 'on']) if(o[key] != null) O[key] = o[key]; },
    head:() => ({x:f.X[0], y:f.Y[0], z:f.z[0], fwd:f.headFwd, h:f.h}),
    course:() => ({state:f.state, onCourse:f.tape && isTrack(f.state), anchored:f.anc, travelling:!!f.trav, to:f.trav ? f.trav.to : null, left:f.trav ? Math.max(0, f.trav.end - f.h) : 0}),
    ringRes:() => ({r0:f.ringRes0, r1:f.ringRes1}),
    ring:() => { if(!f.rg) return null; const RM = RINGMS[f.rgId]; return {id:f.rgId, mode:f.rg.mode, tau:f.rg.tau, rate:f.rg.rate, fraction:f.rg.fraction, v:f.ch.ring.v, vmax:RM.vmax, start:RM.start, duration:RM.duration, gulp:f.rg.state.gulp, gulps:RM.gulps.length, gape:f.rg.state.gape, lumps:f.rg.state.lumps.length, minLength:L - RM.start - RM.vmax, leaving:!!f.ringDone}; },
    /* where the tail's tip is against the lips that hold it (px), and whether it is drawn (a ring holds the true tip) */
    tip:() => { const iL = idxAt(LIPD), t = LIPD - S[iL], lx = f.X[iL] + (f.X[iL + 1] - f.X[iL]) * t / DS[iL], ly = f.Y[iL] + (f.Y[iL + 1] - f.Y[iL]) * t / DS[iL], sl = clamp(L - f.ch.ring.v, 0, L), j = Math.min(N - 2, idxAt(sl)), u = (sl - S[j]) / DS[j], tx = f.X[j] + (f.X[j + 1] - f.X[j]) * u, ty = f.Y[j] + (f.Y[j + 1] - f.Y[j]) * u; return {gap:Math.hypot(tx - lx, ty - ly), tipDrawn:f.hideFrom >= L, tipToLips:Math.hypot(f.X[N - 1] - lx, f.Y[N - 1] - ly)}; },
    ringSwallow:o => swallow(f, o), ringHold:() => ringRun(f, 'hold'), ringRelease:o => release(f, o), ringTo:fr => { if(f.rg && f.ringOn){ f.gen++; f.rg.toFraction(fr); f.busy = clock(f) + 3000; } },
    stop:() => { f.later = []; f.busy = 0; f.queue = null; f.gen++; f.own = {}; if(f.ringDone){ f.ringDone = null; f.rg.hold(); } backTo(f, 900); for(const k of ['gape', 'tongue', 'lure', 'rattle', 'tailUp']) if(!padHolds(f, k) && !(k === 'gape' && f.ringOn)) goal(f.ch[k], home(f, k), 500, clock(f)); },
    life:on => { f.lifeOn = on; if(on){ f.nextBout = clock(f) + 600; } },
    lifeOn:() => f.lifeOn,
    lifeRate:r => { if(r != null) f.rate = r; return f.rate; },
    breath:on => { f.breathOn = on; },
    setView:v => { f.view = v; for(const E of f.el) for(const p of E.fills) p._c = null; },
    setLayer:(name, on) => { f.layers[name] = on; },
    setPalette:p => { f.palIn = {...(f.palIn || {ink:def.ink, ...(def.palette || {})}), ...p}; f.pal = makePal(f.palIn); recolour(); for(const E of f.el) for(const q of E.fills) q._c = null; },
    palette:() => ({ink:intHex(f.pal.ink), wash:intHex(f.pal.wash), eye:intHex(f.pal.eye)}),
    behaviour:(style, rate) => { if(style) f.beh.style = style; if(rate != null) f.beh.rate = rate; return {...f.beh}; },
    setBehPalette:list => { f.beh.pal = list.map(hexInt); },
    behPalette:() => f.beh.pal.map(intHex),
    ripple:() => { f.beh.fx.push({kind:'ripple', t0:clock(f), col:f.beh.pal[Math.floor(Math.random() * f.beh.pal.length)]}); },
    shimmer:() => { f.beh.fx.push({kind:'shimmer', t0:clock(f), col:f.beh.pal[Math.floor(Math.random() * f.beh.pal.length)]}); },
    glyph:() => { f.glyphRun = clock(f); },
    burstAt:s0 => { f.beh.fx.push({kind:'burst', s0, t0:clock(f), col:f.beh.pal[Math.floor(Math.random() * f.beh.pal.length)]}); },
    /* a click on the figure: the station nearest it, by the centreline drawn on the screen */
    stationAt:(cx, cy) => { const m = svg.getScreenCTM(); if(!m) return null; const p = new DOMPoint(cx, cy).matrixTransform(m.inverse()); let bi = 0, bd = 1e9; for(let i = 0; i < N; i++){ if(S[i] > f.hideFrom) break; const d = Math.hypot(f.X[i] - p.x, f.Y[i] * GY - f.z[i] * GZ - p.y); if(d < bd){ bd = d; bi = i; } } return bd < 60 ? S[bi] : null; },
    musHold:(name, v) => { if(v) f.musHold[name] = v; else delete f.musHold[name]; },
    musHeld:() => ({...f.musHold}),
    dynamics:() => ({tempo:f.dyn.tempo, motion:f.dyn.motion, pace:f.mv.pace, wriggle:f.mv.wriggle, coil:f.coil, breath:f.breathDepth}),
    pad:(id, x, y) => { f.pads[id] = {on:true, x, y}; f.held.add(id); },
    padRelease:id => { delete f.pads[id]; f.held.delete(id); if(id === 'ring'){ if(f.rg) f.rg.hold(); return; } if(PADS[id] && PADS[id].keep){ if(id === 'body'){ f.coil = 1; f.breathDepth = 1; } if(id === 'moving') f.mv = {pace:1, wriggle:1}; if(id === 'dynamics') f.dyn = {tempo:1, motion:1}; return; }
      /* its channels go back to the state's own posture, those no animation has and the state does not hold (an action under way brings them home itself) */
      if(id === 'head' || id === 'neck') backTo(f, 800);
      for(const k in PADCH) if(PADCH[k][0] === id && k !== 'H' && k !== 'sb' && k !== 'pitch' && !owned(f, k) && !locked(f, k)) settle(f, k, {gape:500, tongue:400, curl:900, tailUp:800, lure:500, rel:800}[k]); },
    padState:id => f.pads[id] || null, padGhost:id => padGhost(f, id),
    /* where a posture channel rests now (the held pad's value, the state's posture, or what the state locks), and whether an animation has it */
    home:k => home(f, k), owned:k => owned(f, k),
    resize:px => { svg.setAttribute('width', px); svg.setAttribute('height', Math.round(px * f.VH / f.VW)); },
    muscles:() => { const g = REGIONS; return g.map(([n, a, b]) => { let l = 0, r = 0, c = 0; for(let i = 0; i < N; i++) if(S[i] >= a && S[i] < b){ l += Math.max(0, -f.act[i]); r += Math.max(0, f.act[i]); c++; } return {name:n, L:l / c, R:r / c}; }).concat([{name:'jaw', C:f.ch.gape.v}, {name:'tongue', C:f.ch.tongue.v}, {name:'lift', C:clamp(f.ch.H.v / 210)}]); },
    lifeLog:() => ({log:f.log.slice(-12), state:f.state, travelling:!!f.trav, busy:Math.max(0, Math.round(f.busy - clock(f))), next:Math.round(f.nextBout - clock(f)), move:Math.round(f.nextMove - clock(f)), ring:+f.ch.ring.v.toFixed(1)}),
    spine3:() => ({X:Float32Array.from(f.X), D:Float32Array.from(f.Y), Z:Float32Array.from(f.z), hw:Float32Array.from(f.AR), step:L / N, hide:f.hideFrom, S:Float32Array.from(S)}),
    cpu:() => f.cpu,
    destroy:() => { const n = LIVE.indexOf(f); if(n >= 0) LIVE.splice(n, 1); el.innerHTML = ''; },
  };
  if(o.live !== false){ LIVE.push(f); if(!raf) raf = requestAnimationFrame(loop); }
  return api;
}
return {mountCreature, STATES, ACTIONS, PADS, N, L, HL, HEADR, NECK1, LIPD, VERSION, CHANGELOG, RING:RINGM, RINGS:RINGMS, cells:CELLS.length, plates:PLATES.size, _dbg:{CELLS, CHUNKS, S, PX, PY, SLX, SLY, SRX, SRY, RW, planRoute, B}};
}

/* ---------- mounting ---------- */
/* the body's steps are never longer than a 60 Hz frame of its own time: at a quick tempo a frame holds more of it, and a stiff spring (a strike's)
   stepped over that much at once overshoots and grows without end */
const bodySteps = dtBody => Math.max(1, Math.ceil(dtBody / (1 / 60) - .01));
const LIVE = [];
let raf = 0;
function loop(){
  const t = performance.now();
  for(const f of LIVE){
    if(f.paused || f.vt != null){ f.lastT = t; continue; }
    let dt = Math.min(.1, (t - (f.lastT || t)) / 1000); f.lastT = t;
    f.dtR = dt;
    const te = f.dyn.tempo, n = bodySteps(dt * te); for(let q = 0; q < n; q++){ f.bt += dt / n * 1000 * te; f._step(f, f.bt, dt / n * te); }
    f._render(f, f.bt);
  }
  raf = requestAnimationFrame(loop);
}
/* ---------- standard shapes: a state's fill can be one of these (P is the state's par, B the body's measures) ---------- */
const FILLS = {
  /* a heap: a coil whose radius grows from the top turn (R) toward the tail (R + dR); the neck rises from sN, its base curling in over the
     coil first, so it stands over the heap instead of jutting out from the rim */
  coil(f, k, P, B){
    const {S, N, L, sstep, clamp} = B, s0 = P.sN, s1 = L - 64, sc = f.coil;
    for(let i = 0; i < N; i++){
      const s = S[i]; if(s < s0 - 130){ k[i] = 0; continue; }
      const u = clamp((s - s0) / (s1 - s0)), R = (P.R + P.dR * u) * sc;
      let v = P.dir / R * sstep(s0 - 40, s0 + 30, s);
      if(s > s1) v *= 1 - .6 * sstep(s1, L, s);
      v += P.dir * (P.curlIn ?? .011) * Math.exp(-(((s - (s0 - 30)) / 38) ** 2));
      k[i] = v;
    }
  },
  /* a flat spiral with the head in the middle and touching turns: each turn spaced by the two half-widths beside it plus gap */
  spiral(f, k, P, B){
    const {S, N, DS, L, HEADR, fA, sstep, TAU} = B, gap = P.gap + f.br * .9;
    let r = P.r0 * f.coil;
    for(let i = 0; i < N; i++){ const s = S[i]; k[i] = P.dir / r * sstep(HEADR - 4, HEADR + 8, s); if(s >= HEADR) r += (fA(s) + fA(Math.min(L, s + TAU * r)) + gap) / (TAU * r) * DS[i]; }
  },
  /* a ring, as a pill: from the jaw angle round to the head again, turning exactly once, in two arcs and two straight runs. The last run (as long
     as the head, plus a little) is where the tail goes in: it lies along the head's own axis, so the tail meets the snout end on and runs into
     the mouth, however small the ring. The other run is its opposite side. Each run's ends are eased. The state needs ring: true; par.flat is
     the last run's length (the head's plus 8 by default). The shape is solved to close each frame (the opposite run's length and a little
     difference between the two arcs' curvatures, by Newton from where it was last frame), so close() has only the layers' small
     disturbances left to take out. It closes at the jaw angle's point, whose station (B.ringS1) lies past the tail's end while the tip is still
     near the lips: the last run is straight, so the part that is not there is where it would be. */
  ring(f, k, P, B, X){
    const {S, N, DS, L, HEADR, idxAt, sstep, TAU} = B, s1 = B.ringS1 ? B.ringS1(f) : L - f.ch.ring.v, C = s1 - HEADR, F = P.flat ?? HEADR + 8, e = 12, i0 = idxAt(HEADR), i1 = idxAt(s1);
    /* X (optional): the layers' curvature X.d on top of the shape, their turning X.turn and the ground each stretch covers X.hf: the shape is
       then solved so the whole closes, and gives back only its own part (the engine adds X.d) */
    const turnAll = TAU - (X ? P.dir * X.turn : 0), dX = X ? X.d : null, hf = X ? X.hf : null;
    const fl = (q, x0, x1) => sstep(x0 - e, x0 + e, q) * (1 - sstep(x1 - e, x1 + e, q));
    const W = FILLS._W || (FILLS._W = {a:new Float64Array(N), b:new Float64Array(N), k:new Float64Array(N)});
    const shape = (F2, rho) => {
      const aLen = Math.max(8, (C - F - F2) / 2); let ta = 0, tb = 0;
      for(let i = 0; i < N; i++){
        const q = S[i] - HEADR; let wa = 0, wb = 0;
        if(q >= 0 && S[i] <= s1){ const lead = sstep(0, 2 * e, q), tail = 1 - fl(q, C - F, C + 30); wa = lead * tail * (1 - sstep(aLen - e, aLen + e, q)); wb = tail * sstep(aLen + F2 - e, aLen + F2 + e, q) * (1 - fl(q, C - F, C + 30)); }
        W.a[i] = wa; W.b[i] = wb; ta += wa * DS[i]; tb += wb * DS[i];
      }
      const kv = turnAll / Math.max(1, ta + tb), k1 = kv * (1 + rho), k2 = (turnAll - k1 * ta) / Math.max(1e-6, tb);   // (the second arc takes whatever turning is left: exactly one circle in all, the layers' included)
      for(let i = 0; i < N; i++) W.k[i] = P.dir * (k1 * W.a[i] + k2 * W.b[i]);
      /* where it ends: the same integral close() uses */
      let th = 0, x = 0, y = 0; for(let i = i0; i < i1; i++){ const t2 = th + (W.k[i] + (dX ? dX[i] : 0)) * DS[i], h = DS[i] * (hf ? hf[i] : 1); x += h * Math.cos(.5 * (th + t2)); y += h * Math.sin(.5 * (th + t2)); th = t2; }
      const fr = s1 - S[i1]; return [x + fr * Math.cos(th), y + fr * Math.sin(th)];
    };
    const solve = (u, iters) => {
      let res = 1e9;
      for(let it = 0; it < iters; it++){
        const e0 = shape(u.F2, u.rho); res = Math.hypot(e0[0], e0[1]); if(res < .05) break;
        const dF = 2, dR = .02, eF = shape(u.F2 + dF, u.rho), eR = shape(u.F2, u.rho + dR);
        const a11 = (eF[0] - e0[0]) / dF, a21 = (eF[1] - e0[1]) / dF, a12 = (eR[0] - e0[0]) / dR, a22 = (eR[1] - e0[1]) / dR, det = a11 * a22 - a12 * a21;
        if(Math.abs(det) < 1e-9) break;
        const dx = -( a22 * e0[0] - a12 * e0[1]) / det, dy = -(-a21 * e0[0] + a11 * e0[1]) / det;
        u = {F2:Math.min(Math.max(F * .4, u.F2 + dx), (C - F) * .9), rho:Math.min(.45, Math.max(-.45, u.rho + dy)), C};
      }
      const e1 = shape(u.F2, u.rho); return {u, res:Math.hypot(e1[0], e1[1])};
    };
    let r = solve(f._ringU && Math.abs((f._ringU.C || 0) - C) < 400 ? f._ringU : {F2:F, rho:0, C}, X ? 4 : 5);
    if(r.res > 1) r = solve({F2:F, rho:0, C}, 12);   // (from where it was, or from the plain pill if that has not closed it)
    f._ringU = r.u; f._ringBad = r.res > 1; shape(r.u.F2, r.u.rho);
    for(let i = 0; i < N; i++) k[i] = W.k[i];
  },
  /* a figure of eight (a lemniscate ouroboros), the ring's other closed form. The head lies across the end of one loop (A) with the tail going in at
     its lips along the last straight run, as in the ring. From the jaw angle the body runs round half of loop A, crosses the middle on a straight
     diagonal, goes round loop B the other way, crosses back over its first diagonal (contact lifts it over), and comes round A's other half to
     the head. The loops turn opposite ways by the same amount, so the whole turns not at all (turns: 0) and the tail meets the head facing the
     way it faces. par.cross is half the angle the diagonals cross at (default .7 rad, 80 degrees between them); par.share loop A's share of the
     loops' length (default .5); par.flat the last run, as in the ring. The diagonals' length (which closes it along the head) and how A's two
     halves divide their length (which closes it across) are solved each frame, by Newton from where they were; each half turns half of A's
     turn, so the diagonals always cross at the same angle. A size whose crossing has no room for one body to rise over the other (a diagonal
     under par.minD, default 5 half-widths) is refused, which sets how small the swallow takes it. */
  eight(f, k, P, B, X){
    const {S, N, DS, L, HEADR, AMAX, idxAt, sstep} = B, s1 = B.ringS1 ? B.ringS1(f) : L - f.ch.ring.v, C = s1 - HEADR, F = P.flat ?? HEADR + 8, e = 12, i0 = idxAt(HEADR), i1 = idxAt(s1);
    const phi = P.cross ?? .7, al = Math.PI + 2 * phi, minD = P.minD ?? 5 * (AMAX || 16), qa = P.share ?? .5;
    const alB = al + (X ? P.dir * X.turn : 0), dX = X ? X.d : null, hf = X ? X.hf : null;   // (X as in ring: loop B gives up the layers' turning)
    const fl = (q, x0, x1) => sstep(x0 - e, x0 + e, q) * (1 - sstep(x1 - e, x1 + e, q));
    const W = FILLS._W8 || (FILLS._W8 = {a:new Float64Array(N), c:new Float64Array(N), b:new Float64Array(N), k:new Float64Array(N)});
    const shape = (D, rho) => {
      const T = Math.max(60, C - F - 2 * D), aA = qa * T, a1 = aA / 2 * (1 + rho), d1 = a1 + D, b1 = d1 + T - aA, d2 = b1 + D, end = C - F;
      let t1 = 0, t2 = 0, tb = 0;
      for(let i = 0; i < N; i++){
        const q = S[i] - HEADR; let w1 = 0, w2 = 0, wb = 0;
        if(q >= 0 && S[i] <= s1){ w1 = sstep(0, 2 * e, q) * (1 - sstep(a1 - e, a1 + e, q)); w2 = fl(q, d2, end); wb = fl(q, d1, b1); }
        W.a[i] = w1; W.c[i] = w2; W.b[i] = wb; t1 += w1 * DS[i]; t2 += w2 * DS[i]; tb += wb * DS[i];
      }
      const k1 = al / 2 / Math.max(1, t1), k2 = al / 2 / Math.max(1, t2), kB = alB / Math.max(1, tb);   // (loop A turns al in its two halves, B al the other way: the eight turns not at all)
      for(let i = 0; i < N; i++) W.k[i] = P.dir * (k1 * W.a[i] + k2 * W.c[i] - kB * W.b[i]);
      let th = 0, x = 0, y = 0; for(let i = i0; i < i1; i++){ const t2 = th + (W.k[i] + (dX ? dX[i] : 0)) * DS[i], h = DS[i] * (hf ? hf[i] : 1); x += h * Math.cos(.5 * (th + t2)); y += h * Math.sin(.5 * (th + t2)); th = t2; }
      const fr = s1 - S[i1]; return [x + fr * Math.cos(th), y + fr * Math.sin(th)];
    };
    const lim = u => ({D:Math.min(Math.max(2 * (AMAX || 16), u.D), (C - F) * .42), rho:Math.min(.6, Math.max(-.6, u.rho)), C});
    const solve = (u, iters) => {
      for(let it = 0; it < iters; it++){
        const e0 = shape(u.D, u.rho); if(Math.hypot(e0[0], e0[1]) < .05) break;
        const dD = 2, dr = .01, eD = shape(u.D + dD, u.rho), eR = shape(u.D, u.rho + dr);
        const a11 = (eD[0] - e0[0]) / dD, a21 = (eD[1] - e0[1]) / dD, a12 = (eR[0] - e0[0]) / dr, a22 = (eR[1] - e0[1]) / dr, det = a11 * a22 - a12 * a21;
        if(Math.abs(det) < 1e-9) break;
        u = lim({D:u.D - (a22 * e0[0] - a12 * e0[1]) / det, rho:u.rho - (-a21 * e0[0] + a11 * e0[1]) / det});
      }
      const e1 = shape(u.D, u.rho); return {u, res:Math.hypot(e1[0], e1[1])};
    };
    const fresh = () => lim({D:(C - F) / (2 + al * Math.tan(phi)), rho:0});
    let r = solve(f._eightU && Math.abs((f._eightU.C || 0) - C) < 400 ? f._eightU : fresh(), X ? 4 : 5);
    if(r.res > 1) r = solve(fresh(), 14);
    f._eightU = r.u; f._ringBad = r.res > 1 || r.u.D < minD; shape(r.u.D, r.u.rho);
    for(let i = 0; i < N; i++) k[i] = W.k[i];
  },
  /* lying loose: a long, shallow S along the ground (lam its wavelength, amp the turn of each half-wave in radians) */
  wave(f, k, P, B){
    const {S, N, L, HEADR, sstep, TAU} = B;
    for(let i = 0; i < N; i++){ const s = S[i], e = sstep(HEADR, HEADR + 60, s) * (1 - .5 * sstep(L - 160, L, s)); k[i] = P.dir * P.amp * TAU / P.lam * Math.sin(TAU * (s - HEADR) / P.lam + (P.phase || 0)) * e * f.coil; }
  },
};
FILLS.ring.turns = 1; FILLS.eight.turns = 0;   // (how many times round a ring's shape turns, from the jaw angle back to it)
FILLS.ring.layered = FILLS.eight.layered = true;   // (they close with the layers on them, given X: see compose)
/* a template calls CreatureBody.require('2.0.0', name) with the version it was written against: an older engine fails loudly (see CreatureKit.require) */
const requireV = (min, who = 'a creature') => { const a = VERSION.split('.').map(Number), b = String(min).split('.').map(Number); for(let i = 0; i < 3; i++){ if((a[i] || 0) > (b[i] || 0)) return true; if((a[i] || 0) < (b[i] || 0)) throw new Error(who + ' needs creature-body.js ' + min + ' or later, and this is ' + VERSION); } return true; };
window.CreatureBody = {build, ROSTER, FILLS, VERSION, CHANGELOG, require:requireV, riseRoot:(hl, H) => hl + 36 + 1.3 * Math.sqrt(H * H + 36)};
})();
