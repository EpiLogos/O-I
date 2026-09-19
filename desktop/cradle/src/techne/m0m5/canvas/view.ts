/**
 * The authored Canvas View (L5 Technē M1′, QL-MEF #214) — a saved
 * PRESENTATION composition over one ql.techne/v1 reading. This is the facet
 * the TB0 specimen marks degraded ("a warranted constellation layout is
 * disclosed but no authored presentation view exists yet"); this module is
 * that authored view, made real, without ever copying semantic nodes.
 *
 * Laws this module keeps (dual-reading lock §7; wayfinder §3, §6):
 *   - a View carries NATIVE REFS VERBATIM — member refs in placements and
 *     frames are addresses into the reading, never re-keyed, never
 *     duplicated as new subjects, and there is deliberately NO field here
 *     that could hold a typed relation: arrangement cannot mint semantics;
 *   - the source basis (subject_ref, reading_ref, snapshot_revision) is
 *     carried from the reading the view was authored against, so a saved
 *     view can be re-applied to a refreshed reading and its drift REPORTED
 *     rather than silently absorbed;
 *   - a frame (visual group) is a presentation relation over refs. Whether
 *     it becomes a canonical constellation-membership change is the native
 *     owner's business through an explicit Action — never this module's;
 *   - the layout basis records WHY the non-overridden arrangement looks the
 *     way it does: `ql-constellation` only when the reading WARRANTED it
 *     (shape/constellation refs carried verbatim), otherwise `radial` or
 *     `authored`. A user-dragged arrangement never gains QL standing;
 *   - views validate strictly on parse (closed key set, ref law, z-order
 *     integers) so a corrupted or hostile view artifact cannot smuggle
 *     semantics into the surface.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechneReading } from "../../contract.ts";
import type { ConstellationLayout, LayoutOverrides } from "./layout.ts";

/** One authored presentation placement: a native ref at a unit-space
 * position. Nothing else — no relation, no membership, no standing. */
export interface CanvasViewPlacement {
  ref: string;
  x: number;
  y: number;
}

/** One authored visual frame (group): a presentation relation over native
 * refs, with a label and a z-order for layering. */
export interface CanvasViewFrame {
  frame_ref: string;
  label: string;
  member_refs: string[];
  /** Layer order; higher is drawn above. Presentation only. */
  z: number;
}

/** Why the underlying (non-overridden) arrangement looks the way it does.
 * `ql-constellation` is only reachable when the reading warranted it; the
 * warrant's own refs ride verbatim so the disclosure can be inspected. */
export interface CanvasViewLayoutBasis {
  scheme: "ql-constellation" | "radial" | "authored";
  warranted_ql: {
    shape_ref: string | null;
    constellation_ref: string | null;
    m_coordinate_ref: string | null;
  } | null;
}

/** The authored Canvas View: presentation state only, savable without
 * copying semantic nodes. */
export interface CanvasView {
  /** `ql.techne:view:canvas:<minted>` — a Cradle presentation artifact
   * identity, never a native owner ref. */
  view_ref: string;
  /** The basis the view was authored against (carried, not copied). */
  subject_ref: string;
  reading_ref: string;
  snapshot_revision?: string | null;
  /** Camera state at save time. */
  viewport: { x: number; y: number; scale: number };
  /** Authored positions, ref-keyed, unit space. */
  placements: CanvasViewPlacement[];
  /** Authored visual frames over native refs. */
  frames: CanvasViewFrame[];
  layout_basis: CanvasViewLayoutBasis;
}

const VIEW_REF_PREFIX = "ql.techne:view:canvas";

/** Mint a fresh presentation view ref. Distinct namespace from native
 * owner refs so a view can never impersonate semantic identity. */
export function mintCanvasViewRef(): string {
  return `${VIEW_REF_PREFIX}:${crypto.randomUUID()}`;
}

/** The layout basis a reading warrants: `ql-constellation` only on a
 * warranted ql facet, with the warrant's refs carried verbatim. */
export function layoutBasisForReading(reading: TechneReading): CanvasViewLayoutBasis {
  const ql = reading.ql;
  if (ql?.warrant === undefined) {
    return { scheme: "radial", warranted_ql: null };
  }
  return {
    scheme: "ql-constellation",
    warranted_ql: {
      shape_ref: ql.shape_ref ?? null,
      constellation_ref: ql.constellation_ref ?? null,
      m_coordinate_ref: ql.m_coordinate_ref ?? null,
    },
  };
}

export interface CreateCanvasViewOptions {
  view_ref?: string;
  viewport?: { x: number; y: number; scale: number };
  placements?: CanvasViewPlacement[];
  frames?: CanvasViewFrame[];
}

/** Author a view over one reading. The reading is only read: every field of
 * the view is presentation. */
export function createCanvasView(reading: TechneReading, options: CreateCanvasViewOptions = {}): CanvasView {
  const view: CanvasView = {
    view_ref: options.view_ref ?? mintCanvasViewRef(),
    subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref,
    snapshot_revision: reading.snapshot?.revision ?? null,
    viewport: options.viewport ?? { x: 0, y: 0, scale: 1 },
    placements: options.placements?.map((placement) => ({ ...placement })) ?? [],
    frames: options.frames?.map((frame) => ({ ...frame, member_refs: [...frame.member_refs] })) ?? [],
    layout_basis: layoutBasisForReading(reading),
  };
  const checked = validateCanvasView(view);
  if (!checked.valid) throw new Error(`Canvas view drifted from the view law: ${checked.errors.join("; ")}`);
  return view;
}

/** What the current reading no longer discloses about a saved view. Drift is
 * data: a view applied to a refreshed reading reports what fell away rather
 * than inventing nodes or quietly dropping history. */
export interface CanvasViewDrift {
  /** View refs the current reading no longer places (not placed nodes). */
  missing_refs: string[];
  /** Frame refs that lost members to the drift above. */
  frames_losing_members: Array<{ frame_ref: string; lost: string[] }>;
}

export function viewDrift(view: CanvasView, reading: TechneReading): CanvasViewDrift {
  const placed = new Set(reading.whole?.member_refs ?? []);
  const missing = view.placements.map((placement) => placement.ref).filter((ref) => !placed.has(ref));
  const losing = view.frames
    .map((frame) => ({ frame_ref: frame.frame_ref, lost: frame.member_refs.filter((ref) => !placed.has(ref)) }))
    .filter((entry) => entry.lost.length > 0);
  return { missing_refs: missing, frames_losing_members: losing };
}

/** Layer a saved view's placements and viewport over a freshly computed
 * layout. Unknown refs (drift) are IGNORED here and reported by
 * `viewDrift` — this function never invents a node. The layout and the
 * reading it came from are untouched. */
export function applyViewToLayout(
  view: CanvasView,
  layout: ConstellationLayout,
): { layout: ConstellationLayout; overrides: LayoutOverrides; dangling_refs: string[] } {
  const placed = new Set(layout.nodes.map((node) => node.ref));
  const overrides: Record<string, { x: number; y: number }> = {};
  const dangling: string[] = [];
  for (const placement of view.placements) {
    if (!placed.has(placement.ref)) {
      dangling.push(placement.ref);
      continue;
    }
    overrides[placement.ref] = { x: placement.x, y: placement.y };
  }
  return {
    layout,
    overrides,
    dangling_refs: dangling,
  };
}

/** Structural proof of the presentation law: a view can be inspected for
 * which native refs it addresses, and answers what it is NOT — no
 * relations, no memberships, no source edits. Used by the agency state to
 * separate semantic from presentation honestly. */
export function viewAddressedRefs(view: CanvasView): { placement_refs: string[]; frame_member_refs: string[] } {
  return {
    placement_refs: view.placements.map((placement) => placement.ref),
    frame_member_refs: view.frames.flatMap((frame) => frame.member_refs),
  };
}

/** Frame z-order operations — layering is presentation state. */
export function bringFrameToFront(view: CanvasView, frameRef: string): CanvasView {
  const maxZ = view.frames.reduce((max, frame) => Math.max(max, frame.z), 0);
  return mapFrame(view, frameRef, (frame) => ({ ...frame, z: maxZ + 1 }));
}

export function sendFrameToBack(view: CanvasView, frameRef: string): CanvasView {
  const minZ = view.frames.reduce((min, frame) => Math.min(min, frame.z), 0);
  return mapFrame(view, frameRef, (frame) => ({ ...frame, z: minZ - 1 }));
}

function mapFrame(view: CanvasView, frameRef: string, map: (frame: CanvasViewFrame) => CanvasViewFrame): CanvasView {
  const next: CanvasView = { ...view, frames: view.frames.map((frame) => (frame.frame_ref === frameRef ? map(frame) : frame)) };
  const checked = validateCanvasView(next);
  if (!checked.valid) throw new Error(`Canvas view drifted from the view law: ${checked.errors.join("; ")}`);
  return next;
}

export function framesInDrawOrder(view: CanvasView): CanvasViewFrame[] {
  return [...view.frames].sort((a, b) => a.z - b.z);
}

// ---------------------------------------------------------------------------
// Strict parse — the view artifact law, executable
// ---------------------------------------------------------------------------

export interface CanvasViewValidation {
  valid: boolean;
  errors: string[];
}

const VIEW_KEYS = ["view_ref", "subject_ref", "reading_ref", "snapshot_revision", "viewport", "placements", "frames", "layout_basis"] as const;
const PLACEMENT_KEYS = ["ref", "x", "y"] as const;
const FRAME_KEYS = ["frame_ref", "label", "member_refs", "z"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRef(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function rejectUnknown(value: Record<string, unknown>, allowed: readonly string[], label: string, errors: string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${label}: unknown field "${key}"`);
  }
}

function isViewRef(value: unknown): boolean {
  return isRef(value) && (value as string).startsWith(`${VIEW_REF_PREFIX}:`);
}

/** Validate one CanvasView artifact (the output of `serializeView` and the
 * input of `parseView`). Closed key set: presentation state cannot smuggle
 * semantic fields in. */
export function validateCanvasView(value: unknown): CanvasViewValidation {
  const errors: string[] = [];
  if (!isObject(value)) return { valid: false, errors: ["view: must be an object"] };
  rejectUnknown(value, VIEW_KEYS, "view", errors);
  if (!isViewRef(value.view_ref)) errors.push(`view.view_ref: required, and must live in the ${VIEW_REF_PREFIX}: namespace — a view is a presentation artifact, not a native ref`);
  if (!isRef(value.subject_ref)) errors.push("view.subject_ref: required");
  if (!isRef(value.reading_ref)) errors.push("view.reading_ref: required");
  if (value.snapshot_revision !== undefined && value.snapshot_revision !== null && typeof value.snapshot_revision !== "string") {
    errors.push("view.snapshot_revision: must be a string or null");
  }
  if (!isObject(value.viewport)) {
    errors.push("view.viewport: required object");
  } else {
    rejectUnknown(value.viewport, ["x", "y", "scale"], "view.viewport", errors);
    for (const key of ["x", "y", "scale"]) if (!isNumber(value.viewport[key])) errors.push(`view.viewport.${key}: finite number`);
  }
  if (!Array.isArray(value.placements)) {
    errors.push("view.placements: required array");
  } else {
    value.placements.forEach((placement, index) => {
      const label = `view.placements[${index}]`;
      if (!isObject(placement)) { errors.push(`${label}: must be an object`); return; }
      rejectUnknown(placement, PLACEMENT_KEYS, label, errors);
      if (!isRef(placement.ref)) errors.push(`${label}.ref: required`);
      if (!isNumber(placement.x) || !isNumber(placement.y)) errors.push(`${label}.x/y: finite numbers`);
    });
  }
  if (!Array.isArray(value.frames)) {
    errors.push("view.frames: required array");
  } else {
    value.frames.forEach((frame, index) => {
      const label = `view.frames[${index}]`;
      if (!isObject(frame)) { errors.push(`${label}: must be an object`); return; }
      rejectUnknown(frame, FRAME_KEYS, label, errors);
      if (!isRef(frame.frame_ref)) errors.push(`${label}.frame_ref: required`);
      if (!isRef(frame.label)) errors.push(`${label}.label: required`);
      if (!Array.isArray(frame.member_refs) || !frame.member_refs.every(isRef)) errors.push(`${label}.member_refs: array of refs`);
      if (!Number.isInteger(frame.z)) errors.push(`${label}.z: integer`);
    });
  }
  if (!isObject(value.layout_basis)) {
    errors.push("view.layout_basis: required object");
  } else {
    rejectUnknown(value.layout_basis, ["scheme", "warranted_ql"], "view.layout_basis", errors);
    if (value.layout_basis.scheme !== "ql-constellation" && value.layout_basis.scheme !== "radial" && value.layout_basis.scheme !== "authored") {
      errors.push("view.layout_basis.scheme: ql-constellation, radial or authored");
    }
    const warranted = value.layout_basis.warranted_ql;
    if (warranted !== null && warranted !== undefined) {
      if (!isObject(warranted)) {
        errors.push("view.layout_basis.warranted_ql: object or null");
      } else {
        rejectUnknown(warranted, ["shape_ref", "constellation_ref", "m_coordinate_ref"], "view.layout_basis.warranted_ql", errors);
        for (const key of ["shape_ref", "constellation_ref", "m_coordinate_ref"]) {
          if (warranted[key] !== undefined && warranted[key] !== null && typeof warranted[key] !== "string") {
            errors.push(`view.layout_basis.warranted_ql.${key}: string or null`);
          }
        }
      }
      if (value.layout_basis.scheme !== "ql-constellation") {
        errors.push("view.layout_basis: warranted_ql requires scheme ql-constellation — a layout carries QL standing only from a warranted reading");
      }
    }
    if (value.layout_basis.scheme === "ql-constellation" && (warranted === null || warranted === undefined)) {
      errors.push("view.layout_basis: scheme ql-constellation requires the warranted_ql refs");
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Serialize to a plain JSON-ready artifact. */
export function serializeView(view: CanvasView): Record<string, unknown> {
  return structuredClone(view) as unknown as Record<string, unknown>;
}

/** Parse and validate a serialized view artifact. Invalid artifacts are
 * refused, never best-effort repaired. */
export function parseView(value: unknown): CanvasView {
  const checked = validateCanvasView(value);
  if (!checked.valid) throw new Error(`Canvas view artifact is invalid: ${checked.errors.join("; ")}`);
  return structuredClone(value) as unknown as CanvasView;
}

// ---------------------------------------------------------------------------
// The presentation-view store — Cradle-seam state, not a native store
// ---------------------------------------------------------------------------

export interface CanvasViewStore {
  /** Saved views, most recently saved last. */
  views(): CanvasView[];
  forSubject(subjectRef: string): CanvasView[];
  save(view: CanvasView): CanvasView;
  delete(viewRef: string): boolean;
  subscribe(listener: () => void): () => void;
}

/** Create one in-memory view store. Durable persistence (where the host
 * writes the serialized artifact) is the Cradle's seam, not this module's;
 * `serializeView`/`parseView` are the artifact boundary it persists through. */
export function createCanvasViewStore(): CanvasViewStore {
  const views: CanvasView[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    views() {
      return [...views];
    },
    forSubject(subjectRef) {
      return views.filter((view) => view.subject_ref === subjectRef);
    },
    save(view) {
      const checked = validateCanvasView(view);
      if (!checked.valid) throw new Error(`Canvas view drifted from the view law: ${checked.errors.join("; ")}`);
      const stored = structuredClone(view) as unknown as CanvasView;
      const existing = views.findIndex((candidate) => candidate.view_ref === stored.view_ref);
      if (existing >= 0) views[existing] = stored;
      else views.push(stored);
      notify();
      return structuredClone(stored) as unknown as CanvasView;
    },
    delete(viewRef) {
      const index = views.findIndex((candidate) => candidate.view_ref === viewRef);
      if (index < 0) return false;
      views.splice(index, 1);
      notify();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
