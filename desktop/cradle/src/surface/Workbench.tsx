import {EncounterSurface} from "../encounter/EncounterSurface";
import {lazy,Suspense,type ReactNode} from "react";
import type {ExploreSurfaceProps} from "../explore/ExploreSurface";
/**
 * The Workbench (U0.3b) — the OS frame that exists ONLY while ≥1 surface is
 * open (law 12: austere rest governs what is on screen; at zero surfaces
 * the app returns exactly to the U0.3 rest shape).
 *
 * - The tab strip is Surface bindings (D16): one tab per open surface; focus
 *   follows the active binding.
 * - Splits render the pane tree; tabs drag between splits.
 * - The left agency column moves only through depth states (D17):
 *   collapsed / strip / panel / full — full is a true overlay (the canvas is
 *   masked dimensionally, never reflowed), and its content is honest
 *   absence: no encounters are fabricated before the agency vertical mounts.
 */

import { Glyph } from "../workspace/Glyph";import { Fragment, useEffect, useLayoutEffect, useState } from "react";
import { Loading } from "../shared/Loading";
import { useKernel } from "../kernel/KernelProvider";
import type { ListedSource } from "../kernel/types";
import { FileSurface } from "../files/FileSurface";
import { SourceSurface } from "./SourceSurface";
import { SourcesIndex } from "./SourcesIndex";
import { DraftSurface } from "../flow/DraftSurface";
import { FlowSurface } from "../flow/FlowSurface";
import { FreshSurface } from "../flow/FreshSurface";
import { contains, groupsOf, renderOrder } from "./engine";
// Expensive bodies load on first use, not at startup: the terminal (xterm),
// the browser attachment, Explore and its presentation renderers, the
// knowledge graph and its layout worker, the Factory contribution and the
// System composition. Each is its own chunk; the workbench frame stays light.
const ExploreSurface=lazy(()=>import("../explore/ExploreSurface").then((module)=>({default:module.ExploreSurface})));
const TerminalSurface=lazy(()=>import("../terminal/TerminalSurface").then((module)=>({default:module.TerminalSurface})));
const BrowserSurface=lazy(()=>import("../browser/BrowserSurface").then((module)=>({default:module.BrowserSurface})));
const KnowledgeSurface=lazy(()=>import("../knowledge/KnowledgeSurface").then((module)=>({default:module.KnowledgeSurface})));
// The mode centre surfaces (workspace/mode.ts) are ordinary bindings in this
// pane system; each loads with its mode, never at startup. A centre's body
// mounts DIRECTLY here, inside the pane's own retained wrapper (spec §7.1:
// the park-and-adopt path is retired — the presenting pane mounts the body
// in place, and a mode switch shelves this whole tree hidden instead of
// moving anything).
import {ModeCentreBody, isRetainedCentreKind} from "./retention";
const AgencySurface=lazy(()=>import("../agency/AgencySurface").then((module)=>({default:module.AgencySurface})));
const NaraSurface=lazy(()=>import("../nara/NaraSurface").then((module)=>({default:module.NaraSurface})));
import type { ActionArg, LayoutState, Pane, SurfaceId } from "./types";
import { TAB_LIST_WIDTH_MAX, TAB_LIST_WIDTH_MIN, MODE_CURATION } from "../workspace/mode";

export interface WorkbenchProps {
  workspaceName: string;
  onView:(id:string,view:NonNullable<import("./types").SurfaceBinding["view"]>)=>void;
  state: LayoutState;
  menuOpen: boolean;
  nativeWindows: boolean;
  execute: (ref: string, arg?: ActionArg) => void;
  openBindingMenu: (surfaceId: SurfaceId, x: number, y: number) => void;
  openFrameMenu: (x: number, y: number) => void;
  /** Open a real source surface from the index listing (U0.4). */
  openSource: (source: ListedSource) => void;
  openKnowledge: import("../knowledge/NodeDetails").OpenKnowledge;
  /** SF1: pin a projected subject as its own Surface / hand Explore a subject. */
  openPresentation?: ExploreSurfaceProps["onOpenPresentation"];
  openExplore?: ExploreSurfaceProps["onOpenExplore"];
  /** Factory's centre lists the project's conversations; opening one is the
   * frame's ordinary encounter open (CradleFrame.openEncounter). */
  openEncounter?: (row: import("../encounter/EncounterList").EncounterRow) => void | Promise<void>;
  /** The frame-built centre Chat (the shared AgentChat) — Factory's centre
   * mounts it; the frame owns the session observer and the choose pair. */
  factoryCentre?: ReactNode;
  /** The Factory centre's Desk/Tasks context (CradleFrame.factoryCentreProps):
   * the browsed project, the bound conversation, the one task-open path and
   * the message sink — carried verbatim into FactoryCentre wherever its
   * binding renders. */
  factoryTasks?: {
    project?: string;
    accompanying?: {ref: string; project: string; space: string};
    onOpenTask?: (row: import("../encounter/EncounterList").EncounterRow) => void | Promise<void>;
    onMessage?: (message: string) => void;
  };
  /** The workspace world-context subject (the person's selected subject,
   * the same one the panel planes receive): the frame passes it so a mode
   * centre surface — Technè's instrument disclosure — can request its
   * reading for the actual subject instead of standing on "no subject". */
  subject?: {ref?: string; kind?: string; title: string; project?: string};
}

export function Workbench(props: WorkbenchProps) {
  const { state, menuOpen } = props;
  const kernel = useKernel();
  if (!state.root) return null;

  // A pointer entering a rendered material iframe crosses the document
  // boundary before React can observe it. The browser focuses the owning
  // iframe element as the outer window blurs; resolve that element on the
  // next task and move only semantic pane focus. The iframe keeps DOM and
  // keyboard focus, and native browser child views retain their own event
  // path (`oi:browser-pane-focus`).
  useEffect(() => {
    let timer: number | undefined;
    const frameFocused = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const frame = document.activeElement;
        if (!(frame instanceof HTMLIFrameElement) || !frame.matches(".material-frame")) return;
        const groupId = frame.closest<HTMLElement>(".pane.group")?.dataset.groupId;
        if (groupId && groupId !== state.focusedGroupId) props.execute("surface.focus-group", { groupId });
      });
    };
    window.addEventListener("blur", frameFocused);
    return () => { window.removeEventListener("blur", frameFocused); window.clearTimeout(timer); };
  }, [props.execute, state.focusedGroupId]);

  // D16: focus follows the active binding — keep DOM focus on the active
  // tab of the focused group after keyboard/menu/layout operations. The
  // frame never steals the caret from a surface body (U0.4: editors own
  // their focus while the person is in them); it only re-anchors focus
  // that is loose on the page.
  useLayoutEffect(() => {
    if (menuOpen) return;
    const g = groupsOf(state.root).find((g) => g.id === state.focusedGroupId);
    if (g && !g.active && g.emptySlot) {
      // Claim an intentionally empty destination before mounted source
      // effects can restore the previous kernel subject's editor focus.
      document.querySelector<HTMLElement>(`[data-group-id="${g.id}"] .strip-open`)?.focus();
      return;
    }
    if (!g?.active) return;
    const el = document.querySelector<HTMLElement>(`[data-surface-id="${g.active}"]`);
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      // The scrolling tab list is isolated from `.pane-tools`, so bringing
      // the active binding into view never moves the pinned pane controls.
      (el.closest(".tab-entry") ?? el).scrollIntoView({ block: "nearest", inline: "nearest" });
      const active = document.activeElement as HTMLElement | null;
      const activePane = active?.closest<HTMLElement>(".pane.group");
      // Structural frame operations may remount the old editor. Its caret
      // must not remain in a different pane from the semantic active binding.
      // Navigation, menus and other external controls retain their own focus.
      if (active?.matches('[role="tab"]') && activePane?.dataset.groupId === g.id) {
        el.focus();
        return;
      }
      if (active && active !== document.body && active.isConnected && (!activePane || activePane.dataset.groupId === g.id)) return;
      const editor = el.closest(".pane.group")?.querySelector<HTMLElement>(".cm-content");
      (editor ?? el).focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [state.focusedGroupId, groupsOf(state.root).find(g => g.id === state.focusedGroupId)?.active, state.surfaces[groupsOf(state.root).find(g => g.id === state.focusedGroupId)?.active ?? ""]?.title, state.maximizedGroupId, menuOpen]);

  return (
    <div className="workbench">
      <main className="surface-host" aria-label="Canvas">
        <PaneNode pane={state.root} {...props} kernelDirty={(ref) => !!ref && !!kernel.snapshot.buffers[ref]?.dirty} />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PaneProps extends WorkbenchProps {
  pane: Pane;
  /** Whether the source surface's buffer is dirty (kernel two-layer state). */
  kernelDirty: (ref: string | undefined) => boolean;
  weight?: number;
}

function PaneNode(props: PaneProps) {
  const { pane } = props;
  if (pane.type === "split")
    return (
      <div className="pane split" data-pane="split" data-pane-dir={pane.dir} style={{ flexGrow: props.weight ?? 1, display: props.state.maximizedGroupId && !contains(pane, props.state.maximizedGroupId) ? "none" : undefined }}>
        {pane.children.map((child, index) => <Fragment key={child.id}>
          <PaneNode {...props} pane={child} weight={pane.weights?.[index] ?? 1} />
          {!props.state.maximizedGroupId && index < pane.children.length - 1 && <div className="split-resizer" role="separator" aria-label="Resize canvas split" aria-orientation={pane.dir === "h" ? "vertical" : "horizontal"} tabIndex={0}
            aria-valuemin={15} aria-valuemax={85}
            aria-valuenow={Math.round(100 * (pane.weights?.[index] ?? 1) / ((pane.weights?.[index] ?? 1) + (pane.weights?.[index + 1] ?? 1)))}
            title="Drag to resize; arrow keys adjust; double-click or Enter balances panes"
            onDoubleClick={() => {
              const weights = pane.children.map((_, i) => pane.weights?.[i] ?? 1);
              weights[index] = weights[index + 1] = (weights[index] + weights[index + 1]) / 2;
              props.execute("surface.resize-split", { splitId: pane.id, weights });
            }}
            onPointerDown={e => { e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={e => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const box = e.currentTarget.parentElement!.getBoundingClientRect();
              const length = pane.dir === "h" ? box.width : box.height;
              const position = pane.dir === "h" ? e.clientX - box.left : e.clientY - box.top;
              const weights = pane.children.map((_, i) => pane.weights?.[i] ?? 1);
              const total = weights.reduce((a,b) => a+b,0), before = weights.slice(0,index).reduce((a,b) => a+b,0);
              const pair = weights[index]+weights[index+1];
              weights[index] = Math.max(pair*0.15, Math.min(pair*0.85, position/length*total-before));
              weights[index+1] = pair-weights[index];
              props.execute("surface.resize-split", { splitId: pane.id, weights });
            }}
            onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
            onKeyDown={e => {
              const arrows = pane.dir === "h" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
              if (![...arrows, "Home", "End", "Enter"].includes(e.key) || e.altKey || e.metaKey || e.ctrlKey) return;
              e.preventDefault(); e.stopPropagation();
              const weights = pane.children.map((_, i) => pane.weights?.[i] ?? 1);
              const pair = weights[index]+weights[index+1];
              const desired = e.key === "Home" ? pair * .15 : e.key === "End" ? pair * .85 : e.key === "Enter" ? pair / 2 : weights[index] + pair * (e.shiftKey ? .1 : .05) * (e.key === arrows[1] ? 1 : -1);
              weights[index] = Math.max(pair*.15, Math.min(pair*.85, desired)); weights[index+1]=pair-weights[index];
              props.execute("surface.resize-split", { splitId: pane.id, weights });
            }} />}
        </Fragment>)}
      </div>
    );
  return <GroupPane {...props} group={pane} />;
}

export function GroupPane(props: PaneProps & { group: Extract<Pane, { type: "group" }> }) {
  const { group, state, execute, openBindingMenu, openFrameMenu } = props;
  const focused = state.focusedGroupId === group.id;
  // The pane's footer follows focus by default (unfocused up; on focus it
  // drops). The corner dot pins THIS pane's footer up, overriding focus,
  // until released.
  const [footerUp, setFooterUp] = useState(false);
  const tabs = renderOrder(group);
  const active = group.active ?? group.tabs[0];
  // The pin model (workspace/mode.ts): pinned horizontal, pinned vertical, or
  // unpinned. An unpinned pane folds its tabs to a slim reveal edge and keeps
  // the geometry it was last pinned in (tabPinOrientation) — that geometry is
  // also what pins record when set. ONE control in the pane tools walks the
  // pin states; ⌘⌥\ cycles the same way (frame.tabs-cycle).
  const tabPresentation = group.tabPresentation ?? "pinned-horizontal";
  const pinOrientation = group.tabPinOrientation ?? "horizontal";
  const unpinned = tabPresentation === "unpinned";
  const verticalTabs = tabPresentation === "pinned-vertical" || (unpinned && pinOrientation === "vertical");
  const presentationTitle = {unpinned: "unpinned — tabs hide until you reveal them", "pinned-horizontal": "pinned horizontally", "pinned-vertical": "pinned vertically"} as const;
  const tabListWidth = state.tabListWidth;

  return (
    <section
      className={`pane group${focused ? " focused" : ""}`}
      data-pane="group"
      data-group-id={group.id}
      data-window-corner={groupsOf(state.root).filter(g=>!state.maximizedGroupId||g.id===state.maximizedGroupId)[0]?.id===group.id}
      data-focused={focused}
      data-tab-focus={!!active&&state.focusedTabId===active}
      data-tab-presentation={tabPresentation}
      data-tab-orientation={unpinned ? pinOrientation : undefined}
      data-maximized={state.maximizedGroupId === group.id}
      data-footer-up={footerUp || undefined}
      aria-label="Surface group"
      style={{
        flexGrow: props.weight ?? 1,
        display: state.maximizedGroupId && state.maximizedGroupId !== group.id ? "none" : undefined,
        ...(verticalTabs && tabListWidth !== undefined ? {"--tab-list-width": `${tabListWidth}px`} : {}),
      } as import("react").CSSProperties}
      onFocusCapture={() => {
        if (!focused) execute("surface.focus-group", { groupId: group.id });
      }}
      onPointerDownCapture={() => {
        if (!focused) execute("surface.focus-group", { groupId: group.id });
      }}
    >
      {/* ONE hiding law: an unpinned pane folds its tabs to a slim reveal edge
        * that opens in flow on hover or focus-within — the workspace footer's
        * reveal grammar (cradle.css). The old data-tab-focus fold is gone; the
        * attribute only marks the frame's tab focus and hides nothing. The
        * reveal zone is generous exactly where the tab icons live: the full
        * top edge with extra depth over the pane tools (horizontal), the
        * bottom of the strip region (vertical). */}
      {unpinned && <div className="tab-reveal-zone" aria-hidden="true" data-orientation={pinOrientation} />}
      <div
        className="tab-strip"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest(".tab")) return;
          e.preventDefault();
          openFrameMenu(e.clientX, e.clientY);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("drop");
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove("drop")}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("drop");
          const id = e.dataTransfer.getData("text/plain");
          if (id) execute("surface.drop", { surfaceId: id, groupId: group.id });
        }}
      >
        <div className="tab-scroll" role="tablist" aria-label="Open surfaces" aria-orientation={verticalTabs?"vertical":"horizontal"}>
        {tabs.map((id) => (
          <Tab
            key={id}
            id={id}
            title={state.surfaces[id].title}
            kind={state.surfaces[id].kind}
            active={active === id}
            pinned={group.pinned.includes(id)}
            dirty={props.kernelDirty(state.surfaces[id].ref)}
            groupId={group.id}
            vertical={verticalTabs}
            execute={execute}
            openBindingMenu={openBindingMenu}
          />
        ))}
        </div>
        <div className="pane-tools">
          {group.emptySlot && <button type="button" className="pane-tool-menu" aria-label="Close empty pane" title="Close empty pane (⌘W)" onClick={() => execute("surface.close-empty-pane", { groupId: group.id })}><Glyph name="close" size={13} /></button>}
          {/* Owner ruling 2026-09-17: the pin only pins or unpins the current
           * orientation; orientation is the neighbouring control's job. The
           * pane size toggle left the strip — panes present at their larger
           * size, and maximize stays with the arrangement actions (⌘⌥Enter). */}
          <button type="button" className="pane-tool-menu pane-tool-orient"
            aria-label={verticalTabs ? "Show tabs horizontally" : "Show tabs vertically"}
            title={verticalTabs ? "Tabs are vertical — show horizontally" : "Tabs are horizontal — show vertically"}
            onClick={() => execute("frame.tabs-orient", { groupId: group.id })}>
            <Glyph name={verticalTabs ? "rows" : "columns"} size={13} />
          </button>
          <button type="button" className="pane-tool-menu pane-tool-pin"
            aria-label={unpinned ? "Pin tabs" : "Unpin tabs"}
            title={`Tabs are ${presentationTitle[tabPresentation]} — ${unpinned ? "Pin tabs" : "Unpin tabs"} (⌘⌥\\)`}
            data-pin-target={unpinned ? `pinned-${pinOrientation}` : "unpinned"}
            data-tab-presentation={tabPresentation}
            onClick={() => execute("frame.tabs-pin", { groupId: group.id })}>
            <Glyph name="pin" size={13} />
          </button>
          <button
            type="button"
            className="strip-open"
            aria-label="New tab"
            title="New tab (⌘T)"
            onClick={() => {
              execute("surface.focus-group", { groupId: group.id });
              window.dispatchEvent(new CustomEvent("oi:new-tab", { detail: { groupId: group.id } }));
            }}
          >
            <Glyph name="plus" size={13} />
          </button>
          <button
            type="button"
            className="pane-tool-menu"
            aria-label="Window menu"
            title="Window menu"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              if (active) openBindingMenu(active, r.left, r.bottom + 2);
              else openFrameMenu(r.left, r.bottom + 2);
            }}
          >
            <Glyph name="more" size={13} />
          </button>
        </div>
      </div>
      {/* The pinned-vertical list's width: a separator on the strip's inner
        * edge, drag or arrow-key resizable (the .region-resizer grammar),
        * persisted as LayoutState.tabListWidth through frame.tabs-width. */}
      {tabPresentation === "pinned-vertical" && (
        <div
          className="tab-list-resizer"
          role="separator"
          aria-label="Tab list width"
          aria-orientation="vertical"
          tabIndex={0}
          aria-valuemin={TAB_LIST_WIDTH_MIN}
          aria-valuemax={TAB_LIST_WIDTH_MAX}
          aria-valuenow={tabListWidth}
          title="Drag to resize the tab list; arrow keys adjust; Home/End to the bounds"
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const left = e.currentTarget.parentElement!.getBoundingClientRect().left;
            execute("frame.tabs-width", { n: Math.round(e.clientX - left) });
          }}
          onPointerUp={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
          onKeyDown={(e) => {
            if (e.altKey || e.metaKey || e.ctrlKey) return;
            const width = Math.round(e.currentTarget.parentElement?.querySelector<HTMLElement>(".tab-strip")?.getBoundingClientRect().width ?? 208);
            const step = e.shiftKey ? 32 : 16;
            if (e.key === "ArrowLeft") { e.preventDefault(); execute("frame.tabs-width", { n: width - step }); }
            else if (e.key === "ArrowRight") { e.preventDefault(); execute("frame.tabs-width", { n: width + step }); }
            else if (e.key === "Home") { e.preventDefault(); execute("frame.tabs-width", { n: TAB_LIST_WIDTH_MIN }); }
            else if (e.key === "End") { e.preventDefault(); execute("frame.tabs-width", { n: TAB_LIST_WIDTH_MAX }); }
          }}
        />
      )}
      {/* The three-tier retention law, pane tier (owner-approved 2026-09-19):
        * every OPEN tab's body stays mounted — the active one presented, the
        * others concealed-retained (hidden + display:none, the same law the
        * agent panel's kept planes use), so returning to a tab restores its
        * scroll, selection, draft and engine without a re-read. Concealment
        * is honest suspension: display:none means the surface's own viewport
        * laws (MaterialSurface's useSuspend, the engines' visibility gates)
        * observe an off-screen surface and pause. Cheap list kinds release
        * instead (CONCEAL_RELEASES) — they rebuild from the kernel's own
        * reading at no cost. Explicit close releases every kind: the tab
        * leaves the group and the body unmounts with it. */}
      <div
        className="surface-body"
        data-binding-id={active}
        role="tabpanel"
        id={`surface-panel-${group.id}`}
        aria-labelledby={active ? `surface-tab-${active}` : undefined}
        onDragOver={e => {
          if (e.dataTransfer.types.includes("application/x-oi-surface")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
        }}
        onDrop={e => {
          const id = e.dataTransfer.getData("application/x-oi-surface");
          if (!id) return;
          e.preventDefault(); e.stopPropagation();
          execute("surface.drop", { surfaceId: id, groupId: group.id });
        }}

      >
        {tabs.length ? tabs.map(id => {
          const binding = state.surfaces[id];
          if (!binding) return null;
          const concealed = id !== active;
          if (concealed && CONCEAL_RELEASES.has(binding.kind)) return null;
          return <div key={id} className="surface-retained" data-surface-kind={binding.kind} hidden={concealed}>
            <SurfaceBody binding={binding} treeMode={state.mode ?? "base"} onView={props.onView} openSource={props.openSource} openKnowledge={props.openKnowledge} openPresentation={props.openPresentation} openExplore={props.openExplore} factoryCentre={props.factoryCentre} factoryTasks={props.factoryTasks} subject={props.subject} />
          </div>;
        }) : <p className="source-note">{state.detached?.some(d=>d.groupId===group.id)?"This view is open in a native window. Close that window to re-dock it here.":"Move a tab here, or open a source or wiki with +."}</p>}
      </div>
      <button type="button" className="pane-footer-dot" data-pane-footer-dot
        aria-pressed={footerUp}
        aria-label={footerUp ? "Release this pane's footer — it follows focus again" : "Keep this pane's footer up"}
        title={footerUp ? "Release the footer — it follows focus again" : "Keep this pane's footer up"}
        onClick={() => setFooterUp(v => !v)}
      />
      <footer className="pane-status pane-footer" aria-label={focused ? "Active pane" : "Pane status"} />
    </section>
  );
}

/** The pane tier's per-kind release set (the three-tier retention law):
 * surface kinds whose body is a cheap list over kernel-owned readings — a
 * rebuilt body costs one already-cached read and holds no engine, editor
 * session or draft — release on conceal instead of retaining. Every other
 * kind retains concealed; every kind releases on explicit close. */
const CONCEAL_RELEASES = new Set(["sources", "blank"]);

/** The surface body by kind: real owner surfaces where they exist (U0.4:
 * 'source', 'sources'), the clearly-named test card otherwise. */
export function SurfaceBody(props: Parameters<typeof SurfaceBodyImpl>[0]) {
  const label = props.binding.pending ? `Opening ${props.binding.title}…` : props.binding.title;
  return <Suspense fallback={<Loading label={`Loading ${label}`} scope="surface"/>}><SurfaceBodyImpl {...props}/></Suspense>;
}
function SurfaceBodyImpl({
  binding,onView,
  openSource, openKnowledge, openPresentation, openExplore,
  factoryCentre, factoryTasks, subject, treeMode,
}: {
  binding: import("./types").SurfaceBinding;
  onView:WorkbenchProps["onView"];
  openKnowledge: WorkbenchProps["openKnowledge"];
  openSource: (source: ListedSource) => void;
  openPresentation?: WorkbenchProps["openPresentation"];
  openExplore?: WorkbenchProps["openExplore"];
  factoryCentre?: WorkbenchProps["factoryCentre"];
  factoryTasks?: WorkbenchProps["factoryTasks"];
  /** The workspace world-context subject — the person's selected subject,
   * shared with the panel planes. The retained centre bodies (surface/
   * retention.tsx) read it from the workspace context themselves; the
   * prop stays on the seam for the frame's composition. */
  subject?: WorkbenchProps["subject"];
  /** The mode of the tree this pane belongs to (the layout's own mode).
   * It decides centre ownership: a centre binding whose kind is this tree
   * mode's own centre kind is STAGE-OWNED — its mode's stage slot presents
   * it, and this pane presents nothing, exactly like the retired outlet
   * did. Any other centre kind here is pane-tab-presented and mounts its
   * body right here (spec §7.1). */
  treeMode: import("../workspace/mode").WorkspaceMode;
}) {
  if (binding.pending) return <Loading label={`Opening ${binding.title}…`} scope="surface"/>;
  // Retained centre kinds (expressions/techne/epi-logos/system/factory —
  // surface/retention.tsx) mount their ONE body directly, in place, inside
  // this pane's own `.surface-retained` wrapper — mounted-concealed by the
  // pane tier like every other retained tab, never adopted, never moved
  // (spec §7.1) — but only when this tree is a FOREIGN host for them. The
  // single-mount law: a stage-owned centre is presented ONLY by its stage
  // slot; a foreign-tree centre ONLY by its pane wrapper. Factory's body
  // composes the frame-built chat node — the frame passes
  // CradleFrame.factoryCentre down, so there is no second direct arm here.
  if (isRetainedCentreKind(binding.kind)) {
    if (binding.kind === MODE_CURATION[treeMode].centreKind) return null;
    return <ModeCentreBody binding={binding} subject={subject} factoryCentre={factoryCentre} factoryTasks={factoryTasks}/>;
  }
  if(binding.kind==="explore"||binding.kind==="presentation")return <ExploreSurface key={binding.id} binding={binding} onOpenPresentation={openPresentation} onOpenExplore={openExplore}/>;
  if(binding.kind==="encounter")return <EncounterSurface key={binding.id} binding={binding} onView={view=>onView(binding.id,view)}/>;
  if (binding.kind === "terminal") return <TerminalSurface binding={binding} />;
  if (binding.kind === "flow") return <FlowSurface binding={binding} />;
  if (binding.kind === "draft") return <DraftSurface binding={binding} />;
  if (binding.kind === "blank") return <FreshSurface binding={binding} />;
  if (binding.kind === "browser") return <BrowserSurface binding={binding} />;
  if (binding.kind === "file") return <FileSurface key={binding.id} binding={binding}/>;
  // The Expressions centre IS the application (owner ruling 2026-09-19):
  // the Point-Cloud-Demo workspace hosted as-is, full-screen, its own UI and
  // Library — served through the owner's oi-material:// file seam under
  // Tauri (the walk bridge mirrors it under probes). The in-shell
  // Expressions surface is retired from the centre; the centre kinds
  // themselves present through the retention outlet dispatched above.
  if (binding.kind === "agency") return <AgencySurface project={binding.project} onMessage={message=>window.dispatchEvent(new CustomEvent("oi:workspace-message",{detail:{message}}))} onOpenSettings={()=>window.dispatchEvent(new CustomEvent("oi:open-settings"))} />;
  if (binding.kind === "knowledge") return <KnowledgeSurface binding={binding} onOpen={openKnowledge} />;
  if (binding.kind === "nara") return <NaraSurface key={binding.id} binding={binding} />;
  if (binding.kind === "source") {
    return <SourceSurface binding={binding} />;
  }
  if (binding.kind === "sources") {
    return <SourcesIndex binding={binding} onOpenSource={openSource} />;
  }
  // The instrument binding has no body renderer of its own: the privileged
  // Epi/Nara composition portals into this body and owns it completely.
  if (binding.kind === "instrument") return null;
  return <p className="source-note">This surface is unavailable.</p>;
}

interface TabProps {
  id: SurfaceId;
  title: string;
  /** The binding kind (U0.4) — chooses the tab's kind glyph. */
  kind: string;
  active: boolean;
  pinned: boolean;
  /** The two-layer dirty state shows on the binding itself (U0.4). */
  dirty: boolean;
  groupId: string;
  /** The vertical-list presentation: ↑/↓ walk the list as ←/→ walk the strip. */
  vertical?: boolean;
  execute: (ref: string, arg?: ActionArg) => void;
  openBindingMenu: (surfaceId: SurfaceId, x: number, y: number) => void;
}

/** Tab kind → the study's kind glyph (brief FND-01: encounter chat, knowledge
 * wiki, file/source/sources file, system settings). Unknown kinds fall back
 * to 'file' rather than rendering nothing. */
const KIND_GLYPH: Record<string, import("../workspace/Glyph").GlyphName> = {
  encounter: "chat",
  knowledge: "wiki",
  file: "file",
  source: "file",
  sources: "file",
  system: "settings",
  explore: "search",
  presentation: "field",
  terminal: "terminal",
  factory: "factory",
  expressions: "field",
  techne: "instrument",
  "epi-logos": "wiki",
  agency: "agent",
  instrument: "instrument",
  nara: "chat",
};

function Tab({ id, title, kind, active, pinned, dirty, groupId, vertical, execute, openBindingMenu }: TabProps) {
  return (
    <div className="tab-entry" role="presentation">
    <button
      type="button"
      role="tab"
      id={`surface-tab-${id}`}
      aria-controls={`surface-panel-${groupId}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={`tab${active ? " active" : ""}`}
      draggable
      data-surface-id={id}
      data-title={title}
      data-active={active}
      data-pinned={pinned}
      data-dirty={dirty}
      title={`${title}${pinned ? " (pinned)" : ""}`}
      onClick={() => execute("surface.activate", { surfaceId: id })}
      onAuxClick={(e) => {
        if (e.button === 1) execute("surface.close", { surfaceId: id });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openBindingMenu(id, e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          openBindingMenu(id, r.left, r.bottom + 2);
        }
        // Plain arrows switch tabs within the strip; modified arrows belong
        // to the frame keymap (⌥ arrows move focus, ⌘⌥ arrows move the
        // surface) and must not race it.
        if (e.altKey || e.metaKey || e.ctrlKey) return;
        if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          const siblings = e.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]');
          const target = siblings?.[e.key === "Home" ? 0 : siblings.length - 1]?.dataset.surfaceId;
          if (target) execute("surface.activate", { surfaceId: target });
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          execute("surface.close", { surfaceId: id });
        } else if (e.key === (vertical ? "ArrowUp" : "ArrowLeft")) {
          e.preventDefault();
          execute("surface.tab-prev");
        } else if (e.key === (vertical ? "ArrowDown" : "ArrowRight")) {
          e.preventDefault();
          execute("surface.tab-next");
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.setData("application/x-oi-surface", id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add("drop-before");
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove("drop-before");
        const src = e.dataTransfer.getData("text/plain");
        if (src)
          execute("surface.drop", {
            surfaceId: src,
            groupId,
            beforeId: id,
          });
      }}
    >
      <Glyph name={KIND_GLYPH[kind] ?? "file"} size={12} />
      <span className="tab-title">{title}</span>
      {dirty ? (
        <span className="tab-dirty" aria-hidden="true" title="Unsaved buffer">
          ●
        </span>
      ) : null}
      {pinned ? (
        <span className="tab-pin" aria-hidden="true" title="Pinned">
          ◈
        </span>
      ) : null}
    </button>
      <button
        type="button"
        className="tab-close"
        aria-label={`Close ${title}`}
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={pinned}
        title={pinned ? "Unpin before closing" : `Close ${title}`}
        onClick={(e) => { e.stopPropagation(); execute("surface.close", { surfaceId: id }); }}
      >
        <Glyph name="close" size={11} />
      </button>
    </div>
  );
}

export function ArrangementActions({state, execute, openFrameMenu, nativeWindows}: Pick<WorkbenchProps, "state" | "execute" | "openFrameMenu" | "nativeWindows">) {
  const props = {state, execute, openFrameMenu, nativeWindows};
  const group = groupsOf(state.root).find(g => g.id === state.focusedGroupId);
  const active = group?.active ? state.surfaces[group.active] : undefined;
  const detachable = !!active && ["source", "knowledge", "file", "encounter", "explore", "presentation"].includes(active.kind);
  return <>
        <button aria-label="Split active surface right" title="Split right (⌘D)" disabled={!active} onClick={() => props.execute("surface.split-right")}><Glyph name="columns"/></button>
        <button aria-label="Split active surface down" title="Split down (⌘⇧D)" disabled={!active} onClick={() => props.execute("surface.split-down")}><Glyph name="rows"/></button>
        <button aria-label="Tile all surfaces" title="Tile all surfaces" disabled={groupsOf(state.root).flatMap(g => g.tabs).length < 2} onClick={() => props.execute("surface.tile")}><Glyph name="grid"/></button>
        {props.nativeWindows && <button aria-label="Detach active surface" disabled={!detachable} title="Detach into native window" onClick={()=>props.execute("surface.detach")}><Glyph name="detach"/></button>}
        <button aria-label={state.maximizedGroupId ? "Restore panes" : "Maximize active pane"} title="Maximize / restore (⌘⌥Enter)" disabled={!active} onClick={() => props.execute("surface.maximize")}><Glyph name={state.maximizedGroupId ? "restore" : "expand"}/></button>
        <button aria-label="Window actions" title="Window actions" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); props.openFrameMenu(r.left, r.bottom); }}><Glyph name="more"/></button>
  </>;
}
