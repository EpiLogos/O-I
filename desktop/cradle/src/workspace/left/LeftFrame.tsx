/**
 * THE LEFT FRAME (10-SIDEBARS §3.1, law 1): one frame, changing body.
 *
 *   head   scope selector · (Epi-Logos lens chip) · search · + create
 *   body   the mode's body — or the Inbox while it is open
 *   foot   Inbox · Base Factory Expressions Technè │ Settings
 *
 * The head and the foot are fixed in every mode (L8: their boxes are
 * identical across a mode switch); only the body changes, cross-fading.
 * Scope is chosen ONLY in the scope menu (chooseScope, §3.6); the workspace
 * (how the screen is arranged) lives in the same menu's footer.
 */
import {useEffect, useId, useRef, useState, type ReactNode} from "react";
import {Glyph} from "../Glyph";
import {WorldModeStrip} from "../../surfaces/navigator/WorldNavigator";
import type {WorkspaceMode} from "../mode";
import type {Workspace} from "../store";
import {useKernel} from "../../kernel/KernelProvider";
import {kernelOp} from "../../kernel/bridge";
import {chooseScope, sameScope, scopeLabel, useFocusedProject, useScope, type Scope} from "../scope";
import {setLens, useEpiLens} from "../lens";
import {LeftHostProvider, type LeftHost} from "./host";
import {LeftModeContext} from "./rows";
import {useProjectMarks} from "./sessionMarks";
import {readConversations} from "./ChatRows";
import {sessionMarks} from "./sessionMarks";
import {ReceivingTray, inboxBadge, useInbox, type InboxRegister} from "../../receiving/ReceivingTray";
import "./left.css";

export interface LeftFrameProps {
  mode: WorkspaceMode;
  onMode: (mode: WorkspaceMode) => void;
  workspace: Workspace;
  workspaces: Workspace[];
  onActivateWorkspace: (id: string) => void;
  onNewWorkspace: () => void;
  onRenameWorkspace: () => void;
  onRecoverArrangement: () => void;
  host: LeftHost;
  body: ReactNode;
  /** A drill-through's way back (Library → reading → …): one control, in
   * the same place, while the trail holds a stop. */
  returnTo?: {mode: WorkspaceMode; label: string};
  onReturn?: () => void;
}

/** Close a popover on outside pointer, Escape (returning focus) or blur. */
function usePopover(): {open: boolean; setOpen: (value: boolean) => void; root: React.RefObject<HTMLDivElement>; trigger: React.RefObject<HTMLButtonElement>} {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", key, true); };
  }, [open]);
  return {open, setOpen, root, trigger};
}

const initial = (label: string) => (label.replace(/[^A-Za-z0-9]/g, "")[0] ?? "·").toUpperCase();

interface Machine {label: string; reachable?: boolean; state?: string}

/** The scope selector and its menu (§3.1, §3.6). */
function ScopeMenu({mode, workspace, workspaces, onActivateWorkspace, onNewWorkspace, onRenameWorkspace, onRecoverArrangement}: Omit<LeftFrameProps, "host" | "body" | "onMode" | "returnTo" | "onReturn">) {
  const kernel = useKernel();
  const scope = useScope();
  const focused = useFocusedProject();
  const lens = useEpiLens();
  const marks = useProjectMarks();
  const {open, setOpen, root, trigger} = usePopover();
  const [switching, setSwitching] = useState(false);
  const [machines, setMachines] = useState<Machine[]>();
  const menuId = useId();
  const reading = kernel.snapshot.navigator;
  const projects = reading?.root?.work.projects ?? [];
  const current = scopeLabel(scope);
  const scopeProject = scope.kind === "project" ? scope.project : undefined;
  // The chevron's dot: another project has news (working, needs you, unread).
  const news = Object.entries(marks).some(([project, row]) => project !== scopeProject && (row.working + row.needsYou + row.unread) > 0);
  // While the menu is open, take a census of every project's conversations
  // so the live marks it shows are real, not only the rows already on screen.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const releases: (() => void)[] = [];
    void Promise.all(projects.map(async project => {
      try {
        const rows = await readConversations(kernel.transport, project.name);
        if (live) for (const row of rows) releases.push(sessionMarks.watch(kernel.transport, {project: row.project, ref: row.ref}));
      } catch { /* an unreadable project carries no marks */ }
    }));
    // Remote machines: only a real read (Workcell's cross-cell connections)
    // earns the section; with none recorded the section is absent.
    void kernelOp(kernel.transport, {op: "workcell_status_read"}).then(result => {
      if (!live || result.outcome?.result !== "workcell_status_reading") return;
      const data = result.outcome.data as {connections?: {label?: string; connection?: string; state?: string; reachable?: boolean}[] | null};
      setMachines((data.connections ?? []).map(entry => ({label: entry.label ?? entry.connection ?? "Machine", state: entry.state, reachable: entry.reachable ?? (entry.state ? /connected|reachable|ready/i.test(entry.state) : undefined)})));
    }).catch(() => { if (live) setMachines(undefined); });
    return () => { live = false; for (const release of releases) release(); };
  }, [open, kernel.transport, projects.map(project => project.name).join("|")]);
  useEffect(() => { if (!open) setSwitching(false); }, [open]);
  const choose = (next: Scope) => { if (!sameScope(next, scope)) chooseScope(next); setOpen(false); trigger.current?.focus(); };
  return <div className="left-scope" ref={root}>
    <button ref={trigger} type="button" className="left-scope-trigger" aria-haspopup="true" aria-expanded={open} aria-controls={open ? menuId : undefined}
      aria-label={`Scope: ${current}${news ? " — another project has news" : ""}`} title={`Scope: ${current}`} onClick={() => setOpen(!open)}>
      <span className="left-scope-tile" aria-hidden="true">{initial(current)}</span>
      <span className="left-scope-name">{current}</span>
      <span className="left-scope-chevron" aria-hidden="true"><Glyph name="down" size={9}/>{news && <span className="left-news-dot" data-news="true"/>}</span>
    </button>
    {lens.on && <span className="left-lens-chip" role="status" aria-label="Epi-Logos lens is on">
      <span>Epi-Logos</span>
      <button type="button" aria-label="Leave the Epi-Logos lens" title="Leave the Epi-Logos lens" onClick={() => setLens(false)}><Glyph name="close" size={9}/></button>
    </span>}
    {open && <div id={menuId} className="left-scope-menu oi-menu oi-scroll-quiet" role="group" aria-label="Scope and workspace">
      {focused && focused !== scopeProject && <div className="left-menu-switch">
        <span>Focused tab is in <b>{focused}</b></span>
        <button type="button" className="left-menu-link" onClick={() => choose({kind: "project", project: focused})}>Switch</button>
      </div>}
      <span className="left-menu-eyebrow">Scope</span>
      <button type="button" className="oi-menu-item left-menu-scope" role="menuitemradio" aria-checked={scope.kind === "central"} onClick={() => choose({kind: "central"})}>
        <span className="left-scope-tile small" aria-hidden="true">C</span><span className="left-menu-label">Central</span>
      </button>
      <span className="left-menu-eyebrow">Work</span>
      {!reading?.root && <p className="left-reading" role="status">{reading?.error ? "Couldn't read Central." : "Reading Work…"}</p>}
      {projects.map(project => {
        const row = marks[project.name];
        return <button key={project.path} type="button" className="oi-menu-item left-menu-scope" role="menuitemradio" data-scope-project={project.name} aria-checked={scope.kind === "project" && scope.project === project.name} onClick={() => choose({kind: "project", project: project.name})}>
          <Glyph name="folder" size={13}/><span className="left-menu-label">{project.name}</span>
          <span className="left-menu-marks" aria-label={row ? [row.working ? `${row.working} working` : "", row.needsYou ? `${row.needsYou} need you` : ""].filter(Boolean).join(", ") || undefined : undefined}>
            {row?.needsYou ? <span className="left-mark-chip" data-mark="needs-you">! {row.needsYou}</span> : null}
            {row?.working ? <span className="left-mark-inline" data-mark="working"><span className="left-dot" aria-hidden="true"/>{row.working}</span> : null}
          </span>
        </button>;
      })}
      {mode === "factory" && <button type="button" className="oi-menu-item left-menu-scope" role="menuitemradio" aria-checked={scope.kind === "all"} onClick={() => choose({kind: "all"})}>
        <Glyph name="grid" size={13}/><span className="left-menu-label">All projects</span>
      </button>}
      {machines && machines.length > 0 && <>
        <span className="left-menu-eyebrow">Machines</span>
        {machines.map(machine => <div key={machine.label} className="left-menu-machine"><Glyph name="terminal" size={13}/><span className="left-menu-label">{machine.label}</span>{machine.reachable !== undefined && <span className="left-machine-state" data-reachable={machine.reachable}><span className="left-dot" aria-hidden="true"/>{machine.reachable ? "reachable" : "not reachable"}</span>}</div>)}
      </>}
      <hr/>
      <span className="left-menu-eyebrow">Workspace</span>
      <div className="left-menu-workspace">
        <Glyph name="columns" size={13}/><span className="left-menu-label">{workspace.name}</span>
        <button type="button" className="left-menu-link" aria-expanded={switching} onClick={() => setSwitching(value => !value)}>Switch…</button>
      </div>
      {switching && <div className="left-menu-workspaces" role="group" aria-label="Workspaces">
        {workspaces.map(entry => <button key={entry.id} type="button" className="oi-menu-item" role="menuitemradio" aria-checked={entry.id === workspace.id} onClick={() => { onActivateWorkspace(entry.id); setOpen(false); }}>{entry.name}</button>)}
      </div>}
      <div className="left-menu-actions">
        <button type="button" className="left-menu-link" onClick={() => { setOpen(false); onNewWorkspace(); }}>New</button><span aria-hidden="true">·</span>
        <button type="button" className="left-menu-link" onClick={() => { setOpen(false); onRenameWorkspace(); }}>Rename</button><span aria-hidden="true">·</span>
        <button type="button" className="left-menu-link" onClick={() => { setOpen(false); onRecoverArrangement(); }}>Recover arrangement</button>
      </div>
    </div>}
  </div>;
}

/** The one "+" create menu; its entries depend on the mode (§3.1). */
function CreateMenu({mode, host}: {mode: WorkspaceMode; host: LeftHost}) {
  const {open, setOpen, root, trigger} = usePopover();
  const entries: {label: string; glyph: Parameters<typeof Glyph>[0]["name"]; run?: () => void}[] = [
    {label: "New chat", glyph: "chat", run: host.onNewChat},
    {label: "New flow", glyph: "file", run: host.onNewFlow},
    ...(mode === "factory" ? [{label: "New run…", glyph: "play" as const, run: host.onNewRun}] : []),
    ...(mode === "expressions" ? [{label: "New Expression", glyph: "field" as const, run: host.onNewExpression}] : []),
  ];
  const agent = host.onNewAgent;
  const offered = entries.filter(entry => !!entry.run);
  if (!offered.length && !agent) return null;
  const run = (action?: () => void) => { setOpen(false); action?.(); };
  return <div className="left-create" ref={root}>
    <button ref={trigger} type="button" className="left-icon left-head-tool" aria-label="Create" title="Create" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Glyph name="plus" size={15}/></button>
    {open && <div className="left-create-menu oi-menu" role="menu" aria-label="Create">
      {offered.map(entry => <button key={entry.label} type="button" role="menuitem" className="oi-menu-item" onClick={() => run(entry.run)}><Glyph name={entry.glyph} size={13}/>{entry.label}</button>)}
      {agent && <><hr/><button type="button" role="menuitem" className="oi-menu-item" onClick={() => run(agent)}><Glyph name="agent" size={13}/>New agent…</button></>}
    </div>}
  </div>;
}

/** The fixed head. */
export function LeftHead(props: Omit<LeftFrameProps, "body" | "onMode">) {
  return <div className="left-head" data-left-head="true">
    <ScopeMenu {...props}/>
    <span className="left-head-tools">
      {props.host.onSearch && <button type="button" className="left-icon left-head-tool" aria-label="Search" title="Search (⌘K)" onClick={props.host.onSearch}><Glyph name="search" size={15}/></button>}
      <CreateMenu mode={props.mode} host={props.host}/>
    </span>
  </div>;
}

/** The fixed foot: Inbox, the mode strip, Settings. */
export function LeftFoot({mode, onMode, inboxOpen, onInbox, badge}: {mode: WorkspaceMode; onMode: (mode: WorkspaceMode) => void; inboxOpen: boolean; onInbox: () => void; badge?: string}) {
  return <div className="left-foot" data-left-foot="true">
    <button type="button" className="left-row left-destination left-inbox-row" aria-pressed={inboxOpen} aria-label={badge ? `Inbox, ${badge} waiting` : "Inbox"} onClick={onInbox}>
      <Glyph name="handoff" size={14}/><span className="left-row-label">Inbox</span>{badge && <span className="left-row-badge" data-inbox-badge={badge}>{badge}</span>}
    </button>
    <div className="world-system left-mode-row">
      <WorldModeStrip mode={mode} onMode={onMode}/>
      <span className="world-mode-separator" aria-hidden="true"/>
      <button type="button" className="world-system-settings" onClick={() => onMode("settings")} aria-pressed={mode === "settings"} aria-label="Settings" title="Settings"><Glyph name="settings" size={14}/></button>
    </div>
  </div>;
}

/** The whole frame. */
export function LeftFrame(props: LeftFrameProps) {
  const kernel = useKernel();
  const [inboxOpen, setInboxOpen] = useState(false);
  const projects = kernel.snapshot.navigator?.root?.work.projects ?? [];
  const registers: InboxRegister[] = [{label: "Central"}, ...projects.map(project => ({project: project.name, label: project.name}))];
  const inbox = useInbox(registers, 0);
  const badge = inboxBadge(inbox);
  // The mode's body returns when the mode changes (the Inbox is a place you
  // visit from any mode, not a mode of its own).
  const mode = props.mode;
  const entered = useRef(mode);
  useEffect(() => { if (entered.current !== mode) { entered.current = mode; setInboxOpen(false); } }, [mode]);
  return <LeftHostProvider host={props.host}>
    <LeftModeContext.Provider value={mode}>
      <div className="left-frame" data-left-frame="true" data-inbox-open={inboxOpen || undefined}>
        <LeftHead {...props}/>
        {props.returnTo && props.onReturn && <button type="button" className="left-return" onClick={props.onReturn} title={`Return to ${props.returnTo.label}`}><Glyph name="back" size={12}/><span>Return to {props.returnTo.label}</span></button>}
        <div className="left-body oi-scroll-quiet" data-left-body="true">
          {inboxOpen
            ? <div className="left-inbox-body"><ReceivingTray inbox={inbox} onOpenMaterial={props.host.onOpenInboxItem}/></div>
            : props.body}
        </div>
        <LeftFoot mode={mode} onMode={props.onMode} inboxOpen={inboxOpen} onInbox={() => { setInboxOpen(value => !value); inbox.reload(); }} badge={badge}/>
      </div>
    </LeftModeContext.Provider>
  </LeftHostProvider>;
}
