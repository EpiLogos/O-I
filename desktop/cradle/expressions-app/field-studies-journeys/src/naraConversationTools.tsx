/** Conversation gestures within the Expressions instrument. The parent channel
 * retains native authority and all document/session handles. */
import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {naraInstrumentRequest} from './kernelExpressions.js';
import {VoiceCapture} from '../../../src/nara/voiceCapture';
import type {InstrumentBasis, InstrumentReturnState, InstrumentVoiceRequest, InstrumentVoiceResult, NaraInstrumentRequest} from '../../../src/nara/instrumentProtocol';
import './naraConversationTools.css';

type Role = 'nara' | 'epii';
interface BasisProps {
  basis: InstrumentBasis | null;
  role: Role;
  /** Includes the host's native Expression revision/selection and profile revision. */
  selectionKey: string;
  visible: boolean;
  disabled: boolean;
}
function keyFor(props: BasisProps): string {
  return JSON.stringify([props.selectionKey, props.basis, props.role, props.visible]);
}
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function valueText(value: unknown): string {return typeof value === 'string' || typeof value === 'number' ? String(value) : 'Not disclosed';}
function encodeAudio(bytes: Uint8Array): string {
  let encoded = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) encoded += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(encoded);
}
function decodeAudio(encoded: string): ArrayBuffer {
  if (encoded.length > 32 * 1024 * 1024) throw Error('The returned audio exceeds the playback limit.');
  const decoded = atob(encoded), bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes.buffer;
}
async function voiceRequest(basis: InstrumentBasis, request: InstrumentVoiceRequest): Promise<InstrumentVoiceResult> {
  const result = await naraInstrumentRequest({operation: 'voice', basis, role: 'nara', request});
  if (result.schema !== 'oi.nara-voice/v1') throw Error('The native speech owner returned another reading.');
  return result;
}
interface VoiceProps extends BasisProps {
  running: boolean;
  answerBlockId: number | null;
  composerEmpty: boolean;
  receiveTranscript: (text: string) => void;
  onActivityChange: (active: boolean) => void;
  onSpeechAdmitted?: (answerBlockId: number, responseRef: string) => void;
  onSpeechCompleted?: (answerBlockId: number) => Promise<void>;
  onSpeechInterrupted?: () => void;
}
interface VoiceLease {basis: InstrumentBasis; reading: InstrumentVoiceResult}
export interface NaraVoiceHandle {
  /** Synchronously invalidate pending audio, then acknowledge local teardown.
   * Native lease closure and text cancellation belong to the host channel. */
  stopLocal: () => Promise<void>;
}

export const NaraVoiceTools = forwardRef<NaraVoiceHandle, VoiceProps>(function NaraVoiceTools(props, ref) {
  const [voice, setVoice] = useState<InstrumentVoiceResult | null>(null);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [recording, setRecording] = useState(false), [playing, setPlaying] = useState(false);
  const [transcript, setTranscript] = useState(''), [notice, setNotice] = useState('');
  const latest = useRef(props); latest.current = props;
  const generation = useRef(0), pending = useRef(false), mounted = useRef(false);
  const held = useRef<VoiceLease | null>(null);
  const capture = useRef<{recorder: VoiceCapture; ref: string} | null>(null);
  const output = useRef<{context: AudioContext; source?: AudioBufferSourceNode} | null>(null);
  const key = keyFor(props);
  const [viewKey, setViewKey] = useState(key);
  useEffect(() => {
    props.onActivityChange(recording || playing || !!busy);
    return () => props.onActivityChange(false);
  }, [recording, playing, busy, props.onActivityChange]);
  const localCleanup=useRef<Promise<void>|null>(null);
  const stopAudioNow = async () => {
    const recorder = capture.current; capture.current = null;
    const audio = output.current; output.current = null;
    const failures: string[] = [];
    const recordingStopped=recorder?.recorder.discard().catch(failure=>{
      if(!capture.current)capture.current=recorder;
      failures.push(`Recording could not be stopped: ${message(failure)}`);
    });
    if (audio) {
      if (audio.source) {
        audio.source.onended = null;
        try {audio.source.stop();} catch (failure) {
          if (!(failure instanceof DOMException && failure.name === 'InvalidStateError')) failures.push(`Playback could not be stopped: ${message(failure)}`);
        }
      }
      try {if (audio.context.state !== 'closed') await audio.context.close();}
      catch (failure) {if(!output.current)output.current=audio;failures.push(`Audio output could not be closed: ${message(failure)}`);}
    }
    await recordingStopped;
    if (failures.length) throw Error(failures.join(' '));
  };
  const stopAudio=()=>{
    const task=localCleanup.current??stopAudioNow();localCleanup.current=task;
    return task.finally(()=>{if(localCleanup.current===task)localCleanup.current=null;});
  };
  useImperativeHandle(ref, () => ({stopLocal: () => {
    const at = ++generation.current; pending.current = false; held.current = null;
    setBusy(''); setPlaying(false); setRecording(false); setVoice(null); setTranscript('');
    setNotice('Stopping voice and the response…');
    return stopAudio().then(() => {
      if (mounted.current && generation.current === at) setNotice('Local recording and playback stopped.');
    });
  }}));
  const closeHeld = async () => {
    latest.current.onSpeechInterrupted?.();
    const current = held.current; held.current = null;
    const results = await Promise.allSettled([stopAudio(), current
      ? voiceRequest(current.basis, {operation: 'close', voice_ref: current.reading.voice_ref}) : Promise.resolve()]);
    const failures = results.flatMap(result => result.status === 'rejected' ? [message(result.reason)] : []);
    if (failures.length) throw Error(failures.join(' '));
  };
  useEffect(() => {
    mounted.current = true; generation.current++; pending.current = false; setViewKey(key);
    setVoice(null); setBusy(''); setError(''); setTranscript(''); setNotice(''); setPlaying(false); setRecording(false);
    return () => {
      mounted.current = false; generation.current++;
      void closeHeld().catch(() => console.warn('Nara voice cleanup could not be acknowledged by the native owner. Local and native closure must be checked before another voice is opened.'));
    };
  }, [key]);
  const run = async (label: string, operation: (check: () => void) => Promise<void>) => {
    if (pending.current || !latest.current.visible || latest.current.disabled) return;
    pending.current = true; const at = generation.current, contextKey = keyFor(latest.current);
    setBusy(label); setError(''); setNotice('');
    const current = () => mounted.current && at === generation.current && contextKey === keyFor(latest.current) && latest.current.visible;
    const check = () => {if (!current()) throw Error('The person or selected Expression changed. Voice has been closed.');};
    try {await operation(check);} catch (failure) {
      if (current()) {
        setError(message(failure));
        await closeHeld().catch(cleanup => {if (current()) setError(`${message(failure)} Voice closure was not acknowledged: ${message(cleanup)}`);});
        if (current()) {setVoice(null); setRecording(false); setPlaying(false);}
      }
    } finally {if (current()) {pending.current = false; setBusy('');}}
  };
  const open = () => void run('Checking the speech connection…', async check => {
    await stopAudio();check();
    const basis = latest.current.basis; if (!basis) throw Error('Select a saved identity first.');
    const result = await voiceRequest(basis, {operation: 'open'});
    try {check();} catch (failure) {await voiceRequest(basis, {operation: 'close', voice_ref: result.voice_ref}); throw failure;}
    held.current = {basis, reading: result}; setVoice(result);
  });
  const finish = () => void run('Transcribing your recording…', async check => {
    const lease = held.current, recording = capture.current;
    if (!lease || !recording) throw Error('There is no current recording.');
    const bytes = await recording.recorder.finish(); check();
    if (capture.current === recording) capture.current = null; setRecording(false);
    const result = await voiceRequest(lease.basis, {operation: 'transcribe', voice_ref: lease.reading.voice_ref,
      capture_ref: recording.ref, wav_base64: encodeAudio(new Uint8Array(bytes))}); check();
    if (typeof result.transcription?.text !== 'string') throw Error('The speech service returned no transcript.');
    setTranscript(result.transcription.text);
    if (!result.transcription.text.trim()) setNotice('No words were returned. You can record again.');
  });
  const finishRef = useRef(finish); finishRef.current = finish;
  const recordQuestion = () => void run('Opening your microphone…', async check => {
    const lease = held.current; if (!lease) throw Error('Open voice first.');
    const result = await voiceRequest(lease.basis, {operation: 'listen', voice_ref: lease.reading.voice_ref}); check();
    if (!result.capture_ref) throw Error('The native owner did not return a recording reference.');
    const at=generation.current;
    const recorder = await VoiceCapture.start(failure=>{
      if(generation.current!==at)return;
      if(failure)void run('Closing the recording…',async()=>{throw failure;});else finishRef.current();
    });
    try {check();} catch (failure) {
      try{await recorder.discard();}catch(cleanup){throw Error(`${message(failure)} Recording cleanup: ${message(cleanup)}`);}throw failure;
    }
    capture.current = {recorder, ref: result.capture_ref}; setRecording(true); setTranscript('');
  });
  const speak = () => {
    if (pending.current || props.disabled || !props.visible || playing || recording || !held.current || props.answerBlockId === null) return;
    if(output.current){setError('Close the previous audio output before starting another answer.');return;}
    // Audio activation occurs during the human gesture, before native TTS IO.
    let context: AudioContext;
    try {context = new AudioContext();} catch (failure) {setError(`Audio output is unavailable: ${message(failure)}`); return;}
    output.current = {context};
    const resumed = context.resume();
    void run('Preparing the answer for speech…', async check => {
      await resumed; check();
      const lease = held.current, block = latest.current.answerBlockId;
      if (!lease || block === null) throw Error('Choose a completed native answer.');
      const result = await voiceRequest(lease.basis, {operation: 'speak', voice_ref: lease.reading.voice_ref, answer_block_id: block}); check();
      if (!result.response_ref || !result.audio?.audio_base64 || !['audio/wav', 'audio/wave', 'audio/x-wav'].includes(result.audio.content_type)) throw Error('The speech service returned no playable WAV answer.');
      const decoded = await context.decodeAudioData(decodeAudio(result.audio.audio_base64)); check();
      const source = context.createBufferSource(); source.buffer = decoded; source.connect(context.destination);
      output.current = {context, source}; const at = generation.current, contextKey = keyFor(latest.current);
      source.onended = () => {
        if (output.current?.source !== source) return;

        if (!mounted.current || at !== generation.current || contextKey !== keyFor(latest.current)) return;
        setPlaying(false);
        // Only natural completion arrives here; stop/cleanup detaches onended.
        void run('Confirming playback finished…', async check => {
          await context.close();check();if(output.current?.context===context)output.current=null;
          await voiceRequest(lease.basis, {operation: 'complete', voice_ref: lease.reading.voice_ref, response_ref: result.response_ref!}); check();
          setNotice('Playback finished.');
          await latest.current.onSpeechCompleted?.(block);
        });
      };
      source.start(); setPlaying(true);
      latest.current.onSpeechAdmitted?.(block, result.response_ref);
    });
  };
  const close = () => {
    generation.current++; pending.current = false;
    setBusy(''); setPlaying(false); setRecording(false); setVoice(null);
    setNotice('Local recording and playback stopped. Closing the voice connection…');
    const at = generation.current;
    void closeHeld().then(() => {if (mounted.current && at === generation.current) setNotice('Voice closed. Your conversation remains available.');})
      .catch(failure => {if (mounted.current && at === generation.current) setError(message(failure));});
  };
  if (props.role !== 'nara' || !props.visible || viewKey !== key) return null;
  return <section className="nara-conversation-tool" aria-label="Speak with Nara">
    <header><h3>Voice</h3><p>Record a question, review the words, then send. Listen to a completed answer when you choose.</p></header>
    <div className="nara-personal-actions">
      {!voice ? <button type="button" disabled={props.disabled || !props.basis || !!busy || !props.visible} onClick={open}>Open voice</button>
        : <>
          {recording ? <button type="button" className="nara-primary" disabled={!!busy} onClick={finish}>Finish recording</button>
            : <button type="button" disabled={props.disabled || !!busy || playing || props.running} onClick={recordQuestion}>Record a question</button>}
          <button type="button" disabled={props.disabled || !!busy || playing || recording || props.running || props.answerBlockId === null} onClick={speak}>Listen to the answer</button>
        </>}
      {(voice || busy || recording || playing) && <button type="button" onClick={close}>{playing ? 'Stop audio and close' : recording ? 'Discard recording and close' : 'Close voice'}</button>}
    </div>
    <p className="nara-tool-status" role="status">{busy || (recording ? 'Recording · up to five minutes' : playing ? 'Playing Nara’s answer' : notice || (voice ? 'Voice connected · one turn at a time' : ''))}</p>
    {error && <p className="nara-personal-error" role="alert">{error}</p>}
    {transcript && <div className="nara-transcript-review"><label className="nara-personal-input"><span>Review your question</span><textarea value={transcript} onChange={event => setTranscript(event.target.value)} /></label>
      <div className="nara-personal-actions"><button type="button" className="nara-primary" disabled={props.disabled || !!busy || !props.composerEmpty || !transcript.trim()} onClick={() => {
        if (!latest.current.visible || latest.current.disabled || !latest.current.composerEmpty) return;
        latest.current.receiveTranscript(transcript); setTranscript('');
      }}>Use this question</button><button type="button" onClick={() => setTranscript('')}>Discard transcript</button></div>
      {!props.composerEmpty && <p className="nara-personal-muted">Keep or clear the question already in the composer first.</p>}
    </div>}
    {voice && <details className="nara-personal-depth"><summary>About this voice connection</summary><p>Capture, transcription and speech are separate steps. Closing voice stops local audio and releases this connection; it does not cancel a model’s text response. Use the conversation’s interruption control for that request.</p><dl><dt>Native connection</dt><dd>{voice.voice_ref}</dd></dl></details>}
  </section>;
});

interface ReturnProps extends BasisProps {answerBlockId: number | null;acceptKeptAnswer:(receipt:NonNullable<InstrumentReturnState['expression']>)=>Promise<void>}
export function NaraAnswerReturnTools(props: ReturnProps) {
  const [review, setReview] = useState<InstrumentReturnState | null>(null), [flow, setFlow] = useState<InstrumentReturnState['flow']>();
  const [field, setField] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const latest = useRef(props); latest.current = props;
  const generation = useRef(0), pending = useRef(false), mounted = useRef(false);
  const key = JSON.stringify([keyFor(props), props.answerBlockId]);
  const [viewKey, setViewKey] = useState(key);
  const latestKey = () => JSON.stringify([keyFor(latest.current), latest.current.answerBlockId]);
  useEffect(() => {
    mounted.current = true; generation.current++; pending.current = false; setViewKey(key);
    setReview(null); setFlow(undefined); setField(''); setBusy(''); setError(''); setNotice('');
    return () => {mounted.current = false; generation.current++;};
  }, [key]);
  const run = async (label: string, operation: (check: () => void) => Promise<void>) => {
    if (pending.current || props.disabled || !props.visible) return;
    pending.current = true; const at = generation.current, contextKey = latestKey(); setBusy(label); setError(''); setNotice('');
    const current = () => mounted.current && at === generation.current && contextKey === latestKey();
    const check = () => {if (!current()) throw Error('The selected answer or Expression changed. Review it again.');};
    try {await operation(check);} catch (failure) {if (current()) setError(message(failure));}
    finally {if (current()) {pending.current = false; setBusy('');}}
  };
  const call = async (request: NaraInstrumentRequest): Promise<InstrumentReturnState> => {
    const result = await naraInstrumentRequest(request);
    if (result.schema !== 'oi.nara-instrument-return/v1') throw Error('The native Return owner returned another reading.');
    return result;
  };
  const basis = () => {if (!props.basis) throw Error('Select a saved identity first.'); return props.basis;};
  const inspect = () => void run('Reading the completed answer and destinations…', async check => {
    if (props.answerBlockId === null) throw Error('Choose a completed answer first.');
    setReview(null); setFlow(undefined); setField('');
    const result = await call({operation: 'return_inspect', basis: basis(), role: props.role, answer_block_id: props.answerBlockId}); check(); setReview(result);
  });
  const chooseFlow = (ref: string) => void run('Reading this Flow…', async check => {
    setFlow(undefined); if (!ref || !review) return;
    const result = await call({operation: 'return_flow_read', basis: basis(), role: props.role, review_ref: review.review_ref, flow_ref: ref}); check(); setFlow(result.flow);
  });
  const retainFlow = () => void run('Keeping the answer in this Flow…', async check => {
    if (!review || !flow) throw Error('Read the selected Flow first.');
    const result = await call({operation: 'return_flow', basis: basis(), role: props.role, review_ref: review.review_ref, flow_ref: flow.ref, expected_revision: flow.revision}); check();
    if (!result.retained) throw Error('No native retention receipt was returned.');
    setReview({...review, retained: result.retained});
    setNotice(result.retained.already ? 'This exact answer is already kept in the Flow.' : 'Kept in the Flow with its original agent and identity basis.');
  });
  const keepExpression=()=>void run('Keeping the completed answer in this Expression…',async check=>{
    if(!review)throw Error('Read the completed native answer first.');
    const result=await call({operation:'return_expression',basis:basis(),role:props.role,review_ref:review.review_ref});check();
    if(!result.expression)throw Error('No native answer-world receipt was returned.');
    setReview({...review,expression:result.expression});
    if(result.expression.state!=='saved'){setNotice('Kept in the native world; same-file save remains unconfirmed. '+(result.expression.error??''));return;}
    await props.acceptKeptAnswer(result.expression);
    // Receiving the native revision can remount this review. The stored
    // reading list below supplies the durable ordinary Read action.
    setNotice('Kept and saved in this Expression with its original source.');
  });
  const proposeDay = () => void run('Sending the quotation for review…', async check => {
    if (!review || !field) throw Error('Choose a native Day field.');
    const result = await call({operation: 'return_day', basis: basis(), role: props.role, review_ref: review.review_ref, field_id: field}); check();
    if (!result.proposal) throw Error('No native receiving receipt was returned.');
    const item = result.proposal;
    setNotice(item.included || item.status === 'included' ? 'This exact quotation is already included in the Day.'
      : item.status === 'accepted' ? 'The quotation is accepted in Inbox and awaits inclusion in the Day.'
      : `Quotation ${item.status} in Inbox. Review it there before including it in your Day.`);
    setReview({...review, proposal: item});
  });
  const original = record(review?.answer?.original_basis), context = record(original.context), source = record(original.identity_source), selected = record(original.selected);
  if (!props.visible || viewKey !== key) return null;
  return <section className="nara-conversation-tool nara-answer-return" aria-label="Keep this answer" data-native-answer-block-id={props.answerBlockId}>
    <div className="nara-personal-actions"><button type="button" disabled={props.disabled || !props.visible || !props.basis || !!busy || props.answerBlockId === null} onClick={inspect}>{review ? 'Read destinations again' : 'Keep this answer'}</button>
      {review && <button type="button" disabled={!!busy} onClick={() => {setReview(null); setFlow(undefined); setField('');}}>Close</button>}</div>
    {review && <div className="nara-return-review">
      <p>Keep an attributed quotation. Its original person, Expression and selected centre stay attached.</p>
      <details className="nara-personal-depth"><summary>Review the answer and its source</summary><blockquote>{review.answer?.text}</blockquote><dl><dt>Question</dt><dd>{review.answer?.question}</dd><dt>Selected reference</dt><dd>{valueText(selected.title ?? selected.subject_ref ?? selected.relation_ref)}</dd><dt>Person</dt><dd>{valueText(context.subject_ref)}</dd><dt>Source revision</dt><dd>{valueText(source.revision)}</dd><dt>Native session</dt><dd>{valueText(context.agent_session_ref)}</dd></dl></details>
      <div className="nara-personal-actions"><button type="button" disabled={!!busy||props.disabled||!!review.expression} onClick={keepExpression}>Keep in this Expression</button></div>
      {review.expression&&<p role="status">{review.expression.state==='saved'?'Saved in this personal world. Choose Read under Kept answers.':'Native answer kept; file save remains unconfirmed.'}</p>}
      <div className="nara-return-destinations"><div>
        <label className="nara-personal-input"><span>Keep in a Flow</span><select disabled={!!busy || props.disabled} value={flow?.ref ?? ''} onChange={event => chooseFlow(event.target.value)}><option value="">Choose an existing Flow</option>{review.flows?.map(row => <option key={row.ref} value={row.ref}>{row.name}</option>)}</select></label>
        {flow && <p className="nara-personal-muted">{flow.title} · {flow.entries} {flow.entries === 1 ? 'entry' : 'entries'}. One attributed answer will be retained.</p>}
        {!review.flows?.length && <p className="nara-personal-muted">{review.unavailable?.flows ?? 'Create a Flow through New flow, then read destinations again.'}</p>}
        <div className="nara-personal-actions"><button type="button" disabled={!!busy || props.disabled || !flow} onClick={retainFlow}>Keep in this Flow</button></div>
      </div><div>
        {review.day ? <><label className="nara-personal-input"><span>For your Day · {review.day.civil_date}</span><select disabled={!!busy || props.disabled} value={field} onChange={event => setField(event.target.value)}><option value="">Choose a Day field</option>{review.day.fields.map(item => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}</select></label><p className="nara-personal-muted">Send a quotation to Inbox for review. Your Day changes only after inclusion.</p><div className="nara-personal-actions"><button type="button" disabled={!!busy || props.disabled || !field} onClick={proposeDay}>Send quotation to Inbox</button></div></>
          : <p className="nara-personal-muted">{review.unavailable?.day ?? 'No native Day is available for a reviewed quotation.'}</p>}
      </div></div>
      {(flow || review.proposal) && <details className="nara-personal-depth"><summary>Destination and receipt</summary><dl>{flow && <><dt>Flow revision reviewed</dt><dd>{flow.revision}</dd></>}{review.retained && <><dt>Retained entry</dt><dd>{review.retained.entry_id}</dd><dt>Confirmed Flow revision</dt><dd>{review.retained.revision}</dd></>}{review.proposal && <><dt>Inbox item</dt><dd>{review.proposal.return_ref}</dd><dt>Native status</dt><dd>{review.proposal.status}</dd></>}</dl></details>}
    </div>}
    {(busy || notice) && <p className="nara-tool-status" role="status">{busy || notice}</p>}
    {error && <p className="nara-personal-error" role="alert">{error}</p>}
  </section>;
}

/** Stored quotations remain ordinary native material after restart. Reading
 * them does not acquire, resume or invoke a provider. */
export function NaraKeptAnswerTools(props:BasisProps&{readKeptAnswer:(answer:NonNullable<InstrumentReturnState['kept']>)=>Promise<void>}){
 const [records,setRecords]=useState<NonNullable<InstrumentReturnState['expressions']>>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),pending=useRef(false),key=keyFor(props);
 useEffect(()=>{const at=++generation.current;setRecords([]);setError('');setBusy(false);pending.current=false;
  if(props.visible&&props.basis)void naraInstrumentRequest({operation:'return_expression_list',basis:props.basis,role:props.role}).then(value=>{
   if(at===generation.current&&value.schema==='oi.nara-instrument-return/v1')setRecords(value.expressions??[]);
  }).catch(failure=>{if(at===generation.current)setError(message(failure));});
  return()=>{generation.current++;};
 },[key]);
 const read=async(ref:string)=>{if(pending.current||props.disabled||!props.basis)return;pending.current=true;setBusy(true);setError('');const at=generation.current;
  try{const value=await naraInstrumentRequest({operation:'return_expression_read',basis:props.basis,role:props.role,answer_ref:ref});
   if(at!==generation.current)return;if(value.schema!=='oi.nara-instrument-return/v1'||!value.kept)throw Error('The native stored answer could not be read.');await props.readKeptAnswer(value.kept);
  }catch(failure){if(at===generation.current)setError(message(failure));}finally{if(at===generation.current){pending.current=false;setBusy(false);}}
 };
 if(!props.visible)return null;
 return <section className="nara-conversation-tool" aria-label="Kept answers"><h3>Kept in this Expression</h3>
  {records.map(r=><div key={r.answer_ref} data-kept-answer-ref={r.answer_ref}><p>{r.role==='epii'?'Epii':'Nara'} · {r.question}</p><button type="button" disabled={busy||props.disabled} onClick={()=>void read(r.answer_ref)}>Read answer</button>
   <details><summary>Original answer source</summary><pre>{JSON.stringify(r,null,2)}</pre><p>This is an attributed historical answer. Reading it does not compute a new current or claim Recognition.</p></details></div>)}
  {!records.length&&!error&&<p>No native answer has been kept here.</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
