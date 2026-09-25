/**
 * The Library's scope control: one shared radiogroup naming where the
 * Library is reading from. "Here" names the live mode so the control reads
 * as situated ("Here · Expressions"), not generic.
 */
import {IconChoiceStrip} from "../workspace/primitives/IconTabStrip";
import {MODE_CURATION, type WorkspaceMode} from "../workspace/mode";
import type {LibraryScopeId} from "./scope";

const OPTIONS: {id: LibraryScopeId; label: string}[] = [
  {id: "here", label: "Here"},
  {id: "local", label: "This instance"},
  {id: "shared", label: "Shared web"},
];

export function LibraryScope({value, mode, onChange}: {value: LibraryScopeId; mode: WorkspaceMode; onChange: (scope: LibraryScopeId) => void}) {
  const hereLabel = `Here · ${MODE_CURATION[mode]?.label ?? mode}`;
  return <IconChoiceStrip className="lib-scope" aria-label="Library scope" current={value} onSelect={id=>onChange(id as LibraryScopeId)}
    items={OPTIONS.map(option=>({id:option.id,label:option.id==="here"?hereLabel:option.label,icon:option.id==="here"?"file":option.id==="local"?"home":"graph"}))}/>;
}
