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
 * "Day" opens the owner's canonical day record through the Day route
 * (kernel day_source_open) — the same open the navigator's Today carries.
 *
 * "Start writing" opens a real flow file: one dated 0/1 instance minted in
 * the owner's flows area through Central's own file operation (owner
 * direction, 2026-09-22). Only when no owner ground is reachable does
 * writing fall back to the device draft (2026-09-13), which placeDraft
 * still carries to that same home on save.
 *
 * BOOT-02/03/04: at boot phases `ground-unrecognised`/`ground-inaccessible`
 * the empty-workspace region hosts the existing `GroundChooser` first, with
 * the honest reason line, above the ordinary start-working composition.
 */
export function Rest({ project, onWrite, onDay, onWiki, onSearch, onExplore }: {
  project?: string;
  onWrite: (project?: string) => Promise<void>;
  onDay?: () => Promise<void>;
  onWiki?: () => void; onSearch: () => void; title: string;
  /** SF1: the stable global entrance to the open/shared field. */
  onExplore?: () => void;
}) {
  const { boot } = useKernel();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  const groundNeedsAttention = boot.phase === "ground-unrecognised" || boot.phase === "ground-inaccessible";
  const run = async (action: () => Promise<void>) => {
    setPending(true); setFailure(undefined);
    try { await action(); } catch (error) { setFailure(String(error instanceof Error ? error.message : error)); }
    finally { setPending(false); }
  };
  const write = () => run(() => onWrite(project));
  const openDay = () => run(async () => {
    if (!onDay) throw new Error("No Day route is reachable");
    await onDay();
  });
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
        {onDay && <button disabled={pending} onClick={() => void openDay()}><Glyph name="today" size={13} /><span>Day</span></button>}
        {onWiki && <button onClick={onWiki}><Glyph name="wiki" size={13} /><span>Open wiki</span></button>}
        <button onClick={onSearch}><Glyph name="search" size={13} /><span>Search</span><kbd>⌘K</kbd></button>
        {onExplore && <button className="rest-explore" onClick={onExplore}><Glyph name="field" size={13} /><span>Browse library</span></button>}
        <button className="rest-action-primary" disabled={pending} onClick={() => void write()}><Glyph name="file" size={13} /><span>{pending ? "Opening…" : "Start writing"}</span></button>
      </nav>
      {failure && <p className="fresh-refusal rest-refusal" role="alert">{failure}</p>}
    </div>
  </section>;
}
