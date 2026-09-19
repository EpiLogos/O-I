from pathlib import Path
import json
from harness import browser_session
R=Path(__file__).resolve().parents[1];E=R/'evidence-native';HTML=(R/'public/index.html').read_text()
results=[]
with browser_session({'width':1440,'height':1000}) as (_,ctx,p):
 errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content(HTML,wait_until='load');p.wait_for_function('__FIELD_STUDIES__?.inspect()?.particleCount===62000');p.wait_for_timeout(3500);p.evaluate('__FIELD_STUDIES__.pause()');s=p.evaluate('__FIELD_STUDIES__.getState()');g=p.evaluate('__FIELD_STUDIES__.inspect(true)');assert all(isinstance(x,(int,float)) and abs(x)<1e30 for x in g['positions']);assert g['steps']>0
 results.append({'id':'DEFAULT-62000-LIVE','ok':True,'particles':62000,'physicsSteps':g['steps'],'renderFps':s['fps'],'note':'Measured software-renderer sample, not a target-device or 30-fps guarantee.'})
 p.screenshot(path=str(E/'parity-workspace.png'));p.locator('[data-action="library"]').first.click();p.wait_for_timeout(600);p.screenshot(path=str(E/'parity-library.png'));p.locator('[data-action="close-library"]').first.click()
 before=p.evaluate('__FIELD_STUDIES__.getDocument()')
 present=p.evaluate('()=>{const gl=document.getElementById("field-canvas").getContext("webgl2");window.__loss=gl.getExtension("WEBGL_lose_context");return !!__loss;}');assert present
 p.evaluate('__loss.loseContext()');p.wait_for_timeout(250);assert p.locator('#engine-recovery').is_visible();assert p.evaluate('__FIELD_STUDIES__.getDocument()')==before
 # Restore the device first. The application still requires explicit recovery,
 # because the lost GPU buffers are not a runtime checkpoint.
 p.evaluate('__loss.restoreContext()');p.wait_for_timeout(350);p.locator('[data-action="native-recover"]').click();p.wait_for_timeout(300);p.wait_for_function('!__FIELD_STUDIES__.getState().needsFrame')
 assert p.evaluate('__FIELD_STUDIES__.getDocument()')==before;assert p.evaluate('__FIELD_STUDIES__.inspect().particleCount')==62000
 results.append({'id':'REAL-WEBGL-LOSS-RECOVERY','ok':True,'documentPreserved':True,'explicitReseed':True});p.evaluate('__FIELD_STUDIES__.dispose()');assert not errors
(E/'parity-lifecycle.json').write_text(json.dumps({'results':results,'browserErrors':errors,'environment':'Chromium software WebGL; default 62000 particles, real WEBGL_lose_context extension.'},indent=2));print(json.dumps(results,indent=2))
