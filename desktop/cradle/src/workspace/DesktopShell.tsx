import {SystemPanel} from "./SystemPanel";
import { useEffect, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import type { AgencyDepth, LayoutState } from "../surface/types";
import type { Workspace } from "./store";
import "./shell.css";
import { Glyph } from "./Glyph";
import { groupsOf } from "../surface/engine";

type Side = "left" | "right";
interface Props {
  layout: LayoutState; setLayout: Dispatch<SetStateAction<LayoutState>>;
  workspace: Workspace; workspaces: Workspace[];
  activate: (id: string) => void; create: (name: string) => void; rename: (name: string) => void;
  onRecover:()=>void;
  onToggleNavigator: () => void; onCloseNavigator: () => void;
  native: boolean; arrangementActions: ReactNode;
  subject: { ref?: string; title: string; context: ReactNode; history?: ReactNode };
  /** FND-02: when provided, replaces the right region's legacy plane body
   * (the accompanying agent layer owns its own header/planes/composer). */
  right?: ReactNode;
  namingRequest: "create" | "rename" | null; onNamingHandled: () => void;
  error: string | null; navigator: (workspaceSelector: ReactNode) => ReactNode; children: ReactNode;
}
export function DesktopShell(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(window.innerWidth);
  const [naming, setNaming] = useState<"create" | "rename" | null>(null);
  const [name, setName] = useState("");
  // Finding (i): the persisted plane width is already known synchronously
  // (workspace/store.ts reads it before first render) — what produced the
  // transient narrow sidebar was the plane-width transition itself running
  // across the very first commit, whatever triggered it. `booted` stays
  // false for exactly one frame so that commit lands with no transition;
  // every width change after that animates normally.
  const [booted, setBooted] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setBooted(true)); return () => cancelAnimationFrame(frame); }, []);
  const subjectKey = p.subject.ref ?? "none";
  const plane = p.layout.subjectPlanes?.[subjectKey] ?? "context";
  const setPlane = (value: "context" | "history" | "system") => p.setLayout(held=>({...held,subjectPlanes:{...held.subjectPlanes,[subjectKey]:value}}));
  useEffect(() => {
    if (!p.namingRequest) return;
    setName(p.namingRequest === "rename" ? p.workspace.name : "");
    setNaming(p.namingRequest);
    p.onNamingHandled();
  }, [p.namingRequest]);
  useEffect(() => { const o = new ResizeObserver(e => setWidth(e[0].contentRect.width)); if (host.current) o.observe(host.current); return () => o.disconnect(); }, []);
  const l = p.layout;
  const intended = (side: Side) => side === "left" ? l.agencyDepth : l.rightDepth ?? "strip";
  // Responsive tiers (brief FND-01 A4): ≤1000px snaps the sidebar/agent to
  // their compact widths so both can stay open together (the study reference
  // at 900×760 keeps both; production used to starve the room and collapse
  // the right region). ≤760px the agent becomes an overlay drawer instead of
  // collapsing, so the centre never yields below its 440px minimum for it.
  const tier: "wide" | "compact" | "drawer" = width <= 760 ? "drawer" : width <= 1000 ? "compact" : "wide";
  const overlayRight = tier === "drawer";
  // Allocate only the side panels actually requested. A collapsed inspector
  // must not evict the Central sidebar from an otherwise usable laptop window.
  const leftDefault = tier === "wide" ? l.leftWidth ?? 240 : 218;
  const leftWidth = Math.min(leftDefault, Math.max(200, width - 440));
  const leftVisible = intended("left") === "panel" && width >= 640;
  const rightRoom = overlayRight ? Infinity : width - (leftVisible ? leftWidth : 0) - 440;
  const rightDefault = tier === "wide" ? l.rightWidth ?? 320 : 260;
  const rightWidth = overlayRight ? Math.min(rightDefault, Math.max(240, width - 40)) : Math.min(rightDefault, Math.max(240, rightRoom));
  const depth = (side: Side): AgencyDepth => {
    const d = intended(side);
    if (d !== "panel") return d;
    return side === "left" ? (leftVisible ? "panel" : "collapsed") : (rightRoom >= 240 ? "panel" : "collapsed");
  };
  const setDepth = (side: Side, value: AgencyDepth) => p.setLayout(s => ({ ...s, [side === "left" ? "agencyDepth" : "rightDepth"]: value }));
  const toggle = (side: Side) => setDepth(side, intended(side) === "panel" ? "collapsed" : "panel");
  const toggleFull = (side: Side) => setDepth(side, intended(side) === "full" ? "panel" : "full");
  const focusRegion = (side: Side | "centre") => {
    const region = host.current?.querySelector<HTMLElement>(`[data-region="${side}"]`);
    region?.querySelector<HTMLElement>('textarea,input,button,[tabindex="0"]')?.focus();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyJ") { e.preventDefault(); toggleFull("right"); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "KeyB") { e.preventDefault(); toggle("right"); }
      if (e.key === "F6") {
        e.preventDefault(); const regions = (["left", "centre", "right"] as const).filter(region=>region==="centre"||["panel","full"].includes(depth(region)));
        const active = document.activeElement?.closest('[data-region]')?.getAttribute('data-region');
        const at = regions.findIndex(r => r === active);
        focusRegion(regions[(at + (e.shiftKey ? regions.length-1 : 1)+regions.length) % regions.length]);
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });
  const resize = (side: Side, value: number) => p.setLayout(s => ({ ...s, [side === "left" ? "leftWidth" : "rightWidth"]: Math.max(side === "left" ? 200 : 240, Math.min(side === "left" ? 600 : 720, value)) }));
  const separator = (side: Side) => <div className={`region-resizer ${side}`} role="separator" aria-label={`Resize ${side} region`} aria-orientation="vertical"
    aria-valuenow={side === "left" ? l.leftWidth ?? 240 : l.rightWidth ?? 320}
    aria-valuemin={side === "left" ? 200 : 240} aria-valuemax={side === "left" ? 600 : 720} tabIndex={0}
    onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); resize(side, (side === "left" ? l.leftWidth ?? 240 : l.rightWidth ?? 320) + (e.key === "ArrowRight" ? 16 : -16) * (side === "left" ? 1 : -1)); } }}
    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; const box = host.current!.getBoundingClientRect(); resize(side, side === "left" ? e.clientX - box.left : box.right - e.clientX); }}
    onPointerUp={e => e.currentTarget.releasePointerCapture(e.pointerId)} />;
  const ref = p.subject.ref;
  const left = depth("left"), right = depth("right");
  // Finding 25: an empty workspace has no groups at all — "0 groups" reads
  // as a broken counter, not a state. Name it, matching the reference
  // vocabulary's "1 group" / "Focused view" register.
  const groupCount = groupsOf(l.root).length;
  return <div ref={host} className="desktop-shell" data-workspace-id={p.workspace.id} style={{"--desktop-left-width": `${left === "panel" || left === "full" ? leftWidth : 0}px`} as React.CSSProperties}>
    {naming && <form className="workspace-name" onSubmit={e => { e.preventDefault(); if (!name.trim()) return; if (naming === "create") p.create(name); else p.rename(name); setNaming(null); }}>
      <input aria-label="Workspace name" autoFocus value={name} onChange={e => setName(e.target.value)} />
      <button type="submit">{naming === "create" ? "Create workspace" : "Save name"}</button><button type="button" onClick={() => setNaming(null)}>Cancel</button>
    </form>}
    {p.error && <p role="alert">{p.error}</p>}
    <div className="desktop-regions" data-right-full={right === "full"} data-left-full={left === "full"} data-boot={!booted}>
      <aside className={`desktop-side left depth-${left}`} data-region="left" data-depth={left} style={{ width: left === "panel" || left === "full" ? leftWidth : undefined }} aria-label="World region">
        {(left === "panel" || left === "full") && <>
          <div className="central-heading"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M3 6h7l2 2h9v12H3z"/></svg><div><strong>Central</strong><small>Personal ground</small></div><button aria-label="Collapse left region" onClick={p.onCloseNavigator}><Glyph name="sidebar"/></button></div>
          {p.navigator(null)}{left === "panel" && separator("left")}
        </>}
      </aside>
      <main className="desktop-centre" data-region="centre" aria-label="Workspace canvas">
        <header className="canvas-arrangement">
          {left !== "panel" && left !== "full" && <button aria-label="Toggle left region" onClick={p.onToggleNavigator}><Glyph name="sidebar"/></button>}
          <div className="workspace-select">
            <select aria-label="Workspace" title="Restore workspace arrangement" value={p.workspace.id} onChange={e => p.activate(e.target.value)}>{p.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
            <Glyph name="down" size={9}/>
          </div>
          <small className="arrangement-state">{l.maximizedGroupId ? "Focused view" : groupCount === 0 ? "Empty workspace" : `${groupCount} group${groupCount === 1 ? "" : "s"}`}</small>
          {l.maximizedGroupId && <button type="button" className="w-return" onClick={() => p.setLayout(s => ({ ...s, maximizedGroupId: undefined }))} title="Restore panes (⌘⌥⏎)">
            Return to arrangement <kbd>⎋</kbd>
          </button>}
          <span className="canvas-arrangement-spacer"/>
          {/* Finding 30: this fallback (browser transport only — native
           * windows keep these on the real Window menu) used to sit between
           * the workspace name and the state text, reading as a duplicated
           * affordance. Moved beside the region toggle, at the bar's own
           * trailing edge. */}
          {!p.native && <details className="desktop-menu"><summary aria-label="Workspace actions"><Glyph name="more"/></summary><div>
            <button aria-label="New workspace" onClick={() => { setName(""); setNaming("create"); }}>New workspace</button>
            <button aria-label="Rename workspace" onClick={() => { setName(p.workspace.name); setNaming("rename"); }}>Rename workspace</button>
            <button onClick={p.onRecover}>Recover saved arrangement</button>
          </div></details>}
          <nav aria-label="Canvas arrangement"><button aria-label="Toggle right region" aria-expanded={right === "panel" || right === "full"} onClick={() => toggle("right")} title={p.right ? "Accompanying agent" : "Context inspector"}><Glyph name="sidebar"/></button></nav>
        </header>
        {p.children}
      </main>
      <aside className={`desktop-side right depth-${right}`} data-region="right" data-depth={right} data-overlay={overlayRight && right === "panel"} data-focus-ref={ref} style={{ width: right === "panel" || right === "full" ? rightWidth : undefined }} aria-label="Agent and inspector region">
        {(right === "panel" || right === "full") && <>
          {right === "panel" && separator("right")}
          {/* Finding 3: the agent layer (FND-02) owns its own head, plane
           * nav and body edge-to-edge — it must mount as a direct child of
           * this aside, never inside the legacy `.inspector-body` wrapper
           * (25/20px padding, 13px body type), which stays only for the
           * honest Context/History/System fallback that renders before the
           * agent layer replaces it. */}
          {p.right ?? <>
            <div className="region-tools"><span>{p.subject.title}</span><button aria-label="Full right region" onClick={() => toggleFull("right")}><Glyph name={right === "full" ? "restore" : "expand"}/></button><button aria-label="Collapse right region" onClick={() => setDepth("right", "collapsed")}><Glyph name="close"/></button></div>
            <nav className="inspector-planes" aria-label="Right region planes">{(["context", "history", "system"] as const).map(v => <button key={v} aria-pressed={plane === v} onClick={() => setPlane(v)}>{v === "history" ? "History" : v === "system" ? "System" : "Context"}</button>)}</nav>
            <div className="inspector-body">
              {plane === "system" ? <SystemPanel/> : plane === "history" ? p.subject.history ?? <p>No history operation is available for this subject.</p> : p.subject.context}
            </div>
          </>}
        </>}
      </aside>
    </div>
  </div>;
}
