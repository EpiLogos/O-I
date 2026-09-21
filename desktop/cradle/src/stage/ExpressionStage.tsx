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
 *   overlay     — semantic native cues over ordinary chrome
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
import type {ExpressionOptions, FormName} from "@epilogos/oi-design-system/expression";
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
import type {NativeCues} from "./nativeCues";

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
  /** O:I document projections without authored colours use the host ink and
   * ground. Native instrument configs preserve their palette by default. */
  appearance?: "host" | "inverse-host" | "authored";
  /** A full presentation paints its evaluated scene ground. Semantic cues
   * share the production field over existing chrome with a transparent ground. */
  backdrop?: "scene" | "transparent";
  /** Registered Expression Target id; the viewport surface is the window
   * canvas. Element targets are a later surface kind, not a scissor. */
  target?: string;
  paused?: boolean;
  /** Deliberate, presentation-scoped reduced-motion override. */
  forceMotion?: boolean;
}

export interface StagePresentation {
  readonly id: string;
  readonly plane: StagePlane;
  /** Apply another authored recipe as an overlay — no reseed, no remount. */
  update(recipe: string): void;
  updateConfig(config: Record<string,unknown>, sceneRef: string, selectedIds: string[]): void;
  /** Reposition this presentation's existing canvas without a renderer fork. */
  setContainer(container: HTMLElement | null): void;
  /** Resolves only once this presentation has actually rendered. */
  ready(): Promise<void>;
  /** Completion comes from the engine's rendered tail, never a UI timer. */
  play(sequence: string): Promise<{status: "completed" | "cancelled"}>;
  /** Native instrument controls operate on this presentation's existing field. */
  command(command: Parameters<EngineSurface["command"]>[0]): void;
  setPaused(paused: boolean): void;
  setForceMotion(force: boolean): void;
  capture(width?: number, height?: number): HTMLCanvasElement;
  telemetry(): unknown;
  hitTest(clientX:number,clientY:number): import("./engineSurface").ExpressionHit|null;
  release(): void;
}

export interface ExpressionStageApi {
  present(request: StagePresentationRequest): StagePresentation | null;
  /** Lease only retained targets/checkpoint/recovery from a presentation that
   * already occupies this window's production stage. No renderer or step owner
   * crosses this seam. */
  retainedLease(presentationId: string): StageRetainedLease | null;
  /** Existing engine capture only; no persistence, representation or publication. */
  capture(presentationId: string, width?: number, height?: number): HTMLCanvasElement;
  /** Emit a semantic cue onto the bus (relayed cross-window in native). */
  emit(cue: { kind: ExpressionCue["kind"]; target?: string; label?: string; detail?: string }): void;
  /** The semantic form vocabulary (idle/listening/…), rendered on the
   * overlay plane. The options may address a registered target id. */
  express(name: string, options: ExpressionOptions & { target?: string }): number | null;
  update(handle: number | null, options: Partial<ExpressionOptions> & { name?: FormName; target?: string }): boolean;
  release(handle: number | null): void;
  /** Move the LIVE presentation's selection — the stage's real
   * focus/highlight decoration (ES4 deictic focus over the stage). Editing
   * decoration only: no document, scene, config or clock change. Returns
   * false when no live presentation stands in this window, so the caller
   * names the stage's absence honestly instead of faking a movement. */
  focusSelection(selectedIds: string[]): boolean;
  /** Honest engine failure (context creation or unrecoverable runtime failure)
   * — surfaced, never swallowed. A retained context return is reconciled through
   * its lease and therefore does not destroy this stage. */
  error: string | null;
  /** Bounded dev/walk diagnostics: presentations, recent cues, engine
   * capabilities, and the native cue controller's bounded counters. */
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
  const cuesRef = useRef<NativeCues | null>(null);
  const cueSerial = useRef(0);
  // A successful native retained lease reserves the existing resident field
  // across release/re-entry. Only a deliberate new foreground presentation or
  // window disable can replace that reservation; small cues never reseed it.
  const retainedReservation = useRef(false);
  const [surface, setSurface] = useState<EngineSurface | null>(null);
  const surfaceRef = useRef<EngineSurface | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [frontstateCount, setFrontstateCount] = useState(0);
  // Deferred restored surfaces retry once the opening releases. Admission
  // does not change API identity: it must not restart its own owner effect.
  const [availabilityEpoch, setAvailabilityEpoch] = useState(0);
  const presentations = useRef(new Map<string, PresentationRecord>());
  const cueLog = useRef<ExpressionCue[]>([]);

  // Presentation lifecycle -------------------------------------------------

  const present = useCallback((request: StagePresentationRequest): StagePresentation | null => {
    if (!snapshot.enabled || surfaceError) return null;
    if (presentations.current.has(request.id)) return null;
    if (request.plane !== "frontstate" && [...presentations.current.values()].some(record => record.plane === "frontstate")) return null;
    if (request.target && request.target !== "viewport") {
      throw new Error(`Element-target presentations are not engine window surfaces: ${request.target}`);
    }
    const surface = surfaceRef.current;
    if (!surface) return null;
    cuesRef.current?.suspend();
    try {
      if (request.config) surface.presentConfig(request.id, request.config, request.sceneRef, [], request.appearance);
      else surface.present(request.id, request.recipe, request.appearance);
    } catch(error) {cuesRef.current?.refresh();throw error;}
    retainedReservation.current=false;
    surface.setBackdrop(request.backdrop ?? "scene");
    // Pause and deliberate motion belong to this presentation, not the
    // reused window surface or whichever view acquires it next.
    surface.setForceMotion(request.forceMotion ?? false);
    surface.setPaused(request.paused ?? false);
    const record = { id: request.id, plane: request.plane };
    presentations.current.set(request.id, record);
    const current = () => presentations.current.get(request.id) === record && surfaceRef.current === surface;
    const requireCurrent = () => {
      if (!current()) throw new Error("Expression presentation is no longer available.");
    };
    if (request.plane === "frontstate") setFrontstateCount((count) => count + 1);
    return {
      id: request.id,
      plane: request.plane,
      update(recipe: string) {
        requireCurrent();
        surface.update(request.id, recipe);
      },
      updateConfig(config, sceneRef, selectedIds) { requireCurrent(); surface.presentConfig(request.id, config, sceneRef, selectedIds, request.appearance); },
      setContainer(container) {
        requireCurrent();
        surface.setContainer(request.id, container);
      },
      async ready() {
        requireCurrent();
        await surface.whenReady(request.id);
        requireCurrent();
      },
      play(sequence: string) {
        requireCurrent();
        return surface.play(request.id, sequence);
      },
      command(command) { requireCurrent(); surface.command(command); },
      setPaused(paused) { requireCurrent(); surface.setPaused(paused); },
      setForceMotion(force) { requireCurrent(); surface.setForceMotion(force); },
      capture(width, height) { requireCurrent(); return surface.capture(width, height); },
      telemetry() { requireCurrent(); return surface.telemetry(); },
      hitTest(x,y) {requireCurrent();return surface.hitTest(request.id,x,y);},
      release() {
        if (!current()) return;
        presentations.current.delete(request.id);
        if (request.plane === "frontstate") {
          setFrontstateCount((count) => Math.max(0, count - 1));
          setAvailabilityEpoch(epoch => epoch + 1);
        }
        surface.release(request.id);
        surface.setForceMotion(false);
        cuesRef.current?.refresh();
      },
    };
  }, [snapshot.enabled, surfaceError, surface, availabilityEpoch]);

  const retainedLease = useCallback((presentationId: string): StageRetainedLease | null => {
    if (!presentations.current.has(presentationId)) return null;
    const current = surfaceRef.current;
    if (!current) return null;
    const lease=current.retainedLease(presentationId);
    if(lease)retainedReservation.current=true;
    return lease;
  }, [surface]);

  const capture = useCallback((presentationId: string, width?: number, height?: number): HTMLCanvasElement => {
    if (!presentations.current.has(presentationId) || !surfaceRef.current) throw new Error("Expression presentation is unavailable for capture.");
    return surfaceRef.current.capture(width, height);
  }, []);

  // The engine surface exists exactly while the expression is enabled —
  // the master switch is absolute: off removes the canvas, the context
  // and the simulation entirely, and the engine module is loaded only on
  // the enabled path (the never-enabled path allocates nothing). Engine
  // failure surfaces and disposes; the next enable starts a fresh field
  // with an explicit reseed.
  useEffect(() => {
    if (!snapshot.enabled) {
      cuesRef.current?.dispose();cuesRef.current=null;
      surfaceRef.current?.dispose();
      surfaceRef.current = null;
      setSurface(null);
      setSurfaceError(null);
      presentations.current.clear();
      retainedReservation.current=false;
      setFrontstateCount(0);
      return;
    }
    if (surfaceRef.current) return;
    let cancelled = false;
    let created: EngineSurface | null = null;
    void Promise.all([import("./engineSurface"),import("./nativeCues")]).then(([{EngineSurface:Surface},{NativeCues}]) => {
      if (cancelled || surfaceRef.current) return;
      const fail=(message:string) => {
        setSurfaceError(message);
        cuesRef.current?.dispose();cuesRef.current=null;
        surfaceRef.current?.dispose();
        surfaceRef.current = null;
        setSurface(null);
        presentations.current.clear();
        retainedReservation.current=false;
        setFrontstateCount(0);
      };
      created = Surface.forWindow(fail);
      surfaceRef.current = created;
      cuesRef.current=new NativeCues(created,()=>++cueSerial.current,()=>presentations.current.size>0||retainedReservation.current,fail);
      setSurface(created);
    }).catch((cause: unknown) => {
      setSurfaceError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
      cuesRef.current?.dispose();cuesRef.current=null;
      created?.dispose();
      if (created && surfaceRef.current === created) {
        surfaceRef.current = null;
        setSurface(null);
        presentations.current.clear();
        retainedReservation.current=false;
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
    if (!frontstateCount) cuesRef.current?.refresh();
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
        const renderer = cuesRef.current, field = surfaceRef.current;
        const cues = renderer?.inspect();
        const telemetry = field?.telemetry() as {config?: {particleCount?: number}} | null;
        // This native receiver observes the window field, including a full
        // opening or foreground presentation. Cue-only scheduling would
        // incorrectly report an active foreground as an idle renderer.
        const report = cues && field ? { ...cues, frames: field.frameCount,
          pointCount: telemetry?.config?.particleCount ?? 0,
          scheduled: field.isScheduled, paused: field.isPaused } : null;
        void invoke("expression_walk_observation", { report })
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
    const renderer = cuesRef.current;
    if (!snapshot.enabled || !renderer) return null;
    const { target, ...rest } = options;
    if (target && !rest.rect) rest.rect = () => resolveExpressionTarget(target);
    return renderer.express(name, rest);
  }, [snapshot.enabled, surface]);

  const updateHandle = useCallback((handle: number | null, options: Partial<ExpressionOptions> & { name?: FormName; target?: string }): boolean => {
    const renderer = cuesRef.current;
    if (!renderer) return false;
    const { target, ...rest } = options;
    if (target && !rest.rect) rest.rect = () => resolveExpressionTarget(target);
    return renderer.update(handle, rest);
  }, []);

  const releaseHandle = useCallback((handle: number | null) => {
    cuesRef.current?.release(handle);
  }, []);

  /** The one live presentation — the surface presents at most one at a
   * time; a stale provider record cannot exist because release() removes it
   * from the same map. */
  const focusSelection = useCallback((selectedIds: string[]): boolean => {
    const surface = surfaceRef.current;
    const record = [...presentations.current.values()][0];
    if (!surface || !record) return false;
    try {
      surface.updateSelection(record.id, selectedIds);
      return true;
    } catch {
      // The presentation released between the lookup and the call — the
      // stage no longer stands; the caller names that honestly.
      return false;
    }
  }, []);

  const inspect = useCallback(() => ({
    presentations: [...presentations.current.values()].map((record) => ({ id: record.id, plane: record.plane })),
    engine: surface ? surface.capabilities() : null,
    /** The live presentation's selection (the stage's focus/highlight
     * decoration), as data. */
    selection: surface ? surface.selectionSnapshot() : [],
    /** Whether the window surface's own clock is held (lease pause law). */
    paused: surfaceRef.current ? surfaceRef.current.isPaused : null,
    /** The clock law, observable: a live presentation stands / a drawing
     * frame is scheduled / frames rendered so far. Idle desktop = live
     * false, scheduled false, frames stable. */
    live: surfaceRef.current ? surfaceRef.current.isLive : null,
    scheduled: surfaceRef.current ? surfaceRef.current.isScheduled : null,
    frames: surfaceRef.current ? surfaceRef.current.frameCount : null,
    /** ES5 lifecycle receipts: viewport suspension of the contained renderer
     * and the honest WebGL context-loss/recovery state. */
    suspended: surfaceRef.current ? surfaceRef.current.isSuspended : null,
    context: surfaceRef.current
      ? { lost: surfaceRef.current.isContextLost, recovery: surfaceRef.current.contextRecovery }
      : null,
    playback: surfaceRef.current?.inspectPlayback() ?? null,
    targets: expressionTargetIds(),
    cues: cueLog.current,
    overlay: cuesRef.current?.inspect() ?? null,
    retainedReservation:retainedReservation.current,
  }), [surface]);

  const api = useMemo<ExpressionStageApi>(() => ({
    present,
    retainedLease,
    capture,
    emit,
    express,
    update: updateHandle,
    release: releaseHandle,
    focusSelection,
    error: surfaceError,
    inspect,
  }), [present, retainedLease, capture, emit, express, updateHandle, releaseHandle, focusSelection, surfaceError, inspect]);

  return <StageContext.Provider value={api}>{children}</StageContext.Provider>;
}
