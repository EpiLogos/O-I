/**
 * One owner-contributed setting as a friendly row (12-SETTINGS §2, §3.9):
 * the owner's title and description, its current value, and — when the
 * owner offers plan and apply — a control that STAGES the change. A setting
 * the page cannot change shows its value, a lock and the owning place
 * (S11); it never gets a disabled control. The owner's axes appear only
 * when they disagree.
 */
import {useEffect} from "react";
import {scopeProject, useScope} from "../../scope";
import type {ScopeAddress, SettingSpec} from "../../../configuration/contracts";
import {SettingControl} from "../../../configuration/SettingControl";
import {settingsActionable} from "../../../configuration/composition";
import {productName, reconciliationWord} from "../v2/vocabulary";
import {briefValue} from "../sectionModel";
import {defaultScope, resolutionKey, watchPair, type SettingEntry, type SettingsSnapshot} from "../settingsData";
import {settingRowId, stageSetting, stagedChanges, undoChange} from "../changeModel";
import {ReadOnly, Row} from "../rows";

/** The owner's file a native ref points at, when it is one (`~/.codex/config.toml [projects…]`). */
export function ownerFile(nativeRef: string | undefined): string | null {
  const first = nativeRef?.trim().split(/\s+/)[0] ?? "";
  return /^(~\/|\/)[^\s]+\.[a-z0-9]+$/i.test(first) ? first : null;
}

/** "Set in Codex's config" — the place that owns a read-only value. */
export function ownerPlace(entry: SettingEntry): string {
  const file = ownerFile(entry.setting.native_ref);
  const section = entry.sectionTitle;
  if (file) {
    const harness = /claude/i.test(file) ? "Claude Code" : /codex/i.test(file) ? "Codex" : /zcode/i.test(file) ? "ZCode" : productName(entry.owner.owner_ref);
    return `Set in ${harness}'s config`;
  }
  return `Set by ${productName(entry.owner.owner_ref)}${section ? ` · ${section}` : ""}`;
}

/** Where a row reads and stages: the owner's first allowed scope, with the
 * chosen project (the one scope, 10-SIDEBARS §3.6) or this machine's
 * workcell standing in when the owner names only the kind. */
export function addressFor(setting: SettingSpec, project: string | undefined): ScopeAddress {
  const scope = defaultScope(setting);
  if (scope.scope_ref || ["world", "ground", "machine"].includes(scope.scope_kind)) return scope;
  if (scope.scope_kind === "project") return {...scope, scope_ref: (project ?? "central").toLowerCase()};
  if (scope.scope_kind === "workcell") return {...scope, scope_ref: "local"};
  return scope;
}

export function valueWords(setting: SettingSpec, value: unknown): string {
  if (setting.value_schema.type === "secret") return value === undefined ? "not set" : "set";
  if (setting.value_schema.type === "boolean" && typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.length > 48) return "set";
  return briefValue(value);
}

export function ConfigSettingRow({entry, data, scope, title}: {entry: SettingEntry; data: SettingsSnapshot; scope?: ScopeAddress; title?: string}) {
  const {setting} = entry;
  const worldProject = scopeProject(useScope());
  const address = scope ?? addressFor(setting, worldProject);
  const key = resolutionKey(setting.setting_ref, address);
  const addressable = !!address.scope_ref || ["world", "ground", "machine"].includes(address.scope_kind);
  useEffect(() => { if (addressable) void watchPair(setting.setting_ref, address); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const resolution = data.resolutions[key];
  const native = resolution?.native.effective?.value ?? resolution?.native.declared?.value;
  const desired = resolution?.desired ?? null;
  const change = stagedChanges(data).find((candidate) => candidate.request?.setting_ref === setting.setting_ref && candidate.requestKey === resolutionKey(setting.setting_ref, address));
  const writable = setting.writable && setting.operations.plan && setting.operations.apply && settingsActionable(entry.owner)
    && entry.owner.document?.operations.plan.availability === "disclosed" && setting.value_schema.type !== "secret";
  const axes = resolution && resolution.native.declared?.value !== undefined && resolution.native.effective?.value !== undefined
    && JSON.stringify(resolution.native.declared.value) !== JSON.stringify(resolution.native.effective.value);
  const description = <>
    {setting.description}
    {axes && <span className="settings-axes"> Declared {briefValue(resolution!.native.declared!.value)} · in effect {briefValue(resolution!.native.effective!.value)}.</span>}
    {resolution && ["blocked", "unsupported", "unknown"].includes(resolution.reconciliation.status) && resolution.reconciliation.reason && <span className="settings-axes"> {resolution.reconciliation.reason}</span>}
  </>;
  const status = resolution?.reconciliation.status;
  return <Row id={settingRowId(setting.setting_ref)} title={title ?? setting.title} description={description} changed={!!change} onUndo={change ? () => void undoChange(change) : undefined} reconciliation={status}>
    {status && status !== "satisfied" && !change && <span className={`settings-chip is-${status}`} data-reconciliation-word title={resolution?.reconciliation.reason ?? undefined}>{reconciliationWord(status)}</span>}
    {writable
      ? <SettingControl schema={setting.value_schema} value={desired?.value !== undefined ? desired.value : native} hint={null}
          onCommit={(next) => void stageSetting({setting_ref: setting.setting_ref, scope: address, value: next.value, secret_reference: null})}/>
      : <ReadOnly value={resolution || !addressable ? valueWords(setting, native) : "Reading…"} place={ownerPlace(entry)} path={ownerFile(setting.native_ref)}/>}
  </Row>;
}
