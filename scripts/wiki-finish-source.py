"""Apply the exact reviewed Wiki production repairs; unknown source stops.

Workflow changes are authored through the connected GitHub API, not this
runner's narrower token. No permissions are escalated or approvals bypassed.
"""
from pathlib import Path
import hashlib

root = Path(__file__).resolve().parents[1]
updates = {}
def change(path, old, new):
    text = updates.get(path, (root / path).read_text())
    if text.count(old) != 1:
        raise RuntimeError(f'{path}: expected one reviewed source anchor')
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
for path, text in updates.items():
    (root / path).write_text(text)
    print(path)
