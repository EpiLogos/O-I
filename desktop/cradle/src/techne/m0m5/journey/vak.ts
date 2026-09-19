/**
 * The Journey's C′ compositional binding (L5 Technē T5 — issue #216, §6).
 *
 * Journey CONSUMES the accepted Vāk/C′ vocabulary; it implements no second
 * C′ language. The canonical system: QL-MEF `crates/ql-mef/src/cprime_oikonomia.rs`
 * (accepted #138; CS source ref
 * `docs/kernel-rebuild/VAK-OIKONOMIA-KNOWLEDGE-RETURN.md#14-cs-the-actual-passage-through-paired-positions`)
 * and `docs/integrations/epi-logos/TA-ONTA-VAK-COMPOSITIONAL-EXECUTION-LOCK.md`.
 * The CS passages below are that file's `CsProfile::pairs`, transcribed
 * EXACTLY (CS0 full traverse … CS5 direct synthesis, forward-synthesis and
 * returning-inquiry directions); a drifted transcription is a contract bug
 * and the tests pin it.
 *
 * Materiality law (Vāk lock §3: "Recording these labels is not acceptance"):
 * a binding whose fields change nothing is refused here, and every field that
 * IS bound changes the traversal or the composition for real —
 *   CF  must equal the reading's WARRANTED `ql.context_frame_ref`, verbatim
 *       (no invented constitutional voice);
 *   CP  per scene is authored (Journey is the authoring instrument) and the
 *       CS passage VISITS positions — scenes at unvisited positions drop out
 *       of the traversal, so CP membership changes what plays;
 *   CS  profile + direction determine the actual hop order of the traversal;
 *   CFP thread form changes the step structure: CFP1 plays a hop's positions
 *       as one chord step; CFP2 (chained) requires the passage's `to` to
 *       hand the next hop its `from` and is refused otherwise; CFP3 appends
 *       one fused step over every visited scene; CFP4 sustains the last step
 *       (drone, with explicit stop); CFP5 (nested/canon) is refused inside a
 *       single traversal — one composition becoming a participant inside
 *       another needs the parent composition owner, not this surface;
 *   CPF participation regime governs agent operation (see ./agent): under
 *       `human-engaged` a Technē_3 proposal is marked for human acceptance;
 *   CT  gates what material a composed scene proposal must carry (./compose).
 *
 * The binding lives in the local composition draft until routed; the routed
 * input carries it verbatim (./sequence). Nothing here persists.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { TechneReading } from "../../contract.ts";
import type { JourneyBeat } from "./beats.ts";

/** C1′ Content Type — what material burden a scene carries (Vāk lock §4). */
export type CtKind = "CT0" | "CT1" | "CT2" | "CT3" | "CT4" | "CT5";

/** C2′ Context Position — 4.0 ground … 4.5 integration (Vāk lock §5). */
export type CpPosition = "4.0" | "4.1" | "4.2" | "4.3" | "4.4" | "4.5";

/** C4′ thread form (Vāk lock §6). CFP5 is named for honesty but refused
 * inside a single traversal (see module header). */
export type CfpForm = "CFP0" | "CFP1" | "CFP2" | "CFP3" | "CFP4" | "CFP5";

/** C0′ participation regime (Vāk lock §3). */
export type CpfRegime = "human-engaged" | "authorised-autonomous";

/** C5′ profile + direction — the exact accepted CsProfile set. */
export type CsProfile = "CS0" | "CS1" | "CS2" | "CS3" | "CS4" | "CS5";
export type CsDirection = "forward-synthesis" | "returning-inquiry";

/** The canonical CS passages: `CsProfile::pairs` in
 * crates/ql-mef/src/cprime_oikonomia.rs, verbatim. Position values are the
 * CP digits 0–5 (4.0 → 0 … 4.5 → 5). */
export const CS_PASSAGES: Readonly<Record<CsProfile, readonly (readonly [number, number])[]>> = {
  CS0: [[0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0]],
  CS1: [[0, 5], [1, 4]],
  CS2: [[0, 5], [1, 4], [2, 3]],
  CS3: [[0, 5], [1, 4], [2, 3], [3, 2]],
  CS4: [[0, 5], [4, 1], [5, 0]],
  CS5: [[0, 5], [5, 0]],
};

const CP_INDEX: Readonly<Record<CpPosition, number>> = {
  "4.0": 0,
  "4.1": 1,
  "4.2": 2,
  "4.3": 3,
  "4.4": 4,
  "4.5": 5,
};

export const CP_LABEL: Readonly<Record<CpPosition, string>> = {
  "4.0": "ground",
  "4.1": "definition",
  "4.2": "operation",
  "4.3": "pattern",
  "4.4": "context",
  "4.5": "integration",
};

/** The C′ binding: authored Journey composition state over real scene refs. */
export interface VakBinding {
  /** C0′ participation regime. */
  cpf: CpfRegime;
  /** C1′ content type per scene_ref — the material burden each scene carries. */
  ct: { scene_ref: string; ct: CtKind }[];
  /** C2′ context position per scene_ref. */
  cp: { scene_ref: string; cp: CpPosition }[];
  /** C3′ context frame — the reading's warranted `ql.context_frame_ref`,
   * verbatim. Carried, never authored here. */
  cf_ref: string;
  /** C4′ thread form. */
  cfp: CfpForm;
  /** C5′ passage. */
  cs: CsProfile;
  direction: CsDirection;
}

/** One traversal step: the scenes playing, under which hop. */
export interface TraversalStep {
  hop: number;
  from: CpPosition;
  to: CpPosition;
  /** CFP1 chord: the whole hop plays as one step. */
  chord: boolean;
  scene_refs: string[];
  /** CFP4 sustained: the step is a drone with explicit stop. */
  sustained: boolean;
  /** CFP3 fusion: the step is the fused whole over every visited scene. */
  fusion: boolean;
}

export interface VakTraversal {
  binding: VakBinding;
  steps: TraversalStep[];
  /** Scene refs the passage does not visit — data, disclosed, never hidden. */
  unvisited: string[];
}

export interface VakGate {
  binding: VakBinding;
  reason: null;
}
export interface VakRefusal {
  binding: VakBinding;
  reason: string;
}

/** True when the reading WARRANTS a Vāk source binding (the only door through
 * which a C′ binding may exist): a warranted ql facet carrying both a
 * vak_source_ref and the context_frame_ref the binding must name. */
export function vakWarranted(reading: TechneReading): boolean {
  return reading.ql !== undefined
    && typeof reading.ql.vak_source_ref === "string"
    && reading.ql.vak_source_ref.trim().length > 0
    && typeof reading.ql.context_frame_ref === "string"
    && reading.ql.context_frame_ref.trim().length > 0;
}

/** Validate-then-produce: a binding is accepted only when the reading
 * warrants Vāk, the CF names the warranted frame verbatim, and every scene
 * the binding annotates is one the reading discloses. Refusals carry the
 * reason — a refused binding is never silently repaired. */
export function bindVak(binding: VakBinding, reading: TechneReading, beats: readonly JourneyBeat[]): VakGate | VakRefusal {
  if (!vakWarranted(reading)) {
    return { binding, reason: "no warranted Vāk binding on this reading (ql.vak_source_ref / ql.context_frame_ref absent) — C′ composition is unavailable and is not simulated" };
  }
  if (binding.cf_ref !== reading.ql?.context_frame_ref) {
    return { binding, reason: `CF ${binding.cf_ref} is not the reading's warranted context frame ${String(reading.ql?.context_frame_ref)} — the constitutional voice is carried from the warrant, never invented` };
  }
  const disclosed = new Set(beats.map((beat) => beat.scene_ref));
  for (const entry of [...binding.cp, ...binding.ct]) {
    if (!disclosed.has(entry.scene_ref)) {
      return { binding, reason: `scene ${entry.scene_ref} is not disclosed by reading ${reading.reading_ref} — C′ annotations attach to disclosed scenes only` };
    }
  }
  const cpScenes = new Set(binding.cp.map((entry) => entry.scene_ref));
  for (const scene of disclosed) {
    if (!cpScenes.has(scene)) {
      return { binding, reason: `scene ${scene} carries no CP position — a C′ passage needs every scene positioned, or no binding at all` };
    }
  }
  if (binding.cfp === "CFP2" && !chainHolds(binding)) {
    return { binding, reason: `CFP2 (chained) cannot perform ${binding.cs} ${binding.direction}: the passage's hops do not hand each next hop its from-position — choose a chain-compatible passage or another thread form` };
  }
  if (binding.cfp === "CFP5") {
    return { binding, reason: "CFP5 (nested/canon) makes one composition a participant inside another — it needs the parent composition owner, not a single traversal; recorded, not simulated here" };
  }
  return { binding, reason: null };
}

/** CFP2 chain law: every hop after the first must begin where the previous
 * hop ended (the previous Return is the next contribution's material). */
function chainHolds(binding: VakBinding): boolean {
  const hops = CS_PASSAGES[binding.cs];
  const dirTo = (pair: readonly [number, number]): number => binding.direction === "forward-synthesis" ? pair[1] : pair[0];
  const dirFrom = (pair: readonly [number, number]): number => binding.direction === "forward-synthesis" ? pair[0] : pair[1];
  for (let i = 1; i < hops.length; i += 1) {
    if (dirTo(hops[i - 1]) !== dirFrom(hops[i])) return false;
  }
  return true;
}

function positionOf(binding: VakBinding, sceneRef: string): CpPosition {
  const entry = binding.cp.find((candidate) => candidate.scene_ref === sceneRef);
  if (!entry) throw new Error(`scene ${sceneRef} carries no CP position — the binding was not validated`);
  return entry.cp;
}

/** Apply the binding: the traversal the C′ composition actually determines.
 *
 * Two laws keep the traversal honest:
 *   - a scene plays at its FIRST visit only — a passage that passes a
 *     position twice (CS0's 4.2↔4.3 pair does) does not replay its scenes;
 *   - CFP changes the step STRUCTURE, not just a label: CFP0 (one voice)
 *     walks each hop as `from`-position scenes then `to`-position scenes —
 *     separate steps; CFP1 (chord) plays each hop's positions as ONE step.
 *
 * Scenes at positions the passage never visits drop out — disclosed as
 * `unvisited`, never silently dropped and never re-added. */
export function applyVakTraversal(binding: VakBinding, beats: readonly JourneyBeat[]): VakTraversal {
  const hops = CS_PASSAGES[binding.cs];
  const steps: TraversalStep[] = [];
  const visited = new Set<string>();
  const asPosition = (index: number): CpPosition => {
    for (const [cp, value] of Object.entries(CP_INDEX)) {
      if (value === index) return cp as CpPosition;
    }
    throw new Error(`CS passage named position ${index} — outside 4.0–4.5`);
  };
  const positionScenes = (index: number): string[] =>
    beats
      .filter((beat) => CP_INDEX[positionOf(binding, beat.scene_ref)] === index && !visited.has(beat.scene_ref))
      .map((beat) => beat.scene_ref);
  const markVisited = (scenes: string[]): void => {
    for (const scene of scenes) visited.add(scene);
  };
  hops.forEach((pair, hop) => {
    const [left, right] = pair;
    const [from, to] = binding.direction === "forward-synthesis" ? [left, right] : [right, left];
    const fromScenes = positionScenes(from);
    const toScenes = positionScenes(to);
    if (binding.cfp === "CFP1") {
      if (!fromScenes.length && !toScenes.length) return;
      steps.push({
        hop,
        from: asPosition(from),
        to: asPosition(to),
        chord: true,
        scene_refs: [...fromScenes, ...toScenes],
        sustained: false,
        fusion: false,
      });
      markVisited([...fromScenes, ...toScenes]);
      return;
    }
    if (fromScenes.length) {
      steps.push({ hop, from: asPosition(from), to: asPosition(to), chord: false, scene_refs: fromScenes, sustained: false, fusion: false });
      markVisited(fromScenes);
    }
    if (toScenes.length) {
      steps.push({ hop, from: asPosition(from), to: asPosition(to), chord: false, scene_refs: toScenes, sustained: false, fusion: false });
      markVisited(toScenes);
    }
  });
  if (binding.cfp === "CFP4" && steps.length) {
    // The drone: the final step sustains with an explicit stop (the surface
    // holds it and shows Stop; it never loops on its own).
    steps[steps.length - 1].sustained = true;
  }
  if (binding.cfp === "CFP3") {
    const fused = beats.filter((beat) => visited.has(beat.scene_ref)).map((beat) => beat.scene_ref);
    if (fused.length) {
      const last = hops[hops.length - 1];
      const [from, to] = binding.direction === "forward-synthesis" ? [last[0], last[1]] : [last[1], last[0]];
      steps.push({ hop: hops.length, from: asPosition(from), to: asPosition(to), chord: false, scene_refs: fused, sustained: false, fusion: true });
    }
  }
  const unvisited = beats.map((beat) => beat.scene_ref).filter((scene) => !visited.has(scene));
  return { binding, steps, unvisited };
}

/** Flat play order under the binding — what Play actually walks. */
export function vakPlayOrder(traversal: VakTraversal): string[] {
  return traversal.steps.flatMap((step) => step.scene_refs);
}

/** The C′ annotations for one scene (what the scene card shows). */
export function sceneCPrime(binding: VakBinding, sceneRef: string): { cp: CpPosition; ct: CtKind | null } {
  const cp = positionOf(binding, sceneRef);
  const ct = binding.ct.find((entry) => entry.scene_ref === sceneRef)?.ct ?? null;
  return { cp, ct };
}
