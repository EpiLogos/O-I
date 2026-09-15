import { useState } from "react";
import { Glyph } from "./workspace/Glyph";
import { useKernel } from "./kernel/KernelProvider";
import { GroundChooser } from "./workspace/GroundChooser";
import { WelcomePrompt } from "./flow/WelcomePrompt";
import "./flow/flow.css";

/**
 * Empty workspace (brief FND-01 A9 / "Where the running app is ahead of the
 * studies"). There is exactly ONE first-state composition — the fresh-surface
 * page, shared with FreshSurface (same section composition, same rolling
 * WelcomePrompt). The old study-era "A space for your work" parallel was
 * removed; this pane keeps its three real entries — it never fabricates a
 * fourth. `title` stays in the prop contract (Cradle.tsx still passes the
 * workspace name) but is not shown.
 *
 * Writing is not a mode this pane owns. "Start writing" opens writing kept on
 * this device — no Flow, no file, no Day is minted as a side effect of
 * opening (owner correction, 2026-09-12: the blank now/flows/ placeholder
 * premise was the fault). The register named before opening rides the draft
 * as its default; the ground receives the writing only when the human
 * explicitly saves real content, through Central's own operation.
 *
 * BOOT-02/03/04: at boot phases `ground-unrecognised`/`ground-inaccessible`
 * the empty-workspace region hosts the existing `GroundChooser` first, with
 * the honest reason line, above the ordinary start-working composition.
 */
export function Rest({ project, onWrite, onWiki, onSearch, onExplore }: {
  project?: string;
  onWrite: (project?: string) => Promise<void>;
  onWiki?: () => void; onSearch: () => void; title: string;
  /** SF1: the stable global entrance to the open/shared field. */
  onExplore?: () => void;
}) {
  const { boot } = useKernel();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  const groundNeedsAttention = boot.phase === "ground-unrecognised" || boot.phase === "ground-inaccessible";
  const write = async () => {
    setPending(true); setFailure(undefined);
    try { await onWrite(project); } catch (error) { setFailure(String(error instanceof Error ? error.message : error)); }
    finally { setPending(false); }
  };
  return <section className="fresh-surface" aria-label={groundNeedsAttention ? "Locate your Central ground" : "Empty workspace"}>
    <div>
      {groundNeedsAttention ? <>
        <h2>Locate your Central ground</h2>
        <p role="status">{boot.phase === "ground-unrecognised" ? "No default Central selected" : (boot.detail ?? "The default Central ground is not accessible")}</p>
        <GroundChooser />
      </> : <WelcomePrompt paused={pending} />}
      {/* Writing never waits for a ground either: the chooser asks for one,
          and the entry to write stays reachable beside it. */}
      <nav aria-label="Start working">
        {onWiki && <button onClick={onWiki}><Glyph name="wiki" size={13} />Open project wiki</button>}
        <button onClick={onSearch}><Glyph name="search" size={13} />Search <kbd>⌘K</kbd></button>
        {onExplore && <button className="rest-explore" onClick={onExplore}><Glyph name="field" size={13} />Explore the open field</button>}
        <button disabled={pending} onClick={() => void write()}><Glyph name="file" size={13} />{pending ? "Opening…" : "Start writing"}</button>
      </nav>
      {failure && <p className="fresh-refusal" role="alert">{failure}</p>}
    </div>
  </section>;
}
