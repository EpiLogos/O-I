/**
 * Which corpus the field reads. The Epi world (the workspace lens, `context.world === "epi-logos"`) swaps the
 * adapter: on, the published essay edition; off, a linked local corpus. The field host is identical either way —
 * this is the only place the world matters, and it matters only as "which `FieldSource`".
 */
import {useEffect, useMemo, useState, type ReactNode} from "react";
import type {CorpusIndex} from "./corpusIndex";
import type {FieldSource} from "./source";
import {createEssayFieldSource, rememberEssayEdition, resolveEssayEditionAsync, type EssayEdition} from "./epi/essaySource";
import {useGenericFieldSource} from "./generic/useGenericSource";

export type FieldSourceState =
  | { status: "loading" }
  | { status: "unavailable"; title: string; reason: string; setup?: ReactNode }
  | { status: "ready"; source: FieldSource; index: CorpusIndex };

function EditionSetup({onRetry}: {onRetry?: () => void}) {
  const [value, setValue] = useState("");
  return (
    <form className="stubnote" onSubmit={e => { e.preventDefault(); if (value.trim()) { rememberEssayEdition(value.trim()); window.location.reload(); } }}>
      <b>Where is the published essay edition?</b> Give the address of its directory (the one holding <code>static/fieldIndex.json</code>).
      {onRetry ? <div style={{marginTop: 8}}><button type="button" className="linkbtn" onClick={onRetry}>Look again for the installed World</button></div> : null}
      <div style={{display: "flex", gap: 8, marginTop: 8}}>
        <input aria-label="Essay edition address" value={value} onChange={e => setValue(e.target.value)} placeholder="https://…/essay/" style={{flex: 1, height: 30, padding: "0 10px", border: "1px solid var(--rule)", borderRadius: 8, background: "var(--bg)", color: "var(--ink)"}}/>
        <button type="submit" className="linkbtn">Use this edition</button>
      </div>
    </form>
  );
}

type EditionAnswer = { status: "pending" } | { status: "edition"; edition: EssayEdition } | { status: "unavailable"; reason: string; state: string };

export function useFieldSource(epi: boolean): FieldSourceState {
  // The edition is a configured one (override, saved address, build setting) or, failing those, the installed World package asked of the kernel.
  const [answer, setAnswer] = useState<EditionAnswer>({status: "pending"});
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt(n => n + 1);
  useEffect(() => {
    if (!epi) return;
    let live = true;
    setAnswer({status: "pending"});
    resolveEssayEditionAsync().then(
      resolved => live && setAnswer("unavailable" in resolved ? {status: "unavailable", reason: resolved.unavailable, state: resolved.state} : {status: "edition", edition: resolved}),
      error => live && setAnswer({status: "unavailable", reason: error instanceof Error ? error.message : String(error), state: "unreachable"}));
    return () => { live = false; };
  }, [epi, attempt]);
  const edition = answer.status === "edition" ? answer.edition : undefined;
  const essay = useMemo(() => (edition ? createEssayFieldSource(edition) : null), [edition?.baseUrl]);   // eslint-disable-line react-hooks/exhaustive-deps
  const generic = useGenericFieldSource(!epi);
  const [state, setState] = useState<FieldSourceState>({status: "loading"});
  useEffect(() => {
    if (!epi) return;
    if (answer.status === "pending") { setState({status: "loading"}); return; }
    if (!essay) {
      const absent = answer.status === "unavailable" ? answer : { reason: "The Epi-Logos world reads the published essay edition. None is configured for this app yet — nothing is assumed." };
      setState({status: "unavailable", title: "No essay edition is linked", reason: absent.reason, setup: <EditionSetup onRetry={retry}/>});
      return;
    }
    let live = true;
    setState({status: "loading"});
    essay.standing().then(async standing => {
      if (!live) return;
      if (standing.state === "unavailable") { setState({status: "unavailable", title: "The essay edition is not reachable", reason: standing.reason, setup: <EditionSetup onRetry={retry}/>}); return; }
      const index = await essay.load();
      if (live) setState({status: "ready", source: essay, index});
    }, error => live && setState({status: "unavailable", title: "The essay edition could not be read", reason: error instanceof Error ? error.message : String(error), setup: <EditionSetup onRetry={retry}/>}));
    return () => { live = false; };
  }, [epi, essay, answer.status]);
  return epi ? state : generic;
}
