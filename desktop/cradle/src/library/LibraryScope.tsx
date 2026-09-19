/**
 * The Library's scope control: one `.oi-segment` radiogroup naming where the
 * Library is reading from. "Here" names the live mode so the control reads
 * as situated ("Here · Expressions"), not generic.
 */
import type {KeyboardEvent} from "react";
import {MODE_CURATION, type WorkspaceMode} from "../workspace/mode";
import type {LibraryScopeId} from "./scope";

const OPTIONS: {id: LibraryScopeId; label: string}[] = [
  {id: "here", label: "Here"},
  {id: "local", label: "This instance"},
  {id: "shared", label: "Shared web"},
];

export function LibraryScope({value, mode, onChange}: {value: LibraryScopeId; mode: WorkspaceMode; onChange: (scope: LibraryScopeId) => void}) {
  const hereLabel = `Here · ${MODE_CURATION[mode]?.label ?? mode}`;
  const move = (from: number, delta: number) => {
    const next = OPTIONS[(from + delta + OPTIONS.length) % OPTIONS.length];
    if (next) onChange(next.id);
  };
  const onKey = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); move(index, 1); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); move(index, -1); }
    else if (event.key === "Home") { event.preventDefault(); onChange(OPTIONS[0].id); }
    else if (event.key === "End") { event.preventDefault(); onChange(OPTIONS[OPTIONS.length - 1].id); }
  };
  return <div className="oi-segment lib-scope" role="radiogroup" aria-label="Library scope">
    {OPTIONS.map((option, index) => <button key={option.id} type="button" role="radio" aria-checked={value === option.id}
      tabIndex={value === option.id ? 0 : -1}
      onClick={() => onChange(option.id)} onKeyDown={onKey(index)}>
      {option.id === "here" ? hereLabel : option.label}
    </button>)}
  </div>;
}
