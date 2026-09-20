"""Generate reader/graph fixtures through the real AIKit CLI in an isolated World.

Only the literal controlled corpus below is read. No personal home, daemon,
model, credentials or installer is touched. Run with --aikit /path/to/aikit.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

CORPUS = {
    'a': ('Alpha', '''---
title: Alpha
aliases: [Opening]
tags: [notes, research]
---
# Alpha

🌱 [[Beta#Part|the next note]] and [again](b.md#^claim).

**Bold** and *emphasis*, `[[not a link]]`.

- [x] Ready
- [ ] Later

| Claim | Basis |
| --- | --- |
| One | Source |

> A quotation.

<script>window.__injected = true</script>

![image](https://example.invalid/image.png)

[[Missing]] [[Same]]
'''),
    'b': ('Beta', '# Part\n\nAn exact paragraph. ^claim\n\n[[Alpha]]\n'),
    'c': ('Same', 'One interpretation.'),
    'd': ('Same', 'Another interpretation.'),
}

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--aikit', required=True)
    args.add_argument('--output', default='tests/fixtures/wiki-native.json')
    options = args.parse_args()
    binary = str(Path(options.aikit).resolve())
    with tempfile.TemporaryDirectory(prefix='wiki-native-corpus-') as directory:
        root = Path(directory)
        sources = [dict(binding=dict(source=f'source:{key}', revision='r1', title=title,
                    tags=['notes'], visibility='public', owners=[], media_type='text/markdown',
                    locator=dict(kind='path', value=f'/world/{key}.md'), metadata={}), body=body)
                   for key, (title, body) in CORPUS.items()]
        sources.append(dict(binding=dict(source='source:private',revision='r1',title='PRIVATE_SENTINEL',
                    tags=[],visibility='personal',owners=['another-actor'],media_type='text/markdown',metadata={}),
                    body='Never expose PRIVATE_SENTINEL.'))
        (root/'source-material.json').write_text(json.dumps(sources),encoding='utf-8')
        # Do not forward any caller environment credentials or native runtime configuration.
        env = {'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(root),'AIKIT_HOME':str(root/'aikit-home')}
        def read(*operands):
            result = subprocess.run([binary,'--json','-C',str(root),'knowledge',*operands],env=env,
                                    capture_output=True,text=True,timeout=45,check=True)
            envelope = json.loads(result.stdout)
            if envelope.get('ok') is not True: raise RuntimeError(envelope)
            return envelope['data']
        result = {f'source:{key}':read('read','--',json.dumps({'kind':'source','value':f'source:{key}'})) for key in CORPUS}
        result['graph'] = read('graph','--','')
        result['relations'] = read('relations','--depth','2','--max-nodes','96','--max-edges','192','--',json.dumps({'kind':'source','value':'source:a'}))
        result['receipt'] = {'producer':subprocess.check_output([binary,'--version'],env=env,text=True).strip(),
                             'evidence':'real native CLI on controlled isolated sources; not installed-app/human acceptance'}
        encoded=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
        if 'PRIVATE_SENTINEL' in encoded: raise RuntimeError('Native admission leaked a private source')
        output = Path(options.output);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(encoded,encoding='utf-8')
        print(json.dumps({'output':str(output),'subjects':len(result['graph']['nodes']),'relations':len(result['graph']['edges']),**result['receipt']}))
if __name__=='__main__':main()
