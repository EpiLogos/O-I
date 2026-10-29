import type {RecoveryBinding} from '../../../desktop/cradle/src/expressions/recoveryTypes';
export type {RecoveryBinding} from '../../../desktop/cradle/src/expressions/recoveryTypes';
import {boundedText, expressionRef, object, positiveInteger} from './protocol.ts';

/** A host-selected native recovery address. Presentation mode is not part of
 * its authority. No working document or pending operation is copied here. */
const nativeId = (value: unknown): value is string => boundedText(value, 160)
  && /^[a-zA-Z0-9_.:-]+$/.test(value);
export function assertRecoveryBinding(value: unknown): asserts value is RecoveryBinding {
  if (!object(value) || (value.scope !== 'expressions' && value.scope !== 'techne')
    || !nativeId(value.checkpoint_id) || !expressionRef(value.expression_ref)) {
    throw Error('Choose a bounded native recovery scope, checkpoint id and Expression ref');
  }
}

/** The canonical native Expression reference: the configured-work grammar (continuation.ts) and the owner's own
 * (expression_recovery.rs `reference`). */
const canonicalRef = (value: string) => /^expression:[a-zA-Z0-9_.-]{1,128}$/.test(value);
/** Configured plus selected addresses one retained host holds: the frame's own binding inventory (nativeRecovery.ts). */
const MAX_ADDRESSES = 256;

export interface RecoveryAdmissionOptions {
  /** T-RECOVERY-FOR-OPENED-WORKS: the host selects the address of an Expression it opens itself and holds no configured
   * address for — its canonical checkpoint in the Expressions scope, `{scope: 'expressions', checkpoint_id: ref,
   * expression_ref: ref}`. A configured address always wins and is never replaced. */
  selectOpened?: boolean;
}

/** Routing metadata only. The native owner retains every byte and CAS basis. */
export class RecoveryAdmission {
  readonly configured: boolean;
  private readonly selectsOpened: boolean;
  private readonly bindings = new Map<string, RecoveryBinding>();
  private readonly drafts = new Map<string, RecoveryBinding>();

  constructor(bindings?: readonly RecoveryBinding[], options: RecoveryAdmissionOptions = {}) {
    this.selectsOpened = options.selectOpened === true;
    this.configured = bindings !== undefined || this.selectsOpened;
    if (bindings !== undefined && (!Array.isArray(bindings) || bindings.length > 64)) {
      throw Error('A retained host accepts at most 64 selected recovery addresses');
    }
    const addresses = new Set<string>();
    for (const raw of bindings ?? []) {
      assertRecoveryBinding(raw);
      const address = this.key(raw.scope, raw.checkpoint_id);
      if (this.bindings.has(raw.expression_ref) || addresses.has(address)) {
        throw Error('Choose one explicit recovery address for each native Expression');
      }
      addresses.add(address);
      this.bindings.set(raw.expression_ref, Object.freeze({scope: raw.scope,
        checkpoint_id: raw.checkpoint_id, expression_ref: raw.expression_ref}));
    }
  }

  binding(reference: string): RecoveryBinding | undefined {
    const binding = this.bindings.get(reference) ?? this.selectOpened(reference);
    if (!binding && this.configured) throw Error('This native Expression has no host-selected recovery address');
    return binding ? {...binding} : undefined;
  }

  /** The address of an Expression this host opens itself with no configured address: its canonical checkpoint (id = ref)
   * in the Expressions scope. Deterministic, so the boot query and the host agree without a table and the same work
   * meets its own checkpoint after a restart. The owner keeps a checkpoint's id, its draft id and its Journey id equal
   * (expression_recovery.rs `validate`), and the frame names an owner Document's Journey by its ref, so this is the one
   * address the frame's first checkpoint of that Document can be written at. Whether a checkpoint stands there is the
   * owner's answer, read before anything is written. */
  private selectOpened(reference: string): RecoveryBinding | undefined {
    if (!this.selectsOpened || !canonicalRef(reference)) return;
    const address = this.key('expressions', reference);
    if ([...this.bindings.values()].some(binding => this.key(binding.scope, binding.checkpoint_id) === address)) {
      throw Error('The opened Expression\'s canonical recovery address is held by another selected work');
    }
    if (this.bindings.size >= MAX_ADDRESSES) throw Error(`A retained host selects at most ${MAX_ADDRESSES} recovery addresses; reopen the application`);
    const selected: RecoveryBinding = Object.freeze({scope: 'expressions', checkpoint_id: reference, expression_ref: reference});
    this.bindings.set(reference, selected);
    return selected;
  }

  initial(value?: RecoveryBinding): RecoveryBinding | undefined {
    if (value === undefined) return;
    assertRecoveryBinding(value);
    const selected = this.binding(value.expression_ref);
    if (!selected || selected.scope !== value.scope || selected.checkpoint_id !== value.checkpoint_id) {
      throw Error('The initial native work does not match its host-selected recovery address');
    }
    return selected;
  }

  private key(scope: string, id: string) {return `${scope}:${id}`;}
  private sameAddress(a: RecoveryBinding | undefined, b: RecoveryBinding) {
    return !!a && a.scope === b.scope && a.checkpoint_id === b.checkpoint_id && a.expression_ref === b.expression_ref;
  }
  private selected(scope: string, kind: string, id: string): RecoveryBinding | undefined {
    return kind === 'draft' ? this.drafts.get(this.key(scope, id))
      : [...this.bindings.values()].find(binding => binding.scope === scope && binding.checkpoint_id === id);
  }

  /** The kept drafts of a selected work (E19, expression_recovery.rs DraftQuarantine): one owner record per Expression, keyed by
   * its ref, in the scope its address names. Only an Expression this host already selected has them; no address is selected
   * here. */
  private quarantined(scope: unknown, reference: unknown): RecoveryBinding {
    const binding = typeof reference === 'string' ? this.bindings.get(reference) : undefined;
    if (!binding || binding.scope !== scope) throw Error('The kept drafts are outside the host-selected address of this Expression');
    return binding;
  }

  /** O-I #763: keep a draft in, or clear one from, the owner's quarantine of a selected work. A keep names a draft its address
   * holds (a checkpoint read there proved it, as for a draft write); a clear names one entry by its identity (the digest of its
   * text). The owner keeps the bytes, the compare-and-set and every bound. */
  private admitQuarantine(request: Record<string, unknown>): RecoveryBinding {
    const binding = this.quarantined(request.scope, request.expression_ref);
    if (request.operation === 'keep_draft_quarantine') {
      if (!nativeId(request.draft_id) || !this.sameAddress(this.drafts.get(this.key(binding.scope, request.draft_id)), binding)) {
        throw Error('The kept draft is not the draft of the selected native work; read its checkpoint first');
      }
      if (typeof request.text !== 'string' || !request.text || !boundedText(request.reason, 4096)) throw Error('A kept draft carries its verbatim text and its reason');
      if (request.expected_revision !== null && !positiveInteger(request.expected_revision)) throw Error('A kept draft names the revision basis of its quarantine');
    } else {
      if (typeof request.entry_id !== 'string' || !/^[0-9a-f]{64}$/.test(request.entry_id)) throw Error('Choose a kept draft by its exact identity');
      if (!positiveInteger(request.expected_revision)) throw Error('A cleared draft names the revision basis of its quarantine');
    }
    return binding;
  }

  /** Return the immutable address captured before asynchronous owner work. */
  admit(request: unknown): RecoveryBinding | undefined {
    if (!this.configured || !this.bindings.size) throw Error('No host-selected native recovery address is attached');
    if (!object(request) || (request.scope !== 'expressions' && request.scope !== 'techne')) {
      throw Error('A native recovery request must name its selected scope');
    }
    if (request.operation === 'find_checkpoint') throw Error('Read the host-selected checkpoint by its exact id');
    if (request.operation === 'keep_draft_quarantine' || request.operation === 'remove_draft_quarantine') return this.admitQuarantine(request);
    if (request.operation === 'read' && request.kind === 'draft_quarantine') return this.quarantined(request.scope, request.id);
    if (!['read', 'write', 'remove', 'list'].includes(String(request.operation))
      || (request.kind !== 'draft' && request.kind !== 'checkpoint')) {
      throw Error('Unsupported native recovery operation');
    }
    if (request.operation === 'list') {
      if (![...this.bindings.values()].some(binding => binding.scope === request.scope)) {
        throw Error('This recovery scope has no host-selected address');
      }
      return;
    }
    if (!nativeId(request.id)) throw Error('Choose an exact native recovery record id');
    const binding = this.selected(request.scope, request.kind, request.id);
    if (!binding) throw Error('The recovery record is outside the host-selected address; read its checkpoint before using a draft');
    if (request.operation === 'write') {
      const value = request.value;
      if (!object(value) || (request.kind === 'draft' ? value.id !== request.id
        : !nativeId(value.draft_id) || !this.sameAddress(this.drafts.get(this.key(binding.scope, value.draft_id)), binding)
          || !object(value.view) || !object(value.view.document)
          || value.view.document.expression_ref !== binding.expression_ref)) {
        throw Error('The recovery value does not address the selected native work');
      }
    }
    return binding;
  }

  /** The owner's answer about a selected work's kept drafts, passed on only when it is about that work. Its named refusals (full,
   * over size, unreadable) keep nothing and remove nothing, and they reach the frame as the owner named them. */
  private acknowledgeQuarantine(request: Record<string, unknown>, result: Record<string, unknown>, binding: RecoveryBinding): unknown {
    if (result.state === 'quarantine_unreadable') {
      if (typeof result.detail !== 'string') throw Error('The native recovery owner named unreadable kept drafts without its reason');
      return result;
    }
    if (request.operation === 'read') {
      const record = result.record;
      if (result.state !== 'ready' || (record !== null && (!object(record) || record.scope !== binding.scope || record.kind !== 'draft_quarantine'
        || record.id !== binding.expression_ref || !positiveInteger(record.revision) || !object(record.value)
        || record.value.expression_ref !== binding.expression_ref || !Array.isArray(record.value.entries)))) {
        throw Error('The native kept drafts do not belong to the selected native work');
      }
      return result;
    }
    if (request.operation === 'keep_draft_quarantine') {
      if (result.state === 'quarantine_full' || result.state === 'quarantine_over_size') return result;
      if (result.state === 'quarantine_kept' && typeof result.kept === 'boolean' && typeof result.entry_id === 'string'
        && /^[0-9a-f]{64}$/.test(result.entry_id)) return result;
      throw Error('The native recovery owner did not acknowledge the kept draft');
    }
    if (result.state !== 'quarantine_entry_removed' || result.entry_id !== request.entry_id
      || !Number.isSafeInteger(result.remaining) || (result.remaining as number) < 0) {
      throw Error('The native recovery owner did not acknowledge the cleared draft');
    }
    return result;
  }

  /** Qualify the owner's acknowledgement before exposing it to the frame or
   * admitting the exact draft identity. A mismatched scope is never cached. */
  acknowledge(request: Record<string, unknown>, result: unknown, binding?: RecoveryBinding): unknown {
    if (!object(result) || result.schema !== 'oi.expression-recovery/v1') throw Error('The native recovery owner returned an invalid acknowledgement');
    if (request.operation === 'list') {
      if (result.state !== 'listed' || !Array.isArray(result.records)) throw Error('The native recovery owner returned an invalid inventory');
      for (const row of result.records) {
        if (!object(row) || row.scope !== request.scope || row.kind !== request.kind
          || !nativeId(row.id) || !positiveInteger(row.revision)) {
          throw Error('The native recovery inventory does not match the requested scope');
        }
      }
      const records = result.records.filter(row => {
        const selected = this.selected(String(row.scope), String(row.kind), String(row.id));
        if (selected && request.kind === 'checkpoint' && row.expression_ref !== selected.expression_ref) {
          throw Error('The native recovery inventory addresses a different selected Expression');
        }
        return selected;
      });
      return {...result, records};
    }
    if (!binding) throw Error('The recovery acknowledgement has no captured address');
    if (result.state === 'revision_conflict') {
      if (result.current_revision !== null && !positiveInteger(result.current_revision)) throw Error('The native recovery owner returned an invalid conflict basis');
      return result;
    }
    if (request.kind === 'draft_quarantine' || request.operation === 'keep_draft_quarantine' || request.operation === 'remove_draft_quarantine') {
      return this.acknowledgeQuarantine(request, result, binding);
    }
    if (request.operation === 'remove') {
      if (result.state !== 'removed' || result.id !== request.id || !positiveInteger(result.revision)) {
        throw Error('The native recovery owner did not acknowledge the addressed removal');
      }
      return result;
    }
    if (result.state !== (request.operation === 'write' ? 'written' : 'ready')) {
      throw Error('The native recovery owner did not acknowledge the addressed operation');
    }
    if (result.record === null && request.operation === 'read') {
      // None yet: no checkpoint stands at this selected address. The checkpoint a first write creates here can hold only
      // the draft its own id names (the owner's identity law), so that draft is granted to this address now.
      if (request.kind === 'checkpoint') {
        const address = this.key(binding.scope, binding.checkpoint_id), held = this.drafts.get(address);
        if (held && !this.sameAddress(held, binding)) throw Error('The native draft is already bound to another selected work');
        this.drafts.set(address, binding);
      }
      return result;
    }
    const record = result.record;
    if (!object(record) || record.scope !== binding.scope || record.kind !== request.kind
      || record.id !== request.id || !positiveInteger(record.revision)) {
      throw Error('The native recovery record does not match the requested scope and identity');
    }
    if (request.kind === 'checkpoint') {
      const value = record.value;
      if (!object(value) || value.schema !== 'oi.native-working/v1' || !nativeId(value.draft_id)
        || !object(value.view) || !object(value.view.document)
        || value.view.document.expression_ref !== binding.expression_ref) {
        throw Error('The selected checkpoint has no matching native work and draft identity');
      }
      const address = this.key(binding.scope, value.draft_id), held = this.drafts.get(address);
      if (held && !this.sameAddress(held, binding)) throw Error('The native draft is already bound to another selected work');
      if (request.operation === 'write' && !this.sameAddress(held, binding)) throw Error('The native checkpoint write returned an unproved draft identity');
      this.drafts.set(address, binding);
    } else if (!object(record.value) || record.value.id !== record.id) {
      throw Error('The returned native draft does not match its record identity');
    }
    return result;
  }
}
