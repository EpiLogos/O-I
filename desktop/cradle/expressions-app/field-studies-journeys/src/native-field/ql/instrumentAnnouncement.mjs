/** The frame's announcement of the native instrument (ticket T-LIVE-TORUS-INSTRUMENT leg 2). The owner's own readings are
 * composed here into the ql.instrument-reading/v1 shape the shell's reader and the boundary validate: no value is invented.
 *
 *  - standing: the controller's own status (NativeStatus: manual | opening | following | held | unavailable);
 *  - identity: the six refs of the native basis the audio receipt carries (native-audio.mjs `basis`), with the session's event and subject;
 *  - cursors, audio receipt, availability and queue counts: the InstrumentSession reading, unchanged;
 *  - playback policy: the controller's embedded policy, unchanged;
 *  - determinants: the scene's acting M1 state (scene.ts SceneActing: lens, context frame, harmonic source, M3 transcription).
 *
 * Absent when no session is open: the frame announces nothing, and the shell withdraws the reading. A missing identity ref is
 * left missing, so the boundary refuses it by name. */
const IDENTITY = ['event_ref', 'subject_ref', 'registry_revision', 'geometry_ref', 'material_ref', 'model_ref'];

/** Compose the announcement from the controller's reading, or undefined while no native session is open. */
export function announceInstrument(reading) {
  const native = reading?.native;
  if (!native || typeof native !== 'object') return undefined;
  const basis = native.audio?.native ?? null;
  const identity = Object.fromEntries(IDENTITY.map(key => [key, basis?.[key] ?? (key === 'event_ref' || key === 'subject_ref' ? native[key] : undefined)]));
  const acting = reading.instrument?.acting ?? null;
  const instrument = reading.instrument ?? null;
  const cadence = instrument?.cadence ?? null;
  return {
    reading: {
      schema: 'ql.instrument-reading/v1',
      standing: reading.status,
      reason: native.reason ?? reading.reason ?? null,
      identity,
      acknowledged: native.acknowledged,
      presented: native.presented,
      audio: native.audio ?? null,
      available: native.available,
      held: native.held,
      in_flight: native.in_flight,
      queued_blocks: native.queued_blocks,
      queued_bytes: native.queued_bytes,
      coalesced_presentation_frames: native.coalesced_presentation_frames,
      views: native.views,
      disposed: native.disposed,
      playback_policy: reading.playback_policy,
    },
    determinants: acting ? {
      lens: {lens12: acting.m1.lens12, label: acting.m1.lens},
      contextFrame: acting.m1.context_frame,
      harmonic: acting.harmonic.source,
      rna: acting.m3.rna,
    } : null,
    // The presentation parameters the owner's own controls read and write: sound, level, scale, cadence, and the instrument's named refusal.
    parameters: {
      muted: reading.muted === true,
      level: reading.presentation_level?.value ?? null,
      scale: {unitsPerMetre: reading.presentation_units_per_metre ?? null, mode: reading.presentation_mode ?? 'manual'},
      cadence: cadence ? {rate: cadence.playing ? cadence.rate : 0, playing: cadence.playing === true, source: String(cadence.source ?? '')} : null,
      refusal: instrument?.refusal ? `${instrument.refusal.operation}: ${instrument.refusal.reason}` : null,
    },
  };
}
