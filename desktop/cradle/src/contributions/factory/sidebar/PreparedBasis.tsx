/**
 * Context → Prepared context (WORLD-INHABITATION-V1 §4): the nested basis the
 * occupant of the run's Position is prepared from — AIKit's Refocus chain
 * (current operation ← workflow unit ← attempt/Run ← Journey/Commission ←
 * Project intent ← ProjectCentral ground; each hop a ref or a gap in the
 * owner's words) and the joined reading's prepared context with its root
 * and child NOW (`value.now_ref`). The Position is the one Factory names
 * on the selected run; several are a choice the person makes, never the
 * first; none (or an unreadable Factory reading) is said. Each owner read
 * that fails is one named line — the basis is never assembled from intent
 * files or guessed from the run.
 */
import {useEffect, useState} from "react";
import {useKernel} from "../../../kernel/KernelProvider";
import {openObject} from "../../../agent/objects";
import type {RunEntry} from "../desk/deskStore";
import {firstSentence} from "../desk/runModel";
import {useNowRecord} from "../desk/nowRecord";
import {preparedBasis, refocusChain, type InhabitationReading, type OwnerRead, type RefocusReading} from "../inhabitation/model";
import {readRefocus, readWhoami} from "../inhabitation/reads";

export function PreparedBasis({entry, project}: {entry: RunEntry; project?: string}) {
  const view = entry.inhabitation;
  const positions = view?.state === "read" ? view.positions : [];
  const [chosen, setChosen] = useState<string>();
  const position = positions.length === 1 ? positions[0] : positions.find(item => item.positionRef === chosen);
  return <section aria-label="Prepared context" data-prepared-basis>
    <h3 className="fagents-head">Prepared context</h3>
    {!view && <p className="fslice-note">The run's Positions have not been read yet.</p>}
    {view?.state === "unavailable" && <p className="fslice-note" data-prepared-absence="positions">Positions on this run couldn't be read — {view.reason} ({view.source})</p>}
    {view?.state === "read" && positions.length === 0 && <p className="fslice-note" data-prepared-absence="no-position">Factory names no Position on this run.</p>}
    {positions.length > 1 && <label className="fslice-note" data-prepared-choice>{positions.length} Positions hold this run —{" "}
      <select className="oi-input" aria-label="Position whose context to show" value={chosen ?? ""} onChange={event => setChosen(event.target.value || undefined)}>
        <option value="">choose one…</option>
        {positions.map(item => <option key={item.positionRef} value={item.positionRef}>{item.handle ?? item.name}</option>)}
      </select>
    </label>}
    {position && <PositionBasis positionRef={position.positionRef} name={position.handle ?? position.name} project={project}/>}
  </section>;
}

function PositionBasis({positionRef, name, project}: {positionRef: string; name: string; project?: string}) {
  const kernel = useKernel();
  const [refocus, setRefocus] = useState<OwnerRead<RefocusReading>>();
  const [whoami, setWhoami] = useState<OwnerRead<InhabitationReading>>();
  useEffect(() => {
    let live = true;
    setRefocus(undefined); setWhoami(undefined);
    void readRefocus(kernel.transport, positionRef, project).then(read => { if (live) setRefocus(read); });
    void readWhoami(kernel.transport, positionRef, project).then(read => { if (live) setWhoami(read); });
    return () => { live = false; };
  }, [kernel.transport, positionRef, project]);
  const chain = refocus?.state === "read" ? refocusChain(refocus.data) : [];
  const basis = whoami?.state === "read" ? preparedBasis(whoami.data) : undefined;
  return <div className="fprep" data-prepared-position={positionRef}>
    <p className="fslice-note">For {name}</p>
    {!refocus && <p className="fslice-note" role="status">Reading the Refocus chain…</p>}
    {refocus?.state === "unavailable" && <p className="fslice-note" data-prepared-absence="refocus">Refocus couldn't be read — {refocus.reason} ({refocus.source})</p>}
    {refocus?.state === "read" && (chain.length
      ? <ol className="fprep-chain" data-refocus-chain={chain.length}>
        {chain.map(row => <li key={row.depth} style={{paddingInlineStart: `calc(${row.depth} * var(--oi-space-2, 8px))`}} data-link-state={row.state}>
          <small>{row.level}</small> <span>{row.state === "gap" ? `gap — ${row.words}` : row.words}</span>
        </li>)}
      </ol>
      : <p className="fslice-note" data-prepared-absence="chain">The Refocus reading carried no chain.</p>)}
    {!whoami && <p className="fslice-note" role="status">Reading the joined reading…</p>}
    {whoami?.state === "unavailable" && <p className="fslice-note" data-prepared-absence="whoami">The joined reading couldn't be read — {whoami.reason} ({whoami.source})</p>}
    {basis && <dl className="fprep-basis">
      <dt>Prepared context</dt><dd data-prepared-context>{basis.preparedContext}</dd>
      <dt>Root NOW</dt><dd>{basis.rootNow ? <NowRow nowRef={basis.rootNow}/> : basis.rootNowWords}</dd>
      <dt>Child NOW</dt><dd>{basis.childNow ? <NowRow nowRef={basis.childNow}/> : basis.childNowWords}</dd>
      <dt>Return</dt><dd>{basis.returnNow ? <NowRow nowRef={basis.returnNow}/> : basis.returnWords}</dd>
    </dl>}
  </div>;
}

function NowRow({nowRef}: {nowRef: string}) {
  const now = useNowRecord(nowRef);
  const words = now.reading?.record.purpose ? firstSentence(now.reading.record.purpose) : now.state === "reading" ? "Reading…" : now.state === "refused" ? `unreadable — ${now.error}` : "the NOW record";
  return <button type="button" className="fslice-row" onClick={() => openObject({kind: "factory-now", ref: nowRef, title: words})}>{words}</button>;
}
