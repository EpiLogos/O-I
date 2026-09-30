import {kernelOp} from '../../kernel/bridge';
import type {KernelTransportStatus} from '../../kernel/types';
import type {NaraIdentityRequest, NaraIdentityResult} from './types';

/** Every operation reaches the native owner; no browser copy of personal source. */
export async function naraIdentity(
  transport: KernelTransportStatus, request: NaraIdentityRequest,
): Promise<NaraIdentityResult> {
  const response = await kernelOp(transport, {op: 'nara_identity', request});
  if (response.error || response.outcome?.result !== 'nara_identity') {
    throw new Error(response.error ?? 'The identity owner did not return a reading. Your edits are still here.');
  }
  const data = response.outcome.data as NaraIdentityResult;
  if (!data || data.schema !== 'oi.nara-identity/v1') throw new Error('The identity owner returned an unsupported response.');
  if (data.error || data.state === 'conflict' || data.state === 'revision_conflict') {
    throw new Error(data.error ?? 'This profile changed in Central. Your edits are preserved; open the saved version only when you are ready to discard them.');
  }
  if (data.reading && (data.reading.schema !== 'ql.nara-identity-reading/v1' || !Array.isArray(data.reading.matrix))) {
    throw new Error('The identity owner returned an unsupported identity reading.');
  }
  return data;
}
