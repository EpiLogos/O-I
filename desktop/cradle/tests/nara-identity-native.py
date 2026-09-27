#!/usr/bin/env python3
"""Replay real QL/Kerykeion -> desktop kernel -> Central identity persistence.

Requires actual native binaries and the installed provider Python interpreter.
Creates only a new disposable world inside --output; never uses personal data.
All operation results, including expected refusals, remain retrievable there.
"""
import argparse
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import select
import subprocess
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET


def digest(path):
    with open(path, 'rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def controlled_profile():
    return {
        'schema': 'ql.nara-identity-profile/v1',
        'person_ref': 'controlled:native-replay:one',
        'nara_ref': 'controlled:nara:native-replay:one',
        'name': 'Controlled native identity one',
        'birth': {
            'date': '1990-06-15', 'time': '12:30:00', 'precision': 'exact',
            'uncertainty_minutes': None, 'fold': None,
            'place': {'label': 'London', 'latitude_degrees': 51.5074,
                      'longitude_degrees': -0.1278, 'timezone': 'Europe/London',
                      'source_ref': 'controlled:entered-coordinate-source'},
        },
        'jungian': None, 'gene_keys': None, 'human_design': None,
        'quintessence': None,
    }


class Replay:
    def __init__(self, args, output):
        self.args, self.output = args, output
        self.world = output / 'world'
        self.checks, self.calls = [], []
        self.process = self.bridge_log = None
        self.env = {**os.environ, 'OI_BIN': args.oi, 'OI_QL_BIN': args.ql,
                    'OI_CENTRAL_CTRL_BIN': args.ctrl,
                    'OI_CENTRAL_ROOT': str(self.world),
                    'OI_CENTRAL_PROJECT_QUERY': 'controlled-no-project',
                    'QL_NARA_PROVIDER_CACHE': str(output / 'provider-cache')}
        self.env.pop('QL_NARA_PYTHON', None)
        if args.python:
            self.env['QL_NARA_PYTHON'] = args.python
        # A disposable source world has no inherited authority credential.
        self.env.pop('CENTRAL_NATIVE_TOKEN', None)

    def check(self, label, condition=True):
        if not condition:
            raise AssertionError(label)
        self.checks.append(label)
        print(label, flush=True)

    def save_evidence(self, name, value):
        (self.output / name).write_text(json.dumps(value, indent=2) + '\n')

    def start(self):
        self.bridge_log = open(self.output / f'bridge-{len(self.calls)}.log', 'w')
        self.process = subprocess.Popen([self.args.bridge, '127.0.0.1:0'],
                                        stdout=subprocess.PIPE, stderr=self.bridge_log,
                                        text=True, env=self.env, cwd=self.output)
        ready, _, _ = select.select([self.process.stdout], [], [], 30)
        assert ready, 'native bridge did not announce its port'
        line = self.process.stdout.readline()
        assert 'http://' in line, line
        self.url = 'http://' + line.split('http://', 1)[1].split()[0]

    def stop(self):
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
            self.process.stdout.close()
            self.process = None
        if self.bridge_log:
            self.bridge_log.close()
            self.bridge_log = None

    def op(self, name, operation, success=True, **parameters):
        request = {'op': 'nara_identity', 'request': {'operation': operation, **parameters}}
        http = urllib.request.Request(self.url + '/op', data=json.dumps(request).encode(),
                                      headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(http, timeout=75) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            result = json.load(error)
        evidence = f'{len(self.calls):02d}-{name}.json'
        self.save_evidence(evidence, {'request': request, 'response': result})
        self.calls.append({'name': name, 'operation': operation, 'evidence': evidence,
                           'expected_success': success, 'actual_success': result.get('ok')})
        assert result.get('ok') is success, f'{name}: {result}'
        if not success:
            return result
        outcome = result['outcome']
        assert outcome['result'] == 'nara_identity', outcome
        assert outcome['data']['schema'] == 'oi.nara-identity/v1', outcome
        return outcome['data']

    def calculated(self, result, profile):
        reading = result['reading']
        assert reading['profile'] == profile
        natal = reading['natal']
        assert natal['status'] == 'available'
        assert natal['request']['person_ref'] == profile['person_ref']
        assert natal['request']['source_revision'] == reading['input_revision']
        chart = natal['chart']
        assert chart['generator'] == 'Kerykeion.ChartDataFactory+ChartDrawer'
        assert hashlib.sha256(chart['svg'].encode()).hexdigest() == chart['sha256']
        assert ET.fromstring(chart['svg']).tag.endswith('svg')
        assert len(chart['bodies']) == 10 and len(chart['houses']) == 12
        for body in natal['sky']['bodies']:
            match = next(point for point in chart['bodies'] if point['name'].lower() == body['body'].lower())
            assert math.isclose(body['longitude_degrees'], match['abs_pos'], abs_tol=1e-7)
        composition = reading['natal_composition']
        assert len(composition['centre_evidence']) == 7
        assert composition['basis_order'] == ['Earth', 'Fire', 'Water', 'Air']
        contributions = composition['planetary_contributions']
        raw = [sum(body['raw_efwa'][axis] for body in contributions) for axis in range(4)]
        assert all(math.isclose(a, b, abs_tol=1e-8) for a, b in zip(raw, composition['raw_efwa']))
        assert math.isclose(sum(composition['elemental_balance_l1']), 1, abs_tol=1e-12)
        assert math.isclose(sum(v * v for v in composition['q_natal'].values()), 1, abs_tol=1e-12)
        for centre in composition['centre_evidence']:
            expected = [sum(body['raw_efwa'][axis] for body in contributions if body['native_planet_id'] in centre['planet_ids']) for axis in range(4)]
            assert all(math.isclose(a, b, abs_tol=1e-8) for a, b in zip(expected, centre['raw_efwa_evidence']))
        assert reading['private'] is True and reading['public_export'] is False
        return reading

    def run(self):
        init = subprocess.run([self.args.ctrl, '--json', '--root', str(self.world), 'init'],
                              capture_output=True, text=True, env=self.env, timeout=30)
        self.save_evidence('init.json', {'exit': init.returncode, 'stdout': init.stdout, 'stderr': init.stderr})
        assert init.returncode == 0, init.stderr + init.stdout
        self.start()
        self.check('new native world has no saved profiles', self.op('empty-list', 'list')['profiles'] == [])
        one = controlled_profile()
        inspected = self.op('inspect-one', 'inspect', profile=one)['reading']
        self.check('inspect preserves six offices and does not invent natal data', len(inspected['matrix']) == 6 and inspected['natal'] is None)
        first = self.calculated(self.op('calculate-one', 'calculate', profile=one), one)
        self.check('actual Kerykeion chart matches all ten native sky positions')
        saved = self.op('save-one', 'save', profile=one, source_ref=None, expected_revision=None)
        source = saved['source']
        opened = self.op('open-one', 'open', source_ref=source['source_ref'])
        self.check('native Central save and open retain exact source and revision', opened['reading']['profile'] == one and opened['source'] == source)
        self.stop()
        self.start()
        reopened = self.op('restart-open-one', 'open', source_ref=source['source_ref'])
        self.check('fresh kernel reopens exact Central profile', reopened['source'] == source and reopened['reading']['input_revision'] == first['input_revision'])
        repeated = self.calculated(self.op('recalculate-reopened-one', 'calculate', profile=reopened['reading']['profile']), one)
        # Each astronomical observation has its own snapshot receipt. That
        # receipt is not a change to the retained source or mathematical result.
        stable_composition = lambda reading: {key: value for key, value in reading['natal_composition'].items() if key != 'snapshot_ref'}
        self.check('reopened source recomputes identical chart and natal composition', repeated['natal']['chart']['sha256'] == first['natal']['chart']['sha256'] and stable_composition(repeated) == stable_composition(first))

        two = copy.deepcopy(one)
        two.update(person_ref='controlled:native-replay:two', nara_ref='controlled:nara:native-replay:two', name='Controlled native identity two')
        two['birth']['date'] = '2001-11-03'
        second = self.calculated(self.op('calculate-two', 'calculate', profile=two), two)
        self.op('save-two', 'save', profile=two, source_ref=None, expected_revision=None)
        self.check('two controlled sources produce distinct natal orientations', first['natal_composition']['q_natal'] != second['natal_composition']['q_natal'])
        self.check('native list retains both people independently', {p['person_ref'] for p in self.op('list-two', 'list')['profiles']} == {one['person_ref'], two['person_ref']})

        unknown = copy.deepcopy(one)
        unknown['birth'].update(time=None, precision='unknown')
        missing = self.op('calculate-unknown-time', 'calculate', profile=unknown)['reading']
        self.check('unknown time remains unavailable without a fabricated noon chart', missing['natal']['chart'] is None and missing['natal_composition'] is None and missing['natal']['reason'] == 'unknown-birth-time')
        approximate = copy.deepcopy(one)
        approximate['birth'].update(precision='approximate', uncertainty_minutes=30)
        conditional = self.calculated(self.op('calculate-approximate-time', 'calculate', profile=approximate), approximate)
        self.check('approximate birth time produces explicitly conditional chart', conditional['natal']['chart']['conditional'] is True and conditional['natal']['chart']['uncertainty_minutes'] == 30)

        corrected = copy.deepcopy(one)
        corrected['birth']['time'] = '13:45:00'
        correction = self.calculated(self.op('calculate-corrected', 'calculate', profile=corrected), corrected)
        corrected_saved = self.op('save-corrected', 'save', profile=corrected, source_ref=source['source_ref'], expected_revision=source['revision'])
        self.check('correction changes source revision, chart and native sky', corrected_saved['source']['revision'] != source['revision'] and correction['input_revision'] != first['input_revision'] and correction['natal']['chart']['sha256'] != first['natal']['chart']['sha256'] and correction['natal']['sky']['bodies'] != first['natal']['sky']['bodies'])
        stale = self.op('refuse-stale-save', 'save', success=False, profile=one, source_ref=source['source_ref'], expected_revision=source['revision'])
        self.check('stale revision is refused explicitly', 'revision conflict' in stale['error'])
        reassigned = self.op('refuse-person-reassignment', 'save', success=False, profile=two, source_ref=source['source_ref'], expected_revision=corrected_saved['source']['revision'])
        self.check('source cannot be reassigned to another person', 'reassigned' in reassigned['error'])
        other_nara = copy.deepcopy(corrected)
        other_nara['nara_ref'] = 'controlled:nara:another-relation'
        reassigned = self.op('refuse-nara-reassignment', 'save', success=False, profile=other_nara, source_ref=source['source_ref'], expected_revision=corrected_saved['source']['revision'])
        self.check('source cannot be reassigned to another Nara', 'reassigned' in reassigned['error'])
        final = self.op('open-after-refusals', 'open', source_ref=source['source_ref'])
        self.check('both refusals preserve the corrected Central bytes', final['reading']['profile'] == corrected and final['source'] == corrected_saved['source'])

        # Exercise a damaged real source in the disposable Central world. Other
        # people must remain accessible, and the damaged source stays visible.
        damaged = self.world / 'Control/self/nara/identities' / (hashlib.sha256(two['person_ref'].encode()).hexdigest() + '.json')
        original = damaged.read_bytes()
        try:
            damaged.write_text('{broken profile source\n')
            listed = self.op('list-with-damaged-source', 'list')
            self.check('damaged source does not hide another saved person', [p['person_ref'] for p in listed['profiles']] == [one['person_ref']])
            self.check('damaged source has an explicit individual error', len(listed['errors']) == 1 and bool(listed['errors'][0]['source_ref']) and bool(listed['errors'][0]['error']))
            self.op('refuse-open-damaged-source', 'open', success=False, source_ref=listed['errors'][0]['source_ref'])
        finally:
            damaged.write_bytes(original)
        self.check('restored source returns to native listing', len(self.op('list-after-source-repair', 'list')['profiles']) == 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('ctrl', 'oi', 'ql', 'bridge', 'output'):
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--python', help='Optional qualified diagnostic interpreter; default exercises managed runtime')
    args = parser.parse_args()
    executables = ('ctrl', 'oi', 'ql', 'bridge') + (('python',) if args.python else ())
    for name in executables:
        path = Path(getattr(args, name)).absolute()
        assert path.is_file() and os.access(path, os.X_OK), str(path)
        setattr(args, name, str(path))
    output = Path(args.output).absolute()
    output.mkdir(parents=True, exist_ok=False)
    replay = Replay(args, output)
    receipt = {'schema': 'oi.nara-identity-native-replay/v1',
               'classification': 'controlled native integration; no installed UI or Expression-engine claim',
               'provider_runtime': 'diagnostic-override' if args.python else 'managed',
               'binary_sha256': {name: digest(getattr(args, name)) for name in executables}}
    try:
        replay.run()
        final_hashes = {name: digest(getattr(args, name)) for name in executables}
        replay.check('native executable cuts remain unchanged throughout replay', final_hashes == receipt['binary_sha256'])
        receipt['status'] = 'passed'
        return_code = 0
    except Exception as error:
        receipt.update(status='failed', error=repr(error))
        print(repr(error), file=sys.stderr)
        return_code = 1
    finally:
        replay.stop()
        receipt.update(checks=replay.checks, calls=replay.calls)
        replay.save_evidence('receipt.json', receipt)
    return return_code


if __name__ == '__main__':
    sys.exit(main())
