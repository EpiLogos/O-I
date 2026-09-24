/**
 * AgentDetail — Purpose · Agent card · Sessions · Knowledge ·
 * History/learning. `agency_read` (kernel/types.ts:209/284) only ever
 * discloses `{definition:{id}, label?, agent_sessions:{purpose?}}`
 * (the shape EncounterList.tsx and SettingsPage.tsx already read), so
 * every section beyond Purpose/Sessions renders the honest
 * "Not disclosed by the owner reading" fallback rather than inventing
 * content the reading never carried.
 */
import type { ReactNode } from "react";
import type { AgencySessionRow } from "./agencyTypes";
import { LiveHumanAgentCard } from "./HumanAgentCard";

const NOT_DISCLOSED = "Not disclosed by the owner reading";

export function AgentDetail({ row, siblingSessions }: { row: AgencySessionRow; siblingSessions: AgencySessionRow[] }) {
  return <div className="agency-detail" aria-label={`Agent detail — ${row.purpose ?? row.sessionRef}`}>
    <header className="oi-context-head">
      <div>
        <h3 className="agency-detail-title">{row.purpose || row.spaceLabel || row.sessionRef}</h3>
        <div className="oi-ref-row">
          <span className="oi-ref">{row.sessionRef}</span>
          <span className="oi-state">SessionSpace {row.spaceRef}</span>
        </div>
      </div>
    </header>

    <DetailSection title="Purpose">
      {row.purpose ? <p className="oi-note">{row.purpose}</p> : <p className="oi-note">{NOT_DISCLOSED}</p>}
    </DetailSection>

    <DetailSection title="Agent card">
      {row.agentRef
        ? <LiveHumanAgentCard agentRef={row.agentRef}/>
        : <p className="oi-note">{NOT_DISCLOSED} — this session attachment names no canonical Agent (`agent_ref`), so no card can be derived for it.</p>}
    </DetailSection>

    <DetailSection title="Sessions">
      {siblingSessions.length > 0
        ? <ul className="agency-session-list">
            {siblingSessions.map((sibling) => (
              <li key={sibling.sessionRef} className="oi-row" aria-current={sibling.sessionRef === row.sessionRef ? "true" : undefined}>
                <span className="oi-ref">{sibling.sessionRef}</span>
                <span>{sibling.purpose || NOT_DISCLOSED}</span>
              </li>
            ))}
          </ul>
        : <p className="oi-note">{NOT_DISCLOSED}</p>}
    </DetailSection>

    <DetailSection title="Knowledge">
      <p className="oi-note">{NOT_DISCLOSED}</p>
    </DetailSection>

    <DetailSection title="History / learning">
      <p className="oi-note">{NOT_DISCLOSED}</p>
    </DetailSection>
  </div>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <details className="oi-disclosure agency-detail-section" open>
    <summary>{title}</summary>
    {children}
  </details>;
}
