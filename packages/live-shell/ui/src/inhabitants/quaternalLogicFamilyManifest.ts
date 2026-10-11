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
 *   the shell-side envelope exists (atlas skyProvider `requestQlSkySnapshot`),
 *   but the sky→projection adapter and the rack face body are the QL family's
 *   to land — the atlas port explicitly refused to write them (writing them
 *   there would merge the two contracts). So the sky face waits, with its
 *   owner named.
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
    browser: ['knowledge'],
    faces: [
      {
        id: 'sky',
        presentations: ['compact', 'expanded'],
        admission: 'waiting',
        note: 'Compact sky face over the landed QL kerykeion contract (ql.sky-request/v1 → ql.sky-snapshot/v1, ten bodies, Earth anchor, standing "calculated-ephemeris-not-observed-sky"). The shell-side envelope exists (skyProvider.requestQlSkySnapshot); the projection adapter and face body are the QL family\'s to land.',
      },
      {
        id: 'torus',
        presentations: ['compact', 'expanded'],
        admission: 'waiting',
        note: 'The M1 torus/field as an instrument device face. The presentation exists in the retained M4 body (INSTRUMENT_PRESENTATION ±25/9 m → ±333 engine units, sky epochs); §18\'s rack docking ("the field/PCM owner docks as an instrument device") is law, not landed. Waits for the QL instrument owner.',
      },
      {
        id: 'm3-clock',
        presentations: ['compact', 'expanded'],
        admission: 'waiting',
        note: 'M3 clock/inscription/lens — inscription circles and lens phases as device controls. The sequence-clock grammar exists in the retained app; the M3 packet (#281) is commissioned, not landed. Waits for its owner.',
      },
      {
        id: 'deck',
        presentations: ['compact'],
        admission: 'waiting',
        note: 'Deck work (quaternal tarot/i-ching decks) as device faces. No shell-side owner exists; waits for the QL family\'s declaration of its deck owners.',
      },
      {
        id: 'chakra',
        presentations: ['compact'],
        admission: 'waiting',
        note: 'Chakra correspondences (the ten-body/nine-voice/chakra reading of the sky contract) as a device face. Waits for the QL family\'s correspondence owner.',
      },
      {
        id: 'm-prime-matrices',
        presentations: ['expanded', 'full'],
        admission: 'waiting',
        note: 'The physical music instrument matrices (M1–M2–M3–M4, QL-MEF #281, owner D13: M1 is the oscillator source; M2 never a second generator). Waits for #281\'s nine commissioned packets and their integrator.',
      },
    ],
    params: {grammar: 'quaternal-logic/parameter-address/v1'},
    projections: [
      // Declared, waiting: the sky→Earth adapter is the family's projection
      // contribution (§12); the atlas port refused to write it (merging the
      // sky contracts would be a port-law fault). The name reserves the seam.
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
