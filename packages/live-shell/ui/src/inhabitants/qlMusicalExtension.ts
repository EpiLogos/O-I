// The QL musical family extension (L9) — the lane's declared, additive
// extension onto the owner-admitted quaternal-logic family, through the
// manifest grammar's `declareFamilyExtension` (the door's composition law:
// the base manifest is never rewritten, extensions compose on read, and a
// differing re-declaration refuses).
//
// What this lane ADMITS (owner code supports it today — the retained app's
// native-field/ql/* is landed, verified code, not plans):
// - `ql-instrument` — the field/PCM owner as the family's instrument device
//   face. The face reads the owner's real standing states and identity; its
//   body (qlInstrumentDevice.tsx) renders the honest refusing state — naming
//   the pipe adapter's launch contract, disclosed not invented — wherever no
//   owner reading stands. Admitted-with-honest-absence: the owner exists and
//   the face reads it when docked; the shell host does not yet supply the
//   authorised channel, and the face says so rather than pretending.
//
// What STAYS WAITING (the base manifest's six faces keep their waiting
// standing untouched): the sky face, the M3 clock, deck, chakra, the M1–M3
// matrices. This extension declares nothing over them.
//
// The track adapters (qlAudioTrackAdapter / qlPhysicsTrackAdapter) ride the
// Timeline's lane World-cut door (projectLaneWorldTracks) — the same door the
// other execution lanes' adapters use. Their manifest projection declarations
// are the QL family owner's own move and are named in this lane's honesty
// list; the family door (projectWorldTracks) refuses them until then.
// Likewise the M2 modulation observables (qlModulationSources.ts) are
// declared modules; the family's `telemetry` field stays the base's honest
// null until the owner declares it.

import {declareFamilyExtension} from './manifest.ts'

export const QL_MUSICAL_EXTENSION_ID = 'quaternal-logic:musical-l9'

/** Declare the musical extension. Idempotent: the door refuses only differing
 * contents, so a second declare composes the same extension and changes
 * nothing. Returns the declared extension. */
export function declareQlMusicalExtension(): void {
  declareFamilyExtension('quaternal-logic', {
    id: QL_MUSICAL_EXTENSION_ID,
    by: 'zcode:musical-family-l9 (execution lane, WORLD-SHELL-DESIGN §18; QL-MEF #281 law; ticket L9)',
    faces: [
      {
        id: 'ql-instrument',
        kind: 'instrument',
        presentations: ['compact', 'expanded'],
        dock: ['dock', 'expand'],
        admission: 'admitted',
        note: 'The field/PCM owner as an instrument device face — the proven aperture (reading/disabled/apply/captureCurrent/renderControl/createCustody) over the retained app\'s QL instrument owner (native-field/ql/instrument-session.mjs pipe adapter; identity tuple event/subject/registry/geometry/material/model refs; exact u64 cursors; block 8192, lead/lookahead 0.5 s @ 48 kHz). The face binds the owner\'s real standing states (manual/opening/following/held/unavailable); where no owner reading stands it renders the honest refusing state naming the launch contract (kernel native-expression compose → ql-field-host/ql-field-worker). No sounding claim: scheduling meters only, and the performance act (strike) is not offered — #281\'s packets own performance input.',
      },
    ],
    note: 'L9 musical extension: the M1 field/PCM owner as an instrument device. The audio and visual/physics track adapters project through the Timeline\'s lane door; the M2 observables (audio_octet[8], nodal_quartet[4]) are declared as typed modulation sources with the D13 law in the type — a source, never a generator. Manifest projection and telemetry declarations remain the QL family owner\'s move.',
  })
}
