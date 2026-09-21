"""Temporary exact-source delivery helper for the owner-authorised Wiki branch.

Only named, reviewed source substitutions are permitted. Unknown source drift
stops the helper. The workflow uses ordinary no-force branch pushes, never main.
"""
from pathlib import Path
import hashlib

root = Path(__file__).resolve().parents[1]
updates = {}
def change(path, old, new):
    text = updates.get(path, (root / path).read_text())
    if text.count(old) != 1:
        raise RuntimeError(f'{path}: expected one reviewed source anchor; no speculative patch applied')
    updates[path] = text.replace(old, new, 1)

path = 'desktop/cradle/kernel/src/expression.rs'
data = (root / path).read_bytes()
blob = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
if blob != '5d57a099b44980149c3056e76a03d24233a7cb55':
    raise RuntimeError(f'Unreviewed Expression source {blob}')
change(path,
    'match client.run("central.files.create", json!({"parent":parent,"name":name,"content":content,',
    '// The explicit directory already supplies root identity. Suppress the\n                // generic project fallback before the strict file-owner call.\n                match client.run("central.files.create", json!({"project":null,"parent":parent,"name":name,"content":content,')
path = 'desktop/cradle/src/knowledge/constructionProjection.ts'
change(path, "import {kernelOp} from '../kernel/bridge';", "import {requireExpressionOutcome} from './expressionOutcome';\nimport {kernelOp} from '../kernel/bridge';")
change(path, "if (value.state === 'revision_conflict') throw new Error('The composition changed. Reopen its current revision before saving.');", 'requireExpressionOutcome(value, request.operation);')
path = 'desktop/cradle/tests/wiki-constructive-browser.mjs'
change(path,
    "if(result.error||result.ok===false)responses.push(result);",
    "if(result.error||result.ok===false||/(?:refused|failed|conflict|unavailable)$/.test(result.outcome?.data?.state??''))responses.push(result);")
change(path,
    "await drawer.getByRole('button',{name:'Save Expression file',exact:true}).click();",
    "const firstSaveResponse=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/op')&&response.request().postDataJSON()?.request?.operation==='save_as');\n await drawer.getByRole('button',{name:'Save Expression file',exact:true}).click();\n const firstSave=await (await firstSaveResponse).json();\n check(firstSave.outcome?.data?.state==='saved',`Native first save returns its actual successful result: ${JSON.stringify(firstSave.outcome?.data)}`);")
path = '.github/workflows/wiki-constellation.yml'
change(path, 'group: wiki-constellation-${{ github.event.pull_request.number }}', 'group: wiki-constellation-${{ github.event.pull_request.number || github.ref }}')
change(path, 'on:\n  pull_request:', 'on:\n  push:\n    branches: [agent/wiki-constellation-loop-20260920]\n    paths:\n      - desktop/cradle/src/knowledge/**\n      - desktop/cradle/kernel/**\n      - desktop/cradle/tests/wiki-*\n      - .github/workflows/wiki-constellation.yml\n  pull_request:')
change(path, '          cp /tmp/wiki-native-binaries.json /tmp/wiki-evidence/ 2>/dev/null || true', '''          cp /tmp/wiki-native-binaries.json /tmp/wiki-evidence/ 2>/dev/null || true
          python3 - <<'PY'
          import json, pathlib, subprocess, tarfile
          receipt = pathlib.Path('/tmp/wiki-native-binaries.json')
          if receipt.exists():
              with tarfile.open('/tmp/wiki-evidence/native-executables.tar.gz', 'w:gz') as archive:
                  for name, path in json.loads(receipt.read_text()).items():
                      executable = pathlib.Path(path)
                      if executable.is_file():
                          copy = pathlib.Path('/tmp/wiki-evidence') / name
                          copy.write_bytes(executable.read_bytes())
                          subprocess.run(['strip', '--strip-debug', str(copy)], check=True)
                          archive.add(copy, arcname=name)
                          copy.unlink()
          PY
          if [ -d desktop/cradle/node_modules ]; then tar -czf /tmp/wiki-evidence/cradle-runtime.tar.gz desktop/cradle/node_modules; fi''')
for path, text in updates.items():
    (root / path).write_text(text)
    print(path)
