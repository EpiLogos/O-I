from pathlib import Path
import json,base64
from harness import browser_session
root=Path(__file__).resolve().parents[1]
with browser_session({'width':640,'height':480}) as (_,ctx,page):
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
 page.set_content('<!doctype html><html><body></body></html>')
 page.add_script_tag(content=(root/'build/native-harness.js').read_text())
 results=page.evaluate((root/'tests/native-gpu.js').read_text())
 evidence=root/'evidence-native';evidence.mkdir(exist_ok=True)
 capture=page.evaluate('window.__gpuCapture')
 if capture:(evidence/'gpu-capture.png').write_bytes(base64.b64decode(capture.split(',')[1]))
 print(json.dumps({'results':results,'browserErrors':errors},indent=2))
 (evidence/'gpu-acceptance.json').write_text(json.dumps({'results':results,'browserErrors':errors},indent=2))
 assert all(r['ok'] for r in results) and not errors
