import {useCallback,useEffect,useMemo,useState} from "react";
import {kernelOp} from "../kernel/bridge";
import {useKernel} from "../kernel/KernelProvider";
import {applyCorrection} from "./wikiCorrection.mjs";

/** The Agent Wiki operational projection, in the Context plane.
 *
 * The correction loop's desktop face: which projection sources the active
 * composition selected, the current reading with its exact revision, the
 * attributed feedback ledger behind it, and a scoped correction composer
 * whose "Use this correction" writes through AIKit's own revision-checked
 * tool (`wiki_projection_update` kernel op → `aikit wiki projection
 * update`). The desktop never edits the source file itself; a stale basis
 * is refused by AIKit, and a saved update is disclosed as saved — delivery
 * happens at the next supported harness act and is not observable here.
 *
 * An explicit correction applies without a second approval ceremony; the
 * composed text stays editable before it is applied, and Undo is itself a
 * forward revision-checked change (AIKit's ledger keeps both). */

interface ProjectionFeedback {
  at?:string; actor?:string; evidence?:string; reason?:string; basis?:string;
}
interface ProjectionReading {
  state:string;
  projection?:{body:string;revision:string;source:string;feedback:ProjectionFeedback[]};
  source_kind?:string;
}
interface SourcesReading {
  continuity?:{tunings?:Record<string,{composition?:string;values?:{sources?:string[]}}>} & Record<string,unknown>;
}

const ROOT_SOURCE = "Control/agents/wiki/projections/collaboration.md";

export function WikiProjectionSection() {
  const {transport} = useKernel();
  const [root,setRoot] = useState<string>();
  const [sources,setSources] = useState<string[]>();
  const [composition,setComposition] = useState<string>();
  const [reading,setReading] = useState<ProjectionReading>();
  const [error,setError] = useState<string>();
  const [correction,setCorrection] = useState("");
  const [busy,setBusy] = useState(false);
  const [savedRevision,setSavedRevision] = useState<string>();
  const [undoBody,setUndoBody] = useState<string>();
  const [note,setNote] = useState<string>();

  const refresh = useCallback(async() => {
    if (!root) return;
    const response = await kernelOp(transport,{op:"wiki_projection_read",root,path:ROOT_SOURCE});
    if (response.error || (response.outcome?.result !== "wiki_projection_reading" && response.outcome?.result !== "wiki_projection_stored")) {
      setError(response.error ?? "The projection reading is unavailable.");
      return;
    }
    setError(undefined);
    setReading(response.outcome.data as ProjectionReading);
  },[root,transport]);

  useEffect(() => {
    let disposed = false;
    (async() => {
      const ground = await kernelOp(transport,{op:"ground",request:{action:"status"}});
      if (ground.error || ground.outcome?.result !== "ground_reading") {
        if (!disposed) setError("Central ground unavailable.");
        return;
      }
      const personal = (ground.outcome.reading as Record<string,unknown>).personal_ground;
      if (typeof personal === "string" && !disposed) setRoot(personal);
      const sourcesResponse = await kernelOp(transport,{op:"wiki_projection_sources"});
      if (!disposed && sourcesResponse.outcome?.result === "wiki_projection_sources_reading") {
        const data = sourcesResponse.outcome.data as SourcesReading;
        const tuning = data.continuity?.tunings?.["wiki-projection"];
        if (tuning) {
          setSources(tuning.values?.sources ?? []);
          setComposition(tuning.composition);
        } else if (!disposed) {
          setSources([]);
        }
      }
    })().catch(reason => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; };
  },[transport]);

  useEffect(() => { void refresh(); },[refresh]);

  const revision = reading?.projection?.revision;
  const proposed = useMemo(() => reading?.projection && correction.trim()
    ? applyCorrection(reading.projection.body, correction)
    : undefined,[reading,correction]);

  const useThisCorrection = async() => {
    if (!reading?.projection || !correction.trim()) return;
    setBusy(true); setNote(undefined); setSavedRevision(undefined);
    try {
      const response = await kernelOp(transport,{
        op:"wiki_projection_update",
        root: root!,
        path: ROOT_SOURCE,
        expected_revision: reading.projection.revision,
        evidence: "desktop:context-plane-correction",
        actor: "central:user",
        reason: correction.trim(),
        body: applyCorrection(reading.projection.body, correction),
      });
      if (response.error || response.outcome?.result !== "wiki_projection_stored") {
        setNote(response.error ?? "The correction was refused.");
      } else {
        const data = response.outcome.data as ProjectionReading;
        setUndoBody(reading.projection.body);
        setSavedRevision(data.projection?.revision);
        setCorrection("");
        setReading(data);
      }
    } finally { setBusy(false); }
  };

  const undo = async() => {
    if (!undoBody || !reading?.projection) return;
    setBusy(true); setNote(undefined);
    try {
      const response = await kernelOp(transport,{
        op:"wiki_projection_update",
        root: root!,
        path: ROOT_SOURCE,
        expected_revision: reading.projection.revision,
        evidence: "desktop:context-plane-correction",
        actor: "central:user",
        reason: "undo the previous correction",
        body: undoBody,
      });
      if (response.error || response.outcome?.result !== "wiki_projection_stored") {
        setNote(response.error ?? "The undo was refused.");
      } else {
        const data = response.outcome.data as ProjectionReading;
        setSavedRevision(data.projection?.revision);
        setUndoBody(undefined);
        setReading(data);
      }
    } finally { setBusy(false); }
  };

  const feedback = reading?.projection?.feedback ?? [];

  return <details className="agent-section oi-disclosure" data-context="operative-guidance">
    <summary>Effective guidance · Wiki projection{revision ? ` · rev ${revision.slice(0,8)}` : ""}</summary>
    {error && <p className="oi-note" data-state="unavailable">{error}</p>}
    {!error && <>
      <p className="oi-note">
        Selected by {composition ?? "the active composition"} · {sources?.length ?? 0} source(s).
        Saved, delivered and observed use are different facts: this surface shows what is saved;
        the next supported harness act receives it.
      </p>
      {savedRevision && <p className="oi-note" data-state="saved">Saved revision {savedRevision.slice(0,8)} — reaches the next supported act; the model's earlier context is not rewritten.</p>}
      {note && <p className="oi-note" role="alert">{note}</p>}
      {reading?.projection && <>
        <details className="oi-disclosure"><summary>Current reading</summary><pre>{reading.projection.body}</pre></details>
        <details className="oi-disclosure" open={!!correction}>
          <summary>Correct the reading</summary>
          <textarea
            value={correction}
            onChange={event => setCorrection(event.target.value)}
            rows={3}
            aria-label="Correction"
            placeholder="Tell the agent what to change about how it works here. An explicit correction applies without a second approval; it stays scoped to this reading."
          />
          {proposed && <details open><summary>The change that would be saved</summary><pre>{proposed}</pre></details>}
          <button className="oi-action" disabled={busy || !proposed} onClick={() => void useThisCorrection()}>
            {busy ? "Applying…" : "Use this correction"}
          </button>
          {undoBody && <button className="oi-action" disabled={busy} onClick={() => void undo()}>Undo (as a new revision)</button>}
        </details>
        <details className="oi-disclosure">
          <summary>Feedback behind this reading · {feedback.length}</summary>
          {feedback.length === 0
            ? <p className="oi-note">No recorded correction against this source yet.</p>
            : <ul>{feedback.map((entry,index) => <li key={index} className="oi-note">
                {entry.at ?? "earlier"} · {entry.reason ?? "(no reason recorded)"} · actor {entry.actor ?? "unattributed"} · evidence {entry.evidence ?? "unattributed"}
              </li>)}</ul>}
          {feedback.length > 0 && <p className="oi-note">
            Recurring corrections are evidence for a reviewed governance change, not automatic law —
            propose it through the normal source-return path.
          </p>}
        </details>
      </>}
    </>}
  </details>;
}
