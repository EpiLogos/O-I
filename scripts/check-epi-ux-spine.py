#!/usr/bin/env python3
"""Check the H-pending Epi extension; never confer running-app or human acceptance."""
from pathlib import Path
import argparse, json, re, sys, unittest
ROOT = Path(__file__).resolve().parents[1]
SPINE = '## 0. The spine: the everyday loop'
HOST_STATES = '### 0.5 Host states and the rows that carry them'
EPI_WALKS = '## 12. Epi domain walks'
EPI_STATES = '### 12.1 L. Epi living-instrument states'
STORY_ROW = re.compile(r'^\| ([A-Z]{2}\d\d) \|', re.M)
# The cradle's state families A–K retired from docs/cradle/03-UX-STATES.md
# (O-I #779). Each family is an area of LOCAL-CAMPAIGN §0.3, and each of its
# states is a row of §0.5 naming the story rows that tell it.
AREAS = {'A': 'Inhabitation', 'B': 'Focus', 'C': 'Writing', 'D': 'Agency',
         'E': 'Encounter', 'F': 'Context and knowledge', 'G': 'Development',
         'H': 'Material', 'I': 'Shared', 'J': 'Presentation', 'K': 'Authority'}
STATES = {
    'A': ['A0 Unrecognised', 'A1 Recognising', 'A2 Inhabited-minimal', 'A3 Inhabited',
          'A2/A3.d Product absent', 'A*.d Degraded', 'A.U'],
    'B': ['B0 No focus', 'B1 Focused(subject)', 'B2 Multi-focus', 'B3 Promoted',
          'B4 Detached', 'B5 Returned'],
    'C': ['C0 Blank', 'C1 Authoring', 'C2 Addressing', 'C3 Commissioned',
          'C4 Continuing', 'C5 Conflict', 'C.T'],
    'D': ['D-create Intent', 'D-create Resolving', 'D-create Determined', 'D-idle',
          'D-working', 'D-waiting', 'D-attention', 'D-unavailable', 'D-returned', 'D.P'],
    'E': ['E0 Quiescent', 'E1 Composing', 'E2 Streaming', 'E3 Permission-requested',
          'E4 Turn-complete', 'E5 Interrupted', 'E6 Session-switched', 'E7 Observing',
          'E8 Lineage', 'E.G absent', 'E.G restricted', 'E.G attaching', 'E.G connected',
          'E.G reconnecting/last-observed', 'E.G lost/rematerialised', 'E.G subject-switched'],
    'F': ['F-eligible', 'F-disclosed', 'F-excluded', 'F-withheld', 'F-degraded', 'F-aperture'],
    'G': ['G0 Ordinary', 'G1 Entering', 'G2 Commissioned', 'G3 Running', 'G4 Candidate-formed',
          'G5 Recognition-pending', 'G6 Recognised', 'G7 Failed/returned', 'G.W'],
    'H': ['H-implicit', 'H-named', 'H-materialising', 'H-relocated', 'H-failed'],
    'I': ['I-private', 'I-projecting', 'I-shared', 'I-encountering', 'I-addressed', 'I-contributing'],
    'J': ['J-rest', 'J-summoned(region)', 'J-full', 'J-focused-work', 'J-detached(n)'],
    'K': ['K-read', 'K-proposed', 'K-grant-bounded', 'K-refused', 'K-expired', 'K-escalated'],
}
# The meaning each former sub-family carried, held in the row that now tells it.
MEANINGS = {
    'C.T': ('WR04', 'edited H becomes protected human material'),
    'D.P': ('AG08', 'No fake profile'),
    'G.W': ('DV02', 'personal staged/unstaged/untracked work is untouched'),
    'A.U': ('DV07', 'the person does not carry messages between product chats'),
    'E.G connected': ('FQ01', 'the conversation is the same thread its Agent shows, in every mode'),
}


def section(text, heading, name):
    if heading not in text:
        raise ValueError(f'missing section: {name}')
    rest = text.split(heading, 1)[1]
    end = re.search(r'^#{2,3} ', rest, re.M)
    return rest[:end.start()] if end else rest


def expand(cell):
    ids = []
    for part in [p.strip() for p in cell.split(',') if p.strip()]:
        m = re.fullmatch(r'([A-Z]{2})(\d\d)(?:–([A-Z]{2})(\d\d))?', part)
        if not m:
            raise ValueError(f'malformed story reference {part!r}')
        if m.group(3):
            ids += [f'{m.group(1)}{n:02}' for n in range(int(m.group(2)), int(m.group(4)) + 1)]
        else:
            ids.append(part)
    return ids


def validate(root, overrides=None):
    overrides = overrides or {}
    def read(path):
        return overrides.get(path, (root / path).read_text())
    # The everyday-loop spine, the host states, the UX01–UX12 walks and the
    # Epi states L0–L11 are all in the one test protocol (O-I #728, #779).
    protocol = read('docs/experience/LOCAL-CAMPAIGN.md')
    stories = read('docs/experience/STORIES.md')
    manual = read('ProjectCentral/docs/1-vision/dlw/DLW.md')
    skill = read('skills/cradle-execution/SKILL.md')
    for text in [SPINE, '## 11. Source reconciliation and unresolved evidence', EPI_WALKS, 'fresh agent', 'human']:
        if text not in protocol:
            raise ValueError(f'test protocol loses {text}')
    rows = {m.group(1): line for line in stories.split('\n') for m in [STORY_ROW.match(line)] if m}
    host = section(protocol, HOST_STATES, 'host states')
    conditions = section(protocol, '### 0.3 Conditions per area', 'conditions per area')
    told = {}
    for line in host.split('\n'):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) != 4 or not cells[1].startswith('`'):
            continue
        code = re.match(r'`([^`]+)`', cells[1]).group(1)
        ids = expand(cells[3])
        if not ids or any(i not in rows for i in ids):
            raise ValueError(f'state {code} is told by no declared story row')
        told[code] = (cells[0], cells[2], ids)
    for family, states in STATES.items():
        if f'**{AREAS[family]}.**' not in conditions:
            raise ValueError(f'missing state family {family}: no §0.3 area {AREAS[family]}')
        for state in states:
            if state not in told or told[state][0] != AREAS[family]:
                raise ValueError(f'missing state {state} of family {family}')
    for code, (row, text) in MEANINGS.items():
        if code not in told or row not in told[code][2] or text not in rows.get(row, ''):
            raise ValueError(f'current Cradle meaning lost: {code}')
    if 'Non-effectful read within actual access/disclosure scope' not in told['K-read'][1]:
        raise ValueError('current read/authority distinction lost')
    if 'Central is the root meta-Project' not in protocol:
        raise ValueError('current Cradle meaning lost: root meta-Project')
    if 'A receipt does not mean you have seen or accepted what it records' not in ' '.join(section(
            manual, '#### Rules for every device and view', 'manual §16 rules').split()):
        raise ValueError('current Cradle meaning lost: receipt is not awareness, inclusion or Recognition')
    walks = protocol.split(EPI_WALKS, 1)[1].split(EPI_STATES, 1)[0]
    epi = section(protocol, EPI_STATES, 'Epi states')
    for i in range(12):
        if not re.search(r'`L' + str(i) + r'\b', epi):
            raise ValueError(f'missing Epi state L{i}')
        if f'UX{i+1:02}' not in epi or f'UX{i+1:02}' not in walks:
            raise ValueError('missing human walk')
    if 'description: "METHOD:' not in skill:
        raise ValueError('Method description prefix absent')
    for token in ['0→1', '18', '3:3', '4:2', 'T/T′', '= name', 'M0′', 'M5′']:
        if token not in epi:
            raise ValueError(f'source specificity lost: {token}')
    for text in [epi, walks, skill.split('## Epi domain:', 1)[1]]:
        if 'H ratification pending (Satya)' not in text:
            raise ValueError('new Epi material loses its pending H standing')
    return {'families': 'A–K held as host states (LOCAL-CAMPAIGN §0.5) told by story rows; H-pending L0–L11 in LOCAL-CAMPAIGN §12.1',
            'states': len(told), 'walks': 12, 'H_ratification': 'pending',
            'standing': 'source conformance only; no runtime/agent/human acceptance'}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--self-test', action='store_true')
    args = ap.parse_args()
    result = validate(ROOT)
    if args.self_test:
        protocol = 'docs/experience/LOCAL-CAMPAIGN.md'
        class Mutations(unittest.TestCase):
            def reject(self, path, old, new):
                text = (ROOT / path).read_text()
                self.assertIn(old, text)
                with self.assertRaises(ValueError):
                    validate(ROOT, {path: text.replace(old, new)})
            def test_spine(self): self.reject(protocol, SPINE, '## 0. Replaced')
            def test_state(self): self.reject(protocol, '`L11 Shared encounter`', '`Absent`')
            def test_human(self): self.reject(protocol, 'UX12', 'removed')
            def test_protocol_pending(self): self.reject(protocol, '**Publication authorised; H ratification pending (Satya), 2026-09-12.** This\nsection', '**Publication authorised; ratified by merge.** This\nsection')
            def test_method(self): self.reject('skills/cradle-execution/SKILL.md', 'description: "METHOD:', 'description: "')
            def test_scope(self): self.reject(protocol, 'Non-effectful read within actual access/disclosure scope', 'anything visible')
            def test_pending(self): self.reject(protocol, '**Publication authorised; H ratification pending (Satya), 2026-09-12.** This new', '**Publication authorised; ratified by merge.** This new')
            def test_concurrent(self): self.reject(protocol, '| Development | `G.W` |', '| Development | `Removed` |')
            def test_concurrent_row(self): self.reject('docs/experience/STORIES.md', 'personal staged/unstaged/untracked work is untouched', 'the checkout is cleaned first')
            def test_family(self): self.reject(protocol, '**Shared.**', '**Elsewhere.**')
            def test_family_state(self): self.reject(protocol, '| Presentation | `J-detached(n)` |', '| Presentation | `J-gone` |')
            def test_story_row(self): self.reject(protocol, '| Authority | `K-refused` | Human declined | RA02,', '| Authority | `K-refused` | Human declined | ZZ99,')
            def test_root(self): self.reject(protocol, 'Central is the root meta-Project', 'Central is a child Project')
            def test_receipt(self): self.reject('ProjectCentral/docs/1-vision/dlw/DLW.md', 'A receipt does not mean you have seen or accepted what it\n  records', 'A receipt is acceptance of what it\n  records')
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
