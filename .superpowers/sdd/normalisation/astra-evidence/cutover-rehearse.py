import os,json,subprocess,shutil,hashlib
from pathlib import Path
base=Path('/tmp/astra-personal-ground-proof');central=base/'Central';ground=central/'Control/user/skills';home=base/'human-home';state=base/'aikit';context='ctx_PERSONALGROUND00000000'
env=os.environ.copy();env.update(HOME=str(home),AIKIT_HOME=str(state),AIKIT_CONTEXT_ID=context)
masters=sorted(p for p in Path('/Users/admin/.agents/skills').iterdir() if not p.is_symlink() and (p/'SKILL.md').is_file());retired=sorted(p for p in Path('/Users/admin/.codex/superpowers/skills').iterdir() if (p/'SKILL.md').is_file())
transcript=[];proof={}
for relative,projection_relative in [('.agents/skills','codex/.agents/skills'),('.claude/skills','claude/.claude/skills'),('.codex/skills','codex/.agents/skills')]:
 root=home/relative;assert not root.exists() and not root.is_symlink(),root
 for source in masters+retired:shutil.copytree(source,root/source.name)
 projection=state/'state/contexts'/context/'current/projections'/projection_relative
 args=['/tmp/astra-aikit-user-ground/target/debug/aikit','--json','adopt',str(root),'--control-ground',str(ground),'--projection',str(projection),'--namespace','personal']
 def run(cmd):
  p=subprocess.run(cmd,cwd=central,env=env,capture_output=True,text=True);r=json.loads(p.stdout);transcript.append(dict(command=cmd,exit=p.returncode,result=r));(base/'cutover-transcript.json').write_text(json.dumps(transcript,indent=2));assert p.returncode==0,(cmd,r);return r
 preview=run(args);assert not root.is_symlink()
 result=run(args+['--yes','--expect-digest',preview['data']['review_digest']]);assert root.is_symlink()
 actual={p.name for p in root.iterdir() if p.name!='aikit-context'};expected={p.name for p in masters};retired_names={p.name for p in retired}
 def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
 mismatch=[str(p.relative_to(source)) for source in masters for p in source.rglob('*') if p.is_file() and digest(p)!=digest(root/source.name/p.relative_to(source))]
 proof[relative]=dict(link_target=str(root.readlink()),procedure=result['data']['procedure'],projected=sorted(actual),missing=sorted(expected-actual),unexpected=sorted(actual-expected),retired_present=sorted(actual&retired_names),byte_mismatches=mismatch)
 assert actual==expected and not mismatch,proof
(base/'cutover-set-proof.json').write_text(json.dumps(proof,indent=2));print(json.dumps(proof,indent=2))
