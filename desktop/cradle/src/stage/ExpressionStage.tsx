/**
 * The Global Expression Stage — O:I's owner-side expression contract. One
 * stage per native window (every window runs the same provider tree). The
 * stage owns WHERE the expressive faculty sits in the application — the
 * presentation planes — and WHAT application events may address it —
 * semantic cues, targets and the form vocabulary. The runtime behind the
 * present()/express() seam is the merged native Expressions engine
 * (engineSurface.ts): hosted production fields, persistent-ID scene
 * interpolation, honest context loss. Application code still never speaks
 * physics — it names recipes, addresses targets, states cues.
 *
 * Planes:
 *   ambient     — the resting altitude (--oi-z-expression): ink on the
 *                 content planes, never above dialogs or menus.
 *   overlay     — the forms renderer's own canvas over ordinary chrome
 *                 (--oi-z-stage-overlay), still under popovers.
 *   frontstate  — the opening/welcome ground (--oi-z-stage-frontstate).
 *                 While a frontstate presentation stands, the engine
 *                 surface canvas is raised with it — at boot nothing else
 *                 is painted, and popovers and consent stay above.
 *
 * Cues: application layers emit facts (app.opening, surface.loading,
 * source.saved, …) through the cue bus; they never name parameters. In
 * native windows the stage relays cue identities to the other windows, so
 * an application-wide expression reaches every stage without sharing
 * particle buffers.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createExpressionOverlay,
  type ExpressionOverlay,
  type ExpressionOptions,
  type FormName,
} from "@epilogos/oi-design-system/expression";
import "@epilogos/oi-design-system/expression.css";
import { useVisuals } from "../visuals/ParticleExpression";
import { useKernel } from "../kernel/KernelProvider";
import {
  admitRemoteCue,
  emitExpressionCue,
  onExpressionCue,
  type ExpressionCue,
} from "./cues";
import { expressionTargetIds, resolveExpressionTarget } from "./targets";
import type { EngineSurface, StageRetainedLease } from "./engineSurface";

export type StagePlane = "ambient" | "overlay" | "frontstate";

export interface StagePresentationRequest {
  /** Stable presentation id — one live presentation per id. */
  id: string;
  plane: StagePlane;
  /** Authored recipe id (recipes.ts); application code never patches. */
  recipe: string;
  /** EX1 material projection into this existing stage. */
  config?: Record<string,unknown>;
  sceneRef?: string;
  /** Registered Expression Target id; the viewport surface is the window
   * canvas. Element targets are a later surface kind, not a scissor. */
  target?: string;
  paused?: boolean;
}

export interface StagePresentation {
  readonly id: string;
  readonly plane: StagePlane;
  /** Apply another authored recipe as an overlay — no reseed, no remount. */
  update(recipe: string): void;
  updateConfig(config: Record<string,unknown>, sceneRef: string, selectedIds: string[]): void;
  /** Play an authored sequence (recipes.ts) against this presentation. */
  play(sequence: string): void;
  release(): void;
}

export interface ExpressionStageApi {
  present(request: StagePresentationRequest): StagePresentation | null;
  /** Lease only retained targets/checkpoint/recovery from a presentation that
   * already occupies this window's production stage. No renderer or step owner
   * crosses this seam. */
  retainedLease(presentationId: string): StageRetainedLease | null;
  /** Emit a semantic cue onto the bus (relayed cross-window in native). */
  emit(cue: { kind: ExpressionCue["kind"]; target?: string; label?: string; detail?: string }): void;
  /** The semantic form vocabulary (idle/listening/…), rendered on the
   * overlay plane. The options may address a registered target id. */
  express(name: string, options: ExpressionOptions & { target?: string }): number | null;
  update(handle: number | null, options: Partial<ExpressionOptions> & { name?: FormName; target?: string }): boolean;
  release(handle: number | null): void;
  /** Honest engine failure (context creation or unrecoverable runtime failure)
   * — surfaced, never swallowed. A retained context return is reconciled through
   * its lease and therefore does not destroy this stage. */
  error: string | null;
  /** Bounded dev/walk diagnostics: presentations, recent cues, engine
   * capabilities, and the forms renderer's own counters. */
  inspect(): Record<string, unknown>;
}

const StageContext = createContext<ExpressionStageApi | null>(null);

export function useExpressionStage(): ExpressionStageApi {
  const stage = useContext(StageContext);
  if (!stage) throw new Error("useExpressionStage outside ExpressionStageProvider");
  return stage;
}

const CUE_LOG_LIMIT = 32;
const CUE_RELAY = "oi:stage-cue-relay";

interface PresentationRecord {
  id: string;
  plane: StagePlane;
}

export function ExpressionStageProvider({ children }: { children: ReactNode }) {
  const { snapshot } = useVisuals();
  const kernel = useKernel();
  // The overlay-plane renderer is a window-lifetime singleton created at
  // mount (one per window is the renderer's own law); the ref is the source
  // of truth so the creating call can already serve requests.
  const overlayRef = useRef<ExpressionOverlay | null>(null);
  const [, markOverlayReady] = useState(0);
  const [surface, setSurface] = useState<EngineSurface | null>(null);
  const surfaceRef = useRef<EngineSurface | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [frontstateCount, setFrontstateCount] = useState(0);
  const presentations = useRef(new Map<string, PresentationRecord>());
  const cueLog = useRef<ExpressionCue[]>([]);

  const ensureOverlay = useCallback((): ExpressionOverlay | null => {
    if (overlayRef.current) return overlayRef.current;
    try {
      overlayRef.current = createExpressionOverlay(document.body);
    } catch {
      // A second overlay in this window is refused by the renderer's own
      // law; a Canvas-2D-less window simply declines to express.
      return null;
    }
    markOverlayReady((version) => version + 1);
    return overlayRef.current;
  }, []);

  // The overlay-plane renderer lives for the window's lifetime, as the
  // old expression provider's did — created at mount, not on first use.
  useEffect(() => { ensureOverlay(); }, [ensureOverlay]);

  // Presentation lifecycle -------------------------------------------------

  const present = useCallback((request: StagePresentationRequest): StagePresentation | null => {
    if (!snapshot.enabled || surfaceError) return null;
    if (presentations.current.has(request.id)) return null;
    if (request.target && request.target !== "viewport") {
      throw new Error(`Element-target presentations are not engine window surfaces: ${request.target}`);
    }
    const surface = surfaceRef.current;
    if (!surface) return null;
    if (request.config) surface.presentConfig(request.id, request.config, request.sceneRef);
    else surface.present(request.id, request.recipe);
    if (request.paused) surface.setPaused(true);
    presentations.current.set(request.id, { id: request.id, plane: request.plane });
    if (request.plane === "frontstate") setFrontstateCount((count) => count + 1);
    return {
      id: request.id,
      plane: request.plane,
      update(recipe: string) {
        surface.update(request.id, recipe);
      },
      updateConfig(config, sceneRef, selectedIds) { surface.presentConfig(request.id, config, sceneRef, selectedIds); },
      play(sequence: string) {
        surface.play(request.id, sequence);
      },
      release() {
        if (!presentations.current.has(request.id)) return;
        presentations.current.delete(request.id);
        if (request.plane === "frontstate") setFrontstateCount((count) => Math.max(0, count - 1));
        surfaceRef.current?.release(request.id);
      },
    };
  }, [snapshot.enabled, surfaceError, surface]);

  const retainedLease = useCallback((presentationId: string): StageRetainedLease | null => {
    if (!presentations.current.has(presentationId)) return null;
    const current = surfaceRef.current;
    if (!current) return null;
    return current.retainedLease(presentationId);
  }, [surface]);

  // The engine surface exists exactly while the expression is enabled —
  // the master switch is absolute: off removes the canvas, the context
  // and the simulation entirely, and the engine module is loaded only on
  // the enabled path (the never-enabled path allocates nothing). Engine
  // failure surfaces and disposes; the next enable starts a fresh field
  // with an explicit reseed.
  useEffect(() => {
    if (!snapshot.enabled) {
      surfaceRef.current?.dispose();
      surfaceRef.current = null;
      setSurface(null);
      setSurfaceError(null);
      presentations.current.clear();
      setFrontstateCount(0);
      return;
    }
    if (surfaceRef.current) return;
    let cancelled = false;
    let created: EngineSurface | null = null;
    void import("./engineSurface").then(({ EngineSurface: Surface }) => {
      if (cancelled || surfaceRef.current) return;
      created = Surface.forWindow((message) => {
        setSurfaceError(message);
        surfaceRef.current?.dispose();
        surfaceRef.current = null;
        setSurface(null);
        presentations.current.clear();
        setFrontstateCount(0);
      });
      surfaceRef.current = created;
      setSurface(created);
    }).catch((cause: unknown) => {
      setSurfaceError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
      created?.dispose();
      if (created && surfaceRef.current === created) {
        surfaceRef.current = null;
        setSurface(null);
        presentations.current.clear();
        setFrontstateCount(0);
      }
    };
  }, [snapshot.enabled]);

  // Frontstate altitude law: the engine surface canvas is raised with the
  // frontstate plane while (and only while) a frontstate presentation
  // stands. Popovers and consent stay above by token altitude.
  useEffect(() => {
    if (!surface) return;
    surface.canvas.style.zIndex = frontstateCount > 0 ? "var(--oi-z-stage-frontstate)" : "";
    return () => { surface.canvas.style.zIndex = ""; };
  }, [surface, frontstateCount]);

  // Cue bus + native relay -------------------------------------------------

  const emit = useCallback((cue: { kind: ExpressionCue["kind"]; target?: string; label?: string; detail?: string }) => {
    emitExpressionCue(cue);
  }, []);

  useEffect(() => {
    const record = (cue: ExpressionCue) => {
      cueLog.current = [...cueLog.current.slice(-(CUE_LOG_LIMIT - 1)), cue];
    };
    const stopObserving = onExpressionCue(record);
    // Relay local cue identities to the other native windows; their
    // admissions arrive as origin:"remote" and are never re-relayed.
    let unlisten: (() => void) | undefined;
    let live = true;
    const stopRelay = onExpressionCue((cue) => {
      if (cue.origin !== "local" || kernel.transport.kind !== "tauri") return;
      void import("@tauri-apps/api/event")
        .then(({ emit }) => emit(CUE_RELAY, { kind: cue.kind, target: cue.target, label: cue.label, detail: cue.detail, seq: cue.seq }))
        .catch(() => {});
    });
    if (kernel.transport.kind === "tauri") {
      void import("@tauri-apps/api/event")
        .then(({ listen }) => listen<unknown>(CUE_RELAY, (event) => admitRemoteCue(event.payload)))
        .then((stop) => { if (live) unlisten = stop; else stop(); })
        .catch(() => {});
    }
    return () => {
      live = false;
      stopObserving();
      stopRelay();
      unlisten?.();
    };
  }, [kernel.transport.kind]);

  // Opt-in native walk receiver: observation only, no global renderer
  // channel. The report is the forms renderer's own bounded counters —
  // the native walk contract's exact shape (the Rust side refuses
  // unknown fields).
  useEffect(() => {
    if (kernel.transport.kind !== "tauri") return;
    let live = true, enabled = false, inFlight = false, queued = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let send = () => {};
    const changed = () => send();
    void import("@tauri-apps/api/core").then(async ({ invoke }) => {
      const accepted = await invoke<boolean>("expression_walk_observation", { report: null });
      if (!live || !accepted) return;
      enabled = true;
      send = () => {
        if (inFlight) { queued = true; return; }
        inFlight = true;
        const renderer = overlayRef.current;
        void invoke("expression_walk_observation", { report: renderer ? renderer.inspect() : null })
          .catch(() => {})
          .finally(() => { inFlight = false; if (queued) { queued = false; send(); } });
      };
      timer = setInterval(send, 1000);
      document.addEventListener("visibilitychange", changed);
      media.addEventListener("change", changed);
      send();
    }).catch(() => {});
    return () => {
      live = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", changed);
      media.removeEventListener("change", changed);
      if (enabled) send();
    };
  }, [kernel.transport.kind]);

  // Forms (overlay plane) --------------------------------------------------

  const express = useCallback((name: string, options: ExpressionOptions & { target?: string }): number | null => {
    const renderer = ensureOverlay();
    if (!renderer) return null;
    const { target, ...rest } = options;
    if (target && !rest.rect) rest.rect = () => resolveExpressionTarget(target);
    return renderer.express(name, rest);
  }, [ensureOverlay]);

  const updateHandle = useCallback((handle: number | null, options: Partial<ExpressionOptions> & { name?: FormName; target?: string }): boolean => {
    const renderer = overlayRef.current;
    if (!renderer) return false;
    const { target, ...rest } = options;
    if (target && !rest.rect) rest.rect = () => resolveExpressionTarget(target);
    return renderer.update(handle, rest);
  }, []);

  const releaseHandle = useCallback((handle: number | null) => {
    overlayRef.current?.release(handle);
  }, []);

  const inspect = useCallback(() => ({
    presentations: [...presentations.current.values()].map((record) => ({ id: record.id, plane: record.plane })),
    engine: surface ? surface.capabilities() : null,
    /** Whether the window surface's own clock is held (lease pause law). */
    paused: surfaceRef.current ? surfaceRef.current.isPaused : null,
    targets: expressionTargetIds(),
    cues: cueLog.current,
    overlay: overlayRef.current ? overlayRef.current.inspect() : null,
  }), [surface]);

  const api = useMemo<ExpressionStageApi>(() => ({
    present,
    retainedLease,
    emit,
    express,
    update: updateHandle,
    release: releaseHandle,
    error: surfaceError,
    inspect,
  }), [present, retainedLease, emit, express, updateHandle, releaseHandle, surfaceError, inspect]);

  return <StageContext.Provider value={api}>{children}</StageContext.Provider>;
}
