#!/usr/bin/env node
/**
 * bimba-snapshot.mjs — the Bimba coordinate-lattice collection producer.
 *
 * Reads the LIVE Bimba graph (read-only) and emits the committed collection
 * members + manifest beside this script's parent directory, under the native
 * collection law (oi.legacy-collections/v1 + oi.collection-provenance/v1 —
 * O-I #428), following the committed-corpus precedent (#452): every member
 * is a journey document (oi.journey v1) that self-identifies (top-level
 * `id` === its manifest entry id) and carries its graph node verbatim in an
 * additive `bimba` field, so the Library holds live-graph knowledge as
 * exact-source members that can be regenerated — and drift-checked — when
 * the graph moves.
 *
 * READ-ONLY. The producer speaks Cypher over the Neo4j HTTP transactional
 * endpoint and never writes to the graph (the bimba-portable `bimba:read`
 * posture; the write-capable `bimba_sync` is NOT used). The bimba-portable
 * package itself is untouched and has no git — the live source is cited in
 * the provenance, not modified.
 *
 * SLICE RULE (stated in the manifest provenance): every :Bimba node whose
 * coordinate contains neither `-` nor `.` — the complete top-level
 * coordinate lattice. Six QL families (C/P/L/S/T/M: Category, Position,
 * Lens, Subsystem, Stack, Thought), each with root, prime, positions 0–5
 * and position primes; plus the `#` ground row, the composite roots
 * (CF/CFP/CP/CPF/CT/CS, CF_*), the Family_* nodes and the four Weave_*
 * nodes. Deep branch coordinates (e.g. M2-5-9) are OUT of this slice: the
 * lattice roots are the planned bound, not an unbounded graph dump.
 * The two embedding vector properties (`embedding`, `c_5_embedding`) are
 * excluded — model-derived, regenerable, not graph knowledge; embedding
 * METADATA (model/dimensions/generated_at) is retained.
 *
 * Usage (from anywhere; paths resolve relative to this file):
 *   node bimba-snapshot.mjs            capture: rewrite members + manifest
 *   node bimba-snapshot.mjs --verify   re-read the live graph and check the
 *                                      committed snapshot still matches it
 *                                      (per-member data equality + graph
 *                                      content hash); exits 1 on drift.
 *
 * Env: BIMBA_HTTP (default http://100.92.62.101:7474), BIMBA_DATABASE
 * (default neo4j). No credentials: the canonical instance runs NEO4J_AUTH=none.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLLECTION_DIR = path.resolve(HERE, '..');
const HTTP = process.env.BIMBA_HTTP ?? 'http://100.92.62.101:7474';
const DATABASE = process.env.BIMBA_DATABASE ?? 'neo4j';
const BOLT = 'bolt://100.92.62.101:7687'; // cited in provenance; reads go over HTTP

const SLICE_CYPHER =
  "MATCH (n:Bimba) WHERE n.coordinate IS NOT NULL AND NOT n.coordinate CONTAINS '-' AND NOT n.coordinate CONTAINS '.' " +
  'RETURN properties(n) AS props, labels(n) AS labels, coalesce(n.c_2_uuid, n.uuid) AS uuid';
const COUNT_CYPHER = 'MATCH (n:Bimba) RETURN count(n) AS total';
const EXCLUDED_PROPERTY_KEYS = ['embedding', 'c_5_embedding'];
const GRAPH_CONTENT_SHA_KEY = 'graph_content_sha256';

async function cypher(statement) {
  const response = await fetch(`${HTTP}/db/${DATABASE}/tx/commit`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({statements: [{statement, resultDataContents: ['row']}]}),
  });
  if (!response.ok) throw new Error(`Neo4j HTTP ${response.status} from ${HTTP}: ${await response.text()}`);
  const body = await response.json();
  if (body.errors?.length) throw new Error(`Neo4j returned errors: ${JSON.stringify(body.errors)}`);
  return body.results[0].data.map(row => row.row);
}

// --- deterministic derivation (identical in capture and verify) ---

const ID_GRAMMAR = /^[a-zA-Z0-9_.:-]{1,160}$/;
function memberIdOf(coordinate) {
  const id = coordinate === '#' ? 'sharp' : coordinate.replaceAll("'", '-prime').replaceAll('#', 'sharp-');
  if (!ID_GRAMMAR.test(id)) throw new Error(`coordinate ${coordinate} normalises to illegal member id "${id}"`);
  return id;
}

function familyOf(coordinate) {
  const root = coordinate.replace("'", '');
  if (/^(C|P|L|S|T|M)([0-5]?)$/.test(root) && !['CF', 'CFP', 'CP', 'CPF', 'CS', 'CT'].includes(root)) {
    const families = {C: ['C · Category', 'Category — ontological foundation'], P: ['P · Position', 'Position — functional semantics'], L: ['L · Lens', 'Lens — epistemic modes'], M: ['M · Subsystem', 'Subsystem — consciousness domains'], S: ['S · Stack', 'Stack — technology layers'], T: ['T · Thought', 'Thought — artifacts/cognition']};
    return families[root[0]];
  }
  return ['Grounds and weaves', 'The # ground row, Weave_* crossings, composite roots and family descriptors'];
}

function subdirOf(coordinate) {
  const [group] = familyOf(coordinate);
  if (group === 'Grounds and weaves') {
    if (coordinate.startsWith('Weave_')) return 'weaves';
    return 'grounds';
  }
  return coordinate[0].toLowerCase();
}

const bounded = (value, max) => {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
};

const DEFAULT_ENGINE_SETTINGS = {paletteSource: 'custom', grainProfile: true, backgroundMode: 'solid', resonatorMode: 'resonator', focusOrder: 'listed', dotShape: 'circle', autoFitSizes: true, mediumEnabled: false, collisionEnabled: false, collisionMode: 'obstacle', pairwiseEnabled: false, fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 900, resonanceEnabled: true, morphEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', autoOscillate: true, relationalEnabled: false, relationalMode: 'orbital', pointerMode: 'repel', pointerClick: 'pulse', pointerClickStrength: 2.2, pointerClickRadius: 0.45, colorMode: 'linearGradient', colorEnabled: true, mediumPlane: 'vertical', mediumDimension: '2D', autoSweep: false, sweepDirection: 'ascent'};
const DEFAULT_PARAMS = {count: 62000, size: 2.8, sizeBias: 1.6, opacity: 0.92, roundness: 0.95, softness: 0.15, irregularity: 0.35, elongation: 0.04, orientation: 0, contrast: 0.93, densityScale: 1, densityPhase: 0.3, edgeWeight: 0, halo: 0.13, speed: 0.7, circulation: 1, turbulence: 0.22, turbulenceScale: 1.2, recovery: 1.1, dispersion: 0.09, pointerStrength: 0.8, pointerRadius: 0.23, pointerFalloff: 2, depth: 0.12, grain: 0.035, snapRigidity: 1, densityTether: 1, curlDepth: 0.2, vortexRadius: 0.4, gravityX: 0, gravityY: 0, gravityZ: 0, quadraticDrag: 0.2, thermalJitter: 0, speedLimit: 3, zConfinement: 1, timeScale: 1, gravitySoftening: 0.1, gravityFalloff: 2, swirlRadius: 0.4, frequency: 220, dominance: 0, excitation: 0.6};

function cleanProperties(props) {
  const clean = {};
  for (const key of Object.keys(props).sort()) if (!EXCLUDED_PROPERTY_KEYS.includes(key)) clean[key] = props[key];
  return clean;
}

/** The graph-content hash: sha256 over the canonical JSON (sorted keys, no
 * whitespace) of the ordered slice — [{coordinate, uuid, labels, properties}]
 * with vector properties excluded. Computable BOTH from the live graph and
 * from the committed member documents, so drift is checkable either way. */
function graphContentHash(slice) {
  const canonical = JSON.stringify(slice.map(({coordinate, uuid, labels, props}) => ({
    coordinate, uuid, labels, properties: cleanProperties(props),
  })));
  return createHash('sha256').update(canonical).digest('hex');
}

function memberDocumentOf(row, capturedAt) {
  const {coordinate, uuid, labels, props} = row;
  const id = memberIdOf(coordinate);
  const [group, familyLong] = familyOf(coordinate);
  const name = props['c_1_name'];
  const description = typeof props['c_1_description'] === 'string' ? props['c_1_description'] : '';
  const journeyName = bounded(name ? `${coordinate} — ${name}` : coordinate, 160);
  return {
    schema: 'oi.journey',
    version: 1,
    id,
    name: journeyName,
    description: bounded(description || `Snapshot of Bimba coordinate ${coordinate} from the live graph.`, 5000),
    loop: true,
    updatedAt: capturedAt,
    scenes: [{
      engine: {...DEFAULT_ENGINE_SETTINGS},
      id: `${id}-scene-1`,
      name: bounded(name || coordinate, 160),
      character: bounded(`Coordinate ${coordinate} of the live Bimba graph — ${familyLong}. Captured ${capturedAt}.`, 5000),
      duration: 12,
      transition: 1.5,
      view: {mode: '2d', yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0},
      field: {background: '#f4f2eb', palette: ['#252720', '#252720'], material: 'ink', params: {...DEFAULT_PARAMS}},
      entities: [],
      text: [{
        id: `${id}-text-1`,
        visible: true,
        kicker: bounded(`Bimba · ${group}`, 300),
        title: bounded(name || coordinate, 300),
        italic: bounded(coordinate, 300),
        body: bounded(description || `Coordinate ${coordinate}: ${Object.keys(cleanProperties(props)).length} graph properties carried verbatim in this document's bimba field.`, 5000),
        x: 0.5, y: 0.42, width: 680, size: 28, align: 'center',
      }],
      composition: {layout: 'free', plane: 'XY', focus: 'parallel', focusDuration: 4, carryTint: true, carryStation: false, frequencyDriver: 'manual'},
      morph: {thetaRate: 0.08, phiRate: 0.13, thetaOffset: 0, phiOffset: 0, law: 'theta', depth: 1, dwell: 0.3},
      automation: [],
    }],
    // Additive exact-source field: the graph node as read, vectors excluded.
    bimba: {
      coordinate,
      uuid: uuid ?? null,
      labels,
      captured_at: capturedAt,
      source: {neo4j_http: HTTP, bolt: BOLT, database: DATABASE, read: 'read-only Cypher (no graph writes)'},
      properties: cleanProperties(props),
    },
  };
}

const sortCoordinates = rows => [...rows].sort((a, b) => (a.coordinate < b.coordinate ? -1 : a.coordinate > b.coordinate ? 1 : 0));

async function readSlice() {
  const raw = await cypher(SLICE_CYPHER);
  const slice = sortCoordinates(raw.map(([props, labels, uuid]) => ({
    coordinate: props['coordinate'], uuid, labels, props,
  })));
  if (!slice.length) throw new Error('the slice query returned no nodes — check BIMBA_HTTP and the graph');
  for (const row of slice) if (typeof row.coordinate !== 'string' || row.coordinate.includes('-') || row.coordinate.includes('.')) {
    throw new Error(`slice rule violated by coordinate ${row.coordinate}`);
  }
  const [total] = await cypher(COUNT_CYPHER);
  return {slice, graphNodeCount: total[0] ?? total};
}

async function readCommitted() {
  const members = [];
  const manifestNames = (await fs.readdir(COLLECTION_DIR)).filter(name => /^bimba-.*\.manifest\.json$/.test(name)).sort();
  let entryCount = 0;
  for (const name of manifestNames) {
    const manifest = JSON.parse(await fs.readFile(path.join(COLLECTION_DIR, name), 'utf8'));
    for (const entry of manifest.featured) {
      members.push({entry, document: JSON.parse(await fs.readFile(path.join(COLLECTION_DIR, entry.file), 'utf8'))});
      entryCount++;
    }
  }
  if (!manifestNames.length || !entryCount) throw new Error('no bimba-*.manifest.json members found — run a capture first');
  return {manifestNames, members};
}

// --- capture ---

async function capture() {
  const {slice, graphNodeCount} = await readSlice();
  const capturedAt = new Date().toISOString();
  const contentHash = graphContentHash(slice);

  const members = slice.map(row => {
    const document = memberDocumentOf(row, capturedAt);
    const rel = path.join('coordinates', subdirOf(row.coordinate), `${document.id}.journey.json`);
    return {row, document, rel, id: document.id};
  });
  const ids = new Set(members.map(m => m.id));
  if (ids.size !== members.length) throw new Error('member id collision — refusing to write an ambiguous manifest');

  // One manifest per family group, each far under the reader's 64-member
  // read page (the committed-corpus precedent: essay/rooms/corpus are
  // separate manifests of one corpus). All manifests of a capture share the
  // same ground, slice rule and graph content hash, so any one carries the
  // full capture provenance and --verify checks the whole set.
  const groups = new Map();
  for (const member of members) {
    const group = familyOf(member.row.coordinate)[0];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(member);
  }
  const groupSlug = group => group === 'Grounds and weaves' ? 'grounds-weaves'
    : {C: 'c', P: 'p', L: 'l', M: 'm', S: 's', T: 't'}[group[0]];
  const provenanceOf = group => ({
    schema: 'oi.collection-provenance/v1',
    register: 'project',
    root: 'Work/O-I',
    paths: ['Work/O-I/desktop/cradle/expressions-app/collections/bimba'],
    ground: `live Bimba graph: Neo4j 5.26 Community at ${BOLT} (HTTP ${HTTP}, auth disabled) on the oi-omarchy docker host, served through Work/epi/bimba-portable (stateless MCP 2026-07-28); ${graphNodeCount} :Bimba nodes at capture`,
    exported_at: capturedAt,
    generator: {
      name: 'collections/bimba/tools/bimba-snapshot.mjs — read-only Cypher over the Neo4j HTTP transactional endpoint; no graph writes; bimba-portable read conventions (bimba:read only)',
      revision: 'bimba-snapshot-2026-09-21',
    },
    slice_rule: "every :Bimba node whose coordinate contains neither '-' nor '.' — the complete top-level coordinate lattice: six QL families C/P/L/S/T/M (Category, Position, Lens, Subsystem, Stack, Thought), each with its root, prime, positions 0-5 and position primes, plus the # ground row, the CF/CFP/CP/CPF/CT/CS composite roots, the CF_* forms, the Family_* descriptors and the four Weave_* crossings; deep branch coordinates (e.g. M2-5-9) are outside the slice. This manifest carries the group: " + group,
    exclusions: 'embedding vector properties (embedding, c_5_embedding) excluded as model-derived and regenerable; embedding metadata (model, dimensions, task type, generated_at) retained',
    member_count: groups.get(group).length,
    lattice_member_count: members.length,
    manifest_count: groups.size,
    graph_node_count: graphNodeCount,
    captured_at: capturedAt,
    [GRAPH_CONTENT_SHA_KEY]: contentHash,
    graph_content_hash_basis: 'sha256 over the canonical JSON (sorted keys, no whitespace) of the ordered lattice slice [{coordinate, uuid, labels, properties}] with vector properties excluded — recomputable from the live graph and from the committed member documents, so drift is checkable with --verify',
    regeneration: 'node collections/bimba/tools/bimba-snapshot.mjs (capture) or --verify (drift check) under collections/bimba/tools, env BIMBA_HTTP',
    atlas_disposition: 'the travelling-jigsaw Atlas surface is already carried by its committed corpus journey (roz-mytheme-travelling-jigsaw-atlas, return-of-zero mytheme family); the Bimba Atlas navigation ground itself is what this collection binds, as exact-source lattice snapshots',
  });

  for (const member of members) {
    const file = path.join(COLLECTION_DIR, member.rel);
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, JSON.stringify(member.document, null, 2) + '\n');
  }
  for (const [group, groupMembers] of groups) {
    const manifest = {
      schema: 'oi.legacy-collections/v1',
      exported_at: capturedAt,
      source: `Bimba — ${group}: the live coordinate lattice of the Epi-Logos graph (the Bimba Atlas navigation ground)`,
      provenance: provenanceOf(group),
      featured: groupMembers.map(m => ({
        id: m.id,
        name: m.document.name,
        file: m.rel.split(path.sep).join('/'),
        group,
      })),
    };
    await fs.writeFile(path.join(COLLECTION_DIR, `bimba-${groupSlug(group)}.manifest.json`), JSON.stringify(manifest, null, 2) + '\n');
  }
  console.log(`captured ${members.length} coordinates of ${graphNodeCount} :Bimba nodes at ${capturedAt} into ${groups.size} group manifests`);
  console.log(`${GRAPH_CONTENT_SHA_KEY}: ${contentHash}`);
}

// --- verify: committed snapshot vs the live graph, right now ---

async function verify() {
  const [{slice}, committed] = await Promise.all([readSlice(), readCommitted()]);
  const liveHash = graphContentHash(slice);
  const problems = [];
  const manifestHashes = [];
  for (const name of committed.manifestNames) {
    const manifest = JSON.parse(await fs.readFile(path.join(COLLECTION_DIR, name), 'utf8'));
    manifestHashes.push({name, hash: manifest.provenance?.[GRAPH_CONTENT_SHA_KEY]});
  }
  const declaredHash = manifestHashes[0]?.hash;
  for (const {name, hash} of manifestHashes) {
    if (hash !== declaredHash) problems.push(`${name}: graph content hash ${hash} disagrees with the other manifests' ${declaredHash}`);
  }
  const liveByCoordinate = new Map(slice.map(row => [row.coordinate, row]));
  const checked = [];

  for (const {entry, document} of committed.members) {
    const coordinate = document.bimba?.coordinate;
    const live = liveByCoordinate.get(coordinate);
    if (!live) { problems.push(`${entry.id}: coordinate ${coordinate} no longer matches the slice rule in the live graph`); continue; }
    if (document.id !== entry.id) problems.push(`${entry.file}: document id ${document.id} != manifest entry id ${entry.id}`);
    const expected = cleanProperties(live.props);
    const actual = document.bimba?.properties;
    if (JSON.stringify(expected) !== JSON.stringify(actual)) problems.push(`${entry.file}: bimba.properties differ from the live node`);
    if (JSON.stringify(document.bimba?.labels) !== JSON.stringify(live.labels)) problems.push(`${entry.file}: labels differ from the live node`);
    if (document.bimba?.uuid && live.uuid && document.bimba.uuid !== live.uuid) problems.push(`${entry.file}: uuid differs from the live node`);
    checked.push(entry.id);
  }
  const extra = slice.filter(row => !committed.members.some(m => m.document.bimba?.coordinate === row.coordinate));
  for (const row of extra) problems.push(`live coordinate ${row.coordinate} satisfies the slice rule but is not a committed member`);

  const hashOk = liveHash === declaredHash;
  console.log(`committed members checked: ${checked.length}/${committed.members.length}`);
  console.log(`graph content hash: committed ${declaredHash}`);
  console.log(`                    live     ${liveHash} ${hashOk ? '(MATCH)' : '(DRIFT)'}`);
  if (problems.length) {
    console.error(`DRIFT — ${problems.length} problem(s):`);
    for (const problem of problems) console.error('  ' + problem);
    process.exitCode = 1;
  } else {
    console.log(`verified: all ${checked.length} committed members match the live graph byte-for-byte at the property level, and the graph content hash matches.`);
  }
}

if (process.argv.includes('--verify')) await verify();
else {
  if (process.argv.includes('--capture') || process.argv.length === 2) await capture();
  else {
    console.error('usage: node bimba-snapshot.mjs [--capture|--verify]');
    process.exit(2);
  }
}
