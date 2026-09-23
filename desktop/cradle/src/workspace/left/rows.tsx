/**
 * The section and row grammar every left body is built from (10-SIDEBARS
 * §3.4): section headers with a remembered per-mode collapse, destination
 * rows, conversation rows with their REAL session marks, and the A6
 * open-where affordances. One grammar, so each body looks and behaves alike.
 *
 * Laws carried here:
 *  - no header without rows (R9: an empty optional section takes zero height);
 *  - loading is one quiet line in place of that branch's rows (R8);
 *  - a failed read says so and offers Retry, distinct from empty (R10);
 *  - last-known rows stay after a failed refresh, the header says "as of" (R11);
 *  - hover and focus never change a row's height (R7): the trailing actions
 *    live in space the row reserves at rest.
 */
import {createContext, useContext, useState, type ReactNode} from "react";
import {Glyph, type GlyphName} from "../Glyph";
import type {CentralLocation} from "../../kernel/types";
import {useKernel} from "../../kernel/KernelProvider";
import {LOCATION_DRAG_TYPE} from "../../files/drag";
import {formatRelativeTime} from "../../shared/relativeTime";
import {useLeftHost} from "./host";
import {useSessionMark, type RowMark, type SessionMark} from "./sessionMarks";
import type {EncounterRow} from "../../encounter/EncounterList";

/** The mode whose body is showing — collapse state is remembered per mode. */
export const LeftModeContext = createContext<string>("base");

const COLLAPSE_KEY = "oi-left-sections.v1";
function readCollapsed(): Record<string, Record<string, boolean>> {
  try { const raw = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "{}"); return raw && typeof raw === "object" ? raw : {}; } catch { return {}; }
}
function useCollapsed(id: string): [boolean, (value: boolean) => void] {
  const mode = useContext(LeftModeContext);
  const [collapsed, setCollapsed] = useState(() => readCollapsed()[mode]?.[id] === true);
  const [seenMode, setSeenMode] = useState(mode);
  if (seenMode !== mode) { setSeenMode(mode); setCollapsed(readCollapsed()[mode]?.[id] === true); }
  const write = (value: boolean) => {
    setCollapsed(value);
    try { const all = readCollapsed(); all[mode] = {...all[mode], [id]: value}; if (!value) delete all[mode][id]; localStorage.setItem(COLLAPSE_KEY, JSON.stringify(all)); } catch { /* a remembered collapse is a convenience */ }
  };
  return [collapsed, write];
}

export type SectionState =
  | {kind: "ready"; rows: number}
  | {kind: "loading"; what: string}
  | {kind: "error"; message: string; onRetry: () => void; reason?: string; detail?: string}
  /** Last-known rows kept after a failed refresh. */
  | {kind: "stale"; rows: number; since: number; onRetry?: () => void};

/** A section: eyebrow header (optional count, collapse chevron) over rows.
 * Renders NOTHING when a ready section has no rows (R9). */
export function Section({id, label, state, count, tools, children}: {id: string; label: string; state: SectionState; count?: number; tools?: ReactNode; children?: ReactNode}) {
  const [collapsed, setCollapsed] = useCollapsed(id);
  if (state.kind === "ready" && state.rows === 0) return null;
  const bodyId = `left-section-${id}`;
  return <section className="left-section" data-section={id} data-state={state.kind} aria-label={label}>
    <header className="left-section-head">
      <button type="button" className="left-section-toggle" aria-expanded={!collapsed} aria-controls={bodyId} onClick={() => setCollapsed(!collapsed)}>
        <span className="left-chevron" aria-hidden="true"><Glyph name="down" size={9}/></span>
        <span className="left-eyebrow">{label}</span>
        {count !== undefined && count > 0 && <span className="left-section-count">{count}</span>}
        {state.kind === "stale" && <span className="left-section-stale" title="The last refresh failed; these are the last rows read.">as of {formatRelativeTime(state.since).replace(/ ago$/, "")}</span>}
      </button>
      {state.kind === "stale" && state.onRetry && <button type="button" className="left-link left-section-retry" onClick={state.onRetry}>Retry</button>}
      {tools}
    </header>
    <div id={bodyId} className="left-section-body" hidden={collapsed || undefined}>
      {state.kind === "loading" ? <p className="left-reading" role="status">{state.what}</p>
        : state.kind === "error" ? <div className="left-error" role="alert" title={state.reason}><p>{state.message}</p>{state.detail && <p className="left-error-detail">{state.detail}</p>}<button type="button" className="oi-action" onClick={state.onRetry}>Retry</button></div>
        : children}
    </div>
  </section>;
}

/** Destination row (Central · Today · Library · Explore · Desk · Tasks). */
export function DestinationRow({glyph, label, selected, badge, onClick, ariaLabel, className}: {glyph: GlyphName; label: string; selected?: boolean; badge?: ReactNode; onClick: () => void; ariaLabel?: string; className?: string}) {
  return <button type="button" className={`left-row left-destination${className ? ` ${className}` : ""}`} aria-current={selected ? "true" : undefined} aria-label={ariaLabel ?? label} onClick={onClick}>
    <Glyph name={glyph} size={14}/><span className="left-row-label">{label}</span>{badge !== undefined && <span className="left-row-badge">{badge}</span>}
  </button>;
}

/** A6: the two subtle trailing icons on a row that opens material — Open
 * beside (the right panel's Context canvas) and Pop out (its own window).
 * Only routes the frame lends are shown. */
export function OpenWhere({location, label}: {location: CentralLocation; label: string}) {
  const host = useLeftHost();
  if (!host.onOpenBeside && !host.onPopOut) return null;
  const run = (action?: (location: CentralLocation) => Promise<void> | void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!action) return;
    void Promise.resolve(action(location)).catch(error => host.onMessage?.(String(error)));
  };
  return <span className="left-open-where">
    {host.onOpenBeside && <button type="button" className="left-icon" aria-label={`Open ${label} beside`} title="Open beside" onClick={run(host.onOpenBeside)}><Glyph name="columns" size={12}/></button>}
    {host.onPopOut && <button type="button" className="left-icon" aria-label={`Pop out ${label}`} title="Pop out" onClick={run(host.onPopOut)}><Glyph name="external" size={12}/></button>}
  </span>;
}

/** A material row (a flow, an intent document, a remembered note): plain
 * click opens it in the centre; draggable into the composer (R12). */
export function MaterialRow({location, label, glyph = "file", current, badge, onOpen, title}: {location: CentralLocation; label: string; glyph?: GlyphName; current?: boolean; badge?: ReactNode; onOpen?: () => void; title?: string}) {
  const host = useLeftHost();
  const open = onOpen ?? (() => { void Promise.resolve(host.onOpenFile?.(location)).catch(error => host.onMessage?.(String(error))); });
  return <div className="left-row left-material" data-file-path={location.path} aria-current={current ? "true" : undefined}>
    <button type="button" className="left-row-main" title={title ?? location.path} aria-label={label} aria-current={current ? "true" : undefined}
      draggable onDragStart={event => { event.dataTransfer.setData(LOCATION_DRAG_TYPE, JSON.stringify(location)); event.dataTransfer.setData("text/plain", location.path); event.dataTransfer.effectAllowed = "copyLink"; }}
      onClick={open}>
      <Glyph name={glyph} size={13}/><span className="left-row-label">{label}</span>{badge}
    </button>
    <OpenWhere location={location} label={label}/>
  </div>;
}

const MARK_LABEL: Record<RowMark, string> = {idle: "", working: "Working", "needs-you": "Needs you", unread: "Unread", failed: "Failed"};

/** The leading state mark (R2–R5); idle carries none (R1). */
export function MarkGlyph({mark, reason}: {mark?: RowMark; reason?: string}) {
  const state = mark ?? "idle";
  return <span className="left-mark" data-mark={state} aria-hidden="true" title={state === "failed" ? reason : undefined}>{state === "needs-you" ? "!" : state === "failed" ? "×" : ""}</span>;
}

/** Aggregate marks on a project row: ● working, ! n needs you. */
export function ProjectMarkBadges({working, needsYou}: {working: number; needsYou: number}) {
  if (!working && !needsYou) return null;
  return <span className="left-project-marks" aria-label={[working ? `${working} working` : "", needsYou ? `${needsYou} need${needsYou === 1 ? "s" : ""} you` : ""].filter(Boolean).join(", ")}>
    {needsYou > 0 && <span className="left-mark-chip" data-mark="needs-you">!{needsYou > 1 ? ` ${needsYou}` : ""}</span>}
    {working > 0 && <span className="left-mark-inline" data-mark="working"><span className="left-dot" aria-hidden="true"/>{working}</span>}
  </span>;
}

/** A conversation row (v2 §2): line 1 kind · agent and a relative time; the
 * full native title clamped to two lines; the leading mark from the REAL
 * session state; "…" on hover/focus holding only real actions. */
export function ConversationRow({row, kind = "Chat", current, onOpen}: {row: EncounterRow; kind?: string; current?: boolean; onOpen?: (row: EncounterRow) => void}) {
  const host = useLeftHost();
  const kernel = useKernel();
  const mark: SessionMark | undefined = useSessionMark(kernel.transport, {project: row.project, ref: row.ref}, !!current);
  const state = mark?.mark ?? "idle";
  const [menu, setMenu] = useState(false);
  const open = onOpen ?? ((value: EncounterRow) => { void Promise.resolve(host.onOpenChat?.(value)).catch(error => host.onMessage?.(String(error))); });
  const stateWords = MARK_LABEL[state];
  const accessible = `${row.title}${stateWords ? ` — ${stateWords}` : ""}${state === "failed" && mark?.reason ? `: ${mark.reason}` : ""}`;
  const when = mark?.changedAt ? formatRelativeTime(mark.changedAt).replace(/ ago$/, "") : undefined;
  return <div className="left-row left-conversation" data-mark={state} data-session-ref={row.ref} aria-current={current ? "true" : undefined}>
    <button type="button" className="left-row-main" aria-label={accessible} title={state === "failed" && mark?.reason ? `${row.title}\n${mark.reason}` : row.title} aria-current={current ? "true" : undefined}
      draggable onDragStart={event => { event.dataTransfer.setData("application/x-oi-encounter", JSON.stringify(row)); event.dataTransfer.setData("text/plain", row.title); event.dataTransfer.effectAllowed = "copyLink"; }}
      onClick={() => open(row)}>
      <MarkGlyph mark={state} reason={mark?.reason}/>
      <span className="left-conversation-meta"><span className="left-conversation-kind">{kind}{mark?.agent ? ` · ${mark.agent}` : ""}</span>{state === "unread" && <span className="left-dot left-unread-dot" aria-hidden="true"/>}{when && <time>{when}</time>}</span>
      <span className="left-conversation-title">{row.title}</span>
    </button>
    {host.onOpenChatInCentre && <span className="left-row-more">
      <button type="button" className="left-icon" aria-label={`Actions for ${row.title}`} aria-haspopup="menu" aria-expanded={menu} onClick={event => { event.stopPropagation(); setMenu(value => !value); }} onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) setMenu(false); }}><Glyph name="more" size={12}/></button>
      {menu && <span className="left-row-menu oi-menu" role="menu">
        <button type="button" role="menuitem" className="oi-menu-item" onClick={() => { setMenu(false); void Promise.resolve(host.onOpenChatInCentre?.(row)).catch(error => host.onMessage?.(String(error))); }}>Open in centre</button>
      </span>}
    </span>}
  </div>;
}
