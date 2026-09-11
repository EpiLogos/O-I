#!/usr/bin/env python3
"""Run native deterministic integrations normally marked ignored, with real owners.

Only actual ACP/Pi provider cases remain outside this deterministic lane.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
OWNERS=ROOT/'.development-field-owners'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--out',required=True,type=Path)
    out=parser.parse_args().out.resolve();cut_path=ROOT/'tests/development-field/cut.json'
    expected={o['id']:o['revision'] for o in json.loads(cut_path.read_text())['owners']}
    dispatch=json.loads((out/'source-dispatch.json').read_text());assert dispatch['status']=='passed'
    products={p['owner']:p for p in dispatch['products']}
    variables={'central':'OI_CENTRAL_CTRL_BIN','actuation':'OI_ACTUATION_BIN','ai-kit':'OI_AIKIT_BIN','software-factory':'OI_FACTORY_BIN','workcell':'OI_WORKCELL_BIN','quaternal-logic':'OI_QL_BIN'}
    env=dict(os.environ)
    for key in list(env):
        if key.startswith(('OI_','AIKIT_')) or key=='CENTRAL_ROOT':del env[key]
    original_home=Path(env['HOME']);env.setdefault('RUSTUP_HOME',str(original_home/'.rustup'));env.setdefault('CARGO_HOME',str(original_home/'.cargo'))
    home=out/'native-bridges-home';home.mkdir(exist_ok=False);config=home/'.config/oi';config.mkdir(parents=True)
    env.update(HOME=str(home),OI_HOME=str(config),OI_DATA_HOME=str(home/'.local/share/oi'),AIKIT_HOME=str(home/'.aikit'),NO_COLOR='1')
    # O:I's native disclosure test executes in its own authored Project profile.
    # Supply the accepted owner registry that profile references, rather than
    # suppressing the profile or inventing replacement capabilities.
    registry=OWNERS/'ai-kit/registry';destination=home/'.aikit/registries/accepted-source-cut'
    shutil.copytree(registry,destination,symlinks=True)
    registry_manifest={str(p.relative_to(registry)):sha(p) for p in sorted(registry.rglob('*')) if p.is_file() and not p.is_symlink()}
    (out/'native-registry-basis.json').write_text(json.dumps({'owner_revision':expected['ai-kit'],'source':str(registry),'destination':str(destination),'files':registry_manifest},indent=2)+'\n')
    modules={}
    for owner,product in products.items():
        assert product['revision']==expected[owner] and sha(Path(product['executable']))==product['sha256']
        env[variables[owner]]=product['executable']
        modules[owner]={'id':owner,'public_name':owner,'native_executable':product['executable'],'version':product['revision'],'docs':'','modality':'developer-source','install_source':'exact-ci-source-cut'}
    (config/'composition.json').write_text(json.dumps({'schema':1,'modules':modules},indent=2)+'\n')
    env['PATH']=os.pathsep.join(str(Path(p['executable']).parent) for p in products.values())+os.pathsep+os.environ['PATH']
    env['OI_BIN']=dispatch['oi']['executable'];assert dispatch['oi']['revision']==expected['oi'] and sha(Path(env['OI_BIN']))==dispatch['oi']['sha256']
    env['AIKIT_CENTRAL_REAL_BIN']=products['central']['executable'];env['AIKIT_FACTORY_REAL_BIN']=products['software-factory']['executable']
    request=OWNERS/'software-factory/contracts/factory/fixtures/oi-self-hosting-commission-request.json'
    env['AIKIT_FACTORY_COMMISSION_REQUEST']=str(request);env['AIKIT_FACTORY_TEST_STATE_OUT']=str(out/'native-factory-state.json');env['AIKIT_FACTORY_TEST_MANIFEST_OUT']=str(out/'native-factory-manifest.json')
    gates=[('oi',['cargo','test','--manifest-path','cli/Cargo.toml','--locked','--test','owner_disclosure_native','--','--ignored','--nocapture'])]
    for package,target in [('aikit-adapters','actor_composition_native_central'),('aikit-adapters','central_wiki_native'),('aikit-adapters','factory_developmental_native'),('aikit-cli','factory_start_work_native'),('aikit-cli','factory_work_tui_native'),('aikit-cli','compose_native_central')]:
        gates.append(('ai-kit',['cargo','test','--locked','-p',package,'--test',target,'--','--ignored','--nocapture']))
    record={'schema':'oi.development-field-native-bridges/v1','cut_sha256':sha(cut_path),'harness_revision':os.environ.get('GITHUB_SHA'),'status':'failed','owner_revisions':expected,'commands':[],
        'fixture':{'path':str(request),'sha256':sha(request)},'registry_basis_sha256':sha(out/'native-registry-basis.json'),
        'provider_only_unexercised':['actual ACP operational-limit','actual ACP resident stream','actual Pi provider stream','actual ACP owner shutdown'],
        'P':'not-exercised','M':'not-exercised','H':'not-exercised','whole_C':'not-established'}
    for index,(owner,argv) in enumerate(gates):
        source=OWNERS/owner;assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()==expected[owner]
        log=out/f'native-bridge-{index:02d}.log'
        with log.open('w') as handle:result=subprocess.run(argv,cwd=source,env=env,stdout=handle,stderr=subprocess.STDOUT)
        record['commands'].append({'owner':owner,'argv':argv,'exit_code':result.returncode,'log':log.name,'sha256':sha(log)})
        (out/'native-bridges.json').write_text(json.dumps(record,indent=2,sort_keys=True)+'\n');print(log.read_text(errors='replace')[-14000:],flush=True)
    if all(c['exit_code']==0 for c in record['commands']):record['status']='passed'
    (out/'native-bridges.json').write_text(json.dumps(record,indent=2,sort_keys=True)+'\n');return int(record['status']!='passed')
if __name__=='__main__':sys.exit(main())
