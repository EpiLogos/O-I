/**
 * The Technē HUD (owner wayfinder 2026-09-19, PR #387 §13) — the compact
 * persistent control strip of the deep cut, floating over the SAME living
 * field the Expressions cut shows. It replaces the physics-first controls
 * with knowledge/instrument controls; it is never a header over a second
 * application, never dashboard chrome — one thin row in the house grammar
 * (24×24 thin-stroke glyphs, oi-* tokens, no fills), plus the lens chooser
 * and the state/position line.
 *
 * Controls, in order: the Expressions ⇄ Technē cut switch (the one
 * immediate, reversible mode control); Interact/navigate and Select —
 * forwarded to the hosted application's own rail tools through the
 * host-command channel; Library, Search and Verso — dispatched to the
 * summon seam ("oi:techne-summon", T2 presents them); Face — the return to
 * the bare field (dismisses the active lens); source/open depth — the
 * material scene; the LENS CHOOSER; Epii summon; Lens Studio.
 *
 * Availability and honesty: the disclosure state is named exactly
 * (no subject / reading / unavailable with the owner's reason / read), a
 * lens whose standing refuses stays discoverable with the actual reason —
 * never a spinner, never a waiting pane — and the position readout shows
 * only what the hosted application actually reported.
 */
import {useId, type KeyboardEvent as ReactKeyboardEvent, type RefObject} from "react";
import {Glyph, type GlyphName} from "../workspace/Glyph";
import {postMessageToFrame, type HostedAppState, type HostedAppMode} from "../expressions/hostedApp";
import type {SurfaceBinding} from "../surface/types";
import type {TechneLens} from "./lensMount";
import {instrumentStanding, type TechneDisclosureState, type TechneInstrumentId, type TechneSubject} from "./techneReading";
import type {TechneCut} from "./dualMode";

/** The summon kinds the seam carries today (T2 presents them). */
export type TechneSummonKind = "library" | "verso" | "search";
/** The summon seam's event names (contract: TechneSurface dispatches
 * "oi:techne-summon" with detail {kind}; the presenting surface answers
 * "oi:techne-summon-closed" with the same kind when it closes). */
export const TECHNE_SUMMON_EVENT = "oi:techne-summon";
export const TECHNE_SUMMON_CLOSED_EVENT = "oi:techne-summon-closed";

export function dispatchTechneSummon(kind: TechneSummonKind) {
  window.dispatchEvent(new CustomEvent(TECHNE_SUMMON_EVENT, {detail: {kind}}));
}

export interface TechneHudProps {
  cut: TechneCut;
  onCut(cut: TechneCut): void;
  disclosure: TechneDisclosureState;
  subject?: TechneSubject;
  lenses: readonly TechneLens[];
  activeLens: TechneLens | undefined;
  onLens(lens: TechneLens | null): void;
  appState: HostedAppState | null;
  frameRef: RefObject<HTMLIFrameElement | null>;
  onSummon(kind: TechneSummonKind): void;
  depthOpen: boolean;
  onDepth(): void;
  studioOpen: boolean;
  onStudio(): void;
  epiiOpen: boolean;
  onEpii(): void;
}

const shortRevision = (revision: string) => revision.length > 12 ? `${revision.slice(0, 10)}…` : revision;

/** The one-line disclosure state, the four states kept distinct
 * (wayfinder §21) — the same wording grammar the arrangement has always
 * used, now carried by the HUD. */
function disclosureLine(disclosure: TechneDisclosureState): string {
  switch (disclosure.standing) {
    case "no-subject": return "no subject selected";
    case "reading": return "reading disclosure…";
    case "read": return `disclosure available${disclosure.reading.revision ? ` · ${shortRevision(disclosure.reading.revision)}` : ""}`;
    case "unavailable": return `QL reading unavailable: ${disclosure.reason}`;
  }
}

export function TechneHud({cut, onCut, disclosure, subject, lenses, activeLens, onLens, appState, frameRef, onSummon, depthOpen, onDepth, studioOpen, onStudio, epiiOpen, onEpii}: TechneHudProps) {
  const uid = useId();
  const tool = appState?.tool;
  const direct = (command: "interact" | "select") => postMessageToFrame(frameRef.current, {v: 1, kind: "host-command", command});

  // ---- the lens chooser's roving grammar (the tab bar's own keys) --------
  const onChooserKey = (event: ReactKeyboardEvent<HTMLElement>, index: number) => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.key === " ") return;
    const move = (to: number) => {
      event.preventDefault();
      const next = lenses[Math.min(lenses.length - 1, Math.max(0, to))];
      if (next) requestAnimationFrame(() => document.getElementById(`${uid}lens-${next.instrument}`)?.focus());
    };
    if (event.key === "ArrowRight" || event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(lenses.length - 1);
  };

  // The position readout: exactly what the hosted application reported —
  // an unreported facet stays absent (honest absence, never a guess).
  const position = appState
    ? [
        appState.document?.name ?? "an unnamed expression",
        typeof appState.sceneIndex === "number" && typeof appState.sceneCount === "number" && appState.sceneCount > 0
          ? `scene ${appState.sceneIndex + 1}/${appState.sceneCount}${appState.sceneName ? ` — ${appState.sceneName}` : ""}`
          : appState.sceneName ?? undefined,
        appState.sceneState ?? undefined,
        appState.selection?.length ? `selected: ${appState.selection.map(entry => entry.name ?? entry.id).join(", ")}` : undefined,
      ].filter(Boolean).join(" · ")
    : undefined;

  return <header className="tn-instruments tn-hud" role="toolbar" aria-label="Technē controls" data-cut={cut} data-disclosure={disclosure.standing}>
    {/* The cut switch — the one immediate, reversible mode control. */}
    <div className="tn-hud-switch" role="group" aria-label="Operating cut">
      <button type="button" data-cut="expressions" aria-pressed={cut === "expressions"}
        title="Expressions — the physics authoring cut of the same field"
        onClick={() => onCut("expressions")}><Glyph name="field" size={13}/><span>Expressions</span></button>
      <button type="button" data-cut="techne" aria-pressed={cut === "techne"}
        title="Technē — the deep investigative cut of the same field"
        onClick={() => onCut("techne")}><Glyph name="instrument" size={13}/><span>Technē</span></button>
    </div>
    <span className="tn-hud-rule" aria-hidden="true"/>
    {/* Direct modes — the application's own rail tools, driven through the
      * host-command channel; the field keeps its primary grammar. */}
    <button type="button" className="tn-hud-tool" data-command="interact" aria-pressed={tool === "interact"}
      title="Interact / navigate the living field" onClick={() => direct("interact")}><Glyph name="handoff" size={13}/></button>
    <button type="button" className="tn-hud-tool" data-command="select" aria-pressed={tool === "select"}
      title="Select on the living field" onClick={() => direct("select")}><Glyph name="inspect" size={13}/></button>
    <span className="tn-hud-rule" aria-hidden="true"/>
    {/* Summon seam — T2 presents Library / Search / verso through the
      * existing overlay/panel grammar; the HUD only asks. */}
    <button type="button" className="tn-hud-tool" title="Library — the collection as the map of the field"
      onClick={() => onSummon("library")}><Glyph name="list" size={13}/></button>
    <button type="button" className="tn-hud-tool" title="Search — discovery over the same refs"
      onClick={() => onSummon("search")}><Glyph name="search" size={13}/></button>
    <button type="button" className="tn-hud-tool" title="Verso — the subject's account and source depth"
      onClick={() => onSummon("verso")}><Glyph name="wiki" size={13}/></button>
    {/* Face: back to the bare field — dismissing the active lens. */}
    <button type="button" className="tn-hud-tool" title={activeLens ? `Return to the field (leave ${activeLens.label})` : "The field stands — no lens over it"}
      disabled={!activeLens} onClick={() => onLens(null)}><Glyph name="restore" size={13}/></button>
    <button type="button" className="tn-hud-tool" title={depthOpen ? "Close the source depth (the material scene)" : "Source / open depth — the material scene"}
      aria-pressed={depthOpen} onClick={onDepth}><Glyph name="material" size={13}/></button>
    {/* The position readout — what the application actually reported. */}
    <span className="tn-hud-position" data-reported={appState ? "true" : "false"} title={position ?? "The hosted application has not reported its position yet"}>
      {position ?? "position not reported yet"}
    </span>
    {/* The lens chooser — one compact rail; ONLY the active lens's body
      * mounts over the field. An empty registry states itself. */}
    <div className="tn-hud-lenses" role="group" aria-label="Technē lenses" data-count={lenses.length}>
      {lenses.length === 0 && <span className="tn-hud-lens-none" data-lenses="empty"
        title="No Technē lens is registered in this window — the instrument lanes bring M0′–M5′ through the lens mount.">
        no lenses registered yet
      </span>}
      {lenses.map((lens, index) => {
        const standing = lens.standing(disclosure);
        const disclosed = instrumentStanding(disclosure, lens.instrument as TechneInstrumentId);
        const isActive = activeLens?.instrument === lens.instrument;
        const reason = standing.reason ?? (disclosure.standing === "read" ? disclosed.reason ?? disclosed.degraded[0] : undefined);
        const label = `M${lens.mPrime}′ ${lens.label}`;
        return <button key={lens.instrument} id={`${uid}lens-${lens.instrument}`} type="button" role="button"
          className="tn-hud-tool tn-hud-lens" data-instrument={lens.instrument} data-active={isActive || undefined}
          data-available={disclosure.standing === "read" ? (standing.available && disclosed.available) || undefined : undefined}
          aria-pressed={isActive} tabIndex={isActive || index === 0 ? 0 : -1}
          title={reason ? `${label} — unavailable: ${reason}` : label}
          aria-label={label}
          onKeyDown={event => onChooserKey(event, index)}
          onClick={() => {
            if (isActive) { onLens(null); return; }
            if (disclosure.standing === "read" && !(standing.available && disclosed.available)) {
              // Discoverable, never fake: the refusal is the click's answer.
              onLens(null);
              return;
            }
            onLens(lens);
          }}><Glyph name={lens.glyph as GlyphName} size={13}/></button>;
      })}
    </div>
    <span className="tn-hud-rule" aria-hidden="true"/>
    {/* Epii summon: a summonable presence, never a permanent sidebar. */}
    <button type="button" className="tn-hud-tool" title={epiiOpen ? "Send Epii away" : "Summon Epii, the Technē depth agent"}
      aria-pressed={epiiOpen} onClick={onEpii}><Glyph name="agent" size={13}/></button>
    {/* Lens Studio: the floating panel hosting the active lens's controls. */}
    <button type="button" className="tn-hud-tool" title={studioOpen ? "Close Lens Studio" : "Open Lens Studio"}
      aria-pressed={studioOpen} disabled={!activeLens} onClick={onStudio}><Glyph name="studio" size={13}/></button>
    {/* The live disclosure line, carried at the strip's end. */}
    <span className="tn-hud-state oi-state" data-disclosure={disclosure.standing} title={`${disclosureLine(disclosure)}${subject?.title ? ` · subject ${subject.title}` : ""}`}>
      {disclosureLine(disclosure)}
    </span>
  </header>;
}

/** The small floating cut control of the EXPRESSIONS cut inside the Technē
 * surface: the app shows its full physics HUD exactly as the Expressions
 * centre shows it; this one thin control is the way back into the deep cut
 * (the switch is in the Technē HUD once there). */
export function TechneCutRecall({binding, onCut}: {binding: SurfaceBinding; onCut(mode: HostedAppMode): void}) {
  return <button type="button" className="tn-cut-recall" data-surface-id={binding.id}
    title="Technē — enter the deep investigative cut of this same field"
    onClick={() => onCut("techne")}><Glyph name="instrument" size={13}/><span>Technē</span></button>;
}
