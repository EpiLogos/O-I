/**
 * The creator's Character section: choose a reusable expressive character,
 * preview it live in any of its saved states or gestures, and open its
 * material in Expressions to adapt it. The chosen Central file ref is what
 * the Agent saves as `expressive_character_ref` (via agent-profile.express);
 * the material itself stays in its own document.
 */
import {useEffect, useMemo, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {characterPreview, characterRepertoire, type CharacterChoice} from "./characterModel";
import {openCharacterInExpressions, useCharacterCatalogue, useCharacterDocument} from "./characterMaterial";
import {CharacterPreview} from "./CharacterPreview";

/** Select values keep the kind apart from the (free-text) name: a NUL
 * separator can never occur in an authored state or gesture name. */
const SEP = "\u0000";
export function encodeChoice(choice: CharacterChoice): string {
  return choice.gesture ? `gesture${SEP}${choice.gesture}` : choice.state ? `state${SEP}${choice.state}` : "";
}
export function decodeChoice(value: string): CharacterChoice {
  const at = value.indexOf(SEP);
  if (at < 0) return {};
  const kind = value.slice(0, at), name = value.slice(at + 1);
  return kind === "gesture" ? {gesture: name} : kind === "state" ? {state: name} : {};
}

export function CharacterSection({value, onChange, disabled}: {value?: string; onChange: (ref: string | undefined) => void; disabled?: boolean}) {
  const kernel = useKernel();
  const catalogue = useCharacterCatalogue(kernel.transport);
  const reading = useCharacterDocument(kernel.transport, value);
  const [choice, setChoice] = useState<CharacterChoice>({});
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string>();
  useEffect(() => { setChoice({}); setOpenError(undefined); }, [value]);
  const material = useMemo(() => reading.document ? characterPreview(reading.document, choice) : null, [reading.document, choice.state, choice.gesture]);
  const repertoire = reading.document ? characterRepertoire(reading.document) : {states: [], gestures: [], preview: null};
  const known = catalogue.characters.some(character => character.file_ref === value);
  const edit = async () => {
    if (!value) return;
    setOpening(true); setOpenError(undefined);
    try { await openCharacterInExpressions(kernel.transport, value, catalogue.characters.find(character => character.file_ref === value)?.location); }
    catch (error) { setOpenError(error instanceof Error ? error.message : String(error)); }
    finally { setOpening(false); }
  };
  const pick = (selection: string) => setChoice(decodeChoice(selection));
  return <fieldset className="oi-section character-section" aria-label="Character" disabled={disabled}>
    <legend>Character</legend>
    <div className="character-section-body">
      <CharacterPreview material={material} size={112}/>
      <div className="character-section-controls">
        <label className="oi-field">Reusable character
          <select className="oi-input" aria-label="Reusable character" value={value ?? ""} onChange={event => onChange(event.target.value || undefined)}>
            <option value="">No character</option>
            {catalogue.characters.map(character => <option key={character.file_ref} value={character.file_ref}>{character.title}</option>)}
            {value && !known && <option value={value}>{value}</option>}
          </select>
        </label>
        {catalogue.state === "reading" && <p className="oi-note" aria-busy="true">Reading reusable characters…</p>}
        {catalogue.state === "error" && <p className="oi-note" role="status">Reusable characters could not be listed: {catalogue.error} <button type="button" className="oi-action" onClick={catalogue.retry}>Read again</button></p>}
        {catalogue.state === "ready" && catalogue.characters.length === 0 && <p className="oi-note">No reusable characters are saved yet. Create one in Expressions and save it as a character.</p>}
        {reading.document && (repertoire.states.length > 0 || repertoire.gestures.length > 0) && <label className="oi-field">Preview
          <select className="oi-input" aria-label="Character state or gesture" value={encodeChoice(choice)} onChange={event => pick(event.target.value)}>
            <option value="">{repertoire.preview ? `Card preview (${repertoire.preview})` : "Entry"}</option>
            {repertoire.states.length > 0 && <optgroup label="States">{repertoire.states.map(name => <option key={name} value={encodeChoice({state: name})}>{name}</option>)}</optgroup>}
            {repertoire.gestures.length > 0 && <optgroup label="Gestures">{repertoire.gestures.map(name => <option key={name} value={encodeChoice({gesture: name})}>{name}</option>)}</optgroup>}
          </select>
        </label>}
        {reading.state === "error" && <p className="oi-refusal" role="status">{reading.error}</p>}
        {value && <button type="button" className="oi-action" disabled={opening} onClick={() => void edit()}>{opening ? "Opening…" : "Edit in Expressions"}</button>}
        {openError && <p className="oi-refusal" role="alert">{openError}</p>}
        {value && <p className="oi-note">Saved on the Agent as <code className="oi-ref">{value}</code>.</p>}
      </div>
    </div>
  </fieldset>;
}
