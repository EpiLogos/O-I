import type {ComponentType, ReactNode} from "react";
import type {SurfaceBinding} from "../surface/types";
import type {HostedAppState} from "../expressions/hostedApp";
import type {EncounterRow} from "../encounter/EncounterList";
import type {AgencyDepth} from "../surface/types";

/** Code admission is compile-time. These identities describe presentation;
 * neither a descriptor nor a selected subject confers owner authority. */
export interface HostedSurfaceDescriptor {
  descriptor_ref: string;
  contribution_ref: string;
  owner: string;
  revision: number;
  kind: string;
  title: string;
  retention: "mounted";
  region: "canvas";
}

/** The host operations the frame lends to ANY hosted surface: the project it
 * is browsing, the conversation bound to the workspace, and the ordinary ways
 * a surface asks the host to open an encounter, begin a new one, reveal the
 * activity plane or show a message. These are host/encounter operations, not
 * any one product's: a contribution maps them onto its own domain context
 * (Factory's Tasks does so in contributions/factory/descriptor.tsx). Domain
 * context never travels through this contract. */
export interface HostedHostContext {
  project?: string;
  accompanying?: {ref: string; project: string; space: string};
  openEncounter?: (row: EncounterRow) => void | Promise<void>;
  newEncounter?: () => void;
  openActivity?: () => void;
  /** The accompanying panel's presence — summoned (`panel`), focused (`full`) or put away (`collapsed`). A surface that
   * carries its own utility rail (the field) summons and dismisses the companion through this; the panel's own
   * toggle in the window row stays. */
  companion?: {depth: AgencyDepth; setDepth: (depth: AgencyDepth) => void};
  onMessage?: (message: string) => void;
}

export interface HostedMountProps {
  binding: SurfaceBinding;
  subject?: {ref?: string; kind?: string; title: string; project?: string};
  /** The frame-built conversation (the shared AgentChat). A surface that
   * relocates the conversation to its centre mounts it; the frame keeps the
   * session observer and the choose pair. */
  conversation?: ReactNode;
  host?: HostedHostContext;
  /** The surface's own presentation state, written back onto its binding (`view`) by the host: restored with the layout, never a source. */
  onView?: (view: NonNullable<SurfaceBinding["view"]>) => void;
  onHostedState?: (state: HostedAppState) => void;
}

export interface RegisteredHostedSurface {
  descriptor: HostedSurfaceDescriptor;
  Component: ComponentType<HostedMountProps>;
}
