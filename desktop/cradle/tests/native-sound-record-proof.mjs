/** Joined into the retained installed owner driver. Positive data must come
 * from real normal UI actions, original native replies and actual downloads.
 * No worker, device, capture, storage or source response is substituted. */
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
const u64 = value => { assert.match(value, /^(0|[1-9][0-9]*)$/); return BigInt(value); };
async function waitFor(test) { const end = Date.now() + 30000; while (!await test()) {
    assert.ok(Date.now() < end, 'Real normal native operation did not complete');
    await new Promise(resolve => setTimeout(resolve, 20));
} }
async function lines(path) { return createInterface({ input: createReadStream(path), crlfDelay: Infinity }); }
async function download(frame, button, retainActualDownload, name) { const pending = frame.page().waitForEvent('download'); await button.click(); return retainActualDownload(await pending, name); }
/** Compare one original PCM block at a time. The WAVE byte stream is never
 * normalized, padded or loaded as a second whole resident performance. */
async function verifyWave(path, header, batches, kind) {
    const file = await open(path, 'r');
    let at = 56, frames = 0, nonzero = false;
    const hash = createHash('sha256');
    try {
        const bytes = Buffer.alloc(56);
        assert.equal((await file.read(bytes, 0, 56, 0)).bytesRead, 56);
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
        assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
        assert.equal(bytes.readUInt16LE(20), 3);
        assert.equal(bytes.readUInt16LE(22), 1);
        assert.equal(bytes.readUInt32LE(24), header.state.boundary.sample_rate);
        assert.equal(bytes.readUInt16LE(34), 32);
        assert.equal(bytes.toString('ascii', 48, 52), 'data');
        hash.update(bytes);
        for await (const batch of batches())
            for (const block of kind === 'device' ? batch.device_blocks : batch.audio_blocks) {
                const actual = Buffer.alloc(block.frames * 4), expected = Buffer.alloc(block.frames * 4);
                assert.equal((await file.read(actual, 0, actual.length, at)).bytesRead, actual.length);
                for (let i = 0; i < block.frames; i++) {
                    const sample = block.output_linear[i];
                    assert.equal(Math.fround(sample), sample);
                    expected.writeFloatLE(sample, i * 4);
                    nonzero ||= sample !== 0;
                }
                assert.deepEqual(actual, expected, 'Exported original native Float32 bits changed');
                hash.update(actual);
                frames += block.frames;
                at += actual.length;
            }
        const count = kind === 'device' ? header.state.device_frames : header.state.audio_frames;
        assert.equal(frames, count);
        assert.equal(bytes.readUInt32LE(52), frames * 4);
        assert.equal(bytes.readUInt32LE(44), frames);
        assert.equal(bytes.readUInt32LE(4), 48 + frames * 4);
        assert.equal((await file.stat()).size, at);
        assert.ok(nonzero, 'A connected real passage must contain actual callback sound');
        return { frames, bytes: at, sha256: hash.digest('hex') };
    }
    finally {
        await file.close();
    }
}
async function captureFile(path) {
    let header = null;
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path))
        hash.update(chunk);
    const first = await lines(path);
    for await (const line of first) {
        header = JSON.parse(line);
        break;
    }
    assert.equal(header?.schema, 'oi.native-sound-take/v1');
    const batches = async function* () { let ordinal = 0; for await (const line of await lines(path)) {
        if (!ordinal++) {
            continue;
        }
        const row = JSON.parse(line);
        assert.equal(row.ordinal, ordinal - 1);
        yield row.native_capture;
    } };
    return { header, batches, sha256: hash.digest('hex') };
}
/** Ordinary Record while an actual performance is running: Stop -> current
 * native cut -> Start, actual Janko passage -> Stop -> native/device exports
 * -> normal Save -> close/cold native Act continuation -> recover disk sound.
 * streamOriginalNativeCaptureBatches walks original same-owner pulse artifacts,
 * never values read back from the exported file being checked. */
export async function runNativeSoundRecordGate({ frame, nativeRecordingRows, snapshot, playActualKey, retainActualDownload, streamOriginalNativeCaptureBatches, readOriginalNativeCut, invokeNormalSave, closeAndReopenActualFile, invokeNormalMusic, artifact }) {
    const panel = frame.locator('[data-performance="native-take"]');
    await panel.waitFor({ state: 'visible' });
    const before = await snapshot('native-sound-record-before', true), offset = nativeRecordingRows.length;
    assert.equal(before.performance.device.state, 'running');
    const scene = before.document.scenes.find(row => row.scene_ref === before.document.selection.scene_ref), born = structuredClone(scene.performance.checkpoints[0]);
    await panel.locator('[data-performance="native-record"]').click();
    await waitFor(async () => await panel.getAttribute('data-native-take-status') === 'recording');
    const startRows = nativeRecordingRows.slice(offset), cut = startRows.find(row => row.request.operation === 'save_cut'), stop = startRows.find(row => row.request.command?.operation === 'performance-device-stop'), start = startRows.find(row => row.request.command?.operation === 'performance-device-start');
    assert.ok(stop && cut && start);
    assert.equal(u64(cut.request.request_id), u64(stop.request.request_id) + 1n);
    assert.equal(u64(start.request.request_id), u64(cut.request.request_id) + 1n);
    assert.ok(startRows.every(row => !['begin', 'prepare_scene'].includes(row.request.operation)), 'Later Record cannot overwrite birth');
    const live = await snapshot('native-sound-record-running', true), take = live.native_sound_take;
    assert.equal(take.status, 'recording');
    assert.equal(take.boundary.request_id, cut.request.request_id);
    assert.equal(take.boundary.checkpoint_ref, cut.request.checkpoint_ref);
    const current = live.document.scenes.find(row => row.scene_ref === live.document.selection.scene_ref), savedCut = current.performance.checkpoints.find(row => row.checkpoint_ref === cut.request.checkpoint_ref);
    assert.ok(savedCut);
    assert.deepEqual(current.performance.checkpoints[0], born);
    assert.equal(savedCut.content_digest, take.boundary.checkpoint_digest);
    assert.equal(savedCut.sample, take.boundary.sample);
    const originalCut = await readOriginalNativeCut(cut);
    assert.deepEqual(savedCut.audio, originalCut.native_pair.audio, 'Complete native audio/voices/parameters/queues changed in ordinary cut');
    assert.deepEqual(savedCut.physical, originalCut.native_pair.physical, 'Complete sole P q/v changed in ordinary cut');
    const originalManagement = { ...originalCut };
    delete originalManagement.native_pair;
    assert.deepEqual(savedCut.management, originalManagement, 'Full original input/release/queue/history custody changed in ordinary cut');
    await playActualKey();
    await waitFor(async () => { const observed = await snapshot('native-sound-record-progress', false); return observed.native_sound_take?.audio_frames >= 128; });
    await panel.locator('[data-performance="native-record-stop"]').click();
    await waitFor(async () => ['stopped', 'failed'].includes(await panel.getAttribute('data-native-take-status')));
    const stopped = await snapshot('native-sound-record-stopped', true), ending = nativeRecordingRows.slice(offset).filter(row => row.request.command?.operation === 'performance-device-stop').at(-1);
    assert.equal(stopped.native_sound_take.status, 'stopped');
    assert.equal(stopped.native_sound_take.gaps, 0);
    assert.notEqual(stopped.performance.device.state, 'running');
    assert.equal(stopped.native_sound_take.native_stop_sample, stopped.performance.samples_elapsed);
    const capturePath = await download(frame, panel.locator('[data-performance="native-capture-export"]'), retainActualDownload, 'record-native-originals.jsonl'), capture = await captureFile(capturePath);
    assert.deepEqual(capture.header.state, stopped.native_sound_take);
    assert.equal(capture.header.unresolved, null);
    const originals = streamOriginalNativeCaptureBatches({ session_ref: take.boundary.session_ref, first_request_id: start.request.request_id, last_request_id: ending.request.request_id })[Symbol.asyncIterator]();
    let count = 0, force = false, pickup = false;
    for await (const batch of capture.batches()) {
        const original = await originals.next();
        assert.equal(original.done, false);
        assert.deepEqual(batch, original.value, 'Disk export changed original native callback/receiver/PCM/counters');
        assert.equal(batch.transport_epoch, take.boundary.transport_epoch);
        for (const block of batch.audio_blocks) {
            force ||= block.force_newtons.some(value => value !== 0);
            pickup ||= block.pickup_linear.some(value => value !== 0);
            assert.equal(block.has_receiving, block.receiving_manifest !== null);
        }
        count++;
    }
    assert.equal((await originals.next()).done, true);
    assert.equal(count, capture.header.state.batches);
    assert.ok(force && pickup, 'Actual same-body force and physical pickup must be connected');
    const wavPath = await download(frame, panel.locator('[data-performance="native-audio-export"]'), retainActualDownload, 'record-native-sound.wav'), native = await verifyWave(wavPath, capture.header, capture.batches, 'native');
    let device = null;
    if (capture.header.state.device_frames) {
        const path = await download(frame, panel.locator('[data-performance="device-audio-export"]'), retainActualDownload, 'record-device-callback.wav');
        device = await verifyWave(path, capture.header, capture.batches, 'device');
    }
    await invokeNormalSave();
    const saved = await snapshot('native-sound-record-normal-save', true), coldOffset = nativeRecordingRows.length;
    await closeAndReopenActualFile();
    await invokeNormalMusic();
    const cold = await snapshot('native-sound-record-cold-continued', true), coldRows = nativeRecordingRows.slice(coldOffset);
    assert.equal(coldRows.filter(row => row.request.operation === 'continue_act').length, 1);
    assert.ok(coldRows.every(row => !['begin', 'prepare_scene'].includes(row.request.operation) && row.request.command?.operation !== 'calibrate-current'));
    const recovered = frame.locator('[data-performance="native-take"]');
    await recovered.locator('summary').click();
    await recovered.getByRole('button', { name: 'Find this Scene’s sound takes' }).click();
    await recovered.getByRole('button', { name: new RegExp(take.take_ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await waitFor(async () => await recovered.getAttribute('data-native-take-ref') === take.take_ref);
    const coldPath = await download(frame, recovered.locator('[data-performance="native-capture-export"]'), retainActualDownload, 'record-cold-originals.jsonl'), coldCapture = await captureFile(coldPath);
    assert.equal(coldCapture.sha256, capture.sha256, 'Cold recovered original sound custody changed');
    artifact('native-sound-record-normal-cold-export.json', { before, live, stopped, saved, cold, native, device, capture_sha256: capture.sha256, paths: { capture: capturePath, native_wav: wavPath, cold: coldPath }, standing: 'Actual installed driver evidence only when this function is invoked against the same native owner. Device PCM is callback evidence; external speaker/microphone remains distinct.' });
}
/** Real transport/storage/capture-loss faults on separate admitted lifetimes.
 * The installed driver faults actual OS delivery / actual IndexedDB transaction
 * / actual native drain cadence, rather than mocking a successful producer. */
export async function runNativeSoundFaultGate({ frame, admitActualLifetime, armActualRecordingAckLoss, armActualCaptureStorageAbort, stallActualNativeCaptureDrain, observeSameNativeOwnerStoppedZeroExcitationOrClosed, originalFaultCustody, snapshot, artifact }) {
    for (const kind of ['ack-loss', 'storage-abort', 'native-ring-overflow']) {
        await admitActualLifetime(kind);
        const panel = frame.locator('[data-performance="native-take"]');
        await panel.locator('[data-performance="native-record"]').click();
        await waitFor(async () => await panel.getAttribute('data-native-take-status') === 'recording');
        if (kind === 'ack-loss')
            await armActualRecordingAckLoss();
        else if (kind === 'storage-abort')
            await armActualCaptureStorageAbort();
        else
            await stallActualNativeCaptureDrain();
        await waitFor(async () => { const state = await snapshot('native-sound-fault-progress', false); return state.native_sound_take?.status === 'failed' || state.native_sound_take?.gaps > 0 || state.native_sound_capture?.take?.status === 'failed'; });
        const state = await snapshot(`native-sound-${kind}`, true), custody = await originalFaultCustody(kind);
        assert.ok(custody.original_native_request || custody.original_native_capture);
        assert.equal(custody.original_request_reissues, 0);
        await observeSameNativeOwnerStoppedZeroExcitationOrClosed();
        const downloadPromise = frame.page().waitForEvent('download', { timeout: 1000 }).then(() => true, () => false);
        if (await panel.locator('[data-performance="native-audio-export"]').isEnabled())
            await panel.locator('[data-performance="native-audio-export"]').click();
        assert.equal(await downloadPromise, false, 'Incomplete take falsely exported continuous native WAVE');
        artifact(`native-sound-${kind}-original-failure.json`, { state, custody });
    }
}
