/**
 * Which corpus the field reads. The Epi world (the workspace lens, `context.world === "epi-logos"`) swaps the
 * adapter: on, the published essay edition; off, a linked local corpus. The field host is identical either way —
 * this is the only place the world matters, and it matters only as "which `FieldSource`".
 */
import {useEffect, useMemo, useState, type ReactNode} from "react";
import type {CorpusIndex} from "./corpusIndex";
import type {FieldSource} from "./source";
import {createEssayFieldSource, rememberEssayEdition, resolveEssayEdition} from "./epi/essaySource";
import {useGenericFieldSource} from "./generic/useGenericSource";

export type FieldSourceState =
  | { status: "loading" }
  | { status: "unavailable"; title: string; reason: string; setup?: ReactNode }
  | { status: "ready"; source: FieldSource; index: CorpusIndex };

function EditionSetup() {
  const [value, setValue] = useState("");
  return (
    <form className="stubnote" onSubmit={e => { e.preventDefault(); if (value.trim()) { rememberEssayEdition(value.trim()); window.location.reload(); } }}>
      <b>Where is the published essay edition?</b> Give the address of its directory (the one holding <code>static/fieldIndex.json</code>).
      <div style={{display: "flex", gap: 8, marginTop: 8}}>
        <input aria-label="Essay edition address" value={value} onChange={e => setValue(e.target.value)} placeholder="https://…/essay/" style={{flex: 1, height: 30, padding: "0 10px", border: "1px solid var(--rule)", borderRadius: 8, background: "var(--bg)", color: "var(--ink)"}}/>
        <button type="submit" className="linkbtn">Use this edition</button>
      </div>
    </form>
  );
}

export function useFieldSource(epi: boolean): FieldSourceState {
  const edition = epi ? resolveEssayEdition() : undefined;
  const essay = useMemo(() => (edition ? createEssayFieldSource(edition) : null), [edition?.baseUrl]);   // eslint-disable-line react-hooks/exhaustive-deps
  const generic = useGenericFieldSource(!epi);
  const [state, setState] = useState<FieldSourceState>({status: "loading"});
  useEffect(() => {
    if (!epi) return;
    if (!essay) { setState({status: "unavailable", title: "No essay edition is linked", reason: "The Epi-Logos world reads the published essay edition. None is configured for this app yet — nothing is assumed.", setup: <EditionSetup/>}); return; }
    let live = true;
    setState({status: "loading"});
    essay.standing().then(async standing => {
      if (!live) return;
      if (standing.state === "unavailable") { setState({status: "unavailable", title: "The essay edition is not reachable", reason: standing.reason, setup: <EditionSetup/>}); return; }
      const index = await essay.load();
      if (live) setState({status: "ready", source: essay, index});
    }, error => live && setState({status: "unavailable", title: "The essay edition could not be read", reason: error instanceof Error ? error.message : String(error), setup: <EditionSetup/>}));
    return () => { live = false; };
  }, [epi, essay]);
  return epi ? state : generic;
}
