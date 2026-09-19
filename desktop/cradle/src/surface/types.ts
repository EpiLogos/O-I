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
  /** A pending open (workspace-continuity WF2): the exact destination is
   * acknowledged before its owner read resolved, so the tab exists at once
   * and its ORIGIN workspace holds it while the acquisition is in flight.
   * A pending binding carries no ref/location yet — no owner identity, the
   * mount reconciliation skips it, and completion fills it in place. */
  pending?: boolean;
  address?: import("../kernel/types").KnowledgeAddress;
  encounter?: {space:string};
  browser?: {url:string};
  terminal?: {cwd?:string};
  flow?: {flowRef:string;path:string};
  view?: {graphOrigin?:string;knowledgePlane?: "graph"|"page";encounterPlane?: "Conversation"|"Activity"|"Context"|"Inspect"};
  location?: import("../kernel/types").CentralLocation;
  /** SF1: a projected subject pinned as its own Surface (kind
   * 'presentation') carries the exact World/Projection/Presentation/
   * Expression refs it was opened with — presentation state naming semantic
   * addresses, never a cloned remote payload. `ref` is the hosted entry ref. */
  presentation?: {world_ref:string;field_ref?:string;projection_ref?:string;projection_revision?:number;presentation_ref?:string;presentation_revision?:number;expression_ref?:string;expression_revision?:number};
}

/** A tab group: one tab strip + the surface it presents. */
export interface TabGroupPane {
  type: "group";
  id: string;
  /** An intentionally empty split destination, retained until filled or dismissed. */
  emptySlot?: boolean;
  /** The pane's own tab presentation (owner ruling 2026-09-17: per pane,
   * never global): pinned horizontal, pinned vertical, or unpinned behind
   * its reveal edge. Absent = pinned horizontal. */
  tabPresentation?: import("../workspace/mode").TabPresentation;
  /** The geometry this pane's tabs are pinned in — and the geometry an
   * unpinned pane reveals in. Absent = "horizontal". */
  tabPinOrientation?: "horizontal" | "vertical";
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
  weights?: number[];
}

export type Pane = TabGroupPane | SplitPane;

export interface NativeWindowBounds { x: number; y: number; width: number; height: number }

export interface LayoutState {
  focusedTabId?: SurfaceId;
  /** null = austere rest (law 12: rest is *what is on screen*). */
  root: Pane | null;
  /** All bindings ever opened this workspace, including closed ones
   * (the closed-surfaces stack needs them to reopen honestly). */
  surfaces: Record<SurfaceId, SurfaceBinding>;
  /** Most recently closed last. Reopen pops. */
  closedStack: SurfaceId[];
  focusedGroupId: string | null;
  /** A presentation mask; the full pane tree and mounted views remain intact. */
  maximizedGroupId?: string;
  agencyDepth: AgencyDepth;
  windowBounds?: Record<SurfaceId, NativeWindowBounds>;
  detached?: {surfaceId: string; groupId: string; index: number; pinned: boolean}[];
  subjectPlanes?: Record<string,"context"|"history"|"system">;
  rightDepth?: AgencyDepth;
  /** The right panel's own pane (the Context plane hosts it): a REAL
   * tab group from the existing pane logic — tab strip, +, surfaces, chrome —
   * never tiled. Pop-out moves its tabs into the centre tree. The browser/
   * terminal reconcile's live list must include its tabs (CradleFrame). */
  sidePane?: TabGroupPane;
  leftWidth?: number;
  rightWidth?: number;
  /** FND-02: the person's own accompanying encounter bound into the right
   * agent plane — a ref into AIKit's real agent_session grammar, never a
   * desktop-owned session record (map §2 law 7). */
  accompanying?: {ref: string; project: string; space: string};
  /** The workspace mode (workspace/mode.ts). Absent = "base". Presentation
   * only: it curates the left body, the mode's centre surface and the common
   * right panel; it never closes surfaces or restarts a session. */
  mode?: import("../workspace/mode").WorkspaceMode;
  /** The pinned-vertical tab list's persisted width (px), shared by every
   * vertical list, clamped by mode.ts's `clampTabListWidth` on every write
   * and on restore. The pin state itself is per pane (TabGroupPane). */
  tabListWidth?: number;
  /** The right panel's remembered plane, per mode. A plane a mode no longer
   * offers falls back to that mode's resting plane at render time. */
  panelPlanes?: Partial<Record<import("../workspace/mode").WorkspaceMode, string>>;
  /** Each mode remembers how its side regions were left, so returning to a
   * mode returns to its arrangement. Widths and the pane tree are shared. */
  modeRegions?: Partial<Record<import("../workspace/mode").WorkspaceMode, {left: AgencyDepth; right: AgencyDepth}>>;
  /** Owner ruling 2026-09-18: Epi-Logos is a whole-app world state, not a
   * page or a mode entry — when true, the entire system works within the
   * Epi-Logos ground regardless of mode. Displayed and toggled in the
   * workspace footer. */
  epiLogos?: boolean;
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
  splitId?: string;
  weights?: number[];
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
