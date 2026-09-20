"""One-shot publisher of the reviewed W2 delta; no production edits before all hashes pass."""
from pathlib import Path
import base64, hashlib, json, zlib
parts = [Path(f'.github/w2-desktop-part{i}.b64').read_text().strip() for i in range(4)]
# Correct only known transport transcription errors; the whole hash below is
# authoritative, and any other transcription damage stops publication.
corrections = [
 ('h8om3EmTXZZmw93', 'h8om3EmTXZmw93'),
 ('RjLgcWswOIqTwWlrOBqUxTwWlrOBqMTgajo9bh4Eoxw0Gol', 'RjLgcWswOIqTwWlrOBqMTgajo9bh4Oxw0Gol'),
 ('OIhPD46Oh6fjVitJVitJvPBR4QG7ccnldR5snHW0', 'OIhPD46Oh6fjVitJvPBR4QG7ccnldRsnHW0'),
 ('8jn6SzbVbzF1mfHto', '8jn6SzbVbzFmfHto'),
 ('5296eU4O9qdZPnud3uFF', '5296eU4O9qdZPud3uFF'),
]
raw = ''.join(parts)
for before, after in corrections:
    if before in raw:
        assert raw.count(before) == 1
        raw = raw.replace(before, after)
actual = hashlib.sha256(raw.encode()).hexdigest()
assert actual == '06b725ddba3d17c8ad75f3cf4671391b088d1122c93e97fe789cd99c31494ceb', f'Transfer differs; no production write: {actual}, {len(raw)} chars'
data = zlib.decompress(base64.b64decode(raw, validate=True))
assert hashlib.sha256(data).hexdigest() == 'ac93452980f33a528947902114c43c44a70daa1fd7bcffb45ab12762c9d176fe'
changes = json.loads(data)
outputs = {}
for name, change in changes.items():
    path = Path(name)
    assert not path.is_absolute() and '..' not in path.parts
    assert name.startswith(('desktop/cradle/', 'docs/'))
    if change['base'] is None:
        assert not path.exists(), f'New path already exists: {name}'
        text = change['content']
    else:
        original = path.read_bytes()
        assert hashlib.sha256(original).hexdigest() == change['base'], f'Published source moved: {name}'
        lines = original.decode().splitlines(keepends=True)
        for first, last, replacement in reversed(change['edits']):
            lines[first:last] = [replacement]
        text = ''.join(lines)
    outputs[path] = text
for path, text in outputs.items():
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
Path('/tmp/w2-published-paths').write_text('\n'.join(changes)+'\n')
print(f'Applied {len(outputs)} exact guarded paths. No shared shell/editor files.')
