import { useEffect, useRef } from "react";
import { Glyph } from "./workspace/Glyph";
import { useKernel } from "./kernel/KernelProvider";
import { GroundChooser } from "./workspace/GroundChooser";

/**
 * Empty workspace and its explicit, locally held writing mode (brief FND-01
 * A9 / "Where the running app is ahead of the studies"). The empty state is
 * restyled to the study's "A space for your work" composition, keeping the
 * three real entries — this pane never fabricates a fourth. `title` stays
 * in the prop contract (Cradle.tsx still passes the workspace name) but is
 * no longer shown here — the composition dropped the duplicated
 * "Central / Central" title block the workspace name used to produce.
 *
 * BOOT-02/03/04: at boot phases `ground-unrecognised`/`ground-inaccessible`
 * the empty-workspace region hosts the existing `GroundChooser` first, with
 * the honest reason line, above the ordinary start-working composition.
 * Local writing stays reachable regardless — ground absence never blocks
 * the local canvas (BOOT-05/BOOTSTRAP transport-unavailable acceptance).
 */
export function Rest({ value, onChange, writingMode, onWritingMode, onWiki, onSearch }: {
  value: string; onChange: (value: string) => void;
  writingMode: boolean; onWritingMode: (enabled: boolean) => void;
  onWiki?: () => void; onSearch: () => void; title: string;
}) {
  const { boot } = useKernel();
  const canvasRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (writingMode) canvasRef.current?.focus(); }, [writingMode]);
  const groundNeedsAttention = boot.phase === "ground-unrecognised" || boot.phase === "ground-inaccessible";
  if (!writingMode) return <section className="workspace-start" aria-label={groundNeedsAttention ? "Locate your Central ground" : "Empty workspace"}>
    <div>
      <Glyph name="columns" size={26} />
      {groundNeedsAttention ? <>
        <h2>Locate your Central ground</h2>
        <p role="status">{boot.phase === "ground-unrecognised" ? "No default Central selected" : (boot.detail ?? "The default Central ground is not accessible")}</p>
        <GroundChooser />
      </> : <>
        <h2>A space for your work</h2>
        <p>Move a tab here, or open a surface.</p>
      </>}
      <nav aria-label="Start working">
        {!groundNeedsAttention && onWiki && <button onClick={onWiki}><Glyph name="wiki" size={13} />Open project wiki</button>}
        {!groundNeedsAttention && <button onClick={onSearch}><Glyph name="search" size={13} />Search <kbd>⌘K</kbd></button>}
        <button onClick={() => onWritingMode(true)}><Glyph name="file" size={13} />{value ? "Resume writing" : "Start writing"}</button>
      </nav>
    </div>
  </section>;
  return <section className="rest writing-mode" aria-label="Focused writing">
    <header className="writing-mode-bar"><small>WRITING</small><button onClick={() => onWritingMode(false)}>Back to workspace</button></header>
    <main className="canvas" aria-label="Canvas">
      <textarea ref={canvasRef} className="canvas-surface" value={value}
        onChange={e => onChange(e.target.value)} aria-label="Writing surface" spellCheck={false} placeholder="Start writing…" />
    </main>
  </section>;
}
