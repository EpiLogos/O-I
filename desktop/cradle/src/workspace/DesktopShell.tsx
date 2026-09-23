import {useShellGeometry} from "./geometry";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import type { AgencyDepth, LayoutState } from "../surface/types";
import type { Workspace } from "./store";
import "./shell.css";
import "./sidebar-presentation.css";
import { Glyph } from "./Glyph";
import { focusGroup, groupsOf } from "../surface/engine";
import { type TabPresentation, type WorkspaceMode } from "./mode";
import type { AgentPresence } from "../agent/presence";
import { LeftFrame } from "./left/LeftFrame";
import type { LeftHost } from "./left/host";
import { scopeLabel, useScope } from "./scope";
import { setLens, useEpiLens } from "./lens";

type Side = "left" | "right";
const FOOTER_KEY="oi-shell-footer.v2";
const FOOTER_LEGACY_KEY="oi-shell-footer-pinned";
interface Props {
  layout: LayoutState; setLayout: Dispatch<SetStateAction<LayoutState>>;
  workspace: Workspace; workspaces: Workspace[];
  activate: (id: string) => void; create: (name: string) => void; rename: (name: string) => void;
  onRecover:()=>void;
  onToggleNavigator: () => void; onCloseNavigator: () => void;
  native: boolean; arrangementActions: ReactNode;
  /** The macOS traffic lights are actually present: Tauri on a Mac AND not
   * fullscreen (the system hides them there). Only this condition earns the
   * window-controls reserve — its corner cutouts and the header's left
   * offset — never "is Tauri" alone, and never a static platform guess. */
  windowLights?: boolean;
  /** The workspace mode. One shell serves every mode: the mode changes what
   * the three regions are curated to show, never the shell, the pane system
   * or the sessions inside them. The mode strip itself lives at the World
   * navigator's bottom row; the footer menu here is the fallback while the
   * navigator is not shown. */
  mode: WorkspaceMode; onMode: (mode: WorkspaceMode) => void;
  onLibrary?: () => void;
  world?: "central" | "epi-logos"; onLeaveWorld?: () => void;
  returnTo?: { mode: WorkspaceMode; label: string }; onReturn?: () => void;
  /** The left frame's host (10-SIDEBARS §3): the routes its head, foot and
   * rows reach — search, create, open beside, pop out, open a chat, open an
   * Inbox item. An entry the frame does not lend is simply not offered. */
  left?: LeftHost;
  onTabPresentation: (presentation: TabPresentation) => void;
  subject: { ref?: string; title: string; context: ReactNode; history?: ReactNode };
  /** FND-02: when provided, replaces the right region's legacy plane body
   * (the accompanying agent layer owns its own header/planes/composer). */
  right?: ReactNode;
  /** The Status face of the agent-work gradient (Status → Preview →
   * Takeover): the observed encounter state carried in the frame while the
   * panel itself is collapsed. Clicking it opens the pinned panel. */
  agentPresence?: AgentPresence;
  namingRequest: "create" | "rename" | null; onNamingHandled: () => void;
  error: string | null; onErrorDismiss?: () => void;
  /** The workspace-recovery state surfaces only here, inside the footer
   * status menu — nothing of the shell ever renders above the shell. */
  recovery?: { reason: string; key?: string } | null;
  /** Epi-Logos: a whole-app world state, disclosed and toggled here in the
   * footer (owner ruling 2026-09-18) — never a mode entry or a page. */
  epiLogos?: boolean; onEpiLogosToggle?: () => void;
  onRecoverAvailable?: () => void; onStartFresh?: () => void; /** One click reloads the workspace (owner ruling 2026-09-19) — the message row and its dismissal both route here while a load failure stands. */ onReload?: () => void;
  navigator: (workspaceSelector: ReactNode) => ReactNode; children: ReactNode;
}
function readSidebarTokens(): {min: number; max: number; width: number} {
  const style = typeof document === "undefined" ? undefined : getComputedStyle(document.documentElement);
  const read = (name: string, fallback: number) => { const value = parseFloat(style?.getPropertyValue(name) ?? ""); return Number.isFinite(value) && value > 0 ? value : fallback; };
  return {min: read("--oi-sidebar-min", 200), max: read("--oi-sidebar-max", 330), width: read("--oi-sidebar-width", 240)};
}
export function DesktopShell(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [sidebar] = useState(readSidebarTokens);
  const scope = useScope();
  const lens = useEpiLens();
  const [width, setWidth] = useState(window.innerWidth);
  const [naming, setNaming] = useState<"create" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [navigatorOverlay, setNavigatorOverlay] = useState(false);
  const overlayReturn = useRef<HTMLElement | null>(null);
  // The footer is a reveal surface; pinning is an explicit human action and
  // the only thing that writes this key. The v1 key ("oi-shell-footer-pinned")
  // is retired deliberately: a value persisted while the reveal logic was
  // broken is not a preference, so it is removed rather than migrated and
  // every installation starts unpinned under v2.
  const [footerPinned,setFooterPinned]=useState(()=>{try{localStorage.removeItem(FOOTER_LEGACY_KEY);return localStorage.getItem(FOOTER_KEY)==="pinned";}catch{return false;}});
  // Finding (i): the persisted plane width is already known synchronously
  // (workspace/store.ts reads it before first render) — what produced the
  // transient narrow sidebar was the plane-width transition itself running
  // across the very first commit, whatever triggered it. `booted` stays
  // false for exactly one frame so that commit lands with no transition;
  // every width change after that animates normally.
  const [booted, setBooted] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setBooted(true)); return () => cancelAnimationFrame(frame); }, []);
  // Mode switches get one small quiet token-motion: the centre and the left
  // body settle in over the shared UI duration. One finite Web Animation per
  // switch — no timers, no listeners, nothing scheduled once it ends — and it
  // is static under reduced motion. The cold-boot particle flight stays the
  // opening's alone; a switch has no physics of its own.
  const enteredMode = useRef(p.mode);
  useLayoutEffect(() => {
    if (enteredMode.current === p.mode) return;
    enteredMode.current = p.mode;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // L8: the left head and foot hold still — only the body cross-fades,
    // and never longer than 160ms.
    const duration = Math.min(160, parseFloat(getComputedStyle(host.current!).getPropertyValue("--oi-motion-plane")) || 160);
    const played = ['[data-region="centre"]', '[data-region="left"] .left-body'].flatMap(selector => {
      const node = host.current?.querySelector<HTMLElement>(selector);
      return node?.animate ? [node.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" })] : [];
    });
    return () => played.forEach(animation => animation.cancel());
  }, [p.mode]);
  useEffect(() => {
    if (!p.namingRequest) return;
    setName(p.namingRequest === "rename" ? p.workspace.name : "");
    setNaming(p.namingRequest);
    p.onNamingHandled();
  }, [p.namingRequest]);
  useEffect(() => { const o = new ResizeObserver(e => setWidth(e[0].contentRect.width)); if (host.current) o.observe(host.current); return () => o.disconnect(); }, []);
  useEffect(() => {
    const closeMenus = (event: Event) => {
      const open = Array.from(host.current?.querySelectorAll<HTMLDetailsElement>('details.desktop-menu[open]') ?? []);
      if (!open.length) return;
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      let closed = false;
      for (const menu of open) {
        if (event.type === 'blur' || event instanceof KeyboardEvent || !menu.contains(event.target as Node)) {
          menu.open = false; closed = true;
          if (event instanceof KeyboardEvent) menu.querySelector<HTMLElement>('summary')?.focus();
        }
      }
      if (closed && event instanceof KeyboardEvent) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener('pointerdown', closeMenus, true);
    window.addEventListener('keydown', closeMenus, true);
    window.addEventListener('blur', closeMenus);
    return () => { window.removeEventListener('pointerdown', closeMenus, true); window.removeEventListener('keydown', closeMenus, true); window.removeEventListener('blur', closeMenus); };
  }, []);
  const l = p.layout;
  // The left region has ONE collapsed state: "strip" rendered exactly like
  // "collapsed", so the two are merged here (10-SIDEBARS §6.2).
  const intended = (side: Side) => side === "left" ? (l.agencyDepth === "strip" ? "collapsed" : l.agencyDepth) : l.rightDepth ?? "strip";
  // Responsive tiers (brief FND-01 A4): ≤1000px snaps the sidebar/agent to
  // their compact widths so both can stay open together (the study reference
  // at 900×760 keeps both; production used to starve the room and collapse
  // the right region). ≤760px the agent becomes an overlay drawer instead of
  // collapsing, so the centre never yields below its 440px minimum for it.
  const tier: "wide" | "compact" | "drawer" = width <= 760 ? "drawer" : width <= 1000 ? "compact" : "wide";

  // Allocate only the side panels actually requested. A collapsed inspector
  // must not evict the Central sidebar from an otherwise usable laptop window.
  // Width tokens win (L5): the left clamps to --oi-sidebar-min/max
  // (200–330) and rests at --oi-sidebar-width, never the old 600px clamp.
  const leftDefault = Math.min(sidebar.max, Math.max(sidebar.min, l.leftWidth ?? (tier === "wide" ? sidebar.width : 218)));
  const overlayLeft = width < 640 && navigatorOverlay;
  const leftWidth = Math.min(leftDefault, Math.max(200, width - (overlayLeft ? 40 : 440)));
  const leftVisible = intended("left") === "panel" && width >= 640;
  // Canvas modes (expressions, techne) play well with the agent floating
  // over the field — a working canvas is not "components". Component modes
  // (factory, settings, base, epi-logos) PUSH instead: the centre yields
  // room to the panel, never the panel over the working UI.
  const canvasCentre = p.mode === "expressions" || p.mode === "techne";
  const availableRight = width - (leftVisible ? leftWidth : 0) - (canvasCentre ? 452 : 8);
  // 10-SIDEBARS P18: at ≤760px the panel is an overlay drawer in every mode.
  const overlayRight = tier === "drawer" || (availableRight < 240 && canvasCentre);
  const rightRoom = overlayRight ? Infinity : Math.max(availableRight, 240);
  const rightDefault = l.rightWidth ?? (tier === "wide" ? 320 : 260);
  const rightWidth = overlayRight ? Math.min(rightDefault, Math.max(240, width - 40)) : Math.min(rightDefault, Math.max(240, rightRoom));
  const depth = (side: Side): AgencyDepth => {
    const d = intended(side);
    if (side === "left" && overlayLeft) return "panel";
    if (side === "left" && width < 640) return "collapsed";
    if (side === "right" && overlayLeft) return "collapsed";
    if (d !== "panel") return d;
    return side === "left" ? (leftVisible ? "panel" : "collapsed") : (rightRoom >= 240 ? "panel" : "collapsed");
  };
  const closeNavigator = () => { if (width < 640) setNavigatorOverlay(false); else p.onCloseNavigator(); };
  const summonNavigator = () => { if (width < 640) setNavigatorOverlay(v => !v); else p.onToggleNavigator(); };
  useEffect(() => {
    const toggleCentral = () => summonNavigator();
    window.addEventListener("oi:toggle-central", toggleCentral);
    return () => window.removeEventListener("oi:toggle-central", toggleCentral);
  });
  useEffect(() => {
    if (!overlayLeft) return;
    overlayReturn.current = document.activeElement as HTMLElement;
    host.current?.querySelector<HTMLElement>('[data-region="left"] button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); setNavigatorOverlay(false); }
      if (e.key === "Tab") {
        const stops = Array.from(host.current?.querySelectorAll<HTMLElement>('[data-region="left"] button:not([disabled]), [data-region="left"] input, [data-region="left"] [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
        const first = stops[0], last = stops[stops.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); if (overlayReturn.current?.isConnected) overlayReturn.current.focus(); };
  }, [overlayLeft]);
  useEffect(() => {
    if (width >= 640) { setNavigatorOverlay(false); return; }
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.code === "KeyB") { e.preventDefault(); e.stopImmediatePropagation(); setNavigatorOverlay(v => !v); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [width < 640]);
  const setDepth = (side: Side, value: AgencyDepth) => p.setLayout(s => ({ ...s, [side === "left" ? "agencyDepth" : "rightDepth"]: value }));
  const toggle = (side: Side) => setDepth(side, intended(side) === "panel" ? "collapsed" : "panel");
  const toggleFull = (side: Side) => {
    setDepth(side, intended(side) === "full" ? "panel" : "full");
  };
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
  const clampWidth = (side: Side, value: number) => Math.max(side === "left" ? sidebar.min : 240, Math.min(side === "left" ? Math.min(sidebar.max,overlayLeft?width-40:width-440-(rightOpen&&!overlayRight?rightWidth:0)) : Math.min(720,overlayRight?width-40:width-440-(leftOpen?leftWidth:0)), value));
  const resize = (side: Side, value: number) => p.setLayout(s => ({ ...s, [side === "left" ? "leftWidth" : "rightWidth"]: clampWidth(side, value) }));
  /** Drop the persisted width override: the region returns to its tier default. */
  const resetWidth = (side: Side) => p.setLayout(s => { const next = { ...s }; if (side === "left") delete next.leftWidth; else delete next.rightWidth; return next; });
  /** Live width readout while a drag is in flight — one small badge at the
   * separator, so the size being chosen is visible while it is chosen. */
  const [resizeFeedback, setResizeFeedback] = useState<{side: Side; width: number} | null>(null);
  const endDrag = (e: { currentTarget: HTMLElement; pointerId: number }) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    delete e.currentTarget.dataset.dragging;
    if (host.current) delete host.current.dataset.resizing;
    document.documentElement.style.removeProperty("cursor"); document.documentElement.style.removeProperty("user-select");
    setResizeFeedback(null);
  };
  const regionWidth = (side: Side) => host.current?.querySelector<HTMLElement>(`[data-region="${side}"]`)?.getBoundingClientRect().width;
  const separator = (side: Side) => <div className={`region-resizer ${side}`} role="separator" aria-label={`Resize ${side} region`} aria-orientation="vertical"
    aria-valuenow={side === "left" ? leftWidth : l.rightWidth ?? 320}
    aria-valuemin={side === "left" ? sidebar.min : 240} aria-valuemax={side === "left" ? sidebar.max : 720} tabIndex={0}
    title="Drag to resize · double-click resets · arrow keys adjust · Home resets"
    onKeyDown={e => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); resize(side, (side === "left" ? leftWidth : l.rightWidth ?? 320) + (e.key === "ArrowRight" ? 16 : -16) * (side === "left" ? 1 : -1)); }
      else if (e.key === "Home") { e.preventDefault(); resetWidth(side); }
    }}
    onDoubleClick={() => resetWidth(side)}
    onPointerDown={e => { e.preventDefault(); stopGeometry(); e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.dataset.dragging = "true"; if(host.current)host.current.dataset.resizing=side; document.documentElement.style.cursor="col-resize"; document.documentElement.style.userSelect="none"; const current=Math.round(regionWidth(side)??0); setResizeFeedback({side,width:current}); e.currentTarget.setAttribute("aria-valuenow",String(current)); }}
    onPointerMove={e => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const box = host.current!.getBoundingClientRect();
      const value = clampWidth(side, side === "left" ? e.clientX - box.left : box.right - e.clientX);

      host.current?.style.setProperty(side === "left" ? "--desktop-left-width" : "--desktop-right-width", `${value}px`);
      host.current?.style.setProperty(side === "left" ? "--desktop-left-target" : "--desktop-right-target", `${value}px`);
      if(side==="right"&&!overlayRight)host.current?.style.setProperty("--desktop-right-space",`${value}px`);
      e.currentTarget.setAttribute("aria-valuenow", String(Math.round(value)));
      setResizeFeedback({side, width: Math.round(value)});
    }}
    onPointerUp={e => {
      const value = clampWidth(side, regionWidth(side) ?? 0);
      endDrag(e);
      resize(side, value);
    }}
    onLostPointerCapture={e=>{
      if(!e.currentTarget.dataset.dragging)return;
      const value = clampWidth(side, regionWidth(side) ?? 0);
      endDrag(e);
      resize(side, value);
    }}>{resizeFeedback?.side === side && <span className="region-resize-badge" role="status" aria-label={`${resizeFeedback.width} pixels wide`}>{resizeFeedback.width}</span>}</div>;
  const ref = p.subject.ref;
  const left = depth("left"), right = depth("right");
  const leftOpen=left==="panel"||left==="full";
  const rightOpen=right==="panel"||right==="full";
  const stopGeometry=useShellGeometry(host,[leftOpen?leftWidth:0,rightOpen?(right==="full"?Math.max(240,width-(leftOpen?leftWidth:0)):rightWidth):0,rightOpen&&!overlayRight?rightWidth:0]);
  useLayoutEffect(()=>{for(const side of ["left","right"] as const){const node=host.current?.querySelector<HTMLElement>(`[data-region="${side}"]`);if(node)node.inert=side==="left"?!leftOpen:!rightOpen;}},[leftOpen,rightOpen]);
  useEffect(() => {
    const centre=host.current?.querySelector<HTMLElement>('[data-region="centre"]');
    if (!centre) return;
    centre.inert=overlayLeft || right === "full" || (overlayRight && right === "panel");
    return () => { centre.inert=false; };
  }, [overlayLeft, overlayRight, right]);
  useEffect(() => {
    if (!overlayRight || right !== "panel") return;
    const prior=document.activeElement as HTMLElement;
    host.current?.querySelector<HTMLElement>('[data-region="right"] button')?.focus();
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();setDepth("right","collapsed");}};
    window.addEventListener("keydown",escape,true);
    return()=>{window.removeEventListener("keydown",escape,true);if(prior?.isConnected)prior.focus();};
  }, [overlayRight, right]);
  // Finding 25: an empty workspace has no groups at all — "0 groups" reads
  // as a broken counter, not a state. Name it, matching the reference
  // vocabulary's "1 group" / "Focused view" register.
  const groupCount = groupsOf(l.root).length;
  return <div ref={host} className="desktop-shell" data-native={p.native} data-window-lights={p.windowLights ? "true" : undefined} data-mode={p.mode} data-workspace-id={p.workspace.id} style={{"--desktop-left-target":`${leftWidth}px`,"--desktop-right-target":`${rightWidth}px`} as React.CSSProperties}>
    <header className="shell-topbar" aria-label="Window and focused pane" data-tauri-drag-region>
      <button className="shell-region-toggle oi-tool" aria-label="Toggle left region" aria-expanded={left === "panel" || left === "full"} onClick={summonNavigator} title="Show / hide Central (⌘B)"><Glyph name="sidebar"/></button>
      {/* L2: with the left collapsed, the scope's name moves into the topbar. */}
      {!(left === "panel" || left === "full") && <span className="shell-scope-name" data-shell-scope="true" title={`Scope: ${scopeLabel(scope)}`}>{scopeLabel(scope)}{lens.on && <span className="shell-scope-lens"> · Epi-Logos</span>}</span>}
      <div className="shell-focus" data-tauri-drag-region>{width < 640 && groupCount > 1 ? <select aria-label="Focused pane" value={l.focusedGroupId ?? ""} onChange={event => { const id=event.target.value; p.setLayout(state => focusGroup(state,id)); }}>{groupsOf(l.root).map((group,index) => <option key={group.id} value={group.id}>{index+1}/{groupCount} · {group.active ? l.surfaces[group.active]?.title : "Empty pane"}</option>)}</select> : null}</div>
      {/* Status → Preview: while the panel is collapsed the frame carries the
        * agent's observed state as a dot and a state line; opening it is the
        * one action, so the chip IS the way to the pinned panel. */}
      {!rightOpen && p.agentPresence && <button type="button" className="shell-agent-presence" data-presence-state={p.agentPresence.state} aria-label={`Accompanying agent: ${p.agentPresence.label} — show the panel`} title={`Accompanying agent: ${p.agentPresence.label}`} onClick={() => toggle("right")}>
        <span className="shell-agent-presence-dot" aria-hidden="true">{p.agentPresence.state==="attention"?"!":""}</span><span className="shell-agent-presence-label">{p.agentPresence.label}</span>
      </button>}
      <button className="shell-region-toggle shell-agent-toggle oi-tool" aria-label="Toggle right region" aria-expanded={right === "panel" || right === "full"} onClick={() => toggle("right")} title="Show / hide accompanying agent (⌘⇧B)"><Glyph name="sidebar"/></button>
    </header>
    {naming && <form className="workspace-name" onSubmit={e => { e.preventDefault(); if (!name.trim()) return; if (naming === "create") p.create(name); else p.rename(name); setNaming(null); }}>
      <input aria-label="Workspace name" autoFocus value={name} onChange={e => setName(e.target.value)} />
      <button type="submit">{naming === "create" ? "Create workspace" : "Save name"}</button><button type="button" onClick={() => setNaming(null)}>Cancel</button>
    </form>}
    <div className="desktop-regions" data-right-full={right === "full"} data-left-full={left === "full"} data-boot={!booted}>
      {overlayLeft && <button className="region-scrim" aria-label="Close Central overlay" onClick={closeNavigator}/> }
      <aside className={`desktop-side left depth-${left}`} data-region="left" data-depth={left} data-overlay={overlayLeft} aria-hidden={!leftOpen} aria-label="World region">
        {<>
          <div className="desktop-side-content">
          {/* The left frame (10-SIDEBARS §3.1): a fixed head and foot around
            * the mode's body — one frame in every mode. */}
          <LeftFrame mode={p.mode} onMode={p.onMode} workspace={p.workspace} workspaces={p.workspaces}
            onActivateWorkspace={p.activate}
            onNewWorkspace={() => { setName(""); setNaming("create"); }}
            onRenameWorkspace={() => { setName(p.workspace.name); setNaming("rename"); }}
            onRecoverArrangement={p.onRecover}
            host={{ onLibrary: p.onLibrary, ...p.left }}
            returnTo={p.returnTo} onReturn={p.onReturn}
            body={p.navigator(null)}/>
          </div>{left === "panel" && separator("left")}
        </>}
      </aside>
      <main className="desktop-centre" data-region="centre" aria-label="Workspace canvas">

      {/* The centre region renders as one stable sibling list owned by the
        * frame (CradleFrame): the per-mode stage slots, the rest host and
        * the warm trees. The shell adds no layer of its own here — the
        * former mode-centre park (surface/retention.tsx) is retired; every
        * centre mounts in place, in the stage slot or the pane that
        * presents it. */}
      {p.children}
      </main>
      <aside className={`desktop-side right depth-${right}`} data-region="right" data-depth={right} data-overlay={overlayRight && right === "panel"} data-focus-ref={ref} aria-hidden={!rightOpen} aria-label="Agent and inspector region">
        {<>
          {right === "panel" && separator("right")}
          <div className="desktop-side-content">
          {/* The right panel (10-SIDEBARS §4) owns its one top row and body
           * edge-to-edge; there is no legacy fallback body. */}
          {p.right}</div>
        </>}
      </aside>
    </div>
        <div className="workspace-footer-edge" data-pinned={footerPinned}><footer className="canvas-arrangement" aria-label="Workspace status">
          {/* The workspace itself (switch, new, rename, recover) lives in the
            * scope menu's footer (10-SIDEBARS §3.6 rule 5); this row keeps
            * the arrangement status. */}
          <small className="footer-workspace" title="The current workspace">{p.workspace.name}</small>
          <small className="arrangement-state">{l.maximizedGroupId ? "Focused view" : groupCount === 0 ? "Empty workspace" : `${groupCount} group${groupCount === 1 ? "" : "s"}`}</small>
          {/* The arrangement actions (Workbench.ArrangementActions — split,
            * tile, detach, maximize/restore, window actions): the frame
            * composes them and this row is their home — the pane tools defer
            * here ("maximize stays with the arrangement actions",
            * Workbench GroupPane), the keyboard paths (⌘D/⌘⇧D/⌘⌥T/⌘⌥Enter)
            * name themselves in the tooltips, and `.canvas-arrangement >
            * button` is this row's own styling for them. Declared-but-never-
            * rendered since the shell landed; rendered now, deliberately. */}
          {p.arrangementActions}
          <span className="canvas-arrangement-spacer"/>
          <details className="desktop-menu"><summary aria-label="Tab presentation"><Glyph name="more"/></summary><div className="oi-menu">
            {/* Modes live only in the left foot's strip (the duplicate mode
              * radios are removed, 10-SIDEBARS §3.1); the pane tab
              * presentation stays reachable here. */}
            <span className="oi-eyebrow">Tabs</span>
            {([["pinned-horizontal","Pin tabs horizontally"],["pinned-vertical","Pin tabs vertically"],["unpinned","Unpin tabs"]] as const).map(([id,label])=><button key={id} className="oi-menu-item" role="menuitemradio" aria-checked={(groupsOf(l.root).find(g=>g.id===l.focusedGroupId)?.tabPresentation??"pinned-horizontal")===id} onClick={()=>p.onTabPresentation(id)}>{label}</button>)}
          </div></details>
          {/* Owner ruling 2026-09-17: ALL workspace messaging — errors and
           * the recovery state alike — lives hidden here, in the status
           * disclosure at the row's right end. Nothing renders above the
           * app; a standing message only marks the arrow. */}
          <details className="desktop-menu footer-status" data-attention={!!p.error || !!p.recovery}>
            <summary aria-label={p.recovery ? `Workspace messages. Recovery standing: ${p.recovery.reason}` : p.error ? `Workspace messages. 1 standing: ${p.error}` : "Workspace messages"}><Glyph name="down" size={10}/></summary>
            <div className="oi-menu">
              {p.recovery && <>
                <p className="footer-status-message" role="alert">{p.recovery.reason}</p>
                <button className="oi-menu-item" disabled={!p.recovery.key} onClick={p.onRecoverAvailable}>Recover available workspaces</button>
                <button className="oi-menu-item" onClick={p.onStartFresh}>Start a fresh arrangement</button>
              </>}
              {p.error
                ? <div className="footer-status-message" role="alert"><span>{p.error}</span><button className="footer-status-dismiss" aria-label="Dismiss message" onClick={p.onErrorDismiss}><Glyph name="close" size={10}/></button></div>
                : !p.recovery && <p className="footer-status-message" role="status">No workspace messages.</p>}
            </div>
          </details>
          <button className="footer-pin oi-tool" aria-label={footerPinned?"Unpin workspace footer":"Pin workspace footer"} aria-pressed={footerPinned} onClick={()=>{const next=!footerPinned;setFooterPinned(next);try{localStorage.setItem(FOOTER_KEY,next?"pinned":"revealed");}catch{}}}><Glyph name="pin"/></button>
          {/* A5: the Epi-Logos LENS toggle, minimal, at the end of the hidden
            * window footer. It re-roots the file trees on the corpus; it
            * opens nothing and changes neither the mode nor the scope. */}
          <button type="button" className="footer-epi oi-tool" aria-pressed={lens.on}
            aria-label="Epi-Logos lens" title={lens.on?"The Epi-Logos lens is on — turn it off":"Turn on the Epi-Logos lens: the file trees show the corpus"}
            onClick={()=>setLens(!lens.on)}><Glyph name="epi" size={12}/></button>
        </footer></div>
  </div>;
}

