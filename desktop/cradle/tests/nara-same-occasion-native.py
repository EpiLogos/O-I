#!/usr/bin/env python3
"""Real saved Central identities -> kernel -> QL at one retained native sky.

This proves the protected identity operation, not a rendered world or installed
entry. --sky-snapshot must be an actual retained provider artifact: QL validates
it, and the receipt distinguishes the captured sky from a fresh observation.
"""
import argparse
import copy
import json
import math
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from importlib import util

spec = util.spec_from_file_location('native_identity_replay', Path(__file__).with_name('nara-identity-native.py'))
identity_replay = util.module_from_spec(spec)
spec.loader.exec_module(identity_replay)


class SameOccasionReplay(identity_replay.Replay):
    def run(self):
        import subprocess
        init = subprocess.run([self.args.ctrl, '--json', '--root', str(self.world), 'init'],
            capture_output=True, text=True, env=self.env, timeout=30)
        self.save_evidence('init.json', {'exit':init.returncode,'stdout':init.stdout,'stderr':init.stderr})
        assert init.returncode == 0, init.stderr + init.stdout
        self.start()
        snapshot = json.loads(Path(self.args.sky_snapshot).read_text())
        assert snapshot['schema'] == 'ql.sky-snapshot/v1' and snapshot['snapshot_ref']
        self.save_evidence('retained-native-sky.json', snapshot)
        one = identity_replay.controlled_profile()
        one['composition_policy'] = 'draft-core-birthdate-decanic-40-60-v1'
        preview = self.op('inspect-explicit-controlled-encoding-policy', 'inspect', profile=one)['reading']
        self.check('unselected encoding remains a preview', preview['birthdate_encoding']['selected'] is False)
        one['encoding_policy'] = copy.deepcopy(preview['birthdate_encoding']['policy'])
        one['encoding_policy']['policy_ref'] = 'controlled:encoding-policy:same-occasion-v1'
        two = copy.deepcopy(one)
        two.update(person_ref='controlled:native-replay:two', nara_ref='controlled:nara:native-replay:two',
            name='Controlled native identity two')
        two['birth']['date'] = '2001-11-03'
        sources = [self.op('save-' + label, 'save', profile=profile, source_ref=None, expected_revision=None)['source']
            for label, profile in [('one',one),('two',two)]]
        readings = []
        for label, source in zip(['one','two'], sources):
            readings.append(self.op('same-occasion-' + label, 'personal_current',
                source_ref=source['source_ref'], expected_revision=source['revision'],
                sky_snapshot=snapshot)['personal_current'])
        first, second = readings
        for reading, profile in zip(readings,[one,two]):
            self.check('native current retains exact person ' + profile['person_ref'],
                reading['person_ref'] == profile['person_ref'] and reading['nara_ref'] == profile['nara_ref'])
            self.check('native current retains captured cosmic snapshot for ' + profile['person_ref'],
                reading['snapshot_ref'] == snapshot['snapshot_ref']
                and reading['transit']['sky']['snapshot_ref'] == snapshot['snapshot_ref'])
            self.check('activity absence remains explicit for ' + profile['person_ref'],
                reading['q_activity'] is None and reading['q_composed'] is None)
            # Independently evaluate the explicitly selected source formula;
            # never derive this expectation from returned policy/weight fields.
            blend = reading['identity']['derived_identity_contributions']['identity_blend']
            inputs = blend['inputs']
            def components(quaternion):
                return [quaternion[key] for key in ['w','x','y','z']]
            def unit(values):
                norm = math.sqrt(sum(v*v for v in values))
                assert norm > 0
                return [v/norm for v in values]
            birth = components(inputs['birthdate_encoding']['quaternion'])
            decan = components(inputs['decanic_astrology']['quaternion'])
            expected_identity = unit([.4*a + .6*b for a,b in zip(birth,decan)])
            a,b,c,d = expected_identity
            e,f,g,h = components(reading['transit']['q_transit'])
            expected_current = unit([a*e-b*f-c*g-d*h, a*f+b*e+c*h-d*g,
                a*g-b*h+c*e+d*f, a*h+b*g-c*f+d*e])
            self.check('selected native identity follows the source 40/60 formula for ' + profile['person_ref'],
                all(math.isclose(a,b,abs_tol=1e-12) for a,b in zip(expected_identity,components(reading['q_identity'])))
                and blend['canonical_policy'] is False)
            self.check('personal current follows identity then transit Hamilton order for ' + profile['person_ref'],
                all(math.isclose(a,b,abs_tol=1e-12) for a,b in zip(expected_current,components(reading['q_identity_transit']))))
        self.check('two saved people receive exactly the same transit', first['transit'] == second['transit'])
        self.check('two saved people keep different identity sources and native reception',
            sources[0]['source_ref'] != sources[1]['source_ref']
            and first['q_identity'] is not None and second['q_identity'] is not None
            and first['q_identity'] != second['q_identity']
            and first['q_identity_transit'] != second['q_identity_transit'])
        tampered = copy.deepcopy(snapshot)
        tampered['bodies'][0]['longitude_degrees'] += 1
        rejected = self.op('refuse-altered-provider-snapshot', 'personal_current', success=False,
            source_ref=sources[0]['source_ref'], expected_revision=sources[0]['revision'], sky_snapshot=tampered)
        self.check('altered sky cannot retain a valid provider snapshot identity', bool(rejected.get('error')))
        rejected = self.op('refuse-two-sky-routes', 'personal_current', success=False,
            source_ref=sources[0]['source_ref'], expected_revision=sources[0]['revision'],
            sky_snapshot=snapshot, sky_request=snapshot['request'])
        self.check('ambiguous occasion is refused before personal calculation', 'exactly one' in rejected['error'])
        rejected = self.op('refuse-stale-identity', 'personal_current', success=False,
            source_ref=sources[0]['source_ref'], expected_revision='stale-revision', sky_snapshot=snapshot)
        self.check('shared sky does not weaken identity revision guard', 'identity changed' in rejected['error'])
        self.stop()
        self.start()
        replayed = self.op('same-occasion-after-kernel-restart', 'personal_current',
            source_ref=sources[0]['source_ref'], expected_revision=sources[0]['revision'],
            sky_snapshot=snapshot)['personal_current']
        self.check('fresh kernel retains same person and occasion',
            replayed['person_ref'] == first['person_ref']
            and replayed['snapshot_ref'] == first['snapshot_ref']
            and replayed['q_identity_transit'] == first['q_identity_transit'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('ctrl','oi','ql','bridge','output','sky-snapshot'):
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--python')
    args = parser.parse_args()
    executables = ('ctrl','oi','ql','bridge') + (('python',) if args.python else ())
    for name in executables:
        path = Path(getattr(args,name)).absolute()
        assert path.is_file() and os.access(path,os.X_OK), str(path)
        setattr(args,name,str(path))
    output = Path(args.output).absolute()
    output.mkdir(parents=True, exist_ok=False)
    replay = SameOccasionReplay(args,output)
    receipt = {'schema':'oi.nara-same-occasion-native-replay/v1',
        'classification':'controlled saved-source/kernel/QL proof; no rendered or installed-entry claim',
        'sky_artifact':str(Path(args.sky_snapshot).absolute()),
        'sky_artifact_sha256':identity_replay.digest(args.sky_snapshot),
        'binary_sha256':{name:identity_replay.digest(getattr(args,name)) for name in executables}}
    code = 0
    try:
        replay.run()
        replay.check('native executable cuts remain unchanged',
            receipt['binary_sha256'] == {name:identity_replay.digest(getattr(args,name)) for name in executables})
        receipt['status'] = 'passed'
    except Exception as error:
        receipt.update(status='failed',error=repr(error))
        print(repr(error),file=sys.stderr)
        code = 1
    finally:
        replay.stop()
        receipt.update(checks=replay.checks,calls=replay.calls)
        replay.save_evidence('receipt.json',receipt)
    return code


if __name__ == '__main__':
    sys.exit(main())
