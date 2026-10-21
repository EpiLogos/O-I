/* environ-kit.js — the environs of the agency SDK, beside creature-kit.js. CREATURE-SPEC.md Part II is the standard (sections 24 and 25; read them
   first). A creature shows an agent's act; an environ shows a process's course, read in time. This file holds three things:

   1. HABITATS: each habitat a creature comes with, its zones (each with its role), each zone's state for each of the eight run states, and the run
      events that change it; a built one names its page. STAGES: a recorded run played as a creature in its habitat, each with its page. (The creatures
      library lists both in its Environs tab.) SIGNATURES: the temporal signatures (annual, perennial, vine, river, lake, erosion, seasons, succession).
      PHENOLOGY: an environ's year as data (the organs, the phases, the apple's BBCH profile, at/open/validate), so a figure can grow by object change; the family
      of trees shares the one profile, with a species flag (evergreen) where it reads differently.
   2. The run, from O-I's own events (spec 25.1), kept as three things apart: the events (what happened, never changed), the state (what holds now,
      derived), and the trajectory (the run's states over time, kept). EnvironKit.run() makes one; run.apply(event) takes an event; run.signals(now)
      gives the four glance signals (where the creature is, its posture, the products and their ripeness, breath); run.zones(now) the environ's
      zone states. Pure: no DOM, testable under node (tools/environ-test.mjs).
   3. The view every environ shares with the continuous body (PITCH, GY, GZ). Each environ is its own file on creature-kit.js, built to the creature
      standard (a research note, a generated anatomy, a page, a gate): the first is the apple tree, environ-tree.js (ENVIRON-NOTES-TREE.md).

   Exports window.EnvironKit (module.exports under node). */
(() => {
'use strict';
const VERSION = '1.3.0';
const CHANGELOG = [{date:'2026-10-20', version:'1.3.0', what:'PHENOLOGY.at(profile, year, {evergreen}): an evergreen species keeps its leaves (leafFall is 0 all year), so the family of trees shares the one year table rather than four. The tree is a family on the growth engine (environ-growth.js, environ-species.js; environ-tree.js 1.2.0); its habitat entry says so.'},
  {date:'2026-10-19', version:'1.2.0', what:'PHENOLOGY: an environ\'s year as data. Nine organs (seed, root, trunk, girth, limb, shoot, leaf, blossom, fruit), twelve phases, the apple profile with BBCH pome-fruit codes (Meier 2001) and a normalized year table, at() / open() / validate(). The table and its invariants are held by tools/environ-test.mjs. First use: the apple tree grows by it (environ-tree.js 1.1.0).'},
  {date:'2026-10-19', version:'1.1.0', what:'A built habitat names its page, and STAGES lists the stages (a recorded run played as a creature in its habitat), so the creatures library lists them beside the creatures. The tree\'s fruit states read as the tree draws them.'},
  {date:'2026-10-19', version:'1.0.0', what:'First: habitats and zones, the run reducer from O-I events, the tree on the kit.'}];
const RUN_STATES = ['queued', 'thinking', 'acting', 'waiting', 'stalled', 'producing', 'done', 'failed'];
const ACTIVE = new Set(['thinking', 'acting', 'producing']);   // states in which a missing check-in is a stall (a waiting agent still checks in)

/* ---------- temporal signatures (spec 24) ---------- */
const SIGNATURES = {
  annual:{nature:'seed to fruit to seed in one season, then dies', process:'runs once to an end: one task'},
  perennial:{nature:'fruits every season and adds a ring each year', process:'stands and runs again: a standing agent, its age readable in its rings'},
  vine:{nature:'climbs another plant\'s structure', process:'grows on a host process'},
  river:{nature:'flows without end; its state is its flow', process:'a stream with no done: a feed, a gateway'},
  lake:{nature:'fills from its inflows and drains', process:'a store whose level is its backlog: a queue'},
  erosion:{nature:'slow wear by repeated passage', process:'the effect of many runs on the ground: drift, worn paths'},
  seasons:{nature:'the year\'s cycle', process:'a field\'s cycle: a NOW clearing active, quiescent, closed, archived'},
  succession:{nature:'one community replaces another', process:'one lane after another on the same ground'},
};
/* a NOW clearing's lifecycle is the habitat's season */
const SEASONS = {active:'in growth', quiescent:'dormant', closed:'harvested', archived:'in the record'};

/* ---------- phenology: an environ's year as data (spec 24) ----------
   Nine organs a plant grows by, twelve phases, and a profile's normalized year table. Every organ weight, the leaf-fall and fruit-drop
   fractions run 0..1 and interpolate by smoothstep between rows, so an environ grows a figure by object change rather than by colour. A
   profile row is [year, phase, bbch, ...organs, leafFall, fruitDrop]; the phase windows are the first row of each phase to the next
   phase's first row. The apple's codes are the pome-fruit BBCH scale's (Meier 2001); the stage boundaries inside a principal stage are the
   design choice. The table and the invariants the stage relies on are verified in tools/environ-test.mjs. */
const PH_ORGANS = ['seed', 'root', 'trunk', 'girth', 'limb', 'shoot', 'leaf', 'blossom', 'fruit'];
const PH_PHASES = ['germination', 'rootGrowth', 'budBreak', 'leafOut', 'flowering', 'fruitSet', 'canopy', 'ripening', 'harvest', 'senescence', 'leafFall', 'dormant'];
const PH_APPLE = {
  name:'Apple (Malus domestica)', bbch:'pome fruit, Meier 2001',
  /* the year from which each organ is part of the tree (a return can only set fruit after fruitSet, at .42) */
  opens:{seed:0, root:.02, trunk:.04, girth:.04, limb:.06, shoot:.10, leaf:.08, blossom:.18, fruit:.42},
  monotone:['root', 'trunk', 'girth', 'limb', 'shoot', 'leaf'],
  checks:[['girth', .42, .84], ['trunk', .58, .995], ['limb', .68, .70], ['limb', .90, .97], ['leafFall', .95, .50], ['leafFall', 1, 1], ['fruit', .90, .999]],
  continuity:.05,
  year:[
    // year, phase, BBCH, seed, root, trunk, girth, limb, shoot, leaf, blossom, fruit, leafFall, fruitDrop
    [0.00, 'germination', 0,  1.00, .00, .00, .00, .00, .00, .00, .00, .00, 0, 0],
    [0.04, 'germination', 9,  .90, .05, .01, .08, .00, .00, .00, .00, .00, 0, 0],
    [0.10, 'rootGrowth', 10,  .30, .14, .06, .16, .01, .00, .02, .00, .00, 0, 0],
    [0.18, 'budBreak',   51,  .00, .24, .16, .30, .04, .01, .08, .00, .00, 0, 0],
    [0.26, 'leafOut',    57,  .00, .32, .30, .46, .10, .05, .24, .35, .00, 0, 0],
    [0.34, 'flowering',  65,  .00, .40, .52, .62, .20, .12, .46, 1.00, .00, 0, 0],
    [0.42, 'fruitSet',   69,  .00, .46, .82, .88, .32, .20, .66, .10, .04, 0, 0],
    [0.50, 'fruitSet',   71,  .00, .51, .96, .92, .44, .29, .80, .00, .08, 0, 0],
    [0.58, 'canopy',     75,  .00, .56, 1.00, .96, .58, .42, .92, .00, .30, 0, 0],
    [0.68, 'canopy',     79,  .00, .62, 1.00, 1.00, .74, .60, 1.00, .00, .54, 0, 0],
    [0.78, 'ripening',   85,  .00, .68, 1.00, 1.00, .87, .79, 1.00, .00, .78, 0, 0],
    [0.86, 'harvest',    87,  .00, .72, 1.00, 1.00, .94, .92, 1.00, .00, .95, 0, 0],
    [0.90, 'harvest',    89,  .00, .74, 1.00, 1.00, .98, .99, 1.00, .00, 1.00, .02, 0],
    [0.92, 'senescence', 92,  .00, .76, 1.00, 1.00, 1.00, 1.00, 1.00, .00, 1.00, .10, .02],
    [0.95, 'leafFall',   95,  .00, .78, 1.00, 1.00, 1.00, 1.00, 1.00, .00, .96, .50, .08],
    [0.97, 'leafFall',   97,  .00, .80, 1.00, 1.00, 1.00, 1.00, 1.00, .00, .90, .95, .15],
    [1.00, 'dormant',    99,  .00, .82, 1.00, 1.00, 1.00, 1.00, 1.00, .00, .82, 1.00, .25],
  ],
};
const PH_PROFILES = {apple:PH_APPLE};
const phProf = p => typeof p === 'string' ? PH_PROFILES[p] : p;
const phSmooth = u => u * u * (3 - 2 * u);
const phPrep = prof => {
  if(prof._win) return prof._win;
  const w = [];
  prof.year.forEach((r, i) => { if(!i || r[1] !== prof.year[i - 1][1]) w.push([r[0], r[1], r[2]]); });
  prof._win = w; return w;
};
/* the season at a point in the year: each organ's weight, the phase and its BBCH code, the fraction of leaves fallen and fruit dropped */
function phAt(p, year, o){
  const prof = phProf(p); if(!prof) throw new Error('environ-kit: no phenology profile ' + p);
  const y = Math.max(0, Math.min(1, +year || 0)), R = prof.year;
  let i = 0; while(i < R.length - 2 && R[i + 1][0] < y) i++;
  const a = R[i], b = R[i + 1], u = phSmooth((y - a[0]) / ((b[0] - a[0]) || 1)), lerp = k => a[k] + (b[k] - a[k]) * u;
  const w = {}; PH_ORGANS.forEach((o, k) => { w[o] = lerp(3 + k); });
  let phase = prof.year[0][1]; for(const q of phPrep(prof)) if(q[0] <= y + 1e-9) phase = q[1];
  /* a species flag, not another table: an evergreen keeps its leaves through the year (no leaf fall) */
  return {year:y, phase, bbch:lerp(2), w, leafFall:o && o.evergreen ? 0 : lerp(12), fruitDrop:lerp(13)};
}
/* is this organ part of the tree yet (a return can only set fruit after fruitSet) */
function phOpen(p, organ, year){ const prof = phProf(p), open = prof && prof.opens ? prof.opens[organ] : null; return open != null && +year >= open - 1e-9; }
/* the table's own laws (ordering, ranges, monotonicity, the seed, blossom and fruit arcs, opens vs the table, the stage's invariants, continuity) */
function phValidate(p){
  const prof = phProf(p), E = [], bad = m => E.push(m);
  if(!prof || !Array.isArray(prof.year) || prof.year.length < 2) return ['no year table'];
  const R = prof.year, N = 3 + PH_ORGANS.length + 2, col = o => 3 + PH_ORGANS.indexOf(o), bb = R.findIndex(r => r[1] === 'budBreak');
  if(R[0][0] !== 0 || R[R.length - 1][0] !== 1) bad('the year must run 0..1');
  for(let i = 0; i < R.length; i++){
    const r = R[i];
    if(r.length !== N) bad('row ' + i + ' has ' + r.length + ' columns, not ' + N);
    if(i && !(r[0] > R[i - 1][0])) bad('year not increasing at row ' + i);
    if(i && r[2] < R[i - 1][2]) bad('BBCH went down at row ' + i);
    if(!PH_PHASES.includes(r[1])) bad('row ' + i + ': unknown phase ' + r[1]);
    if(r[2] < 0 || r[2] > 99) bad('row ' + i + ': BBCH out of range');
    for(let k = 3; k < r.length; k++) if(!(r[k] >= 0 && r[k] <= 1)) bad('row ' + i + ': value out of 0..1 at column ' + k);
  }
  for(const o of prof.monotone || []){ const k = col(o); for(let i = 1; i < R.length; i++) if(R[i][k] < R[i - 1][k] - 1e-9) bad(o + ' went down at row ' + i); }
  for(let i = 1; i < R.length; i++){ if(R[i][12] < R[i - 1][12] - 1e-9) bad('leafFall went down at row ' + i); if(R[i][13] < R[i - 1][13] - 1e-9) bad('fruitDrop went down at row ' + i); }
  if(R[0][col('seed')] !== 1) bad('the year does not begin from a seed');
  for(let i = 1; i < R.length; i++) if(R[i][col('seed')] > R[i - 1][col('seed')] + 1e-9) bad('the seed grew at row ' + i);
  if(bb >= 0 && R[bb][col('seed')] !== 0) bad('the seed is still there at bud break');
  const bl = R.map(r => r[col('blossom')]), bmax = Math.max(...bl), bpeak = bl.indexOf(bmax);
  if(bmax < .999) bad('blossom never reaches 1');
  if(bl[0] !== 0 || bl[bl.length - 1] !== 0) bad('blossom is not zero at the ends');
  for(let i = 1; i <= bpeak; i++) if(bl[i] < bl[i - 1] - 1e-9) bad('blossom fell before its peak at row ' + i);
  for(let i = bpeak + 1; i < bl.length; i++) if(bl[i] > bl[i - 1] + 1e-9) bad('blossom rose after its peak at row ' + i);
  const fr = R.map(r => r[col('fruit')]), ffirst = fr.findIndex(v => v > 0), ripe = R.findIndex(r => r[2] === 89);
  if(ffirst <= 0 || fr[ffirst - 1] !== 0) bad('fruit did not start from zero');
  if(ripe < 0 || fr[ripe] < .999) bad('fruit is not full at harvest (BBCH 89)');
  if(ripe >= 0){
    for(let i = ffirst; i < ripe; i++) if(fr[i + 1] < fr[i] - 1e-9) bad('fruit dipped before harvest at row ' + i);
    for(let i = ripe; i < fr.length - 1; i++) if(fr[i + 1] > fr[i] + 1e-9) bad('fruit rose after harvest at row ' + i);
  }
  for(const o of PH_ORGANS){ const open = prof.opens && prof.opens[o]; if(open == null) continue; const first = R.findIndex(r => r[col(o)] > 1e-9); if(first >= 0 && R[first][0] < open - 1e-9) bad(o + ' opens before its ' + open + ' year'); }
  for(const [o, y, min] of prof.checks || []){ const q = phAt(prof, y), v = o === 'leafFall' || o === 'fruitDrop' ? q[o] : q.w[o]; if(!(v >= min - 1e-6)) bad(o + ' at ' + y + ' is ' + (v == null ? 'missing' : v.toFixed(3)) + ', under ' + min); }
  let worst = 0, worstAt = 0, who = '';
  for(let y = 0; y < 1; y += .002){ const a = phAt(prof, y), b = phAt(prof, y + .002); for(const o of PH_ORGANS){ const d = Math.abs(a.w[o] - b.w[o]); if(d > worst){ worst = d; worstAt = y; who = o; } } }
  if(worst > (prof.continuity ?? .05)) bad(who + ' jumps ' + worst.toFixed(3) + ' in .002 of year at ' + worstAt.toFixed(3));
  return E;
}
const PHENOLOGY = {organs:PH_ORGANS, phases:PH_PHASES, PROFILES:PH_PROFILES, at:phAt, open:phOpen, validate:phValidate};

/* ---------- habitats and their zones (spec 24); each zone's state by run state, and the events that change it ---------- */
const Z = (role, states, events, o = {}) => ({role, states, events, ...o});
const HABITATS = {
  tree:{name:'Tree', signature:'perennial', page:'environ-tree.html', built:'a family of species (apple, oak, pine, bonsai) on one growth engine, each tree generated from its species table and an id and growing through its year (PHENOLOGY): ENVIRON-NOTES-TREE.md, ENVIRON-NOTES-GROWTH.md', figures:['serpent', 'eagle (crown)', 'dragon (roots, the hoard)', 'squirrel'],
    zones:{
      roots:Z('gather the sources', {queued:'dark', thinking:'drawing', acting:'rest', waiting:'rest', stalled:'grey', producing:'rest', done:'rest', failed:'flush'},
        ['thought', 'knowledge'], {reach:'Read', phase:'start'}),
      trunk:Z('make', {queued:'rest', thinking:'rest', acting:'growing', waiting:'held', stalled:'grey', producing:'grown', done:'grown', failed:'flush'},
        ['generation', 'curation', 'member'], {reach:'Draft, Write', phase:'sustain'}),
      crown:Z('deliver', {queued:'rest', thinking:'rest', acting:'rest', waiting:'held', stalled:'grey', producing:'in leaf', done:'dim', failed:'dim'},
        ['return'], {reach:'Write (the return)', phase:'hand over'}),
      fruit:Z('the products', {set:'a small pale green fruitlet', ripening:'yellow, swelling while its checks run', ripe:'full and red', harvested:'gold, landed', fallen:'umber, on the ground'},
        ['return', 'check', 'ledger']),
      ground:Z('the record', {keeps:'paths worn, skins shed, fruit fallen: never erased, only dimmed'}, ['run', 'shed', 'ledger']),
    }},
  water:{name:'Water', signature:'river', figures:['fishes', 'water-bearer (the urn pours the river)', 'dolphin', 'dragonfly', 'pelican', 'octopus'],
    zones:{spring:Z('the source', {}, ['knowledge']), current:Z('the flow', {}, ['generation']), pool:Z('the store', {}, ['return']), surface:Z('the boundary', {}, ['approval']), bank:Z('the record', {}, ['run'])},
    substrate:'creature-swim.js (the fishes\' water)'},
  shore:{name:'Shore', signature:'seasons', figures:['crab'],
    zones:{burrow:Z('refuge', {}, ['now']), tideline:Z('the boundary that moves', {}, ['approval']), rockpool:Z('a held store', {}, ['return']), sand:Z('the record: prints', {}, ['run'])},
    substrate:'creature-ground.js (the crab\'s sand with prints)'},
  desert:{name:'Desert', signature:'erosion', figures:['scorpion', 'scarab', 'meerkat'],
    zones:{burrow:Z('the ambush site', {}, ['clip']), sand:Z('the record', {}, ['run']), rock:Z('the vantage', {}, ['thought'])}},
  sky:{name:'Sky and cliff', signature:'seasons', figures:['eagle', 'dove', 'starling', 'raven', 'vulture', 'bat'],
    zones:{eyrie:Z('home', {}, ['return']), perch:Z('the vantage', {}, ['thought']), thermal:Z('lift without effort', {}, ['checkin']), stoop:Z('the act', {}, ['generation'])},
    substrate:'the eagle\'s sun and flight'},
  grassland:{name:'Grassland', signature:'seasons', figures:['lion', 'horse', 'bull', 'elephant', 'archer'],
    zones:{kopje:Z('the vantage', {}, ['thought']), grass:Z('cover', {}, ['generation']), waterhole:Z('where all come', {}, ['return'])}},
  mountain:{name:'Mountain', signature:'erosion', figures:['ram', 'sea-goat (where the mountain meets the sea)'],
    zones:{ledge:Z('footing', {}, ['run']), slope:Z('the climb', {}, ['generation']), summit:Z('the view', {}, ['return'])}},
  field:{name:'Field', signature:'annual', figures:['maiden', 'bull (the plough)', 'dog', 'hoverfly'],
    zones:{furrow:Z('the sowing', {}, ['run']), grain:Z('growth', {}, ['generation']), sheaf:Z('the harvest', {}, ['return']), floor:Z('sorting', {}, ['curation', 'check'])}},
  forest:{name:'Den and forest', signature:'succession', figures:['bear', 'wolf', 'cat', 'owl', 'unicorn', 'spider', 'firefly', 'cicada', 'slime mould'],
    zones:{den:Z('dormancy', {}, ['now']), cover:Z('cover', {}, ['generation'])}},
  hive:{name:'Hive', signature:'perennial', figures:['honeybee', 'ant', 'termite'],
    zones:{comb:Z('the store', {}, ['return']), entrance:Z('the boundary', {}, ['approval']), floor:Z('recruitment', {}, ['member']), field:Z('the forage', {}, ['knowledge'])}},
};

/* ---------- the run: O-I events in, state and trajectory out ----------
   An event is {at (ms), kind, ...}. The kinds and where each comes from in O-I (spec 25.1):
     clip      {state: Queued | Waiting | Running | Recording | Stalled | Stopped | Done, error?}   a Factory task's state, a Session-view clip
     checkin   {}                                                                                the needle (each check-in moves it)
     run       {state: started | ended, error?}                                                  kernel EventKind Run
     thought   {thought_type?, subject_ref?}                                                     kernel EventKind Thought
     knowledge {subject_ref}                                                                     kernel EventKind Knowledge: a source read
     generation{subject_ref}                                                                     kernel EventKind Generation: a draft or write
     curation  {subject_ref}                                                                     kernel EventKind Curation: work on the record
     return    {subject_ref, inputs?, sources?, method?, output?}                                kernel EventKind Return: an artefact
     check     {product?, state: running | pass | fail}                                          its validation (ripening)
     ledger    {product?, outcome: Landed | Approved | Commented | Refused}                      the Ledger's outcome for it
     approval  {state: requested | answered}                                                     Approvals
     member    {state: Working | Idle | Stalled | Done, subject_ref?}                            an Agentset member (a helper spawned, finished)
     now       {state: active | quiescent | closed | archived}                                   a NOW clearing's lifecycle (EventKind Now)
     shed      {}                                                                                a renewal of the agent's own outer layer (Shed)
     error     {apiError?}                                                                       a failed call (a rate or usage limit): not a check-in
   Every event from the agent itself (thought, knowledge, generation, curation, return, check, member, shed) is also a check-in. */
const SELF = new Set(['thought', 'knowledge', 'generation', 'curation', 'return', 'check', 'member', 'shed']);
function run(o = {}){
  const R = {
    id:o.id || 'run', beat:o.beat ?? 15000, stallBeats:o.stallBeats ?? 3,
    events:[], traj:[],                                  // what happened (kept, never changed) and the states over time (kept)
    state:'queued', phase:'roots', started:false, made:0, madeSince:0, reads:0, sources:[], helpers:0, helpersLive:0, products:[], errors:0, sheds:0,
    pending:null,                                        // checks run on work not yet returned: they ripen the next product
    lastCheckIn:null, before:null, season:'active', t:0,
  };
  const set = (st, at) => { if(st === R.state) return; R.traj.push({at, from:R.state, to:st}); if(st === 'waiting') R.before = R.state; R.state = st; };
  const product = (ev, make) => { let p = ev.product ? R.products.find(q => q.id === ev.product) : null; if(!p && R.products.length) p = R.products[R.products.length - 1]; if(!p && make) p = null; return p; };
  const ripen = (p, r, at) => { if(!p || p.ripeness === 'harvested' || p.ripeness === 'fallen') return; if(p.ripeness !== r){ p.history.push({at, ripeness:r}); p.ripeness = r; } };
  R.apply = ev => {
    const at = ev.at ?? R.t; R.t = Math.max(R.t, at); R.events.push(ev);
    if(SELF.has(ev.kind) || ev.kind === 'checkin'){ R.lastCheckIn = at; if(R.state === 'stalled') set(R.restore || 'thinking', at); }
    switch(ev.kind){
      case 'clip':
        if(ev.state === 'Queued' || ev.state === 'Waiting'){ if(!R.started) set('queued', at); }
        else if(ev.state === 'Running'){ R.started = true; if(R.state === 'queued') set('thinking', at); R.lastCheckIn = at; }
        else if(ev.state === 'Recording'){ R.started = true; set('acting', at); }
        else if(ev.state === 'Stalled'){ R.restore = R.state; set('stalled', at); }
        else if(ev.state === 'Stopped'){ if(ev.error){ R.errors++; set('failed', at); } else if(!R.started) set('queued', at); }
        else if(ev.state === 'Done') set(ev.error ? 'failed' : 'done', at);
        break;
      case 'run':
        if(ev.state === 'ended') set(ev.error ? 'failed' : 'done', at); else { R.started = true; set('thinking', at); }
        break;
      case 'thought': case 'knowledge':
        R.started = true; R.reads++; if(ev.subject_ref){ R.sources.push(ev.subject_ref); if(R.sources.length > 64) R.sources.shift(); }
        if(R.state !== 'waiting' && R.state !== 'done' && R.state !== 'failed') set('thinking', at);
        break;
      case 'generation': case 'curation':
        R.started = true; R.made++; R.madeSince++; if(R.phase === 'roots') R.phase = 'trunk';
        if(R.state !== 'waiting' && R.state !== 'done' && R.state !== 'failed') set('acting', at);
        break;
      case 'return': {
        R.started = true; if(R.phase !== 'crown') R.phase = 'crown';
        const pd = R.pending, r0 = pd ? (pd.last === 'pass' ? 'ripe' : 'ripening') : 'set';
        const p = {id:ev.subject_ref || ('p' + (R.products.length + 1)), at, by:R.id, ripeness:r0, history:[{at, ripeness:r0}], blemish:pd ? pd.fail : 0, inputs:ev.inputs || null, sources:ev.sources || null, method:ev.method || null, output:ev.output || ev.summary || null};
        R.products.push(p); R.pending = null; R.madeSince = 0;   // the production relation: {by, what, at}, kept with the product after it is harvested or has fallen
        if(R.state !== 'waiting' && R.state !== 'done' && R.state !== 'failed') set('producing', at);
        break; }
      case 'check': {
        /* a check validates the last product if nothing has been made since it; otherwise the work in hand, which the next return carries */
        if(R.products.length && R.madeSince === 0){ const p = product(ev); if(ev.state === 'running') ripen(p, 'ripening', at); else if(ev.state === 'pass') ripen(p, 'ripe', at); else if(ev.state === 'fail'){ ripen(p, 'ripening', at); if(p) p.blemish = (p.blemish || 0) + 1; } }
        else { const pd = R.pending || (R.pending = {n:0, fail:0, last:null}); pd.n++; if(ev.state === 'pass' || ev.state === 'fail') pd.last = ev.state; if(ev.state === 'fail') pd.fail++; }
        break; }
      case 'ledger': { const p = product(ev); if(!p) break; const o = ev.outcome; if(o === 'Landed'){ for(const q of ev.upto ? R.products.slice(0, ev.upto) : [p]) if(q.ripeness !== 'fallen' && q.ripeness !== 'harvested'){ q.history.push({at, ripeness:'harvested'}); q.ripeness = 'harvested'; } } else if(o === 'Approved') ripen(p, 'ripe', at); else if(o === 'Refused'){ p.history.push({at, ripeness:'fallen'}); p.ripeness = 'fallen'; } else if(o === 'Commented') ripen(p, 'ripening', at); break; }
      case 'approval':
        if(ev.state === 'requested') set('waiting', at); else if(R.state === 'waiting') set(R.before && R.before !== 'waiting' ? R.before : 'thinking', at);
        break;
      case 'member':
        if(ev.state === 'Working'){ R.helpers++; R.helpersLive++; } else if(ev.state === 'Done') R.helpersLive = Math.max(0, R.helpersLive - 1);
        break;
      case 'now': if(SEASONS[ev.state]) R.season = ev.state; break;
      case 'shed': R.sheds++; break;
      case 'error': R.errors++; break;   // (an API error is not a check-in: the needle stops)
    }
    return R;
  };
  /* the state as shown at `now`: a stall is derived from the needle (no check-in for stallBeats beats while active), never stored as an event */
  R.stateAt = now => { if(R.state !== 'stalled' && ACTIVE.has(R.state) && R.lastCheckIn != null && now - R.lastCheckIn > R.stallBeats * R.beat) return 'stalled'; return R.state; };
  /* how far up the trunk: grows with what has been made, by a step that shrinks as it nears the crown, so it never arrives without a return */
  R.height = () => R.phase === 'crown' ? 1 : R.phase === 'roots' ? 0 : .9 * (1 - Math.exp(-R.made / (o.madeScale ?? 24)));
  /* the four glance signals (spec 25.2) */
  R.signals = now => {
    const st = R.stateAt(now), stalled = st === 'stalled';
    return {
      where:{phase:R.phase, height:R.height()},
      posture:st,
      products:R.products.map(p => ({id:p.id, ripeness:p.ripeness, at:p.at, blemish:p.blemish || 0})),
      breath:!stalled && (ACTIVE.has(st) || st === 'waiting') && (st === 'waiting' || (R.lastCheckIn != null && now - R.lastCheckIn <= R.stallBeats * R.beat)),
      season:R.season, helpers:R.helpers, helpersLive:R.helpersLive, reads:R.reads, made:R.made,
    };
  };
  /* the tree's zones (HABITATS.tree) from the signals */
  R.zones = (now, habitat = 'tree') => {
    const H = HABITATS[habitat], st = R.stateAt(now), out = {};
    for(const [k, z] of Object.entries(H.zones)) if(z.states && z.states[st] !== undefined) out[k] = z.states[st];
    if(habitat === 'tree'){
      /* only the zone the creature is in shows a stall, a hold or a failure; the others keep what they have */
      const at = R.phase, here = {roots:'roots', trunk:'trunk', crown:'crown'}[at];
      for(const k of ['roots', 'trunk', 'crown']) if(k !== here && ['grey', 'held', 'flush'].includes(out[k])) out[k] = k === 'roots' ? 'rest' : k === 'trunk' ? (R.made ? 'grown' : 'rest') : 'rest';
      if(R.made && out.trunk === 'rest') out.trunk = 'grown';
      if(R.products.length && out.crown === 'rest') out.crown = 'in leaf';
      out.height = R.height(); out.fruit = R.products.map(p => p.ripeness); out.source = R.sources.length ? R.sources[R.sources.length - 1] : null; out.season = R.season;
    }
    return out;
  };
  return R;
}

/* ---------- stages: a recorded run played as a creature in its habitat (spec 25). The run is a file tools/record-run.mjs made from a real session. ---------- */
const STAGES = [
  {id:'serpent-tree', name:'Serpent and tree', habitat:'tree', creature:'serpent', page:'stage-serpent-tree.html', run:'tools/runs/refinement-close-2026-10-18.json',
    what:'the serpent climbs the apple tree as a real session plays: roots while it reads, the trunk a step a write, the crown with a return; a fruit for each commit, ripening as its checks run; still in a stall, breathing only while check-ins arrive; and the tree grows its own year with the run — a rootling that flowers and fruits, leaf fall at the close, die-back where the run fails',
    recorded:'the close of the 18 October refinement session: 6.5 h, three commits, a 206-minute stall after an API error'},
];

/* ---------- the view the environs share with the continuous body (creature-body.js): seen from in front and above at PITCH, y = Y sin P - Z cos P ---------- */
const PITCH = .62, GY = Math.sin(PITCH), GZ = Math.cos(PITCH);

const API = {VERSION, CHANGELOG, RUN_STATES, SIGNATURES, SEASONS, HABITATS, STAGES, PHENOLOGY, run, PITCH, GY, GZ};
if(typeof window !== 'undefined') window.EnvironKit = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
})();
