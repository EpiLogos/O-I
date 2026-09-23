/**
 * One owner-contributed setting as a friendly row (12-SETTINGS §2, §3.9):
 * the owner's title and description, its current value, and — when the
 * owner offers plan and apply — a control that STAGES the change. A setting
 * the page cannot change shows its value, a lock and the owning place
 * (S11); it never gets a disabled control. The owner's axes appear only
 * when they disagree.
 */
import type {ScopeAddress, SettingSpec} from "../../../configuration/contracts";
import {SettingControl} from "../../../configuration/SettingControl";
import {settingsActionable} from "../../../configuration/composition";
import {productName} from "../v2/vocabulary";
import {briefValue} from "../sectionModel";
import {defaultScope, resolutionKey, type SettingEntry, type SettingsSnapshot} from "../settingsData";
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

export function valueWords(setting: SettingSpec, value: unknown): string {
  if (setting.value_schema.type === "secret") return value === undefined ? "not set" : "set";
  if (setting.value_schema.type === "boolean" && typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.length > 48) return "set";
  return briefValue(value);
}

export function ConfigSettingRow({entry, data, scope, title}: {entry: SettingEntry; data: SettingsSnapshot; scope?: ScopeAddress; title?: string}) {
  const {setting} = entry;
  const address = scope ?? defaultScope(setting);
  const resolution = data.resolutions[resolutionKey(setting.setting_ref, address)];
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
  return <Row id={settingRowId(setting.setting_ref)} title={title ?? setting.title} description={description} changed={!!change} onUndo={change ? () => void undoChange(change) : undefined}>
    {writable
      ? <SettingControl schema={setting.value_schema} value={desired?.value !== undefined ? desired.value : native} hint={null}
          onCommit={(next) => void stageSetting({setting_ref: setting.setting_ref, scope: address, value: next.value, secret_reference: null})}/>
      : <ReadOnly value={valueWords(setting, native)} place={ownerPlace(entry)} path={ownerFile(setting.native_ref)}/>}
  </Row>;
}
