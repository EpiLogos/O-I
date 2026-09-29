#!/usr/bin/env node
/**
 * Prepare the scoped context a participant's own Agent receives for one
 * shared undertaking — composed ONLY from what this participant's transport
 * can read in the field (snapshot + FieldNow + the Projections' own
 * payloads), never from the publisher's ground or a verifier's notes.
 *
 *   node shared-field/scripts/participant-context.mjs --field <field_ref> --participant <participant_ref> --out DIR
 *     [--client <field client executable>]   default: spacetimedb/field.sh beside this script
 *
 * Writes DIR/context.json (`oi.shared-field-participant-context/v1`) and
 * DIR/CONTEXT.md (the same reading as prose for the Agent's prompt).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { participantContext, participantContextMarkdown } from '../participant-context.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const field = flag('--field');
const participant = flag('--participant');
const out = flag('--out');
const client = flag('--client') ?? join(here, '..', 'spacetimedb', 'field.sh');
if (!field || !participant || !out) throw new Error('--field, --participant and --out are required');

const call = (request) => {
  const envelope = JSON.parse(execFileSync(client, { input: JSON.stringify(request), stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString());
  if (!envelope.ok) throw new Error(`${request.kind} refused: ${envelope.error?.message}`);
  return envelope.data;
};

const snapshot = call({ kind: 'snapshot' });
const context = participantContext({ snapshot, field_ref: field, participant_ref: participant, prepared_at: new Date().toISOString() });
mkdirSync(resolve(out), { recursive: true });
writeFileSync(join(out, 'context.json'), `${JSON.stringify(context, null, 2)}\n`);
writeFileSync(join(out, 'CONTEXT.md'), participantContextMarkdown(context));
console.log(JSON.stringify({ schema: context.schema, field_ref: context.field_ref, participant_ref: context.participant_ref, basis: context.basis, sources: context.sources.map((s) => ({ ref: s.artifact_ref, source_revision: s.source_revision, sections: s.sections.length })), constituents: context.constituents.length, out: resolve(out) }, null, 2));
