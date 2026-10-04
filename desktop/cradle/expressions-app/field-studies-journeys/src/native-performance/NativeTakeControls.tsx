import React, { useEffect, useRef, useState } from 'react';
import type { NativeTakePort } from './nativeTake.js';
import type { NativePerformanceClient } from './client.js';
export function NativeTakeControls({ owner, client, report }: {
    owner: NativeTakePort;
    client: NativePerformanceClient;
    report: (error: unknown) => void;
}) {
    const [state, setState] = useState(() => owner.snapshot()), [busy, setBusy] = useState(false), [saved, setSaved] = useState<Awaited<ReturnType<NativeTakePort['list']>>>([]);
    useEffect(() => owner.subscribe(() => setState(owner.snapshot())), [owner]);
    const scope = useRef<string | null>(null);
    useEffect(() => client.subscribe(() => { const reading = client.state.reading, next = reading && client.supports('performance-inspect') ? JSON.stringify(reading.scope) : null; if (scope.current !== next) {
        scope.current = next;
        setSaved([]);
    } setState(owner.snapshot()); }), [client, owner]);
    const operation = (perform: () => Promise<unknown>) => { if (busy)
        return; setBusy(true); void perform().catch(report).finally(() => { setBusy(false); setState(owner.snapshot()); }); };
    const exportOriginal = (kind: Parameters<NativeTakePort['export']>[0]) => operation(async () => { const output = await owner.export(kind), url = URL.createObjectURL(output.blob), link = document.createElement('a'); link.href = url; link.download = output.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); });
    return <section className="performance-take" aria-label="Native sound recording" data-performance="native-take" data-native-take-ref={state?.take_ref ?? ''} data-native-take-status={state?.status ?? 'none'}>
  <div className="performance-actions"><button data-performance="native-record" aria-pressed={state?.status === 'recording'} disabled={busy || !client.supports('performance-device-start') || state?.status === 'recording'} onClick={() => operation(() => owner.start())}>Record</button><button data-performance="native-record-stop" disabled={busy || !state || state.status === 'stopped'} onClick={() => operation(() => owner.stop())}>Stop recording</button><button data-performance="native-audio-export" disabled={busy || !state || state.status === 'recording'} onClick={() => exportOriginal('native-audio')}>Export native sound</button><button data-performance="device-audio-export" disabled={busy || !state?.device_frames || state.status === 'recording'} onClick={() => exportOriginal('device-audio')}>Export device callback</button><button data-performance="native-capture-export" disabled={busy || !state || state.status === 'recording'} onClick={() => exportOriginal('original-capture')}>Export full capture</button></div>
  <details><summary>Saved sound takes</summary><button disabled={busy} onClick={() => operation(async () => setSaved(await owner.list()))}>Find this Scene’s sound takes</button>{saved.map(take => <button key={take.take_ref} disabled={busy || state?.status === 'recording'} onClick={() => operation(() => owner.recover(take.take_ref))}>{take.take_ref} · {take.status} · {(take.audio_frames / take.boundary.sample_rate).toFixed(2)} s</button>)}</details>
  <p role="status">{state ? `${state.status} · ${(state.audio_frames / state.boundary.sample_rate).toFixed(2)} s of original native sound · ${state.device_frames} device frames${state.gaps ? ` · ${state.gaps} capture gaps` : ''}` : 'Record retains a current native stopped checkpoint, then captures the same body’s actual callback sound.'}</p>
  {state?.reason && <p role="alert">{state.reason}</p>}
  <p>The Expression project retains its physical score and episode. Sound exports contain the original unscaled PCM; full capture preserves native force, pickup, receiver, timestamps and loss counters.</p>
 </section>;
}
