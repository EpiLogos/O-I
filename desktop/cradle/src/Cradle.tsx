/**
 * The Cradle root (U0.3b). One layout state, persisted to localStorage and
 * restored on load (map §5 U0.3b: "layout state persisted across restart").
 * Zero surfaces = austere rest, exactly the U0.3 shape (agency field +
 * canvas + To: only). ≥1 surface = the Workbench frame (law 12: rest is
 * *what is on screen*, the OS grammar is *how you manipulate what appears*).
 *
 * Keyboard, pointer, and context-menu invocations all funnel through one
 * executor (registry.executeFrameAction) — parity by construction.
 */

import { useEffect, useRef, useState } from "react";
import { Rest } from "./Rest";
import { ContextMenu, type MenuState } from "./surface/ContextMenu";
import { Workbench } from "./surface/Workbench";
import { frameActionForKey } from "./surface/keys";
import { loadLayout, saveLayout } from "./surface/persist";
import {
  bindingDisclosures,
  executeFrameAction,
  frameDisclosures,
  type MenuContext,
} from "./surface/registry";
import { stepDepthDown } from "./surface/engine";
import type {
  ActionArg,
  ActionDisclosure,
  LayoutState,
  RestorePoint,
  SurfaceId,
} from "./surface/types";

function snapshotOf(state: LayoutState): RestorePoint {
  return {
    root: state.root,
    surfaces: state.surfaces,
    closedStack: state.closedStack,
    focusedGroupId: state.focusedGroupId,
  };
}

export function Cradle() {
  const [state, setState] = useState<LayoutState>(loadLayout);
  // The restore point: the layout as this session loaded it. `Restore
  // layout` (⌘⌥R / strip menu) returns the frame here.
  const restorePoint = useRef<RestorePoint>(snapshotOf(state));
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  menuRef.current = menu;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on every change — the layout is app state, continuously saved.
  useEffect(() => {
    saveLayout(state);
  }, [state]);

  const execute = (ref: string, arg?: ActionArg) =>
    setState((s) => executeFrameAction(s, ref, arg, restorePoint.current));

  // The frame keyboard map (keys.ts) + Escape. Attached always, so ⌘T opens
  // from rest and every operation has its keyboard path.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuRef.current) {
          setMenu(null);
          return;
        }
        setState((s) => stepDepthDown(s)); // full overlay → panel
        return;
      }
      const act = frameActionForKey(e, !!menuRef.current);
      if (!act) return;
      e.preventDefault();
      setState((s) => executeFrameAction(s, act.ref, act.arg, restorePoint.current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Context-menu plumbing (D15): open exactly what is disclosed — an object
  // with no disclosed Actions opens no menu at all.
  const menuContext = (): MenuContext => ({
    state: stateRef.current,
    snapshot: restorePoint.current,
  });

  const openBindingMenu = (surfaceId: SurfaceId, x: number, y: number) => {
    const items = bindingDisclosures(menuContext(), surfaceId);
    if (items.length === 0) return;
    setMenu({ x, y, items, surfaceId });
  };

  const openFrameMenu = (x: number, y: number) => {
    const items = frameDisclosures(menuContext());
    if (items.length === 0) return;
    setMenu({ x, y, items });
  };

  const invoke = (item: ActionDisclosure, surfaceId?: SurfaceId) => {
    setMenu(null);
    setState((s) =>
      executeFrameAction(s, item.action_ref, { surfaceId }, restorePoint.current),
    );
  };

  // Close the menu on any pointerdown outside it.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".ctx-menu")) setMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menu]);

  return (
    <>
      {state.root ? (
        <Workbench
          state={state}
          menuOpen={!!menu}
          execute={execute}
          openBindingMenu={openBindingMenu}
          openFrameMenu={openFrameMenu}
        />
      ) : (
        <Rest />
      )}
      {menu ? (
        <ContextMenu menu={menu} onInvoke={invoke} onClose={() => setMenu(null)} />
      ) : null}
    </>
  );
}
