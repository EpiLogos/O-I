/**
 * Semantic expression cues — the Global Expression Stage's application
 * language (O:I-owned). Cues are lifecycle and surface facts ("the app is
 * opening", "this surface is loading", "a source was saved"), never visual
 * recipes: application code must not be able to say "set turbulence to
 * 1.8". Which scene answers a cue is a property of the published
 * Expression bindings, not of the emitter.
 *
 * The bus is a plain document-level CustomEvent so any layer — providers,
 * kernel effects, plain modules — can emit without context plumbing. The
 * stage provider relays local cues to the other native windows through the
 * Tauri event seam: "global" means one stage per window receiving the same
 * cue identity, never shared particle buffers.
 */

export type ExpressionCueKind =
  | "app.opening"
  | "app.ready"
  | "surface.loading"
  | "surface.ready"
  | "surface.opened"
  | "surface.closed"
  | "surface.resized"
  | "source.saved"
  | "attention";

export interface ExpressionCue {
  kind: ExpressionCueKind;
  /** A registered Expression Target id (or "viewport") the cue addresses. */
  target?: string;
  /** Truthful human label where the app already owns one (a loading
   * label, a boot detail). The stage may show it; it never invents one. */
  label?: string;
  detail?: string;
  /** Per-window monotonic sequence. */
  seq: number;
  /** Local emits versus cues relayed from another native window. */
  origin: "local" | "remote";
}

const CUE_EVENT = "oi:stage-cue";

const CUE_KINDS: readonly string[] = [
  "app.opening",
  "app.ready",
  "surface.loading",
  "surface.ready",
  "surface.opened",
  "surface.closed",
  "surface.resized",
  "source.saved",
  "attention",
];

let sequence = 0;

export function emitExpressionCue(cue: {
  kind: ExpressionCueKind;
  target?: string;
  label?: string;
  detail?: string;
}): ExpressionCue {
  const full: ExpressionCue = { ...cue, seq: ++sequence, origin: "local" };
  document.dispatchEvent(new CustomEvent<ExpressionCue>(CUE_EVENT, { detail: full }));
  return full;
}

export function onExpressionCue(listener: (cue: ExpressionCue) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<ExpressionCue>).detail);
  document.addEventListener(CUE_EVENT, handler);
  return () => document.removeEventListener(CUE_EVENT, handler);
}

/** Remote admission path (the stage provider only): a relayed cue is
 * re-dispatched locally as `origin: "remote"` so it can never be
 * re-relayed into a loop. Malformed payloads are ignored, not thrown. */
export function admitRemoteCue(cue: unknown) {
  if (!cue || typeof cue !== "object") return;
  const candidate = cue as Record<string, unknown>;
  if (typeof candidate.kind !== "string" || !CUE_KINDS.includes(candidate.kind)) return;
  if (typeof candidate.seq !== "number" || !Number.isFinite(candidate.seq)) return;
  const detail: ExpressionCue = {
    kind: candidate.kind as ExpressionCue["kind"],
    seq: candidate.seq,
    origin: "remote",
  };
  if (typeof candidate.target === "string") detail.target = candidate.target;
  if (typeof candidate.label === "string") detail.label = candidate.label;
  if (typeof candidate.detail === "string") detail.detail = candidate.detail;
  document.dispatchEvent(new CustomEvent<ExpressionCue>(CUE_EVENT, { detail }));
}

export { CUE_EVENT as EXPRESSION_CUE_EVENT };
