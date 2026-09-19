"""Production end-to-end acceptance. Chromium, actual GPU engine, actual PNG/WebM decode.
Local inline content; the storage test double is explicit. No network or browser-policy changes.
"""
from pathlib import Path
import json,base64,traceback,struct
from harness import browser_session
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence-native';E.mkdir(exist_ok=True)
HTML=(ROOT/'public/index.html').read_text()
STORAGE="<script>window.__TEST_STORAGE__={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__TEST_STORAGE__[k]??null,setItem:(k,v)=>window.__TEST_STORAGE__[k]=String(v),removeItem:k=>delete window.__TEST_STORAGE__[k]},configurable:true});</script>"
results=[];errors=[]
def require(v,message='Assertion failed'):
 if not v:raise AssertionError(message)
def check(name,fn):
 evidence=fn();results.append({'name':name,'ok':True,'evidence':evidence});print('PASS',name,flush=True)
def state(p):return p.evaluate('window.__FIELD_STUDIES__.getState()')
def doc(p):return p.evaluate('window.__FIELD_STUDIES__.getDocument()')
def current(p):return doc(p)['scenes'][state(p)['sceneIndex']]
def inspect(p,read=False):return p.evaluate('(r)=>window.__FIELD_STUDIES__.inspect(r)',read)
def settle(p):
 if not state(p)['libraryOpen']:p.wait_for_function('!window.__FIELD_STUDIES__.getState().needsFrame',timeout=15000)
def act(p,name,extra=''):
 selector=f'[data-action="{name}"]'+extra;modal=p.locator('dialog[open] '+selector).filter(visible=True);loc=modal if modal.count() else p.locator(selector).filter(visible=True);loc.first.click(timeout=20000);p.wait_for_timeout(65);settle(p)
def reveal(p,selector):
 p.locator(selector).first.evaluate('(el)=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==="DETAILS")p.open=true;}')
def fill(p,path,value):
 selector=f'[data-bind="{path}"]:not([type="range"])';reveal(p,selector);el=p.locator(selector).first;el.fill(str(value));el.press('Tab');p.wait_for_timeout(65);settle(p)
def load(p,j):
 if p.evaluate('!!window.__FIELD_STUDIES__'):p.evaluate('window.__FIELD_STUDIES__.dispose()')
 start=STORAGE+'<script>window.__JOURNEY__='+json.dumps(j).replace('</','<\\/')+';</script>'
 p.set_content(HTML.replace('<head>','<head>'+start,1),wait_until='load');p.wait_for_function('!!window.__FIELD_STUDIES__?.inspect()');p.evaluate('window.__FIELD_STUDIES__.pause()');p.wait_for_timeout(100)
def equivalent(a,b,keys):return all(a[k]==b[k] for k in keys)
try:
 with browser_session({'width':1440,'height':1000},'reduce') as (browser,ctx,p):
  p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  p.set_content('<html><body></body></html>');p.add_script_tag(content=(ROOT/'build/native-harness.js').read_text())
  fixture=p.evaluate('()=>{const j=NATIVE_TEST.fieldStudies();j.scenes.forEach(s=>s.field.params.count=2048);return j;}')
  load(p,fixture)
  check('Native opening, quiet canvas and seven aligned icon tools',lambda:require(current(p)['name']=='Ink' and not p.locator('#inspector').is_visible() and state(p)['engine']=='Native particle field' and p.locator('#tool-rail button').count()==7 and p.locator('#tool-rail button').first.get_attribute('data-action')=='tool-interact' and p.locator('.page-text').count()==0))
  before=inspect(p,True);p.evaluate("window.__FIELD_STUDIES__.openEditor('field')");act(p,'studio-section','[data-value="scene"]');after=inspect(p,True)
  check('Panel navigation leaves paused native state and render dimensions unchanged',lambda:require(equivalent(before,after,['simTime','steps','seeds','bakes','positions'])))
  p.keyboard.press('p');previous=current(p);p.mouse.click(710,315);p.wait_for_timeout(100);pin=current(p)['entities'][-1]
  check('One deliberate click places one force-only attractor, returns to Select, keeps other fields',lambda:require(pin['kind']=='pin' and pin['share']==0 and pin['force']['kind']=='attract' and state(p)['tool']=='select' and current(p)['field']==previous['field'] and current(p)['entities'][:-1]==previous['entities']))
  xy=p.evaluate('(v)=>window.__FIELD_STUDIES__.project(v)',pin['position'])
  check('Pin projects to its requested position',lambda:require(abs(xy['x']-710)<.001 and abs(xy['y']-315)<.001))
  act(p,'close-studio')
  p.mouse.move(xy['x'],xy['y']);p.mouse.down();p.mouse.move(xy['x']-85,xy['y']+45,steps=4);p.mouse.up();p.wait_for_timeout(80)
  moved=current(p)['entities'][-1]
  check('Drag changes only intended placement and preserves depth',lambda:require(moved['position']['z']==pin['position']['z'] and moved['position']['x']<pin['position']['x'] and current(p)['field']==previous['field']))
  act(p,'undo');check('Undo restores one whole drag; redo re-applies it',lambda:require(current(p)['entities'][-1]['position']==pin['position']));act(p,'redo');require(current(p)['entities'][-1]['position']==moved['position']);act(p,'undo')
  p.evaluate("window.__FIELD_STUDIES__.openEditor('objects')");act(p,'force-kind','[data-value="repel"]');fill(p,'entity.force.strength',3.5);fill(p,'entity.force.radius',.65)
  check('Pin force controls reach native configuration without reseeding',lambda:require(p.evaluate('window.__FIELD_STUDIES__.telemetry().config.entities.at(-1).forces.strength')==3.5 and inspect(p)['seeds']==before['seeds']))
  # Numeric positioning / locking / keyboard alternatives.
  fill(p,'entity.position.z',.31);fill(p,'entity.position.x',.14);p.locator('[data-bind="entity.locked"]').check();p.locator('[data-bind="entity.locked"]').blur();pos=current(p)['entities'][-1]['position'];p.keyboard.press('ArrowRight');require(current(p)['entities'][-1]['position']==pos)
  p.locator('[data-bind="entity.locked"]').uncheck();p.locator('[data-bind="entity.locked"]').blur();p.keyboard.press('ArrowRight');check('Editing lock and keyboard nudge are distinct from simulation motion',lambda:require(abs(current(p)['entities'][-1]['position']['x']-pos['x']-.01)<1e-9))
  p.keyboard.press('Escape');p.keyboard.press('p');p.locator('[data-orbit="view"]').click();p.locator('#working-depth').fill('0.35');p.locator('#working-depth').press('Tab');p.mouse.click(735,365);p.wait_for_timeout(80)
  check('Orbit-view placement respects explicit working-plane depth',lambda:require(current(p)['entities'][-1]['position']['z']==.35))
  # A camera gesture cannot also apply the pointer force.
  act(p,'tool-interact');p.mouse.move(720,300);p.mouse.down(button='right');p.mouse.move(755,310,steps=3);require(not state(p)['pointerActive']);p.mouse.up(button='right')
  check('Right-drag camera navigation does not also drive pointer force',lambda:require(not state(p)['pointerActive']))
  p.keyboard.press('Escape');p.keyboard.press('p');p.locator('#working-plane').select_option('XZ');act(p,'face-plane')
  p.locator('#working-plane').select_option('XY');p.locator('[data-orbit="reset"]').click();p.locator('#working-depth').fill('0');p.locator('#working-depth').press('Tab')
  # Formation and draft editing.
  p.keyboard.press('a');act(p,'place-formation');p.locator('#placement-glyph').fill('S');p.locator('#placement-glyph').press('Tab');p.mouse.click(760,570);p.wait_for_timeout(100);form=current(p)['entities'][-1]
  check('Formation placement is additive with its own allocation and identity',lambda:require(form['kind']=='formation' and form['text']=='S' and len(current(p)['entities'])==5))
  fill(p,'entity.text','P');check('Typing glyphs cannot trigger global tool shortcuts',lambda:require(state(p)['tool']=='select' and current(p)['entities'][-1]['text']=='P'))
  fill(p,'entity.text','');require(current(p)['entities'][-1]['text']=='O')
  act(p,'entity-sequence');act(p,'add-step');fill(p,'step.text','&');act(p,'place-keyframe');p.mouse.click(700,400);p.wait_for_timeout(120)
  e=current(p)['entities'][-1];offset=e['sequence']['steps'][1]['position'];key=p.evaluate('(v)=>window.__FIELD_STUDIES__.project(v)',{k:e['position'][k]+offset[k] for k in 'xyz'})
  check('Sequence keyframe is an explicit local offset at the clicked location',lambda:require(abs(key['x']-700)<.001 and abs(key['y']-400)<.001 and e['id']==form['id']))
  p.screenshot(path=str(E/'native-motion-editor.png'))
  act(p,'studio-section','[data-value="physics"]');reveal(p,'[data-action="automate"][data-target="field.dispersion"]');base=current(p)['field']['params']['dispersion'];act(p,'automate','[data-target="field.dispersion"]');act(p,'assign-automation','[data-id=""]');p.evaluate('window.__FIELD_STUDIES__.play()');p.wait_for_timeout(300);p.evaluate('window.__FIELD_STUDIES__.pause()')
  check('Parameter-started native automation preserves its stored base',lambda:require(current(p)['automation'][0]['target']=='field.dispersion' and current(p)['field']['params']['dispersion']==base))
  # All native physical controls are capability enabled.
  act(p,'studio-section','[data-value="resonance"]');reveal(p,'[data-bind="field.params.frequency"]');require(not p.locator('[data-bind="field.params.frequency"]').first.is_disabled());act(p,'tune-station','[data-index="3"]');freq=p.evaluate('window.__FIELD_STUDIES__.telemetry().cymatic.frequencyHz');beforeSelect=inspect(p)
  p.evaluate('(id)=>window.__FIELD_STUDIES__.selectEntity(id)',current(p)['entities'][0]['id']);p.wait_for_timeout(100)
  check('Station tuning uses native frequencies; selection does not retune',lambda:require(current(p)['field']['params']['frequency']==680 and p.evaluate('window.__FIELD_STUDIES__.telemetry().cymatic.frequencyHz')==freq and inspect(p)['seeds']==beforeSelect['seeds']))
  # Text, named scenes, user controlled viewing.
  p.evaluate("window.__FIELD_STUDIES__.openEditor('scene')");fill(p,'name','Tender matter');act(p,'studio-section','[data-value="text"]');act(p,'add-text');fill(p,'text.title','A field <not a tag>');fill(p,'text.italic','is a place.')
  check('Scene text is authored literally and safely',lambda:require('A field <not a tag>' in p.locator('.page-text h1').first.inner_text() and p.locator('.page-text script').count()==0))
  # Persistence and file artifacts.
  act(p,'library');
  with p.expect_download() as d:act(p,'export-json')
  jpath=E/'acceptance.journey.json';d.value.save_as(jpath);exported=json.loads(jpath.read_text());require(exported==doc(p))
  check('Journey configuration export contains the actual authored document',lambda:{'scenes':len(exported['scenes']),'entities':len(exported['scenes'][0]['entities'])})
  with p.expect_download() as d:act(p,'export-artifact')
  artifact=E/'acceptance-artifact.html';d.value.save_as(artifact);p2=ctx.new_page();p2.emulate_media(reduced_motion='reduce');p2.set_content(artifact.read_text().replace('<head>','<head>'+STORAGE,1),wait_until='load');p2.wait_for_function('!!window.__FIELD_STUDIES__?.inspect()')
  check('Self-contained living artifact reopens with native engine, editor and all authored state',lambda:require(doc(p2)==exported and state(p2)['engine']=='Native particle field' and p2.locator('#present-return').is_visible()))
  p2.evaluate('window.__FIELD_STUDIES__.dispose()');p2.close()
  # True GPU image export, actually decoded by the browser.
  act(p,'close-library');act(p,'capture-options')
  p.locator('details.image-output summary').click();p.locator('#capture-width').select_option('1280');p.locator('#capture-text').uncheck();p.locator('#capture-transparent').check();before=inspect(p,True)
  with p.expect_download() as d:act(p,'capture-image')
  image=E/'acceptance-native.png';d.value.save_as(image);raw=image.read_bytes();w,h=struct.unpack('>II',raw[16:24]);require(w==1280 and h==889)
  imageEvidence=p.evaluate('async(data)=>{const i=new Image();i.src="data:image/png;base64,"+data;await i.decode();const c=document.createElement("canvas");c.width=i.width;c.height=i.height;const x=c.getContext("2d");x.drawImage(i,0,0);const a=x.getImageData(0,0,c.width,c.height).data;let count=0;for(let k=3;k<a.length;k+=4)if(a[k]>16)count++;return {width:i.width,height:i.height,marked:count};}',base64.b64encode(raw).decode())
  after=inspect(p,True);check('PNG decodes actual visible native marks and leaves GPU state unchanged',lambda:(require(imageEvidence['marked']>100 and equivalent(before,after,['simTime','steps','seeds','positions'])),imageEvidence)[1])
  # Real recording / review / decode, opening editor must not alter recording dimensions.
  act(p,'capture-options');p.locator('details.image-output summary').click();p.locator('#capture-transparent').uncheck();act(p,'record-video');p.wait_for_timeout(1300);p.evaluate("window.__FIELD_STUDIES__.openEditor('motion')");p.wait_for_timeout(1000);act(p,'stop-record');p.locator('#recording-review').wait_for(state='visible',timeout=20000);p.evaluate('window.__FIELD_STUDIES__.pause()')
  p.wait_for_function('document.querySelector("#recording-review").readyState>=2',timeout=15000)
  video=p.evaluate('async()=>{const v=document.querySelector("#recording-review");await v.play();await new Promise(r=>setTimeout(r,650));v.pause();const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;const x=c.getContext("2d");x.drawImage(v,0,0);const data=x.getImageData(0,0,c.width,c.height).data;let marks=0;for(let i=0;i<data.length;i+=4)if(data[i]<160)marks++;return {width:v.videoWidth,height:v.videoHeight,currentTime:v.currentTime,decodedFrames:v.getVideoPlaybackQuality().totalVideoFrames,marks,png:c.toDataURL()};}')
  (E/'decoded-performance.png').write_bytes(base64.b64decode(video.pop('png').split(',')[1]))
  with p.expect_download() as d:act(p,'save-video')
  movie=E/'native-performance.webm';d.value.save_as(movie)
  check('Recorded performance plays, decodes multiple frames and preserves fixed output dimensions',lambda:(require(video['width']==1280 and video['height']==889 and video['currentTime']>.1 and video['decodedFrames']>1 and video['marks']>100),{**video,'bytes':movie.stat().st_size})[1])
  act(p,'close-dialog');
  # File import and original retention, then origin-local save / reload.
  p.locator('#import-file').set_input_files(str(jpath));p.wait_for_timeout(400);require(doc(p)==exported)
  storage=p.evaluate('window.__TEST_STORAGE__');saved=p.evaluate('JSON.parse(localStorage.getItem("oi.field-studies.journey-library.v1"))');require(any(j['id']==exported['id'] for j in saved))
  reloadStart=STORAGE+'<script>delete window.__JOURNEY__;Object.assign(window.__TEST_STORAGE__,'+json.dumps(storage).replace('</','<\\/')+');</script>'
  p.evaluate('window.__FIELD_STUDIES__.dispose()');p.set_content(HTML.replace('<head>','<head>'+reloadStart,1),wait_until='load');p.wait_for_function('!!window.__FIELD_STUDIES__?.inspect()')
  check('Browser-save reload and file import restore editable configuration without changing source file',lambda:require(doc(p)==exported and json.loads(jpath.read_text())==exported))
  # Non-destructive preset preview.
  before=doc(p)
  if state(p)['libraryOpen']:act(p,'close-library')
  act(p,'library');p.locator('.expression-card').first.hover();check('Preset preview does not replace live work',lambda:require(doc(p)==before));act(p,'close-library')
  # Native ASCII sampler target is independent, no GPU reset.
  p.evaluate("window.__FIELD_STUDIES__.openEditor('objects')");p.evaluate('(id)=>window.__FIELD_STUDIES__.selectEntity(id)',current(p)['entities'][1]['id']);act(p,'capture-options');reveal(p,'[data-action="source-kind"]');p.locator('[data-action="source-kind"]').select_option('ascii');p.wait_for_timeout(200);seed=inspect(p)['seeds'];fill(p,'step.source.ascii.text','X  O\n O X');p.wait_for_timeout(200);act(p,'capture-options')
  check('Native ASCII source is local to its formation and does not reseed',lambda:require(inspect(p)['seeds']==seed and current(p)['entities'][1]['source']['kind']=='ascii' and not current(p)['entities'][0].get('source')))
  # Small window keeps accessible transport and stacked drawers, no horizontal overflow.
  p.set_viewport_size({'width':390,'height':844});p.evaluate("window.__FIELD_STUDIES__.openEditor('motion')");p.wait_for_timeout(150);p.screenshot(path=str(E/'native-mobile.png'))
  check('Small window retains pause and dismissible motion controls without page overflow',lambda:require(p.locator('#play-button').is_visible() and p.locator('[data-action="close-studio"]').is_visible() and p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')))
  p.evaluate('window.__FIELD_STUDIES__.dispose()')
  # Real touch pointer event delivered by browser input system.
  touch=browser.new_context(viewport={'width':900,'height':700},has_touch=True,reduced_motion='reduce');tp=touch.new_page();load(tp,fixture);act(tp,'tool-pin');tp.touchscreen.tap(470,265);tp.wait_for_timeout(120)
  check('Touch placement creates exactly one selected attractor on the plane',lambda:require(len(current(tp)['entities'])==3 and state(tp)['tool']=='select' and current(tp)['entities'][-1]['force']['kind']=='attract'))
  tp.evaluate('window.__FIELD_STUDIES__.dispose()');touch.close()
except Exception as e:
 results.append({'name':'native browser acceptance','ok':False,'error':str(e)});traceback.print_exc()
finally:
 report={'results':results,'passed':sum(r['ok'] for r in results),'browserErrors':errors,'environment':'Chromium software WebGL, 2048-particle fixtures; inline local content; explicit in-memory origin storage test double. Video decoded by Chromium.'};(E/'browser-acceptance.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if not all(r['ok'] for r in results) or errors:raise SystemExit(1)
