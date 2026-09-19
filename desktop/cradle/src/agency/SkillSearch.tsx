/**
 * SkillSearch — manual search over the registered SkillSearchSource
 * (agencySources.ts). Debounced 250ms with AbortController; literal filter
 * first. Coverage states (partial/stale/unavailable) render differently
 * from "no matches". Stays fully usable when inference is unavailable —
 * this component never touches SetupInferenceSource.
 */
import { useEffect, useRef, useState } from "react";
import { Glyph } from "../workspace/Glyph";
import { getSkillSearchSource, subscribeSkillSearchSource } from "./agencySources";
import type { SkillCandidate } from "./agencySources";

const DEBOUNCE_MS = 250;

export function SkillSearch({
  project,
  included,
  onToggle,
}: {
  project?: string;
  included: string[];
  onToggle: (candidate: SkillCandidate) => void;
}) {
  const [text, setText] = useState("");
  const [bound, setBound] = useState(() => getSkillSearchSource() !== undefined);
  const [candidates, setCandidates] = useState<SkillCandidate[]>([]);
  const [coverage, setCoverage] = useState<{ coverage: "complete" | "partial" | "stale" | "unavailable"; reason?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController>();

  useEffect(() => subscribeSkillSearchSource(() => setBound(getSkillSearchSource() !== undefined)), []);

  useEffect(() => {
    const source = getSkillSearchSource();
    if (!source) { setCandidates([]); setCoverage(null); return; }
    if (!text.trim()) { setCandidates([]); setCoverage(null); setError(undefined); return; }
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPending(true);
      setError(undefined);
      source.search({ text, project }, controller.signal)
        .then((result) => { if (!controller.signal.aborted) { setCandidates(result.candidates); setCoverage({ coverage: result.coverage, reason: result.reason }); } })
        .catch((cause) => { if (!controller.signal.aborted) setError(String(cause)); })
        .finally(() => { if (!controller.signal.aborted) setPending(false); });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(handle); abortRef.current?.abort(); };
  }, [text, project, bound]);

  if (!bound) {
    return <div className="oi-refusal" data-agency-search-unavailable>
      No Skill search source is registered — AIKit's search/discovery seam (AIKit #34/#118/#122) supplies it. Manual entry of a known Skill ref is not offered without it.
    </div>;
  }

  return <div className="agency-skill-search">
    <div className="oi-field">
      <label htmlFor="agency-skill-search-input" className="oi-eyebrow">Search Methods, Skills and SkillSets</label>
      <input
        id="agency-skill-search-input"
        className="oi-input"
        type="text"
        value={text}
        placeholder="literal text — e.g. “claim reception”"
        onChange={(event) => setText(event.target.value)}
        aria-describedby="agency-skill-search-coverage"
      />
    </div>
    <div id="agency-skill-search-coverage" className="oi-ref-row">
      {pending && <span className="oi-state">Searching…</span>}
      {!pending && coverage && <span className="oi-state" data-attention={coverage.coverage !== "complete" ? "true" : undefined}>
        {coverage.coverage === "complete" ? "Complete coverage" : coverage.coverage === "partial" ? "Partial coverage" : coverage.coverage === "stale" ? "Stale index" : "Search unavailable"}
        {coverage.reason ? ` — ${coverage.reason}` : ""}
      </span>}
      {error && <span className="oi-state" role="alert">{error}</span>}
    </div>
    {!pending && text.trim() && candidates.length === 0 && !error && (
      <p className="oi-empty"><span>No matches for “{text}”.</span></p>
    )}
    <ul className="agency-candidate-list" aria-label="Search results">
      {candidates.map((candidate) => (
        <SkillCandidateRow key={candidate.ref} candidate={candidate} included={included.includes(candidate.ref)} onToggle={() => onToggle(candidate)}/>
      ))}
    </ul>
  </div>;
}

export function SkillCandidateRow({ candidate, included, onToggle }: { candidate: SkillCandidate; included: boolean; onToggle: () => void }) {
  return <li className="oi-row agency-candidate-row" data-included={included ? "true" : "false"}>
    <button type="button" className="oi-action" aria-pressed={included} onClick={onToggle} aria-label={included ? `Exclude ${candidate.title}` : `Include ${candidate.title}`}>
      <Glyph name={included ? "check" : "plus"} size={13}/>
    </button>
    <div className="agency-candidate-body">
      <div className="oi-ref-row">
        <strong>{candidate.title}</strong>
        <span className="oi-chip" data-mono="true">{candidate.kind}</span>
        <span className="oi-chip" data-mono="true">{candidate.revision}</span>
        {candidate.fixture && <span className="oi-state" data-attention="true">Fixture — not native data</span>}
      </div>
      {candidate.summary && <p className="oi-note">{candidate.summary}</p>}
      <div className="oi-ref-row">
        <span className="oi-ref">{candidate.source}{candidate.steward ? ` · stewarded by ${candidate.steward}` : ""}</span>
        {candidate.prerequisites.length > 0 && <span className="oi-state">requires {candidate.prerequisites.join(", ")}</span>}
        {candidate.targets.length > 0 && <span className="oi-state">targets {candidate.targets.join(", ")}</span>}
      </div>
    </div>
  </li>;
}
