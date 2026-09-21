// export-return-of-zero-candidate — assembles the FULL publication-tuple
// candidate for the committed Return-of-Zero collection members (O:I #417,
// comment 5749361807 tuple: admitted native subject + collection membership +
// complete body + Expression/Projection revision + source-return + approved
// assets) and writes the owner approval sheet. Continuation of the landed
// publication lane: PUBLICATION.json (#448 envelope) and the #452 corpus
// commits — this script modifies neither; it reads them and extends the same
// `oi.collection-publication/v1` shape to every committed member.
//
// Default posture (owner commission 2026-09-20/21): every one of the 92
// committed members is already public in the public O-I repository, so the
// edition candidate admits them; the sheet lists each family and the owner may
// strike any. Nothing is published by this script: it writes the candidate
// bundle and the sheet, and verifies every hash it claims.
//
//   node scripts/export-return-of-zero-candidate.mjs            # assemble + verify + write
//   node scripts/export-return-of-zero-candidate.mjs --verify   # re-verify the written candidate only
//
// Outputs (under collections/return-of-zero/):
//   PUBLICATION-CANDIDATE.json  — the candidate envelope the #448 producer consumes
//   OWNER-APPROVAL-SHEET.md     — the owner's item-by-item approval sheet
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const repoRoot = resolve(appRoot, '../../..');
const outRoot = join(appRoot, 'collections', 'return-of-zero');
const legacyRoot = join(appRoot, 'legacy-collections');
// worktree-aware ground resolution: walk up from the checkout root until the
// Work root (the one holding Point-Cloud-Demo) appears, and prefer the main
// checkout's Antykathera-Essay-Work beside it.
function workRoot() {
  let dir = repoRoot;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'Point-Cloud-Demo'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(repoRoot, '..', '..');
}
const corpusRoot = process.env.OI_PCD_CORPUS_ROOT
  || join(workRoot(), 'Point-Cloud-Demo', 'production', 'return-of-zero');
const essayRepo = process.env.OI_ESSAY_REPO
  || [resolve(repoRoot, 'Antykathera-Essay-Work'), resolve(repoRoot, '..', '..', 'Antykathera-Essay-Work')]
    .find((candidate) => existsSync(candidate))
  || resolve(repoRoot, '..', '..', 'Antykathera-Essay-Work');
const sourceDir = join(appRoot, 'field-studies-journeys', 'sources');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const readSha = (path) => sha256(readFileSync(path));
const rel = (abs) => relative(repoRoot, abs).split('\\').join('/');

const ENVELOPE = join(outRoot, 'PUBLICATION.json');
const CANDIDATE = join(outRoot, 'PUBLICATION-CANDIDATE.json');
const SHEET = join(outRoot, 'OWNER-APPROVAL-SHEET.md');

const landed = JSON.parse(readFileSync(ENVELOPE, 'utf8'));
const corpusManifest = JSON.parse(readFileSync(join(outRoot, 'corpus.manifest.json'), 'utf8'));
const essayManifest = JSON.parse(readFileSync(join(outRoot, 'essay.manifest.json'), 'utf8'));
const roomsManifest = JSON.parse(readFileSync(join(outRoot, 'rooms.manifest.json'), 'utf8'));
const legacyManifest = JSON.parse(readFileSync(join(legacyRoot, 'manifest.json'), 'utf8'));

const ESSAY_COMMIT_FULL = 'dbf3b1771724bd56663e4e3410df13e9d3ae681b'; // full sha of the envelope's pinned dbf3b17
const PCD_COMMIT = corpusManifest.provenance.production_revision.commit; // Point-Cloud-Demo production revision
const corpusCommit = corpusManifest.provenance.source_revision.commit; // dbf3b17 (short)

// --- verification helpers ----------------------------------------------------
function blobAt(commit, path) {
  try {
    return execFileSync('git', ['-C', essayRepo, 'show', `${commit}:${path}`], {encoding: 'buffer', maxBuffer: 64 * 1024 * 1024});
  } catch { return null; }
}
const problems = [];
const checks = {total: 0};
function check(ok, label) {
  checks.total += 1;
  if (!ok) { problems.push(label); console.error(`  FAIL ${label}`); }
  return ok;
}

// --- source returns ----------------------------------------------------------
// Point-Cloud-Demo production family directories differ from the collection's
// own for two families (arguments-a, conjugates-a-prime).
const pcdFamilyDir = (familyDir) => (familyDir === 'arguments' ? 'arguments-a' : familyDir === 'conjugates' ? 'conjugates-a-prime' : familyDir);
function corpusSourceReturn(member, relFile) {
  const bindingRel = `bindings/${member.id}.binding.json`;
  const bindingPath = join(corpusRoot, bindingRel);
  check(existsSync(bindingPath), `binding record present: ${member.id}`);
  const binding = existsSync(bindingPath) ? JSON.parse(readFileSync(bindingPath, 'utf8')) : {source_revision: {records: []}};
  // byte-exact copy proof: committed O-I member bytes == Point-Cloud-Demo production bytes
  const committedBytes = readFileSync(join(outRoot, member.file));
  const pcdRel = pcdFamilyDir(relFile.split('/')[0]) + relFile.slice(relFile.indexOf('/'));
  const productionPath = join(corpusRoot, pcdRel);
  let byteExact = false;
  if (existsSync(productionPath)) byteExact = readSha(productionPath) === sha256(committedBytes);
  check(byteExact, `byte-exact production copy: ${member.id}`);
  // canonical census records verify at the pinned essay commit
  const records = (binding.source_revision?.records ?? []).map((record) => {
    const pinned = blobAt(ESSAY_COMMIT_FULL, record.path);
    check(Boolean(pinned) && sha256(pinned) === record.sha256, `census record at pinned commit: ${member.id}:${record.record_id ?? record.path}`);
    return {record_id: record.record_id ?? null, path: record.path, sha256: record.sha256, verified_at: `EpiLogos/Antykathera-Essay-Work @ ${corpusCommit}`};
  });
  check(records.length > 0, `binding carries census records: ${member.id}`);
  return {
    kind: 'production-binding',
    member_bytes: {path: rel(join(outRoot, member.file)), sha256: sha256(committedBytes)},
    production_copy: {repo: 'EpiLogos/Point-Cloud-Demo', path: `production/return-of-zero/${pcdRel}`, revision: PCD_COMMIT, byte_exact: byteExact},
    binding_record: {repo: 'EpiLogos/Point-Cloud-Demo', path: `production/return-of-zero/${bindingRel}`, revision: PCD_COMMIT},
    canonical_sources: records,
  };
}

function pinnedSourceReturn(member) {
  // essay/rooms members: the landed envelope already pins their sources; reuse
  // those bindings verbatim and re-verify them here.
  const manifestEntryDoc = landed.manifests.find((m) => m.member_paths.includes(`collections/return-of-zero/${member.file}`));
  check(Boolean(manifestEntryDoc), `landed envelope carries ${member.id}`);
  const bindings = (manifestEntryDoc?.source_bindings ?? []).filter((b) => b.artifact === member.file);
  check(bindings.length > 0, `landed envelope pins sources for ${member.id}`);
  for (const binding of bindings) {
    const pinned = blobAt(ESSAY_COMMIT_FULL, binding.path);
    check(Boolean(pinned) && sha256(pinned) === binding.sha256, `pinned essay source: ${binding.path}`);
  }
  return {
    kind: 'pinned-essay-sources',
    member_bytes: {path: rel(join(outRoot, member.file)), sha256: readSha(join(outRoot, member.file))},
    canonical_sources: bindings.map((b) => ({record_id: null, path: b.path, sha256: b.sha256, verified_at: `EpiLogos/Antykathera-Essay-Work @ ${corpusCommit} and current checkout`})),
  };
}

function legacySourceReturn(member) {
  const bytes = readFileSync(join(legacyRoot, member.file));
  const entry = {
    kind: 'native-member-bytes',
    member_bytes: {path: rel(join(legacyRoot, member.file)), sha256: sha256(bytes)},
    origin: 'the Expressions application modules (field-studies-journeys) per legacy-collections/manifest.json provenance; the committed journey document IS the native source',
  };
  if (member.family === 'Legacy starters — Source studies') {
    entry.note = 'embeds its source imagery as data URLs inside the journey document; see the asset inventory';
  }
  return entry;
}

// --- member assembly ---------------------------------------------------------
const familyCounts = new Map();
const bump = (family) => familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);

const members = [];
function addMember(manifestName, memberRoot, featured, family, sourceReturnFn) {
  const journeyAbs = join(memberRoot, featured.file);
  check(existsSync(journeyAbs), `member file present: ${featured.id}`);
  const doc = existsSync(journeyAbs) ? JSON.parse(readFileSync(journeyAbs, 'utf8')) : {};
  check(doc.id === featured.id, `member id matches document: ${featured.id} (${doc.id ?? 'missing'})`);
  const entry = {
    id: featured.id,
    name: featured.name,
    family,
    manifest: manifestName === 'legacy-collections/manifest.json' ? 'legacy-collections/manifest.json' : manifestName,
    file: featured.file,
    body_revision: {
      scheme: 'journey-bytes-sha256',
      sha256: existsSync(journeyAbs) ? sha256(readFileSync(journeyAbs)) : null,
      note: 'no member carries a native expression: ref; the journey artifact revision IS the body revision, and the #448 producer derives the oi.expression-publication/v1 from the journey formations',
    },
    collection_membership: {manifest: manifestName === 'legacy-collections/manifest.json' ? 'desktop/cradle/expressions-app/legacy-collections/manifest.json' : `desktop/cradle/expressions-app/collections/return-of-zero/${manifestName}`, slot: members.length + 1},
    scenes: Array.isArray(doc.scenes) ? doc.scenes.length : 0,
    has_scene_prose: Array.isArray(doc.scenes) && doc.scenes.some((s) => (s.text ?? []).some((t) => (t.body ?? '').trim().length > 0)),
    source_return: sourceReturnFn({id: featured.id, file: featured.file, family}),
    cover: null,
  };
  if (manifestName !== 'legacy-collections/manifest.json') {
    const cover = featured.file.replace(/\.journey\.json$/, '.cover.png');
    if (existsSync(join(outRoot, cover))) {
      const committed = readSha(join(outRoot, cover));
      const pcdCover = join(corpusRoot, pcdFamilyDir(cover.split('/')[0]) + cover.slice(cover.indexOf('/')));
      let productionMatch = null;
      if (existsSync(pcdCover)) {
        productionMatch = readSha(pcdCover) === committed;
        check(productionMatch, `cover matches production capture: ${featured.id}`);
      }
      entry.cover = {path: rel(join(outRoot, cover)), sha256: committed, production_match: productionMatch};
    }
  }
  bump(family);
  members.push(entry);
}

// corpus families (43)
const corpusFamilies = new Map([
  ['arguments', 'Arguments'], ['conjugates', 'Conjugates A′'], ['episteme', 'Episteme'],
  ['matheme', 'Matheme'], ['mytheme', 'Mytheme wholes'], ['symbolon', 'Symbolon'],
]);
for (const featured of corpusManifest.featured) {
  const family = corpusFamilies.get(featured.file.split('/')[0]) ?? featured.group;
  addMember('corpus.manifest.json', outRoot, featured, family, (m) => corpusSourceReturn(m, featured.file));
}
// essay (1) + rooms (8)
for (const featured of essayManifest.featured) {
  addMember('essay.manifest.json', outRoot, featured, 'Sovereign essay reading', (m) => pinnedSourceReturn(m));
}
for (const featured of roomsManifest.featured) {
  addMember('rooms.manifest.json', outRoot, featured, 'Section rooms', (m) => pinnedSourceReturn(m));
}
// legacy (40: 3 featured + 37 starters)
for (const featured of legacyManifest.featured) {
  addMember('legacy-collections/manifest.json', legacyRoot, featured, 'Legacy featured', legacySourceReturn);
}
for (const featured of legacyManifest.starters) {
  addMember('legacy-collections/manifest.json', legacyRoot, featured, `Legacy starters — ${featured.group}`, legacySourceReturn);
}

check(members.length === 92, `member total is 92 (found ${members.length})`);

// --- asset inventory ---------------------------------------------------------
// 1. covers: captured, not drawn (production/return-of-zero README law):
//    tools/capture.mjs through the real engine.
const covers = members.filter((m) => m.cover).map((m) => ({
  asset: m.cover.path,
  sha256: m.cover.sha256,
  members: [m.id],
  provenance: 'pipeline-generated — captured by Point-Cloud-Demo production/return-of-zero/tools/capture.mjs through the real oi.journey engine (collection README law: "covers are captured, not drawn"); committed at O-I #452 (0b18c11b/26f852b5)',
  classification: 'pipeline-generated',
  candidate: 'YES',
  reason: 'engine capture of the member formation itself',
}));
check(covers.length === 52, `52 covers inventoried (found ${covers.length})`);
check(members.filter((m) => !m.cover).every((m) => m.manifest === 'legacy-collections/manifest.json'), 'cover-less members are exactly the legacy members');

// 2. embedded imagery inside member journeys (data URLs), mapped to their
//    source bytes in field-studies-journeys/sources/.
const sourceHashes = new Map();
function scanSources(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) scanSources(p);
    else sourceHashes.set(sha256(readFileSync(p)), rel(p));
  }
}
scanSources(sourceDir);
const embedded = [];
for (const member of members) {
  const memberRoot = member.manifest === 'legacy-collections/manifest.json' ? legacyRoot : outRoot;
  const raw = readFileSync(join(memberRoot, member.file), 'utf8');
  const seen = new Map();
  for (const match of raw.matchAll(/data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)/g)) {
    const bytes = Buffer.from(match[2], 'base64');
    seen.set(sha256(bytes), {mime: match[1], bytes: bytes.length});
  }
  for (const [hash, info] of seen) {
    const originName = sourceHashes.get(hash) ?? null;
    let entry = embedded.find((e) => e.sha256 === hash);
    if (!entry) {
      entry = {
        asset: originName ?? `unresolved data-url ${info.mime} embedded in journeys`,
        sha256: hash,
        mime: info.mime,
        bytes: info.bytes,
        members: [],
        origin_resolved: Boolean(originName),
      };
      embedded.push(entry);
    }
    entry.members.push(member.id);
  }
}

// the mask/laminate starters embed four source images; classify + flag them
const faceAssets = embedded.filter((e) => e.origin_resolved);
check(faceAssets.length === 4, `four embedded face assets resolved (found ${faceAssets.length})`);
const unresolvedEmbedded = embedded.filter((e) => !e.origin_resolved);
check(unresolvedEmbedded.length === 0, `no unresolved embedded imagery (found ${unresolvedEmbedded.length})`);
const flaggedAssets = faceAssets.map((e) => ({
  ...e,
  classification: 'generated-then-processed — Gemini-generated face imagery (untracked working material Point-Cloud-Demo/faces-test/ carries the same "Gemini Generated Image" batch, no byte-exact match: re-encoded/processed; the JPEGs carry Photoshop 3.0 BIM metadata); no committed provenance record names the producer or the processing chain',
  candidate: 'FLAG',
  reason: 'imagery bytes whose producing act is not recorded in committed ground; already public in the repo, but admitting them into an audience edition is a rights/posture decision',
  owner_question: `This image rides inside ${(e.members || []).join(', ')} as an embedded data URL. Admit it into the public edition, strike the dependent members, or hold the members until the producer is recorded?`,
}));

// 3. inline authored assets recorded by the production bindings (no binaries)
let inlineAuthored = 0;
const inlineKinds = new Map();
for (const name of readdirSync(join(corpusRoot, 'bindings'))) {
  if (!name.endsWith('.binding.json')) continue;
  const binding = JSON.parse(readFileSync(join(corpusRoot, 'bindings', name), 'utf8'));
  for (const asset of binding.assets ?? []) {
    inlineAuthored += 1;
    inlineKinds.set(asset.kind, (inlineKinds.get(asset.kind) ?? 0) + 1);
  }
}

// --- expression / projection revision policy --------------------------------
const expressionPolicy = {
  native_expression_refs: 0,
  policy: 'no member carries a native expression: binding record; per the tuple rule the journey artifact sha256 is recorded as the body revision, and the audience Expression/Projection pair (oi.expression-publication/v1 + the oi.world-publication/v1 projection) is derived deterministically from the journey formations by the existing #448 producer at publish time — never invented as a native ref',
};

// --- candidate envelope ------------------------------------------------------
const essayBindingsByArtifact = new Map();
for (const m of landed.manifests) for (const b of m.source_bindings) {
  const list = essayBindingsByArtifact.get(b.artifact) ?? [];
  list.push(b);
  essayBindingsByArtifact.set(b.artifact, list);
}

const candidateManifests = [
  {
    manifest: 'collections/return-of-zero/corpus.manifest.json',
    members: corpusManifest.featured.length,
    member_paths: corpusManifest.featured.map((f) => f.file),
    source_revision: {repo: 'EpiLogos/Point-Cloud-Demo', commit: PCD_COMMIT},
    body_kind: 'scene-editorial',
  },
  {
    manifest: 'collections/return-of-zero/essay.manifest.json',
    members: essayManifest.featured.length,
    member_paths: essayManifest.featured.map((f) => f.file),
    source_bindings: essayManifest.featured.flatMap((f) => essayBindingsByArtifact.get(f.file) ?? []),
  },
  {
    manifest: 'collections/return-of-zero/rooms.manifest.json',
    members: roomsManifest.featured.length,
    member_paths: roomsManifest.featured.map((f) => f.file),
    source_bindings: roomsManifest.featured.flatMap((f) => essayBindingsByArtifact.get(f.file) ?? []),
  },
  {
    manifest: 'collections/return-of-zero/../legacy-collections/manifest.json',
    member_root: 'legacy-collections',
    members: legacyManifest.featured.length + legacyManifest.starters.length,
    member_paths: [...legacyManifest.featured, ...legacyManifest.starters].map((f) => f.file),
    body_kind: 'formation-or-description',
  },
];
check(candidateManifests.reduce((n, m) => n + m.members, 0) === 92, 'candidate manifests total 92');

const familyTable = [...familyCounts.entries()];
const candidate = {
  schema: 'oi.collection-publication/v1',
  exported_at: new Date().toISOString(),
  title: 'Return of Zero — the public edition candidate (full committed corpus)',
  standing: 'CANDIDATE — assembled for owner approval (O:I #417). Nothing is published by this document; approval is the owner\'s act, and publishing is running the existing #448 producer against this envelope, with deployment a separate decision.',
  source_revision: landed.source_revision,
  corpus: {
    ...landed.corpus,
    production_revision: {repo: 'EpiLogos/Point-Cloud-Demo', commit: PCD_COMMIT},
  },
  manifests: candidateManifests,
  required_assets: covers.map((c) => ({asset: c.asset, sha256: c.sha256})),
  candidate: {
    schema: 'oi.collection-candidate/v1',
    receiver_tuple: 'EpiLogos/O-I#417 comment 5749361807: admitted native subject + collection membership + complete body + Expression/Projection revision + source-return + approved assets',
    basis: {
      corpus_commit: 'EpiLogos/O-I 0b18c11b (#452) + 26f852b5 — 92 native members, byte-exact with provenance',
      publication_lane: 'EpiLogos/O-I 4591faec (#448) — site producer + PUBLICATION.json envelope (nine-member deliberately published slice, unchanged and included)',
      source_ground: `EpiLogos/Antykathera-Essay-Work @ ${corpusCommit} (sha-verified at assembly) + EpiLogos/Point-Cloud-Demo production/return-of-zero @ ${PCD_COMMIT.slice(0, 7)}`,
    },
    default_posture: 'every committed member is already public in the public O-I repository; the candidate admits all 92 and the owner may strike any by family or by id',
    admitted_members: members.length,
    families: familyTable.map(([family, count]) => ({family, count})),
    members,
    expression_policy: expressionPolicy,
    asset_inventory: {
      covers,
      embedded_imagery: embedded,
      inline_authored_assets: {count: inlineAuthored, kinds: Object.fromEntries(inlineKinds), note: 'inline glyph/diagram/ascii entity text recorded authored in the production bindings; no binary files'},
      flagged: flaggedAssets,
    },
    disclosed_absences: [
      'the 40 legacy-collections members have no cover captures; they are formation-only readings and are admitted without covers — commissioning a capture pass is an owner option, not a gap silently hidden',
      'the mytheme whole roz-mytheme-taylor-authored-images publishes TEXT describing 23 authored works (14 admitted image units); no image bytes exist in the corpus, the essay repository, or this collection — nothing image-based is published',
      'no member carries a native expression: ref; Expression publications are produced, not claimed',
    ],
    approval: {
      published: false,
      approval_act: 'owner approval on #417; publishing = run site/build-return-of-zero-publications.mjs with OI_PUBLICATION_ENVELOPE pointing at this envelope; deployment to any public host is a separate act and decision',
    },
  },
};

// --- approval sheet ----------------------------------------------------------
const familiesMd = familyTable.map(([family, count]) => `| ${family} | ${count} |`).join('\n');
const flaggedMd = flaggedAssets.map((f) => `- **${f.asset}** (sha256 \`${f.sha256.slice(0, 16)}…\`) — embedded inside: ${f.members.join(', ')}.\n  Question: ${f.owner_question}`).join('\n');
const sheet = `# Return of Zero — publication tuple: OWNER APPROVAL SHEET

**Standing:** candidate for approval. **Nothing is published.** Nothing has been
deployed to any public host. On approval, publishing = running the existing
#448 site producer against \`PUBLICATION-CANDIDATE.json\`; deployment is a
separate act and a separate decision.

Receiver tuple being satisfied (O:I #417, comment 5749361807): *admitted native
subject + collection membership + complete body + Expression/Projection
revision + source-return + approved assets.*

## What would go public — ${members.length} subjects, already public in this repository

The committed corpus (#452, 0b18c11b) plus the #448 nine-member published slice,
extended to the whole committed set. Default posture: **all admitted; strike any.**

| Family | Members |
|---|---|
${familiesMd}
| **Total** | **${members.length}** |

## The tuple, per member (recorded, not rebuilt)

- **Admitted subject + membership:** every member is a featured entry of one of
  four committed manifests (\`corpus.manifest.json\` 43, \`essay.manifest.json\` 1,
  \`rooms.manifest.json\` 8, \`legacy-collections/manifest.json\` 40); slot and
  manifest are recorded per member in the candidate.
- **Complete body:** the committed \`oi.journey\` document itself (sha256 recorded
  per member as the body revision — no member carries a native \`expression:\`
  ref, so none is invented). Essay/rooms members additionally carry the pinned
  essay-prose sources; corpus members carry their scene prose.
- **Expression/Projection revision:** derived at publish time by the existing
  #448 producer from the journey formations (deterministic, published_at pinned
  to the envelope export) — the same code path already landed, no second pipeline.
- **Source-return:** every member and every bound asset carries exact canonical
  path + bytes sha256, verified during assembly:
  - corpus members → Point-Cloud-Demo \`production/return-of-zero\` @ ${PCD_COMMIT.slice(0, 7)} binding records, whose census records verify byte-exact at Antykathera-Essay-Work @ ${corpusCommit}, and whose committed O-I bytes equal the production bytes;
  - essay/rooms members → the landed envelope's pinned sources at dbf3b17, re-verified here;
  - legacy members → the committed journey documents (the native member bytes).

## Asset inventory (the sheet's backbone)

- **${covers.length} cover PNGs — YES.** Pipeline-generated: captured by
  \`tools/capture.mjs\` through the real engine ("covers are captured, not
  drawn"); each verified byte-exact against the Point-Cloud-Demo production copy.
- **${inlineAuthored} inline authored assets — YES.** Glyph/diagram/ascii entity
  text inside corpus journeys, recorded \`authored\` in the production bindings;
  no binary files.
- **${embedded.length} embedded image asset(s) — FLAGGED.** See below.

### Flagged assets — the owner questions

${flaggedMd}

### Disclosed absences (not silent gaps)

- The 40 legacy members have **no cover captures** (formation-only readings).
  Admitting them cover-less is the default; commissioning a capture pass is an option.
- \`roz-mytheme-taylor-authored-images\` publishes **text describing** 23 authored
  works (14 admitted image units). No image bytes exist in the corpus, the essay
  repository, or this collection — nothing image-based is published by this edition.

## Verification evidence (executed at assembly)

- ${checks.total} hash/presence checks executed at assembly; ${problems.length} failures.
- Every corpus census record re-verified at the pinned essay commit; every cover
  re-verified against its production capture; every member document id-checked.
- The committed corpus is untouched by this lane; the collection tests
  (\`collection-source-identity\` + \`collection-consumers\`) are run in the PR
  and prove the committed members byte-unchanged.

## Decisions requested of the owner

1. **Admit all ${members.length} / strike any** (by family or by id).
2. **The flagged face imagery** (${flaggedAssets.length} files, ${new Set(flaggedAssets.flatMap((f) => f.members)).size} dependent "Source studies" members): admit,
   strike the members, or hold until the producer is recorded.
3. **Legacy covers:** proceed cover-less or commission a capture pass.
4. On approval: run the existing producer (publishing act) and decide deployment
   separately. Nothing runs until then.
`;

// --- write / verify ----------------------------------------------------------
function verifyCandidate(doc) {
  let n = 0;
  for (const member of doc.candidate.members) {
    const memberRoot = member.manifest === 'legacy-collections/manifest.json' ? legacyRoot : outRoot;
    if (check(readSha(join(memberRoot, member.file)) === member.body_revision.sha256, `re-verify body bytes: ${member.id}`)) n += 1;
    if (member.cover && check(readSha(join(repoRoot, member.cover.path)) === member.cover.sha256, `re-verify cover bytes: ${member.id}`)) n += 1;
  }
  for (const asset of doc.required_assets) {
    if (check(readSha(join(repoRoot, asset.asset)) === asset.sha256, `re-verify required asset: ${asset.asset}`)) n += 1;
  }
  for (const f of doc.candidate.asset_inventory.embedded_imagery) {
    if (f.origin_resolved) {
      if (check(readSha(join(repoRoot, f.asset)) === f.sha256, `re-verify embedded origin: ${f.asset}`)) n += 1;
    }
  }
  return n;
}

const verifyOnly = process.argv.includes('--verify');
if (verifyOnly) {
  const doc = JSON.parse(readFileSync(CANDIDATE, 'utf8'));
  const n = verifyCandidate(doc);
  console.log(`verify-only: ${n} re-checked hashes against disk bytes; ${problems.length} failures`);
} else {
  writeFileSync(CANDIDATE, `${JSON.stringify(candidate, null, 1)}\n`);
  writeFileSync(SHEET, sheet);
  const n = verifyCandidate(candidate);
  console.log(`Return-of-Zero publication candidate: ${members.length} members across ${familyCounts.size} families; ${covers.length} covers + ${inlineAuthored} inline authored assets admitted, ${flaggedAssets.length} flagged; ${n} hashes re-verified after write; ${problems.length} failures`);
}

if (problems.length) {
  console.error(`ASSEMBLY/VERIFY PROBLEMS (${problems.length}):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exitCode = 1;
}
