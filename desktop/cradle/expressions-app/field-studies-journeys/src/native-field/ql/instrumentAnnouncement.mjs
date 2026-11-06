/** The frame's announcement of the native instrument (ticket T-LIVE-TORUS-INSTRUMENT leg 2). The owner's own readings are
 * composed here into the ql.instrument-reading/v1 shape the shell's reader and the boundary validate: no value is invented.
 *
 *  - standing: the controller's own status (NativeStatus: manual | opening | following | held | unavailable);
 *  - identity: the six refs of the native basis the audio receipt carries (native-audio.mjs `basis`), with the session's event and subject;
 *  - cursors, audio receipt, availability and queue counts: the InstrumentSession reading, unchanged;
 *  - playback policy: the controller's embedded policy, unchanged;
 *  - determinants: the scene's acting M1 state (scene.ts SceneActing: lens, context frame, harmonic source, M3 transcription);
 *  - the Torus's M1′ session (parameters.torus): QL's own `torus-state` reading as the controller last took it (O-I #850), its notes
 *    counted and its Carrier's drive named in the owner's word, with the maqām, the lens's material and the twelve classes it names
 *    beside them (O-I #855); absent until the owner has been read. Under Sequence, where QL names no figure, the figure the scene's own
 *    shapes set as the torus object reads them (torusObject.ts sceneShapesOf; O-I 851): the figure shown, the two shapes, the progress;
 *  - where the Torus is heard from (parameters.receiver): Receiver On or Off, the owner's context and its refusal, and a shared place's
 *    reference, never the place (O-I 856);
 *  - the take that sounds under the Scene (parameters.take; controller.ts `take_player`, O-I #855 round 25): which, on which lane, from
 *    which of its frames and when that is heard, for the desktop's one engine to play it beside the Torus on its part, the take lane of
 *    the presented Scene auditioned in place of its row's main lane, and the frame's last refusal of a take in words. What its acts struck
 *    and the renders held stay with the frame.
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
      // The torus's four effects (native-field/effectsLaw.ts), as the controller keeps them; a reading without them announces none.
      ...(reading.presentation_effects ? {effects: reading.presentation_effects} : {}),
      ...(instrument?.torus ? {torus: torusSession(instrument.torus, instrument.torus_object)} : {}),
      // Where the Torus is heard from (O-I 856): Receiver On or Off, the owner's context and its refusal in its words; a place shared under a
      // reference with its reference, as QL discloses it. The place is never announced.
      ...(reading.receiver ? {receiver: receiverOf(reading.receiver)} : {}),
      ...(reading.take_player ? {take: {sounding: reading.take_player.sounding ?? null, audition: reading.take_player.audition ?? null,
        refusal: reading.take_player.refusal ?? null}} : {}),
    },
  };
}

/** Where the Torus is heard from, as the frame announces it: On or Off, the context, a shared place's reference, the refusal; no place. */
function receiverOf(receiver) {
  const context = receiver.context === 'personal' || receiver.context === 'shared' ? receiver.context : 'world';
  return {on: receiver.on === true, context, ...(context === 'shared' && typeof receiver.shared === 'string' ? {shared: receiver.shared} : {}),
    refusal: typeof receiver.refusal === 'string' ? receiver.refusal : null};
}

/** The owner's session (ql.m1-prime-session/v1) as the frame announces it: the owner's own values, the notes as their count. */
function torusSession(torus, object) {
  const sequence = sceneSequence(torus, object);
  return {
    settings: torus.settings, steps_per_second: torus.steps_per_second, band: torus.band, fundamental_hz: torus.fundamental_hz, map_hz: torus.map_hz,
    figure: torus.figure ?? null, comma_cents: torus.comma_cents, notes: Array.isArray(torus.notes) ? torus.notes.length : torus.notes,
    resident_tunings: torus.resident_tunings, carrier_drive: torus.carrier?.drive,
    // What torus-state names beside the session (O-I #855 round 6d): the M2 condition's maqām with its pitches or the owner's words for
    // its absence, the lens's material and the twelve classes, as the owner gave them; one the owner does not name is not announced.
    ...Object.fromEntries(['maqam', 'material', 'classes'].filter(key => torus[key] !== undefined && torus[key] !== null).map(key => [key, torus[key]])),
    // What rings (O-I #852, QL scene_field.rs `body`): the torus, or a form with the form it was made from, the preparation the owner made and
    // the material it made it of, its modes a voice and the voices that ring it. The prepared modes and lattice stay with the owner; a body it
    // does not name is not announced.
    ...(bodyOf(torus.body) ? {body: bodyOf(torus.body)} : {}),
    // Under Sequence (O-I 851; DLW §21.2 "Sequence follows the shapes you set in the scene"): the figure the scene's shapes set, as the torus
    // object shows it, the shape it stands on and the one it moves to, and the progress between them. None under another Shape.
    ...(sequence ? {sequence} : {}),
  };
}

/** The scene's shapes for the torus, as the torus object reads them under Sequence (torusObject.ts reading: shape.law and shape.sequence),
 * or null under another Shape or with no torus in the scene. */
function sceneSequence(torus, object) {
  const shape = object?.shape, at = shape?.sequence;
  if (torus?.settings?.shape !== 'sequence' || !at || typeof at !== 'object' || typeof shape.law !== 'string') return null;
  return {figure: shape.law, from: at.from, to: at.to, progress: at.progress};
}

/** What rings, as the owner's torus reading names it, or null where it names none the frame can carry. */
function bodyOf(body) {
  if (body?.kind === 'torus') return {kind: 'torus'};
  const prepared = body?.kind === 'form' ? body.prepared : null;
  const form = prepared?.form, preparation_ref = prepared?.request?.preparation_ref, material = prepared?.request?.material;
  if (!form || typeof form !== 'object' || typeof preparation_ref !== 'string' || !material || typeof material !== 'object'
    || !Number.isSafeInteger(body.modes) || !Number.isSafeInteger(body.voices)) return null;
  return {kind: 'form', form: {kind: form.kind, form_ref: form.form_ref, source_ref: form.source_ref}, preparation_ref,
    material: {fibre: material.fibre, q_factor: material.q_factor, strike_share: material.strike_share, source_ref: material.source_ref},
    modes: body.modes, voices: body.voices};
}
