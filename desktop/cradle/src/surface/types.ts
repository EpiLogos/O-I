/**
 * Surface management types (U0.3b).
 *
 * Law 12 / D16 (WAYFINDER §1, §3): S is a functional OS with a built-in
 * canvas and window management — "tabs as Surface bindings, split/tiling/
 * move/restore, and right-click context menus as the primary grammar for
 * complex object interactions". APP-SPEC §5: the canvas is a Surface host
 * with the professional grammar (open/focus/pin/close/reopen/split/move/
 * restore); "Surface presentation != semantic ownership".
 *
 * All layout state is plain serialisable app state (persisted to
 * localStorage, restored on load). Presentation state only — it never
 * becomes a semantic identity (APP-SPEC §3).
 */

export type SurfaceId = string;

/** Split direction: 'h' = children side-by-side, 'v' = children stacked. */
export type PaneDir = "h" | "v";

/** Keyboard direction for focus/move operations. */
export type Dir = "left" | "right" | "up" | "down";

/** D17: the left agency column moves only through depth states.
 * At austere rest (zero surfaces) the depth is clamped to 'strip'. */
export type AgencyDepth = "collapsed" | "strip" | "panel" | "full";

export const AGENCY_DEPTHS: readonly AgencyDepth[] = [
  "collapsed",
  "strip",
  "panel",
  "full",
] as const;

/**
 * A binding between the frame and one surface. Kinds belong to the products
 * that mount surfaces here; today only clearly-named test bindings exist
 * ('test', 'test:silent') — the single synthetic allowance of U0.3b. No fake
 * file trees, no invented owner semantics (law 4, law 7).
 */
export interface SurfaceBinding {
  id: SurfaceId;
  kind: string;
  /** Stable ref into the owner's grammar, when one exists. */
  ref?: string;
  project?: string;
  title: string;
}

/** A tab group: one tab strip + the surface it presents. */
export interface TabGroupPane {
  type: "group";
  id: string;
  /** Ordered tab surface ids (pinned tabs render first). */
  tabs: SurfaceId[];
  /** Subset of tabs — pinned surfaces refuse close until unpinned. */
  pinned: SurfaceId[];
  /** The binding this group presents; focus follows the active binding. */
  active: SurfaceId | null;
}

export interface SplitPane {
  type: "split";
  id: string;
  dir: PaneDir;
  children: Pane[];
}

export type Pane = TabGroupPane | SplitPane;

export interface LayoutState {
  /** null = austere rest (law 12: rest is *what is on screen*). */
  root: Pane | null;
  /** All bindings ever opened this workspace, including closed ones
   * (the closed-surfaces stack needs them to reopen honestly). */
  surfaces: Record<SurfaceId, SurfaceBinding>;
  /** Most recently closed last. Reopen pops. */
  closedStack: SurfaceId[];
  focusedGroupId: string | null;
  agencyDepth: AgencyDepth;
}

/**
 * D15 — the Action seam: a component = ref + owner state + the canonical
 * Actions the owner discloses + invocation that crosses the authority seam.
 * The context menu renders exactly these disclosures; an object with none
 * shows an empty menu — nothing is fabricated.
 */
export interface ActionDisclosure {
  action_ref: string;
  title: string;
  enabled: boolean;
}

/** Argument bundle for frame action execution. */
export interface ActionArg {
  surfaceId?: SurfaceId;
  groupId?: string;
  beforeId?: SurfaceId | null;
  dir?: Dir;
  /** 1-based tab position for ⌘1…⌘9 jumps (visual order). */
  n?: number;
}

/** The layout as it was at load — the restore point for `restore-layout`. */
export type RestorePoint = Pick<
  LayoutState,
  "root" | "surfaces" | "closedStack" | "focusedGroupId"
>;

export const freshLayout = (): LayoutState => ({
  root: null,
  surfaces: {},
  closedStack: [],
  focusedGroupId: null,
  agencyDepth: "strip",
});
