"""Restored native features through actual Expressions controls; source-derived expectations.
Inline tests use the same explicitly declared in-memory storage double as the existing suite.
"""
from pathlib import Path
import json,traceback,base64
from PIL import Image,ImageDraw
from harness import browser_session
R=Path(__file__).resolve().parents[1];E=R/'evidence-native';E.mkdir(exist_ok=True)
HTML=(R/'public/index.html').read_text()
STORAGE="<script>window.__TEST_STORAGE__={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__TEST_STORAGE__[k]??null,setItem:(k,v)=>window.__TEST_STORAGE__[k]=String(v),removeItem:k=>delete window.__TEST_STORAGE__[k]},configurable:true});</script>"
results=[];errors=[]
def require(x,m='Assertion failed'):
 if not x:raise AssertionError(m)
def doc(p):return p.evaluate('__FIELD_STUDIES__.getDocument()')
def state(p):return p.evaluate('__FIELD_STUDIES__.getState()')
def cfg(p):return p.evaluate('__FIELD_STUDIES__.telemetry().config')
def read(x,path):
 for part in path.split('.'):x=x[int(part)] if isinstance(x,list) else x.get(part)
 return x

def reveal(p,selector):
 p.locator(selector).first.evaluate('(el)=>{for(let n=el.parentElement;n;n=n.parentElement)if(n.tagName==="DETAILS")n.open=true;}')
def settle(p):
 if not state(p)['libraryOpen']:p.wait_for_function('!__FIELD_STUDIES__.getState().needsFrame',timeout=15000)
def act(p,name,extra=''):
 sel=f'[data-action="{name}"]'+extra
 modal=p.locator('dialog[open] '+sel)
 if modal.count():modal.first.click(timeout=15000)
 else:
  reveal(p,sel);p.locator(sel).filter(visible=True).first.click(timeout=15000)
 p.wait_for_timeout(25);settle(p)
def fill(p,path,value):
 sel=f'[data-bind="{path}"]:not([type="range"])';reveal(p,sel);el=p.locator(sel).first;el.fill(str(value));el.press('Tab');p.wait_for_timeout(25);settle(p)
def choose(p,path,value):
 sel=f'select[data-bind="{path}"]';reveal(p,sel);p.locator(sel).select_option(value);p.wait_for_timeout(25);settle(p)
def toggle(p,path,value):
 sel=f'[data-bind="{path}"]';reveal(p,sel);p.locator(sel).set_checked(value);p.locator(sel).blur();p.wait_for_timeout(25);settle(p)
def load(p,j):
 if p.evaluate('!!window.__FIELD_STUDIES__'):p.evaluate('__FIELD_STUDIES__.dispose()')
 p.set_content(HTML.replace('<head>','<head>'+STORAGE+'<script>window.__JOURNEY__='+json.dumps(j).replace('</','<\\/')+';</script>',1),wait_until='load');p.wait_for_function('!!window.__FIELD_STUDIES__?.inspect()');p.evaluate('__FIELD_STUDIES__.pause()');p.wait_for_timeout(100)
 if state(p)['libraryOpen']:act(p,'close-library')
def check(id,fn):
 try:result=fn();results.append({'id':id,'ok':True,'evidence':result});print('PASS',id,flush=True)
 except Exception as error:results.append({'id':id,'ok':False,'error':str(error)});raise
try:
 with browser_session({'width':1440,'height':1000},'reduce') as (_,ctx,p):
  p.on('pageerror',lambda e:errors.append(str(e)))
  p.set_content('<html><body></body></html>');p.add_script_tag(content=(R/'build/native-harness.js').read_text());p.add_script_tag(content=(R/'build/parity-harness.js').read_text())
  fixture=p.evaluate('()=>{const j=NATIVE_TEST.fieldStudies();j.scenes=j.scenes.slice(0,1);j.scenes[0].field.params.count=2048;return j;}')
  refs=p.evaluate('({palettes:PARITY.referencePalettes,papers:PARITY.referencePapers,chains:PARITY.referenceChains,glyphs:PARITY.referenceGlyphs,bindings:PARITY.bindings,starters:PARITY.startingPoints().map(p=>({id:p.id,name:p.expression.name,config:PARITY.toNativeConfig(p.expression.scenes[0])}))})')
  load(p,fixture);p.evaluate("__FIELD_STUDIES__.openEditor('field')")
  def palettes():
   for pal in refs['palettes']:
    act(p,'native-palette',f'[data-id="{pal["id"]}"]');c=cfg(p)['color'];require([c['primaryColor'],c['accentColor'],c['secondaryColor']]==[pal['primary'],pal['accent'],pal['secondary']],pal['id']);require(c['mode']==pal['recommendedMode']);require(not c.get('customPaletteColors'))
   return {'palettes':len(refs['palettes']),'noStickyCustomStops':True}
  check('UI-NATIVE-PALETTES',palettes)
  def papers():
   for paper in refs['papers']:act(p,'native-paper',f'[data-id="{paper["id"]}"]');require(cfg(p)['backgroundColor']==paper['color'], 'Paper '+paper['id']+str((cfg(p)['backgroundColor'],paper['color'],doc(p)['scenes'][0]['field']['background'],state(p))))
   for mode in ['solid','vignette','ambientGlow','adaptive']:choose(p,'engine.backgroundMode',mode);require(cfg(p)['backgroundMode']==mode)
   act(p,'native-paper-harmonize');require(cfg(p)['backgroundMode']=='ambientGlow');act(p,'native-paper-invert');return {'papers':len(refs['papers']),'atmospheres':4}
  check('UI-NATIVE-PAPERS',papers)
  def stops():
   while len(doc(p)['scenes'][0]['field']['palette'])<8:act(p,'add-palette')
   for i in range(8):
    el=p.locator(f'[data-palette="{i}"]');el.fill('#'+format(0x234567+i*0x050504,'06x'));el.dispatch_event('change');p.wait_for_timeout(25);settle(p)
   require(len(cfg(p)['color']['customPaletteColors'])==8)
   act(p,'native-palette',f'[data-id="{refs["palettes"][0]["id"]}"]');require(not cfg(p)['color'].get('customPaletteColors'));return {'stops':8,'nativePresetRestored':True}
  check('UI-EIGHT-STOPS-NATIVE-RESTORE',stops)
  load(p,fixture)
  def numerics():
   tested=[];inert=[]
   for b in refs['bindings']:
    group=b['group'];tab='motion' if group in ['morph','composition'] else 'field'
    p.evaluate('(t)=>__FIELD_STUDIES__.openEditor(t)',tab)
    if tab=='motion':act(p,'motion-tab','[data-value="'+('focus' if group=='composition' else 'morph')+'"]')
    sel=f'input[data-bind="{b["bind"]}"]:not([type="range"])';require(p.locator(sel).count()>0,'No contextual home: '+b['path']);reveal(p,sel)
    if p.locator(sel).first.is_disabled():inert.append(b['path']);continue
    value=1024 if b['path']=='particleCount' else round(float(p.locator(sel).first.input_value())+max(b['step'],.01),4)
    value=max(b['hardMin'],min(b['hardMax'],value))
    fill(p,b['bind'],value);actual=read(cfg(p),b['path']);expected=value*b['factor'];require(abs(actual-expected)<=1e-8*max(1,abs(expected)),b['path']+str((actual,expected)));tested.append(b['path'])
   require(not inert,'Unexpected disabled native controls: '+str(inert));return {'paths':tested,'retainedUnconsumed':inert}
  check('UI-ALL-NATIVE-NUMERIC-HOMES',numerics)
  load(p,fixture);p.evaluate("__FIELD_STUDIES__.openEditor('field')")
  def enums():
   for weight in range(100,1000,100):choose(p,'engine.fontWeight',str(weight));require(cfg(p)['fontWeight']==weight)
   for mode in ['orbital','nbody','chaos']:choose(p,'engine.relationalMode',mode);require(cfg(p)['relational']['mode']==mode)
   for mode in ['attract','repel','vortex']:choose(p,'engine.pointerMode',mode);require(cfg(p)['interaction']['mode']==mode)
   for mode in ['ascent','descent','pingpong']:choose(p,'engine.sweepDirection',mode);require(cfg(p)['cymatics']['sweep']['direction']==mode)
   for mode in ['vertical','horizontal']:choose(p,'engine.mediumPlane',mode);require(cfg(p)['composition']['plane']==mode)
   p.evaluate("__FIELD_STUDIES__.openEditor('motion')");act(p,'motion-tab','[data-value="morph"]')
   for mode in ['linear','toroidalHopf','vortexSpiral','quantumInterference']:choose(p,'engine.trajectory',mode);require(cfg(p)['toroidalMorph']['trajectory']==mode)
   for mode in ['sine','triangle','smooth','pulse']:choose(p,'engine.driveShape',mode);require(cfg(p)['toroidalMorph']['driveShape']==mode)
   for mode in ['theta','product','sum','beat']:choose(p,'morph.law',mode);require(cfg(p)['toroidalMorph']['interference']==('toroidalOnly' if mode=='theta' else mode))
   return {'fontWeights':9,'relationalModes':3,'pointerModes':3,'sweepDirections':3,'mediumPlanes':2,'trajectories':4,'waveforms':4,'interferenceLaws':4}
  check('UI-NATIVE-ENUMS-AND-FONTS',enums)

  load(p,fixture);p.evaluate('(id)=>__FIELD_STUDIES__.selectEntity(id)',fixture['scenes'][0]['entities'][0]['id'])
  def templates():
   choose(p,'entity.shape','cymatic');before=p.evaluate('__FIELD_STUDIES__.inspect()')
   for geometry in ['square','circular','volumetric3D']:
    choose(p,'entity.templateGeometry',geometry)
    for dimension in ['2D','3D']:choose(p,'entity.templateDimension',dimension);require(cfg(p)['entities'][0]['shape']['plateGeometry']==geometry and cfg(p)['entities'][0]['shape']['dimension']==dimension)
   require(p.evaluate('__FIELD_STUDIES__.inspect().seeds')==before['seeds']);require(p.evaluate('__FIELD_STUDIES__.inspect().bakes')>before['bakes']);return {'combinations':6,'noReseed':True}
  check('UI-TEMPLATE-GEOMETRIES',templates)
  def glyphs():
   choose(p,'entity.shape','text');sel='[data-glyph-search]';reveal(p,sel);p.locator(sel).fill('omega');p.wait_for_timeout(50)
   matches=p.locator('[data-action="native-glyph"]').filter(visible=True);require(matches.count()>0);selected=matches.first.get_attribute('data-value');matches.first.click();p.wait_for_timeout(80);settle(p);require(cfg(p)['entities'][0]['shape']['text']==selected,'Glyph '+str((selected,cfg(p)['entities'][0]['shape'])));return {'glyph':selected,'catalogueSearch':True}
  check('UI-GLYPH-CATALOGUE',glyphs)
  act(p,'entity-sequence')
  def chains():
   for chain in refs['chains']:act(p,'native-chain',f'[data-id="{chain["id"]}"]');require([l['shape']['text'] for l in cfg(p)['entities'][0]['sequence']['links']]==chain['chain'],chain['id'])
   act(p,'native-kundalini-sequence');require(len(cfg(p)['entities'][0]['sequence']['links'])==7);return {'presets':len(refs['chains']),'risingLinks':7}
  check('UI-NATIVE-CHAINS',chains)
  load(p,fixture);p.evaluate('(id)=>__FIELD_STUDIES__.selectEntity(id)',fixture['scenes'][0]['entities'][0]['id'])
  def assets():
   samples=[]
   for fmt,mime in [('PNG','image/png'),('JPEG','image/jpeg'),('WEBP','image/webp')]:
    im=Image.new('RGB',(96,64),'black');d=ImageDraw.Draw(im);d.ellipse((7,8,55,57),fill='white');d.rectangle((64,8,84,57),fill='gray');path=E/('fixture.'+fmt.lower());im.save(path,fmt)
    sel='select[data-action="source-kind"]';reveal(p,sel);p.locator(sel).select_option('image');p.wait_for_timeout(65)
    with p.expect_file_chooser() as fc:act(p,'source-image')
    fc.value.set_files(str(path));p.wait_for_function('Object.values(__FIELD_STUDIES__.telemetry().sourceStatus).includes("Image source active")')
    for mode in ['luminance','edgeSobel','silhouette']:choose(p,'entity.source.image.mode',mode);p.wait_for_function('Object.values(__FIELD_STUDIES__.telemetry().sourceStatus).includes("Image source active")');require(cfg(p)['sourceType']=='image');require(cfg(p)['customImage']['mode']==mode)
    fill(p,'entity.source.image.threshold',.48);toggle(p,'entity.source.image.invert',True);fill(p,'entity.source.image.scale',.8);p.wait_for_function('Object.values(__FIELD_STUDIES__.telemetry().sourceStatus).includes("Image source active")');samples.append({'mime':mime,'bytes':path.stat().st_size})
   act(p,'library')
   with p.expect_download() as dl:act(p,'export-artifact')
   artifact=E/'parity-asset-expression.html';dl.value.save_as(artifact);before=doc(p);p2=ctx.new_page();p2.emulate_media(reduced_motion='reduce');p2.set_content(artifact.read_text().replace('<head>','<head>'+STORAGE,1),wait_until='load');p2.wait_for_function('Object.values(__FIELD_STUDIES__?.telemetry()?.sourceStatus??{}).includes("Image source active")');require(doc(p2)==before);p2.evaluate('__FIELD_STUDIES__.dispose()');p2.close();act(p,'close-library');return {'formats':samples,'portableReopened':True}
  check('UI-RASTER-PORTABLE-ASSETS',assets)
  def ascii_input():
   sel='select[data-action="source-kind"]';reveal(p,sel);p.locator(sel).select_option('ascii');p.wait_for_timeout(65);fill(p,'entity.source.ascii.text','A : I\n === ');fill(p,'entity.source.ascii.fontFamily','serif');fill(p,'entity.source.ascii.fontSize',40);toggle(p,'entity.source.ascii.invert',True);require(cfg(p)['sourceType']=='ascii');require(cfg(p)['asciiGlyph']['invert'] and cfg(p)['asciiGlyph']['fontFamily']=='serif');return {'nativeSampler':True,'fontAndInvert':True}
  check('UI-ASCII',ascii_input)
  load(p,fixture);p.evaluate('(id)=>__FIELD_STUDIES__.selectEntity(id)',fixture['scenes'][0]['entities'][0]['id'])
  def live_drag():
   before=p.evaluate('__FIELD_STUDIES__.inspect()');v=doc(p)['scenes'][0]['entities'][0]['position'];xy=p.evaluate('(v)=>__FIELD_STUDIES__.project(v)',v);p.mouse.move(xy['x'],xy['y']);p.mouse.down();p.mouse.move(xy['x']+23,xy['y']+17,steps=4);p.wait_for_timeout(80);settle(p);moved=doc(p)['scenes'][0]['entities'][0]['position'];require(moved!=v,'Drag did not move: '+str((v,moved,state(p))));require(abs(cfg(p)['entities'][0]['x']-moved['x']*400)<1e-8,'Native position not live: '+str((cfg(p)['entities'][0]['x'],moved)));require(p.evaluate('__FIELD_STUDIES__.inspect().seeds')==before['seeds'],'Drag reseeded');p.mouse.up();return {'liveBeforeRelease':True,'noReseed':True}
  check('UI-LIVE-DRAG-BEFORE-RELEASE',live_drag)
  def pointer_with_editor():
   p.evaluate("__FIELD_STUDIES__.openEditor('field')");act(p,'tool-interact');require(state(p)['inspectorOpen'] and state(p)['tool']=='interact','Interact closed editor '+str(state(p)))
   p.evaluate('__FIELD_STUDIES__.play()');before=p.evaluate('__FIELD_STUDIES__.inspect(true)');p.mouse.move(720,500);p.mouse.down();p.mouse.move(770,500,steps=5);p.wait_for_timeout(220);p.mouse.up();p.evaluate('__FIELD_STUDIES__.pause()');after=p.evaluate('__FIELD_STUDIES__.inspect(true)')
   require(state(p)['inspectorOpen'],'Editor did not remain open');require(after['steps']>before['steps'],'Simulation did not advance');require(after['velocities']!=before['velocities'],'Pointer force had no live effect while editor was open');return {'inspectorStayedOpen':True,'pointerLive':True}
  check('UI-POINTER-LIVE-WITH-EDITOR',pointer_with_editor)
  def layouts():
   p.evaluate("__FIELD_STUDIES__.openEditor('objects')");act(p,'select-all');positions={}
   for layout in ['line','column','ring','grid','spiral']:
    # Names are taken from the contextual original native layout catalogue.
    selector='[data-action="native-layout"]';ids=p.locator(selector).evaluate_all('(els)=>els.map(e=>e.dataset.value)')
    if layout not in ids:continue
    act(p,'native-layout',f'[data-value="{layout}"]');positions[layout]=[e['position'] for e in doc(p)['scenes'][0]['entities']]
   require(len(positions)==5,'Missing native layouts '+str(positions));return positions
  check('UI-NATIVE-LAYOUTS',layouts)
  p.evaluate("__FIELD_STUDIES__.openEditor('scene')")
  def scaffold():
   for mode in ['off','axis','grid']:choose(p,'view.nativeScaffold',mode);require(doc(p)['scenes'][0]['view']['nativeScaffold']==mode)
   return {'modes':3}
  check('UI-NATIVE-SCAFFOLD',scaffold)
  load(p,fixture);p.evaluate("__FIELD_STUDIES__.openEditor('field')")
  def disperse():
   before=doc(p);act(p,'native-disperse');require(doc(p)==before);steps=p.evaluate('__FIELD_STUDIES__.inspect().steps');p.evaluate('__FIELD_STUDIES__.play()');p.wait_for_function('(s)=>__FIELD_STUDIES__.inspect().steps>s',arg=steps,timeout=10000);p.evaluate('__FIELD_STUDIES__.pause()');g=p.evaluate('__FIELD_STUDIES__.inspect(true)');require(any(abs(v)>0 for v in g['velocities']));return {'commandDoesNotEditDocument':True,'actualVelocity':True}
  check('UI-DISPERSE',disperse)
  def phases():
   p.evaluate("__FIELD_STUDIES__.openEditor('motion')");act(p,'motion-tab','[data-value="morph"]');before=doc(p);act(p,'native-reset-phases');require(doc(p)==before);require(abs(p.evaluate('__FIELD_STUDIES__.telemetry().drive.theta'))<1e-8);return {'phaseReset':True,'documentPreserved':True}
  check('UI-RESET-PHASES',phases)
  def saved_delete():
   act(p,'library');act(p,'save-browser');id=doc(p)['id'];act(p,'delete-saved',f'[data-id="{id}"]');act(p,'confirm');p.wait_for_timeout(550);raw=p.evaluate('JSON.parse(localStorage.getItem("oi.field-studies.journey-library.v1"))');require(not any(j.get('id')==id for j in raw));require(doc(p)['id']==id);act(p,'save-browser');raw=p.evaluate('JSON.parse(localStorage.getItem("oi.field-studies.journey-library.v1"))');require(any(j.get('id')==id for j in raw));return {'removedStaysRemoved':True,'explicitSaveReinstates':True}
  check('UI-DELETE-ACTIVE-SAVED-COPY',saved_delete)
  p.screenshot(path=str(E/'parity-library-ui.png'));act(p,'close-library')
  def all_modes():
   counts=[]
   for starter in refs['starters']:
    act(p,'modes');p.locator('#modes-panel [data-action="start-mode"][data-id="'+starter['id']+'"]').click();settle(p)
    c=cfg(p);expected=starter['config'];require(c['particleCount']==expected['particleCount'],starter['id']+' count changed');require(c['fluid']==expected['fluid'],starter['id']+' stale source transition');require(c['toroidalMorph']==expected['toroidalMorph'],starter['id']+' morph changed');require(c['cymatics']==expected['cymatics'],starter['id']+' resonance changed');counts.append({'id':starter['id'],'nativeParticleCount':c['particleCount']})
   return counts
  check('UI-ALL-STARTING-MODES-NATIVE-COUNTS',all_modes)
  p.evaluate('__FIELD_STUDIES__.dispose()');require(not errors,str(errors))
except Exception:
 traceback.print_exc()
finally:
 (E/'parity-workflows.json').write_text(json.dumps({'results':results,'browserErrors':errors,'storage':'explicit inline-origin storage test double'},indent=2));print(json.dumps(results,indent=2))
if len(results)<17 or any(not r['ok'] for r in results) or errors:raise SystemExit(1)
