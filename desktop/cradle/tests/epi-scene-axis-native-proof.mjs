/** Ordinary controls and real native/production GPU receiving only. The caller
 * owns the existing bridge/browser and records every actual request and reply.
 * No native responses, source values or renderer targets are substituted here.
 * Source-built browser proof excludes managed installation, listening and H. */
import assert from 'node:assert/strict';
const copy = value => structuredClone(value);
const uint = value => { assert.match(value, /^(0|[1-9][0-9]*)$/); return BigInt(value); };
const host = row => row.request?.request?.request;
const cursorKeys = ['event_ref', 'subject_ref', 'generation', 'samples_elapsed', 'clock', 'm2_identity'];
const phaseNames = ['inscription', 'lensing'];
const phaseInput = p => ({ turns: p.turns, half_degrees: p.half_degrees });
const sourceFixed = ['m1_clock', 'm1_carrier', 'm3_clock', 'selected_aperture', 'form', 'form_process'];
const fieldFixed = ['event_ref', 'subject_ref', 'registry_revision', 'geometry_ref', 'material_ref', 'model_ref', 'shape_ref', 'sample_rate', 'samples_elapsed', 'm2_identity', 'amplitudes_metres', 'presentation_units_per_metre', 'standing'];
async function witnessed(predicate) { const end = Date.now() + 20000; while (!predicate()) {
    if (Date.now() >= end)
        throw Error('The actual native witness did not complete.');
    await new Promise(r => setTimeout(r, 10));
} }
function partition(s, id) { const rows = s.rendered.partitions.filter(p => p.entityId === id); assert.equal(rows.length, 1); assert.ok(rows[0].end > rows[0].start); return rows[0]; }
function slice(s, id, key = 'targets') { const p = partition(s, id); assert.equal(s.rendered[key].length, s.rendered.particleCount * 4); return s.rendered[key].slice(p.start * 4, p.end * 4); }
function personalFixed(s) { return { person: s.record.person_ref, nara: s.record.nara_ref, identity: s.record.identity_source, input: s.record.identity_input_revision, event: s.record.world.event_ref, world: s.record.world, identity_reading: s.current.reading.identity, transit: s.current.reading.transit, baseline: s.current.reading.q_identity_transit, activity: s.current.reading.q_activity, composed: s.current.reading.q_composed, activity_status: s.current.reading.activity_status }; }
function currentField(rows, s) { const actual = rows.filter(row => row.lease === s.native.lease && row.field.generation===s.native.native.presented.generation && row.field.samples_elapsed===s.native.native.presented.samples_elapsed && row.field.event_ref===s.native.native.event_ref && row.field.subject_ref===s.native.native.subject_ref && JSON.stringify(row.field.clock)===JSON.stringify(s.native.presented_clock)).at(-1); assert.ok(actual, 'The rendered cursor must identify an actual native frame'); return actual; }
function sourceAt(rows, lease, field) { const actual = rows.filter(row => row.lease === lease && row.field.generation === field.generation && row.field.samples_elapsed === field.samples_elapsed).at(-1); assert.ok(actual, 'Full actual native Inspect at this admission cursor is required'); return actual.sources; }
function axisPrediction(before, axis, phase) { const clock = copy(before.clock); clock[phaseNames[axis]] = { ...phase, double_cover_half_degrees: Number((BigInt(phase.turns) % 2n + 2n) % 2n) * 720 + phase.half_degrees }; clock.generation = String(uint(clock.generation) + 1n); clock.rate_remainders[axis] = '0'; return clock; }
function predictAllTargets(samples, field, clock) {
    assert.equal(samples.length, 4096);
    assert.equal(field.amplitudes_metres.length, 9);
    assert.ok(Number.isFinite(field.presentation_units_per_metre) && field.presentation_units_per_metre > 0);
    const angles = [0, clock.inscription.half_degrees * Math.PI / 360, clock.lensing.half_degrees * Math.PI / 360];
    return samples.map((sample, i) => { assert.equal(sample.identity, i); assert.equal(sample.mode_shapes.length, 9); const p = copy(sample.rest_metres); for (let j = 0; j < 9; j++)
        for (let axis = 0; axis < 3; axis++)
            p[axis] += sample.mode_shapes[j][axis] * field.amplitudes_metres[j][0]; const c = Math.cos(angles[sample.attachment]), sin = Math.sin(angles[sample.attachment]), scale = field.presentation_units_per_metre; return { identity: sample.identity, constituent: sample.constituent, position: [Math.fround((c * p[0] - sin * p[1]) * scale), Math.fround((sin * p[0] + c * p[1]) * scale), Math.fround(p[2] * scale)] }; });
}
function predictTorus(before, clock, axis) {
    if (axis === 1)
        return copy(before.targets);
    const old = before.clock.inscription.half_degrees * Math.PI / 360, next = clock.inscription.half_degrees * Math.PI / 360;
    // Prediction from the actual immutable sample/mode basis is made below;
    // this rotation-only predicate is deliberately qualitative, not a tolerance
    // that could admit a wrong shape or replace the full 4096 receiving gate.
    assert.notEqual(Math.sin(next - old), 0, 'A non-degenerate inscription intervention is required');
    return null;
}
async function torusReceiving({ frame, snapshot, nativeFrames, artifact, record, label }) {
    await frame.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const s = await snapshot(label, true), targets = await frame.evaluate(() => { const t = window.__FIELD_STUDIES__.nativeTargets(); return t ? { native: t.native, scale: t.presentation_units_per_metre, admitted_a: Array.from(t.admitted_a), target_a: Array.from(t.target_a), target_b: Array.from(t.target_b) } : null; });
    assert.ok(targets?.native);
    const actual = nativeFrames.filter(row => row.lease === s.native.lease && cursorKeys.every(k => JSON.stringify(row.field[k]) === JSON.stringify(targets.native[k]))).at(-1);
    assert.ok(actual, 'The actual native cursor reaches this projection');
    assert.equal(actual.field.targets.length, 4096);
    const p = partition(s, record.receiving.torus.entity_ref), mapped = new Set();
    assert.ok(p.end - p.start >= 4096);
    for (let slot = p.start; slot < p.end; slot++) {
        const index = Math.floor((slot - p.start) * 4096 / (p.end - p.start));
        mapped.add(index);
        assert.equal(actual.field.targets[index].identity, index);
        for (let axis = 0; axis < 3; axis++) {
            const at = slot * 4 + axis, value = Math.fround(actual.field.targets[index].position[axis]);
            assert.equal(targets.admitted_a[at], value);
            assert.equal(targets.target_a[at], Math.fround(value * targets.scale));
            assert.equal(targets.target_b[at], targets.target_a[at]);
        }
    }
    assert.equal(mapped.size, 4096);
    assert.ok(s.rendered.positions.length === s.rendered.particleCount * 4 && s.rendered.positions.every(Number.isFinite), 'Complete actual resident GPU readback');
    artifact(label + '-torus-projection.json', { actual_native: actual.field, actual_request: actual.request, targets, partition: p, all_native_samples: 4096, all_mapped: true });
    return { s, actual, targets };
}
function predictHinge(address) { assert.ok(Number.isInteger(address) && address >= 0 && address < 64); const nuc = [(address >> 4) & 3, (address >> 2) & 3, address & 3], pairs = [(nuc[0] << 2) | nuc[1], (nuc[1] << 2) | nuc[2]], angles = pairs.map(p => p * 225), rad = angles.map(a => (a / 10) * Math.PI / 180); return { nucleotides: nuc, pairs, angles, points: [[-Math.cos(rad[0]), -Math.sin(rad[0]), 0], [0, 0, 0], [Math.cos(rad[1]), Math.sin(rad[1]), 0]] }; }
function qualifyHinge(reading, expectedAddress) { const f = reading.state.form, g = f.hinge_geometry, p = predictHinge(expectedAddress); assert.equal(f.address, expectedAddress); assert.deepEqual(f.nucleotides, p.nucleotides); assert.deepEqual(f.pair_angles_deg10, p.angles); assert.equal(g.embedding, 'normalized-directed-unit-pair-hinge/v1'); assert.equal(g.shared_hinge, 'Y'); assert.deepEqual(g.points.map(p => p.id), ['X', 'Y', 'Z']); assert.deepEqual(g.segments.map(s => [s.from, s.to, s.pair_index, s.angle_deg10]), [['X', 'Y', p.pairs[0], p.angles[0]], ['Y', 'Z', p.pairs[1], p.angles[1]]]); for (let i = 0; i < 3; i++)
    for (let axis = 0; axis < 3; axis++)
        assert.equal(Math.fround(g.points[i].xyz[axis]), Math.fround(p.points[i][axis]), 'Independent source pair quantum geometry in binary32'); return g; }
/** Imports supplied by the original driver are the source-qualified generic
 * presentation owners. Domain expectation above is independently derived from
 * Codon64 bits, PairIndex16 quantum225 and FoldGeometry unit-pair law. */
function privateTargets(s, reading, id, owners) {
    const scene = s.document.scenes[s.state.sceneIndex], e = scene.entities.find(e => e.id === id);
    assert.ok(e?.enabled && e.kind === 'formation');
    const native = owners.toNativeEntity(e), cfg = owners.toNativeConfig(scene);
    assert.equal(cfg.composition.plane, 'vertical', 'Current personal controlled specimen uses the vertical authored frame');
    assert.equal(s.state.fieldPaused, true);
    assert.equal(s.state.journeyPlaying, false);
    assert.equal(native.sequence.advance, 'off', 'Fixed authored body transform, no automatic per-link motion');
    assert.equal(native.sequence.links.length, 1, 'This controlled body has one fixed authored link');
    const pose = owners.resolveEntityPose(native, 0, 0, cfg.entities?.manualMorph ?? 0, cfg.entities?.holdRatio ?? 0);
    const g = reading.state.form.hinge_geometry, cands = owners.geometryCandidates({ entityId: id, revision: reading.revision, points: g.points.map(p => p.xyz), segments: [[0, 1], [1, 2]] });
    const p = partition(s, id), expected = [];
    const scale = native.extent && native.extent.normalized !== false ? 1 : owners.baseScale, trx = Math.max(.001, pose.scale) * (pose.extent.width / 400), try_ = Math.max(.001, pose.scale) * (pose.extent.height / 400), co = Math.cos(pose.extent.rotation), si = Math.sin(pose.extent.rotation);
    for (let slot = p.start; slot < p.end; slot++) {
        const c = cands[Math.floor(((slot - p.start) * 0.6180339887498949 % 1) * cands.length)], x = Math.fround(c.x * scale) * trx, y = Math.fround(c.y * scale) * try_, z = Math.fround(c.z * scale) * Math.max(.001, pose.scale);
        expected.push(Math.fround(x * co - y * si + pose.x), Math.fround(x * si + y * co + pose.y), Math.fround(z + pose.z), Math.fround(c.density));
    }
    assert.deepEqual(slice(s, id), expected, 'Every selected receiving target-buffer slot has the actual normalized directed native hinge and authored transform');
    return { partition: p, candidates: cands.length, expected_targets: expected, native_entity: native, pose };
}
export async function runSceneAxisGate({ frame, worldA, worldB, op, snapshot, action, sceneNavigate, exposeNativePanel, nativeFrames, nativeInspections, nativeM3, nativeDocument, savedFile, artifact, check, owners }) {
    const saved = worldA.saved_acknowledgement;
    assert.ok(saved?.working.file?.location.path);
    assert.deepEqual(saved.document, saved.file_read);
    assert.equal(await frame.evaluate(path => window.__FIELD_STUDIES__.openNativeFile(path), saved.working.file.location.path), true);
    await frame.waitForFunction(p => window.__FIELD_STUDIES__.epiWorld()?.person_ref === p && !window.__FIELD_STUDIES__.nativeWorking().pending, saved.person_ref, { timeout: 90000 });
    let opening = await snapshot('m3-axis-same-file-arrival');
    assert.deepEqual(opening.working.file, saved.working.file);
    assert.deepEqual(opening.record.current_material_policy, saved.policy);
    const record = opening.record, cosmic = record.receiving.scene_ref, personal = record.world.instance_ref + ':scene:personal', branches = record.world.instance_ref + ':scene:branches', locus = record.receiving.personal.locus_entity_ref;
    const memberships = saved.document.scenes.map(s => ({ scene_ref: s.scene_ref, entity_refs: s.entity_refs })), locked = personalFixed(opening);
    assert.equal(locked.activity_status, 'unavailable');
    assert.equal(locked.activity, null);
    assert.equal(locked.composed, null);
    await sceneNavigate(cosmic);
    await action('step');
    await exposeNativePanel();
    const panel = frame.locator('.native-field-panel');
    await panel.locator('[data-ni="hold"]').click();
    await frame.waitForFunction(() => window.__FIELD_STUDIES__.native().status === 'held');
    async function axisApply(axis, phase, route, label) {
        // Hold alone may leave already acknowledged queued audio ahead of the
        // displayed cursor. Ordinary native Inspect reconciles the actual owner
        // and reveals its complete source without changing a determinant.
        const depth=panel.locator('[data-ni-depth]');if(!await depth.evaluate(e=>e.open))await depth.locator(':scope > summary').click();
        const operations=depth.locator('details').filter({has:frame.getByText('Native operation and sources',{exact:true})});if(!await operations.evaluate(e=>e.open))await operations.locator(':scope > summary').click();
        await panel.locator('[data-native="inspect"]').click();await frame.waitForFunction(()=>{const n=window.__FIELD_STUDIES__.native();return document.querySelector('.native-field-panel')?.getAttribute('aria-busy')==='false'&&n?.status==='held'&&n.native?.available===true&&n.native.acknowledged?.generation===n.native.presented?.generation&&n.native.acknowledged?.samples_elapsed===n.native.presented?.samples_elapsed;});
        const before = await snapshot(label + '-before', true), lease = before.native.lease;
        assert.equal(before.native.status, 'held');
        const previous = currentField(nativeFrames, before), predicted = axisPrediction(previous.field, axis, phase), first = nativeFrames.length;
        const actualSources = sourceAt(nativeInspections, lease, previous.field);
        assert.equal(actualSources.original_field.samples.length, 4096);
        assert.ok(actualSources.original_field.samples.every((s, i) => s.identity === i && s.attachment === 1), 'Exact current torus basis is inscription-attached');
        assert.equal(previous.field.amplitudes_metres.length, 9);
        assert.deepEqual(previous.field.targets, predictAllTargets(actualSources.original_field.samples, previous.field, previous.field.clock), 'Original sample/mode basis reconstructs every prior native target before this axis operation');
        const expectedTargets = predictAllTargets(actualSources.original_field.samples, previous.field, predicted);
        const prefix = route === 'epi' ? 'data-epi' : 'data-ni';
        if (route === 'epi') {
            const details = frame.locator('.epi-play');
            if (!await details.evaluate(e => e.open))
                await details.locator('summary').click();
        }
        const turns = frame.locator(`[${prefix}-axis-turns="${axis}"]`), half = frame.locator(`[${prefix}-axis-half="${axis}"]`);
        await turns.fill(phase.turns);
        await half.fill(String(phase.half_degrees));
        await half.blur();
        await frame.waitForTimeout(600);
        assert.equal(await turns.inputValue(), phase.turns, 'Paired input draft survives two ordinary polling periods and focus transfer');
        assert.equal(await half.inputValue(), String(phase.half_degrees));
        await frame.locator(`[${prefix}="set-axis"][${prefix}-axis="${axis}"]`).click();
        await frame.waitForFunction(() => !Array.from(document.querySelectorAll('.epi-world-entrance [role="status"]')).some(e => e.textContent?.includes('Receiving the native operation')) && document.querySelector('.native-field-panel')?.getAttribute('aria-busy') !== 'true');
        await witnessed(() => nativeFrames.slice(first).some(row => row.lease === lease && host(row)?.command?.operation === 'set-axis'));
        const rows = nativeFrames.slice(first).filter(row => row.lease === lease && host(row)?.command?.operation === 'set-axis');
        assert.equal(rows.length, 1);
        const row = rows[0], f = row.field, q = host(row);
        assert.deepEqual(q.command, { operation: 'set-axis', axis, phase });
        assert.equal(q.expected_generation, previous.field.generation);
        assert.equal(q.expected_samples_elapsed, previous.field.samples_elapsed);
        for (const key of fieldFixed)
            assert.deepEqual(f[key], previous.field[key], 'Zero-elapsed axis invariant ' + key);
        assert.equal(f.generation, String(uint(previous.field.generation) + 1n));
        assert.deepEqual(f.clock, predicted);
        assert.deepEqual(f.targets, expectedTargets, 'All4096 native targets equal the independent current-basis/phase prediction');
        assert.deepEqual(f.audio, []);
        const unchanged = predictTorus(previous.field, predicted, axis);
        if (unchanged)
            assert.deepEqual(f.targets, unchanged);
        else
            assert.notDeepEqual(f.targets, previous.field.targets);
        await witnessed(() => nativeInspections.some(r => r.lease === lease && r.field.generation === f.generation && r.field.samples_elapsed === f.samples_elapsed));
        const sources = sourceAt(nativeInspections, lease, f);
        await frame.waitForFunction(({ lease, generation, clock }) => { const n = window.__FIELD_STUDIES__.native(); return n?.lease === lease && n.status === 'held' && !n.instrument?.influence_stale && n.native?.available === true && n.native.presented?.generation === generation && JSON.stringify(n.instrument?.influence?.native_readback?.continuous_clock_native) === JSON.stringify(clock); }, { lease, generation: f.generation, clock: f.clock }, { timeout: 20000 });
        assert.deepEqual(sources.original_field, actualSources.original_field);
        assert.deepEqual(sources.current.m2, actualSources.current.m2);
        assert.deepEqual(sources.current.m3, actualSources.current.m3);
        const received = await torusReceiving({ frame, snapshot, nativeFrames, artifact, record, label: label + '-received' });
        assert.equal(received.s.native.lease, lease);
        assert.equal(received.s.native.status, 'held');
        assert.deepEqual(personalFixed(received.s), personalFixed(before));
        for (const key of sourceFixed)
            assert.deepEqual(received.s.native.instrument.influence.native_readback[key], before.native.instrument.influence.native_readback[key]);
        const prefixId = record.world.instance_ref + ':entity:world-', moving = prefixId + (axis === 0 ? 'clock-a-hand' : 'clock-b-hand'), fixed = prefixId + (axis === 0 ? 'clock-b-hand' : 'clock-a-hand');
        assert.notDeepEqual(slice(received.s, moving), slice(before, moving), 'The actual ordinary clock hand receives the selected independent phase');
        assert.deepEqual(slice(received.s, fixed), slice(before, fixed), 'The other actual clock hand is invariant');
        let residentReceiving = null;
        if (axis === 0) {
            await frame.evaluate(() => window.__FIELD_STUDIES__.probeSteps(120, 1 / 120));
            residentReceiving = await snapshot(label + '-resident-response', true);
            assert.equal(residentReceiving.rendered.seeds, received.s.rendered.seeds, 'Axis receiving never reseeds the actual particle field');
            assert.notDeepEqual(slice(residentReceiving, record.receiving.torus.entity_ref, 'positions'), slice(before, record.receiving.torus.entity_ref, 'positions'), 'The actual resident torus responds to the received inscription targets');
            assert.deepEqual(residentReceiving.native.native.presented, received.s.native.native.presented, 'GPU mechanics do not advance any native clock or modal sample');
        }
        artifact(label + '-axis-proof.json', { axis, submitted: phase, route, before: previous.field, predicted_clock: predicted, request: row.request, actual: f, full_sources: sources, all4096_receiving: true });
        return { row, received, before };
    }
    const admissions = [];
    admissions.push(await axisApply(0, { turns: '1', half_degrees: 120 }, 'epi', 'm3-inscription-epi'));
    admissions.push(await axisApply(1, { turns: '-1', half_degrees: 360 }, 'epi', 'm3-lensing-epi'));
    admissions.push(await axisApply(0, { turns: '2', half_degrees: 180 }, 'ni', 'm3-inscription-scene-play'));
    admissions.push(await axisApply(1, { turns: '3', half_degrees: 240 }, 'ni', 'm3-lensing-scene-play'));
    check(true, 'Ordinary Epi and Scene Play apply exact independent phases at zero elapsed time, preserving nine amplitudes/person/source clocks/form and mapping all4096 actual torus samples');
    // Real typed invalid input must refuse before even one native exchange. No
    // numeric value or response is injected through an acceptance hook.
    const invalid = [{ turns: '', half: '120' }, { turns: '-0', half: '120' }, { turns: '01', half: '120' }, { turns: 'abc', half: '120' }, { turns: '9223372036854775808', half: '120' }, { turns: '-9223372036854775809', half: '120' }, { turns: '1', half: '' }, { turns: '1', half: '-1' }, { turns: '1', half: '720' }, { turns: '1', half: '1.5' }];
    for (const [i, v] of invalid.entries()) {
        const first = nativeFrames.length, before = await snapshot('m3-invalid-' + i + '-before');
        await frame.locator('[data-epi-axis-turns="0"]').fill(v.turns);
        await frame.locator('[data-epi-axis-half="0"]').fill(v.half);
        await frame.locator('[data-epi="set-axis"][data-epi-axis="0"]').click();
        await frame.locator('.epi-world-entrance [role="alert"]').filter({ hasText: 'Native phase requires' }).waitFor();
        await frame.waitForTimeout(100);
        assert.equal(nativeFrames.length, first, 'Invalid input must not reach the native owner');
        const after = await snapshot('m3-invalid-' + i + '-after');
        assert.equal(after.native.lease, before.native.lease);
        assert.deepEqual(after.native.native, before.native.native);
        assert.deepEqual(after.record, before.record);
    }
    await axisApply(0, { turns: '4', half_degrees: 60 }, 'epi', 'm3-after-invalid-inscription');
    const scopeBefore = await snapshot('m3-native-scope-before'), oldExchange = admissions.at(-1).row.request;
    assert.ok(worldB?.record?.person_ref && worldB.record.world.instance_ref !== record.world.instance_ref);
    for (const [key, value, reason] of [['instance_ref', worldB.record.world.instance_ref, 'foreign_instance_ref'], ['subject_ref', worldB.record.person_ref, 'foreign_subject_ref']]) {
        const request = copy(oldExchange);
        request.request.request[key] = value;
        await assert.rejects(() => op(request), new RegExp('native-expression\\.' + reason), 'Actual other controlled person/instance is refused before transport or cursor mutation');
    }
    await assert.rejects(() => op(copy(oldExchange)), /native-expression\.stale_request/, 'An actual previously acknowledged exchange cannot be replayed');
    const scopeAfter = await snapshot('m3-native-scope-after');
    assert.deepEqual(scopeAfter.native.native, scopeBefore.native.native);
    assert.equal(scopeAfter.native.lease, scopeBefore.native.lease);
    check(true, 'Actual native identity/instance and stale-request refusals preserve the current lease and cursor; finite-owner generation guards remain separately mandatory in the original native suite');
    // Actual PCM proof, distinct from empty zero-elapsed audio: both ordinary
    // trials deliberately Strike the same resident modal amplitudes first. Keep
    // material/frequency/forcing/gain fixed; lensing is the only phase determinant
    // changed before the first real8192 native block. No physical listening claim.
    const audioTrials = [];
    for (const phase of [{ turns: '4', half_degrees: 120 }, { turns: '4', half_degrees: 480 }]) {
        await panel.locator('[data-ni="strike"]').click();
        await frame.waitForFunction(() => document.querySelector('.native-field-panel')?.getAttribute('aria-busy') === 'false');
        const proof = await axisApply(1, phase, 'ni', 'm3-audio-' + phase.half_degrees), admitted = proof.row.field, first = nativeFrames.length, source = sourceAt(nativeInspections, proof.received.s.native.lease, admitted), modes = source.current.m2.resonator.modes;
        assert.equal(modes.length, 9);
        assert.ok(admitted.amplitudes_metres.every(z => Math.hypot(...z) > 0));
        await panel.locator('[data-ni="resume"]').click();
        await witnessed(() => nativeFrames.slice(first).some(r => r.lease === proof.received.s.native.lease && host(r)?.command?.operation === 'advance' && host(r).expected_samples_elapsed === admitted.samples_elapsed));
        await panel.locator('[data-ni="hold"]').click();
        await frame.waitForFunction(() => window.__FIELD_STUDIES__.native().status === 'held');
        const block = nativeFrames.slice(first).find(r => r.lease === proof.received.s.native.lease && host(r)?.command?.operation === 'advance' && host(r).expected_samples_elapsed === admitted.samples_elapsed);
        assert.ok(block);
        assert.equal(host(block).command.frames, 8192);
        assert.equal(host(block).command.muted, false);
        assert.equal(block.field.audio.length, 8192);
        assert.ok(block.field.audio.some(x => x !== 0) && block.field.audio.every(Number.isFinite), 'Nonzero actual native PCM, no muted-zero false pass');
        audioTrials.push({ phase, amplitudes: admitted.amplitudes_metres, modes: modes.map(m => ({ frequency_hz: m.frequency_hz, damping_per_second: m.damping_per_second, excitation: m.excitation })), gains: source.original_field.audio_gains, sample_rate: admitted.sample_rate, request: block.request, audio: block.field.audio });
    }
    for (const key of ['amplitudes', 'modes', 'gains', 'sample_rate'])
        assert.deepEqual(audioTrials[1][key], audioTrials[0][key]);
    assert.deepEqual(audioTrials[1].audio, audioTrials[0].audio, 'The same nine native recurrences emit exactly the same full8192 PCM block for independent lensing phases');
    artifact('m3-lensing-native-pcm-proof.json', { trials: audioTrials, prediction: 'ContinuousField::render_audio uses only resident modal recurrence and gain, independent of clock axis; positive identical preconditions admitted before both blocks', physical_audio: false });
    check(true, 'Lensing has exact torus zero-elapsed invariance and full nonzero8192 native PCM invariance under independently fixed nine-mode input');
    // Carry the current declared material policy, choose explicit phases, then
    // Save through the ordinary native CAS. Preserve the complete original world.
    await axisApply(0, { turns: '1', half_degrees: 120 }, 'epi', 'm3-save-inscription');
    await axisApply(1, { turns: '-1', half_degrees: 360 }, 'epi', 'm3-save-lensing');
    const retained = await snapshot('m3-before-personal-departure', true), expectedClock = copy(retained.native.instrument.influence.native_readback.continuous_clock);
    await sceneNavigate(personal);
    let arrival = await snapshot('m3-personal-departure');
    assert.equal(arrival.native.lease, null);
    assert.equal(arrival.native.status, 'manual');
    assert.deepEqual(arrival.record.native_readback.continuous_clock, expectedClock);
    await sceneNavigate(branches);
    await frame.locator('[data-epi-body]').selectOption(record.world.instance_ref + ':entity:world-branch-4');
    await frame.waitForFunction(ref => window.__FIELD_STUDIES__.getState().selected.includes(ref), record.world.instance_ref + ':entity:world-branch-4');
    await frame.locator('[data-epi="source"]').click();
    await frame.locator('.epi-source-dialog[open]').waitFor();
    await frame.locator('[data-epi-source="return"]').click();
    await sceneNavigate(personal);
    await frame.locator('[data-epi-body]').selectOption(locus);
    await frame.waitForFunction(ref => window.__FIELD_STUDIES__.getState().selected.includes(ref), locus);
    await action('save');
    let ack = await snapshot('m3-axis-saved-personal');
    let doc = await nativeDocument(record.world.instance_ref), fileRead = await savedFile(ack.working, 'm3-axis-current-continuation');
    assert.deepEqual(fileRead, doc);
    assert.deepEqual(doc.scenes.map(s => ({ scene_ref: s.scene_ref, entity_refs: s.entity_refs })), memberships);
    let carrier = doc.scenes.find(s => s.scene_ref === cosmic).presentation.scene.epiWorld;
    assert.deepEqual(carrier.world, record.world);
    assert.deepEqual(carrier.current_material_policy, saved.policy);
    assert.deepEqual(carrier.native_readback.continuous_clock, expectedClock);
    assert.deepEqual(carrier.continuation_start.continuous_clock, expectedClock);
    assert.deepEqual(personalFixed(ack), locked);
    assert.equal(await frame.evaluate(path => window.__FIELD_STUDIES__.openNativeFile(path), ack.working.file.location.path), true);
    await frame.waitForFunction(() => !window.__FIELD_STUDIES__.nativeWorking().pending);
    let reopened = await snapshot('m3-axis-same-file-reopened');
    assert.deepEqual(reopened.working.file, ack.working.file);
    assert.deepEqual(reopened.record.native_readback.continuous_clock, expectedClock);
    assert.deepEqual(reopened.record.continuation_start.continuous_clock, expectedClock);
    assert.deepEqual(personalFixed(reopened), locked);
    // Private form receives the native controlled person, not the shared cosmic
    // process. One real native read/open is used; activity is explicitly absent.
    async function formReading(label) {
        await frame.waitForFunction(() => { const w=window.__FIELD_STUDIES__.nativeWorking(); return w&&!w.pending&&!w.failed; });
        const first = nativeM3.length;
        await action('form');
        const section = frame.getByRole('region', { name: 'Native form and clock' });
        await section.getByRole('button', { name: 'Read current form', exact: true }).click();
        await witnessed(() => nativeM3.length > first);
        let row = nativeM3.at(-1);
        if (row.reading.status === 'absent') {
            await section.getByLabel('Opening form address', { exact: true }).selectOption('0');
            await section.getByLabel('Opening pose', { exact: true }).selectOption('0');
            await section.getByLabel('Opening static aperture', { exact: true }).selectOption('0');
            await section.getByLabel('Opening matrix axis', { exact: true }).selectOption('0');
            await section.getByLabel('Opening clock step', { exact: true }).fill('0');
            await section.getByLabel('Opening transcription', { exact: true }).selectOption('dna');
            const count = nativeM3.length;
            await section.getByRole('button', { name: 'Open this native form', exact: true }).click();
            await witnessed(() => nativeM3.length > count);
            row = nativeM3.at(-1);
        }
        const r = row.reading;
        assert.equal(r.status, 'available');
        assert.equal(r.private, true);
        assert.equal(r.public_export, false);
        assert.equal(r.person_ref, record.person_ref);
        assert.equal(r.nara_ref, record.nara_ref);
        assert.equal(r.identity_source_ref, record.identity_source.source_ref);
        assert.equal(r.identity_revision, record.identity_source.revision);
        assert.equal(r.event_ref, record.world.event_ref);
        assert.equal(r.expression_ref, record.world.instance_ref);
        const currentDoc = await nativeDocument(record.world.instance_ref);
        assert.equal(r.expression_revision, currentDoc.revision);
        const adopted = (currentDoc.profiles ?? []).filter(p => p.profile_ref.startsWith('profile:epi-coordinate-'));
        assert.equal(adopted.length, 1, 'One current native coordinate profile is required');
        assert.equal(r.profile_ref, adopted[0].profile_ref);
        assert.equal(r.profile_revision, String(adopted[0].revision));
        assert.ok(!r.activity_policy);
        assert.equal(r.activity_admitted, false);
        qualifyHinge(r, r.state.form.address);
        artifact(label + '-actual-native-m3.json', row);
        return { section, reading: r };
    }
    await sceneNavigate(cosmic);
    await frame.locator('[data-epi-body]').selectOption(record.world.instance_ref + ':entity:world-current-form-hinge');
    await frame.waitForFunction(ref => window.__FIELD_STUDIES__.getState().selected.includes(ref), record.world.instance_ref + ':entity:world-current-form-hinge');
    const cosmicForm = await formReading('m3-cosmic-private'), cosmicBefore = await snapshot('m3-cosmic-private-before', true), cosmicDoc = await nativeDocument(record.world.instance_ref);
    await cosmicForm.section.getByRole('button', { name: 'Present native hinge on selected formation', exact: true }).click();
    await frame.locator('.nara-personal [role="alert"]').filter({ hasText: 'shared cosmic hinge' }).waitFor();
    assert.equal(await frame.getByRole('button', { name: 'Restore authored formation', exact: true }).count(), 0);
    const cosmicAfter = await snapshot('m3-cosmic-private-refused', true);
    assert.deepEqual(cosmicAfter.rendered.targets, cosmicBefore.rendered.targets);
    assert.deepEqual(await nativeDocument(record.world.instance_ref), cosmicDoc);
    assert.deepEqual(personalFixed(cosmicAfter), personalFixed(cosmicBefore));
    await frame.getByRole('button', { name: 'Return to field', exact: true }).click();
    await sceneNavigate(personal);
    await frame.locator('[data-epi-body]').selectOption(locus);
    await frame.waitForFunction(ref => window.__FIELD_STUDIES__.getState().selected.includes(ref), locus);
    // Establish the declared fixed presentation through the ordinary Quiet
    // control. Native owner/occasion/form remain unchanged by this UI policy.
    if (!(await snapshot('m3-personal-before-quiet')).state.fieldPaused) await action('quiet');
    const personalForm = await formReading('m3-personal-private'), authored = await snapshot('m3-personal-authored-before', true), personalDoc = await nativeDocument(record.world.instance_ref);
    assert.equal(authored.native.lease, null);
    assert.deepEqual(personalFixed(authored), locked);
    await personalForm.section.getByRole('button', { name: 'Present native hinge on selected formation', exact: true }).click();
    await frame.getByRole('button', { name: 'Restore authored formation', exact: true }).waitFor();
    await frame.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const presented = await snapshot('m3-personal-hinge-received', true), shape = privateTargets(presented, personalForm.reading, locus, owners);
    assert.notDeepEqual(slice(presented, locus), slice(authored, locus));
    for (const p of authored.rendered.partitions)
        if (p.entityId !== locus)
            assert.deepEqual(slice(presented, p.entityId), slice(authored, p.entityId));
    assert.deepEqual(await nativeDocument(record.world.instance_ref), personalDoc);
    await frame.evaluate(() => window.__FIELD_STUDIES__.probeSteps(120, 1 / 120));
    const privateResident = await snapshot('m3-personal-hinge-resident-response', true);
    assert.equal(privateResident.rendered.seeds, presented.rendered.seeds);
    assert.notDeepEqual(slice(privateResident, locus, 'positions'), slice(authored, locus, 'positions'), 'The selected actual resident body responds to the directed native hinge');
    privateTargets(privateResident, personalForm.reading, locus, owners);
    assert.deepEqual(personalFixed(privateResident), locked);
    assert.deepEqual(await nativeDocument(record.world.instance_ref), personalDoc);
    const changedAddress = personalForm.reading.state.form.address ^ 1, expectedGeometry = predictHinge(changedAddress), firstM3 = nativeM3.length;
    await personalForm.section.getByLabel('Form operation', { exact: true }).selectOption('change-line');
    await personalForm.section.getByLabel('Line index · 0–5', { exact: true }).fill('0');
    await personalForm.section.getByRole('button', { name: 'Apply native operation', exact: true }).click();
    await witnessed(() => nativeM3.slice(firstM3).some(row => row.request.request.operation === 'apply'));
    const applied = nativeM3.slice(firstM3).find(row => row.request.request.operation === 'apply');
    assert.deepEqual(applied.request.request.operations, [{ operation: 'change-line', line: 0 }]);
    assert.equal(applied.request.request.expected_generation, personalForm.reading.state.identity.profile_generation);
    qualifyHinge(applied.reading, changedAddress);
    assert.equal(applied.reading.state.identity.profile_generation, personalForm.reading.state.identity.profile_generation + 1);
    await frame.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const changed = await snapshot('m3-personal-hinge-line-change', true), changedShape = privateTargets(changed, applied.reading, locus, owners);
    assert.notDeepEqual(slice(changed, locus), slice(presented, locus));
    for (const p of authored.rendered.partitions)
        if (p.entityId !== locus)
            assert.deepEqual(slice(changed, p.entityId), slice(authored, p.entityId));
    assert.deepEqual(personalFixed(changed), locked);
    assert.deepEqual(await nativeDocument(record.world.instance_ref), personalDoc);
    artifact('m3-private-hinge-consumer-proof.json', { original: personalForm.reading, independent_next_address: changedAddress, independent_next_geometry: expectedGeometry, actual_operation: applied, original_shape: shape, changed_shape: changedShape, all_selected_slots: true, all_unrelated_targets_exact: true });
    await frame.getByRole('button', { name: 'Restore authored formation', exact: true }).click();
    await frame.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const restored = await snapshot('m3-personal-authored-restored', true);
    assert.deepEqual(restored.rendered.targets, authored.rendered.targets);
    assert.equal(await frame.getByRole('button', { name: 'Restore authored formation', exact: true }).count(), 0);
    await personalForm.section.getByRole('button', { name: 'Present native hinge on selected formation', exact: true }).click();
    await frame.getByRole('button', { name: 'Restore authored formation', exact: true }).waitFor();
    await frame.getByRole('button', { name: 'Return to field', exact: true }).click();
    await frame.locator('[data-epi-body]').selectOption(record.receiving.personal.centre_entity_refs[0]);
    await frame.waitForFunction(ref => window.__FIELD_STUDIES__.getState().selected.includes(ref), record.receiving.personal.centre_entity_refs[0]);
    await action('form');
    await frame.waitForTimeout(600);
    assert.equal(await frame.getByRole('button', { name: 'Restore authored formation', exact: true }).count(), 0, 'A real native selection/revision change immediately invalidates the private body admission');
    await frame.getByRole('button', { name: 'Return to field', exact: true }).click();
    await sceneNavigate(cosmic);
    const cleared = await snapshot('m3-private-return-to-cosmic', true);
    assert.equal(cleared.document.scenes[cleared.state.sceneIndex].id, cosmic);
    assert.deepEqual(cleared.record.world, record.world);
    check(true, 'Real native private form refuses the cosmic hinge, receives every selected personal hinge target with source-predicted line change, restores authored targets, and clears on actual selection/revision departure');
    // Final durable fence is obtained anew after the actual private encounter;
    // no stale acknowledgement or later restarted reply supplies its revision.
    await sceneNavigate(personal);
    await frame.locator('[data-epi-body]').selectOption(locus);
    await frame.waitForFunction(ref => window.__FIELD_STUDIES__.getState().selected.includes(ref), locus);
    await action('save');
    ack = await snapshot('m3-axis-final-saved-personal');
    doc = await nativeDocument(record.world.instance_ref);
    fileRead = await savedFile(ack.working, 'm3-axis-final-current-continuation');
    assert.deepEqual(fileRead, doc);
    carrier = doc.scenes.find(s => s.scene_ref === cosmic).presentation.scene.epiWorld;
    assert.deepEqual(carrier.world, record.world);
    assert.deepEqual(carrier.current_material_policy, saved.policy);
    assert.deepEqual(carrier.native_readback.continuous_clock, expectedClock);
    assert.deepEqual(doc.scenes.map(s => ({ scene_ref: s.scene_ref, entity_refs: s.entity_refs })), memberships);
    assert.deepEqual(personalFixed(ack), locked);
    await sceneNavigate(cosmic);
    await action('reset');
    const returned = await snapshot('m3-axis-returned-original', true);
    assert.deepEqual(returned.record.world, record.world);
    assert.deepEqual(returned.native.instrument.influence.native_readback.continuous_clock, record.world.native_readback.continuous_clock);
    for (const k of sourceFixed)
        assert.deepEqual(returned.native.instrument.influence.native_readback[k], record.world.native_readback[k]);
    assert.equal(returned.record.current_material_policy, undefined);
    assert.deepEqual(returned.working.file, ack.working.file, 'Unsaved Return does not alter the prior durable file fence');
    const durable = await savedFile({ ...ack.working }, 'm3-axis-final-durable-after-unsaved-return');
    assert.deepEqual(durable, doc, 'Unsaved Return must not masquerade as a replacement of the acknowledged saved world');
    const result = { schema: 'oi.epi-scene-axis-native-proof/v1', passed: true, admissions: admissions.map(p => ({ request: p.row.request, field: p.row.field })), audio_trials: audioTrials, private_form: { passed: true, source_quantum_deg10: 225, selected_entity_ref: locus, transient_only: true }, saved_acknowledgement: { document_revision: doc.revision, scene_count: doc.scenes.length, working: ack.working, policy: carrier.current_material_policy, clock: expectedClock, clock_hands: Object.fromEntries(['clock-a-hand', 'clock-b-hand'].map(role => [role, slice(retained, record.world.instance_ref + ':entity:world-' + role)])), person_ref: record.person_ref, event_ref: record.world.event_ref, instance_ref: record.world.instance_ref, native_file_read_artifact: 'm3-axis-final-current-continuation-file.json' }, saved_file_artifact: 'm3-axis-final-current-continuation-file.json', separate_process_restart: 'required-pending-outer-owned-kernel-restart', return_restores_original: true, standing: 'Actual source-built production browser/real owner/GPU receiving only; no managed Mac, listening, whole journey or H claim' };
    artifact('m3-axis-native-receiving-proof.json', result);
    check(true, 'Independent axes survive ordinary travel, exact native Save/same-file reopen; Return restores both original axes and keeps prior saved material distinct');
    return result;
}
/** Fresh entry is driven only after the outer harness has acknowledged the
 * complete prior native file, stopped its owned kernel, and obtained a new
 * process/native generation. This operation first opens the saved constructor;
 * the same explicit lens phase is then admitted through ordinary Epi controls.
 * It cannot substitute a restarted response for the prior expected clock. */
export async function runSceneAxisRestartGate({ frame, snapshot, retained, prior, nativeComposes, nativeFrames, nativeInspections, exposeNativePanel, artifact, check }) {
    assert.equal(prior?.passed, true);
    assert.equal(prior.saved_acknowledgement.instance_ref, retained.world.instance_ref);
    assert.equal(prior.saved_acknowledgement.person_ref, retained.person_ref);
    assert.equal(prior.saved_acknowledgement.event_ref, retained.world.event_ref);
    const expected = copy(prior.saved_acknowledgement.clock);
    assert.deepEqual(retained.native_readback.continuous_clock, expected);
    assert.deepEqual(retained.continuation_start.continuous_clock, expected);
    const first = nativeComposes.length, startFrames = nativeFrames.length, details = frame.locator('.epi-play');
    if (!await details.evaluate(e => e.open))
        await details.locator('summary').click();
    await frame.locator('[data-epi-axis-turns="1"]').fill(expected.lensing.turns);
    await frame.locator('[data-epi-axis-half="1"]').fill(String(expected.lensing.half_degrees));
    await frame.locator('[data-epi="set-axis"][data-epi-axis="1"]').click();
    await witnessed(() => nativeComposes.slice(first).some(c => c.source?.world?.instance_ref === retained.world.instance_ref));
    await witnessed(() => nativeFrames.slice(startFrames).some(row => host(row)?.command?.operation === 'set-axis'));
    await exposeNativePanel();
    await frame.locator('.native-field-panel [data-ni="hold"]').click();
    await frame.waitForFunction(() => window.__FIELD_STUDIES__.native().status === 'held');
    const opened = nativeComposes.slice(first).filter(c => c.source?.world?.instance_ref === retained.world.instance_ref);
    assert.equal(opened.length, 1);
    const construction = opened[0];
    assert.deepEqual(construction.request.request.request.world.start, retained.continuation_start, 'Actual fresh ordinary owner consumes the exact prior acknowledged complete saved constructor');
    assert.deepEqual(construction.request.request.request.world.material, retained.current_material_policy.material);
    assert.deepEqual(construction.source.world.native_readback.continuous_clock, expected);
    assert.deepEqual(construction.source.world.native_readback.continuation_start, retained.continuation_start);
    const initial = nativeFrames.slice(startFrames).find(row => row.lease === construction.lease && host(row)?.command === undefined);
    assert.ok(initial, 'Actual compose field, before any set-axis/advance, is required');
    assert.equal(initial.field.samples_elapsed, '0');
    assert.deepEqual(initial.field.clock, retained.native_readback.continuous_clock_native, 'Fresh native worker receives the saved complete two-axis input before the first operation');
    const rows = nativeFrames.slice(startFrames).filter(row => row.lease === construction.lease && host(row)?.command?.operation === 'set-axis');
    assert.equal(rows.length, 1);
    assert.deepEqual(host(rows[0]).command, { operation: 'set-axis', axis: 1, phase: phaseInput(expected.lensing) });
    const receiving = await torusReceiving({ frame, snapshot, nativeFrames, artifact, record: retained, label: 'm3-axis-fresh-kernel-received' });
    for (const role of ['clock-a-hand', 'clock-b-hand'])
        assert.deepEqual(slice(receiving.s, retained.world.instance_ref + ':entity:world-' + role), prior.saved_acknowledgement.clock_hands[role], 'Fresh actual clock body has the full prior independently acknowledged target shape and placement');
    artifact('m3-axis-fresh-kernel-proof.json', { expected_before_restart: prior.saved_acknowledgement, actual_constructor: construction, actual_initial: initial, actual_operation: rows[0], current_lease: construction.lease, all4096_receiving: true, standing: 'Same source-built Linux environment, new owned kernel/browser; managed installed Mac remains separate' });
    check(true, 'A separate owned kernel and fresh browser consume the exact prior acknowledged two-axis constructor, both full clock bodies and all4096 native torus samples');
    return { passed: true, clock: expected, prior_document_revision: prior.saved_acknowledgement.document_revision, current_lease: construction.lease, all4096_receiving: true };
}
