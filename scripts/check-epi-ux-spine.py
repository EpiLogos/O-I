#!/usr/bin/env python3
"""Check Epi's scoped extension of the actual Cradle spine; no running-app verdict."""
from pathlib import Path
import argparse, re, sys, unittest
ROOT=Path(__file__).resolve().parents[1]
def validate(root, overrides=None):
    overrides=overrides or {}
    def read(p):return overrides.get(p,(root/p).read_text())
    states=read('docs/cradle/03-UX-STATES.md');verify=read('docs/cradle/04-VERIFICATION.md');skill=read('skills/cradle-execution/SKILL.md')
    for family in 'ABCDEFGHIJKL':
        if not re.search(r'^## '+family+r'\.',states,re.M):raise ValueError(f'missing state family {family}')
    for i in range(12):
        if not re.search(r'`L'+str(i)+r'\b',states):raise ValueError(f'missing Epi state L{i}')
        if f'UX{i+1:02}' not in states or f'UX{i+1:02}' not in verify:raise ValueError('missing human walk')
    for text in ['## 2. The spine: the everyday loop','## 7. Epi domain walks','fresh agent','before','human','source']:
        if text not in verify:raise ValueError(f'verification loses {text}')
    if 'description: "METHOD:' not in skill:raise ValueError('Method description prefix absent')
    if 'existing authorised readability/disclosure' not in states:raise ValueError('read/mutation authority distinction lost')
    for token in ['0→1','18','3:3','4:2','T/T′','= name','M0′','M5′']:
        if token not in states:raise ValueError(f'source specificity lost: {token}')
    return {'families':'A–K retained; scoped L0–L11 added','walks':12,'standing':'source conformance only; no runtime/agent/human acceptance'}
def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--self-test',action='store_true');args=ap.parse_args();result=validate(ROOT)
    if args.self_test:
        class Mutations(unittest.TestCase):
            def reject(self,path,old,new):
                text=(ROOT/path).read_text();self.assertIn(old,text)
                with self.assertRaises(ValueError):validate(ROOT,{path:text.replace(old,new)})
            def test_spine(self):self.reject('docs/cradle/04-VERIFICATION.md','## 2. The spine: the everyday loop','## 2. Replaced')
            def test_state(self):self.reject('docs/cradle/03-UX-STATES.md','`L11 Shared encounter`','`Absent`')
            def test_human(self):self.reject('docs/cradle/04-VERIFICATION.md','UX12','removed')
            def test_method(self):self.reject('skills/cradle-execution/SKILL.md','description: "METHOD:','description: "')
            def test_read_scope(self):self.reject('docs/cradle/03-UX-STATES.md','existing authorised readability/disclosure','anything visible')
        run=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Mutations))
        if not run.wasSuccessful():return 1
        result['mutations']=run.testsRun
    import json;print(json.dumps(result,indent=2));return 0
if __name__=='__main__':
    try:sys.exit(main())
    except (ValueError,OSError) as error:print(error,file=sys.stderr);sys.exit(1)
