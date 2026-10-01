/** Transport admission only. Native QL validates the complete sky and performs
 * identity/current derivation; this module contains no astronomical solver. */
import type {NativePersonalSkySource, NativeSkySnapshot, SkyRequest} from './identity/types';

export function readNativePersonalSkyInput(value: Record<string, unknown>): NativePersonalSkySource {
  const hasRequest = Object.prototype.hasOwnProperty.call(value, 'sky_request');
  const hasSnapshot = Object.prototype.hasOwnProperty.call(value, 'sky_snapshot');
  if (hasRequest === hasSnapshot) throw Error('Choose exactly one sky request or existing native sky snapshot.');
  const key = hasRequest ? 'sky_request' : 'sky_snapshot';
  const input = value[key];
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('A native sky object is required.');
  const native = input as Record<string, unknown>;
  const schema = hasRequest ? 'ql.sky-request/v1' : 'ql.sky-snapshot/v1';
  if (native.schema !== schema) throw Error('The personal sky input has an unsupported native schema.');
  if (hasSnapshot && (typeof native.snapshot_ref !== 'string' || !native.snapshot_ref.trim()
    || native.snapshot_ref.length > 4096 || /[\u0000-\u001f\u007f]/.test(native.snapshot_ref))) {
    throw Error('The existing native sky snapshot needs its bounded occasion reference.');
  }
  const purpose=value.snapshot_purpose;
  if(purpose!==undefined&&purpose!=='requested'&&purpose!=='retained-occasion')throw Error('Choose requested or retained-occasion snapshot purpose.');
  if(hasRequest&&purpose==='retained-occasion')throw Error('A retained occasion requires an existing native sky snapshot.');
  return hasRequest ? {sky_request: input as SkyRequest,...(purpose==='requested'?{snapshot_purpose:purpose}:{})}
    : {sky_snapshot: input as NativeSkySnapshot,...(purpose?{snapshot_purpose:purpose}:{})};
}

/** Validate the native owner's receipt without deriving or rewriting a sky. */
export function requireRetainedSkyAdmission(value:unknown,snapshot:NativeSkySnapshot):void {
  const a=value as import('./identity/types').SkyAdmission|null;
  const request=snapshot.request as {mode?:unknown}|null;
  if(a?.schema!=='ql.sky-admission/v1'||a.purpose!=='retained-occasion'||a.snapshot_ref!==snapshot.snapshot_ref
    ||a.original_mode!==request?.mode||a.epoch_utc!==snapshot.epoch_utc||a.receipt_utc!==snapshot.receipt_utc
    ||a.fresh_current_attested!==false||a.validation!=='immutable-snapshot-and-current-native-source'
    ||a.validator_source?.source_ref!=='providers/sky/kerykeion_snapshot.py'||!/^sha256:[0-9a-f]{64}$/.test(a.validator_source.revision)){
    throw Error('The native owner did not qualify this exact saved occasion separately from fresh current sky.');
  }
}
