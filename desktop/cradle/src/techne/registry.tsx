/**
 * The Technē instrument surface registry (L5 Technē T0) — the mount point
 * later instrument lanes claim. Each constellation instrument may register
 * one surface component; until it does, the host renders its honest
 * placeholder. Registration is composition, never capability: an
 * unregistered instrument that the reading declares available stays
 * available, and shows its placeholder (capability comes from the reading's
 * disclosure, never from what happens to be mounted).
 */
import type { ComponentType } from "react";
import type { SurfaceBinding } from "../surface/types";
import type { DisclosureSelection, DisclosureSession, TechneDisclosure, TechneInstrument, TechneReading } from "./contract";

/** What the host hands a mounted instrument surface: the binding it presents,
 * the one current session (nullable while nothing is disclosed), the session's
 * selection, the resolved reading and its disclosure. */
export interface TechneSurfaceProps {
  binding: SurfaceBinding;
  session: DisclosureSession | null;
  selection: DisclosureSelection | null;
  reading: TechneReading | null;
  capabilities: TechneDisclosure | null;
}

type TechneSurfaceComponent = ComponentType<TechneSurfaceProps>;

const registry = new Map<TechneInstrument, TechneSurfaceComponent>();

/** Mount one instrument's surface component. One component per instrument;
 * a duplicate registration is a composition bug, refused. Returns the
 * unregister function. */
export function registerTechneSurface(instrument: TechneInstrument, component: TechneSurfaceComponent): () => void {
  if (registry.has(instrument)) throw new Error(`A Technē surface for ${instrument} is already registered`);
  registry.set(instrument, component);
  return () => {
    if (registry.get(instrument) === component) registry.delete(instrument);
  };
}

export function techneSurface(instrument: TechneInstrument): TechneSurfaceComponent | undefined {
  return registry.get(instrument);
}
