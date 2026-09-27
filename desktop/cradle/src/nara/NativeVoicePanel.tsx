import {useEffect, useRef, useState} from 'react';
import type {KernelTransportStatus} from '../kernel/types';
import type {EncounterReading} from '../encounter/client';
import type {NativeDialogue, TurnBasis} from './nativeDialogue';
import {nativeTextRuns} from './nativeTranscript';
import {decodeAudio, encodeAudio, nativeVoice} from './nativeVoice';
import type {NativeVoiceResult} from './nativeVoice';
import {VoiceCapture} from './voiceCapture';

interface Props {
  transport: KernelTransportStatus; project: string; selectionKey: string; disabled: boolean;
  reading?: EncounterReading; running: boolean; composerEmpty: boolean;
  prepare: () => Promise<{dialogue: NativeDialogue; basis: TurnBasis}>;
  receiveTranscript: (text: string) => void;
}
/** Native speech is explicitly turn based. Capture, review/send, native answer
 * selection and playback each keep their actual receipt and cancellation scope. */
export function NativeVoicePanel(props: Props) {
  const [voice, setVoice] = useState<NativeVoiceResult | null>(null);
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const [recording, setRecording] = useState(false); const [playing, setPlaying] = useState(false);
  const [transcript, setTranscript] = useState(''); const [receipt, setReceipt] = useState<unknown>(null);
  const generation = useRef(0); const pending = useRef(false); const held = useRef<NativeVoiceResult | null>(null);
  const capture = useRef<VoiceCapture | null>(null); const captureRef = useRef<string | null>(null);
  const output = useRef<{context: AudioContext; source?: AudioBufferSourceNode} | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const closeHeld = async () => {
    capture.current?.discard(); capture.current = null; captureRef.current = null;
    const current = held.current; held.current = null;
    const audio = output.current; output.current = null;
    if (audio) {if (audio.source) {audio.source.onended = null; audio.source.stop();} await audio.context.close();}
    if (current) await nativeVoice(props.transport, props.project, {operation: 'close', voice_ref: current.voice_ref});
  };
  useEffect(() => {
    generation.current++; pending.current = false;
    setVoice(null); setBusy(''); setError(''); setRecording(false); setPlaying(false); setTranscript(''); setReceipt(null);
    return () => {generation.current++; void closeHeld().catch(() => {/* The native owner closes the actor on kernel exit; no audio remains active. */});};
  }, [props.selectionKey, props.project, props.transport]);
  const run = async (label: string, operation: (check: () => void) => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; const started = generation.current; setBusy(label); setError('');
    const check = () => {if (generation.current !== started) throw new Error('The selected person or Expression changed. Voice was closed.');};
    try {await operation(check);} catch (failure) {
      if (generation.current === started) {
        setError(failure instanceof Error ? failure.message : String(failure));
        await closeHeld().catch(() => {});
        setVoice(null); setRecording(false); setPlaying(false);
      }
    } finally {if (generation.current === started) {pending.current = false; setBusy('');}}
  };
  const open = () => void run('Checking the native speech route', async check => {
    const {dialogue, basis} = await props.prepare(); check();
    const result = await nativeVoice(props.transport, props.project, {operation: 'open', binding: {...dialogue.binding, operation: 'lookup'}, context: basis.context});
    try {check();} catch (failure) {await nativeVoice(props.transport, props.project, {operation: 'close', voice_ref: result.voice_ref}); throw failure;}
    held.current = result; setVoice(result); setReceipt(result.receipt);
  });
  const finish = () => void run('Transcribing the recording', async check => {
    const current = held.current, recordingRef = captureRef.current, recorder = capture.current;
    if (!current || !recordingRef || !recorder) throw new Error('There is no current native recording.');
    const bytes = await recorder.finish(); capture.current = null; captureRef.current = null; setRecording(false); check();
    const result = await nativeVoice(props.transport, props.project, {operation: 'transcribe', voice_ref: current.voice_ref, capture_ref: recordingRef, wav_base64: encodeAudio(new Uint8Array(bytes))}); check();
    if (typeof result.transcription?.text !== 'string') throw new Error('The native speech service did not return a transcript.');
    setTranscript(result.transcription.text); setReceipt(result.transcription);
  });
  const finishRef = useRef(finish); finishRef.current = finish;
  const record = () => void run('Opening the microphone', async check => {
    const current = held.current; if (!current) throw new Error('Open the native voice route first.');
    const result = await nativeVoice(props.transport, props.project, {operation: 'listen', voice_ref: current.voice_ref}); check();
    if (!result.capture_ref) throw new Error('The native owner did not grant a recording lease.');
    const recorder = await VoiceCapture.start(() => finishRef.current());
    try {check();} catch (failure) {recorder.discard(); throw failure;}
    capture.current = recorder; captureRef.current = result.capture_ref; setRecording(true); setReceipt(result.receipt);
  });
  const runs = nativeTextRuns(props.reading?.blocks ?? []);
  const answer = [...runs].reverse().find(run => run.kind === 'assistant'
    && runs.slice(runs.indexOf(run) + 1).find(row => ['user', 'completed', 'cancelled', 'error'].includes(row.kind))?.kind === 'completed');
  const speak = () => {
    // Resume output directly inside the user's gesture, before native IO.
    const context = new AudioContext(); output.current = {context};
    const resumed = context.resume();
    void run('Preparing the completed answer for speech', async check => {
      await resumed; check();
      const current = held.current; if (!current || !answer) throw new Error('There is no completed native answer to speak.');
      const result = await nativeVoice(props.transport, props.project, {operation: 'speak', voice_ref: current.voice_ref, answer_block_id: answer.id}); check();
      if (!result.response_ref || !result.audio?.audio_base64 || !['audio/wav', 'audio/wave', 'audio/x-wav'].includes(result.audio.content_type)) throw new Error('The native speech service did not return WAV audio.');
      const audio = await context.decodeAudioData(decodeAudio(result.audio.audio_base64)); check();
      const source = context.createBufferSource(); source.buffer = audio; source.connect(context.destination);
      output.current = {context, source};
      const started = generation.current;
      source.onended = () => {
        output.current = null; void context.close();
        if (generation.current !== started) return;
        setPlaying(false);
        void run('Confirming playback completion', async currentCheck => {
          const complete = await nativeVoice(props.transport, props.project, {operation: 'complete', voice_ref: current.voice_ref, response_ref: result.response_ref!}); currentCheck(); setReceipt(complete);
        });
      };
      source.start(); setPlaying(true); setReceipt({answer: result.answer, audio: {...result.audio, audio_base64: undefined}, receipt: result.receipt});
    });
  };
  const close = () => {
    generation.current++; pending.current = false;
    setBusy(''); setRecording(false); setPlaying(false); setVoice(null);
    void closeHeld().catch(failure => setError(String(failure)));
  };
  return <section className="nara-voice oi-card" aria-label="Nara voice">
    <h4>Voice</h4>
    <p className="oi-note">Record a question, review its transcript, then send it to Nara. Completed answers can be read aloud. This route works one turn at a time; speaking over Nara does not interrupt a response.</p>
    {!voice ? <button className="oi-action" type="button" disabled={props.disabled || !!busy} onClick={open}>Open native voice</button>
      : <div className="oi-actions">
        {recording ? <button className="oi-action" type="button" disabled={!!busy} onClick={finish}>Finish recording</button>
          : <button className="oi-action" type="button" disabled={props.disabled || !!busy || playing || props.running} onClick={record}>Record question</button>}
        <button className="oi-action" type="button" disabled={props.disabled || !!busy || playing || recording || props.running || !answer} onClick={speak}>Read latest completed answer aloud</button>
        <button className="oi-action" type="button" onClick={close}>{playing ? 'Stop playback and close voice' : recording ? 'Discard recording and close voice' : 'Close voice'}</button>
      </div>}
    <p className="oi-note" role="status">{busy || (recording ? 'Microphone is recording. Maximum five minutes.' : playing ? 'Playing the native answer.' : voice ? 'Native speech route admitted.' : '')}</p>
    {error && <p className="oi-note" role="alert">{error}</p>}
    {transcript && <div><label className="oi-field">Review the transcript<textarea className="oi-input" value={transcript} onChange={event => setTranscript(event.target.value)}/></label>
      <button className="oi-action" type="button" disabled={!!busy || props.disabled || !props.composerEmpty || !transcript.trim()} onClick={() => {propsRef.current.receiveTranscript(transcript); setTranscript('');}}>Use this question in the composer</button>
      {!props.composerEmpty && <p className="oi-note">Keep or clear the existing question before transferring this transcript.</p>}
    </div>}
    {voice && <details className="oi-disclosure"><summary>Native speech sources and last receipt</summary><pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{JSON.stringify({constitution: voice.constitution, conditions: voice.conditions, receipt}, null, 2)}</pre></details>}
  </section>;
}
