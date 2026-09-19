/**
 * The Journey's structured agency state (L5 Technē T5 — issue #216, §8) —
 * what `Aletheia_3 / Technē_3` can INSPECT and OPERATE.
 *
 * Law (wayfinder §16, dual-reading lock §16): each instrument publishes
 * sufficient structured state for its situated Agency to perceive — current
 * subject, active instrument/cut, selection, source/revision provenance,
 * available native Actions, current scene focus, authority and disclosure
 * limits — and Agent operation uses the SAME ActionRefs as human operation,
 * never DOM/WebGL scraping, never a private chat loop, never a hidden command
 * queue. This module is that publication for M3′: a pure, deterministic,
 * JSON-safe reading of the Journey's own state. It executes nothing; the
 * governed operations it exposes go through the same routed ActionRefs the
 * human surface uses (./sequence's reorder proposal, ./compose's composition
 * proposal) with the C0′ participation regime attached — under
 * `human-engaged` a Technē_3-proposed change is marked for human acceptance;
 * the instrument itself still writes nothing.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {
  DisclosureSelection,
  TechneInstrument,
  TechneReading,
} from "../../contract.ts";
import type { JourneyBeat } from "./beats.ts";
import type { SequenceDraft } from "./sequence.ts";
import { cutFor } from "./crossing.ts";
import type { VakBinding, VakTraversal } from "./vak.ts";

/** The situated role this state addresses: Aletheia_3 = M3 × S5′, whose
 * operative role while inhabiting M3′ is Technē_3. */
export const TECHNE_3_ROLE = "aletheia_3/techne_3";
export const JOURNEY_M_PRIME = 3;

/** The structured Journey state an Agency may inspect. JSON-safe throughout:
 * an agent session receives this through the ordinary disclosure channel,
 * not by reading the DOM. */
export interface JourneyAgentState {
  contract: "ql.techne/v1";
  role: typeof TECHNE_3_ROLE;
  instrument: TechneInstrument;
  m_prime: typeof JOURNEY_M_PRIME;
  application_cut: ReturnType<typeof cutFor>;
  subject_ref: string;
  reading_ref: string;
  snapshot_revision: string | null;
  selection_ref: string;
  selection_standing: string | null;
  agent_session_ref: string | null;
  /** Ordered scene refs with the revisions they stand on — the traversal. */
  sequence: { expression_ref: string; revision: string | null; scene_refs: { scene_ref: string; revision: string | null }[] }[];
  /** The current position: the scene the Journey is on, when one is. */
  current_scene_ref: string | null;
  /** Per-scene source/subject bindings — the source basis of the traversal. */
  source_basis: {
    scene_ref: string;
    subject_ref: string;
    sources: { source_ref: string; source_revision: string | null; standing: string | null }[];
  }[];
  /** Native Actions the reading discloses — the only mutation channel. */
  available_actions: { action_ref: string; native_owner: string; authority: string }[];
  /** C′ readings where ACTUALLY bound — absent when no warranted binding. */
  c_prime: null | {
    cpf: VakBinding["cpf"];
    cf_ref: string;
    cfp: VakBinding["cfp"];
    cs: VakBinding["cs"];
    direction: VakBinding["direction"];
    visited_scene_refs: string[];
    unvisited_scene_refs: string[];
  };
  /** The live 3:3 relation: the scene focus carried toward expressions. */
  expression_scene_focus_ref: string | null;
  /** Governance: what this Agency may propose and under which regime. */
  governance: {
    cpf_regime: "human-engaged" | "authorised-autonomous" | null;
    /** Under human-engaged, Technē_3 changes are proposals awaiting human
     * acceptance; under authorised-autonomous they are commissioned. */
    techne_3_operation: "propose-await-human-acceptance" | "commissioned" | "unavailable";
    limits: string[];
  };
}

/** Build the state. Refs ride verbatim from the reading/selection/draft;
 * nothing is inferred beyond what the inputs disclose. */
export function journeyAgentState(input: {
  reading: TechneReading;
  selection: DisclosureSelection;
  beats: readonly JourneyBeat[];
  drafts: Readonly<Record<string, SequenceDraft>>;
  currentSceneRef: string | null;
  vak?: { binding: VakBinding; traversal: VakTraversal } | null;
}): JourneyAgentState {
  const { reading, selection, beats, drafts, currentSceneRef, vak } = input;
  const byExpression = new Map<string, { revision: string | null; scene_refs: { scene_ref: string; revision: string | null }[] }>();
  for (const beat of beats) {
    let group = byExpression.get(beat.expression_ref);
    if (!group) {
      group = { revision: beat.revision, scene_refs: [] };
      byExpression.set(beat.expression_ref, group);
    }
    group.scene_refs.push({ scene_ref: beat.scene_ref, revision: beat.revision });
  }
  const sequence = [...byExpression.entries()].map(([expression_ref, group]) => {
    const draft = drafts[expression_ref];
    const order = draft?.scene_order ?? group.scene_refs.map((entry) => entry.scene_ref);
    const index = new Map(order.map((scene_ref, position) => [scene_ref, position]));
    const sceneRefs = group.scene_refs.slice().sort(
      (a, b) => (index.get(a.scene_ref) ?? order.length) - (index.get(b.scene_ref) ?? order.length),
    );
    return { expression_ref, revision: draft?.revision ?? group.revision, scene_refs: sceneRefs };
  });
  const warrantedCpf = vak?.binding.cpf ?? null;
  return {
    contract: "ql.techne/v1",
    role: TECHNE_3_ROLE,
    instrument: "journey",
    m_prime: JOURNEY_M_PRIME,
    application_cut: cutFor("journey"),
    subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref,
    snapshot_revision: reading.snapshot?.revision ?? null,
    selection_ref: selection.selection_ref,
    selection_standing: selection.selection_standing ?? null,
    agent_session_ref: selection.agent_session_ref ?? null,
    sequence,
    current_scene_ref: currentSceneRef,
    source_basis: beats.map((beat) => ({
      scene_ref: beat.scene_ref,
      subject_ref: beat.frame.subject_ref,
      sources: beat.frame.sources.map((source) => ({
        source_ref: source.source_ref,
        source_revision: source.source_revision,
        standing: (reading.provenance ?? []).find((entry) => entry.source_ref === source.source_ref)?.standing ?? null,
      })),
    })),
    available_actions: (reading.actions ?? []).map((action) => ({
      action_ref: action.action_ref,
      native_owner: action.native_owner,
      authority: action.authority,
    })),
    c_prime: vak
      ? {
          cpf: vak.binding.cpf,
          cf_ref: vak.binding.cf_ref,
          cfp: vak.binding.cfp,
          cs: vak.binding.cs,
          direction: vak.binding.direction,
          visited_scene_refs: vak.traversal.steps.flatMap((step) => step.scene_refs),
          unvisited_scene_refs: [...vak.traversal.unvisited],
        }
      : null,
    expression_scene_focus_ref: currentSceneRef,
    governance: {
      cpf_regime: warrantedCpf,
      techne_3_operation: warrantedCpf === null
        ? "unavailable"
        : warrantedCpf === "human-engaged"
          ? "propose-await-human-acceptance"
          : "commissioned",
      limits: [
        "the journey instrument writes nothing — scene order and composition proposals route to the Expression owner under its own authority",
        "agent operation uses the reading's disclosed ActionRefs, the same refs the human surface uses",
        "no private story store: scene identity is the Expression substrate's",
      ],
    },
  };
}

/** The governance annotation for a Technē_3-authored route: the C0′ regime
 * determines how the proposal stands, never whether the owner executes it —
 * authority stays the owner's. */
export function techne3OperationStanding(state: JourneyAgentState): { standing: JourneyAgentState["governance"]["techne_3_operation"]; note: string } {
  switch (state.governance.techne_3_operation) {
    case "propose-await-human-acceptance":
      return { standing: state.governance.techne_3_operation, note: "C0′ human-engaged: this Technē_3 change is a proposal — a human accepts or refuses it before the owner's revision discipline applies" };
    case "commissioned":
      return { standing: state.governance.techne_3_operation, note: "C0′ authorised-autonomous: this Technē_3 change is commissioned; it still routes through the owner's ActionRef and revision discipline" };
    case "unavailable":
      return { standing: state.governance.techne_3_operation, note: "no C0′ regime is bound — governed agent operation is unavailable; the state stays inspectable" };
  }
}
