"""Offline browser acceptance. Real Chromium/WebGL; storage uses an explicit in-memory test double.
The container's managed URL policy blocks loopback navigation, so the bundled HTML is set as local content.
No browser policies are modified. Run: npm run test:browser
"""
import json, time, traceback, struct
from pathlib import Path
from harness import browser_session
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'public/index.html').read_text()
EVIDENCE=ROOT/'evidence'; EVIDENCE.mkdir(exist_ok=True)
STORAGE="""<script>window.__TEST_STORAGE__={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__TEST_STORAGE__[k]??null,setItem:(k,v)=>window.__TEST_STORAGE__[k]=String(v),removeItem:k=>delete window.__TEST_STORAGE__[k]},configurable:true});</script>"""
results=[]
errors=[]
def check(name,fn):
    fn(); results.append({'test':name,'status':'passed'});print('PASS',name,flush=True)
def require(v,message='Assertion failed'):
    if not v: raise AssertionError(message)
def near(a,b,e=0.02): require(abs(a-b)<e,f'{a} != {b}')
def state(p):return p.evaluate('window.__FIELD_STUDIES__.getState()')
def doc(p):return p.evaluate('window.__FIELD_STUDIES__.getDocument()')
def current(p):
    d=doc(p);return d['scenes'][state(p)['sceneIndex']]
def act(p,n,extra=''):
    loc=p.locator(f'[data-action="{n}"]'+extra).filter(visible=True)
    loc.first.click(timeout=7000)
def fill(p,path,value):
    el=p.locator(f'[data-bind="{path}"]:not([type="range"])').first
    el.fill(str(value));el.press('Tab')
def load(p,custom=None,still=True):
    if p.evaluate('!!window.__FIELD_STUDIES__'):p.evaluate('window.__FIELD_STUDIES__.dispose()')
    initial=STORAGE
    if custom:initial+='<script>window.__JOURNEY__='+json.dumps(custom).replace('</','<\\/')+';</script>'
    p.set_content(HTML.replace('<head>','<head>'+initial,1),wait_until='load')
    p.wait_for_function('!!window.__FIELD_STUDIES__')
    if still:p.evaluate('window.__FIELD_STUDIES__.pause()')
    p.wait_for_timeout(180)
def screenshot(p,name):p.screenshot(path=str(EVIDENCE/name),animations='disabled')
try:
 with browser_session({'width':1440,'height':1000}) as (_,ctx,p):
    p.on('pageerror',lambda err:errors.append(str(err)))
    load(p)
    opening=doc(p)
    check('Opening: WebGL, named Ink scene, inspector closed, oversized O/I',lambda:require(p.evaluate("!!(document.querySelector('#field-canvas').getContext('webgl2')??document.querySelector('#field-canvas').getContext('webgl'))") and current(p)['name']=='Ink' and not p.locator('#inspector').is_visible() and [e['text'] for e in current(p)['entities']]==['O','I']))
    screenshot(p,'opening-desktop.png')
    clock=state(p)['simTime'];p.keyboard.press('e');act(p,'tab','[data-value="field"]');act(p,'tab','[data-value="scene"]')
    check('Inspector navigation does not reset or advance paused simulation',lambda:require(state(p)['simTime']==clock))
    screenshot(p,'scene-editor.png')
    # A pin click belongs to the canvas, not the inspector. One-shot placement returns to Select.
    p.keyboard.press('p');before=current(p);p.mouse.click(720,340);after=current(p);pin=after['entities'][-1]
    check('Click-to-pin is one-shot, preserves formation identities and palette',lambda:require(pin['kind']=='pin' and pin['share']==0 and state(p)['tool']=='select' and after['field']==before['field'] and after['entities'][:-1]==before['entities']))
    xy=p.evaluate('(v)=>window.__FIELD_STUDIES__.project(v)',pin['position'])
    check('Pin is placed at the requested canvas coordinate',lambda:(near(xy['x'],720,1),near(xy['y'],340,1)))
    p.mouse.move(xy['x'],xy['y']);p.mouse.down();p.mouse.move(xy['x']-100,xy['y']+55,steps=6);p.mouse.up();moved=current(p)['entities'][-1]
    check('Dragging a pin preserves depth and edits only its position',lambda:require(moved['position']['z']==pin['position']['z'] and moved['position']['x']<pin['position']['x'] and current(p)['field']==before['field']))
    act(p,'undo');check('One undo restores the entire drag',lambda:require(current(p)['entities'][-1]['position']==pin['position']))
    act(p,'force-kind','[data-value="repel"]');check('Repeller changes the selected influence, not palette or stations',lambda:require(current(p)['entities'][-1]['force']['kind']=='repel' and current(p)['field']==before['field']))
    p.keyboard.press('e');p.keyboard.press('e') # editor state remains one coherent space
    # Explicit 3D plane placement
    act(p,'view-3d');p.locator('#working-depth').fill('0.35');p.locator('#working-depth').press('Tab');p.keyboard.press('p');p.mouse.click(730,410)
    check('3D pin honours the visible working-plane depth',lambda:near(current(p)['entities'][-1]['position']['z'],.35,1e-8))
    # Formation creation and text editing never trigger shortcuts.
    act(p,'view-2d');p.locator('#working-depth').fill('0');p.locator('#working-depth').press('Tab');p.keyboard.press('a');p.locator('#placement-glyph').fill('S');p.locator('#placement-glyph').press('Tab');p.mouse.click(760,610)
    f=current(p)['entities'][-1];check('A new formation is independently placed without replacing existing entities',lambda:require(f['kind']=='formation' and f['text']=='S' and len(current(p)['entities'])==5))
    inp=p.locator('[data-bind="entity.text"]');inp.fill('P');inp.press('Enter');check('Glyph typing does not activate the Pin shortcut',lambda:require(state(p)['tool']=='select' and current(p)['entities'][-1]['text']=='P'))
    inp=p.locator('[data-bind="entity.text"]');inp.fill('');inp.press('Enter');check('Empty glyph draft commits a sensible fallback',lambda:require(current(p)['entities'][-1]['text']=='O'))
    # Sequence/keyframe is local to the selected formation.
    act(p,'entity-sequence');act(p,'add-step');fill(p,'step.text','&');act(p,'place-keyframe');p.mouse.click(700,450)
    check('Sequence spatial keyframe is a local offset, not an entity replacement',lambda:require(len(current(p)['entities'][-1]['sequence']['steps'])==2 and current(p)['entities'][-1]['sequence']['steps'][1]['position'] is not None and current(p)['entities'][-1]['id']==f['id']))
    basepos=current(p)['entities'][-1]['position'];offset=current(p)['entities'][-1]['sequence']['steps'][1]['position'];keypoint=p.evaluate('(v)=>window.__FIELD_STUDIES__.project(v)',{k:basepos[k]+offset[k] for k in 'xyz'})
    check('Keyframe placement projects back to its actual click',lambda:(near(keypoint['x'],700,1),near(keypoint['y'],450,1)))
    # Contextual automation keeps authored values untouched.
    act(p,'tab','[data-value="field"]');base=current(p)['field']['params']['dispersion'];act(p,'automate','[data-key="dispersion"]')
    check('Automation is created from its parameter in the correct context',lambda:require(len(current(p)['automation'])==1 and current(p)['automation'][0]['target']=='field.dispersion'))
    p.evaluate('window.__FIELD_STUDIES__.play()');p.wait_for_timeout(500);p.evaluate('window.__FIELD_STUDIES__.pause()')
    check('Evaluating an automation never overwrites the base value',lambda:require(current(p)['field']['params']['dispersion']==base))
    # Name, prose and context, including HTML treated as content.
    act(p,'tab','[data-value="scene"]');fill(p,'name','Tender matter');fill(p,'character','A quiet field with an independent centre.');fill(p,'text.title','A field <not a tag>');fill(p,'text.italic','is a place.');p.locator('[data-bind="text.visible"]').uncheck();
    check('Optional editorial text is actual scene content and can be hidden',lambda:require(not current(p)['text'][0]['visible'] and p.locator('.page-text').first.is_hidden()))
    p.locator('[data-bind="text.visible"]').check();check('Text is safely rendered literally rather than interpreted as HTML',lambda:require('A field <not a tag>' in p.locator('.page-text h1').first.inner_text()))
    # View framing travels with the scene.
    p.keyboard.press('Escape');act(p,'view-3d');p.evaluate("window.__FIELD_STUDIES__.openEditor('scene')")
    p.locator('details[data-detail="Scene framing"] summary').click();act(p,'keep-view');savedview=current(p)['view'];act(p,'view-2d');act(p,'restore-view')
    check('Scene framing is stored and restored deliberately',lambda:require(savedview['mode']=='3d' and state(p)['camera']['mode']=='3d'))
    act(p,'open-timeline') if p.locator('[data-action="open-timeline"]').is_visible() else act(p,'timeline')
    screenshot(p,'journey-editor.png')
    n=len(doc(p)['scenes']);act(p,'duplicate-scene','[data-index="0"]');check('Duplicate scene makes a separately named full state',lambda:require(len(doc(p)['scenes'])==n+1 and current(p)['name'].endswith('variation')))
    act(p,'undo');check('Undo duplicate restores the scene list',lambda:require(len(doc(p)['scenes'])==n))
    # Capabilities are honest.
    act(p,'tab','[data-value="field"]');p.locator('details[data-detail="Continuous resonance"] summary').click()
    check('Physical cymatics are disabled instead of represented as fake templates',lambda:require(p.locator('[data-bind="field.params.frequency"]').first.is_disabled() and not p.evaluate('window.__FIELD_STUDIES__.capabilities.physicalResonance')))
    # File round-trip, standalone artifact and image exports.
    act(p,'keep');
    with p.expect_download() as d:act(p,'export-json')
    jpath=EVIDENCE/'acceptance-export.journey.json';d.value.save_as(jpath);exported=json.loads(jpath.read_text())
    check('Journey file preserves text, entities, scenes and automation',lambda:require(exported==doc(p)))
    with p.expect_download() as d:act(p,'export-artifact')
    artifact=EVIDENCE/'acceptance-artifact.html';d.value.save_as(artifact)
    p2=ctx.new_page();p2.on('pageerror',lambda e:errors.append(str(e)));p2.set_content(artifact.read_text().replace('<head>','<head>'+STORAGE,1),wait_until='load');p2.wait_for_function('!!window.__FIELD_STUDIES__');p2.evaluate('window.__FIELD_STUDIES__.pause()')
    check('Living HTML artifact opens with its complete embedded journey and presentation view',lambda:require(doc(p2)==exported and p2.locator('#present-return').is_visible()))
    p2.close()
    p.locator('#capture-width').select_option('1280')
    with p.expect_download() as d:act(p,'capture-image')
    img=EVIDENCE/'capture-acceptance.png';d.value.save_as(img);data=img.read_bytes();iw,ih=struct.unpack('>II',data[16:24]);check('PNG capture is a real image at the requested output size',lambda:require(data.startswith(b'\x89PNG') and iw==1280 and ih>0 and len(data)>15000))
    p.locator('#capture-transparent').check();p.locator('#capture-text').uncheck()
    with p.expect_download() as d:act(p,'capture-image')
    transparent=EVIDENCE/'capture-transparent.png';d.value.save_as(transparent)
    from PIL import Image
    alpha=Image.open(transparent).convert('RGBA').getchannel('A').getextrema()
    check('Transparent PNG contains real alpha, not a paper-coloured rectangle',lambda:require(alpha[0]==0 and alpha[1]>0))
    p.locator('#capture-transparent').uncheck();p.locator('#capture-text').check()
    # Short actual encoder test; software rendering means no hardware throughput assertion.
    if not p.locator('#keep-dialog').is_visible():act(p,'keep')
    p.locator('#capture-width').select_option('1280');act(p,'record-video');p.wait_for_timeout(3000);act(p,'stop-record');p.wait_for_selector('#video-dialog[open]',timeout=15000)
    check('Video recording reaches a real reviewable media element',lambda:require(p.locator('#video-dialog video').count()==1))
    with p.expect_download() as d:act(p,'save-video')
    video=EVIDENCE/'capture-acceptance.webm';d.value.save_as(video)
    p.locator('#video-dialog video').evaluate('(v)=>{v.muted=true;v.play().catch(e=>window.__VIDEO_TEST_ERROR__=e.message)}')
    try:p.wait_for_function("(()=>{const v=document.querySelector('#video-dialog video');return v.readyState>=2&&v.videoWidth>0})()",timeout=15000)
    except Exception:
        print('VIDEO DIAGNOSTIC',p.locator('#video-dialog video').evaluate('(v)=>({ready:v.readyState,error:v.error?.message,playError:window.__VIDEO_TEST_ERROR__,source:v.currentSrc})'),video.stat().st_size,state(p),flush=True)
        raise
    check('Browser encoder produces a decodable video file',lambda:require(video.stat().st_size>1000 and p.locator('#video-dialog video').evaluate('(v)=>v.videoWidth')==1280))
    # Autosave test uses declared test-double, not a claim about the container origin.
    p.wait_for_timeout(450);check('Autosave persists the authoring document through the storage interface',lambda:require(any('library' in k for k in p.evaluate('window.__TEST_STORAGE__'))))
    # Curated 7-centre journey is ordinary composition.
    load(p);act(p,'library');act(p,'load-built-in','[data-value="seven-centres"]');p.evaluate('window.__FIELD_STUDIES__.pause()');p.evaluate("window.__FIELD_STUDIES__.openEditor('objects')");screenshot(p,'seven-centres.png')
    check('Seven-centre preset exposes seven editable entities with independent station links',lambda:require(len(current(p)['entities'])==7 and len(set(e['station'] for e in current(p)['entities']))==7))
    load(p);p.keyboard.press('i');p.mouse.move(740,440)
    check('Interact tool activates only the transient pointer',lambda:require(state(p)['pointerActive']))
    p.keyboard.press('p');check('Switching to Pin clears transient pointer influence',lambda:require(not state(p)['pointerActive']))
    act(p,'repeat-pins');p.mouse.click(700,360);p.mouse.click(730,410)
    check('Repeated pinning is explicit and places distinct force centres',lambda:require(state(p)['tool']=='pin' and len(current(p)['entities'])==4 and all(e['kind']=='pin' for e in current(p)['entities'][-2:])))
    # Wide-screen and narrow-screen remain bounded.
    load(p);p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(150);screenshot(p,'opening-mobile.png')
    check('Mobile opening has no horizontal page overflow',lambda:require(p.evaluate('document.documentElement.scrollWidth <= innerWidth+1')))
    p.keyboard.press('e');screenshot(p,'editor-mobile.png');check('Mobile contextual editor remains within viewport',lambda:require(p.locator('#inspector').bounding_box()['x']>=0 and p.evaluate('document.documentElement.scrollWidth <= innerWidth+1')))
    # Isolated actual playback test with short but valid durations.
    short=json.loads(json.dumps(opening));short['scenes']=short['scenes'][:2]
    for s in short['scenes']:s['duration']=1;s['transition']=.1
    p.set_viewport_size({'width':1100,'height':760});load(p,short);act(p,'play-journey');p.wait_for_function('window.__FIELD_STUDIES__.getState().sceneIndex===1',timeout=7000);p.evaluate('window.__FIELD_STUDIES__.pause()')
    check('Journey playback advances full named scenes on the shared clock',lambda:require(state(p)['sceneIndex']==1 and state(p)['simTime']>=1))
    check('All exercised browser interactions complete without runtime errors',lambda:require(not errors,str(errors)))
 with browser_session({'width':1000,'height':800},'reduce') as (_,ctx,p):
    load(p,still=False);check('Reduced motion starts paused without prohibiting deliberate play',lambda:require(not state(p)['playing']));act(p,'toggle-play');check('Reduced-motion user can explicitly resume',lambda:require(state(p)['playing']))
except Exception as err:
    results.append({'test':'browser acceptance','status':'failed','error':str(err)})
    traceback.print_exc()
finally:
    (EVIDENCE/'browser-results.json').write_text(json.dumps({'tests':results,'passed':sum(r['status']=='passed' for r in results),'runtimeErrors':errors,'environment':'Chromium + software WebGL under Xvfb; inline local content; explicit in-memory storage test double'},indent=2))
if any(r['status']=='failed' for r in results):raise SystemExit(1)
print(f'\n{len(results)} browser acceptance checks passed.',flush=True)
