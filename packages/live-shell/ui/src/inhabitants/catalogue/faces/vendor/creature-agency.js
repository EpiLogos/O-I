/* creature-agency.js — the agency ontology as data: CREATURE-SPEC.md Part II (sections 19-28), accepted by the owner on 19 October 2026.
   The spec is the source; this file is its machine form and `node tools/agency-check.mjs` holds the two together (every pattern's contract row,
   every roster figure's patterns and basis, the run states). Read by the library (creatures-app), the environ kit (environ-kit.js) and the stages.

   What is here:
   - FIELDS: the thread contract's eight fields and their values (spec section 21);
   - FAMILIES and PATTERNS: the 31 patterns of 15 October and Relief, each one record (spec section 22): what the thread does, its contract, its
     animals and their mechanism, how it breaks, what it asks of the system;
   - HAZARDS: failure modes, not types (22.8);
   - preset(id): a pattern as a crew preset, in the DLW's own device settings, with the fields that have no setting yet (21);
   - RUN_STATES: the eight states that drive every stage (25);
   - ELEMENTS, MODALITIES, SIGNS: the symbolic layers (26).
   Exports window.CREATURE_AGENCY (and module.exports under node). */
(() => {
'use strict';
const VERSION = '1.0.0';
const FIELDS = {
  start:{values:['Called', 'Spawned', 'Triggered', 'Timed', 'Standing'], what:'what starts it'},
  stay:{values:['Task', 'Budget', 'Condition', 'Standing'], what:'what ends it'},
  count:{values:['One', 'Pair', 'Crew', 'Swarm'], what:'how many'},
  reach:{values:['Read', 'Draft', 'Write'], what:'what it may change'},
  link:{values:['None', 'Parent', 'Peer', 'Place', 'Many'], what:'whom it answers to'},
  join:{values:['None', 'All', 'First', 'Quorum', 'Weighted'], what:'how results combine'},
  change:{values:['Same', 'Changes'], what:'whether its role changes in a run'},
};
const FAMILIES = [
  {id:'sense', name:'Sense', patterns:['watch', 'ambush', 'scout', 'guard', 'ping', 'intercept']},
  {id:'coordinate', name:'Coordinate', patterns:['trail', 'recruit', 'quorum', 'flock', 'sync', 'drive', 'herd', 'arm']},
  {id:'settle', name:'Settle', patterns:['contest', 'exchange', 'mimic']},
  {id:'keep', name:'Keep', patterns:['tend', 'clear', 'shed', 'cache', 'dormancy', 'hold', 'relief']},
  {id:'carry', name:'Carry', patterns:['relay', 'home', 'haul', 'vacate', 'drop', 'mount']},
  {id:'change', name:'Change', patterns:['metamorph', 'imprint']},
];
/* one record per pattern: [name, what the thread does, start, stay, count, reach, link, join, change, animals, breaks, asks]. Where the spec's table
   gives a qualified value ("One or Crew", "Read, then Write") the record keeps the spec's words; `c` holds the plain values the preset reads. */
const P = (name, does, c, animals, breaks, asks) => ({name, does, ...c, animals, breaks, asks});
const PATTERNS = {
  watch:P('Watch', 'waits, then alarms', {start:'Standing', stay:'Standing', count:'One', reach:'Read', link:'Place', join:'None', change:'Same'},
    ['orb-web spider', 'meerkat sentinel', 'golden eagle'], 'a missed event; a false alarm', 'a threshold, a cadence, and a heartbeat while it watches'),
  ambush:P('Ambush', 'waits at low cost, then acts at full effort on a trigger', {start:'Triggered', stay:'Condition', count:'One', reach:'Write', link:'Place', join:'None', change:'Same'},
    ['viper', 'cat', 'desert scorpion (metered: its Stay is Budget)'], 'a false trigger spends the act on the wrong target; a site with no traffic waits forever', 'a trigger with a range, and a cost per act'),
  scout:P('Scout', 'goes out, reads, reports', {start:'Spawned', stay:'Condition', count:'Crew', reach:'Read', link:'Parent', join:'Weighted', change:'Same'},
    ['honeybee nest-site scouts'], 'a scout that does not return', 'a report scored by quality, and a time to report by'),
  guard:P('Guard', 'stands at an edge and admits or refuses each arrival by its mark', {start:'Standing', stay:'Standing', count:'One or Crew', reach:'Read', link:'Place', join:'None', change:'Same'},
    ['honeybee entrance guards', 'livestock guardian dog', 'lion'], 'a mimic passes: whatever carries the right mark is admitted', 'a check that is more than the mark, and a record of what it admitted'),
  ping:P('Ping', 'sends a probe and reads the echo, and so reveals itself', {start:'Triggered', stay:'Condition', count:'One', reach:'Read', link:'None', join:'None', change:'Same'},
    ['bat', 'dolphin'], 'jamming, clutter, an echo that never comes', 'a probe rate that rises as the target nears, and a timeout'),
  intercept:P('Intercept', 'predicts where a moving target will be and acts there', {start:'Triggered', stay:'Condition', count:'One', reach:'Write', link:'None', join:'None', change:'Same'},
    ['dragonfly'], 'a target that changes course erratically', 'a model of the target\'s motion corrected at every step, and an abort'),
  trail:P('Trail', 'writes decaying marks in a shared place, reads them, sends no messages', {start:'Spawned', stay:'Standing', count:'Swarm', reach:'Write', link:'Place', join:'None', change:'Same'},
    ['ants', 'termites', 'slime mould'], 'the mill: a loop of marks with nothing in it that says stop', 'a decay value on every mark'),
  recruit:P('Recruit', 'a finder signals where and how good, and others go in proportion', {start:'Triggered', stay:'Task', count:'Crew', reach:'Read', link:'Peer', join:'Weighted', change:'Changes'},
    ['honeybee waggle dance', 'vulture'], 'a crowd on a dead site', 'recruitment in proportion to quality, and a stop'),
  quorum:P('Quorum', 'scouts commit to options, and the group acts at a count', {start:'Triggered', stay:'Condition', count:'Swarm', reach:'Read, then Write', link:'Place', join:'Quorum', change:'Changes'},
    ['honeybee swarm', 'house-hunting ants'], 'two equal options deadlock', 'a threshold that can be tuned, and a stop signal'),
  flock:P('Flock', 'reads only its nearest k neighbours, with no lead', {start:'Standing', stay:'Standing', count:'Swarm', reach:'Read', link:'Many', join:'None', change:'Same'},
    ['starling (six or seven neighbours)', 'fish school', 'wolf pack (two local rules)'], 'one error spreads to all, as a wave', 'a fixed neighbour count, not a radius'),
  sync:P('Sync', 'shifts its beat until all match', {start:'Standing', stay:'Standing', count:'Swarm', reach:'Read', link:'Many', join:'None', change:'Same'},
    ['Photinus carolinus', 'Pteroptyx'], 'drift when the links break; beats that fall into step where they should not', 'a shared beat, with jitter where beats must not align'),
  drive:P('Drive', 'holds a fixed role in one hunt', {start:'Called', stay:'Task', count:'Crew', reach:'Write', link:'Peer', join:'All', change:'Same'},
    ['lionesses (wings and centres)', 'white pelicans'], 'one position left open lets the prey through', 'every position held at once, and a start all of them hear'),
  herd:P('Herd', 'steers a crowd from outside without commanding its members', {start:'Called', stay:'Task', count:'One', reach:'Write', link:'Many', join:'None', change:'Same'},
    ['sheepdog'], 'too close, and the flock scatters', 'a distance kept from what it moves'),
  arm:P('Arm', 'takes a goal, and decides the detail locally', {start:'Spawned', stay:'Task', count:'Crew', reach:'Write', link:'Parent', join:'All', change:'Same'},
    ['octopus'], 'an arm keeps on after the goal has changed', 'a goal and a recall from the centre'),
  contest:P('Contest', 'compares costly signals first, and the weaker yields before work is spent', {start:'Triggered', stay:'Condition', count:'Pair', reach:'Write', link:'Peer', join:'First', change:'Same'},
    ['red deer stags', 'bighorn rams'], 'escalation without the comparison, where both lose', 'a cheap comparison before the costly test, and a way to yield'),
  exchange:P('Exchange', 'A serves B for access, and reputation keeps both honest', {start:'Called', stay:'Task', count:'Pair', reach:'Write', link:'Peer', join:'All', change:'Same'},
    ['cleaner wrasse and client fish'], 'cheating', 'a record of each party\'s past exchanges'),
  mimic:P('Mimic', 'wears another\'s mark to pass a Guard', {start:'Triggered', stay:'Task', count:'One', reach:'Write', link:'Place', join:'None', change:'Same'},
    ['hoverfly', 'Photuris', 'bolas spider', 'cuckoo egg'], 'it is the hazard Guard fails to', 'kept to declared probes inside a test'),
  tend:P('Tend', 'loops over one store: brings in, cleans, removes bad items', {start:'Standing', stay:'Standing', count:'Crew', reach:'Write', link:'Place', join:'None', change:'Changes'},
    ['leafcutter ants', 'ants tending aphids'], 'a bad source spreads through the store', 'a cadence of small care, and a sign of what is spreading'),
  clear:P('Clear', 'moves dead items out', {start:'Triggered', stay:'Task', count:'Crew', reach:'Write', link:'Place', join:'None', change:'Same'},
    ['vulture', 'dung beetle', 'ants carrying out their dead'], 'it buries live items', 'a test that an item is dead, not only a mark that says so'),
  shed:P('Shed', 'drops its outer layer on a cycle, and is weak while it does', {start:'Triggered', stay:'Task', count:'One', reach:'Write', link:'None', join:'None', change:'Same'},
    ['snake', 'crab'], 'a stuck shed leaves pieces of the old layer on; while it sheds it is weak', 'a window with no new work, a check that the old layer came off whole, the old skin kept as the record'),
  cache:P('Cache', 'stores in a private place, and moves the store if watched', {start:'Triggered', stay:'Standing', count:'One', reach:'Write, then Read', link:'Place', join:'None', change:'Same'},
    ['scrub jay', 'raven', 'squirrel'], 'a forgotten cache goes stale; a watched one is stolen', 'what, where and when for every cache, and moving one that was observed'),
  dormancy:P('Dormancy', 'stops work at low cost, keeps its state, wakes on a trigger', {start:'Timed', stay:'Condition', count:'One', reach:'Read', link:'None', join:'None', change:'Same'},
    ['black bear'], 'woken too often; each arousal spends reserves', 'a wake condition, and a slow heartbeat that tells dormancy from a stall'),
  hold:P('Hold', 'keeps knowledge the group rarely needs and cannot replace', {start:'Standing', stay:'Standing', count:'One', reach:'Read', link:'Many', join:'None', change:'Same'},
    ['elephant matriarch'], 'the holder is lost and the knowledge with it', 'a successor who has walked the route'),
  relief:P('Relief', 'two take one post in turns, each feeding while the other holds', {start:'Called', stay:'Standing', count:'Pair', reach:'Read or Write', link:'Peer', join:'None', change:'Changes'},
    ['king and Adelie penguin pairs', 'dolphins (one half of the brain asleep at a time)'], 'the relief does not come, and the holder leaves the post when its reserves run out', 'a hand-over the holder can confirm'),
  relay:P('Relay', 'ends, and hands its state on', {start:'Spawned', stay:'Task', count:'Crew', reach:'Write', link:'Parent', join:'None', change:'Same'},
    ['monarch butterfly generations'], 'state lost at the hand-off', 'each leg carries the whole bearing'),
  home:P('Home', 'leaves, works far away, returns to the exact origin', {start:'Called', stay:'Task', count:'One', reach:'Write', link:'Place', join:'None', change:'Same'},
    ['homing pigeon', 'salmon', 'elephant matriarch (water)'], 'a route home that cannot be read', 'the way home known before it leaves'),
  haul:P('Haul', 'carries a load, and reads the hand-off delay as demand', {start:'Triggered', stay:'Task', count:'One or Crew', reach:'Write', link:'Place', join:'All', change:'Same'},
    ['ants carrying together', 'honeybee forager (tremble dance)'], 'loads pile up at the drop', 'backpressure: the hand-off delay read as demand'),
  vacate:P('Vacate', 'releases a resource only for a better one, passing the old one to the next in line', {start:'Triggered', stay:'Task', count:'Crew', reach:'Write', link:'Peer', join:'All', change:'Same'},
    ['hermit crabs (vacancy chains)'], 'one out of order stalls the chain', 'release in order, each release offered to the next in line'),
  drop:P('Drop', 'writes a task into another\'s queue, and leaves', {start:'Called', stay:'Task', count:'One', reach:'Write', link:'Place', join:'None', change:'Same'},
    ['cuckoo'], 'the host cannot refuse', 'an Approvals gate: delegation when Approvals gate it, injection when nothing does'),
  mount:P('Mount', 'runs a rider\'s intent at its own skill, and can refuse', {start:'Called', stay:'Task', count:'Pair', reach:'Write', link:'Parent', join:'All', change:'Same'},
    ['horse and rider', 'phoretic mites'], 'the mount bolts, or the rider overloads it', 'a steering channel the carrier heeds, and the right to refuse'),
  metamorph:P('Metamorph', 'changes scope in stages, including a silent one', {start:'Triggered', stay:'Condition', count:'One', reach:'Read, then Write', link:'None', join:'None', change:'Changes'},
    ['monarch', 'dragonfly', 'periodical cicada'], 'the silent stage looks like a stall', 'stall detection that reads the heartbeat, not output'),
  imprint:P('Imprint', 'binds to one principal in a short window, then accepts only that one', {start:'Spawned', stay:'Condition', count:'Pair', reach:'Read', link:'Parent', join:'None', change:'Changes'},
    ['ewe and lamb', 'greylag goslings'], 'binding to the wrong principal, which is hard to undo', 'a curated first exposure'),
};
for(const F of FAMILIES) for(const id of F.patterns){ PATTERNS[id].id = id; PATTERNS[id].family = F.id; }
const HAZARDS = [
  {id:'mill', name:'The mill', animal:'army ants on a closed trail', breaks:'Trail without decay', of:'trail'},
  {id:'phase', name:'Phase change', animal:'the desert locust', breaks:'density past a threshold changes every agent\'s behaviour at once: runaway fan-out', of:'flock'},
  {id:'jewelwasp', name:'The jewel wasp', animal:'Ampulex compressa', breaks:'a host whose control is taken while its body still works: prompt injection', of:null},
  {id:'mimicry', name:'Mimicry', animal:'hoverflies, Photuris, cuckoo eggs', breaks:'Guard admits whatever carries the mark', of:'guard'},
  {id:'broodparasite', name:'Brood parasitism', animal:'the cuckoo', breaks:'Drop with no Approvals gate', of:'drop'},
  {id:'instep', name:'A herd that falls into step', animal:'(Sync\'s failure)', breaks:'retries or schedules that align and overload what they share', of:'sync'},
];
/* a pattern as a crew preset: the DLW device settings it sets (DLW.md 19.1, 19.4, 19.10, 19.12, 19.13, 19.14, 19.15), and what has no setting yet */
const first = v => String(v).split(/[ ,]/)[0];
function preset(id){
  const p = PATTERNS[id]; if(!p) throw new Error('creature-agency: no pattern ' + id);
  const out = {pattern:id, agent:{}, scope:{}, agentset:{}, launch:{}, gateway:{}, approvals:{}, owed:[]};
  const start = first(p.start), stay = first(p.stay), count = first(p.count), reach = /Write/.test(p.reach) ? 'Write' : /Draft/.test(p.reach) ? 'Draft' : 'Read', link = first(p.link);
  if(start === 'Standing'){ out.agent.Power = 'On'; out.agent.Heartbeat = 'On'; } else if(start === 'Spawned') out.agentset.Members = 'spawned by the lead'; else if(start === 'Timed') out.launch.Launch = 'a cron firing'; else if(start === 'Triggered') out.owed.push('start: Triggered (no trigger setting)');
  if(stay === 'Budget') out.agent.Budget = 'a number of turns'; else if(stay === 'Condition') out.launch.Launch = 'Loop, until its stop condition'; else if(stay === 'Task') out.launch.Then = 'Next task or Hand off';
  if(count === 'Crew' || count === 'Pair') out.agentset['Fan-out'] = count === 'Pair' ? 2 : 'a number'; else if(count === 'Swarm'){ out.agentset['Fan-out'] = 'No limit'; out.agentset['Hand-back'] = 'Digest'; }
  if(reach === 'Read') out.scope.Writes = 'none'; else if(reach === 'Draft') out.scope['Write mode'] = 'Draft'; else { out.scope['Write mode'] = 'Direct'; out.scope.Arm = 'On'; }
  if(link === 'Parent') out.agentset['Hand-back'] = out.agentset['Hand-back'] || 'Summary'; else if(link === 'Peer') out.gateway['Agent to agent'] = 'Allow'; else if(link === 'Place') out.owed.push('link: Place (the Ledger has no marks that decay)'); else if(link === 'Many') out.owed.push('link: Many (no neighbour reads)');
  if(p.join !== 'None') out.owed.push('join: ' + p.join + ' (no combining rule)');
  if(p.change === 'Changes') out.owed.push('change: Changes role (no role change on a member)');
  if(id === 'drop') out.approvals.Show = 'Proposals';
  return out;
}
/* the eight run states (spec 25): every stage maps these to its creature's postures and its environ's zone states */
const RUN_STATES = [
  {id:'queued', name:'queued', breath:false, what:'launched, not started'},
  {id:'thinking', name:'thinking', breath:true, what:'reading and weighing: sources, thoughts'},
  {id:'acting', name:'acting', breath:true, what:'drafting and writing'},
  {id:'waiting', name:'waiting', breath:true, what:'a request or proposal waits for an answer'},
  {id:'stalled', name:'stalled', breath:false, what:'no check-in: frozen where it stopped'},
  {id:'producing', name:'producing', breath:true, what:'returning artefacts'},
  {id:'done', name:'done', breath:false, what:'settled'},
  {id:'failed', name:'failed', breath:false, what:'ended in error'},
];
/* the symbolic layers (spec 26). Element pairs with a Jungian function by the astrologers' pairing (not Jung's own) and with a roster ink. */
const ELEMENTS = {fire:{fn:'intuition', ink:'amber'}, earth:{fn:'sensation', ink:'malachite'}, air:{fn:'thinking', ink:'lapis'}, water:{fn:'feeling', ink:'cinnabar'}};
const MODALITIES = {cardinal:{phase:'start', zone:'roots'}, fixed:{phase:'sustain', zone:'trunk'}, mutable:{phase:'hand over', zone:'crown'}};
const T = (n, name, letter, path) => ({n, name, letter, path});
const SIGNS = {
  Aries:{element:'fire', modality:'cardinal', ruler:'Mars', verb:'to cut, to strike first', trump:T('IV', 'The Emperor', 'Heh', 15)},
  Taurus:{element:'earth', modality:'fixed', ruler:'Venus', verb:'to hold and value', trump:T('V', 'The Hierophant', 'Vav', 16), tetramorph:'Luke'},
  Gemini:{element:'air', modality:'mutable', ruler:'Mercury', verb:'to carry the word', trump:T('VI', 'The Lovers', 'Zayin', 17)},
  Cancer:{element:'water', modality:'cardinal', ruler:'Moon', verb:'to hold and reflect', trump:T('VII', 'The Chariot', 'Cheth', 18)},
  Leo:{element:'fire', modality:'fixed', ruler:'Sun', verb:'to centre and give light', trump:T('VIII', 'Strength', 'Teth', 19), tetramorph:'Mark'},
  Virgo:{element:'earth', modality:'mutable', ruler:'Mercury', verb:'to sort', trump:T('IX', 'The Hermit', 'Yod', 20)},
  Libra:{element:'air', modality:'cardinal', ruler:'Venus', verb:'to weigh', trump:T('XI', 'Justice', 'Lamed', 22)},
  Scorpio:{element:'water', modality:'fixed', ruler:'Mars', coRuler:'Pluto', verb:'to strike; to transform', trump:T('XIII', 'Death', 'Nun', 24), tetramorph:'John (as the eagle)'},
  Sagittarius:{element:'fire', modality:'mutable', ruler:'Jupiter', verb:'to widen', trump:T('XIV', 'Temperance', 'Samekh', 25)},
  Capricorn:{element:'earth', modality:'cardinal', ruler:'Saturn', verb:'to bound and build', trump:T('XV', 'The Devil', 'Ayin', 26)},
  Aquarius:{element:'air', modality:'fixed', ruler:'Saturn', coRuler:'Uranus', verb:'to keep; to break open', trump:T('XVII', 'The Star', 'Tzaddi', 28), tetramorph:'Matthew'},
  Pisces:{element:'water', modality:'mutable', ruler:'Jupiter', coRuler:'Neptune', verb:'to widen; to dissolve', trump:T('XVIII', 'The Moon', 'Qoph', 29)},
};
/* a sign's full layer record, as a roster entry carries it */
function layers(sign){
  const s = SIGNS[sign]; if(!s) return null;
  const E = ELEMENTS[s.element], Mo = MODALITIES[s.modality];
  return {sign, element:s.element, fn:E.fn, elementInk:E.ink, modality:s.modality, phase:Mo.phase, ruler:s.ruler, coRuler:s.coRuler || null, verb:s.verb, trump:s.trump, tetramorph:s.tetramorph || null};
}
const API = {VERSION, FIELDS, FAMILIES, PATTERNS, HAZARDS, RUN_STATES, ELEMENTS, MODALITIES, SIGNS, preset, layers};
if(typeof window !== 'undefined') window.CREATURE_AGENCY = API;
if(typeof module !== 'undefined' && module.exports) module.exports = API;
})();
