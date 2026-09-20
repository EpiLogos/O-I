"""One-shot publisher; every original and the complete delta are hash checked."""
from pathlib import Path
import base64, hashlib, json, zlib
# Exact byte corrections verified against the downloaded first-run artifact.
# These change transfer material only, not the reviewed production delta.
repairs = [
 ('955437275cee81474a18a207c6639fd9b355a73dae0ec15f21808b66c260f08b', [(4480,4481,''),(6396,6406,''),(6416,6418,'O')]),
 ('6df0467b1f3bc4387405f62a7b48c4b038940d6422a6e4b6eed20ac80e42109a', []),
 ('83e7af994c99958523291891949cca0bf0d9363f6772e13a0c0d4614a74618ce', [(820,824,''),(838,839,'')]),
 ('45183db92e554513af375353d9a6e3fe3e55eb8ee609d8eca0f578cba5b4871e', [(4109,4110,''),(7143,7144,'')]),
]
parts=[]
for i,(digest,edits) in enumerate(repairs):
    part=Path(f'.github/w2-desktop-part{i}.b64').read_text().strip()
    assert hashlib.sha256(part.encode()).hexdigest()==digest, f'Transfer part {i} changed'
    for first,last,value in reversed(edits): part=part[:first]+value+part[last:]
    parts.append(part)
raw=''.join(parts)
assert hashlib.sha256(raw.encode()).hexdigest()=='06b725ddba3d17c8ad75f3cf4671391b088d1122c93e97fe789cd99c31494ceb'
data=zlib.decompress(base64.b64decode(raw,validate=True))
assert hashlib.sha256(data).hexdigest()=='ac93452980f33a528947902114c43c44a70daa1fd7bcffb45ab12762c9d176fe'
changes=json.loads(data)
outputs={}
for name,change in changes.items():
    path=Path(name)
    assert not path.is_absolute() and '..' not in path.parts
    assert name.startswith(('desktop/cradle/','docs/'))
    if change['base'] is None:
        assert not path.exists(), f'New path already exists: {name}'
        text=change['content']
    else:
        original=path.read_bytes()
        assert hashlib.sha256(original).hexdigest()==change['base'], f'Published source moved: {name}'
        lines=original.decode().splitlines(keepends=True)
        for first,last,replacement in reversed(change['edits']): lines[first:last]=[replacement]
        text=''.join(lines)
    outputs[path]=text
for path,text in outputs.items():
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(text)
Path('/tmp/w2-published-paths').write_text('\n'.join(changes)+'\n')
print(f'Applied {len(outputs)} exact guarded paths. No shared shell/editor files.')
