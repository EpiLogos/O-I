/**
 * Permissions (12-SETTINGS §3.7, Amendment A2).
 *
 *  - Default permission mode, per harness: rendered from AIKit's own
 *    configuration contribution when it carries the setting (only the modes
 *    each harness offers; Bypass needs a second click; staged like any
 *    change). Until the installed AIKit carries it, one sentence names the
 *    missing setting — no fake control. AIKit's setting
 *    (`ai-kit:permissions:permissions.default-mode`) is one table mapping a
 *    connection to a mode id its harness advertises; a harness says which
 *    modes it offers only in a live session, so each row offers exactly the
 *    modes that connection was seen offering (encounter/advertisedModes).
 *  - Trust and guardrails: the harnesses' own approval/trust rows, read-only
 *    with the owning place and Open file.
 *  - Environment import and trust keys, from AIKit's security posture.
 */
import {useEffect, useState} from "react";
import type {EnumOption, ScopeAddress} from "../../../configuration/contracts";
import {useScope, scopeProject} from "../../scope";
import {harnessName, permissionModeEntries, readyHarnesses, titleCase, trustEntries} from "../sectionModel";
export {permissionModeEntries, trustEntries};
import {defaultScope, refreshAll, resolutionKey, watchPair, type SettingEntry, type SettingsSnapshot} from "../settingsData";
import {settingRowId, stageSetting, stagedChanges, undoChange} from "../changeModel";
import {ConfigSettingRow} from "./ConfigRows";
import {Missing, ReadOnly, Reading, Row, Scrim, Unreadable} from "../rows";
import {advertisedModes, watchAdvertisedModes, type AdvertisedModes} from "../../../encounter/advertisedModes";

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
/** The design's word for a mode it names; any other keeps the harness's own name. */
const optionWord = (mode: {id: string; name: string}) => MODE_WORDS[mode.id.toLowerCase().replace(/[_\s]/g, "-")] ?? MODE_WORDS[mode.id.toLowerCase()] ?? mode.name;

/** Permission-mode settings in AIKit's contribution (any harness section
 * whose setting names a permission mode). */

function ModeRow({entry, data}: {entry: SettingEntry; data: SettingsSnapshot}) {
  const {setting} = entry;
  const scope = defaultScope(setting);
  useEffect(() => { void watchPair(setting.setting_ref, scope); }, [setting.setting_ref]); // eslint-disable-line react-hooks/exhaustive-deps
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

function useAdvertised(): AdvertisedModes[] {
  const [rows, setRows] = useState(advertisedModes);
  useEffect(() => watchAdvertisedModes(() => setRows(advertisedModes())), []);
  return rows;
}

function seenWhen(at: number): string {
  if (!at) return "";
  const minutes = Math.round((Date.now() - at) / 60000);
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : new Date(at).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"});
}

/** AIKit's one table setting: connection → one mode id that connection's
 * harness advertises. Each row is a connection this app has seen offering
 * modes (or one already named in the table); its choices are exactly what it
 * offered. Choosing "The harness's own default" removes the row's entry. */
function ModeTable({entry, data}: {entry: SettingEntry; data: SettingsSnapshot}) {
  const {setting} = entry;
  const scope = defaultScope(setting);
  useEffect(() => { void watchPair(setting.setting_ref, scope); }, [setting.setting_ref]); // eslint-disable-line react-hooks/exhaustive-deps
  const resolution = data.resolutions[resolutionKey(setting.setting_ref, scope)];
  const raw = resolution?.desired?.value ?? resolution?.native.effective?.value ?? resolution?.native.declared?.value;
  const table: Record<string, string> = raw && typeof raw === "object" && !Array.isArray(raw)
    ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((pair): pair is [string, string] => typeof pair[1] === "string")) : {};
  const seen = useAdvertised();
  const change = stagedChanges(data).find((candidate) => candidate.requestKey === resolutionKey(setting.setting_ref, scope));
  const [pendingBypass, setPendingBypass] = useState<{provider: string; label: string; mode: string} | null>(null);
  const rows = [...seen.filter((row) => row.modes.length > 0 || table[row.provider]),
    ...Object.keys(table).filter((provider) => !seen.some((row) => row.provider === provider)).map((provider): AdvertisedModes => ({provider, label: titleCase(provider), modes: [], seenAt: 0}))];
  const stage = (provider: string, mode: string) => {
    const next = {...table};
    if (mode) next[provider] = mode; else delete next[provider];
    void stageSetting({setting_ref: setting.setting_ref, scope: scope as ScopeAddress, value: next, secret_reference: null});
  };
  return <div className="settings-permission-table" role="group" aria-label={setting.title} data-permission-mode={setting.setting_ref}>
    {rows.length === 0 && <p className="settings-muted" data-permission-mode-empty>A harness names its permission modes when a session opens. Chat with one once, and the modes it offers appear here to choose from.</p>}
    {rows.map((row) => {
      const current = table[row.provider] ?? "";
      const offered = row.modes.some((mode) => mode.id === current);
      const description = row.seenAt
        ? `${row.modes.length ? row.modes.map(optionWord).join(" · ") : "Offers no permission modes"} — seen ${seenWhen(row.seenAt)} on ${row.provider}`
        : `Not seen offering modes in this app yet — ${row.provider}`;
      return <Row key={row.provider} id={`${settingRowId(setting.setting_ref)}:${row.provider}`} title={row.label} description={description}
        changed={!!change} onUndo={change ? () => void undoChange(change) : undefined}>
        <select className="settings-select" aria-label={`Default permission mode for ${row.label}`} data-permission-mode-harness={row.provider}
          value={pendingBypass?.provider === row.provider ? pendingBypass.mode : current}
          onChange={(event) => {
            const next = event.target.value;
            if (isBypass(next)) { setPendingBypass({provider: row.provider, label: row.label, mode: next}); return; }
            setPendingBypass(null);
            stage(row.provider, next);
          }}>
          <option value="">The harness's own default</option>
          {current && !offered && <option value={current}>{modeWord(current)} (not seen offered)</option>}
          {row.modes.map((mode) => <option key={mode.id} value={mode.id}>{optionWord(mode)}</option>)}
        </select>
      </Row>;
    })}
    {pendingBypass && <div className="settings-confirm-line" data-permission-bypass-confirm>
      <span>Bypass lets {pendingBypass.label} act without asking, in every new session. The composer can still switch one session back to Ask.</span>
      <button type="button" className="settings-button is-danger" onClick={() => { const next = pendingBypass; setPendingBypass(null); stage(next.provider, next.mode); }}>Stage Bypass</button>
      <button type="button" className="settings-button" onClick={() => setPendingBypass(null)}>Cancel</button>
    </div>}
  </div>;
}

const TRUST_TITLES: Record<string, string> = {
  "ai-kit:codex:projects.trust_level": "Codex trusts this project",
  "ai-kit:codex:home.trust_level": "Codex trusts your home folder",
  "ai-kit:claude-code:hooks.fs-guardrail": "Claude Code file guardrail",
  "ai-kit:zcode:hooks.fs-guardrail": "ZCode file guardrail",
};


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
    {open && <Scrim onDismiss={() => setOpen(false)}>
      <div className="settings-sheet oi-scroll-quiet" role="dialog" aria-modal="true" aria-label="Trust keys" data-trust-dialog>
        <header className="settings-sheet-head"><h2>Trust keys</h2><button type="button" className="settings-button" onClick={() => setOpen(false)}>Close</button></header>
        <div className="settings-sheet-body">
          <p>AIKit records a review decision for each skill revision it has seen: {counts.keys} in all.</p>
          <dl className="settings-facts">{Object.entries(counts.states).map(([state, count]) => <div key={state}><dt>{titleCase(state)}</dt><dd>{count}</dd></div>)}</dl>
          <p className="settings-muted">Decisions are recorded with `aikit trust`; the app shows them read-only.</p>
        </div>
      </div>
    </Scrim>}
  </>;
}

export function PermissionsSection({data}: {data: SettingsSnapshot}) {
  const scope = useScope();
  const project = (scopeProject(scope) ?? "central").toLowerCase();
  const trust = trustEntries(data);
  if (data.registry.state === "reading") return <Reading/>;
  if (data.registry.state === "failed") return <Unreadable error={data.registry.error} onRetry={() => void refreshAll()}/>;
  const modes = permissionModeEntries(data);
  const ready = data.suite.state === "ok" ? readyHarnesses(data.suite.value) : [];
  const posture = data.suite.state === "ok" && data.suite.value.disclosure.state === "ok" ? data.suite.value.disclosure.rows.posture : null;
  return <div className="settings-permissions" data-permissions-panel>
    <h3 className="settings-eyebrow">Default permission mode</h3>
    {modes.length > 0
      ? modes.map((entry) => entry.setting.value_schema.type === "table" && entry.setting.writable
        ? <ModeTable key={entry.setting.setting_ref} entry={entry} data={data}/>
        : <ModeRow key={entry.setting.setting_ref} entry={entry} data={data}/>)
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
