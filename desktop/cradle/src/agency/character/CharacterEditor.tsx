/**
 * Change an EXISTING Agent's character: the same Character section the
 * creator uses, plus an explicit save that goes through Central's
 * compare-and-swap profile save (kernel `agent_definition` `set-character`).
 * A saved change advances the profile revision, so an accepted Agent needs
 * the person's acceptance again — the editor says so before and after.
 */
import {useEffect, useState} from "react";
import type {CharacterChange} from "../nativeAgent";
import {CharacterSection} from "./CharacterSection";

export function CharacterEditor({current, accepted, onSave, disabled}: {
  current?: string | null;
  /** Whether the Agent is currently accepted (the save will need re-acceptance). */
  accepted?: boolean;
  onSave: (characterRef: string | null) => Promise<CharacterChange | undefined>;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | undefined>(current ?? undefined);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => { setDraft(current ?? undefined); }, [current]);
  const changed = (draft ?? null) !== (current ?? null);
  const save = async () => {
    setSaving(true); setError(undefined); setOutcome(undefined);
    try {
      const change = await onSave(draft ?? null);
      if (!change) { setError("The character change was not confirmed by Central."); return; }
      setOutcome(change.state === "unchanged" ? "The Agent already carries this character."
        : `Saved as revision ${change.revision}.${change.re_acceptance_required ? " This changed source must be accepted again before it can work." : ""}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  };
  return <div className="character-editor">
    <CharacterSection value={draft} onChange={setDraft} disabled={disabled || saving}/>
    <div className="agency-action-row">
      <button type="button" className="oi-action" disabled={disabled || saving || !changed} onClick={() => void save()}>{saving ? "Saving…" : draft ? "Save character" : "Remove character"}</button>
      {changed && accepted && <span className="oi-state">Saving changes the Agent's source; it will need your acceptance again.</span>}
    </div>
    {outcome && <p className="oi-note" role="status">{outcome}</p>}
    {error && <p className="oi-refusal" role="alert">{error}</p>}
  </div>;
}
