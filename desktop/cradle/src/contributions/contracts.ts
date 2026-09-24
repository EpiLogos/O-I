import type {ComponentType, ReactNode} from "react";
import type {SurfaceBinding} from "../surface/types";
import type {HostedAppState} from "../expressions/hostedApp";
import type {EncounterRow} from "../encounter/EncounterList";

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

export interface FactoryCentreContext {
  project?: string;
  accompanying?: {ref: string; project: string; space: string};
  onOpenTask?: (row: EncounterRow) => void | Promise<void>;
  onNewTask?: () => void;
  onOpenActivity?: () => void;
  onMessage?: (message: string) => void;
}

export interface HostedMountProps {
  binding: SurfaceBinding;
  subject?: {ref?: string; kind?: string; title: string; project?: string};
  factoryCentre?: ReactNode;
  factoryTasks?: FactoryCentreContext;
  onHostedState?: (state: HostedAppState) => void;
}

export interface RegisteredHostedSurface {
  descriptor: HostedSurfaceDescriptor;
  Component: ComponentType<HostedMountProps>;
}
