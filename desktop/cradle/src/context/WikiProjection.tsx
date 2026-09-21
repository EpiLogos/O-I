import {useCallback,useEffect,useState} from "react";
import {kernelOp} from "../kernel/bridge";
import {useKernel} from "../kernel/KernelProvider";
import {listFiles} from "../files/client";
import type {CentralLocation} from "../kernel/types";

/** The Agent Wiki operational projection, in the Context plane.
 *
 * Guidance is a source like any other: this section only reads and discloses
 * — the composed selection (from AIKit's own continuity tuning), the current
 * reading with its exact revision, and the honest delivery statement.
 * Correcting it is not a form here: "Correct the reading" opens the source in
 * the existing editor surface (the same Central listing → open flow every
 * source uses), where the person edits plain Markdown and saves through the
 * normal revision-checked path. An agent corrects it through the same
 * source's native tool; the next session or changed reading reaches the next
 * act by delivery, not by this surface claiming it.
 *
 * A saved file is not a delivered reading: saved, delivered and observed use
 * remain different facts, and this surface only ever claims the first. */

interface ProjectionReading {
  state:string;
  projection?:{body:string;revision:string;source:string};
}
interface SourcesReading {
  continuity?:{tunings?:Record<string,{composition?:string;values?:{sources?:string[]}}>} & Record<string,unknown>;
}

const SOURCE_DIR = "Control/agents/wiki/projections";
const SOURCE_NAME = "collaboration.md";

export function WikiProjectionSection() {
  const {transport} = useKernel();
  const [root,setRoot] = useState<string>();
  const [sources,setSources] = useState<string[]>();
  const [composition,setComposition] = useState<string>();
  const [reading,setReading] = useState<ProjectionReading>();
  const [error,setError] = useState<string>();
  const [opening,setOpening] = useState(false);
  const [openError,setOpenError] = useState<string>();

  const refresh = useCallback(async() => {
    if (!root) return;
    const response = await kernelOp(transport,{op:"wiki_projection_read",root,path:`${SOURCE_DIR}/${SOURCE_NAME}`});
    if (response.error || response.outcome?.result !== "wiki_projection_reading") {
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

  /** Open the projection source in the existing editor surface: Central lists
   * the directory, the entry's own location opens the file. No second write
   * path, no form — the correction is an ordinary edit of the source. */
  const openInTheEditor = async() => {
    if (!root) return;
    setOpening(true); setOpenError(undefined);
    try {
      const directory = await listFiles(transport, `${root}/${SOURCE_DIR}`);
      const entry = directory.entries.find(candidate => candidate.name === SOURCE_NAME && candidate.kind === "file");
      if (!entry) { setOpenError(`Central lists no ${SOURCE_NAME} under ${SOURCE_DIR}.`); return; }
      window.dispatchEvent(new CustomEvent("oi:epi-open-source", {detail: {location: entry.location as CentralLocation}}));
    } catch (cause) { setOpenError(String(cause)); }
    finally { setOpening(false); }
  };

  const revision = reading?.projection?.revision;

  return <details className="agent-section oi-disclosure" data-context="operative-guidance">
    <summary>Effective guidance · Wiki projection{revision ? ` · rev ${revision.slice(0,8)}` : ""}</summary>
    {error && <p className="oi-note" data-state="unavailable">{error}</p>}
    {!error && <>
      <p className="oi-note">
        Selected by {composition ?? "the active composition"} · {sources?.length ?? 0} source(s).
        Delivered at session start and when the reading changes; saved, delivered and observed
        use are different facts, and this surface only shows what is saved.
      </p>
      {reading?.projection && <>
        <details className="oi-disclosure"><summary>Current reading</summary><pre>{reading.projection.body}</pre></details>
        <button className="oi-action" disabled={opening} onClick={() => void openInTheEditor()}>
          {opening ? "Opening…" : "Correct the reading in the editor"}
        </button>
        {openError && <p className="oi-note" role="alert">{openError}</p>}
        <p className="oi-note">
          A correction is an ordinary edit of this source: change the Markdown here and save it
          the way any source is saved. Tell the agent in conversation and it edits the same
          source through its own tool. Recurring corrections are evidence for a reviewed
          governance change, proposed through the normal return path — never automatic law.
        </p>
      </>}
    </>}
  </details>;
}
