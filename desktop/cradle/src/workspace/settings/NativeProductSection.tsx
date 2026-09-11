/**
 * The native per-owner disclosure section (docs/cradle/
 * 07-WAVE-5-SYSTEM-CONTRIBUTION.md, 08-WAVE-5-CONSUMER-SEAM.md). Renders
 * the owner's own `oi.product-settings-disclosure/v2` document as a plain
 * settings list: one row per setting, its real current value. The
 * declared/effective/active/staged breakdown the contract carries only
 * surfaces when those values actually disagree — when they agree (the
 * ordinary case), a setting is just a name and a value, nothing more.
 * Owner refs, reading commands and materialisation ids are real but are
 * not settings; they stay in the record behind "Full record", not on the
 * page. Credential material (`kind: "secret"` / `"credential"`) shows only
 * whether a value is set, never the value.
 *
 * A position with no mounted descriptor is not this component's problem —
 * SettingsPage falls back to the existing P1 `ProductSection` for it, so a
 * position looks the same whether or not its owner has shipped yet.
 */
import type {ReactNode} from "react";
import type {
  Degradation,
  DisclosedAction,
  DisclosedSection,
  DisclosedSetting,
  OwnerMount,
} from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A short, single-line stand-in for a value too deep to lay out — used for
 * cells past the layout depth limit. */
function compactScalar(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value || "(empty)";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "none" : `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    return keys.length === 0 ? "empty" : `${keys.length} field${keys.length === 1 ? "" : "s"}`;
  }
  return String(value);
}

/** Would this value need real layout space (a table, a multi-field object),
 * or does it read fine inline (a scalar, a short chip list)? Decides
 * whether a row needs to collapse by default. */
function isBulky(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(item => isPlainObject(item) || Array.isArray(item));
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 1 && Array.isArray(entries[0][1])) return isBulky(entries[0][1]);
    return entries.length > 2;
  }
  return false;
}

/**
 * Lays a real value out as fields — owners disclose plain scalars, lists,
 * and small tables, in shapes this never guesses at beyond their actual
 * JSON type. A scalar is text; a list of scalars is a chip row; a list of
 * records is a table; an object is a field list. Depth is capped so a
 * deeply nested value degrades to a short summary instead of sprawling.
 */
function FieldValue({value, depth = 0}: {value: unknown; depth?: number}) {
  if (value === undefined || value === null) return <span className="is-muted">—</span>;
  if (typeof value === "string") return <>{value || "(empty)"}</>;
  if (typeof value === "number" || typeof value === "boolean") return <>{String(value)}</>;
  if (depth >= 2) return <span className="is-muted">{compactScalar(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="is-muted">none</span>;
    if (value.every(item => !isPlainObject(item) && !Array.isArray(item))) {
      return (
        <span className="native-chip-list">
          {value.map((item, index) => <span className="native-chip" key={index}>{String(item)}</span>)}
        </span>
      );
    }
    // `provenance` is the contract's own per-row bookkeeping (07 §3) — an
    // implementation detail, not a field of the setting itself.
    const columns = Array.from(new Set(value.flatMap(row => (isPlainObject(row) ? Object.keys(row) : [])))).filter(column => column !== "provenance");
    if (columns.length === 0) return <span className="is-muted">{value.length} items</span>;
    return (
      <table className="native-table">
        <thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {value.map((row, index) => (
            <tr key={index}>
              {columns.map(column => (
                <td key={column}>{isPlainObject(row) ? <FieldValue value={row[column]} depth={depth + 1} /> : null}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(([key]) => key !== "provenance");
    if (entries.length === 0) return <span className="is-muted">none</span>;
    if (entries.length === 1 && Array.isArray(entries[0][1])) return <FieldValue value={entries[0][1]} depth={depth} />;
    return (
      <dl className="native-inline-fields">
        {entries.map(([key, entryValue]) => (
          <div key={key} className="native-inline-field">
            <dt>{key}</dt>
            <dd><FieldValue value={entryValue} depth={depth + 1} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <>{String(value)}</>;
}

const ACTION_AVAILABILITY_NOTE: Partial<Record<DisclosedAction["availability"], string>> = {
  missing_native_obligation: "not available yet",
  unavailable: "unavailable",
};

type Axis = {value?: unknown; provenance?: unknown} | undefined;

function axisValue(axis: Axis, secret: boolean): ReactNode {
  if (secret) return axis && axis.value !== undefined ? "set" : "not set";
  return <FieldValue value={axis?.value} />;
}

const AXIS_LABEL: Record<string, string> = {declared: "Configured", effective: "Effective", active: "Active"};

/** Which owners to compare comes from the owner's own `drift` call, not a
 * value diff recomputed here: several owners deliberately carry a
 * different-shaped fact per axis (declared = what was authored, effective
 * = what that resolves to) with no drift between them, and a raw diff
 * would flag that as disagreement when the owner has already said "none". */
function SettingRow({setting}: {setting: DisclosedSetting}) {
  const secret = setting.kind === "secret" || setting.kind === "credential";
  const {declared, effective, active, staged, expected_effect: expectedEffect} = setting.axes;
  const axisByName: Record<string, Axis> = {declared, effective, active};
  const current = effective ?? declared ?? active;
  const staged_ = staged && staged.stage_state !== "none" ? staged : undefined;
  const drift = setting.drift;
  const flagged = drift?.state === "diverged" || drift?.state === "unknown";
  const compared = drift?.between?.filter(name => axisByName[name] !== undefined) ?? [];
  const needsBreakdown = (flagged && compared.length > 0) || !!staged_;

  if (!needsBreakdown) {
    const value = axisValue(current, secret);
    if (!secret && isBulky(current?.value)) {
      return (
        <details className="native-setting">
          <summary>
            <span className="native-setting-title">{setting.title}</span>
            <span className="native-setting-value">{compactScalar(current?.value)}</span>
          </summary>
          <div className="native-setting-detail">{value}</div>
          {setting.native_path && <p className="native-setting-path">{setting.native_path}</p>}
        </details>
      );
    }
    return (
      <div className="native-setting-row">
        <span className="native-setting-title">{setting.title}</span>
        <span className="native-setting-value">{value}</span>
      </div>
    );
  }

  const headline = secret ? axisValue(current, secret) : compactScalar(current?.value);
  return (
    <details className="native-setting">
      <summary>
        <span className="native-setting-title">{setting.title}</span>
        <span className="native-setting-value">{headline}</span>
        {drift?.state === "diverged" && <span className="native-drift is-diverged">differs</span>}
        {drift?.state === "unknown" && <span className="native-drift is-unknown">unclear</span>}
        {staged_ && <span className="native-drift is-staged">pending</span>}
      </summary>
      <dl className="native-axes">
        {compared.map(name => (
          <div className="native-axis-row" key={name}><dt>{AXIS_LABEL[name] ?? name}</dt><dd>{axisValue(axisByName[name], secret)}</dd></div>
        ))}
        {staged_ && (
          <div className="native-axis-row">
            <dt>Pending{staged_.stage_state !== "prepared" ? ` (${staged_.stage_state})` : ""}</dt>
            <dd>{axisValue(staged_, secret)}</dd>
          </div>
        )}
        {staged_ && expectedEffect?.summary && (
          <div className="native-axis-row"><dt>Takes effect</dt><dd>{expectedEffect.summary}</dd></div>
        )}
      </dl>
      {setting.native_path && <p className="native-setting-path">{setting.native_path}</p>}
    </details>
  );
}

function ActionRow({action}: {action: DisclosedAction}) {
  const exposure = action.exposure
    ? [action.exposure.ui && "UI", action.exposure.agent && "Agent", action.exposure.headless && "Headless"].filter(Boolean).join(" · ")
    : undefined;
  const note = ACTION_AVAILABILITY_NOTE[action.availability];
  return (
    <li>
      <strong>{action.title}</strong>
      {note && <span className={`product-action-availability is-${action.availability}`}>{note}</span>}
      {action.authority?.requires?.length ? <span className="native-action-meta">requires {action.authority.requires.join(", ")}</span> : null}
      {exposure && <span className="native-action-meta">{exposure}</span>}
      {action.unavailable_reason && <span className="product-action-note">{action.unavailable_reason}</span>}
    </li>
  );
}

function DegradationRow({degradation}: {degradation: Degradation}) {
  return (
    <p className="native-degradation">
      {degradation.subject_ref && <strong>{degradation.subject_ref}: </strong>}
      {degradation.state}
      {degradation.reason ? ` — ${degradation.reason}` : ""}
    </p>
  );
}

function SectionBlock({section}: {section: DisclosedSection}) {
  return (
    <div className="product-block">
      <h4>{section.title}</h4>
      {section.settings.length === 0 ? (
        <p className="product-empty">Nothing here yet.</p>
      ) : (
        <div className="native-settings">
          {section.settings.map(setting => <SettingRow key={setting.key} setting={setting} />)}
        </div>
      )}
    </div>
  );
}

/** One owner rendered natively — used in place of the P1 `ProductSection`
 * once its descriptor is mounted. `name` keeps the same house display name
 * P1 already uses, so a position reads the same whether it's native yet or
 * not. */
export function NativeProductSection({mount, name}: {mount: OwnerMount; name: string}) {
  const descriptor = mount.descriptor;
  if (!descriptor) return null;
  const {availability} = descriptor;
  const version = descriptor.owner.owner_version;
  return (
    <details className="product-section native-product-section">
      <summary>
        <strong>{name}</strong>
        <span className="native-owner-meta">
          {version && <span className="native-version">{version}</span>}
          <span className={`native-owner-availability is-${availability.state}`}>
            {availability.state}
            {availability.reason ? ` — ${availability.reason}` : ""}
          </span>
        </span>
      </summary>
      {descriptor.sections.map(section => <SectionBlock key={section.id} section={section} />)}
      <div className="product-block">
        <h4>Actions</h4>
        {descriptor.actions.length === 0 ? (
          <p className="product-empty">No operations here yet.</p>
        ) : (
          <ul className="product-actions">{descriptor.actions.map(action => <ActionRow key={action.action_ref} action={action} />)}</ul>
        )}
      </div>
      {descriptor.degradations && descriptor.degradations.length > 0 && (
        <details className="native-degradations">
          <summary>Degradations</summary>
          {descriptor.degradations.map((degradation, index) => <DegradationRow key={index} degradation={degradation} />)}
        </details>
      )}
      {descriptor.obligations && descriptor.obligations.length > 0 && (
        <details>
          <summary>Known gaps</summary>
          {descriptor.obligations.map((obligation, index) => <p key={index}>{obligation}</p>)}
        </details>
      )}
      <details className="product-raw">
        <summary>Full record</summary>
        <pre>{JSON.stringify(descriptor, null, 2)}</pre>
      </details>
    </details>
  );
}
