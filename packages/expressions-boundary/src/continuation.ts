import {
  boundedText, expressionRef, object, positiveInteger,
  type ChannelContext, type ExpressionsOwners,
} from './protocol.ts';

/** The host chooses native identities. Captured bases are optional guards for
 * exact revision acceptance; ordinary continuation reads the owner's latest
 * acknowledged checkpoint at this same identity. No document lives here. */
export interface ConfiguredWork {
  scope: 'expressions' | 'techne';
  checkpoint_id: string;
  expression_ref: string;
  expected_basis?: {storage_revision: number; document_revision: number};
}
export interface ContinuedWork {
  scope: ConfiguredWork['scope'];
  checkpoint_id: string;
  expression_ref: string;
  storage_revision: number;
  document_revision: number;
  pending_retained: boolean;
}
export interface WorksContinuation {
  schema: 'oi.expression-continuation/v1';
  state: 'ready';
  works: ContinuedWork[];
}

function current(context: ChannelContext) {
  context.signal.throwIfAborted();
  if (!context.current()) throw Error('The startup context changed; read configured work again');
}
function qualify(works: unknown): asserts works is readonly ConfiguredWork[] {
  if (!Array.isArray(works) || works.length === 0 || works.length > 64) {
    throw Error('Configure between one and 64 retained native work identities');
  }
  const seen = new Set<string>();
  for (const work of works) {
    if (!object(work) || (work.scope !== 'expressions' && work.scope !== 'techne')
      || !expressionRef(work.expression_ref) || !/^expression:[a-zA-Z0-9_.-]{1,128}$/.test(work.expression_ref)
      || work.checkpoint_id !== work.expression_ref) {
      throw Error('Configured work must name an exact canonical checkpoint and Expression ref');
    }
    if (seen.has(work.expression_ref)) throw Error('Choose one explicit checkpoint for each native Expression');
    seen.add(work.expression_ref);
    if (work.expected_basis !== undefined && (!object(work.expected_basis)
      || !positiveInteger(work.expected_basis.storage_revision)
      || !positiveInteger(work.expected_basis.document_revision))) {
      throw Error('A captured work basis needs positive storage and document revisions');
    }
  }
}

/** Call before mounting the retained iframe. Recovery is read-only; its
 * private pending request and mode-local Journey never enter an operation.
 * Only the native Document goes to its existing Expression Open owner. That
 * owner keeps validation, budgets, idempotency and open-draft conflict law.
 * A partial native opening is retained if a later owner refuses; callers
 * must show that refusal and keep the mount gated, never fabricate rollback. */
export async function reopenConfiguredWorks(
  owners: ExpressionsOwners,
  context: ChannelContext,
  works: unknown,
): Promise<WorksContinuation> {
  qualify(works);
  if (!boundedText(context.bindingId, 256)) throw Error('Native startup needs a bounded host binding');
  const recovery = owners.channels['expression-recovery'];
  const expression = owners.channels['kernel-expression'];
  if (!recovery || !expression) throw Error(owners.unavailableReason ?? 'Native recovery and Expression owners are required');
  current(context);
  const prepared: {work: ConfiguredWork; document: Record<string, unknown>; result: ContinuedWork}[] = [];
  // Read and qualify every configured source before any native Open.
  for (const work of works) {
    const scoped = {...context, mode: work.scope};
    current(context);
    const reading = await recovery({operation: 'read', scope: work.scope, kind: 'checkpoint', id: work.checkpoint_id}, scoped);
    current(context);
    if (!object(reading) || reading.schema !== 'oi.expression-recovery/v1' || reading.state !== 'ready'
      || !object(reading.record)) throw Error(`The native owner has no configured checkpoint ${work.checkpoint_id}`);
    const record = reading.record;
    if (record.scope !== work.scope || record.kind !== 'checkpoint' || record.id !== work.checkpoint_id
      || !positiveInteger(record.revision) || !object(record.value)
      || record.value.schema !== 'oi.native-working/v1' || record.value.draft_id !== work.checkpoint_id
      || !object(record.value.view) || !object(record.value.view.document)) {
      throw Error(`The native owner returned a different checkpoint identity for ${work.expression_ref}`);
    }
    const document = record.value.view.document;
    if (document.schema !== 'oi.expression/v1' || document.expression_ref !== work.expression_ref
      || !positiveInteger(document.revision)) throw Error(`The retained Document does not address ${work.expression_ref}`);
    if (work.expected_basis && (record.revision !== work.expected_basis.storage_revision
      || document.revision !== work.expected_basis.document_revision)) {
      throw Error(`The retained source revision changed for ${work.expression_ref}; choose its current acknowledged basis`);
    }
    prepared.push({work, document, result: {scope: work.scope, checkpoint_id: work.checkpoint_id,
      expression_ref: work.expression_ref, storage_revision: record.revision,
      document_revision: document.revision, pending_retained: record.value.pending != null}});
  }
  for (const {work, document} of prepared) {
    current(context);
    const opened = await expression({operation: 'open', document, actor: `host:${context.bindingId}`}, {...context, mode: work.scope});
    current(context);
    if (!object(opened) || opened.state !== 'ready') {
      const state = object(opened) && boundedText(opened.state, 128) ? opened.state : 'invalid acknowledgement';
      throw Error(`Native Expression Open refused ${work.expression_ref}: ${state}`);
    }
    if (!object(opened.document) || opened.document.schema !== 'oi.expression/v1'
      || opened.document.expression_ref !== work.expression_ref || opened.document.revision !== document.revision) {
      throw Error(`Native Expression Open did not acknowledge the retained basis for ${work.expression_ref}`);
    }
  }
  current(context);
  return {schema: 'oi.expression-continuation/v1', state: 'ready', works: prepared.map(row => row.result)};
}
