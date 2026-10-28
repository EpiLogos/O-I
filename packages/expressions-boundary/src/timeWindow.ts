/** Shared Timeline/Places window over the host's injected native session.
 * The retained iframe owns no DisclosureSessionStore. Admission caches only
 * an actual owner reading; every session operation uses the existing owner.
 */
import {validateReading, validateSelection, validateSession,
  type DisclosureSelection, type DisclosureSession, type DisclosureTraversalHop, type TechneReading} from '../../../desktop/cradle/src/techne/contract.ts';
import type {DisclosureSessionStore} from '../../../desktop/cradle/src/techne/session.ts';
import {groundSelection, ensureSession} from '../../../desktop/cradle/src/techne/m0m5/reading.ts';
import {timeAxis, type SharedTimeWindow, type TechneTimeAxis} from '../../../desktop/cradle/src/techne/m0m5/timeline/timeAxis.ts';
import {beats} from '../../../desktop/cradle/src/techne/m0m5/journey/beats.ts';
import {crossToExpression, lostCrossingScene, returnPosition} from '../../../desktop/cradle/src/techne/m0m5/journey/crossing.ts';
import {boundedText, expressionRef, object, positiveInteger, type ChannelContext} from './protocol.ts';

export interface NativeTimeWindowBasis {expression_ref: string; revision: number; scene_ref: string}
/** `journey` is the crossing's own instrument (refresh and cross); `expressions` is the conjugate reading a return leaves. */
export type NativeTimeWindowInstrument = 'timeline' | 'place' | 'journey' | 'expressions';
export type NativeTimeWindowRequest = NativeTimeWindowBasis & {reading_ref: string; instrument: NativeTimeWindowInstrument} & (
  | {operation: 'read'}
  | {operation: 'refresh'}
  | {operation: 'set'; expected_session_ref: string; expected_selection: DisclosureSelection;
      expected_window: SharedTimeWindow | null; window: SharedTimeWindow | null}
  // Lane-4 T23/T24: the Places place the shared session focuses (null clears it). Same CAS as `set`, plus the captured spatial focus.
  | {operation: 'spatial'; expected_session_ref: string; expected_selection: DisclosureSelection;
      expected_window: SharedTimeWindow | null; expected_spatial_focus_ref: string | null; spatial_focus_ref: string | null}
  // Lane-2 T20: one trail step the shared session records in its own navigation. Same CAS as `set`; the hop's subject and
  // selection are the session's, byte-equal, and the recorder refuses any other.
  | {operation: 'traversal'; expected_session_ref: string; expected_selection: DisclosureSelection;
      expected_window: SharedTimeWindow | null; hop: DisclosureTraversalHop}
  // Lane-5 T10: enter a beat's Scene from the Journey. The captured session must still stand on the journey instrument;
  // the target must be a beat of the admitted Journey. The crossing records its scene hop and the cut crossing on the one history.
  | {operation: 'cross'; expected_session_ref: string; expected_selection: DisclosureSelection;
      expected_window: SharedTimeWindow | null; target_scene_ref: string}
  // Lane-5 T11: leave the Expression reading and restore the beat the crossing entered, by ref equality (never an index).
  | {operation: 'return'; expected_session_ref: string; expected_selection: DisclosureSelection; expected_window: SharedTimeWindow | null}
  // (Lane-5 palace seam A's `palace` operation retired with the frame's Palace lens, #762: palaces live in the atlas, whose trail step
  // records the same endpoint hop on the session directly — desktop/cradle/src/techne/m0m5/palace/basis.ts palaceTrailStep.)
);
/** What a crossing or a return did: the beat it entered, or the beat a return restored or lost (named by ref). */
export type NativeTimeWindowCrossing = {operation: 'cross'; scene_ref: string}
  | {operation: 'return'; scene_ref: string | null; lost_ref: string | null};
export interface NativeTimeWindowReply {
  schema: 'oi.native-time-window/v1';
  basis: NativeTimeWindowBasis;
  reading_ref: string;
  instrument: NativeTimeWindowInstrument;
  session: DisclosureSession;
  axis: TechneTimeAxis;
  crossing?: NativeTimeWindowCrossing;
}
type Admission = {basis: NativeTimeWindowBasis; reading: TechneReading; bindingId: string; epoch: number};
const copy = <T>(value: T): T => structuredClone(value);
const sameBasis = (a: NativeTimeWindowBasis | undefined, b: NativeTimeWindowBasis) => !!a
  && a.expression_ref === b.expression_ref && a.revision === b.revision && a.scene_ref === b.scene_ref;
const canonical = (value: unknown): string | undefined => JSON.stringify(value, (_key, item) =>
  object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const sameWindow = (a: SharedTimeWindow | null, b: SharedTimeWindow | null) => a === null || b === null
  ? a === b : a.from === b.from && a.to === b.to;
/** Boundary validation for a spatial-focus operand: a bounded place ref, or null to clear the focus. */
export function declaredSpatialRef(raw: unknown): string | null {
  if (raw === null) return null;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096)
    throw Error('Shared place focus requires an explicit place ref or null');
  return raw;
}
/** Compare-and-set predicate for a spatial write: the session must still be the captured one, with the same
 * spatial focus, window and actual source-qualified selection (instrument included). Pure; the owner refuses on false. */
export function spatialCaptureMatches(session: DisclosureSession, captured: {session_ref: string; selection: DisclosureSelection;
  spatial_focus_ref: string | null; window: SharedTimeWindow | null}): boolean {
  return session.session_ref === captured.session_ref
    && (session.spatial_focus_ref ?? null) === captured.spatial_focus_ref
    && sameWindow(session.time_window ?? null, captured.window)
    && canonical(session.selection) === canonical(captured.selection);
}
function basis(raw: unknown): NativeTimeWindowBasis {
  if (!object(raw) || !expressionRef(raw.expression_ref) || !positiveInteger(raw.revision) || !boundedText(raw.scene_ref))
    throw Error('An exact native Expression revision and Scene are required for shared time');
  return {expression_ref: raw.expression_ref, revision: raw.revision, scene_ref: raw.scene_ref};
}
function declaredWindow(raw: unknown): SharedTimeWindow | null {
  if (raw === null) return null;
  if (!object(raw) || Object.keys(raw).some(key => key !== 'from' && key !== 'to')
    || !['from', 'to'].every(key => Object.prototype.hasOwnProperty.call(raw, key)
      && (raw[key] === null || typeof raw[key] === 'string' && raw[key].length <= 4096)))
    throw Error('Shared time requires an explicit from/to window or null; camera dates are not operands');
  return copy(raw as unknown as SharedTimeWindow);
}
function current(context: ChannelContext, native: NativeTimeWindowBasis, admission?: Admission): void {
  context.signal.throwIfAborted();
  if (!context.current() || !boundedText(context.bindingId, 256) || !Number.isSafeInteger(context.epoch) || context.epoch < 0
    || !sameBasis(context.state?.nativeScene, native)
    || admission && (context.bindingId !== admission.bindingId || context.epoch !== admission.epoch))
    throw Error('The native shared-time target, access, presented host binding or epoch changed');
}
function checkedSession(session: DisclosureSession): DisclosureSession {
  const checked = validateSession(session);
  if (!checked.valid) throw Error(`The injected DisclosureSession drifted: ${checked.errors.join('; ')}`);
  declaredWindow(session.time_window ?? null);
  if (session.selection.instrument !== session.instrument) throw Error('The session instrument and its actual selection disagree');
  return session;
}
function qualifySameSource(session: DisclosureSession, admission: Admission): void {
  checkedSession(session);
  if (session.subject_ref !== admission.reading.subject.subject_ref || session.reading_ref !== admission.reading.reading_ref
    || session.selection.reading_ref !== admission.reading.reading_ref
    || (session.selection.snapshot_revision ?? null) !== (admission.reading.snapshot?.revision ?? null)
    || session.selection.selection_standing === 'stale' || session.selection.selection_standing === 'field-advanced')
    throw Error('The session source snapshot changed; explicitly refresh its native selection before changing shared time');
  if (session.expression_focus_ref !== undefined && session.expression_focus_ref !== admission.basis.expression_ref
    || session.scene_focus_ref !== undefined && session.scene_focus_ref !== admission.basis.scene_ref)
    throw Error('The session addresses another native Expression or Scene; explicitly refresh its ground');
}

/** One admission: the exact native basis, the validated reading, and the presenting binding. The Scene reading requires its
 * declared bindings to include this basis when it declares any; the Journey reading must declare this Scene's binding. */
function admission(request: NativeTimeWindowBasis, reading: TechneReading, context: ChannelContext, requireBinding: boolean): Admission {
  const native = basis(request);
  if (Object.keys(request).some(key => !['expression_ref', 'revision', 'scene_ref'].includes(key)))
    throw Error('Admission carries only its exact native basis');
  current(context, native);
  const checked = validateReading(reading);
  if (!checked.valid) throw Error(`Cannot admit a drifted native Technē reading: ${checked.errors.join('; ')}`);
  const bound = (reading.expressions ?? []).some(binding => binding.expression_ref === native.expression_ref
    && binding.scene_ref === native.scene_ref && binding.revision === String(native.revision));
  if (requireBinding ? !bound : reading.expressions !== undefined && !bound)
    throw Error('The reading declares no exact current native Expression/Scene binding');
  const next = {basis: native, reading: copy(reading), bindingId: context.bindingId, epoch: context.epoch};
  current(context, native);
  return next;
}

/** Root must admit only its primary native reading route, after that route's
 * real source/revision guards. Contract validity alone cannot manufacture a
 * source receipt. When a reading declares Expression bindings, those bindings
 * must include this exact owner basis; undeclared bindings stay undeclared. */
export function createNativeTimeWindowOwner({store}: {store: DisclosureSessionStore}) {
  let admitted: Admission | null = null;
  // Lane-5 T10/T11: the Expression-wide reading the Journey presents at the same native basis. Its beats are the only
  // authority a crossing targets and a return restores by ref; it is never the Scene reading that `admitted` holds.
  let journeyAdmitted: Admission | null = null;
  const align = (entry: Admission, instrument: NativeTimeWindowInstrument, context: ChannelContext): DisclosureSession => {
    current(context, entry.basis, entry);
    const prior = store.get(), sameSource = prior?.subject_ref === entry.reading.subject.subject_ref && prior.reading_ref === entry.reading.reading_ref;
    if (prior) checkedSession(prior);
    if (sameSource) qualifySameSource(prior!, entry);
    // Use native source-qualified selection and the existing situated-ground
    // carrier, never infer an Expression ref from local selection IDs.
    const ground = {expression_focus_ref: entry.basis.expression_ref, scene_focus_ref: entry.basis.scene_ref};
    if (!sameSource) store.setSelection(groundSelection(entry.reading, instrument), ground);
    else if (prior!.expression_focus_ref === undefined || prior!.scene_focus_ref === undefined)
      store.setSelection(prior!.selection, ground);
    current(context, entry.basis, entry);
    const session = ensureSession(entry.reading, instrument, store);
    current(context, entry.basis, entry);
    if (!session || store.get() !== session) throw Error('The native session advanced while aligning its shared-time instrument');
    qualifySameSource(session, entry);
    if (session.expression_focus_ref !== entry.basis.expression_ref || session.scene_focus_ref !== entry.basis.scene_ref)
      throw Error('The injected native session owner does not carry the exact Expression/Scene ground');
    return session;
  };
  return {
    admit(request: NativeTimeWindowBasis, reading: TechneReading, context: ChannelContext): void {
      const next = admission(request, reading, context, false);
      admitted = next; // No session operation or domain write during admission.
    },
    /** Admit the Expression-wide reading the Journey presents at this exact basis (lane-5 T10/T11). It must declare this Scene's own binding. */
    admitJourney(request: NativeTimeWindowBasis, reading: TechneReading, context: ChannelContext): void {
      const next = admission(request, reading, context, true);
      journeyAdmitted = next; // No session operation or domain write during admission.
    },
    handle(raw: unknown, context: ChannelContext): NativeTimeWindowReply {
      const native = basis(raw);
      // Each operation names the instrument it may address: time writes are Timeline/Place; the crossing's refresh and cross
      // are the Journey's; a return leaves the Expression reading.
      const instrumentFor: Record<string, readonly string[]> = {read: ['timeline', 'place'], set: ['timeline', 'place'], spatial: ['timeline', 'place'],
        traversal: ['timeline', 'place'], refresh: ['timeline', 'place', 'journey'], cross: ['journey'], return: ['expressions']};
      if (!object(raw) || !Object.prototype.hasOwnProperty.call(instrumentFor, String(raw.operation)) || !instrumentFor[String(raw.operation)].includes(String(raw.instrument))
        || !boundedText(raw.reading_ref)) throw Error('Shared time supports only exact read/set/refresh/spatial/traversal operations for Timeline or Places, and cross/return for the Journey');
      const extra = raw.operation === 'set' ? ['expected_session_ref', 'expected_selection', 'expected_window', 'window']
        : raw.operation === 'spatial' ? ['expected_session_ref', 'expected_selection', 'expected_window', 'expected_spatial_focus_ref', 'spatial_focus_ref']
        : raw.operation === 'traversal' ? ['expected_session_ref', 'expected_selection', 'expected_window', 'hop']
        : raw.operation === 'cross' ? ['expected_session_ref', 'expected_selection', 'expected_window', 'target_scene_ref']
        : raw.operation === 'return' ? ['expected_session_ref', 'expected_selection', 'expected_window'] : [];
      if (Object.keys(raw).some(key => !['expression_ref', 'revision', 'scene_ref', 'operation', 'instrument', 'reading_ref', ...extra].includes(key)))
        throw Error('Unsupported shared-time operands; presentation internals do not cross this boundary');
      const entry = admitted;
      current(context, native, entry ?? undefined);
      if (!entry || !sameBasis(entry.basis, native) || entry.reading.reading_ref !== raw.reading_ref)
        throw Error('No actual native reading is admitted at this shared-time basis');
      const instrument = raw.instrument as NativeTimeWindowInstrument;
      let window: SharedTimeWindow | null = null, expectedWindow: SharedTimeWindow | null = null;
      let spatialCapture: {session_ref: string; selection: DisclosureSelection; spatial_focus_ref: string | null; window: SharedTimeWindow | null} | null = null;
      let spatialFocus: string | null = null;
      let traversalHop: DisclosureTraversalHop | null = null;
      if (raw.operation === 'spatial') {
        spatialFocus = declaredSpatialRef(raw.spatial_focus_ref);
        const captured = {session_ref: raw.expected_session_ref as string, selection: raw.expected_selection as DisclosureSelection,
          spatial_focus_ref: declaredSpatialRef(raw.expected_spatial_focus_ref), window: declaredWindow(raw.expected_window)};
        if (!boundedText(raw.expected_session_ref) || !validateSelection(raw.expected_selection).valid)
          throw Error('Shared place focus requires the exact captured session and source-qualified selection');
        const before = store.get();
        if (!before) throw Error('Read the native shared session before setting its place focus');
        qualifySameSource(before, entry);
        if (!spatialCaptureMatches(before, captured))
          throw Error('The shared session, place focus, window or actual selection/instrument changed; read it before setting place focus');
        spatialCapture = captured;
      }
      if (raw.operation === 'traversal') {
        // The captured session, window and actual selection must still hold before the trail step is recorded (as `set`).
        expectedWindow = declaredWindow(raw.expected_window);
        const selected = validateSelection(raw.expected_selection);
        if (!boundedText(raw.expected_session_ref) || !selected.valid || !object(raw.hop))
          throw Error('Shared traversal requires the exact captured session, source-qualified selection and one traversal hop');
        traversalHop = raw.hop as unknown as DisclosureTraversalHop;
        const before = store.get();
        if (!before) throw Error('Read the native shared session before recording its traversal');
        qualifySameSource(before, entry);
        if (before.session_ref !== raw.expected_session_ref || !sameWindow(before.time_window ?? null, expectedWindow)
          || canonical(before.selection) !== canonical(raw.expected_selection))
          throw Error('The shared session, window or actual selection/instrument changed; read it before recording traversal');
      }
      if (raw.operation === 'set') {
        window = declaredWindow(raw.window); expectedWindow = declaredWindow(raw.expected_window);
        const selected = validateSelection(raw.expected_selection);
        if (!boundedText(raw.expected_session_ref) || !selected.valid) throw Error('Shared time set requires the exact captured session and source-qualified selection');
        const before = store.get();
        if (!before) throw Error('Read the native shared-time session before setting its window');
        qualifySameSource(before, entry);
        if (before.session_ref !== raw.expected_session_ref || !sameWindow(before.time_window ?? null, expectedWindow)
          || canonical(before.selection) !== canonical(raw.expected_selection))
          throw Error('The shared session, window or actual selection/instrument changed; read it before setting time');
      }
      // Lane-5 T10/T11: the crossing and its return are the Journey's own compare-and-set. The Journey's beats come from its own
      // admitted Expression-wide reading at this exact basis; the captured session must still stand before anything moves.
      let journey: Admission | null = null;
      if (raw.operation === 'cross' || raw.operation === 'return') {
        if (!journeyAdmitted || !sameBasis(journeyAdmitted.basis, native) || journeyAdmitted.reading.subject.subject_ref !== entry.reading.subject.subject_ref)
          throw Error('The Journey is not admitted at this native Scene; present the Journey before crossing or returning');
        journey = journeyAdmitted;
        if (!boundedText(raw.expected_session_ref) || !validateSelection(raw.expected_selection).valid)
          throw Error(`Journey ${raw.operation} requires the exact captured session and source-qualified selection`);
        expectedWindow = declaredWindow(raw.expected_window);
        const before = store.get();
        if (!before) throw Error(`Read the native shared session before ${raw.operation === 'cross' ? 'crossing' : 'returning'}`);
        checkedSession(before);
        if (raw.operation === 'cross') {
          const target = raw.target_scene_ref;
          if (!boundedText(target) || !beats(journey.reading).beats.some(beat => beat.scene_ref === target))
            throw Error('Journey crossing refused: that Scene is not a beat of this journey');
          qualifySameSource(before, entry);
          if (before.session_ref !== raw.expected_session_ref || !sameWindow(before.time_window ?? null, expectedWindow)
            || canonical(before.selection) !== canonical(raw.expected_selection))
            throw Error('The shared session, window or actual selection changed; read it before crossing');
        } else {
          if (before.subject_ref !== entry.reading.subject.subject_ref || before.reading_ref !== entry.reading.reading_ref)
            throw Error('The shared session belongs to another source; the crossing was not returned');
          if (before.instrument !== 'expressions') throw Error('Journey return refused: the session is not on the Expression reading');
          if (before.session_ref !== raw.expected_session_ref || !sameWindow(before.time_window ?? null, expectedWindow)
            || canonical(before.selection) !== canonical(raw.expected_selection))
            throw Error('The shared session, window or actual selection changed; the crossing was not returned');
        }
      }
      let session: DisclosureSession;
      if (raw.operation === 'refresh') {
        // Explicitly choose the admitted primary reading's native ground.
        // The existing owner retains a same-source window and resets a new
        // source's session; read/set never silently perform this refresh.
        const prior = store.get();
        if (prior) checkedSession(prior);
        current(context, native, entry);
        session = store.setSelection(groundSelection(entry.reading, instrument), {
          expression_focus_ref: entry.basis.expression_ref, scene_focus_ref: entry.basis.scene_ref,
        });
      } else if (raw.operation === 'cross' || raw.operation === 'return') {
        // Pre-checked above: the session already stands on the instrument it crosses from. Nothing is aligned here.
        session = store.get()!;
      } else session = align(entry, instrument, context);
      let crossing: NativeTimeWindowCrossing | undefined;
      if (raw.operation === 'cross') {
        // The crossing law: the scene ref rides the selection's focus, identity is carried byte-exact. Then the one history
        // records the scene hop (on the journey) and the cut crossing into the Expression reading.
        const target = raw.target_scene_ref as string;
        const crossed = crossToExpression(session, target);
        current(context, native, entry);
        store.setSelection(crossed.selection);
        store.recordTraversal({kind: 'traversal', instrument: 'journey', step: 'scene', ref: target,
          subject_ref: session.subject_ref, selection_ref: session.selection.selection_ref});
        session = store.crossCut(crossed.target).session;
        crossing = {operation: 'cross', scene_ref: target};
      }
      if (raw.operation === 'return') {
        // Restore by ref equality: the beat the focus names, or the honest miss. The session always returns to the journey,
        // and the return is recorded on the same history naming the beat it restored or lost.
        const found = returnPosition(session, beats(journey!.reading).beats);
        const lost = found.beat ? null : lostCrossingScene(session.navigation);
        current(context, native, entry);
        session = store.crossCut('journey').session;
        const ref = found.beat?.scene_ref ?? lost;
        if (ref) session = store.recordTraversal({kind: 'traversal', instrument: 'journey', step: 'return', ref,
          subject_ref: session.subject_ref, selection_ref: session.selection.selection_ref});
        crossing = {operation: 'return', scene_ref: found.beat?.scene_ref ?? null, lost_ref: lost};
      }
      if (raw.operation === 'set') {
        // Alignment may record the requested instrument hop; every other
        // actual selection field and the CAS window must still be unchanged.
        const expectedSelection = {...raw.expected_selection as DisclosureSelection, instrument};
        if (session.session_ref !== raw.expected_session_ref || !sameWindow(session.time_window ?? null, expectedWindow)
          || canonical(session.selection) !== canonical(expectedSelection))
          throw Error('The native session advanced during the shared-time instrument hop');
        current(context, native, entry);
        session = store.setTimeWindow(window);
      }
      if (traversalHop) {
        // Alignment may record the requested instrument hop; the captured session, window and selection must otherwise still hold.
        const expectedSelection = {...raw.expected_selection as DisclosureSelection, instrument};
        if (session.session_ref !== raw.expected_session_ref || !sameWindow(session.time_window ?? null, expectedWindow)
          || canonical(session.selection) !== canonical(expectedSelection))
          throw Error('The native session advanced during the shared traversal instrument hop');
        current(context, native, entry);
        session = store.recordTraversal(traversalHop);
      }
      if (spatialCapture) {
        // Same as set: the instrument hop may move only the recorded instrument; the captured spatial focus and window must still hold.
        if (!spatialCaptureMatches(session, {...spatialCapture, selection: {...spatialCapture.selection, instrument}}))
          throw Error('The native session advanced during the shared place-focus instrument hop');
        current(context, native, entry);
        session = store.setSpatialFocus(spatialFocus);
      }
      current(context, native, entry);
      if (store.get() !== session) throw Error('The native session advanced before its shared-time reply');
      // A return leaves the Scene ground to the Expression reading, which may have moved: only the subject is held to it.
      if (raw.operation === 'return') {
        if (session.subject_ref !== entry.reading.subject.subject_ref) throw Error('The native session advanced to another subject during the return');
      } else qualifySameSource(session, entry);
      return {schema: 'oi.native-time-window/v1', basis: copy(entry.basis), reading_ref: entry.reading.reading_ref,
        instrument, session: copy(checkedSession(session)), axis: copy(timeAxis(entry.reading, session.time_window ?? null)),
        ...(crossing ? {crossing} : {})};
    },
  };
}

/** The session's window as a shell face captured it (T-ATLAS-TIME): the session, its actual selection and the window in force. */
export interface CapturedSharedWindow {session_ref: string; selection: DisclosureSelection; window: SharedTimeWindow | null}

/** The shell's compare-and-set write of the shared window, for a shell face that is not an admitted Expression (the Earth).
 * It is the owner's `set` predicate over the same session store: the captured session, window and actual selection must
 * still stand, or the write is refused by name and nothing changes. The window then moves through the session's own
 * setter, once. Admission and source qualification stay the owner's; this writer claims neither. */
export function writeSharedWindowCompareAndSet(store: DisclosureSessionStore, captured: CapturedSharedWindow,
  window: SharedTimeWindow | null): DisclosureSession {
  const before = store.get();
  if (!before) throw Error('No shared session stands, so the shared time window has nowhere to be written');
  checkedSession(before);
  if (before.session_ref !== captured.session_ref || !sameWindow(before.time_window ?? null, captured.window)
    || canonical(before.selection) !== canonical(captured.selection))
    throw Error('The shared session, window or actual selection changed; read it before setting time');
  declaredWindow(window);
  return store.setTimeWindow(window);
}
