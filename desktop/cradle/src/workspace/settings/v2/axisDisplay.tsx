/**
 * v2-local render of the native axes (the shared viewUtils keep the raw
 * axis words for the classic page): "Saved / In effect / Running now",
 * collapsing to one line while the product's own values agree.
 */
import type {ConfigResolution, ReconciliationStatus} from "../../../configuration/contracts";
import {compactScope} from "../../../configuration/contracts";
import {axisWord} from "./vocabulary";

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

export function reconciliationWord(status: ReconciliationStatus): string {
  const WORDS: Record<ReconciliationStatus, string> = {
    satisfied: "In sync",
    drifted: "Out of step",
    pending: "Staging",
    blocked: "Blocked",
    unsupported: "Not applicable",
    unknown: "Undetermined",
  };
  return WORDS[status] ?? status;
}

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
    {present.length === 0 && <span className="config-muted">no product-side values disclosed</span>}
    {present.length > 0 && (allEqual && !staged
      ? <span className="config-axis"><span className="config-axis-name">The product has</span><span className="config-mono">{secret ? `${formatValue(present[0][1])} (reference)` : formatValue(present[0][1])}</span></span>
      : present.map(([name, value]) => (
        <span className="config-axis" key={name}><span className="config-axis-name">{axisWord(name)}</span><span className="config-mono">{formatValue(value)}</span></span>
      )))}
    {staged && staged.stage_state !== "none" && (
      <span className="config-axis is-staged"><span className="config-axis-name">{axisWord("staged")}</span><span className="config-mono">{formatValue(staged.value)}</span></span>
    )}
  </span>;
}

/** Kept for parity with the shared helper; v2 rows use scopePhrase instead. */
export function scopeText(scope: {scope_kind: string; scope_ref: string | null}): string {
  return compactScope(scope as never);
}
