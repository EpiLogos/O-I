import { useState } from "react";
import { Glyph } from "./workspace/Glyph";
import { useKernel } from "./kernel/KernelProvider";
import { GroundChooser } from "./workspace/GroundChooser";
import { WelcomePrompt } from "./flow/WelcomePrompt";

import "./flow/flow.css";

/**
 * Empty workspace: ordinary activities first. The native source chooser and
 * existing open/search/write callbacks remain authoritative; no placeholder
 * binding or native document is minted just to render this resting surface.
 * `title` remains in the public prop contract for existing callers.
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
  return <section className="fresh-surface rest-ground" aria-label={groundNeedsAttention ? "Connect your Central workspace" : "Empty workspace"}>
    <div>
      {groundNeedsAttention ? <>
        <div className="rest-ground-head">
          <h2>Connect your Central workspace</h2>
          <p role="status" className="rest-ground-status">{boot.phase === "ground-unrecognised" ? "Choose the Central workspace that holds your files" : (boot.detail ?? "The default Central ground is not accessible")}</p>
        </div>
        <GroundChooser />
      </> : <header className="welcome-prompt"><WelcomePrompt placement="returning"/><p>Start a draft, find a source, or open your library.</p></header>}
      {/* Writing never waits for a ground either: the chooser asks for one,
          and the entry to write stays reachable beside it. */}
      <nav className="rest-actions" aria-label="Start working">
        {onWiki && <button onClick={onWiki}><Glyph name="wiki" size={13} /><span>Open wiki</span></button>}
        <button onClick={onSearch}><Glyph name="search" size={13} /><span>Search</span><kbd>⌘K</kbd></button>
        {onExplore && <button className="rest-explore" onClick={onExplore}><Glyph name="field" size={13} /><span>Browse library</span></button>}
        <button className="rest-action-primary" disabled={pending} onClick={() => void write()}><Glyph name="file" size={13} /><span>{pending ? "Opening…" : "Start writing"}</span></button>
      </nav>
      {failure && <p className="fresh-refusal rest-refusal" role="alert">{failure}</p>}
    </div>
  </section>;
}
