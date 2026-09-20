// export-return-of-zero-publication — the DELIBERATELY PUBLISHED slice of the
// Return-of-Zero corpus as Central-backed collection manifests (track 3,
// 2026-09-19, for the O:I Web/SharedField site lane).
//
// What is published is the essay's own publication surfaces — the sovereign
// essay reading and the eight section rooms (publication surfaces #0/#5) —
// nothing else. The other corpus families (arguments, episteme, matheme,
// symbolon, mytheme) stay local until the owner admits them; no Nara,
// personal or credential material is referenced.
//
// Members are copied beside the manifests so the manifest-relative member
// paths never cross upward (the collection reader's own law). Rerunnable:
//
//   node scripts/export-return-of-zero-publication.mjs
//
// Outputs (all under collections/return-of-zero/):
//   essay.manifest.json  rooms.manifest.json   — oi.legacy-collections/v1
//   essay/<artifact>.journey.json + covers     — member copies, byte-exact
//   PUBLICATION.json                           — the site lane's contract
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const corpusRoot = resolve(appRoot, '../../../../Point-Cloud-Demo/production/return-of-zero');
const essayRepo = resolve(appRoot, '../../../Antykathera-Essay-Work'); // Work/O-I/Antykathera-Essay-Work
const outRoot = join(appRoot, 'collections', 'return-of-zero');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const exported = new Date().toISOString();

function listArtifacts(root, base = '') {
  const out = [];
  for (const entry of readdirSync(join(root, base), {withFileTypes: true})) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listArtifacts(root, rel));
    else if (entry.name.endsWith('.journey.json')) out.push(rel);
  }
  return out;
}

// The corpus bindings carry the accepted source revision (dbf3b17) and the
// per-record canonical paths + sha256s the publication contract cites.
const bindings = new Map();
for (const name of readdirSync(join(corpusRoot, 'bindings'))) {
  if (!name.endsWith('.binding.json')) continue;
  const binding = JSON.parse(readFileSync(join(corpusRoot, 'bindings', name), 'utf8'));
  if (binding.artifact) bindings.set(binding.artifact, binding);
}

const PUBLISHED = [
  {family: 'essay', members: ['essay/roz-essay-reading.journey.json']},
  {family: 'rooms', members: listArtifacts(corpusRoot).filter((rel) => rel.startsWith('rooms/'))},
];

const publication = {
  schema: 'oi.collection-publication/v1',
  exported_at: exported,
  title: 'Return of Zero — the published reading',
  standing: 'deliberately published collection/edition outputs for the O:I Web/SharedField site lane; the owner remains the recognition authority for anything beyond these surfaces',
  source_revision: {repo: 'EpiLogos/Antykathera-Essay-Work', commit: 'dbf3b17'},
  corpus: {repo: 'EpiLogos/Point-Cloud-Demo', path: 'production/return-of-zero', engine_revision: 'oi.journey v1 (validated by production/return-of-zero/tools/validate.mjs)'},
  manifests: [],
  required_assets: [],
  browser_operations: {
    open_expression: 'collection member journeys open through the Expressions application’s own import (oi.journey v1) and present on the one Global Expression Stage',
    read_scenes: 'scene traversal with per-scene text/material composition',
    front_verso: 'face/verso account of the same Expression identity',
    offline: 'an unreachable ground degrades to a NAMED absence (manifest-absent / unavailable); nothing is fabricated',
  },
  degradation_states: [
    'manifest absent — Central lists the collections directory without this manifest (named, not guessed)',
    'member unreadable — a member file missing or refused carries the owner’s refusal verbatim beside the members that returned',
    'engine absent — the page renders the manifest and covers without the live particle engine; no silent substitution',
    'private material — absent from these manifests by construction (only the essay’s own publication surfaces are published)',
  ],
};

for (const {family, members} of PUBLISHED) {
  const familyDir = join(outRoot, family);
  mkdirSync(familyDir, {recursive: true});
  const entries = [];
  const sourceRecords = [];
  for (const rel of members) {
    const dest = join(outRoot, rel);
    copyFileSync(join(corpusRoot, rel), dest);
    const doc = JSON.parse(readFileSync(join(corpusRoot, rel), 'utf8'));
    entries.push({id: doc.id, name: doc.name ?? doc.id, file: rel});
    const cover = join(corpusRoot, rel.replace(/\.journey\.json$/, '.cover.png'));
    if (existsSync(cover)) {
      copyFileSync(cover, dest.replace(/\.journey\.json$/, '.cover.png'));
      publication.required_assets.push({asset: `collections/return-of-zero/${rel.replace(/\.journey\.json$/, '.cover.png')}`, sha256: sha256(readFileSync(cover))});
    }
    const binding = bindings.get(rel);
    for (const record of binding?.source_revision?.records ?? []) {
      const canonical = join(essayRepo, record.path);
      const actual = sha256(readFileSync(canonical));
      if (actual !== record.sha256) {
        throw new Error(`source drifted from its binding: ${record.path} (${actual.slice(0, 12)}… vs ${record.sha256.slice(0, 12)}…) — refresh the corpus bindings before publishing`);
      }
      sourceRecords.push({path: record.path, sha256: record.sha256, artifact: rel});
    }
  }
  const manifest = {
    schema: 'oi.legacy-collections/v1',
    exported_at: exported,
    source: `Return of Zero — published ${family} surfaces`,
    provenance: {
      schema: 'oi.collection-provenance/v1',
      register: 'project',
      root: 'Work/O-I',
      paths: [`Work/O-I/desktop/cradle/expressions-app/collections/return-of-zero`],
      ground: 'EpiLogos/Point-Cloud-Demo production/return-of-zero (E0 corpus) + EpiLogos/Antykathera-Essay-Work sources at dbf3b17 (sha-verified at export)',
      exported_at: exported,
      generator: {name: 'scripts/export-return-of-zero-publication.mjs', revision: 'track3-2026-09-19'},
      source_revision: {repo: 'EpiLogos/Antykathera-Essay-Work', commit: 'dbf3b17'},
    },
    featured: entries,
  };
  writeFileSync(join(outRoot, `${family}.manifest.json`), JSON.stringify(manifest, null, 2));
  publication.manifests.push({
    manifest: `collections/return-of-zero/${family}.manifest.json`,
    members: entries.length,
    member_paths: entries.map((entry) => `collections/return-of-zero/${entry.file}`),
    source_bindings: sourceRecords,
  });
}

writeFileSync(join(outRoot, 'PUBLICATION.json'), JSON.stringify(publication, null, 2));
console.log(`published ${publication.manifests.length} manifests, ${publication.manifests.reduce((n, m) => n + m.members, 0)} members, ${publication.required_assets.length} covers — sources sha-verified at ${publication.source_revision.commit}`);
