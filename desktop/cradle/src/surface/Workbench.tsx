import {EncounterSurface} from "../encounter/EncounterSurface";
import {SystemPanel} from "../workspace/SystemPanel";
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

import { Glyph } from "../workspace/Glyph";
import { Fragment, useEffect } from "react";
import { useKernel } from "../kernel/KernelProvider";
import type { ListedSource } from "../kernel/types";
import { KnowledgeSurface } from "../knowledge/KnowledgeSurface";
import type { KnowledgeAddress } from "../kernel/types";
import { FileSurface } from "../files/FileSurface";
import { SourceSurface } from "./SourceSurface";
import { SourcesIndex } from "./SourcesIndex";
import { contains, groupsOf, renderOrder } from "./engine";
import type { ActionArg, LayoutState, Pane, SurfaceId } from "./types";

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
  openKnowledge: (address: KnowledgeAddress, title: string, project?: string) => Promise<void>;
}

export function Workbench(props: WorkbenchProps) {
  const { state, menuOpen } = props;
  const kernel = useKernel();
  if (!state.root) return null;

  // D16: focus follows the active binding — keep DOM focus on the active
  // tab of the focused group after keyboard/menu/layout operations. The
  // frame never steals the caret from a surface body (U0.4: editors own
  // their focus while the person is in them); it only re-anchors focus
  // that is loose on the page.
  useEffect(() => {
    if (menuOpen) return;
    const g = groupsOf(state.root).find((g) => g.id === state.focusedGroupId);
    if (!g?.active) return;
    const el = document.querySelector<HTMLElement>(`[data-surface-id="${g.active}"]`);
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement as HTMLElement | null;
      const activePane = active?.closest<HTMLElement>(".pane.group");
      // Structural frame operations may remount the old editor. Its caret
      // must not remain in a different pane from the semantic active binding.
      // Navigation, menus and other external controls retain their own focus.
      if (active && active !== document.body && active.isConnected && (!activePane || activePane.dataset.groupId === g.id)) return;
      const editor = el.closest(".pane.group")?.querySelector<HTMLElement>(".source-textarea");
      (editor ?? el).focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [state.focusedGroupId, groupsOf(state.root).find(g => g.id === state.focusedGroupId)?.active, menuOpen]);

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
            onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
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
            onPointerUp={e => e.currentTarget.releasePointerCapture(e.pointerId)}
            onKeyDown={e => {
              if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) return;
              e.preventDefault(); const weights = pane.children.map((_,i) => pane.weights?.[i] ?? 1); const pair = weights[index]+weights[index+1];
              weights[index] = Math.max(pair*0.15,Math.min(pair*0.85,weights[index]+pair*(["ArrowRight","ArrowDown"].includes(e.key)?0.05:-0.05))); weights[index+1]=pair-weights[index];
              props.execute("surface.resize-split", { splitId: pane.id, weights });
            }} />}
        </Fragment>)}
      </div>
    );
  return <GroupPane {...props} group={pane} />;
}

function GroupPane(props: PaneProps & { group: Extract<Pane, { type: "group" }> }) {
  const { group, state, execute, openBindingMenu, openFrameMenu } = props;
  const focused = state.focusedGroupId === group.id;
  const tabs = renderOrder(group);
  const active = group.active ?? group.tabs[0];
  const activeBinding = active ? state.surfaces[active] : undefined;

  return (
    <section
      className={`pane group${focused ? " focused" : ""}`}
      data-pane="group"
      data-group-id={group.id}
      data-focused={focused}
      aria-label="Surface group"
      style={{ flexGrow: props.weight ?? 1, display: state.maximizedGroupId && state.maximizedGroupId !== group.id ? "none" : undefined }}
      onPointerDown={() => {
        if (!focused) execute("surface.focus-group", { groupId: group.id });
      }}
    >
      <div
        className="tab-strip"
        role="tablist"
        aria-label="Open surfaces"
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
            execute={execute}
            openBindingMenu={openBindingMenu}
          />
        ))}
        <div className="pane-tools">
          <button
            type="button"
            className="strip-open"
            aria-label="Open source"
            title="Open source (⌘T)"
            onClick={() => execute("surface.open")}
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
      <div
        className="surface-body"
        role="tabpanel"
        onContextMenu={(e) => {
          if (!active) return;
          e.preventDefault();
          openBindingMenu(active, e.clientX, e.clientY);
        }}
      >
        {activeBinding ? <SurfaceBody key={activeBinding.id} binding={activeBinding} onView={props.onView} openSource={props.openSource} openKnowledge={props.openKnowledge} /> : <p className="source-note">{state.detached?.some(d=>d.groupId===group.id)?"This view is open in a native window. Close that window to re-dock it here.":"Open a source or wiki in this pane."}</p>}
      </div>
    </section>
  );
}

/** The surface body by kind: real owner surfaces where they exist (U0.4:
 * 'source', 'sources'), the clearly-named test card otherwise. */
function SurfaceBody({
  binding,onView,
  openSource, openKnowledge,
}: {
  binding: import("./types").SurfaceBinding;
  onView:WorkbenchProps["onView"];
  openKnowledge: WorkbenchProps["openKnowledge"];
  openSource: (source: ListedSource) => void;
}) {
  if(binding.kind==="encounter")return <EncounterSurface key={binding.id} binding={binding} onView={view=>onView(binding.id,view)}/>;
  if (binding.kind === "file") return <FileSurface key={binding.id} binding={binding}/>;
  if (binding.kind === "system") return <SystemPanel binding={binding}/>;
  if (binding.kind === "knowledge") return <KnowledgeSurface binding={binding} onOpen={openKnowledge} />;
  if (binding.kind === "source") {
    return <SourceSurface binding={binding} />;
  }
  if (binding.kind === "sources") {
    return <SourcesIndex binding={binding} onOpenSource={openSource} />;
  }
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
  execute: (ref: string, arg?: ActionArg) => void;
  openBindingMenu: (surfaceId: SurfaceId, x: number, y: number) => void;
}

/** Tab kind → the study's kind glyph (brief FND-01: encounter chat, knowledge
 * wiki, file/source/sources file, system settings). Unknown kinds fall back
 * to 'file' rather than rendering nothing. */
const KIND_GLYPH: Record<string, "chat" | "wiki" | "file" | "settings"> = {
  encounter: "chat",
  knowledge: "wiki",
  file: "file",
  source: "file",
  sources: "file",
  system: "settings",
};

function Tab({ id, title, kind, active, pinned, dirty, groupId, execute, openBindingMenu }: TabProps) {
  return (
    <div
      role="tab"
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
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          execute("surface.tab-prev");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          execute("surface.tab-next");
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", id);
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
      <button
        type="button"
        className="tab-close"
        aria-label={`Close ${title}`}
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => execute("surface.close", { surfaceId: id })}
      >
        <Glyph name="close" size={11} />
      </button>
    </div>
  );
}

export function ArrangementActions({state, execute, openFrameMenu, nativeWindows}: Pick<WorkbenchProps, "state" | "execute" | "openFrameMenu" | "nativeWindows">) {
  const props = {state, execute, openFrameMenu, nativeWindows};
  return <>
        <button aria-label="Split active surface right" title="Split right (⌘D)" onClick={() => props.execute("surface.split-right")}><Glyph name="columns"/></button>
        <button aria-label="Split active surface down" title="Split down (⌘⇧D)" onClick={() => props.execute("surface.split-down")}><Glyph name="rows"/></button>
        <button aria-label="Tile all surfaces" title="Tile all surfaces" disabled={groupsOf(state.root).flatMap(g => g.tabs).length < 2} onClick={() => props.execute("surface.tile")}><Glyph name="grid"/></button>
        {props.nativeWindows && <button aria-label="Detach active surface" disabled={!groupsOf(state.root).some(g=>g.id===state.focusedGroupId&&g.active)} title="Detach into native window" onClick={()=>props.execute("surface.detach")}><Glyph name="detach"/></button>}
        <button aria-label={state.maximizedGroupId ? "Restore panes" : "Maximize active pane"} title="Maximize / restore (⌘⌥Enter)" onClick={() => props.execute("surface.maximize")}><Glyph name={state.maximizedGroupId ? "restore" : "expand"}/></button>
        <button aria-label="Window actions" title="Window actions" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); props.openFrameMenu(r.left, r.bottom); }}><Glyph name="more"/></button>
  </>;
}
