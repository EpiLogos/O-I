import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ADOPTED_PRACTICE_SCHEMA, PRACTICE_ADOPTION_RESULT_SCHEMA, adoptPractice, offeredPractice } from './practice-adoption.mjs';
import { sha256Digest } from './world-constituents.mjs';

/*
 * The reader's side of an offered practice. The hosted reading mirrors
 * `field.sh read <ref>` (oi.shared-field.reading/v1); AIKit is a stub that
 * models what the real `source add-directory|show|sync|promote` (root spelling),
 * `explain` and `skill overlay show|set` answer: content-addressed snapshots,
 * a revision per promoted snapshot, and overlays per scope.
 */
const WORLD = 'world:central:project:O-I';
const PRACTICE = `${WORLD}/skill/ql/darshana`;
const REVISION = 'f3d55f2f9ec70f44ff661623c7a931f299dcf29659d00df835446c997ee7ef99';
const NEXT_REVISION = '0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9';
const BODY = '---\nname: darshana\ndescription: The structural gaze.\n---\n\n# Darshana\n\nScout a long Markdown source before reading it whole.\n';
const ADOPTER = 'participant:central:reader';
const ROOT = '/adopter/state/oi/adopted-practices';

function offerOf(body) {
  return { body_digest: sha256Digest(body), media_type: 'text/markdown', body_bytes: new TextEncoder().encode(body).length, revision_basis: 'aikit-capsule-revision-v2', payload_files_not_carried: ['payload/scripts/darshana.py'], text: body };
}

function hostedReading({ availability = 'offered', body = BODY, revision = REVISION, offer, projectionRevision = 3 } = {}) {
  return {
    ok: true,
    data: {
      schema: 'oi.shared-field.reading/v1', ref: PRACTICE, state: 'hosted', field_ref: 'oi:field:central:project:O-I',
      entry: {
        schema: 'oi.explore-entry/v1', ref: PRACTICE, kind: 'practice', world_ref: WORLD, label: 'darshana', revision,
        aliases: ['skill/ql/darshana'], provenance: [], locators: [],
        meta: {
          standing: 'practice', presentation: 'thing', native_owner: 'ai-kit', local_ref: 'skill/ql/darshana', practice_kind: 'skill',
          source_ref: 'skill/ql/darshana', source_revision: revision, availability, grant: 'none',
          ...(availability === 'offered' ? { offer: offer ?? offerOf(body) } : {}),
        },
      },
      projections: [
        { projection_ref: 'projection:central:project:O-I', projection_revision: projectionRevision - 1, subject: { kind: 'central-world', ref: WORLD } },
        { projection_ref: 'projection:central:project:O-I', projection_revision: projectionRevision, subject: { kind: 'central-world', ref: WORLD } },
      ],
    },
  };
}

function memoryFs() {
  const files = new Map();
  return {
    files,
    read: (path) => files.get(path),
    write: (path, value) => { files.set(path, value); },
    mkdir: () => {},
  };
}

function stubAikit(fs) {
  const sources = new Map();
  const overlays = new Map();
  const calls = [];
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const snapshotOf = (dir) => digest(JSON.stringify([...fs.files.entries()].filter(([path]) => path.startsWith(`${dir}/`)).sort()));
  const run = (words) => {
    calls.push(words.join(' '));
    const [head, second] = words;
    // The root spelling (`aikit source …`) both AIKit generations accept.
    const [, verb, id, dir] = words;
    if (head === 'source') {
      if (verb === 'show') return sources.has(id) ? { data: { id, kind: 'directory', active_snapshot: sources.get(id).active ?? null } } : { refused: { code: 'source.unknown', message: `no source ${id}` } };
      if (verb === 'add-directory') { sources.set(id, { dir }); return { data: { id, kind: 'directory' } }; }
      if (verb === 'sync') { const source = sources.get(id); source.candidate = snapshotOf(source.dir); return { data: { id, candidate_snapshot: source.candidate, skills: 1 } }; }
      if (verb === 'promote') { const source = sources.get(id); source.active = source.candidate; return { data: { id, active_snapshot: source.active, skills: 1 } }; }
    }
    if (head === 'explain') {
      const [, sourceId, name] = second.split('/');
      const source = sources.get(sourceId);
      const skillName = source && fs.read(`${source.dir}/SKILL.md`)?.match(/^name:\s*(\S+)$/m)?.[1];
      if (!source?.active || skillName !== name) return { refused: { code: 'capability.unknown', message: second } };
      return { data: { id: second, revision: `rev-${source.active}` } };
    }
    if (head === 'skill' && second === 'overlay') {
      const capability = verb;
      if (words[2] === 'show') return { data: { capability: words[3], overlays: overlays.get(words[3]) ?? [] } };
      if (words[2] === 'set') {
        const option = (flag) => words[words.indexOf(flag) + 1];
        const row = { scope: option('--scope'), guidance: option('--guidance'), reviewed_against: option('--reviewed-against') };
        overlays.set(words[3], [...(overlays.get(words[3]) ?? []).filter((held) => held.scope !== row.scope), row]);
        return { data: { capability: words[3], overlays: overlays.get(words[3]), generation: 'gen_stub' } };
      }
      return { refused: { code: 'unknown', message: capability } };
    }
    return { refused: { code: 'unknown', message: words.join(' ') } };
  };
  return { run, calls, sources, overlays };
}

function world() {
  const fs = memoryFs();
  const aikit = stubAikit(fs);
  const adopt = (input, options = {}) => adoptPractice(input, { root: ROOT, adopter_participant_ref: ADOPTER, adopted_at: '2026-09-28T12:00:00.000Z', ...options }, { fs, aikit: aikit.run });
  return { fs, aikit, adopt };
}

const DIR = `${ROOT}/darshana@f3d55f2f9ec7`;

test('only an offered practice with its body is adoptable', () => {
  const { adopt, aikit } = world();
  assert.throws(() => adopt(hostedReading({ availability: 'inspectable' })), /inspectable: publication alone is not an offer/);
  assert.throws(() => adopt({ ok: true, data: { schema: 'oi.shared-field.reading/v1', ref: PRACTICE, state: 'absent' } }), /absent in this field/);
  const noBody = hostedReading();
  delete noBody.data.entry.meta.offer;
  assert.throws(() => adopt(noBody), /offered but carries no body/);
  const workcell = hostedReading();
  workcell.data.entry.kind = 'workcell';
  assert.throws(() => adopt(workcell), /is a workcell, not a practice/);
  assert.throws(() => adopt(hostedReading({ body: `${BODY}<script>x()</script>\n` })), /not curated text data/);
  assert.deepEqual(aikit.calls, [], 'a refusal touches nothing in AIKit');
});

test('a body that does not match its published digest is refused', () => {
  const { adopt, fs, aikit } = world();
  assert.throws(() => adopt(hostedReading({ offer: { ...offerOf(BODY), text: `${BODY}tampered\n` } })), /does not match its published digest; refusing to adopt/);
  assert.throws(() => adopt(hostedReading({ offer: { ...offerOf(BODY), body_bytes: 1 } })), /published length/);
  assert.equal(fs.files.size, 0);
  assert.deepEqual(aikit.calls, []);
});

test('adoption retains the original identity, version and publication provenance', () => {
  const { adopt, fs, aikit } = world();
  const result = adopt(hostedReading());
  assert.equal(result.schema, PRACTICE_ADOPTION_RESULT_SCHEMA);
  assert.equal(result.state, 'adopted');
  assert.equal(result.adopted_dir, DIR);
  assert.equal(fs.read(`${DIR}/SKILL.md`), BODY, 'the offered body is materialised verbatim');
  const adopted = JSON.parse(fs.read(`${DIR}/ADOPTED.json`));
  assert.equal(adopted.schema, ADOPTED_PRACTICE_SCHEMA);
  assert.deepEqual(adopted.adopted_from, {
    world_ref: WORLD, entry_ref: PRACTICE, field_ref: 'oi:field:central:project:O-I',
    projection_ref: 'projection:central:project:O-I', projection_revision: 3,
    source_ref: 'skill/ql/darshana', source_revision: REVISION, body_digest: sha256Digest(BODY),
  });
  assert.equal(adopted.adopted_at, '2026-09-28T12:00:00.000Z');
  assert.equal(adopted.adopter_participant_ref, ADOPTER);
  assert.deepEqual(adopted.local_differences, []);
  assert.deepEqual(adopted.payload_files_not_carried, ['payload/scripts/darshana.py']);
  assert.deepEqual(result.original, { source_ref: 'skill/ql/darshana', source_revision: REVISION, body_digest: sha256Digest(BODY) });
  // Registered through AIKit's own lifecycle, in order.
  assert.deepEqual(aikit.calls, [
    'source show adopted-darshana-f3d55f2f9ec7',
    `source add-directory adopted-darshana-f3d55f2f9ec7 ${DIR}`,
    'source sync adopted-darshana-f3d55f2f9ec7',
    'source promote adopted-darshana-f3d55f2f9ec7',
    'explain skill/adopted-darshana-f3d55f2f9ec7/darshana',
  ]);
  assert.equal(result.aikit.capability_ref, 'skill/adopted-darshana-f3d55f2f9ec7/darshana');
  assert.equal(result.aikit.snapshot, aikit.sources.get('adopted-darshana-f3d55f2f9ec7').active);
  assert.match(result.invoke.enable, /^aikit enable skill\/adopted-darshana-f3d55f2f9ec7\/darshana --scope global --apply$/);
});

test('an adaptation is a recorded local difference, applied as an overlay, and never edits the original body', () => {
  const { adopt, fs, aikit } = world();
  const guidance = 'In O:I, scout only documents under the docs/ tree.';
  const result = adopt(hostedReading(), { adaptation: guidance });
  assert.equal(fs.read(`${DIR}/SKILL.md`), BODY);
  assert.equal(sha256Digest(fs.read(`${DIR}/SKILL.md`)), result.original.body_digest, 'the adopted body still hashes to the original');
  const [difference] = JSON.parse(fs.read(`${DIR}/ADOPTED.json`)).local_differences;
  assert.deepEqual(difference, {
    kind: 'aikit-skill-overlay',
    overlay_ref: 'aikit:skill-overlay:global:skill/adopted-darshana-f3d55f2f9ec7/darshana',
    capability_ref: 'skill/adopted-darshana-f3d55f2f9ec7/darshana',
    scope: 'global',
    guidance,
    guidance_digest: sha256Digest(guidance),
    adapts: { source_ref: 'skill/ql/darshana', source_revision: REVISION },
    note: 'additive guidance applied through AIKit; the adopted SKILL.md stays the verbatim offered body',
  });
  assert.notEqual(difference.guidance_digest, result.original.body_digest);
  assert.equal(result.aikit.steps.overlay.state, 'set');
  assert.deepEqual(aikit.overlays.get('skill/adopted-darshana-f3d55f2f9ec7/darshana'), [{ scope: 'global', guidance, reviewed_against: result.aikit.adopted_revision }]);
  assert.ok(aikit.calls.at(-1).startsWith('skill overlay set skill/adopted-darshana-f3d55f2f9ec7/darshana --scope global --guidance'));
});

test('re-adopting the same revision is idempotent', () => {
  const { adopt, fs, aikit } = world();
  const first = adopt(hostedReading(), { adaptation: 'Scout docs/ only.' });
  const adoptedBefore = fs.read(`${DIR}/ADOPTED.json`);
  const callsBefore = aikit.calls.length;
  const again = adopt(hostedReading({ projectionRevision: 3 }), { adaptation: 'Scout docs/ only.', adopted_at: '2026-10-01T00:00:00.000Z' });
  assert.equal(again.state, 'already-adopted');
  assert.deepEqual(again.wrote, []);
  assert.equal(fs.read(`${DIR}/ADOPTED.json`), adoptedBefore, 'the first adoption time and differences are kept');
  assert.equal(again.aikit.snapshot, first.aikit.snapshot);
  assert.equal(again.aikit.adopted_revision, first.aikit.adopted_revision);
  const repeated = aikit.calls.slice(callsBefore);
  assert.ok(!repeated.some((call) => /add-directory|promote|overlay set/.test(call)), `no second registration: ${repeated.join('; ')}`);
  // A locally edited body is not silently replaced.
  fs.write(`${DIR}/SKILL.md`, `${BODY}\nmy edit\n`);
  assert.throws(() => adopt(hostedReading()), /no longer holds the verbatim offered body/);
});

test('a new revision adopts side by side; the original identity and version are never overwritten', () => {
  const { adopt, fs, aikit } = world();
  const first = adopt(hostedReading());
  const nextBody = BODY.replace('before reading it whole', 'before citing or placing it');
  const second = adopt(hostedReading({ revision: NEXT_REVISION, body: nextBody, projectionRevision: 4 }));
  assert.notEqual(second.adopted_dir, first.adopted_dir);
  assert.equal(second.adopted_dir, `${ROOT}/darshana@0a1b2c3d4e5f`);
  assert.equal(second.aikit.source_id, 'adopted-darshana-0a1b2c3d4e5f');
  assert.equal(fs.read(`${DIR}/SKILL.md`), BODY, 'the earlier revision is untouched');
  assert.equal(JSON.parse(fs.read(`${DIR}/ADOPTED.json`)).adopted_from.source_revision, REVISION);
  assert.equal(JSON.parse(fs.read(`${second.adopted_dir}/ADOPTED.json`)).adopted_from.source_revision, NEXT_REVISION);
  assert.equal(JSON.parse(fs.read(`${second.adopted_dir}/ADOPTED.json`)).adopted_from.projection_revision, 4);
  assert.ok(aikit.sources.get('adopted-darshana-f3d55f2f9ec7').active, 'the first adoption stays promoted');
  assert.ok(aikit.sources.get('adopted-darshana-0a1b2c3d4e5f').active);
  // The same directory refuses a different adoption.
  fs.write(`${DIR}/ADOPTED.json`, JSON.stringify({ schema: ADOPTED_PRACTICE_SCHEMA, adopted_from: { source_revision: 'other' } }));
  assert.throws(() => adopt(hostedReading()), /already holds a different adoption/);
});

test('a publication bundle entry is adoptable the same way as a hosted reading', () => {
  const reading = hostedReading().data;
  const bundle = { schema: 'oi.world-publication/v1', field: { field_ref: reading.field_ref }, projection: reading.projections[1], entries: [reading.entry] };
  const offered = offeredPractice(bundle, 'skill/ql/darshana');
  assert.equal(offered.entry_ref, PRACTICE);
  assert.equal(offered.projection_revision, 3);
  assert.throws(() => offeredPractice(bundle, 'skill/ql/absent'), /carries no entry/);
});

// ── The capsule path: the reader's AIKit has `source add-capsule` (AIKit ≥ #455) ──
const SCRIPT = 'print("gaze")\n';
const MANIFEST = 'schema = 1\nid = "skill/ql/darshana"\nkind = "skill"\nname = "darshana"\n\n[skill]\nroot = "payload"\n';
function capsuleOf(body = BODY, revision = REVISION) {
  const row = (path, mode, text) => ({ path, mode, bytes: Buffer.byteLength(text), sha256: `sha256:${createHash('sha256').update(text).digest('hex')}`, text });
  return {
    schema: 'aikit.practice-capsule/v1', id: 'skill/ql/darshana', name: 'darshana', form: 'skill', revision, revision_basis: 'aikit-capsule-revision-v2',
    exported_from: { source_id: 'ql', snapshot: 'e'.repeat(64) },
    files: [row('manifest.toml', 0o644, MANIFEST), row('payload/SKILL.md', 0o644, body), row('payload/scripts/darshana.py', 0o755, SCRIPT)],
  };
}
const capsuleReading = ({ body = BODY, revision = REVISION, projectionRevision = 3 } = {}) => hostedReading({ body, revision, projectionRevision, offer: { ...offerOf(body), payload_files_not_carried: [], capsule: capsuleOf(body, revision) } });

/** A stub of AIKit #455's capsule sources beside the directory stub above. */
function capsuleWorld({ supports = true, activeElsewhere = false } = {}) {
  const fs = memoryFs();
  const base = stubAikit(fs);
  const capsules = new Map();
  if (activeElsewhere) capsules.set('ql', { capsule_id: 'skill/ql/darshana', revision: 'older', active: 'snap-ql' });
  const run = (words) => {
    const [head, verb, id] = words;
    if (head === 'source' && verb === 'add-capsule') {
      base.calls.push(words.join(' '));
      const archive = JSON.parse(fs.read(id));
      const option = (flag) => words[words.indexOf(flag) + 1];
      const provenance = JSON.parse(fs.read(option('--provenance').slice(1)));
      if (provenance.practice_id !== archive.id || provenance.revision !== archive.revision) return { refused: { code: 'source.provenance_mismatch', message: 'x' } };
      const sourceId = `capsule-${archive.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${archive.revision.slice(0, 12)}`;
      const upstream = { world_ref: option('--world-ref'), entry_ref: option('--upstream-ref'), practice_id: archive.id, revision: archive.revision, archive_sha256: `sha256:${createHash('sha256').update(fs.read(id)).digest('hex')}` };
      const already = capsules.has(sourceId);
      if (!already) capsules.set(sourceId, { capsule_id: archive.id, revision: archive.revision, archive: fs.read(id) });
      return { data: { id: sourceId, kind: 'capsule', capsule: { id: archive.id, revision: archive.revision }, upstream, already_registered: already, next: 'sync and promote' } };
    }
    if (head === 'source' && capsules.has(id)) {
      base.calls.push(words.join(' '));
      const source = capsules.get(id);
      if (verb === 'show') return { data: { id, kind: 'capsule', active_snapshot: source.active ?? null } };
      if (verb === 'sync') { source.candidate = createHash('sha256').update(source.archive).digest('hex'); return { data: { id, candidate_snapshot: source.candidate, skills: 1 } }; }
      if (verb === 'promote') {
        const other = [...capsules.entries()].find(([otherId, held]) => otherId !== id && held.active && held.capsule_id === source.capsule_id);
        if (other) return { refused: { code: 'source.capsule_identity_active', message: `\`${source.capsule_id}\` is already active through source \`${other[0]}\``, details: { capability: source.capsule_id, active_source: other[0] } } };
        source.active = source.candidate;
        return { data: { id, active_snapshot: source.active, skills: 1 } };
      }
    }
    if (head === 'explain') {
      const active = [...capsules.values()].find((held) => held.active && held.capsule_id === verb);
      if (active) { base.calls.push(words.join(' ')); return { data: { id: verb, revision: active.revision } }; }
    }
    return base.run(words);
  };
  const aikit = { ...base, run, capsules };
  const adopt = (input, options = {}) => adoptPractice(input, { root: ROOT, adopter_participant_ref: ADOPTER, adopted_at: '2026-09-28T12:00:00.000Z', ...options }, { fs, aikit: aikit.run, supports: (words) => supports && words.join(' ') === 'source add-capsule' });
  return { fs, aikit, adopt };
}

const CAPSULE_DIR = `${ROOT}/capsules/darshana@f3d55f2f9ec7`;
const CAPSULE_SOURCE = 'capsule-skill-ql-darshana-f3d55f2f9ec7';

test('capsule path: chosen when AIKit supports add-capsule; files, modes and the payload script travel under the original id', () => {
  const { adopt, fs, aikit } = capsuleWorld();
  const result = adopt(capsuleReading());
  assert.equal(result.path, 'capsule');
  assert.equal(result.state, 'adopted');
  assert.equal(result.adopted_dir, CAPSULE_DIR);
  const archive = JSON.parse(fs.read(`${CAPSULE_DIR}/capsule.json`));
  assert.deepEqual(archive, capsuleOf(), 'the archive is the offered capsule verbatim');
  assert.deepEqual(archive.files.find((file) => file.path === 'payload/scripts/darshana.py'), { path: 'payload/scripts/darshana.py', mode: 0o755, bytes: SCRIPT.length, sha256: `sha256:${createHash('sha256').update(SCRIPT).digest('hex')}`, text: SCRIPT });
  assert.equal(fs.read(`${CAPSULE_DIR}/ADOPTED.json`), undefined, 'provenance lives in AIKit\'s registration, not beside or inside the capsule as ADOPTED.json');
  assert.deepEqual(JSON.parse(fs.read(`${CAPSULE_DIR}/provenance.json`)), { world_ref: WORLD, entry_ref: PRACTICE, practice_id: 'skill/ql/darshana', revision: REVISION });
  assert.deepEqual(aikit.calls, [
    `source add-capsule ${CAPSULE_DIR}/capsule.json --world-ref ${WORLD} --upstream-ref ${PRACTICE} --provenance @${CAPSULE_DIR}/provenance.json`,
    `source show ${CAPSULE_SOURCE}`,
    `source sync ${CAPSULE_SOURCE}`,
    `source promote ${CAPSULE_SOURCE}`,
    'explain skill/ql/darshana',
  ]);
  assert.equal(result.aikit.capability_ref, 'skill/ql/darshana', 'the original id is retained');
  assert.equal(result.aikit.adopted_revision, REVISION, 'and its original revision');
  assert.deepEqual(result.aikit.upstream, { world_ref: WORLD, entry_ref: PRACTICE, practice_id: 'skill/ql/darshana', revision: REVISION, archive_sha256: `sha256:${createHash('sha256').update(fs.read(`${CAPSULE_DIR}/capsule.json`)).digest('hex')}` });
  assert.equal(result.adopted.adopted_from.files, 3);
  assert.deepEqual(result.adopted.local_differences, []);
  // Adapting: an overlay over the original id, recorded in the result.
  const adapted = adopt(capsuleReading(), { adaptation: 'Scout docs/ only.' });
  assert.equal(adapted.adopted.local_differences[0].capability_ref, 'skill/ql/darshana');
  assert.deepEqual(aikit.overlays.get('skill/ql/darshana'), [{ scope: 'global', guidance: 'Scout docs/ only.', reviewed_against: REVISION }]);
  // Idempotent.
  const again = adopt(capsuleReading(), { adaptation: 'Scout docs/ only.' });
  assert.equal(again.state, 'already-adopted');
  assert.deepEqual(again.wrote, []);
});

test('capsule path: an id already active through another source is refused as identity-already-active, never overwritten', () => {
  const { adopt, aikit } = capsuleWorld({ activeElsewhere: true });
  const result = adopt(capsuleReading());
  assert.equal(result.path, 'capsule');
  assert.equal(result.state, 'identity-already-active');
  assert.equal(result.active_source, 'ql');
  assert.equal(result.capability_ref, 'skill/ql/darshana');
  assert.match(result.message, /already active in this AIKit home through source ql/);
  assert.equal(aikit.capsules.get('ql').active, 'snap-ql', 'the active source is untouched');
  assert.equal(aikit.capsules.get(CAPSULE_SOURCE).active, undefined, 'the adopted capsule is registered but not promoted');
  assert.ok(!aikit.calls.includes('explain skill/ql/darshana'));
});

test('capsule path: a tampered capsule file in the offer is refused before anything is written', () => {
  const { adopt, fs } = capsuleWorld();
  const reading = capsuleReading();
  reading.data.entry.meta.offer.capsule.files[2].text = 'import os\n';
  assert.throws(() => adopt(reading), /does not match its declared length and sha256/);
  assert.equal(fs.files.size, 0);
  const mode = capsuleReading();
  mode.data.entry.meta.offer.capsule.files[2].mode = 0o4755;
  assert.throws(() => adopt(mode), /beyond rwx/);
});

test('fallback path: an older AIKit adopts the body only and names what it could not carry', () => {
  const { adopt, fs, aikit } = capsuleWorld({ supports: false });
  const result = adopt(capsuleReading());
  assert.equal(result.path, 'body-only');
  assert.match(result.fallback_reason, /no `source add-capsule`/);
  assert.equal(fs.read(`${DIR}/SKILL.md`), BODY);
  assert.deepEqual(JSON.parse(fs.read(`${DIR}/ADOPTED.json`)).payload_files_not_carried, ['payload/scripts/darshana.py']);
  assert.ok(!aikit.calls.some((call) => call.includes('add-capsule')));
  assert.equal(result.aikit.capability_ref, 'skill/adopted-darshana-f3d55f2f9ec7/darshana');
  // An offer without a capsule takes the fallback even on a capable AIKit.
  const capable = capsuleWorld();
  assert.equal(capable.adopt(hostedReading()).path, 'body-only');
});
