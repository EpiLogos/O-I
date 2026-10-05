"""Real Studio base Layer receiving supplement; requires an already joined app.
No renderer launch, fake NativeWorkspace, injected control or physical ACK.
Native Scene readback is authored reception; physical/body/audio effects need
separate native owner evidence and are not inferred from these controls.
"""
from pathlib import Path
import argparse, json, sys, traceback
parser=argparse.ArgumentParser()
parser.add_argument('--cdp',required=True)
parser.add_argument('--expression',required=True)
parser.add_argument('--out',required=True,type=Path)
args=parser.parse_args()
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    raise SystemExit('UNEXECUTED: qualified runner needs installed Playwright')
args.out.mkdir(parents=True,exist_ok=True)
report={'schema':'oi.procedural-base-layer-browser-evidence/v1','execution':'running','mocked_transport':False,'checks':[],'native_reads':[],'page_errors':[],'limitations':['Actual native authored material reception; body/audio/effective observations not manufactured.']}
def require(value,message):
    if not value:raise AssertionError(message)
def check(name,evidence):
    report['checks'].append({'name':name,'passed':True,'evidence':evidence});print('PASS '+name,flush=True)
def snapshot(frame):return frame.evaluate('window.__FIELD_STUDIES__.proceduralSnapshot()')
def read(frame):
    value=snapshot(frame)['view']['document'];report['native_reads'].append(value);return value
def material_of(document,target):
    scene=next(s for s in document['scenes'] if s['scene_ref']==target['scene_ref'])
    return next(e for e in scene['presentation']['scene']['entities'] if e['id'] in (target['entity_ref'],target['view_entity_id']))
EDIT="""async intent=>window.__FIELD_STUDIES__.editNativeMaterial(view=>{
 if(view.document.expression_ref!==intent.expression_ref)throw Error('Foreign base Layer Expression');
 const scene=view.document.scenes.find(s=>s.scene_ref===intent.scene_ref);if(!scene?.presentation?.scene)throw Error('Native base Layer Scene unavailable');
 const presentation=structuredClone(scene.presentation),entity=presentation.scene.entities.find(e=>e.id===intent.entity_ref||e.id===intent.view_entity_id);if(!entity)throw Error('Native base Layer occurrence unavailable');
 if(intent.action==='restore'){entity.layers=structuredClone(intent.layers);entity.sequence.steps=structuredClone(intent.steps);entity.name=intent.name;}
 else if(intent.action==='pulse'){entity.name=entity.name===intent.name?intent.name+' receiving':intent.name;}
 else throw Error('Unknown native base Layer activity');
 return [{change:'scene_material_set',scene_ref:intent.scene_ref,presentation}];
})"""
target=None;original=None
try:
    with sync_playwright() as p:
        browser=p.chromium.connect_over_cdp(args.cdp,timeout=15000);candidates=[]
        for context in browser.contexts:
            for page in context.pages:
                for frame in page.frames:
                    try:
                        if frame.evaluate('!!window.__FIELD_STUDIES__?.proceduralSnapshot&&!!window.__FIELD_STUDIES__?.editNativeMaterial&&!!window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable()'):
                            snap=snapshot(frame)
                            if snap['view']['document']['expression_ref']==args.expression:candidates.append((page,frame,snap))
                    except Exception:pass
        if not candidates:
            report.update(execution='unexecuted',prerequisite='No actual joined native Studio receiving frame');raise SystemExit(2)
        require(len(candidates)==1,'Ambiguous actual base Layer receiving frame');page,frame,initial=candidates[0]
        require(initial['view']['document']['title']=='Ta-Onta Procedural Stage Acceptance','Actual commissioned acceptance work required')
        page.on('pageerror',lambda e:report['page_errors'].append(str(e)));report['entry']={'page_url':page.url,'frame_url':frame.url};report['initial_native_basis']=initial['view']['document']
        scene=next(s for s in initial['journey']['scenes'] if s['id']==initial['sceneId']);entity=next((e for e in scene['entities'] if e['kind']=='formation' and not e.get('locked') and e.get('layers')),None)
        if not entity:
            report.update(execution='unexecuted',prerequisite='Actual acceptance work has no unlocked base Layer carrier');raise SystemExit(2)
        binding=initial['view']['bindings'][scene['id']];occurrence=next(o for o in binding['occurrences'] if o['view_entity_id']==entity['id']);layer=entity['layers'][0]
        target={'expression_ref':args.expression,'scene_ref':binding['scene_ref'],'entity_ref':occurrence['entity_ref'],'view_entity_id':entity['id'],'layer_ref':layer['id'],'parent_ref':None}
        original=material_of(initial['view']['document'],target);report['target']=target
        frame.evaluate('id=>{window.__FIELD_STUDIES__.pause();window.__FIELD_STUDIES__.selectEntity(id)}',entity['id'])
        if not frame.evaluate('window.__FIELD_STUDIES__.getState().studioOpen'):frame.locator('[data-action="studio"]').click()
        frame.locator('[data-action="studio-section"][data-value="procedural"]').click()
        panel=frame.get_by_label('Procedural stage',exact=True);panel.get_by_label('Procedural scope',exact=True).select_option('component')
        component=panel.get_by_label('Native component',exact=True)
        key=component.evaluate("""(select,target)=>[...select.options].find(o=>{const a=JSON.parse(o.value);return a[2]===target.entity_ref&&a[3]==='layer'&&a[4]===target.layer_ref&&a[5].length===1&&a[5][0]===null;})?.value""",target)
        require(key,'Actual explicit-base Layer component is not exposed by the Studio');component.select_option(key)
        depth=panel.locator('[data-base-layer-property="z"]');require(depth.count()==1,'Actual typed base Layer control is not mounted')
        frame.evaluate("()=>{window.__BASE_LAYER_CONTROL__=document.querySelector('[data-base-layer-property=z]');}")
        proposed=layer['z']+.01 if layer['z']<99.99 else layer['z']-.01;depth.fill(str(proposed))
        frame.evaluate(EDIT,{**target,'action':'pulse','name':original['name']});pulse=read(frame)
        require(frame.evaluate('()=>window.__BASE_LAYER_CONTROL__.isConnected&&window.__BASE_LAYER_CONTROL__===document.querySelector("[data-base-layer-property=z]")'),'Native pulse replaced the actual typed base control')
        require(depth.input_value()==str(proposed),'Native pulse lost unfinished base depth input')
        require(frame.evaluate('()=>document.activeElement===window.__BASE_LAYER_CONTROL__'),'Native pulse lost actual base input focus')
        check('base_editor_native_pulse_retains_actual_control_focus_and_text',{'native_revision':pulse['revision'],'target':target,'typed':proposed})
        holder=depth.locator('xpath=..').locator('xpath=..');holder.get_by_role('button',name='Preview base material edit',exact=True).click()
        require(read(frame)['revision']==pulse['revision'],'Obsolete original base intent wrote native material')
        require(depth.input_value()==str(proposed),'Stale CAS refusal lost typed base input')
        check('base_editor_stale_native_basis_refuses_before_mutation',{'native_revision':pulse['revision'],'target':target})
        holder.get_by_role('button',name='Use current base material',exact=True).click();depth.fill(str(proposed));holder.get_by_role('button',name='Preview base material edit',exact=True).click()
        panel.get_by_role('button',name='Apply prepared change',exact=True).wait_for(state='visible',timeout=15000);require(panel.get_by_role('button',name='Apply prepared change',exact=True).is_enabled(),'Actual owner did not prepare the base Layer change')
        prepared=read(frame);prepared_material=material_of(prepared,target)
        require(next(l for l in prepared_material['layers'] if l['id']==target['layer_ref'])['z']==layer['z'],'Native Prepare changed authored base material before Apply')
        report['prepared_native_basis']=prepared
        panel.get_by_role('button',name='Apply prepared change',exact=True).click()
        frame.wait_for_function('''intent=>{const document=window.__FIELD_STUDIES__.proceduralSnapshot().view.document;
          if(document.expression_ref!==intent.expression_ref||document.revision<=intent.prepared_revision)return false;
          const scene=document.scenes.find(s=>s.scene_ref===intent.scene_ref),entity=scene?.presentation?.scene?.entities?.find(e=>e.id===intent.entity_ref||e.id===intent.view_entity_id);
          return entity?.layers?.find(l=>l.id===intent.layer_ref)?.z===intent.proposed;
        }''',arg={**target,'prepared_revision':prepared['revision'],'proposed':proposed},timeout=15000)
        applied=read(frame);after=material_of(applied,target);actual=next(l for l in after['layers'] if l['id']==target['layer_ref']);require(actual['z']==proposed,'Native base control wrote another layer')
        require(after['sequence']['steps']==original['sequence']['steps'],'Native base control rewrote state carriers')
        check('human_base_control_reaches_exact_native_base_and_preserves_states',{'native_revision':applied['revision'],'target':target,'actual_depth_stage_units':actual['z'],'effective_body':'unclaimed; separate owner gate'})
        frame.evaluate(EDIT,{**target,'action':'restore','layers':original['layers'],'steps':original['sequence']['steps'],'name':original['name']});final=read(frame);restored=material_of(final,target)
        require(restored['layers']==original['layers'] and restored['sequence']['steps']==original['sequence']['steps'],'Actual native owner did not restore source material')
        require(not report['page_errors'],'Actual app page errors '+str(report['page_errors']));report['final_native_basis']=final;report['execution']='passed';page.screenshot(path=str(args.out/'base-layer-native.png'),full_page=True)
except SystemExit:
    raise
except Exception as e:
    report.update(execution='failed',failure=str(e),traceback=traceback.format_exc(),recovery={'target':target,'original_material':original,'owner_route':'Actual Workspace flushed-current SceneMaterialSet; preserve current procedural receipt/source metadata'});print(report['traceback'],file=sys.stderr);sys.exit(1)
finally:
    (args.out/'base-layer-evidence.json').write_text(json.dumps(report,indent=2)+'\n')
