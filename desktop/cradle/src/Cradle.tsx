/**
 * The Cradle root (U0.3b + U0.4 + U0.6). One layout state, persisted to
 * localStorage and restored on load (map §5 U0.3b). Zero surfaces =
 * austere rest, exactly the U0.3 shape. ≥1 surface = the Workbench frame
 * (law 12).
 *
 * U0.4 mounts the kernel seam: the frame's surface bindings and the
 * kernel's surface/buffer state stay reconciled through three effects —
 * mount (a layout binding new to the kernel opens kernel-side; a source
 * surface also opens its buffer through the owner), unmount (a binding
 * gone from the layout closes kernel-side), and focus (D16: focus follows
 * the active binding — the one global focus relation moves, exactly one
 * event when it actually moves). Keyboard, pointer, and context-menu
 * invocations all funnel through one executor.
 *
 * U0.6 mounts the walk channel (dev/walk builds only, map §3 D10): the
 * typed `__cradle.walk` client binds the same KernelApi below — the same
 * seam, never a second authority path — and is absent from production
 * bundles by the build gate above.
 */

import { useEffect, useRef, useState, type ComponentType } from "react";
import { WorldNavigator } from "./surfaces/navigator/WorldNavigator";
import { Rest } from "./Rest";
import { KernelProvider, useKernel } from "./kernel/KernelProvider";
import type { ListedSource } from "./kernel/types";
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
import {
  activeBindingId,
  groupsOf,
  makeSourceBinding,
  openBinding,
  stepDepthDown,
} from "./surface/engine";
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

/** The U0.6 walk gate, baked by vite.config.ts: true in dev (`vite serve`)
 * and in walk bundles (`WALK=1 vite build`); `false` in a plain production
 * build, where the dynamic import below is dead-code-eliminated and the
 * `__cradle.walk` chunk is never emitted (map §3 D10: dev tooling only). */
declare const __CRADLE_WALK__: boolean;

export function Cradle() {
  const [WalkChannel, setWalkChannel] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (__CRADLE_WALK__) {
      void import("./walk/WalkChannel").then((module) => {
        setWalkChannel(() => module.WalkChannel);
      });
    }
  }, []);
  return (
    <KernelProvider>
      <CradleFrame />
      {WalkChannel ? <WalkChannel /> : null}
    </KernelProvider>
  );
}

function CradleFrame() {
  const kernel = useKernel();
  const [writing, setWriting] = useState("");
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const navigatorRef = useRef(false);
  navigatorRef.current = navigatorOpen;
  const returnFocus = useRef<HTMLElement | null>(null);
  const rememberWorkFocus = () => {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && !active.closest(".ctx-menu,.world-navigator")) {
      returnFocus.current = active;
    } else if (!returnFocus.current?.isConnected) {
      returnFocus.current = document.querySelector<HTMLElement>(".pane.focused .source-textarea,.canvas-surface");
    }
  };
  const summonWorld = () => {
    rememberWorkFocus();
    setNavigatorOpen(true);
  };
  const dismissWorld = () => {
    setNavigatorOpen(false);
    requestAnimationFrame(() => returnFocus.current?.focus());
  };
  const [state, setState] = useState<LayoutState>(loadLayout);
  // The restore point: the layout as this session loaded it. `Restore
  // layout` (⌘⌥R / strip menu) returns the frame here.
  const restorePoint = useRef<RestorePoint>(snapshotOf(state));
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  menuRef.current = menu;
  const stateRef = useRef(state);
  stateRef.current = state;
  const kernelSurfaces = kernel.snapshot.surfaces;
  const lastFocusedSurface = useRef<SurfaceId | null>(null);

  // Persist on every change — the layout is app state, continuously saved.
  useEffect(() => {
    saveLayout(state);
  }, [state]);

  // -------------------------------------------------------------------------
  // Kernel reconciliation (U0.4)
  //
  // The layout's OPEN surfaces (in the pane tree — `surfaces` also carries
  // closed bindings for the reopen stack) reconcile with the kernel's
  // surface state:
  //   mount — a binding the kernel does not know opens kernel-side; a
  //           source surface opens its buffer through the owner's read and
  //           focuses: surface_changed, source_opened, focus_changed, one
  //           receipt each;
  //   unmount — a binding gone from the tree closes kernel-side (closing
  //           the focused surface clears the focus relation, a second
  //           receipt).
  // In-flight mounts/unmounts are guarded so one state change never
  // double-emits.
  const pendingMount = useRef<Set<SurfaceId>>(new Set());
  const pendingClose = useRef<Set<SurfaceId>>(new Set());
  useEffect(() => {
    const openIds = new Set(groupsOf(state.root).flatMap((group) => group.tabs));
    for (const surfaceId of openIds) {
      const binding = state.surfaces[surfaceId];
      if (!binding || kernelSurfaces[surfaceId] || pendingMount.current.has(surfaceId)) {
        continue;
      }
      pendingMount.current.add(surfaceId);
      void (async () => {
        try {
          await kernel.surfaceOpen(binding.id, binding.kind, binding.ref, binding.title);
          if (binding.kind === "source" && binding.ref) {
            await kernel.apply({ op: "source_open", source_ref: binding.ref, project: binding.project });
          }
          await kernel.surfaceFocus(binding.id);
        } finally {
          pendingMount.current.delete(binding.id);
        }
      })();
    }
    for (const surfaceId of Object.keys(kernelSurfaces)) {
      if (openIds.has(surfaceId) || pendingClose.current.has(surfaceId)) continue;
      pendingClose.current.add(surfaceId);
      void kernel
        .surfaceClose(surfaceId)
        .catch(() => undefined)
        .finally(() => pendingClose.current.delete(surfaceId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.root, state.surfaces, kernelSurfaces]);

  // Focus follows the active binding (D16): the one global focus relation
  // moves with the frame's active surface — and only when it actually
  // moves (the kernel emits nothing for a re-focus of the same ref).
  const activeId = activeBindingId(state);
  useEffect(() => {
    if (!activeId) return;
    if (lastFocusedSurface.current === activeId) return;
    if (!kernel.snapshot.surfaces[activeId]) return; // the mount path focuses it
    lastFocusedSurface.current = activeId;
    void kernel.surfaceFocus(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, kernel.snapshot.surfaces]);

  const execute = (ref: string, arg?: ActionArg) =>
    setState((s) => executeFrameAction(s, ref, arg, restorePoint.current));

  /** Open a real source from the index listing: one layout binding carrying
   * the owner's canonical ref verbatim — the kernel mount effect opens the
   * buffer through the owner's read. */
  const openSource = (source: ListedSource, project?: string) => {
    const current = stateRef.current;
    const binding = makeSourceBinding(current, source.ref, source.path, project);
    if (groupsOf(current.root).some(g => g.tabs.includes(binding.id))) {
      execute("surface.activate", { surfaceId: binding.id });
      return;
    }
    setState((s) => openBinding({ ...s, closedStack: s.closedStack.filter(id => id !== binding.id) }, makeSourceBinding(s, source.ref, source.path, project)));
  };

  // The frame keyboard map (keys.ts) + Escape. Attached always, so ⌘T/⌘O
  // open from rest and every operation has its keyboard path.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyB") {
        e.preventDefault();
        if (navigatorRef.current) dismissWorld(); else summonWorld();
        return;
      }
      if (e.key === "Escape" && navigatorRef.current) {
        e.preventDefault(); dismissWorld(); return;
      }
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
    const onContext = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".agency-field,.agency-column")) return;
      e.preventDefault();
      rememberWorkFocus();
      setMenu({ x: e.clientX, y: e.clientY, items: [{ action_ref: "frame.world", title: "World (⌘B)", enabled: true }] });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContext);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("contextmenu", onContext); };
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
    if (item.action_ref === "frame.world") { summonWorld(); return; }
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
          openSource={openSource}
        />
      ) : (
        <Rest value={writing} onChange={setWriting} />
      )}
      {navigatorOpen ? <WorldNavigator onClose={dismissWorld} onOpenSource={(source, project) => { setNavigatorOpen(false); openSource(source, project); }} /> : null}
      {menu ? (
        <ContextMenu menu={menu} onInvoke={invoke} onClose={() => setMenu(null)} />
      ) : null}
    </>
  );
}
