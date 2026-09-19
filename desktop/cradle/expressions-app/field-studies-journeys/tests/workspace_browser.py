"""Reviewed Expressions UI: real Chromium inputs and native GPU state.
Uses an explicit in-memory localStorage double for the inline-content origin.
No generated mockups, changed URL policies, or replacement simulation.
"""
from pathlib import Path
import json, traceback
from harness import browser_session
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'evidence-native';E.mkdir(exist_ok=True)
HTML=(ROOT/'public/index.html').read_text()
STORAGE="<script>window.__TEST_STORAGE__={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__TEST_STORAGE__[k]??null,setItem:(k,v)=>window.__TEST_STORAGE__[k]=String(v),removeItem:k=>delete window.__TEST_STORAGE__[k]},configurable:true});</script>"
results=[];errors=[]
def require(value,why):
 if not value:raise AssertionError(why)
def check(name,value,evidence=None):
 require(value,name);results.append({'name':name,'ok':True,'evidence':evidence});print('PASS',name,flush=True)
def state(p):return p.evaluate('window.__FIELD_STUDIES__.getState()')
def doc(p):return p.evaluate('window.__FIELD_STUDIES__.getDocument()')
def gpu(p):return p.evaluate('window.__FIELD_STUDIES__.inspect(true)')
def act(p,name,tail=''):
 p.locator('[data-action="'+name+'"]'+tail).filter(visible=True).first.click(timeout=20000);p.wait_for_timeout(90)
def open_page(p,fixture,storage=True):
 start=(STORAGE if storage else '')+'<script>window.__JOURNEY__='+json.dumps(fixture).replace('</','<\\/')+';</script>'
 p.set_content(HTML.replace('<head>','<head>'+start,1),wait_until='load');p.wait_for_function('!!window.__FIELD_STUDIES__?.inspect()');p.evaluate('window.__FIELD_STUDIES__.pause()');p.wait_for_timeout(100)
def drag(p,x,y,dx,dy,shift=False):
 if shift:p.keyboard.down('Shift')
 p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+dx,y+dy,steps=6);p.mouse.up()
 if shift:p.keyboard.up('Shift')
 p.wait_for_timeout(90)
try:
 with browser_session({'width':1440,'height':1000},'reduce') as (browser,ctx,p):
  p.on('pageerror',lambda error:errors.append(str(error)))
  p.set_content('<body></body>');p.add_script_tag(content=(ROOT/'build/native-harness.js').read_text())
  fixture=p.evaluate('()=>{const j=NATIVE_TEST.fieldStudies();j.scenes.forEach(s=>s.field.params.count=2048);return j;}')
  open_page(p,fixture)
  check('Canvas has one library entry and direct still/video icons, no compulsory editorial copy',p.locator('.masthead [data-action="library"]').count()==1 and p.locator('#record-button').is_visible() and p.locator('.masthead [data-action="capture-image"]').is_visible() and p.locator('.gesture-note,.page-text,.edit-status,.version-note,.wordmark,[data-action="keep"]').count()==0)
  boxes=p.locator('#tool-rail button').evaluate_all('(buttons)=>buttons.map(b=>{const r=b.getBoundingClientRect();const s=b.querySelector("svg").getBoundingClientRect();return {cy:r.y+r.height/2,sy:s.y+s.height/2,height:r.height};})')
  check('All seven icon centres align in a thinner rail; Interact comes first',len(boxes)==7 and max(x['cy'] for x in boxes)-min(x['cy'] for x in boxes)<.1 and all(abs(x['cy']-x['sy'])<.1 for x in boxes) and p.locator('#tool-rail').bounding_box()['height']<=46 and p.locator('#tool-rail button').first.get_attribute('data-rail')=='interact',boxes)
  before=gpu(p);base=doc(p)
  act(p,'tool-select');require(state(p)['tool']=='select' and not state(p)['railExpanded'] and not state(p)['inspectorOpen'],'select stays put');act(p,'tool-select');require(state(p)['tool']=='select','select is idempotent')
  formation_initial=p.locator('#live-workspace').is_visible();act(p,'tool-formation');formation_flipped=p.locator('#live-workspace').is_visible();act(p,'tool-formation');require(formation_initial!=formation_flipped and p.locator('#live-workspace').is_visible()==formation_initial,'formation sequence toggles in one click')
  act(p,'tool-text');text_open=p.locator('#context-panel').is_visible();act(p,'tool-text');require(text_open and not p.locator('#context-panel').is_visible(),'text context one-click open/close')
  act(p,'tool-pin');pin=state(p);act(p,'tool-pin');closed=state(p);require(pin['tool']=='pin' and pin['railExpanded'] and closed['tool']!='pin' and not closed['railExpanded'],'pin one-click open/close leaves the cursor')
  act(p,'objects');objects_open=p.locator('#context-panel').is_visible();act(p,'objects');require(objects_open and not p.locator('#context-panel').is_visible(),'objects context one-click open/close')
  check('Every tool opens and closes its own surface in one click without mutating the expression',doc(p)==base and gpu(p)['seeds']==before['seeds'])
  p.evaluate("window.__FIELD_STUDIES__.openEditor('field')");act(p,'close-studio')
  check('Closing the Studio explicitly returns to the quiet canvas',not state(p)['studioOpen'] and not state(p)['inspectorOpen'] and not p.locator('#inspector').is_visible())
  p.locator('[data-orbit="reset"]').click();before=gpu(p);base=doc(p);initial=state(p)['camera'];box=p.locator('.orbit-pad').bounding_box();x=box['x']+box['width']*.28;y=box['y']+box['height']*.30
  drag(p,x,y,27,18);rotated=state(p)['camera'];check('Orbital drag changes yaw/pitch without a field force or document edit',rotated['yaw']!=initial['yaw'] and rotated['pitch']!=initial['pitch'] and not state(p)['pointerActive'] and doc(p)==base)
  p.locator('.orbit-pad').hover();p.mouse.wheel(0,-100);p.wait_for_timeout(80);zoom=state(p)['camera']['zoom'];require(zoom>initial['zoom'],'orbital wheel zoom')
  drag(p,x,y,16,-13,True);c=state(p)['camera'];check('Orbital pan and zoom share the saved camera and preserve working-plane settings',abs(c['panX']-16)<.001 and abs(c['panY']+13)<.001 and c['zoom']==zoom and all(c[k]==initial[k] for k in ['plane','depth','grid','snap']),c)
  p.locator('[data-axis="Z"]').click();require(state(p)['camera']['mode']=='2d','axis view')
  p.locator('.orbit-pad').focus();p.keyboard.press('ArrowRight');require(state(p)['camera']['yaw']!=0,'keyboard orbit')
  p.keyboard.press('Home');after=gpu(p);c=state(p)['camera']
  check('Axis targets and keyboard controls work without physics steps, target rebakes or reseeds',c['yaw']==c['pitch']==c['panX']==c['panY']==0 and c['zoom']==1 and all(before[k]==after[k] for k in ['simTime','steps','seeds','bakes','positions']))
  check('Camera tool has no duplicate persistent toolbar or instruction pill',not p.locator('#view-controls').is_visible() and not p.locator('#tool-hint').is_visible() and p.locator('#orbit-control').is_visible())
  p.locator('[data-orbit="reset"]').click();p.mouse.move(790,450);p.wait_for_timeout(80)
  coords=p.locator('#coordinates').bounding_box();numbers=p.locator('#coordinates b').all_text_contents();expected=p.evaluate('window.__FIELD_STUDIES__.unproject(790,450)')
  check('Bottom-right XYZ values match the world-space pointer, not a corner status label',coords['x']>1000 and coords['y']>900 and len(numbers)==3 and all(abs(float(n)-expected[k])<.0006 for n,k in zip(numbers,'xyz')),{'numbers':numbers,'bounds':coords})
  before=gpu(p);base=doc(p);cam=state(p)['camera'];act(p,'library');frozen=state(p)['simTime'];p.wait_for_timeout(350)
  check('Library is a full page with image/name/subtitle cards, not a modal',p.locator('#library-page').is_visible() and p.locator('dialog[open]').count()==0 and p.locator('.expression-card img').count()>=30 and p.locator('.expression-card strong').first.inner_text()=='Field studies' and p.locator('.expression-subtitle').first.inner_text()!='')
  check('Opening library clears field input and pauses its time without a reset',not state(p)['pointerActive'] and state(p)['simTime']==frozen and gpu(p)['seeds']==before['seeds'] and doc(p)==base)
  p.wait_for_function('document.querySelector(".expression-grid img").complete');p.screenshot(path=str(E/'expressions-library.png'))
  act(p,'library-section','[data-section="about"]');require('One living medium.' in p.locator('#library-page').inner_text(),'About page content');act(p,'library-section','[data-section="collection"]')
  check('About and import/export live in the library; browsing does not change the expression',p.locator('#library-page [data-action="export-json"]').count()==1 and p.locator('#library-page [data-action="import"]').count()==1 and doc(p)==base)
  p.locator('#library-search').fill('no matching composition');require(p.locator('#library-empty').is_visible(),'empty search result');p.locator('#library-search').fill('');act(p,'close-library')
  check('Returning from library restores exactly the camera and active expression',state(p)['camera']==cam and doc(p)==base and state(p)['simTime']==frozen)
  p.evaluate('window.__FIELD_STUDIES__.play()');p.wait_for_timeout(150);act(p,'library');frozen=state(p)['simTime'];p.wait_for_timeout(500);require(state(p)['simTime']==frozen,'library freezes running clock');act(p,'close-library');p.evaluate('window.__FIELD_STUDIES__.pause()')
  check('A running field pauses for library browsing and resumes without time catch-up',0<=state(p)['simTime']-frozen<.35)
  act(p,'modes');require(p.locator('[data-mode-choice]').count()>=30,'all native modes reachable');p.locator('#mode-search').fill('kundalini');choices=p.locator('[data-mode-choice]').filter(visible=True);require(choices.count()>=1,'Kundalini mode');choice_id=choices.first.get_attribute('data-id');choices.first.click();p.wait_for_timeout(250)
  fork=doc(p);check('Modes open editable composition forks and retain the previous expression',fork['id']!=base['id'] and len(fork['scenes'][0]['entities'])==7 and state(p)['tool']=='interact' and not state(p)['modesOpen'],choice_id)
  # Semantic bindings are ordinary scene data: editable without changing physics, force, geometry or selection semantics.
  semantic_scene=fork['scenes'][0];first_id=semantic_scene['entities'][0]['id'];before_entity=json.loads(json.dumps(semantic_scene['entities'][0]));before_gpu=gpu(p);p.evaluate('(id)=>window.__FIELD_STUDIES__.selectEntity(id)',first_id);p.wait_for_timeout(100)
  semantic_select=p.locator('[data-semantic-node][data-entity-id="'+first_id+'"]');require(semantic_select.is_visible() and semantic_select.input_value()!='none','semantic binding control visible')
  semantic_select.select_option('anahata');p.wait_for_timeout(120);after_semantic=doc(p)['scenes'][0];after_entity=next(e for e in after_semantic['entities'] if e['id']==first_id);after_gpu=gpu(p)
  require(after_entity['force']==before_entity['force'] and after_entity['shape']==before_entity['shape'] and after_entity['tint']==before_entity['tint'],'semantic assignment changed physical entity')
  require(all(before_gpu[k]==after_gpu[k] for k in ['steps','seeds','bakes','positions','velocities']),'semantic assignment changed physical state')
  binding=next(b for b in after_semantic['semanticField']['bindings'] if any(c['kind']=='entity' and c['id']==first_id for c in b['carriers']));require(binding['semanticNodeId']=='anahata','semantic node did not update by stable identity')
  p.locator('[data-semantic-bind="color.radius.source"][data-entity-id="'+first_id+'"]').select_option('independent');p.wait_for_timeout(80);radius=p.locator('[data-semantic-bind="color.radius.value"][data-entity-id="'+first_id+'"]');radius.fill('333');radius.press('Tab');p.wait_for_timeout(120);edited=doc(p)['scenes'][0];edited_entity=next(e for e in edited['entities'] if e['id']==first_id);binding=next(b for b in edited['semanticField']['bindings'] if any(c['kind']=='entity' and c['id']==first_id for c in b['carriers']));
  check('Semantic authoring is explicit and does not alias the physical force kernel',binding['color']['radius']['source']=='independent' and binding['color']['radius']['value']==333 and edited_entity['force']['radius']==before_entity['force']['radius'] and binding['semanticNodeId']=='anahata')
  semantic_toggle=p.locator('[data-semantic-global="enabled"]').first;semantic_toggle.uncheck();p.wait_for_timeout(100);off_gpu=gpu(p);semantic_toggle.check();p.wait_for_timeout(100)
  check('Disabling semantic expression leaves the particle simulation untouched',all(after_gpu[k]==off_gpu[k] for k in ['steps','seeds','bakes','positions','velocities']))
  act(p,'library');saved_ids=p.locator('[data-action="load-saved"]').evaluate_all('(items)=>items.map(e=>e.dataset.id)');require(base['id'] in saved_ids,'previous expression saved')
  act(p,'load-saved','[data-id="'+base['id']+'"]');require(doc(p)==base,'open previous')
  # Imported expressions enter the collection without destroying the current work.
  incoming=json.loads(json.dumps(base));incoming['id']='imported-expression';incoming['name']='The imported study';incoming['description']='A preserved imported subtitle';payload=json.dumps(incoming)
  p.locator('#import-file').set_input_files({'name':'import.expression.json','mimeType':'application/json','buffer':payload.encode()});p.wait_for_timeout(450)
  check('Import adds a card without replacing the live expression',doc(p)==base and p.locator('[data-action="load-saved"][data-id="imported-expression"]').count()==1)
  conflict=json.loads(json.dumps(base));conflict['description']='A separately edited version';original_id=conflict['id']
  p.locator('#import-file').set_input_files({'name':'conflicting-version.json','mimeType':'application/json','buffer':json.dumps(conflict).encode()});p.wait_for_timeout(350)
  check('An imported ID conflict preserves both versions instead of overwriting current work',doc(p)==base and p.locator('[data-action="load-saved"]').count()>=4 and p.locator('.expression-card strong').filter(has_text='Field studies / imported').count()==1)
  act(p,'load-saved','[data-id="imported-expression"]');act(p,'library');p.locator('[aria-label="Expression name"]').fill('Quiet / variation');p.locator('[aria-label="Expression name"]').press('Tab');p.locator('[aria-label="Expression subtitle"]').fill('Words <stay literal>');p.locator('[aria-label="Expression subtitle"]').press('Tab');p.wait_for_timeout(400)
  check('Expression name and subtitle are editable in the library with safe literal text',doc(p)['name']=='Quiet / variation' and doc(p)['description']=='Words <stay literal>' and p.locator('.expression-subtitle').first.inner_text()=='Words <stay literal>')
  with p.expect_download() as downloaded:act(p,'export-json')
  path=E/'reviewed.expression.json';downloaded.value.save_as(path)
  check('Expression export retains the compatible authoring envelope and the edited document',json.loads(path.read_text())==doc(p) and json.loads(path.read_text())['schema']=='oi.journey' and downloaded.value.suggested_filename.endswith('.expression.json'))
  act(p,'close-library');p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(180)
  check('Narrow layout keeps controller, capture and transport without horizontal overflow',p.locator('#orbit-control').is_visible() and p.locator('#play-button').is_visible() and p.locator('[data-action="capture-options"]').is_visible() and p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  p.screenshot(path=str(E/'expressions-mobile.png'));p.locator('.workspace-cluster .header-menu-toggle').click();p.wait_for_timeout(120);act(p,'library');p.wait_for_timeout(100);check('Library remains a scrollable single-column page on small screens',p.locator('#library-page').evaluate('e=>e.scrollHeight>e.clientHeight') and p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  p.screenshot(path=str(E/'expressions-library-mobile.png'));p.evaluate('window.__FIELD_STUDIES__.dispose()')
  # True trusted touch events on the controller; no synthetic event masquerading as a device test.
  tc=browser.new_context(viewport={'width':900,'height':700},has_touch=True,reduced_motion='reduce');tp=tc.new_page();open_page(tp,fixture)
  b=tp.locator('.orbit-pad').bounding_box();x=b['x']+b['width']*.28;y=b['y']+b['height']*.3;before=doc(tp);cdp=tc.new_cdp_session(tp)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+25,'y':y+20}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});tp.wait_for_timeout(100)
  check('Touch orbit changes the view without placing objects or applying field forces',state(tp)['camera']['yaw']!=0 and not state(tp)['pointerActive'] and doc(tp)==before)
  tp.evaluate('window.__FIELD_STUDIES__.dispose()');tc.close()
  # The same file is still usable without localStorage; import retains a session card.
  p3=ctx.new_page();p3.emulate_media(reduced_motion='reduce');open_page(p3,fixture,False)
  p3.locator('#import-file').set_input_files({'name':'portable.json','mimeType':'application/json','buffer':payload.encode()});p3.wait_for_timeout(400)
  check('Storage-unavailable import remains in-session and offers honest portable export',p3.locator('[data-action="load-saved"][data-id="imported-expression"]').count()==1 and 'Browser storage is unavailable' in p3.locator('#library-page').inner_text())
  p3.evaluate('window.__FIELD_STUDIES__.dispose()');p3.close()
except Exception as error:
 results.append({'name':'Expressions workspace acceptance','ok':False,'error':str(error)});traceback.print_exc()
finally:
 report={'results':results,'passed':sum(x['ok'] for x in results),'browserErrors':errors,'environment':'Chromium software WebGL; 2048-particle fixtures; declared storage double except explicit unavailable-storage case. Native state and trusted touch checked.'};(E/'workspace-acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not all(r['ok'] for r in results) or errors:raise SystemExit(1)
