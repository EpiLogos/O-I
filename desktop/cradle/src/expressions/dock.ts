/**
 * A surface-local dock's remembered geometry: open/closed and its size along
 * the docking axis. Per-viewer presentation state only — it lives in
 * localStorage under a versioned key, every access is guarded, and the dock
 * renders correctly when storage is empty, blocked or holds garbage.
 *
 * Resizing is the one admitted layout gesture: a pointer drag or the arrow
 * keys on the `.oi-resize-handle` separator. Nothing animates.
 */
import {useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent} from "react";

export interface DockState { open: boolean; size: number }
export interface DockBounds { min: number; max: number }
export type DockEdge = "right" | "bottom";

function load(key: string, fallback: DockState, bounds: DockBounds): DockState {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    const {open, size} = parsed as Partial<DockState>;
    return {
      open: typeof open === "boolean" ? open : fallback.open,
      size: typeof size === "number" && Number.isFinite(size) ? Math.min(bounds.max, Math.max(bounds.min, size)) : fallback.size,
    };
  } catch { return fallback; }
}
function save(key: string, state: DockState) {
  try { window.localStorage.setItem(key, JSON.stringify(state)); } catch { /* per-viewer convenience only */ }
}

export interface DockApi {
  state: DockState;
  setOpen(open: boolean): void;
  toggle(): void;
  /** Spread onto the `.oi-resize-handle` separator. */
  handle: {
    role: "separator";
    tabIndex: 0;
    "aria-orientation": "vertical" | "horizontal";
    "aria-valuenow": number;
    "aria-valuemin": number;
    "aria-valuemax": number;
    onPointerDown(event: ReactPointerEvent<HTMLElement>): void;
    onKeyDown(event: ReactKeyboardEvent<HTMLElement>): void;
  };
}

/** `edge` is where the dock sits in its container: a right dock grows as the
 * handle moves left; a bottom dock grows as the handle moves up. */
export function useDock(key: string, fallback: DockState, bounds: DockBounds, edge: DockEdge): DockApi {
  const [state, setState] = useState<DockState>(() => load(key, fallback, bounds));
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => { save(key, state); }, [key, state]);
  const clamp = useCallback((size: number) => Math.round(Math.min(bounds.max, Math.max(bounds.min, size))), [bounds.max, bounds.min]);
  const setOpen = useCallback((open: boolean) => setState(current => current.open === open ? current : {...current, open}), []);
  const toggle = useCallback(() => setState(current => ({...current, open: !current.open})), []);
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const origin = edge === "right" ? event.clientX : event.clientY;
    const start = latest.current.size;
    handle.setPointerCapture?.(event.pointerId);
    handle.dataset.dragging = "true";
    const move = (next: PointerEvent) => {
      const delta = origin - (edge === "right" ? next.clientX : next.clientY);
      setState(current => ({...current, size: clamp(start + delta)}));
    };
    const end = () => {
      delete handle.dataset.dragging;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }, [clamp, edge]);
  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    const grow = edge === "right" ? "ArrowLeft" : "ArrowUp", shrink = edge === "right" ? "ArrowRight" : "ArrowDown";
    if (event.key !== grow && event.key !== shrink && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    setState(current => ({...current, size: event.key === "Home" ? bounds.min : event.key === "End" ? bounds.max : clamp(current.size + (event.key === grow ? 16 : -16))}));
  }, [bounds.max, bounds.min, clamp, edge]);
  return {
    state, setOpen, toggle,
    handle: {
      role: "separator", tabIndex: 0,
      "aria-orientation": edge === "right" ? "vertical" : "horizontal",
      "aria-valuenow": state.size, "aria-valuemin": bounds.min, "aria-valuemax": bounds.max,
      onPointerDown, onKeyDown,
    },
  };
}

/** Which edge a surface's dock takes, from the surface's own width: beside
 * the body when there is room, beneath it when the pane is split small. */
export function useDockEdge(element: React.RefObject<HTMLElement>, sideMinWidth: number): DockEdge {
  const [edge, setEdge] = useState<DockEdge>("right");
  useEffect(() => {
    const node = element.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const read = () => setEdge(node.clientWidth >= sideMinWidth ? "right" : "bottom");
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [element, sideMinWidth]);
  return edge;
}
