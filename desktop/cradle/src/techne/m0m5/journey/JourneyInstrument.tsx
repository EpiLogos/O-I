/**
 * PORT (T3, 2026-09-19): ported into the O:I cradle from QL-MEF adapters/techne/surfaces/cradle/src/techne (main @ dbff5cc == techne/t9-integrated-field, byte-identical there); import specifiers re-pointed to the cradle seam. No semantic change.
 * The Journey instrument surface (M3′ — issue #216, the formal 4:2 ↔ 3:3
 * bridge) — reader/editor over the beats derived from the reading's own
 * Expression bindings (see ./beats). A Journey is an ordered reading of
 * scenes: scene refs, expression refs and revisions are shown verbatim; the
 * scene frame (time · place · subject · source) is composed from the
 * reading's disclosed facets; source cards open to their exact selector.
 *
 * The bridge (locked law — no second Journey scene ontology):
 *   - ENTER SCENE crosses the DisclosureSession onto the conjugate 3:3
 *     Expression reading carrying the exact scene ref in the selection's own
 *     focus (./crossing) — disclosure changes, identity does not;
 *   - RETURN restores the exact Journey position from that same focus
 *     (never an index guess) and says so;
 *   - PRESENCE (./presence) persists the position and the local draft across
 *     reload/re-entry — presentation state only; the Expression substrate
 *     stays the only semantic store;
 *   - COMPOSE turns the current selection into a routed scene-create
 *     proposal over the subject's bound Expression (./compose) — the exact
 *     selected refs ride verbatim; nothing is copied;
 *   - C′ (./vak) binds a Vāk/C′ composition when the reading WARRANTS one;
 *     the binding governs the traversal for real (CS passage, CFP thread
 *     form, CP membership) or is refused with its reason — never a label;
 *   - TECHNĒ_3 (./agent) publishes this state as structured, JSON-safe
 *     material; governed operation rides the same ActionRefs as the human.
 *
 * Reordering and pacing remain a LOCAL composition draft (./sequence) —
 * routed, never written here. The instrument persists nothing semantic.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { adapterForSource, techneSource } from "../adapter";
import type { TechneActionReceipt } from "../../contract";
import type { TechneSurfaceProps } from "../registry";
import { disclosureSession } from "../../session";
import { beats, type JourneyBeat } from "./beats";
import {
  composeProposal,
  DEFAULT_DWELL_SECONDS,
  draftFromBeats,
  dwellFor,
  moveBeat,
  orderChanged,
  paceBeat,
  type SequenceDraft,
} from "./sequence";
import { crossToExpression, returnPosition } from "./crossing";
import {
  JOURNEY_PRESENCE_KEY,
  basisStanding,
  defaultPresenceStorage,
  loadPresence,
  presenceFor,
  savePresence,
} from "./presence";
import { composeSceneProposal } from "./compose";
import {
  applyVakTraversal,
  bindVak,
  CP_LABEL,
  sceneCPrime,
  vakPlayOrder,
  vakWarranted,
  type CpPosition,
  type CtKind,
  type CpfRegime,
  type CfpForm,
  type CsDirection,
  type CsProfile,
  type VakBinding,
  type VakTraversal,
} from "./vak";
import { journeyAgentState, techne3OperationStanding } from "./agent";
import "./journey.css";

/** One Expression's beats, in binding order. */
interface BeatGroup {
  expression_ref: string;
  revision: string | null;
  order: JourneyBeat[];
}

function groupBeats(beatList: JourneyBeat[]): BeatGroup[] {
  const groups: BeatGroup[] = [];
  const index = new Map<string, BeatGroup>();
  for (const beat of beatList) {
    let group = index.get(beat.expression_ref);
    if (!group) {
      group = { expression_ref: beat.expression_ref, revision: beat.revision, order: [] };
      index.set(beat.expression_ref, group);
      groups.push(group);
    }
    group.order.push(beat);
  }
  return groups;
}

/** The displayed order of one group: the draft's order once a draft exists,
 * otherwise the reading's own binding order. */
function displayedOrder(group: BeatGroup, drafts: Record<string, SequenceDraft>): string[] {
  return drafts[group.expression_ref]?.scene_order ?? group.order.map((beat) => beat.scene_ref);
}

/** The author's C′ editing state — becomes a binding only through
 * `bindVak`, which validates it against the reading's warrant. */
interface VakDraft {
  cpf: CpfRegime;
  cfp: CfpForm;
  cs: CsProfile;
  direction: CsDirection;
  cp: Record<string, CpPosition>;
  ct: Record<string, CtKind>;
}

const VAK_DRAFT_DEFAULT: VakDraft = {
  cpf: "human-engaged",
  cfp: "CFP0",
  cs: "CS0",
  direction: "forward-synthesis",
  cp: {},
  ct: {},
};

const CP_OPTIONS: readonly CpPosition[] = ["4.0", "4.1", "4.2", "4.3", "4.4", "4.5"];
const CT_OPTIONS: readonly CtKind[] = ["CT0", "CT1", "CT2", "CT3", "CT4", "CT5"];
const CFP_OPTIONS: readonly CfpForm[] = ["CFP0", "CFP1", "CFP2", "CFP3", "CFP4", "CFP5"];
const CS_OPTIONS: readonly CsProfile[] = ["CS0", "CS1", "CS2", "CS3", "CS4", "CS5"];

export function JourneyInstrument({ session, selection, reading }: TechneSurfaceProps) {
  const [drafts, setDrafts] = useState<Record<string, SequenceDraft>>({});
  const [receipt, setReceipt] = useState<TechneActionReceipt | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [playIndex, setPlayIndex] = useState<number | null>(null);
  const [currentSceneRef, setCurrentSceneRef] = useState<string | null>(null);
  const [presenceNotice, setPresenceNotice] = useState<string | null>(null);
  const [vakDraft, setVakDraft] = useState<VakDraft>(VAK_DRAFT_DEFAULT);
  const [vakPanel, setVakPanel] = useState(false);
  const [vak, setVak] = useState<{ binding: VakBinding; traversal: VakTraversal } | null>(null);
  const [vakNote, setVakNote] = useState<string | null>(null);
  const [composeTitle, setComposeTitle] = useState("");
  const [composeCt, setComposeCt] = useState<CtKind | "">("");
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeReceipt, setComposeReceipt] = useState<TechneActionReceipt | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const hydrated = useRef(false);

  const model = useMemo(() => (reading ? beats(reading) : null), [reading]);
  const readingSignature = reading ? `${reading.reading_ref}:${reading.snapshot?.revision ?? ""}` : "";
  // A new reading basis ends the local draft, the receipts, play and the
  // binding — they belong to the reading they were taken from, never to the
  // surface.
  useEffect(() => {
    hydrated.current = false;
    setDrafts({});
    setReceipt(null);
    setProposalError(null);
    setPlayIndex(null);
    setCurrentSceneRef(null);
    setPresenceNotice(null);
    setVak(null);
    setVakNote(null);
    setVakDraft(VAK_DRAFT_DEFAULT);
    setComposeReceipt(null);
    setComposeError(null);
  }, [readingSignature]);

  const groups = useMemo(() => (model ? groupBeats(model.beats) : []), [model]);

  // Hydration: the exact position returns before anything saves. The live
  // session's scene focus (a Return from the Expression reading) wins; the
  // persisted presence (a reload/re-entry) carries the position and the
  // draft otherwise. A stale basis is dropped and named; a field-advanced
  // basis is restored AND named — the field moved while the author was away.
  useEffect(() => {
    if (!reading || !model || hydrated.current) return;
    hydrated.current = true;
    let restoredScene: string | null = null;
    if (session && session.instrument === "journey") {
      const back = returnPosition(session, model.beats);
      if (back.beat) {
        restoredScene = back.beat.scene_ref;
        setPresenceNotice(`Returned from the live Expression — position restored to ${back.beat.title} (${back.beat.scene_ref}).`);
      } else if (back.focus_ref) {
        setPresenceNotice(`The returning focus names ${back.focus_ref}, which this reading no longer discloses — the position was not guessed.`);
      }
    }
    const storage = defaultPresenceStorage();
    const entries = loadPresence(storage);
    const saved = entries[reading.subject.subject_ref];
    if (saved && !restoredScene) {
      const standing = basisStanding(saved, reading);
      if (standing === "stale") {
        delete entries[reading.subject.subject_ref];
        savePresence(storage, entries);
        setPresenceNotice(`The saved journey position belonged to reading ${saved.reading_ref} — it no longer applies here and was dropped.`);
      } else {
        const beat = model.beats.find((candidate) => candidate.scene_ref === saved.scene_ref);
        if (beat) {
          restoredScene = beat.scene_ref;
          if (saved.draft) {
            const byExpression = new Map(groups.map((group) => [group.expression_ref, group]));
            const group = byExpression.get(saved.expression_ref);
            if (group && saved.draft.scene_order.every((scene) => group.order.some((candidate) => candidate.scene_ref === scene))) {
              const restored = draftFromBeats(group.order, group.expression_ref);
              setDrafts((current) => ({
                ...current,
                [group.expression_ref]: {
                  ...restored,
                  scene_order: [...saved.draft!.scene_order],
                  pace: saved.draft!.pace.map((entry) => ({ ...entry })),
                },
              }));
            }
          }
          setPresenceNotice(
            standing === "field-advanced"
              ? `Re-entered at ${beat.title} — the reading basis has moved since (${saved.snapshot_revision ?? "unrevised"} → ${reading.snapshot?.revision ?? "unrevised"}); shown, never hidden.`
              : `Re-entered at ${beat.title} — the position and draft survived reload.`,
          );
        }
      }
    }
    if (restoredScene) setCurrentSceneRef(restoredScene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingSignature]);

  // Save presence on every position/draft move (presentation state only).
  useEffect(() => {
    if (!reading || !hydrated.current) return;
    const sceneRef = currentSceneRef ?? model?.beats[0]?.scene_ref;
    if (!sceneRef) return;
    const beat = model?.beats.find((candidate) => candidate.scene_ref === sceneRef);
    if (!beat) return;
    const draft = drafts[beat.expression_ref];
    const entries = loadPresence(defaultPresenceStorage());
    entries[reading.subject.subject_ref] = presenceFor({
      subject_ref: reading.subject.subject_ref,
      reading_ref: reading.reading_ref,
      snapshot_revision: reading.snapshot?.revision ?? null,
      expression_ref: beat.expression_ref,
      scene_ref: beat.scene_ref,
      draft: draft ? { scene_order: draft.scene_order, pace: draft.pace } : null,
    });
    savePresence(defaultPresenceStorage(), entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingSignature, currentSceneRef, drafts]);

  // Return: when the session comes back onto journey, restore the exact
  // position the scene focus names.
  const previousInstrument = useRef<string | null>(null);
  useEffect(() => {
    const instrument = session?.instrument ?? null;
    const cameBack = instrument === "journey" && previousInstrument.current !== null && previousInstrument.current !== "journey";
    previousInstrument.current = instrument;
    if (!cameBack || !session || !model) return;
    const back = returnPosition(session, model.beats);
    if (back.beat) {
      setCurrentSceneRef(back.beat.scene_ref);
      setPresenceNotice(`Returned from the live Expression — position restored to ${back.beat.title} (${back.beat.scene_ref}).`);
    } else if (back.focus_ref) {
      setPresenceNotice(`The returning focus names ${back.focus_ref}, which this reading no longer discloses — the position was not guessed.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.instrument, session?.selection.selection_ref]);

  // The traversal steps: C′-governed when a binding stands, flat otherwise.
  const playSteps = useMemo(() => {
    if (!model) return [];
    if (vak) {
      return vak.traversal.steps.map((step) => ({
        scene_refs: step.scene_refs,
        label: step.fusion
          ? `fusion · whole visited passage`
          : step.chord
            ? `chord · hop ${step.hop + 1} (${CP_LABEL[step.from]} ↔ ${CP_LABEL[step.to]})`
            : `hop ${step.hop + 1} · ${CP_LABEL[step.from]} → ${CP_LABEL[step.to]}`,
        dwell_seconds: DEFAULT_DWELL_SECONDS * (step.sustained ? 4 : step.fusion ? 2 : 1),
        sustained: step.sustained,
      }));
    }
    return model.beats.map((beat) => ({
      scene_refs: [beat.scene_ref],
      label: beat.title,
      dwell_seconds: drafts[beat.expression_ref] ? dwellFor(drafts[beat.expression_ref], beat.scene_ref) : DEFAULT_DWELL_SECONDS,
      sustained: false,
    }));
  }, [model, vak, drafts]);

  // Play mode: one stepped traversal; each step dwells at its pace and the
  // current position follows the play.
  useEffect(() => {
    if (playIndex === null) return;
    if (playIndex >= playSteps.length) { setPlayIndex(null); return; }
    const step = playSteps[playIndex];
    if (step.scene_refs.length === 1) setCurrentSceneRef(step.scene_refs[0]);
    const timer = setTimeout(() => setPlayIndex((index) => (index === null ? null : index + 1)), step.dwell_seconds * 1000);
    return () => clearTimeout(timer);
  }, [playIndex, playSteps]);

  if (!reading || !model) {
    return <div className="techne-journey"><p className="techne-absent">No Technē reading is resolved yet — the journey waits on the source.</p></div>;
  }
  if (!model.beats.length) {
    return (
      <div className="techne-journey">
        <span className="techne-eyebrow">Journey</span>
        <p className="techne-absent" role="status">No journey is readable here — {model.unavailableReason ?? "no Expression scenes are bound to this reading"}.</p>
      </div>
    );
  }

  const expressionsDisclosure = reading.disclosure.instruments.find((entry) => entry.instrument === "expressions");
  const playing = playIndex !== null;
  const warrantedVak = vakWarranted(reading);
  const currentStep = playing ? playSteps[playIndex ?? 0] : null;
  const currentScenes = new Set(currentStep?.scene_refs ?? (currentSceneRef ? [currentSceneRef] : []));

  const moveInGroup = (group: BeatGroup, sceneRef: string, delta: -1 | 1) => {
    const order = displayedOrder(group, drafts);
    const from = order.indexOf(sceneRef);
    if (from === -1) return;
    setDrafts((current) => {
      const base = current[group.expression_ref] ?? draftFromBeats(group.order, group.expression_ref);
      return { ...current, [group.expression_ref]: moveBeat(base, sceneRef, from + delta) };
    });
    setReceipt(null);
    setProposalError(null);
  };

  const paceInGroup = (group: BeatGroup, sceneRef: string, dwellSeconds: number) => {
    setDrafts((current) => {
      const base = current[group.expression_ref] ?? draftFromBeats(group.order, group.expression_ref);
      return { ...current, [group.expression_ref]: paceBeat(base, sceneRef, dwellSeconds) };
    });
  };

  const discard = (group: BeatGroup) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[group.expression_ref];
      return next;
    });
    setReceipt(null);
    setProposalError(null);
  };

  const propose = async (group: BeatGroup) => {
    const draft = drafts[group.expression_ref];
    if (!draft) return;
    const source = techneSource();
    if (!source) {
      setProposalError("No Technē source is registered — the proposal has no owner route to travel.");
      return;
    }
    setProposing(true);
    try {
      const adapter = adapterForSource(source);
      const route = composeProposal(draft, reading, session?.selection.selection_ref ?? undefined);
      setProposalError(null);
      setReceipt(await adapter.routeAction(route, reading));
    } catch (cause: unknown) {
      setProposalError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setProposing(false);
    }
  };

  /** The 4:2 → 3:3 crossing: the exact scene ref rides the selection's own
   * focus; the session store carries the rest untouched. */
  const enterScene = (beat: JourneyBeat) => {
    if (!session) return;
    try {
      const crossing = crossToExpression(session, beat.scene_ref);
      disclosureSession.setSelection(crossing.selection);
      disclosureSession.openInInstrument(crossing.target);
    } catch (cause: unknown) {
      setProposalError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  /** The authoring crossing intake: the selection becomes a routed
   * scene-create proposal — refs verbatim, nothing copied. */
  const composeFromSelection = async () => {
    if (!selection || !composeTitle.trim()) return;
    const source = techneSource();
    if (!source) {
      setComposeError("No Technē source is registered — the proposal has no owner route to travel.");
      return;
    }
    setComposeBusy(true);
    try {
      const adapter = adapterForSource(source);
      const proposal = composeSceneProposal({
        reading,
        selection,
        title: composeTitle,
        ...(composeCt ? { ct: composeCt } : {}),
      });
      setComposeError(null);
      setComposeReceipt(await adapter.routeAction(proposal.route, reading));
    } catch (cause: unknown) {
      setComposeReceipt(null);
      setComposeError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setComposeBusy(false);
    }
  };

  const applyVak = () => {
    if (!reading.ql?.context_frame_ref) return;
    const binding: VakBinding = {
      cpf: vakDraft.cpf,
      cfp: vakDraft.cfp,
      cs: vakDraft.cs,
      direction: vakDraft.direction,
      cf_ref: reading.ql.context_frame_ref,
      cp: Object.entries(vakDraft.cp).map(([scene_ref, cp]) => ({ scene_ref, cp })),
      ct: Object.entries(vakDraft.ct).map(([scene_ref, ct]) => ({ scene_ref, ct })),
    };
    const gate = bindVak(binding, reading, model.beats);
    if (gate.reason) {
      setVak(null);
      setVakNote(gate.reason);
      return;
    }
    setVakNote(null);
    setVak({ binding: gate.binding, traversal: applyVakTraversal(gate.binding, model.beats) });
  };

  /** Adopt the C′-governed order into the local draft — the draft is the
   * routing vehicle, so a bound passage can become a real proposal. */
  const adoptVakOrder = () => {
    if (!vak) return;
    const order = vakPlayOrder(vak.traversal);
    const firstBeat = model.beats.find((candidate) => candidate.scene_ref === order[0]);
    if (!firstBeat) return;
    const group = groups.find((candidate) => candidate.expression_ref === firstBeat.expression_ref);
    if (!group) return;
    setDrafts((current) => {
      const base = current[group.expression_ref] ?? draftFromBeats(group.order, group.expression_ref);
      return { ...current, [group.expression_ref]: { ...base, scene_order: [...order] } };
    });
    setVakNote("The C′ passage order was adopted into the local draft — routing it proposes the passage to the Expression owner.");
  };

  const agentState = useMemo(() => {
    if (!selection) return null;
    return journeyAgentState({
      reading,
      selection,
      beats: model.beats,
      drafts,
      currentSceneRef,
      vak,
    });
  }, [reading, selection, model, drafts, currentSceneRef, vak]);

  let position = 0;

  return (
    <div className="techne-journey">
      <header className="techne-journey-head">
        <span className="techne-eyebrow">Journey · ordered Expression scenes</span>
        <code className="techne-journey-reading" title="Reading ref">{reading.reading_ref}</code>
        <span className="techne-journey-transport">
          {playing
            ? <button type="button" className="techne-journey-button" onClick={() => setPlayIndex(null)}>Stop</button>
            : <button type="button" className="techne-journey-button" onClick={() => setPlayIndex(0)} disabled={!playSteps.length}>Play</button>}
          {playing && (
            <span className="techne-journey-stand">
              step {(playIndex ?? 0) + 1} of {playSteps.length}{currentStep ? ` · ${currentStep.label}` : ""}
            </span>
          )}
        </span>
      </header>

      {presenceNotice && <p className="techne-journey-return" role="status">{presenceNotice}</p>}

      {groups.map((group) => {
        const draft = drafts[group.expression_ref];
        const order = displayedOrder(group, drafts);
        const byScene = new Map(group.order.map((beat) => [beat.scene_ref, beat]));
        const dirty = draft ? orderChanged(draft, group.order) : false;
        return (
          <section className="techne-journey-expression" key={group.expression_ref} aria-label={`Expression ${group.expression_ref}`}>
            <header className="techne-journey-expression-head">
              <code title="expression_ref">{group.expression_ref}</code>
              <span className="techne-journey-rev">rev {group.revision ?? "—"}</span>
            </header>
            <ol className="techne-journey-beats">
              {order.map((sceneRef, index) => {
                const beat = byScene.get(sceneRef);
                if (!beat) return null;
                position += 1;
                const current = currentScenes.has(sceneRef);
                const dwell = draft ? dwellFor(draft, sceneRef) : DEFAULT_DWELL_SECONDS;
                const cprime = vak ? sceneCPrime(vak.binding, sceneRef) : null;
                return (
                  <li className="techne-journey-beat" key={sceneRef} data-current={current || undefined}>
                    <div className="techne-journey-beat-head">
                      <span className="techne-journey-index">{position}</span>
                      <strong className="techne-journey-title">{beat.title}</strong>
                      <span className="techne-journey-move">
                        <button type="button" aria-label={`Move ${beat.title} earlier`} disabled={index === 0 || playing} onClick={() => moveInGroup(group, sceneRef, -1)}>↑</button>
                        <button type="button" aria-label={`Move ${beat.title} later`} disabled={index === order.length - 1 || playing} onClick={() => moveInGroup(group, sceneRef, 1)}>↓</button>
                      </span>
                    </div>
                    <div className="techne-journey-ids">
                      <code title="scene_ref">{beat.scene_ref}</code>
                      <span className="techne-journey-rev">rev {beat.revision ?? "—"}</span>
                    </div>
                    <ul className="techne-journey-chips" aria-label="Scene frame">
                      {beat.frame.temporal.map((facet) => (
                        <li className="techne-journey-chip" key={`${facet.kind}:${facet.instant ?? facet.day_ref ?? facet.facet_ref ?? ""}`} title={`temporal · ${facet.kind}`}>
                          <span>time · {facet.kind}</span> <code>{facet.day_ref ?? facet.instant ?? "—"}</code>
                        </li>
                      ))}
                      {beat.frame.places.map((place) => (
                        <li className="techne-journey-chip" key={place.place_ref} title={`place · ${place.precision}`}>
                          <span>place · {place.precision}</span> {place.names.length ? place.names.join(" · ") : <code>{place.place_ref}</code>}
                        </li>
                      ))}
                      <li className="techne-journey-chip" title="subject">
                        <span>subject</span> <code>{beat.frame.subject_ref}</code>
                      </li>
                      {cprime && (
                        <li className="techne-journey-chip" title="C′ binding">
                          <span>C′</span> {cprime.cp} {cprime.ct ?? ""}
                        </li>
                      )}
                    </ul>
                    <details className="techne-journey-sources">
                      <summary>sources · {beat.frame.sources.length}</summary>
                      <ul>
                        {beat.frame.sources.map((source) => (
                          <li className="techne-journey-source" key={source.source_ref}>
                            <code title="source_ref">{source.source_ref}</code>
                            {source.source_revision && <span className="techne-journey-rev">{source.source_revision}</span>}
                            {source.selector
                              ? <span className="techne-journey-selector">selector · {source.selector.unit}{source.selector.unit === "text_span" ? ` [${source.selector.start}, ${source.selector.end}]` : ""}</span>
                              : <span className="techne-journey-selector">selector · none disclosed</span>}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="techne-journey-actions">
                      <div className="techne-journey-pace" title="Local reading pace — held in this surface, never routed">
                        <span>pace</span>
                        <button type="button" aria-label={`Slower ${beat.title}`} disabled={dwell <= 1 || playing} onClick={() => paceInGroup(group, sceneRef, dwell - 1)}>−</button>
                        <output>{dwell}s</output>
                        <button type="button" aria-label={`Faster ${beat.title}`} disabled={dwell >= 30 || playing} onClick={() => paceInGroup(group, sceneRef, dwell + 1)}>+</button>
                      </div>
                      <button
                        type="button"
                        className="techne-journey-button techne-journey-enter"
                        disabled={!session || !expressionsDisclosure?.available || playing}
                        title="Cross into the live 3:3 Expression reading with this exact scene ref — disclosure changes, identity does not"
                        onClick={() => enterScene(beat)}
                      >
                        Enter scene
                      </button>
                    </div>
                    {vakPanel && (
                      <div className="techne-journey-cprime-edit" aria-label={`C′ assignment for ${beat.title}`}>
                        <label>
                          CP
                          <select
                            value={vakDraft.cp[sceneRef] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value as CpPosition | "";
                              setVakDraft((state) => {
                                const cp = { ...state.cp };
                                if (value) cp[sceneRef] = value; else delete cp[sceneRef];
                                return { ...state, cp };
                              });
                            }}
                          >
                            <option value="">—</option>
                            {CP_OPTIONS.map((option) => <option key={option} value={option}>{option} {CP_LABEL[option]}</option>)}
                          </select>
                        </label>
                        <label>
                          CT
                          <select
                            value={vakDraft.ct[sceneRef] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value as CtKind | "";
                              setVakDraft((state) => {
                                const ct = { ...state.ct };
                                if (value) ct[sceneRef] = value; else delete ct[sceneRef];
                                return { ...state, ct };
                              });
                            }}
                          >
                            <option value="">—</option>
                            {CT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <footer className="techne-journey-expression-foot">
              {dirty
                ? <>
                    <span className="techne-journey-note">Local draft — order {order.length} scenes; nothing is written until routed.</span>
                    <button type="button" className="techne-journey-button" onClick={() => discard(group)} disabled={proposing || playing}>Discard draft</button>
                    <button type="button" className="techne-journey-button techne-journey-propose" onClick={() => propose(group)} disabled={proposing || playing}>
                      {proposing ? "Routing…" : "Propose to Expression owner"}
                    </button>
                  </>
                : <span className="techne-journey-note">Reading order — reorder a scene to draft a composition proposal.</span>}
            </footer>
          </section>
        );
      })}

      <section className="techne-journey-bridge" aria-label="Cross-instrument intake">
        <p className="techne-eyebrow">Compose a scene from the selection</p>
        <p className="techne-journey-note">
          The exact selected refs ride the proposal verbatim — subject, focus, the reading's time/place/source facets. Journey authors the frame; it copies nothing.
        </p>
        <div className="techne-journey-compose">
          <input
            type="text"
            className="techne-journey-input"
            placeholder="Scene title (the owner names the scene; this proposes)"
            value={composeTitle}
            disabled={!selection || composeBusy}
            onChange={(event) => setComposeTitle(event.target.value)}
          />
          {warrantedVak && (
            <select
              className="techne-journey-input"
              value={composeCt}
              title="C1′ content type — the proposal must carry the material this burden demands"
              onChange={(event) => setComposeCt(event.target.value as CtKind | "")}
            >
              <option value="">no CT bound</option>
              {CT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          )}
          <button
            type="button"
            className="techne-journey-button techne-journey-propose"
            disabled={!selection || !composeTitle.trim() || composeBusy || playing}
            onClick={() => void composeFromSelection()}
          >
            {composeBusy ? "Routing…" : "Propose scene to Expression owner"}
          </button>
        </div>
        {!selection && <p className="techne-absent">No DisclosureSelection is open — composition waits on a selection to ingest.</p>}
        {composeError && <p role="alert" className="techne-absent">{composeError}</p>}
        {composeReceipt && (
          <div className="techne-journey-receipt" data-routed={composeReceipt.routed === true} role="status">
            <strong>{composeReceipt.routed ? "Scene composition routed to the Expression owner" : "Scene composition refused by routing"}</strong>
            <p><code>{composeReceipt.action_ref}</code> · owner <code>{composeReceipt.native_owner}</code></p>
            {composeReceipt.routed && composeReceipt.authority ? <p>authority <code>{composeReceipt.authority}</code></p> : null}
            {!composeReceipt.routed && composeReceipt.reason && <p>{composeReceipt.reason}</p>}
          </div>
        )}
      </section>

      <section className="techne-journey-bridge" aria-label="C-prime composition">
        <p className="techne-eyebrow">C′ composition {warrantedVak ? "" : "· unavailable"}</p>
        {warrantedVak
          ? (
            <>
              <p className="techne-journey-note">
                Warranted Vāk binding {<code>{reading.ql?.vak_source_ref}</code>} · CF {<code>{reading.ql?.context_frame_ref}</code>} carried verbatim. The passage governs playback for real; a binding that changes nothing is refused.
              </p>
              <div className="techne-journey-compose">
                <button type="button" className="techne-journey-button" onClick={() => setVakPanel((open) => !open)}>
                  {vakPanel ? "Hide position assignments" : "Assign positions"}
                </button>
                <label>CS
                  <select value={vakDraft.cs} onChange={(event) => setVakDraft((state) => ({ ...state, cs: event.target.value as CsProfile }))}>
                    {CS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>direction
                  <select value={vakDraft.direction} onChange={(event) => setVakDraft((state) => ({ ...state, direction: event.target.value as CsDirection }))}>
                    <option value="forward-synthesis">forward-synthesis</option>
                    <option value="returning-inquiry">returning-inquiry</option>
                  </select>
                </label>
                <label>CFP
                  <select value={vakDraft.cfp} onChange={(event) => setVakDraft((state) => ({ ...state, cfp: event.target.value as CfpForm }))}>
                    {CFP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>CPF
                  <select value={vakDraft.cpf} onChange={(event) => setVakDraft((state) => ({ ...state, cpf: event.target.value as CpfRegime }))}>
                    <option value="human-engaged">human-engaged</option>
                    <option value="authorised-autonomous">authorised-autonomous</option>
                  </select>
                </label>
                <button type="button" className="techne-journey-button techne-journey-propose" disabled={playing} onClick={applyVak}>Bind</button>
                {vak && <button type="button" className="techne-journey-button" disabled={playing} onClick={adoptVakOrder}>Adopt order into draft</button>}
                {vak && <button type="button" className="techne-journey-button" disabled={playing} onClick={() => { setVak(null); setVakNote(null); }}>Unbind</button>}
              </div>
              {vakNote && <p className="techne-absent" role="status">{vakNote}</p>}
              {vak && (
                <ol className="techne-journey-traversal" aria-label="C′-governed traversal">
                  {vak.traversal.steps.map((step) => (
                    <li key={step.hop} className="techne-journey-traversal-step" data-chord={step.chord || undefined} data-fusion={step.fusion || undefined} data-sustained={step.sustained || undefined}>
                      <span>hop {step.hop + 1} · {CP_LABEL[step.from]} → {CP_LABEL[step.to]}</span>
                      <ul>{step.scene_refs.map((scene) => <li key={scene}><code>{scene}</code></li>)}</ul>
                    </li>
                  ))}
                </ol>
              )}
              {vak && !!vak.traversal.unvisited.length && (
                <p className="techne-absent">The {vak.binding.cs} passage does not visit {vak.traversal.unvisited.length} scene{vak.traversal.unvisited.length === 1 ? "" : "s"} — disclosed, not hidden: {vak.traversal.unvisited.map((scene) => <code key={scene}>{scene}</code>)}</p>
              )}
            </>
          )
          : <p className="techne-absent">No warranted Vāk binding on this reading (ql.vak_source_ref / ql.context_frame_ref absent) — C′ composition is unavailable and is not simulated.</p>}
      </section>

      {(receipt || proposalError) && (
        <div className="techne-journey-receipt" data-routed={receipt?.routed === true} role="status">
          <strong>{receipt ? (receipt.routed ? "Proposal routed to the Expression owner" : "Proposal refused by routing") : "Proposal could not be routed"}</strong>
          {receipt && (
            <p><code>{receipt.action_ref}</code> · owner <code>{receipt.native_owner}</code>
              {receipt.routed && receipt.authority ? <> · authority <code>{receipt.authority}</code></> : null}
            </p>
          )}
          {receipt && !receipt.routed && receipt.reason && <p>{receipt.reason}</p>}
          {proposalError && <p>{proposalError}</p>}
          {!!receipt?.expected_effects?.length && (
            <ul>{receipt.expected_effects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
          )}
          <p className="techne-journey-note">Routing proposes only — the Expression owner executes under its own authority; the journey instrument wrote nothing.</p>
        </div>
      )}

      {agentState && (
        <details className="techne-journey-agent" aria-label="Technē 3 structured journey state">
          <summary>Technē_3 · structured journey state</summary>
          <p className="techne-absent">{techne3OperationStanding(agentState).note}</p>
          <pre className="techne-journey-agent-state">{JSON.stringify(agentState, null, 2)}</pre>
        </details>
      )}

      <footer className="techne-journey-cross">
        {expressionsDisclosure?.available
          ? (
            <button
              type="button"
              className="techne-journey-button"
              disabled={!session}
              title="Project the DisclosureSession into the expressions instrument; an expression_focus_ref already on the session rides across"
              onClick={() => disclosureSession.openInInstrument("expressions")}
            >
              Open the bound Expression in expressions
            </button>
          )
          : expressionsDisclosure
            ? <span className="techne-absent">expressions unavailable — {expressionsDisclosure.reason}</span>
            : null}
        <span className="techne-journey-note" title={JOURNEY_PRESENCE_KEY}>Position and draft persist as presentation state only — the Expression substrate stays the only semantic store.</span>
      </footer>
    </div>
  );
}
