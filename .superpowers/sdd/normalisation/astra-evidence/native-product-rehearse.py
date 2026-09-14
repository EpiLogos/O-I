import os,subprocess,json,hashlib
from pathlib import Path
base=Path('/tmp/astra-personal-ground-proof');env=os.environ.copy();env.update(HOME=str(base/'human-home'),AIKIT_HOME=str(base/'aikit'),AIKIT_CONTEXT_ID='ctx_PERSONALGROUND00000000');rows=[]
commands=[['source','add-git','oi','https://github.com/EpiLogos/O-I.git','--revision','1d13af0f10d8887d2a9f2744035f0f24396eaab9','--root','skills'],['source','sync','oi'],['source','promote','oi','--trust'],['enable','skill/oi/cradle-execution','--scope','user'],['set','create','oi-native','skill/oi/cradle-execution'],['set','show','oi-native'],['apply']]
for args in commands:
 cmd=['/tmp/astra-aikit-user-ground/target/debug/aikit','--json',*args];p=subprocess.run(cmd,cwd=base/'Central',env=env,capture_output=True,text=True);r=json.loads(p.stdout);rows.append(dict(command=cmd,exit=p.returncode,result=r));(base/'native-product-transcript.json').write_text(json.dumps(rows,indent=2));assert p.returncode==0,r
source=subprocess.check_output(['git','-C','/tmp/astra-oi-main','show','1d13af0:skills/cradle-execution/SKILL.md']);expected=hashlib.sha256(source).hexdigest();proof={}
for relative in ['.agents/skills','.claude/skills','.codex/skills']:
 root=base/'human-home'/relative;actual=hashlib.sha256((root/'cradle-execution/SKILL.md').read_bytes()).hexdigest();assert actual==expected;proof[relative]=dict(link=str(root.readlink()),sha256=actual)
(base/'native-product-proof.json').write_text(json.dumps(dict(repository='https://github.com/EpiLogos/O-I.git',revision='1d13af0f10d8887d2a9f2744035f0f24396eaab9',source='skills/cradle-execution/SKILL.md',projections=proof),indent=2));print(json.dumps(proof))
