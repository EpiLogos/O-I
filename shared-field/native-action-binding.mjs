import { spawn } from 'node:child_process';
import { createActivity } from './activity.mjs';
import { validateWorldPresentation } from './presentation.mjs';

/**
 * Native Action binding from an authored Explore/WorldPresentation binding.
 *
 * An `action_ref` disclosed on a presentation binding names a canonical Action
 * owned by a native product. The grammar is `<owner>:action:<action id>`;
 * the owner's own command-line doorway is the only handler:
 *
 *   central:action:projectcentral.now.return   →  ctrl --json action run projectcentral.now.return <json>
 *   aikit:action:<id>                          →  aikit --json <id> ...      (not yet bound)
 *
 * Nothing here executes an Action that the binding did not disclose, supplies a
 * handler of its own, or promotes a provider event into an Action. The result
 * of invocation is the owner's own envelope; O:I represents it as Activity with
 * the canonical `action_ref`, `result_refs` and `evidence_refs` the owner
 * returned. Authority is the owner's: a refusal by the owner is returned as a
 * refusal, never retried around.
 */
export const ACTION_REF_PATTERN = /^([a-z][a-z0-9-]*):action:([a-z][a-z0-9.-]*)$/;

const OWNER_HANDLERS = Object.freeze({
  central: Object.freeze({ command: 'ctrl', args: (action, input) => ['--json', 'action', 'run', action, JSON.stringify(input)] }),
});

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

export function parseActionRef(actionRef) {
  const match = ACTION_REF_PATTERN.exec(String(actionRef ?? ''));
  if (!match) throw new TypeError(`Unsupported action ref: ${actionRef}`);
  return { action_ref: actionRef, owner: match[1], action: match[2] };
}

/**
 * Resolve the Action a binding discloses. The binding must carry the ref in its
 * `props.action_refs` (authored) — presence in the contribution field alone is
 * not a binding.
 */
export function resolveBoundAction(presentationValue, bindingRef, actionRef) {
  const presentation = validateWorldPresentation(presentationValue);
  for (const region of presentation.regions) {
    const binding = region.bindings.find((candidate) => candidate.binding_ref === bindingRef);
    if (!binding) continue;
    const disclosed = Array.isArray(binding.props.action_refs) ? binding.props.action_refs.filter((value) => typeof value === 'string') : [];
    if (!disclosed.includes(actionRef)) {
      return { bound: false, reason: `Binding ${bindingRef} does not disclose ${actionRef}`, binding_ref: bindingRef, region_ref: region.region_ref, disclosed };
    }
    const parsed = parseActionRef(actionRef);
    const handler = OWNER_HANDLERS[parsed.owner];
    if (!handler) return { bound: false, reason: `No native owner handler is bound for ${parsed.owner}`, binding_ref: bindingRef, region_ref: region.region_ref, disclosed };
    return { bound: true, ...parsed, binding_ref: bindingRef, region_ref: region.region_ref, subject_ref: binding.subject_ref ?? presentation.world_ref, handler: { command: handler.command } };
  }
  return { bound: false, reason: `Unknown presentation binding: ${bindingRef}`, binding_ref: bindingRef, disclosed: [] };
}

/** Default executor: run the owner's command and parse its JSON envelope. */
export function nativeCommandExecutor({ cwd, env } = {}) {
  return (command, args) => new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...(env ?? {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ exit_code: null, stdout, stderr: `${stderr}${error.message}`, spawn_error: error.message }));
    child.on('close', (code) => resolve({ exit_code: code, stdout, stderr }));
  });
}

function parseEnvelope(stdout) {
  try {
    const value = JSON.parse(stdout);
    return record(value, 'owner envelope');
  } catch {
    return null;
  }
}

/**
 * Invoke one bound Action through its owner and return the owner's result
 * together with an `oi.activity/v1` observation carrying the canonical ref.
 */
export async function invokeBoundAction(bound, input, context) {
  record(bound, 'bound action');
  if (bound.bound !== true) throw new TypeError(`Action is not bound: ${bound.reason}`);
  record(input, 'action input');
  const ctx = record(context, 'invocation context');
  const executor = typeof ctx.executor === 'function' ? ctx.executor : nativeCommandExecutor({ cwd: ctx.cwd });
  const handler = OWNER_HANDLERS[bound.owner];
  const args = handler.args(bound.action, input);
  const startedAt = new Date().toISOString();
  const run = await executor(handler.command, args);
  const envelope = parseEnvelope(run.stdout ?? '');
  const ok = envelope?.ok === true && (run.exit_code === 0 || run.exit_code === null && envelope !== null);
  const data = envelope?.data && typeof envelope.data === 'object' ? envelope.data : {};
  const resultRefs = typeof ctx.result_refs_from === 'function' ? ctx.result_refs_from(data) : [];
  const evidenceRefs = Array.isArray(ctx.evidence_refs) ? ctx.evidence_refs : [];
  const activity = createActivity({
    activity_ref: `activity:${bound.owner}:${bound.action}:${Date.parse(startedAt).toString(36)}`,
    native_owner: bound.owner,
    ...(ctx.actor_ref ? { actor_ref: ctx.actor_ref } : {}),
    subject: { kind: ctx.subject_kind ?? 'oi.presentation-binding', ref: bound.subject_ref },
    action_ref: bound.action_ref,
    ...(envelope?.action ? { invocation_ref: `${bound.owner}:invocation:${envelope.action}:${Date.parse(startedAt).toString(36)}` } : {}),
    verb: bound.action,
    object_ref: bound.subject_ref,
    semantic_summary: ok
      ? `${bound.owner} performed ${bound.action} for ${bound.subject_ref}`
      : `${bound.owner} refused or failed ${bound.action} for ${bound.subject_ref}`,
    phase: ok ? 'completed' : 'failed',
    outcome: ok ? { ok: true, status: envelope.status ?? 'success' } : { ok: false, status: envelope?.status ?? 'error', exit_code: run.exit_code, error: envelope?.error ?? envelope?.message ?? (run.stderr || run.stdout || '').slice(0, 500) },
    needs_attention: !ok,
    result_refs: resultRefs,
    evidence_refs: evidenceRefs,
    started_at: startedAt,
    updated_at: new Date().toISOString(),
    provenance: [
      { kind: 'presentation-binding', ref: bound.binding_ref, source_system: 'o-i' },
      { kind: 'native-owner-envelope', ref: `${bound.owner}:${bound.action}`, source_system: bound.owner },
      ...(Array.isArray(ctx.provenance) ? ctx.provenance : []),
    ],
  });
  return { ok, envelope, run: { exit_code: run.exit_code, stderr: run.stderr }, activity };
}
