/**
 * The Canvas/Constellation layout (L5 Technē T2) — deterministic, React-free
 * geometry over ONE ql.techne/v1 reading. There is no second graph substrate
 * here: the bounded whole, its members and its typed relations are the only
 * entities, taken verbatim from the reading; layout is pure presentation
 * derived from them.
 *
 * Two schemes, chosen by the reading alone (never by user preference):
 *
 *   - "ql-constellation" — engages only when the reading carries a WARRANTED
 *     ql facet (`reading.ql` with `warrant`; a QL facet exists only when
 *     warranted). The warranted fields present determine positions: the
 *     constellation's own shape is sixfold, so members take constellation
 *     positions 0..=5 around the whole — index 0 at the top (−90°), then
 *     clockwise at 60° steps (SVG y-down coordinates). More than six members
 *     continue the same six angles on outer rings (radius × 1.45 per ring).
 *     When `ql.address` is disclosed, it anchors on the bottom axis (90°) at
 *     radius 4/3 × the member ring, outside the constellation — the warrant's
 *     own address, not a member.
 *
 *   - "radial" — no warranted ql facet: members are spaced evenly on one
 *     circle around the whole, clockwise from the top, in member_refs order.
 *
 * Same input → same output, always: no clocks, no randomness, no iteration
 * order beyond the reading's own arrays. Native refs are opaque and carried
 * verbatim; relation vocabulary is preserved verbatim as edge labels.
 *
 * Manual visual arrangement (dragging a node somewhere) is PRESENTATION
 * state: `applyManualOverrides` layers ref-keyed positions over a computed
 * layout and has no reading parameter — it can never feed back into the
 * reading. (§3: view, layout and camera state are inexpressible in the
 * contract.)
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechneReading } from "../contract.ts";

export type ConstellationScheme = "ql-constellation" | "radial";

export interface ConstellationNode {
  /** The native ref, verbatim — never relabelled, never re-keyed. */
  ref: string;
  role: "whole" | "member" | "ql-address";
  /** Unit space: the whole sits at (0, 0); the renderer scales this. */
  x: number;
  y: number;
  /** Sixfold QL constellation position 0..=5; null outside the QL scheme. */
  position: number | null;
  /** Ring around the whole (0 = the inner member ring). */
  ring: number;
}

/** One typed relation of the bounded whole; the label is the provider's own
 * relation vocabulary, verbatim. */
export interface ConstellationEdge {
  relation: string;
  from_ref: string;
  to_ref: string;
  origin: string | null;
  origin_ref: string | null;
}

export interface ConstellationLayout {
  scheme: ConstellationScheme;
  /** The whole's native ref; falls back to the subject ref when the reading
   * discloses no whole — the bounded whole is then the subject alone. */
  whole_ref: string;
  /** The whole first, then members in the reading's order, then the QL
   * address anchor. Members equal to the whole_ref and duplicates keep their
   * first placement only — the centre is already placed. */
  nodes: ConstellationNode[];
  /** Every disclosed relation, in the reading's order. Endpoints that are
   * not placed nodes stay here honestly; the surface lists them instead of
   * inventing an anchor. */
  edges: ConstellationEdge[];
}

/** Manual visual arrangement: ref-keyed positions in unit space. It applies
 * to a layout only and never reaches a reading. */
export type LayoutOverrides = Readonly<Record<string, { x: number; y: number }>>;

/** Member ring radius in unit space (the renderer scales by 1000). */
export const MEMBER_RING_RADIUS = 0.36;
/** The warranted QL address anchors at 4/3 × the member ring, below. */
const ADDRESS_RADIUS = MEMBER_RING_RADIUS * (4 / 3);
/** Outer member rings grow by this factor per ring (sixfold scheme only). */
const RING_GROWTH = 1.45;
/** The constellation's own sixfold shape (six instruments around a whole). */
const SIXFOLD = 6;

function polar(angleDegrees: number, radius: number): { x: number; y: number } {
  const angle = (angleDegrees * Math.PI) / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Compute the constellation layout of one reading. Pure: the reading is
 * only read, never written; the output shares no structure with it. */
export function computeLayout(reading: TechneReading): ConstellationLayout {
  const wholeRef = reading.whole?.whole_ref ?? reading.subject.subject_ref;
  const qlWarranted = reading.ql !== undefined && reading.ql.warrant !== undefined;
  const scheme: ConstellationScheme = qlWarranted ? "ql-constellation" : "radial";

  const nodes: ConstellationNode[] = [
    { ref: wholeRef, role: "whole", x: 0, y: 0, position: null, ring: 0 },
  ];
  const placed = new Set<string>([wholeRef]);

  const members = reading.whole?.member_refs ?? [];
  members.forEach((memberRef, index) => {
    if (placed.has(memberRef)) return;
    placed.add(memberRef);
    if (scheme === "ql-constellation") {
      const position = index % SIXFOLD;
      const ring = Math.floor(index / SIXFOLD);
      const at = polar(-90 + 60 * position, MEMBER_RING_RADIUS * Math.pow(RING_GROWTH, ring));
      nodes.push({ ref: memberRef, role: "member", x: at.x, y: at.y, position, ring });
    } else {
      const at = polar(-90 + (360 / members.length) * index, MEMBER_RING_RADIUS);
      nodes.push({ ref: memberRef, role: "member", x: at.x, y: at.y, position: null, ring: 0 });
    }
  });

  const address = reading.ql?.address;
  if (scheme === "ql-constellation" && typeof address === "string" && address.trim().length > 0 && !placed.has(address)) {
    const at = polar(90, ADDRESS_RADIUS);
    nodes.push({ ref: address, role: "ql-address", x: at.x, y: at.y, position: null, ring: 0 });
    placed.add(address);
  }

  const edges: ConstellationEdge[] = (reading.whole?.relations ?? []).map((relation) => ({
    relation: relation.relation,
    from_ref: relation.from_ref,
    to_ref: relation.to_ref,
    origin: relation.origin ?? null,
    origin_ref: relation.origin_ref ?? null,
  }));

  return { scheme, whole_ref: wholeRef, nodes, edges };
}

/** Layer manual arrangement over a computed layout. Pure and idempotent for
 * the same overrides; unknown refs are ignored; the input layout and — there
 * being no reading parameter at all — the reading are untouched. */
export function applyManualOverrides(layout: ConstellationLayout, overrides: LayoutOverrides): ConstellationLayout {
  return {
    ...layout,
    nodes: layout.nodes.map((node) => {
      const override = overrides[node.ref];
      return override ? { ...node, x: override.x, y: override.y } : node;
    }),
  };
}
