/**
 * Live → Positions (11-FACTORY §3.4 "who is carrying it right now", with the
 * World-inhabitation amendment, WORLD-INHABITATION-V1 §3): the Positions
 * Factory holds in custody for this run and the occupant relations Factory
 * already records — attempt participant, execution body, session, Workcell —
 * and the run's root and child NOW. Every line is Factory's inhabitation
 * reading (`factory development inhabitation --run R`); a failed read is one
 * named line, and a read that names no Position says so. Nothing is inferred
 * from agent names, pane titles or the last attempt.
 */
import type {RunInhabitationView} from "../inhabitation/model";
import type {RunPageHost} from "./RunPage";
import {firstSentence, initials} from "./runModel";
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
            ? <small data-position-occupants="none">No occupant relation recorded by Factory.</small>
            : position.occupants.map((occupant, index) => <div key={index} className="fpos-occupant" data-occupant-relation={occupant.relation}>
              <span>{[occupant.relation, occupant.agent, occupant.harnessModel, occupant.workcell ? `workcell ${occupant.workcell}` : undefined].filter(Boolean).join(" · ")}</span>
              {occupant.state && <small>{occupant.state}{occupant.reason ? ` — ${occupant.reason}` : ""}</small>}
              {occupant.session && host.onOpenConversation && <button type="button" className="fdesk-link" onClick={() => host.onOpenConversation?.(occupant.session!)}>Open conversation</button>}
            </div>)}
        </div>
      </div>)}
    {(view.rootNow || view.childNow) && <p className="flive-now" data-positions-now>
      NOW{view.rootNow && <> · root: <NowWords address={view.rootNow} host={host}/></>}{view.childNow && <> · child: <NowWords address={view.childNow} host={host}/></>}
    </p>}
  </section>;
}

function NowWords({address, host}: {address: string; host: RunPageHost}) {
  const now = useNowRecord(address);
  const words = now.reading?.record.purpose ? firstSentence(now.reading.record.purpose) : now.state === "reading" ? "reading…" : now.state === "refused" ? `unreadable (${now.error})` : "the NOW record";
  return <button type="button" className="fdesk-link" onClick={() => host.onOpenObject?.({kind: "now-record", ref: address})}>{words}</button>;
}
