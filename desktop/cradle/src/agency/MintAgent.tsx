import {NativeAgentLauncher} from "./NativeAgentLauncher";
/**
 * MintAgent — intent-led minting (COMMON-BRIEF §handoff 3). Begins with
 * "What should this agency take care of?", retains the exact intent text,
 * offers manual search and an explicit bounded "Find suitable skills"
 * inference pass, and ends at five DISTINCT actions — never one button.
 *
 * The draft (intent, name, choices) lives in a module-level store so it
 * survives this surface unmounting; it is never auto-submitted and never
 * cleared by a reading refresh.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import {IconChoiceStrip} from "../workspace/primitives/IconTabStrip";
import { Glyph } from "../workspace/Glyph";
import { useKernel } from "../kernel/KernelProvider";
import { kernelOp } from "../kernel/bridge";
import type { ProfileUsePlanWire } from "../kernel/types";
import { getAgentMintSource, getSetupInferenceSource, getSkillSearchSource, subscribeAgentMintSource } from "./agencySources";
import type { SkillCandidate } from "./agencySources";
import { emptyDraft } from "./agencyTypes";
import type { AgentDraft, AgentDurability, SetupProposalRecord } from "./agencyTypes";
import { SkillSearch, SkillCandidateRow } from "./SkillSearch";
import { SetupProposal } from "./SetupProposal";

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

const DURABILITY_OPTIONS: { value: AgentDurability; label: string; detail: string }[] = [
  { value: "durable", label: "Durable Agent", detail: "A standing native source — “Keep as Agent” is the explicit act that makes it one." },
  { value: "team", label: "Reusable team", detail: "A reusable composition, not a single-use participant." },
  { value: "temporary", label: "Bounded temporary help", detail: "Need not become a durable profile." },
];

export function MintAgent(props: { project?: string; onMessage?: (message: string) => void }) {
  const [kind,setKind]=useState<"durable"|"other">("durable");
  return <><IconChoiceStrip aria-label="Agent identity or temporary formation" current={kind} onSelect={value=>setKind(value as "durable"|"other")} items={[{id:"durable",label:"Reusable native Agent",icon:"agent"},{id:"other",label:"Temporary help / team composition",icon:"graph"}]}/>{kind==="durable"?<NativeAgentLauncher project={props.project}/>:<FormationDraft {...props}/>}</>;
}
function FormationDraft({ project, onMessage }: { project?: string; onMessage?: (message: string) => void }) {
  const kernel = useKernel();
  const [, force] = useState(0);
  useEffect(() => { const listener = () => force((n) => n + 1); draftListeners.add(listener); return () => { draftListeners.delete(listener); }; }, []);
  const draft = storedDraft;
  const proposal = storedProposal;
  const candidates = storedCandidates;

  const [mintBound, setMintBound] = useState(() => getAgentMintSource() !== undefined);
  useEffect(() => subscribeAgentMintSource(() => setMintBound(getAgentMintSource() !== undefined)), []);

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
        <IconChoiceStrip aria-label="Durability" current={draft.durability} onSelect={value=>setDraft({durability:value as AgentDurability})}
          items={DURABILITY_OPTIONS.map(option=>({id:option.value,label:option.label,description:option.detail,icon:option.value==="team"?"graph":option.value==="durable"?"agent":"history"}))}/>

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
                <Glyph name="explore" size={13}/> Find suitable skills
              </button>
            : <button type="button" className="oi-action" onClick={cancelInference}><Glyph name="stop" size={13}/> Cancel</button>}
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

    <ReviewActions draft={draft} mintBound={mintBound} onMessage={onMessage} kernel={kernel} kernelOpFn={kernelOp}/>
  </div>;
}

// ---------------------------------------------------------------------------
// the five distinct actions

function ReviewActions({ draft, mintBound, onMessage, kernel, kernelOpFn }: {
  draft: AgentDraft;
  mintBound: boolean;
  onMessage?: (message: string) => void;
  kernel: ReturnType<typeof useKernel>;
  kernelOpFn: typeof kernelOp;
}) {
  const [saving, setSaving] = useState(false);
  const [savedRef, setSavedRef] = useState<string>();
  const [validation, setValidation] = useState<string[]>();

  const saveDefinition = async () => {
    const mintSource = getAgentMintSource();
    if (!mintSource) return;
    setSaving(true);
    setValidation(undefined);
    try {
      const validated = await mintSource.validate(draft);
      if (!validated.ok) { setValidation(validated.problems); return; }
      const created = await mintSource.create(draft);
      setSavedRef(created.agentRef);
      onMessage?.(`Agent definition saved: ${created.agentRef}.`);
    } catch (cause) {
      onMessage?.(`Saving the Agent definition failed: ${String(cause)}`);
    } finally {
      setSaving(false);
    }
  };

  return <section className="oi-section agency-actions">
    <span className="oi-eyebrow">Five distinct actions</span>
    <div className="oi-action-group">
      <div className="agency-action-row">
        <button type="button" className="oi-action oi-action-primary" disabled={!mintBound || saving || !draft.intentExpression.trim()} onClick={() => void saveDefinition()}>
          {saving ? "Saving…" : "Save Agent definition"}
        </button>
        <span className="oi-state">{mintBound ? "Effect timing: on save, before any work starts." : "No AgentMintSource is registered — Central's durable-source route supplies it."}</span>
      </div>
      {validation && validation.length > 0 && <ul className="agency-validation">{validation.map((problem, index) => <li key={index} className="oi-note" role="alert">{problem}</li>)}</ul>}
      {savedRef && <p className="oi-note">Saved as <span className="oi-ref">{savedRef}</span>.</p>}

      <ApplyRepertoireAction draft={draft} onMessage={onMessage} kernel={kernel} kernelOpFn={kernelOpFn}/>

      <UnavailableActionRow label="Start work" reason="No owner operation starts a fresh unit of work from a minted Agent yet — Factory/AIKit session dispatch supplies it (O:I issue 220)."/>
      <UnavailableActionRow label="Change a running session" reason="Encounter sessions exist on the seam (kernel op “encounter”), but this Agency surface has no encounter host bound to render a changed session in — the integrator wires that pane."/>
      <UnavailableActionRow label="Grant authority" reason="No owner operation grants scoped authority to an Agent from this surface yet — native-action-authority supplies the grant, not Agency."/>
    </div>
  </section>;
}

function UnavailableActionRow({ label, reason }: { label: string; reason: string }) {
  return <div className="agency-action-row" data-unavailable="true">
    <span className="agency-unavailable-label">{label}</span>
    <span className="oi-state">{reason}</span>
  </div>;
}

/** "Apply repertoire to Project/Profile" binds to the real profile plane
 * (profile_list → profile_use_plan → profile_use_apply,
 * kernel/types.ts:199-204) via `keepIn` as the target profile ref, the
 * same plan-before-apply shape ProfilesView.tsx already uses. */
function ApplyRepertoireAction({ draft, onMessage, kernel, kernelOpFn }: {
  draft: AgentDraft;
  onMessage?: (message: string) => void;
  kernel: ReturnType<typeof useKernel>;
  kernelOpFn: typeof kernelOp;
}) {
  const [plan, setPlan] = useState<ProfileUsePlanWire>();
  const [pending, setPending] = useState(false);
  const profileRef = draft.keepIn?.trim();

  const showPlan = async () => {
    if (!profileRef) return;
    setPending(true);
    try {
      const call = await kernelOpFn(kernel.transport, { op: "profile_use_plan", profile_ref: profileRef });
      if (call.error || call.outcome?.result !== "profile_use_planning") { onMessage?.(call.error ?? `Profile “${profileRef}” has no inspectable use plan.`); return; }
      setPlan(call.outcome.plan);
    } finally {
      setPending(false);
    }
  };
  const apply = async () => {
    if (!plan) return;
    setPending(true);
    try {
      const call = await kernelOpFn(kernel.transport, { op: "profile_use_apply", profile_ref: plan.profile_ref });
      if (call.error || call.outcome?.result !== "profile_used") { onMessage?.(call.error ?? "Applying the profile use did not settle."); return; }
      onMessage?.(`Profile “${plan.profile_ref}” is now in use. Effect timing: next reload of that scope's projection.`);
      setPlan(undefined);
    } finally {
      setPending(false);
    }
  };

  if (!profileRef) {
    return <div className="agency-action-row" data-unavailable="true">
      <span className="agency-unavailable-label">Apply repertoire to Project/Profile</span>
      <span className="oi-state">Set “Where to keep it” to a profile ref to plan this through `profile_use_plan`.</span>
    </div>;
  }
  return <div className="agency-action-row">
    <button type="button" className="oi-action" disabled={pending} onClick={() => void showPlan()}>{pending ? "Reading plan…" : "Apply repertoire to Project/Profile"}</button>
    <span className="oi-state">Plans against profile <span className="oi-ref">{profileRef}</span> — nothing moves until you apply the shown plan.</span>
    {plan && <div className="agency-plan-drawer" role="dialog" aria-label="Profile use plan">
      <dl className="oi-kv">
        {plan.entries.map((entry) => (
          <Fragment key={entry.setting_ref}>
            <dt className="oi-ref">{entry.setting_ref}</dt>
            <dd>{JSON.stringify(entry.current)} → {JSON.stringify(entry.target)}</dd>
          </Fragment>
        ))}
      </dl>
      <div className="agency-action-row">
        <button type="button" className="oi-action oi-action-primary" disabled={pending} onClick={() => void apply()}>Apply</button>
        <button type="button" className="oi-action" onClick={() => setPlan(undefined)}>Discard plan</button>
      </div>
    </div>}
  </div>;
}
