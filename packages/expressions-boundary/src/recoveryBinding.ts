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

/** Routing metadata only. The native owner retains every byte and CAS basis. */
export class RecoveryAdmission {
  readonly configured: boolean;
  private readonly bindings = new Map<string, RecoveryBinding>();
  private readonly drafts = new Map<string, RecoveryBinding>();

  constructor(bindings?: readonly RecoveryBinding[]) {
    this.configured = bindings !== undefined;
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
    const binding = this.bindings.get(reference);
    if (!binding && this.configured) throw Error('This native Expression has no host-selected recovery address');
    return binding ? {...binding} : undefined;
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

  /** Return the immutable address captured before asynchronous owner work. */
  admit(request: unknown): RecoveryBinding | undefined {
    if (!this.configured || !this.bindings.size) throw Error('No host-selected native recovery address is attached');
    if (!object(request) || (request.scope !== 'expressions' && request.scope !== 'techne')) {
      throw Error('A native recovery request must name its selected scope');
    }
    if (request.operation === 'find_checkpoint') throw Error('Read the host-selected checkpoint by its exact id');
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
    if (request.operation === 'remove') {
      if (result.state !== 'removed' || result.id !== request.id || !positiveInteger(result.revision)) {
        throw Error('The native recovery owner did not acknowledge the addressed removal');
      }
      return result;
    }
    if (result.state !== (request.operation === 'write' ? 'written' : 'ready')) {
      throw Error('The native recovery owner did not acknowledge the addressed operation');
    }
    if (result.record === null && request.operation === 'read') return result;
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
