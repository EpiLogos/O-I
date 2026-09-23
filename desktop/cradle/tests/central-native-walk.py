#!/usr/bin/env python3
"""Real Central -> oi central -> desktop Kernel -> original Day source walk.

Only creates its own disposable ground. No live credentials, user files,
installations, external models or presumed Factory execution. Every public
operation and failure is retained in the chosen new output directory.
"""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

class Walk:
    def __init__(self, args, root, output):
        self.args, self.root, self.output = args, root, output
        self.calls, self.checks = [], []
        self.env = {**os.environ, 'HOME':str(root/'isolated-home'),
                    'OI_BIN':args.oi, 'OI_CENTRAL_CTRL_BIN':args.ctrl,
                    'OI_CENTRAL_ROOT':str(root), 'OI_CENTRAL_PROJECT_QUERY':'not-a-child',
                    'CENTRAL_NATIVE_TOKEN':secrets.token_hex(32)}
        self.process = None
        self.bridge_log = None

    def native(self, action, request, ok=True):
        completed = subprocess.run([self.args.ctrl,'--json','--root',str(self.root),'action','run',action,'-'],
                                   input=json.dumps(request),text=True,capture_output=True,env=self.env,timeout=40)
        try: result=json.loads(completed.stdout)
        except ValueError as e: raise AssertionError(f'{action}: invalid native JSON: {completed.stderr}') from e
        self.calls.append({'route':'ctrl','action':action,'request':request,'result':result,'exit':completed.returncode})
        assert result.get('ok') is ok and (completed.returncode==0) is ok, result
        return result.get('data',result)

    def op(self, request, ok=True):
        req=urllib.request.Request(self.url+'/op',data=json.dumps(request).encode(),headers={'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=45) as response: result=json.load(response)
        except urllib.error.HTTPError as e: result=json.load(e)
        self.calls.append({'route':'native-desktop','request':request,'result':result})
        assert result.get('ok') is ok, result
        return result.get('outcome',result)

    def central(self, kind, **request):
        value=self.op({'op':'central','project':None,'request':{'kind':kind,**request}})
        assert value['result']=='central_reading',value
        return value['data']

    def check(self, name, actual=True):
        assert actual, name
        self.checks.append(name)

    def start(self):
        self.bridge_log=open(self.output/f'bridge-{len(self.checks)}.log','w')
        self.process=subprocess.Popen([self.args.bridge,'127.0.0.1:0'],stdout=subprocess.PIPE,stderr=self.bridge_log,text=True,env=self.env)
        # The bridge prints its actual OS-assigned port; no shared service/port.
        import select
        ready,_,_=select.select([self.process.stdout],[],[],30)
        assert ready,'native bridge did not announce its port'
        line=self.process.stdout.readline()
        assert 'http://' in line,line
        self.url=line.split('http://',1)[1].split()[0]
        self.url='http://'+self.url

    def stop(self):
        if self.process:
            self.process.terminate()
            try:self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:self.process.kill();self.process.wait(timeout=5)
            self.process.stdout.close();self.process=None
        if self.bridge_log:self.bridge_log.close();self.bridge_log=None

    def setup(self):
        init=subprocess.run([self.args.ctrl,'--json','--root',str(self.root),'init'],capture_output=True,text=True,env=self.env,timeout=30)
        assert init.returncode==0,init.stderr+init.stdout
        (self.root/'isolated-home').mkdir(exist_ok=True)
        (self.root/'Work/material').mkdir(parents=True,exist_ok=True)
        (self.root/'Control/relations').mkdir(parents=True,exist_ok=True)
        actions=['central.day.ensure','central.document.create','central.document.mutate','central.receiving.submit','central.receiving.list','central.receiving.read','central.receiving.review','central.receiving.include','central.now.allocate']
        configs=[('placement.json','work-placement-policy',{'schema':'central.work-placement-policy/v1','scope_ref':'control:root','writable':[{'path':'Work/material','class':'repository'}],'enforcement':'native-actions','required_coverage':['file-content'],'lease_seconds':3600}),
                 ('time.json','civil-time-policy',{'schema':'central.civil-time-policy/v1','scope_ref':'control:root','timezone':'Etc/GMT+12','day_boundary_minutes':0,'automatic_day_rollover':True}),
                 ('authority.json','native-action-authority',{'schema':'central.native-action-authority/v1','scope_ref':'control:root','grants':[{'principal_ref':'human:controlled-walk','actor_kind':'human','token_sha256':hashlib.sha256(self.env['CENTRAL_NATIVE_TOKEN'].encode()).hexdigest(),'scope_refs':['control:root'],'actions':actions,'expires_at_unix_seconds':int(time.time())+3600}]})]
        relations=[]
        for name,role,value in configs:
            path='Control/user/'+name
            (self.root/path).write_text(json.dumps(value))
            relations.append({'ref':'central:source:control:root:'+path,'path':path,'roles':[role],'provenance':'human-adopted','standing':'architecture-contract','treatment':'control-user','recognition':'test-only-not-personal-adoption','recorded_at_unix_seconds':int(time.time())})
        (self.root/'Control/relations/source-relations.json').write_text(json.dumps({'schema':'central.control.ground-relations/v1','project_id':'control:root','relations':relations}))
        shutil.copyfile(HERE.parent/'documents/ql-daily-die.html',self.root/'Work/material/original.html')
        (self.root/'Control/user/intent.md').write_text('original authored ground\n')

    def run(self):
        self.setup();self.start()
        ground=self.central('inspect')
        self.check('root native ground works without a child Project',ground['sources']['state']=='ready' and not (self.root/'ProjectCentral').exists())
        rows=ground['sources']['data']['sources']
        source=next(s['binding']['ref'] for s in rows if s['binding']['path']=='Control/user/intent.md')
        location=self.central('source-location',source_ref=source)['location']
        opened=self.op({'op':'file_read','location':location})['reading']
        self.check('native Control filesystem read returns original root SourceRef',opened['source']['ref']==source and opened.get('project') is None)
        self.op({'op':'source_open','project':None,'source_ref':source})
        self.op({'op':'source_edit','source_ref':source,'content':'native revised ground\n'})
        saved=self.op({'op':'source_save','project':None,'source_ref':source})
        self.check('root source Save reaches native bytes',saved['result']=='source_saved' and (self.root/'Control/user/intent.md').read_text()=='native revised ground\n')
        self.op({'op':'source_edit','source_ref':source,'content':'held human draft\n'})
        (self.root/'Control/user/intent.md').write_text('concurrent external edit\n')
        failed=self.op({'op':'source_save','project':None,'source_ref':source})
        self.check('CAS conflict preserves both draft and external bytes',failed['result']=='source_save_failed' and (self.root/'Control/user/intent.md').read_text()=='concurrent external edit\n')
        self.stop();self.start()
        reread=self.op({'op':'source_open','project':None,'source_ref':source})['buffer']
        self.check('fresh kernel reopening reads exact root source',reread['content']=='concurrent external edit\n' and reread['root_register'])
        self.op({'op':'source_open','project':None,'source_ref':'unknown:source'},ok=False)
        self.check('missing source refuses rather than opening an empty editor')
        day=self.central('ensure-day',expected_time_policy_revision=ground['time']['data']['revision'])
        self.check('blank Day is not labelled a Daily Die',day['document_state']=='uninitialised')
        self.op({'op':'central','project':None,'request':{'kind':'open-day'}},ok=False)
        listing=self.op({'op':'files_list','path':'Work/material','fresh':True})['directory']
        form=next(e['location'] for e in listing['entries'] if e['name']=='original.html')
        read=self.op({'op':'file_read','location':form})['reading']
        policy=self.native('central.work.policy',{})
        document=self.central('initialise-day',day_ref=day['day_ref'],document_id='document:source-walk',expected_revision=day['revision']['revision'],expected_policy_revision=policy['revision'],form=form,expected_form_revision=read['revision'])
        self.check('actual original form traverses large native stdin without a replacement template',len(json.dumps(document))>65536 and len(document['document']['template_payload']['fields'])==17)
        opened=self.central('open-day')
        self.check('Today returns exact native current Day source/document',opened['day']['document']['document_id']==document['document_id'] and opened['location']['path']==document['source']['path'])
        day_source=document['source']['ref']
        self.op({'op':'source_open','project':None,'source_ref':day_source})
        allocation=self.native('central.now.allocate',{'task_ref':'test:source-walk-task','purpose':'Controlled native Return join (not actual Factory execution)','source_refs':[day_source],'day_ref':day['day_ref'],'expected_policy_revision':policy['revision'],'work_refs':[{'repo':'controlled/test','branch':'controlled','worktree_path':str(self.root/'Work/material')}]})
        returned=self.native('central.receiving.submit',{'producer_key':'controlled-return','source_ref':day_source,'document_id':document['document_id'],'expected_source_revision':document['revision']['revision'],'proposal':{'operation':'append-to-field','field_id':'p0_quick_thoughts','content':'Controlled producer result; not verified Factory work'},'now_ref':allocation['now_ref'],'day_ref':day['day_ref'],'task_ref':'test:source-walk-task','run_ref':'test:controlled-run','session_ref':'test:controlled-session','occurred_at_unix_seconds':int(time.time())})
        now=self.op({'op':'now','project':None,'request':{'kind':'read','now_ref':allocation['now_ref']}})['data']
        match=next(r for r in now['returns'] if r['return_ref']==returned['return_ref'])
        self.check('NOW composes real native receiving record with exact controlled correlations',match['run_ref']=='test:controlled-run' and match['session_ref']=='test:controlled-session' and match['day_ref']==day['day_ref'])
        before=(self.root/document['source']['path']).read_bytes()
        self.check('Return arrival does not rewrite human Day',self.native('central.document.read',{'source_ref':day_source,'document_id':document['document_id']})['revision']==document['revision'])
        # These bindings contain disposable public test identities, never keys.
        browser={'bridge':self.url,'source_ref':day_source,'document_id':document['document_id'],'root':str(self.root),'ctrl':self.args.ctrl,'now_ref':allocation['now_ref'],'return_ref':returned['return_ref'],'form_location':form}
        (self.output/'bindings.json').write_text(json.dumps(browser,indent=2))
        if self.args.browser:
            result=subprocess.run(['node',str(HERE/'central-native-browser.mjs'),'--bindings',str(self.output/'bindings.json'),'--output',str(self.output)],cwd=HERE.parent,env=self.env,timeout=240)
            self.check('real React/form/native-save browser walk',result.returncode==0)
            before=(self.root/document['source']['path']).read_bytes()
        # Advance the ACTUAL native civil policy by 26h in this test-only root.
        path=self.root/'Control/user/time.json';time_policy=json.loads(path.read_text());time_policy['timezone']='Pacific/Kiritimati';path.write_text(json.dumps(time_policy))
        time_read=self.native('central.time.policy',{})
        current=self.central('inspect')
        self.check('rollover exposes stale today instead of silently changing editor',current['day']['state']=='stale')
        self.op({'op':'central','project':None,'request':{'kind':'open-day'}},ok=False)
        next_day=self.central('ensure-day',expected_time_policy_revision=time_read['revision'])
        self.check('new civil Day allocated, prior source untouched',next_day['day_ref']!=day['day_ref'] and (self.root/document['source']['path']).read_bytes()==before)
        held=self.op({'op':'source_reread','project':None,'source_ref':day_source})['buffer']
        self.check('held source reread never follows new Today',json.loads(held['content'])['document_id']==document['document_id'])
        self.stop();self.start()
        historical=self.central('open-day',day_ref=day['day_ref'])
        self.check('restart restores exact historical Day by native reference',historical['day']['source']['ref']==day_source)
        protected=self.root/document['source']['path'];marker=protected.parent/'.no-agent-retrieval';marker.write_text('')
        self.op({'op':'source_open','project':None,'source_ref':day_source},ok=False)
        self.check('denied historical source remains denied after restart')
        marker.unlink()
        self.check('source-backed whole walk never created a child Project',not list((self.root/'Work').glob('*/ProjectCentral')))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ('ctrl','oi','bridge','output'):parser.add_argument('--'+key,required=True)
    parser.add_argument('--browser',action='store_true')
    args=parser.parse_args()
    for key in ('ctrl','oi','bridge'):
        path=Path(getattr(args,key)).resolve();assert path.is_file(),str(path);setattr(args,key,str(path))
    output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=False)
    receipt={'schema':'oi.central-source-walk/v1','classification':'controlled native source-backed; not installed/model/Mac acceptance','binary_sha256':{key:digest(getattr(args,key)) for key in ('ctrl','oi','bridge')},'original_sha256':digest(HERE.parent/'documents/ql-daily-die.html')}
    with tempfile.TemporaryDirectory(prefix='oi-central-native-walk-') as temp:
        walk=Walk(args,Path(temp),output)
        try:
            walk.run();receipt['status']='passed'
        except Exception as error:
            receipt['status']='failed';receipt['error']=repr(error)
            raise
        finally:
            walk.stop();receipt['checks']=walk.checks;receipt['calls']=walk.calls
            # Authority/token never enters receipts. Test ground is disposable.
            receipt['cleanup']='only the test-created temporary root and owned bridge process'
            (output/'receipt.json').write_text(json.dumps(receipt,indent=2))
            print(json.dumps({k:v for k,v in receipt.items() if k!='calls'},indent=2))
if __name__=='__main__':main()
