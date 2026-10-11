#!/usr/bin/env python3
"""Record official Node runtime bytes as application support, outside product IDs.

The producer consumes already recovered official release index/checksum/archive
bytes. The packager can call qualify_support/copy_support with its existing
Mach-O, relocation, signing and final-file receipt functions. No Rust build.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile

HERE=Path(__file__).resolve().parent
SCHEMA='oi.live-shell-application-support-inputs/v1'

def require(condition,message):
    if not condition: raise ValueError(message)

def digest(path):
    with Path(path).open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()

def record(path):
    path=Path(path).resolve(strict=True)
    return {'source':str(path),'sha256':digest(path),'bytes':path.stat().st_size}

def resource(path,target):
    return {**record(path),'path':target}

def read_member(archive,name):
    with tarfile.open(archive,'r:xz') as stream:
        item=stream.getmember(name)
        require(item.isfile(),'official runtime/source member must be regular')
        return stream.extractfile(item).read(),item.mode

def verify_record(item):
    path=Path(item['source'])
    require(path.is_absolute() and path.is_file() and not path.is_symlink(),'support source must be a contained explicit original file')
    require(digest(path)==item['sha256'] and path.stat().st_size==item['bytes'],'support source changed after freeze')
    return path

def qualify_support(binding,native_executable):
    require(binding['schema']==SCHEMA and binding['id']=='node-runtime' and binding['scope']=='application-support','not the application-owned Node support contract')
    version=binding['version']; require(version.startswith('v') and all(c.isdigit() or c=='.' for c in version[1:]),'invalid official Node version')
    proof=binding['provenance']
    for item in proof['inputs'].values(): verify_record(item)
    index=json.loads(Path(proof['inputs']['release_index']['source']).read_bytes())
    releases=[entry for entry in index if entry['version']==version]
    require(len(releases)==1 and releases[0]==proof['release'] and 'osx-arm64-tar' in releases[0]['files'] and 'src' in releases[0]['files'],'official release index correspondence differs')
    require(proof['official_origin']=='https://nodejs.org/dist/' and proof['source_correspondence']=='official-release-artifact-set','support source provenance differs')
    lines=Path(proof['inputs']['checksums']['source']).read_text().splitlines()
    checks={name:value for value,name in (line.split() for line in lines)}
    binary_name=f'node-{version}-darwin-arm64.tar.xz'; source_name=f'node-{version}.tar.xz'
    for kind,name in [('binary_archive',binary_name),('source_archive',source_name)]:
        require(Path(proof['inputs'][kind]['source']).name==name and checks[name]==proof['inputs'][kind]['sha256'],'archive differs from published official checksum')
    require(len(binding['executables'])==1 and binding['executables'][0]['path']=='bin/node','Node support has one explicit native executable')
    executable=binding['executables'][0]; path=verify_record(executable)
    member,_=read_member(proof['inputs']['binary_archive']['source'],f'node-{version}-darwin-arm64/bin/node')
    require(hashlib.sha256(member).hexdigest()==executable['sha256'] and len(member)==executable['bytes'],'Node executable differs from the official binary archive member')
    native_executable(path,darwin_arm64=True)
    require(binding['notices'] and binding['notices'][0]['path']=='notices/LICENSE-Node.txt','Node original notice contract differs')
    notice=verify_record(binding['notices'][0])
    binary_license,_=read_member(proof['inputs']['binary_archive']['source'],f'node-{version}-darwin-arm64/LICENSE')
    source_license,_=read_member(proof['inputs']['source_archive']['source'],f'node-{version}/LICENSE')
    require(binary_license==source_license==notice.read_bytes(),'Node binary/source licence originals differ')
    expected_resources=[{**item,'path':'sources/'+Path(item['source']).name} for item in proof['inputs'].values()]
    verify_record(proof['producer'])
    expected_resources.append({**proof['producer'],'path':'sources/application-support.py'})
    expected_notices=[{**binding['notices'][0]}]
    if 'shared_field_sdk' in proof:
        sdk_input=proof['shared_field_sdk'];sdk=json.loads(verify_record(sdk_input).read_bytes())
        require(sdk['schema']=='oi.shared-field-sdk-source-inventory/v1','Unknown SDK source contract')
        expected_resources.append({**sdk_input,'path':'sources/shared-field-sdk/inventory.json'})
        for key in ['lock','client_receipt','owner_client_build_commands']:
            item=sdk[key];verify_record(item)
            expected_resources.append({**item,'path':'sources/shared-field-sdk/'+key+'.json'})
        for package in sdk['packages']:
            item=package['archive'];archive=verify_record(item);entry=package['lock_entry']
            require(entry['resolved'].startswith('https://registry.npmjs.org/'),'SDK source must preserve its actual registry lock')
            alg,encoded=entry['integrity'].split('-',1)
            require(base64.b64encode(hashlib.new(alg,archive.read_bytes()).digest()).decode()==encoded,'SDK archive differs from original lock integrity')
            expected_resources.append({**item,'path':'sources/shared-field-sdk/'+archive.name})
            with tarfile.open(archive,'r:gz') as stream:
                originals=[stream.extractfile(member).read() for member in stream.getmembers() if member.isfile() and Path(member.name).name.lower().startswith(('license','notice','copying'))]
            for item in package['notices']:
                notice_path=verify_record(item);require(notice_path.read_bytes() in originals,'SDK notice differs from original package archive')
                expected_notices.append({**item,'path':'notices/'+notice_path.name})
    require(sorted(binding['resources'],key=lambda item:item['path'])==sorted(expected_resources,key=lambda item:item['path']),'Support resources must preserve every exact original release input')
    require(binding['notices']==expected_notices,'Support must preserve exact original SDK notices')
    paths={'bin/node','notices/LICENSE-Node.txt','provenance.json'}
    for item in binding['resources']:
        verify_record(item); path=PurePosixPath(item['path'])
        require(path.parts and not path.is_absolute() and '..' not in path.parts and item['path'] not in paths,'duplicate/escaping support resource')
        paths.add(item['path'])
    require(binding['runtime_env']=={'OI_NODE':{'kind':'executable','path':'bin/node'}},'application support cannot invent environment contracts')
    require(binding['transformations']==[],'official standalone Node does not need guessed native relocation')
    return path

def copy_support(binding,app,native_executable,relocate_and_sign,file_record):
    """Use actual packager helpers; original receipts survive re-signing."""
    qualify_support(binding,native_executable)
    app=Path(app); destination=app/'Contents/Resources/live-shell/application-support/node-runtime'
    require(not destination.exists(),'application support destination exists')
    destination.mkdir(parents=True)
    targets={}
    for item in [*binding['executables'],*binding['notices'],*binding['resources']]:
        target=destination/item['path'];target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(item['source'],target)
        require(digest(target)==item['sha256'] and target.stat().st_size==item['bytes'],'application support bytes changed during copy')
        targets[item['path']]=target
    # Existing native helper accepts original executable paths and indexes copied
    # bytes by bin/name. Its system-only dependency gate and signing are reused.
    relocation={'executables':[{'path':binding['executables'][0]['source'],'kind':'native'}],'transformations':[]}
    relocate_and_sign(relocation,destination,targets)
    provenance=destination/'provenance.json'
    provenance.write_text(json.dumps({'schema':'oi.live-shell-application-support-provenance/v1','input':binding},indent=2,sort_keys=True)+'\n')
    return {'executable':file_record(app,targets['bin/node']),
            'resources':[file_record(app,targets[item['path']]) for item in binding['resources']],
            'notices':[file_record(app,targets[item['path']]) for item in binding['notices']],
            'provenance':file_record(app,provenance)}

def load_packager():
    spec=importlib.util.spec_from_file_location('actual_support_packager',HERE/'package-payload.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def produce(archives,version,out,sdk_inventory=None):
    archives=Path(archives).resolve(strict=True); out=Path(out).absolute()
    require(not out.exists(),'support export already exists; preserve it')
    inputs={key:record(archives/name) for key,name in {
        'release_index':'index.json','checksums':'SHASUMS256.txt','checksum_signature':'SHASUMS256.txt.sig',
        'binary_archive':f'node-{version}-darwin-arm64.tar.xz','source_archive':f'node-{version}.tar.xz'}.items()}
    index=json.loads((archives/'index.json').read_bytes()); release=next(entry for entry in index if entry['version']==version)
    out.mkdir(parents=True)
    executable=out/'node'; data,mode=read_member(inputs['binary_archive']['source'],f'node-{version}-darwin-arm64/bin/node');executable.write_bytes(data);os.chmod(executable,mode)
    notice=out/'LICENSE-Node.txt';notice.write_bytes(read_member(inputs['binary_archive']['source'],f'node-{version}-darwin-arm64/LICENSE')[0])
    producer=record(__file__)
    support={'schema':SCHEMA,'id':'node-runtime','scope':'application-support','version':version,
      'executables':[resource(executable,'bin/node')],'notices':[resource(notice,'notices/LICENSE-Node.txt')],
      'resources':[resource(Path(item['source']),'sources/'+Path(item['source']).name) for item in inputs.values()]+[{**producer,'path':'sources/application-support.py'}],
      'runtime_env':{'OI_NODE':{'kind':'executable','path':'bin/node'}},'transformations':[],
      'provenance':{'official_origin':'https://nodejs.org/dist/','release':release,'inputs':inputs,'producer':producer,
        'source_correspondence':'official-release-artifact-set','observed_upstream_build_command':None,'observed_upstream_dirty_source':None,
        'checksum_signature_captured':True,'checksum_signature_verified':False}}
    if sdk_inventory:
        sdk_input=record(sdk_inventory);sdk=json.loads(Path(sdk_inventory).read_bytes())
        support['provenance']['shared_field_sdk']=sdk_input
        support['resources'].append({**sdk_input,'path':'sources/shared-field-sdk/inventory.json'})
        for key in ['lock','client_receipt','owner_client_build_commands']:
            support['resources'].append({**sdk[key],'path':'sources/shared-field-sdk/'+key+'.json'})
        for package in sdk['packages']:
            item=package['archive'];support['resources'].append({**item,'path':'sources/shared-field-sdk/'+Path(item['source']).name})
            support['notices'].extend({**item,'path':'notices/'+Path(item['source']).name} for item in package['notices'])
    helper=load_packager();qualify_support(support,helper.native_executable)
    env=dict(os.environ,PATH='/usr/bin:/bin:/usr/sbin:/sbin');env.pop('NODE_OPTIONS',None);env.pop('NODE_PATH',None)
    actual=subprocess.check_output([str(executable),'--version'],env=env,text=True).strip();require(actual==version,'official Node runtime version differs')
    dependencies,rpaths,identity=helper.load_commands(executable)
    require(identity is None and all(name.startswith(('/usr/lib/','/System/Library/')) for name in dependencies),'official Node has an undeclared non-system native dependency')
    support['provenance']['native_dependency_read']={'load_commands':dependencies,'rpaths':rpaths,'identity':identity}
    support['provenance']['actual_version_read']=actual
    (out/'application-support.json').write_text(json.dumps(support,indent=2,sort_keys=True)+'\n')
    return support

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archives',required=True);parser.add_argument('--version',required=True);parser.add_argument('--out',required=True)
    parser.add_argument('--shared-field-sdk-inventory')
    args=parser.parse_args();produce(args.archives,args.version,args.out,args.shared_field_sdk_inventory)
    path=Path(args.out)/'application-support.json'; print(json.dumps({'manifest':str(path.resolve()),'sha256':digest(path),'scope':'application-support; not product activation'}))

if __name__=='__main__':main()
