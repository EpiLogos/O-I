import {useEffect, useRef, useState} from 'react';
import {useKernel} from '../kernel/KernelProvider';
import type {EncounterReading} from '../encounter/client';
import {listFlowInstances, readFlowInstance, type FlowInstance, type FlowInstanceRow} from '../flow/instances';
import type {NativeDialogue} from './nativeDialogue';
import {proposeAnswerForDay, readDayTarget, readNativeAnswer, retainAnswerInFlow, type NativeAnswer, type NativeDayTarget} from './nativeReturn';

/** Renders beside an actual native assistant block. Never infer the answer's
 * basis from the currently selected profile/centre; its recorded question owns it. */
export function NativeAnswerReturn({dialogue, reading, blockId, disabled = false}: {
  dialogue: NativeDialogue; reading: EncounterReading; blockId: number; disabled?: boolean;
}) {
  const {transport} = useKernel();
  const [answer, setAnswer] = useState<NativeAnswer | null>(null);
  const selected = reading.agent_session === dialogue.provisioning.agent_session && reading.blocks.some(block => block.id === blockId && block.kind === 'assistant' && block.text.trim());
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [flows, setFlows] = useState<FlowInstanceRow[]>([]), [flow, setFlow] = useState<FlowInstance | null>(null);
  const [day, setDay] = useState<NativeDayTarget | null>(null), [field, setField] = useState('');
  const [dayError, setDayError] = useState('');
  const held = useRef(false), mounted = useRef(true), epoch = useRef(0);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; epoch.current++;};}, []);
  useEffect(() => {epoch.current++; setOpen(false); setAnswer(null); setFlow(null); setDay(null); setField(''); setMessage('');}, [dialogue.provisioning.agent_session, blockId]);
  const run = async (operation: (current: () => boolean) => Promise<void>) => {
    if (held.current) return;
    const at = epoch.current, current = () => mounted.current && at === epoch.current;
    held.current = true; setBusy(true); setMessage('');
    try {await operation(current);} catch (error) {if (current()) setMessage(error instanceof Error ? error.message : String(error));}
    finally {held.current = false; if (mounted.current) setBusy(false);}
  };
  const inspect = () => void run(async current => {
    const native = await readNativeAnswer(transport, dialogue, blockId);
    if (!current()) return;
    setAnswer(native);
    setOpen(true);
    const [listed, today, refreshedFlow] = await Promise.allSettled([listFlowInstances(transport), readDayTarget(transport), flow ? readFlowInstance(transport, flow.location) : Promise.resolve(null)]);
    if (!current()) return;
    if (listed.status === 'fulfilled') setFlows(listed.value); else setMessage(String(listed.reason));
    if (today.status === 'fulfilled') {setDay(today.value); setField(''); setDayError('');} else {setDay(null); setField(''); setDayError(String(today.reason));}
    if (refreshedFlow.status === 'fulfilled') setFlow(refreshedFlow.value);
    else {setFlow(null); setMessage(String(refreshedFlow.reason));}
  });
  const chooseFlow = (reference: string) => void run(async current => {
    setFlow(null);
    const row = flows.find(row => row.location.ref === reference);
    if (!row) return;
    const value = await readFlowInstance(transport, row.location);
    if (current()) setFlow(value);
  });
  const retainFlow = () => void run(async current => {
    if (!flow || !answer) return;
    const result = await retainAnswerInFlow(transport, flow, answer);
    if (current()) setMessage(result.already ? 'This exact answer is already in the selected Flow.' : 'Answer retained in the selected Flow with its original agent and source basis.');
    window.dispatchEvent(new CustomEvent('oi:file-draft-changed', {detail: {ref: flow.location.ref}}));
  });
  const retainDay = () => void run(async current => {
    if (!day || !answer) return;
    const result = await proposeAnswerForDay(transport, day, field, answer);
    if (current()) setMessage(result.included || result.record.status === 'included'
      ? 'This exact quotation is already included in the selected Day.'
      : result.record.status === 'accepted'
        ? 'The quotation is accepted in Inbox and awaits inclusion in the Day.'
        : `Quotation is ${result.record.status} in Inbox. Review it there before including it in your Day.`);
  });
  return <div className="nara-native-retention">
    <button type="button" className="oi-action" disabled={disabled || busy || !selected} onClick={inspect}>Retain this answer</button>
    {open && <section aria-label="Retain selected native answer">
      <p className="oi-note">Choose where to keep this answer. Its original person, selected centre or relation, Expression and source revisions stay attached.</p>
      <label className="oi-field">Existing Flow<select className="oi-input" value={flow?.location.ref ?? ''} disabled={busy || disabled} onChange={event => chooseFlow(event.target.value)}><option value="">Choose a Flow</option>{flows.map(row => <option key={row.location.ref} value={row.location.ref}>{row.name}</option>)}</select></label>
      {flow && <p className="oi-note">{flow.doc.meta.title || 'Untitled Flow'} · {flow.doc.entries.length} existing entries. This adds one attributed agent answer.</p>}
      {!flows.length && <p className="oi-note">No existing Flow is available. Create one through New flow, then read destinations again.</p>}
      <button type="button" className="oi-action" disabled={busy || disabled || !flow} onClick={retainFlow}>Keep in this Flow</button>
      <button type="button" className="oi-action" disabled={busy || disabled} onClick={inspect}>Read destinations again</button>
      {day ? <div><label className="oi-field">Today · {day.day.temporal.civil_date}<select className="oi-input" value={field} disabled={busy || disabled} onChange={event => setField(event.target.value)}><option value="">Choose a Day field</option>{day.fields.map(value => <option key={value.id} value={value.id}>{value.label || value.id}</option>)}</select></label><p className="oi-note">Submit a retained quotation for review in Inbox. Central records its authenticated submitter; the original agent is identified in the quotation. This does not include it in your Day.</p><button type="button" className="oi-action" disabled={busy || disabled || !field} onClick={retainDay}>Send quotation to Inbox</button></div> : <p className="oi-note">{dayError}</p>}
      <button type="button" className="oi-action" disabled={busy} onClick={() => setOpen(false)}>Close</button>
    </section>}
    {message && <p className="oi-note" role="status">{message}</p>}
  </div>;
}
