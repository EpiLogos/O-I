/**
 * The Global Expression Stage — O:I's owner-side expression contract. One
 * stage per native window (the field host underneath already enforces one
 * canvas, one scheduler, one simulation clock; every window runs the same
 * provider tree). The stage owns WHERE the expressive faculty sits in the
 * application — the presentation planes — and WHAT application events may
 * address it — semantic cues, targets and the form vocabulary. The
 * expression engine stays behind the present()/express() seam and owns
 * physics, scenes and rendering; when the upgraded native engine lands it
 * replaces the runtime inside this seam without changing the contract.
 *
 * Planes:
 *   ambient     — the resting altitude (--oi-z-expression): ink on the
 *                 content planes, never above dialogs or menus.
 *   overlay     — the forms renderer's own canvas over ordinary chrome
 *                 (--oi-z-stage-overlay), still under popovers.
 *   frontstate  — the opening/welcome ground (--oi-z-stage-frontstate).
 *                 While a frontstate presentation stands, the shared
 *                 field canvas is raised with it — at boot nothing else
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
import type { PointCloudHost } from "@epilogos/oi-design-system/point-cloud/host";
import { useVisuals } from "../visuals/ParticleExpression";
import { useKernel } from "../kernel/KernelProvider";
import {
  admitRemoteCue,
  emitExpressionCue,
  onExpressionCue,
  type ExpressionCue,
} from "./cues";
import { expressionTargetIds, resolveExpressionTarget } from "./targets";
import { stageRecipe, stageSequence } from "./recipes";

export type StagePlane = "ambient" | "overlay" | "frontstate";

export interface StagePresentationRequest {
  /** Stable presentation id — one live presentation per id. */
  id: string;
  plane: StagePlane;
  /** Authored recipe id (recipes.ts); application code never patches. */
  recipe: string;
  /** Registered Expression Target id; defaults to the viewport. */
  target?: string;
  paused?: boolean;
}

export interface StagePresentation {
  readonly id: string;
  readonly plane: StagePlane;
  /** Swap the presented recipe by id — never a remount, never a patch. */
  update(recipe: string): void;
  /** Play an authored sequence (recipes.ts) against this presentation. */
  play(sequence: string): void;
  release(): void;
}

export interface ExpressionStageApi {
  present(request: StagePresentationRequest): StagePresentation | null;
  /** Emit a semantic cue onto the bus (relayed cross-window in native). */
  emit(cue: { kind: ExpressionCue["kind"]; target?: string; label?: string; detail?: string }): void;
  /** The semantic form vocabulary (idle/listening/…), rendered on the
   * overlay plane. The options may address a registered target id. */
  express(name: string, options: ExpressionOptions & { target?: string }): number | null;
  update(handle: number | null, options: Partial<ExpressionOptions> & { name?: FormName; target?: string }): boolean;
  release(handle: number | null): void;
  /** Bounded dev/walk diagnostics: presentations, recent cues, and the
   * forms renderer's own counters. */
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
  instance: ReturnType<PointCloudHost["createInstance"]>;
  timers: ReturnType<typeof setTimeout>[];
}

export function ExpressionStageProvider({ children }: { children: ReactNode }) {
  const { host } = useVisuals();
  const kernel = useKernel();
  // The overlay-plane renderer is a window-lifetime singleton created on
  // first use (one per window is the renderer's own law); the ref is the
  // source of truth so the creating call can already serve requests.
  const overlayRef = useRef<ExpressionOverlay | null>(null);
  const [, markOverlayReady] = useState(0);
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

  const releaseRecord = useCallback((record: PresentationRecord) => {
    for (const timer of record.timers) clearTimeout(timer);
    record.timers.length = 0;
    if (record.plane === "frontstate") setFrontstateCount((count) => Math.max(0, count - 1));
    record.instance.release();
  }, []);

  const present = useCallback((request: StagePresentationRequest): StagePresentation | null => {
    if (!host || presentations.current.has(request.id)) return null;
    const recipe = stageRecipe(request.recipe);
    const targetRect = request.target
      ? () => resolveExpressionTarget(request.target)
      : null;
    const instance = host.createInstance({
      id: `stage:${request.id}`,
      tag: request.id,
      target: targetRect,
      config: recipe,
      // A target-bound presentation samples no pointer; window-scope
      // presentations sample the window passively (never capture).
      pointer: targetRect ? null : "window",
      paused: request.paused,
    });
    const record: PresentationRecord = {
      id: request.id,
      plane: request.plane,
      instance,
      timers: [],
    };
    presentations.current.set(request.id, record);
    if (request.plane === "frontstate") setFrontstateCount((count) => count + 1);
    return {
      id: request.id,
      plane: request.plane,
      update(nextRecipe: string) {
        instance.update(stageRecipe(nextRecipe));
      },
      play(sequenceId: string) {
        if (host.reducedMotion) return;
        for (const timer of record.timers) clearTimeout(timer);
        record.timers.length = 0;
        const { steps } = stageSequence(sequenceId);
        for (const step of steps) {
          record.timers.push(setTimeout(() => {
            instance.update(stageRecipe(step.recipe));
            if (step.disperse !== undefined) instance.disperse(0, 0, step.disperse);
          }, step.at));
        }
      },
      release() {
        if (presentations.current.get(request.id) !== record) return;
        presentations.current.delete(request.id);
        releaseRecord(record);
      },
    };
  }, [host, releaseRecord]);

  // The field host lives exactly while the expression is enabled; when it
  // goes (master switch, context loss) no stage presentation may outlive it.
  useEffect(() => {
    if (host) return;
    for (const record of presentations.current.values()) releaseRecord(record);
    presentations.current.clear();
    setFrontstateCount(0);
  }, [host, releaseRecord]);

  useEffect(() => () => {
    for (const record of presentations.current.values()) releaseRecord(record);
    presentations.current.clear();
  }, [releaseRecord]);

  // Frontstate altitude law: the shared field canvas is raised with the
  // frontstate plane while (and only while) a frontstate presentation
  // stands. Popovers and consent stay above by token altitude.
  useEffect(() => {
    if (!host) return;
    host.canvas.style.zIndex = frontstateCount > 0 ? "var(--oi-z-stage-frontstate)" : "";
    return () => { host.canvas.style.zIndex = ""; };
  }, [host, frontstateCount]);

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
    targets: expressionTargetIds(),
    cues: cueLog.current,
    overlay: overlayRef.current ? overlayRef.current.inspect() : null,
  }), []);

  const api = useMemo<ExpressionStageApi>(() => ({
    present,
    emit,
    express,
    update: updateHandle,
    release: releaseHandle,
    inspect,
  }), [present, emit, express, updateHandle, releaseHandle, inspect]);

  return <StageContext.Provider value={api}>{children}</StageContext.Provider>;
}
