/**
 * The Technē lens mount (owner wayfinder 2026-09-19, PR #387 §26) — the one
 * contract through which an M′ instrument becomes a lens of the Technē mode.
 * The dual-mode HUD mounts ONLY the active lens's body over the one field;
 * each lens declares its availability from the subject's current
 * TechneDisclosureState (techneReading.ts) — availability is the reading's
 * disclosure, never what happens to be mounted (the QL-MEF registry law,
 * QL-MEF #220 §registry: composition, never capability).
 *
 * Parent-authored seam: the HUD (TechneSurface) mounts through this module
 * and the instrument lanes register through it. Changing this file is the
 * parent integrator's act alone.
 */
import type {ComponentType, ReactNode} from "react";
import type {GlyphName} from "../workspace/Glyph";
import type {SurfaceBinding} from "../surface/types";
import type {TechneDisclosureState, TechneInstrumentId} from "./techneReading";

/** The Lens Studio slot — the floating Studio container the Technē mode
 * reuses. A lens parks its working controls there while it is active and
 * clears them when it unmounts; the studio owns placement, resizing and
 * persistence, the lens owns only its content. */
export interface TechneLensStudio {
  /** Host the lens's Studio controls (the floating Studio body). */
  setBody(body: ReactNode | null): void;
  /** Pin the lens's toolbelt tools (contextual, lens-qualified). */
  setTools(tools: ReactNode | null): void;
}

/** The one props contract every Technē lens body receives. The disclosure is
 * the ONE current reading for the arrangement's subject (techneReading.ts);
 * a resolved lens mounts immediately — never a generic waiting pane. */
export interface TechneLensBodyProps {
  binding: SurfaceBinding;
  subject?: {ref?: string; kind?: string; title: string; project?: string};
  disclosure: TechneDisclosureState;
  sceneId: string;
  studio: TechneLensStudio;
}

export interface TechneLens {
  /** The ql.techne/v1 disclosure vocabulary id this lens presents. */
  instrument: TechneInstrumentId;
  /** The M′ office this lens is the Technē face of. */
  mPrime: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  glyph: GlyphName;
  /** Availability from the CURRENT disclosure — with the actual reason when
   * unavailable. Never simulated, never a spinner where the reading resolves. */
  standing(disclosure: TechneDisclosureState): {available: boolean; reason?: string};
  Body: ComponentType<TechneLensBodyProps>;
}

const registry = new Map<TechneInstrumentId, TechneLens>();
const listeners = new Set<() => void>();
let snapshot: readonly TechneLens[] = [];

const emit = () => {
  snapshot = [...registry.values()];
  for (const listener of listeners) listener();
};

/** Mount one instrument's lens. One lens per instrument; a duplicate
 * registration is a composition bug, refused. Returns the unregister
 * function. */
export function registerTechneLens(lens: TechneLens): () => void {
  if (registry.has(lens.instrument)) throw new Error(`A Technē lens for ${lens.instrument} is already registered`);
  registry.set(lens.instrument, lens);
  emit();
  return () => {
    if (registry.get(lens.instrument) === lens) {
      registry.delete(lens.instrument);
      emit();
    }
  };
}

export function subscribeTechneLenses(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function techneLenses(): readonly TechneLens[] {
  return snapshot;
}
