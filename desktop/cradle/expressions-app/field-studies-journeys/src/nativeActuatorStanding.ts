/**
 * Honest M1/M2/M3 actuator availability from a native expression reading.
 * Disconnect must name unavailable actuators — never invent a demo fallback.
 * A layer is available only through a consumer that actually reads it.
 */

import {applyPhysicalFormPose, type PhysicalFormTarget} from './physicalFormActuator';

export type NativeLayerActuator =
  | {layer: 'M1' | 'M2' | 'M3'; available: true; actuator: string; observable: string}
  | {layer: 'M1' | 'M2' | 'M3'; available: false; reason: string};

export type NativeActuatorStanding = {
  schema: 'oi.native-actuator-standing/v1';
  connected: boolean;
  layers: NativeLayerActuator[];
  physical_form: ReturnType<typeof applyPhysicalFormPose>;
};

type NativeReadingLite = {
  status?: string;
  domain?: {
    m1?: {coordinate?: string; revision?: string} | null;
    m2?: {modes?: Array<{ref: string; frequency_hz: number}>; generation?: number} | null;
    m3?: {physical_form?: PhysicalFormTarget | null; codon_ref?: string; sequence?: string} | null;
  } | null;
  /** Present for a provider-composed K² owner: its eight voices are read. */
  instrument?: {voices?: unknown[] | null} | null;
  causal_trace?: {layers?: unknown[]} | null;
} | null | undefined;

/** Report what each native layer can actually drive right now. */
export function nativeActuatorStanding(reading: NativeReadingLite): NativeActuatorStanding {
  const connected = !!reading && reading.status === 'following' && !!reading.domain;
  if (!connected) {
    return {
      schema: 'oi.native-actuator-standing/v1',
      connected: false,
      layers: [
        {layer: 'M1', available: false, reason: 'native domain disconnected — carrier overlay unavailable'},
        {layer: 'M2', available: false, reason: 'native domain disconnected — modal audio/material unavailable'},
        {layer: 'M3', available: false, reason: 'native domain disconnected — physical form / transcription unavailable'},
      ],
      physical_form: applyPhysicalFormPose(null, false),
    };
  }
  const domain = reading!.domain!;
  const m1 = domain.m1;
  const m2 = domain.m2;
  const m3 = domain.m3;
  const k2 = !!reading!.instrument?.voices?.length;
  return {
    schema: 'oi.native-actuator-standing/v1',
    connected: true,
    layers: [
      m1?.coordinate
        ? {layer: 'M1', available: true,
          actuator: k2 ? 'coupled composer → M2 Vimarśā voices (Hz, m×n, phase) + native M1 torus rest body' : 'native domain overlay + continuous topology',
          observable: `coordinate ${m1.coordinate}`}
        : {layer: 'M1', available: false, reason: 'M1 carrier reading absent'},
      m2?.modes?.length
        ? {layer: 'M2', available: true, actuator: 'K8 modal owner → NativeAudioBinding PCM + retained GPU targets', observable: `${m2.modes.length} modes`}
        : {layer: 'M2', available: false, reason: 'M2 material modes absent'},
      m3?.codon_ref
        ? {layer: 'M3', available: true,
          actuator: 'coupled composer: M3 pose ordinal and codon enter the M2 Vimarśā reading',
          observable: `codon ${m3.codon_ref}${m3.sequence ? ' · ' + m3.sequence : ''} (via voices, not a pose)`}
        : {layer: 'M3', available: false, reason: 'M3 codon reading absent'},
    ],
    // Read, never claimed: no engine surface consumes a fold-pose rotation.
    physical_form: applyPhysicalFormPose(m3?.physical_form ?? null, true),
  };
}
