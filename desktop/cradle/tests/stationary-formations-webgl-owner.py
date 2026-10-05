#!/usr/bin/env python3
"""Real WebGL renderer owner test. Explicit frozen source inputs, output-only."""
from pathlib import Path
import argparse,datetime,functools,hashlib,http.server,json,os,subprocess,threading
from playwright.sync_api import sync_playwright

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def pin(p):return {'path':str(Path(p).resolve()),'sha256':sha(p)}
def save(p,v):Path(p).parent.mkdir(parents=True,exist_ok=True);Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--config',type=Path,required=True);args=ap.parse_args();cfg=json.loads(args.config.read_text());out=Path(cfg['output_dir']);out.mkdir(parents=True,exist_ok=True);assert not(out/'receipt.json').exists(),'retain previous run'
 roles=['point_cloud_source','simulator_source','field_model_source']
 for role in roles:assert sha(cfg[role])==cfg['expected_sha256'][role],'qualified source changed:'+role
 source=Path(cfg['test_source']);entry=out/'acceptance.ts';entry.write_text(source.read_text().replace('__POINT_CLOUD_FIELD__',cfg['point_cloud_source']).replace('__FIELD_MODEL__',cfg['field_model_source']))
 argv=[cfg['esbuild_bin'],str(entry),'--bundle','--format=esm','--platform=browser','--outfile='+str(out/'acceptance.js'),'--metafile='+str(out/'metafile.json')]
 result=subprocess.run(argv,env={**os.environ,'NODE_PATH':cfg['node_modules']},capture_output=True,text=True);(out/'build.log').write_text(result.stdout+result.stderr);assert result.returncode==0,result.stderr
 report={'schema':'epi.stationary-gpu-owner-receipt/v1','started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':False,'scope':'Actual renderer owner API/WebGL2 component test only. No native bridge/process/build, no ordinary/installed/whole/audio/source numerical standing.','inputs':[pin(args.config),pin(source),pin(__file__)]+[pin(cfg[r]) for r in roles],'build':{'argv':argv,'exit_code':result.returncode,'log':pin(out/'build.log'),'bundle':pin(out/'acceptance.js'),'metafile':pin(out/'metafile.json')},'errors':[],'compiled_inputs':[]}
 for i,p in enumerate(json.loads((out/'metafile.json').read_text())['inputs']):
  original=Path(p).resolve();copied=out/'source-snapshots'/f'{i:03d}-{original.name}';copied.parent.mkdir(parents=True,exist_ok=True);copied.write_bytes(original.read_bytes());report['compiled_inputs'].append({'original':pin(original),'snapshot':pin(copied)})
 for role in roles:assert sha(cfg[role])==cfg['expected_sha256'][role],'qualified source changed during compilation:'+role
 (out/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Actual selective stationary GPU admission</title><script type="module" src="/acceptance.js"></script>')
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(out)));threading.Thread(target=server.serve_forever,daemon=True).start();browser=None
 try:
  with sync_playwright() as pw:
   launch=['--use-angle=swiftshader','--enable-unsafe-swiftshader'];browser=pw.chromium.launch(headless=True,executable_path=cfg['browser_executable'],args=launch);report['browser']={'version':browser.version,'headless':True,'args':launch};page=browser.new_page(viewport={'width':800,'height':600});page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
   page.expose_function('saveStationaryArtifact',lambda name,v:save(out/'artifacts'/(name+'.json'),v));page.expose_function('saveStationaryProof',lambda v:save(out/'browser-proof.json',v));page.goto(f'http://127.0.0.1:{server.server_address[1]}/',wait_until='domcontentloaded');page.wait_for_function('window.acceptance!==undefined',timeout=180000);proof=page.evaluate('window.acceptance');report['passed']=proof['passed'];report['failure']=proof.get('error');report['cases']=len(proof.get('cases',[]));report['proof']=pin(out/'browser-proof.json');browser.close();browser=None
 except Exception as e:report['failure']=repr(e)
 finally:
  if browser:
   try:browser.close()
   except Exception:pass
  server.shutdown();server.server_close();report['finished_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();save(out/'receipt.json',report)
 print(json.dumps({'passed':report['passed'],'failure':report.get('failure'),'cases':report.get('cases'),'receipt':pin(out/'receipt.json')}));return 0 if report['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
