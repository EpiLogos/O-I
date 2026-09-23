/**
 * Permissions (12-SETTINGS §3.7, Amendment A2).
 *
 *  - Default permission mode, per harness: rendered from AIKit's own
 *    configuration contribution when it carries the setting (only the modes
 *    each harness offers; Bypass needs a second click; staged like any
 *    change). Until the installed AIKit carries it, one sentence names the
 *    missing setting — no fake control.
 *  - Trust and guardrails: the harnesses' own approval/trust rows, read-only
 *    with the owning place and Open file.
 *  - Environment import and trust keys, from AIKit's security posture.
 */
import {useEffect, useState} from "react";
import type {EnumOption, ScopeAddress} from "../../../configuration/contracts";
import {useScope, scopeProject} from "../../scope";
import {harnessName, readyHarnesses, titleCase} from "../sectionModel";
import {defaultScope, refreshAll, resolutionKey, watchPair, type SettingEntry, type SettingsSnapshot} from "../settingsData";
import {settingRowId, stageSetting, stagedChanges, undoChange} from "../changeModel";
import {ConfigSettingRow} from "./ConfigRows";
import {Missing, ReadOnly, Reading, Row, Unreadable} from "../rows";

const MODE_WORDS: Record<string, string> = {
  default: "Ask before acting", ask: "Ask before acting", "ask-before-acting": "Ask before acting",
  acceptedits: "Accept edits", "accept-edits": "Accept edits", plan: "Plan only", "plan-only": "Plan only",
  bypasspermissions: "Bypass permissions", bypass: "Bypass permissions", "bypass-permissions": "Bypass permissions",
};
export function modeWord(option: EnumOption | string): string {
  const value = typeof option === "string" ? option : option.value;
  return (typeof option !== "string" && option.title) || MODE_WORDS[value.toLowerCase().replace(/[_\s]/g, "-")] || MODE_WORDS[value.toLowerCase()] || titleCase(value);
}
const isBypass = (value: string) => /bypass/i.test(value);

/** Permission-mode settings in AIKit's contribution (any harness section
 * whose setting names a permission mode). */
export function permissionModeEntries(data: SettingsSnapshot): SettingEntry[] {
  if (data.registry.state !== "ok") return [];
  return data.registry.value.entries.filter((entry) => /permission/i.test(entry.setting.setting_ref) && /mode/i.test(entry.setting.setting_ref) && entry.setting.value_schema.type === "enum");
}

function ModeRow({entry, data}: {entry: SettingEntry; data: SettingsSnapshot}) {
  const {setting} = entry;
  const scope = defaultScope(setting);
  const resolution = data.resolutions[resolutionKey(setting.setting_ref, scope)];
  const current = (resolution?.desired?.value ?? resolution?.native.effective?.value ?? resolution?.native.declared?.value) as string | undefined;
  const options = setting.value_schema.type === "enum" ? setting.value_schema.options : [];
  const [pendingBypass, setPendingBypass] = useState<string | null>(null);
  const change = stagedChanges(data).find((candidate) => candidate.requestKey === resolutionKey(setting.setting_ref, scope));
  const harness = harnessName(setting.setting_ref.split(":")[1] ?? entry.sectionTitle);
  if (!setting.writable) return <ConfigSettingRow entry={entry} data={data} title={harness}/>;
  return <>
    <Row id={settingRowId(setting.setting_ref)} title={harness} description={options.map(modeWord).join(" · ")} changed={!!change} onUndo={change ? () => void undoChange(change) : undefined}>
      <select className="settings-select" aria-label={`Default permission mode for ${harness}`} data-permission-mode={setting.setting_ref} value={pendingBypass ?? current ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          if (isBypass(next)) { setPendingBypass(next); return; }
          setPendingBypass(null);
          void stageSetting({setting_ref: setting.setting_ref, scope: scope as ScopeAddress, value: next, secret_reference: null});
        }}>
        {current === undefined && <option value="" disabled>Not reported</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{modeWord(option)}</option>)}
      </select>
    </Row>
    {pendingBypass && <div className="settings-confirm-line" data-permission-bypass-confirm>
      <span>Bypass lets {harness} act without asking, in every new session. The composer can still switch one session back to Ask.</span>
      <button type="button" className="settings-button is-danger" onClick={() => { const next = pendingBypass; setPendingBypass(null); void stageSetting({setting_ref: setting.setting_ref, scope, value: next, secret_reference: null}); }}>Stage Bypass</button>
      <button type="button" className="settings-button" onClick={() => setPendingBypass(null)}>Cancel</button>
    </div>}
  </>;
}

const TRUST_TITLES: Record<string, string> = {
  "ai-kit:codex:projects.trust_level": "Codex trusts this project",
  "ai-kit:codex:home.trust_level": "Codex trusts your home folder",
  "ai-kit:claude-code:hooks.fs-guardrail": "Claude Code file guardrail",
  "ai-kit:zcode:hooks.fs-guardrail": "ZCode file guardrail",
};

export function trustEntries(data: SettingsSnapshot): SettingEntry[] {
  if (data.registry.state !== "ok") return [];
  const harnessSections = new Set(["claude-code", "codex", "zcode", "pi", "gemini", "hermes"]);
  return data.registry.value.entries.filter((entry) => entry.owner.owner_ref === "ai-kit" && harnessSections.has(entry.setting.setting_ref.split(":")[1] ?? "") && !/permission.*mode/i.test(entry.setting.setting_ref));
}

function TrustKeys({counts}: {counts: {keys: number; states: Record<string, number>}}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open]);
  const line = Object.entries(counts.states).map(([state, count]) => `${count} ${state}`).join(" · ");
  return <>
    <Row id="permissions:trust-keys" title="Trust keys" description={line}>
      <button type="button" className="settings-button" data-trust-review onClick={() => setOpen(true)}>Review…</button>
    </Row>
    {open && <div className="settings-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="settings-sheet" role="dialog" aria-modal="true" aria-label="Trust keys" data-trust-dialog>
        <header className="settings-sheet-head"><h2>Trust keys</h2><button type="button" className="settings-button" onClick={() => setOpen(false)}>Close</button></header>
        <div className="settings-sheet-body">
          <p>AIKit records a review decision for each skill revision it has seen: {counts.keys} in all.</p>
          <dl className="settings-facts">{Object.entries(counts.states).map(([state, count]) => <div key={state}><dt>{titleCase(state)}</dt><dd>{count}</dd></div>)}</dl>
          <p className="settings-muted">Decisions are recorded with `aikit trust`; the app shows them read-only.</p>
        </div>
      </div>
    </div>}
  </>;
}

export function PermissionsSection({data}: {data: SettingsSnapshot}) {
  const scope = useScope();
  const project = (scopeProject(scope) ?? "central").toLowerCase();
  const trust = trustEntries(data);
  useEffect(() => {
    for (const entry of trust) {
      const first = entry.setting.allowed_scopes[0];
      if (first?.scope_kind === "project" && !first.scope_ref) void watchPair(entry.setting.setting_ref, {scope_kind: "project", scope_ref: project});
    }
  }, [trust.length, project]); // eslint-disable-line react-hooks/exhaustive-deps
  if (data.registry.state === "reading") return <Reading/>;
  if (data.registry.state === "failed") return <Unreadable error={data.registry.error} onRetry={() => void refreshAll()}/>;
  const modes = permissionModeEntries(data);
  const ready = data.suite.state === "ok" ? readyHarnesses(data.suite.value) : [];
  const posture = data.suite.state === "ok" && data.suite.value.disclosure.state === "ok" ? data.suite.value.disclosure.rows.posture : null;
  return <div className="settings-permissions" data-permissions-panel>
    <h3 className="settings-eyebrow">Default permission mode</h3>
    {modes.length > 0
      ? modes.map((entry) => <ModeRow key={entry.setting.setting_ref} entry={entry} data={data}/>)
      : <Missing>Choosing a default permission mode for {ready.length ? ready.map((row) => harnessName(row.harness)).join(", ") : "each harness"} needs an AIKit setting that the installed AIKit doesn't have yet.</Missing>}
    <h3 className="settings-eyebrow">Trust and guardrails</h3>
    {trust.map((entry) => {
      const first = entry.setting.allowed_scopes[0];
      const address: ScopeAddress | undefined = first?.scope_kind === "project" && !first.scope_ref ? {scope_kind: "project", scope_ref: project} : undefined;
      return <ConfigSettingRow key={entry.setting.setting_ref} entry={entry} data={data} scope={address} title={TRUST_TITLES[entry.setting.setting_ref] ?? entry.setting.title}/>;
    })}
    {posture?.environmentImport && <Row id="permissions:environment-import" title="Import keys from the environment">
      <ReadOnly value={posture.environmentImport === "closed" ? "Closed" : titleCase(posture.environmentImport)} place="AIKit's security posture"/>
    </Row>}
    {posture?.trust && <TrustKeys counts={posture.trust}/>}
  </div>;
}
