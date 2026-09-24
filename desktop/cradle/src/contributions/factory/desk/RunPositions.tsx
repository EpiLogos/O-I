/**
 * Live → Positions (11-FACTORY §3.4 "who is carrying it right now", with the
 * World-inhabitation amendment, WORLD-INHABITATION-V1 §3): the Positions
 * Factory holds in custody for this run, Factory's current work for each, and
 * the occupant relations Factory records per attempt — participant agent,
 * body (session, Workcell, harness · model), placement NOW and return
 * address. Every line is Factory's inhabitation reading (`factory development
 * inhabitation --run R`), with Positions named from Central's population by
 * ref. Factory holds no root/child NOW split: the NOW here is each attempt's
 * placement NOW; the Position's root and child NOW are the joined reading's
 * (Context → Prepared context). A failed read is one named line; a read that
 * names no Position says so. Nothing is inferred from agent names, pane
 * titles or the last attempt.
 */
import type {OccupantView, RunInhabitationView} from "../inhabitation/model";
import type {RunPageHost} from "./RunPage";
import {firstSentence, initials, refTail} from "./runModel";
import {useNowRecord} from "./nowRecord";

export function RunPositions({view, host}: {view: RunInhabitationView | undefined; host: RunPageHost}) {
  if (!view) return <p className="fpos-absence" data-positions="not-read">Positions on this run have not been read yet.</p>;
  if (view.state === "unavailable") return <p className="fpos-absence" role="status" data-positions="unavailable">Positions on this run couldn't be read — {view.reason} <small>({view.source})</small></p>;
  return <section className="fpos" aria-label="Positions on this run" data-positions="read">
    <h3 className="fagents-head">Positions</h3>
    {view.ambiguities.length > 0 && <p className="fpos-ambiguous" role="status" data-positions-ambiguous={view.ambiguities.length}>
      <span aria-hidden="true">? </span>{view.ambiguities.join("; ")}
    </p>}
    {view.positions.length === 0
      ? <p className="fpos-absence" data-positions-empty>Factory names no Position on this run.</p>
      : view.positions.map(position => <div key={position.positionRef} className="fpos-row" data-position={position.positionRef}>
        <span className="fdesk-avatar flive-avatar" aria-hidden="true">{initials(position.handle?.replace(/^@/, "") ?? position.name)}</span>
        <div className="fpos-who">
          <button type="button" className="fdesk-link fpos-name" onClick={() => host.onOpenObject?.({kind: "position", ref: position.positionRef, label: position.name})}>{position.name}</button>
          {position.handle && <small>{position.handle}</small>}
          <small data-position-custody>{position.custodyWords ? `custody: ${position.custodyWords}` : "no custody recorded"}</small>
          {position.work && <small data-position-work={position.work.outcome}>{position.work.words}</small>}
        </div>
        <div className="fpos-occupants">
          {position.occupants.length === 0
            ? <small data-position-occupants="none">No attempt on this run names this Position.</small>
            : position.occupants.map(occupant => <Occupant key={occupant.attemptRef} occupant={occupant} host={host}/>)}
        </div>
      </div>)}
    {view.unplaced.length > 0 && <div className="fpos-row" data-position="none">
      <span className="fdesk-avatar flive-avatar" aria-hidden="true">?</span>
      <div className="fpos-who"><strong>No Position</strong><small>attempts whose participant names no Position this run lists</small></div>
      <div className="fpos-occupants">{view.unplaced.map(occupant => <Occupant key={occupant.attemptRef} occupant={occupant} host={host}/>)}</div>
    </div>}
  </section>;
}

function Occupant({occupant, host}: {occupant: OccupantView; host: RunPageHost}) {
  return <div className="fpos-occupant" data-occupant-attempt={occupant.attemptRef} data-occupant-current={occupant.current ? "true" : "false"}>
    <span>{[occupant.current ? "current attempt" : "attempt", occupant.legStatus?.replace(/_/g, " "), occupant.agent, occupant.harnessModel, occupant.workcell ? `workcell ${occupant.workcell}` : undefined].filter(Boolean).join(" · ")}</span>
    {occupant.placementNow && <small>placement NOW · <NowWords address={occupant.placementNow} host={host}/></small>}
    {occupant.returnAddress && <small>returns to {occupant.returnAddress.startsWith("central:now:") ? <NowWords address={occupant.returnAddress} host={host}/> : refTail(occupant.returnAddress)}</small>}
    {occupant.notes.map(note => <small key={note}>{note}</small>)}
    {occupant.session && host.onOpenConversation && <button type="button" className="fdesk-link" onClick={() => host.onOpenConversation?.(occupant.session!)}>Open conversation</button>}
  </div>;
}

function NowWords({address, host}: {address: string; host: RunPageHost}) {
  const now = useNowRecord(address);
  const words = now.reading?.record.purpose ? firstSentence(now.reading.record.purpose) : now.state === "reading" ? "reading…" : now.state === "refused" ? `unreadable (${now.error})` : "the NOW record";
  return <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "now-record", ref: address})}>{words}</button>;
}
