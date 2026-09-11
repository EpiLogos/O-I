#!/usr/bin/env python3
"""Exercise accepted S3 against native binaries and the already executed specimen."""
import argparse, hashlib, json, os
from pathlib import Path
import subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--out',required=True,type=Path)
    out=parser.parse_args().out.resolve()
    cut_path=ROOT/'tests/development-field/cut.json';cut=json.loads(cut_path.read_text())
    expected={o['id']:o['revision'] for o in cut['owners']}
    dispatch=json.loads((out/'source-dispatch.json').read_text());assert dispatch['status']=='passed'
    products=dispatch['products'];env=dict(os.environ)
    for key in list(env):
        if key.startswith(('OI_','AIKIT_')) or key=='CENTRAL_ROOT':del env[key]
    for product in products:
        assert product['revision']==expected[product['owner']]
        assert hashlib.sha256(Path(product['executable']).read_bytes()).hexdigest()==product['sha256']
    env['PATH']=os.pathsep.join(str(Path(p['executable']).parent) for p in products)+os.pathsep+os.environ['PATH']
    env.update(DF_HARNESS_ROOT=str(ROOT),DF_S3_EVIDENCE=str(out),DF_CUT_SHA256=hashlib.sha256(cut_path.read_bytes()).hexdigest())
    argv=['cargo','test','--manifest-path','tests/development-field/probe/Cargo.toml','--locked','--test','s3','--','--nocapture']
    with (out/'s3-native.log').open('w') as handle: result=subprocess.run(argv,cwd=ROOT,env=env,stdout=handle,stderr=subprocess.STDOUT)
    receipt={'argv':argv,'exit_code':result.returncode,'cut_sha256':env['DF_CUT_SHA256'],'harness_revision':os.environ.get('GITHUB_SHA'),
        'log_sha256':hashlib.sha256((out/'s3-native.log').read_bytes()).hexdigest(),'status':'passed' if result.returncode==0 else 'failed'}
    (out/'s3-command.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print((out/'s3-native.log').read_text(errors='replace')[-24000:])
    return result.returncode
if __name__=='__main__':sys.exit(main())
