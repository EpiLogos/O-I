import {readTemporalCaptureAudio,readLiveTemporalProgress,readSourceApplication,temporalKeys,type NativeCaptureSourceSpan,type NativeLiveTemporalProgress,type NativeSourceApplication} from './temporalCapture.js';
import type { NativePerformanceReading } from './protocol.js';
type JsonObject = Record<string, unknown>;
export interface CaptureIdentity {
    instance: string;
    event: string;
    subject: string;
    m1_revision: string;
    m2_generation: string;
}
export interface NativeAudioCapture {
    schema: 'ql.native-audio-capture/v1'|'ql.native-audio-capture/v2';
    identity: CaptureIdentity;
    end_identity: CaptureIdentity;
    preparation_ref: string;
    state_ref: string;
    body_revision: string;
    sample_rate: number;
    start_sample: string;
    frames: number;
    start_applied_sequence: string;
    end_applied_sequence: string;
    start_application_ordinal: string;
    end_application_ordinal: string;
    force_newtons: number[];
    note_force_newtons: number[];
    contact_force_newtons: number[];
    body_gain_linear: number[];
    monitor_gain_linear: number[];
    force_scale_newtons: number[];
    pickup_linear: number[];
    received_linear: number[];
    output_linear: number[];
    has_receiving: boolean;
    receiving_manifest: unknown;
    route_force_newtons: number[][];
    live_temporal?:NativeLiveTemporalProgress;
    source_spans?:NativeCaptureSourceSpan[];
    source_force_vector_newtons?:[number,number,number][];
    source_force_absolute_load_newtons?:number[];
}
export interface NativeDeviceCapture {
    schema: 'ql.native-device-capture/v1';
    device_id: number;
    device_epoch: string;
    sample_rate: number;
    native_start_sample: string;
    frames: number;
    device_sample_time: number;
    has_host_time: boolean;
    has_device_sample_time: boolean;
    clock_continuous: boolean;
    host_time: string;
    callback_begin_host_time: string;
    callback_end_host_time: string;
    output_linear: number[];
}
export interface NativeCaptureCounters {
    has_callback_readback: boolean;
    dropped_audio_blocks_at_readback: string;
    dropped_readbacks_at_readback: string;
    native_queue_overflows_at_readback: string;
    device_capture_drops: string;
    device_callback_failures: string;
    device_timestamp_discontinuities: string;
}
export interface NativeCaptureBatch {
    schema: 'ql.native-performance-capture-batch/v1';
    session_ref: string;
    transport_epoch: string;
    sample_rate: number;
    capture_enabled: boolean;
    audio_blocks: NativeAudioCapture[];
    device_blocks: NativeDeviceCapture[];
    counters: NativeCaptureCounters;
    source_applications?:NativeSourceApplication[];
}
export const captureCounterNames = ['dropped_audio_blocks_at_readback', 'dropped_readbacks_at_readback', 'native_queue_overflows_at_readback', 'device_capture_drops', 'device_callback_failures', 'device_timestamp_discontinuities'] as const;
const fail = (reason: string): never => { throw Error('Original native capture: ' + reason); };
const need = (value: unknown, reason: string): void => { if (!value)
    fail(reason); };
function object(value: unknown): JsonObject { need(!!value && typeof value === 'object' && !Array.isArray(value), 'object absent'); return value as JsonObject; }
export function captureCounter(value: unknown): string { need(typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) < (1n << 64n), 'native counter absent or noncanonical'); return value as string; }
function integer(value: unknown, min: number, max: number): number { need(typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max, 'native integer outside its bound'); return value as number; }
function ref(value: unknown): string { need(typeof value === 'string' && value.length > 0 && value.length <= 4096, 'native reference absent'); return value as string; }
function samples(value: unknown, frames: number) { need(Array.isArray(value) && value.length === frames && value.every(v => typeof v === 'number' && Number.isFinite(v)), 'captured sample array differs from its actual frame count'); }
function identity(value: unknown, reading: NativePerformanceReading) { const v = object(value); for (const name of ['instance', 'event', 'subject'])
    ref(v[name]); for (const name of ['m1_revision', 'm2_generation'])
    captureCounter(v[name]); need(v.instance === reading.scope.instance_ref && v.event === reading.scope.event_ref && v.subject === reading.scope.subject_ref, 'captured original belongs to another native work'); }
/** Validate a COPY of the original same-pulse observations. Historical M1/M2
 * and body values remain observations; they never authorize a source rebind. */
export function readNativeCapture(value: unknown, reading: NativePerformanceReading): NativeCaptureBatch {
    const v = temporalKeys(value,['schema','session_ref','transport_epoch','sample_rate','capture_enabled','audio_blocks','device_blocks','counters',...(Object.hasOwn(object(value),'source_applications')?['source_applications']:[])]);
    need(v.schema === 'ql.native-performance-capture-batch/v1', 'batch schema differs');
    ref(v.session_ref);
    captureCounter(v.transport_epoch);
    need(v.session_ref === reading.session_ref && v.transport_epoch === reading.transport_epoch, 'batch differs from the SAME native pulse/session/epoch');
    const rate = integer(v.sample_rate, 8000, 192000);
    need(reading.device.client_rate === 0 || rate === reading.device.client_rate, 'capture rate differs from the actual native device reading');
    need(typeof v.capture_enabled === 'boolean', 'capture enrollment unavailable');
    const audio = v.audio_blocks, device = v.device_blocks, c = temporalKeys(v.counters,['has_callback_readback',...captureCounterNames]);
    need(Array.isArray(audio) && audio.length <= 16 && Array.isArray(device) && device.length <= 128, 'original queue capacity differs');
    need(typeof c.has_callback_readback === 'boolean', 'actual callback observation is undisclosed');
    for (const key of captureCounterNames)
        captureCounter(c[key]);
    const cursor = BigInt(reading.samples_elapsed);
    for (const raw of audio as unknown[]) {
        const a = object(raw);
        const mixed=a.schema==='ql.native-audio-capture/v2';
        need(a.schema==='ql.native-audio-capture/v1'||mixed,'audio block schema differs');
        temporalKeys(a,['schema','identity','end_identity','preparation_ref','state_ref','body_revision','sample_rate','start_sample','frames','start_applied_sequence','end_applied_sequence','start_application_ordinal','end_application_ordinal','force_newtons','note_force_newtons','contact_force_newtons','body_gain_linear','monitor_gain_linear','force_scale_newtons','pickup_linear','received_linear','output_linear','has_receiving','receiving_manifest','route_force_newtons',...(mixed?['live_temporal','source_spans','source_force_vector_newtons','source_force_absolute_load_newtons']:[])]);
        identity(a.identity, reading);
        identity(a.end_identity, reading);
        ref(a.preparation_ref);
        ref(a.state_ref);
        need(BigInt(captureCounter(a.body_revision)) > 0n, 'body revision absent');
        need(integer(a.sample_rate, 8000, 192000) === rate, 'audio block rate differs');
        const frames = integer(a.frames, 1, 512), start = BigInt(captureCounter(a.start_sample));
        need(start + BigInt(frames) <= cursor, 'audio exceeds SAME pulse committed native cursor');
        for (const key of ['start_applied_sequence', 'end_applied_sequence', 'start_application_ordinal', 'end_application_ordinal'])
            captureCounter(a[key]);
        need(BigInt(a.end_applied_sequence as string) >= BigInt(a.start_applied_sequence as string) && BigInt(a.end_application_ordinal as string) >= BigInt(a.start_application_ordinal as string), 'original application sequence regressed');
        for (const key of ['force_newtons', 'note_force_newtons', 'contact_force_newtons', 'body_gain_linear', 'monitor_gain_linear', 'force_scale_newtons', 'pickup_linear', 'received_linear', 'output_linear'])
            samples(a[key], frames);
        need(typeof a.has_receiving === 'boolean' && Array.isArray(a.route_force_newtons) && a.route_force_newtons.length <= 9, 'original receiving/routes absent');
        if (mixed) {
            readTemporalCaptureAudio(a,rate,reading.samples_elapsed);
            const current=reading.live_temporal;
            need(current&&a.live_temporal.programme_ref===current.programme_ref&&a.live_temporal.next<=current.next,'captured programme differs from the SAME original native readback');
        }
        else if (a.has_receiving) {
            const m = object(a.receiving_manifest);
            need(m.version === 1 && m.sample_rate === rate, 'original callback receiving manifest rate/version differs');
            for (const key of ['receiving_identity', 'event', 'subject', 'preparation', 'state', 'source_coordinate', 'source_revision', 'eigenbasis', 'receiver', 'context', 'source_motion', 'receiver_motion', 'policy', 'policy_revision', 'standing'])
                ref(m[key]);
            for (const key of ['source_generation', 'body_revision', 'history_origin_sample', 'origin_sample', 'end_sample'])
                captureCounter(m[key]);
            need(typeof m.pratibimba === 'boolean' && m.event === (a.identity as CaptureIdentity).event && m.subject === (a.identity as CaptureIdentity).subject && m.preparation === a.preparation_ref && m.state === a.state_ref && m.body_revision === a.body_revision, 'original callback receiver lost its SAME native body/work');
            need(BigInt(m.history_origin_sample as string) <= start && BigInt(m.origin_sample as string) <= start && start + BigInt(frames) <= BigInt(m.end_sample as string), 'captured sound exceeds its original receiver segment');
        }
        else
            need(a.receiving_manifest === null, 'receiver absence was replaced by a later context');
        for (const route of a.route_force_newtons as unknown[])
            samples(route, frames);
    }
    for (const raw of device as unknown[]) {
        const d = temporalKeys(raw,['schema','device_id','device_epoch','sample_rate','native_start_sample','frames','device_sample_time','has_host_time','has_device_sample_time','clock_continuous','host_time','callback_begin_host_time','callback_end_host_time','output_linear']);
        need(d.schema === 'ql.native-device-capture/v1', 'device block schema differs');
        integer(d.device_id, 1, 0xffffffff);
        need(BigInt(captureCounter(d.device_epoch)) > 0n, 'actual device epoch absent');
        need(integer(d.sample_rate, 8000, 192000) === rate, 'device rate differs');
        const frames = integer(d.frames, 1, 512), start = BigInt(captureCounter(d.native_start_sample));
        need(start + BigInt(frames) <= cursor, 'device output exceeds SAME pulse committed cursor');
        need(typeof d.device_sample_time === 'number' && Number.isFinite(d.device_sample_time), 'actual device timestamp absent');
        for (const key of ['has_host_time', 'has_device_sample_time', 'clock_continuous'])
            need(typeof d[key] === 'boolean', 'actual AUHAL timestamp/clock validity flags absent');
        for (const key of ['host_time', 'callback_begin_host_time', 'callback_end_host_time'])
            captureCounter(d[key]);
        need(BigInt(d.callback_end_host_time as string) >= BigInt(d.callback_begin_host_time as string), 'callback timestamps regressed');
        samples(d.output_linear, frames);
    }
    if(Object.hasOwn(v,'source_applications')){
        need(Array.isArray(v.source_applications)&&v.source_applications.length<=255&&reading.live_temporal,'source application cohort has no actual native programme');
        const progress=readLiveTemporalProgress(reading.live_temporal,reading.samples_elapsed);
        let previous:NativeSourceApplication|null=null;
        for(const raw of v.source_applications as unknown[]){const step=readSourceApplication(raw,reading.samples_elapsed);
            need(BigInt(step.source_application_ordinal)<=BigInt(progress.next),'source application is ahead of SAME committed progress');
            if(previous)need(BigInt(step.source_application_ordinal)===BigInt(previous.source_application_ordinal)+1n&&step.before_source_ref===previous.after_source_ref&&step.before_source_index===previous.after_source_index&&step.before_body_revision===previous.after_body_revision&&BigInt(step.original_native_request_id)>BigInt(previous.original_native_request_id),'original source application cohort lost ordering or a descendant');
            previous=step;
        }
    }
    need(c.has_callback_readback === true || !(audio as unknown[]).length && !(device as unknown[]).length && !(v.source_applications as unknown[]|undefined)?.length, 'sound blocks have no actual callback readback');
    return structuredClone(v) as unknown as NativeCaptureBatch;
}
/** Native JSON numbers are kept as their actual binary64 values, including
 * signed zero. Plain JSON.stringify would silently rewrite native -0 to +0. */
export function originalCaptureJson(value: unknown): string {
    if (value === null)
        return 'null';
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            throw Error('Original capture contains a nonfinite number.');
        return Object.is(value, -0) ? '-0.0' : JSON.stringify(value);
    }
    if (typeof value === 'string' || typeof value === 'boolean')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return '[' + value.map(originalCaptureJson).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).map(key => JSON.stringify(key) + ':' + originalCaptureJson((value as Record<string, unknown>)[key])).join(',') + '}';
    throw Error('Original capture contains non-JSON data; it cannot be silently omitted.');
}
