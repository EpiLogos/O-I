#!/usr/bin/env python3
"""Bounded installed Central acceptance: read-only by default; explicit driver
bindings for real Mac interaction, provider, and microphone/audio observations.

Does not install, connect remotely, create source, send prompts, or activate
microphones itself. --execute runs only the locally reviewed exact commands;
missing evidence exits 2, failed drivers exit 1. Nothing skipped is green.
"""
import argparse, hashlib, json, os, platform, subprocess, sys, time
from pathlib import Path

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--oi',required=True);p.add_argument('--ctrl',required=True);p.add_argument('--root',required=True)
 p.add_argument('--output',required=True);p.add_argument('--bindings');p.add_argument('--execute',action='store_true')
 a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=False)
 receipt={'schema':'oi.central-local-acceptance/v1','observed_at_unix_seconds':int(time.time()),'machine':{'os':platform.system(),'release':platform.release(),'architecture':platform.machine()},'binaries':{k:sha(getattr(a,k)) for k in ('oi','ctrl')},'checks':[]}
 # Read metadata only; do not put private source text, local paths or tokens
 # into the portable receipt. Native failure itself remains a failure.
 result=subprocess.run([a.ctrl,'--json','--root',a.root,'action','run','central.day.read','{}'],capture_output=True,text=True,timeout=30)
 try:day=json.loads(result.stdout)
 except ValueError:day={'ok':False,'error':{'message':'native output was not JSON'}}
 data=day.get('data',{});source=data.get('source',{});document=data.get('document') or {}
 receipt['day']={'ok':day.get('ok') is True and result.returncode==0,'state':data.get('document_state'),'source_ref_sha256':hashlib.sha256(str(source.get('ref','')).encode()).hexdigest(),'document_id_sha256':hashlib.sha256(str(document.get('document_id','')).encode()).hexdigest(),'source_revision':data.get('revision'),'error_code':day.get('error',{}).get('code')}
 # Exact source/build/install/running cut must be supplied by the local lead;
 # a hash here is not an assertion that an app is running that binary.
 required=['source_build_install_running','mac_edit_save_reopen_back','rollover_restart_same_source','real_provider_return_origin','microphone_audio']
 bindings=json.loads(Path(a.bindings).read_text()) if a.bindings else {}
 failed=not receipt['day']['ok'];pending=False
 for name in required:
  item=bindings.get(name)
  if not a.execute or not isinstance(item,dict) or not isinstance(item.get('argv'),list) or not item['argv']:
   receipt['checks'].append({'name':name,'state':'pending','reason':'explicit local driver and permission not supplied'});pending=True;continue
  argv=item['argv'];assert all(isinstance(v,str) for v in argv),'argv must contain strings'
  # No shell interpolation and no silent model/microphone assumptions.
  try:
   run=subprocess.run(argv,capture_output=True,timeout=min(int(item.get('timeout_seconds',120)),300))
   evidence=Path(item.get('receipt_path',''))
   state='passed' if run.returncode==0 and evidence.is_file() else 'failed'
   record={'name':name,'state':state,'exit':run.returncode,'stdout_sha256':hashlib.sha256(run.stdout).hexdigest(),'stderr_sha256':hashlib.sha256(run.stderr).hexdigest()}
   if evidence.is_file():record['evidence_sha256']=sha(evidence)
   # A driver must attest what it actually observed, not just an exit code.
   if state=='passed':
    observed=json.loads(evidence.read_text());
    if observed.get('observed') is not True or observed.get('test_only') is True:record['state']='pending';pending=True
   failed|=record['state']=='failed';receipt['checks'].append(record)
  except Exception as error:failed=True;receipt['checks'].append({'name':name,'state':'failed','error':str(error)})
 receipt['status']='failed' if failed else 'pending' if pending else 'passed'
 receipt['limits']='Driver observations are attributable local reports; this script does not establish independent verification or human acceptance.'
 (out/'receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt,indent=2));return 1 if failed else 2 if pending else 0
if __name__=='__main__':sys.exit(main())
