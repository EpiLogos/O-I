/* environ-growth.js — the growth engine of the environs (ENVIRON-NOTES-GROWTH.md is its research; ENVIRON-NOTES-TREE.md, Round 4, is its build).
   Pure: no DOM, no CreatureKit; it runs under node and in the browser (window.EnvironGrowth, module.exports). The engine knows no species by name:
   a species is a data table (environ-species.js registers four) and the engine only reads the parts of it that are about growing.

   THE MODEL (cbonsai's recipe, in three dimensions and in lockstep)
   A plant is a set of TIPS. A tip has a type, a heading (azimuth phi, elevation th), a position, `life` (steps left), `age` (steps taken), spawn timers
   (`cooldown`, `cd2`, `cd3`) and its own random stream. Each TURN every live tip that is free takes one STEP, in tip-creation order:
     1. it draws its move from its type's table: a turn (azimuth change) and a pitch (elevation change), in degrees, each a distribution; and a step length;
     2. the heading is bent by TROPISMS, Runions et al. 2007 eq. 3: n~ = (n^ + g) / |n^ + g|, g the sum of vectors (up, weight, light, the plant's lean, and
        the crown's envelope as an inward or outward pull);
     3. it moves, emits a NODE (carrying its birth turn t), and loses a life;
     4. the species' SPAWN CHAIN is evaluated, every step, first match wins (cbonsai's chain): each rule is keyed on the tip's type, and on an expression of
        its life, age, cooldowns, height ..., with a chance; the rule that matches fires one alternative, which makes children (a new tip each, at an angle
        and a roll from the tip's heading) and may set the tip's timers. The terminal rules (a tip's last stretch becomes foliage-bearing tips: cbonsai's
        `dying` and `dead`) are ordinary rules on `life`.
     5. at life 0 the tip ends.
   A step's randomness is in the decisions (whether a step forks, how much life a fork gets, when a shoot is let out), not only in the parameters: that is
   what makes two ids two different plants and not one plant jittered (tools/environ-growth-test.mjs holds it). A plant also has its own habit (a species var drawn
   once from the plant's stream: how branchy this tree is) and each limb its vigour (vig, inherited and jittered), so even the shape of a limb's decisions varies.
   A rule's alternative may set a tip's timers and its life: set:{life:0} ends the tip (a limb whose end is replaced by a child that turns away: a kink).

   RANDOMNESS AND ORDER. seed = seedOf(id) (FNV-1a over the UTF-8 of the id). Every tip has its OWN random stream (mulberry32), seeded from its parent's seed
   and its index among the parent's children (the first tip from the plant's seed). A tip draws in a fixed order (turn, pitch, tropisms, step length, then
   the chain's gates and a fired rule's fields, children in order). Tips step in creation order. So the draw order is defined, and holding or feeding one tip
   never changes what any other does: the plant a tip belongs to is the same whatever the timing of its events. (When the node budget binds, which spawns are
   refused depends on step order; nothing else does.) A species table must not make structure depend on the global turn: none of its names does.

   PIPE MODEL. radii(): r^n = r1^n + r2^n over each node's continuation and its children (n = species.pipe, about 2), a tip end r = its type's `r.end`; a type's
   `r.taper` thickens a chain a little toward its base. No child is thicker than its parent where it joins.

   THE BUDGET. A plant never exceeds `budget` nodes. A spawn is refused when nodes + the life still owed to the live tips + the child's own life + 1 would pass it, so
   the tips already growing complete their lives and the plant stops spawning cleanly. plant.budget says it did (hit, hitAt, refused).

   API
     EnvironGrowth.seedOf(id)                      a stable string -> uint32
     EnvironGrowth.rng(seed)                       a seeded () -> [0,1) (the same generator the kit's K.rng is)
     EnvironGrowth.register(name, table)           add a species table to EnvironGrowth.species (a table may also be passed directly)
     EnvironGrowth.validate(speciesOrName)         [] or the table's errors (unknown names in an expression, a spawn to a type that does not exist, ...)
     EnvironGrowth.grow(species, id, opts)         run a plant to completion; returns the plant
     EnvironGrowth.create(species, id, opts)       returns a plant you drive; opts: life, mult, lean, budget, hold (a selector: tips born matching it are born held)
   plant (all positions are [x, y, z], z up, millimetres)
     .step(n = 1)        n turns (a turn in which no tip is free does not count); returns the turns taken
     .feed(sel, k)       give k steps to the HELD tips that match sel: each takes up to k steps and is held again; returns the steps granted
     .hold(sel)  .release(sel)    mark / free tips; sel is 'all', 'live', a type name, a tip id, an array of either, a function (tip) => bool or an object {type, gen, ...}
     .finish()           release every tip and run until none is alive: the end-of-life foliage rules play out; returns the plant
     .nodes   [{i, tip, type, p, parent, t, ci}]  every node, in birth order (t never decreases); parent is the chain's previous node, or for a tip's first
                                                  node the node it branches from; ci its index in its tip's chain
     .tips    [{id, type, parent, junction, gen, life, life0, age, cd:[cooldown, cd2, cd3], vig, x, y, z (its position), phi, th (its heading: azimuth and elevation, radians),
               alive, held, credit, t0, tEnd, seed, nodes:[i...]}]  every tip, in creation order (seed: its own stream's seed, the same however it was fed)
     .log     [{t, op, ...}]  the time-ordered log: 'node' (the node), 'spawn' (tip, parent, type), 'end' (tip), 'feed' / 'hold' / 'release', 'budget'
     .t       the turns taken        .done  no live tip        .live()  the live tips
     .at(n)   the structure as it stood at turn n: {n, nodes (the prefix with t <= n), tips: [{id, type, alive, nodes}]}; for a plant grown without holds
              this is exactly the plant stepped to n (tools/environ-growth-test.mjs: the prefix property)
     .branches(n)  the tips as branches: [{id, type, parent (tip id or -1), at (index in the parent's chain), pts, nodes, t0}], truncated to turn n
     .radii(n)     Float64Array of the pipe-model radius of every node of the structure at turn n (NaN for a node not yet born)
     .stats()      counts and the extent
     .digest()     uint32 over the log (positions to 1e-3, birth turns): two equal digests are the same plant
     .budget       {limit, hit, hitAt, refused, used()}

   An event-driven plant (the stage's, a later job): create(species, id, {hold:'all'}), then feed('leader', k) when a write lands, feed('root', k) on a read, and
   so on; every tip is held until fed; finish() at the run's close releases everything so the end-of-life foliage plays out. */
(() => {
'use strict';
const VERSION = '1.0.0';
const D2R = Math.PI / 180, PI = Math.PI;

/* ---------- seeds and random streams ---------- */
function seedOf(id){
  const s = String(id); let h = 0x811c9dc5;
  const eat = b => { h ^= b; h = Math.imul(h, 0x01000193); };
  for(let i = 0; i < s.length; i++){
    let c = s.charCodeAt(i);
    if(c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length){ const d = s.charCodeAt(i + 1); if(d >= 0xDC00 && d <= 0xDFFF){ c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; } }
    if(c < 0x80) eat(c);
    else if(c < 0x800){ eat(0xC0 | (c >> 6)); eat(0x80 | (c & 63)); }
    else if(c < 0x10000){ eat(0xE0 | (c >> 12)); eat(0x80 | ((c >> 6) & 63)); eat(0x80 | (c & 63)); }
    else { eat(0xF0 | (c >> 18)); eat(0x80 | ((c >> 12) & 63)); eat(0x80 | ((c >> 6) & 63)); eat(0x80 | (c & 63)); }
  }
  return h >>> 0;
}
const mix = (a, b) => { let h = (a ^ Math.imul((b + 0x9E3779B9) | 0, 0x85EBCA6B)) | 0; h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16; return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
/* a tip's stream, kept as one integer on the tip so a plant can be copied and replayed */
const draw = tip => { tip.s = (tip.s + 0x6D2B79F5) | 0; let t = Math.imul(tip.s ^ tip.s >>> 15, 1 | tip.s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* ---------- expressions: a small, safe arithmetic over a tip's names ---------- */
const FN = Object.assign(Object.create(null), {min:Math.min, max:Math.max, abs:Math.abs, sqrt:Math.sqrt, pow:Math.pow, floor:Math.floor, round:Math.round, sin:Math.sin, cos:Math.cos, exp:Math.exp, log:Math.log,
  clamp:(x, a, b) => Math.max(a, Math.min(b, x)), mix:(a, b, t) => a + (b - a) * t, smooth:(a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }});   // (no prototype: an expression cannot reach constructor)
/* the names an expression may use: the tip's own (life, life0, f the fraction of life left, u the fraction used, age, the three timers, len the arc length so far, gen, s its step,
   k its children so far, z its height, z0 its height at birth, rho its distance from the axis, th its elevation in degrees, vig its vigour: a child spec may set one,
   else it inherits its parent's, so a vigorous limb has vigorous children), the plant's (m the multiplier, L the life) and the species' vars (a var may be a
   distribution: it is drawn once, from the plant's own stream, so a plant has its own habit) */
const BASE = ['life', 'life0', 'f', 'u', 'age', 'cooldown', 'cd2', 'cd3', 'm', 'L', 'z', 'z0', 'rho', 'len', 'gen', 's', 'k', 'th', 'vig'];
const exprCache = new Map();
function compileExpr(src, extra){
  const key = src + '|' + (extra || []).join(','), hit = exprCache.get(key); if(hit) return hit;
  const names = new Set(BASE.concat(extra || [])); let out = '', i = 0;
  while(i < src.length){
    const c = src[i], rest = src.slice(i); let m;
    if(c === ' ' || c === '\t' || c === '\n'){ out += ' '; i++; continue; }
    if((m = /^(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/.exec(rest))){ out += m[1]; i += m[1].length; continue; }
    if((m = /^[A-Za-z_]\w*/.exec(rest))){ const id = m[0]; if(names.has(id)) out += 's.' + id; else if(FN[id]) out += 'F.' + id; else throw new Error('environ-growth: unknown name "' + id + '" in "' + src + '"'); i += id.length; continue; }
    const two = src.substr(i, 2);
    if(two === '<=' || two === '>=' || two === '==' || two === '!=' || two === '&&' || two === '||'){ out += two; i += 2; continue; }
    if('+-*/%<>!?:(),'.includes(c)){ out += c; i++; continue; }
    throw new Error('environ-growth: unexpected "' + c + '" in "' + src + '"');
  }
  const fn = new Function('s', 'F', 'return +(' + out + ')'), f = s => fn(s, FN); exprCache.set(key, f); return f;
}
/* a value spec: a number; an expression string; [lo, hi] uniform; {u:[lo,hi]}; {n:[mean, sd], min, max} normal (two draws); {tri:[lo, mode, hi]};
   {w:[[value, weight], ...]} a weighted table (one draw); {bern:p} 1 with chance p, else 0. Any bound may itself be an expression. (s, d) -> number; d draws a uniform. */
function compileVal(spec, extra, where){
  const E = x => typeof x === 'number' ? (() => x) : compileExpr(String(x), extra), bad = () => { throw new Error('environ-growth: bad value in ' + where + ': ' + JSON.stringify(spec)); };
  let f;
  if(typeof spec === 'number'){ f = () => spec; f.k = spec; return f; }
  if(typeof spec === 'string'){ const e = compileExpr(spec, extra); f = s => e(s); return f; }
  if(Array.isArray(spec) && spec.length === 2) spec = {u:spec};
  if(!spec || typeof spec !== 'object') bad();
  if(spec.u){ const a = E(spec.u[0]), b = E(spec.u[1]); f = (s, d) => { const lo = a(s), hi = b(s); return lo + (hi - lo) * d(); }; }
  else if(spec.n){ const mu = E(spec.n[0]), sd = E(spec.n[1]), lo = spec.min != null ? E(spec.min) : null, hi = spec.max != null ? E(spec.max) : null;
    f = (s, d) => { const u1 = Math.max(1e-12, d()), u2 = d(); let v = mu(s) + sd(s) * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * PI * u2); if(lo) v = Math.max(lo(s), v); if(hi) v = Math.min(hi(s), v); return v; }; }
  else if(spec.tri){ const a = E(spec.tri[0]), c = E(spec.tri[1]), b = E(spec.tri[2]); f = (s, d) => { const lo = a(s), md = c(s), hi = b(s), r = d(), F = (md - lo) / ((hi - lo) || 1); return r < F ? lo + Math.sqrt(r * (hi - lo) * (md - lo)) : hi - Math.sqrt((1 - r) * (hi - lo) * (hi - md)); }; }
  else if(spec.w){ const vals = spec.w.map(p => E(p[0])), ws = spec.w.map(p => p[1]), tot = ws.reduce((a, b) => a + b, 0); f = (s, d) => { let r = d() * tot, i = 0; while(i < ws.length - 1 && r >= ws[i]){ r -= ws[i]; i++; } return vals[i](s); }; }
  else if(spec.bern != null){ const p = E(spec.bern); f = (s, d) => d() < p(s) ? 1 : 0; }
  else bad();
  return f;
}
const isConst = f => f.k !== undefined;
const gateOf = (when, extra, where) => { if(when == null) return null; const e = compileExpr(String(when), extra); return s => { const v = e(s); return v === v && v !== 0; }; };
/* a chance: a number or an expression; a draw is taken only when it is neither 0 nor 1 */
const chanceOf = (c, extra) => { if(c == null || c === 1) return null; const e = typeof c === 'number' ? (() => c) : compileExpr(String(c), extra); return typeof c === 'number' ? {k:c, f:e} : {f:e}; };
const passes = (ch, s, tip) => { if(!ch) return true; const p = ch.f(s); if(ch.k !== undefined && ch.k >= 1) return true; if(p >= 1) return true; if(!(p > 0)) return false; return draw(tip) < p; };

/* ---------- a species table, compiled ---------- */
const COMPILED = new WeakMap(), REGISTRY = {};
function compile(sp){
  if(COMPILED.has(sp)) return COMPILED.get(sp);
  const extra = Object.keys(sp.vars || {}), C = {sp, extra, types:{}, typeList:[], rules:[], vars:{}};
  const names = Object.keys(sp.types || {}); if(!names.length) throw new Error('environ-growth: a species needs types');
  names.forEach((name, idx) => {
    const t = sp.types[name], where = 'type ' + name;
    const T = {name, idx, kind:t.kind || name, order:t.order ?? 1, branch:t.branch !== false, leanK:t.lean ?? 0, env:t.env !== false, grounded:t.ground !== false,
      step:compileVal(t.step ?? 20, extra, where + '.step'), turn:compileVal(t.turn ?? 0, extra, where + '.turn'), pitch:compileVal(t.pitch ?? 0, extra, where + '.pitch'),
      rEnd:t.r && t.r.end != null ? t.r.end : 3.4, taper:t.r && t.r.taper || 0, tropism:[], def:t};
    for(const tr of t.tropism || []){ const v = tr.dir || [0, 0, 1], l = Math.hypot(v[0], v[1], v[2]) || 1; T.tropism.push({dx:v[0] / l, dy:v[1] / l, dz:v[2] / l, k:compileVal(tr.k, extra, where + '.tropism')}); }
    C.types[name] = T; C.typeList.push(T);
  });
  const child = (cs, where) => {
    if(!C.types[cs.type]) throw new Error('environ-growth: ' + where + ' spawns a type that does not exist: ' + cs.type);
    const r = cs.roll, roll = r == null ? {mode:'val', v:compileVal(0, extra, where)} : (typeof r === 'number' || typeof r === 'string' || Array.isArray(r) || r.u || r.n || r.w || r.tri) ? {mode:'val', v:compileVal(r, extra, where + '.roll')} :
      {mode:r.phyllo != null ? 'phyllo' : r.alt != null ? 'alt' : 'val', deg:r.phyllo ?? r.alt ?? 0, whorl:!!r.whorl, jit:compileVal(r.jit ?? 0, extra, where + '.roll.jit'), v:r.v != null ? compileVal(r.v, extra, where + '.roll.v') : null};
    return {type:cs.type, T:C.types[cs.type], life:compileVal(cs.life, extra, where + '.life'), angle:compileVal(cs.angle ?? 0, extra, where + '.angle'), roll, n:cs.n != null ? compileVal(cs.n, extra, where + '.n') : null,
      vig:cs.vig != null ? compileVal(cs.vig, extra, where + '.vig') : null, cooldown:cs.cooldown != null ? compileVal(cs.cooldown, extra, where + '.cooldown') : null, cd2:cs.cd2 != null ? compileVal(cs.cd2, extra, where + '.cd2') : null, cd3:cs.cd3 != null ? compileVal(cs.cd3, extra, where + '.cd3') : null};
  };
  (sp.spawn || []).forEach((rule, ri) => {
    const where = 'spawn[' + ri + ']' + (rule.id ? ' ' + rule.id : ''), on = rule.on == null || rule.on === '*' ? null : new Set([].concat(rule.on));
    if(on) for(const n of on) if(!C.types[n]) throw new Error('environ-growth: ' + where + ' is on a type that does not exist: ' + n);
    const alt = (a, w) => ({when:gateOf(a.when, extra, w), chance:chanceOf(a.chance, extra), kids:[].concat(a.spawn || []).map((cs, i) => child(cs, w + '.spawn[' + i + ']')),
      set:Object.entries(a.set || {}).map(([k, v]) => [k, compileVal(v, extra, w + '.set.' + k)])});
    /* a rule is its gate (on, when, chance) and then its alternatives: `out`, tried in order, each with its own gate; or, with no `out`, the one alternative the rule itself carries */
    C.rules.push({id:rule.id || ('rule' + ri), on, when:gateOf(rule.when, extra, where), chance:chanceOf(rule.chance, extra),
      alts:rule.out ? rule.out.map((a, i) => alt(a, where + '.out[' + i + ']')) : [alt({spawn:rule.spawn, set:rule.set}, where)]});
  });
  const rt = sp.root || {type:names[0], life:'L'}; if(!C.types[rt.type]) throw new Error('environ-growth: the root type does not exist: ' + rt.type);
  C.root = {type:rt.type, T:C.types[rt.type], life:compileVal(rt.life ?? 'L', extra, 'root.life'), th:(rt.th ?? 90) * D2R};
  for(const [k, v] of Object.entries(sp.vars || {})) C.vars[k] = compileVal(v, ['L', 'm'].concat(extra.filter(x => x !== k)), 'vars.' + k);
  C.pipe = sp.pipe ?? 2; C.crown = sp.crown || null; C.leanSd = sp.lean && sp.lean.sd != null ? sp.lean.sd : 0;
  if(C.crown){ const prof = a => a ? a.map(p => [p[0], p[1]]) : null; C.crown = {out:prof(C.crown.out), inn:prof(C.crown.in), k:C.crown.k ?? .05}; }
  COMPILED.set(sp, C); return C;
}
const lookup = (sp) => { const t = typeof sp === 'string' ? REGISTRY[sp] : sp; if(!t) throw new Error('environ-growth: no species ' + sp); return t; };
function validate(sp){ try { compile(lookup(sp)); } catch(e){ return [e.message]; } return []; }
const prof = (a, z) => { if(!a) return null; if(z <= a[0][0]) return a[0][1]; for(let i = 1; i < a.length; i++) if(z <= a[i][0]){ const u = (z - a[i - 1][0]) / ((a[i][0] - a[i - 1][0]) || 1); return a[i - 1][1] + (a[i][1] - a[i - 1][1]) * u; } return a[a.length - 1][1]; };

/* ---------- selectors ---------- */
const matcher = sel => {
  if(sel == null || sel === 'all' || sel === true) return () => true;
  if(typeof sel === 'function') return sel;
  if(typeof sel === 'number') return t => t.id === sel;
  if(typeof sel === 'string') return sel === 'live' ? t => t.alive : t => t.type === sel;
  if(Array.isArray(sel)){ const set = new Set(sel); return t => set.has(t.id) || set.has(t.type); }
  return t => Object.keys(sel).every(k => typeof sel[k] === 'function' ? sel[k](t[k]) : t[k] === sel[k]);
};

/* ---------- the plant ---------- */
function create(species, id, opts = {}){
  const sp = lookup(species), C = compile(sp), seed = seedOf(id), main = rng(mix(seed, 0x5EED));
  const L = opts.life ?? sp.life ?? 32, m = opts.mult ?? sp.multiplier ?? 5, limit = opts.budget ?? sp.budget ?? 8000;
  /* the plant's own draws, in a fixed order: its lean (the species' own, then the owner's added to it) */
  const g = () => { const u1 = Math.max(1e-12, main()), u2 = main(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * PI * u2); };
  const leanX = (opts.lean ?? 0) + C.leanSd * g(), leanY = C.leanSd * .5 * g(), az0 = main() * 2 * PI;
  const S = {life:0, life0:1, f:1, u:0, age:0, cooldown:0, cd2:0, cd3:0, m, L, z:0, z0:0, rho:0, len:0, gen:0, s:0, k:0, th:90, vig:1};
  for(const k of Object.keys(C.vars)) S[k] = C.vars[k](S, main);   // (the plant's own variables, drawn in table order)
  let holdBorn = opts.hold == null || opts.hold === false ? null : matcher(opts.hold);
  const P = {species:sp, name:sp.name || (typeof species === 'string' ? species : 'species'), id, seed, opts:{life:L, mult:m, lean:opts.lean ?? 0, budget:limit}, lean:[leanX, leanY], t:0, nodes:[], tips:[], log:[], _live:[], _rem:0,
    budget:{limit, hit:false, hitAt:null, refused:0, used:() => P.nodes.length}};

  const node = (tip, p, parent) => { const n = {i:P.nodes.length, tip:tip.id, type:tip.type, p, parent, t:P.t, ci:tip.nodes.length}; P.nodes.push(n); tip.nodes.push(n.i); P.log.push({t:P.t, op:'node', i:n.i, tip:tip.id, p}); return n; };
  const makeTip = (T, life, phi, th, pos, parentTip, junction, seedv, vig = 1) => {
    const tip = {id:P.tips.length, type:T.name, T, parent:parentTip ? parentTip.id : -1, junction, gen:parentTip ? parentTip.gen + 1 : 0, seed:seedv, s:seedv, life, life0:Math.max(1, life), age:0, cd:[0, 0, 0], len:0, vig,
      phi, th, x:pos[0], y:pos[1], z:pos[2], z0:pos[2], kids:0, rollAcc:0, alive:true, held:false, credit:0, t0:P.t, tEnd:null, nodes:[]};
    tip.rollAcc = draw(tip) * 360;
    if(holdBorn && holdBorn(tip)) tip.held = true;
    P.tips.push(tip); P._live.push(tip); P._rem += life;
    if(parentTip) P.log.push({t:P.t, op:'spawn', tip:tip.id, parent:parentTip.id, type:T.name});
    node(tip, [pos[0], pos[1], pos[2]], junction);
    return tip;
  };
  const scope = tip => { S.life = tip.life; S.life0 = tip.life0; S.f = tip.life / tip.life0; S.u = 1 - S.f; S.age = tip.age; S.cooldown = tip.cd[0]; S.cd2 = tip.cd[1]; S.cd3 = tip.cd[2]; S.z = tip.z; S.z0 = tip.z0;
    S.rho = Math.hypot(tip.x, tip.y); S.len = tip.len; S.gen = tip.gen; S.vig = tip.vig ?? 1; S.s = tip.last || 0; S.k = tip.kids; S.th = tip.th / D2R; return S; };
  const endTip = tip => { tip.alive = false; tip.tEnd = P.t; P.log.push({t:P.t, op:'end', tip:tip.id}); };

  /* a fired alternative's children: heading from the tip's, an angle and a roll round it, its life and timers */
  const fire = (tip, alt, s, jn) => {
    const d = () => draw(tip);
    for(const cs of alt.kids){
      const n = cs.n ? Math.max(0, Math.round(cs.n(s, d))) : 1; if(!n) continue;
      let base = 0, whorl = cs.roll.mode === 'phyllo' && cs.roll.whorl && n > 1;
      if(cs.roll.mode === 'phyllo'){ tip.rollAcc += cs.roll.deg; base = tip.rollAcc; }
      for(let j = 0; j < n; j++){
        const life = Math.round(cs.life(s, d)); if(life <= 0) continue;
        if(P.nodes.length + P._rem + life + 1 > limit){ P.budget.refused++; if(!P.budget.hit){ P.budget.hit = true; P.budget.hitAt = P.t; P.log.push({t:P.t, op:'budget', nodes:P.nodes.length}); } continue; }
        const ang = cs.angle(s, d) * D2R; let rho;
        if(cs.roll.mode === 'phyllo') rho = base + (whorl ? j * 360 / n : 0) + cs.roll.jit(s, d);
        else if(cs.roll.mode === 'alt'){ tip.alt = (tip.alt || 0) + 1; rho = (tip.alt & 1 ? cs.roll.deg : -cs.roll.deg) + cs.roll.jit(s, d); }
        else rho = cs.roll.v(s, d);
        rho *= D2R;
        const ct = Math.cos(tip.th), st = Math.sin(tip.th), cp = Math.cos(tip.phi), sp2 = Math.sin(tip.phi);
        const H = [ct * cp, ct * sp2, st], E1 = [-st * cp, -st * sp2, ct], E2 = [-sp2, cp, 0], ca = Math.cos(ang), sa = Math.sin(ang), cr = Math.cos(rho), sr = Math.sin(rho);
        const dx = H[0] * ca + (E1[0] * cr + E2[0] * sr) * sa, dy = H[1] * ca + (E1[1] * cr + E2[1] * sr) * sa, dz = H[2] * ca + (E1[2] * cr + E2[2] * sr) * sa;
        const th = Math.asin(Math.max(-1, Math.min(1, dz))), hz = Math.hypot(dx, dy), phi = hz > 1e-6 ? Math.atan2(dy, dx) : tip.phi;
        const vg = cs.vig ? Math.max(.05, cs.vig(s, d)) : tip.vig, c = makeTip(cs.T, life, phi, th, [tip.x, tip.y, tip.z], tip, jn, mix(tip.seed, tip.kids + 1), vg);
        tip.kids++;
        if(cs.cooldown) c.cd[0] = Math.max(0, Math.round(cs.cooldown(s, d))); if(cs.cd2) c.cd[1] = Math.max(0, Math.round(cs.cd2(s, d))); if(cs.cd3) c.cd[2] = Math.max(0, Math.round(cs.cd3(s, d)));
      }
    }
    for(const [k, v] of alt.set){ const val = Math.max(0, Math.round(v(s, d))); if(k === 'cooldown') tip.cd[0] = val; else if(k === 'cd2') tip.cd[1] = val; else if(k === 'cd3') tip.cd[2] = val;
      else if(k === 'life'){ const was = tip.life; tip.life = Math.min(was, val); P._rem -= was - tip.life; } }   // set:{life:0} ends the tip (a limb whose end is replaced by a child: a sympodial kink)
  };

  const stepTip = tip => {
    const T = tip.T, d = () => draw(tip);
    tip.life--; tip.age++; P._rem--;
    const s = scope(tip);   // (life and age are those of this step: the chain below sees the same)
    let phi = tip.phi + T.turn(s, d) * D2R, th = tip.th + T.pitch(s, d) * D2R;
    if(th > PI / 2){ th = PI - th; phi += PI; } if(th < -1.3) th = -1.3;
    let hx = Math.cos(th) * Math.cos(phi), hy = Math.cos(th) * Math.sin(phi), hz = Math.sin(th);
    for(const tr of T.tropism){ const k = tr.k(s, d); if(k){ hx += tr.dx * k; hy += tr.dy * k; hz += tr.dz * k; } }
    if(T.leanK){ hx += P.lean[0] * T.leanK * .03; hy += P.lean[1] * T.leanK * .03; }
    if(T.env && C.crown){
      const rho = Math.hypot(tip.x, tip.y), out = prof(C.crown.out, tip.z), inn = prof(C.crown.inn, tip.z);
      if(out && rho > out){ const e = (rho / out - 1) * C.crown.k, ux = tip.x / (rho || 1), uy = tip.y / (rho || 1); hx -= ux * e; hy -= uy * e; }
      else if(inn && rho < inn){ const e = (1 - rho / Math.max(1, inn)) * C.crown.k, ux = rho > 1 ? tip.x / rho : Math.cos(tip.phi), uy = rho > 1 ? tip.y / rho : Math.sin(tip.phi); hx += ux * e; hy += uy * e; }
    }
    let hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
    th = Math.asin(Math.max(-1, Math.min(1, hz))); if(Math.hypot(hx, hy) > 1e-6) phi = Math.atan2(hy, hx);
    s.s = T.step(s, d); const len = Math.max(.5, s.s);
    let nx = tip.x + hx * len, ny = tip.y + hy * len, nz = tip.z + hz * len;
    if(T.grounded && nz < 25){ nz = 25; th = Math.max(th, 6 * D2R); }
    tip.phi = phi; tip.th = th; tip.x = nx; tip.y = ny; tip.z = nz; tip.len += len; tip.last = len;
    for(let q = 0; q < 3; q++) if(tip.cd[q] > 0) tip.cd[q]--;
    const jn = node(tip, [nx, ny, nz], tip.nodes[tip.nodes.length - 1]).i;
    /* the chain: the first rule whose gate passes fires, and the chain stops there */
    scope(tip);
    for(const rule of C.rules){
      if(rule.on && !rule.on.has(tip.type)) continue;
      if(rule.when && !rule.when(S)) continue;
      if(!passes(rule.chance, S, tip)) continue;
      for(const alt of rule.alts){ if(alt.when && !alt.when(S)) continue; if(!passes(alt.chance, S, tip)) continue; fire(tip, alt, S, jn); break; }
      break;
    }
    if(tip.life <= 0) endTip(tip);
  };

  P.step = (n = 1) => {
    let taken = 0;
    for(let q = 0; q < n; q++){
      const live = P._live; if(!live.some(t => t.alive && (!t.held || t.credit > 0))) break;
      P.t++; taken++; const n0 = live.length;
      for(let i = 0; i < n0; i++){ const tip = live[i]; if(!tip.alive) continue; if(tip.held){ if(tip.credit <= 0) continue; tip.credit--; } stepTip(tip); }
      let w = 0; for(let i = 0; i < live.length; i++) if(live[i].alive) live[w++] = live[i]; live.length = w;
    }
    return taken;
  };
  P.feed = (sel, k) => { const mt = matcher(sel); let granted = 0; for(const tip of P._live) if(tip.alive && tip.held && mt(tip)){ const g = Math.min(Math.max(0, Math.round(k)), tip.life - tip.credit); if(g > 0){ tip.credit += g; granted += g; } } if(granted) P.log.push({t:P.t, op:'feed', sel:typeof sel === 'function' ? 'fn' : sel, k, granted}); return granted; };
  P.hold = sel => { const mt = matcher(sel); let c = 0; for(const tip of P._live) if(tip.alive && !tip.held && mt(tip)){ tip.held = true; c++; } if(c) P.log.push({t:P.t, op:'hold', sel:typeof sel === 'function' ? 'fn' : sel, n:c}); return c; };
  P.release = sel => { const mt = matcher(sel); let c = 0; for(const tip of P._live) if(tip.alive && tip.held && mt(tip)){ tip.held = false; tip.credit = 0; c++; } if(c) P.log.push({t:P.t, op:'release', sel:typeof sel === 'function' ? 'fn' : sel, n:c}); return c; };
  P.finish = () => { P.release('all'); if(holdBorn) holdBorn = null; let guard = 0; while(P._live.length && guard++ < 5000) P.step(1); return P; };
  P.live = () => P._live.filter(t => t.alive);
  Object.defineProperty(P, 'done', {get:() => !P._live.some(t => t.alive)});

  /* the structure as it stood at turn n: nodes are in birth order, so it is a prefix */
  const upto = n => { let lo = 0, hi = P.nodes.length; while(lo < hi){ const mid = (lo + hi) >> 1; if(P.nodes[mid].t <= n) lo = mid + 1; else hi = mid; } return lo; };
  P.at = (n = P.t) => { const c = upto(n), tips = [];
    for(const tip of P.tips){ if(tip.t0 > n) break; let k = tip.nodes.length; while(k > 0 && tip.nodes[k - 1] >= c) k--; tips.push({id:tip.id, type:tip.type, parent:tip.parent, alive:tip.tEnd == null || tip.tEnd > n, nodes:tip.nodes.slice(0, k)}); }
    return {n, nodes:P.nodes.slice(0, c), count:c, tips}; };
  P.branches = (n = P.t) => { const c = upto(n), out = [];
    for(const tip of P.tips){ if(tip.t0 > n) break; const idx = tip.nodes.filter(i => i < c); if(!idx.length) continue;
      out.push({id:tip.id, type:tip.type, parent:tip.parent, at:tip.junction >= 0 ? P.nodes[tip.junction].ci : 0, pts:idx.map(i => P.nodes[i].p), nodes:idx, t0:tip.t0, tEnd:tip.tEnd}); }
    return out; };
  P.radii = (n = P.t) => {
    const c = upto(n), r = new Float64Array(P.nodes.length).fill(NaN), A = new Float64Array(c), e = C.pipe, has = new Uint8Array(c);
    for(let i = c - 1; i >= 0; i--){
      const nd = P.nodes[i], T = C.types[nd.type];
      if(!has[i]) A[i] += Math.pow(T.rEnd, e);   // a node nothing grows from: a tip's end
      r[i] = Math.pow(A[i], 1 / e);
      if(nd.parent >= 0 && nd.parent < c){
        const pn = P.nodes[nd.parent], sameChain = pn.tip === nd.tip;
        A[nd.parent] += sameChain ? Math.pow(r[i] * (1 + T.taper), e) : Math.pow(r[i], e); has[nd.parent] = 1;
      }
    }
    return r;
  };
  P.stats = () => {
    const by = {}; for(const t of P.tips) by[t.type] = (by[t.type] || 0) + 1;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z1 = -1e9, len = 0; for(const nd of P.nodes){ const p = nd.p; if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0]; if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1]; if(p[2] > z1) z1 = p[2]; }
    for(const t of P.tips) len += t.len;
    return {nodes:P.nodes.length, tips:P.tips.length, byType:by, turns:P.t, height:z1, width:x1 - x0, depth:y1 - y0, wood:len, budget:{limit, hit:P.budget.hit, hitAt:P.budget.hitAt, refused:P.budget.refused}, lean:P.lean.slice()};
  };
  P.digest = () => { let h = 0x811c9dc5; const eat = v => { h = Math.imul(h ^ (v | 0), 0x01000193) >>> 0; };
    for(const nd of P.nodes){ eat(nd.t); eat(nd.tip); eat(Math.round(nd.p[0] * 1e3)); eat(Math.round(nd.p[1] * 1e3)); eat(Math.round(nd.p[2] * 1e3)); } return h >>> 0; };

  /* the root: the first tip, upright */
  const rt = C.root, rs = scope({life:0, life0:1, age:0, cd:[0, 0, 0], z:0, z0:0, x:0, y:0, th:rt.th, len:0, gen:0, kids:0}), rootLife = Math.round(rt.life(rs, () => .5));
  makeTip(rt.T, rootLife, az0, rt.th, [0, 0, 0], null, -1, mix(seed, 1));
  return P;
}
const grow = (species, id, opts) => create(species, id, opts).finish();
const register = (name, table) => { REGISTRY[name] = table; if(!table.name) table.name = name; return table; };

const API = {VERSION, seedOf, rng, register, species:REGISTRY, validate, create, grow, compile};
if(typeof window !== 'undefined') window.EnvironGrowth = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
})();
