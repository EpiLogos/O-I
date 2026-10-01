import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const selectionBytes = readFileSync(new URL('./public-excerpt-selection.json', import.meta.url));
const selection = JSON.parse(selectionBytes);
export const publicExcerptSelectionRevision = `sha256:${digest(selectionBytes)}`;
export const publicExcerptSelectionRef = 'site/public-excerpt-selection.json';
export const publicExcerptMemberIds = Object.freeze(selection.members.map(member => member.member_id));
if (selection.schema !== 'oi.public-excerpt-selection/v1' || new Set(publicExcerptMemberIds).size !== selection.members.length) {
  throw new Error('Invalid explicit public excerpt selection.');
}
const members = new Map(selection.members.map(member => [member.member_id, member]));
const decoder = new TextDecoder('utf-8', { fatal: true });

/** Select only recorded original bytes. No runtime search, redaction or rewrite. */
export function selectPublicExcerpt(member, sourceBytes) {
  const selected = members.get(member.id);
  if (!selected) return null;
  if (member.file !== selected.source_file || member.sourceRevision !== selected.source_revision || digest(sourceBytes) !== selected.source_sha256) {
    throw new Error(`Public excerpt source drift for ${member.id}; reconcile the explicit selection before publishing.`);
  }
  const journey = JSON.parse(sourceBytes.toString('utf8'));
  if (journey.id !== member.id) throw new Error(`Public excerpt identity differs for ${member.id}.`);
  const seen = new Set();
  for (const field of selected.fields) {
    if (!/^\/scenes\/\d+\/(?:character|text\/\d+\/body)$/.test(field.pointer) || seen.has(field.pointer)) {
      throw new Error(`Invalid public excerpt field for ${member.id}.`);
    }
    seen.add(field.pointer);
    const keys = field.pointer.slice(1).split('/');
    const target = keys.slice(0, -1).reduce((value, key) => value?.[key], journey);
    const key = keys.at(-1), original = target?.[key];
    if (typeof original !== 'string' || digest(Buffer.from(original)) !== field.source_sha256) {
      throw new Error(`Public excerpt field drift for ${member.id}${field.pointer}.`);
    }
    const bytes = Buffer.from(original);
    let previousEnd = 0;
    const fragments = field.utf8_ranges.map(([start, end]) => {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < previousEnd || end <= start || end > bytes.length) {
        throw new Error(`Invalid public excerpt range for ${member.id}${field.pointer}.`);
      }
      previousEnd = end;
      return decoder.decode(bytes.subarray(start, end));
    });
    if (!fragments.join('').trim()) throw new Error(`Empty public excerpt for ${member.id}${field.pointer}.`);
    target[key] = fragments.join('');
  }
  journey.publication_excerpt = {
    schema: 'oi.public-excerpt-variant/v1',
    source_file: selected.source_file,
    source_revision: selected.source_revision,
    source_digest: { algorithm: 'sha256', value: selected.source_sha256 },
    selection_ref: publicExcerptSelectionRef,
    selection_revision: publicExcerptSelectionRevision,
  };
  const bytes = Buffer.from(JSON.stringify(journey, null, 2) + '\n');
  return {
    journey, bytes,
    source_path: `site/.public-excerpt-inputs/${member.id}.journey.json`,
    source_revision: `sha256:${digest(bytes)}`,
    provenance: journey.publication_excerpt,
  };
}
