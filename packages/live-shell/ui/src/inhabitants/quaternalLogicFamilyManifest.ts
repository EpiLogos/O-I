import {admitFamilyManifest} from './familyManifest.ts'
import type {InhabitantManifest} from './manifest.ts'

/** Quaternal Logic — the cosmic (WORLD-SHELL-DESIGN §12): torus, sky,
 * M3 clock, deck work, chakra correspondences, the physical-music matrices.
 * The chronos provider (§15.1): the sky and the clock are time sources, not
 * only devices.
 *
 * Honesty (every face's standing is recorded in its note):
 * - The QL sky contract is LANDED QL-SIDE — `ql.sky-request/v1` →
 *   `ql.sky-snapshot/v1` (Work/Quaternal-Logic providers/sky/kerykeion_snapshot.py);
 *   the shell-side envelope exists (atlas skyProvider `requestQlSkySnapshot`).
 *   The sky→Earth adapter is the family's, in `qlSkyEarthAdapter.ts`: it
 *   admits the one geographic body the snapshot states (the subsolar point)
 *   as an Earth occurrence and projects no grid — the atlas port refused to
 *   write it, since that would merge the two contracts. The rack face body
 *   still waits, with its owner named.
 * - The torus lives in the retained M4 body's stage (the QL instrument
 *   presentation); the M3 clock/inscription is #281's packet — law today,
 *   not landed. Deck, chakra and the M1–M3 matrices have no shell-side
 *   owner. All wait.
 *
 * §16 — four surfaces and nowhere else: this manifest is the family's whole
 * exposure; nothing renders from it until an owner lands. */

export const QUATERNAL_LOGIC_FAMILY_ID = 'quaternal-logic'

/** The declaration, typed against the generalised schema first: the door's
 * parameter is the narrower FamilyManifest, and this family's faces carry
 * the generalised fields (kind defaults, admission standing) — a typed
 * const passes the door without excess-property refusal and comes back as
 * the same object. */
const QUATERNAL_LOGIC_MANIFEST: InhabitantManifest = {
    id: QUATERNAL_LOGIC_FAMILY_ID,
    // The family's browser presence: the retained instrument list the
    // knowledge category already renders (NativeTechneBrowser) — a place
    // held, not a new category.
    // `knowledge` stays bare: the door validator (manifest.ts) takes an entry's explicit modes only from the modes the
    // family's own faces present in, and this family records only the musical face's 'expressions' (qlMusicalExtension).
    // Declaring it in Technē would be refused; the Technē home of the sky, torus and clock faces is the QL owner's to record.
    browser: ['knowledge'],
    faces: [
      {
        id: 'sky',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generatesAbsent: 'The sky is read, never written: the kernel\'s nara_identity transit (ql.nara-transit/v1) answers a date the view asks for, and no owner operation takes a sky value back (lock §7).'},
        heldBy: ['techne:m4', 'techne:m2'],
        note: 'The dated sky over the QL kerykeion contract (ql.sky-request/v1 → ql.sky-snapshot/v1, ten bodies, Earth anchor, standing "calculated-ephemeris-not-observed-sky"), read through the kernel\'s nara_identity transit (ql/devices/qlSky.ts) and drawn by the catalogue\'s Sky design.',
      },
      {
        id: 'torus',
        presentations: ['compact', 'expanded', 'full'],
        liveSemantic: 'device-instrument',
        admission: 'waiting',
        heldBy: ['studio:body'],
        note: 'The M1 torus/field as an instrument device face. The presentation exists in the retained M4 body (INSTRUMENT_PRESENTATION ±25/9 m → ±333 engine units, sky epochs); §18\'s rack docking ("the field/PCM owner docks as an instrument device") is law, not landed. Waits for the QL instrument owner.',
      },
      {
        id: 'm3-clock',
        presentations: ['compact', 'expanded'],
        liveSemantic: 'device-instrument',
        invariant: {generates: 'kernel:m3_reception'},
        heldBy: ['techne:m2', 'techne:m3'],
        note: 'The M3 clock on the person\'s own M3 form (ql.m3-state/v1), read and moved through the kernel\'s m3_reception on the encounter the frame\'s Nara instrument uses (the chosen identity and the open Expression): the double-cover degree advances by advance-clock, the cut is set-aperture (ql/devices/qlM3Clock.ts). Private: no form is shared, and with no identity, Expression or opened form the device says which.',
      },
      {
        id: 'deck',
        presentations: ['compact'],
        liveSemantic: 'device-instrument',
        admission: 'waiting',
        note: 'Deck work (quaternal tarot/i-ching decks) as device faces. No shell-side owner exists; waits for the QL family\'s declaration of its deck owners.',
      },
      {
        id: 'chakra',
        presentations: ['compact'],
        liveSemantic: 'device-instrument',
        admission: 'waiting',
        note: 'Chakra correspondences (the ten-body/nine-voice/chakra reading of the sky contract) as a device face. Waits for the QL family\'s correspondence owner.',
      },
      {
        id: 'm-prime-matrices',
        presentations: ['expanded', 'full'],
        liveSemantic: 'device-instrument',
        admission: 'waiting',
        note: 'The physical music instrument matrices (M1–M2–M3–M4, QL-MEF #281, owner D13: M1 is the oscillator source; M2 never a second generator). Waits for #281\'s nine commissioned packets and their integrator.',
      },
    ],
    params: {grammar: 'quaternal-logic/parameter-address/v1'},
    projections: [
      // Landed: the sky→Earth adapter is the family's projection contribution
      // (§12), in ./qlSkyEarthAdapter.ts — the stated subsolar point placed as
      // an Earth occurrence with the snapshot as its basis. The atlas port
      // refused to write it (merging the sky contracts would be a port-law fault).
      'ql-sky-earth-adapter',
    ],
    inspectors: [],
    time: {
      // Chronos (§15.1) is the family's contribution: the kerykeion sky and
      // the M3 clock phases as read-only time functions. Landed QL-side;
      // the spine binding rides the sky envelope.
      consumes: [],
      contributes: ['chronos'],
    },
    telemetry: null, // nothing observable is exposed yet — honestly null
}

/** Idempotent admission at the neutral door. */
export function quaternalLogicFamilyManifest(): InhabitantManifest {
  return admitFamilyManifest(QUATERNAL_LOGIC_MANIFEST) as InhabitantManifest
}
