"""Full-allocation semantic-field acceptance on the real hosted production engine.
No performance threshold is invented: record observed software-WebGL fps and prove
62k particles, shared forces, focus, resonance, semantic colour and automation run
simultaneously without reseed or browser errors.
"""
from pathlib import Path
import json, math
from harness import browser_session
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'evidence-native';E.mkdir(exist_ok=True)
HTML=(ROOT/'public/index.html').read_text()
STORAGE="<script>window.__TEST_STORAGE__={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__TEST_STORAGE__[k]??null,setItem:(k,v)=>window.__TEST_STORAGE__[k]=String(v),removeItem:k=>delete window.__TEST_STORAGE__[k]},configurable:true});</script>"
with browser_session({'width':1280,'height':820},'reduce') as (_,ctx,p):
    errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
    p.set_content('<body></body>');p.add_script_tag(content=(ROOT/'build/native-harness.js').read_text())
    fixture=p.evaluate('''()=>{
      const preset=NATIVE_TEST.COMPOSITION_PRESETS.find(p=>p.id==='chakra_cymatic');
      const built=preset.build();
      const entities=[...built.entities,
        NATIVE_TEST.makeNativePin({id:'stress-pin-a',x:-70,y:0,z:35,forces:{mode:'attract',strength:2.2,radius:260,spin:.3}}),
        NATIVE_TEST.makeNativePin({id:'stress-pin-b',x:70,y:0,z:-35,forces:{mode:'repel',strength:1.8,radius:240,spin:-.25}})
      ];
      const config=NATIVE_TEST.migrateConfig({
        particleCount:62000,entities,composition:built.composition,cymatics:built.cymatics,
        semanticField:built.semanticField,resonanceDrive:built.resonanceDrive,
        automations:[{id:'stress-lfo',path:'fluid.curlScale',enabled:true,type:'lfo',waveform:'sine',min:.8,max:1.6,rateHz:.35,phase:0,blend:'replace'}]
      });
      return NATIVE_TEST.nativeSnapshotToJourney({schemaVersion:5,name:'Semantic full allocation',config});
    }''')
    start=STORAGE+'<script>window.__JOURNEY__='+json.dumps(fixture).replace('</','<\\/')+';</script>'
    p.set_content(HTML.replace('<head>','<head>'+start,1),wait_until='load')
    p.wait_for_function('window.__FIELD_STUDIES__?.inspect()?.particleCount===62000',timeout=30000)
    initial=p.evaluate('window.__FIELD_STUDIES__.inspect()')
    p.evaluate('window.__FIELD_STUDIES__.play()');p.wait_for_timeout(1800);p.evaluate('window.__FIELD_STUDIES__.pause()')
    state=p.evaluate('window.__FIELD_STUDIES__.getState()');gpu=p.evaluate('window.__FIELD_STUDIES__.inspect()');tele=p.evaluate('window.__FIELD_STUDIES__.telemetry()')
    assert gpu['particleCount']==62000 and gpu['seeds']==initial['seeds']==1 and gpu['steps']>initial['steps']
    assert tele['focus'] is not None and tele['cymatic'] and tele['cymatic']['enabled']
    assert len(tele.get('semantic',{}).get('colorFields',[]))>=7
    assert len(tele.get('live',[]))>=1
    assert math.isfinite(state['fps']) and state['fps']>=0
    assert not errors
    report={'ok':True,'particleCount':gpu['particleCount'],'physicsSteps':gpu['steps'],'seeds':gpu['seeds'],'renderFpsSoftwareWebGL':state['fps'],'semanticColorFields':len(tele['semantic']['colorFields']),'focus':tele['focus'],'cymaticFrequencyHz':tele['cymatic']['frequencyHz'],'automationLive':len(tele['live']),'browserErrors':errors,'note':'Observed Chromium software-WebGL value only; no target-device fps claim.'}
    (E/'semantic-full-allocation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
    p.screenshot(path=str(E/'semantic-full-allocation.png'));p.evaluate('window.__FIELD_STUDIES__.dispose()')
