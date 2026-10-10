/** Bring earlier writing into the personal world — the /user intake flow.
 *
 * The complete journey the native law supports: choose a collection →
 * inspect what is there (members, dispositions, dates) → review the
 * placement plan → apply as the human-accepted act → see what arrived
 * (receipt, refusals) → verify the retained material → roll one import
 * back. The person/world anchor readback opens the flow on facts, and
 * registered collections list beside it. Nothing here writes without a
 * reviewed plan; the native owner re-verifies every basis itself.
 */
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {PersonalHistoryController} from "./historyController";
import {createPersonalHistoryNative} from "./history";
import type {CollectionMember, PlanEntry} from "./history";

const drafts = new WeakMap<object, PersonalHistoryController>();

/** One disposition, named the way the intake contract names it. */
function Disposition({member}: {member: CollectionMember}) {
  if (member.disposition === "retained") return <span className="ph-disposition is-retained">retained</span>;
  if (member.disposition === "unreadable") return <span className="ph-disposition is-unreadable" title={member.reason ?? undefined}>unreadable</span>;
  return <span className="ph-disposition is-excluded" title={member.reason ?? undefined}>excluded by selection</span>;
}

function EntryRow({entry}: {entry: PlanEntry}) {
  const action = entry.action === "copy-register" ? "bring in"
    : entry.action === "update" ? "update to later revision"
    : entry.action === "register" ? "retain in place"
    : entry.action === "none" ? "already here" : entry.action;
  return <li className="ph-plan-entry" data-entry-action={entry.action}>
    <span className="ph-entry-action">{action}</span>
    <span className="ph-entry-id" title={entry.origin ?? undefined}>{entry.entry_id}</span>
    {entry.event_date && <span className="ph-entry-date" title={entry.date_basis ?? undefined}>
      {entry.date_approximate ? `~${entry.event_date}` : entry.event_date}
    </span>}
    <Disposition member={entry as unknown as CollectionMember}/>
  </li>;
}

export function PersonalHistory({refresh = 0}: {refresh?: number}) {
  const {transport} = useKernel();
  const controller = useMemo(() => {
    const prior = drafts.get(transport);
    if (prior) return prior;
    const next = new PersonalHistoryController(createPersonalHistoryNative(transport));
    drafts.set(transport, next);
    return next;
  }, [transport]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.open(); }, [controller, refresh]);
  const person = state.anchor?.person;
  const world = state.anchor?.world;
  return <section aria-label="Bring earlier writing" data-personal-history className="ph-flow">
    <h3>Bring earlier writing</h3>
    <p>Bring a journal, notebook or exported collection into your world through the ordinary adoption path: inspect it, review the placement plan, adopt it as an explicit act. The originals stay yours; entries become ordinary registered sources bound to you.</p>
    {person && <p className="ph-anchor" data-personal-anchor>
      {person.manifest_present
        ? <>Adopting as <strong>{person.subject_ref}</strong>{world?.subject_ref_consistent === false && <em> (the world record names a different subject — reconcile the anchor before adopting)</em>}{state.anchor?.installation?.workcell_ref ? <> · {String(state.anchor.installation.workcell_ref)}</> : null}</>
        : <em>This world has no person anchor yet (Control/user/identity/manifest.json is absent). The native owner refuses to invent one.</em>}
    </p>}
    {state.error && <p className="ph-error" role="alert">{state.error}</p>}
    {state.step === "choose" && <>
      <div className="ph-choose">
        <input type="text" className="ph-path" placeholder="Path to the collection (a folder of writing)"
          value={state.path} aria-label="Collection path"
          onChange={event => controller.choose({path: event.target.value})}/>
        <button type="button" className="oi-action" disabled={!state.path || state.busy !== null}
          onClick={() => void controller.inspect()}>Inspect…</button>
      </div>
      {!!state.collections?.length && <div className="ph-collections">
        <p>Already in your world:</p>
        <ul>{state.collections.map(collection => <li key={`${collection.world_ref}:${collection.collection_id}`} className="ph-collection-row">
          <strong>{collection.title ?? collection.collection_id}</strong>
          <span className="ph-collection-meta">{collection.entries ?? 0} entries · {collection.mode} · {collection.world_ref}{collection.origin ? ` · from ${collection.origin}` : ""}</span>
        </li>)}</ul>
      </div>}
    </>}
    {state.step === "inspected" && state.inspection && <div className="ph-inspection">
      <p>{state.inspection.counts.total} member(s) at <code>{state.inspection.origin}</code> — {state.inspection.counts.retained} retained, {state.inspection.counts.unreadable} unreadable, {state.inspection.counts["excluded-by-selection"]} excluded.</p>
      <ul className="ph-members">
        {state.inspection.members.map(member => <li key={member.entry_id} className="ph-member" data-disposition={member.disposition}>
          <span className="ph-entry-id" title={member.entry_id}>{member.entry_id}</span>
          {member.event_date && <span className="ph-entry-date" title={member.date_basis ?? undefined}>{member.date_approximate ? `~${member.event_date}` : member.event_date}</span>}
          <span className="ph-entry-type">{member.entry_type}</span>
          <Disposition member={member}/>
        </li>)}
      </ul>
      <div className="ph-actions">
        <button type="button" className="oi-action is-primary" disabled={state.busy !== null}
          onClick={() => void controller.plan()}>Plan the placement…</button>
        <button type="button" className="oi-action" onClick={() => controller.back()}>Back</button>
      </div>
    </div>}
    {state.step === "review" && state.plan && <div className="ph-review">
      <p>Placement <strong>{state.plan.placement.mode}</strong> → <code>{state.plan.placement.home}</code> for <strong>{state.plan.person_ref}</strong>. {state.plan.undo_summary}</p>
      {(state.plan.conflicts.length > 0 || (state.plan.divergences?.length ?? 0) > 0) && <div className="ph-warnings" role="alert">
        {state.plan.conflicts.map(line => <p key={line} className="ph-conflict">{line}</p>)}
        {(state.plan.divergences ?? []).map(line => <p key={line} className="ph-divergence" title="A later edit stands; the import does not overwrite it">{line}</p>)}
        {state.plan.conflicts.length > 0 && <p>Resolve the conflicts and plan again; nothing is written while the plan carries them.</p>}
      </div>}
      <ul className="ph-plan">{state.plan.entries.map(entry => <EntryRow key={entry.entry_id} entry={entry}/>)}</ul>
      <div className="ph-actions">
        <button type="button" className="oi-action is-primary" disabled={!controller.canApply()}
          title={controller.canApply() ? "Adopt as an explicit human-accepted act; the native owner re-verifies every basis before writing" : "Nothing to apply, or the plan carries conflicts"}
          onClick={() => void controller.apply()}>Adopt into my world</button>
        <button type="button" className="oi-action" onClick={() => controller.back()}>Back</button>
      </div>
    </div>}
    {state.step === "result" && (state.outcome
      ? <div className="ph-result" data-receipt-schema={state.outcome.schema}>
        <p><strong>{state.outcome.collection_id}</strong>: {state.outcome.receipt.entries_added} brought in, {state.outcome.receipt.entries_changed} updated, {state.outcome.receipt.entries_unchanged} already here (import #{state.outcome.receipt.sequence}).</p>
        {state.outcome.refused.length > 0 && <div role="alert" className="ph-refused">
          {state.outcome.refused.map(line => <p key={line}>{line}</p>)}
        </div>}
        <div className="ph-actions">
          <button type="button" className="oi-action" disabled={state.busy !== null}
            onClick={() => void controller.verify(state.outcome!.collection_id)}>Verify retained material</button>
          <button type="button" className="oi-action" disabled={state.busy !== null || !state.verify}
            title={state.verify ? "Undo this import's owned effects; later edits are preserved and reported" : "Verify first: rollback needs the exact record revision the verification read"}
            onClick={() => {
              const revision = String((state.verify as {record_revision?: string}).record_revision ?? "");
              if (revision) void controller.rollback(state.outcome!.collection_id, state.outcome!.receipt.sequence, revision);
            }}
          >Roll back this import…</button>
          <button type="button" className="oi-action" onClick={() => controller.back()}>Bring something else</button>
        </div>
        {state.verify && <pre className="ph-verify">{JSON.stringify(state.verify, null, 1)}</pre>}
      </div>
      : <div className="ph-actions"><button type="button" className="oi-action" onClick={() => controller.back()}>Back</button></div>)}
    {state.busy && <p role="status" className="ph-busy">{state.busy === "planning" ? "Planning the placement…" : state.busy === "applying" ? "Applying the accepted plan…" : "Reading the native owner…"}</p>}
  </section>;
}
