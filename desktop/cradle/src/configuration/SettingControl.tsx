/**
 * The generic setting control (docs/cradle/09-CONFIGURATION-PLANE.md §2.3,
 * #299 §11 generic rendering law): every ordinary control derives from the
 * owner's `value_schema` kind and nothing else —
 *
 *   boolean → switch · scalar/number/integer → typed input · enum → choice
 *   path → path field · reference → reference resolver · table/list →
 *   structured editor · secret → presence/reference + owner operation
 *
 * There is deliberately no product branch in this file: adding an ordinary
 * product setting must not require editing Desktop React code. Custom
 * presentation would be added only when a semantic shape genuinely
 * requires it — none does today.
 */
import {useState} from "react";
import type {ValueSchema} from "./contracts";

export interface SettingControlProps {
  schema: ValueSchema;
  /** The current committed value (desired if held, else undefined). */
  value: unknown;
  /** Secret reference when the schema is a secret kind. */
  secretReference?: {ref: string} | null;
  /** Presence fact for secret kinds — the owner's disclosure, never the
   * material (§14). */
  secretPresence?: boolean;
  disabled?: boolean;
  /** Where a suggested ref comes from (scope hints). */
  hint?: string | null;
  onCommit: (next: {value?: unknown; secret_reference?: {ref: string} | null}) => void;
}

export function SettingControl(props: SettingControlProps) {
  const {schema} = props;
  switch (schema.type) {
    case "boolean":
      return <BooleanControl {...props} schema={schema}/>;
    case "enum":
      return <EnumControl {...props} schema={schema}/>;
    case "number":
    case "integer":
      return <NumberControl {...props} schema={schema}/>;
    case "scalar":
    case "path":
      return <TextControl {...props} schema={schema}/>;
    case "reference":
      return <ReferenceControl {...props} schema={schema}/>;
    case "table":
      return <TableControl {...props} schema={schema}/>;
    case "list":
      return <ListControl {...props} schema={schema}/>;
    case "secret":
      return <SecretControl {...props} schema={schema}/>;
    default:
      // §15: unknown kinds never reach here in a conforming document (a
      // contribution with an unknown kind is invalid at revision 1); the
      // exhaustive switch makes the compiler prove we noticed when a kind
      // is added.
      return <span className="config-muted">undisclosed value shape</span>;
  }
}

function BooleanControl({value, disabled, onCommit}: SettingControlProps & {schema: ValueSchema & {type: "boolean"}}) {
  return <label className="config-switch">
    <input
      type="checkbox"
      role="switch"
      data-config-control="boolean"
      checked={value === true}
      disabled={disabled}
      onChange={(event) => onCommit({value: event.target.checked})}
    />
    <span>{value === true ? "on" : "off"}</span>
  </label>;
}

function EnumControl({schema, value, disabled, onCommit}: SettingControlProps & {schema: ValueSchema & {type: "enum"}}) {
  return <select
    className="config-input"
    data-config-control="enum"
    value={typeof value === "string" ? value : ""}
    disabled={disabled}
    onChange={(event) => onCommit({value: event.target.value})}
  >
    {!schema.options.some((option) => option.value === value) && <option value="">—</option>}
    {schema.options.map((option) => (
      <option key={option.value} value={option.value}>{option.title ?? option.value}</option>
    ))}
  </select>;
}

function NumberControl({schema, value, disabled, onCommit}: SettingControlProps & {schema: ValueSchema & {type: "number" | "integer"}}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? null : schema.type === "integer" ? Number.parseInt(draft, 10) : Number.parseFloat(draft);
  const commit = () => {
    if (draft !== null && Number.isFinite(parsed)) onCommit({value: parsed});
    setDraft(null);
  };
  return <input
    className="config-input"
    data-config-control={schema.type}
    type="number"
    step={schema.type === "integer" ? 1 : "any"}
    min={schema.minimum}
    max={schema.maximum}
    value={draft ?? (typeof value === "number" ? String(value) : "")}
    placeholder={schema.minimum !== undefined || schema.maximum !== undefined ? `${schema.minimum ?? "−∞"}…${schema.maximum ?? "∞"}` : undefined}
    disabled={disabled}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => {if (event.key === "Enter") commit();}}
  />;
}

function TextControl({schema, value, disabled, onCommit}: SettingControlProps & {schema: ValueSchema & {type: "scalar" | "path"}}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.length > 0) onCommit({value: draft});
    setDraft(null);
  };
  return <input
    className="config-input"
    data-config-control={schema.type}
    type="text"
    value={draft ?? (typeof value === "string" ? value : "")}
    placeholder={schema.format ?? (schema.type === "path" ? "path" : "value")}
    disabled={disabled}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => {if (event.key === "Enter") commit();}}
  />;
}

function ReferenceControl({schema, value, disabled, onCommit}: SettingControlProps & {schema: ValueSchema & {type: "reference"}}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.length > 0) onCommit({value: draft});
    setDraft(null);
  };
  return <span className="config-reference">
    <input
      className="config-input"
      data-config-control="reference"
      type="text"
      value={draft ?? (typeof value === "string" ? value : "")}
      placeholder={schema.subject_kind ? `resolve a ${schema.subject_kind}` : "owner reference"}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {if (event.key === "Enter") commit();}}
    />
    <span className="config-muted">native resolver</span>
  </span>;
}

/** Structured editor for tables (§2.3): columns come from the schema;
 * cells type by the column's declared type. */
function TableControl({schema, value, disabled, onCommit}: SettingControlProps & {schema: ValueSchema & {type: "table"}}) {
  const rows = Array.isArray(value) ? value as Record<string, unknown>[] : [];
  const update = (next: Record<string, unknown>[]) => onCommit({value: next});
  return <div className="config-structured" data-config-control="table">
    <table className="config-table">
      <thead><tr>{schema.columns.map((column) => <th key={column.name}>{column.name}</th>)}<th/></tr></thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {schema.columns.map((column) => (
              <td key={column.name}>
                <input
                  className="config-input"
                  type={column.type === "number" || column.type === "integer" ? "number" : "text"}
                  disabled={disabled}
                  value={typeof row[column.name] === "string" || typeof row[column.name] === "number" ? String(row[column.name]) : ""}
                  onChange={(event) => {
                    const next = rows.map((candidate, candidateIndex) => candidateIndex === index
                      ? {...candidate, [column.name]: column.type === "number" || column.type === "integer" ? Number(event.target.value) : event.target.value}
                      : candidate);
                    update(next);
                  }}
                />
              </td>
            ))}
            <td><button type="button" className="config-mini" disabled={disabled} onClick={() => update(rows.filter((_, candidateIndex) => candidateIndex !== index))}>remove</button></td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={schema.columns.length + 1} className="config-muted">no rows</td></tr>}
      </tbody>
    </table>
    <button type="button" className="config-mini" disabled={disabled}
      onClick={() => update([...rows, Object.fromEntries(schema.columns.map((column) => [column.name, ""]))])}>
      add row
    </button>
  </div>;
}

function ListControl({schema, value, disabled, onCommit}: SettingControlProps & {schema: ValueSchema & {type: "list"}}) {
  const items = Array.isArray(value) ? value as unknown[] : [];
  const itemType = schema.items?.type ?? "scalar";
  return <div className="config-structured" data-config-control="list">
    <ul className="config-list">
      {items.map((item, index) => (
        <li key={index}>
          <input
            className="config-input"
            type={itemType === "number" || itemType === "integer" ? "number" : "text"}
            disabled={disabled}
            value={typeof item === "string" || typeof item === "number" ? String(item) : JSON.stringify(item)}
            onChange={(event) => {
              const next = items.map((candidate, candidateIndex) => candidateIndex === index
                ? (itemType === "number" || itemType === "integer" ? Number(event.target.value) : event.target.value)
                : candidate);
              onCommit({value: next});
            }}
          />
          <button type="button" className="config-mini" disabled={disabled} onClick={() => onCommit({value: items.filter((_, candidateIndex) => candidateIndex !== index)})}>remove</button>
        </li>
      ))}
      {items.length === 0 && <li className="config-muted">no items</li>}
    </ul>
    <button type="button" className="config-mini" disabled={disabled} onClick={() => onCommit({value: [...items, itemType === "number" || itemType === "integer" ? 0 : ""]})}>add item</button>
  </div>;
}

/** §14: presence/reference + owner operation. There is no value field and
 * must never be one. */
function SecretControl({secretReference, secretPresence, disabled, hint, onCommit}: SettingControlProps & {schema: ValueSchema & {type: "secret"}}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) {
    return <span className="config-secret-edit">
      <input
        className="config-input"
        type="text"
        autoFocus
        placeholder={hint ?? "owner credential reference"}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && draft.trim()) {onCommit({secret_reference: {ref: draft.trim()}}); setEditing(false); setDraft("");}
          if (event.key === "Escape") {setEditing(false); setDraft("");}
        }}
      />
      <button type="button" className="config-mini" disabled={disabled || !draft.trim()} onClick={() => {onCommit({secret_reference: {ref: draft.trim()}}); setEditing(false); setDraft("");}}>point at reference</button>
      <button type="button" className="config-mini" onClick={() => {setEditing(false); setDraft("");}}>cancel</button>
    </span>;
  }
  return <span className="config-secret">
    <span className="config-mono">{secretReference?.ref ?? "no reference set"}</span>
    <span className={`config-chip ${secretPresence ? "is-present" : "is-absent"}`}>{secretPresence ? "present" : "not present"}</span>
    <button type="button" className="config-mini" disabled={disabled} onClick={() => setEditing(true)}>change reference…</button>
    <span className="config-muted">the credential itself is set through the owner's native mechanism</span>
  </span>;
}
