#!/usr/bin/env python3
"""Check the H-pending Epi extension; never confer running-app or human acceptance."""
from pathlib import Path
import argparse, json, re, sys, unittest
ROOT = Path(__file__).resolve().parents[1]
SPINE = '## 0. The spine: the everyday loop'
EPI_WALKS = '## 12. Epi domain walks'


def validate(root, overrides=None):
    overrides = overrides or {}
    def read(path):
        return overrides.get(path, (root / path).read_text())
    states = read('docs/cradle/03-UX-STATES.md')
    # The everyday-loop spine and the UX01–UX12 walks moved from the retired
    # docs/cradle/04-VERIFICATION.md into the one test protocol (O-I #728).
    protocol = read('docs/experience/LOCAL-CAMPAIGN.md')
    skill = read('skills/cradle-execution/SKILL.md')
    for family in 'ABCDEFGHIJKL':
        if not re.search(r'^## ' + family + r'\.', states, re.M):
            raise ValueError(f'missing state family {family}')
    for i in range(12):
        if not re.search(r'`L' + str(i) + r'\b', states):
            raise ValueError(f'missing Epi state L{i}')
        if f'UX{i+1:02}' not in states or f'UX{i+1:02}' not in protocol:
            raise ValueError('missing human walk')
    for text in [SPINE, '## 11. Source reconciliation and unresolved evidence', EPI_WALKS, 'fresh agent', 'human']:
        if text not in protocol:
            raise ValueError(f'test protocol loses {text}')
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
    for text in [states.split('## L.', 1)[1], protocol.split(EPI_WALKS, 1)[1], skill.split('## Epi domain:', 1)[1]]:
        if 'H ratification pending (Satya)' not in text:
            raise ValueError('new Epi material loses its pending H standing')
    return {'families': 'A–K and current CAW retained; H-pending L0–L11 added', 'walks': 12, 'H_ratification': 'pending', 'standing': 'source conformance only; no runtime/agent/human acceptance'}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--self-test', action='store_true')
    args = ap.parse_args()
    result = validate(ROOT)
    if args.self_test:
        class Mutations(unittest.TestCase):
            def reject(self, path, old, new):
                text = (ROOT / path).read_text()
                self.assertIn(old, text)
                with self.assertRaises(ValueError):
                    validate(ROOT, {path: text.replace(old, new)})
            def test_spine(self): self.reject('docs/experience/LOCAL-CAMPAIGN.md', SPINE, '## 0. Replaced')
            def test_state(self): self.reject('docs/cradle/03-UX-STATES.md', '`L11 Shared encounter`', '`Absent`')
            def test_human(self): self.reject('docs/experience/LOCAL-CAMPAIGN.md', 'UX12', 'removed')
            def test_protocol_pending(self): self.reject('docs/experience/LOCAL-CAMPAIGN.md', 'H ratification pending (Satya)', 'ratified by merge')
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
