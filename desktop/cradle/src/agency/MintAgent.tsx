import {NativeAgentLauncher} from "./NativeAgentLauncher";
/**
 * MintAgent — intent-led formation (COMMON-BRIEF §handoff 3). Begins with
 * "What should this agency take care of?", retains the exact intent text,
 * offers manual search and an explicit bounded "Find suitable skills"
 * inference pass.
 *
 * Two formations route to their REAL native owners — this surface never
 * writes an Agent record itself:
 *   • Reusable native Agent — the durable source route (NativeAgentLauncher:
 *     propose → review → human accept → prepare on the native owners).
 *   • Temporary help / team composition — temporary help stays bounded (no
 *     Central record, nothing durable); a reusable team proposes through the
 *     existing `central.agent-set.*` native Actions via the kernel's
 *     `invoke_action` dispatch (teamFormation.ts).
 *
 * The draft (intent, name, choices) lives in a module-level store so it
 * survives this surface unmounting; it is never auto-submitted and never
 * cleared by a reading refresh.
 */
import { useEffect, useRef, useState } from "react";
import {IconChoiceStrip} from "../workspace/primitives/IconTabStrip";
import { useKernel } from "../kernel/KernelProvider";
import { kernelOp } from "../kernel/bridge";
import type { KernelOpCall } from "../kernel/bridge";
import type { ActionDispatch } from "../kernel/types";
import { getSetupInferenceSource, getSkillSearchSource } from "./agencySources";
import type { SkillCandidate } from "./agencySources";
import { emptyDraft } from "./agencyTypes";
import type { AgentDraft, SetupProposalRecord } from "./agencyTypes";
import { SkillSearch, SkillCandidateRow } from "./SkillSearch";
import { SetupProposal } from "./SetupProposal";
import { useAgentRoster } from "./roster";
import { isWellFormedTeamRef, teamOutcomeRows, teamProposalBuild, teamResolveBuild } from "./teamFormation";

// ---------------------------------------------------------------------------
// module-level draft store — survives unmount, never auto-submitted.

let storedDraft: AgentDraft = emptyDraft();
let storedProposal: SetupProposalRecord | null = null;
let storedCandidates: SkillCandidate[] = [];
const draftListeners = new Set<() => void>();
function announceDraft() { for (const listener of draftListeners) listener(); }
function setStoredDraft(next: AgentDraft) { storedDraft = next; announceDraft(); }
function setStoredProposal(next: SetupProposalRecord | null) { storedProposal = next; announceDraft(); }
function setStoredCandidates(next: SkillCandidate[]) { storedCandidates = next; announceDraft(); }

const DURABILITY_OPTIONS: { value: AgentDraft["durability"]; label: string; detail: string }[] = [
  { value: "team", label: "Reusable team", detail: "A reusable composition through Central's native agent-set Actions — generated source awaiting human recognition, not a durable Agent." },
  { value: "temporary", label: "Bounded temporary help", detail: "Never becomes a durable Agent: no Central record is written here at all." },
];

export function MintAgent(props: { project?: string; onMessage?: (message: string) => void }) {
  const [kind,setKind]=useState<"durable"|"other">("durable");
  return <><IconChoiceStrip aria-label="Agent identity or temporary formation" current={kind} onSelect={value=>setKind(value as "durable"|"other")} items={[{id:"durable",label:"Reusable native Agent",icon:"agent"},{id:"other",label:"Temporary help / team composition",icon:"graph"}]}/>{kind==="durable"?<NativeAgentLauncher project={props.project}/>:<FormationDraft {...props}/>}</>;
}
function FormationDraft({ project, onMessage }: { project?: string; onMessage?: (message: string) => void }) {
  const [, force] = useState(0);
  useEffect(() => { const listener = () => force((n) => n + 1); draftListeners.add(listener); return () => { draftListeners.delete(listener); }; }, []);
  const draft = storedDraft;
  const proposal = storedProposal;
  const candidates = storedCandidates;

  const [inferring, setInferring] = useState(false);
  const [inferError, setInferError] = useState<string>();
  const abortRef = useRef<AbortController>();

  const setDraft = (patch: Partial<AgentDraft>) => setStoredDraft({ ...draft, ...patch });

  const toggleCandidate = (candidate: SkillCandidate) => {
    if (!storedCandidates.some((existing) => existing.ref === candidate.ref)) setStoredCandidates([...storedCandidates, candidate]);
    const included = draft.includedSkillRefs.includes(candidate.ref)
      ? draft.includedSkillRefs.filter((ref) => ref !== candidate.ref)
      : [...draft.includedSkillRefs, candidate.ref];
    setDraft({ includedSkillRefs: included });
  };
  const toggleByRef = (ref: string) => {
    const candidate = candidates.find((entry) => entry.ref === ref);
    if (candidate) toggleCandidate(candidate);
  };

  const findSuitableSkills = () => {
    const searchSource = getSkillSearchSource();
    const inferenceSource = getSetupInferenceSource();
    if (!searchSource || !inferenceSource) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setInferring(true);
    setInferError(undefined);
    void (async () => {
      try {
        const searched = await searchSource.search({ text: draft.intentExpression, project }, controller.signal);
        if (controller.signal.aborted) return;
        setStoredCandidates([...storedCandidates, ...searched.candidates.filter((c) => !storedCandidates.some((existing) => existing.ref === c.ref))]);
        const proposed = await inferenceSource.propose({ intent: draft.intentExpression, candidates: searched.candidates, project }, controller.signal);
        if (controller.signal.aborted) return;
        setStoredProposal(proposed);
      } catch (cause) {
        if (!controller.signal.aborted) setInferError(String(cause));
      } finally {
        if (!controller.signal.aborted) setInferring(false);
      }
    })();
  };
  const cancelInference = () => { abortRef.current?.abort(); setInferring(false); };

  const currentBasis = { intent: draft.intentExpression, catalogueRevision: proposal?.basis.catalogueRevision ?? "unknown", target: project ?? "unscoped" };

  return <div className="agency-mint">
    <section className="oi-section">
      <div className="oi-field">
        <label htmlFor="agency-intent" className="oi-eyebrow">What should this agency take care of?</label>
        <textarea
          id="agency-intent"
          className="oi-input agency-intent-input"
          rows={3}
          value={draft.intentExpression}
          onChange={(event) => setDraft({ intentExpression: event.target.value })}
          placeholder="the exact purpose, kept verbatim"
        />
      </div>
      <div className="oi-field">
        <label htmlFor="agency-name" className="oi-eyebrow">Name (optional)</label>
        <input id="agency-name" className="oi-input" type="text" value={draft.name ?? ""} onChange={(event) => setDraft({ name: event.target.value })}/>
      </div>
      <div className="oi-field">
        <label htmlFor="agency-keep-in" className="oi-eyebrow">Where to keep it</label>
        <input id="agency-keep-in" className="oi-input" type="text" value={draft.keepIn ?? ""} placeholder={project ? `e.g. ${project}` : "a project or placement reference"} onChange={(event) => setDraft({ keepIn: event.target.value })}/>
      </div>
      <div className="oi-field">
        <span className="oi-eyebrow">Durability</span>
        <IconChoiceStrip aria-label="Durability" current={draft.durability} onSelect={value=>setDraft({durability:value as AgentDraft["durability"]})}
          items={DURABILITY_OPTIONS.map(option=>({id:option.value,label:option.label,description:option.detail,icon:option.value==="team"?"graph":"history"}))}/>
        <p className="oi-note">A durable reusable Agent is the other tab — “Reusable native Agent” — where the native propose/review/accept route runs.</p>
      </div>
    </section>

    <section className="oi-section agency-routes">
      <div className="agency-route" aria-label="Manual search">
        <span className="oi-eyebrow">Manual search</span>
        <SkillSearch project={project} included={draft.includedSkillRefs} onToggle={toggleCandidate}/>
      </div>
      <div className="agency-route" aria-label="Suggested setup">
        <span className="oi-eyebrow">Suggested setup</span>
        <div className="oi-tool-row">
          {!inferring
            ? <button type="button" className="oi-action" disabled={!draft.intentExpression.trim() || !getSkillSearchSource() || !getSetupInferenceSource()} onClick={findSuitableSkills}>
                Find suitable skills
              </button>
            : <button type="button" className="oi-action" onClick={cancelInference}>Cancel</button>}
          {inferring && <span className="oi-state">Searching, then proposing once…</span>}
        </div>
        {(!getSkillSearchSource() || !getSetupInferenceSource()) && (
          <p className="oi-refusal" data-agency-inference-unavailable>
            {!getSkillSearchSource() ? "No Skill search source is registered (AIKit issues 34/118/122). " : ""}
            {!getSetupInferenceSource() ? "No bounded setup-inference source is registered — the small comparison step in §handoff-3 supplies it once wired. " : ""}
            Manual search above stays fully usable without it.
          </p>
        )}
        {inferError && <p role="alert" className="oi-refusal">{inferError}</p>}
        {proposal && (
          <SetupProposal
            proposal={proposal}
            current={currentBasis}
            included={draft.includedSkillRefs}
            onToggle={toggleByRef}
            onRevalidate={findSuitableSkills}
            revalidating={inferring}
          />
        )}
      </div>
    </section>

    {draft.includedSkillRefs.length > 0 && (
      <section className="oi-section">
        <span className="oi-eyebrow">Included · {draft.includedSkillRefs.length}</span>
        <ul className="agency-candidate-list">
          {draft.includedSkillRefs.map((ref) => {
            const candidate = candidates.find((entry) => entry.ref === ref);
            return candidate
              ? <SkillCandidateRow key={ref} candidate={candidate} included onToggle={() => toggleCandidate(candidate)}/>
              : <li key={ref} className="oi-row"><span className="oi-ref">{ref}</span><span className="oi-state">candidate detail not held</span></li>;
          })}
        </ul>
      </section>
    )}

    {draft.durability === "team"
      ? <TeamActions draft={draft} project={project ?? (draft.keepIn?.trim() || undefined)} onMessage={onMessage}/>
      : <TemporaryHelpBounded/>}
  </div>;
}

/** Temporary help stays bounded: no native write exists behind this choice,
 * and that is the feature — it names the ordinary route instead. */
function TemporaryHelpBounded() {
  return <section className="oi-section agency-actions" aria-label="Bounded temporary help">
    <span className="oi-eyebrow">Bounded temporary help</span>
    <p className="oi-note" data-temporary-bounded="true">
      Temporary help never becomes a durable Agent, so nothing is written here — no Central record,
      no native source, no authority. Start an ordinary conversation from the panel's “New chat” and
      it stays exactly as bounded as you make it.
    </p>
  </section>;
}

/** The reusable-team route: real `central.agent-set.propose` /
 * `central.agent-set.resolve` through the kernel's `invoke_action` dispatch.
 * Members come from the real Central roster; the reply's standing is carried
 * verbatim — generated proposal, unrecognised, never an Agent by itself. */
function TeamActions({ draft, project, onMessage }: {
  draft: AgentDraft;
  project?: string;
  onMessage?: (message: string) => void;
}) {
  const kernel = useKernel();
  const roster = useAgentRoster(project, true);
  const [ref, setRef] = useState("");
  const [revision, setRevision] = useState("r1");
  const [members, setMembers] = useState<string[]>([]);
  const [orchestrator, setOrchestrator] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [rows, setRows] = useState<ReturnType<typeof teamOutcomeRows>>();

  const invoke = async (build: ReturnType<typeof teamProposalBuild>) => {
    setPending(true);
    setRows(undefined);
    try {
      const call: KernelOpCall = await kernelOp(kernel.transport, { op: "invoke_action", project, invocation: { action: build.action, target_ref: build.target_ref, input: build.input } });
      const dispatch: ActionDispatch | undefined = call.outcome && call.outcome.result === "action_dispatched" ? call.outcome.dispatch : undefined;
      if (!dispatch) { onMessage?.(call.error ?? "The kernel returned no Action dispatch."); return; }
      setRows(teamOutcomeRows(dispatch));
    } finally {
      setPending(false);
    }
  };

  const wellFormed = isWellFormedTeamRef(ref);
  const ready = wellFormed && revision.trim() !== "" && members.length > 0;

  return <section className="oi-section agency-actions" aria-label="Reusable team formation">
    <span className="oi-eyebrow">Reusable team — native agent-set proposal</span>
    <div className="oi-field">
      <label htmlFor="agency-team-ref" className="oi-eyebrow">Team ref</label>
      <input id="agency-team-ref" className="oi-input" type="text" value={ref} placeholder="e.g. research-crew" onChange={(event) => setRef(event.target.value)} aria-describedby="agency-team-ref-state"/>
      <span id="agency-team-ref-state" className="oi-state">{ref === "" ? "a plain lowercase name" : wellFormed ? "accepted shape — Central remains the authority" : "not a plain lowercase name"}</span>
    </div>
    <div className="oi-field">
      <label htmlFor="agency-team-revision" className="oi-eyebrow">Revision</label>
      <input id="agency-team-revision" className="oi-input" type="text" value={revision} onChange={(event) => setRevision(event.target.value)}/>
    </div>
    <fieldset className="oi-section"><legend>Members — from the native Central roster</legend>
      {roster.state === "reading" && <p className="oi-note" aria-busy="true">Reading the native roster…</p>}
      {roster.state === "error" && <p className="oi-refusal" role="alert">The native roster is unavailable: {roster.error}</p>}
      {roster.state === "ready" && roster.agents.length === 0 && <p className="oi-note">No native Agents are rostered in this scope yet.</p>}
      {roster.agents.map((agent) => (
        <label key={agent.ref} className="oi-field">
          <input type="checkbox" aria-label={`Team member ${agent.name}`} checked={members.includes(agent.ref)}
            onChange={(event) => setMembers(event.target.checked ? [...members, agent.ref] : members.filter((existing) => existing !== agent.ref))}/>
          {agent.name} <span className="oi-note">{agent.ref}{agent.accepted ? "" : " — proposal, not accepted"}</span>
        </label>
      ))}
    </fieldset>
    <div className="oi-field">
      <label htmlFor="agency-team-orchestrator" className="oi-eyebrow">Orchestrator (optional)</label>
      <select id="agency-team-orchestrator" className="oi-input" value={orchestrator ?? ""} onChange={(event) => setOrchestrator(event.target.value || undefined)}>
        <option value="">none</option>
        {members.map((agentRef) => <option key={agentRef} value={agentRef}>{agentRef}</option>)}
      </select>
    </div>
    <div className="agency-action-row">
      <button type="button" className="oi-action" disabled={!ready || pending} onClick={() => void invoke(teamProposalBuild({ draft, project, ref, revision: revision.trim(), memberRefs: members, orchestrator }))}>
        {pending ? "Proposing…" : "Propose team composition"}
      </button>
      <button type="button" className="oi-action" disabled={!wellFormed || pending} onClick={() => void invoke(teamResolveBuild({ project, ref, availableAgents: roster.agents.map((agent) => agent.ref) }))}>
        Read resolution
      </button>
    </div>
    <p className="oi-note">Propose creates generated source stamped unrecognised — human recognition stays with the owner, and a duplicate ref is refused, never overwritten.</p>
    {rows && <ul className="agency-validation" aria-label="Native outcome">
      {rows.map((row, index) => <li key={index} className="oi-note" data-team-outcome={row.kind} role={row.kind === "ok" ? "status" : "alert"}>{row.text}</li>)}
    </ul>}
  </section>;
}
