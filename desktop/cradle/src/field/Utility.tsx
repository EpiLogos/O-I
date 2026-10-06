/**
 * The field's utility bar — how a person reaches the rest of the application from the field, without the old left frame.
 *
 * The field is Base's whole centre; the window's own left navigator is folded so it is not a second explorer, and a folded
 * region is inert. What a person still needs is small and constant, so it travels with the field the way the site carries its
 * rail: scope · modes · the companion · settings. Every verb is a host operation that already exists — the one scope
 * (`chooseScope`), the mode switch (`oi:enter-mode`), Settings (`oi:open-settings`), the Epi world (`setLens`) and the
 * companion's presence (`host.companion`) — plus the person's choice about the field in the companion's prepared context
 * (context/fieldContext.ts: off · follows the active locus · pinned). Nothing here owns state about any of them.
 */
import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {chooseScope, scopeLabel, useScope, type Scope} from "../workspace/scope";
import {setLens, useEpiLens} from "../workspace/lens";
import {MODE_CURATION, STRIP_MODES, type WorkspaceMode} from "../workspace/mode";
import {modesOffered, useProductPresence} from "../workspace/products";
import {fieldContextMode, setFieldContextMode, subscribeFieldContextMode, type FieldContextMode} from "../context/fieldContext";
import type {HostedHostContext} from "../contributions/contracts";
import {Icon} from "./icons";

type MenuId = "scope" | "modes" | "companion" | null;

export function FieldUtility({host, orientation}: {host?: HostedHostContext; orientation: "bar" | "rail"}) {
  const kernel = useKernel(), scope = useScope(), lens = useEpiLens();
  const presence = useProductPresence(kernel.transport);
  const ctxMode = useSyncExternalStore(subscribeFieldContextMode, fieldContextMode, fieldContextMode);
  const [open, setOpen] = useState<MenuId>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); } };
    document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", key, true); };
  }, [open]);
  const projects = kernel.snapshot.navigator?.root?.work.projects ?? [];
  const modes = modesOffered(STRIP_MODES, presence).filter(m => m !== "base" && m !== "settings");
  const companion = host?.companion, depth = companion?.depth ?? "collapsed";
  const here = (s: Scope) => (s.kind === scope.kind && (s.kind !== "project" || (scope.kind === "project" && s.project === scope.project)));
  const mode = (m: WorkspaceMode) => { setOpen(null); window.dispatchEvent(new CustomEvent("oi:enter-mode", {detail: {mode: m}})); };
  const item = (label: string, on: boolean, run: () => void, hint?: string) => (
    <button key={label} type="button" role="menuitemradio" aria-checked={on} className={`futil__item${on ? " is-on" : ""}`} onClick={run} title={hint}><i/><span>{label}</span></button>
  );
  const btn = (id: Exclude<MenuId, null>, icon: string, label: string, text?: string, pressed?: boolean) => (
    <button type="button" className={`ibtn futil__btn${pressed ? " is-on" : ""}`} aria-haspopup="menu" aria-expanded={open === id} aria-label={label} title={label} data-util={id} onClick={() => setOpen(open === id ? null : id)}>
      <Icon name={icon} size={orientation === "rail" ? 18 : 16}/>{text && orientation === "bar" ? <span className="futil__t">{text}</span> : null}
    </button>
  );
  return (
    <div className={`futil futil--${orientation}`} ref={root} role="toolbar" aria-label="Scope, modes, companion and settings">
      <div className="futil__slot">
        {btn("scope", "scope", `Scope: ${scopeLabel(scope)}`, scopeLabel(scope))}
        {open === "scope" ? (
          <div className="futil__menu" role="menu" aria-label="Scope">
            <p className="futil__h">Scope</p>
            {item("Central", here({kind: "central"}), () => { chooseScope({kind: "central"}); setOpen(null); })}
            {projects.map(p => item(p.name, here({kind: "project", project: p.name}), () => { chooseScope({kind: "project", project: p.name}); setOpen(null); }))}
            <p className="futil__h">World</p>
            {item("Epi-Logos", lens.on, () => { setLens(!lens.on); setOpen(null); }, "The Epi-Logos world: the essay, its Expressions and practices")}
          </div>
        ) : null}
      </div>
      <div className="futil__slot">
        {btn("modes", "modes", "Modes")}
        {open === "modes" ? (
          <div className="futil__menu" role="menu" aria-label="Modes">
            <p className="futil__h">Go to</p>
            {item(MODE_CURATION.base.label, true, () => setOpen(null), "You are here: the field is Central's own centre")}
            {modes.map(m => item(MODE_CURATION[m].label, false, () => mode(m), MODE_CURATION[m].hint))}
          </div>
        ) : null}
      </div>
      <div className="futil__slot">
        {btn("companion", "companion", `Companion${depth === "collapsed" || depth === "strip" ? "" : " (open)"}`, undefined, depth === "panel" || depth === "full")}
        {open === "companion" ? (
          <div className="futil__menu" role="menu" aria-label="Companion">
            <p className="futil__h">Companion</p>
            {!companion ? <p className="futil__note">The companion is not reachable from here in this host.</p> : <>
              {item("Summoned beside the field", depth === "panel", () => { companion.setDepth("panel"); setOpen(null); }, "Open the panel; the field keeps its place")}
              {item("Focused (full width)", depth === "full", () => { companion.setDepth("full"); setOpen(null); })}
              {item("Put away", depth === "collapsed" || depth === "strip", () => { companion.setDepth("collapsed"); setOpen(null); })}
            </>}
            <p className="futil__h">Its context</p>
            {(["off", "follow", "pin"] as FieldContextMode[]).map(m => item(m === "off" ? "The field is present, not prepared" : m === "follow" ? "Follows the active locus" : "Pinned at this moment", ctxMode === m, () => setFieldContextMode(m),
              m === "follow" ? "At each turn the prepared context carries the field's current main page, tangent and selection" : m === "pin" ? "The encounter as it stands now stays the prepared basis until you change it" : "Nothing from the field is prepared unless you choose it")) }
          </div>
        ) : null}
      </div>
      <span className="futil__spacer"/>
      <button type="button" className="ibtn futil__btn" aria-label="Settings" title="Settings" data-util="settings" onClick={() => window.dispatchEvent(new CustomEvent("oi:open-settings"))}><Icon name="settings" size={orientation === "rail" ? 18 : 16}/></button>
    </div>
  );
}
