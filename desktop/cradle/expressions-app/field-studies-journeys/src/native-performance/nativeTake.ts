import { originalCaptureJson, captureCounterNames, type NativeCaptureBatch, type NativeCaptureCounters } from './nativeCapture.js';
import type { NativePerformanceReading } from './protocol.js';
export interface NativeTakeBoundary {
    expression_ref: string;
    document_revision: number;
    scene_ref: string;
    scene_revision: number;
    checkpoint_ref: string;
    checkpoint_digest: string;
    request_id: string;
    session_ref: string;
    transport_epoch: string;
    sample: string;
    sample_rate: number;
}
export interface NativeTakeState {
    take_ref: string;
    boundary: NativeTakeBoundary;
    status: 'recording' | 'stopped' | 'failed';
    reason: string | null;
    batches: number;
    audio_frames: number;
    device_frames: number;
    gaps: number;
    audio_end: string;
    device_end: string;
    device_epoch: string | null;
    baseline_counters: NativeCaptureCounters;
    counters: NativeCaptureCounters;
    has_callback_readback: boolean;
    native_stop_sample: string | null;
}
export interface NativeTakePort {
    snapshot: () => NativeTakeState | null;
    subscribe: (listener: () => void) => () => void;
    start: () => Promise<NativeTakeState>;
    stop: () => Promise<NativeTakeState>;
    export: (kind: 'native-audio' | 'device-audio' | 'original-capture') => Promise<{
        blob: Blob;
        filename: string;
        state: NativeTakeState;
    }>;
    recover: (take_ref: string) => Promise<NativeTakeState>;
    list: () => Promise<NativeTakeState[]>;
}
type StoredBatch = {
    id: string;
    take_ref: string;
    ordinal: number;
    original: Blob;
    audio: Blob;
    device: Blob;
    gaps: {
        kind: string;
        expected: string;
        actual: string;
    }[];
};
const databaseName = 'oi-native-performance-takes-v1';
let database: Promise<IDBDatabase> | null = null;
function openStore(): Promise<IDBDatabase> {
    if (database) return database;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
        let refused = false;
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            const takes = db.createObjectStore('takes', { keyPath: 'take_ref' });
            takes.createIndex('scene', ['boundary.expression_ref', 'boundary.scene_ref']);
            const batches = db.createObjectStore('batches', { keyPath: 'id' });
            batches.createIndex('take_ref', 'take_ref');
        };
        request.onsuccess = () => {
            const db = request.result;
            // A blocked open may finish after refusal. Retire that exact late
            // resource instead of leaking a second resident database owner.
            if (refused) { db.close(); return; }
            db.onversionchange = () => { db.close(); if (database === opening) database = null; };
            resolve(db);
        };
        request.onerror = () => { refused = true; reject(request.error ?? Error('Native capture store could not open.')); };
        request.onblocked = () => { refused = true; reject(Error('Close the other capture-store view before opening this take.')); };
    });
    database = opening;
    void opening.catch(() => { if (database === opening) database = null; });
    return opening;
}
function completion(transaction: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error ?? Error('Original native capture storage failed.')); transaction.onabort = () => reject(transaction.error ?? Error('Original native capture storage was aborted.')); }); }
function requestValue<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? Error('Native capture read failed.')); }); }
function floatPcm(blocks: {
    output_linear: number[];
}[]): Blob {
    const count = blocks.reduce((total, block) => total + block.output_linear.length, 0), bytes = new ArrayBuffer(count * 4), view = new DataView(bytes);
    let at = 0;
    for (const block of blocks)
        for (const value of block.output_linear) {
            if (Math.fround(value) !== value)
                throw Error('Original output is not native Float32 PCM.');
            view.setFloat32(at, value, true);
            at += 4;
        }
    return new Blob([bytes], { type: 'application/octet-stream' });
}
/** IEEE Float32 mono WAVE, exact native PCM. No resampling, normalization,
 * gap padding, clock synthesis or claim of external acoustic measurement. */
function waveHeader(frames: number, rate: number): ArrayBuffer {
    if (!Number.isSafeInteger(frames) || frames <= 0 || frames * 4 > 0xffffffff - 48)
        throw Error('This original take exceeds the WAVE size bound; export its native capture parts.');
    const bytes = new ArrayBuffer(56), v = new DataView(bytes), tag = (at: number, value: string) => { for (let i = 0; i < value.length; i++)
        v.setUint8(at + i, value.charCodeAt(i)); };
    tag(0, 'RIFF');
    v.setUint32(4, 48 + frames * 4, true);
    tag(8, 'WAVE');
    tag(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 3, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 4, true);
    v.setUint16(32, 4, true);
    v.setUint16(34, 32, true);
    tag(36, 'fact');
    v.setUint32(40, 4, true);
    v.setUint32(44, frames, true);
    tag(48, 'data');
    v.setUint32(52, frames * 4, true);
    return bytes;
}
function changedCounters(state: NativeTakeState): boolean { return captureCounterNames.some(key => BigInt(state.counters[key]) !== BigInt(state.baseline_counters[key])); }
/** A disk-backed SOUND artifact projection of original native callbacks. The
 * native Scene/Act remains the sole score/source/checkpoint authority. Resident
 * state is one current batch plus fixed-size take metadata, never a second full
 * performance history. IndexedDB commit is awaited before another native drain. */
export class NativeTakeRecorder {
    private state: NativeTakeState | null = null;
    private listeners = new Set<() => void>();
    private unresolved: {
        batch: NativeCaptureBatch;
        reason: string;
    } | null = null;
    snapshot() { return this.state ? structuredClone(this.state) : null; }
    custody() { return this.unresolved ? structuredClone(this.unresolved) : null; }
    subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    private changed() { for (const listener of this.listeners)
        listener(); }
    async begin(boundary: NativeTakeBoundary, baseline: NativeCaptureBatch): Promise<NativeTakeState> {
        if (this.state?.status === 'recording' || this.unresolved)
            throw Error('Stop/reconcile the original take before beginning another.');
        if (boundary.session_ref !== baseline.session_ref || boundary.transport_epoch !== baseline.transport_epoch || boundary.sample_rate !== baseline.sample_rate)
            throw Error('Take baseline differs from its genuine stopped cut.');
        const state: NativeTakeState = { take_ref: `take:${crypto.randomUUID()}`, boundary: structuredClone(boundary), status: 'recording', reason: null, batches: 0, audio_frames: 0, device_frames: 0, gaps: 0, audio_end: boundary.sample, device_end: boundary.sample, device_epoch: null, baseline_counters: structuredClone(baseline.counters), counters: structuredClone(baseline.counters), has_callback_readback: false, native_stop_sample: null };
        const db = await openStore(), transaction = db.transaction('takes', 'readwrite'), done = completion(transaction);
        transaction.objectStore('takes').add(state);
        await done;
        this.state = state;
        this.changed();
        return this.snapshot()!;
    }
    async append(batch: NativeCaptureBatch): Promise<void> {
        const current = this.state;
        if (!current || current.status !== 'recording')
            return;
        if (this.unresolved)
            throw Error(this.unresolved.reason);
        try {
            if (batch.session_ref !== current.boundary.session_ref || batch.transport_epoch !== current.boundary.transport_epoch || batch.sample_rate !== current.boundary.sample_rate)
                throw Error('The active native take changed session, transport epoch or sample rate; retain its original segment before continuation.');
            const next = structuredClone(current), gaps: StoredBatch['gaps'] = [];
            for (const key of captureCounterNames) {
                if (BigInt(batch.counters[key]) < BigInt(next.counters[key]))
                    throw Error('Original native capture counter regressed: ' + key);
            }
            for (const block of batch.audio_blocks) {
                const start = BigInt(block.start_sample), end = start + BigInt(block.frames);
                if (start < BigInt(next.audio_end))
                    throw Error('Original native audio block overlaps/regresses; it will not be replayed or trimmed.');
                if (start !== BigInt(next.audio_end))
                    gaps.push({ kind: 'native-audio', expected: next.audio_end, actual: block.start_sample });
                next.audio_end = end.toString();
                next.audio_frames += block.frames;
            }
            for (const block of batch.device_blocks) {
                if (!block.clock_continuous)
                    gaps.push({ kind: 'device-clock', expected: 'continuous actual AUHAL clock', actual: 'original clock_continuous=false' });
                if (next.device_epoch !== null && next.device_epoch !== block.device_epoch)
                    throw Error('Actual output device epoch changed inside this take; retain a separate native segment.');
                next.device_epoch = block.device_epoch;
                const start = BigInt(block.native_start_sample), end = start + BigInt(block.frames);
                if (start < BigInt(next.device_end))
                    throw Error('Actual device capture overlaps/regresses; original output is retained.');
                if (start !== BigInt(next.device_end))
                    gaps.push({ kind: 'device-audio', expected: next.device_end, actual: block.native_start_sample });
                next.device_end = end.toString();
                next.device_frames += block.frames;
            }
            if (!Number.isSafeInteger(next.audio_frames) || !Number.isSafeInteger(next.device_frames) || current.batches === Number.MAX_SAFE_INTEGER)
                throw Error('Native capture artifact counters exhausted.');
            next.batches++;
            next.gaps += gaps.length;
            next.counters = structuredClone(batch.counters);
            next.has_callback_readback ||= batch.counters.has_callback_readback;
            if (gaps.length || changedCounters(next))
                next.reason = 'Original native capture reports missing blocks or loss counters. Full originals remain; continuous WAVE export requires a complete take.';
            const record: StoredBatch = { id: `${next.take_ref}:${String(next.batches).padStart(16, '0')}`, take_ref: next.take_ref, ordinal: next.batches, original: new Blob([originalCaptureJson({ ordinal: next.batches, gaps, native_capture: batch }) + '\n'], { type: 'application/x-ndjson' }), audio: floatPcm(batch.audio_blocks), device: floatPcm(batch.device_blocks), gaps };
            const db = await openStore(), transaction = db.transaction(['takes', 'batches'], 'readwrite'), done = completion(transaction);
            transaction.objectStore('batches').add(record);
            transaction.objectStore('takes').put(next);
            await done;
            this.state = next;
            this.changed();
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            this.unresolved = { batch: structuredClone(batch), reason };
            this.state = { ...current, status: 'failed', reason };
            this.changed();
            throw error;
        }
    }
    async fail(reason: string): Promise<void> {
        if (!this.state || this.state.status === 'stopped')
            return;
        this.state = { ...this.state, status: 'failed', reason };
        this.changed();
        try {
            const db = await openStore(), transaction = db.transaction('takes', 'readwrite'), done = completion(transaction);
            transaction.objectStore('takes').put(this.state);
            await done;
        }
        catch (error) {
            throw new AggregateError([Error(reason), error], 'Native sound failed and its original failure metadata could not be persisted.');
        }
    }
    async list(expression_ref: string, scene_ref: string): Promise<NativeTakeState[]> {
        const db = await openStore(), transaction = db.transaction('takes', 'readonly'), done = completion(transaction), request = transaction.objectStore('takes').index('scene').openCursor(IDBKeyRange.only([expression_ref, scene_ref])), rows: NativeTakeState[] = [];
        const walked = new Promise<void>((resolve, reject) => { request.onerror = () => reject(request.error); request.onsuccess = () => { const cursor = request.result; if (!cursor || rows.length === 128) {
            resolve();
            return;
        } const row = cursor.value as NativeTakeState; if (row.boundary.expression_ref !== expression_ref || row.boundary.scene_ref !== scene_ref) {
            reject(Error('Stored sound take belongs to another Expression/Scene.'));
            return;
        } rows.push(row); cursor.continue(); }; });
        await Promise.all([walked, done]);
        return structuredClone(rows);
    }
    async stop(reading: NativePerformanceReading): Promise<NativeTakeState> {
        const state = this.state;
        if (!state)
            throw Error('There is no actual native take.');
        if (reading.device.state === 'running' || reading.session_ref !== state.boundary.session_ref || reading.transport_epoch !== state.boundary.transport_epoch)
            throw Error('The original take requires its same acknowledged stopped native output.');
        const next = { ...state, status: state.status === 'failed' ? 'failed' : 'stopped', native_stop_sample: reading.samples_elapsed } as NativeTakeState;
        if (BigInt(next.audio_end) !== BigInt(reading.samples_elapsed) || next.device_frames && BigInt(next.device_end) !== BigInt(reading.samples_elapsed)) {
            next.gaps++;
            next.reason = 'The original stopped cursor exceeds captured output; a continuous WAVE would conceal missing samples.';
        }
        const db = await openStore(), transaction = db.transaction('takes', 'readwrite'), done = completion(transaction);
        transaction.objectStore('takes').put(next);
        await done;
        this.state = next;
        this.changed();
        return this.snapshot()!;
    }
    async recover(take_ref: string): Promise<NativeTakeState> {
        if (this.state?.status === 'recording' || this.unresolved)
            throw Error('The original active/unknown take remains in custody.');
        const db = await openStore(), transaction = db.transaction('takes', 'readonly'), done = completion(transaction);
        const [state] = await Promise.all([requestValue<NativeTakeState | undefined>(transaction.objectStore('takes').get(take_ref)), done]);
        if (!state || state.take_ref !== take_ref)
            throw Error('The stored original native sound take is absent.');
        if (state.status === 'recording')
            throw Error('This take ended without an acknowledged native stop; its original capture is incomplete.');
        this.state = state;
        this.changed();
        return this.snapshot()!;
    }
    async export(kind: 'native-audio' | 'device-audio' | 'original-capture') {
        const state = this.snapshot();
        if (!state || state.status === 'recording')
            throw Error('Stop the same native output before exporting its original sound.');
        const audio = kind !== 'original-capture', frames = kind === 'device-audio' ? state.device_frames : state.audio_frames;
        if (audio && (this.unresolved || state.status === 'failed' || state.gaps || changedCounters(state) || !state.has_callback_readback || !frames))
            throw Error('The original take is incomplete or has no actual callback sound. Export full capture evidence instead of a lossy continuous WAVE.');
        const groups: Blob[] = [];
        let parts: Blob[] = [], count = 0;
        const db = await openStore(), transaction = db.transaction('batches', 'readonly'), done = completion(transaction), request = transaction.objectStore('batches').index('take_ref').openCursor(IDBKeyRange.only(state.take_ref));
        const walked = new Promise<void>((resolve, reject) => { request.onerror = () => reject(request.error); request.onsuccess = () => { const cursor = request.result; if (!cursor) {
            resolve();
            return;
        } const row = cursor.value as StoredBatch; count++; if (row.take_ref !== state.take_ref || row.ordinal !== count) {
            reject(Error('Stored original capture parts are missing/out of order.'));
            return;
        } parts.push(kind === 'original-capture' ? row.original : kind === 'device-audio' ? row.device : row.audio); if (parts.length === 64) {
            groups.push(new Blob(parts));
            parts = [];
        } cursor.continue(); }; });
        await Promise.all([walked, done]);
        if (count !== state.batches)
            throw Error('Stored original capture count differs from its committed take.');
        if (parts.length)
            groups.push(new Blob(parts));
        if (kind === 'original-capture') {
            const header = { schema: 'oi.native-sound-take/v1', state, standing: 'Original native callback and device observations; native Scene/Act retains full score/source/checkpoints/episode. Not an external microphone measurement.', unresolved: this.unresolved };
            return { blob: new Blob([originalCaptureJson(header) + '\n', ...groups], { type: 'application/x-ndjson' }), filename: state.take_ref.replace(':', '-') + '-native-capture.jsonl', state };
        }
        const bytes = groups.reduce((total, group) => total + group.size, 0);
        if (bytes !== frames * 4)
            throw Error('Stored native PCM byte count differs from actual frames.');
        return { blob: new Blob([waveHeader(frames, state.boundary.sample_rate), ...groups], { type: 'audio/wav' }), filename: state.take_ref.replace(':', '-') + (kind === 'device-audio' ? '-device' : '-native') + '.wav', state };
    }
}
