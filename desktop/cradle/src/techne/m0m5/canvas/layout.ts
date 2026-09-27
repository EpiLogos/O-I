/**
 * The Canvas/Constellation layout (L5 Technē T2) — deterministic, React-free
 * geometry over ONE ql.techne/v1 reading. There is no second graph substrate
 * here: the bounded whole, its members and its typed relations are the only
 * entities, taken verbatim from the reading; layout is pure presentation
 * derived from them.
 *
 * Two schemes, chosen by DECLARED position, never by member count or array
 * order (owner commission, QL-MEF #214 geometry-closeout: no
 * cardinality-guessed sixfold ring — a structured whole moves only by its
 * OWN declared structure):
 *
 *   - "ql-constellation" — engages only when at least one member carries a
 *     genuinely DECLARED sixfold position, passed in via `declaredPositions`
 *     (ref → 0..=5, e.g. resolved from the reading's own `ql.constellation_ref`
 *     against its owning shape/constellation registry — ql.techne/v1 itself
 *     carries no per-member position field today, so nothing here may invent
 *     one from `member_refs` order). A declared member takes its own
 *     constellation position 0..=5 around the whole — position 0 at the top
 *     (−90°), clockwise at 60° steps (SVG y-down coordinates); positions
 *     ≥ 6 continue the same six angles on outer rings (radius × 1.45 per
 *     extra sixfold). A member the caller never declared a position for
 *     keeps `position: null` and is placed in the open arrangement below —
 *     it is never backfilled into the ring by its index.
 *     Independently, when the reading's own `ql` facet is warranted and
 *     discloses `address`, that single reading-level coordinate anchors on
 *     the bottom axis (90°) at radius 4/3 × the member ring, outside the
 *     constellation — the warrant's own address, not a guessed member slot;
 *     it renders whether or not any member position was declared.
 *
 *   - "radial" — the open arrangement: no member carries a declared
 *     position (or the reading discloses no warranted `ql` facet at all).
 *     Members are spaced evenly on one circle around the whole, clockwise
 *     from the top, in member_refs order. This is presentation only — no
 *     QL form is implied by it.
 *
 * Same input → same output, always: no clocks, no randomness, no iteration
 * order beyond the reading's own arrays (and the caller-supplied declared
 * positions, themselves keyed by ref, never by index). Native refs are
 * opaque and carried verbatim; relation vocabulary is preserved verbatim as
 * edge labels.
 *
 * Manual visual arrangement (dragging a node somewhere) is PRESENTATION
 * state: `applyManualOverrides` layers ref-keyed positions over a computed
 * layout and has no reading parameter — it can never feed back into the
 * reading. (§3: view, layout and camera state are inexpressible in the
 * contract.)
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechneReading } from "../../contract.ts";

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

/** Genuinely DECLARED sixfold member positions, ref → 0..=5 (or beyond, for
 * an outer ring). This is semantic input a caller resolved from the
 * reading's own warranted structure (its `ql.constellation_ref` against the
 * owning shape/constellation registry) — never derived here from array
 * index or member count. Absent (the default), no member position is
 * declared and layout never claims the "ql-constellation" scheme. */
export type DeclaredMemberPositions = Readonly<Record<string, number>>;

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

/** Compute the constellation layout of one reading. Pure: the reading and
 * `declaredPositions` are only read, never written; the output shares no
 * structure with either. `declaredPositions` carries genuinely DECLARED
 * sixfold member positions (ref → 0..=5+); omit it (or leave a member out
 * of it) when no such declaration exists — this function never guesses one
 * from `member_refs` order or count. */
export function computeLayout(
  reading: TechneReading,
  declaredPositions: DeclaredMemberPositions = {},
): ConstellationLayout {
  const wholeRef = reading.whole?.whole_ref ?? reading.subject.subject_ref;
  const qlWarranted = reading.ql !== undefined && reading.ql.warrant !== undefined;
  const members = reading.whole?.member_refs ?? [];
  const hasDeclaredMemberPosition = members.some((ref) => Number.isInteger(declaredPositions[ref]));
  const scheme: ConstellationScheme = hasDeclaredMemberPosition ? "ql-constellation" : "radial";

  const nodes: ConstellationNode[] = [
    { ref: wholeRef, role: "whole", x: 0, y: 0, position: null, ring: 0 },
  ];
  const placed = new Set<string>([wholeRef]);

  const openArrangementMembers = members.filter((ref) => !placed.has(ref));
  members.forEach((memberRef) => {
    if (placed.has(memberRef)) return;
    placed.add(memberRef);
    const declared = declaredPositions[memberRef];
    if (scheme === "ql-constellation" && Number.isInteger(declared)) {
      const position = ((declared % SIXFOLD) + SIXFOLD) % SIXFOLD;
      const ring = Math.floor(declared / SIXFOLD);
      const at = polar(-90 + 60 * position, MEMBER_RING_RADIUS * Math.pow(RING_GROWTH, ring));
      nodes.push({ ref: memberRef, role: "member", x: at.x, y: at.y, position, ring });
    } else {
      // No declared position for this member — open arrangement, never
      // backfilled into the sixfold ring by its index. Evenly spaced among
      // the OTHER undeclared members so a mixed warranted/undeclared whole
      // stays deterministic and readable.
      const openIndex = openArrangementMembers.indexOf(memberRef);
      const at = polar(-90 + (360 / openArrangementMembers.length) * openIndex, MEMBER_RING_RADIUS);
      nodes.push({ ref: memberRef, role: "member", x: at.x, y: at.y, position: null, ring: 0 });
    }
  });

  const address = reading.ql?.address;
  if (qlWarranted && typeof address === "string" && address.trim().length > 0 && !placed.has(address)) {
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
