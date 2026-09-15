/**
 * Shared render helpers for the Configuration/Profiles views.
 */
import type {ConfigResolution, ReconciliationStatus, SettingSpec} from "./contracts";
import {compactScope} from "./contracts";

/** Compact, honest value text. Structured values render as JSON — the
 * generic editor is where they become editable; here they are evidence. */
export function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value === "" ? "(empty)" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const STATUS_CLASS: Record<ReconciliationStatus, string> = {
  satisfied: "is-satisfied",
  drifted: "is-drifted",
  pending: "is-pending",
  blocked: "is-blocked",
  unsupported: "is-unsupported",
  unknown: "is-unknown",
};

/** The frozen reconciliation vocabulary (§7.1), styled from it — the six
 * statuses are exactly what the contract allows, nothing invented. */
export function ReconciliationChip({resolution}: {resolution: ConfigResolution}) {
  const {status, reason} = resolution.reconciliation;
  return <span
    className={`config-status ${STATUS_CLASS[status]}`}
    data-reconciliation={status}
    title={reason ?? status}
  >{status}</span>;
}

/** The native axes of one setting. Collapses to a single native value
 * while declared/effective/active agree; breaks out when they differ or
 * an owner stage is in flight. Secret kinds render presence/reference
 * only (§14). */
export function NativeAxesDisplay({resolution, secret}: {resolution: ConfigResolution; secret: boolean}) {
  const {declared, effective, active, staged} = resolution.native;
  const axes = [
    ["declared", declared?.value],
    ["effective", effective?.value],
    ["active", active?.value],
  ] as const;
  const present = axes.filter(([, value]) => value !== undefined);
  const allEqual = present.length > 0 && present.every(([, value]) => formatValue(value) === formatValue(present[0][1]));
  return <span className="config-native-axes">
    {present.length === 0 && <span className="config-muted">no native axes disclosed</span>}
    {present.length > 0 && (allEqual && !staged
      ? <span className="config-axis"><span className="config-axis-name">native</span><span className="config-mono">{secret ? `${formatValue(present[0][1])} (reference)` : formatValue(present[0][1])}</span></span>
      : present.map(([name, value]) => (
        <span className="config-axis" key={name}><span className="config-axis-name">{name}</span><span className="config-mono">{formatValue(value)}</span></span>
      )))}
    {staged && staged.stage_state !== "none" && (
      <span className="config-axis is-staged"><span className="config-axis-name">staged ({staged.stage_state})</span><span className="config-mono">{formatValue(staged.value)}</span></span>
    )}
  </span>;
}

/** One scope address as compact honest text. */
export function scopeText(scope: {scope_kind: string; scope_ref: string | null}): string {
  return compactScope(scope as never);
}

/** Whether the owner's named operation is disclosed and usable. */
export function operationUsable(setting: SettingSpec, operation: "validate" | "plan" | "apply" | "reset"): boolean {
  return setting.operations[operation];
}
