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

import { useEffect } from "react";
import { groupsOf, renderOrder } from "./engine";
import type { ActionArg, LayoutState, Pane, SurfaceId } from "./types";

export interface WorkbenchProps {
  state: LayoutState;
  menuOpen: boolean;
  execute: (ref: string, arg?: ActionArg) => void;
  openBindingMenu: (surfaceId: SurfaceId, x: number, y: number) => void;
  openFrameMenu: (x: number, y: number) => void;
}

export function Workbench(props: WorkbenchProps) {
  const { state, menuOpen } = props;
  if (!state.root) return null;

  // D16: focus follows the active binding — keep DOM focus on the active
  // tab of the focused group after keyboard/menu/layout operations.
  useEffect(() => {
    if (menuOpen) return;
    const g = groupsOf(state.root).find((g) => g.id === state.focusedGroupId);
    if (!g?.active) return;
    const el = document.querySelector<HTMLElement>(`[data-surface-id="${g.active}"]`);
    if (el && document.activeElement !== el && !el.contains(document.activeElement))
      el.focus();
  });

  const depth = state.agencyDepth;
  return (
    <div className="workbench">
      <aside
        className={`agency-column depth-${depth}`}
        data-depth={depth}
        aria-label="Agency field"
      >
        {depth === "panel" || depth === "full" ? (
          <p className="agency-note">
            <span className="agency-note-label">agency</span>
            <span className="agency-note-body">
              reserved surface — no encounters mounted
            </span>
          </p>
        ) : null}
        {depth === "full" ? (
          /* D17: full is a true overlay — the canvas is masked dimensionally
           * (its layout is untouched), never reflowed. */
          <div className="agency-overlay" aria-hidden="true" />
        ) : null}
      </aside>
      <main className="surface-host" aria-label="Canvas">
        <PaneNode pane={state.root} {...props} />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PaneProps extends WorkbenchProps {
  pane: Pane;
}

function PaneNode(props: PaneProps) {
  const { pane } = props;
  if (pane.type === "split")
    return (
      <div className="pane split" data-pane="split" data-pane-dir={pane.dir}>
        {pane.children.map((child) => (
          <PaneNode key={child.id} {...props} pane={child} />
        ))}
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
            active={active === id}
            pinned={group.pinned.includes(id)}
            groupId={group.id}
            execute={execute}
            openBindingMenu={openBindingMenu}
          />
        ))}
        <button
          type="button"
          className="strip-open"
          aria-label="Open test surface"
          title="Open test surface (⌘T)"
          onClick={() => execute("surface.open")}
        >
          +
        </button>
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
        {activeBinding ? <SurfaceCard binding={activeBinding} /> : null}
      </div>
    </section>
  );
}

interface TabProps {
  id: SurfaceId;
  title: string;
  active: boolean;
  pinned: boolean;
  groupId: string;
  execute: (ref: string, arg?: ActionArg) => void;
  openBindingMenu: (surfaceId: SurfaceId, x: number, y: number) => void;
}

function Tab({ id, title, active, pinned, groupId, execute, openBindingMenu }: TabProps) {
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
      <span className="tab-title">{title}</span>
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
        ×
      </button>
    </div>
  );
}

/**
 * The only surface body that exists today: an honestly labelled test
 * binding. No fake file trees, no invented content (law 4, law 7) — real
 * owner surfaces mount from U0.4 onward and replace this card.
 */
function SurfaceCard({ binding }: { binding: { id: string; kind: string; ref?: string; title: string } }) {
  return (
    <div className="test-surface" data-kind={binding.kind}>
      <p className="test-title">{binding.title}</p>
      <dl className="test-facts">
        <div>
          <dt>kind</dt>
          <dd>{binding.kind}</dd>
        </div>
        <div>
          <dt>ref</dt>
          <dd>{binding.ref ?? "—"}</dd>
        </div>
        <div>
          <dt>binding</dt>
          <dd>{binding.id}</dd>
        </div>
      </dl>
      <p className="test-note">
        test binding — the frame exercises its surface grammar on this
        placeholder; owner surfaces mount from U0.4 onward
      </p>
    </div>
  );
}
