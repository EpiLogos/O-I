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
 *   not landed. The M1–M3 matrices have no shell-side owner and wait.
 * - The Deck reads the open journey (`ql.nara-oracle-journey/v1`, the kernel's
 *   nara_journey) and the Chakra your elements (`ql.nara-elemental-reading/v1`,
 *   the kernel's nara_elemental): both cut (T-WORLDS W4), each held by the
 *   Studio's Nara chain, your personal layer (manual §24.7), and by a Technē
 *   instrument: the Deck by the Journey, the Chakra by the Timeline.
 * - The Sitting (manual §24.3) is timed by the transport, rings its bell on
 *   the torus and keeps its record as a page in your practice world (T-WORLDS
 *   W4); it is held by the Studio's Nara chain and Technē's Timeline.
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
        // Your personal layer over the field (the Studio's Nara chain, manual §24.7) and Technē's Journey, beside the M3 clock whose
        // codon names the card now.
        heldBy: ['studio:nara', 'techne:m3'],
        invariant: {generates: 'kernel:nara_journey'},
        note: 'The open journey\'s reading (manual §22.4, §24.4): QL\'s continuing oracle journey (ql.nara-oracle-journey/v1), kept in its Flow page and read and acted on through the kernel\'s nara_journey (ql/devices/qlDeck.ts). A draw and a cast need your consent to chance, each time; the chance is the kernel\'s. With no journey open the device says so.',
      },
      {
        id: 'chakra',
        presentations: ['compact'],
        liveSemantic: 'device-instrument',
        // Your personal layer over the field (the Studio's Nara chain, manual §24.7) and Technē's Timeline, beside the Sky whose date it
        // follows.
        heldBy: ['studio:nara', 'techne:m2'],
        invariant: {generatesAbsent: 'Your elements are read, never written: the kernel\'s nara_elemental answers from your saved identity, and no owner operation takes a value back (lock §7).'},
        note: 'Your centres\' elements (manual §22.5, M4.1): QL\'s elemental map of your saved identity (ql.nara-elemental-reading/v1) and its natal distribution, read through the kernel\'s nara_elemental (ql/devices/qlChakra.ts). Today\'s centres and routes are the scene\'s (ql.scene/v1), which no owner carries to the shell yet; the device says so.',
      },
      {
        id: 'sitting',
        presentations: ['compact'],
        liveSemantic: 'device-instrument',
        // Your personal layer (the Studio's Nara chain, manual §24.7), and Technē's Timeline beside the Chakra: a sitting stands with your
        // centres, M4.1 (§24.9), and is a stretch of the day's time.
        heldBy: ['studio:nara', 'techne:m2'],
        invariant: {generates: 'kernel:invoke_action'},
        note: 'A sitting (manual §24.3): the transport times it, the torus rings its bell through the one instrument\'s own strike, and Stop keeps the time actually sat. Its record is a page in your practice world, made through Central\'s own creation door (projectcentral.source.create; ql/devices/qlSitting.ts). Nothing scores it; today\'s centres are the scene\'s, which no owner carries to the shell yet, and the device says so.',
      },
      {
        id: 'resonator-bank',
        presentations: ['compact', 'expanded', 'full'],
        // An effect lives in Live (lock §5.2: a Technē chain device is an instrument, never an effect): the QL home mode is Technē, so the face
        // declares the mode it presents in.
        modes: ['live'],
        liveSemantic: 'device-audio-fx',
        invariant: {transforms: 'the torus\'s sound after its level: one tuned body rings at each part of the M3 clock\'s cut'},
        note: 'The Resonator bank (manual §22.7) gives the cut the M3 clock draws a sound: a tuned body at each part of the octave, ringing at the root of the mode in force, for Decay seconds. '
          + 'The cut is the clock\'s: Aperture is its set-aperture and Swap its reciprocal-aperture through m3_reception (ql/devices/qlM3Clock.ts), and the shell tells the stage the clock\'s '
          + 'division; the root is the mode in force\'s; On, Decay, Tilt, Span, Mix and Gain are the stage\'s own Resonator bank effect in the hosted frame (native-field/presentationEffects.ts), written '
          + 'through the stage channel (ql/devices/qlResonatorBank.ts). It stands on Live\'s chain after the torus (live/designBindings/TorusEffectsOnChain.tsx). With the clock unread the cut is absent '
          + 'and the device says so, the stage keeping the cut it last held. The Studio\'s body chain does not place it yet, and Technē\'s rack, whose devices are instruments, does not stand it.',
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
