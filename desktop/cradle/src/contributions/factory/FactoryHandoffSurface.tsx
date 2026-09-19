/**
 * The attempt-handoff availability for one Run, ported from the donor cut
 * (PR #292 FactoryHandoffSurface.tsx) into the Desk's design language.
 *
 * HONEST ADAPTATION FOR THE LIVE KERNEL: the owner reads this surface lives
 * on — the retained-task list and task reading — are NOT carried by this
 * kernel cut (the ops `factory_attempt_task_list_read` /
 * `factory_attempt_task_read` are absent from desktop/cradle/kernel/src/
 * factory.rs). The surface therefore renders an explicit owner-read
 * unavailable state naming the missing ops. No task list, attempt or
 * document is invented; the retained-snapshot machinery (restore a
 * previously retained task reading by exact identity and revision) is
 * ported intact so retained documents still render when one exists, and the
 * wiring needs only the owner ops to go live.
 */
import {useCallback, useEffect, useRef, useState} from "react";
import {attemptTaskReadsUnavailable, listFactoryAttemptTasks, readFactoryAttemptTask, type FactoryAttemptTaskListReading, type FactoryAttemptTaskReading} from "./attempt-task";
import {createFactoryHandoffReviewSnapshot, factoryHandoffReview, type FactoryHandoffReviewSnapshot} from "./factory-review-snapshot";
import {FactoryAttemptHandoffDocument} from "./FactoryAttemptHandoffDocument";
import "./factory-handoff-surface.css";

/** Retained handoff review snapshots — the same in-memory, byte-bounded
 * retention law as the material surface: a restored document is the exact
 * retained reading, never a re-read in disguise. */
const reviewStore = new Map<string, {snapshot?: FactoryHandoffReviewSnapshot; snapshotUnavailable?: string}>();
const storeKey = (statePath: string, runRef: string) => [statePath, runRef].join("\u0000");

export function FactoryHandoffSurface({statePath, runRef, expectedRevision}: {
  statePath: string;
  runRef: string;
  expectedRevision?: number;
}) {
  const [tasks, setTasks] = useState<FactoryAttemptTaskListReading>();
  const [selected, setSelected] = useState<string>();
  const [reading, setReading] = useState<FactoryAttemptTaskReading>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const generation = useRef(0), selectedRef = useRef<string>();
  const inputs = useRef({expectedRevision});
  inputs.current = {expectedRevision};

  const select = useCallback(async (taskRef: string) => {
    const request = ++generation.current;
    setError(undefined); setBusy(true);
    try {
      const value = await readFactoryAttemptTask();
      if (generation.current !== request) return;
      const captured = createFactoryHandoffReviewSnapshot(value, {statePath, runRef});
      let notice = captured ? undefined : "This Factory handoff remains visible here, but exceeds the retained presentation limit. Refresh explicitly after reopening to read current Factory state.";
      reviewStore.set(storeKey(statePath, runRef), captured ? {snapshot: captured} : {snapshotUnavailable: notice});
      if (generation.current !== request) return;
      selectedRef.current = taskRef; setSelected(taskRef); setReading(value); setError(notice);
    } catch (reason) {
      if (generation.current === request) setError(`Factory handoff read unavailable: ${reason instanceof Error && reason.message ? reason.message : String(reason)}`);
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }, [runRef, statePath]);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setError(undefined); setBusy(true);
    try {
      const value = await listFactoryAttemptTasks();
      if (generation.current !== request) return;
      setTasks(value);
      const held = selectedRef.current;
      if (held) {
        if (value.taskRefs.includes(held)) await select(held);
        else setError("The current Factory task list no longer contains the reviewed task. Its retained document remains visible; select another task explicitly.");
      } else if (value.taskRefs.length === 1) await select(value.taskRefs[0]);
    } catch (reason) {
      if (generation.current === request) setError(`Factory handoff read unavailable: ${reason instanceof Error && reason.message ? reason.message : String(reason)}`);
    } finally {
      if (generation.current === request) setBusy(false);
    }
  }, [runRef, select, statePath]);

  useEffect(() => {
    generation.current += 1;
    selectedRef.current = undefined; setSelected(undefined); setReading(undefined); setTasks(undefined); setError(undefined); setBusy(false);
    const held = reviewStore.get(storeKey(statePath, runRef));
    const restored = held?.snapshot ? factoryHandoffReview(held.snapshot, {statePath, runRef}) : undefined;
    if (restored && (inputs.current.expectedRevision === undefined || restored.revision === inputs.current.expectedRevision)) {
      selectedRef.current = restored.taskRef; setSelected(restored.taskRef); setReading(restored);
    } else if (held && (held.snapshot || held.snapshotUnavailable)) {
      setError(held.snapshotUnavailable ?? "The retained Factory handoff cannot be restored for this revision. Refresh explicitly to read current Factory state.");
    } else void refresh();
    return () => { generation.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statePath, runRef]);

  return <section className="desk-handoff-surface" aria-label="Factory handoff">
    <div className="desk-handoff-toolbar">
      <button type="button" onClick={() => void refresh()} disabled={busy}>{busy ? "Reading…" : "Refresh retained tasks"}</button>
    </div>
    {error && <p className="desk-handoff-error" role="alert">{error}</p>}
    {/* The standing unavailable disclosure: named ops, no invented list. */}
    {!reading && <section className="desk-handoff-unavailable" aria-label="Owner handoff reads unavailable" role="status">
      <p>{attemptTaskReadsUnavailable()}</p>
      <p className="desk-handoff-standing">When the owner ops land on the kernel, this section lists the Run's retained tasks and their attempt handoff documents. Nothing is shown in their place.</p>
    </section>}
    {tasks?.taskRefs.length === 0 && !reading && <p className="desk-handoff-empty">No retained Factory handoff for this Run.</p>}
    {tasks && tasks.taskRefs.length > 0 && (tasks.taskRefs.length > 1 || Boolean(selected && !tasks.taskRefs.includes(selected))) &&
      <nav className="desk-handoff-task-list" aria-label="Retained Factory tasks"><span>Retained tasks</span>
        {tasks.taskRefs.map(taskRef => <button key={taskRef} type="button" disabled={busy} aria-pressed={selected === taskRef} onClick={() => void select(taskRef)}><code>{taskRef}</code></button>)}
      </nav>}
    {reading && <FactoryAttemptHandoffDocument reading={reading}/>}
  </section>;
}
