"""One-time transport of independently tested edits to this exact owned branch.

Every input and result is content-addressed. This script does not infer changes,
resolve conflicts, operate native user data, or write any branch by itself.
"""
import hashlib
import json
from pathlib import Path


def blob(text):
    data = text.encode('utf-8')
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


changes = json.loads(Path('scripts/wiki-constructive-edits.json').read_text())
prepared = []
for change in changes:
    path = Path(change['path'])
    assert str(path).startswith(('desktop/cradle/src/knowledge/', 'desktop/cradle/kernel/src/', 'desktop/cradle/tests/'))
    assert '..' not in path.parts and not path.is_symlink()
    before = path.read_text()
    assert blob(before) == change['before'], f"Unreconciled source: {path}: {blob(before)}"
    after = before
    for start, end, text in reversed(change['edits']):
        assert 0 <= start <= end <= len(before)
        after = after[:start] + text + after[end:]
    assert blob(after) == change['after'], f"Changed edit payload: {path}"
    prepared.append((path, after))
for path, after in prepared:
    path.write_text(after)
    print(f'Applied exact source: {path}')
