/**
 * Skills: skills as settings (12-SETTINGS §3.5). A scope switch (This
 * machine · This project · This session) maps to the writable
 * `skills.capabilities` scopes; skills group by source with counts; each row
 * has a switch, the name, its kind and a detail sheet. A switch STAGES a
 * real change (config_desired_hold on the capability toggle map at that
 * scope); the effect is "Next session only". A scope the owner will not
 * address from here says so in one sentence, in the owner's words.
 */
import {useEffect, useState, useSyncExternalStore} from "react";
import type {ScopeAddress} from "../../../configuration/contracts";
import {useScope, scopeProject, scopeLabel as scopeWord} from "../../scope";
import {groupSkills, skillParts, titleCase, type SkillItem} from "../sectionModel";
import {refreshAll, resolutionKey, watchSkillScope, type SettingsSnapshot} from "../settingsData";
import {CAPABILITIES_REF, skillRowId, stageSkill, stagedChanges, undoChange} from "../changeModel";
import {Missing, Reading, Unreadable} from "../rows";

export type SkillScope = "machine" | "project" | "session";
let skillScope: SkillScope = "machine";
const listeners = new Set<() => void>();
export function setSkillScope(next: SkillScope) { skillScope = next; for (const listener of [...listeners]) listener(); }
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function useSkillScope(): SkillScope { return useSyncExternalStore(subscribe, () => skillScope, () => skillScope); }

const SCOPES: {id: SkillScope; label: string}[] = [
  {id: "machine", label: "This machine"}, {id: "project", label: "This project"}, {id: "session", label: "This session"},
];

export function SkillScopeSwitch() {
  const current = useSkillScope();
  return <div className="settings-segment" role="radiogroup" aria-label="Where skill changes apply" data-skill-scope-switch>
    {SCOPES.map((scope) => <button key={scope.id} type="button" role="radio" aria-checked={current === scope.id} data-skill-scope={scope.id} onClick={() => setSkillScope(scope.id)}>{scope.label}</button>)}
  </div>;
}

/** The owner scope a switch position addresses (the project scope is
 * addressed by the chosen project's name; the owner says whether it is the
 * bound one). */
export function skillAddress(scope: SkillScope, project: string | undefined): ScopeAddress | null {
  if (scope === "machine") return {scope_kind: "machine", scope_ref: null};
  if (scope === "project") return {scope_kind: "project", scope_ref: (project ?? "central").toLowerCase()};
  return null;
}

function Toggle({on, label, onChange}: {on: boolean; label: string; onChange: (next: boolean) => void}) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="settings-switch" onClick={() => onChange(!on)}><span/></button>;
}

function DetailSheet({item, onClose}: {item: SkillItem; onClose: () => void}) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  return <div className="settings-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="settings-sheet" role="dialog" aria-modal="true" aria-label={item.name} data-skill-detail={item.id}>
      <header className="settings-sheet-head"><h2>{item.name}</h2><button type="button" className="settings-button" onClick={onClose}>Close</button></header>
      <div className="settings-sheet-body">
        <p>{item.description ?? "The skill discloses no description."}</p>
        <dl className="settings-facts">
          <div><dt>Source</dt><dd>{titleCase(item.source)}</dd></div>
          <div><dt>Kind</dt><dd>{item.kind}</dd></div>
          <div><dt>Now</dt><dd>{item.active ? "Active" : "Not active"}</dd></div>
          <div><dt>Name</dt><dd>{item.id}</dd></div>
        </dl>
        <p className="settings-muted">This skill declares no settings of its own.</p>
      </div>
    </div>
  </div>;
}

export function SkillsSection({data}: {data: SettingsSnapshot}) {
  const scope = useSkillScope();
  const worldScope = useScope();
  const project = scopeProject(worldScope);
  const address = skillAddress(scope, project);
  const [detail, setDetail] = useState<SkillItem | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (address) void watchSkillScope(address); }, [address?.scope_kind, address?.scope_ref]); // eslint-disable-line react-hooks/exhaustive-deps
  if (data.suite.state === "reading") return <Reading/>;
  if (data.suite.state === "failed") return <Unreadable error={data.suite.error} onRetry={() => void refreshAll()}/>;
  const facts = data.suite.value.disclosure.state === "ok" ? data.suite.value.disclosure.rows : null;
  if (!facts) return <Missing>Skills aren't disclosed here: {data.suite.value.disclosure.state === "absent" ? data.suite.value.disclosure.reason : ""}</Missing>;
  const resolution = address ? data.resolutions[resolutionKey(CAPABILITIES_REF, address)] : undefined;
  const held = resolution?.desired?.value && typeof resolution.desired.value === "object" && !Array.isArray(resolution.desired.value) ? resolution.desired.value as Record<string, boolean> : {};
  const writable = data.registry.state === "ok" && !!data.registry.value.index[CAPABILITIES_REF]?.setting.writable;
  const refused = resolution && ["blocked", "unsupported"].includes(resolution.reconciliation.status) ? resolution.reconciliation.reason : null;
  const items: SkillItem[] = facts.skills.map((skill) => {
    const parts = skillParts(skill.id);
    return {id: skill.id, name: skill.name || skill.id.split("/").pop() || skill.id, kind: facts.capabilities[skill.id]?.kind ?? parts.kind, source: parts.source, active: skill.active, description: facts.capabilities[skill.id]?.description ?? null};
  });
  const active = items.filter((item) => item.active).length;
  const groups = groupSkills(items);
  const changes = address ? stagedChanges(data).filter((change) => change.capability && change.capability.scope.scope_kind === address.scope_kind) : [];
  const canToggle = !!address && writable && !refused && !!resolution;
  const toggle = (item: SkillItem, next: boolean) => {
    if (!address) return;
    setError(null);
    void stageSkill(address, item.id, next).catch((cause) => setError(String(cause instanceof Error ? cause.message : cause)));
  };
  return <div className="settings-skills" data-skills-panel data-skill-scope-current={scope}>
    <p className="settings-muted" data-skills-summary>{active} of {items.length} active{project ? ` for ${scopeWord(worldScope)}` : ""}. Changes apply to the next session.</p>
    {scope === "session" && <Missing>AIKit changes a session's skills only from inside that session, so This session can't be changed from the app yet.</Missing>}
    {scope !== "session" && refused && <Missing>{scope === "project" ? "This project's skills can't be changed here yet" : "These skills can't be changed here"}: {refused}</Missing>}
    {scope !== "session" && !writable && data.registry.state === "ok" && <Missing>AIKit doesn't offer skill switches through its settings on this machine.</Missing>}
    {data.resolutionsState.state === "failed" && <p className="settings-inline-error" role="alert">{data.resolutionsState.error}</p>}
    {error && <p className="settings-inline-error" role="alert">{error}</p>}
    {groups.map(([source, list], index) => {
      const isOpen = open[source] ?? index < 2;
      return <section key={source} className="settings-group-block" data-skill-source={source}>
        <button type="button" className="settings-eyebrow settings-eyebrow-toggle" aria-expanded={isOpen} onClick={() => setOpen({...open, [source]: !isOpen})}>
          <span className="settings-caret" aria-hidden="true">›</span>{titleCase(source)} · {list.length}
        </button>
        {isOpen && list.map((item) => {
          const staged = Object.prototype.hasOwnProperty.call(held, item.id);
          const on = staged ? held[item.id] === true : item.active;
          const change = changes.find((candidate) => candidate.capability?.id === item.id);
          const rowId = address ? skillRowId(address, item.id) : `skill:${item.id}`;
          return <div key={item.id} className={`settings-skill${staged ? " is-changed" : ""}`} data-settings-row={rowId} data-skill-row data-skill={item.id} data-active={item.active ? "true" : "false"} data-changed={staged ? "true" : undefined}>
            {canToggle ? <Toggle on={on} label={`${item.name} ${on ? "on" : "off"}`} onChange={(next) => toggle(item, next)}/> : <span className={`settings-state-dot${item.active ? " is-on" : ""}`} aria-label={item.active ? "Active" : "Not active"}/>}
            <button type="button" className="settings-skill-name" onClick={() => setDetail(item)}>
              <strong>{item.name}</strong><span>{item.id.split("/").slice(0, 2).join("/")}/{item.id.split("/").slice(2).join("/")}</span>
            </button>
            <span className="settings-chip">{item.kind}</span>
            {staged && change && <button type="button" className="settings-undo" onClick={() => void undoChange(change)}>Undo</button>}
          </div>;
        })}
      </section>;
    })}
    <h3 className="settings-eyebrow">Skill sets</h3>
    <Missing>Turning skill sets on and off as groups needs AIKit to list its skill sets to the app (`aikit set list`), which it doesn't yet; the default sets are on the AIKit page.</Missing>
    {detail && <DetailSheet item={detail} onClose={() => setDetail(null)}/>}
  </div>;
}
