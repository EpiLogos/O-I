/** Personal Nara dialogue over the existing native Encounter owner.
 * Identity and native Expression selection are refreshed before each turn.
 * No local speech simulation stands in for a provider response.
 */
import {useEffect, useRef, useState} from 'react';
import {useKernel} from '../kernel/KernelProvider';
import {kernelOp} from '../kernel/bridge';
import type {SurfaceBinding} from '../surface/types';
import {useExpressionApplication} from '../expression/useExpressionApplication';
import type {Change, ExpressionDocument} from '../expression/types';
import {useExpressionStage} from '../stage/ExpressionStage';
import {useScope, scopeProject} from '../workspace/scope';
import {chatProvisionTarget} from '../agent/chat/firstSend';
import {PermissionCard} from '../agent/chat/PermissionCard';
import {useEncounterSession, sessionStateLabel} from '../encounter/session';
import type {Draft} from '../encounter/client';
import type {EncounterSessionHandle} from '../encounter/session';
import {useCurrentIdentity} from './identity/current';
import {acquireNativeDialogue, clearRecoveredNativeDraft, lookupNativeDialogue, currentTurnBasis, dialogueQuestion,
  nativeTurnText, readNativeExpression, reconcileNativeTurn, submissionUncertain, submitNativeTurn} from './nativeDialogue';
import type {DialogueRole, NativeDialogue, TurnBasis} from './nativeDialogue';
import {buildDeixisRequest, resolveDeixis} from './dialogueContext';
import {stageFocusPlan} from './stageFocus';
import {NativeAnswerReturn} from './NativeAnswerReturn';
import {nativeTextRuns} from './nativeTranscript';
import {NativeVoicePanel} from './NativeVoicePanel';
import './nara.css';

interface FocusCheckpoint {expression_ref: string; after_revision: number; before: ExpressionDocument['selection']}
function NativeDialogueNotice({message}: {message: string}) {
  if (message.length <= 320) return <p className="oi-note" role="alert">{message}</p>;
  return <div className="oi-note"><p role="alert">{message.includes('[agent_session_host.transport_closed]')
    ? 'The dialogue provider disconnected before this step completed.'
    : 'The native operation could not be confirmed.'}</p>
    <details className="oi-disclosure"><summary>Native details</summary><pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{message}</pre></details>
  </div>;
}
function NativeTranscript({session, label, dialogue, recover, recoveryDisabled, reconnect}: {session?: EncounterSessionHandle; label: string; dialogue: NativeDialogue | null; recover: (dialogue: NativeDialogue, draft: Draft) => void; recoveryDisabled: boolean; reconnect: (dialogue: NativeDialogue, session: EncounterSessionHandle) => void}) {
  if (!session) return null;
  const {state, actions} = session;
  const runs = nativeTextRuns(state.reading?.blocks ?? []);
  const visibleText = (block: typeof runs[number]) => {
    if (block.kind !== 'user') return block.text;
    const question = dialogueQuestion(block.text);
    if (question !== block.text || !state.reading?.more || block.id !== runs[0]?.id) return question;
    // `more` alone does not identify a continuation: complete ordinary user
    // questions may also start a page. Only conceal an undecodable leading
    // fragment that still carries the native context's JSON field structure.
    try {JSON.parse(block.text); return question;} catch { /* Possibly a partial context run. */ }
    const nativeContextFragment = /[}\]]\s*$/.test(block.text)
      && /"(?:profile_ref|profile_revision|subject_ref|nara_ref|agent_session_ref|natal_composition|natal|identity|expression)"\s*:/.test(block.text);
    return nativeContextFragment
      ? 'This page does not contain a complete recorded question and context. Choose Earlier messages to read the preceding context.'
      : question;
  };
  return <section aria-label={`${label} native dialogue`}>
    <p className="oi-note" role="status">{sessionStateLabel(state.status)}{state.status?.provider?.label ? ` · ${state.status.provider.label}` : ''}</p>
    {(state.error || state.unreachable) && <NativeDialogueNotice message={state.error ?? state.unreachable ?? ''}/>}
    {dialogue && (state.resume || state.status?.state === 'Disconnected') && <button type="button" className="oi-action" disabled={state.pending} onClick={() => reconnect(dialogue, session)}>Reconnect recorded conversation</button>}
    {state.reading?.more && <button type="button" className="oi-action" onClick={actions.earlier}>Earlier messages</button>}
    {state.before !== undefined && <button type="button" className="oi-action" onClick={actions.latest}>Latest messages</button>}
    <ol className="nara-transcript">{runs.filter(b => b.kind === 'user' || b.kind === 'assistant').map(b => <li key={b.id} className={b.kind === 'user' ? 'nara-turn-person' : 'nara-turn-nara'}><strong>{b.kind === 'user' ? 'You' : label}</strong><p style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{visibleText(b)}</p>{b.kind === 'assistant' && dialogue && state.reading && <NativeAnswerReturn dialogue={dialogue} reading={state.reading} blockId={b.id} disabled={state.status?.state === 'TurnInFlight' || state.status?.state === 'InterruptRequested'}/>}</li>)}</ol>
    {state.reading?.permissions?.map(request => <PermissionCard key={request.native_request_id} request={request} agentName={label} disabled={state.pending} onAnswer={decision => void actions.permission(request.native_request_id, decision)}/>)}
    {state.reading?.draft.text && <details className="oi-disclosure"><summary>Saved unsent question</summary><p style={{whiteSpace:'pre-wrap'}}>{dialogueQuestion(state.reading.draft.text)}</p><button type="button" className="oi-action" disabled={recoveryDisabled || !dialogue || submissionUncertain(dialogue) || state.status?.state === 'TurnInFlight'} onClick={() => {if (dialogue && state.reading) recover(dialogue, state.reading.draft);}}>Move this question back to the composer</button></details>}
    <details className="oi-disclosure"><summary>Native session and activity</summary><p className="oi-ref">{state.agentSession}</p>{state.reading?.blocks.filter(b => b.kind !== 'user' && b.kind !== 'assistant').map(b => <p key={b.id}><strong>{b.kind}</strong> {b.text}</p>)}</details>
  </section>;
}

export function NaraSurface({binding}: {binding: SurfaceBinding}) {
  const kernel = useKernel(); const stage = useExpressionStage(); const scope = useScope();
  const identity = useCurrentIdentity();
  const project = chatProvisionTarget(binding.project ?? scopeProject(scope));
  const app = useExpressionApplication(binding.ref?.startsWith('expression:') ? binding.ref : undefined);
  const expression = app.document;
  const liveSelection = useRef('');
  liveSelection.current = JSON.stringify([identity?.selection_ref, expression?.expression_ref, project]);
  const [dialogue, setDialogue] = useState<NativeDialogue | null>(null);
  const [epii, setEpii] = useState<NativeDialogue | null>(null);
  const [question, setQuestion] = useState(''); const [busy, setBusy] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [basis, setBasis] = useState<TurnBasis | null>(null);
  const [checkpoint, setCheckpoint] = useState<FocusCheckpoint | null>(null);
  const [actionReturn, setActionReturn] = useState<unknown>(null);
  const [, setUncertainRevision] = useState(0);
  const active = useRef(false); const mounted = useRef(true);
  const head = useRef<HTMLElement>(null); const cue = useRef<number | null>(null);
  const naraSession = useEncounterSession(dialogue ? {project: dialogue.project, ref: dialogue.provisioning.agent_session, space: dialogue.provisioning.space} : undefined);
  const epiiSession = useEncounterSession(epii ? {project: epii.project, ref: epii.provisioning.agent_session, space: epii.provisioning.space} : undefined);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {
    let current = true;
    setDialogue(null); setEpii(null); setBasis(null); setCheckpoint(null); setActionReturn(null);
    setNotice(''); setError('');
    if (identity && expression) {
      void lookupNativeDialogue(kernel.transport, project, identity, expression.expression_ref, 'nara').then(v => {if (current) setDialogue(v);}).catch(e => {if (current) setError(String(e));});
      void lookupNativeDialogue(kernel.transport, project, identity, expression.expression_ref, 'epii').then(v => {if (current) setEpii(v);}).catch(e => {if (current) setError(String(e));});
    }
    return () => {current = false;};
  }, [identity?.reading.nara_ref, identity?.source.source_ref, identity?.source.revision, expression?.expression_ref, project, kernel.transport]);
  const running = naraSession?.state.status?.state === 'TurnInFlight' || naraSession?.state.status?.state === 'InterruptRequested';
  useEffect(() => {
    if (!dialogue) return;
    const rect = head.current?.getBoundingClientRect() ?? new DOMRect(24, 24, 24, 24);
    const name = running ? 'presence' : 'idle';
    if (cue.current === null) cue.current = stage.express(name, {target: dialogue.provisioning.agent_session, rect});
    else stage.update(cue.current, {name, rect});
  }, [dialogue, running, stage]);
  useEffect(() => () => {if (cue.current !== null) stage.release(cue.current);}, [stage]);
  const act = async (label: string, operation: () => Promise<void>) => {
    if (active.current) return;
    active.current = true; setBusy(label); setError(''); setNotice('');
    try {await operation();} catch (e) {if (mounted.current) setError(e instanceof Error ? e.message : String(e));}
    finally {active.current = false; if (mounted.current) setBusy('');}
  };
  const ensureDialogue = async (role: DialogueRole): Promise<NativeDialogue> => {
    if (!identity) throw new Error('Review and save your identity material, then choose Use this identity.');
    if (!expression) throw new Error('Choose the personal Expression to continue in.');
    const selection = liveSelection.current;
    const value = await acquireNativeDialogue(kernel.transport, project, identity, expression.expression_ref, role);
    if (!mounted.current || liveSelection.current !== selection) throw new Error('Identity or Expression selection changed while the native dialogue opened. Nothing was submitted.');
    if (mounted.current) {if (role === 'nara') setDialogue(value); else setEpii(value);}
    return value;
  };
  const send = (role: DialogueRole) => void act(role === 'epii' ? 'Sending the source inquiry to Epii' : 'Sending to Nara', async () => {
    if (!question.trim() || !identity || !expression) return;
    const selection = liveSelection.current;
    const requireCurrent = () => {if (!mounted.current || liveSelection.current !== selection) throw new Error('Identity or Expression selection changed. The pending turn was not submitted.');};
    const submitted = question; const target = await ensureDialogue(role);
    const current = await currentTurnBasis(kernel.transport, target, identity, expression.expression_ref);
    await submitNativeTurn(kernel.transport, target, nativeTurnText(submitted, current, role), requireCurrent);
    if (!mounted.current || liveSelection.current !== selection) return;
    setBasis(current); setQuestion(previous => previous === submitted ? '' : previous);
    setNotice(role === 'epii' ? 'Inquiry submitted to the native Epi-Logos agent. Its returned answer appears below.' : 'Question submitted with the saved identity and selected Expression reference.');
  });
  const inspectPoint = () => void act('Reading the selected reference', async () => {
    if (!identity || !expression) throw new Error('Choose a saved identity and an Expression first.');
    const target = await ensureDialogue('nara');
    const current = await currentTurnBasis(kernel.transport, target, identity, expression.expression_ref);
    if (!current.context.pointed_ref) throw new Error('Select a bound centre or relation in the Expression.');
    const resolution = resolveDeixis(current.context, buildDeixisRequest({deixis_ref: `deixis:${crypto.randomUUID()}`,
      nara_ref: current.context.nara_ref, turn_ref: `nara-point:${crypto.randomUUID()}`,
      basis_expression_revision: current.context.expression_revision, kind: 'hovered',
      target: {target: 'exact', ref_id: current.context.pointed_ref, target_kind: current.selected.relation_ref ? 'relation' : 'subject'},
      requested_at_unix_ms: Date.now()}));
    const plan = stageFocusPlan(resolution, current.document); let highlighted = false;
    for (const operation of plan.operations) if (operation.op === 'stage-highlight') highlighted = stage.focusSelection([operation.entity_ref]) || highlighted;
    setBasis(current);
    setNotice(highlighted ? `Highlighted ${current.context.pointed_ref} on the current Expression.` : `Selected reference: ${current.context.pointed_ref}. The next turn carries this exact reference; no live stage highlight was available.`);
  });
  const focus = (entity_ref: string) => void act('Focusing the selected body', async () => {
    if (!expression) return;
    const current = await readNativeExpression(kernel.transport, expression.expression_ref);
    const scene = current.scenes.find(s => s.scene_ref === current.selection.scene_ref);
    if (!scene || !scene.entity_refs.includes(entity_ref) || !current.entities[entity_ref]?.subject) throw new Error('This entity is not a bound subject in the current scene.');
    const reply = await app.request({operation: 'edit', expression_ref: current.expression_ref,
      expected_revision: current.revision, actor: 'human:nara-focus', changes: [{change: 'focus', scene_ref: scene.scene_ref, entity_ref}]});
    if (reply.state !== 'ready' || !reply.document) throw new Error('Expression focus changed concurrently; refresh the selection.');
    setCheckpoint({expression_ref: current.expression_ref, after_revision: reply.document.revision, before: current.selection});
    stage.focusSelection([entity_ref]); await app.refresh(); setNotice(`Focused ${current.entities[entity_ref].title}. The next turn reads this exact subject.`);
  });
  const restoreFocus = () => void act('Restoring the previous focus', async () => {
    if (!checkpoint) return;
    const current = await readNativeExpression(kernel.transport, checkpoint.expression_ref);
    if (current.revision !== checkpoint.after_revision) throw new Error('Expression changed after this focus action. Its later work is preserved; the earlier selection was not restored.');
    const before = checkpoint.before;
    const changes: Change[] = before.relation_ref ? [{change: 'relation_focus', scene_ref: before.scene_ref, binding_ref: before.relation_ref}] : [{change: 'focus', scene_ref: before.scene_ref, entity_ref: before.entity_ref}];
    const reply = await app.request({operation: 'edit', expression_ref: current.expression_ref, expected_revision: current.revision, actor: 'human:nara-focus-return', changes});
    if (reply.state !== 'ready' || !reply.document) throw new Error('The native owner did not restore the focus.');
    stage.focusSelection(before.entity_ref ? [before.entity_ref] : []); setCheckpoint(null); await app.refresh(); setNotice('Previous focus restored through the Expression owner.');
  });
  const runSelectedAction = (action_ref: string) => void act('Applying the selected native action', async () => {
    if (!expression) return;
    const current = await readNativeExpression(kernel.transport, expression.expression_ref);
    const selected = current.selection.entity_ref ? current.entities[current.selection.entity_ref] : null;
    if (!selected?.subject?.actions.some(a => a.action_ref === action_ref)) throw new Error('The selected subject no longer discloses this action.');
    const reply = await kernelOp(kernel.transport, {op: 'expression', request: {operation: 'invoke', expression_ref: current.expression_ref, expected_revision: current.revision, entity_ref: selected.entity_ref, action_ref, input: {}, project: project || null}});
    if (reply.error || reply.outcome?.result !== 'expression') throw new Error(reply.error ?? 'The native action did not return.');
    setActionReturn(reply.outcome.data); await app.refresh(); setNotice('The native action returned. Inspect its result below.');
  });
  const reconnectDialogue = (target: NativeDialogue, session: EncounterSessionHandle) => void act('Reconnecting the recorded native conversation', async () => {
    if (!identity || !expression) throw new Error('Select the saved identity and Expression again.');
    const selection = liveSelection.current;
    const recorded = await lookupNativeDialogue(kernel.transport, project, identity, expression.expression_ref, target.role, true);
    if (!recorded || recorded.provisioning.agent_session !== target.provisioning.agent_session || liveSelection.current !== selection) throw new Error('The selected native dialogue changed before reconnection.');
    if (!recorded.provisioning.provider) throw new Error('The native journal has no recorded provider to reconnect.');
    await session.actions.reconnect(recorded.provisioning.provider);
  });
  const recoverDraft = (target: NativeDialogue, draft: Draft) => void act('Recovering the saved native question', async () => {
    if (question.trim()) throw new Error('Keep or clear the question already in the composer before recovering another.');
    setQuestion(dialogueQuestion(draft.text));
    await clearRecoveredNativeDraft(kernel.transport, target, draft);
    setNotice('The saved question is back in the composer. Sending will read the current identity and selected Expression again.');
  });
  const reconcile = (target: NativeDialogue) => void act('Reading the native submission record', async () => {
    const confirmed = await reconcileNativeTurn(kernel.transport, target); setUncertainRevision(n => n + 1);
    setNotice(confirmed ? 'The native record confirms the earlier submission.' : 'The native record has not confirmed this submission. It has not been resent.');
  });
  const selected = app.selected;
  const relation = expression?.selection.relation_ref ? expression.relations[expression.selection.relation_ref] : null;
  const uncertainNara = dialogue ? submissionUncertain(dialogue) : false;
  const uncertainEpii = epii ? submissionUncertain(epii) : false;
  const ready = !!identity && !!expression && !busy;
  return <section className="nara-surface" aria-label="Nara presence" data-nara={identity?.reading.nara_ref ?? 'unattached'}>
    <header className="nara-head oi-context-head" ref={head}><div><h3>{identity ? `Nara · ${identity.reading.profile.name}` : 'Nara'}</h3><p className="oi-note">{identity ? 'The selected saved identity stays with this personal Expression.' : 'Open Identity, save or reopen your material, and choose Use this identity.'}</p></div>{naraSession && <button type="button" className="oi-action" disabled={!naraSession.actions.allowed('cancel')} onClick={naraSession.actions.cancel}>Interrupt Nara</button>}</header>
    <NativeVoicePanel transport={kernel.transport} project={project}
      selectionKey={JSON.stringify([identity?.selection_ref, expression?.expression_ref, expression?.revision])}
      disabled={!ready} running={running} reading={naraSession?.state.reading}
      composerEmpty={!question.trim()} receiveTranscript={setQuestion}
      prepare={async () => {
        if (!identity || !expression) throw new Error('Select a saved identity and Expression first.');
        const target = await ensureDialogue('nara');
        const current = await currentTurnBasis(kernel.transport, target, identity, expression.expression_ref);
        return {dialogue: target, basis: current};
      }}/>
    <div className="nara-attach-grid"><label className="oi-field">Personal Expression<select className="oi-input" value={expression?.expression_ref ?? ''} disabled={!!busy || app.pending} onChange={e => {if (e.target.value) void act('Opening Expression', async () => {await app.inspect(e.target.value);});}}><option value="">Choose an existing Expression</option>{app.list.map(item => <option key={item.expression_ref} value={item.expression_ref}>{item.title}</option>)}</select></label><label className="oi-field">Selected centre / subject<select className="oi-input" value={expression?.selection.entity_ref ?? ''} disabled={!expression || !!busy || app.pending} onChange={e => {if (e.target.value) focus(e.target.value);}}><option value="">Select in the current scene</option>{app.sceneEntities.map(ref => expression?.entities[ref]).filter(entity => entity?.subject).map(entity => <option key={entity!.entity_ref} value={entity!.entity_ref}>{entity!.title}</option>)}</select></label></div>
    {expression && <p className="oi-note">{relation ? `Selected relation: ${relation.relation.ref}` : selected?.subject ? `“This centre” refers to ${selected.title} · ${selected.subject.subject_ref}` : 'No bound centre is selected.'}</p>}
    {(error || app.error) && <NativeDialogueNotice message={error || app.error}/>}
    <p className="oi-note" role="status">{busy || notice}</p>
    <div className="nara-composer"><label className="oi-field" style={{flex: 1}}>Message Nara<textarea className="oi-input" rows={3} value={question} disabled={!identity} onChange={e => setQuestion(e.target.value)} onKeyDown={e => {if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {e.preventDefault(); send('nara');}}}/></label></div>
    <div className="oi-action-group"><button type="button" className="oi-action oi-action-primary" disabled={!ready || !question.trim() || running || uncertainNara} onClick={() => send('nara')}>Send to Nara</button><button type="button" className="oi-action" disabled={!ready || !question.trim() || uncertainEpii || epiiSession?.state.status?.state === 'TurnInFlight'} onClick={() => send('epii')}>Ask Epii about these sources</button><button type="button" className="oi-action" disabled={!ready || (!selected?.subject && !relation)} onClick={inspectPoint}>Point / highlight selection</button><button type="button" className="oi-action" disabled={!checkpoint || !!busy} onClick={restoreFocus}>Restore previous focus</button><button type="button" className="oi-action" disabled={!!busy} onClick={() => void act('Refreshing Expression', app.refresh)}>Refresh Expression</button></div>
    {uncertainNara && dialogue && <button type="button" className="oi-action" onClick={() => reconcile(dialogue)}>Check Nara submission</button>}{uncertainEpii && epii && <button type="button" className="oi-action" onClick={() => reconcile(epii)}>Check Epii submission</button>}
    <NativeTranscript session={naraSession} label="Nara" dialogue={dialogue} recover={recoverDraft} reconnect={reconnectDialogue} recoveryDisabled={!!busy || !!question.trim()}/>
    {epiiSession && <section className="nara-proposals oi-section" aria-label="Epii inquiry and Return"><h3>Epii inquiry / Return</h3><p className="oi-note">Review the returned material and its source basis before choosing where to retain it.</p><button type="button" className="oi-action" disabled={!epiiSession.actions.allowed('cancel')} onClick={epiiSession.actions.cancel}>Interrupt Epii inquiry</button><NativeTranscript session={epiiSession} label="Epii" dialogue={epii} recover={recoverDraft} reconnect={reconnectDialogue} recoveryDisabled={!!busy || !!question.trim()}/></section>}
    {!!selected?.subject?.actions.length && <section className="oi-section" aria-label="Selected subject actions"><h3>Actions disclosed by this subject</h3>{selected.subject.actions.map(action => <button key={action.action_ref} type="button" className="oi-action" disabled={!!busy} title={action.authority_requirement} onClick={() => runSelectedAction(action.action_ref)}>{action.action_ref}</button>)}</section>}
    {actionReturn != null && <details className="oi-disclosure"><summary>Native action Return</summary><pre>{JSON.stringify(actionReturn, null, 2)}</pre></details>}
    {basis && <details className="oi-disclosure"><summary>Identity and selected reference carried by the last turn</summary><dl className="nara-capabilities"><dt>Person</dt><dd>{basis.context.subject_ref}</dd><dt>Profile</dt><dd>{basis.context.profile_ref} @ {basis.context.profile_revision}</dd><dt>Expression</dt><dd>{basis.context.expression_ref} @ {basis.context.expression_revision}</dd><dt>Selected</dt><dd>{basis.context.pointed_ref ?? 'None'}</dd><dt>Session</dt><dd>{basis.context.agent_session_ref}</dd></dl></details>}
  </section>;
}
