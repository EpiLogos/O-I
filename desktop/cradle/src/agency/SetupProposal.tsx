/**
 * SetupProposal — the reviewable proposal (COMMON-BRIEF §handoff 3):
 * required / optional / missing groups, conflicts, duplicates, coverage
 * gaps, staleness against the proposal's own `basis`. This component
 * never runs inference itself — MintAgent owns the "Find suitable
 * skills" click; this renders what came back and lets the person
 * include/exclude and re-validate.
 */
import { Glyph } from "../workspace/Glyph";
import type { SetupProposalRecord, SetupSuggestion } from "./agencyTypes";

export function isProposalStale(proposal: SetupProposalRecord, current: { intent: string; catalogueRevision: string; target: string }): boolean {
  return proposal.basis.intent !== current.intent
    || proposal.basis.catalogueRevision !== current.catalogueRevision
    || proposal.basis.target !== current.target;
}

export function SetupProposal({
  proposal,
  current,
  included,
  onToggle,
  onRevalidate,
  revalidating,
}: {
  proposal: SetupProposalRecord;
  current: { intent: string; catalogueRevision: string; target: string };
  included: string[];
  onToggle: (candidateRef: string) => void;
  onRevalidate: () => void;
  revalidating: boolean;
}) {
  const stale = isProposalStale(proposal, current);
  const required = proposal.suggestions.filter((suggestion) => suggestion.requirement === "required");
  const optional = proposal.suggestions.filter((suggestion) => suggestion.requirement === "optional");
  const missing = proposal.suggestions.filter((suggestion) => suggestion.requirement === "missing");

  return <section className="agency-proposal oi-section" aria-label="Suggested setup — proposal">
    <header className="oi-context-head">
      <span className="oi-eyebrow">Proposal — not evidence that this works, and not permission</span>
      {stale
        ? <span className="oi-state" data-attention="true">Stale — re-validate</span>
        : <span className="oi-state">Current against its own basis</span>}
    </header>

    {stale && <div className="oi-note agency-proposal-stale">
      The intent, target or catalogue revision has changed since this proposal was computed. Apply is disabled until it is re-validated.
      <button type="button" className="oi-action" onClick={onRevalidate} disabled={revalidating}>{revalidating ? "Re-validating…" : "Re-validate"}</button>
    </div>}

    <SuggestionGroup title="Required for the proposed approach" suggestions={required} included={included} onToggle={onToggle}/>
    <SuggestionGroup title="Optional support" suggestions={optional} included={included} onToggle={onToggle}/>
    <SuggestionGroup title="Missing capabilities" suggestions={missing} included={included} onToggle={onToggle}/>

    {(proposal.gaps.length > 0 || proposal.conflicts.length > 0 || proposal.duplicates.length > 0) && (
      <div className="agency-proposal-notes">
        {proposal.gaps.length > 0 && <NoteList label="Coverage gaps" items={proposal.gaps}/>}
        {proposal.conflicts.length > 0 && <NoteList label="Conflicts" items={proposal.conflicts}/>}
        {proposal.duplicates.length > 0 && <NoteList label="Duplicates" items={proposal.duplicates}/>}
      </div>
    )}

    <p className="oi-note agency-proposal-basis">
      Computed against intent <span className="oi-ref">“{proposal.basis.intent.slice(0, 80)}{proposal.basis.intent.length > 80 ? "…" : ""}”</span>,
      catalogue <span className="oi-ref">{proposal.basis.catalogueRevision}</span>, target <span className="oi-ref">{proposal.basis.target}</span>.
    </p>
  </section>;
}

function NoteList({ label, items }: { label: string; items: string[] }) {
  return <div className="agency-proposal-note-group">
    <span className="oi-eyebrow">{label}</span>
    <ul>{items.map((item, index) => <li key={index} className="oi-note">{item}</li>)}</ul>
  </div>;
}

function SuggestionGroup({ title, suggestions, included, onToggle }: { title: string; suggestions: SetupSuggestion[]; included: string[]; onToggle: (ref: string) => void }) {
  if (suggestions.length === 0) return null;
  return <div className="agency-suggestion-group">
    <span className="oi-eyebrow">{title} · {suggestions.length}</span>
    <ul className="agency-candidate-list">
      {suggestions.map((suggestion) => {
        const isIncluded = included.includes(suggestion.candidateRef);
        return <li key={suggestion.candidateRef} className="oi-row agency-candidate-row" data-included={isIncluded ? "true" : "false"}>
          <button type="button" className="oi-action" aria-pressed={isIncluded} onClick={() => onToggle(suggestion.candidateRef)} aria-label={isIncluded ? `Exclude ${suggestion.candidateRef}` : `Include ${suggestion.candidateRef}`}>
            <Glyph name={isIncluded ? "check" : "plus"} size={13}/>
          </button>
          <div className="agency-candidate-body">
            <div className="oi-ref-row">
              <span className="oi-ref">{suggestion.candidateRef}</span>
              <span className="oi-chip" data-mono="true">{suggestion.revision}</span>
              <span className="oi-state">{suggestion.targetCompatibility} with target</span>
            </div>
            <p className="oi-note">{suggestion.reason}</p>
            <div className="oi-kv">
              <dt>Stewardship</dt><dd>{suggestion.stewardship} <span className="agency-dim">({suggestion.sourceLabel})</span></dd>
              {suggestion.prerequisites.length > 0 && <><dt>Prerequisites</dt><dd>{suggestion.prerequisites.join(", ")}</dd></>}
              <dt>Proposed scope</dt><dd className="oi-ref">{suggestion.proposedScope}</dd>
            </div>
          </div>
        </li>;
      })}
    </ul>
  </div>;
}
