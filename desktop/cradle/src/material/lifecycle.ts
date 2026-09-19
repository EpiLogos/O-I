/**
 * The material lifecycle adapter (workspace-continuity WF3; contract
 * `docs/experience/WORKSPACE-CONTINUITY.md` §5/§6, matrix C24/C25).
 *
 * The one surface kind's lifecycle pieces `MaterialSurface` needs, and
 * nothing more — no keep-alive framework, no second reader, no suspension
 * engine. Three small machines:
 *
 * - `useSuspensionDisclosure` — the off-screen observation (OS window
 *   hidden, ancestor pane `display:none` — the pane and park tiers keep
 *   content mounted behind exactly such containers) as DISCLOSURE only.
 *   §6's law: a retained HTML/Markdown/PDF/image view keeps its exact frame
 *   and its stable revision-bound source across conceal→reveal; hiding must
 *   never reassign the frame's source, remove `srcDoc`, drop an image
 *   `src`, or change the generation key. Only a committed replacement — a
 *   revision change or an explicit Reload — is a separate replacement
 *   operation.
 * - `advanceReadiness` / `useMaterialReadiness` — the generation-scoped
 *   readiness record. Every event carries its generation and a retired
 *   generation's event never lands (C25): a late load or a late message
 *   cannot clear a newer state, cannot claim the wrong revision ready, and
 *   a `ready` never clears a failure of the same generation. Beginning a
 *   new live generation — the committed replacement — is the only reset.
 *   A frame `load` is recorded beside readiness, never instead of it: an
 *   iframe load event alone does not prove content or application
 *   initialization, and the postMessage host handshake keeps its own
 *   token/generation/revision validation.
 * - the view/zoom preference record — the person's Rendered|Source choice
 *   and preview zoom, per binding id, in the same localStorage idiom as
 *   before (§6: restore the selected view across remount). Decoding is
 *   tolerant and total: an unusable record yields "nothing saved", so a
 *   first mount opens Rendered, the faithful default.
 */

import {useCallback,useRef,useState,useEffect,type RefObject} from "react";

// ---------------------------------------------------------------------------
// Suspension observation — disclosure, never destruction.

export interface SuspensionDisclosure {
  containerRef: RefObject<HTMLDivElement>;
  /** True while this surface is off screen: the OS window is hidden, or an
   * ancestor pane is `display:none` (maximize hides every other pane while
   * keeping its content mounted — the workbench's `GroupPane`; the mode-centre
   * park in `retention.tsx` holds its centres behind exactly such a layer).
   * A tab switch instead fully unmounts the material component, which releases
   * everything on its own — this hook never sees that transition.
   *
   * DISCLOSURE AND OPTIONAL-WORK GATING ONLY. Nothing that renders the
   * document may depend on it. `MaterialSurface` publishes it as
   * `data-suspended` for the retention tiers and the walks; it gates no
   * behaviour, because this surface owns no timers or loops of its own (the
   * page-context ticker is `PageContext`'s), and an honest "still live"
   * beats a false "suspended" (C24 never labels CSS hiding as execution
   * suspension). */
  suspended: boolean;
}

export function useSuspensionDisclosure(view: string): SuspensionDisclosure {
  const containerRef = useRef<HTMLDivElement>(null);
  const [intersecting, setIntersecting] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[entries.length - 1];
      if (entry) setIntersecting(entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [view]);
  useEffect(() => {
    const onVisibility = () => setDocumentVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return { containerRef, suspended: !intersecting || !documentVisible };
}

// ---------------------------------------------------------------------------
// Generation-scoped readiness.

export type Readiness = "loading" | "ready" | "failed";

export interface ReadinessRecord {
  /** The acquisition generation this record describes. A consumer renders
   * "its" state only while this equals the live generation, so the window
   * between a committed replacement and its first `begin` can never paint
   * the new generation's frame from the old record. */
  generation: number;
  readiness: Readiness;
  error?: string;
  /** The newest generation whose frame actually fired `load` — the host
   * handshake's real observation, kept strictly beside `readiness` (a frame
   * load never sets readiness, and readiness never claims a frame load). */
  frameLoaded: number;
}

export type ReadinessOutcome = {kind: "ready"} | {kind: "failed"; error: string};

export type ReadinessEvent =
  | {kind: "begin"; generation: number}
  | {kind: "observe"; generation: number; outcome: ReadinessOutcome}
  | {kind: "frame-loaded"; generation: number};

/** The whole readiness state machine, pure so node can prove it.
 * `liveGeneration` is the newest committed generation; `record` is what the
 * surface currently holds. Every event names its own generation and lands
 * only on the live one — the retired-generation guards are the whole C25
 * law. Unchanged inputs return the SAME record, so the React wrapper can
 * bail out of renders for free. */
export function advanceReadiness(liveGeneration: number, record: ReadinessRecord, event: ReadinessEvent): ReadinessRecord {
  switch (event.kind) {
    case "begin": {
      // A committed replacement (or a re-acquisition of the same generation —
      // a transport/epoch change) is the only writer allowed to move the
      // record backwards to loading. A retired begin never resets.
      if (event.generation !== liveGeneration) return record;
      if (record.generation === event.generation && record.readiness === "loading" && record.frameLoaded === -1) return record;
      return {generation: event.generation, readiness: "loading", frameLoaded: -1};
    }
    case "observe": {
      // C25: an observation from a retired generation never lands — it can
      // neither clear the live state nor claim a retired revision ready.
      if (event.generation !== liveGeneration || record.generation !== liveGeneration) return record;
      if (event.outcome.kind === "failed") return {...record, readiness: "failed", error: event.outcome.error};
      // A ready never clears a failure of the same generation, and a
      // double-ready is idempotent.
      if (record.readiness !== "loading") return record;
      return {...record, readiness: "ready", error: undefined};
    }
    case "frame-loaded": {
      if (event.generation !== liveGeneration || record.generation !== liveGeneration) return record;
      if (record.frameLoaded >= event.generation) return record;
      return {...record, frameLoaded: event.generation};
    }
  }
}

export interface MaterialReadiness {
  record: ReadinessRecord;
  /** Start the acquisition attempt for `generation` — the reset. */
  begin(generation: number): void;
  /** Record a real observation for `generation` (the acquisition's result). */
  observe(generation: number, outcome: ReadinessOutcome): void;
  /** The frame of `generation` fired `load`. */
  markFrameLoaded(generation: number): void;
}

/** The React wrapper: the record plus generation-bound writers. Each writer
 * closes over the generation of the render that produced it — the component
 * passes the generation from the same render, and the pure machine's guards
 * discard anything else. */
export function useMaterialReadiness(generation: number): MaterialReadiness {
  const [record, setRecord] = useState<ReadinessRecord>(() => ({generation, readiness: "loading", frameLoaded: -1}));
  const begin = useCallback((eventGeneration: number) => {
    setRecord(current => advanceReadiness(generation, current, {kind: "begin", generation: eventGeneration}));
  }, [generation]);
  const observe = useCallback((eventGeneration: number, outcome: ReadinessOutcome) => {
    setRecord(current => advanceReadiness(generation, current, {kind: "observe", generation: eventGeneration, outcome}));
  }, [generation]);
  const markFrameLoaded = useCallback((eventGeneration: number) => {
    setRecord(current => advanceReadiness(generation, current, {kind: "frame-loaded", generation: eventGeneration}));
  }, [generation]);
  return {record, begin, observe, markFrameLoaded};
}

// ---------------------------------------------------------------------------
// The persisted view record — Rendered|Source plus preview zoom, per binding.

export type MaterialView = "rendered" | "source";

export const MATERIAL_ZOOM_STEPS: readonly number[] = [.5, .75, 1, 1.25, 1.5, 2];

/** The same localStorage idiom the zoom key always used; now it carries the
 * person's view choice beside it. */
export function materialViewKey(bindingId: string): string {
  return `oi-cradle.material-view:${bindingId}`;
}

export interface MaterialViewPrefs { view: MaterialView; zoom: number }

export function encodeMaterialViewPrefs(prefs: MaterialViewPrefs): string {
  return JSON.stringify({view: prefs.view, zoom: prefs.zoom});
}

/** Tolerant decode: never throws, never guesses. An unusable record (corrupt
 * JSON, wrong shape, unknown view, off-scale zoom) contributes nothing, so
 * the caller's defaults hold — a first mount, or a damaged record, opens
 * Rendered. Restoration happens once, at mount; after that the person's own
 * toggles win and are persisted, so a restored choice is never imposed over
 * a newer explicit one. */
export function parseMaterialViewPrefs(raw: string | null): Partial<MaterialViewPrefs> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return {};
    const record = value as Record<string, unknown>;
    const prefs: Partial<MaterialViewPrefs> = {};
    if (record.view === "rendered" || record.view === "source") prefs.view = record.view;
    if (typeof record.zoom === "number" && MATERIAL_ZOOM_STEPS.includes(record.zoom)) prefs.zoom = record.zoom;
    return prefs;
  } catch {
    return {};
  }
}
