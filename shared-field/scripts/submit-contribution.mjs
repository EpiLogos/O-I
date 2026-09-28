#!/usr/bin/env node
/**
 * Submit a participant Agent's work to a shared undertaking as attributable
 * Contributions through the participant's own transport:
 *
 *   node shared-field/scripts/submit-contribution.mjs --context DIR/context.json --result DIR/contribution.json
 *     --agent <agent ref> [--execution <session ref>] [--client <field client>] [--dry-run]
 *
 * The result file is the Agent's own output: {explanation_markdown,
 * relation_proposal:{relation_kind, from, to, summary}, sections_read}.
 * `from`/`to` name source records by their corpus id (A04, A04p) and resolve
 * against the context's shared sources. Each Contribution carries the basis
 * the Agent actually read (source ref + revision, Projection ref + revision),
 * so the owner can refuse a stale basis on Return. Both enter quarantine.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { participantContributions } from '../participant-context.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const contextPath = flag('--context');
const resultPath = flag('--result');
const agent = flag('--agent');
const execution = flag('--execution');
const client = flag('--client') ?? join(here, '..', 'spacetimedb', 'field.sh');
if (!contextPath || !resultPath || !agent) throw new Error('--context, --result and --agent are required');

const context = JSON.parse(readFileSync(contextPath, 'utf8'));
const result = JSON.parse(readFileSync(resultPath, 'utf8'));
const contributions = participantContributions({ context, result, agent_ref: agent, execution_ref: execution, created_at: new Date().toISOString() });
if (argv.includes('--dry-run')) { console.log(JSON.stringify(contributions, null, 2)); process.exit(0); }

const receipts = contributions.map((contribution) => {
  const envelope = JSON.parse(execFileSync(client, { input: JSON.stringify({ kind: 'contribute', contribution, transport_message_id: `msg:${contribution.contribution_ref}` }), stdio: ['pipe', 'pipe', 'ignore'] }).toString());
  return { contribution_ref: contribution.contribution_ref, body_kind: contribution.representation.payload.kind, ok: envelope.ok, ...(envelope.ok ? { result: envelope.data } : { error: envelope.error }) };
});
console.log(JSON.stringify({ schema: 'oi.participant-submission/v1', field_ref: context.field_ref, participant_ref: context.participant_ref, agent_ref: agent, receipts }, null, 2));
if (receipts.some((receipt) => !receipt.ok)) process.exit(1);
