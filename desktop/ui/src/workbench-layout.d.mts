export const WORKBENCH_LAYOUT_STORAGE_KEY: 'oi.desktop.workbench-layout/v2';
export const WORKBENCH_LAYOUT_VERSION: 2;
export const WORKBENCH_REGIONS: readonly ('navigator' | 'sidecar' | 'system' | 'lower')[];
export const FOCUSABLE_REGIONS: readonly ('navigator' | 'canvas' | 'sidecar' | 'lower' | 'system')[];
export const BINDING_REGIONS: readonly ('canvas' | 'navigator' | 'sidecar' | 'system' | 'lower')[];

export type WorkbenchRegionName = 'navigator' | 'sidecar' | 'system' | 'lower';

export type SurfaceBinding = {
  bindingId: string;
  surfaceRef: string;
  /** Carried while bound; never persisted (02 §6 rule 3). */
  subjectRef?: string;
  provider?: string;
  presentation?: string;
  region: 'canvas' | WorkbenchRegionName;
  homeRegion?: WorkbenchRegionName;
  pinned: boolean;
};

export type WorkbenchLayout = {
  version: number;
  regions: Record<WorkbenchRegionName, { present: boolean; width: number; height: number }>;
  split: 'single' | 'horizontal' | 'vertical';
  groups: Array<{ groupId: string; tabs: SurfaceBinding[]; activeBindingId?: string }>;
  summoned: SurfaceBinding[];
  focusedGroupId: string;
  focusRegion: 'navigator' | 'canvas' | 'sidecar' | 'lower' | 'system';
  closed: SurfaceBinding[];
};

export function restLayout(restSurfaceRef: string): WorkbenchLayout;
export function summonRegion(layout: WorkbenchLayout, region: WorkbenchRegionName): WorkbenchLayout;
export function dismissRegion(layout: WorkbenchLayout, region: WorkbenchRegionName): WorkbenchLayout;
export function toggleRegion(layout: WorkbenchLayout, region: WorkbenchRegionName): WorkbenchLayout;
export function summonSurface(
  layout: WorkbenchLayout,
  surfaceRef: string,
  region: WorkbenchRegionName,
  descriptor?: { provider?: string; presentation?: string },
): WorkbenchLayout;
export function promoteBinding(layout: WorkbenchLayout, bindingId: string): WorkbenchLayout;
export function returnBinding(layout: WorkbenchLayout, bindingId: string): WorkbenchLayout;
export function closeBinding(layout: WorkbenchLayout, bindingId: string): WorkbenchLayout;
export function bindSubject(layout: WorkbenchLayout, bindingId: string, subjectRef: string): WorkbenchLayout;
export function returnToRest(layout: WorkbenchLayout, restSurfaceRef: string): WorkbenchLayout;
export function splitBinding(layout: WorkbenchLayout, split: 'horizontal' | 'vertical'): WorkbenchLayout;
export function moveBindingToSplit(layout: WorkbenchLayout, split: 'horizontal' | 'vertical'): WorkbenchLayout;
/** Persists without any semantic fact: every binding's `subjectRef` is stripped. */
export function serializeLayout(layout: WorkbenchLayout): string;
export function parseLayout(raw: string | null | undefined, restSurfaceRef: string): WorkbenchLayout;
export function isAtRest(layout: WorkbenchLayout, restSurfaceRef: string): boolean;
