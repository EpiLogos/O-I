"""One-shot delivery of the already-tested Wiki edits to this feature branch.

Every preimage and result is checked before any file is written. This never
merges branches, edits personal sources, invokes models or rewrites another
writer's changes. The delivery scaffold is removed after ordinary code lands.
"""
from hashlib import sha256
import json
from pathlib import Path

root = Path.cwd()
planned = []
seen = set()
for packet in sorted((root/'scripts/wiki-resume').glob('edits-*.json')):
    for item in json.loads(packet.read_text()):
        path = Path(item['path'])
        if path.is_absolute() or '..' in path.parts or not str(path).startswith('desktop/cradle/'):
            raise RuntimeError(f'Unowned path: {path}')
        if str(path) in seen:
            raise RuntimeError(f'Duplicate edit: {path}')
        seen.add(str(path))
        target = root/path
        original = target.read_bytes() if target.exists() else b''
        if (sha256(original).hexdigest() if target.exists() else None) != item['before']:
            raise RuntimeError(f'Exact source changed: {path}; reconcile before writing')
        text = original.decode('utf-8')
        edits = item['edits']
        previous = 0
        for edit in edits:
            if not (previous <= edit['start'] <= edit['end'] <= len(text)):
                raise RuntimeError(f'Invalid source offsets: {path}')
            previous = edit['end']
        for edit in reversed(edits):
            text = text[:edit['start']] + edit['text'] + text[edit['end']:]
        output = text.encode('utf-8')
        if sha256(output).hexdigest() != item['after']:
            raise RuntimeError(f'Result differs from the tested source: {path}')
        planned.append((target, output))
for target, output in planned:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(output)
Path('/tmp/wiki-delivery-paths.txt').write_text('\n'.join(str(path.relative_to(root)) for path, _ in planned)+'\n')
Path('/tmp/wiki-delivery-rust.txt').write_text('\n'.join(str(path.relative_to(root)) for path, _ in planned if path.suffix=='.rs')+'\n')
print(json.dumps({'applied':len(planned),'paths':sorted(seen)}))
