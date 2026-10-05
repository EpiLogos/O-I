"""Actual source editor receiving tests on the already running native stage.

This driver neither launches a renderer nor replaces the transport, document
store or source editor. It edits the commissioned acceptance work through its
existing Workspace owner, retains exact native reads, and restores source
material through that owner. Missing source/editor prerequisites stay
UNEXECUTED. It does not certify physical/body/audio effects.
"""
from pathlib import Path
import argparse, json, sys, traceback
parser=argparse.ArgumentParser()
parser.add_argument('--cdp',required=True)
parser.add_argument('--expression',required=True)
parser.add_argument('--out',required=True,type=Path)
parser.add_argument('--image-source',required=True,type=Path,help='Actual owner-approved PNG/JPEG/WebP source file, no generated browser FileReader fixture')
args=parser.parse_args()
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print('UNEXECUTED: qualified runner must provide installed Playwright',file=sys.stderr);sys.exit(2)
args.out.mkdir(parents=True,exist_ok=True)
if not args.image_source.is_file() or args.image_source.stat().st_size>8_000_000:raise SystemExit('Actual supported image source <=8 MB required')
report={'schema':'oi.source-editor-browser-evidence/v1','execution':'running','mocked_transport':False,'actual_native_expression_ref':args.expression,'checks':[],'native_reads':[],'page_errors':[],'limitations':['Source/editor native material admission only; no body/geometry/audio effect claim.']}
def require(value,message):
    if not value:raise AssertionError(message)
def check(name,evidence):
    report['checks'].append({'name':name,'passed':True,'evidence':evidence});print('PASS '+name,flush=True)
def snapshot(frame):
    return frame.evaluate('window.__FIELD_STUDIES__.proceduralSnapshot()')
def read(frame):
    value=snapshot(frame)['view']['document'];report['native_reads'].append(value);return value
# Callback is computed INSIDE the actual native Workspace after flushDraft.
# It starts from its current native Scene and retains every other field.
SOURCE_EDIT="""async intent=>{
 return window.__FIELD_STUDIES__.editNativeMaterial(view=>{
  if(view.document.expression_ref!==intent.expression_ref)throw Error('Foreign source Expression');
  const scene=view.document.scenes.find(s=>s.scene_ref===intent.scene_ref);
  if(!scene?.presentation?.scene)throw Error('Actual source material unavailable');
  const presentation=structuredClone(scene.presentation),material=presentation.scene;
  const entity=material.entities.find(e=>e.id===intent.view_entity_id||e.id===intent.entity_ref);
  if(!entity)throw Error('Actual source occurrence unavailable');
  const state=entity.sequence.steps.find(s=>s.id===intent.state_ref);
  if(intent.action==='restore'){entity.sequence.steps=structuredClone(intent.original_steps);entity.layers=structuredClone(intent.original_layers);}
  else{
   if(!state)throw Error('Actual source state unavailable');
   if(intent.action==='reorder'){entity.sequence.steps.reverse();if(!state.layers)throw Error('Retained state layers required');state.layers.reverse();}
   else if(intent.action==='set_source'){state.source={kind:'ascii',ascii:{text:intent.value,fontFamily:'monospace'}};}
   else if(intent.action==='set_layer'){const layer=state.layers?.find(l=>l.id===intent.layer_ref);if(!layer)throw Error('Actual source layer unavailable');layer.text=intent.value;}
   else if(intent.action==='remove_state'){if(entity.sequence.steps.length<2)throw Error('Keep another actual state');entity.sequence.steps=entity.sequence.steps.filter(s=>s.id!==intent.state_ref);}
   else throw Error('Unknown source edit');
  }
  return [{change:'scene_material_set',scene_ref:intent.scene_ref,presentation}];
 });
}"""
def material_of(document,scene_ref,entity_ref,view_id):
    scene=next(s for s in document['scenes'] if s['scene_ref']==scene_ref)
    return next(e for e in scene['presentation']['scene']['entities'] if e['id'] in (entity_ref,view_id))
def state_layer(document,target):
    material=material_of(document,target['scene_ref'],target['entity_ref'],target['view_entity_id'])
    state=next(s for s in material['sequence']['steps'] if s['id']==target['state_ref'])
    return next(l for l in state['layers'] if l['id']==target['layer_ref'])
frame=None;target=None;original=None
try:
    with sync_playwright() as p:
        browser=p.chromium.connect_over_cdp(args.cdp,timeout=15000)
        candidates=[]
        for context in browser.contexts:
            for page in context.pages:
                for candidate in page.frames:
                    try:
                        if candidate.evaluate('!!window.__FIELD_STUDIES__?.editNativeMaterial&&!!window.__FIELD_STUDIES__?.commitNativeDraft&&!!window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable()'):
                            snap=snapshot(candidate)
                            if snap['view']['document']['expression_ref']==args.expression:candidates.append((page,candidate,snap))
                    except Exception:pass
        if not candidates:
            report.update(execution='unexecuted',prerequisite='No joined native source editor Workspace frame on this acceptance work');raise SystemExit(2)
        require(len(candidates)==1,'Ambiguous receiver: acceptance work has multiple frames')
        page,frame,initial=candidates[0]
        require(initial['view']['document']['title']=='Ta-Onta Procedural Stage Acceptance','Source tests require the commissioned acceptance work')
        page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
        report['entry']={'page_url':page.url,'frame_url':frame.url}
        report['initial_native_basis']=initial['view']['document']
        current=next(s for s in initial['journey']['scenes'] if s['id']==initial['sceneId'])
        found=None
        for entity in current['entities']:
            if entity['kind']!='formation' or entity.get('locked') or len(entity['sequence']['steps'])<2:continue
            for state in entity['sequence']['steps']:
                if len(state.get('layers',[]))>=2:found=(entity,state,state['layers'][0]);break
            if found:break
        if not found:
            report.update(execution='unexecuted',prerequisite='Actual acceptance material needs unlocked formation, two stable states and two retained state layers');raise SystemExit(2)
        entity,state,layer=found
        binding=initial['view']['bindings'][current['id']]
        occurrence=next(o for o in binding['occurrences'] if o['view_entity_id']==entity['id'])
        target={'expression_ref':args.expression,'scene_ref':binding['scene_ref'],'entity_ref':occurrence['entity_ref'],'view_entity_id':entity['id'],'state_ref':state['id'],'layer_ref':layer['id']}
        original=material_of(initial['view']['document'],target['scene_ref'],target['entity_ref'],target['view_entity_id'])
        if frame.evaluate('window.__FIELD_STUDIES__.getState().studioOpen'):
            frame.locator('[data-action="close-inspector"]').click()
        frame.evaluate('id=>{window.__FIELD_STUDIES__.pause();window.__FIELD_STUDIES__.selectEntity(id)}',entity['id'])
        frame.locator('[data-rail="formation"]').click()
        frame.locator('#live-content [data-action="select-step"]').evaluate_all("(els,id)=>{const button=els.find(e=>e.dataset.stateRef===id);if(!button)throw Error('Actual stable state button unavailable');button.click();}",state['id'])
        # Exercise the actual Inspector producer and global receiving event
        # route with two different real states. No synthetic select-step button.
        frame.locator('#live-content [data-action="entity-sequence"]').first.click()
        for actual_state in entity['sequence']['steps'][:2]:
            frame.locator('#inspector-content [data-action="select-step"]').evaluate_all("(els,id)=>{const button=els.find(e=>e.dataset.stateRef===id);if(!button)throw Error('Actual Inspector state identity missing');button.click();}",actual_state['id'])
            require(frame.locator('#inspector-content [data-bind="step.hold"]').get_attribute('data-editor-state')==actual_state['id'],'Studio sequence selected the previously edited state')
        check('studio_two_state_buttons_reach_exact_existing_editors',{'state_refs':[k['id'] for k in entity['sequence']['steps'][:2]],'producer':'actual Inspector HTML / existing global select-step'})
        frame.locator('[data-rail="formation"]').click()
        frame.locator('#live-content [data-action="select-step"]').evaluate_all("(els,id)=>{const button=els.find(e=>e.dataset.stateRef===id);if(!button)throw Error('Actual stable state button unavailable');button.click();}",state['id'])
        frame.locator('#live-content .live-layers > summary').click()
        frame.evaluate("""ref=>{const row=[...document.querySelectorAll('#live-content [data-layer-ref]')].find(e=>e.dataset.layerRef===ref);const input=row?.querySelector('[data-layer-text]');if(!input?.dataset.editorState)throw Error('Source adapter is not mounted');window.__SOURCE_EDITOR_CONTROL__=input;input.focus();}""",layer['id'])
        frame.evaluate("""()=>{const input=window.__SOURCE_EDITOR_CONTROL__;input.value=input.value==='H'?'I':'H';input.dispatchEvent(new Event('input',{bubbles:true}));}""")
        typed=frame.evaluate('window.__SOURCE_EDITOR_CONTROL__.value')
        frame.evaluate(SOURCE_EDIT,{**target,'action':'reorder'})
        reordered=read(frame)
        require(frame.evaluate('()=>window.__SOURCE_EDITOR_CONTROL__.isConnected&&window.__SOURCE_EDITOR_CONTROL__===document.querySelector("#live-content [data-editor-dirty=true]")'),'Native adoption replaced dirty source control')
        require(frame.evaluate('window.__SOURCE_EDITOR_CONTROL__.value')==typed,'Native adoption lost unfinished source text')
        check('native_update_retains_same_source_control_and_text',{'native_revision':reordered['revision'],'target':target,'typed':typed})
        frame.evaluate('()=>window.__SOURCE_EDITOR_CONTROL__.dispatchEvent(new Event("change",{bubbles:true}))')
        require(frame.evaluate('window.__FIELD_STUDIES__.commitNativeDraft()'),'Human source edit was not committed by its actual Workspace')
        applied=read(frame);require(state_layer(applied,target)['text']==typed,'Human edit reached a neighbouring state/layer')
        edited=material_of(applied,target['scene_ref'],target['entity_ref'],target['view_entity_id'])
        before_other={s['id']:s for s in original['sequence']['steps'] if s['id']!=target['state_ref']}
        for s in edited['sequence']['steps']:
            if s['id'] in before_other:require(s['layers']==before_other[s['id']]['layers'],'Human edit changed another state')
        check('reordered_state_and_layer_edit_reaches_original_native_ids',{'native_revision':applied['revision'],'target':target,'actual_text':state_layer(applied,target)['text']})
        # Explicit discard on an unchanged native basis must not commit the
        # dirty value through a blur/change before the button handles it.
        local_before=frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')
        frame.evaluate("()=>{const input=window.__SOURCE_EDITOR_CONTROL__;input.focus();input.value='X';input.dispatchEvent(new Event('input',{bubbles:true}));window.__FIELD_STUDIES__.pause();}")
        frame.locator('#live-content [data-action="source-editor-current"]').click()
        require(frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')==local_before,'Discard committed the unfinished source value through blur')
        frame.evaluate("ref=>{const row=[...document.querySelectorAll('#live-content [data-layer-ref]')].find(e=>e.dataset.layerRef===ref);window.__SOURCE_EDITOR_CONTROL__=row.querySelector('[data-layer-text]');}",layer['id'])
        require(frame.evaluate('window.__SOURCE_EDITOR_CONTROL__.value')==typed,'Discard did not return to current acknowledged source')
        check('discard_unchanged_basis_never_writes_dirty_source',{'native_revision':applied['revision'],'target':target,'actual_text':typed})
        frame.evaluate("()=>{const input=window.__SOURCE_EDITOR_CONTROL__;input.focus();input.value='E';input.dispatchEvent(new Event('input',{bubbles:true}));}")
        frame.locator('#live-content [data-editor-dirty="true"]').press('Escape')
        require(frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')==local_before,'Escape committed unfinished layer text')
        frame.evaluate("ref=>{const row=[...document.querySelectorAll('#live-content [data-layer-ref]')].find(e=>e.dataset.layerRef===ref);window.__SOURCE_EDITOR_CONTROL__=row.querySelector('[data-layer-text]');}",layer['id'])
        check('escape_cancels_source_draft_without_native_write',{'native_revision':applied['revision'],'target':target})
        # The original DOM now has the acknowledged source basis. A new draft
        # must refuse if a genuine native writer changes that same property.
        frame.evaluate("""()=>{const input=window.__SOURCE_EDITOR_CONTROL__;input.focus();input.value='D';input.dispatchEvent(new Event('input',{bubbles:true}));}""")
        frame.evaluate(SOURCE_EDIT,{**target,'action':'set_layer','value':'N'})
        conflict_before=read(frame)
        local_before=frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')
        frame.evaluate('()=>window.__SOURCE_EDITOR_CONTROL__.dispatchEvent(new Event("change",{bubbles:true}))')
        conflict_after=read(frame)
        require(frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')==local_before,'Conflicting source event mutated the current working document')
        require(conflict_after['revision']==conflict_before['revision'] and state_layer(conflict_after,target)['text']=='N','Conflicting source edit overwrote native source')
        require(frame.evaluate('window.__SOURCE_EDITOR_CONTROL__.value')=='D','Conflicting source refusal lost draft')
        check('concurrent_source_change_refuses_and_retains_text',{'native_revision':conflict_after['revision'],'target':target,'retained_text':'D','native_text':'N'})
        others=[e for e in current['entities'] if e['id']!=entity['id']]
        if not others:raise AssertionError('Acceptance work must include another actual subject for wrong-subject test')
        frame.evaluate('id=>window.__FIELD_STUDIES__.selectEntity(id)',others[0]['id'])
        before=read(frame)
        local_before=frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')
        frame.evaluate('()=>window.__SOURCE_EDITOR_CONTROL__.dispatchEvent(new Event("change",{bubbles:true}))')
        after=read(frame);require(frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')==local_before,'Wrong subject source event mutated the current working document');require(after['revision']==before['revision'] and state_layer(after,target)['text']=='N','Wrong selected subject admitted source write')
        check('wrong_selected_subject_refuses_source_write',{'native_revision':after['revision'],'target':target,'selected_view_entity_id':others[0]['id']})
        frame.evaluate('id=>window.__FIELD_STUDIES__.selectEntity(id)',entity['id'])
        frame.evaluate(SOURCE_EDIT,{**target,'action':'remove_state'})
        absent_before=read(frame)
        local_before=frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')
        frame.evaluate('()=>window.__SOURCE_EDITOR_CONTROL__.dispatchEvent(new Event("change",{bubbles:true}))')
        absent_after=read(frame);require(frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')==local_before,'Missing state event mutated the neighbouring working state');require(absent_after['revision']==absent_before['revision'],'Missing source state redirected edit onto neighbour')
        remaining=material_of(absent_after,target['scene_ref'],target['entity_ref'],target['view_entity_id'])['sequence']['steps']
        require(all(s['id']!=target['state_ref'] for s in remaining),'Actual native state removal did not happen')
        require(frame.evaluate('window.__SOURCE_EDITOR_CONTROL__.value')=='D','Missing state refusal lost source draft')
        check('missing_state_refuses_source_write',{'native_revision':absent_after['revision'],'target':target,'remaining_state_refs':[s['id'] for s in remaining]})
        frame.evaluate(SOURCE_EDIT,{**target,'action':'restore','original_steps':original['sequence']['steps'],'original_layers':original.get('layers')})
        # Dirty old subtree remains the exact retained editor until explicit
        # reconciliation. Use the actual normal button, not DOM replacement.
        frame.locator('#live-content [data-action="source-editor-current"]').click()
        frame.locator('#live-content [data-action="select-step"]').evaluate_all("(els,id)=>{const button=els.find(e=>e.dataset.stateRef===id);if(!button)throw Error('Restored stable state unavailable');button.click();}",state['id'])
        require(frame.evaluate('window.__FIELD_STUDIES__.commitNativeDraft()'),'Restored source selection was not acknowledged by its Workspace')
        final=read(frame)
        require(frame.evaluate("""ref=>[...document.querySelectorAll('#live-content [data-layer-ref]')].find(e=>e.dataset.layerRef===ref)?.querySelector('[data-layer-text]')?.value""",layer['id'])==layer['text'],'Explicit discard did not adopt current original source')
        check('explicit_discard_adopts_current_source',{'native_revision':final['revision'],'target':target,'actual_text':layer['text']})
        # Capture an actual upload intent with the normal image chooser,
        # then change its authored native source before receiving that file.
        # This detects the former receiver's ID-only reacquisition defect.
        frame.locator('#live-content [data-action="image-suite"]').click()
        frame.locator('#capture-panel [data-action="source-kind"]').select_option('image')
        require(frame.evaluate('window.__FIELD_STUDIES__.commitNativeDraft()'),'Image source basis did not commit through actual Workspace')
        with page.expect_file_chooser() as chosen:
            frame.locator('#capture-panel [data-action="source-image"]').click()
        chooser=chosen.value
        frame.evaluate(SOURCE_EDIT,{**target,'action':'set_source','value':'Native source while chooser open'})
        upload_before=read(frame)
        upload_working=frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')
        chooser.set_files(str(args.image_source.resolve()))
        frame.locator('#capture-panel [data-source-upload-retained]').wait_for(state='visible',timeout=15000)
        require(frame.evaluate('JSON.stringify(window.__FIELD_STUDIES__.getDocument())')==upload_working,'Image receiver overwrote an intervening native source')
        require(read(frame)['revision']==upload_before['revision'],'Refused upload wrote native material')
        require(frame.locator('#source-file').evaluate('(input)=>input.files.length===1&&input.files[0].name')==args.image_source.name,'Refused upload lost the actual chosen file')
        check('native_source_change_refuses_async_image_and_retains_file',{'native_revision':upload_before['revision'],'target':target,'actual_file':args.image_source.name})
        # A real subsequent Workspace adoption/rerender must leave the actual
        # retry/discard controls reachable with the same chosen FileInput.
        frame.evaluate(SOURCE_EDIT,{**target,'action':'set_source','value':'Another actual native source pulse'})
        pulsed=read(frame)
        frame.locator('#capture-panel [data-action="retry-source-upload"]').wait_for(state='visible',timeout=15000)
        frame.locator('#capture-panel [data-action="retry-source-upload"]').click()
        require(read(frame)['revision']==pulsed['revision'],'Retry redirected the retained upload onto the changed source')
        require(frame.locator('#source-file').evaluate('(input)=>input.files.length')==1,'Native pulse/retry lost the chosen file')
        frame.locator('#capture-panel [data-action="discard-source-upload"]').click()
        require(frame.locator('#source-file').evaluate('(input)=>input.files.length')==0,'Explicit discard failed to clear actual FileInput')
        require(frame.locator('[data-source-upload-retained]').count()==0,'Explicit discard left an orphaned upload notice')
        check('native_pulse_retains_upload_retry_discard_reachability',{'native_revision':pulsed['revision'],'target':target,'retry':'refused original changed basis','discard':'actual FileInput cleared'})
        frame.evaluate(SOURCE_EDIT,{**target,'action':'restore','original_steps':original['sequence']['steps'],'original_layers':original.get('layers')})
        final=read(frame)
        report['final_native_basis']=final
        require(not report['page_errors'],'Application page errors: '+str(report['page_errors']))
        page.screenshot(path=str(args.out/'source-editor-native.png'),full_page=True)
        report['execution']='passed'
except SystemExit:
    raise
except Exception as e:
    report['execution']='failed';report['failure']=str(e);report['recovery']={'target':target,'original_source_material':original,'required_route':'actual Workspace edit callback from its flushed current Scene; preserve current receipt/source metadata'};report['traceback']=traceback.format_exc();print(report['traceback'],file=sys.stderr)
    sys.exit(1)
finally:
    (args.out/'source-editor-evidence.json').write_text(json.dumps(report,indent=2)+'\n')

