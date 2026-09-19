"""Serve the built multi-page app on a local-only test port; verify default entry and export."""
from pathlib import Path
import json,threading,functools,http.server
from harness import browser_session
R=Path(__file__).resolve().parents[2];E=R/'field-studies-journeys/evidence-native';E.mkdir(exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(R/'dist')))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
try:
 with browser_session({'width':1440,'height':1000},'reduce') as (_,context,p):
  errors=[];external=[];p.on('request',lambda r:external.append(r.url) if not r.url.startswith(('http://127.0.0.1:', 'data:', 'blob:')) else None);p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle',timeout=15000)
  p.wait_for_function('window.__FIELD_STUDIES__?.inspect()?.particleCount===62000')
  assert p.evaluate('window.__FIELD_STUDIES__.capabilities.kind')=='production'
  p.screenshot(path=str(E/'review-opening.png'))
  p.locator('[data-action="library"]').click()
  with p.expect_download() as d:p.locator('#library-page [data-action="export-artifact"]').click()
  out=E/'module-export.html';d.value.save_as(out);assert 'window.__JOURNEY__=' in out.read_text()
  assert 'Native particle field' in out.read_text()
  result={'defaultRoute':'native journey instrument','particleCount':62000,'moduleArtifactExport':True,'externalRequests':external,'browserErrors':errors,'standaloneBytes':out.stat().st_size}
  (E/'module-acceptance.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));assert not errors
  p.evaluate('window.__FIELD_STUDIES__.dispose()')
finally:server.shutdown();server.server_close()
