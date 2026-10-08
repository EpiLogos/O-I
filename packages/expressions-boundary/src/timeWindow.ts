/** Shared Timeline/Places window over the host's injected native session.
 * The retained iframe owns no DisclosureSessionStore. Admission caches only
 * an actual owner reading; every session operation uses the existing owner.
 */
import {validateReading, validateSelection, validateSession,
  type DisclosureSelection, type DisclosureSession, type TechneReading} from '../../../desktop/cradle/src/techne/contract.ts';
import type {DisclosureSessionStore} from '../../../desktop/cradle/src/techne/session.ts';
import {groundSelection, ensureSession} from '../../../desktop/cradle/src/techne/m0m5/reading.ts';
import {timeAxis, type SharedTimeWindow, type TechneTimeAxis} from '../../../desktop/cradle/src/techne/m0m5/timeline/timeAxis.ts';
import {boundedText, expressionRef, object, positiveInteger, type ChannelContext} from './protocol.ts';

export interface NativeTimeWindowBasis {expression_ref: string; revision: number; scene_ref: string}
export type NativeTimeWindowInstrument = 'timeline' | 'place';
export type NativeTimeWindowRequest = NativeTimeWindowBasis & {reading_ref: string; instrument: NativeTimeWindowInstrument} & (
  | {operation: 'read'}
  | {operation: 'refresh'}
  | {operation: 'set'; expected_session_ref: string; expected_selection: DisclosureSelection;
      expected_window: SharedTimeWindow | null; window: SharedTimeWindow | null}
);
export interface NativeTimeWindowReply {
  schema: 'oi.native-time-window/v1';
  basis: NativeTimeWindowBasis;
  reading_ref: string;
  instrument: NativeTimeWindowInstrument;
  session: DisclosureSession;
  axis: TechneTimeAxis;
}
type Admission = {basis: NativeTimeWindowBasis; reading: TechneReading; bindingId: string; epoch: number};
const copy = <T>(value: T): T => structuredClone(value);
const sameBasis = (a: NativeTimeWindowBasis | undefined, b: NativeTimeWindowBasis) => !!a
  && a.expression_ref === b.expression_ref && a.revision === b.revision && a.scene_ref === b.scene_ref;
const canonical = (value: unknown): string | undefined => JSON.stringify(value, (_key, item) =>
  object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const sameWindow = (a: SharedTimeWindow | null, b: SharedTimeWindow | null) => a === null || b === null
  ? a === b : a.from === b.from && a.to === b.to;
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

/** Root must admit only its primary native reading route, after that route's
 * real source/revision guards. Contract validity alone cannot manufacture a
 * source receipt. When a reading declares Expression bindings, those bindings
 * must include this exact owner basis; undeclared bindings stay undeclared. */
export function createNativeTimeWindowOwner({store}: {store: DisclosureSessionStore}) {
  let admitted: Admission | null = null;
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
      const native = basis(request);
      if (Object.keys(request).some(key => !['expression_ref', 'revision', 'scene_ref'].includes(key)))
        throw Error('Admission carries only its exact native basis');
      current(context, native);
      const checked = validateReading(reading);
      if (!checked.valid) throw Error(`Cannot admit a drifted native Technē reading: ${checked.errors.join('; ')}`);
      if (reading.expressions !== undefined && !reading.expressions.some(binding => binding.expression_ref === native.expression_ref
        && binding.scene_ref === native.scene_ref && binding.revision === String(native.revision)))
        throw Error('The reading declares no exact current native Expression/Scene binding');
      const next = {basis: native, reading: copy(reading), bindingId: context.bindingId, epoch: context.epoch};
      current(context, native);
      admitted = next; // No session operation or domain write during admission.
    },
    handle(raw: unknown, context: ChannelContext): NativeTimeWindowReply {
      const native = basis(raw);
      if (!object(raw) || !['read', 'set', 'refresh'].includes(String(raw.operation)) || !['timeline', 'place'].includes(String(raw.instrument))
        || !boundedText(raw.reading_ref)) throw Error('Shared time supports only exact read/set/refresh operations for Timeline or Places');
      const extra = raw.operation === 'set' ? ['expected_session_ref', 'expected_selection', 'expected_window', 'window'] : [];
      if (Object.keys(raw).some(key => !['expression_ref', 'revision', 'scene_ref', 'operation', 'instrument', 'reading_ref', ...extra].includes(key)))
        throw Error('Unsupported shared-time operands; presentation internals do not cross this boundary');
      const entry = admitted;
      current(context, native, entry ?? undefined);
      if (!entry || !sameBasis(entry.basis, native) || entry.reading.reading_ref !== raw.reading_ref)
        throw Error('No actual native reading is admitted at this shared-time basis');
      const instrument = raw.instrument as NativeTimeWindowInstrument;
      let window: SharedTimeWindow | null = null, expectedWindow: SharedTimeWindow | null = null;
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
      } else session = align(entry, instrument, context);
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
      current(context, native, entry);
      if (store.get() !== session) throw Error('The native session advanced before its shared-time reply');
      qualifySameSource(session, entry);
      return {schema: 'oi.native-time-window/v1', basis: copy(entry.basis), reading_ref: entry.reading.reading_ref,
        instrument, session: copy(checkedSession(session)), axis: copy(timeAxis(entry.reading, session.time_window ?? null))};
    },
  };
}
