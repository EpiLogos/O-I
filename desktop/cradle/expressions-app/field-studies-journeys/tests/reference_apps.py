"""Run both pinned native applications from their unchanged built entry points.
HTTP navigation needs a browser policy which permits local test servers (CI).
Do not rewrite the reference source or silently substitute the hosted adapter.
"""
from pathlib import Path
import json,threading,functools,http.server
from harness import browser_session
R=Path(__file__).resolve().parents[2];E=R/'field-studies-journeys/evidence-native';E.mkdir(exist_ok=True)
results=[]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
for name,revision in [('master','63e650d26a04447b973f73dded6b5046a0829e84'),('main','040627d0ea40032fe7c7b8c98be9a246be9db7f6')]:
 directory=R/'.parity-reference'/name/'dist';assert (directory/'index.html').exists()
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(directory)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with browser_session({'width':1280,'height':900},'reduce') as (_,context,p):
   errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
   p.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded',timeout=30000)
   p.wait_for_function('Array.from(document.querySelectorAll("canvas")).some(c=>c.width>0&&c.height>0)',timeout=30000)
   p.wait_for_timeout(2000)
   facts=p.evaluate('''()=>{const canvases=Array.from(document.querySelectorAll('canvas'));return {title:document.title,canvasCount:canvases.length,controls:document.querySelectorAll('button,input,select').length,webgl:canvases.some(c=>{try{return !!c.getContext('webgl2')}catch{return false}})};}''')
   p.screenshot(path=str(E/f'reference-{name}.png'))
   assert facts['webgl'] and facts['controls']>10 and not errors
   results.append({'reference':revision,'entry':'unmodified '+name+' application','ok':True,**facts,'browserErrors':errors})
 finally:server.shutdown();server.server_close()
(E/'reference-apps.json').write_text(json.dumps({'results':results},indent=2));print(json.dumps(results,indent=2))
