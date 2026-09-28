#!/usr/bin/env node
/**
 * Local publication step: native readings + explicit owner selection
 *   → publication bundle (oi.world-publication/v1)
 *   → standalone edition (index.html + projection.json + manifest.json)
 *   → hosted reducer arguments (hosted-args.json)
 *
 * Readings come either from files (`--reading <path>`, each recognised by the
 * schema it carries, bare or in its owner's `--json` envelope) or from the
 * owners themselves (`--from-ctrl`):
 *
 *   central.wiki.read / projectcentral.wiki.read     central.wiki-reading/v1
 *   central.position.list {project}                  central.position-listing/v1   (when the selection names Positions)
 *   aikit gateway who --project-world P --json       aikit.population-reading/v1   (when a Position is selected in "occupancy" mode)
 *   aikit wiki-construct inspect --file W <ref>      aikit.constellation/v1        (per selected constellation; W is each wiki
 *                                                                                  register central.world.here discloses)
 *   ctrl machine.declaration {role: current}         central.machine               (when Workcells are selected: which Workcell this machine binds)
 *   workcell --json --workcell-ref R discover        Workcell offers               (per bound Workcell selected in "offer" mode)
 *   oi agent participation --agent A --world W --json oi.agent-world-participation/v1 (per Agent whose practices are selected)
 *   factory project locate <project> --json          factory.project-location/v1   (when activity is selected; its state path is used, never published)
 *   factory development run <state> <run> --json     factory.run-reading/v1        (per selected activity)
 *   aikit praxis read <id> --revision <rev> --json   aikit.practice-reading/v1     (per offered practice, when this AIKit has
 *                                                                                  `praxis read`: AIKit proves the disclosed revision
 *                                                                                  and the whole capsule travels → oi.practice-offer-body/v1)
 *   aikit system source show <source> --json          active snapshot of the source (fallback for an older AIKit: SKILL.md only,
 *                                                                                  read from that snapshot and its revision recomputed)
 *
 * AIKit is the joiner of Actuation and Factory; this step never reads them
 * directly. It performs no network publication; `shared-field/spacetimedb/publish-world.ts`
 * pushes the bundle to a SharedField afterwards.
 *
 *   node shared-field/scripts/publish-world.mjs --selection sel.json --from-ctrl --out out/
 *   node shared-field/scripts/publish-world.mjs --selection sel.json --reading root.json --reading o-i.json --out out/
 *   ... --previous out/bundle.json      # re-project an existing lineage (P n+1)
 */
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { projectCentralWikiWorld, reprojectCentralWikiWorld, hostedPublicationArgs, exploreSeedFromPublication, offeredPracticeLeaks, worldPublicationLeaks, unwrapOwnerReading } from '../central-wiki-projection.mjs';
import { AGENT_PARTICIPATION_SCHEMA, PRACTICE_OFFER_BODY_SCHEMA, practiceOfferBody, practiceOfferFromReading, workcellRef } from '../world-constituents.mjs';
import { renderWorldEdition, worldEditionManifest } from '../world-edition.mjs';

function parseArgs(argv) {
  const args = { readings: [], sentinels: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--selection': args.selection = value; index += 1; break;
      case '--reading': args.readings.push(value); index += 1; break;
      case '--from-ctrl': args.fromCtrl = true; break;
      case '--central': args.central = value; index += 1; break;
      case '--out': args.out = value; index += 1; break;
      case '--previous': args.previous = value; index += 1; break;
      case '--explore-base': args.exploreBase = value; index += 1; break;
      case '--sentinel': args.sentinels.push(value); index += 1; break;
      case '--published-at': args.publishedAt = value; index += 1; break;
      default: throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (!args.selection) throw new Error('--selection is required');
  if (!args.out) throw new Error('--out is required');
  if (args.readings.length === 0 && !args.fromCtrl) throw new Error('supply --reading files or --from-ctrl');
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ctrlAction(action, input, cwd) {
  const result = spawnSync(process.env.CTRL_BIN ?? 'ctrl', ['--json', 'action', 'run', action, JSON.stringify(input)], { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (result.error) throw new Error(`ctrl could not run: ${result.error.message}`);
  let envelope;
  try { envelope = JSON.parse(result.stdout); } catch { throw new Error(`ctrl ${action} returned non-JSON: ${result.stdout.slice(0, 200)} ${result.stderr.slice(0, 200)}`); }
  if (!envelope.ok) throw new Error(`ctrl ${action} refused: ${JSON.stringify(envelope).slice(0, 400)}`);
  return envelope.data;
}

/** One owner read that prints a bare JSON document (oi, workcell, factory). */
function ownerRead(envName, fallback, words, cwd) {
  const program = process.env[envName] ?? fallback;
  const result = spawnSync(program, words, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (result.error) throw new Error(`${program} could not run (${result.error.message}); put it on PATH or name it with ${envName}`);
  let document;
  try { document = JSON.parse(result.stdout); } catch { throw new Error(`${program} ${words.slice(0, 3).join(' ')} returned non-JSON (exit ${result.status}): ${result.stdout.slice(0, 200)} ${result.stderr.slice(0, 200)}`); }
  if (result.status !== 0 || document.ok === false) throw new Error(`${program} ${words.slice(0, 3).join(' ')} refused (exit ${result.status}): ${JSON.stringify(document.error ?? document).slice(0, 300)}`);
  return document;
}

/** One AIKit read through its `--json` envelope; a refusal comes back as `{refused}` in AIKit's own words. */
function aikitRead(words, cwd) {
  const program = process.env.OI_AIKIT_BIN ?? 'aikit';
  const result = spawnSync(program, [...words, '--json'], { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (result.error) throw new Error(`${program} could not run (${result.error.message}); the Position, occupancy and constellation reads come from AIKit — put aikit on PATH or name it with OI_AIKIT_BIN`);
  let envelope;
  try { envelope = JSON.parse(result.stdout); } catch { throw new Error(`aikit ${words.slice(0, 2).join(' ')} returned non-JSON: ${result.stdout.slice(0, 200)} ${result.stderr.slice(0, 200)}`); }
  if (envelope.ok !== true) return { refused: envelope.error ?? { message: 'refused without an error body' } };
  return { data: envelope.data };
}

/** Whether this machine's AIKit answers `words --help` (a subcommand an older AIKit lacks exits non-zero). */
function aikitSupports(words, cwd) {
  const result = spawnSync(process.env.OI_AIKIT_BIN ?? 'aikit', [...words, '--help'], { cwd, encoding: 'utf8' });
  return !result.error && result.status === 0;
}

const args = parseArgs(process.argv.slice(2));
const selection = readJson(args.selection);
const readings = args.readings.map(readJson);
if (args.fromCtrl) {
  const cwd = args.central ?? process.env.CENTRAL_HOME ?? process.cwd();
  const scope = selection.project ? { project: selection.project } : {};
  readings.push(ctrlAction('central.wiki.read', {}, cwd));
  if (selection.project) readings.push(ctrlAction('projectcentral.wiki.read', { project: selection.project }, cwd));
  const modes = Object.values(selection.positions ?? {});
  if (modes.length) readings.push(ctrlAction('central.position.list', scope, cwd));
  const workcells = selection.workcells ?? {};
  const practices = selection.practices ?? {};
  const activity = selection.activity ?? {};
  let population;
  if (modes.includes('occupancy') || Object.keys(workcells).length || Object.keys(practices).length || Object.keys(activity).length) {
    const who = aikitRead(['gateway', 'who', ...(selection.project ? ['--project-world', `project:${selection.project}`] : [])], cwd);
    if (who.refused) throw new Error(`aikit gateway who refused: ${who.refused.code ?? ''} ${who.refused.message ?? ''}`.trim());
    population = who.data;
    readings.push(who.data);
  }
  if (Object.keys(workcells).length) {
    // Central says which Workcell this machine binds; the Workcell product
    // describes itself under that identity. Offers are read only for a bound
    // Workcell selected in "offer" mode.
    const machine = ctrlAction('machine.declaration', { role: 'current' }, cwd);
    readings.push(machine);
    const bound = new Set((machine.declaration?.bindings ?? []).filter((binding) => binding.kind === 'workcell').map((binding) => binding.reference));
    for (const [ref, value] of Object.entries(workcells)) {
      const mode = typeof value === 'string' ? value : value?.mode;
      if (mode === 'offer' && bound.has(ref)) readings.push(ownerRead('OI_WORKCELL_BIN', 'workcell', ['--json', '--workcell-ref', ref, 'discover'], cwd));
    }
  }
  if (Object.keys(practices).length) {
    const world = selection.project ? `project:${selection.project}` : 'control:root';
    const agents = new Set();
    for (const [positionRef, value] of Object.entries(practices)) {
      const agent = (!Array.isArray(value) && value.agent_ref) || population?.positions?.find((row) => row.position_ref === positionRef)?.occupancy?.agent_ref;
      if (!agent) throw new Error(`practices for ${positionRef}: the Position has no occupant Agent in the population reading; name agent_ref in the selection`);
      agents.add(agent);
    }
    for (const agent of agents) readings.push(ownerRead('OI_BIN', 'oi', ['agent', 'participation', '--agent', agent, '--world', world, '--json'], cwd));
  }
  if (Object.keys(activity).length) {
    const here = ctrlAction('central.world.here', scope, cwd);
    const projectRoot = here.project_world?.path ? join(here.local_world.root, here.project_world.path) : here.local_world?.root;
    const location = ownerRead('OI_FACTORY_BIN', 'factory', ['project', 'locate', projectRoot, '--json'], cwd);
    if (!location.statePath) throw new Error(`factory project locate disclosed no state for ${here.project_world?.ref ?? here.local_world?.ref}`);
    const runs = new Set();
    for (const ref of Object.keys(activity)) {
      if (ref.startsWith('run:')) { runs.add(ref); continue; }
      const run = population?.positions?.find((row) => row.current_work?.custody_ref === ref)?.current_work?.run_ref;
      if (!run) throw new Error(`activity ${ref}: the population reading attests no run for this custody`);
      runs.add(run);
    }
    for (const run of runs) readings.push(ownerRead('OI_FACTORY_BIN', 'factory', ['development', 'run', location.statePath, run, '--json'], cwd));
  }
  if ((selection.constellations ?? []).length) {
    // Central discloses where each register's wiki lives; AIKit reads the
    // constellation from it. The frame lives in exactly one register.
    const here = ctrlAction('central.world.here', scope, cwd);
    const root = here.local_world?.root;
    const registers = [here.project_world?.roots?.wiki, here.local_world?.roots?.wiki].filter((path) => typeof path === 'string' && path);
    if (!root || registers.length === 0) throw new Error('central.world.here disclosed no wiki register to read constellations from');
    for (const ref of selection.constellations) {
      const refusals = [];
      let found;
      for (const path of registers) {
        const file = isAbsolute(path) ? path : join(root, path);
        const read = aikitRead(['wiki-construct', 'inspect', '--file', file, ref], cwd);
        if (read.data) { found = read.data; break; }
        refusals.push(`${path}: ${read.refused.message ?? read.refused.code}`);
      }
      if (!found) throw new Error(`constellation ${ref} is not readable from any disclosed wiki register (${refusals.join('; ')})`);
      readings.push(found);
    }
  }
}

/**
 * One AIKit capsule directory as bytes and permission bits: the manifest and
 * every other regular file (symlinks are not part of AIKit's revision).
 */
function capsuleFiles(dir) {
  const files = [];
  const walk = (relative) => {
    for (const item of readdirSync(join(dir, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${item.name}` : item.name;
      if (item.isDirectory()) walk(path);
      else if (item.isFile() && path !== 'manifest.toml') files.push({ path, mode: lstatSync(join(dir, path)).mode, bytes: new Uint8Array(readFileSync(join(dir, path))) });
    }
  };
  walk('');
  return { manifest: { bytes: new Uint8Array(readFileSync(join(dir, 'manifest.toml'))), mode: lstatSync(join(dir, 'manifest.toml')).mode }, files };
}

/**
 * An offered practice travels with its body. When this AIKit has `praxis
 * read`, AIKit itself reads the practice at the revision the Agent's
 * participation discloses and proves it (`aikit.practice-reading/v1`); the
 * whole capsule — payload scripts and references with their modes — travels
 * as data. Otherwise (an older AIKit) the declared fallback: AIKit names the
 * source's active, immutable, content-addressed snapshot (`aikit system source
 * show`), the capsule is read from it and its revision recomputed here, and
 * only SKILL.md travels. Bodies already supplied as `--reading` files are kept.
 */
function readOfferedPracticeBodies(selection, documents, cwd) {
  const unwrapped = documents.map((document) => { try { return unwrapOwnerReading(document); } catch { return undefined; } });
  const held = new Set(unwrapped.filter((reading) => reading?.schema === PRACTICE_OFFER_BODY_SCHEMA).map((reading) => reading.practice_ref));
  const praxis = new Map();
  for (const reading of unwrapped) {
    if (reading?.schema !== AGENT_PARTICIPATION_SCHEMA) continue;
    for (const row of reading.repertoire?.praxis ?? []) if (typeof row?.id === 'string') praxis.set(row.id, row.revision);
  }
  const bodies = [];
  let canRead;
  for (const [subject, refs] of Object.entries(selection.offers ?? {})) {
    if (workcellRef(subject)) continue;
    for (const ref of refs) {
      if (held.has(ref) || !praxis.has(ref)) continue;
      canRead ??= aikitSupports(['praxis', 'read'], cwd);
      if (canRead) {
        const read = aikitRead(['praxis', 'read', ref, '--revision', praxis.get(ref)], cwd);
        if (read.refused) throw new Error(`aikit praxis read ${ref} refused: ${read.refused.code ?? ''} ${read.refused.message ?? ''}`.trim());
        bodies.push(practiceOfferFromReading({ practice_ref: ref, source_revision: praxis.get(ref), reading: read.data }));
        held.add(ref);
        continue;
      }
      const source = ref.match(/^skill\/([A-Za-z0-9._-]+)\/[^/]+$/)?.[1];
      if (!source) throw new Error(`offered practice ${ref} is not an AIKit skill ref (skill/<source>/<name>); its body cannot be read`);
      const shown = aikitRead(['source', 'show', source], cwd);
      if (shown.refused) throw new Error(`aikit source show ${source} refused: ${shown.refused.code ?? ''} ${shown.refused.message ?? ''}`.trim());
      if (!shown.data.active_registry || !shown.data.active_snapshot) throw new Error(`AIKit source ${source} has no active snapshot to read ${ref} from`);
      const capsule = capsuleFiles(join(shown.data.active_registry, 'capsules', ...ref.split('/')));
      bodies.push(practiceOfferBody({ practice_ref: ref, source_revision: praxis.get(ref), source_id: source, snapshot: shown.data.active_snapshot, capsule }));
      held.add(ref);
    }
  }
  return bodies;
}

readings.push(...readOfferedPracticeBodies(selection, readings, args.central ?? process.env.CENTRAL_HOME ?? process.cwd()));

// Every file an offered capsule carries — text whole, binary through its
// printable strings — is scanned on its own against the full local leak set
// before anything is built, so a refusal names the practice and the file; the
// whole-bundle scan below still runs.
for (const reading of readings) {
  if (reading?.schema !== PRACTICE_OFFER_BODY_SCHEMA) continue;
  const offerLeaks = offeredPracticeLeaks(reading, readings, args.sentinels);
  if (offerLeaks.length) {
    const files = [...new Set(offerLeaks.map((leak) => leak.slice(0, leak.lastIndexOf(':'))))];
    console.error(JSON.stringify({ ok: false, error: `offered practice ${reading.practice_ref} ${files.length === 1 && files[0] === 'body' ? 'body' : `file ${files.join(', ')}`} would carry protected material`, leaks: offerLeaks }));
    process.exit(2);
  }
}

const publishedAt = args.publishedAt ?? new Date().toISOString();
const bundle = args.previous
  ? reprojectCentralWikiWorld(readJson(args.previous), { readings, selection, published_at: publishedAt })
  : projectCentralWikiWorld({ readings, selection, published_at: publishedAt });

const html = renderWorldEdition(bundle.projection, { explore_base: args.exploreBase ?? '/explore.html' });
const manifest = worldEditionManifest(bundle.projection, html);
const hostedArgs = hostedPublicationArgs(bundle);
const seed = exploreSeedFromPublication(bundle);

// The publisher's own sentinels plus the protected inhabitation material the
// readings carry (session and SessionSpace refs, gateway addresses and tokens,
// attention, Communique bodies, protected purpose refs) — always checked.
const leaks = worldPublicationLeaks({ bundle, hosted_args: hostedArgs, explore_seed: seed, edition_html: html, edition_manifest: manifest }, readings, args.sentinels);
if (leaks.length) {
  console.error(JSON.stringify({ ok: false, error: 'publication would leak sentinel material', leaks }));
  process.exit(2);
}

const out = resolve(args.out);
mkdirSync(join(out, 'edition'), { recursive: true });
writeFileSync(join(out, 'bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
writeFileSync(join(out, 'hosted-args.json'), `${JSON.stringify(hostedArgs, null, 2)}\n`);
writeFileSync(join(out, 'explore-seed.json'), `${JSON.stringify(seed, null, 2)}\n`);
writeFileSync(join(out, 'edition', 'index.html'), html);
writeFileSync(join(out, 'edition', 'projection.json'), `${JSON.stringify(bundle.projection, null, 2)}\n`);
writeFileSync(join(out, 'edition', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  ok: true,
  out,
  world_ref: bundle.world_ref,
  projection_ref: bundle.projection.projection_ref,
  projection_revision: bundle.projection.projection_revision,
  source: bundle.source,
  source_moved: bundle.source_moved ?? null,
  moved_sources: bundle.moved_sources ?? null,
  sources: bundle.sources,
  entries: bundle.entries.length,
  entry_kinds: bundle.entries.reduce((counts, entry) => ({ ...counts, [entry.kind]: (counts[entry.kind] ?? 0) + 1 }), {}),
  relations: bundle.relations.length,
  excluded: bundle.excluded,
  offered_bodies: bundle.entries.filter((entry) => entry.kind === 'practice' && entry.meta?.offer).map((entry) => ({
    ref: entry.ref,
    source_revision: entry.meta.source_revision,
    body_digest: entry.meta.offer.body_digest,
    body_bytes: entry.meta.offer.body_bytes,
    // Which path read it: the whole capsule through `aikit praxis read`, or the SKILL.md-only fallback.
    read_via: readings.find((reading) => reading?.schema === PRACTICE_OFFER_BODY_SCHEMA && reading.practice_ref === entry.meta.local_ref)?.read_via ?? null,
    carried: entry.meta.offer.capsule ? 'capsule' : 'body-only',
    files: entry.meta.offer.capsule ? entry.meta.offer.capsule.files.map((file) => ({ path: file.path, mode: `0${file.mode.toString(8)}`, bytes: file.bytes })) : undefined,
  })),
  edition_digest: manifest.digest.value,
  sentinels_checked: args.sentinels.length,
}, null, 2));
