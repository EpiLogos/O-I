"""Joined native Studio acceptance over an ALREADY running, qualified browser.

Connects to real CDP and the real cradle frame/Workspace. Does not launch a
browser, replace storage/channel/runtime, inject a document, or manufacture
native observations. Missing prerequisites return UNEXECUTED (exit 2).
The acceptance Expression is commissioned disposable work; retained human
controls still use the app's actual serialized native Workspace.
"""
from pathlib import Path
import argparse, json, math, sys, time, traceback

parser = argparse.ArgumentParser()
parser.add_argument('--cdp', required=True, help='Qualified already running browser CDP endpoint')
parser.add_argument('--expression', required=True, help='Exact admitted acceptance Expression ref')
parser.add_argument('--out', required=True, type=Path, help='Registered task evidence directory')
parser.add_argument('--candidate-identity', type=Path, help='Separately verified launch manifest; retained without claiming this UI test proves binary identity')
args = parser.parse_args()
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print('UNEXECUTED: qualified runner must provide its installed Playwright', file=sys.stderr)
    sys.exit(2)
args.out.mkdir(parents=True, exist_ok=True)
report = {'schema': 'oi.procedural-studio-browser-evidence/v1', 'actual_native_expression_ref': args.expression,
          'mocked_transport': False, 'checks': [], 'native_operations': [], 'native_reads': {},
          'resident_effect': {}, 'page_errors': [], 'execution': 'running', 'limitations': [
          'This Studio run does not certify native musical/body sound or full A01-A18 workloads.',
          'Candidate binary identity belongs to the separate launch manifest.',
          'Running particle deltas prove continuity, not force-specific acceleration or held geometric reception; those have separate native receiving gates.']}
if args.candidate_identity:
    report['candidate_identity'] = json.loads(args.candidate_identity.read_text())

def require(value, message):
    if not value:
        raise AssertionError(message)

def check(name, evidence):
    report['checks'].append({'name': name, 'passed': True, 'evidence': evidence})
    print('PASS ' + name, flush=True)

def positions(snapshot):
    p = snapshot.get('positions')
    require(isinstance(p, list) and len(p) >= 4 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in p),
            'Actual resident GPU positions are unavailable')
    return p

def native_read(frame):
    return frame.evaluate('async ref=>window.__FIELD_STUDIES__.proceduralRequest({operation:"read",expression_ref:ref,scope:{kind:"expression"},after_cursor:null})', args.expression)

def snapshot(frame):
    return frame.evaluate('window.__FIELD_STUDIES__.proceduralSnapshot()')

def resident(frame):
    return frame.evaluate('window.__FIELD_STUDIES__.inspect(true)')

def operation(frame, ref):
    reply = frame.evaluate('async ref=>window.__FIELD_STUDIES__.proceduralRequest({operation:"inspect_operation",operation_ref:ref})', ref)
    return reply['operation']

def current_operation_ref(frame):
    return frame.evaluate('()=>{const section=[...document.querySelectorAll(".procedural-studio details")].find(d=>d.querySelector("summary")?.textContent==="Native operation");return section?.textContent.match(/operation:studio-[A-Za-z0-9-]+/)?.[0]??null;}')

def await_operation(frame, ref, statuses=('applied',)):
    end = time.monotonic() + 20
    while time.monotonic() < end:
        op = operation(frame, ref)
        if op['status'] in statuses:
            return op
        require(op['status'] not in ('failed', 'cancelled', 'interrupted'), 'Native operation failed: ' + str(op.get('failure')))
        frame.page.wait_for_timeout(100)
    raise AssertionError('Actual consumers did not acknowledge operation ' + ref)

def field_telemetry(frame, view_id):
    return frame.evaluate('id=>window.__FIELD_STUDIES__.telemetry()?.config?.entities?.find(e=>e.id===id)?.forces?.strength', view_id)

def refused(frame, intent):
    result = frame.evaluate('async i=>{try{return {accepted:await window.__FIELD_STUDIES__.prepareProceduralStudio(i)}}catch(e){return {refused:String(e.message??e)}}}', intent)
    require(result.get('refused'), 'Wrong/stale basis was accepted')
    return result

try:
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(args.cdp, timeout=15000)
        frames = [(page, frame) for context in browser.contexts for page in context.pages for frame in page.frames]
        candidates = []
        for page, frame in frames:
            try:
                if frame.evaluate('!!window.__FIELD_STUDIES__?.proceduralSnapshot&&!!window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable()'):
                    candidate = snapshot(frame)
                    if candidate.get('view', {}).get('document', {}).get('expression_ref') == args.expression:
                        candidates.append((page, frame, candidate))
            except Exception:
                pass
        if not candidates:
            report['execution'] = 'unexecuted'
            report['prerequisite'] = 'No actual native Studio frame is open on the qualified acceptance Expression'
            raise SystemExit(2)
        require(len(candidates) == 1, 'Acceptance Expression is open in multiple frames; receiver custody is ambiguous')
        page, frame, initial = candidates[0]
        page.on('pageerror', lambda e: report['page_errors'].append(str(e)))
        require(initial['view']['document']['title'] == 'Ta-Onta Procedural Stage Acceptance', 'Run requires the commissioned acceptance work, not other human work')
        require(initial.get('currentConsumers'), 'Actual registered receiving instances/generations are missing')
        report['entry'] = {'page_url': page.url, 'frame_url': frame.url, 'native_reading': frame.evaluate('window.__FIELD_STUDIES__.native()')}
        report['initial_native_basis'] = initial['view']['document']
        check('actual_native_host_and_acceptance_work', {'expression_ref': args.expression, 'revision': initial['view']['document']['revision'], 'consumers': initial['currentConsumers']})
        frame.evaluate('window.__FIELD_STUDIES__.pause()')
        page.wait_for_timeout(150)
        before_navigation = resident(frame)
        frame.evaluate('window.__FIELD_STUDIES__.openEditor("field")')
        frame.locator('[data-action="studio-section"][data-value="procedural"]').click()
        frame.locator('.procedural-studio').wait_for(state='visible')
        frame.get_by_role('button', name='Read current native state', exact=True).click()
        page.wait_for_timeout(200)
        after_navigation = resident(frame)
        require(positions(before_navigation) == positions(after_navigation), 'Opening Studio moved paused resident particles')
        require(before_navigation['seeds'] == after_navigation['seeds'], 'Opening Studio re-seeded particles')
        report['resident_effect']['before_paused_navigation'] = before_navigation
        report['resident_effect']['after_paused_navigation'] = after_navigation
        check('paused_studio_navigation_preserves_resident_particles', {'seeds': before_navigation['seeds'], 'particle_coordinates': len(before_navigation['positions'])})
        frame.get_by_label('Procedural scope', exact=True).select_option('expression')
        native_scene = snapshot(frame)['view']['bindings'][snapshot(frame)['sceneId']]['scene_ref']
        option = frame.get_by_label('Native property', exact=True).locator('option').evaluate_all('(items,scene)=>items.map(o=>({value:o.value,title:o.textContent,address:JSON.parse(o.value)})).find(o=>o.address[1]===scene&&o.address[3]==="force"&&o.address[5]==="strength")', native_scene)
        require(option, 'Acceptance material must include an actual native force strength target')
        frame.get_by_label('Native property', exact=True).select_option(option['value'])
        address_keys = ('expression_ref', 'scene_ref', 'entity_ref', 'component', 'constituent_ref', 'property')
        address = dict(zip(address_keys, option['address']))
        captured = snapshot(frame)
        bound = next((b for b in captured['view']['bindings'].values() if b['scene_ref'] == address['scene_ref']), None)
        occurrence = next((o for o in bound['occurrences'] if o['entity_ref'] == address['entity_ref']), None)
        require(occurrence, 'Property target has no actual admitted occurrence')
        view_id = occurrence['view_entity_id']
        value = frame.get_by_label('Property value', exact=True)
        old_value = float(value.input_value())
        lower = float(value.get_attribute('min'))
        upper = float(value.get_attribute('max'))
        new_value = max(lower, min(upper, old_value + (.2 if old_value + .2 <= upper else -.2)))
        require(new_value != old_value, 'Force fixture leaves no finite edit domain')
        value.fill(str(new_value))
        value.focus()
        saved_handle = value.element_handle()
        frame.get_by_role('button', name='Read current native state', exact=True).click()
        page.wait_for_timeout(250)
        require(value.input_value() == str(new_value), 'Native read replaced uncommitted typed input')
        require(saved_handle.evaluate('(el)=>el===document.querySelector(`input[aria-label="Property value"]`)'), 'Native read re-created the typed control')
        report['native_reads']['before'] = native_read(frame)
        before_row = next(r for r in report['native_reads']['before']['snapshot'] if r['address'] == address)
        frame.get_by_role('button', name='Preview base edit', exact=True).click()
        frame.get_by_role('button', name='Apply prepared change', exact=True).wait_for(state='visible')
        frame.wait_for_function('()=>[...document.querySelectorAll(".procedural-studio details")].find(d=>d.querySelector("summary")?.textContent==="Native operation")?.textContent.includes("operation:studio-")', timeout=20000)
        first_ref = current_operation_ref(frame)
        require(first_ref, 'Human preview returned no actual operation identity')
        preview = await_operation(frame, first_ref, ('prepared',))
        report['native_reads']['prepared'] = native_read(frame)
        preview_row = next(r for r in report['native_reads']['prepared']['snapshot'] if r['address'] == address)
        require(preview_row['authored'] == before_row['authored'], 'Preview applied scene material before confirmation')
        require(address in preview['targets'], 'Prepared native write set lacks the precise property target')
        check('human_preview_is_actual_native_preparation', {'operation_ref': first_ref, 'expected_revision': preview['envelope']['expected_revision'], 'accepted_revision': preview['accepted_revision'], 'address': address})
        frame.get_by_role('button', name='Apply prepared change', exact=True).click()
        applied = await_operation(frame, first_ref)
        require(applied['observations'] and applied['envelope']['participants'], 'Document-only application is not actual receiving')
        report['native_operations'].append(applied)
        report['native_reads']['applied'] = native_read(frame)
        applied_row = next(r for r in report['native_reads']['applied']['snapshot'] if r['address'] == address)
        require(math.isclose(applied_row['authored'], new_value, abs_tol=1e-10), 'Native material property differs from human edit')
        page.wait_for_timeout(100)
        telemetry = field_telemetry(frame, view_id)
        require(isinstance(telemetry, (int, float)) and math.isclose(telemetry, new_value, abs_tol=1e-6), 'Actual field config did not receive human edit while paused')
        require(value.input_value() == str(new_value), 'Applying operation discarded retained human text')
        check('paused_human_apply_reaches_actual_field_consumer', {'operation_ref': first_ref, 'value': new_value, 'field_telemetry_strength': telemetry, 'observations': applied['observations']})
        retained_text = str(new_value + .0123456)
        value.fill(retained_text)
        before_detach = resident(frame)
        frame.locator('[data-action="close-studio"]').click()
        frame.evaluate('window.__FIELD_STUDIES__.openEditor("field")')
        frame.locator('[data-action="studio-section"][data-value="procedural"]').click()
        frame.get_by_label('Procedural scope', exact=True).select_option('expression')
        frame.get_by_label('Native property', exact=True).select_option(option['value'])
        require(frame.get_by_label('Property value', exact=True).input_value() == retained_text, 'Closing/reparenting Studio discarded typed text')
        require(saved_handle.evaluate('(el)=>el===document.querySelector(`input[aria-label="Property value"]`)'), 'Closing/reopening re-created the typed control')
        require(positions(before_detach) == positions(resident(frame)), 'Studio lifecycle moved paused particles')
        check('typed_control_survives_close_reopen_and_native_adoption', {'retained_text': retained_text, 'same_dom_control': True})
        retry_before = native_read(frame)
        retry = frame.evaluate('async ref=>window.__FIELD_STUDIES__.proceduralRequest({operation:"commit",operation_ref:ref})', first_ref)
        retry_after = native_read(frame)
        require(retry.get('repeated') is True and retry_after['document_revision'] == retry_before['document_revision'], 'Retry produced a second application')
        report['retry'] = retry
        check('native_retry_is_same_retained_application', {'operation_ref': first_ref, 'document_revision': retry_after['document_revision']})
        agent_snapshot = snapshot(frame)
        agent_basis = {'expression_ref': args.expression, 'document_revision': agent_snapshot['view']['document']['revision'], 'scene_ref': agent_snapshot['view']['bindings'][agent_snapshot['sceneId']]['scene_ref']}
        agent = {'kind': 'control', 'basis': agent_basis, 'operation_ref': 'operation:studio-negative-' + str(time.time_ns()), 'address': address, 'target': 'entity:' + frame.evaluate('id=>encodeURIComponent(id)', view_id) + ':forces.strength', 'mode': 'set_base', 'value': old_value}
        stale = json.loads(json.dumps(agent)); stale['basis']['document_revision'] -= 1
        foreign = json.loads(json.dumps(agent)); foreign['address']['expression_ref'] = 'expression:wrong-subject'
        refused_stale, refused_foreign = refused(frame, stale), refused(frame, foreign)
        unchanged = native_read(frame)
        require(unchanged['document_revision'] == retry_after['document_revision'], 'Rejected basis changed native material')
        check('agent_stale_and_wrong_subject_refused_without_effect', {'stale': refused_stale, 'wrong_subject': refused_foreign, 'revision': unchanged['document_revision']})
        frame.evaluate('window.__FIELD_STUDIES__.play()')
        page.wait_for_timeout(250)
        before_running = resident(frame)
        agent['operation_ref'] = 'operation:studio-agent-' + str(time.time_ns())
        actual_agent = frame.evaluate('async i=>window.__FIELD_STUDIES__.prepareProceduralStudio(i)', agent)
        require(address in actual_agent['targets'], 'Agent producer addressed a different native target')
        frame.evaluate('async ref=>window.__FIELD_STUDIES__.proceduralRequest({operation:"commit",operation_ref:ref})', actual_agent['envelope']['operation_ref'])
        applied_agent = await_operation(frame, actual_agent['envelope']['operation_ref'])
        require(applied_agent['observations'], 'Running receiving is document-only')
        page.wait_for_timeout(250)
        after_running = resident(frame)
        frame.evaluate('window.__FIELD_STUDIES__.pause()')
        require(after_running['steps'] > before_running['steps'], 'Actual resident engine did not step while running')
        a, b = positions(before_running), positions(after_running)
        require(len(a) == len(b), 'Running property edit changed allocation without scope admission')
        max_delta = max(abs(x-y) for x,y in zip(a,b))
        rms_delta = math.sqrt(sum((x-y)**2 for x,y in zip(a,b))/len(a))
        require(max_delta > 1e-7, 'Actual running particle state remained disconnected')
        require(math.isclose(field_telemetry(frame, view_id), old_value, abs_tol=1e-6), 'Agent edit did not reach the SAME field scalar')
        report['native_operations'].append(applied_agent)
        report['native_reads']['agent_applied'] = native_read(frame)
        report['resident_effect'].update({'before_running': before_running, 'after_running': after_running, 'max_position_delta': max_delta, 'rms_position_delta': rms_delta})
        check('running_agent_and_human_use_same_native_target_and_consumer', {'address': address, 'operation_ref': applied_agent['envelope']['operation_ref'], 'max_position_delta': max_delta, 'rms_position_delta': rms_delta, 'field_telemetry_strength': field_telemetry(frame, view_id), 'proof_class': 'current_native_scalar_config_reception_and_running_continuity'})
        # The actual renderer stores force radius in native world units while
        # the admitted authored control uses its registry's stage-unit factor.
        # Check both real domains against the same actual owner observation.
        radius_option = frame.get_by_label('Native property', exact=True).locator('option').evaluate_all('(items,id)=>items.map(o=>({value:o.value,address:JSON.parse(o.value)})).find(o=>o.address[2]===id&&o.address[3]===\"force\"&&o.address[5]===\"radius\")', address['entity_ref'])
        require(radius_option, 'Actual force radius control is unavailable for unit correspondence')
        frame.get_by_label('Native property', exact=True).select_option(radius_option['value'])
        radius_address = dict(zip(address_keys, radius_option['address']))
        radius_input = frame.get_by_label('Property value', exact=True)
        native_factor = float(radius_input.get_attribute('data-native-factor'))
        require(native_factor > 1, 'Unit correspondence requires an actual nonidentity registry mapping')
        old_radius = float(radius_input.input_value())
        radius_lo, radius_hi = float(radius_input.get_attribute('min')), float(radius_input.get_attribute('max'))
        new_radius = max(radius_lo, min(radius_hi, old_radius + (.01 if old_radius + .01 <= radius_hi else -.01)))
        require(new_radius != old_radius, 'Radius fixture leaves no nonzero edit domain')
        previous_operation = current_operation_ref(frame)
        radius_input.fill(str(new_radius))
        frame.get_by_role('button', name='Preview base edit', exact=True).click()
        frame.wait_for_function('(previous)=>{const t=[...document.querySelectorAll(\".procedural-studio details\")].find(d=>d.querySelector(\"summary\")?.textContent===\"Native operation\")?.textContent;return t?.includes(\"prepared\")&&!t.includes(previous);}', arg=previous_operation, timeout=20000)
        radius_ref = current_operation_ref(frame)
        frame.get_by_role('button', name='Apply prepared change', exact=True).click()
        radius_operation = await_operation(frame, radius_ref)
        report['native_operations'].append(radius_operation)
        radius_read = native_read(frame)
        report['native_reads']['radius_applied'] = radius_read
        rows = [row for obs in radius_read['effective_observations'] if isinstance(obs.get('effective'), dict) for row in obs['effective'].get('values', []) if row.get('address') == radius_address]
        require(rows and any(isinstance(row.get('value'), (int, float)) and math.isclose(row['value'], new_radius, abs_tol=1e-6) for row in rows), 'Actual native observation returned renderer units under an authored-unit address')
        page.wait_for_timeout(100)
        native_radius = frame.evaluate('id=>window.__FIELD_STUDIES__.telemetry()?.config?.entities?.find(e=>e.id===id)?.forces?.radius', view_id)
        require(isinstance(native_radius, (int, float)) and math.isclose(native_radius, new_radius*native_factor, abs_tol=1e-5), 'Actual field radius and authored observation do not correspond through registry units')
        radius_snap = snapshot(frame)
        radius_basis = {'expression_ref': args.expression, 'document_revision': radius_snap['view']['document']['revision'], 'scene_ref': radius_snap['view']['bindings'][radius_snap['sceneId']]['scene_ref']}
        radius_restore = {**agent, 'basis': radius_basis, 'address': radius_address, 'operation_ref': 'operation:studio-radius-restore-' + str(time.time_ns()), 'target': 'entity:' + frame.evaluate('id=>encodeURIComponent(id)', view_id) + ':forces.radius', 'value': old_radius}
        restore_op = frame.evaluate('async i=>window.__FIELD_STUDIES__.prepareProceduralStudio(i)', radius_restore)
        frame.evaluate('async ref=>window.__FIELD_STUDIES__.proceduralRequest({operation:\"commit\",operation_ref:ref})', restore_op['envelope']['operation_ref'])
        report['native_operations'].append(await_operation(frame, restore_op['envelope']['operation_ref']))
        check('native_scalar_units_match_actual_registry_and_field', {'address': radius_address, 'native_factor': native_factor, 'authored_value': new_radius, 'actual_field_value': native_radius, 'effective_rows': rows, 'restored_authored_radius': old_radius})
        # Restore the existing authored base through the normal human UI. Keep
        # the deliberate typed draft separate from material and leave it ready.
        frame.get_by_label('Native property', exact=True).select_option(option['value'])
        frame.get_by_label('Property value', exact=True).fill(str(old_value))
        frame.get_by_role('button', name='Use current base', exact=True).click()
        frame.get_by_role('button', name='Read current native state', exact=True).click()
        page.wait_for_timeout(150)
        page.screenshot(path=str(args.out/'procedural-studio-native.png'))
        report['final_native_snapshot'] = snapshot(frame)
        require(not report['page_errors'], 'Actual installed application emitted page errors')
        report['execution'] = 'passed'
except SystemExit as e:
    exit_code = e.code
except Exception as e:
    traceback.print_exc()
    report['execution'] = 'failed'
    report['checks'].append({'name': 'joined_native_studio', 'passed': False, 'error': str(e)})
    exit_code = 1
else:
    exit_code = 0
finally:
    (args.out/'procedural-studio-native-evidence.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'execution': report['execution'], 'checks': len(report['checks']), 'evidence': str(args.out/'procedural-studio-native-evidence.json')}))
sys.exit(exit_code)
