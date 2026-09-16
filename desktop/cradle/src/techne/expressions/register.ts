/**
 * The Technē Expressions wiring (L5 Technē T7) — the two registrations the
 * integration owner calls; no shared file is edited here.
 *
 *   `registerExpressionsSurface()` mounts the bridge as the "expressions"
 *   instrument surface in the Technē surface registry (one component per
 *   instrument; composition, never capability).
 *
 *   `registerTechneFocusedInstrumentSource()` wires the K9 focused-instrument
 *   registry when the selection is embodyable: the descriptor's ref
 *   (`ql.techne:source:<subject_ref>`) resolves to the QL OWNER's real
 *   FocusedInstrumentSource, aliased under the Technē subject with a
 *   one-subject guard. Nothing here reconstructs an M state or forks a
 *   host — the owner keeps every fact it returns, the Global Expression
 *   Stage keeps its one renderer, and a registration that fails the
 *   embodiment gate returns the honest reason instead of a source.
 */
import {registerTechneSurface} from "../registry";
import {registerFocusedInstrumentSource, type FocusedInstrumentSource} from "../../instrument/source";
import {TechneExpressionBridge} from "./TechneExpressionBridge";
import {embody} from "./embody";
import type {DisclosureSelection, TechneReading} from "../contract";

/** Mount the Expressions bridge. Returns the unregister function. */
export function registerExpressionsSurface(): () => void {
  return registerTechneSurface("expressions", TechneExpressionBridge);
}

export interface TechneFocusedInstrumentRegistration {
  registered: boolean;
  /** The honest not-embodyable reason when registration did not happen. */
  reason?: string;
  unregister?: () => void;
}

/**
 * Wire the K9 registry for one embodyable selection. `owner` is the QL
 * owner's registered FocusedInstrumentSource — the source that already owns
 * focus, clock, Vāk, currentness and the retained lease; this alias adds a
 * ref and a one-subject guard, never facts.
 */
export function registerTechneFocusedInstrumentSource(input: {
  reading: TechneReading;
  selection: DisclosureSelection;
  owner: FocusedInstrumentSource;
}): TechneFocusedInstrumentRegistration {
  const gate = embody(input.reading, input.selection);
  if (!gate.embodyable) return {registered: false, reason: gate.reason};
  const descriptor = gate.descriptor;
  const owner = input.owner;
  const unregister = registerFocusedInstrumentSource({
    ref: descriptor.ref,
    title: descriptor.title,
    read: async () => {
      const snapshot = await owner.read();
      if (snapshot.event.subject_ref !== input.selection.subject_ref) {
        throw new Error(`The focused instrument carries subject ${snapshot.event.subject_ref}; the Technē selection names ${input.selection.subject_ref} — one subject, one embodiment`);
      }
      return snapshot;
    },
    readBimba: () => owner.readBimba(),
    command: (command) => owner.command(command),
    ...(owner.subscribe ? {subscribe: (listener: () => void) => owner.subscribe!(listener)} : {}),
    ...(owner.attachExpression ? {attachExpression: (lease: Parameters<NonNullable<FocusedInstrumentSource["attachExpression"]>>[0]) => owner.attachExpression!(lease)} : {}),
  });
  return {registered: true, unregister};
}
