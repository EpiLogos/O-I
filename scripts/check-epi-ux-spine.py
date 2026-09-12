#!/usr/bin/env python3
"""Check the H-pending Epi extension; never confer running-app or human acceptance."""
from pathlib import Path
import argparse, hashlib, json, re, sys, unittest
ROOT = Path(__file__).resolve().parents[1]


def validate(root, overrides=None):
    overrides = overrides or {}
    def read(path):
        return overrides.get(path, (root / path).read_text())
    states = read('docs/cradle/03-UX-STATES.md')
    verify = read('docs/cradle/04-VERIFICATION.md')
    skill = read('skills/cradle-execution/SKILL.md')
    for family in 'ABCDEFGHIJKL':
        if not re.search(r'^## ' + family + r'\.', states, re.M):
            raise ValueError(f'missing state family {family}')
    for i in range(12):
        if not re.search(r'`L' + str(i) + r'\b', states):
            raise ValueError(f'missing Epi state L{i}')
        if f'UX{i+1:02}' not in states or f'UX{i+1:02}' not in verify:
            raise ValueError('missing human walk')
    for text in ['## 2. The spine: the everyday loop', '## 7. Source reconciliation and unresolved evidence', '## 8. Epi domain walks', 'fresh agent', 'human']:
        if text not in verify:
            raise ValueError(f'verification loses {text}')
    if 'description: "METHOD:' not in skill:
        raise ValueError('Method description prefix absent')
    if 'Non-effectful read within actual access/disclosure scope' not in states:
        raise ValueError('current read/authority distinction lost')
    for text in ['### C.T', '### D.P', '### G.W', 'root\nmeta-Project', 'Receipt ≠ human awareness/inclusion/Recognition']:
        if text not in states:
            raise ValueError(f'current Cradle meaning lost: {text}')
    for token in ['0→1', '18', '3:3', '4:2', 'T/T′', '= name', 'M0′', 'M5′']:
        if token not in states:
            raise ValueError(f'source specificity lost: {token}')
    for text in [states.split('## L.', 1)[1], verify.split('## 8.', 1)[1], skill.split('## Epi domain:', 1)[1]]:
        if 'H ratification pending (Satya)' not in text:
            raise ValueError('new Epi material loses its pending H standing')
    return {'families': 'A–K and current CAW retained; H-pending L0–L11 added', 'walks': 12, 'H_ratification': 'pending', 'standing': 'source conformance only; no runtime/agent/human acceptance'}


def check_baseline(root):
    # One-time publication check against the actual main inspected for this merge.
    # Later source-authorised changes are not locked to these historical bytes.
    cases = [
        ('docs/cradle/03-UX-STATES.md', '\n## L.', '1cc09d0d0682fd89552dbee65ad87ac48c0ad8be'),
        ('docs/cradle/04-VERIFICATION.md', '\n## 8.', '21e1b797b0d21a77c79f16ba70ccd8795e67577f'),
    ]
    for path, marker, expected in cases:
        text = (root / path).read_text()
        original = (text.split(marker, 1)[0].rstrip() + '\n').encode()
        actual = hashlib.sha1(b'blob ' + str(len(original)).encode() + b'\0' + original).hexdigest()
        if actual != expected:
            raise ValueError(f'publication altered existing Cradle text: {path}: {actual}')
    return {'preserved_main': 'ae7ae541538c2e3123e43399a80286604ec0819e', 'original_cradle_files': 2, 'byte_preservation': True}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--check-publication-baseline', action='store_true')
    args = ap.parse_args()
    result = validate(ROOT)
    if args.check_publication_baseline:
        result.update(check_baseline(ROOT))
    if args.self_test:
        class Mutations(unittest.TestCase):
            def reject(self, path, old, new):
                text = (ROOT / path).read_text()
                self.assertIn(old, text)
                with self.assertRaises(ValueError):
                    validate(ROOT, {path: text.replace(old, new)})
            def test_spine(self): self.reject('docs/cradle/04-VERIFICATION.md', '## 2. The spine: the everyday loop', '## 2. Replaced')
            def test_state(self): self.reject('docs/cradle/03-UX-STATES.md', '`L11 Shared encounter`', '`Absent`')
            def test_human(self): self.reject('docs/cradle/04-VERIFICATION.md', 'UX12', 'removed')
            def test_method(self): self.reject('skills/cradle-execution/SKILL.md', 'description: "METHOD:', 'description: "')
            def test_scope(self): self.reject('docs/cradle/03-UX-STATES.md', 'Non-effectful read within actual access/disclosure scope', 'anything visible')
            def test_pending(self): self.reject('docs/cradle/03-UX-STATES.md', 'H ratification pending (Satya)', 'ratified by merge')
            def test_concurrent(self): self.reject('docs/cradle/03-UX-STATES.md', '### G.W', '### Removed')
        run = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Mutations))
        if not run.wasSuccessful(): return 1
        result['mutations'] = run.testsRun
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    try: sys.exit(main())
    except (ValueError, OSError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
