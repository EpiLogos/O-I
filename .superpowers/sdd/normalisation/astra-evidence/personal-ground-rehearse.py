import os,json,subprocess,hashlib
from pathlib import Path
base=Path('/tmp/astra-personal-ground-proof'); central=base/'Central'; ground=central/'Control/user/skills'
ai='/tmp/astra-aikit-user-ground/target/debug/aikit'
ctrl='/tmp/astra-current-state/oi/installs/central-current/616749373a60f55e9fd99e4f2b0bebf2c73a674b/bin/ctrl'
env=os.environ.copy();env.update(HOME=str(base/'human-home'),AIKIT_HOME=str(base/'aikit'),AIKIT_CONTEXT_ID='ctx_PERSONALGROUND00000000')
log=[]
def run(cmd):
 p=subprocess.run(cmd,cwd=central,env=env,text=True,capture_output=True);r=json.loads(p.stdout);log.append(dict(command=cmd,exit=p.returncode,result=r));(base/'transcript.json').write_text(json.dumps(log,indent=2));assert p.returncode==0,(cmd,p.stdout,p.stderr);return r
def aik(*args):return run([ai,'--json',*args])
def native(action,body):return run([ctrl,'--root',str(central),'--json','action','run',action,json.dumps(body)])
def hashes(root):return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file() and p.name!='skill.json'}
masters=sorted(p for p in Path('/Users/admin/.agents/skills').iterdir() if not p.is_symlink() and (p/'SKILL.md').is_file())
archive=Path('/Users/admin/.codex/superpowers/skills');retired=sorted(p for p in archive.iterdir() if (p/'SKILL.md').is_file())
before={str(p):hashes(p) for p in masters+retired}
for source in masters+[archive]:
 args=['adopt',str(source),'--control-ground',str(ground)]
 preview=aik(*args);aik(*args,'--yes','--expect-digest',preview['data']['review_digest'])
for source in retired:native('control.skills.retire',dict(scope='control-user',name=source.name,retired_by='scratch-acceptance',retirement_reason='Scratch acceptance of archived superpowers; real human ground unchanged.'))
inspect=native('control.skills.inspect',{})
aik('source','add-directory','personal',str(ground),'--control-ground');aik('source','sync','personal');aik('source','promote','personal','--trust')
ids=['skill/personal/'+p.name for p in masters+retired]
for cid in ids:aik('enable',cid,'--scope','user')
aik('set','create','personal',*ids);shown=aik('set','show','personal');applied=aik('apply')
current=base/'aikit/state/contexts'/applied['context']['context_id']/'current'
expected={p.name for p in masters};retired_names={p.name for p in retired};proof={}
for harness,rel in [('claude','projections/claude/.claude/skills'),('codex','projections/codex/.agents/skills')]:
 root=current/rel;actual={p.name for p in root.iterdir() if p.name!='aikit-context'}
 mismatches=[p.name for p in masters if hashes(root/p.name)!=before[str(p)]]
 proof[harness]={'projected':sorted(actual),'missing':sorted(expected-actual),'unexpected':sorted(actual-expected),'retired_present':sorted(actual&retired_names),'payload_mismatches':mismatches}
 assert actual==expected and not mismatches,proof
source_changed=[str(p) for p in masters+retired if hashes(p)!=before[str(p)]]
assert not source_changed
for p in masters+retired:
 m=json.loads((ground/p.name/'skill.json').read_text());assert m['scope']=='control-user' and 'machine' not in m and m['provenance']=='adopted'
proof.update(active=sorted(expected),retired=sorted(retired_names),source_changed=source_changed,wrong_scope=[],machine_attribution=[],ground=str(ground))
(base/'set-proof.json').write_text(json.dumps(proof,indent=2));print(json.dumps(proof,indent=2))
