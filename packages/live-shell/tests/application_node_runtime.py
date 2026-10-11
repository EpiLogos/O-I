#!/usr/bin/env python3
"""Real official runtime + owner SharedField replay; component evidence only."""
import argparse,hashlib,importlib.util,json,os,shutil,subprocess,sys,uuid
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parents[1];REPO=HERE.parents[1]
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def require(value,message):
 if not value:raise AssertionError(message)
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def inventory(root):
 return {p.relative_to(root).as_posix():{'sha256':digest(p),'bytes':p.stat().st_size} for p in sorted(root.rglob('*')) if p.is_file()}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--support',required=True);p.add_argument('--out',required=True);a=p.parse_args()
 out=Path(a.out).absolute();require(not out.exists(),'Preserve prior evidence');out.mkdir(parents=True)
 support=load('support',HERE/'application-support.py');pack=load('packager',HERE/'package-payload.py');binding=json.loads(Path(a.support).read_bytes())
 fragment=out/'fragment';fragment.mkdir();receipt=support.copy_support(binding,fragment,pack.native_executable,pack.relocate_and_sign,pack.file_record)
 client=REPO/'shared-field/dist-client';proof=json.loads((client/'CLIENT.json').read_bytes())
 require(proof['schema']=='oi.shared-field-client-bundle/v1','Actual owner client receipt required')
 for name,value in proof['files'].items():require('sha256:'+digest(client/name)==value,'Actual owner client receipt bytes changed')
 target=fragment/'Contents/Resources/shared-field';shutil.copytree(client,target)
 node=fragment/receipt['executable']['path'];launcher=target/proof['launcher']
 env=dict(os.environ,PATH='/usr/bin:/bin:/usr/sbin:/sbin',OI_NODE=str(node),OI_STATE_HOME=str(out/'isolated-state'))
 for key in ['NODE_OPTIONS','NODE_PATH','OI_SHARED_FIELD_TARGET','OI_SHARED_FIELD_ENTRY','OI_SHARED_FIELD_TOKEN_LABEL']:env.pop(key,None)
 before=inventory(fragment);results=[]
 def invoke(name,request,values=env):
  r=subprocess.run([str(launcher)],input=json.dumps(request),env=values,text=True,capture_output=True,timeout=30)
  results.append({'name':name,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr});return r
 r=invoke('real-unbound-status',{'kind':'status'});value=json.loads(r.stdout)
 require(r.returncode==0 and value['ok'] is True and value['data']['schema']=='oi.shared-field.status/v1' and value['data']['bound'] is False,'Actual isolated status must report no binding')
 r=invoke('real-unbound-snapshot',{'kind':'snapshot'});require(r.returncode==1 and json.loads(r.stdout)['error']['kind']=='unbound','Actual snapshot must preserve unbound native result')
 r=invoke('invalid-explicit-interpreter',{'kind':'status'},{**env,'OI_NODE':str(out/'absent-node')});require(r.returncode!=0 and not r.stdout.strip(),'Invalid explicit interpreter must not fall back')
 require(before==inventory(fragment),'Owner operation changed packaged resource bytes')
 subprocess.run(['/usr/bin/codesign','--verify','--strict',str(node)],check=True,capture_output=True)
 # Actual copied bytes are tampered, while the published originals stay intact.
 tampered=out/'tampered-node';shutil.copy2(binding['executables'][0]['source'],tampered)
 with tampered.open('ab') as f:f.write(b'\x00')
 altered=json.loads(json.dumps(binding));altered['executables'][0]['source']=str(tampered)
 try:support.qualify_support(altered,pack.native_executable)
 except ValueError as e:results.append({'name':'tampered-real-runtime-refused','failure':str(e)})
 else:raise AssertionError('Tampered actual runtime was admitted')
 result={'schema':'oi.live-shell-application-support-component-replay/v1','standing':'actual component only; no installed application or live service claim','support_input':{'path':str(Path(a.support).resolve()),'sha256':digest(Path(a.support))},'producer':{'path':str(HERE/'application-support.py'),'sha256':digest(HERE/'application-support.py')},'consumer':{'path':str(HERE/'package-payload.py'),'sha256':digest(HERE/'package-payload.py')},'client_receipt':{'path':str(client/'CLIENT.json'),'sha256':digest(client/'CLIENT.json')},'support_payload':receipt,'signed_fragment_inventory':before,'operations':results,'resource_inventory_unchanged':True,'signature_after_operations':'codesign --verify --strict exit0'}
 path=out/'result.json';path.write_text(json.dumps(result,sort_keys=True,indent=2)+'\n');print(json.dumps({'path':str(path),'sha256':digest(path),'checks':len(results)}))
if __name__=='__main__':main()
