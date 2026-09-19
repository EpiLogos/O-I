/**
 * AgencyRoster — a useful roster and current work, not a raw record form
 * (COMMON-BRIEF §handoff 3). Groups the real `agency_read` reading
 * (kernel/types.ts:209/284) by SessionSpace; sessions are the fastest
 * continuation route, so they lead. Selecting a row hands off to
 * AgentDetail (owned by AgencySurface, which holds selection).
 */
import { Glyph } from "../workspace/Glyph";
import { Loading } from "../shared/Loading";
import type { AgencyReading, AgencySessionRow } from "./agencyTypes";

export function AgencyRoster({
  reading,
  pending,
  error,
  selected,
  onSelect,
}: {
  reading: AgencyReading | null;
  pending: boolean;
  error: string | null;
  selected: AgencySessionRow | null;
  onSelect: (row: AgencySessionRow) => void;
}) {
  if (error) return <p className="oi-refusal" role="alert">{error}</p>;
  if (!reading) return <Loading label="Reading the project's SessionSpace agency…" scope="surface"/>;

  const bySpace = new Map<string, AgencySessionRow[]>();
  for (const row of reading.rows) {
    const list = bySpace.get(row.spaceRef) ?? [];
    list.push(row);
    bySpace.set(row.spaceRef, list);
  }

  if (reading.rows.length === 0) {
    return <div className="oi-empty">
      <strong>No attached sessions</strong>
      <p>Project {reading.projectRef} discloses no SessionSpace agent sessions right now. Mint an Agent, or attach an existing session from Factory/Encounter.</p>
    </div>;
  }

  return <div className="agency-roster" aria-label="Agent roster">
    {pending && <p className="oi-state">Refreshing — the last observed roster stays visible.</p>}
    {reading.observedAtUnixMs !== undefined && <p className="oi-state">Observed at {new Date(reading.observedAtUnixMs).toLocaleTimeString()}.</p>}
    {[...bySpace.entries()].map(([spaceRef, rows]) => (
      <section key={spaceRef} className="agency-space-group">
        <span className="oi-eyebrow">{rows[0].spaceLabel || spaceRef}</span>
        <ul className="agency-session-list">
          {rows.map((row) => (
            <li key={row.sessionRef}>
              <button
                type="button"
                className="oi-row agency-roster-row"
                aria-pressed={selected?.sessionRef === row.sessionRef}
                onClick={() => onSelect(row)}
              >
                <Glyph name="agent" size={13}/>
                <span className="agency-roster-row-title">{row.purpose || row.spaceLabel || row.sessionRef}</span>
                <span className="oi-state">continue session</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>;
}
