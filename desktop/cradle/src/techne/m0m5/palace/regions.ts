/**
 * The Palace integral architecture (L5 Technē M5′, QL-MEF #218) — regions
 * composed from the reading's REAL refs, in the canonical traversal order
 * M0′→M5′ (dual-reading lock §12).
 *
 * Laws carried here:
 *   - every entry ref is a native ref of the reading, verbatim — never
 *     minted, re-keyed or shortened; regions are GROUPINGS of those refs,
 *     not a second graph, Wiki, Scene type or source store;
 *   - a region exists only when the reading actually discloses refs for it;
 *     absent facets are absent regions (honest absence, never padding);
 *   - each entry names its native instrument aperture; whether that
 *     instrument is actually openable is the reading's own disclosure,
 *     checked at render, never baked in here;
 *   - architecture is honest about its warrant: a region whose form stands
 *     in a warranted QL reading says so with the warrant's own refs; every
 *     other region says plainly that its arrangement is free mnemonic
 *     composition — decorative pseudo-QL is refused;
 *   - no stochastic identity: every derivation is a pure function of its
 *     inputs.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechneInstrument, TechneReading } from "../../contract.ts";
import { clampLocus, locusKey, locusOrder, PALACE_LOCI_PER_ROOM, PALACE_ROOMS, type PalaceLocus } from "./composition.ts";

/** The region keys, in canonical traversal order M0′→M5′; sources and the
 * situated-Agency floor close the walk. */
export type PalaceRegionKey =
  | "ground"
  | "canvas"
  | "relation"
  | "journey"
  | "world"
  | "expression"
  | "sources"
  | "agency";

export const PALACE_REGION_ORDER: readonly PalaceRegionKey[] = [
  "ground",
  "canvas",
  "relation",
  "journey",
  "world",
  "expression",
  "sources",
  "agency",
];

/** One composable native object: the ref is the reading's own, verbatim. */
export interface PalaceRegionEntry {
  kind: PalaceRegionKey;
  ref: string;
  revision?: string | null;
  label: string;
  /** The native instrument aperture this object opens into; null when the
   * object has no instrument surface and its depth stays in the palace. */
  open_instrument: TechneInstrument | null;
  /** Owner-vocabulary note carried verbatim (place relation, standing,
   * temporal kind, warrant class). Never invented. */
  note?: string;
  /** The underlying facet's own source ref, verbatim, when the facet names
   * one — grounding the entry in the reading's own terms. */
  source?: string | null;
}

/** One region of the integral whole. */
export interface PalaceRegion {
  key: PalaceRegionKey;
  /** The M′ office; null for the sources/agency closes. */
  m_prime: number | null;
  office: string;
  entries: PalaceRegionEntry[];
}

/** Regions of the reading, in canonical traversal order, containing only the
 * ref families the reading actually discloses. */
export function palaceRegions(reading: TechneReading): PalaceRegion[] {
  const regions = new Map<PalaceRegionKey, PalaceRegion>();
  const add = (region: PalaceRegion) => regions.set(region.key, region);

  // M0′ ground: the bounded whole and its members.
  const ground: PalaceRegionEntry[] = [];
  if (reading.whole) {
    ground.push({
      kind: "ground",
      ref: reading.whole.whole_ref,
      label: "bounded whole",
      open_instrument: "project",
    });
    for (const ref of reading.whole.member_refs ?? []) {
      ground.push({ kind: "ground", ref, label: "member", open_instrument: "project" });
    }
  }
  if (ground.length > 0) add({ key: "ground", m_prime: 0, office: "Project / ground", entries: ground });

  // M1′ canvas: the warranted constellation/shape/address refs.
  const canvas: PalaceRegionEntry[] = [];
  const ql = reading.ql;
  if (ql) {
    for (const [ref, label] of [
      [ql.constellation_ref, "constellation"],
      [ql.shape_ref, "shape"],
      [ql.address, "address"],
    ] as const) {
      if (typeof ref === "string" && ref.trim()) {
        canvas.push({
          kind: "canvas",
          ref,
          label,
          open_instrument: "canvas",
          note: ql.warrant.result_class,
        });
      }
    }
  }
  if (canvas.length > 0) add({ key: "canvas", m_prime: 1, office: "Canvas / constellation", entries: canvas });

  // M2′ relation field: the temporal facets' continuity refs.
  const relation: PalaceRegionEntry[] = [];
  for (const facet of reading.temporal ?? []) {
    const carriers: [string | undefined, string, string | undefined][] = [
      [facet.day_ref, "day", facet.day_ref ? facet.kind : undefined],
      [facet.now_ref, "now", facet.now_ref ? facet.kind : undefined],
      [facet.session_ref, "session", facet.session_ref ? facet.kind : undefined],
      [facet.run_ref, "run", facet.run_ref ? facet.kind : undefined],
      [facet.attempt_ref, "attempt", facet.attempt_ref ? facet.kind : undefined],
      [facet.return_ref, "return", facet.return_ref ? facet.kind : undefined],
    ];
    for (const [ref, label, kind] of carriers) {
      if (typeof ref === "string" && ref.trim()) {
        relation.push({
          kind: "relation",
          ref,
          label,
          open_instrument: "timeline",
          note: facet.facet_ref ?? kind ?? facet.kind,
          source: facet.source_ref ?? null,
        });
      }
    }
  }
  if (relation.length > 0) add({ key: "relation", m_prime: 2, office: "Relation field", entries: relation });

  // M3′ journey: the bound scenes.
  const journey: PalaceRegionEntry[] = [];
  for (const binding of reading.expressions ?? []) {
    if (binding.scene_ref) {
      journey.push({
        kind: "journey",
        ref: binding.scene_ref,
        revision: binding.revision,
        label: "scene",
        open_instrument: "journey",
        note: binding.expression_ref,
      });
    }
  }
  if (journey.length > 0) add({ key: "journey", m_prime: 3, office: "Journey / scenes", entries: journey });

  // M4′ world: the place readings.
  const world: PalaceRegionEntry[] = [];
  for (const place of reading.spatial ?? []) {
    world.push({
      kind: "world",
      ref: place.place_ref,
      label: place.identity?.names?.[0]?.name ?? "place",
      open_instrument: "place",
      note: [place.relation, place.precision].filter(Boolean).join(" · ") || undefined,
      source: place.source_ref ?? null,
    });
  }
  if (world.length > 0) add({ key: "world", m_prime: 4, office: "World / places", entries: world });

  // 3:3 expression reading: the Expression bindings, verbatim.
  const expression: PalaceRegionEntry[] = (reading.expressions ?? []).map((binding) => ({
    kind: "expression" as const,
    ref: binding.expression_ref,
    revision: binding.revision,
    label: "expression",
    open_instrument: "expressions" as const,
    note: binding.composition_ref ? `composition ${binding.composition_ref}` : undefined,
  }));
  if (expression.length > 0) add({ key: "expression", m_prime: 5, office: "Expression (3:3)", entries: expression });

  // Sources: exact provenance, depth disclosed in the palace itself.
  const sources: PalaceRegionEntry[] = (reading.provenance ?? []).map((provenance) => ({
    kind: "sources" as const,
    ref: provenance.source_ref,
    revision: provenance.source_revision ?? null,
    label: "source",
    open_instrument: null,
    note: [provenance.native_owner, provenance.standing].filter(Boolean).join(" · ") || undefined,
  }));
  if (sources.length > 0) add({ key: "sources", m_prime: null, office: "Sources / provenance", entries: sources });

  // The situated-Agency floor: role bindings co-referenced, never executed.
  const agency: PalaceRegionEntry[] = [];
  for (const binding of reading.agency ?? []) {
    const ref = binding.agent_session_ref ?? binding.guardian_ref;
    if (typeof ref === "string" && ref.trim()) {
      agency.push({
        kind: "agency",
        ref,
        label: `${binding.role} M′${binding.m_index}`,
        open_instrument: null,
        note: binding.role,
      });
    }
  }
  if (agency.length > 0) add({ key: "agency", m_prime: null, office: "Situated agencies", entries: agency });

  return PALACE_REGION_ORDER.map((key) => regions.get(key)).filter((region) => region !== undefined);
}

// ---------------------------------------------------------------------------
// Region arrangement — the method of loci, one bounded space per region
// ---------------------------------------------------------------------------

/** One placement inside a region: which native ref stands at which locus.
 * Presentation only. */
export interface PalaceRegionPlacement {
  ref: string;
  locus: PalaceLocus;
}

/** The deterministic initial placements of a region's entries: reading order
 * over the loci of the bounded space, rooms row-major. Same bounds and walk
 * as the expression arrangement (composition.ts). */
export function defaultRegionPlacements(entries: readonly PalaceRegionEntry[]): PalaceRegionPlacement[] {
  return entries
    .map((entry, index) => {
      const roomIndex = Math.floor(index / PALACE_LOCI_PER_ROOM);
      return {
        ref: entry.ref,
        locus: clampLocus({
          room: {
            column: roomIndex % PALACE_ROOMS.columns,
            row: Math.floor(roomIndex / PALACE_ROOMS.columns),
          },
          locus: index % PALACE_LOCI_PER_ROOM,
        }),
      };
    })
    .sort((a, b) => locusOrder(a.locus, b.locus));
}

/** Move one entry to a locus; an occupied locus swaps. Pure: returns a new
 * placement list; the reading and every other surface are untouched. */
export function arrangeRegion(
  placements: readonly PalaceRegionPlacement[],
  ref: string,
  locus: PalaceLocus,
): PalaceRegionPlacement[] {
  const target = clampLocus(locus);
  const moved = placements.find((placement) => placement.ref === ref);
  if (!moved) return [...placements];
  if (locusKey(moved.locus) === locusKey(target)) return [...placements];
  const displaced = placements.find((placement) => placement.ref !== ref && locusKey(placement.locus) === locusKey(target));
  const next = placements.map((placement): PalaceRegionPlacement => {
    if (placement.ref === ref) return { ref, locus: target };
    if (displaced && placement.ref === displaced.ref) return { ref: placement.ref, locus: moved.locus };
    return placement;
  });
  return next.sort((a, b) => locusOrder(a.locus, b.locus));
}

/** The entry refs of a region in spatial walk order. */
export function regionOrder(placements: readonly PalaceRegionPlacement[]): string[] {
  return [...placements].sort((a, b) => locusOrder(a.locus, b.locus)).map((placement) => placement.ref);
}

// ---------------------------------------------------------------------------
// Architecture honesty — why a region has its form
// ---------------------------------------------------------------------------

/** The honest explanation of one region's form. A region stands in a
 * warranted QL reading only when the reading's own warrant says so; the
 * explanation quotes that warrant's refs verbatim. Everything else says
 * plainly that it is free mnemonic composition over the reading's refs. */
export function regionArchaeology(reading: TechneReading, region: PalaceRegion): string {
  const ql = reading.ql;
  if (region.key === "canvas" && ql) {
    const structure = [ql.address, ql.shape_ref, ql.constellation_ref].filter(Boolean).join(" · ");
    return `stands in the warranted QL reading (${ql.warrant.result_class}; ${structure}) — derivation ${ql.warrant.provenance_ref}`;
  }
  if (region.key === "expression" && reading.expressions?.some((binding) => binding.composition_ref)) {
    return "composes the Expression owner's own composition ref; arrangement here is presentation state";
  }
  return "free mnemonic composition over the reading's own refs — no warranted QL structure stands behind this form";
}
