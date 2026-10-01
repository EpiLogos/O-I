/** Actual pinned input/producer/receiver proof; no fixture substitute or skip. */
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePublications } from './build-publications.mjs';
import { selectPublicExcerpt } from './public-excerpt-selection.mjs';
import { validateJourney } from '../packages/oi-design-system/expressions-engine/shell/model.mjs';

const site = dirname(fileURLToPath(import.meta.url));
const root = process.env.OI_PCD_S_PRODUCTS_ROOT;
if (!root) throw new Error('The actual pinned native S-product corpus is required.');
const spec = JSON.parse(await readFile(resolve(site, 'public-excerpt-selection.json'), 'utf8'));
const actualRevision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const outputs = resolve(site, 'publications/return-of-zero-curated');
const files = (await readdir(outputs)).filter(name => /^expression-.*\.json$/.test(name));
assert.equal(files.length, 135, 'all required native members remain published');
const records = [];
for (const member of spec.members) {
  assert.equal(actualRevision, member.source_revision);
  const raw = await readFile(resolve(root, member.source_file));
  const original = JSON.parse(raw);
  validateJourney(original);
  const selected = selectPublicExcerpt({ id: member.member_id, file: member.source_file, sourceRevision: actualRevision }, raw);
  const publication = JSON.parse(await readFile(resolve(outputs, `expression-${member.member_id}.json`), 'utf8'));
  assert.equal(publication.native_body.bytes, selected.bytes.toString('utf8'));
  assert.equal(publication.native_body.source_revision, selected.source_revision);
  assert.ok(publication.projection.provenance.some(source => source.ref === member.source_file && source.revision === actualRevision));
  const formed = JSON.parse(publication.native_body.bytes);
  validateJourney(formed);
  delete formed.publication_excerpt;
  for (const field of member.fields) for (const value of [original, formed]) {
    const keys = field.pointer.slice(1).split('/');
    const target = keys.slice(0, -1).reduce((v, key) => v[key], value);
    delete target[keys.at(-1)];
  }
  assert.deepEqual(formed, original, 'only explicitly selected text fields differ; complete native formations remain');
  assert.equal(compilePublications([publication]).editions.length, 1, 'the real public variant is admitted');
  const prior = structuredClone(publication);
  prior.native_body.bytes = raw.toString('utf8');
  prior.native_body.digest.value = createHash('sha256').update(raw).digest('hex');
  prior.native_body.source_path = member.source_file;
  prior.native_body.source_revision = actualRevision;
  assert.throws(() => compilePublications([prior]), /failed public admission/, 'the original unselected body remains refused');
  assert.throws(() => selectPublicExcerpt({ id: member.member_id, file: member.source_file, sourceRevision: actualRevision }, Buffer.concat([raw, Buffer.from('\n')])), /source drift/);
  records.push({ member: member.member_id, source_digest: member.source_sha256, public_digest: publication.native_body.digest.value, source_revision: actualRevision, public_revision: publication.native_body.source_revision, selected_fields: member.fields.length });
}
await mkdir(resolve(site, 'evidence/public-excerpts'), { recursive: true });
const receipt = { passed: true, standing: 'Actual pinned native inputs, production producer and strict receiver; source evidence, not installed or human acceptance.', members: files.length, changed_members: records.length, records };
await writeFile(resolve(site, 'evidence/public-excerpts/native.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
